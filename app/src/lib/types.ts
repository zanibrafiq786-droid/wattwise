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
  amount_rs: number;
}

export interface ApplianceWatts {
  fan: number;
  light: number;
  ac: number;
}

export interface AppConfig {
  watts: ApplianceWatts;
  rate_rs_per_unit: number;
}
