# 테일즈테일즈 — 내 PC(Windows)에서 개발하기

Claude Code · OpenAI Codex CLI · Google Gemini CLI 세 AI가 같은 저장소에서 함께 일하는 환경을 만드는 안내입니다.
세 AI 모두 저장소 맨 위의 **`AGENTS.md`** 하나를 프로젝트 안내서로 읽습니다 (Claude는 `CLAUDE.md`, Gemini는 `GEMINI.md`를 통해).

> 명령어의 세부 옵션은 도구 버전에 따라 바뀔 수 있습니다. 안 되면 `<도구> --help`로 확인하세요.

---

## 1. 설치 (한 번만)

1. **Git for Windows** — https://git-scm.com/download/win (또는 PowerShell에서 `winget install Git.Git`)
2. **Node.js 22 LTS** — https://nodejs.org 에서 22.x LTS 설치 (또는 `winget install OpenJS.NodeJS.LTS`). 22 이상이면 됩니다.
3. 새 PowerShell 창을 열고 확인: `git --version`, `node -v`, `npm -v`

> PowerShell에서 `npm` 실행 시 "스크립트를 실행할 수 없습니다" 오류가 나면 한 번만:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

## 2. 내려받기와 실행

```powershell
git clone -b claude/topdown-2d-mmorpg-dev-jke7w3 https://github.com/chlalsrb63-collab/mingyu.github.io.git "C:\Users\mankyu\Desktop\Tales Tales"
cd "C:\Users\mankyu\Desktop\Tales Tales\game"
npm install
npm run dev:local
```

브라우저에서 **http://localhost:8787** 을 엽니다. 탭을 두 개 열면 두 명이 함께 노는 것을 볼 수 있습니다.
(로컬 계정·캐릭터는 `game\.wrangler\` 폴더에 저장됩니다. 지우면 처음부터 다시 시작합니다.)

다른 창에서:

```powershell
cd "C:\Users\mankyu\Desktop\Tales Tales\game"
npm run test:rules      # 규칙 테스트 15개 (약 10초). 전부 PASS면 OK
npm run check:split     # src/logic.js 가 조각 파일과 맞는지 확인
npm run watch:logic     # 서버 규칙(src/logic/*.js)을 고치는 동안 켜 두면 logic.js 를 자동으로 다시 만듦
```

### 스크린샷 도구 (선택)

AI가 화면을 확인할 때 쓰는 `scripts/shot.mjs` 는 브라우저가 필요합니다. 한 번만:

```powershell
npx playwright install chromium
```

(안 해도 PC에 설치된 Edge나 Chrome을 자동으로 씁니다.) 직접 미리보기 페이지를 보려면 `npm run preview` 후
http://127.0.0.1:5178/_scene.html?map=meadow 같은 주소를 엽니다.

## 3. 내 Cloudflare 계정에 배포하기

```powershell
cd "C:\Users\mankyu\Desktop\Tales Tales\game"
npx wrangler login      # 브라우저가 열리면 Cloudflare 계정으로 승인 (무료 계정 가능)
npm run deploy:cf       # 규칙 확인 + 테스트 후 배포
```

- 주소는 `https://lumentale-online.<내 하위도메인>.workers.dev` 가 됩니다 (`wrangler.deploy.jsonc`의 `"name"`).
- **무료 플랜**으로 됩니다. 채널·저장소에 쓰는 Durable Object는 SQLite 방식이라 무료 플랜에서 동작하고,
  `wrangler.deploy.jsonc`의 `migrations` (`v1`, `new_sqlite_classes: ["Room"]`)가 첫 배포 때 그것을 만듭니다.
  이 migrations 항목은 지우거나 고치지 마세요 (클래스 이름을 바꿀 일이 생기면 새 태그를 **추가**해야 합니다).
- **Higgsfield에 있던 계정·캐릭터는 옮겨지지 않습니다.** 새 Cloudflare 배포는 빈 저장소에서 시작합니다.
- GitHub에서 자동 배포: 저장소 Settings › Secrets and variables › Actions 에 `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID` 를 넣으면 이 브랜치에 push할 때마다 테스트 후 자동 배포됩니다.
- 참고: 게임 화면을 GitHub Pages 같은 다른 주소에서 열면 아직 Higgsfield 서버(`lumentale-online.higgsfield.app`)에
  접속합니다. Cloudflare로 완전히 옮길 때는 AI에게 "`public/client.js`와 `public/account.js`의 `LIVE_HOST`를
  내 workers.dev 주소로 바꿔 줘"라고 하세요. (workers.dev 주소에서 직접 열면 이미 자기 서버에 접속합니다.)

## 4. AI 도구 설치

| 도구 | 설치 | 실행 (게임 폴더에서) | 로그인 | 한 번에 시키기 (비대화형) |
| --- | --- | --- | --- | --- |
| **Claude Code** | 데스크톱 앱에서 폴더 열기, 또는 `npm i -g @anthropic-ai/claude-code` | `claude` | Anthropic 계정 | `claude -p "…"` |
| **Codex CLI** | `npm i -g @openai/codex` | `codex` | ChatGPT 계정으로 로그인 | `codex exec "…"` |
| **Gemini CLI** | `npm i -g @google/gemini-cli` | `gemini` | Google 계정으로 로그인 | `gemini -p "…"` |

세 도구 모두 **저장소 맨 위 폴더**(`C:\Users\mankyu\Desktop\Tales Tales`)에서 실행하세요. 그래야 `AGENTS.md`를 읽습니다.
Codex는 Windows에서 일부 기능이 실험적일 수 있습니다. 문제가 있으면 WSL(Ubuntu)에서 실행하세요.

---

## 5. 세 AI 함께 쓰기

### 역할 나누기 (추천)

| AI | 잘 맡는 일 |
| --- | --- |
| **Claude** | 설계, 여러 파일에 걸친 작업, 통합(merge)과 리뷰, 그림(픽셀아트) 작업, 다른 AI에게 일 나눠 주기 |
| **Codex** | 범위가 분명한 구현 + 테스트 작성 (예: 아이템 하나, 행동 하나, 버그 하나) |
| **Gemini** | 코드 전체를 넓게 읽고 분석, 밸런스 표·기획 문서, 한국어 콘텐츠(대사·설명·퀘스트 문구) 쓰기 |

### 브랜치 / 워크트리로 나눠 일하기

한 작업 폴더에서 두 AI가 동시에 고치면 서로 덮어씁니다. AI마다 **자기 폴더(워크트리)와 브랜치**를 줍니다.

```powershell
cd "C:\Users\mankyu\Desktop\Tales Tales"
git worktree add ..\tt-codex  -b codex/new-potion       # Codex 전용 폴더: C:\Users\mankyu\Desktop\tt-codex
git worktree add ..\tt-gemini -b gemini/balance-notes    # Gemini 전용 폴더
cd ..\tt-codex\game ; npm install                        # 워크트리마다 npm install 한 번
cd ..\ ; codex                                           # 그 폴더에서 Codex 실행
```

끝나면 (통합 담당 = 보통 Claude가 원래 폴더에서):

```powershell
cd "C:\Users\mankyu\Desktop\Tales Tales"
git diff claude/topdown-2d-mmorpg-dev-jke7w3...codex/new-potion   # 무엇이 바뀌었나 검토
git merge --no-ff codex/new-potion
cd game ; npm run test:rules ; cd ..
git push
git worktree remove ..\tt-codex ; git branch -d codex/new-potion
```

- 두 워크트리에서 동시에 서버를 켜려면 포트를 바꿉니다: `npx wrangler dev -c wrangler.local.jsonc --port 8788`
- `game/src/logic.js`가 충돌하면 손으로 고치지 말고 조각 파일(`src/logic/*.js`)의 충돌만 풀고 `npm run build:logic`.

### Claude가 다른 AI에게 일 시키기

Claude Code 안에서 이렇게 부탁하면 됩니다: *"Codex에게 워크트리 `..\tt-codex`에서 X를 구현하게 하고, 끝나면 diff를 검토해서 합쳐 줘."*
Claude는 터미널에서 다음처럼 실행하고 결과(diff, 테스트)를 검토합니다.

```powershell
cd ..\tt-codex ; codex exec "AGENTS.md를 읽고, …를 구현하고 node game/scripts/test-all.mjs 를 통과시켜. 커밋은 하지 마."
cd ..\tt-gemini ; gemini -p "AGENTS.md를 읽고 game/src/logic/10-tables.js 의 MOBS 를 분석해 … 표를 만들어 줘"
git -C ..\tt-codex diff
```

(파일을 고치도록 허용하는 옵션 — 예: Codex의 샌드박스/자동 승인, Gemini의 `--yolo` — 은 버전마다 다르니 `--help`로 확인하고, 꼭 워크트리 안에서만 쓰세요.)

### AI별 예시 요청

**Claude**
1. "AGENTS.md §8 '몬스터 추가' 순서대로 숲에 '이끼 뒤집힌 거북' 몬스터를 넣어 줘. 테스트 통과 후 `shot.mjs --page mobs` 한 장만 확인."
2. "Codex 브랜치 `codex/new-potion`의 diff를 리뷰하고, 문제 없으면 합치고 push 해 줘."
3. "균열 침공 이벤트에 '정예 웨이브'를 추가하는 설계를 먼저 제안해 줘. 어떤 파일의 어떤 함수를 바꿀지만."
4. "`game/assets/incoming/`에 받은 타일 팩에서 숲 바닥에 맞는 것을 골라 CREDITS.md에 적고 assetlib로 연결해 줘. 코드 그림은 대체용으로 남기고."
5. "다음 작업 3개를 Codex와 Gemini에게 나눠 맡기고 각자 워크트리에서 진행시켜 줘: …"
6. "캐릭터 창(C)의 능력치 줄 간격이 좁아. `shot.mjs --live --keys c` 로 확인하고 hud.css만 고쳐 줘."

**Codex**
1. "AGENTS.md를 읽어. `src/logic/10-tables.js` ITEMS에 '해독제'(중독 해제, 30G)를 추가하고 상점에 넣고, `70-validate.js`/`75-apply.js`의 use 처리와 tests/growth.mjs 테스트를 추가해. `npm run test:rules` 통과까지."
2. "`tests/loot.mjs`에 전설 장비 드랍률이 정예에서 더 높은지 검사하는 테스트를 추가해. 규칙은 고치지 마."
3. "파티 초대가 다른 맵에 있는 사람에게도 가는지 tests/party.mjs에 테스트를 먼저 쓰고, 틀리면 규칙을 고쳐."
4. "새 행동 `t: \"gnotice\"` (길드 공지, 40자, 길드장만) 을 validate/apply와 selfPayload에 추가하고 테스트해."
5. "`game/src/logic/55-class-skills.js` 의 `castSkill`에서 중복된 범위 계산을 helper로 정리해. 동작은 바꾸지 말고 테스트로 확인."
6. "`npm run typecheck` 오류를 고쳐. `src/*.ts`만."

**Gemini**
1. "AGENTS.md와 game/src/logic/ 전체를 읽고, 레벨 1–50 구간별 '몬스터 레벨 · 경험치 · 골드' 표를 docs/balance.md로 만들어 줘. 코드는 고치지 마."
2. "QUESTS와 NPC 대사(public/npctalk.js)를 읽고, 세계관에 맞는 새 퀘스트 10개 문구(한국어 제목·본문)를 제안해 줘."
3. "몬스터 25종의 이름·컨셉을 정리하고, 겹치는 느낌이 나는 것과 새로 넣을 만한 지옥풍 동물 5종을 제안해 줘."
4. "game/public 전체를 훑어보고 AGENTS.md 파일 지도에서 틀린 줄이 있으면 고칠 목록을 알려 줘."
5. "업적 ACH 목록을 읽고, 플레이 시간 대비 너무 쉬운/어려운 업적을 표로 정리해 줘."
6. "강화 확률 ENH_RATE와 강화석 가격으로 +10까지 기대 비용을 계산해 줘."

### 토큰 아끼는 습관

- 요청에 **AGENTS.md의 절 번호와 정확한 파일·함수 이름**을 적습니다 ("§8 레시피대로, `10-tables.js`의 `MOBS`에").
  AI가 저장소를 처음부터 다시 훑지 않습니다.
- 확인은 **테스트로**: "스크린샷 말고 `npm run test:rules`로 확인해". 그림 작업일 때만 "`shot.mjs`로 **한 장만**".
- **한 세션에 한 작업.** 끝나면 Claude Code는 `/clear`, Codex·Gemini는 새로 시작합니다.
- 큰 파일(`src/logic.js`, `public/client.js`, `public/scene2d.js`, `public/sprites.js`)은 통째로 읽지 말라고 해 두세요
  (AGENTS.md에 이미 적혀 있습니다). `src/logic.js`는 자동 생성 파일이라 고치면 안 됩니다.
- 긴 분석(밸런스, 전체 리뷰)은 Gemini에게, 범위가 좁은 구현은 Codex에게 맡기면 Claude의 토큰을 아낄 수 있습니다.
