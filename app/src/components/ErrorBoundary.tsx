import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing } from "../lib/theme";

// There is no "page" concept in a mobile app, so no custom 404 -- but a crash
// in one screen otherwise takes down the whole app to a blank/frozen screen,
// which is worse. This is the mobile equivalent: a friendly fallback with a
// way back, instead of the app looking broken. It sits OUTSIDE every
// provider (theme, i18n, safe area), so it must only use plain RN
// primitives and the static palette -- no Button/Icon/useColors(), which
// would themselves throw here and turn one crash into a blank screen.
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Unhandled error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.safe}>
          <View style={styles.content}>
            <Text style={styles.icon}>!</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>
              The app hit an unexpected error. Your data is safe -- try again, and if it keeps
              happening, restart the app.
            </Text>
            <Pressable style={styles.button} onPress={() => this.setState({ hasError: false })}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  icon: {
    color: colors.warning,
    fontSize: 28,
    fontWeight: "800",
    width: 52,
    height: 52,
    lineHeight: 52,
    textAlign: "center",
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  title: { color: colors.text, fontSize: 20, fontFamily: fonts.headingMedium },
  body: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});
