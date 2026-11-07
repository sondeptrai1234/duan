import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// Configure notifications for foreground heads-up banner with sound & vibration
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }

    if (Platform.OS === "android") {
      // Channel với độ ưu tiên MAX để bung biểu ngữ thông báo (Heads-up) kèm âm thanh rung
      await Notifications.setNotificationChannelAsync("nhom4-alerts", {
        name: "Cảnh báo & Nhận diện EcoBin",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 200, 250],
        lightColor: "#13865A",
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    return granted;
  } catch (err) {
    console.warn("Lỗi cấu hình quyền thông báo:", err);
    return false;
  }
}

export async function sendLocalNotification(title: string, body: string) {
  if (Platform.OS === "web") return;
  try {
    const allowed = await ensureNotificationPermission();
    if (!allowed) {
      console.log("Chưa được cấp quyền POST_NOTIFICATIONS.");
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 200, 250],
        data: { channelId: "nhom4-alerts" },
      },
      trigger: null, // Hiển thị thông báo ngay lập tức
    });
  } catch (error) {
    console.warn("Không gửi được thông báo:", error);
  }
}
