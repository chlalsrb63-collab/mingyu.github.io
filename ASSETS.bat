@echo off
title Tales Tales - asset gallery
rem Renders the code-drawn art to asset\_export, indexes everything in asset\
rem and opens the gallery (asset\index.html) in the default browser.
cd /d "%~dp0game"
if not exist node_modules (
  echo First run: installing packages, please wait...
  call npm install --no-fund --no-audit
)
echo Rendering the current code-drawn art...
call npm run art:export
if errorlevel 1 (
  echo.
  echo The export needs a browser. Run once in the game folder: npx playwright install chromium
  echo The gallery still opens with the files that are already in asset\.
)
call npm run art:gallery
start "" "%~dp0asset\index.html"
