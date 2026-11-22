// Skylike: setup. Part 4 of 11; all parts share one global scope and load in order (index.html).
/* ----- guided setup: checklist, device setup, quick tour ----- */
function setupSteps() {
  const adultsSignedIn = S.members.filter(m => m.kind !== 'kid' && m.user_id).length;
  return [
    ['family', 'Add your family', 'Each parent and kid, with a colour and an emoji', S.members.length >= 2, {act: 'go', view: 'settings', tab: 'family'}],
    ['partner', 'Invite your partner', 'They sign in on their phone and enter your code', adultsSignedIn >= 2, {act: 'invite'}],
    ...(deviceKind() === 'phone' ? [['notify', 'Notifications on this phone', 'To-dos given to you, time to leave, bins tonight', !!LS.get('pushOn', false), {act: 'go', view: 'settings', tab: 'notify'}]] : []),
    ['calendar', 'Connect your calendars', 'Paste each Google calendar\'s secret link', !!(S.calStatus && S.calStatus.connected), {act: 'go', view: 'settings', tab: 'calendar'}],
    ['screen', 'Set up the wall screen', 'Keep it awake and locked to Skylike', S.devices.some(d => d.kind === 'tablet'), {act: 'device-setup'}],
    ['bins', 'Add bin days', 'So the screen says which bins go out', S.reminders.length > 0, {act: 'go', view: 'settings', tab: 'reminders'}],
    ['kids', 'Kids\' routines and jobs', 'Picture routines and stars', !kids().length || S.routines.length > 0, {act: 'go', view: 'kids'}],
    ['kitchen', 'Turn on the AI helper', 'Free key for meals, pantry photos, brain-dump', !!S.aiOn, {act: 'go', view: 'settings', tab: 'kitchen'}],
    ['photos', 'Add some family photos', 'For the idle screen', S.photos.length > 0, {act: 'go', view: 'settings', tab: 'photos'}]];
}
function setupListHTML() {
  return setupSteps().map(([id, t, sub, done, go]) => `<div class="sstep ${done ? 'done' : ''}"><span class="sdot">${done ? icon('check') : ''}</span><div class="grow"><b>${t}</b><div class="lbl">${sub}</div></div>${done ? '' : `<button class="btn soft" data-act="${go.act}" ${go.view ? `data-view="${go.view}"` : ''} ${go.tab ? `data-tab="${go.tab}"` : ''}>Start</button>`}</div>`).join('');
}
function joinersHTML(days) {
  const cut = Date.now() - days * 864e5, me = (S.session && S.session.user || {}).id;
  const list = (S.joins || []).filter(j => j.user_id !== me && Date.parse(j.created_at) > cut);
  if (!list.length) return '';
  return `<div class="lbl" style="margin-top:12px">Joined lately</div><ul class="plist">${list.map(j => { const m = S.members.find(x => x.user_id === j.user_id); return `<li>${m ? avatar(m) : ''}<span><b>${esc(m ? m.name : 'Someone')}</b><small>${esc(fmtDay(j.created_at.slice(0, 10), {weekday: 'short', day: 'numeric', month: 'short'}))}</small></span></li>`; }).join('')}</ul>`;
}
function joinNoticeHTML() {
  if (DEMO) return '';
  const me = (S.session && S.session.user || {}).id, seen = +LS.get('joinSeen', 0) || 0;
  const j = (S.joins || []).filter(x => x.user_id !== me && Date.parse(x.created_at) > Date.now() - 7 * 864e5 && Date.parse(x.created_at) > seen).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!j) return '';
  const m = S.members.find(x => x.user_id === j.user_id);
  return `<div class="joinnote">${icon('family')}<span class="grow"><b>${esc(m ? m.name : 'Someone new')} joined the family</b><small>${esc(fmtDay(j.created_at.slice(0, 10), {weekday: 'long', day: 'numeric', month: 'short'}))}. Not someone you know? Make a new code in Settings, Household.</small></span><button class="btn ghost sm" data-act="joiner-ok" data-at="${Date.parse(j.created_at)}">OK</button></div>`;
}
function setupCardHTML() {
  if ((DEMO && !window.__showSetup) || settings().setupHidden) return '';
  const steps = setupSteps(), done = steps.filter(x => x[3]).length; if (done === steps.length) return '';
  const next = steps.find(x => !x[3]);
  return `<div class="setupcard"><div class="sc-ring" style="--p:${done / steps.length * 360}deg"><b class="num">${done}/${steps.length}</b></div>
    <div class="grow"><b>Get Skylike ready</b><div class="lbl">Next: ${next[1]}</div></div>
    <button class="btn" data-act="${next[4].act}" ${next[4].view ? `data-view="${next[4].view}"` : ''} ${next[4].tab ? `data-tab="${next[4].tab}"` : ''}>Start</button><button class="btn ghost" data-act="setup-all">See all</button></div>`;
}
const TOUR = [
  ['sun', 'Today, at a glance', 'The sky strip shows the day: every event sits at its time, the sun moves along. Chips below say what to wear, which bins go out and what to bring.'],
  ['star', 'Kids', 'Picture routines for mornings and bedtime that kids tap through themselves, small jobs that earn stars, and rewards to save for.'],
  ['meal', 'Meals and groceries', 'Plan the week\'s dinners, keep track of what\'s in, and dump the whole shopping list in one go. Tick it off at the shops and the pantry updates.'],
  ['mobile', 'Your phone', 'Same family, live. Each parent can open to their own view: Focus (one thing at a time) or Planner (checklist first). Changes show on the wall in seconds.'],
  ['moon', 'Looks after itself', 'When nobody\'s touching it, it shows a clock and family photos, dims at night, and updates itself. Tap anywhere to come back.']];
function tourSheet(i = 0) {
  const [e, t, d] = TOUR[i];
  sheet(`<div class="tour"><div class="te" style="--tc:${({sun: '#E0A21B', star: '#D9A21B', meal: '#C9772B', mobile: '#2F7BB5', moon: '#5B5FB0'})[e]}">${icon(e)}</div><h2>${t}</h2><p>${d}</p><div class="tdots">${TOUR.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row" style="justify-content:center">${i < TOUR.length - 1 ? `<button class="btn ghost" data-act="tour-end">Skip</button><button class="btn" data-act="tour" data-i="${i + 1}">Next</button>` : `<button class="btn" data-act="tour-end">Let's go</button>`}</div></div>`);
}
// First open on a phone: offer notifications straight after "Whose phone is this?", then the quick tour.
function afterIntro() { if (!LS.get('toured', 0)) setTimeout(() => tourSheet(0), 400); }
function notifyIntro(force) {
  if ((DEMO && !force) || LS.get('pushOn', false)) return afterIntro();
  const ios = isIOS(), needsInstall = ios && !isStandalone(), ok = pushSupported() && !needsInstall && Notification.permission !== 'denied';
  if (!ok && !needsInstall) return afterIntro();
  const me = meMember();
  sheet(`<div class="tour"><div class="te" style="--tc:#E0A21B">${icon('bell')}</div><h2>Get a nudge on your phone</h2>
    <ul class="nlist"><li>${icon('check')} When someone gives you a to-do</li><li>${icon('car')} About 10 minutes before you need to leave</li><li>${icon('bin')} Bins out, lunchboxes and defrosting, the night before</li></ul>
    ${needsInstall ? `<p class="help" style="text-align:left"><b>On iPhone, add Skylike to your Home Screen first:</b> tap Share, then <b>Add to Home Screen</b>, open it from the new icon, and turn notifications on in Settings → Notifications.</p>
      <div class="row" style="justify-content:center"><button class="btn" data-act="intro-push-skip">Got it</button></div>`
    : `<p class="help">${me ? esc(me.name) + ', your' : 'Your'} phone will ask to allow them. Tap <b>Allow</b>.</p>
      <div class="row" style="justify-content:center"><button class="btn ghost" data-act="intro-push-skip">Not now</button><button class="btn" data-act="intro-push-on">${icon('bell')}Turn on notifications</button></div>`}
    <p class="help">You can change this any time in Settings → Notifications.</p></div>`, {focus: false});
}
function deviceSheet(step = 'kind') {
  const adults = S.members.filter(m => m.kind !== 'kid');
  if (step === 'kind') return sheet(`<h2>What is this device?</h2><p class="help">You can change this later in Settings → Screen.</p>
    <div class="dkinds"><button class="dkind" data-act="dev-kind" data-k="tablet"><span>${icon('tablet')}</span><b>The family screen</b><small>A tablet on the wall or bench that stays on</small></button>
    <button class="dkind" data-act="dev-kind" data-k="phone"><span>${icon('mobile')}</span><b>My phone</b><small>For checking and adding things on the go</small></button></div>`);
  if (step === 'phone') return sheet(`<h2>Whose phone is this?</h2><div class="dkinds">${adults.map(m => `<button class="dkind" data-act="dev-who" data-id="${m.id}">${avatar(m, 'lg')}<b>${esc(m.name)}</b></button>`).join('')}</div>`);
  const tabs = LS.get('kioskTab', /Windows/.test(navigator.userAgent) ? 'windows' : /iPad|Macintosh/.test(navigator.userAgent) ? 'ipad' : 'android');
  sheet(`<h2>Keep the family screen on</h2><p class="help">Plug it in for good. Then:</p>
    <span class="seg" style="margin-bottom:12px">${[['ipad', 'iPad'], ['android', 'Android'], ['windows', 'Windows / Surface']].map(([k, l]) => `<button class="${tabs === k ? 'on' : ''}" data-act="kiosk-tab" data-k="${k}">${l}</button>`).join('')}</span>
    ${tabs === 'windows' ? `<ol class="steps"><li><b>Windows Settings → System → Power</b> (Power &amp; battery): set <b>When plugged in, turn off my screen</b> and <b>put my device to sleep</b> to <b>Never</b>.</li><li>In <b>Edge</b>, open Skylike, then <b>⋯ → Apps → Install this site as an app</b>. It opens in its own window without browser bars. Press <b>F11</b> for full screen.</li><li>To open it when the PC starts: press <b>Win + R</b>, type <b>shell:startup</b>, and drag the Skylike app shortcut (from the Start menu) into that folder.</li><li>Optional, lock it to Skylike: <b>Settings → Accounts → Other users → Set up a kiosk</b>, choose <b>Microsoft Edge</b>, “As a digital sign or interactive display”, and paste the Skylike address. Sign in to Skylike inside the kiosk once: read the sign-in code on your phone and type it in.</li><li>On a Surface, turn on <b>Tablet mode</b> or detach the keyboard for bigger touch targets.</li></ol>`
    : tabs === 'ipad' ? `<ol class="steps"><li><b>Settings → Display &amp; Brightness → Auto-Lock → Never.</b></li><li>In Safari, tap <b>Share → Add to Home Screen</b>, then open Skylike from that icon.</li><li><b>Settings → Accessibility → Guided Access</b>: turn it on, set a passcode, set Display Auto-Lock to Never.</li><li>Open Skylike, <b>triple-click</b> the top (or home) button, tap <b>Start</b>.</li></ol>`
      : `<ol class="steps"><li><b>Settings → Developer options → Stay awake</b> (while charging). To show Developer options, tap Build number 7 times in About phone/tablet.</li><li>In Chrome, tap <b>⋮ → Add to Home screen</b>, then open Skylike from that icon.</li><li><b>Settings → Security → App pinning</b>: turn it on.</li><li>Open Skylike, open Recent apps, tap its icon and choose <b>Pin</b>.</li></ol>`}
    <p class="help">Check later from your phone in Settings → Devices: it should say “seen just now”.</p><button class="btn" data-act="dev-done">Done</button>`);
}
