const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const serverDir = path.join(root, "server");
const devClient = process.argv.includes("--dev-client");
const candidates = [];
for (const [name, entries] of Object.entries(os.networkInterfaces())) {
  for (const entry of entries || []) {
    if (entry.family !== "IPv4" || entry.internal) continue;
    const ip = entry.address;
    if (ip.startsWith("169.254.")) continue;
    const virtual = /virtual|vmware|vbox|hyper-v|wsl|docker|tailscale|wireguard|loopback/i.test(name);
    const wifi = /wi-?fi|wireless|wlan/i.test(name);
    const ethernet = /ethernet|lan/i.test(name);
    const subnet = ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
    const priority = virtual ? 20 : (wifi ? 0 : ethernet ? 1 : 3) + subnet;
    candidates.push({ ip, name, priority });
  }
}
candidates.sort((a, b) => a.priority - b.priority);
const lanIp = candidates[0]?.ip || "127.0.0.1";
const apiUrl = `http://${lanIp}:3000`;
const env = { ...process.env, EXPO_PUBLIC_API_URL: apiUrl };
const win = process.platform === "win32";

console.log("\n============================================");
console.log(" NHOM4 · SMART WASTE");
console.log("============================================");
console.log(`Backend API: ${apiUrl}`);
console.log(`Chế độ Expo: ${devClient ? "Development Build (TFLite offline có thể hoạt động)" : "Expo Go (Gemini cloud)"}`);
console.log("Điện thoại và máy tính phải cùng Wi-Fi/LAN.");
console.log("Giữ cửa sổ này mở khi đang dùng app. Nhấn Ctrl+C để dừng.\n");

const api = spawn("npm", ["start"], { cwd: serverDir, env, shell: win, stdio: "inherit" });
const expoArgs = devClient ? ["expo", "start", "--dev-client", "--lan"] : ["expo", "start", "--lan"];
const expo = spawn("npx", expoArgs, { cwd: root, env, shell: win, stdio: "inherit" });
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  try { api.kill(); } catch {}
  try { expo.kill(); } catch {}
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("error", (error) => console.error("Không chạy được backend:", error.message));
expo.on("error", (error) => console.error("Không chạy được Expo:", error.message));
api.on("exit", (code) => { if (!stopping && code !== 0) console.error(`Backend đã dừng (mã ${code}).`); });
expo.on("exit", (code) => { if (!stopping && code !== 0) console.error(`Expo đã dừng (mã ${code}).`); });
