// Skylike AI helper (Gemini, the household's own free key, kept server-side).
// Signed-in member: { household_id, action, ... }
// actions: test | groceries | pantry_photo | plan | budget | recipe | brief | event_parse | speak
// Backup: if Gemini is out (limit, busy, slow) and the household saved a free OpenRouter key, the same request goes to a free OpenRouter model.
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
// Free-tier daily limits differ a lot by model (Flash can be as low as 20 a day). Once a model says it's out, skip it until it resets.
const outUntil = new Map<string, number>();
async function gemini(key: string, prompt: string, image?: { data: string; mime: string } | { data: string; mime: string }[], opts: { timeout?: number; level?: string } = {}) {
  const lite = "gemini-flash-lite-latest";
  // Lite twice (it's occasionally slow, a retry usually lands fast), then the full Flash model.
  const models = [lite, lite, await pickModel(key)].filter((m, i, a) => m === lite || a.indexOf(m) === i);
  const parts: any[] = [{ text: prompt }];
  const imgs = image ? (Array.isArray(image) ? image : [image]) : [];
  imgs.forEach(im => parts.push({ inline_data: { mime_type: im.mime || "image/jpeg", data: im.data } }));
  let lastErr = "", slow = false;
  for (const model of models) {
    const ok = outUntil.get(key + model); if (ok && ok > Date.now()) { lastErr = lastErr || "limit"; continue; }
    const t0 = Date.now();
    const call = (thinking: boolean) => {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), model.includes("lite") ? (imgs.length === 1 ? 30000 : 45000) : (imgs.length ? 50000 : Math.min(opts.timeout || 60000, 50000)));
      const generationConfig: any = { responseMimeType: "application/json", temperature: 0.4 };
      if (thinking) generationConfig.thinkingConfig = { thinkingLevel: model.includes("lite") ? "minimal" : (opts.level || "minimal") };
      return fetch(`${API}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
      }).finally(() => clearTimeout(t));
    };
    let r: Response;
    try { r = await call(true); if (r.status === 400) { const peek = await r.clone().text(); if (/thinking/i.test(peek)) r = await call(false); } }
    catch { console.log(JSON.stringify({ model, ms: Date.now() - t0, timeout: true })); lastErr = "slow"; slow = true; continue; }
    const d = await r.json().catch(() => ({}));
    console.log(JSON.stringify({ model, ms: Date.now() - t0, status: r.status, usage: d?.usageMetadata, err: d?.error?.message }));
    if (r.status === 429) {
      const msg = String(d?.error?.message || ""), wait = msg.match(/retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/);
      if (/per day/i.test(msg)) outUntil.set(key + model, Date.now() + (wait ? ((+wait[1] || 0) * 3600 + (+wait[2] || 0) * 60 + (+wait[3] || 0)) * 1000 : 3600e3));
      lastErr = slow ? "slow" : "limit"; continue;
    }
    if (r.status === 404 || r.status >= 500) { lastErr = d?.error?.message || "busy"; continue; }
    if (!r.ok) throw new Error(d?.error?.message || "AI request failed");
    const text = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}";
    try { return { model, out: JSON.parse(text.replace(/^```json\s*|```$/g, "")) }; } catch { lastErr = "unreadable"; continue; }
  }
  throw new Error(lastErr === "limit" ? "Today's free AI limit is used up for now. Try again in a few minutes."
    : lastErr === "slow" ? (imgs.length ? "The AI took too long to read that photo. Try again, or take it a little further back." : "The AI took too long to answer. Try again in a moment.")
    : lastErr === "unreadable" ? "The AI reply couldn't be read. Try again." : "Google's AI is busy right now. Try again in a minute.");
}


// ---- Backup AI: OpenRouter's free models (the household's own free key) ----
const ORAPI = "https://openrouter.ai/api/v1";
let orModels: { list: any[]; at: number } | null = null;
async function orFree(needImage: boolean): Promise<string[]> {
  if (!orModels || Date.now() - orModels.at > 6 * 3600e3) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
    try { const r = await fetch(`${ORAPI}/models`, { signal: ctrl.signal }); const d = await r.json(); orModels = { list: d.data || [], at: Date.now() }; }
    catch { orModels = orModels || { list: [], at: 0 }; } finally { clearTimeout(t); }
  }
  const free = orModels.list.filter((m: any) => String(m.id).endsWith(":free") || (m.pricing && +m.pricing.prompt === 0 && +m.pricing.completion === 0 && !/^openrouter\/auto/.test(m.id)));
  const img = (m: any) => (m.architecture?.input_modalities || []).includes("image") || /vision|vl\b|-vl|gemma-3|llama-4|gemini|mistral-small-3/i.test(m.id);
  const pref = [/gemini/i, /llama-4/i, /qwen.*(vl|2\.5|3)/i, /mistral-small/i, /gemma-3/i, /deepseek-(chat|v3)/i, /llama-3\.3-70b/i, /gpt-oss/i];
  const rank = (m: any) => { const i = pref.findIndex(r => r.test(m.id)); return i < 0 ? 99 : i; };
  return free.filter((m: any) => !needImage || img(m)).filter((m: any) => !/r1\b|thinking|reason/i.test(m.id) || !needImage)
    .sort((a: any, b: any) => rank(a) - rank(b) || (b.context_length || 0) - (a.context_length || 0)).map((m: any) => m.id).slice(0, 4);
}
function parseLoose(text: string) {
  text = String(text || ""); const t = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try { return JSON.parse(t); } catch {}
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error("unreadable");
}
async function openrouter(key: string, prompt: string, image?: any, opts: { timeout?: number } = {}) {
  const imgs = image ? (Array.isArray(image) ? image : [image]) : [];
  const models = await orFree(imgs.length > 0);
  if (!models.length) throw new Error(imgs.length ? "The backup AI has no free photo model right now." : "The backup AI has no free model right now.");
  const content: any[] = [{ type: "text", text: prompt + "\nReply with JSON only." }];
  imgs.forEach((im: any) => content.push({ type: "image_url", image_url: { url: `data:${im.mime || "image/jpeg"};base64,${im.data}` } }));
  let lastErr = "busy";
  for (const model of models) {
    const t0 = Date.now();
    for (const fmt of [true, false]) {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), Math.min(opts.timeout || 60000, 55000));
      try {
        const r = await fetch(`${ORAPI}/chat/completions`, {
          method: "POST", signal: ctrl.signal,
          headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://joshmott89-sys.github.io/Skylike/", "X-Title": "Skylike" },
          body: JSON.stringify({ model, temperature: 0.4, messages: [{ role: "user", content }], ...(fmt ? { response_format: { type: "json_object" } } : {}) }),
        });
        const d = await r.json().catch(() => ({}));
        console.log(JSON.stringify({ or: model, fmt, ms: Date.now() - t0, status: r.status, err: d?.error?.message }));
        if (r.status === 401 || r.status === 403) throw new Error("That OpenRouter key wasn't accepted. Check it in Settings → Kitchen.");
        if (r.status === 400 && fmt) continue; // model doesn't do JSON mode: ask again plainly
        if (!r.ok) { lastErr = r.status === 429 ? "limit" : "busy"; break; }
        const text = d?.choices?.[0]?.message?.content || "";
        try { return { model: "openrouter:" + model, out: parseLoose(text) }; } catch { lastErr = "unreadable"; break; }
      } catch (e) {
        if (/wasn't accepted/.test(String((e as Error).message))) throw e;
        lastErr = "slow"; break;
      } finally { clearTimeout(t); }
    }
  }
  throw new Error(lastErr === "limit" ? "Both free AIs are at their limit for now. Try again later." : lastErr === "slow" ? "The AI took too long to answer. Try again in a moment." : "The AI is busy right now. Try again in a minute.");
}
// Gemini first; if it can't answer (limit, slow, busy) and there's a backup key, hand the same request to OpenRouter.
async function askAI(keys: { g?: string; o?: string }, prompt: string, image?: any, opts: any = {}) {
  if (keys.g) {
    try { return await gemini(keys.g, prompt, image, opts); }
    catch (e) { if (!keys.o) throw e; console.log(JSON.stringify({ fallback: String((e as Error).message) })); }
  }
  if (keys.o) return await openrouter(keys.o, prompt, image, opts);
  throw new Error("Add a free Gemini key in Settings → Kitchen first.");
}


// ---- Natural voice: Gemini's speech models read the morning brief. Free tier is small (about 10 a day),
// so each brief is made once and saved; every screen in the family plays the same file. ----
const ttsCache = new Map<string, { list: string[]; at: number }>();
async function ttsModels(key: string): Promise<string[]> {
  const c = ttsCache.get(key); if (c && Date.now() - c.at < 6 * 3600e3) return c.list;
  const r = await fetch(`${API}/models?pageSize=200&key=${encodeURIComponent(key)}`); const d = await r.json();
  const ver = (n: string) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0");
  const list = (d.models || []).map((m: any) => String(m.name).replace(/^models\//, "")).filter((n: string) => /tts/.test(n) && !/pro/.test(n))
    .sort((a: string, b: string) => (Number(/lite/.test(a)) - Number(/lite/.test(b))) || ver(b) - ver(a));
  ttsCache.set(key, { list, at: Date.now() }); return list;
}
// Newer speech models send a whole WAV file (header first, a metadata block at the end), older ones send raw sound.
// Keep only the sound: reading the metadata as sound is what made the loud noise at the end.
function pcmOf(bytes: Uint8Array, rate: number) {
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (bytes.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") return { pcm: bytes, rate };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.length); let o = 12, r = rate;
  while (o + 8 <= bytes.length) {
    const id = tag(o), size = dv.getUint32(o + 4, true);
    if (id === "fmt ") r = dv.getUint32(o + 12, true) || r;
    if (id === "data") return { pcm: bytes.subarray(o + 8, Math.min(bytes.length, o + 8 + size)), rate: r };
    o += 8 + size + (size % 2);
  }
  return { pcm: bytes.subarray(44), rate: r };
}
// Smooth the edges: a short fade in, a gentle fade out and a little silence after, so speakers don't thump when it stops.
function soften(raw: Uint8Array, rate: number) {
  const n = Math.floor(raw.length / 2), src = new DataView(raw.buffer, raw.byteOffset, n * 2), tail = Math.round(rate * 0.25);
  const out = new Uint8Array((n + tail) * 2), dv = new DataView(out.buffer), fin = Math.min(n, Math.round(rate * 0.015)), fout = Math.min(n, Math.round(rate * 0.12));
  for (let i = 0; i < n; i++) {
    let g = 1; if (i < fin) g = i / fin; const left = n - 1 - i; if (left < fout) g = Math.min(g, left / fout);
    dv.setInt16(i * 2, Math.round(src.getInt16(i * 2, true) * g), true);
  }
  return out; // the tail stays zero: silence
}
function wav(pcm: Uint8Array, rate = 24000) {
  const h = new ArrayBuffer(44), v = new DataView(h), w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length); out.set(new Uint8Array(h), 0); out.set(pcm, 44); return out;
}
// Assistant personalities: a Gemini voice, how it speaks (director's notes, never read aloud) and how it writes the brief.
// Each has a female and a male Gemini voice (g = the one it uses until the person picks).
const PERSONAS: Record<string, { voices: { f: string; m: string }; g: "f" | "m"; speak: string; write: string; accent?: string }> = {
  sunny: { voices: { f: "Laomedeia", m: "Puck" }, g: "f", speak: "cheerful and upbeat, smiling as you speak", write: "bubbly and upbeat, warm, encouraging, a little playful, one light joke at most" },
  mate: { voices: { f: "Callirrhoe", m: "Zubenelgenubi" }, g: "m", speak: "relaxed and casual, like a laid-back Aussie mate", write: "a laid-back Australian mate: relaxed and friendly, a touch of Aussie slang (at most two words like reckon or arvo), keeps it real" },
  sass: { voices: { f: "Kore", m: "Orus" }, g: "f", speak: "dry and cheeky with a little attitude, warm underneath", write: "cheeky and a bit sassy, dry Aussie humour, playful teasing, still kind" },
  willow: { voices: { f: "Vindemiatrix", m: "Enceladus" }, g: "f", speak: "slow, gentle and calm, soft and reassuring", write: "calm, gentle and reassuring: short simple sentences, one thing at a time, never rushed" },
  news: { voices: { f: "Erinome", m: "Charon" }, g: "m", speak: "clear and brisk, like a friendly radio newsreader", write: "a matter-of-fact radio newsreader: brisk, clear, no fluff" },
  sterling: { voices: { f: "Despina", m: "Algieba" }, g: "m", accent: "a crisp, refined British accent", speak: "smooth, precise and composed, with dry understated wit", write: "a sleek, ultra-capable AI aide with a refined British manner: precise, composed, quietly anticipates needs, dry understated wit, phrases like 'departure advised' or 'I've taken the liberty', never gushing" },
  ambrose: { voices: { f: "Gacrux", m: "Sadaltager" }, g: "m", accent: "a warm, refined British accent", speak: "warm, mature and gently formal, kindly and unhurried", write: "a devoted old-school family butler: warm, wise and gently formal ('if you please', 'very good'), quietly looks out for everyone, offers one small sensible suggestion (a jacket, a hat, an early night), a touch of dry humour" },
  coach: { voices: { f: "Zephyr", m: "Sadachbia" }, g: "m", speak: "energetic and motivating, punchy and upbeat", write: "an energetic coach: motivating, short punchy sentences, celebrates small wins" },
};
const TONE_PERSONA: Record<string, string> = { bubbly: "sunny", sassy: "sass", plain: "news", calm: "willow" };
// The "hear this assistant" lines, word for word as in the app. Recorded ahead of time (both voices) so trying them out costs nothing.
const SAMPLES: Record<string, string> = {
  sunny: "Morning! Big day, but you've totally got this. Swimming's at nine, so let's get those hats on!",
  mate: "G'day. Pretty easy one today. Swimming at nine, bins out tonight, and that's about it, mate.",
  sass: "Rise and shine. Swimming's at nine, and no, the bins won't take themselves out tonight.",
  willow: "Good morning. Take a breath. First, swimming at nine. That's all you need to think about for now.",
  news: "Good morning. Swimming at nine. Lunchboxes to pack. Bins out tonight. Top of twenty-eight.",
  sterling: "Good morning. Swimming is at nine, so departure is advised by eight forty. Lunchboxes are pending, and the bins go out tonight.",
  ambrose: "Good morning. Swimming at nine, so do leave by twenty to, if you please. Lunches want packing, and I'd suggest a hat. It'll be warm.",
  coach: "Let's go! Swimming at nine, lunches packed by eight thirty. Three things today, and we'll smash every one.",
};
async function speak(key: string | undefined, hid: string, text: string, pid: string, gender = "", shared = false) {
  const P = PERSONAS[pid] || PERSONAS[TONE_PERSONA[pid]] || PERSONAS.sunny, voice = P.voices[gender === "f" || gender === "m" ? gender : P.g];
  const notes = `You are a voice actor reading a family's morning brief. Speak the text exactly as written, word for word, with ${P.accent || "a warm Australian accent"}: ${P.speak}. These are directions only: never say them out loud.`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("v4|" + voice + "|" + P.speak + "|" + text));
  const hash = [...new Uint8Array(digest)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
  const dir = shared ? "shared/samples" : `${hid}/brief`, path = `${dir}/${hash}.wav`, store = admin.storage.from("photos");
  const signed = async () => (await store.createSignedUrl(path, 12 * 3600)).data?.signedUrl;
  const { data: have } = await store.list(dir, { search: hash + ".wav" });
  if (have && have.length) return { url: await signed(), cached: true };
  if (shared) { // already recorded for this family before samples were shared: reuse it
    const { data: mine } = await store.list(`${hid}/brief`, { search: hash + ".wav" });
    if (mine && mine.length && !(await store.copy(`${hid}/brief/${hash}.wav`, path)).error) return { url: await signed(), cached: true };
  }
  if (!key) throw new Error("voice-nokey"); // not recorded yet, and no key to record it with
  let lastErr = "";
  for (const model of (await ttsModels(key)).slice(0, 3)) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      // Directions go in the system instruction so they shape the voice without being spoken. If a model won't take one, read it plainly.
      const call = (withNotes: boolean) => fetch(`${API}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(withNotes ? { systemInstruction: { parts: [{ text: notes }] } } : {}), contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
      });
      let r = await call(true);
      if (r.status === 400) { const peek = await r.clone().text(); console.log(JSON.stringify({ tts_notes_rejected: peek.slice(0, 160) })); r = await call(false); }
      const d = await r.json().catch(() => ({}));
      console.log(JSON.stringify({ tts: model, status: r.status, err: d?.error?.message?.slice(0, 120) }));
      if (!r.ok) { lastErr = r.status === 429 ? "limit" : "busy"; continue; }
      const part = (d?.candidates?.[0]?.content?.parts || []).find((p: any) => p.inlineData || p.inline_data);
      const b64 = (part?.inlineData || part?.inline_data)?.data; if (!b64) { lastErr = "busy"; continue; }
      const mime = String((part.inlineData || part.inline_data).mimeType || ""), rate = +((mime.match(/rate=(\d+)/) || [])[1] || 24000);
      const bin = atob(b64), raw = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
      const got = pcmOf(raw, rate); console.log(JSON.stringify({ tts_mime: mime, wavIn: got.pcm !== raw, rate: got.rate }));
      const up = await store.upload(path, wav(soften(got.pcm, got.rate), got.rate), { contentType: "audio/wav", upsert: true });
      if (up.error) throw new Error("couldn't save the audio");
      // tidy: keep only the last few days of briefs
      if (shared) return { url: await signed(), cached: false };
      const { data: old } = await store.list(`${hid}/brief`, { limit: 100, sortBy: { column: "created_at", order: "asc" } });
      const stale = (old || []).filter((f: any) => f.created_at && Date.now() - new Date(f.created_at).getTime() > 3 * 864e5).map((f: any) => `${hid}/brief/${f.name}`);
      if (stale.length) await store.remove(stale);
      return { url: await signed(), cached: false };
    } catch (e) { lastErr = (e as Error).name === "AbortError" ? "slow" : String((e as Error).message || "busy"); }
    finally { clearTimeout(t); }
  }
  throw new Error(lastErr === "limit" ? "voice-limit" : "voice-busy");
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
  // Record the assistant samples ahead of time (any missing ones, a few per call), using a household's own free key.
  if (cron && body.action === "samples") {
    const { data: ap } = await admin.from("app_private").select("cron_secret").eq("id", 1).single();
    if (!ap || ap.cron_secret !== cron) return json({ error: "unauthorised" }, 401);
    const { data: hk } = await admin.from("household_private").select("household_id, ai_key").not("ai_key", "is", null).order("household_id", { ascending: !!body.desc }).limit(1).maybeSingle();
    const t0 = Date.now(), out: any = { made: [], had: 0, left: [], err: "" };
    for (const pid of Object.keys(SAMPLES)) for (const g of ["f", "m"]) {
      if (out.err === "voice-limit" || Date.now() - t0 > 100e3) { out.left.push(`${pid}-${g}`); continue; }
      try { const r = await speak(hk?.ai_key, hk?.household_id || "", SAMPLES[pid], pid, g, true); if (r.cached) out.had++; else out.made.push(`${pid}-${g}`); }
      catch (e) { out.err = String((e as Error).message); out.left.push(`${pid}-${g}`); }
    }
    return json(out);
  }
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return json({ error: "Please sign in again" }, 401);
  const hid = body.household_id as string;
  const { data: m } = await admin.from("memberships").select("user_id").eq("household_id", hid).eq("user_id", u.user.id).maybeSingle();
  if (!m) return json({ error: "not a member" }, 403);
  const { data: hp } = await admin.from("household_private").select("ai_key, openrouter_key").eq("household_id", hid).maybeSingle();
  const keys = { g: hp?.ai_key || undefined, o: hp?.openrouter_key || undefined };
  const sampleOnly = body.action === "speak" && !!body.sample; // saved samples play for everyone, key or not
  if (!keys.g && !keys.o && !sampleOnly) return json({ error: "Add a free Gemini key in Settings → Kitchen first." }, 400);
  const ask = (p: string, img?: any, o?: any) => askAI(keys, p, img, o);

  try {
    const a = body.action;
    if (a === "test") {
      const out: any = { ok: true };
      if (keys.g) { try { out.model = await pickModel(keys.g); } catch (e) { out.ok = false; out.gemini = String((e as Error).message); } }
      if (keys.o) { try { const r = await fetch(`${ORAPI}/key`, { headers: { Authorization: `Bearer ${keys.o}` } }); out.backup = r.ok ? (await orFree(false))[0] || "none free" : "rejected"; if (!r.ok) out.ok = !!out.model; } catch { out.backup = "unreachable"; } }
      return json(out);
    }
    if (a === "brief") {
      const P = PERSONAS[String(body.persona || "")] || PERSONAS[TONE_PERSONA[String(body.tone || "")]], tone = P ? P.write : "warm and friendly";
      const { out } = await ask(`Write a spoken morning briefing for ${String(body.name || "the family").slice(0, 40)} in Perth, Australia. Tone: ${tone}.
It will be read aloud, so: plain sentences, no lists, no emoji, no markdown, times like "nine thirty" are fine as "9:30". 50 to 110 words. ${P && P.accent ? "British English" : "Australian English"}.
Lead with what needs doing first (leave times, lunches to pack, defrosting), then the rest of the day, then one nice thing to look forward to. Only use these facts, don't invent any: ${JSON.stringify(body.facts || {}).slice(0, 3500)}
Return JSON: {"text":"..."}`);
      return json({ text: String(out.text || "").slice(0, 1200) });
    }
    if (a === "speak") {
      if (!keys.g && !body.sample) return json({ error: "voice-nokey" }, 400);
      const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 1400);
      if (!text) return json({ error: "Nothing to read." }, 400);
      try { return json(await speak(keys.g, hid, text, String(body.persona || body.tone || "sunny"), String(body.gender || ""), !!body.sample)); }
      catch (e) { return json({ error: String((e as Error).message) }, 502); }
    }
    if (a === "event_parse") {
      const imgs = (Array.isArray(body.images) ? body.images : []).filter(Boolean).slice(0, 4).map((d: string) => ({ data: String(d), mime: "image/jpeg" }));
      const text = String(body.text || "").slice(0, 6000);
      if (!imgs.length && !text) return json({ error: "Nothing to read. Add a photo or some text." }, 400);
      const { out } = await ask(`${imgs.length ? "These photos show a flyer, invitation, school newsletter, letter or screenshot." : "This is something a parent said or pasted (a message, email or note)."} Pull out every event a family would put on their calendar.
Today is ${String(body.today || "").slice(0, 10)} (${String(body.weekday || "")}) in Perth, Australia. Resolve relative dates ("this Saturday", "next Tuesday", "the 14th") to real dates on or after today. If a year is missing, use the next time that date comes round.
Use 24-hour HH:MM times. If no time is given, set all_day true. If only a start time is given, leave end empty. For something that runs over several days (a camp, holiday, carnival week, pupil-free days 3-4 March), set date to the first day, last_date to the last day and all_day true; otherwise leave last_date empty. A list of term dates becomes one event per term ("Term 1"), spanning first to last day. Keep titles short and clear (e.g. "Mia's 5th birthday party", "Swimming lesson"). Put the venue or address in location. Put anything to remember (bring a hat, RSVP by, cost, dress-up theme) in notes, briefly.
${(body.people || []).length ? "Family members: " + JSON.stringify(body.people).slice(0, 400) + ". If an event is clearly for one of them, set who to that name." : ""}
${text ? 'Text: """' + text + '"""' : ""}
Return JSON: {"events":[{"title":"","date":"YYYY-MM-DD","last_date":"","start":"HH:MM","end":"","all_day":false,"location":"","notes":"","who":""}]} (empty list if there are none).`, imgs.length ? imgs : undefined, { timeout: 60000 });
      return json({ events: (out.events || []).slice(0, 30) });
    }

    if (a === "groceries") {
      const text = String(body.text || "").slice(0, 4000);
      const { out } = await ask(`Turn this Australian family's grocery brain-dump into a tidy shopping list.
Split it into separate items, fix spelling, use Australian names (capsicum, zucchini, mince), keep any quantity they gave, and drop chatter that isn't a grocery item.
Merge duplicates. Already on the list (don't repeat): ${JSON.stringify(body.existing || []).slice(0, 2000)}.
Give each an aisle from: ${AISLES}.
Return JSON: {"items":[{"name":"Milk","qty":"2 L","aisle":"Dairy & eggs"}]}
Brain-dump: """${text}"""`);
      return json({ items: (out.items || []).slice(0, 80) });
    }

    if (a === "pantry_photo") {
      const imgs = (Array.isArray(body.images) ? body.images : [body.image]).filter(Boolean).slice(0, 5).map((d: string) => ({ data: String(d), mime: "image/jpeg" }));
      if (!imgs.length) return json({ error: "No photo came through. Try again." }, 400);
      if (imgs.reduce((a: number, x: any) => a + x.data.length, 0) > 14_000_000) return json({ error: "Those photos are too big. Try fewer at once." }, 400);
      const { out } = await ask(`${imgs.length > 1 ? `These ${imgs.length} photos together show one family's ${body.place || "fridge or pantry"} (e.g. shelves, then each door). Treat them as one inventory and don't list an item twice just because it shows in two photos.` : `This is a photo of a family's ${body.place || "fridge or pantry"}.`} ${body.place === "freezer" ? "Freezers are hard to read: use the text and pictures on bags and boxes, the shape and colour of what's inside clear bags, and name each pack (e.g. \"Frozen peas\", \"Chicken thighs\", \"Fish fingers\", \"Ice cream\"). Look in every drawer and on the door. " : ""}List the food and drink items you can clearly identify, with a rough quantity (e.g. "half", "2", "1 bottle", "low").
Use short, plain Australian names (e.g. "Milk", "Tinned tuna", "Jalapenos"), no brand unless it is the product's common name. Mark items that look nearly finished as low. Skip anything you can't identify confidently. List each item once.
Already recorded (if an item is the same thing, use EXACTLY this name): ${JSON.stringify(body.existing || []).slice(0, 2500)}.
If you can see cooked leftovers (food in containers or covered bowls) and can reasonably tell what they are, list them as "Leftover <dish>" with leftover:true and a guess at portions (whole number). If you can't tell what a container holds, skip it.
Return JSON: {"items":[{"name":"Milk","qty":"half","place":"fridge","low":true},{"name":"Leftover spaghetti bolognese","place":"fridge","leftover":true,"portions":2}]} where place is one of fridge, freezer, pantry.`, imgs, { timeout: 90000 });
      return json({ items: (out.items || []).slice(0, 80) });
    }

    if (a === "plan") {
      const dates = (body.dates || []).slice(0, 7);
      const L = body.lunches;
      // lunches run alongside dinners (quick, Lite model), so they don't slow the plan down
      const lunchP = L && (L.dates || []).length ? ask(`Plan packed lunchboxes for these dates: ${JSON.stringify(L.dates.slice(0, 7))}. These are lunchbox ITEMS, not cooked meals: e.g. "Vegemite sandwich", "Apple slices", "Cheese stick", "Fruit roll-up", "Popcorn".
${L.who === "kids" ? `Kids' school lunchboxes in Perth, WA. Nut-free (school rules), no reheating, easy for small hands. Each box has these slots: "Crunch & Sip" (one piece of fruit or veg for the morning break), "Recess" (1-2 snacks), "Lunch" (the main, e.g. a sandwich, wrap, scroll, pasta salad, crackers & cheese), and optionally one "Treat".
The kids (plan one box per kid per day): ${JSON.stringify(L.kids || [{ name: "Kids" }]).slice(0, 1500)}.
They're picky: build each box MOSTLY from that kid's likes and the staples, repeat favourites freely across the week, NEVER include anything on their won't-eat list, and add at most ONE new item per kid per week (set "new":true on it).` : `One packed lunch per person for the family (${body.people || 4} people) on each date; use the box name "Everyone" and the slots "Lunch" and "Snack".`}
${L.staples ? "Staples that go in every box where they fit: " + String(L.staples).slice(0, 300) + ".\n" : ""}${(L.leftovers || []).length ? "Leftovers to use (each portion fills ONE box's Lunch slot, e.g. in a thermos; only for food that's fine cold or in a thermos), spread across days and boxes: " + JSON.stringify(L.leftovers).slice(0, 600) + ". Set leftover:true on that item.\n" : ""}Prefer what's already in the house: ${JSON.stringify(body.pantry || []).slice(0, 1200)}.
For each item, "buy" lists the plain grocery products it needs (e.g. Vegemite sandwich → ["Bread","Vegemite","Butter"]). Keep shopping small by reusing products. Estimate the AUD cost of each day's new purchases.
Return JSON: {"lunches":[{"day":"YYYY-MM-DD","boxes":[{"who":"Ruby","items":[{"slot":"Crunch & Sip","name":"Apple slices","buy":["Apples"],"new":false,"leftover":false}]}],"est_cost":4}]}`).then(r => r.out.lunches || []).catch(() => []) : Promise.resolve([]);
      if (!dates.length) return json({ meals: [], lunches: await lunchP });
      const { out } = await ask(`Plan family dinners. Cook on these dates (double=true means cook a DOUBLE batch so the next night is leftovers): ${JSON.stringify(dates)}.
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
      const { out } = await ask(`Give the main ingredients, with quantities for ${body.servings || 4} people, for the dish "${String(body.title || "").slice(0, 120)}" as made on RecipeTin Eats if it exists there, plus a fitting food emoji and an estimated AUD cost at Woolworths or Coles.
Return JSON: {"title":"...","emoji":"🍝","ingredients":[{"name":"...","qty":"..."}],"est_cost":15}`);
      return json(out);
    }

    if (a === "budget") {
      const { out } = await ask(`Estimate what these groceries would cost at Woolworths or Coles in Perth, Australia right now, using typical everyday (non-special) prices for a normal pack size, in AUD.
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
