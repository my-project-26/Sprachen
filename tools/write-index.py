#!/usr/bin/env python3
"""index.json für alle Stimmordner <lang>-<stimme>/ schreiben: python tools/write-index.py <audio-ordner> <lang>"""
import json, os, sys

root, lang = sys.argv[1], sys.argv[2]
for d in sorted(os.listdir(root)):
    p = os.path.join(root, d)
    if not (os.path.isdir(p) and d.startswith(lang + "-")):
        continue
    keys = sorted(f[:-4] for f in os.listdir(p) if f.endswith(".mp3"))
    old = {}
    try:
        old = json.load(open(os.path.join(p, "index.json")))
    except Exception:
        pass
    with open(os.path.join(p, "index.json"), "w") as f:
        json.dump({"voice": old.get("voice") or d, "keys": keys}, f, separators=(",", ":"))
    print(d, len(keys))
