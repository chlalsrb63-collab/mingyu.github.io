@echo off
rem Opens Codex and Gemini side by side, each in its own window and workspace,
rem and each starts on its next task from ai\TASKS.md.
cd /d "%~dp0"
start "Tales Tales - codex" cmd /k ""%~dp0ai\worker.bat" codex"
start "Tales Tales - gemini" cmd /k ""%~dp0ai\worker.bat" gemini"
