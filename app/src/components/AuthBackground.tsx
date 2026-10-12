import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { useThemeMode } from "../lib/themeContext";

// Soft photo behind the sign in / sign up / forgot password screens: a warm
// lamp-lit living room (Redesign/wattwise-v2-assets/assets/welcome-hero.jpg),
// covered with the theme background colour at high opacity so it stays a
// subtle hint and the form is always easy to read.
export function AuthBackground({ children }: { children: React.ReactNode }) {
  const { mode, colors } = useThemeMode();
  // "C0" = 75% opacity on dark, "D9" = 85% on light (light needs more cover).
  const overlay = colors.bg + (mode === "cream" ? "D9" : "C0");
  return (
    <ImageBackground
      source={require("../../assets/welcome-hero.jpg")}
      style={styles.fill}
      resizeMode="cover"
      blurRadius={2}
    >
      <View style={[styles.fill, { backgroundColor: overlay }]}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
