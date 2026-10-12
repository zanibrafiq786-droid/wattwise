import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { LogoMark } from "../../components/LogoMark";
import { TextField } from "../../components/TextField";
import { authErrorMessage, useAuth } from "../../lib/authContext";
import { useI18n } from "../../lib/i18n";
import { Colors, fonts, spacing } from "../../lib/theme";
import { useColors } from "../../lib/themeContext";
import { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { resetPassword } = useAuth();
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleReset() {
    setError("");
    if (!email) {
      setError(t("enterEmail"));
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      console.error("Reset password error:", err);
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <LogoMark size={56} />
        <Text style={styles.title}>{t("resetPassword")}</Text>

        <Card style={styles.card}>
          {sent ? (
            <>
              <Text style={styles.subtle}>{t("resetSent", { email })}</Text>
              <Button label={t("backToSignIn")} onPress={() => navigation.navigate("SignIn")} />
            </>
          ) : (
            <>
              <Text style={styles.subtle}>{t("resetDescription")}</Text>
              <TextField label={t("email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label={busy ? t("sending") : t("sendResetLink")} onPress={handleReset} disabled={busy} />
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: "center", alignItems: "center" },
    title: { color: colors.text, fontSize: 30, fontFamily: fonts.heading, marginBottom: spacing.sm },
    card: { width: "100%", gap: spacing.md },
    subtle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    error: { color: colors.danger, fontSize: 13 },
  });
}
