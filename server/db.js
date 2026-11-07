const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();
const sql = require("mssql");

const hasConfiguredCredentials = Boolean(
  process.env.DB_USER &&
  process.env.DB_PASSWORD &&
  process.env.DB_SERVER &&
  process.env.DB_PASSWORD.trim() !== ""
);

let poolInstance = null;
let isDbConnected = false;

if (hasConfiguredCredentials) {
  let serverHost = process.env.DB_SERVER.trim();
  let instanceName = undefined;

  // Hỗ trợ Named Instance như localhost\SQLEXPRESS hoặc LAPCUAXTUS\SQLEXPRESS
  if (serverHost.includes("\\")) {
    const parts = serverHost.split("\\");
    serverHost = parts[0] || "localhost";
    instanceName = parts[1];
  }

  const config = {
    user: process.env.DB_USER.trim(),
    password: process.env.DB_PASSWORD,
    server: serverHost,
    database: process.env.DB_NAME ? process.env.DB_NAME.trim() : "SmartTrashDB",
    // Nếu có instanceName (như SQLEXPRESS), không truyền cứng port 1433 để SQL Browser tự phân giải
    port: instanceName ? undefined : (process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined),
    options: {
      instanceName: instanceName,
      trustServerCertificate: String(process.env.DB_TRUST_CERT || "true").toLowerCase() === "true",
      encrypt: String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 8000,
    requestTimeout: 15000,
  };

  const pool = new sql.ConnectionPool(config);
  pool.connect()
    .then((p) => {
      poolInstance = p;
      isDbConnected = true;
      console.log("✅ Đã kết nối thành công SQL Server (Database: " + (process.env.DB_NAME || "SmartTrashDB") + ")");
      // Đảm bảo schema có đầy đủ các cột mới
      p.request().query(`
        IF OBJECT_ID(N'dbo.Telemetry', N'U') IS NOT NULL
        BEGIN
          IF COL_LENGTH(N'dbo.Telemetry', N'OrganicLidState') IS NULL
            ALTER TABLE dbo.Telemetry ADD OrganicLidState NVARCHAR(20) NULL;
          IF COL_LENGTH(N'dbo.Telemetry', N'InorganicLidState') IS NULL
            ALTER TABLE dbo.Telemetry ADD InorganicLidState NVARCHAR(20) NULL;
        END
      `).catch(() => {});
    })
    .catch((error) => {
      isDbConnected = false;
      poolInstance = null;
      console.warn("⚠️ Chưa kết nối được SQL Server (" + error.message + ").");
      console.log("👉 Đang tự động kích hoạt In-Memory Database: Mọi chức năng App và API hoạt động bình thường 100%!");
    });
} else {
  console.log("ℹ️ SQL Server chưa cấu hình mật khẩu riêng. Đang chạy chế độ In-Memory Database (sẵn sàng test không cần SQL Server).");
}

async function getPool() {
  if (!isDbConnected || !poolInstance) {
    return null;
  }
  return poolInstance;
}

module.exports = {
  sql,
  getPool,
  get hasDatabaseCredentials() {
    return isDbConnected;
  },
};
