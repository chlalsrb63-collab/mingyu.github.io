# 작업 구역표 (LANES) — Claude · Codex · Antigravity(Gemini) 동시 개발

모든 AI가 **한 개의 개발 빌드**에 합쳐지도록 하는 교통 규칙입니다. 작업 시작 전에 이 표를 읽고, 끝나면 보고서에 만진 파일을 적으세요.
(owner 2026-11-19: "모든 개발 사항이 서로 충돌하지 않고 동일한 개발 빌드 내에서 함께 적용")

## 1. 하나의 빌드

- **통합 브랜치는 `main` 하나.** 오너가 플레이하는 로컬 플레이 서버(8830, 폴더 `tt-play-current`)는 항상 `main`의 최신 통합 커밋입니다.
- **`main`에는 Claude(통합 담당)만 커밋/병합합니다.** 다른 AI는 자기 브랜치에만 커밋합니다.
- 합치는 순서: 각 AI 브랜치 커밋 → Claude가 통합 폴더(`tt-integ`, 브랜치 `integ/<날짜>`)에서 병합·충돌 해결·전체 테스트 → `main` → 8830 반영.
- 로컬 우선(owner 2026-11-17): push·배포 금지. 온라인 빌드 파일은 건드리지 않습니다.

## 2. 폴더와 브랜치 (서로의 폴더는 절대 만지지 않기)

| 누구 | 폴더 | 브랜치 |
| --- | --- | --- |
| Claude (통합) | `Desktop/tt-main` | `main` |
| Claude (병합 작업) | `Desktop/tt-integ` | `integ/<날짜>` |
| 플레이 서버 | `Desktop/tt-play-current` | main 커밋에 detached (Claude만 이동) |
| Codex | `Desktop/Tales Tales` 또는 `~/.codex/worktrees/*`, `.work/codex` | `codex/<주제>` |
| Antigravity (Gemini) | `Desktop/Tales Tales/.work/gemini` | `gemini/work` |

- 남의 폴더에서 `checkout`·`stash`·`reset`·커밋 금지. 서버는 자기 포트만(8787·8830은 오너 것).

## 3. 지금의 구역 (파일 소유) — 2026-11-19

| 구역 | 주인 | 파일 |
| --- | --- | --- |
| 레이드(필드 레이드 4종·레이드 키·레이드 앱) | Claude | `src/logic/31-raids-field.js` `31-maps-dim.js` `64-dim.js`, `public/dimrift.js`, `tests/dimrift.mjs` |
| 대화 연출·카메라 | Claude | `public/talkcam.js`, `scene_view.js`(줌) |
| 마을 아트(소품·나무·건물·지형) | Claude | `public/decor.js`(town), `scene_props.js`(나무), `iso_tall.js`(마을 집), `src/logic/34-maps-world.js` |
| 알바 미니게임 화면 | Claude | `public/alba*.js` `alba_stage.js` |
| 스킬 이펙트·장비 아이콘 | Codex | `public/skillpfx*.js` `skillfx*.js` `pfx/`, 아이콘 |
| 근접 타격감·몬스터 이름 | Codex | `swing.js` 등 전투 연출, 도감 |
| 버드나무 마을(한옥·알바 작업장) | Codex | `data/maps/willow.json`, `public/iso_alba.js`, `src/logic/59-chores.js` `66-alba.js` |
| 효과음 | Antigravity | `public/audio.js`(소리 정의), 각 파일의 `Sound.play` 이름 |
| 무기 외형·의상 시안 | Antigravity | `public/weapons_*_collection.js`, 의상 시안 |

**함께 쓰는 뜨거운 파일** — 고칠 때는 작은 덩어리로만, 보고서에 꼭 적기:
`audio.js` `iso_tall.js` `decor.js` `dimrift.js` `hud.css` `index.html` `actions.js` `overlay.js` `src/logic/64-dim.js` `src/logic/66-alba.js`.

## 4. 규칙

1. **새 작업은 최신 `main`에서 시작합니다.** 자기 브랜치가 깨끗하면 `git merge main`(또는 rebase)부터. 오래된 브랜치(main보다 수백 커밋 뒤)는 충돌이 커집니다.
2. 남의 구역 파일이 필요하면: 아주 작게 고치고 보고서에 "구역 밖 수정: 파일·이유"를 적습니다. 큰 변경이면 `ai/TASKS.md`에 제안만 남깁니다.
3. `game/src/logic.js`는 생성 파일: 손으로 고치거나 손으로 병합하지 말고 `npm run build:logic`.
4. 끝날 때: `ai/reports/<ai>-<주제>.md`(만진 파일, 테스트 결과) + 커밋. Claude가 다음 통합 때 가져갑니다.
5. 같은 기능을 두 AI가 동시에 하지 않기: 시작 전에 이 표와 `ai/TASKS.md`를 확인하고, 새 구역은 표에 한 줄 추가 제안.
