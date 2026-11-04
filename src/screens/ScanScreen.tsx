import React, { useRef, useState } from "react";
import { Alert, Image, Switch, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { PrimaryButton } from "../components/Common";

export default function ScanScreen({ navigation }: any) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cloudConsent, setCloudConsent] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openResult = (uri: string, base64?: string | null, mimeType = "image/jpeg") => {
    setPreviewUri(uri);
    navigation.navigate("ScanResult", { uri, base64: base64 || null, mimeType, cloudConsent });
  };
  const takePhoto = async () => {
    if (!permission?.granted) { const p = await requestPermission(); if (!p.granted) return; }
    if (!cameraReady || !cameraRef.current) return Alert.alert("Camera chưa sẵn sàng", "Chờ camera khởi động rồi chụp lại.");
    setBusy(true);
    try { const photo = await cameraRef.current.takePictureAsync({ quality: 0.75, base64: true }); if (photo?.uri) openResult(photo.uri, photo.base64, "image/jpeg"); }
    catch { Alert.alert("Không chụp được ảnh", "Hãy kiểm tra quyền camera và thử lại."); }
    finally { setBusy(false); }
  };
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.75, base64: true });
      if (!result.canceled) openResult(result.assets[0].uri, result.assets[0].base64, result.assets[0].mimeType || "image/jpeg");
    } catch { Alert.alert("Không mở được thư viện", "Kiểm tra quyền truy cập ảnh trên thiết bị."); }
  };

  return <View style={s.container}>
    <View style={s.top}><View><Text style={s.title}>Quét & phân loại</Text><Text style={s.subtitle}>Chụp ảnh hoặc chọn ảnh rác từ thư viện</Text></View><View style={s.topIcon}><Ionicons name="scan-outline" size={20} color={colors.primary} /></View></View>
    <View style={s.cameraFrame}>
      {previewUri ? <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : permission?.granted ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setCameraReady(true)} /> : <View style={s.permission}><Ionicons name="camera-outline" size={40} color="#B8F0CE"/><Text style={s.permissionText}>Cần quyền camera để chụp ảnh rác</Text><TouchableOpacity style={s.permissionBtn} onPress={requestPermission}><Text style={s.permissionBtnText}>Cấp quyền camera</Text></TouchableOpacity></View>}
      <View style={s.cornerTL}/><View style={s.cornerTR}/><View style={s.cornerBL}/><View style={s.cornerBR}/>
      <View style={s.cameraHint}><Text style={s.cameraHintText}>Đặt vật thể vào trong khung hình</Text></View>
    </View>
    <View style={s.actionRow}>
      <TouchableOpacity style={s.galleryBtn} onPress={pickImage}><Ionicons name="images-outline" color={colors.text} size={18}/><Text style={s.galleryText}>Thư viện ảnh</Text></TouchableOpacity>
      <TouchableOpacity style={[s.captureBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={takePhoto}><Ionicons name="camera" color="#fff" size={19}/><Text style={s.captureText}>{busy ? "Đang chụp..." : "Chụp ảnh"}</Text></TouchableOpacity>
    </View>
    <View style={s.tip}><Ionicons name="sunny-outline" size={20} color={colors.warn}/><View style={{ flex: 1 }}><Text style={s.tipTitle}>Mẹo chụp ảnh chính xác</Text><Text style={s.tipText}>Đặt rác trên nền đơn sắc, đủ ánh sáng và tránh che khuất vật thể.</Text></View></View>
    <View style={s.consent}><View style={{ flex: 1 }}><Text style={s.consentTitle}>Cho phép phân tích bằng AI máy chủ</Text><Text style={s.consentText}>Khi bật, ảnh sẽ được gửi đến backend đã cấu hình AI. Mặc định tắt, ảnh không rời khỏi thiết bị.</Text></View><Switch value={cloudConsent} onValueChange={setCloudConsent} trackColor={{ false: "#DDE7DF", true: "#9ADAB7" }} thumbColor={cloudConsent ? colors.primary : "#FFFFFF"}/></View>
    <Text style={s.privacy}><Ionicons name="shield-checkmark-outline" size={13}/> Bạn có thể dùng chế độ demo mà không gửi ảnh lên Internet.</Text>
  </View>;
}
const s = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.bg, padding: 18 }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }, title: { color: colors.text, fontWeight: "900", fontSize: 23 }, subtitle: { color: colors.sub, fontSize: 12, marginTop: 4 }, topIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" }, cameraFrame: { height: 350, borderRadius: 22, backgroundColor: colors.darkGreen, overflow: "hidden", justifyContent: "center", alignItems: "center" }, permission: { alignItems: "center", gap: 12, padding: 25 }, permissionText: { color: "#FFFFFF", fontSize: 13, textAlign: "center" }, permissionBtn: { backgroundColor: "#FFFFFF", paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 }, permissionBtnText: { color: colors.primary, fontWeight: "800" }, cornerTL: { position: "absolute", top: 18, left: 18, width: 22, height: 22, borderTopWidth: 3, borderLeftWidth: 3, borderColor: "#B8F0CE" }, cornerTR: { position: "absolute", top: 18, right: 18, width: 22, height: 22, borderTopWidth: 3, borderRightWidth: 3, borderColor: "#B8F0CE" }, cornerBL: { position: "absolute", bottom: 18, left: 18, width: 22, height: 22, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: "#B8F0CE" }, cornerBR: { position: "absolute", bottom: 18, right: 18, width: 22, height: 22, borderBottomWidth: 3, borderRightWidth: 3, borderColor: "#B8F0CE" }, cameraHint: { position: "absolute", bottom: 14, backgroundColor: "#17372B99", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }, cameraHintText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" }, actionRow: { flexDirection: "row", gap: 12, marginTop: 14 }, galleryBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, galleryText: { fontWeight: "700", color: colors.text, fontSize: 12 }, captureBtn: { flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, captureText: { fontWeight: "800", color: "#FFFFFF", fontSize: 12 }, tip: { marginTop: 16, backgroundColor: "#FFFFFF", borderRadius: 15, padding: 14, flexDirection: "row", gap: 12, alignItems: "center" }, tipTitle: { color: colors.text, fontWeight: "800", fontSize: 12 }, tipText: { color: colors.sub, fontSize: 11, lineHeight: 16, marginTop: 3 }, consent: { marginTop: 13, padding: 14, borderRadius: 15, backgroundColor: "#EAF5ED", flexDirection: "row", alignItems: "center", gap: 12 }, consentTitle: { color: colors.text, fontSize: 12, fontWeight: "800" }, consentText: { color: colors.sub, fontSize: 10, lineHeight: 15, marginTop: 4 }, privacy: { color: colors.sub, fontSize: 10, marginTop: 12, textAlign: "center" } });
