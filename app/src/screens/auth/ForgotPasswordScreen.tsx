import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { TextField } from "../../components/TextField";
import { authErrorMessage, useAuth } from "../../lib/authContext";
import { useI18n } from "../../lib/i18n";
import { colors, radius, spacing } from "../../lib/theme";
import { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { resetPassword } = useAuth();
  const { t } = useI18n();
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
        <View style={styles.logoBadge}>
          <Text style={styles.logoEmoji}>{"⚡"}</Text>
        </View>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: "center", alignItems: "center" },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  logoEmoji: { fontSize: 30 },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: spacing.sm },
  card: { width: "100%", gap: spacing.md },
  subtle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13 },
});
