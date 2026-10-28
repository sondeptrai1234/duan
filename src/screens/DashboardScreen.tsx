import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../config";
import { colors } from "../theme";
import FillBar from "../components/FillBar";

export default function DashboardScreen({ navigation }: any) {
  const [cans, setCans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/trashcans`);
      setCans(await res.json());
      setError("");
    } catch {
      setError("Không kết nối được server. Kiểm tra IP trong src/config.ts");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = async () => {
    setLoading(true);
    await load();
    setLoading(false);
  };

  return (
    <View style={s.container}>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <FlatList
        data={cans}
        keyExtractor={(i) => String(i.TrashCanID)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={s.empty}>Chưa có thùng rác nào</Text>}
        renderItem={({ item }) => {
          const fill = Math.round(item.FillLevel ?? 0);
          const online = item.Status === "Online";
          return (
            <TouchableOpacity style={s.card} onPress={() => navigation.navigate("Detail", { can: item })}>
              <View style={s.row}>
                <Text style={s.name}>{item.Name}</Text>
                <View style={[s.dot, { backgroundColor: online ? colors.ok : "#9CA3AF" }]} />
              </View>
              <Text style={s.percent}>{item.FillLevel == null ? "--" : `${fill}%`}</Text>
              <FillBar value={fill} />
              <View style={[s.row, { marginTop: 10 }]}>
                <Text style={s.sub}><Ionicons name="thermometer-outline" size={14} /> {item.Temperature ?? "--"}°C</Text>
                <Text style={s.sub}><Ionicons name="water-outline" size={14} /> {item.Humidity ?? "--"}%</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 17, fontWeight: "600", color: colors.text },
  dot: { width: 10, height: 10, borderRadius: 5 },
  percent: { fontSize: 32, fontWeight: "700", color: colors.text, marginVertical: 6 },
  sub: { color: colors.sub },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { textAlign: "center", color: colors.sub, marginTop: 40 },
});