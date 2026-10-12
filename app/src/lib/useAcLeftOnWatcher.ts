import { useEffect, useRef } from "react";
import { createAcLeftOnAlert, useAcOn, useConfig, useRoomState } from "./firebase";
import { useSmartPresence } from "./smartPresence";

// Watches presence + AC state and raises exactly one "ac_left_on" alert per
// continuous empty-with-AC-on period. Meant to be mounted ONCE at the app
// root (not per-screen) so the timer survives regardless of which tab is
// open. This is entirely app-side -- the firmware only reports presence, it
// doesn't know anything about the AC.
export function useAcLeftOnWatcher(room: string | null) {
  const { state } = useRoomState(room);
  const { acOn } = useAcOn(room);
  const { config } = useConfig();

  // True once an alert has been raised for the CURRENT empty+AC-on period.
  // Reset as soon as the period ends (presence becomes active, or the AC
  // goes off), so the next period can raise its own alert.
  const alertedThisPeriod = useRef(false);

  // Same presence decision as the Home screen (not the firmware's raw
  // `presence`, which in testing said "empty" while someone walked around
  // -- that would have raised AC alerts with people in the room).
  const { presence } = useSmartPresence(state, config.rssi_threshold ?? 0.6);

  useEffect(() => {
    const conditionMet = !!room && !!state && presence === "empty" && acOn === true;

    if (!conditionMet) {
      alertedThisPeriod.current = false;
      return;
    }
    if (alertedThisPeriod.current) {
      return; // already alerted this period, don't start another timer
    }

    const thresholdMs = config.empty_minutes_threshold * 60 * 1000;
    const timer = setTimeout(() => {
      const rsPerHour = (config.watts.ac / 1000) * config.rate_rs_per_unit;
      if (room) createAcLeftOnAlert(room, rsPerHour);
      alertedThisPeriod.current = true;
    }, thresholdMs);

    // If presence/acOn changes before the timer fires, this cancels it --
    // that's what makes the threshold "continuous", not just elapsed time.
    return () => clearTimeout(timer);
  }, [presence, !!state, acOn, config.empty_minutes_threshold, config.watts.ac, config.rate_rs_per_unit, room]); // eslint-disable-line react-hooks/exhaustive-deps
}
