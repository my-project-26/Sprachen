// Sprachausgabe über die im Browser eingebaute Stimme (kostenlos, offline auf iOS/macOS)
//
// Statt einer langen Liste aller Systemstimmen (inkl. Spaßstimmen wie „Orgel“ oder
// „Glocken“) gibt es wenige Stimm-Profile. Mit Aufnahmen klingen sie natürlich;
// ohne Aufnahme sucht sich jedes Profil die beste passende Gerätestimme.

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
let voices = [];
// Aktuelle Lernsprache: Code (z. B. "es") und bevorzugte Regionen (z. B. ["es-ES", "es-MX"])
let LANG = { code: "en", tts: ["en-US", "en-GB"] };
export function setLang(code, tts, audioBase) {
  LANG = { code, tts: tts && tts.length ? tts : [code] };
  loadVoices();
  // Aufnahmen: Standard im Ordner audio/<sprache>/ dieser Website; weitere Sprachen
  // liegen in eigenen Repos (z. B. /audio-it/it/), weil GitHub Pages pro Repo ~1 GB erlaubt.
  ROOT = { code, base: audioBase || "audio/" };
  VAR = {};
  loadAudioIndex(code, `${ROOT.base}${code}/`);
}

// Weitere Stimmen als eigene Aufnahmen: audio/<sprache>-m/ (tief, männlich), <sprache>-f2/ (sanft, weiblich)
let ROOT = { code: "en", base: "audio/" };
let VAR = {}; // rec → { keys:Set|null, base }
function variant(rec) {
  if (!rec) return null;
  if (!VAR[rec]) {
    const code = ROOT.code;
    const base = `${ROOT.base}${code}-${rec}/`;
    const v = (VAR[rec] = { keys: null, base });
    v.ready = fetch(`${base}index.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && ROOT.code === code) v.keys = new Set(j.keys || []);
      })
      .catch(() => {});
  }
  return VAR[rec];
}
// Für die Einstellungen: Gibt es für dieses Profil schon eigene Aufnahmen?
export function presetRecorded(key) {
  const p = PRESETS.find((x) => x.key === key);
  if (!p) return false;
  if (!p.rec) return naturalAvailable();
  const v = variant(p.rec);
  return !!(v.keys && v.keys.size);
}
// Wartet, bis alle Verzeichnisse der Aufnahmen geladen sind
export function voicesReady() {
  return Promise.all([MAIN_P, ...Object.values(VAR).map((v) => v.ready)]).catch(() => {});
}
export function preloadVariants() {
  PRESETS.forEach((p) => variant(p.rec));
}

// ---------- Natürliche Stimme: fertige MP3-Aufnahmen (audio/<sprache>/) ----------
// Für jedes Wort und jeden Beispielsatz gibt es eine Aufnahme einer neuronalen
// Stimme (erzeugt mit tools/make-audio.py). Fehlt eine Aufnahme (z. B. bei
// KI-Geschichten), liest die Gerätestimme vor.
let AUDIO = { code: null, keys: null, voice: "", base: "" };
let natural = true;
let current = null; // laufende Aufnahme

export function setNatural(on) {
  natural = on !== false;
}
export function naturalAvailable() {
  return !!(AUDIO.keys && AUDIO.keys.size);
}
let MAIN_P = Promise.resolve();
function loadAudioIndex(code, base) {
  MAIN_P = loadAudioIndex2(code, base);
  return MAIN_P;
}
async function loadAudioIndex2(code, base) {
  AUDIO = { code, keys: null, voice: "", base };
  try {
    const r = await fetch(`${base}index.json`, { cache: "no-cache" });
    if (!r.ok) return;
    const j = await r.json();
    if (AUDIO.code === code) AUDIO = { code, keys: new Set(j.keys || []), voice: j.voice || "", base };
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

// Stimm-Profile. rec = eigener Aufnahme-Satz ("" = Standardaufnahmen), sonst Gerätestimme als Ersatz
export const PRESETS = [
  { key: "frau2", label: "Frau – warm und lebendig", hint: "freundlich, entspannt, sehr klar", g: "f", r: 0, pitch: 1.0, rateMul: 1.0, rec: "frau2" },
  { key: "friend-f", label: "Standardstimme", hint: "natürlich und klar", g: "f", r: 0, pitch: 1.05, rateMul: 1.0, rec: "" },
];
// Alte, entfernte Profile → neue
export const PRESET_MAP = { "clear-f": "frau2", "clear-m": "frau2", "friend-m": "frau2", "strict-m": "frau2", "deep-m": "frau2", "sexy-f": "frau2", "strict-f": "frau2", rauer: "frau2", entspannt: "frau2", mann1: "frau2", mann2: "frau2" };

// Liefert für ein Profil die Stimme dieses Geräts (oder null, wenn keine passt)
const region = (r) => LANG.tts[r] || LANG.tts[0];
export function resolvePreset(key) {
  key = PRESET_MAP[key] || key;
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
  return p.hint;
}

export function presetAvailable(key) {
  const p = resolvePreset(key).preset;
  return p.rec !== undefined || !!resolvePreset(key).voice;
}

// Drei Tempostufen – überall gleich (Lernen, Wörterliste, Geschichten, Einstellungen).
// Bei Aufnahmen: Faktor zur Originalgeschwindigkeit (0.95 = Original).
export const RATE_STEPS = [
  { key: "slow", rate: 0.7, label: "Langsam" },
  { key: "mid", rate: 0.95, label: "Mittel" },
  { key: "fast", rate: 1.25, label: "Schnell" },
];
export function stepOfRate(rate) {
  let best = 1;
  RATE_STEPS.forEach((st, i) => {
    if (Math.abs(st.rate - rate) < Math.abs(RATE_STEPS[best].rate - rate)) best = i;
  });
  return best;
}

let lastSpeak = null; // für Tempowechsel während der Wiedergabe

// Sanfte Stimme für Aufnahmen: etwas tiefer und ruhiger, wärmerer Klang, weiche Höhen,
// leichte Präsenz bei 3 kHz, damit jedes Wort klar bleibt. Läuft über Web Audio.
let AC = null;
const SOFT_SLOW = 0.93; // tiefer + langsamer (Tonhöhe wird mit abgesenkt)
function softChain(a) {
  try {
    if (new URL(a.src, location.href).origin !== location.origin) return false; // fremde Quelle → stumm, daher nicht
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state !== "running") {
      AC.resume().catch(() => {});
      return false; // beim ersten Mal ohne Filter; ab dem nächsten Wort sanft
    }
    const src = AC.createMediaElementSource(a);
    const warm = Object.assign(AC.createBiquadFilter(), { type: "lowshelf" });
    warm.frequency.value = 220;
    warm.gain.value = 4;
    const clear = Object.assign(AC.createBiquadFilter(), { type: "peaking" });
    clear.frequency.value = 3000;
    clear.Q.value = 0.9;
    clear.gain.value = 1.5;
    const soft = Object.assign(AC.createBiquadFilter(), { type: "highshelf" });
    soft.frequency.value = 7000;
    soft.gain.value = -7;
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -26;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    const out = AC.createGain();
    out.gain.value = 1.15;
    src.connect(warm).connect(clear).connect(soft).connect(comp).connect(out).connect(AC.destination);
    return true;
  } catch {
    return false;
  }
}
const audioRate = (rate) => Math.min(2, Math.max(0.5, rate / 0.95));

// Tempo ändern. Läuft gerade etwas, wird es sofort angepasst (Aufnahme live,
// Gerätestimme startet neu). Rückgabe: true, wenn gerade etwas lief.
export function setRate(rate) {
  if (current) {
    current.playbackRate = audioRate(rate) * (current.soft ? SOFT_SLOW : 1);
    if (lastSpeak) lastSpeak.opts.rate = rate;
    return true;
  }
  if (synth && synth.speaking && lastSpeak) {
    speak(lastSpeak.text, { ...lastSpeak.opts, rate });
    return true;
  }
  return false;
}

export function speak(text, { rate = 0.95, preset = "clear-f", onend } = {}) {
  lastSpeak = { text, opts: { rate, preset, onend } };
  stopAudio();
  if (synth) synth.cancel();
  const p = resolvePreset(preset).preset;
  const v = natural ? variant(p.rec) : null;
  const key = audioKey(text);
  if (v && v.keys && v.keys.has(key)) {
    const a = new Audio(`${v.base}${key}.mp3`);
    a.playbackRate = audioRate(rate);
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
  if (natural && AUDIO.keys) {
    if (AUDIO.keys.has(key)) {
      const a = new Audio(`${AUDIO.base}${key}.mp3`);
      if (p?.soft && softChain(a)) {
        a.preservesPitch = false;
        a.webkitPreservesPitch = false;
        a.soft = true;
        a.playbackRate = audioRate(rate) * SOFT_SLOW;
      } else {
        a.playbackRate = audioRate(rate);
        a.preservesPitch = true;
      }
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
