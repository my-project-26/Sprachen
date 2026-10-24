#!/usr/bin/env python3
"""
Aufnahmen mit den Google-Stimmen „Chirp 3 HD“ (Cloud Text-to-Speech) – sauber, ohne Klonen.
Schlüssel: Umgebungsvariable GOOGLE_TTS_KEY (GitHub-Secret).

  python tools/gtts.py probe <stimme> <lang …>          # kurze Hörprobe je Sprache → probe/
  python tools/gtts.py run <stimme> <lang> <outdir>      # alle Wörter/Sätze, Niveau für Niveau

Kostenschutz: Zeichen werden pro Monat in <zähldatei> gezählt; bei GTTS_CAP (Standard 300000)
hört das Skript auf. Google schenkt 1 Mio. Zeichen/Monat für Chirp 3 HD – verteilt auf die Repos.
"""
import base64, concurrent.futures as cf, datetime, importlib.util, json, os, subprocess, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("clone", os.path.join(ROOT, "tools", "clone.py"))
clone = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clone)
texts_for, audio_key = clone.texts_for, clone.audio_key

VOICES = {"f1": "Achernar", "f2": "Sulafat", "f3": "Gacrux", "m2": "Charon", "m3": "Algenib"}
LOCALE = {"en": "en-US", "it": "it-IT", "es": "es-ES", "fr": "fr-FR"}
KEY = os.environ.get("GOOGLE_TTS_KEY", "")
CAP = int(os.environ.get("GTTS_CAP", "300000"))
USAGE = os.environ.get("GTTS_USAGE", "gtts-usage.json")


def usage_load():
    month = datetime.date.today().strftime("%Y-%m")
    try:
        d = json.load(open(USAGE))
    except Exception:
        d = {}
    return d, month


def usage_add(n):
    d, month = usage_load()
    d[month] = d.get(month, 0) + n
    json.dump(d, open(USAGE, "w"), indent=1)
    return d[month]


def synth(text, lang, voice):
    body = {
        "input": {"text": text},
        "voice": {"languageCode": LOCALE[lang], "name": f"{LOCALE[lang]}-Chirp3-HD-{voice}"},
        "audioConfig": {"audioEncoding": "MP3", "sampleRateHertz": 24000, "speakingRate": float(os.environ.get("GTTS_RATE", "1.0"))},
    }
    req = urllib.request.Request(
        f"https://texttospeech.googleapis.com/v1/text:synthesize?key={KEY}",
        data=json.dumps(body).encode(), headers={"content-type": "application/json"}, method="POST")
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return base64.b64decode(json.load(r)["audioContent"])
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if e.code in (429, 500, 503) and attempt < 7:
                time.sleep(5 + attempt * 10)
                continue
            raise RuntimeError(f"Google {e.code}: {msg}")
        except urllib.error.URLError:
            time.sleep(3)
    raise RuntimeError("Google nicht erreichbar")


def save_mp3(data, path):
    tmp = path + ".tmp.mp3"
    open(tmp, "wb").write(data)
    # leise Ränder kürzen, Lautstärke wie die übrigen Aufnahmen, 24 kHz mono 48 kbit/s
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp, "-af",
                    "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-18:TP=-2",
                    "-ac", "1", "-ar", "24000", "-b:a", "48k", path], check=True)
    os.remove(tmp)


def probe(voice, langs):
    os.makedirs("probe", exist_ok=True)
    total = 0
    for lang in langs:
        sents = [t for t in texts_for(lang, {"A1"}) if t.count(" ") >= 3][:4]
        words = [t for t in texts_for(lang, {"A1"}) if " " not in t][:4]
        items = [x for pair in zip(words, sents) for x in pair]
        parts = []
        for i, t in enumerate(items):
            p = f"/tmp/g{lang}{i}.mp3"
            save_mp3(synth(t, lang, VOICES[voice]), p)
            parts.append(p)
            total += len(t)
        gap = "/tmp/gap.mp3"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.6", "-b:a", "48k", gap], check=True)
        lst = "/tmp/glist.txt"
        open(lst, "w").writelines(f"file '{p}'\nfile '{gap}'\n" for p in parts)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-b:a", "64k", f"probe/google-{voice}-{lang}.mp3"], check=True)
        print(f"{lang}: Probe fertig", flush=True)
    print("Zeichen diesen Monat:", usage_add(total))


def run(voice, lang, outdir):
    order, seen = [], set()
    for lv in ["A1", "A2", "B1", "B2", "C1"]:
        for t in texts_for(lang, {lv}):
            if t not in seen:
                seen.add(t)
                order.append(t)
    for t in texts_for(lang):
        if t not in seen:
            seen.add(t)
            order.append(t)
    os.makedirs(outdir, exist_ok=True)
    todo = [t for t in order if not os.path.exists(os.path.join(outdir, audio_key(t) + ".mp3"))]
    d, month = usage_load()
    used = d.get(month, 0)
    print(f"{outdir}: {len(todo)} von {len(order)} fehlen · diesen Monat schon {used} Zeichen, Grenze {CAP}", flush=True)
    budget = CAP - used
    batch, done_chars, fails = [], 0, 0
    for t in todo:
        if done_chars + len(t) > budget:
            print("Monatsgrenze erreicht – Rest im nächsten Monat (kostenlos)", flush=True)
            break
        batch.append(t)
        done_chars += len(t)

    def one(t):
        save_mp3(synth(t, lang, VOICES[voice]), os.path.join(outdir, audio_key(t) + ".mp3"))
        return len(t)

    counted = 0
    with cf.ThreadPoolExecutor(int(os.environ.get("GTTS_THREADS", "8"))) as ex:
        futs = {ex.submit(one, t): t for t in batch}
        for i, f in enumerate(cf.as_completed(futs)):
            try:
                counted += f.result()
            except Exception as e:
                fails += 1
                print(f"  ✗ {futs[f][:40]!r}: {e}", flush=True)
                if "403" in str(e) or "400" in str(e) and "API key" in str(e):
                    break
            if i % 500 == 0:
                print(f"  {i}/{len(batch)}", flush=True)
    total = usage_add(counted)
    print(f"{outdir}: {len(batch) - fails} neu, {fails} Fehler · Zeichen diesen Monat: {total}", flush=True)


GALLERY = {
    "f": [("Achernar", "sanft"), ("Aoede", "luftig"), ("Autonoe", "hell"), ("Callirrhoe", "locker"), ("Despina", "weich"),
          ("Erinome", "klar"), ("Gacrux", "reif, tief"), ("Kore", "bestimmt"), ("Laomedeia", "fröhlich"), ("Leda", "jugendlich"),
          ("Pulcherrima", "direkt"), ("Sulafat", "warm"), ("Vindemiatrix", "behutsam"), ("Zephyr", "strahlend")],
    "m": [("Achird", "freundlich"), ("Algenib", "rau"), ("Algieba", "geschmeidig"), ("Alnilam", "fest"), ("Charon", "sachlich"),
          ("Enceladus", "hauchig"), ("Fenrir", "lebhaft"), ("Iapetus", "klar"), ("Orus", "fest, tief"), ("Puck", "munter"),
          ("Rasalgethi", "erzählend"), ("Sadachbia", "lebendig"), ("Sadaltager", "kundig"), ("Schedar", "ausgeglichen"),
          ("Umbriel", "entspannt"), ("Zubenelgenubi", "lässig")],
}


def gallery(lang="en"):
    """Alle Chirp-3-HD-Stimmen mit demselben Satz → probe/stimmen/ + Übersichtsseite probe/stimmen.html"""
    text = "Hello! I'm your new language coach. Let's practise a few words together: the station, the hotel, a difficult question."
    os.makedirs("probe/stimmen", exist_ok=True)
    rows = []
    total = 0
    for g, lst in GALLERY.items():
        for name, desc in lst:
            path = f"probe/stimmen/{name}.mp3"
            if not os.path.exists(path):
                save_mp3(synth(text, lang, name), path)
                total += len(text)
            rows.append((g, name, desc))
    usage_add(total)
    sect = lambda g, title: f"<h2>{title}</h2>" + "".join(
        f'<div class="v"><b>{n}</b> <span>{d}</span><audio controls preload="none" src="stimmen/{n}.mp3"></audio></div>' for gg, n, d in rows if gg == g)
    html = f"""<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stimmen vergleichen</title><style>body{{font:17px system-ui;max-width:620px;margin:20px auto;padding:0 16px;background:#F4F2FB;color:#1C1A2E}}
.v{{background:#fff;border-radius:14px;padding:10px 14px;margin:8px 0}}.v span{{color:#666}}audio{{width:100%;margin-top:6px}}</style>
<h1>Stimmen vergleichen</h1><p>Alle sprechen denselben Satz. Merk dir die Namen, die dir gefallen.</p>
{sect("f", "Frauen")}{sect("m", "Männer")}</html>"""
    open("probe/stimmen.html", "w").write(html)
    print("Galerie fertig, Zeichen:", total)


if __name__ == "__main__":
    if not KEY:
        sys.exit("GOOGLE_TTS_KEY fehlt (GitHub-Secret)")
    if sys.argv[1] == "gallery":
        gallery()
    elif sys.argv[1] == "probe":
        probe(sys.argv[2], sys.argv[3:])
    else:
        run(sys.argv[2], sys.argv[3], sys.argv[4])
