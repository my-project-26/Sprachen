// Designs: Jedes Design hat eigene Layouts für die Startseite und die Lernkarte.
// Alle anderen Seiten passen sich über CSS (skins.css) an.
// Wichtig: Die Bausteine behalten ihre IDs/Attribute (reveal, hintBtn, data-g …),
// damit die Logik in app.js für jedes Design gleich funktioniert.

export const DESIGNS = [
  { key: "einfach", name: "Einfach", desc: "Große Knöpfe, klare Schritte – für alle Altersstufen", colors: ["#FFFFFF", "#1F5BD8", "#1E9E50"], theme: "#FFFFFF",
    fonts: "Atkinson+Hyperlegible:wght@400;700" },
  { key: "glas", name: "iOS-Glas", desc: "wie Apple Karten, Glas und Listen", colors: ["#F2F2F7", "#2F7CF6", "#34C759"], theme: "#F2F2F7" },
  { key: "bordkarte", name: "Bordkarte", desc: "Lernen als Reise, jede Vokabel ein Ticket", colors: ["#0E2240", "#FFC72C", "#E6E9EE"], theme: "#0E2240",
    fonts: "Barlow+Condensed:wght@500;600;700" },
  { key: "heft", name: "Vokabelheft", desc: "Linien, Handschrift, Textmarker", colors: ["#FDFDFB", "#23408E", "#FFF27A"], theme: "#FDFDFB",
    fonts: "Caveat:wght@500;700&family=Lora:ital,wght@0,400;0,600;1,400" },
];

export const designKey = (k) => (DESIGNS.some((d) => d.key === k) ? k : "einfach");

// Design setzen: data-style, Schriften nachladen, Statusleisten-Farbe
export function applyDesign(key) {
  const d = DESIGNS.find((x) => x.key === designKey(key));
  document.documentElement.dataset.style = d.key;
  let link = document.getElementById("skinFonts");
  if (d.fonts) {
    const href = `https://fonts.googleapis.com/css2?family=${d.fonts}&display=swap`;
    if (!link) {
      link = document.createElement("link");
      link.id = "skinFonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  } else if (link) link.remove();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (d.key === "glas") m.setAttribute("content", m.media.includes("dark") ? "#000000" : "#F2F2F7");
    else m.setAttribute("content", d.theme);
  });
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hash = (s) => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const n = (x, one, many) => `${x} ${x === 1 ? one : many}`;
// „3 T“ → „3 Tagen“ usw. (ausgeschrieben für das Design „Einfach“)
const longIv = (iv) =>
  String(iv).replace(/^([\d.,]+) (Min|Std|T|Mon|J)$/, (_, v, u) => {
    const one = v === "1";
    const w = { Min: one ? "Minute" : "Minuten", Std: one ? "Stunde" : "Stunden", T: one ? "Tag" : "Tagen", Mon: one ? "Monat" : "Monaten", J: one ? "Jahr" : "Jahren" }[u];
    return `${v.replace(".", ",")} ${w}`;
  });

// ================= STARTSEITE =================
// d: Daten aus home() in app.js
export function skinHome(key, d) {
  const f = HOME[key];
  return f ? f(d) : null;
}

// Gemeinsame Startknöpfe: Lernen / „10 weitere“ – behalten id="extraBtn"
function cta(d, label, cls = "") {
  if (d.total) return `<a class="sk-cta ${cls}" href="#/learn">${label}</a>`;
  return `<div class="sk-done">${d.wordsLeft ? "Für heute ist alles erledigt." : "In diesem Bereich gibt es keine neuen Wörter mehr."}</div>
    <button class="sk-cta ${cls} alt" id="extraBtn">${d.wordsLeft ? "10 weitere neue Wörter" : "Anderes Thema wählen"}</button>`;
}

const HOME = {
  // ---------- 0 Einfach ----------
  einfach(d) {
    const tile = (href, ic, label, sub, attrs = "") =>
      `<${href ? `a href="${href}"` : "button"} class="ef-tile" ${attrs}><span class="ef-tic">${ic}</span><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</${href ? "a" : "button"}>`;
    return `
    <section class="ef-top">
      <p>Hallo${d.userName ? " " + esc(d.userName) : ""}! 👋</p>
      <a class="ef-set" href="#/settings" aria-label="Einstellungen"><span class="sk-flag">${d.lang.flag}</span>${d.icon.gear}</a>
    </section>
    <h1 class="ef-h1">Du lernst ${esc(d.lang.name)}</h1>
    ${
      d.total
        ? `<a class="ef-go" href="#/learn"><span class="ef-play">▶</span><span><b>Jetzt lernen</b><small>${n(d.total, "Wort wartet", "Wörter warten")} auf dich</small></span></a>
           <div class="ef-how"><b>So geht’s:</b>
             <ol><li>Du siehst ein deutsches Wort.</li><li>Überlege: Wie heißt es auf ${esc(d.lang.name)}?</li><li>Tippe auf <b>Lösung zeigen</b> und sag, ob du es wusstest.</li></ol></div>`
        : `<div class="ef-done"><span>🎉</span><b>Für heute ist alles geschafft!</b></div>
           <button class="ef-go alt" id="extraBtn"><span class="ef-play">＋</span><span><b>${d.wordsLeft ? "Noch 10 neue Wörter" : "Anderes Thema wählen"}</b><small>wenn du noch Lust hast</small></span></button>`
    }
    ${d.streak ? `<p class="ef-streak">🔥 Du lernst seit <b>${n(d.streak, "Tag", "Tagen")}</b> am Stück. Weiter so!</p>` : ""}
    <h2 class="ef-h2">Was möchtest du machen?</h2>
    <div class="ef-tiles">
      ${d.weak ? tile("#/learn/weak", "🔁", "Fehler üben", n(d.weak, "Wort", "Wörter")) : ""}
      ${tile(d.ready ? "#/story/new" : "#/stories", "📖", "Geschichte lesen", d.ready ? "eine neue ist bereit" : `${d.storyN} von ${d.storyEvery} Wörtern`)}
      ${tile("#/listen", "🎧", "Hören", "Wörter anhören, z. B. unterwegs")}
      ${tile("#/practice", "✍️", "Üben", "Diktat, Sprechen, Gespräch")}
      ${tile("#/words", "🔎", "Wort suchen", "")}
      ${tile("", "🗂️", "Thema wählen", esc(d.focusLabel), 'id="pickTopic"')}
    </div>`;
  },

  // ---------- 1 Bordkarte ----------
  bordkarte(d) {
    const stops = d.lvl;
    const pos = d.levelPos; // 0 … stops.length-1 (mit Nachkommastelle)
    const pct = stops.length > 1 ? (pos / (stops.length - 1)) * 100 : 0;
    const row = (dest, num, st, cls = "", href = "") =>
      `<${href ? `a href="${href}"` : "div"} class="bk-row"><span>${esc(dest)}</span><span>${num}</span><span class="bk-st ${cls}">${st}</span></${href ? "a" : "div"}>`;
    return `
    <section class="bk-top">
      <div class="bk-bar"><p>${esc(d.dateStr)}</p><a class="icon-btn plain" href="#/settings" aria-label="Einstellungen"><span class="sk-flag">${d.lang.flag}</span>${d.icon.gear}</a></div>
      <h1>Guten Flug!</h1>
      <div class="bk-route" aria-label="Flugroute ${stops[0].L} bis C1">
        <div class="bk-line"></div><div class="bk-done" style="width:${pct}%"></div>
        ${stops.map((s, i) => `<div class="bk-stop ${i <= pos ? "on" : ""}" style="left:${(i / (stops.length - 1)) * 100}%"><i></i><b>${s.L}</b></div>`).join("")}
        <div class="bk-plane" style="left:${pct}%">✈</div>
      </div>
    </section>
    <section class="bk-board">
      <div class="bk-hd"><span>Ziel</span><span>Wörter</span><span>Status</span></div>
      ${row(d.news ? "Neu: " + d.nextTopicLabel : "Neue Wörter", d.news, d.news ? "Boarding" : "—", "")}
      ${row("Wiederholung", d.due, d.due ? "Pünktlich" : "—", "")}
      ${d.weak ? row("Noch lernen", d.weak, "Verspätet", "late", "#/learn/weak") : ""}
      ${row("Geschichte", `${d.storyN}/${d.storyEvery}`, d.ready ? "Gate offen" : "Wartet", d.ready ? "" : "dim", d.ready ? "#/story/new" : "#/stories")}
    </section>
    <div class="bk-actions">${cta(d, `<span>Jetzt einsteigen</span><span>${d.total} ✈</span>`, "bk-go")}
      <button class="link-btn small bk-topic" id="pickTopic">Ziel ändern: ${esc(d.focusLabel)}</button></div>
    <section class="bk-stamps">
      <div><b>${d.streak}</b>Tage in Folge</div><div><b>${d.secure}</b>Wörter sicher</div><a href="#/stories"><b>${d.stories}</b>Geschichten</a>
    </section>`;
  },

  // ---------- 4 Vokabelheft ----------
  heft(d) {
    const bar = (x) => {
      const k = x.total ? Math.round((x.ok / x.total) * 10) : 0;
      return `<div class="hf-lvl"><span>${x.L}</span><span class="hf-bar">${"▓".repeat(k)}${"░".repeat(10 - k)}</span><small>${x.ok}/${x.total}</small></div>`;
    };
    return `
    <div class="hf-tabs">${d.topics.slice(0, 4).map((t) => `<a href="#/topics">${esc(t.label.split(/[ ,&]/)[0].slice(0, 10))}</a>`).join("")}</div>
    <header class="hf-head"><h1>${esc(d.weekday)}</h1><a class="icon-btn plain" href="#/settings" aria-label="Einstellungen"><span class="sk-flag">${d.lang.flag}</span>${d.icon.gear}</a></header>
    <p class="hf-hand">Heute zu tun:</p>
    <ul class="hf-todo">
      <li class="${d.due ? "" : "x"}">${n(d.due, "Wiederholung", "Wiederholungen")}</li>
      <li class="${d.news ? "" : "x"}"><mark>${n(d.news, "neues Wort", "neue Wörter")}</mark> – <button class="hf-link" id="pickTopic">${esc(d.focusLabel)}</button></li>
      ${d.weak ? `<li><a href="#/learn/weak"><mark class="pink">${d.weak}× noch lernen</mark></a></li>` : ""}
      <li class="${d.ready ? "" : ""}"><a href="${d.ready ? "#/story/new" : "#/stories"}">Geschichte ${d.ready ? "schreiben ✎" : `(${d.storyN}/${d.storyEvery})`}</a></li>
    </ul>
    <p class="hf-hand">Weg zu C1:</p>
    ${d.lvl.map(bar).join("")}
    <div class="hf-bottom"><div class="hf-postit"><span>schon sicher</span><b>${d.secure}</b><span>Wörter ✓</span></div>
      <div class="hf-cta">${cta(d, "Heft aufschlagen ✎", "hf-btn")}</div></div>`;
  },

  // ---------- 5 iOS-Glas ----------
  glas(d) {
    const stops = d.lvl;
    const pos = d.levelPos;
    const pins = stops
      .map((s, i) => {
        const x = 14 + (i / (stops.length - 1)) * 72;
        const y = 78 - Math.sin((i / (stops.length - 1)) * Math.PI) * 46 - i * 6;
        return `<span class="gl-pin ${i <= pos ? "on" : ""}" style="left:${x}%;top:${y}%">${s.L}</span>`;
      })
      .join("");
    const colors = ["#5fd0f3,#2a9fd6", "#ffb36b,#ff8a00", "#7be08f,#34C759", "#c79bff,#8e5cf7"];
    return `
    <section class="gl-map">
      <svg class="gl-path" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M14 78 C 30 20, 70 20, 86 48"/></svg>
      ${pins}
      <span class="gl-pill">☀︎ ${n(d.streak, "Tag", "Tage")} Serie</span>
      <a class="gl-gear" href="#/settings" aria-label="Einstellungen"><span class="sk-flag">${d.lang.flag}</span>${d.icon.gear}</a>
    </section>
    <section class="gl-sheet">
      <div class="gl-grab"></div>
      <a class="gl-search" href="#/words">${d.icon.search}<span>Wort suchen</span></a>
      <h3 class="gl-h"><a href="#/topics">Themen</a></h3>
      <div class="gl-orte">
        ${d.topics.slice(0, 3).map((t, i) => `<button class="gl-ort" data-focus="${esc(t.key)}"><span class="gl-c" style="background:linear-gradient(${colors[i % 4]})">${esc(t.label[0])}</span><b>${esc(t.label.split(/[ ,&]/)[0])}</b><small>${t.key === d.focus ? "aktiv" : t.newLeft + " neu"}</small></button>`).join("")}
        <button class="gl-ort" id="pickTopic"><span class="gl-c add">＋</span><b>Mehr</b><small>&nbsp;</small></button>
      </div>
      <h3 class="gl-h">Heute</h3>
      ${
        d.total
          ? `<a class="gl-row" href="#/learn"><span class="gl-ic" style="background:#2F7CF6">↻</span><span><b>${n(d.total, "Wort", "Wörter")} lernen</b><small>${d.due} Wiederholungen · ${d.news} neu</small></span></a>`
          : `<button class="gl-row" id="extraBtn"><span class="gl-ic" style="background:#34C759">✓</span><span><b>${d.wordsLeft ? "Alles erledigt – 10 weitere?" : "Anderes Thema wählen"}</b><small>neue Wörter aus ${esc(d.focusLabel)}</small></span></button>`
      }
      ${d.weak ? `<a class="gl-row" href="#/learn/weak"><span class="gl-ic" style="background:#FF3B30">!</span><span><b>Noch lernen</b><small>${n(d.weak, "Wort", "Wörter")}</small></span></a>` : ""}
      <a class="gl-row" href="#/practice"><span class="gl-ic" style="background:#FF2D55">✍️</span><span><b>Üben</b><small>Diktat, Sprechen, Gespräch</small></span></a>
      <a class="gl-row" href="#/listen"><span class="gl-ic" style="background:#5856D6">🎧</span><span><b>Hören</b><small>deine Wörter zum Anhören</small></span></a>
      <a class="gl-row" href="${d.ready ? "#/story/new" : "#/stories"}"><span class="gl-ic" style="background:#FF9500">❝</span><span><b>${d.ready ? "Geschichte erstellen" : "Nächste Geschichte"}</b><small>${d.storyN} von ${d.storyEvery} Übungswörtern</small></span></a>
    </section>`;
  },

};

// ================= LERNKARTE =================
// x: Daten aus showCard() in app.js (inkl. fertiger Bausteine x.ui.*)
export function skinCard(key, x) {
  const f = CARD[key];
  return f ? f(x) : null;
}

const gradeBtns = (x, labels, cls = "") => `
  <button class="grade g1 ${cls}" data-g="1"><span>${labels[0]}</span><small>gleich nochmal</small></button>
  <button class="grade g2 ${cls}" data-g="2"><span>${labels[1]}</span><small>${x.practice ? "Übung" : "in " + x.iv2}</small></button>
  <button class="grade g3 ${cls}" data-g="3"><span>${labels[2]}</span><small>${x.practice ? "Übung" : "in " + x.iv3}</small></button>`;
const L3 = ["Muss ich noch lernen", "Unsicher", "Wusste ich"];

const CARD = {
  // ---------- 0 Einfach ----------
  einfach(x) {
    const c = x.c;
    const step = x.revealed ? 2 : 1;
    const card = `
      <p class="ef-step"><span>Schritt ${step} von 2</span><span>Wort ${x.pos} von ${x.total}</span></p>
      <section class="ef-card">
        <p class="ef-q">${x.revealed ? "Die Lösung:" : `Wie heißt das auf ${esc(x.langName)}?`}</p>
        <div class="ef-de">${esc(c.de)}</div>
        ${x.revealed ? `<div class="ef-en">${x.enHtml}</div>${x.ui.typed}` : ""}
        ${c.ex ? `<div class="ef-ex"><p class="ex">${x.revealed ? x.exMarked : x.cloze}</p>${c.exDe ? `<p class="ex-de">${x.exDeMarked}</p>` : ""}</div>` : ""}
        ${x.revealed ? x.ui.note : x.ui.hint + x.ui.input}
      </section>`;
    const actions = x.revealed
      ? `<div class="ef-listen">
           <button class="ef-btn ef-sec" data-say="${esc(c.en)}">🔊 Wort anhören</button>
           ${c.ex ? `<button class="ef-btn ef-sec" data-say="${esc(x.exPlain)}">🔊 Satz anhören</button>` : ""}
         </div>
         <p class="ef-label">Wie schnell soll gesprochen werden?</p>
         ${x.ui.speed}
         ${x.ui.mic}
         <p class="ef-ask">Wusstest du es?</p>
         <div class="ef-grades">
           <button class="grade g3 ef-btn ef-yes" data-g="3"><span>👍 Ja, gewusst!</span><small>${x.practice ? "Übung" : "kommt wieder in " + longIv(x.iv3)}</small></button>
           <button class="grade g2 ef-btn ef-mid" data-g="2"><span>🤔 Ein bisschen</span><small>${x.practice ? "Übung" : "kommt wieder in " + longIv(x.iv2)}</small></button>
           <button class="grade g1 ef-btn ef-no" data-g="1"><span>👎 Nein, nochmal üben</span><small>kommt gleich nochmal</small></button>
         </div>${x.ui.known}`
      : `<button class="ef-btn ef-pri" id="reveal">👀 Lösung zeigen</button>
         <button class="ef-btn ef-sec" id="hintBtn">💡 Tipp: erster Buchstabe</button>`;
    return `${x.ui.header}${card}<div class="flash-actions ef-actions">${actions}</div>`;
  },

  // ---------- 1 Bordkarte ----------
  bordkarte(x) {
    const c = x.c;
    const status = x.c.weak ? "Noch lernen" : x.isNew ? "Neu" : "Wiederholung";
    const card = `
      <article class="bk-pass">
        <div class="bk-ph"><span>${esc(x.topic)}</span><span>${c.level}</span></div>
        <div class="bk-route2">
          <div class="bk-city"><small>Von</small>${esc(c.de.split(",")[0])}</div><div class="bk-arrow">✈</div>
          <div class="bk-city to"><small>Nach</small>${x.revealed ? x.enHtml : "· · ·"}</div>
        </div>
        <div class="bk-meta"><div>Wortart<b>${esc(x.posLabel || "–")}</b></div><div>Gate<b>${status}</b></div><div>Ticket<b>${x.pos}/${x.total}</b></div></div>
        <div class="bk-perf"></div>
        <div class="bk-sent">
          ${x.revealed ? x.ui.typed + `<p class="ex">${x.exMarked}</p>` : `<p class="ex">${x.cloze}</p>`}
          ${c.exDe ? `<p class="ex-de">${x.exDeMarked}</p>` : ""}
          ${x.revealed ? x.ui.listen + x.ui.note : x.ui.hint + x.ui.input}
        </div>
        <div class="bk-bc" aria-hidden="true"></div>
      </article>`;
    const actions = x.revealed
      ? `<div class="bk-stamps-g">${gradeBtns(x, L3, "bk-stamp")}</div>${x.ui.known}`
      : `<div class="actions-row"><button class="btn ghost" id="hintBtn">Hinweis</button><button class="btn primary" id="reveal">Ticket entwerten</button></div>`;
    return `${x.ui.header}${card}<div class="flash-actions">${actions}</div>`;
  },

  // ---------- 4 Vokabelheft ----------
  heft(x) {
    const c = x.c;
    const rows = [];
    for (const p of x.prev) rows.push(`<tr class="done"><td class="hf-de">${esc(p.de.split(",")[0])}</td><td class="hf-en">${esc(p.en)}</td></tr>`);
    rows.push(`<tr class="cur"><td class="hf-de">${esc(c.de)}</td><td class="hf-en">${x.revealed ? `<mark>${x.enHtml}</mark>` : ""}</td></tr>`);
    for (const p of x.next) rows.push(`<tr class="next"><td class="hf-de">${esc(p.de.split(",")[0])}</td><td class="hf-en"></td></tr>`);
    const card = `
      <article class="hf-page">
        <p class="hf-hand">${esc(x.topic)} · Seite ${x.pos}</p>
        <div class="hf-tw"><table class="hf-table"><tbody>${rows.join("")}</tbody></table>
        ${x.revealed ? "" : `<div class="hf-flap" aria-hidden="true"><span>Klappe</span></div>`}</div>
        <div class="hf-sent">
          ${x.revealed ? x.ui.typed + `<p class="ex">${x.exMarked}</p>` : `<p class="ex">${x.cloze}</p>`}
          ${c.exDe ? `<p class="ex-de">${x.exDeMarked}</p>` : ""}
          ${x.revealed ? x.ui.listen + x.ui.note : x.ui.hint + x.ui.input}
        </div>
      </article>`;
    const actions = x.revealed
      ? `<div class="hf-marks">${gradeBtns(x, ["✗ noch lernen", "~ unsicher", "✓ wusste ich"], "hf-mark")}</div>${x.ui.known}`
      : `<div class="actions-row"><button class="btn ghost" id="hintBtn">Hinweis</button><button class="btn primary" id="reveal">Klappe aufklappen</button></div>`;
    return `${x.ui.header}${card}<div class="flash-actions">${actions}</div>`;
  },

  // ---------- 5 iOS-Glas ----------
  glas(x) {
    const c = x.c;
    const li = (bg, ic, title, sub, attrs = "") =>
      `<${attrs ? "button" : "div"} class="gl-li" ${attrs}><span class="gl-ic" style="background:${bg}">${ic}</span><span class="gl-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span></${attrs ? "button" : "div"}>`;
    const hero = `
      <section class="gl-grp gl-hero">
        <div class="gl-w">${x.revealed ? x.enHtml : esc(c.de)}</div>
        <div class="gl-d">${x.revealed ? esc(c.de) : `Wie heißt das auf ${x.langName}?`}${x.posLabel ? " · " + esc(x.posLabel) : ""}</div>
        <span class="gl-lv">${c.level} · ${esc(x.topic)}</span>
        ${x.revealed ? x.ui.typed : x.ui.hint + x.ui.input}
      </section>`;
    let list;
    if (x.revealed) {
      list = `<section class="gl-grp">
        ${li("#2F7CF6", "🔊", "Wort anhören", "", `data-say="${esc(c.en)}"`)}
        ${c.ex ? li("#FF9500", "❝", x.exMarked, x.exDeMarked, `data-say="${esc(x.exPlain)}"`) : ""}
        <div class="gl-li gl-speed"><span class="gl-ic" style="background:#5856D6">⏱</span>${x.ui.speed}</div>
        ${x.ui.mic ? `<div class="gl-li gl-speed"><span class="gl-ic" style="background:#FF2D55">🎤</span>${x.ui.mic}</div>` : ""}
        ${c.note ? li(x.noteFF ? "#FF3B30" : "#8E8E93", "i", "Hinweis", esc(c.note)) : ""}
      </section>
      <section class="gl-grp gl-grades">
        <button class="grade g1 gl-li" data-g="1"><span class="gl-ic" style="background:#FF3B30">✕</span><span class="gl-t"><b>Muss ich noch lernen</b><small>gleich nochmal</small></span></button>
        <button class="grade g2 gl-li" data-g="2"><span class="gl-ic" style="background:#FFCC00">?</span><span class="gl-t"><b>Unsicher</b><small>${x.practice ? "Übung" : "in " + x.iv2}</small></span></button>
        <button class="grade g3 gl-li" data-g="3"><span class="gl-ic" style="background:#34C759">✓</span><span class="gl-t"><b>Wusste ich</b><small>${x.practice ? "Übung" : "in " + x.iv3}</small></span></button>
      </section>${x.ui.known}`;
    } else {
      list = `<section class="gl-grp">
        ${c.ex ? li("#FF9500", "❝", x.cloze, x.exDeMarked) : ""}
        ${li("#8E8E93", "?", "Hinweis zeigen", "Anfangsbuchstabe und Länge", 'id="hintBtn"')}
      </section>
      <button class="btn primary big" id="reveal">Aufdecken</button>`;
    }
    return `${x.ui.header}${hero}<div class="flash-actions">${list}</div>`;
  },

};
