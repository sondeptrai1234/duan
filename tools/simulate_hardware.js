/**
 * Công cụ giả lập phần cứng Raspberry Pi & Cảm biến thùng rác Nhom4
 * Dùng để test toàn bộ cơ sở dữ liệu và realtime trên Mobile App mà KHÔNG cần phần cứng thật!
 *
 * Cách chạy:
 *   node tools/simulate_hardware.js           (Chạy menu tương tác)
 *   node tools/simulate_hardware.js --telemetry (Gửi dữ liệu mức đầy 2 ngăn & cảm biến)
 *   node tools/simulate_hardware.js --event     (Giả lập camera thùng rác chụp được rác)
 *   node tools/simulate_hardware.js --loop      (Giả lập cảm biến chạy liên tục mỗi 5s)
 */

const fs = require("fs");
const path = require("path");

const SERVER_URL = process.env.SERVER_URL || "http://127.0.0.1:3000";
const MAC_ADDRESS = "PI-NHOM4-001";

// 1. Gửi Telemetry (Cảm biến mức đầy Ngăn 1 Hữu cơ, Ngăn 2 Vô cơ, Nhiệt độ, Độ ẩm)
async function sendTelemetry(options = {}) {
  const organic = options.organic ?? Math.floor(Math.random() * 40 + 35); // 35 - 75%
  const inorganic = options.inorganic ?? Math.floor(Math.random() * 45 + 40); // 40 - 85%
  const temp = options.temp ?? (30 + Math.random() * 4).toFixed(1);
  const hum = options.hum ?? Math.floor(Math.random() * 20 + 55);
  const orgLid = options.orgLid ?? (Math.random() > 0.8 ? "Open" : "Closed");
  const inorgLid = options.inorgLid ?? (Math.random() > 0.8 ? "Open" : "Closed");

  const payload = {
    macAddress: MAC_ADDRESS,
    organicFillLevel: organic,
    inorganicFillLevel: inorganic,
    temperature: Number(temp),
    humidity: Number(hum),
    organicLidState: orgLid,
    inorganicLidState: inorgLid,
    lidState: orgLid === "Open" || inorgLid === "Open" ? "Open" : "Closed"
  };

  try {
    const res = await fetch(`${SERVER_URL}/api/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("\n=======================================================");
    console.log("✅ [TELEMETRY] ĐÃ GỬI DỮ LIỆU CẢM BIẾN LÊN SERVER (ONLINE):");
    console.log(`   • Thùng rác: ${MAC_ADDRESS}`);
    console.log(`   • Ngăn 1 · Hữu cơ : ${organic}% (Nắp: ${orgLid === "Open" ? "Mở" : "Đóng"})`);
    console.log(`   • Ngăn 2 · Vô cơ  : ${inorganic}% (Nắp: ${inorgLid === "Open" ? "Mở" : "Đóng"}) ${inorganic >= 80 ? "⚠️ (CẢNH BÁO SẮP ĐẦY)" : ""}`);
    console.log(`   • Nhiệt độ        : ${temp}°C | Độ ẩm: ${hum}%`);
    console.log("👉 Mở app điện thoại mục 'Trang chủ' hoặc 'Thùng rác' để thấy số liệu cập nhật ngay!");
    console.log("=======================================================\n");
    return data;
  } catch (err) {
    console.error("❌ Không kết nối được server tại", SERVER_URL);
    console.error("   Hãy chắc chắn bạn đã chạy: node server/index.js\n");
  }
}

// 2. Giả lập Camera thùng rác chụp được vật thể rác mới
async function sendCameraEvent() {
  const samples = [
    {
      label: "Chai nhựa nước ngọt PET",
      category: "Vô cơ",
      compartment: "Ngăn 2 · Vô cơ",
      confidence: 96,
      instructions: ["Đổ sạch nước bên trong.", "Bóp bẹp thân chai.", "Bỏ vào Ngăn 2 · Vô cơ."],
      method: "Làm sạch, bóp bẹp và bỏ vào Ngăn 2",
      note: "Phát hiện từ camera góc trên nắp thùng EcoBin."
    },
    {
      label: "Vỏ chuối & thức ăn thừa",
      category: "Hữu cơ",
      compartment: "Ngăn 1 · Hữu cơ",
      confidence: 94,
      instructions: ["Tách bỏ túi nilon bên ngoài.", "Chắt ráo nước.", "Bỏ vào Ngăn 1 · Hữu cơ."],
      method: "Để ráo nước và bỏ vào Ngăn 1",
      note: "Phát hiện rác hữu cơ phân hủy sinh học."
    },
    {
      label: "Vỏ lon bia / Nước ngọt",
      category: "Vô cơ",
      compartment: "Ngăn 2 · Vô cơ",
      confidence: 98,
      instructions: ["Đổ sạch cặn ngọt.", "Bóp dẹp vỏ lon.", "Bỏ vào Ngăn 2 · Vô cơ."],
      method: "Đổ sạch và bỏ vào Ngăn 2",
      note: "Nhôm tái chế giá trị cao."
    }
  ];

  const picked = samples[Math.floor(Math.random() * samples.length)];

  // Tạo ảnh JPEG giả lập 1x1 base64
  const sampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEeQHzk4PzrwAAAABJRU5ErkJggg==";

  const payload = {
    macAddress: MAC_ADDRESS,
    eventType: "object-detected",
    detectedLabel: picked.label,
    category: picked.category,
    binCompartment: picked.compartment,
    confidence: picked.confidence,
    instructions: picked.instructions,
    disposalMethod: picked.method,
    note: picked.note,
    imageBase64: sampleBase64,
    mimeType: "image/png"
  };

  try {
    const res = await fetch(`${SERVER_URL}/api/bin-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("\n=======================================================");
    console.log("📸 [CAMERA EVENT] ĐÃ GỬI ẢNH CAMERA THÙNG RÁC LÊN SERVER:");
    console.log(`   • Vật thể phát hiện: ${picked.label}`);
    console.log(`   • Nhóm rác         : ${picked.category}`);
    console.log(`   • Ngăn đề xuất     : ${picked.compartment}`);
    console.log(`   • Độ tin cậy       : ${picked.confidence}%`);
    console.log("👉 Kiểm tra trên app: Tab 'Thông báo' sẽ có tin mới, bấm vào để mở chi tiết & Chat AI!");
    console.log("=======================================================\n");
    return data;
  } catch (err) {
    console.error("❌ Không kết nối được server tại", SERVER_URL);
    console.error("   Hãy chắc chắn bạn đã chạy: node server/index.js\n");
  }
}

// 3. Vòng lặp tự động (chạy mô phỏng liên tục)
async function startAutoLoop() {
  console.log("\n🚀 BẮT ĐẦU CHẾ ĐỘ GIẢ LẬP PHẦN CỨNG TỰ ĐỘNG (Mỗi 6 giây gửi 1 lần)...");
  console.log("Nhấn Ctrl + C để dừng bất cứ lúc nào.\n");

  let step = 0;
  setInterval(async () => {
    step++;
    const organic = 40 + (step * 7) % 55;
    const inorganic = 30 + (step * 9) % 65;
    await sendTelemetry({ organic, inorganic });

    // Cứ 3 lần gửi telemetry thì giả lập 1 lần camera phát hiện rác
    if (step % 3 === 0) {
      await sendCameraEvent();
    }
  }, 6000);
}

// Main execution
const arg = process.argv[2];
if (arg === "--telemetry") {
  sendTelemetry();
} else if (arg === "--event") {
  sendCameraEvent();
} else if (arg === "--loop") {
  startAutoLoop();
} else {
  // Menu hiển thị hướng dẫn
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║         CÔNG CỤ GIẢ LẬP PHẦN CỨNG & CƠ SỞ DỮ LIỆU NHOM4        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("👉 Chọn cách test:");
  console.log("   1. Test cảm biến mức đầy 2 ngăn (Hữu cơ & Vô cơ):");
  console.log("      node tools/simulate_hardware.js --telemetry\n");
  console.log("   2. Test Camera thùng rác phát hiện vật thể (gửi ảnh lên app):");
  console.log("      node tools/simulate_hardware.js --event\n");
  console.log("   3. Chạy giả lập tự động liên tục (xem app cập nhật realtime):");
  console.log("      node tools/simulate_hardware.js --loop\n");

  // Mặc định chạy 1 lần cả telemetry và camera event để kiểm tra ngay!
  (async () => {
    console.log("Đang chạy test kiểm tra ban đầu...");
    await sendTelemetry({ organic: 55, inorganic: 72, temp: 32.5 });
    await sendCameraEvent();
  })();
}
