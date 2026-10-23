#!/usr/bin/env python3
"""
Gibt fertigen Aufnahmen (edge-tts) die Klangfarbe einer Referenzstimme (OpenVoice V2, MIT-Lizenz).

  python tools/voice-convert.py se   <name> <ref.mp3>                 # Stimmprofil berechnen → voices/se/<name>.pth
  python tools/voice-convert.py probe <name> <list.json> <srcdir>     # Probe: probe/<name>.mp3 + probe/original.mp3
  python tools/voice-convert.py run  <name> <srcdir> <outdir>         # alle Aufnahmen eines Ordners umwandeln
"""
import glob, json, os, subprocess, sys, tempfile, time

import torch
from openvoice.api import ToneColorConverter

CK = os.environ.get("OV_CKPT", "ckpt/converter")
TAU = float(os.environ.get("OV_TAU", "0.3"))


def sh(*a):
    subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def load():
    try:
        c = ToneColorConverter(f"{CK}/config.json", device="cpu", enable_watermark=False)
    except TypeError:
        c = ToneColorConverter(f"{CK}/config.json", device="cpu")
    c.load_ckpt(f"{CK}/checkpoint.pth")
    return c


def to_wav(src, dst, sr=22050):
    sh("ffmpeg", "-y", "-i", src, "-ac", "1", "-ar", str(sr), dst)


def chunks(src, tmp, sec=8):
    """Referenz in Stücke teilen (das Stimmprofil wird über alle gemittelt)."""
    sh("ffmpeg", "-y", "-i", src, "-ac", "1", "-ar", "22050", "-f", "segment", "-segment_time", str(sec), f"{tmp}/ref%03d.wav")
    return sorted(glob.glob(f"{tmp}/ref*.wav"))


def source_se(conv, srcdir, tmp, n=40):
    """Stimmprofil der Ausgangsstimme aus vielen ihrer Aufnahmen."""
    files = sorted(glob.glob(f"{srcdir}/*.mp3"))[:n]
    wavs = []
    for i in range(0, len(files), 10):
        lst = f"{tmp}/l{i}.txt"
        with open(lst, "w") as f:
            f.writelines(f"file '{os.path.abspath(x)}'\n" for x in files[i : i + 10])
        out = f"{tmp}/src{i}.wav"
        sh("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-ac", "1", "-ar", "22050", out)
        wavs.append(out)
    return conv.extract_se(wavs)


def convert_one(conv, src_mp3, out_mp3, src_se, tgt_se, tmp):
    w = f"{tmp}/in.wav"
    o = f"{tmp}/out.wav"
    to_wav(src_mp3, w)
    conv.convert(audio_src_path=w, src_se=src_se, tgt_se=tgt_se, output_path=o, tau=TAU)
    sh("ffmpeg", "-y", "-i", o, "-ac", "1", "-ar", "24000", "-b:a", "48k", out_mp3)


def main():
    cmd, name = sys.argv[1], sys.argv[2]
    conv = load()
    os.makedirs("voices/se", exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        if cmd == "se":
            se = conv.extract_se(chunks(sys.argv[3], tmp))
            torch.save(se.cpu(), f"voices/se/{name}.pth")
            print("Stimmprofil gespeichert")
            return
        tgt = torch.load(f"voices/se/{name}.pth")
        if cmd == "probe":
            items, srcdir = json.load(open(sys.argv[3])), sys.argv[4]
            src_se = source_se(conv, srcdir, tmp)
            torch.save(src_se.cpu(), f"voices/se/_src.pth")
            os.makedirs("probe", exist_ok=True)
            gap = f"{tmp}/gap.mp3"
            sh("ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.7", "-b:a", "48k", gap)
            outs, origs = [], []
            for i, (text, key) in enumerate(items):
                o = f"{tmp}/p{i:02d}.mp3"
                t0 = time.time()
                convert_one(conv, f"{srcdir}/{key}.mp3", o, src_se, tgt, tmp)
                print(f"  {text}  ({time.time() - t0:.1f} s)", flush=True)
                outs += [o, gap]
                origs += [f"{srcdir}/{key}.mp3", gap]
            for files, dst in ((outs, f"probe/{name}.mp3"), (origs, "probe/original.mp3")):
                lst = f"{tmp}/cat.txt"
                with open(lst, "w") as f:
                    f.writelines(f"file '{os.path.abspath(x)}'\n" for x in files)
                sh("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-ac", "1", "-ar", "24000", "-b:a", "64k", dst)
            print("Probe fertig")
            return
        if cmd == "run":
            srcdir, outdir = sys.argv[3], sys.argv[4]
            os.makedirs(outdir, exist_ok=True)
            src_se = source_se(conv, srcdir, tmp)
            files = sorted(glob.glob(f"{srcdir}/*.mp3"))
            todo = [f for f in files if not os.path.exists(os.path.join(outdir, os.path.basename(f)))]
            print(f"{len(todo)} von {len(files)} fehlen", flush=True)
            limit = time.time() + float(os.environ.get("OV_MAX_MIN", "300")) * 60
            for i, f in enumerate(todo):
                if time.time() > limit:
                    break
                convert_one(conv, f, os.path.join(outdir, os.path.basename(f)), src_se, tgt, tmp)
                if i % 200 == 0:
                    print(f"  {i}/{len(todo)}", flush=True)


if __name__ == "__main__":
    main()
