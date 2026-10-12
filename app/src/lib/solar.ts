// CHATBOT_SOLAR.md Part B4: same Firebase request/reply transport pattern
// as chat.ts, but solar analysis writes one /report (overwritten each run)
// plus a /status the app polls for progress, instead of a reply-per-request.
import { useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { db } from "../../firebaseConfig";

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
}

export interface BillProfile {
  months_count: number;
  annual_kwh: number;
  summer_peak_units: number;
  winter_low_units: number;
  months_over_200: number;
  avg_rate_rs_per_unit: number;
  confidence: "none" | "low" | "medium" | "high";
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
  why: string;
  tradeoffs: string;
  what_could_change_the_answer: string;
  vendor_checklist: string[];
}

export interface SolarReport {
  generated_ts: number;
  simulated: boolean;
  bill_profile: BillProfile;
  user_inputs: SolarRequest;
  candidates: SolarCandidate[];
  recommendation: SolarRecommendation;
}

export type SolarStatus = { state: "running" | "done" | "error"; message?: string; ts: number } | null;

export function runSolarAnalysis(uid: string, inputs: SolarRequest) {
  const id = `req_${Date.now()}`;
  return set(ref(db, `/users/${uid}/solar/requests/${id}`), inputs);
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
