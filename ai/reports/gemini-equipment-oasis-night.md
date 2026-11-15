# 모래바람 오아시스 야간 관측반 외형 세트 및 아이콘 제작 보고서 (`oasis-night`)

## 1. 작업 묶음 개요
- **선택한 순환 번호**: **1번** (`1. 외형 세트 4종. 모래바람 오아시스 야간 관측반. 사막의 금속·바랜 천·짙은 남색. 모자, 상의, 등, 안경 한 점씩.`)
- **다음 순환 번호**: **2번** (`2. 방어구 아이콘 6종. 잿빛 네온시티 수리반의 가죽·철판과 수정굴 탐사대의 보호 장구. 두 테마마다 투구·상의·신발.`)
- **기존 품목과의 중복 방지 확인**:
  - 기존 [wardrobe.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe.js)의 사막/오아시스 품목(`hat_turban`, `hat_goggles`, `hat_pith`, `top_safari`, `back_cape_sand`, `back_gourd`) 및 직전 64×64 작업(`ferry`, `snow`)과 ID·실루엣이 전혀 겹치지 않도록 **평평한 남색 관측 케피+차양포**, **비대칭 바랜 천 스톨 외투**, **황동 혼천의+별자리 두루마리 등짐**, **측면 방풍판 사막 차광경**으로 설계했습니다.

## 2. 품목 표 (영문 ID · 한국어 이름 · 슬롯/테마 · 팔레트 · 획득 제안 · 적용 대상 파일)

| 영문 ID (`code`) | 한국어 이름 | 슬롯 · 테마 | 핵심 팔레트 (최대 10색 이내) | 구매 / 드랍 경로 제안 | 실제 적용 시 필요한 파일 |
| --- | --- | --- | --- | --- | --- |
| `hat_oasis_veilcap` (`117`) | 사막별 차양모 | `hat` · 모래바람 야간 관측반 (`oasis_night`) | 짙은 남색(`#1e2b4f`, `#324878`, `#121930`), 바랜 천(`#e6d8bc`, `#b8a484`), 사막 황동(`#d8a848`, `#9e6e24`, `#f6dc88`), 외곽선(`#2b2233`) | 버드나무토큰 4개 (`shop: 4`) | `game/src/logic/65-cosmetics.js`, `game/public/wardrobe.js`, `game/public/art.js` |
| `top_oasis_tabard` (`118`) | 야간 관측반 외투 | `top` · 모래바람 야간 관측반 (`oasis_night`) | 짙은 남색(`#1e2b4f`, `#121930`), 바랜 천(`#e6d8bc`, `#b8a484`), 사막 황동(`#d8a848`, `#9e6e24`, `#f6dc88`), 청록 별유리(`#68d8d8`), 외곽선(`#2b2233`) | 버드나무토큰 4개 (`shop: 4`) | `game/src/logic/65-cosmetics.js`, `game/public/wardrobe.js`, `game/public/art.js` |
| `back_oasis_astrolabe` (`119`) | 황동 혼천의 등짐 | `back` · 모래바람 야간 관측반 (`oasis_night`) | 사막 황동(`#d8a848`, `#9e6e24`, `#f6dc88`), 바랜 천(`#e6d8bc`, `#b8a484`), 짙은 남색(`#1e2b4f`, `#121930`), 청록 별유리(`#68d8d8`, `#dffafa`), 외곽선(`#2b2233`) | 버드나무토큰 5개 (`shop: 5`) + 오아시스 필드 보스 드랍 (`boss: true`) | `game/src/logic/65-cosmetics.js`, `game/public/wardrobe.js`, `game/public/art.js` |
| `face_oasis_slitglass` (`120`) | 모래바람 차광경 | `face` · 모래바람 야간 관측반 (`oasis_night`) | 사막 황동(`#d8a848`, `#9e6e24`), 짙은 남색 방풍판(`#1e2b4f`), 청록 별유리(`#68d8d8`, `#dffafa`), 외곽선(`#2b2233`) | 버드나무토큰 3개 (`shop: 3`) | `game/src/logic/65-cosmetics.js`, `game/public/wardrobe.js`, `game/public/art.js` |

## 3. 산출물 및 대표 비교 스크린샷 경로
- **전용 드롭인 코드 모듈 (`node --check` 통과)**:
  - [wardrobe_oasis_night.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe_oasis_night.js) (`OASIS_NIGHT_COSMETICS`, `OASIS_NIGHT_PALETTE`, `OASIS_NIGHT_HAT`, `OASIS_NIGHT_TOP`, `OASIS_NIGHT_BACK`, `OASIS_NIGHT_BACK_FRONT`, `OASIS_NIGHT_FACE`, `OASIS_NIGHT_ART`, `OASIS_NIGHT_ICONS` 수록)
- **대표 비교 PNG (2장)**:
  1. **종족·방향·동작별 착용 비교 시트 (3× 확대 컷 + 1× 실제 게임 배율 컷 + 단품 레이어/착용 컷)**:
     - [gemini-equipment-oasis-night-wear.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-equipment-oasis-night-wear.png)
  2. **16×16 가방 아이콘 비교 시트 (1× 실제 크기 컬러/흑백 + 4× 확대 컬러 + 4× 확대 흑백 실루엣 + 1× 단품 착용 컷)**:
     - [gemini-equipment-oasis-night-icons.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-equipment-oasis-night-icons.png)
- **생성된 64×64 레이어 원본 및 `import-art.mjs` 정규화 16×16 아이콘 (`asset/generated/oasis-night/`)**:
  - 64×64 레이어 4종: [hat_oasis_veilcap.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/oasis-night/hat_oasis_veilcap.png), [top_oasis_tabard.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/oasis-night/top_oasis_tabard.png), [back_oasis_astrolabe.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/oasis-night/back_oasis_astrolabe.png), [face_oasis_slitglass.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/oasis-night/face_oasis_slitglass.png) (각 `.prompt.md` 포함)
  - 16×16 정규화 아이콘 4종: [icon_hat_oasis_veilcap.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/oasis-night/icon_hat_oasis_veilcap.png) (8색), [icon_top_oasis_tabard.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/oasis-night/icon_top_oasis_tabard.png) (10색), [icon_back_oasis_astrolabe.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/oasis-night/icon_back_oasis_astrolabe.png) (9색), [icon_face_oasis_slitglass.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/oasis-night/icon_face_oasis_slitglass.png) (7색) (각 `.prompt.md` 포함)

## 4. 검수 현황 (완료 수량 및 미검수 구분)
- **완료 및 프리뷰 검수 수량**: **외형 4종 (64×64 레이어 4점 + 16×16 가방 아이콘 4점 = 총 8점 완료, 미검수 0건)**
  - **종족별 간섭 확인**: 기본형(`sp=0`), 토끼(`sp=3`), 개구리(`sp=7`), 사슴뿔(`sp=12`), 양뿔(`ear=10`) 5개 체형 모두에서 `ears: "through"`와 `guardEyes`를 통해 귀·뿔·개구리 돌출눈·눈동자가 가려지지 않음을 [gemini-equipment-oasis-night-wear.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-equipment-oasis-night-wear.png)에서 확인했습니다.
  - **등짐과 꼬리·차양포 관계 확인**: `hat_oasis_veilcap` 후면 차양포를 좌우 관자놀이/목덜미 라인으로 갈라 배치하여 후면 중앙의 `back_oasis_astrolabe` 혼천의 고리와 겹치지 않으며, 측면·후면 하단 꼬리 실루엣이 그대로 노출됩니다.
  - **흑백 실루엣 구별 확인**: [gemini-equipment-oasis-night-icons.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-equipment-oasis-night-icons.png)에서 모자(양갈래 차양포 아치), 상의(사선 바랜 천 스톨 튜닉), 등짐(원형 혼천의+우상단 별자리 두루마리), 안경(수평 슬릿+측면 방풍판)이 흑백 1×/4×에서도 즉시 구별됩니다.
- **인게임 라이브 렌더러 통합 대기 항목**:
  - 현재 `gemini/work`의 `game/public/sprites.js`(`SIZE = 32`) 및 `game/public/wardrobe.js`(`SZ = 32`)에 64×64 캐릭터 리뉴얼이 아직 병합되지 않았으므로, 공용 렌더러는 수정하지 않고 `game/public/wardrobe_oasis_night.js` 전용 모듈로 분리해 두었습니다.

## 5. 실제 적용 순서
1. **[game/src/logic/65-cosmetics.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/src/logic/65-cosmetics.js)**:
   - `COSMETIC_SETS`에 `OASIS_NIGHT_SET`(`oasis_night: "모래바람 야간 관측반"`) 추가, `COSMETICS`에 `OASIS_NIGHT_COSMETICS`(코드 `117..120`) 추가 후 `npm run build:logic` 실행.
2. **[game/public/wardrobe.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe.js)**:
   - 64×64 렌더러 병합 후 [wardrobe_oasis_night.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe_oasis_night.js)의 `OASIS_NIGHT_HAT`, `OASIS_NIGHT_TOP`, `OASIS_NIGHT_BACK`, `OASIS_NIGHT_BACK_FRONT`, `OASIS_NIGHT_FACE`, `OASIS_NIGHT_ART`를 각각 병합.
3. **검증**:
   - `node --check game/public/wardrobe.js` 및 `node game/scripts/test-all.mjs cosmetics wardrobe` 실행.
