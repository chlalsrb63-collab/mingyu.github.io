# 양손대검(Greatsword) 무기 외형 컬렉션 10종 시안 보고

- **브랜치**: `gemini/work`
- **모듈**: [`game/public/weapons_greatswords_collection.js`](../../game/public/weapons_greatswords_collection.js)
- **아이콘 자산(미설치)**: [`asset/generated/greatswords/`](../../asset/generated/greatswords/) (`icon_ws_sword_*.png` 10종 + `*.prompt.md` 10개)
- **출처 기록**: [`asset/CREDITS.md`](../../asset/CREDITS.md)

## 1. 제작 품목 (총 10종 · 레퍼런스 9종 실루엣 + 보너스 1종)

공유된 3×3 양손대검 레퍼런스 이미지에서 실루엣과 상징 배색 아이디어만 참고해 테일즈테일즈 `sword` 규격(`W=44, H=32, GRIP [5, 16]`, `s ∈ [-3.8, 36.5]`, `t ∈ [-12, 12]`)의 순수 코드 도형(`R`/`P`/`C`/`L`/`D`)으로 새로 그렸습니다.

1. `ws_sword_dawncloud` (**여명 구름 대검**) — 청동 클로버 코등이 + 복숭아 노을빛과 하늘빛이 물결치는 대리석 양날 대검.
2. `ws_sword_jadefalcon` (**비취 해적도 대검**) — 상아 자루 + 구멍 뚫린 강철 고리 핸드가드 + 날렵한 비취색 외날 사브르 대검.
3. `ws_sword_cyanguild` (**창공 태양 대검**) — 부채꼴 황금 태양 날개 코등이 + 아쿠아 에지 청록 수정 검신.
4. `ws_sword_amethystbroad` (**자수정 심판 대검**) — 청동 마름모 코등이(호박 보석) + 순백 중앙 능선이 빛나는 자수정 대검.
5. `ws_sword_thornviper` (**가시덩굴 독니 대검**) — 굽은 상아 갈고리 폼멜 + 황금 나뭇잎 코등이 + 역방향 가시 톱니 밀림 대검.
6. `ws_sword_starryedge` (**별밤 성운 대검**) — 비대칭 S자 보라 코등이 + 별빛 점무늬가 박힌 심야 우주빛 외날 대검.
7. `ws_sword_crescentfang` (**초승달 비철 대검**) — 손등을 감싸는 청록 너클 보우 가드 + 날카롭게 휜 흑요석 갈고리 대검.
8. `ws_sword_pillarbell` (**황금 신전 대봉검**) — 끝부분으로 갈수록 종 모양으로 넓어지는 장중한 황금 신전 기둥형 대검.
9. `ws_sword_abyssalcleaver` (**심연 별빛 대검**) — 검신 상단 구멍(`null` 컷아웃)과 성좌 점이 새겨진 묵직한 심해 클리버 대검.
10. `ws_sword_solaris` (**백열 성화 대검**, 보너스 10종째) — 중심 불꽃 홈을 품고 끝이 두 갈래로 갈라진 성기사 쌍날 대검.

## 2. 검증 결과

- `node --check game/public/weapons_greatswords_collection.js`: 통과 (`exit 0`).
- **기하 경계 검사**: 10종 전체 `44×32` 캔버스(`s ∈ [-4.2, 37.5]`, `t ∈ [-13, 13]`) 이탈 **0건**.
- **시각 시트 검증 (`game/shots/gemini-weapons-greatswords-sheet.png`)**:
  - 10종 각각의 `44×32` 월드 스프라이트(`2×`·`1×`), `+7` 강화 빛, 고양이 기사 손 착용 샷(`HOLD.sword` 각도), `16×16` 대각선 가방 아이콘(`1×`·`4×`), 흑백·실루엣 대조 확인.
  - 1차 검수에서 발견된 `cyanguild` 폼멜 좌측 여백(`-4.3` → `-3.9`)·날개 폭과 `jadefalcon` 고리 가드 내경(`1.4` → `1.9`)을 보정해 재검증 완료.
- **아이콘 정규화**: `asset/generated/greatswords/` 10종 모두 `import-art.mjs --size 16x16 --colors 16 --outline keep --force` 통과(`8~12 colours`, `0 specks cleaned`, `--install` 미실행).

## 3. 추후 병합 메모 (주인 승인 후)

- `game/public/weapons.js`: `GS_COLLECTION_M` → `M`, `GS_COLLECTION_EXTRA` → `EXTRA`, `GS_SILHOUETTES` → `SIL.sword`, `MOTIF`·`MOTIF_SIL.sword` 병합.
- `game/src/logic/65-cosmetics.js`: `GS_COLLECTION_META` (`ws_sword_*`, `slot: "wskin"`, `wk: "sword"`) 등록 후 `npm run build:logic`.
