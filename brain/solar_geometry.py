"""
solar_geometry.py -- CHATBOT_SOLAR.md Part C (time-boxed, feasible slice).

The user asked for PVsyst-style, location-and-roof-angle-aware numbers
instead of a single flat "performance ratio" multiplier applied to flat
(horizontal) irradiance. True PVsyst/satellite roof-shading analysis needs
satellite imagery + 3D roof models, which is multiple days of work and out
of scope for tonight's deadline. What IS feasible and genuinely more
accurate: standard solar-geometry physics (the same equations PVsyst itself
uses for the sun-position and irradiance-transposition steps) applied to the
REAL measured irradiance already fetched for this exact lat/lon, tilted and
faced the direction the user actually picks.

This computes, for each hour of the real weather year:
  1. where the sun is (elevation, azimuth) from latitude + day-of-year + hour
  2. how much of the measured horizontal irradiance (GHI) is direct vs.
     diffuse light (Erbs correlation -- a standard, published formula)
  3. how much of that light actually lands on a panel tilted at `tilt_deg`
     and facing `azimuth_deg` (the isotropic-sky transposition model)

This is real astronomy + the real weather history for the site, honestly
labeled as a rule-of-thumb sun-angle model -- NOT a substitute for an actual
roof survey, and still no shading from nearby buildings/trees (that part
needs satellite/3D data we don't have time to integrate today).
"""
import math
from datetime import date, timedelta

SOLAR_CONSTANT = 1367.0  # W/m^2

# Compass direction -> panel azimuth in the "measured from south, positive
# toward west" convention used below. South is optimal in the northern
# hemisphere (Pakistan), which is why it's the pre-filled default.
DIRECTION_AZIMUTH = {"south": 0.0, "west": 90.0, "east": -90.0, "north": 180.0}


def default_tilt_deg(lat: float) -> float:
    """Rule-of-thumb fixed-tilt angle: roughly equal to the site latitude.
    Good enough absent a real roof survey -- PVsyst itself uses this as a
    starting point before a user overrides it with real roof measurements."""
    return round(abs(lat))


def _erbs_diffuse_fraction(kt: float) -> float:
    """Erbs et al. (1982) correlation: published, standard, used by PVsyst
    and PVLib for the same GHI -> direct/diffuse split needed here."""
    if kt <= 0.22:
        return 1.0 - 0.09 * kt
    if kt <= 0.80:
        return 0.9511 - 0.1604 * kt + 4.388 * kt**2 - 16.638 * kt**3 + 12.336 * kt**4
    return 0.165


def poa_series(
    ghi_series: list,
    start_date_iso: str,
    lat: float,
    tilt_deg: float,
    azimuth_deg: float,
    albedo: float = 0.2,
) -> list:
    """Converts an hourly flat-horizontal GHI series (what the weather API
    gives) into plane-of-array irradiance on a panel at `tilt_deg` facing
    `azimuth_deg` (0=south, +90=west, -90=east, 180=north). Same length and
    units (W/m^2) as the input, so it's a drop-in replacement everywhere
    ghi_series was used for a flat assumption."""
    start = date.fromisoformat(start_date_iso)
    phi = math.radians(lat)
    beta = math.radians(tilt_deg)
    gamma = math.radians(azimuth_deg)
    cos_beta = math.cos(beta)

    out = []
    for i, ghi in enumerate(ghi_series):
        if ghi <= 0:
            out.append(0.0)
            continue
        n = (start + timedelta(hours=i)).timetuple().tm_yday
        hour_of_day = i % 24
        solar_hour = hour_of_day + 0.5  # midpoint of the hour

        decl = math.radians(23.45 * math.sin(math.radians(360 * (284 + n) / 365)))
        hour_angle = math.radians(15 * (solar_hour - 12))

        sin_elev = math.sin(phi) * math.sin(decl) + math.cos(phi) * math.cos(decl) * math.cos(hour_angle)
        sin_elev = max(-1.0, min(1.0, sin_elev))
        elev = math.asin(sin_elev)
        if elev <= 0:
            out.append(0.0)
            continue
        cos_elev = math.cos(elev)

        denom = cos_elev * math.cos(phi)
        if abs(denom) < 1e-6:
            az = 0.0
        else:
            cos_az = (sin_elev * math.sin(phi) - math.sin(decl)) / denom
            cos_az = max(-1.0, min(1.0, cos_az))
            az = math.acos(cos_az)
            if hour_angle < 0:
                az = -az

        cos_aoi = sin_elev * cos_beta + cos_elev * math.sin(beta) * math.cos(az - gamma)

        i0 = SOLAR_CONSTANT * (1 + 0.033 * math.cos(math.radians(360 * n / 365))) * sin_elev
        kt = min(1.0, max(0.0, ghi / i0)) if i0 > 5 else 0.0
        diffuse_frac = _erbs_diffuse_fraction(kt)
        dhi = ghi * diffuse_frac
        direct_horizontal = ghi - dhi
        dni = direct_horizontal / sin_elev if sin_elev > 0.0872 else 0.0  # guard below ~5 deg

        poa_direct = max(0.0, dni * cos_aoi)
        poa_diffuse = dhi * (1 + cos_beta) / 2
        poa_ground = ghi * albedo * (1 - cos_beta) / 2
        out.append(round(poa_direct + poa_diffuse + poa_ground, 1))

    return out
