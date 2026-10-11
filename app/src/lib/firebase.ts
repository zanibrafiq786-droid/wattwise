import { useEffect, useState } from "react";
import { onValue, push, ref, set, update } from "firebase/database";
import { db } from "../../firebaseConfig";
import {
  Alert,
  AlertStatus,
  AppConfig,
  Bill,
  BillEntry,
  RoomEvent,
  RoomState,
} from "./types";

// --- Live room state (/room1/state) ---
export function useRoomState(room = "room1") {
  const [state, setState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = ref(db, `/${room}/state`);
    const unsub = onValue(
      r,
      (snap) => {
        setState(snap.exists() ? (snap.val() as RoomState) : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [room]);

  return { state, loading, error };
}

export function setAcOn(room: string, acOn: boolean) {
  return update(ref(db, `/${room}/state_user`), { ac_on: acOn });
}

export function useAcOn(room = "room1") {
  const [acOn, setAcOnState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = ref(db, `/${room}/state_user/ac_on`);
    const unsub = onValue(r, (snap) => {
      setAcOnState(snap.exists() ? Boolean(snap.val()) : false);
      setLoading(false);
    });
    return () => unsub();
  }, [room]);

  return { acOn, loading };
}

// --- Alerts (/alerts) ---
export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = ref(db, "/alerts");
    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.val() as Record<string, Omit<Alert, "id">> | null;
        const list = val
          ? Object.entries(val)
              .map(([id, a]) => ({ id, ...a }))
              .sort((a, b) => b.ts - a.ts)
          : [];
        setAlerts(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { alerts, loading, error };
}

export function setAlertStatus(id: string, status: AlertStatus) {
  return update(ref(db, `/alerts/${id}`), { status });
}

// --- Room events, read once for the report screen (/room1/events) ---
export function useRoomEvents(room = "room1") {
  const [events, setEvents] = useState<RoomEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = ref(db, `/${room}/events`);
    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.val() as Record<string, RoomEvent> | null;
        setEvents(val ? Object.values(val).sort((a, b) => a.ts - b.ts) : []);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [room]);

  return { events, loading, error };
}

// --- Bills (/bills/{yyyy-mm}) ---
export function useBill(monthKey: string) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = ref(db, `/bills/${monthKey}`);
    const unsub = onValue(r, (snap) => {
      setBill(snap.exists() ? (snap.val() as Bill) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [monthKey]);

  return { bill, loading };
}

export function saveBill(monthKey: string, bill: Bill) {
  return set(ref(db, `/bills/${monthKey}`), bill);
}

// All bills, sorted oldest -> newest by month key (works because "YYYY-MM"
// sorts correctly as a plain string).
export function useBillHistory() {
  const [bills, setBills] = useState<BillEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = ref(db, "/bills");
    const unsub = onValue(r, (snap) => {
      const val = snap.val() as Record<string, Bill> | null;
      const list = val
        ? Object.entries(val)
            .map(([month, b]) => ({ month, ...b }))
            .sort((a, b) => a.month.localeCompare(b.month))
        : [];
      setBills(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { bills, loading };
}

// --- Config (/config: watts + rate) ---
const DEFAULT_CONFIG: AppConfig = {
  watts: { fan: 75, light: 12, ac: 1500 },
  rate_rs_per_unit: 33,
  // 1 minute so the "AC left on" alert is demo-able quickly; a real
  // deployment would set this higher via /config.
  empty_minutes_threshold: 1,
  // Rough default until brain/calibrate.py writes a real calibrated value.
  rssi_threshold: 1.5,
};

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = ref(db, "/config");
    const unsub = onValue(r, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setConfig({
          watts: { ...DEFAULT_CONFIG.watts, ...val.watts },
          rate_rs_per_unit: val.rate_rs_per_unit ?? DEFAULT_CONFIG.rate_rs_per_unit,
          empty_minutes_threshold: val.empty_minutes_threshold ?? DEFAULT_CONFIG.empty_minutes_threshold,
          rssi_threshold: val.rssi_threshold ?? DEFAULT_CONFIG.rssi_threshold,
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { config, loading };
}

export function saveConfig(config: AppConfig) {
  return set(ref(db, "/config"), config);
}

// --- Month-end AI report (/reports/{yyyy-mm}), written by brain/report.py ---
export interface MonthReport {
  waste_by_appliance?: Record<string, number>;
  text?: string;
  plan_steps?: string[];
}

export function useMonthReport(monthKey: string) {
  const [report, setReport] = useState<MonthReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = ref(db, `/reports/${monthKey}`);
    const unsub = onValue(r, (snap) => {
      setReport(snap.exists() ? (snap.val() as MonthReport) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [monthKey]);

  return { report, loading };
}

// --- Simulated-data flag (/meta/simulated), set by /sim scripts when they
// seed a demo month so the app can label it honestly. ---
export function useSimulatedFlag() {
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    const r = ref(db, "/meta/simulated");
    const unsub = onValue(r, (snap) => {
      setSimulated(snap.exists() ? Boolean(snap.val()) : false);
    });
    return () => unsub();
  }, []);

  return simulated;
}

// --- AC-left-on alert (app-side detection, no firmware change) ---
export function createAcLeftOnAlert(room: string, rsPerHour: number) {
  return push(ref(db, "/alerts"), {
    ts: Date.now(),
    room,
    type: "ac_left_on",
    status: "new",
    message: `Room is empty but AC is on. Turn it off to save about Rs ${rsPerHour.toFixed(0)} per hour.`,
    wasted_rs_est: rsPerHour,
  });
}

export function logAcTurnedOff(room: string, alertId: string) {
  return push(ref(db, `/${room}/ac_log`), {
    ts: Date.now(),
    action: "turned_off_via_alert",
    alert_id: alertId,
  });
}

export { push, ref as dbRef };
