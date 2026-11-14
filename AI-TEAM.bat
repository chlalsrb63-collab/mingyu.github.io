@echo off
rem Opens the AI workers, each in its own window and workspace; each starts on its next task
rem from ai\TASKS.md (else ai\ROADMAP.md). Gemini only when ai\TEAM.txt says GEMINI=on.
cd /d "%~dp0"
start "Tales Tales - codex" cmd /k ""%~dp0ai\worker.bat" codex"
findstr /i /c:"GEMINI=on" "%~dp0ai\TEAM.txt" >nul 2>nul && start "Tales Tales - gemini" cmd /k ""%~dp0ai\worker.bat" gemini"
