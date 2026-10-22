// Sprachausgabe über die im Browser eingebaute Stimme (kostenlos, offline auf iOS/macOS)
//
// Statt einer langen Liste aller Systemstimmen (inkl. Spaßstimmen wie „Orgel“ oder
// „Glocken“) gibt es 6 Stimm-Profile: klar, wie ein Freund, strenger Lehrer –
// jeweils weiblich und männlich. Jedes Profil sucht sich die beste passende
// Stimme des Geräts und passt Tonhöhe und Tempo an.

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
let voices = [];
// Aktuelle Lernsprache: Code (z. B. "es") und bevorzugte Regionen (z. B. ["es-ES", "es-MX"])
let LANG = { code: "en", tts: ["en-US", "en-GB"] };
export function setLang(code, tts) {
  LANG = { code, tts: tts && tts.length ? tts : [code] };
  loadVoices();
  loadAudioIndex(code);
}

// ---------- Natürliche Stimme: fertige MP3-Aufnahmen (audio/<sprache>/) ----------
// Für jedes Wort und jeden Beispielsatz gibt es eine Aufnahme einer neuronalen
// Stimme (erzeugt mit tools/make-audio.py). Fehlt eine Aufnahme (z. B. bei
// KI-Geschichten), liest die Gerätestimme vor.
let AUDIO = { code: null, keys: null, voice: "" };
let natural = true;
let current = null; // laufende Aufnahme

export function setNatural(on) {
  natural = on !== false;
}
export function naturalAvailable() {
  return !!(AUDIO.keys && AUDIO.keys.size);
}
async function loadAudioIndex(code) {
  AUDIO = { code, keys: null, voice: "" };
  try {
    const r = await fetch(`audio/${code}/index.json`, { cache: "no-cache" });
    if (!r.ok) return;
    const j = await r.json();
    if (AUDIO.code === code) AUDIO = { code, keys: new Set(j.keys || []), voice: j.voice || "" };
  } catch {
    /* offline oder noch keine Aufnahmen */
  }
}

const normText = (t) => String(t).normalize("NFC").replace(/\*+/g, "").replace(/\s+/g, " ").trim();
function fnv(bytes, h) {
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
// Muss exakt audio_key() in tools/make-audio.py entsprechen
export function audioKey(text) {
  const b = new TextEncoder().encode(normText(text));
  const hex = (n) => n.toString(16).padStart(8, "0");
  return hex(fnv(b, 0x811c9dc5)) + hex(fnv(b, 0x01000193));
}

function stopAudio() {
  if (current) {
    current.onended = current.onerror = null;
    current.pause();
    current = null;
  }
}

// Spaß-, Effekt- und Roboterstimmen von macOS/iOS – nie verwenden
const NOVELTY =
  /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Orgel|Glocken|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Hysterical|Deranged|Pipe Organ|Princess|Agnes|Bruce|Vicki|Victoria)\b/i;

const FEMALE =
  /\b(Monica|Mónica|Paulina|Marisol|Lucia|Lucía|Elvira|Dalia|Amélie|Amelie|Audrey|Aurélie|Marie|Thérèse|Denise|Alice|Federica|Paola|Elsa|Isabella|Milena|Katya|Svetlana|Dariya|Kyoko|Nanami|Mizuki|O-ren|Yuna|Sora|SunHi|Heami|Tingting|Ting-Ting|Meijia|Sinji|Xiaoxiao|Xiaoyi|Huihui|Lekha|Kalpana|Swara|Zosia|Ewa|Agnieszka|Paulina|Zofia|Samantha|Ava|Allison|Susan|Zoe|Nicky|Serena|Kate|Stephanie|Karen|Moira|Tessa|Fiona|Veena|Martha|Catherine|Aria|Jenny|Emma|Michelle|Sonia|Libby|Natasha|Clara|Hazel|Zira|Female|Joanna|Salli|Kimberly|Ivy|Amy)\b/i;
const MALE =
  /\b(Jorge|Diego|Juan|Carlos|Álvaro|Alvaro|Pablo|Thomas|Nicolas|Henri|Rémy|Luca|Diego|Cosimo|Giorgio|Yuri|Dmitry|Pavel|Maxim|Otoya|Hattori|Keita|Ichiro|Minsu|InJoon|Hyunsu|Yunyang|Yunxi|Kangkang|Li-mu|Rishi|Madhur|Hemant|Krzysztof|Marek|Jacek|Alex|Tom|Evan|Nathan|Aaron|Daniel|Oliver|Arthur|Rishi|Lee|Gordon|Guy|Andrew|Brian|Christopher|Eric|Ryan|Thomas|William|Liam|David|Mark|George|Male|Matthew|Joey|Justin)\b/i;

function loadVoices() {
  if (!synth) return;
  voices = synth
    .getVoices()
    .filter((v) => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith(LANG.code) && !NOVELTY.test(v.name));
}
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}

export function available() {
  return !!synth || typeof Audio !== "undefined";
}

function gender(v) {
  if (/Google US English/i.test(v.name)) return "f";
  if (FEMALE.test(v.name)) return "f";
  if (MALE.test(v.name)) return "m";
  return "?";
}

// Qualität: neuronale/Premium-Stimmen zuerst (klingen wie Navi-Ansagen)
function quality(v) {
  let q = 0;
  if (/Natural|Neural|Online/i.test(v.name)) q += 50;
  if (/Premium/i.test(v.name)) q += 45;
  if (/Enhanced|Erweitert/i.test(v.name)) q += 35;
  if (/^Google/i.test(v.name)) q += 40;
  if (/Siri/i.test(v.name)) q += 30;
  if (/Ava|Zoe|Evan|Nathan|Samantha|Alex|Daniel|Serena|Aria|Jenny|Guy|Andrew|Emma|Brian|Sonia|Ryan/i.test(v.name)) q += 10;
  if (!v.localService) q += 2;
  return q;
}

// langPref: Region-Code wie "en-GB"
function pick(g, langPref, avoid) {
  loadVoices();
  let list = voices.filter((v) => gender(v) === g && v !== avoid);
  // In anderen Sprachen ist das Geschlecht oft nicht am Namen erkennbar → unbekannte Stimmen zulassen
  if (!list.length && LANG.code !== "en") list = voices.filter((v) => gender(v) === "?" && v !== avoid);
  if (!list.length) return null;
  const norm = (x) => String(x).replace("_", "-").toLowerCase();
  const score = (v) => quality(v) + (langPref && norm(v.lang) === norm(langPref) ? 60 : 0);
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

// Die 6 Stimm-Profile (r: 0 = Hauptregion, 1 = zweite Region, z. B. britisch)
export const PRESETS = [
  { key: "clear-f", label: "Klar & deutlich – weiblich", hint: "wie eine Navi-Ansage", g: "f", r: 0, pitch: 1.0, rateMul: 1.0 },
  { key: "clear-m", label: "Klar & deutlich – männlich", hint: "wie eine Navi-Ansage", g: "m", r: 0, pitch: 1.0, rateMul: 1.0 },
  { key: "friend-f", label: "Beste Freundin", hint: "warm, locker, etwas lebhafter", g: "f", r: 0, pitch: 1.12, rateMul: 1.05 },
  { key: "friend-m", label: "Bester Freund", hint: "warm, locker, etwas lebhafter", g: "m", r: 0, pitch: 1.1, rateMul: 1.05 },
  { key: "strict-f", label: "Strenge Lehrerin", hint: "tiefer, betont langsam", g: "f", r: 1, pitch: 0.85, rateMul: 0.88 },
  { key: "strict-m", label: "Strenger Lehrer", hint: "tiefer, betont langsam", g: "m", r: 1, pitch: 0.8, rateMul: 0.88 },
];

// Liefert für ein Profil die Stimme dieses Geräts (oder null, wenn keine passt)
const region = (r) => LANG.tts[r] || LANG.tts[0];
export function resolvePreset(key) {
  const p = PRESETS.find((x) => x.key === key) || PRESETS[0];
  let voice = pick(p.g, region(p.r));
  // Freund/in: möglichst eine andere Stimme als „klar“, damit sie sich unterscheiden
  if (p.key.startsWith("friend")) {
    const alt = pick(p.g, region(0), pick(p.g, region(0)));
    if (alt) voice = alt;
  }
  return { preset: p, voice };
}

// Hinweistext je Sprache (beim Englischen ist der strenge Lehrer britisch)
export function presetHint(p) {
  return p.key.startsWith("strict") && LANG.code === "en" ? "britisch, tiefer, betont langsam" : p.hint;
}

export function presetAvailable(key) {
  return !!resolvePreset(key).voice;
}

// Fünf Tempostufen für den Schieberegler
export const RATE_STEPS = [
  { rate: 0.6, label: "sehr langsam" },
  { rate: 0.8, label: "langsam" },
  { rate: 0.95, label: "normal" },
  { rate: 1.1, label: "schnell" },
  { rate: 1.3, label: "sehr schnell" },
];
export function stepOfRate(rate) {
  let best = 2;
  RATE_STEPS.forEach((st, i) => {
    if (Math.abs(st.rate - rate) < Math.abs(RATE_STEPS[best].rate - rate)) best = i;
  });
  return best;
}

export function speak(text, { rate = 0.95, preset = "clear-f", onend } = {}) {
  stopAudio();
  if (synth) synth.cancel();
  if (natural && AUDIO.keys) {
    const key = audioKey(text);
    if (AUDIO.keys.has(key)) {
      const a = new Audio(`audio/${AUDIO.code}/${key}.mp3`);
      a.playbackRate = Math.min(2, Math.max(0.5, rate / 0.95));
      a.preservesPitch = true;
      current = a;
      a.onended = () => {
        current = null;
        onend && onend();
      };
      a.onerror = () => {
        current = null;
        speakDevice(text, { rate, preset, onend });
      };
      a.play().catch(() => {
        if (current === a) a.onerror();
      });
      return;
    }
  }
  speakDevice(text, { rate, preset, onend });
}

function speakDevice(text, { rate, preset, onend }) {
  if (!synth) return onend && onend();
  const u = new SpeechSynthesisUtterance(String(text).replace(/\*+/g, ""));
  const { preset: p, voice } = resolvePreset(preset);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = region(p.r);
  }
  u.rate = Math.min(2, Math.max(0.4, rate * p.rateMul));
  u.pitch = p.pitch;
  if (onend) {
    u.onend = onend;
    u.onerror = onend;
  }
  synth.speak(u);
}

export function stop() {
  stopAudio();
  if (synth) synth.cancel();
}

export function speaking() {
  return !!current || (!!synth && synth.speaking);
}
