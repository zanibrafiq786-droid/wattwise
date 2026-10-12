import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { WasteReport } from "../lib/reportCalc";

// WattWise reference shows a narrative card built from real numbers
// ("The master bedroom AC ran 19 hours... 37 units went to rooms nobody was
// in"). This builds the same kind of sentence from our actual
// computeWasteReport() output -- real ranges, not invented precision.
export function WhyBillHighCard({ waste }: { waste: WasteReport }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const lines: string[] = [];

  const worst = [...waste.appliances].sort((a, b) => b.hoursHigh - a.hoursHigh)[0];
  if (worst && worst.hoursHigh > 0.5) {
    lines.push(
      `The ${worst.label.toLowerCase()} ran about ${worst.hoursLow.toFixed(0)}-${worst.hoursHigh.toFixed(
        0
      )} hours with nobody in the room this period (Rs ${worst.rsLow.toFixed(0)}-${worst.rsHigh.toFixed(0)}).`
    );
  }

  if (waste.percentOfBillLow !== null && waste.percentOfBillHigh !== null) {
    lines.push(
      `Waste while the room was empty made up about ${waste.percentOfBillLow.toFixed(0)}-${waste.percentOfBillHigh.toFixed(
        0
      )}% of the bill.`
    );
  }

  if (lines.length === 0) {
    lines.push("Not enough logged data yet to explain the bill -- keep the sensor running for a few more days.");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Why the bill is high</Text>
      <View style={styles.card}>
        {lines.map((line, i) => (
          <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
            <Text style={styles.line}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    title: { color: colors.text, fontSize: 20, fontFamily: fonts.headingMedium },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    row: { padding: spacing.md },
    rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    line: { color: colors.text, fontSize: 14, lineHeight: 20 },
  });
}
