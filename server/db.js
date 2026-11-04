require("dotenv").config();
const sql = require("mssql");

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "SmartTrashDB",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  options: {
    trustServerCertificate: String(process.env.DB_TRUST_CERT || "true").toLowerCase() === "true",
    encrypt: String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
    enableArithAbort: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 15000,
  requestTimeout: 20000,
};

if (!config.user || !config.password) {
  throw new Error("Thiếu DB_USER hoặc DB_PASSWORD. Hãy tạo server/.env từ server/.env.example.");
}

const poolPromise = new sql.ConnectionPool(config).connect();
poolPromise.then(() => console.log("Đã kết nối SQL Server"))
  .catch((error) => console.error("Không kết nối được SQL Server:", error.message));

module.exports = { sql, poolPromise };
