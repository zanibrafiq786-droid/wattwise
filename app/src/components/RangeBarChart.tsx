import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Colors, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

export interface RangeBarItem {
  label: string;
  low: number;
  high: number;
  color: string;
  unit: string;
}

// Horizontal bar per item showing a low-high estimate range (never a single
// fake-precise number), since the brief requires ranges, not false precision.
export function RangeBarChart({ items }: { items: RangeBarItem[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const max = Math.max(1, ...items.map((i) => i.high));
  const barWidth = 240;
  const barHeight = 14;

  return (
    <View style={{ gap: spacing.md }}>
      {items.map((item) => {
        const lowX = (item.low / max) * barWidth;
        const highX = (item.high / max) * barWidth;
        return (
          <View key={item.label} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value}>
                {item.low.toFixed(0)}-{item.high.toFixed(0)} {item.unit}
              </Text>
            </View>
            <Svg width={barWidth} height={barHeight}>
              <Rect
                x={0}
                y={0}
                width={barWidth}
                height={barHeight}
                rx={radius.sm}
                fill={colors.surfaceAlt}
              />
              <Rect
                x={lowX}
                y={0}
                width={Math.max(2, highX - lowX)}
                height={barHeight}
                rx={radius.sm}
                fill={item.color}
              />
            </Svg>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    row: { gap: spacing.xs },
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    label: { color: colors.text, fontSize: 14, fontWeight: "600" },
    value: { color: colors.textMuted, fontSize: 13 },
  });
}
