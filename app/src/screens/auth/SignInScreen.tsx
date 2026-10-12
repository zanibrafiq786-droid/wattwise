import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { LogoMark } from "../../components/LogoMark";
import { TextField } from "../../components/TextField";
import { authErrorMessage, useAuth } from "../../lib/authContext";
import { useI18n } from "../../lib/i18n";
import { colors, fonts, spacing } from "../../lib/theme";
import { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setError("");
    if (!email || !password) {
      setError(t("enterEmailPassword"));
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      console.error("Sign in error:", err);
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <LogoMark size={56} />
          <Text style={styles.title}>{t("signIn")}</Text>

          <Card style={styles.card}>
            <TextField label={t("email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
            <TextField label={t("password")} value={password} onChangeText={setPassword} secureTextEntry />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={busy ? t("signingIn") : t("signIn")} onPress={handleSignIn} disabled={busy} />
            <Button label={t("forgotPassword")} variant="secondary" onPress={() => navigation.navigate("ForgotPassword")} />
          </Card>

          <Button label={t("dontHaveAccount")} variant="secondary" onPress={() => navigation.navigate("SignUp")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: "center", alignItems: "center" },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.heading, marginBottom: spacing.sm },
  card: { width: "100%", gap: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
});
