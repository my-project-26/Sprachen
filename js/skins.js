// Designs: Jedes Design hat eigene Layouts für die Startseite und die Lernkarte.
// Alle anderen Seiten passen sich über CSS (skins.css) an.
// Wichtig: Die Bausteine behalten ihre IDs/Attribute (reveal, hintBtn, data-g …),
// damit die Logik in app.js für jedes Design gleich funktioniert.

export const DESIGNS = [
  { key: "paper", name: "Klassisch", desc: "ruhig, wie ein Buch", colors: ["#f5efe3", "#0f6b5f", "#ffd86b"], theme: "#f5efe3" },
  { key: "bordkarte", name: "Bordkarte", desc: "Lernen als Reise, jede Vokabel ein Ticket", colors: ["#0E2240", "#FFC72C", "#E6E9EE"], theme: "#0E2240",
    fonts: "Barlow+Condensed:wght@500;600;700" },
  { key: "stapel", name: "Stapel", desc: "jugendlich, Karten wischen", colors: ["#5B2EFF", "#D4FF3A", "#FF5C7A"], theme: "#5B2EFF",
    fonts: "Poppins:wght@400;500;600;700" },
  { key: "chat", name: "Tutor-Chat", desc: "die App als Messenger", colors: ["#ffffff", "#2B6BF3", "#0FA37F"], theme: "#ffffff" },
  { key: "heft", name: "Vokabelheft", desc: "Linien, Handschrift, Textmarker", colors: ["#FDFDFB", "#23408E", "#FFF27A"], theme: "#FDFDFB",
    fonts: "Caveat:wght@500;700&family=Lora:ital,wght@0,400;0,600;1,400" },
  { key: "glas", name: "iOS-Glas", desc: "wie Apple Karten, Glas und Listen", colors: ["#F2F2F7", "#2F7CF6", "#34C759"], theme: "#F2F2F7" },
];

export const designKey = (k) => (DESIGNS.some((d) => d.key === k) ? k : "paper");

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
    if (d.key === "paper") m.setAttribute("content", m.media.includes("dark") ? "#14191b" : "#f5efe3");
    else m.setAttribute("content", d.theme);
  });
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hash = (s) => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const n = (x, one, many) => `${x} ${x === 1 ? one : many}`;

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

  // ---------- 2 Stapel ----------
  stapel(d) {
    return `
    <header class="st-head"><div><span>Hey 👋</span><h1>${d.total ? `Bereit für ${n(d.total, "Karte", "Karten")}?` : "Alles weggewischt!"}</h1></div>
      <a class="icon-btn plain" href="#/settings" aria-label="Einstellungen"><span class="sk-flag">${d.lang.flag}</span>${d.icon.gear}</a></header>
    <div class="st-bento">
      <div class="st-tile big"><small>Tage am Stück</small><b>${d.streak}</b><span class="st-fl">🔥</span></div>
      <div class="st-tile pink"><small>neue Wörter</small><b>${d.news}</b></div>
      <a class="st-tile sky" href="${d.weak ? "#/learn/weak" : "#/words"}"><small>noch lernen</small><b>${d.weak}</b></a>
      <div class="st-tile wide"><div><small>Nächste Geschichte</small><b>${d.storyN}/${d.storyEvery}</b></div>
        ${d.ready ? `<a class="st-go" href="#/story/new">Geschichte!</a>` : cta(d, "Los geht's", "st-go")}</div>
    </div>
    ${d.ready && d.total ? `<a class="st-tile wide st-learn" href="#/learn"><b>${d.total}</b> Karten wischen</a>` : ""}
    <div class="st-chips">
      ${d.topics.slice(0, 7).map((t) => `<span class="${t.key === d.focus ? "on" : ""}">${esc(t.label)}</span>`).join("")}
      <button id="pickTopic">＋ Thema wählen</button>
    </div>`;
  },

  // ---------- 3 Tutor-Chat ----------
  chat(d) {
    const conv = (av, color, title, text, meta, badge, href, id = "") =>
      `<${href ? `a href="${href}"` : "button"} class="ch-conv" ${id ? `id="${id}"` : ""}>
        <span class="ch-av" style="background:${color}">${av}</span>
        <span class="ch-tx"><b>${title}</b><span>${text}</span></span>
        <span class="ch-meta">${meta}${badge ? `<i style="${badge.bg ? `background:${badge.bg}` : ""}">${badge.n}</i>` : ""}</span>
      </${href ? "a" : "button"}>`;
    return `
    <header class="ch-head"><h1>Chats</h1><a class="icon-btn plain" href="#/settings" aria-label="Einstellungen"><span class="sk-flag">${d.lang.flag}</span>${d.icon.gear}</a></header>
    <a class="ch-search" href="#/words">${d.icon.search}<span>Wörter suchen</span></a>
    <div class="ch-list">
      ${
        d.total
          ? conv("M", "#0FA37F", "Mia · deine Tutorin", `${n(d.total, "Wort wartet", "Wörter warten")} heute auf dich 😊`, "jetzt", { n: d.total }, "#/learn")
          : conv("M", "#0FA37F", "Mia · deine Tutorin", d.wordsLeft ? "Für heute ist alles erledigt 🎉 – noch 10 neue?" : "Hier sind alle Wörter durch – anderes Thema?", "", null, "", "extraBtn")
      }
      ${conv("📖", "#F59E0B", "Geschichte", d.ready ? "Neue Geschichte bereit – tippen zum Erstellen" : `${d.storyN} von ${d.storyEvery} Übungswörtern gesammelt`, d.stories ? n(d.stories, "Geschichte", "Geschichten") : "", d.ready ? { n: "1" } : null, d.ready ? "#/story/new" : "#/stories")}
      ${d.weak ? conv("!", "#E11D48", "Noch lernen", esc(d.weakWords.join(", ")), "", { n: d.weak, bg: "#E11D48" }, "#/learn/weak") : ""}
      ${conv("#", "#2B6BF3", esc(d.focusLabel), "Thema für neue Wörter – tippen zum Ändern", "", null, "", "pickTopic")}
      ${conv("C1", "#7C3AED", "Dein Weg zu C1", d.lvl.map((x) => `${x.L} ${x.total ? Math.round((x.ok / x.total) * 100) : 0} %`).join(" · "), "", null, "#/topics")}
    </div>
    <div class="ch-stats"><div><b>${d.streak}</b>Tage Serie</div><div><b>${d.secure}</b>sicher</div><div><b>${d.stories}</b>Geschichten</div></div>`;
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

  // ---------- 2 Stapel ----------
  stapel(x) {
    const c = x.c;
    const top = `
      <article class="st-card st-top ${x.revealed ? "swipe" : "tap"}" id="stTop">
        <div class="st-tags"><span>${c.level}</span><span>${esc(x.topic)}</span>${x.isNew ? "<span>neu</span>" : ""}${c.weak ? "<span class=w>noch lernen</span>" : ""}</div>
        ${x.revealed ? `<button class="st-spk" data-say="${esc(c.en)}" aria-label="Anhören">${x.icon.speaker}</button>` : ""}
        <div class="st-de">${esc(c.de)}</div>
        <div class="st-w">${x.revealed ? x.enHtml : "?"}</div>
        ${x.revealed ? x.ui.typed : ""}
        <p class="st-ex">${x.revealed ? x.exMarked : x.cloze}</p>
        ${x.revealed ? `<p class="st-exde">${x.exDeMarked}</p>${x.ui.note}` : x.ui.hint + x.ui.input}
        ${x.revealed ? "" : `<p class="st-tap">Tippen zum Aufdecken</p>`}
      </article>`;
    const actions = x.revealed
      ? `<div class="st-hints">
          <button class="grade g1" data-g="1"><i>←</i><span>noch lernen</span></button>
          <button class="grade g2" data-g="2"><i>↑</i><span>unsicher</span></button>
          <button class="grade g3" data-g="3"><i>→</i><span>wusste ich</span></button>
        </div>
        <p class="st-swipe">Wischen oder tippen · ${x.practice ? "Übung" : `unsicher: ${x.iv2} · gewusst: ${x.iv3}`}</p>
        ${x.ui.known}`
      : `<div class="actions-row"><button class="btn ghost" id="hintBtn">Hinweis</button><button class="btn primary" id="reveal">Umdrehen</button></div>`;
    return `${x.ui.header}<div class="st-deck"><div class="st-card b2"></div><div class="st-card b1"></div>${top}</div><div class="flash-actions">${actions}</div>`;
  },

  // ---------- 3 Tutor-Chat ----------
  chat(x) {
    const c = x.c;
    let thread = `
      <div class="ch-day">Karte ${x.pos} von ${x.total}</div>
      <div class="bub t">Wie heißt das auf ${esc(x.langName)}?<span class="q">${esc(c.de)}</span>${c.ex ? `<span class="cz">${x.cloze}</span>` : ""}</div>
      <div class="bub t" id="hint" hidden>Tipp: <code>${esc(x.hint)}</code></div>`;
    if (x.revealed) {
      thread += `
        <div class="bub m">${x.typedRaw != null ? esc(x.typedRaw || "–") : "Zeig's mir 🙈"}</div>
        <div class="bub t">${x.ok === true ? "Genau! 👏 " : x.ok === false ? "Fast! Richtig ist: " : "Das ist: "}<b class="ch-ans">${x.enHtml}</b>${c.ex ? `<span class="cz">${x.exMarked}</span>` : ""}${c.exDe ? `<span class="de">${x.exDeMarked}</span>` : ""}</div>
        ${c.note ? `<div class="bub t ${x.noteFF ? "ff" : ""}">💡 ${esc(c.note)}</div>` : ""}
        <div class="bub t voice"><button class="ch-play" data-say="${esc(c.en)}" aria-label="Wort anhören">▶</button><span class="wave">${"<i></i>".repeat(14)}</span><span>Wort</span>
          ${c.ex ? `<button class="ch-play" data-say="${esc(x.exPlain)}" aria-label="Satz anhören">▶</button><span>Satz</span>` : ""}</div>
        <div class="bub t">Wie sicher warst du?</div>`;
    }
    const chips = x.revealed
      ? `<div class="ch-chips">${gradeBtns(x, L3, "chip-g")}</div>${x.ui.known}`
      : `${x.ui.input}<div class="ch-chips"><button class="btn ghost" id="hintBtn">Tipp</button><button class="btn primary" id="reveal">Zeig's mir</button></div>`;
    return `${x.ui.header}<div class="ch-thread">${thread}</div><div class="flash-actions ch-bottom">${chips}</div>`;
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

// Wischgesten für das Design „Stapel“: links = 1, hoch = 2, rechts = 3
export function bindSwipe(el, onGrade) {
  if (!el) return;
  let sx = 0, sy = 0, dx = 0, dy = 0, active = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    active = true;
    sx = e.clientX;
    sy = e.clientY;
    dx = dy = 0;
    el.setPointerCapture(e.pointerId);
    el.style.transition = "none";
  });
  el.addEventListener("pointermove", (e) => {
    if (!active) return;
    dx = e.clientX - sx;
    dy = e.clientY - sy;
    el.style.transform = `translate(${dx}px, ${Math.min(0, dy)}px) rotate(${dx / 14}deg)`;
    el.dataset.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 40 ? "r" : dx < -40 ? "l" : "") : dy < -40 ? "u" : "";
  });
  const end = () => {
    if (!active) return;
    active = false;
    el.style.transition = "";
    const g = Math.abs(dx) > Math.abs(dy) ? (dx > 90 ? 3 : dx < -90 ? 1 : 0) : dy < -90 ? 2 : 0;
    if (g) {
      el.style.transform = g === 3 ? "translate(140%, 0) rotate(20deg)" : g === 1 ? "translate(-140%, 0) rotate(-20deg)" : "translate(0, -140%)";
      el.style.opacity = "0";
      setTimeout(() => onGrade(g), 180);
    } else {
      el.style.transform = "";
      el.dataset.dir = "";
    }
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}
