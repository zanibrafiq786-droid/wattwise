"""
tariff.py -- "What would my bill be?" The AI looks up the electricity tariff
for the user's area; the app does the maths.

Flow: the app writes /users/{uid}/tariff/requests/{id} = {area, ts} and calls
the cloud brain (api/brain.py, job "tariff"). This asks Gemini for the
tariff STRUCTURE only -- slab rates, fixed charge, per-unit adjustments, tax
percent -- checks it is sane, and saves it to /users/{uid}/tariff/schedule.
The app then computes the bill for any number of units from that schedule
(app/src/lib/tariff.ts). Gemini never multiplies or adds anything, so the
bill is always arithmetic on a visible list of rates.

Honest limit: the rates come from the model's own knowledge, which can be out
of date (tariffs change often). The app labels the result an estimate, shows
the "as of" date the model gave, and compares it to the user's last real bill.
"""
import time

from firebase_admin import db

from solar_worker import extract_json, generate_json

PROMPT = """You are an electricity-tariff reference for households. The user's area is: "{area}".

Give the domestic (household) electricity tariff that you believe applies there, as precisely as \
you know it. Respond with ONLY one JSON object, no markdown:
{{
  "area_label": "short name of the electricity company/area and country",
  "currency": "currency symbol or code used on the bill, e.g. Rs",
  "as_of": "month and year your figures are from (your best knowledge)",
  "mode": "telescopic" or "flat_by_slab",
  "slabs": [ {{"up_to": 100, "rate": 0.0}}, {{"up_to": 200, "rate": 0.0}}, ..., {{"up_to": null, "rate": 0.0}} ],
  "fixed_charge": 0.0,
  "extra_per_unit": 0.0,
  "tax_percent": 0.0,
  "notes": ["at most 3 short plain sentences: what the figures include, who they apply to (e.g. protected \
or normal households), and what to double-check on the official bill"],
  "confidence": "high" or "medium" or "low"
}}

Rules:
1. "mode": "telescopic" means each block of units is charged at its own slab rate (the first 100 at \
the first rate, the next block at the second rate, and so on). "flat_by_slab" means ALL units are \
charged at the single rate of the slab the total falls into. Use whichever this area really uses.
2. Slabs are in ascending order of "up_to" (cumulative units per month). The last slab has "up_to": null.
3. "rate" is the price per unit in the bill's currency. "fixed_charge" is the monthly fixed/meter \
charge for a typical household (0 if none). "extra_per_unit" is the usual fuel/quarterly adjustment \
per unit (0 if you are unsure). "tax_percent" is the total of sales tax/GST/duty as a percent of the \
bill subtotal (0 if none).
4. These are household figures; do not invent precision. If you are unsure, still give your best \
estimate but set "confidence" to "low" and say what is uncertain in "notes". Never add commentary \
outside the JSON."""


def validate_schedule(s: dict) -> dict:
    """Checks the model's tariff is usable arithmetic; raises ValueError if not."""
    slabs = s.get("slabs")
    if not isinstance(slabs, list) or not (1 <= len(slabs) <= 12):
        raise ValueError("no usable slabs")
    clean, prev = [], 0.0
    for i, sl in enumerate(slabs):
        rate = float(sl["rate"])
        up_to = sl.get("up_to")
        if not (0 < rate < 500):
            raise ValueError("implausible rate")
        if up_to is None:
            if i != len(slabs) - 1:
                raise ValueError("open-ended slab must be last")
        else:
            up_to = float(up_to)
            if up_to <= prev:
                raise ValueError("slabs not ascending")
            prev = up_to
        clean.append({"up_to": up_to, "rate": rate})
    if clean[-1]["up_to"] is not None:
        clean.append({"up_to": None, "rate": clean[-1]["rate"]})  # last rate continues
    mode = s.get("mode")
    if mode not in ("telescopic", "flat_by_slab"):
        mode = "telescopic"
    fixed = max(0.0, float(s.get("fixed_charge") or 0))
    extra = max(0.0, float(s.get("extra_per_unit") or 0))
    tax = float(s.get("tax_percent") or 0)
    if not (0 <= tax <= 60) or fixed > 20000 or extra > 100:
        raise ValueError("implausible charges")
    notes = [str(n)[:220] for n in (s.get("notes") or [])][:3]
    conf = s.get("confidence") if s.get("confidence") in ("high", "medium", "low") else "low"
    return {
        "area_label": str(s.get("area_label") or "")[:80],
        "currency": str(s.get("currency") or "Rs")[:6],
        "as_of": str(s.get("as_of") or "")[:40],
        "mode": mode,
        "slabs": clean,
        "fixed_charge": fixed,
        "extra_per_unit": extra,
        "tax_percent": tax,
        "notes": notes,
        "confidence": conf,
    }


def process_tariff(client, model: str, uid: str, req_id: str, req: dict):
    area = str(req.get("area") or "Pakistan")[:80]
    print(f"  [tariff] {uid[:8]}... asked for the tariff of {area!r}")
    status = db.reference(f"/users/{uid}/tariff/status")
    status.set({"state": "running", "ts": int(time.time() * 1000)})
    try:
        raw = generate_json(client, model, PROMPT.format(area=area.replace('"', "'")))
        schedule = validate_schedule(extract_json(raw))
        schedule["area_asked"] = area
        schedule["generated_ts"] = int(time.time() * 1000)
        db.reference(f"/users/{uid}/tariff/schedule").set(schedule)
        status.set({"state": "done", "ts": int(time.time() * 1000)})
        print("  [tariff] schedule saved.")
    except Exception as e:  # noqa: BLE001
        print(f"  [tariff] error: {e}")
        status.set({"state": "error", "message": "Couldn't get a usable tariff. Try again.", "ts": int(time.time() * 1000)})
