# AI 팀 사용법 (Claude · Codex · Gemini)

> **지금은 Gemini 꺼짐** (`ai/TEAM.txt` = `GEMINI=off`): Codex 혼자 구현과 기획·글쓰기를 번갈아 맡습니다.
> Gemini가 폴더에 접근할 수 있게 되면 `GEMINI=on`으로 바꾸세요.

| 파일 | 하는 일 |
| --- | --- |
| `AI-TEAM.bat` (폴더 맨 위) | 더블클릭 → Codex 창과 Gemini 창이 열리고, 각자 `ai/TASKS.md`의 자기 다음 일을 시작 |
| `AI-AUTO.bat` | 더블클릭 → **자동 개선 3라운드**: 라운드마다 Gemini 1건(기획·글) → Codex 1건(구현) → Claude 합치기·푸시. 사람 승인 없이 돌아갑니다. 라운드 수 바꾸기: 명령창에서 `AI-AUTO.bat 5` |
| `AI-MERGE.bat` | 더블클릭 → Claude가 두 AI의 결과를 검토·테스트하고 합친 뒤 보드를 갱신하고 GitHub에 올림 |
| `ai/TASKS.md` | **작업 보드.** 여기에 적은 일이 최우선입니다 |
| `ai/ROADMAP.md` | 보드가 비었을 때 AI가 스스로 고르는 **개선 로드맵**과 품질 기준. 순서를 바꾸면 우선순위가 바뀝니다 |
| `ai/PROMPTS.md` | 터미널에서 직접 실행할 때 붙여 넣을 **명령 프롬프트 모음** |
| `ai/proposals/` | Gemini가 만든 Codex용 작업 제안 (Claude가 로드맵에 옮김) |
| `ai/LOG.md` | Claude가 합칠 때마다 남기는 진행 기록 |
| `ai/codex.md`, `ai/gemini.md`, `ai/merge.md` | 각 AI의 역할과 작업 순서 (AI가 읽는 지침) |
| `ai/reports/` | AI가 일을 마칠 때마다 남기는 보고서 |
| `.work/codex`, `.work/gemini` | 각 AI 전용 작업 폴더 (자동 생성, 서로 덮어쓰지 않게 분리) |

## 자동 개선이 도는 방식

Gemini가 콘텐츠를 점검해 작은 작업들로 쪼개 제안 → Claude가 좋은 제안을 로드맵에 올림 → Codex가 구현 →
Claude가 테스트 후 합침. 보드(`TASKS.md`)가 비어 있어도 이 순환으로 계속 개선됩니다.

## 하루 사용 흐름

1. `ai/TASKS.md`에 할 일을 적습니다 (Codex는 구현, Gemini는 분석·문서·콘텐츠).
2. `AI-TEAM.bat` 더블클릭 → 두 창에서 AI가 일합니다. 파일 수정·명령 실행 승인을 물으면 허락하세요.
3. 둘 다 끝나면 `AI-MERGE.bat` 더블클릭 → Claude가 합치고 결과를 한국어로 알려 줍니다.
4. `PLAY.bat`으로 바뀐 게임을 확인합니다.

VS Code로 이 폴더를 열면, 처음 한 번 "자동 작업 허용"을 누르면 그다음부터는 **폴더를 여는 것만으로**
Codex와 Gemini 터미널이 열리며 일을 시작합니다 (`.vscode/tasks.json`). 원치 않으면 그 파일을 지우세요.

처음 실행할 때 각 AI가 로그인을 요청합니다: Codex는 ChatGPT 계정, Gemini는 Google 계정, Claude는 Anthropic 계정.
