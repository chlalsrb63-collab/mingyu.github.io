@echo off
rem Unattended content improvement: each round Gemini plans/writes one task, Codex implements one task,
rem then Claude reviews, tests, merges and pushes. Tasks come from ai\TASKS.md, else ai\ROADMAP.md.
rem Usage: AI-AUTO.bat [rounds]    (default 3 rounds; each round costs AI usage on all three accounts)
setlocal
cd /d "%~dp0"
set ROUNDS=%~1
if "%ROUNDS%"=="" set ROUNDS=3
title Tales Tales - AI auto (%ROUNDS% rounds)
where claude >nul 2>nul || (echo Claude Code is missing. Run:  npm i -g @anthropic-ai/claude-code & pause & exit /b 1)
for /l %%R in (1,1,%ROUNDS%) do (
  echo.
  echo ===== Round %%R of %ROUNDS%: Gemini =====
  call "%~dp0ai\worker.bat" gemini auto
  echo.
  echo ===== Round %%R of %ROUNDS%: Codex =====
  call "%~dp0ai\worker.bat" codex auto
  echo.
  echo ===== Round %%R of %ROUNDS%: Claude merges =====
  cd /d "%~dp0"
  call claude -p "Read AGENTS.md and ai/merge.md, then follow ai/merge.md. You are running unattended." --permission-mode acceptEdits
)
echo.
echo All rounds finished. See ai\LOG.md for what was merged.
pause
