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
  loadVoices();
  return voices;
}

function pickVoice(name) {
  loadVoices();
  if (name) {
    const v = voices.find((x) => x.name === name);
    if (v) return v;
  }
  return (
    voices.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Ava|Allison|Google US/i.test(v.name)) ||
    voices.find((v) => /en[-_](US|GB)/i.test(v.lang)) ||
    voices[0] ||
    null
  );
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
