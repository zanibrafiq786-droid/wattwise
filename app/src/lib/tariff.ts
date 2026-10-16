// "What would my bill be?" -- see brain/tariff.py. The AI only supplies the
// tariff structure (slab rates, fixed charge, per-unit adjustment, tax %).
// The bill itself is plain arithmetic here, so it is exact for the rates shown
// and instant for any number of units.
import { useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { db } from "../../firebaseConfig";
import { runInCloud } from "./cloudBrain";

export interface TariffSlab {
  up_to: number | null; // cumulative units per month; null = no upper limit
  rate: number; // price per unit
}

export interface TariffSchedule {
  area_label: string;
  area_asked?: string;
  currency: string;
  as_of: string;
  mode: "telescopic" | "flat_by_slab";
  slabs: TariffSlab[];
  fixed_charge: number;
  extra_per_unit: number;
  tax_percent: number;
  notes: string[];
  confidence: "high" | "medium" | "low";
  generated_ts: number;
}

export interface BillLine {
  label: string;
  amount: number;
}

export interface BillCalc {
  lines: BillLine[]; // energy by slab, fixed, adjustment, tax
  total: number;
  perUnit: number; // effective price per unit
}

// How much the tariff knowledge could be off (it comes from the AI's memory
// and tariffs change often), so the result is shown as a range.
export const TARIFF_MARGIN = 0.08;

export function calcBill(s: TariffSchedule, units: number): BillCalc {
  const lines: BillLine[] = [];
  let energy = 0;
  if (units > 0) {
    if (s.mode === "flat_by_slab") {
      const slab = s.slabs.find((sl) => sl.up_to === null || units <= sl.up_to) ?? s.slabs[s.slabs.length - 1];
      energy = units * slab.rate;
      lines.push({ label: `${Math.round(units)} units × ${fmtRate(slab.rate)}`, amount: energy });
    } else {
      let from = 0;
      for (const sl of s.slabs) {
        const to = sl.up_to === null ? Infinity : sl.up_to;
        const inSlab = Math.min(units, to) - from;
        if (inSlab > 0) {
          const amt = inSlab * sl.rate;
          energy += amt;
          lines.push({ label: `${Math.round(inSlab)} units × ${fmtRate(sl.rate)}`, amount: amt });
        }
        from = to;
        if (units <= to) break;
      }
    }
  }
  const adjust = units > 0 ? units * s.extra_per_unit : 0;
  if (adjust > 0) lines.push({ label: "Fuel / price adjustment", amount: adjust });
  const fixed = units > 0 ? s.fixed_charge : 0;
  if (fixed > 0) lines.push({ label: "Fixed charges", amount: fixed });
  const tax = ((energy + adjust + fixed) * s.tax_percent) / 100;
  if (tax > 0) lines.push({ label: `Taxes (${trim(s.tax_percent)}%)`, amount: tax });
  const total = energy + adjust + fixed + tax;
  return { lines, total, perUnit: units > 0 ? total / units : 0 };
}

function fmtRate(r: number) {
  return trim(r);
}
function trim(n: number) {
  return String(Math.round(n * 100) / 100);
}

// --- Firebase: /users/{uid}/tariff/{schedule,status,requests} ---
export type TariffStatus = { state: "running" | "done" | "error"; message?: string } | null;

export function useTariff(uid: string | null) {
  const [schedule, setSchedule] = useState<TariffSchedule | null>(null);
  const [status, setStatus] = useState<TariffStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const offSchedule = onValue(ref(db, `/users/${uid}/tariff/schedule`), (snap) => {
      setSchedule(snap.exists() ? (snap.val() as TariffSchedule) : null);
      setLoading(false);
    });
    const offStatus = onValue(ref(db, `/users/${uid}/tariff/status`), (snap) => {
      setStatus(snap.exists() ? (snap.val() as TariffStatus) : null);
    });
    return () => {
      offSchedule();
      offStatus();
    };
  }, [uid]);

  return { schedule, status, loading };
}

export function requestTariff(uid: string, area: string) {
  const id = `req_${Date.now()}`;
  return set(ref(db, `/users/${uid}/tariff/requests/${id}`), { area, ts: Date.now() }).then(() => runInCloud("tariff", id));
}
