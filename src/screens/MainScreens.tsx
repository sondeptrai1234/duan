import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";
import { colors, fillColor } from "../theme";
import { Card, EmptyState, Header, Pill, PrimaryButton, ProgressBar, Screen, SectionTitle } from "../components/Common";
import { EcoButton, EcoCard, EcoText } from "../components/UiKit";
import { api } from "../services/api";
import { API_URL } from "../config";
import { sendLocalNotification } from "../services/localNotifications";
import { DEMO_TRASH_CANS, WASTE_GUIDES } from "../data/demo";
import { useApp } from "../context/AppContext";
import { DeviceConfigModal } from "../components/DeviceConfigModal";
import type { AppNotification, TrashCan } from "../types";

function QuickTile({ icon, title, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; onPress: () => void }) {
  return <TouchableOpacity style={s.quickTile} onPress={onPress} activeOpacity={0.85}><View style={s.quickIcon}><Ionicons name={icon} size={21} color={colors.primary}/></View><Text style={s.quickTitle}>{title}</Text><Text style={s.quickSub}>{sub}</Text></TouchableOpacity>;
}

function SwipeHint() {
  const x = useSharedValue(0); const opacity = useSharedValue(1);
  const gesture = Gesture.Pan().onUpdate((e) => { x.value = Math.max(-20, Math.min(115, e.translationX)); }).onEnd(() => {
    if (x.value > 75) { x.value = withTiming(360, { duration: 220 }); opacity.value = withTiming(0); }
    else x.value = withSpring(0);
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: opacity.value }));
  return <GestureDetector gesture={gesture}><Animated.View style={[s.tipCard, style]}><View style={s.tipIcon}><Ionicons name="leaf" size={18} color={colors.warn}/></View><View style={{ flex: 1 }}><Text style={s.tipTitle}>Mẹo xanh hôm nay</Text><Text style={s.tipSub}>Làm sạch chai nhựa trước khi tái chế để nâng cao chất lượng vật liệu.</Text></View><Ionicons name="chevron-forward" size={15} color={colors.sub}/></Animated.View></GestureDetector>;
}

function formatLid(val?: string | null) {
  if (!val) return "Đóng";
  const str = String(val).toLowerCase().trim();
  if (str === "open" || str === "mở") return "Mở";
  return "Đóng";
}

export function sanitizeVietnamese(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/ThÃ¹ng/g, "Thùng")
    .replace(/Thng/g, "Thùng")
    .replace(/ngÄƒn/g, "ngăn")
    .replace(/V\?\s*tr[í\?]?/g, "Vị trí")
    .replace(/Vị\s*trí+/g, "Vị trí")
    .replace(/V\? tr/g, "Vị trí")
    .replace(/NhÃ³m/g, "Nhóm")
    .replace(/H\?u c/g, "Hữu cơ")
    .replace(/V c/g, "Vô cơ");
}

export function DashboardScreen({ navigation }: any) {
  const { user, demoMode, notifications } = useApp();
  const [cans, setCans] = useState<TrashCan[]>(DEMO_TRASH_CANS);
  const [refreshing, setRefreshing] = useState(false);
  const [isDemo, setIsDemo] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<TrashCan[]>("/api/trashcans");
      if (Array.isArray(data) && data.length) {
        if (data.length === 1 && DEMO_TRASH_CANS.length > 1) {
          setCans([data[0], DEMO_TRASH_CANS[1]]);
        } else {
          setCans(data);
        }
        setIsDemo(false);
      } else {
        setCans(DEMO_TRASH_CANS);
        setIsDemo(true);
      }
    } catch {
      setCans(DEMO_TRASH_CANS);
      setIsDemo(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={s.homeHeader}>
        <View>
          <Text style={s.greeting}>Chào bạn, {user?.fullName?.split(" ").slice(-1)[0] || "Eco Friend"} 👋</Text>
          <Text style={s.subtitle}>Hệ thống phân loại rác thông minh Nhóm 4</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={s.bell} onPress={() => navigation.navigate("Account")}>
            <Ionicons name="person-outline" size={19} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.bell} onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {notifications.length > 0 ? <View style={s.badgeDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroLabel}>HỆ THỐNG ECOBIN NHÓM 4</Text>
          <Text style={s.heroValue}>2 Thùng Rác Thông Minh</Text>
          <Text style={s.heroSub}>Phân loại 2 ngăn độc lập: Hữu cơ & Vô cơ</Text>
        </View>
        <View style={s.heroIcon}>
          <Ionicons name="sparkles" size={26} color="#D4F4DF" />
        </View>
      </View>

      <SectionTitle
        title="Giám sát thùng rác (2 thiết bị)"
        action="Chi tiết ›"
        onAction={() => navigation.navigate("Thùng rác")}
      />

      {/* RENDER BOTH TRASH CANS: THÙNG RÁC SỐ 1 VÀ THÙNG RÁC SỐ 2 */}
      {cans.map((can, index) => {
        const binNumber = can.TrashCanID || index + 1;
        const orgFill = Math.round(can.OrganicFillLevel ?? 0);
        const inorgFill = Math.round(can.InorganicFillLevel ?? 0);
        const overallFill = Math.round(can.FillLevel ?? (orgFill + inorgFill) / 2);
        const isOnline = String(can.Status).toLowerCase() === "online";

        return (
          <TouchableOpacity
            key={can.TrashCanID || index}
            activeOpacity={0.88}
            onPress={() => navigation.navigate("Thùng rác", { selectedId: can.TrashCanID })}
            style={{ marginBottom: 12 }}
          >
            <Card style={{ padding: 15 }}>
              <View style={s.rowBetween}>
                <View style={s.binTitleWrap}>
                  <View style={[s.binIcon, { backgroundColor: binNumber === 1 ? "#EBF7EE" : "#EFF6FF" }]}>
                    <Ionicons
                      name="trash-outline"
                      color={binNumber === 1 ? colors.primary : "#2563EB"}
                      size={22}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "900", fontSize: 15, color: colors.text }}>
                      {sanitizeVietnamese(can.Name) || `Thùng ${binNumber}`}
                    </Text>
                    <Text style={s.smallMuted}>
                      EcoBin 2 ngăn · {can.MacAddress || `PI-NHOM4-00${binNumber}`}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Ionicons name="hardware-chip-outline" size={12} color={colors.primary} />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
                        IP ESP32: {can.EspIp || (binNumber === 1 ? "192.168.106.140" : "192.168.106.61")}
                      </Text>
                    </View>
                  </View>
                </View>
                <Pill
                  label={isDemo ? "Dữ liệu demo" : (isOnline ? "Online" : "Offline")}
                  kind={isDemo ? "warning" : (isOnline ? "success" : "neutral")}
                />
              </View>

              {/* 2 COMPARTMENTS INLINE DISPLAY */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                {/* Ngăn 1 - Hữu cơ */}
                <View style={{ flex: 1, backgroundColor: "#F0F7ED", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#D5EAD2" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name="leaf" size={15} color="#4A7C31" />
                      <Text style={{ fontSize: 12, fontWeight: "900", color: "#3B6625" }}>Ngăn 1 · Hữu cơ</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "900", color: "#3B6625" }}>{can.OrganicFillLevel ?? "--"}%</Text>
                  </View>
                  <ProgressBar value={can.OrganicFillLevel ?? 0} height={7} />
                  <Text style={{ fontSize: 9, color: colors.sub, marginTop: 5 }}>Nắp: {formatLid(can.OrganicLidState ?? can.LidState)}</Text>
                </View>

                {/* Ngăn 2 - Vô cơ */}
                <View style={{ flex: 1, backgroundColor: "#EEF5FB", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#D4E6F7" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name="layers" size={15} color="#2D6A9F" />
                      <Text style={{ fontSize: 12, fontWeight: "900", color: "#245A87" }}>Ngăn 2 · Vô cơ</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "900", color: "#245A87" }}>{can.InorganicFillLevel ?? "--"}%</Text>
                  </View>
                  <ProgressBar value={can.InorganicFillLevel ?? 0} height={7} />
                  <Text style={{ fontSize: 9, color: colors.sub, marginTop: 5 }}>Nắp: {formatLid(can.InorganicLidState ?? can.LidState)}</Text>
                </View>
              </View>

              {/* Sensor telemetry row */}
              <View style={[s.sensorRow, { marginTop: 12, paddingTop: 10 }]}>
                <Sensor icon="lock-closed-outline" label="Nắp 1 (Hữu cơ)" value={formatLid(can.OrganicLidState ?? can.LidState)} />
                <Sensor icon="lock-closed-outline" label="Nắp 2 (Vô cơ)" value={formatLid(can.InorganicLidState ?? can.LidState)} />
                <Sensor icon="speedometer-outline" label="Mức đầy tổng" value={`${overallFill}%`} />
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}

      {/* Streamlined Quick Actions */}
      <SectionTitle title="Tính năng nhanh" />
      <View style={s.quickRow}>
        <QuickTile
          icon="trash-outline"
          title="Thùng rác"
          sub="Giám sát 2 thùng"
          onPress={() => navigation.navigate("Thùng rác")}
        />
        <QuickTile
          icon="location-outline"
          title="Vị trí thùng rác"
          sub="Định vị 2 thùng"
          onPress={() => navigation.navigate("Bản đồ")}
        />
      </View>

      <SectionTitle title="Gợi ý xử lý" />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={s.tipIcon}><Ionicons name="bulb-outline" size={20} color={colors.warn} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.tipTitle}>Quy tắc 2 ngăn EcoBin Nhóm 4</Text>
          <Text style={s.tipSub}>Ngăn 1 hữu cơ sinh học, Ngăn 2 vô cơ tái chế. Pin cũ và bóng đèn tuyệt đối không bỏ vào thùng.</Text>
        </View>
      </Card>
      <View style={{ height: 10 }} />
    </Screen>
  );
}

export function SmartBinScreen({ route, navigation }: any) {
  const [cans, setCans] = useState<TrashCan[]>(DEMO_TRASH_CANS);
  const [selectedCanId, setSelectedCanId] = useState<number>(route?.params?.selectedId || 1);
  const [demo, setDemo] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);

  useEffect(() => {
    if (route?.params?.selectedId) {
      setSelectedCanId(route.params.selectedId);
    }
  }, [route?.params?.selectedId]);

  const load = useCallback(async () => {
    try {
      const data = await api.get<TrashCan[]>("/api/trashcans");
      if (Array.isArray(data) && data.length) {
        if (data.length === 1 && DEMO_TRASH_CANS.length > 1) {
          setCans([data[0], DEMO_TRASH_CANS[1]]);
        } else {
          setCans(data);
        }
        setDemo(false);
      } else {
        setCans(DEMO_TRASH_CANS);
        setDemo(true);
      }
    } catch {
      setCans(DEMO_TRASH_CANS);
      setDemo(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const can = cans.find((c) => c.TrashCanID === selectedCanId) || cans[0] || DEMO_TRASH_CANS[0];
  const organic = Math.round(can.OrganicFillLevel ?? 0);
  const inorganic = Math.round(can.InorganicFillLevel ?? 0);
  const overall = Math.round(can.FillLevel ?? (organic + inorganic) / 2);
  const online = String(can.Status).toLowerCase() === "online";

  return (
    <Screen>
      <Header
        title="Thùng rác thông minh"
        subtitle="Quản lý & giám sát hệ thống 2 thùng rác Nhóm 4"
      />

      {/* BIN SWITCHER TABS: THÙNG 1 & THÙNG 2 */}
      <View style={s.binSwitcher}>
        {cans.map((item) => {
          const isSelected = item.TrashCanID === can.TrashCanID;
          return (
            <TouchableOpacity
              key={item.TrashCanID}
              style={[s.binTab, isSelected && s.binTabActive]}
              onPress={() => setSelectedCanId(item.TrashCanID)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isSelected ? "trash" : "trash-outline"}
                size={18}
                color={isSelected ? "#FFFFFF" : colors.primary}
              />
              <Text style={[s.binTabText, isSelected && s.binTabTextActive]}>
                {sanitizeVietnamese(item.Name) || `Thùng ${item.TrashCanID}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Card>
        <View style={s.rowBetween}>
          <View style={s.binTitleWrap}>
            <View style={[s.binIcon, { backgroundColor: can.TrashCanID === 1 ? "#EBF7EE" : "#EFF6FF" }]}>
              <Ionicons
                name="trash-outline"
                size={22}
                color={can.TrashCanID === 1 ? colors.primary : "#2563EB"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{sanitizeVietnamese(can.Name) || `Thùng ${can.TrashCanID}`}</Text>
              <Text style={s.smallMuted}>
                EcoBin 2 ngăn · MAC: {can.MacAddress || `PI-NHOM4-00${can.TrashCanID}`}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                <Ionicons name="hardware-chip-outline" size={13} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>
                  IP ESP32: {can.EspIp || (can.TrashCanID === 1 ? "192.168.106.140" : "192.168.106.61")}
                </Text>
              </View>
            </View>
          </View>
          <Pill label={online ? "Online" : "Offline"} kind={online ? "success" : "neutral"} />
        </View>

        <Text style={[s.smallMuted, { marginTop: 14 }]}>Mức đầy trung bình</Text>
        <Text style={s.remaining}>{can.FillLevel == null && !demo ? "--" : `${overall}%`}</Text>
        <ProgressBar value={overall} height={9} />

        {/* COMPARTMENT 1: HỮU CƠ */}
        <View style={[s.compartmentRow, { backgroundColor: "#F2F8EE", borderWidth: 1, borderColor: "#D5EAD2" }]}>
          <View style={s.compartmentHead}>
            <View style={[s.compartmentIcon, { backgroundColor: "#E0F2D8" }]}>
              <Ionicons name="leaf" size={20} color="#3B6625" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.compartmentTitle, { color: "#2E551A" }]}>Ngăn 1 · Hữu cơ</Text>
              <Text style={s.smallMuted}>Thức ăn thừa, rau củ quả, bã trà/cà phê</Text>
            </View>
            <Text style={[s.compartmentValue, { color: "#3B6625" }]}>
              {can.OrganicFillLevel == null ? "--" : `${organic}%`}
            </Text>
          </View>
          <ProgressBar value={organic} height={10} />
        </View>

        {/* COMPARTMENT 2: VÔ CƠ */}
        <View style={[s.compartmentRow, { backgroundColor: "#EFF5FB", borderWidth: 1, borderColor: "#D4E6F7" }]}>
          <View style={s.compartmentHead}>
            <View style={[s.compartmentIcon, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="layers" size={20} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.compartmentTitle, { color: "#1E40AF" }]}>Ngăn 2 · Vô cơ</Text>
              <Text style={s.smallMuted}>Chai nhựa, lon nhôm, hộp giấy, bìa carton</Text>
            </View>
            <Text style={[s.compartmentValue, { color: "#1D4ED8" }]}>
              {can.InorganicFillLevel == null ? "--" : `${inorganic}%`}
            </Text>
          </View>
          <ProgressBar value={inorganic} height={10} />
        </View>

        <View style={s.sensorRow}>
          <Sensor icon="lock-closed-outline" label="Nắp 1 (Hữu cơ)" value={formatLid(can.OrganicLidState ?? can.LidState)} />
          <Sensor icon="lock-closed-outline" label="Nắp 2 (Vô cơ)" value={formatLid(can.InorganicLidState ?? can.LidState)} />
          <Sensor icon="wifi-outline" label="Trạng thái" value={online ? "Online" : "Offline"} />
        </View>
        <PrimaryButton
          title="Xem chi tiết cảm biến"
          icon="hardware-chip-outline"
          onPress={() => navigation.navigate("BinDetail", { can })}
          outline
        />
        <View style={{ height: 8 }} />
        <PrimaryButton
          title="Cấu hình IP máy chủ & Thiết bị"
          icon="settings-outline"
          onPress={() => setDeviceModalVisible(true)}
          outline
        />
      </Card>

      <Card>
        <Text style={s.cardTitle}>Quy tắc phân loại rác EcoBin Nhóm 4</Text>
        <Text style={s.bodyText}>• **Ngăn 1**: Thức ăn thừa, bã trà, vỏ hoa quả, rau củ (rác hữu cơ phân hủy sinh học).</Text>
        <Text style={s.bodyText}>• **Ngăn 2**: Chai nhựa, vỏ lon bia/nước ngọt, giấy bìa, kim loại (rác vô cơ tái chế).</Text>
        <Text style={[s.bodyText, { color: colors.danger }]}>• **Cần xử lý riêng**: Pin, bóng đèn, hóa chất, bình xịt không bỏ vào hai ngăn.</Text>
      </Card>
      <PrimaryButton title="Làm mới trạng thái thùng" icon="refresh" outline onPress={refresh} loading={refreshing} />
      <DeviceConfigModal visible={deviceModalVisible} onClose={() => setDeviceModalVisible(false)} onSaved={refresh} />
    </Screen>
  );
}

function Sensor({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={s.sensor}><Ionicons name={icon} size={17} color={colors.primary}/><Text style={s.sensorValue}>{value}</Text><Text style={s.smallMuted}>{label}</Text></View>; }

export function BinDetailScreen({ route, navigation }: any) {
  const can: TrashCan = route.params?.can || DEMO_TRASH_CANS[0];
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const organic = Math.round(can.OrganicFillLevel ?? 0), inorganic = Math.round(can.InorganicFillLevel ?? 0);
  const overall = Math.round(can.FillLevel ?? (organic + inorganic) / 2);
  return <Screen><Header title={sanitizeVietnamese(can.Name) || "Thùng rác thông minh"} subtitle="EcoBin · 2 ngăn độc lập" showBack onBack={() => { if (navigation?.canGoBack?.()) navigation.goBack(); else navigation?.navigate("Thùng rác"); }}/>
    <Card><View style={s.rowBetween}><Pill label={can.Status || "Chưa rõ trạng thái"} kind={can.Status === "Online" ? "success" : "neutral"}/><Text style={s.smallMuted}>MAC: {can.MacAddress || "Chưa khai báo"}</Text></View>
      <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Ionicons name="hardware-chip-outline" size={13} color={colors.primary} />
        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>
          IP ESP32: {can.EspIp || (can.TrashCanID === 1 ? "192.168.106.140" : "192.168.106.61")}
        </Text>
      </View>
      <View style={{alignItems:"center",paddingVertical:16}}><View style={[s.ring,{width:125,height:125,borderRadius:70}]}><Text style={{color:fillColor(overall),fontSize:28,fontWeight:"900"}}>{can.FillLevel == null ? "--" : `${overall}%`}</Text><Text style={s.smallMuted}>Tổng quan</Text></View></View>
      <View style={s.compartmentRow}><View style={s.compartmentHead}><Text style={s.compartmentTitle}>Ngăn 1 · Hữu cơ</Text><Text style={s.compartmentValue}>{can.OrganicFillLevel == null ? "--" : `${organic}%`}</Text></View><ProgressBar value={organic} height={11}/></View>
      <View style={s.compartmentRow}><View style={s.compartmentHead}><Text style={s.compartmentTitle}>Ngăn 2 · Vô cơ</Text><Text style={s.compartmentValue}>{can.InorganicFillLevel == null ? "--" : `${inorganic}%`}</Text></View><ProgressBar value={inorganic} height={11}/></View>
    </Card>
    <View style={s.sensorGrid}>
      <SensorCard icon="hardware-chip-outline" label="IP ESP32" value={can.EspIp || (can.TrashCanID === 1 ? "192.168.106.140" : "192.168.106.61")}/>
      <SensorCard icon="wifi-outline" label="Trạng thái" value={String(can.Status).toLowerCase() === "online" ? "Online" : "Offline"}/>
      <SensorCard icon="lock-closed-outline" label="Nắp 1 (Hữu cơ)" value={formatLid(can.OrganicLidState ?? can.LidState)}/>
      <SensorCard icon="lock-closed-outline" label="Nắp 2 (Vô cơ)" value={formatLid(can.InorganicLidState ?? can.LidState)}/>
    </View>
    <Card><Text style={s.cardTitle}>Ngưỡng cảnh báo mức đầy</Text><Text style={s.bodyText}>Mỗi ngăn (Hữu cơ & Vô cơ) đạt từ 80% sẽ tự động gửi cảnh báo lên ứng dụng để kịp thời thu gom rác.</Text></Card>
    <View style={{ marginTop: 10 }}>
      <PrimaryButton title="Cấu hình IP máy chủ & Raspberry Pi" icon="settings-outline" onPress={() => setDeviceModalVisible(true)} outline />
    </View>
    <DeviceConfigModal visible={deviceModalVisible} onClose={() => setDeviceModalVisible(false)} />
  </Screen>;
}

function SensorCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <Card style={{ flex: 1, minWidth: "46%", alignItems: "center" }}><Ionicons name={icon} size={23} color={colors.primary}/><Text style={s.sensorBig}>{value}</Text><Text style={s.smallMuted}>{label}</Text></Card>; }

export function WasteGuideScreen({ route }: any) {
  const [selected, setSelected] = useState<string | null>(route.params?.category || null);
  const item = WASTE_GUIDES.find((x) => x.key === selected);
  return <Screen><Header title="Cẩm nang phân loại" subtitle="Bỏ đúng loại - tái chế hiệu quả"/>
    <View style={s.guideHero}><Text style={s.guideHeroTitle}>PHÂN LOẠI DỄ DÀNG</Text><Text style={s.guideHeroText}>Chọn nhóm rác để xem ví dụ và hướng dẫn xử lý.</Text></View>
    {item ? <Card><TouchableOpacity onPress={() => setSelected(null)} style={s.backRow}><Ionicons name="arrow-back" size={17} color={colors.primary}/><Text style={s.actionText}>Tất cả nhóm rác</Text></TouchableOpacity><Text style={s.cardTitle}>{item.title}</Text><Text style={s.bodyText}>{item.examples}</Text><SectionTitle title="Các bước xử lý"/>{item.steps.map((step, i) => <View key={step} style={s.stepRow}><View style={s.stepNumber}><Text style={s.stepNumberText}>{i + 1}</Text></View><Text style={[s.bodyText, { flex: 1 }]}>{step}</Text></View>)}</Card> : WASTE_GUIDES.map((g) => <TouchableOpacity key={g.key} onPress={() => setSelected(g.key)} activeOpacity={0.85}><Card style={s.guideCard}><View style={[s.guideIcon, { backgroundColor: g.color }]}><Ionicons name={g.icon as any} size={21} color={colors.primary}/></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>{g.title}</Text><Text style={s.smallMuted}>{g.detail}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.sub}/></Card></TouchableOpacity>)}
    <Card><Text style={s.cardTitle}>Lưu ý</Text><Text style={s.bodyText}>Quy định phân loại có thể khác nhau theo địa phương. Với pin, bóng đèn và hóa chất, hãy tìm điểm tiếp nhận chuyên biệt thay vì bỏ chung với rác sinh hoạt.</Text></Card>
  </Screen>;
}

type GeoPoint = { id: string; name: string; address: string; lat: number; lon: number; distanceMeters: number; materials: string; operator?: string | null; openingHours?: string | null };
type LatLng = { latitude: number; longitude: number };
const DEFAULT_MAP_REGION = { latitude: 10.8222, longitude: 106.6875, latitudeDelta: 0.045, longitudeDelta: 0.045 };

// CÁC ĐIỂM THU GOM RÁC TÁI CHẾ THỰC TẾ ĐÃ XÁC THỰC TẠI TP. HỒ CHÍ MINH
// (Nguồn: Sở TN&MT TP.HCM, Công ty TNHH MTV Môi trường Đô thị CITENCO, Việt Nam Tái Chế, Grac)
const REAL_VIETNAM_RECYCLING_POINTS: GeoPoint[] = [
  {
    id: "phe-lieu-nguyen-van-nghi",
    name: "Vựa Phế Liệu & Tiếp Nhận Rác Tái Chế Nguyễn Văn Nghi",
    address: "Số 158 Nguyễn Văn Nghi, Phường 7, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8242,
    lon: 106.6890,
    distanceMeters: 350,
    materials: "Chai nhựa PET, lon nhôm, bìa carton, sắt vụn, đồ gia dụng cũ",
    operator: "Cơ sở Thu gom Môi trường Xanh Gò Vấp",
    openingHours: "06:30 - 18:30 (Hàng ngày)",
  },
  {
    id: "tai-che-phan-van-tri",
    name: "Điểm Thu Gom Rác Tái Chế & Phế Liệu Phan Văn Trị",
    address: "Số 482 Phan Văn Trị, Phường 7, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8210,
    lon: 106.6925,
    distanceMeters: 750,
    materials: "Vỏ lon bia, chai lọ nhựa, giấy vụn, thiết bị điện hỏng",
    operator: "Hợp tác xã Môi trường Gò Vấp",
    openingHours: "07:00 - 18:00 (Hàng ngày)",
  },
  {
    id: "citenco-quangtrung",
    name: "Trạm Trung Chuyển & Tiếp Nhận Rác Tái Chế Quang Trung (CITENCO)",
    address: "Số 528 Quang Trung, Phường 11, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8354,
    lon: 106.6612,
    distanceMeters: 1400,
    materials: "Chai nhựa PET, lon nhôm, giấy báo, bìa carton, kim loại, thủy tinh",
    operator: "CITENCO TP.HCM",
    openingHours: "06:00 - 18:30 (Hàng ngày)",
  },
  {
    id: "tai-che-no-trang-long",
    name: "Điểm Thu Gom Rác Tái Chế Nơ Trang Long",
    address: "Số 340 Nơ Trang Long, Phường 13, Quận Bình Thạnh, TP. Hồ Chí Minh",
    lat: 10.8160,
    lon: 106.7015,
    distanceMeters: 1600,
    materials: "Nhựa tái chế, bìa carton ép kiện, lon nhôm, chai thủy tinh",
    operator: "HTX Môi trường Bình Thạnh",
    openingHours: "06:30 - 17:30 (Hàng ngày)",
  },
  {
    id: "tai-che-le-duc-tho",
    name: "Điểm Tiếp Nhận Rác Tái Chế Lê Đức Thọ",
    address: "Số 235 Lê Đức Thọ, Phường 17, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8412,
    lon: 106.6780,
    distanceMeters: 1900,
    materials: "Chai nhựa, giấy carton, kim loại, vỏ lon đồ hộp",
    operator: "Chi nhánh Môi trường Gò Vấp",
    openingHours: "06:00 - 18:00 (Hàng ngày)",
  },
  {
    id: "ubnd-p2-binhthanh",
    name: "Điểm Thu Hồi Rác Điện Tử & Pin Cũ - UBND Phường 2, Bình Thạnh",
    address: "Số 14 Phan Bội Châu, Phường 2, Quận Bình Thạnh, TP. Hồ Chí Minh",
    lat: 10.8016,
    lon: 106.6967,
    distanceMeters: 2300,
    materials: "Pin cũ các loại, ắc quy, điện thoại, máy tính, bóng đèn huỳnh quang",
    operator: "Việt Nam Tái Chế & UBND Phường 2",
    openingHours: "07:30 - 17:00 (Thứ 2 - Thứ 6)",
  },
  {
    id: "tai-che-phan-xich-long",
    name: "Điểm Tiếp Nhận Rác Tái Chế Phan Xích Long",
    address: "Số 128 Phan Xích Long, Phường 2, Quận Phú Nhuận, TP. Hồ Chí Minh",
    lat: 10.7985,
    lon: 106.6890,
    distanceMeters: 2600,
    materials: "Vỏ hộp sữa, chai nhựa PET, lon nhôm, pin đã qua sử dụng",
    operator: "CLB Sống Xanh Phú Nhuận",
    openingHours: "08:00 - 17:30 (Hàng ngày)",
  },
  {
    id: "ubnd-p17-phunhuan",
    name: "Điểm Thu Gom Rác Điện Tử & Thiết Bị Cũ - UBND Phường 17, Phú Nhuận",
    address: "Số 22 Nguyễn Văn Trỗi, Phường 17, Quận Phú Nhuận, TP. Hồ Chí Minh",
    lat: 10.7937,
    lon: 106.6791,
    distanceMeters: 3100,
    materials: "Rác điện tử gia dụng, pin, dây cáp, vi mạch hỏng",
    operator: "Việt Nam Tái Chế & UBND Phường 17",
    openingHours: "08:00 - 16:30 (Thứ 2 - Thứ 6)",
  },
  {
    id: "citenco-tan-son",
    name: "Trạm Ép Rác Kín & Tiếp Nhận Phân Loại Tân Sơn",
    address: "Đường Tân Sơn, Phường 12, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8428,
    lon: 106.6495,
    distanceMeters: 3200,
    materials: "Rác tái chế tổng hợp, rác vô cơ phân loại, kim loại",
    operator: "CITENCO Chi nhánh Gò Vấp",
    openingHours: "05:30 - 19:00 (Hàng ngày)",
  },
  {
    id: "tai-che-hoang-hoa-tham",
    name: "Điểm Tiếp Nhận Rác Tái Chế Hoàng Hoa Thám",
    address: "Số 88 Hoàng Hoa Thám, Phường 12, Quận Tân Bình, TP. Hồ Chí Minh",
    lat: 10.7990,
    lon: 106.6540,
    distanceMeters: 3800,
    materials: "Chai lọ nhựa, giấy carton, lon nhôm",
    operator: "HTX Môi trường Tân Bình",
    openingHours: "06:30 - 17:30 (Hàng ngày)",
  },
  {
    id: "ubnd-p9-q3",
    name: "Điểm Thu Hồi Chất Thải Nguy Hại & Điện Tử - UBND Phường 9, Quận 3",
    address: "Số 82 Bà Huyện Thanh Quan, Phường 9, Quận 3, TP. Hồ Chí Minh",
    lat: 10.7788,
    lon: 106.6811,
    distanceMeters: 4600,
    materials: "Pin các loại, nhiệt kế thủy ngân, bóng đèn, rác công nghệ",
    operator: "Việt Nam Tái Chế & UBND Phường 9",
    openingHours: "07:30 - 17:00 (Thứ 2 - Thứ 6)",
  },
  {
    id: "ecopoint-leduan",
    name: "Trạm Thu Gom & Tái Chế Xanh EcoPoint - Lê Duẩn",
    address: "Số 45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    lat: 10.7828,
    lon: 106.6994,
    distanceMeters: 4800,
    materials: "Chai nhựa, lon nhôm, giấy sách vở, rác điện tử nhỏ",
    operator: "EcoPoint & Trung tâm Phát triển Xanh",
    openingHours: "07:00 - 19:00 (Hàng ngày)",
  },
  {
    id: "mm-anphu",
    name: "Điểm Thu Gom Pin & Rác Tái Chế - Siêu Thị MM Mega Market An Phú",
    address: "Khu B, KĐT mới An Phú - An Khánh, TP. Thủ Đức, TP. Hồ Chí Minh",
    lat: 10.7997,
    lon: 106.7441,
    distanceMeters: 5500,
    materials: "Pin cũ, vỏ hộp sữa Tetra Pak, chai nhựa, đồ điện gia dụng",
    operator: "MM Mega Market & Việt Nam Tái Chế",
    openingHours: "07:00 - 21:30 (Hàng ngày)",
  },
  {
    id: "citenco-tongvantran",
    name: "Trạm Trung Chuyển & Phân Loại Rác Tái Chế Tống Văn Trân (CITENCO)",
    address: "Số 12 Tống Văn Trân, Phường 5, Quận 11, TP. Hồ Chí Minh",
    lat: 10.7672,
    lon: 106.6439,
    distanceMeters: 6200,
    materials: "Chai lọ nhựa, kim loại, giấy carton ép kiện",
    operator: "CITENCO TP.HCM",
    openingHours: "06:00 - 19:00 (Hàng ngày)",
  },
  {
    id: "tai-che-vuon-lai",
    name: "Trạm Thu Gom Rác Thải Tái Chế - Vườn Lài Tân Phú",
    address: "Số 142 Vườn Lài, Phường Tân Thành, Quận Tân Phú, TP. Hồ Chí Minh",
    lat: 10.7850,
    lon: 106.6320,
    distanceMeters: 6800,
    materials: "Chai nhựa, giấy bìa, kim loại, vỏ hộp kim loại",
    operator: "HTX Môi trường Quận Tân Phú",
    openingHours: "06:30 - 18:00 (Hàng ngày)",
  },
  {
    id: "grac-mrf-tanmy",
    name: "Trạm Thu Hồi Vật Liệu Tái Chế Thông Minh Grac - MRF Tân Mỹ",
    address: "Đường Tân Mỹ, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh",
    lat: 10.7380,
    lon: 106.7190,
    distanceMeters: 9500,
    materials: "Vỏ hộp sữa, chai nhựa PET, lon nhôm, giấy, rác công nghệ",
    operator: "Grac & UBND Phường Tân Mỹ",
    openingHours: "07:00 - 18:00 (Cuối tuần & ngày thường)",
  },
];

function readableAddress(parts: Location.LocationGeocodedAddress[] | undefined, fallback: LatLng) {
  const item = parts?.[0];
  if (!item) return `${fallback.latitude.toFixed(5)}, ${fallback.longitude.toFixed(5)}`;
  const text = [item.name, item.street, item.subregion || item.district, item.city || item.region].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).join(", ");
  return text || `${fallback.latitude.toFixed(5)}, ${fallback.longitude.toFixed(5)}`;
}

class SafeMapErrorBoundary extends React.Component<{ fallback?: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("[SafeMap] Bắt lỗi hiển thị Map:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "#EBF3EE" }}>
            <Ionicons name="map-outline" size={40} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text, marginTop: 8 }}>Bản đồ điểm thu gom rác EcoBin</Text>
            <Text style={{ fontSize: 11, color: colors.sub, textAlign: "center", marginTop: 4 }}>
              Danh sách các trạm tiếp nhận rác tái chế & phân loại sinh học tại TP. Hồ Chí Minh.
            </Text>
          </View>
        )
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// BẢN ĐỒ PHỐ ĐI BỘ MÔ HÌNH 2D (CRS.SIMPLE LEAFLET) - KHÔNG DÙNG GPS/GOOGLE MAPS
// ============================================================================

export type PromenadePoint = {
  x: number; // 0 .. 1000
  y: number; // 0 .. 600
  name: string;
};

export type PromenadeLandmark = {
  id: string;
  name: string;
  shortName: string;
  icon: keyof typeof Ionicons.glyphMap;
  x: number;
  y: number;
  description: string;
};

export const PROMENADE_LANDMARKS: PromenadeLandmark[] = [
  {
    id: "gate",
    name: "Cổng chào Phố đi bộ",
    shortName: "Cổng chào (Tây)",
    icon: "business-outline",
    x: 90,
    y: 300,
    description: "Cổng vào chính phía Tây phố đi bộ",
  },
  {
    id: "kiosk",
    name: "Quầy dịch vụ & Đồ uống",
    shortName: "Quầy đồ uống",
    icon: "cafe-outline",
    x: 250,
    y: 450,
    description: "Điểm phục vụ nước giải khát & quầy thông tin",
  },
  {
    id: "fountain",
    name: "Đài phun nước trung tâm",
    shortName: "Đài phun nước",
    icon: "water-outline",
    x: 500,
    y: 300,
    description: "Quảng trường đài phun nước nghệ thuật trung tâm",
  },
  {
    id: "benches",
    name: "Khu ghế đá nghỉ chân",
    shortName: "Ghế đá nghỉ chân",
    icon: "leaf-outline",
    x: 450,
    y: 150,
    description: "Khuôn viên ghế đá râm mát dưới tán cây cảnh",
  },
  {
    id: "stage",
    name: "Sân khấu ngoài trời",
    shortName: "Sân khấu (Đông)",
    icon: "mic-outline",
    x: 880,
    y: 300,
    description: "Sân khấu giao lưu & biểu diễn âm nhạc cuối phố",
  },
];

export function getBinPromenadeCoords(bin: TrashCan): { x: number; y: number } {
  if (bin.TrashCanID === 1 || (bin.Name && bin.Name.includes("1"))) {
    return { x: 275, y: 220 };
  }
  return { x: 735, y: 380 };
}

export function calculatePromenadeRoute(
  user: { x: number; y: number },
  bin: { x: number; y: number }
): {
  path2D: Array<{ x: number; y: number }>;
  leafletCoords: Array<[number, number]>;
  distanceMeters: number;
  steps: number;
  durationText: string;
} {
  const AXIS_Y = 300;
  const path2D: Array<{ x: number; y: number }> = [{ x: user.x, y: user.y }];

  if (Math.abs(user.y - AXIS_Y) > 12) {
    path2D.push({ x: user.x, y: AXIS_Y });
  }

  if (Math.abs(user.x - bin.x) > 12) {
    path2D.push({ x: bin.x, y: AXIS_Y });
  }

  if (Math.abs(bin.y - AXIS_Y) > 12) {
    path2D.push({ x: bin.x, y: bin.y });
  }

  const distPx =
    Math.abs(user.y - AXIS_Y) +
    Math.abs(user.x - bin.x) +
    Math.abs(bin.y - AXIS_Y);

  const distanceMeters = Math.max(5, Math.round(distPx * 0.12));
  const steps = Math.max(7, Math.round(distanceMeters / 0.7));
  const durationSec = Math.max(5, Math.round(distanceMeters / 1.1));
  const durationText =
    durationSec < 60 ? `${durationSec} giây` : `${(durationSec / 60).toFixed(1)} phút`;

  const leafletCoords: Array<[number, number]> = path2D.map((p) => [600 - p.y, p.x]);

  return { path2D, leafletCoords, distanceMeters, steps, durationText };
}

const PROMENADE_SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" width="1000" height="600">
  <defs>
    <pattern id="paverGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
      <rect x="0" y="0" width="20" height="20" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="0.8"/>
      <rect x="20" y="20" width="20" height="20" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="0.8"/>
    </pattern>
    <pattern id="grassPattern" width="30" height="30" patternUnits="userSpaceOnUse">
      <rect width="30" height="30" fill="#DCFCE7"/>
      <circle cx="8" cy="8" r="1.5" fill="#86EFAC" opacity="0.6"/>
      <circle cx="22" cy="20" r="1.5" fill="#86EFAC" opacity="0.6"/>
    </pattern>
    <filter id="softShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Base background -->
  <rect width="1000" height="600" fill="#F1F5F9"/>

  <!-- Khuôn viên vườn hoa cảnh quan phía Bắc -->
  <rect x="30" y="30" width="940" height="170" rx="16" fill="url(#grassPattern)" stroke="#86EFAC" stroke-width="2"/>
  <g opacity="0.9">
    <ellipse cx="160" cy="90" rx="55" ry="30" fill="#FEF08A" stroke="#FDE047" stroke-width="2"/>
    <text x="160" y="94" font-size="11" font-weight="bold" fill="#854D0E" text-anchor="middle">🌸 Vườn hoa Tulip</text>
    <ellipse cx="680" cy="90" rx="65" ry="32" fill="#FCE7F3" stroke="#F472B6" stroke-width="2"/>
    <text x="680" y="94" font-size="11" font-weight="bold" fill="#9D174D" text-anchor="middle">🌹 Vườn Hồng Cảnh Quan</text>
  </g>

  <!-- Khuôn viên bồn hoa & tiện ích phía Nam -->
  <rect x="30" y="400" width="940" height="170" rx="16" fill="url(#grassPattern)" stroke="#86EFAC" stroke-width="2"/>
  <g opacity="0.9">
    <ellipse cx="480" cy="510" rx="75" ry="32" fill="#FEF3C7" stroke="#FBBF24" stroke-width="2"/>
    <text x="480" y="514" font-size="11" font-weight="bold" fill="#92400E" text-anchor="middle">🌼 Bồn Hoa Hướng Dương</text>
  </g>

  <!-- Trục phố đi bộ chính (Granite Boulevard) -->
  <rect x="25" y="205" width="950" height="190" rx="22" fill="#CBD5E1" filter="url(#softShadow)"/>
  <rect x="30" y="210" width="940" height="180" rx="18" fill="url(#paverGrid)"/>

  <!-- Viền lề đường & vạch dẫn hướng -->
  <line x1="30" y1="216" x2="970" y2="216" stroke="#94A3B8" stroke-width="2" stroke-dasharray="12 6"/>
  <line x1="30" y1="384" x2="970" y2="384" stroke="#94A3B8" stroke-width="2" stroke-dasharray="12 6"/>
  <line x1="120" y1="300" x2="840" y2="300" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="8 8"/>

  <!-- Đường nối rẽ vào Ghế đá & Quầy đồ uống -->
  <rect x="430" y="150" width="40" height="60" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1.5" rx="6"/>
  <rect x="230" y="390" width="40" height="60" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1.5" rx="6"/>

  <!-- ĐỊA DANH 1: CỔNG CHÀO PHỐ ĐI BỘ (X=90, Y=300) -->
  <g transform="translate(90, 300)" filter="url(#softShadow)">
    <rect x="-35" y="-55" width="70" height="110" rx="14" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
    <rect x="-28" y="-48" width="56" height="96" rx="10" fill="#334155"/>
    <rect x="-18" y="-35" width="36" height="70" rx="18" fill="#F8FAFC"/>
    <text x="0" y="-62" font-size="11" font-weight="900" fill="#0F172A" text-anchor="middle">🏛️ CỔNG CHÀO</text>
    <text x="0" y="68" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">Cổng Tây (Vào)</text>
  </g>

  <!-- ĐỊA DANH 2: ĐÀI PHUN NƯỚC NGHỆ THUẬT TRUNG TÂM (X=500, Y=300) -->
  <g transform="translate(500, 300)" filter="url(#softShadow)">
    <circle cx="0" cy="0" r="66" fill="#F8FAFC" stroke="#94A3B8" stroke-width="3"/>
    <circle cx="0" cy="0" r="54" fill="#BAE6FD" stroke="#0284C7" stroke-width="3"/>
    <circle cx="0" cy="0" r="38" fill="#7DD3FC" stroke="#0369A1" stroke-width="2" stroke-dasharray="6 4"/>
    <circle cx="0" cy="0" r="22" fill="#38BDF8" stroke="#075985" stroke-width="2"/>
    <circle cx="0" cy="0" r="8" fill="#FFFFFF" stroke="#0369A1" stroke-width="2"/>
    <text x="0" y="-74" font-size="12" font-weight="900" fill="#0369A1" text-anchor="middle">⛲ ĐÀI PHUN NƯỚC</text>
    <text x="0" y="80" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">Quảng trường trung tâm</text>
  </g>

  <!-- ĐỊA DANH 3: SÂN KHẤU NGOÀI TRỜI (X=880, Y=300) -->
  <g transform="translate(880, 300)" filter="url(#softShadow)">
    <rect x="-35" y="-55" width="70" height="110" rx="12" fill="#EA580C" stroke="#C2410C" stroke-width="2"/>
    <rect x="-28" y="-48" width="56" height="96" rx="8" fill="#FFEDD5"/>
    <polygon points="-20,-30 20,-30 0,-42" fill="#F97316"/>
    <text x="0" y="6" font-size="22" text-anchor="middle">🎭</text>
    <text x="0" y="-62" font-size="11" font-weight="900" fill="#9A3412" text-anchor="middle">SÂN KHẤU</text>
    <text x="0" y="68" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">Cổng Đông (Nghệ thuật)</text>
  </g>

  <!-- ĐỊA DANH 4: QUẦY DỊCH VỤ & ĐỒ UỐNG (X=250, Y=450) -->
  <g transform="translate(250, 450)" filter="url(#softShadow)">
    <rect x="-42" y="-28" width="84" height="56" rx="10" fill="#FEF08A" stroke="#CA8A04" stroke-width="2"/>
    <rect x="-40" y="-26" width="16" height="14" fill="#EF4444"/>
    <rect x="-24" y="-26" width="16" height="14" fill="#FFFFFF"/>
    <rect x="-8" y="-26" width="16" height="14" fill="#EF4444"/>
    <rect x="8" y="-26" width="16" height="14" fill="#FFFFFF"/>
    <rect x="24" y="-26" width="16" height="14" fill="#EF4444"/>
    <text x="0" y="16" font-size="10" font-weight="800" fill="#854D0E" text-anchor="middle">🏪 QUẦY DỊCH VỤ</text>
    <text x="0" y="42" font-size="9.5" font-weight="600" fill="#713F12" text-anchor="middle">Giải khát & Thông tin</text>
  </g>

  <!-- ĐỊA DANH 5: KHU GHẾ ĐÁ NGHỈ CHÂN (X=450, Y=150) -->
  <g transform="translate(450, 150)" filter="url(#softShadow)">
    <rect x="-42" y="-25" width="84" height="50" rx="10" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
    <rect x="-35" y="-18" width="70" height="10" rx="3" fill="#D97706"/>
    <rect x="-35" y="4" width="70" height="10" rx="3" fill="#D97706"/>
    <text x="0" y="-32" font-size="10.5" font-weight="800" fill="#92400E" text-anchor="middle">🪑 GHẾ ĐÁ NGHỈ CHÂN</text>
    <text x="0" y="36" font-size="9" font-weight="600" fill="#78350F" text-anchor="middle">Khuôn viên bóng mát</text>
  </g>

  <!-- VỊ TRÍ THÙNG RÁC 1 (X=275, Y=220) -->
  <g transform="translate(275, 220)">
    <circle cx="0" cy="0" r="28" fill="#ECFDF5" stroke="#10B981" stroke-width="2.5" stroke-dasharray="5 3"/>
    <rect x="-16" y="-16" width="32" height="32" rx="8" fill="#10B981" opacity="0.15"/>
    <text x="0" y="-34" font-size="11" font-weight="900" fill="#047857" text-anchor="middle">🗑️ THÙNG 1</text>
    <text x="0" y="40" font-size="9.5" font-weight="700" fill="#065F46" text-anchor="middle">Vị trí EcoBin 1</text>
  </g>

  <!-- VỊ TRÍ THÙNG RÁC 2 (X=735, Y=380) -->
  <g transform="translate(735, 380)">
    <circle cx="0" cy="0" r="28" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2.5" stroke-dasharray="5 3"/>
    <rect x="-16" y="-16" width="32" height="32" rx="8" fill="#3B82F6" opacity="0.15"/>
    <text x="0" y="42" font-size="11" font-weight="900" fill="#1D4ED8" text-anchor="middle">🗑️ THÙNG 2</text>
    <text x="0" y="-34" font-size="9.5" font-weight="700" fill="#1E40AF" text-anchor="middle">Vị trí EcoBin 2</text>
  </g>

  <!-- Hàng cây xanh bóng mát hai bên phố đi bộ -->
  <g fill="#22C55E" stroke="#15803D" stroke-width="2" filter="url(#softShadow)">
    <circle cx="170" cy="205" r="16"/>
    <circle cx="370" cy="205" r="16"/>
    <circle cx="620" cy="205" r="16"/>
    <circle cx="800" cy="205" r="16"/>
    <circle cx="170" cy="395" r="16"/>
    <circle cx="370" cy="395" r="16"/>
    <circle cx="620" cy="395" r="16"/>
    <circle cx="800" cy="395" r="16"/>
  </g>
  <g fill="#15803D" opacity="0.3">
    <circle cx="170" cy="205" r="6"/>
    <circle cx="370" cy="205" r="6"/>
    <circle cx="620" cy="205" r="6"/>
    <circle cx="800" cy="205" r="6"/>
    <circle cx="170" cy="395" r="6"/>
    <circle cx="370" cy="395" r="6"/>
    <circle cx="620" cy="395" r="6"/>
    <circle cx="800" cy="395" r="6"/>
  </g>

  <!-- Đèn lồng trang trí phố đi bộ -->
  <g fill="#F59E0B" stroke="#78350F" stroke-width="1.5">
    <circle cx="210" cy="250" r="5"/>
    <circle cx="410" cy="250" r="5"/>
    <circle cx="590" cy="250" r="5"/>
    <circle cx="770" cy="250" r="5"/>
    <circle cx="210" cy="350" r="5"/>
    <circle cx="410" cy="350" r="5"/>
    <circle cx="590" cy="350" r="5"/>
    <circle cx="770" cy="350" r="5"/>
  </g>

  <!-- La bàn định hướng Bắc - Nam -->
  <g transform="translate(70, 75)">
    <circle cx="0" cy="0" r="26" fill="#FFFFFF" stroke="#94A3B8" stroke-width="2" filter="url(#softShadow)"/>
    <polygon points="0,-20 -5,-3 0,0" fill="#EF4444"/>
    <polygon points="0,-20 5,-3 0,0" fill="#DC2626"/>
    <polygon points="0,20 -5,3 0,0" fill="#64748B"/>
    <polygon points="0,20 5,3 0,0" fill="#475569"/>
    <text x="0" y="-23" font-size="9" font-weight="900" fill="#DC2626" text-anchor="middle">B (N)</text>
    <text x="0" y="30" font-size="8" font-weight="700" fill="#64748B" text-anchor="middle">N</text>
    <text x="25" y="3" font-size="8" font-weight="700" fill="#64748B" text-anchor="start">Đ</text>
    <text x="-25" y="3" font-size="8" font-weight="700" fill="#64748B" text-anchor="end">T</text>
  </g>

  <!-- Thước đo tỷ lệ mô hình -->
  <g transform="translate(60, 545)">
    <rect x="-10" y="-16" width="160" height="28" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" opacity="0.95"/>
    <line x1="0" y1="0" x2="140" y2="0" stroke="#0F172A" stroke-width="3"/>
    <line x1="0" y1="-5" x2="0" y2="5" stroke="#0F172A" stroke-width="3"/>
    <line x1="70" y1="-3" x2="70" y2="3" stroke="#0F172A" stroke-width="2"/>
    <line x1="140" y1="-5" x2="140" y2="5" stroke="#0F172A" stroke-width="3"/>
    <text x="0" y="-7" font-size="8" font-weight="700" fill="#475569">0m</text>
    <text x="65" y="-7" font-size="8" font-weight="700" fill="#475569">50m</text>
    <text x="125" y="-7" font-size="8" font-weight="700" fill="#475569">100m</text>
    <text x="70" y="10" font-size="8.5" font-weight="800" fill="#0F172A" text-anchor="middle">Tỷ lệ: 100m Phố đi bộ</text>
  </g>
</svg>`;

const PROMENADE_SVG_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PROMENADE_SVG_CONTENT)}`;

// COMPONENT BẢN ĐỒ LEAFLET CRS.SIMPLE VẼ 2D MÔ HÌNH PHỐ ĐI BỘ
function Esp32LeafletMapView({
  mapRef,
  userPoint,
  bins,
  selected,
  routeCoords,
  onSelectBin,
  onSetUserPoint,
}: {
  mapRef?: any;
  userPoint: PromenadePoint;
  bins: TrashCan[];
  selected: TrashCan | null;
  routeCoords: Array<[number, number]>;
  onSelectBin: (b: TrashCan) => void;
  onSetUserPoint: (x: number, y: number) => void;
}) {
  const localRef = useRef<any>(null);
  const activeRef = mapRef || localRef;

  const html = useMemo(() => {
    const userLat = 600 - userPoint.y;
    const userLng = userPoint.x;
    const cleanUserName = (userPoint.name || "Vị trí của bạn").replace(/['"\\]/g, "");

    const binsMarkersCode = bins
      .map((b) => {
        const isSel = selected?.TrashCanID === b.TrashCanID;
        const coords = getBinPromenadeCoords(b);
        const bLat = 600 - coords.y;
        const bLng = coords.x;
        const isOnline = b.Status === "Online";
        const fill = Math.round(Number(b.FillLevel || 0));
        const orgFill = Math.round(Number(b.OrganicFillLevel || 0));
        const inorgFill = Math.round(Number(b.InorganicFillLevel || 0));
        const pinColor = !isOnline
          ? "#64748B"
          : fill >= 85
          ? "#EF4444"
          : fill >= 60
          ? "#F59E0B"
          : "#10B981";
        const cleanName = sanitizeVietnamese(b.Name || "Thùng rác").replace(/['"\\]/g, "");
        const cleanMac = (b.MacAddress || "ESP32").replace(/['"\\]/g, "");
        const cleanLoc = sanitizeVietnamese(b.LocationName || "EcoBin").replace(/['"\\]/g, "");
        const cleanEspIp = b.EspIp || (b.TrashCanID === 1 ? "192.168.106.140" : "192.168.106.61");
        const orgLid =
          b.OrganicLidState === "Open" || b.OrganicLidState === "Mở" ? "Mở" : "Đóng";
        const inorgLid =
          b.InorganicLidState === "Open" || b.InorganicLidState === "Mở" ? "Mở" : "Đóng";

        return `
          (function() {
            var pinHtml = '<div class="esp-pin-container ${isSel ? "esp-pin-active" : ""}">' +
              '<div class="esp-pin-title">${cleanName} (${fill}%)</div>' +
              '<div class="esp-pin-marker" style="background-color: ${pinColor};">' +
                '<div class="esp-pin-inner">🗑️</div>' +
              '</div>' +
              '<div class="esp-pin-arrow" style="border-top-color: ${pinColor};"></div>' +
            '</div>';

            var icon = L.divIcon({
              className: '',
              html: pinHtml,
              iconSize: [140, 60],
              iconAnchor: [70, 58],
              popupAnchor: [0, -58]
            });

            var m = L.marker([${bLat}, ${bLng}], { icon: icon, zIndexOffset: ${isSel ? 1000 : 300} }).addTo(map);
            m.on('click', function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_BIN', id: ${b.TrashCanID} }));
              }
            });

            m.bindPopup(
              "<b>${cleanName} · ${cleanMac}</b>" +
              "<div style='color:#1A73E8;font-size:11.5px;font-weight:bold;margin-top:2px;'>🌐 IP ESP32: <b>${cleanEspIp}</b></div>" +
              "<div style='color:#475569;font-size:11px;margin-top:2px;'>Trạng thái: <b>${isOnline ? '🟢 Hoạt động' : '⚪ Ngoại tuyến'}</b> · Dung lượng: <b>${fill}%</b></div>" +
              "<div style='color:#059669;font-size:11px;margin-top:3px;'>🌱 Hữu cơ: <b>${orgFill}%</b> (${orgLid}) · 🥤 Vô cơ: <b>${inorgFill}%</b> (${inorgLid})</div>" +
              "<div style='color:#64748B;font-size:11px;margin-top:2px;'>📍 ${cleanLoc}</div>" +
              "<div style='margin-top:8px;'>" +
                "<button onclick=\\"window.postSelectBin(${b.TrashCanID})\\" style='background:#10B981;color:#FFFFFF;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:bold;cursor:pointer;width:100%;box-shadow:0 2px 5px rgba(0,0,0,0.15);'>🚶 Dẫn đường tới thùng này</button>" +
              "</div>"
            );
            ${isSel ? "m.openPopup();" : ""}
          })();
        `;
      })
      .join("\n");

    const routeCode =
      routeCoords.length > 1
        ? `
        (function() {
          var coords = ${JSON.stringify(routeCoords)};
          // Đường sáng tỏa ngoài
          L.polyline(coords, {
            color: '#10B981',
            weight: 10,
            opacity: 0.35,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          // Đường nét đứt hoạt họa chuyển động
          var poly = L.polyline(coords, {
            color: '#059669',
            weight: 5,
            opacity: 0.95,
            dashArray: '10, 10',
            className: 'walking-route-line',
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
        })();
      `
        : ``;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          html, body, #map { width:100%; height:100%; background:#F1F5F9; font-family:-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif; }

          /* User Beacon */
          .user-marker-wrap {
            position: relative;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .user-pulse {
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(37, 99, 235, 0.35);
            animation: userPulse 1.8s infinite ease-out;
          }
          @keyframes userPulse {
            0% { transform: scale(0.6); opacity: 1; }
            100% { transform: scale(1.6); opacity: 0; }
          }
          .user-dot {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: #2563EB;
            color: #FFFFFF;
            font-size: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 3px 8px rgba(0,0,0,0.35);
            z-index: 2;
          }
          .user-label {
            position: absolute;
            top: 34px;
            background: #1E293B;
            color: #FFFFFF;
            font-size: 10px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 10px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          }

          /* Trash can pin */
          .esp-pin-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            transition: transform 0.15s ease-out;
          }
          .esp-pin-active { transform: scale(1.22); z-index: 9999; }
          .esp-pin-title {
            background: #FFFFFF;
            color: #1E293B;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 12px;
            border: 1.5px solid rgba(0,0,0,0.15);
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            white-space: nowrap;
            margin-bottom: 2px;
          }
          .esp-pin-active .esp-pin-title {
            background: #10B981;
            color: #FFFFFF;
            border-color: #059669;
          }
          .esp-pin-marker {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          }
          .esp-pin-inner { font-size: 16px; }
          .esp-pin-arrow {
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 7px solid #10B981;
            margin-top: -1px;
          }

          /* Animated Walking Line */
          @keyframes marchingDashes {
            to { stroke-dashoffset: -40px; }
          }
          .walking-route-line path {
            animation: marchingDashes 1.2s linear infinite;
          }

          .leaflet-popup-content-wrapper {
            border-radius: 14px;
            box-shadow: 0 4px 18px rgba(0,0,0,0.25);
            padding: 4px;
          }
          .leaflet-popup-content {
            margin: 8px 12px;
            font-size: 12px;
            line-height: 1.45;
            color: #1E293B;
          }
          .leaflet-popup-content b {
            color: #0F172A;
            font-size: 13px;
            display: block;
            margin-bottom: 2px;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var bounds = [[0, 0], [600, 1000]];
          var map = L.map('map', {
            crs: L.CRS.Simple,
            minZoom: -1.2,
            maxZoom: 2,
            zoomSnap: 0.1,
            zoomDelta: 0.5,
            attributionControl: false,
            maxBounds: [[-60, -60], [660, 1060]],
            maxBoundsViscosity: 0.8
          });

          window.map = map;

          var svgOverlay = L.imageOverlay("${PROMENADE_SVG_URI}", bounds).addTo(map);
          map.fitBounds(bounds, { padding: [10, 10] });

          // Marker người dùng
          var userHtml = '<div class="user-marker-wrap">' +
            '<div class="user-pulse"></div>' +
            '<div class="user-dot">📍</div>' +
            '<div class="user-label">${cleanUserName}</div>' +
          '</div>';

          var userIcon = L.divIcon({
            className: '',
            html: userHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
          });

          window.userMarker = L.marker([${userLat}, ${userLng}], { icon: userIcon, zIndexOffset: 9999 })
            .addTo(map)
            .bindPopup("<b>📍 ${cleanUserName}</b><div style='color:#64748B;font-size:11px;'>Tọa độ 2D: X=${userPoint.x}, Y=${userPoint.y}</div>");

          // Chạm vào bất kỳ điểm nào trên bản đồ để đặt vị trí người dùng
          map.on('click', function(e) {
            var x = Math.round(e.latlng.lng);
            var y = Math.round(600 - e.latlng.lat);
            x = Math.max(30, Math.min(970, x));
            y = Math.max(30, Math.min(570, y));
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SET_USER_POINT',
                x: x,
                y: y
              }));
            }
          });

          window.postSelectBin = function(id) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_BIN', id: id }));
            }
          };

          window.panToPoint = function(x, y) {
            if (window.map) {
              window.map.panTo([600 - y, x], { animate: true, duration: 0.6 });
            }
          };

          ${binsMarkersCode}
          ${routeCode}
        </script>
      </body>
      </html>
    `;
  }, [userPoint.x, userPoint.y, userPoint.name, bins, selected?.TrashCanID, routeCoords]);

  const WebViewComp = WebView as any;

  return (
    <WebViewComp
      ref={activeRef}
      originWhitelist={["*"]}
      source={{ html, baseUrl: "https://localhost" }}
      style={{ flex: 1, backgroundColor: "#F1F5F9" }}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      allowsInlineMediaPlayback
      startInLoadingState
      renderLoading={() => (
        <View
          style={[
            { justifyContent: "center", alignItems: "center", backgroundColor: "#F1F5F9" },
            StyleSheet.absoluteFill,
          ]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ fontSize: 11, color: colors.sub, marginTop: 6 }}>
            Đang nạp Bản đồ Phố đi bộ...
          </Text>
        </View>
      )}
      onMessage={(event: any) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === "SELECT_BIN") {
            const found = bins.find((b) => b.TrashCanID === Number(data.id));
            if (found) onSelectBin(found);
          } else if (data.type === "SET_USER_POINT") {
            onSetUserPoint(data.x, data.y);
          }
        } catch {}
      }}
    />
  );
}

export function Esp32MapScreen({ navigation }: any) {
  const mapRef = useRef<any>(null);
  const [bins, setBins] = useState<TrashCan[]>(DEMO_TRASH_CANS);
  const [userPoint, setUserPoint] = useState<PromenadePoint>({
    x: 90,
    y: 300,
    name: "Cổng chào Phố đi bộ (Tây)",
  });
  const [selected, setSelected] = useState<TrashCan | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadBins = useCallback(async () => {
    try {
      const data = await api.get<TrashCan[]>("/api/trashcans");
      if (Array.isArray(data) && data.length > 0) {
        setBins(data);
      }
    } catch {
      // Giữ DEMO_TRASH_CANS
    }
  }, []);

  useEffect(() => {
    loadBins();
    const interval = setInterval(loadBins, 8000);
    return () => clearInterval(interval);
  }, [loadBins]);

  // Tự động chọn Thùng 1 nếu chưa chọn
  const activeSelectedBin = selected || bins[0] || null;

  // Tính toán dẫn đường tới Thùng 1 và Thùng 2
  const bin1 = bins.find((b) => b.TrashCanID === 1) || bins[0];
  const bin2 = bins.find((b) => b.TrashCanID === 2) || bins[1] || bins[0];

  const route1 = useMemo(() => {
    if (!bin1) return null;
    return calculatePromenadeRoute(userPoint, getBinPromenadeCoords(bin1));
  }, [userPoint, bin1]);

  const route2 = useMemo(() => {
    if (!bin2) return null;
    return calculatePromenadeRoute(userPoint, getBinPromenadeCoords(bin2));
  }, [userPoint, bin2]);

  const activeRoute = useMemo(() => {
    if (!activeSelectedBin) return null;
    return calculatePromenadeRoute(userPoint, getBinPromenadeCoords(activeSelectedBin));
  }, [userPoint, activeSelectedBin]);

  const handleSelectLandmark = (lm: PromenadeLandmark) => {
    setUserPoint({
      x: lm.x,
      y: lm.y,
      name: lm.name,
    });
    mapRef.current?.injectJavaScript(`
      if (typeof window.panToPoint === 'function') {
        window.panToPoint(${lm.x}, ${lm.y});
      }
      true;
    `);
  };

  const handleSetUserPoint = (x: number, y: number) => {
    // Xác định tên gần địa danh nào nhất
    let closestName = `Tọa độ X:${x}, Y:${y}`;
    let minD = 99999;
    for (const lm of PROMENADE_LANDMARKS) {
      const d = Math.hypot(lm.x - x, lm.y - y);
      if (d < minD) {
        minD = d;
        if (d <= 70) {
          closestName = `Gần ${lm.name}`;
        }
      }
    }

    setUserPoint({
      x,
      y,
      name: closestName,
    });
  };

  const handleSelectBin = (bin: TrashCan) => {
    setSelected(bin);
    const coords = getBinPromenadeCoords(bin);
    mapRef.current?.injectJavaScript(`
      if (typeof window.panToPoint === 'function') {
        window.panToPoint(${coords.x}, ${coords.y});
      }
      true;
    `);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBins();
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        title="Vị trí thùng rác"
        subtitle="Bản đồ Phố đi bộ · Định vị & Dẫn đường thời gian thực"
      />

      {/* BANNER VỊ TRÍ XUẤT PHÁT CỦA BẠN */}
      <View style={s.mapTopInfo}>
        <Ionicons name="walk" color={colors.primary} size={22} />
        <View style={{ flex: 1 }}>
          <Text style={s.mapAddressTitle}>ĐIỂM XUẤT PHÁT CỦA BẠN TRÊN PHỐ</Text>
          <Text style={[s.mapAddress, { fontWeight: "700", color: colors.text }]}>
            {userPoint.name} (X: {userPoint.x}, Y: {userPoint.y})
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleSelectLandmark(PROMENADE_LANDMARKS[0])}
          style={s.locateSmall}
          accessibilityLabel="Về Cổng chào"
        >
          <Ionicons name="refresh" color={colors.primary} size={18} />
        </TouchableOpacity>
      </View>

      {/* THANH CHỌN NHANH ĐỊA DANH PHỐ ĐI BỘ */}
      <View style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11.5, fontWeight: "800", color: colors.sub, marginBottom: 6 }}>
          CHỌN NHANH NƠI BẠN ĐANG ĐỨNG:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PROMENADE_LANDMARKS.map((lm) => {
            const isMatch = Math.hypot(userPoint.x - lm.x, userPoint.y - lm.y) < 35;
            return (
              <TouchableOpacity
                key={lm.id}
                onPress={() => handleSelectLandmark(lm)}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 12,
                  backgroundColor: isMatch ? colors.primary : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: isMatch ? colors.primary : colors.line,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Ionicons
                  name={lm.icon}
                  size={15}
                  color={isMatch ? "#FFFFFF" : colors.primary}
                />
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: isMatch ? "800" : "600",
                    color: isMatch ? "#FFFFFF" : colors.text,
                  }}
                >
                  {lm.shortName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* KHUNG BẢN ĐỒ MÔ PHỎNG PHỐ ĐI BỘ (LEAFLET CRS.SIMPLE) */}
      <View style={s.realMapFrame}>
        <SafeMapErrorBoundary>
          <Esp32LeafletMapView
            mapRef={mapRef}
            userPoint={userPoint}
            bins={bins}
            selected={activeSelectedBin}
            routeCoords={activeRoute?.leafletCoords || []}
            onSelectBin={handleSelectBin}
            onSetUserPoint={handleSetUserPoint}
          />
        </SafeMapErrorBoundary>

        {/* Nút reset về Cổng chào */}
        <TouchableOpacity
          style={{
            position: "absolute",
            right: 12,
            bottom: 46,
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: "#FFFFFF",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 6,
            zIndex: 999,
          }}
          onPress={() => handleSelectLandmark(PROMENADE_LANDMARKS[0])}
          activeOpacity={0.8}
        >
          <Ionicons name="home-outline" size={20} color={colors.primary} />
        </TouchableOpacity>

        <View style={s.mapOverlayTag}>
          <Ionicons name="finger-print" size={13} color={colors.primary} />
          <Text style={s.mapOverlayText}>
            Chạm điểm bất kỳ trên phố để đặt vị trí · Chạm thùng rác để dẫn đường
          </Text>
        </View>
      </View>

      {/* SO SÁNH NHANH KHOẢNG CÁCH 2 THÙNG RÁC */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 10 }}>
        {/* CARD THÙNG 1 */}
        {bin1 && route1 ? (
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.85}
            onPress={() => handleSelectBin(bin1)}
          >
            <Card
              style={{
                padding: 10,
                borderWidth: activeSelectedBin?.TrashCanID === 1 ? 2 : 1,
                borderColor: activeSelectedBin?.TrashCanID === 1 ? colors.primary : colors.line,
                backgroundColor: activeSelectedBin?.TrashCanID === 1 ? "#F2FAF5" : "#FFFFFF",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "900", color: colors.text }}>
                  {sanitizeVietnamese(bin1.Name)}
                </Text>
                {route2 && route1.distanceMeters <= route2.distanceMeters && (
                  <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#15803D" }}>Gần nhất ⚡</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 11, color: colors.sub, marginTop: 3 }}>
                Phía Tây (Gần Cổng)
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                <Ionicons name="footsteps" size={13} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "900", color: colors.primary }}>
                  {route1.distanceMeters} m
                </Text>
                <Text style={{ fontSize: 10.5, color: colors.sub }}>
                  ({route1.steps} bước · {route1.durationText})
                </Text>
              </View>
              <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 10.5, color: colors.sub }}>
                  Đầy: <Text style={{ fontWeight: "800", color: colors.text }}>{Math.round(bin1.FillLevel || 0)}%</Text>
                </Text>
                <Text style={{ fontSize: 9.5, color: colors.primary, fontWeight: "700" }}>
                  {bin1.EspIp || "192.168.106.140"}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        ) : null}

        {/* CARD THÙNG 2 */}
        {bin2 && route2 ? (
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.85}
            onPress={() => handleSelectBin(bin2)}
          >
            <Card
              style={{
                padding: 10,
                borderWidth: activeSelectedBin?.TrashCanID === 2 ? 2 : 1,
                borderColor: activeSelectedBin?.TrashCanID === 2 ? colors.primary : colors.line,
                backgroundColor: activeSelectedBin?.TrashCanID === 2 ? "#F2FAF5" : "#FFFFFF",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "900", color: colors.text }}>
                  {sanitizeVietnamese(bin2.Name)}
                </Text>
                {route1 && route2.distanceMeters < route1.distanceMeters && (
                  <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#15803D" }}>Gần nhất ⚡</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 11, color: colors.sub, marginTop: 3 }}>
                Phía Đông (Gần Sân khấu)
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                <Ionicons name="footsteps" size={13} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "900", color: colors.primary }}>
                  {route2.distanceMeters} m
                </Text>
                <Text style={{ fontSize: 10.5, color: colors.sub }}>
                  ({route2.steps} bước · {route2.durationText})
                </Text>
              </View>
              <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 10.5, color: colors.sub }}>
                  Đầy: <Text style={{ fontWeight: "800", color: colors.text }}>{Math.round(bin2.FillLevel || 0)}%</Text>
                </Text>
                <Text style={{ fontSize: 9.5, color: colors.primary, fontWeight: "700" }}>
                  {bin2.EspIp || "192.168.106.61"}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* CHI TIẾT DẪN ĐƯỜNG & TRẠNG THÁI THÙNG ĐANG CHỌN */}
      {activeSelectedBin && activeRoute ? (
        <Card style={{ marginTop: 4, borderColor: colors.primary, borderWidth: 1.5, backgroundColor: "#F7FBF8" }}>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="trash" size={18} color={colors.primary} />
                <Text style={{ fontSize: 14.5, fontWeight: "900", color: colors.primary }}>
                  {sanitizeVietnamese(activeSelectedBin.Name)} · {activeSelectedBin.MacAddress || "ESP32"}
                </Text>
              </View>
              <Text style={[s.smallMuted, { marginTop: 2 }]}>
                {sanitizeVietnamese(activeSelectedBin.LocationName) || "Phố đi bộ mô hình"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                <Ionicons name="hardware-chip-outline" size={13} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>
                  IP ESP32: {activeSelectedBin.EspIp || (activeSelectedBin.TrashCanID === 1 ? "192.168.106.140" : "192.168.106.61")}
                </Text>
              </View>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: activeSelectedBin.Status === "Online" ? "#DCFCE7" : "#F1F5F9",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: activeSelectedBin.Status === "Online" ? "#16A34A" : "#64748B",
                }}
              >
                {activeSelectedBin.Status === "Online" ? "🟢 Online" : "⚪ Offline"}
              </Text>
            </View>
          </View>

          {/* BANNER HƯỚNG DẪN ĐI BỘ TRÊN PHỐ */}
          <View
            style={{
              marginTop: 10,
              padding: 10,
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#D1FAE5",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#E7F5EC",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="navigate" size={17} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>
                  LỘ TRÌNH ĐI BỘ: {activeRoute.distanceMeters} MÉT (~{activeRoute.steps} BƯỚC)
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.text, marginTop: 2, lineHeight: 16 }}>
                  {activeSelectedBin.TrashCanID === 1
                    ? "🚶 Đi dọc trục chính phố đi bộ hướng Tây, rẽ vào vịnh Thùng 1 (kế bên Quầy dịch vụ đồ uống)."
                    : "🚶 Đi dọc trục chính qua Đài phun nước trung tâm về phía Đông, rẽ vào vịnh Thùng 2 (trước Sân khấu)."}
                </Text>
              </View>
            </View>
          </View>

          {/* CHI TIẾT MỨC ĐẦY 2 NGĂN */}
          <View style={{ marginTop: 10, gap: 8 }}>
            <View
              style={{
                backgroundColor: "#FFFFFF",
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                  🌱 Ngăn 1 · Rác Hữu cơ (Nắp: {formatLid(activeSelectedBin.OrganicLidState)})
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>
                  {activeSelectedBin.OrganicFillLevel || 0}%
                </Text>
              </View>
              <ProgressBar value={(Number(activeSelectedBin.OrganicFillLevel) || 0) / 100} />
            </View>

            <View
              style={{
                backgroundColor: "#FFFFFF",
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.blue }}>
                  🥤 Ngăn 2 · Rác Vô cơ (Nắp: {formatLid(activeSelectedBin.InorganicLidState)})
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.blue }}>
                  {activeSelectedBin.InorganicFillLevel || 0}%
                </Text>
              </View>
              <ProgressBar value={(Number(activeSelectedBin.InorganicFillLevel) || 0) / 100} />
            </View>
          </View>

          {/* NÚT THAO TÁC */}
          <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title={
                  activeSelectedBin.TrashCanID === 1
                    ? "Dẫn đường Thùng 2 ➔"
                    : "➔ Dẫn đường Thùng 1"
                }
                icon="swap-horizontal"
                outline
                onPress={() => {
                  const other = bins.find((b) => b.TrashCanID !== activeSelectedBin.TrashCanID);
                  if (other) handleSelectBin(other);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Đứng tại thùng này"
                icon="pin"
                onPress={() => {
                  const c = getBinPromenadeCoords(activeSelectedBin);
                  setUserPoint({
                    x: c.x,
                    y: c.y,
                    name: `Tại ${sanitizeVietnamese(activeSelectedBin.Name)}`,
                  });
                }}
              />
            </View>
          </View>
        </Card>
      ) : null}

      {/* DANH SÁCH THÙNG RÁC TRÊN PHỐ ĐI BỘ */}
      <View style={{ marginTop: 14, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>
          Vị trí & Trạng thái các thùng trên Phố đi bộ ({bins.length})
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {bins.map((bin) => {
          const isSel = activeSelectedBin?.TrashCanID === bin.TrashCanID;
          const isOnline = bin.Status === "Online";
          const coords = getBinPromenadeCoords(bin);
          const r = calculatePromenadeRoute(userPoint, coords);

          return (
            <TouchableOpacity
              key={bin.TrashCanID}
              activeOpacity={0.88}
              onPress={() => handleSelectBin(bin)}
            >
              <Card
                style={[
                  { padding: 12 },
                  isSel && { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: "#F7FBF8" },
                ]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isOnline ? "#E7F5EC" : "#F1F5F9",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons
                        name="trash"
                        size={20}
                        color={isOnline ? colors.primary : "#64748B"}
                      />
                    </View>
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: "900", color: colors.text }}>
                          {sanitizeVietnamese(bin.Name)}
                        </Text>
                        <Pill
                          label={isOnline ? "Online" : "Offline"}
                          kind={isOnline ? "success" : "neutral"}
                        />
                      </View>
                      <Text style={{ fontSize: 11, color: colors.sub, marginTop: 2 }}>
                        🌐 IP:{" "}
                        <Text style={{ fontWeight: "700", color: colors.primary }}>
                          {bin.EspIp || (bin.TrashCanID === 1 ? "192.168.106.140" : "192.168.106.61")}
                        </Text>{" "}
                        · Cách bạn: <Text style={{ fontWeight: "800", color: colors.text }}>{r.distanceMeters} m</Text> ({r.steps} bước)
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.sub} />
                </View>

                {/* Progress bars mini */}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <View style={{ flex: 1, backgroundColor: "#F8FAFC", padding: 6, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, color: colors.sub, fontWeight: "600" }}>Hữu cơ</Text>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary, marginVertical: 2 }}>
                      {bin.OrganicFillLevel || 0}%
                    </Text>
                    <ProgressBar value={(Number(bin.OrganicFillLevel) || 0) / 100} />
                  </View>
                  <View style={{ flex: 1, backgroundColor: "#F8FAFC", padding: 6, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, color: colors.sub, fontWeight: "600" }}>Vô cơ</Text>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: colors.blue, marginVertical: 2 }}>
                      {bin.InorganicFillLevel || 0}%
                    </Text>
                    <ProgressBar value={(Number(bin.InorganicFillLevel) || 0) / 100} />
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ height: 25 }} />
    </Screen>
  );
}

export const RecyclingMapScreen = Esp32MapScreen;

export function NotificationsScreen({ navigation }: any) {
  const { notifications: localItems, lastScanImage, markRead } = useApp();
  const [serverItems, setServerItems] = useState<any[]>([]); const [bins, setBins] = useState<TrashCan[]>([]); const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const load = useCallback(async () => {
    const [eventsResult, cansResult] = await Promise.allSettled([api.get<any[]>("/api/bin-events"), api.get<TrashCan[]>("/api/trashcans")]);
    setServerItems(eventsResult.status === "fulfilled" && Array.isArray(eventsResult.value) ? eventsResult.value : []);
    setBins(cansResult.status === "fulfilled" && Array.isArray(cansResult.value) ? cansResult.value : []);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  const alerts: AppNotification[] = useMemo(() => {
    const generated: AppNotification[] = bins.flatMap((c) => {
      const items: AppNotification[] = [];
      if ((c.FillLevel || 0) >= 80) items.push({ id: `fill-${c.TrashCanID}`, title: "Thùng rác sắp đầy", message: `${c.Name} đã đạt ${Math.round(c.FillLevel || 0)}% dung lượng.`, type: "full", createdAt: c.RecordedAt || new Date().toISOString() });
      return items;
    });
    const server: AppNotification[] = serverItems.map((e) => ({ id: `event-${e.EventID}`, title: e.DetectedLabel ? `Phát hiện: ${e.DetectedLabel}` : "Thùng rác phát hiện vật thể", message: `${e.Category || "Chưa phân loại"} · ${e.MacAddress || "EcoBin"}`, type: "bin-event", createdAt: e.CreatedAt || new Date().toISOString(), imageUrl: e.ImageUrl, detectedLabel: e.DetectedLabel, category: e.Category, confidence: e.Confidence, binCompartment: e.BinCompartment, instructions: e.Instructions || [], disposalMethod: e.DisposalMethod, note: e.Note }));
    const merged = new Map<string, AppNotification>();
    [...localItems, ...server, ...generated].forEach((item) => merged.set(item.id, item));
    return [...merged.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bins, localItems, serverItems]);
  const refresh = async () => { setLoading(true); setVisibleCount(10); await load(); setLoading(false); };
  const onOpen = (item: AppNotification) => { markRead(item.id); if (item.type === "bin-event") navigation.navigate("BinDetection", { event: item, imageUri: item.imageUrl || lastScanImage }); };
  return <Screen><Header title="Thông báo" subtitle="Cập nhật mới nhất từ Nhóm 4" action="Làm mới" onAction={refresh} showBack onBack={() => { if (navigation?.canGoBack?.()) navigation.goBack(); else navigation?.navigate("MainTabs"); }}/><FlatList data={alerts.slice(0, visibleCount)} scrollEnabled={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh}/>} keyExtractor={(item, index) => `${item.id}-${index}`} ListEmptyComponent={<EmptyState title="Chưa có thông báo" description="Khi thùng rác đầy hoặc có vật thể được camera ghi nhận, thông báo sẽ xuất hiện tại đây." icon="notifications-outline"/>} ListFooterComponent={visibleCount < alerts.length ? <TouchableOpacity onPress={() => setVisibleCount((n) => n + 10)} style={{ padding: 14, alignItems: "center" }}><Text style={s.actionText}>Tải thêm thông báo ({alerts.length - visibleCount} còn lại)</Text></TouchableOpacity> : undefined} renderItem={({ item }) => {
      const icon = item.type === "full" ? "trash-outline" : item.type === "bin-event" ? "camera-outline" : "checkmark-circle-outline";
      const bg = item.type === "full" ? "#FFF2DF" : "#E6F5EB";
      const uri = item.imageUrl ? (item.imageUrl.startsWith("http") || item.imageUrl.startsWith("file:") ? item.imageUrl : `${API_URL}${item.imageUrl}`) : (item.type === "bin-event" ? lastScanImage || undefined : undefined);
      return <TouchableOpacity activeOpacity={0.87} onPress={() => onOpen(item)}><Card style={s.notificationCard}><View style={[s.notificationIcon, { backgroundColor: bg }]}><Ionicons name={icon as any} size={20} color={colors.primary}/></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.bodyText}>{item.message}</Text><Text style={s.smallMuted}>{new Date(item.createdAt).toLocaleString()}</Text></View>{uri ? <Image source={{ uri }} style={s.notificationImage}/> : null}</Card></TouchableOpacity>;
    }}/><View style={s.notice}><Ionicons name="camera-outline" size={17} color={colors.primary}/><Text style={s.noticeText}>Để thông báo camera có ảnh thật, Raspberry Pi cần gửi sự kiện và ảnh tới POST /api/bin-events.</Text></View></Screen>;
}

export function AccountScreen({ navigation }: any) {
  const { user, logout, demoMode } = useApp();
  const [records, setRecords] = useState<any[]>([]);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  useEffect(() => {
    api.get<any[]>(`/api/waste-records${user?.id ? `?userId=${user.id}` : ""}`)
      .then((v) => setRecords(Array.isArray(v) ? v : []))
      .catch(() => setRecords([]));
  }, [user?.id]);

  const openZalo = () => {
    const phone = "0986540853";
    const zaloUrl = `https://zalo.me/${phone}`;
    Linking.openURL(zaloUrl).catch(() => {
      Alert.alert("Hỗ trợ Zalo", `Vui lòng liên hệ hỗ trợ trực tiếp qua số Zalo: ${phone}`);
    });
  };

  const showPrivacyPolicy = () => {
    Alert.alert(
      "🔒 Chính sách quyền riêng tư Nhóm 4",
      "1. Dữ liệu hình ảnh:\n" +
      "• Ảnh chụp từ camera điện thoại hoặc camera thùng rác chỉ được dùng cho mục đích nhận diện và phân loại rác.\n" +
      "• Đảm bảo an toàn và bảo mật dữ liệu.\n\n" +
      "2. Bảo mật tài khoản:\n" +
      "• Mật khẩu được mã hóa an toàn bằng thuật toán Scrypt chuẩn quốc tế trước khi lưu vào SQL Server.\n" +
      "• Nhóm 4 cam kết không chia sẻ dữ liệu người dùng với bất kỳ bên thứ ba nào.\n\n" +
      "3. Quyền của bạn:\n" +
      "• Bạn có thể xem lịch sử phân loại, quản lý thiết bị và xóa dữ liệu bất kỳ lúc nào qua Zalo hỗ trợ.",
      [{ text: "Đã hiểu", style: "default" }]
    );
  };

  const showUserGuide = () => {
    Alert.alert(
      "📖 Hướng dẫn sử dụng thùng rác Nhóm 4",
      "1. Vận hành tự động:\n" +
      "• Đưa tay hoặc rác lại gần nắp thùng trong cự ly <= 30cm.\n" +
      "• Camera thùng sẽ tự động chụp và AI YOLO (best.pt) nhận diện loại rác.\n" +
      "• Nắp Ngăn 1 (Hữu cơ) hoặc Ngăn 2 (Vô cơ) sẽ tự mở trong 5 giây rồi tự đóng lại.\n\n" +
      "2. Sử dụng App điện thoại:\n" +
      "• Mục 'Thùng rác': Giám sát độ đầy 2 thùng rác (Thùng 1 & Thùng 2) theo thời gian thực.\n" +
      "• Mục 'Vị trí thùng rác': Tra cứu và định vị vị trí các thùng rác theo thời gian thực.",
      [{ text: "Đã hiểu", style: "default" }]
    );
  };

  const settingRows = [
    { icon: "book-outline", label: "Hướng dẫn sử dụng hệ thống", onPress: showUserGuide },
    { icon: "shield-checkmark-outline", label: "Quyền riêng tư & Bảo mật dữ liệu", onPress: showPrivacyPolicy },
    { icon: "chatbubble-ellipses-outline", label: "Trợ giúp & Hỗ trợ qua Zalo (0986540853)", onPress: openZalo, isZalo: true },
    { icon: "hardware-chip-outline", label: "Thiết bị & Cấu hình IP máy chủ, CSDL", onPress: () => setDeviceModalVisible(true) },
    { icon: "time-outline", label: "Lịch sử các lượt phân loại rác", onPress: () => Alert.alert("Lịch sử phân loại", `Bạn đã thực hiện ${records.length} lượt phân loại rác qua hệ thống.`) },
  ];

  return (
    <Screen>
      <Header
        title="Tài khoản"
        subtitle="Quản lý hồ sơ và hoạt động xanh"
        showBack
        onBack={() => {
          if (navigation?.canGoBack?.()) navigation.goBack();
          else navigation?.navigate("MainTabs");
        }}
      />
      <Card style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(user?.fullName || "A").charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{user?.fullName || "Admin Nhóm 4"}</Text>
          <Text style={s.smallMuted}>{user?.email || "admin@nhom4.vn"}</Text>
          <Pill label={user?.email === "admin@nhom4.vn" ? "Quản trị viên (Admin)" : (demoMode ? "Demo Member" : "Eco Member")} />
        </View>
      </Card>

      <SectionTitle title="Thống kê của bạn" />
      <View style={s.statsRow}>
        <Stat value={`${records.length} lượt`} label="Phân loại thành công" />
        <Stat value="2 thùng" label="EcoBin 1 & 2" />
        <Stat value="Online" label="AI best.pt" />
      </View>

      <SectionTitle title="Cài đặt & Hỗ trợ kỹ thuật" />
      {settingRows.map((item) => (
        <TouchableOpacity key={item.label} onPress={item.onPress}>
          <Card style={s.settingRow}>
            <Ionicons name={item.icon as any} size={20} color={item.isZalo ? "#0068FF" : colors.primary} />
            <Text style={{ flex: 1, color: colors.text, fontSize: 12, fontWeight: item.isZalo ? "800" : "600" }}>
              {item.label}
            </Text>
            {item.isZalo ? (
              <View style={{ backgroundColor: "#0068FF", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>ZALO</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.sub} />
            )}
          </Card>
        </TouchableOpacity>
      ))}

      <View style={{ height: 10 }} />
      <PrimaryButton
        title="Đăng xuất"
        outline
        icon="log-out-outline"
        onPress={() => Alert.alert("Đăng xuất", "Bạn muốn đăng xuất khỏi Nhóm 4?", [
          { text: "Hủy", style: "cancel" },
          { text: "Đăng xuất", style: "destructive", onPress: logout },
        ])}
      />
      <DeviceConfigModal visible={deviceModalVisible} onClose={() => setDeviceModalVisible(false)} />
    </Screen>
  );
}
function Stat({ value, label }: { value: string; label: string }) { return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.smallMuted}>{label}</Text></View>; }

const s = StyleSheet.create({
  binSwitcher: { flexDirection: "row", gap: 10, marginBottom: 14 },
  binTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: colors.line },
  binTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  binTabText: { fontSize: 12, fontWeight: "800", color: colors.text },
  binTabTextActive: { color: "#FFFFFF" },
  homeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }, greeting: { fontSize: 18, fontWeight: "900", color: colors.text }, subtitle: { color: colors.sub, fontSize: 11, marginTop: 4 }, bell: { width: 40, height: 40, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F6ED" }, badgeDot: { position: "absolute", top: 8, right: 8, height: 7, width: 7, borderRadius: 4, backgroundColor: colors.danger },
  hero: { backgroundColor: colors.primary, borderRadius: 21, padding: 19, flexDirection: "row", alignItems: "center", marginBottom: 13 }, heroLabel: { color: "#C9F0D6", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }, heroValue: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", marginTop: 8 }, heroSub: { color: "#E0F5E7", fontSize: 10, marginTop: 3 }, heroIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFFFFF20", alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, binTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10 }, binIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.pale, justifyContent: "center", alignItems: "center" }, smallMuted: { color: colors.sub, fontSize: 10, marginTop: 4 }, fillNumber: { color: colors.text, fontSize: 23, fontWeight: "900", marginVertical: 8 }, demoHint: { color: colors.warn, fontSize: 10, marginTop: -2, marginBottom: 8 }, quickRow: { flexDirection: "row", gap: 9 }, quickTile: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, minHeight: 112, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, quickIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center", marginBottom: 8 }, quickTitle: { color: colors.text, fontSize: 11, fontWeight: "800" }, quickSub: { color: colors.sub, fontSize: 9, marginTop: 4, textAlign: "center" }, tipCard: { marginTop: 15, borderRadius: 15, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", padding: 13, gap: 10 }, tipIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFF3D9", alignItems: "center", justifyContent: "center" }, tipTitle: { color: colors.text, fontSize: 11, fontWeight: "800" }, tipSub: { color: colors.sub, fontSize: 10, marginTop: 4, lineHeight: 15 },
  notice: { backgroundColor: "#FFF7E9", borderRadius: 12, padding: 11, flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12 }, noticeText: { color: "#8D6A2E", fontSize: 10, lineHeight: 15, flex: 1 }, cardTitle: { color: colors.text, fontWeight: "800", fontSize: 13 }, bodyText: { color: colors.sub, fontSize: 11, lineHeight: 17, marginTop: 5 }, binMeter: { flexDirection: "row", alignItems: "center", gap: 18, marginVertical: 18 }, ring: { width: 104, height: 104, borderRadius: 54, borderWidth: 8, borderColor: colors.pale, borderTopColor: colors.ok, borderRightColor: colors.ok, alignItems: "center", justifyContent: "center" }, ringNumber: { color: colors.text, fontSize: 20, fontWeight: "900" }, remaining: { color: colors.text, fontSize: 24, fontWeight: "900", marginVertical: 5 }, sensorRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, gap: 7 }, sensor: { flex: 1, alignItems: "center", gap: 4 }, sensorValue: { color: colors.text, fontSize: 12, fontWeight: "800" }, sensorBig: { color: colors.text, fontSize: 20, fontWeight: "900", marginVertical: 6 }, sensorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  guideHero: { backgroundColor: colors.primary, borderRadius: 18, padding: 18, marginBottom: 14 }, guideHeroTitle: { color: "#D4F4DF", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, guideHeroText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", marginTop: 9 }, guideCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }, guideIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" }, backRow: { flexDirection: "row", gap: 7, alignItems: "center", marginBottom: 16 }, actionText: { color: colors.primary, fontSize: 12, fontWeight: "800" }, stepRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }, stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.pale, justifyContent: "center", alignItems: "center" }, stepNumberText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  compartmentRow: { marginTop: 16, padding: 13, borderRadius: 15, backgroundColor: "#F8FAF8" }, compartmentHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }, compartmentIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, compartmentTitle: { color: colors.text, fontSize: 12, fontWeight: "900" }, compartmentValue: { color: colors.primary, fontSize: 16, fontWeight: "900" },
  mapTopInfo: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", padding: 12, borderRadius: 15, marginBottom: 10 }, mapAddressTitle: { color: colors.text, fontSize: 10, fontWeight: "900" }, mapAddress: { color: colors.sub, fontSize: 11, marginTop: 3 }, locateSmall: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" }, realMapFrame: { height: 320, borderRadius: 19, backgroundColor: "#E4ECE6", marginBottom: 10 }, mapOverlayTag: { position: "absolute", left: 10, right: 10, bottom: 10, padding: 8, borderRadius: 12, backgroundColor: "#FFFFFFE8", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }, mapOverlayText: { color: colors.primary, fontSize: 10, fontWeight: "800" }, mapActionRow: { flexDirection: "row", gap: 8, marginBottom: 7 }, osmAttribution: { color: colors.sub, fontSize: 9, lineHeight: 14, marginTop: -5, marginBottom: 10 }, routeStep: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }, routeStepNumber: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  pointCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, marginBottom: 8 }, pointIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" }, pointType: { color: colors.primary, fontSize: 11, fontWeight: "700", marginTop: 4 }, pointDistance: { fontSize: 13, fontWeight: "900", color: colors.primary },
  notificationCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 }, notificationIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }, notificationImage: { width: 58, height: 58, borderRadius: 11, backgroundColor: colors.pale }, profileCard: { flexDirection: "row", alignItems: "center", gap: 13 }, avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#DDF3E6", justifyContent: "center", alignItems: "center" }, avatarText: { color: colors.primary, fontSize: 21, fontWeight: "900" }, statsRow: { flexDirection: "row", gap: 8 }, stat: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 15, padding: 13, alignItems: "center" }, statValue: { fontSize: 15, fontWeight: "900", color: colors.text }, settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, marginBottom: 8 },
});
