// WattWise v2 design tokens -- both themes from DESIGN-v2.md section 2.
const espresso = {
  bg: "#15110e",
  surface: "#221c18",
  surfaceAlt: "#2b241f",
  border: "#342c26",
  text: "#f3ece5",
  textMuted: "#a89b8e",
  primary: "#f28b4b",
  primarySoft: "#7a4426",
  success: "#7fc4bd",
  warning: "#f6a467",
  danger: "#ff6b4f",
  active: "#f6a467",
  quiet: "#7fc4bd",
  empty: "#6b625a",
};

const cream = {
  bg: "#ece6df",
  surface: "#fbf9f6",
  surfaceAlt: "#f1ebe3", // surface mixed ~5% with text
  border: "#ddd5ca", // surface/text mix ~8%
  text: "#2b231e",
  textMuted: "#8a8074", // text at ~62% over cream bg
  primary: "#ec7632",
  primarySoft: "#f8c8a2",
  success: "#3d847e",
  warning: "#ec7632",
  danger: "#c3402a",
  active: "#ec7632",
  quiet: "#3d847e",
  empty: "#aba194",
};

export const PALETTES = { espresso, cream };
export type ThemeMode = keyof typeof PALETTES;
export type Colors = typeof espresso;

// Static default export -- kept for any call site that hasn't been
// converted to useColors() yet. Points at Espresso so nothing regresses,
// but won't react to theme changes; prefer useColors() in components.
export const colors: Colors = espresso;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 48,
};

// WattWise uses a consistent 28px radius on containers, with pill/circle
// controls -- radius.lg matches that; sm/md step down for smaller elements
// where a full 28px would look odd (badges, small chips).
export const radius = {
  sm: 12,
  md: 18,
  lg: 28,
};

export const fonts = {
  // Large, thin headers are the signature WattWise look (300 weight at
  // 30-52px); Figtree is the workhorse body font everywhere else.
  heading: "Urbanist_300Light",
  headingMedium: "Urbanist_600SemiBold",
  body: "Figtree_400Regular",
  bodyMedium: "Figtree_500Medium",
  bodySemiBold: "Figtree_600SemiBold",
};
