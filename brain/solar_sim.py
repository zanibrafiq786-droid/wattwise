"""
solar_sim.py -- CHATBOT_SOLAR.md Part B2: deterministic hourly solar +
battery dispatch simulation for a typical year (8760 hours). Pure Python,
no AI involved -- the model only ever reads these numbers, never computes
them (same rule as chat_context.py).

Energy balance per hour (what the unit tests check):
  pv + import + battery_discharge = served_load + export + curtailed + charge_losses
where served_load = load - unserved (unserved = load the system couldn't
meet, only possible without a grid connection or during an outage).
"""
from dataclasses import dataclass, field
from typing import Literal

DesignType = Literal["on_grid", "hybrid", "off_grid"]

HOURS_PER_YEAR = 8760


@dataclass
class SimInputs:
    system_kw: float
    battery_kwh: float  # 0 for on_grid
    design: DesignType
    ghi_series: list  # W/m^2, length 8760 (hourly shortwave_radiation)
    load_series: list  # kW, length 8760
    outage_hours: set  # set of hour-of-day ints (0-23) that are typically out
    pr: float = 0.75  # performance ratio
    round_trip_eff: float = 0.90  # applied on charge only (see module docstring)
    dod_limit: float = 0.80  # usable fraction of battery capacity
    rate_rs_per_unit: float = 33.0
    export_rate_rs_per_unit: float = 0.0  # Pakistan is moving to net billing; default no export credit
    cost_per_kw_rs: float = 160000.0  # ASSUMPTION, editable in the app
    cost_per_kwh_battery_rs: float = 55000.0  # ASSUMPTION, editable in the app


@dataclass
class SimResult:
    annual_pv_kwh: float = 0.0
    annual_load_kwh: float = 0.0
    annual_import_kwh: float = 0.0
    annual_export_kwh: float = 0.0
    annual_curtailed_kwh: float = 0.0
    annual_unserved_kwh: float = 0.0
    annual_charge_losses_kwh: float = 0.0
    self_consumption_pct: float = 0.0
    solar_fraction_pct: float = 0.0
    estimated_annual_bill_rs: float = 0.0
    annual_saving_rs: float = 0.0
    system_cost_rs: float = 0.0
    simple_payback_years: float | None = None


def simulate(inputs: SimInputs) -> SimResult:
    max_soc = inputs.battery_kwh
    min_soc = inputs.battery_kwh * (1 - inputs.dod_limit)
    soc = max_soc  # start full
    max_rate_kw = max(inputs.battery_kwh * 0.5, 0.1)  # assume a C/2 battery, ASSUMPTION

    pv_total = load_total = imp_total = exp_total = curtail_total = unserved_total = loss_total = 0.0

    n = min(len(inputs.ghi_series), len(inputs.load_series), HOURS_PER_YEAR)
    for i in range(n):
        hour_of_day = i % 24
        is_outage = hour_of_day in inputs.outage_hours
        pv_kw = inputs.system_kw * (inputs.ghi_series[i] / 1000.0) * inputs.pr
        load_kw = inputs.load_series[i]
        pv_total += pv_kw
        load_total += load_kw

        net = pv_kw - load_kw
        if net >= 0:
            surplus = net
            if inputs.battery_kwh > 0:
                charge = min(surplus, max_rate_kw, (max_soc - soc) / inputs.round_trip_eff if inputs.round_trip_eff > 0 else 0)
                charge = max(0.0, charge)
                soc += charge * inputs.round_trip_eff
                loss_total += charge * (1 - inputs.round_trip_eff)
                surplus -= charge
            if inputs.design in ("on_grid", "hybrid"):
                exp_total += surplus
            else:
                curtail_total += surplus
        else:
            deficit = -net
            if inputs.battery_kwh > 0:
                discharge = min(deficit, max_rate_kw, soc - min_soc)
                discharge = max(0.0, discharge)
                soc -= discharge
                deficit -= discharge
            if is_outage:
                # No grid during an outage regardless of design -- battery
                # (already drawn above) is all that can help.
                unserved_total += deficit
            elif inputs.design in ("on_grid", "hybrid"):
                imp_total += deficit
            else:
                unserved_total += deficit  # off_grid never imports

    served_load = load_total - unserved_total
    self_pv_used = pv_total - exp_total - curtail_total
    result = SimResult(
        annual_pv_kwh=round(pv_total, 1),
        annual_load_kwh=round(load_total, 1),
        annual_import_kwh=round(imp_total, 1),
        annual_export_kwh=round(exp_total, 1),
        annual_curtailed_kwh=round(curtail_total, 1),
        annual_unserved_kwh=round(unserved_total, 1),
        annual_charge_losses_kwh=round(loss_total, 1),
        self_consumption_pct=round((self_pv_used / pv_total * 100) if pv_total > 0 else 0, 1),
        solar_fraction_pct=round((served_load - imp_total) / load_total * 100 if load_total > 0 else 0, 1),
    )

    baseline_bill = load_total * inputs.rate_rs_per_unit
    result.estimated_annual_bill_rs = round(
        imp_total * inputs.rate_rs_per_unit - exp_total * inputs.export_rate_rs_per_unit, 0
    )
    result.annual_saving_rs = round(baseline_bill - result.estimated_annual_bill_rs, 0)
    result.system_cost_rs = round(
        inputs.system_kw * inputs.cost_per_kw_rs + inputs.battery_kwh * inputs.cost_per_kwh_battery_rs, 0
    )
    result.simple_payback_years = (
        round(result.system_cost_rs / result.annual_saving_rs, 1) if result.annual_saving_rs > 0 else None
    )
    return result


def simulate_with_sensitivity(inputs: SimInputs) -> dict:
    """Runs the base case plus a pessimistic/optimistic variant (PR, usage,
    and rate each shifted +-10% together) so results are always a RANGE,
    never a single number presented as exact (CHATBOT_SOLAR.md B2)."""
    base = simulate(inputs)

    def scaled(pr_mult, load_mult, rate_mult):
        scaled_load = [v * load_mult for v in inputs.load_series]
        new_inputs = SimInputs(
            **{**inputs.__dict__, "pr": inputs.pr * pr_mult, "load_series": scaled_load, "rate_rs_per_unit": inputs.rate_rs_per_unit * rate_mult}
        )
        return simulate(new_inputs)

    pessimistic = scaled(0.9, 1.1, 0.9)
    optimistic = scaled(1.1, 0.9, 1.1)

    savings = [pessimistic.annual_saving_rs, base.annual_saving_rs, optimistic.annual_saving_rs]
    paybacks = [p for p in [pessimistic.simple_payback_years, base.simple_payback_years, optimistic.simple_payback_years] if p]

    return {
        "base": base,
        "annual_saving_rs_low": round(min(savings), 0),
        "annual_saving_rs_high": round(max(savings), 0),
        "payback_years_low": round(min(paybacks), 1) if paybacks else None,
        "payback_years_high": round(max(paybacks), 1) if paybacks else None,
    }
