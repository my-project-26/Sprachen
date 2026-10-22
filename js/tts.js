// Sprachausgabe über die im Browser eingebaute Stimme (kostenlos, offline auf iOS/macOS)
//
// Statt einer langen Liste aller Systemstimmen (inkl. Spaßstimmen wie „Orgel“ oder
// „Glocken“) gibt es 6 Stimm-Profile: klar, wie ein Freund, strenger Lehrer –
// jeweils weiblich und männlich. Jedes Profil sucht sich die beste passende
// Stimme des Geräts und passt Tonhöhe und Tempo an.

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
let voices = [];

// Spaß-, Effekt- und Roboterstimmen von macOS/iOS – nie verwenden
const NOVELTY =
  /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Orgel|Glocken|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Hysterical|Deranged|Pipe Organ|Princess|Agnes|Bruce|Vicki|Victoria)\b/i;

const FEMALE =
  /\b(Samantha|Ava|Allison|Susan|Zoe|Nicky|Serena|Kate|Stephanie|Karen|Moira|Tessa|Fiona|Veena|Martha|Catherine|Aria|Jenny|Emma|Michelle|Sonia|Libby|Natasha|Clara|Hazel|Zira|Female|Joanna|Salli|Kimberly|Ivy|Amy)\b/i;
const MALE =
  /\b(Alex|Tom|Evan|Nathan|Aaron|Daniel|Oliver|Arthur|Rishi|Lee|Gordon|Guy|Andrew|Brian|Christopher|Eric|Ryan|Thomas|William|Liam|David|Mark|George|Male|Matthew|Joey|Justin)\b/i;

function loadVoices() {
  if (!synth) return;
  voices = synth
    .getVoices()
    .filter((v) => v.lang && v.lang.toLowerCase().startsWith("en") && !NOVELTY.test(v.name));
}
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}

export function available() {
  return !!synth;
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

function pick(g, langPref) {
  loadVoices();
  const list = voices.filter((v) => gender(v) === g);
  if (!list.length) return null;
  const score = (v) => quality(v) + (langPref && new RegExp(`en[-_]${langPref}`, "i").test(v.lang) ? 60 : 0);
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

// Die 6 Stimm-Profile
export const PRESETS = [
  { key: "clear-f", label: "Klar & deutlich – weiblich", hint: "wie eine Navi-Ansage", g: "f", lang: "US", pitch: 1.0, rateMul: 1.0 },
  { key: "clear-m", label: "Klar & deutlich – männlich", hint: "wie eine Navi-Ansage", g: "m", lang: "US", pitch: 1.0, rateMul: 1.0 },
  { key: "friend-f", label: "Beste Freundin", hint: "warm, locker, etwas lebhafter", g: "f", lang: "US", pitch: 1.12, rateMul: 1.05 },
  { key: "friend-m", label: "Bester Freund", hint: "warm, locker, etwas lebhafter", g: "m", lang: "US", pitch: 1.1, rateMul: 1.05 },
  { key: "strict-f", label: "Strenge Lehrerin", hint: "britisch, tiefer, betont langsam", g: "f", lang: "GB", pitch: 0.85, rateMul: 0.88 },
  { key: "strict-m", label: "Strenger Lehrer", hint: "britisch, tiefer, betont langsam", g: "m", lang: "GB", pitch: 0.8, rateMul: 0.88 },
];

// Liefert für ein Profil die Stimme dieses Geräts (oder null, wenn keine passt)
export function resolvePreset(key) {
  const p = PRESETS.find((x) => x.key === key) || PRESETS[0];
  let voice = pick(p.g, p.lang);
  // Freund/in: möglichst eine andere Stimme als „klar“, damit sie sich unterscheiden
  if (p.key.startsWith("friend")) {
    const clear = pick(p.g, "US");
    const us = (v) => (/en[-_]US/i.test(v.lang) ? 20 : 0);
    const alt = voices
      .filter((v) => gender(v) === p.g && v !== clear)
      .sort((a, b) => quality(b) + us(b) - (quality(a) + us(a)))[0];
    if (alt) voice = alt;
  }
  return { preset: p, voice };
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
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/\*+/g, ""));
  const { preset: p, voice } = resolvePreset(preset);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = p.lang === "GB" ? "en-GB" : "en-US";
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
  if (synth) synth.cancel();
}

export function speaking() {
  return !!synth && synth.speaking;
}
