#!/usr/bin/env bash
# Installiert OpenVoice V2 (Klangfarben-Umwandlung, MIT-Lizenz) auf einem GitHub-Runner
set -e
sudo apt-get -qq update && sudo apt-get -qq install -y ffmpeg
pip install -q torch==2.3.1 torchaudio==2.3.1 --index-url https://download.pytorch.org/whl/cpu
pip install -q "numpy<2" librosa==0.10.2 soundfile inflect unidecode eng_to_ipa pypinyin cn2an jieba langid
pip install -q wavmark || true
pip install -q --no-deps git+https://github.com/myshell-ai/OpenVoice.git
mkdir -p ckpt/converter
HF=https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter
curl -fsSL -o ckpt/converter/config.json $HF/config.json
curl -fsSL -o ckpt/converter/checkpoint.pth $HF/checkpoint.pth
