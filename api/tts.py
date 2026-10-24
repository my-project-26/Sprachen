# Natürliche Stimme für Texte ohne fertige Aufnahme (KI-Gespräch, Geschichten).
# GET /api/tts?l=en&t=Hello → MP3 (Microsoft-Neuralstimme über edge-tts). Ergebnisse werden lange zwischengespeichert.
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import asyncio

import edge_tts

VOICES = {
    "en": "en-US-AvaNeural",
    "es": "es-ES-ElviraNeural",
    "it": "it-IT-ElsaNeural",
    "fr": "fr-FR-DeniseNeural",
    "pl": "pl-PL-ZofiaNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "ja": "ja-JP-NanamiNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ko": "ko-KR-SunHiNeural",
    "hi": "hi-IN-SwaraNeural",
    "de": "de-DE-KatjaNeural",
}


async def speak(text, voice):
    buf = b""
    async for c in edge_tts.Communicate(text, voice).stream():
        if c["type"] == "audio":
            buf += c["data"]
    return buf


class handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        text = (q.get("t", [""])[0] or "").strip()[:600]
        voice = VOICES.get((q.get("l", ["en"])[0] or "en")[:2], VOICES["en"])
        if not text:
            self.send_response(400)
            self._cors()
            self.end_headers()
            return
        try:
            audio = asyncio.run(speak(text, voice))
        except Exception as e:  # Dienst nicht erreichbar
            self.send_response(502)
            self._cors()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(str(e).encode("utf-8")[:300])
            return
        self.send_response(200 if audio else 502)
        self._cors()
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Cache-Control", "public, max-age=86400, s-maxage=31536000")
        self.end_headers()
        self.wfile.write(audio)
