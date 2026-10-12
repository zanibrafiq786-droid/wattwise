import React, { useEffect, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { StateView } from "../components/StateView";
import { setAlertStatus, useAlerts } from "../lib/firebase";
import { useI18n } from "../lib/i18n";
import { ensureNotificationPermission, notifyNewAlert } from "../lib/notifications";
import { timeAgo } from "../lib/time";
import { colors, spacing } from "../lib/theme";
import { Alert } from "../lib/types";

export function AlertsScreen() {
  const { alerts, loading, error } = useAlerts();
  const seenIds = useRef<Set<string> | null>(null);
  const { t } = useI18n();

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
      <Text style={styles.title}>{t("alerts")}</Text>
      <StateView
        loading={loading}
        error={error}
        empty={!alerts || alerts.length === 0}
        emptyMessage={t("noAlertsYet")}
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
  const { t } = useI18n();
  return (
    <Card style={styles.card}>
      <View style={styles.rowTop}>
        <Badge
          label={alert.status === "new" ? t("statusNew") : alert.status === "acted" ? t("statusActed") : t("statusDismissed")}
          color={
            alert.status === "new" ? colors.warning : alert.status === "acted" ? colors.success : colors.textMuted
          }
        />
        <Text style={styles.time}>{timeAgo(alert.ts)}</Text>
      </View>
      <Text style={styles.message}>{alert.message}</Text>
      {typeof alert.wasted_rs_est === "number" && (
        <Text style={styles.waste}>
          {t("estimatedWaste")}: Rs {alert.wasted_rs_est.toFixed(0)}
        </Text>
      )}
      {isNew && (
        <View style={styles.actions}>
          <Button label={t("switchedOff")} variant="primary" onPress={() => setAlertStatus(alert.id, "acted")} />
          <Button label={t("ignore")} variant="secondary" onPress={() => setAlertStatus(alert.id, "dismissed")} />
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
