import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { Colors, fonts, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

// A heading with a small round "i" button next to it. Tapping the button
// pops up a card with the explanation over a dimmed screen; tapping
// anywhere (on the card or outside it) closes it again. Keeps screens short:
// only people who want the details see them.
export function InfoTip({
  label,
  info,
  labelStyle,
}: {
  label: string;
  info: string | string[];
  labelStyle?: object;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const lines = (Array.isArray(info) ? info : [info]).filter(Boolean);

  return (
    <View style={styles.row}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} style={styles.button} accessibilityLabel="More info">
        <Text style={styles.i}>i</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>i</Text>
              </View>
              <Text style={styles.cardTitle}>{label}</Text>
            </View>
            {lines.map((l, i) => (
              <Text key={i} style={styles.text}>
                {l}
              </Text>
            ))}
            <Text style={styles.hint}>{t("tapToClose")}</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    label: { color: colors.text, fontSize: 14, flexShrink: 1 },
    button: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.2,
      borderColor: colors.textMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    i: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodySemiBold, lineHeight: 14 },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
    cardIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    cardIconText: { color: colors.primary, fontSize: 15, fontFamily: fonts.bodySemiBold },
    cardTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.headingMedium, flex: 1 },
    text: { color: colors.text, fontSize: 14, lineHeight: 21 },
    hint: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.sm },
  });
}
