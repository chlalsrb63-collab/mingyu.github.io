@echo off
title Tales Tales - local game server
cd /d "%~dp0game"
if not exist node_modules (
  echo First run: installing packages, please wait...
  call npm install --no-fund --no-audit
)
call npm run build:logic
echo Starting the game server: http://localhost:8830 (the browser opens in a few seconds).
echo Close this window to stop the server.
start "" cmd /c "timeout /t 12 /nobreak >nul & start http://localhost:8830"
rem the one saved world (.wrangler/play), shared with PLAY-LAN.bat: characters carry over between builds
call npx wrangler dev -c wrangler.local.jsonc --port 8830 --persist-to .wrangler/play
pause
