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

async function gemini(key: string, prompt: string, image?: { data: string; mime: string }) {
  const model = await pickModel(key);
  const parts: any[] = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: image.mime || "image/jpeg", data: image.data } });
  // Keep "thinking" short: these are quick sorting jobs, and long thinking made photo scans take over a minute.
  const call = (thinking: boolean) => {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 50000);
    const generationConfig: any = { responseMimeType: "application/json", temperature: 0.4 };
    if (thinking) generationConfig.thinkingConfig = { thinkingLevel: "low" };
    return fetch(`${API}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
    }).finally(() => clearTimeout(t));
  };
  let r: Response;
  try { r = await call(true); if (r.status === 400) { const peek = await r.clone().text(); if (/thinking/i.test(peek)) r = await call(false); } }
  catch { throw new Error("The AI took too long. Try again, or try a smaller photo."); }
  const d = await r.json();
  if (r.status === 429) throw new Error("The free AI limit is used up for now. Try again in a minute.");
  if (!r.ok) throw new Error(d?.error?.message || "AI request failed");
  const text = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}";
  try { return { model, out: JSON.parse(text.replace(/^```json\s*|```$/g, "")) }; } catch { throw new Error("The AI reply couldn't be read. Try again."); }
}

const AISLES = "Fruit & veg, Meat & seafood, Deli, Dairy & eggs, Bakery, Pantry, Frozen, Drinks, Snacks, Baby, Household, Health & beauty, Other";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({}));
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
Return JSON: {"items":[{"name":"Milk","qty":"half","place":"fridge","low":true}]} where place is one of fridge, freezer, pantry.`, { data: img, mime: body.mime || "image/jpeg" });
      return json({ items: (out.items || []).slice(0, 80) });
    }

    if (a === "plan") {
      const { out } = await gemini(key, `Plan family dinners for these dates: ${JSON.stringify(body.days || [])}.
Family: ${body.servings || 4} people including young kids. Preferences: ${String(body.prefs || "none given").slice(0, 600)}. Weekly food budget: ${body.budget ? "$" + body.budget + " AUD" : "keep it sensible"}.
Use recipes that exist on RecipeTin Eats (recipetineats.com) and give the recipe's real name as it appears there. Favour quick weeknight meals, use up what's already in: ${JSON.stringify(body.pantry || []).slice(0, 1500)}.
Avoid repeating these recent meals: ${JSON.stringify(body.recent || []).slice(0, 600)}.
For each, list the main ingredients with quantities for the family, and estimate the cost in AUD at Woolworths or Coles of the ingredients they'd need to buy.
Return JSON: {"meals":[{"day":"YYYY-MM-DD","title":"Chicken Chow Mein","emoji":"🍜","ingredients":[{"name":"Chicken thigh","qty":"500 g"}],"est_cost":18}]}`);
      return json({ meals: out.meals || [] });
    }

    if (a === "recipe") {
      const { out } = await gemini(key, `Give the main ingredients, with quantities for ${body.servings || 4} people, for the dish "${String(body.title || "").slice(0, 120)}" as made on RecipeTin Eats if it exists there, plus a fitting food emoji and an estimated AUD cost at Woolworths or Coles.
Return JSON: {"title":"...","emoji":"🍝","ingredients":[{"name":"...","qty":"..."}],"est_cost":15}`);
      return json(out);
    }

    if (a === "budget") {
      const { out } = await gemini(key, `Estimate what these groceries would cost at Woolworths or Coles in Perth, Australia right now, using typical everyday (non-special) prices for a normal pack size, in AUD.
Items: ${JSON.stringify(body.items || []).slice(0, 4000)}
Return JSON: {"total":85.5,"items":[{"name":"Milk","est":3.1}]}`);
      return json(out);
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
