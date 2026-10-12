import React from "react";
import { View, ViewProps } from "react-native";
import { radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

export function Card({ style, ...props }: ViewProps) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },
        style,
      ]}
      {...props}
    />
  );
}
