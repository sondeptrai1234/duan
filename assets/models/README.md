# Ghi chú model offline

`waste_model.tflite` là file được người dùng gửi kèm. SHA-256: `89c7689b8efded427d6d2145f36f485118805dce10ed147fbe8f1d375fbceb32`. File này có 30 đầu ra nhưng không có label map/input-preprocessing đủ tin cậy trong nguồn ban đầu nên không dùng để inference.

Model được chọn cho inference là `waste_classifier_v5.tflite` từ Hugging Face Space `ravi799/garbage-detection-using-tflite`. Ứng dụng tự tải file khoảng 34.9 MB ở lần phân loại đầu tiên trong Development Build, sau đó cache vào bộ nhớ app. File model thay thế không nằm sẵn trong ZIP.

Expo Go sẽ bỏ qua TFLite để tránh tải model không cần thiết và dùng Gemini qua backend khi bật đồng ý chia sẻ ảnh.
