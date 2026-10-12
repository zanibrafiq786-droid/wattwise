// WattWise v2 design tokens (Espresso/dark theme only for now -- the Cream
// light theme + Setup toggle is a fast-follow, time-boxed out of the
// hackathon submission). Values from Version 2/DESIGN-v2.md section 2.
export const colors = {
  bg: "#15110e",
  surface: "#221c18",
  surfaceAlt: "#2b241f", // surface-2: text mixed ~5% into surface
  border: "#342c26", // line: text at ~8%
  text: "#f3ece5",
  textMuted: "#a89b8e", // text-2: text at ~62%
  primary: "#f28b4b", // accent (orange)
  primarySoft: "#7a4426", // accent-2
  success: "#7fc4bd", // "still" teal, reused as a positive/ok color
  warning: "#f6a467", // amber: active dot, lamp glow
  danger: "#ff6b4f", // "waste" brick red
  active: "#f6a467",
  quiet: "#7fc4bd",
  empty: "#6b625a",
};

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
