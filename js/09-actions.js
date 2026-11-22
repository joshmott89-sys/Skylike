// Skylike: actions. Part 9 of 11; all parts share one global scope and load in order (index.html).
/* ----- actions ----- */
async function saveSettings(patch, quiet) {
  const next = Object.assign({}, S.household.settings || {}, patch);
  S.household.settings = next; render();
  const {error} = await sb.from('households').update({settings: next}).eq('id', S.hid);
  if (error) toast("Couldn't save that. Check the connection."); else if (!quiet) toast('Saved');
}
async function db(op, msg) { const {error} = await op; if (error) { console.error(error); toast(msg || "Couldn't save that. Check the connection."); return false; } return true; }

const A = {
  async 'forget-device'(el) { S.devices = S.devices.filter(d => d.id !== el.dataset.id); render(); await db(sb.from('devices').delete().eq('id', el.dataset.id)); },
  async 'kid-step'(el) {
    const kid = memberById(el.dataset.kid), r = S.routines.find(x => x.id === el.dataset.r), k = dayKey(new Date()); if (!kid || !r) return;
    const ref = r.id + ':' + el.dataset.s, had = tickOf(kid, 'step', ref, k);
    await toggleTick(kid, 'step', ref, k, 0, had);
    const all = (r.steps || []).every(st => tickOf(kid, 'step', r.id + ':' + st.id, k)), bonus = tickOf(kid, 'step', 'done:' + r.id, k);
    if (all && !bonus) { await toggleTick(kid, 'step', 'done:' + r.id, k, 1, null); cheer(el, true); }
    else if (!all && bonus) await toggleTick(kid, 'step', 'done:' + r.id, k, 1, bonus);
    else if (!had) cheer(el);
  },
  async 'kid-chore'(el) {
    const kid = memberById(el.dataset.kid), c = S.chores.find(x => x.id === el.dataset.c), k = dayKey(new Date()); if (!kid || !c) return;
    const had = tickOf(kid, 'chore', c.id, k); await toggleTick(kid, 'chore', c.id, k, c.stars, had); if (!had) cheer(el, c.stars > 0);
  },
  'kid-rewards'(el) {
    const kid = memberById(el.dataset.id), stars = starsOf(kid);
    sheet(`<h2>${esc(kid.name)}'s stars: <span class="num">${stars}</span></h2>${moneyOf(kid) ? `<p class="help num">Worth ${moneyOf(kid)} in pocket money.</p>` : ''}
      ${S.rewards.length ? S.rewards.map(w => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><span style="font-size:34px;line-height:0">${kart(w.emoji || '🎁', w.title, 'sx')}</span><div class="grow"><b>${esc(w.title)}</b><div class="lbl num">${w.cost} stars</div></div><button class="btn ${stars >= w.cost ? '' : 'soft'}" data-act="redeem" data-kid="${kid.id}" data-id="${w.id}" ${stars >= w.cost ? '' : 'disabled'}>${stars >= w.cost ? 'Spend' : `${w.cost - stars} to go`}</button></div>`).join('') : '<p class="help">No rewards yet. Add some in Settings → Kids.</p>'}
      <button class="btn ghost" style="margin-top:14px" data-act="close-sheet">Close</button>`);
  },
  async redeem(el) {
    const kid = memberById(el.dataset.kid), w = S.rewards.find(x => x.id === el.dataset.id); if (!kid || !w || starsOf(kid) < w.cost) return;
    S.balances[kid.id] = starsOf(kid) - w.cost; closeSheet(); render(); toast(`${w.emoji || '🎁'} ${kid.name} spent ${w.cost} stars on ${w.title}`, 3500);
    await db(sb.from('star_ledger').insert({household_id: S.hid, member_id: kid.id, delta: -w.cost, reason: 'Reward: ' + w.title})); loadBalances();
  },
  async 'star-adj'(el) { const d = +el.dataset.d; S.balances[el.dataset.id] = (S.balances[el.dataset.id] || 0) + d; render(); await db(sb.from('star_ledger').insert({household_id: S.hid, member_id: el.dataset.id, delta: d, reason: d > 0 ? 'Bonus star' : 'Star taken'})); loadBalances(); },
  'edit-routine'(el) {
    const r = S.routines.find(x => x.id === el.dataset.id) || {name: '', emoji: '', starts: '06:30', ends: '09:00', days: [0,1,2,3,4,5,6], steps: [], member_id: null};
    const ks = kids(), D = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    sheet(`<h2>${r.id ? 'Edit routine' : 'New routine'}</h2><form data-form="routine" data-id="${r.id || ''}">
      <div class="row"><input class="input" name="emoji" value="${esc(r.emoji || '')}" placeholder="🌅" maxlength="4" style="width:70px;text-align:center;font-size:22px"><input class="input grow" name="name" value="${esc(r.name)}" placeholder="e.g. Morning" required maxlength="30"></div>
      <div class="row" style="margin-top:10px"><select class="input" name="who" style="width:auto"><option value="">Every kid</option>${ks.map(kd => `<option value="${kd.id}" ${r.member_id === kd.id ? 'selected' : ''}>${esc(kd.name)}</option>`).join('')}</select>
        <label class="lbl">From <input class="input" type="time" name="starts" value="${esc(r.starts)}"></label><label class="lbl">Until <input class="input" type="time" name="ends" value="${esc(r.ends)}"></label></div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px">${D.map((d, i) => `<label class="daychk"><input type="checkbox" name="d${i}" ${(r.days || []).includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
      <div class="lbl" style="margin-top:12px">Steps (one per line: emoji, then a word or two)</div>
      <textarea class="input" name="steps" rows="7" placeholder="🪥 Teeth&#10;👕 Get dressed">${esc((r.steps || []).map(x => `${x.emoji} ${x.label}`).join('\n'))}</textarea>
      <button class="btn" style="margin-top:12px">Save routine</button></form>`);
  },
  async 'kids-starter'() {
    const base = {household_id: S.hid, member_id: null};
    const step = (e, l) => ({id: uid().slice(0, 8), emoji: e, label: l});
    const routines = [
      Object.assign({}, base, {name: 'Morning', emoji: '🌅', starts: '06:00', ends: '09:30', sort: 0, steps: [step('🚽', 'Toilet'), step('🪥', 'Teeth'), step('👕', 'Get dressed'), step('🥣', 'Breakfast'), step('👟', 'Shoes on'), step('🎒', 'Bag')]}),
      Object.assign({}, base, {name: 'Bedtime', emoji: '🌙', starts: '17:30', ends: '20:30', sort: 1, steps: [step('🛁', 'Bath'), step('🩲', 'PJs on'), step('🪥', 'Teeth'), step('📖', 'Story'), step('💡', 'Lights out')]})];
    const chores = [['🧸', 'Pack away toys', 1], ['🍽️', 'Plate to the sink', 1], ['👟', 'Shoes away', 1]].map(([e, t, n], i) => Object.assign({}, base, {emoji: e, title: t, stars: n, sort: i}));
    const rewards = [['🍦', 'Ice cream treat', 10], ['🛝', 'Trip to the park', 15], ['🎬', 'Movie night pick', 25]].map(([e, t, c], i) => ({household_id: S.hid, emoji: e, title: t, cost: c, sort: i}));
    const bring = [{household_id: S.hid, emoji: '🧢', title: 'Hat', days: [1,2,3,4,5]}, {household_id: S.hid, emoji: '🩱', title: 'Swimmers + towel', days: [], match: 'swim'}];
    const [a, b, c, d] = await Promise.all([sb.from('routines').insert(routines).select(), sb.from('chores').insert(chores).select(), sb.from('rewards').insert(rewards).select(), sb.from('bring_rules').insert(bring).select()]);
    if (!d.error) d.data.forEach(r => { if (!S.bringRules.find(x => x.id === r.id)) S.bringRules.push(r); });
    if (a.error || b.error || c.error) return toast("Couldn't add the starter set.");
    const add = (key, rows) => rows.forEach(r => { if (!S[key].find(x => x.id === r.id)) S[key].push(r); });
    add('routines', a.data); add('chores', b.data); add('rewards', c.data); render(); toast('Starter set added. Change it any time in Settings → Kids.', 3500);
  },
  'timer-open'() { timerUI(); },
  'timer-open-again'() { S.timer = null; timerUI(); },
  'timer-start'(el) { const m = +el.dataset.m; S.timer = {end: Date.now() + m * 60e3, total: m * 60e3, label: el.dataset.l || '', emoji: el.dataset.e || '⏳'}; timerUI(); },
  'timer-stop'() { S.timer = null; clearInterval(timerT); $('#timer').classList.remove('on'); },
  'meal-week'(el) { const n = +el.dataset.n; S.mealOffset = n === 0 ? 0 : (S.mealOffset || 0) + n; render(); },
  'meal-open'(el) { mealSheet(el.dataset.k); },
  'meal-plan'() { planSheet(); },
  'scan-plan'() { const f = document.querySelector('form.scanres'); if (f) F['scan-apply'](f).then(() => { S.view = 'meals'; render(); planSheet(); }); else planSheet(); },
  'scan-fridge'() { S.view = 'meals'; render(); A['scan-pick']({dataset: {place: 'fridge'}}); },
  'plan-tag'(el) { const g = el.dataset.g, v = el.dataset.v, P = S._plan; if (['vibe', 'skill', 'double', 'lunch'].includes(g)) P[g] = v; else { const a = P[g] || (P[g] = []); const i = a.indexOf(v); i >= 0 ? a.splice(i, 1) : a.push(v); } planSheet(true); },
  'plan-day'(el) { const P = S._plan, k = el.dataset.k, i = P.days.indexOf(k); i >= 0 ? P.days.splice(i, 1) : P.days.push(k); P.days.sort(); planSheet(true); },
  'plan-people'(el) { S._plan.people = Math.max(1, Math.min(12, S._plan.people + +el.dataset.d)); planSheet(true); },
  async 'plan-go'() {
    const P = S._plan; P.notes = ($('#plan-notes') || {}).value || P.notes || '';
    if (!P.days.length) return toast('Pick at least one day.');
    // Leftovers: a dish with enough portions for everyone becomes a leftovers night; smaller amounts go to lunches.
    const lefts = S.pantry.filter(p => p.leftover), bigLeft = lefts.filter(p => (p.portions || 1) >= P.people), smallLeft = lefts.filter(p => (p.portions || 1) < P.people);
    const dates = [], leftNights = {}, rows = []; let dbl = +P.double || 0;
    const days = P.days.slice();
    bigLeft.forEach(lo => { const k = days.find(d => !leftNights[d] && !rows.some(r => r.day === d)); if (!k) return; rows.push({household_id: S.hid, day: k, slot: 'dinner', title: 'Leftovers: ' + lo.name.replace(/^leftovers?\s*/i, ''), emoji: '🍱', ingredients: [], est_cost: 0, url: null, servings: String(lo.portions), real: false, double_batch: false, prep_time: '10 min', difficulty: null, cooked: false, leftovers_of: lo.name.replace(/^leftovers?\s*/i, '')}); });
    days.filter(k => !rows.some(r => r.day === k)).forEach((k, i, arr) => { if (leftNights[k]) return; const next = arr[i + 1]; const d = dbl > 0 && next === addDaysKey(k, 1); if (d) { leftNights[next] = k; dbl--; } dates.push({day: k, double: d}); });
    const lunchDays = P.lunch === 'kids' ? days.filter(k => schoolDay(k) && (!kids().length || kidsAtSchool(k).length)) : P.lunch === 'all' ? days : [];
    await saveSettings({kitchen: Object.assign({}, kset(), {servings: P.people, prefs: P.notes, plan: {vibe: P.vibe, skill: P.skill, double: P.double, focus: P.focus, cuisines: P.cuisines, lunch: P.lunch}})});
    closeSheet(); S.planning = {at: Date.now()}; render(); planTicker();
    const leftTxt = smallLeft.map(p => `${p.name.replace(/^leftovers?\s*/i, '')} (${p.portions || 1} portion${(p.portions || 1) > 1 ? 's' : ''})`);
    const faves = (S.recipes || []).filter(x => x.favourite).map(x => x.title).slice(0, 20);
    const r = await callAI({action: 'plan', dates, people: P.people, vibe: P.vibe, skill: P.skill, focus: P.focus, cuisines: P.cuisines, notes: [P.notes, faves.length ? `Family favourites from our recipe box (include one or two this week where they fit, using these exact names): ${faves.join('; ')}.` : '', priceNotes()].filter(Boolean).join(' '), budget: kset().budget, leftovers: lunchDays.length ? [] : leftTxt, pantry: S.pantry.filter(p => !p.leftover && !p.out).map(p => p.name), recent: S.meals.slice(-14).map(m => m.title),
      lunches: lunchDays.length ? {who: P.lunch, dates: lunchDays, leftovers: leftTxt, kids: lunchKids(), staples: lbox().staples} : null});
    S.planning = null; clearInterval(planT);
    if (r.error) { render(); return toast(r.error, 5000); }
    const byDay = {}; (r.meals || []).forEach(m => { if (m && m.title) byDay[m.day] = m; });
    dates.forEach(({day, double}) => { const m = byDay[day]; if (!m) return;
      const fam = recipeMatch(m.title); if (fam) Object.assign(m, {title: fam.title, ingredients: fam.ingredients, url: fam.url || m.url, servings: fam.servings || m.servings, _rec: fam.id});
      rows.push({household_id: S.hid, day, slot: 'dinner', title: String(m.title).slice(0, 90), emoji: m.emoji || null, ingredients: (m.ingredients || []).slice(0, 30), est_cost: +m.est_cost || null, url: m.url || null, servings: m.servings ? String(m.servings) : null, real: !!m.real, double_batch: !!double, prep_time: m.prep_time || null, difficulty: m.difficulty || null, cooked: false, leftovers_of: null, notes: m._rec ? 'recipe:' + m._rec : null});
      const ln = Object.keys(leftNights).find(k => leftNights[k] === day);
      if (ln) rows.push({household_id: S.hid, day: ln, slot: 'dinner', title: 'Leftovers: ' + String(m.title).slice(0, 70), emoji: '🍱', ingredients: [], est_cost: 0, url: null, servings: null, real: false, double_batch: false, prep_time: '10 min', difficulty: null, cooked: false, leftovers_of: String(m.title).slice(0, 90)}); });
    (r.lunches || []).forEach(l => { if (!l || !lunchDays.includes(l.day)) return;
      const at = P.lunch === 'kids' && kids().length ? kidsAtSchool(l.day).map(c => c.name.toLowerCase()) : null;
      const items = []; (l.boxes || []).filter(b => !at || at.includes(String(b.who || '').toLowerCase())).forEach(b => (b.items || []).forEach(it => it && it.name && items.push({who: String(b.who || 'Kids').slice(0, 30), slot: String(it.slot || 'Lunch').slice(0, 20), name: String(it.name).slice(0, 60), buy: (it.buy || []).slice(0, 5).map(String), new: !!it.new, leftover: !!it.leftover})));
      if (!items.length) return; const mains = [...new Set(items.filter(i => i.slot === 'Lunch').map(i => i.name))];
      const lo = items.find(i => i.leftover);
      rows.push({household_id: S.hid, day: l.day, slot: 'lunch', for_who: P.lunch, title: (mains.join(' · ') || items[0].name).slice(0, 90), emoji: '🍱', ingredients: items.slice(0, 40), est_cost: +l.est_cost || null, url: null, servings: null, real: false, double_batch: false, prep_time: null, difficulty: null, cooked: false, leftovers_of: lo ? lo.name : null}); });
    if (!rows.length) { render(); return toast("The AI didn't come back with a plan. Try again."); }
    const {data, error} = await sb.from('meals').upsert(rows, {onConflict: 'household_id,day,slot'}).select(); if (error) { render(); return toast("Couldn't save the plan."); }
    data.forEach(m => { const i = S.meals.findIndex(x => x.id === m.id || (x.day === m.day && (x.slot || 'dinner') === m.slot)); if (i >= 0) S.meals[i] = m; else S.meals.push(m); });
    const din = data.filter(m => m.slot === 'dinner'), real = din.filter(m => m.real).length, cooked = din.filter(m => !m.leftovers_of).length, lun = data.filter(m => m.slot === 'lunch').length;
    render(); toast(`${pv('plannedPre')}Planned ${din.length} dinner${din.length === 1 ? '' : 's'}${lun ? ` and ${lun} lunch${lun === 1 ? '' : 'es'}` : ''}. ${real} of ${cooked} dinners are real RecipeTin Eats recipes.${bigLeft.length ? ' Leftovers big enough for everyone became a leftovers night.' : ''}`, 6000);
  },
  'lunch-open'(el) { lunchSheet(el.dataset.k); },
  'lunch-faves'() { favesSheet(); },
  async 'shop-finish'(el) { A['shop-exit'](); await A['clear-done']({dataset: {id: el.dataset.list}}); toast(pv('shop')); },
  'push-on'() { pushEnable(); },
  'push-test'() { pushTest(); },
  'push-recheck'() { S._push = null; render(); },
  async 'push-off'() { const reg = await swReg(), sub = reg && await reg.pushManager.getSubscription(); if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); try { await sub.unsubscribe(); } catch {} } LS.set('pushOn', false); S._push = null; render(); toast('Notifications are off on this phone.'); },
  assign(el) { const it = S.items.find(i => i.id === el.dataset.id); if (!it) return;
    sheet(`<h2>Who's this for?</h2><p class="help">${esc(it.text)}</p><div class="whopick">${S.members.map(m => `<button class="${it.assignee === m.id ? 'on' : ''}" data-act="assign-set" data-id="${it.id}" data-m="${m.id}">${avatar(m)}<span>${esc(m.name)}</span></button>`).join('')}<button class="${!it.assignee ? 'on' : ''}" data-act="assign-set" data-id="${it.id}" data-m=""><span class="face" style="background:var(--line)">${icon('user')}</span><span>Anyone</span></button></div>`, {focus: false}); },
  async 'assign-set'(el) { const it = S.items.find(i => i.id === el.dataset.id); if (!it) return; it.assignee = el.dataset.m || null; closeSheet(); render(); if (!DEMO) await db(sb.from('list_items').update({assignee: it.assignee}).eq('id', it.id)); },
  async 'fq-move'() { const L = S._fqLast; if (!L) return; const to = L.kind === 'grocery' ? 'todo' : 'grocery', l = listByKind(to); if (!l) return;
    S.items.filter(i => L.ids.includes(i.id)).forEach(i => i.list_id = l.id); L.kind = to; L.at = Date.now(); render(); if (!DEMO) await db(sb.from('list_items').update({list_id: l.id}).in('id', L.ids)); },
  async 'pin-key'(el) {
    if (S._pinWait && Date.now() < S._pinWait) return toast('Too many tries. Wait a moment.');
    const k = el.dataset.k; if (k === 'del') { S._pin = S._pin.slice(0, -1); return pinDots(); }
    if (S._pin.length >= 4) return; S._pin += k; pinDots(); if (S._pin.length < 4) return;
    const c = lockCfg(), ok = c && (await pinHash(S._pin, c.salt)) === c.hash;
    if (ok) { S.unlockUntil = Date.now() + 5 * 60e3; S._pinTries = 0; pinDots('ok'); const then = S._pinThen; S._pinThen = null; setTimeout(() => { closeSheet(); then && then(); }, 180); return; }
    S._pinTries = (S._pinTries || 0) + 1; if (S._pinTries >= 5) { S._pinWait = Date.now() + 30e3; S._pinTries = 0; }
    pinDots('bad'); try { navigator.vibrate && navigator.vibrate(120); } catch {} setTimeout(() => { S._pin = ''; pinDots(); }, 600);
  },
  async 'lock-off'() { await saveSettings({lock: null}); S.unlockUntil = 0; toast('Grown-up lock is off'); },
  async 'crop-save'() {
    const C = S._crop; if (!C) return; const out = document.createElement('canvas'), O = 200; out.width = out.height = O; const c2 = out.getContext('2d'), N = 560, f = O / N, sc = C.base * C.z * f;
    c2.fillStyle = '#fff'; c2.fillRect(0, 0, O, O); c2.drawImage(C.img, O / 2 - C.img.width * sc / 2 + C.x * f, O / 2 - C.img.height * sc / 2 + C.y * f, C.img.width * sc, C.img.height * sc);
    let q = .85, photo = out.toDataURL('image/jpeg', q); while (photo.length > 70000 && q > .4) { q -= .1; photo = out.toDataURL('image/jpeg', q); }
    const m = memberById(C.id); S._crop = null; if (!m) return closeSheet(); const old = m.photo; m.photo = photo; render(); memberSheet(C.id);
    if (DEMO) return toast('Sample data: nothing here is saved');
    const {error} = await sb.from('members').update({photo}).eq('id', C.id); if (error) { m.photo = old; render(); memberSheet(C.id); return toast("Couldn't save the photo. Try again.", 4000); } toast('Photo saved ✓');
  },
  'crop-cancel'(el) { S._crop = null; memberSheet(el.dataset.id); },
  async 'avatar-del'(el) { const m = memberById(el.dataset.id); if (!m) return; const old = m.photo; m.photo = null; render(); memberSheet(m.id); if (DEMO) return; const {error} = await sb.from('members').update({photo: null}).eq('id', m.id); if (error) { m.photo = old; render(); toast("Couldn't remove it."); } },
  'ev-for'(el) {
    const id = el.dataset.id, m = el.dataset.m, cur = eventMembers(evById(id)).map(x => x.id), ids = !m ? [] : cur.includes(m) ? cur.filter(x => x !== m) : cur.concat(m);
    setEventPeople(id, {for: ids});
    document.querySelectorAll('#sheet-root [data-act="ev-for"]').forEach(b => { const on = b.dataset.m ? ids.includes(b.dataset.m) : !ids.length; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  },
  'ev-taker'(el) {
    const id = el.dataset.id, cur = (takerOf(evById(id)) || {}).id, m = el.dataset.m && el.dataset.m !== cur ? el.dataset.m : null;
    setEventPeople(id, {taker: m});
    document.querySelectorAll('#sheet-root [data-act="ev-taker"]').forEach(b => b.classList.toggle('on', !!m && b.dataset.m === m));
  },
  'rep-freq'(el) { const f = el.closest('form'); f.rep_freq.value = el.dataset.v; f.querySelectorAll('[data-act="rep-freq"]').forEach(b => b.classList.toggle('on', b === el)); repRefresh(f); },
  'rep-day'(el) { const f = el.closest('form'), cur = f.rep_days.value ? f.rep_days.value.split(',') : [], v = el.dataset.v, next = cur.includes(v) ? cur.filter(x => x !== v) : cur.concat(v);
    if (!next.length) return toast('Pick at least one day.'); f.rep_days.value = next.join(','); el.classList.toggle('on', next.includes(v)); el.setAttribute('aria-pressed', next.includes(v)); repRefresh(f); },
  async 'ev-del-one'(el) { const e = evById(el.dataset.id); if (!e || !e.series) return; const r = e.row; r.repeat = Object.assign({}, r.repeat, {skip: (r.repeat.skip || []).concat(e.occ)}); closeSheet(); render(); saveLocalEvent(r, null); },
  kpick(el) { const f = el.closest('form'), inp = f.querySelector('input[name="emoji"]'), on = inp.value !== el.dataset.e; inp.value = on ? el.dataset.e : ''; f.dataset.picked = on ? '1' : '';
    f.querySelectorAll('.kpb').forEach(b => { const y = on && b === el; b.classList.toggle('on', y); b.setAttribute('aria-pressed', y); }); },
  'chore-pic'(el) { const c = S.chores.find(x => x.id === el.dataset.id); if (!c) return; sheet(`<h2>Picture for ${esc(c.title)}</h2>${kpickHTML(c.emoji || '', 'chore-pic-set', c.id)}`); },
  async 'chore-pic-set'(el) { const c = S.chores.find(x => x.id === el.dataset.id); if (!c) return; c.emoji = el.dataset.e; closeSheet(); render(); if (!DEMO) await db(sb.from('chores').update({emoji: c.emoji}).eq('id', c.id)); },
  'take-tog'(el) { const f = el.closest('form'), inp = f.querySelector('input[name="taker"]'), on = inp.value !== el.dataset.m; inp.value = on ? el.dataset.m : '';
    f.querySelectorAll('[data-act="take-tog"]').forEach(b => { const y = on && b === el; b.classList.toggle('on', y); b.setAttribute('aria-pressed', y); }); },
  'who-tog'(el) {
    const f = el.closest('form'), inp = f.querySelector('input[name="who"]'), ids = inp.value ? inp.value.split(',') : [], m = el.dataset.m;
    const next = ids.includes(m) ? ids.filter(x => x !== m) : ids.concat(m); inp.value = next.join(','); el.classList.toggle('on', next.includes(m)); el.setAttribute('aria-pressed', next.includes(m));
  },
  'loc-place'(el) { const f = el.closest('.locf'), inp = f.querySelector('[data-locsearch]'); inp.value = el.dataset.name; f.querySelectorAll('.chip3').forEach(c => c.classList.toggle('on', c === el)); const b = f.querySelector('.locsug'); b.hidden = true; },
  'loc-asis'(el) { const f = el.closest('.locf'), inp = f.querySelector('[data-locsearch]'); f.querySelector(`[name="${inp.name}_lat"]`).value = ''; const b = f.querySelector('.locsug'); b.hidden = true; b.innerHTML = ''; f.querySelectorAll('.chip3').forEach(c => c.classList.remove('on')); inp.blur(); },
  'loc-choose'(el) { const x = (S._locList || [])[+el.dataset.i]; if (!x) return; const f = el.closest('.locf'), inp = f.querySelector('[data-locsearch]'); inp.value = x.label; f.querySelector(`[name="${inp.name}_lat"]`).value = x.lat; f.querySelector(`[name="${inp.name}_lon"]`).value = x.lon; rememberGeo(x.label, x.lat, x.lon); const b = f.querySelector('.locsug'); b.hidden = true; b.innerHTML = ''; f.querySelectorAll('.chip3').forEach(c => c.classList.remove('on')); },
  'place-edit'(el) { placeSheet(el.dataset.id); },
  'face-pick'(el) {
    const f = el.closest('form'), inp = f.emoji, emo = Object.keys(FACE_OF).find(e => FACE_OF[e] === el.dataset.k);
    const lets = [...(inp.value || '')].filter(x => /\p{L}/u.test(x)).join('').slice(0, 2);
    inp.value = lets + emo; f.querySelectorAll('.fp').forEach(b => b.classList.toggle('on', b === el));
  },
  'place-preset'(el) { const f = el.closest('form'); f.name.value = el.dataset.n; f.emoji.value = el.dataset.e; },
  async 'place-del'(el) { await saveSettings({places: (settings().places || []).filter(p => p.id !== el.dataset.id)}); closeSheet(); toast('Place deleted'); },
  'mic'(el) { listen(t => { const inp = $(el.dataset.target); if (!inp) return; inp.value = (inp.value.trim() ? inp.value.trim() + ' ' : '') + t; inp.dispatchEvent(new Event('input', {bubbles: true})); if (inp.id === 'ev-title') smartFill(inp.form); if (el.dataset.submit) submitForm(inp.closest('form')); }, el); },
  'ev-import'() { eventImportSheet(); },
  'ev-voice'(el) { listen(t => readEvents({text: t}, t), el); toast('Listening… say what\'s on, e.g. “Swimming Saturday 9am at Craigie”', 3500); },
  'ev-draft-edit'(el) { const [d] = S._evReview.splice(+el.dataset.i, 1); if (!d) return; S._evDraft = d; eventForm(null); },
  async 'fq-as-todo'() { const t = S._fqText || S._evFallback; S._evReview = null; S._evFallback = ''; closeSheet(); if (!t) return; const f = document.createElement('form'); const i = document.createElement('input'); i.name = 'text'; i.value = t; f.appendChild(i); f.text = i; S._fqForce = true; await F.fquick(f); S._fqForce = false; },
  'brief-say'() {
    if (S._speaking) return stopSpeech();
    playSpeech(($('.brief .btxt') || {}).textContent || briefText(), personaId(), () => sayBtn(true), () => sayBtn(false));
  },
  'persona-sample'(el) {
    const was = el.classList.contains('on'); stopSpeech(); if (was) return; // tapping ■ just stops
    const P = persona(el.dataset.v); el.classList.add('on'); el.textContent = '■'; el.setAttribute('aria-label', `Stop ${P.name}`);
    playSpeech(P.sample, P.id, null, () => { el.classList.remove('on'); el.textContent = '▶'; el.setAttribute('aria-label', `Hear ${P.name}`); }, {sample: true});
  },
  async 'voice-g'(el) {
    stopSpeech(); const v = el.dataset.v;
    gselShow(v);
    await saveSettings({voiceG: Object.assign({}, settings().voiceG, {[personaKey()]: v})}, true);
    toast(v === 'm' ? 'Male voice it is.' : 'Female voice it is.', 2000);
  },
  async 'persona-set'(el) {
    const v = el.dataset.v; document.querySelectorAll('.pcard').forEach(c => { const on = c.dataset.pid === v; c.classList.toggle('on', on); const m = c.querySelector('.pmain'); m && m.setAttribute('aria-pressed', on); });
    await saveSettings({persona: Object.assign({}, settings().persona, {[personaKey()]: v})}, true); gselShow(voiceG(v)); toast(pv('hello'), 3000);
  },
  'brief-more'() { S._briefOpen = !S._briefOpen; const b = $('.brief'); if (b) b.classList.toggle('open', S._briefOpen); },
  'brief-hide'() { LS.set('briefHide', dayKey(new Date())); stopSpeech(); render(); toast(pv('hide')); },
  'brief-tone'() { sheet(`<h2>Choose your assistant</h2><p class="help">Each one has its own voice and its own way of telling you about your day. Tap ▶ to hear them.</p>${personaPickerHTML()}`, {focus: false}); },
  'brief-voice'(el) { LS.set('briefVoice', el.dataset.v); document.querySelectorAll('#sheet-root [data-act="brief-voice"]').forEach(b => b.classList.toggle('on', b === el)); },
  'brief-open'() { sheet(`<h2>Today's brief</h2>${briefCardHTML(true).replace('class="brief"', 'class="brief insheet"')}`); },
  'fq-mic'(el) { listen(t => { const f = el.closest('form') || document.querySelector('form[data-form="fquick"]'); if (f) { f.text.value = t; F.fquick(f); } }, el); },
  async 'home-view-set'(el) { const me = meMember(); if (!me) return; me.home_view = el.dataset.v; render(); toast(`Home is now ${el.dataset.v === 'family' ? 'the family board' : el.dataset.v === 'focus' ? 'Focus' : 'Planner'}`);
    if (!DEMO) await db(sb.from('members').update({home_view: me.home_view}).eq('id', me.id)); },
  'calm-set'(el) { LS.set('calm', el.dataset.v); render(); },
  fold(el) { S.fold = S.fold || {}; S.fold[el.dataset.k] = !S.fold[el.dataset.k]; render(); },
  async feedback() { S._fb = null; feedbackSheet(); if (!DEMO) { const {data} = await sb.from('feedback').select('body,status,created_at').eq('household_id', S.hid).eq('user_id', S.session ? S.session.user.id : null).order('created_at', {ascending: false}).limit(5); S._fbMine = data || []; if (document.querySelector('#fb-body')) feedbackSheet(); } },
  'fb-pick'(el) { const b = $('#fb-body'); if (b) S._fb.body = b.value; S._fb[el.dataset.g] = el.dataset.v; feedbackSheet(); },
  'fb-noshot'() { const b = $('#fb-body'); if (b) S._fb.body = b.value; S._fb.shot = null; feedbackSheet(); },
  'go-groceries'() { const g = listByKind('grocery'); if (g) S.listId = g.id; S.view = 'lists'; render(); },
  async 'kitchen-missing'(el) { const m = mealOn(el.dataset.k); if (!m) return; const n = await groceryAdd((m.ingredients || []).filter(x => !haveIt(x.name)).map(x => x.name)); toast(n ? `Added ${n} to Groceries` : 'Already on the list.'); },
  async 'shop-mode'(el) { S.shop = el.dataset.list; render(); scrollTo(0, 0); try { S.wake = await navigator.wakeLock?.request('screen'); } catch {} },
  'shop-exit'() { S.shop = null; try { S.wake && S.wake.release(); } catch {} S.wake = null; render(); },
  async 'shop-tick'(el) { await A['toggle-item'](el); },
  async 'shop-copy'() { const l = S.lists.find(x => x.id === S.shop); if (!l) return; const open = listItems(l.id, false), g = {}; open.forEach(i => (g[aisleOf(i.text)] = g[aisleOf(i.text)] || []).push(i.text));
    const txt = AISLE_ORDER.filter(a => g[a]).map(a => `${a}\n${g[a].map(t => '- ' + t).join('\n')}`).join('\n\n');
    try { await navigator.clipboard.writeText(txt); toast('List copied, in aisle order. Paste it into notes or an online order.'); } catch { toast("Couldn't copy on this device."); } },
  'plan-faves'() { S._planReopen = 1; favesSheet(); },
  async 'lunch-rate'(el) { const kid = kids().find(x => x.name === el.dataset.who); if (!kid) return toast('Add the kids in Settings first.');
    const lb = lbox(), c = Object.assign({likes: '', nope: ''}, lb.kids[kid.id]), key = el.dataset.v === 'up' ? 'likes' : 'nope', other = key === 'likes' ? 'nope' : 'likes', name = el.dataset.name;
    const list = s => s.split(',').map(x => x.trim()).filter(Boolean); c[other] = list(c[other]).filter(x => !sameFood(x, name)).join(', ');
    if (!list(c[key]).some(x => sameFood(x, name))) c[key] = list(c[key]).concat(name).join(', ');
    lb.kids[kid.id] = c; await saveSettings({kitchen: {...kset(), lunchbox: lb}}); toast(key === 'likes' ? `⭐ ${name} added to ${kid.name}'s favourites` : `Got it, no more ${name} for ${kid.name}`); },
  async 'lunch-need'(el) { const m = mealOn(el.dataset.k, 'lunch'); if (!m) return; const n = await groceryAdd(lunchNeed(m)); closeSheet(); toast(n ? `Added ${n} to Groceries` : 'You have everything for this one.'); },
  async 'lunch-del'(el) { const m = mealOn(el.dataset.k, 'lunch'); if (!m) return; S.meals = S.meals.filter(x => x.id !== m.id); closeSheet(); render(); await db(sb.from('meals').delete().eq('id', m.id)); },
  'meal-shop'() {
    const mon = weekStart(S.mealOffset || 0), next = addDaysKey(mon, 7), cnt = from => [...Array(7)].map((_, i) => addDaysKey(from, i)).filter(k => k >= dayKey(new Date()) && (mealOn(k) || mealOn(k, 'lunch'))).length;
    const a = cnt(mon), b = cnt(next);
    sheet(`<h2>What should go on the list?</h2><p class="help">Only things you don't already have are added. Doubles are merged.</p>
      <div class="scanpick"><button class="btn ${b ? 'ghost' : ''}" data-act="meal-shop-go" data-w="0">This week${a ? ` · ${a} day${a === 1 ? '' : 's'} planned` : ''}</button>
      <button class="btn ghost" data-act="meal-shop-go" data-w="1" ${b ? '' : 'disabled'}>Next week${b ? ` · ${b} day${b === 1 ? '' : 's'} planned` : ' · nothing planned yet'}</button>
      <button class="btn ${b ? '' : 'ghost'}" data-act="meal-shop-go" data-w="2" ${b ? '' : 'disabled'}>Both weeks</button></div>`, {focus: false});
  },
  async 'meal-shop-go'(el) {
    closeSheet(); const w = +el.dataset.w, base = weekStart(S.mealOffset || 0), today = dayKey(new Date());
    const keys = [...Array(w === 2 ? 14 : 7)].map((_, i) => addDaysKey(base, i + (w === 1 ? 7 : 0)));
    const need = []; keys.filter(k => k >= today).forEach(k => { const m = mealOn(k); if (m && !m.cooked) (m.ingredients || []).forEach(x => { if (!haveIt(x.name)) need.push(x); }); const l = mealOn(k, 'lunch'); if (l) lunchNeed(l).forEach(name => need.push({name})); });
    const n = await groceryAdd(need.map(x => x.name)); toast(n ? `Added ${n} to Groceries` : 'Nothing missing. You have it all.', 3000);
  },
  async 'meal-need'(el) { const m = mealOn(el.dataset.k); if (!m) return; const n = await groceryAdd((m.ingredients || []).filter(x => !haveIt(x.name)).map(x => x.name)); closeSheet(); toast(n ? `Added ${n} to Groceries` : 'You have everything for this one.'); },
  async 'meal-cooked'(el) {
    const m = mealOn(el.dataset.k); if (!m) return; m.cooked = !m.cooked;
    if (m.cooked) { // fresh things used up come off; dry goods stay but may run low
      const used = S.pantry.filter(p => (m.ingredients || []).some(x => { const a = normFood(x.name), b = normFood(p.name); return a && b && (a.includes(b) || b.includes(a)); }));
      const gone = used.filter(p => p.place !== 'pantry'), lowNow = used.filter(p => p.place === 'pantry');
      S.pantry = S.pantry.filter(p => !gone.includes(p)); lowNow.forEach(p => p.low = true);
      if (gone.length) db(sb.from('pantry').delete().in('id', gone.map(p => p.id))); if (lowNow.length) db(sb.from('pantry').update({low: true}).in('id', lowNow.map(p => p.id)));
    }
    closeSheet(); render(); await db(sb.from('meals').update({cooked: m.cooked}).eq('id', m.id));
    const rec = recipeOfMeal(m) || recipeMatch(m.title); // keep count of how often each family recipe gets made
    if (rec && m.cooked) { rec.times_cooked = (rec.times_cooked || 0) + 1; rec.last_cooked = m.day; if (!DEMO) db(sb.from('recipes').update({times_cooked: rec.times_cooked, last_cooked: rec.last_cooked}).eq('id', rec.id)); }
    if (m.cooked && !m.leftovers_of && !m.double_batch) sheet(`<h2>Any leftovers?</h2><p class="help">They'll show in the fridge and get used first next time you plan.</p><div class="ptags">${[0, 1, 2, 3, 4].map(n => `<button class="ptag" data-act="left-add" data-n="${n}" data-t="${esc(m.title)}">${n === 0 ? 'None' : n === 4 ? '4+ portions' : n + ' portion' + (n > 1 ? 's' : '')}</button>`).join('')}</div>`);
    if (m.leftovers_of) { const lo = S.pantry.find(p => p.leftover && sameFood(p.name, 'Leftover ' + m.leftovers_of)); if (lo) { S.pantry = S.pantry.filter(p => p !== lo); render(); db(sb.from('pantry').delete().eq('id', lo.id)); } }
  },
  async 'left-add'(el) { const n = +el.dataset.n; closeSheet(); if (!n) return; await pantryAdd([{name: 'Leftover ' + el.dataset.t.replace(/\s*\(.*?\)\s*/g, ' ').trim(), place: 'fridge', leftover: true, portions: n}]); toast('Added to the fridge as leftovers'); },
  'left-new'() { sheet(`<h2>Add leftovers</h2><form data-form="left-new"><input class="input" name="name" placeholder="e.g. Spag bol, fried rice" required maxlength="60"><div class="row" style="margin-top:12px"><span class="lbl">Portions</span>${[1, 2, 3, 4, 6].map(n => `<label class="daychk"><input type="radio" name="n" value="${n}" ${n === 2 ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div><button class="btn" style="margin-top:12px">Add to fridge</button></form>`); },
  async 'left-use'(el) { const p = S.pantry.find(x => x.id === el.dataset.id); if (!p) return; p.portions = (p.portions || 1) - 1; if (p.portions <= 0) { S.pantry = S.pantry.filter(x => x !== p); render(); await db(sb.from('pantry').delete().eq('id', p.id)); toast('All eaten'); } else { render(); await db(sb.from('pantry').update({portions: p.portions}).eq('id', p.id)); } },
  async 'scan-done'() { const SS = S.scanSess; closeSheet(); if (!SS || SS.done) return; SS.done = true; await SS.chain;
    if (!SS.imgs.length) { S.scanSess = null; return; }
    // One AI request per batch of up to 4 photos: far fewer requests against the daily free limit than one per photo.
    for (let i = 0; i < SS.imgs.length; i += 4) {
      const batch = SS.imgs.slice(i, i + 4);
      S.scanning = `Reading ${batch.length} ${SS.place} photo${batch.length === 1 ? '' : 's'}${SS.imgs.length > 4 ? ` (${i + batch.length} of ${SS.imgs.length})` : ''}… up to a minute`; render();
      const r = await callAI({action: 'pantry_photo', images: batch, place: SS.place, existing: S.pantry.map(p => p.name)});
      if (r.error) { SS.failed += batch.length; toast(r.error, 5000); continue; }
      const items = (r.items || []).map(x => Object.assign({}, x, {place: SS.place})); SS.seen.push(...items.map(x => x.name)); SS.found += items.length; SS.added += await pantryAdd(items); SS.read += batch.length;
    }
    scanFinish(SS); },
  'scan-pick'(el) { const pl = el.dataset.place;
    S.scanSess = null;
    sheet(`<h2>Scan the ${pl}</h2><p class="help">${pl === 'fridge' ? 'Take the shelves first, then each door. You can add as many photos as you need before it checks what\'s gone.' : 'Stand back so the whole shelf fits. You can add more photos before it checks what\'s gone.'}</p>
      <div class="scanpick"><label class="btn">${icon('camera')} Take a photo<input type="file" accept="image/*" capture="environment" data-change="pantry-photo" data-place="${pl}" hidden></label>
      <label class="btn ghost">Choose from photos<input type="file" accept="image/*" multiple data-change="pantry-photo" data-place="${pl}" hidden></label></div>`, {focus: false}); },
  'pantry-clear'(el) { const pl = el.dataset.place, n = S.pantry.filter(p => p.place === pl).length; if (!n) return; sheet(`<h2>Clear the ${pl}?</h2><p class="help">Removes all ${n} item${n === 1 ? '' : 's'} listed in the ${pl}, e.g. after a clean-out. You can scan it again after.</p><div class="row"><button class="btn" data-act="pantry-clear-yes" data-place="${pl}">Clear ${pl}</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>`); },
  async 'pantry-clear-yes'(el) { const pl = el.dataset.place, ids = S.pantry.filter(p => p.place === pl).map(p => p.id); S.pantry = S.pantry.filter(p => p.place !== pl); closeSheet(); render(); await db(sb.from('pantry').delete().in('id', ids)); toast(`Cleared the ${pl}`); },
  async 'snap-remove'() { const ids = [...document.querySelectorAll('#snap-miss input:checked')].map(i => i.value); closeSheet(); if (!ids.length) return; S.pantry = S.pantry.filter(p => !ids.includes(p.id)); render(); await db(sb.from('pantry').delete().in('id', ids)); toast(`Removed ${ids.length}`); },
  async 'meal-del'(el) { const m = mealOn(el.dataset.k); if (!m) return; S.meals = S.meals.filter(x => x.id !== m.id); closeSheet(); render(); await db(sb.from('meals').delete().eq('id', m.id)); },
  async 'pantry-low'(el) { const p = S.pantry.find(x => x.id === el.dataset.id); if (!p) return; // fine → low → out → fine
    if (p.out) { p.out = false; p.low = false; } else if (p.low) p.out = true; else p.low = true;
    render(); await db(sb.from('pantry').update({low: p.low, out: !!p.out}).eq('id', p.id)); },
  async 'staples-add'() { const L = staplesLow(); const n = await groceryAdd(L.map(p => p.name)); render(); toast(n ? `Added ${andList(L.map(p => p.name))} to Groceries` : 'Already on the list.'); },
  async 'pantry-shop'() { const low = S.pantry.filter(p => (p.low || p.out) && !p.leftover); const n = await groceryAdd(low.map(p => p.name)); toast(n ? `Added ${n} to Groceries` : 'Already on the list.'); },
  'brain-dump'(el) {
    sheet(`<h2>Add lots at once</h2><p class="help">Type or use your keyboard's mic and say everything at once: "milk, two loaves of bread, something for school lunches, nappies size five, bananas". It becomes a tidy list.</p>
      <form data-form="brain-dump" data-list="${el.dataset.list}"><textarea class="input" name="text" rows="5" required placeholder="milk bread eggs, mince for spag bol, apples for lunches…"></textarea><button class="btn" style="margin-top:12px">${icon('sparkle')}Sort it</button></form><div id="bd-out"></div>`);
  },
  async 'bd-add'(el) {
    const picks = [...document.querySelectorAll('#bd-out input:checked')].map(i => i.value);
    const n = await groceryAdd(picks, el.dataset.list); closeSheet(); toast(`Added ${n} to Groceries`);
  },
  async 'grocery-budget'(el) {
    const all = listItems(el.dataset.list, false).map(i => i.text); if (!all.length) return toast('The list is empty.');
    const book = Object.assign({}, priceBook()), fresh = t => { const e = book[normFood(t)]; return e && Date.now() - e.at < 30 * 864e5; };
    const items = all.filter(t => !fresh(t));
    if (items.length) {
      el.disabled = true; const r = await callAI({action: 'budget', items}); el.disabled = false;
      if (r.error) return toast(r.error, 4500);
      (r.items || []).forEach((x, i) => { const k = normFood(items[i] || x.name); if (k && +x.est >= 0) book[k] = {est: Math.round(+x.est * 100) / 100, at: Date.now()}; });
      const keys = Object.keys(book).sort((x, y) => book[y].at - book[x].at).slice(0, 400), trimmed = {}; keys.forEach(k => trimmed[k] = book[k]);
      await saveSettings({kitchen: {...kset(), prices: trimmed}});
    }
    const total = all.reduce((a2, t) => a2 + ((book[normFood(t)] || {}).est || 0), 0);
    LS.set('gbudget:' + el.dataset.list, {total, count: all.length, at: Date.now(), items: {}}); render();
    toast(items.length ? `Priced ${items.length} new item${items.length === 1 ? '' : 's'}${all.length > items.length ? `, kept ${all.length - items.length} from before` : ''}. About $${Math.round(total)}.` : `All ${all.length} items already priced. About $${Math.round(total)}.`, 4500);
  },
  async 'ai-test'() { const r = await callAI({action: 'test'}); if (r.error) return toast(r.error, 5000); S.aiModel = r.model; toast(r.gemini ? r.gemini : `Connected ✓${r.backup ? (r.backup === 'rejected' ? ' Backup key was rejected.' : ' Backup ready too.') : ''}`, 4000); render(); },
  async 'or-off'() { const {error} = await sb.rpc('set_openrouter_key', {p_household: S.hid, p_key: ''}); if (error) return toast("Couldn't remove it."); S.aiBackup = false; S.aiOn = !!S.aiGemini; toast('Backup key removed'); render(); },
  async 'code-new'() {
    if (!confirmTap('code-new', 'Tap again to make a new code. The old one stops working.')) return;
    const {data, error} = await sb.rpc('new_join_code', {p_household: S.hid});
    if (error || !data) return toast("Couldn't make a new code. Try again.", 4000);
    S.household.join_code = data; render(); toast(`New code: ${fmtCode(data)}`, 4000);
  },
  'joiner-ok'(el) { LS.set('joinSeen', Math.max(+LS.get('joinSeen', 0) || 0, +el.dataset.at)); render(); },
  invite() {
    const code = (S.household || {}).join_code || '', link = location.origin + location.pathname + '?join=' + encodeURIComponent(code);
    const msg = `Join our family on Skylike, our shared calendar, lists and meals. Open ${link} on your phone, sign in with your email, and the code ${fmtCode(code)} is filled in for you.`;
    const enc = encodeURIComponent(msg);
    sheet(`<h2>Invite your partner</h2><p class="help">Send them this. The link opens Skylike with your code ready; they just sign in with their email.</p>
      <div class="invite-msg">${esc(msg)}</div>
      <div class="invite-btns">${navigator.share ? `<button class="btn" data-act="invite-share">${icon('copy')}Share…</button>` : ''}
        <a class="btn soft" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn soft" href="sms:?&body=${enc}">Text message</a>
        <a class="btn soft" href="mailto:?subject=${encodeURIComponent('Join our family on Skylike')}&body=${enc}">Email</a>
        <button class="btn ghost" data-act="invite-copy">Copy</button></div>
      <p class="help" style="margin-top:12px">Code: <b class="num" style="letter-spacing:.15em">${esc(code)}</b></p>`);
    S._inviteMsg = msg;
  },
  async 'invite-share'() { try { await navigator.share({title: 'Join our family on Skylike', text: S._inviteMsg}); } catch {} },
  async 'invite-copy'() { try { await navigator.clipboard.writeText(S._inviteMsg); toast('Copied'); } catch { toast('Press and hold the message to copy it.'); } },
  'setup-all'() { sheet(`<h2>Get Skylike ready</h2><p class="help">About 10 minutes. Do them in any order; each one ticks itself off.</p>${setupListHTML()}<div class="row" style="margin-top:14px"><button class="btn ghost" data-act="tour" data-i="0">Take the quick tour</button><span class="grow"></span><button class="btn ghost" data-act="setup-hide">Hide this checklist</button></div>`); },
  async 'setup-hide'() { closeSheet(); await saveSettings({setupHidden: true}); toast('Hidden. Find it again in Settings → Household.', 3500); },
  async 'setup-show'() { await saveSettings({setupHidden: false}); S.view = 'family'; render(); },
  tour(el) { tourSheet(+el.dataset.i); },
  'tour-end'() { LS.set('toured', 1); closeSheet(); },
  'device-setup'() { deviceSheet('kind'); },
  'dev-kind'(el) { LS.set('deviceKind', el.dataset.k); if (el.dataset.k === 'tablet') { LS.set('deviceName', 'Family screen'); heartbeat(); keepAwake(); deviceSheet('kiosk'); } else deviceSheet('phone'); },
  'dev-who'(el) { const m = memberById(el.dataset.id); LS.set('deviceName', (m ? m.name + "'s " : '') + 'phone'); LS.set('deviceSetup', 1); heartbeat(); closeSheet(); if (m && m.home_view !== 'family') { S.activeMember = m.id; S.view = m.home_view; } render(); setTimeout(() => notifyIntro(), 300); },
  async 'intro-push-on'() { closeSheet(); await pushEnable(); afterIntro(); },
  'intro-push-skip'() { closeSheet(); afterIntro(); },
  'kiosk-tab'(el) { LS.set('kioskTab', el.dataset.k); deviceSheet('kiosk'); },
  'dev-done'() { LS.set('deviceSetup', 1); closeSheet(); render(); if (!LS.get('toured', 0)) setTimeout(() => tourSheet(0), 300); },
  'home-list'(el) { LS.set('homeList', el.dataset.kind); render(); },
  go(el) { if (el.dataset.view === 'calendar' && Date.now() - lastCalRefresh > 120e3) refreshCalendar(false); S.view = el.dataset.view;
    if (el.dataset.list) S.listId = el.dataset.list;
    if (el.dataset.mode) { S.calMode = el.dataset.mode; S.calOffset = 0; S.dayKey = el.dataset.k || dayKey(new Date()); } if (el.dataset.tab) S.settingsTab = el.dataset.tab; if (S.view === 'family') { S.activeMember = null; if (isPhone()) { const me = S.members.find(m => S.session && m.user_id === S.session.user.id); if (me && me.home_view !== 'family') { S.activeMember = me.id; S.view = me.home_view; } } } closeSheet(); render(); },
  me(el) { const m = memberById(el.dataset.id); if (S.activeMember === m.id) { S.activeMember = null; S.view = 'family'; } else { S.activeMember = m.id; S.view = m.kind === 'kid' ? 'kid' : m.home_view === 'family' ? 'family' : m.home_view; } render(); },
  'kid-stars'(el) { A['kid-rewards']({dataset: {id: el.dataset.id}}); },
  'kid-timer'() { A['timer-open'](); },
  stab(el) { S.settingsTab = el.dataset.tab; render(); },
  wake() { $('#night').classList.remove('on'); $('#glance').classList.remove('on'); stopSaver(); S.lastTouch = Date.now(); },
  'close-sheet'(el, e) { if (e.target === el || el.tagName === 'BUTTON') closeSheet(); },
  async 'toggle-item'(el) { const it = S.items.find(i => i.id === el.dataset.id); if (!it) return; it.done = !it.done; it.done_at = it.done ? new Date().toISOString() : null; render(); await db(sb.from('list_items').update({done: it.done, done_at: it.done_at}).eq('id', it.id)); const l = S.lists.find(x => x.id === it.list_id); if (it.done && l && l.kind === 'grocery') pantryAdd([{name: it.text.replace(/\s*[·x×]\s*\d.*$/, '')}]); },
  async 'quick-add'(el) {
    const listId = el.dataset.list, text = el.dataset.text, k = text.toLowerCase();
    const done = S.items.find(i => i.list_id === listId && i.done && i.text.trim().toLowerCase() === k);
    bumpHistory(listId, text);
    if (done) { done.done = false; done.done_at = null; render(); await db(sb.from('list_items').update({done: false, done_at: null}).eq('id', done.id)); return; }
    const row = {id: uid(), household_id: S.hid, list_id: listId, text, added_by: (meMember() || {}).id || null, sort: Date.now() / 1000, done: false, created_at: new Date().toISOString()};
    S.items.push(row); render(); await db(sb.from('list_items').insert(row));
  },
  async 'del-item'(el) { S.items = S.items.filter(i => i.id !== el.dataset.id); render(); await db(sb.from('list_items').delete().eq('id', el.dataset.id)); },
  async 'clear-done'(el) { const ids = S.items.filter(i => i.list_id === el.dataset.id && i.done).map(i => i.id); S.items = S.items.filter(i => !ids.includes(i.id)); render(); await db(sb.from('list_items').delete().in('id', ids)); },
  'pick-list'(el) { S.listId = el.dataset.id; render(); },
  'new-list'() { sheet(`<h2>New list</h2><form data-form="new-list"><input class="input" name="name" placeholder="e.g. Bunnings, Packing for camp" required maxlength="60"><div class="row" style="margin-top:14px"><span class="grow"></span><button type="button" class="btn soft" data-act="close-sheet">Cancel</button><button class="btn">Create</button></div></form>`); },
  async 'del-list'(el) { if (!confirm('Delete this list and everything on it?')) return; S.lists = S.lists.filter(l => l.id !== el.dataset.id); S.listId = null; render(); await db(sb.from('lists').delete().eq('id', el.dataset.id)); },
  'add-note'() { noteSheet('note'); },
  capture() { noteSheet('capture'); },
  'cap-kind'(el) { el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); const f = el.closest('form'); f.kind.value = el.dataset.kind; f.querySelector('[data-swatches]').hidden = el.dataset.kind !== 'note'; },
  'note-colour'(el) { el.parentElement.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', b === el)); el.closest('form').color.value = el.dataset.c; el.closest('form').querySelectorAll('.fp').forEach(b => b.style.setProperty('--c', el.dataset.c)); },
  'pick-colour'(el) { el.parentElement.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', b === el)); el.closest('form').color.value = el.dataset.c; },
  async 'del-note'(el) { S.notes = S.notes.filter(n => n.id !== el.dataset.id); render(); await db(sb.from('notes').delete().eq('id', el.dataset.id)); },
  'ppl-pick'(el) { S.pplPick = el.dataset.m; render(); },
  'cal-mode'(el) { S.calMode = el.dataset.mode; S.calOffset = 0; if (S.calMode === 'day' || S.calMode === 'people') S.dayKey = dayKey(new Date()); LS.set('calMode', S.calMode); render(); },
  'cal-shift'(el) { const n = +el.dataset.n; if (S.calMode === 'day' || S.calMode === 'people') S.dayKey = n === 0 ? dayKey(new Date()) : addDaysKey(S.dayKey || dayKey(new Date()), n); else S.calOffset = n === 0 ? 0 : S.calOffset + n; render(); },
  'open-day'(el) { S.dayKey = el.dataset.k; S.calMode = 'day'; LS.set('calMode', 'day'); render(); },
  'open-event'(el) { const e = evById(el.dataset.id); if (!e) return; const m = eventMember(e);
    sheet(`<h2>${esc(e.title || 'Busy')}</h2><p style="font-size:20px;font-weight:650;margin:0 0 6px">${e.all_day ? 'All day' : esc(fmtTime(new Date(e.starts_at))) + ' – ' + esc(fmtTime(new Date(e.ends_at)))}</p>${e.location ? `<p class="help" style="color:var(--ink-2)">${esc(e.location)}</p>` : ''}${eventMembers(e).length ? `<p class="row evwhos">${eventMembers(e).map(x => `<span class="row" style="gap:6px">${avatar(x)} ${esc(x.name)}</span>`).join('')}</p>` : ''}${e.notes ? `<p class="help" style="white-space:pre-line">${esc(e.notes)}</p>` : ''}${e.series ? `<p class="lbl">${icon('repeat', 'xs')} ${esc(repeatText(e.row.repeat, startKeyOf(e.row)))}</p>` : ''}${e.local ? '<p class="lbl">Only in Skylike</p>' : ''}${S.members.length ? `<div class="evppl"><div class="lbl">Who's it for <span class="hint">tap one or more</span></div><div class="chips2">${S.members.map(x => { const on = eventMembers(e).some(y => y.id === x.id); return `<button class="chip2 ${on ? 'on' : ''}" aria-pressed="${on}" data-act="ev-for" data-id="${e.id}" data-m="${x.id}">${avatar(x)}${esc(x.name)}</button>`; }).join('')}<button class="chip2 ${!eventMembers(e).length ? 'on' : ''}" data-act="ev-for" data-id="${e.id}" data-m="">${icon('family', 'xs')} Everyone</button></div>
      ${e.all_day ? '' : `<div class="lbl" style="margin-top:10px">Who's taking them</div><div class="chips2">${S.members.filter(x => x.kind !== 'kid').map(x => `<button class="chip2 ${(takerOf(e) || {}).id === x.id ? 'on' : ''}" data-act="ev-taker" data-id="${e.id}" data-m="${x.id}">${icon('car', 'xs')} ${avatar(x)}${esc(x.name)}</button>`).join('')}${takerOf(e) ? `<button class="chip2" data-act="ev-taker" data-id="${e.id}" data-m="">Nobody</button>` : ''}</div>`}</div>` : ''}${canEdit(e) ? `<div class="row" style="margin-top:10px"><button class="btn" data-act="ev-edit" data-id="${e.id}">${icon('edit')}Edit</button><button class="btn ghost" data-act="ev-del" data-id="${e.id}">Delete</button><button class="btn ghost" data-act="close-sheet">Close</button></div>` : `<p class="help" style="color:var(--ink-3)">${twoWayCals().length ? 'This calendar is a read-only link, so change it in Google Calendar.' : 'To edit events here, connect two-way editing in Settings → Calendar.'}</p><button class="btn" data-act="close-sheet">Close</button>`}`); },
  'ev-add'(el) { eventForm(null, el.dataset.k); },
  'ev-setup'() { closeSheet(); A.go({dataset: {view: 'settings', tab: 'calendar'}}); },
  'ev-edit'(el) { eventForm(evById(el.dataset.id)); },
  'ev-del'(el) { const e = evById(el.dataset.id); if (!e) return;
    if (e.series) return sheet(`<h2>Delete “${esc(e.title || 'this event')}”?</h2><p class="help">It repeats: ${esc(repeatText(e.row.repeat, startKeyOf(e.row)))}.</p><div class="row" style="flex-wrap:wrap"><button class="btn" data-act="ev-del-one" data-id="${e.id}">Just this one (${esc(fmtDay(e.occ, {weekday: 'short', day: 'numeric', month: 'short'}))})</button><button class="btn danger" data-act="ev-del-go" data-id="${e.id}">Every one</button><button class="btn ghost" data-act="close-sheet">Keep it</button></div>`);
    sheet(`<h2>Delete “${esc(e.title || 'this event')}”?</h2><p class="help">${e.local ? 'It\'s removed from Skylike for everyone in the family.' : 'It\'s removed from Google Calendar for everyone.'}</p><div class="row"><button class="btn danger" data-act="ev-del-go" data-id="${e.id}">Delete</button><button class="btn ghost" data-act="close-sheet">Keep it</button></div>`); },
  async 'ev-del-go'(el) { if (String(el.dataset.id).startsWith('L-')) { const rid = el.dataset.id.slice(2).replace(/@.*$/, ''), row = S.localEvents.find(r => r.id === rid); S.localEvents = S.localEvents.filter(r => r.id !== rid); closeSheet(); render(); if (DEMO) return; const {error} = await sb.from('local_events').delete().eq('id', rid); if (error) { if (row) S.localEvents.push(row); render(); return toast("Couldn't delete it. Try again."); } return toast('Deleted'); }
    const i = S.events.findIndex(x => x.id === el.dataset.id); if (i < 0) return; const [e] = S.events.splice(i, 1); closeSheet(); render(); calWrite({action: 'delete', id: e.id}, () => S.events.splice(i, 0, e)); },
  'edit-member'(el) { memberSheet(el.dataset.id); },
  async 'del-row'(el) { if (el.dataset.table === 'members' && !confirm('Remove this person?')) return; const t = el.dataset.table, key = KEY_OF[t]; S[key] = S[key].filter(r => r.id !== el.dataset.id); closeSheet(); render(); await db(sb.from(t).delete().eq('id', el.dataset.id)); },
  async 'toggle-setting'(el) { const k = el.dataset.key; await saveSettings({[k]: !settings()[k]}); },
  async 'toggle-saver'(el) { const s = settings().saver; await saveSettings({saver: Object.assign({}, s, {on: !s.on})}); },
  'use-location'() {
    if (!navigator.geolocation) return toast("This device can't share its location.");
    navigator.geolocation.getCurrentPosition(async p => { await saveSettings({location: Object.assign({}, settings().location, {lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), name: 'Home', at: new Date().toISOString()})}); travelTried.clear(); loadWeather(); computeTravel(); toast('Home saved. Weather and driving times now use it.'); }, () => toast('Location was not allowed.'));
  },
  async 'sign-out'() { await sb.auth.signOut(); LS.set('hid', null); location.reload(); },
  onboard(el) { S._onboard = el.dataset.mode; renderOnboard(); },
  'otp-back'() { S._otpEmail = null; renderGate(); },
  'copy-script'() {
    let key = LS.get('pendingKey:' + S.hid, null);
    if (!key) { key = (uid() + uid()).replace(/-/g, '').slice(0, 40); LS.set('pendingKey:' + S.hid, key); }
    const showManual = src => sheet(`<h2>Copy this script</h2><p class="help" style="color:var(--ink-2)">Select all of it and copy, then paste into Apps Script.</p><textarea class="input" readonly style="min-height:300px;font-family:ui-monospace,Menlo,monospace;font-size:13px">${esc(src)}</textarea><div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" data-act="close-sheet">Done</button></div>`);
    if (!BRIDGE_SRC) { prefetchBridge().then(() => BRIDGE_SRC ? showManual(BRIDGE_SRC.replace('__SKYLIKE_KEY__', key)) : toast("Couldn't load the script. Check the connection.")); return; }
    const src = BRIDGE_SRC.replace('__SKYLIKE_KEY__', key);
    // must run inside the tap for Safari
    (navigator.clipboard ? navigator.clipboard.writeText(src) : Promise.reject())
      .then(() => toast('Script copied. Paste it into a new Apps Script project.', 3600))
      .catch(() => showManual(src));
    render();
  },
  'cal-reconnect'() { if (!LS.get('pendingKey:' + S.hid, null)) LS.set('pendingKey:' + S.hid, (uid() + uid()).replace(/-/g, '').slice(0, 40)); render(); },
  async 'cal-refresh'(el) { await refreshCalendar(true); },
  async 'cal-sync'() { toast('Syncing calendar…'); const r = await callFn({action: 'sync'}); toast(r.error ? 'Sync problem: ' + r.error : `Calendar synced · ${r.events ?? 0} events`, 3500); refreshCalStatus(); },
  async 'cal-refresh-list'() { const r = await callFn({action: 'calendars'}); toast(r.error ? r.error : 'Calendar list updated'); const {data} = await sb.from('calendars').select('*').eq('household_id', S.hid); if (data) S.calendars = data; render(); },
  async 'cal-toggle'(el) { const c = S.calendars.find(x => x.id === el.dataset.id); c.enabled = !c.enabled; render(); await db(sb.from('calendars').update({enabled: c.enabled}).eq('id', c.id)); callFn({action: 'sync'}); },
  async 'del-feed'(el) { if (!confirm('Remove this calendar from the screen?')) return; const gid = el.dataset.gid; S.calendars = S.calendars.filter(c => c.google_id !== gid); S.events = S.events.filter(e => e.calendar_id !== gid); render(); await db(sb.rpc('remove_calendar_feed', {p_household: S.hid, p_google_id: gid})); refreshCalStatus(); },
  theme(el) { LS.set('theme', el.dataset.theme); idleTick(); render(); },
  async cmd(el) { await db(sb.from('commands').insert({household_id: S.hid, command: el.dataset.cmd, device_id: el.dataset.id || null})); toast(el.dataset.id ? 'Sent' : 'Sent to every screen'); }
};
let lastCalRefresh = 0;
async function refreshCalendar(loud) {
  if (DEMO) { if (loud) toast('Calendar refreshed'); return; }
  if (!S.calStatus || !S.calStatus.connected) { if (loud) toast('Add a calendar in Settings first.'); return; }
  lastCalRefresh = Date.now();
  if (loud) toast('Checking Google Calendar…');
  const r = await callFn({action: 'sync'});
  const ev = await sb.from('events_cache').select('*').eq('household_id', S.hid).gte('ends_at', new Date(Date.now() - 3 * 864e5).toISOString()).order('starts_at');
  if (ev.data) S.events = ev.data;
  refreshCalStatus(); render();
  if (loud) toast(r.error ? 'Calendar problem: ' + r.error : 'Calendar up to date', 3000);
}
