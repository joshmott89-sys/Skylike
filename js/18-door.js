// Skylike: out-the-door. Loads after 17-quests; all parts share one global scope and load in order (index.html).
/* ----- a shared grown-ups' checklist for getting out the door on weekday mornings. Anyone can tick; everyone sees it. ----- */
const DOOR_DEFAULT = {on: true, starts: '06:00', ends: '09:15', days: [1, 2, 3, 4, 5], items: [
  {id: 'dogs', emoji: '🐶', label: 'Dogs fed'},
  {id: 'brekkie', emoji: '🥣', label: "Everyone's had breakfast"},
  {id: 'coffee', emoji: '☕', label: 'Finished your coffee? Or is it going cold on the bench…'},
  {id: 'robot', emoji: '🤖', label: 'Floors clear, robot tank filled'}]};
const doorSet = () => Object.assign({}, DOOR_DEFAULT, settings().door || {});
const doorTick = (ref, k) => S.ticks.find(t => t.kind === 'door' && t.ref === ref && t.day === k);
function doorRows(now = new Date()) {
  const d = doorSet(), k = dayKey(now), h = hoursFloat(now), rows = [];
  const school = kids().length && schoolDay(k);
  if (school) {
    const ks = kids().map(kd => { const r = currentRoutine(kd, k, h).now || S.routines.find(x => forKid(x, kd) && onDay(x, k) && hm(x.starts) < 11); const st = r ? r.steps || [] : []; return {kd, n: r ? st.filter(s => tickOf(kd, 'step', r.id + ':' + s.id, k)).length : 0, of: st.length}; }).filter(x => x.of);
    if (ks.length) rows.push({id: 'kids', auto: true, emoji: '🧒', label: 'Kids done their routines', done: ks.every(x => x.n >= x.of), sub: ks.map(x => `${esc(x.kd.name)} ${x.n}/${x.of}`).join(' · '), faces: ks});
    const bring = [...new Set(bringFor(k).flatMap(b => b.items.map(i => i.title)))];
    rows.push({id: 'bags', emoji: '🎒', label: 'Bags by the door', sub: bring.length ? esc(bring.join(', ')) : 'Lunchboxes, water bottles, hats'});
  }
  d.items.forEach(it => rows.push(Object.assign({}, it)));
  rows.forEach(r => { if (!r.auto) { const t = doorTick(r.id, k); r.done = !!t; r.by = t && memberById(t.member_id); } });
  return rows;
}
function doorLive(now = new Date()) {
  const d = doorSet(), h = hoursFloat(now);
  return d.on && (d.days || []).includes(weekdayOfKey(dayKey(now))) && h >= hm(d.starts) && h < hm(d.ends);
}
function doorCardHTML() {
  if (!doorLive() || !S.members.some(m => m.kind !== 'kid')) return '';
  const now = new Date(), rows = doorRows(now), done = rows.filter(r => r.done).length, all = done === rows.length;
  const first = eventsOnKey(dayKey(now)).find(e => !e.all_day && new Date(e.starts_at) > now && tzParts(new Date(e.starts_at)).h < 11);
  const sub = first ? `${esc(first.title)} at ${esc(fmtTime(new Date(first.starts_at)))}` : `until ${esc(fmtHM(doorSet().ends))}`;
  if (all) return `<section class="doorcard all"><span class="dce">🚗</span><div class="grow"><b>All set. Out you go!</b><small>${sub}</small></div><button class="btn ghost sm" data-act="door-edit">Edit</button></section>`;
  return `<section class="doorcard"><header><span class="dce">🚪</span><div class="grow"><b>Out the door <span class="num">${done} of ${rows.length}</span></b><small>${sub}</small></div><button class="btn ghost sm" data-act="door-edit">Edit</button></header>
    <div class="drows">${rows.map(r => `<button class="drow ${r.done ? 'done' : ''} ${r.auto ? 'auto' : ''}" data-act="${r.auto ? 'go' : 'door-tick'}" ${r.auto ? 'data-view="kids"' : `data-ref="${esc(r.id)}"`} aria-pressed="${!!r.done}">
      <span class="dbox">${r.done ? icon('check') : ''}</span><span class="dem">${r.emoji || '✔️'}</span><span class="grow"><b>${esc(r.label)}</b>${r.sub ? `<small>${r.sub}</small>` : ''}</span>${r.faces ? `<span class="dfaces">${r.faces.map(x => `<span class="${x.n >= x.of ? 'ok' : ''}">${avatar(x.kd)}</span>`).join('')}</span>` : r.by ? `<span class="dby">${avatar(r.by)}</span>` : ''}</button>`).join('')}</div></section>`;
}
Object.assign(A, {
  async 'door-tick'(el) {
    const ref = el.dataset.ref, k = dayKey(new Date()), had = doorTick(ref, k);
    const who = (m => m && m.kind !== 'kid' ? m : null)(meMember()) || S.members.find(m => m.kind !== 'kid');
    if (had) { S.ticks = S.ticks.filter(t => t.id !== had.id); render(); return db(sb.from('ticks').delete().eq('id', had.id)); }
    const row = {id: uid(), household_id: S.hid, member_id: who.id, kind: 'door', ref, day: k, stars: 0};
    S.ticks.push(row); render(); if (!DEMO) await db(sb.from('ticks').insert(row));
  },
  'door-edit'() {
    const d = doorSet(), D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    sheet(`<h2>Out the door</h2><p class="help">A shared checklist for the grown-ups on weekday mornings. On school days it adds the kids' routines and bags by itself.</p>
      <form data-form="door-save"><div class="row"><label class="lbl">From <input class="input" type="time" name="starts" value="${esc(d.starts)}"></label><label class="lbl">Until <input class="input" type="time" name="ends" value="${esc(d.ends)}"></label></div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px">${D.map((x, i) => `<label class="daychk"><input type="checkbox" name="d${i}" ${(d.days || []).includes(i) ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div>
      <div class="lbl" style="margin-top:12px">Jobs (one per line: emoji, then the words)</div>
      <textarea class="input" name="items" rows="6">${esc(d.items.map(x => `${x.emoji} ${x.label}`).join('\n'))}</textarea>
      <div class="row" style="margin-top:12px"><button class="btn">Save</button><span class="grow"></span><label class="lbl"><input type="checkbox" name="on" ${d.on ? 'checked' : ''}> Show it</label></div></form>`);
  }
});
F['door-save'] = async f => {
  const old = doorSet().items;
  const items = f.items.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(\S+)\s+(.+)$/), em = m && /\p{Extended_Pictographic}/u.test(m[1]); const label = (em ? m[2] : l).slice(0, 80); const same = old.find(o => o.label === label); return {id: same ? same.id : uid().slice(0, 8), emoji: em ? m[1] : '✔️', label}; });
  await saveSettings({door: {on: f.on.checked, starts: f.starts.value || '06:00', ends: f.ends.value || '09:15', days: [0, 1, 2, 3, 4, 5, 6].filter(i => f['d' + i].checked), items}});
  closeSheet();
};
