# 직업 제복 코스튬 4세트(모자+상의 8종) 시안 보고

- **브랜치**: `gemini/work`
- **모듈**: [`game/public/wardrobe_career_uniforms.js`](../../game/public/wardrobe_career_uniforms.js)
- **아이콘 자산(미설치)**: [`asset/generated/career-uniforms/`](../../asset/generated/career-uniforms/) (`icon_*.png` 8종 + `*.prompt.md` 8개)
- **레퍼런스 기록**: [`asset/CREDITS.md`](../../asset/CREDITS.md)

## 1. 제작 품목 (총 4세트 · 8종)

기존 `wardrobe.js`의 `chefcoat`, `safari`, `suit`, `willowPatrol`, `survey`, `archive`와 겹치지 않도록 직업군별 상징 실루엣·배지·배색을 분리했습니다.

1. **경찰 (`hat_career_police` + `top_career_police`)** — *경찰 정모 + 경찰 제복*
   - **특징**: 짙은 경찰 네이비 정모에 흰색 밴드·중앙 금장 방패 배지·검정 바이저(`ears: "through"`). 상의는 아이스블루 V칼라·네이비 넥타이·금장 견장·가슴 방패 배지·은색 버클 듀티 벨트(측/후면 무전기 파우치).
   - **종족 대응**: 개구리(`A.bumps`) 착용 시 눈 혹 사이에 정모가 깔끔히 안착하도록 폭을 `8.5 / 7.5`로 좁혀 눈 가림 `0`건 유지.
2. **간호사 (`hat_career_nurse` + `top_career_nurse`)** — *간호사 캡 + 간호사 가운*
   - **특징**: 각진 흰색 너스캡 중앙 적십자 마크와 민트 하단 띠(`ears: "through"`). 가운은 순백 플레어 코트(보행 시 밑단 흔들림 `stepSwing`), 파스텔 민트 V칼라·밑단 파이핑, 목에 건 스틸블루 청진기 라인, 가슴 적십자 명찰.
3. **소방관 (`hat_career_fire` + `top_career_fire`)** — *소방 헬멧 + 소방 방화복*
   - **특징**: 상단 능선과 금장 실드가 있는 크림슨 소방 헬멧 + 후면·측면 다크 노멕스 목 보호 플랩(`ears: "behind"`, 개구리 눈 혹 자동 보존). 상의는 황금오커 방화 코트 + 하이비즈 형광라임·실버 이중 반사 안전띠 + 수직 멜빵/후면 구조띠.
4. **항공 기장 (`hat_career_pilot` + `top_career_pilot`)** — *기장 정모 + 기장 제복*
   - **특징**: 백색 상단 크라운으로 경찰 정모와 명확히 대비되며, 챠콜 밴드 위 금장 코드와 펼친 날개(윙) 휘장(`ears: "through"`). 상의는 챠콜 더블 브레스트 블레이저 + 4줄 금장 견장·소매 계급 줄무늬 + 흰 셔츠·버건디 타이·더블 금장 단추.

## 2. 검증 결과

- `node --check game/public/wardrobe_career_uniforms.js`: 통과 (`exit 0`).
- **64×64 다종족 착용 검증 (`game/shots/gemini-wardrobe-career-wear.png`)**:
  - 고양이(`sp:1`), 토끼(`sp:3`), 개구리(`sp:7`), 사슴(`sp:12`) × 정면 정지 / 측면 정지·보행 / 후면 정지·보행(2배 확대 + 1배 원본) 전체 확인.
  - `wardrobe.coversEyes` 눈 가림 검사: 전 종족 × 전 모자 × 정·측면 **0건**.
  - 1차 렌더에서 발견한 개구리 모자 폭 과다 및 흰 간호사 가운 위 청진기 대비 약화 수정 후 2차 재렌더·재확인 완료.
- **16×16 가방 아이콘 정규화 (`game/shots/gemini-wardrobe-career-icons.png`)**:
  - 8종 모두 `import-art.mjs --size 16x16 --colors 16 --outline keep --force` 통과(`8~10 colours`, `0 specks cleaned`, `--install` 미실행).
  - 1× 슬롯·6× 컬러·4× 흑백·4× 실루엣에서 8종 상호 구분 및 외곽선 일관성 확인(경찰 정모 배지 중앙 정렬, 간호사 가운 `+` 십자 및 청진기 대비 보완 후 재검증).

## 3. 추후 병합 메모 (주인 승인 후)

- `game/src/logic/65-cosmetics.js`: `COSMETIC_SETS.career = "직업 제복"`, `CAREER_COSMETICS`(권장 코드 `131..138`) 추가 후 `npm run build:logic`.
- `game/public/wardrobe.js`: `CAREER_HAT` → `HAT`, `CAREER_TOP` → `TOP`(64×64 커스텀 함수 지원 시 `wearTop`에서 `typeof t === "function"` 분기 추가), `CAREER_ART` → `ART` 병합.
- `game/public/art.js`: 승인 후 `asset/generated/career-uniforms/icon_*.png`를 `--install`하거나 `CAREER_ICONS` 템플릿 반영.
