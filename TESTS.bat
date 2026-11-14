@echo off
title Tales Tales - rule tests
cd /d "%~dp0game"
call npm run test:rules
pause
