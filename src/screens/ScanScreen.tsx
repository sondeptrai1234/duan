import React, { useEffect, useRef, useState } from "react";
import { Alert, Switch, Text, TouchableOpacity, View, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

async function prepareImage(uri: string) {
  const image = await manipulateAsync(uri, [{ resize: { width: 800 } }], {
    compress: 0.6, format: SaveFormat.JPEG, base64: true,
  });
  if (!image.base64) throw new Error("Không đọc được dữ liệu ảnh. Hãy chọn ảnh khác.");
  return { uri: image.uri, base64: image.base64, mimeType: "image/jpeg", width: image.width, height: image.height };
}

export default function ScanScreen({ navigation }: any) {
  const cameraRef = useRef<CameraView>(null);
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cloudConsent, setCloudConsent] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (focused && permission?.granted) {
      setCameraReady(true);
    }
  }, [focused, permission]);

  const sendToResult = (image: { uri: string; base64: string; mimeType: string; width?: number; height?: number }) => {
    navigation.navigate("ScanResult", {
      ...image,
      cloudConsent,
    });
  };

  const takePhoto = async () => {
    if (busy) return;
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) return Alert.alert("Cần quyền camera", "Hãy cấp quyền camera để quét rác.");
    }
    if (!cameraRef.current) return Alert.alert("Camera đang khởi động", "Chờ hình ảnh ổn định rồi chụp lại.");
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      if (!photo?.uri) throw new Error("Camera không trả về ảnh.");
      const image = await prepareImage(photo.uri);
      sendToResult(image);
    } catch (error: any) {
      Alert.alert("Không chụp được ảnh", error?.message || "Hãy thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        const image = await prepareImage(result.assets[0].uri);
        sendToResult(image);
      }
    } catch (error: any) {
      Alert.alert("Không mở được thư viện", error?.message || "Kiểm tra quyền truy cập ảnh.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.top}><View><Text style={s.title}>Quét & phân loại</Text><Text style={s.subtitle}>Chụp ảnh hoặc chọn ảnh rác từ thư viện</Text></View><View style={s.topIcon}><Ionicons name="scan-outline" size={21} color={colors.primary}/></View></View>
        <View style={s.cameraFrame}>
          {focused && permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              onCameraReady={() => setCameraReady(true)}
              onMountError={(e) => { setCameraReady(false); Alert.alert("Lỗi camera", e.message); }}
            />
          ) : (
            <View style={s.permission}>
              <Ionicons name="camera-outline" size={42} color="#B8F0CE"/>
              <Text style={s.permissionText}>{permission?.granted ? "Camera sẵn sàng khi vào màn hình" : "Cần quyền camera để chụp ảnh rác"}</Text>
              {!permission?.granted ? (
                <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}>
                  <Text style={s.permissionBtnText}>Cấp quyền camera</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          <View style={s.cornerTL}/><View style={s.cornerTR}/><View style={s.cornerBL}/><View style={s.cornerBR}/>
          <View style={s.cameraHint}><Text style={s.cameraHintText}>Mô hình AI (best.pt) tự động nhận diện</Text></View>
          {!cameraReady && focused && permission?.granted ? (
            <View style={s.loadingOverlay}><ActivityIndicator color="#fff"/><Text style={s.permissionText}>Đang mở camera...</Text></View>
          ) : null}
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity style={[s.galleryBtn, busy && s.disabled]} disabled={busy} onPress={pickImage}>
            <Ionicons name="images-outline" color={colors.text} size={20}/>
            <Text style={s.galleryText}>Thư viện ảnh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.captureBtn, busy && s.disabled]} disabled={busy} onPress={takePhoto}>
            {busy ? <ActivityIndicator size="small" color="#fff"/> : <Ionicons name="camera" color="#fff" size={20}/>}
            <Text style={s.captureText}>{busy ? "Đang xử lý ảnh..." : "Chụp ảnh"}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.tip}><Ionicons name="sunny-outline" size={22} color={colors.warn}/><View style={{flex:1}}><Text style={s.tipTitle}>Mẹo chụp ảnh chính xác</Text><Text style={s.tipText}>Đặt một vật thể ở giữa khung, đủ sáng và không che khuất.</Text></View></View>
        <View style={s.consent}><View style={{flex:1}}><Text style={s.consentTitle}>Bật AI Phân loại & Trợ lý</Text><Text style={s.consentText}>Mặc định chạy mô hình AI nội bộ Nhom4 (best.pt) trên máy.</Text></View><Switch value={cloudConsent} onValueChange={setCloudConsent} trackColor={{false:"#DDE7DF",true:"#9ADAB7"}} thumbColor={cloudConsent ? colors.primary : "#FFFFFF"}/></View>
        <Text style={s.privacy}><Ionicons name="shield-checkmark-outline" size={13}/> Camera tự tắt khi rời màn hình. Tự động nhận diện bằng mô hình AI.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  container:{flex:1,backgroundColor:colors.bg,padding:18},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16},title:{color:colors.text,fontWeight:"900",fontSize:23},subtitle:{color:colors.sub,fontSize:12,marginTop:4},topIcon:{width:42,height:42,borderRadius:15,backgroundColor:colors.pale,alignItems:"center",justifyContent:"center"},cameraFrame:{height:350,borderRadius:22,backgroundColor:colors.darkGreen,overflow:"hidden",justifyContent:"center",alignItems:"center"},permission:{alignItems:"center",gap:12,padding:25},permissionText:{color:"#FFFFFF",fontSize:12,textAlign:"center"},permissionBtn:{backgroundColor:"#FFFFFF",paddingHorizontal:15,paddingVertical:10,borderRadius:10},permissionBtnText:{color:colors.primary,fontWeight:"800"},cornerTL:{position:"absolute",top:18,left:18,width:22,height:22,borderTopWidth:3,borderLeftWidth:3,borderColor:"#B8F0CE"},cornerTR:{position:"absolute",top:18,right:18,width:22,height:22,borderTopWidth:3,borderRightWidth:3,borderColor:"#B8F0CE"},cornerBL:{position:"absolute",bottom:18,left:18,width:22,height:22,borderBottomWidth:3,borderLeftWidth:3,borderColor:"#B8F0CE"},cornerBR:{position:"absolute",bottom:18,right:18,width:22,height:22,borderBottomWidth:3,borderRightWidth:3,borderColor:"#B8F0CE"},cameraHint:{position:"absolute",bottom:14,backgroundColor:"#17372BCC",paddingHorizontal:12,paddingVertical:7,borderRadius:20},cameraHintText:{color:"#FFFFFF",fontSize:11,fontWeight:"700"},loadingOverlay:{...StyleSheet.absoluteFill as any,backgroundColor:"#17372B99",alignItems:"center",justifyContent:"center",gap:9},actionRow:{flexDirection:"row",gap:12,marginTop:14},galleryBtn:{flex:1,height:52,borderRadius:15,borderWidth:1,borderColor:colors.line,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center",flexDirection:"row",gap:8},galleryText:{fontWeight:"800",color:colors.text,fontSize:12},captureBtn:{flex:1,height:52,borderRadius:15,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:8},captureText:{fontWeight:"900",color:"#FFFFFF",fontSize:12},disabled:{opacity:.5},tip:{marginTop:15,backgroundColor:"#FFFFFF",borderRadius:16,padding:14,flexDirection:"row",gap:12,alignItems:"center"},tipTitle:{color:colors.text,fontWeight:"800",fontSize:12},tipText:{color:colors.sub,fontSize:11,lineHeight:16,marginTop:3},consent:{marginTop:13,padding:14,borderRadius:16,backgroundColor:"#EAF5ED",flexDirection:"row",alignItems:"center",gap:12},consentTitle:{color:colors.text,fontSize:12,fontWeight:"800"},consentText:{color:colors.sub,fontSize:10,lineHeight:15,marginTop:4},privacy:{color:colors.sub,fontSize:10,marginTop:11,textAlign:"center"},
});
