#!/usr/bin/env python3
"""
Erzeugt natürliche Sprachaufnahmen (Microsoft-Neuralstimmen über edge-tts)
für alle Wörter und Beispielsätze einer Sprache.

  pip install edge-tts
  python tools/make-audio.py es          # nur Spanisch
  python tools/make-audio.py en es       # mehrere
  python tools/make-audio.py all         # alle Sprachen mit Wortliste

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
}

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


def texts_for(lang):
    js = os.path.join(ROOT, "js")
    if lang == "en":
        rows = rows_from(os.path.join(js, "words.js"), "const RAW = [")
        rows += rows_from(os.path.join(js, "wordbank.js"))
    else:
        p = os.path.join(js, f"wordbank.{lang}.js")
        if not os.path.exists(p):
            return []
        rows = rows_from(p)
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


async def one(text, voice, path, sem, stats):
    async with sem:
        for attempt in range(4):
            try:
                tmp = path + ".part"
                await edge_tts.Communicate(text, voice).save(tmp)
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


async def build(lang, deadline):
    voice = VOICES.get(lang)
    texts = texts_for(lang)
    if not voice or not texts:
        print(f"{lang}: keine Wortliste/Stimme – übersprungen")
        return True
    folder = os.path.join(ROOT, "audio", lang)
    os.makedirs(folder, exist_ok=True)
    todo = [(t, os.path.join(folder, audio_key(t) + ".mp3")) for t in texts]
    todo = [(t, p) for t, p in todo if not os.path.exists(p)]
    print(f"{lang}: {len(texts)} Texte, {len(todo)} fehlen noch ({voice})", flush=True)
    sem = asyncio.Semaphore(PARALLEL)
    stats = {"ok": 0, "fail": 0}
    done = True
    batch = 200
    for i in range(0, len(todo), batch):
        if deadline and time.time() > deadline:
            print(f"{lang}: Zeitlimit erreicht – Rest beim nächsten Lauf", flush=True)
            done = False
            break
        await asyncio.gather(*(one(t, voice, p, sem, stats) for t, p in todo[i : i + batch]))
        print(f"  {lang}: {min(i + batch, len(todo))}/{len(todo)}", flush=True)
    # Verzeichnis der vorhandenen Aufnahmen für die App
    keys = sorted(f[:-4] for f in os.listdir(folder) if f.endswith(".mp3"))
    with open(os.path.join(folder, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"voice": voice, "keys": keys}, f, separators=(",", ":"))
    print(f"{lang}: {stats['ok']} neu, {stats['fail']} Fehler, {len(keys)} gesamt", flush=True)
    return done


async def main():
    args = sys.argv[1:] or ["all"]
    langs = list(VOICES) if args == ["all"] else args
    deadline = time.time() + MAX_MIN * 60 if MAX_MIN else 0
    for lang in langs:
        if not await build(lang, deadline):
            break


if __name__ == "__main__":
    asyncio.run(main())
