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

from chat_context import get_bill_history, household_load, is_simulated, prefetch, use_user
from firebase_db import get_app
from solar_geometry import DIRECTION_AZIMUTH, default_tilt_deg, poa_series
from solar_sim import SimInputs, simulate_with_sensitivity
from solar_sizing import bill_profile, build_load_profile, candidate_system_sizes, outage_hour_set
from weather import get_hourly_irradiance_meta

RECOMMEND_PROMPT = """You are a solar advisor explaining a recommendation to an ordinary \
homeowner who does NOT know technical terms. Never use words like "kWp", "self-consumption", \
"DOD", "inverter topology", "net metering" without explaining them. Say "panels", "battery", \
"the grid (WAPDA/your electricity company)". You are given, as DATA: the household's region \
(DATA.region), its real bill-derived profile, the appliances the user listed themselves \
(DATA.household_appliances -- their own estimate of daily use), the site's solar yield, and \
already-run hourly simulations for several candidate systems (grid-connected without battery, \
with battery backup at a couple of sizes, and fully independent of the grid). All numbers in DATA \
are already computed -- do not do your own arithmetic, only reason over the numbers given.

Rules:
1. REGION FIRST. Use what you know about solar rules and practice in DATA.region (country/city). \
Only recommend a design that a home there is actually allowed to install and use, and that is \
practical there (e.g. grid connection approvals, export/buy-back rules, how common load-shedding \
is). If the rules for a design in that region are restricted, changing, or you are not sure, do \
NOT pick it on assumption -- pick the safest allowed option and say in one plain sentence what \
must be confirmed with the local electricity company. Put that in "region_note".
2. Recommend exactly ONE design from the candidates in DATA (quote its exact system_kw, \
battery_kwh and design as given).
3. Use the appliances: if big daytime users (AC, motor/pump, iron) dominate, say so plainly -- \
that is what decides whether a battery is worth it.
4. Write every text field as ONE short, plain sentence (max ~18 words), the way you'd explain it \
out loud to a neighbour. Numbers only, no formulas.
5. "headline" is the main takeaway in plain words, e.g. "About 6 panels, no battery, could cut \
your bill by half."
6. If DATA.bill_profile.confidence is not "high", say plainly (one short sentence, in "why" or \
"tradeoffs") that this is an estimate from few bills or from the appliances the user listed.
7. State payback and savings as ranges as given -- never one exact number.
8. "what_could_change_the_answer" should mention getting 2-3 local installer quotes.
10. If DATA.bill_profile.months_with_solar_credit > 0, their bills were tiny or a credit -- they very \
likely ALREADY have solar with net-metering. Say so plainly and frame the advice as adding to / \
upgrading what they have (e.g. adding a battery for load-shedding), not buying a first system.
9. vendor_checklist items are short phrases (3-6 words each).

Respond with ONLY a single JSON object, no markdown fences:
{
  "chosen": {"design": "on_grid|hybrid|off_grid", "system_kw": number, "battery_kwh": number},
  "headline": "one short plain sentence, the main takeaway",
  "why": "one short plain sentence",
  "tradeoffs": "one short plain sentence",
  "region_note": "one short plain sentence about what is allowed/needs approval where they live",
  "what_could_change_the_answer": "one short plain sentence",
  "vendor_checklist": ["short item 1", "short item 2", "short item 3", "short item 4"]
}
"""


def _battery_options_for_design(design: str) -> list:
    if design == "on_grid":
        return [0.0]
    if design == "hybrid":
        return [5.0, 10.0]  # "several battery sizes" per B2
    return [15.0]  # off_grid: sized for roughly a day's typical home usage


def run_candidates(bills: list, config: dict, req: dict, household: dict | None = None) -> dict:
    profile = bill_profile(bills)
    # No usable bills, but the user listed their appliances: size the system
    # from that instead of from zero. Clearly marked as an appliance-based
    # estimate (lower confidence than real bills).
    if profile["months_count"] == 0 and household and household.get("kwh_per_day", 0) > 0:
        profile = {
            **profile,
            "annual_kwh": round(household["kwh_per_day"] * 365, 0),
            "confidence": "appliances_estimate",
        }
    lat = req.get("lat", 31.42)
    lon = req.get("lon", 73.08)
    meta = get_hourly_irradiance_meta(lat, lon)
    flat_ghi = meta["values"]

    # Part C (time-boxed): use real sun-angle physics for this exact site and
    # roof direction instead of a flat horizontal-irradiance assumption. See
    # solar_geometry.py's docstring for exactly what this does and doesn't
    # cover (no satellite shading -- that needs imagery we don't have today).
    tilt_deg = req.get("tilt_deg") or default_tilt_deg(lat)
    direction = req.get("roof_direction", "south")
    azimuth_deg = DIRECTION_AZIMUTH.get(direction, 0.0)
    ghi = poa_series(flat_ghi, meta["start_date"], lat, tilt_deg, azimuth_deg)

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

    profile = {**profile, "roof_direction": direction, "tilt_deg": tilt_deg}
    return {"profile": profile, "candidates": results, "rate_used": rate}


def generate_json(client, model: str, prompt: str) -> str:
    """JSON-only model call. Retries once when the model is overloaded
    (HTTP 503 has happened repeatedly on this account), then falls back to
    another model, instead of failing the whole analysis."""
    last = None
    # Measured: 3.5-flash-lite / flash-lite-latest answer in ~1.5-2 s; the
    # older 3.1-flash-lite was taking ~15 s even for "say hi" (overloaded).
    for m in dict.fromkeys([model, "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"]):
        for attempt in range(2):
            try:
                r = client.models.generate_content(
                    model=m, contents=[prompt], config={"response_mime_type": "application/json", "temperature": 0.2}
                )
                return r.text
            except Exception as e:  # noqa: BLE001 -- the SDK raises varied types
                last = e
                if "503" in str(e) or "429" in str(e) or "UNAVAILABLE" in str(e):
                    time.sleep(2)
                    continue
                break
    raise last


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
        use_user(uid)  # this account's bills and appliances only
        prefetch()
        bills = get_bill_history()
        household = household_load()
        config = {"rate_rs_per_unit": 33}
        analysis = run_candidates(bills, config, req, household)

        data = {
            "simulated": is_simulated(),
            "region": req.get("region") or {},
            "bill_profile": analysis["profile"],
            "household_appliances": household,
            "user_inputs": req,
            "candidates": analysis["candidates"],
        }
        prompt = f"{RECOMMEND_PROMPT}\n\nDATA (JSON):\n{json.dumps(data, indent=2)}"
        recommendation = extract_json(generate_json(client, model, prompt))

        report = {
            "generated_ts": int(time.time() * 1000),
            "simulated": is_simulated(),
            "region": req.get("region") or {},
            "household_appliances": household,
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


def poll_and_process_solar(client, model: str, handled: set, lock=None):
    get_app()
    # Only the requests node per user, not the whole /users tree (which
    # includes the big solar report itself) on every loop.
    uids = db.reference("/users").get(shallow=True) or {}
    for uid in uids:
        requests_ = db.reference(f"/users/{uid}/solar/requests").get() or {}
        pending = [rid for rid in requests_ if ("solar", uid, rid) not in handled]
        if not pending:
            continue
        # `handled` is in-memory, so after a worker restart every old request
        # looked new and was re-run (one model call each). Request ids are
        # "req_<ms>" from the app; anything older than the latest report was
        # already answered.
        report_ts = db.reference(f"/users/{uid}/solar/report/generated_ts").get() or 0
        for req_id in pending:
            key = ("solar", uid, req_id)
            try:
                req_ts = int(req_id.split("_", 1)[1])
            except (IndexError, ValueError):
                # Not an app request id (e.g. a hand-made test entry): only
                # run it if there's no report yet, so it can never overwrite
                # a real one on restart.
                req_ts = None
            if (req_ts is not None and req_ts <= report_ts) or (req_ts is None and report_ts):
                handled.add(key)
                continue
            if lock is not None:
                with lock:
                    process_solar_request(client, model, uid, req_id, requests_[req_id])
            else:
                process_solar_request(client, model, uid, req_id, requests_[req_id])
            handled.add(key)
