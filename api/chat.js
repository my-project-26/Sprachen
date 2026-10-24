// KI-Gespräch: eine Antwort im Rollenspiel
import { callLLM, checkAuth, readBody, send, wrap, httpError, providerFrom } from "./_llm.js";
import { chatSystem, chatTranscript, saySystem, extractJson } from "../js/prompts.js";
import { langName } from "../js/langs.js";

// Gespräch braucht schnelle Antworten → kleines, flottes Modell (ohne langes „Nachdenken“)
const fast = (body) => ({ ...providerFrom(body), model: "gemini-flash-lite-latest" });

export default wrap(async (req, res) => {
  // Selbsttest im Browser: /api/chat → kurze Antwort der KI mit Zeitmessung
  if (req.method === "GET") {
    const t0 = Date.now();
    const sys = chatSystem({ scenario: "Casual small talk", level: "A2", lang: "English" });
    const d = extractJson(await callLLM(fast({}), sys, chatTranscript([]), 1000));
    return send(res, 200, { ok: true, sekunden: (Date.now() - t0) / 1000, antwort: d.reply, vorschlaege: d.suggestions });
  }
  if (req.method !== "POST") throw httpError(405, "Nur POST erlaubt");
  checkAuth(req);
  const body = await readBody(req);
  const level = ["A1", "A2", "B1", "B2", "C1"].includes(body.level) ? body.level : "B1";
  if (body.say) {
    const d = extractJson(await callLLM(fast(body), saySystem(langName(body.lang), level), String(body.say).slice(0, 300), 300));
    return send(res, 200, { t: String(d.t || "") });
  }
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-20)
    .map((m) => ({ role: m.role === "user" ? "user" : "ai", text: String(m.text || "").slice(0, 600) }));
  const sys = chatSystem({
    scenario: String(body.scenario || "Casual small talk").slice(0, 300),
    level,
    goal: String(body.goal || "").slice(0, 200),
    words: (Array.isArray(body.words) ? body.words : []).slice(0, 15).map((w) => String(w).slice(0, 40)),
    lang: langName(body.lang),
  });
  const d = extractJson(await callLLM(fast(body), sys, chatTranscript(history), 1000));
  send(res, 200, d);
});
