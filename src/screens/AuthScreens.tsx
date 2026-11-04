import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { Field, PrimaryButton } from "../components/Common";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import type { User } from "../types";

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);
  const { login } = useApp();
  const submit = async () => {
    if (!email.trim() || !password) return Alert.alert("Thiếu thông tin", "Nhập email và mật khẩu để tiếp tục.");
    setLoading(true);
    try {
      const result = await api.post<{ user: User }>("/api/auth/login", { email: email.trim().toLowerCase(), password });
      login(result.user, false);
    } catch (error: any) {
      if (error?.status === 401) Alert.alert("Không đăng nhập được", "Email hoặc mật khẩu chưa chính xác.");
      else {
        const demoUser: User = { fullName: email.split("@")[0] || "Người dùng EcoSort", email: email.trim().toLowerCase() };
        login(demoUser, true);
        Alert.alert("Đang dùng chế độ demo", "Backend chưa kết nối. Tài khoản demo chỉ tồn tại trong phiên chạy hiện tại.");
      }
    } finally { setLoading(false); }
  };
  const guest = () => login({ fullName: "Khách EcoSort", email: "guest@ecosort.demo" }, true);
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.auth}>
    <View style={s.logo}><Ionicons name="recycle" size={58} color={colors.primary} /></View>
    <Text style={s.brand}>EcoSort</Text>
    <Text style={s.tagline}>Sống xanh mỗi ngày</Text>
    <Text style={s.title}>Đăng nhập</Text>
    <Field label="Email" placeholder="Nhập email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
    <Field label="Mật khẩu" placeholder="Nhập mật khẩu" value={password} onChangeText={setPassword} secureTextEntry />
    <TouchableOpacity style={s.forgot} onPress={() => Alert.alert("Quên mật khẩu", "Chức năng gửi email đặt lại mật khẩu cần cấu hình SMTP ở backend.")}><Text style={s.link}>Quên mật khẩu?</Text></TouchableOpacity>
    <PrimaryButton title="Đăng nhập" onPress={submit} loading={loading} />
    <View style={s.or}><View style={s.rule} /><Text style={s.orText}>hoặc</Text><View style={s.rule} /></View>
    <PrimaryButton title="Dùng thử không cần tài khoản" onPress={guest} outline />
    <TouchableOpacity onPress={() => navigation.navigate("Register")} style={{ marginTop: 22 }}><Text style={s.footer}>Chưa có tài khoản? <Text style={s.link}>Đăng ký</Text></Text></TouchableOpacity>
    <Text style={s.privacy}>Ảnh chỉ được gửi lên máy chủ AI khi bạn chủ động bật quyền chia sẻ.</Text>
  </KeyboardAvoidingView>;
}

export function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);
  const { login } = useApp();
  const submit = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 6) return Alert.alert("Kiểm tra thông tin", "Nhập họ tên, email và mật khẩu tối thiểu 6 ký tự.");
    setLoading(true);
    try {
      const result = await api.post<{ user: User }>("/api/auth/register", { fullName: fullName.trim(), email: email.trim().toLowerCase(), password });
      login(result.user, false);
    } catch (error: any) {
      if (error?.status === 409) Alert.alert("Email đã tồn tại", "Hãy đăng nhập bằng tài khoản này.");
      else Alert.alert("Chưa tạo được tài khoản", "Không kết nối được backend hoặc database. Bạn có thể quay lại và dùng chế độ demo.");
    } finally { setLoading(false); }
  };
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.auth}>
    <View style={s.logoSmall}><Ionicons name="leaf" size={34} color={colors.primary} /></View>
    <Text style={s.brand}>Tạo tài khoản</Text><Text style={s.tagline}>Tham gia cộng đồng phân loại rác</Text>
    <Field label="Họ và tên" placeholder="Nguyễn Văn A" value={fullName} onChangeText={setFullName} />
    <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
    <Field label="Mật khẩu" placeholder="Tối thiểu 6 ký tự" value={password} onChangeText={setPassword} secureTextEntry />
    <PrimaryButton title="Tạo tài khoản" onPress={submit} loading={loading} />
    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 22 }}><Text style={s.footer}>Đã có tài khoản? <Text style={s.link}>Đăng nhập</Text></Text></TouchableOpacity>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({ auth: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", paddingHorizontal: 26, paddingVertical: 30 }, logo: { alignSelf: "center", width: 100, height: 100, borderRadius: 34, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center", marginBottom: 12 }, logoSmall: { alignSelf: "center", width: 72, height: 72, borderRadius: 26, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center", marginBottom: 15 }, brand: { color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center" }, tagline: { color: colors.sub, fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 34 }, title: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 16 }, forgot: { alignSelf: "flex-end", marginTop: -4, marginBottom: 16 }, link: { color: colors.primary, fontWeight: "800" }, or: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 }, rule: { height: 1, backgroundColor: colors.line, flex: 1 }, orText: { color: colors.sub, fontSize: 12 }, footer: { color: colors.sub, textAlign: "center", fontSize: 13 }, privacy: { color: colors.sub, textAlign: "center", fontSize: 10, lineHeight: 15, marginTop: 24 } });
