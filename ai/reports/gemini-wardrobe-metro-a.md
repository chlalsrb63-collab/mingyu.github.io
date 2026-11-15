# 외형 장비 작업 보고서 — 메트로 스트리트 (A. 등 외형 3종)

## 1. 작업 개요
- **브랜치 / 작업 트리**: `gemini/work` (`.work/gemini`)
- **테마**: **메트로 스트리트 (Metro Streetwear — 현대 의상 컨셉)** — 앞선 작업(`windlantern`, `porcelain`, `neon_repair`, `crystal_delver`, `oasis_night`, `ferry`, `snow`)과 테마·실루엣·ID가 겹치지 않도록 현대 도심 스트리트웨어 감성(차콜 립스톱 나일론 · 스톤 크림 개버딘 · 네온 코랄 스트랩 · 라임 리플렉티브 띠 · 클리어 하늘 아크릴 & 크롬)으로 구성.
- **범위**: `game/public/wardrobe_metro_back.js`에 64×64 네이티브(`0.5` 논리 간격) 등 외형 3종 + `BACK_FRONT` + 16×16 가방 아이콘을 독립 초안으로 구현. 공용 `wardrobe.js` 및 `game/src/logic/**`는 수정하지 않음.

## 2. 제작 품목 (3종)

| 영문 ID | 한국어 이름 | 슬롯 / 종류 | 재질 · 팔레트 | 실루엣 · 착용 특징 | 획득 경로 제안 |
| --- | --- | --- | --- | --- | --- |
| `back_metro_rolltop` | 메트로 롤톱 백팩 | `back` / 가방 1종 | 차콜 나일론(`#354054`/`#546480`/`#1e2532`), 스톤 크림(`#eae5db`), 네온 코랄 버클(`#ff6648`), 라임 반사 띠(`#c8f254`) | 상단 롤톱 접힘, 세로 2줄 코브라 스트랩, 옆면 보틀 포켓, 앞모습 가슴 스트랩 버클(`BACK_FRONT`)로 도시 메신저 감성 구현 | 네온시티/상점 외형 도안 (18,000 골드 또는 버드나무 토큰 60개) |
| `back_metro_windcape` | 어반 리플렉티브 윈드케이프 | `back` / 망토 1종 | 스톤 크림 스톰 요크(`#eae5db`), 차콜 나일론(`#354054`), 라임 반사 띠(`#c8f254`), 코랄 패치 | 앞면 하이넥 집업 칼라(`BACK_FRONT`) 고정, 뒷면 중앙 깊은 V트임(`15..17`)으로 모든 꼬리 겹침 회피, 보행 컷에서 좌우 폭 확장 펄럭임 | 네온시티 패션 상점 (24,000 골드 또는 버드나무 토큰 80개) |
| `back_metro_acrylwings` | 어반 아크릴 팝윙 | `back` / 날개 1종 | 브러시드 크롬(`#d8e0ec`/`#8b96ae`), 클리어 하늘 아크릴(`#70dcff`/`#ddf8ff`), 코랄 스트리트 태그(`#ff6648`), 라임 힌지 | 양 어깨(`11.5..13`, `19..20.5`) 힌지 고정. 정지 컷은 하향 접힘으로 뒷모습 머리·귀·꼬리 보존, 보행 컷은 부채꼴로 넓게 펼쳐짐 | 네온시티 / 보스 전리품 외형 (버드나무 토큰 110개) |

## 3. 반영 대상 및 산출물 경로
- **코드 모듈 (커밋 포함)**: [`game/public/wardrobe_metro_back.js`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe_metro_back.js)
  - 통합 시 `game/src/logic/65-cosmetics.js`의 `COSMETIC_SETS`(`metro: "메트로 스트리트"`) 및 `COSMETICS`(권장 코드 `124..126`) 추가 후 `npm run build:logic` 실행.
  - `game/public/wardrobe.js`의 `BACK`, `BACK_FRONT`, `ART`, `HARD_BACKS`, `FEATHER_BACKS`에 병합.
- **정규화 16×16 가방 아이콘 (미설치 시안, `import-art.mjs` 통과)**:
  - `asset/generated/metro-back/icon_back_metro_{rolltop,windcape,acrylwings}.png` 및 `*.prompt.md`
  - 색상 수 `8~10색` (`<= 16`), `0 specks cleaned`, `#111118` 외곽선 유지.
- **출처 기록**: [`asset/CREDITS.md`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/CREDITS.md)
- **로컬 미리보기 PNG (비추적 `game/shots/`)**:
  - [`gemini-wardrobe-metro-a-wear.png`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-wardrobe-metro-a-wear.png) — 4종족(고양이·토끼·개구리·뿔 사슴) × 앞/옆/뒤 × 정지/보행(`2×` 및 `1×` 실제 배율)
  - [`gemini-wardrobe-metro-a-icons.png`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-wardrobe-metro-a-icons.png) — 16×16 아이콘(`1×` 슬롯 · `6×` 컬러 · `4×` 명도/실루엣)

## 4. 착용 및 검수 결과
- `node --check game/public/wardrobe_metro_back.js`: 통과.
- `import-art.mjs --size 16x16 --colors 16 --outline keep`: 3종 모두 `0 specks cleaned`로 통과.
- **64×64 착용 검수**:
  - 1차 검수에서 옆모습(`SIDE0`/`SIDE W2`)의 배낭·망토·정지 날개가 꼬리/몸통에 일부 가리던 점을 수정해, 옆모습 위치를 `x=4.5~7.0` 뒤쪽으로 이동하고 상단 롤톱/칼라/힌지를 높여 전 방향 시인성을 확보함.
  - 고양이·토끼(긴 귀/솜꼬리)·개구리(눈 혹)·뿔 사슴(큰 뿔/꼬리)의 뒷모습과 보행 컷(`BACK W2`)에서 머리·귀·뿔·꼬리가 가리지 않고 정상 분리됨을 `2×`/`1×` 모두 확인.

진행한 순서: 메트로 스트리트 A. 등 외형 3종 완료 / 다음 순서: 메트로 스트리트 B. 상의 3종
