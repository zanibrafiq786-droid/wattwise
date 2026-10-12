import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { BillEntry } from "../lib/types";

const SIZE = 200;
const STROKE = 24;
const R = (SIZE - STROKE) / 2;
const C = SIZE / 2;
const SLAB_LIMIT = 200;
const GAP_DEG = 2.5;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(key: string) {
  return MONTHS[parseInt(key.split("-")[1], 10) - 1] ?? key;
}

function polar(deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + R * Math.cos(rad), y: C + R * Math.sin(rad) };
}
function arc(a0: number, a1: number) {
  const s = polar(a0);
  const e = polar(a1);
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

// The year as a ring: each month's slice is sized by its share of the
// year's units, red when that month crossed the 200-unit slab. Total and
// monthly average in the middle, every month's units listed underneath so
// the numbers are never hidden inside the picture.
export function YearRing({ bills }: { bills: BillEntry[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const year = bills.slice(-12);
  const total = year.reduce((s, b) => s + b.units, 0);
  const avg = year.length ? total / year.length : 0;

  let angle = 0;
  const slices = year.map((b) => {
    const sweep = total > 0 ? (b.units / total) * 360 : 360 / Math.max(1, year.length);
    const a0 = angle + GAP_DEG / 2;
    const a1 = angle + Math.max(sweep - GAP_DEG / 2, GAP_DEG / 2 + 0.5);
    angle += sweep;
    return { b, a0, a1 };
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          {slices.map(({ b, a0, a1 }) => (
            <Path
              key={b.month}
              d={arc(a0, a1)}
              stroke={b.units > SLAB_LIMIT ? colors.danger : colors.primary}
              strokeWidth={STROKE}
              fill="none"
            />
          ))}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.total}>{Math.round(total).toLocaleString()}</Text>
          <Text style={styles.totalUnit}>units in {year.length} months</Text>
          <Text style={styles.avg}>avg {Math.round(avg)} / month</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {year.map((b) => (
          <View key={b.month} style={styles.cell}>
            <View style={[styles.dot, { backgroundColor: b.units > SLAB_LIMIT ? colors.danger : colors.primary }]} />
            <Text style={styles.cellMonth}>{monthLabel(b.month)}</Text>
            <Text style={[styles.cellUnits, b.units > SLAB_LIMIT && { color: colors.danger }]}>{Math.round(b.units)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: { gap: spacing.md, alignItems: "center" },
    ringWrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
    center: { position: "absolute", alignItems: "center" },
    total: { color: colors.text, fontSize: 32, fontFamily: fonts.heading },
    totalUnit: { color: colors.textMuted, fontSize: 11 },
    avg: { color: colors.text, fontSize: 12, fontFamily: fonts.bodySemiBold, marginTop: 2 },
    grid: { flexDirection: "row", flexWrap: "wrap", width: "100%", rowGap: 6 },
    cell: { width: "33.3%", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    cellMonth: { color: colors.textMuted, fontSize: 12, width: 30 },
    cellUnits: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
  });
}
