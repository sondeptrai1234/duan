require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { sql, poolPromise } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// Raspberry Pi 4 gửi dữ liệu cảm biến lên đây
app.post("/api/telemetry", async (req, res) => {
  try {
    const { macAddress, distanceCm, temperature, humidity, lidState } = req.body;
    const pool = await poolPromise;

    // Tìm thùng rác theo MAC
    const can = await pool.request()
      .input("mac", sql.VarChar(50), macAddress)
      .query("SELECT TrashCanID, Capacity FROM TrashCans WHERE MacAddress = @mac");
    if (can.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy thùng rác với MAC này" });
    }
    const { TrashCanID, Capacity } = can.recordset[0];

    // Đổi khoảng cách cảm biến siêu âm thành % đầy
    let fillLevel = ((Capacity - distanceCm) / Capacity) * 100;
    fillLevel = Math.max(0, Math.min(100, Math.round(fillLevel)));

    await pool.request()
      .input("id", sql.Int, TrashCanID)
      .input("fill", sql.Float, fillLevel)
      .input("temp", sql.Float, temperature)
      .input("hum", sql.Float, humidity)
      .input("lid", sql.VarChar(20), lidState || "Closed")
      .query(`
        INSERT INTO Telemetry (TrashCanID, FillLevel, Temperature, Humidity, LidState)
        VALUES (@id, @fill, @temp, @hum, @lid);
        UPDATE TrashCans SET Status = 'Online' WHERE TrashCanID = @id;
      `);

    res.json({ ok: true, fillLevel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// App lấy danh sách thùng rác kèm dữ liệu mới nhất
app.get("/api/trashcans", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT c.*, t.FillLevel, t.Temperature, t.Humidity, t.LidState, t.RecordedAt
      FROM TrashCans c
      OUTER APPLY (
        SELECT TOP 1 * FROM Telemetry
        WHERE TrashCanID = c.TrashCanID
        ORDER BY RecordedAt DESC
      ) t
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`Server chạy cổng ${port}`));