import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../lib/i18n";
import { ROOM_TYPES, RoomType } from "../lib/roomType";
import { useWifiCalibration } from "../lib/smartPresence";
import { Colors, fonts, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { timeAgo } from "../lib/time";
import { RoomState } from "../lib/types";
import { Icon, IconName } from "./Icon";
import { StatusMessage } from "./StatusMessage";
import { Toggle } from "./Toggle";

// Bottom sheet opened by tapping the Home hero card. Light and fan are
// read-only here on purpose -- they come from real sensors, so the app
// can't (and shouldn't pretend to) switch them. The AC has no sensor, so
// its toggle is the user telling the app, same as before.
export function RoomSheet({
  visible,
  onClose,
  roomName,
  state,
  acOn,
  acBusy,
  acError,
  onToggleAc,
  roomType,
  onRoomType,
  threshold,
  calibration,
}: {
  visible: boolean;
  onClose: () => void;
  roomName: string;
  state: RoomState;
  acOn: boolean;
  acBusy: boolean;
  acError: string | null;
  onToggleAc: (v: boolean) => void;
  roomType: RoomType;
  onRoomType: (r: RoomType) => void;
  threshold: number;
  calibration: ReturnType<typeof useWifiCalibration>;
}) {
  const calibrating = calibration.step === "empty" || calibration.step === "walking";
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
            <Icon name="x" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{roomName}</Text>
            <Text style={styles.sub}>
              ESP32 · {t("wifiMotion")} {state.rssi_var.toFixed(2)} · {timeAgo(state.updated_at)}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.sectionTitle}>{t("devices")}</Text>
          <View style={styles.list}>
            <DeviceRow icon="bulb" name={t("light")} source={t("sourceLightSensor")} on={state.light_on} />
            <DeviceRow icon="fan" name={t("fan")} source={t("sourceVibrationSensor")} on={state.fan_on} />
            <DeviceRow
              icon="ac"
              name={t("ac")}
              source={t("acToggleHint")}
              on={acOn}
              control={<Toggle value={acOn} onValueChange={onToggleAc} disabled={acBusy} />}
              last
            />
          </View>
          <StatusMessage type="error" message={acError} />

          <Text style={styles.sectionTitle}>{t("sensorReadings")}</Text>
          <View style={styles.readings}>
            <Reading label={t("ldrReading")} value={String(state.ldr)} />
            <Reading label={t("vibration")} value={`${state.vib.toFixed(3)} g`} />
            <Reading label={t("humidity")} value={`${state.humidity.toFixed(0)}%`} />
          </View>

          <Text style={styles.sectionTitle}>{t("wifiCalibTitle")}</Text>
          <View style={styles.calibCard}>
            <Text style={styles.calibText}>
              {calibration.step === "empty"
                ? t("wifiCalibStepEmpty", { s: String(calibration.secondsLeft) })
                : calibration.step === "walking"
                ? t("wifiCalibStepWalk", { s: String(calibration.secondsLeft) })
                : t("wifiCalibIntro", { thr: threshold.toFixed(2) })}
            </Text>
            {calibration.message && (
              <StatusMessage type={calibration.step === "failed" ? "error" : "success"} message={calibration.message} />
            )}
            <Pressable
              style={[styles.calibButton, calibrating && { opacity: 0.5 }]}
              disabled={calibrating}
              onPress={calibration.start}
            >
              <Text style={styles.calibButtonText}>
                {calibrating ? t("wifiCalibRunning") : t("wifiCalibStart")}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>{t("roomTypeTitle")}</Text>
          <View style={styles.chips}>
            {ROOM_TYPES.map((r) => {
              const active = r.key === roomType;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => onRoomType(r.key)}
                  style={[styles.chip, active && { backgroundColor: colors.text, borderColor: colors.text }]}
                >
                  <Text style={[styles.chipText, active && { color: colors.bg }]}>{t(r.label)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{t("roomTypeHint")}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function DeviceRow({
  icon,
  name,
  source,
  on,
  control,
  last,
}: {
  icon: IconName;
  name: string;
  source: string;
  on: boolean;
  control?: React.ReactNode;
  last?: boolean;
}) {
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={[styles.rowIcon, on && { borderColor: colors.primary, backgroundColor: colors.primary + "22" }]}>
        <Icon name={icon} size={20} color={on ? colors.primary : colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowSource}>{source}</Text>
      </View>
      {control ?? (
        <View style={[styles.statePill, on && { backgroundColor: colors.primary }]}>
          <Text style={[styles.statePillText, on && { color: "#FFFFFF" }]}>{on ? t("on") : t("off")}</Text>
        </View>
      )}
    </View>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.reading}>
      <Text style={styles.readingValue}>{value}</Text>
      <Text style={styles.readingLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: "86%",
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingTop: spacing.sm,
    },
    handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: { flex: 1, alignItems: "center" },
    title: { color: colors.text, fontSize: 20, fontFamily: fonts.headingMedium },
    sub: { color: colors.textMuted, fontSize: 12 },
    body: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
    sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.headingMedium, marginTop: spacing.sm },
    list: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    rowName: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemiBold },
    rowSource: { color: colors.textMuted, fontSize: 12 },
    statePill: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.surfaceAlt },
    statePillText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodySemiBold },
    readings: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
    },
    reading: { flex: 1, alignItems: "center", gap: 2 },
    readingValue: { color: colors.text, fontSize: 18, fontFamily: fonts.headingMedium },
    readingLabel: { color: colors.textMuted, fontSize: 11 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodyMedium },
    hint: { color: colors.textMuted, fontSize: 12 },
    calibCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
    calibText: { color: colors.text, fontSize: 13, lineHeight: 19 },
    calibButton: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 18,
    },
    calibButtonText: { color: "#FFFFFF", fontSize: 14, fontFamily: fonts.bodySemiBold },
  });
}
