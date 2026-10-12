import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { monthName, shiftMonth } from "../lib/months";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { BillEntry } from "../lib/types";

const SLAB_LIMIT = 200;

// "This month" as bars: the month that just ended, the month before it, the
// same month last year, and the 12-month average -- each labelled with its
// units, plus the 200-unit slab line. A month with no bill saved says so
// instead of silently disappearing.
export function MonthBars({ bills, target }: { bills: BillEntry[]; target: string }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const byMonth = new Map(bills.map((b) => [b.month, b]));
  const year = bills.slice(-12);
  const avg = year.length ? year.reduce((s, b) => s + b.units, 0) / year.length : null;

  const rows: { label: string; units: number | null; highlight?: boolean }[] = [
    { label: monthName(target), units: byMonth.get(target)?.units ?? null, highlight: true },
    { label: `Month before (${monthName(shiftMonth(target, -1))})`, units: byMonth.get(shiftMonth(target, -1))?.units ?? null },
    { label: `Last year (${monthName(shiftMonth(target, -12))})`, units: byMonth.get(shiftMonth(target, -12))?.units ?? null },
  ];
  if (avg !== null) rows.push({ label: "Average of saved months", units: avg });

  const known = rows.map((r) => r.units).filter((u): u is number => u !== null);
  const scale = Math.max(SLAB_LIMIT * 1.25, ...known);
  const slabPct = (SLAB_LIMIT / scale) * 100;

  return (
    <View style={styles.wrap}>
      {rows.map((r) => {
        const over = r.units !== null && r.units > SLAB_LIMIT;
        return (
          <View key={r.label} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, r.highlight && styles.labelStrong]}>{r.label}</Text>
              <Text style={[styles.value, over && { color: colors.danger }, r.highlight && styles.valueStrong, r.units === null && styles.missing]}>
                {r.units === null ? "No bill saved" : `${Math.round(r.units)} units`}
              </Text>
            </View>
            <View style={styles.track}>
              {r.units !== null && (
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(100, (r.units / scale) * 100)}%`,
                      backgroundColor: over ? colors.danger : r.highlight ? colors.primary : colors.primary + "88",
                    },
                  ]}
                />
              )}
              <View style={[styles.slab, { left: `${slabPct}%` }]} />
            </View>
          </View>
        );
      })}
      <Text style={styles.caption}>The line on each bar is the 200-unit slab.</Text>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: { gap: spacing.md },
    row: { gap: 6 },
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: spacing.sm },
    label: { color: colors.textMuted, fontSize: 12, flexShrink: 1 },
    labelStrong: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13 },
    value: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
    valueStrong: { fontSize: 16 },
    missing: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
    track: { height: 14, borderRadius: 7, backgroundColor: colors.surfaceAlt, justifyContent: "center" },
    fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 7 },
    slab: { position: "absolute", top: -3, bottom: -3, width: 2, backgroundColor: colors.text },
    caption: { color: colors.textMuted, fontSize: 11 },
  });
}
