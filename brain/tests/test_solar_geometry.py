import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from solar_geometry import DIRECTION_AZIMUTH, default_tilt_deg, poa_series

LAT = 31.42  # Faisalabad
START = "2025-01-01"


def flat_profile(hours=24 * 30):
    """A simplified clear-sky-ish daytime bell curve, just enough shape for
    the geometry math to have something non-trivial to act on."""
    out = []
    for i in range(hours):
        h = i % 24
        out.append(600.0 if 8 <= h <= 16 else 0.0)
    return out


class TestSolarGeometry(unittest.TestCase):
    def test_night_hours_stay_zero(self):
        ghi = flat_profile()
        poa = poa_series(ghi, START, LAT, default_tilt_deg(LAT), DIRECTION_AZIMUTH["south"])
        for i, v in enumerate(poa):
            if ghi[i] == 0:
                self.assertEqual(v, 0.0)

    def test_south_facing_beats_north_facing_in_northern_hemisphere(self):
        ghi = flat_profile()
        tilt = default_tilt_deg(LAT)
        south = sum(poa_series(ghi, START, LAT, tilt, DIRECTION_AZIMUTH["south"]))
        north = sum(poa_series(ghi, START, LAT, tilt, DIRECTION_AZIMUTH["north"]))
        self.assertGreater(south, north)

    def test_tilted_south_beats_flat_horizontal_annual_total(self):
        # Over a full year a south-facing tilt at latitude angle should
        # collect more than a horizontal (tilt=0) surface at this latitude.
        ghi = flat_profile(hours=8760)
        tilt = default_tilt_deg(LAT)
        tilted = sum(poa_series(ghi, START, LAT, tilt, DIRECTION_AZIMUTH["south"]))
        flat = sum(poa_series(ghi, START, LAT, 0, DIRECTION_AZIMUTH["south"]))
        self.assertGreater(tilted, flat)

    def test_default_tilt_matches_latitude(self):
        self.assertEqual(default_tilt_deg(31.42), 31)
        self.assertEqual(default_tilt_deg(-18.0), 18)


if __name__ == "__main__":
    unittest.main()
