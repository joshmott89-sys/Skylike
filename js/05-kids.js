// Skylike: kids. Part 5 of 11; all parts share one global scope and load in order (index.html).
/* ----- kids: picture routines, chores, stars ----- */
const kids = () => S.members.filter(m => m.kind === 'kid');
const hm = t => { const [a, b] = String(t || '0:0').split(':').map(Number); return a + (b || 0) / 60; };
const forKid = (row, kid) => !row.member_id || row.member_id === kid.id;
const onDay = (row, k, kid) => {
  if (row.when_mode === 'school' || row.when_mode === 'home') { const at = kid ? kidAtSchool(kid, k) : kidsAtSchool(k).length > 0; return row.when_mode === 'school' ? at : !at; }
  return !row.days || !row.days.length || row.days.includes(weekdayOfKey(k));
};
const tickOf = (kid, kind, ref, k) => S.ticks.find(t => t.member_id === kid.id && t.kind === kind && t.ref === ref && t.day === k);
function currentRoutine(kid, k, h) {
  const rs = S.routines.filter(r => forKid(r, kid) && onDay(r, k, kid));
  return {now: rs.find(r => h >= hm(r.starts) && h < hm(r.ends)), next: rs.filter(r => hm(r.starts) > h).sort((a, b) => hm(a.starts) - hm(b.starts))[0]};
}
const stepStars = r => Math.max(0, +r.step_stars || 0);
const bonusOf = r => r.bonus == null ? 1 : Math.max(0, +r.bonus || 0);
// The routine on now for any kid that still has steps left (wakes the tablet to the Kids board).
function liveRoutine(now = new Date()) {
  const k = dayKey(now), h = hoursFloat(now);
  for (const kd of kids()) { const r = currentRoutine(kd, k, h).now; if (r && (r.steps || []).some(st => !tickOf(kd, 'step', r.id + ':' + st.id, k))) return r; }
  return null;
}
const pips = n => n ? `<span class="sv" aria-label="${n} star${n === 1 ? '' : 's'}">${n > 3 ? STAR_SVG + `<b class="num">${n}</b>` : STAR_SVG.repeat(n)}</span>` : '';
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
  const each = r ? stepStars(r) : 0, bonus = r ? bonusOf(r) : 0;
  const worth = r ? [each ? `<span>${STAR_SVG}<b class="num">${each}</b> each picture</span>` : '', bonus ? `<span>${STAR_SVG}<b class="num">+${bonus}</b> bonus for all of them</span>` : ''].filter(Boolean).join('<i></i>') : '';
  // the finish line: a last tile that shows the bonus and lights up when every picture is ticked
  const finish = r && bonus ? `<div class="ktile kgoal ${allDone ? 'got' : ''}" aria-label="${allDone ? 'Bonus earned' : `Finish all ${steps.length} for ${bonus} bonus star${bonus === 1 ? '' : 's'}`}"><span class="kgs">${STAR_SVG}<b class="num">+${bonus}</b></span><span class="lb">${allDone ? 'Got it!' : 'All done'}</span></div>` : '';
  const routineBlock = r ? `<div class="kblock kroutine"><div class="kt">${r.emoji ? kart(r.emoji, r.name, 'kti') : ''} ${esc(routineName(r))}<span class="num">${doneSteps} of ${steps.length}</span></div>
      ${worth ? `<div class="kworth">${worth}</div>` : ''}
      ${allDone ? `<div class="kdone">${icon('star')} All done! Great job, ${esc(kid.name)}.</div>` : ''}
      <div class="ktiles">${steps.map(st => tile(tickOf(kid, 'step', r.id + ':' + st.id, k), 'kid-step', `data-kid="${kid.id}" data-r="${r.id}" data-s="${esc(st.id)}"`, st.emoji, st.label, pips(each))).join('')}${finish}</div></div>` : '';
  const starsBlock = goal ? `<button class="kstars" data-act="kid-rewards" data-id="${kid.id}">${starTrack(kid, r ? '' : 'lg')}</button>` : '';
  return `<section class="kid ${r ? 'live' : ''}" style="--c:${esc(kid.color)}">
    <header class="kh">${avatar(kid, 'lg')}<div class="grow"><h2>${esc(kid.name)}</h2>${goal ? `<div class="goalname">${kart(goal.emoji || '🎁', goal.title, 'gi')} ${esc(goal.title)}</div>` : ''}</div>
      <button class="jar" data-act="kid-rewards" data-id="${kid.id}" aria-label="${esc(kid.name)} has ${stars} stars"><span class="st">${icon('star')}</span><b class="num">${stars}</b>${moneyOf(kid) ? `<small class="num">${moneyOf(kid)}</small>` : ''}</button></header>
    ${r ? routineBlock + starsBlock : starsBlock}
    ${(b => b ? `<div class="kblock"><div class="kt">${k === dayKey(now) && h < 15 ? 'Bring today' : 'Pack for tomorrow'}</div><div class="kbring">${b.items.map(r => `<span><b>${kart(r.emoji || '🎒', r.title, 'kbi')}</b>${esc(r.title)}</span>`).join('')}</div></div>` : '')(bringFor(h < 15 ? k : addDaysKey(k, 1)).find(x => x.m.id === kid.id))}
    ${chores.length ? `<div class="kblock"><div class="kt">Jobs</div><div class="ktiles">${chores.map(c => tile(tickOf(kid, 'chore', c.id, k), 'kid-chore', `data-kid="${kid.id}" data-c="${c.id}"`, c.emoji, c.title, pips(c.stars))).join('')}</div></div>` : ''}
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
  const live = liveRoutine(now);
  const title = live ? `<span class="ktitle">${live.emoji ? kart(live.emoji, live.name, 'kti') : ''}${esc(routineName(live))}<small>Tap each picture when you've done it · until ${esc(fmtHM(live.ends))}</small></span>` : 'Kids';
  return `<div class="page kids-page" style="max-width:none"><h1>${title}<span class="sp"></span><button class="btn" data-act="timer-open">${icon('timer')}Timer</button><button class="btn soft" data-act="go" data-view="settings" data-tab="kids">${icon('gear')}Set up</button></h1>
    ${empty ? `<div class="panel"><h2>Picture routines and jobs</h2><p class="help">Big tap-to-tick pictures for mornings and bedtime, small jobs that earn stars, and rewards to save for. Start with a ready-made set and change it later.</p><button class="btn" data-act="kids-starter">${icon('plus')}Add the starter set</button></div>` : ''}
    <div class="kidsgrid" style="--n:${Math.min(ks.length, 3)}">${ks.map(kid => kidColumn(kid, k, now)).join('')}</div></div>`;
};

