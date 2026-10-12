import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { useColors } from "../lib/themeContext";

const WIDTH = 58;
const HEIGHT = 32;
const KNOB = 26;
const PADDING = 3;

// WattWise spec (section 5): 58x32 pill. Off: pale track. On: dark track
// with an orange knob.
export function Toggle({ value, onValueChange, disabled }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.surfaceAlt, colors.text] });
  const knobColor = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] });
  const knobLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [PADDING, WIDTH - KNOB - PADDING] });

  return (
    <Pressable onPress={() => !disabled && onValueChange(!value)} disabled={disabled} style={{ opacity: disabled ? 0.5 : 1 }}>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.knob, { backgroundColor: knobColor, left: knobLeft }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    justifyContent: "center",
  },
  knob: {
    position: "absolute",
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
  },
});
