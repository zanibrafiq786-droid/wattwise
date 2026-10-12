"""
solar_worker.py -- CHATBOT_SOLAR.md Part B worker. Imported and polled by
chat_worker.py (one "brain" process for the whole demo) rather than a
separate script to start, to keep the "start the brain" instruction simple.

Flow: app writes /users/{uid}/solar/requests/{id} = user inputs (B1) ->
code computes candidate designs and runs solar_sim.py for each (B2, B5,
deterministic, no AI) -> ONE Gemini call compares the candidates and picks
a recommendation (B3, simplified from live tool-calling the same way
chat_worker.py simplifies A4 -- see that file's docstring for why) ->
writes /users/{uid}/solar/report (B6).
"""
import json
import re
import time

from firebase_admin import db

from chat_context import get_bill_history, is_simulated
from firebase_db import get_app
from solar_sim import SimInputs, simulate_with_sensitivity
from solar_sizing import bill_profile, build_load_profile, candidate_system_sizes, outage_hour_set
from weather import get_hourly_irradiance

RECOMMEND_PROMPT = """You are an electricity-solar advisor for a household in Pakistan. You are \
given, as DATA, the household's real bill-derived profile, the site's solar yield, and the \
results of already-run hourly simulations for several candidate systems (on-grid, hybrid with \
different battery sizes, and off-grid, each at a few sizes). All numbers in DATA are already \
computed -- do not do your own arithmetic, only reason over and explain the numbers given.

Rules:
1. Recommend exactly ONE design from the candidates in DATA (quote its exact system_kw, \
battery_kwh and design_type as given).
2. Explain why, referencing: the summer peak vs. annual average usage, the outage hours entered \
(more outage hours favours a design with a bigger battery), the 200-unit slab, and net metering \
moving to net billing in Pakistan (mention this uncertainty, and that a plain on-grid system has \
no backup during outages).
3. If DATA.bill_profile.confidence is not "high", say plainly that the estimate is based on \
fewer than 12 months of real bills and is lower-confidence.
4. State the payback range and savings range as given -- never state a single number as exact.
5. This is an estimate, not an engineering design or a quote. Recommend getting 2-3 vendor \
quotes and checking current net-metering/net-billing rules before buying.
6. If something important is missing from DATA (e.g. no outage hours given), ask for it instead \
of guessing.

Respond with ONLY a single JSON object, no markdown fences:
{
  "chosen": {"design": "on_grid|hybrid|off_grid", "system_kw": number, "battery_kwh": number},
  "why": "explanation text, a few sentences",
  "tradeoffs": "a sentence or two on what you're giving up vs. the alternatives",
  "what_could_change_the_answer": "policy, shading, outage hours, vendor prices, tariff changes -- a sentence",
  "vendor_checklist": ["item 1", "item 2", "item 3", "item 4"]
}
"""


def _battery_options_for_design(design: str) -> list:
    if design == "on_grid":
        return [0.0]
    if design == "hybrid":
        return [5.0, 10.0]  # "several battery sizes" per B2
    return [15.0]  # off_grid: sized for roughly a day's typical home usage


def run_candidates(bills: list, config: dict, req: dict) -> dict:
    profile = bill_profile(bills)
    lat = req.get("lat", 31.42)
    lon = req.get("lon", 73.08)
    ghi = get_hourly_irradiance(lat, lon)
    load = build_load_profile(
        profile["annual_kwh"],
        daytime_share=req.get("daytime_share", 0.35),
        ac_afternoon=req.get("ac_afternoon", False),
    )
    outages = outage_hour_set(req.get("outage_hours_per_day", 0), req.get("outage_start_hour", 18))
    rate = profile["avg_rate_rs_per_unit"] or config["rate_rs_per_unit"]

    sizes = candidate_system_sizes(profile["annual_kwh"], ghi)
    results = []
    for size in sizes:
        for design in ("on_grid", "hybrid", "off_grid"):
            for battery_kwh in _battery_options_for_design(design):
                inputs = SimInputs(
                    system_kw=size["system_kw"],
                    battery_kwh=battery_kwh,
                    design=design,
                    ghi_series=ghi,
                    load_series=load,
                    outage_hours=outages,
                    rate_rs_per_unit=rate,
                    export_rate_rs_per_unit=req.get("export_rate_rs_per_unit", 0.0),
                    cost_per_kw_rs=req.get("cost_per_kw_rs", 160000.0),
                    cost_per_kwh_battery_rs=req.get("cost_per_kwh_battery_rs", 55000.0),
                )
                sens = simulate_with_sensitivity(inputs)
                base = sens["base"]
                results.append(
                    {
                        "target_offset_pct": size["target_offset_pct"],
                        "design": design,
                        "system_kw": size["system_kw"],
                        "battery_kwh": battery_kwh,
                        "annual_pv_kwh": base.annual_pv_kwh,
                        "self_consumption_pct": base.self_consumption_pct,
                        "solar_fraction_pct": base.solar_fraction_pct,
                        "annual_unserved_kwh": base.annual_unserved_kwh,
                        "estimated_annual_bill_rs": base.estimated_annual_bill_rs,
                        "annual_saving_rs_low": sens["annual_saving_rs_low"],
                        "annual_saving_rs_high": sens["annual_saving_rs_high"],
                        "system_cost_rs": base.system_cost_rs,
                        "payback_years_low": sens["payback_years_low"],
                        "payback_years_high": sens["payback_years_high"],
                    }
                )

    return {"profile": profile, "candidates": results, "rate_used": rate}


def extract_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return json.loads(cleaned)


def process_solar_request(client, model: str, uid: str, req_id: str, req: dict):
    print(f"  [solar] {uid[:8]}... requested analysis (lat={req.get('lat')}, lon={req.get('lon')})")
    db.reference(f"/users/{uid}/solar/status").set({"state": "running", "ts": int(time.time() * 1000)})
    try:
        bills = get_bill_history()
        config = {"rate_rs_per_unit": 33}
        analysis = run_candidates(bills, config, req)

        data = {
            "simulated": is_simulated(),
            "bill_profile": analysis["profile"],
            "user_inputs": req,
            "candidates": analysis["candidates"],
        }
        prompt = f"{RECOMMEND_PROMPT}\n\nDATA (JSON):\n{json.dumps(data, indent=2)}"
        response = client.models.generate_content(model=model, contents=[prompt])
        recommendation = extract_json(response.text)

        report = {
            "generated_ts": int(time.time() * 1000),
            "simulated": is_simulated(),
            "bill_profile": analysis["profile"],
            "user_inputs": req,
            "candidates": analysis["candidates"],
            "recommendation": recommendation,
        }
        db.reference(f"/users/{uid}/solar/report").set(report)
        db.reference(f"/users/{uid}/solar/status").set({"state": "done", "ts": int(time.time() * 1000)})
        print("  [solar] report written.")
    except Exception as e:
        print(f"  [solar] error: {e}")
        db.reference(f"/users/{uid}/solar/status").set(
            {"state": "error", "message": str(e), "ts": int(time.time() * 1000)}
        )


def poll_and_process_solar(client, model: str, handled: set):
    get_app()
    users = db.reference("/users").get() or {}
    for uid, udata in users.items():
        requests_ = ((udata or {}).get("solar") or {}).get("requests") or {}
        for req_id, req in requests_.items():
            key = ("solar", uid, req_id)
            if key in handled:
                continue
            process_solar_request(client, model, uid, req_id, req)
            handled.add(key)
