import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { AccountScreen } from "./AccountScreen";
import { AlertsScreen } from "./AlertsScreen";
import { ChatScreen } from "./ChatScreen";
import { MainTabs } from "./MainTabs";

export type RootStackParamList = {
  Tabs: undefined;
  Account: undefined;
  Alerts: undefined;
  Chat: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Wraps the bottom-tab app so screens inside any tab can push Account,
// Alerts or Chat without them being tabs themselves: Account opens from the
// top-bar avatar, Alerts from the bell icon, Chat from the floating round
// button on Live -- matches the WattWise reference pattern.
export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Alerts" component={AlertsScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ presentation: "modal" }} />
    </Stack.Navigator>
  );
}
