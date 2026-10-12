"""
Builds the real-data context the chatbot is allowed to use, and the
Python-side "tools" from CHATBOT_SOLAR.md A4. Every number here comes from
Firebase (bills, room events, config) -- never from the model's own
knowledge. The worker embeds this as structured JSON in the prompt instead
of wiring up live model tool-calling, which would take much longer to build
correctly under this deadline; the effect for A3's rule ("every number
comes from a tool or context") is the same either way.

NOTE on scope: /users/{uid}/bills and /ingest/{uid}/{deviceKey}/events from
CHATBOT_SOLAR.md assume the multi-user data migration in SETUP_WIZARD.md
Step 2, which hasn't been built yet (explicitly deferred). This reads from
the existing single-room paths instead: /bills, /room1/events, /config.
Only the chat requests/replies themselves are scoped under /users/{uid}/.
"""
import time
from datetime import datetime, timedelta

from firebase_db import get_app
from firebase_admin import db

SLAB_LIMIT = 200
DAY_MS = 24 * 60 * 60 * 1000


def _bills() -> dict:
    get_app()
    return db.reference("/bills").get() or {}


def _events() -> list:
    get_app()
    val = db.reference("/room1/events").get() or {}
    events = list(val.values())
    events.sort(key=lambda e: e.get("ts", 0))
    return events


def _config() -> dict:
    get_app()
    val = db.reference("/config").get() or {}
    return {
        "watts": {
            "fan": (val.get("watts") or {}).get("fan", 75),
            "light": (val.get("watts") or {}).get("light", 12),
            "ac": (val.get("watts") or {}).get("ac", 1500),
        },
        "rate_rs_per_unit": val.get("rate_rs_per_unit", 33),
    }


def is_simulated() -> bool:
    get_app()
    return bool(db.reference("/meta/simulated").get())


def get_bill_history() -> list:
    """Returns [{month, units, amount_rs}, ...] sorted oldest -> newest."""
    bills = _bills()
    return [{"month": m, **b} for m, b in sorted(bills.items())]


def get_month_usage(month: str):
    """Returns {month, units, amount_rs} for one YYYY-MM, or None."""
    bills = _bills()
    b = bills.get(month)
    return {"month": month, **b} if b else None


def slab_status():
    """Units so far / left against the 200-unit slab, for the LATEST
    billed month (no live meter exists -- see SlabRiskMeter.tsx for the
    same honesty caveat in the app)."""
    history = get_bill_history()
    if not history:
        return None
    latest = history[-1]
    units = latest["units"]
    return {
        "month": latest["month"],
        "units_used": units,
        "units_left": SLAB_LIMIT - units,
        "over_slab": units > SLAB_LIMIT,
        "note": "Based on the latest billed month, not a live reading (no current-clamp sensor in this project).",
    }


def waste_summary(days: int = 7):
    """Hours empty-with-fan-on / empty-with-light-on over the last N days,
    and the estimated Rs cost -- same math as app/src/lib/reportCalc.ts."""
    config = _config()
    events = _events()
    cutoff = time.time() * 1000 - days * DAY_MS
    recent = [e for e in events if e.get("ts", 0) >= cutoff]

    fan_seconds = 0.0
    light_seconds = 0.0
    for i in range(len(recent) - 1):
        cur, nxt = recent[i], recent[i + 1]
        duration_s = (nxt.get("ts", 0) - cur.get("ts", 0)) / 1000
        if duration_s <= 0 or cur.get("presence") != "empty":
            continue
        if cur.get("fan_on"):
            fan_seconds += duration_s
        if cur.get("light_on"):
            light_seconds += duration_s

    def to_estimate(seconds, watts):
        hours = seconds / 3600
        units = hours * watts / 1000
        rs = units * config["rate_rs_per_unit"]
        return {"hours": round(hours, 1), "units": round(units, 2), "rs_est": round(rs, 0)}

    return {
        "days": days,
        "fan_empty": to_estimate(fan_seconds, config["watts"]["fan"]),
        "light_empty": to_estimate(light_seconds, config["watts"]["light"]),
        "events_count": len(recent),
    }


def compare_months(a: str, b: str):
    ma, mb = get_month_usage(a), get_month_usage(b)
    if not ma or not mb:
        return {"error": f"Missing bill data for {a if not ma else b}."}
    return {
        "a": ma,
        "b": mb,
        "units_diff": round(ma["units"] - mb["units"], 1),
        "amount_diff": round(ma["amount_rs"] - mb["amount_rs"], 0),
    }


def _add_months(month_key: str, delta: int) -> str:
    y, m = map(int, month_key.split("-"))
    total = (y * 12 + (m - 1)) + delta
    return f"{total // 12}-{(total % 12) + 1:02d}"


def forecast_next_month():
    """Same month last year, adjusted for this year's recent trend --
    mirrors app/src/lib/forecastCalc.ts. Always a range."""
    history = {b["month"]: b for b in get_bill_history()}
    current_month = datetime.now().strftime("%Y-%m")
    next_month = _add_months(current_month, 1)
    last_year_month = _add_months(next_month, -12)
    last_year = history.get(last_year_month)
    if not last_year:
        return {"month": next_month, "note": f"No bill from {last_year_month} to forecast from."}

    ratios = []
    for back in range(1, 7):
        this_year_m = _add_months(current_month, -back)
        last_year_m = _add_months(this_year_m, -12)
        ty, ly = history.get(this_year_m), history.get(last_year_m)
        if ty and ly and ly["units"] > 0:
            ratios.append(ty["units"] / ly["units"])
    trend = sum(ratios) / len(ratios) if ratios else 1.0
    trend = max(0.5, min(2.0, trend))

    projected_units = last_year["units"] * trend
    return {
        "month": next_month,
        "based_on": last_year_month,
        "units_low": round(projected_units * 0.85, 0),
        "units_high": round(projected_units * 1.15, 0),
        "flagged_high": projected_units > last_year["units"] * 1.15,
    }


def build_context() -> dict:
    """Everything the chatbot is allowed to know, for one request."""
    return {
        "simulated": is_simulated(),
        "config": _config(),
        "bill_history": get_bill_history(),
        "slab_status": slab_status(),
        "waste_7d": waste_summary(7),
        "forecast_next_month": forecast_next_month(),
    }
