import * as base64js from "base64-js";
import * as jpeg from "jpeg-js";
import Constants from "expo-constants";
import { SMARTBIN_CLASSES, SMARTBIN_CLASS_DETAILS, buildUnknownResult } from "./localWasteModel";
import type { WasteClassification } from "../types";

/**
 * Chạy trực tiếp mô hình best.pt (đã xuất sang assets/models/best_float32.tflite) trong app.
 *
 * - Input : [1, 640, 640, 3] float32, RGB 0..1 (letterbox giống Ultralytics, nền xám 114)
 * - Output: [1, 12, 8400] float32 = [cx, cy, w, h, score_0..score_7] (toạ độ chuẩn hoá 0..1)
 * - Thứ tự lớp: model.names của best.pt (KHÁC thứ tự SMARTBIN_CLASSES)
 */
const MODEL_CLASS_NAMES = [
  "chai-lo-manh-vo-thuy-tinh",
  "chai-nhua",
  "hop-sua",
  "khau-trang",
  "lon-nuoc-giai-khat-bang-kim-loai",
  "ly-nhua",
  "rac-huu-co",
  "tui-nilon",
] as const;

const INPUT_SIZE = 640;
const NUM_CANDIDATES = 8400;
const NUM_CLASSES = MODEL_CLASS_NAMES.length;
const CONFIDENCE_THRESHOLD = 0.15;

let tfliteModule: any = null;
let loadedModel: any = null;
let loadingPromise: Promise<any> | null = null;

/**
 * Expo Go KHÔNG chứa native module TFLite/Nitro. Không được require thư viện ở đó,
 * nếu không sẽ văng lỗi "Failed to get NitroModules".
 * Chỉ chạy trong Development Build hoặc APK.
 */
export function isTfliteSupported(): boolean {
  if (Constants.executionEnvironment === "storeClient") return false; // Expo Go
  try {
    if (!tfliteModule) tfliteModule = require("react-native-fast-tflite");
    return typeof tfliteModule?.loadTensorflowModel === "function";
  } catch {
    tfliteModule = null;
    return false;
  }
}

/** Nạp model 1 lần duy nhất và cache lại. Trả về null nếu môi trường không hỗ trợ. */
export async function getTfliteModel(): Promise<any> {
  if (loadedModel) return loadedModel;
  if (!isTfliteSupported()) return null;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        const modelAsset = require("../../assets/models/best_float32.tflite");
        // delegates rỗng = CPU mặc định (ổn định trên mọi máy Android)
        loadedModel = await tfliteModule.loadTensorflowModel(modelAsset, []);
        console.log("[TFLite] Đã nạp best_float32.tflite");
        return loadedModel;
      } catch (err: any) {
        console.warn("[TFLite] Không nạp được best_float32.tflite:", err?.message || err);
        loadingPromise = null;
        return null;
      }
    })();
  }
  return loadingPromise;
}

type Letterbox = { tensor: Float32Array; scale: number; padX: number; padY: number; srcW: number; srcH: number };

/** Giải mã JPEG base64 và letterbox về 640x640 (giữ tỉ lệ, viền xám 114) như Ultralytics. */
function preprocessImage(base64: string): Letterbox | null {
  try {
    const raw = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    const decoded = jpeg.decode(base64js.toByteArray(raw), { useTArray: true, maxMemoryUsageInMB: 128 });
    if (!decoded?.data || decoded.width < 10 || decoded.height < 10) return null;

    const { width: srcW, height: srcH, data } = decoded;
    const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH);
    const newW = Math.round(srcW * scale);
    const newH = Math.round(srcH * scale);
    const padX = Math.floor((INPUT_SIZE - newW) / 2);
    const padY = Math.floor((INPUT_SIZE - newH) / 2);

    const tensor = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3).fill(114 / 255);
    for (let y = 0; y < newH; y++) {
      const sy = Math.min(srcH - 1, Math.floor((y + 0.5) / scale));
      for (let x = 0; x < newW; x++) {
        const sx = Math.min(srcW - 1, Math.floor((x + 0.5) / scale));
        const si = (sy * srcW + sx) * 4;
        const ti = ((y + padY) * INPUT_SIZE + (x + padX)) * 3;
        tensor[ti] = data[si] / 255;
        tensor[ti + 1] = data[si + 1] / 255;
        tensor[ti + 2] = data[si + 2] / 255;
      }
    }
    return { tensor, scale, padX, padY, srcW, srcH };
  } catch (e: any) {
    console.warn("[TFLite] Lỗi tiền xử lý ảnh:", e?.message || e);
    return null;
  }
}

/**
 * Nhận diện bằng best_float32.tflite.
 * - Trả về null  : môi trường không có TFLite (Expo Go) hoặc lỗi -> để classifier dùng phương án khác.
 * - Trả về "Không rõ" (confidence 0): model chạy được nhưng không thấy vật nào trong 8 lớp.
 */
export async function classifyWithTfliteModel(imageBase64?: string | null): Promise<WasteClassification | null> {
  if (!imageBase64) return null;
  const model = await getTfliteModel();
  if (!model) return null;

  const input = preprocessImage(imageBase64);
  if (!input) return null;

  try {
    const outputs: ArrayBuffer[] = await model.run([input.tensor.buffer as ArrayBuffer]);
    if (!outputs?.length) return null;
    const out = new Float32Array(outputs[0]);
    if (out.length < (4 + NUM_CLASSES) * NUM_CANDIDATES) {
      console.warn("[TFLite] Kích thước output không đúng:", out.length);
      return null;
    }

    let bestScore = 0;
    let bestCls = -1;
    let bestIdx = -1;
    for (let cls = 0; cls < NUM_CLASSES; cls++) {
      const base = (4 + cls) * NUM_CANDIDATES;
      for (let c = 0; c < NUM_CANDIDATES; c++) {
        const score = out[base + c];
        if (score > bestScore) {
          bestScore = score;
          bestCls = cls;
          bestIdx = c;
        }
      }
    }

    if (bestCls < 0 || bestScore < CONFIDENCE_THRESHOLD) {
      console.log(`[TFLite] Điểm cao nhất ${(bestScore * 100).toFixed(1)}% < ngưỡng -> Không rõ`);
      return { ...buildUnknownResult(), note: "Mô hình best.pt (TFLite trên máy) không thấy vật thể nào thuộc 8 lớp đã huấn luyện." };
    }

    // Toạ độ output chuẩn hoá theo ảnh 640 (có viền letterbox) -> đổi về ảnh gốc 0..1
    const toPx = (v: number) => (v <= 1.5 ? v * INPUT_SIZE : v);
    const cx = toPx(out[bestIdx]);
    const cy = toPx(out[NUM_CANDIDATES + bestIdx]);
    const w = toPx(out[2 * NUM_CANDIDATES + bestIdx]);
    const h = toPx(out[3 * NUM_CANDIDATES + bestIdx]);
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const nx = (px: number) => clamp((px - input.padX) / input.scale / input.srcW);
    const ny = (py: number) => clamp((py - input.padY) / input.scale / input.srcH);
    const bbox = [nx(cx - w / 2), ny(cy - h / 2), nx(cx + w / 2), ny(cy + h / 2)].map((v) => Number(v.toFixed(4)));

    const classKey = MODEL_CLASS_NAMES[bestCls];
    const detail = SMARTBIN_CLASS_DETAILS[classKey];
    if (!detail || !(SMARTBIN_CLASSES as readonly string[]).includes(classKey)) return null;

    const rawConf = Math.round(bestScore * 100);
    const confidence = Math.max(50, Math.min(99, rawConf));
    console.log(`[TFLite] Phát hiện ${classKey} (${confidence}%) bbox=${JSON.stringify(bbox)}`);
    return {
      wasteType: detail.wasteType,
      category: detail.category,
      confidence,
      recyclable: detail.recyclable,
      binColor: detail.binCompartment,
      binCompartment: detail.binCompartment,
      material: detail.material,
      instructions: detail.instructions,
      disposalMethod: detail.disposalMethod,
      note: `Mô hình best.pt chạy trực tiếp trên điện thoại (TFLite): ${detail.note}`,
      classificationMode: "on-device",
      bbox,
      bestClass: classKey,
    };
  } catch (err: any) {
    console.warn("[TFLite] Lỗi khi chạy suy luận:", err?.message || err);
    return null;
  }
}
