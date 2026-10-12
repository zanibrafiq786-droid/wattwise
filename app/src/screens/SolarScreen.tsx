import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon, IconName } from "../components/Icon";
import { RangeBarChart } from "../components/RangeBarChart";
import { TextField } from "../components/TextField";
import { Toggle } from "../components/Toggle";
import { useAuth } from "../lib/authContext";
import { useBillHistory, useConfig } from "../lib/firebase";
import { useI18n } from "../lib/i18n";
import {
  computeSmartDefaults,
  SolarCandidate,
  SolarRegion,
  runSolarAnalysis,
  useSolarReport,
  useSolarStatus,
} from "../lib/solar";
import { Colors, fonts, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

// Plain-language names instead of "On-grid / Hybrid / Off-grid".
const DESIGN_LABEL: Record<string, string> = {
  on_grid: "Solar + grid, no battery",
  hybrid: "Solar + battery backup",
  off_grid: "Solar + battery, no grid",
};

// Typical panel sold in Pakistan today; turns "2.2 kW" into "about 4 panels",
// which is how people actually picture a system.
const PANEL_WATTS = 550;
function panelCount(kw: number) {
  return Math.max(1, Math.round((kw * 1000) / PANEL_WATTS));
}
const DESIGN_COLOR = (colors: Colors): Record<string, string> => ({
  on_grid: colors.primary,
  hybrid: colors.success,
  off_grid: colors.warning,
});

// Simple, non-technical stand-in for "when does the outage usually start" --
// a picker of 4 words beats a raw 0-23 hour number for a user who doesn't
// think in 24h clock terms.
const TIME_SLOTS: { key: "solarMorning" | "solarAfternoon" | "solarEvening" | "solarNight"; hour: number }[] = [
  { key: "solarMorning", hour: 7 },
  { key: "solarAfternoon", hour: 13 },
  { key: "solarEvening", hour: 18 },
  { key: "solarNight", hour: 22 },
];

// South is the best-performing roof direction in Pakistan (northern
// hemisphere) -- pre-selected by default per the "already filled in" request.
const DIRECTIONS: { value: "south" | "east" | "west" | "north"; key: "solarDirSouth" | "solarDirEast" | "solarDirWest" | "solarDirNorth"; sunX: number; sunY: number }[] = [
  { value: "south", key: "solarDirSouth", sunX: 165, sunY: 18 },
  { value: "east", key: "solarDirEast", sunX: 20, sunY: 35 },
  { value: "west", key: "solarDirWest", sunX: 180, sunY: 35 },
  { value: "north", key: "solarDirNorth", sunX: 35, sunY: 18 },
];

const CARDINAL_DEGREES: { value: "north" | "east" | "south" | "west"; deg: number }[] = [
  { value: "north", deg: 0 },
  { value: "east", deg: 90 },
  { value: "south", deg: 180 },
  { value: "west", deg: 270 },
];

// Picks the closest of the 4 compass directions to a raw heading reading
// (0-360, 0=north), handling the 350-deg-is-near-0-deg wraparound.
function nearestCardinal(deg: number): "north" | "east" | "south" | "west" {
  let best = CARDINAL_DEGREES[0];
  let bestDiff = 361;
  for (const c of CARDINAL_DEGREES) {
    const diff = Math.abs(((deg - c.deg + 540) % 360) - 180);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best.value;
}

// Illustrative side-view: a flat ground line, a panel tilted at the chosen
// angle, and a sun on the side the panel faces. Not a satellite/roof photo
// (no imagery data available) -- a quick visual so the user can see what
// "south-facing, 30 degree tilt" actually means instead of reading numbers.
function RoofDiagram({ direction, tiltDeg }: { direction: "south" | "east" | "west" | "north"; tiltDeg: number }) {
  const colors = useColors();
  const dir = DIRECTIONS.find((d) => d.value === direction) ?? DIRECTIONS[0];
  const rotation = direction === "west" || direction === "north" ? tiltDeg : -tiltDeg;
  return (
    <Svg width="100%" height={110} viewBox="0 0 200 100">
      <Circle cx={dir.sunX} cy={dir.sunY} r={10} fill={colors.warning} />
      <Line x1={10} y1={80} x2={190} y2={80} stroke={colors.border} strokeWidth={2} />
      <Rect
        x={60}
        y={70}
        width={80}
        height={8}
        rx={2}
        fill={colors.primary}
        transform={`rotate(${rotation} 60 80)`}
      />
    </Svg>
  );
}

function Stepper({ value, onChange, min, max, suffix }: { value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string }) {
  const colors = useColors();
  const styles = makeStepperStyles(colors);
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.btn}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text style={[styles.btnText, value <= min && { opacity: 0.4 }]}>-</Text>
      </Pressable>
      <Text style={styles.value}>
        {value}
        {suffix ? ` ${suffix}` : ""}
      </Text>
      <Pressable
        style={styles.btn}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <Text style={[styles.btnText, value >= max && { opacity: 0.4 }]}>+</Text>
      </Pressable>
    </View>
  );
}

function StatTile({ icon, label, value, color }: { icon: IconName; label: string; value: string; color: string }) {
  const colors = useColors();
  const styles = makeStatStyles(colors);
  return (
    <View style={styles.tile}>
      <View style={[styles.iconWrap, { backgroundColor: color + "22" }]}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function BulletRow({ icon, text, color }: { icon: IconName; text: string; color: string }) {
  const colors = useColors();
  const styles = makeBulletStyles(colors);
  return (
    <View style={styles.row}>
      <Icon name={icon} size={16} color={color} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

export function SolarScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const uid = user?.uid ?? null;
  const status = useSolarStatus(uid);
  const { report } = useSolarReport(uid);
  const { bills } = useBillHistory();
  const { config } = useConfig();
  const applianceCount = config.appliances?.length ?? 0;

  const smart = useMemo(() => computeSmartDefaults(bills ?? []), [bills]);

  const [acAfternoon, setAcAfternoon] = useState(smart.ac_afternoon);
  const [outageHours, setOutageHours] = useState(2);
  const [outageSlot, setOutageSlot] = useState<number>(18);
  const [roofDirection, setRoofDirection] = useState<"south" | "east" | "west" | "north">("south");
  const [tiltDeg, setTiltDeg] = useState(31);
  const [detecting, setDetecting] = useState(false);
  const [detectedHeadingDeg, setDetectedHeadingDeg] = useState<number | null>(null);
  const [headingError, setHeadingError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [lat, setLat] = useState("31.42");
  const [lon, setLon] = useState("73.08");
  const [locationStatus, setLocationStatus] = useState<"detecting" | "auto" | "default" | "denied">("detecting");
  // Until GPS answers, assume Pakistan (this app's market) and say so.
  const [region, setRegion] = useState<SolarRegion>({ country: "Pakistan", assumed: true });
  const [touchedTilt, setTouchedTilt] = useState(false);
  const [costPerKw, setCostPerKw] = useState("160000");
  const [costPerKwhBattery, setCostPerKwhBattery] = useState("55000");
  const [exportRate, setExportRate] = useState("0");

  // Re-apply the bill-derived AC guess once bills actually load (they arrive
  // async after mount), without overwriting a value the user already changed.
  const [touchedAc, setTouchedAc] = useState(false);
  useEffect(() => {
    if (!touchedAc) setAcAfternoon(smart.ac_afternoon);
  }, [smart.ac_afternoon, touchedAc]);

  // Sun angle / tilt depends on exactly where the user is, not on a fixed
  // example city -- use the phone's real GPS instead of a hardcoded
  // lat/lon so the estimate is for their actual location. Falls back to the
  // Faisalabad default (editable in "More settings") if permission is denied.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) setLocationStatus("denied");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
        if (!touchedTilt) setTiltDeg(Math.max(5, Math.min(45, Math.round(Math.abs(pos.coords.latitude)))));
        setLocationStatus("auto");
        // Country/city so the AI can apply the solar rules of where the
        // user actually lives (what's allowed, approvals, buy-back).
        try {
          const [place] = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (!cancelled && place?.country) {
            setRegion({ country: place.country, province: place.region ?? undefined, city: place.city ?? undefined });
          }
        } catch {
          // keep the default region
        }
      } catch {
        if (!cancelled) setLocationStatus("default");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best-effort compass detection: the user holds the phone flat, pointing
  // the way the roof/open area faces outward, and we read the device's
  // magnetic heading for ~1.5s (a single instant reading jitters too much)
  // and snap it to the nearest of the 4 directions. This is a helper, not a
  // measurement -- phone compasses are affected by nearby metal/magnets, so
  // the manual chips above stay available to correct it.
  async function handleDetectDirection() {
    setHeadingError(null);
    setDetecting(true);
    let subscription: Location.LocationSubscription | null = null;
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== "granted") {
        setHeadingError(t("solarCompassDenied"));
        return;
      }
      const samples: number[] = [];
      subscription = await Location.watchHeadingAsync((h) => {
        const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (deg >= 0) samples.push(deg);
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      subscription.remove();
      subscription = null;
      if (samples.length === 0) {
        setHeadingError(t("solarCompassUnavailable"));
        return;
      }
      // Circular mean -- a plain average of e.g. 350 deg and 10 deg would
      // wrongly give 180 deg instead of 0 deg.
      const sumSin = samples.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
      const sumCos = samples.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
      const meanDeg = ((Math.atan2(sumSin, sumCos) * 180) / Math.PI + 360) % 360;
      setDetectedHeadingDeg(Math.round(meanDeg));
      setRoofDirection(nearestCardinal(meanDeg));
    } catch {
      setHeadingError(t("solarCompassUnavailable"));
    } finally {
      subscription?.remove();
      setDetecting(false);
    }
  }

  const running = status?.state === "running";

  function handleRun() {
    if (!uid) return;
    runSolarAnalysis(uid, {
      lat: parseFloat(lat) || 31.42,
      lon: parseFloat(lon) || 73.08,
      daytime_share: acAfternoon ? 0.45 : 0.35,
      ac_afternoon: acAfternoon,
      outage_hours_per_day: outageHours,
      outage_start_hour: outageSlot,
      cost_per_kw_rs: parseFloat(costPerKw) || 160000,
      cost_per_kwh_battery_rs: parseFloat(costPerKwhBattery) || 55000,
      export_rate_rs_per_unit: parseFloat(exportRate) || 0,
      roof_direction: roofDirection,
      tilt_deg: tiltDeg,
      region,
    });
  }

  const chosenCandidate: SolarCandidate | undefined = report?.candidates.find(
    (c) => c.design === report.recommendation.chosen.design && c.system_kw === report.recommendation.chosen.system_kw
  );

  // One bar per design type (the 100%-offset size, the easiest apples-to-apples
  // comparison for a non-technical reader) instead of showing all 12 raw
  // candidate rows. Payback years, not raw annual saving -- a bigger, pricier
  // system (e.g. off-grid) can show a bigger saving number while actually
  // taking far longer to pay for itself, which looked backwards as a savings
  // chart (off-grid "winning" right after the AI recommended hybrid).
  const compareItems = useMemo(() => {
    if (!report) return [];
    const byDesign = new Map<string, SolarCandidate>();
    for (const c of report.candidates) {
      if (c.target_offset_pct === 100) byDesign.set(c.design, c);
    }
    const colorMap = DESIGN_COLOR(colors);
    return Array.from(byDesign.values())
      .filter((c) => c.payback_years_low != null)
      .map((c) => ({
        label: DESIGN_LABEL[c.design] ?? c.design,
        low: c.payback_years_low as number,
        high: c.payback_years_high as number,
        color: colorMap[c.design] ?? colors.primary,
        unit: t("solarYears"),
      }));
  }, [report, colors, t]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("solarTitle")}</Text>
        <Text style={styles.intro}>{t("solarIntro")}</Text>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t("solarYourUsage")}</Text>
          {smart.monthsCount > 0 && <Text style={styles.prefilledNote}>{t("solarPrefilled")}</Text>}
          <Text style={applianceCount > 0 ? styles.prefilledNote : styles.advancedHint}>
            {applianceCount > 0
              ? t("solarUsingAppliances", { n: String(applianceCount) })
              : t("solarAddAppliancesHint")}
          </Text>
          {locationStatus === "auto" && <Text style={styles.prefilledNote}>{t("solarLocationAuto")}</Text>}
          {(locationStatus === "denied" || locationStatus === "default") && (
            <Text style={styles.advancedHint}>{t("solarLocationDefault")}</Text>
          )}

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>{t("solarAcAfternoon")}</Text>
            </View>
            <Toggle
              value={acAfternoon}
              onValueChange={(v) => {
                setTouchedAc(true);
                setAcAfternoon(v);
              }}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.toggleLabel}>{t("solarRoofDirection")}</Text>
            <View style={styles.slotRow}>
              {DIRECTIONS.map((d) => {
                const active = roofDirection === d.value;
                return (
                  <Pressable
                    key={d.value}
                    onPress={() => setRoofDirection(d.value)}
                    style={[styles.slotChip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.slotText, active && { color: "#FFFFFF" }]}>{t(d.key)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {roofDirection === "south" && !detectedHeadingDeg && <Text style={styles.advancedHint}>{t("solarDirBestNote")}</Text>}

            <Pressable style={styles.compassButton} onPress={handleDetectDirection} disabled={detecting}>
              <Icon name="refresh" size={14} color={colors.primary} />
              <Text style={styles.compassButtonText}>{t("solarDetectDirection")}</Text>
            </Pressable>
            {detecting && <Text style={styles.advancedHint}>{t("solarDetecting")}</Text>}
            {!detecting && detectedHeadingDeg != null && (
              <Text style={styles.prefilledNote}>{t("solarDetectedDirection", { deg: String(detectedHeadingDeg) })}</Text>
            )}
            {!detecting && headingError && <Text style={styles.errorText}>{headingError}</Text>}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.toggleLabel}>{t("solarRoofTilt")}</Text>
            <Stepper
              value={tiltDeg}
              onChange={(v) => {
                setTouchedTilt(true);
                setTiltDeg(v);
              }}
              min={5}
              max={45}
              suffix="°"
            />
          </View>

          <RoofDiagram direction={roofDirection} tiltDeg={tiltDeg} />
          <Text style={styles.advancedHint}>{t("solarIllustrative")}</Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.toggleLabel}>{t("solarOutageHours")}</Text>
            <Stepper value={outageHours} onChange={setOutageHours} min={0} max={12} suffix="hrs" />
          </View>

          {outageHours > 0 && (
            <View style={styles.fieldBlock}>
              <Text style={styles.toggleLabel}>{t("solarOutageStart")}</Text>
              <View style={styles.slotRow}>
                {TIME_SLOTS.map((slot) => {
                  const active = outageSlot === slot.hour;
                  return (
                    <Pressable
                      key={slot.key}
                      onPress={() => setOutageSlot(slot.hour)}
                      style={[styles.slotChip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    >
                      <Text style={[styles.slotText, active && { color: "#FFFFFF" }]}>{t(slot.key)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <Pressable style={styles.advancedToggle} onPress={() => setAdvancedOpen((v) => !v)}>
            <Icon name={advancedOpen ? "chev" : "sliders"} size={14} color={colors.textMuted} />
            <Text style={styles.advancedLabel}>{t("solarAdvanced")}</Text>
          </Pressable>

          {advancedOpen && (
            <View style={styles.fieldBlock}>
              <Text style={styles.advancedHint}>{t("solarAdvancedHint")}</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <TextField label="Lat" value={lat} onChangeText={setLat} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="Lon" value={lon} onChangeText={setLon} keyboardType="numeric" />
                </View>
              </View>
              <TextField label={t("solarCostPerKw")} value={costPerKw} onChangeText={setCostPerKw} keyboardType="numeric" />
              <TextField label={t("solarCostPerKwhBattery")} value={costPerKwhBattery} onChangeText={setCostPerKwhBattery} keyboardType="numeric" />
              <TextField label={t("solarExportRate")} value={exportRate} onChangeText={setExportRate} keyboardType="numeric" />
            </View>
          )}

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

            <Card style={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <Icon name="sun" size={28} color={colors.primary} />
              </View>
              <Text style={styles.heroHeadline}>{report.recommendation.headline ?? report.recommendation.why}</Text>
              <Text style={styles.heroDesign}>
                {DESIGN_LABEL[report.recommendation.chosen.design] ?? report.recommendation.chosen.design}
              </Text>
              {report.bill_profile.confidence !== "high" && (
                <Text style={styles.lowConfidence}>{t("solarLowConfidence")}</Text>
              )}
            </Card>

            {report.recommendation.region_note ? (
              <Card style={styles.regionCard}>
                <Icon name="warn" size={18} color={colors.warning} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.regionTitle}>
                    {t("solarRegionTitle", {
                      place: [report.region?.city, report.region?.country].filter(Boolean).join(", ") || "your area",
                    })}
                  </Text>
                  <Text style={styles.regionText}>{report.recommendation.region_note}</Text>
                </View>
              </Card>
            ) : null}

            <View style={styles.statsGrid}>
              <StatTile
                icon="sun"
                label={t("solarStatPanels", { kw: report.recommendation.chosen.system_kw.toFixed(1) })}
                value={`~${panelCount(report.recommendation.chosen.system_kw)} ${t("solarPanels")}`}
                color={colors.primary}
              />
              <StatTile
                icon="power"
                label={t("solarStatBattery")}
                value={
                  report.recommendation.chosen.battery_kwh > 0
                    ? `${report.recommendation.chosen.battery_kwh} kWh`
                    : t("solarNoBattery")
                }
                color={colors.success}
              />
              <StatTile
                icon="coin"
                label={t("solarStatSaving")}
                value={chosenCandidate ? `Rs ${(chosenCandidate.annual_saving_rs_low / 1000).toFixed(0)}-${(chosenCandidate.annual_saving_rs_high / 1000).toFixed(0)}k` : "--"}
                color={colors.success}
              />
              <StatTile
                icon="refresh"
                label={t("solarStatPayback")}
                value={
                  chosenCandidate?.payback_years_low != null
                    ? `${chosenCandidate.payback_years_low}-${chosenCandidate.payback_years_high} ${t("solarYears")}`
                    : "--"
                }
                color={colors.warning}
              />
              <StatTile
                icon="chart"
                label={t("solarStatCoverage")}
                value={chosenCandidate ? `${chosenCandidate.solar_fraction_pct}%` : "--"}
                color={colors.primary}
              />
            </View>

            <Card style={styles.card}>
              <BulletRow icon="warn" text={report.recommendation.tradeoffs} color={colors.warning} />
              <BulletRow icon="chip" text={report.recommendation.what_could_change_the_answer} color={colors.textMuted} />
              {report.recommendation.vendor_checklist.map((item, i) => (
                <BulletRow key={i} icon="check" text={item} color={colors.success} />
              ))}
            </Card>

            {compareItems.length > 0 && (
              <>
                <Text style={styles.cardTitle}>{t("solarCompareChart")}</Text>
                <Card style={styles.card}>
                  <RangeBarChart items={compareItems} />
                </Card>
              </>
            )}
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
    title: { color: colors.text, fontSize: 30, fontFamily: fonts.headingMedium },
    intro: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    card: { gap: spacing.sm },
    row: { flexDirection: "row", gap: spacing.sm },
    fieldBlock: { gap: spacing.xs, marginTop: spacing.xs },
    toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    toggleLabel: { color: colors.text, fontSize: 14, flex: 1 },
    prefilledNote: { color: colors.success, fontSize: 12, fontStyle: "italic" },
    slotRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
    slotChip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    slotText: { color: colors.text, fontSize: 13 },
    advancedToggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    advancedLabel: { color: colors.textMuted, fontSize: 13 },
    compassButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      alignSelf: "flex-start",
      marginTop: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    compassButtonText: { color: colors.primary, fontSize: 13, fontFamily: fonts.bodySemiBold },
    advancedHint: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
    center: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
    runningText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
    errorText: { color: colors.danger, fontSize: 13 },
    emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center", paddingVertical: spacing.lg },
    titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cardTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.headingMedium },
    lowConfidence: { color: colors.warning, fontSize: 12, fontStyle: "italic" },
    heroCard: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.lg },
    heroIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary + "22",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    heroHeadline: { color: colors.text, fontSize: 18, fontFamily: fonts.headingMedium, textAlign: "center" },
    heroDesign: { color: colors.textMuted, fontSize: 13 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    regionCard: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", borderColor: colors.warning + "66" },
    regionTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemiBold },
    regionText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  });
}

function makeStepperStyles(colors: Colors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    btn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: { color: colors.text, fontSize: 18, fontFamily: fonts.bodySemiBold },
    value: { color: colors.text, fontSize: 16, fontFamily: fonts.bodySemiBold, minWidth: 64, textAlign: "center" },
  });
}

function makeStatStyles(colors: Colors) {
  return StyleSheet.create({
    tile: {
      flexBasis: "47%",
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm + 2,
      gap: 4,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    tileValue: { color: colors.text, fontSize: 18, fontFamily: fonts.headingMedium },
    tileLabel: { color: colors.textMuted, fontSize: 12 },
  });
}

function makeBulletStyles(colors: Colors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 4 },
    text: { color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 },
  });
}
