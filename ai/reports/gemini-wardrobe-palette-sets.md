# 팔레트 챌린지 의상 4세트(모자+상의+가방/망토 12종) 시안 보고

- **브랜치**: `gemini/work`
- **모듈**: [`game/public/wardrobe_palette_sets.js`](../../game/public/wardrobe_palette_sets.js)
- **아이콘 자산(미설치)**: [`asset/generated/palette-sets/`](../../asset/generated/palette-sets/) (`icon_*.png` 12종 + `*.prompt.md` 12개)
- **출처 기록**: [`asset/CREDITS.md`](../../asset/CREDITS.md)

## 1. 참고 팔레트 & 실루엣 설계 (총 4세트 · 12종, 날개 0종)

제시된 `TR's Palette Challenge` 색상 램프 4종과 의상 레퍼런스 시트(바시티 자켓·오픈 선바이저·아노락/데이팩·베레모/코트·퍼칼라 푸퍼/사각 사첼)를 조합해 **모자 + 상의 + 가방/망토** 3부위 코디로 제작했습니다.

1. **버블검 성운 (`Bubblegum Nebula`)**
   - `hat_pal_nebula`(*네뷸라 스냅백*) + `top_pal_nebula`(*버블검 바시티*) + `back_pal_nebula`(*네뷸라 메신저백*)
   - 파스텔 핑크·비비드 마젠타·미드나잇 네이비·크림 조합. 바시티 점퍼의 네이비 소매·리브 커프스·크림 스냅 플래킷, 전면 대각선 스트랩(`PALETTE_BACK_FRONT`)이 연결되는 핑크 플랩 메신저백.
2. **산호초 리조트 (`Great Barrier Reef`)**
   - `hat_pal_reef`(*리프 선바이저*) + `top_pal_reef`(*산호초 아노락*) + `back_pal_reef`(*산호초 데이팩*)
   - 아쿠아 틸·선릿 버터·코랄 피치·플럼 그림자 조합. 정수리·귀·뿔을 가리지 않는 오픈 크라운 선바이저, 컬러블록 셰브론 아노락, 코랄 하단 포켓·어깨끈이 달린 둥근 아웃도어 데이팩.
3. **포르투나 별빛 (`Fortuna`)**
   - `hat_pal_fortuna`(*포르투나 베레모*) + `top_pal_fortuna`(*라벤더 코트*) + `back_pal_fortuna`(*성운 별빛 반망토*)
   - 살구 골드·라벤더 라일락·일렉트릭 바이올렛·딥 인디고 조합. 한쪽 별 브로치 기울임 베레모, 살구색 셔츠 V넥과 금단추가 달린 승마형 라벤더 코트, 앞어깨 금별 클립으로 고정되는 비대칭 반망토.
4. **모닥불 × 심해 (`Bonfire × Challenger Deep`)**
   - `hat_pal_bonfire`(*모닥불 플랩캡*) + `top_pal_bonfire`(*본파이어 푸퍼*) + `back_pal_bonfire`(*본파이어 사첼*)
   - 엠버 오렌지·메리골드·크림 플리스와 심해 파인틸 대비 조합. 크림 플리스 귀덮개 트래퍼캡, 퀼팅 배플과 크림 플리스 스탠드 칼라가 돋보이는 푸퍼 파카, 오렌지 버클 스트랩이 달린 각진 파인틸 사첼.

## 2. 검증 결과

- `node --check game/public/wardrobe_palette_sets.js`: 통과 (`exit 0`).
- **64×64 다종족 3부위 착용 검증 (`game/shots/gemini-wardrobe-palette-wear.png`)**:
  - 고양이(`sp:1`), 토끼(`sp:3`), 개구리(`sp:7`), 사슴(`sp:12`) × 정면 정지 / 측면 정지·보행 / 후면 정지·보행(`2×`/`1×`) 전체 확인.
  - `wardrobe.coversEyes` 눈 가림 검사: **0건**.
- **16×16 가방 아이콘 정규화 (`game/shots/gemini-wardrobe-palette-icons.png`)**:
  - 12종 모두 `import-art.mjs --size 16x16 --colors 16 --outline keep --force` 통과(`6~8 colours`, `0 specks cleaned`, `--install` 미실행).
  - 1× 슬롯·6× 컬러·4× 흑백·4× 실루엣 모두 `#2b2233` 1px 외곽선과 고유 실루엣 확인 완료.

## 3. 추후 병합 메모 (주인 승인 후)

- `game/src/logic/65-cosmetics.js`: `COSMETIC_SETS.palette = "팔레트 컬렉션"`, `PALETTE_COSMETICS`(권장 코드 `147..158`) 추가 후 `npm run build:logic`.
- `game/public/wardrobe.js`: `PALETTE_HAT` → `HAT`, `PALETTE_TOP` → `TOP`, `PALETTE_BACK` → `BACK`, `PALETTE_BACK_FRONT` → `BACK_FRONT`, `PALETTE_ART` → `ART` 병합 (`HARD_BACKS`에 `"nebulaMessenger"`, `"reefDaypack"`, `"bonfireSatchel"` 추가 권장).
- `game/public/art.js`: 승인 후 `asset/generated/palette-sets/icon_*.png`를 `--install`하거나 `PALETTE_ICONS` 반영.
