# 테일즈테일즈 개발 현황 인수인계

## 현재 작업 기준

- 오너용 [개발 현황판](../docs/development-status.html)은 네트워크 없이 여는 단일 HTML입니다. 기능 ID, 구현 상태, 원본 경로와 검증 명령, 등록 맵 정보를 제공합니다.
- 기준은 `codex/appearance-polish`의 게임 코드 `5ae8cdc`입니다. 작업 폴더는 `C:\Users\mankyu\.codex\worktrees\item-content-plan\Tales Tales`, 확인한 서버는 `http://127.0.0.1:8789/`입니다.
- `C:\Users\mankyu\Desktop\Tales Tales`는 `main` 체크아웃입니다. 이번 확인 시 솔로 알바 관련 미커밋 변경이 있었으므로, 인계받으면 두 폴더에서 각각 `git status --short -b`와 `git log -1 --oneline`을 확인하세요. 오너의 작업을 덮어쓰거나 서로 다른 체크아웃의 상태를 혼용하지 마세요.
- [공통 규칙](../AGENTS.md)과 [파일 지도](../docs/FILEMAP.md)를 우선 읽습니다. [이전 인수인계](HANDOFF.md)에는 시점별 설계와 작업 이력이 있습니다. 실행 서버·브랜치·검증 수치는 이 페이지에 적힌 기준 커밋과 함께 읽으세요.

## 기능 ID와 수정 위치

| 현황판 ID | 먼저 열 파일 | 검증 |
| --- | --- | --- |
| W01–W06 월드·NPC·연출 | `game/src/logic/34-maps-world.js`, `36-custom-maps.js`, `game/data/maps/`, `game/data/links.json`, `game/data/npcs.json`, `game/data/npclife.json`, `game/public/scene2d.js`, `radar.js` | `maps mapflow worldmap npclife npclife-client airship` |
| C01–C07 협동 알바 | `game/src/logic/12-life-tables.js`의 `COOP_KINDS`·`COOP.*.tpl`, `68-coop.js`의 진입·역할·보상, `game/public/coop.js`, `coop-briefing.js` | `coop buddy` 및 격리 서버에서 역할별 단계 확인 |
| L01 솔로 알바 | `game/src/logic/66-alba.js`, `67-alba-<id>.js`, `game/public/alba.js`, `alba_<id>.js`, `game/tests/alba-<id>.mjs` | `alba`와 해당 게임 테스트. [명세](../docs/design/daily-alba-minigames-2026-11-16.md) 참고 |
| L02–L04 생활·장날·하우징 | `game/src/logic/12-life-tables.js`, `58-life.js`, `64-fair-market.js`, `64-housing.js`, `game/public/gather.js`, `station.js`, `housing.js` | `life lifeskills fairmkt festival housing` |
| B01–B05 직업·전투·사냥 | `game/src/logic/02-jobs-stats.js`, `03-skills.js`, `13-element-data.js`, `49-element-engine.js`, `50-loot-combat.js`, `57-weapon-skills.js`, `64-dim.js`, `game/public/skillfx.js` | `jobs skills combos element-combat dimrift` |
| I01–I05 장비·룬·참 | `game/src/logic/10-tables.js`, `11-rune-stock.js`, `50-loot-combat.js`, `52-rune-stock.js`, `52-rune-sets.js`, `66-charms.js`, `game/public/items.js`, `dex.js`, `charms.js` | `loot itemlevel rune-sockets socket-stone-quest rune-powers charms` |
| A01–A04 플레이어·미디어 | `game/public/species.js`, `person_pixels.js`, `sprites.js`, `looks.js`, `wardrobe.js`, `weapons.js`, `audio.js`, `lobby.js`, `game/public/assets/` | `looks person64 wardrobe cosmetics bgm-recordings` |
| S01–S05 짝꿍·교류·운영 | `game/src/logic/69-buddy.js`, `69-social-play.js`, `62-side-quests.js`, `game/src/room.ts`, `accounts.js`, `game/public/buddy.js`, `phone.js`, `net.js`, `update.js` | `buddy party social accounts sidequests`와 격리 브라우저 |

`game/src/logic.js`와 `game/public/_maps.json`은 생성물입니다. 규칙은 `game/src/logic/`와 `game/data/`에서 변경한 뒤 `game/`에서 `npm run build:logic`을 실행합니다. `node scripts/test-all.mjs <이름...>`은 위 표의 테스트 이름을 받습니다.

## 혼용하기 쉬운 현재 상태

- **협동 5종**은 동동아파트·쥬쥬식당·캉캉대장간·보글연금공방·올빼미 도서관입니다. `game/data/maps/<id>.json`은 입장 전 맵이고 **실제 근무 맵**은 `COOP.<kind>.tpl`입니다. 실측 정의는 각각 44×27, 32×24, 32×22, 32×22, 32×29 타일입니다. `pipe`는 솔로에 구현돼 있고 현재 협동 목록에서는 거절됩니다.
- **솔로 12종**과 협동 5종의 보상 처리는 별개입니다. 협동은 종목별 하루 1회 보수와 무보상 반복, 짝꿍 참여 시 실제 플레이어 쪽 정산을 확인하세요.
- **캐릭터**는 64×64 프레임을 사용합니다. 기본 몸체는 32격자에서 시작하고 뒷꼬리 12종은 `person_pixels.js` 안의 64격자 직접 도안입니다. `sprites.js`에서 포즈를 처음 읽을 때 그립니다. 이전의 32 기준 윤곽 비교는 뒤쪽은 꼬리를 뺀 몸체로 검사합니다.
- **오프닝 영상**은 체크인된 `game/public/assets/intro/studio-goguma.mp4`입니다. BGM은 `game/public/audio.js`의 녹음 매핑과 각 로컬 폴더의 `game/public/assets/music/` 실파일을 함께 확인합니다. 이 작업 폴더에는 `18.dawn sea.mp3`가 확인되었습니다. 다른 트랙의 매핑 테스트는 실제 음원 파일 존재와 별개입니다.
- **인챈트·접두사 추출**은 [아이템 명세](../docs/design/item-system-spec-2026-11-16.md) §3.3–3.4의 설계입니다. 이미 들어간 룬 천공석·세트 룬·속성 옵션과 구분하세요.
- **최적화 확인**은 `5ae8cdc`에서 84/84 테스트, 43명 모의 서버 결과 해시 일치, 외형 144장 픽셀 일치까지입니다. `game/scripts/client-prof.mjs`와 `bench-tick.mjs`를 다시 쓸 수 있습니다. 서버 해시는 `--spikes` 포함 여부를 맞춰 비교하세요.

## 로컬 경로와 복원

- `game/.wrangler/`는 계정·캐릭터·로컬 서버 상태입니다. `game/public/assets/music/`는 로컬 음원, `.codex-attachments/`는 첨부 레퍼런스, `game/shots/`는 미리보기·기존 인트로 페이지·검증 자료입니다. 와이파이 플레이 폴더와 테스트 저장소는 [로컬 실행 가이드](../docs/LOCAL_SETUP.md)에서 구분합니다.
- `game/public - 바로 가기.lnk`는 이 워크트리가 아닌 바탕화면의 `main` 체크아웃 `game/public/`을 여는 Windows 바로가기입니다. 워크트리 작업에서는 `game/public/` 폴더를 직접 여세요.
- `game/shots-archive/2026-11-18-qa/`에 종료된 외형·성능 QA 산출물 30개를 보관했습니다. 폴더 24개와 파일 6개, 약 47.2 MiB입니다. `restore-manifest.json`의 `archive`와 `original`을 매핑해 필요한 항목만 돌려놓으세요. 실행 중인 서버의 상태 폴더는 정리 대상에서 제외했습니다. 이 보관함은 로컬 전용입니다.
- 테스트는 다른 포트와 별도 `--persist-to` 경로에서 실행합니다. 오너가 플레이하는 서버를 재시작하거나 `main`·온라인 빌드에 자동 반영하지 않습니다.

## 현황판 갱신

1. 게임 변경을 검증한 커밋에서 `cd game` → `npm run check:split` → `node scripts/dev-status.mjs`를 실행합니다. 생성기는 등록 수치와 맵 목록을 현재 `defs()` 및 `atlas()`에서 읽어 HTML에 넣습니다. `node scripts/dev-status.mjs --check`로 일치 여부를 확인할 수 있습니다.
2. `docs/development-status.html`의 해당 카드에서 상태·플레이 범위·검증 기록을 근거에 맞춰 갱신합니다. 상태는 구현됨·확인 필요·비활성·설계 단계이며, 기존 카드 ID는 오너가 보내는 지시 번호로 사용합니다.
3. Claude와 Gemini는 오너가 지정한 카드 ID와 같은 경로 표를 읽고, 최신 커밋과 변경된 파일만 확인한 뒤 작업합니다. 새 파일이나 경로 이동은 `docs/FILEMAP.md`에 기록합니다.
