// Prompts für die KI – werden vom Server (api/) und vom Browser genutzt.
// lang = englischer Name der Lernsprache, z. B. "Spanish" (Standard: English).

const READING = {
  Japanese: "Hepburn romaji",
  "Mandarin Chinese (simplified characters)": "pinyin with tone marks",
  Korean: "Revised Romanization",
  Russian: "simple Latin transliteration",
  Hindi: "simple Latin transliteration",
};

const SENT_RULE = (lang) =>
  `Split the story text into its sentences ("sentences", in order, together they are exactly the text). For each sentence give "t" = the sentence exactly as in the text (keep the ** marks), "wfw" = a word-for-word German decoding in the ${lang} word order (Birkenbihl method: each ${lang} word replaced by its literal German equivalent, even if the German sounds odd; join multi-word glosses with hyphens, e.g. "es-gibt"), and "de" = a natural, idiomatic German translation. Mark "p":true on the first sentence of every new paragraph.`;

// Zweiter Schritt: Sätze einer fertigen Geschichte Wort für Wort und frei übersetzen
export function decodeSystem(lang = "English") {
  return `You help German native speakers decode ${lang} texts (Birkenbihl method). You reply with valid JSON only, no markdown fences.`;
}
export function decodePrompt(text, lang = "English") {
  return `${SENT_RULE(lang)}

Text:
${text}

Return exactly: {"sentences":[{"t":"...","wfw":"...","de":"...","p":true}]}`;
}

// KI-Gespräch (Rollenspiel)
export function chatSystem({ scenario, level = "B1", words = [], lang = "English", goal = "" }) {
  return (
    `You are a friendly conversation partner for a German native speaker learning ${lang} (CEFR ${level}). ` +
    `Role-play this situation and stay in role: ${scenario}. Speak ONLY ${lang} in "reply", in short natural turns (1–3 sentences, CEFR ${level}), ` +
    `and end most turns with a question to keep the conversation going. ` +
    (words.length ? `Weave in these words the learner is practising, one or two per turn, so the learner hears and reuses them: ${words.join(", ")}. ` : "") +
    (goal ? `The learner's goal in this conversation: ${goal}. After about 6 learner turns, steer naturally towards a goodbye. ` : "") +
    `Reply with valid JSON only: {"reply":"<your turn in ${lang}>","de":"<German translation of your turn>",` +
    `"correction":"<if the learner's last message had mistakes: short friendly German explanation with the corrected ${lang} sentence; otherwise empty string>",` +
    `"suggestions":[{"t":"<a natural short answer the learner could give, in ${lang}, CEFR ${level}>","de":"<German>"},{"t":"<a different answer>","de":"<German>"}],` +
    `"words":[{"en":"<a useful ${lang} word or phrase from your reply the learner may not know yet (dictionary form)>","de":"<German>"}],` +
    `"bye":<true if the conversation has clearly ended with a goodbye, else false>}`
  );
}

// „Sag …“: Deutsch eingeben → so sagt man es in der Lernsprache
export function saySystem(lang = "English", level = "B1") {
  return `Translate what a German learner wants to say into natural, simple ${lang} (CEFR ${level}) for a spoken conversation. Reply with valid JSON only: {"t":"<${lang}>"}`;
}

export function chatTranscript(history = []) {
  return history.length
    ? history.map((m) => `${m.role === "user" ? "Learner" : "You"}: ${m.text}`).join("\n")
    : "(The conversation starts now. Open the scene with a short greeting and a question.)";
}

// Robust: Geschichte auch erkennen, wenn die KI sie verschachtelt oder anders benennt
export function storyFrom(data) {
  let d = Array.isArray(data) ? data[0] : data;
  if (d && typeof d === "object" && !d.text) d = d.story || d.result || d.data || d;
  if (!d || typeof d !== "object") return null;
  if (typeof d.text !== "string" || !d.text.trim()) {
    const alt = d.story_text || d.content || d.body || (Array.isArray(d.paragraphs) ? d.paragraphs.join("\n\n") : "");
    if (typeof alt === "string" && alt.trim()) d = { ...d, text: alt };
    else if (Array.isArray(d.sentences) && d.sentences.length) {
      let t = "";
      d.sentences.forEach((x, i) => (t += (i && x.p ? "\n\n" : i ? " " : "") + String(x.t || "")));
      d = { ...d, text: t };
    } else return null;
  }
  return d;
}

export function storySystem(lang = "English") {
  return (
    `You write short graded-reader stories for an adult German native speaker who is learning ${lang}. ` +
    `You write natural, engaging ${lang}, never childish. You reply with valid JSON only, no markdown fences, no commentary.`
  );
}
export const STORY_SYSTEM = storySystem("English");

// words: Wörter, die geübt werden (müssen alle vorkommen)
// known: Wörter, die schon sitzen (zur Wiederholung, so viele wie natürlich passen)
// withSentences=false: nur Geschichte (schnell); die Satz-Übersetzungen kommen danach per decodePrompt
export function storyPrompt(words, level = "B2", theme = "", known = [], lang = "English", withSentences = true) {
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
- Language level: CEFR ${level}. 98 % rule: apart from the listed words, at least 98 % of all running words must be very common, high-frequency vocabulary that a learner at this level surely knows. No rare words, slang, idioms or unusual proper names, so the listed words stand out and can be understood from context.
- Use EVERY target word at least once (inflected forms are fine) in a meaning that matches the German gloss.
- Mark every occurrence of a target word${known.length ? " and of every review word you use" : ""} with double asterisks, e.g. **word**. Mark nothing else.
- A coherent plot with a small twist or a clear ending, adult everyday or professional setting, a fitting title.
- Then write 4 multiple-choice comprehension questions in ${lang} with 4 options each. "answer" is the 0-based index of the correct option. Vary the position of the correct answer.
- For each marked word give the German meaning as used in the story${reading ? ` and its reading in ${reading} ("rd")` : ""}.
${withSentences ? `- ${SENT_RULE(lang)}\n` : ""}
Return exactly this JSON structure:
{"title":"...","text":"..."${withSentences ? ',"sentences":[{"t":"...","wfw":"...","de":"...","p":true}]' : ""},"questions":[{"q":"...","options":["...","...","...","..."],"answer":0}],"glossary":[{"en":"<${lang} word>","de":"..."${reading ? ',"rd":"..."' : ""}}]}`;
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
