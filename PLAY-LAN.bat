@echo off
title Tales Tales - LAN server (same Wi-Fi)
cd /d "%~dp0game"
if not exist node_modules (
  echo First run: installing packages, please wait...
  call npm install --no-fund --no-audit
)
call npm run build:logic
echo.
echo ================================================================
echo  Tales Tales LAN server is starting. Close this window to stop.
echo.
echo  On this PC:   http://localhost:8830
echo  On other PC/phone (same Wi-Fi), open:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo      http://%%b:8830
)
echo.
echo  If Windows Firewall pops up, click [Allow access].
echo ================================================================
echo.
start "" cmd /c "timeout /t 12 /nobreak >nul & start http://localhost:8830"
rem the same saved world as the play server (.wrangler/play): characters carry over
call npx wrangler dev -c wrangler.local.jsonc --ip 0.0.0.0 --port 8830 --persist-to .wrangler/play
pause
