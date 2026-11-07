import type { WasteClassification } from "../types";

/**
 * Mô hình AI Offline phân loại sơ bộ Nhom4 dựa trên bộ 8 lớp chuẩn từ mô hình best.pt (YOLO):
 *
 * 1. rac-huu-co                     -> Ngăn 1 · Hữu cơ
 * 2. chai-nhua                      -> Ngăn 2 · Vô cơ
 * 3. ly-nhua                        -> Ngăn 2 · Vô cơ
 * 4. tui-nilon                      -> Ngăn 2 · Vô cơ
 * 5. hop-sua                        -> Ngăn 2 · Vô cơ
 * 6. lon-nuoc-giai-khat-bang-kim-loai -> Ngăn 2 · Vô cơ
 * 7. chai-lo-manh-vo-thuy-tinh      -> Ngăn 2 · Vô cơ
 * 8. khau-trang                     -> Ngăn 2 · Vô cơ
 * + Cảnh báo rác nguy hại (pin/đèn) -> Không bỏ vào thùng 2 ngăn
 */

export const SMARTBIN_CLASSES = [
  "rac-huu-co",
  "chai-nhua",
  "ly-nhua",
  "tui-nilon",
  "hop-sua",
  "lon-nuoc-giai-khat-bang-kim-loai",
  "chai-lo-manh-vo-thuy-tinh",
  "khau-trang",
] as const;

export const SMARTBIN_CLASS_DETAILS: Record<
  string,
  {
    label: string;
    wasteType: string;
    category: "Hữu cơ" | "Vô cơ" | "Cần xử lý riêng";
    binCompartment: "Ngăn 1 · Hữu cơ" | "Ngăn 2 · Vô cơ" | "Không bỏ vào thùng 2 ngăn";
    material: string;
    recyclable: boolean;
    instructions: string[];
    disposalMethod: string;
    note: string;
  }
> = {
  "rac-huu-co": {
    label: "rac-huu-co",
    wasteType: "Rác hữu cơ (Thực phẩm thừa / Vỏ củ quả)",
    category: "Hữu cơ",
    binCompartment: "Ngăn 1 · Hữu cơ",
    material: "Chất hữu cơ sinh học",
    recyclable: false,
    instructions: [
      "Gạt bỏ bao bì ni-lông, muỗng nĩa nhựa hoặc dây thun buộc.",
      "Chắt ráo bớt nước canh hoặc chất lỏng để tránh đọng ẩm và bốc mùi.",
      "Bỏ trực tiếp vào Ngăn 1 · Hữu cơ của thùng rác.",
    ],
    disposalMethod: "Tách bỏ bao bì, chắt ráo nước và bỏ vào Ngăn 1 · Hữu cơ",
    note: "Rác hữu cơ dễ phân hủy sinh học, thích hợp để ủ phân compost bón cây.",
  },
  "chai-nhua": {
    label: "chai-nhua",
    wasteType: "Chai nhựa PET / Chai nước ngọt",
    category: "Vô cơ",
    binCompartment: "Ngăn 2 · Vô cơ",
    material: "Nhựa PET tái chế",
    recyclable: true,
    instructions: [
      "Đổ sạch phần nước hoặc đồ uống còn đọng bên trong.",
      "Tráng sơ nếu dính dầu mỡ, trà sữa hoặc đường ngọt.",
      "Tháo nắp và bóp dẹp thân chai để tiết kiệm thể tích thùng rác.",
      "Bỏ vào Ngăn 2 · Vô cơ.",
    ],
    disposalMethod: "Đổ sạch nước, bóp dẹp và bỏ vào Ngăn 2 · Vô cơ",
    note: "Nhựa PET có thể tái chế thành chai mới hoặc sợi dệt may sinh thái.",
  },
  "ly-nhua": {
    label: "ly-nhua",
    wasteType: "Ly nhựa / Cốc nhựa trà sữa, cà phê",
    category: "Vô cơ",
    binCompartment: "Ngăn 2 · Vô cơ",
    material: "Nhựa PP / PS",
    recyclable: true,
    instructions: [
      "Bỏ hết đá lạnh, đồ uống thừa và tráng qua nước sạch.",
      "Gỡ bỏ màng ép ni-lông hoặc nắp đậy.",
      "Xếp chồng các ly lên nhau để tiết kiệm diện tích.",
      "Bỏ vào Ngăn 2 · Vô cơ.",
    ],
    disposalMethod: "Đổ sạch cặn đồ uống và bỏ vào Ngăn 2 · Vô cơ",
    note: "Nhựa PP có thể tái chế nếu được làm sạch đồ uống trước khi vứt.",
  },
  "tui-nilon": {
    label: "tui-nilon",
    wasteType: "Túi ni-lông / Bao bì nilon sạch",
    category: "Vô cơ",
    binCompartment: "Ngăn 2 · Vô cơ",
    material: "Nhựa PE / Nilon",
    recyclable: true,
    instructions: [
      "Rũ sạch rác vụn hoặc thực phẩm dính bên trong túi.",
      "Vò hoặc gấp gọn gàng để tránh bay và tiết kiệm không gian.",
      "Bỏ vào Ngăn 2 · Vô cơ.",
    ],
    disposalMethod: "Làm sạch thực phẩm bám dính và bỏ vào Ngăn 2 · Vô cơ",
    note: "Túi nilon mất từ 100 - 500 năm để phân hủy, hãy ưu tiên tái sử dụng túi.",
  },
  "hop-sua": {
    label: "hop-sua",
    wasteType: "Hộp sữa giấy Tetra Pak / Hộp nước ép",
    category: "Vô cơ",
    binCompartment: "Ngăn 2 · Vô cơ",
    material: "Giấy phức hợp nhôm & PE",
    recyclable: true,
    instructions: [
      "Uống hết sữa hoặc nước bên trong.",
      "Mở 4 góc tai hộp và gấp dẹp hoàn toàn.",
      "Bỏ vào Ngăn 2 · Vô cơ.",
    ],
    disposalMethod: "Gấp dẹp hộp và bỏ vào Ngăn 2 · Vô cơ",
    note: "Vỏ hộp sữa được tái chế thành tấm lợp sinh thái và bột giấy công nghiệp.",
  },
  "lon-nuoc-giai-khat-bang-kim-loai": {
    label: "lon-nuoc-giai-khat-bang-kim-loai",
    wasteType: "Lon nhôm / Lon bia, nước ngọt kim loại",
    category: "Vô cơ",
    binCompartment: "Ngăn 2 · Vô cơ",
    material: "Nhôm kim loại (Al)",
    recyclable: true,
    instructions: [
      "Uống hết hoặc đổ sạch nước ngọt còn sót.",
      "Tráng sơ qua nước sạch nếu còn đọng đường ngọt.",
      "Bóp dẹp vỏ lon để tiết kiệm thể tích thùng.",
      "Bỏ vào Ngăn 2 · Vô cơ.",
    ],
    disposalMethod: "Làm rỗng, bóp dẹp và bỏ vào Ngăn 2 · Vô cơ",
    note: "Nhôm kim loại có thể tái chế vô hạn lần mà không làm giảm chất lượng vật liệu.",
  },
  "chai-lo-manh-vo-thuy-tinh": {
    label: "chai-lo-manh-vo-thuy-tinh",
    wasteType: "Chai lọ thủy tinh / Mảnh vỡ thủy tinh",
    category: "Vô cơ",
    binCompartment: "Ngăn 2 · Vô cơ",
    material: "Thủy tinh silicat",
    recyclable: true,
    instructions: [
      "Đổ sạch chất lỏng trong chai lọ.",
      "Nếu là mảnh vỡ thủy tinh, hãy bọc giấy báo cẩn thận để tránh gây đứt tay người thu gom.",
      "Bỏ nhẹ tay vào Ngăn 2 · Vô cơ.",
    ],
    disposalMethod: "Bọc kín nếu có cạnh sắc và bỏ vào Ngăn 2 · Vô cơ",
    note: "Thủy tinh có thể tái chế 100%. Hãy lưu ý an toàn tránh vỡ sắc nhọn.",
  },
  "khau-trang": {
    label: "khau-trang",
    wasteType: "Khẩu trang y tế / Khẩu trang vải",
    category: "Vô cơ",
    binCompartment: "Ngăn 2 · Vô cơ",
    material: "Vải không dệt Polypropylene",
    recyclable: false,
    instructions: [
      "Cắt đứt dây đeo khẩu trang để tránh mắc kẹt động vật nhỏ.",
      "Gấp gọn và bọc trong giấy hoặc túi nhỏ nếu dùng khi bị ốm.",
      "Bỏ vào Ngăn 2 · Vô cơ.",
    ],
    disposalMethod: "Cắt quai đeo, cuộn gọn và bỏ vào Ngăn 2 · Vô cơ",
    note: "Khẩu trang y tế đã qua sử dụng là rác vô cơ không tái chế thông thường.",
  },
  "khong-co-rac": {
    label: "khong-co-rac",
    wasteType: "Không phát hiện rác trong khung hình",
    category: "Cần xử lý riêng",
    binCompartment: "Không bỏ vào thùng 2 ngăn",
    material: "Không có vật thể",
    recyclable: false,
    instructions: [
      "Hãy đưa vật thể rác vào giữa khung hình và đảm bảo đủ ánh sáng.",
      "Chụp lại rõ nét vật thể để mô hình YOLO (best.pt) nhận diện chính xác.",
    ],
    disposalMethod: "Chụp lại ảnh có vật thể rác cần phân loại",
    note: "Mô hình AI best.pt không phát hiện rác thuộc 8 lớp đã huấn luyện trong ảnh này.",
  },
  "chat-thai-nguy-hai": {
    label: "chat-thai-nguy-hai",
    wasteType: "Chất thải nguy hại (Pin / Bóng đèn / Hóa chất)",
    category: "Cần xử lý riêng",
    binCompartment: "Không bỏ vào thùng 2 ngăn",
    material: "Kim loại nặng / Hóa chất độc hại",
    recyclable: false,
    instructions: [
      "⚠️ TUYỆT ĐỐI KHÔNG BỎ VÀO THÙNG RÁC 2 NGĂN.",
      "Dán băng dính vào 2 đầu cực của pin cũ để chống chập cháy.",
      "Bỏ vào hộp nhựa hoặc túi riêng biệt để xa tầm tay trẻ em.",
      "Mang đến điểm thu gom pin chuyên dụng (siêu thị, UBND phường hoặc trường học).",
    ],
    disposalMethod: "Thu gom riêng và mang đến điểm xử lý chất thải nguy hại chuyên dụng",
    note: "CẢNH BÁO: Pin và hóa chất gây ô nhiễm nguồn nước ngầm và đất nghiêm trọng.",
  },
};

function toResult(key: string, confidence: number, notePrefix: string): WasteClassification {
  const item = SMARTBIN_CLASS_DETAILS[key];
  return {
    wasteType: item.wasteType,
    category: item.category,
    confidence,
    recyclable: item.recyclable,
    binColor: item.binCompartment,
    binCompartment: item.binCompartment,
    material: item.material,
    instructions: item.instructions,
    disposalMethod: item.disposalMethod,
    note: `${notePrefix}: ${item.note}`,
    classificationMode: "on-device",
    bestClass: key,
    bbox: null,
  };
}

/** Kết quả "Không rõ vật thể" – dùng khi best.pt không nhận ra vật nào trong 8 lớp. */
export function buildUnknownResult(): WasteClassification {
  return {
    wasteType: "Không rõ vật thể (Chưa xác định)",
    category: "Cần xử lý riêng",
    confidence: 0,
    recyclable: false,
    binColor: "Không bỏ vào thùng 2 ngăn",
    binCompartment: "Không bỏ vào thùng 2 ngăn",
    material: "Chưa xác định",
    instructions: [
      "Vật thể không thuộc 8 nhóm rác huấn luyện của mô hình best.pt.",
      "8 nhóm rác hỗ trợ: Hộp sữa, Chai nhựa, Ly nhựa, Lon kim loại, Túi nilon, Thủy tinh, Khẩu trang, Rác hữu cơ.",
      "Hãy đưa vật thể vào giữa khung hình, đảm bảo đủ sáng hoặc chọn nhãn phân loại thủ công.",
    ],
    disposalMethod: "Chụp lại ảnh hoặc chọn nhóm phân loại thủ công",
    note: "Mô hình AI YOLO (best.pt) không phát hiện vật thể phù hợp trong 8 lớp đã huấn luyện.",
    classificationMode: "on-device",
    bestClass: "khong-co-rac",
    bbox: null,
  };
}

/**
 * Kết quả khi người dùng tự chọn nhãn (thanh 8 lớp) hoặc khi không có model nào chạy được.
 * KHÔNG đoán bừa theo màu sắc pixel: nếu không có nhãn -> trả về "Không rõ".
 * Tham số imageUri/imageBase64 giữ lại để tương thích với các nơi gọi cũ.
 */
export async function classifyOnDevice(
  _imageUri: string,
  detectedClass?: string,
  _imageBase64?: string | null,
): Promise<WasteClassification> {
  if (detectedClass === "khong-co-rac") return buildUnknownResult();
  if (detectedClass && detectedClass !== "auto" && SMARTBIN_CLASS_DETAILS[detectedClass]) {
    return toResult(detectedClass, 95, "Nhãn chọn thủ công (8 lớp best.pt)");
  }
  return buildUnknownResult();
}
