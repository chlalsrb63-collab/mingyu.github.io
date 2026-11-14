@echo off
rem Claude Code reviews what Codex and Gemini finished and merges what passes the tests.
title Tales Tales - merge (Claude)
cd /d "%~dp0"
where claude >nul 2>nul || (echo Claude Code is missing. Run:  npm i -g @anthropic-ai/claude-code & pause & exit /b 1)
call claude "Read AGENTS.md and ai/merge.md, then follow ai/merge.md."
pause
