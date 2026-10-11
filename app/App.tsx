import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { LiveScreen } from "./src/screens/LiveScreen";
import { ReportScreen } from "./src/screens/ReportScreen";
import { RoomScreen } from "./src/screens/RoomScreen";
import { SetupScreen } from "./src/screens/SetupScreen";
import { AcAlertBanner } from "./src/components/AcAlertBanner";
import { colors } from "./src/lib/theme";
import { useAcLeftOnWatcher } from "./src/lib/useAcLeftOnWatcher";

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Live: "⚡",
  Room: "📡",
  Alerts: "🔔",
  Report: "📊",
  Setup: "⚙",
};

export default function App() {
  // Mounted once here (not per-screen) so the empty+AC-on timer keeps
  // running no matter which tab is open.
  useAcLeftOnWatcher("room1");

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AcAlertBanner room="room1" />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: colors.primary,
            background: colors.bg,
            card: colors.surface,
            text: colors.text,
            border: colors.border,
            notification: colors.danger,
          },
          fonts: {
            regular: { fontFamily: "System", fontWeight: "400" },
            medium: { fontFamily: "System", fontWeight: "500" },
            bold: { fontFamily: "System", fontWeight: "700" },
            heavy: { fontFamily: "System", fontWeight: "800" },
          },
        }}
      >
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
            tabBarIcon: () => <Text style={{ fontSize: 18 }}>{ICONS[route.name]}</Text>,
          })}
        >
          <Tab.Screen name="Live" component={LiveScreen} />
          <Tab.Screen name="Room" component={RoomScreen} />
          <Tab.Screen name="Alerts" component={AlertsScreen} />
          <Tab.Screen name="Report" component={ReportScreen} />
          <Tab.Screen name="Setup" component={SetupScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
