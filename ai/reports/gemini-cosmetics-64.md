# 작은꼬리 64×64 외형 장비 2세트 제작 및 검수 보고서 (`gemini-cosmetics-64`)

## 1. 작업 개요 및 사전 확인
- **지시 사항**: 코드 기반 픽셀 아트로 작은꼬리 64×64 외형 장비 두 세트(**등불 나루 구조대**, **설맥 관측소**)의 명세, 64×64 투명 레이어 시안, 16×16 가방 아이콘, 종족별/방향별 착용 검수 프리뷰를 제작.
- **렌더러 상태 확인**:
  - [sprites.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/sprites.js#L16-L18) 확인 결과 `export const SIZE = 32;`(`FOOT = [16, 29]`)로 아직 32×32 캔버스를 반환함.
  - [wardrobe.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe.js#L10-L39) 확인 결과 `const SZ = 32;` 및 `Math.round(x)` 정수 반올림 브러시를 사용하여 `0.5` 논리 좌표 변이가 아직 병합되지 않은 상태임.
  - 작업 지침("해당 변경이 작업 폴더에 없으면 브랜치를 임의로 바꾸거나 재구현하지 말고, 아래 초안을 아트 명세와 64 도트 레이어로 준비해. 다른 에이전트가 진행 중인 64×64 캐릭터·NPC 리뉴얼을 덮어쓰지 마")에 따라 `game/public/sprites.js`, `game/public/wardrobe.js`, `game/src/logic/**`는 수정하지 않고, [ai/proposals/gemini-cosmetics-64.md](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/ai/proposals/gemini-cosmetics-64.md)와 `asset/generated/cosmetics-64/` 시안으로 완비함.

## 2. 대표 PNG 및 산출물 경로
- **통합 착용 프리뷰 (5종족 × 정면·측면·후면 × 대기·보행 + 1× 배율 + 부위별 단품)**:
  - 등불 나루 구조대 (`ferry`): [gemini-cosmetics-64-ferry.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-cosmetics-64-ferry.png)
  - 설맥 관측소 (`snow`): [gemini-cosmetics-64-snow.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-cosmetics-64-snow.png)
- **64×64 투명 도트 레이어 시안 (8종, `.prompt.md` 동반)**:
  - [hat_ferry_souwester.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/hat_ferry_souwester.png), [top_ferry_oilskin.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/top_ferry_oilskin.png), [back_ferry_halfcape.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/back_ferry_halfcape.png), [face_ferry_goggles.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/face_ferry_goggles.png)
  - [hat_snow_earflap.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/hat_snow_earflap.png), [top_snow_quilted.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/top_snow_quilted.png), [back_snow_surveycape.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/back_snow_surveycape.png), [face_snow_halfglass.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/face_snow_halfglass.png)
- **16×16 정규화 가방 아이콘 시안 (`import-art.mjs` 통과 8종, `.prompt.md` 동반)**:
  - [icon_hat_ferry_souwester.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/icon_hat_ferry_souwester.png), [icon_top_ferry_oilskin.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/icon_top_ferry_oilskin.png), [icon_back_ferry_halfcape.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/icon_back_ferry_halfcape.png), [icon_face_ferry_goggles.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/icon_face_ferry_goggles.png)
  - [icon_hat_snow_earflap.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/icon_hat_snow_earflap.png), [icon_top_snow_quilted.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/icon_top_snow_quilted.png), [icon_back_snow_surveycape.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/icon_back_snow_surveycape.png), [icon_face_snow_halfglass.png](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/generated/cosmetics-64/icon_face_snow_halfglass.png)

## 3. 항목별 검수 결과
| ID (이름) | 정·측·후 실루엣 및 64도트 디테일 | 종족별(기본·토끼·개구리·뿔) 간섭 검수 | 16×16 아이콘 판독성 |
| --- | --- | --- | --- |
| `hat_ferry_souwester` (물막이 챙모자) | 낮은 이중 챙(`hy+2.5~4`)과 볼 옆 짧은 황동/주황 턱끈으로 기존 `hat_rain`·`hat_sailor`와 명확히 구분됨. 뒷면은 빗물받이 드롭 테일로 읽힘. | 토끼 긴 귀(`y=3..11`), 사슴 가지뿔(`sp=12`), 양뿔(`ear=10`) 뿌리를 가리지 않으며 개구리(`sp=7`) 돌출눈 위 이마 라인에 안정적으로 안착. | 6색, 좌우로 뻗은 이중 방수 챙과 주황 신호띠·턱끈 고리가 선명함. |
| `top_ferry_oilskin` (등불지기 방수복) | 청록 방수 코트 위 짧은 겹깃(`y=22.5~23.5`), 좌상→우하로 흐르는 주황 구조끈(`#e86a24`), 중앙 작은 황동 매듭(`1×1` 64도트)이 1× 배율에서도 뚜렷함. | 몸통(`11..21, 22..27`)에만 밀착되어 얼굴·손·꼬리 실루엣을 침범하지 않음. | 7색, 청록 방수 상의와 사선 주황 구조끈·황동 매듭이 한눈에 읽힘. |
| `back_ferry_halfcape` (조난등 반망토) | 왼쪽 어깨 황동 견장 핀 고정, 비에 젖어 어두운 물방울 단(`#0f2429`)과 세로로 길게 내려오는 주황+명주 반사 띠가 비대칭 실루엣을 형성. | `BACK`(몸통 뒤 망토) + `BACK_FRONT`(어깨 고정핀) 분리로 정면에서도 얼굴을 가리지 않고 어깨 고정점만 노출. | 7색, 비대칭 반망토 외곽과 세로 반사 띠·물방울 밑단이 뚜렷함. |
| `face_ferry_goggles` (황동 물안경) | 호박색 옆테(`#d88c28`)와 0.5도트 두께의 청록 렌즈 상·하 테두리만 그려 눈동자 중심(`ey..ey+1.5`)을 완전히 비움. | 개구리 돌출눈과 일반 종족 눈동자·홍조를 덮지 않아 표정 가독성 100% 유지. | 8색, 쌍안 황동 고글 테와 청록 렌즈 림이 선명함. |
| `hat_snow_earflap` (별바늘 귀덮개모) | 중앙 돔을 낮추고 좌우 대칭 별금속 단추 두 점(`#f4d068`)과 각진 자줏빛 방한 귀덮개로 구성하여 앞에서 뿔처럼 읽히지 않음. | 귀 기둥(`x=10..12, 19..21`) 위는 얇은 밴드만 지나가 토끼 귀·사슴뿔·양뿔과 겹치지 않음. | 8색, 아치형 모자 본체와 양옆 귀덮개·금속 별단추 2점이 구분됨. |
| `top_snow_quilted` (별자리 누빔옷) | 미색 누빔 몸판 위 자줏빛 가슴끈과 한 방향(좌→우 하향)으로 이어지는 굵은 솔기(`#b8aa96`), 금빛 별자리 매듭점이 선명함. | 소매·발 끝을 침범하지 않고 보행 스텝 시 밑단이 깔끔하게 유지됨. | 7색, 미색 누빔과 자주색 가슴끈·사선 솔기가 뚜렷함. |
| `back_snow_surveycape` (눈바람 측량 망토) | 뒤로 갈라진 자줏빛 두 폭(연미형 제비꼬리)과 오른쪽 폭의 미색 삼각 지도 주머니+빙청 나침반 핀이 후면/측면 포인트로 작동. | 보행 시(`st !== 0`) 좌우 폭 끝단이 `±0.5` 논리 단위로 교차 흔들림. | 6색, 갈라진 두 폭 실루엣과 삼각 지도 주머니가 명확함. |
| `face_snow_halfglass` (빙청 반무테 안경) | 상단 테를 생략한 언더림(`ey+2`) 구조와 렌즈 바깥 아래 모서리의 1도트(`0.5×0.5`) 백색 반짝임으로 눈동자와 눈썹을 가리지 않음. | 모든 종족의 눈동자·개구리 돌출눈을 가리지 않고 빙청 안경테만 깔끔하게 노출. | 7색, 초슬림 반무테 라인과 양 끝 1도트 하이라이트가 살아 있음. |

## 4. 64×64 렌더러 반영 시 수정할 파일과 순서
1. **[game/src/logic/65-cosmetics.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/src/logic/65-cosmetics.js)**:
   - [ai/proposals/gemini-cosmetics-64.md](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/ai/proposals/gemini-cosmetics-64.md) §3.1의 `COSMETICS` 8행(wire code `109..116`, 세트키 `ferry`·`snow`) 및 `COSMETIC_SETS` 2행 추가.
   - `npm run build:logic` 실행하여 `game/src/logic.js` 재생성.
2. **[game/public/wardrobe.js](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe.js)**:
   - 64×64 캐릭터 렌더러(`SZ = 64`, `0.5` 논리 단위 스케일) 병합 후, [ai/proposals/gemini-cosmetics-64.md](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/ai/proposals/gemini-cosmetics-64.md) §3.2의 팔레트 상수(`P`)와 `HAT`, `TOP`, `BACK`, `BACK_FRONT`, `FACE`, `ART` 드로잉 함수를 삽입.
3. **검증 스크립트 실행**:
   - `node --check game/public/wardrobe.js`
   - `node game/scripts/cos-audit.mjs` 및 `node game/scripts/test-all.mjs cosmetics wardrobe` 실행.

## 5. 남은 작업
- 다른 에이전트가 작업 중인 64×64 캐릭터·NPC 리뉴얼(`game/public/sprites.js` `SIZE = 64` 및 `game/public/wardrobe.js` `0.5` 논리 좌표 지원)이 `main`에 병합된 뒤, 위 4번 순서대로 `65-cosmetics.js`와 `wardrobe.js`에 초안 코드를 옮기고 `npm run build:logic`을 실행하면 즉시 인게임에 적용됩니다.
