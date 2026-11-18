# 마도서(Spellbook) 무기 외형 컬렉션 10종 시안 보고

- **브랜치**: `gemini/work`
- **모듈**: [`game/public/weapons_spellbooks_collection.js`](../../game/public/weapons_spellbooks_collection.js)
- **아이콘 자산(미설치)**: [`asset/generated/spellbooks/`](../../asset/generated/spellbooks/) (`icon_ws_book_*.png` 10종 + `*.prompt.md` 10개)
- **출처 기록**: [`asset/CREDITS.md`](../../asset/CREDITS.md)

## 1. 제작 품목 (총 10종 · 레퍼런스 10종 반영)

공유된 10종 스펠북 레퍼런스 시트에서 표지 상징·배색·갈피 실루엣 아이디어만 참고해 테일즈테일즈 `book` 규격(`32×32` 정면 부유형 `[16, 16]` + 직립 `16×16` 아이콘)의 순수 코드 도형(`R`/`P`/`C`/`L`/`D`)으로 새로 그렸습니다. 기존 `BOOK`의 펼친 책과 달리 모두 **표지 인장 + 좌측 책등 + 하단 지면 페이지 블록 + 금박 모서리 + 책갈피 리본**이 드러나는 닫힌 마도서 형태입니다.

1. `ws_book_azuretide` (**해일 비술 마도서**) — 청사파이어 표지 + 아쿠아 덩굴 테두리·황금 진주핵·파랑 책갈피.
2. `ws_book_sunember` (**태양륜 화염 마도서**) — 적갈색 표지 + 8방향 황금 태양 가시·주홍 불꽃핵·붉은 책갈피.
3. `ws_book_eclipsevoid` (**월식 암흑 마도서**) — 심야 남색 표지 + 보라빛 마법 타원 고리·황금 십자별 성검 인장.
4. `ws_book_crimsonseal` (**홍옥 봉인 마도서**) — 왕실 진홍 표지 + 황금 마름모 결계 봉인·홍옥 보석.
5. `ws_book_lunarjade` (**초승달 비취 마도서**) — 짙은 비취색 표지 + 황금 초승달·4각 별빛·붉은 책갈피.
6. `ws_book_heartblood` (**장미 성혈 마도서**) — 붉은 장미 표지 + 상단 쌍구슬 황금 성배 문장·진주핵.
7. `ws_book_runeforge` (**대장간 룬문자 마도서**) — 마호가니 가죽 표지 + X자 황금 룬 격자·루비 봉인.
8. `ws_book_holyparchment` (**성좌 양피지 법전**) — 순백 양피지 표지 + 진홍빛 5각 오망성 문장·파랑 책갈피.
9. `ws_book_emberflower` (**홍련 불꽃 마도서**) — 암적색 표지 + 6꽃잎 황금 불꽃 송이·주홍 진주.
10. `ws_book_arcaneeye` (**비전 자수정 눈 마도서**) — 로열 바이올렛 표지 + 금테 자수정 눈 보주·붉은 책갈피.

## 2. 검증 결과

- `node --check game/public/weapons_spellbooks_collection.js`: 통과 (`exit 0`).
- **기하 경계 검사**: 10종 전체 `32×32` (`[-12, 12]`) 경계 이탈 **0건**.
- **시각 시트 검증 (`game/shots/gemini-weapons-spellbooks-sheet.png`)**:
  - 10종 각각의 `32×32` 월드 스프라이트(`3×`·`1×`), `+7` 강화 빛, 고양이 마법사 옆 부유 착용 샷(`HOLD.book.style = 'float'`), 직립 `16×16` 가방 아이콘(`1×`·`4×`), 흑백·실루엣 확인.
  - `holyparchment` 오망성 내부 빈 틈을 진홍 중심 원(`C`)으로 메워 1배율 가독성 보완 완료.
- **아이콘 정규화**: `asset/generated/spellbooks/` 10종 모두 `import-art.mjs --size 16x16 --colors 16 --outline keep --force` 통과(`11~16 colours`, `0 specks cleaned`, `--install` 미실행).

## 3. 추후 병합 메모 (주인 승인 후)

- `game/public/weapons.js`: `BOOK_COLLECTION_M` → `M`, `BOOK_COLLECTION_EXTRA` → `EXTRA`, `BOOK_SILHOUETTES` → `SIL.book`, `MOTIF`·`MOTIF_SIL.book` 병합.
- `game/src/logic/65-cosmetics.js`: `BOOK_COLLECTION_META` (`ws_book_*`, `slot: "wskin"`, `wk: "book"`) 등록 후 `npm run build:logic`.
