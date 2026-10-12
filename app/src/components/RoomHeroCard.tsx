import React, { useEffect, useRef } from "react";
import { Animated, Easing, ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import { formatRs } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { SmartPresence } from "../lib/smartPresence";
import { fonts, radius, spacing } from "../lib/theme";
import { Icon, IconName } from "./Icon";

// Always-dark card (it sits on a photo), so it uses fixed light-on-dark
// colours instead of the theme palette -- same in Cream and Espresso.
const INK = "#f3ece5";
const INK_MUTED = "rgba(243,236,229,0.72)";
const CHIP_BG = "rgba(255,255,255,0.12)";
const CHIP_ON_BG = "rgba(242,139,75,0.32)";
const CHIP_ON_INK = "#ffd9bf";
const TEAL = "#7fc4bd";
const ALERT_BG = "#c3402a";

export interface HeroDevice {
  key: string;
  icon: IconName;
  label: string;
  watts: number;
  on: boolean;
}

function formatWatts(w: number) {
  return w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`;
}

// The Home screen's hero card. Follows the REAL light sensor: when the
// light comes on, the lit photo fades in with a quick bulb-style flicker
// and a warm glow; when it goes off, the room slowly sinks into the dark
// photo plus an extra shade, so it actually feels dark. Chips light up for
// whatever is on. Tap it to open the device sheet.
export function RoomHeroCard({
  roomName,
  imageOn,
  imageOff,
  lightOn,
  presence,
  presenceLabel,
  presenceFor,
  staleNote,
  devices,
  wasteRsPerHour,
  wasteRsSoFar,
  onPress,
}: {
  roomName: string;
  imageOn: ImageSourcePropType;
  imageOff: ImageSourcePropType;
  lightOn: boolean;
  presence: SmartPresence;
  presenceLabel: string;
  presenceFor: string | null;
  staleNote: string | null;
  devices: HeroDevice[];
  wasteRsPerHour: number | null;
  wasteRsSoFar: number | null;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const dotColor = presence === "walking" ? "#f6a467" : presence === "sitting" ? TEAL : "rgba(243,236,229,0.5)";

  // 0 = dark room, 1 = lit room. Starts at the current state (no animation
  // on first render), then animates on every real on/off change.
  const lit = useRef(new Animated.Value(lightOn ? 1 : 0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    lit.stopAnimation();
    const step = (toValue: number, duration: number) =>
      Animated.timing(lit, { toValue, duration, easing: Easing.linear, useNativeDriver: true });
    if (lightOn) {
      // Bulb-style flicker, then settle fully on.
      Animated.sequence([
        step(0.55, 80),
        step(0.1, 70),
        step(0.8, 90),
        step(0.35, 70),
        Animated.timing(lit, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(lit, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    }
  }, [lightOn, lit]);

  const darkness = lit.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const glow = lit.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
      <View style={styles.image}>
        <Animated.Image source={imageOff} style={styles.layer} resizeMode="cover" />
        <Animated.Image source={imageOn} style={[styles.layer, { opacity: lit }]} resizeMode="cover" />
        <Animated.View style={[styles.layer, styles.darkness, { opacity: darkness }]} />
        <Animated.View style={[styles.layer, styles.warmGlow, { opacity: glow }]} />
        <View style={styles.dim} />
        <View style={styles.bottomShade} />

        <View style={styles.content}>
          <View style={styles.statusPill}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={styles.statusText}>
              {presenceFor ? `${presenceLabel} · ${presenceFor}` : presenceLabel}
            </Text>
          </View>

          {staleNote && (
            <View style={styles.statusPill}>
              <Icon name="warn" size={13} color="#f6a467" />
              <Text style={[styles.statusText, { color: "#f6c9a8" }]}>{staleNote}</Text>
            </View>
          )}

          {wasteRsPerHour !== null && (
            <View style={styles.alertPill}>
              <Icon name="warn" size={16} color="#FFFFFF" />
              <Text style={styles.alertText}>
                {t("nobodyHereWaste", {
                  perHour: formatRs(wasteRsPerHour),
                  soFar: formatRs(wasteRsSoFar ?? 0),
                })}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <Text style={styles.roomName} numberOfLines={2}>
            {roomName.replace(" ", "\n")}
          </Text>

          <View style={styles.chips}>
            {devices.map((d) => (
              <View key={d.key} style={[styles.chip, d.on && styles.chipOn]}>
                <Icon name={d.icon} size={13} color={d.on ? CHIP_ON_INK : INK_MUTED} />
                <Text style={[styles.chipText, d.on && styles.chipTextOn]}>
                  {d.on ? `${d.label} · ${formatWatts(d.watts)}` : d.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Icon name="list" size={12} color="rgba(243,236,229,0.6)" />
          <Text style={styles.footerText}>{t("tapForDevices")}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#15110e",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  image: { minHeight: 400, justifyContent: "space-between" },
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  darkness: { backgroundColor: "#050403" },
  warmGlow: { backgroundColor: "rgba(255,170,90,0.10)" },
  dim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(21,17,14,0.28)" },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 190,
    backgroundColor: "rgba(21,17,14,0.55)",
  },
  content: { flex: 1, padding: spacing.md + 4, gap: spacing.sm },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs + 2,
    backgroundColor: "rgba(21,17,14,0.55)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: INK, fontSize: 13, fontFamily: fonts.bodySemiBold },
  alertPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    backgroundColor: ALERT_BG,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: "92%",
  },
  alertText: { color: "#FFFFFF", fontSize: 13, fontFamily: fonts.bodySemiBold, flexShrink: 1 },
  roomName: { color: INK, fontSize: 52, lineHeight: 54, fontFamily: fonts.heading },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2, marginTop: spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: CHIP_BG,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  chipOn: { backgroundColor: CHIP_ON_BG },
  chipText: { color: INK_MUTED, fontSize: 12, fontFamily: fonts.bodyMedium },
  chipTextOn: { color: CHIP_ON_INK, fontFamily: fonts.bodySemiBold },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md + 4,
    paddingBottom: spacing.md,
  },
  footerText: { color: "rgba(243,236,229,0.6)", fontSize: 11, fontFamily: fonts.bodyMedium },
});
