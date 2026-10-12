import React, { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { useAcOn, useRoomState } from "../lib/firebase";
import { ROOM_HTML } from "../lib/roomHtml";
import { Colors } from "../lib/theme";
import { useColors } from "../lib/themeContext";

// Hosts room.html (built outside this app, not redrawn here) inside a
// WebView and feeds it real data from /room1/state + /room1/state_user/ac_on
// on every update. The page itself switches its own badge from
// "DEMO / SIMULATED" to "LIVE" once it receives a message -- see room.html's
// onMsg handler. room.html has its own fixed dark look, independent of the
// app's Cream/Espresso toggle.
export function RoomScreen() {
  const { state } = useRoomState("room1");
  const { acOn } = useAcOn("room1");
  const webViewRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const colors = useColors();
  const styles = makeStyles(colors);

  useEffect(() => {
    // Wait until the page has actually loaded (and registered its message
    // listener) before posting -- an earlier message would arrive before
    // anything is listening and be silently lost.
    if (!loaded || !state) return;
    const payload = JSON.stringify({
      presence: state.presence,
      rssi_var: state.rssi_var,
      fan_on: state.fan_on,
      light_on: state.light_on,
      ac_on: acOn,
    });
    webViewRef.current?.postMessage(payload);
  }, [loaded, state, acOn]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        javaScriptEnabled
        source={{ html: ROOM_HTML }}
        style={styles.webview}
        onLoadEnd={() => setLoaded(true)}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    webview: { flex: 1, backgroundColor: colors.bg },
  });
}
