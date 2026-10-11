import React, { useEffect, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { StateView } from "../components/StateView";
import { setAlertStatus, useAlerts } from "../lib/firebase";
import { ensureNotificationPermission, notifyNewAlert } from "../lib/notifications";
import { timeAgo } from "../lib/time";
import { colors, spacing } from "../lib/theme";
import { Alert } from "../lib/types";

export function AlertsScreen() {
  const { alerts, loading, error } = useAlerts();
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    if (!alerts) return;
    if (seenIds.current === null) {
      // First load: remember what's already there, don't notify for old alerts.
      seenIds.current = new Set(alerts.map((a) => a.id));
      return;
    }
    const fresh = alerts.filter((a) => !seenIds.current!.has(a.id));
    for (const a of fresh) {
      notifyNewAlert(a.message);
      seenIds.current.add(a.id);
    }
  }, [alerts]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.title}>Alerts</Text>
      <StateView
        loading={loading}
        error={error}
        empty={!alerts || alerts.length === 0}
        emptyMessage="No alerts yet. You'll see one here if a room is left empty with the fan, light or AC on."
      >
        <FlatList
          data={alerts ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <AlertRow alert={item} />}
        />
      </StateView>
    </SafeAreaView>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const isNew = alert.status === "new";
  return (
    <Card style={styles.card}>
      <View style={styles.rowTop}>
        <Badge
          label={alert.status === "new" ? "New" : alert.status === "acted" ? "Acted" : "Dismissed"}
          color={
            alert.status === "new" ? colors.warning : alert.status === "acted" ? colors.success : colors.textMuted
          }
        />
        <Text style={styles.time}>{timeAgo(alert.ts)}</Text>
      </View>
      <Text style={styles.message}>{alert.message}</Text>
      {typeof alert.wasted_rs_est === "number" && (
        <Text style={styles.waste}>Estimated waste: Rs {alert.wasted_rs_est.toFixed(0)}</Text>
      )}
      {isNew && (
        <View style={styles.actions}>
          <Button
            label="I switched it off"
            variant="primary"
            onPress={() => setAlertStatus(alert.id, "acted")}
          />
          <Button label="Ignore" variant="secondary" onPress={() => setAlertStatus(alert.id, "dismissed")} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 24, fontWeight: "800", padding: spacing.md, paddingBottom: 0 },
  list: { padding: spacing.md, gap: spacing.md },
  card: { gap: spacing.sm },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { color: colors.textMuted, fontSize: 12 },
  message: { color: colors.text, fontSize: 15 },
  waste: { color: colors.warning, fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
