import { Platform } from "react-native";

// expo-notifications does not work at all in Expo Go on Android since SDK 53
// (Expo removed the native module from the Expo Go client entirely, even for
// local notifications) -- it needs a real dev build or standalone APK. We
// still want the app to run in Expo Go for day-to-day testing, so the import
// is wrapped in try/catch: if it throws (Expo Go on Android), notifications
// are silently disabled here and will start working again once this is
// built as an actual APK with EAS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
let Notifications: typeof import("expo-notifications") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require("expo-notifications");
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (err) {
  console.warn(
    "Notifications disabled: expo-notifications isn't supported in Expo Go on Android (SDK 53+). " +
      "This will work once the app is built as a real APK."
  );
}

export async function ensureNotificationPermission() {
  if (!Notifications) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("alerts", {
      name: "Room alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function notifyNewAlert(message: string) {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: "Room Energy Alert", body: message },
    trigger: null,
  });
}
