import { callLLM, checkAuth, readBody, send, wrap, httpError, providerFrom } from "./_llm.js";
import { STORY_SYSTEM, storyPrompt, extractJson } from "../js/prompts.js";

const cleanList = (list, max) =>
  (Array.isArray(list) ? list : [])
    .filter((w) => w && typeof w.en === "string" && w.en.trim())
    .slice(0, max)
    .map((w) => ({ en: w.en.trim().slice(0, 60), de: String(w.de || "").slice(0, 120) }));

export default wrap(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Nur POST erlaubt");
  checkAuth(req);
  const body = await readBody(req);
  const words = cleanList(body.words, 20);
  const known = cleanList(body.known, 8);
  if (words.length < 2) throw httpError(400, "Mindestens 2 Wörter nötig");
  const level = ["A1", "A2", "B1", "B2", "C1"].includes(body.level) ? body.level : "B2";
  const llm = providerFrom(body);
  const theme = String(body.theme || "").slice(0, 60);

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callLLM(llm, STORY_SYSTEM, storyPrompt(words, level, theme, known), 2500);
      const data = extractJson(text);
      if (!data.text) throw new Error("Antwort ohne Text");
      return send(res, 200, data);
    } catch (e) {
      lastErr = e;
      // Konfigurationsfehler (fehlender Key usw.) nicht wiederholen
      if (e.status === 500 || e.status === 401) break;
    }
  }
  throw httpError(lastErr?.status || 502, "Geschichte konnte nicht erstellt werden: " + (lastErr?.message || ""));
});
