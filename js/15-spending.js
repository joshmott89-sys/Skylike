/* ---- grocery spending review (Meals → Spending) ----
   One month at a time: the total against budget, week by week, where it went (from receipt items),
   which shops, the biggest items and prices that moved. Colours: the validated categorical palette,
   light and dark steps; every part also carries its name and amount, so colour is never the only cue. */
const SPEND_CATS = [
  ['meat', 'Meat & seafood', /\b(chicken|beef|mince|pork|lamb|sausage|snag|bacon|ham|steak|fish|salmon|tuna|prawn|turkey|thigh|breast|fillet|schnitzel|meatball|salami|chorizo|kangaroo)/i],
  ['veg', 'Fruit & veg', /\b(apple|banana|orange|mandarin|grape|berr(y|ies)|strawberr|blueberr|melon|mango|pear|kiwi|avocado|tomato|potato|onion|garlic|carrot|broccoli|cauli|lettuce|spinach|cucumber|capsicum|zucchini|pumpkin|corn|mushroom|celery|herb|lemon|lime|salad|veg|fruit|kale|bean sprout)/i],
  ['dairy', 'Dairy & eggs', /\b(milk|cheese|yoghurt|yogurt|butter|cream|eggs?|custard|feta|parmesan|mozzarella)/i],
  ['bakery', 'Bread & bakery', /\b(bread|roll|wrap|bagel|muffin|croissant|loaf|bun|tortilla|pita|crumpet|scone)/i],
  ['frozen', 'Frozen', /\b(frozen|ice cream|icecream|peas|chips|nuggets|ice block|gelato)/i],
  ['drinks', 'Drinks', /\b(juice|water|soft drink|cola|coke|coffee|tea|cordial|kombucha|beer|wine|soda|sparkling)/i],
  ['pantry', 'Pantry & snacks', /\b(pasta|rice|flour|sugar|oil|sauce|stock|cereal|oats|biscuit|cracker|chips|chocolate|snack|bar|tin|can|beans|lentil|noodle|spice|salt|pepper|honey|jam|spread|vegemite|peanut|nut|muesli|popcorn|lolly|lollies)/i],
  ['home', 'Home, baby & personal', /\b(nappies|nappy|wipes|toilet|tissue|paper towel|detergent|dishwash|laundry|soap|shampoo|conditioner|toothpaste|toothbrush|deodorant|sunscreen|bin bag|foil|cling|cleaner|spray|sponge|razor|pads|tampons|formula|medicine|panadol|nurofen|bandaid)/i],
];
const SPEND_COL = {light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'], dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c']};
// Snack words win first, so "milk chocolate" isn't dairy and "chicken crackers" isn't meat.
const SNACKS = /\b(chocolate|biscuits?|crackers?|chips|crisps|pretzels?|lavosh|shapes|grain ?waves|popcorn|lolly|lollies|muesli bars?|tim ?tams?|maltesers|rice cakes?)/i;
const spendCat = name => SNACKS.test(name || '') ? 'pantry' : (SPEND_CATS.find(([, , re]) => re.test(name || '')) || ['other', 'Other'])[0];
const catLabel = k => (SPEND_CATS.find(c => c[0] === k) || [k, k === 'none' ? 'Not itemised' : 'Other'])[1];
const monthKey = (off = 0) => { const p = tzParts(new Date()); let y = p.y, m = p.m - 1 + off; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return `${y}-${String(m + 1).padStart(2, '0')}`; };
const monthName = mk => fmtDay(mk + '-01', {month: 'long', year: 'numeric'});
const inMonth = (r, mk) => String(r.day || '').slice(0, 7) === mk;
const cents = n => '$' + (+n || 0).toLocaleString('en-AU', {minimumFractionDigits: 2, maximumFractionDigits: 2});

function spendMonthData(mk) {
  const rows = (S.spend || []).filter(r => inMonth(r, mk)), total = rows.reduce((a, r) => a + (+r.total || 0), 0);
  const cats = {}, shops = {}, items = {};
  rows.forEach(r => {
    const shop = (r.store || 'Other shops').trim(); shops[shop] = (shops[shop] || 0) + (+r.total || 0);
    const its = (r.items || []).filter(i => +i.price > 0), itemSum = its.reduce((a, i) => a + +i.price, 0);
    if (!its.length) { cats.none = (cats.none || 0) + (+r.total || 0); return; }
    // Items close to the total (within 15%): scale them up so discounts and bags don't leave a gap.
    // Items well short of it (only part of the receipt read): the rest counts as "Not itemised", never guessed.
    const tot = +r.total || itemSum, close = itemSum >= tot * .85, k = close && itemSum > 0 ? tot / itemSum : 1;
    if (!close) cats.none = (cats.none || 0) + (tot - itemSum);
    its.forEach(i => { const c = spendCat(i.name); cats[c] = (cats[c] || 0) + i.price * k; const n = normFood(i.name); if (!items[n]) items[n] = {name: i.name, sum: 0, n: 0, q: 0, unit: 0}; const q = parseFloat(i.qty) || 1; items[n].sum += +i.price; items[n].n++; items[n].q += q; items[n].unit = +i.unit || Math.round(+i.price / q * 100) / 100; });
  });
  return {rows, total, cats, shops, items};
}
// prices that moved: the same thing on two receipts, oldest vs newest price (last 120 days)
function priceMoves() {
  const seen = {};
  spendRows().slice().reverse().filter(r => r.source === 'receipt').forEach(r => (r.items || []).forEach(i => { if (!(+i.price > 0)) return; const n = normFood(i.name); (seen[n] = seen[n] || {name: i.name, list: []}).list.push({p: +i.unit || Math.round(+i.price / (parseFloat(i.qty) || 1) * 100) / 100, day: r.day}); }));
  return Object.values(seen).filter(x => x.list.length > 1).map(x => { const a = x.list[0], b = x.list[x.list.length - 1]; return {name: x.name, from: a.p, to: b.p, pct: (b.p - a.p) / a.p * 100, day: b.day}; })
    .filter(x => Math.abs(x.pct) >= 3).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 6);
}

V.spend = () => {
  const off = S.spendOff || 0, mk = monthKey(off), D = spendMonthData(mk), P = spendMonthData(monthKey(off - 1));
  const dark = document.body.classList.contains('night'), COL = SPEND_COL[dark ? 'dark' : 'light'];
  const days = new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate(), budget = (+kset().shopBudget || 0) * days / 7;
  const today = dayKey(new Date()), cur = off === 0, elapsed = cur ? +today.slice(8, 10) : days;
  const pace = cur && elapsed > 3 && D.total ? D.total / elapsed * days : null;
  const diff = P.total ? (D.total - P.total) / P.total * 100 : null;
  const nav = `<div class="spnav"><button class="iconbtn" data-act="spend-month" data-d="-1" aria-label="Previous month">${icon('left')}</button><b>${esc(monthName(mk))}</b><button class="iconbtn" data-act="spend-month" data-d="1" aria-label="Next month" ${off >= 0 ? 'disabled' : ''}>${icon('right')}</button></div>`;
  const head = `<h1><button class="iconbtn" data-act="go" data-view="meals" aria-label="Back to Meals">${icon('left')}</button>Grocery spending<span class="sp"></span>${nav}</h1>`;
  if (!D.rows.length) return `<div class="page spendp">${head}<div class="panel"><div class="empty">${emptyArt('plate')}<b>No shops recorded in ${esc(monthName(mk))}</b>Add a receipt or type a total on the Meals page and it shows up here.</div>
    <div class="row" style="justify-content:center"><label class="btn">${icon('camera')}Photo of receipt<input type="file" accept="image/*" capture="environment" data-change="spend-photo" hidden></label><button class="btn soft" data-act="spend-type">${icon('plus')}Type a total</button></div></div></div>`;

  // headline
  const hero = `<div class="panel sphero"><div class="spbig num">${money(D.total)}</div>
    <div class="spsub">${D.rows.length} shop${D.rows.length === 1 ? '' : 's'} in ${esc(monthName(mk).split(' ')[0])}${diff != null ? ` · <span class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(Math.round(diff))}%</span> on ${esc(monthName(monthKey(off - 1)).split(' ')[0])} (${money(P.total)})` : ''}</div>
    ${budget ? `<div class="spmeter" role="img" aria-label="${money(D.total)} of a ${money(budget)} budget"><span class="${D.total > budget ? 'over' : D.total > budget * .85 ? 'near' : ''}" style="width:${Math.min(100, D.total / budget * 100).toFixed(1)}%"></span>${cur ? `<i style="left:${(elapsed / days * 100).toFixed(1)}%" title="Today"></i>` : ''}</div>
      <div class="spsub">${D.total > budget ? `<b class="overt">${money(D.total - budget)} over</b>` : `<b>${money(budget - D.total)} left</b>`} of ${money(budget)} for the month${pace ? ` · on track for about <b>${money(pace)}</b>` : ''}</div>` : `<p class="help">Set a weekly grocery budget in Settings → Kitchen to see how the month is tracking.</p>`}</div>`;

  // week by week (Monday weeks that touch this month)
  const first = mk + '-01', last = `${mk}-${String(days).padStart(2, '0')}`;
  let w0 = addDaysKey(first, -((weekdayOfKey(first) + 6) % 7)); const weeks = [];
  for (; w0 <= last; w0 = addDaysKey(w0, 7)) { const w1 = addDaysKey(w0, 6), a = w0 < first ? first : w0, b = w1 > last ? last : w1;
    weeks.push({a, b, t: D.rows.filter(r => r.day >= a && r.day <= b).reduce((s, r) => s + (+r.total || 0), 0), future: cur && a > today}); }
  const wb = +kset().shopBudget || 0, top = Math.max(wb, ...weeks.map(w => w.t)) || 1;
  const wk = `<div class="panel"><h2>Week by week</h2><div class="spweeks" style="--n:${weeks.length}">${weeks.map(w => `<button class="spw ${w.future ? 'fut' : ''} ${wb && w.t > wb ? 'over' : ''}" data-act="spend-week" data-a="${w.a}" data-b="${w.b}" aria-label="${esc(fmtDay(w.a, {day: 'numeric', month: 'short'}))} to ${esc(fmtDay(w.b, {day: 'numeric', month: 'short'}))}: ${money(w.t)}">
      <span class="v num">${w.t ? money(w.t) : ''}</span><span class="track"><span class="b" style="height:${(w.t / top * 100).toFixed(1)}%"></span>${wb ? `<i class="bl" style="bottom:${(wb / top * 100).toFixed(1)}%"></i>` : ''}</span><span class="l">${esc(fmtDay(w.a, {day: 'numeric', month: 'short'}))}</span></button>`).join('')}</div>
    ${wb ? `<p class="help"><i class="blkey"></i> weekly budget ${money(wb)}. Tap a week to see its shops.</p>` : '<p class="help">Tap a week to see its shops.</p>'}</div>`;

  // where it went: tall segmented bar (top 5 + Other, plus not itemised) + ranked bars with every category
  const all = Object.entries(D.cats).filter(([, v]) => v > .5).sort((a, b) => (a[0] === 'none') - (b[0] === 'none') || b[1] - a[1]);
  const itemised = all.filter(([k]) => k !== 'none'), none = D.cats.none || 0;
  const segs = itemised.slice(0, 5).map(([k, v], i) => ({k, v, c: COL[i]})); const rest = itemised.slice(5).reduce((a, [, v]) => a + v, 0);
  if (rest > .5) segs.push({k: 'other+', v: rest, c: dark ? '#6E8199' : '#8A97A3', name: 'Everything else'}); if (none > .5) segs.push({k: 'none', v: none, c: 'none'});
  const segName = s => s.name || catLabel(s.k), pct = v => Math.round(v / D.total * 100);
  const split = `<div class="panel"><h2>Where it went</h2>
    ${itemised.length ? `<div class="spseg" role="img" aria-label="${esc(segs.map(s => `${segName(s)} ${pct(s.v)}%`).join(', '))}">${segs.map(s => `<span class="sg ${s.k === 'none' ? 'none' : ''}" style="flex:${s.v.toFixed(2)};${s.c !== 'none' ? `background:${s.c}` : ''}" title="${esc(segName(s))}: ${money(s.v)}">${pct(s.v) >= 9 ? `<b>${pct(s.v)}%</b>` : ''}</span>`).join('')}</div>
      <ul class="splegend">${segs.map(s => `<li><i class="${s.k === 'none' ? 'none' : ''}" style="${s.c !== 'none' ? `background:${s.c}` : ''}"></i>${esc(segName(s))}</li>`).join('')}</ul>
      <ul class="sprank">${all.map(([k, v]) => `<li><span class="n">${esc(catLabel(k))}</span><span class="bar"><span style="width:${(v / all[0][1] * 100).toFixed(1)}%" class="${k === 'none' ? 'none' : ''}"></span></span><span class="a num">${money(v)}</span><span class="p num">${pct(v)}%</span></li>`).join('')}</ul>
      ${none > .5 ? `<p class="help">“Not itemised” is money with no item lines yet: a shop typed as a total, or a receipt only partly read. Open the shop and tap Add the next part to fill it in.</p>` : ''}`
      : `<p class="help">The split by type comes from receipt photos. These shops were typed in as totals, so there's nothing to break down yet.</p>`}</div>`;

  // shops
  const shopL = Object.entries(D.shops).sort((a, b) => b[1] - a[1]);
  const shopsP = `<div class="panel"><h2>By shop</h2><ul class="sprank">${shopL.map(([n, v]) => `<li><span class="n">${esc(n)}</span><span class="bar"><span style="width:${(v / shopL[0][1] * 100).toFixed(1)}%"></span></span><span class="a num">${money(v)}</span><span class="p num">${D.rows.filter(r => (r.store || 'Other shops').trim() === n).length}×</span></li>`).join('')}</ul></div>`;

  // biggest items + prices that moved
  const big = Object.values(D.items).sort((a, b) => b.sum - a.sum).slice(0, 8), moves = priceMoves();
  const itemsP = big.length ? `<div class="panel"><h2>Biggest items</h2><p class="help">What each line cost in total this month.</p><ul class="spitems">${big.map(i => `<li><span>${esc(i.name)}${i.q > 1 ? `<small class="spq num">${i.q} × ${cents(i.unit)}</small>` : ''}</span><b class="num">${cents(i.sum)}</b></li>`).join('')}</ul></div>` : '';
  const movesP = moves.length ? `<div class="panel"><h2>Prices that moved</h2><ul class="spitems">${moves.map(m => `<li><span>${esc(m.name)} <small>${cents(m.from)} → ${cents(m.to)}</small></span><b class="num ${m.pct > 0 ? 'up' : 'down'}">${m.pct > 0 ? '▲' : '▼'} ${Math.abs(Math.round(m.pct))}%</b></li>`).join('')}</ul></div>` : '';

  return `<div class="page spendp">${head}${hero}<div class="spgrid">${wk}${split}${shopsP}${itemsP}${movesP}</div></div>`;
};

Object.assign(A, {
  'spend-review'() { S.spendOff = 0; S.view = 'spend'; render(); },
  'spend-month'(el) { S.spendOff = Math.min(0, (S.spendOff || 0) + +el.dataset.d); render(); },
  'spend-week'(el) { const a = el.dataset.a, b = el.dataset.b, L = spendRows().filter(r => r.day >= a && r.day <= b);
    sheet(`<h2>${esc(fmtDay(a, {day: 'numeric', month: 'short'}))} – ${esc(fmtDay(b, {day: 'numeric', month: 'short'}))}</h2>${L.length ? `<ul class="slist">${L.map(r => `<li><button data-act="spend-open" data-id="${r.id}"><span class="grow"><b>${esc(r.store || 'Shop')}</b><small>${esc(fmtDay(r.day, {weekday: 'short', day: 'numeric', month: 'short'}))}</small></span><b class="num">${money(r.total)}</b></button></li>`).join('')}</ul>` : '<p class="help">No shops that week.</p>'}`); },
});
