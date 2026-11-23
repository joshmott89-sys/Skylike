/* ---- email to calendar ----
   Emails labelled "Skylike" in Gmail are read by the household's calendar bridge every 15 minutes.
   Dates found in them arrive here as suggestions; nothing goes on the calendar until someone ticks it. */
const mailNew = () => (S.mail || []).filter(m => m.status === 'new');
const mailById = id => (S.mail || []).find(m => m.id === id);
const mailFrom = m => String(m.sender || '').split(/\s+/).slice(0, 3).join(' ') || 'Email';

function mailNoteHTML() {
  const L = mailNew(); if (!L.length) return '';
  const n = L.reduce((a, m) => a + ((m.events || []).length || 1), 0);
  return `<button class="mailnote" data-act="mail-open">${icon('mail')}<span><b>${L.length === 1 ? 'An email' : L.length + ' emails'} with dates to check</b><small>${esc(L.length === 1 ? mailFrom(L[0]) + ': ' + (L[0].subject || '') : L.map(mailFrom).slice(0, 3).join(', '))}</small></span><span class="n num">${n}</span></button>`;
}
function mailSheet() {
  const L = mailNew(); if (!L.length) return closeSheet();
  if (L.length === 1) return mailCheck(L[0].id);
  sheet(`<h2>From email</h2><p class="help">Dates found in emails labelled Skylike. Nothing is added until you say so.</p>
    <ul class="mlist">${L.map(m => `<li><span class="grow"><b>${esc(m.subject || '(no subject)')}</b><small>${esc(mailFrom(m))}${m.received_at ? ' · ' + esc(fmtDay(dayKey(new Date(m.received_at)), {day: 'numeric', month: 'short'})) : ''} · ${(m.events || []).length ? (m.events.length === 1 ? '1 date' : m.events.length + ' dates') : 'no dates found'}</small></span>
      <button class="btn soft sm" data-act="mail-check" data-id="${m.id}">Check</button><button class="btn ghost sm" data-act="mail-dismiss" data-id="${m.id}" aria-label="Dismiss ${esc(m.subject || 'email')}">Dismiss</button></li>`).join('')}</ul>`, {focus: false});
}
function mailCheck(id) {
  const m = mailById(id); if (!m) return;
  const evs = (m.events || []).filter(e => e && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date || ''));
  if (!evs.length) {
    S._mailText = (m.subject || '').slice(0, 120);
    return sheet(`<h2>${esc(m.subject || 'Email')}</h2><p class="help">From ${esc(mailFrom(m))}. No dates were found automatically${S.aiOn ? '' : ' (reading emails needs the free AI helper, Settings → Kitchen)'}.</p>
      <div class="row"><button class="btn" data-act="mail-as-event" data-id="${m.id}">${icon('plus')}Add an event</button><button class="btn ghost" data-act="mail-dismiss" data-id="${m.id}">Dismiss</button></div>`);
  }
  S._mailSug = m.id;
  S._evReview = evs.map(e => ({title: String(e.title).slice(0, 120), day: e.date, lastday: /^\d{4}-\d{2}-\d{2}$/.test(e.last_date || '') && e.last_date > e.date ? e.last_date : '', start: /^\d{2}:\d{2}$/.test(e.start || '') ? e.start : '', end: /^\d{2}:\d{2}$/.test(e.end || '') ? e.end : '',
    all_day: !/^\d{2}:\d{2}$/.test(e.start || ''), location: e.location || '', notes: e.note || '', who: ''}));
  S._evFallback = ''; reviewSheet();
  const h = document.querySelector('#sheet-root h2'); if (h) h.insertAdjacentHTML('afterend', `<p class="mfrom">${icon('mail', 'xs')} ${esc(mailFrom(m))}: ${esc(m.subject || '')}</p>`);
}
async function mailDone(id) {
  const m = mailById(id); if (!m) return;
  m.status = 'done'; if (S._mailSug === id) S._mailSug = null; render();
  if (!DEMO) await db(sb.from('email_suggestions').update({status: 'done'}).eq('id', id));
}

Object.assign(A, {
  'mail-open'() { mailSheet(); },
  'mail-check'(el) { mailCheck(el.dataset.id); },
  async 'mail-dismiss'(el) { await mailDone(el.dataset.id); toast('Dismissed'); if (mailNew().length) mailSheet(); else closeSheet(); },
  async 'mail-as-event'(el) { const t = S._mailText; await mailDone(el.dataset.id); closeSheet(); S._evDraft = {title: t}; eventForm(null); },
  async 'mail-check-now'(el) {
    if (DEMO) return toast('Sample data: nothing here is saved');
    el.disabled = true; toast('Checking email…');
    const r = await callFn({action: 'mail'}); el.disabled = false;
    if (r.error) return toast(r.error, 6000);
    if (r.note) return toast('Update the bridge script to turn on email (steps below).', 6000);
    const {data} = await sb.from('email_suggestions').select('*').eq('household_id', S.hid).eq('status', 'new').order('received_at', {ascending: false}).limit(30);
    if (data) S.mail = data; render();
    toast(r.added ? `${r.added} new email${r.added === 1 ? '' : 's'} to check` : r.checked ? 'Nothing new' : 'No emails labelled Skylike yet', 4000);
  },
});

// once the ticked events are added, the email is done
const _evImportSave = F['ev-import-save'];
F['ev-import-save'] = async function (f) {
  const id = S._mailSug, picked = f.querySelectorAll('input[name="pick"]:checked').length;
  const r = await _evImportSave.call(this, f);
  if (id && picked) mailDone(id);
  return r;
};

function mailSettingsHTML() {
  const hasBridge = S.calendars.some(c => !c.google_id.startsWith('ics:'));
  return `<div class="panel"><h2>${icon('mail')} Email to calendar</h2>
    <p class="help">School newsletters, party invites and appointment letters: put the Gmail label <b>Skylike</b> on them and the dates show up here to check, usually within 15 minutes. A Gmail filter can label them for you, for example everything from the school.</p>
    ${hasBridge ? `<ol class="steps"><li>In Gmail, make a label called <b>Skylike</b> and add it to an email with dates in it.</li>
      <li>Connected before email was added? Copy the script again (Two-way editing, above), paste it over the old one, then <b>Deploy → Manage deployments → pencil → New version → Deploy</b> and approve Gmail access. The address stays the same.</li></ol>
      <button class="btn soft" data-act="mail-check-now">${icon('refresh')}Check email now</button>`
    : `<p class="help"><span class="status warn">Needs the two-way link first</span> (above). The same script reads the labelled emails.</p>`}
    ${S.aiOn ? '' : '<p class="help">Reading the email needs the free AI helper (Settings → Kitchen). Calendar invites (.ics) work without it.</p>'}</div>`;
}
