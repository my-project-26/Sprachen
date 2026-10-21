// Gemeinsame Helfer für die Server-Funktionen (Vercel und lokaler server.js)
// Dateien mit "_" am Anfang werden von Vercel nicht als eigene Route veröffentlicht.

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export async function callClaude(system, user, maxTokens = 2000) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw httpError(500, "ANTHROPIC_API_KEY ist auf dem Server nicht gesetzt.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Claude-API-Fehler (${res.status})`;
    throw httpError(502, msg);
  }
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export function checkAuth(req) {
  const secret = process.env.APP_SECRET;
  if (!secret) return;
  const got = req.headers["x-app-key"] || req.headers["X-App-Key"];
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

export function cors(req, res) {
  // Erlaubt den Aufruf auch von einer anders gehosteten Oberfläche (z. B. GitHub Pages)
  res.setHeader("access-control-allow-origin", process.env.ALLOWED_ORIGIN || "*");
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
