import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { ApplianceWaste } from "../lib/reportCalc";
import { Colors, fonts, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Icon, IconName } from "./Icon";

const ICONS: Record<string, IconName> = { fan: "fan", light: "bulb", ac: "ac" };

// "Where the wasted money went", made easy to read:
//  - one big total at the top (a range, because these are estimates)
//  - one row per appliance: icon, name, rupees, and a bar that starts at
//    zero. The solid part is "at least", the faded part is "could be up to".
//  - each row also says what share of the total waste it is.
export function WasteBreakdown({
  items,
  totalLow,
  totalHigh,
  billNote,
}: {
  items: ApplianceWaste[];
  totalLow: number;
  totalHigh: number;
  billNote?: string | null;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const { t } = useI18n();
  const max = Math.max(1, ...items.map((i) => i.rsHigh));
  const totalMid = Math.max(1, (totalLow + totalHigh) / 2);
  const sorted = [...items].sort((a, b) => b.rsHigh - a.rsHigh);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>{t("wasteTotalLabel")}</Text>
        <Text style={styles.totalValue}>
          Rs {totalLow.toFixed(0)}-{totalHigh.toFixed(0)}
        </Text>
        {billNote ? <Text style={styles.totalNote}>{billNote}</Text> : null}
      </View>

      {sorted.map((item) => {
        const share = Math.round((((item.rsLow + item.rsHigh) / 2) / totalMid) * 100);
        const color = item.key === "fan" ? colors.primary : colors.warning;
        return (
          <View key={item.key} style={styles.row}>
            <View style={styles.icon}>
              <Icon name={ICONS[item.key] ?? "bolt"} size={18} color={color} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.rowHead}>
                <Text style={styles.name}>{item.label}</Text>
                <Text style={styles.rs}>
                  Rs {item.rsLow.toFixed(0)}-{item.rsHigh.toFixed(0)}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(item.rsHigh / max) * 100}%`, backgroundColor: color + "55" }]} />
                <View style={[styles.fill, { width: `${(item.rsLow / max) * 100}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.share}>{t("wasteShare", { n: String(share) })}</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: colors.textMuted }]} />
        <Text style={styles.legendText}>{t("wasteLegendLow")}</Text>
        <View style={[styles.swatch, { backgroundColor: colors.textMuted + "55" }]} />
        <Text style={styles.legendText}>{t("wasteLegendHigh")}</Text>
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    totalBox: {
      backgroundColor: colors.danger + "14",
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: "center",
      gap: 2,
    },
    totalLabel: { color: colors.textMuted, fontSize: 12 },
    totalValue: { color: colors.danger, fontSize: 28, fontFamily: fonts.headingMedium },
    totalNote: { color: colors.text, fontSize: 13, textAlign: "center" },
    row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
    icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    name: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemiBold },
    rs: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemiBold },
    track: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
    fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6 },
    share: { color: colors.textMuted, fontSize: 12 },
    legend: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    swatch: { width: 14, height: 8, borderRadius: 4 },
    legendText: { color: colors.textMuted, fontSize: 11, marginRight: spacing.sm },
  });
}
