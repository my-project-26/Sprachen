// Baut js/wordbank.js aus den Wortlisten in data/*.txt
// Aufruf: node tools/build-words.mjs
//
// Format einer Datei data/<thema>.txt:
//   ## B1                      ← Niveau für die folgenden Zeilen
//   englisch | deutsch | Wortart | Beispiel EN | Beispiel DE | Hinweis (optional)
// Das Zielwort im Beispiel steht in *Sternchen*. Zeilen mit # sind Kommentare.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA = join(ROOT, "data");
const LEVELS = ["B1", "B2", "C1"];

const slug = (en) => en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Fehlt die Markierung im englischen Satz, das Wort (oder seinen Stamm) automatisch markieren
function autoMark(ex, en) {
  if (/\*[^*]+\*/.test(ex)) return ex;
  const stem = en.split(" ")[0].replace(/(e|y)$/, "");
  const re = new RegExp(`\\b(${escRe(stem)}[a-z]*)`, "i");
  return re.test(ex) ? ex.replace(re, "*$1*") : ex;
}

const rows = [];
const seen = new Map();
const problems = [];
const perTopic = {};

for (const file of readdirSync(DATA).filter((f) => f.endsWith(".txt")).sort()) {
  const topic = basename(file, ".txt").split(".")[0]; // alltag.2.txt → alltag
  let level = null;
  const lines = readFileSync(join(DATA, file), "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const h = t.match(/^##\s*(B1|B2|C1)\b/);
    if (h) return (level = h[1]);
    if (t.startsWith("#")) return;
    const f = t.split("|").map((x) => x.trim());
    const where = `${file}:${i + 1}`;
    if (!level) return problems.push(`${where}: kein Niveau (## B1/B2/C1) davor`);
    if (f.length < 5) return problems.push(`${where}: zu wenige Felder (${f.length})`);
    const [en, de, pos, exRaw, exDe, note = ""] = f;
    if (!en || !de || !exRaw) return problems.push(`${where}: leeres Pflichtfeld`);
    const id = slug(en);
    if (seen.has(id)) return problems.push(`${where}: doppelt „${en}“ (schon in ${seen.get(id)})`);
    seen.set(id, where);
    const ex = autoMark(exRaw, en);
    if (!/\*[^*]+\*/.test(ex)) problems.push(`${where}: keine Markierung im Beispiel („${en}“)`);
    rows.push([en, de, pos, level, topic, ex, exDe, note]);
    perTopic[topic] ||= { B1: 0, B2: 0, C1: 0 };
    perTopic[topic][level]++;
  });
}

const out =
  "// Automatisch erzeugt mit `node tools/build-words.mjs` aus data/*.txt – nicht von Hand bearbeiten.\n" +
  "// Format: [englisch, deutsch, Wortart, Niveau, Thema, Beispiel EN, Beispiel DE, Hinweis]\n" +
  "export const WORDBANK = [\n" +
  rows.map((r) => "  " + JSON.stringify(r)).join(",\n") +
  "\n];\n";
writeFileSync(join(ROOT, "js", "wordbank.js"), out);

const totals = { B1: 0, B2: 0, C1: 0 };
for (const t of Object.values(perTopic)) for (const L of LEVELS) totals[L] += t[L];
console.log("Thema            B1   B2   C1");
for (const [k, v] of Object.entries(perTopic)) console.log(k.padEnd(15), String(v.B1).padStart(4), String(v.B2).padStart(4), String(v.C1).padStart(4));
console.log("GESAMT".padEnd(15), String(totals.B1).padStart(4), String(totals.B2).padStart(4), String(totals.C1).padStart(4), "=", rows.length);
if (problems.length) {
  console.log(`\n${problems.length} Hinweise:`);
  for (const p of problems.slice(0, 200)) console.log(" - " + p);
}
