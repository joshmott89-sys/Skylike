// Skylike phone notifications (Web Push).
// Server calls (x-cron-secret): { action: "tick" } every 5 minutes, { action: "assigned", item_id, actor }
// Signed-in member: { action: "test", household_id, device_id }
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

let secret = "";
async function init() {
  if (secret) return;
  const { data } = await admin.from("app_private").select("vapid_public,vapid_private,cron_secret").eq("id", 1).single();
  webpush.setVapidDetails("mailto:skylike-alerts@users.noreply.github.com", data!.vapid_public, data!.vapid_private);
  secret = data!.cron_secret;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; member_id: string | null; prefs: Record<string, boolean>; fails: number };
async function send(subs: Sub[], payload: { title: string; body: string; url?: string; tag?: string }) {
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3 * 3600, urgency: "high" });
      ok++;
      await admin.from("push_subscriptions").update({ last_ok: new Date().toISOString(), fails: 0 }).eq("id", s.id);
    } catch (e) {
      const code = (e as any)?.statusCode;
      console.log(JSON.stringify({ push_error: code, msg: String((e as any)?.body || e).slice(0, 200) }));
      if (code === 404 || code === 410 || s.fails >= 5) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else await admin.from("push_subscriptions").update({ fails: s.fails + 1 }).eq("id", s.id);
    }
  }
  return ok;
}
// Send once: a key in notify_log stops repeats (cron runs every 5 minutes).
async function once(key: string, hid: string) {
  const { error } = await admin.from("notify_log").insert({ key, household_id: hid });
  return !error;
}

// ---- local time helpers ----
function local(tz: string, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(d).map(x => [x.type, x.value]));
  const hour = +p.hour % 24, minute = +p.minute;
  return { key: `${p.year}-${p.month}-${p.day}`, hour, minute, mins: hour * 60 + minute };
}
const addDays = (k: string, n: number) => { const d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (k: string) => new Date(k + "T12:00:00Z").getUTCDay();
const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 864e5);
function reminderOn(r: any, k: string) {
  if (weekday(k) !== r.weekday) return false;
  if ((r.every_weeks || 1) <= 1 || !r.anchor_date) return true;
  const w = Math.round(daysBetween(r.anchor_date, k) / 7);
  return ((w % r.every_weeks) + r.every_weeks) % r.every_weeks === 0;
}
const fmtTime = (iso: string, tz: string) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso)).replace(" ", "").toLowerCase();
const norm = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const thaw = (n: string) => /chicken|beef|mince|pork|lamb|sausage|bacon|steak|fish|salmon|prawn|turkey|thigh|breast|fillet|stock|pastry|bread|soup|sauce|bolognese|curry|casserole|leftover/.test(norm(n));
const same = (a: string, b: string) => { const A = norm(a).split(" "), B = norm(b).split(" "); const [s, l] = A.length <= B.length ? [A, B] : [B, A]; return s.length > 0 && s.every(w => l.some(x => x === w || x.replace(/s$/, "") === w.replace(/s$/, ""))); };

async function subsFor(hid: string, pref: string, memberIds?: string[]) {
  let q = admin.from("push_subscriptions").select("id,endpoint,p256dh,auth,member_id,prefs,fails").eq("household_id", hid);
  if (memberIds) q = q.in("member_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;
  return ((data || []) as Sub[]).filter(s => (s.prefs || {})[pref] !== false);
}

async function tick() {
  const { data: hh } = await admin.from("push_subscriptions").select("household_id");
  const ids = [...new Set((hh || []).map((r: any) => r.household_id))];
  let sent = 0;
  for (const hid of ids) {
    const { data: h } = await admin.from("households").select("timezone,settings").eq("id", hid).single();
    if (!h) continue;
    const tz = h.timezone || "Australia/Perth", L = local(tz), st = h.settings || {}, buffer = +st.leaveBuffer || 15;
    const { data: members } = await admin.from("members").select("id,name,kind").eq("household_id", hid);
    const adults = (members || []).filter((m: any) => m.kind !== "kid").map((m: any) => m.id);

    // 1) Leave reminders: events with a place to go, about 10 minutes before you need to leave.
    const now = Date.now();
    const { data: evs } = await admin.from("events_cache").select("event_id,calendar_id,title,starts_at,location,all_day").eq("household_id", hid).eq("all_day", false)
      .gte("starts_at", new Date(now).toISOString()).lte("starts_at", new Date(now + (buffer + 30) * 60e3).toISOString());
    if ((evs || []).length) {
      const { data: cals } = await admin.from("calendars").select("id,google_id,member_id").eq("household_id", hid);
      for (const e of evs || []) {
        if (!e.location || !String(e.location).trim()) continue;
        const leaveIn = Math.round((new Date(e.starts_at).getTime() - now) / 60e3 - buffer);
        if (leaveIn < 3 || leaveIn > 15) continue;
        if (!(await once(`leave:${hid}:${e.event_id}:${e.starts_at}`, hid))) continue;
        const cal = (cals || []).find((c: any) => c.google_id === e.calendar_id || c.id === e.calendar_id);
        const who = cal && cal.member_id ? [cal.member_id] : adults;
        sent += await send(await subsFor(hid, "leave", who), { title: `Leave in ${leaveIn} min`, body: `${e.title} at ${fmtTime(e.starts_at, tz)} · ${e.location}`, tag: "leave-" + e.event_id, url: "./" });
      }
    }

    // 2) Evening heads-up at 7pm: bins out, lunchboxes and defrosting for tomorrow.
    if (L.mins >= 19 * 60 && L.mins < 19 * 60 + 15) {
      const tmr = addDays(L.key, 1), lines: string[] = [];
      const { data: rem } = await admin.from("reminders").select("*").eq("household_id", hid);
      const bins = (rem || []).filter((r: any) => r.show_day_before && reminderOn(r, tmr));
      if (bins.length) lines.push(`🗑️ ${bins.map((r: any) => r.title).join(" + ")} out tonight`);
      const { data: meals } = await admin.from("meals").select("slot,title,ingredients,cooked,leftovers_of").eq("household_id", hid).eq("day", tmr);
      const lunch = (meals || []).find((m: any) => m.slot === "lunch");
      if (lunch) { const kids = [...new Set((lunch.ingredients || []).map((i: any) => i.who).filter(Boolean))]; lines.push(`🍱 Lunchboxes tomorrow${kids.length ? ` for ${kids.join(" and ")}` : ""}`); }
      const dinner = (meals || []).find((m: any) => m.slot === "dinner" && !m.cooked && !m.leftovers_of);
      if (dinner) {
        const { data: frz } = await admin.from("pantry").select("name").eq("household_id", hid).eq("place", "freezer").eq("leftover", false);
        const dz = [...new Set((dinner.ingredients || []).map((x: any) => (frz || []).find((p: any) => thaw(p.name) && same(p.name, x.name))).filter(Boolean).map((p: any) => p.name))];
        if (dz.length) lines.push(`❄️ Defrost ${dz.join(", ")} for ${dinner.title}`);
      }
      if (lines.length && await once(`evening:${hid}:${L.key}`, hid)) sent += await send(await subsFor(hid, "evening", adults), { title: "For tonight", body: lines.join("\n"), tag: "evening", url: "./" });
    }

    // 3) Morning at 7am: lunchboxes to pack and what's first today (only when there is something).
    if (L.mins >= 7 * 60 && L.mins < 7 * 60 + 15) {
      const lines: string[] = [];
      const { data: meals } = await admin.from("meals").select("slot").eq("household_id", hid).eq("day", L.key).eq("slot", "lunch");
      if ((meals || []).length) lines.push("🍱 Pack the lunchboxes");
      const { data: rem } = await admin.from("reminders").select("*").eq("household_id", hid);
      const binsToday = (rem || []).filter((r: any) => !r.show_day_before && reminderOn(r, L.key));
      if (binsToday.length) lines.push(`🗑️ ${binsToday.map((r: any) => r.title).join(" + ")} today`);
      const dayEnd = new Date(now + (24 * 60 - L.mins) * 60e3).toISOString();
      const { data: first } = await admin.from("events_cache").select("title,starts_at").eq("household_id", hid).eq("all_day", false).gte("starts_at", new Date(now).toISOString()).lte("starts_at", dayEnd).order("starts_at").limit(1);
      if (first && first[0]) lines.push(`📅 First up: ${first[0].title} at ${fmtTime(first[0].starts_at, tz)}`);
      if (lines.length && await once(`morning:${hid}:${L.key}`, hid)) sent += await send(await subsFor(hid, "morning", adults), { title: "Today", body: lines.join("\n"), tag: "morning", url: "./" });
    }
  }
  // tidy the log
  await admin.from("notify_log").delete().lt("sent_at", new Date(Date.now() - 3 * 864e5).toISOString());
  return sent;
}

async function assigned(itemId: string, actor: string | null) {
  const { data: it } = await admin.from("list_items").select("id,household_id,text,assignee,added_by,done").eq("id", itemId).single();
  if (!it || !it.assignee || it.done) return 0;
  const { data: who } = await admin.from("members").select("id,user_id,name").eq("id", it.assignee).single();
  if (!who || (actor && who.user_id === actor)) return 0; // you gave it to yourself
  let from = "";
  if (actor) { const { data: m } = await admin.from("members").select("name").eq("household_id", it.household_id).eq("user_id", actor).maybeSingle(); from = m?.name || ""; }
  if (!(await once(`assigned:${it.id}:${it.assignee}`, it.household_id))) return 0;
  return await send(await subsFor(it.household_id, "assigned", [it.assignee]), { title: from ? `${from} gave you a to-do` : "New to-do for you", body: it.text, tag: "todo-" + it.id, url: "./?view=lists" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  await init();
  const body = await req.json().catch(() => ({}));
  try {
    if (req.headers.get("x-cron-secret")) {
      if (req.headers.get("x-cron-secret") !== secret) return json({ error: "unauthorised" }, 401);
      if (body.action === "tick") return json({ sent: await tick() });
      if (body.action === "assigned") return json({ sent: await assigned(String(body.item_id), body.actor || null) });
      return json({ error: "unknown action" }, 400);
    }
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Please sign in again" }, 401);
    const hid = String(body.household_id || "");
    const { data: m } = await admin.from("memberships").select("user_id").eq("household_id", hid).eq("user_id", u.user.id).maybeSingle();
    if (!m) return json({ error: "not a member" }, 403);
    if (body.action === "test") {
      const { data: subs } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth,member_id,prefs,fails").eq("household_id", hid).eq("device_id", String(body.device_id || ""));
      const n = await send((subs || []) as Sub[], { title: "Skylike notifications are on 🎉", body: "You'll get to-dos given to you, leave reminders and a heads-up at 7pm.", tag: "test", url: "./" });
      return json({ sent: n });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
