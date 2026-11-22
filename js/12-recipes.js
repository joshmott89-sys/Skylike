// Skylike: recipes. The family recipe box: save from a link, a photo of a cookbook or card, or by typing;
// plan one onto a day (its ingredients feed groceries); favourites steer the weekly planner.
const RECIPE_URL = SUPABASE_URL + '/functions/v1/recipe';
async function callRecipe(body) {
  if (DEMO) return {error: 'Importing is off in the sample. Sign in to use it.'};
  const {data: {session}} = await sb.auth.getSession();
  S.busy = (S.busy || 0) + 1;
  try {
    const r = await fetch(RECIPE_URL, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, apikey: SUPABASE_KEY}, body: JSON.stringify(Object.assign({household_id: S.hid}, body))});
    return await r.json();
  } catch { return {error: "Couldn't reach Skylike. Check your signal and try again."}; } finally { S.busy--; }
}
const recipeById = id => (S.recipes || []).find(r => r.id === id);
const recipeOfMeal = m => m && m.notes && /^recipe:/.test(m.notes) ? recipeById(m.notes.slice(7)) : null;
const recipeMatch = title => { const t = normFood(title); return (S.recipes || []).find(r => normFood(r.title) === t) || null; };
const recipesSorted = () => (S.recipes || []).slice().sort((a, b) => (b.favourite - a.favourite) || (b.times_cooked - a.times_cooked) || a.title.localeCompare(b.title));

// The Recipe box panel on the Meals page
function recipeBoxHTML() {
  const all = recipesSorted(), shown = all.slice(0, isPhone() ? 4 : 8);
  return `<div class="panel rbox"><h2>Recipe box<span class="num rbn">${all.length || ''}</span><span class="sp"></span>${all.length > shown.length ? `<button class="btn ghost sm" data-act="recipe-all">See all</button>` : ''}<button class="btn soft sm" data-act="recipe-new">${icon('plus')}Add a recipe</button></h2>
    ${shown.length ? `<div class="rgrid">${shown.map(recipeCard).join('')}</div>`
      : `<div class="empty">${emptyArt('book')}<b>Save the family's favourites</b>Paste a link, snap a cookbook page or a handwritten card, or type one in. Plan it onto a day and the shopping is done for you.</div>`}</div>`;
}
const recipeCard = r => `<button class="rcard" data-act="recipe-open" data-id="${r.id}">${foodArt(r.title, 'rart')}<span class="rt">${esc(r.title)}</span><span class="rm">${r.favourite ? `${icon('heart', 'xs')} ` : ''}${[r.prep_time, r.times_cooked ? `cooked ${r.times_cooked}×` : ''].filter(Boolean).map(esc).join(' · ') || `${(r.ingredients || []).length} ingredients`}</span></button>`;

function recipeAllSheet(q = '') {
  const t = normFood(q), list = recipesSorted().filter(r => !t || normFood(r.title).includes(t) || (r.ingredients || []).some(i => normFood(i.name).includes(t)));
  sheet(`<h2>Recipe box</h2><input class="input" id="rq" placeholder="Search recipes or an ingredient" value="${esc(q)}" data-change="recipe-q" autocomplete="off">
    <div class="rgrid" style="margin-top:12px">${list.map(recipeCard).join('') || '<p class="help">Nothing matches.</p>'}</div>`);
}

function recipeSheet(id) {
  const r = recipeById(id); if (!r) return;
  const ing = r.ingredients || [], steps = r.steps || [];
  let grp = null;
  const rows = ing.map(x => { const g = x.group && x.group !== grp ? `<li class="ggrp">${esc(x.group)}</li>` : ''; grp = x.group || grp; const h = haveIt(x.name);
    return g + `<li class="${h ? 'have' : ''}"><span><b class="num">${esc(x.qty || '')}</b> ${esc(x.name)}${x.notes ? `<small class="inote">, ${esc(x.notes)}</small>` : ''}</span><span class="tag">${h ? 'Have' : 'Buy'}</span></li>`; }).join('');
  const days = [...Array(7)].map((_, i) => addDaysKey(dayKey(new Date()), i));
  sheet(`<h2>${foodArt(r.title, 'h2art')} ${esc(r.title)}</h2>
    <p class="help">${[r.servings ? `Serves ${esc(r.servings)}` : '', r.prep_time ? esc(r.prep_time) : '', r.times_cooked ? `Cooked ${r.times_cooked} time${r.times_cooked === 1 ? '' : 's'}${r.last_cooked ? `, last ${esc(fmtDay(r.last_cooked, {day: 'numeric', month: 'short'}))}` : ''}` : 'Not cooked yet'].filter(Boolean).join(' · ')}${r.url ? ` · <a href="${esc(r.url)}" target="_blank" rel="noopener">Open the recipe</a>` : ''}</p>
    <div class="lbl">Plan it for</div><div class="ptags rdays">${days.map(k => { const m = mealOn(k); return `<button class="ptag ${m ? 'busy' : ''}" data-act="recipe-plan" data-id="${r.id}" data-k="${k}" title="${m ? esc('Replaces ' + m.title) : ''}">${esc(i18nDay(k, dayKey(new Date())))}</button>`; }).join('')}</div>
    <h3>Ingredients</h3><ul class="ing">${rows || '<li class="help">No ingredients saved.</li>'}</ul>
    ${steps.length ? `<h3>Method</h3><ol class="rsteps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${r.notes ? `<h3>Notes</h3><p>${esc(r.notes)}</p>` : ''}
    <div class="row" style="margin-top:16px;flex-wrap:wrap"><button class="btn soft" data-act="recipe-fave" data-id="${r.id}">${icon('heart')}${r.favourite ? 'Favourite' : 'Make it a favourite'}</button>${ing.some(x => !haveIt(x.name)) ? `<button class="btn soft" data-act="recipe-need" data-id="${r.id}">${icon('cart')}Add what's missing to groceries</button>` : ''}<button class="btn ghost" data-act="recipe-edit" data-id="${r.id}">${icon('edit')}Edit</button><button class="btn ghost" data-act="recipe-del" data-id="${r.id}">${icon('trash')}Remove</button></div>`);
}

function recipeNewSheet(draft) {
  if (draft) { // a recipe read from a link, photo or text: check it, then save
    S._rdraft = draft;
    return sheet(`<h2>${foodArt(draft.title, 'h2art')} ${esc(draft.title)}</h2><p class="help">${(draft.ingredients || []).length} ingredients${(draft.steps || []).length ? ` · ${draft.steps.length} steps` : ''}${draft.servings ? ` · serves ${esc(draft.servings)}` : ''}. Check it, then save. You can edit it any time.</p>
      <ul class="ing">${(draft.ingredients || []).slice(0, 12).map(x => `<li><span><b class="num">${esc(x.qty || '')}</b> ${esc(x.name)}</span></li>`).join('')}${(draft.ingredients || []).length > 12 ? `<li class="help">and ${draft.ingredients.length - 12} more</li>` : ''}</ul>
      <div class="row" style="margin-top:14px"><button class="btn" data-act="recipe-save-draft">${icon('check')}Save to the recipe box</button><button class="btn ghost" data-act="recipe-new">Start again</button></div>`);
  }
  sheet(`<h2>Add a recipe</h2>
    <form data-form="recipe-link" class="field"><label for="rl">From a link</label><div class="row" style="flex-wrap:nowrap"><input class="input grow" id="rl" name="url" type="url" inputmode="url" placeholder="Paste a recipe link" required><button class="btn">Get it</button></div><p class="help">Works with most recipe sites (RecipeTin Eats, Taste, BBC Good Food and the like).</p></form>
    <div class="field"><div class="lbl">From a photo</div><label class="btn soft">${icon('camera')}Snap a cookbook page or card<input type="file" accept="image/*" multiple data-change="recipe-photo" hidden></label><p class="help">Handwritten cards work too. Several photos for a long recipe are fine.</p></div>
    <form data-form="recipe-text" class="field"><label for="rt">Or type or paste it</label><textarea class="input" id="rt" name="text" rows="5" placeholder="Nan's meatballs&#10;500g beef mince&#10;1 onion, grated&#10;…" required></textarea><button class="btn soft" style="margin-top:8px">Tidy it up</button></form>
    <p class="help">Reading photos and typed recipes uses the free Gemini key. Links don't.</p>`);
}

function recipeEditSheet(id) {
  const r = recipeById(id); if (!r) return;
  sheet(`<h2>Edit recipe</h2><form data-form="recipe-edit" data-id="${r.id}">
    <div class="field"><label for="re-t">Name</label><input class="input" id="re-t" name="title" value="${esc(r.title)}" required maxlength="120"></div>
    <div class="row"><div class="field grow"><label for="re-s">Serves</label><input class="input" id="re-s" name="servings" value="${esc(r.servings || '')}" maxlength="30"></div><div class="field grow"><label for="re-p">Time</label><input class="input" id="re-p" name="prep_time" value="${esc(r.prep_time || '')}" maxlength="30"></div></div>
    <div class="field"><label for="re-i">Ingredients, one per line</label><textarea class="input" id="re-i" name="ingredients" rows="8">${esc((r.ingredients || []).map(x => (x.qty ? x.qty + ' ' : '') + x.name + (x.notes ? ', ' + x.notes : '')).join('\n'))}</textarea></div>
    <div class="field"><label for="re-m">Method, one step per line</label><textarea class="input" id="re-m" name="steps" rows="6">${esc((r.steps || []).join('\n'))}</textarea></div>
    <div class="field"><label for="re-n">Notes</label><textarea class="input" id="re-n" name="notes" rows="2" maxlength="600">${esc(r.notes || '')}</textarea></div>
    <div class="row"><span class="grow"></span><button type="button" class="btn ghost" data-act="recipe-open" data-id="${r.id}">Cancel</button><button class="btn">Save</button></div></form>`);
}
const QTY_RE = /^((?:[\d¼½¾⅓⅔⅛.,/]+(?:\s*(?:-|–|to)\s*[\d¼½¾⅓⅔⅛.,/]+)?\s*)+(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|g|kg|ml|l|oz|lbs?|cans?|tins?|cloves?|pinch|bunch|handfuls?|slices?)?\.?)\s+(.+)$/i;
const splitIngLine = l => { const t = l.trim(); const m = t.match(QTY_RE); return m ? {qty: m[1].trim(), name: m[2].trim()} : {qty: '', name: t}; };

async function saveRecipe(rec) {
  const me = meMember(), row = {id: uid(), household_id: S.hid, title: String(rec.title || 'Recipe').slice(0, 120), url: rec.url || null, source: rec.source || 'typed', servings: rec.servings || null, prep_time: rec.prep_time || null,
    ingredients: (rec.ingredients || []).slice(0, 60), steps: (rec.steps || []).slice(0, 40), notes: rec.notes || null, favourite: !!rec.favourite, added_by: me ? me.id : null, created_at: new Date().toISOString()};
  S.recipes = (S.recipes || []).concat(row); render();
  if (!DEMO) await db(sb.from('recipes').insert(row));
  return row;
}
async function planRecipe(r, k) {
  const row = {household_id: S.hid, day: k, slot: 'dinner', title: r.title, url: r.url || null, ingredients: (r.ingredients || []).slice(0, 40), servings: r.servings || null, prep_time: r.prep_time || null, real: false, double_batch: false, cooked: false, leftovers_of: null, emoji: null, est_cost: null, notes: 'recipe:' + r.id};
  if (DEMO) { S.meals = S.meals.filter(m => !(m.day === k && (m.slot || 'dinner') === 'dinner')).concat(Object.assign({id: uid()}, row)); render(); return true; }
  const {data, error} = await sb.from('meals').upsert(row, {onConflict: 'household_id,day,slot'}).select().single(); if (error) { toast("Couldn't plan that."); return false; }
  S.meals = S.meals.filter(m => !(m.day === k && (m.slot || 'dinner') === 'dinner')).concat(data); render(); return true;
}

Object.assign(A, {
  'recipe-new'() { S._rdraft = null; recipeNewSheet(); },
  'recipe-all'() { recipeAllSheet(); },
  'recipe-open'(el) { recipeSheet(el.dataset.id); },
  'recipe-edit'(el) { recipeEditSheet(el.dataset.id); },
  async 'recipe-save-draft'() { const d = S._rdraft; if (!d) return; S._rdraft = null; const r = await saveRecipe(d); toast(`Saved ${r.title}.`);
    const mk = S._rdraftMeal, m = mk && mealOn(mk); S._rdraftMeal = null; if (m) { m.notes = 'recipe:' + r.id; if (!DEMO) db(sb.from('meals').update({notes: m.notes}).eq('id', m.id)); render(); }
    recipeSheet(r.id); },
  // AI-planned dinners without a real recipe page: write the method for this meal, with its own ingredients
  async 'meal-method'(el) {
    const m = mealOn(el.dataset.k); if (!m) return;
    const ex = recipeMatch(m.title); if (ex) return recipeSheet(ex.id);
    if (!S.aiOn && !DEMO) return toast('Writing a method needs the free Gemini key (Settings → Kitchen).', 5000);
    el.disabled = true; el.innerHTML = `<span class="spin"></span>Writing the method…`;
    const ing = (m.ingredients || []).map(x => ({qty: x.qty || '', name: x.name, ...(x.group ? {group: x.group} : {})}));
    const r = DEMO ? {recipe: {title: m.title, servings: m.servings || '4', prep_time: m.prep_time || '', source: 'ai', ingredients: ing, steps: ['Get everything out and preheat the oven to 200°C.', 'Prep the vegetables while the oven heats.', 'Cook the main part until golden, about 15 minutes.', 'Bring it all together, taste, season and serve.']}}
      : await callRecipe({write: {title: m.title, servings: m.servings || '', ingredients: ing}});
    if (r.error) { el.disabled = false; el.textContent = 'Show me how to make it'; return toast(r.error, 5000); }
    r.recipe.ingredients = r.recipe.ingredients && r.recipe.ingredients.length ? r.recipe.ingredients : ing;
    S._rdraftMeal = el.dataset.k; recipeNewSheet(r.recipe);
  },
  async 'recipe-fave'(el) { const r = recipeById(el.dataset.id); if (!r) return; r.favourite = !r.favourite; recipeSheet(r.id); render(); if (!DEMO) await db(sb.from('recipes').update({favourite: r.favourite}).eq('id', r.id)); },
  async 'recipe-need'(el) { const r = recipeById(el.dataset.id); if (!r) return; const n = await groceryAdd((r.ingredients || []).filter(x => !haveIt(x.name)).map(x => x.name)); toast(n ? `Added ${n} to groceries.` : 'Already on the list.'); },
  async 'recipe-plan'(el) { const r = recipeById(el.dataset.id); if (!r) return; if (await planRecipe(r, el.dataset.k)) { closeSheet(); toast(`${r.title} planned for ${i18nDay(el.dataset.k, dayKey(new Date()))}.`); } },
  async 'recipe-del'(el) {
    const r = recipeById(el.dataset.id); if (!r) return;
    if (!confirmTap('recipe-del', `Tap again to remove ${r.title} from the recipe box.`)) return;
    S.recipes = S.recipes.filter(x => x !== r); closeSheet(); render(); if (!DEMO) await db(sb.from('recipes').delete().eq('id', r.id));
  },
  async 'meal-save-recipe'(el) {
    const m = mealOn(el.dataset.k); if (!m) return; const ex = recipeMatch(m.title); if (ex) return recipeSheet(ex.id);
    const r = await saveRecipe({title: m.title, url: m.url, servings: m.servings, prep_time: m.prep_time, ingredients: (m.ingredients || []).map(x => ({qty: x.qty || '', name: x.name, ...(x.group ? {group: x.group} : {})})), source: 'plan'});
    await db(sb.from('meals').update({notes: 'recipe:' + r.id}).eq('id', m.id)); m.notes = 'recipe:' + r.id; toast(`Saved ${r.title} to the recipe box.`); recipeSheet(r.id);
  },
});
Object.assign(F, {
  async 'recipe-link'(f) { const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Reading…'; const r = await callRecipe({url: f.url.value.trim()}); btn.disabled = false; btn.textContent = 'Get it'; if (r.error) return toast(r.error, 5000); recipeNewSheet(r.recipe); },
  async 'recipe-text'(f) { const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Tidying…'; const r = await callRecipe({text: f.text.value}); btn.disabled = false; btn.textContent = 'Tidy it up'; if (r.error) return toast(r.error, 5000); recipeNewSheet(r.recipe); },
  async 'recipe-edit'(f) {
    const r = recipeById(f.dataset.id); if (!r) return;
    Object.assign(r, {title: f.title.value.trim().slice(0, 120), servings: f.servings.value.trim() || null, prep_time: f.prep_time.value.trim() || null, notes: f.notes.value.trim() || null,
      ingredients: f.ingredients.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 60).map(splitIngLine), steps: f.steps.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 40)});
    recipeSheet(r.id); render();
    if (!DEMO) await db(sb.from('recipes').update({title: r.title, servings: r.servings, prep_time: r.prep_time, notes: r.notes, ingredients: r.ingredients, steps: r.steps}).eq('id', r.id));
  },
});
document.addEventListener('change', async e => {
  const el = e.target; if (!el || !el.dataset) return;
  if (el.dataset.change === 'recipe-photo' && el.files && el.files.length) {
    const files = [...el.files].slice(0, 4); el.value = ''; toast('Reading the recipe…', 8000);
    try { const imgs = await Promise.all(files.map(f => photoToBase64(f, 1600))); const r = await callRecipe({images: imgs}); if (r.error) return toast(r.error, 5000); recipeNewSheet(r.recipe); }
    catch { toast("Couldn't open that photo. Try again.", 4000); }
  }
});
document.addEventListener('input', e => { const el = e.target; if (el && el.dataset && el.dataset.change === 'recipe-q') { clearTimeout(S._rqT); S._rqT = setTimeout(() => { const v = el.value; recipeAllSheet(v); const q = document.getElementById('rq'); if (q) { q.focus(); q.setSelectionRange(v.length, v.length); } }, 250); } });
