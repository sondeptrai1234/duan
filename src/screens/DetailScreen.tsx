import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fillColor } from "../theme";
import FillBar from "../components/FillBar";

export default function DetailScreen({ route }: any) {
  const can = route.params.can;
  const fill = Math.round(can.FillLevel ?? 0);

  const sendCommand = (cmd: string) =>
    Alert.alert("Điều khiển", `Lệnh "${cmd}" sẽ hoạt động khi backend có API điều khiển nắp.`);

  const Tile = ({ icon, label, value }: any) => (
    <View style={s.tile}>
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={s.container}>
      <View style={s.card}>
        <Text style={s.name}>{can.Name}</Text>
        <Text style={s.address}>Trạng thái: {can.Status}</Text>
        <Text style={[s.big, { color: fillColor(fill) }]}>{can.FillLevel == null ? "--" : `${fill}%`}</Text>
        <FillBar value={fill} height={16} />
      </View>

      <View style={s.tiles}>
        <Tile icon="thermometer-outline" label="Nhiệt độ" value={`${can.Temperature ?? "--"}°C`} />
        <Tile icon="water-outline" label="Độ ẩm" value={`${can.Humidity ?? "--"}%`} />
        <Tile icon="lock-open-outline" label="Nắp" value={can.LidState ?? "--"} />
      </View>

      <Text style={s.section}>Điều khiển nắp</Text>
      <View style={s.btnRow}>
        <TouchableOpacity style={s.btn} onPress={() => sendCommand("open")}>
          <Text style={s.btnText}>Mở</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => sendCommand("close")}>
          <Text style={s.btnText}>Đóng</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { backgroundColor: colors.danger }]} onPress={() => sendCommand("lock")}>
          <Text style={s.btnText}>Khóa</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 20, marginBottom: 16 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  address: { color: colors.sub, marginTop: 4 },
  big: { fontSize: 56, fontWeight: "800", marginVertical: 12 },
  tiles: { flexDirection: "row", gap: 12, marginBottom: 16 },
  tile: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, alignItems: "center" },
  tileValue: { fontSize: 18, fontWeight: "700", marginTop: 6 },
  tileLabel: { color: colors.sub, fontSize: 12 },
  section: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  btnRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});