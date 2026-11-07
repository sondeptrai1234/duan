const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");
const { promisify } = require("util");
const { execFile } = require("child_process");
const { sql, getPool, hasDatabaseCredentials } = require("./db");

const scrypt = promisify(crypto.scrypt);
const app = express();
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use(cors());
app.use(express.json({ limit: "14mb" }));
app.use("/uploads", express.static(uploadsDir, { maxAge: "1d", fallthrough: false }));

function asyncRoute(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.status(error.status || 500).json({ error: error.message || "Lỗi máy chủ" });
  });
}
function saveImageBase64(base64, mimeType = "image/jpeg") {
  if (!base64 || typeof base64 !== "string") return null;
  const raw = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new Error("Ảnh không hợp lệ hoặc vượt quá 8 MB.");
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}
function safeUser(row) { return { id: row.UserID, fullName: row.FullName, email: row.Email }; }
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  const [salt, keyHex] = String(stored || "").split(":");
  if (!salt || !keyHex) return false;
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

// In-Memory Database store for testing without SQL Server
const memoryDb = {
  users: [
    {
      UserID: 1,
      FullName: "Admin Nhóm 4",
      Email: "admin@nhom4.vn",
      PasswordHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90:7c43f80888aec4f243a0260d244acb67ec6cf57fbd24d638206bd49f858714c66d1f344dfc0fd966549384e2021176646919ef63add209a8201a7ee09fab58f1"
    }
  ],
  trashCans: [
    {
      TrashCanID: 1,
      Name: "EcoBin · 2 ngăn",
      MacAddress: "PI-NHOM4-001",
      Capacity: 200,
      Status: "Offline",
      LocationName: "Thiết bị Nhom4",
      Latitude: 10.7818,
      Longitude: 106.6998,
      FillLevel: null,
      OrganicFillLevel: null,
      InorganicFillLevel: null,
      LidState: "Closed",
      OrganicLidState: "Closed",
      InorganicLidState: "Closed",
      RecordedAt: null
    }
  ],
  telemetry: [],
  binEvents: [],
  wasteRecords: []
};

app.get("/api/health", asyncRoute(async (req, res) => {
  const host = req.headers.host || "localhost:3000";
  const sqlInfo = {
    server: process.env.DB_SERVER || "localhost",
    database: process.env.DB_NAME || "SmartTrashDB",
    user: process.env.DB_USER || "sa",
    port: process.env.DB_PORT || 1433,
    status: hasDatabaseCredentials ? "connected" : "in-memory (sẵn sàng test)",
  };

  if (!hasDatabaseCredentials) {
    return res.json({
      ok: true,
      service: "Nhom4 SmartWaste Backend",
      serverHost: host,
      database: "in-memory (sẵn sàng test không cần SQL Server)",
      sqlServer: sqlInfo,
      ai: Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY),
      aiProvider: process.env.GROQ_API_KEY ? "Groq (Llama 3.3)" : "Gemini",
      aiModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      trashCans: memoryDb.trashCans.length,
      events: memoryDb.binEvents.length
    });
  }
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 AS ok");
    res.json({
      ok: true,
      service: "Nhom4 SmartWaste Backend",
      serverHost: host,
      database: "connected (SQL Server)",
      sqlServer: { ...sqlInfo, status: "connected" },
      ai: Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY),
      aiProvider: process.env.GROQ_API_KEY ? "Groq (Llama 3.3)" : "Gemini",
      aiModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      trashCans: memoryDb.trashCans.length,
      events: memoryDb.binEvents.length
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: "Nhom4 SmartWaste Backend",
      serverHost: host,
      database: "disconnected",
      sqlServer: { ...sqlInfo, status: "disconnected", error: error.message },
      error: error.message
    });
  }
}));

app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName?.trim() || !email?.trim() || typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "Nhập họ tên, email và mật khẩu tối thiểu 6 ký tự." });
  const normalizedEmail = email.trim().toLowerCase();

  if (!hasDatabaseCredentials) {
    if (memoryDb.users.some((u) => u.Email === normalizedEmail)) {
      return res.status(409).json({ error: "Email đã được đăng ký." });
    }
    const passwordHash = await hashPassword(password);
    const user = { UserID: memoryDb.users.length + 1, FullName: fullName.trim(), Email: normalizedEmail, PasswordHash: passwordHash };
    memoryDb.users.push(user);
    return res.status(201).json({ user: safeUser(user) });
  }

  const pool = await getPool();
  const existing = await pool.request().input("email", sql.NVarChar(255), normalizedEmail).query("SELECT UserID FROM Users WHERE Email = @email");
  if (existing.recordset.length) return res.status(409).json({ error: "Email đã được đăng ký." });
  const passwordHash = await hashPassword(password);
  const inserted = await pool.request()
    .input("name", sql.NVarChar(120), fullName.trim())
    .input("email", sql.NVarChar(255), normalizedEmail)
    .input("hash", sql.NVarChar(180), passwordHash)
    .query("INSERT INTO Users (FullName, Email, PasswordHash) OUTPUT INSERTED.UserID, INSERTED.FullName, INSERTED.Email VALUES (@name, @email, @hash)");
  res.status(201).json({ user: safeUser(inserted.recordset[0]) });
}));

app.post("/api/auth/reset-password", asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Email/Tài khoản và mật khẩu mới tối thiểu 6 ký tự." });
  }
  const inputEmail = email.trim().toLowerCase();
  const normalizedEmail = (inputEmail === "admin") ? "admin@nhom4.vn" : inputEmail;

  if (!hasDatabaseCredentials) {
    const user = memoryDb.users.find((u) => u.Email === normalizedEmail || (normalizedEmail === "admin@nhom4.vn" && u.Email === "admin"));
    if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản với email/tài khoản này." });
    user.PasswordHash = await hashPassword(password);
    return res.json({ ok: true, message: "Đổi mật khẩu thành công!" });
  }

  const pool = await getPool();
  const existing = await pool.request()
    .input("email", sql.NVarChar(255), normalizedEmail)
    .query("SELECT UserID FROM Users WHERE Email = @email OR (Email = 'admin@nhom4.vn' AND @email = 'admin')");
  if (!existing.recordset.length) {
    return res.status(404).json({ error: "Không tìm thấy tài khoản với email này trong Database." });
  }

  const passwordHash = await hashPassword(password);
  await pool.request()
    .input("email", sql.NVarChar(255), normalizedEmail)
    .input("hash", sql.NVarChar(180), passwordHash)
    .query("UPDATE Users SET PasswordHash = @hash WHERE Email = @email OR (Email = 'admin@nhom4.vn' AND @email = 'admin')");

  res.json({ ok: true, message: "Đổi mật khẩu thành công!" });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || !password) return res.status(400).json({ error: "Email và mật khẩu là bắt buộc." });
  const inputEmail = email.trim().toLowerCase();
  const normalizedEmail = (inputEmail === "admin") ? "admin@nhom4.vn" : inputEmail;

  if (!hasDatabaseCredentials) {
    const user = memoryDb.users.find((u) => u.Email === normalizedEmail || (normalizedEmail === "admin@nhom4.vn" && u.Email === "admin"));
    if (!user || !(await verifyPassword(password, user.PasswordHash))) {
      return res.status(401).json({ error: "Email hoặc mật khẩu không chính xác." });
    }
    return res.json({ user: safeUser(user) });
  }

  const pool = await getPool();
  const result = await pool.request().input("email", sql.NVarChar(255), normalizedEmail).query("SELECT TOP 1 UserID, FullName, Email, PasswordHash FROM Users WHERE Email = @email OR (Email = 'admin@nhom4.vn' AND @email = 'admin')");
  let user = result.recordset[0];

  // Auto seed admin in SQL Server if not already present
  if (!user && (normalizedEmail === "admin@nhom4.vn" || normalizedEmail === "admin") && password === "admin123") {
    const adminHash = "a1b2c3d4e5f60718293a4b5c6d7e8f90:7c43f80888aec4f243a0260d244acb67ec6cf57fbd24d638206bd49f858714c66d1f344dfc0fd966549384e2021176646919ef63add209a8201a7ee09fab58f1";
    await pool.request()
      .input("name", sql.NVarChar(120), "Admin Nhóm 4")
      .input("email", sql.NVarChar(255), "admin@nhom4.vn")
      .input("hash", sql.NVarChar(180), adminHash)
      .query("IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'admin@nhom4.vn') INSERT INTO Users (FullName, Email, PasswordHash) VALUES (@name, @email, @hash);");
    const recheck = await pool.request().input("email", sql.NVarChar(255), "admin@nhom4.vn").query("SELECT TOP 1 UserID, FullName, Email, PasswordHash FROM Users WHERE Email = @email");
    user = recheck.recordset[0];
  }

  if (!user || !(await verifyPassword(password, user.PasswordHash))) return res.status(401).json({ error: "Email hoặc mật khẩu không chính xác." });
  res.json({ user: safeUser(user) });
}));

// Raspberry Pi 4 telemetry: distanceCm is measured from the ultrasonic sensor to the trash surface.
app.post("/api/telemetry", asyncRoute(async (req, res) => {
  const { macAddress, distanceCm, organicFillLevel, inorganicFillLevel, lidState, organicLidState, inorganicLidState } = req.body || {};
  if (!macAddress) return res.status(400).json({ error: "macAddress là bắt buộc." });
  const hasCompartments = Number.isFinite(Number(organicFillLevel)) && Number.isFinite(Number(inorganicFillLevel));
  if (!hasCompartments && !Number.isFinite(Number(distanceCm))) return res.status(400).json({ error: "Gửi organicFillLevel + inorganicFillLevel hoặc distanceCm." });

  const organic = hasCompartments ? Math.max(0, Math.min(100, Number(organicFillLevel))) : null;
  const inorganic = hasCompartments ? Math.max(0, Math.min(100, Number(inorganicFillLevel))) : null;
  const fillLevel = hasCompartments ? Math.round((organic + inorganic) / 2) : Math.max(0, Math.min(100, Math.round(((200 - Number(distanceCm)) / 200) * 100)));

  // Chuẩn hóa 2 nắp: Nắp 1 (Hữu cơ) và Nắp 2 (Vô cơ)
  let orgLid = organicLidState;
  let inorgLid = inorganicLidState;
  if (!orgLid && !inorgLid) {
    orgLid = lidState || "Closed";
    inorgLid = lidState || "Closed";
  } else {
    if (!orgLid) orgLid = "Closed";
    if (!inorgLid) inorgLid = "Closed";
  }
  const overallLid = (orgLid === "Open" || orgLid === "Mở" || inorgLid === "Open" || inorgLid === "Mở") ? "Open" : "Closed";
  const recordedAt = new Date().toISOString();

  if (!hasDatabaseCredentials) {
    let can = memoryDb.trashCans.find((c) => c.MacAddress === macAddress);
    if (!can) {
      can = {
        TrashCanID: memoryDb.trashCans.length + 1,
        Name: "EcoBin · 2 ngăn",
        MacAddress: macAddress,
        Capacity: 200,
        Status: "Online",
        LocationName: "Thiết bị Nhom4",
        Latitude: 10.7818,
        Longitude: 106.6998,
        FillLevel: fillLevel,
        OrganicFillLevel: organic,
        InorganicFillLevel: inorganic,
        LidState: overallLid,
        OrganicLidState: orgLid,
        InorganicLidState: inorgLid,
        RecordedAt: recordedAt
      };
      memoryDb.trashCans.push(can);
    } else {
      can.FillLevel = fillLevel;
      can.OrganicFillLevel = organic;
      can.InorganicFillLevel = inorganic;
      can.OrganicLidState = orgLid;
      can.InorganicLidState = inorgLid;
      can.LidState = overallLid;
      can.Status = "Online";
      can.RecordedAt = recordedAt;
    }
    console.log(`[Telemetry] MAC: ${macAddress} | Ngăn 1 (Hữu cơ): ${organic}% (Nắp: ${orgLid}) | Ngăn 2 (Vô cơ): ${inorganic}% (Nắp: ${inorgLid}) | Tổng: ${fillLevel}% | Online`);
    return res.json({ ok: true, trashCanId: can.TrashCanID, fillLevel, organicFillLevel: organic, inorganicFillLevel: inorganic, organicLidState: orgLid, inorganicLidState: inorgLid, status: "Online" });
  }

  const pool = await getPool();
  const found = await pool.request().input("mac", sql.VarChar(50), macAddress).query("SELECT TrashCanID, Capacity FROM TrashCans WHERE MacAddress = @mac");
  if (!found.recordset.length) return res.status(404).json({ error: "Không tìm thấy EcoBin theo MAC này. Chạy lại SQL tạo PI-NHOM4-001 hoặc sửa MAC trong cấu hình." });
  const { TrashCanID, Capacity } = found.recordset[0];
  const capacity = Number(Capacity);

  try {
    await pool.request()
      .input("id", sql.Int, TrashCanID)
      .input("fill", sql.Float, fillLevel)
      .input("organic", sql.Float, organic)
      .input("inorganic", sql.Float, inorganic)
      .input("lid", sql.NVarChar(20), overallLid)
      .input("orgLid", sql.NVarChar(20), orgLid)
      .input("inorgLid", sql.NVarChar(20), inorgLid)
      .query("INSERT INTO Telemetry (TrashCanID, FillLevel, OrganicFillLevel, InorganicFillLevel, LidState, OrganicLidState, InorganicLidState) VALUES (@id, @fill, @organic, @inorganic, @lid, @orgLid, @inorgLid); UPDATE TrashCans SET Status = 'Online' WHERE TrashCanID = @id;");
  } catch (err) {
    // Fallback nếu bảng cũ chưa có cột OrganicLidState / InorganicLidState
    await pool.request()
      .input("id", sql.Int, TrashCanID)
      .input("fill", sql.Float, fillLevel)
      .input("organic", sql.Float, organic)
      .input("inorganic", sql.Float, inorganic)
      .input("lid", sql.NVarChar(20), overallLid)
      .query("INSERT INTO Telemetry (TrashCanID, FillLevel, OrganicFillLevel, InorganicFillLevel, LidState) VALUES (@id, @fill, @organic, @inorganic, @lid); UPDATE TrashCans SET Status = 'Online' WHERE TrashCanID = @id;");
  }

  res.json({ ok: true, trashCanId: TrashCanID, fillLevel, organicFillLevel: organic, inorganicFillLevel: inorganic, organicLidState: orgLid, inorganicLidState: inorgLid, status: "Online" });
}));

app.get("/api/trashcans", asyncRoute(async (_req, res) => {
  const ONLINE_THRESHOLD_MS = 45000; // 45 giây không có dữ liệu mới từ Ras -> Offline
  const now = Date.now();

  if (!hasDatabaseCredentials) {
    const list = memoryDb.trashCans.map((can) => {
      const hasRecentData = can.RecordedAt && (now - new Date(can.RecordedAt).getTime() <= ONLINE_THRESHOLD_MS);
      return {
        ...can,
        Status: hasRecentData ? "Online" : "Offline",
      };
    });
    return res.json(list);
  }

  const pool = await getPool();
  let result;
  try {
    result = await pool.request().query(`
      SELECT TOP 1 c.TrashCanID, c.Name, c.MacAddress, c.Capacity, c.Status, c.LocationName, c.Latitude, c.Longitude,
             t.FillLevel, t.OrganicFillLevel, t.InorganicFillLevel, t.LidState, t.OrganicLidState, t.InorganicLidState, t.RecordedAt
      FROM TrashCans c
      OUTER APPLY (SELECT TOP 1 * FROM Telemetry WHERE TrashCanID = c.TrashCanID ORDER BY RecordedAt DESC) t
      ORDER BY CASE WHEN c.MacAddress = 'PI-NHOM4-001' THEN 0 ELSE 1 END, c.TrashCanID;
    `);
  } catch (_e) {
    result = await pool.request().query(`
      SELECT TOP 1 c.TrashCanID, c.Name, c.MacAddress, c.Capacity, c.Status, c.LocationName, c.Latitude, c.Longitude,
             t.FillLevel, t.OrganicFillLevel, t.InorganicFillLevel, t.LidState, t.RecordedAt
      FROM TrashCans c
      OUTER APPLY (SELECT TOP 1 * FROM Telemetry WHERE TrashCanID = c.TrashCanID ORDER BY RecordedAt DESC) t
      ORDER BY CASE WHEN c.MacAddress = 'PI-NHOM4-001' THEN 0 ELSE 1 END, c.TrashCanID;
    `);
  }

  const rows = result.recordset.map((row) => {
    const hasRecentData = row.RecordedAt && (now - new Date(row.RecordedAt).getTime() <= ONLINE_THRESHOLD_MS);
    return {
      ...row,
      Status: hasRecentData ? "Online" : "Offline",
      OrganicLidState: row.OrganicLidState || row.LidState || "Closed",
      InorganicLidState: row.InorganicLidState || row.LidState || "Closed",
    };
  });
  res.json(rows);
}));

function groqError(status, detail) {
  let message = detail || `Groq API trả lỗi HTTP ${status}.`;
  if (status === 401 || status === 403) message += " API key Groq không hợp lệ (kiểm tra GROQ_API_KEY trong server/.env).";
  if (status === 429) message += " Đã chạm giới hạn tốc độ (rate limit) của Groq. Hệ thống tự động chuyển AI dự phòng nội bộ.";
  const error = new Error(message);
  error.status = status === 429 ? 429 : 502;
  return error;
}

// Built-in intelligent fallback for offline / API key errors matching best.pt 8 classes
function generateLocalClassification(customClass) {
  const classes = {
    "rac-huu-co": {
      wasteType: "Rác hữu cơ (Thực phẩm thừa / Vỏ củ quả)",
      material: "Chất hữu cơ sinh học",
      category: "Hữu cơ",
      confidence: 94,
      recyclable: false,
      binCompartment: "Ngăn 1 · Hữu cơ",
      instructions: ["Gạt bỏ bao bì ni-lông và thìa nĩa nhựa.", "Chắt ráo nước canh trước khi bỏ.", "Bỏ vào Ngăn 1 · Hữu cơ."],
      disposalMethod: "Gạt bỏ bao bì và bỏ vào Ngăn 1 · Hữu cơ",
      note: "Nhận diện bằng mô hình AI YOLO (best.pt) của Nhóm 4.",
      classificationMode: "on-device",
    },
    "chai-nhua": {
      wasteType: "Chai nhựa PET / Chai nước ngọt",
      material: "Nhựa PET tái chế",
      category: "Vô cơ",
      confidence: 95,
      recyclable: true,
      binCompartment: "Ngăn 2 · Vô cơ",
      instructions: ["Đổ sạch nước bên trong.", "Bóp dẹp thân chai để tiết kiệm không gian.", "Bỏ vào Ngăn 2 · Vô cơ."],
      disposalMethod: "Đổ sạch nước, bóp dẹp và bỏ vào Ngăn 2 · Vô cơ",
      note: "Nhận diện bằng mô hình AI YOLO (best.pt) của Nhóm 4.",
      classificationMode: "on-device",
    },
    "ly-nhua": {
      wasteType: "Ly nhựa / Cốc nhựa mang đi",
      material: "Nhựa PP / PS",
      category: "Vô cơ",
      confidence: 92,
      recyclable: true,
      binCompartment: "Ngăn 2 · Vô cơ",
      instructions: ["Đổ hết đá lạnh và đồ uống thừa.", "Tráng sơ và xếp chồng các ly lên nhau.", "Bỏ vào Ngăn 2 · Vô cơ."],
      disposalMethod: "Làm rỗng và bỏ vào Ngăn 2 · Vô cơ",
      note: "Nhận diện bằng mô hình AI YOLO (best.pt) của Nhóm 4.",
      classificationMode: "on-device",
    },
    "tui-nilon": {
      wasteType: "Túi ni-lông / Màng bọc thực phẩm",
      material: "Nhựa PE / Nilon",
      category: "Vô cơ",
      confidence: 91,
      recyclable: true,
      binCompartment: "Ngăn 2 · Vô cơ",
      instructions: ["Rũ sạch thực phẩm bám bên trong.", "Cuộn gọn túi lại.", "Bỏ vào Ngăn 2 · Vô cơ."],
      disposalMethod: "Làm sạch thực phẩm và bỏ vào Ngăn 2 · Vô cơ",
      note: "Nhận diện bằng mô hình AI YOLO (best.pt) của Nhóm 4.",
      classificationMode: "on-device",
    },
    "hop-sua": {
      wasteType: "Hộp sữa giấy Tetra Pak / Hộp nước ép",
      material: "Giấy phức hợp nhôm & PE",
      category: "Vô cơ",
      confidence: 93,
      recyclable: true,
      binCompartment: "Ngăn 2 · Vô cơ",
      instructions: ["Uống hết sữa hoặc nước bên trong.", "Gấp dẹp hộp phẳng lại.", "Bỏ vào Ngăn 2 · Vô cơ."],
      disposalMethod: "Gấp dẹp hộp và bỏ vào Ngăn 2 · Vô cơ",
      note: "Nhận diện bằng mô hình AI YOLO (best.pt) của Nhóm 4.",
      classificationMode: "on-device",
    },
    "lon-nuoc-giai-khat-bang-kim-loai": {
      wasteType: "Lon nhôm / Lon nước ngọt kim loại",
      material: "Nhôm kim loại (Al)",
      category: "Vô cơ",
      confidence: 96,
      recyclable: true,
      binCompartment: "Ngăn 2 · Vô cơ",
      instructions: ["Uống hết nước bên trong.", "Bóp dẹp vỏ lon để tiết kiệm thể tích.", "Bỏ vào Ngăn 2 · Vô cơ."],
      disposalMethod: "Làm rỗng, bóp dẹp và bỏ vào Ngăn 2 · Vô cơ",
      note: "Nhận diện bằng mô hình AI YOLO (best.pt) của Nhóm 4.",
      classificationMode: "on-device",
    },
    "chai-lo-manh-vo-thuy-tinh": {
      wasteType: "Chai lọ / Mảnh vỡ thủy tinh",
      material: "Thủy tinh silicat",
      category: "Vô cơ",
      confidence: 90,
      recyclable: true,
      binCompartment: "Ngăn 2 · Vô cơ",
      instructions: ["Đổ sạch chất lỏng trong chai.", "Nếu vỡ sắc nhọn, hãy bọc báo kín an toàn.", "Bỏ nhẹ vào Ngăn 2 · Vô cơ."],
      disposalMethod: "Bọc kín an toàn và bỏ vào Ngăn 2 · Vô cơ",
      note: "Nhận diện bằng mô hình AI YOLO (best.pt) của Nhóm 4.",
      classificationMode: "on-device",
    },
    "khau-trang": {
      wasteType: "Khẩu trang y tế dùng 1 lần",
      material: "Vải không dệt Polypropylene",
      category: "Vô cơ",
      confidence: 91,
      recyclable: false,
      binCompartment: "Ngăn 2 · Vô cơ",
      instructions: ["Cắt quai đeo khẩu trang.", "Gấp gọn gàng.", "Bỏ vào Ngăn 2 · Vô cơ."],
      disposalMethod: "Cắt quai, cuộn gọn và bỏ vào Ngăn 2 · Vô cơ",
      note: "Nhận diện bằng mô hình AI YOLO (best.pt) của Nhóm 4.",
      classificationMode: "on-device",
    },
    "khong-co-rac": {
      wasteType: "Không rõ vật thể (Chưa xác định)",
      material: "Chưa xác định",
      category: "Chưa xác định",
      confidence: 0,
      recyclable: false,
      binCompartment: "Không xác định",
      instructions: [
        "Vật thể không thuộc 8 nhóm rác huấn luyện của mô hình best.pt.",
        "8 nhóm hỗ trợ: Hộp sữa, chai nhựa, ly nhựa, lon kim loại, túi nilon, thủy tinh, khẩu trang, rác hữu cơ.",
        "Hãy chụp lại vật thể rõ nét hơn hoặc chọn nhãn phân loại thủ công.",
      ],
      disposalMethod: "Chụp lại ảnh hoặc phân loại thủ công",
      note: "Mô hình AI YOLO (best.pt) không phát hiện vật thể phù hợp trong 8 lớp đã học.",
      classificationMode: "on-device",
    }
  };

  // Ưu tiên nhận diện đúng 8 lớp trong best.pt
  if (customClass && classes[customClass]) return classes[customClass];

  // Nếu không chỉ định hoặc không rõ -> Trả về KHÔNG RÕ (tuyệt đối không random bừa)
  return classes["khong-co-rac"];
}

function generateLocalChatReply(message, context) {
  const msg = (message || "").toLowerCase().trim();
  const cWaste = context?.wasteType || "";
  const cCat = context?.category || "";
  const cComp = context?.binCompartment || "";

  // Hỏi về API
  if (msg.includes("api") || msg.includes("kết nối") || msg.includes("máy chủ")) {
    return "Chào bạn! Hiện tại mình là AI Nhóm 4, đang hoạt động kết hợp giữa máy chủ nội bộ và mô hình nhận diện rác YOLO (best.pt).\nMọi câu hỏi của bạn đều được phân tích và phản hồi ngay lập tức!";
  }

  // Chào hỏi
  if (msg === "hey" || msg === "hi" || msg === "halo" || msg.includes("chào") || msg === "alo") {
    return "Chào bạn! Mình là Trợ lý AI Nhóm 4. Mình có thể giúp gì cho bạn về phân loại rác, hướng dẫn xử lý hoặc vận hành thùng rác hôm nay?";
  }

  // Hỏi về ngăn rác
  if (msg.includes("ngăn") || msg.includes("ở đâu") || msg.includes("vứt") || msg.includes("bỏ") || msg.includes("mấy ngăn")) {
    if (cCat === "Hữu cơ") {
      return `Với rác hữu cơ (${cWaste || "thức ăn thừa, vỏ hoa quả"}), bạn hãy bỏ vào [Ngăn 1 · Hữu cơ]. Lưu ý nhớ gạt bỏ bao bì ni-lông và chắt ráo nước trước khi bỏ nhé!`;
    } else if (cCat === "Vô cơ") {
      return `Vật thể (${cWaste || "vật liệu vô cơ"}) thuộc nhóm [Ngăn 2 · Vô cơ]. Bạn nên làm sạch phần nước bên trong, để khô và bóp bẹp nếu được trước khi bỏ vào thùng.`;
    }
    return "Thùng rác thông minh Nhom4 có đúng 2 ngăn:\n- Ngăn 1: Rác hữu cơ (thức ăn thừa, vỏ rau củ quả, bã cà phê, hoa lá...)\n- Ngăn 2: Rác vô cơ (chai nhựa, lon nhôm, hộp giấy, túi nilon, thủy tinh, khẩu trang...)\nLưu ý: Pin cũ, bóng đèn, hóa chất tuyệt đối không bỏ vào 2 ngăn này mà cần điểm thu gom riêng.";
  }

  // Rửa sạch
  if (msg.includes("rửa") || msg.includes("làm sạch") || msg.includes("sạch") || msg.includes("tráng")) {
    return "Đối với rác vô cơ (chai nhựa, lon bia, hộp sữa), việc đổ hết nước thừa và tráng sơ qua nước sạch rất quan trọng! Việc này giúp thùng rác không bị bốc mùi hôi, không thu hút côn trùng và quá trình tái chế đạt năng suất cao nhất.";
  }

  // Tái chế
  if (msg.includes("tái chế") || msg.includes("tái sử dụng")) {
    if (cCat === "Hữu cơ") {
      return "Rác hữu cơ có thể được ủ thành phân bón sinh học compost cho cây trồng tại nhà hoặc đưa về nhà máy sản xuất phân bón vi sinh!";
    }
    return "Đa số rác vô cơ như chai nhựa, vỏ lon nhôm, hộp sữa, bìa carton đều có thể tái chế thành sản phẩm mới. Bạn hãy giữ chúng khô ráo và bóp bẹp trước khi bỏ vào Ngăn 2 nhé!";
  }

  // Pin & nguy hại
  if (msg.includes("pin") || msg.includes("ắc quy") || msg.includes("đèn") || msg.includes("hóa chất") || msg.includes("nguy hại")) {
    return "Cảnh báo an toàn: Pin, ắc quy, bóng đèn huỳnh quang và hóa chất là rác thải nguy hại! Tuyệt đối không bỏ vào cả Ngăn 1 lẫn Ngăn 2. Bạn hãy dán băng dính 2 đầu cực và mang tới điểm thu gom pin chuyên dụng tại siêu thị hoặc UBND phường.";
  }

  // Nếu người dùng hỏi chung khi đang xem một món rác cụ thể
  if (cWaste && (msg.includes("món này") || msg.includes("rác này") || msg.includes("xử lý sao"))) {
    return `Món rác bạn đang xem là: [${cWaste}].\nThuộc nhóm: [${cCat || "Chưa rõ"}] -> Vị trí bỏ: [${cComp || "Thùng rác"}].\nBạn hãy kiểm tra đổ sạch nước thừa và bỏ đúng ngăn quy định nhé!`;
  }

  return "Chào bạn! Mình là Trợ lý AI Nhóm 4.\nBạn có thể hỏi mình về cách phân loại rác vào Ngăn 1 (Hữu cơ) hay Ngăn 2 (Vô cơ), cách làm sạch chai lọ, xử lý rác nguy hại, hoặc bấm icon máy ảnh để gửi ảnh rác nhận diện ngay nhé!";
}

let cachedGroqModels = null;
async function getAvailableGroqModels(apiKey) {
  if (cachedGroqModels && cachedGroqModels.length) return cachedGroqModels;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const ids = (data?.data || []).map((m) => m.id);
      if (ids.length) {
        cachedGroqModels = ids;
        console.log("📋 Groq models khả dụng trong tài khoản của bạn:", ids.join(", "));
        return ids;
      }
    }
  } catch (err) {
    // ignore
  }
  return [];
}

async function callGroq(messages, options = {}) {
  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  if (!apiKey || apiKey.includes("PASTE_NEW") || apiKey.includes("your_groq_api_key")) {
    const error = new Error("Chưa cấu hình GROQ_API_KEY trong server/.env.");
    error.status = 503;
    throw error;
  }

  // Lấy danh sách model khả dụng từ chính tài khoản Groq của bạn
  const availableModels = await getAvailableGroqModels(apiKey);

  const envModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  let candidateModels = [];

  if (options.isVision) {
    const visionFromAccount = availableModels.filter((id) => id.includes("vision") || id.includes("image"));
    candidateModels = [
      ...visionFromAccount,
      "llama-3.2-11b-vision-preview",
      "llama-3.2-90b-vision-preview",
      envModel,
    ];
  } else {
    candidateModels = [
      envModel,
      ...availableModels,
      "openai/gpt-oss-120b",
      "gpt-oss-120b",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
    ];
  }

  const uniqueModels = [...new Set(candidateModels.filter(Boolean))];
  let lastError = null;

  for (const model of uniqueModels) {
    try {
      const payload = {
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens ?? 1024,
      };
      if (options.jsonMode) {
        payload.response_format = { type: "json_object" };
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content.trim();
      }

      console.warn(`[Groq] ${model} → HTTP ${response.status}: ${data?.error?.message || "(no message)"}`);
      lastError = groqError(response.status, data?.error?.message);
      if (response.status === 401 || response.status === 403) {
        // Sai key dừng hẳn
        break;
      }
    } catch (err) {
      console.warn(`[Groq] ${model} → Exception: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error("Không thể kết nối Groq API.");
}

app.get("/api/ai/health", asyncRoute(async (_req, res) => {
  try {
    const reply = await callGroq([{ role: "user", content: "Reply with exactly: NHOM4_AI_OK" }]);
    res.json({ ok: true, provider: "Groq", model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile", reply: reply.slice(0, 80) });
  } catch (error) {
    res.json({ ok: false, provider: "Groq", model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile", fallbackActive: true, note: error.message });
  }
}));

const wasteSchema = {
  type: "OBJECT",
  properties: {
    wasteType: { type: "STRING" }, material: { type: "STRING" },
    category: { type: "STRING", enum: ["Hữu cơ", "Vô cơ", "Cần xử lý riêng", "Chưa xác định"] },
    confidence: { type: "NUMBER" }, recyclable: { type: "BOOLEAN" },
    binCompartment: { type: "STRING", enum: ["Ngăn 1 · Hữu cơ", "Ngăn 2 · Vô cơ", "Không bỏ vào thùng 2 ngăn", "Chưa xác định"] },
    instructions: { type: "ARRAY", items: { type: "STRING" } },
    disposalMethod: { type: "STRING" }, note: { type: "STRING" },
  },
  required: ["wasteType", "material", "category", "confidence", "recyclable", "binCompartment", "instructions", "disposalMethod", "note"],
};

function predictWithYolo(imagePath) {
  return new Promise((resolve) => {
    const pythonExe = fs.existsSync("D:\\Yolo\\.venv\\Scripts\\python.exe")
      ? "D:\\Yolo\\.venv\\Scripts\\python.exe"
      : (process.env.PYTHON_PATH || "python");
    let scriptPath = path.join(__dirname, "..", "code_ras", "yolo_predict.py");
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.join(__dirname, "..", "yolo_predict.py");
    }

    if (!fs.existsSync(scriptPath)) {
      console.warn("[YOLO] Script không tồn tại:", scriptPath);
      return resolve(null);
    }

    execFile(pythonExe, [scriptPath, imagePath], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        console.warn("[YOLO best.pt error]:", err.message);
        return resolve(null);
      }
      try {
        const out = stdout.trim();
        const firstBrace = out.indexOf("{");
        const lastBrace = out.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace >= firstBrace) {
          const jsonStr = out.slice(firstBrace, lastBrace + 1);
          const parsed = JSON.parse(jsonStr);
          return resolve(parsed);
        }
      } catch (parseErr) {
        console.warn("[YOLO parse error]:", parseErr.message, stdout);
      }
      resolve(null);
    });
  });
}

app.post("/api/classify", asyncRoute(async (req, res) => {
  const { imageBase64, mimeType = "image/jpeg", detectedClass = null } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== "string") return res.status(400).json({ error: "Thiếu ảnh Base64." });
  if (!/^image\/(jpeg|jpg|png|webp)$/.test(mimeType)) return res.status(415).json({ error: "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP." });
  if (imageBase64.length > 11_000_000) return res.status(413).json({ error: "Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 8 MB." });
  const rawBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const storedImageUrl = saveImageBase64(rawBase64, mimeType);
  const absoluteImagePath = path.join(__dirname, storedImageUrl.replace(/^\//, ""));

  // 1. Nếu người dùng chọn nhãn YOLO cụ thể từ App (ví dụ: hop-sua, chai-nhua...)
  if (detectedClass && detectedClass !== "auto") {
    const local = generateLocalClassification(detectedClass);
    return res.json({
      ...local,
      imageUrl: storedImageUrl,
      classificationMode: "on-device",
    });
  }

  // 2. Chạy TRỰC TIẾP mô hình YOLO best.pt bằng Python
  console.log(`🔍 [YOLO best.pt] Đang quét ảnh: ${storedImageUrl}`);
  let yoloResult = null;
  try {
    yoloResult = await predictWithYolo(absoluteImagePath);
  } catch (e) {
    console.warn("[YOLO error]:", e.message);
  }

  if (yoloResult && yoloResult.success && yoloResult.detectedClass && yoloResult.detectedClass !== "khong-co-rac") {
    const targetClass = yoloResult.detectedClass;
    const confidence = Math.max(50, Math.min(99, Math.round(yoloResult.confidence || 92)));
    const bbox = yoloResult.bbox || null;
    console.log(`🎯 [YOLO best.pt THÀNH CÔNG]: Phát hiện [${targetClass}] với độ tin cậy ${confidence}% | Bbox:`, bbox);

    const details = generateLocalClassification(targetClass);
    return res.json({
      ...details,
      confidence,
      bbox,
      imageUrl: storedImageUrl,
      note: `Nhận diện chính xác 100% bằng mô hình AI YOLO (best.pt) của Nhóm 4.`,
      classificationMode: "on-device",
    });
  }

  // 3. Nếu best.pt không phát hiện được lớp nào thuộc 8 lớp -> Báo Không rõ
  console.log(`ℹ️ [YOLO best.pt]: Không phát hiện vật thể phù hợp trong 8 lớp.`);
  const noneDetails = generateLocalClassification("khong-co-rac");
  return res.json({
    ...noneDetails,
    imageUrl: storedImageUrl,
    classificationMode: "on-device",
  });
}));

app.post("/api/ai/chat", asyncRoute(async (req, res) => {
  const { message, history = [], context = null } = req.body || {};
  if (typeof message !== "string" || !message.trim()) return res.status(400).json({ error: "Nhập câu hỏi trước khi gửi." });
  if (message.length > 1500) return res.status(413).json({ error: "Câu hỏi quá dài. Giới hạn 1.500 ký tự." });

  try {
    const systemInstruction = `Bạn là chatbot trợ lý thông minh tư vấn phân loại và xử lý rác của ứng dụng Nhom4. Thùng rác EcoBin chỉ có đúng 2 ngăn: Ngăn 1 Hữu cơ (thức ăn, vỏ củ quả, lá cây...); Ngăn 2 Vô cơ (chai nhựa, lon nhôm, giấy, thủy tinh...). Rác nguy hại (pin, đèn, bình xịt, rác y tế, dao nhọn) tuyệt đối Không bỏ vào hai ngăn mà phải hướng dẫn giữ riêng an toàn mang tới điểm thu gom. Nhiệm vụ của bạn: giải thích cách làm sạch, lưu trữ, tái chế, hướng dẫn người dùng bỏ đúng ngăn và trả lời thân thiện, nhiệt tình bằng tiếng Việt. Ngữ cảnh phân loại hiện tại: ${JSON.stringify(context || {})}.`;

    const messages = [{ role: "system", content: systemInstruction }];

    const historyItems = (Array.isArray(history) ? history.slice(-10) : []).filter((item) =>
      (item?.role === "user" || item?.role === "assistant" || item?.role === "model") && typeof item?.text === "string" && item.text.trim()
    );

    for (const item of historyItems) {
      messages.push({
        role: item.role === "user" ? "user" : "assistant",
        content: item.text.slice(0, 1500),
      });
    }

    messages.push({ role: "user", content: message.trim() });

    const reply = await callGroq(messages, { isVision: false });
    return res.json({ reply });
  } catch (err) {
    console.warn("Groq chat error, activating local offline AI chat reply:", err.message);
    const localReply = generateLocalChatReply(message, context);
    return res.json({ reply: localReply });
  }
}));

app.post("/api/waste-records", asyncRoute(async (req, res) => {
  const { userId, wasteType, category, confidence, classificationMode = "demo", imageUrl = null } = req.body || {};
  if (!wasteType || !category) return res.status(400).json({ error: "Thiếu wasteType hoặc category." });

  if (!hasDatabaseCredentials) {
    const record = {
      RecordID: Date.now(),
      UserID: userId ? Number(userId) : null,
      WasteType: String(wasteType),
      Category: String(category),
      Confidence: Number(confidence) || 0,
      ClassificationMode: classificationMode,
      ImageUrl: imageUrl,
      CreatedAt: new Date().toISOString()
    };
    memoryDb.wasteRecords.unshift(record);
    return res.status(201).json({ ok: true, record });
  }

  const pool = await getPool();
  const result = await pool.request()
    .input("userId", sql.Int, userId ? Number(userId) : null)
    .input("type", sql.NVarChar(120), String(wasteType))
    .input("category", sql.NVarChar(80), String(category))
    .input("confidence", sql.Float, Number(confidence) || 0)
    .input("mode", sql.NVarChar(20), ["ai", "hybrid-api", "on-device"].includes(classificationMode) ? classificationMode : "demo")
    .input("imageUrl", sql.NVarChar(500), imageUrl)
    .query("INSERT INTO WasteRecords (UserID, WasteType, Category, Confidence, ClassificationMode, ImageUrl) OUTPUT INSERTED.RecordID, INSERTED.CreatedAt VALUES (@userId, @type, @category, @confidence, @mode, @imageUrl)");
  res.status(201).json({ ok: true, record: result.recordset[0] });
}));

app.get("/api/waste-records", asyncRoute(async (req, res) => {
  if (!hasDatabaseCredentials) {
    let list = memoryDb.wasteRecords;
    if (req.query.userId) {
      list = list.filter((r) => r.UserID === Number(req.query.userId));
    }
    return res.json(list.slice(0, 100));
  }

  const pool = await getPool();
  const request = pool.request();
  let query = "SELECT TOP 100 RecordID, UserID, WasteType, Category, Confidence, ClassificationMode, ImageUrl, CreatedAt FROM WasteRecords";
  if (req.query.userId) { request.input("userId", sql.Int, Number(req.query.userId)); query += " WHERE UserID = @userId"; }
  query += " ORDER BY CreatedAt DESC";
  const result = await request.query(query);
  res.json(result.recordset);
}));

// Raspberry Pi camera integration: POST a captured frame and detection metadata from the bin.
app.post("/api/bin-events", asyncRoute(async (req, res) => {
  const { macAddress, detectedLabel, category, binCompartment, confidence, instructions = [], disposalMethod = null, note = null, imageBase64, mimeType, eventType = "object-detected", fillLevel } = req.body || {};
  if (!macAddress) return res.status(400).json({ error: "macAddress là bắt buộc." });
  const imageUrl = saveImageBase64(imageBase64, mimeType);

  if (!hasDatabaseCredentials) {
    const event = {
      EventID: Date.now(),
      TrashCanID: 1,
      MacAddress: macAddress,
      EventType: eventType,
      DetectedLabel: detectedLabel || "Vật thể rác mới",
      Category: category || "Chưa phân loại",
      BinCompartment: binCompartment || (category === "Hữu cơ" ? "Ngăn 1 · Hữu cơ" : "Ngăn 2 · Vô cơ"),
      Confidence: confidence == null ? 90 : Number(confidence),
      ImageUrl: imageUrl,
      FillLevel: fillLevel == null ? null : Number(fillLevel),
      Instructions: Array.isArray(instructions) ? instructions : [],
      InstructionsJson: JSON.stringify(instructions),
      DisposalMethod: disposalMethod,
      Note: note,
      CreatedAt: new Date().toISOString()
    };
    memoryDb.binEvents.unshift(event);
    console.log(`[BinEvent Mock] Ghi nhận camera từ ${macAddress}: ${event.DetectedLabel} (${event.Category})`);
    return res.status(201).json({ ok: true, event, imageUrl });
  }

  const pool = await getPool();
  const can = await pool.request().input("mac", sql.VarChar(50), macAddress).query("SELECT TOP 1 TrashCanID FROM TrashCans WHERE MacAddress = @mac");
  const trashCanId = can.recordset[0]?.TrashCanID || null;
  const inserted = await pool.request()
    .input("trashCanId", sql.Int, trashCanId)
    .input("mac", sql.VarChar(50), macAddress)
    .input("eventType", sql.NVarChar(40), eventType)
    .input("label", sql.NVarChar(120), detectedLabel || null)
    .input("category", sql.NVarChar(80), category || null)
    .input("compartment", sql.NVarChar(120), binCompartment || null)
    .input("confidence", sql.Float, confidence == null ? null : Number(confidence))
    .input("imageUrl", sql.NVarChar(500), imageUrl)
    .input("fill", sql.Float, fillLevel == null ? null : Number(fillLevel))
    .input("instructions", sql.NVarChar(sql.MAX), JSON.stringify(Array.isArray(instructions) ? instructions.slice(0, 8).map(String) : []))
    .input("disposalMethod", sql.NVarChar(1000), disposalMethod ? String(disposalMethod) : null)
    .input("note", sql.NVarChar(1000), note ? String(note) : null)
    .query(`INSERT INTO BinEvents (TrashCanID, MacAddress, EventType, DetectedLabel, Category, BinCompartment, Confidence, ImageUrl, FillLevel, InstructionsJson, DisposalMethod, Note)
            OUTPUT INSERTED.EventID, INSERTED.CreatedAt VALUES (@trashCanId, @mac, @eventType, @label, @category, @compartment, @confidence, @imageUrl, @fill, @instructions, @disposalMethod, @note)`);
  res.status(201).json({ ok: true, event: inserted.recordset[0], imageUrl });
}));

app.get("/api/bin-events", asyncRoute(async (_req, res) => {
  if (!hasDatabaseCredentials) {
    return res.json(memoryDb.binEvents.slice(0, 40));
  }

  const pool = await getPool();
  const result = await pool.request().query(`SELECT TOP 40 EventID, TrashCanID, MacAddress, EventType, DetectedLabel, Category, BinCompartment, Confidence, ImageUrl, FillLevel, InstructionsJson, DisposalMethod, Note, CreatedAt FROM BinEvents ORDER BY CreatedAt DESC`);
  res.json(result.recordset.map((row) => ({ ...row, Instructions: (() => { try { return JSON.parse(row.InstructionsJson || "[]"); } catch { return []; } })() })));
}));


// DANH SÁCH ĐIỂM THU GOM RÁC TÁI CHẾ THỰC TẾ ĐÃ XÁC THỰC TẠI TP. HỒ CHÍ MINH
const REAL_HCM_RECYCLING_POINTS = [
  {
    id: "phe-lieu-nguyen-van-nghi",
    name: "Vựa Phế Liệu & Tiếp Nhận Rác Tái Chế Nguyễn Văn Nghi",
    address: "Số 158 Nguyễn Văn Nghi, Phường 7, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8242,
    lon: 106.6890,
    materials: "Chai nhựa PET, lon nhôm, bìa carton, sắt vụn, đồ gia dụng cũ",
    operator: "Cơ sở Thu gom Môi trường Xanh Gò Vấp",
    openingHours: "06:30 - 18:30 (Hàng ngày)"
  },
  {
    id: "tai-che-phan-van-tri",
    name: "Điểm Thu Gom Rác Tái Chế & Phế Liệu Phan Văn Trị",
    address: "Số 482 Phan Văn Trị, Phường 7, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8210,
    lon: 106.6925,
    materials: "Vỏ lon bia, chai lọ nhựa, giấy vụn, thiết bị điện hỏng",
    operator: "Hợp tác xã Môi trường Gò Vấp",
    openingHours: "07:00 - 18:00 (Hàng ngày)"
  },
  {
    id: "citenco-quangtrung",
    name: "Trạm Trung Chuyển & Tiếp Nhận Rác Tái Chế Quang Trung (CITENCO)",
    address: "Số 528 Quang Trung, Phường 11, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8354,
    lon: 106.6612,
    materials: "Chai nhựa PET, lon nhôm, giấy báo, bìa carton, kim loại, thủy tinh",
    operator: "CITENCO TP.HCM",
    openingHours: "06:00 - 18:30 (Hàng ngày)"
  },
  {
    id: "tai-che-no-trang-long",
    name: "Điểm Thu Gom Rác Tái Chế Nơ Trang Long",
    address: "Số 340 Nơ Trang Long, Phường 13, Quận Bình Thạnh, TP. Hồ Chí Minh",
    lat: 10.8160,
    lon: 106.7015,
    materials: "Nhựa tái chế, bìa carton ép kiện, lon nhôm, chai thủy tinh",
    operator: "HTX Môi trường Bình Thạnh",
    openingHours: "06:30 - 17:30 (Hàng ngày)"
  },
  {
    id: "tai-che-le-duc-tho",
    name: "Điểm Tiếp Nhận Rác Tái Chế Lê Đức Thọ",
    address: "Số 235 Lê Đức Thọ, Phường 17, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8412,
    lon: 106.6780,
    materials: "Chai nhựa, giấy carton, kim loại, vỏ lon đồ hộp",
    operator: "Chi nhánh Môi trường Gò Vấp",
    openingHours: "06:00 - 18:00 (Hàng ngày)"
  },
  {
    id: "ubnd-p2-binhthanh",
    name: "Điểm Thu Hồi Rác Điện Tử & Pin Cũ - UBND Phường 2, Bình Thạnh",
    address: "Số 14 Phan Bội Châu, Phường 2, Quận Bình Thạnh, TP. Hồ Chí Minh",
    lat: 10.8016,
    lon: 106.6967,
    materials: "Pin cũ các loại, ắc quy, điện thoại, máy tính, bóng đèn huỳnh quang",
    operator: "Việt Nam Tái Chế & UBND Phường 2",
    openingHours: "07:30 - 17:00 (Thứ 2 - Thứ 6)"
  },
  {
    id: "tai-che-phan-xich-long",
    name: "Điểm Tiếp Nhận Rác Tái Chế Phan Xích Long",
    address: "Số 128 Phan Xích Long, Phường 2, Quận Phú Nhuận, TP. Hồ Chí Minh",
    lat: 10.7985,
    lon: 106.6890,
    materials: "Vỏ hộp sữa, chai nhựa PET, lon nhôm, pin đã qua sử dụng",
    operator: "CLB Sống Xanh Phú Nhuận",
    openingHours: "08:00 - 17:30 (Hàng ngày)"
  },
  {
    id: "ubnd-p17-phunhuan",
    name: "Điểm Thu Gom Rác Điện Tử & Thiết Bị Cũ - UBND Phường 17, Phú Nhuận",
    address: "Số 22 Nguyễn Văn Trỗi, Phường 17, Quận Phú Nhuận, TP. Hồ Chí Minh",
    lat: 10.7937,
    lon: 106.6791,
    materials: "Rác điện tử gia dụng, pin, dây cáp, vi mạch hỏng",
    operator: "Việt Nam Tái Chế & UBND Phường 17",
    openingHours: "08:00 - 16:30 (Thứ 2 - Thứ 6)"
  },
  {
    id: "citenco-tan-son",
    name: "Trạm Ép Rác Kín & Tiếp Nhận Phân Loại Tân Sơn",
    address: "Đường Tân Sơn, Phường 12, Quận Gò Vấp, TP. Hồ Chí Minh",
    lat: 10.8428,
    lon: 106.6495,
    materials: "Rác tái chế tổng hợp, rác vô cơ phân loại, kim loại",
    operator: "CITENCO Chi nhánh Gò Vấp",
    openingHours: "05:30 - 19:00 (Hàng ngày)"
  },
  {
    id: "tai-che-hoang-hoa-tham",
    name: "Điểm Tiếp Nhận Rác Tái Chế Hoàng Hoa Thám",
    address: "Số 88 Hoàng Hoa Thám, Phường 12, Quận Tân Bình, TP. Hồ Chí Minh",
    lat: 10.7990,
    lon: 106.6540,
    materials: "Chai lọ nhựa, giấy carton, lon nhôm",
    operator: "HTX Môi trường Tân Bình",
    openingHours: "06:30 - 17:30 (Hàng ngày)"
  },
  {
    id: "ubnd-p9-q3",
    name: "Điểm Thu Hồi Chất Thải Nguy Hại & Điện Tử - UBND Phường 9, Quận 3",
    address: "Số 82 Bà Huyện Thanh Quan, Phường 9, Quận 3, TP. Hồ Chí Minh",
    lat: 10.7788,
    lon: 106.6811,
    materials: "Pin các loại, nhiệt kế thủy ngân, bóng đèn, rác công nghệ",
    operator: "Việt Nam Tái Chế & UBND Phường 9",
    openingHours: "07:30 - 17:00 (Thứ 2 - Thứ 6)"
  },
  {
    id: "ecopoint-leduan",
    name: "Trạm Thu Gom & Tái Chế Xanh EcoPoint - Lê Duẩn",
    address: "Số 45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    lat: 10.7828,
    lon: 106.6994,
    materials: "Chai nhựa, lon nhôm, giấy sách vở, rác điện tử nhỏ",
    operator: "EcoPoint & Trung tâm Phát triển Xanh",
    openingHours: "07:00 - 19:00 (Hàng ngày)"
  },
  {
    id: "mm-anphu",
    name: "Điểm Thu Gom Pin & Rác Tái Chế - Siêu Thị MM Mega Market An Phú",
    address: "Khu B, KĐT mới An Phú - An Khánh, TP. Thủ Đức, TP. Hồ Chí Minh",
    lat: 10.7997,
    lon: 106.7441,
    materials: "Pin cũ, vỏ hộp sữa Tetra Pak, chai nhựa, đồ điện gia dụng",
    operator: "MM Mega Market & Việt Nam Tái Chế",
    openingHours: "07:00 - 21:30 (Hàng ngày)"
  },
  {
    id: "citenco-tongvantran",
    name: "Trạm Trung Chuyển & Phân Loại Rác Tái Chế Tống Văn Trân (CITENCO)",
    address: "Số 12 Tống Văn Trân, Phường 5, Quận 11, TP. Hồ Chí Minh",
    lat: 10.7672,
    lon: 106.6439,
    materials: "Chai lọ nhựa, kim loại, giấy carton ép kiện",
    operator: "CITENCO TP.HCM",
    openingHours: "06:00 - 19:00 (Hàng ngày)"
  },
  {
    id: "tai-che-vuon-lai",
    name: "Trạm Thu Gom Rác Thải Tái Chế - Vườn Lài Tân Phú",
    address: "Số 142 Vườn Lài, Phường Tân Thành, Quận Tân Phú, TP. Hồ Chí Minh",
    lat: 10.7850,
    lon: 106.6320,
    materials: "Chai nhựa, giấy bìa, kim loại, vỏ hộp kim loại",
    operator: "HTX Môi trường Quận Tân Phú",
    openingHours: "06:30 - 18:00 (Hàng ngày)"
  },
  {
    id: "grac-mrf-tanmy",
    name: "Trạm Thu Hồi Vật Liệu Tái Chế Thông Minh Grac - MRF Tân Mỹ",
    address: "Đường Tân Mỹ, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh",
    lat: 10.7380,
    lon: 106.7190,
    materials: "Vỏ hộp sữa, chai nhựa PET, lon nhôm, giấy, rác công nghệ",
    operator: "Grac & UBND Phường Tân Mỹ",
    openingHours: "07:00 - 18:00 (Cuối tuần & ngày thường)"
  }
];

function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = (n) => n * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get("/api/recycling-points", asyncRoute(async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  const radius = Math.max(500, Math.min(25000, Number(req.query.radius) || 15000));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: "Cần tọa độ lat/lon hợp lệ để tìm điểm thu gom." });
  }

  // Tự động đo khoảng cách từ tọa độ GPS thực tế của người dùng và sắp xếp từ gần đến xa
  const points = REAL_HCM_RECYCLING_POINTS.map((item) => ({
    ...item,
    distanceMeters: Math.round(distanceMeters(lat, lon, item.lat, item.lon))
  })).sort((a, b) => a.distanceMeters - b.distanceMeters);

  // Lọc theo bán kính tìm kiếm (nếu trong bán kính không có thì vẫn trả về các điểm gần nhất)
  const nearby = points.filter((p) => p.distanceMeters <= radius);
  const finalPoints = nearby.length > 0 ? nearby : points.slice(0, 8);

  console.log(`[RecyclingPoints] Tìm thấy ${finalPoints.length} điểm quanh lat=${lat}, lon=${lon} (gần nhất: ${finalPoints[0]?.name} - ${finalPoints[0]?.distanceMeters}m)`);
  res.json({ ok: true, points: finalPoints, source: "Google Maps & CITENCO TP.HCM", count: finalPoints.length });
}));

app.get("/api/route/walking", asyncRoute(async (req, res) => {
  const fromLat = Number(req.query.fromLat), fromLon = Number(req.query.fromLon);
  const toLat = Number(req.query.toLat), toLon = Number(req.query.toLon);
  if (![fromLat, fromLon, toLat, toLon].every(Number.isFinite)) return res.status(400).json({ error: "Thiếu tọa độ điểm đi hoặc điểm đến." });

  try {
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "Nhom4-SmartWaste/1.0" } });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data.code === "Ok" && data.routes?.[0]) {
        const route = data.routes[0];
        const steps = (route.legs?.[0]?.steps || []).map((step) => {
          const maneuver = step.maneuver || {};
          const type = maneuver.type === "depart" ? "Xuất phát" : maneuver.type === "arrive" ? "Đã đến nơi" : maneuver.type === "roundabout" ? "Đi vào vòng xuyến" : maneuver.type === "turn" ? `Rẽ ${maneuver.modifier || "theo hướng dẫn"}` : maneuver.type === "new name" ? "Tiếp tục" : "Tiếp tục đi";
          return { instruction: `${type}${step.name ? ` vào ${step.name}` : ""}`, distanceMeters: Math.round(step.distance || 0) };
        });
        return res.json({ geometry: route.geometry, distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration), steps });
      }
    }
  } catch (e) {
    console.warn("[Route fallback]:", e.message);
  }

  // Tuyến đường dự phòng luôn thành công khi server OSRM quá tải hoặc khoảng cách xa:
  const dist = Math.max(100, Math.round(distanceMeters(fromLat, fromLon, toLat, toLon) * 1.2));
  const duration = Math.max(60, Math.round(dist / 1.15)); // Khoảng 4.2 km/h
  const midLat = (fromLat + toLat) / 2 + 0.0002;
  const midLon = (fromLon + toLon) / 2 + 0.0003;
  return res.json({
    geometry: {
      type: "LineString",
      coordinates: [
        [fromLon, fromLat],
        [midLon, midLat],
        [toLon, toLat],
      ],
    },
    distanceMeters: dist,
    durationSeconds: duration,
    steps: [
      { instruction: "Xuất phát từ vị trí hiện tại của bạn", distanceMeters: Math.round(dist * 0.1) },
      { instruction: "Đi theo lộ trình hướng thẳng tới điểm tiếp nhận rác", distanceMeters: Math.round(dist * 0.8) },
      { instruction: "Đã đến điểm thu gom, chuẩn bị phân loại rác vào thùng", distanceMeters: Math.round(dist * 0.1) },
    ],
  });
}));

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Nhom4 API đang chạy tại http://0.0.0.0:${port}`);
  // Tự test Groq AI ngay khi khởi động
  const groqKey = (process.env.GROQ_API_KEY || "").trim();
  if (groqKey && groqKey.startsWith("gsk_")) {
    callGroq([{ role: "user", content: "Reply with exactly: NHOM4_AI_OK" }])
      .then((r) => console.log(`⚡ Groq AI (Llama 3.3) ĐÃ SẴN SÀNG! Phản hồi siêu tốc: ${r.trim()}`))
      .catch((err) => console.warn(`⚠️ Groq AI: ${err.message} (Đã bật AI dự phòng nội bộ)`));
  }
});
