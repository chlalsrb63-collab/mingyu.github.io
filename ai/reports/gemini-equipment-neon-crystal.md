# 잿빛 네온시티 수리반 · 수정굴 탐사대 방어구 아이콘 6종 제작 보고서 (`neon-crystal`)

## 1. 작업 묶음 개요
- **선택한 순환 번호**: **2번** (`2. 방어구 아이콘 6종. 잿빛 네온시티 수리반의 가죽·철판과 수정굴 탐사대의 보호 장구. 두 테마마다 투구·상의·신발.`)
- **다음 순환 번호**: **3번** (`3. 외형 세트 4종. 단풍 왕도에서 경계 교대를 하는 전령. 자주 옻칠·적동·세로 무늬 직물. 모자, 상의, 등, 안경.`)
- **기존 아이콘과 중복 방지 확인**:
  - [art.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/art.js#L544-L635)의 기본 티어 `HELM_ART`(1~5단계: 천 두건·가죽 모자·강철 투구·전술 헬멧·차원 왕관), `armorIcon`, `bootsIcon` 및 [gemini-boss-gear-sets.md](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/ai/reports/gemini-boss-gear-sets.md)의 보스 세트(`veil_*`, `bloom_*`)와 ID·실루엣이 겹치지 않게 제작했습니다.

## 2. 품목 표 (영문 ID · 한국어 이름 · 슬롯/테마 · 팔레트 · 획득 제안 · 적용 대상 파일)

| 영문 ID | 한국어 이름 | 슬롯 · 테마 | 팔레트 (최대 10색 이내) | 구매 / 드랍 경로 제안 | 실제 적용 시 필요한 파일 |
| --- | --- | --- | --- | --- | --- |
| `h_neon_repair` | 수리반 용접 바이저 | `helm` · 잿빛 네온시티 수리반 (`neon_repair`) | 철판(`#cfd6e0`, `#838d9c`, `#4c5464`, `#2a2e3a`), 가죽(`#b87a48`, `#7d4b28`), 네온 앰버(`#ffaa30`, `#fff098`), 외곽선(`#111118`) | 잿빛 네온시티 방어구 상점(골드) 또는 수리반 몬스터 드랍·고철 분해 제작 | `game/src/logic/10-tables.js`, `game/public/art.js` |
| `a_neon_repair` | 수리반 철판 가죽 작업복 | `armor` · 잿빛 네온시티 수리반 (`neon_repair`) | 철판(`#cfd6e0`, `#838d9c`, `#4c5464`), 잿빛 캔버스(`#6c707a`), 가죽(`#b87a48`, `#7d4b28`), 네온 앰버(`#ffaa30`, `#fff098`), 외곽선(`#111118`) | 잿빛 네온시티 방어구 상점(골드) 또는 정비구역 정예 드랍 | `game/src/logic/10-tables.js`, `game/public/art.js` |
| `b_neon_repair` | 수리반 강철 앞코 작업화 | `boots` · 잿빛 네온시티 수리반 (`neon_repair`) | 철판(`#cfd6e0`, `#838d9c`, `#4c5464`), 고무 밑창(`#2a2e3a`), 가죽(`#b87a48`, `#7d4b28`), 네온 앰버(`#ffaa30`), 외곽선(`#111118`) | 잿빛 네온시티 방어구 상점(골드) 또는 수리반 일반 몬스터 드랍 | `game/src/logic/10-tables.js`, `game/public/art.js` |
| `h_crystal_delver` | 수정굴 각면 탐사 투구 | `helm` · 수정굴 탐사대 (`crystal_delver`) | 자수정 광물(`#8a78c8`, `#52448a`, `#2c2254`), 수정 채굴등(`#aefafa`, `#44c2cc`, `#1f7a8c`), 탐사 가죽(`#c49464`, `#7a5234`), 황동(`#f0cc68`), 외곽선(`#111118`) | 수정굴 던전 필드 보스/정예 드랍 또는 수정 광석 연마 제작 | `game/src/logic/10-tables.js`, `game/public/art.js` |
| `a_crystal_delver` | 수정굴 결정판 흉갑 | `armor` · 수정굴 탐사대 (`crystal_delver`) | 자수정 광물(`#8a78c8`, `#52448a`, `#2c2254`), 육각 수정 방패(`#aefafa`, `#44c2cc`, `#1f7a8c`), 탐사 가죽(`#c49464`, `#7a5234`), 황동(`#f0cc68`), 외곽선(`#111118`) | 수정굴 던전 보스 드랍 또는 수정굴 탐사대 공적 교환 | `game/src/logic/10-tables.js`, `game/public/art.js` |
| `b_crystal_delver` | 수정굴 아이젠 탐사 장화 | `boots` · 수정굴 탐사대 (`crystal_delver`) | 자수정 각반(`#8a78c8`, `#52448a`, `#2c2254`), 수정 아이젠(`#aefafa`, `#44c2cc`, `#1f7a8c`), 탐사 가죽(`#c49464`, `#7a5234`), 황동(`#f0cc68`), 외곽선(`#111118`) | 수정굴 던전 일반/정예 몬스터 드랍 또는 수정 광석 제작 | `game/src/logic/10-tables.js`, `game/public/art.js` |

## 3. 산출물 및 대표 비교 스크린샷 경로
- **전용 드롭인 코드 모듈 (`node --check` 통과)**:
  - [armor_neon_crystal.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/armor_neon_crystal.js) (`NEON_CRYSTAL_ITEMS`, `NEON_REPAIR_PALETTE`, `CRYSTAL_DELVER_PALETTE`, `NEON_CRYSTAL_ARMOR_ART`, `renderNeonCrystalArmorIcon` 수록)
- **대표 비교 PNG (1장)**:
  - [gemini-equipment-neon-crystal.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-equipment-neon-crystal.png): 3열(투구 | 상의 | 신발) × 2행(수리반 | 수정굴 탐사대) 구성으로 **1× 실제 크기(컬러·흑백·단색 실루엣)**, **5× 확대(컬러·흑백)**, **2× 단색 실루엣**을 나란히 비교.
- **`import-art.mjs` 정규화 16×16 아이콘 (`asset/generated/neon-crystal/`, `--install` 미실행)**:
  - 수리반: [h_neon_repair.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/neon-crystal/h_neon_repair.png) (9색), [a_neon_repair.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/neon-crystal/a_neon_repair.png) (10색), [b_neon_repair.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/neon-crystal/b_neon_repair.png) (8색) (각 `.prompt.md` 동반)
  - 수정굴 탐사대: [h_crystal_delver.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/neon-crystal/h_crystal_delver.png) (10색), [a_crystal_delver.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/neon-crystal/a_crystal_delver.png) (10색), [b_crystal_delver.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/neon-crystal/b_crystal_delver.png) (10색) (각 `.prompt.md` 동반)

## 4. 검수 현황 (완료 수량 및 미검수 구분)
- **완료 및 프리뷰 검수 수량**: **방어구 아이콘 6종 완료 (투구 2 · 상의 2 · 신발 2, 외톨이 픽셀 0건, `#111118` 1px 외곽선 유지)**
  - **동일 슬롯 흑백 실루엣 구분 검수**:
    - 투구(`helm`): 둥근 용접 바이저+좌측 필터통(`h_neon_repair`) vs 각진 광물 돔+전방 돌출 수정 채굴등(`h_crystal_delver`). (초기 시안의 `h_crystal_delver` 개구부 고리 오인 문제를 내부 어두운 바이저 음영(`#2c2254`) 및 가죽 턱보호대 보강으로 수정 확인)
    - 상의(`armor`): 비대칭 볼트 철판 좌견갑+비대칭 가죽 에이프런(`a_neon_repair`) vs 양측 솟은 날개 견갑+육각 수정 흉갑+뾰족한 V자 밑단(`a_crystal_delver`).
    - 신발(`boots`): 넓은 접이식 가죽 커프+뭉툭한 강철 앞코 작업화(`b_neon_repair`) vs 높은 경사 각반+뾰족한 앞코+밑창 3단 수정 아이젠 발톱(`b_crystal_delver`). (초기 시안의 발끝 돌출 부족을 교정하여 단색 실루엣에서도 즉시 장화로 판독됨을 확인)
- **미검수 항목**:
  - 인게임 가방/상점 실제 UI 연동 테스트 (`game/src/logic/10-tables.js` 및 `game/public/art.js` 공용 파일 미수정 원칙에 따라 독립 모듈 `armor_neon_crystal.js`로 납품).

## 5. 실제 적용 순서
1. **[game/src/logic/10-tables.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/src/logic/10-tables.js)**:
   - 수리반(`neon_repair`)·수정굴 탐사대(`crystal_delver`) 세트 또는 전용 방어구 아이템 행(`id`: `h_neon_repair`, `a_neon_repair`, `b_neon_repair`, `h_crystal_delver`, `a_crystal_delver`, `b_crystal_delver`) 등록 후 `npm run build:logic` 실행.
2. **[game/public/art.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/art.js)**:
   - [armor_neon_crystal.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/armor_neon_crystal.js)의 `NEON_CRYSTAL_ARMOR_ART` 및 `renderNeonCrystalArmorIcon`을 `buildIcons(items)`에 연결하거나 `import-art.mjs --install` 승인 경로로 매니페스트 등록.
3. **검증**:
   - `node --check game/public/art.js`, `npm run test:rules`, 그리고 가방/상점 16×16 슬롯 UI 확인.
