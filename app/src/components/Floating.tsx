import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

// Gently bobs its child up and down in place (a few pixels, ~3 s per cycle),
// so the chat button looks alive without moving away from its spot.
export function Floating({
  children,
  distance = 4,
  style,
}: {
  children: React.ReactNode;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [distance, -distance] });
  return <Animated.View style={[style, { transform: [{ translateY }] }]}>{children}</Animated.View>;
}
