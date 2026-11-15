# 검·단검·창 스킬 이펙트 재작성 보고서 (`gemini-melee-skill-fx`)

## 1. 원래 작업 행
- `- [ ] [VFX] docs/fx-audit.md에서 "약함"인 검·단검·창 스킬 이펙트를 다시 그리기 (휘두름 궤적, 타격 순간 섬광·파편, 바닥 충격). 서버 이벤트·판정 범위는 그대로, 그림이 실제 판정 범위와 맞게. 스킬마다 미리보기 스크린샷`

## 2. 스킬별 이펙트 변경 요약 (`game/public/skillfx.js`)
- **대지 가르기 (`rend`, 검 Lv.10, `ln: 9` + `fx: 81/82`)**:
  - `ln: 9`: 외곽선(`INK`)이 있는 도트 도약 궤적 호와 도약 먼지로 개선.
  - `rendSlam`(`fx: 81`): 착지 반경 `r = 38`에 맞춘 외곽 `rim`, 파편 `shards`, 6갈래 방사형 도트 지면 균열 추가.
  - `rendWave`(`fx: 82`): 착지 지점(`lineOf(9)`)에서 전방 `len = 120, half = 14` 폭을 따라 뻗는 황금 균열 레일과 순차적으로 솟구치는 9개의 도트 암석 기둥 구현(`setTimeout` 제거 후 `later` 사용).
- **단죄의 일격 (`verdict`, 대검전사, `fx: 83`)**:
  - `verdictSpin`: 반경 `r = 70` 전체를 도는 이중 360° 도트 대검 회전 참격 띠(진홍·황금·백색 하이라이트 + `INK` 외곽선)와 8방위 처형 검날 스파이크, 이중 `rim`·`shards` 구현.
- **십자 난도 (`crosscut`, 검무사, `fx: 120`)**:
  - `crossCutFx`: 전방 `r = 64, arc = 100°` 부채꼴을 덮는 청백색 대검 도트 초승달 호와 이를 가로지르는 보라색 단검 X자 교차 베기, 170ms 후 후속 `flurrySlash` 폭발 구현.
- **무영난무 (`flurry`, 도적, `fx: 86` + `ln: 5`) & 암습 (`ambush`, 단검 Lv.1, `fx: 84` + `ln: 6`)**:
  - `shadowAfterimage`: 점멸 출발지(`ln: 5/6`)와 무영난무 시전(`r = 90` 림)에 남는 도트 그림자 분신 실루엣 추가.
  - `flurrySlash` / `ambushCuts`: 짙은 외곽선(`INK`)과 중심 십자 섬광·파편을 갖춘 대형 도트 X자 절개선으로 강화.
- **유성창 (`comet`, 창 Lv.10, `fx: 88` + `ln: 3`) & 나선 찌르기 (`spiral`, 창 Lv.1, `fx: 87`)**:
  - `cometCharge`: 끌고 가는 폭 `half = 20` 바닥 경계 레일과 안쪽 갈매기표(끌림 표시), 유성 창날 돌진 웨이크, 착지 기절(`r = 20`) 성운 십자 섬광·파편 구현.
  - `spiralThrust`: 사거리 `72%` 지점(`far: 0.72`, 창끝 강타 경계)에 황금 도트 고리와 `72%~100%` 구간의 가시형 도트 창끝 드릴 헤드 추가.
- **심연의 강림 (`dive`, 용기사, `fx: 99` + `pr` `"field"`)**:
  - `abyssDive`: 고공에서 꽂히는 심연 창기둥(`115px` 높이)과 5기둥 암흑 결정 첨탑, 외곽 `r = 110` 분화구 `rim`·`shards` 및 내부 `r = 70` 흡혈 장판 도트 입자 강화.

## 3. 검증 및 스크린샷 경로
- 문법 검사: `node --check game/public/skillfx.js` 통과 (오류 없음, `game/src/logic/` 미수정)
- 미리보기 스크린샷 확인:
  - `game/shots/gemini-melee-fx-1.png` (검·단검: `rend`, `verdict`, `crosscut`, `flurry`, `ambush`)
  - `game/shots/gemini-melee-fx-2.png` (창: `comet`, `spiral`, `dive`)
