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
    variant === "primary" ? colors.primary : variant === "danger" ? colors.danger : "transparent";
  const textColor = variant === "secondary" ? colors.text : "#FFFFFF";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondaryBorder,
        variant === "primary" && styles.primaryShadow,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBorder: {
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  primaryShadow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  label: {
    fontWeight: "700",
    fontSize: 15,
  },
});
