import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export default function LoginScreen({ navigation, onLogin }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (!email || !password) return Alert.alert("Thiếu thông tin", "Nhập email và mật khẩu");
    onLogin({ email }); // tạm thời: chưa gọi API
  };

  return (
    <View style={s.container}>
      <Ionicons name="trash-outline" size={72} color={colors.primary} />
      <Text style={s.title}>Thùng Rác Thông Minh</Text>
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Mật khẩu" secureTextEntry
        value={password} onChangeText={setPassword} />
      <TouchableOpacity style={s.btn} onPress={handleLogin}>
        <Text style={s.btnText}>Đăng nhập</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("Register")}>
        <Text style={s.link}>Chưa có tài khoản? Đăng ký</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "700", color: colors.primary, textAlign: "center", marginVertical: 16 },
  input: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  btn: { backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: colors.primary, textAlign: "center", marginTop: 16 },
});