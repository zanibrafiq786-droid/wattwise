import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { LogoMark } from "../../components/LogoMark";
import { TextField } from "../../components/TextField";
import { authErrorMessage, useAuth } from "../../lib/authContext";
import { useI18n } from "../../lib/i18n";
import { Colors, fonts, spacing } from "../../lib/theme";
import { useColors } from "../../lib/themeContext";
import { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "SignIn">;

// Facebook-style layout, top to bottom: logo, email, password, log in,
// a small "forgot password" link, a divider, then "Create New Account" --
// this is the FIRST screen the app opens to now (see AuthNavigator.tsx),
// not a separate "choose sign up or sign in" screen.
export function SignInScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <LogoMark size={72} />
            <Text style={styles.appName}>{t("appName")}</Text>
            <Text style={styles.tagline}>{t("appTaglineShort")}</Text>
          </View>

          <View style={styles.form}>
            <TextField label={t("email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
            <TextField label={t("password")} value={password} onChangeText={setPassword} secureTextEntry />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={busy ? t("signingIn") : t("signIn")} onPress={handleSignIn} disabled={busy} />
            <Pressable style={styles.forgotLink} onPress={() => navigation.navigate("ForgotPassword")}>
              <Text style={styles.forgotText}>{t("forgotPassword")}</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Button label={t("createNewAccount")} variant="secondary" onPress={() => navigation.navigate("SignUp")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, flexGrow: 1, justifyContent: "center", alignItems: "center" },
    brand: { alignItems: "center", gap: 2, marginBottom: spacing.lg },
    appName: { color: colors.text, fontSize: 32, fontFamily: fonts.heading, marginTop: spacing.sm },
    tagline: { color: colors.textMuted, fontSize: 14 },
    form: { width: "100%", gap: spacing.md },
    error: { color: colors.danger, fontSize: 13 },
    forgotLink: { alignSelf: "center", padding: spacing.xs },
    forgotText: { color: colors.primary, fontSize: 13 },
    divider: { width: "100%", height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  });
}
