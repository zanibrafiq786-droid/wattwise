import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

const SIZE = 220;
const STROKE = 16;
const R = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
// WattWise's dial sweeps 250 degrees, starting 125 degrees from the top
// going clockwise -- matches DESIGN-v2.md section 5.
const START_ANGLE = -215;
const SWEEP = 250;
const SCALE_MAX = 240;
const SLAB_LIMIT = 200;

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number, radius: number) {
  const start = polar(startDeg, radius);
  const end = polar(endDeg, radius);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function angleForValue(value: number) {
  return START_ANGLE + (Math.min(value, SCALE_MAX) / SCALE_MAX) * SWEEP;
}

// WattWise's "signature element" (DESIGN-v2.md section 5): a 250-degree
// arc dial, 0-240 units, a marker at the 200-unit slab, and the projected
// bill in the centre. Built from the same waste/forecast numbers already
// computed elsewhere in the app -- no new data source, just a new view of it.
export function MonthDial({
  unitsUsed,
  projectedUnits,
  projectedRs,
}: {
  unitsUsed: number;
  projectedUnits: number;
  projectedRs: number;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const fillAngle = angleForValue(unitsUsed);
  const slabAngle = angleForValue(SLAB_LIMIT);
  const endAngle = START_ANGLE + SWEEP;
  const overSlab = projectedUnits > SLAB_LIMIT;

  const ticks = Array.from({ length: 37 }, (_, i) => i);

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        {/* Background track */}
        <Path d={arcPath(START_ANGLE, endAngle, R)} stroke={colors.surfaceAlt} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        {/* Ticks */}
        {ticks.map((i) => {
          const angle = START_ANGLE + (i / (ticks.length - 1)) * SWEEP;
          const inner = polar(angle, R - STROKE / 2 - 4);
          const outer = polar(angle, R - STROKE / 2 - 10);
          return (
            <Line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={colors.border} strokeWidth={1.5} />
          );
        })}
        {/* Used-so-far fill */}
        <Path
          d={arcPath(START_ANGLE, fillAngle, R)}
          stroke={overSlab ? colors.danger : colors.primary}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
        />
        {/* 200-unit slab marker */}
        {(() => {
          const a = polar(slabAngle, R - STROKE / 2 - 2);
          const b = polar(slabAngle, R + STROKE / 2 + 2);
          return <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colors.warning} strokeWidth={2.5} />;
        })()}
        {/* Knob at current value */}
        <Circle cx={polar(fillAngle, R).x} cy={polar(fillAngle, R).y} r={9} fill={colors.text} stroke={colors.bg} strokeWidth={2} />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.value, overSlab && { color: colors.danger }]}>Rs {Math.round(projectedRs)}</Text>
        <Text style={styles.sub}>
          {unitsUsed.toFixed(0)} units now, {projectedUnits.toFixed(0)} projected
        </Text>
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
    center: { position: "absolute", alignItems: "center", gap: 4, paddingHorizontal: spacing.lg },
    value: { color: colors.text, fontSize: 28, fontFamily: fonts.heading },
    sub: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  });
}
