import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Text, View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { Card, Header, Pill, PrimaryButton, ProgressBar, Screen } from "../components/Common";
import { classifyWaste } from "../services/classifier";
import { classifyOnDevice } from "../services/localWasteModel";
import { api } from "../services/api";
import { sendLocalNotification } from "../services/localNotifications";
import { useApp } from "../context/AppContext";
import { API_URL } from "../config";
import type { WasteClassification } from "../types";
import { WasteAssistant } from "../components/WasteAssistant";



export function ScanResultScreen({ route, navigation }: any) {
  const { uri, base64, mimeType, cloudConsent, selectedClass, width, height } = route.params || {};
  const { user, setLastScan, addNotification } = useApp();
  // Khung ảnh giữ đúng tỉ lệ ảnh gốc để toạ độ bbox (0..1) khớp chính xác với vật thể
  const [aspect, setAspect] = useState<number>(width && height ? width / height : 4 / 3);
  useEffect(() => {
    if (width && height) return;
    if (uri) Image.getSize(uri, (w, h) => { if (w && h) setAspect(w / h); }, () => {});
  }, [uri, width, height]);
  const [result, setResult] = useState<WasteClassification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    classifyWaste(uri || "", base64, mimeType || "image/jpeg", Boolean(cloudConsent), selectedClass)
      .then((value) => { if (active) { setResult(value); setLastScan(value, uri || null); } })
      .catch((e: any) => { if (active) { setResult(null); setError(e?.message || "Không thể phân tích ảnh."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base64, cloudConsent, mimeType, selectedClass, setLastScan, uri]);

  const confirm = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.post("/api/waste-records", { userId: user?.id || null, wasteType: result.wasteType, category: result.category, confidence: result.confidence, classificationMode: result.classificationMode || "demo", imageUrl: result.imageUrl || null });
    } catch { /* Local demo flow remains available when API is offline. */ }
    const item = { id: `scan-${Date.now()}`, title: "Phân loại thành công", message: `Bạn vừa phân loại ${result.wasteType} · ${result.category}.`, type: "bin-event" as const, createdAt: new Date().toISOString(), imageUrl: uri || null, detectedLabel: result.wasteType, category: result.category, confidence: result.confidence };
    addNotification(item);
    await sendLocalNotification("Nhom4 · Phân loại thành công", `${result.wasteType} - ${result.category}`);
    setSaving(false);
    Alert.alert("Đã ghi nhận", "Kết quả phân loại đã được thêm vào lịch sử trên ứng dụng.", [{ text: "Hoàn tất", onPress: () => navigation.navigate("MainTabs", { screen: "Trang chủ" }) }]);
  };

  return <Screen>
    <Header
      title="Kết quả nhận diện"
      subtitle="Mô hình AI YOLO (best.pt) phân tích hình ảnh"
      showBack
      onBack={() => {
        if (navigation?.canGoBack?.()) navigation.goBack();
        else navigation?.navigate("MainTabs");
      }}
    />

    {/* HÌNH ẢNH KÈM KHUNG NHẬN DIỆN YOLO (BOUNDING BOX) */}
    {uri ? (
      <View style={[s.photoContainer, { aspectRatio: Math.max(0.6, Math.min(2, aspect)) }]}>
        <Image source={{ uri }} style={s.photoFill} resizeMode="stretch"/>
        {result && result.confidence > 0 ? (
          <View
            style={[
              s.yoloBBox,
              result.bbox && result.bbox.length === 4
                ? {
                    left: `${(result.bbox[0] * 100).toFixed(2)}%` as any,
                    top: `${(result.bbox[1] * 100).toFixed(2)}%` as any,
                    width: `${(Math.max(0.02, result.bbox[2] - result.bbox[0]) * 100).toFixed(2)}%` as any,
                    height: `${(Math.max(0.02, result.bbox[3] - result.bbox[1]) * 100).toFixed(2)}%` as any,
                    right: undefined,
                    bottom: undefined,
                  }
                : null,
            ]}
          >
            <View style={[s.yoloCorner, s.cornerTL]} />
            <View style={[s.yoloCorner, s.cornerTR]} />
            <View style={[s.yoloCorner, s.cornerBL]} />
            <View style={[s.yoloCorner, s.cornerBR]} />
            <View style={s.yoloTag}>
              <Ionicons name="scan-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={s.yoloTagText}>
                {result.wasteType.split(" (")[0]} · {result.confidence}%
              </Text>
            </View>
          </View>
        ) : result && result.confidence === 0 ? (
          <View style={s.yoloBBoxNone}>
            <View style={s.yoloTagNone}>
              <Ionicons name="alert-circle" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={s.yoloTagText}>Không rõ vật thể (best.pt) · 0%</Text>
            </View>
          </View>
        ) : null}
      </View>
    ) : (
      <View style={s.photoPlaceholder}>
        <Ionicons name="image-outline" size={36} color={colors.primary}/>
        <Text style={s.helper}>Không có ảnh xem trước</Text>
      </View>
    )}


    {loading ? <Card style={s.loading}><ActivityIndicator color={colors.primary} size="large"/><Text style={s.helper}>Đang phân tích hình ảnh bằng AI...</Text><Text style={s.small}>Vui lòng chờ trong giây lát.</Text></Card> : result ? <>
      {/* KHUNG NHÃN ĐÓNG KHUNG NỔI BẬT */}
      <View style={[s.nhanBox, result.confidence === 0 ? s.nhanBoxNone : s.nhanBoxOk]}>
        <View style={s.nhanHeader}>
          <Ionicons name={result.confidence === 0 ? "alert-circle" : "pricetag"} size={16} color={result.confidence === 0 ? "#DC2626" : colors.primary} />
          <Text style={[s.nhanHeaderTitle, result.confidence === 0 && { color: "#DC2626" }]}>
            {result.confidence === 0 ? "KHÔNG TÌM THẤY RÁC" : "NHÃN PHÂN LOẠI (best.pt)"}
          </Text>
          <View style={[s.nhanBadge, result.confidence === 0 ? s.nhanBadgeNone : s.nhanBadgeOk]}>
            <Text style={[s.nhanBadgeText, result.confidence === 0 ? s.nhanBadgeTextNone : s.nhanBadgeTextOk]}>
              {result.confidence === 0 ? "KHÔNG CÓ RÁC" : `${result.confidence}%`}
            </Text>
          </View>
        </View>
        <Text style={s.nhanName}>{result.wasteType}</Text>
        {result.confidence > 0 ? (
          <Text style={s.nhanComp}>📍 Vị trí bỏ: <Text style={{ color: colors.primary, fontWeight: "900" }}>{result.binCompartment || result.binColor}</Text></Text>
        ) : null}
      </View>

      <Card>
        <Text style={s.label}>NHÓM RÁC</Text>
        <Text style={s.category}>{result.category}</Text>
        {result.material ? <Text style={s.helper}>Chất liệu: {result.material}</Text> : null}
        <View style={s.row}><Text style={s.helper}>Độ tin cậy</Text><Text style={s.score}>{result.confidence}%</Text></View>
        <ProgressBar value={result.confidence} height={7}/>
        <Text style={s.small}>{result.note}</Text>
      </Card>
      <Text style={s.section}>Hướng dẫn xử lý</Text>
      <Card>{result.instructions.map((step, index) => <View key={`${step}-${index}`} style={s.step}><View style={s.stepNumber}><Text style={s.stepNumberText}>{index + 1}</Text></View><Text style={s.stepText}>{step}</Text></View>)}</Card>
      <Card style={s.tip}><Ionicons name="information-circle-outline" size={19} color={colors.primary}/><Text style={s.helper}>Vị trí bỏ: {result.binCompartment || result.binColor}. {result.disposalMethod ? `Cách xử lý: ${result.disposalMethod}. ` : ""}Pin, bình xịt, hóa chất và vật sắc nhọn cần thu gom riêng, không bỏ vào hai ngăn.</Text></Card>
      <WasteAssistant result={result} />
      <View style={{ height: 10 }} />
      <PrimaryButton title="Xác nhận bỏ vào thùng rác" icon="checkmark-circle-outline" onPress={confirm} loading={saving}/>
      <View style={{ height: 16 }} />
    </> : error ? <Card><Text style={s.error}>Không phân loại được ảnh: {error}</Text><Text style={s.helper}>Kiểm tra lại hình ảnh và chụp lại rõ nét hơn nhé.</Text><PrimaryButton title="Quay lại" onPress={() => { if (navigation?.canGoBack?.()) navigation.goBack(); else navigation?.navigate("MainTabs"); }} outline/></Card> : null}
  </Screen>;
}

export function BinDetectionScreen({ route, navigation }: any) {
  const event = route.params?.event || {};
  const rawUri = route.params?.imageUri || event.imageUrl;
  const imageUri = rawUri ? (String(rawUri).startsWith("http") || String(rawUri).startsWith("file:") ? rawUri : `${API_URL}${rawUri}`) : null;
  const result = {
    wasteType: event.detectedLabel || "Vật thể từ camera thùng rác",
    category: event.category || "Chưa phân loại",
    confidence: Number(event.confidence) || 0,
    binCompartment: event.BinCompartment || event.binCompartment || (event.category === "Hữu cơ" ? "Ngăn 1 · Hữu cơ" : event.category === "Vô cơ" ? "Ngăn 2 · Vô cơ" : "Chưa xác định"),
    instructions: Array.isArray(event.Instructions) ? event.Instructions : Array.isArray(event.instructions) ? event.instructions : [],
    disposalMethod: event.DisposalMethod || event.disposalMethod || "Kiểm tra vật thể và hướng dẫn phân loại trước khi bỏ vào thùng.",
  };
  return <Screen>
    <Header
      title="Phát hiện từ camera thùng"
      subtitle="Ảnh và kết quả do Raspberry Pi gửi lên"
      showBack
      onBack={() => {
        if (navigation?.canGoBack?.()) navigation.goBack();
        else navigation?.navigate("MainTabs");
      }}
    />
    {imageUri ? <Image source={{ uri: imageUri }} style={s.photoLarge} resizeMode="cover"/> : <View style={s.photoPlaceholder}><Ionicons name="camera-outline" size={38} color={colors.primary}/><Text style={s.helper}>Chưa có ảnh camera gửi lên</Text></View>}
    <Card style={s.eventCard}><View style={s.eventIcon}><Ionicons name="checkmark" color={colors.primary} size={20}/></View><View style={{ flex: 1 }}><Text style={s.eventTitle}>Camera đã ghi nhận</Text><Text style={s.helper}>{event.MacAddress || event.macAddress || "EcoBin · 2 ngăn"}</Text><Text style={s.small}>{event.CreatedAt || event.createdAt ? new Date(event.CreatedAt || event.createdAt).toLocaleString() : "Vừa nhận ảnh"}</Text></View></Card>
    <Text style={s.section}>Kết quả AI nhận diện</Text>
    <Card><Text style={s.category}>{result.wasteType}</Text><Text style={s.helper}>Nhóm: {result.category}</Text><Text style={s.helper}>Ngăn đề xuất: {result.binCompartment}</Text>{result.confidence > 0 ? <Text style={s.small}>Độ tin cậy: {result.confidence}%</Text> : null}<Text style={s.section}>Cách xử lý</Text><Text style={s.helper}>{result.disposalMethod}</Text>{result.instructions.map((step:string,index:number)=><Text key={`${index}-${step}`} style={s.stepText}>{index+1}. {step}</Text>)}{event.Note || event.note ? <Text style={s.small}>{event.Note || event.note}</Text> : null}</Card>
    <WasteAssistant result={result} />
    <View style={{ height: 16 }} />
  </Screen>;
}

const s = StyleSheet.create({ photo: { width: "100%", height: 170, borderRadius: 18, backgroundColor: colors.pale, marginBottom: 14 }, photoLarge: { width: "100%", height: 270, borderRadius: 18, backgroundColor: colors.pale, marginBottom: 14 }, photoPlaceholder: { height: 170, borderRadius: 18, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center", marginBottom: 14, gap: 8 }, loading: { alignItems: "center", gap: 10, paddingVertical: 28 }, helper: { color: colors.sub, fontSize: 11, lineHeight: 17, marginTop: 4 }, small: { color: colors.sub, fontSize: 10, lineHeight: 15, marginTop: 7 }, name: { color: colors.text, fontSize: 21, fontWeight: "900", flex: 1 }, resultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }, label: { fontSize: 10, color: colors.primary, fontWeight: "900", letterSpacing: 0.5 }, category: { fontSize: 18, fontWeight: "900", color: colors.text, marginTop: 5, marginBottom: 12 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, score: { color: colors.primary, fontWeight: "900", fontSize: 13 }, section: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 10, marginTop: 5 }, step: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 }, stepNumber: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" }, stepNumberText: { color: colors.primary, fontWeight: "900", fontSize: 11 }, stepText: { flex: 1, fontSize: 12, color: colors.sub, lineHeight: 18 }, tip: { flexDirection: "row", gap: 9, alignItems: "flex-start" }, error: { color: colors.danger, fontSize: 11, marginVertical: 8 }, eventCard: { flexDirection: "row", gap: 12, alignItems: "center" }, eventIcon: { width: 38, height: 38, borderRadius: 20, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" }, eventTitle: { color: colors.text, fontWeight: "800", fontSize: 13 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
  nhanBox: { borderRadius: 14, borderWidth: 1.5, padding: 12, marginBottom: 12 },
  nhanBoxOk: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
  nhanBoxNone: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  nhanHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  nhanHeaderTitle: { fontSize: 11, fontWeight: "900", color: colors.primary, flex: 1, marginLeft: 6 },
  nhanBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  nhanBadgeOk: { backgroundColor: "#DCFCE7" },
  nhanBadgeNone: { backgroundColor: "#FEE2E2" },
  nhanBadgeText: { fontSize: 10, fontWeight: "900" },
  nhanBadgeTextOk: { color: "#166534" },
  nhanBadgeTextNone: { color: "#991B1B" },
  nhanName: { fontSize: 17, fontWeight: "900", color: colors.text, marginBottom: 4 },
  nhanComp: { fontSize: 13, color: colors.sub },
  photoContainer: { position: "relative", width: "100%", borderRadius: 18, overflow: "hidden", backgroundColor: colors.pale, marginBottom: 12 },
  photoFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  yoloBBox: { position: "absolute", top: "10%", left: "14%", right: "14%", bottom: "10%", borderWidth: 2.5, borderColor: "#22C55E", backgroundColor: "rgba(34, 197, 94, 0.12)", borderRadius: 6 },
  yoloBBoxNone: { position: "absolute", top: "14%", left: "14%", right: "14%", bottom: "14%", borderWidth: 2, borderColor: "#EF4444", borderStyle: "dashed", backgroundColor: "rgba(239, 68, 68, 0.08)", borderRadius: 6 },
  yoloTag: { position: "absolute", top: 0, left: 0, backgroundColor: "#16A34A", paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 4, flexDirection: "row", alignItems: "center", elevation: 3 },
  yoloTagNone: { position: "absolute", top: -14, left: -2, backgroundColor: "#DC2626", paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 4, flexDirection: "row", alignItems: "center" },
  yoloTagText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },
  yoloCorner: { position: "absolute", width: 14, height: 14, borderColor: "#4ADE80" },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
  quickChangeBox: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  quickChangeTitle: { fontSize: 11, fontWeight: "800", color: colors.text, marginBottom: 6 },
  quickChangeScroll: { gap: 6, paddingRight: 6 },
  quickPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  quickPillActive: { backgroundColor: "#DCFCE7", borderColor: colors.primary },
  quickPillText: { fontSize: 11, fontWeight: "700", color: colors.sub },
  quickPillTextActive: { color: "#166534", fontWeight: "900" },
});
