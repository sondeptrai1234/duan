import { api } from "./api";
import { buildUnknownResult, classifyOnDevice } from "./localWasteModel";
import { classifyWithTfliteModel, isTfliteSupported } from "./tfliteWasteModel";
import type { WasteClassification } from "../types";

/**
 * Luồng phân loại ảnh rác:
 * 1. Người dùng tự chọn nhãn (thanh 8 lớp) -> dùng luôn nhãn đó.
 * 2. APK / Development Build: chạy best.pt (best_float32.tflite) TRỰC TIẾP trên điện thoại, không cần server.
 * 3. Expo Go (không có TFLite native): gửi ảnh lên server chạy best.pt bằng yolo_predict.py.
 * 4. Không có cách nào nhận diện được -> "Không rõ vật thể" (không đoán bừa).
 */
export async function classifyWaste(
  imageUri: string,
  imageBase64?: string | null,
  mimeType = "image/jpeg",
  allowCloud = true,
  detectedClass?: string,
): Promise<WasteClassification> {
  if (detectedClass && detectedClass !== "auto") {
    return classifyOnDevice(imageUri, detectedClass, imageBase64);
  }

  let localResult: WasteClassification | null = null;
  if (imageBase64 && isTfliteSupported()) {
    try {
      localResult = await classifyWithTfliteModel(imageBase64);
      // Nếu mô hình TFLite trên máy nhận diện được vật thể rõ ràng -> trả về luôn
      if (localResult && localResult.confidence > 0) return localResult;
    } catch (e: any) {
      console.warn("Lỗi chạy TFLite trên máy:", e?.message || e);
    }
  }

  // Nếu trên máy chưa rõ hoặc không có TFLite -> Gọi server chạy mô hình best.pt (Python YOLO)
  if (allowCloud && imageBase64) {
    try {
      const serverResult = await api.post<WasteClassification>("/api/classify", {
        imageBase64,
        mimeType,
      });
      if (serverResult && serverResult.confidence > 0) return serverResult;
      if (serverResult && serverResult.category) return serverResult;
    } catch (e: any) {
      console.warn("Server AI best.pt không phản hồi:", e?.message || e);
    }
  }

  return localResult || buildUnknownResult();
}
