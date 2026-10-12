import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Icon } from "./Icon";

// Shared success/error feedback line for actions that save or send
// something (Setup, Account, Alerts, the AC toggle) -- so a failed write
// isn't silent (looks like a "broken button") and a successful one gets a
// visible confirmation, not just an assumption that it worked.
export function StatusMessage({ type, message }: { type: "success" | "error"; message: string | null }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  if (!message) return null;
  const color = type === "success" ? colors.success : colors.danger;
  return (
    <View style={styles.row}>
      <Icon name={type === "success" ? "check" : "warn"} size={14} color={color} />
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    text: { fontSize: 13, flex: 1 },
  });
}
