import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../lib/authContext";
import { formatRs } from "../lib/format";
import { MonthForecast } from "../lib/forecastCalc";
import { useI18n } from "../lib/i18n";
import { calcBill, requestTariff, TARIFF_MARGIN, useTariff } from "../lib/tariff";
import { Colors, fonts, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { BillEntry } from "../lib/types";
import { Button } from "./Button";
import { TextField } from "./TextField";

// "Estimate my bill" (inside a dropdown on Report). Type units -- or tap the
// last bill's or next month's forecast units -- and see the charge worked out
// from the tariff the AI looked up for your area. The AI supplies the rates;
// the sums are done by code, so every line adds up.
export function BillCalculator({
  lastBill,
  forecast,
}: {
  lastBill: BillEntry | null; // latest bill with a normal amount (for the comparison)
  forecast: MonthForecast | null; // next month's forecast, if there is one
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const uid = user?.uid ?? null;
  const { schedule, status, loading } = useTariff(uid);

  const [area, setArea] = useState("FESCO, Pakistan");
  const [units, setUnits] = useState(lastBill ? String(Math.round(lastBill.units)) : "");
  const [asked, setAsked] = useState(false);

  // Once a saved tariff exists, show its area in the box so "Update" re-asks for the same place.
  useEffect(() => {
    if (schedule?.area_asked) setArea(schedule.area_asked);
  }, [schedule?.area_asked]);

  const running = asked && status?.state === "running";
  const n = parseFloat(units);
  const calc = schedule && n > 0 ? calcBill(schedule, n) : null;
  const cur = schedule?.currency || "Rs";

  // Same maths on the last real bill, so the user can see how close the estimate is.
  const check =
    schedule && lastBill && lastBill.amount_rs ? { est: calcBill(schedule, lastBill.units).total, real: lastBill.amount_rs } : null;
  const diffPct = check ? Math.round(((check.est - check.real) / check.real) * 100) : null;

  function ask() {
    if (!uid) return;
    setAsked(true);
    requestTariff(uid, area.trim() || "Pakistan");
  }

  const fcUnits = forecast && forecast.lastYearUnits !== null ? Math.round((forecast.unitsLow + forecast.unitsHigh) / 2) : null;

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.subtle}>{t("billCalcIntro")}</Text>

      {/* 1. the tariff (looked up once by AI, then kept) */}
      <View style={styles.box}>
        <TextField label={t("billCalcArea")} value={area} onChangeText={setArea} autoCapitalize="words" />
        {loading ? null : (
          <Button
            label={running ? t("billCalcLooking") : schedule ? t("billCalcUpdate") : t("billCalcGet")}
            icon="chip"
            variant={schedule ? "secondary" : "primary"}
            onPress={ask}
            disabled={running}
          />
        )}
        {running && (
          <View style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.subtle}>{t("billCalcLookingSub")}</Text>
          </View>
        )}
        {asked && status?.state === "error" && <Text style={styles.error}>{t("billCalcError")}</Text>}
      </View>

      {/* 2. the units, and the bill they come to */}
      {schedule && (
        <>
          <View style={styles.box}>
            <TextField label={t("billCalcUnits")} value={units} onChangeText={setUnits} keyboardType="numeric" placeholder="e.g. 250" />
            <View style={styles.chips}>
              {lastBill && (
                <Pressable style={styles.chip} onPress={() => setUnits(String(Math.round(lastBill.units)))}>
                  <Text style={styles.chipText}>{t("billCalcLastBill", { n: String(Math.round(lastBill.units)) })}</Text>
                </Pressable>
              )}
              {fcUnits !== null && (
                <Pressable style={styles.chip} onPress={() => setUnits(String(fcUnits))}>
                  <Text style={styles.chipText}>{t("billCalcForecast", { n: String(fcUnits) })}</Text>
                </Pressable>
              )}
              {[100, 200, 300].map((u) => (
                <Pressable key={u} style={styles.chip} onPress={() => setUnits(String(u))}>
                  <Text style={styles.chipText}>{u}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {calc && (
            <View style={styles.result}>
              <Text style={styles.resLabel}>{t("billCalcYourBill", { n: String(Math.round(n)) })}</Text>
              <Text style={styles.resTotal}>
                {cur} {formatRs(calc.total * (1 - TARIFF_MARGIN))}-{formatRs(calc.total * (1 + TARIFF_MARGIN))}
              </Text>
              <Text style={styles.resSub}>
                {t("billCalcAbout", { amount: `${cur} ${formatRs(calc.total)}`, per: `${cur} ${calc.perUnit.toFixed(1)}` })}
              </Text>
              <View style={styles.lines}>
                {calc.lines.map((l, i) => (
                  <View key={i} style={styles.line}>
                    <Text style={styles.lineLabel}>{l.label}</Text>
                    <Text style={styles.lineAmt}>
                      {cur} {formatRs(l.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {check && diffPct !== null && (
            <Text style={styles.subtle}>
              {t("billCalcCheck", {
                n: String(Math.round(lastBill!.units)),
                est: `${cur} ${formatRs(check.est)}`,
                real: `${cur} ${formatRs(check.real)}`,
                pct: `${diffPct > 0 ? "+" : ""}${diffPct}%`,
              })}
            </Text>
          )}

          <View style={styles.note}>
            <Text style={styles.noteTitle}>
              {t("billCalcTariffUsed", { area: schedule.area_label || schedule.area_asked || "", asof: schedule.as_of || "?" })}
            </Text>
            <Text style={styles.noteText}>{t("billCalcMode", { mode: schedule.mode === "telescopic" ? t("billCalcModeTele") : t("billCalcModeFlat") })}</Text>
            {schedule.notes.map((x, i) => (
              <Text key={i} style={styles.noteText}>
                • {x}
              </Text>
            ))}
            <Text style={styles.noteWarn}>{t("billCalcDisclaimer", { conf: t(`billCalcConf_${schedule.confidence}` as any) })}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    subtle: { color: colors.textMuted, fontSize: 13, lineHeight: 18, flexShrink: 1 },
    error: { color: colors.danger, fontSize: 13 },
    box: { gap: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    chip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    chipText: { color: colors.text, fontSize: 13 },
    result: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 4 },
    resLabel: { color: colors.textMuted, fontSize: 12 },
    resTotal: { color: colors.primary, fontSize: 30, fontFamily: fonts.headingMedium },
    resSub: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
    lines: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
    line: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
    lineLabel: { color: colors.text, fontSize: 13, flexShrink: 1 },
    lineAmt: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
    note: { gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
    noteTitle: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
    noteText: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
    noteWarn: { color: colors.warning, fontSize: 12, lineHeight: 17, marginTop: 2 },
  });
}
