/* ---- House: the home's devices on a little model of the house ----
   Preview with sample devices until Home Assistant (plugs, lights, solar, vacuum, sensors) and Tesla are connected.
   The model is drawn from a room list on a grid, so the real floor plan can be laid out later. */
const HOUSE_SAMPLE = () => ({
  rooms: [
    {id: 'garage', name: 'Garage', x: 0, y: 0, w: 4, h: 4, kind: 'garage'},
    {id: 'living', name: 'Living', x: 4, y: 0, w: 5, h: 5, kind: 'living'},
    {id: 'kitchen', name: 'Kitchen', x: 9, y: 0, w: 3, h: 5, kind: 'kitchen'},
    {id: 'laundry', name: 'Laundry', x: 0, y: 4, w: 2, h: 2, kind: 'wet'},
    {id: 'bath', name: 'Bath', x: 2, y: 4, w: 2, h: 2, kind: 'wet'},
    {id: 'main', name: 'Main bed', x: 0, y: 6, w: 4, h: 3, kind: 'bed'},
    {id: 'kids', name: 'Kids', x: 4, y: 5, w: 4, h: 4, kind: 'kids'},
    {id: 'study', name: 'Study', x: 8, y: 5, w: 4, h: 4, kind: 'bed'},
    {id: 'yard', name: 'Back yard', x: 12.6, y: 0, w: 4.4, h: 9, kind: 'yard', outdoor: true},
  ],
  devices: [
    {id: 'd1', room: 'living', type: 'plug', name: 'Lamp', brand: 'Tapo', on: true, watts: 9, kwh: 0.1},
    {id: 'd2', room: 'living', type: 'plug', name: 'TV', brand: 'Tapo', on: true, watts: 84, kwh: 0.6},
    {id: 'd3', room: 'kids', type: 'plug', name: 'Night light', brand: 'Tapo', on: false, watts: 0, kwh: 0.05},
    {id: 'd4', room: 'garage', type: 'plug', name: 'Freezer', brand: 'Tapo', on: true, watts: 62, kwh: 1.1, lockOn: true},
    {id: 'd5', room: 'living', type: 'temp', name: 'Temperature', brand: 'Honey', temp: 22.5, hum: 48},
    {id: 'd6', room: 'kitchen', type: 'smoke', name: 'Smoke alarm', brand: 'Honey', ok: true},
    {id: 'd7', room: 'laundry', type: 'leak', name: 'Leak sensor', brand: 'Honey', ok: true},
    {id: 'd8', room: 'living', type: 'vacuum', name: 'Robot vacuum', brand: 'Dreame', state: 'docked', battery: 100},
    {id: 'd9', room: 'garage', type: 'car', name: 'Tesla', brand: 'Tesla', battery: 78, range: 392, plugged: true, charging: false, climate: false, locked: true, inside: 24},
    {id: 'd10', room: 'yard', type: 'pool', name: 'Pool pump', brand: '', future: true},
  ],
  solar: {now: 3.2, today: 9.4, use: 1.1, brand: 'SAJ'},
});
const houseData = () => (S.house = S.house || HOUSE_SAMPLE());
const houseLive = () => false; // becomes true once Home Assistant or Tesla is connected
const devById = id => houseData().devices.find(d => d.id === id);
const devIcon = d => ({plug: 'bolt', temp: 'sun', smoke: 'bell', leak: 'umbrella', vacuum: 'refresh', car: 'car', pool: 'swim', light: 'idea'})[d.type] || 'bolt';
const devOn = d => d.type === 'plug' || d.type === 'light' ? d.on : d.type === 'car' ? d.climate || d.charging : d.type === 'vacuum' ? d.state === 'cleaning' : false;
const devStatus = d => {
  if (d.future) return 'Not smart yet';
  if (d.type === 'plug' || d.type === 'light') return d.on ? `On · ${d.watts} W` : 'Off';
  if (d.type === 'temp') return `${d.temp.toFixed(1)}°C · ${d.hum}% humidity`;
  if (d.type === 'smoke') return d.ok ? 'All clear' : 'Alarm!';
  if (d.type === 'leak') return d.ok ? 'Dry' : 'Water detected!';
  if (d.type === 'vacuum') return d.state === 'cleaning' ? `Cleaning · ${d.battery}%` : `Docked · ${d.battery}%`;
  if (d.type === 'car') return `${d.battery}% · ${d.range} km${d.charging ? ' · charging' : d.plugged ? ' · plugged in' : ''}${d.climate ? ' · warming up' : ''}`;
  return '';
};
const devAlert = d => (d.type === 'smoke' || d.type === 'leak') && !d.ok;

// ---- the model: isometric rooms with low cut-away walls ----
const ISO = {s: 34, c: Math.cos(Math.PI / 6), n: Math.sin(Math.PI / 6), wall: .55};
const iso = (x, y, z = 0) => [(x - y) * ISO.c * ISO.s, (x + y) * ISO.n * ISO.s - z * ISO.s];
const pts = a => a.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
const ROOM_TONE = {light: {garage: '#E3E6E8', living: '#F2E6D2', kitchen: '#F4E0CC', wet: '#D7ECEC', bed: '#DEE6F2', kids: '#EADFF0', yard: '#D5E8CF'},
  dark: {garage: '#2A3446', living: '#3A3A44', kitchen: '#3E3842', wet: '#26404A', bed: '#2A3650', kids: '#363454', yard: '#24402F'}};
function houseSVG() {
  const H = houseData(), dark = document.body.classList.contains('night'), T = ROOM_TONE[dark ? 'dark' : 'light'];
  const wallTop = dark ? '#56647E' : '#FFFFFF', wallSide = dark ? '#3C4A63' : '#D5DEE4', wallFront = dark ? '#4A5873' : '#E9EEF1';
  const xs = [], ys = []; H.rooms.forEach(r => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].forEach(([a, b]) => { const p = iso(a, b, 0), q = iso(a, b, ISO.wall); xs.push(p[0]); ys.push(p[1], q[1]); }));
  const pad = 26, minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad - 10, W = Math.max(...xs) - minX + pad, Hh = Math.max(...ys) - minY + pad;
  const order = H.rooms.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const floor = r => { const f = [iso(r.x, r.y), iso(r.x + r.w, r.y), iso(r.x + r.w, r.y + r.h), iso(r.x, r.y + r.h)];
    const lit = H.devices.some(d => d.room === r.id && (d.type === 'plug' || d.type === 'light') && d.on && !d.lockOn), [cx, cy] = iso(r.x + r.w / 2, r.y + r.h / 2);
    const alert = H.devices.some(d => d.room === r.id && devAlert(d));
    // back walls (north and west edges) only, so you can see in: a cut-away dolls' house
    const nw = r.outdoor ? '' : `<polygon points="${pts([iso(r.x, r.y), iso(r.x + r.w, r.y), iso(r.x + r.w, r.y, ISO.wall), iso(r.x, r.y, ISO.wall)])}" fill="${wallSide}"/><polygon points="${pts([iso(r.x, r.y), iso(r.x, r.y + r.h), iso(r.x, r.y + r.h, ISO.wall), iso(r.x, r.y, ISO.wall)])}" fill="${wallFront}"/>
      <polyline points="${pts([iso(r.x, r.y + r.h, ISO.wall), iso(r.x, r.y, ISO.wall), iso(r.x + r.w, r.y, ISO.wall)])}" fill="none" stroke="${wallTop}" stroke-width="3" stroke-linejoin="round"/>`;
    const pool = r.kind === 'yard' ? (() => { const px = r.x + .8, py = r.y + 3, pw = r.w - 1.6, ph = 4.6; return `<polygon points="${pts([iso(px, py), iso(px + pw, py), iso(px + pw, py + ph), iso(px, py + ph)])}" fill="${dark ? '#1F5E86' : '#8FD0EE'}" stroke="${dark ? '#3E86B5' : '#5DB3DD'}" stroke-width="2"/>`; })() : '';
    return `<g class="hroom ${alert ? 'alert' : ''}" data-act="house-room" data-id="${r.id}" role="button" tabindex="0" aria-label="${esc(r.name)}: ${H.devices.filter(d => d.room === r.id).length} devices">
      <polygon class="hfloor" points="${pts(f)}" fill="${T[r.kind] || T.living}"/>${pool}
      ${lit ? `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(Math.min(r.w, r.h) * ISO.s * .9).toFixed(1)}" ry="${(Math.min(r.w, r.h) * ISO.s * .45).toFixed(1)}" fill="url(#hglow)"/>` : ''}${nw}</g>`; };
  const marks = H.rooms.map(r => { const L = H.devices.filter(d => d.room === r.id), [cx, cy] = iso(r.x + r.w / 2, r.y + r.h / 2);
    const label = `<text class="hlabel" x="${cx.toFixed(1)}" y="${(cy - (L.length ? 20 : 0)).toFixed(1)}" text-anchor="middle">${esc(r.name)}</text>`;
    const dots = L.map((d, i) => { const ox = (i - (L.length - 1) / 2) * 30, x = cx + ox, y = cy + 10, on = devOn(d), al = devAlert(d);
      return `<g class="hdev ${on ? 'on' : ''} ${al ? 'alert' : ''} ${d.future ? 'future' : ''}" data-act="house-dev" data-id="${d.id}" role="button" tabindex="0" aria-label="${esc(d.name)}: ${esc(devStatus(d))}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
        <circle r="13"/><use href="#i-${devIcon(d)}" x="-8" y="-8" width="16" height="16"/></g>`; }).join('');
    return label + dots; }).join('');
  return `<svg class="hmodel" viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${W.toFixed(0)} ${Hh.toFixed(0)}" role="group" aria-label="Model of the house. Tap a room or a device.">
    <defs><radialGradient id="hglow"><stop offset="0" stop-color="#FFD48A" stop-opacity="${dark ? .55 : .75}"/><stop offset="1" stop-color="#FFD48A" stop-opacity="0"/></radialGradient></defs>
    ${order.map(floor).join('')}${marks}</svg>`;
}

V.house = () => {
  const H = houseData(), car = H.devices.find(d => d.type === 'car'), temp = H.devices.find(d => d.type === 'temp'), vac = H.devices.find(d => d.type === 'vacuum');
  const alarms = H.devices.filter(d => d.type === 'smoke' || d.type === 'leak'), bad = alarms.filter(devAlert), live = houseLive();
  const onNow = H.devices.filter(d => (d.type === 'plug' || d.type === 'light') && d.on), watts = onNow.reduce((a, d) => a + (d.watts || 0), 0);
  const tile = (act, ic, k, v, sub, cls = '') => `<button class="htile ${cls}" data-act="${act}">${icon(ic)}<span class="k">${k}</span><b class="num">${v}</b><small>${sub}</small></button>`;
  return `<div class="page housep"><h1>House<span class="sp"></span>${live ? '' : `<span class="samplepill">Sample devices</span>`}<button class="btn soft" data-act="house-connect">${icon('wifi')}${live ? 'Connections' : 'Connect'}</button></h1>
    <div class="hnow">
      ${tile('house-solar', 'sun', 'Solar now', `${H.solar.now.toFixed(1)} kW`, `${H.solar.today} kWh today · home using ${H.solar.use} kW`, H.solar.now > H.solar.use ? 'good' : '')}
      ${car ? tile('house-car', 'car', car.name, `${car.battery}%`, `${car.range} km · ${car.climate ? 'warming up' : car.plugged ? 'plugged in' : 'unplugged'}`, car.climate ? 'warm' : '') : ''}
      ${temp ? tile('house-dev-t', 'sun', 'Inside', `${temp.temp.toFixed(1)}°`, `${temp.hum}% humidity`) : ''}
      ${tile('house-safety', 'bell', 'Safety', bad.length ? 'Check!' : 'All clear', `${alarms.length} sensors`, bad.length ? 'alert' : '')}
      ${vac ? tile('house-vac', 'refresh', 'Vacuum', vac.state === 'cleaning' ? 'Cleaning' : 'Docked', `${vac.battery}% battery`) : ''}
    </div>
    <div class="panel hmodelp"><div class="hmscroll">${houseSVG()}</div><div class="hfoot"><span>${onNow.length ? `${onNow.length} on · about ${watts} W` : 'Everything is off'}</span><span class="grow"></span><span class="help">${isPhone() ? 'Swipe to see it all · tap a room' : 'Tap a room or a dot'}</span></div></div>
    <div class="hrooms">${H.rooms.map(r => { const L = H.devices.filter(d => d.room === r.id); if (!L.length) return '';
      return `<div class="panel hroomc"><h2><button class="h2link" data-act="house-room" data-id="${r.id}">${esc(r.name)}${icon('right')}</button></h2><ul class="hdevl">${L.map(devRowHTML).join('')}</ul></div>`; }).join('')}</div>
  </div>`;
};
function devRowHTML(d) {
  const sw = (d.type === 'plug' || d.type === 'light') && !d.future;
  return `<li class="${devAlert(d) ? 'alert' : ''} ${d.future ? 'future' : ''}"><span class="hdi ${devOn(d) ? 'on' : ''}">${icon(devIcon(d))}</span><button class="hdn" data-act="house-dev" data-id="${d.id}"><b>${esc(d.name)}</b><small>${esc(devStatus(d))}${d.brand ? ` · ${esc(d.brand)}` : ''}</small></button>
    ${sw ? `<button class="hsw ${d.on ? 'on' : ''}" role="switch" aria-checked="${!!d.on}" aria-label="${esc(d.name)}" data-act="house-toggle" data-id="${d.id}" ${d.lockOn ? 'disabled title="Kept on"' : ''}><i></i></button>`
      : d.type === 'car' ? `<button class="btn soft sm" data-act="house-climate" data-id="${d.id}">${d.climate ? 'Stop' : 'Get ready'}</button>`
      : d.type === 'vacuum' ? `<button class="btn soft sm" data-act="house-vac">${d.state === 'cleaning' ? 'Dock' : 'Clean'}</button>` : ''}</li>`;
}
const sampleNote = () => houseLive() ? '' : '<p class="help hsample">Sample device: connect it to control it for real.</p>';
function devSheet(d) {
  const room = houseData().rooms.find(r => r.id === d.room) || {};
  let body = '';
  if (d.type === 'car') body = `<div class="hcarbig"><div class="num">${d.battery}%</div><div class="hbat"><span style="width:${d.battery}%"></span></div><p>${d.range} km range · ${d.plugged ? (d.charging ? 'charging' : 'plugged in') : 'unplugged'} · ${d.locked ? 'locked' : 'unlocked'} · inside ${d.inside}°C</p></div>
    <div class="row"><button class="btn" data-act="house-climate" data-id="${d.id}">${icon('sun')}${d.climate ? 'Stop warming up' : 'Get the car ready'}</button></div>
    <p class="help">Get ready turns on the climate so the car is comfortable when you get in. Later it can do this by itself before calendar events with a leave reminder.</p>`;
  else if (d.future) body = `<p class="help">The pool pump isn't connected. The simple first step is a smart plug or timer on the pump, then it can run on a schedule from here (and use solar when it's sunny).</p>`;
  else body = `<p class="hbig">${esc(devStatus(d))}</p>${d.kwh != null ? `<p class="help">${d.kwh} kWh used today</p>` : ''}
    ${(d.type === 'plug' || d.type === 'light') && !d.lockOn ? `<div class="row"><button class="btn" data-act="house-toggle" data-id="${d.id}">${d.on ? 'Turn off' : 'Turn on'}</button></div>` : ''}${d.lockOn ? '<p class="help">Kept on (a freezer shouldn\'t be switched off by accident).</p>' : ''}
    ${d.type === 'vacuum' ? `<div class="row"><button class="btn" data-act="house-vac">${d.state === 'cleaning' ? 'Send it home' : 'Start cleaning'}</button></div>` : ''}`;
  sheet(`<h2>${icon(devIcon(d))} ${esc(d.name)}</h2><p class="help">${esc(room.name || '')}${d.brand ? ` · ${esc(d.brand)}` : ''}</p>${body}${sampleNote()}`);
}
function roomSheet(id) {
  const r = houseData().rooms.find(x => x.id === id); if (!r) return; const L = houseData().devices.filter(d => d.room === id);
  sheet(`<h2>${esc(r.name)}</h2>${L.length ? `<ul class="hdevl">${L.map(devRowHTML).join('')}</ul>` : '<p class="help">No devices in this room yet.</p>'}${sampleNote()}`);
}
const houseRefresh = () => { render(); const s = document.querySelector('#sheet-root .sheet'); if (s && S._houseSheet) S._houseSheet(); };

Object.assign(A, {
  'house-room'(el) { S._houseSheet = () => roomSheet(el.dataset.id); roomSheet(el.dataset.id); },
  'house-dev'(el) { const d = devById(el.dataset.id); if (!d) return; S._houseSheet = () => devSheet(devById(d.id)); devSheet(d); },
  'house-dev-t'() { const d = houseData().devices.find(x => x.type === 'temp'); if (d) A['house-dev']({dataset: {id: d.id}}); },
  'house-car'() { const d = houseData().devices.find(x => x.type === 'car'); if (d) A['house-dev']({dataset: {id: d.id}}); },
  'house-vac'() { const d = houseData().devices.find(x => x.type === 'vacuum'); if (!d) return; d.state = d.state === 'cleaning' ? 'docked' : 'cleaning'; toast(d.state === 'cleaning' ? 'Vacuum started (sample)' : 'Vacuum going home (sample)'); houseRefresh(); },
  'house-toggle'(el) { const d = devById(el.dataset.id); if (!d || d.lockOn) return; d.on = !d.on; d.watts = d.on ? (d.name === 'TV' ? 84 : d.name === 'Lamp' ? 9 : 5) : 0; houseRefresh(); if (!houseLive()) toast(`${d.name} ${d.on ? 'on' : 'off'} (sample)`); },
  'house-climate'(el) { const d = devById(el.dataset.id); if (!d) return; d.climate = !d.climate; houseRefresh(); toast(d.climate ? 'Warming the car to 21°C (sample)' : 'Climate off (sample)'); },
  'house-solar'() { const s = houseData().solar; sheet(`<h2>${icon('sun')} Solar</h2><div class="hsolar"><div><b class="num">${s.now.toFixed(1)} kW</b><small>making now</small></div><div><b class="num">${s.use.toFixed(1)} kW</b><small>home using</small></div><div><b class="num">${s.today} kWh</b><small>made today</small></div></div>
    <p class="help">${s.now > s.use ? `Making ${(s.now - s.use).toFixed(1)} kW more than the house is using: a good time for the washing machine, dishwasher or charging the car.` : 'Using more than the panels make right now.'}</p><p class="help">${esc(s.brand)} inverter. Its Wi-Fi module shows as offline in the elekeeper app: reconnect it there and the real numbers can show here.</p>${sampleNote()}`); },
  'house-safety'() { const L = houseData().devices.filter(d => d.type === 'smoke' || d.type === 'leak'); sheet(`<h2>${icon('bell')} Safety</h2><ul class="hdevl">${L.map(devRowHTML).join('')}</ul><p class="help">Honey sensors. Honey doesn't offer a way for other apps to read them yet, so these may stay in the Honey app.</p>${sampleNote()}`); },
  'house-connect'() { sheet(`<h2>Connect your home</h2><p class="help">This page is a preview with sample devices shaped like yours. Each part connects separately.</p>
    <ol class="steps hconn">
      <li><b>${icon('car', 'xs')} Tesla</b> (car charge, range, Get ready). Register a free app at developer.tesla.com, then Connect Tesla here. The key file is ready.</li>
      <li><b>${icon('bolt', 'xs')} Plugs, solar, vacuum</b> (Tapo, SAJ, Dreame). These come through Home Assistant: free software on a small always-on computer at home, plus a free secure link so Skylike can reach it.</li>
      <li><b>${icon('wifi', 'xs')} Wi-Fi first</b>. The vacuum and the solar module need your modem's 2.4 GHz Wi-Fi split out (or WPA2). Fixing that gets them online in their own apps too.</li>
      <li><b>${icon('swim', 'xs')} Pool</b>. A smart plug or timer on the pump is the easy start.</li></ol>`); },
});
// rooms and dots in the model work from the keyboard too
document.addEventListener('keydown', e => { const g = e.target.closest && e.target.closest('.hmodel [data-act]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); A[g.dataset.act](g); } });

// phones: start the swipeable model centred on the house
new MutationObserver(() => { const sc = document.querySelector('.hmscroll'); if (sc && !sc._c && sc.scrollWidth > sc.clientWidth) { sc._c = 1; sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * .3; } }).observe(document.documentElement, {childList: true, subtree: true});
