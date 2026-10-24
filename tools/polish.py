#!/usr/bin/env python3
"""Vorhandene Klon-Aufnahmen nachbearbeiten: Rauschen/Gemurmel am Anfang und Ende abschneiden.
  python tools/polish.py <lang> <ordner> [<ordner> …]   (Dateien werden nur ersetzt, wenn sich etwas ändert)"""
import importlib.util, os, subprocess, sys
import numpy as np

spec = importlib.util.spec_from_file_location("clone", os.path.join(os.path.dirname(os.path.abspath(__file__)), "clone.py"))
clone = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clone)
SR = 24000


def load(p):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


lang = sys.argv[1]
short = {clone.audio_key(t) for t in clone.texts_for(lang) if clone.is_short(t)}

for folder in sys.argv[2:]:
    files = sorted(f for f in os.listdir(folder) if f.endswith(".mp3"))
    changed = cut = 0
    for i, f in enumerate(files):
        p = os.path.join(folder, f)
        x = load(p)
        if len(x) < SR * 0.1:
            continue
        y = clone.trim_edges(clone.noise_blocks(x, SR), SR)
        if f[:-4] in short:
            y = clone.cut_after_pause(y, SR)
        if len(x) - len(y) < SR * 0.08:  # weniger als 0,08 s → so lassen
            continue
        tmp = p + ".tmp.mp3"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-b:a", "48k", tmp], input=y.tobytes(), check=True)
        os.replace(tmp, p)
        changed += 1
        cut += (len(x) - len(y)) / SR
        if i % 500 == 0:
            print(f"  {folder}: {i}/{len(files)}", flush=True)
    print(f"{folder}: {changed} von {len(files)} gekürzt, zusammen {cut:.0f} s Störgeräusch entfernt")
