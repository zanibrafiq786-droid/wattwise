import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { fonts, PALETTES } from "../lib/theme";

// Opening animation, shown once per app start (about 2.2 s).
// It CONTINUES the phone's own splash screen instead of repeating it: the
// logo starts already on screen, at exactly the same size and place as the
// native splash (same image, 140 wide, centred -- see app.json), so the user
// sees one smooth animation, not the logo appearing twice. Then a soft ring
// pulses out, the logo "breathes", the name fades in, and the layer fades
// away to the app (which has been loading underneath).
const SPLASH_WIDTH = 140; // must match "imageWidth" in app.json
const DISC = 92; // the orange disc is ~65% of the splash image

// Always the dark palette, whatever theme the user picked: the native splash
// is dark (#15110e in app.json), so this keeps the hand-over seamless.
const colors = PALETTES.espresso;

export function SplashIntro({ onDone }: { onDone: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const layerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(nameOpacity, { toValue: 1, duration: 600, delay: 250, useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.timing(layerOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && onDone());
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.55, 0] });
  const logoScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const nameShift = nameOpacity.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.bg, opacity: layerOpacity }]}
    >
      <Animated.View
        style={[styles.ring, { borderColor: colors.primary, opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
      />
      <Animated.View style={{ transform: [{ scale: logoScale }] }}>
        <Image source={require("../../assets/splash-icon.png")} style={styles.logo} />
      </Animated.View>
      {/* Absolutely placed below the centre so it never moves the logo. */}
      <View style={styles.nameWrap}>
        <Animated.Text
          style={[styles.name, { color: colors.text, opacity: nameOpacity, transform: [{ translateY: nameShift }] }]}
        >
          WattWise
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", zIndex: 999, elevation: 999 },
  logo: { width: SPLASH_WIDTH, height: SPLASH_WIDTH },
  ring: {
    position: "absolute",
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 3,
  },
  nameWrap: { position: "absolute", top: "50%", marginTop: SPLASH_WIDTH / 2 - 4, left: 0, right: 0, alignItems: "center" },
  name: { fontSize: 30, fontFamily: fonts.heading, letterSpacing: 1 },
});
