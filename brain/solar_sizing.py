"""
solar_sizing.py -- CHATBOT_SOLAR.md B5: code-computed candidate system
sizes from the user's own bill history and the site's solar yield. The AI
(solar_worker.py) only chooses among and explains these -- it never invents
a kW number itself.
"""
import math

from weather import specific_yield_kwh_per_kw

HOURS_PER_YEAR = 8760
TARGET_OFFSETS = [0.6, 0.8, 1.0]  # 60%, 80%, 100% of annual usage covered by PV


def bill_profile(bills: list) -> dict:
    """bills: [{month, units, amount_rs}, ...]. Returns the stats B5 needs."""
    if not bills:
        return {
            "months_count": 0,
            "annual_kwh": 0,
            "summer_peak_units": 0,
            "winter_low_units": 0,
            "months_over_200": 0,
            "avg_rate_rs_per_unit": 33.0,
            "confidence": "none",
        }

    # Guard against bad entries (e.g. a bill-photo import misreading a
    # history graph) rather than letting one bad month wreck the average.
    # Pakistani residential rates run roughly Rs 5-150/unit across the
    # slabs -- anything outside that is almost certainly a misread, not a
    # real tariff, so it's excluded rather than silently averaged in.
    def _valid(b):
        u, a = b.get("units", 0), b.get("amount_rs", 0)
        return u > 0 and a > 0 and 5 <= (a / u) <= 150

    last12 = [b for b in bills[-12:] if _valid(b)]
    if not last12:
        return {
            "months_count": 0,
            "annual_kwh": 0,
            "summer_peak_units": 0,
            "winter_low_units": 0,
            "months_over_200": 0,
            "avg_rate_rs_per_unit": 33.0,
            "confidence": "none",
        }
    units = [b["units"] for b in last12]
    rates = [b["amount_rs"] / b["units"] for b in last12]

    months_count = len(last12)
    # Scale to a full year if we have fewer than 12 months -- never silently
    # invent specific months, just note the lower confidence (B5).
    avg_monthly = sum(units) / months_count
    annual_kwh = avg_monthly * 12

    return {
        "months_count": months_count,
        "annual_kwh": round(annual_kwh, 0),
        "summer_peak_units": round(max(units), 0),
        "winter_low_units": round(min(units), 0),
        "months_over_200": sum(1 for u in units if u > 200),
        "avg_rate_rs_per_unit": round(sum(rates) / len(rates), 2) if rates else 33.0,
        "confidence": "high" if months_count >= 12 else ("medium" if months_count >= 6 else "low"),
    }


def build_load_profile(annual_kwh: float, daytime_share: float = 0.35, ac_afternoon: bool = False) -> list:
    """An ASSUMED hourly load shape (8760 values, kW) scaled to match the
    user's real annual kWh from their bills. daytime_share is the editable
    "share of usage 8am-5pm" input from B1; ac_afternoon adds an extra
    afternoon bump. This is a shape assumption, not measured data -- always
    labeled ASSUMED to the user."""
    daytime_hours = set(range(8, 17))
    base_weights = []
    for h in range(24):
        if h in daytime_hours:
            w = daytime_share / len(daytime_hours)
        else:
            w = (1 - daytime_share) / (24 - len(daytime_hours))
        if ac_afternoon and 13 <= h <= 18:
            w *= 1.6
        base_weights.append(w)

    total_weight = sum(base_weights) * 365
    annual_kwh = max(annual_kwh, 1)
    scale = annual_kwh / total_weight

    load = []
    for h in range(HOURS_PER_YEAR):
        hod = h % 24
        load.append(base_weights[hod] * scale)
    return load


def candidate_system_sizes(annual_kwh: float, ghi_series: list, pr: float = 0.75) -> list:
    """kW_needed = annual_kWh * target_offset / specific_yield, for each
    target offset (B5)."""
    yield_per_kw = specific_yield_kwh_per_kw(ghi_series, pr)
    if yield_per_kw <= 0:
        return []
    sizes = []
    for offset in TARGET_OFFSETS:
        kw = annual_kwh * offset / yield_per_kw
        sizes.append({"target_offset_pct": round(offset * 100), "system_kw": round(kw, 1)})
    return sizes


def outage_hour_set(hours_per_day: int, start_hour: int) -> set:
    if hours_per_day <= 0:
        return set()
    return {(start_hour + i) % 24 for i in range(hours_per_day)}
