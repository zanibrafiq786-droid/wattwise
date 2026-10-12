import { BlurView } from "expo-blur";
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, LinearGradient, Stop } from "react-native-svg";
import { useThemeMode } from "../lib/themeContext";
import { WaveMark } from "./WaveMark";

// The chat assistant's button: a frosted-glass circle (glassmorphism) with
// the flowing sine wave inside. Layers, back to front:
//   1. blur of whatever is behind it
//   2. a see-through tint (dark glass on the dark theme, milky glass on light)
//   3. a soft white shine across the top, like light on a glass ball
//   4. a thin bright rim
// so it looks right in both dark and light mode. (Real blur on iPhone; on
// Android the tint, shine and rim give the glass look on their own.)
export function GlassOrb({ size = 60, id = "orb" }: { size?: number; id?: string }) {
  const { mode } = useThemeMode();
  const dark = mode !== "cream";
  return (
    <View
      style={[
        styles.shadow,
        // On light mode a faint dark hairline outside the white rim keeps the
        // glass edge visible against the pale background.
        { width: size, height: size, borderRadius: size / 2, padding: dark ? 0 : 1 },
        !dark && { backgroundColor: "rgba(43,35,30,0.10)" },
      ]}
    >
      <View
        style={[
          styles.clip,
          {
            borderRadius: size / 2,
            borderColor: dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.9)",
          },
        ]}
      >
        <BlurView
          intensity={dark ? 35 : 45}
          tint={dark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.55)" },
          ]}
        />
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={dark ? 0.28 : 0.85} />
              <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Ellipse cx={50} cy={26} rx={36} ry={22} fill={`url(#${id}-shine)`} />
        </Svg>
        <WaveMark size={size * 0.62} id={`${id}-wave`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    backgroundColor: "transparent",
  },
  clip: {
    flex: 1,
    overflow: "hidden",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
