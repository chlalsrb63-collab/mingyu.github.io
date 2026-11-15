# 바람등호 기관반 외형 장비 제작 보고서 — A. 등 외형 3종 (`windlantern-back`)

## 1. 테마 및 순서 개요
- **선택 테마**: **바람등호 기관반 (`windlantern`)** — 기존 [wardrobe.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe.js) 및 [weapons.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/weapons.js)의 기존 등록명(`coral_*`, `maple_*`, `brass_survey`, `back_lantern`)과 겹치지 않는 비공정 기관실 테마.
- **완료 범위**: **A. 등 외형 3종** (가방 1종 + 망토 1종 + 날개 1종) — 각 64×64 네이티브 착용 레이어(`0.5` 논리 좌표) + 16×16 가방 아이콘 완료. 상점·드랍·저장 규칙 미수정.

## 2. 품목 명세 및 획득·적용 제안

| 영문 ID (`code`) | 한국어 이름 | 슬롯 / 세부 분류 | 재질 · 핵심 팔레트 | 획득 경로 제안 (골드/버드나무토큰/보스) | 실제 적용 파일 |
| --- | --- | --- | --- | --- | --- |
| `back_windlantern_boilerpack` (`121`) | 바람등호 압력공구 배낭 | `back` · 가방 | 그을린 철·먹색 가죽(`#423e4c`, `#686376`, `#25222d`), 황동 압력밸브/스패너(`#d89a38`, `#98641e`, `#f6cc68`), 돛천(`#eee6d4`, `#b8ac98`), 금색 등불 게이지(`#ff9c2a`, `#fff29c`), 외곽선(`#2b2233`) | 버드나무토큰 4개 (`shop: 4`) 또는 바람등호 선창 잡화상(골드) | `game/src/logic/65-cosmetics.js`, `game/public/wardrobe.js`, `game/public/art.js` |
| `back_windlantern_ashcape` (`122`) | 바람등호 방풍 불티망토 | `back` · 망토 | 돛천 어깻깃(`#eee6d4`, `#b8ac98`), 그을린 방풍 천(`#423e4c`, `#25222d`), 황동 리벳 걸쇠(`#d89a38`, `#98641e`), 금색 불티띠(`#ff9c2a`, `#fff29c`), 외곽선(`#2b2233`) | 버드나무토큰 5개 (`shop: 5`) | `game/src/logic/65-cosmetics.js`, `game/public/wardrobe.js`, `game/public/art.js` |
| `back_windlantern_gliderwings` (`123`) | 바람등호 돛날개 | `back` · 날개 | 그을린 철/황동 관절 프레임(`#423e4c`, `#686376`, `#d89a38`, `#f6cc68`), 팽팽한 흰 돛천(`#eee6d4`, `#b8ac98`), 날개끝 등불 비콘(`#ff9c2a`, `#fff29c`), 외곽선(`#2b2233`) | 버드나무토큰 6개 또는 바람등호 공중선 필드 보스 드랍 (`shop: 6, boss: true`) | `game/src/logic/65-cosmetics.js`, `game/public/wardrobe.js`, `game/public/art.js` |

## 3. 산출물 및 비교 PNG 경로
- **전용 드롭인 코드 모듈 (`node --check` 통과)**:
  - [wardrobe_windlantern_back.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe_windlantern_back.js) (`WINDLANTERN_SET`, `WINDLANTERN_BACK_COSMETICS`, `WINDLANTERN_PALETTE`, `WINDLANTERN_BACK`, `WINDLANTERN_BACK_FRONT`, `WINDLANTERN_BACK_ART`, `WINDLANTERN_BACK_ICONS`)
- **대표 비교 PNG (2장)**:
  1. **종족·방향·동작별 착용 비교 시트 (`2×` 확대 + `1×` 실제 크기)**:
     - [gemini-wardrobe-windlantern-a-wear.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-wardrobe-windlantern-a-wear.png)
     - 고양이(`sp=0`), 여우(`sp=4`), 다람쥐(`sp=13`) 3개 유미(꼬리) 종족 × 정면(`f=0,2`)·측면(`f=0,2,4`)·후면(`f=0,2,4`) 검증.
  2. **16×16 가방 아이콘 비교 (`1×`/`5×` 컬러·흑백·단색 실루엣) + 64×64 휴식·보행 레이어 컷**:
     - [gemini-wardrobe-windlantern-a-icons.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-wardrobe-windlantern-a-icons.png)
- **`asset/generated/windlantern-back/` 보관본 (`.prompt.md` 동반, `--install` 미실행)**:
  - 64×64 레이어 3종: [back_windlantern_boilerpack.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/windlantern-back/back_windlantern_boilerpack.png), [back_windlantern_ashcape.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/windlantern-back/back_windlantern_ashcape.png), [back_windlantern_gliderwings.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/windlantern-back/back_windlantern_gliderwings.png)
  - 16×16 정규화 아이콘 3종: [icon_back_windlantern_boilerpack.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/windlantern-back/icon_back_windlantern_boilerpack.png) (11색), [icon_back_windlantern_ashcape.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/windlantern-back/icon_back_windlantern_ashcape.png) (10색), [icon_back_windlantern_gliderwings.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/windlantern-back/icon_back_windlantern_gliderwings.png) (8색)

## 4. 착용 및 아이콘 검수 결과
- **`back_windlantern_boilerpack` (가방)**:
  - 후면·측면에서 상단 말아 묶은 돛천 롤, 좌상단 돌출 황동 스패너, 우측 발광 암버 압력 등불 게이지가 기관공 정체성을 선명하게 드러내며 정면에서는 `BACK_FRONT` 이중 어깨끈과 버클만 노출됩니다. 꼬리 하단 영역(`y >= A.foot - 1`)과 겹치지 않도록 팩 하단을 정리했습니다.
- **`back_windlantern_ashcape` (망토)**:
  - `BACK_FRONT`의 흰 돛천 어깻깃+이중 황동 리벳 핀으로 어깨 고정점을 잡고, 후면 하단 중앙을 V자형으로 터 주어 대기(`f=0`), 보행(`f=2`), 반대 발 내딛기/흔들기(`f=4`) 어느 컷에서도 꼬리 밑동·끝점이 가려지지 않음을 확인했습니다. 측면에서도 폭을 `x=10..13.5`로 절제해 다람쥐·여우의 말린 꼬리와 충돌하지 않습니다.
- **`back_windlantern_gliderwings` (날개)**:
  - 휴식 상태(`f=0,3`)에서는 양 날개가 어깨에서 아래 45°로 접혀 내려가 뒷모습의 머리·귀·꼬리가 완전히 읽히며, 보행 상태(`f=1,2,4`)에서는 돛날개가 위·바깥쪽으로 활짝 펼쳐지며 양 날개끝 위치가 뚜렷하게 변화하고 어깨 관절 뿌리(`11.5..13, 19..20.5`)는 몸통에 견고히 고정됩니다.
- **16×16 가방 아이콘 판독성**:
  - 배낭(사각 압력통+돌출 스패너+원형 등불창), 망토(넓은 돛천 깃+갈라진 이단 밑단), 날개(V자 대칭 돛틀)가 컬러·흑백·단색 실루엣 1× 배율에서 모두 명확히 구별되며 외톨이 픽셀 0건입니다.
- **적용 순서 (공용 파일 미수정 상태)**:
  1. `game/src/logic/65-cosmetics.js`에 `WINDLANTERN_SET`, `WINDLANTERN_BACK_COSMETICS` 등록 후 `npm run build:logic`.
  2. `game/public/wardrobe.js`의 `BACK`, `BACK_FRONT`, `ART`에 [wardrobe_windlantern_back.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe_windlantern_back.js) 병합 (`windlanternPack`→`HARD_BACKS`, `windlanternWings`→`FEATHER_BACKS` 등록 검토).
  3. `node --check game/public/wardrobe.js`, `node game/scripts/cos-audit.mjs --slot back`, `node game/scripts/test-all.mjs cosmetics person64` 실행.

진행한 순서: 바람등호 기관반 — A. 등 외형 3종 완료 / 다음 순서: 바람등호 기관반 — B. 상의 3종
