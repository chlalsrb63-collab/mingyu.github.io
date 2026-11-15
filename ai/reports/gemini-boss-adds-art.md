# 보스 2차 졸개 3종(`bloodshard`, `nightbat`, `hagfishhead`) 전용 픽셀 모델 개선 보고서

## 1. 수행한 작업
> `- [ ] [VFX] 새 보스 졸개 3종의 전용 그림: 혈루 결정 전갈 \`bloodshard\`(지금은 붉게 칠한 전갈), 밤장막 박쥐 \`nightbat\`(지금은 batcluster 색만 바꿈), 먹장어 머리 \`hagfishhead\`(지금은 eelknot). \`game/public/mobart_f.js\`의 보스 그림 방식 그대로, 지옥 괴수 느낌(귀엽지 않게), 16색 이내·외곽선. \`--page mobs --q "k=bloodshard,nightbat,hagfishhead&z=4"\` 스크린샷 1장`

- `game/public/mobart_bosses2_adds.js`의 보스 2차 졸개 3종(`bloodshard`, `nightbat`, `hagfishhead`) 모델을 `game/public/mobart_f.js`의 2차 보스 조형·팔레트 규칙(거의 검은 본체 + 뼈가면/갈비뼈 `#e8dfcf` + 단일 발광 악센트 + `#241a2a` 1px 외곽선)과 `.claude/skills/pixel-art/rules/54-monster-design.md` 지침에 맞춰 재설계했습니다.

## 2. 핵심 발견 및 조형 개선
- **팔레트 및 귀여움 요소 제거 (`16색 이내·외곽선`)**:
  - 기존 모델은 `M.eye()`(흰자+동공으로 귀여운 인상을 줌)와 `wet`/`drip` 재질을 사용해 종당 20~28색이 사용되었고, 보스(`mobart_f.js`)의 칠흑+백골+단일 발광 톤과 이질감이 있었습니다.
  - 이를 `mobart_f.js`의 재질(`HIDE`/`CLK`/`WH`, `flat: true` 보조 암부, `MASK`, `role: "glow"` 단일 악센트)과 `M.dot()` 안광으로 통일해 모든 방향·프레임 합산 **각 13색(외곽선 `#241a2a` 포함, 16색 이내)**으로 압축했습니다.
- **종별 실루엣 및 지옥 괴수 디테일**:
  - **혈루 결정 전갈 (`bloodshard`)**: 칠흑 갑각(`#1a1012`) 위로 갈라진 핏빛 균열(`#ff3b3b`)과 등줄기 혈루 결정 가시, 피눈물을 흘리는 백골 두개골 가면과 톱니 뼈 집게발, 꼬리 끝에서 달아오른 혈루 결정 독침(`#ffb0a0` 코어)을 구현했습니다.
  - **밤장막 박쥐 (`nightbat`)**: `cloakbat`의 찢어진 망토 자락에서 떨어진 설정에 맞춰, 솟은 뼈 귀뿔과 돼지코 해골 가면, 벌어진 뼈 갈비뼈 속 맥동하는 자홍빛 심장(`#d43cff`/`#ffd0f4`), 갈기갈기 찢긴 망토 리본형 날개 실루엣으로 재조형했습니다.
  - **먹장어 머리 (`hagfishhead`)**: 고래의 상처를 파고들어 고래 머리 행세를 한다는 도감 설정에 맞춰, 부서진 고래 갈비뼈 상처 더미 위로 솟아오른 칠흑빛 S자 몸통, 갈라진 백골 고래 아래턱과 이빨, 안쪽으로 굽은 원형 흡반 이빨 아가리와 청록빛 균열 코어(`#7ff6ff`/`#e0ffff`)를 구현했습니다.

## 3. 검증 및 산출물
- 수정 파일: `game/public/mobart_bosses2_adds.js` (`game/src/logic/` 미수정)
- 문법 및 경계 검증:
  - `node --check game/public/mobart_bosses2_adds.js` 통과
  - `node game/tests/mobart.mjs` 통과 (91종 × 12포즈 전 방향 캔버스 경계 및 유한 좌표 검증)
- 미리보기 스크린샷: `game/shots/gemini-adds.png` (`node game/scripts/shot.mjs --page mobs --q "k=bloodshard,nightbat,hagfishhead&z=4" --out shots/gemini-adds.png`)
