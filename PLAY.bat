@echo off
title Tales Tales - local game server
cd /d "%~dp0game"
if not exist node_modules (
  echo First run: installing packages, please wait...
  call npm install --no-fund --no-audit
)
echo Starting the game server... the browser opens in a few seconds.
echo Close this window to stop the server.
start "" cmd /c "timeout /t 12 /nobreak >nul & start http://localhost:8787"
call npm run dev:local
pause
