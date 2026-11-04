import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// expo-notifications is native-only; do not invoke its native handler on web.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}
export async function ensureNotificationPermission() {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (granted && Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("ecosort-alerts", { name: "Cảnh báo EcoSort", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 150, 250], lightColor: "#13865A" });
  }
  return granted;
}
export async function sendLocalNotification(title: string, body: string) {
  try {
    const allowed = await ensureNotificationPermission(); if (!allowed) return;
    await Notifications.scheduleNotificationAsync({ content: { title, body, sound: true }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: "ecosort-alerts" } });
  } catch (error) { console.warn("Không gửi được thông báo cục bộ:", error); }
}
