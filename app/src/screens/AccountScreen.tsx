import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Segmented } from "../components/Segmented";
import { StatusMessage } from "../components/StatusMessage";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/authContext";
import { useDataSource } from "../lib/dataSourceContext";
import { saveProfilePhoto, useProfilePhoto } from "../lib/firebase";
import { pickProfilePhoto } from "../lib/pickProfilePhoto";
import { useI18n } from "../lib/i18n";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { RootStackParamList } from "./RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Account">;

// Profile (tap the avatar): your details, app language, and the data
// source for the Report -- with a plain explanation of what "simulated"
// is for, since it's easy to misread as fake data replacing yours.
export function AccountScreen({ navigation }: Props) {
  const { user, displayName, signOut, updateName } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const { source, setSource } = useDataSource();
  const colors = useColors();
  const styles = makeStyles(colors);
  const [name, setName] = useState(displayName ?? "");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const photo = useProfilePhoto();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Pick a photo from the gallery, shrink it, save it to this account.
  async function handleChangePhoto() {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const dataUri = await pickProfilePhoto();
      if (dataUri) await saveProfilePhoto(dataUri);
    } catch (err) {
      setPhotoError(err instanceof Error && err.message === "permission" ? t("photoPermission") : t("saveFailed"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto() {
    setPhotoError(null);
    try {
      await saveProfilePhoto(null);
    } catch {
      setPhotoError(t("saveFailed"));
    }
  }

  async function handleSave() {
    try {
      await updateName(name.trim());
      setStatus({ type: "success", message: t("detailsSaved") });
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : t("saveFailed") });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Button label="" icon="back" variant="secondary" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
      </View>
      {/* Lift the form above the keyboard (Android edge-to-edge no longer resizes the window). */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t("profile")}</Text>

        <Card style={styles.profCard}>
          <Pressable onPress={handleChangePhoto} disabled={photoBusy}>
            <Avatar name={displayName} email={user?.email} size={72} />
            <View style={styles.cameraBadge}>
              <Icon name="camera" size={13} color="#FFFFFF" />
            </View>
          </Pressable>
          <View style={styles.grow}>
            <Text style={styles.name}>{displayName || user?.email}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.photoLinks}>
              <Pressable onPress={handleChangePhoto} disabled={photoBusy} hitSlop={6}>
                <Text style={styles.photoLink}>
                  {photoBusy ? t("photoSaving") : photo ? t("photoChange") : t("photoAdd")}
                </Text>
              </Pressable>
              {photo && !photoBusy && (
                <Pressable onPress={handleRemovePhoto} hitSlop={6}>
                  <Text style={[styles.photoLink, { color: colors.textMuted }]}>{t("photoRemove")}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Card>
        <StatusMessage type="error" message={photoError} />

        <Section icon="sliders" title={t("yourDetails")} colors={colors} />
        <Card style={styles.card}>
          <TextField label={t("fullName")} value={name} onChangeText={setName} autoCapitalize="words" />
          <StatusMessage type={status?.type ?? "success"} message={status?.message ?? null} />
          <Button label={t("saveDetails")} onPress={handleSave} />
        </Card>

        <Section icon="chip" title={t("language")} colors={colors} />
        <Card style={styles.card}>
          <Segmented
            options={[
              { key: "en", label: "English" },
              { key: "ur", label: "اردو" },
            ]}
            value={language}
            onChange={setLanguage}
          />
        </Card>

        <Section icon="chart" title={t("dataSource")} colors={colors} />
        <Card style={styles.card}>
          <Segmented
            options={[
              { key: "real", label: t("dataSourceReal") },
              { key: "simulated", label: t("dataSourceSimulated") },
            ]}
            value={source}
            onChange={setSource}
          />
          {source === "simulated" && <Badge label="SIMULATED" color={colors.warning} />}
          <View style={styles.explain}>
            <Text style={styles.explainTitle}>{t("dataSourceWhatTitle")}</Text>
            <Text style={styles.explainText}>• {t("dataSourceWhy1")}</Text>
            <Text style={styles.explainText}>• {t("dataSourceWhy2")}</Text>
            <Text style={styles.explainText}>• {t("dataSourceWhy3")}</Text>
          </View>
        </Card>

        <Button label={t("signOut")} variant="danger" icon="logout" onPress={() => signOut()} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ icon, title, colors }: { icon: "sliders" | "chip" | "chart"; title: string; colors: Colors }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.sectionHead}>
      <Icon name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.xs },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    title: { color: colors.text, fontSize: 34, fontFamily: fonts.headingMedium },
    profCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    grow: { flex: 1, gap: 2 },
    cameraBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    photoLinks: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
    photoLink: { color: colors.primary, fontSize: 13, fontFamily: fonts.bodySemiBold },
    name: { color: colors.text, fontSize: 20, fontFamily: fonts.headingMedium },
    email: { color: colors.textMuted, fontSize: 13 },
    sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    sectionTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.headingMedium },
    card: { gap: spacing.sm },
    explain: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: spacing.md, gap: 4 },
    explainTitle: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold, marginBottom: 2 },
    explainText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  });
}
