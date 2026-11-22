// Skylike: shell. Part 8 of 11; all parts share one global scope and load in order (index.html).
/* ----- shell ----- */
const NAV = [['family','Home','home'],['kids','Kids','star'],['calendar','Calendar','cal'],['meals','Meals','meal'],['lists','Lists','list'],['house','House','family-home'],['notes','Notes','note'],['sitter','Sitter','sitter'],['settings','Settings','gear']];
function railHTML() {
  const adults = S.members.filter(m => m.kind !== 'kid');
  const sync = DEMO ? ['warn', 'Sample'] : !S.online ? ['bad', 'Offline'] : S.realtime === 'live' ? ['', 'Live'] : ['warn', S.realtime === 'lost' ? 'Retrying' : 'Linking'];
  const kidsList = kids(), kidOn = S.view === 'kid' && memberById(S.activeMember);
  const faceBtn = m => `<button class="who ${S.activeMember === m.id ? 'on' : ''}" data-act="me" data-id="${m.id}" aria-pressed="${S.activeMember === m.id}" aria-label="${esc(m.name)}'s view">${avatar(m)}<span>${esc(m.name)}</span></button>`;
  const KNAV = [['kid', 'My day', 'star'], ['kid-stars', 'Rewards', 'gift'], ['kid-timer', 'Timer', 'timer']];
  return `<div class="faces">${adults.map(faceBtn).join('')}${kidsList.length ? `<i class="fdiv"></i>${kidsList.map(faceBtn).join('')}` : ''}</div>
    ${kidOn ? KNAV.map(([v, l, ic]) => `<button class="navbtn kidnav ${v === 'kid' ? 'on' : ''}" data-act="${v === 'kid' ? 'go' : v}" data-view="kid" data-id="${kidOn.id}">${icon(ic)}${l}</button>`).join('') + `<span class="grow"></span><button class="navbtn" data-act="me" data-id="${kidOn.id}">${icon('home')}Grown-ups</button>` : NAV.filter(([v]) => !(v === 'kids' && kidsList.length)).map(([v, l, ic]) => `<button class="navbtn ${(S.view === v || (v === 'family' && ['focus','planner'].includes(S.view))) ? 'on' : ''}" data-act="go" data-view="${v}">${icon(ic)}${l}</button>`).join('') + '<span class="grow"></span>'}
    <button class="syncdot ${sync[0]}" data-act="go" data-view="settings" data-tab="admin" title="${S.lastData ? 'Updated ' + ago((Date.now() - S.lastData) / 60e3) : ''}"><i></i>${sync[1]}</button>`;
}
function tabbarHTML() {
  const T = [['family','Today','home'],['calendar','Calendar','cal'],['lists','Lists','list'],['meals','Meals','meal'],['settings','More','gear']];
  return T.map(([v, l, ic]) => `<button class="${S.view === v || (v === 'family' && ['focus','planner'].includes(S.view)) || (v === 'settings' && ['sitter', 'notes', 'kids', 'house'].includes(S.view)) || (v === 'meals' && S.view === 'spend') ? 'on' : ''}" data-act="go" data-view="${v}">${icon(ic)}${l}</button>`).join('');
}
function renderRail() { const r = $('.rail'); if (!r) return; const h = railHTML(); if (r._h !== h) { r.innerHTML = h; r._h = h; } }
// any touch or typing may change the page directly (drags, folds, toggles), so the next redraw always runs in full
['pointerdown', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, () => { const m = document.getElementById('main'), r = document.querySelector('.rail'); if (m) m._h = null; if (r) r._h = null; }, {capture: true, passive: true}));
function renderSkyOnly() { const s = $('.sky'); if (s) { const compact = s.classList.contains('compact'); s.outerHTML = skyHTML(compact); } }

let raf = 0;
function render() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; doRender(); }); }
function doRender() {
  const app = $('#app');
  if (!S.session) return renderGate();
  if (!S.household) return renderOnboard();
  // keep focus and typing across re-renders
  const a = document.activeElement, fid = a && a.id, fval = a && a.value, sel = a && a.selectionStart;
  const scrollers = [...document.querySelectorAll('.scroll')].map(s => s.scrollTop);
  if (!$('.rail')) app.innerHTML = `<nav class="rail" aria-label="Family and views"></nav><main id="main"></main><nav class="tabbar" aria-label="Views"></nav>`;
  renderRail();
  const tb = tabbarHTML(), tabbar = $('.tabbar'); if (tabbar._h !== tb) { tabbar.innerHTML = tb; tabbar._h = tb; }
  const main = $('#main');
  const html = (V[S.view] || V.family)(), full = S.view === 'family' || S.view === 'focus' || S.view === 'planner' ? html : `<div class="scroll">${html}</div>`;
  // nothing changed (a sync that brought the same data, a tick with no new minute): leave the page alone, so scroll and taps aren't disturbed
  if (main._h === full) return;
  main.innerHTML = full; main._h = full;
  if (S.view === 'settings' && S.settingsTab === 'photos') loadThumbs();
  document.querySelectorAll('.scroll').forEach((s, i) => { if (scrollers[i]) s.scrollTop = scrollers[i]; });
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); if (fval != null) { el.value = fval; try { el.setSelectionRange(sel, sel); } catch {} } } }
}

/* ----- gate: sign in and onboarding ----- */
function renderGate() {
  const step = S._otpEmail ? 'code' : 'email';
  $('#app').innerHTML = `<div class="gate" style="grid-column:1/-1"><div class="card"><div class="logo" aria-hidden="true"></div>
    <h1>Skylike</h1><p>${step === 'email' ? "Your family's day, on one calm screen. Sign in with your email; we'll send a code." : `We sent a code to <b>${esc(S._otpEmail)}</b>. Type it here.`}</p>
    ${step === 'email' ? `<form data-form="otp-email"><div class="field"><label for="em">Email</label><input class="input" id="em" type="email" name="email" autocomplete="email" required></div><button class="btn" style="width:100%">Send my code</button></form>`
    : `<form data-form="otp-code"><div class="field"><label for="cd">Code</label><input class="input num" id="cd" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required style="font-size:28px;letter-spacing:.2em"></div><button class="btn" style="width:100%">Sign in</button><button type="button" class="btn ghost" style="width:100%;margin-top:6px" data-act="otp-back">Use a different email</button></form>`}
    <p class="err" id="gate-err" role="alert"></p></div></div>`;
}
function renderOnboard() {
  const joinCode = new URLSearchParams(location.search).get('join'); if (joinCode && !S._onboard) S._onboard = 'join';
  const mode = S._onboard || 'choose';
  $('#app').innerHTML = `<div class="gate" style="grid-column:1/-1"><div class="card"><div class="logo" aria-hidden="true"></div>
    ${mode === 'choose' ? `<h1>Welcome</h1><p>Set up your family, or join one your partner already made.</p>
      <button class="btn" style="width:100%;margin-bottom:10px" data-act="onboard" data-mode="create">Set up our household</button>
      <button class="btn soft" style="width:100%" data-act="onboard" data-mode="join">Join with a code</button>`
    : mode === 'create' ? `<h1>Your household</h1><p>Name it and add yourself. A short checklist then walks you through the rest (about 10 minutes).</p><form data-form="create-hh"><div class="field"><label for="hn">Household name</label><input class="input" id="hn" name="name" placeholder="The Smiths" required maxlength="80"></div>
      <div class="field"><label for="yn">Your first name</label><input class="input" id="yn" name="me" required maxlength="40"></div><button class="btn" style="width:100%">Create</button></form>`
    : `<h1>Join a household</h1><form data-form="join-hh"><div class="field"><label for="jc">Code</label><input class="input" id="jc" name="code" required maxlength="14" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCDE-FGHJK" value="${esc((new URLSearchParams(location.search).get('join') || '').toUpperCase())}" style="text-transform:uppercase;letter-spacing:.2em;font-size:24px"></div>
      <div class="field"><label for="yn2">Your first name</label><input class="input" id="yn2" name="me" required maxlength="40"></div><button class="btn" style="width:100%">Join</button></form>`}
    ${mode !== 'choose' ? `<button class="btn ghost" style="width:100%;margin-top:6px" data-act="onboard" data-mode="choose">Back</button>` : ''}
    <p class="err" id="gate-err" role="alert"></p><button class="btn ghost" style="width:100%" data-act="sign-out">Sign out</button></div></div>`;
}
const gateErr = m => { const e = $('#gate-err'); if (e) e.textContent = m; };

/* ----- sheets ----- */
function sheet(html, opt = {}) {
  const old = $('#sheet-root .sheet'), top = opt.keepScroll && old ? old.scrollTop : 0;
  $('#sheet-root').innerHTML = `<div class="sheet-bg" data-act="close-sheet"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  if (top) $('#sheet-root .sheet').scrollTop = top;
  if (opt.focus === false) return;
  const f = $('#sheet-root input:not([type=checkbox]):not([type=radio]):not([type=file]), #sheet-root textarea'); if (f) setTimeout(() => f.focus(), 60);
}
const closeSheet = () => { $('#sheet-root').innerHTML = ''; };
function noteSheet(defaultKind = 'note') {
  const me = meMember();
  sheet(`<h2>${defaultKind === 'capture' ? 'Quick add' : 'New note'}</h2><form data-form="capture">
    ${defaultKind === 'capture' ? `<div class="seg" style="margin-bottom:12px" role="radiogroup"><button type="button" class="on" data-act="cap-kind" data-kind="todo">To do</button><button type="button" data-act="cap-kind" data-kind="grocery">Groceries</button><button type="button" data-act="cap-kind" data-kind="note">Note</button></div>` : ''}
    <input type="hidden" name="kind" value="${defaultKind === 'capture' ? 'todo' : 'note'}"><input type="hidden" name="color" value="sand">
    <textarea class="input" name="text" id="cap-text" maxlength="500" required placeholder="${defaultKind === 'capture' ? 'Type it before it slips away' : 'Write a note for the family'}"></textarea>
    <div class="swatches" style="margin:12px 0" ${defaultKind === 'capture' ? 'hidden' : ''} data-swatches>${NOTE_COLOURS.map((c, i) => `<button type="button" class="sw n-${c} ${i === 0 ? 'on' : ''}" style="--c:var(--nc)" data-act="note-colour" data-c="${c}" aria-label="${c}"></button>`).join('')}</div>
    <div class="row"><span class="lbl grow">${me ? 'From ' + esc(me.name) : ''}</span><button type="button" class="btn soft" data-act="close-sheet">Cancel</button><button class="btn">Save</button></div></form>`);
}
function memberSheet(id) {
  const m = id ? memberById(id) : {name: '', color: FAMILY_COLOURS[S.members.length % FAMILY_COLOURS.length][1], kind: 'adult', home_view: 'family', emoji: ''};
  sheet(`<h2>${id ? 'Edit ' + esc(m.name) : 'Add someone'}</h2><form data-form="member" data-id="${id || ''}">
    <div class="field"><label for="mn">Name</label><input class="input" id="mn" name="name" value="${esc(m.name)}" required maxlength="40"></div>
    ${id ? `<div class="field"><div class="lbl">Photo</div><div class="row avrow">${avatar(m, 'lg')}<label class="btn soft">${icon('camera')} ${m.photo ? 'Change photo' : 'Add a photo'}<input type="file" accept="image/*" data-change="avatar-pick" data-id="${id}" hidden></label>${m.photo ? `<button type="button" class="btn ghost" data-act="avatar-del" data-id="${id}">Remove</button>` : ''}</div><p class="help">A face is easier than a letter, especially for little ones. It's kept in your family's private space.</p></div>` : ''}
    <div class="field"><label for="me">${id ? 'Or a picture' : 'Picture (optional)'}</label><input class="input" id="me" name="emoji" value="${esc(m.emoji || '')}" maxlength="4" style="width:120px;font-size:26px">
      <div class="facepick" role="group" aria-label="Pick a picture">${Object.keys(FACE).map(k => `<button type="button" class="fp" data-act="face-pick" data-k="${k}" style="--c:${esc(m.color)}" aria-label="${k}">${faceArt(k)}</button>`).join('')}</div>
      <p class="help">Tap a picture, or type an emoji. A letter in front (like V) stays beside the picture.</p></div>
    <div class="lbl">Colour</div><div class="swatches" style="margin:8px 0 14px">${FAMILY_COLOURS.map(([n, c]) => `<button type="button" class="sw ${m.color === c ? 'on' : ''}" style="--c:${c}" data-act="pick-colour" data-c="${c}" aria-label="${n}"></button>`).join('')}</div>
    <input type="hidden" name="color" value="${esc(m.color)}">
    <div class="row"><div class="grow"><div class="lbl">Who</div><select class="input" name="kind"><option value="adult" ${m.kind === 'adult' ? 'selected' : ''}>Adult</option><option value="kid" ${m.kind === 'kid' ? 'selected' : ''}>Kid</option></select></div>
      <div class="grow"><div class="lbl">Home view</div><select class="input" name="home_view"><option value="family" ${m.home_view === 'family' ? 'selected' : ''}>Family</option><option value="focus" ${m.home_view === 'focus' ? 'selected' : ''}>Focus: today only, big and simple</option><option value="planner" ${m.home_view === 'planner' ? 'selected' : ''}>Planner: checklist and week</option></select></div></div>
    <div class="row" style="margin-top:16px">${id && !m.user_id ? `<button type="button" class="btn ghost" data-act="del-row" data-table="members" data-id="${id}">Remove</button>` : ''}<span class="grow"></span><button type="button" class="btn soft" data-act="close-sheet">Cancel</button><button class="btn">Save</button></div></form>`);
}

