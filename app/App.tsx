import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthNavigator } from "./src/screens/auth/AuthNavigator";
import { MainTabs } from "./src/screens/MainTabs";
import { AuthProvider, useAuth } from "./src/lib/authContext";
import { I18nProvider } from "./src/lib/i18n";
import { colors } from "./src/lib/theme";

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Signed-out users see only the auth screens -- the main app (and the
  // legacy /room1 flow it still supports) only renders once signed in.
  return user ? <MainTabs /> : <AuthNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <I18nProvider>
      <AuthProvider>
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
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
