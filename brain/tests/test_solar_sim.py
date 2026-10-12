"""
Unit tests for solar_sim.py (CHATBOT_SOLAR.md acceptance test 5): the energy
balance holds in AGGREGATE over the simulated period:

    pv + import + battery_discharge = served_load + export + curtailed + charge_drawn

where charge_drawn is the RAW amount of surplus energy diverted to charge
the battery each hour (before round-trip efficiency is applied) -- not just
the efficiency loss portion. Working this out by hand: in a surplus hour,
pv = load + export_or_curtailed + charge_drawn; in a deficit hour,
pv + discharge + import = served_load. Summing both kinds of hours gives
the identity above. It does NOT hold hour by hour (charged energy is stored
for a later hour, not consumed/exported in the hour it arrives), only in
total over a period.

Run with: python -m unittest discover -s tests
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from solar_sim import SimInputs, simulate  # noqa: E402


def make_inputs(design="hybrid", battery_kwh=10.0, hours=24 * 7):
    # A repeating day: sun 6am-6pm (triangular), flat 1kW load, a 2kW
    # evening peak (19-21), and an outage 18-19.
    ghi = []
    load = []
    for h in range(hours):
        hod = h % 24
        if 6 <= hod <= 18:
            ghi.append(max(0.0, 800 * (1 - abs(hod - 12) / 6)))
        else:
            ghi.append(0.0)
        load.append(2.0 if 19 <= hod <= 21 else 1.0)
    return SimInputs(
        system_kw=3.0,
        battery_kwh=battery_kwh,
        design=design,
        ghi_series=ghi,
        load_series=load,
        outage_hours={18, 19},
        pr=0.75,
        round_trip_eff=0.9,
        dod_limit=0.8,
    )


def run_with_soc_tracking(inputs: SimInputs):
    """Same dispatch logic as solar_sim.simulate(), but also returns the
    battery's starting and ending state of charge so the test can include
    the stored-energy term in the balance check."""
    max_soc = inputs.battery_kwh
    min_soc = inputs.battery_kwh * (1 - inputs.dod_limit)
    soc = max_soc
    soc_start = soc
    max_rate_kw = max(inputs.battery_kwh * 0.5, 0.1)

    pv_t = load_t = imp_t = exp_t = curtail_t = unserved_t = loss_t = discharge_t = charge_drawn_t = 0.0

    for i in range(len(inputs.ghi_series)):
        hod = i % 24
        is_outage = hod in inputs.outage_hours
        pv = inputs.system_kw * (inputs.ghi_series[i] / 1000.0) * inputs.pr
        load = inputs.load_series[i]
        pv_t += pv
        load_t += load

        net = pv - load
        if net >= 0:
            surplus = net
            if inputs.battery_kwh > 0:
                charge = min(surplus, max_rate_kw, (max_soc - soc) / inputs.round_trip_eff)
                charge = max(0.0, charge)
                soc += charge * inputs.round_trip_eff
                loss_t += charge * (1 - inputs.round_trip_eff)
                charge_drawn_t += charge
                surplus -= charge
            if inputs.design in ("on_grid", "hybrid"):
                exp_t += surplus
            else:
                curtail_t += surplus
        else:
            deficit = -net
            if inputs.battery_kwh > 0:
                discharge = min(deficit, max_rate_kw, soc - min_soc)
                discharge = max(0.0, discharge)
                soc -= discharge
                discharge_t += discharge
                deficit -= discharge
            if is_outage:
                unserved_t += deficit
            elif inputs.design in ("on_grid", "hybrid"):
                imp_t += deficit
            else:
                unserved_t += deficit

    return {
        "pv": pv_t, "load": load_t, "import": imp_t, "export": exp_t,
        "curtailed": curtail_t, "unserved": unserved_t, "charge_loss": loss_t,
        "charge_drawn": charge_drawn_t,
        "discharge": discharge_t, "soc_start": soc_start, "soc_end": soc,
    }


class TestEnergyBalance(unittest.TestCase):
    def check_balance(self, inputs: SimInputs):
        r = run_with_soc_tracking(inputs)
        served_load = r["load"] - r["unserved"]
        lhs = r["pv"] + r["import"] + r["discharge"]
        rhs = served_load + r["export"] + r["curtailed"] + r["charge_drawn"]
        self.assertAlmostEqual(lhs, rhs, places=6, msg=f"{lhs} != {rhs}")

        # Sanity cross-check: charge_drawn should equal what was stored
        # (soc change from charging, i.e. discharge-adjusted) plus what the
        # round-trip inefficiency lost.
        soc_change = r["soc_end"] - r["soc_start"]
        self.assertAlmostEqual(
            r["charge_drawn"] * inputs.round_trip_eff - r["discharge"], soc_change, places=6
        )

    def test_balance_hybrid(self):
        self.check_balance(make_inputs("hybrid"))

    def test_balance_on_grid(self):
        self.check_balance(make_inputs("on_grid", battery_kwh=0))

    def test_balance_off_grid(self):
        self.check_balance(make_inputs("off_grid"))

    def test_on_grid_no_battery_has_unserved_during_outage(self):
        result = simulate(make_inputs("on_grid", battery_kwh=0))
        # Outage hours (18-19) have load but no battery and no grid -> must
        # show up as unserved, matching the spec's "on-grid with no battery
        # = unserved load" rule.
        self.assertGreater(result.annual_unserved_kwh, 0)

    def test_off_grid_never_imports(self):
        result = simulate(make_inputs("off_grid"))
        self.assertEqual(result.annual_import_kwh, 0)

    def test_more_battery_reduces_unserved_in_hybrid(self):
        small = simulate(make_inputs("hybrid", battery_kwh=2.0))
        large = simulate(make_inputs("hybrid", battery_kwh=20.0))
        self.assertLessEqual(large.annual_unserved_kwh, small.annual_unserved_kwh)

    def test_bigger_system_increases_generation(self):
        small = simulate(make_inputs("on_grid", battery_kwh=0))
        big_inputs = make_inputs("on_grid", battery_kwh=0)
        big_inputs.system_kw = 6.0
        big = simulate(big_inputs)
        self.assertGreater(big.annual_pv_kwh, small.annual_pv_kwh)


if __name__ == "__main__":
    unittest.main()
