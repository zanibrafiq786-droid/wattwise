import { useEffect, useState } from "react";
import { onValue, push, ref, set, update } from "firebase/database";
import { auth, db } from "../../firebaseConfig";
import { useAuth } from "./authContext";
import {
  Alert,
  AlertStatus,
  AppConfig,
  Bill,
  BillEntry,
  HouseAppliance,
  RoomEvent,
  RoomState,
} from "./types";

// --- Per-account data ---
// Every account's own data lives under /users/{uid}/ (bills, config,
// reports, chat, solar) so two accounts never see each other's numbers.
// The ESP32's sensor paths (/room1/*, /alerts) are written by the firmware
// and can't move, so they're tied to an account instead: an account only
// reads them if /users/{uid}/device points at that room.
function userPath(uid: string, sub: string) {
  return `/users/${uid}/${sub}`;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  return uid;
}

// Which room's sensor (if any) belongs to this account -- null for an
// account with no ESP32 linked.
export function useDevice() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [device, setDevice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setDevice(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onValue(ref(db, userPath(uid, "device")), (snap) => {
      setDevice(snap.exists() ? String(snap.val()) : null);
      setLoading(false);
    });
  }, [uid]);

  return { device, loading };
}

// --- Live room state (/room1/state) ---
// `room` is null when this account has no sensor linked: nothing is read.
export function useRoomState(room: string | null = "room1") {
  const [state, setState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!room) {
      setState(null);
      setLoading(false);
      return;
    }
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

export function useAcOn(room: string | null = "room1") {
  const [acOn, setAcOnState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!room) {
      setAcOnState(false);
      setLoading(false);
      return;
    }
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
// Alerts come from the ESP32 (and the app's AC watcher for that room), so
// only the account the sensor is linked to sees them.
export function useAlerts() {
  const { device, loading: deviceLoading } = useDevice();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deviceLoading) return;
    if (!device) {
      setAlerts([]);
      setLoading(false);
      return;
    }
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
  }, [device, deviceLoading]);

  return { alerts, loading, error };
}

export function setAlertStatus(id: string, status: AlertStatus) {
  return update(ref(db, `/alerts/${id}`), { status });
}

// --- Room events, read once for the report screen (/room1/events) ---
// `source: "simulated"` reads /sim/{room}/events (written only by
// sim/generate_month.py) instead of the real /{room}/events -- used by the
// Report tab's "Data source" toggle (Setup tab). Never affects live
// presence (useRoomState), which always reads the real path.
export function useRoomEvents(room: string | null = "room1", source: "real" | "simulated" = "real") {
  const [events, setEvents] = useState<RoomEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulated demo data is shared (it's not anyone's real data); real
    // events need this account's linked sensor.
    if (!room && source === "real") {
      setEvents([]);
      setLoading(false);
      return;
    }
    const path = source === "simulated" ? `/sim/${room ?? "room1"}/events` : `/${room}/events`;
    const r = ref(db, path);
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
  }, [room, source]);

  return { events, loading, error };
}

// --- Bills (/users/{uid}/bills/{yyyy-mm}) ---
export function useBill(monthKey: string) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const r = ref(db, userPath(uid, `bills/${monthKey}`));
    const unsub = onValue(r, (snap) => {
      setBill(snap.exists() ? (snap.val() as Bill) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [uid, monthKey]);

  return { bill, loading };
}

export function saveBill(monthKey: string, bill: Bill) {
  return set(ref(db, userPath(currentUid(), `bills/${monthKey}`)), bill);
}

// All of this account's bills, sorted oldest -> newest by month key (works
// because "YYYY-MM" sorts correctly as a plain string).
export function useBillHistory() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [bills, setBills] = useState<BillEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const r = ref(db, userPath(uid, "bills"));
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
  }, [uid]);

  return { bills, loading };
}

// Two different questions about a bill:
// - hasUnits: is it usable at all? Units drive the slab, the charts, the
//   forecast and solar sizing -- any month with units counts.
// - isValidBill: is its RUPEE amount a normal bill we can do Rs maths with
//   (Rs 5-150 per unit)? A solar net-metering home's bill can be tiny or a
//   negative credit (e.g. 360 units, Rs 192) -- a REAL bill, but not one to
//   compute "waste as % of the bill" against. Earlier these were wrongly
//   treated as corrupted and hidden entirely.
export function hasUnits(b: Bill): boolean {
  return b.units > 0;
}

export function isValidBill(b: Bill): boolean {
  const a = b.amount_rs;
  if (!(b.units > 0) || a == null || !(a > 0)) return false;
  const rate = a / b.units;
  return rate >= 5 && rate <= 150;
}

// "Rs 17,705", "Rs 784 credit", "Rs 192 (solar credit applied)", or
// "amount not read" -- what the bill says, labelled so it isn't misread.
export function billAmountLabel(b: Bill): string {
  const a = b.amount_rs;
  if (a == null) return "amount not read";
  if (a < 0) return `Rs ${Math.round(-a).toLocaleString()} credit`;
  if (!isValidBill(b)) return `Rs ${Math.round(a).toLocaleString()} (after solar credit)`;
  return `Rs ${Math.round(a).toLocaleString()}`;
}

export function latestValidBill(bills: BillEntry[] | null): BillEntry | null {
  if (!bills) return null;
  for (let i = bills.length - 1; i >= 0; i--) {
    if (isValidBill(bills[i])) return bills[i];
  }
  return null;
}

// --- Config (/config: watts + rate) ---
const DEFAULT_CONFIG: AppConfig = {
  watts: { fan: 75, light: 12, ac: 1500 },
  rate_rs_per_unit: 33,
  // 1 minute so the "AC left on" alert is demo-able quickly; a real
  // deployment would set this higher via /config.
  empty_minutes_threshold: 1,
  // The APP's own presence threshold on rssi_var (see lib/smartPresence.ts),
  // not the firmware's. Default from a real test in this room: empty read
  // 0.29-0.44, a person walking read 0.73-1.24 -- the firmware's own 2.0
  // cut-off never triggered. Overwritten by the in-app Wi-Fi calibration.
  rssi_threshold: 0.6,
};

export function useConfig() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const r = ref(db, userPath(uid, "config"));
    const unsub = onValue(r, (snap) => {
      const val = snap.exists() ? snap.val() : {};
      setConfig({
        watts: { ...DEFAULT_CONFIG.watts, ...(val.watts ?? {}) },
        rate_rs_per_unit: val.rate_rs_per_unit ?? DEFAULT_CONFIG.rate_rs_per_unit,
        empty_minutes_threshold: val.empty_minutes_threshold ?? DEFAULT_CONFIG.empty_minutes_threshold,
        rssi_threshold: val.rssi_threshold ?? DEFAULT_CONFIG.rssi_threshold,
        appliances: val.appliances ? Object.values(val.appliances) : [],
      });
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { config, loading };
}

// update(), not set(): Setup saves only watts/rate/threshold-minutes, and a
// set() would silently wipe fields it doesn't know about (like the Wi-Fi
// calibration's rssi_threshold).
export function saveConfig(config: Partial<AppConfig>) {
  return update(ref(db, userPath(currentUid(), "config")), config);
}

export function saveRssiThreshold(threshold: number) {
  return update(ref(db, userPath(currentUid(), "config")), { rssi_threshold: threshold });
}

export function saveAppliance(a: HouseAppliance) {
  return set(ref(db, userPath(currentUid(), `config/appliances/${a.id}`)), a);
}

export function deleteAppliance(id: string) {
  return set(ref(db, userPath(currentUid(), `config/appliances/${id}`)), null);
}

// --- Month-end AI report (/reports/{yyyy-mm}), written by brain/report.py ---
export interface MonthReport {
  waste_by_appliance?: Record<string, number>;
  text?: string;
  plan_steps?: string[];
}

export function useMonthReport(monthKey: string) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [report, setReport] = useState<MonthReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const r = ref(db, userPath(uid, `reports/${monthKey}`));
    const unsub = onValue(r, (snap) => {
      setReport(snap.exists() ? (snap.val() as MonthReport) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [uid, monthKey]);

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

// --- Profile photo (/users/{uid}/profile/photo) ---
// Stored as a small JPEG data URI (resized to 256 px, ~15-30 KB) straight in
// the Realtime Database, because Firebase Storage needs the paid plan.
export function useProfilePhoto() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setPhoto(null);
      return;
    }
    return onValue(ref(db, userPath(uid, "profile/photo")), (snap) => {
      setPhoto(snap.exists() ? String(snap.val()) : null);
    });
  }, [uid]);

  return photo;
}

// Pass null to remove the photo (back to initials).
export async function saveProfilePhoto(dataUri: string | null) {
  await set(ref(db, userPath(currentUid(), "profile/photo")), dataUri);
}
