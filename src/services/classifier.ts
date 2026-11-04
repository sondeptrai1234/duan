import { api } from "./api";
import type { WasteClassification } from "../types";

const demoResult: WasteClassification = {
  wasteType: "Chai nhựa PET", category: "Rác tái chế", confidence: 96, recyclable: true,
  binColor: "Xanh dương", classificationMode: "demo",
  instructions: ["Đổ hết chất lỏng còn bên trong chai.", "Tráng sạch và để ráo nước.", "Ép gọn chai và bỏ vào ngăn tái chế."],
  note: "Đây là kết quả mô phỏng để trình diễn. Hãy kiểm tra hướng dẫn phân loại tại địa phương.",
};
export async function classifyWaste(imageBase64?: string | null, mimeType = "image/jpeg", allowCloud = false): Promise<WasteClassification> {
  if (allowCloud && imageBase64) {
    return api.post<WasteClassification>("/api/classify", { imageBase64, mimeType });
  }
  return { ...demoResult };
}
export function getDemoClassification() { return { ...demoResult }; }
