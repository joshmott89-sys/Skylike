// Skylike recipe import: { household_id, url } | { household_id, images: [base64] } | { household_id, text }
// Links: most recipe sites publish the recipe as structured data (schema.org Recipe), so no AI is needed.
// Photos (cookbook page, handwritten card, screenshot) and pasted text: read by the household's own Gemini key.
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Ing = { name: string; qty: string; group?: string; notes?: string };
type Recipe = { title: string; servings: string; prep_time: string; ingredients: Ing[]; steps: string[]; url?: string; source: string };

const ent = (t: string) => t.replace(/&#8217;|&#039;|&apos;|&rsquo;/g, "'").replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, "-").replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&frac12;/g, "½").replace(/&frac14;/g, "¼").replace(/&frac34;/g, "¾").replace(/&#\d+;/g, "");
const clean = (t: unknown) => ent(String(t ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const UNIT = "(?:cups?|c\\.|tbsps?|tablespoons?|tsps?|teaspoons?|g|grams?|kg|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lbs?|pounds?|cans?|tins?|cloves?|pinch(?:es)?|bunch(?:es)?|handfuls?|slices?|sprigs?|sticks?|packets?|pkts?|jars?)";
const QTY = new RegExp(`^((?:[\\d¼½¾⅓⅔⅛.,/]+(?:\\s*(?:-|–|to)\\s*[\\d¼½¾⅓⅔⅛.,/]+)?\\s*)+${UNIT}?\\.?)\\s+(.+)$`, "i");
// "2 garlic cloves (, minced)" → qty "2", name "garlic cloves", notes "minced"; "1 lb / 500g beef mince" → metric first
function tidyIng(qty: string, raw: string): Ing {
  let n = raw.replace(/\(\s*note\s*\d+\s*\)/ig, "").replace(/\(\s*,\s*/g, "(").replace(/\(\(/g, "(").replace(/\)\)/g, ")").replace(/\(\s*\)/g, "").trim();
  let m = n.match(/^\/\s*([\d.,]+\s*(?:g|kg|ml|l)\b)\s*(.*)$/i); if (m) { qty = m[1].replace(/\s+/g, " "); n = m[2]; }
  m = n.match(/^\(\s*([\d.,]+\s*(?:g|kg|ml|l)\b)\s*\)\s*(.*)$/i); if (m) { qty = `${qty} (${m[1]})`.trim(); n = m[2]; }
  n = n.replace(/^\/\s*[\d.,]+\s*(?:fl\.?\s*oz|oz|lbs?|cups?)\b\s*/i, ""); // "800g / 28 oz can tomatoes": keep the metric
  const cut = n.search(/[(,]/), base = (cut > 1 ? n.slice(0, cut) : n).trim(), rest = cut > 1 ? n.slice(cut).replace(/^[,\s]+/, "").replace(/[()]/g, "").replace(/\s+,/g, ",").replace(/\s+/g, " ").trim() : "";
  return { qty: qty.trim(), name: base || n, ...(rest ? { notes: rest.slice(0, 120) } : {}) } as Ing;
}
const splitIng = (s: string): Ing => { const t = clean(s); const m = t.match(QTY); return m ? tidyIng(m[1].trim(), m[2].trim()) : tidyIng("", t); };
const isoMins = (d: unknown) => { const m = String(d || "").match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/i); if (!m || (!m[1] && !m[2])) return ""; const n = (+(m[1] || 0)) * 60 + (+(m[2] || 0)); return n ? (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ""}` : `${n} min`) : ""; };

function findRecipe(node: any): any {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const x of node) { const r = findRecipe(x); if (r) return r; } return null; }
  const t = node["@type"]; if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
  return findRecipe(node["@graph"]) || findRecipe(node.mainEntity) || null;
}
function steps(ins: any): string[] {
  const out: string[] = [];
  const walk = (x: any) => { if (!x) return; if (typeof x === "string") { clean(x).split(/\n+/).forEach(s => s && out.push(s)); return; } if (Array.isArray(x)) return x.forEach(walk);
    if (x["@type"] === "HowToSection" || x.itemListElement) return walk(x.itemListElement); if (x.text || x.name) out.push(clean(x.text || x.name)); };
  walk(ins); return out.filter(Boolean).slice(0, 40);
}
function fromLd(r: any, url: string): Recipe {
  const y = Array.isArray(r.recipeYield) ? r.recipeYield.find((v: any) => /\d/.test(String(v))) || r.recipeYield[0] : r.recipeYield;
  return { title: clean(r.name).slice(0, 120), servings: clean(y).slice(0, 30), prep_time: isoMins(r.totalTime || r.cookTime || r.prepTime),
    ingredients: (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).slice(0, 60).map(splitIng).filter((i: Ing) => i.name), steps: steps(r.recipeInstructions), url, source: "link" };
}

// Only public web addresses: never this server's own network.
function safeUrl(u: string): URL | null {
  let x: URL; try { x = new URL(u); } catch { return null; }
  if (!/^https?:$/.test(x.protocol)) return null;
  const h = x.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":") || h.startsWith("[")) return null;
  return x;
}
async function getPage(u: URL) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(u.href, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (Skylike family recipe box)", "Accept": "text/html" } });
    if (!r.ok) throw new Error(`That page answered ${r.status}.`);
    if (r.url && !safeUrl(r.url)) throw new Error("That link redirects somewhere we can't open.");
    const reader = r.body!.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 3_000_000) { ctrl.abort(); break; } chunks.push(value); }
    const all = new Uint8Array(size > 3_000_000 ? chunks.reduce((a, c) => a + c.length, 0) : size); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
    return new TextDecoder().decode(all);
  } finally { clearTimeout(t); }
}

const API = "https://generativelanguage.googleapis.com/v1beta";
// Free-tier Gemini gets "high demand" (503) spells. Try several Flash models (each one a second time after a pause),
// within a time budget, and only then give a plain message.
const listCache = new Map<string, { list: string[]; at: number }>();
async function flashModels(key: string): Promise<string[]> {
  const c = listCache.get(key); if (c && Date.now() - c.at < 6 * 3600e3) return c.list;
  let names: string[] = [];
  try {
    const d = await (await fetch(`${API}/models?pageSize=200&key=${encodeURIComponent(key)}`)).json();
    names = (d.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m: any) => String(m.name).replace(/^models\//, ""))
      .filter((n: string) => /flash/.test(n) && !/image|tts|live|audio|embed|exp|preview/.test(n));
  } catch { /* use the aliases below */ }
  const ver = (n: string) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0");
  const full = names.filter(n => !/lite/.test(n) && !/latest/.test(n)).sort((a, b) => ver(b) - ver(a)).slice(0, 1);
  const lite = names.filter(n => /lite/.test(n) && !/latest/.test(n)).sort((a, b) => ver(b) - ver(a)).slice(0, 1);
  const list = [...new Set(["gemini-flash-latest", ...full, "gemini-flash-lite-latest", ...lite])];
  listCache.set(key, { list, at: Date.now() }); return list;
}
async function gemini(key: string, prompt: string, images: string[] = []) {
  const parts: any[] = [{ text: prompt }, ...images.map(d => ({ inline_data: { mime_type: "image/jpeg", data: d } }))];
  const t0 = Date.now(), budget = 125000; let last = "", busy = false;
  for (const model of await flashModels(key)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = budget - (Date.now() - t0); if (left < 8000) break;
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), Math.min(left, images.length ? 50000 : 40000));
      try {
        const call = (thinking: boolean) => fetch(`${API}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, ...(thinking ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}) } }) });
        let r = await call(true); if (r.status === 400 && /thinking/i.test(await r.clone().text())) r = await call(false);
        const d = await r.json().catch(() => ({}));
        console.log(JSON.stringify({ model, attempt, ms: Date.now() - t0, status: r.status, err: d?.error?.message?.slice(0, 120) }));
        if (r.status === 429) { last = "limit"; break; }
        if (r.status === 503 || r.status === 500 || r.status === 404) { busy = true; if (attempt === 0 && r.status !== 404) { await new Promise(z => setTimeout(z, 2000)); continue; } break; }
        if (!r.ok) { last = d?.error?.message || "busy"; break; }
        const text = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}";
        return JSON.parse(text.replace(/^```json\s*|```$/g, ""));
      } catch (e) { last = (e as Error).name === "AbortError" ? "slow" : "unreadable"; break; }
      finally { clearTimeout(t); }
    }
  }
  throw new Error(last === "limit" && !busy ? "Today's free AI limit is used up for now. Try again later."
    : busy ? "Google's free AI is very busy right now. Wait a minute and tap Try again."
    : last === "slow" ? "The AI took too long. Try again, or take the photo a little closer." : "The AI couldn't read that. Try again in a minute.");
}
const ASK = `Return JSON: {"title":"","servings":"","prep_time":"","ingredients":[{"qty":"2 cups","name":"plain flour","group":""}],"steps":["..."]}. Keep the recipe's own words and amounts; Australian names are fine. Leave out anything that isn't the recipe. If there's no recipe, return {"title":""}.`;
const tidy = (o: any, source: string, url?: string): Recipe => ({ title: clean(o.title).slice(0, 120), servings: clean(o.servings).slice(0, 30), prep_time: clean(o.prep_time).slice(0, 30), url, source,
  ingredients: (Array.isArray(o.ingredients) ? o.ingredients : []).slice(0, 60).map((i: any) => typeof i === "string" ? splitIng(i) : { qty: clean(i.qty).slice(0, 40), name: clean(i.name).slice(0, 120), ...(i.group ? { group: clean(i.group).slice(0, 40) } : {}) }).filter((i: Ing) => i.name),
  steps: (Array.isArray(o.steps) ? o.steps : []).map(clean).filter(Boolean).slice(0, 40) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({}));
  // server-only check that link import works (the scheduled-job secret, never sent to phones)
  const cron = req.headers.get("x-cron-secret");
  if (cron && body.url) {
    const { data: ap } = await admin.from("app_private").select("cron_secret").eq("id", 1).single();
    if (!ap || ap.cron_secret !== cron) return json({ error: "unauthorised" }, 401);
    const url = safeUrl(String(body.url)); if (!url) return json({ error: "bad url" }, 400);
    try { const html = await getPage(url); for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { const r = findRecipe(JSON.parse(m[1].trim())); if (r) return json({ recipe: fromLd(r, url.href) }); } catch { /* next */ } } return json({ none: true, bytes: html.length }); }
    catch (e) { return json({ error: String((e as Error).message) }, 502); }
  }
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return json({ error: "Please sign in again" }, 401);
  const hid = String(body.household_id || "");
  const { data: m } = await admin.from("memberships").select("user_id").eq("household_id", hid).eq("user_id", u.user.id).maybeSingle();
  if (!m) return json({ error: "not a member" }, 403);
  const key = async () => { const { data } = await admin.from("household_private").select("ai_key").eq("household_id", hid).maybeSingle(); if (!data?.ai_key) throw new Error("Reading photos and text needs the free Gemini key (Settings, Kitchen)."); return data.ai_key as string; };
  try {
    if (body.url) {
      const url = safeUrl(String(body.url).trim()); if (!url) return json({ error: "That doesn't look like a web link." }, 400);
      const html = await getPage(url);
      for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try { const r = findRecipe(JSON.parse(m[1].trim())); if (r) { const out = fromLd(r, url.href); if (out.title && out.ingredients.length) return json({ recipe: out }); } } catch { /* a broken block: try the next */ }
      }
      // no structured recipe on the page: let the AI read the page text
      const text = clean(html.replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")).slice(0, 14000);
      const out = tidy(await gemini(await key(), `This is the text of a recipe web page. Pull out the recipe. ${ASK}\nPage: """${text}"""`), "link", url.href);
      return out.title ? json({ recipe: out }) : json({ error: "Couldn't find a recipe on that page." }, 422);
    }
    if (body.write && body.write.title) { // write a method for a planned dinner that has no recipe page, using its own ingredients
      const t = clean(body.write.title).slice(0, 120), serves = clean(body.write.servings).slice(0, 20);
      const ings = (Array.isArray(body.write.ingredients) ? body.write.ingredients : []).slice(0, 40).map((i: any) => `${clean(i.qty)} ${clean(i.name)}`.trim()).filter(Boolean).join("\n");
      const out = tidy(await gemini(await key(), `Write a simple, reliable home recipe for "${t}"${serves ? ` to serve ${serves}` : " for a family of four"} in Perth, Australia. ${ings ? `Use these ingredients and amounts (add pantry basics like oil, salt and pepper if needed):\n${ings}\n` : ""}Give clear steps a busy parent can follow: one action per step, with times, and oven temperatures in Celsius. Keep the title "${t}". ${ASK}`), "ai");
      if (!out.title) out.title = t;
      return out.steps.length ? json({ recipe: out }) : json({ error: "Couldn't write that one. Try again in a minute." }, 422);
    }
    if (Array.isArray(body.receipt) && body.receipt.length) { // a shopping receipt: what each line cost
      const imgs = body.receipt.slice(0, 3).map(String);
      if (imgs.reduce((a: number, x: string) => a + x.length, 0) > 12_000_000) return json({ error: "Those photos are too big. Try fewer." }, 400);
      const o = await gemini(await key(), `These photos show one shopping receipt (several photos may be parts of one long receipt). Return JSON: {"store":"shop name, e.g. Woolworths","date":"YYYY-MM-DD or empty","total":0,"items":[{"name":"plain everyday name with size, e.g. Milk 2L","qty":"count or weight if more than one","price":0,"place":"fridge, freezer or pantry for food and drink; empty for anything that isn't food"}]}. List EVERY item line in every photo, top to bottom (a big shop can have 60+ lines); never stop early, skip lines or summarise. Some photos may show only part of the receipt, e.g. just the bottom with the total: return whatever lines are visible. price is what was paid for that line after any discount on it. total is the amount actually paid. Leave out bags, subtotals, GST, rewards, savings summaries and payment lines. If it isn't a receipt, return {"total":0,"items":[]}.`, imgs);
      const num = (v: unknown) => { const n = Math.round(parseFloat(String(v ?? "").replace(/[^\d.\-]/g, "")) * 100) / 100; return isFinite(n) && n >= 0 && n < 100000 ? n : 0; };
      const items = (Array.isArray(o.items) ? o.items : []).slice(0, 120).map((i: any) => ({ name: clean(i.name).slice(0, 60), qty: clean(i.qty).slice(0, 20), price: num(i.price), ...(["fridge", "freezer", "pantry"].includes(String(i.place)) ? { place: String(i.place) } : {}) })).filter((i: any) => i.name);
      const total = num(o.total) || Math.round(items.reduce((a: number, i: any) => a + i.price, 0) * 100) / 100;
      if (!total && !items.length) return json({ error: "Couldn't read a receipt in that photo. Try a flatter, closer shot." }, 422);
      return json({ receipt: { store: clean(o.store).slice(0, 60), day: /^\d{4}-\d{2}-\d{2}$/.test(String(o.date)) ? String(o.date) : "", total, items } });
    }
    if (Array.isArray(body.images) && body.images.length) {
      const imgs = body.images.slice(0, 4).map(String);
      if (imgs.reduce((a: number, x: string) => a + x.length, 0) > 12_000_000) return json({ error: "Those photos are too big. Try fewer." }, 400);
      const out = tidy(await gemini(await key(), `These photos show a recipe: a cookbook page, a handwritten card or a screenshot (several photos may be pages of one recipe). ${ASK}`, imgs), "photo");
      return out.title ? json({ recipe: out }) : json({ error: "Couldn't read a recipe in that photo. Try a closer, flatter shot." }, 422);
    }
    if (body.text) {
      const out = tidy(await gemini(await key(), `Tidy this recipe someone typed or pasted. ${ASK}\nText: """${String(body.text).slice(0, 8000)}"""`), "typed");
      return out.title ? json({ recipe: out }) : json({ error: "Couldn't find a recipe in that text." }, 422);
    }
    return json({ error: "Send a link, a photo, a receipt or some text." }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
