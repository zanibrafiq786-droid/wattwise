import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { LogoMark } from "../../components/LogoMark";
import { useI18n } from "../../lib/i18n";
import { Colors, fonts, spacing } from "../../lib/theme";
import { useColors } from "../../lib/themeContext";
import { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <LogoMark size={96} />
        <Text style={styles.title}>{t("appName")}</Text>
        <Text style={styles.taglineShort}>{t("appTaglineShort")}</Text>
        <Text style={styles.subtitle}>{t("appTagline")}</Text>
        <View style={styles.actions}>
          <Button label={t("signUp")} onPress={() => navigation.navigate("SignUp")} />
          <Button label={t("signIn")} variant="secondary" onPress={() => navigation.navigate("SignIn")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.xs },
    title: {
      color: colors.text,
      fontSize: 40,
      fontFamily: fonts.heading,
      marginTop: spacing.md,
    },
    taglineShort: {
      color: colors.warning,
      fontSize: 16,
      fontFamily: fonts.bodySemiBold,
      marginBottom: spacing.sm,
    },
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
}
