// Lokaler Entwicklungsserver ohne Abhängigkeiten: `node server.js`
// Liefert die App aus und leitet /api/* an dieselben Funktionen weiter wie Vercel.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

// .env laden (KEY=VALUE pro Zeile)
const envFile = join(ROOT, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, "");
      const file = join(ROOT, "api", name + ".js");
      if (!name || name.startsWith("_") || !existsSync(file)) {
        res.writeHead(404, { "content-type": "application/json" });
        return res.end('{"error":"Unbekannter Endpunkt"}');
      }
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }

    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || file.includes(`${ROOT}api`) || /\/\.env/.test(file)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(await readFile(file));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Wortwerk läuft auf http://localhost:${PORT}`);
  const keys = [];
  if (process.env.ANTHROPIC_API_KEY) keys.push("Claude");
  if (process.env.GEMINI_API_KEY) keys.push("Gemini");
  console.log(
    keys.length
      ? `KI-Anbieter mit Key: ${keys.join(", ")} (Ollama wird zusätzlich automatisch erkannt)`
      : "Kein API-Key in .env – KI läuft über Ollama (falls gestartet) oder den manuellen Modus."
  );
});
