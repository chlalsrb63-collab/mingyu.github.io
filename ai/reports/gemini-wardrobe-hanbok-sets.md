# 전통 한복 아바타 4세트(모자+의상 8종) 시안 보고

- **브랜치**: `gemini/work`
- **모듈**: [`game/public/wardrobe_hanbok_sets.js`](../../game/public/wardrobe_hanbok_sets.js)
- **아이콘 자산(미설치)**: [`asset/generated/hanbok-sets/`](../../asset/generated/hanbok-sets/) (`icon_*.png` 8종 + `*.prompt.md` 8개)
- **출처 기록**: [`asset/CREDITS.md`](../../asset/CREDITS.md)

## 1. 제작 품목 (총 4세트 · 8종)

기존 `wardrobe.js`의 `top_hanbok`(노랑·빨강), `top_dopo`(단색 쪽빛), `hat_bamboo`(삿갓)와 겹치지 않도록 조선 시대 직역·신분별 대표 실루엣과 64×64(`0.5` 좌표) 디테일을 분리해 제작했습니다.

1. **선비 (`hat_hanbok_seonbi` + `top_hanbok_seonbi`)** — *흑립 갓 + 옥색 학창의*
   - **특징**: 원통형 말총 흑립 갓 + 넓은 챙 + 호박·금 구슬 갓끈(`ears: "through"`, 개구리 `A.bumps` 시 눈 혹 사이로 폭 자동 축소). 옥색 학창의에 검정 비단 선(소매·깃 테두리), 백색 동정, 붉은 매듭 고름·허리띠, 보행 시 치맛자락 스윙(`stepSwing`).
2. **아씨 (`hat_hanbok_assi` + `top_hanbok_assi`)** — *금박 족두리 + 연홍 당의·비취 치마*
   - **특징**: 칠보(홍옥·비취) 중앙 장식과 좌우 금비녀 끄트머리가 돌출된 육각 족두리 + 후면(`A.back`)에 길게 늘어지는 금박 붉은 댕기. 연홍빛 당의 위 백색 동정·가슴 금박 보·허리 노리개 + 풍성한 비취색 치마.
3. **전하 (`hat_hanbok_king` + `top_hanbok_king`)** — *익선관 + 홍룡포*
   - **특징**: 위로 솟은 매미 날개(2매)를 뒤·측면·정면 윤곽에 살린 이단 흑자색 익선관 + 금관자 장식. 선홍색 곤룡포의 정·후면 황금 용 흉배(보), 비취 장식 금 옥대, 밑단 쪽빛 내의 트임.
4. **무사 (`hat_hanbok_musa` + `top_hanbok_musa`)** — *공작깃 전립 + 청철릭 쾌자*
   - **특징**: 홍사 술이 달린 둥근 짙은 펠트 모자에 오른쪽 위로 뻗는 청록 공작깃털·황금 눈 점 + 붉은 띠 전립 챙. 황동빛 철릭 소매·주름 치마 위 감청색 민소매 쾌자 조끼 + 붉은 전대(허리띠).

## 2. 검증 결과

- `node --check game/public/wardrobe_hanbok_sets.js`: 통과 (`exit 0`).
- **64×64 다종족 착용 검증 (`game/shots/gemini-wardrobe-hanbok-wear.png`)**:
  - 고양이(`sp:1`), 토끼(`sp:3`), 개구리(`sp:7`), 사슴(`sp:12`) × 정면 정지 / 측면 정지·보행 / 후면 정지·보행(`2×`/`1×`) 전체 확인.
  - `wardrobe.coversEyes` 눈 가림 검사: **0건**.
- **16×16 가방 아이콘 정규화 (`game/shots/gemini-wardrobe-hanbok-icons.png`)**:
  - 8종 모두 `import-art.mjs --size 16x16 --colors 16 --outline keep --force` 통과(`6~10 colours`, `0 specks cleaned`, `--install` 미실행).
  - 1차 검수에서 확인한 `top_hanbok_assi` 어깨 흰 픽셀 파편화 및 `hat_hanbok_king` 양 날개 간격을 수정해 재정규화·재검증 완료.

## 3. 추후 병합 메모 (주인 승인 후)

- `game/src/logic/65-cosmetics.js`: `COSMETIC_SETS.hanbok = "전통 한복"`, `HANBOK_COSMETICS`(권장 코드 `139..146`) 추가 후 `npm run build:logic`.
- `game/public/wardrobe.js`: `HANBOK_HAT` → `HAT`, `HANBOK_TOP` → `TOP`, `HANBOK_ART` → `ART` 병합.
- `game/public/art.js`: 승인 후 `asset/generated/hanbok-sets/icon_*.png`를 `--install`하거나 `HANBOK_ICONS` 반영.
