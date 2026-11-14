# AI 팀 사용법 (Claude · Codex · Gemini)

| 파일 | 하는 일 |
| --- | --- |
| `AI-TEAM.bat` (폴더 맨 위) | 더블클릭 → Codex 창과 Gemini 창이 열리고, 각자 `ai/TASKS.md`의 자기 다음 일을 시작 |
| `AI-MERGE.bat` | 더블클릭 → Claude가 두 AI의 결과를 검토·테스트하고 합친 뒤 보드를 갱신하고 GitHub에 올림 |
| `ai/TASKS.md` | **작업 보드.** 여기에 할 일을 적습니다 |
| `ai/codex.md`, `ai/gemini.md`, `ai/merge.md` | 각 AI의 역할과 작업 순서 (AI가 읽는 지침) |
| `ai/reports/` | AI가 일을 마칠 때마다 남기는 보고서 |
| `.work/codex`, `.work/gemini` | 각 AI 전용 작업 폴더 (자동 생성, 서로 덮어쓰지 않게 분리) |

## 하루 사용 흐름

1. `ai/TASKS.md`에 할 일을 적습니다 (Codex는 구현, Gemini는 분석·문서·콘텐츠).
2. `AI-TEAM.bat` 더블클릭 → 두 창에서 AI가 일합니다. 파일 수정·명령 실행 승인을 물으면 허락하세요.
3. 둘 다 끝나면 `AI-MERGE.bat` 더블클릭 → Claude가 합치고 결과를 한국어로 알려 줍니다.
4. `PLAY.bat`으로 바뀐 게임을 확인합니다.

VS Code로 이 폴더를 열면, 처음 한 번 "자동 작업 허용"을 누르면 그다음부터는 **폴더를 여는 것만으로**
Codex와 Gemini 터미널이 열리며 일을 시작합니다 (`.vscode/tasks.json`). 원치 않으면 그 파일을 지우세요.

처음 실행할 때 각 AI가 로그인을 요청합니다: Codex는 ChatGPT 계정, Gemini는 Google 계정, Claude는 Anthropic 계정.
