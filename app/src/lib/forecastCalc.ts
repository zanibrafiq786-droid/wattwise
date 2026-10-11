import { AppConfig, BillEntry } from "./types";

export interface MonthForecast {
  month: string; // "YYYY-MM", a future month
  lastYearMonth: string | null; // the "YYYY-MM" one year earlier this was based on
  lastYearUnits: number | null;
  unitsLow: number;
  unitsHigh: number;
  rsLow: number;
  rsHigh: number;
  flaggedHigh: boolean; // trending well above the same month last year
}

function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function billFor(bills: BillEntry[], month: string): BillEntry | undefined {
  return bills.find((b) => b.month === month);
}

// Forecasts the next 3 calendar months using the same month from a year ago
// as the baseline, adjusted by how much this year's overlapping months have
// been trending above/below last year (so a sustained increase in usage
// carries into the forecast, not just a flat repeat of last year). Always a
// range, never a single fake-precise number -- it's a projection, not a
// meter reading.
export function computeForecast(bills: BillEntry[], config: AppConfig, today = new Date()): MonthForecast[] {
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // Trend factor: average ratio of (this year's month / same month last
  // year) over however many recent overlapping months exist, capped so one
  // odd month can't swing the forecast wildly.
  const ratios: number[] = [];
  for (let back = 1; back <= 6; back++) {
    const thisYearMonth = addMonths(currentMonthKey, -back);
    const lastYearMonth = addMonths(thisYearMonth, -12);
    const thisYear = billFor(bills, thisYearMonth);
    const lastYear = billFor(bills, lastYearMonth);
    if (thisYear && lastYear && lastYear.units > 0) {
      ratios.push(thisYear.units / lastYear.units);
    }
  }
  const trendFactor = ratios.length > 0 ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 1;
  const clampedTrend = Math.max(0.5, Math.min(2, trendFactor));

  const forecasts: MonthForecast[] = [];
  for (let ahead = 1; ahead <= 3; ahead++) {
    const month = addMonths(currentMonthKey, ahead);
    const lastYearMonth = addMonths(month, -12);
    const lastYear = billFor(bills, lastYearMonth);

    if (!lastYear) {
      forecasts.push({
        month,
        lastYearMonth,
        lastYearUnits: null,
        unitsLow: 0,
        unitsHigh: 0,
        rsLow: 0,
        rsHigh: 0,
        flaggedHigh: false,
      });
      continue;
    }

    const projectedUnits = lastYear.units * clampedTrend;
    const unitsLow = projectedUnits * 0.85;
    const unitsHigh = projectedUnits * 1.15;
    forecasts.push({
      month,
      lastYearMonth,
      lastYearUnits: lastYear.units,
      unitsLow,
      unitsHigh,
      rsLow: unitsLow * config.rate_rs_per_unit,
      rsHigh: unitsHigh * config.rate_rs_per_unit,
      flaggedHigh: projectedUnits > lastYear.units * 1.15,
    });
  }
  return forecasts;
}
