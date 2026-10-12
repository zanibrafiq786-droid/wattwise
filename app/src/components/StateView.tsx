import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Colors, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

// Wraps a screen's content: shows a spinner while loading, a message if
// there's an error, a message if there's nothing to show yet, or the
// real content once data has arrived.
export function StateView({
  loading,
  error,
  empty,
  emptyMessage = "Nothing here yet.",
  children,
}: {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn't load data</Text>
        <Text style={styles.muted}>{error}</Text>
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{emptyMessage}</Text>
      </View>
    );
  }
  return <>{children}</>;
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
      gap: spacing.sm,
    },
    muted: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: "center",
    },
    errorTitle: {
      color: colors.danger,
      fontSize: 16,
      fontWeight: "600",
    },
  });
}
