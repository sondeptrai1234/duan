@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (echo Chua cai Node.js.& pause & exit /b 1)
if not exist "server\.env" (copy "server\.env.example" "server\.env" >nul & notepad "server\.env")
if not exist ".env" (copy ".env.example" ".env" >nul & notepad ".env")
echo Dang cai/cap nhat thu vien...
call npm install
if errorlevel 1 goto failed
pushd server
call npm install
if errorlevel 1 (popd & goto failed)
popd
echo Dang mo backend va Metro cho Development Build...
node tools\run.js --dev-client
pause
exit /b 0
:failed
echo Cai thu vien that bai. Kiem tra Internet.
pause
exit /b 1
