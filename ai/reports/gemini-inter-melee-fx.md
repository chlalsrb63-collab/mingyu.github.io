# A [VFX] 평타 사이 근접 공격 이펙트 3종 제작 보고서

## 1. 작업 내용 및 변경 파일
- **작업 구분**: `A [VFX]` — 평타 사이에 쓰는 근접 공격 이펙트 3종 (대검 호 검기, 창 직선 찌르기, 양손해머 지면 파문·돌 파편)
- **변경 파일**:
  - `game/public/skillfx.js`: 3단계(예비 동작·타격·소멸) 근접 공격 이펙트 렌더러 구현 및 독립 호출용 export 추가
  - `game/public/events.js`: 양손해머 기본/강타 예비 동작(`a` 이벤트 `7, 130, 131, 132`) 시 지면 예고 브래킷(`SkillFx.hammerWindup`) 연결

## 2. 연결 구조 및 Codex 연동 인터페이스 (`skillfx.js` ↔ `events.js`)
- **현재 연결 방식**:
  - `events.js`의 `processEvents`가 서버 스냅샷 이벤트를 받아 `SkillFx.skillEvent(e, ctx)`로 전달하며, 해머 평타/강타(`e[0]==="a"`, `e[2]===7|130..132`)는 예비 동작 타이밍(`hammerWind`) 설정 시 `SkillFx.hammerWindup(x, y, hRad, wind, yaw)`을 호출하고 타격 시점의 `["hm", eid, x, y, r, hit, crit, kind]` 이벤트가 `hammerImpact`를 호출함.
  - 스킬 이벤트(`["fx", eid, sid, x, y, tx, ty]`)는 `skillfx.js`의 `cast()` 스위치에서 스킬 번호(`sid`)별로 분기됨 (`80`: 파워 슬래쉬 → `swordCrescent`, `87`: 나선 찌르기 → `spiralThrust`).
- **독립 렌더러 Export (새 직업/평타 사이 스킬 코드에서 즉시 호출 가능)**:
  - 대검 호 검기: `SkillFx.meleeSwordArc(x, y, ang, r = 46, arcDeg = 75)` (기존 `swordCrescent` / `sid: 80` 호환)
  - 창 직선 찌르기: `SkillFx.meleeSpearThrust(ax, ay, bx, by, half = 12, farRatio = 0.72)` (기존 `spiralThrust` / `sid: 87` 호환)
  - 양손해머 파문·돌 파편: `SkillFx.hammerWindup(x, y, r, windMs, ang)`, `SkillFx.hammerImpact(x, y, r, hit, crit, kind, ang)`, 또는 단일 호출용 `SkillFx.meleeHammerSlam(x, y, r = 28, ang = 0, crit = false, kind = 130, windMs = 150)`

## 3. 무기별 3단계 연출 및 1배율 가독성 설계
- **대검 (`meleeSwordArc`)**:
  - **예비 동작 (`k < 0.19`)**: 시작각(`-halfArc`) 뒤쪽으로 당겨진 칼날 라인과 짧은 집기 광점.
  - **타격 (`0.19 <= k < 0.60`)**: 꼬리(`-halfArc`)는 얇고 진행 방향 끝(`+halfArc`)은 두꺼운 사선 칼끝으로 벌어지는 비대칭 강철 초승달 검기(`#181425` 외곽선 + `#5376ab`/`#8eb4e6`/`#ffffff`) 및 부채꼴 양 끝 경계 틱(`r=46`).
  - **소멸 (`k >= 0.60`)**: 호 궤적을 따라 8개의 계단형 픽셀 검기 파편으로 분리되며 외곽으로 흩어짐.
- **창 (`meleeSpearThrust`)**:
  - **예비 동작 (`k < 0.18`)**: 시전자 뒤로 당겨진 창끝과 좌우 타격 폭(`±12px`) 가이드 틱.
  - **타격 (`0.18 <= k < 0.62`)**: 짙은 외곽선 직선 창대·이중 나선 기류·72% 원거리 약점 황동 링과 함께, 끝점 `(bx, by)`에 마름모 미늘 창날과 꺾쇠형 끝점 고정 마커(`#fff6b8`/`#ffffff`)를 배치해 최대 사거리를 1배율에서 즉시 판독.
  - **소멸 (`k >= 0.62`)**: 창대 루트부터 끝점 순으로 분절 소멸하며 끝점 꺾쇠가 마지막까지 남음.
- **양손해머 (`hammerWindup` + `hammerImpact`)**:
  - **예비 동작**: 착지 반경(`r`) 외곽에서 안쪽으로 수축하는 4방향 오픈 브래킷과 타격 진행선.
  - **타격**: 착지점에서 퍼지는 8분할 지면 파문(정면 3분할 강조), 포물선으로 튀어 오르는 3면 픽셀 돌 파편(`stoneDebris`: 밝은 윗면·중간 돌면·어두운 그림자면 + 짙은 외곽선), 방사형 지면 균열.
  - **소멸**: 돌 파편이 바닥에 한 번 튕긴 뒤 작은 자갈 픽셀로 정착 후 사라지며 지면 균열이 끝에서부터 닫힘.
- **시인성 보호**: 틱마다 반복되는 불투명 대형 섬광을 배제하고 지면 링을 분절형 오픈 아크로만 그려, 4인 파티+다수 몬스터+보스 바닥 전조(`bt`) 중첩 시에도 전조 경계선과 대피 방향이 선명하게 유지됨.

## 4. 검증 및 미리보기 스크린샷
- 문법 검증: `node --check game/public/skillfx.js`, `node --check game/public/events.js` 통과
- 빈 지형 3단계(예비 동작·타격·소멸) 비교: `game/shots/gemini-inter-melee-phases.png`
- 4인 이펙트 + 일반/엘리트 몬스터 + 보스 바닥 전조(`bt`) 복합 중첩 확인: `game/shots/gemini-inter-melee-overlap.png`
