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


def levels():
    """Nur bestimmte Niveaus, z. B. CL_LEVELS=A1 oder A1,A2 (leer = alle)."""
    v = os.environ.get("CL_LEVELS", "").strip()
    return set(v.upper().replace(" ", "").split(",")) if v else None


def ref_path(voice, lang):
    return os.path.join(ROOT, "voices", "ref-gemini", f"{voice}-{lang}.wav")


_model = None


def model():
    global _model
    if _model is None:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        _model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    return _model


def clean(x, sr, male=False):
    """Störgeräusche der Klon-Stimme entfernen: lautes Brummen/Rumpeln (Energie fast nur < 120 Hz)
    und lange Zisch-/Rauschstrecken (fast nur > 4 kHz); Nachklang/Gemurmel am Anfang und Ende abschneiden.
    Rückgabe: (Audio, Anteil entfernter Störungen 0–1)."""
    import numpy as np
    W, H = int(0.04 * sr), int(0.01 * sr)
    f = np.fft.rfftfreq(W, 1 / sr)
    n = max(1, (len(x) - W) // H + 1)
    noise = np.zeros(n, bool)
    kind = np.zeros(n, int)
    en = np.zeros(n)
    for i in range(n):
        w = x[i * H : i * H + W]
        if len(w) < W:
            w = np.pad(w, (0, W - len(w)))
        sp = np.abs(np.fft.rfft(w * np.hanning(W))) ** 2 + 1e-12
        tot = sp.sum()
        en[i] = tot
        # Männerstimmen haben ihren Grundton um 100 Hz → Grenze tiefer und strenger
        low, hi = sp[f < (75 if male else 120)].sum() / tot, sp[f > 4000].sum() / tot
        if low > (0.6 if male else 0.45):
            noise[i], kind[i] = True, 1
        elif hi > 0.7:
            noise[i], kind[i] = True, 2
    db = 10 * np.log10(en / en.max())
    noise &= db > -50
    keep = np.ones(len(x), bool)
    removed = 0
    i = 0
    while i < n:
        if not noise[i]:
            i += 1
            continue
        j = i
        while j < n and noise[j]:
            j += 1
        lim = 0.06 if (kind[i:j] == 1).mean() > 0.5 else 0.22  # Rumpeln ab 60 ms, Zischen ab 220 ms (ein „s“ ist kürzer)
        if (j - i) * 0.01 >= lim:
            a, b = i * H, min(len(x), j * H + W)
            keep[a:b] = False
            removed += b - a
        i = j
    # Entfernte Strecken: innen 0,12 s Pause, am Rand ganz weg
    out, i, L = [], 0, len(x)
    while i < L:
        j = i
        while j < L and keep[j] == keep[i]:
            j += 1
        seg = x[i:j] if keep[i] else np.zeros(0 if i == 0 or j >= L else int(0.12 * sr), np.float32)
        out.append(seg)
        i = j
    y = np.concatenate(out) if out else x
    # Anfang/Ende: alles leiser als 32 dB unter der lautesten Stelle weg (Nachklang, Gemurmel)
    m = max(1, (len(y) - W) // H + 1)
    e = np.array([np.sum(y[k * H : k * H + W] ** 2) + 1e-12 for k in range(m)])
    loud = np.where(10 * np.log10(e / e.max()) > -32)[0]
    if len(loud):
        a = max(0, loud[0] * H - int(0.06 * sr))
        b = min(len(y), loud[-1] * H + W + int(0.12 * sr))
        y = y[a:b]
    return y.astype(np.float32), removed / max(1, len(x))


def synth(text, lang, ref, out_mp3, male=False):
    """Spricht den Text in der Klon-Stimme. Bei starken Störungen bis zu 3 neue Versuche, der sauberste gewinnt."""
    import numpy as np
    import torch
    m = model()
    best = None
    words = max(1, len(text.split()))
    # Sehr kurze Wörter („I“, „a“, „own“) liefern sonst manchmal nichts: mit Satzzeichen sprechen lassen
    say = text if len(text) > 4 or text[-1:] in ".!?" else text + "."
    for attempt in range(5):
        try:
            torch.manual_seed(1234 + attempt * 7919)
            wav = m.generate(say, language_id=lang, audio_prompt_path=ref, exaggeration=0.5, cfg_weight=0.5,
                             temperature=0.7 if attempt < 2 else 0.6)
            x = wav.squeeze().cpu().numpy().astype(np.float32)
        except Exception as e:
            print(f"  Versuch {attempt + 1} für {text!r}: {e}", flush=True)
            continue
        if len(x) < m.sr * 0.1:
            continue
        y, rem = clean(x, m.sr, male)
        if len(y) < m.sr * 0.15:  # Filter hat zu viel weggenommen → ungefiltert, nur Ränder kürzen
            y, rem = x, 0.3
        dur = len(y) / m.sr
        bad = rem + (0.5 if dur > 1.5 + words * 0.9 else 0)
        if best is None or bad < best[0]:
            best = (bad, y)
        if bad < 0.15:
            break
    if best is None:
        raise RuntimeError("keine brauchbare Aufnahme")
    y = best[1]
    hp = 70 if male else 100
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(m.sr), "-ac", "1", "-i", "-", "-af",
                    f"highpass=f={hp},afftdn=nr=10:nf=-50,loudnorm=I=-18:TP=-2", "-ac", "1", "-ar", "24000", "-b:a", "48k", out_mp3],
                   input=y.tobytes(), check=True)
    return best[0]


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
    for lang in os.environ.get("PROBE_LANGS", "en it es").split():
        ref = ref_path(voice, lang)
        sents = [t for t in texts_for(lang, {"A1"}) if t.count(" ") >= 3][: int(os.environ.get("PROBE_N", "5"))]
        parts, sims = [], []
        for i, t in enumerate(sents):
            out = f"/tmp/{voice}-{lang}-{i}.mp3"
            t0 = time.time()
            bad = synth(t, lang, ref, out, voice.startswith("m"))
            sims.append(similarity(ref, out))
            report.append(f"{lang} {time.time() - t0:5.1f}s  Ähnlichkeit {sims[-1]:.2f}  Störanteil {bad:.2f}  {t}")
            print(report[-1], flush=True)
            parts.append(out)
        lst = "/tmp/cat.txt"
        with open(lst, "w") as f:
            f.writelines(f"file '{p}'\n" for p in parts)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-b:a", "64k", f"probe/{voice}-{lang}{os.environ.get('PROBE_TAG', '')}.mp3"], check=True)
        report.append(f"{lang}: mittlere Ähnlichkeit {sum(sims) / len(sims):.2f}")
    open(f"probe/{voice}-bericht{os.environ.get('PROBE_TAG', '')}.txt", "w").write("\n".join(report) + "\n")


def run(voice, lang, outdir):
    shard, n = (int(x) for x in os.environ.get("OV_SHARD", "0/1").split("/"))
    # Niveau für Niveau: erst alle A1, dann A2 … (jedes Niveau auf alle Teile verteilt)
    order, seen = [], set()
    for lv in sorted(levels() or {"A1", "A2", "B1", "B2", "C1"}):
        for t in texts_for(lang, {lv}):
            if t not in seen:
                seen.add(t)
                order.append(t)
    for t in texts_for(lang, levels()):  # Rest (z. B. Begrüßung)
        if t not in seen:
            seen.add(t)
            order.append(t)
    texts = [t for i, t in enumerate(order) if i % n == shard]
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
            synth(t, lang, ref, os.path.join(outdir, audio_key(t) + ".mp3"), voice.startswith("m"))
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
    texts = texts_for(lang, levels())
    ref = ref_path(voice, lang)
    missing, broken, odd, sims, long_ones = [], [], [], [], set()
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
        if d > 2.5 + words * 1.2:  # auffällig lang → im Bericht, Stimme wird geprüft
            odd.append(t)
            long_ones.add(t)
        if i % 25 == 0 or d > 2.5 + words * 1.2:
            s = similarity(ref, p)
            sims.append(s)
            if s < 0.65:
                odd.append(t)
                long_ones.discard(t)
    rep = {
        "stimme": voice, "sprache": lang, "texte": len(texts), "fehlen": len(missing), "kaputt": len(broken),
        "auffaellig": sorted(set(odd)), "aehnlichkeit_mittel": round(sum(sims) / max(1, len(sims)), 3),
        "aehnlichkeit_min": round(min(sims), 3) if sims else None, "geprueft": len(sims),
        "beispiele_fehlend": missing[:20],
    }
    os.makedirs("probe", exist_ok=True)
    json.dump(rep, open(f"probe/pruefung-{voice}-{lang}.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in rep.items() if k != "auffaellig"}, ensure_ascii=False), "auffällig:", len(rep["auffaellig"]))
    # Kaputte oder fremd klingende Aufnahmen neu erzeugen lassen (Datei löschen → nächster Lauf macht sie neu).
    # Jede Datei höchstens einmal, damit sich nichts endlos wiederholt.
    log = os.path.join(outdir, ".neu-erzeugt.txt")
    done = set(open(log).read().split()) if os.path.exists(log) else set()
    redo = []
    for t in set(broken) | {t for t in odd if t not in long_ones}:
        k = audio_key(t)
        if k in done:
            continue
        try:
            os.remove(os.path.join(outdir, k + ".mp3"))
            redo.append(k)
        except FileNotFoundError:
            pass
    if redo:
        with open(log, "a") as f:
            f.write("\n".join(redo) + "\n")
    print(f"neu zu erzeugen: {len(redo)}")

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "probe":
        probe(sys.argv[2])
    elif cmd == "run":
        run(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "check":
        check(sys.argv[2], sys.argv[3], sys.argv[4])
