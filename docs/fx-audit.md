# 스킬 이펙트·타격음 점검표 (`docs/fx-audit.md`)

`game/src/logic/03-skills.js` 및 `02-jobs-stats.js`에 정의된 모든 무기 액티브 스킬(`kind: "a"`), 단일 직업 시그니처 스킬(`kind: "j"`), 복합 직업 시그니처 스킬(`kind: "h"`), 패시브 발동(`kind: "p"`), 그리고 `game/public/skillfx.js`에 남아 있는 예비/구버전 `fx` 코드까지 전수 조사하여 현재 화면 연출(`skillfx.js`, `swing.js`, `events.js`, `growth.js`)과 효과음(`audio.js`)을 점검한 문서다.

---

## 1. 평가 기준

- **좋음**:
  1. 픽셀 아트 스타일(짙은 외곽선 + 1단계 명암 + 하이라이트, 안티에일리어싱 없는 도트 실루엣)의 전용 궤적/조형이 `03-skills.js`의 실제 타격 범위(`r`, `len`, `half`, `arc`)와 일치함.
  2. 시전 → 궤적/지속 → 착탄/폭발 단계가 시각적으로 구분됨.
  3. 다른 스킬이나 몬스터 사운드와 겹치지 않는 전용 시전음·착탄음(`audio.js`)이 연결되어 있음.
- **보통**:
  1. 전용 픽셀 연출이 일부 있으나 사거리 끝단/폭(`half`)/강타 구간(`far`) 표시가 부족하거나, Canvas2D 기본 원호(`g.arc`/`g.ellipse`)에 의존함.
  2. 시전음은 있으나 착탄음/지속 타격음이 빠져 있거나 공용 효과음을 재사용함.
- **약함**:
  1. 스킬 고유의 도트 실루엣 없이 공용 파티클(`f.ring`, `f.burst`, `f.slash`, `f.beam`)이나 기본 평타 화살(`ARROW_LOOK` 미지정)만 재사용하여 실제 판정 범위나 무기 개성이 읽히지 않음.
  2. 몬스터 공용 사운드(`slam`), 다른 스킬 사운드(`hundred`), 또는 평타/치명타 사운드만 재생됨.

---

## 2. 기본 평타 및 무기 타격음 요약 (`events.js` / `swing.js` / `audio.js`)

| 무기 (`wk`) | `attackFx` 코드 (`a`) | 화면 연출 (`swing.js` / `events.js`) | 시전음 (`audio.js`) | 적중음 (`d` 이벤트) | 비고 |
| --- | --- | --- | --- | --- | --- |
| `sword` (검) | `0` (3타 콤보) | `STROKES.sword` 3연속 베기 호 + 3타 `finisher` 오버헤드 링 | `swing_sword(beat)` | `hit("sword")` / `crit` / `finisher` | 3타 강타 연출·사운드 양호 |
| `dagger` (단검) | `5` (3타 콤보) | `STROKES.dagger` 짧은 사선 베기 + 3타 X자 교차 베기 | `swing_dagger(beat)` | `hit("dagger")` / `crit` / `finisher` | 빠르고 날카로운 톤 양호 |
| `spear` (창) | `1` (3타 콤보) | `STROKES.spear` 직선 찌르기 창날 + 충격 링 | `swing_spear(beat)` | `hit("spear")` / `crit` / `finisher` | 직선 리치 표현 양호 |
| `hammer` (해머) | `7` (2타 콤보) | `STROKES.hammer` 묵직한 내려치기 + 바닥 충격파 | `swing_hammer(beat)` | `hit("hammer")` / `crit` / `finisher` | 저음 타격감 우수 |
| `staff` (지팡이) | `3` + `ar(1)` | `STROKES.staff` 휘두르기 + 보라 마력탄(`ar` `kind: 1`) | `swing_staff` + `cast` | `hit("staff")` / `crit` | 마력탄 궤적 단순 |
| `book` (마도서) | `6` + `ar(6)` | `bookPose` 펼침 + 보라 마도서 탄환(`ARROW_LOOK[6]`) | `swing_book` | `hit("book")` / `crit` | `ARROW_LOOK[6]` 전용 도트 적용됨 |
| `bow` (활) | `2` + `ar(0)` | `bowPose` 당김 + 기본 화살(`ar` `kind: 0`) | `bow_draw` + `bow_shot` | `hit("bow")` / `crit` | 스킬 화살(`pierce`, `leapshot`)과 외형이 겹침 |

---

## 3. 전체 액티브 · 직업 시그니처 · 패시브 스킬 점검표

### 3-1. 무기 액티브 스킬 (`kind: "a"`, 16종)

| ID · 한글 이름 | 무기 · 습득 | `fx` 코드 (보조 이벤트) | 판정 범위 (`03-skills.js`) | 현재 화면 연출 (`skillfx.js` / `swing.js` / `events.js`) | 현재 효과음 (`audio.js`) | 등급 | 판정 이유 및 개선 포인트 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **`slash`**<br>파워 슬래쉬 | `sword`<br>Lv.1 | `fx: 80` | 부채꼴 `r: 46`, `arc: 75°` | `swing.js` 검 3타 모션 + `swordCrescent(r=46)` 청백색 도트 검기 초승달 + 착탄 얼음빛 파편(`shards` 5개) + `B.shake(6)` | 시전: `power_slash`<br>적중: `hit("sword")` | **좋음** | `r: 46` 사거리에 맞춘 도트 초승달 검기와 파편, 전용 `power_slash` 효과음이 잘 맞물림 |
| **`rend`**<br>대지 가르기 | `sword`<br>Lv.10 | `fx: 81` (도약 착지)<br>`fx: 82` (균열파)<br>`ln: 9` (도약선) | 도약 `60` + 착지 `r: 38` + 전방 균열 `len: 120, half: 14` | `ln: 9` 점선 도약 호 + `81`: 공용 `f.ring(38)`·`f.crack`·`f.burst(22)` + `82`: `along(..., 14)` 따라 `f.ring(10)`과 `setTimeout` 먼지 `f.burst(6)` 나열 | `81`: `slam` (몬스터 공용 내려찍기음)<br>`82`: `quake` | **약함** | 도트 균열 그래픽 없이 공용 원형 `f.ring`과 `setTimeout` 먼지만 나열되어 폭 `28px(half: 14)`·길이 `120`의 대지 균열 판정이 안 읽히며, 시전음도 몬스터 공용 `slam`을 재사용함 |
| **`ambush`**<br>암습 | `dagger`<br>Lv.1 | `fx: 84`<br>`ln: 6` (점멸선)<br>(`fx: 19`: 대상 없음) | 사거리 `len: 110`, 등 뒤 `behind: 16` | `ln: 6` 보라색 `streakWake` 잔상선 + `fx: 84` `ambushCuts`(짧은 사선 2줄, `span 9~13px`) + `arrowHit` + `B.shake(3.5)` | 시전: `swap` (가벼운 위치교환 사인파 스윕) | **보통** | 이동 잔상(`streakWake`)은 있으나 등 뒤 급소 베기(`ambushCuts`)가 작고, 효과음 `swap`이 암살 타격감보다 단순 텔레포트 소리에 가까움 |
| **`shade`**<br>그림자 칼날 | `dagger`<br>Lv.10 | `fx: 85`<br>`ln: 7` ×3 | 3갈래 부채꼴 `spread: 15°`, `len: 120, half: 10` | `fx: 85` 손끝 보라 스파크 + `ln: 7`마다 `shadowDart`(외곽선 도트 단검 + 이중 보라 궤적선 `185ms`) | 시전: `shade` (3연속 노이즈 버스트 + 하강 사인파) | **좋음** | 3갈래 도트 단검 실루엣과 사거리 `120` 궤적, 3연속 투척음(`shade`)이 정확히 대응함 |
| **`spiral`**<br>나선 찌르기 | `spear`<br>Lv.1 | `fx: 87`<br>(`tip` 패시브 연동) | 직선 `len: 110, half: 12`, 끝단 `far: 0.72` | `spiralThrust`(청록 도트 창대 + 이중 나선 사인파 도트 점열 `215ms`) + `B.shake(3.5)` | 시전: `spiral`<br>끝단 적중: `tip` | **보통** | 나선 줄기는 깔끔하나 핵심 기믹인 **창끝 강타 구간(`72%~100%` 지점)**이 궤적 끝에서 시각적으로 강조되지 않음 |
| **`comet`**<br>유성창 | `spear`<br>Lv.10 | `fx: 88`<br>`ln: 3` (돌진선) | 돌진 `len: 130, half: 20` (적 끌고 감 + 기절 `500ms`) | `ln: 3` 청록·금빛 `streakWake(w=8)` + `fx: 88` 착지점에 작은 `arrowHit`·`flash(6)`·7개 `f.burst`만 표시 | 시전: `hundred` (구 백렬창 사운드 재사용)<br>착지음 없음 | **약함** | 폭 `40px(half: 20)`로 적을 끌고 가 기절시키는 대기술인데 돌진 폭이 좁게(`w=8`) 그려지고, 종착지 기절 충격파 조형과 묵직한 착지음이 전혀 없음 |
| **`rally_banner`**<br>전열 구호기 | `spear`<br>Lv.15 | `fx: 135`<br>`pr`/`pp` `"banner"`<br>`h` (`cue: 4`) | 반경 `r: 76`, 지속 `6000ms` | `rallyPennant`(도트 황동 창 + 펄럭이는 청록 깃발 + `r: 76` 점선 고리) + 매초 `pp` 파동(`wave`+`rim`) + 아군 회복 시 `supportMend` 십자 도트 | 설치: `rally_banner`<br>회복: `rally_mend` | **좋음** | 도트 깃발 오브젝트, `r: 76` 장판 경계, 박동 파문, 전용 설치·회복 사운드 모두 완성도 높음 |
| **`fireball`**<br>파이어볼 | `staff`<br>Lv.1 | `fx: 70`<br>`b` (`kind: 10` 화상장판) | 폭발 `r: 30`, 화상장판 `3000ms` | 시전자→목표까지 단색 직선 `f.beam` + 착탄 `flash`·`wave(30)`·`rim(30)`·화염 `shards(7)` + 장판 틱마다 작은 `f.burst`/`f.ring` | 시전·폭발: `ember` + `boom`<br>화상 틱: 무음 | **보통** | 착탄 폭발(`r: 30` 테두리+파편)은 좋으나, 날아가는 화염구 투사체 없이 즉발 직선 `f.beam`만 그어지며 3초 화상 지대의 바닥 불씨 유지 연출이 약함 |
| **`frostring`**<br>서리 고리 | `staff`<br>Lv.10 | `fx: 71`<br>`fz` (빙결) | 반경 `r: 56`, 빙결 `1000ms`, 밀침 `18` | `flash` + `wave(56)` + 이중 컬러 `rim(56)` + 얼음 결정 `shards(12)` + 빙결 대상 얼음 감옥(`signs.fz`) | 시전: `frost` | **좋음** | `r: 56` 빙결 링과 12개 얼음 파편이 선명함 (단, `frost` 효과음에 얼음 파열 타격감을 조금 더 보강하면 더 좋음) |
| **`soulbolt`**<br>영혼 화살 | `book`<br>Lv.1 | `fx: 91`<br>`h` (흡혈 회복) | 사거리 `len: 150`, 속도 `350` | `soulTrail`(보라 다이아몬드 도트 탄두 + 사인파 이중 궤적) + 도착 시각(`later(ms)`)에 `flash`·`rim(16)`·`shards(5)` | 발사: `soulbolt`<br>착탄·흡혈: 무음 | **보통** | 도트 영혼 탄환과 비행 후 착탄 연출은 좋으나, 탄환이 꽂힐 때의 착탄음과 체력 흡수 피드백 사운드가 없음 |
| **`gravity`**<br>중력 왜곡진 | `book`<br>Lv.10 | `fx: 92`<br>`pr`/`pp` `"grav"` | 거리 `at: 70`, 반경 `r: 60`, 지속 `4000ms` (`500ms` 주기 끌림) | 시전 시 공용 `f.ring(60)` + `placeProp("grav")`가 안티에일리어싱된 Canvas2D `g.arc(lineWidth=3)` 곡선 3개만 회전시킴 + 틱마다 공용 `f.ring` | 설치: `gravity`<br>틱: `gravity_tick` | **약함** | 전용 사운드는 있으나, 화면 연출이 픽셀 아트가 아닌 매끈한 `g.arc` 선 3개와 공용 `f.ring`뿐이라 중심으로 끌어당기는(`pull: 6`) 암흑 중력장 느낌이 살지 않음 |
| **`revive_binding`**<br>되살림 제본 | `book`<br>Lv.15 | `fx: 136`<br>`h` (`cue: 5`) | 반경 `r: 105` (부활/치유) | `bindingFolio`(펼쳐지는 도트 마도서 페이지 + 금장 장식 + 솟아오르는 도트 리본 + `r: 105` 이중 `rim`) + 아군 `supportMend` | 시전: `revive_binding`<br>치유: `revive_mend` | **좋음** | 도트 마도서 펼침 조형과 리본, `r: 105` 범위 표시, 전용 부활·치유 사운드 모두 우수함 |
| **`pierce`**<br>관통 화살 | `bow`<br>Lv.1 | `fx: 94`<br>`ar` (`kind: 2`) | 길이 `len: 180`, 속도 `600`, 폭 `r: 8` | 활 시전 모션 + 시전자 앞 `f.flash(10)`이 전부. 날아가는 화살(`ar` `kind: 2`)은 `ARROW_LOOK[2]`가 정의되지 않아 **일반 평타 화살과 100% 동일한 외형** | 시전: `bow_draw` + `bow_shot` + `pierce` | **약함** | 전용 효과음(`pierce`)만 있을 뿐, 화면에서는 평타 화살과 구별되지 않으며 관통 풍압이나 충격 고리가 전혀 없음 |
| **`leapshot`**<br>도약 사격 | `bow`<br>Lv.10 | `fx: 95`<br>`ln: 8` (후방도약)<br>`ar` (`kind: 3`) ×5 | 후방 도약 `back: 60` + 5갈래 화살 `spread: 30°, len: 150` | `ln: 8`이 점프 호가 아닌 평면 직선 `f.beam("#d8c8a0")`을 그림 + 5발 화살(`ar` `kind: 3`) 역시 `ARROW_LOOK[3]` 미정의로 **일반 평타 화살과 동일** | 시전: `bow_draw` + `bow_shot` + `leapshot` | **약함** | 후방 도약이 공중 점프가 아니라 바닥 직선 줄(`f.beam`)로 보이고, 5갈래 화살도 평타 화살 그대로라 Lv.10 기술다운 시각적 쾌감이 부족함 |
| **`hammer_stamp`**<br>쐐기찍기 | `hammer`<br>Lv.1 | `fx: 130` (선딜)<br>`hm` (`130` 착지) | 전방 `center: 23`, 반경 `r: 28`, 선딜 `200ms` | `hammerPose(200ms)` 오버헤드 선딜 + 착지 시 `hammerImpact(130)` (`wave`, `rim(28)`, 청백색 `shards` 5개, 3갈래 도트 지면 균열) | 선딜: `swing_hammer`<br>착지: `hammer_land(130)` | **좋음** | 200ms 선딜 모션과 착지 순간의 도트 균열·파편·전용 쐐기 타격음(`130`)이 정확히 맞물림 |
| **`hammer_fault`**<br>금맥 벌리기 | `hammer`<br>Lv.10 | `fx: 131` (선딜)<br>`hm` (`131` 착지)<br>`crk` (균열 폭발) | 전방 `center: 24`, 반경 `r: 31`, 선딜 `200ms` | `hammerPose(200ms)` + `hammerImpact(131)` (황금·호박색 이중 `rim(31)`, `shards` 7개, 7갈래 도트 광맥 균열) + 대상 폭발 시 `crk` 파편 | 선딜: `swing_hammer`<br>착지: `hammer_land(131)` | **좋음** | `hammer_stamp` 대비 확실히 확장된 황금 균열과 묵직한 암석 파쇄음(`131`)을 갖춤 |

---

### 3-2. 단일 직업 시그니처 스킬 (`kind: "j"`, 7종 — 무기 숙련 Lv.30 해금)

| ID · 한글 이름 | 직업 · 무기 | `fx` 코드 (보조 이벤트) | 판정 범위 (`03-skills.js`) | 현재 화면 연출 (`skillfx.js` / `events.js`) | 현재 효과음 (`audio.js`) | 등급 | 판정 이유 및 개선 포인트 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **`verdict`**<br>단죄의 일격 | 대검전사<br>(`sword` 30) | `fx: 83`<br>`bw: 2` | 주변 회전 베기 `r: 70` (잃은 체력 비례 피해) | `fx: 83`은 공용 `f.storm(70)` + 직선 `f.slash` 2줄만 그리고, `bw: 2`가 공용 `f.ring`·`f.crack`·`f.burst`를 호출함 | 시전: `verdict` | **약함** | 쿨타임 36초짜리 대검전사 궁극기(반경 `70` 대회전 참격)인데 도트 회전 검기 없이 작은 직선 `f.slash` 2개와 공용 `f.ring`만 나와 위력과 범위를 전혀 체감할 수 없음 |
| **`flurry`**<br>무영난무 | 도적<br>(`dagger` 30) | `fx: 86` (시전/연타)<br>`ln: 5` ×7 | 반경 `r: 90` 내 7회 무적 점멸 베기 (`220ms` 간격) | 첫 시전 시 공용 `f.burst`+`f.storm`; 7회 점멸(`ln: 5`)마다 단색 직선 `f.beam("#7a4ac8")` + 타격(`fx: 86, extra: 1`)마다 공용 `f.slash` 2줄 | 시전·점멸: `dance`<br>연타 적중: 공용 `crit` | **약함** | 7회 무적 연속 암살 궁극기임에도 그림자 분신 잔상이나 도트 X자 검격 없이 단색 직선 `f.beam`과 공용 `f.slash`만 반복되며, 타격음도 일반 `crit`을 재사용함 |
| **`dragon`**<br>뇌룡승천 | 창술사<br>(`spear` 30) | `fx: 89`<br>`pr`/`pp` `"pillar"` | 전방 `at: 80`, 반경 `r: 64`, 3회 낙뢰(`400ms` 간격, 막타 띄움) | 시전 시 `zap` + 이중 `rim(64)` + `shards(8)`; 장판 `"pillar"`는 바닥 `groundRing`만 그리고 3회 `pp` 틱마다 공용 번개줄 `B.fx.zap`만 내려침 (막타에 `ring`+`crack`) | 시전: `dragon`<br>1·2타: `bolt`<br>3타: `dragon_final` | **보통** | 전용 사운드(`dragon` / `dragon_final`)와 시전 테두리는 좋으나, 스킬 이름인 **승천하는 번개 용 기둥** 조형이 없고 3회 타격이 일반 `zap` 번개줄에 그침 |
| **`meteor`**<br>메테오 스톰 | 마법사<br>(`staff` 30) | `fx: 90`<br>`pr`/`pp` `"meteor"`<br>`ln: 4` (연쇄번개) | 거리 `at: 120`, 장판 `r: 80`, 운석 6회(`hr: 30`) | `groundRing(80)` 위로 6회 `pp`마다 대각선으로 떨어지는 도트 운석 기둥(`145ms`) + 착탄 `flash`·`wave(30)`·`crack`·화염 `shards(7)` + 연쇄 번개 `ln: 4` | 시전: `meteor_cast`<br>낙하: `meteor_hit`<br>연쇄: `bolt` | **좋음** | 6발 운석 각각의 낙하 궤적, 분화구 균열, 파편, 화면 흔들림, 전용 시전·낙하 사운드가 잘 구현됨 |
| **`pact`**<br>심연의 계약 | 마도사<br>(`book` 30) | `fx: 93`<br>`pr`/`pp` `"phantom"`<br>`bw: 15` (만료 폭발) | 반경 `r: 80`, 6초간 심연 마수 소환 (`600ms` 공격) | 도트로 직접 그린 심연 마수(`phantom`: 호흡하는 그림자 몸체 + 붉은 안광 + 꼬리 연기)가 적을 추적해 할퀴고(`pp`), 종료 시 `bw: 15` 저주 폭발 | 소환: `pact`<br>할퀴기: `phantom_bite`<br>폭발: `pact_end` | **좋음** | 전용 도트 소환수 스프라이트와 추적 애니메이션, 3종 전용 효과음(`pact`, `phantom_bite`, `pact_end`)까지 완비됨 |
| **`rain`**<br>화살비 | 궁수<br>(`bow` 30) | `fx: 96`<br>`pr` `"rain"` | 거리 `at: 110`, 반경 `r: 70`, 지속 `3000ms` (`300ms` 주기) | `bowup` 하늘 조준 모션 + `arrowRain(r=70, 3000ms)` (26개의 도트 화살이 대각선으로 쏟아지며 바닥에 꽂히는 틱 연출) | 시전: `bow_draw` + `bow_shot` + `rain`<br>지속 3초: 무음 | **보통** | 하늘로 쏘는 모션과 도트 화살비(`arrowRain`) 비주얼은 좋으나, 첫 0.6초 시전음 이후 **3초 동안 화살비가 쏟아지는 내내 환경/낙하 효과음이 전혀 없음** |
| **`hammer_final`**<br>파성추 | 파괴자<br>(`hammer` 30) | `fx: 132` (선딜)<br>`hm` (`132` 착지) | 전방 `center: 22`, 반경 `r: 36`, 선딜 `400ms` | `hammerPose(400ms)` 긴 선딜 + `hammerImpact(132)` (`wave`, `crack`, 이중 `rim(36)`, 솟구치는 바위 `shards` 10개, 8갈래 분기형 도트 대지 균열, `B.shake(9)`) | 선딜: `swing_hammer`<br>착지: `hammer_land(132)` (초저음 서브베이스+파쇄음) | **좋음** | 400ms 선딜 압축감과 8갈래 분기 도트 균열, 서브베이스 타격음이 어우러져 근접 타격감이 가장 뛰어남 |

---

### 3-3. 복합 직업 시그니처 스킬 (`kind: "h"`, 12종 + 예비/구버전 `fx` 5종)

| ID · 한글 이름 | 복합 직업 · 무기 조합 | `fx` 코드 (보조 이벤트) | 판정 범위 (`03-skills.js`) | 현재 화면 연출 (`skillfx.js` / `events.js`) | 현재 효과음 (`audio.js`) | 등급 | 판정 이유 및 개선 포인트 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **`crimson`**<br>원소 마검: 홍련참 | 마검사<br>(`sword`+`staff`) | `fx: 97`<br>`rx: 3` (과부하) | 직선 검기파 `len: 160, half: 20` (화염+번개) | 작은 도트 화염 초승달(`~16px` 폭)이 날아가며 뒤에 단색 `f.beam` 1줄을 남김; 적 적중 시 `rx: 3` 과부하 폭발 | 시전: `crimson`<br>적중: `overload` | **보통** | 도트 화염 초승달과 전용 사운드는 있으나, 실제 판정 폭인 `40px(half: 20)`에 비해 투사체가 작고 화염·번개 이중 속성이 궤적에서 잘 드러나지 않음 |
| **`traps`**<br>사방의 그림자 덫 | 추적자<br>(`dagger`+`bow`) | `fx: 98`<br>`ln: 8` + `dc`<br>`pr`/`pe` `"trap"` ×4 | 후방 도약 `40` + 분신(`dc`) + 4방위 덫(`ring: 45, trig: 14`) | 반투명 보라색 플레이어 분신(`dc`) + 바닥 도트 마법진 덫 4개(`trap`) + 격발(`pe`) 시 3연속 베기·화살 스파크 폭발 | 설치: `decoy`<br>격발: `decoy_pop` | **좋음** | 분신, 4방위 도트 덫, 격발 시 다단 히트 연출과 전용 사운드가 명확함 |
| **`dive`**<br>심연의 강림 | 용기사<br>(`spear`+`book`) | `fx: 99`<br>`ln: 9` + `bw: 9`<br>`pr` `"field"` | 도약 `at: 120`, 착지 충격파 `r: 110`, 흡혈장판 `field: 70, 4000ms` | `ln: 9` 낮은 점선 도약 호 + `fx: 99` 공용 `f.fall` + `bw: 9` 공용 `f.crack`·`f.ring(110)`·`f.burst(34)` + 장판 `groundRing(70)`과 점 8개 | 시전: `dive` + `slam`<br>장판 지속: 무음 | **약함** | 쿨타임 40초, 반경 `110`의 초대형 창 강하 궁극기인데 낮은 점선(`ln: 9`)과 공용 `f.ring`만 출력되어 창기사의 고공 강하 기둥이나 심연 분화구 임팩트가 매우 빈약함 |
| **`bloodburst`**<br>혈흔 폭발 | 주술암살자<br>(`dagger`+`book`) | `fx: 100`<br>`pr`/`pp` `"burst"` | 반경 `r: 100`, 속박 `1200ms` 후 폭발 | 시전 시 `f.ring(100)` + 1.2초 동안 수축하는 Canvas2D 점선 원(`g.arc`) + 폭발(`pp`) 시 `B.fx.ring(100)` 및 외곽 10점 `f.burst` | 속박: `blood_bind`<br>폭발: `blood_burst` | **보통** | 1.2초 수축 타이밍과 2단계 전용 사운드(`blood_bind`→`blood_burst`)는 좋으나, 수축 링이 도트 사슬/혈흔 문양이 아닌 단순 Canvas2D 점선 원임 |
| **`sanctuary`**<br>불멸의 성역 | 암흑기사<br>(`sword`+`book`) | `fx: 102`<br>`pr` `"sanct"`<br>`h` (`cue: 2`) | 반경 `r: 90`, 8초간 시전자 추종 오라 (불사+흡혈) | 시전자를 따라다니는 `g.ellipse` 점선 타원과 붉은 점 6개 상승 + 아군 회복 시 `HIT_CUE.sanctuary` 붉은 파동 | 시전: `sanctuary`<br>회복: 공용 `heal` | **보통** | 시전자 추종은 잘 작동하나, 8초간 유지되는 불사 성역이 얇은 점선 타원과 점 6개뿐이라 암흑기사 궁극기다운 위압감이 부족하고 회복음도 공용 `heal`임 |
| **`crosscut`**<br>십자 난도 | 검무사<br>(`sword`+`dagger`) | `fx: 120` | 전방 부채꼴 `r: 64, arc: 100°` 2연타 | 공용 직선 `f.slash` 2개(`#e8f0ff`, `#9fb8ff`) + 스파크 5개 후 `later(170)`에 적중 몬스터 위치에 작은 X자 `f.slash` | 시전: `cross_cut` | **약함** | `r: 64, arc: 100°`의 넓은 검+단검 교차 베기인데 도트 호(crescent) 조형 없이 얇은 공용 직선 `f.slash`만 그어져 범위와 십자 궤적이 보이지 않음 |
| **`elemfan`**<br>원소 비수 | 환술사<br>(`dagger`+`staff`) | `fx: 124`<br>`ln: 7` ×3 | 3갈래 `spread: 18°, len: 140` (화염·냉기·번개) | 3원소 색상 스파크 + `ln: 7` 3개가 각각 화염(`#ff8a3a`), 냉기(`#9fe8ff`), 번개(`#ffe86a`) 회전 도트 단검과 원소 궤적으로 비행 | 시전: `element_dagger` | **좋음** | 화염·냉기·번개 3색 도트 단검과 궤적이 명확히 구분되고 전용 효과음이 잘 어울림 |
| **`frostspire`**<br>빙결창 | 마창사<br>(`spear`+`staff`) | `fx: 125` | 직선 `len: 150, half: 14` + 끝단 빙결 폭발 `r: 44` | 이중 `f.beam` + 끝단에서 솟구쳐 깨지는 3기둥 도트 얼음 첨탑(`iceSpire`, 높이 20/24/42px) + `f.ring(44)` | 시전: `frost_lance` | **좋음** | 끝단의 도트 얼음 첨탑(`iceSpire`) 조형과 파열 연출, 전용 사운드(`frost_lance`) 모두 훌륭함 |
| **`runecircle`**<br>메아리 법진 | 룬술사<br>(`staff`+`book`) | `fx: 126`<br>`pr`/`pp` `"rune"` | 거리 `at: 80`, 반경 `r: 64`, 5초간 매초 화염→냉기→번개 순환 폭발 | 이중 마법진 + 회전 삼각형 + 6방위 3×3 도트 룬 문자(`RUNES`)가 매초 `pp`마다 화염/냉기/번개 색으로 점등 및 장판 폭발 | 설치: `rune_circle`<br>틱: `ember` / `frost` / `bolt` | **좋음** | 6개 도트 룬 문자와 3원소 순환 점등, 원소별 틱 사운드가 직관적으로 연결됨 |
| **`inkshot`**<br>룬 먹화살 | 각인궁사<br>(`book`+`bow`) | `fx: 128`<br>`ar` (`kind: 7`) ×5 | 5갈래 부채꼴 `spread: 24°, len: 170` | 먹물 스파크 + `ARROW_LOOK[7]` 전용 도트 먹화살(검은 화살대 `#1a1426` + 보라색 룬 도트 및 먹물 방울 낙하) 5발 발사 | 시전: `bow_draw` + `bow_shot` + `inkshot` | **좋음** | `pierce`/`leapshot`과 달리 `ARROW_LOOK[7]` 전용 도트 화살 외형과 궤적 파티클, 전용 `inkshot` 사운드가 모두 적용됨 |
| **`ironsiege`**<br>철쇄 돌진 | 머서너리<br>(`hammer`+`spear`) | `fx: 133`<br>`ln: 9` | 돌진 `len: 48, half: 11` + 착지 강타 `r: 23` | 돌진 폭(`±half*0.76`)을 보여주는 이중 궤적선 + 착지 `wave(23)`·`rim(23)`·황토색 파편 `shards(7)` | 시전: `merc_dash` | **좋음** | 짧은 창 돌진 통로와 해머 착지 테두리·파편, 전용 `merc_dash` 효과음이 잘 맞물림 |
| **`oathward`**<br>성문 서약 | 성기사<br>(`hammer`+`book`) | `fx: 134`<br>`h` (`cue: 1`) | 타격 `r: 34` + 아군 성역 치유 `healR: 88` | 안쪽 타격 `wave(34)`+`rim(34)` + 바깥쪽 `oathSeal(r=88)` (솟아오르는 도트 십자가 10개 + 외곽 성역 `rim`) + 아군 `HIT_CUE.oath` | 시전: `oath_cast`<br>치유: `oath_heal` | **좋음** | 안쪽 해머 타격 반경(`34`)과 바깥쪽 성역 반경(`88`)이 도트 십자가와 이중 링으로 명확히 분리됨 |
| *(예비 코드)*<br>천뢰 (`101`) | `spear`+`bow`<br>(`skillfx.js` 내장) | `fx: 101` | 직선 투창 + 낙뢰 | 금빛 `f.beam` + 종점 `f.bolt` 4연타 + `f.ring(95)` + `f.crack` | `thunder_javelin` | **보통** | `03-skills.js` 미등록 예비 코드이나 사운드·연출 구현됨 |
| *(예비 코드)*<br>파진돌격 (`121`) | `sword`+`spear`<br>(`skillfx.js` 내장) | `fx: 121` | 직선 돌진 + 베기 | 이중 `f.beam` + `f.slash` 2회 + `f.ring(48)` | `breach_charge` | **약함** | 공용 `f.beam`+`f.slash` 조합 |
| *(예비 코드)*<br>검기 화살 (`122`) | `sword`+`bow`<br>(`skillfx.js` 내장) | `fx: 122`<br>`ar` (`kind: 4`) | 직선 화살 | `ARROW_LOOK[4]` 청백색 검기 날개 화살 + 스파크 | `blade_arrow` | **좋음** | `ARROW_LOOK[4]` 전용 도트 외형 보유 |
| *(예비 코드)*<br>그림자 관통 (`123`) | `dagger`+`spear`<br>(`skillfx.js` 내장) | `fx: 123` | 직선 그림자 찌르기 | 보라·청록 이중 `f.beam` + `f.slash` | `shadow_pierce` | **약함** | 공용 `f.beam`+`f.slash` 조합 |
| *(예비 코드)*<br>삼원소 화살 (`127`) | `staff`+`bow`<br>(`skillfx.js` 내장) | `fx: 127`<br>`ar` (`kind: 5`) | 3원소 화살 | `ARROW_LOOK[5]` 화염·냉기·번개 순환 도트 화살 | `tri_arrow` | **좋음** | `ARROW_LOOK[5]` 전용 3원소 도트 외형 보유 |

---

### 3-4. 무기 패시브 연출 (`kind: "p"`, 6종 — 무기 숙련 Lv.20 해금)

| ID · 한글 이름 | 무기 | 이벤트 / `fx` | 현재 화면 연출 (`skillfx.js` / `events.js`) | 현재 효과음 (`audio.js`) | 등급 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| **`inertia`** (대검의 관성) | `sword` | `fx: 110` | `f.ring(52, "#ffd84a")` + `f.slash` | `cleave` | **보통** | 3타마다 발동하는 황금 링+베기 |
| **`vitals`** (급소 해부) | `dagger` | `fx: 111` | 보라 스파크 + 작은 X자 `f.slash` | `vital` | **보통** | 출혈/급소 적중 피드백 양호 |
| **`tip`** (창끝의 감각) | `spear` | `["tip", id]` | `"창끝!"` 텍스트 팝업 + 금빛 `f.spark` | `tip` (1760Hz 핑) | **좋음** | 텍스트와 고음 핑으로 끝단 명중 즉시 인지 가능 |
| **`reso`** (마력 공명) | `staff` | `fx: 113` | 하늘색 `f.ring(22)` + `f.sparkle` | `resonance` | **보통** | 마나 회복 및 쿨감 피드백 무난 |
| **`brand`** (낙인 각인) | `book` | `fx: 114` | 보라 `f.ring(36)` + `f.burst` | `brand_pop` | **보통** | 3중첩 폭발 피드백 무난 |
| **`hawk`** (매의 눈) | `bow` | `fx: 115` | 연두색 `f.spark` + 작은 `f.ring(16)` | `hawk` | **보통** | 장거리 명중 피드백 무난 |

---

## 4. 종합 통계

- **정식 액티브·시그니처 스킬 35종 기준** (무기 액티브 16 + 단일 직업 7 + 복합 직업 12):
  - **좋음**: 16종 (`slash`, `shade`, `rally_banner`, `frostring`, `revive_binding`, `hammer_stamp`, `hammer_fault`, `meteor`, `pact`, `hammer_final`, `traps`, `elemfan`, `frostspire`, `runecircle`, `inkshot`, `ironsiege`, `oathward` 중 17종)
  - **보통**: 9종 (`ambush`, `spiral`, `fireball`, `soulbolt`, `dragon`, `rain`, `crimson`, `bloodburst`, `sanctuary`)
  - **약함**: 9종 (`rend`, `comet`, `gravity`, `pierce`, `leapshot`, `verdict`, `flurry`, `dive`, `crosscut`)

---

## 5. 고칠 순서 (약한 것부터 — 작업 우선순위 목록)

후속 `[VFX]` 및 `[SFX]` 작업에서 아래 순서대로 개선한다.

### 1순위: 근접 무기(검·단검·창) 중 "약함" 및 핵심 "보통" 스킬 (`ai/TASKS.md` 1차 VFX 대상)
1. **`rend` (대지 가르기, 검 Lv.10, `fx: 81/82`) — [약함]**
   - **문제**: 공용 `f.ring`과 `setTimeout` 먼지만 나열되어 전방 `len: 120, half: 14` 균열 범위가 보이지 않고, 몬스터 `slam` 소리를 씀.
   - **개선**: 착지 지점(`r: 38`) 도트 암석 파쇄 링 + 전방 `len: 120, half: 14` 구간을 따라 솟구치는 도트 지면 균열/바위 파편 웨이브 구현, 전용 도약 강타음 분리.
2. **`comet` (유성창, 창 Lv.10, `fx: 88` + `ln: 3`) — [약함]**
   - **문제**: 폭 `40px(half: 20)` 돌진인데 얇은 줄만 그어지고 착지 기절(`stun: 500ms`) 충격파가 없음. 구버전 `hundred` 사운드 사용.
   - **개선**: 폭 `half: 20`을 보여주는 유성 창날 돌진 웨이크 + 종착지 성운/기절 충격파 링과 파편 추가, 전용 유성창 돌진·착지음 추가.
3. **`verdict` (단죄의 일격, 대검전사, `fx: 83`) — [약함]**
   - **문제**: 반경 `r: 70` 대검 회전 궁극기인데 작은 직선 `f.slash` 2개와 공용 `f.storm`만 출력됨.
   - **개선**: `r: 70` 전체를 휩쓰는 360° 도트 대검 회전 참격 고리(붉은·황금 검기 + 외곽 파편) 구현.
4. **`flurry` (무영난무, 도적, `fx: 86` + `ln: 5`) — [약함]**
   - **문제**: 7회 무적 점멸 연타가 단색 직선 `f.beam`과 공용 `f.slash`로만 표현됨.
   - **개선**: 점멸 시 보라색 그림자 잔상 웨이크 + 타격마다 날카로운 도트 X자/초승달 암살 검격 조형 추가.
5. **`crosscut` (십자 난도, 검무사, `fx: 120`) — [약함]**
   - **문제**: `r: 64, arc: 100°` 교차 베기가 얇은 공용 `f.slash` 2줄로 끝남.
   - **개선**: `r: 64, arc: 100°` 범위를 덮는 대형 도트 십자(X) 검기 호 + 170ms 후 단검 후속 교차 베기 잔상 구현.
6. **`dive` (심연의 강림, 용기사, `fx: 99` + `ln: 9`) — [약함]**
   - **문제**: 반경 `r: 110` 창 강하 궁극기가 낮은 점선(`ln: 9`)과 공용 `f.fall`/`f.ring`만 출력함.
   - **개선**: 고공에서 수직으로 꽂히는 심연 창기둥 도트 궤적 + `r: 110` 외곽 분화구 림(`rim`)/파편(`shards`) + 흡혈 장판 도트 입자 강화.
7. **`ambush` (암습, 단검 Lv.1, `fx: 84`) & `spiral` (나선 찌르기, 창 Lv.1, `fx: 87`) — [보통 보완]**
   - `ambush`: 등 뒤 급소 도착 지점의 도트 십자 절개선(`ambushCuts`) 크기·선명도 강화 및 암습 전용 베기음 보강.
   - `spiral`: 사거리 끝단 `72%~100%` 창끝 강타 구간에 도트 관통 링/창끝 하이라이트 표시 추가.

### 2순위: 원거리·마법 무기(지팡이·마도서·활) 중 "약함" 및 "보통" 스킬 (`ai/TASKS.md` 2차 VFX 대상)
8. **`pierce` (관통 화살, 활 Lv.1, `fx: 94` + `ar: 2`) — [약함]**
   - **문제**: `ARROW_LOOK[2]`가 없어 일반 평타 화살과 외형이 같음.
   - **개선**: `ARROW_LOOK[2]`에 청백색 풍압 날개·관통 고리를 가진 대형 도트 관통 화살 등록 + 발사 시 총구 풍압 링 추가.
9. **`leapshot` (도약 사격, 활 Lv.10, `fx: 95` + `ln: 8` + `ar: 3`) — [약함]**
   - **문제**: 후방 도약(`ln: 8`)이 바닥 직선 `f.beam`이고 5발 화살(`ARROW_LOOK[3]`)이 평타 화살과 같음.
   - **개선**: `ln: 8`을 체공 포물선 도트 잔상 호로 변경하고, `ARROW_LOOK[3]`에 연두·금빛 깃털 도트 화살 외형 등록 + 도약 지점 먼지 파문 추가.
10. **`gravity` (중력 왜곡진, 마도서 Lv.10, `fx: 92` + `pr` `"grav"`) — [약함]**
    - **문제**: 픽셀 아트가 아닌 매끈한 Canvas2D `g.arc` 곡선 3개만 회전함.
    - **개선**: `r: 60` 외곽에서 중심으로 빨려 들어가는 도트 암흑 파편/중력 링과 중심 블랙홀 코어 도트 조형으로 교체.
11. **`fireball` (파이어볼, 지팡이 Lv.1, `fx: 70`) — [보통]**
    - **문제**: 투사체 없이 단색 직선 `f.beam`만 그어짐.
    - **개선**: 시전자에서 목표까지 날아가는 도트 화염구 코어+불꽃 꼬리 궤적 추가 및 3초 화상 장판 바닥 불씨 도트 보강.

### 3순위: 직업 시그니처 "보통" 스킬 연출 보강 (`ai/TASKS.md` 3차 VFX 대상)
12. **`dragon` (뇌룡승천, 창술사, `fx: 89` + `pr`/`pp` `"pillar"`) — [보통]**
    - **개선**: 3회 `pp` 타격 시 단순 `zap` 대신 바닥에서 하늘로 나선형으로 솟구치는 도트 뇌룡(번개 기둥) 실루엣 추가.
13. **`crimson` (홍련참, 마검사, `fx: 97`) — [보통]**
    - **개선**: 판정 폭 `half: 20`에 맞춰 화염 도트 초승달 크기를 키우고 번개 스파크가 감기는 이중 원소 궤적선 추가.
14. **`bloodburst` (혈흔 폭발, 주술암살자, `fx: 100`) & `sanctuary` (불멸의 성역, 암흑기사, `fx: 102`) — [보통]**
    - `bloodburst`: Canvas2D 점선 원을 도트 혈흔 사슬/룬 수축 링으로 교체.
    - `sanctuary`: 추종 타원 둘레에 도트 암흑 검 문양/성역 테두리 추가.

### 4순위: 전용 시전음·착탄음·지속음 미비 스킬 (`ai/TASKS.md` 4차 SFX 대상)
15. **`rend` (`fx: 81`)**: 몬스터 공용 `slam` 대신 대검 도약 참격 전용 사운드(`rend_slam`) 분리.
16. **`comet` (`fx: 88`)**: 구버전 `hundred` 대신 유성창 돌진+착지 충격음(`comet_charge`) 분리.
17. **`ambush` (`fx: 84`)**: 단순 위치교환음(`swap`)에 날카로운 암습 절개 타격음(`ambush_strike`) 추가.
18. **`soulbolt` (`fx: 91`)**: 탄환 착탄 및 흡혈 회복 시 영혼 흡수음(`soulbolt_hit`) 추가.
19. **`rain` (`fx: 96`)**: 3초 지속 동안 화살비가 쏟아지는 낙하 효과음(`rain_tick` 또는 연속 풍절음) 추가.
20. **`flurry` (`fx: 86, extra: 1`)**: 7연타 베기마다 일반 `crit` 대신 빠른 그림자 난무 베기음(`flurry_slash`) 연결.
21. **`sanctuary` (`h` `cue: 2`)**: 공용 `heal` 대신 암흑 성역 피흡수 회복음(`sanctuary_mend`) 분리.
