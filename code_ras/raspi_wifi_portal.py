#!/usr/bin/env python3
"""
EcoBin - Raspberry Pi Wi-Fi & Backend Provisioning Portal
Không cần Cloudflare Quick Tunnel!

Khi Pi chưa có mạng hoặc đổi Wi-Fi (ở trường, ở nhà, phát 4G điện thoại):
1. Chạy script này trên Pi (hoặc đặt tự động chạy khi khởi động).
2. Pi sẽ mở Web Server tại cổng 8000 (http://192.168.4.1:8000 hoặc IP của Pi).
3. Điện thoại kết nối vào Wi-Fi của Pi (EcoBin_Setup) hoặc mở trình duyệt vào IP của Pi.
4. Chọn Wi-Fi, nhập mật khẩu và điền địa chỉ Backend máy tính (VD: http://192.168.1.50:3000).
5. Pi tự động lưu vào smartbin_config.json và kết nối vào Wi-Fi mới!
"""

import http.server
import socketserver
import json
import os
import subprocess
import urllib.parse

PORT = 8000
CONFIG_FILE = "smartbin_config.json"

def scan_wifi_networks():
    """Quét các mạng Wi-Fi xung quanh bằng nmcli (Raspberry Pi OS Bookworm/Bullseye)"""
    networks = []
    try:
        output = subprocess.check_output(
            ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list"],
            stderr=subprocess.DEVNULL,
            timeout=5
        ).decode("utf-8")
        seen = set()
        for line in output.strip().split("\n"):
            parts = line.split(":")
            if parts and parts[0] and parts[0] not in seen:
                seen.add(parts[0])
                signal = parts[1] if len(parts) > 1 else "100"
                networks.append({"ssid": parts[0], "signal": signal})
    except Exception:
        pass
    return networks

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "backend_url": "http://192.168.1.50:3000",
        "esp32_ip": "192.168.156.140",
        "mac_address": "PI-NHOM4-001"
    }

class ProvisioningHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        config = load_config()
        networks = scan_wifi_networks()

        options_html = "".join(
            f'<option value="{net["ssid"]}">{net["ssid"]} (Sóng: {net["signal"]}%)</option>'
            for net in networks
        )
        if not options_html:
            options_html = '<option value="">-- Tự nhập tên Wi-Fi bên dưới --</option>'

        html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EcoBin - Cấu hình Wi-Fi & Máy chủ Nhóm 4</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #F0FDF4;
            color: #1F2937;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
        }}
        .card {{
            background: #FFFFFF;
            max-width: 460px;
            width: 100%;
            border-radius: 18px;
            padding: 24px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08);
            border: 1px solid #DCFCE7;
        }}
        h2 {{
            color: #166534;
            margin-top: 0;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 20px;
        }}
        .subtitle {{
            color: #6B7280;
            font-size: 13px;
            margin-top: -8px;
            margin-bottom: 20px;
        }}
        label {{
            font-weight: 700;
            font-size: 13px;
            color: #374151;
            display: block;
            margin-top: 14px;
            margin-bottom: 6px;
        }}
        input, select {{
            width: 100%;
            padding: 12px;
            border: 1.5px solid #D1D5DB;
            border-radius: 10px;
            font-size: 14px;
            box-sizing: border-box;
            background: #F9FAFB;
        }}
        input:focus, select:focus {{
            outline: none;
            border-color: #16A34A;
            background: #FFFFFF;
        }}
        .tip {{
            font-size: 11px;
            color: #6B7280;
            margin-top: 4px;
        }}
        button {{
            background: #16A34A;
            color: #FFFFFF;
            border: none;
            border-radius: 12px;
            padding: 14px;
            font-size: 15px;
            font-weight: 800;
            width: 100%;
            cursor: pointer;
            margin-top: 24px;
        }}
        button:hover {{
            background: #15803D;
        }}
        .badge {{
            display: inline-block;
            background: #DCFCE7;
            color: #15803D;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 800;
            margin-bottom: 12px;
        }}
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">ECOBIN · RASPBERRY PI</span>
        <h2>🌿 Cấu hình Wi-Fi & Máy chủ</h2>
        <p class="subtitle">Đồng bộ dữ liệu trực tiếp trong mạng LAN (Không cần Quick Tunnel)</p>

        <form method="POST" action="/save">
            <label>1. Chọn mạng Wi-Fi:</label>
            <select id="wifi_select" onchange="document.getElementById('ssid').value = this.value">
                <option value="">-- Bấm để chọn mạng Wi-Fi đã quét --</option>
                {options_html}
            </select>

            <label>Hoặc nhập tên Wi-Fi (SSID):</label>
            <input type="text" id="ssid" name="ssid" placeholder="VD: WiFi-Truong, WiFi-Nha..." required>

            <label>Mật khẩu Wi-Fi:</label>
            <input type="password" name="password" placeholder="Nhập mật khẩu Wi-Fi (để trống nếu mạng mở)">

            <label>2. Địa chỉ Máy chủ Backend (HTTP API):</label>
            <input type="text" name="backend_url" value="{config.get('backend_url', 'http://192.168.1.50:3000')}" required>
            <div class="tip">Là địa chỉ IP máy tính chạy server (cổng 3000), xem trên App điện thoại.</div>

            <label>3. Địa chỉ IP Camera ESP32:</label>
            <input type="text" name="esp32_ip" value="{config.get('esp32_ip', '192.168.156.140')}">
            <div class="tip">IP của ESP32 Camera (mặc định: 192.168.156.140).</div>

            <button type="submit">💾 LƯU CẤU HÌNH & KẾT NỐI NGAY</button>
        </form>
    </div>
</body>
</html>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def do_POST(self):
        if self.path == "/save":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length).decode("utf-8")
            params = urllib.parse.parse_qs(post_data)

            ssid = params.get("ssid", [""])[0].strip()
            password = params.get("password", [""])[0].strip()
            backend_url = params.get("backend_url", [""])[0].strip().rstrip("/")
            esp32_ip = params.get("esp32_ip", [""])[0].strip()

            # Lưu vào config file
            cfg = {
                "wifi_ssid": ssid,
                "backend_url": backend_url,
                "esp32_ip": esp32_ip,
                "mac_address": "PI-NHOM4-001"
            }
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)

            # Thử kết nối Wi-Fi trên Raspberry Pi
            wifi_msg = "Đã lưu cấu hình!"
            if ssid:
                try:
                    cmd = ["nmcli", "dev", "wifi", "connect", ssid]
                    if password:
                        cmd.extend(["password", password])
                    subprocess.Popen(cmd)
                    wifi_msg = f"Đang kết nối Raspberry Pi vào mạng '{ssid}'..."
                except Exception as e:
                    wifi_msg = f"Đã lưu cấu hình. (Lỗi lệnh nmcli: {e})"

            response_html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cấu hình thành công</title>
    <style>
        body {{ font-family: sans-serif; background: #F0FDF4; padding: 30px; text-align: center; }}
        .card {{ background: #fff; padding: 30px; border-radius: 18px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }}
        h2 {{ color: #16A34A; }}
        p {{ color: #4B5563; font-size: 14px; line-height: 1.6; }}
    </style>
</head>
<body>
    <div class="card">
        <h2>🎉 THÀNH CÔNG!</h2>
        <p><b>{wifi_msg}</b></p>
        <p>• Địa chỉ Backend mới: <b>{backend_url}</b><br>• Camera ESP32: <b>{esp32_ip}</b></p>
        <p>Bây giờ bạn có thể kết nối điện thoại về mạng <b>{ssid}</b> và mở App Nhom4 để giám sát thùng rác!</p>
    </div>
</body>
</html>"""
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(response_html.encode("utf-8"))

def run():
    print(f"\n" + "="*60)
    print("🚀 ECOBIN WI-FI PROVISIONING PORTAL ĐANG CHẠY")
    print(f"👉 Mở trình duyệt trên điện thoại hoặc máy tính: http://0.0.0.0:{PORT}")
    print("="*60 + "\n")
    with socketserver.TCPServer(("", PORT), ProvisioningHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nĐã dừng portal.")

if __name__ == "__main__":
    run()
