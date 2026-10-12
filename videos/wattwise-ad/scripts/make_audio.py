"""Generates the voice-over lines (Gemini TTS) and the music bed (Lyria) for
the WattWise ad. Writes WAV files into ../assets/. Key comes from
brain/.env (never committed)."""
import base64
import os
import sys
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets"
ASSETS.mkdir(exist_ok=True)
load_dotenv(HERE.parents[2] / "brain" / ".env")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

VOICE = "Charon"
TTS_MODEL = "gemini-3.8-flash-tts"
STYLE = "Read this as a warm, confident, modern product-ad narrator. Natural pace, clear, slightly upbeat: "

LINES = {
    "vo1": "Your fan is still spinning. Nobody's in the room. And you're paying for it.",
    "vo2": "Meet WattWise. It turns your home Wi-Fi into an energy sensor.",
    "vo3": "No cameras. It reads tiny ripples in the Wi-Fi signal to know when a room is empty, or when someone's there.",
    "vo4": "Leave the AC on in an empty room, and WattWise tells you what it's costing you.",
    "vo5": "Snap a photo of your electricity bill. AI reads a whole year of history in seconds.",
    "vo6": "Ask why your bill is so high, and get answers from your own data, in English or Urdu.",
    "vo7": "Then get a plan for next month, and find out if solar really pays off on your roof.",
    "vo8": "WattWise. Stop paying for empty rooms.",
}


def save_pcm_wav(path: Path, pcm: bytes, rate: int = 24000):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)


def tts(name: str, text: str):
    for attempt in range(3):
        try:
            r = client.models.generate_content(
                model=TTS_MODEL,
                contents=STYLE + text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)
                        )
                    ),
                ),
            )
            part = r.candidates[0].content.parts[0].inline_data
            data = part.data if isinstance(part.data, bytes) else base64.b64decode(part.data)
            rate = 24000
            if part.mime_type and "rate=" in part.mime_type:
                rate = int(part.mime_type.split("rate=")[1].split(";")[0])
            save_pcm_wav(ASSETS / f"{name}.wav", data, rate)
            return f"{name}: ok ({part.mime_type})"
        except Exception as e:  # noqa: BLE001
            err = e
    return f"{name}: FAILED {err}"


def music():
    prompt = (
        "A 48-second instrumental for a modern tech product launch ad about saving electricity at home. "
        "Warm, optimistic, premium electronic: soft pulsing synth bass, light clean percussion, airy pads, "
        "a subtle build in the middle and a confident resolved ending. No vocals. Steady tempo around 110 BPM."
    )
    for model in ("lyria-3.5", "lyria-3-pro-preview", "lyria-3-clip-preview"):
        try:
            r = client.models.generate_content(model=model, contents=prompt)
            for p in r.candidates[0].content.parts:
                if p.inline_data and p.inline_data.data:
                    data = p.inline_data.data if isinstance(p.inline_data.data, bytes) else base64.b64decode(p.inline_data.data)
                    mt = p.inline_data.mime_type or ""
                    ext = "mp3" if "mp3" in mt or "mpeg" in mt else ("wav" if "wav" in mt else "bin")
                    if "pcm" in mt or "L16" in mt:
                        rate = int(mt.split("rate=")[1].split(";")[0]) if "rate=" in mt else 48000
                        save_pcm_wav(ASSETS / "music.wav", data, rate)
                        return f"music: ok via {model} ({mt}) pcm"
                    (ASSETS / f"music.{ext}").write_bytes(data)
                    return f"music: ok via {model} ({mt}) -> music.{ext}"
            last = f"{model}: no audio part"
        except Exception as e:  # noqa: BLE001
            last = f"{model}: {e}"
    return f"music: FAILED {last}"


if __name__ == "__main__":
    only = sys.argv[1:]
    jobs = {k: v for k, v in LINES.items() if not only or k in only}
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = [ex.submit(tts, k, v) for k, v in jobs.items()]
        mus = ex.submit(music) if not only or "music" in only else None
        for f in futs:
            print(f.result(), flush=True)
        if mus:
            print(mus.result(), flush=True)
