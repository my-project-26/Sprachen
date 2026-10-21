import { callLLM, checkAuth, readBody, send, wrap, httpError, providerFrom } from "./_llm.js";
import { STORY_SYSTEM, storyPrompt, extractJson } from "../js/prompts.js";

export default wrap(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Nur POST erlaubt");
  checkAuth(req);
  const body = await readBody(req);
  const words = Array.isArray(body.words) ? body.words : [];
  const clean = words
    .filter((w) => w && typeof w.en === "string" && w.en.trim())
    .slice(0, 20)
    .map((w) => ({ en: w.en.trim().slice(0, 60), de: String(w.de || "").slice(0, 120) }));
  if (clean.length < 2) throw httpError(400, "Mindestens 2 Wörter nötig");
  const level = ["B1", "B2", "C1"].includes(body.level) ? body.level : "B2";
  const llm = providerFrom(body);

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callLLM(llm, STORY_SYSTEM, storyPrompt(clean, level), 2500);
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
