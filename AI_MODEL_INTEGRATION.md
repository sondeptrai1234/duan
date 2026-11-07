# AI offline và Gemini trong Nhom4

## Model được sử dụng
- Nguồn: Hugging Face Space `ravi799/garbage-detection-using-tflite`.
- File: `waste_classifier_v5.tflite` (khoảng 34.9 MB), 30 nhãn có trong mã tham chiếu của Space.
- Project tải file vào bộ nhớ ứng dụng ở lần chạy đầu tiên trong Android/iOS Development Build; sau khi tải xong, model được giữ trên thiết bị và inference không cần Internet.
- Input theo mã tham chiếu: RGB `float32`, resize theo kích thước input tensor; mã tham chiếu không chia pixel cho 255.
- Mapping hiện tại của EcoBin: `coffee_grounds`, `egg_shells`, `food_waste`, `tea_bags` → Ngăn 1; các lớp còn lại → Ngăn 2; aerosol can được khuyến cáo xử lý riêng.

## Giới hạn quan trọng
- Đây là phân loại 30 lớp, không phải mô hình tổng quát nhận diện mọi loại rác. Ảnh nhiều vật thể, góc chụp lạ, ánh sáng kém hoặc vật thể ngoài 30 lớp có thể cho kết quả sai.
- Project chưa có benchmark độc lập trên ảnh rác tại Việt Nam; confidence của model không phải độ chính xác đã được kiểm chứng. Nên thử nhiều ảnh thật và điều chỉnh threshold trước khi demo chính thức.
- `assets/models/waste_model.tflite` là file người dùng cung cấp. File có 30 output nhưng không có label map đáng tin cậy trong gói ban đầu, nên không sử dụng cho inference.
- Metadata của Hugging Face Space khai báo MIT; giữ attribution và kiểm tra lại giấy phép nếu thay đổi nguồn model.

## Hai chế độ chạy
1. **Expo Go:** camera/thư viện ảnh + Gemini qua backend. Expo Go không nạp native TFLite runtime.
2. **Android Development Build:** `react-native-fast-tflite` + Nitro Modules, tải model ở lần đầu và sau đó nhận diện offline.

Nếu model chưa tải được, app báo lỗi và có thể chuyển sang Gemini nếu người dùng bật đồng ý gửi ảnh. App không tự tạo kết quả giả.
