// Skylike: core. Part 1 of 11; all parts share one global scope and load in order (index.html).
"use strict";
/* ============ config ============ */
const SUPABASE_URL = 'https://sroxxxuurhdugvfmwwyw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_u9_0WMubobaQmBt3pe5ovA_o2lbOre5';
const FN_URL = SUPABASE_URL + '/functions/v1/calendar';
const AI_URL = SUPABASE_URL + '/functions/v1/ai';
const PUSH_URL = SUPABASE_URL + '/functions/v1/push';
const VAPID_PUBLIC = 'BLgnmLl9I4O7NzxZ5yeH8kvQWESyVV656Ob7mF_R50ra5-WeTLyfwFwXJ4PdEj0FGqTFhZwL9qrX7dQHuBw5m5U';
/* ---- phone notifications ---- */
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const b64ToBytes = b => { const p = '='.repeat((4 - b.length % 4) % 4), raw = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
async function swReg() { if (!('serviceWorker' in navigator)) return null; try { return await navigator.serviceWorker.register('sw.js'); } catch { return null; } }
async function pushState() {
  if (DEMO) return {state: 'demo'};
  if (!pushSupported()) return {state: isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'};
  if (isIOS() && !isStandalone()) return {state: 'ios-install'};
  if (Notification.permission === 'denied') return {state: 'denied'};
  const reg = await swReg(), sub = reg && await reg.pushManager.getSubscription();
  if (!sub) return {state: 'off'};
  const {data} = await sb.from('push_subscriptions').select('id,prefs,member_id').eq('endpoint', sub.endpoint).maybeSingle();
  return data ? {state: 'on', row: data} : {state: 'off'};
}
async function pushEnable() {
  const me = meMember(); if (!me) return toast('Pick who this phone belongs to first (Settings → Family).', 4500);
  const perm = await Notification.requestPermission(); if (perm !== 'granted') { toast('Notifications were not allowed. You can turn them on in the phone settings.', 5000); return S._push = null, render(); }
  const reg = await swReg(); if (!reg) return toast("Couldn't set up notifications on this browser.");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC)});
  const j = sub.toJSON();
  const {error} = await sb.from('push_subscriptions').upsert({household_id: S.hid, member_id: me.id, device_id: S.deviceId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth}, {onConflict: 'endpoint'});
  if (error) return toast("Couldn't save that. Try again.");
  LS.set('pushOn', true); S._push = null; render(); pushTest();
}
// Step-by-step help for allowing notifications (a web app can't open the phone's settings itself).
function allowStepsHTML(open) {
  const ua = navigator.userAgent, android = /Android/i.test(ua), samsung = /SamsungBrowser/i.test(ua), ios = isIOS(), inst = isStandalone();
  const steps = ios ? ['Open the iPhone <b>Settings</b> app.', 'Tap <b>Notifications</b>, then <b>Skylike</b> (it shows once Skylike is on your Home Screen).', 'Turn on <b>Allow Notifications</b>. Banners and Sounds on is best.', 'Come back to Skylike and tap <b>check again</b>.']
    : android && inst ? ['Press and hold the <b>Skylike</b> icon on your home screen.', 'Tap <b>App info</b> (or the ⓘ).', 'Tap <b>Notifications</b> and turn them on.', 'Come back to Skylike and tap <b>check again</b>.']
    : android && samsung ? ['Tap the <b>☰ menu</b> → <b>Settings</b> → <b>Sites and downloads</b> → <b>Notifications</b>.', 'Find Skylike (joshmott89-sys.github.io) and set it to <b>Allow</b>.', 'Come back and tap <b>check again</b>.']
    : android ? ['In Chrome, tap the <b>settings icon</b> to the left of the web address (it looks like two sliders or a lock).', 'Tap <b>Permissions</b> (or Site settings), then <b>Notifications</b>, and choose <b>Allow</b>.', 'Still nothing? Open the phone’s <b>Settings</b> → <b>Apps</b> → <b>Chrome</b> → <b>Notifications</b> and turn them on.', 'Come back to Skylike and tap <b>check again</b>.']
    : ['Click the icon to the left of the web address.', 'Set <b>Notifications</b> to <b>Allow</b>.', 'Reload Skylike.'];
  return `<details class="allow" ${open ? 'open' : ''}><summary>${icon('right')}How to allow notifications on ${ios ? 'iPhone' : android ? 'Android' : 'this device'}</summary><ol class="help steps">${steps.map(t => `<li>${t}</li>`).join('')}</ol></details>`;
}
async function pushTest() {
  const {data: {session}} = await sb.auth.getSession();
  try { const r = await (await fetch(PUSH_URL, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, apikey: SUPABASE_KEY}, body: JSON.stringify({action: 'test', household_id: S.hid, device_id: S.deviceId})})).json();
    toast(r.sent ? 'Test sent. It should pop up in a moment.' : (r.error || "The test didn't arrive. Try turning notifications off and on again."), 4500); } catch { toast("Couldn't reach Skylike. Check your signal."); }
}
async function callAI(body) {
  if (DEMO) return {error: 'AI is off in the sample. Sign in to use it.'};
  const {data: {session}} = await sb.auth.getSession();
  S.busy = (S.busy || 0) + 1;
  try {
    const r = await fetch(AI_URL, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, apikey: SUPABASE_KEY}, body: JSON.stringify(Object.assign({household_id: S.hid}, body))});
    return await r.json();
  } catch { return {error: "Couldn't reach Skylike. Check your signal and try again."}; } finally { S.busy--; }
}

const FAMILY_COLOURS = [
  ['Ocean','#2F7BB5'],['Jacaranda','#7B5EA7'],['Wattle','#D49A12'],['Eucalypt','#3F8A68'],
  ['Banksia','#D9773B'],['Reef','#D2526D'],['Coast','#3A9AA0'],['Granite','#66727E']
];
const NOTE_COLOURS = ['sand','sea','wattle','jacaranda','coral','sky'];
const BIN_COLOURS = {red:'#C9473A',yellow:'#D9A514',green:'#4E9A3F',blue:'#2F7BB5',purple:'#7B5EA7',grey:'#6B7680'};

/* WA public schools (education.wa.edu.au) and WA public holidays (wa.gov.au), checked Nov 2026 */
const WA_TERMS = [
  ['2026-02-02','2026-04-02'],['2026-04-20','2026-07-03'],['2026-07-20','2026-09-25'],['2026-10-12','2026-12-17'],
  ['2027-02-01','2027-04-09'],['2027-04-27','2027-07-02'],['2027-07-19','2027-09-24'],['2027-10-11','2027-12-16']
];
const WA_HOLIDAYS = {
  '2026-01-01':"New Year's Day",'2026-01-26':'Australia Day','2026-03-02':'Labour Day','2026-04-03':'Good Friday',
  '2026-04-05':'Easter Sunday','2026-04-06':'Easter Monday','2026-04-25':'Anzac Day','2026-04-27':'Anzac Day holiday',
  '2026-06-01':'WA Day','2026-09-28':"King's Birthday",'2026-12-25':'Christmas Day','2026-12-26':'Boxing Day','2026-12-28':'Boxing Day holiday',
  '2027-01-01':"New Year's Day",'2027-01-26':'Australia Day','2027-03-01':'Labour Day','2027-03-26':'Good Friday',
  '2027-03-28':'Easter Sunday','2027-03-29':'Easter Monday','2027-04-25':'Anzac Day','2027-04-26':'Anzac Day holiday',
  '2027-06-07':'WA Day','2027-09-27':"King's Birthday",'2027-12-25':'Christmas Day','2027-12-26':'Boxing Day',
  '2027-12-27':'Christmas Day holiday','2027-12-28':'Boxing Day holiday'
};

/* ============ helpers ============ */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const uid = () => crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('skylike:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('skylike:' + k, JSON.stringify(v)); } catch {} }
};
function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
const isPhone = () => matchMedia('(max-width:760px)').matches;

/* time in the household's zone */
let TZ = 'Australia/Perth';
const partsFmt = {};
function tzParts(d) {
  const f = partsFmt[TZ] || (partsFmt[TZ] = new Intl.DateTimeFormat('en-AU', {timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', weekday:'short', hourCycle:'h23'}));
  const o = {}; for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return {y:+o.year, m:+o.month, d:+o.day, h:+o.hour % 24, min:+o.minute, wd:o.weekday, key:`${o.year}-${o.month}-${o.day}`};
}
const dayKey = d => tzParts(d).key;
const keyToDate = k => { const [y,m,d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const addDaysKey = (k, n) => { const d = keyToDate(k); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekdayOfKey = k => keyToDate(k).getUTCDay();
// "💊Take meds", "💊 Take meds", "👩‍👧 Pick up" → [emoji, words]; no leading emoji → ['', line]
const EMOJI_HEAD = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:\uFE0F|\u20E3|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*)\s*(.*)$/u;
const splitEmoji = line => { const s = String(line || '').trim(), m = s.match(EMOJI_HEAD); return m && m[2] ? [m[1], m[2]] : ['', s]; };
const daysBetween = (a, b) => Math.round((keyToDate(b) - keyToDate(a)) / 864e5);
const untilHTML = e => `<span class="til">to ${esc(fmtTime(new Date(e.ends_at)))}</span>`;
// One event row for every "what's on" list (family screen, Focus, Planner). size: '' = roomy (wall), 'md' (Focus), 'sm' (Planner week).
// Always a button: tapping any row opens that event.
function agendaRow(e, opt = {}) {
  const st = new Date(e.starts_at), now = new Date(), live = !e.all_day && st <= now && new Date(e.ends_at) > now;
  const when = e.all_day ? 'All day' : live ? 'Now' : esc(fmtTime(st));
  const meta = opt.meta ? `<div class="who">${whoMeta(e, (S.calendars.find(c => c.google_id === e.calendar_id) || {}).name || 'Family')}${e.location ? ' · ' + esc(e.location) : ''}</div>` : '';
  return `<button class="ev evbtn ${opt.size ? 'ev-' + opt.size : ''} ${opt.first ? 'next' : ''}" style="--c:${eventColour(e)}" data-act="open-event" data-id="${e.id}"><div class="when num">${when}${opt.until && !e.all_day ? untilHTML(e) : ''}</div><div><div class="what">${opt.size ? '<i class="evdot"></i>' : ''}${esc(e.title || 'Busy')}</div>${meta}</div></button>`;
}
const fmtTime = d => new Intl.DateTimeFormat('en-AU', {timeZone: TZ, hour:'numeric', minute:'2-digit', hour12:true}).format(d).replace(/\s?([ap])\.?m\.?/i, (m, a) => a.toLowerCase() + 'm');
const fmtDay = (k, opts) => new Intl.DateTimeFormat('en-AU', Object.assign({timeZone:'UTC'}, opts)).format(keyToDate(k));
const hoursFloat = d => { const p = tzParts(d); return p.h + p.min / 60; };
const ago = mins => mins < 1 ? 'just now' : relMins(mins) + ' ago';
function relMins(mins) {
  if (mins < 1) return 'now';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ============ supabase ============ */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {auth: {persistSession: true, storageKey: 'skylike-auth', autoRefreshToken: true}});

/* ============ state ============ */
const S = {
  session: null, hid: LS.get('hid', null), household: null, members: [], lists: [], items: [], notes: [], events: [],
  calendars: [], countdowns: [], reminders: [], photos: [], devices: [],
  routines: [], chores: [], ticks: [], ledger: [], rewards: [], bringRules: [], balances: {}, meals: [], pantry: [], localEvents: [], aiOn: false,
  view: 'family', activeMember: null, listId: null, calMode: LS.get('calMode', 'week'), calOffset: 0,
  weather: null, realtime: 'connecting', lastData: null, calStatus: null, online: navigator.onLine,
  deviceId: LS.get('device', null), lastTouch: Date.now(), nightWake: 0, settingsTab: 'household'
};
if (!S.deviceId) { S.deviceId = uid(); LS.set('device', S.deviceId); }
const deviceKind = () => LS.get('deviceKind', isPhone() ? 'phone' : 'tablet');
const settings = () => Object.assign({
  location: {lat: -31.9523, lon: 115.8613, name: 'Perth'}, night: {start: '20:30', end: '06:00'},
  saver: {on: true, after: 5, clockMins: 10, photoMins: 5}, idleReturn: 3, leaveBuffer: 15, school: true, holidays: true,
  dayStart: 6, dayEnd: 21, sitter: {contacts: [], wifi: {name: '', password: ''}, bedtimes: [], notes: ''}
}, (S.household && S.household.settings) || {});

/* offline snapshot so the screen paints instantly */
function snapshot() {
  if (!S.hid) return;
  const snap = {household: S.household, members: S.members, lists: S.lists, items: S.items, notes: S.notes, events: S.events, calendars: S.calendars, countdowns: S.countdowns, reminders: S.reminders, at: Date.now()};
  // browsers allow about 5 MB here; if face photos push the copy past ~1.5 MB, keep it without them (they load from the server)
  if (JSON.stringify(snap).length > 1.5e6) snap.members = S.members.map(m => Object.assign({}, m, {photo: null}));
  LS.set('snap:' + S.hid, snap);
}
let snapT; const saveSnap = () => { clearTimeout(snapT); snapT = setTimeout(snapshot, 800); };
function restoreSnap() {
  const s = S.hid && LS.get('snap:' + S.hid, null); if (!s) return false;
  Object.assign(S, {household: s.household, members: s.members || [], lists: s.lists || [], items: s.items || [], notes: s.notes || [], events: s.events || [], calendars: s.calendars || [], countdowns: s.countdowns || [], reminders: s.reminders || [], lastData: s.at});
  if (S.household) TZ = S.household.timezone || TZ;
  return true;
}

/* ============ crash recovery ============ */
let errTimes = [];
function onAppError(e) {
  console.error(e); try { S._lastErr = String((e && (e.message || e)) || '').slice(0, 300); } catch {}
  const now = Date.now(); errTimes = errTimes.filter(t => now - t < 120000); errTimes.push(now);
  if (errTimes.length >= 5) {
    const r = LS.get('reloads', []).filter(t => now - t < 600000);
    if (r.length < 3) { r.push(now); LS.set('reloads', r); setTimeout(() => location.reload(), 3000); }
  }
}
window.addEventListener('error', e => onAppError(e.error || e.message));
window.addEventListener('unhandledrejection', e => onAppError(e.reason));
const DEMO_PAGE = new URLSearchParams(location.search).has('demo');
// Android Chrome can keep a stale 100dvh after switching apps, pushing the bottom bar off screen: size to the real window instead.
// iPad: while the keyboard is up the window reports half its height; don't shrink the app to that, and re-measure once typing ends.
const typingNow = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && matchMedia('(pointer:coarse)').matches; };
function fitHeight() { if (typingNow() && window.innerHeight < (S && S._fullH || 0) * .8) return; document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px'); if (!typingNow()) S._fullH = window.innerHeight; }
document.addEventListener('focusout', () => [60, 300, 700, 1200].forEach(t => setTimeout(() => { if (typingNow()) return; fitHeight(); if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0); }, t)));
fitHeight();
['resize', 'orientationchange', 'pageshow', 'focus'].forEach(e => addEventListener(e, () => { fitHeight(); setTimeout(fitHeight, 300); }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { fitHeight(); setTimeout(fitHeight, 300); setTimeout(fitHeight, 1000); } });
if (window.visualViewport) visualViewport.addEventListener('resize', fitHeight);
const bootAt = Date.now();
// Load the newest build, skipping the browser's cached copy (GitHub Pages lets phones keep one for ~10 min).
function freshReload() {
  const q = new URLSearchParams(location.search); q.set('r', Date.now().toString(36));
  location.replace(location.pathname + '?' + q.toString() + location.hash);
}
if (new URLSearchParams(location.search).has('r')) { const q = new URLSearchParams(location.search); q.delete('r'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
// New build available: the family screen updates itself quietly; phones get a tap-to-update banner
// (or update straight away when the app is reopened), so nobody loses what they're typing.
function showUpdateBanner() {
  if (document.querySelector('.update-bar')) return;
  const b = document.createElement('button'); b.className = 'update-bar'; b.type = 'button';
  b.innerHTML = `${icon('refresh')}<span><b>Update ready</b>Tap to refresh</span>`;
  b.onclick = freshReload; document.body.appendChild(b);
}
async function checkForUpdate(reopened) {
  if (DEMO_PAGE) return;
  try {
    const t = await (await fetch(location.pathname + '?check=' + Date.now(), {cache: 'no-store'})).text();
    const m = t.match(/const APP_VERSION = '([^']+)'/);
    if (!m || m[1] === APP_VERSION) return;
    const busy = S.busy > 0 || S.scanning || document.querySelector('.sheet-bg') || (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName));
    if (!busy && (deviceKind() === 'tablet' || reopened)) freshReload(); else showUpdateBanner();
  } catch {}
}
setTimeout(() => checkForUpdate(true), 8000); setInterval(() => checkForUpdate(false), 10 * 60e3);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(true); });
// keep the notification worker current (picks up new icons and fixes)
if (!DEMO_PAGE && LS.get('pushOn', false)) setTimeout(() => swReg().then(r => r && r.update && r.update()), 4000);
// coming back from the phone's settings: re-check notification permission if that screen is open
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.view === 'settings' && S.settingsTab === 'notify') { S._push = null; render(); } });
setInterval(() => { // quiet nightly refresh on the family screen
  const p = tzParts(new Date());
  if (deviceKind() === 'tablet' && p.h === 3 && p.min < 6 && Date.now() - bootAt > 3600e3) freshReload();
}, 60e3);

/* ============ data ============ */
const TABLES = ['members','lists','list_items','notes','events_cache','calendars','countdowns','reminders','photos','devices','routines','chores','ticks','star_ledger','rewards','bring_rules','meals','pantry','local_events','recipes','email_suggestions','grocery_spend'];
const KEY_OF = {members:'members', lists:'lists', list_items:'items', notes:'notes', events_cache:'events', calendars:'calendars', countdowns:'countdowns', reminders:'reminders', photos:'photos', devices:'devices', routines:'routines', chores:'chores', ticks:'ticks', star_ledger:'ledger', rewards:'rewards', bring_rules:'bringRules', meals:'meals', pantry:'pantry', recipes:'recipes', email_suggestions:'mail', grocery_spend:'spend', local_events:'localEvents'};

async function loadAll() {
  const hid = S.hid;
  const q = t => sb.from(t).select('*').eq('household_id', hid);
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const [hh, ...rest] = await Promise.all([
    sb.from('households').select('*').eq('id', hid).maybeSingle(),
    q('members').order('sort'), q('lists').order('sort'), q('list_items').order('sort'), q('notes').order('created_at', {ascending: false}).limit(200),
    q('events_cache').gte('ends_at', since).order('starts_at'), q('calendars'), q('countdowns').order('date'), q('reminders'), q('photos').order('created_at', {ascending: false}).limit(300), q('devices'),
    q('routines').order('sort'), q('chores').order('sort'), q('ticks').gte('day', addDaysKey(dayKey(new Date()), -1)), q('star_ledger').order('created_at', {ascending: false}).limit(200), q('rewards').order('cost'), q('bring_rules'),
    q('meals').gte('day', addDaysKey(dayKey(new Date()), -14)).order('day'), q('pantry').order('name'), q('local_events').or(`starts_at.gte.${since},repeat.not.is.null`).order('starts_at'), q('recipes').order('title'), q('email_suggestions').eq('status', 'new').order('received_at', {ascending: false}).limit(30), q('grocery_spend').gte('day', addDaysKey(dayKey(new Date()), -120)).order('day', {ascending: false})
  ]);
  if (hh.error) throw hh.error;
  if (!hh.data) { S.hid = null; LS.set('hid', null); return false; }
  S.household = hh.data; TZ = hh.data.timezone || TZ;
  TABLES.forEach((t, i) => { if (!rest[i].error) S[KEY_OF[t]] = rest[i].data || []; });
  S.lastData = Date.now(); saveSnap();
  refreshCalStatus(); loadHistory(); loadBalances(); loadTravel().then(() => setTimeout(computeTravel, 3000));
  if (!S._deep) { S._deep = 1; const q = new URLSearchParams(location.search), v = q.get('view'); if (v && V[v]) S.view = v; if (q.has('brief')) setTimeout(() => A['brief-open'](), 800);
    if (v || q.has('brief')) { q.delete('view'); q.delete('brief'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '')); } }
  sb.from('memberships').select('user_id,created_at,role').eq('household_id', hid).then(({data}) => { if (data) { S.joins = data; render(); } });
  sb.rpc('ai_keys', {p_household: S.hid}).then(({data, error}) => { if (error) return sb.rpc('ai_status', {p_household: S.hid}).then(({data}) => { S.aiOn = !!data; }); S.aiGemini = !!data?.gemini; S.aiBackup = !!data?.openrouter; S.aiOn = S.aiGemini || S.aiBackup; });
  return true;
}
// Driving times worked out on the server (home → event address), used for "leave in" countdowns.
async function loadTravel() { const {data} = await sb.from('event_travel').select('event_id,location,minutes,km,status,computed_at').eq('household_id', S.hid); if (data) S.travel = data; }
/* Saved places: Home (settings.location) plus the family's own (school, kindy, swimming…), one tap in any event. */
// a second tap within 4 seconds confirms something that can't be undone
const confirmTap = (k, msg) => { const now = Date.now(); if (S._confirm && S._confirm.k === k && now - S._confirm.at < 4000) { S._confirm = null; return true; } S._confirm = {k, at: now}; toast(msg, 4000); return false; };
const fmtCode = c => { c = String(c || ''); return c.length === 10 ? c.slice(0, 5) + '-' + c.slice(5) : c; };
// drawn icons for the preset places; anything a family picks themselves stays as their emoji
const PLACE_ICON = {'🏫': 'school', '🧸': 'kindy', '🍼': 'bottle', '💼': 'work', '🏊': 'swim', '🏋': 'gym', '👵': 'family-home', '🛒': 'cart', '🩺': 'doctor', '🌳': 'park', '🏠': 'home', '📍': 'pin'};
const placeIcon = e => { const k = PLACE_ICON[String(e || '📍').replace(/\ufe0f/g, '')]; return k ? icon(k, 'xs') : esc(e); };
const PLACE_PRESETS = [['School', '🏫'], ['Kindy', '🧸'], ['Daycare', '🍼'], ['Work', '💼'], ['Swimming', '🏊'], ['Gym', '🏋️'], ['Grandma & Grandpa', '👵'], ['Shops', '🛒'], ['Doctor', '🩺'], ['Park', '🌳']];
function places() {
  const st = settings(), out = [];
  if (st.location && st.location.lat) out.push({id: 'home', name: 'Home', emoji: '🏠', address: st.location.address || '', lat: st.location.lat, lon: st.location.lon, home: true});
  return out.concat((st.places || []).filter(p => p && p.name));
}
const normLoc = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const placeFor = loc => { const n = normLoc(loc); if (!n) return null; return places().find(p => normLoc(p.name) === n || (p.address && normLoc(p.address) === n)) || null; };
const isHomeLoc = loc => { const p = placeFor(loc); return !!(p && p.home); };
const geoCache = () => LS.get('geo', {});
function rememberGeo(label, lat, lon) { if (!label || lat == null) return; const g = geoCache(); g[label] = {lat: +lat, lon: +lon}; const keys = Object.keys(g); if (keys.length > 150) delete g[keys[0]]; LS.set('geo', g); }
const driveFor = e => { if (isHomeLoc(e.location)) return null; const t = (S.travel || []).find(x => x.event_id === e.event_id && x.location === e.location && x.status === 'ok'); return t ? t.minutes : null; };
const leaveBufferFor = e => { if (!e.location || isHomeLoc(e.location)) return 0; const d = driveFor(e); return d != null ? d + 5 : settings().leaveBuffer; };
// Work out drives here on the device (the free map services block cloud servers), then share them via the database.
let travelBusy = false; const travelTried = new Set();
async function computeTravel() {
  if (DEMO || travelBusy || !S.hid || !navigator.onLine) return; travelBusy = true;
  try {
    const st = settings(), home = st.location && st.location.lat ? st.location : {lat: -31.9523, lon: 115.8613}, now = Date.now();
    const todo = S.events.concat(localEvs()).filter(e => !e.all_day && e.location && String(e.location).trim() && new Date(e.starts_at) > now && new Date(e.starts_at) - now < 2 * 864e5)
      .filter(e => !(S.travel || []).some(t => t.event_id === e.event_id && t.location === e.location && (t.status === 'ok' || t.status === 'home') && (!home.at || new Date(t.computed_at) >= new Date(home.at))) && !travelTried.has(e.event_id + '|' + e.location + '|' + (home.at || '')))
      .slice(0, 4);
    for (const e of todo) {
      travelTried.add(e.event_id + '|' + e.location + '|' + (home.at || ''));
      const row = {household_id: S.hid, event_id: e.event_id, location: e.location, minutes: null, km: null, status: 'nogeo', computed_at: new Date().toISOString()};
      const pl = placeFor(e.location), cached = geoCache()[e.location];
      let to = pl && pl.lat != null ? {lat: +pl.lat, lon: +pl.lon} : cached || null;
      if (pl && pl.home) { row.minutes = 0; row.km = 0; row.status = 'home'; to = null; }
      else if (!to) {
      try { const box = [home.lon - 1, home.lat + 1, home.lon + 1, home.lat - 1].join(','); const g = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=au&viewbox=${box}&q=${encodeURIComponent(String(e.location).slice(0, 200))}`)).json(); if (g && g[0]) to = {lat: +g[0].lat, lon: +g[0].lon}; } catch {}
      if (!to) { try { const g = await (await fetch(`https://photon.komoot.io/api/?limit=1&lang=en&lat=${home.lat}&lon=${home.lon}&q=${encodeURIComponent(String(e.location).slice(0, 200))}`)).json(); const f = g && g.features && g.features[0]; if (f) to = {lon: +f.geometry.coordinates[0], lat: +f.geometry.coordinates[1]}; } catch {} }
      }
      if (to) {
        try { const r = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${home.lon},${home.lat};${to.lon},${to.lat}?overview=false`)).json(); const rt = r && r.routes && r.routes[0]; if (rt) { row.minutes = Math.max(1, Math.ceil(rt.duration / 60 * 1.25)); row.km = Math.round(rt.distance / 100) / 10; row.status = 'ok'; } } catch {}
        if (row.status !== 'ok') { const R = 6371, dLat = (to.lat - home.lat) * Math.PI / 180, dLon = (to.lon - home.lon) * Math.PI / 180, x = Math.sin(dLat / 2) ** 2 + Math.cos(home.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2, km = 2 * R * Math.asin(Math.sqrt(x)) * 1.35; row.km = Math.round(km * 10) / 10; row.minutes = Math.max(3, Math.ceil(km / 45 * 60 + 3)); row.status = 'ok'; }
      }
      S.travel = (S.travel || []).filter(t => !(t.event_id === row.event_id && t.location === row.location)).concat(row);
      await sb.from('event_travel').upsert(row, {onConflict: 'household_id,event_id,location'});
      await new Promise(r => setTimeout(r, 1500)); // be polite to the free map services
    }
    if (todo.length && ['family', 'focus', 'planner'].includes(S.view)) render();
  } finally { travelBusy = false; }
}
setInterval(() => { if (S.household && !DEMO) loadTravel().then(computeTravel); }, 10 * 60e3);
let balT = 0;
async function loadBalances() {
  clearTimeout(balT);
  balT = setTimeout(async () => {
    const {data} = await sb.from('star_balances').select('member_id,stars').eq('household_id', S.hid);
    if (data) { S.balances = Object.fromEntries(data.map(r => [r.member_id, r.stars])); if (['kids', 'settings'].includes(S.view)) render(); }
  }, 250);
}
async function loadHistory() {
  const {data} = await sb.from('list_history').select('list_id,text,times,last_added').eq('household_id', S.hid);
  if (data) { S.history = data; if (S.view === 'lists') render(); }
}
// Quick-add suggestions: what this family adds most (recent first on ties), topped up with starters. Always 5.
const STARTERS = {
  todo: ['Take bins out', 'Go grocery shopping', 'Take meds', 'Pay the bills', 'Water the plants', 'Change the sheets', 'Book a haircut', 'Wash the car', 'Return library books', 'Pack kindy bag'],
  grocery: ['Milk', 'Bread', 'Bananas', 'Eggs', 'Butter', 'Cheese', 'Yoghurt', 'Apples', 'Nappies', 'Chicken', 'Coffee', 'Toilet paper', 'Pasta', 'Rice', 'Weet-Bix'],
  custom: []
};
function suggestionsFor(l, n = 5) {
  const open = new Set(listItems(l.id, false).map(i => i.text.trim().toLowerCase()));
  const seen = new Set(), out = [];
  const push = t => { const k = t.trim().toLowerCase(); if (!k || open.has(k) || seen.has(k)) return; seen.add(k); out.push(t.trim()); };
  (S.history || []).filter(h => h.list_id === l.id).sort((a, b) => b.times - a.times || (b.last_added > a.last_added ? 1 : -1)).forEach(h => push(h.text));
  (STARTERS[l.kind] || []).forEach(push);
  return out.slice(0, n);
}
function bumpHistory(listId, text) {
  const k = text.trim().toLowerCase(), h = (S.history = S.history || []).find(x => x.list_id === listId && x.text.toLowerCase() === k);
  if (h) { h.times++; h.last_added = new Date().toISOString(); } else S.history.push({list_id: listId, text: text.trim(), times: 1, last_added: new Date().toISOString()});
  sb.rpc('bump_list_history', {p_list: listId, p_text: text}).then(() => {}, () => {});
}
async function refreshCalStatus() {
  const {data} = await sb.rpc('calendar_status', {p_household: S.hid});
  S.calStatus = (data && data[0]) || {connected: false}; render();
}

let channel;
function subscribe() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('hh-' + S.hid);
  TABLES.concat(['commands']).forEach(t => {
    channel.on('postgres_changes', {event: '*', schema: 'public', table: t, filter: `household_id=eq.${S.hid}`}, p => applyChange(t, p));
  });
  channel.on('postgres_changes', {event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${S.hid}`}, p => { S.household = p.new; TZ = p.new.timezone || TZ; saveSnap(); render(); });
  channel.subscribe(status => {
    S.realtime = status === 'SUBSCRIBED' ? 'live' : (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') ? 'lost' : 'connecting';
    if (status === 'SUBSCRIBED' && S._wasLost) { S._wasLost = false; loadAll().then(render); }
    if (S.realtime === 'lost') S._wasLost = true;
    renderRail();
  });
}
function applyChange(table, p) {
  if (table === 'commands') { if (p.eventType === 'INSERT') runCommand(p.new); return; }
  const key = KEY_OF[table]; const arr = S[key];
  if (p.eventType === 'DELETE') S[key] = arr.filter(r => r.id !== p.old.id);
  else { const i = arr.findIndex(r => r.id === p.new.id); if (i >= 0) arr[i] = p.new; else arr.push(p.new); }
  if (key === 'events') S.events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (key === 'ticks' || key === 'ledger') loadBalances();
  if (key === 'items') S.items.sort((a, b) => a.sort - b.sort);
  if (key === 'notes') S.notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
  S.lastData = Date.now(); saveSnap(); render();
}

/* remote commands from Josh (or anyone in Settings) */
async function runCommand(c) {
  if (c.done_at || (c.device_id && c.device_id !== S.deviceId)) return;
  if (Date.now() - new Date(c.created_at).getTime() > 10 * 60e3) return;
  if (c.device_id) await sb.from('commands').update({done_at: new Date().toISOString()}).eq('id', c.id);
  if (c.command === 'reload') { toast('Refreshing this screen…'); setTimeout(freshReload, 1200); }
  if (c.command === 'set' && c.payload) { Object.entries(c.payload).forEach(([k, v]) => LS.set(k, v)); render(); }
  if (c.command === 'ping') heartbeat();
}
async function heartbeat() {
  if (!S.hid) return;
  await sb.from('devices').upsert({id: S.deviceId, household_id: S.hid, name: LS.get('deviceName', deviceKind() === 'tablet' ? 'Family screen' : 'Phone'), kind: deviceKind(), app_version: APP_VERSION, last_seen: new Date().toISOString()});
}

/* weather (Open-Meteo, no key) */
async function loadWeather() {
  const {lat, lon} = settings().location;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,precipitation_sum,uv_index_max&hourly=precipitation_probability,precipitation,apparent_temperature&timezone=${encodeURIComponent(TZ)}&forecast_days=10`;
    const r = await fetch(u); if (!r.ok) throw 0; S.weather = await r.json(); S.weather.at = Date.now(); LS.set('weather', S.weather); const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName); if (!typing && !document.querySelector('.sheet-bg')) render(); else renderSkyOnly();
  } catch { S.weather = S.weather || LS.get('weather', null); }
}
// Rain, said the way people read it: when it's likely to start today and roughly how much.
// (The daily "max chance" reads as 100% for a short afternoon shower, which looks wrong next to other apps.)
function rainNote(wx) {
  const h = wx && wx.hourly; if (!h || !h.time) return '';
  const p = tzParts(new Date()), today = p.key, from = `${today}T${String(p.h).padStart(2, '0')}:00`;
  let start = -1, mm = 0;
  h.time.forEach((t, i) => { if (t.slice(0, 10) !== today || t < from) return; if ((h.precipitation[i] || 0) > 0) mm += h.precipitation[i]; if (start < 0 && h.precipitation_probability[i] >= 60 && h.precipitation[i] >= .2) start = i; });
  if (start < 0) return '';
  const hr = +h.time[start].slice(11, 13), when = hr <= p.h ? 'now' : 'from ' + ((hr + 11) % 12 + 1) + (hr < 12 ? 'am' : 'pm');
  return `${mm < 2 ? 'Showers' : 'Rain'} ${when}${mm >= 1 && !isPhone() ? ` · ${Math.round(mm)}mm` : ''}`;
}
// What to wear / pack, from rain, feels-like temperature and UV over the waking day (7am to 6pm).
function wearTips(k, fromHour = 7) {
  const w = S.weather, h = w && w.hourly, d = w && w.daily; if (!h || !h.time || !h.apparent_temperature) return [];
  const idx = h.time.map((t, i) => [t, i]).filter(([t]) => t.slice(0, 10) === k && +t.slice(11, 13) >= Math.max(7, fromHour) && +t.slice(11, 13) <= 18).map(([, i]) => i);
  if (!idx.length) return [];
  const out = [], hr = i => +h.time[i].slice(11, 13), at = x => ((x + 11) % 12 + 1) + (x < 12 ? 'am' : 'pm');
  const wet = idx.filter(i => h.precipitation_probability[i] >= 60 && h.precipitation[i] >= .2), mm = wet.reduce((a, i) => a + h.precipitation[i], 0);
  if (wet.length) out.push(mm >= 5 ? {icon: 'umbrella', c: '#2F7BB5', text: 'Raincoat + umbrella', sub: 'rain from ' + at(hr(wet[0]))} : {icon: 'umbrella', c: '#2F7BB5', text: 'Pack a jacket', sub: 'showers from ' + at(hr(wet[0]))});
  const feel = idx.map(i => h.apparent_temperature[i]).filter(x => x != null), morning = idx.filter(i => hr(i) <= 9).map(i => h.apparent_temperature[i]);
  const coldAm = morning.length ? Math.round(Math.min(...morning)) : null, top = Math.round(Math.max(...feel));
  if (coldAm != null && coldAm <= 8) out.push({icon: 'jumper', c: '#5B6B8C', text: 'Warm coat', sub: `feels ${coldAm}° this morning`});
  else if (coldAm != null && coldAm <= 14) out.push({icon: 'jumper', c: '#5B6B8C', text: 'Jumper on', sub: `chilly, feels ${coldAm}°`});
  else if (top <= 18) out.push({icon: 'jumper', c: '#5B6B8C', text: 'Jumper', sub: `cool day, ${top}° at best`});
  if (top >= 35) out.push({icon: 'sun', c: '#C9473A', text: 'Hot one: water bottles', sub: `feels ${top}°`});
  const di = d && d.time ? d.time.indexOf(k) : -1, uv = di >= 0 && d.uv_index_max ? d.uv_index_max[di] : null;
  if (uv != null && uv >= 6 && fromHour < 16) out.push({icon: 'sun', c: '#E0A21B', text: uv >= 8 ? 'Sunscreen + hat' : 'Sunscreen on', sub: `UV ${Math.round(uv)} ${uv >= 11 ? 'extreme' : uv >= 8 ? 'very high' : 'high'}`});
  return out;
}
function dayWx(k) {
  const d = S.weather && S.weather.daily; if (!d || !d.time) return null;
  const i = d.time.indexOf(k); if (i < 0 || d.temperature_2m_max[i] == null) return null;
  return {hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]), code: d.weather_code[i], mm: d.precipitation_sum ? d.precipitation_sum[i] : 0};
}
function wxIcon(code, day = 1) {
  if (code == null) return 'cloud';
  if (code === 0) return day ? 'sun' : 'moon';
  if (code <= 2) return 'cloudsun';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95) return 'storm';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  return 'cloud';
}
function wxWords(code) {
  if (code === 0) return 'Clear'; if (code <= 2) return 'Partly cloudy'; if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy'; if (code >= 95) return 'Storms';
  if (code >= 51 && code <= 57) return 'Drizzle'; if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Showers';
  return 'Cloudy';
}

/* ============ derived data ============ */
const memberById = id => S.members.find(m => m.id === id);
/* Skylike-only events (no Google needed): stored in local_events, shown alongside calendar events. */
function localToEv(r) {
  const ad = !!r.all_day, s0 = ad ? String(r.starts_at).slice(0, 10) + 'T00:00:00Z' : r.starts_at;
  const e0 = r.ends_at ? (ad ? String(r.ends_at).slice(0, 10) + 'T00:00:00Z' : r.ends_at) : (ad ? addDaysKey(s0.slice(0, 10), 1) + 'T00:00:00Z' : new Date(new Date(s0).getTime() + 3600e3).toISOString());
  return {id: 'L-' + r.id, local: true, row: r, household_id: r.household_id, calendar_id: 'skylike', event_id: 'L-' + r.id, title: r.title, starts_at: s0, ends_at: e0, all_day: ad, location: r.location, member_id: r.member_id, member_ids: r.member_ids || (r.member_id ? [r.member_id] : []), notes: r.notes};
}
/* Repeating Skylike events: repeat = {freq: day|week|fortnight|month|year, days: [0-6], monthBy: date|weekday, until, count, skip: [dates]} */
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const startKeyOf = r => r.all_day ? String(r.starts_at).slice(0, 10) : dayKey(new Date(r.starts_at));
function occursOn(R, startK, k) {
  const wd0 = weekdayOfKey(startK), dd = daysBetween(startK, k), wd = weekdayOfKey(k), days = R.days && R.days.length ? R.days : [wd0];
  if (dd < 0) return false;
  if (R.freq === 'day') return true;
  if (R.freq === 'week' || R.freq === 'fortnight') { if (!days.includes(wd)) return false; return R.freq === 'week' || Math.floor((dd + wd0) / 7) % 2 === 0; }
  const [y0, m0, d0] = startK.split('-').map(Number), [, m, d] = k.split('-').map(Number);
  if (R.freq === 'month') return R.monthBy === 'weekday' ? wd === wd0 && Math.ceil(d / 7) === Math.ceil(d0 / 7) : d === d0;
  if (R.freq === 'year') return m === m0 && d === d0;
  return false;
}
function occurrences(r, fromK, toK) {
  const R = r.repeat, startK = startKeyOf(r), until = R.until || '9999-12-31', max = +R.count || 1e9, skip = R.skip || [], out = [];
  let k = startK, n = 0, guard = 0;
  if (!R.count && fromK > startK && R.freq !== 'fortnight') { k = fromK; } // no counting needed: jump ahead
  while (k <= toK && k <= until && n < max && guard++ < 5000) {
    if (occursOn(R, startK, k)) { n++; if (k >= fromK && !skip.includes(k)) out.push(k); }
    k = addDaysKey(k, 1);
  }
  return out;
}
function repeatText(R, startK) {
  if (!R) return '';
  const days = (R.days && R.days.length ? R.days : [weekdayOfKey(startK)]).slice().sort(), dn = andList(days.map(i => DOWL[i]));
  const d0 = +startK.slice(8, 10), nth = ['first', 'second', 'third', 'fourth', 'last'][Math.min(4, Math.ceil(d0 / 7) - 1)];
  const base = R.freq === 'day' ? 'Every day' : R.freq === 'week' ? (days.length === 5 && !days.includes(0) && !days.includes(6) ? 'Every weekday' : `Every ${dn}`) : R.freq === 'fortnight' ? `Every second ${dn}` : R.freq === 'month' ? (R.monthBy === 'weekday' ? `Monthly on the ${nth} ${DOWL[weekdayOfKey(startK)]}` : `Monthly on the ${d0}${[, 'st', 'nd', 'rd'][d0 % 10 > 3 || Math.floor(d0 / 10) === 1 ? 0 : d0 % 10] || 'th'}`) : 'Every year';
  return base + (R.until ? `, until ${fmtDay(R.until, {day: 'numeric', month: 'short'})}` : R.count ? `, ${R.count} times` : '');
}
let _levKey = '', _levVal = [];
function localEvs() {
  const rows = S.localEvents || [], sig = rows.map(r => r.id + r.starts_at + r.ends_at + r.title + (r.location || '') + (r.member_ids || []).join() + (r.repeat ? JSON.stringify(r.repeat) : '')).join('|') + dayKey(new Date());
  if (sig === _levKey) return _levVal;
  const today = dayKey(new Date()), fromK = addDaysKey(today, -7), toK = addDaysKey(today, 400), out = [];
  rows.forEach(r => {
    if (!r.repeat) return out.push(localToEv(r));
    const base = localToEv(r), dur = new Date(base.ends_at) - new Date(base.starts_at), hm = r.all_day ? null : hhmmOf(new Date(r.starts_at));
    occurrences(r, fromK, toK).forEach(k => { const st = r.all_day ? k + 'T00:00:00Z' : zonedISO(k, hm);
      out.push(Object.assign({}, base, {id: 'L-' + r.id + '@' + k, event_id: 'L-' + r.id + '@' + k, series: true, occ: k, starts_at: st, ends_at: new Date(new Date(st).getTime() + dur).toISOString()})); });
  });
  _levKey = sig; _levVal = out; return out;
}
const rowOfLocalId = id => S.localEvents.find(x => x.id === String(id).replace(/^L-/, '').replace(/@.*$/, ''));
const evById = id => S.events.find(x => x.id === id) || localEvs().find(x => x.id === id);
function eventColour(ev) {
  if (ev.local) { const m = ev.member_id && memberById(ev.member_id); return (m && m.color) || '#C9772B'; }
  const o = (settings().people || {})[ev.event_id]; if (o && o.for) { const m = memberById(o.for); if (m && m.color) return m.color; }
  const cal = S.calendars.find(c => c.google_id === ev.calendar_id);
  const m = cal && cal.member_id && memberById(cal.member_id);
  return (m && m.color) || (cal && cal.color) || '#2F7BB5';
}
// Who an event is for: one or more people (none = everyone). Skylike events keep it on the event; Google events in settings.people.
function eventMembers(ev) {
  if (!ev) return [];
  if (ev.local) { const ids = ev.member_ids && ev.member_ids.length ? ev.member_ids : ev.member_id ? [ev.member_id] : []; return ids.map(memberById).filter(Boolean); }
  const o = (settings().people || {})[ev.event_id]; if (o && o.for !== undefined) return [].concat(o.for || []).map(memberById).filter(Boolean);
  const m = eventMemberCal(ev); return m ? [m] : [];
}
const whoMeta = (e, calName) => { const ms = eventMembers(e); return ms.length ? ms.slice(0, 3).map(miniFace).join('') + esc(andList(ms.map(x => x.name))) : '<i></i>' + esc(calName); };
function eventMember(ev) { return eventMembers(ev)[0] || null; }
function eventMemberCal(ev) { const cal = S.calendars.find(c => c.google_id === ev.calendar_id); return cal && cal.member_id ? memberById(cal.member_id) : null; }
function visibleEvents() {
  const on = new Set(S.calendars.filter(c => c.enabled).map(c => c.google_id));
  return S.events.filter(e => on.size === 0 || on.has(e.calendar_id)).concat(localEvs()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
function eventsOnKey(k) {
  return visibleEvents().filter(e => {
    if (e.all_day) { const s = e.starts_at.slice(0, 10), en = e.ends_at.slice(0, 10); return s <= k && k < en; }
    return dayKey(new Date(e.starts_at)) === k;
  });
}
function reminderToday(r, k) {
  if (weekdayOfKey(k) !== r.weekday) return false;
  if (r.every_weeks <= 1 || !r.anchor_date) return true;
  const w = Math.round(daysBetween(r.anchor_date, k) / 7);
  return ((w % r.every_weeks) + r.every_weeks) % r.every_weeks === 0;
}
function binNames(rs) {
  if (rs.length === 1) return rs[0].title;
  const n = rs.map(r => r.title.replace(/\s*bins?$/i, ''));
  return n.slice(0, -1).join(', ') + ' + ' + n[n.length - 1] + ' bins';
}
function nextCollections(from, days = 21) {
  const out = [];
  for (let i = 0; i < days; i++) { const kk = addDaysKey(from, i), rs = S.reminders.filter(r => reminderToday(r, kk)); if (rs.length) out.push([kk, rs]); }
  return out;
}
function countdownsHTML(k, n = 3) {
  const list = S.countdowns.map(c => [c, daysBetween(k, c.date)]).filter(([, d]) => d >= 0 && d <= 60).sort((a, b) => a[1] - b[1]).slice(0, n);
  return list.length ? `<div class="cds">${list.map(([c, d]) => `<span class="cd">${c.emoji ? esc(c.emoji) + ' ' : ''}${esc(c.title)} <b class="num">${d === 0 ? 'today!' : d === 1 ? '1 sleep' : d + ' sleeps'}</b></span>`).join('')}</div>` : '';
}
function chipsFor(k, now) {
  const st = settings(), out = [], hr = hoursFloat(now);
  // bins: evening before, and morning of
  const tomorrow = addDaysKey(k, 1);
  // What to bring: today until 10am, tomorrow's from 3pm so bags get packed the night before.
  const bk = hr < 10 ? k : hr >= 15 ? tomorrow : null;
  // Shop day (optional, Settings → Kitchen): the evening before and the morning of
  const sd = kset().shopDay, gl = listByKind('grocery'), gn = gl ? listItems(gl.id, false).length : 0;
  if (sd != null && gn) { if (weekdayOfKey(tomorrow) === sd && hr >= 15) out.push({icon: 'list', c: '#2E8B57', text: `Shop tomorrow: ${gn} on the list`, sub: 'groceries', act: 'go-groceries'}); else if (weekdayOfKey(k) === sd && hr < 15) out.push({icon: 'list', c: '#2E8B57', text: `Shop day: ${gn} on the list`, sub: 'today', act: 'go-groceries'}); }
  // Lunchboxes: pack this morning (until 9:30), prep tonight for tomorrow (from 6pm)
  const lk = hr < 9.5 ? k : hr >= 18 ? tomorrow : null, lm = lk && mealOn(lk, 'lunch');
  if (lm) { const who = [...new Set((lm.ingredients || []).map(i => i.who).filter(Boolean))], mains = who.map(w => { const it = (lm.ingredients || []).find(i => i.who === w && i.slot === 'Lunch'); return it ? `${w} ${foodEmoji(it.name)}` : w; });
    out.push({icon: 'meal', c: '#C9772B', text: `Lunchboxes: ${mains.join(', ') || lm.title}`, sub: lk === k ? 'pack this morning' : 'prep for tomorrow', act: 'lunch-open', k: lk, first: true}); }
  // kids bringing the same things share one chip ("Ruby and Leo: Hat, Swimmers + towel"); words only, so it reads from across the room
  if (bk) { const groups = {}; bringFor(bk).forEach(({m, items}) => { const key = items.map(r => r.title).join(', '); (groups[key] = groups[key] || {key, kids: []}).kids.push(m); });
    Object.values(groups).forEach(g => out.push({icon: 'bag', c: g.kids[0].color || '#3A9AA0', text: `${g.kids.map(x => x.name).join(g.kids.length > 2 ? ', ' : ' and ')}: ${g.key}`, sub: bk === k ? 'bring today' : 'pack for tomorrow'})); }
  // One chip naming exactly which bins go out, e.g. "Red + Yellow bins · out tonight".
  // Before 6pm: today's what-to-wear; after: tomorrow's, so bags can be packed tonight.
  if (hr < 18) wearTips(k, Math.floor(hr)).forEach(t => out.push(t));
  else wearTips(tomorrow).forEach(t => out.push(Object.assign(t, {sub: 'tomorrow · ' + t.sub})));
  const tonight = S.reminders.filter(r => r.show_day_before && reminderToday(r, tomorrow) && hr >= 15);
  const morning = hr < 12 ? S.reminders.filter(r => reminderToday(r, k)) : [];
  const binChip = (rs, sub) => rs.length && out.push({icon: 'bin', bins: rs.map(r => BIN_COLOURS[r.color]), text: binNames(rs), sub});
  binChip(tonight, 'out tonight');
  if (!tonight.length) binChip(morning, morning.some(r => r.show_day_before) ? 'collected today' : 'today');
  if (st.holidays) {
    if (WA_HOLIDAYS[k]) out.push({icon: 'star', c: '#D9773B', text: WA_HOLIDAYS[k], sub: 'public holiday'});
    else for (let i = 1; i <= 6; i++) { const kk = addDaysKey(k, i); if (WA_HOLIDAYS[kk]) { out.push({icon: 'star', c: '#D9773B', text: WA_HOLIDAYS[kk], sub: i === 1 ? 'tomorrow' : fmtDay(kk, {weekday: 'long'})}); break; } }
  }
  if (st.school) {
    const inTerm = WA_TERMS.find(([a, b]) => a <= k && k <= b);
    if (!inTerm) {
      const next = WA_TERMS.find(([a]) => a > k);
      if (next) { const d = daysBetween(k, next[0]); out.push({icon: 'school', c: '#3A9AA0', text: d <= 3 ? 'Back to school' : 'School holidays', sub: d <= 3 ? (d === 1 ? 'tomorrow' : fmtDay(next[0], {weekday: 'long'})) : `${d} sleeps to go`}); }
    } else { const d = daysBetween(k, inTerm[1]); if (d >= 0 && d <= 4) out.push({icon: 'school', c: '#3A9AA0', text: 'Holidays start', sub: d === 0 ? 'after today' : `in ${d} sleeps`}); }
  }
  // Weekly fridge photo: once it's been a week (mornings and evenings, when people are in the kitchen)
  const fs = (st.scans || {}).fridge, fd = fs && fs.at ? (Date.now() - fs.at) / 864e5 : null;
  if (S.aiOn && (fd == null ? S.pantry.some(p => p.place === 'fridge') : fd >= 7) && (hr < 10 || hr >= 16)) out.push({icon: 'fridge', c: '#3A7CA5', text: 'Weekly fridge photo', sub: fd == null ? 'see what\'s running low' : `last one ${Math.floor(fd)} days ago`, act: 'scan-fridge'});
  // Everyday staples marked low or out (bread, milk…), one tap adds them to groceries
  const sl = staplesLow(); if (sl.length) { const out1 = sl.filter(p => p.out); out.push({icon: 'cart', c: out1.length ? '#C24A3A' : '#C98A12', text: out1.length === sl.length ? `Out of ${andList(sl.map(p => p.name.toLowerCase()))}` : `Low: ${andList(sl.map(p => p.name.toLowerCase()))}`, sub: 'tap to add to groceries', act: 'staples-add', staples: sl.map(p => p.name.toLowerCase()), anyOut: out1.length > 0}); }
  // Countdowns live on the idle screens (photos, night clock); home only shows one on the day itself.
  S.countdowns.forEach(c => {
    const d = daysBetween(k, c.date);
    if (d === 0) out.push({icon: 'gift', c: '#7B5EA7', text: c.title, sub: d === 0 ? 'today!' : d === 1 ? '1 sleep' : `${d} sleeps`, emoji: c.emoji});
  });
  return out;
}
function listItems(listId, includeDone = true) { return S.items.filter(i => i.list_id === listId && (includeDone || !i.done)); }
const listByKind = kind => S.lists.find(l => l.kind === kind);
function meMember() { return S.activeMember ? memberById(S.activeMember) : S.members.find(m => S.session && m.user_id === S.session.user.id); }

/* ============ sky colours ============ */
const SKY = [ // hour, top, bottom
  [0,'#0E1630','#1B2747'],[4.5,'#16213F','#2F3B66'],[5.6,'#3E4F86','#E79A72'],[6.6,'#7AA9CF','#F4C9A0'],
  [9,'#5BA3D3','#CFE6F2'],[15,'#4E9BD0','#D6EBF4'],[17.3,'#6F96C6','#F2C9A2'],[18.5,'#5A5E9E','#EE9A6B'],
  [19.4,'#2E3769','#9C6B8D'],[20.5,'#18213F','#2C3760'],[24,'#0E1630','#1B2747']
];
const hex = h => [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
function skyAt(h) {
  for (let i = 0; i < SKY.length - 1; i++) { const [h1,t1,b1] = SKY[i], [h2,t2,b2] = SKY[i + 1];
    if (h >= h1 && h <= h2) { const t = (h - h1) / (h2 - h1); return [mix(t1, t2, t), mix(b1, b2, t)]; } }
  return [SKY[0][1], SKY[0][2]];
}

/* ============ night / idle ============ */
function inWindow(startStr, endStr, h) {
  const toH = s => { const [a, b] = s.split(':').map(Number); return a + b / 60; };
  const s = toH(startStr), e = toH(endStr);
  return s < e ? h >= s && h < e : h >= s || h < e;
}
function touch() {
  const wasIdle = ['#saver', '#glance', '#night'].some(q => $(q).classList.contains('on'));
  S.lastTouch = Date.now();
  if ($('#saver').classList.contains('on')) stopSaver();
  $('#glance').classList.remove('on');
  // routine time: waking the tablet goes straight to the kids' pictures, no hunting for faces
  if (wasIdle && S.household && deviceKind() === 'tablet' && kids().length && liveRoutine() && !['kids', 'settings'].includes(S.view) && !document.querySelector('.sheet-bg')) {
    $('#night').classList.remove('on'); S._woke = Date.now(); S.view = 'kids'; S.activeMember = null; render();
  }
}
['pointerdown','keydown','wheel'].forEach(ev => document.addEventListener(ev, touch, {passive: true}));
// For little ones: just the two nearest countdowns, a big number, the event's emoji, and moons to count when it's close.
function glanceCountdowns(k) {
  const list = S.countdowns.map(c => [c, daysBetween(k, c.date)]).filter(([, d]) => d >= 0 && d <= 60).sort((a, b) => a[1] - b[1]).slice(0, 2);
  if (!list.length) return '';
  return `<div class="gcds">${list.map(([c, d]) => `<div class="gcd"><span class="ge">${esc(c.emoji || '🎉')}</span>${d === 0 ? '<b class="gn">Today!</b>' : `<b class="gn num">${d}</b><span class="gw">${d === 1 ? 'sleep' : 'sleeps'}</span>`}${d > 0 && d <= 7 ? `<span class="gm" aria-hidden="true">${'🌙'.repeat(d)}</span>` : ''}<span class="gt">${esc(c.title)}</span></div>`).join('')}</div>`;
}
function glanceHTML(now) {
  const k = dayKey(now);
  const live = eventsOnKey(k).filter(e => !e.all_day && new Date(e.ends_at) > now);
  const allDay = eventsOnKey(k).filter(e => e.all_day);
  const e = live[0], wx = S.weather && S.weather.current ? S.weather : null;
  const key = e ? `<div class="key" style="--c:${eventColour(e)}"><i></i><div style="text-align:left"><div class="lbl2">${new Date(e.starts_at) <= now ? 'Now' : 'Next'}</div><span class="t num">${esc(fmtTime(new Date(e.starts_at)))}</span> ${esc(e.title || 'Busy')}</div></div>`
    : allDay.length ? `<div class="key" style="--c:${eventColour(allDay[0])}"><i></i><div style="text-align:left"><div class="lbl2">Today</div>${esc(allDay[0].title)}</div></div>`
    : `<div class="key" style="--c:rgba(255,255,255,.7)"><i></i><div style="text-align:left"><div class="lbl2">Today</div>Nothing else on</div></div>`;
  const lr = kids().length ? liveRoutine(now) : null;
  const prompt = lr ? `<div class="gprompt">${lr.emoji ? kart(lr.emoji, lr.name, 'gpe') : ''}<span><b>${esc(routineName(lr))}</b>Tap anywhere to start</span></div>` : '';
  const right = glanceCountdowns(k) + (kids().length && S.rewards.length ? `<div class="gstars">${kids().map(kd => `<div class="gsrow">${avatar(kd)}<b>${esc(kd.name)}</b>${starTrack(kd, 'xl')}</div>`).join('')}</div>` : '');
  return `<div class="gl-left"><div class="clock num">${clockHTML(now)}</div>
    <div class="date">${esc(fmtDay(k, {weekday: 'long', day: 'numeric', month: 'long'}))}</div>
    ${wx ? `<div class="gwx">${Math.round(wx.current.temperature_2m)}° · ${esc(wxWords(wx.current.weather_code))}${(r => r ? ' · ' + esc(r) : '')(rainNote(wx))}</div>` : ''}
    ${key}${(br => br.length ? `<div class="cds">${br.map(x => `<span class="cd">${icon(x.icon)} ${esc(x.text)} <b>${esc(x.sub)}</b></span>`).join('')}</div>` : '')(chipsFor(k, now).filter(x => x.icon === 'bag'))}${(bins => bins.length ? `<div class="cds">${bins.map(x => `<span class="cd"><span class="bins">${x.bins.map(col => `<span class="b" style="--c:${col}">${icon('bin')}</span>`).join('')}</span> ${esc(x.text)} <b>${esc(x.sub)}</b></span>`).join('')}</div>` : '')(chipsFor(k, now).filter(x => x.bins))}${prompt}</div>${right ? `<div class="gl-right">${right}</div>` : ''}`;
}
function idleTick() {
  if (!S.household) return;
  const st = settings(), now = new Date(), h = hoursFloat(now), idle = (Date.now() - S.lastTouch) / 60e3;
  const night = inWindow(st.night.start, st.night.end, h), theme = LS.get('theme', 'auto');
  document.body.classList.toggle('night', theme === 'dark' || (theme === 'auto' && night));
  const nightEl = $('#night');
  if (night && deviceKind() === 'tablet' && idle >= 2) {
    if (!nightEl.classList.contains('on')) nightEl.classList.add('on');
    const nh = `<div class="clock num">${clockHTML(now)}</div><div class="date">${esc(fmtDay(dayKey(now), {weekday:'long', day:'numeric', month:'long'}))}</div>${countdownsHTML(dayKey(now))}`;
    if (nightEl._h !== nh) { nightEl.innerHTML = nh; nightEl._h = nh; }
  } else nightEl.classList.remove('on');
  if (deviceKind() === 'tablet') { if (night && st.night.sleep && idle >= 2) { if (wakeLock) { try { wakeLock.release(); } catch {} wakeLock = null; } } else if (!wakeLock && document.visibilityState === 'visible') keepAwake(); }
  // Daytime idle: clock (with today's key event and countdowns) for clockMins, then photos for photoMins, repeat.
  const glanceEl = $('#glance');
  if (!night && deviceKind() === 'tablet' && idle >= st.saver.after && !$('#timer').classList.contains('on')) {
    const clockM = st.saver.clockMins || 10, photoM = st.saver.photoMins || 5;
    const canPhotos = st.saver.on && S.photos.length && photoM > 0;
    const pos = (idle - st.saver.after) % (clockM + (canPhotos ? photoM : 0));
    if (canPhotos && pos >= clockM) { glanceEl.classList.remove('on'); startSaver(); }
    else {
      if ($('#saver').classList.contains('on')) stopSaver(true);
      const [t, b] = skyAt(h); glanceEl.style.setProperty('--g-top', t); glanceEl.style.setProperty('--g-bot', b);
      const gh = glanceHTML(now); if (glanceEl._h !== gh) { glanceEl.innerHTML = gh; glanceEl._h = gh; } glanceEl.classList.add('on');
    }
  } else glanceEl.classList.remove('on');
  if (S.view !== 'family' && deviceKind() === 'tablet' && idle >= (S.view === 'kid' ? Math.max(10, st.idleReturn) : st.idleReturn) && !document.querySelector('.sheet-bg') && S.view !== 'settings' && !(S.view === 'kids' && liveRoutine())) {
    S.view = 'family'; S.activeMember = null; render();
  }
}
/* kids' visual timer: a shrinking coloured disc, big minutes left, a soft chime at the end */
let timerT = 0;
const TIMER_PRESETS = [['🪥', 'Teeth', 2], ['🧸', 'Pack up', 5], ['👟', 'Shoes on', 3], ['📺', 'Screen time', 15], ['🛁', 'Bath', 10], ['⏳', '1 minute', 1]];
function chime() { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); [0, .25, .5].forEach((t, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = [660, 880, 990][i]; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(.0001, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(.25, ac.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + t + .9); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 1); }); } catch {} }
function timerUI() {
  const el = $('#timer'); el.classList.add('on'); S.lastTouch = Date.now(); clearInterval(timerT);
  const t = S.timer;
  if (!t) { el.innerHTML = `<div class="tm-pick"><h2>Timer</h2><div class="tm-presets">${TIMER_PRESETS.map(([e, l, m]) => `<button class="ktile" style="--c:#3A9AA0" data-act="timer-start" data-m="${m}" data-l="${esc(l)}" data-e="${e}">${kart(e, l)}<span class="lb">${esc(l)}</span><span class="sv num" style="color:var(--ink-2);letter-spacing:0">${m} min</span></button>`).join('')}</div><button class="btn ghost" data-act="timer-stop">Close</button></div>`; return; }
  const draw = () => {
    S.lastTouch = Date.now();
    const left = Math.max(0, t.end - Date.now()), frac = left / t.total, mins = Math.ceil(left / 60e3), secs = Math.ceil(left / 1000);
    if (left <= 0) { clearInterval(timerT); chime(); el.innerHTML = `<div class="tm-done">${kart(t.emoji, t.label || '', 'tm-em')}<h2>Time's up!</h2><div class="row" style="justify-content:center"><button class="btn" data-act="timer-open-again">Another timer</button><button class="btn soft" data-act="timer-stop">Done</button></div></div>`; S.timer = null; return; }
    el.innerHTML = `<div class="tm-run"><div class="tm-disc" style="--p:${(frac * 360).toFixed(1)}deg">${kart(t.emoji, t.label || '', 'tm-em')}</div>
      <div class="tm-left num">${secs <= 60 ? secs + '<small>sec</small>' : mins + '<small>min</small>'}</div><div class="tm-lbl">${esc(t.label)}</div>
      <button class="btn soft" data-act="timer-stop">Stop</button></div>`;
  };
  draw(); timerT = setInterval(draw, 1000);
}
let saverT, saverUrls = [], saverIdx = 0;
async function startSaver() {
  const el = $('#saver'); if (el.classList.contains('on')) return;
  el.classList.add('on');
  try {
    const off = settings().saverOff || [];
    const pool = S.photos.filter(p => !off.includes(p.album || 'Family'));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const paths = pool.slice(0, 60).map(p => p.path);
    const {data} = await sb.storage.from('photos').createSignedUrls(paths, 3600);
    saverUrls = (data || []).map(d => d.signedUrl).filter(Boolean);
  } catch { saverUrls = []; }
  if (!saverUrls.length) return stopSaver();
  saverIdx = 0; showSlide();
  saverT = setInterval(showSlide, 20000);
}
function showSlide() {
  const el = $('#saver'), now = new Date();
  const src = saverUrls[saverIdx++ % saverUrls.length], img = new Image(); img.alt = ''; img.className = 'fg'; img.src = src;
  img.onload = () => {
    const slide = document.createElement('div'); slide.className = 'slide';
    const photoR = img.naturalWidth / img.naturalHeight, screenR = innerWidth / innerHeight;
    if (Math.max(photoR, screenR) / Math.min(photoR, screenR) > 1.3) { slide.classList.add('fit'); const bg = new Image(); bg.alt = ''; bg.className = 'bg'; bg.src = src; slide.appendChild(bg); }
    slide.appendChild(img);
    el.insertBefore(slide, el.querySelector('.cap')); requestAnimationFrame(() => requestAnimationFrame(() => slide.classList.add('on')));
    const slides = el.querySelectorAll('.slide'); if (slides.length > 2) slides[0].remove();
  };
  let cap = el.querySelector('.cap'); if (!cap) { cap = document.createElement('div'); cap.className = 'cap'; el.appendChild(cap); }
  cap.innerHTML = `<div class="clock num">${clockHTML(now)}</div>${countdownsHTML(dayKey(now))}`;
}
function stopSaver(quiet) { clearInterval(saverT); const el = $('#saver'); el.classList.remove('on'); el.innerHTML = ''; if (!quiet) S.lastTouch = Date.now(); }

/* keep the screen awake on the family tablet */
let wakeLock = null;
async function keepAwake() {
  if (deviceKind() !== 'tablet' || !('wakeLock' in navigator)) return;
  if (wakeLock) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); if (S.hid) loadAll().then(render).catch(() => {}); } });
window.addEventListener('online', () => { S.online = true; renderRail(); if (S.hid) loadAll().then(render); });
window.addEventListener('offline', () => { S.online = false; renderRail(); });

