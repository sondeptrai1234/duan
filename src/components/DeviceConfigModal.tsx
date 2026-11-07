import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import {
  DEFAULT_API_URL,
  getApiUrl,
  getRaspiUrl,
  loadSavedNetworkConfig,
  resetNetworkConfig,
  saveNetworkConfig,
} from "../config";
import { api } from "../services/api";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function DeviceConfigModal({ visible, onClose, onSaved }: Props) {
  const [apiUrl, setApiUrlState] = useState("");
  const [raspiUrl, setRaspiUrlState] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    pingMs?: number;
    database?: string;
    sqlServer?: any;
    error?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (visible) {
      loadSavedNetworkConfig().then((cfg) => {
        setApiUrlState(cfg.apiUrl || getApiUrl());
        setRaspiUrlState(cfg.raspiUrl || getRaspiUrl());
      });
      setTestResult(null);
    }
  }, [visible]);

  const handleTestConnection = async () => {
    if (!apiUrl.trim()) {
      Alert.alert("Chưa nhập IP", "Vui lòng nhập địa chỉ HTTP máy chủ trước khi kiểm tra.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.checkHealth(apiUrl.trim());
      if (result.ok) {
        setTestResult({
          ok: true,
          pingMs: result.pingMs,
          database: result.data?.database,
          sqlServer: result.data?.sqlServer,
        });
      } else {
        setTestResult({
          ok: false,
          pingMs: result.pingMs,
          error: result.error || "Không nhận được phản hồi từ máy chủ.",
        });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        error: err.message || "Lỗi kiểm tra kết nối.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiUrl.trim()) {
      Alert.alert("Lỗi", "Địa chỉ máy chủ Backend không được để trống.");
      return;
    }
    setSaving(true);
    try {
      await saveNetworkConfig(apiUrl, raspiUrl);
      Alert.alert(
        "Đã lưu cấu hình! 🎉",
        `Đã chuyển địa chỉ máy chủ sang:\n${apiUrl.trim()}\n\nToàn bộ app (quét rác, chat AI, thông báo) sẽ kết nối theo địa chỉ này.`,
        [{ text: "OK", onPress: () => { onSaved?.(); onClose(); } }]
      );
    } catch (err: any) {
      Alert.alert("Lỗi lưu cấu hình", err.message || "Không thể lưu vào bộ nhớ.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = async () => {
    Alert.alert(
      "Khôi phục mặc định",
      `Bạn có muốn khôi phục về địa chỉ IP tự động của mạng Metro:\n${DEFAULT_API_URL}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Khôi phục",
          onPress: async () => {
            const def = await resetNetworkConfig();
            setApiUrlState(def);
            setRaspiUrlState("http://192.168.4.1:8000");
            setTestResult(null);
            Alert.alert("Đã khôi phục", "Đã đặt lại địa chỉ IP mặc định.");
          },
        },
      ]
    );
  };

  const handleOpenRaspiPortal = () => {
    const target = raspiUrl.trim() || "http://192.168.4.1:8000";
    Linking.openURL(target).catch(() => {
      Alert.alert(
        "Không thể mở liên kết",
        `Hãy đảm bảo điện thoại của bạn đã kết nối vào Wi-Fi của Raspberry Pi (EcoBin_Setup) hoặc cùng mạng Wi-Fi với Pi, sau đó mở trình duyệt vào ${target}`
      );
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modalContainer}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={s.iconWrap}>
                <Ionicons name="hardware-chip-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={s.title}>Thiết bị & Cấu hình mạng</Text>
                <Text style={s.subtitle}>EcoBin 2 ngăn · PI-NHOM4-001</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
            {/* THIẾT BỊ ECOBIN INFO */}
            <View style={s.infoCard}>
              <View style={s.rowBetween}>
                <Text style={s.infoLabel}>Mã định danh (MAC):</Text>
                <Text style={s.infoValue}>PI-NHOM4-001</Text>
              </View>
              <View style={s.rowBetween}>
                <Text style={s.infoLabel}>Cơ chế phân loại:</Text>
                <Text style={s.infoValue}>2 ngăn (Hữu cơ & Vô cơ)</Text>
              </View>
              <View style={s.rowBetween}>
                <Text style={s.infoLabel}>Mô hình AI nhận diện:</Text>
                <Text style={[s.infoValue, { color: colors.primary }]}>YOLOv8 best.pt (8 classes)</Text>
              </View>
            </View>

            {/* MỤC 1: ĐỊA CHỈ HTTP SERVER BACKEND */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>1. Địa chỉ Máy chủ Backend (HTTP API)</Text>
              <Text style={s.sectionDesc}>
                Nhập địa chỉ IP máy tính đang chạy server (cổng 3000). Khi đổi mạng Wi-Fi hoặc phát 4G, chỉ cần sửa IP tại đây:
              </Text>

              <View style={s.inputContainer}>
                <Ionicons name="globe-outline" size={18} color={colors.primary} style={{ marginLeft: 10 }} />
                <TextInput
                  value={apiUrl}
                  onChangeText={setApiUrlState}
                  placeholder="http://192.168.1.xxx:3000"
                  placeholderTextColor={colors.sub}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={s.textInput}
                />
              </View>

              <View style={s.btnRow}>
                <TouchableOpacity
                  style={[s.testBtn, testing && { opacity: 0.6 }]}
                  onPress={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="flash-outline" size={16} color="#fff" />
                      <Text style={s.testBtnText}>Kiểm tra kết nối</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={s.resetBtn} onPress={handleResetDefault}>
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                  <Text style={s.resetBtnText}>Mặc định</Text>
                </TouchableOpacity>
              </View>

              {/* TEST RESULT BADGE */}
              {testResult && (
                <View style={[s.resultBox, testResult.ok ? s.resultBoxOk : s.resultBoxError]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons
                      name={testResult.ok ? "checkmark-circle" : "alert-circle"}
                      size={18}
                      color={testResult.ok ? "#15803D" : "#B91C1C"}
                    />
                    <Text style={[s.resultTitle, { color: testResult.ok ? "#15803D" : "#B91C1C" }]}>
                      {testResult.ok ? `Kết nối thành công (${testResult.pingMs}ms)` : "Kết nối thất bại"}
                    </Text>
                  </View>
                  {testResult.ok ? (
                    <View style={{ marginTop: 4 }}>
                      <Text style={s.resultDetail}>
                        • Cơ sở dữ liệu: <Text style={{ fontWeight: "800" }}>{testResult.database || "Sẵn sàng"}</Text>
                      </Text>
                      {testResult.sqlServer && (
                        <Text style={s.resultDetail}>
                          • SQL Server: {testResult.sqlServer.database} ({testResult.sqlServer.status})
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={s.resultDetail}>• {testResult.error}</Text>
                  )}
                </View>
              )}
            </View>

            {/* MỤC 2: CƠ SỞ DỮ LIỆU SQL SERVER */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>2. Thông tin Kết nối SQL Server</Text>
              <Text style={s.sectionDesc}>
                Máy chủ Backend quản lý kết nối CSDL và cung cấp dữ liệu an toàn cho App:
              </Text>
              <View style={s.sqlBox}>
                <View style={s.sqlRow}>
                  <Text style={s.sqlKey}>Database:</Text>
                  <Text style={s.sqlVal}>SmartTrashDB (Port 1433)</Text>
                </View>
                <View style={s.sqlRow}>
                  <Text style={s.sqlKey}>Tài khoản mặc định:</Text>
                  <Text style={s.sqlVal}>admin / admin123</Text>
                </View>
                <View style={s.sqlRow}>
                  <Text style={s.sqlKey}>Chế độ dự phòng:</Text>
                  <Text style={s.sqlVal}>Tự động In-Memory khi chưa có sa pass</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>Lưu & Áp dụng ngay</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
  },
  subtitle: {
    fontSize: 11,
    color: colors.sub,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    maxHeight: 520,
  },
  bodyContent: {
    padding: 20,
    gap: 18,
  },
  infoCard: {
    backgroundColor: "#F8FAF9",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2EBE5",
    gap: 8,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 12,
    color: colors.sub,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },
  sectionDesc: {
    fontSize: 11,
    color: colors.sub,
    lineHeight: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: "#F9FBFA",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    fontWeight: "700",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  testBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  testBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  resetBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  resultBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
  },
  resultBoxOk: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  resultBoxError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  resultDetail: {
    fontSize: 11,
    color: colors.text,
    marginTop: 2,
    lineHeight: 15,
  },
  sqlBox: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  sqlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sqlKey: {
    fontSize: 11,
    color: colors.sub,
    fontWeight: "600",
  },
  sqlVal: {
    fontSize: 11,
    color: colors.text,
    fontWeight: "800",
  },
  portalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#E0F2FE",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
  },
  portalBtnText: {
    color: "#0369A1",
    fontSize: 12,
    fontWeight: "800",
  },
  guideToggle: {
    marginTop: 6,
    alignSelf: "flex-start",
  },
  guideToggleText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "800",
  },
  guideContent: {
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E5EBE7",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  guideStep: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 16,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cancelBtnText: {
    fontSize: 13,
    color: colors.sub,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});
