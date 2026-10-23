// Zweiter Schritt einer Geschichte: Sätze Wort für Wort (Birkenbihl) und frei übersetzen
import { callLLM, checkAuth, readBody, send, wrap, httpError, providerFrom } from "./_llm.js";
import { decodeSystem, decodePrompt, extractJson } from "../js/prompts.js";
import { langName } from "../js/langs.js";

export default wrap(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Nur POST erlaubt");
  checkAuth(req);
  const body = await readBody(req);
  const text = String(body.text || "").slice(0, 4000);
  if (text.trim().length < 10) throw httpError(400, "Kein Text");
  const lang = langName(body.lang);
  const out = await callLLM(providerFrom(body), decodeSystem(lang), decodePrompt(text, lang), 4000);
  const data = extractJson(out);
  const sentences = Array.isArray(data) ? data : data.sentences;
  if (!Array.isArray(sentences) || !sentences.length) throw httpError(502, "Keine Sätze erhalten");
  send(res, 200, { sentences });
});
