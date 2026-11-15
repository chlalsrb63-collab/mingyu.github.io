# AI 팀 사용법 (Claude · Codex · Gemini)

> `ai/TEAM.txt`의 `GEMINI=off`는 배치 파일의 Gemini CLI 실행 설정입니다.
> Antigravity는 같은 저장소의 `.work/gemini` (`gemini/work`)에서 따로 작업합니다.

| 파일 | 하는 일 |
| --- | --- |
| `AI-TEAM.bat` (폴더 맨 위) | Codex를 시작합니다. `GEMINI=on`일 때는 Gemini CLI도 작업을 시작합니다. |
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

## Antigravity에 한 건 넘기기

1. `ai/TASKS.md`의 **GEMINI** 섹션을 사용합니다. 먼저 진행 중인 작업과 `ai/reports/gemini-*.md`를 확인하고, 새 작업에는 대상 파일, 완료 기준, 검증 명령을 적습니다.
2. Antigravity에서 Desktop의 `Tales Tales/.work/gemini`를 열고 아래 지시를 전달합니다. Antigravity CLI가 설치·인증되어 있으면 같은 폴더에서 `agy -p`로 한 건을 전달할 수 있습니다. [Antigravity CLI 공식 문서](https://antigravity.google/docs/cli/headless/)
3. 끝나면 `gemini/work`의 커밋, 한국어 보고서, 검증 결과를 확인합니다. 통합 검토는 Claude가 맡습니다.

> 이 작업 폴더의 브랜치는 `gemini/work`입니다. `AGENTS.md`와 `ai/gemini.md`를 끝까지 읽고, 작업 트리가 깨끗하면 `git rebase main`을 실행하세요. `ai/TASKS.md`의 GEMINI 섹션에서 위에서부터 체크 안 된 첫 번째 작업 하나만 수행하세요. 이미 진행 중이거나 보고서가 있으면 상태를 보고하고 멈추세요. [ART]/[VFX]는 `ai/gemini.md` 5번과 픽셀 아트 규칙을 따르고, `game/src/logic/`는 수정하지 마세요. 바꾼 JS 파일은 `node --check`로 검사하고 작업에 적힌 미리보기를 확인하세요. `ai/reports/gemini-<작업이름>.md`에 한국어 보고서를 남기고 바뀐 파일만 `gemini/work`에 커밋하세요. push와 main 병합은 하지 마세요.

## 자동 개선이 도는 방식

Gemini가 콘텐츠를 점검해 작은 작업들로 쪼개 제안 → Claude가 좋은 제안을 로드맵에 올림 → Codex가 구현 →
Claude가 테스트 후 합침. 보드(`TASKS.md`)가 비어 있어도 이 순환으로 계속 개선됩니다.

## 하루 사용 흐름

1. `ai/TASKS.md`에 할 일을 적습니다 (Codex는 구현, Gemini는 분석·문서·콘텐츠).
2. Codex는 `AI-TEAM.bat`으로 시작하고, Antigravity에는 위 방법으로 한 건을 전달합니다.
3. 둘 다 끝나면 `AI-MERGE.bat` 더블클릭 → Claude가 합치고 결과를 한국어로 알려 줍니다.
4. `PLAY.bat`으로 바뀐 게임을 확인합니다.

VS Code로 이 폴더를 열면, 처음 한 번 "자동 작업 허용"을 누르면 그다음부터는 **폴더를 여는 것만으로**
Codex와 Gemini 터미널이 열리며 일을 시작합니다 (`.vscode/tasks.json`). 원치 않으면 그 파일을 지우세요.

처음 실행할 때 각 AI가 로그인을 요청합니다: Codex는 ChatGPT 계정, Gemini는 Google 계정, Claude는 Anthropic 계정.
