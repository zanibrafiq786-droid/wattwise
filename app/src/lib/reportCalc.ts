import { AppConfig, Bill, RoomEvent } from "./types";

export interface ApplianceWaste {
  key: "fan" | "light";
  label: string;
  hoursLow: number;
  hoursHigh: number;
  rsLow: number;
  rsHigh: number;
}

export interface WasteReport {
  appliances: ApplianceWaste[];
  totalRsLow: number;
  totalRsHigh: number;
  percentOfBillLow: number | null;
  percentOfBillHigh: number | null;
  daysCovered: number;
}

// Walks the sorted state-change event log and sums up how long each
// appliance was left on while the room was empty. Each event marks the
// START of a state that lasts until the next event, so the duration of
// event[i] is (event[i+1].ts - event[i].ts). The very last event's duration
// is unknown (it's still ongoing), so it's ignored.
// The firmware writes event.ts as unix MILLISECONDS, so divide by 1000 to
// get seconds -- see lib/time.ts.
function sumEmptyOnSeconds(events: RoomEvent[], key: "light_on" | "fan_on") {
  let seconds = 0;
  for (let i = 0; i < events.length - 1; i++) {
    const cur = events[i];
    const next = events[i + 1];
    const durationSeconds = (next.ts - cur.ts) / 1000;
    if (durationSeconds <= 0) continue;
    if (cur.presence === "empty" && cur[key]) {
      seconds += durationSeconds;
    }
  }
  return seconds;
}

// Builds a waste estimate from real logged events, a bill, and configured
// appliance wattages. Numbers are given as low-high RANGES (+/-20%) because
// a single sensor-derived figure would be false precision -- we are
// estimating from presence + on/off state, not metering actual current.
export function computeWasteReport(
  events: RoomEvent[],
  config: AppConfig,
  bill: Bill | null
): WasteReport {
  const fanSeconds = sumEmptyOnSeconds(events, "fan_on");
  const lightSeconds = sumEmptyOnSeconds(events, "light_on");

  const toAppliance = (
    key: "fan" | "light",
    label: string,
    seconds: number,
    watts: number
  ): ApplianceWaste => {
    const hours = seconds / 3600;
    const units = (hours * watts) / 1000;
    const rs = units * config.rate_rs_per_unit;
    return {
      key,
      label,
      hoursLow: hours * 0.8,
      hoursHigh: hours * 1.2,
      rsLow: rs * 0.8,
      rsHigh: rs * 1.2,
    };
  };

  const appliances = [
    toAppliance("fan", "Fan", fanSeconds, config.watts.fan),
    toAppliance("light", "Light", lightSeconds, config.watts.light),
  ];

  const totalRsLow = appliances.reduce((s, a) => s + a.rsLow, 0);
  const totalRsHigh = appliances.reduce((s, a) => s + a.rsHigh, 0);

  const amount = bill?.amount_rs ?? 0;
  const percentOfBillLow = amount > 0 ? (totalRsLow / amount) * 100 : null;
  const percentOfBillHigh = amount > 0 ? (totalRsHigh / amount) * 100 : null;

  const daysCovered =
    events.length > 1 ? (events[events.length - 1].ts - events[0].ts) / 1000 / 86400 : 0;

  return { appliances, totalRsLow, totalRsHigh, percentOfBillLow, percentOfBillHigh, daysCovered };
}
