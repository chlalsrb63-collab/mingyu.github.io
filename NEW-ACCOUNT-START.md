# 새 계정/새 세션에서 이어서 개발하기 — 인계서 (2026-11-16)

이 파일 하나로 **다른 Claude 계정(또는 다른 PC)** 에서도 개발을 그대로 이어갈 수 있게 만든 문서입니다. 경로: `C:\Users\mankyu\Desktop\Tales Tales\NEW-ACCOUNT-START.md`

## 0. 가장 빠른 시작 (복사해서 붙여 넣기)

새 계정으로 Claude Code(데스크톱 앱 Code 탭 또는 터미널)를 열고, **작업 폴더를 `C:\Users\mankyu\Desktop\Tales Tales` 로 지정**한 뒤 첫 메시지로 아래를 붙여 넣으세요.

```
너는 테일즈테일즈(Tales Tales, 브라우저 파티 MMORPG) 프로젝트의 통합 담당 Claude다. 오너에게는 한국어로 답한다.
먼저 순서대로 읽어라: (1) NEW-ACCOUNT-START.md (이 인계서) (2) ai/HANDOFF.md (73줄 "여기서 시작") (3) AGENTS.md (규칙) (4) ai/TASKS.md 의 CODEX 섹션과 "진행 중" 표.
그다음 ai/HANDOFF.md §4 "진행 중 · 다음"의 순서대로 이어서 개발해라. 토큰을 아껴라: 에이전트는 한 번에 1~2개, model sonnet, 짧은 브리프, 전체 테스트는 병합마다 1번. 코드를 찾을 때는 codebase-memory MCP(프로젝트 C-Users-mankyu-Desktop-Tales-Tales: search_graph → trace_path → get_code_snippet)를 먼저 써라(오너 요청).
절대 push/배포하지 마라(push = 배포). 오너의 플레이 서버(8830)는 허락 없이 재시작하지 마라. 시작하기 전에 `git status`와 `git log -5`로 현재 상태를 확인하고 3줄로 보고해라.
```

## 1. 프로젝트 한눈에

- **테일즈테일즈**: 귀여운 16×16 동물 영웅(꼬리 달린 15종) vs 기괴한 지옥 짐승 몬스터, 2:1 아이소메트릭, GBA풍 HUD, 모든 그림·소리는 코드로 생성. 서버가 규칙을 전부 가짐(Cloudflare Worker + Durable Object).
- **위치(단일 진실)**: `C:\Users\mankyu\Desktop\Tales Tales` — git 저장소, 브랜치 `main`(지금 커밋 `c018dbd`), **원격 `origin`(GitHub)에는 push 안 함**. `main`이 곧 최신 상태입니다.
- 게임 코드 `game/` (규칙 `game/src/logic/NN-*.js` → 생성물 `game/src/logic.js` 직접 수정 금지, 클라이언트 `game/public/`), 문서 `docs/`, AI 협업 `ai/`.
- 읽는 순서: `AGENTS.md`(규칙·구조) → `ai/HANDOFF.md`(지금 상태·다음 일) → `docs/design/item-system-spec-2026-11-16.md`(이번 아이템 개편 명세) → 필요한 설계 문서의 해당 절만(`grep -n "^#"`). 파일 지도는 `docs/FILEMAP.md`. 지난 기록은 `ai/HANDOFF-archive-2026-11-16.md`.

## 2. 준비물과 명령 (새 PC라면)

- Node.js(현재 v26), git, Windows. 새 PC에서는 폴더를 통째로 복사(`.git` 포함)한 뒤 `cd game && npm install`.
- 매일 쓰는 명령(`game/`에서): `npm run build:logic` · `node scripts/test-all.mjs [이름…]`(전체 65개, 약 130초) · `npm run data:check` · `npm run check:split` · `node scripts/shot.mjs --page tip|wardrobe|mobs … | --live --url http://localhost:<포트>`.
- 개발 서버(워크트리/에이전트용): 메인의 `node_modules/wrangler/bin/wrangler.js dev -c wrangler.local.jsonc --port <8841~8860> --persist-to .wrangler/<이름>`. **여러 서버는 반드시 각자 `--persist-to`** (안 그러면 검은 화면).
- **오너의 로컬 플레이 서버**: 고정 폴더 `C:\Users\mankyu\Desktop\tt-play-current`(커밋 644a4d8, 스마트폰 UI 포함), `.claude/launch.json`의 `play-local`, 포트 **8830**, 같은 와이파이에서 `http://192.168.31.58:8830`, 저장 `game\.wrangler\play`. 새 빌드 반영은 `git -C ..\tt-play-current checkout --detach <커밋>` 후 서버 재시작 — **오너가 원할 때만**.

## 3. 오너와 일하는 규칙 (꼭 지킬 것)

- 오너에게는 **항상 한국어**, 코드·주석·커밋 메시지는 영어. 플레이어에게 보이는 글은 한국어.
- 자율적으로 진행하되 **토큰 절약**: 새 세션 시작은 짧은 `ai/HANDOFF.md`로, 에이전트 1~2개(model sonnet), 병합마다 전체 테스트 1번, 스크린샷은 요청받은 것만.
- **절대 하지 말 것:** push/배포, 비밀·토큰 커밋, `?v=` 캐시 태그 수동 수정, `game/src/logic.js` 직접 수정, 오너 서버(8830) 무단 재시작, Windows 방화벽 등 시스템 설정 변경.
- **오너 결정(바꾸지 말 것):** Lv.200까지 약 45시간 · 6단계 장비는 Lv.181 · 사냥 골드 ×0.4(알바가 주 수입) · 칼날 소용돌이 3마리 · **도적은 광역 없이 단일 대상 강함이 의도** · **직업 추가는 오너만**(해머 직업은 Codex 담당) · 협동 알바는 2~4인 파티 필수, 보상 하루 1회·재도전 가능 · 레이드던전(구 차원 균열)은 게이지 ≈6분 + 보스 ≤3분.
- 이름 접두어는 **고유 효과가 있는 전설·유니크·세트만**. 큰 창은 별도 창, 작은 정보창만 패널/폰 안. 열린 설정 질문(오래된 주문을 깨운 존재, 도톨/갈피, 일곱 별 표식, 리나의 부모)은 건드리지 않음.
- 에이전트 워크트리는 `origin/main`(오래된 백업 push)에서 시작하므로 **브리프 첫 단계를 `git rebase main`** 으로.
- (이 PC의 Claude 메모리 폴더 `C:\Users\mankyu\.claude\projects\C--Users-mankyu-Desktop-Tales-Tales\memory\` 안의 6개 메모가 위 내용과 같습니다. 같은 PC·같은 윈도우 사용자면 새 계정도 그대로 읽습니다. 다른 PC면 이 파일의 §3이 대신합니다.)

## 4. 지금 상태 (2026-11-16 밤)

- 테스트 **65/65**, 데이터 검사 통과, 저장 시트 **v27**. 이번 라운드에 들어간 것: 아이템 레벨·유니크·접두사 95종 중 52종·아이템도감(Shift+I)·창 분리/반투명·도움말 15주제와 `<Guide>` 채팅 안내 87개·레이드던전 개명·장날(화·토 19–21시, 상인 6명)·P9~P12 외형·**스마트폰 메뉴 UI**(키 Backquote ₩, 설정에서 옛 패널로 전환 가능).
- **Codex에게 넘긴 작업**(`ai/TASKS.md` CODEX 섹션, 오너가 Codex에 프롬프트 전달함): W5 추가 컨텐츠 기획 · W1 보조 옵션 3분류 · **W2 인챈트 스크롤·지선·추출의 마법망치** · W3-A 공격형 접두사 구현 · W4 밸런스. Claude는 **결과를 병합하고 테스트**하는 역할(브랜치 `codex/*`, `.work/codex`). Codex가 `codex/rune-sockets`(세트 → 소켓 룬 세트)도 진행 중일 수 있어 병합 시 q4 세트·`v`(27) 숫자·`itemlevel/wardrobe` 테스트 충돌에 주의.
- **오너 결정 대기:** Q3 후반 메인 퀘스트 처치 수 조정 · Q4 파티가 필요한 서브퀘스트 · Q7 Lv.200 이후 목표(`docs/design/content-audit-2026-11-16.md` §3) · 추출 시 장비 파괴 vs 희귀 강등(기본 강등) · 장날·인챈트 가격 표 · 폰 단축키/위치.
- 알려진 작은 문제는 `ai/HANDOFF.md` §5 참고.

## 5. MCP / 도구 (정리됨)

- 이 PC·계정에서 **끈 것(2026-11-16)**: 사용자 서버 `summer-engine` `pixellab` `blender` 제거, 플러그인 서버 `github` `fullstory` `claude-mem` 비활성, 계정 커넥터 `Notion` `Higgsfield` `Claude Docs` 끔. 백업: `C:\Users\mankyu\.claude-backups\claude.json.2026-11-16.bak`, `settings.json.2026-11-16.bak`.
- **유지:** `codebase-memory-mcp`(코드 그래프, AGENTS.md 토큰 규칙 0번 — **오너가 적극 사용하길 원함**, 지금까지는 대화 기록 228개 중 3곳에서만 쓰임), Claude Code 기본 도구, 앱 내장 브라우저(`mcp__Claude_Browser__*`), 시각화 도구.
- 되돌리려면(필요할 때만): `claude mcp add …`로 다시 등록하거나 백업 파일에서 해당 항목을 복사, `claude plugin enable github@claude-plugins-official` 등.
- **새 계정에서는** 위 정리가 적용되지 않을 수 있습니다(계정 커넥터는 계정별). 새 계정의 설정 > 커넥터에서 Notion·Higgsfield 등을 끄세요 — 매 턴 읽는 도구 목록이 줄어 토큰이 절약됩니다(약 5%).
- 전역 지침 `C:\Users\mankyu\.claude\CLAUDE.md`(gstack, graphify)는 같은 PC면 그대로 적용됩니다. 프로젝트 지침은 저장소의 `CLAUDE.md`/`AGENTS.md`.

## 6. 새 계정 첫 30분 체크리스트

1. 폴더 열기 → `git status`(깨끗해야 함; `.claude/launch.json`, `.wrangler/`, `Intro.mp4` 등은 추적 안 되는 로컬 파일) → `git log -5`.
2. `cd game && node scripts/test-all.mjs` 한 번(65/65 확인; `maps`는 부하에서 흔들리면 단독 재실행).
3. `ai/HANDOFF.md` §4의 Codex 작업 상태를 `ai/TASKS.md`·`git branch --list "codex/*"`로 확인 → 병합할 브랜치가 있으면 `ai/merge.md` 절차로(병합 → `npm run build:logic` → 전체 테스트 1번 → `data:check`).
4. 없으면 오너에게 §4의 결정 대기 항목 중 하나를 물어서 다음 일을 정하기.
