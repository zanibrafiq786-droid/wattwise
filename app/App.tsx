import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { LiveScreen } from "./src/screens/LiveScreen";
import { ReportScreen } from "./src/screens/ReportScreen";
import { SetupScreen } from "./src/screens/SetupScreen";
import { colors } from "./src/lib/theme";

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Live: "⚡",
  Alerts: "🔔",
  Report: "📊",
  Setup: "⚙",
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
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
          <Tab.Screen name="Alerts" component={AlertsScreen} />
          <Tab.Screen name="Report" component={ReportScreen} />
          <Tab.Screen name="Setup" component={SetupScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
