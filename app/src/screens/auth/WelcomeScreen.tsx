import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { useI18n } from "../../lib/i18n";
import { colors, radius, spacing } from "../../lib/theme";
import { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useI18n();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoEmoji}>{"⚡"}</Text>
        </View>
        <Text style={styles.title}>{t("appName")}</Text>
        <Text style={styles.subtitle}>{t("appTagline")}</Text>
        <View style={styles.actions}>
          <Button label={t("signUp")} onPress={() => navigation.navigate("SignUp")} />
          <Button label={t("signIn")} variant="secondary" onPress={() => navigation.navigate("SignIn")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  logoEmoji: { fontSize: 44 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800" },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.lg,
    maxWidth: 320,
    lineHeight: 20,
  },
  actions: { width: "100%", gap: spacing.sm, marginTop: spacing.md },
});
