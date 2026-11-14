@echo off
rem Starts one AI worker in its own git worktree:  ai\worker.bat codex   or   ai\worker.bat gemini
rem The worktree lives in .work\<name> on branch <name>/work, so two AIs never edit the same files.
setlocal
set NAME=%~1
if "%NAME%"=="" set NAME=codex
title Tales Tales - %NAME%
cd /d "%~dp0.."
set ROOT=%CD%
if not exist ".work\%NAME%\.git" (
  echo Creating the %NAME% workspace in .work\%NAME% ...
  git worktree add ".work\%NAME%" -B %NAME%/work
  if errorlevel 1 (
    echo Could not create the workspace. Is Git installed?
    pause
    exit /b 1
  )
  pushd ".work\%NAME%\game"
  call npm install --no-fund --no-audit
  popd
)
rem Give the worker the owner's current task board (it may have uncommitted edits in the main folder).
copy /y "%ROOT%\ai\TASKS.md" "%ROOT%\.work\%NAME%\ai\TASKS.current.md" >nul
cd /d "%ROOT%\.work\%NAME%"
set PROMPT_TEXT=Read AGENTS.md, then ai/%NAME%.md, then ai/TASKS.current.md. Do the first open task in your section, following ai/%NAME%.md exactly.
if /i "%NAME%"=="codex" (
  where codex >nul 2>nul || (echo Codex CLI is missing. Run:  npm i -g @openai/codex & pause & exit /b 1)
  call codex "%PROMPT_TEXT%"
) else (
  where gemini >nul 2>nul || (echo Gemini CLI is missing. Run:  npm i -g @google/gemini-cli & pause & exit /b 1)
  call gemini -i "%PROMPT_TEXT%"
  if errorlevel 1 call gemini
)
pause
