// Skylike AI helper (Gemini, the household's own free key, kept server-side).
// Signed-in member: { household_id, action, ... }
// actions: test | groceries | pantry_photo | plan | budget | recipe
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const API = "https://generativelanguage.googleapis.com/v1beta";
const modelCache = new Map<string, { name: string; at: number }>();

// Pick a current Flash model from what this key can use, so retired model names never break the app.
async function pickModel(key: string): Promise<string> {
  const c = modelCache.get(key);
  if (c && Date.now() - c.at < 6 * 3600e3) return c.name;
  const r = await fetch(`${API}/models?pageSize=200&key=${encodeURIComponent(key)}`);
  if (r.status === 400 || r.status === 403) throw new Error("That Gemini key wasn't accepted. Check it in Settings → Kitchen.");
  const d = await r.json();
  const ok = (d.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m: any) => String(m.name).replace(/^models\//, ""))
    .filter((n: string) => /flash/.test(n) && !/image|tts|live|audio|embed|thinking|exp/.test(n));
  const ver = (n: string) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0");
  ok.sort((a: string, b: string) => (ver(b) - ver(a)) || (Number(/lite/.test(a)) - Number(/lite/.test(b))) || (Number(/preview/.test(a)) - Number(/preview/.test(b))));
  // Google's own "latest Flash" alias first: stable, fast, and kept current for us.
  const name = ok.includes("gemini-flash-latest") ? "gemini-flash-latest" : (ok.find((n: string) => !/lite|preview|omni/.test(n)) || ok[0] || "gemini-flash-latest");
  modelCache.set(key, { name, at: Date.now() });
  return name;
}

// Free-tier Gemini: the "Lite" model answers in about a second and has the most generous free limit,
// so it does everything first; if it's busy or over its limit, try the full Flash model, then give a clear message.
async function gemini(key: string, prompt: string, image?: { data: string; mime: string }, opts: { timeout?: number; level?: string } = {}) {
  const models = ["gemini-flash-lite-latest", await pickModel(key)].filter((m, i, a) => a.indexOf(m) === i);
  const parts: any[] = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: image.mime || "image/jpeg", data: image.data } });
  let lastErr = "";
  for (const model of models) {
    const t0 = Date.now();
    const call = (thinking: boolean) => {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), model.includes("lite") ? 45000 : (opts.timeout || 60000));
      const generationConfig: any = { responseMimeType: "application/json", temperature: 0.4 };
      if (thinking) generationConfig.thinkingConfig = { thinkingLevel: model.includes("lite") ? "minimal" : (opts.level || "minimal") };
      return fetch(`${API}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
      }).finally(() => clearTimeout(t));
    };
    let r: Response;
    try { r = await call(true); if (r.status === 400) { const peek = await r.clone().text(); if (/thinking/i.test(peek)) r = await call(false); } }
    catch { console.log(JSON.stringify({ model, ms: Date.now() - t0, timeout: true })); lastErr = "slow"; continue; }
    const d = await r.json().catch(() => ({}));
    console.log(JSON.stringify({ model, ms: Date.now() - t0, status: r.status, usage: d?.usageMetadata, err: d?.error?.message }));
    if (r.status === 429) { lastErr = "limit"; continue; }
    if (r.status === 404 || r.status >= 500) { lastErr = d?.error?.message || "busy"; continue; }
    if (!r.ok) throw new Error(d?.error?.message || "AI request failed");
    const text = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}";
    try { return { model, out: JSON.parse(text.replace(/^```json\s*|```$/g, "")) }; } catch { lastErr = "unreadable"; continue; }
  }
  throw new Error(lastErr === "limit" ? "Today's free AI limit is used up for now. Try again in a few minutes."
    : lastErr === "slow" ? (image ? "The AI took too long to read that photo. Try again, or take it a little further back." : "The AI took too long to answer. Try again in a moment.")
    : lastErr === "unreadable" ? "The AI reply couldn't be read. Try again." : "Google's AI is busy right now. Try again in a minute.");
}

// ---- Real recipes: look each planned dinner up on RecipeTin Eats and use its actual ingredient card ----
const RTE = "https://www.recipetineats.com/wp-json/wp/v2/posts";
const STOP = new Set(["the","a","an","and","with","of","in","my","easy","best","recipe","nagi","s","recipetin","eats"]);
const ent = (t: string) => t.replace(/&#8217;|&#039;|&apos;/g, "'").replace(/&#8211;|&#8212;/g, "-").replace(/&#8220;|&#8221;|&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, "");
const strip = (h: string) => ent(String(h || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const toks = (t: string) => strip(t).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w && !STOP.has(w)).map(w => w.length > 3 ? w.replace(/s$/, "") : w);
function score(a: string, b: string) {
  const A = toks(a), B = toks(b); if (!A.length || !B.length) return 0;
  const inter = A.filter(w => B.includes(w)).length, union = A.length + B.length - inter;
  return Math.min(1, inter / union + (inter === Math.min(A.length, B.length) && inter >= 2 ? 0.25 : 0));
}
async function getJSON(url: string) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
  try { const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Skylike family planner" } }); if (!r.ok) throw new Error("http " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
function parseCard(html: string) {
  const lines: any[] = []; let group = "";
  const re = /wprm-recipe-group-name[^>]*>([\s\S]*?)<\/(?:h\d|div|span)>|<li class="wprm-recipe-ingredient"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  const span = (li: string, cls: string) => { const x = li.match(new RegExp('class="wprm-recipe-ingredient-' + cls + '[^"]*"[^>]*>([\\s\\S]*?)</span>')); return x ? strip(x[1]) : ""; };
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) { group = strip(m[1]).replace(/:$/, ""); continue; }
    const li = m[2], name = span(li, "name").replace(/\(\s*note[^)]*\)/ig, "").trim();
    if (!/[a-z]/i.test(name)) continue;
    lines.push({ name, qty: [span(li, "amount"), span(li, "unit")].filter(Boolean).join(" "), notes: span(li, "notes").replace(/\(?\s*note \d+\s*\)?/ig, "").replace(/^[\s,(]+|[\s,)]+$/g, "").trim(), group });
  }
  const serv = html.match(/wprm-recipe-servings\b(?!-)[^>]*>\s*(\d+)/), print = html.match(/href="(https:\/\/www\.recipetineats\.com\/wprm_print\/[^"]+)"/);
  return { lines, servings: serv ? serv[1] : "", print: print ? print[1] : "" };
}
async function realRecipe(title: string) {
  try {
    const hits = await getJSON(`${RTE}?search=${encodeURIComponent(toks(title).join(" "))}&orderby=relevance&per_page=8&_fields=id,link,title`);
    let best: any = null, bs = 0;
    for (const h of Array.isArray(hits) ? hits : []) { const sc = score(title, h?.title?.rendered || ""); if (sc > bs) { bs = sc; best = h; } }
    if (!best || bs < 0.5) return null;
    const post = await getJSON(`${RTE}/${best.id}?_fields=id,link,title,content`);
    const card = parseCard(post?.content?.rendered || "");
    if (card.lines.length < 2) return null;
    return { title: strip(post.title.rendered), url: card.print || post.link, servings: card.servings, ingredients: card.lines };
  } catch { return null; }
}

const AISLES = "Fruit & veg, Meat & seafood, Deli, Dairy & eggs, Bakery, Pantry, Frozen, Drinks, Snacks, Baby, Household, Health & beauty, Other";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({}));
  const cron = req.headers.get("x-cron-secret");
  if (cron && body.action === "diag") {
    const { data: ap } = await admin.from("app_private").select("cron_secret").eq("id", 1).single();
    if (!ap || ap.cron_secret !== cron) return json({ error: "unauthorised" }, 401);
    const { data: hp2 } = await admin.from("household_private").select("ai_key").not("ai_key", "is", null).limit(1).maybeSingle();
    const k = hp2?.ai_key; const out: any = { picked: await pickModel(k) };
    const prompt = "Estimate AUD prices at Woolworths for: milk, bread, bananas, weet-bix, nappies size 5. Return JSON {\"items\":[{\"name\":\"\",\"est\":0}]}";
    for (const [label, o] of [["default", {}]] as any) {
      const t = Date.now(); try { await gemini(k, prompt, undefined, o); out[label] = Date.now() - t; } catch (e) { out[label] = "fail " + (Date.now() - t) + " " + (e as Error).message; }
    }
    return json(out);
  }
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return json({ error: "Please sign in again" }, 401);
  const hid = body.household_id as string;
  const { data: m } = await admin.from("memberships").select("user_id").eq("household_id", hid).eq("user_id", u.user.id).maybeSingle();
  if (!m) return json({ error: "not a member" }, 403);
  const { data: hp } = await admin.from("household_private").select("ai_key").eq("household_id", hid).maybeSingle();
  const key = hp?.ai_key;
  if (!key) return json({ error: "Add a free Gemini key in Settings → Kitchen first." }, 400);

  try {
    const a = body.action;
    if (a === "test") return json({ ok: true, model: await pickModel(key) });

    if (a === "groceries") {
      const text = String(body.text || "").slice(0, 4000);
      const { out } = await gemini(key, `Turn this Australian family's grocery brain-dump into a tidy shopping list.
Split it into separate items, fix spelling, use Australian names (capsicum, zucchini, mince), keep any quantity they gave, and drop chatter that isn't a grocery item.
Merge duplicates. Already on the list (don't repeat): ${JSON.stringify(body.existing || []).slice(0, 2000)}.
Give each an aisle from: ${AISLES}.
Return JSON: {"items":[{"name":"Milk","qty":"2 L","aisle":"Dairy & eggs"}]}
Brain-dump: """${text}"""`);
      return json({ items: (out.items || []).slice(0, 80) });
    }

    if (a === "pantry_photo") {
      const img = String(body.image || "");
      if (img.length > 7_000_000) return json({ error: "That photo is too big. Try again a little further back." }, 400);
      const { out } = await gemini(key, `This is a photo of a family's ${body.place || "fridge or pantry"}. List the food and drink items you can clearly identify, with a rough quantity (e.g. "half", "2", "1 bottle", "low").
Use short, plain Australian names (e.g. "Milk", "Tinned tuna", "Jalapenos"), no brand unless it is the product's common name. Mark items that look nearly finished as low. Skip anything you can't identify confidently. List each item once.
Already recorded (if an item is the same thing, use EXACTLY this name): ${JSON.stringify(body.existing || []).slice(0, 2500)}.
If you can see cooked leftovers (food in containers or covered bowls) and can reasonably tell what they are, list them as "Leftover <dish>" with leftover:true and a guess at portions (whole number). If you can't tell what a container holds, skip it.
Return JSON: {"items":[{"name":"Milk","qty":"half","place":"fridge","low":true},{"name":"Leftover spaghetti bolognese","place":"fridge","leftover":true,"portions":2}]} where place is one of fridge, freezer, pantry.`, { data: img, mime: body.mime || "image/jpeg" }, { timeout: 90000 });
      return json({ items: (out.items || []).slice(0, 80) });
    }

    if (a === "plan") {
      const dates = (body.dates || []).slice(0, 7);
      const L = body.lunches;
      // lunches run alongside dinners (quick, Lite model), so they don't slow the plan down
      const lunchP = L && (L.dates || []).length ? gemini(key, `Plan simple lunches for these dates: ${JSON.stringify(L.dates.slice(0, 7))}.
Who: ${L.who === "kids" ? "the kids' school/kindy lunchboxes (young kids, under 6). Nut-free (Australian school rules), no reheating, easy for small hands: a main plus fruit and a snack." : "the whole family (" + (body.people || 4) + " people), packed or at home."}
${(L.leftovers || []).length ? "Use these leftovers first; each portion feeds ONE person's lunch, so spread them across days and people and note it in uses_leftover: " + JSON.stringify(L.leftovers).slice(0, 600) + ".\n" : ""}Use what's already in where it makes sense: ${JSON.stringify(body.pantry || []).slice(0, 1200)}. Tastes and things to avoid: ${String(body.notes || "none").slice(0, 400)}.
Keep shopping small: reuse ingredients across days. Estimate the AUD cost of anything to buy.
Return JSON: {"lunches":[{"day":"YYYY-MM-DD","title":"Cheese and vegemite scrolls, apple, yoghurt pouch","emoji":"🥪","uses_leftover":null,"items":[{"name":"Cheese","qty":"2 slices"}],"est_cost":4}]}`).then(r => r.out.lunches || []).catch(() => []) : Promise.resolve([]);
      if (!dates.length) return json({ meals: [], lunches: await lunchP });
      const { out } = await gemini(key, `Plan family dinners. Cook on these dates (double=true means cook a DOUBLE batch so the next night is leftovers): ${JSON.stringify(dates)}.
Feeding: ${body.people || 4} people (young kids included). Cooking skill: ${body.skill || "home cook"}. Vibe and effort: ${body.vibe || "standard family dinners"}.
${(body.focus || []).length ? "Focus: " + body.focus.join(", ") + ".\n" : ""}${(body.cuisines || []).length ? "Lean toward these cuisines: " + body.cuisines.join(", ") + ".\n" : ""}Tastes and things to avoid: ${String(body.notes || "none given").slice(0, 600)}. Weekly dinner budget: ${body.budget ? "$" + body.budget + " AUD" : "keep it sensible"}.
${(body.leftovers || []).length ? "Leftovers in the fridge (too few portions for a family dinner, so don't plan a dinner around them; they're for lunches): " + JSON.stringify(body.leftovers).slice(0, 600) + ".\n" : ""}Use up what's already in the fridge and pantry where it makes sense: ${JSON.stringify(body.pantry || []).slice(0, 1500)}.
Avoid repeating these recent meals: ${JSON.stringify(body.recent || []).slice(0, 600)}.
ONLY choose recipes that really exist on RecipeTin Eats (recipetineats.com) and give the exact recipe title as published there, so it can be looked up.
For each, list the main ingredients with quantities for the family (double for double batches), prep time, difficulty (Easy/Medium/Hard), a fitting food emoji, and the estimated AUD cost at Woolworths or Coles of what they'd need to buy.
Return JSON: {"meals":[{"day":"YYYY-MM-DD","title":"Tuna Mornay (Tuna Casserole Pasta Bake)","emoji":"🐟","prep_time":"35 min","difficulty":"Easy","double":false,"ingredients":[{"name":"Tinned tuna","qty":"425 g"}],"est_cost":14}]}`, undefined, { timeout: 110000, level: "low" });
      const meals = (out.meals || []).slice(0, 7);
      // swap in the real recipe card where RecipeTin Eats has it
      const real = await Promise.all(meals.map((m: any) => realRecipe(String(m.title || ""))));
      meals.forEach((m: any, i: number) => { const r = real[i]; if (r) Object.assign(m, { title: r.title, url: r.url, servings: r.servings, ingredients: r.ingredients, real: true }); else m.real = false; });
      return json({ meals, lunches: await lunchP });
    }
    if (a === "real_recipe") return json(await realRecipe(String(body.title || "")) || { none: true });

    if (a === "recipe") {
      const r = await realRecipe(String(body.title || ""));
      if (r) return json(Object.assign({ emoji: null, est_cost: null, real: true }, r));
      const { out } = await gemini(key, `Give the main ingredients, with quantities for ${body.servings || 4} people, for the dish "${String(body.title || "").slice(0, 120)}" as made on RecipeTin Eats if it exists there, plus a fitting food emoji and an estimated AUD cost at Woolworths or Coles.
Return JSON: {"title":"...","emoji":"🍝","ingredients":[{"name":"...","qty":"..."}],"est_cost":15}`);
      return json(out);
    }

    if (a === "budget") {
      const { out } = await gemini(key, `Estimate what these groceries would cost at Woolworths or Coles in Perth, Australia right now, using typical everyday (non-special) prices for a normal pack size, in AUD.
Items: ${JSON.stringify(body.items || []).slice(0, 4000)}
Return one entry per item, in the same order, using each item's name exactly as given.
Return JSON: {"total":85.5,"items":[{"name":"Milk","est":3.1}]}`);
      return json(out);
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
