// Skylike: boot. Part 11 of 11; all parts share one global scope and load in order (index.html).
/* ============ boot ============ */
async function start() {
  if (!S.hid) {
    const {data} = await sb.from('memberships').select('household_id').limit(1);
    if (data && data[0]) { S.hid = data[0].household_id; LS.set('hid', S.hid); }
  }
  if (!S.hid) { S.household = null; return render(); }
  restoreSnap(); render();
  try { const ok = await loadAll(); if (!ok) { S.household = null; return start(); } } catch (err) { console.error(err); }
  if (deviceKind() === 'phone' && !S._phoneHomeSet) { S._phoneHomeSet = true; const me = S.members.find(m => S.session && m.user_id === S.session.user.id); if (me && me.home_view !== 'family') { S.activeMember = me.id; S.view = me.home_view; } }
  subscribe(); heartbeat(); loadWeather(); keepAwake(); render(); idleTick();
  if (!LS.get('deviceSetup', 0)) { if (localStorage.getItem('skylike:deviceKind')) LS.set('deviceSetup', 1); else setTimeout(() => deviceSheet('kind'), 600); }
}
let lastMinute = -1;
setInterval(() => {
  if (!S.household) return;
  const m = new Date().getMinutes();
  const covered = document.querySelector('#glance.on, #saver.on, #night.on');
  if (m !== lastMinute) { lastMinute = m; if (covered) S._staleUnder = true; else if (['family','focus','planner'].includes(S.view) && !document.querySelector('.sheet-bg')) render(); else renderSkyOnly(); }
  if (!covered && S._staleUnder) { S._staleUnder = false; render(); }
  idleTick();
}, 5000);
setInterval(() => { if (S.household) { heartbeat(); } }, 5 * 60e3);
setInterval(() => { if (S.household) loadWeather(); }, 30 * 60e3);

/* ?demo shows sample data with no sign-in (nothing is saved) */
const DEMO = new URLSearchParams(location.search).has('demo');
function startDemo() {
  const now = new Date(), k = dayKey(now), at = (dk, hm) => { const [h, m] = hm.split(':').map(Number); const d = keyToDate(dk); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - 8, m)).toISOString(); };
  const hid = 'demo'; S.hid = hid; S.session = {user: {id: 'u1', email: 'sample@example.com'}};
  S.household = {id: hid, name: 'Sample family', timezone: 'Australia/Perth', join_code: 'SAMPLE', settings: {sitter: {contacts: [{name: 'Alex (Dad)', role: 'Parent', phone: '0400 000 001'}, {name: 'Sam (Mum)', role: 'Parent', phone: '0400 000 002'}, {name: 'Nan', role: 'Grandma, 5 min away', phone: '0400 000 003'}], bedtimes: [{name: 'Ruby', time: '7:00pm'}, {name: 'Leo', time: '7:30pm'}], wifi: {name: 'SampleHouse', password: 'sample-wifi'}, notes: 'Leo has a nightlight. Ruby gets one book.'}}};
  S.members = [{id: 'm1', name: 'Alex', color: '#2F7BB5', kind: 'adult', home_view: 'focus', user_id: 'u1'}, {id: 'm2', name: 'Sam', color: '#7B5EA7', kind: 'adult', home_view: 'planner'}, {id: 'm3', name: 'Ruby', color: '#D49A12', kind: 'kid', home_view: 'family', emoji: '🐨'}, {id: 'm4', name: 'Leo', color: '#3F8A68', kind: 'kid', home_view: 'family', emoji: '🐢'}];
  S.calendars = [{id: 'c1', google_id: 'alex', name: 'Alex', member_id: 'm1', enabled: true}, {id: 'c2', google_id: 'sam', name: 'Sam', member_id: 'm2', enabled: true}, {id: 'c3', google_id: 'kids', name: 'Kids', member_id: 'm3', enabled: true}, {id: 'c4', google_id: 'leo', name: 'Leo', member_id: 'm4', enabled: true}];
  const E = (id, cal, dk, s, e, title, loc) => ({id, calendar_id: cal, event_id: id, title, starts_at: at(dk, s), ends_at: at(dk, e), all_day: false, location: loc || null});
  const t1 = addDaysKey(k, 1), t2 = addDaysKey(k, 2), t3 = addDaysKey(k, 3);
  S.events = [E('e1', 'kids', k, '08:30', '09:00', 'Kindy drop-off', 'Little Gumnuts'), E('e2', 'sam', k, '10:00', '11:00', 'Physio', 'Subiaco'), E('e3', 'leo', k, '13:00', '14:00', 'Leo nap'), E('e4', 'kids', k, '15:30', '16:15', 'Swimming', 'Bold Park Aquatic'), E('e5', 'alex', k, '17:30', '18:00', 'Pick up groceries'), E('e6', 'sam', k, '19:30', '21:00', 'Book club'),
    E('e7', 'alex', t1, '07:00', '08:00', 'Gym'), E('e8', 'kids', t1, '09:30', '10:30', 'Playgroup', 'Wembley'), E('e9', 'sam', t2, '12:00', '13:00', 'Lunch with Jess'), E('e10', 'kids', t3, '16:00', '17:00', 'Ruby: dance'), {id: 'e11', calendar_id: 'kids', event_id: 'e11', title: 'Ruby: photo day', starts_at: t2 + 'T00:00:00Z', ends_at: t3 + 'T00:00:00Z', all_day: true}];
  S.events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  S.lists = [{id: 'l1', name: 'Groceries', kind: 'grocery'}, {id: 'l2', name: 'To do', kind: 'todo'}];
  const I = (id, l, text, done) => ({id, list_id: l, text, done: !!done, sort: +id.slice(1)});
  S.items = [I('i1', 'l1', 'Milk'), I('i2', 'l1', 'Bananas'), I('i3', 'l1', 'Weet-Bix'), I('i4', 'l1', 'Nappies (size 5)'), I('i5', 'l1', 'Coffee beans', true), I('i6', 'l2', 'Book car service'), I('i7', 'l2', 'RSVP to Mia\'s party'), I('i8', 'l2', 'Pay kindy fees'), I('i9', 'l2', 'Return library books', true)];
  S.notes = [{id: 'n1', text: 'Plumber coming Thursday morning. Leave the side gate open.', color: 'wattle', author_id: 'm2', created_at: now.toISOString()}, {id: 'n2', text: 'Ruby lost a tooth! Tooth fairy tonight.', color: 'sea', author_id: 'm1', created_at: now.toISOString()}, {id: 'n3', text: 'Hats for kindy this week, sun is fierce.', color: 'coral', author_id: 'm2', created_at: now.toISOString()}];
  S.reminders = [{id: 'r1', title: 'Red bin', color: 'red', weekday: (weekdayOfKey(k) + 1) % 7, every_weeks: 1, show_day_before: true}, {id: 'r2', title: 'Yellow bin', color: 'yellow', weekday: (weekdayOfKey(k) + 1) % 7, every_weeks: 2, anchor_date: addDaysKey(k, 1), show_day_before: true}, {id: 'r3', title: 'Green bin', color: 'green', weekday: (weekdayOfKey(k) + 1) % 7, every_weeks: 2, anchor_date: addDaysKey(k, 8), show_day_before: true}];
  S.countdowns = [{id: 'cd0', title: 'Ruby turns 5', emoji: '🎂', date: addDaysKey(k, 9)}, {id: 'cd1', title: 'Christmas', date: `${tzParts(now).y}-12-25`}];
  S.calStatus = {connected: true, last_sync_at: now.toISOString()}; S.realtime = 'live'; S.lastData = Date.now();
  S.devices = [{id: S.deviceId, name: 'Family screen', kind: 'tablet', app_version: APP_VERSION, last_seen: now.toISOString()}];
  const st2 = (e, l, id) => ({id, emoji: e, label: l});
  S.routines = [{id: 'r1', name: 'Morning', emoji: '🌅', starts: '06:00', ends: '09:30', days: [0,1,2,3,4,5,6], member_id: null, steps: [st2('🚽','Toilet','a'), st2('🪥','Teeth','b'), st2('👕','Get dressed','c'), st2('🥣','Breakfast','d'), st2('👟','Shoes on','e'), st2('🎒','Bag','f')]},
    {id: 'r2', name: 'Bedtime', emoji: '🌙', starts: '17:30', ends: '20:30', days: [0,1,2,3,4,5,6], member_id: null, steps: [st2('🛁','Bath','g'), st2('🩲','PJs on','h'), st2('🪥','Teeth','i'), st2('📖','Story','j'), st2('💡','Lights out','k')]}];
  S.chores = [{id: 'c1', title: 'Pack away toys', emoji: '🧸', stars: 1, days: [0,1,2,3,4,5,6], member_id: null}, {id: 'c2', title: 'Plate to the sink', emoji: '🍽️', stars: 1, days: [0,1,2,3,4,5,6], member_id: null}, {id: 'c3', title: 'Feed the fish', emoji: '🐟', stars: 2, days: [0,1,2,3,4,5,6], member_id: 'm3'}];
  S.rewards = [{id: 'w1', title: 'Ice cream treat', emoji: '🍦', cost: 10}, {id: 'w2', title: 'Trip to the park', emoji: '🛝', cost: 15}, {id: 'w3', title: 'Movie night pick', emoji: '🎬', cost: 25}];
  S.ticks = [['m3','r1:a'],['m3','r1:b'],['m3','r1:c'],['m4','r1:a']].map(([m, ref], i) => ({id: 't' + i, member_id: m, kind: 'step', ref, day: k, stars: 0}));
  S.balances = {m3: 12, m4: 7};
  const ing = (...xs) => xs.map(([n, q]) => ({name: n, qty: q}));
  S.mail = [{id: 'em1', household_id: hid, thread_id: 't1', status: 'new', subject: 'Term 4 newsletter: end of year events', sender: 'Malaga Primary School', received_at: new Date().toISOString(),
    events: [{title: 'Christmas concert', date: addDaysKey(k, 4), start: '17:30', end: '19:00', location: 'School undercover area', note: 'Wear something red'}, {title: 'Pupil-free day', date: addDaysKey(k, 8), start: '', end: '', location: '', note: ''}, {title: 'Excursion to the zoo', date: addDaysKey(k, 11), start: '09:00', end: '14:30', location: 'Perth Zoo', note: '$22, bring a hat'}]}];
  S.recipes = [{id: 'rc1', household_id: hid, title: "Nan's Meatballs", servings: '4', prep_time: '40 min', favourite: true, times_cooked: 6, last_cooked: addDaysKey(k, -9), source: 'photo', ingredients: [{qty: '500g', name: 'beef mince'}, {qty: '1', name: 'onion, grated'}, {qty: '1 cup', name: 'breadcrumbs'}, {qty: '1', name: 'egg'}, {qty: '700g', name: 'passata'}], steps: ['Mix the mince, onion, breadcrumbs and egg.', 'Roll into balls and brown them.', 'Simmer in the passata for 20 minutes.'], tags: []},
    {id: 'rc2', household_id: hid, title: 'Creamy Chicken Pasta', servings: '4', prep_time: '25 min', favourite: true, times_cooked: 3, source: 'link', url: 'https://www.recipetineats.com/', ingredients: [{qty: '400g', name: 'penne'}, {qty: '2', name: 'chicken breasts'}, {qty: '300ml', name: 'cream'}, {qty: '1 cup', name: 'spinach'}], steps: ['Cook the pasta.', 'Brown the chicken.', 'Add cream and spinach, toss with pasta.'], tags: []},
    {id: 'rc3', household_id: hid, title: 'Fish Tacos', servings: '4', prep_time: '30 min', favourite: false, times_cooked: 1, source: 'typed', ingredients: [{qty: '500g', name: 'white fish fillets'}, {qty: '8', name: 'small tortillas'}, {qty: '2 cups', name: 'shredded cabbage'}, {qty: '1', name: 'lime'}], steps: [], tags: []},
    {id: 'rc4', household_id: hid, title: 'Pumpkin Soup', servings: '6', prep_time: '45 min', favourite: false, times_cooked: 0, source: 'link', ingredients: [{qty: '1kg', name: 'pumpkin'}, {qty: '1', name: 'onion'}, {qty: '1 L', name: 'chicken stock'}], steps: [], tags: []}];
  S.meals = [{id: 'ml1', day: k, title: 'Tuna Mornay (Tuna Casserole Pasta Bake)', emoji: '🐟', est_cost: 14, real: true, servings: '5', prep_time: '35 min', difficulty: 'Easy', double_batch: true, ingredients: [{name: 'penne pasta', qty: '350g / 12oz', notes: 'or other short pasta', group: ''}, {name: 'butter', qty: '40g / 3 tbsp', group: ''}, {name: 'milk', qty: '4 cups (1 litre)', notes: 'any fat %', group: ''}, {name: 'canned tuna', qty: '425g / 15 oz', notes: 'drained', group: ''}, {name: 'canned corn', qty: '400g', group: ''}, {name: 'butter', qty: '25g', notes: 'melted', group: 'Crunchy Topping'}, {name: 'panko breadcrumbs', qty: '1/2 cup (60g)', group: 'Crunchy Topping'}]},
    {id: 'ml0', day: addDaysKey(k, 1), title: 'Leftovers: Tuna Mornay', emoji: '🍱', est_cost: 0, ingredients: [], leftovers_of: 'Tuna Mornay'},
    {id: 'ml2', day: addDaysKey(k, 3), title: 'Spaghetti Bolognese', emoji: '🍝', est_cost: 16, ingredients: ing(['Beef mince', '500 g'], ['Spaghetti', '500 g'], ['Crushed tomatoes', '2 tins'], ['Onion', '1'], ['Parmesan', 'to serve'])},
    {id: 'ml3', day: addDaysKey(k, 2), title: 'Crispy Baked Fish', emoji: '🐟', est_cost: 22, ingredients: ing(['White fish fillets', '600 g'], ['Panko', '1 cup'], ['Potatoes', '800 g'], ['Lemon', '1'])}];
  S.pantry = [['Milk', 'fridge', 'half', false], ['Eggs', 'fridge', '6', false], ['Cheese', 'fridge', '', true], ['Carrot', 'fridge', '3', false], ['Frozen peas', 'freezer', '', false], ['Spaghetti', 'pantry', '', false], ['Rice', 'pantry', '', false], ['Soy sauce', 'pantry', '', false], ['Weet-Bix', 'pantry', '', true]].map(([n, pl, q, lo], i) => ({id: 'p' + i, name: n, place: pl, qty: q || null, low: lo}));
  S.pantry.push({id: 'pl1', name: 'Leftover fried rice', place: 'fridge', leftover: true, portions: 2});
  const box = (lunchR, recR, leo, lo) => [{who: 'Ruby', slot: 'Crunch & Sip', name: 'Apple slices', buy: ['Apples']}, {who: 'Ruby', slot: 'Recess', name: 'Cheese stick', buy: ['Cheese sticks']}, {who: 'Ruby', slot: 'Lunch', name: lunchR, buy: ['Bread', 'Vegemite'], leftover: !!lo}, {who: 'Leo', slot: 'Crunch & Sip', name: 'Grapes', buy: ['Grapes']}, {who: 'Leo', slot: 'Recess', name: recR, buy: ['Popcorn'], new: recR === 'Rice crackers'}, {who: 'Leo', slot: 'Lunch', name: leo, buy: ['Wraps', 'Ham']}, {who: 'Leo', slot: 'Treat', name: 'Fruit roll-up', buy: ['Fruit roll-ups']}];
  [['Vegemite sandwich', 'Popcorn', 'Ham & cheese wrap'], ['Leftover fried rice (thermos)', 'Rice crackers', 'Cheese scroll', 1], ['Vegemite sandwich', 'Popcorn', 'Crackers & cheese']].forEach(([a, b2, c, lo], i) => S.meals.push({id: 'lu' + i, slot: 'lunch', for_who: 'kids', day: addDaysKey(k, i === 0 ? 0 : i + 2), title: a, emoji: '🍱', leftovers_of: lo ? a : null, ingredients: box(a, b2, c, lo), est_cost: 4}));
  S.household.settings = Object.assign({}, S.household.settings, {kitchen: Object.assign({}, (S.household.settings || {}).kitchen, {lunchbox: {staples: 'water bottle', kids: {m3: {likes: 'vegemite sandwich, apple, cheese stick', nope: 'tomato'}, m4: {likes: 'popcorn, ham wrap, grapes, fruit roll-up', nope: 'mushroom, egg'}}}})});
  S.aiOn = true;
  S.bringRules = [{id: 'b1', emoji: '🧢', title: 'Hat', days: [1,2,3,4,5], member_id: null}, {id: 'b2', emoji: '🩱', title: 'Swimmers + towel', days: [], match: 'swim', member_id: null}, {id: 'b3', emoji: '📚', title: 'Library bag', days: [5], member_id: 'm3'}];
  const v = new URLSearchParams(location.search).get('view'); if (v) { S.view = v; if (v === 'focus') S.activeMember = 'm1'; if (v === 'planner') S.activeMember = 'm2'; }
  const st = new URLSearchParams(location.search).get('tab'); if (st) S.settingsTab = st;
  if (new URLSearchParams(location.search).has('night')) S.household.settings.night = {start: '00:00', end: '23:59'};
  // demo: writes go nowhere
  const noop = () => { const p = Promise.resolve({data: null, error: null}); const q = new Proxy(function () {}, {get: (t, k) => k === 'then' ? p.then.bind(p) : () => q, apply: () => q}); return q; };
  sb.from = noop; sb.rpc = noop; sb.channel = () => ({on() { return this; }, subscribe() { return this; }}); sb.removeChannel = () => {};
  loadWeather(); render(); idleTick();
  toast('Sample data: nothing here is saved', 4000);
}

if (DEMO) { startDemo(); }
else sb.auth.onAuthStateChange((ev, session) => {
  const had = !!S.session; S.session = session;
  if (session && !had) start();
  if (!session) { S.household = null; render(); }
});
if (!DEMO) sb.auth.getSession().then(({data}) => { S.session = data.session; if (S.session) start(); else render(); });
