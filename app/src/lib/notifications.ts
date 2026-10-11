import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Local notifications only (push notifications are a stretch goal per the
// brief, and need a dev build + push token setup, not just Expo Go).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermission() {
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
  await Notifications.scheduleNotificationAsync({
    content: { title: "Room Energy Alert", body: message },
    trigger: null,
  });
}
