import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Image, Linking, RefreshControl, ScrollView, Switch, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Location from "expo-location";
import { colors, fillColor } from "../theme";
import { Card, EmptyState, Header, Pill, PrimaryButton, ProgressBar, Screen, SectionTitle } from "../components/Common";
import { EcoButton, EcoCard, EcoText } from "../components/UiKit";
import { api } from "../services/api";
import { API_URL } from "../config";
import { sendLocalNotification } from "../services/localNotifications";
import { DEMO_POINTS, DEMO_TRASH_CANS, WASTE_GUIDES } from "../data/demo";
import { useApp } from "../context/AppContext";
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

export function DashboardScreen({ navigation }: any) {
  const { user, demoMode, notifications } = useApp();
  const [cans, setCans] = useState<TrashCan[]>(DEMO_TRASH_CANS); const [refreshing, setRefreshing] = useState(false); const [isDemo, setIsDemo] = useState(true);
  const load = useCallback(async () => {
    try { const data = await api.get<TrashCan[]>("/api/trashcans"); if (Array.isArray(data) && data.length) { setCans(data); setIsDemo(false); } else { setCans(DEMO_TRASH_CANS); setIsDemo(true); } }
    catch { setCans(DEMO_TRASH_CANS); setIsDemo(true); }
  }, []);
  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, [load]);
  const primary = cans[0] || DEMO_TRASH_CANS[0]; const fill = Math.round(primary.FillLevel ?? 0);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  return <Screen>
    <View style={s.homeHeader}><View><Text style={s.greeting}>Chào buổi sáng, {user?.fullName?.split(" ").slice(-1)[0] || "bạn"} 👋</Text><Text style={s.subtitle}>Cùng phân loại rác đúng cách hôm nay</Text></View><View style={{ flexDirection: "row", gap: 8 }}><TouchableOpacity style={s.bell} onPress={() => navigation.navigate("Account")}><Ionicons name="person-outline" size={19} color={colors.text}/></TouchableOpacity><TouchableOpacity style={s.bell} onPress={() => navigation.navigate("Notifications")}><Ionicons name="notifications-outline" size={20} color={colors.text}/>{notifications.length > 0 ? <View style={s.badgeDot}/> : null}</TouchableOpacity></View></View>
    <View style={s.hero}><View style={{ flex: 1 }}><Text style={s.heroLabel}>{demoMode ? "THÀNH TÍCH · DEMO" : "KHỐI LƯỢNG TÁI CHẾ"}</Text><Text style={s.heroValue}>{demoMode ? "12.8 kg" : "-- kg"}</Text><Text style={s.heroSub}>{demoMode ? "Số liệu minh họa cho bản trình diễn" : "Chưa có dữ liệu cân/định lượng được tích hợp"}</Text></View><View style={s.heroIcon}><Ionicons name="recycle" size={32} color="#D4F4DF"/></View></View>
    <SectionTitle title="Tổng quan thùng rác" action="Xem tất cả ›" onAction={() => navigation.navigate("Thùng rác")}/>
    <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate("Thùng rác")}><EcoCard padding="$4" marginBottom="$3"><View style={s.rowBetween}><View style={s.binTitleWrap}><View style={s.binIcon}><Ionicons name="trash-outline" color={colors.primary} size={20}/></View><View><EcoText strong>{primary.Name || "EcoBin · Khu A"}</EcoText><Text style={s.smallMuted}>Mức chứa hiện tại</Text></View></View><Pill label={isDemo ? "Dữ liệu demo" : (primary.Status || "Online")} kind={isDemo ? "warning" : "success"}/></View><View style={s.rowBetween}><Text style={s.fillNumber}>{primary.FillLevel == null ? "--" : `${fill}%`}</Text><Text style={s.smallMuted}>{fill >= 80 ? "Cần thu gom sớm" : "Đang hoạt động ổn định"}</Text></View><ProgressBar value={fill}/></EcoCard></TouchableOpacity>
    {demoMode ? <Text style={s.demoHint}>Bạn đang ở chế độ demo. Kết nối backend để đồng bộ tài khoản và dữ liệu thật.</Text> : null}
    <SectionTitle title="Bạn muốn làm gì?"/>
    <View style={s.quickRow}><QuickTile icon="scan-outline" title="Quét rác" sub="Nhận diện bằng AI" onPress={() => navigation.navigate("Quét rác")}/><QuickTile icon="location-outline" title="Tìm điểm đổi" sub="Gần vị trí của bạn" onPress={() => navigation.navigate("Bản đồ")}/><QuickTile icon="book-outline" title="Cẩm nang" sub="Học cách phân loại" onPress={() => navigation.navigate("WasteGuide")}/></View>
    <EcoButton alignSelf="flex-start" size="$3" marginTop="$3" onPress={() => navigation.navigate("WasteGuide")}>Mở cẩm nang phân loại</EcoButton>
    <SwipeHint/>
    <SectionTitle title="Gợi ý nhanh"/>
    <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><View style={s.tipIcon}><Ionicons name="bulb-outline" size={20} color={colors.warn}/></View><View style={{ flex: 1 }}><Text style={s.tipTitle}>Đặt rác đúng ngăn</Text><Text style={s.tipSub}>Quét hoặc chụp ảnh để xem hướng dẫn xử lý trước khi bỏ rác.</Text></View></Card>
    <View style={{ height: 6 }}/>
  </Screen>;
}

export function SmartBinScreen({ navigation }: any) {
  const [cans, setCans] = useState<TrashCan[]>(DEMO_TRASH_CANS); const [demo, setDemo] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { const data = await api.get<TrashCan[]>("/api/trashcans"); if (Array.isArray(data) && data.length) { setCans(data); setDemo(false); } else { setCans(DEMO_TRASH_CANS); setDemo(true); } } catch { setCans(DEMO_TRASH_CANS); setDemo(true); } }, []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  return <Screen>
    <Header title="Thùng rác thông minh" subtitle="Theo dõi thiết bị Raspberry Pi"/>
    {demo ? <View style={s.notice}><Ionicons name="information-circle-outline" size={17} color={colors.warn}/><Text style={s.noticeText}>Đang hiển thị dữ liệu mẫu. Dữ liệu thật cập nhật từ API khi Raspberry Pi gửi telemetry.</Text></View> : null}
    <FlatList data={cans} scrollEnabled={false} keyExtractor={(item) => String(item.TrashCanID)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>} renderItem={({ item }) => {
      const val = Math.round(item.FillLevel ?? 0); const online = String(item.Status).toLowerCase() === "online";
      return <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate("BinDetail", { can: item })}><Card>
        <View style={s.rowBetween}><View style={s.binTitleWrap}><View style={s.binIcon}><Ionicons name="trash-outline" size={20} color={colors.primary}/></View><View><Text style={s.cardTitle}>{item.Name}</Text><Text style={s.smallMuted}>{item.LocationName || "Vị trí chưa cập nhật"}</Text></View></View><Pill label={online ? "Online" : "Offline"} kind={online ? "success" : "neutral"}/></View>
        <View style={s.binMeter}><View style={s.ring}><Text style={s.ringNumber}>{item.FillLevel == null ? "--" : `${val}%`}</Text><Text style={s.smallMuted}>Đã đầy</Text></View><View style={{ flex: 1 }}><Text style={s.smallMuted}>Dung lượng còn lại</Text><Text style={s.remaining}>{item.FillLevel == null ? "--" : `${100 - val}%`}</Text><ProgressBar value={val} height={10}/><Text style={s.smallMuted}>{val >= 80 ? "Nên thu gom sớm" : "Chưa cần thu gom"}</Text></View></View>
        <View style={s.sensorRow}><Sensor icon="thermometer-outline" label="Nhiệt độ" value={`${item.Temperature ?? "--"}°C`}/><Sensor icon="water-outline" label="Độ ẩm" value={`${item.Humidity ?? "--"}%`}/><Sensor icon="lock-closed-outline" label="Nắp thùng" value={item.LidState || "--"}/></View>
      </Card></TouchableOpacity>;
    }}/>
    <Card><Text style={s.cardTitle}>Cách thiết bị cập nhật</Text><Text style={s.bodyText}>Raspberry Pi gửi khoảng cách siêu âm, nhiệt độ, độ ẩm và trạng thái nắp tới POST /api/telemetry. Ứng dụng tải dữ liệu mới mỗi 5 giây.</Text></Card>
  </Screen>;
}
function Sensor({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={s.sensor}><Ionicons name={icon} size={17} color={colors.primary}/><Text style={s.sensorValue}>{value}</Text><Text style={s.smallMuted}>{label}</Text></View>; }

export function BinDetailScreen({ route }: any) {
  const can: TrashCan = route.params?.can || DEMO_TRASH_CANS[0]; const val = Math.round(can.FillLevel ?? 0);
  return <Screen><Header title={can.Name} subtitle="Thông tin cảm biến mới nhất"/><Card><View style={s.rowBetween}><Pill label={can.Status || "Chưa rõ trạng thái"} kind={can.Status === "Online" ? "success" : "neutral"}/><Text style={s.smallMuted}>MAC: {can.MacAddress || "Chưa khai báo"}</Text></View><View style={{ alignItems: "center", paddingVertical: 18 }}><View style={[s.ring, { width: 145, height: 145, borderRadius: 80 }]}><Text style={{ color: fillColor(val), fontSize: 31, fontWeight: "900" }}>{can.FillLevel == null ? "--" : `${val}%`}</Text><Text style={s.smallMuted}>Đã đầy</Text></View><Text style={s.bodyText}>Dung lượng còn khoảng {100 - val}%</Text></View><ProgressBar value={val} height={12}/></Card><View style={s.sensorGrid}><SensorCard icon="thermometer-outline" label="Nhiệt độ" value={`${can.Temperature ?? "--"}°C`}/><SensorCard icon="water-outline" label="Độ ẩm" value={`${can.Humidity ?? "--"}%`}/><SensorCard icon="lock-closed-outline" label="Trạng thái nắp" value={can.LidState || "--"}/><SensorCard icon="time-outline" label="Cập nhật" value={can.RecordedAt ? new Date(can.RecordedAt).toLocaleTimeString() : "Chưa có"}/></View><Card><Text style={s.cardTitle}>Ngưỡng cảnh báo</Text><Text style={s.bodyText}>Từ 80% dung lượng: cảnh báo cần thu gom. Từ 50°C: cảnh báo nhiệt độ cao để kiểm tra nguy cơ.</Text></Card></Screen>;
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

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) { const r = 6371; const dLat = (bLat - aLat) * Math.PI / 180; const dLng = (bLng - aLng) * Math.PI / 180; const v = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v)); }
export function RecyclingMapScreen() {
  const [locationState, setLocationState] = useState<"idle" | "loading" | "granted" | "denied">("idle"); const [current, setCurrent] = useState<{ latitude: number; longitude: number } | null>(null);
  const points = useMemo(() => current ? DEMO_POINTS.map((p) => ({ ...p, distance: `${distanceKm(current.latitude, current.longitude, p.lat, p.lng).toFixed(1)} km` })).sort((a, b) => Number(a.distance.split(" ")[0]) - Number(b.distance.split(" ")[0])) : DEMO_POINTS, [current]);
  const locate = async () => { setLocationState("loading"); try { const permission = await Location.requestForegroundPermissionsAsync(); if (!permission.granted) { setLocationState("denied"); return; } const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); setCurrent({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }); setLocationState("granted"); } catch { setLocationState("denied"); } };
  const openMaps = async () => { const query = "điểm thu gom rác tái chế gần tôi"; const url = current ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&center=${current.latitude},${current.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`; await Linking.openURL(url); };
  return <Screen><Header title="Điểm thu gom gần bạn" subtitle="Tìm nơi đổi rác và gửi rác tái chế"/><View style={s.mapPlaceholder}><View style={s.mapRoadA}/><View style={s.mapRoadB}/><View style={s.mapRoadC}/><View style={s.mapRoadD}/><View style={s.mapPin1}><Ionicons name="location" size={24} color={colors.primary}/></View><View style={s.mapPin2}><Ionicons name="location" size={24} color={colors.primary}/></View><View style={s.mapPin3}><Ionicons name="location" size={24} color={colors.primary}/></View><View style={s.mapUser}><Ionicons name="navigate" size={13} color="#fff"/></View><View style={s.mapTag}><Text style={s.mapTagText}>Bản đồ minh họa</Text></View></View>
    <PrimaryButton title={locationState === "loading" ? "Đang lấy vị trí..." : locationState === "granted" ? "Đã lấy vị trí · Tìm trên Google Maps" : "Dùng vị trí hiện tại"} icon="locate-outline" onPress={locate} loading={locationState === "loading"}/>
    {locationState === "denied" ? <Text style={s.warningText}>Bạn chưa cấp quyền vị trí. Có thể tiếp tục tìm kiếm thủ công trên bản đồ.</Text> : null}
    <SectionTitle title="Danh sách điểm thu gom"/><View style={s.notice}><Ionicons name="information-circle-outline" size={17} color={colors.warn}/><Text style={s.noticeText}>Các điểm dưới đây là dữ liệu minh họa để trình diễn giao diện, chưa phải địa điểm đã xác minh.</Text></View>
    {points.map((p) => <Card key={p.id} style={s.pointCard}><View style={s.pointIcon}><Ionicons name="location-outline" size={21} color={colors.primary}/></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>{p.name}</Text><Text style={s.smallMuted}>{p.address}</Text><Text style={s.pointType}>{p.types}</Text></View><Text style={s.pointDistance}>{current ? p.distance : "Demo"}</Text></Card>)}
    <PrimaryButton title="Tìm điểm thu gom thật trên bản đồ" icon="map-outline" onPress={openMaps} outline/>
  </Screen>;
}

export function NotificationsScreen({ navigation }: any) {
  const { notifications: localItems, lastScanImage, markRead } = useApp();
  const [serverItems, setServerItems] = useState<any[]>([]); const [bins, setBins] = useState<TrashCan[]>([]); const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const load = useCallback(async () => {
    try { const [events, cans] = await Promise.all([api.get<any[]>("/api/bin-events"), api.get<TrashCan[]>("/api/trashcans")]); setServerItems(Array.isArray(events) ? events : []); setBins(Array.isArray(cans) ? cans : []); } catch { setServerItems([]); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  const alerts: AppNotification[] = useMemo(() => {
    const generated: AppNotification[] = bins.flatMap((c) => {
      const items: AppNotification[] = [];
      if ((c.FillLevel || 0) >= 80) items.push({ id: `fill-${c.TrashCanID}`, title: "Thùng rác sắp đầy", message: `${c.Name} đã đạt ${Math.round(c.FillLevel || 0)}% dung lượng.`, type: "full", createdAt: c.RecordedAt || new Date().toISOString() });
      if ((c.Temperature || 0) >= 50) items.push({ id: `temp-${c.TrashCanID}`, title: "Nhiệt độ cao", message: `${c.Name}: ${c.Temperature}°C. Cần kiểm tra thiết bị.`, type: "temperature", createdAt: c.RecordedAt || new Date().toISOString() });
      return items;
    });
    const server: AppNotification[] = serverItems.map((e) => ({ id: `event-${e.EventID}`, title: e.DetectedLabel ? `Phát hiện: ${e.DetectedLabel}` : "Thùng rác phát hiện vật thể", message: `${e.Category || "Chưa phân loại"} · ${e.MacAddress || "EcoBin"}`, type: "bin-event", createdAt: e.CreatedAt || new Date().toISOString(), imageUrl: e.ImageUrl, detectedLabel: e.DetectedLabel, category: e.Category, confidence: e.Confidence }));
    const merged = new Map<string, AppNotification>();
    [...localItems, ...server, ...generated].forEach((item) => merged.set(item.id, item));
    return [...merged.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bins, localItems, serverItems]);
  const refresh = async () => { setLoading(true); setVisibleCount(10); await load(); setLoading(false); };
  const onOpen = (item: AppNotification) => { markRead(item.id); if (item.type === "bin-event") navigation.navigate("BinDetection", { event: item, imageUri: item.imageUrl || lastScanImage }); };
  return <Screen><Header title="Thông báo" subtitle="Cập nhật mới nhất từ EcoSort" action="Làm mới" onAction={refresh}/><FlatList data={alerts.slice(0, visibleCount)} scrollEnabled={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh}/>} keyExtractor={(item, index) => `${item.id}-${index}`} ListEmptyComponent={<EmptyState title="Chưa có thông báo" description="Khi thùng rác đầy hoặc có vật thể được camera ghi nhận, thông báo sẽ xuất hiện tại đây." icon="notifications-outline"/>} ListFooterComponent={visibleCount < alerts.length ? <TouchableOpacity onPress={() => setVisibleCount((n) => n + 10)} style={{ padding: 14, alignItems: "center" }}><Text style={s.actionText}>Tải thêm thông báo ({alerts.length - visibleCount} còn lại)</Text></TouchableOpacity> : null} renderItem={({ item }) => {
      const icon = item.type === "full" ? "trash-outline" : item.type === "temperature" ? "flame-outline" : item.type === "bin-event" ? "camera-outline" : "checkmark-circle-outline";
      const bg = item.type === "temperature" ? "#FFF1E5" : item.type === "full" ? "#FFF2DF" : "#E6F5EB";
      const uri = item.imageUrl ? (item.imageUrl.startsWith("http") || item.imageUrl.startsWith("file:") ? item.imageUrl : `${API_URL}${item.imageUrl}`) : (item.type === "bin-event" ? lastScanImage || undefined : undefined);
      return <TouchableOpacity activeOpacity={0.87} onPress={() => onOpen(item)}><Card style={s.notificationCard}><View style={[s.notificationIcon, { backgroundColor: bg }]}><Ionicons name={icon as any} size={20} color={item.type === "temperature" ? colors.danger : colors.primary}/></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.bodyText}>{item.message}</Text><Text style={s.smallMuted}>{new Date(item.createdAt).toLocaleString()}</Text></View>{uri ? <Image source={{ uri }} style={s.notificationImage}/> : null}</Card></TouchableOpacity>;
    }}/><View style={s.notice}><Ionicons name="camera-outline" size={17} color={colors.primary}/><Text style={s.noticeText}>Để thông báo camera có ảnh thật, Raspberry Pi cần gửi sự kiện và ảnh tới POST /api/bin-events.</Text></View></Screen>;
}

export function AccountScreen() {
  const { user, logout, demoMode } = useApp();
  const [records, setRecords] = useState<any[]>([]);
  useEffect(() => { api.get<any[]>(`/api/waste-records${user?.id ? `?userId=${user.id}` : ""}`).then((v) => setRecords(Array.isArray(v) ? v : [])).catch(() => setRecords([])); }, [user?.id]);
  return <Screen><Header title="Tài khoản" subtitle="Quản lý hồ sơ và hoạt động xanh"/><Card style={s.profileCard}><View style={s.avatar}><Text style={s.avatarText}>{(user?.fullName || "E").charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>{user?.fullName || "Người dùng EcoSort"}</Text><Text style={s.smallMuted}>{user?.email || "guest@ecosort.demo"}</Text><Pill label={demoMode ? "Demo Member" : "Eco Member"}/></View></Card>
    <SectionTitle title="Thống kê của bạn"/><View style={s.statsRow}><Stat value="-- kg" label="Chưa có dữ liệu cân"/><Stat value={String(records.length)} label="Lượt phân loại đã lưu"/><Stat value="--" label="Ngày liên tiếp"/></View>
    <SectionTitle title="Cài đặt"/>{[["person-outline", "Thông tin cá nhân"], ["hardware-chip-outline", "Thiết bị đã kết nối"], ["time-outline", "Lịch sử phân loại"], ["shield-checkmark-outline", "Quyền riêng tư"], ["help-circle-outline", "Trợ giúp & hỗ trợ"]].map(([icon, label]) => <TouchableOpacity key={label} onPress={() => Alert.alert(label, "Mục này có thể được mở rộng trong phiên bản tiếp theo.")}><Card style={s.settingRow}><Ionicons name={icon as any} size={19} color={colors.primary}/><Text style={{ flex: 1, color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text><Ionicons name="chevron-forward" size={16} color={colors.sub}/></Card></TouchableOpacity>)}
    <PrimaryButton title="Đăng xuất" outline icon="log-out-outline" onPress={() => Alert.alert("Đăng xuất", "Bạn muốn đăng xuất khỏi EcoSort?", [{ text: "Hủy", style: "cancel" }, { text: "Đăng xuất", style: "destructive", onPress: logout }])}/>
  </Screen>;
}
function Stat({ value, label }: { value: string; label: string }) { return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.smallMuted}>{label}</Text></View>; }

const s = StyleSheet.create({
  homeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }, greeting: { fontSize: 18, fontWeight: "900", color: colors.text }, subtitle: { color: colors.sub, fontSize: 11, marginTop: 4 }, bell: { width: 40, height: 40, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F6ED" }, badgeDot: { position: "absolute", top: 8, right: 8, height: 7, width: 7, borderRadius: 4, backgroundColor: colors.danger },
  hero: { backgroundColor: colors.primary, borderRadius: 21, padding: 19, flexDirection: "row", alignItems: "center", marginBottom: 13 }, heroLabel: { color: "#C9F0D6", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }, heroValue: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", marginTop: 8 }, heroSub: { color: "#E0F5E7", fontSize: 10, marginTop: 3 }, heroIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFFFFF20", alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, binTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10 }, binIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.pale, justifyContent: "center", alignItems: "center" }, smallMuted: { color: colors.sub, fontSize: 10, marginTop: 4 }, fillNumber: { color: colors.text, fontSize: 23, fontWeight: "900", marginVertical: 8 }, demoHint: { color: colors.warn, fontSize: 10, marginTop: -2, marginBottom: 8 }, quickRow: { flexDirection: "row", gap: 9 }, quickTile: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, minHeight: 112, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, quickIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center", marginBottom: 8 }, quickTitle: { color: colors.text, fontSize: 11, fontWeight: "800" }, quickSub: { color: colors.sub, fontSize: 9, marginTop: 4, textAlign: "center" }, tipCard: { marginTop: 15, borderRadius: 15, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", padding: 13, gap: 10 }, tipIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFF3D9", alignItems: "center", justifyContent: "center" }, tipTitle: { color: colors.text, fontSize: 11, fontWeight: "800" }, tipSub: { color: colors.sub, fontSize: 10, marginTop: 4, lineHeight: 15 },
  notice: { backgroundColor: "#FFF7E9", borderRadius: 12, padding: 11, flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12 }, noticeText: { color: "#8D6A2E", fontSize: 10, lineHeight: 15, flex: 1 }, cardTitle: { color: colors.text, fontWeight: "800", fontSize: 13 }, bodyText: { color: colors.sub, fontSize: 11, lineHeight: 17, marginTop: 5 }, binMeter: { flexDirection: "row", alignItems: "center", gap: 18, marginVertical: 18 }, ring: { width: 104, height: 104, borderRadius: 54, borderWidth: 8, borderColor: colors.pale, borderTopColor: colors.ok, borderRightColor: colors.ok, alignItems: "center", justifyContent: "center" }, ringNumber: { color: colors.text, fontSize: 20, fontWeight: "900" }, remaining: { color: colors.text, fontSize: 24, fontWeight: "900", marginVertical: 5 }, sensorRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, gap: 7 }, sensor: { flex: 1, alignItems: "center", gap: 4 }, sensorValue: { color: colors.text, fontSize: 12, fontWeight: "800" }, sensorBig: { color: colors.text, fontSize: 20, fontWeight: "900", marginVertical: 6 }, sensorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  guideHero: { backgroundColor: colors.primary, borderRadius: 18, padding: 18, marginBottom: 14 }, guideHeroTitle: { color: "#D4F4DF", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, guideHeroText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", marginTop: 9 }, guideCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }, guideIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" }, backRow: { flexDirection: "row", gap: 7, alignItems: "center", marginBottom: 16 }, actionText: { color: colors.primary, fontSize: 12, fontWeight: "800" }, stepRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }, stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.pale, justifyContent: "center", alignItems: "center" }, stepNumberText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  mapPlaceholder: { height: 255, borderRadius: 19, backgroundColor: "#E6EFE8", overflow: "hidden", marginBottom: 14 }, mapRoadA: { position: "absolute", width: 500, height: 13, backgroundColor: "#FFFFFF", transform: [{ rotate: "-19deg" }], top: 80, left: -60 }, mapRoadB: { position: "absolute", width: 470, height: 13, backgroundColor: "#FFFFFF", transform: [{ rotate: "27deg" }], top: 145, left: -60 }, mapRoadC: { position: "absolute", width: 400, height: 13, backgroundColor: "#FFFFFF", transform: [{ rotate: "82deg" }], top: 110, left: 110 }, mapRoadD: { position: "absolute", width: 400, height: 13, backgroundColor: "#FFFFFF", transform: [{ rotate: "-51deg" }], top: 130, left: 80 }, mapPin1: { position: "absolute", top: 65, left: 70 }, mapPin2: { position: "absolute", top: 150, right: 85 }, mapPin3: { position: "absolute", bottom: 35, left: 170 }, mapUser: { position: "absolute", top: 125, left: 170, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF" }, mapTag: { position: "absolute", right: 12, top: 12, backgroundColor: "#FFFFFF", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 }, mapTagText: { color: colors.sub, fontSize: 9, fontWeight: "700" }, warningText: { color: colors.warn, fontSize: 10, marginTop: 8 }, pointCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 }, pointIcon: { width: 40, height: 40, backgroundColor: colors.pale, borderRadius: 14, alignItems: "center", justifyContent: "center" }, pointType: { color: colors.primary, fontSize: 10, fontWeight: "700", marginTop: 4 }, pointDistance: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  notificationCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 }, notificationIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }, notificationImage: { width: 58, height: 58, borderRadius: 11, backgroundColor: colors.pale }, profileCard: { flexDirection: "row", alignItems: "center", gap: 13 }, avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#DDF3E6", justifyContent: "center", alignItems: "center" }, avatarText: { color: colors.primary, fontSize: 21, fontWeight: "900" }, statsRow: { flexDirection: "row", gap: 8 }, stat: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 15, padding: 13, alignItems: "center" }, statValue: { fontSize: 15, fontWeight: "900", color: colors.text }, settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, marginBottom: 8 },
});
