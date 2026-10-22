import { callLLM, checkAuth, readBody, send, wrap, httpError, providerFrom } from "./_llm.js";
import { WORDS_SYSTEM, generateWordsPrompt, fillWordPrompt, extractJson } from "../js/prompts.js";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

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

export default wrap(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Nur POST erlaubt");
  checkAuth(req);
  const body = await readBody(req);

  let prompt;
  if (body.mode === "fill") {
    if (!body.en) throw httpError(400, "Wort fehlt");
    prompt = fillWordPrompt({ en: String(body.en).slice(0, 60), de: String(body.de || "").slice(0, 120) });
  } else {
    const count = Math.min(20, Math.max(1, Number(body.count) || 10));
    prompt = generateWordsPrompt({
      level: LEVELS.includes(body.level) ? body.level : "B2",
      topic: String(body.topic || "").slice(0, 80),
      count,
      exclude: Array.isArray(body.exclude) ? body.exclude.map(String) : [],
    });
  }

  const text = await callLLM(providerFrom(body), WORDS_SYSTEM, prompt, 4000);
  const data = extractJson(text);
  const list = Array.isArray(data) ? data : data.words || (data.en ? [data] : []);
  const words = list.map(cleanCard).filter(Boolean);
  if (!words.length) throw httpError(502, "Die KI hat keine gültigen Karten geliefert. Bitte erneut versuchen.");
  send(res, 200, { words });
});
