# 보스 2차 졸개 3종(`bloodshard`, `nightbat`, `hagfishhead`) 전용 스프라이트 구현 보고서

## 1. 원래 작업 행
> `- [ ] [VFX] 새 보스 졸개 3종의 전용 그림: 혈루 결정 전갈 \`bloodshard\`(지금은 붉게 칠한 전갈), 밤장막 박쥐 \`nightbat\`(지금은 batcluster 색만 바꿈), 먹장어 머리 \`hagfishhead\`(지금은 eelknot). \`game/public/mobart_f.js\`의 보스 그림 방식 그대로, 지옥 괴수 느낌(귀엽지 않게), 16색 이내·외곽선. \`--page mobs --q "k=bloodshard,nightbat,hagfishhead&z=4"\` 스크린샷 1장`

## 2. 종별 디자인 및 실루엣·팔레트 설계
- **공통 규칙 준수 (`.claude/skills/pixel-art/rules/`, `mobart_f.js` 방식)**:
  - 칠흑빛 본체(`#1a1012` / `#120a16` / `#0c1016`) + 백골 가면·갈비·턱(`#e8dfcf`) + 종별 단일 발광 악센트(`role: "glow"`) + 1px 짙은 외곽선(`#241a2a`)으로 통일했습니다.
  - 귀여운 인상을 주는 `M.eye()`(흰자+동공)와 불필요한 스페큘러(`wet`/`drip`)를 제거해, 전 방향·12프레임 합산 **종당 정확히 13색(16색 이하)**으로 제한했습니다.
- **혈루 결정 전갈 (`bloodshard` — 낮은 수평 쐐기 + 비대칭 결정 집게 + 각진 꼬리)**:
  - 우측(`s = +1`)에는 거대하게 비대해진 진홍빛 혈루 결정 분쇄 집게(`SEAM` 결정 괴와 대형 결정 날), 좌측(`s = -1`)에는 날렵한 백골 가위 집게(`MASK`)를 배치해 1배율에서도 비대칭 실루엣이 명확히 드러나도록 설계했습니다.
  - 부드러운 곡선 대신 4단계로 꺾이는 **각진 마디 꼬리**와 모서리 가시, 꼬리 끝에서 달아오른 각진 혈루 결정 독침(`#ffb0a0` 코어)과 피눈물 흘리는 백골 두개골 가면을 구현했습니다.
- **밤장막 박쥐 (`nightbat` — 찢어진 망토처럼 접히는 넓은 날개 + 흉곽 심장)**:
  - 대기 및 접힘 동작에서 넓은 날개가 어깨 바깥으로 솟았다가 몸통 둘레로 **찢어진 망토처럼 폭넓게 접혀 내려오는 실루엣**을 만들고, 비행·공격 시 갈기갈기 찢긴 4갈래 망토 리본 날개로 펼쳐지게 구성했습니다.
  - 돼지코 백골 해골 가면과 긴 귀뿔, 벌어진 뼈 갈비뼈 사이로 맥동하는 자홍빛 심장(`#d43cff`/`#ffd0f4`)을 배치했습니다.
- **먹장어 머리 (`hagfishhead` — 크게 벌어진 입 + 굵은 백골 아래턱)**:
  - 부서진 고래 갈비뼈 상처 더미 위로 S자 칠흑 몸통과 등줄기 청록 수정 가시(`#7ff6ff`)가 솟아오릅니다.
  - 상단 두개골과 안쪽으로 굽은 원형 흡반 이빨 아가리 아래로 **거대하고 굵은 백골 고래 아래턱(`MASK` 박스 조형 + 상향 송곳니)**이 앞으로 길게 돌출하며 크게 벌어져, 1배율에서도 벌어진 아가리와 굵은 턱의 실루엣이 기존 뱀·장어류와 즉시 구별됩니다.

## 3. 검증 결과 및 스크린샷 경로
- 수정 파일: `game/public/mobart_bosses2_adds.js`, `game/public/mobart_f.js` (`game/src/logic/` 및 통신 규격 미수정)
- 문법 및 경계 검증:
  - `node --check game/public/mobart_bosses2_adds.js` 통과
  - `node --check game/public/mobart_f.js` 통과
  - `node game/tests/mobart.mjs` 통과 (`91 creatures × 12 poses, 299728 shapes, all inside their canvases`)
  - 팔레트 검증: `bloodshard` 13색, `nightbat` 13색, `hagfishhead` 13색 (모두 외곽선 `#241a2a` 포함 16색 이하)
- 미리보기 스크린샷 경로: `game/shots/gemini-adds.png` (`node game/scripts/shot.mjs --page mobs --q "k=bloodshard,nightbat,hagfishhead&z=4" --out shots/gemini-adds.png`)
