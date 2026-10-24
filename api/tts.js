// Natürliche Stimme für Texte ohne fertige Aufnahme (Geschichten, Gespräch, Deutsch).
// GET /api/tts?l=en&v=Achernar&r=1&t=Hello → MP3 von Google (Chirp 3 HD).
// Braucht auf Vercel die Umgebungsvariable GOOGLE_TTS_KEY. Antworten werden lange zwischengespeichert.
import { wrap, httpError } from "./_llm.js";

const LOCALE = { en: "en-US", de: "de-DE", it: "it-IT", es: "es-ES", fr: "fr-FR" };
const VOICES = new Set(["Achernar", "Algenib", "Sulafat", "Gacrux", "Charon", "Kore", "Puck", "Aoede", "Leda", "Orus"]);

export default wrap(async (req, res) => {
  const q = new URL(req.url, "http://x").searchParams;
  const text = String(q.get("t") || "").trim().slice(0, 900);
  const lang = LOCALE[q.get("l")] ? q.get("l") : "en";
  const voice = VOICES.has(q.get("v")) ? q.get("v") : "Achernar";
  const rate = Math.min(1.3, Math.max(0.6, Number(q.get("r")) || 1));
  if (!text) throw httpError(400, "Kein Text");
  const key = process.env.GOOGLE_TTS_KEY;
  if (!key) throw httpError(500, "GOOGLE_TTS_KEY fehlt auf dem Server (Vercel → Settings → Environment Variables).");
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: LOCALE[lang], name: `${LOCALE[lang]}-Chirp3-HD-${voice}` },
      audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000, speakingRate: rate },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.audioContent) throw httpError(502, "Google-Stimme: " + (d?.error?.message || r.status));
  const buf = Buffer.from(d.audioContent, "base64");
  res.statusCode = 200;
  res.setHeader("content-type", "audio/mpeg");
  res.setHeader("cache-control", "public, max-age=86400, s-maxage=31536000, immutable");
  res.end(buf);
});
