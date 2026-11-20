/*
 * =========================================================================
 * ECOBIN NHÓM 4 - MÃ NGUỒN ĐIỀU KHIỂN ESP32 / ESP32-CAM
 * Tích hợp: Cảm biến siêu âm, 2 Động cơ Servo (Ngăn Hữu cơ & Vô cơ), Camera
 * =========================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

// 1. CẤU HÌNH THÔNG TIN WIFI (CÙNG MẠNG VỚI MÁY TÍNH / PI)
const char* ssid     = "TEN_WIFI_CUA_BAN";
const char* password = "MAT_KHAU_WIFI";

// 2. CẤU HÌNH CHÂN GPIO PHẦN CỨNG
// Servo điều khiển nắp 2 ngăn
const int SERVO_ORG_PIN   = 13; // Chân Servo Ngăn 1 (Hữu cơ)
const int SERVO_INORG_PIN = 14; // Chân Servo Ngăn 2 (Vô cơ)

// Cảm biến siêu âm HC-SR04 phát hiện vật thể/người bỏ rác
const int TRIG_PIN = 4;
const int ECHO_PIN = 5;

// Góc mở và đóng nắp của Servo
const int ANGLE_CLOSED = 0;   // Góc đóng
const int ANGLE_OPEN   = 90;  // Góc mở

Servo servoOrganic;
Servo servoInorganic;
WebServer server(80);

// Đọc khoảng cách từ cảm biến siêu âm (đơn vị: cm)
float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // Timeout 30ms (~5 mét)
  if (duration == 0) return 999.0;
  return (duration * 0.0343) / 2.0;
}

// ---------------- CÁC ROUTE API PHỤC VỤ BRAIN PYTHON ----------------

// 1. GET /status: Báo cáo trạng thái cảm biến và mức đầy
void handleStatus() {
  float dist = readDistanceCm();
  int isTriggered = (dist <= 30.0 && dist > 1.0) ? 1 : 0; // Phát hiện vật <= 30cm

  // Tính phần trăm rác (có thể gắn thêm cảm biến đo mức rác trong thùng)
  int orgLevel = 45;   // Giả lập hoặc đọc từ cảm biến mức rác ngăn 1
  int inorgLevel = 60; // Giả lập hoặc đọc từ cảm biến mức rác ngăn 2

  String json = "{";
  json += "\"pir\":" + String(isTriggered) + ",";
  json += "\"detect_distance\":" + String(dist, 1) + ",";
  json += "\"organic_level\":" + String(orgLevel) + ",";
  json += "\"inorganic_level\":" + String(inorgLevel);
  json += "}";

  server.send(200, "application/json", json);
}

// 2. GET /open_org: Mở nắp ngăn Hữu cơ
void handleOpenOrg() {
  servoOrganic.write(ANGLE_OPEN);
  server.send(200, "text/plain", "OPEN_ORGANIC_OK");
  Serial.println("[LỆNH]: Đã mở nắp Hữu cơ");
}

// 3. GET /open_inorg: Mở nắp ngăn Vô cơ
void handleOpenInorg() {
  servoInorganic.write(ANGLE_OPEN);
  server.send(200, "text/plain", "OPEN_INORGANIC_OK");
  Serial.println("[LỆNH]: Đã mở nắp Vô cơ");
}

// 4. GET /close_all: Đóng toàn bộ các nắp
void handleCloseAll() {
  servoOrganic.write(ANGLE_CLOSED);
  servoInorganic.write(ANGLE_CLOSED);
  server.send(200, "text/plain", "CLOSE_ALL_OK");
  Serial.println("[LỆNH]: Đã đóng toàn bộ nắp");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- ECOBIN NHÓM 4 - KHỞI ĐỘNG ESP32 ---");

  // Cấu hình chân cảm biến siêu âm
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // Cấu hình 2 Động cơ Servo
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoOrganic.setPeriodHertz(50);
  servoInorganic.setPeriodHertz(50);
  servoOrganic.attach(SERVO_ORG_PIN, 500, 2400);
  servoInorganic.attach(SERVO_INORG_PIN, 500, 2400);

  // Đóng nắp ban đầu
  servoOrganic.write(ANGLE_CLOSED);
  servoInorganic.write(ANGLE_CLOSED);

  // Kết nối Wi-Fi
  Serial.print("Đang kết nối WiFi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ Đã kết nối WiFi thành công!");
  Serial.print("👉 Địa chỉ IP của ESP32: ");
  Serial.println(WiFi.localIP());

  // Đăng ký các Route API
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/open_org", HTTP_GET, handleOpenOrg);
  server.on("/open_inorg", HTTP_GET, handleOpenInorg);
  server.on("/close_all", HTTP_GET, handleCloseAll);

  server.begin();
  Serial.println("🌐 Web Server đã sẵn sàng phục vụ các lệnh từ Python AI!");
}

void loop() {
  server.handleClient();
  delay(20);
}
