import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { logAcTurnedOff, setAcOn, setAlertStatus, useAlerts } from "../lib/firebase";
import { colors, radius, spacing } from "../lib/theme";
import { Button } from "./Button";

// Expo Go can't show OS notifications (see lib/notifications.ts), so this is
// the actual alert surface for "AC left on": a banner shown over whatever
// screen is open, not tucked away in a tab the person might not be looking
// at. Driven directly by Firebase -- it shows whenever a "new" ac_left_on
// alert exists, and disappears the instant its status changes.
export function AcAlertBanner({ room = "room1" }: { room?: string }) {
  const { alerts } = useAlerts();
  const active = alerts?.find((a) => a.type === "ac_left_on" && a.status === "new");

  if (!active) return null;

  async function handleTurnedOff() {
    if (!active) return;
    await setAcOn(room, false);
    await setAlertStatus(active.id, "acted");
    await logAcTurnedOff(room, active.id);
  }

  async function handleIgnore() {
    if (!active) return;
    await setAlertStatus(active.id, "dismissed");
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.banner}>
          <Text style={styles.title}>AC left on</Text>
          <Text style={styles.message}>{active.message}</Text>
          <View style={styles.actions}>
            <Button label="I turned it off" variant="primary" onPress={handleTurnedOff} />
            <Button label="Ignore" variant="secondary" onPress={handleIgnore} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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
