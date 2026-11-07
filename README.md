# Hệ Thống Thùng Rác Thông Minh Phân Loại Bằng AI (Nhóm 4)

Dự án ứng dụng di động (React Native / Expo) kết hợp hệ thống thùng rác thông minh 2 ngăn (Hữu cơ & Vô cơ) điều khiển bởi Raspberry Pi và mô hình AI YOLOv8.


## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Khởi chạy Ứng dụng Giao diện (App Mobile)

Chỉ cần clone code về và thực hiện 2 lệnh:

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Khởi động giao diện Expo
npx expo start
```

- Nhấn phím `a` để mở trên Android Emulator / máy thật kết nối USB.
- Hoặc mở ứng dụng **Expo Go** trên điện thoại và quét mã QR hiển thị ở Terminal.

---

### 2. Khởi chạy Máy chủ Backend (Node.js)

```bash
cd server
npm install
npm start
```

mở thư mục sql: connect và chạy.
### 3. Mã nguồn Raspberry Pi & AI YOLOv8

Toàn bộ code chạy trên phần cứng nhúng Raspberry Pi, script kết nối camera ESP32 và mô hình YOLOv8 (`best.pt`) đã được tách riêng trong thư mục:
👉 [`code_ras/`](code_ras/)

Xem hướng dẫn chi tiết cách chạy Raspberry Pi tại [`code_ras/README.md`](code_ras/README.md).

---

## 📁 Cấu trúc thư mục

```text
├── src/                    # Giao diện React Native (Expo)
│   ├── components/         # Các UI component dùng chung
│   ├── context/            # Quản lý State toàn cục (AppContext)
│   ├── screens/            # Màn hình chính (Dashboard, Scan, Map, Notifications, Auth)
│   └── services/           # Kết nối API, GPS, định vị, thông báo
├── server/                 # Backend Node.js / Express
│   ├── index.js            # API server, xử lý ảnh, kết nối DB & AI
│   └── uploads/            # Thư mục lưu trữ ảnh quét rác
├── code_ras/               # Mã nguồn Raspberry Pi & AI YOLOv8
│   ├── best.pt             # Trọng số mô hình YOLOv8 (8 lớp rác)
│   ├── smartbin_brain.py   # Luồng điều khiển camera, servo & gửi log
│   ├── yolo_predict.py     # Script dự đoán AI trả kết quả JSON
│   ├── raspi_wifi_portal.py# Captive Portal cấu hình WiFi
│   └── README.md           # Hướng dẫn chạy trên Raspberry Pi
├── assets/                 # Icon chiếc lá, splash screen và logo
└── package.json            # Danh sách dependencies của ứng dụng
```
