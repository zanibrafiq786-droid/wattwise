import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ExtractedBill, extractBillFromImage, saveExtractedBill, validateExtractedBill } from "../lib/billImport";
import { useI18n } from "../lib/i18n";
import { colors, spacing } from "../lib/theme";
import { Button } from "./Button";
import { Card } from "./Card";

type Status = "idle" | "loading" | "review" | "error" | "done";

export function BillImportCard() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [extracted, setExtracted] = useState<ExtractedBill | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedMonths, setSavedMonths] = useState<string[]>([]);

  async function pickAndExtract(source: "camera" | "library") {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMsg("Permission denied. Allow camera/photos access to import a bill.");
        setStatus("error");
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });

      const base64 = result.canceled ? null : result.assets?.[0]?.base64;
      if (!base64) return;

      setStatus("loading");
      const mimeType = result.assets![0].mimeType || "image/jpeg";
      const bill = await extractBillFromImage(base64, mimeType);
      setExtracted(bill);
      setWarnings(validateExtractedBill(bill));
      setStatus("review");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  async function confirmSave() {
    if (!extracted) return;
    setStatus("loading");
    try {
      const months = await saveExtractedBill(extracted);
      setSavedMonths(months);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setExtracted(null);
    setWarnings([]);
    setErrorMsg("");
    setSavedMonths([]);
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t("importBillTitle")}</Text>

      {status === "idle" && (
        <>
          <Text style={styles.subtle}>
            Take a photo or pick one from your gallery. AI reads the current bill and any
            12-month history table printed on it.
          </Text>
          <View style={styles.row}>
            <Button label={t("camera")} onPress={() => pickAndExtract("camera")} />
            <Button label={t("gallery")} variant="secondary" onPress={() => pickAndExtract("library")} />
          </View>
        </>
      )}

      {status === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.subtle}>Reading the bill...</Text>
        </View>
      )}

      {status === "review" && extracted && (
        <>
          <Text style={styles.subtle}>
            Billing month: {extracted.billing_month ?? "?"} -- {extracted.units ?? "?"} units, Rs{" "}
            {extracted.amount_rs ?? "?"}
          </Text>
          {extracted.history_12m?.length > 0 && (
            <Text style={styles.subtle}>
              Found {extracted.history_12m.length} month(s) of history to import too.
            </Text>
          )}
          {warnings.length > 0 && (
            <View style={styles.warnBox}>
              {warnings.map((w, i) => (
                <Text key={i} style={styles.warnText}>
                  - {w}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.row}>
            <Button label={t("saveToFirebase")} onPress={confirmSave} />
            <Button label={t("cancel")} variant="secondary" onPress={reset} />
          </View>
        </>
      )}

      {status === "done" && (
        <>
          <Text style={styles.successText}>
            Saved {savedMonths.length} month(s): {savedMonths.sort().join(", ")}
          </Text>
          <Button label={t("importAnother")} variant="secondary" onPress={reset} />
        </>
      )}

      {status === "error" && (
        <>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Button label={t("tryAgain")} variant="secondary" onPress={reset} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  subtle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", gap: spacing.sm },
  center: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  warnBox: { gap: 2 },
  warnText: { color: colors.warning, fontSize: 12 },
  successText: { color: colors.success, fontSize: 14, fontWeight: "600" },
  errorText: { color: colors.danger, fontSize: 13 },
});
