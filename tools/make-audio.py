#!/usr/bin/env python3
"""
Erzeugt natürliche Sprachaufnahmen (Microsoft-Neuralstimmen über edge-tts)
für alle Wörter und Beispielsätze einer Sprache.

  pip install edge-tts
  python tools/make-audio.py es          # nur Spanisch
  python tools/make-audio.py en es       # mehrere
  python tools/make-audio.py all         # alle Sprachen mit Wortliste
  python tools/make-audio.py en:A1       # nur Englisch, Niveau A1
  python tools/make-audio.py en:A1,A2 es # Englisch A1+A2, Spanisch komplett
  python tools/make-audio.py en@m        # Englisch, tiefe Männerstimme (Ordner audio/en-m)
  python tools/make-audio.py it@f2:A1    # Italienisch A1, verführerische Frauenstimme (it-f2)

Ergebnis: audio/<sprache>/<hash>.mp3 und audio/<sprache>/index.json
(Liste der vorhandenen Aufnahmen). Bereits vorhandene Dateien werden
übersprungen – das Skript kann also jederzeit abgebrochen und neu
gestartet werden. Der Dateiname ist ein Hash des Textes; die App
berechnet denselben Hash (js/tts.js → audioKey).
"""
import asyncio
import json
import os
import re
import sys
import time
import unicodedata

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Zielordner der Aufnahmen: Standard audio/ in diesem Repo; für eigene
# Audio-Repos (audio-it …) per AUDIO_DIR auf deren Ordner umstellbar.
AUDIO_DIR = os.path.abspath(os.environ.get("AUDIO_DIR") or os.path.join(ROOT, "audio"))

# Eine Stimme je Sprache (weiblich, neuronal)
VOICES = {
    "en": "en-US-AvaNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
    "it": "it-IT-ElsaNeural",
    "pl": "pl-PL-ZofiaNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "ja": "ja-JP-NanamiNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ko": "ko-KR-SunHiNeural",
    "hi": "hi-IN-SwaraNeural",
    # Deutsch: Übersetzungen (Wort + Beispielsatz) der englischen Karten für den Hörmodus
    "de": "de-DE-SeraphinaMultilingualNeural",
}

# Zusätzliche Stimmen je Sprache: (Stimmen zur Auswahl, Tempo, Tonhöhe).
# Die erste Stimme, die funktioniert, wird genommen.
VARIANTS = {
    # tiefe, warme Männerstimme
    "m": {
        "en": ["en-US-AndrewNeural", "en-US-ChristopherNeural", "en-US-GuyNeural"],
        "es": ["es-ES-AlvaroNeural"],
        "it": ["it-IT-DiegoNeural", "it-IT-GiuseppeMultilingualNeural"],
        "fr": ["fr-FR-HenriNeural"],
        "_rate": "-6%",
        "_pitch": "-8Hz",
    },
    # sanfte, verführerische Frauenstimme
    "f2": {
        "en": ["en-US-EmmaNeural", "en-US-AriaNeural", "en-GB-SoniaNeural"],
        "es": ["es-ES-XimenaNeural", "es-MX-DaliaNeural"],
        "it": ["it-IT-IsabellaNeural", "it-IT-ElsaNeural"],
        "fr": ["fr-FR-VivienneMultilingualNeural", "fr-FR-EloiseNeural"],
        "_rate": "-10%",
        "_pitch": "-6Hz",
    },
}

# Auf GitHub: Zwischenstände regelmäßig hochladen (Fortschritt sichtbar, nichts geht verloren)
PUSH_EVERY_MIN = float(os.environ.get("AUDIO_PUSH_EVERY_MIN", "0") or 0)
_last_push = time.time()

PARALLEL = int(os.environ.get("AUDIO_PARALLEL", "6"))
# Maximale Laufzeit in Minuten (für GitHub Actions; danach wird sauber beendet)
MAX_MIN = float(os.environ.get("AUDIO_MAX_MIN", "0") or 0)


def norm(text):
    t = unicodedata.normalize("NFC", str(text)).replace("*", "")
    return re.sub(r"\s+", " ", t).strip()


def fnv(data, h=0x811C9DC5):
    for b in data:
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def audio_key(text):
    """Muss exakt audioKey() in js/tts.js entsprechen."""
    b = norm(text).encode("utf-8")
    return f"{fnv(b):08x}{fnv(b, 0x01000193):08x}"


def rows_from(path, start=None, end="];"):
    rows = []
    inside = start is None
    with open(path, encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not inside:
                inside = s.startswith(start)
                continue
            if start and s.startswith(end):
                break
            if s.startswith("[") and s.endswith(("],", "]")):
                try:
                    rows.append(json.loads(s.rstrip(",")))
                except json.JSONDecodeError:
                    pass
    return rows


def texts_for(lang, levels=None):
    js = os.path.join(ROOT, "js")
    if lang == "de":
        rows = rows_from(os.path.join(js, "words.js"), "const RAW = [") + rows_from(os.path.join(js, "wordbank.js"))
        if levels:
            rows = [r for r in rows if len(r) > 3 and r[3] in levels]
        out, seen = [], set()
        for r in rows:
            for t in (r[1] if len(r) > 1 else "", r[6] if len(r) > 6 else ""):
                t = norm(str(t).replace(";", ","))
                if t and t not in seen:
                    seen.add(t)
                    out.append(t)
        return out
    if lang == "en":
        rows = rows_from(os.path.join(js, "words.js"), "const RAW = [")
        rows += rows_from(os.path.join(js, "wordbank.js"))
    else:
        p = os.path.join(js, f"wordbank.{lang}.js")
        if not os.path.exists(p):
            return []
        rows = rows_from(p)
    if levels:
        rows = [r for r in rows if len(r) > 3 and r[3] in levels]
    out = []
    for r in rows:
        if r and r[0]:
            out.append(r[0])
        if len(r) > 5 and r[5]:
            out.append(r[5])
    # Begrüßung aus den Einstellungen („Stimme testen“)
    with open(os.path.join(js, "langs.js"), encoding="utf-8") as f:
        m = re.search(rf'^\s*{lang}: \{{.*?hello: "((?:[^"\\]|\\.)*)"', f.read(), re.M)
    if m:
        out.append(json.loads(f'"{m.group(1)}"'))
    seen, uniq = set(), []
    for t in out:
        t = norm(t)
        if t and t not in seen:
            seen.add(t)
            uniq.append(t)
    return uniq


async def one(text, voice, path, sem, stats, rate="+0%", pitch="+0Hz"):
    async with sem:
        for attempt in range(4):
            try:
                tmp = path + ".part"
                await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(tmp)
                if os.path.getsize(tmp) < 500:
                    raise RuntimeError("leere Aufnahme")
                os.replace(tmp, path)
                stats["ok"] += 1
                return
            except Exception as e:  # Netzfehler, Drosselung …
                if attempt == 3:
                    stats["fail"] += 1
                    print(f"  ✗ {text[:50]!r}: {e}", flush=True)
                    return
                await asyncio.sleep(2 + attempt * 4)


def write_index(folder, voice):
    keys = sorted(f[:-4] for f in os.listdir(folder) if f.endswith(".mp3"))
    with open(os.path.join(folder, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"voice": voice, "keys": keys}, f, separators=(",", ":"))
    return keys


def checkpoint(folder, voice, force=False):
    global _last_push
    if not PUSH_EVERY_MIN or (not force and time.time() - _last_push < PUSH_EVERY_MIN * 60):
        return
    _last_push = time.time()
    write_index(folder, voice)
    import subprocess

    sh = lambda *c: subprocess.run(c, cwd=AUDIO_DIR, check=False)
    sh("git", "add", "-A", ".")
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=AUDIO_DIR).returncode == 0:
        return
    sh("git", "commit", "-q", "-m", "Sprachaufnahmen (Zwischenstand)")
    sh("git", "pull", "-q", "--rebase", "origin", "main")
    sh("git", "push", "-q", "origin", "HEAD:main")
    print("  ↑ Zwischenstand hochgeladen", flush=True)


async def pick_voice(candidates, rate, pitch):
    """Erste Stimme aus der Liste, die wirklich eine Aufnahme liefert."""
    for v in candidates:
        try:
            got = b""
            async for c in edge_tts.Communicate("Hello", v, rate=rate, pitch=pitch).stream():
                if c["type"] == "audio":
                    got += c["data"]
            if len(got) > 500:
                return v
        except Exception as e:
            print(f"  Stimme {v} geht nicht: {e}", flush=True)
    return None


async def build(arg, deadline):
    spec, _, lv = arg.partition(":")
    lang, _, var = spec.partition("@")
    levels = set(lv.upper().split(",")) if lv else None
    rate, pitch = "+0%", "+0Hz"
    if var:
        cfg = VARIANTS.get(var, {})
        rate, pitch = cfg.get("_rate", rate), cfg.get("_pitch", pitch)
        voice = await pick_voice(cfg.get(lang, []), rate, pitch)
    else:
        voice = VOICES.get(lang)
    texts = texts_for(lang, levels)
    if not voice or not texts:
        print(f"{spec}: keine Wortliste/Stimme – übersprungen")
        return True
    folder = os.path.join(AUDIO_DIR, f"{lang}-{var}" if var else lang)
    os.makedirs(folder, exist_ok=True)
    todo = [(t, os.path.join(folder, audio_key(t) + ".mp3")) for t in texts]
    todo = [(t, p) for t, p in todo if not os.path.exists(p)]
    print(f"{spec}: {len(texts)} Texte, {len(todo)} fehlen noch ({voice} {rate} {pitch})", flush=True)
    sem = asyncio.Semaphore(PARALLEL)
    stats = {"ok": 0, "fail": 0}
    done = True
    batch = 200
    for i in range(0, len(todo), batch):
        if deadline and time.time() > deadline:
            print(f"{spec}: Zeitlimit erreicht – Rest beim nächsten Lauf", flush=True)
            done = False
            break
        await asyncio.gather(*(one(t, voice, p, sem, stats, rate, pitch) for t, p in todo[i : i + batch]))
        print(f"  {spec}: {min(i + batch, len(todo))}/{len(todo)}", flush=True)
        checkpoint(folder, voice)
    # Verzeichnis der vorhandenen Aufnahmen für die App
    keys = write_index(folder, voice)
    print(f"{spec}: {stats['ok']} neu, {stats['fail']} Fehler, {len(keys)} gesamt", flush=True)
    return done


async def main():
    args = sys.argv[1:] or ["all"]
    langs = list(VOICES) if args == ["all"] else args
    deadline = time.time() + MAX_MIN * 60 if MAX_MIN else 0
    for arg in langs:
        if not await build(arg, deadline):
            break


if __name__ == "__main__":
    asyncio.run(main())
