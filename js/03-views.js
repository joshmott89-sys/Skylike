// Skylike: views. Part 3 of 11; all parts share one global scope and load in order (index.html).
/* ----- views ----- */
const V = {};
/* Photo faces: pick a photo, drag and zoom it into the circle, saved small (about 15 KB) on the member. */
function cropSheet(file, id) {
  const url = URL.createObjectURL(file), img0 = new Image();
  img0.onerror = () => { URL.revokeObjectURL(url); toast("That photo couldn't be opened. Try another, or take a new one.", 5000); };
  img0.onload = () => {
    // copy into our own canvas straight away: iPad Safari can drop the original once the file link is released
    const sc0 = Math.min(1, 1400 / Math.max(img0.naturalWidth || img0.width, img0.naturalHeight || img0.height)), img = document.createElement('canvas');
    img.width = Math.max(1, Math.round((img0.naturalWidth || img0.width) * sc0)); img.height = Math.max(1, Math.round((img0.naturalHeight || img0.height) * sc0)); img.getContext('2d').drawImage(img0, 0, 0, img.width, img.height);
    const C = {img, id, z: 1, x: 0, y: 0, base: 0};
    sheet(`<h2>Fit the photo</h2><p class="help">Drag to move it, slide to zoom. The circle is what everyone sees.</p>
      <div class="cropbox"><canvas id="cropc" width="560" height="560" aria-label="Photo crop preview"></canvas></div>
      <label class="cropzl"><span class="lbl">Zoom</span><input type="range" id="cropz" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></label>
      <div class="row" style="margin-top:12px"><button class="btn" data-act="crop-save">Use this photo</button><button class="btn ghost" data-act="crop-cancel" data-id="${id}">Cancel</button></div>`, {focus: false});
    const cv = $('#cropc'), ctx = cv.getContext('2d'), N = cv.width; C.base = Math.max(N / img.width, N / img.height); S._crop = C;
    const clamp = () => { const w = img.width * C.base * C.z, h = img.height * C.base * C.z, mx = Math.max(0, (w - N) / 2), my = Math.max(0, (h - N) / 2); C.x = Math.max(-mx, Math.min(mx, C.x)); C.y = Math.max(-my, Math.min(my, C.y)); };
    const draw = () => { clamp(); const sc = C.base * C.z; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N); ctx.drawImage(img, N / 2 - img.width * sc / 2 + C.x, N / 2 - img.height * sc / 2 + C.y, img.width * sc, img.height * sc);
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.rect(0, 0, N, N); ctx.arc(N / 2, N / 2, N / 2 - 6, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(N / 2, N / 2, N / 2 - 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); };
    C.draw = draw; draw(); requestAnimationFrame(draw); setTimeout(draw, 350); // again once the sheet has opened
    let drag = null; const k = () => N / cv.getBoundingClientRect().width;
    cv.addEventListener('pointerdown', e => { drag = {x: e.clientX, y: e.clientY, ox: C.x, oy: C.y}; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!drag) return; C.x = drag.ox + (e.clientX - drag.x) * k(); C.y = drag.oy + (e.clientY - drag.y) * k(); draw(); });
    cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('pointercancel', () => { drag = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); C.z = Math.max(1, Math.min(4, C.z * (e.deltaY < 0 ? 1.08 : 0.93))); $('#cropz').value = C.z; draw(); }, {passive: false});
    $('#cropz').addEventListener('input', e => { C.z = +e.target.value; draw(); });
    URL.revokeObjectURL(url);
  };
  img0.src = url;
}
/* Location box: saved places as one-tap chips, and type-to-search (OpenStreetMap's Photon, near home). */
function locField(value, opts = {}) {
  const pl = places(), lid = 'loc' + Math.random().toString(36).slice(2, 8);
  return `<div class="locf">${opts.noChips || !pl.length ? '' : `<div class="locchips">${pl.map(p => `<button type="button" class="chip3 ${value && normLoc(value) === normLoc(p.name) ? 'on' : ''}" data-act="loc-place" data-name="${esc(p.name)}">${placeIcon(p.emoji)} ${esc(p.name)}</button>`).join('')}</div>`}
    <div class="row locrow"><input class="input grow" id="${lid}" name="${opts.name || 'location'}" data-locsearch="1" placeholder="${opts.ph || 'Where? Type or say it, e.g. Bounce'}" value="${esc(value || '')}" maxlength="200" autocomplete="off" autocapitalize="words">${micBtn('#' + lid)}</div>
    <input type="hidden" name="${opts.name || 'location'}_lat"><input type="hidden" name="${opts.name || 'location'}_lon">
    <div class="locsug" role="listbox" hidden></div></div>`;
}
let locTimer = 0, locSeq = 0;
// "144 Mill Point Rd" → "144 Mill Point Road": the free map only knows the long forms
const STREET_ABBR = {rd: 'Road', st: 'Street', ave: 'Avenue', av: 'Avenue', dr: 'Drive', cres: 'Crescent', cr: 'Crescent', hwy: 'Highway', pde: 'Parade', pl: 'Place', ct: 'Court', tce: 'Terrace', blvd: 'Boulevard', bvd: 'Boulevard', cl: 'Close', ln: 'Lane', wy: 'Way', gr: 'Grove', sq: 'Square', cct: 'Circuit', esp: 'Esplanade', mews: 'Mews', fwy: 'Freeway'};
const expandStreet = q => String(q).replace(/\b([A-Za-z]+)\.?(?=\s|,|$)/g, (m, w, i, all) => { const L = STREET_ABBR[w.toLowerCase()]; return L && i > 0 && /\S\s+$/.test(all.slice(0, i)) && !/^st$/i.test(w) || (L && /^st$/i.test(w) && i > 0 && /[a-z]\s+$/i.test(all.slice(0, i))) ? L : m; });
function locSearch(inp) {
  const box = inp.closest('.locf').querySelector('.locsug'), q = inp.value.trim(); clearTimeout(locTimer);
  inp.form && (inp.form.querySelector(`[name="${inp.name}_lat"]`).value = '');
  if (q.length < 3 || placeFor(q)) { box.hidden = true; box.innerHTML = ''; return; }
  locTimer = setTimeout(async () => {
    const seq = ++locSeq, h = settings().location && settings().location.lat ? settings().location : {lat: -31.95, lon: 115.86};
    try {
      const qq = expandStreet(q), num = (qq.match(/^\s*(\d+[a-z]?(?:[\/-]\d+[a-z]?)?)\s+\D/i) || [])[1];
      // a street on the map without this house number: keep the number you typed, use the street for drive times
      const withNum = (name, street, area, isStreet, sub) => isStreet && num && !/^\d/.test(name) ? {name: `${num} ${name}`, sub: area, streetOnly: true} : {name, sub};
      const r = await fetch(`https://photon.komoot.io/api/?limit=7&lang=en&lat=${h.lat}&lon=${h.lon}&location_bias_scale=0.6&q=${encodeURIComponent(qq)}`); const d = await r.json(); if (seq !== locSeq) return;
      const seen = new Set();
      let list = (d.features || []).filter(f => (f.properties.countrycode || 'AU') === 'AU').map(f => {
        const P = f.properties, street = [P.housenumber, P.street].filter(Boolean).join(' '), area = P.suburb || P.district || P.locality || P.city || '';
        let name = P.name || street, sub = [P.name && street ? street : '', area !== name ? area : '', P.state && P.state !== 'Western Australia' ? P.state : ''].filter(Boolean).join(', ');
        let so; ({name, sub, streetOnly: so} = withNum(name, street, area, P.type === 'street' && !P.housenumber, sub));
        return {name, sub, streetOnly: !!so, label: [name, P.name && street ? street : '', area !== name ? area : ''].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0]};
      }).filter(x => x.name && !seen.has(x.label) && seen.add(x.label)).slice(0, 6);
      // nothing exact from the first map: ask the other free one (it knows more house numbers and address styles)
      const exact = list.some(x => !x.streetOnly);
      if (!list.length || (num && !exact)) { try {
        const n = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=au&addressdetails=1&viewbox=${[h.lon - 1, h.lat + 1, h.lon + 1, h.lat - 1].join(',')}&q=${encodeURIComponent(qq)}`)).json(); if (seq !== locSeq) return;
        const prevList = list; list = (Array.isArray(n) ? n : []).map(x => { const A = x.address || {}, street = [A.house_number, A.road].filter(Boolean).join(' '), area = A.suburb || A.town || A.city || '';
          const nm = x.name && x.name !== A.road ? x.name : street || x.name; const w = withNum(nm, street, area, x.class === 'highway' && !A.house_number, [x.name && x.name !== A.road ? street : '', area].filter(Boolean).join(', '));
          return {name: w.name, sub: w.sub, streetOnly: !!w.streetOnly, label: [w.name, area].filter(Boolean).join(', '), lat: +x.lat, lon: +x.lon}; }).filter(x => x.name);
        const exactN = list.filter(x => !x.streetOnly);
        const seen2 = new Set(); list = (exactN.length ? exactN.concat(prevList) : prevList.length ? prevList : list).filter(x => !seen2.has(x.label) && seen2.add(x.label)).slice(0, 6);
      } catch {} }
      S._locList = list;
      const asis = `<button type="button" class="locopt asis" data-act="loc-asis"><b>${icon('check', 'xs')} Use “${esc(q)}” as written</b><small>${list.length ? 'None of these? Keep what you typed' : 'Not on the free map (small businesses often aren\'t). Add a street address later for drive times.'}</small></button>`;
      box.innerHTML = list.map((x, i) => `<button type="button" class="locopt" role="option" data-act="loc-choose" data-i="${i}"><b>${esc(x.name)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('') + asis;
      box.hidden = false;
    } catch { box.hidden = true; }
  }, 350);
}
document.addEventListener('input', e => { const t = e.target; if (t && t.dataset && t.dataset.locsearch) locSearch(t); });
document.addEventListener('focusout', e => { const t = e.target; if (t && t.dataset && t.dataset.locsearch) setTimeout(() => { const b = t.closest('.locf') && t.closest('.locf').querySelector('.locsug'); if (b && !b.contains(document.activeElement)) b.hidden = true; }, 250); });
function placesPanelHTML() {
  const pl = places(), st = settings();
  return `<div class="panel" id="placespanel"><h2>Places</h2><p class="help">Places you go a lot. They show as one-tap buttons when you add an event, and driving times and leave reminders use them.</p>
    <ul class="plist">${st.location && st.location.lat ? '' : `<li class="pl-none"><span class="plic">${icon('home', 'xs')}</span> <span><b>Home</b><small>Not set yet, so drives are worked out from the city.</small></span><button class="btn soft sm" data-act="place-edit" data-id="home">Set home</button></li>`}
    ${pl.map(p => `<li><span class="plic">${placeIcon(p.emoji)}</span> <span><b>${esc(p.name)}</b><small>${esc(p.address || (p.home ? "Set from this device's location" : ''))}</small></span><button class="btn soft sm" data-act="place-edit" data-id="${p.id}">Edit</button></li>`).join('')}</ul>
    <button class="btn soft" data-act="place-edit" data-id="">${icon('plus')} Add a place</button></div>`;
}
function placeSheet(id) {
  const p = id ? places().find(x => x.id === id) || (id === 'home' ? {id: 'home', name: 'Home', emoji: '🏠', home: true} : null) : null, isHome = p && p.home || id === 'home';
  sheet(`<h2>${isHome ? 'Home' : p ? 'Edit place' : 'Add a place'}</h2>
    <form data-form="place-save" data-id="${esc(id || '')}">
      ${isHome ? '' : `<div class="presets">${PLACE_PRESETS.map(([n, e]) => `<button type="button" class="chip3" data-act="place-preset" data-n="${esc(n)}" data-e="${e}">${placeIcon(e)} ${esc(n)}</button>`).join('')}</div>
      <div class="row" style="gap:8px;flex-wrap:nowrap"><input class="input" name="emoji" value="${esc(p ? p.emoji || '📍' : '📍')}" maxlength="4" style="width:64px;text-align:center;font-size:22px" aria-label="Emoji"><input class="input grow" name="name" placeholder="Name, e.g. School" value="${esc(p ? p.name : '')}" maxlength="40" required></div>`}
      <label class="lbl" style="margin-top:10px">Address</label>${locField(p ? p.address : '', {noChips: true, ph: isHome ? 'Start typing your street' : 'Start typing, e.g. Bounce Malaga'})}
      ${isHome ? `<p class="help">Or stand at home and <button type="button" class="linkbtn" data-act="use-location">use this device's location</button>.</p>` : ''}
      <div class="row" style="margin-top:12px"><button class="btn">Save</button>${p && !isHome ? `<button type="button" class="btn ghost" data-act="place-del" data-id="${p.id}">Delete</button>` : ''}</div></form>`, {focus: false});
}
/* Smart title: "Dancing for Elowyn at 10am Saturday at Kindy" fills the time, day, people and place.
   Works on the device, no AI needed. Only fills what it finds; the title keeps the rest. */
function parseEventText(raw, baseDay) {
  let t = ' ' + String(raw || '').replace(/\s+/g, ' ').trim() + ' ';
  const out = {}, cut = re => { t = t.replace(re, ' '); };
  const to24 = (h, m, ap) => { h = +h; m = +(m || 0); if (ap) { ap = ap.toLowerCase(); if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0; } else if (h >= 1 && h <= 6) h += 12; return h <= 23 && m <= 59 ? String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') : null; };
  // time range "2-4pm", "2 to 4:30pm", "10am till 11"
  let m = t.match(/\s(?:from\s+|at\s+|@\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|to|till|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\s/i);
  if (m) { const ap2 = m[6], ap1 = m[3] || (+m[1] <= +m[4] || +m[4] === 12 ? ap2 : (ap2.toLowerCase().startsWith('p') ? 'am' : 'pm')); out.start = to24(m[1], m[2], ap1); out.end = to24(m[4], m[5], ap2); cut(m[0].replace(/\s$/, '') ? new RegExp(m[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : /$^/); }
  else {
    m = t.match(/\s(?:at\s+|@\s*|from\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\s/i) || t.match(/\s(?:at|@)\s*(\d{1,2})[:.](\d{2})()\s/i);
    if (m) { out.start = to24(m[1], m[2], m[3]); cut(new RegExp(m[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')); }
    else if (/\s(at\s+)?(noon|midday)\s/i.test(t)) { out.start = '12:00'; cut(/\s(at\s+)?(noon|midday)\s/i); }
  }
  if (/\s(all day|all-day)\s/i.test(t)) { out.all_day = true; cut(/\s(all day|all-day)\s/i); }
  // repeats: "every Tuesday", "every weekday", "fortnightly on Fridays", "weekly", "every day"
  const dIdx = w => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(w.toLowerCase().slice(0, 3));
  let rm;
  if ((rm = t.match(/\s(every|each)\s+(day|morning|night)\s/i)) || /\sdaily\s/i.test(t)) { out.repeat = {freq: 'day'}; cut(rm ? new RegExp(rm[0].trim(), 'i') : /\sdaily\s/i); }
  else if ((rm = t.match(/\s(every|each)\s+weekday\s/i))) { out.repeat = {freq: 'week', days: [1, 2, 3, 4, 5]}; cut(new RegExp(rm[0].trim(), 'i')); }
  else if ((rm = t.match(/\s(?:every\s+(other|second)\s+|fortnightly\s+(?:on\s+)?)?(?:every\s+|each\s+|on\s+)((?:(?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday|rsday)?s?(?:\s*(?:,|and|&)\s*)?)+)\s/i)) && /every|each|fortnightly|days\b|days?s\s/i.test(rm[0] + ' ' + rm[2])) {
    const ds = rm[2].split(/\s*(?:,|and|&)\s*/).filter(Boolean).map(dIdx).filter(i => i >= 0);
    if (ds.length) { out.repeat = {freq: /other|second|fortnightly/i.test(rm[0]) ? 'fortnight' : 'week', days: ds}; cut(new RegExp(rm[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')); if (!out.day) { const today = weekdayOfKey(dayKey(new Date())), add = Math.min(...ds.map(i => (i - today + 7) % 7)); out.day = addDaysKey(dayKey(new Date()), add); } }
  }
  else if ((rm = t.match(/\s(?:every\s+(fortnight|week|month|year)|(fortnightly|weekly|monthly|yearly))\s/i))) { const w = (rm[1] || rm[2]).toLowerCase(); out.repeat = {freq: w.startsWith('fortnight') ? 'fortnight' : w.startsWith('week') ? 'week' : w.startsWith('month') ? 'month' : 'year'}; cut(new RegExp(rm[0].trim(), 'i')); }
  // day
  const base = baseDay || dayKey(new Date()), wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  if (/\s(today|tonight|this (morning|afternoon|arvo|evening))\s/i.test(t)) { out.day = dayKey(new Date()); if (/tonight|evening/i.test(t) && !out.start) out.start = '18:00'; cut(/\s(today|tonight|this (morning|afternoon|arvo|evening))\s/i); }
  else if (/\stomorrow\s/i.test(t)) { out.day = addDaysKey(dayKey(new Date()), 1); cut(/\s(on\s+)?tomorrow\s/i); }
  else if ((m = t.match(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)(?:\s+of)?(?:\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)?\s/i)) || (m = t.match(/\s(?:on\s+)?(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s/i))) {
    const now = new Date(dayKey(new Date()) + 'T12:00:00Z'), mons = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let mo = m[2] ? mons.indexOf(m[2].toLowerCase().slice(0, 3)) : now.getUTCMonth(), y = now.getUTCFullYear(), d = +m[1];
    let k = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; if (k < dayKey(new Date())) { if (m[2]) y++; else { mo++; if (mo > 11) { mo = 0; y++; } } k = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    if (d >= 1 && d <= 31) { out.day = k; cut(new RegExp(m[0].trim(), 'i')); cut(/\s(on\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|nesday|sday|urday|rsday)?\s/i); }
  } else if ((m = t.match(/\s(?:on\s+|this\s+|next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday|rsday)?\s/i))) {
    const i = wd.findIndex(w => w.startsWith(m[1].toLowerCase().slice(0, 3))), today = new Date(dayKey(new Date()) + 'T12:00:00Z').getUTCDay();
    let add = (i - today + 7) % 7; if (add === 0 && /next\s/i.test(m[0])) add = 7; out.day = addDaysKey(dayKey(new Date()), add); cut(new RegExp(m[0].trim(), 'i'));
  }
  // people: "for Elowyn and Violet", or names anywhere
  const who = [];
  S.members.forEach(mb => { const n = mb.name.trim(); if (!n) return; const re = new RegExp('\\s(?:for\\s+|with\\s+)?' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "(?:'s)?(?=\\s)", 'i'); if (re.test(t)) { who.push(mb.id); t = t.replace(re, ' '); } });
  if (/\s(for\s+)?(the\s+)?(kids|girls|boys)\s/i.test(t) && !who.length) { S.members.filter(x => x.kind === 'kid').forEach(x => who.push(x.id)); cut(/\s(for\s+)?(the\s+)?(kids|girls|boys)\s/i); }
  if (who.length) out.who = who;
  t = t.replace(/\s(for|and|&|with)\s+(?=(for|and|&|with)?\s*$)/gi, ' ');
  // place: a saved place after at/to/@, else "at Something" at the end
  const pl = places().find(x => new RegExp('\\s(?:at|to|@|in)\\s+(?:the\\s+)?' + x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s)', 'i').test(t));
  if (pl) { out.location = pl.name; t = t.replace(new RegExp('\\s(?:at|to|@|in)\\s+(?:the\\s+)?' + pl.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s)', 'i'), ' '); }
  else if ((m = t.match(/\s(?:at|@)\s+([A-Za-z0-9'&][^,]{2,60}?)\s*$/))) { out.location = m[1].trim().replace(/(^|\s)([a-z])/g, (x, a2, c2) => a2 + c2.toUpperCase()); t = t.slice(0, m.index) + ' '; }
  // tidy what's left as the title
  let title = t.replace(/\s+(on|at|for|and|&|with|from|this)\s*$/i, ' ').replace(/^\s*(on|at|for|and|&|with)\s+/i, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim().replace(/[,.\-–]+$/, '').trim();
  if (title) out.title = title.charAt(0).toUpperCase() + title.slice(1);
  return out;
}
function smartFill(f) {
  const inp = f.title; if (!inp || !inp.value.trim() || inp.dataset.parsed === inp.value) return;
  if (/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i.test(inp.value)) inp.value = spokenTimes(inp.value);
  const r = parseEventText(inp.value, f.day && f.day.value), done = [];
  if (r.day && f.day) { f.day.value = r.day; done.push(fmtDay(r.day, {weekday: 'short', day: 'numeric', month: 'short'})); }
  if (r.all_day && f.allday) { f.allday.checked = true; const tm = f.querySelector('.evtimes'); if (tm) tm.hidden = true; done.push('all day'); }
  if (r.start && f.start) { const toM = v => +v.slice(0, 2) * 60 + +v.slice(3, 5), dur = Math.max(15, (toM(f.end.value || '00:00') - toM(f.start.value || '00:00')) || 60); f.start.value = r.start; f.start.dataset.prev = r.start; f.end.value = r.end || (n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'))(Math.min(1439, toM(r.start) + dur)); if (f.allday && f.allday.checked) { f.allday.checked = false; const tm = f.querySelector('.evtimes'); if (tm) tm.hidden = false; } done.push(fmtTime(new Date(zonedISO(f.day.value, r.start))) + (r.end ? '–' + fmtTime(new Date(zonedISO(f.day.value, r.end))) : '')); }
  if (r.who && f.who) { const cal = f.calendar; if (cal && cal.value !== 'skylike' && [...cal.options].some(o => o.value === 'skylike') && !twoWayCals().length) cal.value = 'skylike';
    const w = f.querySelector('.evwho'); if (w) w.hidden = false; f.who.value = r.who.join(','); f.querySelectorAll('[data-act="who-tog"]').forEach(b => { const on = r.who.includes(b.dataset.m); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); done.push(andList(r.who.map(id => memberById(id).name))); }
  if (r.repeat && f.rep_on) { f.rep_on.checked = true; f.querySelector('.repbox').hidden = false; f.rep_freq.value = r.repeat.freq; f.querySelectorAll('[data-act="rep-freq"]').forEach(b => b.classList.toggle('on', b.dataset.v === r.repeat.freq));
    if (r.repeat.days) { f.rep_days.value = r.repeat.days.join(','); f.querySelectorAll('.dow').forEach(b => { const on = r.repeat.days.includes(+b.dataset.v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); } else f.rep_days.value = '';
    repRefresh(f); done.push(repeatText(Object.assign({}, r.repeat), f.day.value).toLowerCase()); }
  if (r.location && f.location && !f.location.value.trim()) { f.location.value = r.location; f.querySelectorAll('.locf .chip3').forEach(c => c.classList.toggle('on', normLoc(c.dataset.name) === normLoc(r.location))); done.push(r.location); }
  if (done.length && r.title) inp.value = r.title;
  inp.dataset.parsed = inp.value;
  const h = f.querySelector('.smarthint'); if (h) { h.hidden = !done.length; h.innerHTML = done.length ? icon('sparkle', 'xs') + ' Filled in: ' + esc(done.join(' · ')) : ''; }
}
/* The "Is this a regular event?" scheduler in the event form. */
function repeatBlock(e, day, pre) {
  const row = e && e.local ? e.row : null, R = (row && row.repeat) || pre.repeat || null, wd = weekdayOfKey(day);
  const freq = R ? R.freq : 'week', days = R && R.days && R.days.length ? R.days : [wd], endKind = R ? (R.until ? (R.until === termEndAfter(day) ? 'term' : 'date') : R.count ? 'count' : 'never') : 'never';
  const google = !e && twoWayCals().length, te = termEndAfter(day);
  return `${e && e.series ? `<div class="repscope"><b>${icon('repeat', 'xs')} This repeats.</b> Change: <label><input type="radio" name="scope" value="one" checked> just this one</label><label><input type="radio" name="scope" value="all"> every one</label></div>` : ''}
    <label class="evrep"><input type="checkbox" name="rep_on" data-change="rep-toggle" ${R ? 'checked' : ''}> ${icon('repeat', 'xs')} Is this a regular event?</label>
    <div class="repbox" ${R ? '' : 'hidden'}>
      <input type="hidden" name="rep_freq" value="${freq}"><input type="hidden" name="rep_days" value="${days.join(',')}">
      <div class="chips2 repfreq">${[['day', 'Every day'], ['week', 'Every week'], ['fortnight', 'Every fortnight'], ['month', 'Every month'], ['year', 'Every year']].map(([k, l]) => `<button type="button" class="chip2 ${freq === k ? 'on' : ''}" data-act="rep-freq" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="repdays" ${freq === 'week' || freq === 'fortnight' ? '' : 'hidden'}><div class="lbl">On</div><div class="dowrow">${[1, 2, 3, 4, 5, 6, 0].map(i => `<button type="button" class="dow ${days.includes(i) ? 'on' : ''}" data-act="rep-day" data-v="${i}" aria-pressed="${days.includes(i)}" aria-label="${DOWL[i]}">${DOW[i].slice(0, 2)}</button>`).join('')}</div></div>
      <div class="repmonth" ${freq === 'month' ? '' : 'hidden'}><label><input type="radio" name="rep_mby" value="date" ${!R || R.monthBy !== 'weekday' ? 'checked' : ''} data-change="rep-refresh"> <span class="rm-d"></span></label><label><input type="radio" name="rep_mby" value="weekday" ${R && R.monthBy === 'weekday' ? 'checked' : ''} data-change="rep-refresh"> <span class="rm-w"></span></label></div>
      <div class="row repend"><label class="lbl">Ends <select class="input" name="rep_end" data-change="rep-refresh"><option value="never" ${endKind === 'never' ? 'selected' : ''}>Never</option>${te ? `<option value="term" ${endKind === 'term' ? 'selected' : ''}>End of this school term</option>` : ''}<option value="date" ${endKind === 'date' ? 'selected' : ''}>On a date</option><option value="count" ${endKind === 'count' ? 'selected' : ''}>After a number of times</option></select></label>
        <input class="input" type="date" name="rep_until" value="${R && R.until ? R.until : addDaysKey(day, 84)}" data-change="rep-refresh" ${endKind === 'date' ? '' : 'hidden'}>
        <label class="lbl repcount" ${endKind === 'count' ? '' : 'hidden'}><input class="input" type="number" name="rep_count" min="2" max="200" value="${R && R.count ? R.count : 10}" data-change="rep-refresh" style="width:90px"> times</label></div>
      <p class="repsum"></p>${google ? '<p class="help">Repeats work in Google calendars too once two-way editing is connected.</p>' : ''}
    </div>`;
}
const termEndAfter = k => { const t = WA_TERMS.find(([a, b]) => b >= k); return t ? t[1] : ''; };
function repeatFrom(f) {
  if (!f.rep_on || !f.rep_on.checked) return null;
  const freq = f.rep_freq.value, R = {freq};
  if (freq === 'week' || freq === 'fortnight') R.days = f.rep_days.value.split(',').filter(x => x !== '').map(Number);
  if (freq === 'month') R.monthBy = (f.querySelector('[name="rep_mby"]:checked') || {}).value || 'date';
  const end = f.rep_end.value;
  if (end === 'term') R.until = termEndAfter(f.day.value); else if (end === 'date') R.until = f.rep_until.value || null; else if (end === 'count') R.count = Math.max(2, Math.min(200, +f.rep_count.value || 10));
  return R;
}
function repRefresh(f) {
  if (!f || !f.rep_freq) return; const k = f.day.value || dayKey(new Date()), freq = f.rep_freq.value, box = f.querySelector('.repbox');
  box.querySelector('.repdays').hidden = !(freq === 'week' || freq === 'fortnight'); box.querySelector('.repmonth').hidden = freq !== 'month';
  const d0 = +k.slice(8, 10), nth = ['first', 'second', 'third', 'fourth', 'last'][Math.min(4, Math.ceil(d0 / 7) - 1)];
  box.querySelector('.rm-d').textContent = `On the ${d0}${[, 'st', 'nd', 'rd'][d0 % 10 > 3 || Math.floor(d0 / 10) === 1 ? 0 : d0 % 10] || 'th'} each month`; box.querySelector('.rm-w').textContent = `On the ${nth} ${DOWL[weekdayOfKey(k)]} each month`;
  const end = f.rep_end.value; f.rep_until.hidden = end !== 'date'; box.querySelector('.repcount').hidden = end !== 'count';
  if ((freq === 'week' || freq === 'fortnight') && !f.rep_days.value) { f.rep_days.value = String(weekdayOfKey(k)); box.querySelectorAll('.dow').forEach(b => b.classList.toggle('on', +b.dataset.v === weekdayOfKey(k))); }
  const R = repeatFrom(f); box.querySelector('.repsum').innerHTML = R ? icon('repeat', 'xs') + ' ' + esc(repeatText(R, k)) : '';
}
/* One smart Add, the same everywhere: an event if it has a day or time, groceries if it's food, a to-do for someone if it
   starts with their name ("Sam: call the plumber"), otherwise a to-do. One mic beside it. */
function quickAddHTML() {
  const last = S._fqLast, them = (S.members.find(m => m.kind !== 'kid' && m.id !== (meMember() || {}).id) || {}).name || 'Sam';
  const where = last && (last.kind === 'event' ? 'Calendar' : last.kind === 'grocery' ? 'Groceries' : 'To do');
  return `<form class="fq" data-form="fquick"><input class="input" id="fq" name="text" placeholder="Add anything…" autocomplete="off" maxlength="200" enterkeyhint="done" aria-label="Add anything: an event, a to-do or groceries" aria-describedby="fq-tip">${canListen() ? `<button type="button" class="fmic" data-act="fq-mic" aria-label="Say it">${icon('mic')}</button>` : ''}<button class="btn" aria-label="Add">${icon('plus')}</button></form>
    ${last && last.kind !== 'event' && Date.now() - last.at < 15000 ? `<div class="fqdone" role="status"><span class="fqok">${icon('check')}</span><span class="fqtx"><small>Added to ${where}${last.who ? ` for ${esc(last.who)}` : ''}</small><b>${esc(last.text)}</b></span>
      <span class="fqacts">${last.ids && last.ids.length === 1 ? `<button class="btn soft sm" data-act="item-edit" data-id="${last.ids[0]}">${icon('edit')}Edit</button>` : ''}<button class="btn soft sm" data-act="fq-move">Move to ${last.kind === 'grocery' ? 'To do' : 'Groceries'}</button></span></div>`
      : `<div class="fqhint" id="fq-tip">Try “milk and bread”, “swimming Tue 4pm” or “${esc(them)}: book the car service”.</div>`}`;
}
/* Voice: one mic button for any text box (Web Speech API; on iPhone/iPad it needs Siri & Dictation on). */
const canListen = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const micBtn = (target, submit) => canListen() ? `<button type="button" class="icon-btn micbtn" data-act="mic" data-target="${target}" ${submit ? 'data-submit="1"' : ''} aria-label="Say it instead of typing">${icon('mic')}</button>` : '';
// Voice: keeps listening through pauses (finishes 3.5 s after you stop talking, or when you tap Done),
// shows the words as they come, and always fully releases the mic afterwards (iPad otherwise keeps recording).
function listen(cb, el) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) { toast("Voice isn't available here. Use the mic on your keyboard instead.", 4000); return; }
  if (S._rec) return S._rec.finish(); // tapping the mic again = done
  const r = new R(); r.lang = 'en-AU'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
  let finals = '', interim = '', done = false, quiet = null, cap = null;
  const bar = document.createElement('div'); bar.className = 'listenbar'; bar.setAttribute('role', 'status');
  bar.innerHTML = `<span class="ldot" aria-hidden="true"></span><span class="ltxt">Listening… take your time</span><button class="btn sm" data-x="done">Done</button><button class="btn ghost sm" data-x="cancel">Cancel</button>`;
  document.body.appendChild(bar);
  const text = () => (finals + ' ' + interim).replace(/\s+/g, ' ').trim();
  const show = () => { const t = text(); bar.querySelector('.ltxt').textContent = t || 'Listening… take your time'; };
  const cleanup = () => { clearTimeout(quiet); clearTimeout(cap); bar.remove(); if (el) el.classList.remove('on'); S._rec = null; document.removeEventListener('visibilitychange', onHide);
    try { r.abort(); } catch {} setTimeout(() => { try { r.abort(); } catch {} }, 400); };
  const finish = (use = true) => { if (done) return; done = true; const t = text(); try { r.stop(); } catch {} cleanup(); if (use && t) cb(t); else if (use) toast("Didn't catch that. Try again, a little closer.", 3500); };
  const onHide = () => { if (document.hidden) finish(false); };
  S._rec = {finish: () => finish(true)};
  bar.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x) finish(x.dataset.x === 'done'); });
  r.onresult = ev => { interim = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) { const t = ev.results[i][0].transcript; if (ev.results[i].isFinal) finals += ' ' + t; else interim += ' ' + t; }
    show(); clearTimeout(quiet); quiet = setTimeout(() => finish(true), 3500); };
  r.onend = () => { if (!done) { if (text()) finish(true); else { try { r.start(); } catch { finish(true); } } } }; // some browsers stop on silence: start again until Done
  r.onerror = ev => { if (ev.error === 'no-speech' || ev.error === 'aborted') return; finish(false);
    toast(ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'Allow the microphone for Skylike (and on iPhone, turn on Siri & Dictation).' : "Voice stopped. Try again, or type it.", 4500); };
  document.addEventListener('visibilitychange', onHide);
  cap = setTimeout(() => finish(true), 60000);
  if (el) el.classList.add('on');
  try { r.start(); } catch { cleanup(); }
}
const submitForm = f => { if (!f) return; if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true})); };

/* Photo or words → calendar events: the AI reads a flyer, invite, school note or a sentence, then you check and add. */
// Quick add only treats it as an event when there's a clock time or an obvious appointment word ("call mum Friday" stays a to-do).
const looksLikeAppointment = t => /\b\d{1,2}(:\d\d)?\s?(am|pm)\b|\b\d{1,2}:\d\d\b/i.test(t) || (/\b(party|appointment|appt|lesson|class|practice|training|game|match|recital|concert|dentist|doctor|gp|vaccination|playdate|play date|excursion|assembly|camp)\b/i.test(t) && looksLikeEvent(t));
const looksLikeEvent = t => /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day)?\b|\btomorrow\b|\btonight\b|\bnext (week|mon|tue|wed|thu|fri|sat|sun)|\b\d{1,2}(:\d\d)?\s?(am|pm)\b|\b\d{1,2}(st|nd|rd|th)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i.test(t);
async function readEvents(payload, fallbackText) {
  if (!S.aiOn) { if (fallbackText) { S._evDraft = {title: fallbackText.slice(0, 120)}; return eventForm(null); } return toast('Turn on the AI helper first (Settings → Kitchen).', 4000); }
  sheet(`<div class="reading"><div class="spin" aria-hidden="true"></div><h2>Reading it…</h2><p class="help">Looking for dates, times and places.</p></div>`, {focus: false});
  const now = new Date(), k = dayKey(now);
  const r = await callAI(Object.assign({action: 'event_parse', today: k, weekday: fmtDay(k, {weekday: 'long'}), people: S.members.map(m => m.name)}, payload));
  if (r.error) { closeSheet(); return toast(r.error, 5000); }
  const evs = (r.events || []).filter(e => e && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date || ''));
  if (!evs.length) { closeSheet(); if (fallbackText) { S._fqText = fallbackText; return sheet(`<h2>No date found</h2><p class="help">I couldn't find a date or time in “${esc(fallbackText)}”.</p><div class="row"><button class="btn" data-act="fq-as-todo">Add it as a to-do</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>`); } return toast("Couldn't find any dates in that. Try a clearer photo, or type it in.", 5000); }
  S._evReview = evs.map(e => ({title: String(e.title).slice(0, 120), day: e.date, start: /^\d{2}:\d{2}$/.test(e.start || '') ? e.start : '', end: /^\d{2}:\d{2}$/.test(e.end || '') ? e.end : '', all_day: !!e.all_day || !/^\d{2}:\d{2}$/.test(e.start || ''), location: e.location || '', notes: e.notes || '', who: ((S.members.find(m => e.who && m.name.toLowerCase() === String(e.who).toLowerCase())) || {}).id || ''}));
  S._evFallback = fallbackText || ''; reviewSheet();
}
function reviewSheet() {
  const L = S._evReview || []; if (!L.length) return closeSheet();
  const cals = twoWayCals(), me = meMember(), mine = cals.find(c => me && c.member_id === me.id) || cals[0];
  sheet(`<h2>Found ${L.length} event${L.length === 1 ? '' : 's'}</h2><p class="help">Untick anything you don't want, tap Edit to fix details.</p>
    <form data-form="ev-import-save"><ul class="evrev">${L.map((d, i) => `<li><label class="evpick"><input type="checkbox" name="pick" value="${i}" checked><span><b>${esc(d.title)}</b><small>${esc(fmtDay(d.day, {weekday: 'short', day: 'numeric', month: 'short'}))}${d.all_day ? ' · all day' : ' · ' + esc(fmtTime(new Date(zonedISO(d.day, d.start))))}${d.location ? ' · ' + esc(d.location) : ''}</small>${d.notes ? `<small class="evn">${esc(d.notes)}</small>` : ''}</span></label><button type="button" class="btn soft sm" data-act="ev-draft-edit" data-i="${i}">Edit</button></li>`).join('')}</ul>
    <label class="lbl">Add to <select class="input" name="calendar">${cals.map(c => `<option value="${c.id}" ${mine && c.id === mine.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="skylike" ${!mine ? 'selected' : ''}>Skylike only (just this family)</option></select></label>
    <div class="row" style="margin-top:12px"><button class="btn">Add to calendar</button>${S._evFallback ? '<button type="button" class="btn ghost" data-act="fq-as-todo">It\'s a to-do instead</button>' : '<button type="button" class="btn ghost" data-act="close-sheet">Cancel</button>'}</div></form>`, {focus: false});
}
function nextDraft() { if (S._evReview && S._evReview.length) reviewSheet(); }
function eventImportSheet() {
  sheet(`<h2>Add from a photo or words</h2><p class="help">Snap a party invite, school newsletter or flyer, or just say what's on. You check everything before it's added.</p>
    <div class="scanpick"><label class="btn">${icon('camera')} Take a photo<input type="file" accept="image/*" capture="environment" data-change="ev-photo" hidden></label>
    <label class="btn ghost">Choose photos or screenshots<input type="file" accept="image/*" multiple data-change="ev-photo" hidden></label>
    ${canListen() ? `<button class="btn ghost" data-act="ev-voice">${icon('mic')} Say it</button>` : ''}</div>
    <form data-form="ev-text" style="margin-top:14px"><textarea class="input" name="text" rows="3" maxlength="6000" placeholder="Or paste an email or message, e.g. “Mia's party Sat 14th 2-4pm at Bounce Malaga”"></textarea><button class="btn soft" style="margin-top:8px">Find the events</button></form>`, {focus: false});
}
/* People view (tablet): a column per person for the day. Drag an event to someone to say who it's for;
   tap it to pick who's taking them. Assignments for Google events live in Skylike (household settings),
   Skylike-only events keep theirs on the event. */
const takerOf = e => { const t = ((settings().people || {})[e.event_id] || {}).taker; return t ? memberById(t) : null; };
function peopleHTML(k) {
  const evs = eventsOnKey(k).sort((a, b) => (b.all_day - a.all_day) || a.starts_at.localeCompare(b.starts_at));
  // the driver is busy too: their column shows what they're taking someone to
  const by = id => evs.filter(e => { const ids = eventMembers(e).map(m => m.id), t = (takerOf(e) || {}).id; return id ? ids.includes(id) || t === id : !ids.length && !t; });
  // "Everyone" only shows when something is shared; on a phone, one person at a time (tap a face)
  let cols = S.members.map(m => ({id: m.id, m})).concat(by('').length ? [{id: '', m: null}] : []);
  const phone = isPhone(), pick = phone ? (cols.find(c => c.id === S.pplPick) || cols.find(c => c.m && meMember() && c.m.id === meMember().id) || cols[0]) : null;
  if (phone && pick) cols = [pick];
  // clashes: two things at once for the same person, or not enough time to drive between them
  const flags = {};
  (phone ? cols : S.members.map(m => ({id: m.id}))).forEach(c => { if (!c.id) return; const tl = by(c.id).filter(e => !e.all_day).map(e => ({e, a: Date.parse(e.starts_at), b: Date.parse(e.ends_at || e.starts_at) || Date.parse(e.starts_at) + 3600e3}));
    tl.forEach((x, i) => tl.slice(i + 1).forEach(y => { if (x.a < y.b && y.a < x.b) { flags[c.id + x.e.id] = 'clash'; flags[c.id + y.e.id] = 'clash'; }
      else { const [p1, p2] = x.a <= y.a ? [x, y] : [y, x], d = driveFor(p2.e), gap = (p2.a - p1.b) / 60e3; if (d != null && gap >= 0 && gap < d && !flags[c.id + p2.e.id]) flags[c.id + p2.e.id] = `tight:${Math.round(gap)}:${d}`; } })); });
  const card = (e, cid) => { const t = takerOf(e), st = new Date(e.starts_at), d = !e.all_day ? driveFor(e) : null, fl = flags[cid + e.id] || '';
    return `<button class="pev" data-ev="${e.id}" data-act="open-event" data-id="${e.id}" style="--c:${eventColour(e)}"><span class="pt num">${e.all_day ? 'All day' : esc(fmtTime(st))}</span><b>${esc(e.title || 'Busy')}</b>${e.location ? `<small>${esc(e.location)}${d != null ? ` · ${d} min` : ''}</small>` : ''}${t ? `<span class="ptk">${icon('car', 'xs')} ${avatar(t)} ${esc(t.name)}</span>` : ''}${fl === 'clash' ? `<span class="pflag">Clashes with another event</span>` : fl ? `<span class="pflag soft">Tight: ${fl.split(':')[1]} min gap, ${fl.split(':')[2]} min drive</span>` : ''}</button>`; };
  return `${phone ? `<div class="ppick" role="group" aria-label="Whose day">${S.members.map(m => `<button class="${pick && pick.id === m.id ? 'on' : ''}" data-act="ppl-pick" data-m="${m.id}" aria-pressed="${!!(pick && pick.id === m.id)}">${avatar(m)}<span>${esc(m.name)}</span></button>`).join('')}</div>` : `<p class="help phint">Drag an event onto someone to say who it's for. Tap it to choose who's taking them.</p>`}
    <div class="pgrid2" style="--n:${cols.length}${phone ? ';grid-template-columns:1fr' : ''}">${cols.map(c => { const list = by(c.id); return `<section class="ppcol" data-m="${c.id}" style="--c:${c.m ? esc(c.m.color) : 'var(--ink-2)'}"><div class="phd">${c.m ? avatar(c.m) : `<span class="face" style="--c:#8A93A6">${icon('family')}</span>`}<b>${c.m ? esc(c.m.name) : 'Everyone'}</b><span class="n num">${list.length || ''}</span></div>
      <div class="pbody">${list.map(e => card(e, c.id)).join('') || `<p class="pnone">${c.m ? 'Free' : 'Nothing shared'}</p>`}</div></section>`; }).join('')}</div>`;
}
function setEventPeople(id, patch) {
  const e = evById(id); if (!e) return;
  if (e.local && 'for' in patch) { const r = e.row, ids = [].concat(patch.for || []).filter(Boolean); r.member_ids = ids; r.member_id = ids[0] || null; render(); saveLocalEvent(r, null); delete patch.for; if (!('taker' in patch)) return; }
  const live = new Set(S.events.map(x => x.event_id).concat(localEvs().map(x => x.event_id))), map = {};
  Object.entries(settings().people || {}).forEach(([key, v]) => { if (live.has(key)) map[key] = v; });
  map[e.event_id] = Object.assign({}, map[e.event_id], patch);
  saveSettings({people: map}, true);
}
/* Grown-up lock: a 4-digit PIN for changes on shared screens (calendar edits, settings, spending stars),
   so little fingers can't delete real Google events. Phones are unlocked by default. */
const lockCfg = () => settings().lock || null;
const lockHere = () => !!(lockCfg() && lockCfg().hash) && LS.get('lockHere', !isPhone());
const unlocked = () => !lockHere() || Date.now() < (S.unlockUntil || 0);
const LOCKED_ACTS = new Set(['ev-add', 'ev-edit', 'ev-del', 'ev-del-go', 'ev-setup', 'del-list', 'star-adj', 'redeem', 'ev-for', 'ev-taker']);
const needsPin = (act, el) => !unlocked() && (LOCKED_ACTS.has(act) || (act === 'go' && el && el.dataset.view === 'settings'));
async function pinHash(pin, salt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function askPin(then) {
  S._pinThen = then; S._pin = '';
  sheet(`<div class="pinbox"><h2>Grown-ups only</h2><p class="help">Enter the PIN to change the calendar or settings.</p>
    <div class="pindots" aria-live="polite">${'<i></i>'.repeat(4)}</div>
    <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map(k => k === '' ? '<span></span>' : `<button data-act="pin-key" data-k="${k}" aria-label="${k === 'del' ? 'Delete' : k}">${k === 'del' ? icon('left') : k}</button>`).join('')}</div>
    <p class="help" style="text-align:center">Forgot it? On a grown-up's phone: Settings → Family → Grown-up lock.</p></div>`);
}
function pinDots(state) { const d = $('.pindots'); if (!d) return; d.className = 'pindots' + (state ? ' ' + state : ''); d.innerHTML = [0, 1, 2, 3].map(i => `<i class="${i < S._pin.length ? 'on' : ''}"></i>`).join(''); }
function lockPanelHTML() {
  const c = lockCfg(), on = !!(c && c.hash);
  return `<div class="panel" id="lockpanel"><h2>Grown-up lock</h2><p class="help">A 4-digit PIN for changes on shared screens: adding, moving or deleting calendar events, opening Settings and spending stars. Ticking things off stays open for everyone. After the PIN, the screen stays unlocked for 5 minutes.</p>
    <p><b>${on ? icon('lock', 'xs') + ' On' : 'Off'}</b></p>
    <form data-form="lock-set" class="row" style="flex-wrap:wrap"><input class="input" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="${on ? 'New PIN' : 'Choose a PIN'}" required style="width:140px;letter-spacing:.3em;text-align:center">
      <input class="input" name="pin2" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="Again" required style="width:140px;letter-spacing:.3em;text-align:center"><button class="btn">${on ? 'Change PIN' : 'Turn on'}</button></form>
    ${on ? `<label class="row" style="margin-top:12px;gap:10px"><input type="checkbox" data-change="lock-here" ${lockHere() ? 'checked' : ''} style="width:22px;height:22px"> Ask for the PIN on this ${isPhone() ? 'phone' : 'screen'}</label>
    <button class="btn ghost" style="margin-top:8px" data-act="lock-off">Turn the lock off</button>` : ''}</div>`;
}
/* Morning briefing: a short spoken-style summary of today. Built instantly from the household's own data,
   then (if the AI helper is on) rewritten in the chosen tone. Read aloud with the device's own voice. */
/* Assistant personalities: each has its own voice and its own way of writing the brief. Picked per person (the family screen has its own). */
const PERSONAS = [
  {id: 'sunny', g: 'f', name: 'Sunny', emoji: '☀️', blurb: 'Bright and bubbly, cheers you on', tone: 'bubbly', sample: "Morning! Big day, but you've totally got this. Swimming's at nine, so let's get those hats on!"},
  {id: 'mate', g: 'm', name: 'Mate', emoji: '🦘', blurb: 'Laid-back Aussie, keeps it real', tone: 'plain', sample: "G'day. Pretty easy one today. Swimming at nine, bins out tonight, and that's about it, mate."},
  {id: 'sass', g: 'f', name: 'Sass', emoji: '💅', blurb: 'Cheeky, dry humour, still kind', tone: 'sassy', sample: "Rise and shine. Swimming's at nine, and no, the bins won't take themselves out tonight."},
  {id: 'willow', g: 'f', name: 'Willow', emoji: '🌿', blurb: 'Calm and gentle, one thing at a time', tone: 'calm', sample: "Good morning. Take a breath. First, swimming at nine. That's all you need to think about for now."},
  {id: 'news', g: 'm', name: 'Newsreader', emoji: '📻', blurb: 'Straight to the point', tone: 'plain', sample: "Good morning. Swimming at nine. Lunchboxes to pack. Bins out tonight. Top of twenty-eight."},
  {id: 'sterling', g: 'm', uk: true, name: 'Sterling', emoji: '🤖', blurb: 'Sleek AI aide, dry British wit', tone: 'plain', sample: "Good morning. Swimming is at nine, so departure is advised by eight forty. Lunchboxes are pending, and the bins go out tonight."},
  {id: 'ambrose', g: 'm', uk: true, name: 'Ambrose', emoji: '🎩', blurb: 'Devoted family butler, warm and wise', tone: 'calm', sample: "Good morning. Swimming at nine, so do leave by twenty to, if you please. Lunches want packing, and I'd suggest a hat. It'll be warm."},
  {id: 'coach', g: 'm', name: 'Coach', emoji: '💪', blurb: 'Energetic, gets you moving', tone: 'bubbly', sample: "Let's go! Swimming at nine, lunches packed by eight thirty. Three things today, and we'll smash every one."},
];
const briefWho = () => S.activeMember ? memberById(S.activeMember) : (isPhone() ? meMember() : null);
const personaKey = () => (briefWho() || {}).id || 'family';
const personaId = () => (settings().persona || {})[personaKey()] || ({bubbly: 'sunny', sassy: 'sass', plain: 'news', calm: 'willow'})[LS.get('briefTone', '')] || 'sunny';
const persona = (id = personaId()) => PERSONAS.find(p => p.id === id) || PERSONAS[0];
const briefTone = () => persona().tone;
// Kids' picture tiles: flat sticker style, 48 grid, one ink outline. Keyed by the emoji families already use.
const KART = {
  toilet: '<rect x="13" y="5" width="22" height="12" rx="3" fill="#E6F2FA"/><rect x="20" y="8.5" width="8" height="3" rx="1.5" fill="#6FB3E0"/><path d="M9 21h30c0 7.5-5.2 12.6-11 13.6V39h5a1.5 1.5 0 0 1 1.5 1.5V43h-21v-2.5A1.5 1.5 0 0 1 15 39h5v-4.4C14.2 33.6 9 28.5 9 21z" fill="#fff"/><ellipse cx="24" cy="21" rx="15" ry="3.8" fill="#6FB3E0"/>',
  teeth: '<g transform="rotate(-30 24 26)"><rect x="4" y="28" width="28" height="6.5" rx="3.2" fill="#6FB3E0"/><rect x="28" y="26" width="15" height="9" rx="3.5" fill="#fff"/><path d="M30.5 26v-5M34.5 26v-5M38.5 26v-5" stroke-width="2"/><path d="M29 20.5c0-3.5 3.3-5 6.6-4.4 2.1.4 3.4-.8 3.6-2.4 2.3 1.5 3.6 4.4 2.6 6.8z" fill="#9ADAEC"/></g><path d="M10 6v6M7 9h6M39 34v5M36.5 36.5h5" stroke="#F2B53A" stroke-width="2.2"/>',
  dress: '<path d="M17.5 7.5L7 13l4 9 5-2.2V41h16V19.8l5 2.2 4-9-10.5-5.5c-1.2 3.2-3.8 5-6.5 5s-5.3-1.8-6.5-5z" fill="#EF7A6B"/><path d="M17.5 7.5c1.2 3.2 3.8 5 6.5 5s5.3-1.8 6.5-5" fill="none"/><path d="M24 22.5l1.9 3.9 4.3.6-3.1 3 .7 4.2-3.8-2-3.8 2 .7-4.2-3.1-3 4.3-.6z" fill="#FFD45C" stroke-width="1.8"/>',
  breakfast: '<path d="M33 21.5L40.5 7" stroke-width="2.4"/><ellipse cx="41.2" cy="6" rx="2.4" ry="3.4" transform="rotate(28 41.2 6)" fill="#D5DEE4"/><rect x="18" y="37.5" width="12" height="4" rx="2" fill="#4E97C9"/><path d="M6 22h36c0 9.4-8 17-18 17S6 31.4 6 22z" fill="#6FB3E0"/><ellipse cx="24" cy="22" rx="18" ry="4" fill="#fff"/><circle cx="16" cy="21" r="2.4" fill="#F5A25D" stroke-width="1.6"/><circle cx="23" cy="20" r="2.4" fill="#F5A25D" stroke-width="1.6"/><circle cx="29.5" cy="22" r="2.4" fill="#F5A25D" stroke-width="1.6"/><circle cx="20" cy="23.6" r="2" fill="#F7C948" stroke-width="1.6"/>',
  shoes: '<path d="M5 34.5c0-6 .8-12.5 2.2-17 3.2 1.4 7.2 1.4 9.8 0 1.6 5 5.6 8.4 12.5 10 7.6 1.7 13.5 3.5 14.5 8.5v1.5H5z" fill="#7CC48B"/><path d="M19.5 22.5l3-2.4M22.6 25.6l3-2.6M26.4 28l2.8-2.6" stroke-width="2"/><path d="M33.5 28.4c2.4 1.6 3.4 4 3.6 7" fill="none" stroke-width="2"/><rect x="3.5" y="35" width="41" height="6" rx="3" fill="#fff"/>',
  bag: '<path d="M19 12V9a5 5 0 0 1 10 0v3" fill="none" stroke-width="2.4"/><rect x="10" y="12" width="28" height="31" rx="8.5" fill="#A98BD8"/><path d="M10 21.5c5 3.4 23 3.4 28 0" fill="none"/><rect x="15" y="28" width="18" height="11" rx="4" fill="#CBB8EF"/><path d="M19 32.5h10" stroke-width="2"/>',
  bath: '<path d="M9 21V11.5a4.5 4.5 0 0 1 9 0" fill="none" stroke-width="2.4"/><circle cx="23" cy="15.5" r="4" fill="#E3F4FC" stroke-width="1.8"/><circle cx="30.5" cy="12.5" r="3" fill="#E3F4FC" stroke-width="1.8"/><circle cx="36.5" cy="16.5" r="4.4" fill="#E3F4FC" stroke-width="1.8"/><path d="M6 24h36v3c0 7.5-6 12.5-13 12.5H19C12 39.5 6 34.5 6 27z" fill="#fff"/><rect x="3.5" y="21" width="41" height="4.5" rx="2.2" fill="#6FB3E0"/><path d="M12 39.5L10 43M36 39.5l2 3.5" stroke-width="2.4"/>',
  pjs: '<path d="M16 6.5L7 11.5l3.6 8 4.4-2V30h18V17.5l4.4 2 3.6-8-9-5c-1.3 2.7-4 4.3-8 4.3s-6.7-1.6-8-4.3z" fill="#8FB7F0"/><path d="M15 30h18l1.5 12.5h-7.5L24 34l-3 8.5h-7.5z" fill="#8FB7F0"/><path d="M24 12v16" stroke-width="2"/><path d="M27.5 17.5a3 3 0 1 1-3.4-3.4 2.4 2.4 0 0 0 3.4 3.4z" fill="#FFD45C" stroke-width="1.6"/><path d="M19 22.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="#FFD45C" stroke-width="1.4"/>',
  book: '<path d="M4 13v27.5c7-1.6 14-1 20 2 6-3 13-3.6 20-2V13" fill="#EF7A6B"/><path d="M24 12.5c-5-3-12-3.6-17.5-2v26.5c5.5-1.6 12.5-1 17.5 2z" fill="#fff"/><path d="M24 12.5c5-3 12-3.6 17.5-2v26.5c-5.5-1.6-12.5-1-17.5 2z" fill="#fff"/><path d="M24 12.5V39" fill="none"/><path d="M11 17.5c2.8-.6 6-.4 8.5.6M11 22.5c2.8-.6 6-.4 8.5.6M28.5 18.1c2.5-1 5.7-1.2 8.5-.6M28.5 23.1c2.5-1 5.7-1.2 8.5-.6" stroke-width="1.8"/>',
  sleep: '<path d="M30 9.5A15 15 0 1 0 38.5 34 12.5 12.5 0 0 1 30 9.5z" fill="#FFD45C"/><path d="M33 7h6l-6 7h6" fill="none" stroke-width="2.2"/><path d="M40 16.5h4l-4 4.5h4" fill="none" stroke-width="2"/><circle cx="17" cy="23" r="1.4" fill="#1F3442" stroke="none"/><path d="M14.5 29c1.8 1.6 4.8 1.6 6.4 0" fill="none" stroke-width="2"/>',
  bulb: '<path d="M24 5a12 12 0 0 0-7 21.7c1.3 1 2 2.4 2 4V33h10v-2.3c0-1.6.7-3 2-4A12 12 0 0 0 24 5z" fill="#FFE27A"/><rect x="18.5" y="33" width="11" height="8" rx="2.5" fill="#D5DEE4"/><path d="M18.5 37h11" stroke-width="2"/><path d="M21 18c1-2.4 3-3.6 5.4-3.6" fill="none" stroke="#fff" stroke-width="2.6"/>',
  teddy: '<circle cx="15.5" cy="10" r="4.5" fill="#B9835A"/><circle cx="32.5" cy="10" r="4.5" fill="#B9835A"/><ellipse cx="11" cy="31" rx="4" ry="5.5" fill="#B9835A"/><ellipse cx="37" cy="31" rx="4" ry="5.5" fill="#B9835A"/><ellipse cx="24" cy="34" rx="11.5" ry="9.5" fill="#B9835A"/><ellipse cx="24" cy="35" rx="6.5" ry="5.5" fill="#E7BF95" stroke-width="1.8"/><circle cx="24" cy="17.5" r="10" fill="#B9835A"/><ellipse cx="24" cy="21" rx="4.6" ry="3.6" fill="#E7BF95" stroke-width="1.8"/><circle cx="20" cy="15.5" r="1.4" fill="#1F3442" stroke="none"/><circle cx="28" cy="15.5" r="1.4" fill="#1F3442" stroke="none"/><path d="M22.6 19.8h2.8" stroke-width="2.4"/>',
  plate: '<path d="M7 8v9a3 3 0 0 0 3 3v21M4.5 8v8M9.5 8v8" fill="none" stroke-width="2.2"/><path d="M42 8c-3 1.5-4 6-4 12h4v21" fill="none" stroke-width="2.2"/><circle cx="24" cy="25" r="13.5" fill="#fff"/><circle cx="24" cy="25" r="8.5" fill="#EAF1F5" stroke-width="1.8"/>',
  fish: '<path d="M36 24l8-7v14z" fill="#F5A25D"/><path d="M6 24c4-8 11-11 18-11s12 4 14 11c-2 7-7 11-14 11S10 32 6 24z" fill="#F5A25D"/><path d="M22 14c2 3 2 17 0 20" fill="none" stroke-width="2"/><circle cx="13.5" cy="22" r="1.7" fill="#1F3442" stroke="none"/><circle cx="8" cy="11" r="2" fill="#E3F4FC" stroke-width="1.6"/><circle cx="12" cy="6" r="1.4" fill="#E3F4FC" stroke-width="1.4"/>',
  screen: '<path d="M18 5l6 6 6-6" fill="none" stroke-width="2.2"/><rect x="5" y="11" width="38" height="26" rx="5" fill="#4F5D75"/><rect x="9.5" y="15" width="29" height="18" rx="2.5" fill="#9ADAEC" stroke-width="1.8"/><path d="M14 43h20" stroke-width="2.6"/>',
  hat: '<path d="M8 30.5c0-10 7-17.5 16-17.5s16 7.5 16 17.5z" fill="#6FB3E0"/><path d="M24 13v17.5M16 16c-1.6 4-2 9-1.6 14.5M32 16c1.6 4 2 9 1.6 14.5" fill="none" stroke-width="1.8"/><circle cx="24" cy="12.3" r="2" fill="#6FB3E0" stroke-width="1.8"/><path d="M28 30.5h15c1.6 0 2 2 .6 2.8-3.5 2-9.6 2.6-15.6 1.6z" fill="#4E97C9"/>',
  swim: '<path d="M15.5 5h4v6.5c1.5 1.7 2.8 2.6 4.5 2.6s3-.9 4.5-2.6V5h4v9.5c0 3-1.4 5-2.6 6.4 1.2 2 2.6 5 2.6 8.6 0 6.2-4.2 10.5-8.5 12.5-4.3-2-8.5-6.3-8.5-12.5 0-3.6 1.4-6.6 2.6-8.6-1.2-1.4-2.6-3.4-2.6-6.4z" fill="#F07FA3"/><path d="M17.3 27c2.2-1.6 4.4-1.6 6.7 0s4.5 1.6 6.7 0" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M17 32.5c2.3-1.6 4.6-1.6 7 0s4.7 1.6 7 0" fill="none" stroke="#fff" stroke-width="2.4"/>',
  books: '<rect x="7" y="33" width="34" height="8" rx="2" fill="#7CC48B"/><rect x="10" y="25" width="30" height="8" rx="2" fill="#F5A25D"/><rect x="8" y="17" width="31" height="8" rx="2" fill="#6FB3E0"/><path d="M12 37h20M15 29h17M12 21h18" stroke-width="1.8"/><path d="M27 8.5l6 2.2-2.7 6.3-6-2.2z" fill="#EF7A6B" stroke-width="1.8"/>',
  icecream: '<path d="M16 24l8 19 8-19z" fill="#F2C47E"/><path d="M19 28l9 6M21.5 34.5l6-4" stroke-width="1.6"/><circle cx="18.5" cy="19.5" r="6.5" fill="#F4A6C0"/><circle cx="29.5" cy="19.5" r="6.5" fill="#B9E3C6"/><circle cx="24" cy="12" r="7" fill="#FFF3D6"/><circle cx="24" cy="5.5" r="2.2" fill="#EF5A5A" stroke-width="1.6"/>',
  slide: '<path d="M8 42V13M17 42V13M8 19h9M8 26h9M8 33h9" fill="none" stroke-width="2.4"/><path d="M17 13h3c4 0 6 3 8 8l4 11c1.5 4 4 6 8 6h4v4h-5c-5 0-8.5-3-10.4-8L24 23c-1.4-4-3-6-6-6h-1z" fill="#F7C948"/>',
  movie: '<rect x="6" y="19" width="36" height="22" rx="3" fill="#4F5D75"/><path d="M6 14.5l34.5-8 1.3 5.6-34.5 8z" fill="#fff"/><path d="M13 13l4 5M21 11l4 5M29 9.2l4 5" stroke-width="2"/><path d="M21 25v10l8.5-5z" fill="#FFD45C" stroke-width="1.8"/>',
  sunrise: '<path d="M10 33a14 14 0 0 1 28 0z" fill="#FFC64D"/><path d="M24 7v6M9.5 14l4 4M38.5 14l-4 4M3.5 26h5M39.5 26h5" stroke="#F2A93A" stroke-width="2.4"/><path d="M4 33.5h40M12 40h24" stroke-width="2.4"/>',
  timer: '<rect x="12" y="5" width="24" height="5" rx="2.5" fill="#B9835A"/><rect x="12" y="38" width="24" height="5" rx="2.5" fill="#B9835A"/><path d="M15 10h18c0 7-4 10-7 14 3 4 7 7 7 14H15c0-7 4-10 7-14-3-4-7-7-7-14z" fill="#E3F4FC"/><path d="M18.5 35c1.5-3 3.5-4.5 5.5-4.5s4 1.5 5.5 4.5z" fill="#F7C948" stroke-width="1.6"/><path d="M19.5 15h9c-1 2-2.6 3.4-4.5 5-1.9-1.6-3.5-3-4.5-5z" fill="#F7C948" stroke-width="1.6"/>',
  wash: '<path d="M10 15h18v-4h6v8H16v-4" fill="#D5DEE4"/><path d="M31 23c2 3.2 3 5.2 3 6.6a3 3 0 0 1-6 0c0-1.4 1-3.4 3-6.6z" fill="#9ADAEC" stroke-width="1.8"/><path d="M6 32c4-2 9-2.4 13-1l8 2.6c1.6.6 1.6 2.9-.2 3.2L19 38" fill="#F2C9A7"/><path d="M6 32v10h14c3 0 6-1 9-3l11-7c1.4-1 .4-3.2-1.3-2.7L28 32" fill="#F2C9A7"/>',
  star: '<path d="M24 5l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L24 33.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8z" fill="#F7BC2A"/>',
  gift: '<rect x="7" y="18" width="34" height="8" rx="2.5" fill="#EF7A6B"/><rect x="10" y="26" width="28" height="16" rx="2.5" fill="#EF7A6B"/><path d="M24 18v24" stroke-width="2.2"/><rect x="21" y="18" width="6" height="24" fill="#FFD45C" stroke-width="2"/><path d="M24 18c-3-6-10-8-11-4s5 4 11 4zM24 18c3-6 10-8 11-4s-5 4-11 4z" fill="#FFD45C"/>',
  clear: '<circle cx="24" cy="25" r="15" fill="#B9E3C6"/><path d="M16.5 25.5l5 5 10-11" fill="none" stroke-width="3"/><path d="M38 8v5M35.5 10.5h5M9 9v4M7 11h4" stroke="#F2B53A" stroke-width="2.2"/>',
  note: '<path d="M10 8h28v22l-10 10H10z" fill="#FFE27A"/><path d="M28 40V30h10" fill="#F2C94C"/><path d="M15 16h18M15 22h14" stroke-width="2"/>',
  cal: '<rect x="7" y="10" width="34" height="30" rx="5" fill="#fff"/><path d="M7 15a5 5 0 0 1 5-5h24a5 5 0 0 1 5 5v4H7z" fill="#EF7A6B"/><path d="M16 6v8M32 6v8" stroke-width="2.4"/><circle cx="17" cy="27" r="2" fill="#6FB3E0" stroke="none"/><circle cx="24" cy="27" r="2" fill="#6FB3E0" stroke="none"/><circle cx="31" cy="27" r="2" fill="#6FB3E0" stroke="none"/><circle cx="17" cy="34" r="2" fill="#6FB3E0" stroke="none"/>',
  water: '<rect x="18" y="4" width="12" height="6" rx="2" fill="#4E97C9"/><path d="M16.5 10h15l1.5 4v24.5A4.5 4.5 0 0 1 28.5 43h-9A4.5 4.5 0 0 1 15 38.5V14z" fill="#9ADAEC"/><path d="M15 22h18" stroke-width="2"/><path d="M19 27v10" stroke="#fff" stroke-width="2.6"/>',
};
// which picture goes with which emoji (the ones families already use); custom steps keep their own emoji
const KART_OF = {'🚽': 'toilet', '🪥': 'teeth', '👕': 'dress', '👚': 'dress', '🥣': 'breakfast', '👟': 'shoes', '🎒': 'bag', '🛁': 'bath', '🩲': 'pjs', '📖': 'book', '💡': 'bulb', '🧸': 'teddy', '🍽': 'plate', '🐟': 'fish', '📺': 'screen', '🧢': 'hat', '🩱': 'swim', '📚': 'books', '🍦': 'icecream', '🛝': 'slide', '🎬': 'movie', '🌅': 'sunrise', '⏳': 'timer', '🧼': 'wash', '💧': 'water', '🌙': 'sleep', '😴': 'sleep', '⭐': 'star', '🌟': 'star', '🎁': 'gift'};
const kartKey = (emoji, label = '') => { const e = String(emoji || '').replace(/️/g, '').trim(); if (/lights? out|sleep|go to bed/i.test(label) && (e === '💡' || e === '🌙' || !e)) return 'sleep'; return KART_OF[e] || ''; };
// Picture picker for jobs and routines: our drawn tiles, plus a best guess from the words
const KART_PICK = (() => { const seen = new Set(), out = []; Object.entries(KART_OF).forEach(([e, k]) => { if (!seen.has(k)) { seen.add(k); out.push([e, k]); } }); return out; })();
const KART_GUESS = [[/toy|tidy|pack away/i, '🧸'], [/teeth|brush/i, '🪥'], [/dress|clothes|uniform/i, '👕'], [/shoe/i, '👟'], [/bag|backpack/i, '🎒'], [/bath|shower/i, '🛁'], [/pyjama|pj/i, '🩲'], [/read|book/i, '📖'], [/table|plate|dish|dinner/i, '🍽'], [/fish|feed|pet/i, '🐟'], [/water|plant|drink/i, '💧'], [/wash|hands|soap/i, '🧼'], [/toilet|potty|wee/i, '🚽'], [/breakfast|cereal/i, '🥣'], [/hat|sunscreen/i, '🧢'], [/swim/i, '🩱'], [/bed|sleep/i, '🌙'], [/screen|tv|ipad/i, '📺'], [/homework|school/i, '📚'], [/light/i, '💡']];
const guessEmoji = t => (KART_GUESS.find(([re]) => re.test(t || '')) || [])[1] || '';
const kpickHTML = (cur = '', act = 'kpick', id = '') => `<div class="kpick" role="group" aria-label="Picture">${KART_PICK.map(([e, k]) => `<button type="button" class="kpb ${cur === e ? 'on' : ''}" data-act="${act}" data-e="${e}" ${id ? `data-id="${id}"` : ''} aria-label="${esc(k)}" aria-pressed="${cur === e}">${kart(e, '', 'sx')}</button>`).join('')}</div>`;
const STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.66l-5.5 2.89 1.05-6.12L3.1 9.1l6.15-.9z"/></svg>';
const emptyArt = k => `<span class="emart kart" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="var(--kart-ink,#1F3442)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${KART[k]}</svg></span>`;
const kart = (emoji, label = '', cls = 'em') => { const k = kartKey(emoji, label); return k ? `<span class="${cls} kart" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="var(--kart-ink,#1F3442)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${KART[k]}</svg></span>` : `<span class="${cls}">${esc(emoji || '⭐')}</span>`; };

// Dinner pictures: same sticker style as the kids' tiles, picked from the meal's name (foodArt), so every planned dinner gets one.
const FOOD = {
  pasta: '<path d="M6 24h36c0 9-8 16-18 16S6 33 6 24z" fill="#F4F0E6"/><ellipse cx="24" cy="24" rx="18" ry="4.5" fill="#F7C948"/><path d="M14 23c3-3 7 2 10-1s7 2 10-1M16 26c3-2 6 1 9-1s6 1 8-1" fill="none" stroke="#C98F12" stroke-width="1.8"/><circle cx="21" cy="21.5" r="2.6" fill="#E2553D" stroke-width="1.6"/><circle cx="28" cy="22.5" r="2.4" fill="#E2553D" stroke-width="1.6"/><path d="M34 6v14M37 6v6c0 2-1.5 3-3 3M31 6v6c0 2 1.5 3 3 3" fill="none" stroke-width="2"/>',
  bake: '<rect x="5" y="17" width="38" height="20" rx="4" fill="#4E97C9"/><path d="M2 21h5M41 21h5" stroke-width="2.6"/><path d="M9 21c2-2 5-2 7 0s5 2 7 0 5-2 7 0 5 2 7 0v8H9z" fill="#F2B54A"/><circle cx="15" cy="25" r="1.4" fill="#C9772B" stroke="none"/><circle cx="24" cy="24" r="1.4" fill="#C9772B" stroke="none"/><circle cx="32" cy="26" r="1.4" fill="#C9772B" stroke="none"/><path d="M17 12c0-2 2-2 2-4M24 12c0-2 2-2 2-4M31 12c0-2 2-2 2-4" fill="none" stroke-width="1.8"/>',
  curry: '<path d="M5 24h38c0 9-8.5 16-19 16S5 33 5 24z" fill="#fff"/><ellipse cx="24" cy="24" rx="19" ry="4.5" fill="#F0A33C"/><path d="M8 24c2-4 9-6 13-4 0 3-6 5-13 4z" fill="#fff" stroke-width="1.8"/><circle cx="27" cy="22.5" r="2" fill="#7CC48B" stroke-width="1.4"/><circle cx="33" cy="24" r="2" fill="#C9772B" stroke-width="1.4"/><path d="M19 12c0-2 2-2 2-4M26 12c0-2 2-2 2-4" fill="none" stroke-width="1.8"/>',
  stirfry: '<path d="M6 21h32c0 9-7 16-16 16S6 30 6 21z" fill="#4F5D75"/><path d="M38 23l7-3" stroke-width="2.6"/><path d="M10 21c2-4 5-1 7-4s5 1 7-3 5 2 7-1 4 2 6 1" fill="#F7C948" stroke-width="1.8"/><circle cx="16" cy="18" r="1.8" fill="#7CC48B" stroke-width="1.4"/><circle cx="27" cy="17" r="1.8" fill="#EF7A6B" stroke-width="1.4"/><path d="M30 4l-8 14M35 5l-8 13" stroke="#B9835A" stroke-width="2.2"/>',
  soup: '<path d="M5 22h38c0 10-8.5 17-19 17S5 32 5 22z" fill="#6FB3E0"/><ellipse cx="24" cy="22" rx="19" ry="4.5" fill="#F2B54A"/><circle cx="17" cy="21.5" r="1.8" fill="#EF7A6B" stroke-width="1.4"/><circle cx="29" cy="22.5" r="1.8" fill="#7CC48B" stroke-width="1.4"/><path d="M17 13c0-2.5 3-2.5 3-5M24 13c0-2.5 3-2.5 3-5M31 13c0-2.5 3-2.5 3-5" fill="none" stroke-width="2"/>',
  taco: '<path d="M5 34a19 19 0 0 1 38 0z" fill="#F7C948"/><path d="M10 31c2-6 6-9 9-9M14 30c3-5 7-6 9-6" fill="none" stroke-width="1.6"/><path d="M8 33c2-5 5-8 8-9 1 3 4 4 7 3 2 2 5 2 7 0 3 1 6 3 8 6" fill="#7CC48B" stroke-width="1.8"/><circle cx="18" cy="27" r="2" fill="#EF5A5A" stroke-width="1.4"/><circle cx="29" cy="27.5" r="2" fill="#EF5A5A" stroke-width="1.4"/><path d="M4 34h40" stroke-width="2.4"/>',
  pizza: '<path d="M24 42L6 10c11-5 25-5 36 0z" fill="#F7C948"/><path d="M6 10c11-5 25-5 36 0l-2 4c-10-4-22-4-32 0z" fill="#D9925A"/><circle cx="20" cy="20" r="3" fill="#E2553D" stroke-width="1.6"/><circle cx="29" cy="22" r="3" fill="#E2553D" stroke-width="1.6"/><circle cx="24" cy="31" r="2.6" fill="#E2553D" stroke-width="1.6"/>',
  burger: '<path d="M7 21c0-8 8-13 17-13s17 5 17 13z" fill="#F2B54A"/><circle cx="18" cy="14" r=".9" fill="#1F3442" stroke="none"/><circle cx="25" cy="12" r=".9" fill="#1F3442" stroke="none"/><circle cx="31" cy="15" r=".9" fill="#1F3442" stroke="none"/><path d="M5 24c3-2 5 2 8 0s5 2 8 0 5 2 8 0 5 2 8 0 4 1 6 0" fill="none" stroke="#5DAA6B" stroke-width="2.6"/><rect x="6" y="26" width="36" height="6" rx="3" fill="#8A5A3A"/><path d="M7 34h34c0 4-3 6-7 6H14c-4 0-7-2-7-6z" fill="#F2B54A"/>',
  salad: '<path d="M5 24h38c0 9-8.5 16-19 16S5 33 5 24z" fill="#fff"/><path d="M8 24c0-5 4-8 8-7 1-4 6-6 10-3 3-3 9-2 10 3 4 0 6 4 5 7" fill="#7CC48B"/><circle cx="18" cy="21" r="2.4" fill="#EF5A5A" stroke-width="1.4"/><circle cx="30" cy="20" r="2.4" fill="#EF5A5A" stroke-width="1.4"/><path d="M23 18l3 4" stroke-width="1.6"/>',
  sausage: '<ellipse cx="24" cy="30" rx="19" ry="8" fill="#fff"/><rect x="10" y="20" width="26" height="7" rx="3.5" transform="rotate(-12 23 23)" fill="#B5603A"/><rect x="12" y="27" width="26" height="7" rx="3.5" transform="rotate(-6 25 30)" fill="#C9724A"/><path d="M15 24l3-1M22 22l3-1M17 31l3-.5M25 30l3-.5" stroke="#F2C9A7" stroke-width="1.6"/>',
  fish: '<ellipse cx="24" cy="30" rx="20" ry="9" fill="#fff"/><path d="M34 27l8-6v12z" fill="#F5A25D"/><path d="M9 27c3-6 9-8 14-8s10 3 12 8c-2 5-6 8-12 8S12 33 9 27z" fill="#F5A25D"/><circle cx="15" cy="25.5" r="1.4" fill="#1F3442" stroke="none"/><path d="M21 20c1.6 2.4 1.6 11.6 0 14" fill="none" stroke-width="1.8"/>',
  roast: '<ellipse cx="24" cy="34" rx="20" ry="7" fill="#fff"/><path d="M9 29c-2-7 3-14 11-14 6 0 10 4 10 9 0 3-1 5-3 6l-8 2c-4 1-8 0-10-3z" fill="#E59A4C"/><path d="M27 25l8-8" stroke-width="5.5"/><path d="M27 25l8-8" stroke="#fff" stroke-width="2.4"/><circle cx="37" cy="14.5" r="2.6" fill="#fff" stroke-width="1.8"/><circle cx="38.8" cy="18" r="2.6" fill="#fff" stroke-width="1.8"/><path d="M14 22c1.5-2 4-3 6-3" fill="none" stroke="#fff" stroke-width="2.2"/>',
  steak: '<ellipse cx="24" cy="31" rx="20" ry="9" fill="#fff"/><path d="M11 27c0-6 6-10 13-10 8 0 13 4 13 9 0 4-3 6-7 6-3 0-5-2-8-2-3 0-5 3-8 2-2-1-3-3-3-5z" fill="#A9583A"/><path d="M15 26c3-3 9-4 14-1" fill="none" stroke="#F2C9A7" stroke-width="2"/><circle cx="33" cy="24" r="2" fill="#7CC48B" stroke-width="1.4"/>',
  leftovers: '<rect x="7" y="20" width="34" height="19" rx="4" fill="#E3F4FC"/><rect x="5" y="14" width="38" height="7" rx="3" fill="#6FB3E0"/><rect x="19" y="10" width="10" height="5" rx="2" fill="#4E97C9"/><path d="M12 30c3-3 6 0 9-2s6 1 9-1 4 1 6 0" fill="none" stroke="#F2A93A" stroke-width="2.4"/><path d="M12 34h24" stroke-width="1.6"/>',
  plate: '<path d="M7 8v9a3 3 0 0 0 3 3v21M4.5 8v8M9.5 8v8" fill="none" stroke-width="2.2"/><path d="M42 8c-3 1.5-4 6-4 12h4v21" fill="none" stroke-width="2.2"/><circle cx="24" cy="25" r="13.5" fill="#fff"/><circle cx="24" cy="25" r="8.5" fill="#EAF1F5" stroke-width="1.8"/>',
};
const FOOD_RULES = [[/leftover/, 'leftovers'], [/taco|burrito|nacho|quesadilla|tortilla|fajita|enchilada|mexican/, 'taco'], [/pizza/, 'pizza'], [/burger|slider/, 'burger'],
  [/soup|chowder|broth|laksa|pho\b/, 'soup'], [/\bbake\b|casserole|pie\b|lasagn|gratin|shepherd|mornay|moussaka|crumble/, 'bake'], [/curry|korma|tikka|masala|dahl|dal\b|rendang|butter chicken|biryani|vindaloo/, 'curry'],
  [/stir|noodle|fried rice|teriyaki|chow mein|pad thai|udon|ramen|satay|wok|dumpling|sushi/, 'stirfry'], [/pasta|spaghetti|bolognese|penne|macaroni|mac and|carbonara|gnocchi|ravioli|fettuccin|linguin|risotto/, 'pasta'],
  [/fish|salmon|tuna|barramundi|prawn|seafood|cod\b|snapper|calamari/, 'fish'], [/sausage|snag|bbq|barbecue|hot dog/, 'sausage'], [/salad|poke|buddha bowl/, 'salad'],
  [/steak|beef|lamb|pork|cutlet|meatball|rissole|mince/, 'steak'], [/roast|chicken|drumstick|wings|schnitzel|nugget|turkey/, 'roast']];
const foodKey = t => { t = String(t || '').toLowerCase(); const r = FOOD_RULES.find(([re]) => re.test(t)); return r ? r[1] : 'plate'; };
const foodArt = (title, cls = 'fart') => `<span class="${cls} kart" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="var(--kart-ink,#1F3442)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${FOOD[foodKey(title)]}</svg></span>`;

// Assistant portraits: bespoke line marks on a tinted tile, one drawing style for all eight.
const PAV = {
  sunny: {bg: '#FBE7BE', ink: '#9A5208', g: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5"/>'},
  mate: {bg: '#F2DCC4', ink: '#86401A', g: '<path d="M6.8 14C6.6 8.2 8.6 5 12 5s5.4 3.2 5.2 9"/><path d="M9.2 6.7c1.5 1.1 4.1 1.1 5.6 0"/><path d="M6.9 11.4h10.2"/><path d="M2.5 15.3c2-1 4.7-1.5 9.5-1.5s7.5.5 9.5 1.5c-1.9 2-5.4 3.3-9.5 3.3s-7.6-1.3-9.5-3.3z"/>'},
  sass: {bg: '#F5D6E0', ink: '#9C2F55', g: '<circle cx="12" cy="12" r="9"/><path d="M7.4 7.6l2.7-1"/><circle cx="9" cy="10.4" r="1.1" fill="currentColor" stroke="none"/><path d="M13.6 10.8q1.3-1.4 2.6 0"/><path d="M8.6 14.6c1.8 1.4 4.7 1.5 7-.6"/>'},
  willow: {bg: '#D8EBD9', ink: '#2F6A46', g: '<path d="M5.5 19.5C8.6 15.4 12 10.6 18.6 4.8"/><path d="M18.6 4.8c-4.6.2-7.3 2.6-7.4 6.4 3.9.1 6.8-2.4 7.4-6.4z"/><path d="M9.7 14.4c-3.5-1-6-.1-7 2.6 2.9 1.1 5.6.3 7-2.6z"/><path d="M11.4 12.1c.5-3.3-.5-5.8-3.2-7-1.2 2.8 0 5.6 3.2 7z"/>'},
  news: {bg: '#DAE4EC', ink: '#284B63', g: '<rect x="9" y="2.8" width="6" height="10.4" rx="3"/><path d="M10.6 6.3h2.8M10.6 8.8h2.8"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v3.6M8.6 20.6h6.8"/>'},
  sterling: {bg: '#DFE2F4', ink: '#33408A', g: '<path d="M12 3a9 9 0 0 1 9 9"/><path d="M12 21a9 9 0 0 1-9-9"/><path d="M5.6 5.6l.9.9M17.5 17.5l.9.9"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'},
  ambrose: {bg: '#ECE1CE', ink: '#5A4426', g: '<path d="M10.2 10.4L4.6 7.3c-.9-.5-1.8.1-1.8 1.1v7.2c0 1 .9 1.6 1.8 1.1l5.6-3.1"/><path d="M13.8 10.4l5.6-3.1c.9-.5 1.8.1 1.8 1.1v7.2c0 1-.9 1.6-1.8 1.1l-5.6-3.1"/><rect x="10.2" y="9.6" width="3.6" height="4.8" rx="1.3"/>'},
  coach: {bg: '#FDDCCD', ink: '#A83E1C', g: '<circle cx="9.4" cy="13.6" r="5.6"/><circle cx="9.4" cy="13.6" r="1.6"/><path d="M9.4 8h10.4c.7 0 1.2.5 1.2 1.2v1.6c0 .7-.5 1.2-1.2 1.2h-5.2"/>'},
};
const pavatar = (p, cls = '') => { const a = PAV[p.id] || PAV.sunny; return `<span class="pav ${cls}" style="--av:${a.bg};--avi:${a.ink}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${a.g}</svg></span>`; };
const gselShow = g => document.querySelectorAll('[data-act="voice-g"]').forEach(b => { b.classList.toggle('on', b.dataset.v === g); b.setAttribute('aria-pressed', b.dataset.v === g); });
// Female or male voice, chosen per person; until they choose, each personality uses its own usual voice.
const voiceG = (pid = personaId()) => (settings().voiceG || {})[personaKey()] || persona(pid).g || 'f';
function personaPickerHTML() {
  const cur = personaId(), who = briefWho(), g = voiceG(cur);
  return `<h3 style="margin-top:6px">Voice</h3><div class="chips2 gsel" role="group" aria-label="Voice">${[['f', 'Female'], ['m', 'Male']].map(([k, l]) => `<button class="chip2 ${g === k ? 'on' : ''}" data-act="voice-g" data-v="${k}" aria-pressed="${g === k}">${l}</button>`).join('')}</div>
    <h3 style="margin-top:14px">Personality</h3><div class="asgrid">${PERSONAS.map(p => `<div class="pcard ${p.id === cur ? 'on' : ''}" data-pid="${p.id}"><button class="pmain" data-act="persona-set" data-v="${p.id}" aria-pressed="${p.id === cur}">${pavatar(p)}<b>${p.name}</b><small>${p.blurb}</small></button><button class="psample" data-act="persona-sample" data-v="${p.id}" aria-label="Hear ${p.name}">▶</button></div>`).join('')}</div>
    <p class="help">${who ? `This is ${esc(who.name)}'s assistant.` : 'This is the family screen\'s assistant.'} Each person can pick their own.</p>
    ${S.view === 'settings' ? `<h3 style="margin-top:14px">Read by</h3><div class="chips2 gsel">${[['natural', 'Natural (Google)', 'sparkle'], ['device', 'This device', 'mobile']].map(([k, l, ic]) => `<button class="chip2 ${LS.get('briefVoice', 'natural') === k ? 'on' : ''}" data-act="brief-voice" data-v="${k}">${icon(ic, 'xs')} ${l}</button>`).join('')}</div>
    <p class="help">${S.aiGemini ? 'Natural uses your free Gemini key: about 10 new recordings a day. Each brief is recorded once and every screen reuses it. If it runs out, this device\'s voice reads instead.' : 'Natural needs the free Gemini key (Settings → Kitchen). Until then, this device\'s voice reads it.'}</p>` : ''}`;
}
/* Your assistant's voice in the app's own messages. Facts stay the same; only the wording changes. */
const VOICE = {
  sunny: {ready: 'Warming up my voice… ☀️', limit: "I've chatted a lot today! This device's voice will read the rest.", busy: "My voice is having a moment, so this device's voice will read it.", hide: 'Okay! See you tomorrow morning ☀️',
    hello: "Hi, I'm Sunny! ☀️ Let's make it a great day.", shop: 'Shopping done! 🛒 Ticked items cleared and popped in the pantry.', events: n => `Popped ${n} event${n === 1 ? '' : 's'} in the calendar! 🎉`, saved: 'Saved! ✨', plannedPre: 'Yum! 🍽️ '},
  mate: {ready: 'Hang on, just clearing me throat…', limit: "I'm all talked out for today, so the phone's voice will read it.", busy: "My voice has carked it for now, so the phone's voice will read it.", hide: 'No worries, catch you tomorrow.',
    hello: "G'day, I'm your mate. We'll keep it easy.", shop: 'Shopping done, legend. Ticked stuff cleared and added to the pantry.', events: n => `Sorted. ${n} event${n === 1 ? '' : 's'} in the calendar.`, saved: 'Sorted.', plannedPre: 'Sorted. '},
  sass: {ready: "One sec, I'm getting into character…", limit: "I've hit my talking limit for today. The phone's voice is covering for me.", busy: "I'm not feeling chatty. The phone's voice will read it.", hide: "Fine. I'll be back tomorrow.",
    hello: 'Sass here. Try to keep up.', shop: 'Shopping done. Look at you, being organised.', events: n => `${n} event${n === 1 ? '' : 's'} added. Your calendar is thriving.`, saved: 'Saved. Obviously.', plannedPre: "You're welcome. "},
  willow: {ready: 'Just a moment while I get ready…', limit: "My voice needs a rest today, so this device will read it gently.", busy: "My voice is resting, so this device will read it.", hide: 'Hidden until tomorrow. Rest easy. 🌿',
    hello: "Hello, I'm Willow 🌿 One thing at a time.", shop: 'Shopping done. Ticked items are cleared and in the pantry.', events: n => `${n} event${n === 1 ? '' : 's'} added. All taken care of.`, saved: 'Saved.', plannedPre: 'One less thing to think about. '},
  news: {ready: 'Preparing audio…', limit: 'Daily voice limit reached. Using device voice.', busy: 'Natural voice unavailable. Using device voice.', hide: 'Hidden until tomorrow.',
    hello: 'Newsreader selected.', shop: 'Shopping done. Ticked items cleared and added to the pantry.', events: n => `Added ${n} event${n === 1 ? '' : 's'}.`, saved: 'Saved.', plannedPre: ''},
  sterling: {ready: 'Initialising voice systems…', limit: "Voice quota exhausted for today. Routing to this device's voice.", busy: "The natural voice is unavailable. Rerouting to this device's voice.", hide: 'Understood. Standing by until tomorrow.',
    hello: 'Sterling, at your service. Shall we begin?', shop: 'Shopping complete. Ticked items cleared and logged in the pantry.', events: n => `Done. ${n} event${n === 1 ? '' : 's'} added to the schedule.`, saved: 'Saved, as requested.', plannedPre: 'Menu arranged. '},
  ambrose: {ready: 'One moment, if you please…', limit: "I'm afraid my voice is spent for today. The device will read it instead.", busy: "My apologies, my voice isn't cooperating. The device will read it.", hide: 'Very good. Until tomorrow morning. 🎩',
    hello: 'Ambrose, at your service. Do take a jacket. 🎩', shop: "Shopping done. I've cleared the ticked items and stocked the pantry.", events: n => `Very good. ${n} event${n === 1 ? '' : 's'} added to the diary.`, saved: 'Very good.', plannedPre: 'Dinners arranged. '},
  coach: {ready: 'Getting pumped up… 💪', limit: 'Voice is benched for today. Device voice is subbing in!', busy: 'Voice is off the field. Device voice is subbing in!', hide: "Done for today. Back tomorrow, champ! 💪",
    hello: "Coach here! Let's get after it 💪", shop: 'Shopping smashed! 🛒 Ticked items cleared and in the pantry.', events: n => `Boom! ${n} event${n === 1 ? '' : 's'} locked in 💪`, saved: 'Locked in! 💪', plannedPre: 'Fuel sorted! 💪 '},
};
const pv = (k, ...a) => { const P = VOICE[personaId()] || VOICE.sunny, v = P[k] !== undefined ? P[k] : VOICE.news[k]; return typeof v === 'function' ? v(...a) : v; };
// Play text in a personality's voice: the natural recording if we can, otherwise the device's best voice.
// One voice at a time: each play gets a number, and anything still arriving from an older play is ignored.
const _say = {id: 0, end: null};
function playSpeech(text, pid, onStart, onEnd, opts = {}) {
  stopSpeech();
  const id = ++_say.id, live = () => _say.id === id, P = persona(pid), g = opts.g || voiceG(P.id);
  S._speaking = true; onStart && onStart();
  _say.end = () => { S._speaking = false; onEnd && onEnd(); };
  const done = () => { if (!live()) return; _say.end = null; S._speaking = false; onEnd && onEnd(); };
  const device = () => { if (live() && !speak(text, P.tone, done, g, P.uk)) done(); };
  if (!DEMO && (opts.sample || (S.aiOn && S.aiGemini !== false)) && LS.get('briefVoice', 'natural') === 'natural') { // samples are pre-recorded: free for everyone
    const a = S._audio || (S._audio = new Audio()); a.onended = a.onerror = null;
    try { a.src = silentWav(); a.play().catch(() => {}); } catch {}
    const slow = setTimeout(() => live() && toast(pv('ready'), 3000), 900);
    callAI({action: 'speak', text, persona: P.id, gender: g, sample: !!opts.sample}).then(r => {
      clearTimeout(slow); if (!live()) return;
      const fallback = msg => { if (!live()) return; if (msg) toast(msg, 4000); device(); };
      if (!r || !r.url) return fallback(r && r.error === 'voice-limit' ? pv('limit') : r && r.error === 'voice-nokey' ? '' : pv('busy'));
      a.onended = done; a.onerror = () => fallback(pv('busy'));
      a.src = r.url; a.play().catch(() => fallback('Tap play again to hear it.'));
    });
    return;
  }
  device();
}
const andList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const sayTime = d => fmtTime(d).replace(':00', '');
function briefFacts(now = new Date()) {
  const k = dayKey(now), me = briefWho(), wx = dayWx(k);
  const events = eventsOnKey(k).filter(e => e.all_day || new Date(e.ends_at) > now).slice(0, 6).map(e => {
    const st = new Date(e.starts_at), b = e.all_day ? 0 : leaveBufferFor(e), ms = eventMembers(e), m = ms.length ? {name: andList(ms.map(x => x.name))} : null;
    return {title: e.title || 'Busy', time: e.all_day ? 'all day' : sayTime(st), who: m ? m.name : '', taking: (takerOf(e) || {}).name || '', where: e.location || '', leave_by: b ? sayTime(new Date(st - b * 60e3)) : '', drive_min: driveFor(e)};
  });
  const noEmoji = t => String(t || '').replace(/\p{Extended_Pictographic}️?/gu, '').replace(/\s+([,.])/g, '$1').replace(/\s+/g, ' ').trim();
  const reminders = chipsFor(k, now).map(c => {
    const t = noEmoji(c.text);
    if (c.act === 'lunch-open') { const names = t.replace(/^Lunchboxes:\s*/i, '').split(/,\s*/).filter(Boolean); return c.k === k ? `Pack the lunchboxes${names.length ? ' for ' + andList(names) : ''}` : `Prep tomorrow's lunchboxes`; }
    if (c.icon === 'bag') return t.replace(/^([^:]+):\s*(.*)$/, (m, n, x) => `${n} needs ${x.toLowerCase().replace(/\s*\+\s*/g, ' and ')}`);
    if (c.act === 'staples-add') return c.anyOut ? `We're out of ${andList(c.staples)}, worth grabbing today` : `Running low on ${andList(c.staples)}`;
    if (c.icon === 'bin') return `${t.replace(/\s*\+\s*/g, ' and ')} ${c.sub === 'out tonight' ? 'go out tonight' : 'are collected today'}`;
    return t.replace(/\s*\+\s*/g, ' and ') + (c.sub && !/^(today|bring today)$/.test(c.sub) ? ` (${c.sub})` : '');
  });
  const dinner = mealOn(k), defrost = dinner && !dinner.cooked ? [...new Set((dinner.ingredients || []).map(x => S.pantry.find(p => p.place === 'freezer' && !p.leftover && needsThaw(p.name) && sameFood(p.name, x.name))).filter(Boolean).map(p => p.name))] : [];
  const todos = me ? S.items.filter(i => !i.done && i.assignee === me.id).slice(0, 3).map(i => i.text) : [];
  const cd = S.countdowns.map(c => [c, daysBetween(k, c.date)]).filter(([, d]) => d > 0 && d <= 45).sort((a, b) => a[1] - b[1])[0];
  return {name: me ? me.name : '', part: hoursFloat(now) < 12 ? 'morning' : hoursFloat(now) < 17 ? 'afternoon' : 'evening', date: fmtDay(k, {weekday: 'long', day: 'numeric', month: 'long'}),
    weather: wx ? {words: wxWords(wx.code), high: wx.hi, low: wx.lo, rain_mm: Math.round(wx.mm || 0)} : null, events, reminders, dinner: dinner ? (dinner.leftovers_of ? 'leftovers' : dinner.title) : '', defrost, my_todos: todos,
    countdown: cd ? {title: cd[0].title, sleeps: cd[1]} : null};
}
function briefTemplate(f) {
  const out = [], list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  out.push(`Good ${f.part}${f.name ? ', ' + f.name : ''}. It's ${f.date}.`);
  if (f.weather) out.push(`${f.weather.words}${f.weather.high != null ? `, top of ${f.weather.high}` : ''}${f.weather.rain_mm >= 2 ? ', with some rain about' : ''}.`);
  const ev = f.events.filter(e => e.time !== 'all day'), allDay = f.events.filter(e => e.time === 'all day');
  if (ev.length) { const e = ev[0]; out.push(`First up, ${e.title}${e.who ? ' for ' + e.who : ''} at ${e.time}${e.leave_by ? `, so leave by ${e.leave_by}` : ''}${e.taking ? ` (${e.taking} is taking ${e.who && e.who !== e.taking ? 'them' : 'it'})` : ''}.`);
    if (ev.length > 1) out.push(`Then ${list(ev.slice(1, 4).map(x => `${x.title} at ${x.time}`))}.`); }
  else out.push(allDay.length ? '' : 'Nothing on the calendar today.');
  if (allDay.length) out.push(`All day: ${list(allDay.map(x => x.title))}.`);
  if (f.defrost.length) out.push(`Take the ${list(f.defrost.map(x => x.toLowerCase()))} out of the freezer for tonight.`);
  f.reminders.slice(0, 4).forEach((r, i) => { const t = r.replace(/\s*\(.*\)$/, ''); out.push(i === 0 ? `Don't forget: ${t.charAt(0).toLowerCase() + t.slice(1)}.` : `${t.charAt(0).toUpperCase() + t.slice(1)}.`); });
  if (f.dinner) out.push(f.dinner === 'leftovers' ? "Dinner's leftovers, so no cooking tonight." : `Dinner is ${f.dinner}.`);
  if (f.my_todos.length) out.push(`On your list: ${list(f.my_todos)}.`);
  if (f.countdown) out.push(`And ${f.countdown.sleeps === 1 ? 'just one sleep' : f.countdown.sleeps + ' sleeps'} until ${f.countdown.title}!`);
  return out.filter(Boolean).join(' ');
}
const briefHash = f => { const t = JSON.stringify(f); let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return String(h); };
function briefText() {
  const f = briefFacts(), pid = personaId(), who = (briefWho() || {}).id || 'family', key = `brief:${dayKey(new Date())}:${who}:${pid}`, hash = briefHash(f), c = LS.get(key, null);
  if (S.aiOn && !DEMO && (!c || (c.hash !== hash && Date.now() - c.at > 90 * 60e3)) && S._briefReq !== key + hash) {
    S._briefReq = key + hash;
    callAI({action: 'brief', persona: pid, tone: persona(pid).tone, name: f.name, facts: f}).then(r => { if (r && r.text) { LS.set(key, {hash, text: r.text, at: Date.now()}); const el = $('.brief .btxt'); if (el) el.textContent = r.text; } });
  }
  return c && c.text ? c.text : briefTemplate(f);
}
function briefShow(now = new Date()) { const hr = hoursFloat(now); return hr >= 4.5 && hr < 11 && LS.get('briefHide', '') !== dayKey(now) && settings().brief !== false; }
function briefCardHTML(force) {
  if (!force && !briefShow()) return '';
  const P = persona();
  return `<section class="brief ${force || S._briefOpen ? 'open' : ''}" aria-label="Morning briefing"><div class="bhead"><span class="bk">☀️ <span class="bkl">Morning brief</span><span class="bks">Brief</span></span><span class="sp"></span>
    <button class="btn bplay ${S._speaking ? 'on' : ''}" data-act="brief-say">${S._speaking ? '■ Stop' : '▶ <span class="rl">Read it to me</span><span class="rs">Listen</span>'}</button>
    <button class="btn soft sm" data-act="brief-tone" aria-label="Assistant: ${P.name}. Change it">${pavatar(P, 'sm')}<span class="tl"> ${P.name}</span></button>
    ${force ? '' : `<button class="icon-btn sm" data-act="brief-hide" aria-label="Hide for today">${icon('x')}</button>`}</div>
    <p class="btxt" ${force ? '' : 'data-act="brief-more" role="button" tabindex="0" aria-label="Show the whole brief"'}>${esc(briefText())}</p></section>`;
}
function sayBtn(on) { const b = $('.bplay'); if (!b) return; b.classList.toggle('on', on); b.innerHTML = on ? '■ Stop' : '▶ <span class="rl">Read it to me</span><span class="rs">Listen</span>'; }
function stopSpeech() {
  _say.id++; const end = _say.end; _say.end = null;
  try { speechSynthesis.cancel(); } catch {}
  try { if (S._audio) { S._audio.onended = S._audio.onerror = null; S._audio.pause(); } } catch {}
  S._speaking = false; sayBtn(false); end && end();
}
let _silent = '';
function silentWav() { if (_silent) return _silent; const n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return (_silent = URL.createObjectURL(new Blob([b], {type: 'audio/wav'}))); }
// Best voice this device has: prefer the natural/enhanced/online ones, Australian first (British for the British assistants),
// and the chosen female or male voice where the device says which is which.
const FEM = /female|woman|\b(karen|kate|serena|samantha|catherine|martha|moira|tessa|fiona|libby|sonia|natasha|hazel|susan|zira|aria|jenny|olivia|isla|matilda)\b/i;
const MAL = /\bmale\b|\bman\b|\b(daniel|arthur|oliver|george|james|thomas|fred|aaron|lee|gordon|rishi|malcolm|ryan|william|david|mark|guy|liam|noah)\b/i;
const genderOf = v => FEM.test(v.name) ? 'f' : MAL.test(v.name) ? 'm' : '';
function bestVoice(g, uk) {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const score = v => (/natural|neural|online|premium|enhanced|siri/i.test(v.name) ? 6 : 0) + (uk ? (/en[-_]GB/i.test(v.lang) ? 4 : /en[-_]AU/i.test(v.lang) ? 1 : /^en/i.test(v.lang) ? 1 : -20) : (/en[-_]AU/i.test(v.lang) ? 3 : /en[-_]GB/i.test(v.lang) ? 2 : /^en/i.test(v.lang) ? 1 : -20))
    + (v.localService === false ? 2 : 0) - (/compact|espeak|robot/i.test(v.name) ? 4 : 0) + (g && genderOf(v) === g ? 7 : g && genderOf(v) ? -7 : 0);
  return vs.filter(v => /^en/i.test(v.lang)).sort((a, b) => score(b) - score(a))[0] || null;
}
function speak(text, tone, onEnd, g = '', uk = false) {
  const ss = window.speechSynthesis; if (!ss || !window.SpeechSynthesisUtterance) { toast("This device can't read aloud."); return false; }
  ss.cancel();
  const u = new SpeechSynthesisUtterance(text), v = bestVoice(g, uk);
  u.voice = v;
  u.lang = (v && v.lang) || (uk ? 'en-GB' : 'en-AU'); u.rate = ({calm: .9, bubbly: 1.04, sassy: 1, plain: 1.08})[tone] || 1;
  // No labelled voice of the right kind on this device: nudge the pitch instead.
  const off = g && (!v || genderOf(v) !== g) ? (g === 'm' ? -.22 : .12) : 0;
  u.pitch = Math.max(.5, (tone === 'bubbly' ? 1.08 : 1) + off);
  u.onend = u.onerror = () => onEnd && onEnd();
  ss.speak(u); return true;
}
try { window.speechSynthesis && speechSynthesis.getVoices(); if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } catch {}
V.family = () => `${skyHTML(isPhone())}${joinNoticeHTML()}${setupCardHTML()}${briefCardHTML()}${isPhone() ? `<div class="qa-in famqa">${quickAddHTML()}</div>` : ''}${mailNoteHTML()}${chipsHTML()}${kitchenHTML()}${kidsStripHTML()}<div class="board">${upNextHTML()}${listsZoneHTML()}${notesZoneHTML()}</div>`;

/* Focus (ADHD-friendly, like FocusFive): what matters now, the rest of today in five lines, your top five, and one box to add anything. */
// "Josh: book car service", "ask Josh to…", "tell Violet to…", "remind Josh to…", "…for Josh", "@Josh …"
// Voice writes numbers as words: "two to four pm", "half past three". Turn the time parts into digits.
const NUMW = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12};
function spokenTimes(t) {
  const W = '(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)', n = w => NUMW[w.toLowerCase()];
  t = String(t || '');
  t = t.replace(new RegExp(`\\bhalf past ${W}\\b`, 'gi'), (m, w) => n(w) + ':30').replace(new RegExp(`\\bquarter past ${W}\\b`, 'gi'), (m, w) => n(w) + ':15')
       .replace(new RegExp(`\\bquarter to ${W}\\b`, 'gi'), (m, w) => (n(w) === 1 ? 12 : n(w) - 1) + ':45');
  t = t.replace(new RegExp(`\\b${W}\\s+(thirty|fifteen|forty[- ]five)\\b`, 'gi'), (m, w, mm) => n(w) + ':' + ({thirty: '30', fifteen: '15'}[mm.toLowerCase()] || '45'));
  for (let i = 0; i < 2; i++) t = t.replace(new RegExp(`\\b${W}\\b(?=\\s*(?:o'?clock|am|pm|a\\.m\\.|p\\.m\\.|in the (?:morning|afternoon|evening))|\\s+(?:to|till|until|-)\\s+(?:\\d|${W.slice(1, -1)}))`, 'gi'), (m, w) => n(w));
  t = t.replace(/(^|\s)(?!at\s)(\S+\s+)?(\d{1,2}:\d\d)(?!\s*(?:am|pm))\b/gi, (m, a, w, tm) => w && /^at\s+$/i.test(w) ? m : `${a}${w || ''}at ${tm}`);
  return t.replace(/\b(\d{1,2}(?::\d\d)?)\s*o'?clock\b/gi, '$1').replace(/\b(\d{1,2}(?::\d\d)?)\s+in the (morning)\b/gi, '$1am').replace(/\b(\d{1,2}(?::\d\d)?)\s+in the (afternoon|evening)\b/gi, '$1pm');
}
const EVENT_CUE = /^(?:please\s+)?(?:add|make|create|put)?\s*(?:an?\s+)?(?:new\s+)?(?:event|appointment|appt|calendar entry|booking)\b[:,.]?\s*|^(?:put|add)\s+(?:this\s+)?(?:in|on|to)\s+(?:the\s+)?calendar[:,.]?\s*/i;
function parseAssignee(raw) {
  const names = S.members.map(m => [m, m.name.toLowerCase()]).sort((a, b) => b[1].length - a[1].length), me = meMember();
  const find = n => { n = String(n || '').toLowerCase().trim().replace(/^@/, ''); if (/^(me|myself)$/.test(n)) return me || null; const hit = names.find(([, nm]) => nm === n || nm.split(' ')[0] === n); return hit ? hit[0] : null; };
  // "task for Tallulah …", "add to Tallulah's to-do list …", "Tallulah's list: …"
  const cue = raw.match(/^(?:please\s+)?(?:add\s+|give\s+|new\s+)?(?:an?\s+)?(?:task|to-?do|todo|job|reminder|chore)s?\b\s*(.*)$/i) || raw.match(/^(?:add|put)\s+(?:this\s+)?(?:to|on|onto)\s+(.*)$/i) || raw.match(/^()(\w[\w'-]*'s\s+(?:to-?do\s+|todo\s+|task\s+)?list\b.*)$/i);
  if (cue) { const rest = cue[1] || cue[2] || '', low = rest.toLowerCase();
    for (const [mb, nm] of names) { const first = nm.split(' ')[0], i = low.search(new RegExp('\\b' + first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "(?:'s)?\\b")); if (i < 0 || i > 30) continue;
      const after = rest.slice(i + first.length).replace(/^'s\b/i, '').replace(/^\s*(?:(?:to|on|onto|in|for)\s+)?(?:(?:the|her|his|their|my)\s+)?(?:to-?do|todo|task|tasks)?\s*(?:list)?\s*[:,–-]?\s*(?:to\s+(?=\w+\s))?/i, '').trim();
      if (after) return {who: mb, text: after.charAt(0).toUpperCase() + after.slice(1)}; } }
  const pats = [/^@?([a-z][\w'-]*)\s*[:,–-]\s+(.+)$/i, /^(?:please\s+)?(?:ask|tell|remind|get)\s+([a-z][\w'-]*)\s+(?:to\s+)?(.+)$/i, /^([a-z][\w'-]*)\s+(?:to|needs to|should|has to|can)\s+(.+)$/i, /^(.+?)\s+(?:for|@)\s*([a-z][\w'-]*)$/i];
  for (const [i, re] of pats.entries()) { const m = raw.match(re); if (!m) continue; const [n, t] = i === 3 ? [m[2], m[1]] : [m[1], m[2]]; const who = find(n); if (who && t.trim()) return {who, text: t.trim()}; }
  const at = raw.match(/@([a-z][\w'-]*)/i); if (at && find(at[1])) return {who: find(at[1]), text: raw.replace(at[0], '').replace(/\s{2,}/g, ' ').trim()};
  return {who: null, text: raw};
}
const guessKind = t => /^(buy|get|pick up|grab|need)\b/i.test(t) || (t.split(/,| and /).every(x => aisleOf(x.trim()) !== 'Other') && t.split(' ').length <= 6) ? 'grocery' : 'todo';
function focusNow(now, k) {
  const st = settings(), evs = eventsOnKey(k).filter(e => !e.all_day && new Date(e.ends_at) > now), chips = chipsFor(k, now);
  const soon = evs.find(e => (new Date(e.starts_at) - now) / 60e3 - leaveBufferFor(e) <= 120);
  const firstChip = chips.find(c => c.first) || null;
  if (soon) return {ev: soon, rest: evs.filter(e => e !== soon), chips};
  if (firstChip) return {chip: firstChip, rest: evs, chips: chips.filter(c => c !== firstChip)};
  if (evs[0]) return {ev: evs[0], rest: evs.slice(1), chips};
  return {rest: [], chips};
}
// Focus background: a pale sky that follows the time of day (same colours as the sky strip elsewhere),
// a soft sun that crosses it, and low hills fading into the page. Decoration only.
function focusBgHTML(now) {
  const h = hoursFloat(now), night = document.body.classList.contains('night'), [t, b] = skyAt(h);
  const st = settings(), ds = st.dayStart || 6, de = st.dayEnd || 20, sunX = Math.max(8, Math.min(92, (h - ds) / Math.max(1, de - ds) * 84 + 8));
  const sky1 = night ? mix(t, '#0C1424', .55) : mix(t, '#FFFFFF', .36), sky2 = night ? mix(b, '#0C1424', .6) : mix(b, '#FFFFFF', .5);
  const sun = night ? 'rgba(220,228,255,.16)' : h < 9 || h > 17 ? 'rgba(255,214,170,.75)' : 'rgba(255,246,214,.85)';
  const hill = (c, a) => night ? mix(c, '#0C1424', .6) : mix(c, '#FFFFFF', a);
  return `<div class="fbg" aria-hidden="true" style="--fs1:${sky1};--fs2:${sky2};--sun:${sun};--sunx:${sunX.toFixed(1)}%">
    ${['M30 62c-26 0-40-15-36-31 4-15 22-21 36-15 7-19 33-27 52-15 13-15 44-12 51 9 20-3 34 10 31 26-2 15-17 26-36 26z', 'M28 58c-20 0-31-11-28-24 3-12 17-16 28-12 6-15 26-21 41-12 10-12 34-9 40 7 16-2 27 8 24 20-2 12-13 21-28 21z'].map((d, n) => `<svg class="fcloud c${n + 1}" viewBox="-8 0 180 70" focusable="false"><path d="${d}" fill="${night ? 'rgba(200,212,240,.08)' : 'rgba(255,255,255,.75)'}"/></svg>`).join('')}
    <svg class="fhills" viewBox="0 0 1200 200" preserveAspectRatio="none" focusable="false">
      <path d="M0 118 C150 82 300 96 430 112 C560 128 700 70 860 78 C1000 86 1100 110 1200 98 V200 H0 Z" fill="${hill('#A9C7BE', .55)}"/>
      <path d="M0 146 C180 118 330 130 470 142 C640 156 760 112 930 118 C1060 123 1140 140 1200 136 V200 H0 Z" fill="${hill('#9BBFA8', .62)}"/>
      <path d="M0 172 C200 150 380 162 560 170 C720 177 880 150 1040 156 C1120 159 1170 166 1200 164 V200 H0 Z" fill="${hill('#C9DCC4', .5)}"/>
    </svg></div>`;
}
V.focus = () => {
  const me = meMember(), now = new Date(), k = dayKey(now), st = settings(), hr = now.getHours();
  const N = focusNow(now, k);
  let hero;
  if (N.ev) {
    const e = N.ev, start = new Date(e.starts_at), mins = (start - now) / 60e3, live = mins <= 0, buffer = leaveBufferFor(e), drive = driveFor(e), leaveIn = mins - buffer;
    hero = `<div class="fnow" style="--c:${eventColour(e)}"><div class="fk">${live ? 'Happening now' : buffer ? (leaveIn <= 0 ? 'Time to leave' : 'Leave in') : 'Starts in'}</div>
      ${!live && !(buffer && leaveIn <= 0) ? `<div class="fbig num">${esc(relMins(buffer ? leaveIn : mins))}</div>` : ''}
      <div class="ft">${esc(e.title || 'Busy')}</div><div class="fs num">${esc(fmtTime(start))}${drive != null ? ` · ${drive} min drive` : ''}${e.location ? ' · ' + esc(e.location) : ''}</div>${N.rest[0] ? `<div class="fthen"><span>Then</span> <b class="num">${esc(fmtTime(new Date(N.rest[0].starts_at)))}</b> ${esc(N.rest[0].title || 'Busy')}</div>` : ''}</div>`;
  } else if (N.chip) {
    const c = N.chip;
    hero = `<${c.act ? `button data-act="${c.act}" data-k="${c.k}"` : 'div'} class="fnow chipnow"><div class="fk">${esc(c.sub || 'Now')}</div><div class="ft">${esc(c.text)}</div>${c.act ? '<div class="fs">Tap to see it</div>' : ''}</${c.act ? 'button' : 'div'}>`;
  } else hero = `<div class="fnow calmnow"><div class="fk">Right now</div><div class="ft">Nothing urgent.</div><div class="fs">${hr >= 20 ? 'Rest up.' : 'Breathe. The rest can wait.'}</div></div>`;
  // the rest of today, five lines at most
  const lines = [];
  N.rest.forEach(e => lines.push(`<li class="flev">${agendaRow(e, {size: 'md'})}</li>`));
  const din = mealOn(k); if (din && hr < 21) lines.push(`<li><span class="fw">${foodArt(din.leftovers_of ? 'leftovers' : din.title, 'fwart')}</span><span>Dinner: ${esc(din.leftovers_of ? 'leftovers' : din.title)}</span></li>`);
  N.chips.forEach(c => lines.push(`<li><span class="fw">${icon(c.bins ? 'bin' : c.icon === 'list' ? 'cart' : c.icon || 'check', 'xs')}</span><span>${esc(c.text)}${c.sub ? ` <small>${esc(c.sub)}</small>` : ''}</span></li>`));
  const showAll = isOpen('ftoday'), shown = showAll ? lines : lines.slice(0, 5);
  const t = listByKind('todo'), allT = t ? listItems(t.id, false) : [], mineFirst = it => it.assignee && me && it.assignee === me.id ? 0 : !it.assignee ? 1 : 2;
  const openT = allT.filter(i => !i.assignee || !me || i.assignee === me.id).sort((a, b) => mineFirst(a) - mineFirst(b)), top = openT.slice(0, 5);
  const gave = me ? allT.filter(i => i.assignee && i.assignee !== me.id && i.added_by === me.id) : [];
  const last = S._fqLast;
  return `<div class="fwrap">${focusBgHTML(now)}<div class="page focus2">
    <div class="fhead"><span>${esc(hr < 12 ? 'Morning' : hr < 17 ? 'Afternoon' : 'Evening')}${me ? ', ' + esc(me.name) : ''}</span><span class="fhr">${briefShow() ? `<button class="fbrief sm" data-act="brief-open" aria-label="Hear today's brief">${icon('sun')}<span>Brief</span></button>` : ''}<span class="num">${esc(fmtTime(now))}</span></span></div>
    ${hero}
    ${quickAddHTML()}
    <section class="fsec"><h2>Later today</h2>${shown.length ? `<ul class="fl">${shown.join('')}</ul>` : `<p class="fempty">${emptyArt('sunrise')}Nothing else today.</p>`}${lines.length > 5 ? `<button class="fold ${showAll ? 'open' : ''}" data-act="fold" data-k="ftoday">${icon('right')}${showAll ? 'Show less' : `${lines.length - 5} more`}</button>` : ''}</section>
    <section class="fsec"><h2>Your five${openT.length > 5 ? `<button class="more" data-act="go" data-view="lists">+${openT.length - 5} more</button>` : ''}</h2><ul class="items">${top.map(i => itemRow(i)).join('') || '<li class="fempty">All clear. Nice.</li>'}</ul>${gave.length ? `<p class="fgave">You've handed off ${gave.length}: ${[...new Set(gave.map(i => (memberById(i.assignee) || {}).name))].map(n => `${esc(n)} ${gave.filter(i => (memberById(i.assignee) || {}).name === n).length}`).join(', ')}</p>` : ''}</section>
  </div></div>`;
};

V.planner = () => {
  const me = meMember(), now = new Date(), k = dayKey(now);
  const t = listByKind('todo'), items = t ? listItems(t.id, true) : [];
  const open = items.filter(i => !i.done), done = items.filter(i => i.done);
  const days = [...Array(7)].map((_, i) => addDaysKey(k, i)).map(dk => {
    const evs = eventsOnKey(dk);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="lbl">${i18nDay(dk, k)}${WA_HOLIDAYS[dk] && settings().holidays ? ` · <span class="hol">${esc(WA_HOLIDAYS[dk])}</span>` : ''}</div>
      ${evs.length ? evs.map(e => agendaRow(e, {size: 'sm'})).join('') : '<div class="empty" style="padding:4px 0;font-size:16px">Free</div>'}</div>`;
  }).join('');
  const g = listByKind('grocery'), gc = g ? listItems(g.id, false).length : 0;
  return `${skyHTML(true)}${chipsHTML()}<div class="focus plan2">
    <div class="zone"><h2>Today's checklist${me ? ' · ' + esc(me.name) : ''}<span class="more num" style="color:var(--ink-2)">${done.length}/${items.length}</span></h2>
      <div class="qa-in">${quickAddHTML()}</div>
      <ul class="items scroll">${open.map(i => itemRow(i, true)).join('') || `<li class="empty">${emptyArt('clear')}All done for today.</li>`}${done.length ? `<li class="pdone"><button class="fold ${isOpen('pdone') ? 'open' : ''}" data-act="fold" data-k="pdone">${icon('right')}${done.length} done</button></li>${isOpen('pdone') ? done.map(i => itemRow(i, true)).join('') : ''}` : ''}</ul></div>
    <div class="zone"><h2>This week<button class="more" data-act="go" data-view="lists">Groceries · ${gc}</button></h2><div class="scroll">${days}</div></div>
  </div>`;
};
function i18nDay(dk, today) {
  const d = daysBetween(today, dk);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : esc(fmtDay(dk, {weekday: 'long', day: 'numeric', month: 'short'}));
}

const BANDS = [['morning', 'Morning', 0, 11.5, 'sunrise', 8.5], ['lunch', 'Lunch', 11.5, 13.5, 'sun', 12.5], ['afternoon', 'Afternoon', 13.5, 17.5, 'cloudsun', 15.5], ['night', 'Night', 17.5, 24, 'moon', 19.6]];
const bandOf = e => { const h = hoursFloat(new Date(e.starts_at)); return BANDS.find(b => h >= b[2] && h < b[3]) || BANDS[0]; };
function evRow(e, big) {
  const m = eventMember(e), st = new Date(e.starts_at);
  return `<button class="ev evbtn" style="--c:${eventColour(e)}" data-act="open-event" data-id="${e.id}"><div class="when num">${e.all_day ? 'All day' : esc(fmtTime(st)) + untilHTML(e)}</div>
    <div><div class="what" ${big ? '' : 'style="font-size:19px"'}>${esc(e.title || 'Busy')}</div><div class="who">${whoMeta(e, (S.calendars.find(c => c.google_id === e.calendar_id) || {}).name || 'Family')}${e.location ? ' · ' + esc(e.location) : ''}</div></div></button>`;
}
V.calendar = () => {
  const today = dayKey(new Date()), mode = S.calMode;
  if (!S.dayKey) S.dayKey = today;
  const title = mode === 'day' || mode === 'people' ? (S.dayKey === today ? 'Today' : esc(fmtDay(S.dayKey, {weekday: 'long', day: 'numeric', month: 'long'}))) : mode === 'week' ? (w0 => { const w1 = addDaysKey(w0, 6), sameM = w0.slice(5, 7) === w1.slice(5, 7); return esc(`${fmtDay(w0, sameM ? {day: 'numeric'} : {day: 'numeric', month: 'short'})}–${fmtDay(w1, {day: 'numeric', month: 'short'})}`); })(addDaysKey(today, -((weekdayOfKey(today) + 6) % 7) + (S.calOffset || 0) * 7))
    : (() => { const p = tzParts(new Date()); let y = p.y, m = p.m - 1 + (S.calOffset || 0); y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return esc(fmtDay(`${y}-${String(m + 1).padStart(2, '0')}-01`, {month: 'long', year: 'numeric'})); })();
  const head = `<h1 class="calhead"><span class="ct">${title}</span><span class="sp"></span>
    <span class="cnav"><button class="icon-btn" data-act="cal-shift" data-n="-1" aria-label="Previous">${icon('left')}</button><button class="btn soft" data-act="cal-shift" data-n="0">Today</button><button class="icon-btn" data-act="cal-shift" data-n="1" aria-label="Next">${icon('right')}</button></span>
    <span class="seg cseg">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].concat([['people', 'People']]).map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="cal-mode" data-mode="${k}">${l}</button>`).join('')}</span>
    <button class="btn cal-add" data-act="ev-add" data-k="${mode === 'day' || mode === 'people' ? S.dayKey : ''}" aria-label="Add an event">${icon('plus')}<span>Add</span></button>
    <button class="icon-btn cref" data-act="cal-refresh" aria-label="Refresh calendar" title="Refresh calendar">${icon('refresh')}</button></h1>`;
  const noCal = S.calStatus && S.calStatus.connected ? '' : `<p class="help" style="color:var(--ink-2)">Add a calendar in Settings to fill this in.</p>`;
  const mailN = mailNoteHTML();
  if (mode === 'people') return `<div class="page wide">${head}${mailN}${noCal}${peopleHTML(S.dayKey)}</div>`;
  if (mode === 'day') {
    const k = S.dayKey, evs = eventsOnKey(k), allDay = evs.filter(e => e.all_day), timed = evs.filter(e => !e.all_day).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const nowH = hoursFloat(new Date());
    const notes = [WA_HOLIDAYS[k] && settings().holidays ? WA_HOLIDAYS[k] : '', settings().school && !WA_TERMS.some(([a, b]) => a <= k && k <= b) && weekdayOfKey(k) % 6 !== 0 ? 'School holidays' : ''].filter(Boolean);
    const bands = BANDS.map(([id, label, h1, h2, ic, mid]) => {
      const list = timed.filter(e => bandOf(e)[0] === id), [t, bt] = skyAt(mid), live = k === today && nowH >= h1 && nowH < h2;
      return `<section class="band ${live ? 'live' : ''}"><div class="band-sky" style="background:linear-gradient(180deg,${t},${bt})">${icon(ic)}<b>${label}</b></div>
        <div class="band-evs">${list.map(e => evRow(e, true)).join('') || '<div class="free">Free</div>'}</div></section>`;
    }).join('');
    return `<div class="page">${head}${mailN}${noCal}
      ${notes.length || allDay.length ? `<div class="row" style="margin-bottom:14px">${notes.map(n => `<span class="hol">${esc(n)}</span>`).join('')}${allDay.map(e => `<button class="wev ad" style="--c:${eventColour(e)};border:0;color:#fff" data-act="open-event" data-id="${e.id}">${esc(e.title)}</button>`).join('')}</div>` : ''}
      ${bands}</div>`;
  }
  if (mode === 'week') {
    const mon = addDaysKey(today, -((weekdayOfKey(today) + 6) % 7) + S.calOffset * 7);
    const cols = [...Array(7)].map((_, i) => { const k = addDaysKey(mon, i);
      const evs = eventsOnKey(k), allDay = evs.filter(e => e.all_day), timed = evs.filter(e => !e.all_day).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const term = settings().school && !WA_TERMS.some(([a, b]) => a <= k && k <= b) && weekdayOfKey(k) % 6 !== 0;
      let lastBand = '';
      const timedHTML = timed.map(e => { const b = bandOf(e); const head = b[0] !== lastBand ? `<div class="wband">${b[1]}</div>` : ''; lastBand = b[0];
        return head + `<button class="wev" style="--c:${eventColour(e)}" data-act="open-event" data-id="${e.id}" ${canEdit(e) ? `data-ev="${e.id}"` : ''}><span class="t num">${esc(fmtTime(new Date(e.starts_at)))}</span>${esc(e.title)}</button>`; }).join('');
      return `<div class="day ${k === today ? 'today' : ''}" data-k="${k}"><button class="dh" data-act="open-day" data-k="${k}" aria-label="Open ${esc(fmtDay(k, {weekday: 'long', day: 'numeric', month: 'long'}))}">${esc(fmtDay(k, {weekday: 'short'}))}<b class="num">${keyToDate(k).getUTCDate()}</b></button>
        ${(w => w ? `<div class="dwx" title="${esc(wxWords(w.code))}">${icon(wxIcon(w.code, 1))}<span class="num"><b>${w.hi}°</b> ${w.lo}°</span>${w.mm >= 1 ? `<span class="mm num">${Math.round(w.mm)}mm</span>` : ''}</div>` : '')(k >= today ? dayWx(k) : null)}
        ${WA_HOLIDAYS[k] && settings().holidays ? `<div class="hol">${esc(WA_HOLIDAYS[k])}</div>` : term ? '<div class="hol" style="background:color-mix(in srgb,#3A9AA0 18%,transparent);color:#246B70">School holidays</div>' : ''}
        ${allDay.map(e => `<button class="wev ad" style="--c:${eventColour(e)}" data-act="open-event" data-id="${e.id}" ${canEdit(e) ? `data-ev="${e.id}"` : ''}>${esc(e.title)}</button>`).join('')}${timedHTML}</div>`; }).join('');
    return `<div class="page" style="max-width:none">${head}${mailN}${noCal}<div class="week">${cols}</div></div>`;
  }
  const p = tzParts(new Date()); let y = p.y, m = p.m - 1 + S.calOffset; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  const first = `${y}-${String(m + 1).padStart(2, '0')}-01`, start = addDaysKey(first, -((weekdayOfKey(first) + 6) % 7));
  const cells = [...Array(42)].map((_, i) => { const k = addDaysKey(start, i), evs = eventsOnKey(k);
    return `<button class="mc ${k.slice(5, 7) !== first.slice(5, 7) ? 'out' : ''} ${k === today ? 'today' : ''}" data-act="open-day" data-k="${k}" aria-label="Open ${esc(fmtDay(k, {weekday: 'long', day: 'numeric', month: 'long'}))}"><span class="n num">${keyToDate(k).getUTCDate()}</span>
      ${WA_HOLIDAYS[k] && settings().holidays ? `<span class="e" style="--c:#D9773B"><i></i><span>${esc(WA_HOLIDAYS[k])}</span></span>` : ''}
      ${evs.slice(0, 3).map(e => `<span class="e" style="--c:${eventColour(e)}"><i></i><span>${esc(e.title)}</span></span>`).join('')}${evs.length > 3 ? `<span class="e" style="color:var(--ink-3)">+${evs.length - 3}</span>` : ''}</button>`; }).join('');
  return `<div class="page" style="max-width:none">${head}${mailN}${noCal}
    <div class="month">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<div class="mh">${d}</div>`).join('')}${cells}</div></div>`;
};

function shopHTML() {
  const l = S.lists.find(x => x.id === S.shop); if (!l) { S.shop = null; return ''; }
  const items = listItems(l.id), open = items.filter(i => !i.done), done = items.filter(i => i.done && i.done_at && Date.now() - new Date(i.done_at) < 6 * 3600e3);
  const groups = {}; open.forEach(i => (groups[aisleOf(i.text)] = groups[aisleOf(i.text)] || []).push(i));
  const left = open.reduce((a, i) => a + (+priceOf(i) || 0), 0), total = open.length + done.length;
  const row = i => `<li><button class="shoprow ${i.done ? 'got' : ''}" data-act="shop-tick" data-id="${i.id}"><span class="ck">${i.done ? icon('check') : ''}</span><span class="st">${esc(i.text)}</span>${priceOf(i) ? `<span class="sp2 num">~$${(+priceOf(i)).toFixed(2)}</span>` : ''}</button></li>`;
  return `<div class="shop" role="dialog" aria-label="Shopping list">
    <header><div><div class="sh1">${open.length ? `${open.length} to get` : 'All done! 🎉'}</div><div class="sh2">${esc(l.name)}${left ? ` · ~$${Math.round(left)} left` : ''}</div></div>
      <button class="btn ghost" data-act="shop-copy">Copy</button><button class="btn" data-act="shop-exit">Done</button></header>
    <div class="shopbar"><i style="width:${total ? Math.round(done.length / total * 100) : 0}%"></i></div>
    <div class="shopbody">${AISLE_ORDER.filter(a => groups[a]).map(a => `<section><h3>${esc(a)}</h3><ul>${groups[a].map(row).join('')}</ul></section>`).join('')}
    ${done.length ? `<section class="trolley"><h3>In the trolley · ${done.length}</h3><ul>${done.map(row).join('')}</ul></section>` : ''}
    ${!open.length ? `<div class="row" style="justify-content:center;margin:20px 0"><button class="btn" data-act="shop-finish" data-list="${l.id}">Finish and clear ticked</button><button class="btn ghost" data-act="shop-exit">Finish</button></div>` : ''}</div></div>`;
}
// Calm layout: fewer things on screen at once, more space. On automatically for people whose home view is Focus (Settings → Screen to change).
const isCalm = () => { const c = LS.get('calm', 'auto'); if (c === 'on') return true; if (c === 'off') return false; const me = meMember(); return !!(me && me.home_view === 'focus'); };
const isOpen = k => !!(S.fold || {})[k];
// To-dos given to someone sit under their name, so you can see what's yours and what's theirs
function openGroupsHTML(l, open) {
  const empty = `<ul class="items"><li class="empty">${emptyArt('clear')}${l.kind === 'grocery' ? 'All stocked up.' : 'Nothing here yet.'}</li></ul>`;
  if (!open.length) return empty;
  if (l.kind === 'grocery' || !open.some(i => i.assignee)) return `<ul class="items">${open.map(i => itemRow(i, true)).join('')}</ul>`;
  const me = meMember(), groups = [[me ? 'Yours' : null, open.filter(i => me && i.assignee === me.id)], ['Anyone', open.filter(i => !i.assignee)],
    ...S.members.filter(m => !me || m.id !== me.id).map(m => [`${m.name}'s`, open.filter(i => i.assignee === m.id)])].filter(([n, L]) => n && L.length);
  return groups.map(([n, L]) => `<div class="tgrp"><div class="tgh">${esc(n)} <span class="num">${L.length}</span></div><ul class="items">${L.map(i => itemRow(i, true)).join('')}</ul></div>`).join('');
}
V.lists = () => {
  if (!S.listId || !S.lists.find(l => l.id === S.listId)) S.listId = (S.lists[0] || {}).id;
  const l = S.lists.find(x => x.id === S.listId);
  const tabs = S.lists.map(x => `<button class="tab ${x.id === S.listId ? 'on' : ''}" data-act="pick-list" data-id="${x.id}">${esc(x.name)}<span class="n num">${listItems(x.id, false).length}</span></button>`).join('');
  if (!l) return `<div class="page"><h1>Lists</h1><button class="btn" data-act="new-list">${icon('plus')}New list</button></div>`;
  const items = listItems(l.id), open = items.filter(i => !i.done), done = items.filter(i => i.done);
  if (S.shop) return shopHTML();
  if (isCalm()) {
    const more = isOpen('ltools:' + l.id), showDone = isOpen('ldone:' + l.id), sug = suggestionsFor(l), b = l.kind === 'grocery' ? LS.get('gbudget:' + l.id, null) : null;
    return `<div class="page calm"><h1>Lists</h1><div class="tabs">${tabs}</div>
      <div class="panel"><form class="addbar" data-form="add-item" data-list="${l.id}"><input class="input" id="list-add" name="text" placeholder="Add to ${esc(l.name)}" autocomplete="off" maxlength="200">${micBtn('#list-add', true)}<button class="btn">${icon('plus')}Add</button></form>
        ${l.kind === 'grocery' && open.length ? `<button class="btn shopgo" data-act="shop-mode" data-list="${l.id}">${icon('bag')}I'm at the shops</button>` : ''}
        ${l.kind === 'grocery' && done.length ? `<button class="btn soft clearticked" data-act="clear-done" data-id="${l.id}">${icon('check')}Clear ${done.length} ticked</button>` : ''}
        ${openGroupsHTML(l, open)}
        <div class="foldbar">${done.length ? `<button class="fold ${showDone ? 'open' : ''}" data-act="fold" data-k="ldone:${l.id}" aria-expanded="${showDone}">${icon('right')}${showDone ? 'Hide' : 'Show'} ${done.length} done</button>` : ''}<button class="fold ${more ? 'open' : ''}" data-act="fold" data-k="ltools:${l.id}" aria-expanded="${more}">${icon('right')}More</button></div>
        ${showDone ? `<ul class="items">${done.map(i => itemRow(i, true)).join('')}</ul><div class="row"><span class="grow"></span><button class="btn ghost" data-act="clear-done" data-id="${l.id}">Clear done</button></div>` : ''}
        ${more ? `<div class="foldbody">${sug.length ? `<div class="lbl">Quick add</div><div class="quick">${sug.map(t => `<button class="qa" data-act="quick-add" data-list="${l.id}" data-text="${esc(t)}">${icon('plus')}<span>${esc(t)}</span></button>`).join('')}</div>` : ''}
          <div class="row" style="flex-wrap:wrap">${l.kind === 'grocery' ? `<button class="btn soft" data-act="brain-dump" data-list="${l.id}">${icon('sparkle')}Add lots at once</button><button class="btn soft" data-act="grocery-budget" data-list="${l.id}">$ Estimate cost</button>${b ? `<span class="lbl num">About <b>$${Math.round(listItems(l.id, false).reduce((a, i) => a + (+priceOf(i) || 0), 0))}</b></span>` : ''}` : ''}<button class="btn soft" data-act="new-list">${icon('plus')}New list</button>${l.kind === 'custom' ? `<button class="btn ghost" data-act="del-list" data-id="${l.id}">Delete this list</button>` : ''}</div></div>` : ''}
      </div></div>`;
  }
  return `<div class="page"><h1>Lists<span class="sp"></span><button class="btn soft" data-act="new-list">${icon('plus')}New list</button></h1>
    <div class="tabs">${tabs}</div>
    <div class="panel"><form class="addbar" data-form="add-item" data-list="${l.id}"><input class="input" id="list-add" name="text" placeholder="Add to ${esc(l.name)}" autocomplete="off" maxlength="200">${micBtn('#list-add', true)}<button class="btn">${icon('plus')}Add</button></form>
      ${(sug => sug.length ? `<div class="quick" aria-label="Quick add">${sug.map(t => `<button class="qa" data-act="quick-add" data-list="${l.id}" data-text="${esc(t)}">${icon('plus')}<span>${esc(t)}</span></button>`).join('')}</div>` : '')(suggestionsFor(l))}
      ${l.kind === 'grocery' && open.length ? `<button class="btn shopgo" data-act="shop-mode" data-list="${l.id}">${icon('bag')}I'm at the shops <small>${open.length} item${open.length === 1 ? '' : 's'}, in aisle order</small></button>` : ''}
      ${l.kind === 'grocery' && done.length ? `<button class="btn soft clearticked" data-act="clear-done" data-id="${l.id}">${icon('check')}Clear ${done.length} ticked</button>` : ''}
      ${l.kind === 'grocery' ? `<div class="row gtools"><button class="btn soft" data-act="brain-dump" data-list="${l.id}">${icon('sparkle')}Add lots at once</button><button class="btn soft" data-act="grocery-budget" data-list="${l.id}">$ Estimate cost</button>${(b => b ? `<span class="lbl num">Total about <b>$${Math.round(listItems(l.id, false).reduce((a, it) => a + (priceOf(it) || 0), 0) || b.total)}</b> · prices per item below · ${esc(ago((Date.now() - b.at) / 60e3))}</span>` : '')(LS.get('gbudget:' + l.id, null))}</div>` : ''}
      ${openGroupsHTML(l, open)}
      ${done.length ? `<div class="row" style="margin-top:16px"><span class="lbl">Done · ${done.length}</span><span class="grow"></span><button class="btn ghost" data-act="clear-done" data-id="${l.id}">Clear done</button></div><ul class="items">${done.map(i => itemRow(i, true)).join('')}</ul>` : ''}
      ${l.kind === 'custom' ? `<div class="row" style="margin-top:14px"><span class="grow"></span><button class="btn ghost" data-act="del-list" data-id="${l.id}">Delete this list</button></div>` : ''}
    </div></div>`;
};

V.notes = () => `<div class="page" style="max-width:none"><h1>Notes<span class="sp"></span><button class="btn" data-act="add-note">${icon('plus')}New note</button></h1>
  <div class="notes" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">${S.notes.map(noteHTML).join('') || `<div class="empty">${emptyArt('note')}<b>No notes yet</b>Notes show on the family screen until someone clears them.</div>`}</div></div>`;

