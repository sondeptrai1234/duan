require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const { sql, poolPromise } = require("./db");

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
    if (!res.headersSent) res.status(500).json({ error: error.message || "Lỗi máy chủ" });
  });
}
function saveImageBase64(base64, mimeType = "image/jpeg") {
  if (!base64 || typeof base64 !== "string") return null;
  const raw = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new Error("Ảnh không hợp lệ hoặc vượt quá 8 MB.");
  const ext = mimeType === "image/png" ? "png" : "jpg";
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

app.get("/api/health", asyncRoute(async (_req, res) => {
  try { const pool = await poolPromise; await pool.request().query("SELECT 1 AS ok"); res.json({ ok: true, database: "connected" }); }
  catch (error) { res.status(503).json({ ok: false, database: "disconnected", error: error.message }); }
}));

app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName?.trim() || !email?.trim() || typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "Nhập họ tên, email và mật khẩu tối thiểu 6 ký tự." });
  const pool = await poolPromise;
  const normalizedEmail = email.trim().toLowerCase();
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

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || !password) return res.status(400).json({ error: "Email và mật khẩu là bắt buộc." });
  const pool = await poolPromise;
  const result = await pool.request().input("email", sql.NVarChar(255), email.trim().toLowerCase()).query("SELECT TOP 1 UserID, FullName, Email, PasswordHash FROM Users WHERE Email = @email");
  const user = result.recordset[0];
  if (!user || !(await verifyPassword(password, user.PasswordHash))) return res.status(401).json({ error: "Email hoặc mật khẩu không chính xác." });
  res.json({ user: safeUser(user) });
}));

// Raspberry Pi 4 telemetry: distanceCm is measured from the ultrasonic sensor to the trash surface.
app.post("/api/telemetry", asyncRoute(async (req, res) => {
  const { macAddress, distanceCm, temperature, humidity, lidState } = req.body || {};
  if (!macAddress || !Number.isFinite(Number(distanceCm))) return res.status(400).json({ error: "macAddress và distanceCm hợp lệ là bắt buộc." });
  const pool = await poolPromise;
  const found = await pool.request().input("mac", sql.VarChar(50), macAddress).query("SELECT TrashCanID, Capacity FROM TrashCans WHERE MacAddress = @mac");
  if (!found.recordset.length) return res.status(404).json({ error: "Không tìm thấy thùng rác với MAC này." });
  const { TrashCanID, Capacity } = found.recordset[0];
  const capacity = Number(Capacity);
  if (!Number.isFinite(capacity) || capacity <= 0) return res.status(422).json({ error: "Capacity của thùng rác phải lớn hơn 0." });
  const fillLevel = Math.max(0, Math.min(100, Math.round(((capacity - Number(distanceCm)) / capacity) * 100)));
  await pool.request()
    .input("id", sql.Int, TrashCanID)
    .input("fill", sql.Float, fillLevel)
    .input("temp", sql.Float, temperature == null ? null : Number(temperature))
    .input("hum", sql.Float, humidity == null ? null : Number(humidity))
    .input("lid", sql.NVarChar(20), lidState || "Closed")
    .query("INSERT INTO Telemetry (TrashCanID, FillLevel, Temperature, Humidity, LidState) VALUES (@id, @fill, @temp, @hum, @lid); UPDATE TrashCans SET Status = 'Online' WHERE TrashCanID = @id;");
  res.json({ ok: true, trashCanId: TrashCanID, fillLevel });
}));

app.get("/api/trashcans", asyncRoute(async (_req, res) => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT c.TrashCanID, c.Name, c.MacAddress, c.Capacity, c.Status, c.LocationName, c.Latitude, c.Longitude,
           t.FillLevel, t.Temperature, t.Humidity, t.LidState, t.RecordedAt
    FROM TrashCans c
    OUTER APPLY (SELECT TOP 1 * FROM Telemetry WHERE TrashCanID = c.TrashCanID ORDER BY RecordedAt DESC) t
    ORDER BY c.TrashCanID;
  `);
  res.json(result.recordset);
}));

app.post("/api/classify", asyncRoute(async (req, res) => {
  const { imageBase64, mimeType = "image/jpeg" } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== "string") return res.status(400).json({ error: "Thiếu ảnh Base64." });
  if (imageBase64.length > 11_000_000) return res.status(413).json({ error: "Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 8 MB." });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.json({
      wasteType: "Chai nhựa PET", category: "Rác tái chế", confidence: 96, recyclable: true,
      binColor: "Xanh dương", classificationMode: "demo",
      instructions: ["Đổ hết chất lỏng còn bên trong chai.", "Tráng sạch và để ráo nước.", "Ép gọn chai và bỏ vào ngăn tái chế."],
      note: "AI server chưa được cấu hình khóa. Đây là kết quả demo, không phải nhận diện từ ảnh.",
    });
  }
  const imageData = `data:${mimeType};base64,${imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")}`;
  const prompt = "Phân loại vật thể rác trong ảnh. Trả về JSON đúng schema: {wasteType:string, category:string, confidence:number, recyclable:boolean, binColor:string, instructions:string[], note:string}. category chỉ chọn một trong: Rác tái chế, Rác hữu cơ, Rác còn lại, Rác nguy hại, Chưa xác định. instructions gồm 2-4 bước ngắn bằng tiếng Việt. Nếu ảnh không rõ hoặc không phải rác, dùng category Chưa xác định và confidence thấp. Không đoán quá mức.";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", response_format: { type: "json_object" }, temperature: 0.2, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageData, detail: "low" } }] }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `AI provider error (${response.status})`);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI không trả về kết quả phân loại.");
  let parsed; try { parsed = JSON.parse(content); } catch { throw new Error("AI trả về dữ liệu không đúng JSON."); }
  const allowed = ["Rác tái chế", "Rác hữu cơ", "Rác còn lại", "Rác nguy hại", "Chưa xác định"];
  res.json({
    wasteType: String(parsed.wasteType || "Chưa xác định"), category: allowed.includes(parsed.category) ? parsed.category : "Chưa xác định",
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)), recyclable: Boolean(parsed.recyclable),
    binColor: String(parsed.binColor || "Chưa xác định"), instructions: Array.isArray(parsed.instructions) ? parsed.instructions.slice(0, 4).map(String) : [],
    note: String(parsed.note || "Kết quả AI chỉ mang tính tham khảo; hãy đối chiếu hướng dẫn địa phương."), classificationMode: "ai",
  });
}));

app.post("/api/waste-records", asyncRoute(async (req, res) => {
  const { userId, wasteType, category, confidence, classificationMode = "demo" } = req.body || {};
  if (!wasteType || !category) return res.status(400).json({ error: "Thiếu wasteType hoặc category." });
  const pool = await poolPromise;
  const result = await pool.request()
    .input("userId", sql.Int, userId ? Number(userId) : null)
    .input("type", sql.NVarChar(120), String(wasteType))
    .input("category", sql.NVarChar(80), String(category))
    .input("confidence", sql.Float, Number(confidence) || 0)
    .input("mode", sql.NVarChar(20), classificationMode === "ai" ? "ai" : "demo")
    .query("INSERT INTO WasteRecords (UserID, WasteType, Category, Confidence, ClassificationMode) OUTPUT INSERTED.RecordID, INSERTED.CreatedAt VALUES (@userId, @type, @category, @confidence, @mode)");
  res.status(201).json({ ok: true, record: result.recordset[0] });
}));

app.get("/api/waste-records", asyncRoute(async (req, res) => {
  const pool = await poolPromise;
  const request = pool.request();
  let query = "SELECT TOP 100 RecordID, UserID, WasteType, Category, Confidence, ClassificationMode, CreatedAt FROM WasteRecords";
  if (req.query.userId) { request.input("userId", sql.Int, Number(req.query.userId)); query += " WHERE UserID = @userId"; }
  query += " ORDER BY CreatedAt DESC";
  const result = await request.query(query);
  res.json(result.recordset);
}));

// Raspberry Pi camera integration: POST a captured frame and detection metadata from the bin.
app.post("/api/bin-events", asyncRoute(async (req, res) => {
  const { macAddress, detectedLabel, category, confidence, imageBase64, mimeType, eventType = "object-detected", fillLevel } = req.body || {};
  if (!macAddress) return res.status(400).json({ error: "macAddress là bắt buộc." });
  const pool = await poolPromise;
  const imageUrl = saveImageBase64(imageBase64, mimeType);
  const can = await pool.request().input("mac", sql.VarChar(50), macAddress).query("SELECT TOP 1 TrashCanID FROM TrashCans WHERE MacAddress = @mac");
  const trashCanId = can.recordset[0]?.TrashCanID || null;
  const inserted = await pool.request()
    .input("trashCanId", sql.Int, trashCanId)
    .input("mac", sql.VarChar(50), macAddress)
    .input("eventType", sql.NVarChar(40), eventType)
    .input("label", sql.NVarChar(120), detectedLabel || null)
    .input("category", sql.NVarChar(80), category || null)
    .input("confidence", sql.Float, confidence == null ? null : Number(confidence))
    .input("imageUrl", sql.NVarChar(500), imageUrl)
    .input("fill", sql.Float, fillLevel == null ? null : Number(fillLevel))
    .query(`INSERT INTO BinEvents (TrashCanID, MacAddress, EventType, DetectedLabel, Category, Confidence, ImageUrl, FillLevel)
            OUTPUT INSERTED.EventID, INSERTED.CreatedAt VALUES (@trashCanId, @mac, @eventType, @label, @category, @confidence, @imageUrl, @fill)`);
  res.status(201).json({ ok: true, event: inserted.recordset[0], imageUrl });
}));

app.get("/api/bin-events", asyncRoute(async (_req, res) => {
  const pool = await poolPromise;
  const result = await pool.request().query(`SELECT TOP 40 EventID, TrashCanID, MacAddress, EventType, DetectedLabel, Category, Confidence, ImageUrl, FillLevel, CreatedAt FROM BinEvents ORDER BY CreatedAt DESC`);
  res.json(result.recordset);
}));

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`EcoSort API đang chạy tại http://0.0.0.0:${port}`));
