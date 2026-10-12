import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Icon, IconName } from "./Icon";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  icon?: IconName;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
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
      {icon && <Icon name={icon} size={16} color={textColor} />}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    button: {
      flexDirection: "row",
      gap: spacing.xs,
      paddingVertical: spacing.sm + 7,
      paddingHorizontal: spacing.md + 4,
      borderRadius: 999,
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
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
    },
  });
}
