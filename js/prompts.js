// Prompts für die KI – werden vom Server (api/) und vom Browser genutzt.
// lang = englischer Name der Lernsprache, z. B. "Spanish" (Standard: English).

const READING = {
  Japanese: "Hepburn romaji",
  "Mandarin Chinese (simplified characters)": "pinyin with tone marks",
  Korean: "Revised Romanization",
  Russian: "simple Latin transliteration",
  Hindi: "simple Latin transliteration",
};

export function storySystem(lang = "English") {
  return (
    `You write short graded-reader stories for an adult German native speaker who is learning ${lang}. ` +
    `You write natural, engaging ${lang}, never childish. You reply with valid JSON only, no markdown fences, no commentary.`
  );
}
export const STORY_SYSTEM = storySystem("English");

// words: Wörter, die geübt werden (müssen alle vorkommen)
// known: Wörter, die schon sitzen (zur Wiederholung, so viele wie natürlich passen)
export function storyPrompt(words, level = "B2", theme = "", known = [], lang = "English") {
  const list = words.map((w) => `- ${w.en} (${w.de})`).join("\n");
  const knownList = known.map((w) => `- ${w.en} (${w.de})`).join("\n");
  const reading = READING[lang];
  return `Write a short story in ${lang} that connects these target words the learner is currently practising:
${list}
${
  known.length
    ? `\nAlso weave in words the learner already knows, for review – use at least ${Math.min(3, known.length)} of them where they fit naturally:\n${knownList}\n`
    : ""
}${theme ? `\nTheme / setting (given in German): ${theme}. Build the plot around this theme so the words appear in a natural situation.\n` : ""}
Requirements:
- Language: ${lang} only (the title too). Length: ${level === "A1" || level === "A2" ? "100–160" : "180–260"} words (or the equivalent length), 2–4 paragraphs separated by a blank line (\\n\\n).
- Language level: CEFR ${level}. Apart from the listed words, use mostly common vocabulary so the listed words stand out and can be understood from context.
- Use EVERY target word at least once (inflected forms are fine) in a meaning that matches the German gloss.
- Mark every occurrence of a target word${known.length ? " and of every review word you use" : ""} with double asterisks, e.g. **word**. Mark nothing else.
- A coherent plot with a small twist or a clear ending, adult everyday or professional setting, a fitting title.
- Then write 4 multiple-choice comprehension questions in ${lang} with 4 options each. "answer" is the 0-based index of the correct option. Vary the position of the correct answer.
- For each marked word give the German meaning as used in the story${reading ? ` and its reading in ${reading} ("rd")` : ""}.

Return exactly this JSON structure:
{"title":"...","text":"...","questions":[{"q":"...","options":["...","...","...","..."],"answer":0}],"glossary":[{"en":"<${lang} word>","de":"..."${reading ? ',"rd":"..."' : ""}}]}`;
}

export function wordsSystem(lang = "English") {
  return (
    `You are a lexicographer creating ${lang} vocabulary flashcards for German native speakers (CEFR A1–C1). ` +
    "Translations are idiomatic German. Example sentences are natural, modern and adult. You reply with valid JSON only."
  );
}
export const WORDS_SYSTEM = wordsSystem("English");

const cardFormat = (lang) => {
  const reading = READING[lang];
  return `Each card has this structure:
{"en":"${lang} headword (dictionary form)","de":"German meanings, comma separated, most common first","pos":"n|v|adj|adv|conj|prep|phrase","level":"A1|A2|B1|B2|C1","topic":"grundlagen|familie|reisen|alltag|essen|wohnen|einkaufen|gesundheit|arbeit|bildung|medien|wissenschaft|umwelt|wirtschaft|recht|politik|gefuehle|charakter|denken|freizeit|verkehr","ex":"${lang} example sentence with the target word marked in *single asterisks*","exDe":"German translation of the sentence with the matching German word marked in *single asterisks*","note":"short German hint ONLY if useful: gender/article, irregular form, typical collocation, False Friend, register – otherwise empty string"${
    reading ? `,"rd":"reading of the headword in ${reading}"` : ""
  }}`;
};

export function generateWordsPrompt({ level = "B2", topic = "", count = 10, exclude = [], lang = "English" }) {
  return `Create ${count} new ${lang} vocabulary flashcards at CEFR level ${level}${
    topic ? ` for the topic "${topic}"` : ""
  }. Choose genuinely useful, frequent words for that level (not rare jargon), and mix word classes.
Do NOT use any of these words: ${exclude.slice(0, 600).join(", ") || "(none)"}.

${cardFormat(lang)}

Return exactly: {"words":[ ...cards... ]}`;
}

export function fillWordPrompt({ en, de = "", lang = "English" }) {
  return `Create one flashcard for the ${lang} word or phrase "${en}"${
    de ? ` with the German meaning "${de}"` : ""
  }. Estimate the CEFR level honestly.

${cardFormat(lang)}

Return exactly: {"words":[ ...one card... ]}`;
}

export function extractJson(text) {
  if (!text) throw new Error("Leere Antwort");
  let t = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Kein JSON gefunden");
  return JSON.parse(t.slice(start, end + 1));
}
