// KI-Aufrufe: entweder über den eigenen Server (api/*) oder direkt aus dem Browser
// an Gemini (für GitHub Pages / iPhone, wo kein eigener Server läuft).
import { getState } from "./store.js";
import { storySystem, storyPrompt, wordsSystem, generateWordsPrompt, fillWordPrompt, extractJson } from "./prompts.js";
import { L, langName } from "./langs.js";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

function base() {
  return (getState().settings.apiBase || "").trim().replace(/\/$/, "");
}

function headers() {
  const s = getState().settings;
  const h = { "content-type": "application/json" };
  if (s.appSecret) h["x-app-key"] = s.appSecret;
  return h;
}

// Ohne eigenen Server (z. B. GitHub Pages) geht nur der Browser-Modus
export function isStaticHost() {
  return /github\.io$/i.test(location.hostname);
}

// Im Browser-Modus (GitHub Pages, iPhone) spricht die App direkt mit der KI:
// 1. mit deinem eigenen Gemini-Key (falls eingetragen) – mit Ersatzmodellen,
// 2. sonst / bei Überlastung über einen kostenlosen Dienst ohne Key (Pollinations).
export function usesBrowserGemini() {
  const s = getState().settings;
  if (s.provider === "browser" || s.provider === "free") return true;
  return s.provider === "auto" && isStaticHost() && !s.apiBase;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"];

async function geminiOnce(model, system, user, maxTokens, key) {
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: Math.max(maxTokens * 3, 8192), responseMimeType: "application/json" },
        }),
      }
    );
  } catch {
    const e = new Error("Gemini nicht erreichbar");
    e.retry = true;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error("Gemini: " + (data?.error?.message || `Fehler ${res.status}`));
    e.status = res.status;
    e.retry = res.status === 429 || res.status >= 500 || res.status === 404;
    throw e;
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  if (!text) {
    const e = new Error("Gemini hat keinen Text geliefert");
    e.retry = true;
    throw e;
  }
  return text;
}

async function geminiDirect(system, user, maxTokens) {
  const s = getState().settings;
  const models = [s.geminiModel, ...GEMINI_MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  let last;
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await geminiOnce(m, system, user, maxTokens, s.geminiKey);
      } catch (e) {
        last = e;
        if (!e.retry) throw e; // z. B. ungültiger Key → nicht weiter probieren
        if (e.status === 404) break; // Modell gibt es nicht → nächstes Modell
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  throw last;
}

// Kostenloser KI-Dienst ohne Anmeldung und ohne Key (pollinations.ai)
async function freeAI(system, user) {
  const ref = "wortwerk";
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://text.pollinations.ai/openai?referrer=${ref}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          referrer: ref,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const text = data?.choices?.[0]?.message?.content;
        if (text) return text;
      }
      last = new Error(`Kostenloser KI-Dienst: Fehler ${res.status}`);
    } catch {
      last = new Error("Kostenloser KI-Dienst nicht erreichbar");
    }
    // zweiter Weg: einfache GET-Schnittstelle
    try {
      const url =
        `https://text.pollinations.ai/${encodeURIComponent(user)}` +
        `?system=${encodeURIComponent(system)}&model=openai&json=true&referrer=${ref}`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes("{")) return text;
      }
      last = new Error(`Kostenloser KI-Dienst: Fehler ${res.status}`);
    } catch {
      last = new Error("Kostenloser KI-Dienst nicht erreichbar");
    }
    await sleep(16000); // Gratis-Dienst erlaubt ca. eine Anfrage pro 15 Sekunden
  }
  throw last;
}

async function browserLLM(system, user, maxTokens) {
  const s = getState().settings;
  const errors = [];
  if (s.geminiKey && s.provider !== "free") {
    try {
      return await geminiDirect(system, user, maxTokens);
    } catch (e) {
      errors.push(e.message);
      if (e.status === 400 || e.status === 403) {
        // Key ungültig → trotzdem kostenlos weiterprobieren
      }
    }
  }
  try {
    return await freeAI(system, user);
  } catch (e) {
    errors.push(e.message);
  }
  throw new Error(errors.join(" · ") + " – bitte in einer Minute erneut versuchen oder den manuellen Weg nutzen.");
}

function cleanCard(w) {
  if (!w || typeof w.en !== "string" || !w.en.trim()) return null;
  return {
    en: w.en.trim().slice(0, 60),
    de: String(w.de || "").slice(0, 160),
    pos: String(w.pos || "").slice(0, 12),
    level: LEVELS.includes(w.level) ? w.level : "B2",
    topic: String(w.topic || "alltag").slice(0, 20),
    ex: String(w.ex || "").slice(0, 300),
    exDe: String(w.exDe || "").slice(0, 300),
    note: String(w.note || "").slice(0, 200),
    rd: String(w.rd || "").slice(0, 80),
  };
}

async function browserCall(path, body) {
  if (path === "story") {
    const level = LEVELS.includes(body.level) ? body.level : "B2";
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const lang = langName(body.lang);
        const text = await browserLLM(storySystem(lang), storyPrompt(body.words, level, body.theme || "", body.known || [], lang), 5000);
        const data = extractJson(text);
        if (!data.text) throw new Error("Antwort ohne Text");
        return data;
      } catch (e) {
        lastErr = e;
        break; // browserLLM probiert intern bereits mehrere Wege
      }
    }
    throw new Error("Geschichte konnte nicht erstellt werden: " + lastErr.message);
  }
  if (path === "words") {
    const prompt =
      body.mode === "fill"
        ? fillWordPrompt({ en: body.en, de: body.de || "", lang: langName(body.lang) })
        : generateWordsPrompt({
            level: LEVELS.includes(body.level) ? body.level : "B2",
            topic: body.topic || "",
            count: Math.min(20, Math.max(1, Number(body.count) || 10)),
            exclude: body.exclude || [],
            lang: langName(body.lang),
          });
    const data = extractJson(await browserLLM(wordsSystem(langName(body.lang)), prompt, 4000));
    const list = Array.isArray(data) ? data : data.words || (data.en ? [data] : []);
    const words = list.map(cleanCard).filter(Boolean);
    if (!words.length) throw new Error("Die KI hat keine gültigen Karten geliefert. Bitte erneut versuchen.");
    return { words };
  }
  throw new Error("Unbekannte Anfrage");
}

// ---------- Öffentliche Funktionen ----------

export async function callApi(path, body) {
  body = { ...body, lang: L().en };
  if (usesBrowserGemini()) return browserCall(path, body);
  const s = getState().settings;
  const payload = { ...body, provider: s.provider || "auto", model: s.provider === "ollama" ? s.ollamaModel || "" : "" };
  let res;
  try {
    res = await fetch(`${base()}/api/${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error(
      isStaticHost()
        ? "Auf GitHub Pages gibt es keinen eigenen Server. Wähle unter Einstellungen → KI-Server „Gemini direkt im Browser“ und trage deinen Gemini-Key ein."
        : "Server nicht erreichbar. Läuft die App über `node server.js`?"
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404 && isStaticHost())
      throw new Error("Auf GitHub Pages gibt es keinen eigenen Server. Wähle unter Einstellungen → KI-Server „Gemini direkt im Browser“ und trage deinen Gemini-Key ein.");
    throw new Error(data.error || `Serverfehler (${res.status})`);
  }
  return data;
}

export async function health() {
  if (usesBrowserGemini()) {
    const s = getState().settings;
    if (!s.geminiKey || s.provider === "free")
      return { browser: true, ok: true, message: "Kostenlose KI ohne Key (pollinations.ai) – wird beim Erstellen genutzt." };
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
      headers: { "x-goog-api-key": s.geminiKey },
    }).catch(() => null);
    if (!res) return { browser: true, ok: false, message: "Gemini nicht erreichbar." };
    const data = await res.json().catch(() => ({}));
    return res.ok
      ? { browser: true, ok: true, message: `Gemini direkt im Browser · ${s.geminiModel || "gemini-flash-latest"}` }
      : { browser: true, ok: false, message: "Gemini: " + (data?.error?.message || `Fehler ${res.status}`) };
  }
  const res = await fetch(`${base()}/api/health`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Serverfehler (${res.status})`);
  return data;
}

// Prüft und bereinigt eine Geschichte (vom Server oder manuell eingefügt)
export function normalizeStory(data, words) {
  if (!data || typeof data.text !== "string" || !data.text.trim()) {
    throw new Error("Die Antwort enthält keinen Geschichtentext.");
  }
  const questions = Array.isArray(data.questions)
    ? data.questions
        .filter((q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2)
        .map((q) => ({
          q: String(q.q),
          options: q.options.map(String).slice(0, 4),
          answer: Math.min(Math.max(0, Number(q.answer) || 0), Math.min(3, q.options.length - 1)),
        }))
    : [];
  const glossary = {};
  for (const g of data.glossary || []) if (g?.en) glossary[g.en.toLowerCase()] = String(g.de || "");
  for (const w of words) if (!glossary[w.en.toLowerCase()]) glossary[w.en.toLowerCase()] = w.de;
  const readings = {};
  for (const g of data.glossary || []) if (g?.en && g.rd) readings[g.en.toLowerCase()] = String(g.rd);
  // Sätze mit Wort-für-Wort-Übersetzung (Birkenbihl) und freier Übersetzung
  const sentences = Array.isArray(data.sentences)
    ? data.sentences
        .filter((x) => x && typeof x.t === "string" && x.t.trim())
        .map((x, i) => ({ t: x.t.trim(), wfw: String(x.wfw || ""), de: String(x.de || ""), p: i === 0 || !!x.p }))
    : [];
  return {
    id: "s-" + Date.now().toString(36),
    createdAt: Date.now(),
    title: String(data.title || "Ohne Titel"),
    text: data.text.trim(),
    questions,
    glossary,
    readings,
    sentences,
    wordIds: words.map((w) => w.id),
    words: words.map((w) => ({ id: w.id, en: w.en, de: w.de })),
    quizScore: null,
    clozeScore: null,
  };
}

// ---------- KI-Gespräch (Rollenspiel) ----------
// history: [{role:"user"|"ai", text}] – liefert {reply, de, correction}
export async function chatTurn({ scenario, level, words = [], history = [] }) {
  const lang = L().en;
  const system =
    `You are a friendly conversation partner for a German native speaker learning ${lang} (CEFR ${level}). ` +
    `Role-play this situation and stay in role: ${scenario}. Speak ONLY ${lang} in "reply", in short natural turns (1–3 sentences, CEFR ${level}), ` +
    `and end most turns with a question to keep the conversation going. ` +
    (words.length ? `Where natural, use some of these words the learner is practising: ${words.join(", ")}. ` : "") +
    `Reply with valid JSON only: {"reply":"<your turn in ${lang}>","de":"<German translation of your turn>","correction":"<if the learner's last message had mistakes: short friendly German explanation with the corrected ${lang} sentence; otherwise empty string>"}`;
  const transcript = history.length
    ? history.map((m) => `${m.role === "user" ? "Learner" : "You"}: ${m.text}`).join("\n")
    : "(The conversation starts now. Open the scene with a short greeting and a question.)";
  const text = await browserLLM(system, transcript, 700);
  const d = extractJson(text);
  return { reply: String(d.reply || ""), de: String(d.de || ""), correction: String(d.correction || "") };
}
