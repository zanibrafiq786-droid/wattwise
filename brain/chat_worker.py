"""
chat_worker.py -- CHATBOT_SOLAR.md Part A chat backend.

Run this on the laptop (python chat_worker.py) while demoing the Chat tab.
Polls /users/{uid}/chat/requests for new messages, builds a real-data
context (chat_context.py), asks Gemini, and writes the reply back to
/users/{uid}/chat/replies. The AI API key never leaves this machine.

NOTE on scope: CHATBOT_SOLAR.md A2 describes reading
/ingest/{uid}/{deviceKey}/events (the multi-user data layout from
SETUP_WIZARD.md Step 2, not built yet). This reads the existing
single-room /room1/events, /bills, /config instead -- see chat_context.py.

Polling instead of a live Firebase stream listener, by explicit time
tradeoff: simpler to get right under this deadline, and a demo only needs
~2 second latency, not sub-second.
"""
import json
import os
import re
import time
from datetime import datetime

from dotenv import load_dotenv
from firebase_admin import db
from google import genai
from pathlib import Path

from chat_context import build_context
from firebase_db import get_app

BRAIN_DIR = Path(__file__).parent
load_dotenv(BRAIN_DIR / ".env")

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
POLL_SECONDS = 2

SYSTEM_PROMPT = """You are the in-app assistant for WattWise, an electricity usage app for one \
household in Pakistan. Follow these rules exactly:

1. Answer in the SAME language the user wrote in (English, Urdu, or Roman Urdu). Keep it short \
and practical -- a few sentences, not an essay.
2. Use ONLY the data given to you below as DATA. Never use outside knowledge of electricity \
tariffs, slab rates, or prices -- those change and vary by DISCO. If something needed to answer \
is missing from DATA, say plainly what's missing and ask exactly ONE clarifying question.
3. Every number in your answer must come from DATA. When a number is an estimate (which most of \
these are -- they come from presence sensing and on/off state, not a real power meter), call it \
an estimate and give a range when DATA provides one. Never state a sensor-derived number as exact.
4. You are not a financial or legal adviser. For electricity bill disputes or official tariff \
questions, suggest checking official FESCO/NEPRA channels, not your own guess.
5. Where it makes sense, suggest ONE concrete action (e.g. "turn the fan off when the room is \
empty"), not just facts.
6. If DATA.simulated is true, mention that the figures are from simulated/demo data, not a real \
bill.

Respond with ONLY a single JSON object, no markdown fences, no extra text:
{
  "text": "your reply",
  "suggestions": ["follow-up question 1", "follow-up question 2", "follow-up question 3"]
}
"""


def extract_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return json.loads(cleaned)


def answer(client, user_text: str, lang: str) -> dict:
    context = build_context()
    prompt = (
        f"{SYSTEM_PROMPT}\n\nDATA (JSON):\n{json.dumps(context, indent=2)}\n\n"
        f"User's preferred language code: {lang or 'auto-detect from their message'}\n"
        f"User's message: {user_text}"
    )
    response = client.models.generate_content(model=MODEL, contents=[prompt])
    try:
        parsed = extract_json(response.text)
    except (json.JSONDecodeError, AttributeError):
        # Fall back to plain text rather than losing the reply entirely.
        parsed = {"text": response.text or "Sorry, I couldn't process that.", "suggestions": []}
    return parsed


def process_request(client, uid: str, req_id: str, req: dict):
    text = req.get("text", "")
    lang = req.get("lang", "")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {uid[:8]}... asked: {text!r}")
    try:
        reply = answer(client, text, lang)
        status = "ok"
    except Exception as e:
        print(f"  error: {e}")
        reply = {"text": "Sorry, something went wrong answering that. Please try again.", "suggestions": []}
        status = "error"

    db.reference(f"/users/{uid}/chat/replies/{req_id}").set(
        {
            "text": reply.get("text", ""),
            "suggestions": reply.get("suggestions", [])[:3],
            "ts": int(time.time() * 1000),
            "status": status,
        }
    )
    print(f"  replied ({status}).")


def main():
    get_app()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is not set in brain/.env")
        return
    client = genai.Client(api_key=api_key)

    handled = set()
    print(f"chat_worker.py running (model={MODEL}), polling every {POLL_SECONDS}s. Ctrl+C to stop.")

    while True:
        try:
            users = db.reference("/users").get() or {}
            for uid, udata in users.items():
                requests = ((udata or {}).get("chat") or {}).get("requests") or {}
                replies = ((udata or {}).get("chat") or {}).get("replies") or {}
                for req_id, req in requests.items():
                    key = (uid, req_id)
                    if key in handled or req_id in replies:
                        handled.add(key)
                        continue
                    process_request(client, uid, req_id, req)
                    handled.add(key)
        except Exception as e:
            print(f"Poll error: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
