// Einstieg nach der Anmeldung: Niveau selbst wählen oder mit einem kurzen Test (8 Wörter) ermitteln.
import * as S from "./store.js";
import { L } from "./langs.js";

const LV = ["A1", "A2", "B1", "B2", "C1"];
const NAMES = { A1: "Anfänger", A2: "Grundkenntnisse", B1: "Mittelstufe", B2: "Gute Kenntnisse", C1: "Sehr gut" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const first = (de) => String(de || "").split(/[,;]/)[0].trim();

// Braucht der Nutzer den Einstieg? (neu und noch nichts gelernt)
export function needsOnboarding() {
  const s = S.getState().settings;
  if (s.onboarded) return false;
  const started = S.cards().some((c) => c.state !== "new");
  if (started) {
    s.onboarded = true;
    S.save();
    return false;
  }
  return true;
}

function finish(level, done) {
  const s = S.getState().settings;
  s.startLevel = level;
  s.storyLevel = level;
  s.onboarded = true;
  S.save();
  done();
}

export function onboardingView($app, done) {
  $app.innerHTML = `
  <section class="ob">
    <h1 class="ob-title">Willkommen! 👋</h1>
    <p class="ob-lead">Wie gut kannst du schon ${esc(L().name)}? Dann startet die App genau auf deinem Niveau.</p>
    <h2 class="ob-h">Ich weiß es selbst</h2>
    <div class="ob-levels">${LV.map((l) => `<button class="ob-lv" data-lv="${l}"><b>${l}</b><span>${NAMES[l]}</span></button>`).join("")}</div>
    <h2 class="ob-h">Oder lieber testen</h2>
    <button class="ef-btn ef-pri" id="obTest">Kurzer Test mit 10 Sätzen (2 Minuten)</button>
  </section>`;
  $app.querySelectorAll("[data-lv]").forEach((b) => (b.onclick = () => finish(b.dataset.lv, done)));
  document.getElementById("obTest").onclick = () => test($app, done);
}

// Test: je 2 Sätze aus A1, A2, B1, B2, C1 – Satz lesen und die passende Übersetzung wählen
const plain = (t) => String(t || "").replace(/\*+/g, "");
function test($app, done) {
  const all = S.cards().filter((c) => c.ex && c.exDe && !c.custom && plain(c.ex).split(" ").length >= 5);
  const qs = [];
  for (const l of LV) {
    const pool = shuffle(all.filter((c) => c.level === l));
    for (const c of pool.slice(0, 2)) {
      const ok = plain(c.exDe);
      const wrong = pool.slice(2, 20).map((x) => plain(x.exDe)).filter((t) => t !== ok).slice(0, 2);
      qs.push({ l, en: plain(c.ex), ok, opts: shuffle([ok, ...wrong]) });
    }
  }
  let i = 0;
  const right = Object.fromEntries(LV.map((l) => [l, 0]));
  const show = () => {
    if (i >= qs.length) {
      // höchstes Niveau, bei dem mindestens 1 von 2 Sätzen stimmt (von unten durchgehend)
      let level = "A1";
      for (const l of LV) {
        if (right[l] >= 1) level = l;
        else break;
      }
      const total = Object.values(right).reduce((a, b) => a + b, 0);
      $app.innerHTML = `<section class="ob">
        <h1 class="ob-title">Empfehlung: ${level}</h1>
        <p class="ob-lead">${total} von ${qs.length} Sätzen richtig verstanden (${LV.map((l) => `${l}: ${right[l]}/2`).join(" · ")}).</p>
        <button class="ef-btn ef-pri" id="obGo">Mit ${level} starten</button>
        <h2 class="ob-h">Oder ein anderes Niveau wählen</h2>
        <div class="ob-levels">${LV.map((l) => `<button class="ob-lv${l === level ? " rec" : ""}" data-lv="${l}"><b>${l}</b><span>${NAMES[l]}</span></button>`).join("")}</div>
        <p class="ob-lead">Du kannst später jederzeit in den Einstellungen wechseln.</p></section>`;
      document.getElementById("obGo").onclick = () => finish(level, done);
      $app.querySelectorAll("[data-lv]").forEach((b) => (b.onclick = () => finish(b.dataset.lv, done)));
      return;
    }
    const q = qs[i];
    $app.innerHTML = `<section class="ob">
      <p class="ob-step">Satz ${i + 1} von ${qs.length} · Niveau ${q.l}</p>
      <div class="cv-bar"><i style="width:${(i / qs.length) * 100}%"></i></div>
      <h1 class="ob-sent">${esc(q.en)}</h1>
      <p class="ob-lead">Was bedeutet der Satz?</p>
      <div class="ob-opts">${q.opts.map((o, k) => `<button class="ob-opt" data-k="${k}">${esc(o)}</button>`).join("")}
        <button class="ob-opt ob-skip" data-k="-1">Verstehe ich nicht</button></div></section>`;
    $app.querySelectorAll("[data-k]").forEach(
      (b) =>
        (b.onclick = () => {
          const ok = q.opts[+b.dataset.k] === q.ok;
          if (ok) right[q.l]++;
          b.classList.add(ok ? "ok" : "bad");
          $app.querySelectorAll(".ob-opt").forEach((x) => {
            x.disabled = true;
            if (x.textContent === q.ok) x.classList.add("ok");
          });
          setTimeout(() => (i++, show()), 900);
        })
    );
  };
  show();
}
