import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { saveBill, saveConfig, useBill, useConfig } from "../lib/firebase";
import { colors, spacing } from "../lib/theme";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function SetupScreen() {
  const monthKey = currentMonthKey();
  const { bill } = useBill(monthKey);
  const { config } = useConfig();

  const [units, setUnits] = useState("");
  const [amount, setAmount] = useState("");
  const [fanW, setFanW] = useState(String(config.watts.fan));
  const [lightW, setLightW] = useState(String(config.watts.light));
  const [acW, setAcW] = useState(String(config.watts.ac));
  const [rate, setRate] = useState(String(config.rate_rs_per_unit));
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    if (bill) {
      setUnits(String(bill.units));
      setAmount(String(bill.amount_rs));
    }
  }, [bill]);

  useEffect(() => {
    setFanW(String(config.watts.fan));
    setLightW(String(config.watts.light));
    setAcW(String(config.watts.ac));
    setRate(String(config.rate_rs_per_unit));
  }, [config]);

  async function handleSaveBill() {
    const u = parseFloat(units);
    const a = parseFloat(amount);
    if (!Number.isFinite(u) || !Number.isFinite(a)) {
      setSavedMsg("Enter valid numbers for units and amount.");
      return;
    }
    await saveBill(monthKey, { units: u, amount_rs: a });
    setSavedMsg(`Bill for ${monthKey} saved.`);
  }

  async function handleSaveConfig() {
    const fan = parseFloat(fanW);
    const light = parseFloat(lightW);
    const ac = parseFloat(acW);
    const r = parseFloat(rate);
    if (![fan, light, ac, r].every(Number.isFinite)) {
      setSavedMsg("Enter valid numbers for watts and rate.");
      return;
    }
    await saveConfig({ watts: { fan, light, ac }, rate_rs_per_unit: r });
    setSavedMsg("Appliance settings saved.");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Setup</Text>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Electricity bill ({monthKey})</Text>
          <Field label="Units (kWh)" value={units} onChangeText={setUnits} />
          <Field label="Amount (Rs)" value={amount} onChangeText={setAmount} />
          <Button label="Save bill" onPress={handleSaveBill} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Appliance wattage &amp; rate</Text>
          <Field label="Fan (W)" value={fanW} onChangeText={setFanW} />
          <Field label="Light (W)" value={lightW} onChangeText={setLightW} />
          <Field label="AC (W)" value={acW} onChangeText={setAcW} />
          <Field label="Rate (Rs per unit)" value={rate} onChangeText={setRate} />
          <Button label="Save settings" onPress={handleSaveConfig} />
        </Card>

        {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.xs },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: 13 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  saved: { color: colors.success, textAlign: "center" },
});
