"""
report.py -- CLAUDE.md section 6.2: the month-end report. Computes wasted
hours/units/Rs per appliance from real logged events + bills + config (same
math and the same +/-20% ranges as app/src/lib/reportCalc.ts computes client
side), then asks an LLM to explain it and write a step-by-step plan for next
month, in simple English and Roman Urdu. Writes to /reports/{yyyy-mm}, which
the app's Report tab already reads (ReportScreen.tsx: useMonthReport).

Run manually after a month ends (or any time, to refresh the current month's
explanation while demoing):
    python report.py                 # current calendar month
    python report.py --month 2026-10 # a specific month

Provider note: the brief asked for the Anthropic API here specifically, but
no ANTHROPIC_API_KEY was ever provided for this project (brain/.env only has
GEMINI_API_KEY) -- same provider already used everywhere else in /brain
(chat_worker.py, solar_worker.py, import_bill.py) after the earlier
Groq-vs-Grok mixup documented in docs/progress.md. Using Gemini here too
instead of blocking on a key that was never given.
"""
import argparse
import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from firebase_admin import db
from google import genai

from chat_context import forecast_next_month, get_bill_history, is_simulated, prefetch, use_user
from firebase_db import get_app

BRAIN_DIR = Path(__file__).parent
load_dotenv(BRAIN_DIR / ".env")

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")

REPORT_PROMPT = """You are writing a month-end electricity report for one household in Pakistan, \
using the WattWise app. You are given, as DATA, real numbers already computed from their sensor \
logs and electricity bill -- never invent or adjust any number yourself, only explain the ones \
given.

Rules:
1. Write "text": a short explanation (3-5 sentences) of where the waste came from this month, \
referencing the real appliance/hours/Rs numbers in DATA. Write it TWICE: first in simple English, \
then a Roman Urdu version of the same explanation, separated by a blank line.
2. State ranges as given (e.g. "Rs 200-300"), never a single number presented as exact -- these \
are estimates from presence + on/off state, not a power meter.
3. If DATA.waste_by_appliance has very little data (few days covered), say so plainly instead of \
drawing a strong conclusion.
4. Write "plan_steps": 3-5 short, concrete, doable-next-month steps, each one sentence in English \
followed by " -- " and the same sentence in Roman Urdu. Base them on whichever appliance wasted \
the most in DATA, not generic advice.
5. If DATA.forecast_next_month warns the trend is high, mention it in the text once, plainly.

Respond with ONLY a single JSON object, no markdown fences:
{
  "text": "english explanation\\n\\nroman urdu explanation",
  "plan_steps": ["step 1 (english -- roman urdu)", "step 2 (english -- roman urdu)", "..."]
}
"""


def _events(uid: str) -> list:
    """This account's room events -- empty if no sensor is linked to it."""
    get_app()
    room = db.reference(f"/users/{uid}/device").get()
    if not room:
        return []
    val = db.reference(f"/{room}/events").get() or {}
    events = list(val.values())
    events.sort(key=lambda e: e.get("ts", 0))
    return events


def _config(uid: str) -> dict:
    get_app()
    val = db.reference(f"/users/{uid}/config").get() or {}
    watts = val.get("watts") or {}
    return {
        "fan": watts.get("fan", 75),
        "light": watts.get("light", 12),
        "rate_rs_per_unit": val.get("rate_rs_per_unit", 33),
    }


def _valid_bill(b: dict) -> bool:
    # Same Rs/unit sanity bound as solar_sizing.bill_profile() -- skips a
    # corrupted bill-import row instead of reconciling against a nonsense
    # number like "Rs 84 for 290 units".
    u, a = b.get("units", 0), b.get("amount_rs", 0)
    return u > 0 and a > 0 and 5 <= (a / u) <= 150


def latest_valid_bill(bills: list):
    for b in reversed(bills):
        if _valid_bill(b):
            return b
    return None


def sum_empty_on_seconds(events: list, key: str) -> float:
    """Mirrors reportCalc.ts's sumEmptyOnSeconds(): each event marks the
    START of a state lasting until the next event; the firmware's ts is unix
    milliseconds."""
    seconds = 0.0
    for i in range(len(events) - 1):
        cur, nxt = events[i], events[i + 1]
        duration_s = (nxt.get("ts", 0) - cur.get("ts", 0)) / 1000
        if duration_s <= 0:
            continue
        if cur.get("presence") == "empty" and cur.get(key):
            seconds += duration_s
    return seconds


def compute_waste(events: list, config: dict, bill) -> dict:
    fan_seconds = sum_empty_on_seconds(events, "fan_on")
    light_seconds = sum_empty_on_seconds(events, "light_on")

    def appliance(key, label, seconds, watts):
        hours = seconds / 3600
        units = hours * watts / 1000
        rs = units * config["rate_rs_per_unit"]
        return {
            "key": key,
            "label": label,
            "hours_low": round(hours * 0.8, 1),
            "hours_high": round(hours * 1.2, 1),
            "rs_low": round(rs * 0.8, 0),
            "rs_high": round(rs * 1.2, 0),
        }

    appliances = [
        appliance("fan", "Fan", fan_seconds, config["fan"]),
        appliance("light", "Light", light_seconds, config["light"]),
    ]
    total_rs_low = sum(a["rs_low"] for a in appliances)
    total_rs_high = sum(a["rs_high"] for a in appliances)
    days_covered = (events[-1]["ts"] - events[0]["ts"]) / 1000 / 86400 if len(events) > 1 else 0.0

    percent_low = percent_high = None
    if bill and bill.get("amount_rs", 0) > 0:
        percent_low = round(total_rs_low / bill["amount_rs"] * 100, 0)
        percent_high = round(total_rs_high / bill["amount_rs"] * 100, 0)

    return {
        "appliances": appliances,
        "total_rs_low": total_rs_low,
        "total_rs_high": total_rs_high,
        "percent_of_bill_low": percent_low,
        "percent_of_bill_high": percent_high,
        "days_covered": round(days_covered, 1),
        "reconciled_against_month": bill["month"] if bill else None,
    }


def extract_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return json.loads(cleaned)


def generate_report(month: str, uid: str) -> dict:
    use_user(uid)  # this account's bills only
    prefetch()
    events = _events(uid)
    config = _config(uid)
    bills = get_bill_history()
    bill = latest_valid_bill(bills)
    forecast = forecast_next_month()

    if not events or len(events) < 2:
        print(f"{uid[:8]}: not enough room-sensor events (or no sensor linked) -- skipped.")
        return None
    if not bill:
        print(f"{uid[:8]}: no valid bill saved yet.")

    waste = compute_waste(events, config, bill)
    data = {
        "month": month,
        "simulated": is_simulated(),
        "waste_by_appliance": waste,
        "bill": bill,
        "rate_rs_per_unit": config["rate_rs_per_unit"],
        "forecast_next_month": forecast,
    }

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is not set in brain/.env")
        return None
    client = genai.Client(api_key=api_key)

    prompt = f"{REPORT_PROMPT}\n\nDATA (JSON):\n{json.dumps(data, indent=2)}"
    response = client.models.generate_content(model=MODEL, contents=[prompt])
    ai = extract_json(response.text)

    report = {
        "generated_ts": int(time.time() * 1000),
        "simulated": is_simulated(),
        "waste_by_appliance": waste,
        "text": ai["text"],
        "plan_steps": ai["plan_steps"],
    }
    get_app()
    db.reference(f"/users/{uid}/reports/{month}").set(report)
    return report


def _current_month_key() -> str:
    import datetime

    now = datetime.datetime.now()
    return f"{now.year}-{now.month:02d}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate the month-end AI report.")
    parser.add_argument("--month", default=_current_month_key(), help="YYYY-MM, defaults to the current calendar month (what the app's Report tab looks up).")
    parser.add_argument("--uid", default=None, help="One account; default: every account.")
    args = parser.parse_args()

    get_app()
    uids = [args.uid] if args.uid else list((db.reference("/users").get(shallow=True) or {}).keys())
    for uid in uids:
        result = generate_report(args.month, uid)
        if result:
            print(f"Wrote /users/{uid[:8]}.../reports/{args.month}")
        print(json.dumps(result, indent=2))
