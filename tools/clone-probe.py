# Echte Stimm-Klonung (Chatterbox, MIT-Lizenz): kurze Probe je Referenzstimme
import glob, os, subprocess, sys
import torch, torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

TEXTS = [
    "We ordered a pizza.",
    "What's your email address?",
    "The station is close to the hotel.",
    "I'm very busy today.",
    "It's a difficult question.",
]
model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
os.makedirs("probe", exist_ok=True)
for ref in sorted(glob.glob("voices/ref/*.mp3")):
    name = os.path.basename(ref)[:-4]
    clean = f"/tmp/{name}.wav"
    # Stille am Anfang weg, Lautstärke angleichen, 12 Sekunden als Vorbild
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", ref, "-af",
                    "silenceremove=start_periods=1:start_threshold=-40dB,loudnorm", "-t", "12", "-ac", "1", "-ar", "24000", clean], check=True)
    parts = []
    for i, t in enumerate(TEXTS):
        wav = model.generate(t, language_id="en", audio_prompt_path=clean, exaggeration=0.5, cfg_weight=0.5)
        p = f"/tmp/{name}_{i}.wav"
        torchaudio.save(p, wav, model.sr)
        parts.append(p)
        print(name, t, flush=True)
    lst = f"/tmp/{name}.txt"
    open(lst, "w").writelines(f"file '{p}'\n" for p in parts)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-t", "16", "-ac", "1", "-b:a", "64k", f"probe/klon-{name}.mp3"], check=True)
