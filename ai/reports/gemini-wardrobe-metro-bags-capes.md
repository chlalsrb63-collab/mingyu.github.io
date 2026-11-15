# 외형 장비 작업 보고서 — 메트로 스트리트 가방·망토 확장 4종 (현대 의상)

## 1. 작업 개요
- **브랜치 / 작업 트리**: `gemini/work` (`.work/gemini`)
- **테마 및 요청 반영**: 오너 요청(“날개 아이템보다는 망토나 가방 아이템 위주로 더 디자인해줘”)에 맞춰, 현대 의상 테마 **「메트로 스트리트 (`metro`)」** 내 **날개 제외 · 가방 2종 + 망토 2종(총 4종)**을 추가 제작.
- **범위**: `game/public/wardrobe_metro_bags_capes.js`에 64×64 네이티브(`0.5` 논리 좌표) 등 외형 4종 + `BACK_FRONT` + 16×16 아이콘을 분리 작성. 공용 `wardrobe.js`, `game/src/logic/**`는 수정하지 않음.

## 2. 제작 품목 (4종 — 가방 2 · 망토 2)

| 영문 ID | 한국어 이름 | 슬롯 / 분류 | 재질 · 팔레트 | 실루엣 · 착용 특징 | 획득 경로 제안 |
| --- | --- | --- | --- | --- | --- |
| `back_metro_crosssling` | 어반 크로스 슬링백 | `back` / 가방 1 | 세이지 테크 나일론(`#4e695c`), 매트 블랙 웨빙(`#2b303c`), 네온 코랄 버클(`#ff6648`), 크롬 지퍼 | 앞모습 왼쪽 어깨→오른쪽 허리 사선 크로스 끈(`BACK_FRONT`), 뒷면 우측 허리에 걸친 비대칭 콤팩트 슬링백 | 네온시티 잡화 상점 (16,000 골드 또는 버드나무 토큰 55개) |
| `back_metro_guitarbag` | 어반 기타 긱백 | `back` / 가방 2 | 샌드 캔버스(`#d8ceb8`), 카라멜 가죽(`#9e633a`), 매트 블랙 넥(`#2b303c`), 크롬 튜닝 페그 | 우측 어깨 위로 비스듬히 솟은 헤드스톡(모든 종족 귀·뿔 비켜감) + 둥근 캔버스 기타 바디 | 네온시티 / 거리 악사 상점 (22,000 골드 또는 버드나무 토큰 75개) |
| `back_metro_trenchcape` | 어반 트렌치 케이프 | `back` / 망토 1 | 카멜 개버딘(`#c99b66`/`#ebd0a4`), 버건디 체크 안감(`#7d3240`), 가죽 허리 벨트 + D링 버클 | 앞면 더블버튼 테일러드 라펠(`BACK_FRONT`), 뒷면 벨트·센터 백 슬릿·버건디 밑단 안감으로 꼬리 겹침 방지 | 네온시티 패션 상점 (25,000 골드 또는 버드나무 토큰 85개) |
| `back_metro_pufferscarf` | 어반 푸퍼 머플러 망토 | `back` / 망토 2 | 더스티 민트 3단 퀄팅 패딩(`#6ba6a2`), 크림 리브드 니트(`#f0e7d6`), 인디고·버건디 줄무늬 머플러 | 앞면 포근한 니트 칼라+한쪽 가슴 머플러 자락, 뒷면 퀄팅 어깨 케이프+양갈래 프린지 머플러(중앙 완전 트임) | 겨울 시즌 / 버드나무 토큰 95개 또는 28,000 골드 |

## 3. 반영 대상 및 산출물 경로
- **코드 모듈 (커밋 포함)**: [`game/public/wardrobe_metro_bags_capes.js`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/wardrobe_metro_bags_capes.js)
  - 통합 시 `game/src/logic/65-cosmetics.js`의 `COSMETICS`(권장 코드 `127..130`) 및 `game/public/wardrobe.js`(`BACK`, `BACK_FRONT`, `ART`, `HARD_BACKS`)에 병합.
- **정규화 16×16 가방 아이콘 (미설치 시안, `import-art.mjs` 통과)**:
  - `asset/generated/metro-bags-capes/icon_back_metro_{crosssling,guitarbag,trenchcape,pufferscarf}.png` 및 `*.prompt.md`
  - 색상 수 `8~9색` (`<= 16`), `0 specks cleaned`, `#111118` 외곽선 유지.
- **출처 기록**: [`asset/CREDITS.md`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/CREDITS.md)
- **로컬 미리보기 PNG (비추적 `game/shots/`)**:
  - [`gemini-wardrobe-metro-bc-wear.png`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-wardrobe-metro-bc-wear.png) (4종족 × 앞/옆/뒤 × 정지/보행 `2×`/`1×`)
  - [`gemini-wardrobe-metro-bc-icons.png`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-wardrobe-metro-bc-icons.png) (16×16 아이콘 `1×`/`6×`/`4×` 명도/실루엣)

## 4. 착용 및 검수 결과
- `node --check game/public/wardrobe_metro_bags_capes.js`: 통과.
- `import-art.mjs --size 16x16 --colors 16 --outline keep`: 4종 모두 `0 specks cleaned`로 통과.
- **64×64 착용 검수**:
  - `SIDE0`·`SIDE W2`에서 꼬리에 가리지 않도록 슬링백·기타 긱백·트렌치 케이프 밑단의 후방 오프셋(`x=6.0~7.0`)을 미세 조정해 측면 실루엣 시인성을 확보함.
  - 앞면 크로스 스트랩·더블버튼 라펠·머플러 자락과 뒷면 4종족(고양이·토끼·개구리·뿔 사슴) 귀/뿔/꼬리 분리 상태 확인 완료.

진행한 순서: 메트로 스트리트 가방·망토 확장 4종 (A 보강) 완료 / 다음 순서: 메트로 스트리트 B. 상의 3종
