// Wortwerk – Hauptlogik und Ansichten
import * as S from "./store.js";
import { schedule, preview, formatInterval, DAY, startOfDay } from "./fsrs.js";
import { TOPICS, LEVELS } from "./words.js";
import { storyPrompt, STORY_SYSTEM, extractJson } from "./prompts.js";
import { callApi, health, normalizeStory } from "./api.js";
import * as tts from "./tts.js";

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

function say(text) {
  const s = settings();
  tts.speak(text, { rate: s.voiceRate, voiceName: s.voiceName });
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
const routes = { home, learn, stories, story, words, add, stats, settings: settingsView };

function render() {
  tts.stop();
  document.getElementById("toast").classList.remove("show");
  const [name, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  const arg = rest.length ? decodeURIComponent(rest.join("/")) : undefined;
  const view = routes[name] || home;
  document.body.dataset.view = routes[name] ? name : "home";
  $nav.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.route === (routes[name] ? name : "home") || (a.dataset.route === "stories" && name === "story") || (a.dataset.route === "words" && name === "add")));
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
  const prog = Math.min(1, (s.newSinceStory || 0) / s.settings.storyEvery);
  const all = S.cards();
  const lvl = LEVELS.map((L) => {
    const inL = all.filter((c) => c.level === L);
    const ok = inL.filter((c) => S.isLearned(c) || c.state === "known").length;
    return { L, ok, total: inL.length };
  });

  $app.innerHTML = `
  <header class="top">
    <div>
      <p class="eyebrow">${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</p>
      <h1>Hallo!</h1>
    </div>
    <a class="icon-btn" href="#/settings" aria-label="Einstellungen">${ICON.gear}</a>
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
    ${
      total
        ? `<a class="btn primary big" href="#/learn">${total} ${total === 1 ? "Wort" : "Wörter"} üben</a>`
        : `<p class="done-msg">Für heute ist alles erledigt.</p>
           <a class="btn ghost" href="#/learn/extra">5 zusätzliche neue Wörter</a>`
    }
  </section>

  <section class="card story-teaser ${ready ? "ready" : ""}">
    <div class="row-between">
      <h2>Nächste Geschichte</h2>
      <span class="muted small">${Math.min(s.newSinceStory || 0, s.settings.storyEvery)} / ${s.settings.storyEvery} Wörter</span>
    </div>
    <div class="meter"><div style="width:${prog * 100}%"></div></div>
    <p class="muted">${
      ready
        ? "Deine neuen Wörter sind bereit – lies sie in einer kurzen Geschichte im Zusammenhang."
        : "Nach jeweils " + s.settings.storyEvery + " neuen Wörtern entsteht eine Geschichte, die sie verbindet."
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
}

// ---------- Lernsitzung ----------
let session = null;

function buildQueue(arg) {
  if (arg && arg.startsWith("story:")) {
    const st = S.getState().stories.find((x) => x.id === arg.slice(6));
    return (st?.wordIds || []).filter((id) => S.getState().cards[id]);
  }
  const due = S.dueCards().map((c) => c.id);
  let news;
  if (arg === "extra") {
    const minLevel = LEVELS.indexOf(settings().startLevel);
    news = S.cards()
      .filter((c) => c.state === "new" && LEVELS.indexOf(c.level) >= minLevel)
      .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9))
      .slice(0, 5)
      .map((c) => c.id);
  } else news = S.newCardsToday().map((c) => c.id);
  // Neue Wörter zwischen die Wiederholungen mischen (nach je 2 Wiederholungen eins)
  const q = [];
  while (due.length || news.length) {
    q.push(...due.splice(0, 2));
    if (news.length) q.push(news.shift());
  }
  return q;
}

function learn(arg) {
  session = { queue: buildQueue(arg), pos: 0, done: 0, correct: 0, again: 0, total: 0, fromStory: arg?.startsWith("story:") };
  session.total = session.queue.length;
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
  </header>`;
}

function showCard(revealed = false, typed = null) {
  const c = currentCard();
  if (!c) return sessionEnd();
  const isNew = c.state === "new";
  const s = settings();
  const noteFF = /false friend/i.test(c.note);

  const meta = `<div class="card-meta">
      <span class="badge lvl-${c.level}">${c.level}</span>
      <span class="chip">${esc(TOPICS[c.topic] || c.topic || "")}</span>
      ${isNew ? '<span class="chip new">Neu</span>' : ""}
      ${c.lapses >= 2 ? '<span class="chip warn">Schwierig</span>' : ""}
    </div>`;

  let body;
  if (!revealed) {
    body = `
      ${meta}
      <p class="de-word">${esc(c.de)} ${c.pos ? `<small>(${esc(c.pos)})</small>` : ""}</p>
      ${c.ex ? `<p class="ex">${clozeHtml(c.ex)}</p>` : ""}
      ${c.exDe ? `<p class="ex-de">${marked(c.exDe)}</p>` : ""}
      <p class="hint" id="hint" hidden>${esc(hintFor(c.en))}</p>
      ${s.typeAnswer ? `<input id="answer" class="answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Englisches Wort eingeben…">` : ""}
    `;
  } else {
    const ok = typed == null ? null : typed.trim().toLowerCase() === c.en.toLowerCase();
    body = `
      ${meta}
      <div class="en-row">
        <p class="en-word">${esc(c.en)}</p>
        <button class="icon-btn" data-say="${esc(c.en)}" aria-label="Aussprechen">${ICON.speaker}</button>
      </div>
      ${typed != null ? `<p class="typed ${ok ? "ok" : "bad"}">${ok ? "Richtig!" : `Deine Eingabe: <s>${esc(typed) || "–"}</s>`}</p>` : ""}
      <p class="de-small">${esc(c.de)}</p>
      ${c.ex ? `<p class="ex">${marked(c.ex)} <button class="icon-btn small" data-say="${esc(plain(c.ex))}" aria-label="Satz vorlesen">${ICON.speaker}</button></p>` : ""}
      ${c.exDe ? `<p class="ex-de">${marked(c.exDe)}</p>` : ""}
      ${c.note ? `<p class="note ${noteFF ? "ff" : ""}">${esc(c.note)}</p>` : ""}
    `;
  }

  let actions;
  if (!revealed) {
    actions = `
      <div class="actions-row">
        <button class="btn ghost" id="hintBtn">Hinweis</button>
      </div>
      <button class="btn primary big" id="reveal">Aufdecken</button>`;
  } else {
    const p = preview(c, Date.now(), s.retention);
    const lbl = { 1: "Nochmal", 2: "Schwer", 3: "Gut", 4: "Leicht" };
    actions = `<div class="grades">${[1, 2, 3, 4]
      .map((g) => `<button class="grade g${g}" data-g="${g}"><span>${lbl[g]}</span><small>${formatInterval(p[g])}</small></button>`)
      .join("")}</div>
      <button class="btn ghost known-btn" id="knownBtn">Kenne ich schon – nicht mehr abfragen</button>`;
  }

  $app.innerHTML = `${sessionHeader()}
    <article class="flash ${revealed ? "back" : "front"}">${body}</article>
    <div class="flash-actions">${actions}</div>`;

  $app.querySelectorAll("[data-say]").forEach((b) => (b.onclick = () => say(b.dataset.say)));

  if (!revealed) {
    const input = document.getElementById("answer");
    const doReveal = () => showCard(true, input ? input.value : null);
    document.getElementById("reveal").onclick = doReveal;
    document.getElementById("hintBtn").onclick = () => (document.getElementById("hint").hidden = false);
    if (input) {
      input.focus();
      input.onkeydown = (e) => {
        if (e.key === "Enter") doReveal();
      };
    }
  } else {
    if (s.autoSpeak) say(c.en);
    $app.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => rate(Number(b.dataset.g))));
    document.getElementById("knownBtn").onclick = () => markKnown(c);
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
  const wasNew = c.state === "new";
  const next = schedule(c, g, Date.now(), settings().retention);
  S.updateCard(next);
  S.logReview(g, wasNew);
  session.done++;
  if (g > 1) session.correct++;
  else {
    session.again++;
    // Karte später in dieser Sitzung erneut zeigen
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
  } else if (!reveal && ["1", "2", "3", "4"].includes(e.key)) {
    const b = $app.querySelector(`[data-g="${e.key}"]`);
    if (b) b.click();
  }
});

// ---------- Geschichten ----------
function stories() {
  const s = S.getState();
  const introduced = S.cards().filter((c) => c.introducedAt).length;
  $app.innerHTML = `
  <header class="top"><div><h1>Geschichten</h1>
    <p class="muted">Kurze Texte, die deine neuen Wörter verbinden.</p></div></header>
  <section class="card">
    <div class="row-between"><h2>Nächste Geschichte</h2>
      <span class="small muted">${Math.min(s.newSinceStory || 0, s.settings.storyEvery)} / ${s.settings.storyEvery}</span></div>
    <div class="meter"><div style="width:${Math.min(100, ((s.newSinceStory || 0) / s.settings.storyEvery) * 100)}%"></div></div>
    ${
      introduced >= 3
        ? `<a class="btn ${S.storyReady() ? "primary" : "ghost"}" href="#/story/new">${S.storyReady() ? "Geschichte erstellen" : "Trotzdem jetzt erstellen"}</a>`
        : `<p class="muted small">Lerne zuerst ein paar neue Wörter.</p>`
    }
  </section>
  ${
    s.stories.length
      ? s.stories
          .map(
            (st) => `<a class="card story-item" href="#/story/${st.id}">
        <h3>${esc(st.title)}</h3>
        <p class="small muted">${fmtDate(st.createdAt)} · ${st.words.length} Wörter${st.quizScore != null ? ` · Quiz ${st.quizScore}/${st.questions.length}` : ""}</p>
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
  const words = S.storyCandidates();
  const lvl = settings().storyLevel;
  if (words.length < 3) {
    $app.innerHTML = `<div class="center-msg"><h1>Noch zu wenige Wörter</h1><p class="muted">Lerne zuerst ein paar neue Wörter.</p><a class="btn primary" href="#/learn">Lernen</a></div>`;
    return;
  }
  $app.innerHTML = `
  <header class="top"><a class="icon-btn plain" href="#/stories" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Neue Geschichte</h1><span></span></header>
  <section class="card">
    <h2>Diese Wörter kommen vor</h2>
    <div class="chips">${words.map((w) => `<span class="chip" title="${esc(w.de)}">${esc(w.en)}</span>`).join("")}</div>
    <label class="field"><span>Sprachniveau des Textes</span>
      <select id="lvl">${["B1", "B2", "C1"].map((L) => `<option ${L === lvl ? "selected" : ""}>${L}</option>`).join("")}</select></label>
    <button class="btn primary big" id="gen">Mit KI erstellen</button>
    <p class="small muted" id="status"></p>
  </section>
  <details class="card">
    <summary><h2>Ohne Server (manuell)</h2></summary>
    <p class="small muted">Prompt kopieren, in der Claude-App einfügen und die Antwort (JSON) unten einfügen.</p>
    <button class="btn ghost" id="copy">Prompt kopieren</button>
    <textarea id="paste" rows="6" placeholder='{"title": "...", "text": "...", ...}'></textarea>
    <button class="btn ghost" id="usePaste">Antwort übernehmen</button>
  </details>`;

  const level = () => document.getElementById("lvl").value;
  const finish = (data) => {
    const st = normalizeStory(data, words);
    S.addStory(st);
    const s = S.getState();
    s.settings.storyLevel = level();
    S.save();
    go("#/story/" + st.id);
  };
  document.getElementById("gen").onclick = async (e) => {
    const btn = e.currentTarget;
    const status = document.getElementById("status");
    btn.disabled = true;
    btn.textContent = "Geschichte wird geschrieben…";
    status.textContent =
      settings().provider === "ollama"
        ? "Lokales Modell – kann je nach Mac 30–90 Sekunden dauern."
        : "Das dauert meist 10–20 Sekunden.";
    try {
      const data = await callApi("story", { words: words.map((w) => ({ en: w.en, de: w.de })), level: level() });
      finish(data);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Erneut versuchen";
      status.innerHTML = `<span class="err">${esc(err.message)}</span>`;
    }
  };
  document.getElementById("copy").onclick = async () => {
    const text = STORY_SYSTEM + "\n\n" + storyPrompt(words, level());
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

function storyHtml(st) {
  return st.text
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p>${esc(p).replace(/\*\*([^*]+)\*\*/g, (m, w) => `<button class="tw" data-w="${esc(w)}">${w}</button>`)}</p>`
    )
    .join("");
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
      <select id="rate" aria-label="Tempo"><option value="0.8">langsam</option><option value="0.95" selected>normal</option><option value="1.1">schnell</option></select>
    </div>
    <div class="story-text">${storyHtml(st)}</div>
    <p class="small muted">Tippe auf ein markiertes Wort für die Übersetzung.</p>
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

  // Wort-Übersetzung
  $app.querySelectorAll(".tw").forEach(
    (b) =>
      (b.onclick = () => {
        const g = glossFor(st, b.dataset.w);
        say(b.dataset.w);
        toast(`<b>${esc(b.dataset.w)}</b> – ${esc(g || "?")}`);
      })
  );

  // Vorlesen
  const play = document.getElementById("play");
  play.onclick = () => {
    if (tts.speaking()) {
      tts.stop();
      play.innerHTML = `${ICON.play}<span>Vorlesen</span>`;
      return;
    }
    play.innerHTML = `${ICON.stop}<span>Stopp</span>`;
    tts.speak(st.title + ". " + plain(st.text), {
      rate: Number(document.getElementById("rate").value),
      voiceName: settings().voiceName,
      onend: () => (play.innerHTML = `${ICON.play}<span>Vorlesen</span>`),
    });
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
  <header class="top"><h1>Wortschatz</h1><a class="btn primary small-btn" href="#/add">${ICON.plus}<span>Wort</span></a></header>
  <div class="tabs">${tabs
    .map(([k, l]) => `<button class="tab ${wordsTab === k ? "active" : ""}" data-tab="${k}">${l} <small>${counts[k]}</small></button>`)
    .join("")}</div>
  <div class="searchbar">${ICON.search}<input id="q" type="search" placeholder="Suchen (Englisch oder Deutsch)" value="${esc(wordsQuery)}"></div>
  <div class="chips filter">${["", ...LEVELS]
    .map((L) => `<button class="chip ${wordsLevel === L ? "active" : ""}" data-lvl="${L}">${L || "Alle"}</button>`)
    .join("")}</div>
  <div id="list" class="word-list"></div>`;

  const renderList = () => {
    const q = wordsQuery.trim().toLowerCase();
    let list = all.filter((c) => S.categorize(c) === wordsTab);
    if (wordsLevel) list = list.filter((c) => c.level === wordsLevel);
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
  const topicOpts = Object.entries({ ...TOPICS, alltag: "Alltag" })
    .map(([k, v]) => `<option value="${k}">${esc(v)}</option>`)
    .join("");
  $app.innerHTML = `
  <header class="top"><a class="icon-btn plain" href="#/words" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Wort hinzufügen</h1><span></span></header>
  <section class="card">
    <label class="field"><span>Englisch *</span><input id="f-en" autocapitalize="off" placeholder="z. B. reluctant"></label>
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

  <section class="card">
    <h2>Wortliste mit KI erweitern</h2>
    <p class="small muted">Erzeugt neue Karten auf deinem Niveau, ohne Wörter, die du schon hast.</p>
    <div class="grid2">
      <label class="field"><span>Niveau</span><select id="g-lvl">${LEVELS.map((L) => `<option ${L === "C1" ? "selected" : ""}>${L}</option>`).join("")}</select></label>
      <label class="field"><span>Anzahl</span><select id="g-n"><option>5</option><option selected>10</option><option>20</option></select></label>
    </div>
    <label class="field"><span>Thema (frei)</span><input id="g-topic" placeholder="z. B. Trading & Finanzmärkte, Reisen, Fitness"></label>
    <button class="btn primary" id="gen">Wörter generieren</button>
    <div id="genOut"></div>
  </section>`;

  const v = (id) => document.getElementById(id).value.trim();
  const setv = (id, x) => (document.getElementById(id).value = x || "");

  document.getElementById("fill").onclick = async (e) => {
    const en = v("f-en");
    if (!en) return toast("Bitte zuerst das englische Wort eingeben");
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
      if (TOPICS[w.topic] || w.topic === "alltag") setv("f-topic", w.topic);
    } catch (err) {
      toast(esc(err.message), 4000);
    }
    b.disabled = false;
    b.textContent = "Rest mit KI ausfüllen";
  };

  document.getElementById("saveWord").onclick = () => {
    const en = v("f-en");
    if (!en) return toast("Das englische Wort fehlt");
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

  document.getElementById("gen").onclick = async (e) => {
    const b = e.currentTarget;
    const out = document.getElementById("genOut");
    b.disabled = true;
    b.textContent = "Wird erzeugt…";
    out.innerHTML = "";
    try {
      const data = await callApi("words", {
        mode: "generate",
        level: v("g-lvl"),
        topic: v("g-topic"),
        count: Number(v("g-n")),
        exclude: S.cards().map((c) => c.en),
      });
      const list = (data.words || []).filter((w) => w?.en && !S.hasWord(w.en));
      if (!list.length) throw new Error("Keine neuen Wörter erhalten");
      out.innerHTML = `<div class="gen-list">${list
        .map(
          (w, i) => `<label class="gen-item"><input type="checkbox" data-i="${i}" checked>
          <div><b>${esc(w.en)}</b> <span class="badge lvl-${esc(w.level)}">${esc(w.level)}</span><br>
          <span class="muted">${esc(w.de)}</span><br><span class="small">${marked(w.ex || "")}</span></div></label>`
        )
        .join("")}</div><button class="btn primary" id="addGen">Ausgewählte hinzufügen</button>`;
      document.getElementById("addGen").onclick = () => {
        let n = 0;
        out.querySelectorAll("input[data-i]:checked").forEach((cb) => {
          S.addCustomCard(list[Number(cb.dataset.i)]);
          n++;
        });
        toast(`${n} Wörter hinzugefügt`);
        out.innerHTML = "";
      };
    } catch (err) {
      out.innerHTML = `<p class="err small">${esc(err.message)}</p>`;
    }
    b.disabled = false;
    b.textContent = "Wörter generieren";
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
  const voices = tts.englishVoices();
  $app.innerHTML = `
  <header class="top"><a class="icon-btn plain" href="#/" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Einstellungen</h1><span></span></header>
  <section class="card">
    <h2>Lernen</h2>
    <label class="field"><span>Neue Wörter pro Tag</span><input type="number" min="0" max="50" id="s-new" value="${s.newPerDay}"></label>
    <label class="field"><span>Geschichte nach je … neuen Wörtern</span><input type="number" min="3" max="25" id="s-story" value="${s.storyEvery}"></label>
    <label class="field"><span>Neue Wörter ab Niveau</span><select id="s-start">${LEVELS.map((L) => `<option ${L === s.startLevel ? "selected" : ""}>${L}</option>`).join("")}</select></label>
    <label class="field"><span>Ziel-Behaltensquote: <b id="retv">${Math.round(s.retention * 100)} %</b></span>
      <input type="range" min="0.8" max="0.95" step="0.01" id="s-ret" value="${s.retention}"></label>
    <p class="small muted">Höher = öfter wiederholen, sicherer behalten. 90 % ist ein guter Standard.</p>
    <label class="check"><input type="checkbox" id="s-type" ${s.typeAnswer ? "checked" : ""}> Antwort eintippen</label>
    <label class="check"><input type="checkbox" id="s-auto" ${s.autoSpeak ? "checked" : ""}> Wort beim Aufdecken vorlesen</label>
  </section>
  <section class="card">
    <h2>Stimme</h2>
    <label class="field"><span>Englische Stimme</span><select id="s-voice"><option value="">Automatisch</option>${voices
      .map((v) => `<option value="${esc(v.name)}" ${v.name === s.voiceName ? "selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`)
      .join("")}</select></label>
    <label class="field"><span>Tempo: <b id="ratev">${s.voiceRate}</b></span><input type="range" min="0.6" max="1.3" step="0.05" id="s-rate" value="${s.voiceRate}"></label>
    <button class="btn ghost" id="testVoice">${ICON.speaker}<span>Testen</span></button>
  </section>
  <section class="card">
    <h2>KI-Server</h2>
    <label class="field"><span>KI-Anbieter</span><select id="s-provider">${[
      ["auto", "Automatisch (Claude → Gemini → Ollama)"],
      ["claude", "Claude (Anthropic)"],
      ["gemini", "Gemini (Google)"],
      ["ollama", "Ollama (lokal auf dem Mac)"],
    ]
      .map(([v, l]) => `<option value="${v}" ${s.provider === v ? "selected" : ""}>${l}</option>`)
      .join("")}</select></label>
    <label class="field" id="ollamaField" ${s.provider === "ollama" ? "" : "hidden"}><span>Ollama-Modell</span>
      <select id="s-ollama"><option value="">Erstes installiertes Modell</option>${
        s.ollamaModel ? `<option value="${esc(s.ollamaModel)}" selected>${esc(s.ollamaModel)}</option>` : ""
      }</select></label>
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
  bind("s-voice", "voiceName");
  bind("s-rate", "voiceRate", Number, "input");
  bind("s-api", "apiBase");
  bind("s-secret", "appSecret");
  document.getElementById("s-ret").addEventListener("input", (e) => (document.getElementById("retv").textContent = Math.round(e.target.value * 100) + " %"));
  document.getElementById("s-rate").addEventListener("input", (e) => (document.getElementById("ratev").textContent = e.target.value));
  document.getElementById("testVoice").onclick = () => say("The official announcement was made today.");

  bind("s-ollama", "ollamaModel");
  const provSel = document.getElementById("s-provider");
  provSel.addEventListener("change", () => {
    st.settings.provider = provSel.value;
    S.save();
    document.getElementById("ollamaField").hidden = provSel.value !== "ollama";
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
S.load();
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
