import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { Card, Header, Pill, PrimaryButton, ProgressBar, Screen } from "../components/Common";
import { classifyWaste, getDemoClassification } from "../services/classifier";
import { api } from "../services/api";
import { sendLocalNotification } from "../services/localNotifications";
import { useApp } from "../context/AppContext";
import { API_URL } from "../config";
import type { WasteClassification } from "../types";

export function ScanResultScreen({ route, navigation }: any) {
  const { uri, base64, mimeType, cloudConsent } = route.params || {};
  const { user, setLastScan, addNotification } = useApp();
  const [result, setResult] = useState<WasteClassification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    classifyWaste(base64, mimeType || "image/jpeg", Boolean(cloudConsent))
      .then((value) => { if (active) { setResult(value); setLastScan(value, uri || null); } })
      .catch((e: any) => { if (active) { setResult(getDemoClassification()); setError(e?.message || "Không kết nối được AI server. Hiển thị kết quả demo."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base64, cloudConsent, mimeType, setLastScan, uri]);

  const confirm = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.post("/api/waste-records", { userId: user?.id || null, wasteType: result.wasteType, category: result.category, confidence: result.confidence, classificationMode: result.classificationMode || "demo" });
    } catch { /* Local demo flow remains available when API is offline. */ }
    const item = { id: `scan-${Date.now()}`, title: "Phân loại thành công", message: `Bạn vừa phân loại ${result.wasteType} · ${result.category}.`, type: "bin-event" as const, createdAt: new Date().toISOString(), imageUrl: uri || null, detectedLabel: result.wasteType, category: result.category, confidence: result.confidence };
    addNotification(item);
    await sendLocalNotification("EcoSort · Phân loại thành công", `${result.wasteType} - ${result.category}`);
    setSaving(false);
    Alert.alert("Đã ghi nhận", "Kết quả phân loại đã được thêm vào lịch sử trên ứng dụng.", [{ text: "Hoàn tất", onPress: () => navigation.navigate("MainTabs", { screen: "Trang chủ" }) }]);
  };

  return <Screen>
    <Header title="Kết quả nhận diện" subtitle="AI đã phân tích hình ảnh của bạn"/>
    {uri ? <Image source={{ uri }} style={s.photo} resizeMode="cover"/> : <View style={s.photoPlaceholder}><Ionicons name="image-outline" size={36} color={colors.primary}/><Text style={s.helper}>Không có ảnh xem trước</Text></View>}
    {loading ? <Card style={s.loading}><ActivityIndicator color={colors.primary} size="large"/><Text style={s.helper}>Đang phân tích hình ảnh...</Text><Text style={s.small}>Vui lòng chờ trong giây lát.</Text></Card> : result ? <>
      <View style={s.resultHeader}><Text style={s.name}>{result.wasteType}</Text><Pill label={result.classificationMode === "ai" ? `AI ${result.confidence}%` : "Kết quả demo"} kind={result.classificationMode === "ai" ? "success" : "warning"}/></View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Card><Text style={s.label}>NHÓM RÁC</Text><Text style={s.category}>{result.category}</Text><View style={s.row}><Text style={s.helper}>Độ tin cậy</Text><Text style={s.score}>{result.confidence}%</Text></View><ProgressBar value={result.confidence} height={7}/><Text style={s.small}>{result.note}</Text></Card>
      <Text style={s.section}>Hướng dẫn xử lý</Text>
      <Card>{result.instructions.map((step, index) => <View key={`${step}-${index}`} style={s.step}><View style={s.stepNumber}><Text style={s.stepNumberText}>{index + 1}</Text></View><Text style={s.stepText}>{step}</Text></View>)}</Card>
      <Card style={s.tip}><Ionicons name="information-circle-outline" size={19} color={colors.primary}/><Text style={s.helper}>Màu/ngăn đề xuất: {result.binColor}. Hãy đối chiếu với nhãn trên thùng rác tại nơi bạn sinh hoạt.</Text></Card>
      <PrimaryButton title="Xác nhận bỏ vào thùng rác" icon="checkmark-circle-outline" onPress={confirm} loading={saving}/>
    </> : <Card><Text style={s.error}>Không phân tích được ảnh.</Text><PrimaryButton title="Thử lại" onPress={() => navigation.goBack()} outline/></Card>}
  </Screen>;
}

export function BinDetectionScreen({ route }: any) {
  const event = route.params?.event || {};
  const rawUri = route.params?.imageUri || event.imageUrl;
  const imageUri = rawUri ? (String(rawUri).startsWith("http") || String(rawUri).startsWith("file:") ? rawUri : `${API_URL}${rawUri}`) : null;
  return <Screen>
    <Header title="Phát hiện rác mới" subtitle="Thông tin từ camera thùng rác thông minh"/>
    {imageUri ? <Image source={{ uri: imageUri }} style={s.photoLarge} resizeMode="cover"/> : <View style={s.photoPlaceholder}><Ionicons name="camera-outline" size={38} color={colors.primary}/><Text style={s.helper}>Chưa có ảnh camera gửi lên</Text></View>}
    <Card style={s.eventCard}><View style={s.eventIcon}><Ionicons name="checkmark" color={colors.primary} size={20}/></View><View style={{ flex: 1 }}><Text style={s.eventTitle}>Đã phát hiện vật thể</Text><Text style={s.helper}>Camera thùng rác đã ghi nhận hình ảnh vật thể.</Text><Text style={s.small}>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "Vừa xong"}</Text></View></Card>
    <Text style={s.section}>Kết quả AI nhận diện</Text>
    <Card><Text style={s.category}>{event.detectedLabel || "Chưa nhận diện"}</Text><Text style={s.helper}>{event.category || "Chưa có nhóm rác"}</Text>{event.confidence != null ? <Text style={s.small}>Độ tin cậy: {event.confidence}%</Text> : null}<View style={s.divider}/><Text style={s.helper}>Nếu Raspberry Pi chưa tích hợp camera hoặc chưa gửi ảnh, màn hình sẽ hiển thị trạng thái chưa có ảnh.</Text></Card>
  </Screen>;
}
const s = StyleSheet.create({ photo: { width: "100%", height: 170, borderRadius: 18, backgroundColor: colors.pale, marginBottom: 14 }, photoLarge: { width: "100%", height: 270, borderRadius: 18, backgroundColor: colors.pale, marginBottom: 14 }, photoPlaceholder: { height: 170, borderRadius: 18, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center", marginBottom: 14, gap: 8 }, loading: { alignItems: "center", gap: 10, paddingVertical: 28 }, helper: { color: colors.sub, fontSize: 11, lineHeight: 17, marginTop: 4 }, small: { color: colors.sub, fontSize: 10, lineHeight: 15, marginTop: 7 }, name: { color: colors.text, fontSize: 21, fontWeight: "900", flex: 1 }, resultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }, label: { fontSize: 10, color: colors.primary, fontWeight: "900", letterSpacing: 0.5 }, category: { fontSize: 18, fontWeight: "900", color: colors.text, marginTop: 5, marginBottom: 12 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, score: { color: colors.primary, fontWeight: "900", fontSize: 13 }, section: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 10, marginTop: 5 }, step: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 }, stepNumber: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" }, stepNumberText: { color: colors.primary, fontWeight: "900", fontSize: 11 }, stepText: { flex: 1, fontSize: 12, color: colors.sub, lineHeight: 18 }, tip: { flexDirection: "row", gap: 9, alignItems: "flex-start" }, error: { color: colors.danger, fontSize: 11, marginVertical: 8 }, eventCard: { flexDirection: "row", gap: 12, alignItems: "center" }, eventIcon: { width: 38, height: 38, borderRadius: 20, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" }, eventTitle: { color: colors.text, fontWeight: "800", fontSize: 13 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 12 } });
