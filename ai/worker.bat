@echo off
rem Starts one AI worker in its own git worktree.
rem   ai\worker.bat codex          interactive (you see it and approve its actions)
rem   ai\worker.bat gemini auto    unattended: does one task by itself and exits (used by AI-AUTO.bat)
rem The worktree lives in .work\<name> on branch <name>/work, so two AIs never edit the same files.
setlocal
set NAME=%~1
set MODE=%~2
if "%NAME%"=="" set NAME=codex
title Tales Tales - %NAME%
cd /d "%~dp0.."
set ROOT=%CD%
if not exist ".work\%NAME%\.git" (
  echo Creating the %NAME% workspace in .work\%NAME% ...
  git worktree add ".work\%NAME%" -B %NAME%/work
  if errorlevel 1 (
    echo Could not create the workspace. Is Git installed?
    if /i not "%MODE%"=="auto" pause
    exit /b 1
  )
  pushd ".work\%NAME%\game"
  call npm install --no-fund --no-audit
  popd
)
rem Give the worker the owner's current task board and roadmap (they may have uncommitted edits).
copy /y "%ROOT%\ai\TASKS.md" "%ROOT%\.work\%NAME%\ai\TASKS.current.md" >nul
cd /d "%ROOT%\.work\%NAME%"
copy /y "%ROOT%\ai\ROADMAP.md" "%ROOT%\.work\%NAME%\ai\ROADMAP.current.md" >nul
set PROMPT_TEXT=Read AGENTS.md, then ai/%NAME%.md, then ai/TASKS.current.md and ai/ROADMAP.current.md (fresh copies of the owner's board and roadmap; treat them as ai/TASKS.md and ai/ROADMAP.md). Do exactly one task, following ai/%NAME%.md.
if /i "%MODE%"=="auto" set PROMPT_TEXT=%PROMPT_TEXT% You are running unattended: never ask questions, never wait for input; if blocked, write the report and stop.

if /i "%NAME%"=="codex" (
  where codex >nul 2>nul || (echo Codex CLI is missing. Run:  npm i -g @openai/codex & (if /i not "%MODE%"=="auto" pause) & exit /b 1)
  if /i "%MODE%"=="auto" (
    call codex exec --full-auto "%PROMPT_TEXT%"
  ) else (
    call codex "%PROMPT_TEXT%"
  )
) else (
  where gemini >nul 2>nul || (echo Gemini CLI is missing. Run:  npm i -g @google/gemini-cli & (if /i not "%MODE%"=="auto" pause) & exit /b 1)
  if /i "%MODE%"=="auto" (
    call gemini --yolo -p "%PROMPT_TEXT%"
  ) else (
    call gemini -i "%PROMPT_TEXT%"
    if errorlevel 1 call gemini
  )
)
if /i not "%MODE%"=="auto" pause
