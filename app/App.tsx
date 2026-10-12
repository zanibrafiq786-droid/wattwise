import { NavigationContainer } from "@react-navigation/native";
import * as Font from "expo-font";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthNavigator } from "./src/screens/auth/AuthNavigator";
import { MainTabs } from "./src/screens/MainTabs";
import { AuthProvider, useAuth } from "./src/lib/authContext";
import { I18nProvider } from "./src/lib/i18n";
import { colors, fonts } from "./src/lib/theme";

// Figtree is the body workhorse everywhere (WattWise spec section 3) --
// patching Text/TextInput defaultProps applies it app-wide without having
// to touch every existing StyleSheet. Screens opt into Urbanist for large
// thin headers explicitly via theme.fonts.heading.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Text as any).defaultProps = (Text as any).defaultProps || {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Text as any).defaultProps.style = [{ fontFamily: fonts.body }, (Text as any).defaultProps.style];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(TextInput as any).defaultProps.style = [{ fontFamily: fonts.body }, (TextInput as any).defaultProps.style];

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
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      Urbanist_300Light: require("./assets/fonts/urbanist-300.ttf"),
      Urbanist_400Regular: require("./assets/fonts/urbanist-400.ttf"),
      Urbanist_600SemiBold: require("./assets/fonts/urbanist-600.ttf"),
      Urbanist_700Bold: require("./assets/fonts/urbanist-700.ttf"),
      Figtree_400Regular: require("./assets/fonts/figtree-400.ttf"),
      Figtree_500Medium: require("./assets/fonts/figtree-500.ttf"),
      Figtree_600SemiBold: require("./assets/fonts/figtree-600.ttf"),
      Figtree_700Bold: require("./assets/fonts/figtree-700.ttf"),
    }).then(() => setFontsLoaded(true));
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
                regular: { fontFamily: fonts.body, fontWeight: "400" },
                medium: { fontFamily: fonts.bodyMedium, fontWeight: "500" },
                bold: { fontFamily: fonts.bodySemiBold, fontWeight: "600" },
                heavy: { fontFamily: fonts.headingMedium, fontWeight: "700" },
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
