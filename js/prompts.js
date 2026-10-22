// Prompts für die KI – werden vom Server (api/) und vom Browser (manueller Modus) genutzt.

export const STORY_SYSTEM =
  "You write short graded-reader stories for an adult German native speaker who is learning English and aims for CEFR level C1. " +
  "You write natural, engaging English, never childish. You reply with valid JSON only, no markdown fences, no commentary.";

// words: Wörter, die geübt werden (müssen alle vorkommen)
// known: Wörter, die schon sitzen (zur Wiederholung, so viele wie natürlich passen)
export function storyPrompt(words, level = "B2", theme = "", known = []) {
  const list = words.map((w) => `- ${w.en} (${w.de})`).join("\n");
  const knownList = known.map((w) => `- ${w.en} (${w.de})`).join("\n");
  return `Write a short story that connects these target words the learner is currently practising:
${list}
${
  known.length
    ? `\nAlso weave in words the learner already knows, for review – use at least ${Math.min(3, known.length)} of them where they fit naturally:\n${knownList}\n`
    : ""
}${theme ? `\nTheme / setting: ${theme}. Build the plot around this theme so the words appear in a natural situation.\n` : ""}
Requirements:
- Length: 180–260 words, 2–4 paragraphs separated by a blank line (\\n\\n).
- Language level: ${level}. Apart from the listed words, use mostly common vocabulary so the listed words stand out and can be understood from context.
- Use EVERY target word at least once (inflected forms are fine) in a meaning that matches the German gloss.
- Mark every occurrence of a target word${known.length ? " and of every review word you use" : ""} with double asterisks, e.g. **established**. Mark nothing else.
- A coherent plot with a small twist or a clear ending, adult everyday or professional setting, a fitting title.
- Then write 4 multiple-choice comprehension questions in English with 4 options each. "answer" is the 0-based index of the correct option. Vary the position of the correct answer.
- For each marked word give the German meaning as used in the story.

Return exactly this JSON structure:
{"title":"...","text":"...","questions":[{"q":"...","options":["...","...","...","..."],"answer":0}],"glossary":[{"en":"...","de":"..."}]}`;
}

export const WORDS_SYSTEM =
  "You are a lexicographer creating English vocabulary flashcards for German native speakers (CEFR A1–C1). " +
  "Translations are idiomatic German. Example sentences are natural, modern and adult. You reply with valid JSON only.";

const CARD_FORMAT = `Each card has this structure:
{"en":"headword","de":"German meanings, comma separated, most common first","pos":"n|v|adj|adv|conj|prep|phrase","level":"A1|A2|B1|B2|C1","topic":"grundlagen|familie|politik|arbeit|wissenschaft|umwelt|gefuehle|medien|recht|gesundheit|wirtschaft|denken|alltag","ex":"English example sentence with the target word marked in *single asterisks*","exDe":"German translation of the sentence with the matching German word marked in *single asterisks*","note":"short German hint ONLY if useful: False Friend, typical collocation, irregular form, pronunciation trap or register – otherwise empty string"}`;

export function generateWordsPrompt({ level = "B2", topic = "", count = 10, exclude = [] }) {
  return `Create ${count} new English vocabulary flashcards at CEFR level ${level}${
    topic ? ` for the topic "${topic}"` : ""
  }. Choose genuinely useful, frequent words for that level (not rare jargon), and mix word classes.
Do NOT use any of these words: ${exclude.slice(0, 600).join(", ") || "(none)"}.

${CARD_FORMAT}

Return exactly: {"words":[ ...cards... ]}`;
}

export function fillWordPrompt({ en, de = "" }) {
  return `Create one flashcard for the English word or phrase "${en}"${
    de ? ` with the German meaning "${de}"` : ""
  }. Estimate the CEFR level honestly.

${CARD_FORMAT}

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
