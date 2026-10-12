import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SaveResult, scanBill } from "../lib/billImport";
import { billAmountLabel } from "../lib/firebase";
import { useI18n } from "../lib/i18n";
import { monthName } from "../lib/months";
import { Colors, fonts, spacing, radius } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Card } from "./Card";
import { Icon } from "./Icon";

type Status = "idle" | "loading" | "error" | "done";

// Camera/gallery -> AI reads the bill -> saved straight away (no review
// step). Only rows that look like real bills are saved; anything the scan
// got wrong is skipped and listed in plain words.
export function BillImportCard() {
  const { t } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SaveResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function scan(source: "camera" | "library") {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMsg(t("importPermission"));
        setStatus("error");
        return;
      }
      const picked =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 })
          : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5 });
      const base64 = picked.canceled ? null : picked.assets?.[0]?.base64;
      if (!base64) return;

      setStatus("loading");
      const saved = await scanBill(base64, picked.assets![0].mimeType || "image/jpeg");
      setResult(saved);
      if (saved.saved.length === 0) {
        setErrorMsg(t("importNothingReadable"));
        setStatus("error");
      } else {
        setStatus("done");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
  }

  if (status === "idle") {
    return (
      <Card style={styles.compact}>
        <Icon name="camera" size={18} color={colors.primary} />
        <Text style={styles.compactTitle} numberOfLines={1}>
          {t("importBill")}
        </Text>
        <Pressable style={[styles.chip, styles.chipPrimary]} onPress={() => scan("camera")}>
          <Text style={[styles.chipText, { color: "#FFFFFF" }]}>{t("camera")}</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => scan("library")}>
          <Text style={styles.chipText}>{t("gallery")}</Text>
        </Pressable>
      </Card>
    );
  }

  if (status === "loading") {
    return (
      <Card style={styles.compact}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.compactTitle}>{t("importReading")}</Text>
      </Card>
    );
  }

  const main = result?.saved[0];
  const historyCount = result ? result.saved.length - 1 : 0;

  return (
    <Card style={styles.card}>
      {status === "done" && main && (
        <>
          <View style={styles.doneRow}>
            <Icon name="check" size={18} color={colors.success} />
            <Text style={styles.doneTitle}>{t("importSaved")}</Text>
          </View>
          <Text style={styles.mainLine}>
            {monthName(main.month)}: {Math.round(main.units)} units · {billAmountLabel(main)}
          </Text>
          {historyCount > 0 && (
            <Text style={styles.subtle}>{t("importHistorySaved", { n: String(historyCount) })}</Text>
          )}
        </>
      )}
      {status === "error" && <Text style={styles.errorText}>{errorMsg}</Text>}

      {result && result.skipped.length > 0 && (
        <View style={styles.skipBox}>
          <Text style={styles.skipTitle}>{t("importSkipped", { n: String(result.skipped.length) })}</Text>
          {result.skipped.slice(0, 4).map((s, i) => (
            <Text key={i} style={styles.skipText}>
              • {s.month === "?" ? "?" : monthName(s.month)}: {s.reason}
            </Text>
          ))}
        </View>
      )}

      <Pressable style={styles.chip} onPress={reset}>
        <Text style={styles.chipText}>{status === "done" ? t("importAnother") : t("tryAgain")}</Text>
      </Pressable>
    </Card>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    card: { gap: spacing.sm },
    compact: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm + 2 },
    compactTitle: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fonts.bodySemiBold },
    chip: {
      alignSelf: "flex-start",
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    chipPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
    doneRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    doneTitle: { color: colors.success, fontSize: 15, fontFamily: fonts.bodySemiBold },
    mainLine: { color: colors.text, fontSize: 16, fontFamily: fonts.headingMedium },
    subtle: { color: colors.textMuted, fontSize: 13 },
    errorText: { color: colors.danger, fontSize: 13 },
    skipBox: { backgroundColor: colors.warning + "1f", borderRadius: 14, padding: spacing.sm, gap: 2 },
    skipTitle: { color: colors.warning, fontSize: 12, fontFamily: fonts.bodySemiBold },
    skipText: { color: colors.warning, fontSize: 12 },
  });
}
