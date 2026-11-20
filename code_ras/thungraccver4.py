import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"

import cv2
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import numpy as np
import time
import json
import base64
import threading
import subprocess
from collections import deque
from ultralytics import YOLO
from flask import Flask, request, jsonify, session, redirect, render_template_string

# ================= 1. CẤU HÌNH HỆ THỐNG 2 CỤM THÙNG RÁC =================
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

# Giá trị mặc định hỗ trợ chạy đồng thời 2 cụm thùng rác
DEFAULT_CONFIG = {
    # Cụm Thùng 1:
    "bin1_name": "Thùng 1",
    "bin1_ip": "192.168.106.140",
    "bin1_mac": "PI-NHOM4-001",
    "bin1_enabled": True,

    # Cụm Thùng 2:
    "bin2_name": "Thùng 2",
    "bin2_ip": "192.168.106.61",
    "bin2_mac": "PI-NHOM4-002",
    "bin2_enabled": True,

    # Backend Server (Node.js + SQL Server):
    "backend_url": "http://192.168.1.84:3000",
    "telemetry_interval": 5,              # Giây gửi mức đầy lên SQL

    # Web Portal quản trị:
    "portal_port": 8080,                  # http://localhost:8080
    "portal_password": "admin",           # Mật khẩu đăng nhập
    "ap_ssid": "SmartBin-Setup",          # WiFi Pi tự phát khi mất mạng
    "ap_password": "smartbin123",         # >= 8 ký tự
    "wifi_iface": "wlan0",
    "offline_checks_before_ap": 3,
    "auto_ap": True,
}

cfg_lock = threading.Lock()


def load_config():
    cfg = dict(DEFAULT_CONFIG)
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            saved = json.load(f)
            # Tương thích ngược nếu file config cũ dùng esp32_ip / mac_address đơn
            if "esp32_ip" in saved and "bin1_ip" not in saved:
                saved["bin1_ip"] = saved["esp32_ip"]
            if "mac_address" in saved and "bin1_mac" not in saved:
                saved["bin1_mac"] = saved["mac_address"]
            cfg.update(saved)
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f"⚠️ Lỗi đọc config.json: {e}")
    return cfg


def save_config(new_cfg):
    with cfg_lock:
        CFG.update(new_cfg)
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(CFG, f, ensure_ascii=False, indent=2)
            # Tự động đồng bộ ngay IP ESP32 và tên thùng sang Backend / Mobile App
            try:
                threading.Thread(target=sync_config_to_backend, daemon=True).start()
                for bid in (1, 2):
                    threading.Thread(target=send_telemetry_for_bin, args=(bid,), daemon=True).start()
            except Exception:
                pass
            return True
        except Exception as e:
            print(f"❌ Lỗi ghi config.json: {e}")
            return False


CFG = load_config()

# Helper lấy URL của từng thùng
def esp_url(bin_id, path):
    ip = CFG.get(f"bin{bin_id}_ip", "")
    return f"http://{ip}{path}"


# ================= 2. NẠP MODEL YOLO AI =================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(SCRIPT_DIR, "best2.pt")):
    MODEL_PATH = os.path.join(SCRIPT_DIR, "best2.pt")
elif os.path.exists("best2.pt"):
    MODEL_PATH = "best2.pt"
elif os.path.exists(os.path.join(SCRIPT_DIR, "best1.pt")):
    MODEL_PATH = os.path.join(SCRIPT_DIR, "best1.pt")
elif os.path.exists("best1.pt"):
    MODEL_PATH = "best1.pt"
elif os.path.exists(os.path.join(SCRIPT_DIR, "best.pt")):
    MODEL_PATH = os.path.join(SCRIPT_DIR, "best.pt")
else:
    MODEL_PATH = "best2.pt"

print(f"🚀 [AI MODEL] Đang nạp model: {MODEL_PATH}")
model = YOLO(MODEL_PATH)
ai_lock = threading.Lock()  # Khóa bảo vệ để 2 luồng dùng chung 1 model an toàn tuyệt đối

# Hỗ trợ cả 5 nhãn mới của best2.pt và các nhãn cũ
ORGANIC_CLASSES = ['rac-huu-co', 'huu_co']
INORGANIC_CLASSES = [
    'chai-nhua', 'chai_nhua',
    'lon-nuoc-giai-khat-bang-kim-loai', 'lon_nhom',
    'tui-nilon', 'nilong',
    'khau-trang', 'khau_trang',
    'ly-nhua', 'hop-sua', 'chai-lo-manh-vo-thuy-tinh'
]

CONF_ORGANIC   = 0.30
CONF_INORGANIC = 0.45
LID_OPEN_SECONDS = 4.0       # Giữ mở nắp trong 4 giây cho người dùng bỏ rác
DEBOUNCE_NO_DETECTION = 0.8  # Giãn cách 0.8s nếu không phát hiện rác để chống spam ảnh

TIMEOUT_STATUS  = (3, 6)
TIMEOUT_CAPTURE = (3, 12)
TIMEOUT_CMD     = (3, 6)
TIMEOUT_BACKEND = (3, 8)

FAIL_WARN_AFTER = 5

# ================= 3. TRẠNG THÁI TỪNG CỤM THÙNG RÁC =================
BINS_STATE = {
    1: {
        "name": "Thùng 1",
        "organic_level": 0,
        "inorganic_level": 0,
        "distance": 0.0,
        "organic_lid_state": "Closed",
        "inorganic_lid_state": "Closed",
        "lid_state": "Closed",
        "esp_online": False,
        "last_label": "",
        "last_event_time": "",
        "last_trigger_time": 0.0,
    },
    2: {
        "name": "Thùng 2",
        "organic_level": 0,
        "inorganic_level": 0,
        "distance": 0.0,
        "organic_lid_state": "Closed",
        "inorganic_lid_state": "Closed",
        "lid_state": "Closed",
        "esp_online": False,
        "last_label": "",
        "last_event_time": "",
        "last_trigger_time": 0.0,
    }
}

SYS_STATE = {
    "temperature": None,
    "humidity": None,
    "wifi_mode": "unknown",
    "wifi_ssid": "",
    "wifi_ip": "",
}

API_LOG = deque(maxlen=60)
API_LAST = {}


def log_api(name, ok, status, body):
    entry = {
        "time": time.strftime("%H:%M:%S"),
        "api": name,
        "ok": ok,
        "status": status,
        "response": body,
    }
    API_LOG.appendleft(entry)
    API_LAST[name] = entry


# ================= 4. HÀM GIAO TIẾP MẠNG =================
def make_session():
    s = requests.Session()
    retry = Retry(
        total=2,
        connect=2,
        read=1,
        backoff_factor=0.3,
        status_forcelist=(500, 502, 503, 504),
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=2, pool_maxsize=2)
    s.mount("http://", adapter)
    s.headers.update({"Connection": "close"})
    return s


backend_session = requests.Session()


def esp_get(session_obj, url, timeout, tries=2, pause=0.4):
    for _ in range(tries):
        try:
            r = session_obj.get(url, timeout=timeout)
            if r.status_code == 200:
                return r
        except Exception:
            pass
        time.sleep(pause)
    return None


def send_command(session_obj, url, name):
    for i in range(2):
        try:
            r = session_obj.get(url, timeout=TIMEOUT_CMD)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.3)
    print(f"❌ Lỗi gửi lệnh: {name} -> {url}")
    return False


def backend_post(api_name, path, payload):
    base = CFG.get("backend_url", "").rstrip("/")
    if not base:
        return False
    url = f"{base}{path}"
    try:
        r = backend_session.post(url, json=payload, timeout=TIMEOUT_BACKEND)
        ok = (r.status_code in (200, 201))
        try:
            body = r.json()
        except Exception:
            body = r.text[:200]
        log_api(api_name, ok, r.status_code, body)
        return ok
    except Exception as e:
        log_api(api_name, False, "EXC", f"{type(e).__name__}: {e}")
        return False


# ================= 5. HƯỚNG DẪN XỬ LÝ RÁC & GỬI DỮ LIỆU SQL =================
INSTRUCTION_MAP = {
    'chai-nhua': ["Đổ sạch nước bên trong", "Bóp dẹp vỏ chai", "Bỏ vào Ngăn 2 · Vô cơ"],
    'chai_nhua': ["Đổ sạch nước bên trong", "Bóp dẹp vỏ chai", "Bỏ vào Ngăn 2 · Vô cơ"],
    'lon-nuoc-giai-khat-bang-kim-loai': ["Đổ sạch đồ uống thừa", "Bóp dẹp vỏ lon kim loại", "Bỏ vào Ngăn 2 · Vô cơ"],
    'lon_nhom': ["Đổ sạch đồ uống thừa", "Bóp dẹp vỏ lon nhôm", "Bỏ vào Ngăn 2 · Vô cơ"],
    'hop-sua': ["Uống hết sữa hoặc đổ sạch", "Gấp dẹp vỏ hộp sữa", "Bỏ vào Ngăn 2 · Vô cơ"],
    'ly-nhua': ["Đổ bỏ đá và đồ uống thừa", "Bỏ ống hút vào bên trong ly", "Bỏ vào Ngăn 2 · Vô cơ"],
    'tui-nilon': ["Loại bỏ đồ bẩn bên trong", "Gấp gọn túi nilon", "Bỏ vào Ngăn 2 · Vô cơ"],
    'nilong': ["Loại bỏ đồ bẩn bên trong", "Gấp gọn túi nilon", "Bỏ vào Ngăn 2 · Vô cơ"],
    'khau-trang': ["Tháo quai khẩu trang", "Gấp gọn mặt trong lại", "Bỏ vào Ngăn 2 · Vô cơ"],
    'khau_trang': ["Tháo quai khẩu trang", "Gấp gọn mặt trong lại", "Bỏ vào Ngăn 2 · Vô cơ"],
    'chai-lo-manh-vo-thuy-tinh': ["Cẩn thận tránh bị thương", "Bọc kín nếu là mảnh vỡ", "Bỏ nhẹ nhàng vào Ngăn 2 · Vô cơ"],
    'rac-huu-co': ["Loại bỏ túi nilon (nếu có)", "Bỏ trực tiếp thức ăn thừa vào Ngăn 1 · Hữu cơ"],
    'huu_co': ["Loại bỏ túi nilon (nếu có)", "Bỏ trực tiếp thức ăn thừa vào Ngăn 1 · Hữu cơ"]
}


def label_info(label):
    if label in ORGANIC_CLASSES:
        return "Hữu cơ", "Ngăn 1 · Hữu cơ"
    elif label in INORGANIC_CLASSES:
        return "Vô cơ", "Ngăn 2 · Vô cơ"
    return "Chưa phân loại", "Ngăn 2 · Vô cơ"


def send_bin_event(bin_id, image_bytes, label, conf, fill_level=0.0):
    category, compartment = label_info(label)
    conf_pct = round(float(conf) * 100, 1) if float(conf) <= 1.0 else round(float(conf), 1)
    mac = CFG.get(f"bin{bin_id}_mac", f"PI-NHOM4-00{bin_id}")
    bname = BINS_STATE[bin_id]["name"]

    payload = {
        "macAddress": str(mac),
        "eventType": "WASTE_DISPOSAL",
        "detectedLabel": str(label),
        "category": category,
        "binCompartment": compartment,
        "confidence": conf_pct,
        "imageBase64": base64.b64encode(image_bytes).decode("ascii"),
        "mimeType": "image/jpeg",
        "instructions": INSTRUCTION_MAP.get(label, ["Bỏ đúng ngăn theo hướng dẫn"]),
        "disposalMethod": f"Phân loại vào {compartment}",
        "note": f"Nhận diện bởi AI YOLOv8 ({conf_pct}%) tại {bname}",
        "fillLevel": float(fill_level),
    }
    return backend_post(f"event_bin{bin_id}", "/api/bin-events", payload)


def send_bin_event_async(bin_id, image_bytes, label, conf, fill_level=0.0):
    threading.Thread(target=send_bin_event, args=(bin_id, image_bytes, label, conf, fill_level), daemon=True).start()


def sync_config_to_backend():
    """Tự động đồng bộ ngay tên thùng, MAC và IP ESP32 lên Backend / App Mobile."""
    try:
        payload = {
            "bins": [
                {
                    "binId": 1,
                    "name": CFG.get("bin1_name", "Thùng 1"),
                    "macAddress": CFG.get("bin1_mac", "PI-NHOM4-001"),
                    "espIp": CFG.get("bin1_ip", "192.168.106.140"),
                    "enabled": CFG.get("bin1_enabled", True),
                },
                {
                    "binId": 2,
                    "name": CFG.get("bin2_name", "Thùng 2"),
                    "macAddress": CFG.get("bin2_mac", "PI-NHOM4-002"),
                    "espIp": CFG.get("bin2_ip", "192.168.106.61"),
                    "enabled": CFG.get("bin2_enabled", True),
                }
            ]
        }
        return backend_post("sync_config", "/api/raspi/sync-config", payload)
    except Exception as e:
        print(f"⚠️ Lỗi sync_config_to_backend: {e}")
        return False


def send_telemetry_for_bin(bin_id):
    bdata = BINS_STATE[bin_id]
    mac = CFG.get(f"bin{bin_id}_mac", f"PI-NHOM4-00{bin_id}")
    name = CFG.get(f"bin{bin_id}_name", f"Thùng {bin_id}")
    esp_ip = CFG.get(f"bin{bin_id}_ip", "")
    org_lid = bdata.get("organic_lid_state", "Closed")
    inorg_lid = bdata.get("inorganic_lid_state", "Closed")
    overall_lid = "Open" if (org_lid == "Open" or inorg_lid == "Open") else "Closed"

    payload = {
        "macAddress": str(mac),
        "binId": int(bin_id),
        "name": str(name),
        "espIp": str(esp_ip),
        "espOnline": bool(bdata.get("esp_online", False)),
        "organicFillLevel": float(bdata.get("organic_level", 0.0)),
        "inorganicFillLevel": float(bdata.get("inorganic_level", 0.0)),
        "distanceCm": float(bdata.get("distance", 0.0)),
        "organicLidState": org_lid,
        "inorganicLidState": inorg_lid,
        "lidState": overall_lid,
    }
    if SYS_STATE.get("temperature") is not None:
        payload["temperature"] = float(SYS_STATE["temperature"])
    if SYS_STATE.get("humidity") is not None:
        payload["humidity"] = float(SYS_STATE["humidity"])
    return backend_post(f"telemetry_bin{bin_id}", "/api/telemetry", payload)


def telemetry_loop():
    """Gửi mức đầy và cấu hình (IP ESP32, tên thùng, MAC) của CẢ 2 THÙNG lên SQL Server định kỳ."""
    while True:
        try:
            for bid in (1, 2):
                if CFG.get(f"bin{bid}_enabled", True):
                    send_telemetry_for_bin(bid)
                    time.sleep(0.3)
        except Exception as e:
            print(f"⚠️ Lỗi luồng telemetry: {e}")
        time.sleep(max(2, int(CFG.get("telemetry_interval", 5))))


# ================= 6. LUỒNG QUẢN LÝ TỪNG CỤM THÙNG RÁC =================
def bin_worker(bin_id):
    """Mỗi thùng rác chạy trong 1 luồng riêng biệt, không làm nghẽn nhau."""
    session = make_session()
    bstate = BINS_STATE[bin_id]
    fail_count = 0

    print(f"🟢 [KHỞI ĐỘNG LUỒNG] {bstate['name']} (IP: {CFG.get(f'bin{bin_id}_ip')})")

    while True:
        if not CFG.get(f"bin{bin_id}_enabled", True):
            time.sleep(2)
            continue

        bname = bstate["name"]
        ip = CFG.get(f"bin{bin_id}_ip", "")
        if not ip:
            time.sleep(2)
            continue

        # 1. ĐỌC TRẠNG THÁI TỪ ESP32 (/status)
        try:
            r = session.get(f"http://{ip}/status", timeout=TIMEOUT_STATUS)
            if r.status_code == 200:
                data = r.json()
                is_triggered = data.get("pir", 0)
                dist_detect  = data.get("detect_distance", 0.0)
                org_lvl      = data.get("organic_level", 0)
                inorg_lvl    = data.get("inorganic_level", 0)

                esp_org_lid = data.get("organic_lid")
                esp_inorg_lid = data.get("inorganic_lid")
                if esp_org_lid is not None:
                    bstate["organic_lid_state"] = "Open" if esp_org_lid == 1 else "Closed"
                if esp_inorg_lid is not None:
                    bstate["inorganic_lid_state"] = "Open" if esp_inorg_lid == 1 else "Closed"
                bstate["lid_state"] = "Open" if (bstate["organic_lid_state"] == "Open" or bstate["inorganic_lid_state"] == "Open") else "Closed"

                # 🔒 CỐ ĐỊNH MỨC RÁC KHI NẮP MỞ: Chỉ cập nhật khi nắp đóng
                if bstate["lid_state"] == "Closed":
                    bstate["organic_level"] = org_lvl
                    bstate["inorganic_level"] = inorg_lvl

                # Báo kết nối thành công khi vừa khôi phục kết nối
                if not bstate["esp_online"]:
                    print(f"\n✅ [{bname}] ĐÃ KẾT NỐI THÀNH CÔNG tới ESP32 tại {ip}!")
                    print(f"   Khoảng cách: {dist_detect:.1f}cm | Hữu cơ: {org_lvl}% | Vô cơ: {inorg_lvl}% | Nắp: {bstate['lid_state']}\n")

                fail_count = 0
                bstate["esp_online"] = True
                bstate["distance"] = round(float(dist_detect), 1)

            else:
                fail_count += 1
                if bstate["esp_online"]:
                    print(f"\n⚠️ [{bname}] ESP32 phản hồi lỗi HTTP {r.status_code} từ {ip}")
                bstate["esp_online"] = False
        except Exception as e:
            fail_count += 1
            if bstate["esp_online"]:
                print(f"\n⚠️ [{bname}] MẤT KẾT NỐI tới ESP32 ({ip}): {type(e).__name__}")
            bstate["esp_online"] = False
            if fail_count % 15 == 0:
                print(f"\n🔴 [{bname}] Vẫn chưa kết nối được {ip} (lần {fail_count}). Kiểm tra nguồn và WiFi!")
            time.sleep(min(0.5 * fail_count, 3.0))
            continue

        # 2. XỬ LÝ KÍCH HOẠT NHẬN DIỆN RÁC
        # 🎯 Không chờ 8s, đưa vào là chụp ngay NHƯNG phải xong chu kỳ (nắp đóng)
        current_time = time.time()
        if is_triggered == 1 and bstate["lid_state"] == "Closed" and (current_time - bstate["last_trigger_time"] >= DEBOUNCE_NO_DETECTION):
            print("\n" + "=" * 60)
            print(f"🚨 [{bname.upper()} KÍCH HOẠT]: Phát hiện vật ở {dist_detect:.1f}cm (<= 30cm)!")
            print(f"📸 [{bname}] Yêu cầu chụp ảnh...")

            time.sleep(0.2)
            t_start = time.time()

            resp = esp_get(session, f"http://{ip}/capture", TIMEOUT_CAPTURE, tries=2, pause=0.4)
            if resp is None:
                print(f"❌ [{bname}] Không tải được ảnh, bỏ qua.")
                bstate["last_trigger_time"] = time.time()
                continue

            img_bytes = resp.content
            img_arr = np.frombuffer(img_bytes, dtype=np.uint8)
            frame = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)
            if frame is None:
                print(f"❌ [{bname}] Lỗi giải mã ảnh JPEG!")
                bstate["last_trigger_time"] = time.time()
                continue

            print(f"⚡ [{bname}] Tải ảnh xong ({time.time() - t_start:.2f}s). Bắt đầu nhận diện AI...")

            # 3. CHẠY AI (ĐƯỢC BẢO VỆ BẰNG KHÓA THREADING LOCK DÙNG CHUNG)
            t_ai = time.time()
            with ai_lock:
                results = model.predict(frame, conf=0.20, verbose=False)
            annotated_frame = results[0].plot()
            print(f"🧠 [{bname}] Thời gian AI: {time.time() - t_ai:.2f}s")

            detected_action = None
            detected_item = ""
            detected_label = ""
            best_conf = 0.0

            for box in results[0].boxes:
                cls_id = int(box.cls[0])
                label_name = model.names[cls_id]
                conf = float(box.conf[0])
                print(f"   🔍 [{bname}] Thấy: {label_name} ({conf * 100:.1f}%)")

                if label_name in ORGANIC_CLASSES and conf >= CONF_ORGANIC:
                    if conf > best_conf:
                        best_conf = conf
                        detected_action = "ORGANIC"
                        detected_label = label_name
                        detected_item = f"{label_name} ({conf * 100:.1f}%)"
                elif label_name in INORGANIC_CLASSES and conf >= CONF_INORGANIC:
                    if conf > best_conf:
                        best_conf = conf
                        detected_action = "INORGANIC"
                        detected_label = label_name
                        detected_item = f"{label_name} ({conf * 100:.1f}%)"

            # 4. RA LỆNH MỞ NẮP TƯƠNG ỨNG CHO THÙNG ĐÓ
            lid_opened = False
            if detected_action == "ORGANIC":
                print(f"\n🌱 [{bname}]: {detected_item} -> [MỞ NẮP HỮU CƠ]")
                lid_opened = send_command(session, f"http://{ip}/open_org", f"{bname} MỞ HỮU CƠ")
                if lid_opened:
                    bstate["organic_lid_state"] = "Open"
                    bstate["inorganic_lid_state"] = "Closed"
                    bstate["lid_state"] = "Open"
            elif detected_action == "INORGANIC":
                print(f"\n🥤 [{bname}]: {detected_item} -> [MỞ NẮP VÔ CƠ]")
                lid_opened = send_command(session, f"http://{ip}/open_inorg", f"{bname} MỞ VÔ CƠ")
                if lid_opened:
                    bstate["organic_lid_state"] = "Closed"
                    bstate["inorganic_lid_state"] = "Open"
                    bstate["lid_state"] = "Open"
            else:
                print(f"\n❓ [{bname}]: Không thấy rác trong vùng nhận diện.")

            # 5. GỬI SỰ KIỆN + ẢNH LÊN SQL SERVER VỚI ĐÚNG MAC CỦA THÙNG ĐÓ
            if detected_action:
                fill = bstate["organic_level"] if detected_action == "ORGANIC" else bstate["inorganic_level"]
                ok_enc, buf = cv2.imencode(".jpg", annotated_frame)
                send_bin_event_async(bin_id, buf.tobytes() if ok_enc else img_bytes,
                                     detected_label, best_conf, fill)
                bstate["last_label"] = detected_item
                bstate["last_event_time"] = time.strftime("%H:%M:%S")
                print(f"☁️  [{bname}] Đã đẩy sự kiện lên SQL Server.")

            # 6. ĐÓNG NẮP KHI HẾT GIỜ MỞ
            if lid_opened:
                print(f"⏳ [{bname}] Giữ nắp mở trong {LID_OPEN_SECONDS}s cho người dùng bỏ rác...")
                time.sleep(LID_OPEN_SECONDS)
                print(f">>> [{bname}] ĐÓNG NẮP THÙNG RÁC <<<")
                if send_command(session, f"http://{ip}/close_all", f"{bname} ĐÓNG NẮP"):
                    time.sleep(0.5)  # Chờ 0.5s để servo di chuyển hẳn về vị trí đóng
                    bstate["organic_lid_state"] = "Closed"
                    bstate["inorganic_lid_state"] = "Closed"
                    bstate["lid_state"] = "Closed"
                print(f"✅ [{bname}] Hoàn tất chu kỳ! Sẵn sàng nhận diện lần tiếp theo ngay lập tức.")
                bstate["last_trigger_time"] = 0.0  # Reset ngay để nhận diện được ngay
            else:
                bstate["last_trigger_time"] = time.time()
            print("=" * 60 + "\n")

        time.sleep(0.4)


# ================= 7. QUẢN LÝ WIFI & BẢO VỆ MẠNG =================
def run(cmd, timeout=10):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.returncode == 0, r.stdout.strip(), r.stderr.strip()
    except Exception as e:
        return False, "", str(e)


def wifi_status():
    iface = CFG.get("wifi_iface", "wlan0")
    ok, out, _ = run("nmcli -t -f TYPE,STATE dev")
    is_ap = "wifi:connected (externally)" in out or "wifi:connected" in out
    ok, cur, _ = run(f"nmcli -t -f active,ssid dev wifi | grep '^yes:' | cut -d: -f2")
    cur_ssid = cur.strip() if cur else ""
    ok, ip_out, _ = run(f"ip -4 addr show {iface} | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){{3}}'")
    ip = ip_out.splitlines()[0] if ip_out else ""
    ok, ping_out, _ = run("ping -c 1 -W 2 8.8.8.8")
    has_internet = ok

    if cur_ssid == CFG.get("ap_ssid"):
        mode = "ap"
    elif ip:
        mode = "client"
    else:
        mode = "disconnected"

    SYS_STATE.update(wifi_mode=mode, wifi_ssid=cur_ssid, wifi_ip=ip)
    return {"mode": mode, "ssid": cur_ssid, "ip": ip, "internet": has_internet}


def wifi_scan():
    run("nmcli dev wifi rescan", timeout=5)
    time.sleep(1)
    ok, out, _ = run("nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list")
    nets = []
    seen = set()
    for line in out.splitlines():
        p = line.split(":")
        if len(p) >= 2 and p[0] and p[0] not in seen:
            seen.add(p[0])
            nets.append({"ssid": p[0], "signal": int(p[1]) if p[1].isdigit() else 0, "secure": bool(p[2] if len(p) > 2 else False)})
    nets.sort(key=lambda x: x["signal"], reverse=True)
    return nets[:15]


def wifi_watchdog():
    offline_count = 0
    while True:
        if CFG.get("auto_ap", True):
            st = wifi_status()
            if st["mode"] == "disconnected":
                offline_count += 1
                if offline_count >= CFG.get("offline_checks_before_ap", 3):
                    run(f"nmcli dev wifi hotspot ifname {CFG.get('wifi_iface','wlan0')} ssid {CFG.get('ap_ssid')} password {CFG.get('ap_password')}")
                    offline_count = 0
            else:
                offline_count = 0
        time.sleep(10)


# ================= 8. TRANG WEB QUẢN TRỊ 2 THÙNG RÁC =================
app = Flask(__name__)
app.secret_key = os.urandom(24)

PAGE = """<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SmartBin 2 Cụm - Cấu hình</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#f0f4f2;color:#1b2b24}
header{background:#1f7a4d;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center}
main{max-width:960px;margin:16px auto;padding:0 12px;display:grid;gap:14px}
section{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px #0002}
h2{margin:0 0 12px;font-size:16px;color:#1f7a4d}
label{display:block;font-size:13px;margin:8px 0 3px;font-weight:600}
input,select{width:100%;padding:8px;border:1px solid #bbb;border-radius:6px;box-sizing:border-box}
button{background:#1f7a4d;color:#fff;border:0;padding:8px 14px;border-radius:6px;cursor:pointer;font-weight:600;margin-top:10px}
button.alt{background:#495057}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:650px){.grid2{grid-template-columns:1fr}}
.bincard{background:#f8faf9;border:1px solid #d8e2dc;border-radius:8px;padding:12px}
.bar{height:12px;background:#ddd;border-radius:6px;overflow:hidden;margin:4px 0 8px}.bar>i{display:block;height:100%;background:#1f7a4d}
.ok{color:#1f7a4d;font-weight:bold}.bad{color:#c0392b;font-weight:bold}small{color:#667}
pre{background:#101714;color:#b7f5cf;padding:10px;border-radius:8px;overflow:auto;max-height:220px;font-size:12px}
</style></head><body>
<header><b>🗑️ Hệ Thống 2 Cụm Thùng Rác Thông Minh</b><a href="/logout" style="color:#fff">Đăng xuất</a></header>
<main>
<section><h2>📊 Giám Sát Thời Gian Thực (2 Cụm Thùng)</h2>
<div class="grid2">
 <div class="bincard" id="c1">Đang tải Thùng 1...</div>
 <div class="bincard" id="c2">Đang tải Thùng 2...</div>
</div>
</section>

<section><h2>⚙️ Cấu Hình Địa Chỉ IP & MAC Server</h2>
<div class="grid2">
 <div>
  <h3>🗑️ Cụm Thùng 1</h3>
  <label>Tên hiển thị</label><input id="bin1_name">
  <label>Địa chỉ IP ESP32</label><input id="bin1_ip">
  <label>Mã MAC thùng rác (SQL)</label><input id="bin1_mac">
 </div>
 <div>
  <h3>🗑️ Cụm Thùng 2</h3>
  <label>Tên hiển thị</label><input id="bin2_name">
  <label>Địa chỉ IP ESP32</label><input id="bin2_ip">
  <label>Mã MAC thùng rác (SQL)</label><input id="bin2_mac">
 </div>
</div>
<hr style="margin:16px 0;border:0;border-top:1px solid #eee">
<div class="grid2">
 <div><label>Địa chỉ Server SQL (Backend Node.js)</label><input id="backend_url"></div>
 <div><label>Chu kỳ gửi Telemetry (giây)</label><input id="telemetry_interval" type="number" min="2"></div>
</div>
<button onclick="saveCfg()">💾 Lưu Cấu Hình</button>
<button class="alt" onclick="testBackend()">Kiểm tra kết nối Server</button>
<span id="msg" style="margin-left:10px"></span>
</section>

<section><h2>📜 Log Kết Nối & Nhận Diện Gần Nhất</h2>
<pre id="log">-</pre>
</section>
</main>
<script>
const $=id=>document.getElementById(id);
async function j(u,o){const r=await fetch(u,o);if(r.status==401)location='/login';return r.json()}
const post=(u,b)=>j(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
let loaded=false;
async function refresh(){
 const s=await j('/api/state');
 for(const bid of [1, 2]){
  const b=s.bins[bid];
  $(`c${bid}`).innerHTML=`<b>${b.name}</b> (${s.config[`bin${bid}_ip`]}): <span class="${b.esp_online?'ok':'bad'}">${b.esp_online?'Online':'Offline'}</span><br>
  Khoảng cách: <b>${b.distance}cm</b> | Nắp: <b>${b.lid_state}</b> (HC: ${b.organic_lid_state} | VC: ${b.inorganic_lid_state})<br>
  Hữu cơ: ${b.organic_level}%<div class="bar"><i style="width:${b.organic_level}%"></i></div>
  Vô cơ: ${b.inorganic_level}%<div class="bar"><i style="width:${b.inorganic_level}%"></i></div>
  <small>Nhận diện cuối: ${b.last_label||'-'} (${b.last_event_time||'-'})</small>`;
 }
 if(!loaded){
  for(const k of ['bin1_name','bin1_ip','bin1_mac','bin2_name','bin2_ip','bin2_mac','backend_url','telemetry_interval']){
   if($(k)&&s.config[k])$(k).value=s.config[k];
  }
  loaded=true;
 }
 $('log').textContent=s.log.map(e=>`${e.time} [${e.api}] ${e.ok?'OK':'ERR'} ${e.status} ${typeof e.response=='string'?e.response:JSON.stringify(e.response)}`).join('\\n')||'-';
}
async function saveCfg(){
 const b={
  bin1_name:$('bin1_name').value, bin1_ip:$('bin1_ip').value, bin1_mac:$('bin1_mac').value,
  bin2_name:$('bin2_name').value, bin2_ip:$('bin2_ip').value, bin2_mac:$('bin2_mac').value,
  backend_url:$('backend_url').value, telemetry_interval:parseInt($('telemetry_interval').value)||5
 };
 const r=await post('/api/config',b);
 $('msg').textContent=r.message;
 setTimeout(()=>{$('msg').textContent=''},3000);
}
async function testBackend(){
 $('msg').textContent='Đang thử kết nối...';
 const r=await j('/api/test_backend');
 $('msg').textContent=r.message;
}
setInterval(refresh, 2000); refresh();
</script></body></html>"""

LOGIN_PAGE = """<!doctype html><html><head><meta charset="utf-8"><title>Đăng nhập</title>
<style>body{font-family:sans-serif;background:#f3f5f4;display:grid;place-content:center;height:90vh}
form{background:#fff;padding:24px;border-radius:10px;box-shadow:0 1px 4px #0002;width:280px}
input{width:100%;padding:8px;margin:8px 0 16px;box-sizing:border-box}
button{width:100%;background:#1f7a4d;color:#fff;border:0;padding:10px;border-radius:6px;cursor:pointer}
</style></head><body>
<form method="post"><h3 style="margin-top:0">Đăng nhập SmartBin</h3>
<label>Mật khẩu quản trị</label><input type="password" name="p" autofocus required>
<button>Vào cấu hình</button></form></body></html>"""


@app.before_request
def auth_check():
    if request.path.startswith("/api/") or request.path in ("/login", "/static"):
        return
    if not session.get("logged"):
        return redirect("/login")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        if request.form.get("p") == CFG.get("portal_password", "admin"):
            session["logged"] = True
            return redirect("/")
    return render_template_string(LOGIN_PAGE)


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")


@app.route("/")
def index():
    return render_template_string(PAGE)


@app.route("/api/state")
def api_state():
    return jsonify({
        "bins": BINS_STATE,
        "system": SYS_STATE,
        "config": CFG,
        "log": list(API_LOG)[:30]
    })


@app.route("/api/config", methods=["POST"])
def api_config():
    d = request.json or {}
    save_config(d)
    return jsonify({"success": True, "message": "Đã lưu cấu hình thành công!"})


@app.route("/api/test_backend")
def api_test_backend():
    ok = send_telemetry_for_bin(1)
    return jsonify({"success": ok, "message": "Kết nối thành công tới SQL Server!" if ok else "Không kết nối được server!"})


def start_portal():
    app.run(host="0.0.0.0", port=int(CFG.get("portal_port", 8080)), debug=False, use_reloader=False)


def console_monitor_loop():
    """In dòng trạng thái quét trực quan cả 2 thùng rác theo thời gian thực."""
    time.sleep(2.0)
    while True:
        try:
            b1 = BINS_STATE[1]
            b2 = BINS_STATE[2]

            st1 = "ONLINE" if b1["esp_online"] else "OFFLINE"
            st2 = "ONLINE" if b2["esp_online"] else "OFFLINE"

            info1 = f"[{b1['name']} {st1}] {b1['distance']:4.1f}cm | H:{b1['organic_level']:2d}% V:{b1['inorganic_level']:2d}% | Nắp:{b1['lid_state']}"
            info2 = f"[{b2['name']} {st2}] {b2['distance']:4.1f}cm | H:{b2['organic_level']:2d}% V:{b2['inorganic_level']:2d}% | Nắp:{b2['lid_state']}"

            print(f"📡 {info1}  ||  {info2}      ", end="\r")
        except Exception:
            pass
        time.sleep(1.0)


# ================= 9. KHỞI CHẠY TOÀN BỘ HỆ THỐNG =================
if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("🗑️  HỆ THỐNG PHÂN LOẠI RÁC THÔNG MINH 2 CỤM THÙNG RÁC - NHÓM 4")
    print(f"👉 Thùng 1: IP = {CFG.get('bin1_ip')} | MAC = {CFG.get('bin1_mac')}")
    print(f"👉 Thùng 2: IP = {CFG.get('bin2_ip')} | MAC = {CFG.get('bin2_mac')}")
    print(f"👉 Server SQL: {CFG.get('backend_url')}")
    print(f"👉 Web Portal: http://localhost:{CFG.get('portal_port', 8080)}")
    print("=" * 65)

    # Kiểm tra kết nối nhanh tới 2 ESP32 trước khi bắt đầu
    print("\n🔍 [KIỂM TRA KẾT NỐI TỚI 2 ESP32-CAM]")
    for bid in (1, 2):
        ip = CFG.get(f"bin{bid}_ip")
        name = CFG.get(f"bin{bid}_name", f"Thùng {bid}")
        print(f"   👉 Đang kết nối {name} ({ip})...", end=" ", flush=True)
        try:
            r = requests.get(f"http://{ip}/status", timeout=2.5)
            if r.status_code == 200:
                d = r.json()
                print(f"✅ KẾT NỐI TỐT! (Khoảng cách: {d.get('detect_distance', 0)}cm | Hữu cơ: {d.get('organic_level', 0)}% | Vô cơ: {d.get('inorganic_level', 0)}%)")
            else:
                print(f"⚠️ ESP32 phản hồi HTTP {r.status_code}")
        except Exception as e:
            print(f"❌ CHƯA THẤY ONLINE ({type(e).__name__}). Đang chờ kết nối...")
    print("=" * 65 + "\n")

    # 0. Đồng bộ ngay cấu hình (IP ESP32, tên, MAC) sang Backend / Mobile App
    sync_config_to_backend()

    # 1. Khởi chạy luồng Web Portal cấu hình
    threading.Thread(target=start_portal, daemon=True).start()

    # 2. Khởi chạy luồng Telemetry gửi dữ liệu 2 thùng lên SQL
    threading.Thread(target=telemetry_loop, daemon=True).start()

    # 3. Khởi chạy luồng giám sát WiFi
    threading.Thread(target=wifi_watchdog, daemon=True).start()

    # 4. Khởi chạy 2 luồng công nhân (Worker) quản lý song song 2 thùng rác
    t1 = threading.Thread(target=bin_worker, args=(1,), daemon=True)
    t2 = threading.Thread(target=bin_worker, args=(2,), daemon=True)

    t1.start()
    t2.start()

    # 5. Khởi chạy luồng in trạng thái quét thời gian thực
    threading.Thread(target=console_monitor_loop, daemon=True).start()

    # Giữ tiến trình chính hoạt động
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Đã dừng hệ thống an toàn.")
