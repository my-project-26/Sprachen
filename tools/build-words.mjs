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
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

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

const isA = (f) => /\.a\d*\.txt$/.test(f);
const files = readdirSync(DATA).filter((f) => f.endsWith(".txt")).sort();
let skippedA = 0;
let relevelled = 0;
for (const file of [...files.filter((f) => !isA(f)), ...files.filter(isA)]) {
  const topic = basename(file, ".txt").split(".")[0]; // alltag.2.txt → alltag
  let level = null;
  const lines = readFileSync(join(DATA, file), "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const h = t.match(/^##\s*(A1|A2|B1|B2|C1)\b/);
    if (h) return (level = h[1]);
    if (t.startsWith("#")) return;
    const f = t.split("|").map((x) => x.trim());
    const where = `${file}:${i + 1}`;
    if (!level) return problems.push(`${where}: kein Niveau (## A1…C1) davor`);
    if (f.length < 5) return problems.push(`${where}: zu wenige Felder (${f.length})`);
    const [en, de, pos, exRaw, exDe, note = ""] = f;
    if (!en || !de || !exRaw) return problems.push(`${where}: leeres Pflichtfeld`);
    const id = slug(en);
    if (seen.has(id)) {
      // A1/A2-Listen dürfen Wörter enthalten, die es schon gibt – die bleiben dann auf ihrem Niveau
      if (isA(file)) {
        // Wort gibt es schon (z. B. als B1) → nur das Niveau auf A1/A2 korrigieren, Rest bleibt
        const prev = rows.find((r) => slug(r[0]) === id);
        if (prev && !["A1", "A2"].includes(prev[3])) {
          perTopic[prev[4]][prev[3]]--;
          prev[3] = level;
          perTopic[prev[4]][level]++;
          relevelled++;
        }
        return skippedA++;
      }
      return problems.push(`${where}: doppelt „${en}“ (schon in ${seen.get(id)})`);
    }
    seen.set(id, where);
    const ex = autoMark(exRaw, en);
    if (!/\*[^*]+\*/.test(ex)) problems.push(`${where}: keine Markierung im Beispiel („${en}“)`);
    rows.push([en, de, pos, level, topic, ex, exDe, note]);
    perTopic[topic] ||= { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
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

const totals = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
for (const t of Object.values(perTopic)) for (const L of LEVELS) totals[L] += t[L];
console.log("Thema             A1   A2   B1   B2   C1");
const fmt = (v) => LEVELS.map((L) => String(v[L]).padStart(4)).join(" ");
for (const [k, v] of Object.entries(perTopic)) console.log(k.padEnd(15), fmt(v));
console.log("GESAMT".padEnd(15), fmt(totals), "=", rows.length);
if (skippedA) console.log(`(${skippedA} A1/A2-Wörter gab es schon – davon ${relevelled} auf A1/A2 eingestuft)`);
if (problems.length) {
  console.log(`\n${problems.length} Hinweise:`);
  problems.sort((a, b) => Number(a.includes("doppelt")) - Number(b.includes("doppelt")));
  for (const p of problems.slice(0, 200)) console.log(" - " + p);
}
