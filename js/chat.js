// KI-Gespräch: Rollenspiel in der Lernsprache mit den eigenen Lernwörtern.
// Antworten der KI werden vorgelesen; Fehler werden freundlich auf Deutsch erklärt.

import * as S from "./store.js";
import * as tts from "./tts.js";
import { L } from "./langs.js";
import { chatTurn, sayIn } from "./api.js";
import { canSpeak, listenOnce } from "./practice.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const SCENES = [
  { key: "cafe", ic: "☕", label: "Im Café", text: "The learner orders something in a café; you are the waiter." },
  { key: "hotel", ic: "🏨", label: "Im Hotel", text: "The learner checks in at a hotel; you are the receptionist." },
  { key: "weg", ic: "🗺️", label: "Nach dem Weg fragen", text: "The learner asks a local for directions in a city; you are the helpful local." },
  { key: "arzt", ic: "🩺", label: "Beim Arzt", text: "The learner visits a doctor with a minor health problem; you are the doctor." },
  { key: "einkauf", ic: "🛍️", label: "Einkaufen", text: "The learner buys clothes in a shop; you are the shop assistant." },
  { key: "smalltalk", ic: "💬", label: "Smalltalk", text: "Casual small talk between two new acquaintances at a party; ask about hobbies, work and travel." },
  { key: "job", ic: "💼", label: "Vorstellungsgespräch", text: "A job interview; you are the friendly interviewer." },
];

let STATE = null; // laufendes Gespräch (bleibt beim Wechsel innerhalb der Seite erhalten)
const GOAL_TURNS = 6; // so viele eigene Antworten, dann verabschieden

export function chatView($app, ctx, sceneKey = "") {
  // Test-Schalter: neues Gespräch (Vorschläge, Ziel, Auswertung) oder das bisherige
  if (ctx.settings().chatV2 === false) return chatClassic($app, ctx, sceneKey);
  return chatV2($app, ctx, sceneKey);
}

function chatClassic($app, { settings, ICON }, sceneKey = "") {
  const header = `<header class="top"><a class="icon-btn plain" href="#/${sceneKey ? "chat" : ""}" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Gespräch</h1><span></span></header>`;
  const scene = SCENES.find((s) => s.key === sceneKey);
  if (!scene) {
    STATE = null;
    $app.innerHTML = `${header}
    <p class="listen-how">Übe echte Gespräche auf ${esc(L().name)}. Du schreibst oder sprichst, die KI antwortet passend zu deinem Niveau und erklärt Fehler auf Deutsch.</p>
    <div class="ef-tiles">${SCENES.map(
      (s) => `<a class="ef-tile" href="#/chat/${s.key}"><span class="ef-tic">${s.ic}</span><b>${s.label}</b></a>`
    ).join("")}</div>`;
    return;
  }
  const level = settings().storyLevel || "B1";
  if (!STATE || STATE.scene !== scene.key || STATE.lang !== S.lang()) {
    const words = S.cards()
      .filter((c) => c.state === "learning" || c.state === "review")
      .slice(-15)
      .map((c) => c.en);
    STATE = { scene: scene.key, lang: S.lang(), words, msgs: [] };
  }
  const st = STATE;

  $app.innerHTML = `${header}
  <p class="chat-scene">${scene.ic} <b>${scene.label}</b> · Niveau ${esc(level)}</p>
  <div class="chat-log" id="chatLog" aria-live="polite"></div>
  <form class="chat-form" id="chatForm">
    ${canSpeak() ? `<button type="button" class="icon-btn big" id="chatMic" aria-label="Sprechen">🎤</button>` : ""}
    <input id="chatIn" autocomplete="off" autocapitalize="off" placeholder="Deine Antwort auf ${esc(L().name)} …">
    <button class="ef-btn ef-pri chat-send" type="submit">Senden</button>
  </form>
  <p class="small muted">Tippe auf eine Antwort, um die deutsche Übersetzung zu sehen.</p>`;

  const $log = document.getElementById("chatLog");
  const $in = document.getElementById("chatIn");
  const say = (t) => tts.speak(t, { rate: settings().voiceRate, preset: settings().voicePreset });
  const draw = () => {
    $log.innerHTML = st.msgs
      .map((m, i) =>
        m.role === "user"
          ? `<div class="msg me"><p>${esc(m.text)}</p>${m.correction ? `<p class="msg-fix">💡 ${esc(m.correction)}</p>` : ""}</div>`
          : `<div class="msg ai" data-i="${i}"><p>${esc(m.text)}</p><p class="msg-de" hidden>${esc(m.de)}</p>
             <button class="msg-say" data-say-i="${i}" aria-label="Vorlesen">🔊</button></div>`
      )
      .join("") + (st.busy ? `<div class="msg ai typing"><p>…</p></div>` : "") + (st.err ? `<p class="p-verdict bad">${esc(st.err)}</p>` : "");
    $log.scrollTop = $log.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  };
  $log.onclick = (e) => {
    const sb = e.target.closest("[data-say-i]");
    if (sb) return say(st.msgs[+sb.dataset.sayI].text);
    const m = e.target.closest(".msg.ai[data-i]");
    if (m) m.querySelector(".msg-de").hidden = !m.querySelector(".msg-de").hidden;
  };
  async function turn() {
    st.busy = true;
    st.err = "";
    draw();
    try {
      const history = st.msgs.map((m) => ({ role: m.role, text: m.text }));
      const r = await chatTurn({ scenario: scene.text, level, words: st.words, history });
      const last = [...st.msgs].reverse().find((m) => m.role === "user");
      if (last && r.correction) last.correction = r.correction;
      st.msgs.push({ role: "ai", text: r.reply, de: r.de });
      say(r.reply);
    } catch (e) {
      st.err = "Die KI antwortet gerade nicht. Bitte gleich noch einmal senden.";
    }
    st.busy = false;
    draw();
  }
  document.getElementById("chatForm").onsubmit = (e) => {
    e.preventDefault();
    const t = $in.value.trim();
    if (!t || st.busy) return;
    st.msgs.push({ role: "user", text: t });
    $in.value = "";
    turn();
  };
  const mic = document.getElementById("chatMic");
  if (mic)
    mic.onclick = async () => {
      mic.classList.add("rec");
      try {
        const heard = await listenOnce();
        if (heard) $in.value = String(heard);
      } catch (e) {
        st.err = e.message;
        draw();
      }
      mic.classList.remove("rec");
    };
  draw();
  if (!st.msgs.length) turn();
}

// ---------- Neues Gespräch: Vorschläge, „Sag …“, Ziel, Auswertung ----------
const fold = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const lemma = (en) => fold(en).replace(/^(to|the|a|an|il|lo|la|le|gli|i|l'|el|los|las|un|una|uno)\s+/, "").trim();

function chatV2($app, { settings, ICON }, sceneKey = "") {
  const header = `<header class="top"><a class="icon-btn plain" href="#/${sceneKey ? "chat" : ""}" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Gespräch</h1>${sceneKey ? `<button class="btn ghost small-btn" id="chatEnd">Beenden</button>` : "<span></span>"}</header>`;
  const scene = SCENES.find((s) => s.key === sceneKey);
  if (!scene) {
    STATE = null;
    $app.innerHTML = `${header}
    <p class="listen-how">Sprich mit einer Figur auf ${esc(L().name)}. Sie baut deine Lernwörter ein, hilft dir mit Antwortvorschlägen und zeigt dir am Ende, wie gut es lief.</p>
    <div class="ef-tiles">${SCENES.map(
      (s) => `<a class="ef-tile" href="#/chat/${s.key}"><span class="ef-tic">${s.ic}</span><b>${s.label}</b></a>`
    ).join("")}</div>`;
    return;
  }
  const level = settings().storyLevel || "B1";
  if (!STATE || STATE.scene !== scene.key || STATE.lang !== S.lang() || !STATE.v2) {
    const learn = S.cards()
      .filter((c) => c.state === "learning" || c.state === "review")
      .slice(-12)
      .map((c) => ({ en: c.en, de: c.de }));
    STATE = { v2: true, scene: scene.key, lang: S.lang(), learn, msgs: [], sugg: [], newWords: [], added: {}, bye: false, done: false };
  }
  const st = STATE;
  const goal = `answer at least ${GOAL_TURNS} times, then say goodbye`;
  const say = (t) => tts.speak(t, { rate: settings().voiceRate, preset: settings().voicePreset });
  const userMsgs = () => st.msgs.filter((m) => m.role === "user");
  const usedLearn = () => {
    const text = " " + fold(userMsgs().map((m) => m.text).join(" ")) + " ";
    return st.learn.filter((w) => {
      const l = lemma(w.en);
      return l && text.includes(l.length > 4 ? l.slice(0, Math.max(4, l.length - 2)) : " " + l);
    });
  };

  if (st.done) return summary();

  $app.innerHTML = `${header}
  <div class="cv-goal">
    <div class="cv-goal-row"><span>${scene.ic} <b>${scene.label}</b> · ${esc(level)}</span><span id="cvGoalTxt"></span></div>
    <div class="cv-bar"><i id="cvBar"></i></div>
  </div>
  ${st.learn.length ? `<p class="cv-words small">Deine Lernwörter: ${st.learn.map((w) => `<span class="chip new" data-lw="${esc(w.en)}" title="${esc(w.de)}">${esc(w.en)}</span>`).join(" ")}</p>` : ""}
  <div class="chat-log" id="chatLog" aria-live="polite"></div>
  <div class="cv-sugg" id="cvSugg"></div>
  <div class="cv-say" id="cvSay" hidden>
    <input id="cvSayIn" autocomplete="off" placeholder="Was möchtest du sagen? (auf Deutsch)">
    <button class="ef-btn ef-pri chat-send" id="cvSayGo" type="button">Übersetzen</button>
  </div>
  <form class="chat-form" id="chatForm">
    ${canSpeak() ? `<button type="button" class="icon-btn big" id="chatMic" aria-label="Sprechen">🎤</button>` : ""}
    <input id="chatIn" autocomplete="off" autocapitalize="off" placeholder="Deine Antwort auf ${esc(L().name)} …">
    <button class="ef-btn ef-pri chat-send" type="submit">Senden</button>
  </form>
  <p class="small muted center"><button type="button" class="linkish" id="cvSayBtn">💬 Sag es auf Deutsch – ich übersetze</button></p>`;

  const $log = document.getElementById("chatLog");
  const $in = document.getElementById("chatIn");
  const $sugg = document.getElementById("cvSugg");
  const goalUpdate = () => {
    const n = userMsgs().length;
    const pct = Math.min(100, Math.round((Math.min(n, GOAL_TURNS) / GOAL_TURNS) * 90 + (st.bye ? 10 : 0)));
    document.getElementById("cvBar").style.width = pct + "%";
    document.getElementById("cvGoalTxt").textContent =
      n < GOAL_TURNS ? `Ziel: ${n} von ${GOAL_TURNS} Antworten` : st.bye ? "Ziel erreicht 🎉" : "Jetzt verabschieden 👋";
    const used = new Set(usedLearn().map((w) => w.en));
    $app.querySelectorAll("[data-lw]").forEach((c) => c.classList.toggle("used", used.has(c.dataset.lw)));
  };
  const draw = () => {
    $log.innerHTML =
      st.msgs
        .map((m, i) =>
          m.role === "user"
            ? `<div class="msg me"><p>${esc(m.text)}</p>${m.correction ? `<p class="msg-fix">💡 ${esc(m.correction)}</p>` : ""}</div>`
            : `<div class="msg ai" data-i="${i}"><p>${esc(m.text)}</p><p class="msg-de" hidden>${esc(m.de)}</p>
               <button class="msg-say" data-say-i="${i}" aria-label="Vorlesen">🔊</button></div>`
        )
        .join("") +
      (st.busy ? `<div class="msg ai typing"><p>…</p></div>` : "") +
      (st.err ? `<p class="p-verdict bad">${esc(st.err)}</p>` : "");
    $sugg.innerHTML =
      !st.busy && st.sugg.length && !st.bye
        ? `<p class="cv-label">Vorschläge – antippen zum Übernehmen, 🔊 zum Üben</p>` +
          st.sugg
            .map(
              (x, i) => `<div class="cv-chip"><button type="button" class="cv-use" data-sg="${i}">${esc(x.t)}<small>${esc(x.de)}</small></button>
                <button type="button" class="cv-hear" data-sh="${i}" aria-label="Anhören">🔊</button></div>`
            )
            .join("")
        : st.bye && !st.busy
          ? `<button class="ef-btn ef-pri" id="cvFinish" type="button">Auswertung ansehen ⭐</button>`
          : "";
    goalUpdate();
    window.scrollTo(0, document.body.scrollHeight);
    const fin = document.getElementById("cvFinish");
    if (fin) fin.onclick = () => ((st.done = true), summary());
  };
  $log.onclick = (e) => {
    const sb = e.target.closest("[data-say-i]");
    if (sb) return say(st.msgs[+sb.dataset.sayI].text);
    const m = e.target.closest(".msg.ai[data-i]");
    if (m) m.querySelector(".msg-de").hidden = !m.querySelector(".msg-de").hidden;
  };
  $sugg.onclick = (e) => {
    const u = e.target.closest("[data-sg]");
    if (u) {
      $in.value = st.sugg[+u.dataset.sg].t;
      $in.focus();
      return;
    }
    const h = e.target.closest("[data-sh]");
    if (h) say(st.sugg[+h.dataset.sh].t);
  };
  async function turn() {
    st.busy = true;
    st.err = "";
    draw();
    try {
      const history = st.msgs.map((m) => ({ role: m.role, text: m.text }));
      const r = await chatTurn({ scenario: scene.text, level, words: st.learn.map((w) => w.en), history, goal });
      const last = [...st.msgs].reverse().find((m) => m.role === "user");
      if (last && r.correction) last.correction = r.correction;
      st.msgs.push({ role: "ai", text: r.reply, de: r.de });
      st.sugg = r.suggestions;
      for (const w of r.words) if (!st.newWords.some((x) => fold(x.en) === fold(w.en)) && !S.findCard?.(w.en)) st.newWords.push(w);
      if (r.bye && userMsgs().length >= 2) st.bye = true;
      say(r.reply);
    } catch (e) {
      st.err = "Die KI antwortet gerade nicht. Bitte gleich noch einmal senden.";
    }
    st.busy = false;
    draw();
  }
  document.getElementById("chatForm").onsubmit = (e) => {
    e.preventDefault();
    const t = $in.value.trim();
    if (!t || st.busy) return;
    st.msgs.push({ role: "user", text: t });
    st.sugg = [];
    $in.value = "";
    turn();
  };
  const mic = document.getElementById("chatMic");
  if (mic)
    mic.onclick = async () => {
      mic.classList.add("rec");
      try {
        const heard = await listenOnce();
        if (heard) $in.value = String(heard);
      } catch (e) {
        st.err = e.message;
        draw();
      }
      mic.classList.remove("rec");
    };
  const sayBox = document.getElementById("cvSay");
  document.getElementById("cvSayBtn").onclick = () => {
    sayBox.hidden = !sayBox.hidden;
    if (!sayBox.hidden) document.getElementById("cvSayIn").focus();
  };
  document.getElementById("cvSayGo").onclick = async () => {
    const de = document.getElementById("cvSayIn").value.trim();
    if (!de) return;
    const b = document.getElementById("cvSayGo");
    b.disabled = true;
    b.textContent = "…";
    try {
      const t = await sayIn(de, level);
      if (t) {
        $in.value = t;
        say(t);
        sayBox.hidden = true;
        document.getElementById("cvSayIn").value = "";
      }
    } catch {
      st.err = "Übersetzen hat gerade nicht geklappt.";
      draw();
    }
    b.disabled = false;
    b.textContent = "Übersetzen";
  };
  document.getElementById("chatEnd").onclick = () => {
    if (!userMsgs().length) return (location.hash = "#/chat");
    st.done = true;
    summary();
  };
  draw();
  if (!st.msgs.length) turn();

  // ---------- Auswertung ----------
  function summary() {
    const mine = userMsgs();
    const n = mine.length;
    const ok = mine.filter((m) => !m.correction).length;
    const flow = n ? Math.round((ok / n) * 100) : 0;
    const used = usedLearn();
    const distinct = new Set(fold(mine.map((m) => m.text).join(" ")).match(/[\p{L}']+/gu) || []).size;
    const stars = (n >= GOAL_TURNS ? 1 : 0) + (st.bye ? 1 : 0) + (flow >= 60 ? 1 : 0);
    const points = n * 40 + ok * 30 + used.length * 25 + (st.bye ? 50 : 0);
    $app.innerHTML = `<header class="top"><a class="icon-btn plain" href="#/chat" aria-label="Zurück">${ICON.back}</a>
      <h1 class="h-sm">Auswertung</h1><span></span></header>
    <section class="card cv-sum">
      <div class="cv-stars" aria-label="${stars} von 3 Sternen">${[0, 1, 2].map((i) => `<span class="${i < stars ? "on" : ""}">★</span>`).join("")}</div>
      <p class="cv-points"><b>${points}</b> Punkte</p>
      <div class="cv-stats">
        <div><b>${flow} %</b><span>Redefluss<br><small>Antworten ohne Fehler</small></span></div>
        <div><b>${distinct}</b><span>Wörter<br><small>selbst benutzt</small></span></div>
        <div><b>${used.length}/${st.learn.length}</b><span>Lernwörter<br><small>angewendet</small></span></div>
      </div>
      <p class="small">${scene.ic} ${esc(scene.label)} · ${n} Antworten${st.bye ? " · verabschiedet ✓" : ""}</p>
      ${used.length ? `<p class="small">Angewendet: ${used.map((w) => `<span class="chip used">${esc(w.en)}</span>`).join(" ")}</p>` : ""}
    </section>
    ${
      st.newWords.length
        ? `<section class="card"><h2>Neue Wörter aus dem Gespräch</h2>
      <p class="small muted">Mit ＋ kommen sie in deine Vokabeln und werden als Nächstes gelernt.</p>
      <div class="cv-new">${st.newWords
        .map(
          (w, i) => `<div class="cv-nw"><span><b>${esc(w.en)}</b><small>${esc(w.de)}</small></span>
            <button class="icon-btn" data-add="${i}" ${st.added[i] ? "disabled" : ""} aria-label="Zu den Vokabeln">${st.added[i] ? "✓" : "＋"}</button></div>`
        )
        .join("")}</div></section>`
        : ""
    }
    <a class="ef-btn ef-pri" href="#/chat/${scene.key}" id="cvAgain">Nochmal sprechen</a>
    <a class="ef-btn ef-sec" href="#/chat">Andere Situation</a>`;
    $app.querySelectorAll("[data-add]").forEach(
      (b) =>
        (b.onclick = () => {
          const w = st.newWords[+b.dataset.add];
          S.addCustomCard({ en: w.en, de: w.de, level, topic: "alltag", front: true });
          st.added[+b.dataset.add] = true;
          b.textContent = "✓";
          b.disabled = true;
        })
    );
    document.getElementById("cvAgain").onclick = () => (STATE = null);
  }
}
