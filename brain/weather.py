"""
weather.py -- CHATBOT_SOLAR.md B1: fetches hourly solar irradiance
(shortwave_radiation, W/m^2) for the last 12 months from Open-Meteo's free
archive API, and caches it to disk so repeat runs/demos don't re-fetch.
"""
import json
import time
from datetime import date, timedelta
from pathlib import Path

import requests

BRAIN_DIR = Path(__file__).parent
CACHE_DIR = BRAIN_DIR / ".cache"
CACHE_DIR.mkdir(exist_ok=True)
CACHE_MAX_AGE_SECONDS = 30 * 24 * 3600  # a month -- irradiance history doesn't change

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def _cache_path(lat: float, lon: float) -> Path:
    return CACHE_DIR / f"irradiance_{lat:.2f}_{lon:.2f}.json"


def get_hourly_irradiance(lat: float = 31.42, lon: float = 73.08) -> list:
    """Returns a list of ~8760 hourly shortwave_radiation values (W/m^2)
    for the most recent full 12 months at this location. Cached on disk."""
    return get_hourly_irradiance_meta(lat, lon)["values"]


def get_hourly_irradiance_meta(lat: float = 31.42, lon: float = 73.08) -> dict:
    """Same data as get_hourly_irradiance(), plus the series' start date so
    solar_geometry.py can turn each index into a real date/hour (needed to
    work out where the sun actually was for the roof-angle calculation)."""
    cache_file = _cache_path(lat, lon)
    if cache_file.exists() and (time.time() - cache_file.stat().st_mtime) < CACHE_MAX_AGE_SECONDS:
        cached = json.loads(cache_file.read_text())
        if "start_date" in cached:
            return cached

    end = date.today() - timedelta(days=7)  # archive API lags a few days behind today
    start = end.replace(year=end.year - 1) + timedelta(days=1)

    resp = requests.get(
        ARCHIVE_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "hourly": "shortwave_radiation",
            "timezone": "auto",
        },
        timeout=30,
    )
    resp.raise_for_status()
    values = resp.json()["hourly"]["shortwave_radiation"]
    values = [v if v is not None else 0.0 for v in values]

    data = {"lat": lat, "lon": lon, "fetched_at": time.time(), "start_date": start.isoformat(), "values": values}
    cache_file.write_text(json.dumps(data))
    return data


def specific_yield_kwh_per_kw(ghi_series: list, pr: float = 0.75) -> float:
    """kWh produced per kW of installed panel per year, at this location."""
    return sum(v / 1000.0 for v in ghi_series) * pr
