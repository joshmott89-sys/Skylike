// Skylike: calendar. Part 10 of 11; all parts share one global scope and load in order (index.html).
/* ---- two-way calendar: add, edit, move and delete events through the household's Apps Script bridge ---- */
const calOf = e => S.calendars.find(c => c.google_id === e.calendar_id);
const twoWayCals = () => S.calendars.filter(c => !c.google_id.startsWith('ics:') && c.enabled);
const canEdit = e => !!e && (e.local || (!DEMO_EDIT_BLOCK() && !!calOf(e) && !calOf(e).google_id.startsWith('ics:')));
const DEMO_EDIT_BLOCK = () => false;
function zonedISO(k, hhmm) { // a wall-clock time in the household's zone → exact time
  const [y, m, d] = k.split('-').map(Number), [H, M] = String(hhmm || '09:00').split(':').map(Number), want = Date.UTC(y, m - 1, d, H, M); let t = want;
  for (let i = 0; i < 3; i++) { const p = tzParts(new Date(t)); t += want - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min); }
  return new Date(t).toISOString();
}
const hhmmOf = d => { const p = tzParts(d); return String(p.h).padStart(2, '0') + ':' + String(p.min).padStart(2, '0'); };
async function reloadEvents() { const since = new Date(Date.now() - 3 * 864e5).toISOString(); const {data} = await sb.from('events_cache').select('*').eq('household_id', S.hid).gte('ends_at', since).order('starts_at'); if (data) { S.events = data; render(); } }
function eventForm(e, k) {
  const cals = twoWayCals(), me = meMember();
  const pre0 = S._evDraft || {};
  const day = e ? (e.all_day ? e.starts_at.slice(0, 10) : dayKey(new Date(e.starts_at))) : (pre0.day || k || S.dayKey || dayKey(new Date()));
  const nowH = tzParts(new Date()).h, st = e && !e.all_day ? hhmmOf(new Date(e.starts_at)) : (pre0.start || String(Math.min(22, nowH + 1)).padStart(2, '0') + ':00');
  const en = e && !e.all_day ? hhmmOf(new Date(e.ends_at)) : (pre0.end || String(Math.min(23, +st.slice(0, 2) + 1)).padStart(2, '0') + ':' + st.slice(3, 5));
  const mine = cals.find(c => me && c.member_id === me.id) || cals[0], isLocal = e ? !!e.local : !mine, pre = S._evDraft || {}; S._evDraft = null;
  const picked = e ? eventMembers(e).map(m => m.id) : [].concat(pre.who || []).filter(Boolean);
  const whoSel = `<div class="evwho" ${isLocal ? '' : 'hidden'}><div class="lbl">Who's it for <span class="hint">tap one or more · none = everyone</span></div><input type="hidden" name="who" value="${picked.join(',')}">
      <div class="chips2 forpick">${S.members.map(m => `<button type="button" class="chip2 ${picked.includes(m.id) ? 'on' : ''}" data-act="who-tog" data-m="${m.id}" aria-pressed="${picked.includes(m.id)}">${avatar(m)}${esc(m.name)}</button>`).join('')}</div>
      <textarea class="input" name="notes" rows="2" maxlength="600" placeholder="Notes (optional): bring a hat, RSVP by Friday…">${esc((e ? e.notes : pre.notes) || '')}</textarea></div>`;
  sheet(`<h2>${e ? 'Edit event' : 'Add an event'}</h2>
    <form data-form="ev-save" data-id="${e ? e.id : ''}" class="evform">
      ${e || pre0.title ? '' : `<div class="evimp"><button type="button" class="btn soft sm" data-act="ev-import">${icon('camera')} From a photo</button><button type="button" class="btn soft sm" data-act="ev-import">Paste text</button></div>`}
      <div class="row evtitle"><input class="input grow" id="ev-title" name="title" data-change="ev-smart" placeholder="e.g. Dancing for Elowyn at 10am Saturday" value="${esc(e ? e.title : (pre.title || ''))}" maxlength="120" required>${micBtn('#ev-title')}</div><p class="smarthint" hidden></p>
      ${e ? `<p class="help">${e.local ? 'Only in Skylike (not in Google Calendar)' : 'In ' + esc((calOf(e) || {}).name || 'Google Calendar')}</p>` : `<label class="lbl">Calendar <select class="input" name="calendar" data-change="ev-cal">${cals.map(c => `<option value="${c.id}" ${mine && c.id === mine.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="skylike" ${!mine ? 'selected' : ''}>Skylike only (just this family)</option></select></label>${!cals.length ? `<p class="help">Want events in Google Calendar too? <button type="button" class="linkbtn" data-act="ev-setup">Connect two-way editing</button></p>` : ''}`}
      ${whoSel}
      <div class="row evrow"><label class="lbl">Day <input class="input" type="date" name="day" value="${day}" required data-change="rep-refresh"></label><label class="lbl evad"><input type="checkbox" name="allday" ${(e ? e.all_day : pre0.all_day) ? 'checked' : ''} data-change="ev-allday"> All day</label></div>
      <div class="row evrow evtimes" ${(e ? e.all_day : pre0.all_day) ? 'hidden' : ''}><label class="lbl">Starts <input class="input" type="time" name="start" value="${st}" data-change="ev-start" data-prev="${st}"></label><label class="lbl">Ends <input class="input" type="time" name="end" value="${en}"></label></div>
      ${repeatBlock(e, day, pre0)}
      <div class="lbl">Where <span class="hint">optional, used for leave reminders</span></div>${locField(e ? e.location : pre0.location)}
      ${e && /@\\d+$/.test(e.event_id) && S.events.filter(x => x.event_id.replace(/@\\d+$/, '') === e.event_id.replace(/@\\d+$/, '')).length > 1 ? '<p class="help">This repeats: changes here only affect this one.</p>' : ''}
      <div class="row" style="margin-top:6px"><button class="btn">${e ? 'Save' : 'Add to calendar'}</button>${e ? `<button type="button" class="btn ghost danger" data-act="ev-del" data-id="${e.id}">Delete</button>` : ''}</div>
    </form>`, {focus: !e});
}
async function saveLocalEvent(r, undo) {
  if (DEMO) return toast('Sample data: nothing here is saved');
  const row = {household_id: S.hid, title: r.title, starts_at: r.starts_at, ends_at: r.ends_at, all_day: !!r.all_day, location: r.location || null, notes: r.notes || null, member_id: (r.member_ids && r.member_ids[0]) || r.member_id || null, member_ids: r.member_ids || (r.member_id ? [r.member_id] : []), repeat: r.repeat || null, updated_at: new Date().toISOString()};
  const q = r._new ? sb.from('local_events').insert(Object.assign({id: r.id}, row)) : sb.from('local_events').update(row).eq('id', r.id);
  const {error} = await q; delete r._new;
  if (error) { if (undo && undo.drop) S.localEvents = S.localEvents.filter(x => x !== r); else if (undo) Object.assign(r, {starts_at: undo.s, ends_at: undo.e2}); render(); return toast("Couldn't save the event. Try again.", 4000); }
  toast(pv('saved'), 1800);
}
async function calWrite(body, undo) {
  if (DEMO) { toast('Sample data: nothing is sent to Google.'); return; }
  const r = await callFn(body);
  if (r.error) { if (undo) undo(); render(); return toast('Couldn’t update Google Calendar: ' + r.error, 5000); }
  toast(body.action === 'delete' ? 'Deleted from Google Calendar' : 'Saved to Google Calendar', 2500); reloadEvents();
}
function moveEventToDay(id, k) {
  if (!unlocked()) return askPin(() => moveEventToDay(id, k));
  const e = evById(id); if (!e || !canEdit(e)) return toast('That calendar is read-only here.');
  if (e.local && e.series) { const r = e.row, k0 = e.occ; if (k0 === k) return; const st = e.all_day ? k + 'T00:00:00Z' : zonedISO(k, hhmmOf(new Date(e.starts_at))), en = new Date(new Date(st).getTime() + (new Date(e.ends_at) - new Date(e.starts_at))).toISOString();
    r.repeat = Object.assign({}, r.repeat, {skip: (r.repeat.skip || []).concat(k0)}); const c = {id: uid(), _new: true, household_id: S.hid, title: r.title, location: r.location, notes: r.notes, all_day: r.all_day, starts_at: st, ends_at: en, member_id: r.member_id, member_ids: r.member_ids || [], repeat: null};
    S.localEvents.push(c); render(); saveLocalEvent(r, null); saveLocalEvent(c, {drop: true}); toast('Moved just this one'); return; }
  if (e.local) { const r = e.row, fromK = e.all_day ? e.starts_at.slice(0, 10) : dayKey(new Date(e.starts_at)); if (fromK === k) return; const old = {s: r.starts_at, e2: r.ends_at};
    if (e.all_day) { const len = Math.max(1, daysBetween(e.starts_at.slice(0, 10), e.ends_at.slice(0, 10))); r.starts_at = k + 'T00:00:00Z'; r.ends_at = addDaysKey(k, len) + 'T00:00:00Z'; }
    else { const ns = zonedISO(k, hhmmOf(new Date(e.starts_at))); r.ends_at = new Date(new Date(ns).getTime() + (new Date(e.ends_at) - new Date(e.starts_at))).toISOString(); r.starts_at = ns; }
    render(); saveLocalEvent(r, old); return; }
  const fromK = e.all_day ? e.starts_at.slice(0, 10) : dayKey(new Date(e.starts_at)); if (fromK === k) return;
  const old = {s: e.starts_at, e2: e.ends_at}, shift = daysBetween(fromK, k) * 864e5;
  let body;
  if (e.all_day) { const len = Math.max(1, daysBetween(e.starts_at.slice(0, 10), e.ends_at.slice(0, 10))); const endK = addDaysKey(k, len); e.starts_at = k + 'T00:00:00Z'; e.ends_at = endK + 'T00:00:00Z'; body = {action: 'update', id, start: k, end: endK, allDay: true}; }
  else { const ns = zonedISO(k, hhmmOf(new Date(e.starts_at))), ne = new Date(new Date(ns).getTime() + (new Date(e.ends_at) - new Date(e.starts_at))).toISOString(); e.starts_at = ns; e.ends_at = ne; body = {action: 'update', id, start: ns, end: ne, allDay: false}; }
  render(); toast(`Moving ${e.title} to ${fmtDay(k, {weekday: 'long'})}…`);
  calWrite(body, () => { e.starts_at = old.s; e.ends_at = old.e2; });
}
async function callFn(body) {
  const {data: {session}} = await sb.auth.getSession();
  try {
    const r = await fetch(FN_URL, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, apikey: SUPABASE_KEY}, body: JSON.stringify(Object.assign({household_id: S.hid}, body))});
    return await r.json();
  } catch { return {error: 'No connection'}; }
}

const PLAN_STAGES = [[0, 'Looking in the fridge…'], [5, 'Thinking what\'s good…'], [14, 'Planning it out…'], [26, 'Consulting Nagi at RecipeTin Eats…'], [45, 'Nearly there…']];
let planT = 0;
function planTicker() { clearInterval(planT); planT = setInterval(() => { if (!S.planning) return clearInterval(planT); const el = $('#plan-stage'); if (el) el.textContent = planStage(); else if (S.view === 'meals') render(); }, 1500); }
const planStage = () => { const t = (Date.now() - (S.planning || {}).at) / 1000; return PLAN_STAGES.filter(([s]) => t >= s).pop()[1]; };
function planSheet(keep) {
  const off = S.mealOffset || 0, mon = weekStart(off), today = dayKey(new Date()), ks = kset(), pp = ks.plan || {};
  if (!keep || !S._plan) S._plan = {days: [...Array(7)].map((_, i) => addDaysKey(mon, i)).filter(k => k >= today && !mealOn(k)), people: ks.servings || 4, vibe: pp.vibe || 'Standard family dinners', skill: pp.skill || 'Home cook', double: pp.double || '0', lunch: pp.lunch || 'none', focus: pp.focus || [], cuisines: pp.cuisines || [], notes: ks.prefs || ''};
  const P = S._plan; if (keep) P.notes = ($('#plan-notes') || {}).value ?? P.notes;
  const tag = (g, v, label) => { const on = Array.isArray(P[g]) ? P[g].includes(v) : P[g] === v; return `<button type="button" class="ptag ${on ? 'on' : ''}" data-act="plan-tag" data-g="${g}" data-v="${esc(v)}" aria-pressed="${on}">${esc(label || v)}</button>`; };
  const days = [...Array(7)].map((_, i) => addDaysKey(mon, i));
  sheet(`<h2>Plan dinners</h2>
    <div class="pblock"><div class="kt">Which days</div><div class="ptags">${days.map(k => { const past = k < today, on = P.days.includes(k), has = mealOn(k); return `<button type="button" class="ptag day ${on ? 'on' : ''}" data-act="plan-day" data-k="${k}" ${past ? 'disabled' : ''} aria-pressed="${on}">${esc(fmtDay(k, {weekday: 'short'}))}</button>`; }).join('')}</div><p class="help">Highlighted nights get new dinners${days.some(k => mealOn(k) && k >= today) ? ' (replacing any already planned)' : ''}.</p></div>
    <div class="pblock row" style="justify-content:space-between"><div class="kt" style="margin:0">Feeding</div><div class="row stepper"><button class="icon-btn" type="button" data-act="plan-people" data-d="-1" aria-label="Fewer">−</button><b class="num">${P.people}</b><button class="icon-btn" type="button" data-act="plan-people" data-d="1" aria-label="More">+</button></div></div>
    <div class="pblock"><div class="kt">Cook once, eat twice</div><div class="ptags">${tag('double', '0', 'No')}${tag('double', '1', '1 night')}${tag('double', '2', '2 nights')}</div><p class="help">Makes a double batch so the next night is leftovers.</p></div>
    <div class="pblock"><div class="kt">Lunches too?</div><div class="ptags">${tag('lunch', 'none', 'No')}${tag('lunch', 'kids', "Kids' school lunches")}${tag('lunch', 'all', 'Everyone')}</div><p class="help">${P.lunch === 'kids' ? `Nut-free lunchboxes on each kid's school days, built mostly from their favourites. <button class="linkbtn" data-act="plan-faves">School days and favourites</button>` : P.lunch === 'all' ? 'A lunch for everyone on each highlighted day.' : 'Leftovers too small for a family dinner go into lunches when this is on.'}</p></div>
    <div class="pblock"><div class="kt">Vibe and effort</div><div class="ptags">${[['Standard family dinners', 'Standard'], ['Quick and easy, under 30 minutes', 'Quick'], ['Something new and exciting', 'Something new'], ['A weekend cooking project', 'Challenge me']].map(([v, l]) => tag('vibe', v, l)).join('')}</div></div>
    <div class="pblock"><div class="kt">Cooking skill</div><div class="ptags">${['Beginner', 'Home cook', 'Confident'].map(v => tag('skill', v)).join('')}</div></div>
    <div class="pblock"><div class="kt">Focus</div><div class="ptags">${['High protein', 'Hidden veggies', 'Budget friendly', 'Low carb', 'Kid favourites'].map(v => tag('focus', v)).join('')}</div></div>
    <div class="pblock"><div class="kt">Cuisines</div><div class="ptags">${['Asian', 'Italian', 'Mexican', 'Indian', 'Thai', 'Middle Eastern', 'Classic Aussie'].map(v => tag('cuisines', v)).join('')}</div></div>
    <div class="pblock"><div class="kt">Tastes and things to avoid</div><textarea class="input" id="plan-notes" rows="2" placeholder="e.g. mild spice, no mushrooms, fish once a week">${esc(P.notes)}</textarea></div>
    ${S.pantry.some(p => p.leftover) ? `<p class="help">🍱 Leftovers: ${S.pantry.filter(p => p.leftover).map(p => `${esc(p.name.replace(/^leftovers?\s*/i, ''))} (${p.portions || 1}) → ${(p.portions || 1) >= P.people ? 'a leftovers night' : P.lunch !== 'none' ? 'lunches' : 'not enough for dinner; turn on lunches to use it'}`).join('; ')}.</p>` : ''}
    <button class="btn" style="width:100%;justify-content:center;margin-top:6px" data-act="plan-go" ${P.days.length ? '' : 'disabled'}>${icon('sparkle')}${P.days.length ? `Plan ${P.days.length} day${P.days.length === 1 ? '' : 's'}` : 'Pick some days'}</button>`, {focus: false, keepScroll: keep});
}
const FOOD_EMOJI = [[/sandwich|sanga|toastie/, '🥪'], [/wrap|tortilla|burrito/, '🌯'], [/scroll|croissant/, '🥐'], [/toast|bread|roll\b|bun\b|bagel/, '🍞'], [/muffin|cupcake|cake/, '🧁'], [/pikelet|pancake/, '🥞'], [/pizza/, '🍕'], [/sushi/, '🍣'], [/rice|onigiri/, '🍙'], [/pasta|noodle/, '🍝'], [/apple/, '🍎'], [/banana/, '🍌'], [/grape|raisin|sultana/, '🍇'], [/blueberr/, '🫐'], [/strawberr|raspberr|berr/, '🍓'], [/orange|mandarin/, '🍊'], [/watermelon|melon/, '🍉'], [/pear/, '🍐'], [/kiwi/, '🥝'], [/pineapple/, '🍍'], [/mango/, '🥭'], [/carrot/, '🥕'], [/cucumber/, '🥒'], [/tomato/, '🍅'], [/corn|popcorn/, '🍿'], [/cheese/, '🧀'], [/yogh?urt|custard/, '🥛'], [/milk/, '🥛'], [/egg/, '🥚'], [/ham|chicken|turkey|meat/, '🍗'], [/sausage|frank/, '🌭'], [/cracker|rice cake|pretzel|chip|crisp/, '🍘'], [/biscuit|cookie|anzac/, '🍪'], [/roll-?up|lolly|jelly|chocolate|treat/, '🍬'], [/juice|poppa/, '🧃'], [/water/, '💧'], [/soup|thermos/, '🥣'], [/bar\b|muesli/, '🥜']];
const foodEmoji = n => { const t = String(n || '').toLowerCase(); const hit = FOOD_EMOJI.find(([re]) => re.test(t)); return hit ? hit[1] : '🍽️'; };
const AISLE_ORDER = ['Fruit & veg', 'Bakery', 'Deli', 'Meat & seafood', 'Dairy & eggs', 'Pantry', 'Breakfast', 'Snacks', 'Drinks', 'Baby', 'Health & beauty', 'Household', 'Frozen', 'Other'];
const AISLE_RULES = [['Frozen', /frozen|ice cream|icy pole|fish fingers|peas\b.*frozen|hash brown|nuggets/], ['Fruit & veg', /apple|banana|grape|berr|orange|mandarin|lemon|lime|pear|melon|mango|kiwi|avocado|tomato|potato|onion|garlic|carrot|cucumber|lettuce|spinach|broccoli|zucchini|capsicum|mushroom|celery|corn\b|cabbage|herb|coriander|parsley|basil|ginger|chilli|pumpkin|sweet potato|beans?\b|salad|fruit|veg/], ['Bakery', /bread|roll|wrap|tortilla|bun|bagel|croissant|muffin|scroll|pita|naan|crumpet/], ['Deli', /ham|salami|deli|hummus|dip|olive|prosciutto|chorizo/], ['Meat & seafood', /chicken|beef|mince|pork|lamb|sausage|bacon|steak|fish|salmon|prawn|turkey|thigh|breast|fillet/], ['Dairy & eggs', /milk|cheese|yogh?urt|butter|cream|egg|custard|feta|parmesan|mozzarella/], ['Breakfast', /cereal|weet[- ]?bix|oats|muesli|granola|porridge|vegemite|jam|honey|peanut butter|nutella/], ['Snacks', /chip|crisp|cracker|biscuit|cookie|chocolate|lolly|popcorn|bar\b|roll[- ]?up|pretzel|rice cake|shapes/], ['Drinks', /juice|soft drink|water|cordial|coffee|tea\b|kombucha|soda|beer|wine/], ['Baby', /nappy|nappies|wipes|formula|baby/], ['Health & beauty', /shampoo|conditioner|toothpaste|toothbrush|soap|deodorant|panadol|nurofen|vitamin|sunscreen|razor|tampon|pad\b/], ['Household', /paper towel|toilet paper|tissue|detergent|dishwash|spray|bin bag|foil|cling|baking paper|sponge|bleach|laundry|battery|batteries/], ['Pantry', /rice|pasta|noodle|flour|sugar|oil|vinegar|sauce|stock|tin|can\b|beans|lentil|spice|salt|pepper|paprika|cumin|curry|soy|mayo|mustard|tuna|coconut|nut|seed|breadcrumb|cornflour|baking|yeast/]];
const aisleOf = t => { const s2 = normFood(t); const hit = AISLE_RULES.find(([, re]) => re.test(s2)); return hit ? hit[0] : 'Other'; };
const SLOT_ORDER = ['Crunch & Sip', 'Recess', 'Lunch', 'Snack', 'Treat'];
const lunchNeed = m => { const out = []; (m.ingredients || []).forEach(it => (it.buy && it.buy.length ? it.buy : [it.name]).forEach(n => { if (!haveIt(n) && !out.some(o => sameFood(o, n))) out.push(n); })); return out; };
function lunchGlance(l) {
  const its = l.ingredients || [], who = [...new Set(its.map(i => i.who || 'Lunch'))];
  return who.map(w => { const mine = its.filter(i => (i.who || 'Lunch') === w).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)), main = mine.find(i => i.slot === 'Lunch') || mine[0], kid = kids().find(x => x.name === w);
    return `<span class="lg"><span class="lgw">${kid ? avatar(kid) : ''}<b>${esc(w)}</b></span><span class="lge" aria-hidden="true">${mine.map(i => `<i title="${esc(i.name)}">${foodEmoji(i.name)}</i>`).join('')}</span><span class="lgm">${esc(main ? main.name : '')}${mine.length > 1 ? ` <small>+${mine.length - 1}</small>` : ''}</span></span>`; }).join('');
}
function lunchSheet(k) {
  const m = mealOn(k, 'lunch'); if (!m) return;
  const items = m.ingredients || [], need = lunchNeed(m), who = [...new Set(items.map(i => i.who || 'Lunch'))], isKid = n => kids().some(x => x.name === n);
  const box = w => { const its = items.filter(i => (i.who || 'Lunch') === w).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
    return `<div class="lbox"><div class="lbh">${esc(w)}</div>${its.map(i => `<div class="lit"><span class="ls">${esc(i.slot || '')}</span><span class="ln"><span aria-hidden="true">${foodEmoji(i.name)}</span> ${esc(i.name)}${i.new ? ' <span class="mb">New</span>' : ''}${i.leftover ? ' <span class="mb dbl">🍱 leftover</span>' : ''}</span>${isKid(w) ? `<span class="lr"><button class="ratebtn" data-act="lunch-rate" data-v="up" data-who="${esc(w)}" data-name="${esc(i.name)}" aria-label="${esc(w)} likes ${esc(i.name)}">👍</button><button class="ratebtn" data-act="lunch-rate" data-v="down" data-who="${esc(w)}" data-name="${esc(i.name)}" aria-label="${esc(w)} won't eat ${esc(i.name)}">👎</button></span>` : ''}</div>`).join('')}</div>`; };
  sheet(`<h2>🍱 Lunchboxes</h2><p class="help">${esc(fmtDay(k, {weekday: 'long', day: 'numeric', month: 'short'}))}${m.est_cost ? ` · ~$${Math.round(m.est_cost)} to buy` : ''}</p>
    <div class="lboxes">${who.map(box).join('')}</div>
    ${who.some(isKid) ? '<p class="help">👍 adds it to that kid\'s favourites, 👎 means it won\'t be planned again.</p>' : ''}
    ${need.length ? `<p class="help"><b>To buy:</b> ${need.map(esc).join(', ')}</p>` : '<p class="help">You have everything for these.</p>'}
    <div class="row" style="margin-top:14px">${need.length ? `<button class="btn" data-act="lunch-need" data-k="${k}">Add ${need.length} to groceries</button>` : ''}<button class="btn ghost" data-act="lunch-faves">Favourites</button><button class="btn ghost" data-act="lunch-del" data-k="${k}">Remove</button></div>`);
}
function favesSheet() {
  const lb = lbox();
  sheet(`<h2>School days and favourites</h2><p class="help">Lunches are built mostly from these, with at most one new thing a week. Separate items with commas.</p>
    <form data-form="lunchbox">
    <div class="lbl">Staples for every box</div><input class="input" name="staples" value="${esc(lb.staples)}" placeholder="e.g. water bottle, apple, cheese stick">
    ${kids().map(k => { const c = lb.kids[k.id] || {}; return `<div class="pblock"><div class="kt fk">${avatar(k)} ${esc(k.name)}</div>
      <div class="lbl">School days</div><div class="ptags">${[1, 2, 3, 4, 5].map(d => `<label class="ptag-c"><input type="checkbox" name="days_${k.id}" value="${d}" ${kidDays(k.id).includes(d) ? 'checked' : ''}><span>${WD[d]}</span></label>`).join('')}</div>
      <div class="lbl">Always happy to eat</div><textarea class="input" rows="2" name="likes_${k.id}" placeholder="e.g. vegemite sandwich, cheese scroll, grapes, popcorn, fruit roll-up">${esc(c.likes || '')}</textarea>
      <div class="lbl">Won't eat</div><input class="input" name="nope_${k.id}" value="${esc(c.nope || '')}" placeholder="e.g. tomato, ham, anything mixed"></div>`; }).join('') || '<p class="help">Add the kids in Settings → People to set favourites for each one.</p>'}
    <button class="btn" style="margin-top:12px">Save favourites</button></form>`, {focus: false});
}
function mealSheet(k) {
  const m = mealOn(k);
  if (!m) {
    sheet(`<h2>Dinner on ${esc(fmtDay(k, {weekday: 'long', day: 'numeric', month: 'short'}))}</h2>
      <form data-form="meal-set" data-k="${k}"><input class="input" name="title" placeholder="e.g. Spaghetti bolognese" required maxlength="80"><p class="help">${S.aiOn ? 'The ingredients are filled in for you.' : 'Add a Gemini key in Settings → Kitchen to fill in ingredients automatically.'}</p><button class="btn">Save dinner</button></form>`); return;
  }
  const ing = m.ingredients || [], need = ing.filter(x => !haveIt(x.name));
  if (m.leftovers_of) { sheet(`<h2>🍱 Leftovers night</h2><p class="help">${esc(fmtDay(k, {weekday: 'long', day: 'numeric', month: 'short'}))} · the rest of ${esc(m.leftovers_of)} from last night. Nothing to buy.</p><div class="row" style="margin-top:14px"><button class="btn soft" data-act="meal-cooked" data-k="${k}">${m.cooked ? 'Not eaten yet' : 'We ate it'}</button><button class="btn ghost" data-act="meal-del" data-k="${k}">Remove</button></div>`); return; }
  let grp = null;
  const rows = ing.map(x => { const g = x.group && x.group !== grp ? `<li class="ggrp">${esc(x.group)}</li>` : ''; grp = x.group || grp; const h = haveIt(x.name);
    return g + `<li class="${h ? 'have' : ''}"><span><b class="num">${esc(x.qty || '')}</b> ${esc(x.name)}${x.notes ? ` <small>${esc(x.notes)}</small>` : ''}</span><span class="tag">${h ? 'Have' : 'Buy'}</span></li>`; }).join('');
  sheet(`<h2>${esc(m.emoji || '🍽️')} ${esc(m.title)}</h2>
    <div class="mbadges">${m.real ? `<span class="mb real">${icon('check', 'xs')} Real RecipeTin Eats recipe</span>` : '<span class="mb est">AI estimate: check the recipe</span>'}${m.double_batch ? '<span class="mb dbl">Double batch: leftovers tomorrow</span>' : ''}${m.servings ? `<span class="mb">Serves ${esc(m.servings)}</span>` : ''}${m.prep_time ? `<span class="mb">${esc(m.prep_time)}</span>` : ''}${m.difficulty ? `<span class="mb">${esc(m.difficulty)}</span>` : ''}</div>
    <p class="help">${esc(fmtDay(k, {weekday: 'long', day: 'numeric', month: 'short'}))}${m.est_cost ? ` · about <span class="num">$${Math.round(m.est_cost)}</span> to buy` : ''} · <a href="${esc(m.url || recipeLink(m.title))}" target="_blank" rel="noopener">${m.real ? 'Open the recipe' : 'Find it on RecipeTin Eats'}</a></p>
    <ul class="ing">${rows || '<li class="help">No ingredients listed.</li>'}</ul>
    <div class="row" style="margin-top:14px;flex-wrap:wrap">${need.length ? `<button class="btn" data-act="meal-need" data-k="${k}">Add ${need.length} to groceries</button>` : ''}<button class="btn soft" data-act="meal-cooked" data-k="${k}">${m.cooked ? 'Not cooked yet' : 'We cooked it'}</button><button class="btn ghost" data-act="meal-del" data-k="${k}">Remove</button></div>`);
}
async function groceryAdd(names, listId) {
  const g = listId ? S.lists.find(l => l.id === listId) : listByKind('grocery'); if (!g) return 0;
  const have = new Set(listItems(g.id, false).map(i => normFood(i.text)));
  const rows = []; names.forEach(n => { const t = String(n || '').trim(); const k = normFood(t); if (!t || have.has(k)) return; have.add(k); rows.push({id: uid(), household_id: S.hid, list_id: g.id, text: t.slice(0, 200), added_by: (meMember() || {}).id || null, sort: Date.now() / 1000 + rows.length / 1000, done: false, created_at: new Date().toISOString()}); });
  if (!rows.length) return 0; rows.forEach(r => S.items.push(r)); render(); await db(sb.from('list_items').insert(rows)); return rows.length;
}
// Same pantry item? Exact after tidying, or one name fully inside the other ("Milkybar" / "Milkybar melts").
function sameFood(a, b) {
  const x = normFood(a).split(' ').filter(w => w.length > 2).map(w => w.replace(/(es|s)$/, '')), y = normFood(b).split(' ').filter(w => w.length > 2).map(w => w.replace(/(es|s)$/, ''));
  if (!x.length || !y.length) return normFood(a) === normFood(b);
  const [s1, s2] = x.length <= y.length ? [x, y] : [y, x];
  return s1.every(w => s2.includes(w)) && (s1.length >= 2 || s2.length <= 2);
}
async function pantryAdd(items) {
  const rows = [];
  items.forEach(x => { const name = String(x.name || '').trim().slice(0, 60); if (!name) return; const ex = S.pantry.find(p => sameFood(p.name, name)) || rows.find(r => sameFood(r.name, name)); if (ex && !ex.id) return;
    if (ex) { ex.low = !!x.low; if (x.qty) ex.qty = x.qty; if (x.leftover) { ex.leftover = true; ex.portions = Math.max(1, +x.portions || ex.portions || 1); } db(sb.from('pantry').update({low: ex.low, qty: ex.qty, leftover: !!ex.leftover, portions: ex.portions || null, updated_at: new Date().toISOString()}).eq('id', ex.id)); }
    else rows.push({id: uid(), household_id: S.hid, name, qty: x.leftover ? null : (x.qty || null), place: ['fridge', 'freezer', 'pantry'].includes(x.place) ? x.place : placeGuess(name), low: !!x.low, leftover: !!x.leftover, portions: x.leftover ? Math.max(1, Math.min(12, +x.portions || 1)) : null}); });
  if (rows.length) { rows.forEach(r => S.pantry.push(r)); S.pantry.sort((a, b) => a.name.localeCompare(b.name)); await db(sb.from('pantry').insert(rows)); }
  render(); return rows.length;
}
// shrink a camera photo before sending it (keeps it fast on mobile data and under the AI's size limit)
function photoToBase64(file, max = 1400) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const sc = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * sc; c.height = img.height * sc; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .82).split(',')[1]); URL.revokeObjectURL(img.src); }; img.onerror = rej; img.src = URL.createObjectURL(file); });
}
async function toggleTick(kid, kind, ref, k, stars, existing) {
  if (existing) { S.ticks = S.ticks.filter(t => t.id !== existing.id); S.balances[kid.id] = starsOf(kid) - (existing.stars || 0); render(); await db(sb.from('ticks').delete().eq('id', existing.id)); }
  else { const row = {id: uid(), household_id: S.hid, member_id: kid.id, kind, ref, day: k, stars}; S.ticks.push(row); S.balances[kid.id] = starsOf(kid) + stars; render(); await db(sb.from('ticks').insert(row)); }
  loadBalances();
}
// a little burst of stars from the tile that was ticked
function cheer(el, big) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = (document.querySelector(`[data-act="${el.dataset.act}"][data-s="${el.dataset.s || ''}"][data-kid="${el.dataset.kid}"]`) || document.querySelector(`[data-act="${el.dataset.act}"][data-c="${el.dataset.c || ''}"][data-kid="${el.dataset.kid}"]`) || el).getBoundingClientRect();
  for (let i = 0; i < (big ? 14 : 7); i++) {
    const s = document.createElement('span'); s.className = 'burst'; s.innerHTML = STAR_SVG;
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * (big ? 120 : 60);
    s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;font-size:${big ? 30 : 22}px`;
    document.body.appendChild(s); setTimeout(() => s.remove(), 900);
  }
}
const daysFrom = v => v === 'wk' ? [1,2,3,4,5] : v === 'we' ? [0,6] : [0,1,2,3,4,5,6];
const F = {
  async routine(f) {
    const steps = f.steps.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(\S+)\s+(.+)$/); const emoji = m && /\p{Extended_Pictographic}/u.test(m[1]) ? m[1] : '⭐'; return {id: uid().slice(0, 8), emoji, label: (m && emoji !== '⭐' ? m[2] : l).slice(0, 24)}; });
    const old = S.routines.find(x => x.id === f.dataset.id);
    if (old) steps.forEach(st => { const same = (old.steps || []).find(o => o.label === st.label); if (same) st.id = same.id; }); // keep today's ticks
    const row = {household_id: S.hid, name: f.name.value.trim(), emoji: f.emoji.value.trim() || null, member_id: f.who.value || null, starts: f.starts.value || '06:00', ends: f.ends.value || '09:00', days: [0,1,2,3,4,5,6].filter(i => f['d' + i].checked), steps};
    const q = old ? sb.from('routines').update(row).eq('id', old.id).select().single() : sb.from('routines').insert(Object.assign(row, {sort: S.routines.length})).select().single();
    const {data, error} = await q; if (error) return toast("Couldn't save that routine.");
    const i = S.routines.findIndex(x => x.id === data.id); if (i >= 0) S.routines[i] = data; else S.routines.push(data); closeSheet(); render();
  },
  async 'add-chore'(f) {
    const row = {household_id: S.hid, title: f.title.value.trim(), emoji: f.emoji.value.trim() || null, member_id: f.who.value || null, days: daysFrom(f.days.value), stars: Math.max(0, Math.min(10, +f.stars.value || 0)), sort: S.chores.length};
    const {data, error} = await sb.from('chores').insert(row).select().single(); if (error) return toast("Couldn't save that job.");
    if (!S.chores.find(x => x.id === data.id)) S.chores.push(data); render();
  },
  async 'add-reward'(f) {
    const row = {household_id: S.hid, title: f.title.value.trim(), emoji: f.emoji.value.trim() || null, cost: Math.max(1, +f.cost.value || 10), sort: S.rewards.length};
    const {data, error} = await sb.from('rewards').insert(row).select().single(); if (error) return toast("Couldn't save that reward.");
    if (!S.rewards.find(x => x.id === data.id)) S.rewards.push(data); S.rewards.sort((a, b) => a.cost - b.cost); render();
  },
  async 'ai-key'(f) {
    const {error} = await sb.rpc('set_ai_key', {p_household: S.hid, p_key: f.key.value.trim()}); if (error) return toast("Couldn't save the key.");
    S.aiOn = true; S.aiGemini = true; f.key.value = ''; toast('Saved. Testing…'); const r = await callAI({action: 'test'});
    if (r.error) { toast(r.error, 6000); } else { S.aiModel = r.model; toast('Connected ✓ Meals, pantry photos and the brain-dump are ready.', 4000); } render();
  },
  async 'place-save'(f) {
    const id = f.dataset.id, addr = f.location.value.trim(), lat = f.location_lat.value, lon = f.location_lon.value;
    if (id === 'home') {
      if (!addr) return toast('Type your address and pick it from the list.');
      let g = lat ? {lat: +lat, lon: +lon} : geoCache()[addr];
      if (!g) return toast('Pick your address from the list so the map knows where it is.', 4000);
      await saveSettings({location: Object.assign({}, settings().location, {lat: +(+g.lat).toFixed(4), lon: +(+g.lon).toFixed(4), name: 'Home', address: addr, at: new Date().toISOString()})}, true);
      travelTried.clear(); loadWeather(); computeTravel(); closeSheet(); return toast('Home saved. Driving times will update.', 3000);
    }
    const name = f.name.value.trim(); if (!name) return;
    if (addr && lat) rememberGeo(addr, lat, lon);
    const g = lat ? {lat: +lat, lon: +lon} : (addr && geoCache()[addr]) || null, list = (settings().places || []).slice(), i = list.findIndex(p => p.id === id);
    const rec = {id: id || uid(), name, emoji: (f.emoji.value || '📍').trim(), address: addr, lat: g ? g.lat : null, lon: g ? g.lon : null};
    if (i >= 0) list[i] = rec; else list.push(rec);
    await saveSettings({places: list}, true); travelTried.clear(); closeSheet(); toast(`${name} saved`);
  },
  'ev-text'(f) { const t = f.text.value.trim(); if (!t) return; readEvents({text: t}); },
  async 'ev-import-save'(f) {
    const picks = [...f.querySelectorAll('input[name="pick"]:checked')].map(x => +x.value), L = S._evReview || [], cal = f.calendar.value;
    const chosen = picks.map(i => L[i]).filter(Boolean); if (!chosen.length) return toast('Tick at least one event.');
    S._evReview = null; S._evFallback = ''; closeSheet();
    const times = d => { if (d.all_day) return {start: d.day, end: addDaysKey(d.day, 1), sa: d.day + 'T00:00:00Z', ea: addDaysKey(d.day, 1) + 'T00:00:00Z'}; const st = zonedISO(d.day, d.start); let en = d.end ? zonedISO(d.day, d.end) : new Date(new Date(st).getTime() + 3600e3).toISOString(); if (new Date(en) <= new Date(st)) en = new Date(new Date(st).getTime() + 3600e3).toISOString(); return {start: st, end: en, sa: st, ea: en}; };
    if (cal === 'skylike') {
      const rows = chosen.map(d => { const t = times(d); return {id: uid(), household_id: S.hid, title: d.title, starts_at: t.sa, ends_at: t.ea, all_day: d.all_day, location: d.location || null, notes: d.notes || null, member_id: d.who || null, member_ids: d.who ? [d.who] : []}; });
      S.localEvents.push(...rows); render(); if (DEMO) return toast('Sample data: nothing here is saved');
      const {error} = await sb.from('local_events').insert(rows); if (error) { S.localEvents = S.localEvents.filter(r => !rows.includes(r)); render(); return toast("Couldn't add them. Try again.", 4000); }
      return toast(pv('events', rows.length), 3000);
    }
    if (DEMO) return toast('Sample data: nothing is sent to Google.');
    toast(`Adding ${chosen.length} to Google Calendar…`, 3000); let ok = 0, err = '';
    for (const d of chosen) { const t = times(d); const r = await callFn({action: 'create', calendar: cal, title: d.title, start: t.start, end: t.end, allDay: d.all_day, location: d.location || '', description: d.notes || ''}); if (r.error) err = r.error; else ok++; }
    reloadEvents(); toast(err ? `Added ${ok}. One didn't go in: ${err}` : `Added ${ok} event${ok === 1 ? '' : 's'} ✓`, 4500);
  },
  async 'lock-set'(f) {
    const a = f.pin.value.trim(), b = f.pin2.value.trim();
    if (!/^\d{4}$/.test(a)) return toast('The PIN needs 4 numbers.'); if (a !== b) return toast("Those two PINs don't match.");
    const salt = uid(); await saveSettings({lock: {salt, hash: await pinHash(a, salt), at: new Date().toISOString()}}); S.unlockUntil = Date.now() + 5 * 60e3; toast('Grown-up lock on 🔒', 3000);
  },
  async 'or-key'(f) {
    const k = f.key.value.trim(); if (!/^sk-or-/.test(k)) return toast('That doesn\'t look like an OpenRouter key. It starts with sk-or-.', 4000);
    const {error} = await sb.rpc('set_openrouter_key', {p_household: S.hid, p_key: k}); if (error) return toast("Couldn't save the key.");
    S.aiBackup = true; S.aiOn = true; f.key.value = ''; toast('Saved. Testing…'); const r = await callAI({action: 'test'});
    if (r.error || r.backup === 'rejected') toast(r.error || 'OpenRouter didn\'t accept that key. Check it and paste it again.', 6000); else toast('Backup AI on ✓', 3000); render();
  },
  async lunchbox(f) { const lb = {staples: f.staples.value.trim().slice(0, 300), kids: {}}; kids().forEach(k => { lb.kids[k.id] = {likes: (f['likes_' + k.id] || {}).value?.trim().slice(0, 400) || '', nope: (f['nope_' + k.id] || {}).value?.trim().slice(0, 300) || '', days: [...f.querySelectorAll(`input[name="days_${k.id}"]:checked`)].map(i => +i.value)}; });
    await saveSettings({kitchen: {...kset(), lunchbox: lb}}); closeSheet(); toast('Lunchbox favourites saved'); if (S._plan && S._planReopen) { S._planReopen = 0; planSheet(true); } },
  async feedback(f) {
    const fb = S._fb, body = f.body.value.trim(); if (!body) return;
    const btn = f.querySelector('button:not([type])'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    const context = {version: APP_VERSION, view: S.view, device: isPhone() ? 'phone' : 'tablet', screen: innerWidth + 'x' + innerHeight, ua: navigator.userAgent.slice(0, 160), standalone: matchMedia('(display-mode: standalone)').matches, lastError: S._lastErr || null};
    if (DEMO) { closeSheet(); return toast('Feedback is off in the sample.'); }
    let shot = null;
    if (fb.shot) { try { const path = `${S.hid}/feedback/${uid()}.jpg`; const up = await sb.storage.from('photos').upload(path, fb.shot, {contentType: 'image/jpeg'}); if (!up.error) shot = path; } catch {} }
    const me = meMember();
    const {error} = await sb.from('feedback').insert({household_id: S.hid, member_id: me ? me.id : null, module: fb.module, kind: fb.kind, body: body.slice(0, 2000), screenshot: shot, context});
    if (error) { if (btn) { btn.disabled = false; btn.textContent = 'Send'; } return toast("Couldn't send that. Check your connection and try again.", 4500); }
    S._fb = null; closeSheet(); toast('Thanks! Your feedback has been sent.', 3500);
  },
  async 'ev-save'(f) {
    smartFill(f);
    const id = f.dataset.id, title = f.title.value.trim(), day = f.day.value, allDay = f.allday.checked; if (!title || !day) return;
    let start, end;
    if (allDay) { start = day; end = addDaysKey(day, 1); }
    else { start = zonedISO(day, f.start.value || '09:00'); end = zonedISO(day, f.end.value || f.start.value || '10:00'); if (new Date(end) <= new Date(start)) end = new Date(new Date(start).getTime() + 3600e3).toISOString(); }
    const location = f.location.value.trim(), whoIds = f.who && f.who.value ? f.who.value.split(',').filter(Boolean) : [], who = whoIds[0] || null, notes = f.notes ? f.notes.value.trim() || null : null;
    if (location && f.location_lat && f.location_lat.value) rememberGeo(location, f.location_lat.value, f.location_lon.value);
    const sa = allDay ? start + 'T00:00:00Z' : start, ea = allDay ? end + 'T00:00:00Z' : end;
    closeSheet();
    const R = repeatFrom(f);
    if (id && id.includes('@') && id.startsWith('L-')) { const ev = evById(id), r = rowOfLocalId(id); if (!r || !ev) return;
      if ((f.querySelector('[name="scope"]:checked') || {}).value !== 'all') { // just this one: skip it in the series, save a one-off copy
        r.repeat = Object.assign({}, r.repeat, {skip: (r.repeat.skip || []).concat(ev.occ)});
        const c = {id: uid(), _new: true, household_id: S.hid, title, location: location || null, all_day: allDay, starts_at: sa, ends_at: ea, member_id: who, member_ids: whoIds, notes, repeat: null};
        S.localEvents.push(c); render(); saveLocalEvent(r, null); return saveLocalEvent(c, {drop: true}); }
      // every one: keep the series' first date (moved by however many days this one moved), take the new times and details
      const shift = daysBetween(ev.occ, day), sk = addDaysKey(startKeyOf(r), shift), old = {s: r.starts_at, e2: r.ends_at};
      const ns = allDay ? sk + 'T00:00:00Z' : zonedISO(sk, f.start.value || '09:00'), ne = new Date(new Date(ns).getTime() + (new Date(ea) - new Date(sa))).toISOString();
      Object.assign(r, {title, location: location || null, all_day: allDay, starts_at: ns, ends_at: ne, member_id: who, member_ids: whoIds, notes, repeat: R ? Object.assign({}, R, {skip: (r.repeat && r.repeat.skip) || []}) : null});
      render(); return saveLocalEvent(r, old); }
    if (id && id.startsWith('L-')) { const r = S.localEvents.find(x => x.id === id.slice(2)); if (!r) return; r.repeat = R; const old = {s: r.starts_at, e2: r.ends_at}; Object.assign(r, {title, location: location || null, all_day: allDay, starts_at: sa, ends_at: ea, member_id: who, member_ids: whoIds, notes}); render(); return saveLocalEvent(r, old); }
    if (!id && f.calendar && f.calendar.value === 'skylike') { const r = {id: uid(), _new: true, household_id: S.hid, title, location: location || null, all_day: allDay, starts_at: sa, ends_at: ea, member_id: who, member_ids: whoIds, notes, repeat: R, created_at: new Date().toISOString()};
      S.localEvents.push(r); render(); if (S._evReview && S._evReview.length) setTimeout(nextDraft, 350); return saveLocalEvent(r, {drop: true}); }
    if (id) { const e = S.events.find(x => x.id === id); if (!e) return; const old = Object.assign({}, e);
      Object.assign(e, {title, location: location || null, all_day: allDay, starts_at: allDay ? start + 'T00:00:00Z' : start, ends_at: allDay ? end + 'T00:00:00Z' : end}); render();
      calWrite({action: 'update', id, title, start, end, allDay, location}, () => Object.assign(e, old)); }
    else { const cal = S.calendars.find(c => c.id === f.calendar.value), tmp = {id: 'tmp-' + uid(), household_id: S.hid, calendar_id: cal ? cal.google_id : '', event_id: 'tmp', title, location: location || null, all_day: allDay, starts_at: allDay ? start + 'T00:00:00Z' : start, ends_at: allDay ? end + 'T00:00:00Z' : end};
      S.events.push(tmp); render(); calWrite({action: 'create', calendar: f.calendar.value, title, start, end, allDay, location, ...(R ? {repeat: JSON.stringify(R)} : {})}, () => { S.events = S.events.filter(x => x !== tmp); }); if (S._evReview && S._evReview.length) setTimeout(nextDraft, 350); }
  },
  async fquick(f) {
    const raw0 = f.text.value.trim(); if (!raw0) return;
    if (!S._fqForce && looksLikeAppointment(raw0) && !parseAssignee(raw0).who && !/^(buy|get|pick up|grab|call|ring|email|text|pay|book|order|remind)\b/i.test(raw0)) {
      const P = parseEventText(raw0);
      if (P.start || P.day || P.all_day) { f.text.value = ''; S._fqLast = {kind: 'event', text: raw0, at: Date.now()}; S._evDraft = {title: raw0}; eventForm(null); setTimeout(() => { const ef = document.querySelector('#sheet-root form.evform'); if (ef) smartFill(ef); }, 60); return; }
      if (S.aiOn && !DEMO) { f.text.value = ''; return readEvents({text: raw0}, raw0); }
    }
    const A2 = parseAssignee(raw0), raw = A2.text, kind = A2.who ? 'todo' : guessKind(raw), me = meMember(), l = listByKind(kind); if (!l) return;
    const parts = kind === 'grocery' ? raw.replace(/^(buy|get|pick up|grab|need)\s+/i, '').split(/,| and /).map(x => x.trim()).filter(Boolean) : [raw];
    const rows = parts.map((text, i) => ({id: uid(), household_id: S.hid, list_id: l.id, text: text.charAt(0).toUpperCase() + text.slice(1, 200), added_by: me ? me.id : null, assignee: A2.who ? A2.who.id : null, sort: Date.now() / 1000 + i, done: false, created_at: new Date().toISOString()}));
    S.items.push(...rows); S._fqLast = {ids: rows.map(r => r.id), text: rows.map(r => r.text).join(', '), kind, who: A2.who && (!me || A2.who.id !== me.id) ? A2.who.name : null, at: Date.now()}; f.text.value = ''; render();
    const inp = $('#fq'); if (inp) inp.focus(); setTimeout(() => { if (S._fqLast && Date.now() - S._fqLast.at >= 15000 && ['focus', 'planner', 'family'].includes(S.view)) render(); }, 15500);
    if (!DEMO) await db(sb.from('list_items').insert(rows));
  },
  async kitchen(f) { await saveSettings({kitchen: {...kset(), shopDay: f.shopday.value === '' ? null : +f.shopday.value, prefs: f.prefs.value.trim().slice(0, 600), servings: Math.max(1, +f.servings.value || 4), budget: Math.max(0, +f.budget.value || 0)}}); toast('Saved'); },
  async 'meal-set'(f) {
    const k = f.dataset.k, title = f.title.value.trim(); f.querySelector('button').disabled = true;
    let row = {household_id: S.hid, day: k, slot: 'dinner', title, url: recipeLink(title), ingredients: []};
    if (S.aiOn) { const r = await callAI({action: 'recipe', title, servings: kset().servings}); if (!r.error) row = Object.assign(row, {emoji: r.emoji || null, ingredients: (r.ingredients || []).slice(0, 25), est_cost: +r.est_cost || null}); }
    const {data, error} = await sb.from('meals').upsert(row, {onConflict: 'household_id,day,slot'}).select().single(); if (error) return toast("Couldn't save that dinner.");
    S.meals = S.meals.filter(m => !(m.day === k && (m.slot || 'dinner') === 'dinner')).concat(data); closeSheet(); render(); mealSheet(k);
  },
  async 'left-new'(f) { const n = +(f.querySelector('input[name=n]:checked') || {}).value || 2, t = f.name.value.trim(); closeSheet(); await pantryAdd([{name: /^leftover/i.test(t) ? t : 'Leftover ' + t, place: 'fridge', leftover: true, portions: n}]); },
  async 'pantry-add'(f) {
    const names = f.name.value.split(/,|\n| and /).map(x => x.trim()).filter(Boolean); if (!names.length) return;
    f.name.value = ''; await pantryAdd(names.map(n => ({name: n, place: f.place.value || undefined})));
  },
  async 'brain-dump'(f) {
    const out = $('#bd-out'), btn = f.querySelector('button'); btn.disabled = true; btn.innerHTML = `${icon('sparkle')}Sorting…`;
    const r = await callAI({action: 'groceries', text: f.text.value, existing: listItems(f.dataset.list, false).map(i => i.text)});
    btn.disabled = false; btn.innerHTML = `${icon('sparkle')}Sort it`;
    if (r.error) return toast(r.error, 4500);
    const byAisle = {}; (r.items || []).forEach(x => (byAisle[x.aisle || 'Other'] = byAisle[x.aisle || 'Other'] || []).push(x));
    out.innerHTML = `<div class="bd">${Object.entries(byAisle).map(([a, xs]) => `<div class="kt">${esc(a)}</div>${xs.map(x => { const t = x.qty ? `${x.name} · ${x.qty}` : x.name; return `<label class="row bdrow"><input type="checkbox" value="${esc(t)}" checked> ${esc(x.name)}${x.qty ? ` <span class="lbl">${esc(x.qty)}</span>` : ''}</label>`; }).join('')}`).join('')}</div>
      <button class="btn" style="margin-top:12px" data-act="bd-add" data-list="${f.dataset.list}">Add to Groceries</button>`;
  },
  async 'add-bring'(f) {
    const days = [0,1,2,3,4,5,6].filter(i => f['d' + i].checked), match = f.match.value.trim() || null;
    if (!days.length && !match) return toast('Pick some days, or a word from the calendar.', 3500);
    const row = {household_id: S.hid, title: f.title.value.trim(), emoji: f.emoji.value.trim() || null, member_id: f.who.value || null, days, match};
    const {data, error} = await sb.from('bring_rules').insert(row).select().single(); if (error) return toast("Couldn't save that.");
    if (!S.bringRules.find(x => x.id === data.id)) S.bringRules.push(data); render();
  },
  async pocket(f) { await saveSettings({pocket: {on: f.on.checked, perStar: Math.max(0, +f.per.value || 0)}}); toast('Saved'); },
  async 'otp-email'(f) {
    const email = f.email.value.trim(); f.querySelector('button').disabled = true;
    const {error} = await sb.auth.signInWithOtp({email, options: {shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname}});
    if (error) { f.querySelector('button').disabled = false; return gateErr(error.message.includes('rate') ? 'Too many tries. Wait a few minutes and try again.' : error.message); }
    S._otpEmail = email; renderGate();
  },
  async 'otp-code'(f) {
    const {error} = await sb.auth.verifyOtp({email: S._otpEmail, token: f.code.value.trim(), type: 'email'});
    if (error) return gateErr("That code didn't work. Check it, or send a new one.");
  },
  async 'create-hh'(f) {
    const {data, error} = await sb.rpc('create_household', {p_name: f.name.value.trim(), p_member_name: f.me.value.trim()});
    if (error) return gateErr(error.message);
    S.hid = data; LS.set('hid', data); await start();
  },
  async 'join-hh'(f) {
    const {data, error} = await sb.rpc('join_household', {p_code: f.code.value.trim(), p_member_name: f.me.value.trim()});
    if (error) return gateErr(error.message.includes('match') ? "That code didn't match a household." : error.message);
    if (!data) return gateErr("That code didn't match a household. Check it with whoever sent it: it's 10 letters and numbers.");
    S.hid = data; LS.set('hid', data); await start();
  },
  async 'add-item'(f) {
    const text = f.text.value.trim(); if (!text || !f.dataset.list) return;
    const row = {id: uid(), household_id: S.hid, list_id: f.dataset.list, text, added_by: (meMember() || {}).id || null, sort: Date.now() / 1000, done: false, created_at: new Date().toISOString()};
    S.items.push(row); f.text.value = ''; bumpHistory(row.list_id, text); render();
    await db(sb.from('list_items').insert(row));
  },
  async 'new-list'(f) { const row = {id: uid(), household_id: S.hid, name: f.name.value.trim(), kind: 'custom', sort: S.lists.length}; S.lists.push(row); S.listId = row.id; closeSheet(); render(); await db(sb.from('lists').insert(row)); },
  async capture(f) {
    const text = f.text.value.trim(); if (!text) return; const kind = f.kind.value, me = meMember();
    closeSheet();
    if (kind === 'note') { const row = {id: uid(), household_id: S.hid, text, color: f.color.value, author_id: me ? me.id : null, created_at: new Date().toISOString()}; S.notes.unshift(row); render(); await db(sb.from('notes').insert(row)); toast('Note added'); }
    else { const l = listByKind(kind); if (!l) return; const row = {id: uid(), household_id: S.hid, list_id: l.id, text: text.slice(0, 200), added_by: me ? me.id : null, sort: Date.now() / 1000, done: false, created_at: new Date().toISOString()}; S.items.push(row); bumpHistory(l.id, row.text); render(); await db(sb.from('list_items').insert(row)); toast(`Added to ${l.name}`); }
  },
  async member(f) {
    const id = f.dataset.id, row = {name: f.name.value.trim(), emoji: f.emoji.value.trim() || null, color: f.color.value, kind: f.kind.value, home_view: f.kind.value === 'kid' ? 'family' : f.home_view.value};
    closeSheet();
    if (id) { Object.assign(memberById(id), row); render(); await db(sb.from('members').update(row).eq('id', id)); }
    else { const full = Object.assign({id: uid(), household_id: S.hid, sort: S.members.length}, row); S.members.push(full); render(); await db(sb.from('members').insert(full)); }
  },
  async 'hh-name'(f) { S.household.name = f.name.value.trim(); await db(sb.from('households').update({name: S.household.name}).eq('id', S.hid)); toast('Saved'); },
  async bridge(f) {
    const key = LS.get('pendingKey:' + S.hid, null);
    if (!key) return toast('Tap Copy script first, so the script and this screen share a secret key.', 4000);
    const {error} = await sb.rpc('set_calendar_bridge', {p_household: S.hid, p_url: f.url.value.trim(), p_key: key});
    if (error) return toast(error.message, 4000);
    toast('Checking the connection…');
    const r = await callFn({action: 'test'});
    if (r.error) { toast('Not working yet: ' + r.error, 5000); return refreshCalStatus(); }
    LS.set('pendingKey:' + S.hid, null);
    const {data} = await sb.from('calendars').select('*').eq('household_id', S.hid); if (data) S.calendars = data;
    const s = await callFn({action: 'sync'});
    toast(s.error ? 'Connected, but sync failed: ' + s.error : `Connected · ${s.events ?? 0} events`, 4000);
    refreshCalStatus();
  },
  async 'add-feed'(f) {
    const url = f.url.value.trim(), name = f.name.value.trim();
    if (!/^(https|webcal):\/\//.test(url)) return toast('Paste the full link, starting with https://', 4000);
    f.querySelector('button').disabled = true;
    const {error} = await sb.rpc('add_calendar_feed', {p_household: S.hid, p_url: url, p_name: name});
    f.querySelector('button').disabled = false;
    if (error) return toast(error.message, 4000);
    f.reset(); toast('Added. Fetching events…');
    const {data} = await sb.from('calendars').select('*').eq('household_id', S.hid); if (data) S.calendars = data;
    render();
    const r = await callFn({action: 'sync'});
    toast(r.error ? 'Added, but: ' + r.error : `Calendar added · ${r.events ?? 0} events`, 4500);
    const ev = await sb.from('events_cache').select('*').eq('household_id', S.hid).gte('ends_at', new Date(Date.now() - 3 * 864e5).toISOString()).order('starts_at');
    if (ev.data) S.events = ev.data;
    refreshCalStatus(); render();
  },
  async 'add-reminder'(f) {
    const row = {household_id: S.hid, title: f.title.value.trim(), color: f.color.value, weekday: +f.weekday.value, every_weeks: +f.every.value, anchor_date: f.anchor.value || null, show_day_before: true};
    if (row.every_weeks > 1 && !row.anchor_date) return toast('For fortnightly bins, pick the date of the next collection.', 4000);
    if (row.anchor_date) row.weekday = weekdayOfKey(row.anchor_date); // the date decides the day, so they can't disagree
    const {data, error} = await sb.from('reminders').insert(row).select().single(); if (error) return toast("Couldn't save that.");
    if (!S.reminders.find(r => r.id === data.id)) S.reminders.push(data); render();
  },
  async 'add-countdown'(f) { const {data, error} = await sb.from('countdowns').insert({household_id: S.hid, title: f.title.value.trim(), date: f.date.value}).select().single(); if (error) return toast("Couldn't save that."); if (!S.countdowns.find(c => c.id === data.id)) S.countdowns.push(data); render(); },
  async sitter(f) {
    const lines = v => v.split('\n').map(l => l.split(',').map(s => s.trim())).filter(a => a[0]);
    const contacts = lines(f.contacts.value).map(a => ({name: a[0], role: a.length > 2 ? a[1] : '', phone: a[a.length - 1] || ''}));
    const bedtimes = lines(f.bedtimes.value).map(a => ({name: a[0], time: a[1] || ''}));
    await saveSettings({sitter: {contacts, bedtimes, wifi: {name: f.wifiName.value.trim(), password: f.wifiPass.value}, notes: f.notes.value.trim()}});
  },
  async device(f) { LS.set('deviceName', f.name.value.trim() || 'Screen'); LS.set('deviceKind', f.kind.value); heartbeat(); keepAwake(); toast('Saved'); render(); },
  async night(f) { await saveSettings({night: {start: f.start.value || '20:30', end: f.end.value || '06:00', sleep: !!(f.sleep && f.sleep.checked)}}); toast('Saved'); },
  async daytime(f) { const s = settings(); await saveSettings({saver: Object.assign({}, s.saver, {after: +f.after.value || 5, clockMins: +f.clockMins.value || 10, photoMins: +f.photoMins.value || 5}), idleReturn: +f.idle.value || 3, leaveBuffer: +f.buffer.value || 0}); }
};

/* drag a meal to another day (dinners and lunches); press-and-hold on touch, drag with a mouse */
let drag = null, dragEnd = 0;
function moveMeal(slot, from, to) {
  const a = mealOn(from, slot), b = mealOn(to, slot); if (!a || from === to) return;
  a.day = to; if (b) b.day = from; render();
  const name = slot === 'lunch' ? 'Lunchbox' : (a.leftovers_of ? 'Leftovers night' : a.title);
  toast(`${b ? 'Swapped' : 'Moved'}: ${name} → ${fmtDay(to, {weekday: 'long'})}`);
  if (DEMO) return;
  (async () => {
    if (b) await db(sb.from('meals').update({day: '2099-12-31'}).eq('id', b.id)); // dodge the one-per-day rule mid-swap
    await db(sb.from('meals').update({day: to}).eq('id', a.id));
    if (b) await db(sb.from('meals').update({day: from}).eq('id', b.id));
  })();
}
function dragStart() {
  const c = drag.c, r = c.getBoundingClientRect();
  drag.on = true; drag.dx = drag.x - r.left; drag.dy = drag.y - r.top;
  const g = c.cloneNode(true); g.classList.add('drag-ghost'); g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
  document.body.appendChild(g); drag.g = g; c.classList.add('drag-src'); document.body.classList.add('dragging'); document.body.dataset.drag = drag.slot;
  dragMove(drag.x, drag.y); if (navigator.vibrate) navigator.vibrate(12);
}
function dragMove(x, y) {
  drag.g.style.transform = `translate(${x - drag.dx}px,${y - drag.dy}px) rotate(-2deg)`;
  const el = document.elementFromPoint(x, y), t = el && el.closest(drag.slot === 'ev' ? '.week .day[data-k]' : drag.slot === 'pev' ? '.ppcol[data-m]' : `.mday[data-slot="${drag.slot}"]`);
  if (drag.t2 !== t) { if (drag.t2) drag.t2.classList.remove('drop-on'); if (t && t !== drag.c) t.classList.add('drop-on'); drag.t2 = t; }
}
function dragStop(commit) {
  if (!drag) return; clearTimeout(drag.timer);
  if (drag.on) {
    dragEnd = Date.now(); const t = drag.t2, from = drag.c.dataset.k;
    drag.g.remove(); drag.c.classList.remove('drag-src'); if (t) t.classList.remove('drop-on'); document.body.classList.remove('dragging');
    if (commit && t && t !== drag.c) { if (drag.slot === 'ev') moveEventToDay(drag.c.dataset.ev, t.dataset.k); else if (drag.slot === 'pev') { const id = drag.c.dataset.ev, mid = t.dataset.m, fromM = (drag.c.closest('.ppcol') || {dataset: {}}).dataset.m || '';
      if (fromM !== mid) { const cur = eventMembers(evById(id)).map(m => m.id), ids = mid ? cur.filter(x => x !== fromM && x !== mid).concat(mid) : [];
        const go = () => { setEventPeople(id, {for: ids}); const who = memberById(mid); toast(`${(evById(id) || {}).title || 'Event'} → ${who ? andList(ids.map(x => memberById(x).name)) : 'Everyone'}`); };
        if (!unlocked()) askPin(go); else go(); } } else moveMeal(drag.slot, from, t.dataset.k); }
  }
  drag = null;
}
document.addEventListener('pointerdown', e => {
  const pe = e.target.closest('.pev[data-ev]');
  if (pe && e.button <= 0) { drag = {c: pe, slot: 'pev', x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== 'mouse'}; if (drag.touch) drag.timer = setTimeout(() => drag && !drag.on && dragStart(), 320); return; }
  const ce = e.target.closest('.wev[data-ev]');
  if (ce && e.button <= 0) { drag = {c: ce, slot: 'ev', x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== 'mouse'}; if (drag.touch) drag.timer = setTimeout(() => drag && !drag.on && dragStart(), 320); return; }
  const c = e.target.closest('.mday[data-slot]'); if (!c || e.button > 0 || !mealOn(c.dataset.k, c.dataset.slot)) return;
  drag = {c, slot: c.dataset.slot, x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== 'mouse'};
  if (drag.touch) drag.timer = setTimeout(() => drag && !drag.on && dragStart(), 320);
});
document.addEventListener('pointermove', e => {
  if (!drag) return; const far = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
  if (!drag.on) { if (drag.touch) { if (far > 10) dragStop(false); } else if (far > 6) { dragStart(); } return; }
  e.preventDefault(); dragMove(e.clientX, e.clientY);
});
document.addEventListener('touchmove', e => { if (drag && drag.on) e.preventDefault(); }, {passive: false}); // hold the page still while dragging
document.addEventListener('pointerup', () => dragStop(true));
document.addEventListener('pointercancel', () => dragStop(false));
document.addEventListener('contextmenu', e => { if (e.target.closest('.mday[data-slot], .wev[data-ev]')) e.preventDefault(); });

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  if (Date.now() - dragEnd < 450 && el.closest('.mday, .wev, .pev')) return; // the tap that ended a drag
  const fn = A[el.dataset.act]; if (fn) { if (el.tagName === 'BUTTON' && el.type !== 'submit') e.preventDefault(); if (needsPin(el.dataset.act, el)) return askPin(() => fn(el, e)); fn(el, e); }
});
document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); const fn = F[f.dataset.form]; if (fn) fn(f); });
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.act === 'cal-member') { const c = S.calendars.find(x => x.id === el.dataset.id); c.member_id = el.value || null; render(); await db(sb.from('calendars').update({member_id: c.member_id}).eq('id', c.id)); }
  if (el.dataset.act === 'upload') uploadPhotos(el.files);
  if (el.dataset.change === 'pantry-photo' && el.files && el.files.length) {
    const files = [...el.files], place = el.dataset.place; el.value = '';
    if (!S.aiOn) { closeSheet(); return toast('Add a free Gemini key in Settings → Kitchen first.', 4000); }
    // A scan session covers several photos (shelves, then each door). Photos are read in the background while you
    // keep taking them; only once you say you're done do we compare with the last snapshot.
    if (!S.scanSess || S.scanSess.place !== place) S.scanSess = {place, seen: [], before: S.pantry.filter(p => p.place === place && !p.leftover).map(p => p.id), taken: 0, read: 0, failed: 0, found: 0, added: 0, imgs: [], chain: Promise.resolve(), done: false};
    const SS = S.scanSess; SS.taken += files.length;
    // shrink each photo now (fast, on the phone); they're all sent to the AI together when you tap That's everything
    files.forEach(f => { SS.chain = SS.chain.then(() => photoToBase64(f).then(d => SS.imgs.push(d)).catch(() => { SS.failed++; toast("Couldn't open one of the photos. Try taking it again.", 4000); })); });
    scanMoreSheet();
  }
  if (el.dataset.change === 'fb-shot' && el.files && el.files[0]) { const b = $('#fb-body'); if (b) S._fb.body = b.value; try { S._fb.shot = await shrink(el.files[0], 1600); } catch { toast("Couldn't open that image."); } feedbackSheet(); }
  if (el.dataset.change === 'push-pref' && S._push && S._push.row) { const prefs = Object.assign({}, S._push.row.prefs, {[el.dataset.k]: el.checked}); S._push.row.prefs = prefs; await db(sb.from('push_subscriptions').update({prefs}).eq('id', S._push.row.id)); }
  if (el.dataset.change === 'avatar-pick' && el.files && el.files[0]) { const f0 = el.files[0]; el.value = ''; return cropSheet(f0, el.dataset.id); }
  if (el.dataset.change === 'ev-photo' && el.files && el.files.length) { const files = [...el.files].slice(0, 4); el.value = ''; try { const imgs = await Promise.all(files.map(photoToBase64)); readEvents({images: imgs}); } catch { toast("Couldn't open that photo. Try again.", 4000); } return; }
  if (el.dataset.change === 'ev-smart') { smartFill(el.form); return; }
  if (el.dataset.change === 'rep-toggle') { const box = el.form.querySelector('.repbox'); box.hidden = !el.checked; repRefresh(el.form); return; }
  if (el.dataset.change === 'rep-refresh') { repRefresh(el.form); return; }
  if (el.dataset.change === 'ev-start') { const f = el.closest('form'), en = f.end, toM = v => { const [h, m] = String(v || '').split(':').map(Number); return h * 60 + m; }, fromM = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
    if (el.value) { let dur = toM(en.value) - toM(el.dataset.prev); if (!(dur > 0)) dur = 60; en.value = fromM(Math.min(23 * 60 + 59, toM(el.value) + dur)); el.dataset.prev = el.value; } return; }
  if (el.dataset.change === 'ev-cal') { const w = el.closest('form').querySelector('.evwho'); if (w) w.hidden = el.value !== 'skylike'; return; }
  if (el.dataset.change === 'lock-here') { LS.set('lockHere', el.checked); toast(el.checked ? 'This screen will ask for the PIN' : 'This screen won\'t ask for the PIN'); return; }
  if (el.dataset.change === 'ev-allday') { const t = el.closest('form').querySelector('.evtimes'); if (t) t.hidden = el.checked; }
  if (el.dataset.act === 'album-pick') {
    if (el.value === '__new') { const n = (prompt('Name the new album (e.g. Holidays, Christmas)') || '').trim().slice(0, 40); if (n) S.uploadAlbum = n; }
    else S.uploadAlbum = el.value;
    render();
  }
});

function scanFinish(SS) {
  if (S.scanSess === SS) S.scanSess = null; S.scanning = null; render(); if (!SS.read) return;
  const seenTxt = [...new Set(SS.seen)].slice(0, 8).join(', ');
  toast(`${SS.read} photo${SS.read === 1 ? '' : 's'}: spotted ${SS.found ? seenTxt + (SS.found > 8 ? '…' : '') : 'nothing it could name'}${SS.found ? (SS.added ? ` (${SS.added} new)` : ' (all already listed)') : '. Try closer, with the lights on.'}`, 6000);
  if (SS.failed) return; // a photo didn't read, so don't suggest removing things that may have been in it
  const miss = S.pantry.filter(p => SS.before.includes(p.id) && !SS.seen.some(n => sameFood(n, p.name)));
  const thin = SS.before.length >= 3 && SS.found < SS.before.length / 2; // the photos probably didn't show everything
  if (miss.length) sheet(`<h2>Not in your photos</h2><p class="help">${thin ? `It only spotted ${SS.found} thing${SS.found === 1 ? '' : 's'} this time, against ${SS.before.length} last time, so the photo${SS.read === 1 ? '' : 's'} may not have shown everything (drawers, frosty bags). Only tick what you know has gone.` : `These were in the last ${esc(SS.place)} snapshot but weren't spotted in any of the ${SS.read} photo${SS.read === 1 ? '' : 's'}. Tick the ones that have gone.`}</p><div id="snap-miss" class="bd">${miss.map(p => `<label class="row bdrow"><input type="checkbox" value="${p.id}"> ${esc(p.name)}</label>`).join('')}</div><div class="row" style="margin-top:14px"><button class="btn" data-act="snap-remove">Remove ticked</button><button class="btn ghost" data-act="close-sheet">Keep them all</button></div>`, {focus: false});
}
function scanMoreSheet(refresh) {
  const SS = S.scanSess; if (!SS || SS.done) return;
  if (refresh && !document.querySelector('#scan-more')) return; // only update it if it's still open
  const pl = SS.place;
  sheet(`<div id="scan-more"><h2>${SS.taken} photo${SS.taken === 1 ? '' : 's'} of the ${esc(pl)}</h2>
    <p class="help">Keep snapping, no waiting. They're all read together when you tap <b>That's everything</b>.${SS.failed ? ` ${SS.failed} couldn't be opened, take ${SS.failed === 1 ? 'it' : 'them'} again.` : ''} ${pl === 'fridge' ? 'Got the doors and drawers too?' : 'Anything else to add?'}</p>
    <div class="scanpick"><label class="btn ghost">${icon('camera')} Take another photo<input type="file" accept="image/*" capture="environment" data-change="pantry-photo" data-place="${pl}" hidden></label>
    <label class="btn ghost">Choose from photos<input type="file" accept="image/*" multiple data-change="pantry-photo" data-place="${pl}" hidden></label>
    <button class="btn" data-act="scan-done">That's everything, read ${SS.taken === 1 ? 'it' : `all ${SS.taken}`}</button></div></div>`, {focus: false, keepScroll: true});
}
/* photos */
async function uploadPhotos(files) {
  const me = meMember(); let n = 0; const album = (S.uploadAlbum || photoAlbums()[0] || 'Family').slice(0, 40);
  toast(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}…`);
  for (const file of files) {
    try {
      const blob = await shrink(file, 1920);
      const path = `${S.hid}/${uid()}.jpg`;
      const up = await sb.storage.from('photos').upload(path, blob, {contentType: 'image/jpeg'});
      if (up.error) throw up.error;
      const {data} = await sb.from('photos').insert({household_id: S.hid, path, album, uploaded_by: me ? me.id : null}).select().single();
      if (data && !S.photos.find(p => p.id === data.id)) S.photos.unshift(data); n++;
    } catch (err) { console.error(err); }
  }
  toast(n ? `${n} photo${n > 1 ? 's' : ''} added` : "Couldn't upload those photos."); render();
}
function shrink(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => b ? res(b) : rej(), 'image/jpeg', .85); URL.revokeObjectURL(img.src);
    }; img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}
function photoAlbums() { return [...new Set(S.photos.map(p => p.album || 'Family'))].sort(); }
async function loadThumbs() {
  const els = document.querySelectorAll('.thumbs'); if (!els.length || !S.photos.length) return;
  const {data} = await sb.storage.from('photos').createSignedUrls(S.photos.map(p => p.path), 600);
  const url = {}; (data || []).forEach((d, i) => { if (d.signedUrl) url[S.photos[i].id] = d.signedUrl; });
  els.forEach(el => { el.innerHTML = S.photos.filter(p => (p.album || 'Family') === el.dataset.album && url[p.id]).map(p => `<div style="position:relative"><img src="${esc(url[p.id])}" alt="" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;display:block"><button class="icon-btn" style="position:absolute;right:6px;top:6px;width:38px;height:38px" data-act="del-photo" data-id="${p.id}" aria-label="Delete photo">${icon('trash')}</button></div>`).join(''); });
}
A['album-toggle'] = async el => { const a = el.dataset.album, off = (settings().saverOff || []).slice(); const i = off.indexOf(a); if (i >= 0) off.splice(i, 1); else off.push(a); await saveSettings({saverOff: off}); };
A['del-photo'] = async el => { const p = S.photos.find(x => x.id === el.dataset.id); if (!p || !confirm('Delete this photo?')) return; S.photos = S.photos.filter(x => x.id !== p.id); render(); await sb.storage.from('photos').remove([p.path]); await db(sb.from('photos').delete().eq('id', p.id)); };

