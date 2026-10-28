import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../config";
import { colors } from "../theme";

export default function NotificationsScreen() {
  const [alerts, setAlerts] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const cans = await (await fetch(`${API_URL}/api/trashcans`)).json();
      const list: any[] = [];
      cans.forEach((c: any) => {
        if (c.FillLevel >= 80)
          list.push({ id: `f${c.TrashCanID}`, icon: "trash", color: colors.warn, title: "Rác đầy", msg: `${c.Name} đã đầy ${Math.round(c.FillLevel)}%` });
        if (c.Temperature >= 50)
          list.push({ id: `t${c.TrashCanID}`, icon: "flame", color: colors.danger, title: "Nhiệt độ cao", msg: `${c.Name}: ${c.Temperature}°C, nguy cơ cháy` });
      });
      setAlerts(list);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <View style={s.container}>
      <FlatList
        data={alerts}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Text style={s.empty}>Không có cảnh báo nào</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Ionicons name={item.icon} size={28} color={item.color} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.msg}>{item.msg}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12 },
  title: { fontWeight: "700", fontSize: 16 },
  msg: { color: colors.sub, marginTop: 2 },
  empty: { textAlign: "center", color: colors.sub, marginTop: 40 },
});