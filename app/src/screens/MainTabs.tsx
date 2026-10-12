import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { AcAlertBanner } from "../components/AcAlertBanner";
import { Icon, IconName } from "../components/Icon";
import { useDevice } from "../lib/firebase";
import { useI18n } from "../lib/i18n";
import { useColors } from "../lib/themeContext";
import { useAcLeftOnWatcher } from "../lib/useAcLeftOnWatcher";
import { LiveScreen } from "./LiveScreen";
import { ReportScreen } from "./ReportScreen";
import { SetupScreen } from "./SetupScreen";
import { SolarScreen } from "./SolarScreen";

const Tab = createBottomTabNavigator();

// Alerts and Chat are no longer bottom tabs by request -- Alerts opens from
// the bell icon in the Live header, Chat opens from a floating round button
// on Live. Both are still pushed from the root stack (see RootNavigator).
// The old Room tab (room "footage") now lives on Home as the hero card.
const TAB_ICONS: Record<string, IconName> = {
  Live: "home",
  Report: "chart",
  Solar: "sun",
  Setup: "sliders",
};

export function MainTabs() {
  // Mounted once here (not per-screen) so the empty+AC-on timer keeps
  // running no matter which tab is open.
  const { device } = useDevice();
  useAcLeftOnWatcher(device);
  const { t } = useI18n();
  const colors = useColors();

  return (
    <>
      {device && <AcAlertBanner room={device} />}
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarIcon: ({ color }) => <Icon name={TAB_ICONS[route.name]} size={22} color={color} />,
        })}
      >
        <Tab.Screen name="Live" component={LiveScreen} options={{ tabBarLabel: t("tabLive") }} />
        <Tab.Screen name="Report" component={ReportScreen} options={{ tabBarLabel: t("tabReport") }} />
        <Tab.Screen name="Solar" component={SolarScreen} options={{ tabBarLabel: t("tabSolar") }} />
        <Tab.Screen name="Setup" component={SetupScreen} options={{ tabBarLabel: t("tabSetup") }} />
      </Tab.Navigator>
    </>
  );
}
