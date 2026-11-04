# EcoSort - Kế hoạch kiểm thử chức năng

Các ca dưới đây là kịch bản cần chạy và ghi nhận trên ít nhất hai kích thước màn hình (ví dụ Android 6.1 inch và 6.7 inch). Chưa có kết quả kiểm thử thiết bị thực trong gói mã nguồn này.

| ID | Chức năng | Tiền điều kiện / thao tác | Kết quả mong đợi |
|---|---|---|---|
| TC-01 | Đăng nhập demo | Tắt backend, chọn “Dùng thử không cần tài khoản” | Vào Home, có nhãn Demo Member và dữ liệu mẫu |
| TC-02 | Đăng ký | Backend + SQL Server hoạt động; nhập họ tên, email mới, mật khẩu >= 6 ký tự | API tạo tài khoản, app chuyển vào Home |
| TC-03 | Đăng nhập sai | Backend hoạt động; nhập sai mật khẩu | Hiện lỗi xác thực, không tự đăng nhập demo |
| TC-04 | Camera | Cấp quyền camera, chụp một vật thể | Có ảnh xem trước và chuyển đến Kết quả nhận diện |
| TC-05 | Từ chối quyền camera | Từ chối quyền camera | App vẫn cho chọn ảnh từ thư viện và hiển thị hướng dẫn cấp quyền |
| TC-06 | Quyền riêng tư AI | Chụp ảnh, để consent tắt | Ảnh không gửi tới endpoint `/api/classify`; kết quả ghi rõ Demo |
| TC-07 | AI server | Cấu hình `OPENAI_API_KEY`, bật consent, chụp ảnh | Có loading, kết quả AI hoặc thông báo lỗi rõ ràng |
| TC-08 | Hướng dẫn phân loại | Mở Cẩm nang, chọn từng nhóm rác | Hiện ví dụ và các bước xử lý tương ứng |
| TC-09 | Telemetry Raspberry Pi | Gửi `POST /api/telemetry` với MAC hợp lệ | Mức đầy và thông số cảm biến cập nhật trên Smart Bin |
| TC-10 | Cảnh báo đầy | Gửi telemetry làm mức đầy >= 80% | Xuất hiện cảnh báo trong app; local notification nếu đã cấp quyền |
| TC-11 | Sự kiện camera kèm ảnh | Gửi `POST /api/bin-events` với Base64 ảnh | Thông báo hiển thị thumbnail; chạm để xem ảnh và metadata |
| TC-12 | Bản đồ / từ chối vị trí | Bấm dùng vị trí, sau đó từ chối quyền | Có thông báo quyền bị từ chối; vẫn mở được Google Maps tìm thủ công |
| TC-13 | Tải thêm thông báo | Có trên 10 thông báo | Nút “Tải thêm” hiển thị các mục tiếp theo |
| TC-14 | Offline / lỗi API | Tắt backend khi app đang mở | Home và Smart Bin dùng dữ liệu demo, không treo ứng dụng |

## Biên bản khi kiểm thử

| Lần chạy | Thiết bị / kích thước | Người kiểm thử | TC đạt / tổng | Lỗi và ảnh minh chứng |
|---|---|---|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
