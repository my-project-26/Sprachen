// Datenhaltung im Browser (localStorage)
import { seedCards } from "./words.js";
import { DAY, startOfDay } from "./fsrs.js";

const KEY = "wortwerk.v1";
export const LEARNED_DAYS = 21; // ab dieser Stabilität gilt ein Wort als "gelernt"

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
};

function fresh() {
  const cards = {};
  for (const c of seedCards()) cards[c.id] = c;
  return {
    version: 1,
    created: Date.now(),
    cards,
    settings: { ...DEFAULT_SETTINGS },
    days: {}, // "YYYY-MM-DD": { reviews, newCards, correct }
    totalReviews: 0,
    stories: [],
    newSinceStory: 0,
  };
}

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw);
      state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
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

// Neue Einträge der Startliste (nach Updates) ergänzen, ohne Fortschritt zu verlieren
function mergeSeed() {
  let changed = false;
  for (const c of seedCards()) {
    if (!state.cards[c.id]) {
      state.cards[c.id] = c;
      changed = true;
    }
  }
  if (changed) save();
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

export function logReview(grade, wasNew) {
  const s = load();
  const d = today();
  d.reviews++;
  if (grade > 1) d.correct++;
  if (wasNew) {
    d.newCards++;
    s.newSinceStory = (s.newSinceStory || 0) + 1;
  }
  s.totalReviews++;
  save();
}

const LEVEL_ORDER = ["B1", "B2", "C1"];

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

export function newCardsToday() {
  const s = load();
  const left = Math.max(0, s.settings.newPerDay - today().newCards);
  const minLevel = LEVEL_ORDER.indexOf(s.settings.startLevel);
  return cards()
    .filter((c) => c.state === "new" && LEVEL_ORDER.indexOf(c.level) >= minLevel)
    .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9))
    .slice(0, left);
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
    order: data.front ? -Date.now() : maxOrder + 1, // eigene Wörter kommen als Nächstes dran
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
  delete load().cards[id];
  save();
}

export function addStory(story) {
  const s = load();
  s.stories.unshift(story);
  s.newSinceStory = 0;
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

// Wörter für die nächste Geschichte: zuletzt eingeführte + "schwierige" Wörter
export function storyCandidates() {
  const s = load();
  const n = s.settings.storyEvery;
  const introduced = cards()
    .filter((c) => c.introducedAt && c.state !== "known")
    .sort((a, b) => b.introducedAt - a.introducedAt);
  const recent = introduced.slice(0, n);
  const ids = new Set(recent.map((c) => c.id));
  const hard = introduced
    .filter((c) => !ids.has(c.id) && ((c.lapses || 0) >= 2 || (c.difficulty || 0) > 8))
    .slice(0, 3);
  return [...recent, ...hard];
}

export function storyReady() {
  const s = load();
  return (s.newSinceStory || 0) >= s.settings.storyEvery;
}

export function exportData() {
  return JSON.stringify(load(), null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  if (!data.cards || !data.settings) throw new Error("Ungültige Sicherungsdatei");
  state = data;
  state.settings = { ...DEFAULT_SETTINGS, ...state.settings };
  save();
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = null;
  load();
}
