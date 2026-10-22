// Datenhaltung im Browser (localStorage)
import { seedCards, topicsFor, slug, LEVELS, loadBank, bankLang } from "./words.js";
import { DAY, startOfDay } from "./fsrs.js";
import { LANGS, READY, SETTINGS_KEY, currentLang } from "./langs.js";

// Jede Lernsprache hat ihren eigenen Speicher (Englisch behält den alten Schlüssel).
// Die Einstellungen sind gemeinsam – bis auf die, die nur für eine Sprache gelten.
const keyFor = (lang) => (lang === "en" ? "wortwerk.v1" : "wortwerk.v1." + lang);
const PER_LANG = ["startLevel", "storyLevel", "activeTopics", "focusTopic"];
const pickKeys = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const omitKeys = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

function readGlobal() {
  try {
    const g = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (g) return g;
    // Umstieg: bisher standen alle Einstellungen im englischen Speicher
    const en = JSON.parse(localStorage.getItem("wortwerk.v1") || "null");
    return en?.settings ? omitKeys(en.settings, PER_LANG) : {};
  } catch {
    return {};
  }
}

export const lang = () => bankLang();
export const LEARNED_DAYS = 21; // ab dieser Stabilität gilt ein Wort als "gelernt"
const LEVEL_ORDER = LEVELS;

export const DEFAULT_SETTINGS = {
  newPerDay: 10,
  storyEvery: 10,
  retention: 0.9,
  startLevel: "B1",
  storyLevel: "B2",
  voiceRate: 0.95,
  design: "glas", // glas | bordkarte | heft
  voicePreset: "clear-f", // clear-f/m, friend-f/m, strict-f/m
  apiBase: "",
  appSecret: "",
  typeAnswer: false,
  autoSpeak: true,
  voiceNatural: true, // fertige Aufnahmen einer neuronalen Stimme nutzen // Stimme an/aus (automatisches Vorlesen)
  provider: "auto", // auto | claude | gemini | ollama | browser
  ollamaModel: "",
  geminiKey: "", // nur für "Gemini direkt im Browser"; bleibt auf diesem Gerät
  geminiModel: "",
  activeTopics: null, // null = alle Themen aktiv, sonst Liste der Themen-Schlüssel
  focusTopic: null, // gewähltes Thema: neue Wörter nur daraus (null = Themen abwechselnd)
};

// Nur diese Felder werden für Wörter aus der Wortliste gespeichert –
// die Wortliste selbst kommt aus dem Code (js/words.js, js/wordbank.js).
const PROGRESS_KEYS = ["state", "stability", "difficulty", "due", "lastReview", "reps", "lapses", "introducedAt", "knownAt", "inStory", "weak", "weakOk"];

function pickProgress(c) {
  const p = {};
  for (const k of PROGRESS_KEYS) if (c[k] !== undefined) p[k] = c[k];
  return p;
}

function fresh() {
  const cards = {};
  for (const c of seedCards()) cards[c.id] = c;
  return {
    version: 4,
    created: Date.now(),
    cards,
    settings: { ...DEFAULT_SETTINGS, ...readGlobal(), lang: bankLang() },
    days: {}, // "YYYY-MM-DD": { reviews, newCards, correct }
    totalReviews: 0,
    stories: [],
    blockTopic: null, // Thema, aus dem gerade neue Wörter kommen
    blockCount: 0,
    customTopics: {}, // eigene Themen { schlüssel: "Name" }
  };
}

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(keyFor(bankLang()));
    if (raw) {
      state = JSON.parse(raw);
      state.settings = { ...(state.settings || {}), ...readGlobal(), ...pickKeys(state.settings || {}, PER_LANG), lang: bankLang() };
      migrate();
      mergeSeed();
    }
  } catch (e) {
    console.warn("Speicher konnte nicht gelesen werden", e);
  }
  if (!state) {
    state = fresh();
    save();
  }
  return state;
}

// Ältere Speicherstände auf das aktuelle Format bringen
function migrate() {
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  state.customTopics = state.customTopics || {};
  state.stories = state.stories || [];
  state.cards = state.cards || {};
  if ((state.version || 1) < 3) {
    // Wörter aus bisherigen Geschichten markieren
    for (const st of state.stories) {
      for (const id of st.wordIds || []) {
        const c = state.cards[id];
        if (c) c.inStory = Math.max(c.inStory || 0, 1);
      }
    }
  }
  delete state.newSinceStory;
  delete state.storyQueue;
  state.version = 4;
}

// Wortliste aus dem Code + gespeicherter Fortschritt + eigene Wörter zusammenführen
function mergeSeed() {
  const saved = state.cards || {};
  const cards = {};
  for (const c of seedCards()) {
    const have = saved[c.id];
    cards[c.id] = have && !have.custom ? { ...c, ...pickProgress(have) } : c;
  }
  for (const [id, c] of Object.entries(saved)) {
    if (c.custom) cards[id] = c;
    else if (!cards[id] && c.en) cards[id] = c; // Wort, das es in der Liste nicht mehr gibt
  }
  state.cards = cards;
  save();
}

// Speichert eigene Wörter vollständig, Wörter der Liste nur mit ihrem Fortschritt
function serialize() {
  const out = { ...state, cards: {} };
  for (const c of Object.values(state.cards)) {
    if (c.custom) out.cards[c.id] = c;
    else if (c.state !== "new" || c.inStory || c.introducedAt) out.cards[c.id] = pickProgress(c);
  }
  return out;
}

export function save() {
  try {
    const out = serialize();
    out.settings = pickKeys(state.settings, PER_LANG);
    localStorage.setItem(keyFor(bankLang()), JSON.stringify(out));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...omitKeys(state.settings, PER_LANG), lang: bankLang() }));
  } catch (e) {
    alert("Speichern fehlgeschlagen: " + e.message);
  }
}

export function getState() {
  return load();
}

export function cards() {
  return Object.values(load().cards);
}

export function updateCard(card) {
  load().cards[card.id] = card;
  save();
}

// ---------- Themen ----------

export function allTopics() {
  return { ...topicsFor(bankLang()), ...(load().customTopics || {}) };
}

export function topicLabel(key) {
  return allTopics()[key] || key || "";
}

export function activeTopicKeys() {
  const s = load();
  const keys = Object.keys(allTopics());
  const act = s.settings.activeTopics;
  return Array.isArray(act) ? keys.filter((k) => act.includes(k)) : keys;
}

export function setTopicActive(key, on) {
  const s = load();
  let act = Array.isArray(s.settings.activeTopics) ? [...s.settings.activeTopics] : Object.keys(allTopics());
  act = act.filter((k) => k !== key);
  if (on) act.push(key);
  s.settings.activeTopics = act;
  save();
}

export function addCustomTopic(label) {
  const s = load();
  const name = label.trim().slice(0, 40);
  if (!name) return null;
  const existing = Object.entries(allTopics()).find(([, v]) => v.toLowerCase() === name.toLowerCase());
  if (existing) return existing[0];
  const key = "u-" + (slug(name) || Date.now().toString(36));
  s.customTopics[key] = name;
  if (Array.isArray(s.settings.activeTopics)) s.settings.activeTopics.push(key);
  save();
  return key;
}

export function deleteCustomTopic(key) {
  const s = load();
  delete s.customTopics[key];
  for (const c of cards()) if (c.topic === key && c.state === "new" && c.custom) delete s.cards[c.id];
  if (Array.isArray(s.settings.activeTopics)) s.settings.activeTopics = s.settings.activeTopics.filter((k) => k !== key);
  save();
}

// Wörter je Niveau: wie viele es gibt und wie viele davon sicher sitzen.
// key = Themen-Schlüssel, ohne key = gesamter Wortschatz.
export function levelStats(key) {
  const list = key ? cards().filter((c) => c.topic === key) : cards();
  const out = {};
  for (const L of LEVEL_ORDER) {
    const inL = list.filter((c) => c.level === L);
    out[L] = {
      total: inL.length,
      secure: inL.filter((c) => c.state === "known" || isLearned(c)).length,
      learning: inL.filter((c) => categorize(c) === "learning").length,
    };
  }
  return out;
}

export function topicStats(key) {
  const list = cards().filter((c) => c.topic === key);
  const st = { total: list.length, new: 0, learning: 0, learned: 0, known: 0 };
  for (const c of list) st[categorize(c)]++;
  return st;
}

// Fortschritt eines Themas: wie viele Wörter sicher sitzen und wie viele noch
// fehlen, bis das aktuelle Niveau in diesem Thema abgeschlossen ist.
export function topicLevelInfo(key) {
  const list = cards().filter((c) => c.topic === key);
  const secure = (c) => c.state === "known" || isLearned(c);
  const info = {
    total: list.length,
    secure: list.filter(secure).length,
    newLeft: list.filter((c) => c.state === "new").length,
    level: null, // Niveau, an dem gerade gearbeitet wird
    remaining: 0, // Wörter bis dieses Niveau abgeschlossen ist
    nextLevel: null, // Niveau danach
  };
  const from = Math.max(0, LEVEL_ORDER.indexOf(load().settings.startLevel));
  for (let i = from; i < LEVEL_ORDER.length; i++) {
    const open = list.filter((c) => c.level === LEVEL_ORDER[i] && !secure(c)).length;
    if (open > 0) {
      info.level = LEVEL_ORDER[i];
      info.remaining = open;
      info.nextLevel = LEVEL_ORDER[i + 1] || null;
      break;
    }
  }
  return info;
}

export function topicProgressText(key) {
  const t = topicLevelInfo(key);
  if (!t.total) return "noch keine Wörter";
  const parts = [];
  if (t.secure) parts.push(`${t.secure} ${t.secure === 1 ? "Wort" : "Wörter"} sicher`);
  if (!t.level) parts.push("alle Niveaus geschafft");
  else if (t.nextLevel) parts.push(`noch ${t.remaining} bis ${t.nextLevel}`);
  else parts.push(`noch ${t.remaining} bis C1 komplett`);
  return parts.join(" · ");
}

export function setFocusTopic(key) {
  const s = load();
  s.settings.focusTopic = key || null;
  if (key) {
    // sofort mit diesem Thema einen neuen Block beginnen
    if (s.blockTopic !== key) {
      s.blockTopic = key;
      s.blockCount = 0;
    }
  }
  save();
}

// ---------- Tage & Wiederholungen ----------

export function dayKey(t = Date.now()) {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

export function today() {
  const s = load();
  const k = dayKey();
  if (!s.days[k]) s.days[k] = { reviews: 0, newCards: 0, correct: 0 };
  return s.days[k];
}

export function logReview(grade, card, wasNew) {
  const s = load();
  const d = today();
  d.reviews++;
  if (grade > 1) d.correct++;
  if (wasNew) {
    d.newCards++;
    if (s.blockTopic === card.topic && s.blockCount < s.settings.storyEvery) s.blockCount++;
    else {
      s.blockTopic = card.topic;
      s.blockCount = 1;
    }
  }
  s.totalReviews++;
  save();
}

export function isLearned(c) {
  return c.state === "review" && (c.stability || 0) >= LEARNED_DAYS;
}

export function categorize(c) {
  if (c.state === "known") return "known";
  if (c.state === "new") return "new";
  if (isLearned(c)) return "learned";
  return "learning";
}

export function dueCards(now = Date.now()) {
  const end = startOfDay(now) + DAY;
  return cards()
    .filter((c) => (c.state === "review" || c.state === "learning") && c.due <= end)
    .sort((a, b) => a.due - b.due);
}

// Neue Wörter themenweise in Blöcken (Blockgröße = Wörter pro Geschichte),
// damit jede Geschichte aus einem Thema entsteht.
export function nextNewCards(n) {
  const s = load();
  if (n <= 0) return [];
  const active = activeTopicKeys();
  const minLevel = LEVEL_ORDER.indexOf(s.settings.startLevel);
  const pool = cards()
    .filter((c) => c.state === "new" && LEVEL_ORDER.indexOf(c.level) >= minLevel)
    .filter((c) => active.includes(c.topic) || (c.custom && c.order < 0))
    .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));

  const res = [];
  const used = new Set();
  // Eigene Wörter mit "Als Nächstes lernen" zuerst
  for (const c of pool) {
    if (res.length >= n) break;
    if (c.custom && c.order < 0) {
      res.push(c);
      used.add(c.id);
    }
  }

  const avail = (t) => pool.find((c) => c.topic === t && !used.has(c.id));

  // Gewähltes Thema: nur daraus (unabhängig vom An/Aus-Schalter)
  const focus = s.settings.focusTopic;
  if (focus) {
    const focusPool = cards()
      .filter((c) => c.state === "new" && c.topic === focus && LEVEL_ORDER.indexOf(c.level) >= minLevel && !used.has(c.id))
      .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
    for (const c of focusPool) {
      if (res.length >= n) break;
      res.push(c);
      used.add(c.id);
    }
    return res;
  }

  let topic = s.blockTopic;
  let count = s.blockCount || 0;
  while (res.length < n) {
    if (!topic || !active.includes(topic) || count >= s.settings.storyEvery || !avail(topic)) {
      const start = topic && active.includes(topic) ? active.indexOf(topic) : -1;
      let next = null;
      for (let i = 1; i <= active.length; i++) {
        const t = active[(start + i + active.length) % active.length];
        if (avail(t)) {
          next = t;
          break;
        }
      }
      if (!next) break;
      topic = next;
      count = 0;
    }
    const c = avail(topic);
    res.push(c);
    used.add(c.id);
    count++;
  }
  return res;
}

// Jede Lerneinheit bietet immer volle Blöcke neuer Wörter an (Standard: 10),
// unabhängig davon, wie viele heute schon gelernt wurden.
export function newCardsToday() {
  const s = load();
  return nextNewCards(Math.max(1, s.settings.newPerDay));
}

export function newWordsLeft() {
  return nextNewCards(1).length > 0;
}

export function streak() {
  const s = load();
  let n = 0;
  let t = Date.now();
  // Heute zählt nur, wenn schon gelernt wurde; sonst ab gestern zählen
  if (!s.days[dayKey(t)]?.reviews) t -= DAY;
  while (s.days[dayKey(t)]?.reviews) {
    n++;
    t -= DAY;
  }
  return n;
}

export function weekDots() {
  // Mo–So der aktuellen Woche
  const s = load();
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = startOfDay(now.getTime()) - dow * DAY;
  const labels = ["M", "D", "M", "D", "F", "S", "S"];
  return labels.map((l, i) => {
    const t = monday + i * DAY + 12 * 3600000;
    return {
      label: l,
      done: !!s.days[dayKey(t)]?.reviews,
      isToday: i === dow,
      future: i > dow,
    };
  });
}

// ---------- Wort nachschlagen (für Geschichten) ----------
let wordIndex = null;
function index() {
  if (!wordIndex) {
    wordIndex = new Map();
    for (const c of cards()) wordIndex.set(c.en.toLowerCase(), c);
  }
  return wordIndex;
}

// Grundform raten: travelled → travel, countries → country, making → make …
export function lemmaCandidates(word) {
  if (bankLang() !== "en") {
    const w = word.toLowerCase();
    return [w, w.replace(/(es|s)$/, ""), w.replace(/s$/, "")].filter((x, i, a) => x && a.indexOf(x) === i);
  }
  const w = word.toLowerCase().replace(/[’']s$/, "");
  const c = [w];
  const add = (x) => x && x.length > 1 && !c.includes(x) && c.push(x);
  if (w.endsWith("ies")) add(w.slice(0, -3) + "y");
  if (w.endsWith("es")) add(w.slice(0, -2));
  if (w.endsWith("s")) add(w.slice(0, -1));
  if (w.endsWith("ied")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ed")) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
    if (/(.)\1ed$/.test(w)) add(w.slice(0, -3));
  }
  if (w.endsWith("ing")) {
    add(w.slice(0, -3));
    add(w.slice(0, -3) + "e");
    if (/(.)\1ing$/.test(w)) add(w.slice(0, -4));
  }
  if (w.endsWith("er")) add(w.slice(0, -2));
  if (w.endsWith("est")) add(w.slice(0, -3));
  if (w.endsWith("ly")) add(w.slice(0, -2));
  return c;
}

export function lookupWord(word) {
  const idx = index();
  for (const k of lemmaCandidates(word)) if (idx.has(k)) return idx.get(k);
  return null;
}

// ---------- „Muss ich noch lernen“ ----------
// Wörter, die du als „Muss ich noch lernen“ markiert hast. Sie kommen zusätzlich
// immer wieder dran, bis du sie zweimal hintereinander gewusst hast.
export function weakCards() {
  return cards().filter((c) => c.weak && c.state !== "known");
}

export function markWeak(card, knewIt) {
  const c = { ...card };
  if (knewIt) {
    if (c.weak) {
      c.weakOk = (c.weakOk || 0) + 1;
      if (c.weakOk >= 2) {
        c.weak = false;
        c.weakOk = 0;
      }
    }
  } else {
    c.weak = true;
    c.weakOk = 0;
  }
  return c;
}

// ---------- Eigene Wörter ----------

export function addCustomCard(data) {
  const s = load();
  const id = "c-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const maxOrder = Math.max(0, ...cards().map((c) => c.order ?? 0));
  const card = {
    id,
    en: data.en.trim(),
    de: (data.de || "").trim(),
    pos: data.pos || "",
    level: LEVEL_ORDER.includes(data.level) ? data.level : "B2",
    topic: data.topic || "alltag",
    ex: data.ex || "",
    exDe: data.exDe || "",
    note: data.note || "",
    order: data.front ? -Date.now() : maxOrder + 1, // "Als Nächstes lernen" → kommt vor allen anderen
    state: "new",
    custom: true,
  };
  s.cards[id] = card;
  wordIndex = null;
  save();
  return card;
}

export function hasWord(en) {
  const k = en.trim().toLowerCase();
  return cards().some((c) => c.en.toLowerCase() === k);
}

export function deleteCard(id) {
  const s = load();
  delete s.cards[id];
  save();
}

// ---------- Geschichten ----------

const isSecure = (c) => c.state === "known" || isLearned(c);

// Wörter, die du schon gesehen hast, aber noch nicht sicher kannst –
// und die noch in keiner Geschichte vorkamen.
function practiceCards() {
  return cards().filter((c) => c.introducedAt && c.state !== "new" && !isSecure(c) && !c.inStory);
}

export function storyProgress() {
  return Math.min(practiceCards().length, load().settings.storyEvery);
}

export function storyReady() {
  return practiceCards().length >= load().settings.storyEvery;
}

const shuffled = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// Wörter für die nächste Geschichte:
// - learning: 10 gesehene, noch nicht sichere Wörter (bevorzugt aus einem Thema)
// - known: bis zu 5 Wörter, die du schon sicher kannst (bevorzugt aus demselben Thema)
export function storyCandidates() {
  const s = load();
  const n = s.settings.storyEvery;
  const practice = practiceCards();
  const byTopic = {};
  for (const c of practice) (byTopic[c.topic] ||= []).push(c);
  const mainTopic = Object.entries(byTopic).sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  const sorted = practice.sort((a, b) => {
    const t = Number(b.topic === mainTopic) - Number(a.topic === mainTopic);
    return t || (a.introducedAt || 0) - (b.introducedAt || 0);
  });
  const learning = sorted.slice(0, n);

  const secure = cards().filter(isSecure);
  const known = [
    ...shuffled(secure.filter((c) => c.topic === mainTopic)),
    ...shuffled(secure.filter((c) => c.topic !== mainTopic)),
  ].slice(0, 5);
  return { learning, known };
}

// Häufigstes Thema der Wörter → Rahmen für die Geschichte
export function storyTheme(words) {
  const count = {};
  for (const w of words) count[w.topic] = (count[w.topic] || 0) + 1;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return top ? topicLabel(top[0]) : "";
}

export function addStory(story) {
  const s = load();
  s.stories.unshift(story);
  // Die Übungswörter dieser Geschichte zählen für die nächste nicht mehr
  for (const id of story.wordIds || []) {
    if (s.cards[id]) s.cards[id].inStory = (s.cards[id].inStory || 0) + 1;
  }
  save();
}

export function updateStory(story) {
  const s = load();
  const i = s.stories.findIndex((x) => x.id === story.id);
  if (i >= 0) s.stories[i] = story;
  save();
}

export function deleteStory(id) {
  const s = load();
  s.stories = s.stories.filter((x) => x.id !== id);
  save();
}

// ---------- Sicherung ----------

export function exportData() {
  // Alle Sprachen in einer Datei; Schlüssel und Passwörter gehören nicht hinein
  load();
  save();
  const langs = {};
  for (const code of Object.keys(LANGS)) {
    const raw = localStorage.getItem(keyFor(code));
    if (raw) langs[code] = JSON.parse(raw);
  }
  const settings = { ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"), geminiKey: "", appSecret: "" };
  return JSON.stringify({ format: "wortwerk-multi", version: 5, settings, langs }, null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  const keep = { geminiKey: load().settings.geminiKey, appSecret: load().settings.appSecret };
  if (data.format === "wortwerk-multi") {
    for (const [code, st] of Object.entries(data.langs || {})) if (LANGS[code]) localStorage.setItem(keyFor(code), JSON.stringify(st));
    const g = { ...data.settings, geminiKey: data.settings?.geminiKey || keep.geminiKey, appSecret: data.settings?.appSecret || keep.appSecret, lang: bankLang() };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(g));
    state = null;
    load();
    return;
  }
  // ältere Sicherung (nur Englisch)
  if (!data.cards || !data.settings) throw new Error("Ungültige Sicherungsdatei");
  localStorage.setItem("wortwerk.v1", JSON.stringify(data));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...omitKeys(data.settings, PER_LANG), geminiKey: keep.geminiKey, appSecret: keep.appSecret, lang: bankLang() }));
  state = null;
  load();
}

// Setzt nur die aktuelle Sprache zurück; Einstellungen bleiben
export function resetAll() {
  localStorage.removeItem(keyFor(bankLang()));
  state = null;
  load();
}

// Lernsprache wechseln: Wortliste laden, Speicher der Sprache öffnen
export async function setLanguage(code) {
  if (!LANGS[code] || !READY.includes(code)) return;
  if (state) save();
  await loadBank(code);
  const g = readGlobal();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...g, lang: code }));
  state = null;
  load();
}

export async function init() {
  await loadBank(currentLang());
  load();
}

// Kurzüberblick für die Sprachauswahl: wie viele Wörter sicher sitzen
export function langSummary(code) {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(code)) || "null");
    if (!raw) return null;
    const cs = Object.values(raw.cards || {});
    return { started: cs.length, learned: cs.filter((c) => c.state === "known" || (c.stability || 0) >= LEARNED_DAYS).length };
  } catch {
    return null;
  }
}
