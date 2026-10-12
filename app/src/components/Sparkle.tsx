import React from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

// Gemini-style four-point sparkle (concave sides), in WattWise's own warm
// palette -- orange into gold -- instead of Gemini's blue/purple. Used as the
// chat assistant's mark: the floating button on Home and the chat welcome.
export function Sparkle({ size = 24, id = "sparkle" }: { size?: number; id?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffd48a" />
          <Stop offset="0.5" stopColor="#f28b4b" />
          <Stop offset="1" stopColor="#e0603a" />
        </LinearGradient>
      </Defs>
      <Path
        d="M12 0C12.7 6.3 17.7 11.3 24 12C17.7 12.7 12.7 17.7 12 24C11.3 17.7 6.3 12.7 0 12C6.3 11.3 11.3 6.3 12 0Z"
        fill={`url(#${id})`}
      />
    </Svg>
  );
}
