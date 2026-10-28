require("dotenv").config();
const sql = require("mssql");

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { trustServerCertificate: true, encrypt: false },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Đã kết nối SQL Server");
    return pool;
  })
  .catch((err) => console.error("Lỗi kết nối DB:", err));

module.exports = { sql, poolPromise };