// KI-Aufrufe: entweder über den eigenen Server (api/*) oder direkt aus dem Browser
// an Gemini (für GitHub Pages / iPhone, wo kein eigener Server läuft).
import { getState } from "./store.js";
import {
  STORY_SYSTEM,
  storyPrompt,
  WORDS_SYSTEM,
  generateWordsPrompt,
  fillWordPrompt,
  extractJson,
} from "./prompts.js";

const LEVELS = ["B1", "B2", "C1"];

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

export function usesBrowserGemini() {
  const s = getState().settings;
  if (s.provider === "browser") return true;
  return s.provider === "auto" && isStaticHost() && !!s.geminiKey && !s.apiBase;
}

// ---------- Gemini direkt aus dem Browser ----------

async function geminiDirect(system, user, maxTokens) {
  const s = getState().settings;
  if (!s.geminiKey) throw new Error("Kein Gemini-Key hinterlegt (Einstellungen → KI-Server).");
  const model = s.geminiModel || "gemini-flash-latest";
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": s.geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: Math.max(maxTokens * 3, 8192), responseMimeType: "application/json" },
        }),
      }
    );
  } catch {
    throw new Error("Gemini nicht erreichbar – Internetverbindung prüfen.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Fehler ${res.status}`;
    throw new Error("Gemini: " + msg + (res.status === 429 ? " (Gratis-Kontingent erschöpft – später erneut versuchen)" : ""));
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  if (!text) throw new Error("Gemini hat keinen Text geliefert.");
  return text;
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
  };
}

async function browserCall(path, body) {
  if (path === "story") {
    const level = LEVELS.includes(body.level) ? body.level : "B2";
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await geminiDirect(STORY_SYSTEM, storyPrompt(body.words, level, body.theme || "", body.known || []), 2500);
        const data = extractJson(text);
        if (!data.text) throw new Error("Antwort ohne Text");
        return data;
      } catch (e) {
        lastErr = e;
        if (/Key|Kontingent/.test(e.message)) break;
      }
    }
    throw new Error("Geschichte konnte nicht erstellt werden: " + lastErr.message);
  }
  if (path === "words") {
    const prompt =
      body.mode === "fill"
        ? fillWordPrompt({ en: body.en, de: body.de || "" })
        : generateWordsPrompt({
            level: LEVELS.includes(body.level) ? body.level : "B2",
            topic: body.topic || "",
            count: Math.min(20, Math.max(1, Number(body.count) || 10)),
            exclude: body.exclude || [],
          });
    const data = extractJson(await geminiDirect(WORDS_SYSTEM, prompt, 4000));
    const list = Array.isArray(data) ? data : data.words || (data.en ? [data] : []);
    const words = list.map(cleanCard).filter(Boolean);
    if (!words.length) throw new Error("Die KI hat keine gültigen Karten geliefert. Bitte erneut versuchen.");
    return { words };
  }
  throw new Error("Unbekannte Anfrage");
}

// ---------- Öffentliche Funktionen ----------

export async function callApi(path, body) {
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
    if (!s.geminiKey) return { browser: true, ok: false, message: "Kein Gemini-Key eingetragen." };
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
  return {
    id: "s-" + Date.now().toString(36),
    createdAt: Date.now(),
    title: String(data.title || "Ohne Titel"),
    text: data.text.trim(),
    questions,
    glossary,
    wordIds: words.map((w) => w.id),
    words: words.map((w) => ({ id: w.id, en: w.en, de: w.de })),
    quizScore: null,
    clozeScore: null,
  };
}
