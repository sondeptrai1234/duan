const sql = require("mssql");

const configs = [
  { name: "127.0.0.1 with instance SQLEXPRESS", server: "127.0.0.1", options: { instanceName: "SQLEXPRESS", trustServerCertificate: true, encrypt: false } },
  { name: "localhost with instance SQLEXPRESS", server: "localhost", options: { instanceName: "SQLEXPRESS", trustServerCertificate: true, encrypt: false } },
  { name: "LAPCUAXTUS with instance SQLEXPRESS", server: "LAPCUAXTUS", options: { instanceName: "SQLEXPRESS", trustServerCertificate: true, encrypt: false } },
  { name: "127.0.0.1:1433 without instance", server: "127.0.0.1", port: 1433, options: { trustServerCertificate: true, encrypt: false } },
  { name: "localhost:1433 without instance", server: "localhost", port: 1433, options: { trustServerCertificate: true, encrypt: false } },
];

async function testAll() {
  for (const item of configs) {
    console.log(`\n⏳ Đang thử cấu hình: ${item.name}...`);
    const cfg = {
      user: "sa",
      password: "sapassword",
      database: "SmartTrashDB",
      connectionTimeout: 3000,
      requestTimeout: 3000,
      ...item
    };
    try {
      const pool = new sql.ConnectionPool(cfg);
      await pool.connect();
      console.log(`🎉 THÀNH CÔNG VỚI: ${item.name}!`);
      const res = await pool.request().query("SELECT @@VERSION AS ver, DB_NAME() AS db");
      console.log("Kết quả truy vấn:", res.recordset[0]);
      await pool.close();
      return item;
    } catch (err) {
      console.log(`❌ Thất bại (${item.name}): ${err.message}`);
    }
  }
  console.log("\n⚠️ Tất cả các cổng/cách kết nối mạng TCP thông thường đều không được phản hồi.");
}

testAll().then(() => process.exit(0));
