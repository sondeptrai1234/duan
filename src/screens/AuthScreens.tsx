import React, { useState } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  Text, TouchableOpacity, View, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { Field, PrimaryButton } from "../components/Common";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import { getApiUrl } from "../config";
import { DeviceConfigModal } from "../components/DeviceConfigModal";
import type { User } from "../types";

export function LoginScreen({ navigation, route }: any) {
  // Không điền sẵn thông tin, để người dùng tự nhập tài khoản
  const [email, setEmail] = useState(route.params?.email || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [configModal, setConfigModal] = useState(false);

  // Quên mật khẩu modal state
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login } = useApp();

  const submit = async () => {
    if (!email.trim() || !password) {
      return Alert.alert("Thiếu thông tin", "Vui lòng nhập tài khoản/email và mật khẩu.");
    }
    setLoading(true);
    try {
      const result = await api.post<{ user: User }>("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      if (result?.user) {
        login(result.user, false);
      } else {
        throw new Error("Không nhận được dữ liệu xác thực.");
      }
    } catch (error: any) {
      if (error?.status === 401) {
        Alert.alert(
          "Đăng nhập thất bại ❌",
          "Tài khoản hoặc mật khẩu không chính xác trong hệ thống. Vui lòng kiểm tra lại!"
        );
      } else {
        Alert.alert(
          "Không thể xác thực tài khoản ⚠️",
          `Không thể kết nối tới máy chủ (${getApiUrl()}) để xác thực tài khoản.\n\nVui lòng kiểm tra lại địa chỉ IP máy chủ hoặc kết nối mạng Wi-Fi!`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotEmail.trim()) {
      return Alert.alert("Thiếu thông tin", "Vui lòng nhập tài khoản hoặc email cần đổi mật khẩu.");
    }
    if (!newPass || newPass.length < 6) {
      return Alert.alert("Mật khẩu yếu", "Mật khẩu mới phải có tối thiểu 6 ký tự.");
    }
    if (newPass !== confirmPass) {
      return Alert.alert("Mật khẩu không khớp", "Hai ô mật khẩu mới phải giống nhau. Vui lòng kiểm tra lại.");
    }

    setForgotLoading(true);
    try {
      await api.post("/api/auth/reset-password", {
        email: forgotEmail.trim().toLowerCase(),
        password: newPass,
      });
      setForgotModal(false);
      setEmail(forgotEmail.trim().toLowerCase());
      setPassword("");
      setForgotEmail("");
      setNewPass("");
      setConfirmPass("");
      Alert.alert("Đổi mật khẩu thành công! 🎉", "Mật khẩu của bạn đã được cập nhật vào Database. Hãy đăng nhập với mật khẩu mới.");
    } catch (err: any) {
      Alert.alert("Lỗi đổi mật khẩu", err?.message || "Không thể cập nhật mật khẩu. Vui lòng kiểm tra lại tài khoản.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.auth}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header row với icon cài đặt IP server */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 12 }}>
            <View style={{ width: 40 }} />
            <View style={s.logo}>
              <Ionicons name="leaf" size={48} color={colors.primary} />
            </View>
            <TouchableOpacity
              onPress={() => setConfigModal(true)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#E7F5EC", justifyContent: "center", alignItems: "center" }}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={s.brand}>Nhom4 🌿</Text>
          <Text style={s.tagline}>Hệ thống phân loại rác thông minh EcoBin</Text>

          <Text style={s.sectionTitle}>Đăng nhập</Text>
          <Field
            label="Tài khoản / Email"
            placeholder="Nhập tài khoản hoặc email của bạn"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <Field
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={s.forgot}
            onPress={() => {
              setForgotEmail(email);
              setNewPass("");
              setConfirmPass("");
              setForgotModal(true);
            }}
          >
            <Text style={s.link}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          <PrimaryButton title="Đăng nhập" onPress={submit} loading={loading} />

          <View style={s.or}>
            <View style={s.rule} /><Text style={s.orText}>hoặc</Text><View style={s.rule} />
          </View>

          <TouchableOpacity onPress={() => navigation.navigate("Register")} style={{ marginBottom: 4 }}>
            <Text style={s.footer}>Chưa có tài khoản? <Text style={s.link}>Đăng ký ngay</Text></Text>
          </TouchableOpacity>

          <View style={s.privacyBox}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
            <Text style={s.privacyText}>
              {"Nhom4 cam kết bảo mật dữ liệu.\nKhông chia sẻ thông tin với bất kỳ bên thứ ba nào."}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL QUÊN MẬT KHẨU / ĐỔI MẬT KHẨU (2 LẦN NHẬP GIỐNG NHAU) */}
      <Modal visible={forgotModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalOverlay}
        >
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="key-outline" size={20} color={colors.primary} />
                <Text style={s.modalTitle}>Đổi / Quên mật khẩu</Text>
              </View>
              <TouchableOpacity onPress={() => setForgotModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colors.sub} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalDesc}>
              Nhập tài khoản và mật khẩu mới. Bạn cần nhập 2 lần mật khẩu giống nhau để xác thực đổi mật khẩu.
            </Text>

            <Field
              label="Tài khoản / Email"
              placeholder="admin@nhom4.vn"
              value={forgotEmail}
              onChangeText={setForgotEmail}
              autoCapitalize="none"
            />
            <Field
              label="Mật khẩu mới (tối thiểu 6 ký tự)"
              placeholder="••••••"
              value={newPass}
              onChangeText={setNewPass}
              secureTextEntry
            />
            <Field
              label="Nhập lại mật khẩu mới"
              placeholder="••••••"
              value={confirmPass}
              onChangeText={setConfirmPass}
              secureTextEntry
            />

            <View style={{ marginTop: 8 }}>
              <PrimaryButton
                title="Xác nhận đổi mật khẩu"
                onPress={handleResetPassword}
                loading={forgotLoading}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DeviceConfigModal
        visible={configModal}
        onClose={() => setConfigModal(false)}
      />
    </SafeAreaView>
  );
}

export function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!fullName.trim() || !email.trim()) {
      return Alert.alert("Thiếu thông tin", "Vui lòng nhập đầy đủ họ tên và tài khoản/email.");
    }
    if (!password || password.length < 6) {
      return Alert.alert("Mật khẩu yếu", "Mật khẩu phải có tối thiểu 6 ký tự.");
    }
    if (password !== confirmPassword) {
      return Alert.alert("Mật khẩu không khớp", "Mật khẩu và ô nhập lại mật khẩu phải giống nhau.");
    }

    setLoading(true);
    try {
      const result = await api.post<{ user: User }>("/api/auth/register", {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      // Tạo tài khoản thành công -> KHÔNG tự đăng nhập mà điều hướng về màn hình Đăng nhập
      Alert.alert(
        "Tạo tài khoản thành công! 🎉",
        `Chào mừng ${result.user?.fullName || fullName}!\nTài khoản của bạn đã được lưu vào Database.\nHãy đăng nhập để bắt đầu.`,
        [
          {
            text: "Đăng nhập ngay",
            onPress: () => {
              navigation.navigate("Login", { email: email.trim().toLowerCase() });
            },
          },
        ]
      );
    } catch (error: any) {
      if (error?.status === 409) {
        Alert.alert("Tài khoản đã tồn tại", "Email/tài khoản này đã được đăng ký. Hãy dùng tài khoản khác hoặc quay lại đăng nhập.");
      } else {
        Alert.alert("Lỗi kết nối", "Không thể kết nối máy chủ database. Vui lòng thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.auth}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.logoSmall}>
            <Ionicons name="leaf" size={34} color={colors.primary} />
          </View>
          <Text style={s.brand}>Tạo tài khoản</Text>
          <Text style={s.tagline}>Tham gia cộng đồng phân loại rác EcoBin Nhom4 🌿</Text>

          <Field
            label="Họ và tên"
            placeholder="Nguyễn Văn A"
            value={fullName}
            onChangeText={setFullName}
          />
          <Field
            label="Tài khoản / Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <Field
            label="Mật khẩu (tối thiểu 6 ký tự)"
            placeholder="••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Field
            label="Nhập lại mật khẩu"
            placeholder="••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <PrimaryButton title="Tạo tài khoản & Lưu vào Database" onPress={submit} loading={loading} />

          <TouchableOpacity
            onPress={() => navigation.navigate("Login")}
            style={{ marginTop: 20 }}
          >
            <Text style={s.footer}>Đã có tài khoản? <Text style={s.link}>Đăng nhập</Text></Text>
          </TouchableOpacity>

          <View style={s.privacyBox}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
            <Text style={s.privacyText}>
              {"Bằng cách đăng ký, bạn đồng ý với Điều khoản sử dụng của Nhom4.\nThông tin được lưu trữ an toàn trong Database."}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  auth: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingVertical: 36,
  },
  logo: {
    alignSelf: "center",
    width: 100, height: 100,
    borderRadius: 34,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoSmall: {
    alignSelf: "center",
    width: 72, height: 72,
    borderRadius: 26,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  brand: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.primary,
    textAlign: "center",
  },
  tagline: {
    fontSize: 13,
    color: colors.sub,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 14,
  },
  forgot: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 18,
  },
  or: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
    gap: 12,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  orText: {
    fontSize: 12,
    color: colors.sub,
    fontWeight: "600",
  },
  footer: {
    textAlign: "center",
    color: colors.sub,
    fontSize: 13,
  },
  link: {
    color: colors.primary,
    fontWeight: "800",
  },
  privacyBox: {
    marginTop: 24,
    padding: 12,
    backgroundColor: "#F0F5F2",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  privacyText: {
    flex: 1,
    fontSize: 10,
    color: colors.sub,
    lineHeight: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    gap: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
  },
  modalDesc: {
    fontSize: 11,
    color: colors.sub,
    lineHeight: 16,
    marginBottom: 8,
  },
});
