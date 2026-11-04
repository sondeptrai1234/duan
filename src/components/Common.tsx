import React, { useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors, fillColor } from "../theme";

export function Screen({ children, scroll = true, style }: React.PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  if (!scroll) return <View style={[styles.screen, style]}>{children}</View>;
  return <ScrollView style={[styles.screen, style]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}
export function Header({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>{action ? <TouchableOpacity onPress={onAction}><Text style={styles.action}>{action}</Text></TouchableOpacity> : null}</View>;
}
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{title}</Text>{action ? <TouchableOpacity onPress={onAction}><Text style={styles.action}>{action}</Text></TouchableOpacity> : null}</View>;
}
export function Card({ children, style }: React.PropsWithChildren<{ style?: ViewStyle }>) { return <View style={[styles.card, style]}>{children}</View>; }
export function PrimaryButton({ title, onPress, icon, disabled, loading, outline }: { title: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; loading?: boolean; outline?: boolean }) {
  return <TouchableOpacity activeOpacity={0.86} disabled={disabled || loading} onPress={onPress} style={[styles.button, outline && styles.outlineButton, (disabled || loading) && { opacity: 0.55 }]}>
    {loading ? <ActivityIndicator color={outline ? colors.primary : "#fff"} /> : <>{icon ? <Ionicons name={icon} size={18} color={outline ? colors.primary : "#fff"} /> : null}<Text style={[styles.buttonText, outline && { color: colors.primary }]}>{title}</Text></>}
  </TouchableOpacity>;
}
export function Pill({ label, kind = "success" }: { label: string; kind?: "success" | "warning" | "danger" | "neutral" }) {
  const p = kind === "danger" ? ["#FCE9E8", colors.danger] : kind === "warning" ? ["#FFF2DF", colors.warn] : kind === "neutral" ? ["#EDF1EE", colors.sub] : ["#E7F5EC", colors.primary];
  return <View style={[styles.pill, { backgroundColor: p[0] }]}><Text style={[styles.pillText, { color: p[1] }]}>{label}</Text></View>;
}
export function ProgressBar({ value, height = 9 }: { value: number; height?: number }) {
  const progress = useSharedValue(0); const safe = Math.max(0, Math.min(100, Number(value) || 0));
  useEffect(() => { progress.value = withTiming(safe, { duration: 600 }); }, [safe, progress]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  return <View style={{ height, backgroundColor: "#E7EEE8", borderRadius: height, overflow: "hidden" }}><Animated.View style={[{ height, borderRadius: height, backgroundColor: fillColor(safe) }, animated]} /></View>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ marginBottom: 14 }}><Text style={styles.fieldLabel}>{label}</Text><TextInput placeholderTextColor="#A5B1A9" style={styles.input} {...props} /></View>;
}
export function EmptyState({ title, description, icon = "leaf-outline" }: { title: string; description: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name={icon} size={26} color={colors.primary} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{description}</Text></View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 17, gap: 10 }, title: { color: colors.text, fontWeight: "800", fontSize: 23, letterSpacing: -0.35 }, subtitle: { color: colors.sub, fontSize: 12, marginTop: 4 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 11 }, sectionTitle: { fontSize: 16, color: colors.text, fontWeight: "800" }, action: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: "#17372B", shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  button: { minHeight: 48, backgroundColor: colors.primary, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 18 }, outlineButton: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CFE5D6" }, buttonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 30, alignSelf: "flex-start" }, pillText: { fontSize: 10, fontWeight: "800" }, fieldLabel: { color: colors.text, fontWeight: "700", fontSize: 12, marginBottom: 7 }, input: { minHeight: 48, backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, color: colors.text, fontSize: 14 },
  empty: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 24 }, emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center", marginBottom: 12 }, emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" }, emptyText: { color: colors.sub, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 5 },
});
