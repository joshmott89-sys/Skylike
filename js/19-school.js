// Skylike: school days. Loads after 18-door; all parts share one global scope and load in order (index.html).
/* ----- each kid's school days: every week, every 2nd week, and a change from a date (e.g. next year) ----- */
const WDS = [1, 2, 3, 4, 5];
function schoolSummary(id) {
  const ps = schoolPlans(id).slice().sort((a, b) => (a.from || '').localeCompare(b.from || '')), today = dayKey(new Date());
  const one = p => [p.days && p.days.length ? p.days.map(d => WD[d]).join(', ') : '', p.fort && p.fort.length ? `every 2nd ${p.fort.map(d => WD[d]).join(', ')}` : ''].filter(Boolean).join(' + ') || 'none';
  return ps.map(p => p.from && p.from > today ? `from ${fmtDay(p.from, {day: 'numeric', month: 'short', year: 'numeric'})}: ${one(p)}` : one(p)).join(' · ');
}
function schoolPlanBlock(kid, p, i) {
  const chip = (name, d, on) => `<label class="ptag-c"><input type="checkbox" name="${name}" value="${d}" ${on ? 'checked' : ''}><span>${WD[d]}</span></label>`;
  const nm = `${kid.id}_${i}`;
  return `<div class="splan">${i ? `<label class="lbl">Changes from <input class="input" type="date" name="from_${nm}" value="${esc(p.from || '')}"></label>` : ''}
    <div class="lbl">Every week</div><div class="ptags">${WDS.map(d => chip('wk_' + nm, d, (p.days || []).includes(d))).join('')}</div>
    <div class="lbl">Every 2nd week</div><div class="ptags">${WDS.map(d => chip('fn_' + nm, d, (p.fort || []).includes(d))).join('')}</div>
    <label class="lbl">First one is in the week of <input class="input" type="date" name="anchor_${nm}" value="${esc(p.anchor || '')}"></label></div>`;
}
function schoolSheet() {
  const ks = kids(); if (!ks.length) return toast('Add the kids first, in Settings → Family.');
  sheet(`<h2>School days</h2><p class="help">Each kid's kindy or school days. Holidays and term breaks are skipped by themselves. Routines set to "School days", the lunchbox plan and the Out the door list all use these.</p>
    <form data-form="school-days">${ks.map(kd => { const ps = schoolPlans(kd.id).slice().sort((a, b) => (a.from || '').localeCompare(b.from || '')); const cur = ps.find(p => !p.from) || ps[0], next = ps.find(p => p.from) || null;
      return `<div class="pblock"><div class="kt fk">${avatar(kd)} ${esc(kd.name)}</div>${schoolPlanBlock(kd, cur, 0)}
        <details class="snext" ${next ? 'open' : ''}><summary>A change coming up (e.g. next year)</summary>${schoolPlanBlock(kd, next || {from: '', days: [], fort: [], anchor: ''}, 1)}</details></div>`; }).join('')}
    <button class="btn" style="margin-top:12px">Save school days</button></form>`, {focus: false});
}
A['school-days'] = () => schoolSheet();
F['school-days'] = async f => {
  const vals = name => [...f.querySelectorAll(`input[name="${name}"]:checked`)].map(i => +i.value), out = {};
  for (const kd of kids()) {
    const plan = i => ({from: i ? (f[`from_${kd.id}_${i}`] || {}).value || '' : '', days: vals(`wk_${kd.id}_${i}`), fort: vals(`fn_${kd.id}_${i}`), anchor: (f[`anchor_${kd.id}_${i}`] || {}).value || ''});
    const a = plan(0), b = plan(1);
    if (a.fort.length && !a.anchor) return toast(`Pick the week ${kd.name}'s first every-2nd-week day is in.`);
    if (b.fort.length && !b.anchor) b.anchor = b.from;
    out[kd.id] = [a].concat(b.from && (b.days.length || b.fort.length) ? [b] : []);
  }
  const lb = lbox(); kids().forEach(kd => { lb.kids[kd.id] = Object.assign({}, lb.kids[kd.id], {days: out[kd.id][0].days.concat(out[kd.id][0].fort)}); });
  await saveSettings({schoolDays: out, kitchen: {...kset(), lunchbox: lb}}); closeSheet();
};
