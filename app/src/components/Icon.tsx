import React from "react";
import Svg, { Path } from "react-native-svg";
import iconsData from "../assets/icons.json";
import { useColors } from "../lib/themeContext";

// WattWise icon set: 37 outline icons (24x24 grid, lucide-style), from
// Version 2/wattwise-v2-assets/assets/icons/icons.json. Each entry is a
// single SVG path string -- rendered here as stroke-only outlines so they
// follow the theme color, exactly as the WattWise spec describes.
const ICONS = iconsData as Record<string, string>;

export type IconName = keyof typeof iconsData;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const colors = useColors();
  const d = ICONS[name];
  if (!d) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color ?? colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
