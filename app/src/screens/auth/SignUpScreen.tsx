import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { AuthBackground } from "../../components/AuthBackground";
import { LogoMark } from "../../components/LogoMark";
import { TextField } from "../../components/TextField";
import { authErrorMessage, useAuth } from "../../lib/authContext";
import { saveBill } from "../../lib/firebase";
import { lastCompletedMonth } from "../../lib/months";
import { useI18n } from "../../lib/i18n";
import { Colors, fonts, spacing } from "../../lib/theme";
import { useColors } from "../../lib/themeContext";
import { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;


export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [billUnits, setBillUnits] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSignUp() {
    setError("");
    if (!email || !password) {
      setError(t("enterEmailPassword"));
      return;
    }
    setBusy(true);
    try {
      await signUp(email.trim(), password, name.trim());
      // Optional -- asked for here so Report/Solar have at least one real
      // bill from day one, but a blank bill must never block account
      // creation (the person can always add it later in Setup).
      const units = parseFloat(billUnits);
      const amount = parseFloat(billAmount);
      if (Number.isFinite(units) && Number.isFinite(amount) && units > 0 && amount > 0) {
        try {
          // The latest bill is for the month that just ended, not the
          // running month (which has no bill yet).
          await saveBill(lastCompletedMonth(), { units, amount_rs: amount });
        } catch (billErr) {
          console.error("Saving the sign-up bill failed (non-blocking):", billErr);
        }
      }
      // Navigation switches to the main app automatically once
      // onAuthStateChanged fires (see App.tsx).
    } catch (err) {
      console.error("Sign up error:", err);
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthBackground>
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <LogoMark size={56} />
          <Text style={styles.title}>{t("createAccount")}</Text>

          <Card style={styles.card}>
            <TextField label={t("fullName")} value={name} onChangeText={setName} autoCapitalize="words" />
            <TextField label={t("email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
            <TextField label={t("password")} value={password} onChangeText={setPassword} secureTextEntry />

            <Text style={styles.sectionLabel}>{t("latestBillOptional")}</Text>
            <TextField label={t("unitsKwh")} value={billUnits} onChangeText={setBillUnits} keyboardType="numeric" />
            <TextField label={t("amountRs")} value={billAmount} onChangeText={setBillAmount} keyboardType="numeric" />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={busy ? t("creating") : t("signUp")} onPress={handleSignUp} disabled={busy} />
          </Card>

          <Button label={t("alreadyHaveAccount")} variant="secondary" onPress={() => navigation.navigate("SignIn")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </AuthBackground>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: "transparent" },
    content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: "center", alignItems: "center" },
    title: { color: colors.text, fontSize: 30, fontFamily: fonts.headingMedium, marginBottom: spacing.sm },
    card: { width: "100%", gap: spacing.md },
    sectionLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodySemiBold, marginTop: spacing.xs },
    error: { color: colors.danger, fontSize: 13 },
  });
}
