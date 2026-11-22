// Skylike: quests. Loads after 16-house; all parts share one global scope and load in order (index.html).
/* ----- partner quest: six real jobs that set Skylike up, with rewards promised by the other parent ----- */
// settings().quest = {for: memberId, from: memberId, rewards: {3: text, 6: text}, claimed: {3: ms, 6: ms}, started: ms}
const QUEST_SCHOOL = /school|kindy|kindi|daycare|day care|childcare|prep\b|pre-?primary|class/i;
const repeatsWeekly = r => r.repeat && ['week', 'fortnight', 'day'].includes(r.repeat.freq);
function questSteps(q) {
  const who = memberById(q.for), giver = memberById(q.from), kidIds = kids().map(k => k.id), name = who ? who.name : 'You';
  const fridgeAt = ((settings().scans || {}).fridge || {}).at || 0, today = dayKey(new Date());
  // a Google calendar event that comes back at least twice in the next fortnight also counts as "regular"
  const googleRegular = re => { const hits = S.events.filter(e => re.test(e.title || '') && e.starts_at >= new Date().toISOString() && e.starts_at < new Date(Date.now() + 15 * 864e5).toISOString()); return hits.length >= 2; };
  const loc = S.localEvents || [];
  const school = loc.some(r => repeatsWeekly(r) && ((r.member_ids || []).some(id => kidIds.includes(id)) || QUEST_SCHOOL.test(r.title || ''))) || googleRegular(QUEST_SCHOOL);
  const work = loc.some(r => repeatsWeekly(r) && !QUEST_SCHOOL.test(r.title || '') && ((r.member_ids || []).includes(q.for) || /\bwork|shift|water babies/i.test(r.title || ''))) || googleRegular(/\bwork\b|\bshift\b|water babies/i);
  const groc = listByKind('grocery'), sentToList = !!fridgeAt && S.items.some(i => groc && i.list_id === groc.id && Date.parse(i.created_at || 0) >= fridgeAt - 5 * 60e3);
  const dinners = S.meals.filter(m => m.day >= today && m.day <= addDaysKey(today, 7) && (!m.slot || m.slot === 'dinner')).length;
  const gave = giver && S.items.some(i => i.assignee === giver.id && i.added_by === q.for);
  const kidNames = kids().map(k => k.name).join(' and ') || 'the kids';
  return [
    {id: 'school', emoji: '🏫', title: `Put ${kidNames}'s school days in`, why: 'Add kindy or school as a regular event, so the wall knows which days need bags and hats.', done: school, go: {act: 'quest-go', step: 'school'}},
    {id: 'work', emoji: '💼', title: `Put ${name === 'You' ? 'your' : name + "'s"} work days in`, why: 'One regular event. Everyone can see which days you work, and leave reminders find you.', done: work, go: {act: 'quest-go', step: 'work'}},
    {id: 'fridge', emoji: '📸', title: 'Snap the fridge', why: 'One photo. Skylike notes what\'s there, and next week it spots what ran out.', done: !!fridgeAt, go: {act: 'scan-fridge'}},
    {id: 'groc', emoji: '🛒', title: 'Send what\'s missing to groceries', why: 'After the photo, tick what\'s run out and it goes on the shopping list.', done: sentToList, go: fridgeAt ? {act: 'go', view: 'lists'} : {act: 'scan-fridge'}},
    {id: 'meals', emoji: '🍝', title: 'Plan 3 dinners this week', why: 'Pick from the list or let the helper suggest some, using what\'s in the fridge.', done: dinners >= 3, n: Math.min(dinners, 3) + ' of 3', go: {act: 'go', view: 'meals'}},
    {id: 'give', emoji: '🤝', title: `Give ${giver ? giver.name : 'your partner'} a to-do`, why: 'Type it, tap their face. It lands on their phone.', done: !!gave, go: {act: 'go', view: 'lists'}}];
}
const questOf = () => { const q = settings().quest; return q && memberById(q.for) ? q : null; };
const QUEST_MILES = [3, 6];
// Who sees the card: the player and the giver on their phones, and anyone on the shared wall screen.
function questCardHTML() {
  const q = questOf(); if (!q) return '';
  const me = meMember(), steps = questSteps(q), done = steps.filter(s => s.done).length, claimed = q.claimed || {};
  if (QUEST_MILES.every(m => claimed[m])) return '';
  if (me && ![q.for, q.from].includes(me.id) && deviceKind() === 'phone') return '';
  const player = memberById(q.for), giver = memberById(q.from), isGiver = me && me.id === q.from && me.id !== q.for;
  const next = steps.find(s => !s.done), open = QUEST_MILES.find(m => done >= m && !claimed[m]);
  const path = steps.map((s, i) => `<span class="qstone ${s.done ? 'done' : s === next ? 'next' : ''}" title="${esc(s.title)}">${s.done ? icon('check') : `<i>${s.emoji}</i>`}</span>${QUEST_MILES.includes(i + 1) ? `<span class="qgift ${done >= i + 1 ? 'open' : ''} ${claimed[i + 1] ? 'claimed' : ''}" title="${esc((q.rewards || {})[i + 1] || '')}">${claimed[i + 1] ? '✓' : '🎁'}</span>` : ''}`).join('');
  const rw = m => esc((q.rewards || {})[m] || '');
  const head = isGiver ? `<b>${esc(player.name)}'s Skylike quest</b><small>${done} of 6 done · you promised: ${rw(3)}, then ${rw(6)}</small>` : `<b>${esc(player.name)}'s Skylike quest</b><small>${done} of 6 · ${open ? 'a reward is ready' : next ? `${QUEST_MILES.find(m => m > done) - done} more for ${rw(QUEST_MILES.find(m => m > done))}` : ''}</small>`;
  const body = open && !isGiver
    ? `<div class="qprize"><span class="qpe">🎁</span><div class="grow"><b>${rw(open)}</b><small>From ${esc(giver ? giver.name : 'your partner')}, no strings attached. Claiming tells them it's time.</small></div><button class="btn" data-act="quest-claim" data-m="${open}">Claim it</button></div>`
    : next ? `<div class="qnext"><span class="qne">${next.emoji}</span><div class="grow"><b>${esc(next.title)}${next.n ? ` <span class="num qn">${next.n}</span>` : ''}</b><small>${esc(next.why)}</small></div>${isGiver ? '' : `<button class="btn" data-act="${next.go.act}" ${next.go.view ? `data-view="${next.go.view}"` : ''} ${next.go.step ? `data-step="${next.go.step}"` : ''}>Do it</button>`}</div>` : '';
  return `<section class="questcard" style="--c:${esc(player.color || '#3A9AA0')}"><header>${avatar(player)}<div class="grow">${head}</div><button class="btn ghost sm" data-act="quest-all">${isGiver ? 'Rewards' : 'See all'}</button></header><div class="qpath" role="img" aria-label="${done} of 6 quest steps done">${path}</div>${body}</section>`;
}
function questSheet() {
  const q = questOf(); if (!q) return A['quest-setup']();
  const steps = questSteps(q), done = steps.filter(s => s.done).length, claimed = q.claimed || {}, me = meMember(), isPlayer = !me || me.id === q.for;
  sheet(`<h2>${esc(memberById(q.for).name)}'s Skylike quest <span class="num" style="color:var(--ink-3)">${done}/6</span></h2>
    <p class="help">Six real jobs that get the family hub working for you. Each one ticks itself off when it's done.</p>
    <div class="qlist">${steps.map((s, i) => `<div class="sstep ${s.done ? 'done' : ''}"><span class="sdot">${s.done ? icon('check') : s.emoji}</span><div class="grow"><b>${esc(s.title)}${s.n && !s.done ? ` · <span class="num">${s.n}</span>` : ''}</b><div class="lbl">${esc(s.why)}</div></div>${s.done || !isPlayer ? '' : `<button class="btn soft" data-act="${s.go.act}" ${s.go.view ? `data-view="${s.go.view}"` : ''} ${s.go.step ? `data-step="${s.go.step}"` : ''}>Do it</button>`}</div>${QUEST_MILES.includes(i + 1) ? `<div class="qmile ${done >= i + 1 ? 'open' : ''}">🎁 <b>${esc((q.rewards || {})[i + 1] || '')}</b>${claimed[i + 1] ? ' · claimed' : done >= i + 1 ? ' · ready to claim' : ` · after ${i + 1}`}</div>` : ''}`).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="quest-setup">Change rewards</button><span class="grow"></span><button class="btn ghost" data-act="close-sheet">Close</button></div>`);
}
Object.assign(A, {
  'quest-all'() { questSheet(); },
  'quest-setup'() {
    const q = questOf() || {}, adults = S.members.filter(m => m.kind !== 'kid'), me = meMember();
    const player = q.for || (adults.find(m => !me || m.id !== me.id) || {}).id, giver = q.from || (me || adults[0] || {}).id, rw = q.rewards || {};
    const pick = (name, val) => `<select class="input" name="${name}">${adults.map(m => `<option value="${m.id}" ${m.id === val ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`;
    sheet(`<h2>A Skylike quest</h2><p class="help">Six real setup jobs (school days, work days, fridge photo, groceries, three dinners, a to-do for you). Promise a reward halfway and one at the end.</p>
      <form data-form="quest-save"><div class="row"><label class="lbl grow">Who's playing ${pick('for', player)}</label><label class="lbl grow">Rewards from ${pick('from', giver)}</label></div>
      <label class="lbl" style="margin-top:10px">After 3 <input class="input" name="r3" maxlength="60" value="${esc(rw[3] || 'Coffee made for you ☕')}"></label>
      <label class="lbl" style="margin-top:10px">After all 6 <input class="input" name="r6" maxlength="60" value="${esc(rw[6] || 'A back massage, no strings attached 💆')}"></label>
      <div class="row" style="margin-top:14px"><button class="btn">${q.for ? 'Save' : 'Start the quest'}</button>${q.for ? '<span class="grow"></span><button type="button" class="btn ghost danger" data-act="quest-stop">End the quest</button>' : ''}</div></form>`);
  },
  async 'quest-stop'() { closeSheet(); await saveSettings({quest: null}); },
  'quest-go'(el) {
    const q = questOf(); if (!q) return;
    const nextMon = (() => { let k = dayKey(new Date()); while (weekdayOfKey(k) !== 1) k = addDaysKey(k, 1); return k; })();
    S._evDraft = el.dataset.step === 'school'
      ? {title: 'Kindy', who: kids().map(k => k.id), day: nextMon, start: '08:30', end: '15:00', repeat: {freq: 'week', days: [1, 2, 3, 4, 5]}}
      : {title: 'Work', who: [q.for], day: nextMon, start: '09:00', end: '15:00', repeat: {freq: 'week', days: [1]}};
    closeSheet(); eventForm(null);
    toast(el.dataset.step === 'school' ? 'Change the name, days and times to match, then Add.' : 'Pick your days and hours, then Add.', 4000);
  },
  async 'quest-claim'(el) {
    const q = questOf(), m = +el.dataset.m; if (!q || (q.claimed || {})[m]) return;
    const giver = memberById(q.from), player = memberById(q.for), todo = listByKind('todo'), text = `${(q.rewards || {})[m]} for ${player.name}`;
    await saveSettings({quest: Object.assign({}, q, {claimed: Object.assign({}, q.claimed, {[m]: Date.now()})})}, true);
    // the claim lands as a to-do on the giver's list, which also sends it to their phone
    if (giver && todo && !DEMO) { const row = {id: uid(), household_id: S.hid, list_id: todo.id, text: text.slice(0, 200), added_by: q.for, assignee: giver.id, sort: Date.now() / 1000, done: false, created_at: new Date().toISOString()}; S.items.push(row); await db(sb.from('list_items').insert(row)); }
    cheer(el, true); toast(`Claimed! ${giver ? giver.name : 'Your partner'} has it on their list now.`, 4000);
  }
});
F['quest-save'] = async f => {
  if (f.for.value === f.from.value && S.members.filter(m => m.kind !== 'kid').length > 1) return toast('Pick someone else to give the rewards.');
  const old = questOf() || {};
  await saveSettings({quest: {for: f.for.value, from: f.from.value, rewards: {3: f.r3.value.trim() || 'A treat', 6: f.r6.value.trim() || 'A bigger treat'}, claimed: old.for === f.for.value ? (old.claimed || {}) : {}, started: old.started || Date.now()}});
  closeSheet();
};
