import sys
import json
import os

def run_prediction():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Thiếu đường dẫn ảnh"}))
        return

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"success": False, "error": "File ảnh không tồn tại"}))
        return

    try:
        from ultralytics import YOLO
        model_path = os.path.join(os.path.dirname(__file__), "best.pt")
        if not os.path.exists(model_path):
            print(json.dumps({"success": False, "error": "Không tìm thấy file best.pt"}))
            return

        model = YOLO(model_path)
        # Chạy dự đoán với ngưỡng tự tin 0.15 (nhạy và tối ưu hơn)
        results = model(image_path, conf=0.15, verbose=False)

        detections = []
        for r in results:
            for cls_id, conf, box in zip(r.boxes.cls, r.boxes.conf, r.boxes.xyxyn):
                class_name = model.names[int(cls_id)]
                detections.append({
                    "class": class_name,
                    "confidence": round(float(conf) * 100, 1),
                    "bbox": [round(float(x), 4) for x in box]  # [x1, y1, x2, y2] dạng chuẩn hóa 0-1
                })

        if detections:
            detections.sort(key=lambda d: d["confidence"], reverse=True)
            best = detections[0]
            print(json.dumps({
                "success": True,
                "detectedClass": best["class"],
                "confidence": best["confidence"],
                "bbox": best["bbox"],
                "allDetections": detections
            }))
        else:
            print(json.dumps({
                "success": False,
                "detectedClass": "khong-co-rac",
                "confidence": 0,
                "message": "Không phát hiện vật thể thuộc 8 lớp của best.pt"
            }))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    run_prediction()
