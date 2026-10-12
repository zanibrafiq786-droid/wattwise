"""
bill_scan.py -- reads a bill photo for the app, on the laptop.

The app used to call Gemini itself with a key shipped inside the app (and
so extractable from the APK). Now the phone writes the photo to
/users/{uid}/bill_scans/{id} = {image_b64, mime, ts}; this reads it with
the AI key that only lives in brain/.env, saves the bill rows under
/users/{uid}/bills, writes {status, saved, skipped, error} back to the same
node, and deletes the photo. Same rules as before:
  - the bill's own month = the month right after its history table (the AI
    sometimes reads the issue/due date instead -- that's how a September
    bill once got saved as October);
  - every row with a real month and units is saved; the rupee amount is
    kept exactly as printed (small or negative is real for solar
    net-metering homes);
  - months in the future are skipped.
"""
import base64
import json
import re
import time
from datetime import datetime

from firebase_admin import db
from google.genai import types

EXTRACTION_PROMPT = """This is a photo or scan of a Pakistani electricity (FESCO/DISCO) bill.
Read it carefully and return ONLY a single JSON object (no markdown fences, no extra text)
with exactly this shape:

{
  "billing_month": "YYYY-MM from the BILL MONTH field printed on the bill (not the issue date or due date)",
  "units": number (units consumed this billing month, from the bill),
  "amount_rs": number (total payable amount in Rs as printed; can be very small or negative for solar net-metering homes),
  "history_12m": [{"month": "YYYY-MM", "units": number, "amount_rs": number}, ...]
    (the past-consumption history table printed on the bill, oldest first, as many months as are visible -- often 12.
     units = units consumed that month. amount_rs = the BILL amount for that month exactly as printed, including a minus
     sign if it is negative -- homes with solar net-metering often have small or negative (credit) bills, and that is real.
     Do not use the payment column. If the history shows no amount for a month, use null.
     Only include months that are actually printed on the bill.),
  "notes": "anything you are unsure about, empty string if nothing"
}

Never include account, reference or customer numbers anywhere in your answer.
If a field truly isn't on the bill, use null (for scalars) or an empty array/string, not a guess."""

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"]


def normalize_month(raw):
    if not raw:
        return None
    s = str(raw).strip().upper()
    m = re.match(r"^(\d{4})-(\d{1,2})$", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"
    m = re.match(r"^([A-Z]{3})[A-Z]*[\s\-/']*(\d{2}|\d{4})$", s)
    if m and m.group(1) in MONTHS:
        year = m.group(2) if len(m.group(2)) == 4 else f"20{m.group(2)}"
        return f"{year}-{MONTHS.index(m.group(1)) + 1:02d}"
    return None


def shift_month(key: str, delta: int) -> str:
    y, mo = map(int, key.split("-"))
    total = y * 12 + (mo - 1) + delta
    return f"{total // 12}-{total % 12 + 1:02d}"


def read_bill(client, image: bytes, mime: str) -> dict:
    last = None
    for model in MODELS:
        for _ in range(2):
            try:
                r = client.models.generate_content(
                    model=model,
                    contents=[types.Part.from_bytes(data=image, mime_type=mime), EXTRACTION_PROMPT],
                    config={"response_mime_type": "application/json", "temperature": 0},
                )
                return json.loads(r.text)
            except json.JSONDecodeError as e:
                raise ValueError("The AI couldn't read the bill clearly. Try a brighter, straight-on photo.") from e
            except Exception as e:  # noqa: BLE001 -- SDK raises varied types
                last = e
                if any(code in str(e) for code in ("503", "429", "UNAVAILABLE")):
                    time.sleep(1.5)
                    continue
                break  # e.g. 404: try the next model
    raise RuntimeError(f"AI bill reader unavailable: {last}")


def rows_from(bill: dict):
    history = [{**h, "month": normalize_month(h.get("month")) or h.get("month")} for h in bill.get("history_12m") or []]
    month = normalize_month(bill.get("billing_month"))
    last_hist = sorted(h["month"] for h in history if re.match(r"^\d{4}-\d{2}$", str(h.get("month"))))
    if last_hist:
        expected = shift_month(last_hist[-1], 1)
        if not month or month > expected:
            month = expected
    return [{"month": month, "units": bill.get("units"), "amount_rs": bill.get("amount_rs")}] + history


def save_rows(uid: str, rows: list) -> dict:
    now_key = datetime.now().strftime("%Y-%m")
    saved, skipped, done = [], [], set()
    for r in rows:
        month, units, amount = r.get("month"), r.get("units"), r.get("amount_rs")
        if month in done:
            continue
        if not month or not re.match(r"^\d{4}-\d{2}$", str(month)):
            skipped.append({"month": "?", "reason": "couldn't read the month"})
            continue
        if month > now_key:
            skipped.append({"month": month, "reason": "that month hasn't happened yet"})
            continue
        if not isinstance(units, (int, float)) or units <= 0:
            skipped.append({"month": month, "reason": "couldn't read the units"})
            continue
        row = {"units": units}
        if isinstance(amount, (int, float)):
            row["amount_rs"] = amount
        done.add(month)
        saved.append({"month": month, **row})
    if saved:
        # One write for all months (each round trip is ~1 s from here).
        db.reference(f"/users/{uid}/bills").update(
            {r["month"]: {k: v for k, v in r.items() if k != "month"} for r in saved}
        )
    return {"saved": saved, "skipped": skipped}


def process_scan(client, uid: str, scan_id: str, req: dict):
    ref = db.reference(f"/users/{uid}/bill_scans/{scan_id}")
    print(f"[{datetime.now():%H:%M:%S}] {uid[:8]}... bill scan", end="")
    t = time.time()
    try:
        image = base64.b64decode(req["image_b64"])
        bill = read_bill(client, image, req.get("mime") or "image/jpeg")
        result = save_rows(uid, rows_from(bill))
        status = "done" if result["saved"] else "nothing_readable"
        ref.set({"status": status, **result, "ts": int(time.time() * 1000)})  # also drops the photo
        print(f" -> saved {len(result['saved'])}, skipped {len(result['skipped'])} ({time.time() - t:.1f}s)")
    except Exception as e:  # noqa: BLE001
        msg = str(e) if isinstance(e, ValueError) else "Couldn't read the bill right now. Please try again."
        ref.set({"status": "error", "error": msg, "ts": int(time.time() * 1000)})
        print(f" -> error: {e}")
