import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { AccountScreen } from "./AccountScreen";
import { MainTabs } from "./MainTabs";

export type RootStackParamList = {
  Tabs: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Wraps the bottom-tab app so screens inside any tab can push the Account
// screen (tapping the avatar) without it being a tab itself -- matches the
// WattWise reference, where Account opens from the top-bar avatar.
export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ presentation: "modal" }} />
    </Stack.Navigator>
  );
}
