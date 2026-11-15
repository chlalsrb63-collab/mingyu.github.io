@echo off
chcp 65001 >nul
title Tales Tales - 같은 집 와이파이로 함께 하기
cd /d "%~dp0game"
if not exist node_modules (
  echo 처음 실행: 패키지를 설치하는 중입니다. 잠시 기다려 주세요...
  call npm install --no-fund --no-audit
)
call npm run build:logic
echo.
echo ================================================================
echo  테일즈테일즈 서버를 켭니다. 이 창을 닫으면 서버가 꺼집니다.
echo.
echo  이 PC에서:        http://localhost:8830
echo  같은 와이파이의 다른 PC/노트북/폰 브라우저에 아래 주소를 입력하세요:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo      http:%%a:8830
echo  (뒤의 숫자 주소는 위에 나온 것 그대로, 앞의 공백 없이: 예 http://192.168.0.12:8830)
echo.
echo  처음 한 번 Windows 방화벽 창이 뜨면 [허용]을 눌러 주세요.
echo ================================================================
echo.
start "" cmd /c "timeout /t 12 /nobreak >nul & start http://localhost:8830"
rem the same saved world as the play server (.wrangler/play): characters carry over
call npx wrangler dev -c wrangler.local.jsonc --ip 0.0.0.0 --port 8830 --persist-to .wrangler/play
pause
