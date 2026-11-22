// Skylike: render. Part 2 of 11; all parts share one global scope and load in order (index.html).
/* ============ rendering ============ */
function clockHTML(d) {
  const p = tzParts(d), h12 = ((p.h + 11) % 12) + 1;
  return `${h12}:${String(p.min).padStart(2, '0')}<span class="ampm">${p.h < 12 ? 'am' : 'pm'}</span>`;
}
const miniFace = m => m && m.photo ? `<span class="mini ph" style="--c:${esc(m.color)}"><img src="${esc(m.photo)}" alt=""></span>` : m && m.emoji ? `<span class="mini" style="--c:${esc(m.color)}">${esc(m.emoji)}</span>` : '<i></i>';
// Drawn pictures for family avatars (same sticker style as the kids' tiles). Keyed by name; FACE_OF maps the emoji people pick.
const FACE = {
  koala: '<circle cx="11" cy="16" r="8" fill="#C9D2D9"/><circle cx="11" cy="16" r="4.2" fill="#F4C6D2" stroke-width="1.8"/><circle cx="37" cy="16" r="8" fill="#C9D2D9"/><circle cx="37" cy="16" r="4.2" fill="#F4C6D2" stroke-width="1.8"/><ellipse cx="24" cy="27" rx="14" ry="13" fill="#C9D2D9"/><circle cx="18" cy="24" r="1.9" fill="#1F3442" stroke="none"/><circle cx="30" cy="24" r="1.9" fill="#1F3442" stroke="none"/><ellipse cx="24" cy="30.5" rx="4.2" ry="5.6" fill="#3A4A57"/>',
  turtle: '<ellipse cx="13" cy="35" rx="4" ry="3" fill="#B5DE9A"/><ellipse cx="33" cy="35" rx="4" ry="3" fill="#B5DE9A"/><circle cx="40.5" cy="26" r="5.5" fill="#B5DE9A"/><circle cx="42" cy="24.6" r="1.3" fill="#1F3442" stroke="none"/><path d="M6 32c0-10 8-17.5 18-17.5S42 22 42 32z" fill="#6DB879"/><path d="M18 17l-3 7 4 8M30 17l3 7-4 8M15 24h18" fill="none" stroke-width="2"/><path d="M5 32h38" stroke-width="2.6"/>',
  kangaroo: '<ellipse cx="16" cy="11" rx="3.8" ry="8.5" transform="rotate(-14 16 11)" fill="#D49A6A"/><ellipse cx="16.2" cy="11.5" rx="1.6" ry="5.4" transform="rotate(-14 16.2 11.5)" fill="#F1C9A5" stroke="none"/><ellipse cx="32" cy="11" rx="3.8" ry="8.5" transform="rotate(14 32 11)" fill="#D49A6A"/><ellipse cx="31.8" cy="11.5" rx="1.6" ry="5.4" transform="rotate(14 31.8 11.5)" fill="#F1C9A5" stroke="none"/><ellipse cx="24" cy="26" rx="11.5" ry="12" fill="#D49A6A"/><ellipse cx="24" cy="33.5" rx="7.5" ry="6" fill="#F1C9A5"/><ellipse cx="24" cy="30.6" rx="2.8" ry="2" fill="#1F3442" stroke="none"/><circle cx="19" cy="23.5" r="1.7" fill="#1F3442" stroke="none"/><circle cx="29" cy="23.5" r="1.7" fill="#1F3442" stroke="none"/>',
  dog: '<circle cx="24" cy="25" r="13.5" fill="#F2D3A8"/><path d="M12 13c-5 1-7 9-5 15 2 3 5 2 6-1l2-11z" fill="#A86E43"/><path d="M36 13c5 1 7 9 5 15-2 3-5 2-6-1l-2-11z" fill="#A86E43"/><ellipse cx="24" cy="31" rx="6.5" ry="5" fill="#FFF3E2"/><ellipse cx="24" cy="28.6" rx="3" ry="2.2" fill="#1F3442" stroke="none"/><circle cx="18.5" cy="22" r="1.9" fill="#1F3442" stroke="none"/><circle cx="29.5" cy="22" r="1.9" fill="#1F3442" stroke="none"/><path d="M22 34c0 3 4 3 4 0" fill="#F48A9C" stroke-width="1.8"/>',
  cat: '<path d="M10 22L9 7l10 7M38 22l1-15-10 7" fill="#F5A25D"/><path d="M12.5 12.5l.4 5M35.5 12.5l-.4 5" stroke-width="1.8"/><ellipse cx="24" cy="27" rx="15" ry="13" fill="#F5A25D"/><circle cx="18" cy="25" r="1.9" fill="#1F3442" stroke="none"/><circle cx="30" cy="25" r="1.9" fill="#1F3442" stroke="none"/><path d="M22.4 29.5h3.2L24 31.5z" fill="#F48A9C" stroke-width="1.6"/><path d="M24 31.5c-.5 2-3 2.6-4 1.2M24 31.5c.5 2 3 2.6 4 1.2M8 29l7 .5M8.5 33.5l6.5-1.5M40 29l-7 .5M39.5 33.5L33 32" fill="none" stroke-width="1.6"/>',
  bunny: '<ellipse cx="18" cy="11" rx="4" ry="9.5" fill="#fff"/><ellipse cx="18" cy="11.5" rx="1.8" ry="6.5" fill="#F4C6D2" stroke="none"/><ellipse cx="30" cy="11" rx="4" ry="9.5" fill="#fff"/><ellipse cx="30" cy="11.5" rx="1.8" ry="6.5" fill="#F4C6D2" stroke="none"/><ellipse cx="24" cy="30" rx="13" ry="11.5" fill="#fff"/><circle cx="19" cy="27.5" r="1.8" fill="#1F3442" stroke="none"/><circle cx="29" cy="27.5" r="1.8" fill="#1F3442" stroke="none"/><ellipse cx="24" cy="31.5" rx="2" ry="1.5" fill="#F48A9C" stroke-width="1.4"/><path d="M22.5 34h3v2.8h-3z" fill="#fff" stroke-width="1.4"/><circle cx="15" cy="32" r="2" fill="#F8D3DC" stroke="none"/><circle cx="33" cy="32" r="2" fill="#F8D3DC" stroke="none"/>',
  fox: '<path d="M9 21L8 6l11 8M39 21l1-15-11 8" fill="#F08A3E"/><path d="M11 11.5l.8 6M37 11.5l-.8 6" stroke-width="1.8"/><path d="M7 21c2-6 9-9 17-9s15 3 17 9c-2 9-8 16-17 19C15 37 9 30 7 21z" fill="#F08A3E"/><path d="M7.5 22c4 0 8 2 12 7 1.5 2 3 3.5 4.5 3.5s3-1.5 4.5-3.5c4-5 8-7 12-7-2 8-8 15-16.5 18C15.5 37 9.5 30 7.5 22z" fill="#fff"/><circle cx="17" cy="22" r="1.8" fill="#1F3442" stroke="none"/><circle cx="31" cy="22" r="1.8" fill="#1F3442" stroke="none"/><ellipse cx="24" cy="36.5" rx="2.4" ry="1.8" fill="#1F3442" stroke="none"/>',
  owl: '<path d="M10 12l4 4M38 12l-4 4" stroke-width="2.4"/><path d="M9 26c0-9 6.5-15 15-15s15 6 15 15c0 9-6.5 15-15 15S9 35 9 26z" fill="#A9784F"/><path d="M15 33c3 3.5 15 3.5 18 0-2 5-6 7.5-9 7.5S17 38 15 33z" fill="#E7C9A2" stroke-width="1.8"/><circle cx="18" cy="23" r="5.5" fill="#fff"/><circle cx="30" cy="23" r="5.5" fill="#fff"/><circle cx="18.5" cy="23.5" r="2.4" fill="#1F3442" stroke="none"/><circle cx="29.5" cy="23.5" r="2.4" fill="#1F3442" stroke="none"/><path d="M22 28h4l-2 3.5z" fill="#F5A25D" stroke-width="1.6"/>',
  penguin: '<ellipse cx="24" cy="26" rx="13" ry="15" fill="#2E3B4E"/><path d="M24 15c-5 0-8 4-8 9v4c0 6 3.5 10.5 8 10.5s8-4.5 8-10.5v-4c0-5-3-9-8-9z" fill="#fff"/><circle cx="20" cy="21" r="1.8" fill="#1F3442" stroke="none"/><circle cx="28" cy="21" r="1.8" fill="#1F3442" stroke="none"/><path d="M21 25h6l-3 3.4z" fill="#F5A25D" stroke-width="1.6"/><ellipse cx="18.5" cy="41" rx="4" ry="1.8" fill="#F5A25D" stroke-width="1.6"/><ellipse cx="29.5" cy="41" rx="4" ry="1.8" fill="#F5A25D" stroke-width="1.6"/>',
  frog: '<circle cx="15" cy="15" r="6" fill="#7CC48B"/><circle cx="33" cy="15" r="6" fill="#7CC48B"/><circle cx="15" cy="15" r="2.6" fill="#1F3442" stroke="none"/><circle cx="33" cy="15" r="2.6" fill="#1F3442" stroke="none"/><path d="M6 28c0-7 7-11 18-11s18 4 18 11c0 7-8 12-18 12S6 35 6 28z" fill="#7CC48B"/><path d="M14 29c4 4 16 4 20 0" fill="none" stroke-width="2.2"/><circle cx="11.5" cy="27" r="2" fill="#F6A9B8" stroke="none"/><circle cx="36.5" cy="27" r="2" fill="#F6A9B8" stroke="none"/>',
  dino: '<path d="M8 40c0-8 5-13 12-14V17c0-5 3-9 8.5-9S37 11 37 15.5c0 3-2 4.5-5 4.5h-3v8c5 1.5 9 5.5 10 12z" fill="#7CC48B"/><path d="M20 22l-3.5-2 3.5-2.2M20 29l-3.5-2.4 3.5-2" fill="#B5DE9A" stroke-width="1.8"/><circle cx="31" cy="13" r="1.7" fill="#1F3442" stroke="none"/><path d="M33 17.5h2.5" stroke-width="1.8"/><path d="M14 40v-4M33 40v-4" stroke-width="2.2"/>',
  hyacinth: '<path d="M24 44V24" stroke-width="2.4"/><path d="M24 40c-6-1-10-6-10-13 5 2 9 6 10 13zM24 38c6-1 9-5 9.5-11-4.5 2-8.5 5-9.5 11z" fill="#7CC48B"/><g fill="#A98BD8" stroke-width="1.8"><circle cx="24" cy="6.5" r="3.2"/><circle cx="20" cy="10.5" r="3.2"/><circle cx="28" cy="10.5" r="3.2"/><circle cx="24" cy="13" r="3.2"/><circle cx="19" cy="16.5" r="3.4"/><circle cx="29" cy="16.5" r="3.4"/><circle cx="24" cy="19.5" r="3.4"/><circle cx="20" cy="23" r="3"/><circle cx="28" cy="23" r="3"/></g>',
  blossom: '<g fill="#F4A6C0"><circle cx="24" cy="11" r="7"/><circle cx="36.4" cy="20" r="7"/><circle cx="31.6" cy="34.6" r="7"/><circle cx="16.4" cy="34.6" r="7"/><circle cx="11.6" cy="20" r="7"/></g><circle cx="24" cy="24" r="6" fill="#FFD45C"/>',
  mic: '<path d="M32.5 20.5L27.5 15.5 10.2 34.2a2.5 2.5 0 0 0 3.6 3.6z" fill="#4F5D75"/><path d="M24.4 28.4l-4.8-4.8" stroke-width="2.2"/><circle cx="30" cy="18" r="10" fill="#D5DEE4"/><path d="M22.5 12.5l13 13M26 10.5l11.5 11.5M20.5 16l11.5 11.5" stroke-width="1.6"/>',
  mask: '<path d="M4 20c4-4 12-5 20-1 8-4 16-3 20 1 1 7-3 13-9 13-5 0-8-3-11-6-3 3-6 6-11 6-6 0-10-6-9-13z" fill="#EF5A5A"/><path d="M11 22c2-2.4 6-2.6 8.5 0-1.6 3-6.2 3-8.5 0zM28.5 22c2.5-2.6 6.5-2.4 8.5 0-2.3 3-6.9 3-8.5 0z" fill="#fff" stroke-width="1.8"/>',
  rocket: '<path d="M24 4c7 5 9.5 13 8 24H16c-1.5-11 1-19 8-24z" fill="#fff"/><circle cx="24" cy="17" r="3.6" fill="#8FB7F0" stroke-width="1.8"/><path d="M16 22l-6 7v6l6-3zM32 22l6 7v6l-6-3z" fill="#EF7A6B"/><path d="M19 32h10l-1.5 4h-7z" fill="#D5DEE4" stroke-width="1.8"/><path d="M21 37c0 3 1.5 5.5 3 7 1.5-1.5 3-4 3-7z" fill="#FFB547" stroke-width="1.8"/>',
  rainbow: '<path d="M4 34a20 20 0 0 1 40 0" fill="none" stroke="#EF7A6B" stroke-width="5"/><path d="M9.5 34a14.5 14.5 0 0 1 29 0" fill="none" stroke="#F7C948" stroke-width="5"/><path d="M15 34a9 9 0 0 1 18 0" fill="none" stroke="#6FB3E0" stroke-width="5"/><path d="M3 38c0-3 2-5 5-5 1-3 6-3 7 0 2.5 0 4 2 4 5z" fill="#fff" stroke-width="2"/><path d="M29 38c0-3 1.5-5 4-5 1-3 6-3 7 0 3 0 5 2 5 5z" fill="#fff" stroke-width="2"/>',
  crown: '<path d="M7 16l8.5 8L24 11l8.5 13L41 16l-3 20H10z" fill="#F7C948"/><rect x="10" y="36" width="28" height="5" rx="1.5" fill="#F2B53A"/><circle cx="7" cy="15" r="2.4" fill="#EF7A6B" stroke-width="1.6"/><circle cx="24" cy="9.5" r="2.4" fill="#8FB7F0" stroke-width="1.6"/><circle cx="41" cy="15" r="2.4" fill="#7CC48B" stroke-width="1.6"/>',
  heart: '<path d="M24 41C11 32.5 6 25.5 6 18.5 6 13 10 9 15 9c4 0 7 2.2 9 5.5C26 11.2 29 9 33 9c5 0 9 4 9 9.5 0 7-5 14-18 22.5z" fill="#EF5A5A"/><path d="M13.5 15.5c1.2-1.5 2.8-2.2 4.5-2" fill="none" stroke="#fff" stroke-width="2.6"/>',
  butterfly: '<path d="M24 16C19 8 8 5 6 11s3 13 12 13c-6 2-9 7-6 11s9 1 12-6" fill="#A98BD8"/><path d="M24 16c5-8 16-11 18-5s-3 13-12 13c6 2 9 7 6 11s-9 1-12-6" fill="#F4A6C0"/><path d="M24 14v22" stroke-width="3"/><path d="M24 14l-3-6M24 14l3-6" fill="none" stroke-width="1.8"/>',
  star: '<path d="M24 5l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L24 33.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8z" fill="#F7BC2A"/>',
};
const FACE_OF = {'🐨': 'koala', '🐢': 'turtle', '🦘': 'kangaroo', '🐶': 'dog', '🐕': 'dog', '🐱': 'cat', '🐈': 'cat', '🐰': 'bunny', '🐇': 'bunny', '🦊': 'fox', '🦉': 'owl', '🐧': 'penguin', '🐸': 'frog', '🦕': 'dino', '🦖': 'dino', '🪻': 'hyacinth', '🌸': 'blossom', '🌷': 'blossom', '🌺': 'blossom', '🌼': 'blossom', '🌻': 'blossom', '🎤': 'mic', '🦸': 'mask', '🦸‍♀': 'mask', '🦸‍♂': 'mask', '🚀': 'rocket', '🌈': 'rainbow', '👑': 'crown', '❤': 'heart', '💖': 'heart', '🦋': 'butterfly', '⭐': 'star', '🌟': 'star'};
const faceArt = (k, cls = 'fa') => `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="#1F3442" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${FACE[k]}</svg></span>`;

const faceKey = seg => FACE_OF[String(seg).replace(/\ufe0f/g, '')] || '';
function avatar(m, size = '') {
  if (!m) return '';
  if (m.photo) return `<span class="face ${size} ph" style="--c:${esc(m.color)}"><img src="${esc(m.photo)}" alt="" draggable="false"></span>`;
  const raw = m.emoji ? String(m.emoji).trim() : (m.name || '?').trim().charAt(0).toUpperCase();
  // a letter plus an emoji (e.g. "V🪻") is fine: keep it on one line and shrink to fit the circle
  const parts = window.Intl && Intl.Segmenter ? [...new Intl.Segmenter().segment(raw)].map(x => x.segment) : [...raw];
  // a picked picture we've drawn: show the drawing (with their letter beside it, if they added one)
  const pic = parts.find(faceKey);
  if (pic) {
    const lets = parts.filter(x => x !== pic && /\p{L}/u.test(x)).join('').slice(0, 2);
    return lets ? `<span class="face ${size} two hasart" style="--c:${esc(m.color)}"><span class="fl">${esc(lets)}</span>${faceArt(faceKey(pic), 'fa sm')}</span>`
      : `<span class="face ${size} hasart" style="--c:${esc(m.color)}">${faceArt(faceKey(pic))}</span>`;
  }
  return `<span class="face ${size} ${parts.length > 1 ? 'two' : ''}" style="--c:${esc(m.color)}">${esc(parts.slice(0, 3).join(''))}</span>`;
}

function skyHTML(compact) {
  const st = settings(), now = new Date(), h = hoursFloat(now), k = dayKey(now);
  let [top, bot] = skyAt(h); const dark = h < 6.2 || h > 19.2;
  if (document.body.classList.contains('night')) { top = mix(top, '#0B1226', .72); bot = mix(bot, '#141D38', .68); }
  const ds = st.dayStart, de = st.dayEnd, span = de - ds;
  const pct = x => Math.max(0, Math.min(100, (x - ds) / span * 100));
  const nowPct = pct(h), sunUp = !dark && h >= ds && h < de;
  const s = Math.sin(Math.PI * Math.max(0, Math.min(1, (h - ds) / span)));
  const arc = compact ? 30 : 74, base = compact ? 22 : 26;
  const evs = eventsOnKey(k), allDay = evs.filter(e => e.all_day);
  let timed = evs.filter(e => !e.all_day);
  const phone = isPhone();
  // place pills by estimated width so they never overlap; compact strips show dots
  const horizonPx = Math.max(300, (isPhone() ? window.innerWidth : window.innerWidth - 92) - 44);
  const rowEnd = [-1, -1]; let extra = 0;
  const pills = timed.map(e => {
    const sh = hoursFloat(new Date(e.starts_at));
    const done = new Date(e.ends_at) < now, live = !done && new Date(e.starts_at) <= now;
    const m = eventMember(e);
    const markHTML = `<span class="mark ${done ? 'done' : ''} ${live ? 'live' : ''}" style="left:${pct(sh)}%;--c:${eventColour(e)}" aria-hidden="true"></span>`;
    if (compact || done) return `<span class="mark ${done ? 'done' : ''} ${live ? 'live' : ''}" style="left:${pct(sh)}%;--c:${eventColour(e)}" title="${esc(fmtTime(new Date(e.starts_at)) + ' ' + e.title)}"></span>`;
    const label = `${fmtTime(new Date(e.starts_at))} ${e.title}`;
    const w = Math.min(26, (Math.min(label.length, 28) * 9.2 + 66) / horizonPx * 100);
    let left = Math.min(pct(sh), 100 - w);
    let row = rowEnd.findIndex(end => left >= end + 0.8);
    if (row < 0) { extra++; return markHTML; }
    rowEnd[row] = left + w;
    const stem = `<span class="stem" style="left:${pct(sh)}%;height:${row ? 54 : 8}px" aria-hidden="true"></span>`;
    return markHTML + stem + `<button class="pill r${row} ${done ? 'done' : ''} ${live ? 'now' : ''}" style="left:${left}%;width:${w}%;--c:${eventColour(e)}" data-act="open-event" data-id="${e.id}"><span class="dot">${m ? esc((m.emoji || m.name.charAt(0)).toUpperCase()) : ''}</span><span>${esc(label)}</span></button>`;
  }).join('');
  const ticks = [];
  for (let t = Math.ceil(ds / 3) * 3; t <= de; t += 3) ticks.push(`<span class="tick" style="left:${pct(t)}%">${t === 12 ? 'noon' : ((t + 11) % 12 + 1) + (t < 12 ? 'am' : 'pm')}</span>`);
  const wx = S.weather && S.weather.current ? S.weather : null;
  const wxHTML = wx ? `<div class="wx"><div><div class="t num">${Math.round(wx.current.temperature_2m)}°</div><div class="r">${isPhone() ? '' : esc(wxWords(wx.current.weather_code)) + ' · '}${Math.round(wx.daily.temperature_2m_max[0])}° / ${Math.round(wx.daily.temperature_2m_min[0])}°${(r => r ? ' · ' + esc(r) : '')(rainNote(wx))}</div></div>${icon(wxIcon(wx.current.weather_code, wx.current.is_day))}</div>` : '';
  return `<section class="sky ${dark ? 'dark' : ''} ${compact ? 'compact' : ''}" style="--sky-top:${top};--sky-bot:${bot}" aria-label="Today">
    <div class="sky-head"><div><div class="clock num" role="timer">${clockHTML(now)}</div>
      <div class="date">${esc(fmtDay(k, phone ? {weekday: 'short', day: 'numeric', month: 'short'} : {weekday: 'long', day: 'numeric', month: 'long'}))}</div>
      ${allDay.length ? `<div class="allday">${allDay.slice(0, 3).map(e => `<span>${esc(e.title)}</span>`).join('')}</div>` : ''}</div>${wxHTML}</div>
    <div class="horizon">
      <div class="line"></div><div class="past" style="width:${nowPct}%"></div>
      <div class="sun ${sunUp ? '' : 'moon'}" style="left:${sunUp ? nowPct : 92}%;bottom:${sunUp ? base + s * arc : base + arc * .6}px" aria-hidden="true"></div>
      ${pills}
      ${compact ? '' : ticks.join('')}
    </div></section>`;
}

function upNextHTML(limit = 4) {
  const now = new Date(), k = dayKey(now);
  let list = eventsOnKey(k).filter(e => !e.all_day && new Date(e.ends_at) > now);
  let label = 'Up next';
  if (!list.length) { list = eventsOnKey(addDaysKey(k, 1)).filter(e => !e.all_day); label = 'Tomorrow'; }
  const rows = list.slice(0, limit).map((e, i) => agendaRow(e, {first: i === 0 && label === 'Up next', until: true, meta: true})).join('');
  const body = rows || (S.calStatus && S.calStatus.connected
    ? `<div class="empty"><b>Nothing else today</b>${label === 'Tomorrow' ? 'Tomorrow is clear too.' : ''}</div>`
    : `<div class="empty"><b>No calendar yet</b>Connect Google Calendar in Settings to see your day here.</div>`);
  return `<div class="zone up-z"><h2><button class="h2link" data-act="go" data-view="calendar" data-mode="day" data-k="${label === 'Tomorrow' ? addDaysKey(k, 1) : k}">${label}${icon('right')}</button><button class="more" data-act="go" data-view="calendar" data-mode="week">Week</button></h2>${body}</div>`;
}
// One shared price book for the household: each item is priced once and kept (refreshed after 30 days), so totals stay steady.
const priceBook = () => kset().prices || {};
const priceOf = it => { const e = priceBook()[normFood(it.text)]; if (e) return e.est; const b = LS.get('gbudget:' + it.list_id, null); const v = b && b.items ? b.items[normFood(it.text)] : null; return v != null ? v : null; };
function itemRow(it, showX = false) {
  const pr = !it.done && showX ? priceOf(it) : null, isTodo = (S.lists.find(l => l.id === it.list_id) || {}).kind !== 'grocery', who = it.assignee && memberById(it.assignee);
  return `<li class="item ${it.done ? 'done' : ''}"><button class="check" data-act="toggle-item" data-id="${it.id}" aria-label="${it.done ? 'Mark not done' : 'Mark done'}: ${esc(it.text)}">${icon('check')}</button><span class="txt">${esc(it.text)}</span>${isTodo && !it.done ? `<button class="who ${who ? 'set' : ''}" data-act="assign" data-id="${it.id}" aria-label="${who ? `For ${esc(who.name)}. Change` : 'Assign to someone'}">${who ? avatar(who) : icon('user')}</button>` : ''}${pr != null ? `<span class="price num">~$${pr < 10 ? pr.toFixed(2) : Math.round(pr)}</span>` : ''}${showX ? `<button class="x" data-act="del-item" data-id="${it.id}" aria-label="Remove ${esc(it.text)}">${icon('x')}</button>` : ''}</li>`;
}
function listsZoneHTML() {
  // One list at a time, To do by default; the choice is remembered on this screen.
  const shown = [listByKind('todo'), listByKind('grocery')].filter(Boolean);
  const l = shown.find(x => x.kind === LS.get('homeList', 'todo')) || shown[0];
  if (!l) return `<div class="zone lists-z"><h2><button class="h2link" data-act="go" data-view="lists">Lists${icon('right')}</button></h2><div class="empty">No lists yet.</div></div>`;
  const items = listItems(l.id, false), cap = 12;
  return `<div class="zone lists-z">${isPhone() ? '' : `<div class="qa-in">${quickAddHTML()}</div>`}<h2><button class="h2link" data-act="go" data-view="lists" data-list="${l.id}">Lists${icon('right')}</button>
      <span class="seg sm">${shown.map(x => `<button class="${x.id === l.id ? 'on' : ''}" data-act="home-list" data-kind="${x.kind}">${esc(x.name)}<span class="n num">${listItems(x.id, false).length}</span></button>`).join('')}</span></h2>
    <div class="items scroll"><ul class="items">${items.slice(0, cap).map(i => itemRow(i)).join('') || `<li class="empty">${l.kind === 'grocery' ? 'All stocked up' : 'Nothing to do'}</li>`}</ul>
    ${items.length > cap ? `<button class="btn ghost" style="margin-top:8px" data-act="go" data-view="lists" data-list="${l.id}">${items.length - cap} more in ${esc(l.name)}</button>` : ''}</div></div>`;
}
function noteHTML(n, i) {
  const a = memberById(n.author_id), rot = [-1.2, .8, -.4, 1.1, -.9, .5][i % 6];
  return `<div class="note n-${esc(n.color)}" style="--rot:${rot}deg">${esc(n.text)}${a ? `<span class="by">${esc(a.name)}</span>` : ''}<button class="x" data-act="del-note" data-id="${n.id}" aria-label="Remove note">${icon('x')}</button></div>`;
}
function notesZoneHTML() {
  return `<div class="zone notes-z"><h2><button class="h2link" data-act="go" data-view="notes">Notes${icon('right')}</button><button class="more" data-act="add-note">Add</button></h2>
    <div class="notes">${S.notes.slice(0, 6).map(noteHTML).join('') || '<div class="empty"><b>No notes</b>Leave one for the family.</div>'}</div></div>`;
}
/* Kitchen card on home: tonight's dinner, defrost reminders, and what's missing for tomorrow. Each line only shows when it has something to say. */
// things worth defrosting (frozen peas or chips go straight in)
const needsThaw = n => aisleOf(n) === 'Meat & seafood' || /stock|pastry|bread|soup|sauce|bolognese|curry|casserole|leftover/.test(normFood(n));
function kitchenHTML() {
  const now = new Date(), k = dayKey(now), hr = hoursFloat(now), tmr = addDaysKey(k, 1), lines = [];
  const tonight = mealOn(k), tomorrow = mealOn(tmr);
  const inFreezer = m => m && !m.cooked ? [...new Set((m.ingredients || []).map(x => S.pantry.find(p => p.place === 'freezer' && !p.leftover && needsThaw(p.name) && sameFood(p.name, x.name))).filter(Boolean).map(p => p.name))] : [];
  const g = listByKind('grocery'), onList = t => g && listItems(g.id, false).some(i => sameFood(i.text, t));
  const missing = m => m && !m.cooked && !m.leftovers_of ? (m.ingredients || []).filter(x => !haveIt(x.name) && !onList(x.name)).map(x => x.name) : [];
  // defrost: this morning for tonight, from 3pm for tomorrow
  const dz = hr < 11 ? inFreezer(tonight) : hr >= 15 ? inFreezer(tomorrow) : [];
  if (dz.length) lines.push(`<div class="kline"><span class="ki">${icon('snow')}</span><span><b>${hr < 11 ? 'Defrost now' : 'Defrost tonight'}:</b> ${esc(dz.join(', '))} <small>for ${hr < 11 ? "tonight's" : "tomorrow's"} ${esc((hr < 11 ? tonight : tomorrow).title)}</small></span></div>`);
  // missing: tonight's until 4pm, then tomorrow's
  const mk = hr < 16 ? k : tmr, mm = mealOn(mk), miss = missing(mm);
  if (miss.length) lines.push(`<div class="kline"><span class="ki">${icon('cart')}</span><span><b>Missing for ${mk === k ? 'tonight' : 'tomorrow'}:</b> ${esc(miss.slice(0, 4).join(', '))}${miss.length > 4 ? ` +${miss.length - 4}` : ''}</span><button class="btn soft sm" data-act="kitchen-missing" data-k="${mk}">Add to list</button></div>`);
  if (!tonight && !lines.length) return '';
  const head = tonight ? `<button class="ktonight" data-act="meal-open" data-k="${k}"><span class="ke">${esc(tonight.emoji || '🍽️')}</span><span><span class="kl">${hr >= 20 ? 'Tonight was' : 'Tonight'}</span><span class="kt2">${esc(tonight.leftovers_of ? 'Leftovers: ' + tonight.leftovers_of : tonight.title)}</span>${tonight.prep_time ? `<span class="km">${esc(tonight.prep_time)}${tonight.cooked ? ' · cooked' : ''}</span>` : ''}</span></button>`
    : `<button class="ktonight empty" data-act="go" data-view="meals"><span class="ke">🍽️</span><span><span class="kl">Tonight</span><span class="kt2">No dinner planned</span></span></button>`;
  return `<div class="kitchen">${head}${lines.length ? `<div class="klines">${lines.join('')}</div>` : ''}</div>`;
}
function chipsHTML() {
  const now = new Date(), c = chipsFor(dayKey(now), now);
  if (!c.length) return '';
  c.sort((a, b) => (b.first ? 1 : 0) - (a.first ? 1 : 0));
  return `<div class="chips">${c.slice(0, 5).map(x => `<${x.act ? `button data-act="${x.act}" data-k="${x.k}"` : 'span'} class="chip">${x.bins ? `<span class="bins">${x.bins.map(col => `<span class="b" style="--c:${col}">${icon('bin')}</span>`).join('')}</span>` : `<span class="b" style="--c:${x.c}">${icon(x.icon)}</span>`}${esc(x.text)} <em>${esc(x.sub)}</em></${x.act ? 'button' : 'span'}>`).join('')}</div>`;
}

