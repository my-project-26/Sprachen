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
  { key: "retro", name: "80er", desc: "Arcade-Neon und Windows 3.1", colors: ["#12002b", "#ff2e88", "#00f0ff"], theme: "#12002b",
    fonts: "VT323&family=Orbitron:wght@700;900" },
  { key: "musik", name: "Musik", desc: "Player und Karaoke-Text", colors: ["#121212", "#c2185b", "#ffd23f"], theme: "#121212",
    fonts: "Manrope:wght@500;700;800" },
  { key: "kunst", name: "Kunst", desc: "Bauhaus und Museum", colors: ["#F3F1EC", "#E8322B", "#1F4FB8"], theme: "#F3F1EC",
    fonts: "Jost:wght@400;500;700" },
  { key: "sport", name: "Sport", desc: "Anzeigetafel, Tabelle, Karten", colors: ["#0B3D2E", "#FFB800", "#E10600"], theme: "#0B3D2E",
    fonts: "Oswald:wght@500;700&family=Share+Tech+Mono" },
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
      <div class="bk-bar"><p>${esc(d.dateStr)}</p><a class="icon-btn plain" href="#/settings" aria-label="Einstellungen">${d.icon.gear}</a></div>
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
      <a class="icon-btn plain" href="#/settings" aria-label="Einstellungen">${d.icon.gear}</a></header>
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
    <header class="ch-head"><h1>Chats</h1><a class="icon-btn plain" href="#/settings" aria-label="Einstellungen">${d.icon.gear}</a></header>
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
    <header class="hf-head"><h1>${esc(d.weekday)}</h1><a class="icon-btn plain" href="#/settings" aria-label="Einstellungen">${d.icon.gear}</a></header>
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
      <a class="gl-gear" href="#/settings" aria-label="Einstellungen">${d.icon.gear}</a>
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

  // ---------- 6 80er ----------
  retro(d) {
    return `
    <section class="rt-hero">
      <div class="rt-sky"></div><div class="rt-sun"></div><div class="rt-grid"></div>
      <a class="rt-gear" href="#/settings" aria-label="Einstellungen">${d.icon.gear}</a>
      <div class="rt-logo">WORTWERK<small>Turbo English</small></div>
      <nav class="rt-menu">
        ${d.total ? `<a class="on" href="#/learn"><span>START</span><span>${d.total}</span></a>` : `<button class="on" id="extraBtn"><span>${d.wordsLeft ? "+10 NEUE" : "ANDERES THEMA"}</span><span>▶</span></button>`}
        <a href="${d.weak ? "#/learn/weak" : "#/words"}"><span>NOCH LERNEN</span><span>${d.weak}</span></a>
        <a href="${d.ready ? "#/story/new" : "#/stories"}"><span>GESCHICHTE</span><span>${d.storyN}/${d.storyEvery}</span></a>
        <button id="pickTopic"><span>THEMA</span><span class="rt-t">${esc(d.focusLabel.split(/[ ,&]/)[0].toUpperCase())}</span></button>
        <a href="#/topics"><span>LEVEL ${d.lvl[0].L}→C1</span><span>${d.levelPct}%</span></a>
      </nav>
      <p class="rt-hs">HIGHSCORE ${String(d.secure).padStart(3, "0")} · <span>PRESS START</span></p>
    </section>`;
  },

  // ---------- 7 Musik ----------
  musik(d) {
    const pct = d.total ? 0 : 100;
    return `
    <header class="mu-head"><span>Heute für dich</span><a class="icon-btn plain" href="#/settings" aria-label="Einstellungen">${d.icon.gear}</a></header>
    <section class="mu-cover" style="--h:${hash(d.focusLabel) % 360}">
      <div class="mu-vinyl"><span>${esc(d.lvl.find((x) => x.ok < x.total)?.L || "C1")}</span></div>
      <h1>${esc(d.focusLabel)}<small>Sessions</small></h1>
    </section>
    <div class="mu-meta"><b>Heute: ${n(d.total, "Track", "Tracks")}</b><span>${d.news} neu · ${d.due} Wiederholungen · ${d.streak} Tage Serie</span></div>
    <div class="mu-bar"><i style="width:${pct}%"></i></div>
    <div class="mu-ctrl">
      <button id="pickTopic" aria-label="Thema wählen">⤮</button>
      <a href="#/stories" aria-label="Geschichten">⏮</a>
      ${d.total ? `<a class="mu-play" href="#/learn" aria-label="Lernen starten">▶</a>` : `<button class="mu-play" id="extraBtn" aria-label="10 weitere neue Wörter">＋</button>`}
      <a href="${d.weak ? "#/learn/weak" : "#/words"}" aria-label="Noch lernen">⏭</a>
      <a href="#/topics" aria-label="Themen">↻</a>
    </div>
    ${d.total ? "" : `<p class="mu-done">${d.wordsLeft ? "Playlist für heute durchgehört – ＋ für 10 neue Wörter." : "Keine neuen Wörter mehr hier – ⤮ wählt ein anderes Thema."}</p>`}
    <a class="mu-lyr" href="${d.ready ? "#/story/new" : "#/stories"}">${d.ready ? "Neue Geschichte bereit – jetzt mitlesen ♪" : `Nächste Geschichte: ${d.storyN}/${d.storyEvery} Wörter ♪`}</a>
    ${d.weak ? `<a class="mu-lyr alt" href="#/learn/weak">Auf Wiederholung: ${n(d.weak, "Wort", "Wörter")} noch lernen ↺</a>` : ""}`;
  },

  // ---------- 8 Kunst ----------
  kunst(d) {
    return `
    <section class="ku-hero" aria-hidden="true"><i class="k1"></i><i class="k2"></i><i class="k3"></i><i class="k4"></i></section>
    <a class="icon-btn plain ku-gear" href="#/settings" aria-label="Einstellungen">${d.icon.gear}</a>
    <h1 class="ku-title">Heute in der Ausstellung</h1>
    <div class="ku-list">
      <button id="pickTopic"><span>Neue Werke · ${esc(d.focusLabel)}</span><b>${d.news}</b></button>
      <div><span>Wiederholung</span><b>${d.due}</b></div>
      ${d.weak ? `<a href="#/learn/weak"><span>Restaurierung (noch lernen)</span><b>${d.weak}</b></a>` : ""}
      <a href="${d.ready ? "#/story/new" : "#/stories"}"><span>${d.ready ? "Neue Geschichte – Vernissage" : "Nächste Geschichte"}</span><b>${d.storyN}/${d.storyEvery}</b></a>
      <a href="#/topics"><span>Sammlung sicher</span><b>${d.secure}</b></a>
    </div>
    <div class="ku-cta">${cta(d, `Ausstellung betreten · ${d.total}`, "ku-btn")}</div>`;
  },

  // ---------- 9 Sport ----------
  sport(d) {
    const table = [...d.topics]
      .sort((a, b) => b.secure - a.secure || (a.key === d.focus ? -1 : 0))
      .slice(0, 5);
    return `
    <section class="sp-score">
      <div class="sp-tm"><span>SICHER</span><b>${d.secure}<i>:</i>${d.weak}</b><span>NOCH LERNEN</span></div>
      <div class="sp-min">● Spieltag ${d.streak} · ${d.streak ? "Serie läuft" : "neue Serie"}</div>
      <a class="sp-gear" href="#/settings" aria-label="Einstellungen">${d.icon.gear}</a>
    </section>
    <div class="sp-pitch"><i></i></div>
    <section class="sp-table">
      <div class="sp-th"><span>Tabelle · deine Themen</span><button class="link-btn" id="pickTopic">Aufstellung ändern</button></div>
      ${table.map((t, i) => `<div class="sp-r ${t.key === d.focus || t.label === d.nextTopicLabel ? "me" : ""}"><span>${i + 1}</span><span>${esc(t.label)}</span><span>${t.secure}</span><span>${t.level || (t.secure ? "✓" : "–")}</span></div>`).join("")}
    </section>
    <div class="sp-stats"><a href="#/stories"><b>${d.storyN}/${d.storyEvery}</b>bis zur Geschichte</a><a href="${d.weak ? "#/learn/weak" : "#/words"}"><b>${d.weak}</b>Nachholspiele</a></div>
    ${cta(d, `Anstoß · ${n(d.total, "Wort", "Wörter")}`, "sp-kick")}`;
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
          <div class="bk-city to"><small>Nach</small>${x.revealed ? esc(c.en) : "· · ·"}</div>
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
        <div class="st-w">${x.revealed ? esc(c.en) : "?"}</div>
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
      <div class="bub t">Wie heißt das auf Englisch?<span class="q">${esc(c.de)}</span>${c.ex ? `<span class="cz">${x.cloze}</span>` : ""}</div>
      <div class="bub t" id="hint" hidden>Tipp: <code>${esc(x.hint)}</code></div>`;
    if (x.revealed) {
      thread += `
        <div class="bub m">${x.typedRaw != null ? esc(x.typedRaw || "–") : "Zeig's mir 🙈"}</div>
        <div class="bub t">${x.ok === true ? "Genau! 👏 " : x.ok === false ? "Fast! Richtig ist: " : "Das ist: "}<b class="ch-ans">${esc(c.en)}</b>${c.ex ? `<span class="cz">${x.exMarked}</span>` : ""}${c.exDe ? `<span class="de">${x.exDeMarked}</span>` : ""}</div>
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
    rows.push(`<tr class="cur"><td class="hf-de">${esc(c.de)}</td><td class="hf-en">${x.revealed ? `<mark>${esc(c.en)}</mark>` : ""}</td></tr>`);
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
        <div class="gl-w">${x.revealed ? esc(c.en) : esc(c.de)}</div>
        <div class="gl-d">${x.revealed ? esc(c.de) : "Wie heißt das auf Englisch?"}${x.posLabel ? " · " + esc(x.posLabel) : ""}</div>
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

  // ---------- 6 80er ----------
  retro(x) {
    const c = x.c;
    const segs = Math.round((x.pct / 100) * 20);
    const card = `
      <article class="w31">
        <div class="w31-tb"><span>WORTWERK.EXE – Karte ${x.pos}/${x.total}</span><i>_</i></div>
        <div class="w31-bd">
          <div class="w31-in">
            <div class="w31-w">${x.revealed ? esc(c.en) : "?????"}</div>
            <div class="w31-d">= ${esc(c.de)} [${esc(x.posLabel || "–")}, ${c.level}]</div>
            ${x.revealed ? x.ui.typed : ""}
            <p>${x.revealed ? x.exMarked : x.cloze}${c.exDe ? `<br><span class="w31-g">${x.exDeMarked}</span>` : ""}</p>
            ${x.revealed ? x.ui.note : x.ui.hint + x.ui.input}
          </div>
          <div class="w31-prog" aria-label="${Math.round(x.pct)} %">${"<i></i>".repeat(segs)}</div>
          ${
            x.revealed
              ? `<div class="w31-btns">${gradeBtns(x, ["Noch lernen", "Unsicher", "<u>W</u>usste ich"], "w31-btn")}</div>`
              : `<div class="w31-btns"><button class="w31-btn" id="hintBtn">Hinweis…</button><button class="w31-btn def" id="reveal">Aufdecken</button></div>`
          }
        </div>
      </article>`;
    const icons = x.revealed
      ? `<div class="w31-icons"><button data-say="${esc(c.en)}"><span>🔊</span>Anhören</button>${c.ex ? `<button data-say="${esc(x.exPlain)}"><span>📼</span>Satz</button>` : ""}<button id="knownBtn"><span>📁</span>Kenne ich</button></div>`
      : `<div class="w31-icons"><a href="#/"><span>🖥️</span>Programm-Manager</a></div>`;
    return `${x.ui.header}${card}<div class="flash-actions">${icons}</div>`;
  },

  // ---------- 7 Musik ----------
  musik(x) {
    const c = x.c;
    const prevLine = x.prev.length ? x.prev[x.prev.length - 1].exPlain : "";
    const nextLine = x.next.length ? x.next[0].clozePlain : "";
    const card = `
      <article class="mu-lyrics">
        <div class="mu-hd"><span>${esc(x.topic)} · Track ${x.pos}</span><span>${c.level}</span></div>
        <div class="mu-lines">
          ${prevLine ? `<p class="dim">${esc(prevLine)}</p>` : ""}
          <p class="now">${x.revealed ? x.exMarked || esc(c.en) : x.cloze || "♪ ♪ ♪"}</p>
          ${nextLine ? `<p class="dim">${esc(nextLine)}</p>` : ""}
        </div>
        <p class="mu-tr">${x.revealed ? `<b>${esc(c.en)}</b> = ${esc(c.de)}` : esc(c.de)}</p>
        ${c.exDe ? `<p class="mu-trde">${x.exDeMarked}</p>` : ""}
        ${x.revealed ? x.ui.typed + x.ui.listen + x.ui.note : x.ui.hint + x.ui.input}
        <div class="mu-eq ${x.revealed ? "on" : ""}" aria-hidden="true">${"<i></i>".repeat(16)}</div>
      </article>`;
    const actions = x.revealed
      ? `<div class="mu-rate">${gradeBtns(x, ["Muss ich noch lernen ↺", "Unsicher ♪", "Wusste ich ♥"], "mu-pill")}</div>${x.ui.known}`
      : `<div class="actions-row"><button class="btn ghost" id="hintBtn">Hinweis</button><button class="btn primary" id="reveal">▶ Aufdecken</button></div>`;
    return `${x.ui.header}${card}<div class="flash-actions">${actions}</div>`;
  },

  // ---------- 8 Kunst ----------
  kunst(x) {
    const c = x.c;
    const h = hash(c.en);
    const pal = ["#E8322B", "#F6C523", "#1F4FB8", "#151515"];
    const a = pal[h % 4], b = pal[(h >> 3) % 4 === h % 4 ? (h % 4 + 1) % 4 : (h >> 3) % 4];
    const shapes = `
      <i class="kf-c" style="background:${a};left:${8 + (h % 30)}%;top:${6 + ((h >> 4) % 20)}%"></i>
      <i class="kf-r" style="background:${b};right:${6 + ((h >> 6) % 20)}%;bottom:${8 + ((h >> 8) % 18)}%"></i>
      <i class="kf-l"></i>`;
    const card = `
      <article class="ku-room">
        <div class="ku-frame">${shapes}<span class="ku-wd">${x.revealed ? esc(c.en) : "?"}</span></div>
        <div class="ku-label">
          <b>${esc(c.de)}</b>
          <span>${esc(x.posLabel || "Wort")}, ${c.level} · Saal ${esc(x.topic)}</span>
          ${c.ex ? `<i>„${x.revealed ? x.exMarked : x.cloze}“</i>` : ""}
          ${c.exDe ? `<small>${x.exDeMarked}</small>` : ""}
          ${x.revealed ? x.ui.typed + x.ui.listen + x.ui.note : x.ui.hint + x.ui.input}
        </div>
      </article>`;
    const actions = x.revealed
      ? `<div class="ku-rt">${gradeBtns(x, ["Noch lernen", "Unsicher", "Wusste ich"], "ku-blk")}</div>${x.ui.known}`
      : `<div class="actions-row"><button class="btn ghost" id="hintBtn">Hinweis</button><button class="btn primary" id="reveal">Enthüllen</button></div>`;
    return `${x.ui.header}${card}<div class="flash-actions">${actions}</div>`;
  },

  // ---------- 9 Sport ----------
  sport(x) {
    const c = x.c;
    const card = `
      <article class="sp-card">
        <div class="sp-hd2"><span>Spielzug ${x.pos}/${x.total}</span><span>${c.level} · ${esc(x.topic)}</span></div>
        <div class="sp-jersey ${x.revealed ? "back" : ""}">
          <span class="sp-name">${esc((x.revealed ? c.en : c.de.split(",")[0]).toUpperCase())}</span>
          <span class="sp-num">${x.pos}</span>
          <span class="sp-sub">${x.revealed ? esc(c.de) : "Wie heißt das auf Englisch?"}</span>
        </div>
        ${x.revealed ? x.ui.typed : ""}
        <p class="sp-ex">${x.revealed ? x.exMarked : x.cloze}</p>
        ${c.exDe ? `<p class="sp-exde">${x.exDeMarked}</p>` : ""}
        ${x.revealed ? x.ui.listen + x.ui.note : x.ui.hint + x.ui.input}
      </article>`;
    const actions = x.revealed
      ? `<div class="sp-cards">${gradeBtns(x, ["Noch lernen", "Unsicher", "Wusste ich"], "sp-c")}</div>${x.ui.known}`
      : `<div class="actions-row"><button class="btn ghost" id="hintBtn">Taktik-Tipp</button><button class="btn primary" id="reveal">Abpfiff – aufdecken</button></div>`;
    return `${x.ui.header}${card}<div class="flash-actions">${actions}</div>`;
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
