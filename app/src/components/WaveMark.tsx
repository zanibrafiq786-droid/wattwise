import React, { useEffect, useState } from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

// The chat assistant's mark: ONE sine wave in WattWise's warm orange-to-gold
// colours, flowing continuously while on screen. The wave is pinched to zero
// at both ends so it reads as one soft "pulse". A wider, faint copy of the
// same wave sits underneath as a glow.
function wavePath(size: number, phase: number) {
  const mid = size / 2;
  const amp = size * 0.24;
  const cycles = 1.6;
  const pad = size * 0.12; // keep the round line caps inside the box
  const steps = 36;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 -> 1 across the mark
    const x = pad + t * (size - 2 * pad);
    const envelope = Math.sin(Math.PI * t); // 0 at the ends, 1 in the middle
    const y = mid + amp * envelope * Math.sin(2 * Math.PI * cycles * t - phase);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

export function WaveMark({ size = 28, id = "wave", animated = true }: { size?: number; id?: string; animated?: boolean }) {
  const [phase, setPhase] = useState(0);

  // Advance the wave every frame (~60 fps). The SVG is tiny, so redrawing
  // it this often is cheap.
  useEffect(() => {
    if (!animated) return;
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      setPhase(((Date.now() - start) / 1000) * 3);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animated]);

  const d = wavePath(size, phase);
  const stroke = (size / 28) * 2.6;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={size} y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#ffd48a" />
          <Stop offset="0.5" stopColor="#f28b4b" />
          <Stop offset="1" stopColor="#e0603a" />
        </LinearGradient>
      </Defs>
      <Path d={d} stroke={`url(#${id})`} strokeWidth={stroke * 2.6} strokeOpacity={0.18} strokeLinecap="round" fill="none" />
      <Path d={d} stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
