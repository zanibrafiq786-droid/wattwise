import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { logAcTurnedOff, setAcOn, setAlertStatus, setLightMode, useAlerts } from "../lib/firebase";
import { Colors, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Button } from "./Button";
import { StatusMessage } from "./StatusMessage";

// Expo Go can't show OS notifications (see lib/notifications.ts), so this is
// the actual alert surface for "AC left on": a banner shown over whatever
// screen is open, not tucked away in a tab the person might not be looking
// at. Driven directly by Firebase -- it shows whenever a "new" ac_left_on
// alert exists, and disappears the instant its status changes.
export function AcAlertBanner({ room = "room1" }: { room?: string }) {
  const { alerts } = useAlerts();
  const colors = useColors();
  const styles = makeStyles(colors);
  const active = alerts?.find((a) => (a.type === "ac_left_on" || a.type === "light_left_on") && a.status === "new");
  const isLight = active?.type === "light_left_on";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!active) return null;

  async function handleTurnedOff() {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isLight) {
        await setLightMode(room, "off"); // the manual light switch goes to Off
        await setAlertStatus(active.id, "acted");
      } else {
        await setAcOn(room, false);
        await setAlertStatus(active.id, "acted");
        await logAcTurnedOff(room, active.id);
      }
    } catch {
      setError("That didn't go through. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleIgnore() {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setAlertStatus(active.id, "dismissed");
    } catch {
      setError("That didn't go through. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.banner}>
          <Text style={styles.title}>{isLight ? "Light left on" : "AC left on"}</Text>
          <Text style={styles.message}>{active.message}</Text>
          <View style={styles.actions}>
            <Button label="I turned it off" variant="primary" onPress={handleTurnedOff} disabled={busy} />
            <Button label="Ignore" variant="secondary" onPress={handleIgnore} disabled={busy} />
          </View>
          <StatusMessage type="error" message={error} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    safe: { backgroundColor: "transparent" },
    banner: {
      margin: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.danger,
      gap: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    title: { color: colors.danger, fontWeight: "800", fontSize: 15 },
    message: { color: colors.text, fontSize: 14, lineHeight: 19 },
    actions: { flexDirection: "row", gap: spacing.sm },
  });
}
