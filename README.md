# EcoSort - Smart Waste Management

Ứng dụng di động React Native + Expo kết hợp thùng rác thông minh Raspberry Pi. Giao diện được triển khai theo 10 màn hình trong bộ PDF Figma mà nhóm gửi: Login, Home, Scan, Scan Result, Smart Bin, Recycling Map, Waste Guide, Notifications, Account và Bin Detection có ảnh.

## 1. Chức năng chính

- Đăng nhập / đăng ký tài khoản qua REST API và SQL Server; có chế độ demo khi backend chưa sẵn sàng.
- Trang chủ hiển thị thành tích phân loại và trạng thái thùng rác.
- Quét rác bằng camera, hoặc chọn ảnh từ thư viện. Người dùng phải bật công tắc đồng ý trước khi ảnh được gửi tới AI server.
- AI phân loại rác qua OpenAI API nếu backend có `OPENAI_API_KEY`. Nếu chưa cấu hình, API trả về kết quả demo có gắn nhãn `Kết quả demo`.
- Smart Bin đọc mức đầy, nhiệt độ, độ ẩm, nắp thùng từ `GET /api/trashcans`; dữ liệu được làm mới mỗi 5 giây.
- Thông báo rác đầy (>= 80%), nhiệt độ cao (>= 50°C), sự kiện camera từ Raspberry Pi có ảnh.
- Cẩm nang 4 nhóm: tái chế, hữu cơ, rác còn lại, rác nguy hại.
- Bản đồ xin quyền vị trí khi người dùng bấm. Danh sách điểm trong code là dữ liệu minh họa; nút Google Maps dùng truy vấn tìm kiếm điểm thu gom gần vị trí hiện tại.
- Reanimated cho thanh mức đầy; Gesture Handler + Reanimated cho thao tác vuốt bỏ thẻ mẹo; Tamagui có light/dark theme và các component tái sử dụng.

## 2. Yêu cầu môi trường

- Node.js >= 22.13 (phù hợp Expo SDK 58).
- SQL Server 2019+ hoặc phiên bản tương thích, bật TCP/IP và SQL Authentication.
- Điện thoại Android/iOS hoặc Expo Go tương thích SDK 58; camera cần thiết bị thật.

## 3. Cài đặt mobile app

```bash
npm install
```

Tạo file `.env` ở thư mục gốc từ `.env.example`, rồi sửa API URL:

- Web cùng máy: `EXPO_PUBLIC_API_URL=http://localhost:3000`
- Android Emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`
- Điện thoại thật: `EXPO_PUBLIC_API_URL=http://IP_LAN_CUA_MAY_TINH:3000`

Chạy ứng dụng:

```bash
npx expo start -c
```

Quét QR bằng Expo Go hoặc chạy web:

```bash
npm run web
```

> Lần đầu sau khi thêm native module cần khởi động lại Metro. Nếu Expo Go trên thiết bị chưa hỗ trợ đúng SDK 58, dùng development build theo hướng dẫn EAS/Expo.

## 4. Cài đặt backend

```bash
cd server
npm install
```

Tạo `server/.env` từ `server/.env.example`, nhập SQL Server login/password. Không commit `.env` lên Git.

Mở SSMS, chạy toàn bộ file `sql/SmartTrashDB.sql`. Tài khoản SQL trong `server/.env` phải có quyền truy cập database `SmartTrashDB` và các bảng.

Nếu cần AI thật, đặt `OPENAI_API_KEY` ở `server/.env`. Không đặt khóa này trong ứng dụng mobile. Khi không có khóa, `/api/classify` trả kết quả mô phỏng để nhóm có thể demo luồng.

Khởi động:

```bash
cd server
npm start
```

Kiểm tra:

```text
GET http://localhost:3000/api/health
GET http://localhost:3000/api/trashcans
```

## 5. Kết nối Raspberry Pi

### Telemetry

`POST /api/telemetry` - Raspberry Pi gửi dữ liệu cảm biến:

```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "distanceCm": 64,
  "temperature": 31.5,
  "humidity": 62,
  "lidState": "Closed"
}
```

`Capacity` của thùng trong database phải cùng đơn vị cm với `distanceCm`. Công thức:

`FillLevel = clamp(round((Capacity - distanceCm) / Capacity * 100), 0, 100)`

### Camera event có ảnh

Khi cảm biến phát hiện vật thể và camera trên Raspberry Pi chụp được ảnh, gửi `POST /api/bin-events` với các trường `macAddress`, `imageBase64`, `mimeType`, `detectedLabel`, `category`, `confidence`.

Có script mẫu trong `raspberry_pi/send_bin_event.py`. Script chỉ upload ảnh đã chụp; nhóm cần gọi script từ vòng lặp cảm biến/camera thật. Ứng dụng đọc `GET /api/bin-events`, hiện thumbnail và màn hình chi tiết sự kiện.

Ví dụ:

```bash
python send_bin_event.py --server http://192.168.1.10:3000 --mac-address AA:BB:CC:DD:EE:FF --image /tmp/bin-frame.jpg
```

## 6. Điều hướng và build EAS

Ứng dụng có Stack + Bottom Tabs và deep-link scheme `ecosort://`:

- `ecosort://login`
- `ecosort://app/home`
- `ecosort://app/scan`
- `ecosort://guide`
- `ecosort://notifications`
- `ecosort://bin-event`

Cài EAS CLI và đăng nhập tài khoản Expo:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile preview --platform android
```

Các profile `development`, `preview`, `production` đã được khai báo trong `eas.json`. Build cần tài khoản Expo và phải chạy trên môi trường có thể tải dependency.

## 7. API hiện có

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/api/health` | Kiểm tra server và SQL Server |
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/trashcans` | Danh sách thùng và telemetry mới nhất |
| POST | `/api/telemetry` | Raspberry Pi gửi cảm biến |
| POST | `/api/classify` | Phân loại ảnh bằng AI / demo |
| POST | `/api/waste-records` | Lưu kết quả phân loại |
| GET | `/api/waste-records` | Lịch sử phân loại |
| POST | `/api/bin-events` | Nhận sự kiện camera kèm ảnh từ Raspberry Pi |
| GET | `/api/bin-events` | Lấy sự kiện camera mới nhất |

## 8. Tình trạng demo và các phần cần cấu hình thật

- Không cấu hình SQL: ứng dụng vẫn chạy với dữ liệu thùng rác mẫu; đăng nhập demo dùng thông tin cục bộ trong phiên hiện tại.
- Không cấu hình `OPENAI_API_KEY`: kết quả phân loại là dữ liệu demo, không phải AI nhận diện ảnh.
- Điểm thu gom trên bản đồ là dữ liệu minh họa, cần thay bằng địa điểm được xác minh hoặc tích hợp Places API trước khi công bố.
- Ảnh sự kiện thùng rác chỉ xuất hiện khi camera Raspberry Pi gửi ảnh Base64 đến `/api/bin-events`.
- Thông báo điện thoại hiện dùng local notifications. Push notification từ server cần cấu hình Expo Push Token và dịch vụ gửi push riêng.
- Ngưỡng cảnh báo hiện tại: mức rác >= 80%, nhiệt độ >= 50°C; cần hiệu chỉnh theo phần cứng và thử nghiệm thực tế.

## 9. Bảo mật

- Không commit `server/.env`, API key, mật khẩu SQL hoặc dữ liệu cá nhân.
- Ảnh chỉ gửi tới AI server khi người dùng bật consent trên màn hình Quét rác.
- Tài khoản dùng scrypt để băm mật khẩu; không lưu mật khẩu dạng rõ.
- Khi triển khai thực tế, cần thêm HTTPS, xác thực token/session cho API, giới hạn tốc độ và chính sách lưu/xóa ảnh.


## 10. Kiểm thử

Các kịch bản kiểm thử chức năng (bao gồm thành công và thất bại) nằm trong `TEST_PLAN.md`. Nhóm cần thực thi trên ít nhất hai kích thước màn hình, điền kết quả thật và chụp ảnh minh chứng; bảng hiện tại chỉ là kế hoạch, không phải kết quả đã chạy.
