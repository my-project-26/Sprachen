// Üben: Nachsprechen (Spracherkennung des Geräts) und Diktat (hören → schreiben)
// Beides mit Wörtern/Sätzen, die schon gelernt wurden.

import * as S from "./store.js";
import * as tts from "./tts.js";
import { L } from "./langs.js";

const plain = (t) => String(t || "").replace(/\*+/g, "");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Vergleich ohne Groß/klein, Akzente und Satzzeichen
const fold = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function similarity(a, b) {
  a = fold(a);
  b = fold(b);
  if (!a && !b) return 1;
  const m = a.length,
    n = b.length;
  const d = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - d[n] / Math.max(m, n, 1);
}

// Wortweiser Vergleich für die Anzeige: richtige Wörter grün, falsche rot
function diffHtml(target, typed) {
  const want = plain(target).split(/\s+/);
  const got = new Set(fold(typed).split(" "));
  return want.map((w) => `<span class="${got.has(fold(w)) ? "ok" : "bad"}">${esc(w)}</span>`).join(" ");
}

export const canSpeak = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// Spracherkennung: liefert den erkannten Text (oder "")
export function listenOnce() {
  return new Promise((res, rej) => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return rej(new Error("Spracherkennung wird von diesem Browser nicht unterstützt."));
    const r = new R();
    r.lang = (L().tts && L().tts[0]) || S.lang();
    r.interimResults = false;
    r.maxAlternatives = 3;
    let best = "";
    r.onresult = (e) => {
      const alts = [...e.results[0]].map((x) => x.transcript);
      best = alts[0] || "";
      r._alts = alts;
    };
    r.onerror = (e) => (e.error === "no-speech" ? res("") : rej(new Error(e.error === "not-allowed" ? "Bitte erlaube den Zugriff aufs Mikrofon." : e.error)));
    r.onend = () => res(best ? Object.assign(new String(best), { alts: r._alts || [best] }) : "");
    r.start();
  });
}

// Bewertung eines gesprochenen Versuchs
export function rateSpeech(target, heard) {
  const alts = heard?.alts || [String(heard || "")];
  const score = Math.max(...alts.map((h) => similarity(target, h)));
  if (score >= 0.85) return { score, cls: "ok", text: "Super, sehr gut ausgesprochen! 🎉" };
  if (score >= 0.6) return { score, cls: "almost", text: "Fast! Hör es dir noch einmal an und versuch es erneut." };
  return { score, cls: "bad", text: "Das habe ich nicht richtig verstanden. Hör genau hin und probier es nochmal." };
}

// Kleiner Mikrofon-Block für Lernkarten: „Nachsprechen“
export function micBlock(target) {
  if (!canSpeak()) return "";
  return `<div class="mic-block"><button type="button" class="mic-btn" data-mic="${esc(plain(target))}">🎤 <span>Nachsprechen</span></button><p class="mic-res small" aria-live="polite"></p></div>`;
}
export function bindMic(root) {
  root.querySelectorAll("[data-mic]").forEach(
    (b) =>
      (b.onclick = async () => {
        const out = b.parentElement.querySelector(".mic-res");
        b.classList.add("rec");
        b.querySelector("span").textContent = "Ich höre zu …";
        out.textContent = "";
        try {
          const heard = await listenOnce();
          const r = rateSpeech(b.dataset.mic, heard);
          out.className = `mic-res small ${r.cls}`;
          out.innerHTML = `${r.text}${heard ? `<br><span class="muted">Verstanden: „${esc(String(heard))}“</span>` : ""}`;
        } catch (e) {
          out.className = "mic-res small bad";
          out.textContent = e.message;
        }
        b.classList.remove("rec");
        b.querySelector("span").textContent = "Nachsprechen";
      })
  );
}

// ---------- Übungsseite: Diktat oder Sprechen ----------
export function practiceView($app, { settings, rateSlider, ICON }, mode = "") {
  const pool = S.cards().filter((c) => c.state !== "new" && c.ex);
  const header = `<header class="top"><a class="icon-btn plain" href="#/" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">${mode === "diktat" ? "Diktat" : mode === "sprechen" ? "Sprechen" : "Üben"}</h1><span></span></header>`;
  if (!pool.length) {
    $app.innerHTML = `${header}<section class="card"><h2>Noch nichts zum Üben</h2><p>Lerne zuerst ein paar Wörter. Danach kannst du hier hören, schreiben und sprechen üben.</p><a class="btn primary" href="#/learn">Jetzt lernen</a></section>`;
    return;
  }
  if (!mode) {
    $app.innerHTML = `${header}
    <div class="ef-tiles practice-tiles">
      <a class="ef-tile" href="#/practice/diktat"><span class="ef-tic">✍️</span><b>Diktat</b><small>Satz hören und aufschreiben</small></a>
      ${canSpeak() ? `<a class="ef-tile" href="#/practice/sprechen"><span class="ef-tic">🎤</span><b>Sprechen</b><small>Satz hören und nachsprechen</small></a>` : ""}
      <a class="ef-tile" href="#/listen"><span class="ef-tic">🎧</span><b>Hören</b><small>Wörter zum Anhören</small></a>
      <a class="ef-tile" href="#/chat"><span class="ef-tic">🗣️</span><b>Gespräch</b><small>Rollenspiel mit der KI</small></a>
    </div>
    ${canSpeak() ? "" : `<p class="small muted">Sprechen üben geht in diesem Browser leider nicht. Am iPhone und in Chrome funktioniert es.</p>`}`;
    return;
  }
  const list = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
  let i = 0,
    good = 0;
  const say = (t) => tts.speak(t, { rate: settings().voiceRate, preset: settings().voicePreset });

  const show = () => {
    if (i >= list.length) {
      $app.innerHTML = `${header}<section class="card center-card"><h2>Geschafft! 🎉</h2><p>${good} von ${list.length} richtig.</p>
        <a class="btn primary" href="#/practice/${mode}">Noch eine Runde</a> <a class="btn ghost" href="#/practice">Andere Übung</a></section>`;
      return;
    }
    const c = list[i];
    const sent = plain(c.ex);
    $app.innerHTML = `${header}
    <p class="ef-step"><span>${mode === "diktat" ? "Hör zu und schreib den Satz auf" : "Hör zu und sprich den Satz nach"}</span><span>${i + 1} von ${list.length}</span></p>
    <section class="card practice-card">
      <button class="listen-play" id="pSay">${ICON.speaker}<span>Satz anhören</span></button>
      ${rateSlider("", sent)}
      ${
        mode === "diktat"
          ? `<textarea id="pIn" rows="3" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Schreib hier, was du hörst …"></textarea>
             <button class="ef-btn ef-pri" id="pCheck">Prüfen</button>`
          : `<button class="mic-btn big" id="pMic">🎤 <span>Jetzt sprechen</span></button>`
      }
      <div id="pRes" aria-live="polite"></div>
      <button class="ef-btn ef-sec" id="pNext" hidden>Weiter</button>
      <p class="small muted">Tipp: Bei „Langsam“ verstehst du jedes Wort.</p>
    </section>`;
    const res = document.getElementById("pRes");
    const next = document.getElementById("pNext");
    const reveal = (ok, extra) => {
      if (ok) good++;
      res.innerHTML = `${extra}<p class="p-sol"><b>${esc(sent)}</b><br><span class="muted">${esc(plain(c.exDe))}</span></p>`;
      next.hidden = false;
      next.focus();
    };
    document.getElementById("pSay").onclick = () => say(sent);
    next.onclick = () => {
      i++;
      show();
    };
    setTimeout(() => say(sent), 300);
    if (mode === "diktat") {
      const inp = document.getElementById("pIn");
      document.getElementById("pCheck").onclick = () => {
        const sc = similarity(sent, inp.value);
        const ok = sc >= 0.9;
        reveal(ok, `<p class="p-verdict ${ok ? "ok" : sc >= 0.6 ? "almost" : "bad"}">${ok ? "Richtig! 🎉" : sc >= 0.6 ? "Fast – schau dir die roten Wörter an." : "Noch nicht ganz. So heißt der Satz:"}</p><p class="p-diff">${diffHtml(sent, inp.value)}</p>`);
        document.getElementById("pCheck").hidden = true;
      };
    } else {
      const mic = document.getElementById("pMic");
      mic.onclick = async () => {
        mic.classList.add("rec");
        mic.querySelector("span").textContent = "Ich höre zu …";
        try {
          const heard = await listenOnce();
          const r = rateSpeech(sent, heard);
          reveal(r.cls === "ok", `<p class="p-verdict ${r.cls}">${r.text}</p>${heard ? `<p class="small muted">Verstanden: „${esc(String(heard))}“</p>` : ""}`);
        } catch (e) {
          res.innerHTML = `<p class="p-verdict bad">${esc(e.message)}</p>`;
        }
        mic.classList.remove("rec");
        mic.querySelector("span").textContent = "Nochmal sprechen";
      };
    }
  };
  show();
}
