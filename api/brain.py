"""
api/brain.py -- the AI brain as a Vercel serverless function, so chat,
bill scanning and solar work even when the laptop is off.

The phone still writes each request to Firebase exactly as before (chat
question, bill photo, solar inputs). It then calls this URL with the job
type and the request id, plus the user's Firebase sign-in token. This
function checks the token (so only a signed-in user can spend our AI
quota, and only on their own data), runs the SAME code the laptop worker
uses (brain/chat_worker.py, bill_scan.py, solar_worker.py), and writes the
result back to Firebase, where the app is already listening for it.

Secrets (Gemini key, Firebase service account) live only in Vercel's
environment variables, never in the app or in git.
"""
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "brain"))

from firebase_admin import auth, db  # noqa: E402
from google import genai  # noqa: E402

from bill_scan import process_scan  # noqa: E402
from chat_worker import MODEL, process_request  # noqa: E402
from firebase_db import get_app  # noqa: E402
from solar_worker import process_solar_request  # noqa: E402
from tariff import process_tariff  # noqa: E402

# chat_context keeps "the current account" in a module global, so jobs that
# land on the same running instance must take turns.
_lock = threading.Lock()
_client = None


def _gemini():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def run_job(uid: str, job: str, req_id: str) -> str:
    if job == "chat":
        if db.reference(f"/users/{uid}/chat/replies/{req_id}").get(shallow=True):
            return "already answered"
        req = db.reference(f"/users/{uid}/chat/requests/{req_id}").get()
        if not isinstance(req, dict):
            return "no such request"
        process_request(_gemini(), uid, req_id, req)
        return "answered"
    if job == "scan":
        req = db.reference(f"/users/{uid}/bill_scans/{req_id}").get()
        if not isinstance(req, dict) or "image_b64" not in req:
            return "nothing to scan"
        process_scan(_gemini(), uid, req_id, req)
        return "scanned"
    if job == "solar":
        req = db.reference(f"/users/{uid}/solar/requests/{req_id}").get()
        if not isinstance(req, dict):
            return "no such request"
        process_solar_request(_gemini(), MODEL, uid, req_id, req)
        return "solar done"
    if job == "tariff":
        req = db.reference(f"/users/{uid}/tariff/requests/{req_id}").get()
        if not isinstance(req, dict):
            return "no such request"
        process_tariff(_gemini(), MODEL, uid, req_id, req)
        return "tariff done"
    return "unknown job"


class handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        # Health check: open the URL in a browser to see it's alive.
        self._send(200, {"ok": True, "service": "wattwise-brain"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            token = (self.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
            get_app()
            uid = auth.verify_id_token(token)["uid"]  # raises if missing/invalid
        except Exception:
            self._send(401, {"ok": False, "error": "not signed in"})
            return

        job, req_id = body.get("job"), str(body.get("id") or "")
        if job not in ("chat", "scan", "solar", "tariff") or not req_id or "/" in req_id:
            self._send(400, {"ok": False, "error": "bad request"})
            return
        try:
            with _lock:
                result = run_job(uid, job, req_id)
            self._send(200, {"ok": True, "result": result})
        except Exception as e:
            print(f"job {job} failed: {e}")
            self._send(500, {"ok": False, "error": "job failed"})
