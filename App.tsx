import React, { useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TamaguiProvider } from "tamagui";
import { StatusBar } from "expo-status-bar";
import { AppProvider, useApp } from "./src/context/AppContext";
import { api } from "./src/services/api";
import { sendLocalNotification } from "./src/services/localNotifications";
import type { AppNotification, TrashCan } from "./src/types";
import { colors } from "./src/theme";
import { tamaguiConfig } from "./tamagui.config";
import { LoginScreen, RegisterScreen } from "./src/screens/AuthScreens";
import { DashboardScreen, SmartBinScreen, RecyclingMapScreen, WasteGuideScreen, NotificationsScreen, AccountScreen, BinDetailScreen } from "./src/screens/MainScreens";
import ScanScreen from "./src/screens/ScanScreen";
import { ScanResultScreen, BinDetectionScreen } from "./src/screens/ResultScreens";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
// Deep links: ecosort://scan, ecosort://guide, ecosort://notifications, ecosort://bin-event.
const linking: any = {
  prefixes: ["ecosort://", "https://ecosort.local"],
  config: {
    screens: {
      Login: "login",
      Register: "register",
      MainTabs: {
        path: "app",
        screens: { "Trang chủ": "home", "Quét rác": "scan", "Thùng rác": "bins", "Bản đồ": "map" },
      },
      ScanResult: "scan-result",
      WasteGuide: "guide",
      Notifications: "notifications",
      Account: "account",
      BinDetection: "bin-event",
      BinDetail: "bin-detail",
    },
  },
};
function MainTabs() {
  return <Tab.Navigator screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.sub,
    tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginBottom: 3 },
    tabBarStyle: { height: 64, paddingTop: 7, borderTopColor: colors.line, backgroundColor: "#FFFFFF", elevation: 8 },
    tabBarIcon: ({ color, size }) => {
      const icons: Record<string, keyof typeof Ionicons.glyphMap> = { "Trang chủ": "home-outline", "Quét rác": "scan-outline", "Thùng rác": "trash-outline", "Bản đồ": "map-outline" };
      return <Ionicons name={icons[route.name] || "ellipse-outline"} size={size} color={color}/>;
    },
  })}>
    <Tab.Screen name="Trang chủ" component={DashboardScreen}/>
    <Tab.Screen name="Quét rác" component={ScanScreen}/>
    <Tab.Screen name="Thùng rác" component={SmartBinScreen}/>
    <Tab.Screen name="Bản đồ" component={RecyclingMapScreen}/>
  </Tab.Navigator>;
}
function RootNavigator() {
  const { user, addNotification } = useApp();
  const seenEvents = useRef<Set<string>>(new Set());
  const activeAlerts = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { seenEvents.current.clear(); activeAlerts.current.clear(); return; }
    let mounted = true;
    let initialized = false;
    const poll = async () => {
      try {
        const [events, cans] = await Promise.all([
          api.get<any[]>("/api/bin-events"),
          api.get<TrashCan[]>("/api/trashcans"),
        ]);
        if (!mounted) return;
        for (const event of Array.isArray(events) ? events : []) {
          const id = String(event.EventID);
          if (!id || seenEvents.current.has(id)) continue;
          seenEvents.current.add(id);
          if (initialized) {
            const notification: AppNotification = {
              id: `event-${id}`, title: event.DetectedLabel ? `Phát hiện: ${event.DetectedLabel}` : "Thùng rác phát hiện vật thể",
              message: `${event.Category || "Chưa phân loại"} · ${event.MacAddress || "EcoBin"}`,
              type: "bin-event", createdAt: event.CreatedAt || new Date().toISOString(), imageUrl: event.ImageUrl || null,
              detectedLabel: event.DetectedLabel, category: event.Category, confidence: event.Confidence,
            };
            addNotification(notification);
            await sendLocalNotification("EcoSort · Phát hiện rác mới", `${notification.title}. Đã có ảnh từ camera thùng rác.`);
          }
        }
        for (const can of Array.isArray(cans) ? cans : []) {
          const checks = [
            { key: `fill-${can.TrashCanID}`, active: Number(can.FillLevel || 0) >= 80, title: "Thùng rác sắp đầy", body: `${can.Name} đã đạt ${Math.round(Number(can.FillLevel) || 0)}% dung lượng.` },
            { key: `temp-${can.TrashCanID}`, active: Number(can.Temperature || 0) >= 50, title: "Nhiệt độ thùng rác cao", body: `${can.Name}: ${can.Temperature}°C. Cần kiểm tra thiết bị.` },
          ];
          for (const check of checks) {
            if (!check.active) { activeAlerts.current.delete(check.key); continue; }
            if (!activeAlerts.current.has(check.key)) {
              activeAlerts.current.add(check.key);
              if (initialized) {
                addNotification({ id: check.key, title: check.title, message: check.body, type: check.key.startsWith("fill-") ? "full" : "temperature", createdAt: new Date().toISOString() });
                await sendLocalNotification(`EcoSort · ${check.title}`, check.body);
              }
            }
          }
        }
        initialized = true;
      } catch { /* Offline demo mode: the UI shows sample data and can retry on the next poll. */ }
    };
    poll();
    const timer = setInterval(poll, 10000);
    return () => { mounted = false; clearInterval(timer); };
  }, [user, addNotification]);
  return <NavigationContainer linking={linking}>
    <Stack.Navigator key={user ? "authenticated" : "guest"} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
      {!user ? <>
        <Stack.Screen name="Login" component={LoginScreen}/>
        <Stack.Screen name="Register" component={RegisterScreen}/>
      </> : <>
        <Stack.Screen name="MainTabs" component={MainTabs}/>
        <Stack.Screen name="ScanResult" component={ScanResultScreen} options={{ animation: "slide_from_bottom" }}/>
        <Stack.Screen name="WasteGuide" component={WasteGuideScreen}/>
        <Stack.Screen name="Notifications" component={NotificationsScreen}/>
        <Stack.Screen name="Account" component={AccountScreen}/>
        <Stack.Screen name="BinDetection" component={BinDetectionScreen}/>
        <Stack.Screen name="BinDetail" component={BinDetailScreen}/>
      </>}
    </Stack.Navigator>
  </NavigationContainer>;
}
export default function App() {
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppProvider><StatusBar style="dark"/><RootNavigator/></AppProvider>
    </TamaguiProvider>
  </GestureHandlerRootView>;
}
