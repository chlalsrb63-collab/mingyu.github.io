# 외형 장비 · 무기 스킨 작업 보고서 — 백자 청화 어전무구 (D. 무기 스킨 7종)

## 1. 작업 개요
- **브랜치 / 작업 트리**: `gemini/work` (`.work/gemini`)
- **테마**: **백자 청화 어전무구 (Porcelain & Cobalt Armory)** — 앞선 작업(`windlantern` 바람등호 기관반, `neon_repair`, `crystal_delver`, `oasis_night`, `ferry`, `snow`) 및 기존 `weapons.js` 모티프(`sakura`/`frost`/`bone`/`star`/`flame` 등)와 겹치지 않도록 **순백 자기 유약 · 청화 코발트 당초문 · 자단목 · 청동 · 주사(붉은) 가마 인장** 조합으로 설계.
- **범위**: 7종 전 무기군(`sword`, `dagger`, `spear`, `staff`, `book`, `bow`, `hammer`) 각각의 고유 실루엣(`PORCELAIN_SHAPES`)과 월드 스프라이트·16×16 가방 아이콘 생성기를 `game/public/weapons_porcelain.js`에 분리 구현. 공용 `weapons.js`, `wardrobe.js`, `game/src/logic/**`는 수정하지 않음.

## 2. 제작 품목 (7종)

| 영문 ID | 한국어 이름 | 슬롯 / 무기군 | 재질 · 팔레트 | 실루엣 특징 | 획득 경로 제안 |
| --- | --- | --- | --- | --- | --- |
| `ws_porcelain_sword` | 백자 청화 참마도 | `wskin` / `sword` | 백자(`#ffffff`/`#eaeef8`/`#b4bfd8`), 청화(`#68a4ff`/`#2e62c8`), 자단·청동·인장 | 환두 자루, 청동 구름 코등이, 끝이 넓게 꺾인 참마도 검신 + 등쪽 청화 물결 띠 | 단풍 왕도 도공 장인 교환 (버드나무 토큰 120 / 45,000 골드) |
| `ws_porcelain_dagger` | 청화 연잎 비수 | `wskin` / `dagger` | 백자, 청화 잎맥, 자단·청동, 주사 매듭 술 | 연잎처럼 폭이 넓은 곡선 칼날 + 초승달 청동 코등이 + 뒤쪽 붉은 술 | 단풍 왕도 상점 외형 도안 (버드나무 토큰 90 / 32,000 골드) |
| `ws_porcelain_spear` | 청화 삼지 월아창 | `wskin` / `spear` | 자단 자루, 청동 테·발톱, 청화 반달날, 백자 창끝 | 비대칭 청화 반달 월아(상단) + 청동 반대 갈퀴(하단) + 붉은 끈 매듭 | 단풍 왕도 근위 병기고 (버드나무 토큰 120 / 45,000 골드) |
| `ws_porcelain_staff` | 청화 달항아리 향로봉 | `wskin` / `staff` | 자단 대, 청동 받침, 백자 달항아리, 청화 띠, 인장 구슬 | 양갈래 청동 뿔 받침 안에 떠 있는 백자 달항아리 향로 + 끝 방울 장식 | 일일 의뢰 보상 상자 / 가마 장인 교환 (버드나무 토큰 110) |
| `ws_porcelain_book` | 청화 가마 비결서 | `wskin` / `book` | 청화 표지, 백자 지면, 자단 책등, 청동 모서리·책갈피 | 정면 펼침 구도, 좌측 청화 문양·우측 필체, 상단 부유 도자기 인장 패 | 학자 길드 외형 도안 (버드나무 토큰 110 / 40,000 골드) |
| `ws_porcelain_bow` | 청화 백자 각궁 | `wskin` / `bow` | 백자 만곡 날개, 자단·청동 대잡이, 청화 마디, 건 시위 | 만곡 리커브 호를 그리는 순백 날개 + 청화 띠 + 청화 깃 화살 | 단풍 왕도 궁수 훈련장 (버드나무 토큰 120 / 45,000 골드) |
| `ws_porcelain_hammer` | 청화 백자 대절구망치 | `wskin` / `hammer` | 백자 양단 절구통, 청동 타격 테, 청화 링, 자단 자루 | 1.25× 대형 비율, 양끝 청동 보강 테와 중앙 가마 낙관을 지닌 절구형 타격부 | 필드 보스 외형 전리품 / 버드나무 토큰 140 |

## 3. 반영 대상 및 산출물 경로
- **코드 모듈 (커밋 포함)**: [`game/public/weapons_porcelain.js`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/public/weapons_porcelain.js)
  - 통합 시 `game/public/weapons.js`의 `M`, `SIL`, `MOTIF_SIL`, `MOTIF`에 병합하고, `game/src/logic/65-cosmetics.js`에 `ws_porcelain_*` 7종(`slot: "wskin"`, `wk`)을 등록하도록 메타데이터(`PORCELAIN_WEAPONS`) 포함.
- **정규화 16×16 가방 아이콘 (미설치 시안, `import-art.mjs` 통과)**:
  - `asset/generated/porcelain/icon_ws_porcelain_{sword,dagger,spear,staff,book,bow,hammer}.png` 및 각 `*.prompt.md`
  - 색상 수 `9~14색` (`<= 16`), 외곽선 `#111118` 유지.
- **출처 기록**: [`asset/CREDITS.md`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/asset/CREDITS.md)
- **로컬 미리보기 PNG (비추적 `game/shots/`)**:
  - [`gemini-wardrobe-porcelain-d-world.png`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-wardrobe-porcelain-d-world.png) — 7종 단독 스프라이트(+10 강화 포함) 및 64×64 작은꼬리 캐릭터 착용·액션 포즈(`2×` / `1×`)
  - [`gemini-wardrobe-porcelain-d-icons.png`](file:///c:/Users/mankyu/Desktop/Tales%20Tales/.work/gemini/game/shots/gemini-wardrobe-porcelain-d-icons.png) — 16×16 아이콘(`1×` 슬롯 · `5×` 컬러 · `5×` 명도 흑백 · `3×` 실루엣)

## 4. 검증 결과
- `node --check game/public/weapons_porcelain.js`: 통과 (오류 없음).
- `import-art.mjs --size 16x16 --colors 16 --outline keep`: 7종 모두 통과. 1차 검수에서 `spear`의 대각 축소 시 월아창 날이 작게 뭉치던 점과 `staff`의 1px 부유 잡티(`1 speck`)를 수정해 2차에서 `spear`/`staff` 실루엣 분리 및 `0 specks cleaned` 확인(`bow`는 대각 화살촉/깃 사이 `2 specks cleaned` 후 `1×` 시인성 유지).
- **월드·액션 포즈 검수 (`64×64` 캐릭터 기준)**:
  - `bow`: 대기(`pull=0`), 만작+화살(`pull=1, arrow=true`), 발사 반동(`pull=-0.25`) 모두 손잡이(`GRIP [5,16]`) 정렬과 시위 복원 확인.
  - `hammer`: `hammerPose` 상단 들어올림(`120°`)과 내려찍기(`slam`)에서 머리 위·지면 타점 및 1.25× 캔버스 여유 확인.
  - `book`: 정면 펼침 구도가 캐릭터 얼굴을 가리지 않고 앞쪽에 떠서 읽히며, `sword`/`dagger`/`spear`/`staff` 역시 `1×` 배율에서 형태와 재질 대비가 선명함.

현재 순서 완료: D. 모든 무기 스킨 7종 완료 (백자 청화 어전무구 `porcelain`). 다음 차례는 새 지역/직업 테마의 **A. 등 외형 3종**입니다.
