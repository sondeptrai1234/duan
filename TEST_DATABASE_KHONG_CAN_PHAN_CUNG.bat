@echo off
chcp 65001 >nul
echo =======================================================
echo     TEST CƠ SỞ DỮ LIỆU & GIẢ LẬP PHẦN CỨNG NHOM4
echo =======================================================
echo Đang gửi dữ liệu cảm biến và sự kiện camera lên server...
node tools/simulate_hardware.js
pause
