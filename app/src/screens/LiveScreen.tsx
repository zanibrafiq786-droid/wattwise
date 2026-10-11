import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { StateView } from "../components/StateView";
import { setAcOn, useAcOn, useRoomState } from "../lib/firebase";
import { timeAgo } from "../lib/time";
import { colors, spacing } from "../lib/theme";
import { Presence } from "../lib/types";

const PRESENCE_LABEL: Record<Presence, string> = {
  active: "Active",
  quiet: "Quiet",
  empty: "Empty",
};

function presenceColor(p: Presence) {
  if (p === "active") return colors.active;
  if (p === "quiet") return colors.quiet;
  return colors.empty;
}

export function LiveScreen() {
  const { state, loading, error } = useRoomState("room1");
  const { acOn: acOnRemote } = useAcOn("room1");
  const [acOnOverride, setAcOnOverride] = useState<boolean | null>(null);
  const acOn = acOnOverride ?? acOnRemote;
  const [acBusy, setAcBusy] = useState(false);

  async function toggleAc(value: boolean) {
    setAcOnOverride(value);
    setAcBusy(true);
    try {
      await setAcOn("room1", value);
    } finally {
      setAcBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Room 1</Text>
        <StateView loading={loading} error={error} empty={!state} emptyMessage="No data from the sensor yet. Make sure the ESP32 is powered on and connected.">
          {state && (
            <>
              <Card style={styles.presenceCard}>
                <View style={styles.presenceHeader}>
                  <Badge
                    label={PRESENCE_LABEL[state.presence] ?? "Unknown"}
                    color={presenceColor(state.presence)}
                  />
                  <Text style={styles.updated}>Updated {timeAgo(state.updated_at)}</Text>
                </View>
                <View style={styles.readingRow}>
                  <Reading label="Temperature" value={`${state.temp_c.toFixed(1)} C`} />
                  <Reading label="Humidity" value={`${state.humidity.toFixed(0)}%`} />
                </View>
              </Card>

              <View style={styles.row}>
                <Card style={styles.half}>
                  <Text style={styles.deviceLabel}>Light</Text>
                  <Badge
                    label={state.light_on ? "On" : "Off"}
                    color={state.light_on ? colors.warning : colors.textMuted}
                  />
                </Card>
                <Card style={styles.half}>
                  <Text style={styles.deviceLabel}>Fan</Text>
                  <Badge
                    label={state.fan_on ? "On" : "Off"}
                    color={state.fan_on ? colors.primary : colors.textMuted}
                  />
                </Card>
              </View>

              <Card>
                <View style={styles.acRow}>
                  <View>
                    <Text style={styles.deviceLabel}>AC</Text>
                    <Text style={styles.muted}>Tap to tell the app the AC is on (no sensor)</Text>
                  </View>
                  <Switch
                    value={acOn}
                    onValueChange={toggleAc}
                    disabled={acBusy}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>
              </Card>

              <Card style={styles.wifiCard}>
                <Text style={styles.deviceLabel}>Light sensor (raw)</Text>
                <Text style={styles.muted}>
                  See the Room tab for the live Wi-Fi motion view and signal chart.
                </Text>
                <View style={styles.row}>
                  <Reading label="LDR reading" value={String(state.ldr)} />
                  <Reading label="Vibration" value={state.vib.toFixed(3)} />
                </View>
              </Card>
            </>
          )}
        </StateView>
      </ScrollView>
    </SafeAreaView>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reading}>
      <Text style={styles.readingValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  presenceCard: { gap: spacing.md },
  presenceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  updated: { color: colors.textMuted, fontSize: 12 },
  readingRow: { flexDirection: "row", gap: spacing.lg },
  reading: { gap: 2 },
  readingValue: { color: colors.text, fontSize: 20, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1, gap: spacing.sm },
  deviceLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  acRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  wifiCard: { gap: spacing.sm },
});
