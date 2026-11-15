# 스킬 이펙트·타격음 점검표 보고서 (`gemini-fx-audit`)

## 1. 원래 작업 행
- `- [ ] [VFX] 스킬 이펙트·타격음 점검표: 모든 액티브 스킬 35개와 직업 스킬(game/src/logic/03-skills.js·02-jobs-stats.js의 fx 번호)마다 지금 화면에 무엇이 그려지고(game/public/skillfx.js, swing.js, events.js, growth.js) 어떤 소리가 나는지(game/public/audio.js) 표로 정리하고, "약함/보통/좋음"과 이유를 매겨 docs/fx-audit.md에 작성. 맨 아래에 고칠 순서(약한 것부터) 목록. 코드는 고치지 말 것`

## 2. 점검 요약
- **조사 범위**: `03-skills.js` 및 `02-jobs-stats.js`의 무기 액티브 16종(`kind: "a"`), 단일 직업 시그니처 7종(`kind: "j"`), 복합 직업 시그니처 12종(`kind: "h"`), 무기 패시브 6종(`kind: "p"`), 그리고 `skillfx.js` 내 예비/구버전 `fx` 5종(`101, 121, 122, 123, 127`)과 기본 평타 7종까지 전수 대조함.
- **등급 분포 (정식 액티브·시그니처 35종)**:
  - **좋음 (17종)**: `slash`, `shade`, `rally_banner`, `frostring`, `revive_binding`, `hammer_stamp`, `hammer_fault`, `meteor`, `pact`, `hammer_final`, `traps`, `elemfan`, `frostspire`, `runecircle`, `inkshot`, `ironsiege`, `oathward`
  - **보통 (9종)**: `ambush`, `spiral`, `fireball`, `soulbolt`, `dragon`, `rain`, `crimson`, `bloodburst`, `sanctuary`
  - **약함 (9종)**:
    - 근접/돌진/회전: `rend`(공용 `f.ring` 나열 + 몬스터 `slam` 재사용), `comet`(폭 `half: 20` 및 기절 착지 충격파 미표시 + `hundred` 재사용), `verdict`(`r: 70` 회전 참격에 직선 `f.slash` 2줄만 출력), `flurry`(7연타가 단색 `f.beam`+공용 `f.slash`), `crosscut`(`r: 64, arc: 100°`에 얇은 `f.slash` 2줄만 출력), `dive`(`r: 110` 강하에 낮은 점선과 공용 `f.ring`만 출력)
    - 원거리/마법: `pierce`(`ARROW_LOOK[2]` 미정의로 평타 화살과 동일), `leapshot`(`ln: 8` 직선 빔 + `ARROW_LOOK[3]` 미정의로 평타 화살과 동일), `gravity`(도트 조형 없이 안티에일리어싱된 `g.arc` 원호 3개만 회전)
- **고칠 순서 목록**: `docs/fx-audit.md` 하단(§5)에 후속 `[VFX]` 1~3차 작업(검·단검·창 → 지팡이·마도서·활 → 직업 스킬) 및 `[SFX]` 작업이 바로 참조할 수 있도록 1~4순위(총 21개 항목)로 정리함.

## 3. 변경 파일 및 검증
- `docs/fx-audit.md` (신규 작성, 게임 코드는 수정하지 않음)
- `ai/reports/gemini-fx-audit.md` (본 보고서)
