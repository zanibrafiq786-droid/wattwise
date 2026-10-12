import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../components/Badge";
import { BillHistoryChart } from "../components/BillHistoryChart";
import { BillImportCard } from "../components/BillImportCard";
import { Card } from "../components/Card";
import { RangeBarChart } from "../components/RangeBarChart";
import { SlabRiskMeter } from "../components/SlabRiskMeter";
import { StateView } from "../components/StateView";
import {
  useBill,
  useBillHistory,
  useConfig,
  useMonthReport,
  useRoomEvents,
  useSimulatedFlag,
} from "../lib/firebase";
import { computeForecast } from "../lib/forecastCalc";
import { useI18n } from "../lib/i18n";
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
  const { bills, loading: billsLoading } = useBillHistory();

  const latestBill = bills && bills.length > 0 ? bills[bills.length - 1] : null;
  // Reconciled against the latest BILLED month, not the current calendar
  // month -- there's no live meter, so "this month's bill" doesn't exist
  // until it's actually imported.
  const waste = events ? computeWasteReport(events, config, latestBill ?? bill) : null;
  const forecasts = bills ? computeForecast(bills, config) : [];
  const { t } = useI18n();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("report")} - {monthKey}</Text>
          {simulated && <Badge label="SIMULATED" color={colors.warning} />}
        </View>

        <BillImportCard />

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t("billHistory")}</Text>
          <StateView
            loading={billsLoading}
            empty={!bills || bills.length === 0}
            emptyMessage="No bills yet. Import one in brain/import_bill.py or add it in Setup."
          >
            {bills && bills.length > 0 && (
              <>
                <BillHistoryChart bills={bills} />
                {latestBill && <SlabRiskMeter month={latestBill.month} units={latestBill.units} />}
              </>
            )}
          </StateView>
        </Card>

        <StateView
          loading={eventsLoading}
          error={error}
          empty={!waste || waste.daysCovered === 0}
          emptyMessage="Not enough logged data yet to estimate waste. Keep the sensor running for a few days, then come back."
        >
          {waste && (
            <>
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>{t("reconcileTitle")}</Text>
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
                {waste.percentOfBillLow !== null && waste.percentOfBillHigh !== null && latestBill && (
                  <Text style={styles.subtle}>
                    That's about {waste.percentOfBillLow.toFixed(0)}%-{waste.percentOfBillHigh.toFixed(0)}% of
                    your Rs {latestBill.amount_rs.toFixed(0)} bill for {latestBill.month}.
                  </Text>
                )}
                {!latestBill && (
                  <Text style={styles.subtle}>
                    Import a bill (brain/import_bill.py) or add one in Setup to see what share of it
                    this waste represents.
                  </Text>
                )}
              </Card>

              <Card style={styles.card}>
                <Text style={styles.cardTitle}>{t("aiExplanationTitle")}</Text>
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

        {forecasts.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{t("forecastTitle")}</Text>
            <Text style={styles.subtle}>
              Based on the same months last year, adjusted for this year's trend so far. Always a
              range -- not a prediction you should treat as exact.
            </Text>
            {forecasts.map((f) =>
              f.lastYearUnits === null ? (
                <View key={f.month} style={styles.forecastRow}>
                  <Text style={styles.forecastMonth}>{f.month}</Text>
                  <Text style={styles.subtle}>No bill from {f.lastYearMonth} to forecast from.</Text>
                </View>
              ) : (
                <View key={f.month} style={styles.forecastRow}>
                  <View style={styles.forecastHeader}>
                    <Text style={styles.forecastMonth}>{f.month}</Text>
                    {f.flaggedHigh && <Badge label="Trending high" color={colors.danger} />}
                  </View>
                  <Text style={styles.subtle}>
                    {f.unitsLow.toFixed(0)}-{f.unitsHigh.toFixed(0)} units (Rs {f.rsLow.toFixed(0)}-
                    {f.rsHigh.toFixed(0)}), vs {f.lastYearUnits} units in {f.lastYearMonth}
                  </Text>
                </View>
              )
            )}
          </Card>
        )}
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
  forecastRow: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  forecastHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  forecastMonth: { color: colors.text, fontWeight: "700", fontSize: 14 },
});
