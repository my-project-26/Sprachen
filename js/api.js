// Aufrufe an den eigenen Server (api/*), der mit Claude spricht
import { getState } from "./store.js";

function base() {
  return (getState().settings.apiBase || "").trim().replace(/\/$/, "");
}

function headers() {
  const s = getState().settings;
  const h = { "content-type": "application/json" };
  if (s.appSecret) h["x-app-key"] = s.appSecret;
  return h;
}

export async function callApi(path, body) {
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
    throw new Error("Server nicht erreichbar. Läuft die App über Vercel oder `node server.js`?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Serverfehler (${res.status})`);
  return data;
}

export async function health() {
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
