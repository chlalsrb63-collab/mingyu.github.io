# 스킬 조합 설계 (`docs/design/skill-combos.md`)

Owner: "스킬이 단순 공격만 하는 게 아니라 범위·모션·쿨타임을 다양하게 해서 조합해 싸우게." Rules in
`game/src/logic/03-skills.js` (table) and `57-weapon-skills.js` (engine); tests `tests/combos.mjs`.
Balance floors (`tests/balance.mjs`) still bind: retune numbers, never the ranges.

## 1. 축 — the axes every active is placed on

- **Shape**: cone 부채꼴 · line 일직선 · circle 원 · dash-through 돌진 · projectile 투사체 · ground-target 지점 · channel 유지 · charge-up 모으기.
- **Motion**: instant 즉발 · wind-up 준비(`wind` ms, 그동안 다른 기술 불가) · channel 유지(`chan`: 다른 기술을 쓰면 끊김) · leap 도약 · backstep 후퇴 · blink 순간이동.
- **Cooldown band**: short 2–4 s (주력 연타) · mid 6–12 s (설치·이동·제어) · long 14–30 s (큰 한 방) · signatures 30 s+.

## 2. 상태와 소모 — combo hooks (monster runtime fields, never persisted)

| 상태 | 필드 | 거는 기술 | 소모하는 기술 → 보너스 |
| --- | --- | --- | --- |
| 경직 stag | `stg` 2.5 s, or any stun | 파워 슬래쉬, 대지 가르기 충격파, 갈고리 창, 유성창, 쐐기찍기(기절), 뇌룡승천 | 처형 내려베기 +60%, 저격 +50% |
| 공중 air | `air` 0.7 s (+stun) | 대지 가르기 착지 (띄우기) | 처형 +50%, 암습 +50%, 저격 +60% (추가타) |
| 빙결 frz | `frz` = freeze | 서리 고리(둔화된 적), 빙결창 창끝 | 나선 찌르기 +60% (파쇄), 처형 +60%, 저격 +50%, 점화 폭발 +80% (열충격) |
| 표식 mk | `mk` (기존) | 그림자 칼날, 단검 평타(급소), 원소 비수 | 급소 터뜨리기 표식 1개당 +30%, 3개 이상이면 주변 폭발 |
| 낙인 brand | `brand` (기존) | 마도서 기술(금서의 낙인) | 급소 터뜨리기 +50%, 영혼 착취 마무리 +100% |
| 화상 brn | `brn` 스택 최대 3, 6 s | 파이어볼, 메테오 | 점화 폭발 스택당 +35% |
| 끌림 drag | `drag` 2 s | 갈고리 창, 중력 왜곡진, 유성창, 뇌룡승천 | 파워 슬래쉬 +30%, 서리 고리 +30% (모아서 광역) |

A consumer spends the state on its first hit of that monster (`comboK`), emits `["cb", mobId, code]`
(1 경직 2 빙결 3 공중 4 표식 5 낙인 6 화상 7 끌림; 9 = launched) and the client pops a word on it
(`public/skillfx_combo.js`). States live on the monster, so **any party member's** skill can cash them in.

## 3. 무기별 역할 — per weapon

| 무기 | short | mid | long / new | combo identity |
| --- | --- | --- | --- | --- |
| 대검 | 파워 슬래쉬: cone, instant, 3.5 s — 경직, 끌림 소모 | 대지 가르기: leap + line, 9 s — 띄우기 + 경직 | **처형 내려베기** (25): charge-up 0.5 s, 짧은 넓은 일직선, 16 s — 경직/공중/빙결 소모 | 세우고(경직) 띄우고(공중) 내려벤다 |
| 단검 | **급소 터뜨리기** (25): melee single, 3.5 s — 표식 폭발, 낙인 소모 | 암습: blink behind, 6 s — 공중 소모 · 그림자 칼날: projectile fan, 8 s — 표식 | (무영난무 sig) | 표식 쌓고 터뜨리기 |
| 창 | 나선 찌르기: line, 3.5 s — 빙결 파쇄 | **갈고리 창** (25): line pull, 7 s — 끌림 + 경직 · 유성창: dash-through, 10 s — 끌림 | 전열 구호기 (support) | 거리 조절: 끌어와 묶기 |
| 스태프 | 파이어볼: projectile + ground burn, 3.5 s — 화상 | 서리 고리: circle self, 8 s — 빙결, 끌림 소모 | **점화 폭발** (25): ground-target, wind-up 0.4 s, 14 s — 화상/빙결 소모 | 원소 쌓기 → 터뜨리기 |
| 마도서 | 영혼 화살: homing projectile, 3.5 s — 낙인 | 중력 왜곡진: ground-target vortex, 11 s — 끌림 | **영혼 착취** (25): channel 2.4 s beam, 15 s — 틱마다 흡혈, 마무리에 낙인 소모 | 묶고 빨아들이기 |
| 활 | 관통 화살: line projectile, 4.5 s | 도약 사격: backstep + fan, 9 s | **저격** (25): charge-up 0.7 s, 아주 긴 일직선, 18 s — 경직/공중/빙결 소모 | 멀리서 고정된 표적 마무리 |
| 해머 | 쐐기찍기 6 s (기절 → 경직) | 금맥 벌리기 10 s — 균열 소모 | 파성추 sig | 자기 균열 루프 + 경직 공급 (해머 엔진은 `56-hammer.js` 그대로) |

New actives sit at the end of `SKILL` (need: mastery 25), so a fresh loadout (5 actives) keeps the
signatures; the player swaps them in at town or a campfire.

## 4. 교차 조합 — cross-weapon chains (party or weapon swap)

- 창 갈고리 창 → 대검 파워 슬래쉬 / 스태프 서리 고리: 끌어 모은 적을 광역 +30%.
- 대검 대지 가르기(공중) → 단검 암습 · 활 저격 · 대검 처형: 추가타.
- 스태프 서리 고리 · 마창 빙결창(빙결) → 창 나선 찌르기 파쇄 · 스태프 점화 열충격 · 활 저격.
- 마도서 낙인 → 단검 급소 터뜨리기 (+50%); 단검 표식 → 급소 터뜨리기.
- 해머 쐐기찍기 · 창 유성창(기절) → 대검 처형 · 활 저격.
- 스태프 파이어볼 ×3 → 점화 폭발 (+105%).

## 5. 엔진 조각 — engine pieces (57-weapon-skills.js)

- `wind`: castSkill pays now, stores `p.charge`; `weaponTick` strikes when it is due (`skStrike`). The skill
  cast validator refuses another skill meanwhile. Hammer skills keep their own `wind` path.
- `chan`: a prop that follows the caster (`kind: "chan"`), pulses `n` times; any other skill cast ends it.
- `eat`: `{state: bonus}` on a skill row; `comboK` multiplies the hit and spends the state.
- `launch(S, rt, o, ms)`: airborne + stunned (bosses and champions immune, elites half).
- Pull reuses `pullTo`/`tug`, and now marks `drag`.
- New "a" fx codes 140–145 (cleave, rupture, hook, ignite, drain, snipe) and the `cb` event are drawn in
  `public/skillfx_combo.js` (hooked from `skillfx.js skillEvent` with two lines). No existing event changes.
