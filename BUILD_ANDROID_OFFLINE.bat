@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
title Nhom4 - Xuat File APK Cai Dat (Preview APK)

echo ========================================================
echo   ECOBIN NHOM 4 - DONG GOI XUAT FILE APK ANDROID
echo ========================================================
echo.
echo Mo hinh AI best.pt da duoc chuyen sang assets/models/best_float32.tflite
echo va tich hop 100%% ben trong ung dung Expo.
echo.

echo [1/3] Kiem tra dang nhap tai khoan Expo (EAS)...
call npx eas-cli@latest whoami 2>nul
if errorlevel 1 (
  echo.
  echo [!] Ban chua dang nhap tai khoan Expo.
  echo     Trinh duyet se mo de ban dang nhap hoac nhap tai khoan:
  call npx eas-cli@latest login
)

echo.
echo [2/3] Bat dau tien trinh build file APK...
echo (He thong cloud EAS se tu dong bien dich C++, NDK va TFLite thanh file APK)
echo.

call npx eas-cli@latest build --platform android --profile preview

echo.
echo ========================================================
echo   HOAN TAT!
echo   Ban co the tai file APK truc tiep tu link do EAS cung cap
echo   hoac quet ma QR de cai vao dien thoai Android.
echo ========================================================
pause
