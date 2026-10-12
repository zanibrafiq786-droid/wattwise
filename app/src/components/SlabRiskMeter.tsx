import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

const SLAB_LIMIT = 200;

// There's no live unit metering in this project (no current clamp sensor --
// out of scope per the brief), so "current" here means the latest month we
// actually have a bill for, not today's calendar month. The caption makes
// that explicit so it's never read as a live reading.
export function SlabRiskMeter({ month, units }: { month: string; units: number }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const over = units > SLAB_LIMIT;
  const unitsLeft = SLAB_LIMIT - units;
  const scaleMax = Math.max(SLAB_LIMIT * 1.3, units * 1.1);
  const fillPct = Math.min(100, (units / scaleMax) * 100);
  const slabPct = (SLAB_LIMIT / scaleMax) * 100;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Slab risk -- {month}</Text>
        <Text style={[styles.statusText, { color: over ? colors.danger : colors.success }]}>
          {over ? `${Math.abs(unitsLeft)} units over` : `${unitsLeft} units left`}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPct}%`, backgroundColor: over ? colors.danger : colors.primary }]} />
        <View style={[styles.slabMarker, { left: `${slabPct}%` }]} />
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.muted}>{units} units used</Text>
        <Text style={styles.muted}>200-unit slab line</Text>
      </View>
      <Text style={styles.caption}>
        Based on the latest billed month (there's no live meter in this project yet).
      </Text>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { color: colors.text, fontSize: 15, fontWeight: "700" },
    statusText: { fontSize: 13, fontWeight: "700" },
    track: {
      height: 14,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      overflow: "visible",
      justifyContent: "center",
    },
    fill: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: radius.sm,
    },
    slabMarker: {
      position: "absolute",
      top: -3,
      bottom: -3,
      width: 2,
      backgroundColor: colors.warning,
    },
    footerRow: { flexDirection: "row", justifyContent: "space-between" },
    muted: { color: colors.textMuted, fontSize: 12 },
    caption: { color: colors.textMuted, fontSize: 11, fontStyle: "italic" },
  });
}
