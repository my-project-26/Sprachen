// Hörproben für neue Stimmen (Gemini-Sprachausgabe). Ohne ?v= eine Seite mit allen Proben.
// Feste Texte und Stimmen – nichts frei wählbar. Ergebnisse werden einen Tag zwischengespeichert.
import { wrap, httpError } from "./_llm.js";

const TEXTS = {
  en: {
    f: "Hello! I'm your new language coach. Let's learn a few words together: the station, the hotel, a difficult question. Take your time and listen carefully. You're doing really well.",
    m: "Hello! I'm your new language coach. Let's learn a few words together: the station, the hotel, a difficult question. Take your time and listen carefully. You're doing really well.",
  },
  it: {
    f: "Ciao! Sono la tua nuova insegnante. Impariamo insieme qualche parola: la stazione, l'albergo, una domanda difficile. Prenditi il tuo tempo e ascolta con attenzione. Stai andando benissimo.",
    m: "Ciao! Sono il tuo nuovo insegnante. Impariamo insieme qualche parola: la stazione, l'albergo, una domanda difficile. Prenditi il tuo tempo e ascolta con attenzione. Stai andando benissimo.",
  },
  es: {
    f: "¡Hola! Soy tu nueva profesora. Aprendamos juntos algunas palabras: la estación, el hotel, una pregunta difícil. Tómate tu tiempo y escucha con atención. Lo estás haciendo muy bien.",
    m: "¡Hola! Soy tu nuevo profesor. Aprendamos juntos algunas palabras: la estación, el hotel, una pregunta difícil. Tómate tu tiempo y escucha con atención. Lo estás haciendo muy bien.",
  },
};

export const VOICES = [
  { id: "f1", label: "Frau 1 – sehr liebevoll und warm", voice: "Achernar", style: "Speak very softly, warmly and lovingly, calm and close to the listener, but every word clearly articulated" },
  { id: "f2", label: "Frau 2 – warm und lebendig", voice: "Sulafat", style: "Speak in a warm, friendly, relaxed and natural way, clearly articulated" },
  { id: "f3", label: "Frau 3 – rau und rauchig", voice: "Gacrux", style: "Speak with a husky, raspy, smoky voice, confident and cool, but clearly articulated" },
  { id: "m1", label: "Mann 1 – sehr liebevoll und warm", voice: "Algieba", style: "Speak very softly, warmly and lovingly, calm and reassuring, every word clearly articulated" },
  { id: "m2", label: "Mann 2 – tief und ruhig", voice: "Charon", style: "Speak with a deep, calm, resonant voice, relaxed and confident, clearly articulated" },
  { id: "m3", label: "Mann 3 – sehr rau", voice: "Algenib", style: "Speak with a very rough, gravelly, raspy voice like a rock singer, energetic but clearly articulated" },
];
const MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts", "gemini-2.5-pro-preview-tts"];

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function tts(v, lang = "en") {
  const TEXT = (TEXTS[lang] || TEXTS.en)[v.id[0]];
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw httpError(500, "GEMINI_API_KEY fehlt");
  let last = "";
  for (const m of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${v.style}: ${TEXT}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v.voice } } } },
      }),
    });
    const d = await r.json().catch(() => ({}));
    const b64 = d?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
    if (r.ok && b64) return wav(Buffer.from(b64, "base64"));
    last = `${m}: ${d?.error?.message || r.status}`;
  }
  throw httpError(502, "Gemini-Stimme: " + last);
}

export default wrap(async (req, res) => {
  const q = new URL(req.url, "http://x").searchParams;
  const id = q.get("v");
  const lang = ["en", "it", "es"].includes(q.get("l")) ? q.get("l") : "en";
  if (!id) {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stimmproben</title><body style="font:17px system-ui;max-width:560px;margin:24px auto;padding:0 16px">
<h1>Stimmproben</h1><p>Tippe auf ▶. Das erste Laden einer Probe dauert ein paar Sekunden.</p>
${VOICES.map((v) => `<h3>${v.label}</h3><audio controls preload="none" src="?v=${v.id}" style="width:100%"></audio>`).join("")}</body>`);
    return;
  }
  const v = VOICES.find((x) => x.id === id);
  if (!v) throw httpError(404, "Unbekannte Stimme");
  const buf = await tts(v, lang);
  res.setHeader("content-type", "audio/wav");
  res.setHeader("cache-control", "public, s-maxage=604800, max-age=86400");
  res.end(buf);
});
