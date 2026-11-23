/* ---- grocery spend ----
   A photo of the receipt (or a typed total) records what each shop really cost. The weekly total sits
   against the grocery budget, and the prices paid teach the meal planner what things cost here. */
const money = n => '$' + (Math.round(+n || 0)).toLocaleString('en-AU');
const spendRows = () => (S.spend || []).slice().sort((a, b) => b.day.localeCompare(a.day) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
const spendWeek = off => { const a = weekStart(off), b = addDaysKey(a, 7); return (S.spend || []).filter(r => r.day >= a && r.day < b).reduce((t, r) => t + (+r.total || 0), 0); };

// The camera opens straight from the button (a real file input inside the label, so phones always allow it).
function receiptButtonsHTML() {
  const ok = S.aiOn || DEMO, pick = (cap, cls, label, ic) => ok ? `<label class="${cls}">${icon(ic)}${label}<input type="file" accept="image/*" ${cap ? 'capture="environment"' : 'multiple'} data-change="spend-photo" hidden></label>` : `<button class="${cls}" data-act="spend-receipt">${icon(ic)}${label}</button>`;
  return `<div class="rcptbtns">${pick(true, 'btn', 'Photo of receipt', 'camera')}${pick(false, 'btn soft', 'From gallery', 'photo')}<button class="linkbtn rtype" data-act="spend-type">or type the total</button></div>`;
}
// Latest price paid for each thing, newest receipt first (used by the planner)
function paidBook() {
  const seen = new Map();
  spendRows().filter(r => r.source === 'receipt').forEach(r => (r.items || []).forEach(i => {
    const n = normFood(i.name || ''); if (!n || !(+i.price > 0) || seen.has(n)) return;
    seen.set(n, {name: String(i.name).slice(0, 40), price: +i.price, qty: i.qty || '', day: r.day});
  }));
  return [...seen.values()];
}
function priceNotes() {
  const P = paidBook().slice(0, 60); if (P.length < 5) return '';
  return `Prices we actually paid recently (use these when estimating costs): ${P.map(p => `${p.name}${p.qty ? ' ' + p.qty : ''} $${p.price.toFixed(2)}`).join('; ')}.`;
}

function spendHTML() {
  const B = +kset().shopBudget || 0, now = spendWeek(0), calm = isCalm();
  const weeks = [-5, -4, -3, -2, -1, 0].map(o => ({o, t: spendWeek(o), k: weekStart(o)})), top = Math.max(B, ...weeks.map(w => w.t)) || 1;
  const past = weeks.slice(1, 5).map(w => w.t).filter(t => t > 0), avg = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0;
  const pct = B ? Math.min(100, now / B * 100) : 0, over = B && now > B, rows = spendRows().slice(0, 3), prices = paidBook().length;
  const tools = receiptButtonsHTML();
  if (!(S.spend || []).length) return `<div class="panel spend-p"><h2>${icon('cart')} Grocery spend</h2><p class="help">After a shop, take a photo of the receipt. Skylike adds up the week against your budget, and the prices you paid make the meal plan's cost estimates match your shops.</p>${tools}</div>`;
  return `<div class="panel spend-p"><h2>${icon('cart')} Grocery spend</h2>
    <div class="snow"><b class="num">${money(now)}</b><span>this week${B ? ` of <span class="num">${money(B)}</span>` : ''}</span>${B ? `<span class="grow"></span><span class="sleft ${over ? 'over' : ''}">${over ? `${money(now - B)} over` : `${money(B - now)} left`}</span>` : ''}</div>
    ${B ? `<div class="sbar ${over ? 'over' : now > B * .85 ? 'near' : ''}" role="img" aria-label="${money(now)} of ${money(B)}"><span style="width:${pct.toFixed(0)}%"></span></div>` : ''}
    ${calm ? '' : `<div class="sweeks" aria-label="Last six weeks">${weeks.map(w => `<div class="swk ${w.o === 0 ? 'now' : ''} ${B && w.t > B ? 'over' : ''}"><span class="v num">${w.t ? money(w.t) : ''}</span><span class="b" style="height:${Math.max(w.t ? 4 : 0, w.t / top * 100).toFixed(0)}%"></span><span class="l">${w.o === 0 ? 'Now' : esc(fmtDay(w.k, {day: 'numeric', month: 'short'}))}</span></div>`).join('')}</div>`}
    <p class="help">${avg ? `Average <b class="num">${money(avg)}</b> a week over the last ${past.length === 1 ? 'week' : past.length + ' weeks'}. ` : ''}${prices >= 5 ? `${prices} prices remembered for meal planning.` : 'A few receipts teach the meal planner what you pay.'}</p>
    ${tools}<ul class="slist">${rows.map(r => `<li><button data-act="spend-open" data-id="${r.id}"><span class="grow"><b>${esc(r.store || 'Shop')}</b><small>${esc(fmtDay(r.day, {weekday: 'short', day: 'numeric', month: 'short'}))}${(r.items || []).length ? ` · ${r.items.length} items` : ''}</small></span><b class="num">${money(r.total)}</b></button></li>`).join('')}</ul>
    <div class="row" style="margin-top:10px"><button class="btn soft" data-act="spend-review">${icon('chart')}See spending</button>${(S.spend || []).length > 3 ? `<button class="linkbtn" data-act="spend-all">All shops</button>` : ''}</div></div>`;
}

// Long receipts come in parts: merge another photo's lines into what we already have.
const rKey = i => String(i.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + (+i.price || 0).toFixed(2);
function mergeReceipt(a, b) {
  const have = new Set((a.items || []).map(rKey)), extra = (b.items || []).filter(i => !have.has(rKey(i)));
  return Object.assign({}, a, {store: a.store || b.store, day: a.day || b.day, total: Math.max(+a.total || 0, +b.total || 0) || null, items: [...(a.items || []), ...extra], _added: extra.length});
}
const itemSum = items => Math.round((items || []).reduce((s, i) => s + (+i.price || 0), 0) * 100) / 100;
function coverageHTML(d, act) {
  const sum = itemSum(d.items), t = +d.total || 0, gap = t - sum;
  const more = `<label class="btn soft sm">${icon('camera')}Add the next part<input type="file" accept="image/*" capture="environment" data-change="${act}" hidden></label><label class="linkbtn">from gallery<input type="file" accept="image/*" multiple data-change="${act}" hidden></label>`;
  if (t && gap > Math.max(5, t * .1)) return `<div class="rgap"><div class="grow"><b>Items add to ${money(sum)} of ${money(t)}</b><small>About ${money(gap)} isn't broken down yet. Long receipt? Photograph the rest and it joins this one.</small></div><div class="rgapbtns">${more}</div></div>`;
  return `<div class="rmore">${more}<small>Long receipt? Add another photo and it joins this one.</small></div>`;
}
function spendSheet(r) {
  const items = r.items || [];
  sheet(`<h2>${esc(r.store || 'Shop')} <span class="num" style="margin-left:auto">${money(r.total)}</span></h2><p class="help">${esc(fmtDay(r.day, {weekday: 'long', day: 'numeric', month: 'long'}))}${r.source === 'receipt' ? ' · from a receipt' : ''}</p>
    ${items.length ? `<ul class="rcpt">${items.map(i => `<li><span>${esc(i.name)}${i.qty ? ` <small>${esc(i.qty)}</small>` : ''}</span><b class="num">$${(+i.price || 0).toFixed(2)}</b></li>`).join('')}</ul>` : ''}
    ${r.source === 'receipt' || items.length ? coverageHTML(r, 'spend-more-saved') : ''}
    <div class="row" style="margin-top:14px"><span class="grow"></span><button class="btn ghost" data-act="spend-del" data-id="${r.id}">${icon('trash')}Remove</button></div>`);
  S._spendOpen = r.id;
}
function spendDraftSheet(d) {
  S._spendDraft = d;
  const items = d.items || [], sum = items.reduce((a, i) => a + (+i.price || 0), 0), food = items.filter(i => i.place).length;
  sheet(`<h2>Check the receipt</h2><form data-form="spend-save">
    <div class="row"><label class="lbl grow">Shop <input class="input" name="store" value="${esc(d.store || '')}" maxlength="60" placeholder="e.g. Woolworths"></label><label class="lbl">Date <input class="input" type="date" name="day" value="${esc(d.day || dayKey(new Date()))}"></label></div>
    <label class="lbl">Total $ <input class="input num" name="total" type="number" step="0.01" min="0" max="99999" required value="${d.total != null ? (+d.total).toFixed(2) : ''}" style="width:140px"></label>
    ${items.length ? `<p class="help">${items.length} items read${Math.abs(sum - (+d.total || 0)) > 1 && d.total ? ` (they add to $${sum.toFixed(2)}; discounts and bags make up the difference)` : ''}.</p><details><summary>See the items</summary><ul class="rcpt">${items.map(i => `<li><span>${esc(i.name)}${i.qty ? ` <small>${esc(i.qty)}</small>` : ''}</span><b class="num">$${(+i.price || 0).toFixed(2)}</b></li>`).join('')}</ul></details>
      ${coverageHTML(d, 'spend-more')}
      ${food ? `<label class="tickrow"><input type="checkbox" name="stock" checked> Update what's in (${food} food item${food === 1 ? '' : 's'}) and tick them off groceries</label>` : ''}` : ''}
    <div class="row" style="margin-top:14px"><span class="grow"></span><button class="btn">Save shop</button></div></form>`);
}

Object.assign(A, {
  'spend-receipt'() {
    if (!S.aiOn && !DEMO) return toast('Reading receipts needs the free Gemini key (Settings → Kitchen). You can type the total instead.', 6000);
    let inp = document.getElementById('spend-file');
    if (!inp) { inp = Object.assign(document.createElement('input'), {type: 'file', accept: 'image/*', id: 'spend-file', hidden: true, multiple: true}); inp.dataset.change = 'spend-photo'; document.body.appendChild(inp); }
    inp.value = ''; inp.click();
  },
  'spend-type'() { spendDraftSheet({day: dayKey(new Date())}); },
  'spend-open'(el) { const r = (S.spend || []).find(x => x.id === el.dataset.id); if (r) spendSheet(r); },
  'spend-all'() { sheet(`<h2>Grocery shops</h2><ul class="slist">${spendRows().map(r => `<li><button data-act="spend-open" data-id="${r.id}"><span class="grow"><b>${esc(r.store || 'Shop')}</b><small>${esc(fmtDay(r.day, {weekday: 'short', day: 'numeric', month: 'short'}))}</small></span><b class="num">${money(r.total)}</b></button></li>`).join('')}</ul>`); },
  async 'spend-del'(el) {
    if (!confirmTap('spend-del:' + el.dataset.id, 'Tap Remove again to delete this shop')) return;
    S.spend = (S.spend || []).filter(r => r.id !== el.dataset.id); closeSheet(); render(); toast('Removed');
    if (!DEMO) await db(sb.from('grocery_spend').delete().eq('id', el.dataset.id));
  },
});
Object.assign(F, {
  async 'item-save'(f) { const it = S.items.find(i => i.id === f.dataset.id); if (!it) return closeSheet(); const text = f.text.value.trim().slice(0, 200); if (!text) return;
    const who = f.who ? (f.who.value || null) : it.assignee, gave = who && who !== it.assignee; it.text = text; it.assignee = who; closeSheet(); render();
    if (!DEMO) { await db(sb.from('list_items').update({text, assignee: who}).eq('id', it.id)); }
    toast(gave ? `Given to ${memberById(who).name}` : 'Saved'); },
  // fridge check: ticked "gone" items are marked out; everything ticked goes on the grocery list
  async 'scan-apply'(f) {
    const R = S._scanRes || {}, gone = [...f.querySelectorAll('input[name="gone"]:checked')].map(i => i.value), buy = [...f.querySelectorAll('input[name="buy"]:checked')].map(i => i.value);
    const outRows = S.pantry.filter(p => (R.gone || []).includes(p.id) && gone.some(g => g === p.name));
    outRows.forEach(p => { p.out = true; p.low = true; });
    if (outRows.length && !DEMO) db(sb.from('pantry').update({out: true, low: true}).in('id', outRows.map(p => p.id)));
    const n = (gone.length || buy.length) ? await groceryAdd([...gone, ...buy]) : 0;
    S._scanRes = null; closeSheet(); render();
    toast(n ? `Added ${n} to Groceries${outRows.length ? ` · ${outRows.length} marked out` : ''}` : outRows.length ? `${outRows.length} marked out` : 'All up to date', 4000);
  },
  async 'spend-save'(f) {
    const d = S._spendDraft || {}, total = Math.round((+f.total.value || 0) * 100) / 100; if (!(total > 0)) return toast('Add the total');
    const row = {id: uid(), household_id: S.hid, day: f.day.value || dayKey(new Date()), store: f.store.value.trim().slice(0, 60) || null, total, source: (d.items || []).length ? 'receipt' : 'typed',
      items: (d.items || []).slice(0, 160).map(i => ({name: String(i.name).slice(0, 60), price: Math.round((+i.price || 0) * 100) / 100, qty: String(i.qty || '').slice(0, 20)})), created_at: new Date().toISOString()};
    S.spend = [row, ...(S.spend || [])]; S._spendDraft = null; closeSheet(); render();
    let msg = `${money(total)} saved`;
    if (f.stock && f.stock.checked) {
      const food = (d.items || []).filter(i => i.place);
      const n = await pantryAdd(food.map(i => ({name: i.name, place: i.place})));
      // tick bought things off the grocery list
      const gl = listByKind('grocery'), ticked = gl ? listItems(gl.id, false).filter(it => food.some(i => sameFood(i.name, it.text))) : [];
      ticked.forEach(it => { it.done = true; }); if (ticked.length && !DEMO) db(sb.from('list_items').update({done: true}).in('id', ticked.map(it => it.id)));
      msg += `${n ? ` · ${n} added to what's in` : ''}${ticked.length ? ` · ${ticked.length} ticked off groceries` : ''}`; render();
    }
    toast(msg, 4000);
    if (!DEMO) { const {error} = await sb.from('grocery_spend').insert(row); if (error) toast("Couldn't save the shop. Try again.", 5000); }
  },
});
// Keep the photos until they're read, so a busy AI only costs a "Try again" tap, not another photo.
function receiptFailed(msg, imgs, mode) {
  S._rcptRetry = {imgs, mode};
  sheet(`<h2>Couldn't read the receipt yet</h2><p class="help">${esc(msg)}</p><p class="help">Your photo is kept, so you don't need to take it again.</p>
    <div class="row" style="margin-top:12px"><button class="btn" data-act="rcpt-retry">${icon('refresh')}Try again</button><span class="grow"></span><button class="btn ghost" data-act="spend-type">Type the total instead</button></div>`, {focus: false});
}
async function sendReceipt(imgs, mode) {
  const ticks = setInterval(() => toast('Still reading… long receipts can take up to a minute', 20000), 15000);
  try { return await callRecipe({receipt: imgs}); } finally { clearInterval(ticks); }
}
A['rcpt-retry'] = async () => {
  const R = S._rcptRetry; if (!R) return closeSheet(); closeSheet(); toast('Reading the receipt…', 20000);
  const r = await sendReceipt(R.imgs, R.mode); if (r.error) return receiptFailed(r.error, R.imgs, R.mode);
  S._rcptRetry = null; return applyReceipt(r, R.mode);
};
function applyReceipt(r, mode) {
  if (mode === 'new') { toast('Got it', 1200); return spendDraftSheet(r.receipt); }
  const saved = mode === 'saved', base = saved ? (S.spend || []).find(x => x.id === S._spendOpen) : S._spendDraft; if (!base) return;
  const m = mergeReceipt(base, r.receipt || {}), note = m._added ? `${m._added} more item${m._added === 1 ? '' : 's'} added` : 'Nothing new on that part';
  if (!saved) { spendDraftSheet(m); return toast(note, 2500); }
  const items = m.items.slice(0, 160).map(i => ({name: String(i.name).slice(0, 60), price: Math.round((+i.price || 0) * 100) / 100, qty: String(i.qty || '').slice(0, 20)}));
  Object.assign(base, {items, total: m.total || base.total, store: m.store, source: 'receipt'}); spendSheet(base); render();
  if (!DEMO) db(sb.from('grocery_spend').update({items, total: base.total, store: base.store, source: 'receipt'}).eq('id', base.id));
  toast(note, 2500);
}
async function readReceipt(fileList, mode) {
  const files = [...fileList].slice(0, 3);
  if (DEMO) { await new Promise(r => setTimeout(r, 400)); return {receipt: {store: '', day: '', total: 0, items: [{name: 'Bananas 1kg', price: 4.20, place: 'pantry'}, {name: 'Greek yoghurt 1kg', price: 7.50, place: 'fridge'}, {name: 'Pasta 500g', price: 2.30, place: 'pantry'}]}}; }
  const imgs = await Promise.all(files.map(f => photoToBase64(f, 2000)));
  const r = await sendReceipt(imgs, mode); if (r.error) { receiptFailed(r.error, imgs, mode); return {failed: true}; }
  return r;
}
document.addEventListener('change', async e => {
  const el = e.target; if (!['spend-more', 'spend-more-saved'].includes(el.dataset.change) || !el.files || !el.files.length) return;
  const saved = el.dataset.change === 'spend-more-saved', base = saved ? (S.spend || []).find(x => x.id === S._spendOpen) : S._spendDraft;
  if (!base) return; toast('Reading the next part…', 20000);
  try {
    const mode = saved ? 'saved' : 'draft', r = await readReceipt(el.files, mode); if (r.failed) return;
    applyReceipt(r, mode);
  } catch { toast("Couldn't read that photo. Try again.", 5000); }
});
document.addEventListener('change', async e => {
  const el = e.target; if (el.dataset.change !== 'spend-photo' || !el.files || !el.files.length) return;
  const files = [...el.files].slice(0, 3); toast('Reading the receipt…', 20000);
  if (DEMO) { await new Promise(r => setTimeout(r, 400)); return spendDraftSheet({store: 'Woolworths', day: dayKey(new Date()), total: 86.40, items: [{name: 'Milk 2L', price: 3.10, place: 'fridge'}, {name: 'Bread', price: 4.50, place: 'pantry'}, {name: 'Chicken thigh 1kg', price: 13.00, place: 'fridge'}, {name: 'Bananas', price: 4.20, place: 'pantry'}, {name: 'Dishwashing liquid', price: 5.50}]}); }
  try {
    const r = await readReceipt(files, 'new'); if (r.failed) return;
    applyReceipt(r, 'new');
  } catch { toast("Couldn't read that photo. Try again, or type the total.", 5000); }
});
