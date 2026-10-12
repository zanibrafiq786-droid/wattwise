import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../components/Badge";
import { BillHistoryChart } from "../components/BillHistoryChart";
import { BillImportCard } from "../components/BillImportCard";
import { Card } from "../components/Card";
import { Expandable } from "../components/Expandable";
import { MonthBars } from "../components/MonthBars";
import { MonthDial } from "../components/MonthDial";
import { PlanChecklist } from "../components/PlanChecklist";
import { WasteBreakdown } from "../components/WasteBreakdown";
import { Segmented } from "../components/Segmented";
import { StateView } from "../components/StateView";
import { WhyBillHighCard } from "../components/WhyBillHighCard";
import { YearRing } from "../components/YearRing";
import { useDataSource } from "../lib/dataSourceContext";
import {
  billAmountLabel,
  hasUnits,
  isValidBill,
  latestValidBill,
  useBill,
  useBillHistory,
  useConfig,
  useDevice,
  useMonthReport,
  useRoomEvents,
  useSimulatedFlag,
} from "../lib/firebase";
import { pickPlanStep, pickReportText } from "../lib/bilingual";
import { computeForecast } from "../lib/forecastCalc";
import { useI18n } from "../lib/i18n";
import { lastCompletedMonth, monthName, shiftMonth } from "../lib/months";
import { computeWasteReport } from "../lib/reportCalc";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonth(key: string) {
  const [y, m] = key.split("-");
  return `${SHORT_MONTHS[parseInt(m, 10) - 1] ?? m} ${y}`;
}

// Report, top to bottom: a one-line bill import, the bill history (the user
// picks Circle or Bars, This month or Full year), "Why the bill is high",
// then the AI explanation and the 3-month forecast -- both collapsed until
// tapped so the page isn't a wall of text.
export function ReportScreen() {
  const monthKey = currentMonthKey();
  const { source } = useDataSource();
  const { device } = useDevice();
  const { events, loading: eventsLoading, error } = useRoomEvents(device, source);
  const { bill } = useBill(monthKey);
  const { config } = useConfig();
  const { report } = useMonthReport(monthKey);
  const billsAreSimulated = useSimulatedFlag();
  const simulated = source === "simulated" || billsAreSimulated;
  const { bills, loading: billsLoading } = useBillHistory();
  const { t, language } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);

  const [view, setView] = useState<"circle" | "bars">("circle");
  const [range, setRange] = useState<"month" | "year">("month");

  // Only real-looking bills feed the charts and forecast. Some stored months
  // came from an old photo import that misread the bill's history table
  // (negative amounts, or e.g. Rs 84 for 290 units) -- including a month
  // that hasn't even been billed yet. Showing their units as if they were
  // real bills was wrong, so they're hidden and the page says how many.
  // Every month with units counts for the charts. Rupee maths below only
  // uses bills with a normal amount (solar net-metering bills can be tiny
  // or a credit -- real, but not something to compute "% of bill" against).
  const goodBills = bills ? bills.filter(hasUnits) : null;
  const hiddenCount = bills && goodBills ? bills.length - goodBills.length : 0;
  const hasSolarCredit = (goodBills ?? []).some((b) => b.amount_rs != null && !isValidBill(b));
  // "This month" = the month of the most recent bill you've uploaded (that's
  // the bill you care about), compared with the month before and the same
  // month last year. With no bills yet, it points at the month that just
  // ended so the "not added yet" prompt names the right month.
  const target = goodBills && goodBills.length > 0 ? goodBills[goodBills.length - 1].month : lastCompletedMonth();
  const targetBill = goodBills?.find((b) => b.month === target) ?? null;
  const lastYearKey = shiftMonth(target, -12);
  const lastYearBill = goodBills?.find((b) => b.month === lastYearKey) ?? null;
  const reconcileBill = latestValidBill(bills);
  const waste = events ? computeWasteReport(events, config, reconcileBill ?? bill) : null;
  const forecasts = goodBills ? computeForecast(goodBills, config) : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("report")}</Text>
          {simulated && <Badge label="SIMULATED" color={colors.warning} />}
        </View>

        <BillImportCard />

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t("billHistory")}</Text>
          <View style={styles.controls}>
            <Segmented
              options={[
                { key: "circle", label: t("viewCircle") },
                { key: "bars", label: t("viewBars"), icon: "chart" },
              ]}
              value={view}
              onChange={setView}
            />
            <Segmented
              options={[
                { key: "month", label: t("rangeMonth") },
                { key: "year", label: t("rangeYear") },
              ]}
              value={range}
              onChange={setRange}
            />
          </View>

          <StateView
            loading={billsLoading}
            empty={!goodBills || goodBills.length === 0}
            emptyMessage="No bills yet. Use Import bill above, or add one in Setup."
          >
            {goodBills && (
              <View style={styles.chartArea}>
                {view === "circle" && range === "month" && (
                  <>
                    {targetBill ? (
                      <View style={styles.center}>
                        <MonthDial
                          unitsUsed={targetBill.units}
                          monthLabel={shortMonth(targetBill.month)}
                          amountLabel={billAmountLabel(targetBill)}
                        />
                      </View>
                    ) : (
                      <View style={styles.missingBox}>
                        <Text style={styles.missingTitle}>{t("billNotAdded", { month: monthName(target) })}</Text>
                        <Text style={styles.subtle}>{t("billNotAddedHint")}</Text>
                      </View>
                    )}
                    <View style={styles.compareRow}>
                      <Text style={styles.compareLabel}>{t("lastYearLabel", { month: monthName(lastYearKey) })}</Text>
                      <Text style={styles.compareValue}>
                        {lastYearBill
                          ? `${Math.round(lastYearBill.units)} units · ${billAmountLabel(lastYearBill)}`
                          : t("noBillSaved")}
                      </Text>
                    </View>
                    {targetBill && lastYearBill && (
                      <Text style={styles.subtle}>
                        {targetBill.units >= lastYearBill.units
                          ? t("vsLastYearUp", { n: String(Math.round(targetBill.units - lastYearBill.units)) })
                          : t("vsLastYearDown", { n: String(Math.round(lastYearBill.units - targetBill.units)) })}
                      </Text>
                    )}
                  </>
                )}
                {view === "circle" && range === "year" && <YearRing bills={goodBills} />}
                {view === "bars" && range === "month" && <MonthBars bills={goodBills} target={target} />}
                {view === "bars" && range === "year" && <BillHistoryChart bills={goodBills} />}
                <Text style={styles.caption}>{t("billHistoryCaption")}</Text>
              </View>
            )}
          </StateView>
          {hasSolarCredit && (
            <View style={styles.hiddenNote}>
              <Text style={styles.hiddenText}>{t("solarCreditNote")}</Text>
            </View>
          )}
          {hiddenCount > 0 && (
            <View style={styles.hiddenNote}>
              <Text style={styles.hiddenText}>{t("billsHiddenNote", { n: String(hiddenCount) })}</Text>
            </View>
          )}
        </Card>

        <StateView loading={eventsLoading} error={error} empty={false}>
          {waste && <WhyBillHighCard waste={waste} />}
        </StateView>

        <Expandable title={t("aiExplanationTitle")} subtitle={t("aiExplanationSub")} icon="chip">
          {waste && waste.daysCovered > 0 ? (
            <>
              <Text style={styles.sectionLabel}>{t("wasteWhereTitle")}</Text>
              <WasteBreakdown
                items={waste.appliances}
                totalLow={waste.totalRsLow}
                totalHigh={waste.totalRsHigh}
                billNote={
                  waste.percentOfBillLow !== null && waste.percentOfBillHigh !== null && reconcileBill
                    ? t("wasteOfBill", {
                        low: waste.percentOfBillLow.toFixed(0),
                        high: waste.percentOfBillHigh.toFixed(0),
                        amount: (reconcileBill.amount_rs ?? 0).toFixed(0),
                        month: monthName(reconcileBill.month),
                      })
                    : null
                }
              />
              <Text style={styles.subtle}>{t("wasteBasedOn", { days: waste.daysCovered.toFixed(1) })}</Text>
            </>
          ) : (
            <Text style={styles.subtle}>{t("wasteNotEnough")}</Text>
          )}

          <View style={styles.divider} />
          {report?.text ? (
            <>
              <Text style={styles.sectionLabel}>{t("aiWhatHappened")}</Text>
              <Text style={styles.reportText}>{pickReportText(report.text, language)}</Text>
              {report.plan_steps && report.plan_steps.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: spacing.sm }]}>{t("planTitle")}</Text>
                  <PlanChecklist steps={report.plan_steps.map((s) => pickPlanStep(s, language))} />
                  <Text style={styles.subtle}>{t("planNote")}</Text>
                </>
              )}
            </>
          ) : (
            <Text style={styles.subtle}>{t("aiNoReport")}</Text>
          )}
        </Expandable>

        {forecasts.length > 0 && (
          <Expandable title={t("forecastTitle")} subtitle={t("forecastSub")} icon="chart">
            <Text style={styles.subtle}>
              Based on the same months last year, adjusted for this year's trend so far. Always a range -- not a
              prediction you should treat as exact.
            </Text>
            {forecasts.map((f) =>
              f.lastYearUnits === null ? (
                <View key={f.month} style={styles.forecastRow}>
                  <Text style={styles.forecastMonth}>{shortMonth(f.month)}</Text>
                  <Text style={styles.subtle}>No bill from {f.lastYearMonth} to forecast from.</Text>
                </View>
              ) : (
                <View key={f.month} style={styles.forecastRow}>
                  <View style={styles.forecastHeader}>
                    <Text style={styles.forecastMonth}>{shortMonth(f.month)}</Text>
                    {f.flaggedHigh && <Badge label="Trending high" color={colors.danger} />}
                  </View>
                  <Text style={styles.forecastUnits}>
                    {f.unitsLow.toFixed(0)}-{f.unitsHigh.toFixed(0)} units
                  </Text>
                  <Text style={styles.subtle}>
                    Rs {f.rsLow.toFixed(0)}-{f.rsHigh.toFixed(0)} · vs {f.lastYearUnits} units in {f.lastYearMonth}
                  </Text>
                </View>
              )
            )}
          </Expandable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    title: { color: colors.text, fontSize: 34, fontFamily: fonts.headingMedium },
    card: { gap: spacing.sm },
    cardTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.headingMedium },
    controls: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chartArea: { gap: spacing.md, marginTop: spacing.sm },
    center: { alignItems: "center" },
    caption: { color: colors.textMuted, fontSize: 11, fontStyle: "italic" },
    missingBox: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.border,
      borderRadius: 20,
      padding: spacing.md,
      gap: 4,
      alignItems: "center",
    },
    missingTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemiBold, textAlign: "center" },
    compareRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    compareLabel: { color: colors.textMuted, fontSize: 12, flexShrink: 1 },
    compareValue: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
    hiddenNote: { backgroundColor: colors.warning + "1f", borderRadius: 14, padding: spacing.sm },
    hiddenText: { color: colors.warning, fontSize: 12, lineHeight: 17 },
    sectionLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemiBold },
    subtle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
    reportText: { color: colors.text, fontSize: 14, lineHeight: 21 },
    forecastRow: { gap: 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
    forecastHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    forecastMonth: { color: colors.text, fontWeight: "700", fontSize: 14 },
    forecastUnits: { color: colors.text, fontSize: 18, fontFamily: fonts.headingMedium },
  });
}
