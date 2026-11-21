// Skylike calendar function
// - Cron (x-cron-secret header): syncs every household with a connected bridge.
// - Signed-in member (Authorization: Bearer <jwt>): { household_id, action: 'sync' | 'calendars' | 'test' }
import { createClient } from "npm:@supabase/supabase-js@2";
import ICAL from "npm:ical.js@2.2.1";

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

// ---- calendar links (secret iCal addresses), read-only ----
function parseIcs(text: string, from: Date, to: Date, calId: string): any[] {
  const comp = new ICAL.Component(ICAL.parse(text));
  for (const tz of comp.getAllSubcomponents("vtimezone")) { try { ICAL.TimezoneService.register(tz); } catch (_) {} }
  const groups = new Map();
  for (const v of comp.getAllSubcomponents("vevent")) {
    const uid = v.getFirstPropertyValue("uid") || Math.random().toString(36);
    const g = groups.get(uid) || { master: null, ex: [] };
    if (v.hasProperty("recurrence-id")) g.ex.push(v); else g.master = v;
    groups.set(uid, g);
  }
  const out: any[] = [];
  const add = (item: any, s: Date, e: Date, key: string) => {
    if (!(s < to && e > from)) return;
    if ((item.component.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED") return;
    const allDay = item.startDate.isDate;
    out.push({ calendarId: calId, key, title: item.summary || "", allDay,
      start: allDay ? item.startDate.toString().slice(0, 10) + "T00:00:00Z" : s.toISOString(),
      end: allDay ? (item.endDate ? item.endDate.toString().slice(0, 10) : item.startDate.toString().slice(0, 10)) + "T00:00:00Z" : e.toISOString(),
      location: item.location || null });
  };
  for (const [uid, g] of groups) {
    if (!g.master) { for (const v of g.ex) { const ev = new ICAL.Event(v); add(ev, ev.startDate.toJSDate(), ev.endDate.toJSDate(), uid + "@" + ev.startDate.toJSDate().getTime()); } continue; }
    const ev = new ICAL.Event(g.master, { exceptions: g.ex });
    if (ev.isRecurring()) {
      const it = ev.iterator(); let t: any, n = 0;
      while ((t = it.next()) && n++ < 5000) {
        if (t.toJSDate() > to) break;
        const d = ev.getOccurrenceDetails(t);
        const s = d.startDate.toJSDate(), e = d.endDate.toJSDate();
        if (e < from) continue;
        add(d.item, s, e, uid + "@" + t.toJSDate().getTime());
      }
    } else add(ev, ev.startDate.toJSDate(), ev.endDate ? ev.endDate.toJSDate() : ev.startDate.toJSDate(), uid + "@" + ev.startDate.toJSDate().getTime());
  }
  return out;
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
  const { data: feeds } = await admin.from("calendar_feeds_private").select("id, url").eq("household_id", hid);
  if (!b && !(feeds && feeds.length)) return { household_id: hid, skipped: "not connected" };
  const from = new Date(Date.now() - 2 * 864e5);
  const to = new Date(Date.now() + 400 * 864e5); // ~13 months so month view can look ahead
  const errors: string[] = [];
  let rows: any[] = [];
  const handled = new Set<string>();
  try {
    if (b) {
      let { data: cals } = await admin.from("calendars").select("google_id, enabled").eq("household_id", hid).not("google_id", "like", "ics:%");
      if (!cals || cals.length === 0) {
        await refreshCalendars(b);
        ({ data: cals } = await admin.from("calendars").select("google_id, enabled").eq("household_id", hid).not("google_id", "like", "ics:%"));
      }
      (cals || []).forEach((c: any) => handled.add(c.google_id));
      const ids = (cals || []).filter((c: any) => c.enabled).map((c: any) => c.google_id);
      if (ids.length) {
        const data = await callBridge(b, { action: "events", ids: ids.join(","), from: from.toISOString(), to: to.toISOString() });
        rows = rows.concat((data.events || []));
      }
    }
  } catch (err) { errors.push("Two-way link: " + String((err as Error).message || err)); }
  if (feeds && feeds.length) {
    const { data: cals } = await admin.from("calendars").select("google_id, enabled").eq("household_id", hid).like("google_id", "ics:%");
    const on = new Set((cals || []).filter((c: any) => c.enabled).map((c: any) => c.google_id));
    for (const f of feeds) {
      const cid = "ics:" + f.id; handled.add(cid);
      if (!on.has(cid)) continue;
      try {
        const res = await fetch(f.url, { redirect: "follow" });
        if (!res.ok) throw new Error(res.status === 404 ? "link not found (it may have been reset)" : "link returned " + res.status);
        const text = await res.text();
        if (!text.includes("BEGIN:VCALENDAR")) throw new Error("that link isn't a calendar file");
        rows = rows.concat(parseIcs(text, from, to, cid));
      } catch (err) {
        errors.push(String((err as Error).message || err));
        handled.delete(cid); // keep old events rather than wiping them on a failed fetch
      }
    }
  }
  try {
    const now = new Date().toISOString();
    const out = rows.map((e: any) => ({
      household_id: hid, calendar_id: e.calendarId, event_id: e.key, title: e.title || "",
      starts_at: e.start, ends_at: e.end, all_day: !!e.allDay, location: e.location, updated_at: now,
    }));
    for (let i = 0; i < out.length; i += 500) {
      const { error } = await admin.from("events_cache").upsert(out.slice(i, i + 500), { onConflict: "household_id,calendar_id,event_id" });
      if (error) throw error;
    }
    const keep = new Set(out.map((r: any) => r.calendar_id + "|" + r.event_id));
    const { data: current } = await admin.from("events_cache")
      .select("id, calendar_id, event_id").eq("household_id", hid)
      .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString());
    const stale = (current || []).filter((r: any) => handled.has(r.calendar_id) && !keep.has(r.calendar_id + "|" + r.event_id)).map((r: any) => r.id);
    for (let i = 0; i < stale.length; i += 200) await admin.from("events_cache").delete().in("id", stale.slice(i, i + 200));
    await admin.from("events_cache").delete().eq("household_id", hid).lt("ends_at", from.toISOString());
    const msg = errors.length ? errors.join("; ").slice(0, 300) : null;
    await admin.from("household_private").upsert({ household_id: hid, last_sync_at: now, last_sync_error: msg }, { onConflict: "household_id" });
    return { household_id: hid, events: out.length, removed: stale.length, error: msg || undefined };
  } catch (err) {
    const msg = String((err as Error).message || err).slice(0, 300);
    await admin.from("household_private").upsert({ household_id: hid, last_sync_error: msg }, { onConflict: "household_id" });
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
    const { data: fp } = await admin.from("calendar_feeds_private").select("household_id");
    const ids = new Set([...(hp || []), ...(fp || [])].map((h: any) => h.household_id));
    const results = [];
    for (const id of ids) results.push(await syncHousehold(id));
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
  // Two-way editing through the household's Apps Script bridge, then a fresh sync so every screen updates.
  if (action === "create" || action === "update" || action === "delete") {
    const b = await getBridge(hid);
    if (!b) return json({ error: "Two-way editing isn't connected yet (Settings → Calendar)." }, 400);
    const p: Record<string, string> = { action };
    if (action !== "create") {
      const { data: ev } = await admin.from("events_cache").select("calendar_id,event_id,starts_at").eq("household_id", hid).eq("id", String(body.id || "")).maybeSingle();
      if (!ev) return json({ error: "That event has changed. Refresh and try again." }, 404);
      if (String(ev.calendar_id).startsWith("ics:")) return json({ error: "That calendar is a read-only link. Edit it in Google Calendar." }, 400);
      const at = String(ev.event_id).lastIndexOf("@");
      p.calendarId = ev.calendar_id; p.id = at > 0 ? String(ev.event_id).slice(0, at) : ev.event_id; p.originalStart = ev.starts_at;
    } else {
      const { data: cal } = await admin.from("calendars").select("google_id").eq("household_id", hid).eq("id", String(body.calendar || "")).maybeSingle();
      if (!cal || String(cal.google_id).startsWith("ics:")) return json({ error: "Pick a two-way calendar to add it to." }, 400);
      p.calendarId = cal.google_id;
    }
    for (const k of ["title", "start", "end", "location"]) if (body[k] !== undefined && body[k] !== null) p[k] = String(body[k]).slice(0, 500);
    if (body.allDay !== undefined) p.allDay = body.allDay ? "true" : "false";
    try { await callBridge(b, p); } catch (err) { return json({ error: String((err as Error).message || err) }, 502); }
    const r = await syncHousehold(hid);
    return json({ ok: true, sync: r });
  }
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
