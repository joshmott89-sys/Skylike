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
// Each person's assistant (Settings → Assistant) words their notifications. The facts are the same; the voice changes.
type P = { soon: (t: string) => string; now: (n: number) => string; evening: string; morning: string; assigned: (f: string) => string; test: string };
const PCOPY: Record<string, P> = {
  sunny: { soon: t => `Leave at ${t} ☀️`, now: n => n > 1 ? `Leave in ${n} min! 🚗` : "Time to go! 🚗", evening: "Tonight's little jobs ✨", morning: "Good morning! ☀️ Tap to hear your day", assigned: f => f ? `${f} gave you a to-do ✨` : "A new to-do for you ✨", test: "Yay, notifications are on! 🎉" },
  mate: { soon: t => `Head off at ${t}, mate`, now: n => n > 1 ? `Off in ${n}, mate` : "Righto, time to head off", evening: "Before you knock off tonight", morning: "Morning! Here's the go today", assigned: f => f ? `${f} reckons this one's yours` : "One for you, mate", test: "Notifications are on. Too easy." },
  sass: { soon: t => `Out the door by ${t}, please`, now: n => n > 1 ? `${n} minutes. Find your keys.` : "Keys. Shoes. Door. Now.", evening: "Before you collapse on the couch…", morning: "Up and at 'em. Here's your day", assigned: f => f ? `${f} volunteered you` : "Guess who's got a new job", test: "Notifications on. You're welcome." },
  willow: { soon: t => `When you're ready: leave at ${t} 🌿`, now: n => n > 1 ? `About ${n} minutes until you leave` : "It's time to leave. You've got this.", evening: "A few things for this evening 🌿", morning: "Good morning 🌿 Your day, gently", assigned: f => f ? `${f} passed you a to-do` : "A to-do for you, no rush", test: "Notifications are on 🌿" },
  news: { soon: t => `Leave at ${t}`, now: n => n > 1 ? `Leave in ${n} min` : "Time to leave", evening: "For tonight", morning: "Today · tap to hear your brief", assigned: f => f ? `${f} gave you a to-do` : "New to-do for you", test: "Skylike notifications are on" },
  sterling: { soon: t => `Departure advised at ${t}`, now: n => n > 1 ? `Departure in ${n} minutes` : "Time to depart.", evening: "Tonight's itinerary", morning: "Good morning. Your briefing is ready", assigned: f => f ? `${f} has assigned you a task` : "A new task for you", test: "Notifications online. At your service." },
  ambrose: { soon: t => `Best leave by ${t}, if you please`, now: n => n > 1 ? `Leave in ${n} minutes, if you would` : "Time to be off. Mind how you go.", evening: "A few matters for this evening", morning: "Good morning. Your day awaits 🎩", assigned: f => f ? `${f} would be grateful for your help` : "A small task for you", test: "Notifications are on. At your service. 🎩" },
  coach: { soon: t => `Leave at ${t}. Let's go! 💪`, now: n => n > 1 ? `${n} min to go time! 💪` : "Go time! Out the door 💪", evening: "Evening checklist 💪", morning: "Rise and shine, champ! Today's plan 💪", assigned: f => f ? `New mission from ${f} 💪` : "New mission for you 💪", test: "Notifications on. Let's go! 💪" },
};
const TONE_P: Record<string, string> = { bubbly: "sunny", sassy: "sass", plain: "news", calm: "willow" };
const pidFor = (st: any, memberId: string | null) => { const m = (st && st.persona) || {}; const v = m[memberId || ""] || m.family || "sunny"; return PCOPY[v] ? v : TONE_P[v] || "sunny"; };
async function sendP(subs: Sub[], st: any, make: (C: P) => { title: string; body: string; url?: string; tag?: string }) {
  const groups = new Map<string, Sub[]>();
  subs.forEach(s => { const k = pidFor(st, s.member_id); groups.set(k, [...(groups.get(k) || []), s]); });
  let n = 0; for (const [k, g] of groups) n += await send(g, make(PCOPY[k])); return n;
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
const norm = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const thaw = (n: string) => /chicken|beef|mince|pork|lamb|sausage|bacon|steak|fish|salmon|prawn|turkey|thigh|breast|fillet|stock|pastry|bread|soup|sauce|bolognese|curry|casserole|leftover/.test(norm(n));
const same = (a: string, b: string) => { const A = norm(a).split(" "), B = norm(b).split(" "); const [s, l] = A.length <= B.length ? [A, B] : [B, A]; return s.length > 0 && s.every(w => l.some(x => x === w || x.replace(/s$/, "") === w.replace(/s$/, ""))); };

// Driving time from home to an event's address. Geocode with Photon (OpenStreetMap, no key), route with OSRM.
// If routing is unavailable, estimate from distance (road factor 1.35, about 45 km/h average around town).
async function getJSON(url: string, headers: Record<string, string> = {}) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
  try { const r = await fetch(url, { headers: { "User-Agent": "Skylike family planner (joshmott89-sys.github.io/Skylike)", ...headers }, signal: ctrl.signal }); const txt = await r.text(); return JSON.parse(txt); }
  finally { clearTimeout(t); }
}
async function geocode(q: string, home: { lat: number; lon: number }) {
  try {
    const g = await getJSON(`https://photon.komoot.io/api/?limit=1&lang=en&lat=${home.lat}&lon=${home.lon}&q=${encodeURIComponent(q.slice(0, 200))}`);
    const f = g && g.features && g.features[0];
    if (f) return { lon: +f.geometry.coordinates[0], lat: +f.geometry.coordinates[1] };
  } catch (e) { console.log(JSON.stringify({ photon_error: String(e).slice(0, 100) })); }
  try {
    const box = [home.lon - 1, home.lat + 1, home.lon + 1, home.lat - 1].join(",");
    const g = await getJSON(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=au&viewbox=${box}&q=${encodeURIComponent(q.slice(0, 200))}`, { "Accept-Language": "en-AU" });
    if (Array.isArray(g) && g[0]) return { lat: +g[0].lat, lon: +g[0].lon };
  } catch (e) { console.log(JSON.stringify({ nominatim_error: String(e).slice(0, 100) })); }
  return null;
}
const haversine = (a: any, b: any) => { const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180, x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
async function travel(hid: string, e: any, home: { lat: number; lon: number }) {
  const row: any = { household_id: hid, event_id: e.event_id, location: e.location, minutes: null, km: null, status: "nogeo", computed_at: new Date().toISOString() };
  const to = await geocode(String(e.location), home);
  if (to) {
    try {
      const r = await getJSON(`https://router.project-osrm.org/route/v1/driving/${home.lon},${home.lat};${to.lon},${to.lat}?overview=false`);
      const sec = r && r.routes && r.routes[0] && r.routes[0].duration;
      if (sec != null) { row.minutes = Math.max(1, Math.ceil(sec / 60 * 1.25)); row.km = Math.round(r.routes[0].distance / 100) / 10; row.status = "ok"; }
    } catch (err) { console.log(JSON.stringify({ osrm_error: String(err).slice(0, 100) })); }
    if (row.status !== "ok") { const km = haversine(home, to) * 1.35; row.km = Math.round(km * 10) / 10; row.minutes = Math.max(3, Math.ceil(km / 45 * 60 + 3)); row.status = "ok"; }
  }
  await admin.from("event_travel").upsert(row, { onConflict: "household_id,event_id,location" });
  return row;
}

// Repeating Skylike events: same rules as the app (repeat = {freq, days, monthBy, until, count, skip}).
function occursOn(R: any, startK: string, k: string) {
  const dd = daysBetween(startK, k); if (dd < 0) return false;
  const wd0 = weekday(startK), wd = weekday(k), days = R.days && R.days.length ? R.days : [wd0];
  if (R.freq === "day") return true;
  if (R.freq === "week" || R.freq === "fortnight") return days.includes(wd) && (R.freq === "week" || Math.floor((dd + wd0) / 7) % 2 === 0);
  const d0 = +startK.slice(8, 10), m0 = +startK.slice(5, 7), d = +k.slice(8, 10), m = +k.slice(5, 7);
  if (R.freq === "month") return R.monthBy === "weekday" ? wd === wd0 && Math.ceil(d / 7) === Math.ceil(d0 / 7) : d === d0;
  if (R.freq === "year") return m === m0 && d === d0;
  return false;
}
function repeatsOn(r: any, k: string, tz: string) {
  const R = r.repeat, startK = local(tz, new Date(r.starts_at)).key;
  if (!occursOn(R, startK, k) || (R.skip || []).includes(k) || (R.until && k > R.until)) return null;
  if (R.count) { let n = 0; for (let d = startK; d <= k && n <= R.count; d = addDays(d, 1)) if (occursOn(R, startK, d)) n++; if (n > R.count) return null; }
  return new Date(new Date(r.starts_at).getTime() + daysBetween(startK, k) * 864e5).toISOString();
}
async function repeatingToday(hid: string, tz: string, keys: string[]) {
  const { data } = await admin.from("local_events").select("id,title,starts_at,location,member_id,member_ids,all_day,repeat").eq("household_id", hid).eq("all_day", false).not("repeat", "is", null);
  const out: any[] = [];
  (data || []).forEach((r: any) => keys.forEach(k => { const st = repeatsOn(r, k, tz); if (st) out.push({ event_id: "L-" + r.id + "@" + k, calendar_id: "skylike", member_id: r.member_id, member_ids: r.member_ids || [], title: r.title, starts_at: st, location: r.location, all_day: false }); }));
  return out;
}

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

    // 1) Leave reminders, using real driving time from home (OpenStreetMap), plus 5 minutes to park.
    //    A heads-up about 25 minutes before you need to leave, then "time to leave".
    const now = Date.now(), home = st.location && st.location.lat ? st.location : { lat: -31.9523, lon: 115.8613 };
    const { data: evs } = await admin.from("events_cache").select("event_id,calendar_id,title,starts_at,location,all_day").eq("household_id", hid).eq("all_day", false)
      .gte("starts_at", new Date(now).toISOString()).lte("starts_at", new Date(now + 8 * 3600e3).toISOString()).order("starts_at");
    // Skylike-only events (added on the screen, not in Google) get the same reminders.
    const { data: lev } = await admin.from("local_events").select("id,title,starts_at,location,member_id,member_ids,repeat").eq("household_id", hid).eq("all_day", false)
      .gte("starts_at", new Date(now).toISOString()).lte("starts_at", new Date(now + 8 * 3600e3).toISOString());
    const reps = (await repeatingToday(hid, tz, [L.key, addDays(L.key, 1)])).filter((e: any) => { const t = new Date(e.starts_at).getTime(); return t >= now && t <= now + 8 * 3600e3; });
    const all = (evs || []).concat(reps).concat((lev || []).filter((r: any) => !r.repeat).map((r: any) => ({ event_id: "L-" + r.id, calendar_id: "skylike", member_id: r.member_id, member_ids: r.member_ids || [], title: r.title, starts_at: r.starts_at, location: r.location, all_day: false })));
    const withPlace = all.filter((e: any) => e.location && String(e.location).trim());
    if (withPlace.length) {
      const { data: cals } = await admin.from("calendars").select("id,google_id,member_id").eq("household_id", hid);
      const { data: known } = await admin.from("event_travel").select("event_id,location,minutes,status,computed_at").eq("household_id", hid).in("event_id", withPlace.map((e: any) => e.event_id));
      let lookups = 0;
      for (const e of withPlace) {
        let t: any = (known || []).find((k: any) => k.event_id === e.event_id && k.location === e.location);
        if ((t && t.status === "home") || /^home$/i.test(String(e.location).trim())) continue; // it's at home: nothing to leave for
        if (t && t.status !== "ok" && Date.now() - new Date(t.computed_at).getTime() > 30 * 60e3) t = null; // try again later
        if (!t && lookups < 3) { lookups++; t = await travel(hid, e, home); }
        const drive = t && t.status === "ok" && t.minutes != null ? t.minutes : null;
        const leaveAt = new Date(e.starts_at).getTime() - ((drive != null ? drive + 5 : buffer) * 60e3);
        const toLeave = Math.round((leaveAt - now) / 60e3);
        const cal = (cals || []).find((c: any) => c.google_id === e.calendar_id || c.id === e.calendar_id);
        // Kids don't have phones: their events go to the grown-ups.
        // Whoever is taking them gets it; otherwise the grown-ups it's for; otherwise all grown-ups.
        const ov = (st.people || {})[e.event_id] || {};
        const ids: string[] = (ov.for !== undefined ? [].concat(ov.for || []) : e.member_ids && e.member_ids.length ? e.member_ids : [e.member_id || (cal && cal.member_id)]).filter(Boolean);
        const grown = ids.filter(id => (members || []).some((m: any) => m.id === id && m.kind !== "kid"));
        const who = ov.taker ? [ov.taker] : grown.length ? grown : adults;
        const how = drive != null ? ` · ${drive} min drive` : "";
        if (toLeave <= 32 && toLeave >= 18 && await once(`soon:${hid}:${e.event_id}:${e.starts_at}`, hid))
          sent += await sendP(await subsFor(hid, "leave", who), st, C => ({ title: C.soon(fmtTime(new Date(leaveAt).toISOString(), tz)), body: `${e.title} at ${fmtTime(e.starts_at, tz)}${how}\n${e.location}`, tag: "leave-" + e.event_id, url: "./" }));
        else if (toLeave <= 6 && toLeave >= -4 && await once(`leave:${hid}:${e.event_id}:${e.starts_at}`, hid))
          sent += await sendP(await subsFor(hid, "leave", who), st, C => ({ title: C.now(toLeave), body: `${e.title} at ${fmtTime(e.starts_at, tz)}${how}\n${e.location}`, tag: "leave-" + e.event_id, url: "./" }));
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
      if (lines.length && await once(`evening:${hid}:${L.key}`, hid)) sent += await sendP(await subsFor(hid, "evening", adults), st, C => ({ title: C.evening, body: lines.join("\n"), tag: "evening", url: "./" }));
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
      const { data: firstL } = await admin.from("local_events").select("title,starts_at").eq("household_id", hid).eq("all_day", false).gte("starts_at", new Date(now).toISOString()).lte("starts_at", dayEnd).order("starts_at").limit(1);
      const repsToday = (await repeatingToday(hid, tz, [L.key])).filter((e: any) => new Date(e.starts_at).getTime() >= now);
      const f0 = [...(first || []), ...(firstL || []), ...repsToday].sort((a: any, b: any) => String(a.starts_at).localeCompare(String(b.starts_at)))[0];
      if (f0) lines.push(`📅 First up: ${f0.title} at ${fmtTime(f0.starts_at, tz)}`);
      if (lines.length && await once(`morning:${hid}:${L.key}`, hid)) sent += await sendP(await subsFor(hid, "morning", adults), st, C => ({ title: C.morning, body: lines.join("\n"), tag: "morning", url: "./?brief=1" }));
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
  const { data: hh } = await admin.from("households").select("settings").eq("id", it.household_id).single();
  return await sendP(await subsFor(it.household_id, "assigned", [it.assignee]), hh?.settings || {}, C => ({ title: C.assigned(from), body: it.text, tag: "todo-" + it.id, url: "./?view=lists" }));
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
      const { data: hh } = await admin.from("households").select("settings").eq("id", hid).single();
      const n = await sendP((subs || []) as Sub[], hh?.settings || {}, C => ({ title: C.test, body: "You'll get to-dos given to you, leave reminders and a heads-up at 7pm.", tag: "test", url: "./" }));
      return json({ sent: n });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
