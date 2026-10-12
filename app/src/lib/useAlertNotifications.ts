import { useEffect, useRef } from "react";
import { useAlerts } from "./firebase";
import { ensureNotificationPermission, notifyNewAlert } from "./notifications";

// Shows a phone notification (a pop-up banner in the notification shade)
// for every NEW alert -- mounted once at the app root, so it works whichever
// screen is open and also while the app is in the background.
// Alerts that already existed when the app opened are not re-notified.
// Note: when the app is fully closed (swiped away), nothing runs, so no
// notification appears -- that would need server push (a next step).
export function useAlertNotifications() {
  const { alerts } = useAlerts();
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    if (!alerts) return;
    if (seenIds.current === null) {
      seenIds.current = new Set(alerts.map((a) => a.id));
      return;
    }
    for (const a of alerts) {
      if (seenIds.current.has(a.id)) continue;
      seenIds.current.add(a.id);
      if (a.status === "new") notifyNewAlert(a.message);
    }
  }, [alerts]);
}
