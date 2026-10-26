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
    <button class="ef-btn ef-pri" id="obTest">Kurzer Test (1 Minute)</button>
  </section>`;
  $app.querySelectorAll("[data-lv]").forEach((b) => (b.onclick = () => finish(b.dataset.lv, done)));
  document.getElementById("obTest").onclick = () => test($app, done);
}

// Test: je 2 Wörter aus A1, A2, B1, B2 – deutsche Bedeutung auswählen
function test($app, done) {
  const all = S.cards().filter((c) => c.de && !c.custom);
  const qs = [];
  for (const l of ["A1", "A2", "B1", "B2"]) {
    const pool = shuffle(all.filter((c) => c.level === l && !/\s/.test(c.en)));
    for (const c of pool.slice(0, 2)) {
      const wrong = shuffle(pool.filter((x) => first(x.de) !== first(c.de))).slice(0, 3).map((x) => first(x.de));
      qs.push({ l, en: c.en, ok: first(c.de), opts: shuffle([first(c.de), ...wrong]) });
    }
  }
  let i = 0;
  const right = { A1: 0, A2: 0, B1: 0, B2: 0 };
  const show = () => {
    if (i >= qs.length) {
      // höchstes Niveau, bei dem mindestens die Hälfte stimmt (von unten durchgehend)
      let level = "A1";
      for (const l of ["A1", "A2", "B1", "B2"]) {
        if (right[l] >= 1) level = l === "B2" && right.B2 === 2 ? "C1" : l;
        else break;
      }
      $app.innerHTML = `<section class="ob">
        <h1 class="ob-title">Dein Niveau: ${level}</h1>
        <p class="ob-lead">${NAMES[level]} – ${Object.values(right).reduce((a, b) => a + b, 0)} von 8 richtig. Du startest mit Wörtern ab ${level}. Ändern kannst du das jederzeit in den Einstellungen.</p>
        <button class="ef-btn ef-pri" id="obGo">Los geht's</button>
        <button class="ef-btn ef-sec" id="obOther">Lieber selbst wählen</button></section>`;
      document.getElementById("obGo").onclick = () => finish(level, done);
      document.getElementById("obOther").onclick = () => onboardingView($app, done);
      return;
    }
    const q = qs[i];
    $app.innerHTML = `<section class="ob">
      <p class="ob-step">Frage ${i + 1} von ${qs.length}</p>
      <div class="cv-bar"><i style="width:${(i / qs.length) * 100}%"></i></div>
      <h1 class="ob-word">${esc(q.en)}</h1>
      <p class="ob-lead">Was heißt das auf Deutsch?</p>
      <div class="ob-opts">${q.opts.map((o, k) => `<button class="ob-opt" data-k="${k}">${esc(o)}</button>`).join("")}
        <button class="ob-opt ob-skip" data-k="-1">Weiß ich nicht</button></div></section>`;
    $app.querySelectorAll("[data-k]").forEach(
      (b) =>
        (b.onclick = () => {
          const pick = q.opts[+b.dataset.k];
          const ok = pick === q.ok;
          if (ok) right[q.l]++;
          b.classList.add(ok ? "ok" : "bad");
          $app.querySelectorAll(".ob-opt").forEach((x) => {
            x.disabled = true;
            if (x.textContent === q.ok) x.classList.add("ok");
          });
          setTimeout(() => (i++, show()), 700);
        })
    );
  };
  show();
}
