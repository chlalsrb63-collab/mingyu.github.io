# 스태프(Staff) 무기 외형 컬렉션 10종 시안 보고

- **브랜치**: `gemini/work`
- **모듈**: [`game/public/weapons_staves_collection.js`](../../game/public/weapons_staves_collection.js)
- **아이콘 자산(미설치)**: [`asset/generated/staves/`](../../asset/generated/staves/) (`icon_ws_staff_*.png` 10종 + `*.prompt.md` 10개)
- **출처 기록**: [`asset/CREDITS.md`](../../asset/CREDITS.md)

## 1. 제작 품목 (총 10종 · 레퍼런스 9종 실루엣 + 보너스 1종)

공유된 3×3 RPG 스태프 시트에서 아이디어(실루엣·상징 모티브)만 참고해 테일즈테일즈 무기 공간(`s ∈ [-3.8, 25.5]`, `t ∈ [-11, 11]`, `GRIP [5, 16]`)의 순수 코드 도형(`R`/`P`/`C`/`L`/`D`)으로 새로 그렸습니다.

1. `ws_staff_sunflare` (**태양륜 작열 지팡이**) — 붉은 불꽃 가시가 돋은 황금 오픈 링과 중앙 태양핵.
2. `ws_staff_eclipse` (**월식 홍염 지팡이**) — 황금 테두리를 두른 가시 돋친 자줏빛 초승달과 홍염 구슬.
3. `ws_staff_sovereign` (**황금 왕홀**) — 쌍날개 황금 관 아치가 감싸 안은 사파이어 보주.
4. `ws_staff_templar` (**성전사 십자 지팡이**) — 사방 끝과 칼라에 비취·시안 수정을 박은 4방 황금 십자 지팡이.
5. `ws_staff_wyrm` (**황금 용두 지팡이**) — 상아 발톱 폼멜과 붉은 자루 위 은빛 갈기·비취 눈을 새긴 S자 황금 용머리.
6. `ws_staff_amethyst` (**자수정 세발 완드**) — 보라·황금 마디 자루 끝에서 세 가닥 황금 발톱이 자수정 원석을 감싼 지팡이.
7. `ws_staff_coralvine` (**혈산호 진주 지팡이**) — 붉은 산호 덩굴이 자루를 휘감고 은백 진주를 받든 지팡이.
8. `ws_staff_tideorb` (**심해 해일 보주 지팡이**) — 삼지창 폼멜과 짙은 코발트 파도 갈고리가 푸른 해일 보주를 감싼 지팡이.
9. `ws_staff_sylvan` (**고목 덩굴 목장**) — 상아 손잡이·나뭇잎 장식·에메랄드 세공이 어우러진 굽은 목장 지팡이.
10. `ws_staff_astral` (**성화 등불 지팡이**, 보너스 10번째) — 청동·황금 목장 갈고리 끝에 청록빛 영혼 등불 케이지를 매단 치유사용 지팡이.

## 2. 검증 결과

- `node --check game/public/weapons_staves_collection.js`: 통과 (`exit 0`).
- **기하 경계 검사**: 10종 전체 `32×32` 캔버스(`s ∈ [-4, 26]`, `t ∈ [-13, 13]`) 이탈 **0건**.
- **시각 시트 검증 (`game/shots/gemini-weapons-staves-sheet.png`)**:
  - 10종 각각의 `32×32` 월드 스프라이트(`3×`·`1×`), `+7` 강화 빛Preview, 고양이 마법사 손 착용 샷(`GRIP [5, 16]` 회전), `16×16` 대각선 가방 아이콘(`1×`·`4×`), 흑백·실루엣 대조 확인.
  - 1차 검사에서 발견된 폼멜 좌측 여백 초과(`-4.5` → `-3.7`) 및 `templar` 칼라 보석·`amethyst` 발톱 간격·`astral` 등불 고리 연결(`L` → `R`) 보완 후 재검증 완료.
- **아이콘 정규화**: `asset/generated/staves/` 10종 모두 `import-art.mjs --size 16x16 --colors 16 --outline keep --force` 통과(`9~13 colours`, `--install` 미실행).

## 3. 추후 병합 메모 (주인 승인 후)

- `game/public/weapons.js`: `STAFF_COLLECTION_M` → `M`, `STAFF_COLLECTION_EXTRA` → `EXTRA`, `STAFF_SILHOUETTES` → `SIL.staff`, `MOTIF`·`MOTIF_SIL.staff` 병합.
- `game/src/logic/65-cosmetics.js`: `STAFF_COLLECTION_META` (`ws_staff_*`, `slot: "wskin"`, `wk: "staff"`) 등록 후 `npm run build:logic`.
