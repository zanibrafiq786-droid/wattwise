// CHATBOT_SOLAR.md Part B4: same Firebase request/reply transport pattern
// as chat.ts, but solar analysis writes one /report (overwritten each run)
// plus a /status the app polls for progress, instead of a reply-per-request.
import { useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { db } from "../../firebaseConfig";
import { runInCloud } from "./cloudBrain";

export interface SolarRequest {
  lat: number;
  lon: number;
  daytime_share: number; // 0-1
  ac_afternoon: boolean;
  outage_hours_per_day: number;
  outage_start_hour: number;
  cost_per_kw_rs: number;
  cost_per_kwh_battery_rs: number;
  export_rate_rs_per_unit: number;
  roof_direction: "south" | "east" | "west" | "north";
  tilt_deg: number;
  region: SolarRegion;
}

// Where the home is, so the AI applies that region's solar rules (what's
// allowed, approvals, buy-back). `assumed` = GPS wasn't available.
export interface SolarRegion {
  country?: string;
  province?: string;
  city?: string;
  assumed?: boolean;
}

export interface BillProfile {
  months_count: number;
  annual_kwh: number;
  summer_peak_units: number;
  winter_low_units: number;
  months_over_200: number;
  avg_rate_rs_per_unit: number;
  confidence: "none" | "low" | "medium" | "high";
  roof_direction?: "south" | "east" | "west" | "north";
  tilt_deg?: number;
}

export interface SolarCandidate {
  target_offset_pct: number;
  design: "on_grid" | "hybrid" | "off_grid";
  system_kw: number;
  battery_kwh: number;
  annual_pv_kwh: number;
  self_consumption_pct: number;
  solar_fraction_pct: number;
  annual_unserved_kwh: number;
  estimated_annual_bill_rs: number;
  annual_saving_rs_low: number;
  annual_saving_rs_high: number;
  system_cost_rs: number;
  payback_years_low: number | null;
  payback_years_high: number | null;
}

export interface SolarRecommendation {
  chosen: { design: string; system_kw: number; battery_kwh: number };
  headline?: string;
  why: string;
  tradeoffs: string;
  region_note?: string;
  what_could_change_the_answer: string;
  vendor_checklist: string[];
}

export interface SolarReport {
  generated_ts: number;
  simulated: boolean;
  region?: SolarRegion;
  bill_profile: BillProfile;
  user_inputs: SolarRequest;
  candidates: SolarCandidate[];
  recommendation: SolarRecommendation;
}

export type SolarStatus = { state: "running" | "done" | "error"; message?: string; ts: number } | null;

// Mirrors brain/solar_sizing.py's bill_profile() + smart_defaults() so the
// Solar screen can pre-fill its inputs from the user's real bill history
// instead of showing blank/generic defaults the user doesn't understand
// (CHATBOT_SOLAR.md feedback). Same Rs/unit sanity bound as the Python side,
// to skip any corrupted bill-import rows.
export function computeSmartDefaults(bills: { units: number; amount_rs?: number | null }[]): {
  daytime_share: number;
  ac_afternoon: boolean;
  monthsCount: number;
} {
  // Units only -- a solar net-metering bill's rupee amount can be tiny or
  // negative, but its units are still the real usage.
  const valid = (bills || []).filter((b) => b.units > 0).slice(-12);
  if (valid.length === 0) {
    return { daytime_share: 0.35, ac_afternoon: false, monthsCount: 0 };
  }
  const units = valid.map((b) => b.units);
  const summer = Math.max(...units);
  const winter = Math.max(Math.min(...units), 1);
  const acAfternoon = (summer - winter) / winter > 0.4;
  return { daytime_share: acAfternoon ? 0.45 : 0.35, ac_afternoon: acAfternoon, monthsCount: valid.length };
}

export function runSolarAnalysis(uid: string, inputs: SolarRequest) {
  const id = `req_${Date.now()}`;
  return set(ref(db, `/users/${uid}/solar/requests/${id}`), inputs).then(() => runInCloud("solar", id));
}

export function useSolarStatus(uid: string | null) {
  const [status, setStatus] = useState<SolarStatus>(null);
  useEffect(() => {
    if (!uid) return;
    return onValue(ref(db, `/users/${uid}/solar/status`), (snap) => setStatus(snap.val()));
  }, [uid]);
  return status;
}

export function useSolarReport(uid: string | null) {
  const [report, setReport] = useState<SolarReport | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) return;
    return onValue(ref(db, `/users/${uid}/solar/report`), (snap) => {
      setReport(snap.exists() ? (snap.val() as SolarReport) : null);
      setLoading(false);
    });
  }, [uid]);
  return { report, loading };
}
