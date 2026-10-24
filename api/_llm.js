// Gemeinsame Helfer für die Server-Funktionen (Vercel und lokaler server.js).
// Unterstützt drei KI-Anbieter: Claude (Anthropic), Gemini (Google) und Ollama (lokal).
// Dateien mit "_" am Anfang werden von Vercel nicht als eigene Route veröffentlicht.

const env = (k, d = "") => process.env[k] || d;

export const CLAUDE_MODEL = () => env("ANTHROPIC_MODEL", "claude-sonnet-5-5");
export const GEMINI_MODEL = () => env("GEMINI_MODEL", "gemini-flash-latest");
export const OLLAMA_URL = () => env("OLLAMA_URL", "http://127.0.0.1:11434").replace(/\/$/, "");

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// ---------- Anbieter ----------

async function callClaude(system, user, maxTokens) {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) throw httpError(500, "ANTHROPIC_API_KEY ist auf dem Server nicht gesetzt.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: CLAUDE_MODEL(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(502, "Claude: " + (data?.error?.message || `Fehler ${res.status}`));
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geminiOnce(model, system, user, maxTokens, key) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        // Großzügiges Limit, weil "denkende" Gemini-Modelle einen Teil davon intern verbrauchen
        generationConfig: { maxOutputTokens: Math.max(maxTokens * 3, 8192), responseMimeType: "application/json" },
      }),
    }
  ).catch(() => null);
  if (!res) throw Object.assign(httpError(502, "Gemini nicht erreichbar"), { retry: true });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Fehler ${res.status}`;
    const hint = res.status === 429 ? " (Gratis-Kontingent erschöpft – später erneut versuchen)" : "";
    const e = httpError(502, "Gemini: " + msg + hint);
    e.retry = res.status === 429 || res.status >= 500 || res.status === 404;
    e.code = res.status;
    throw e;
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  if (!text)
    throw Object.assign(httpError(502, "Gemini hat keinen Text geliefert (" + (data?.candidates?.[0]?.finishReason || "unbekannt") + ")"), { retry: true });
  return text;
}

// Probiert mehrere Gemini-Modelle nacheinander (falls eines überlastet ist)
async function callGemini(system, user, maxTokens, prefer = "") {
  const key = env("GEMINI_API_KEY");
  if (!key) throw httpError(500, "GEMINI_API_KEY ist auf dem Server nicht gesetzt.");
  const models = [prefer, GEMINI_MODEL(), "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
  let last;
  for (const m of models) {
    try {
      return await geminiOnce(m, system, user, maxTokens, key);
    } catch (e) {
      last = e;
      if (!e.retry) throw e;
      if (e.code !== 404) await sleep(800);
    }
  }
  throw last;
}

export async function ollamaModels() {
  const res = await fetch(`${OLLAMA_URL()}/api/tags`, { signal: AbortSignal.timeout(2500) });
  if (!res.ok) throw new Error(`Ollama antwortet nicht (${res.status})`);
  const data = await res.json();
  // Embedding-Modelle (z. B. nomic-embed-text) können keinen Text schreiben → ausblenden
  return (data.models || []).map((m) => m.name).filter((n) => !/embed/i.test(n));
}

async function callOllama(system, user, maxTokens, model) {
  let name = model || env("OLLAMA_MODEL");
  if (!name) {
    const list = await ollamaModels().catch(() => []);
    if (!list.length) throw httpError(500, "Ollama läuft nicht oder hat keine Modelle. Im Terminal z. B. `ollama pull gemma3` ausführen.");
    name = list[0];
  }
  let res;
  try {
    res = await fetch(`${OLLAMA_URL()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: name,
        stream: false,
        format: "json",
        options: { num_predict: Math.max(maxTokens, 2048), temperature: 0.8 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch {
    throw httpError(502, "Ollama nicht erreichbar. Ist die Ollama-App gestartet?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(502, "Ollama: " + (data?.error || `Fehler ${res.status}`));
  return data?.message?.content || "";
}

// Wählt den Anbieter: ausdrücklich gewählt oder "auto" (Claude → Gemini → Ollama)
export function resolveProvider(requested) {
  if (["claude", "gemini", "ollama"].includes(requested)) return requested;
  if (env("ANTHROPIC_API_KEY")) return "claude";
  if (env("GEMINI_API_KEY")) return "gemini";
  // Auf Vercel gibt es kein Ollama → klare Meldung statt Ollama-Fehler
  if (env("VERCEL"))
    throw httpError(500, "Auf dem Server fehlt GEMINI_API_KEY. Vercel → Settings → Environment Variables → GEMINI_API_KEY eintragen, danach Deployments → Redeploy.");
  return "ollama";
}

export async function callLLM({ provider, model }, system, user, maxTokens = 2000) {
  const p = resolveProvider(provider);
  if (p === "claude") return callClaude(system, user, maxTokens);
  if (p === "gemini") return callGemini(system, user, maxTokens, /^gemini/.test(model || "") ? model : "");
  return callOllama(system, user, maxTokens, model);
}

// ---------- HTTP ----------

export function checkAuth(req) {
  const secret = env("APP_SECRET");
  if (!secret) return;
  const got = req.headers["x-app-key"];
  if (got !== secret) throw httpError(401, "Falsches oder fehlendes App-Passwort (Einstellungen → KI-Server).");
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(obj));
}

function cors(req, res) {
  // Erlaubt den Aufruf auch von einer anders gehosteten Oberfläche (z. B. GitHub Pages)
  res.setHeader("access-control-allow-origin", env("ALLOWED_ORIGIN", "*"));
  res.setHeader("access-control-allow-headers", "content-type, x-app-key");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function wrap(fn) {
  return async (req, res) => {
    if (cors(req, res)) return;
    try {
      await fn(req, res);
    } catch (e) {
      send(res, e.status || 500, { error: e.message || "Unbekannter Fehler" });
    }
  };
}

export function providerFrom(body) {
  return {
    provider: String(body.provider || "auto"),
    model: typeof body.model === "string" ? body.model.slice(0, 100) : "",
  };
}
