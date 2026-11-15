# 보고서: 쥬쥬식당 협동 알바 도구·요리 아이콘 시안 6종 (`coop-diner`)

## 1. 수행한 작업 (원래 작업 행)
> `- [ ] [ART] 쥬쥬식당 협동 알바 도구·요리 아이콘 시안 6개(프라이팬, 쟁반, 샐러드, 생선구이, 스튜, 더러운 접시) 16×16 → asset/generated/coop-diner/, 프롬프트 파일 포함. 설치는 하지 말 것 (Owner 승인 후 Claude가 설치)`

## 2. 생성 및 변경 파일
- `asset/generated/coop-diner/pan.png`, `pan.prompt.md`
- `asset/generated/coop-diner/tray.png`, `tray.prompt.md`
- `asset/generated/coop-diner/salad.png`, `salad.prompt.md`
- `asset/generated/coop-diner/grilled_fish.png`, `grilled_fish.prompt.md`
- `asset/generated/coop-diner/stew.png`, `stew.prompt.md`
- `asset/generated/coop-diner/dirty_plate.png`, `dirty_plate.prompt.md`
- `asset/CREDITS.md` (출처 및 라이선스 `AI-generated (Gemini, prompt file)` 기록)

## 3. 파일별 1×(무채색 포함) 판독성 및 수정이 필요한 부분
`node game/scripts/import-art.mjs asset/generated/coop-diner/<name>.png --category generated/coop-diner --name <name> --size 16x16 --palette game --force`로 정규화 및 1× 무채색·실루엣 대조를 마쳤습니다.

| 파일 | 색상 수 | 1× 실루엣 및 무채색 판독성 | 수정이 필요한 부분 (설치/후속 다듬기 시 참고) |
| --- | --- | --- | --- |
| `pan.png` | 8색 | 우상단 둥근 무쇠 팬 몸통과 좌하단 끝까지 뻗은 **긴 나무 손잡이**로 프라이팬 형태가 즉시 읽힘 | 월드 손 파지(`tools.js`)로 쓸 때는 손잡이가 왼쪽 수평을 향하도록 회전 본이 별도로 필요함 |
| `tray.png` | 7색 | 16×7 비율의 **낮고 넓은 수평 테두리**와 좌우 손잡이 귀로 냄비·접시와 명확히 구분됨 | 위에 접시 2~3개를 얹는 상태 아이콘으로 합성할 경우 상단 여백(4px)에 접시 레이어를 추가하면 좋음 |
| `salad.png` | 9색 | 좁은 원뿔형 나무 볼 위로 **3개의 뾰족한 잎사귀 봉우리**가 솟아 무채색 1×에서도 생선·스튜와 구별됨 | 토마토(`#e04a3c`)와 달걀(`#fff0a0`) 조각의 명도 차가 1× 어두운 배경에서도 잘 보이나, 볼 그림자를 1px 줄이면 더 가벼워 보임 |
| `grilled_fish.png` | 10색 | 좌하단 주둥이에서 우상단으로 뻗은 **대각선 몸통 + 갈라진 V자 꼬리지느러미**와 석쇠 자국으로 색 없이도 생선구이로 읽힘 | 꼬리지느러미 우상단 끝과 접시 오른쪽 레몬/고명(`#a4e07a`) 사이 간격이 1px이라 1×에서 약간 조밀함 |
| `stew.png` | 9색 | **양손잡이 귀가 달린 깊은 통형 냄비**와 수평 국물 면, 상단 2줄기 김(`#f0f6ff`)으로 샐러드·생선구이와 실루엣이 완전히 다름 | 어두운 배경에서 오른쪽 손잡이 귀(`#373a46`)가 외곽선과 가까우므로 승인 후 설치 시 밝은 회색(`#9a9eaa`) 1px 보강 권장 |
| `dirty_plate.png` | 9색 | 납작한 접시 위로 삐져나온 **먹다 남은 뼈다귀 잔반**, 갈색·녹색 얼룩, 상단 악취 점(`#9a5ae0`)으로 깨끗한 접시·요리와 즉시 구분됨 | 상단 보라색 악취 점을 빼고 순수 접시+잔반만 남길지 주인 확인 필요 |

## 4. 미리보기 경로 (`gitignored`)
- 개별 정규화 비교본: `asset/_preview/pan.compare.png`, `asset/_preview/tray.compare.png`, `asset/_preview/salad.compare.png`, `asset/_preview/grilled_fish.compare.png`, `asset/_preview/stew.compare.png`, `asset/_preview/dirty_plate.compare.png`
- 6종 1× 컬러·무채색·실루엣·6× 통합 검증 시트: `asset/_preview/coop-diner-sheet.png`
