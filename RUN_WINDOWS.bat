@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

echo ============================================
echo  NHOM4 - CHAY UNG DUNG EXPO GO
echo ============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Cai Node.js 22.13 tro len roi chay lai.
  pause
  exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number); process.exit(v[0]>22||(v[0]===22&&v[1]>=13)?0:1)"
if errorlevel 1 (
  echo [LOI] Expo SDK 58 can Node.js 22.13 tro len. Hay cap nhat Node.js LTS.
  pause
  exit /b 1
)

if not exist "server\.env" (
  copy "server\.env.example" "server\.env" >nul
  echo.
  echo Da tao server\.env. Nhap Gemini API key moi trong Notepad, luu lai.
  notepad "server\.env"
  echo Sau khi luu, chay lai RUN_WINDOWS.bat.
  pause
  exit /b 0
)

findstr /C:"PASTE_NEW_GEMINI_KEY_HERE" "server\.env" >nul
if not errorlevel 1 (
  echo [CANH BAO] Chua thay Gemini API key moi trong server\.env.
  notepad "server\.env"
  echo Neu chua co key, AI phan loai va chat se khong hoat dong.
)

echo [1/3] Dang cai/cap nhat thu vien Expo...
call npm install
if errorlevel 1 goto install_error

echo [2/3] Dang cai/cap nhat thu vien Backend...
pushd server
call npm install
if errorlevel 1 (
  popd
  goto install_error
)
popd

echo [3/3] Dang mo Backend va Expo Go...
node tools\run.js
pause
exit /b 0

:install_error
echo.
echo Cai thu vien that bai. Kiem tra Internet va Node.js, sau do chay lai.
pause
exit /b 1
