// Wortwerk – Hauptlogik und Ansichten
import * as S from "./store.js";
import { schedule, preview, formatInterval, DAY, startOfDay } from "./fsrs.js";
import { TOPICS, LEVELS } from "./words.js";
import { storyPrompt, STORY_SYSTEM, extractJson } from "./prompts.js";
import { callApi, health, normalizeStory, isStaticHost, decodeStory, DEFAULT_SERVER } from "./api.js";
import * as tts from "./tts.js";
import { DESIGNS, designKey, applyDesign, skinHome, skinCard } from "./skins.js";
import * as cloud from "./cloud.js";
import { listenView, stopListening } from "./listen.js";
import { practiceView, micBlock, bindMic } from "./practice.js";
import { chatView } from "./chat.js";
import { LANGS, READY, L, checkAnswer } from "./langs.js";

const $app = document.getElementById("app");
const $nav = document.getElementById("nav");

// ---------- Hilfsfunktionen ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const marked = (t, cls = "hl") => esc(t).replace(/\*([^*]+)\*/g, `<b class="${cls}">$1</b>`);
const clozeHtml = (t) => esc(t).replace(/\*([^*]+)\*/g, '<span class="blank" aria-label="Lücke"></span>');
const plain = (t) => String(t || "").replace(/\*+/g, "");
const settings = () => S.getState().settings;
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const fmtDate = (t) => new Date(t).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function say(text, onend) {
  const s = settings();
  lastSaid = text;
  tts.setNatural(s.voiceNatural);
  tts.speak(text, { rate: s.voiceRate, preset: s.voicePreset, onend });
}

// Tempowahl Langsam / Mittel / Schnell – steht überall, wo etwas vorgelesen wird.
// replay: Text, der beim Umschalten (wenn gerade nichts läuft) als Probe kommt.
let lastSaid = "";
function rateSlider(id, replay = "") {
  const cur = tts.stepOfRate(settings().voiceRate);
  return `<div class="speed" role="group" aria-label="Sprechtempo" ${id ? `id="${id}"` : ""} ${replay ? `data-replay="${esc(replay)}"` : ""}>
    ${tts.RATE_STEPS.map((st, i) => `<button type="button" data-speed="${i}" class="${i === cur ? "on" : ""}" aria-pressed="${i === cur}">${st.label}</button>`).join("")}
  </div>`;
}
function bindRateSlider() {
  /* Tempowahl wird global über einen Klick-Listener bedient (siehe unten) */
}
const SPEED_IC = ["🐢", "🚶", "🐇"];
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-speed]");
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  const i = Number(b.dataset.speed);
  const st = tts.RATE_STEPS[i];
  S.getState().settings.voiceRate = st.rate;
  S.save();
  document.querySelectorAll(".speed [data-speed]").forEach((x) => {
    const on = Number(x.dataset.speed) === i;
    x.classList.toggle("on", on);
    x.setAttribute("aria-pressed", on);
  });
  // kompakte Tempo-Taste (Design „Award“): zeigt aktuelles Tempo, Tippen = nächstes
  document.querySelectorAll(".aw-speed").forEach((x) => {
    x.dataset.speed = String((i + 1) % tts.RATE_STEPS.length);
    x.innerHTML = `<i>${SPEED_IC[i]}</i><span>${st.label}</span>`;
  });
  if (!tts.setRate(st.rate)) {
    const replay = b.closest(".speed")?.dataset.replay || b.dataset.replay || "";
    if (replay) say(replay);
  }
}, true);

// Schalter „mit Stimme / ohne Stimme“
function voiceToggle() {
  const on = settings().autoSpeak;
  return `<button class="icon-btn voice-toggle ${on ? "on" : ""}" id="voiceToggle" aria-pressed="${on}" title="${on ? "Mit Stimme" : "Ohne Stimme"}">${on ? ICON.speaker : ICON.mute}</button>`;
}
function bindVoiceToggle(after) {
  const b = document.getElementById("voiceToggle");
  if (!b) return;
  b.onclick = () => {
    const st = S.getState();
    st.settings.autoSpeak = !st.settings.autoSpeak;
    S.save();
    if (!st.settings.autoSpeak) tts.stop();
    toast(st.settings.autoSpeak ? "Mit Stimme" : "Ohne Stimme");
    b.outerHTML = voiceToggle();
    bindVoiceToggle(after);
    after?.();
  };
}

let toastTimer;
function toast(msg, ms = 2600) {
  let el = document.getElementById("toast");
  el.innerHTML = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

const ICON = {
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-4-1-6 1-9.5Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8L7 4Z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

function bars(data, h = 130) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return `<div class="bars" style="--h:${h}px">${data
    .map(
      (d) => `<div class="bar-col">
        <div class="bar-track"><div class="bar ${d.cls || ""}" style="height:${(d.value / max) * 100}%">
          <span class="bar-val">${d.value || ""}</span></div></div>
        <div class="bar-label">${esc(d.label)}</div></div>`
    )
    .join("")}</div>`;
}

function progressRing(card) {
  const target = S.LEARNED_DAYS;
  let p = 0;
  if (card.state === "known") p = 1;
  else if (card.stability) p = Math.min(1, card.stability / target);
  const r = 14, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 36 36" aria-label="${Math.round(p * 100)} %">
    <circle cx="18" cy="18" r="${r}" class="ring-bg"/>
    <circle cx="18" cy="18" r="${r}" class="ring-fg" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 18 18)"/></svg>`;
}

// ---------- Router ----------
const routes = { home, learn, stories, story, words, add, topics, stats, settings: settingsView, listen: () => listenView($app, { settings, rateSlider, ICON }), practice: (m) => practiceView($app, { settings, rateSlider, ICON }, m || ""), chat: (k) => chatView($app, { settings, ICON }, k || "") };

function render() {
  if (document.documentElement.classList.contains("is-login")) return;
  stopListening();
  tts.stop();
  document.getElementById("toast").classList.remove("show");
  document.querySelectorAll(".sheet-backdrop, .word-pop").forEach((x) => x.remove());
  const [name, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  const arg = rest.length ? decodeURIComponent(rest.join("/")) : undefined;
  const view = routes[name] || home;
  document.body.dataset.view = routes[name] ? name : "home";
  const navKey = { story: "stories", add: "words", topics: "home", settings: "home", listen: "home", practice: "home", chat: "home" }[name] || (routes[name] ? name : "home");
  $nav.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.route === navKey));
  window.scrollTo(0, 0);
  view(arg);
}
window.addEventListener("hashchange", render);
const go = (h) => (location.hash = h);

// ---------- Start ----------
function home() {
  const s = S.getState();
  const due = S.dueCards();
  const news = S.newCardsToday();
  const total = due.length + news.length;
  const st = S.streak();
  const dots = S.weekDots();
  const ready = S.storyReady();
  const storyN = S.storyProgress();
  const prog = Math.min(1, storyN / s.settings.storyEvery);
  const all = S.cards();
  const active = S.activeTopicKeys();
  const allKeys = Object.keys(S.allTopics());
  const wordsLeft = S.newWordsLeft();
  const nextTopic = news.length ? S.topicLabel(news[news.length - 1].topic) : "";
  const focus = s.settings.focusTopic;
  const lvl = LEVELS.map((L) => {
    const inL = all.filter((c) => c.level === L);
    const ok = inL.filter((c) => S.isLearned(c) || c.state === "known").length;
    return { L, ok, total: inL.length };
  });

  const design = designKey(s.settings.design);
  if (design !== "paper") {
    const startIdx = Math.max(0, LEVELS.indexOf(s.settings.startLevel));
    const lv = lvl.slice(startIdx);
    let levelPos = lv.length - 1;
    for (let i = 0; i < lv.length; i++)
      if (lv[i].ok < lv[i].total) {
        levelPos = i + (lv[i].total ? lv[i].ok / lv[i].total : 0);
        break;
      }
    const sumT = lv.reduce((a, x) => a + x.total, 0);
    const sumOk = lv.reduce((a, x) => a + x.ok, 0);
    const weakList = S.weakCards();
    const d = {
      icon: ICON,
      lang: L(),
      userName: cloud.userName(),
      dateStr: new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }),
      weekday: new Date().toLocaleDateString("de-DE", { weekday: "long" }),
      total, due: due.length, news: news.length, weak: weakList.length,
      weakWords: weakList.slice(0, 5).map((c) => c.en),
      storyN, storyEvery: s.settings.storyEvery, ready, stories: s.stories.length,
      streak: st, secure: all.filter((c) => S.isLearned(c) || c.state === "known").length,
      lvl: lv, levelPos, levelPct: sumT ? Math.round((sumOk / sumT) * 100) : 0,
      topics: active.map((k) => {
        const info = S.topicLevelInfo(k);
        return { key: k, label: S.topicLabel(k), newLeft: info.newLeft, secure: info.secure, level: info.level };
      }),
      focus, focusLabel: focus ? S.topicLabel(focus) : nextTopic || "Themen abwechselnd", nextTopicLabel: nextTopic, wordsLeft,
    };
    const extraLevel = design === "glas"
      ? `<section class="card sk-level"><h2>Weg zu C1</h2>${lv
          .map(
            (x) => `<div class="lvl-row"><span class="badge lvl-${x.L}">${x.L}</span>
            <div class="meter"><div style="width:${x.total ? (x.ok / x.total) * 100 : 0}%"></div></div>
            <span class="small muted">${x.ok}/${x.total}</span></div>`
          )
          .join("")}</section>`
      : "";
    $app.innerHTML = `<div class="sk-home sk-${design}">${skinHome(design, d)}</div>${extraLevel}`;
    const pick = document.getElementById("pickTopic");
    if (pick) pick.onclick = () => topicPicker({ title: "Aus welchem Bereich sollen neue Wörter kommen?", onPick: () => home() });
    const ex = document.getElementById("extraBtn");
    if (ex)
      ex.onclick = () =>
        topicPicker({ title: "Aus welchem Bereich möchtest du 10 neue Wörter?", requireWords: true, onPick: () => go("#/learn/extra") });
    $app.querySelectorAll("[data-focus]").forEach(
      (b) =>
        (b.onclick = () => {
          S.setFocusTopic(b.dataset.focus === focus ? null : b.dataset.focus);
          home();
        })
    );
    return;
  }

  $app.innerHTML = `
  <header class="top">
    <div>
      <p class="eyebrow">${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</p>
      <h1>Hallo!</h1>
    </div>
    <span class="top-actions"><a class="icon-btn lang-btn" href="#/settings" aria-label="Sprache: ${L().name}">${L().flag}</a>
    <a class="icon-btn" href="#/settings" aria-label="Einstellungen">${ICON.gear}</a></span>
  </header>

  <section class="card streak">
    <div class="flame ${st ? "on" : ""}">${ICON.flame}<span>${st}</span></div>
    <div>
      <h2>${st ? (st === 1 ? "1 Tag am Stück" : `${st} Tage am Stück`) : "Starte deine Serie"}</h2>
      <div class="dots">${dots
        .map((d) => `<span class="dot ${d.done ? "done" : ""} ${d.isToday ? "today" : ""} ${d.future ? "future" : ""}">${d.done ? ICON.check : d.label}</span>`)
        .join("")}</div>
    </div>
  </section>

  <section class="card">
    <h2>Heute</h2>
    <div class="today">
      <div class="num-box"><strong>${due.length}</strong><span>Wiederholungen</span></div>
      <div class="plus">+</div>
      <div class="num-box accent"><strong>${news.length}</strong><span>Neue Wörter</span></div>
    </div>
    <div class="topic-line">
      <span class="small muted">Neue Wörter aus:</span>
      <b class="small">${esc(focus ? S.topicLabel(focus) : nextTopic || "Themen abwechselnd")}</b>
      <button class="link-btn small" id="pickTopic">ändern</button>
    </div>
    ${
      total
        ? `<a class="btn primary big" href="#/learn">${total} ${total === 1 ? "Wort" : "Wörter"} üben</a>`
        : wordsLeft
          ? `<p class="done-msg">Für heute ist alles erledigt.</p>
             <button class="btn ghost" id="extraBtn">10 weitere neue Wörter</button>`
          : `<p class="done-msg">In diesem Bereich gibt es keine neuen Wörter mehr.</p>
             <button class="btn ghost" id="extraBtn">Anderes Thema wählen</button>`
    }
  </section>

  <a class="card topics-teaser" href="#/topics">
    <div class="row-between"><h2>Deine Themen</h2><span class="small muted">Ändern ›</span></div>
    <div class="chips">${active
      .slice(0, 8)
      .map((k) => `<span class="chip">${esc(S.topicLabel(k))}</span>`)
      .join("")}${active.length > 8 ? `<span class="chip">+${active.length - 8}</span>` : ""}</div>
    ${active.length === allKeys.length ? `<p class="small muted">Alle Themen aktiv – wähle aus, was du wirklich brauchst.</p>` : ""}
  </a>

  ${(() => {
    const w = S.weakCards().length;
    return w
      ? `<section class="card weak-card">
          <div class="row-between"><h2>Muss ich noch lernen</h2><span class="badge-num">${w}</span></div>
          <p class="small muted">Diese Wörter kommen in jeder Sitzung zwischendurch wieder dran, bis du sie zweimal hintereinander gewusst hast.</p>
          <a class="btn ghost" href="#/learn/weak">Jetzt gezielt üben</a>
        </section>`
      : "";
  })()}

  <section class="card story-teaser ${ready ? "ready" : ""}">
    <div class="row-between">
      <h2>Nächste Geschichte</h2>
      <span class="muted small">${storyN} / ${s.settings.storyEvery} Übungswörter</span>
    </div>
    <div class="meter"><div style="width:${prog * 100}%"></div></div>
    <p class="muted">${
      ready
        ? "Du hast " + s.settings.storyEvery + " Wörter gesehen, die noch nicht sitzen – lies sie jetzt in einer Geschichte, zusammen mit Wörtern, die du schon kannst."
        : "Sobald " + s.settings.storyEvery + " Wörter gesehen, aber noch nicht sicher sind, entsteht eine Geschichte – gemischt mit Wörtern, die du schon kannst."
    }</p>
    ${ready ? `<a class="btn primary" href="#/story/new">Geschichte erstellen</a>` : `<a class="btn ghost" href="#/stories">Meine Geschichten (${s.stories.length})</a>`}
  </section>

  <section class="card">
    <h2>Weg zu C1</h2>
    ${lvl
      .map(
        (x) => `<div class="lvl-row"><span class="badge lvl-${x.L}">${x.L}</span>
        <div class="meter"><div style="width:${x.total ? (x.ok / x.total) * 100 : 0}%"></div></div>
        <span class="small muted">${x.ok}/${x.total}</span></div>`
      )
      .join("")}
    <p class="small muted">Zählt Wörter, die gelernt (Intervall ≥ ${S.LEARNED_DAYS} Tage) oder als bekannt markiert sind.</p>
  </section>`;

  document.getElementById("pickTopic").onclick = () => topicPicker({ title: "Aus welchem Bereich sollen neue Wörter kommen?", onPick: () => home() });
  const extra = document.getElementById("extraBtn");
  if (extra)
    extra.onclick = () =>
      topicPicker({ title: "Aus welchem Bereich möchtest du 10 neue Wörter?", requireWords: true, onPick: () => go("#/learn/extra") });
}

// Auswahl-Dialog: Bereich wählen, mit Fortschritt je Thema
function topicPicker({ title, onPick, requireWords = false }) {
  const s = S.getState();
  const all = S.allTopics();
  const active = new Set(S.activeTopicKeys());
  const focus = s.settings.focusTopic;
  const keys = Object.keys(all)
    .filter((k) => S.topicLevelInfo(k).total > 0)
    .sort((a, b) => Number(active.has(b)) - Number(active.has(a)));

  const overlay = document.createElement("div");
  overlay.className = "sheet-backdrop";
  overlay.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head"><h2>${esc(title)}</h2>
        <button class="icon-btn plain" data-close aria-label="Schließen">${ICON.close}</button></div>
      <div class="sheet-list">
        ${
          requireWords
            ? ""
            : `<button class="pick ${!focus ? "current" : ""}" data-key="">
                 <b>Alle aktiven Themen</b><span class="small muted">abwechselnd, je ${s.settings.storyEvery} Wörter pro Thema</span></button>`
        }
        ${keys
          .map((k) => {
            const info = S.topicLevelInfo(k);
            const empty = info.newLeft === 0;
            return `<button class="pick ${focus === k ? "current" : ""}" data-key="${k}" ${empty && requireWords ? "disabled" : ""}>
              <b>${esc(all[k])} <span class="pick-meta">(${esc(S.topicProgressText(k))})</span></b>
              <span class="small muted">${empty ? "keine neuen Wörter mehr – unter Themen mit KI erweitern" : `${info.newLeft} neue Wörter verfügbar`}</span>
            </button>`;
          })
          .join("")}
      </div>
      <a class="link-btn small" href="#/topics" data-close>Themen verwalten oder eigenes Thema anlegen</a>
    </div>`;
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-close]")) return close();
    const b = e.target.closest(".pick");
    if (!b || b.disabled) return;
    S.setFocusTopic(b.dataset.key || null);
    close();
    onPick?.(b.dataset.key || null);
  });
  document.body.appendChild(overlay);
}

// ---------- Lernsitzung ----------
let session = null;

function buildQueue(arg) {
  if (arg && arg.startsWith("story:")) {
    const st = S.getState().stories.find((x) => x.id === arg.slice(6));
    return (st?.wordIds || []).filter((id) => S.getState().cards[id]);
  }
  if (arg === "weak") return shuffle(S.weakCards().map((c) => c.id));
  const due = S.dueCards().map((c) => c.id);
  let news;
  if (arg === "extra") news = S.nextNewCards(Math.max(1, settings().newPerDay)).map((c) => c.id);
  else news = S.newCardsToday().map((c) => c.id);
  // Neue Wörter zwischen die Wiederholungen mischen (nach je 2 Wiederholungen eins)
  const q = [];
  while (due.length || news.length) {
    q.push(...due.splice(0, 2));
    if (news.length) q.push(news.shift());
  }
  // „Muss ich noch lernen“-Wörter zwischendurch immer wieder abfragen (bis zu 3 pro Sitzung)
  if (q.length && arg !== "extra") {
    const inQ = new Set(q);
    const extra = shuffle(S.weakCards().filter((c) => !inQ.has(c.id))).slice(0, 3);
    extra.forEach((c, i) => q.splice(Math.min(q.length, 3 + i * 4), 0, c.id));
  }
  return q;
}

function learn(arg) {
  session = { queue: buildQueue(arg), pos: 0, done: 0, correct: 0, again: 0, total: 0, fromStory: arg?.startsWith("story:") };
  session.total = session.queue.length;
  // Karten, die heute nicht fällig sind, werden nur geübt (ohne Intervall-Änderung)
  const dueIds = new Set([...S.dueCards(), ...S.cards().filter((c) => c.state === "new")].map((c) => c.id));
  session.practice = new Set(session.queue.filter((id) => !dueIds.has(id)));
  session.scheduled = new Set();
  if (!session.total) {
    $app.innerHTML = `<div class="center-msg"><h1>Nichts fällig</h1><p class="muted">Alle Karten sind erledigt.</p>
      <a class="btn primary" href="#/">Zur Startseite</a></div>`;
    return;
  }
  showCard();
}

function currentCard() {
  return S.getState().cards[session.queue[session.pos]];
}

function hintFor(word) {
  return word
    .split(" ")
    .map((w) => w[0] + " " + "_ ".repeat(Math.max(0, w.length - 1)).trim())
    .join("   ");
}

function sessionHeader() {
  const left = session.queue.length - session.pos;
  const pct = session.total ? Math.min(100, (session.done / (session.done + left)) * 100) : 0;
  return `<header class="session-top">
    <a class="icon-btn plain" href="#/" aria-label="Beenden">${ICON.close}</a>
    <div class="meter thin"><div style="width:${pct}%"></div></div>
    <span class="small muted">${left}</span>
    ${voiceToggle()}
  </header>`;
}

const POS_LABEL = { n: "Nomen", v: "Verb", adj: "Adjektiv", adv: "Adverb", prep: "Präposition", conj: "Konjunktion", phrase: "Ausdruck", num: "Zahl", pron: "Pronomen", det: "Begleiter" };

function showCard(revealed = false, typed = null) {
  const c = currentCard();
  if (!c) return sessionEnd();
  const isNew = c.state === "new";
  const s = settings();
  const noteFF = /false friend/i.test(c.note);

  const meta = `<div class="card-meta">
      <span class="badge lvl-${c.level}">${c.level}</span>
      <span class="chip">${esc(S.topicLabel(c.topic))}</span>
      ${isNew ? '<span class="chip new">Neu</span>' : ""}
      ${c.weak ? '<span class="chip warn">Noch lernen</span>' : ""}
    </div>`;

  let body;
  if (!revealed) {
    body = `
      ${meta}
      <p class="de-word">${esc(c.de)} ${c.pos ? `<small>(${esc(c.pos)})</small>` : ""}</p>
      ${c.ex ? `<p class="ex">${clozeHtml(c.ex)}</p>` : ""}
      ${c.exDe ? `<p class="ex-de">${marked(c.exDe)}</p>` : ""}
      <p class="hint" id="hint" hidden>${esc(hintFor(c.en))}</p>
      ${s.typeAnswer ? `<input id="answer" class="answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Wort auf ${L().name} eingeben…">` : ""}
    `;
  } else {
    const res = typed == null ? null : checkAnswer(typed, c);
    const ok = res == null ? null : res !== "bad";
    body = `
      ${meta}
      <div class="en-row">
        <p class="en-word">${esc(c.en)}</p>
      </div>
      ${c.rd ? `<p class="rd">${esc(c.rd)}</p>` : ""}
      ${typed != null ? `<p class="typed ${ok ? "ok" : "bad"}">${res === "ok" ? "Richtig!" : res === "almost" ? `Fast richtig – achte auf die Schreibweise: <s>${esc(typed)}</s>` : `Deine Eingabe: <s>${esc(typed) || "–"}</s>`}</p>` : ""}
      <p class="de-small">${esc(c.de)}</p>
      <div class="listen-row">
        <button class="btn ghost listen" data-say="${esc(c.en)}">${ICON.speaker}<span>Wort anhören</span></button>
        ${c.ex ? `<button class="btn ghost listen" data-say="${esc(plain(c.ex))}">${ICON.speaker}<span>Satz anhören</span></button>` : ""}
      </div>
      ${rateSlider("", c.en)}
      ${c.ex ? `<p class="ex">${marked(c.ex)}</p>` : ""}
      ${c.exDe ? `<p class="ex-de">${marked(c.exDe)}</p>` : ""}
      ${c.note ? `<p class="note ${noteFF ? "ff" : ""}">${esc(c.note)}</p>` : ""}
    `;
  }

  const design = designKey(s.design);
  if (design !== "paper") {
    const left = session.queue.length - session.pos;
    const res = typed == null ? null : checkAnswer(typed, c);
    const ok = res == null ? null : res !== "bad";
    const p = preview(c, Date.now(), s.retention);
    const card = (id) => S.getState().cards[id];
    const prev = [session.queue[session.pos - 2], session.queue[session.pos - 1]]
      .filter((id) => id && id !== c.id)
      .map(card)
      .filter(Boolean)
      .map((x) => ({ en: x.en, de: x.de, exPlain: plain(x.ex) }));
    const next = session.queue
      .slice(session.pos + 1, session.pos + 3)
      .filter((id) => id !== c.id)
      .map(card)
      .filter(Boolean)
      .map((x) => ({ en: x.en, de: x.de, clozePlain: String(x.ex || "").replace(/\*[^*]+\*/g, "____") }));
    const x = {
      c, revealed, isNew, noteFF, icon: ICON,
      langName: L().name,
      enHtml: esc(c.en) + (c.rd ? `<small class="rd">${esc(c.rd)}</small>` : ""),
      topic: S.topicLabel(c.topic),
      posLabel: POS_LABEL[c.pos] || c.pos || "",
      cloze: c.ex ? clozeHtml(c.ex) : "",
      exMarked: c.ex ? marked(c.ex) : "",
      exDeMarked: c.exDe ? marked(c.exDe) : "",
      exPlain: plain(c.ex),
      hint: hintFor(c.en),
      ok, typedRaw: typed,
      practice: session.practice.has(c.id),
      iv2: formatInterval(p[2]), iv3: formatInterval(p[3]),
      pos: session.done + 1, total: session.done + left, pct: session.total ? Math.min(100, (session.done / (session.done + left)) * 100) : 0,
      prev, next,
      ui: {
        header: sessionHeader(),
        input: s.typeAnswer && !revealed ? `<input id="answer" class="answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Wort auf ${L().name} eingeben…">` : "",
        hint: `<p class="hint" id="hint" hidden>${esc(hintFor(c.en))}</p>`,
        typed: typed != null ? `<p class="typed ${ok ? "ok" : "bad"}">${res === "ok" ? "Richtig!" : res === "almost" ? `Fast richtig – achte auf die Schreibweise: <s>${esc(typed)}</s>` : `Deine Eingabe: <s>${esc(typed) || "–"}</s>`}</p>` : "",
        listen: `<div class="listen-row">
          <button class="btn ghost listen" data-say="${esc(c.en)}">${ICON.speaker}<span>Wort anhören</span></button>
          ${c.ex ? `<button class="btn ghost listen" data-say="${esc(plain(c.ex))}">${ICON.speaker}<span>Satz anhören</span></button>` : ""}</div>${rateSlider("", c.en)}${micBlock(c.en)}`,
        speed: rateSlider("", c.en),
        mic: micBlock(c.en),
        speedIdx: tts.stepOfRate(settings().voiceRate),
        speedLabel: tts.RATE_STEPS[tts.stepOfRate(settings().voiceRate)].label,
        note: c.note ? `<p class="note ${noteFF ? "ff" : ""}">${esc(c.note)}</p>` : "",
        known: `<button class="btn ghost known-btn" id="knownBtn">Kenne ich schon – nicht mehr abfragen</button>`,
      },
    };
    $app.innerHTML = `<div class="sk-learn sk-${design}">${skinCard(design, x)}</div>`;
    bindCardEvents(c, revealed);
    return;
  }

  let actions;
  if (!revealed) {
    actions = `
      <div class="actions-row">
        <button class="btn ghost" id="hintBtn">Hinweis</button>
      </div>
      <button class="btn primary big" id="reveal">Aufdecken</button>`;
  } else {
    const practice = session.practice.has(c.id);
    const p = preview(c, Date.now(), s.retention);
    actions = `<div class="grades three">
        <button class="grade g1" data-g="1"><span>Muss ich noch lernen</span><small>gleich nochmal</small></button>
        <button class="grade g2" data-g="2"><span>Unsicher</span><small>${practice ? "Übung" : "in " + formatInterval(p[2])}</small></button>
        <button class="grade g3" data-g="3"><span>Wusste ich</span><small>${practice ? "Übung" : "in " + formatInterval(p[3])}</small></button>
      </div>
      <button class="btn ghost known-btn" id="knownBtn">Kenne ich schon – nicht mehr abfragen</button>`;
  }

  $app.innerHTML = `${sessionHeader()}
    <article class="flash ${revealed ? "back" : "front"}">${body}</article>
    <div class="flash-actions">${actions}</div>`;

  bindCardEvents(c, revealed);
}

function bindCardEvents(c, revealed) {
  const s = settings();
  $app.querySelectorAll("[data-say]").forEach((b) => (b.onclick = () => say(b.dataset.say)));
  bindMic($app);
  bindVoiceToggle();

  if (!revealed) {
    const input = document.getElementById("answer");
    const doReveal = () => showCard(true, input ? input.value : null);
    document.getElementById("reveal").onclick = doReveal;
    document.getElementById("hintBtn").onclick = () => {
      const h = document.getElementById("hint");
      if (h) h.hidden = false;
    };
    if (input) {
      input.focus();
      input.onkeydown = (e) => {
        if (e.key === "Enter") doReveal();
      };
    }
  } else {
    if (s.autoSpeak) say(c.en);
    $app.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => rate(Number(b.dataset.g))));
    const kb = document.getElementById("knownBtn");
    if (kb) kb.onclick = () => markKnown(c);
  }
}

function markKnown(c) {
  S.updateCard({ ...c, state: "known", knownAt: Date.now() });
  session.queue.splice(session.pos, 1);
  session.total--;
  toast(`„${esc(c.en)}“ als bekannt markiert`);
  showCard();
}

function rate(g) {
  const c = currentCard();
  const knew = g > 1;
  const wasNew = c.state === "new";
  // Zusätzliche Übung (nicht fällig): Intervalle nicht verändern, nur „noch lernen“ pflegen
  const practice = session.practice.has(c.id) && !session.scheduled.has(c.id);
  let next = practice ? { ...c } : schedule(c, g, Date.now(), settings().retention);
  if (!practice) session.scheduled.add(c.id);
  // „Unsicher“ (2): kürzeres Intervall, ändert den „noch lernen“-Status nicht
  if (g !== 2) next = S.markWeak(next, knew);
  S.updateCard(next);
  S.logReview(g, next, wasNew);
  session.done++;
  if (knew) session.correct++;
  else {
    session.again++;
    // Karte nach 3 anderen Karten erneut zeigen – so lange, bis du sie weißt
    session.practice.add(c.id);
    const at = Math.min(session.queue.length, session.pos + 4);
    session.queue.splice(at, 0, c.id);
  }
  session.pos++;
  showCard();
}

function sessionEnd() {
  const pct = session.done ? Math.round((session.correct / session.done) * 100) : 0;
  const ready = S.storyReady();
  $app.innerHTML = `<div class="center-msg">
    <div class="big-check">${ICON.check}</div>
    <h1>Geschafft!</h1>
    <p class="muted">${session.done} Bewertungen · ${pct} % gewusst</p>
    ${ready ? `<section class="card story-teaser ready"><h2>Neue Geschichte bereit</h2>
      <p class="muted">Lies deine neuen Wörter jetzt im Zusammenhang.</p>
      <a class="btn primary" href="#/story/new">Geschichte erstellen</a></section>` : ""}
    <a class="btn ${ready ? "ghost" : "primary"}" href="#/">Zur Startseite</a>
  </div>`;
}

document.addEventListener("keydown", (e) => {
  if (document.body.dataset.view !== "learn" || !session) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const reveal = document.getElementById("reveal");
  if (reveal && (e.key === " " || e.key === "Enter")) {
    e.preventDefault();
    reveal.click();
  } else if (!reveal && ["1", "2", "3"].includes(e.key)) {
    const b = $app.querySelector(`[data-g="${e.key}"]`);
    if (b) b.click();
  }
});

// ---------- Geschichten ----------
function stories() {
  const s = S.getState();
  const n = S.storyProgress();
  const ready = S.storyReady();
  $app.innerHTML = `
  <header class="top"><div><h1>Geschichten</h1>
    <p class="muted">Kurze Texte mit Wörtern, die du gerade übst – und solchen, die du schon kannst.</p></div></header>
  <section class="card story-teaser ${ready ? "ready" : ""}">
    <div class="row-between"><h2>Nächste Geschichte</h2>
      <span class="small muted">${n} / ${s.settings.storyEvery}</span></div>
    <div class="meter"><div style="width:${(n / s.settings.storyEvery) * 100}%"></div></div>
    ${
      ready
        ? `<a class="btn primary" href="#/story/new">Geschichte erstellen</a>`
        : `<p class="muted small">Noch ${s.settings.storyEvery - n} ${s.settings.storyEvery - n === 1 ? "Übungswort" : "Übungswörter"} – also Wörter, die du gesehen hast, aber noch nicht sicher kannst.</p>`
    }
  </section>
  ${
    s.stories.length
      ? s.stories
          .map(
            (st) => `<a class="card story-item" href="#/story/${st.id}">
        <h3>${esc(st.title)}</h3>
        <p class="small muted">${fmtDate(st.createdAt)}${st.theme ? ` · ${esc(st.theme)}` : ""} · ${st.words.length} Wörter${st.quizScore != null ? ` · Quiz ${st.quizScore}/${st.questions.length}` : ""}</p>
        <div class="chips">${st.words.slice(0, 8).map((w) => `<span class="chip">${esc(w.en)}</span>`).join("")}</div>
      </a>`
          )
          .join("")
      : `<p class="muted center">Noch keine Geschichten.</p>`
  }`;
}

function story(id) {
  if (id === "new") return storyNew();
  const st = S.getState().stories.find((x) => x.id === id);
  if (!st) return go("#/stories");
  storyDetail(st);
}

function storyNew() {
  const lvl = settings().storyLevel;
  if (!S.storyReady()) {
    const left = settings().storyEvery - S.storyProgress();
    $app.innerHTML = `<div class="center-msg"><h1>Noch nicht bereit</h1>
      <p class="muted">Eine Geschichte entsteht, sobald ${settings().storyEvery} Wörter gesehen, aber noch nicht sicher sind. Es fehlen noch ${left}.</p>
      <a class="btn primary" href="#/learn">Lernen</a></div>`;
    return;
  }
  const { learning, known } = S.storyCandidates();
  const words = [...learning, ...known];
  const theme = S.storyTheme(learning);
  $app.innerHTML = `
  <header class="top"><a class="icon-btn plain" href="#/stories" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Neue Geschichte</h1><span></span></header>
  <section class="card">
    ${theme ? `<p class="eyebrow">Thema: ${esc(theme)}</p>` : ""}
    <h2>Wörter, die du gerade übst</h2>
    <div class="chips">${learning.map((w) => `<span class="chip new" title="${esc(w.de)}">${esc(w.en)}</span>`).join("")}</div>
    ${
      known.length
        ? `<h2 class="h-gap">Dazu Wörter, die du schon kannst</h2>
           <div class="chips">${known.map((w) => `<span class="chip" title="${esc(w.de)}">${esc(w.en)}</span>`).join("")}</div>`
        : ""
    }
    <label class="field"><span>Sprachniveau des Textes</span>
      <select id="lvl">${["A2", "B1", "B2", "C1"].map((L) => `<option ${L === lvl ? "selected" : ""}>${L}</option>`).join("")}</select></label>
    ${
      ""
    }
    <button class="btn primary big" id="gen">Mit KI erstellen</button>
    <div class="gen-progress" id="genProg" hidden aria-live="polite">
      <div class="gp-bar"><i id="gpFill"></i></div>
      <p class="gp-row"><b id="gpStep">Los geht's …</b><span id="gpTime">0 s</span></p>
    </div>
    <p class="small muted" id="status"></p>
  </section>
  <details class="card">
    <summary><h2>Ohne Server (manuell)</h2></summary>
    <p class="small muted">Prompt kopieren, in der Claude-App einfügen und die Antwort (JSON) unten einfügen.</p>
    <button class="btn ghost" id="copy">Prompt kopieren</button>
    <textarea id="paste" rows="6" placeholder='{"title": "...", "text": "...", ...}'></textarea>
    <button class="btn ghost" id="usePaste">Antwort übernehmen</button>
  </details>`;

  const keySave = document.getElementById("gkeySave");
  if (keySave)
    keySave.onclick = () => {
      const k = document.getElementById("gkeyInline").value.trim();
      if (!k) return toast("Bitte den Key einfügen");
      const st = S.getState();
      st.settings.geminiKey = k;
      st.settings.provider = "browser";
      S.save();
      toast("Key gespeichert");
      storyNew();
    };
  const level = () => document.getElementById("lvl").value;
  const finish = (data) => {
    // geübt werden die Übungswörter; die bekannten stehen nur im Glossar
    const st = { ...normalizeStory(data, words), theme, wordIds: learning.map((w) => w.id), words: learning.map((w) => ({ id: w.id, en: w.en, de: w.de })) };
    S.addStory(st);
    const s = S.getState();
    s.settings.storyLevel = level();
    S.save();
    if (!st.sentences?.length) decodeLater(st);
    go("#/story/" + st.id);
  };
  document.getElementById("gen").onclick = async (e) => {
    const btn = e.currentTarget;
    const status = document.getElementById("status");
    const prog = document.getElementById("genProg");
    const fill = document.getElementById("gpFill");
    const step = document.getElementById("gpStep");
    const time = document.getElementById("gpTime");
    btn.disabled = true;
    btn.textContent = "Geschichte wird geschrieben …";
    status.textContent = "";
    prog.hidden = false;
    const t0 = Date.now();
    const STEPS = [
      [0, "Deine Wörter werden zusammengestellt"],
      [3, "Die Handlung wird ausgedacht"],
      [9, "Die Geschichte wird geschrieben"],
      [20, "Fragen zum Text werden erstellt"],
      [32, "Fast fertig …"],
      [50, "Die KI braucht heute etwas länger – gleich ist es soweit"],
    ];
    const tick = () => {
      const t = (Date.now() - t0) / 1000;
      fill.style.width = Math.min(96, 100 * (1 - Math.exp(-t / 16))).toFixed(1) + "%";
      step.textContent = STEPS.filter(([at]) => t >= at).pop()[1];
      time.textContent = `${Math.floor(t)} s`;
    };
    tick();
    const timer = setInterval(tick, 250);
    try {
      const data = await callApi("story", {
        words: learning.map((w) => ({ en: w.en, de: w.de })),
        known: known.map((w) => ({ en: w.en, de: w.de })),
        level: level(),
        theme,
      });
      clearInterval(timer);
      fill.style.width = "100%";
      step.textContent = "Fertig! 🎉";
      setTimeout(() => finish(data), 350);
    } catch (err) {
      clearInterval(timer);
      prog.hidden = true;
      btn.disabled = false;
      btn.textContent = "Erneut versuchen";
      status.innerHTML = `<span class="err">${esc(err.message)}</span>`;
    }
  };
  document.getElementById("copy").onclick = async () => {
    const text = STORY_SYSTEM + "\n\n" + storyPrompt(learning, level(), theme, known);
    try {
      await navigator.clipboard.writeText(text);
      toast("Prompt kopiert");
    } catch {
      document.getElementById("paste").value = text;
      toast("Kopieren nicht möglich – Prompt steht im Textfeld");
    }
  };
  document.getElementById("usePaste").onclick = () => {
    try {
      finish(extractJson(document.getElementById("paste").value));
    } catch (err) {
      toast("Konnte die Antwort nicht lesen: " + esc(err.message), 4000);
    }
  };
}

// Stand der Aufnahmen einer Stimme für die Einstellungen
function voiceStatus(key) {
  const pr = tts.presetProgress(key);
  if (pr >= 0.98) return "";
  return pr > 0 ? ` · kommt bald (${Math.round(pr * 100)} % aufgenommen) – 🔊 Hörprobe` : " · kommt bald – 🔊 Hörprobe";
}

// Wort-für-Wort-Übersetzung im Hintergrund nachladen (Schritt 2 der Geschichte)
const DECODING = new Set();
function decodeLater(st) {
  if (DECODING.has(st.id)) return;
  DECODING.add(st.id);
  decodeStory(st.text)
    .then((sentences) => {
      if (!sentences.length) return;
      const cur = S.getState().stories.find((x) => x.id === st.id);
      if (!cur) return;
      S.updateStory({ ...cur, sentences });
    })
    .catch(() => {})
    .finally(() => {
      DECODING.delete(st.id);
      if (location.hash === "#/story/" + st.id) story(st.id);
    });
}

// Jedes Wort antippbar: markierte Lernwörter gelb, alle anderen unauffällig
// mode: "" = normaler Text, "wfw" = Wort für Wort (Birkenbihl), "de" = freie Übersetzung
function storyHtml(st, mode = "") {
  const seg = L().cjk && typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(S.lang(), { granularity: "word" }) : null;
  const wrapWords = (t) =>
    seg
      ? [...seg.segment(t)].map((x) => (x.isWordLike ? `<span class="ow" data-w="${x.segment}">${x.segment}</span>` : x.segment)).join("")
      : t.replace(/[\p{L}\p{M}][\p{L}\p{M}’'-]*[\p{L}\p{M}]|[\p{L}\p{M}]/gu, (w) => `<span class="ow" data-w="${w}">${w}</span>`);
  const line = (p) =>
    p
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/);
        return m ? `<button class="tw" data-w="${esc(m[1])}">${esc(m[1])}</button>` : wrapWords(esc(part));
      })
      .join("");
  if (st.sentences?.length) {
    // Satzweise: jeder Satz antippbar zum Vorlesen, optional mit Übersetzungszeile
    const paras = [];
    st.sentences.forEach((x, i) => {
      if (x.p || !paras.length) paras.push([]);
      const sub = mode === "wfw" ? x.wfw : mode === "de" ? x.de : "";
      paras[paras.length - 1].push(
        `<span class="sent${mode ? " dec" : ""}" data-s="${i}"><button class="sent-play" data-say-s="${i}" aria-label="Satz vorlesen">▶</button>${line(x.t)}${
          sub ? `<span class="sent-sub ${mode}">${esc(sub)}</span>` : ""
        }</span>`
      );
    });
    return paras.map((p) => `<p>${p.join(mode ? "" : " ")}</p>`).join("");
  }
  return st.text
    .split(/\n\s*\n/)
    .map((p) => `<p>${line(p)}</p>`)
    .join("");
}

// Übersetzung für beliebige Wörter: erst eigener Wortschatz, dann kostenloser Übersetzer
const transCache = new Map();
async function translateWord(word) {
  const k = word.toLowerCase();
  if (transCache.has(k)) return transCache.get(k);
  let out = "";
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${L().mm}|de`);
    const data = await res.json();
    out = data?.responseData?.translatedText || "";
    if (out.toLowerCase() === k || /MYMEMORY|QUERY LENGTH/i.test(out)) out = "";
  } catch {}
  transCache.set(k, out);
  return out;
}

function sentenceWith(text, word) {
  const plainText = plain(text).replace(/\n+/g, " ");
  const sentences = plainText.match(/[^.!?。！？।]+[.!?。！？।]+["”’」]?/g) || [plainText];
  const w = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = L().cjk ? new RegExp(w, "i") : new RegExp(`(?<![\\p{L}\\p{M}])${w}(?![\\p{L}\\p{M}])`, "iu");
  const s = (sentences.find((x) => re.test(x)) || "").trim();
  return s ? s.replace(re, (m) => `*${m}*`) : "";
}

// Kleines Fenster unten: Wort, Übersetzung, Anhören, „Zum Lernen“
async function showWordPop(st, word, isTarget) {
  document.querySelectorAll(".word-pop").forEach((x) => x.remove());
  say(word);
  const card = S.lookupWord(word);
  let de = isTarget ? glossFor(st, word) : "";
  if (!de && card) de = card.de;
  const pop = document.createElement("div");
  pop.className = "word-pop";
  pop.setAttribute("role", "dialog");
  const render = (trans, loading) => {
    const state = card ? S.categorize(card) : null;
    const stateTxt = { new: "im Wortschatz – noch nicht gelernt", learning: "im Lernen", learned: "gelernt", known: "als bekannt markiert" }[state] || "";
    pop.innerHTML = `
      <div class="wp-main">
        <div><b class="wp-en">${esc(word)}</b>${card && card.en.toLowerCase() !== word.toLowerCase() ? ` <span class="small muted">(${esc(card.en)})</span>` : ""}${(card?.rd || st.readings?.[word.toLowerCase()]) ? ` <span class="rd">${esc(card?.rd || st.readings[word.toLowerCase()])}</span>` : ""}</div>
        <div class="wp-de">${loading ? '<span class="muted">übersetze …</span>' : esc(trans || "keine Übersetzung gefunden")}</div>
        ${stateTxt ? `<div class="small muted">${stateTxt}</div>` : ""}
      </div>
      <div class="wp-actions">
        <button class="icon-btn" data-wp="say" aria-label="Anhören">${ICON.speaker}</button>
        ${!card || card.state === "known" || card.state === "new" ? `<button class="btn primary small-btn" data-wp="add">${ICON.plus}<span>Lernen</span></button>` : ""}
        <button class="icon-btn plain" data-wp="close" aria-label="Schließen">${ICON.close}</button>
      </div>
      ${rateSlider("", card && card.en.toLowerCase() !== word.toLowerCase() ? word : card?.en || word)}`;
  };
  render(de, !de);
  document.body.appendChild(pop);
  pop.onclick = (e) => {
    const a = e.target.closest("[data-wp]")?.dataset.wp;
    if (a === "say") say(card && card.en.toLowerCase() !== word.toLowerCase() ? word : card?.en || word);
    if (a === "close") pop.remove();
    if (a === "add") {
      const trans = pop.querySelector(".wp-de")?.textContent || "";
      if (card) {
        // vorhandenes Wort: als Nächstes lernen bzw. wieder aufnehmen
        const r = { ...card, state: "new", order: -Date.now(), weak: true, weakOk: 0 };
        S.updateCard(r);
      } else {
        const topicKey = Object.entries(S.allTopics()).find(([, v]) => v === st.theme)?.[0] || "alltag";
        S.addCustomCard({
          en: word.toLowerCase(),
          de: /keine Übersetzung/.test(trans) ? "" : trans,
          ex: sentenceWith(st.text, word),
          exDe: "",
          level: "B2",
          topic: topicKey,
          front: true,
        });
      }
      toast(`„${esc(word)}“ kommt in deiner nächsten Lerneinheit dran`);
      pop.remove();
    }
  };
  if (!de) {
    const t = await translateWord(card?.en || word);
    if (document.body.contains(pop)) render(t, false);
  }
}

function glossFor(st, word) {
  const w = word.toLowerCase();
  if (st.glossary[w]) return st.glossary[w];
  // gebeugte Formen: längste passende Grundform suchen
  const keys = Object.keys(st.glossary).sort((a, b) => b.length - a.length);
  const k = keys.find((key) => w.startsWith(key.slice(0, Math.max(3, key.length - 2))));
  return k ? st.glossary[k] : "";
}

function clozeItems(st) {
  const sentences = plain(st.text.replace(/\*\*([^*]+)\*\*/g, "⟦$1⟧"))
    .replace(/\n+/g, " ")
    .match(/[^.!?]+[.!?]+["”’]?/g) || [];
  const items = [];
  for (const s of sentences) {
    const m = s.match(/⟦([^⟧]+)⟧/);
    if (m) items.push({ before: s.slice(0, m.index).replace(/⟦|⟧/g, ""), answer: m[1], after: s.slice(m.index + m[0].length).replace(/⟦|⟧/g, "") });
    if (items.length >= 6) break;
  }
  return items;
}

function storyDetail(st) {
  const cz = clozeItems(st);
  const bank = shuffle(cz.map((x) => x.answer));
  $app.innerHTML = `
  <header class="top"><a class="icon-btn plain" href="#/stories" aria-label="Zurück">${ICON.back}</a>
    <span class="small muted">${fmtDate(st.createdAt)}</span>
    <button class="icon-btn" id="del" aria-label="Löschen" title="Geschichte löschen">${ICON.close}</button></header>
  <article class="card reader">
    <h1 class="story-title">${esc(st.title)}</h1>
    <div class="reader-controls">
      <button class="btn ghost" id="play">${ICON.play}<span>Vorlesen</span></button>
      ${voiceToggle()}
    </div>
    <div class="reader-controls">
      ${rateSlider("storyRate")}
    </div>
    ${
      st.sentences?.length
        ? `<p class="small muted dec-label">Übersetzung unter jedem Satz</p>
    <div class="speed seg" id="decMode" role="group" aria-label="Übersetzung">
      <button type="button" data-dec="" class="on">Aus</button>
      <button type="button" data-dec="wfw">Wort für Wort</button>
      <button type="button" data-dec="de">Deutsch</button>
    </div>`
        : DECODING.has(st.id)
          ? `<p class="small muted dec-wait"><span class="spin"></span> Wort-für-Wort-Übersetzung wird vorbereitet …</p>`
          : `<button class="btn ghost" id="decLoad">Wort für Wort übersetzen</button>`
    }
    <div class="story-text">${storyHtml(st)}</div>
    <p class="small muted">Tippe auf ein Wort für Übersetzung und Aussprache${st.sentences?.length ? ", auf ▶ für den ganzen Satz" : ""}. Gelb = deine Lernwörter.${
      st.sentences?.length ? " „Wort für Wort“ zeigt die wörtliche Übersetzung (Birkenbihl-Methode): So erkennst du, wie die Sprache gebaut ist." : ""
    }</p>
  </article>

  ${
    st.questions.length
      ? `<section class="card"><h2>Verständnisfragen</h2>
      ${st.questions
        .map(
          (q, i) => `<div class="quiz" data-q="${i}"><p class="q">${i + 1}. ${esc(q.q)}</p>
          ${q.options.map((o, j) => `<button class="opt" data-o="${j}">${esc(o)}</button>`).join("")}</div>`
        )
        .join("")}
      <p class="small muted" id="quizScore"></p></section>`
      : ""
  }

  ${
    cz.length
      ? `<section class="card"><h2>Lückentext</h2>
      <p class="small muted">Setze die Wörter aus der Geschichte wieder ein.</p>
      ${cz
        .map(
          (x, i) => `<p class="cz">${esc(x.before)}<select data-i="${i}"><option value="">…</option>${bank
            .map((b) => `<option>${esc(b)}</option>`)
            .join("")}</select>${esc(x.after)}</p>`
        )
        .join("")}
      <button class="btn ghost" id="checkCz">Prüfen</button>
      <p class="small" id="czScore"></p></section>`
      : ""
  }

  <section class="card">
    <h2>Wörter dieser Geschichte</h2>
    <div class="word-list compact">${st.words
      .map((w) => `<div class="wl-row"><b>${esc(w.en)}</b><span class="muted">${esc(w.de)}</span></div>`)
      .join("")}</div>
    <a class="btn primary" href="#/learn/story:${st.id}">Diese Wörter jetzt üben</a>
  </section>`;

  // Übersetzungszeile umschalten (Aus / Wort für Wort / Deutsch)
  const $text = $app.querySelector(".story-text");
  $app.querySelectorAll("[data-dec]").forEach(
    (b) =>
      (b.onclick = () => {
        $app.querySelectorAll("[data-dec]").forEach((x) => x.classList.toggle("on", x === b));
        $text.innerHTML = storyHtml(st, b.dataset.dec);
      })
  );
  const highlight = (i) => $text.querySelectorAll(".sent").forEach((x) => x.classList.toggle("cur", Number(x.dataset.s) === i));
  const sayCfg = (onend) => ({ rate: settings().voiceRate, preset: settings().voicePreset, onend });

  // Jedes Wort antippen: Übersetzung + Aussprache; ▶ = Satz vorlesen
  $text.addEventListener("click", (e) => {
    const sp = e.target.closest("[data-say-s]");
    if (sp) {
      const i = Number(sp.dataset.sayS);
      highlight(i);
      tts.speak(plain(st.sentences[i].t), sayCfg(() => highlight(-1)));
      return;
    }
    const t = e.target.closest(".tw, .ow");
    if (!t) return;
    $app.querySelectorAll(".ow.sel, .tw.sel").forEach((x) => x.classList.remove("sel"));
    t.classList.add("sel");
    showWordPop(st, t.dataset.w, t.classList.contains("tw"));
  });

  // Vorlesen
  bindRateSlider("storyRate");
  bindVoiceToggle();
  const play = document.getElementById("play");
  play.onclick = () => {
    if (tts.speaking()) {
      tts.stop();
      play.innerHTML = `${ICON.play}<span>Vorlesen</span>`;
      return;
    }
    play.innerHTML = `${ICON.stop}<span>Stopp</span>`;
    const done = () => {
      highlight(-1);
      play.innerHTML = `${ICON.play}<span>Vorlesen</span>`;
    };
    if (st.sentences?.length) {
      // Satz für Satz vorlesen und den aktuellen Satz hervorheben
      let i = -1;
      const next = () => {
        if (!play.innerHTML.includes("Stopp")) return;
        i++;
        if (i >= st.sentences.length) return done();
        highlight(i);
        tts.speak(plain(st.sentences[i].t), sayCfg(() => setTimeout(next, 250)));
      };
      tts.speak(st.title, sayCfg(() => setTimeout(next, 400)));
    } else {
      tts.speak(st.title + ". " + plain(st.text), sayCfg(done));
    }
  };

  // Quiz
  const answered = new Set();
  let score = 0;
  $app.querySelectorAll(".quiz").forEach((box) => {
    const qi = Number(box.dataset.q);
    box.querySelectorAll(".opt").forEach(
      (b) =>
        (b.onclick = () => {
          if (answered.has(qi)) return;
          answered.add(qi);
          const right = st.questions[qi].answer;
          const chosen = Number(b.dataset.o);
          if (chosen === right) score++;
          box.querySelectorAll(".opt").forEach((o) => {
            const j = Number(o.dataset.o);
            if (j === right) o.classList.add("right");
            else if (j === chosen) o.classList.add("wrong");
            o.disabled = true;
          });
          if (answered.size === st.questions.length) {
            document.getElementById("quizScore").textContent = `Ergebnis: ${score} von ${st.questions.length} richtig`;
            S.updateStory({ ...st, quizScore: score });
          }
        })
    );
  });

  // Lückentext
  const cb = document.getElementById("checkCz");
  if (cb)
    cb.onclick = () => {
      let ok = 0;
      $app.querySelectorAll(".cz select").forEach((sel) => {
        const right = sel.value.toLowerCase() === cz[Number(sel.dataset.i)].answer.toLowerCase();
        if (right) ok++;
        sel.classList.toggle("right", right);
        sel.classList.toggle("wrong", !right);
      });
      document.getElementById("czScore").textContent = `${ok} von ${cz.length} richtig`;
      S.updateStory({ ...st, clozeScore: ok });
    };

  const decLoad = document.getElementById("decLoad");
  if (decLoad) decLoad.onclick = () => (decodeLater(st), storyDetail(st));
  document.getElementById("del").onclick = () => {
    if (confirm("Diese Geschichte löschen?")) {
      S.deleteStory(st.id);
      go("#/stories");
    }
  };
}

// ---------- Wortschatz ----------
let wordsTab = "learning";
let wordsQuery = "";
let wordsLevel = "";
let wordsTopic = "";

function words() {
  const all = S.cards();
  const counts = { new: 0, learning: 0, learned: 0, known: 0 };
  for (const c of all) counts[S.categorize(c)]++;
  const tabs = [
    ["new", "Neu"],
    ["learning", "Lernen"],
    ["learned", "Gelernt"],
    ["known", "Bekannt"],
  ];
  $app.innerHTML = `
  <header class="top"><h1>Wortschatz</h1><span class="top-actions"><a class="btn ghost small-btn" href="#/listen">🎧<span>Hören</span></a><a class="btn primary small-btn" href="#/add">${ICON.plus}<span>Wort</span></a></span></header>
  <div class="tabs">${tabs
    .map(([k, l]) => `<button class="tab ${wordsTab === k ? "active" : ""}" data-tab="${k}">${l} <small>${counts[k]}</small></button>`)
    .join("")}</div>
  <div class="searchbar">${ICON.search}<input id="q" type="search" placeholder="Suchen (${L().name} oder Deutsch)" value="${esc(wordsQuery)}"></div>
  <div class="chips filter">${["", ...LEVELS]
    .map((L) => `<button class="chip ${wordsLevel === L ? "active" : ""}" data-lvl="${L}">${L || "Alle"}</button>`)
    .join("")}
    <select id="wt" class="chip-select" aria-label="Thema"><option value="">Alle Themen</option>${Object.entries(S.allTopics())
      .map(([k, l]) => `<option value="${k}" ${wordsTopic === k ? "selected" : ""}>${esc(l)}</option>`)
      .join("")}</select></div>
  <div id="list" class="word-list"></div>`;

  const renderList = () => {
    const q = wordsQuery.trim().toLowerCase();
    let list = all.filter((c) => S.categorize(c) === wordsTab);
    if (wordsLevel) list = list.filter((c) => c.level === wordsLevel);
    if (wordsTopic) list = list.filter((c) => c.topic === wordsTopic);
    if (q) list = list.filter((c) => c.en.toLowerCase().includes(q) || c.de.toLowerCase().includes(q));
    if (wordsTab === "new") list.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
    else list.sort((a, b) => (a.due || 0) - (b.due || 0));
    const el = document.getElementById("list");
    if (!list.length) {
      el.innerHTML = `<p class="muted center">Keine Wörter.</p>`;
      return;
    }
    el.innerHTML = list
      .slice(0, 300)
      .map(
        (c) => `<div class="wl-item" data-id="${c.id}">
        <div class="wl-main">
          <div><b class="wl-en">${esc(c.en)}</b> <span class="badge lvl-${c.level}">${c.level}</span></div>
          <div class="wl-de">${esc(c.de)}</div>
          ${c.ex ? `<div class="wl-ex">${marked(c.ex)}</div>` : ""}
        </div>
        ${progressRing(c)}
      </div>`
      )
      .join("");
    el.querySelectorAll(".wl-item").forEach((it) => (it.onclick = () => wordDetail(it)));
  };

  $app.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => ((wordsTab = b.dataset.tab), words())));
  $app.querySelectorAll("[data-lvl]").forEach((b) => (b.onclick = () => ((wordsLevel = b.dataset.lvl), words())));
  document.getElementById("wt").onchange = (e) => {
    wordsTopic = e.target.value;
    renderList();
  };
  const qi = document.getElementById("q");
  qi.oninput = () => {
    wordsQuery = qi.value;
    renderList();
  };
  renderList();
}

function wordDetail(item) {
  const open = item.querySelector(".wl-detail");
  if (open) return open.remove();
  const c = S.getState().cards[item.dataset.id];
  const d = document.createElement("div");
  d.className = "wl-detail";
  const dueTxt =
    c.state === "review" || c.state === "learning"
      ? `Nächste Wiederholung: ${fmtDate(c.due)} · Stabilität ${c.stability.toFixed(1)} T · ${c.reps} Wiederholungen${c.lapses ? ` · ${c.lapses}× vergessen` : ""}`
      : c.state === "known"
        ? "Als bekannt markiert"
        : "Noch nicht gelernt";
  d.innerHTML = `
    ${c.exDe ? `<p class="ex-de">${marked(c.exDe)}</p>` : ""}
    ${c.note ? `<p class="note ${/false friend/i.test(c.note) ? "ff" : ""}">${esc(c.note)}</p>` : ""}
    <p class="small muted">${dueTxt}</p>
    <div class="actions-row wrap">
      <button class="btn ghost" data-a="say">${ICON.speaker}<span>Anhören</span></button>
      ${rateSlider("", c.ex ? plain(c.ex) : c.en)}
      ${c.state !== "known" ? `<button class="btn ghost" data-a="known">Kenne ich</button>` : ""}
      ${c.state !== "new" ? `<button class="btn ghost" data-a="reset">Zurücksetzen</button>` : ""}
      ${c.custom ? `<button class="btn ghost danger" data-a="delete">Löschen</button>` : ""}
    </div>`;
  d.onclick = (e) => {
    e.stopPropagation();
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (!a) return;
    if (a === "say") return say(c.ex ? plain(c.ex) : c.en);
    if (a === "known") S.updateCard({ ...c, state: "known", knownAt: Date.now() });
    if (a === "reset") {
      const r = { ...c, state: "new" };
      for (const k of ["stability", "difficulty", "due", "lastReview", "reps", "lapses", "introducedAt", "knownAt"]) delete r[k];
      S.updateCard(r);
    }
    if (a === "delete") {
      if (!confirm(`„${c.en}“ löschen?`)) return;
      S.deleteCard(c.id);
    }
    words();
  };
  item.appendChild(d);
}

// ---------- Wort hinzufügen / KI ----------
function add() {
  const topicOpts = Object.entries(S.allTopics())
    .map(([k, v]) => `<option value="${k}" ${k === "alltag" ? "selected" : ""}>${esc(v)}</option>`)
    .join("");
  $app.innerHTML = `
  <header class="top"><a class="icon-btn plain" href="#/words" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Wort hinzufügen</h1><span></span></header>
  <section class="card">
    <label class="field"><span>${L().name} *</span><input id="f-en" autocapitalize="off" placeholder="z. B. reluctant"></label>
    <label class="field"><span>Deutsch</span><input id="f-de" placeholder="z. B. widerwillig, zögerlich"></label>
    <button class="btn ghost" id="fill">Rest mit KI ausfüllen</button>
    <label class="field"><span>Beispielsatz (Zielwort in *Sternchen*)</span><input id="f-ex" placeholder="He was *reluctant* to leave."></label>
    <label class="field"><span>Satz auf Deutsch</span><input id="f-exde" placeholder="Er ging nur *widerwillig*."></label>
    <div class="grid2">
      <label class="field"><span>Niveau</span><select id="f-lvl">${LEVELS.map((L) => `<option ${L === "B2" ? "selected" : ""}>${L}</option>`).join("")}</select></label>
      <label class="field"><span>Thema</span><select id="f-topic">${topicOpts}</select></label>
    </div>
    <label class="field"><span>Hinweis (optional)</span><input id="f-note" placeholder="z. B. False Friend, Kollokation"></label>
    <label class="check"><input type="checkbox" id="f-front" checked> Als Nächstes lernen</label>
    <button class="btn primary big" id="saveWord">Speichern</button>
  </section>

  <a class="card topics-teaser" href="#/topics">
    <div class="row-between"><h2>Ganze Themen mit KI füllen</h2><span class="small muted">›</span></div>
    <p class="small muted">Unter „Themen“ erzeugst du mit einem Tipp 10 passende Wörter – auch für eigene Themen wie Fitness oder Trading.</p>
  </a>`;

  const v = (id) => document.getElementById(id).value.trim();
  const setv = (id, x) => (document.getElementById(id).value = x || "");

  document.getElementById("fill").onclick = async (e) => {
    const en = v("f-en");
    if (!en) return toast("Bitte zuerst das Wort auf " + L().name + " eingeben");
    const b = e.currentTarget;
    b.disabled = true;
    b.textContent = "KI füllt aus…";
    try {
      const data = await callApi("words", { mode: "fill", en, de: v("f-de") });
      const w = data.words?.[0];
      if (!w) throw new Error("Keine Karte erhalten");
      setv("f-de", w.de);
      setv("f-ex", w.ex);
      setv("f-exde", w.exDe);
      setv("f-note", w.note);
      if (LEVELS.includes(w.level)) setv("f-lvl", w.level);
      if (S.allTopics()[w.topic]) setv("f-topic", w.topic);
    } catch (err) {
      toast(esc(err.message), 4000);
    }
    b.disabled = false;
    b.textContent = "Rest mit KI ausfüllen";
  };

  document.getElementById("saveWord").onclick = () => {
    const en = v("f-en");
    if (!en) return toast("Das Wort auf " + L().name + " fehlt");
    if (S.hasWord(en) && !confirm(`„${en}“ gibt es schon. Trotzdem hinzufügen?`)) return;
    S.addCustomCard({
      en,
      de: v("f-de"),
      ex: v("f-ex"),
      exDe: v("f-exde"),
      level: v("f-lvl"),
      topic: v("f-topic"),
      note: v("f-note"),
      front: document.getElementById("f-front").checked,
    });
    toast(`„${esc(en)}“ gespeichert`);
    ["f-en", "f-de", "f-ex", "f-exde", "f-note"].forEach((id) => setv(id, ""));
  };

}

// ---------- Themen ----------
function topics(openKey) {
  const all = S.allTopics();
  const active = new Set(S.activeTopicKeys());
  const custom = S.getState().customTopics || {};
  const keys = Object.keys(all);

  $app.innerHTML = `
  <header class="top"><a class="icon-btn plain" href="#/" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Themen</h1><span></span></header>
  <p class="muted intro">Neue Wörter kommen nur aus aktiven Themen – jeweils ${settings().storyEvery} am Stück aus einem Thema, damit die Geschichte dazu passt.</p>

  ${(() => {
    const ls = S.levelStats();
    const sum = LEVELS.reduce((a, L) => ({ t: a.t + ls[L].total, s: a.s + ls[L].secure }), { t: 0, s: 0 });
    return `<section class="card vocab-level">
      <div class="row-between"><h2>Dein Wortschatz</h2><span class="small muted">${sum.s} von ${sum.t} sicher</span></div>
      ${LEVELS.map((L) => {
        const x = ls[L];
        const pS = x.total ? (x.secure / x.total) * 100 : 0;
        const pL = x.total ? (x.learning / x.total) * 100 : 0;
        return `<div class="lvl-row">
          <span class="badge lvl-${L}">${L}</span>
          <div class="meter two"><div style="width:${pS}%"></div><div class="lrn" style="width:${pL}%"></div></div>
          <span class="small lvl-num"><b>${x.secure}</b> / ${x.total}</span>
        </div>`;
      }).join("")}
      <p class="small muted legend-line"><span><i class="sw sec"></i> sicher</span><span><i class="sw lrn"></i> im Lernen</span><span>rechts: sicher / Wörter in der App</span></p>
      <p class="small muted">Die Werte werden genauer, je mehr du lernst, Geschichten liest und Fragen beantwortest. Mit „+ KI“ kannst du jedes Thema um weitere Wörter erweitern.</p>
    </section>`;
  })()}

  <div class="topic-list">${keys
    .map((k) => {
      const st = S.topicStats(k);
      const ls = S.levelStats(k);
      return `<div class="card topic-row ${active.has(k) ? "on" : ""}" data-k="${k}">
        <div class="topic-head">
          <label class="switch"><input type="checkbox" data-toggle="${k}" ${active.has(k) ? "checked" : ""}><span></span></label>
          <div class="topic-info">
            <b>${esc(all[k])} <span class="lvl-counts" title="Wörter in ${LEVELS.join(" / ")}">(${LEVELS.map((L) => ls[L].total).join("/")})</span></b>
            <span class="small muted">${
              st.total
                ? `sicher: ${LEVELS.map((L) => `<span class="nw">${L} ${ls[L].secure}/${ls[L].total}</span>`).join(" · ")}<br>${st.new} neu · ${st.learning} im Lernen`
                : "noch keine Wörter"
            }</span>
          </div>
          <button class="btn ghost small-btn" data-gen="${k}">${ICON.plus}<span>KI</span></button>
        </div>
        <div class="gen-box" id="gen-${k}" ${openKey === k ? "" : "hidden"}></div>
        ${custom[k] ? `<button class="link-btn danger small" data-del="${k}">Thema löschen</button>` : ""}
      </div>`;
    })
    .join("")}</div>

  <section class="card">
    <h2>Eigenes Thema</h2>
    <p class="small muted">Zum Beispiel „Fitness & Ernährung“, „Trading“ oder „Arztbesuch“. Die KI erzeugt dann passende Wörter.</p>
    <div class="inline-form">
      <input id="newTopic" placeholder="Name des Themas" maxlength="40">
      <button class="btn primary" id="addTopic">Anlegen</button>
    </div>
  </section>`;

  $app.querySelectorAll("[data-toggle]").forEach(
    (cb) =>
      (cb.onchange = () => {
        if (!cb.checked && S.activeTopicKeys().length <= 1) {
          cb.checked = true;
          return toast("Mindestens ein Thema muss aktiv bleiben");
        }
        S.setTopicActive(cb.dataset.toggle, cb.checked);
        cb.closest(".topic-row").classList.toggle("on", cb.checked);
      })
  );
  $app.querySelectorAll("[data-gen]").forEach(
    (b) =>
      (b.onclick = () => {
        const box = document.getElementById("gen-" + b.dataset.gen);
        box.hidden = !box.hidden;
        if (!box.hidden && !box.innerHTML) renderGenerator(box, b.dataset.gen);
      })
  );
  $app.querySelectorAll("[data-del]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!confirm(`Thema „${all[b.dataset.del]}“ und seine noch nicht gelernten Wörter löschen?`)) return;
        S.deleteCustomTopic(b.dataset.del);
        topics();
      })
  );
  if (openKey) {
    const box = document.getElementById("gen-" + openKey);
    if (box) {
      renderGenerator(box, openKey);
      box.scrollIntoView({ block: "center" });
    }
  }
  document.getElementById("addTopic").onclick = () => {
    const name = document.getElementById("newTopic").value.trim();
    if (!name) return toast("Bitte einen Namen eingeben");
    const key = S.addCustomTopic(name);
    topics(key);
  };
}

function renderGenerator(box, key) {
  const lvl = LEVELS.includes(settings().startLevel) ? settings().startLevel : "B2";
  box.innerHTML = `
    <div class="grid2">
      <label class="field"><span>Niveau</span><select data-f="lvl">${LEVELS.map((L) => `<option ${L === lvl ? "selected" : ""}>${L}</option>`).join("")}</select></label>
      <label class="field"><span>Anzahl</span><select data-f="n"><option>5</option><option selected>10</option><option>20</option></select></label>
    </div>
    <button class="btn primary" data-f="go">Wörter erzeugen</button>
    <div data-f="out"></div>`;
  const q = (f) => box.querySelector(`[data-f="${f}"]`);
  q("go").onclick = async (e) => {
    const b = e.currentTarget;
    const out = q("out");
    b.disabled = true;
    b.textContent = settings().provider === "ollama" ? "Lokales Modell arbeitet…" : "Wird erzeugt…";
    out.innerHTML = "";
    try {
      const data = await callApi("words", {
        mode: "generate",
        level: q("lvl").value,
        topic: S.topicLabel(key),
        count: Number(q("n").value),
        exclude: S.cards().map((c) => c.en),
      });
      const list = (data.words || []).filter((w) => w?.en && !S.hasWord(w.en));
      if (!list.length) throw new Error("Keine neuen Wörter erhalten – bitte erneut versuchen.");
      out.innerHTML = `<div class="gen-list">${list
        .map(
          (w, i) => `<label class="gen-item"><input type="checkbox" data-i="${i}" checked>
          <div><b>${esc(w.en)}</b> <span class="badge lvl-${esc(w.level)}">${esc(w.level)}</span><br>
          <span class="muted">${esc(w.de)}</span><br><span class="small">${marked(w.ex || "")}</span></div></label>`
        )
        .join("")}</div><button class="btn primary" data-f="add">Ausgewählte hinzufügen</button>`;
      q("add").onclick = () => {
        let n = 0;
        out.querySelectorAll("input[data-i]:checked").forEach((cb) => {
          S.addCustomCard({ ...list[Number(cb.dataset.i)], topic: key, front: false });
          n++;
        });
        S.setTopicActive(key, true);
        toast(`${n} Wörter zu „${esc(S.topicLabel(key))}“ hinzugefügt`);
        topics();
      };
    } catch (err) {
      out.innerHTML = `<p class="err small">${esc(err.message)}</p>`;
    }
    b.disabled = false;
    b.textContent = "Wörter erzeugen";
  };
}

// ---------- Statistik ----------
function stats() {
  const s = S.getState();
  const all = S.cards();
  const counts = { new: 0, learning: 0, learned: 0, known: 0 };
  for (const c of all) counts[S.categorize(c)]++;
  const active = all.filter((c) => c.state === "review" || c.state === "learning");
  const daysLearned = Object.values(s.days).filter((d) => d.reviews).length;

  const sod = startOfDay();
  // Kalendertage per Datum berechnen (robust bei Zeitumstellung)
  const dayStart = (offset) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  };
  const forecast = Array.from({ length: 7 }, (_, i) => {
    const from = i === 0 ? -Infinity : dayStart(i).getTime();
    const to = dayStart(i + 1).getTime();
    const label = i === 0 ? "Heute" : WEEKDAYS[dayStart(i).getDay()];
    return { label, value: active.filter((c) => c.due >= from && c.due < to).length };
  });

  const buckets = [
    ["< 3 T", 0, 3],
    ["3–7 T", 3, 7],
    ["1–3 W", 7, 21],
    ["3 W–2 M", 21, 60],
    ["2 M +", 60, Infinity],
  ].map(([label, a, b]) => ({ label, value: active.filter((c) => c.stability >= a && c.stability < b).length }));

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const t = dayStart(i - 13).getTime() + 12 * 3600000;
    const d = s.days[S.dayKey(t)];
    return { label: i % 2 === 1 ? String(new Date(t).getDate()) : "", value: d?.reviews || 0 };
  });

  const totalCorrect = Object.values(s.days).reduce((a, d) => a + (d.correct || 0), 0);
  const quota = s.totalReviews ? Math.round((totalCorrect / s.totalReviews) * 100) : 0;

  $app.innerHTML = `
  <header class="top"><h1>Statistik</h1></header>
  <section class="kpis">
    <div class="kpi"><strong>${S.streak()}</strong><span>Tage Serie</span></div>
    <div class="kpi"><strong>${daysLearned}</strong><span>Lerntage</span></div>
    <div class="kpi"><strong>${s.totalReviews}</strong><span>Wiederholungen</span></div>
    <div class="kpi"><strong>${quota} %</strong><span>Trefferquote</span></div>
  </section>
  <section class="card">
    <h2>Wortschatz</h2>
    <div class="stack-bar">
      <div class="seg known" style="flex:${counts.known}"></div>
      <div class="seg learned" style="flex:${counts.learned}"></div>
      <div class="seg learning" style="flex:${counts.learning}"></div>
      <div class="seg new" style="flex:${counts.new}"></div>
    </div>
    <ul class="legend">
      <li><i class="known"></i>Bekannt <b>${counts.known}</b></li>
      <li><i class="learned"></i>Gelernt <b>${counts.learned}</b></li>
      <li><i class="learning"></i>Im Lernen <b>${counts.learning}</b></li>
      <li><i class="new"></i>Noch neu <b>${counts.new}</b></li>
    </ul>
    <p class="small muted">Gelernt = Intervall ≥ ${S.LEARNED_DAYS} Tage. Gesamt: ${all.length} Wörter.</p>
  </section>
  <section class="card"><h2>Fällige Wiederholungen</h2>${bars(forecast)}</section>
  <section class="card"><h2>Gedächtnisstabilität</h2>${bars(buckets)}
    <p class="small muted">Wie lange du die Wörter voraussichtlich behältst.</p></section>
  <section class="card"><h2>Letzte 14 Tage</h2>${bars(last14, 100)}</section>`;
}

// ---------- Einstellungen ----------
function settingsView() {
  const s = settings();
  $app.innerHTML = `
  <header class="top"><a class="icon-btn plain" href="#/" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Einstellungen</h1><span></span></header>
  ${cloud.currentUser() ? `<section class="card account">
    <h2>Mein Konto</h2>
    <p><b>${esc(cloud.userName())}</b><br><span class="small muted">${esc(cloud.currentUser().email || "")}</span></p>
    <p class="small muted">Dein Fortschritt wird automatisch in deinem Konto gespeichert – auf jedem Gerät, auf dem du dich anmeldest.</p>
    <button class="btn ghost" id="logoutBtn">Abmelden</button>
  </section>` : ""}
  <section class="card">
    <h2>Sprache</h2>
    <p class="small muted">Jede Sprache hat ihren eigenen Fortschritt, eigene Geschichten und eine passende Stimme.</p>
    <div class="lang-list">${Object.entries(LANGS)
      .map(([code, l]) => {
        const ready = READY.includes(code);
        const sum = S.langSummary(code);
        return `<button type="button" class="lang-opt ${code === S.lang() ? "on" : ""}" data-lang="${code}" ${ready ? "" : "disabled"}>
          <span class="lang-flag">${l.flag}</span><span class="lang-t"><b>${l.name}</b>
          <small class="muted">${!ready ? "kommt bald" : code === S.lang() ? "aktiv" : sum?.started ? `${sum.learned} Wörter sicher` : l.native}</small></span></button>`;
      })
      .join("")}</div>
  </section>
  <section class="card">
    <h2>Lernen</h2>
    <label class="field"><span>Neue Wörter pro Lerneinheit</span><input type="number" min="0" max="50" id="s-new" value="${s.newPerDay}"></label>
    <label class="field"><span>Geschichte nach je … neuen Wörtern</span><input type="number" min="3" max="25" id="s-story" value="${s.storyEvery}"></label>
    <a class="btn ghost" href="#/topics">Themen auswählen</a>
    <label class="field"><span>Neue Wörter ab Niveau</span><select id="s-start">${LEVELS.map((L) => `<option ${L === s.startLevel ? "selected" : ""}>${L}</option>`).join("")}</select></label>
    <label class="field"><span>Ziel-Behaltensquote: <b id="retv">${Math.round(s.retention * 100)} %</b></span>
      <input type="range" min="0.8" max="0.95" step="0.01" id="s-ret" value="${s.retention}"></label>
    <p class="small muted">Höher = öfter wiederholen, sicherer behalten. 90 % ist ein guter Standard.</p>
    <label class="check"><input type="checkbox" id="s-type" ${s.typeAnswer ? "checked" : ""}> Antwort eintippen</label>
    <label class="check"><input type="checkbox" id="s-auto" ${s.autoSpeak ? "checked" : ""}> Mit Stimme (Wort beim Aufdecken automatisch vorlesen)</label>
  </section>
  <section class="card">
    <h2>Design</h2>
    <p class="small muted">Jedes Design hat ein eigenes Layout für Startseite und Lernkarten.</p>
    <div class="design-list">${DESIGNS.map(
      (d) => `<button type="button" class="design-opt ${designKey(s.design) === d.key ? "on" : ""}" data-design="${d.key}">
          <span class="sw-row">${d.colors.map((x) => `<i style="background:${x}"></i>`).join("")}</span>
          <b>${d.name}</b><span class="small muted">${d.desc}</span></button>`
    ).join("")}</div>
  </section>
  <section class="card">
    <h2>Tägliche Erinnerung</h2>
    <p class="small muted">Trag dir eine tägliche Lernzeit in deinen Kalender ein. Dein Handy erinnert dich dann jeden Tag – auf iPhone und Android.</p>
    <div class="inline-form"><input type="time" id="remTime" value="${esc(s.reminderTime || "19:00")}" aria-label="Uhrzeit">
      <button class="btn primary" id="remAdd">📅 In Kalender eintragen</button></div>
  </section>
  <section class="card">
    <h2>Stimme</h2>
    <label class="check"><input type="checkbox" id="s-natural" ${s.voiceNatural !== false ? "checked" : ""}> Natürliche Stimme (Aufnahmen für alle Wörter und Beispielsätze)</label>
    <p class="small muted">Wähle, wer dir die Wörter vorliest. Geschichten liest die Stimme deines Geräts.</p>
    <div class="voice-list">${tts.PRESETS.map((p) => {
      const ok = tts.presetReady(p.key);
      const cur = tts.effectivePreset(s.voicePreset);
      return `<label class="voice-opt ${ok ? "" : "na"}" data-vopt="${p.key}">
        <input type="radio" name="vp" value="${p.key}" ${cur === p.key ? "checked" : ""} ${ok ? "" : "disabled"}>
        <span class="vo-text"><b>${esc(p.label)}</b><small class="muted" data-vhint="${p.key}">${esc(tts.presetHint(p))}${voiceStatus(p.key)}</small></span>
        <button type="button" class="icon-btn small" data-try="${p.key}" aria-label="Probe hören">${ICON.speaker}</button>
      </label>`;
    }).join("")}</div>
    ${rateSlider("s-rate5", L().hello)}
    <button class="btn ghost" id="testVoice">${ICON.speaker}<span>Testen</span></button>
  </section>
  <section class="card">
    <h2>KI-Server</h2>
    <label class="field"><span>KI-Anbieter</span><select id="s-provider">${[
      ["auto", "Automatisch (Claude → Gemini → Ollama)"],
      ["claude", "Claude (Anthropic)"],
      ["gemini", "Gemini (Google)"],
      ["ollama", "Ollama (lokal auf dem Mac)"],
      ["browser", "Im Browser: eigener Gemini-Key, sonst kostenlose KI"],
      ["free", "Kostenlose KI ohne Key (pollinations.ai)"],
    ]
      .map(([v, l]) => `<option value="${v}" ${s.provider === v ? "selected" : ""}>${l}</option>`)
      .join("")}</select></label>
    <label class="field" id="ollamaField" ${s.provider === "ollama" ? "" : "hidden"}><span>Ollama-Modell</span>
      <select id="s-ollama"><option value="">Erstes installiertes Modell</option>${
        s.ollamaModel ? `<option value="${esc(s.ollamaModel)}" selected>${esc(s.ollamaModel)}</option>` : ""
      }</select></label>
    <div id="browserFields" ${s.provider === "browser" || isStaticHost() ? "" : "hidden"}>
      <label class="field"><span>Gemini-API-Key – optional (bleibt nur auf diesem Gerät)</span>
        <input id="s-gkey" type="password" autocomplete="off" placeholder="AIza…" value="${esc(s.geminiKey)}"></label>
      <p class="small muted">Key kostenlos in Google AI Studio (aistudio.google.com → Get API key). Er wird nicht in Sicherungen exportiert.</p>
    </div>
    <label class="field"><span>Server-Adresse (leer = diese Seite)</span><input id="s-api" placeholder="https://dein-projekt.vercel.app" value="${esc(s.apiBase)}"></label>
    <label class="field"><span>App-Passwort (falls APP_SECRET gesetzt)</span><input id="s-secret" type="password" value="${esc(s.appSecret)}"></label>
    <button class="btn ghost" id="testApi">Verbindung testen</button>
    <p class="small" id="apiStatus"></p>
  </section>
  <section class="card">
    <h2>Daten</h2>
    <p class="small muted">Dein Fortschritt liegt nur in diesem Browser. Sichere ihn regelmäßig.</p>
    <div class="actions-row wrap">
      <button class="btn ghost" id="export">Sicherung herunterladen</button>
      <label class="btn ghost file-btn">Sicherung laden<input type="file" id="import" accept="application/json" hidden></label>
      <button class="btn ghost danger" id="reset">Alles zurücksetzen</button>
    </div>
  </section>
  <p class="center small muted">Wortwerk · Planung mit FSRS-5</p>`;

  const st = S.getState();
  const bind = (id, key, fn = (x) => x, ev = "change") => {
    const el = document.getElementById(id);
    el.addEventListener(ev, () => {
      st.settings[key] = fn(el.type === "checkbox" ? el.checked : el.value);
      S.save();
    });
  };
  bind("s-new", "newPerDay", (x) => Math.max(0, Math.min(50, Number(x) || 0)));
  bind("s-story", "storyEvery", (x) => Math.max(3, Math.min(25, Number(x) || 10)));
  bind("s-start", "startLevel");
  bind("s-ret", "retention", Number, "input");
  bind("s-type", "typeAnswer");
  bind("s-auto", "autoSpeak");
  bind("s-natural", "voiceNatural");
  $app.querySelectorAll("[data-design]").forEach(
    (b) =>
      (b.onclick = () => {
        st.settings.design = b.dataset.design;
        S.save();
        applyDesign(b.dataset.design);
        $app.querySelectorAll("[data-design]").forEach((x) => x.classList.toggle("on", x === b));
      })
  );
  $app.querySelectorAll('input[name="vp"]').forEach(
    (r) =>
      (r.onchange = () => {
        st.settings.voicePreset = r.value;
        S.save();
        say(L().hello);
      })
  );
  $app.querySelectorAll("[data-try]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.preventDefault();
        tts.setNatural(false);
        // Eigene Stimmen: die Original-Hörprobe vorspielen, solange noch nicht alles aufgenommen ist
        if (tts.presetProgress(b.dataset.try) < 0.98 && tts.playSample(b.dataset.try, st.settings.apiBase || DEFAULT_SERVER)) return;
        tts.speak(L().hello, { rate: st.settings.voiceRate, preset: b.dataset.try });
      })
  );
  bindRateSlider("s-rate5");
  bind("s-api", "apiBase");
  bind("s-secret", "appSecret");
  document.getElementById("s-ret").addEventListener("input", (e) => (document.getElementById("retv").textContent = Math.round(e.target.value * 100) + " %"));

  document.getElementById("testVoice").onclick = () => say(L().hello);
  document.getElementById("remAdd").onclick = () => {
    const t = document.getElementById("remTime").value || "19:00";
    st.settings.reminderTime = t;
    S.save();
    const [h, m] = t.split(":");
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const url = location.href.split("#")[0];
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wortwerk//DE", "BEGIN:VEVENT",
      `UID:wortwerk-${Date.now()}@wortwerk`, `DTSTAMP:${ymd}T000000Z`,
      `DTSTART:${ymd}T${h}${m}00`, "DURATION:PT15M", "RRULE:FREQ=DAILY",
      `SUMMARY:${L().flag} Wortwerk – ${L().name} lernen`, `DESCRIPTION:10 Minuten Vokabeln: ${url}`, `URL:${url}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Zeit zum Lernen!", "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "wortwerk-erinnerung.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Öffne die Datei und tippe auf „Hinzufügen“ – fertig.", 4000);
  };
  const lo = document.getElementById("logoutBtn");
  if (lo)
    lo.onclick = async () => {
      if (!confirm("Wirklich abmelden? Dein Fortschritt bleibt in deinem Konto gespeichert.")) return;
      lo.disabled = true;
      lo.textContent = "Wird gespeichert …";
      await cloud.logout();
    };
  $app.querySelectorAll("[data-lang]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (b.dataset.lang === S.lang()) return;
        await S.setLanguage(b.dataset.lang);
        tts.setLang(S.lang(), L().tts, L().audio);
  tts.preloadVariants();
        applyDesign(settings().design);
        toast(`${L().flag} Du lernst jetzt ${L().name}`);
        go("#/");
      })
  );

  bind("s-ollama", "ollamaModel");
  bind("s-gkey", "geminiKey", (x) => x.trim());
  // Stand der Aufnahmen nachtragen, sobald die Verzeichnisse geladen sind
  tts.voicesReady().then(() =>
    document.querySelectorAll("[data-vhint]").forEach((el) => {
      const p = tts.PRESETS.find((x) => x.key === el.dataset.vhint);
      if (!p) return;
      el.textContent = tts.presetHint(p) + voiceStatus(p.key);
      const ok = tts.presetReady(p.key);
      const box = el.closest("[data-vopt]");
      box.classList.toggle("na", !ok);
      const r = box.querySelector("input");
      r.disabled = !ok;
      r.checked = tts.effectivePreset(S.getState().settings.voicePreset) === p.key;
    })
  );
  const provSel = document.getElementById("s-provider");
  provSel.addEventListener("change", () => {
    st.settings.provider = provSel.value;
    S.save();
    document.getElementById("ollamaField").hidden = provSel.value !== "ollama";
    document.getElementById("browserFields").hidden = !(provSel.value === "browser" || provSel.value === "free" || isStaticHost());
    if (provSel.value === "ollama") loadOllamaModels();
  });

  const NAMES = { claude: "Claude", gemini: "Gemini", ollama: "Ollama" };
  async function loadOllamaModels() {
    try {
      const h = await health();
      const sel = document.getElementById("s-ollama");
      const models = h.providers?.ollama?.models || [];
      sel.innerHTML =
        `<option value="">Erstes installiertes Modell</option>` +
        models.map((m) => `<option value="${esc(m)}" ${m === st.settings.ollamaModel ? "selected" : ""}>${esc(m)}</option>`).join("");
      return h;
    } catch {
      return null;
    }
  }
  if (s.provider === "ollama") loadOllamaModels();

  document.getElementById("testApi").onclick = async () => {
    const out = document.getElementById("apiStatus");
    out.textContent = "Prüfe…";
    try {
      const h = await health();
      if (h.browser) {
        out.innerHTML = `<span class="${h.ok ? "ok" : "err"}">${h.ok ? "Bereit" : "Nicht bereit"} · ${esc(h.message)}</span>`;
        return;
      }
      const p = h.providers || {};
      const chosen = st.settings.provider === "auto" ? h.auto : st.settings.provider;
      const line = (k) => {
        const x = p[k] || {};
        if (k === "ollama")
          return x.available
            ? `✓ Ollama: ${x.models.length} Modell(e)`
            : x.running
              ? "✗ Ollama läuft, aber kein Modell installiert"
              : "✗ Ollama nicht gestartet";
        return x.available ? `✓ ${NAMES[k]} (${esc(x.model)})` : `✗ ${NAMES[k]}: kein Key in .env`;
      };
      const ok = p[chosen]?.available;
      out.innerHTML = `<span class="${ok ? "ok" : "err"}">${ok ? "Bereit" : "Nicht bereit"} · verwendet wird: ${NAMES[chosen]}</span><br>
        <span class="muted">${["claude", "gemini", "ollama"].map(line).join("<br>")}</span>`;
      if (chosen === "ollama") loadOllamaModels();
    } catch (err) {
      out.innerHTML = `<span class="err">${esc(err.message)}</span>`;
    }
  };

  document.getElementById("export").onclick = () => {
    const blob = new Blob([S.exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wortwerk-sicherung-${S.dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  document.getElementById("import").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      S.importData(await f.text());
      toast("Sicherung geladen");
      go("#/");
    } catch (err) {
      toast("Fehler: " + esc(err.message), 4000);
    }
  };
  document.getElementById("reset").onclick = () => {
    if (confirm("Wirklich ALLES löschen? Fortschritt, eigene Wörter und Geschichten gehen verloren.")) {
      S.resetAll();
      toast("Zurückgesetzt");
      go("#/");
    }
  };
}

// ---------- Start ----------
// Mit Konten: erst anmelden, dann den eigenen Fortschritt aus der Cloud laden
if (await cloud.start()) {
  await S.init();
  tts.setLang(S.lang(), L().tts, L().audio);
  tts.preloadVariants();
  applyDesign(settings().design);
  render();
} else {
  applyDesign("einfach");
  cloud.showLogin($app, { offline: !cloud.sdkLoaded() });
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
