import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { RangeBarChart } from "../components/RangeBarChart";
import { StateView } from "../components/StateView";
import { useBill, useConfig, useMonthReport, useRoomEvents, useSimulatedFlag } from "../lib/firebase";
import { computeWasteReport } from "../lib/reportCalc";
import { colors, spacing } from "../lib/theme";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ReportScreen() {
  const monthKey = currentMonthKey();
  const { events, loading: eventsLoading, error } = useRoomEvents("room1");
  const { bill } = useBill(monthKey);
  const { config } = useConfig();
  const { report } = useMonthReport(monthKey);
  const simulated = useSimulatedFlag();

  const waste = events ? computeWasteReport(events, config, bill) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Report - {monthKey}</Text>
          {simulated && <Badge label="SIMULATED" color={colors.warning} />}
        </View>

        <StateView
          loading={eventsLoading}
          error={error}
          empty={!waste || waste.daysCovered === 0}
          emptyMessage="Not enough logged data yet to estimate waste. Keep the sensor running for a few days, then come back."
        >
          {waste && (
            <>
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>Estimated waste this month</Text>
                <Text style={styles.subtle}>
                  Based on {waste.daysCovered.toFixed(1)} day(s) of logged sensor data. These are
                  estimates from presence + on/off state, not a real power meter -- treat them as
                  ranges, not exact numbers.
                </Text>
                <RangeBarChart
                  items={waste.appliances.map((a) => ({
                    label: a.label,
                    low: a.rsLow,
                    high: a.rsHigh,
                    unit: "Rs",
                    color: a.key === "fan" ? colors.primary : colors.warning,
                  }))}
                />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total estimated waste</Text>
                  <Text style={styles.totalValue}>
                    Rs {waste.totalRsLow.toFixed(0)} - {waste.totalRsHigh.toFixed(0)}
                  </Text>
                </View>
                {waste.percentOfBillLow !== null && waste.percentOfBillHigh !== null && (
                  <Text style={styles.subtle}>
                    That's about {waste.percentOfBillLow.toFixed(0)}%-{waste.percentOfBillHigh.toFixed(0)}% of
                    your Rs {bill?.amount_rs.toFixed(0)} bill.
                  </Text>
                )}
                {!bill && (
                  <Text style={styles.subtle}>
                    Add this month's bill in Setup to see what share of it this waste represents.
                  </Text>
                )}
              </Card>

              <Card style={styles.card}>
                <Text style={styles.cardTitle}>AI explanation &amp; next-month plan</Text>
                {report?.text ? (
                  <>
                    <Text style={styles.reportText}>{report.text}</Text>
                    {report.plan_steps?.map((step, i) => (
                      <View key={i} style={styles.planRow}>
                        <Text style={styles.planIndex}>{i + 1}</Text>
                        <Text style={styles.planText}>{step}</Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={styles.subtle}>
                    No AI report yet for this month. Run the month-end report job (brain/report.py) to
                    generate an explanation and a step-by-step plan.
                  </Text>
                )}
              </Card>
            </>
          )}
        </StateView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  subtle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  totalLabel: { color: colors.text, fontWeight: "600" },
  totalValue: { color: colors.text, fontWeight: "800" },
  reportText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  planRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  planIndex: { color: colors.primary, fontWeight: "800", width: 20 },
  planText: { color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 },
});
