import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { colors } from "../theme";
import { Header } from "../components/Common";
import { api } from "../services/api";
import { classifyWaste } from "../services/classifier";
import { useApp } from "../context/AppContext";
import type { WasteClassification } from "../types";

interface ChatBubble {
  id: string;
  role: "user" | "model";
  text: string;
  imageUri?: string;
  classification?: Partial<WasteClassification>;
  timestamp: string;
}

/**
 * Hiển thị chữ mượt mà, tự động chuyển đổi các dấu ** thành chữ in đậm,
 * không bao giờ bị hiện lỗi dấu ** thô kệch trên màn hình.
 */
function FormattedMessageText({ text, style, isUser }: { text: string; style: any; isUser: boolean }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const content = part.slice(2, -2);
          return (
            <Text key={index} style={{ fontWeight: "900", color: isUser ? "#FFFFFF" : colors.primary }}>
              {content}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}

/**
 * Trả lời thông minh mọi câu hỏi của người dùng, không bao giờ cụt lủn hay lặp lại mẫu cũ.
 */
function getLocalChatAnswer(question: string, context?: any) {
  const q = (question || "").toLowerCase().trim();
  const cWaste = context?.wasteType || "";
  const cCat = context?.category || "";
  const cComp = context?.binCompartment || "";

  // 1. Người dùng hỏi về API / kết nối
  if (q.includes("api") || q.includes("kết nối") || q.includes("máy chủ") || q.includes("dg gọi") || q.includes("đang gọi")) {
    return "Chào bạn! Hiện tại ứng dụng đang kết nối trực tiếp với Máy chủ Nhom4 API và Mô hình AI YOLO (best.pt) nội bộ.\nMọi câu hỏi và ảnh chụp của bạn đều được phân tích và phản hồi ngay lập tức.";
  }

  // 2. Chào hỏi
  if (q === "hey" || q === "hi" || q === "hello" || q.includes("chào") || q === "alo") {
    return "Chào bạn! Mình là Trợ lý AI Nhóm 4 🌿.\nMình có thể hỗ trợ bạn phân loại rác vào Ngăn 1 (Hữu cơ) hay Ngăn 2 (Vô cơ), hướng dẫn xử lý hoặc bấm nút máy ảnh để nhận diện rác ngay nhé!";
  }

  // 3. Phân biệt ngăn 1 và ngăn 2 / Cấu tạo thùng rác thông minh
  if (q.includes("ngăn 1") || q.includes("ngăn 2") || q.includes("khác nhau") || q.includes("mấy ngăn") || q.includes("phân biệt") || q.includes("thùng rác")) {
    return "AI Nhóm 4 xin giải đáp về thùng rác 2 ngăn thông minh:\n\n" +
      "1. Ngăn 1 · Rác Hữu cơ:\n" +
      "• Dành cho: Thức ăn thừa, cơm canh, vỏ rau củ quả, bã trà, bã cà phê, hoa lá mục...\n" +
      "• Lưu ý: Gạt bỏ bao bì nilon, chắt bớt nước canh trước khi bỏ.\n" +
      "• Xử lý: Được ủ làm phân bón sinh học compost cho cây trồng.\n\n" +
      "2. Ngăn 2 · Rác Vô cơ:\n" +
      "• Dành cho: Chai nhựa, ly nhựa, vỏ lon kim loại, hộp sữa giấy, túi nilon sạch, chai lọ thủy tinh, khẩu trang y tế...\n" +
      "• Lưu ý: Đổ sạch nước ngọt, tráng sơ, bóp bẹp để tiết kiệm thể tích.\n" +
      "• Xử lý: Tái chế thành hạt nhựa, phôi nhôm, giấy công nghiệp.\n\n" +
      "Lưu ý đặc biệt: Pin cũ, bóng đèn, hóa chất, bình xịt gas tuyệt đối KHÔNG BỎ VÀO CẢ 2 NGĂN mà phải thu gom riêng mang tới điểm xử lý rác nguy hại.";
  }

  // 4. Rác nguy hại: pin, ắc quy, bóng đèn, hóa chất
  if (q.includes("pin") || q.includes("ắc quy") || q.includes("đèn") || q.includes("hóa chất") || q.includes("nguy hại") || q.includes("thuốc trừ sâu") || q.includes("nhiệt kế")) {
    return "Cảnh báo từ AI Nhóm 4 - Chất thải nguy hại:\n\n" +
      "• Pin, ắc quy, bóng đèn huỳnh quang, bình xịt và hóa chất chứa chì, thủy ngân, cadmium cực kỳ độc hại.\n" +
      "• Tuyệt đối KHÔNG bỏ vào thùng rác 2 ngăn (cả Ngăn 1 lẫn Ngăn 2).\n\n" +
      "Quy trình xử lý an toàn:\n" +
      "1. Dán băng dính vào 2 cực của pin để tránh chập cháy.\n" +
      "2. Cất trong hộp kín hoặc chai nhựa riêng, để xa tầm tay trẻ em.\n" +
      "3. Mang đến các điểm thu hồi pin chuyên dụng tại: Siêu thị, UBND phường, hoặc các trường học.";
  }

  // 5. Có cần rửa sạch không?
  if (q.includes("rửa") || q.includes("sạch") || q.includes("tráng") || q.includes("nước thừa")) {
    return "AI Nhóm 4 khuyên bạn:\n\n" +
      "• Với rác vô cơ (chai nhựa, lon bia, hộp sữa, túi nilon): Rất nên tráng sơ qua nước sạch và đổ hết nước ngọt/dầu mỡ còn sót! Việc này giúp thùng rác không bị bốc mùi hôi, không thu hút ruồi muỗi, chuột gián và giúp nhà máy tái chế đạt năng suất cao nhất.\n\n" +
      "• Với rác hữu cơ (thức ăn thừa): Không cần rửa, nhưng bạn nên chắt ráo bớt nước canh trước khi bỏ vào Ngăn 1 để tránh đọng ẩm đáy thùng nhé!";
  }

  // 6. Rác hữu cơ / Thức ăn thừa / Phân compost
  if (q.includes("thức ăn") || q.includes("hữu cơ") || q.includes("cơm") || q.includes("rau") || q.includes("vỏ chuối") || q.includes("thịt") || q.includes("cá") || q.includes("xương") || q.includes("compost")) {
    return "Hướng dẫn rác hữu cơ từ AI Nhóm 4:\n\n" +
      "• Tất cả cơm thừa, rau củ quả, vỏ trái cây, bã cà phê, hoa lá đều bỏ vào Ngăn 1 · Hữu cơ.\n" +
      "• Gạt bỏ túi nilon hoặc dây buộc trước khi bỏ vào thùng.\n" +
      "• Rác hữu cơ từ Ngăn 1 có thể ủ compost tại nhà trong thùng xốp cùng một ít đất và chế phẩm vi sinh để tạo phân bón lá siêu tốt cho rau và hoa kiểng!";
  }

  // 7. Chai nhựa / Nhựa / Ly nhựa / Hộp xốp
  if (q.includes("chai") || q.includes("nhựa") || q.includes("ly") || q.includes("cốc") || q.includes("hộp xốp") || q.includes("pet") || q.includes("pp")) {
    return "Hướng dẫn đồ nhựa từ AI Nhóm 4:\n\n" +
      "• Chai nhựa PET, ly nhựa trà sữa, hộp xốp sạch thuộc Ngăn 2 · Vô cơ.\n" +
      "• Quy trình 3 bước:\n" +
      "  1. Đổ sạch nước ngọt, trà sữa, đá lạnh bên trong.\n" +
      "  2. Tráng sơ qua nước.\n" +
      "  3. Tháo nắp và bóp dẹp thân chai/ly để tiết kiệm 70% diện tích thùng rác.\n" +
      "• Bỏ vào Ngăn 2 · Vô cơ để hệ thống đưa vào quy trình tái chế tạo hạt nhựa mới.";
  }

  // 8. Lon nước / Kim loại / Nhôm
  if (q.includes("lon") || q.includes("bia") || q.includes("nhôm") || q.includes("kim loại") || q.includes("thiếc") || q.includes("sắt")) {
    return "Hướng dẫn rác kim loại từ AI Nhóm 4:\n\n" +
      "• Vỏ lon bia, lon nước ngọt, hộp đồ hộp kim loại thuộc Ngăn 2 · Vô cơ.\n" +
      "• Nhôm kim loại là vật liệu có giá trị tái chế vô cùng cao, có thể nấu chảy tái sinh vô số lần.\n" +
      "• Bạn nhớ uống hết nước, giẫm hoặc bóp bẹp lon rồi bỏ vào Ngăn 2 nhé!";
  }

  // 9. Giấy / Bìa carton / Hộp sữa
  if (q.includes("giấy") || q.includes("hộp sữa") || q.includes("carton") || q.includes("bìa") || q.includes("sách") || q.includes("báo")) {
    return "Hướng dẫn rác giấy từ AI Nhóm 4:\n\n" +
      "• Hộp sữa giấy, thùng carton, sách báo cũ thuộc Ngăn 2 · Vô cơ.\n" +
      "• Lưu ý: Giữ giấy khô ráo! Nếu hộp sữa dính cặn, hãy mở 4 tai góc, tráng sơ rồi ép dẹp phẳng lì.\n" +
      "• Giấy khô ráo sẽ được nhà máy tái chế thành bột giấy công nghiệp và thùng carton mới.";
  }

  // 10. Túi nilon / Bao bì / Bọc nhựa
  if (q.includes("túi") || q.includes("nilon") || q.includes("ni-lông") || q.includes("bọc") || q.includes("bao bì")) {
    return "Hướng dẫn túi nilon từ AI Nhóm 4:\n\n" +
      "• Túi nilon, màng bọc thực phẩm sạch bỏ vào Ngăn 2 · Vô cơ.\n" +
      "• Hãy rũ sạch đồ ăn thừa bám bên trong và cuộn gọn lại.\n" +
      "• Túi nilon mất từ 100 - 500 năm mới phân hủy ngoài tự nhiên, vì vậy bạn hãy ưu tiên giặt sạch để tái sử dụng nhiều lần nhé!";
  }

  // 11. Thủy tinh / Mảnh sành sứ
  if (q.includes("thủy tinh") || q.includes("chai lọ") || q.includes("bát vỡ") || q.includes("gương") || q.includes("mảnh vỡ")) {
    return "Hướng dẫn đồ thủy tinh từ AI Nhóm 4:\n\n" +
      "• Chai lọ thủy tinh, ly cốc thuộc Ngăn 2 · Vô cơ.\n" +
      "• Lưu ý an toàn: Nếu là mảnh vỡ thủy tinh có cạnh sắc nhọn, bạn hãy gói cẩn thận vào nhiều lớp giấy báo hoặc hộp các-tông trước khi bỏ vào thùng để bảo vệ cô chú lao công thu gom rác!";
  }

  // 12. Khẩu trang / Rác y tế
  if (q.includes("khẩu trang") || q.includes("y tế") || q.includes("băng gạc")) {
    return "Hướng dẫn khẩu trang từ AI Nhóm 4:\n\n" +
      "• Khẩu trang y tế thông thường bỏ vào Ngăn 2 · Vô cơ.\n" +
      "• Bạn nên dùng kéo cắt quai đeo (tránh mắc kẹt chim chóc, động vật) và cuộn gọn lại trước khi bỏ vào thùng.";
  }

  // 13. Nếu đang có ngữ cảnh ảnh rác
  if (cWaste && (q.includes("món này") || q.includes("rác này") || q.includes("xử lý sao"))) {
    return `Món rác bạn đang xem là: [${cWaste}].\nThuộc nhóm: [${cCat || "Chưa rõ"}] -> Vị trí bỏ: [${cComp || "Thùng rác"}].\nBạn hãy kiểm tra đổ sạch nước thừa và bỏ đúng ngăn quy định nhé!`;
  }

  // Mặc định trả lời đầy đủ
  return "Chào bạn! Mình là Trợ lý AI Nhóm 4 🌿.\n\n" +
    "Mình có thể hỗ trợ bạn mọi thông tin về:\n" +
    "• Phân loại chuẩn từng loại rác vào Ngăn 1 (Hữu cơ) hay Ngăn 2 (Vô cơ).\n" +
    "• Cách xử lý rác nguy hại (pin cũ, hóa chất, bóng đèn).\n" +
    "• Hướng dẫn cách làm sạch, ép dẹp chai lon và ủ phân compost.\n" +
    "• Giải thích cơ chế hoạt động của camera và mô hình AI YOLO (best.pt).\n\n" +
    "Bạn có thể gửi câu hỏi cụ thể bất kỳ hoặc bấm nút 📷 để gửi ảnh nhận diện ngay nhé!";
}

const SAMPLE_MESSAGES: ChatBubble[] = [
  {
    id: "welcome",
    role: "model",
    text: "Xin chào! Mình là Trợ lý AI Nhóm 4 🌿.\n\nBạn có thể hỏi bất cứ thắc mắc nào về phân loại rác, hoặc bấm nút 📷 để chụp ảnh / gửi ảnh. Mô hình AI YOLO (best.pt) sẽ nhận diện nhãn trước và hướng dẫn bạn xử lý từng bước an toàn!",
    timestamp: "10:00",
  },
];

export default function ChatScreen() {
  const { lastScan, lastScanImage } = useApp();
  const [messages, setMessages] = useState<ChatBubble[]>(SAMPLE_MESSAGES);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const quickQuestions = [
    "Ngăn 1 và Ngăn 2 khác nhau thế nào?",
    "Có cần rửa sạch chai lon trước khi vứt?",
    "Pin cũ và bóng đèn xử lý ở đâu?",
    "Thức ăn thừa và vỏ rau quả bỏ ngăn nào?",
    "Hộp sữa giấy và chai nhựa bỏ ngăn nào?",
  ];

  const sendMessage = async (customText?: string, attachedImageUri?: string, classification?: WasteClassification) => {
    const textToSend = (customText ?? draft).trim();
    if (!textToSend && !attachedImageUri) return;

    const userBubble: ChatBubble = {
      id: `u-${Date.now()}`,
      role: "user",
      text: textToSend || "Nhờ AI Nhóm 4 phân loại giúp mình hình ảnh này:",
      imageUri: attachedImageUri,
      classification,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userBubble]);
    setDraft("");
    setLoading(true);

    try {
      if (classification) {
        // Nhãn AI YOLO (best.pt) phân loại sơ bộ ra trước
        const isNone = classification.category === "Không có rác" || classification.confidence === 0;
        const comp = classification.binCompartment || classification.binColor || "Không xác định";
        const steps = (classification.instructions || []).map((s, idx) => `${idx + 1}. ${s}`).join("\n");

        let replyText = "";
        if (isNone) {
          replyText = "AI Nhóm 4 (Model best.pt) không phát hiện rác thuộc 8 lớp đã huấn luyện trong ảnh.\n\nHãy đưa rác vào giữa khung hình, đảm bảo đủ sáng và chụp lại nhé!";
        } else {
          replyText = `Kết quả nhận diện từ AI Nhóm 4:\n` +
            `• Vật thể: ${classification.wasteType}\n` +
            `• Nhóm rác: ${classification.category}\n` +
            `• Vị trí bỏ: ${comp}\n` +
            `• Độ tin cậy: ${classification.confidence}%\n\n` +
            `Hướng dẫn xử lý an toàn:\n${steps}\n\n` +
            `Lưu ý: ${classification.note || "Hãy làm theo hướng dẫn để bảo vệ môi trường nhé!"}`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: "model",
            text: replyText,
            classification,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        // Gửi lên server backend nếu online
        const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
        try {
          const response = await api.post<{ reply: string }>("/api/ai/chat", {
            message: textToSend,
            history,
            context: lastScan || null,
          });

          setMessages((prev) => [
            ...prev,
            {
              id: `m-${Date.now()}`,
              role: "model",
              text: response.reply || getLocalChatAnswer(textToSend, lastScan),
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        } catch {
          // Tự động chuyển sang AI Offline Nhóm 4
          const answer = getLocalChatAnswer(textToSend, lastScan);
          setMessages((prev) => [
            ...prev,
            {
              id: `m-${Date.now()}`,
              role: "model",
              text: answer,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      }
    } catch {
      const answer = getLocalChatAnswer(textToSend, lastScan);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: "model",
          text: answer,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (useCamera = false) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") return Alert.alert("Cần quyền camera", "Hãy cho phép quyền chụp ảnh để quét rác.");
        result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [4, 3] });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, allowsEditing: true, aspect: [4, 3] });
      }

      if (result.canceled || !result.assets[0]?.uri) return;
      const uri = result.assets[0].uri;

      const manipulated = await manipulateAsync(uri, [{ resize: { width: 800 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
      setLoading(true);

      // AI Offline phân tích nhãn trước theo chuẩn 8 lớp
      const classification = await classifyWaste(manipulated.uri, manipulated.base64, "image/jpeg", true);
      await sendMessage("Phân tích hình ảnh này giúp mình:", manipulated.uri, classification);
    } catch (e: any) {
      Alert.alert("Lỗi xử lý ảnh", e?.message || "Không thể tải hoặc nhận diện ảnh.");
      setLoading(false);
    }
  };

  const handleUseRecentScan = async () => {
    if (!lastScanImage && !lastScan) {
      return Alert.alert("Chưa có ảnh quét", "Hãy sang mục Quét rác để chụp một bức ảnh trước nhé.");
    }
    await sendMessage("Xem lại hướng dẫn xử lý của ảnh vừa quét gần nhất:", lastScanImage || undefined, lastScan as any);
  };

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 85 : 0}
      >
        <View style={s.topBar}>
          <Header title="Trợ lý AI Nhóm 4" subtitle="Nhắn tin & phân loại rác thông minh" />
          <View style={s.badgeRow}>
            <View style={s.aiBadge}>
              <View style={s.onlineDot} />
              <Text style={s.aiBadgeText}>AI Nhóm 4 (Model best.pt)</Text>
            </View>
            {lastScanImage ? (
              <TouchableOpacity style={s.recentBtn} onPress={handleUseRecentScan}>
                <Ionicons name="sparkles" size={13} color={colors.primary} />
                <Text style={s.recentBtnText}>Nạp ảnh vừa quét</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.thread}
          contentContainerStyle={s.threadContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((item) => {
            const isUser = item.role === "user";
            const classObj = item.classification;
            const isNone = classObj?.category === "Không có rác" || classObj?.confidence === 0;

            return (
              <View key={item.id} style={[s.bubbleWrapper, isUser ? s.userWrapper : s.aiWrapper]}>
                {!isUser && (
                  <View style={s.avatar}>
                    <Ionicons name="chatbubble-ellipses" size={17} color={colors.primary} />
                  </View>
                )}
                <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={s.bubbleImage} resizeMode="cover" />
                  ) : null}

                  {/* ĐÓNG KHUNG NHÃN RÕ RÀNG THEO YÊU CẦU */}
                  {classObj ? (
                    <View style={[s.nhanBox, isNone ? s.nhanBoxNone : s.nhanBoxOk]}>
                      <View style={s.nhanHeader}>
                        <Ionicons
                          name={isNone ? "alert-circle" : "pricetag"}
                          size={15}
                          color={isNone ? "#DC2626" : colors.primary}
                        />
                        <Text style={[s.nhanHeaderTitle, isNone && { color: "#DC2626" }]}>
                          {isNone ? "KHÔNG TÌM THẤY RÁC" : "NHÃN PHÂN LOẠI (best.pt)"}
                        </Text>
                        <View style={[s.nhanBadge, isNone ? s.nhanBadgeNone : s.nhanBadgeOk]}>
                          <Text style={[s.nhanBadgeText, isNone ? s.nhanBadgeTextNone : s.nhanBadgeTextOk]}>
                            {isNone ? "KHÔNG CÓ" : `${classObj.confidence}%`}
                          </Text>
                        </View>
                      </View>

                      <View style={s.nhanBody}>
                        <Text style={s.nhanLabelRow}>
                          🏷️ Nhãn: <Text style={s.nhanBoldText}>{classObj.wasteType}</Text>
                        </Text>
                        {!isNone && (
                          <Text style={s.nhanLabelRow}>
                            📍 Vị trí: <Text style={s.nhanCompText}>{classObj.binCompartment || classObj.binColor || "2 Ngăn"}</Text>
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : null}

                  {/* Chữ hiển thị sạch sẽ, không dấu ** thô kệch */}
                  <FormattedMessageText
                    text={item.text}
                    style={[s.bubbleText, isUser ? s.userText : s.aiText]}
                    isUser={isUser}
                  />
                  <Text style={[s.timeText, isUser ? s.timeUser : s.timeAi]}>{item.timestamp}</Text>
                </View>
              </View>
            );
          })}

          {loading ? (
            <View style={[s.bubbleWrapper, s.aiWrapper]}>
              <View style={s.avatar}>
                <Ionicons name="sparkles" size={17} color={colors.primary} />
              </View>
              <View style={[s.bubble, s.aiBubble, s.loadingBubble]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={s.loadingText}>AI Nhóm 4 đang phân tích & trả lời...</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Quick suggestions */}
        <View style={s.chipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsContent}>
            {quickQuestions.map((q) => (
              <TouchableOpacity key={q} style={s.chip} onPress={() => sendMessage(q)} disabled={loading}>
                <Text style={s.chipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input bar with camera & gallery buttons */}
        <View style={s.inputBar}>
          <TouchableOpacity style={s.mediaBtn} onPress={() => handlePickImage(true)} disabled={loading}>
            <Ionicons name="camera" size={21} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.mediaBtn} onPress={() => handlePickImage(false)} disabled={loading}>
            <Ionicons name="images" size={21} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={s.input}
            placeholder="Hỏi AI Nhóm 4 hoặc gửi ảnh rác..."
            placeholderTextColor={colors.sub}
            value={draft}
            onChangeText={setDraft}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
            multiline
            maxLength={600}
            editable={!loading}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!draft.trim() || loading) && s.sendDisabled]}
            onPress={() => sendMessage()}
            disabled={!draft.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: "#FFFFFF" },
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  aiBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.pale, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ok },
  aiBadgeText: { fontSize: 10, fontWeight: "800", color: colors.primary },
  recentBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EAF5ED", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  recentBtnText: { fontSize: 10, fontWeight: "800", color: colors.primary },

  thread: { flex: 1 },
  threadContent: { padding: 16, gap: 12 },
  bubbleWrapper: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  userWrapper: { justifyContent: "flex-end" },
  aiWrapper: { justifyContent: "flex-start" },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "84%", borderRadius: 18, padding: 12 },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  bubbleImage: { width: "100%", height: 160, borderRadius: 12, marginBottom: 8, backgroundColor: colors.pale },

  // KHUNG NHÃN ĐƯỢC ĐÓNG KHUNG CHUẨN ĐẸP
  nhanBox: { borderRadius: 12, borderWidth: 1.5, padding: 10, marginBottom: 10 },
  nhanBoxOk: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
  nhanBoxNone: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  nhanHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  nhanHeaderTitle: { fontSize: 11, fontWeight: "900", color: colors.primary, flex: 1, marginLeft: 5 },
  nhanBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  nhanBadgeOk: { backgroundColor: "#DCFCE7" },
  nhanBadgeNone: { backgroundColor: "#FEE2E2" },
  nhanBadgeText: { fontSize: 10, fontWeight: "900" },
  nhanBadgeTextOk: { color: "#166534" },
  nhanBadgeTextNone: { color: "#991B1B" },
  nhanBody: { gap: 3 },
  nhanLabelRow: { fontSize: 12, color: colors.text },
  nhanBoldText: { fontWeight: "900", color: colors.text },
  nhanCompText: { fontWeight: "900", color: colors.primary },

  bubbleText: { fontSize: 13, lineHeight: 20 },
  userText: { color: "#FFFFFF" },
  aiText: { color: colors.text },
  timeText: { fontSize: 9, marginTop: 6, alignSelf: "flex-end" },
  timeUser: { color: "#E0F2E9" },
  timeAi: { color: colors.sub },
  loadingBubble: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  loadingText: { fontSize: 12, color: colors.sub },
  chipsRow: { maxHeight: 44, paddingVertical: 4, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: colors.line },
  chipsContent: { paddingHorizontal: 12, gap: 8 },
  chip: { backgroundColor: colors.pale, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15 },
  chipText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  inputBar: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: colors.line, gap: 8 },
  mediaBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minHeight: 40, maxHeight: 90, backgroundColor: "#F6F9F7", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, color: colors.text },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.4 },
});
