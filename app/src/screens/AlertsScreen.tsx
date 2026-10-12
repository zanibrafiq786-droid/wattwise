import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { StateView } from "../components/StateView";
import { StatusMessage } from "../components/StatusMessage";
import { setAlertStatus, useAlerts } from "../lib/firebase";
import { useI18n } from "../lib/i18n";
import { timeAgo } from "../lib/time";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Alert } from "../lib/types";

export function AlertsScreen() {
  const { alerts, loading, error } = useAlerts();
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const navigation = useNavigation();

  // Phone notifications for new alerts are handled app-wide in
  // useAlertNotifications (mounted in MainTabs), not here.

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{t("alerts")}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Icon name="x" size={22} color={colors.text} />
        </Pressable>
      </View>
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
  const colors = useColors();
  const styles = makeStyles(colors);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(next: "acted" | "dismissed") {
    setError(null);
    try {
      await setAlertStatus(alert.id, next);
    } catch {
      setError(t("actionFailed"));
    }
  }

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
          <Button label={t("switchedOff")} variant="primary" icon="check" onPress={() => updateStatus("acted")} />
          <Button label={t("ignore")} variant="secondary" icon="x" onPress={() => updateStatus("dismissed")} />
        </View>
      )}
      <StatusMessage type="error" message={error} />
    </Card>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
      paddingBottom: 0,
    },
    closeButton: { padding: spacing.xs },
    title: { color: colors.text, fontSize: 34, fontFamily: fonts.headingMedium },
    list: { padding: spacing.md, gap: spacing.md },
    card: { gap: spacing.sm },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    time: { color: colors.textMuted, fontSize: 12 },
    message: { color: colors.text, fontSize: 15 },
    waste: { color: colors.warning, fontSize: 13, fontWeight: "600" },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  });
}
