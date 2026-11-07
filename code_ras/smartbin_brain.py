import cv2
import requests
import numpy as np
import time
import base64
from ultralytics import YOLO

# ================= 1. CẤU HÌNH HỆ THỐNG =================
import json
import os

CONFIG_FILE = "smartbin_config.json"
ESP32_IP = "192.168.156.140"
BACKEND_URL = "http://127.0.0.1:3000"
MAC_ADDRESS = "PI-NHOM4-001"

if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            ESP32_IP = cfg.get("esp32_ip", ESP32_IP)
            BACKEND_URL = cfg.get("backend_url", BACKEND_URL)
            MAC_ADDRESS = cfg.get("mac_address", MAC_ADDRESS)
            print(f"📁 Đã nạp cấu hình từ {CONFIG_FILE}: Backend={BACKEND_URL}, ESP32={ESP32_IP}")
    except Exception as e:
        print("⚠️ Lỗi đọc file cấu hình, dùng cấu hình mặc định:", e)

CAPTURE_URL = f"http://{ESP32_IP}/capture"
STATUS_URL  = f"http://{ESP32_IP}/status"
OPEN_ORG    = f"http://{ESP32_IP}/open_org"
OPEN_INORG  = f"http://{ESP32_IP}/open_inorg"
CLOSE_ALL   = f"http://{ESP32_IP}/close_all"

MODEL_PATH = "best.pt"

# Danh sách chuẩn 8 lớp
ORGANIC_CLASSES = ['rac-huu-co']
INORGANIC_CLASSES = [
    'chai-nhua', 'ly-nhua', 'tui-nilon', 'hop-sua', 
    'lon-nuoc-giai-khat-bang-kim-loai', 'chai-lo-manh-vo-thuy-tinh', 
    'khau-trang'
]

CONF_ORGANIC   = 0.30
CONF_INORGANIC = 0.45
LID_OPEN_SECONDS = 5.0
COOLDOWN_SECONDS = 8.0

# ================= 2. KHỞI CHẠY AI =================
print("🔄 Đang nạp mô hình AI YOLOv8-Small...")
model = YOLO(MODEL_PATH)
print("✅ Nạp AI thành công!")

print("\n" + "="*60)
print("🎯 HỆ THỐNG THÙNG RÁC THÔNG MINH ĐÃ SẴN SÀNG!")
print(f"- Đang giám sát ESP32 tại: {ESP32_IP}")
print("- Đưa tay/rác vào khoảng cách <= 30cm để kích chụp ảnh.")
print("="*60 + "\n")

last_trigger_time = 0

while True:
    try:
        # Tăng timeout lên 4.0s để tránh rớt gói mạng
        resp_status = requests.get(STATUS_URL, timeout=4.0)
        if resp_status.status_code == 200:
            data = resp_status.json()
            is_triggered = data.get("pir", 0)
            dist_detect  = data.get("detect_distance", 0)
            org_lvl      = data.get("organic_level", 0)
            inorg_lvl    = data.get("inorganic_level", 0)

            # In trạng thái thời gian thực để bạn theo dõi cảm biến
            print(f"📡 [ĐANG QUÉT] Khoảng cách: {dist_detect:5.1f}cm | Hữu cơ: {org_lvl}% | Vô cơ: {inorg_lvl}%   ", end="\r")
        else:
            is_triggered = 0
    except Exception:
        print("⚠️ Mạng WiFi chập chờn, đang thử kết nối lại...       ", end="\r")
        time.sleep(1.0)
        continue

    # KHI PHÁT HIỆN VẬT CẢN <= 30CM
    current_time = time.time()
    if is_triggered == 1 and (current_time - last_trigger_time > COOLDOWN_SECONDS):
        print("\n" + "="*60)
        print(f"🚨 [KÍCH HOẠT]: Phát hiện vật ở {dist_detect:.1f}cm (<= 30cm)!")
        print("📸 [1/3] Yêu cầu ESP32 chụp ảnh...")

        time.sleep(0.3)
        t_start = time.time()
        
        try:
            resp = requests.get(CAPTURE_URL, timeout=5)
            if resp.status_code != 200:
                print(f"❌ ESP32 trả về lỗi: {resp.status_code}")
                continue
                
            img_array = np.frombuffer(resp.content, dtype=np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if frame is None:
                print("❌ Lỗi giải mã ảnh JPEG!")
                continue
        except Exception as e:
            print("❌ Lỗi tải ảnh:", e)
            continue

        print(f"⚡ Thời gian chụp & tải: {time.time() - t_start:.2f}s")

        # Chạy AI
        t_ai = time.time()
        results = model.predict(frame, conf=0.20, verbose=False)
        annotated_frame = results[0].plot()
        print(f"🧠 Thời gian AI xử lý: {time.time() - t_ai:.2f}s")

        detected_action = None
        detected_item = ""
        best_conf = 0.0

        for box in results[0].boxes:
            cls_id = int(box.cls[0])
            label_name = model.names[cls_id]
            conf = float(box.conf[0])
            print(f"   🔍 Nhìn thấy: {label_name} ({conf*100:.1f}%)")

            if label_name in ORGANIC_CLASSES and conf >= CONF_ORGANIC:
                if conf > best_conf:
                    best_conf = conf
                    detected_action = "ORGANIC"
                    detected_item = f"{label_name} ({conf*100:.1f}%)"
            elif label_name in INORGANIC_CLASSES and conf >= CONF_INORGANIC:
                if conf > best_conf:
                    best_conf = conf
                    detected_action = "INORGANIC"
                    detected_item = f"{label_name} ({conf*100:.1f}%)"

        # Ra lệnh mở nắp
        if detected_action == "ORGANIC":
            print(f"\n🌱 [KẾT QUẢ]: {detected_item} -> [MỞ NẮP HỮU CƠ]")
            try: requests.get(OPEN_ORG, timeout=3)
            except Exception as e: print("Lỗi lệnh:", e)

        elif detected_action == "INORGANIC":
            print(f"\n🥤 [KẾT QUẢ]: {detected_item} -> [MỞ NẮP VÔ CƠ]")
            try: requests.get(OPEN_INORG, timeout=3)
            except Exception as e: print("Lỗi lệnh:", e)
        else:
            print("\n❓ [KẾT QUẢ]: Không thấy rác trong vùng nhận diện.")

        # Đồng bộ sự kiện camera & phân loại lên Nhom4 Backend + App Điện thoại
        try:
            _, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            b64_image = base64.b64encode(buffer).decode('utf-8')
            category_text = "Hữu cơ" if detected_action == "ORGANIC" else ("Vô cơ" if detected_action == "INORGANIC" else "Chưa phân loại")
            compartment_text = "Ngăn 1 · Hữu cơ" if detected_action == "ORGANIC" else ("Ngăn 2 · Vô cơ" if detected_action == "INORGANIC" else "Chưa xác định")
            requests.post(
                f"{BACKEND_URL}/api/bin-events",
                json={
                    "macAddress": MAC_ADDRESS,
                    "detectedLabel": detected_item or "Vật thể mới",
                    "category": category_text,
                    "binCompartment": compartment_text,
                    "confidence": round(best_conf * 100, 1),
                    "imageBase64": b64_image,
                    "mimeType": "image/jpeg",
                    "instructions": ["Đã nhận diện từ camera thùng rác thông minh bằng mô hình YOLO best.pt."],
                    "disposalMethod": f"Bỏ vào {compartment_text}",
                    "note": f"Mô hình AI best.pt nhận diện: {detected_item}"
                },
                timeout=3
            )
            requests.post(
                f"{BACKEND_URL}/api/telemetry",
                json={
                    "macAddress": MAC_ADDRESS,
                    "organicFillLevel": org_lvl,
                    "inorganicFillLevel": inorg_lvl,
                    "organicLidState": "Open" if detected_action == "ORGANIC" else "Closed",
                    "inorganicLidState": "Open" if detected_action == "INORGANIC" else "Closed",
                    "lidState": "Open" if detected_action else "Closed"
                },
                timeout=3
            )
            print("📱 [ĐỒNG BỘ]: Đã gửi sự kiện & mức đầy lên Backend và App Nhom4 thành công!")
        except Exception as e:
            pass  # Nếu backend chưa bật thì bỏ qua không chặn luồng phần cứng

        cv2.imshow("THUNG RAC THONG MINH", annotated_frame)
        cv2.waitKey(1000)

        if detected_action is not None:
            print(f"⏳ Giữ mở nắp trong {LID_OPEN_SECONDS}s...")
            time.sleep(LID_OPEN_SECONDS)
            print(">>> ĐÓNG NẮP THÙNG RÁC <<<")
            try: requests.get(CLOSE_ALL, timeout=3)
            except Exception as e: print("Lỗi đóng:", e)

        last_trigger_time = time.time()
        print(f"⏳ Nghỉ {COOLDOWN_SECONDS}s...")
        print("="*60 + "\n")

    time.sleep(0.3)
