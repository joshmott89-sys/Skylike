// Skylike calendar function
// - Cron (x-cron-secret header): syncs every household with a connected bridge.
// - Signed-in member (Authorization: Bearer <jwt>): { household_id, action: 'sync' | 'calendars' | 'test' }
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Bridge = { household_id: string; bridge_url: string; bridge_key: string };

async function callBridge(b: Bridge, params: Record<string, string>) {
  const u = new URL(b.bridge_url);
  u.searchParams.set("key", b.bridge_key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u.toString(), { redirect: "follow" });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error("Bridge did not return JSON. Check it is deployed with access set to Anyone."); }
  if (!data.ok) throw new Error(data.error || "Bridge error");
  return data;
}

async function getBridge(hid: string): Promise<Bridge | null> {
  const { data } = await admin.from("household_private")
    .select("household_id, bridge_url, bridge_key").eq("household_id", hid).maybeSingle();
  return data && data.bridge_url ? (data as Bridge) : null;
}

async function refreshCalendars(b: Bridge) {
  const data = await callBridge(b, { action: "calendars" });
  const { data: existing } = await admin.from("calendars").select("google_id").eq("household_id", b.household_id);
  const known = new Set((existing || []).map((c: any) => c.google_id));
  const fresh = (data.calendars || []).filter((c: any) => !known.has(c.id));
  if (fresh.length) {
    await admin.from("calendars").insert(fresh.map((c: any) => ({
      household_id: b.household_id,
      google_id: c.id,
      name: c.name,
      color: c.color,
      // Only the owner's main calendar is on by default; others can be switched on in Settings.
      enabled: !!c.primary,
    })));
  }
  return data.calendars;
}

async function syncHousehold(hid: string) {
  const b = await getBridge(hid);
  if (!b) return { household_id: hid, skipped: "not connected" };
  try {
    let { data: cals } = await admin.from("calendars").select("google_id, enabled").eq("household_id", hid);
    if (!cals || cals.length === 0) {
      await refreshCalendars(b);
      ({ data: cals } = await admin.from("calendars").select("google_id, enabled").eq("household_id", hid));
    }
    const ids = (cals || []).filter((c: any) => c.enabled).map((c: any) => c.google_id);
    const from = new Date(Date.now() - 2 * 864e5);
    const to = new Date(Date.now() + 42 * 864e5);
    const data = ids.length
      ? await callBridge(b, { action: "events", ids: ids.join(","), from: from.toISOString(), to: to.toISOString() })
      : { events: [] };
    const rows = (data.events || []).map((e: any) => ({
      household_id: hid,
      calendar_id: e.calendarId,
      event_id: e.key,
      title: e.title || "",
      starts_at: e.start,
      ends_at: e.end,
      all_day: !!e.allDay,
      location: e.location,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error } = await admin.from("events_cache").upsert(rows, { onConflict: "household_id,calendar_id,event_id" });
      if (error) throw error;
    }
    // Remove events in the window that no longer exist (or belong to switched-off calendars).
    const keep = new Set(rows.map((r: any) => r.calendar_id + "|" + r.event_id));
    const { data: current } = await admin.from("events_cache")
      .select("id, calendar_id, event_id").eq("household_id", hid)
      .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString());
    const stale = (current || []).filter((r: any) => !keep.has(r.calendar_id + "|" + r.event_id)).map((r: any) => r.id);
    if (stale.length) await admin.from("events_cache").delete().in("id", stale);
    await admin.from("events_cache").delete().eq("household_id", hid).lt("ends_at", from.toISOString());
    await admin.from("household_private").update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq("household_id", hid);
    return { household_id: hid, events: rows.length, removed: stale.length };
  } catch (err) {
    const msg = String((err as Error).message || err).slice(0, 300);
    await admin.from("household_private").update({ last_sync_error: msg }).eq("household_id", hid);
    return { household_id: hid, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({}));

  const cronHeader = req.headers.get("x-cron-secret");
  if (cronHeader) {
    const { data } = await admin.from("app_private").select("cron_secret").eq("id", 1).single();
    if (!data || data.cron_secret !== cronHeader) return json({ error: "unauthorised" }, 401);
    const { data: hp } = await admin.from("household_private").select("household_id").not("bridge_url", "is", null);
    const results = [];
    for (const h of hp || []) results.push(await syncHousehold(h.household_id));
    return json({ ok: true, results });
  }

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (!user) return json({ error: "Please sign in again" }, 401);
  const hid = body.household_id as string;
  if (!hid) return json({ error: "household_id required" }, 400);
  const { data: m } = await admin.from("memberships").select("user_id")
    .eq("household_id", hid).eq("user_id", user.id).maybeSingle();
  if (!m) return json({ error: "not a member" }, 403);

  const action = body.action || "sync";
  if (action === "test" || action === "calendars") {
    const b = await getBridge(hid);
    if (!b) return json({ error: "Calendar not connected yet" }, 400);
    try {
      const calendars = await refreshCalendars(b);
      return json({ ok: true, calendars });
    } catch (err) {
      return json({ error: String((err as Error).message || err) }, 502);
    }
  }
  return json(await syncHousehold(hid));
});
