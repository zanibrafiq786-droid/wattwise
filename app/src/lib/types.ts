// These shapes mirror exactly what the ESP32 firmware writes to Firebase.
// Do not rename fields here without also changing the firmware.

export type Presence = "active" | "quiet" | "empty";

export interface RoomState {
  presence: Presence;
  light_on: boolean;
  fan_on: boolean;
  temp_c: number;
  humidity: number;
  ldr: number;
  vib: number;
  rssi_var: number;
  updated_at: number; // unix milliseconds (firmware writes Date.now()-style)
}

export interface RoomStateUser {
  ac_on: boolean;
}

export interface RoomEvent {
  ts: number; // unix milliseconds
  presence: Presence;
  light_on: boolean;
  fan_on: boolean;
}

export type AlertStatus = "new" | "acted" | "dismissed";

export interface Alert {
  id: string;
  ts: number; // unix milliseconds
  room: string;
  type: string;
  message: string;
  status: AlertStatus;
  wasted_rs_est?: number;
}

export interface Bill {
  units: number;
  // As printed on the bill. Can be small or NEGATIVE (a credit) for homes
  // with solar net-metering; missing when the scan couldn't read it.
  amount_rs?: number | null;
}

export interface BillEntry extends Bill {
  month: string; // "YYYY-MM"
}

export interface ApplianceWatts {
  fan: number;
  light: number;
  ac: number;
}

// A household appliance the user adds themselves (whole house, not just
// the sensed room) -- used to estimate daily usage for the solar advice.
export interface HouseAppliance {
  id: string;
  name: string;
  watts: number;
  hours_per_day: number;
  quantity: number;
}

export interface AppConfig {
  watts: ApplianceWatts;
  rate_rs_per_unit: number;
  empty_minutes_threshold: number;
  // The app's presence threshold on rssi_var (lib/smartPresence.ts), set by
  // the in-app Wi-Fi calibration. Falls back to a default -- see useConfig().
  rssi_threshold?: number;
  appliances?: HouseAppliance[];
}

export interface AcLogEntry {
  ts: number; // unix milliseconds
  action: "turned_off_via_alert";
  alert_id: string;
}
