import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/authContext";
import { useI18n } from "../lib/i18n";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { RootStackParamList } from "./RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Account">;

export function AccountScreen({ navigation }: Props) {
  const { user, displayName, signOut, updateName } = useAuth();
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const [name, setName] = useState(displayName ?? "");
  const [savedMsg, setSavedMsg] = useState("");

  async function handleSave() {
    await updateName(name.trim());
    setSavedMsg(t("detailsSaved"));
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Button label="" icon="back" variant="secondary" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("account")}</Text>

        <Card style={styles.profCard}>
          <Avatar name={displayName} email={user?.email} size={88} onPress={() => {}} />
          <View style={styles.grow}>
            <Text style={styles.name}>{displayName || user?.email}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </Card>

        <View style={styles.sectionHead}>
          <Icon name="sliders" size={16} color={colors.textMuted} />
          <Text style={styles.sectionTitle}>{t("yourDetails")}</Text>
        </View>
        <Card style={styles.card}>
          <TextField label={t("fullName")} value={name} onChangeText={setName} autoCapitalize="words" />
          {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}
          <Button label={t("saveDetails")} onPress={handleSave} />
        </Card>

        <Button label={t("signOut")} variant="danger" icon="logout" onPress={() => signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.xs },
    content: { padding: spacing.md, gap: spacing.md },
    title: { color: colors.text, fontSize: 34, fontFamily: fonts.heading },
    profCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    grow: { flex: 1, gap: 2 },
    name: { color: colors.text, fontSize: 20, fontFamily: fonts.headingMedium },
    email: { color: colors.textMuted, fontSize: 13 },
    sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    sectionTitle: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bodySemiBold },
    card: { gap: spacing.sm },
    saved: { color: colors.success, fontSize: 13 },
  });
}
