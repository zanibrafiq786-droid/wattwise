import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { Colors, fonts, spacing, radius } from "../lib/theme";
import { useColors } from "../lib/themeContext";

export function TextField({ label, ...props }: { label: string } & TextInputProps) {
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    field: { gap: spacing.xs },
    label: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodySemiBold },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      height: 50,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: 15,
      fontFamily: fonts.body,
    },
  });
}
