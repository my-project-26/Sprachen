// Lernsprachen. Deutsch ist immer die Ausgangssprache.
// tts: bevorzugte Stimmen-Sprachcodes, mm: Code für den Übersetzer (MyMemory),
// en: englischer Name (für KI-Prompts), reading: Lautschrift wird mitgelernt.
export const LANGS = {
  en: { name: "Englisch", native: "English", flag: "🇬🇧", en: "English", tts: ["en-US", "en-GB"], mm: "en", hello: "Hello! This is how I will read your words to you." },
  es: { audio: "/audio-sp/", name: "Spanisch", native: "Español", flag: "🇪🇸", en: "Spanish", tts: ["es-ES", "es-MX", "es-US"], mm: "es", hello: "¡Hola! Así voy a leerte tus palabras." },
  fr: { name: "Französisch", native: "Français", flag: "🇫🇷", en: "French", tts: ["fr-FR", "fr-CA"], mm: "fr", hello: "Bonjour ! C'est ainsi que je vais te lire tes mots." },
  it: { audio: "/audio-it/", name: "Italienisch", native: "Italiano", flag: "🇮🇹", en: "Italian", tts: ["it-IT"], mm: "it", hello: "Ciao! Così ti leggerò le tue parole." },
  pl: { name: "Polnisch", native: "Polski", flag: "🇵🇱", en: "Polish", tts: ["pl-PL"], mm: "pl", hello: "Cześć! Tak będę ci czytać twoje słowa." },
  ru: { name: "Russisch", native: "Русский", flag: "🇷🇺", en: "Russian", tts: ["ru-RU"], mm: "ru", reading: "Umschrift", hello: "Привет! Так я буду читать тебе слова." },
  ja: { name: "Japanisch", native: "日本語", flag: "🇯🇵", en: "Japanese", tts: ["ja-JP"], mm: "ja", reading: "Lesung", cjk: true, hello: "こんにちは！このように単語を読みます。" },
  zh: { name: "Chinesisch", native: "中文", flag: "🇨🇳", en: "Mandarin Chinese (simplified characters)", tts: ["zh-CN", "zh-TW", "zh-HK"], mm: "zh-CN", reading: "Pinyin", cjk: true, hello: "你好！我会这样给你读单词。" },
  ko: { name: "Koreanisch", native: "한국어", flag: "🇰🇷", en: "Korean", tts: ["ko-KR"], mm: "ko", reading: "Umschrift", hello: "안녕하세요! 이렇게 단어를 읽어 줄게요." },
  hi: { name: "Hindi", native: "हिन्दी", flag: "🇮🇳", en: "Hindi", tts: ["hi-IN"], mm: "hi", reading: "Umschrift", hello: "नमस्ते! मैं आपके शब्द ऐसे पढ़ूँगा।" },
};

// Sprachen, für die es schon eine Wortliste gibt (js/wordbank.js bzw. js/wordbank.<code>.js)
export const READY = ["en", "es"];

// Nur bekannte Sprachnamen an die KI geben (Schutz vor beliebigem Text im Prompt)
export const langName = (x) => (Object.values(LANGS).some((l) => l.en === x) ? x : "English");

export const SETTINGS_KEY = "wortwerk.settings";

export function currentLang() {
  try {
    const g = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (g && LANGS[g.lang] && READY.includes(g.lang)) return g.lang;
  } catch {}
  return "en";
}

export const L = () => LANGS[currentLang()];

// Vergleich der eingetippten Antwort: exakt, ohne Akzente, oder per Lautschrift
const fold = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
// Artikel am Anfang dürfen beim Eintippen fehlen (el libro → libro)
const ARTICLE = /^(el|la|los|las|un|una|le|les|l'|l’|il|lo|gli|i|un'|uno|der|die|das)\s*/i;
export function checkAnswer(typed, card) {
  const t = String(typed || "").trim().toLowerCase();
  if (!t) return "bad";
  const base = [card.en, ...String(card.en).split(/[\/,;]/)].map((x) => x.trim().toLowerCase());
  const answers = [...base, ...base.map((x) => x.replace(ARTICLE, ""))];
  if (answers.includes(t)) return "ok";
  if (card.rd && fold(card.rd) === fold(t)) return "ok";
  if (answers.some((a) => fold(a) === fold(t))) return "almost"; // nur Akzente/Satzzeichen anders
  return "bad";
}
