import { useNavigation } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { HeroDevice, RoomHeroCard } from "../components/RoomHeroCard";
import { RoomLiveView } from "../components/RoomLiveView";
import { RoomSheet } from "../components/RoomSheet";
import { Sparkle } from "../components/Sparkle";
import { StateView } from "../components/StateView";
import { useAuth } from "../lib/authContext";
import {
  latestValidBill,
  saveRssiThreshold,
  setAcOn,
  useAcOn,
  useAlerts,
  useBillHistory,
  useConfig,
  useDevice,
  useRoomEvents,
  useRoomState,
} from "../lib/firebase";
import { TranslationKey, useI18n } from "../lib/i18n";
import { formatRs } from "../lib/format";
import { computeWasteReport } from "../lib/reportCalc";
import { useRoomType } from "../lib/roomType";
import { SmartPresence, useSmartPresence, useWifiCalibration } from "../lib/smartPresence";
import { Colors, fonts, radius, spacing } from "../lib/theme";
import { useThemeMode } from "../lib/themeContext";
import { durationSince, timeAgo } from "../lib/time";

const PRESENCE_LABEL_KEY: Record<SmartPresence, TranslationKey> = {
  empty: "presenceEmpty",
  sitting: "presenceSitting",
  walking: "presenceWalking",
};

const SLAB_LIMIT = 200;
const SLAB_SCALE = 240;

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function LiveScreen() {
  const { mode, colors, toggleTheme } = useThemeMode();
  const styles = makeStyles(colors);
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const { user, displayName } = useAuth();
  const firstName = displayName?.split(" ")[0] || user?.email?.split("@")[0] || "";

  // The ESP32 belongs to one account; other accounts get a "no sensor
  // linked" Home instead of someone else's room.
  const { device, loading: deviceLoading } = useDevice();
  const { state, loading: stateLoading, error } = useRoomState(device);
  const loading = deviceLoading || stateLoading;
  const { acOn: acOnRemote } = useAcOn(device);
  const { alerts } = useAlerts();
  const { config } = useConfig();
  const { events } = useRoomEvents(device, "real");
  const { bills } = useBillHistory();
  const { roomType, setRoomType, room } = useRoomType();

  const [acOnOverride, setAcOnOverride] = useState<boolean | null>(null);
  const acOn = acOnOverride ?? acOnRemote;
  const [acBusy, setAcBusy] = useState(false);
  const [acError, setAcError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const newAlertCount = alerts?.filter((a) => a.status === "new").length ?? 0;
  const threshold = config.rssi_threshold ?? 0.6;
  const smart = useSmartPresence(state, threshold);
  const calibration = useWifiCalibration(state, saveRssiThreshold);

  async function toggleAc(value: boolean) {
    setAcOnOverride(value);
    setAcBusy(true);
    setAcError(null);
    try {
      if (!device) return;
      await setAcOn(device, value);
    } catch {
      setAcOnOverride(null); // roll back the optimistic flip -- the write didn't actually happen
      setAcError(t("actionFailed"));
    } finally {
      setAcBusy(false);
    }
  }

  const derived = useMemo(() => {
    if (!state) return null;
    const onWatts =
      (state.light_on ? config.watts.light : 0) + (state.fan_on ? config.watts.fan : 0) + (acOn ? config.watts.ac : 0);
    const since = smart.since;
    let wastePerHour: number | null = null;
    let wasteSoFar: number | null = null;
    if (smart.presence === "empty" && onWatts > 0) {
      wastePerHour = (onWatts / 1000) * config.rate_rs_per_unit;
      wasteSoFar = since ? wastePerHour * ((Date.now() - since) / 3600000) : 0;
    }
    const today = (events ?? []).filter((e) => e.ts >= startOfTodayMs());
    const todayWaste = computeWasteReport(today, config, null);
    return { onWatts, since, wastePerHour, wasteSoFar, todayWaste };
  }, [state, acOn, config, events, smart.presence, smart.since]);

  const bill = latestValidBill(bills);

  const devices: HeroDevice[] = state
    ? [
        { key: "light", icon: "bulb", label: t("light"), watts: config.watts.light, on: state.light_on },
        { key: "fan", icon: "fan", label: t("fan"), watts: config.watts.fan, on: state.fan_on },
        { key: "ac", icon: "ac", label: t("ac"), watts: config.watts.ac, on: acOn },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Pressable style={styles.chatFab} onPress={() => navigation.navigate("Chat")}>
        <Sparkle size={28} id="fabSparkle" />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.greeting, { flex: 1 }]} numberOfLines={1}>
            {t("hello", { name: firstName })}
          </Text>
          <Pressable style={styles.circleButton} onPress={toggleTheme} hitSlop={4}>
            <Icon name={mode === "cream" ? "moon" : "sun"} size={19} color={colors.text} />
          </Pressable>
          <Pressable style={styles.circleButton} onPress={() => navigation.navigate("Alerts")} hitSlop={4}>
            <Icon name="bell" size={19} color={colors.text} />
            {newAlertCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{newAlertCount}</Text>
              </View>
            )}
          </Pressable>
          <Avatar name={displayName} email={user?.email} onPress={() => navigation.navigate("Account")} />
        </View>

        <View style={styles.kwPill}>
          <Icon name="bolt" size={15} color={colors.primary} />
          <Text style={styles.kwText}>
            {t("kwNowEst", { kw: ((derived?.onWatts ?? 0) / 1000).toFixed(2) })}
          </Text>
        </View>

        <StateView
          loading={loading}
          error={error}
          empty={!state}
          emptyMessage={device ? t("noSensorData") : t("noDeviceLinked")}
        >
          {state && derived && (
            <>
              <RoomHeroCard
                roomName={t(room.label)}
                imageOn={room.on}
                imageOff={room.off}
                lightOn={state.light_on}
                presence={smart.presence}
                presenceLabel={t(PRESENCE_LABEL_KEY[smart.presence])}
                presenceFor={derived.since ? durationSince(derived.since) : null}
                staleNote={smart.staleMs ? t("sensorLastHeard", { time: timeAgo(state.updated_at) }) : null}
                devices={devices}
                wasteRsPerHour={derived.wastePerHour}
                wasteRsSoFar={derived.wasteSoFar}
                onPress={() => setSheetOpen(true)}
              />

              <RoomLiveView state={state} presence={smart.presence} acOn={acOn} threshold={threshold} />

              <Card style={styles.dialCard}>
                <View style={styles.statsRow}>
                  <Stat value={`${state.temp_c.toFixed(1)}°`} label={t("temperature")} />
                  <View style={styles.statDivider} />
                  <Stat value={`${state.humidity.toFixed(0)}%`} label={t("humidity")} />
                  <View style={styles.statDivider} />
                  <Stat value={`${state.vib.toFixed(2)} g`} label={t("fanVibration")} />
                </View>
                <Pressable style={styles.devicesButton} onPress={() => setSheetOpen(true)}>
                  <Icon name="list" size={16} color={colors.text} />
                  <Text style={styles.devicesButtonText}>{t("devicesAndSensors")}</Text>
                </Pressable>
              </Card>

              <View style={styles.bento}>
                <View style={styles.bentoCol}>
                  <Card style={styles.bentoCard}>
                    <View style={styles.bentoHead}>
                      <Text style={styles.bentoLabel}>{t("wastedToday")}</Text>
                      <Icon name="coin" size={16} color={colors.danger} />
                    </View>
                    <Text style={[styles.bigNumber, { color: colors.danger }]}>
                      {derived.todayWaste.totalRsHigh <= 0
                        ? "Rs 0"
                        : `Rs ${formatRs(derived.todayWaste.totalRsLow)}-${formatRs(derived.todayWaste.totalRsHigh)}`}
                    </Text>
                    <Text style={styles.bentoSub}>{t("wastedTodaySub")}</Text>
                  </Card>
                  <Card style={styles.bentoCard}>
                    <View style={styles.bentoHead}>
                      <Text style={styles.bentoLabel}>{t("nowDrawing")}</Text>
                      <Icon name="bolt" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.bigNumber}>
                      {(derived.onWatts / 1000).toFixed(2)}
                      <Text style={styles.unit}> kW</Text>
                    </Text>
                    <Text style={styles.bentoSub}>
                      {t("rsPerHour", {
                        rs: formatRs((derived.onWatts / 1000) * config.rate_rs_per_unit),
                      })}
                    </Text>
                  </Card>
                </View>

                <Card style={[styles.bentoCard, styles.monthCard]}>
                  <Text style={styles.bentoLabel}>{bill ? monthName(bill.month) : t("thisMonth")}</Text>
                  {bill ? (
                    <>
                      <Text style={styles.bigNumber}>
                        {bill.units.toFixed(0)}
                        <Text style={styles.unit}>/{SLAB_LIMIT}</Text>
                      </Text>
                      <SlabBar units={bill.units} colors={colors} />
                    </>
                  ) : (
                    <Text style={styles.bentoSub}>{t("noBillYet")}</Text>
                  )}
                  <Pressable style={styles.reportButton} onPress={() => navigation.navigate("Report")}>
                    <Text style={styles.reportButtonText}>{t("openReport")}</Text>
                  </Pressable>
                </Card>
              </View>

              <RoomSheet
                visible={sheetOpen}
                onClose={() => setSheetOpen(false)}
                roomName={t(room.label)}
                state={state}
                acOn={acOn}
                acBusy={acBusy}
                acError={acError}
                onToggleAc={toggleAc}
                roomType={roomType}
                onRoomType={setRoomType}
                threshold={threshold}
                calibration={calibration}
              />
            </>
          )}
        </StateView>
      </ScrollView>
    </SafeAreaView>
  );
}

function monthName(monthKey: string) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const m = parseInt(monthKey.split("-")[1], 10);
  return names[m - 1] ?? monthKey;
}

// The tall "thermometer" from the design: fill = units used, a hatched cap
// marks the 200-unit slab, red once it's crossed.
function SlabBar({ units, colors }: { units: number; colors: Colors }) {
  const styles = makeStyles(colors);
  const fillPct = Math.min(units / SLAB_SCALE, 1) * 100;
  const slabPct = (SLAB_LIMIT / SLAB_SCALE) * 100;
  const over = units > SLAB_LIMIT;
  return (
    <View style={styles.slabTrack}>
      <View style={[styles.slabFill, { height: `${fillPct}%`, backgroundColor: over ? colors.danger : colors.primary }]} />
      <View style={[styles.slabLine, { bottom: `${slabPct}%` }]}>
        <Text style={styles.slabLineText}>{SLAB_LIMIT}</Text>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useThemeMode();
  const styles = makeStyles(colors);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: 96 },
    topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    kwPill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingVertical: 9,
      paddingHorizontal: 14,
    },
    kwText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
    circleButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: colors.primary,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    badgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: fonts.bodySemiBold },
    greeting: { color: colors.text, fontSize: 24, fontFamily: fonts.headingMedium },
    chatFab: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.lg,
      width: 58,
      height: 58,
      borderRadius: 29,
      // Contrasting disc (dark on Cream, light on Espresso) so the warm
      // gradient sparkle reads clearly in both themes.
      backgroundColor: colors.text,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    dialCard: { gap: spacing.md, alignItems: "stretch" },
    statsRow: { flexDirection: "row", alignItems: "center" },
    stat: { flex: 1, alignItems: "center", gap: 2 },
    statValue: { color: colors.text, fontSize: 18, fontFamily: fonts.headingMedium },
    statLabel: { color: colors.textMuted, fontSize: 11 },
    statDivider: { width: 1, height: 30, backgroundColor: colors.border },
    devicesButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 999,
      paddingVertical: 12,
    },
    devicesButtonText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemiBold },
    bento: { flexDirection: "row", gap: spacing.md },
    bentoCol: { flex: 1, gap: spacing.md },
    bentoCard: { gap: 4 },
    bentoHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    bentoLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodyMedium },
    bigNumber: { color: colors.text, fontSize: 30, fontFamily: fonts.heading, marginTop: spacing.xs },
    unit: { fontSize: 14, color: colors.textMuted, fontFamily: fonts.body },
    bentoSub: { color: colors.textMuted, fontSize: 11 },
    monthCard: { flex: 1, alignItems: "center" },
    slabTrack: {
      width: 54,
      flex: 1,
      minHeight: 120,
      marginVertical: spacing.sm,
      borderRadius: 27,
      backgroundColor: colors.surfaceAlt,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    slabFill: { width: "100%", borderRadius: 27 },
    slabLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 14,
      backgroundColor: colors.text,
      alignItems: "center",
      justifyContent: "center",
    },
    slabLineText: { color: colors.bg, fontSize: 9, fontFamily: fonts.bodySemiBold },
    reportButton: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    reportButtonText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
  });
}
