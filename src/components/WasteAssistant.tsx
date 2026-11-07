import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { Card } from "./Common";
import { api } from "../services/api";
import type { WasteClassification } from "../types";

type ChatMessage = { role: "user" | "model"; text: string };

function FormattedMessageText({ text, isUser }: { text: string; isUser: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={[s.bubbleText, isUser && s.userText]}>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const boldContent = part.slice(2, -2);
          return (
            <Text key={idx} style={[s.bubbleBold, isUser && s.userText]}>
              {boldContent}
            </Text>
          );
        }
        return <Text key={idx}>{part}</Text>;
      })}
    </Text>
  );
}

export function WasteAssistant({
  result,
}: {
  result?: Partial<WasteClassification> | null;
}) {
  const initial = useMemo<ChatMessage[]>(() => [{
    role: "model",
    text: result?.wasteType
      ? `🌿 Trợ lý AI Nhóm 4 đã nhận diện: **${result.wasteType}** (${result.category || "chưa rõ nhóm"}).\n` +
        `📍 Đề xuất: **${result.binCompartment || result.binColor || "Thùng rác 2 ngăn"}**.\n` +
        `Bạn muốn hỏi cách làm sạch, ép dẹp, tái chế hay quy trình xử lý món rác này?`
      : "🌿 Xin chào! Mình là Trợ lý AI Nhóm 4. Bạn có thể hỏi bất cứ thắc mắc nào về phân loại rác, cách làm sạch và xử lý an toàn nhé!",
  }], [result?.wasteType, result?.category, result?.binCompartment, result?.binColor]);

  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<any>(null);

  useEffect(() => { setMessages(initial); setDraft(""); }, [initial]);
  useEffect(() => { threadRef.current?.scrollToEnd({ animated: true }); }, [messages, sending]);

  const quickQuestions = result?.wasteType
    ? ["Món này bỏ Ngăn 1 hay Ngăn 2?", "Cần rửa sạch hay ép dẹp không?", "Món này có tái chế được không?"]
    : ["Ngăn 1 và Ngăn 2 khác nhau thế nào?", "Pin cũ vứt ở đâu an toàn?", "Thức ăn thừa xử lý thế nào?"];

  const send = async (question?: string) => {
    const message = (question ?? draft).trim();
    if (!message || sending) return;
    const next = [...messages, { role: "user" as const, text: message }];
    setMessages(next);
    setDraft("");
    setSending(true);

    try {
      const response = await api.post<{ reply: string }>("/api/ai/chat", {
        message,
        history: next.slice(1, -1).slice(-8),
        context: result ? {
          wasteType: result.wasteType,
          category: result.category,
          confidence: result.confidence,
          binCompartment: result.binCompartment || result.binColor,
          instructions: result.instructions,
          disposalMethod: result.disposalMethod,
        } : null,
      });
      setMessages((old) => [...old, { role: "model", text: response.reply || "AI Nhóm 4 chưa có câu trả lời. Bạn thử hỏi lại nhé!" }]);
    } catch {
      // Thông minh: Trả lời offline bằng AI Nhóm 4
      const msgLower = message.toLowerCase();
      let reply = "";
      const isOrganic = result?.category === "Hữu cơ";
      const isHazardous = result?.category === "Cần xử lý riêng";

      if (msgLower.includes("ngăn") || msgLower.includes("bỏ") || msgLower.includes("vứt") || msgLower.includes("ở đâu")) {
        if (isOrganic) {
          reply = `🌿 **AI Nhóm 4**: Món này là rác hữu cơ (${result?.wasteType || "thực phẩm"}), bạn hãy bỏ vào **Ngăn 1 · Hữu cơ**. Nhớ gạt bỏ bao bì nilon và chắt bớt nước trước khi bỏ nhé!`;
        } else if (isHazardous) {
          reply = `⚠️ **AI Nhóm 4 cảnh báo**: Đây là chất thải nguy hại (${result?.wasteType || "pin/hóa chất"}), tuyệt đối **KHÔNG BỎ VÀO CẢ 2 NGĂN**. Hãy bọc kín và mang đến điểm thu gom rác nguy hại chuyên dụng!`;
        } else {
          reply = `🧴 **AI Nhóm 4**: Món này là rác vô cơ (${result?.wasteType || "vật liệu vô cơ"}), bạn hãy bỏ vào **Ngăn 2 · Vô cơ**. Hãy làm sạch nước thừa bên trong và bóp bẹp nếu được nhé!`;
        }
      } else if (msgLower.includes("rửa") || msgLower.includes("sạch") || msgLower.includes("tráng")) {
        reply = isOrganic
          ? "🌿 **AI Nhóm 4**: Rác hữu cơ không cần rửa, nhưng bạn nên chắt ráo bớt nước canh để tránh đọng ẩm và hạn chế bốc mùi trong thùng rác."
          : "🧴 **AI Nhóm 4**: Rất nên tráng sơ qua nước sạch! Với chai lọ, vỏ lon hoặc hộp sữa, tráng sạch sẽ ngăn thu hút ruồi muỗi, chuột gián và giúp quá trình tái chế đạt năng suất cao nhất.";
      } else if (msgLower.includes("tái chế") || msgLower.includes("tái sử dụng")) {
        reply = isOrganic
          ? "🌱 **AI Nhóm 4**: Rác hữu cơ có thể ủ thành phân compost bón cho cây trồng rất tốt tại nhà hoặc đưa về nhà máy phân bón vi sinh."
          : "♻️ **AI Nhóm 4**: Vật liệu này có thể tái chế thành sản phẩm mới (hạt nhựa, phôi nhôm, giấy tái sinh). Hãy giữ chúng khô ráo và sạch sẽ nhé!";
      } else if (msgLower.includes("pin") || msgLower.includes("ắc quy") || msgLower.includes("đèn") || msgLower.includes("hóa chất")) {
        reply = "⚠️ **AI Nhóm 4 cảnh báo**: Pin, ắc quy, bóng đèn huỳnh quang là rác nguy hại chứa kim loại nặng! Không bỏ vào thùng 2 ngăn mà cần điểm thu gom pin chuyên dụng tại siêu thị hoặc UBND phường.";
      } else {
        reply = `🌿 **AI Nhóm 4**: Bạn đang hỏi về **${result?.wasteType || "món rác này"}** (${result?.category || "Chưa rõ nhóm"}).\nThùng rác chỉ có 2 ngăn: **Ngăn 1 (Hữu cơ)** và **Ngăn 2 (Vô cơ)**. Bạn cần hỗ trợ thêm thông tin gì hãy nhắn cho mình nhé!`;
      }
      setMessages((old) => [...old, { role: "model", text: reply }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card style={s.card}>
      <View style={s.heading}>
        <View style={s.aiIcon}>
          <Ionicons name="sparkles" size={17} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Hỏi Trợ lý AI Nhóm 4</Text>
          <Text style={s.subtitle}>
            {result?.wasteType ? "Tư vấn cách xử lý theo kết quả nhận diện" : "Hỏi đáp cách phân loại, tái chế & xử lý rác an toàn"}
          </Text>
        </View>
        <View style={s.online}>
          <View style={s.dot} />
          <Text style={s.onlineText}>AI NHÓM 4</Text>
        </View>
      </View>

      <View style={s.quickRow}>
        {quickQuestions.map((q) => (
          <TouchableOpacity key={q} style={s.quick} disabled={sending} onPress={() => send(q)}>
            <Text style={s.quickText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        ref={threadRef}
        style={s.thread}
        contentContainerStyle={s.threadContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {messages.slice(-20).map((item, index) => (
          <View key={`${index}-${item.role}`} style={[s.bubble, item.role === "user" ? s.userBubble : s.aiBubble]}>
            <FormattedMessageText text={item.text} isUser={item.role === "user"} />
          </View>
        ))}
        {sending ? (
          <View style={s.typing}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={s.subtitle}>AI Nhóm 4 đang trả lời...</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          editable={!sending}
          onFocus={() => setTimeout(() => threadRef.current?.scrollToEnd({ animated: true }), 150)}
          placeholder="Hỏi AI Nhóm 4 cách xử lý rác..."
          placeholderTextColor={colors.sub}
          style={s.input}
          multiline
          maxLength={700}
        />
        <TouchableOpacity
          onPress={() => send()}
          disabled={sending || !draft.trim()}
          style={[s.send, (sending || !draft.trim()) && { opacity: 0.45 }]}
        >
          <Ionicons name="send" color="#fff" size={17} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 14, padding: 14 },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 10, color: colors.sub, marginTop: 2 },
  online: { backgroundColor: "#E7F5EC", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ok },
  onlineText: { fontSize: 9, fontWeight: "900", color: colors.primary },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  quick: { backgroundColor: "#F2F7F3", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7 },
  quickText: { fontSize: 9, fontWeight: "700", color: colors.primary },
  thread: { marginTop: 12, maxHeight: 300, minHeight: 90 },
  threadContent: { gap: 8, paddingVertical: 2 },
  bubble: { maxWidth: "91%", borderRadius: 14, padding: 10 },
  aiBubble: { backgroundColor: "#F2F6F3", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: colors.primary, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 11, color: colors.text, lineHeight: 16 },
  bubbleBold: { fontWeight: "900", color: colors.primary },
  userText: { color: "#FFFFFF" },
  typing: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 12 },
  input: { flex: 1, minHeight: 42, maxHeight: 90, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: colors.text, backgroundColor: "#FFFFFF" },
  send: { height: 42, width: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
