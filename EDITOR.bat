@echo off
title Tales Tales - world map editor
cd /d "%~dp0game"
if not exist node_modules (
  echo First run: installing packages, please wait...
  call npm install --no-fund --no-audit
)
echo Starting the world map editor... the browser opens in a few seconds.
echo Close this window to stop the editor (and the test game it started).
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5190"
call npm run editor
pause
