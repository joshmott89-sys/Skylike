// Skylike: kids. Part 5 of 11; all parts share one global scope and load in order (index.html).
/* ----- kids: picture routines, chores, stars ----- */
const kids = () => S.members.filter(m => m.kind === 'kid');
const hm = t => { const [a, b] = String(t || '0:0').split(':').map(Number); return a + (b || 0) / 60; };
const forKid = (row, kid) => !row.member_id || row.member_id === kid.id;
const onDay = (row, k) => !row.days || !row.days.length || row.days.includes(weekdayOfKey(k));
const tickOf = (kid, kind, ref, k) => S.ticks.find(t => t.member_id === kid.id && t.kind === kind && t.ref === ref && t.day === k);
function currentRoutine(kid, k, h) {
  const rs = S.routines.filter(r => forKid(r, kid) && onDay(r, k));
  return {now: rs.find(r => h >= hm(r.starts) && h < hm(r.ends)), next: rs.filter(r => hm(r.starts) > h).sort((a, b) => hm(a.starts) - hm(b.starts))[0]};
}
const routineName = r => /routine/i.test(r.name) ? r.name : r.name + ' routine';
const fmtHM = t => { const x = hm(t), H = Math.floor(x), M = Math.round((x - H) * 60); return ((H + 11) % 12 + 1) + (M ? ':' + String(M).padStart(2, '0') : '') + (H < 12 ? 'am' : 'pm'); };
// Bring-today: rules by weekday, or when one of the day's events mentions a word (e.g. "swim").
function bringFor(k) {
  const evs = eventsOnKey(k).map(e => (e.title || '').toLowerCase());
  const out = {};
  S.bringRules.forEach(r => {
    const byDay = r.days && r.days.includes(weekdayOfKey(k)), byEvent = r.match && evs.some(t => t.includes(r.match.toLowerCase()));
    if (!byDay && !byEvent) return;
    const who = r.member_id ? [memberById(r.member_id)].filter(Boolean) : kids();
    who.forEach(m => { (out[m.id] = out[m.id] || {m, items: []}).items.push(r); });
  });
  return Object.values(out);
}
const starsOf = kid => S.balances[kid.id] || 0;
// A row of stars toward the next reward: earned ones filled, the rest hollow outlines. Big goals squeeze into 10 stars.
function starTrack(kid, size = '') {
  const stars = starsOf(kid), goal = S.rewards.filter(w => w.cost > stars).sort((a, b) => a.cost - b.cost)[0] || S.rewards.slice().sort((a, b) => b.cost - a.cost)[0];
  if (!goal) return `<div class="strack ${size}"><span class="sfill">${`<i class="on">${STAR_SVG}</i>`.repeat(Math.min(stars, 10))}</span></div>`;
  const n = goal.cost <= 15 ? goal.cost : 10, per = goal.cost / n, have = Math.min(n, Math.floor(stars / per)), left = Math.max(0, goal.cost - stars);
  return `<div class="strack ${size}" style="--n:${n}" role="img" aria-label="${esc(kid.name)}: ${Math.min(stars, goal.cost)} of ${goal.cost} stars for ${esc(goal.title)}"><span class="sfill">${[...Array(n)].map((_, i) => `<i class="${i < have ? 'on' : ''}">${STAR_SVG}</i>`).join('')}</span>${kart(goal.emoji || '🎁', goal.title, 'sgoal')}${size === 'xl' ? '' : `<span class="sleft">${left ? `${left} to go` : 'Got it!'}</span>`}</div>`;
}
function kidsStripHTML() {
  const ks = kids(); if (isPhone() || !ks.length || !S.rewards.length && !ks.some(k => starsOf(k))) return '';
  return `<button class="kstrip" data-act="go" data-view="kids" aria-label="Open the kids screen">${ks.map(k => `<span class="ksrow" style="--c:${esc(k.color)}">${avatar(k)}<b>${esc(k.name)}</b>${starTrack(k)}</span>`).join('')}</button>`;
}
function moneyOf(kid) { const p = settings().pocket || {}; return p.on ? '$' + (starsOf(kid) * (+p.perStar || 0)).toFixed(2) : ''; }
function kidColumn(kid, k, now) {
  const h = hoursFloat(now), {now: r, next} = currentRoutine(kid, k, h);
  const steps = r ? (r.steps || []) : [];
  const doneSteps = r ? steps.filter(st => tickOf(kid, 'step', r.id + ':' + st.id, k)).length : 0;
  const allDone = r && steps.length && doneSteps === steps.length;
  const chores = S.chores.filter(c => forKid(c, kid) && onDay(c, k));
  const stars = starsOf(kid), goal = S.rewards.filter(w => w.cost > stars).sort((a, b) => a.cost - b.cost)[0] || S.rewards[S.rewards.length - 1];
  const tile = (done, act, data, emoji, label, extra = '') => `<button class="ktile ${done ? 'done' : ''}" data-act="${act}" ${data} aria-pressed="${done}">${kart(emoji || '⭐', label)}<span class="lb">${esc(label)}</span>${extra}${done ? `<span class="ok">${icon('check')}</span>` : ''}</button>`;
  return `<section class="kid" style="--c:${esc(kid.color)}">
    <header class="kh">${avatar(kid, 'lg')}<div class="grow"><h2>${esc(kid.name)}</h2>${goal ? `<div class="goalname">${kart(goal.emoji || '🎁', goal.title, 'gi')} ${esc(goal.title)}</div>` : ''}</div>
      <button class="jar" data-act="kid-rewards" data-id="${kid.id}" aria-label="${esc(kid.name)} has ${stars} stars"><span class="st">${icon('star')}</span><b class="num">${stars}</b>${moneyOf(kid) ? `<small class="num">${moneyOf(kid)}</small>` : ''}</button></header>
    ${goal ? `<button class="kstars" data-act="kid-rewards" data-id="${kid.id}">${starTrack(kid, 'lg')}</button>` : ''}
    ${r ? `<div class="kblock"><div class="kt">${r.emoji ? kart(r.emoji, r.name, 'kti') : ''} ${esc(routineName(r))}<span class="num">${doneSteps}/${steps.length}</span></div>
      ${allDone ? `<div class="kdone">${icon('star')} All done! Great job, ${esc(kid.name)}.</div>` : ''}
      <div class="ktiles">${steps.map(st => tile(tickOf(kid, 'step', r.id + ':' + st.id, k), 'kid-step', `data-kid="${kid.id}" data-r="${r.id}" data-s="${esc(st.id)}"`, st.emoji, st.label)).join('')}</div></div>`
      : ''}
    ${(b => b ? `<div class="kblock"><div class="kt">${k === dayKey(now) && h < 15 ? 'Bring today' : 'Pack for tomorrow'}</div><div class="kbring">${b.items.map(r => `<span><b>${kart(r.emoji || '🎒', r.title, 'kbi')}</b>${esc(r.title)}</span>`).join('')}</div></div>` : '')(bringFor(h < 15 ? k : addDaysKey(k, 1)).find(x => x.m.id === kid.id))}
    ${chores.length ? `<div class="kblock"><div class="kt">Jobs</div><div class="ktiles">${chores.map(c => tile(tickOf(kid, 'chore', c.id, k), 'kid-chore', `data-kid="${kid.id}" data-c="${c.id}"`, c.emoji, c.title, `<span class="sv" aria-label="${c.stars} star${c.stars === 1 ? '' : 's'}">${STAR_SVG.repeat(Math.min(c.stars, 3))}</span>`)).join('')}</div></div>` : ''}
    ${!r ? `<div class="kblock knext"><div class="kt">${next ? `Later: ${next.emoji ? kart(next.emoji, next.name, 'kti') : ''} ${esc(routineName(next))}<span class="num">from ${esc(fmtHM(next.starts))}</span>` : 'No more routines today'}</div>${next ? `<div class="kpreview">${(next.steps || []).map(st => `<span title="${esc(st.label)}">${kart(st.emoji || '⭐', st.label, 'kpi')}</span>`).join('')}</div>` : ''}</div>` : ''}
  </section>`;
}
V.kid = () => {
  const kid = memberById(S.activeMember); if (!kid || kid.kind !== 'kid') { S.view = 'kids'; return V.kids(); }
  const now = new Date(); return `<div class="page kidsolo" style="--c:${esc(kid.color)}">${kidColumn(kid, dayKey(now), now)}</div>`;
};
V.kids = () => {
  const now = new Date(), k = dayKey(now), ks = kids();
  if (!ks.length) return `<div class="page"><h1>Kids</h1><div class="panel"><p class="help">Add the kids in Settings → Family (set Who to Kid), then their routines and jobs show here.</p><button class="btn" data-act="go" data-view="settings" data-tab="family">Add a kid</button></div></div>`;
  const empty = !S.routines.length && !S.chores.length;
  return `<div class="page kids-page" style="max-width:none"><h1>Kids<span class="sp"></span><button class="btn" data-act="timer-open">${icon('timer')}Timer</button><button class="btn soft" data-act="go" data-view="settings" data-tab="kids">${icon('gear')}Set up</button></h1>
    ${empty ? `<div class="panel"><h2>Picture routines and jobs</h2><p class="help">Big tap-to-tick pictures for mornings and bedtime, small jobs that earn stars, and rewards to save for. Start with a ready-made set and change it later.</p><button class="btn" data-act="kids-starter">${icon('plus')}Add the starter set</button></div>` : ''}
    <div class="kidsgrid" style="--n:${Math.min(ks.length, 3)}">${ks.map(kid => kidColumn(kid, k, now)).join('')}</div></div>`;
};

