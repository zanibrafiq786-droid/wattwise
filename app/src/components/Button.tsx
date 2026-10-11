import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "../lib/theme";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const bg =
    variant === "primary" ? colors.primary : variant === "danger" ? colors.danger : colors.surfaceAlt;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
});
