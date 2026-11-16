# 양손해머(Two-Handed Hammer) 무기 외형 컬렉션 10종 시안 보고

- **브랜치**: `gemini/work`
- **모듈**: [`game/public/weapons_hammers_collection.js`](../../game/public/weapons_hammers_collection.js)
- **아이콘 자산(미설치)**: [`asset/generated/hammers/`](../../asset/generated/hammers/) (`icon_ws_hammer_*.png` 10종 + `*.prompt.md` 10개)
- **출처 기록**: [`asset/CREDITS.md`](../../asset/CREDITS.md)

## 1. 제작 품목 (총 10종 · 레퍼런스 9종 실루엣 + 보너스 1종)

공유된 3×3 양손해머 레퍼런스 이미지에서 실루엣과 상징 배색 아이디어만 참고해 테일즈테일즈 `hammer` 규격(`W=40, H=36, scale=1.25, GRIP [5, 16]`, `s ∈ [-3.2, 24.5]`, `t ∈ [-11.5, 11.8]`)의 순수 코드 도형(`R`/`P`/`C`/`L`/`D`)으로 새로 그렸습니다.

1. `ws_hammer_royalpaladin` (**백은 성기사 대형 망치**) — 날개 강철 코등이 + 양끝 금빛 타격면·진홍 띠·백은 인장 드럼 망치.
2. `ws_hammer_bloodforge` (**혈철 마신 대형 망치**) — 검붉은 양손 톱니 발톱 타격면과 중앙 빈 눈(`null` 컷아웃)이 뚫린 마신 망치.
3. `ws_hammer_sumpick` (**황금 곡괭이 망치**) — 땋은 황금 갈퀴 목 + 편평한 황금 망치 머리와 굽은 파갑 곡괭이 부리가 맞선 망치.
4. `ws_hammer_dragoncleave` (**쌍룡 도끼 망치**) — 황금 용 소용돌이 목 장식 위에 사선 연마된 거대 백은 부월 망치.
5. `ws_hammer_gearfoundry` (**태엽 강철 톱니 망치**) — 황금 띠를 두른 거대 검은 철 원통과 맞은편 강철 모루가 대비되는 공방 망치.
6. `ws_hammer_cathedral` (**심홍 성당 십자 망치**) — 징 박힌 황금 탑 머리와 심홍 성당 첨탑 피크·십자 끝창이 솟은 심문관 망치.
7. `ws_hammer_glacierorb` (**빙결 쌍보주 망치**) — 황금 집게 양쪽에 거대한 빛나는 만년설 빙정 보주 두 개를 단 성물 망치.
8. `ws_hammer_eyeabyss` (**심안 광기 모닝스타**) — S자로 휘어진 고목 자루 끝 가시철구 속에서 타오르는 황금 눈이 번뜩이는 심연 망치.
9. `ws_hammer_warforge` (**전쟁공방 쇠망치**) — 금빛 사각 슬레지와 예리한 백은 백피크가 조화를 이룬 정통 기사 쇠망치.
10. `ws_hammer_meteor` (**유성운철 대형 망치**, 보너스 10종째) — 어두운 팔각 운철 덩어리 균열 사이로 용암 빛이 새어 나오는 대모루 망치.

## 2. 검증 결과

- `node --check game/public/weapons_hammers_collection.js`: 통과 (`exit 0`).
- **기하 경계 검사**: 10종 전체 `40×36 @ 1.25×` 캔버스 이탈 **0건**.
- **시각 시트 검증 (`game/shots/gemini-weapons-hammers-sheet.png`)**:
  - 10종 각각의 `40×36` 월드 스프라이트(`2×`·`1×`), `+7` 강화 빛, 고양이 기사 손 착용 샷(`HOLD.hammer` 각도), `16×16` 대각선 가방 아이콘(`1×`·`4×`), 흑백·실루엣 대조 확인.
  - 1차 검수에서 확인된 폼멜 좌측 여백(`sumpick`, `glacierorb`, `warforge`)과 `sumpick` 하단 곡괭이 부리 곡률을 보완해 재검증 완료.
- **아이콘 정규화**: `asset/generated/hammers/` 10종 모두 `import-art.mjs --size 16x16 --colors 16 --outline keep --force` 통과(`9~13 colours`, `0 specks cleaned`, `--install` 미실행).

## 3. 추후 병합 메모 (주인 승인 후)

- `game/public/weapons.js`: `HAMMER_COLLECTION_M` → `M`, `HAMMER_COLLECTION_EXTRA` → `EXTRA`, `HAMMER_SILHOUETTES` → `SIL.hammer`, `MOTIF`·`MOTIF_SIL.hammer` 병합.
- `game/src/logic/65-cosmetics.js`: `HAMMER_COLLECTION_META` (`ws_hammer_*`, `slot: "wskin"`, `wk: "hammer"`) 등록 후 `npm run build:logic`.
