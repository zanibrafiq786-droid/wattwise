import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { StateView } from "../components/StateView";
import { Toggle } from "../components/Toggle";
import { useAuth } from "../lib/authContext";
import { setAcOn, useAcOn, useAlerts, useRoomState } from "../lib/firebase";
import { TranslationKey, useI18n } from "../lib/i18n";
import { timeAgo } from "../lib/time";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Presence } from "../lib/types";

const PRESENCE_LABEL_KEY: Record<Presence, TranslationKey> = {
  active: "presenceActive",
  quiet: "presenceQuiet",
  empty: "presenceEmpty",
};

function presenceColor(colors: Colors, p: Presence) {
  if (p === "active") return colors.active;
  if (p === "quiet") return colors.quiet;
  return colors.empty;
}

export function LiveScreen() {
  const colors = useColors();
  const styles = makeStyles(colors);
  const { state, loading, error } = useRoomState("room1");
  const { acOn: acOnRemote } = useAcOn("room1");
  const [acOnOverride, setAcOnOverride] = useState<boolean | null>(null);
  const acOn = acOnOverride ?? acOnRemote;
  const [acBusy, setAcBusy] = useState(false);
  const { t } = useI18n();
  const { user, displayName } = useAuth();
  const navigation = useNavigation();
  const firstName = displayName?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const { alerts } = useAlerts();
  const newAlertCount = alerts?.filter((a) => a.status === "new").length ?? 0;

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
      <Pressable style={styles.chatFab} onPress={() => (navigation as any).navigate("Chat")}>
        <Icon name="send" size={22} color="#FFFFFF" />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {t("hello", { name: firstName })}
          </Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.bellButton} onPress={() => (navigation as any).navigate("Alerts")}>
              <Icon name="bell" size={20} color={colors.text} />
              {newAlertCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{newAlertCount}</Text>
                </View>
              )}
            </Pressable>
            <Avatar
              name={displayName}
              email={user?.email}
              onPress={() => (navigation as any).navigate("Account")}
            />
          </View>
        </View>
        <StateView loading={loading} error={error} empty={!state} emptyMessage={t("noSensorData")}>
          {state && (
            <>
              <Card style={styles.presenceCard}>
                <View style={styles.presenceHeader}>
                  <Badge
                    label={t(PRESENCE_LABEL_KEY[state.presence]) ?? "?"}
                    color={presenceColor(colors, state.presence)}
                  />
                  <Text style={styles.updated}>{t("updatedAgo", { time: timeAgo(state.updated_at) })}</Text>
                </View>
                <View style={styles.readingRow}>
                  <Reading label={t("temperature")} value={`${state.temp_c.toFixed(1)} C`} />
                  <Reading label={t("humidity")} value={`${state.humidity.toFixed(0)}%`} />
                </View>
              </Card>

              <View style={styles.row}>
                <Card style={styles.half}>
                  <View style={styles.deviceIconRow}>
                    <Icon name="bulb" size={20} color={state.light_on ? colors.warning : colors.textMuted} />
                    <Text style={styles.deviceLabel}>{t("light")}</Text>
                  </View>
                  <Badge
                    label={state.light_on ? t("on") : t("off")}
                    color={state.light_on ? colors.warning : colors.textMuted}
                  />
                </Card>
                <Card style={styles.half}>
                  <View style={styles.deviceIconRow}>
                    <Icon name="fan" size={20} color={state.fan_on ? colors.primary : colors.textMuted} />
                    <Text style={styles.deviceLabel}>{t("fan")}</Text>
                  </View>
                  <Badge
                    label={state.fan_on ? t("on") : t("off")}
                    color={state.fan_on ? colors.primary : colors.textMuted}
                  />
                </Card>
              </View>

              <Card>
                <View style={styles.acRow}>
                  <View style={styles.deviceIconRow}>
                    <Icon name="ac" size={20} color={acOn ? colors.primary : colors.textMuted} />
                    <View>
                      <Text style={styles.deviceLabel}>{t("ac")}</Text>
                      <Text style={styles.muted}>{t("acToggleHint")}</Text>
                    </View>
                  </View>
                  <Toggle value={acOn} onValueChange={toggleAc} disabled={acBusy} />
                </View>
              </Card>

              <Card style={styles.wifiCard}>
                <Text style={styles.deviceLabel}>{t("lightSensorRaw")}</Text>
                <Text style={styles.muted}>{t("seeRoomTabHint")}</Text>
                <View style={styles.row}>
                  <Reading label={t("ldrReading")} value={String(state.ldr)} />
                  <Reading label={t("vibration")} value={state.vib.toFixed(3)} />
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
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.reading}>
      <Text style={styles.readingValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.md, gap: spacing.md },
    title: { color: colors.text, fontSize: 26, fontFamily: fonts.heading, flex: 1 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    bellButton: { padding: spacing.xs },
    bellBadge: {
      position: "absolute",
      top: 0,
      right: 0,
      backgroundColor: colors.danger,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    bellBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: fonts.bodySemiBold },
    chatFab: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
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
    deviceIconRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    wifiCard: { gap: spacing.sm },
  });
}
