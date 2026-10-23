// KI-Gespräch: Rollenspiel in der Lernsprache mit den eigenen Lernwörtern.
// Antworten der KI werden vorgelesen; Fehler werden freundlich auf Deutsch erklärt.

import * as S from "./store.js";
import * as tts from "./tts.js";
import { L } from "./langs.js";
import { chatTurn } from "./api.js";
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

export function chatView($app, { settings, ICON }, sceneKey = "") {
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
