// FSRS-5 Scheduler (Free Spaced Repetition Scheduler) mit Standardparametern.
// Bewertung: 1 = Nochmal, 2 = Schwer, 3 = Gut, 4 = Leicht

const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
export const DAY = 86400000;
const RELEARN_MS = 5 * 60 * 1000; // Karte nach "Nochmal" in 5 Minuten erneut

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function initStability(g) {
  return Math.max(W[g - 1], 0.1);
}
function initDifficulty(g) {
  return clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);
}
export function retrievability(elapsedDays, s) {
  return Math.pow(1 + (FACTOR * elapsedDays) / s, DECAY);
}
function nextDifficulty(d, g) {
  const delta = -W[6] * (g - 3);
  const dp = d + (delta * (10 - d)) / 9;
  const target = initDifficulty(4);
  return clamp(W[7] * target + (1 - W[7]) * dp, 1, 10);
}
function successStability(d, s, r, g) {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return (
    s *
    (1 +
      Math.exp(W[8]) *
        (11 - d) *
        Math.pow(s, -W[9]) *
        (Math.exp(W[10] * (1 - r)) - 1) *
        hard *
        easy)
  );
}
function failStability(d, s, r) {
  const sf =
    W[11] *
    Math.pow(d, -W[12]) *
    (Math.pow(s + 1, W[13]) - 1) *
    Math.exp(W[14] * (1 - r));
  return Math.min(sf, s);
}
function shortTermStability(s, g) {
  return s * Math.exp(W[17] * (g - 3 + W[18]));
}

export function intervalDays(s, retention) {
  const i = (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return clamp(Math.round(i), 1, 36500);
}

function fuzz(days) {
  if (days < 3) return days;
  const f = days * 0.05;
  return Math.max(1, Math.round(days - f + Math.random() * 2 * f));
}

// Liefert eine neue Kopie der Karte nach einer Bewertung.
export function schedule(card, g, now = Date.now(), retention = 0.9, useFuzz = true) {
  const c = { ...card };
  const isNew = c.state === "new" || !c.stability;

  if (isNew) {
    c.stability = initStability(g);
    c.difficulty = initDifficulty(g);
    c.introducedAt = c.introducedAt || now;
  } else {
    const elapsed = Math.max(0, (now - (c.lastReview || now)) / DAY);
    const r = retrievability(elapsed, c.stability);
    if (elapsed < 1) {
      c.stability = Math.max(0.1, shortTermStability(c.stability, g));
    } else if (g === 1) {
      c.stability = Math.max(0.1, failStability(c.difficulty, c.stability, r));
    } else {
      c.stability = successStability(c.difficulty, c.stability, r, g);
    }
    c.difficulty = nextDifficulty(c.difficulty, g);
  }

  c.reps = (c.reps || 0) + 1;
  c.lastReview = now;

  if (g === 1) {
    if (!isNew && c.state === "review") c.lapses = (c.lapses || 0) + 1;
    c.state = "learning";
    c.due = now + RELEARN_MS;
  } else {
    const days = intervalDays(c.stability, retention);
    c.state = "review";
    c.due = startOfDay(now) + (useFuzz ? fuzz(days) : days) * DAY + 4 * 3600000;
  }
  return c;
}

// Vorschau der Intervalle für die vier Bewertungsknöpfe
export function preview(card, now = Date.now(), retention = 0.9) {
  const out = {};
  for (const g of [1, 2, 3, 4]) {
    const c = schedule(card, g, now, retention, false);
    out[g] = c.due - now;
  }
  return out;
}

export function formatInterval(ms) {
  if (ms < 3600000) return Math.max(1, Math.round(ms / 60000)) + " Min";
  if (ms < 6 * 3600000) return Math.round(ms / 3600000) + " Std";
  const d = Math.max(1, Math.round(ms / DAY));
  if (d < 31) return d + " T";
  if (d < 365) return (d / 30).toFixed(d < 90 ? 1 : 0).replace(".0", "") + " Mon";
  return (d / 365).toFixed(1).replace(".0", "") + " J";
}

export function startOfDay(t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
