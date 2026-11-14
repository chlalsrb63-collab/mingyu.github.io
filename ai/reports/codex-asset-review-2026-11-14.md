# 검 시트 에셋 검수 · 2026-11-14

## 원본

`asset/generated/`에 기존 검수 대상은 없었다. 이번에 요청받은 검 시트 1장인 `sword_sheet_01.png`를 ChatGPT 이미지 생성으로 제작해 원본 그대로 보관했다. [무기 프롬프트 B](../prompts/weapon-assets.md)의 검 8종을 윗줄 5종, 아랫줄 3종으로 배치했다. CREDITS에 이미 설치된 이미지로 기록된 항목은 없었다.

원본은 1774×887이고 반투명 픽셀이 601,654개였다. 11개 스캔 행에서 완전히 불투명한 동일색 구간 15개를 확인했으며, 길이는 1–2px로 8px의 배수가 없었다. 가져오기 도구도 공통 격자를 검출하지 못했다. `--fit`으로 16×16 검수 후보를 만들었고, 표의 판정에 원본 격자와 1배율 가독성을 반영했다.

## 판정

아래 후보 경로의 기준은 `asset/weapons/sword/`다. 모든 후보에서 16×16 크기, 우상향 날 방향, 반투명 픽셀 0개, 하나의 연결 성분, 4방향 경계의 `#2b2233` 외곽선을 확인했다. 모두 위·아래·왼쪽이 캔버스에 닿는다. 색 수는 PNG 완성본에서 센 값이다. 각 후보의 `asset/_preview/<이름>.compare.png`와 `asset/_export/weapons/sword/`의 대응 코드를 1×와 확대 뷰에서 대조했다.

| 파일 | 정규화 결과 | 판정 | 비고 |
| --- | --- | --- | --- |
| `sword_sheet_01.png` 윗줄 1 | `icon_sword_t1.png` | **FIX** · 1px 여백을 확보하고 녹슨 날의 패임을 큰 도트로 정리 | 11색. 녹슨 갈색과 철 가드는 읽히고, 작은 패임은 테두리에 묻힌다. |
| `sword_sheet_01.png` 윗줄 2 | `icon_sword_t2.png` | **FIX** · 14×14 영역 안에 날과 가드를 손으로 배치 | 10색. 강철의 밝고 어두운 면은 구분된다. 홈과 손잡이의 대비는 코드판이 더 선명하다. |
| `sword_sheet_01.png` 윗줄 3 | `icon_sword_t3.png` | **FIX** · 금 가드와 보석을 1px 여백 안에 다시 배치하고 날 면을 단순화 | 11색. 금 가드는 가장 잘 읽히는 구분점이며 보석은 확대해야 선명하다. 네 변에 모두 닿는다. |
| `sword_sheet_01.png` 윗줄 4 | `icon_sword_t4.png` | **CONCEPT ONLY → 프롬프트 A로 코드 작화** · 청록 에너지를 이어진 날 선으로 표현 | 10색. 청록색이 날끝·가드에 따로 남아 하이테크 날보다 작은 점으로 보인다. |
| `sword_sheet_01.png` 윗줄 5 | `icon_sword_t5.png` | **CONCEPT ONLY → 프롬프트 A로 코드 작화** · 갈고리 외곽과 보랏빛 균열을 강조 | 9색. 갈고리 상단은 구분되지만 균열과 떠 있는 수정 조각은 축소 후 한 몸에 묻힌다. |
| `sword_sheet_01.png` 아랫줄 1 | `icon_sword_lg_chain.png` | **CONCEPT ONLY → 프롬프트 A로 코드 작화** · 양쪽 날의 물결과 번개 한 줄을 크게 잡기 | 9색. 물결날과 번개가 1×에서 거의 사라지고 일반 밝은 강철검과 비슷해진다. |
| `sword_sheet_01.png` 아랫줄 2 | `icon_sword_lg_nova.png` | **CONCEPT ONLY → 프롬프트 A로 코드 작화** · 직사각형 날에 큰 불꽃 균열 배치 | 13색. 넓은 붉은 날은 전설 중 가장 잘 구분된다. 여러 주황색 조각을 하나의 균열로 정리할 여지가 있다. |
| `sword_sheet_01.png` 아랫줄 3 | `icon_sword_lg_thorn.png` | **CONCEPT ONLY → 프롬프트 A로 코드 작화** · 큰 톱니 2–3개로 외곽을 구분 | 11색. 녹색 띠는 보이지만 톱니와 가시가 작은 도트로 합쳐진다. |

## 재현 방법

`game/`에서 실행했다.

```powershell
node scripts/import-art.mjs ../asset/generated/sword_sheet_01.png --split --names icon_sword_t1,icon_sword_t2,icon_sword_t3,icon_sword_t4,icon_sword_t5,icon_sword_lg_chain,icon_sword_lg_nova,icon_sword_lg_thorn --fit --colors 12 --palette game
npm run art:export
npm run art:gallery
```

코드 그림 505개를 내보냈고 갤러리에 파일 525개를 인덱싱했다. 내보내기용 임시 페이지에 `/favicon.ico` 404 한 건이 기록됐다. 후보 8개는 비교용 PNG다. 별도의 수평 무기 시트와 지팡이 이미지는 입력 폴더에 없어서 월드 스프라이트 검수 대상은 0개였다.

## 설치 승인용 자료

**INSTALL 판정 0건.** 이번 검수분에 해당하는 CREDITS 초안과 설치 명령은 없다.
