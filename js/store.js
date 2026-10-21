// Datenhaltung im Browser (localStorage)
import { seedCards, TOPICS, slug } from "./words.js";
import { DAY, startOfDay } from "./fsrs.js";

const KEY = "wortwerk.v1";
export const LEARNED_DAYS = 21; // ab dieser Stabilität gilt ein Wort als "gelernt"
const LEVEL_ORDER = ["B1", "B2", "C1"];

export const DEFAULT_SETTINGS = {
  newPerDay: 10,
  storyEvery: 10,
  retention: 0.9,
  startLevel: "B1",
  storyLevel: "B2",
  voiceRate: 0.95,
  voiceName: "",
  apiBase: "",
  appSecret: "",
  typeAnswer: false,
  autoSpeak: true,
  provider: "auto", // auto | claude | gemini | ollama
  ollamaModel: "",
  activeTopics: null, // null = alle Themen aktiv, sonst Liste der Themen-Schlüssel
};

function fresh() {
  const cards = {};
  for (const c of seedCards()) cards[c.id] = c;
  return {
    version: 2,
    created: Date.now(),
    cards,
    settings: { ...DEFAULT_SETTINGS },
    days: {}, // "YYYY-MM-DD": { reviews, newCards, correct }
    totalReviews: 0,
    stories: [],
    storyQueue: [], // neu gelernte Wörter seit der letzten Geschichte
    blockTopic: null, // Thema, aus dem gerade neue Wörter kommen
    blockCount: 0,
    customTopics: {}, // eigene Themen { schlüssel: "Name" }
  };
}

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw);
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
  if (!Array.isArray(state.storyQueue)) {
    const n = Math.min(state.newSinceStory || 0, 30);
    state.storyQueue = Object.values(state.cards)
      .filter((c) => c.introducedAt && c.state !== "known")
      .sort((a, b) => b.introducedAt - a.introducedAt)
      .slice(0, n)
      .map((c) => c.id)
      .reverse();
  }
  delete state.newSinceStory;
  state.version = 2;
}

// Neue Einträge der Startliste ergänzen und Reihenfolge aktualisieren, ohne Fortschritt zu verlieren
function mergeSeed() {
  for (const c of seedCards()) {
    const have = state.cards[c.id];
    if (!have) state.cards[c.id] = c;
    else if (!have.custom) {
      have.order = c.order;
      have.topic = c.topic;
    }
  }
  save();
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
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
  return { ...TOPICS, alltag: "Alltag", ...(load().customTopics || {}) };
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

export function topicStats(key) {
  const list = cards().filter((c) => c.topic === key);
  const st = { total: list.length, new: 0, learning: 0, learned: 0, known: 0 };
  for (const c of list) st[categorize(c)]++;
  return st;
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
    if (!s.storyQueue.includes(card.id)) s.storyQueue.push(card.id);
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

export function newCardsToday() {
  const s = load();
  return nextNewCards(Math.max(0, s.settings.newPerDay - today().newCards));
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
  s.storyQueue = s.storyQueue.filter((x) => x !== id);
  save();
}

// ---------- Geschichten ----------

function queueCards() {
  const s = load();
  return s.storyQueue.map((id) => s.cards[id]).filter((c) => c && c.state !== "known");
}

export function storyProgress() {
  return Math.min(queueCards().length, load().settings.storyEvery);
}

export function storyReady() {
  return queueCards().length >= load().settings.storyEvery;
}

// Wörter für die nächste Geschichte: die neu gelernten Wörter + bis zu 3 "schwierige"
export function storyCandidates() {
  const s = load();
  // die zuletzt gelernten Wörter = der aktuelle Themenblock
  const recent = queueCards().slice(-s.settings.storyEvery);
  const ids = new Set(recent.map((c) => c.id));
  const hard = cards()
    .filter((c) => c.introducedAt && c.state !== "known" && !ids.has(c.id))
    .filter((c) => (c.lapses || 0) >= 2 || (c.difficulty || 0) > 8)
    .sort((a, b) => (b.lapses || 0) - (a.lapses || 0))
    .slice(0, 3);
  return [...recent, ...hard];
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
  s.storyQueue = []; // Zähler für die nächste Geschichte startet neu
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
  return JSON.stringify(load(), null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  if (!data.cards || !data.settings) throw new Error("Ungültige Sicherungsdatei");
  state = data;
  migrate();
  mergeSeed();
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = null;
  load();
}
