#!/usr/bin/env python3
"""
Aufnahmen in einer eigenen Stimme erzeugen (Stimm-Klonung mit Chatterbox, MIT-Lizenz).
Vorbild je Sprache: voices/ref-gemini/<stimme>-<lang>.wav (Hörprobe der gewählten Stimme).

  python tools/clone.py probe <stimme>                  # Probe en/it/es + Ähnlichkeitsbericht → probe/
  python tools/clone.py run <stimme> <lang> <outdir>    # alle Wörter/Sätze (OV_SHARD=i/n, CL_MAX_MIN, CL_PUSH_MIN)
  python tools/clone.py check <stimme> <lang> <outdir>  # Prüfung: jede Aufnahme vorhanden, lesbar, richtige Stimme
"""
import json, os, random, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_mp = os.path.join(ROOT, "tools", "make-audio.py")
_ma = {"__name__": "ma", "__file__": _mp}
exec(compile(open(_mp, encoding="utf-8").read().replace("import edge_tts", "edge_tts = None"), _mp, "exec"), _ma)
texts_for, audio_key = _ma["texts_for"], _ma["audio_key"]


def ref_path(voice, lang):
    return os.path.join(ROOT, "voices", "ref-gemini", f"{voice}-{lang}.wav")


_model = None


def model():
    global _model
    if _model is None:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        _model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    return _model


def synth(text, lang, ref, out_mp3):
    import torchaudio
    m = model()
    wav = m.generate(text, language_id=lang, audio_prompt_path=ref, exaggeration=0.5, cfg_weight=0.5, temperature=0.7)
    tmp = out_mp3 + ".wav"
    torchaudio.save(tmp, wav, m.sr)
    # Stille an Anfang/Ende kürzen, Lautstärke angleichen, wie die übrigen Aufnahmen: 24 kHz mono 48 kbit/s
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp, "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-18:TP=-2",
                    "-ac", "1", "-ar", "24000", "-b:a", "48k", out_mp3], check=True)
    os.remove(tmp)


_enc = None


def similarity(a, b):
    """Stimm-Ähnlichkeit zweier Dateien (0–1, Resemblyzer). Gleiche Person ≈ 0,75+, fremde ≈ 0,5–0,65."""
    global _enc
    from resemblyzer import VoiceEncoder, preprocess_wav
    import numpy as np
    _enc = _enc or VoiceEncoder("cpu", verbose=False)
    ea, eb = (_enc.embed_utterance(preprocess_wav(x)) for x in (a, b))
    return float(np.dot(ea, eb) / (np.linalg.norm(ea) * np.linalg.norm(eb)))


def duration(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def push(path, msg):
    run = lambda *a: subprocess.run(a, check=False, capture_output=True).returncode
    run("git", "add", path)
    if run("git", "diff", "--cached", "--quiet") == 0:
        return
    run("git", "commit", "-q", "-m", msg)
    for _ in range(10):
        run("git", "pull", "-q", "--rebase", "-X", "theirs", "origin", "main")
        if run("git", "push", "-q", "origin", "HEAD:main") == 0:
            print("  ↑ hochgeladen", flush=True)
            return
        time.sleep(5 + 15 * random.random())
    print("  ! Hochladen fehlgeschlagen", flush=True)


def probe(voice):
    os.makedirs("probe", exist_ok=True)
    report = []
    for lang in ("en", "it", "es"):
        ref = ref_path(voice, lang)
        sents = [t for t in texts_for(lang, {"A1"}) if t.count(" ") >= 3][:5]
        parts, sims = [], []
        for i, t in enumerate(sents):
            out = f"/tmp/{voice}-{lang}-{i}.mp3"
            t0 = time.time()
            synth(t, lang, ref, out)
            sims.append(similarity(ref, out))
            report.append(f"{lang} {time.time() - t0:5.1f}s  Ähnlichkeit {sims[-1]:.2f}  {t}")
            print(report[-1], flush=True)
            parts.append(out)
        lst = "/tmp/cat.txt"
        with open(lst, "w") as f:
            f.writelines(f"file '{p}'\n" for p in parts)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-b:a", "64k", f"probe/{voice}-{lang}.mp3"], check=True)
        report.append(f"{lang}: mittlere Ähnlichkeit {sum(sims) / len(sims):.2f}")
    open(f"probe/{voice}-bericht.txt", "w").write("\n".join(report) + "\n")


def run(voice, lang, outdir):
    shard, n = (int(x) for x in os.environ.get("OV_SHARD", "0/1").split("/"))
    texts = [t for i, t in enumerate(texts_for(lang)) if i % n == shard]
    os.makedirs(outdir, exist_ok=True)
    todo = [t for t in texts if not os.path.exists(os.path.join(outdir, audio_key(t) + ".mp3"))]
    print(f"{outdir} Teil {shard + 1}/{n}: {len(todo)} von {len(texts)} fehlen", flush=True)
    ref = ref_path(voice, lang)
    limit = time.time() + float(os.environ.get("CL_MAX_MIN", "300")) * 60
    every = float(os.environ.get("CL_PUSH_MIN", "0") or 0) * 60
    last = time.time()
    for i, t in enumerate(todo):
        if time.time() > limit:
            print("Zeitlimit – Rest beim nächsten Lauf", flush=True)
            break
        try:
            synth(t, lang, ref, os.path.join(outdir, audio_key(t) + ".mp3"))
        except Exception as e:
            print(f"  ✗ {t[:40]!r}: {e}", flush=True)
        if i % 50 == 0:
            print(f"  {i}/{len(todo)}", flush=True)
        if every and time.time() - last > every:
            last = time.time()
            push(outdir, f"Stimme {voice}: {lang}")
    if every:
        push(outdir, f"Stimme {voice}: {lang}")


def check(voice, lang, outdir):
    """Forensische Prüfung: jede Aufnahme da, lesbar, plausible Länge, Stimme passt (Stichprobe je 25. Datei + alle Auffälligen)."""
    texts = texts_for(lang)
    ref = ref_path(voice, lang)
    missing, broken, odd, sims = [], [], [], []
    for i, t in enumerate(texts):
        p = os.path.join(outdir, audio_key(t) + ".mp3")
        if not os.path.exists(p):
            missing.append(t)
            continue
        d = duration(p)
        words = max(1, len(t.split()))
        if d < 0.25:
            broken.append(t)
            continue
        if d > 2.5 + words * 1.2:  # viel zu lang → vermutlich Gestammel
            odd.append(t)
        if i % 25 == 0 or d > 2.5 + words * 1.2:
            s = similarity(ref, p)
            sims.append(s)
            if s < 0.65:
                odd.append(t)
    rep = {
        "stimme": voice, "sprache": lang, "texte": len(texts), "fehlen": len(missing), "kaputt": len(broken),
        "auffaellig": sorted(set(odd)), "aehnlichkeit_mittel": round(sum(sims) / max(1, len(sims)), 3),
        "aehnlichkeit_min": round(min(sims), 3) if sims else None, "geprueft": len(sims),
        "beispiele_fehlend": missing[:20],
    }
    os.makedirs("probe", exist_ok=True)
    json.dump(rep, open(f"probe/pruefung-{voice}-{lang}.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in rep.items() if k != "auffaellig"}, ensure_ascii=False), "auffällig:", len(rep["auffaellig"]))
    # Auffällige neu erzeugen lassen: Datei löschen, damit der nächste Lauf sie neu macht
    for t in set(odd) | set(broken):
        try:
            os.remove(os.path.join(outdir, audio_key(t) + ".mp3"))
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "probe":
        probe(sys.argv[2])
    elif cmd == "run":
        run(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "check":
        check(sys.argv[2], sys.argv[3], sys.argv[4])
