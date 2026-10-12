import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { TextField } from "../components/TextField";
import { Toggle } from "../components/Toggle";
import { useAuth } from "../lib/authContext";
import { useI18n } from "../lib/i18n";
import { runSolarAnalysis, useSolarReport, useSolarStatus } from "../lib/solar";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

const DESIGN_LABEL: Record<string, string> = { on_grid: "On-grid", hybrid: "Hybrid", off_grid: "Off-grid" };

export function SolarScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const uid = user?.uid ?? null;
  const status = useSolarStatus(uid);
  const { report } = useSolarReport(uid);

  const [lat, setLat] = useState("31.42");
  const [lon, setLon] = useState("73.08");
  const [daytimePct, setDaytimePct] = useState("35");
  const [acAfternoon, setAcAfternoon] = useState(false);
  const [outageHours, setOutageHours] = useState("2");
  const [outageStart, setOutageStart] = useState("18");
  const [costPerKw, setCostPerKw] = useState("160000");
  const [costPerKwhBattery, setCostPerKwhBattery] = useState("55000");
  const [exportRate, setExportRate] = useState("0");

  const running = status?.state === "running";

  function handleRun() {
    if (!uid) return;
    runSolarAnalysis(uid, {
      lat: parseFloat(lat) || 31.42,
      lon: parseFloat(lon) || 73.08,
      daytime_share: (parseFloat(daytimePct) || 35) / 100,
      ac_afternoon: acAfternoon,
      outage_hours_per_day: parseInt(outageHours, 10) || 0,
      outage_start_hour: parseInt(outageStart, 10) || 18,
      cost_per_kw_rs: parseFloat(costPerKw) || 160000,
      cost_per_kwh_battery_rs: parseFloat(costPerKwhBattery) || 55000,
      export_rate_rs_per_unit: parseFloat(exportRate) || 0,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("solarTitle")}</Text>
        <Text style={styles.intro}>{t("solarIntro")}</Text>

        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField label="Lat" value={lat} onChangeText={setLat} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Lon" value={lon} onChangeText={setLon} keyboardType="numeric" />
            </View>
          </View>
          <TextField label={t("solarDaytimeShare")} value={daytimePct} onChangeText={setDaytimePct} keyboardType="numeric" />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t("solarAcAfternoon")}</Text>
            <Toggle value={acAfternoon} onValueChange={setAcAfternoon} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField label={t("solarOutageHours")} value={outageHours} onChangeText={setOutageHours} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={t("solarOutageStart")} value={outageStart} onChangeText={setOutageStart} keyboardType="numeric" />
            </View>
          </View>
          <TextField label={t("solarCostPerKw")} value={costPerKw} onChangeText={setCostPerKw} keyboardType="numeric" />
          <TextField label={t("solarCostPerKwhBattery")} value={costPerKwhBattery} onChangeText={setCostPerKwhBattery} keyboardType="numeric" />
          <TextField label={t("solarExportRate")} value={exportRate} onChangeText={setExportRate} keyboardType="numeric" />
          <Button label={t("solarRunAnalysis")} icon="sun" onPress={handleRun} disabled={running} />
        </Card>

        {running && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.runningText}>{t("solarRunning")}</Text>
          </View>
        )}

        {status?.state === "error" && <Text style={styles.errorText}>{t("solarError")}</Text>}

        {!report && !running && <Text style={styles.emptyText}>{t("solarEmpty")}</Text>}

        {report && !running && (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{t("solarRecommendation")}</Text>
              {report.simulated && <Badge label="SIMULATED" color={colors.warning} />}
            </View>
            <Card style={styles.card}>
              {report.bill_profile.confidence !== "high" && (
                <Text style={styles.lowConfidence}>{t("solarLowConfidence")}</Text>
              )}
              <Text style={styles.recHeadline}>
                {DESIGN_LABEL[report.recommendation.chosen.design] ?? report.recommendation.chosen.design} --{" "}
                {report.recommendation.chosen.system_kw.toFixed(1)} kW
                {report.recommendation.chosen.battery_kwh > 0 ? `, ${report.recommendation.chosen.battery_kwh} kWh battery` : ""}
              </Text>
              <Text style={styles.bodyText}>{report.recommendation.why}</Text>

              <Text style={styles.sectionLabel}>{t("solarTradeoffs")}</Text>
              <Text style={styles.bodyText}>{report.recommendation.tradeoffs}</Text>

              <Text style={styles.sectionLabel}>{t("solarWhatCouldChange")}</Text>
              <Text style={styles.bodyText}>{report.recommendation.what_could_change_the_answer}</Text>

              <Text style={styles.sectionLabel}>{t("solarVendorChecklist")}</Text>
              {report.recommendation.vendor_checklist.map((item, i) => (
                <Text key={i} style={styles.bulletText}>
                  {"•"} {item}
                </Text>
              ))}
            </Card>

            <Text style={styles.cardTitle}>{t("solarCandidates")}</Text>
            <Card style={styles.card}>
              {report.candidates.map((c, i) => (
                <View key={i} style={[styles.candidateRow, i > 0 && styles.candidateDivider]}>
                  <Text style={styles.candidateTitle}>
                    {DESIGN_LABEL[c.design] ?? c.design} -- {c.system_kw} kW
                    {c.battery_kwh > 0 ? ` + ${c.battery_kwh} kWh` : ""}
                  </Text>
                  <Text style={styles.candidateDetail}>
                    Solar fraction {c.solar_fraction_pct}% -- saving Rs {c.annual_saving_rs_low}-{c.annual_saving_rs_high}/yr --
                    payback {c.payback_years_low ?? "?"}-{c.payback_years_high ?? "?"} yrs
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.md, gap: spacing.md },
    title: { color: colors.text, fontSize: 30, fontFamily: fonts.heading },
    intro: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    card: { gap: spacing.sm },
    row: { flexDirection: "row", gap: spacing.sm },
    toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    toggleLabel: { color: colors.text, fontSize: 14, flex: 1 },
    center: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
    runningText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
    errorText: { color: colors.danger, fontSize: 13 },
    emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center", paddingVertical: spacing.lg },
    titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cardTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.headingMedium },
    lowConfidence: { color: colors.warning, fontSize: 12, fontStyle: "italic" },
    recHeadline: { color: colors.primary, fontSize: 18, fontFamily: fonts.headingMedium },
    bodyText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    sectionLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodySemiBold, marginTop: spacing.xs },
    bulletText: { color: colors.text, fontSize: 13, lineHeight: 19 },
    candidateRow: { paddingVertical: spacing.sm, gap: 4 },
    candidateDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    candidateTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemiBold },
    candidateDetail: { color: colors.textMuted, fontSize: 12 },
  });
}
