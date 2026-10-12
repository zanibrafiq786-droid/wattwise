import React from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "../lib/theme";

// WattWise logo mark: an espresso rounded square with an orange "W" drawn
// as a motion wave (Version 2/wattwise-v2-assets/assets/logo-mark-espresso.svg).
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect width={40} height={40} rx={14} fill={colors.bg} />
      <Path
        d="M8 14L13 27L20 13L27 27L32 14"
        fill="none"
        stroke={colors.primary}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
