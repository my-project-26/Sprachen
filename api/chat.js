// KI-Gespräch: eine Antwort im Rollenspiel
import { callLLM, checkAuth, readBody, send, wrap, httpError, providerFrom } from "./_llm.js";
import { chatSystem, chatTranscript, extractJson } from "../js/prompts.js";
import { langName } from "../js/langs.js";

export default wrap(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Nur POST erlaubt");
  checkAuth(req);
  const body = await readBody(req);
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-20)
    .map((m) => ({ role: m.role === "user" ? "user" : "ai", text: String(m.text || "").slice(0, 600) }));
  const sys = chatSystem({
    scenario: String(body.scenario || "Casual small talk").slice(0, 300),
    level: ["A1", "A2", "B1", "B2", "C1"].includes(body.level) ? body.level : "B1",
    words: (Array.isArray(body.words) ? body.words : []).slice(0, 15).map((w) => String(w).slice(0, 40)),
    lang: langName(body.lang),
  });
  const d = extractJson(await callLLM(providerFrom(body), sys, chatTranscript(history), 700));
  send(res, 200, { reply: String(d.reply || ""), de: String(d.de || ""), correction: String(d.correction || "") });
});
