import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { colors } from "../theme";

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = () => {
    if (!fullName || !email || !password) return Alert.alert("Thiếu thông tin", "Nhập đầy đủ các ô");
    Alert.alert("Thành công", "Tạm thời chưa lưu vào database (làm ở bước sau)");
    navigation.goBack();
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Tạo tài khoản</Text>
      <TextInput style={s.input} placeholder="Họ và tên" value={fullName} onChangeText={setFullName} />
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Mật khẩu" secureTextEntry
        value={password} onChangeText={setPassword} />
      <TouchableOpacity style={s.btn} onPress={handleRegister}>
        <Text style={s.btnText}>Đăng ký</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "700", color: colors.primary, textAlign: "center", marginBottom: 20 },
  input: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  btn: { backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});