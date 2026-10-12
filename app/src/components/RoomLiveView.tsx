import React, { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { ROOM_HTML } from "../lib/roomHtml";
import { SmartPresence } from "../lib/smartPresence";
import { useThemeMode } from "../lib/themeContext";
import { RoomState } from "../lib/types";
import { Card } from "./Card";

// The page speaks the firmware's vocabulary; the app decides via
// useSmartPresence so the animation always matches the Home pill.
const PAGE_MODE: Record<SmartPresence, "empty" | "quiet" | "active"> = {
  empty: "empty",
  sitting: "quiet",
  walking: "active",
};

// The animated Wi-Fi room view (room-live.html: router, ESP32, waves that
// bend around a person, live RSSI chart) -- what used to be the separate
// Room tab, now a card on Home. Fed real /room1/state on every update; the
// page reports its own height so the card fits it without inner scrolling.
export function RoomLiveView({
  state,
  presence,
  acOn,
  threshold,
}: {
  state: RoomState;
  presence: SmartPresence;
  acOn: boolean;
  threshold: number;
}) {
  const { mode } = useThemeMode();
  const webViewRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState(480);

  useEffect(() => {
    if (!loaded) return;
    webViewRef.current?.postMessage(JSON.stringify({ theme: mode, threshold }));
  }, [loaded, mode, threshold]);

  useEffect(() => {
    // Only after load -- a message posted before the page's listener exists
    // is silently lost.
    if (!loaded) return;
    webViewRef.current?.postMessage(
      JSON.stringify({
        presence: PAGE_MODE[presence],
        rssi_var: state.rssi_var,
        fan_on: state.fan_on,
        light_on: state.light_on,
        ac_on: acOn,
      })
    );
  }, [loaded, state, presence, acOn]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === "height" && d.h > 0) setHeight(d.h);
    } catch {
      // not a message for us
    }
  }

  return (
    <Card style={styles.card}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        javaScriptEnabled
        source={{ html: ROOM_HTML }}
        style={[styles.webview, { height }]}
        scrollEnabled={false}
        onLoadEnd={() => setLoaded(true)}
        onMessage={onMessage}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  webview: { backgroundColor: "transparent" },
});
