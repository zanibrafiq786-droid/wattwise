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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <LogoMark size={56} />
          <Text style={styles.title}>{t("createAccount")}</Text>

          <Card style={styles.card}>
            <TextField label={t("fullName")} value={name} onChangeText={setName} autoCapitalize="words" />
            <TextField label={t("email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
            <TextField label={t("password")} value={password} onChangeText={setPassword} secureTextEntry />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={busy ? t("creating") : t("signUp")} onPress={handleSignUp} disabled={busy} />
          </Card>

          <Button label={t("alreadyHaveAccount")} variant="secondary" onPress={() => navigation.navigate("SignIn")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: "center", alignItems: "center" },
    title: { color: colors.text, fontSize: 30, fontFamily: fonts.heading, marginBottom: spacing.sm },
    card: { width: "100%", gap: spacing.md },
    error: { color: colors.danger, fontSize: 13 },
  });
}
