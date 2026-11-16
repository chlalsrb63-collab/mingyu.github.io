# 단검(Dagger) 무기 외형 컬렉션 10종 시안 보고

- **브랜치**: `gemini/work`
- **모듈**: [`game/public/weapons_daggers_collection.js`](../../game/public/weapons_daggers_collection.js)
- **아이콘 자산(미설치)**: [`asset/generated/daggers/`](../../asset/generated/daggers/) (`icon_ws_dagger_*.png` 10종 + `*.prompt.md` 10개)
- **출처 기록**: [`asset/CREDITS.md`](../../asset/CREDITS.md)

## 1. 제작 품목 (총 10종 · 테일즈테일즈 단검 비율 최적화)

공유된 10종 블레이드 레퍼런스 시트에서 상징 배색과 코등이 실루엣 아이디어를 얻어, 테일즈테일즈 `dagger` 규격(`W=32, H=32, GRIP [5, 16]`, 총 길이 `s ∈ [-3.5, 18.5]`, `t ∈ [-7.2, 7.2]`)의 짧고 통통한 단검 비율로 새로 그렸습니다.

1. `ws_dagger_silversteel` (**은빛 기사단 단검**) — 가죽 손잡이·S자 백은 코등이·양날 은빛 비수.
2. `ws_dagger_sunburst` (**홍염 태양 단검**) — 황금 반달 코등이·노랑/진홍 분리 날·불꽃 점.
3. `ws_dagger_frostglaive` (**빙하 결정 단검**) — 서릿발 곡선 가드·사파이어 폼멜 보석·얼음 결정 날.
4. `ws_dagger_midnightcross` (**성은 스틸레토**) — 붉은 자루·날씬한 흑철 십자 코등이·중앙 홈 스틸레토.
5. `ws_dagger_solardisk` (**해시계 아쿠아 비수**) — 뾰족한 황금 태양 바퀴 코등이(루비 눈)·시안 수정 날.
6. `ws_dagger_vortexcyan` (**심해 아쿠아 단검**) — 붉은 날개 코등이·시안 보주 폼멜·아쿠아 양날 단검.
7. `ws_dagger_shadowfeather` (**칠흑 깃털 번개 단검**) — 갈라진 칠흑 깃털 뭉치 가드·자수정 핵·푸른 번개 혈관 날.
8. `ws_dagger_moltenvein` (**용암 혈맥 단검**) — 암적색 요철 가드·화산암 칼날 위 번쩍이는 용암 줄기.
9. `ws_dagger_jadeblossom` (**비취 가드 홍매 단검**) — 민트 비취 덩굴 가드·분홍 장미 석영 단검신.
10. `ws_dagger_infernoclaw` (**적염 가시 지옥 단검**) — 앞을 향해 치켜뜬 붉은 악마 뿔 가드·타오르는 호박빛 날.

## 2. 검증 결과

- `node --check game/public/weapons_daggers_collection.js`: 통과 (`exit 0`).
- **기하 경계 검사**: 10종 전체 `dagger` `32×32` (`s ∈ [-4, 21]`, `t ∈ [-8, 8]`) 경계 이탈 **0건**.
- **시각 시트 검증 (`game/shots/gemini-weapons-daggers-sheet.png`)**:
  - 10종 각각의 `32×32` 월드(`4×`/`1×`), `+7` 강화 빛, 고양이 도적 손 착용 샷(`GRIP [5, 16]`), `16×16` 대각선 가방 아이콘(`1×`·`4×`), 흑백·실루엣 대조 확인.
  - `shadowfeather` 깃털 가드 윤곽을 뾰족한 다중 깃끝으로 다듬어 실루엣 가독성 보강.
- **아이콘 정규화**: `asset/generated/daggers/` 10종 모두 `import-art.mjs --size 16x16 --colors 16 --outline keep --force` 통과(`8~16 colours`, `0 specks cleaned`, `--install` 미실행).

## 3. 추후 병합 메모 (주인 승인 후)

- `game/public/weapons.js`: `DAGGER_COLLECTION_M` → `M`, `DAGGER_COLLECTION_EXTRA` → `EXTRA`, `DAGGER_SILHOUETTES` → `SIL.dagger`, `MOTIF`·`MOTIF_SIL.dagger` 병합.
- `game/src/logic/65-cosmetics.js`: `DAGGER_COLLECTION_META` (`ws_dagger_*`, `slot: "wskin"`, `wk: "dagger"`) 등록 후 `npm run build:logic`.
