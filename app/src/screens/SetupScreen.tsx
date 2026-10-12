import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon, IconName } from "../components/Icon";
import { StatusMessage } from "../components/StatusMessage";
import { useAuth } from "../lib/authContext";
import { deleteAppliance, saveAppliance, saveBill, saveConfig, useBill, useConfig } from "../lib/firebase";
import { useI18n } from "../lib/i18n";
import { currentMonthKey, lastCompletedMonth, monthName, shiftMonth } from "../lib/months";
import { Colors, fonts, spacing } from "../lib/theme";
import { useThemeMode } from "../lib/themeContext";
import { HouseAppliance } from "../lib/types";

// Common Pakistani household appliances with typical wattage -- one tap
// fills the form so nobody has to know watts by heart.
const PRESETS: { name: string; watts: number; hours: number; icon: IconName }[] = [
  { name: "Ceiling fan", watts: 75, hours: 12, icon: "fan" },
  { name: "LED light", watts: 12, hours: 6, icon: "bulb" },
  { name: "AC 1.5 ton", watts: 1500, hours: 6, icon: "ac" },
  { name: "Fridge", watts: 150, hours: 24, icon: "fridge" },
  { name: "TV", watts: 110, hours: 5, icon: "tv" },
  { name: "Iron", watts: 1000, hours: 0.5, icon: "iron" },
  { name: "Water pump", watts: 750, hours: 1, icon: "pump" },
];

// Last tab: account first (with Log out), then the bill, then the whole
// house's appliances (used by the solar advice), then the sensed room's
// wattages and the unit rate. Appearance lives on Home; language and data
// source live in Profile (tap your avatar).
export function SetupScreen() {
  // Which month this bill is for -- defaults to the month that just ended
  // (the running month has no bill yet). It used to always save under the
  // current month, which put a September bill under October.
  const [monthKey, setMonthKey] = useState(lastCompletedMonth());
  const { bill } = useBill(monthKey);
  const { config } = useConfig();
  const { user, displayName, signOut } = useAuth();
  const { t } = useI18n();
  const { colors } = useThemeMode();
  const styles = makeStyles(colors);
  const navigation = useNavigation<any>();

  const [units, setUnits] = useState("");
  const [amount, setAmount] = useState("");
  const [fanW, setFanW] = useState(String(config.watts.fan));
  const [lightW, setLightW] = useState(String(config.watts.light));
  const [acW, setAcW] = useState(String(config.watts.ac));
  const [rate, setRate] = useState(String(config.rate_rs_per_unit));
  const [billStatus, setBillStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [cfgStatus, setCfgStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [aName, setAName] = useState("");
  const [aWatts, setAWatts] = useState("");
  const [aQty, setAQty] = useState("1");
  const [aHours, setAHours] = useState("");
  const [appStatus, setAppStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setUnits(bill ? String(bill.units) : "");
    setAmount(bill && bill.amount_rs != null ? String(bill.amount_rs) : "");
  }, [bill]);

  useEffect(() => {
    setFanW(String(config.watts.fan));
    setLightW(String(config.watts.light));
    setAcW(String(config.watts.ac));
    setRate(String(config.rate_rs_per_unit));
  }, [config]);

  const appliances = config.appliances ?? [];
  const kwhPerDay = appliances.reduce((s, a) => s + (a.watts * a.quantity * a.hours_per_day) / 1000, 0);

  async function handleSaveBill() {
    const u = parseFloat(units);
    const a = parseFloat(amount);
    if (!Number.isFinite(u) || !Number.isFinite(a)) {
      setBillStatus({ type: "error", message: t("enterValidBill") });
      return;
    }
    try {
      await saveBill(monthKey, { units: u, amount_rs: a });
      setBillStatus({ type: "success", message: t("billSavedFor", { month: monthName(monthKey) }) });
    } catch (err) {
      setBillStatus({ type: "error", message: err instanceof Error ? err.message : t("saveFailed") });
    }
  }

  async function handleSaveConfig() {
    const fan = parseFloat(fanW);
    const light = parseFloat(lightW);
    const ac = parseFloat(acW);
    const r = parseFloat(rate);
    if (![fan, light, ac, r].every(Number.isFinite)) {
      setCfgStatus({ type: "error", message: t("enterValidNumbers") });
      return;
    }
    try {
      await saveConfig({ watts: { fan, light, ac }, rate_rs_per_unit: r });
      setCfgStatus({ type: "success", message: t("detailsSaved") });
    } catch (err) {
      setCfgStatus({ type: "error", message: err instanceof Error ? err.message : t("saveFailed") });
    }
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setAName(p.name);
    setAWatts(String(p.watts));
    setAHours(String(p.hours));
    setAQty("1");
  }

  async function handleAddAppliance() {
    const watts = parseFloat(aWatts);
    const qty = parseInt(aQty, 10);
    const hours = parseFloat(aHours);
    if (!aName.trim() || !(watts > 0) || !(qty > 0) || !(hours >= 0 && hours <= 24)) {
      setAppStatus({ type: "error", message: t("applianceInvalid") });
      return;
    }
    const a: HouseAppliance = {
      id: `a_${Date.now()}`,
      name: aName.trim(),
      watts,
      quantity: qty,
      hours_per_day: hours,
    };
    try {
      await saveAppliance(a);
      setAName("");
      setAWatts("");
      setAHours("");
      setAQty("1");
      setAppStatus({ type: "success", message: t("applianceAdded", { name: a.name }) });
    } catch (err) {
      setAppStatus({ type: "error", message: err instanceof Error ? err.message : t("saveFailed") });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAppliance(id);
    } catch {
      setAppStatus({ type: "error", message: t("actionFailed") });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t("setup")}</Text>

        {/* Account first */}
        <Card style={styles.accountCard}>
          <Avatar name={displayName} email={user?.email} size={52} onPress={() => navigation.navigate("Account")} />
          <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate("Account")}>
            <Text style={styles.accountName}>{displayName || user?.email}</Text>
            <Text style={styles.accountEmail}>{user?.email}</Text>
            <Text style={styles.accountLink}>{t("profileAndSettings")}</Text>
          </Pressable>
          <Pressable style={styles.logout} onPress={() => signOut()}>
            <Icon name="logout" size={16} color={colors.danger} />
            <Text style={styles.logoutText}>{t("signOut")}</Text>
          </Pressable>
        </Card>

        {/* Bill */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t("electricityBill")}</Text>
          <Text style={styles.hint}>{t("billEntryHint")}</Text>
          <View style={styles.monthPicker}>
            <Pressable style={styles.monthArrow} onPress={() => setMonthKey(shiftMonth(monthKey, -1))} hitSlop={6}>
              <Icon name="back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.monthText}>{monthName(monthKey)}</Text>
            <Pressable
              style={[styles.monthArrow, monthKey >= currentMonthKey() && { opacity: 0.3 }]}
              disabled={monthKey >= currentMonthKey()}
              onPress={() => setMonthKey(shiftMonth(monthKey, 1))}
              hitSlop={6}
            >
              <Icon name="chev" size={18} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.row}>
            <Field label={t("unitsKwh")} value={units} onChangeText={setUnits} />
            <Field label={t("amountRs")} value={amount} onChangeText={setAmount} />
          </View>
          <StatusMessage type={billStatus?.type ?? "success"} message={billStatus?.message ?? null} />
          <Button label={t("saveBill")} onPress={handleSaveBill} />
        </Card>

        {/* Whole-house appliances */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t("homeAppliances")}</Text>
          <Text style={styles.hint}>{t("homeAppliancesHint")}</Text>

          {appliances.length > 0 && (
            <View style={styles.list}>
              {appliances.map((a) => (
                <View key={a.id} style={styles.appRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appName}>
                      {a.quantity > 1 ? `${a.quantity} × ` : ""}
                      {a.name}
                    </Text>
                    <Text style={styles.appSub}>
                      {a.watts} W · {a.hours_per_day} h/day ·{" "}
                      {((a.watts * a.quantity * a.hours_per_day * 30) / 1000).toFixed(0)} units/month
                    </Text>
                  </View>
                  <Pressable onPress={() => handleDelete(a.id)} hitSlop={8}>
                    <Icon name="trash" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t("estimatedMonthly")}</Text>
                <Text style={styles.totalValue}>{(kwhPerDay * 30).toFixed(0)} units</Text>
              </View>
            </View>
          )}

          <Text style={styles.subTitle}>{t("addAppliance")}</Text>
          <View style={styles.presets}>
            {PRESETS.map((p) => (
              <Pressable key={p.name} style={styles.preset} onPress={() => applyPreset(p)}>
                <Icon name={p.icon} size={14} color={colors.primary} />
                <Text style={styles.presetText}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          <Field label={t("applianceName")} value={aName} onChangeText={setAName} numeric={false} />
          <View style={styles.row}>
            <Field label={t("watts")} value={aWatts} onChangeText={setAWatts} />
            <Field label={t("quantity")} value={aQty} onChangeText={setAQty} />
            <Field label={t("hoursPerDay")} value={aHours} onChangeText={setAHours} />
          </View>
          <StatusMessage type={appStatus?.type ?? "success"} message={appStatus?.message ?? null} />
          <Button label={t("addAppliance")} icon="plus" variant="secondary" onPress={handleAddAppliance} />
        </Card>

        {/* Sensed room + rate */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t("applianceWattageRate")}</Text>
          <Text style={styles.hint}>{t("roomWattsHint")}</Text>
          <View style={styles.row}>
            <Field label={t("fanWatts")} value={fanW} onChangeText={setFanW} />
            <Field label={t("lightWatts")} value={lightW} onChangeText={setLightW} />
          </View>
          <View style={styles.row}>
            <Field label={t("acWatts")} value={acW} onChangeText={setAcW} />
            <Field label={t("rateRsPerUnit")} value={rate} onChangeText={setRate} />
          </View>
          <StatusMessage type={cfgStatus?.type ?? "success"} message={cfgStatus?.message ?? null} />
          <Button label={t("saveSettings")} onPress={handleSaveConfig} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  numeric = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  numeric?: boolean;
}) {
  const { colors } = useThemeMode();
  const styles = makeStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "numeric" : "default"}
        placeholder={numeric ? "0" : ""}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    title: { color: colors.text, fontSize: 34, fontFamily: fonts.headingMedium },
    card: { gap: spacing.sm },
    cardTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.headingMedium },
    subTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemiBold, marginTop: spacing.xs },
    hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
    row: { flexDirection: "row", gap: spacing.sm },
    field: { gap: spacing.xs, flex: 1 },
    fieldLabel: { color: colors.textMuted, fontSize: 12 },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      color: colors.text,
      fontSize: 15,
    },
    accountCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    monthPicker: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      padding: 4,
    },
    monthArrow: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    monthText: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemiBold },
    accountName: { color: colors.text, fontSize: 17, fontFamily: fonts.headingMedium },
    accountEmail: { color: colors.textMuted, fontSize: 12 },
    accountLink: { color: colors.primary, fontSize: 12, fontFamily: fonts.bodySemiBold, marginTop: 2 },
    logout: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1.5,
      borderColor: colors.danger + "66",
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 12,
    },
    logoutText: { color: colors.danger, fontSize: 12, fontFamily: fonts.bodySemiBold },
    list: { borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
    appRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    appName: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemiBold },
    appSub: { color: colors.textMuted, fontSize: 12 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", padding: spacing.md },
    totalLabel: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
    totalValue: { color: colors.primary, fontSize: 15, fontFamily: fonts.headingMedium },
    presets: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    preset: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    presetText: { color: colors.text, fontSize: 12 },
  });
}
