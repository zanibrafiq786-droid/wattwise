"""
chat_worker.py -- CHATBOT_SOLAR.md Part A chat backend.

Run this on the laptop (python chat_worker.py) while demoing the Chat tab.
Listens (realtime) on /users/{uid}/chat/requests for new messages, builds a
real-data context (chat_context.py), asks Gemini, and writes the reply back
to /users/{uid}/chat/replies. The AI API key never leaves this machine.

Each request is answered from that account's own data only (its bills,
config and, if one is linked, its room sensor) -- see chat_context.py.
Solar requests are still polled every couple of seconds (they take far
longer to run than to notice).
"""
import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from dotenv import load_dotenv
from firebase_admin import db
from google import genai
from pathlib import Path

from chat_context import build_context
from firebase_db import get_app
from bill_scan import process_scan
from solar_worker import generate_json, poll_and_process_solar

BRAIN_DIR = Path(__file__).parent
load_dotenv(BRAIN_DIR / ".env")

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
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


def answer(client, uid: str, user_text: str, lang: str) -> dict:
    t0 = time.time()
    context = build_context(uid)  # only this account's bills/config/sensor
    print(f"  context {time.time() - t0:.1f}s", end="")
    prompt = (
        f"{SYSTEM_PROMPT}\n\nDATA (JSON):\n{json.dumps(context, indent=2)}\n\n"
        f"User's preferred language code: {lang or 'auto-detect from their message'}\n"
        f"User's message: {user_text}"
    )
    t1 = time.time()
    text = generate_json(client, MODEL, prompt)  # JSON mode + busy-model fallback
    print(f" | model {time.time() - t1:.1f}s", end="")
    try:
        parsed = extract_json(text)
    except (json.JSONDecodeError, AttributeError):
        # Fall back to plain text rather than losing the reply entirely.
        parsed = {"text": text or "Sorry, I couldn't process that.", "suggestions": []}
    return parsed


def process_request(client, uid: str, req_id: str, req: dict):
    text = req.get("text", "")
    lang = req.get("lang", "")
    waited = time.time() - req.get("ts", time.time() * 1000) / 1000
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {uid[:8]}... asked: {text!r} (picked up after {waited:.1f}s)")
    try:
        reply = answer(client, uid, text, lang)
        status = "ok"
    except Exception as e:
        print(f"  error: {e}")
        reply = {"text": "Sorry, something went wrong answering that. Please try again.", "suggestions": []}
        status = "error"

    t2 = time.time()
    db.reference(f"/users/{uid}/chat/replies/{req_id}").set(
        {
            "text": reply.get("text", ""),
            "suggestions": reply.get("suggestions", [])[:3],
            "ts": int(time.time() * 1000),
            "status": status,
        }
    )
    print(f" | write {time.time() - t2:.1f}s -> replied ({status}).")


def main():
    get_app()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is not set in brain/.env")
        return
    client = genai.Client(api_key=api_key)

    handled = set()
    solar_handled = set()
    # One job at a time: chat_context keeps "the current account" in a
    # module global, so chat and solar must not run at the same moment.
    work_lock = threading.Lock()
    pool = ThreadPoolExecutor(max_workers=1)
    listening = set()

    def handle(uid: str, req_id: str, req: dict):
        with work_lock:
            process_request(client, uid, req_id, req)

    def on_requests(uid: str, event):
        # A realtime listener instead of polling: a new question is picked
        # up the moment the phone writes it. (Polling took ~7 s per round
        # over this connection before a request was even noticed.)
        if event.data is None:
            return
        if event.path == "/":
            # First event = every existing request. Skip the ones already
            # answered (one read here, not one read per request later).
            answered = db.reference(f"/users/{uid}/chat/replies").get(shallow=True) or {}
            for rid in answered:
                handled.add((uid, rid))
            items = event.data.items() if isinstance(event.data, dict) else []
        else:
            parts = event.path.strip("/").split("/")
            items = [(parts[0], event.data)] if len(parts) == 1 else []
        for req_id, req in items:
            key = (uid, req_id)
            if key in handled or not isinstance(req, dict):
                continue
            handled.add(key)
            pool.submit(handle, uid, req_id, req)

    scan_pool = ThreadPoolExecutor(max_workers=1)
    scans_seen = set()

    def on_scans(uid: str, event):
        # Bill photos from the app (no AI key on the phone any more).
        if event.data is None:
            return
        if event.path == "/":
            items = event.data.items() if isinstance(event.data, dict) else []
        else:
            parts = event.path.strip("/").split("/")
            items = [(parts[0], event.data)] if len(parts) == 1 else []
        for scan_id, req in items:
            if not isinstance(req, dict) or "image_b64" not in req or (uid, scan_id) in scans_seen:
                continue
            scans_seen.add((uid, scan_id))
            scan_pool.submit(process_scan, client, uid, scan_id, req)

    print(f"chat_worker.py running (model={MODEL}), listening for chat and bill scans in real time. Ctrl+C to stop.")
    print("Also handling solar analysis requests (CHATBOT_SOLAR.md Part B).")

    while True:
        try:
            # New accounts get their own listener as they appear.
            for uid in db.reference("/users").get(shallow=True) or {}:
                if uid not in listening:
                    db.reference(f"/users/{uid}/chat/requests").listen(lambda e, u=uid: on_requests(u, e))
                    db.reference(f"/users/{uid}/bill_scans").listen(lambda e, u=uid: on_scans(u, e))
                    listening.add(uid)
        except Exception as e:
            print(f"User list error: {e}")

        try:
            # Only the actual solar RUN takes the lock (inside), so a chat
            # question never waits behind the solar poll's slow reads.
            poll_and_process_solar(client, MODEL, solar_handled, work_lock)
        except Exception as e:
            print(f"Solar poll error: {e}")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
