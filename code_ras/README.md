# Code Raspberry Pi & AI YOLOv8 (EcoBin - Nhom 4)

Thư mục này chứa toàn bộ mã nguồn chạy trên Raspberry Pi / máy tính nhúng và mô hình AI YOLOv8 (`best.pt`) nhận diện phân loại 8 nhóm rác thải tự động.

---

## 📁 Cấu trúc thư mục

- `best.pt`: Trọng số mô hình AI YOLOv8 đã train nhận diện 8 nhóm rác (chai nhựa, lon kim loại, túi nilon, hộp sữa, ly nhựa, chai lọ thủy tinh, khẩu trang, rác hữu cơ).
- `smartbin_brain.py`: Luồng xử lý chính trên Raspberry Pi (chụp ảnh từ camera ESP32-CAM/USB, nhận diện qua `best.pt`, gửi lệnh mở nắp thùng rác tương ứng qua servo và đẩy log về server).
- `yolo_predict.py`: Script nhận diện đơn lẻ nhận input là đường dẫn ảnh và trả về kết quả JSON chuẩn hóa.
- `raspi_wifi_portal.py`: Captive Portal phát Access Point để cấu hình WiFi cho Raspberry Pi khi đổi mạng.
- `smartbin_config.json`: File cấu hình địa chỉ IP ESP32, IP server backend và MAC address của thùng rác.
- `requirements.txt`: Danh sách thư viện Python cần thiết.

---

## 🚀 Hướng dẫn cài đặt & chạy trên Raspberry Pi

### 1. Cài đặt môi trường
Khuyên dùng Python 3.9 - 3.11:

```bash
# Tạo và kích hoạt môi trường ảo
python3 -m venv venv
source venv/bin/activate

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

### 2. Cấu hình kết nối
Mở file `smartbin_config.json` và chỉnh sửa IP phù hợp:
- `esp32_ip`: IP của mạch ESP32 (điều khiển servo nắp thùng & camera).
- `backend_url`: IP máy tính chạy server Node.js (ví dụ `http://192.168.1.50:3000`).

### 3. Khởi chạy hệ thống tự động
```bash
python smartbin_brain.py
```

### 4. Test nhanh mô hình với 1 ảnh bất kỳ
```bash
python yolo_predict.py duong_dan_anh.jpg
```
Kết quả trả về JSON gồm: tên nhãn (`detectedClass`), độ tin cậy (`confidence` %) và tọa độ bounding box (`bbox`).
