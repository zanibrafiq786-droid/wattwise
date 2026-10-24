import { useEffect, useRef } from "react";
import { createLightLeftOnAlert, useConfig, useLightMode, useRoomState } from "./firebase";
import { useSmartPresence } from "./smartPresence";

// Same idea as the AC watcher: raises ONE "light_left_on" alert per period in
// which the room is empty and the light is on. It only watches the MANUAL
// light switch ("On" in the Devices sheet). When the light comes from the real
// sensor, the ESP32 raises its own alert, so this stays quiet to avoid doubles.
export function useLightLeftOnWatcher(room: string | null) {
  const { state } = useRoomState(room);
  const lightMode = useLightMode(room);
  const { config } = useConfig();
  const alertedThisPeriod = useRef(false);
  const { presence } = useSmartPresence(state, config.rssi_threshold ?? 0.6);

  useEffect(() => {
    const conditionMet = !!room && !!state && presence === "empty" && lightMode === "on";
    if (!conditionMet) {
      alertedThisPeriod.current = false;
      return;
    }
    if (alertedThisPeriod.current) return;

    const timer = setTimeout(() => {
      const rsPerHour = (config.watts.light / 1000) * config.rate_rs_per_unit;
      if (room) createLightLeftOnAlert(room, rsPerHour);
      alertedThisPeriod.current = true;
    }, config.empty_minutes_threshold * 60 * 1000);

    // Presence changing, or the switch going off, cancels the wait: it must be continuous.
    return () => clearTimeout(timer);
  }, [presence, !!state, lightMode, config.empty_minutes_threshold, config.watts.light, config.rate_rs_per_unit, room]); // eslint-disable-line react-hooks/exhaustive-deps
}
