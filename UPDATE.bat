@echo off
title Tales Tales - update
cd /d "%~dp0"
git pull --ff-only
cd game
call npm install --no-fund --no-audit
echo.
echo Update finished.
pause
