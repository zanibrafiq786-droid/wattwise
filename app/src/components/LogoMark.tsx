import React from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { useThemeMode } from "../lib/themeContext";

// WattWise logo mark: a rounded square with a "W" drawn as a motion wave.
// Two real variants exist (not just a color swap): espresso bg + orange
// stroke, or cream bg + dark stroke (logo-mark-espresso.svg / -cream.svg).
export function LogoMark({ size = 40 }: { size?: number }) {
  const { mode, colors } = useThemeMode();
  const stroke = mode === "cream" ? colors.text : colors.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect width={40} height={40} rx={14} fill={colors.bg} />
      <Path
        d="M8 14L13 27L20 13L27 27L32 14"
        fill="none"
        stroke={stroke}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
