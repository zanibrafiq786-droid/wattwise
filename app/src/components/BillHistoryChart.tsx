import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { Colors, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { BillEntry } from "../lib/types";

const SLAB_LIMIT = 200;
const CHART_HEIGHT = 140;
const CHART_WIDTH = 300;

function monthLabel(monthKey: string) {
  const [, m] = monthKey.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[parseInt(m, 10) - 1] ?? monthKey;
}

// 12-month bar chart of units consumed, with a reference line at the
// 200-unit slab -- bars that cross it are highlighted so it's obvious at a
// glance which months fell into the higher tariff slab.
export function BillHistoryChart({ bills }: { bills: BillEntry[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const last12 = bills.slice(-12);
  const maxUnits = Math.max(SLAB_LIMIT * 1.2, ...last12.map((b) => b.units));
  const barGap = 6;
  const barWidth = last12.length > 0 ? CHART_WIDTH / last12.length - barGap : 0;
  const slabY = CHART_HEIGHT - (SLAB_LIMIT / maxUnits) * CHART_HEIGHT;

  return (
    <View style={styles.wrap}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 10}>
        <Line
          x1={0}
          y1={slabY}
          x2={CHART_WIDTH}
          y2={slabY}
          stroke={colors.warning}
          strokeWidth={1.5}
          strokeDasharray="4,4"
        />
        <SvgText x={CHART_WIDTH - 2} y={slabY - 4} fontSize={10} fill={colors.warning} textAnchor="end">
          200 units
        </SvgText>
        {last12.map((b, i) => {
          const barHeight = (b.units / maxUnits) * CHART_HEIGHT;
          const x = i * (barWidth + barGap);
          const y = CHART_HEIGHT - barHeight;
          const overLimit = b.units > SLAB_LIMIT;
          return (
            <Rect
              key={b.month}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(2, barHeight)}
              rx={3}
              fill={overLimit ? colors.danger : colors.primary}
            />
          );
        })}
      </Svg>
      <View style={styles.labelsRow}>
        {last12.map((b) => (
          <Text key={b.month} style={styles.monthLabel}>
            {monthLabel(b.month)}
          </Text>
        ))}
      </View>
      <View style={styles.legendRow}>
        <LegendDot color={colors.primary} label="Within slab" />
        <LegendDot color={colors.danger} label="Over 200 units" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    labelsRow: { flexDirection: "row", justifyContent: "space-between" },
    monthLabel: { color: colors.textMuted, fontSize: 9, flex: 1, textAlign: "center" },
    legendRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { color: colors.textMuted, fontSize: 11 },
  });
}
