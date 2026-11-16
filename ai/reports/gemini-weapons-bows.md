# 활(Bow) 무기 외형 컬렉션 10종 시안 보고

- **브랜치**: `gemini/work`
- **모듈**: [`game/public/weapons_bows_collection.js`](../../game/public/weapons_bows_collection.js)
- **아이콘 자산(미설치)**: [`asset/generated/bows/`](../../asset/generated/bows/) (`icon_ws_bow_*.png` 10종 + `*.prompt.md` 10개)
- **출처 기록**: [`asset/CREDITS.md`](../../asset/CREDITS.md)

## 1. 제작 품목 (총 10종 · 시위 당김/화살 애니메이션 완전 대응)

공유된 17종 판타지 활 레퍼런스 시트에서 실루엣과 상징 모티브 아이디어만 참고해 테일즈테일즈 `bow` 파라메트릭 규격(`bowParts`, `W=32, H=32, GRIP [5, 16]`, 당김 `pull: -0.25..1.0`·화살 `arrow: true` 대응)으로 새로 그렸습니다.

1. `ws_bow_seraph` (**천사 날개 성궁**) — 순백·은빛 리커브 위 날개 블레이드와 황금 깃끝 장식.
2. `ws_bow_cupidheart` (**큐피드 하트 윙 보우**) — 장미빛 활대에 루비 하트 메달과 작은 흰 날개·황금 소용돌이.
3. `ws_bow_ravenbone` (**칠흑 까마귀 해골궁**) — 손잡이 까마귀 두개골 부리와 홍염·상아 깃털 주술사 활.
4. `ws_bow_abyssalmaw` (**심연 비취 악마궁**) — 뿔 돋친 칠흑 마신 가면과 형광 맹독 비취 날개 활.
5. `ws_bow_floralfae` (**봄꽃 요정 덩굴궁**) — 푸른 잎사귀 덩굴 활대 위 피어난 분홍 봄꽃 송이.
6. `ws_bow_frostthorn` (**서리 은가시 수정궁**) — 날카로운 백은 얼음 가시와 사파이어 결정이 박힌 리커브.
7. `ws_bow_crimsonwyrm` (**진홍 용익 비늘궁**) — 진홍 비룡 날개 비늘과 양끝 상아 발톱 노크 장궁.
8. `ws_bow_sapphirethorn` (**청옥 혈가시 궁**) — 심해 청록 등줄기를 따라 붉은 가시가 촘촘히 돋친 마궁.
9. `ws_bow_goldendrake` (**황금 쌍룡 패왕궁**) — 손잡이 위아래에서 포효하는 황금 쌍룡 조각과 불꽃 끝단.
10. `ws_bow_cyberpink` (**네온 윙 아머 보우**) — 흑철 사이버 라이저와 네온 마젠타 코어 허브·흰 메카 윙.

## 2. 검증 결과

- `node --check game/public/weapons_bows_collection.js`: 통과 (`exit 0`).
- **기하 경계 검사 (정지 `pull=0` + 당김 `pull=0.8, arrow=true`)**: 10종 전체 `32×32` 캔버스 이탈 **0건**.
- **시각 시트 검증 (`game/shots/gemini-weapons-bows-sheet.png`)**:
  - 정지 시위(`3×`/`1×`), `+7` 당김·화살 착용 샷(고양이 궁수 측면 조준), 대각선 `16×16` 가방 아이콘(`pull=0.4, arrow=true`), 흑백·실루엣 대조 확인.
  - `sapphirethorn` 외곽 가시 돌출폭(`3.0 → 3.8`)과 `rc(1.5 → 2.2)` 보강으로 가시 실루엣 가독성 강화.
- **아이콘 정규화**: `asset/generated/bows/` 10종 모두 `import-art.mjs --size 16x16 --colors 16 --outline keep --force` 통과(`10~16 colours`, 외곽선 없는 1px 대각 시위 일부 speck 정리 외 본체/화살 완전 보존, `--install` 미실행).

## 3. 추후 병합 메모 (주인 승인 후)

- `game/public/weapons.js`: `BOW_COLLECTION_M` → `M`, `BOW_COLLECTION_EXTRA` → `EXTRA`, `BOW_SILHOUETTES` → `SIL.bow`, `MOTIF`·`MOTIF_SIL.bow` 병합.
- `game/src/logic/65-cosmetics.js`: `BOW_COLLECTION_META` (`ws_bow_*`, `slot: "wskin"`, `wk: "bow"`) 등록 후 `npm run build:logic`.
