// Hörmodus: gelernte Wörter (und Beispielsätze) als Hörliste – Fremdsprache, Pause, Deutsch.
// Idee: „passives Hören“ nach Birkenbihl bzw. reine Audio-Lektionen wie bei Pimsleur.
// Fremdsprache = natürliche Aufnahme (falls vorhanden), Deutsch = Gerätestimme.

import * as S from "./store.js";
import * as tts from "./tts.js";
import { L } from "./langs.js";

const plain = (t) => String(t || "").replace(/\*+/g, "");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sleep = (ms, run) =>
  new Promise((res) => {
    const t = setTimeout(res, ms);
    run.cancel.push(() => {
      clearTimeout(t);
      res();
    });
  });

// Deutsch über die Gerätestimme
function speakGerman(text, rate, run) {
  return new Promise((res) => {
    let fin0 = false;
    const ok = () => (fin0 ? 0 : ((fin0 = true), res()));
    run.cancel.push(() => {
      tts.stop();
      ok();
    });
    setTimeout(ok, 15000);
    tts.speakGermanNatural(text.replace(/;/g, ","), { onend: ok, onfail: () => speakGermanDevice(text, rate, run).then(ok) });
  });
}

function speakGermanDevice(text, rate, run) {
  return new Promise((res) => {
    const synth = window.speechSynthesis;
    if (!synth || !text) return setTimeout(res, 600);
    const u = new SpeechSynthesisUtterance(text.replace(/;/g, ","));
    u.lang = "de-DE";
    const v = synth.getVoices().filter((x) => /^de/i.test(x.lang));
    const best = v.find((x) => /Premium|Enhanced|Erweitert|Natural|Online|Google/i.test(x.name)) || v[0];
    if (best) u.voice = best;
    u.rate = Math.min(1.6, Math.max(0.6, rate * 1.02));
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        res();
      }
    };
    u.onend = fin;
    u.onerror = fin;
    run.cancel.push(() => {
      synth.cancel();
      fin();
    });
    setTimeout(fin, 12000); // Sicherheitsnetz
    synth.speak(u);
  });
}

// Fremdsprache: natürliche Aufnahme bzw. Gerätestimme (tts.speak)
function speakForeign(text, rate, preset, run) {
  return new Promise((res) => {
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        res();
      }
    };
    run.cancel.push(() => {
      tts.stop();
      fin();
    });
    setTimeout(fin, 15000);
    tts.speak(text, { rate, preset, onend: fin });
  });
}

// Auswahl der Karten
function pickCards(mode, count) {
  const all = S.cards().filter((c) => c.state !== "new" && c.state !== "known");
  let list;
  if (mode === "weak") list = all.filter((c) => c.weak || (c.lapses || 0) > 0);
  else if (mode === "recent") list = [...all].sort((a, b) => (b.introducedAt || b.last || 0) - (a.introducedAt || a.last || 0));
  else list = [...all].sort(() => Math.random() - 0.5);
  if (mode === "weak" && !list.length) list = [...all].sort(() => Math.random() - 0.5);
  return list.slice(0, count);
}

let RUN = null; // laufende Wiedergabe
export function stopListening() {
  if (RUN) {
    RUN.stopped = true;
    RUN.cancel.forEach((f) => f());
    RUN.cancel = [];
    RUN = null;
  }
  try {
    if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
  } catch {}
}

export function listenView($app, { settings, rateSlider, ICON }) {
  const s = settings();
  const prefs = { mode: "recent", count: 20, sentences: true, german: true, ...(s.listen || {}) };
  const savePrefs = () => {
    S.getState().settings.listen = prefs;
    S.save();
  };
  const total = S.cards().filter((c) => c.state !== "new" && c.state !== "known").length;

  const pill = (key, val, label) =>
    `<button type="button" class="${prefs[key] === val ? "on" : ""}" data-k="${key}" data-v="${val}" aria-pressed="${prefs[key] === val}">${label}</button>`;

  $app.innerHTML = `
  <header class="top"><a class="icon-btn plain" href="#/" aria-label="Zurück">${ICON.back}</a>
    <h1 class="h-sm">Hören</h1><span></span></header>
  ${
    total
      ? `<section class="card listen-card">
    <p class="listen-how">Kopfhörer rein und zuhören: Erst kommt das Wort auf ${esc(L().name)}, dann auf Deutsch${prefs.sentences ? ", danach der Beispielsatz" : ""}. Ideal für unterwegs.</p>
    <div class="listen-now" aria-live="polite">
      <div class="ln-en" id="lnEn">${esc(L().flag)}</div>
      <div class="ln-de" id="lnDe">Bereit</div>
      <div class="ln-ex" id="lnEx"></div>
      <div class="small muted" id="lnPos">${Math.min(prefs.count, total)} Wörter</div>
    </div>
    <div class="listen-ctrl">
      <button class="icon-btn big" id="lnPrev" aria-label="Zurück">⏮</button>
      <button class="listen-play" id="lnPlay" aria-label="Abspielen">${ICON.play}<span>Abspielen</span></button>
      <button class="icon-btn big" id="lnNext" aria-label="Weiter">⏭</button>
    </div>
    <p class="ef-label">Wie schnell?</p>
    ${rateSlider("", "")}
  </section>
  <section class="card listen-opts">
    <h2>Was möchtest du hören?</h2>
    <p class="small muted">Welche Wörter</p>
    <div class="speed seg">${pill("mode", "recent", "Neueste")}${pill("mode", "weak", "Schwierige")}${pill("mode", "mix", "Gemischt")}</div>
    <p class="small muted">Wie viele</p>
    <div class="speed seg">${pill("count", 10, "10")}${pill("count", 20, "20")}${pill("count", 50, "50")}${pill("count", 9999, "Alle")}</div>
    <label class="check"><input type="checkbox" id="lnSent" ${prefs.sentences ? "checked" : ""}> Beispielsätze mit anhören</label>
    <label class="check"><input type="checkbox" id="lnGer" ${prefs.german ? "checked" : ""}> Deutsche Übersetzung ansagen</label>
    <p class="small muted">Tipp: Am iPhone läuft es am zuverlässigsten mit eingeschaltetem Bildschirm. Die App hält ihn dafür wach.</p>
  </section>`
      : `<section class="card"><h2>Noch nichts zum Hören</h2>
    <p>Lerne zuerst ein paar Wörter. Danach kannst du sie hier jederzeit anhören.</p>
    <a class="btn primary" href="#/learn">Jetzt lernen</a></section>`
  }`;
  if (!total) return;

  $app.querySelectorAll("[data-k]").forEach(
    (b) =>
      (b.onclick = () => {
        const v = b.dataset.v;
        prefs[b.dataset.k] = isNaN(+v) ? v : +v;
        savePrefs();
        stopListening();
        listenView($app, { settings, rateSlider, ICON });
      })
  );
  document.getElementById("lnSent").onchange = (e) => ((prefs.sentences = e.target.checked), savePrefs());
  document.getElementById("lnGer").onchange = (e) => ((prefs.german = e.target.checked), savePrefs());

  const $en = document.getElementById("lnEn");
  const $de = document.getElementById("lnDe");
  const $ex = document.getElementById("lnEx");
  const $pos = document.getElementById("lnPos");
  const $play = document.getElementById("lnPlay");
  const list = pickCards(prefs.mode, prefs.count);
  let idx = 0;
  let wake = null;

  const setBtn = (playing) => {
    $play.innerHTML = playing ? `${ICON.stop}<span>Pause</span>` : `${ICON.play}<span>Abspielen</span>`;
    $play.setAttribute("aria-label", playing ? "Pause" : "Abspielen");
  };
  const show = (c) => {
    $en.textContent = c.en;
    $de.textContent = c.de;
    $ex.innerHTML = prefs.sentences && c.ex ? `${esc(plain(c.ex))}<br><span class="muted">${esc(plain(c.exDe))}</span>` : "";
    $pos.textContent = `${idx + 1} / ${list.length}`;
    try {
      if (navigator.mediaSession && window.MediaMetadata)
        navigator.mediaSession.metadata = new MediaMetadata({ title: c.en, artist: c.de, album: `Wortwerk · ${L().name}` });
    } catch {}
  };

  async function play() {
    stopListening();
    const run = { cancel: [], stopped: false };
    RUN = run;
    setBtn(true);
    try {
      wake = await navigator.wakeLock?.request("screen");
    } catch {}
    try {
      if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
    } catch {}
    while (!run.stopped && idx < list.length) {
      const c = list[idx];
      show(c);
      const rate = settings().voiceRate;
      const preset = settings().voicePreset;
      tts.setNatural(settings().voiceNatural);
      await speakForeign(c.en, rate, preset, run);
      if (run.stopped) break;
      await sleep(900 / rate, run);
      if (prefs.german && !run.stopped) {
        await speakGerman(c.de, rate, run);
        await sleep(700, run);
      }
      if (prefs.sentences && c.ex && !run.stopped) {
        await speakForeign(plain(c.ex), rate, preset, run);
        await sleep(800, run);
        if (prefs.german && c.exDe && !run.stopped) {
          await speakGerman(plain(c.exDe), rate, run);
          await sleep(600, run);
        }
      }
      if (run.stopped) break;
      await sleep(1200, run);
      if (!run.stopped) idx++;
    }
    if (!run.stopped) {
      $pos.textContent = "Fertig – gut gemacht! 🎉";
      idx = 0;
      RUN = null;
    }
    setBtn(false);
    try {
      await wake?.release();
    } catch {}
  }

  $play.onclick = () => (RUN ? (stopListening(), setBtn(false)) : play());
  const jump = (d) => {
    const was = !!RUN;
    stopListening();
    idx = Math.max(0, Math.min(list.length - 1, idx + d));
    show(list[idx]);
    if (was) play();
    else setBtn(false);
  };
  document.getElementById("lnPrev").onclick = () => jump(-1);
  document.getElementById("lnNext").onclick = () => jump(1);
  try {
    if (navigator.mediaSession) {
      navigator.mediaSession.setActionHandler("play", () => !RUN && play());
      navigator.mediaSession.setActionHandler("pause", () => (stopListening(), setBtn(false)));
      navigator.mediaSession.setActionHandler("previoustrack", () => jump(-1));
      navigator.mediaSession.setActionHandler("nexttrack", () => jump(1));
    }
  } catch {}
  if (list[0]) show(list[0]);
  $pos.textContent = `${list.length} Wörter`;
}
