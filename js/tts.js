// Sprachausgabe über die im Browser eingebaute Stimme (kostenlos, offline auf iOS/macOS)

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
let voices = [];

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
}
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}

export function available() {
  return !!synth;
}

export function englishVoices() {
  return rankedVoices();
}

// Bevorzugt natürliche, neuronale Frauenstimmen – klanglich am nächsten an
// Microsofts "Neural"-Stimmen (Edge) bzw. Apples Premium-Stimmen (Mac/iPhone).
const PREFERRED = [
  /Microsoft (Ava|Emma|Aria|Jenny|Michelle|Sonia|Libby).*(Natural|Online)/i,
  /Google UK English Female/i,
  /Google US English/i,
  /(Ava|Zoe|Allison|Susan|Serena|Kate|Samantha).*(Premium|Enhanced|Erweitert)/i,
  /^(Ava|Zoe|Samantha|Serena|Kate|Allison|Susan|Karen|Moira|Tessa)\b/i,
];

export function rankedVoices() {
  loadVoices();
  const score = (v) => {
    const i = PREFERRED.findIndex((re) => re.test(v.name));
    return (i === -1 ? 100 : i) + (/en[-_](US|GB)/i.test(v.lang) ? 0 : 5);
  };
  return [...voices].sort((a, b) => score(a) - score(b));
}

function pickVoice(name) {
  loadVoices();
  if (name) {
    const v = voices.find((x) => x.name === name);
    if (v) return v;
  }
  return rankedVoices()[0] || null;
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

export function speak(text, { rate = 0.95, voiceName = "", onend } = {}) {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/\*+/g, ""));
  const v = pickVoice(voiceName);
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else {
    u.lang = "en-US";
  }
  u.rate = rate;
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
