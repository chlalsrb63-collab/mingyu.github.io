# 무기군 신규 스킬 아이디어 (`docs/design/skill-ideas.md`)

Owner: "무기군 (대검, 단검, 창, 양손해머, 활, 스태프, 마도서) 스킬 아이디어 … 다른 RPG에서 차용해 참신하고 재밌게."
Status: **proposal only** (nothing built). 7 weapons × 5 = 35 actives, cross-weapon combos, and a build order.

Rules for this doc:
- Borrowed **mechanics only** — no names, characters, art or exact numbers from the reference games. Numbers here are
  first guesses; `tests/balance.mjs` floors still bind, so retune numbers, never ranges (`skill-combos.md`).
- Every skill plugs into what exists: the 7 combo states (경직 stg · 공중 air · 빙결 frz · 표식 mk · 낙인 brand · 화상 brn ·
  끌림 drag), weapon resources (관성, 표식, 공명, 낙인, 균열, 거리), `wind`, `chan`, `spin`, props, `launch`, `pullTo/tug`, the Space dash.
- No duplicates checked against `03-skills.js` (slash rend cleave verdict whirl · ambush shade rupture flurry · spiral comet hook
  rally_banner dragon musou · fireball frostring ignite meteor · soulbolt gravity drain revive_binding pact · pierce leapshot snipe rain ·
  hammer_stamp hammer_fault hammer_final) and the hybrid signatures.
- Mastery slots: existing actives sit at 1 / 10 / 15 (support) / 25. New ones take **5 / 15 / 30 / 40 / 45** so each weapon unlocks a new
  active every ~10 levels; the 5-active loadout makes them choices, not bloat. No new jobs (jobs are the owner's call).
- 양손해머 rows are suggestions for Codex (hammer owner, `56-hammer.js`); they reuse the hammer `wind` path and cracks.
- Cost: **S** = a table row on today's engine · **M** = one small shared engine piece (below) · **L** = a new system.
- Cooldown bands as `skill-combos.md` §1: short 2–4 s · mid 6–12 s · long 14–30 s.

## 0. 공용 엔진 조각 — the small pieces several skills share (build each once)

| id | piece | how (rules, 57-weapon-skills.js) | used by |
| --- | --- | --- | --- |
| E1 | 누르고 떼기 `hold` | cast starts `p.hold {id, at}`; client sends `{t:"skr"}` on key-up (auto-release at max). Tier = elapsed ms thresholds. Other skills refused meanwhile (like `wind`); walk at `holdSpd`. Auto-hunt releases at tier 2. Wire: a `flagsOf` bit + tier for the glow. | 산 가르기, 회전 망치 |
| E2 | 재시전 창 `re` | after cast `p.re {id, until}`; the same skill pressed before `until` runs its follow-up (`sk.re2` params), no MP. Unused → cooldown shortened by `reCd`. | 하늘 베기, 꽂힌 비수, 장대 도약 |
| E3 | 받기 창 `parry` | `p.parry {until, arc, id}` checked at the top of `hurtPlayer` (needs `mob`) and before boss pattern hits: inside window and arc → blow negated, `onParry(sk)` runs. `chan` variant = held guard. | 칼등 받아치기, 고슴도치 창벽 |
| E4 | 움직이는 투사체 prop | prop with `vx, vy` advanced each tick, pulses every `every`; `bounce` reflects on `reach()` blocked; `ret` flies back to the caster. | 서리 구슬, 튕기는 망치, 도탄 화살, 꼬마 풍뎅이 |
| E5 | 어그로 손질 | taunt: `mob.tgt = pid`, `mob.taunt = until` (tickMob keeps it); daze: `mob.tgt = null`, `mob.daze = until` (no re-aggro). | 도발의 포효, 연막탄 |
| E6 | 피해 훅 | `hurtMob` share (`mob.link` group → % to the others, no re-share) and `hurtPlayer` absorb (`p.shield` hp/until). | 먹물 사슬, 수호 문장 |

## 1. 대검 sword — 무겁게 모으고, 받아치고, 띄운다
Today: 부채꼴(슬래쉬) · 도약+일직선(대지 가르기) · 준비 내려베기(처형) · 회전(단죄, 돌개바람) · 관성 스택.

**1-1. 산 가르기** · 숙련 30 · 쇼피스/타이밍 · long 16 s · MP 8 + HP 3% · **M (E1)**
- 설명: "대검을 끌어올려 힘을 모은다. 세 번째 빛에서 놓으면 산도 가른다 — 너무 오래 쥐면 힘이 샌다."
- 기전: hold ≤1.8 s, walk 30%. Tier 1 at 0.5 s ×1.6 · tier 2 at 1.0 s ×2.6 · tier 3 at 1.4 s ×4.2; past 1.8 s it drops to tier 2 (over-charge penalty). Short wide line len 60 half 20. **어깨 버티기**: the first monster blow taken at tier ≥1 does half damage, no stagger, and jumps the charge one tier.
- 조합: tier 3 eats stg +40% / air +40%. 관성 5 → starts at tier 1 (spends the stacks). 도발의 포효로 모은 무리에 tier 3.
- 참고: [R1] MH 대검 — 단계 차지, 과충전 손해, 맞으면서도 차지를 잇는 몸통박치기.

**1-2. 칼등 받아치기** · 숙련 5 · 타이밍/방어 · short 5 s · MP 3 · **M (E3)**
- 설명: "칼을 눕혀 막는다. 딱 맞춰 막으면 놈이 휘청이고 내 칼이 무거워진다."
- 기전: 0.35 s guard, front 180°. A blow inside → negated, attacker stg 1.2 s (scripted boss: stagger gauge −25%), counter cone r40 ×1.2, +2 관성, cooldown −50%. Whiff → 0.4 s of +20% damage taken (the risk).
- 조합: supplies stg for 처형·저격; during a boss's marked cast it is the sword's way to help break it.
- 참고: [R2] 마영전 피오나 — 퍼펙트 가드가 쿨을 줄임 · [R3] MH 랜스 — 가드 직후 카운터 찌르기.

**1-3. 어깨 돌파** · 숙련 15 · 이동/CC · mid 9 s · MP 5 + HP 2% · **S**
- 설명: "어깨로 밀고 들어가 앞을 쓸어 간다. 벽이나 다른 괴물에 처박힌 놈은 정신을 못 차린다."
- 기전: dash 90 (유성창's `tug` carry), ×0.9. At the end: carried mobs whose push is blocked (`reach` short) or ≥2 carried together → stun 1.0 s + stg; others knock 14.
- 조합: applies drag + stg → 파워 슬래쉬 +30% → 처형 내려베기. 던전 벽 지형이 무기가 된다.
- 참고: [R4] D4 야만용사 돌진 — 적을 밀고 가다 벽에 부딪히면 기절.

**1-4. 도발의 포효** · 숙련 35 · 파티 탱킹/지속 · long 18 s · MP 6 · **S–M (E5)**
- 설명: "온 들판이 울리게 포효한다. 덤빌 놈은 나에게 오라 — 몰려든 만큼 단단해진다."
- 기전: r90, no damage. Non-boss mobs target me 4 s (boss: its next pattern aims me); guard +4% per mob (max 20%) 6 s; party in r90 atk +8% 6 s.
- 조합: gathers for 산 가르기·서리 고리; protects 궁수/마법사; shatters 해머 균열 파도 spikes (4-2).
- 참고: MMO 탱커 도발 관례 · [R5] PoE2 — 함성이 근처 바위 가시를 터뜨림.

**1-5. 하늘 베기** · 숙련 45 · 콤보 · mid 10 s · MP 7 + HP 3% · **M (E2)**
- 설명: "올려베어 띄우고, 한 번 더 누르면 뛰어올라 공중의 적을 땅에 처박는다."
- 기전: press 1 — cone r44 ×1.0, `launch` 0.9 s (elites half). Press 2 within 0.9 s — leap to the launched group, slam r40 ×1.8, eats air +50%, ring stg. No press 2 → cooldown ×0.6.
- 조합: press 1 alone hands 공중 to 암습·저격·장대 도약; press 2 cashes it yourself. 돌개바람 after the slam.
- 참고: [R6] MH 조충곤 공중 연계 · [R11] 엘든 링 사자의 발톱 — 앞구르기 내려찍기로 넘어뜨림.

## 2. 단검 dagger — 숨고, 끊고, 쌓아서 터뜨린다
Today: 등 뒤 순간이동(암습) · 투척 부채꼴(그림자 칼날) · 표식 폭발(급소 터뜨리기) · 순간이동 연타(무영난무) · 표식/출혈.

**2-1. 연막탄** · 숙련 5 · CC/파티 · mid 12 s · MP 5 · **S–M (E5)**
- 설명: "연막을 터뜨린다. 연기 속에선 아무도 나를 못 보고, 괴물은 누굴 노렸는지 잊는다."
- 기전: ground r48 at aim ≤90, 4 s. Non-boss mobs inside drop their target and wander (`daze`); party inside takes −30% from volleys/projectiles.
- 조합: dazed = "나를 노리지 않던 적" → 암습 확정 치명, 십자 난도(검무사) 확정 치명. Party aggro reset for a dying healer.
- 참고: [R8] D4 도적 연막탄/은신.

**2-2. 잔영 걸음** · 숙련 15 · 이동/회피 · short, 2 charges × 6 s · MP 2 · **S** (+ a `charges` field)
- 설명: "그림자만 두고 미끄러진다. 지나간 자리의 적에게는 표식이 남는다."
- 기전: slide 70 along aim (`stepTo`, gates excluded), 0.6 s `ghost`; mobs on the path (half 10) get 1 표식.
- 조합: 표식 → 급소 터뜨리기; ghost slips a boss pattern without spending the Space dash.
- 참고: [R9] 엘든 링 블러드하운드 스텝 — 긴 회피+잠깐 투명 · [R8] D4 그림자 걸음.

**2-3. 꽂힌 비수** · 숙련 30 · 이동/콤보 · mid 8 s · MP 4 · **M (E2)**
- 설명: "비수를 던져 꽂고, 다시 누르면 그 자리로 번쩍 날아가 한 번 더 찌른다."
- 기전: press 1 — projectile 140, sticks in the first mob (or the ground at the end) for 3 s, +1 표식. Press 2 — blink to it (behind the mob), stab ×1.4, +1 표식; from the ground a ring r28 ×0.5.
- 조합: reach what 갈고리 창 cannot; with 암습 = two blinks; ends marked for 급소 터뜨리기 ×2+.
- 참고: [R10] 하데스 — 던지고 되부르는 무기(창·방패).

**2-4. 칼날 소용돌이** · 숙련 40 · 쇼피스/광역 · short 2 s (stacking) · MP 2 · **S–M** (`spin` prop)
- 설명: "부를 때마다 칼날 하나가 내 주위를 돈다. 다섯 자루가 모이면 폭풍이다."
- 기전: each cast adds an orbiting blade (max 5; 6 s, refreshed by each cast), r36, a pulse every 400 ms ×0.12 per blade. Cast at 5 blades → they scatter as a 5-knife fan ×0.6, each hit +1 표식, and the vortex ends.
- 조합: scatter marks → 급소 터뜨리기 / 혈흔 폭발; with 잔영 걸음, run through a pack.
- 참고: [R12] PoE 칼날 소용돌이 — 시전마다 칼날이 쌓이고 터뜨린 칼날이 범위를 키움.

**2-5. 급소 차단** · 숙련 45 · 타이밍/파티 · short 4 s · MP 3 · **S–M**
- 설명: "기술을 쓰려는 놈의 목을 찌른다. 제때 찌르면 기술이 끊기고 놈이 무너진다."
- 기전: melee single ×0.8. If the target is winding up (a mob charge telegraph, or a scripted boss's marked cast `bc 9`) → interrupt: normal/elite stun 1.5 s + stg, scripted boss stagger gauge −35%; cooldown refunded. Otherwise just a jab.
- 조합: stg for 처형·저격; gives the dagger a raid job in 주간 도전(cloakbat, bloomwhale).
- 참고: [R15] WoW 도적 차단(발차기) · [R14] 라그나로크 소닉 블로우(약해진 적 마무리) for the jab.

## 3. 창 spear — 뛰고, 버티고, 거리를 고른다
Today: 일직선 관통(나선) · 돌진 끌기(유성창) · 끌어오기(갈고리) · 깃발 · 번개 기둥(뇌룡승천) · 회전(무쌍난무) · 창끝 거리.

**3-1. 장대 도약** · 숙련 5 · 이동/콤보 · short 5 s · MP 3 · **M (E2)**
- 설명: "창을 땅에 짚고 훌쩍 뛰어오른다. 공중에서 다시 누르면 창끝부터 떨어진다."
- 기전: press 1 — vault 70 over mobs, 0.5 s airborne = `ghost`. Press 2 in the air — plunge r30 ×1.5, eats air +60%. A plunge that hits readies one more vault within 1.5 s (no cooldown).
- 조합: hop over a boss charge; cashes 공중 from 하늘 베기 / 땅울림 발구르기.
- 참고: [R6] MH 조충곤 — 장대 뛰기, 맞히면 다시 뜨는 공중 연계 · [R7] 로스트아크 슬레이어(글레이브) 도약.

**3-2. 뇌창 투척** · 숙련 15 · 원거리/원소 · mid 8 s · MP 6 · **S–M**
- 설명: "창을 번개째 던진다. 꽂힌 창은 피뢰침이 되어 주변 찌르기에 번개를 끌어온다."
- 기전: projectile 160, pierce ×1.2, el l; the first hit splits 3 bolts to nearby mobs ×0.4. The conjured spear stands at the end 5 s (prop r60): my spear hits on mobs inside chain one bolt ×0.3 to the rod.
- 조합: 번개 + 빙결 → 초전도, 번개 + 화상 → 과부하 (`react`). Gives a party wizard a lightning source.
- 참고: [R16] 디아블로 2 아마존 — 번개 분노(갈라지는 번개 창), 충전 타격.

**3-3. 고슴도치 창벽** · 숙련 30 · 방어/파티 · mid 12 s · MP 6 · **M (E3 held)**
- 설명: "창대를 세워 버틴다. 앞에서 덤비는 놈은 창끝에 스스로 찔린다."
- 기전: `chan` ≤3 s, walk 40%. Front 120°: blows −70%, each blocked blow → auto counter-poke ×0.8 + stg. Allies in the cone behind me (r40) take −30%. Any other skill ends it.
- 조합: stg supply while shielding 궁수/마법사 from a boss jet or charge.
- 참고: [R3] MH 랜스 — 가드와 카운터 찌르기 · [R17] D2 펜드 — 가까운 적을 연달아 찌름.

**3-4. 자세 전환: 질풍 · 집중** · 숙련 40 · 스킬 표현 · 1 s (swap buff 4 s cd) · MP 0 · **M** (runtime stance flag)
- 설명: "창을 고쳐 쥔다. 질풍은 넓게 휩쓸고, 집중은 한 점을 뚫는다. 바꾸는 순간이 가장 날카롭다."
- 기전: toggle. 질풍: basic attack becomes a 90° arc ×0.7, 갈고리 창 grabs 5 not 3. 집중: 창끝 band 0.72 → 0.6 of reach, 나선 찌르기 ×1.15. Each swap: 4 s "전환의 기세" +12% damage (no stacking). Runtime only (`p.stance`), not persisted.
- 조합: rotation — 질풍 갈고리(5 drag) → swap → 집중 나선(창끝). Felt, not a % passive.
- 참고: [R7] 로스트아크 슬레이어 — 난무/집중 두 자세, 전환 버프.

**3-5. 꼬마 풍뎅이 채집** · 숙련 45 · 쇼피스/버프 · short 3 s · MP 2 · **M (E4 return)**
- 설명: "창끝의 꼬마 풍뎅이를 날려 보낸다. 괴물에게서 빨강·하양·주황 정수를 물어 오면 힘이 난다."
- 기전: the bug flies to the aimed mob (≤150) and back, ×0.3. Essence by the mob's row: melee → 빨강 (atk +10%), ranged/flying → 하양 (move +15%, aspd +10%), elite/armoured → 주황 (def +15%, poise +10%p); 30 s each. Holding all three → 10 s "삼색": spear skill cooldowns −20%, crit +10%p, then the three reset.
- 조합: reading the monster becomes a choice; 장대 도약 to reach the right one. A cute companion on a grim field.
- 참고: [R6] MH 조충곤 — 곤충이 부위별 진액(공격/이동/방어)을 뽑아 옴, 세 개 모으면 강화.

## 4. 양손해머 hammer — 모아서 굴리고, 땅을 뒤집는다 (Codex review)
Today: 쐐기찍기(기절) · 금맥 벌리기(균열 소모) · 파성추(준비) · 균열 2스택 루프 · 버팀발.

**4-1. 회전 망치** · 숙련 5 · 이동/광역 · mid 9 s · MP 4 + HP 2% · **M (E1)**
- 설명: "망치를 끌며 힘을 모은다. 걸으며 놓으면 굴러가는 회전, 서서 놓으면 머리 위로 내려찍는다."
- 기전: hold ≤1.2 s, walk 70%. Released while moving → spin 80 forward over 0.8 s, a hit every 200 ms ×0.4, carries mobs (drag). Released standing → overhead r30 ×1.6 / ×2.6 by tier, stun 0.6 (stg). Each 정타 adds a 균열.
- 조합: spin = drag for 파워 슬래쉬·서리 고리 +30%; standing = stg for 처형; cracks for 금맥 벌리기.
- 참고: [R18] MH 해머 — 차지 단계, 이동 중 해제는 회전 공격, 서서는 내려찍기.

**4-2. 균열 파도** · 숙련 15 · 설치/콤보 · mid 10 s · MP 5 + HP 2% · **M**
- 설명: "땅을 내려쳐 갈라진 금을 앞으로 보낸다. 금 끝에 솟은 바위는 다시 때리면 터진다."
- 기전: 3 fissures (len 90, 20° apart) ×0.8; each ends in a spike prop 6 s (max 6 on the map per caster). A hammer 정타/skill, or any 포효/발구르기 within r20, shatters it: r36 ×1.2 + 1 균열 on each.
- 조합: feeds the crack loop; a party sword's 도발의 포효 sets them all off.
- 참고: [R5] PoE2 대지 분쇄 — 균열 끝 바위 가시, 함성으로 터짐.

**4-3. 튕기는 망치** · 숙련 30 · CC · mid 8 s · MP 5 · **M (E4 bounce + return)**
- 설명: "망치를 던진다. 세 놈의 머리를 차례로 두들기고 손으로 돌아온다."
- 기전: thrown at the target, bounces to the nearest unhit mob within 60 (3 hits), then returns. Each ×0.9 + stun 0.4 (stg); a winding-up target is interrupted like 2-5. While it is out, the basic attack is a shove ×0.5.
- 조합: three stg targets for 처형·저격 at once.
- 참고: [R10] 하데스 방패 — 던지면 적 사이를 튕기고 되돌아옴.

**4-4. 땅울림 발구르기** · 숙련 40 · CC/콤보 · short 4 s · MP 2 + HP 1.5% · **S**
- 설명: "쿵! 발을 구르면 주변의 작은 괴물이 통째로 튀어 오른다."
- 기전: r52 around self ×0.5, no wind-up. `launch` 0.6 s (normals), elites stg only, bosses: stagger gauge −10%.
- 조합: the cheapest 공중 source in the game → 암습 +50%, 저격 +60%, 장대 도약 plunge, 처형 +50%. Shatters 균열 파도 spikes.
- 참고: [R11] 엘든 링 폭풍 발구르기 — 싼 발구르기, 큰 자세 피해.

**4-5. 쇠말뚝 박기** · 숙련 45 · 쇼피스/파티 · long 24 s · MP 8 + HP 4% · **M** (prop that counts hits)
- 설명: "거대한 쇠말뚝을 꽂는다. 망치로 세 번 박으면 땅이 뒤집힌다 — 동료가 때려도 된다."
- 기전: stake prop at aim ≤80, 8 s. A hammer 정타, or any party member's melee skill hitting within r16, drives it (≤1 per 300 ms). 3 drives → eruption r90 ×2.5 (caster's attack), `launch` 0.8 s then root 1 s, 2 균열 on all; scripted boss stagger −40%.
- 조합: party timing play — the dagger's 급소 차단 and the spear's 장대 도약 plunge count as drives.
- 참고: [R18] MH 해머 대폭발 연계(모든 타가 맞아야 이어짐) · [R19] D4 고대의 망치 + 지진.

## 5. 활 bow — 거리, 지형, 타이밍
Today: 관통 화살 · 후퇴 부채꼴(도약 사격) · 준비 저격 · 장판(화살비) · 거리 보너스 · 다섯 발마다 덤.

**5-1. 곡사 폭약 화살** · 숙련 5 · 설치/콤보 · mid 7 s · MP 6 · **S**
- 설명: "하늘로 쏜 화살이 떨어지며 둘레의 괴물에 폭약 깃을 꽂는다."
- 기전: ground target ≤150; lands after 0.5 s, r40 ×0.7, +2 표식 on each (the bow learns marks).
- 조합: marks → 용뼈 관통 (5-2) or a party dagger's 급소 터뜨리기.
- 참고: [R20] MH 활 — 곡사로 폭약 화살을 박고 용의 일격으로 터뜨림.

**5-2. 용뼈 관통 사격** · 숙련 45 · 쇼피스/버스트 · long 20 s · MP 14 · **S–M** (`wind` + recoil)
- 설명: "몸을 낮추고 활을 한껏 당긴다. 반동에 밀리며 쏜 화살은 박힌 깃을 모두 터뜨린다."
- 기전: `wind` 0.8 s, line len 200 half 14, pierces all ×1.6, I slide back 20. Eats 표식 +25% each (max 5) and 낙인 +50%; 매의 시야 counts as full distance. (저격 = 2 targets, eats stg/air/frz; this = everyone in the line, eats marks.)
- 조합: 곡사 → 용뼈 (+50%); dagger marks and book brand from the party.
- 참고: [R20] (as above).

**5-3. 도탄 화살** · 숙련 15 · 지형/버스트 · short 4 s · MP 5 · **M (E4 bounce)**
- 설명: "벽을 맞고 튕길 때마다 화살이 더 세진다. 좁은 굴에서 진가가 난다."
- 기전: path 220 total, reflects off walls up to 4 times, +25% per bounce, pierces (each mob once per segment). 매의 시야 counts path length.
- 조합: makes 묘지·하수도·동굴·심연 dungeons a bow playground; corridor + 고슴도치 창벽 in front.
- 참고: [R21] 드래곤즈 도그마 2 마궁사 — 벽에 튕길수록 강해지는 화살.

**5-4. 올무 화살** · 숙련 30 · CC · mid 10 s · MP 6 · **S** (`trap` prop)
- 설명: "덫을 매단 화살을 박아 둔다. 처음 밟은 놈은 발이 묶인다."
- 기전: snare at ground ≤120, 10 s, max 2. The first mob to step on it is rooted 2.5 s (elite 1.5, boss 0.5 — a fifth) and counts as stg; two mobs within 30 are tugged in (drag).
- 조합: stg → 저격 +50%; drag → 파워 슬래쉬·서리 고리 +30%.
- 참고: [R22] 라그나로크 헌터 앵클 스네어 — 보스는 1/5만 묶임.

**5-5. 구르며 쏘기** · 숙련 40 · 타이밍/이동 · short 3 s · MP 4 · **S**
- 설명: "구르기 직후 시위를 놓으면 회심의 화살이 나간다."
- 기전: backstep 40 + one arrow ×1.0. Cast within 0.35 s after a Space dash ends (`p.dashAt`) → "회심!": ×2.2, pierce, dash cooldown −2 s.
- 조합: slip a boss blow with the dash → punish at once; feeds 연속 사격's count.
- 참고: [R10] 하데스 활 — 대시 직후 타이밍 맞춘 강한 사격.

## 6. 스태프 staff — 세 원소를 굴리고, 세우고, 피한다
Today: 파이어볼(화상) · 서리 고리(빙결) · 점화 폭발(소모) · 메테오 · 공명 · 원소 반응 · 정신 집중.

**6-1. 서리 구슬** · 숙련 5 · 광역/CC · mid 9 s · MP 12 · **M (E4)**
- 설명: "느릿느릿 굴러가는 서리 구슬이 사방으로 얼음 조각을 뿌리고, 끝에서 터진다."
- 기전: orb travels 150 over 2 s; every 250 ms 6 radial shards r40 ×0.15 + slow; burst at the end r40 ×0.8. el i, mag.
- 조합: slow → 서리 고리 freezes; frz → 나선 찌르기 파쇄, 점화 열충격 +80%.
- 참고: [R23] 디아블로 서리 구슬 — 천천히 날며 사방에 파편.

**6-2. 연쇄 번개** · 숙련 15 · 원소 연결 · short 3 s · MP 8 · **S** (메테오's chain)
- 설명: "번개가 적에서 적으로 다섯 번 튄다. 불붙거나 언 적을 지날 때마다 원소 반응이 터진다."
- 기전: target ≤130, 5 jumps within 60 ×0.6, el l; a 화상/빙결 target hit sets off its reaction (과부하/초전도) once. Counts for 공명.
- 조합: the staff's missing short lightning button — fire/ice/lightning rotation without the signature.
- 참고: [R16] D2 번개 계열(연쇄) · our meteor chain.

**6-3. 점멸** · 숙련 30 · 이동 · mid 8 s · MP 6 · **S**
- 설명: "앞으로 번쩍 건너뛴다. 떠난 자리와 닿은 자리에 마력이 터진다."
- 기전: blink 90 (`stepTo`, gates excluded), 0.2 s ghost, burst r28 ×0.5 + slow 1 s at both ends.
- 조합: blink → stand 1.5 s → 정신 집중 +40% on the next spell.
- 참고: [R24] D4 원소술사 순간이동.

**6-4. 세 머리 원소 포탑** · 숙련 40 · 소환/파티 · long 18 s · MP 20 · **M** (turret prop)
- 설명: "지팡이를 꽂아 세 머리 뱀을 세운다. 머리마다 내가 최근 쓴 원소를 뱉는다."
- 기전: turret at aim, 8 s. Its three heads take the elements of my last three staff casts (default 불·얼음·번개); every 800 ms each head bolts the nearest ×0.25 with its element (화상 / 둔화 / 번개) → reactions on mixed targets.
- 조합: keeps the party's reactions going between my casts; uses `weave`/`WEAVE_CODE`.
- 참고: [R24] D4 히드라 — 머리 여럿이 자동 사격하는 소환.

**6-5. 얼음 감옥** · 숙련 45 · 생존 · long 30 s · MP 10 · **S**
- 설명: "스스로 얼음 속에 갇힌다. 아무것도 닿지 않고, 깨고 나올 때 주변이 얼어붙는다."
- 기전: 1.5 s `ghost`, cannot act; heals 10% max HP (20% under 30% HP). On exit (or press again): r48 — slowed mobs freeze 1 s, others slow.
- 조합: break out → frz → 점화 폭발 +80%. The staff's only panic button.
- 참고: WoW 얼음 방패 관례 · [R24] D4 원소술사 방어 기술.

## 7. 마도서 book — 묶고, 지키고, 되풀이하고, 불러낸다
Today: 유도 영혼 화살 · 중력 소용돌이 · 영혼 착취(유지) · 되살림 제본(치유) · 심연의 계약(소환) · 낙인/전염.

**7-1. 먹물 사슬** · 숙련 5 · 파티 증폭 · mid 12 s · MP 14 · **M (E6 share)**
- 설명: "먹물 사슬로 괴물 넷을 묶는다. 하나가 맞으면 나머지도 아프다."
- 기전: target + 3 mobs within r70 (branded first), 5 s: 30% of damage dealt to one (by anyone) is dealt to the others — no crit, no re-share; a link breaks past 120 apart.
- 조합: 저격·처형·용뼈 관통 single bursts spread to the pack; brand +15% applies to the shared part.
- 참고: [R25] 트리 오브 세이비어 링커 — 묶인 적끼리 피해 공유.

**7-2. 수호 문장** · 숙련 15 · 파티 지속 · mid 9 s · MP 12 · **M (E6 absorb)**
- 설명: "동료의 몸에 수호 문장을 새긴다. 문장이 있는 동안 내가 낙인에 준 피해가 그 동료를 치유한다."
- 기전: most-hurt ally (or self) ≤105: absorb 12% max HP + 20% of my attack, 6 s. While any shield lives, 15% of my damage to branded mobs heals the shield holders. Job XP credit like `healSupport`.
- 조합: prevent (this) vs restore (되살림 제본); turns brand into healing.
- 참고: [R26] WoW 수양 사제 — 보호막 + 속죄(딜이 치유로).

**7-3. 공포의 문장** · 숙련 30 · CC · mid 11 s · MP 10 · **M** (fear state)
- 설명: "땅에 공포의 글자를 적어 둔다. 밟은 괴물은 비명을 지르며 달아난다."
- 기전: glyph at aim, 15 s, one at a time. When a mob steps on it: r40 ×0.6 + brand + fear 1.5 s (mobs walk away from it; elites 0.8 s, bosses immune).
- 조합: feared = not targeting me → 암습 crit; fear out, then 중력 왜곡진 back in (2 × 끌림).
- 참고: [R27] 길드워 2 지팡이 문장 — 땅에 설치, 밟으면 발동, 종류당 하나.

**7-4. 메아리 쪽** · 숙련 40 · 버스트/타이밍 · long 16 s · MP 18 · **M**
- 설명: "책장 하나를 찢어 땅에 펼친다. 2초 뒤, 그 위에서 일어난 피해가 한 번 더 메아리친다."
- 기전: zone r56 at aim. For 2 s it records the damage the party deals to each mob inside, then replays 40% of it as magic damage + brand (cap 3× my attack per mob).
- 조합: lay it under 메테오·화살비·쇠말뚝 → the party's burst counts twice. Timing: cast just before the team's big moment.
- 참고: [R28] 트리 오브 세이비어 세이지 — 미소 차원의 지연 추가타.

**7-5. 먹물 분신 소환** · 숙련 45 · 쇼피스/소환 · long 30 s · MP 24 · **M–L**
- 설명: "도감에 적힌 괴물을 먹물로 불러낸다. 무섭게 생겼지만 이번엔 내 편이다."
- 기전: summons an ink copy of the last non-boss kind I killed that has a collection page, 10 s, using that kind's own attack and trick (its `MOBS` row) at 40% of its stats scaled to my attack. Ink tint over the existing mob art. A completed page → 60%.
- 조합: ties the monster collection to combat; a crypt bonehound copy bites, an eye crow copy shoots. 계약(짐승)은 한 방, 분신은 동료.
- 참고: [R29] 트리 오브 세이비어 소서러 — 마도서에 넣은 보스 카드를 소환.
- 보류(L): [R30] 로스트아크 아르카나 카드 — 게이지가 차면 책장 카드를 뽑아 두 장까지 쥐는 시스템. Fun but a new UI + RNG system.

## 8. 무기 교차 · 파티 조합 — cross-weapon / party combos

1. **못 박고 띄우고 꽂기**: 해머 쇠말뚝 → 단검 급소 차단·창 장대 도약이 박기로 참여 → 분출(공중) → 창 장대 도약 내려꽂기 +60%, 활 저격 +60%, 대검 하늘 베기 2타 +50%.
2. **연막 속 산 가르기**: 단검 연막탄(적이 표적을 잊음) → 대검 산 가르기 3단계를 아무도 끊지 못함 → 처형 내려베기로 경직 마무리. Tank variant: 대검 도발의 포효로 모으고 연막으로 내려놓기.
3. **피뢰 삼각**: 창 뇌창 투척(피뢰침) + 스태프 서리 구슬(둔화·빙결) → 연쇄 번개가 얼린 무리를 지나며 초전도 → 피뢰침 근처 찌르기마다 덤 번개.
4. **메아리 일제사격**: 마도서 먹물 사슬로 넷을 묶고 메아리 쪽을 깐다 → 활 곡사 폭약(표식) → 용뼈 관통 → 공유 30% + 메아리 40%가 겹친다.
5. **방패 뒤 궁수**: 창 고슴도치 창벽(뒤 −30%) 바로 뒤에서 활 구르며 쏘기 회심 · 도탄 화살 — 던전 복도 전용 진형.

## 9. 먼저 만들 10개 — top 10 by fun ÷ cost

1. 땅울림 발구르기 (해머, S) — the cheapest 공중 supply; makes 암습·저격·처형 bonuses fire far more often.
2. 곡사 폭약 화살 + 용뼈 관통 사격 (활, S + S–M) — a pair: the bow gets marks and a showpiece in two rows.
3. 구르며 쏘기 (활, S) — skill expression on the existing Space dash; one `dashAt` check.
4. 연쇄 번개 (스태프, S) — fills the staff's lightning gap; reactions on a short cooldown.
5. 어깨 돌파 (대검, S) — `tug` carry + a wall check; terrain becomes a weapon.
6. 올무 화살 (활, S) — `trap` prop already exists (tracker); root counts as 경직.
7. 칼날 소용돌이 (단검, S–M) — `spin` prop already follows the caster; stacking cast feels great.
8. 연막탄 (단검, S–M · E5) — party aggro tool and an 암습 enabler; E5 also unlocks 도발의 포효.
9. 칼등 받아치기 (대검, M · E3) — the first parry in the game; E3 then gives 고슴도치 창벽 almost free.
10. 산 가르기 (대검, M · E1) — the sword's showpiece; E1 then gives 회전 망치 almost free.

Next wave: E2 (하늘 베기, 꽂힌 비수, 장대 도약) and E4 (서리 구슬, 튕기는 망치, 도탄 화살, 꼬마 풍뎅이). Each new row needs an icon
(`public/skillicons.js`), an fx code (next free after 147, client draws), Korean desc, and a `tests/combos.mjs` case for any state it applies or eats.

## 10. 레퍼런스 — references (mechanic borrowed, not names or numbers)

- [R1] Monster Hunter 대검 차지·태클: https://www.icy-veins.com/monster-hunter-wilds/great-sword-guide
- [R2] Vindictus 피오나 퍼펙트 가드: https://vindictus.nexon.net/news/2310/fiona-revamp-update · https://vindictus.fandom.com/wiki/Fiona_Skill_Guide
- [R3] Monster Hunter 랜스 가드·카운터: https://www.gamerguides.com/monster-hunter-generations/weapon-breakdowns/weapons/lance
- [R4] Diablo IV 야만용사 돌진: https://mobalytics.gg/diablo-4/builds/barbarian/charge-barb
- [R5] Path of Exile 2 대지 분쇄 가시 + 함성: https://www.poe2wiki.net/wiki/List_of_skill_gems
- [R6] Monster Hunter 조충곤 도약·진액: https://www.icy-veins.com/monster-hunter-wilds/insect-glaive-guide
- [R7] Lost Ark 슬레이어(Glaivier) 두 자세: https://www.icy-veins.com/lost-ark/control-glaivier-skills · https://lostark.wiki.fextralife.com/Glaivier
- [R8] Diablo IV 도적 스킬(연막·그림자 걸음·덫): https://www.icy-veins.com/d4/rogue-class-skills
- [R9] Elden Ring 블러드하운드 스텝: https://eldenring.wiki.fextralife.com/Ash+of+War:+Bloodhound's+Step
- [R10] Hades 무기(창 투척, 방패 튕김·귀환, 활 타이밍 사격): https://www.rpgsite.net/feature/10254-hades-infernal-arms-weapon-aspect-guide-aspects-and-upgrades-in-detail
- [R11] Elden Ring 사자의 발톱 · 폭풍 발구르기: https://rankedboost.com/elden-ring/storm-stomp/ · https://www.pcgamer.com/best-elden-ring-ashes-of-war
- [R12] Path of Exile 칼날 소용돌이: https://www.poewiki.net/wiki/Blade_Vortex
- [R14] Ragnarok Online 소닉 블로우 개편: https://renewal.playragnarok.com/news/updatedetail.aspx?id=320
- [R15] World of Warcraft 도적(차단, 연계 점수): https://warcraft.wiki.gg/wiki/rogue · https://warcraft.wiki.gg/wiki/Combo_point
- [R16] Diablo II 아마존 창·투창(번개 분노, 충전 타격): https://diablo2.wiki.fextralife.com/Javelin+And+Spear+Skills
- [R17] Diablo II 펜드: https://diablo2.wiki.fextralife.com/Amazon+Skills
- [R18] Monster Hunter 해머 차지·회전·대폭발: https://www.icy-veins.com/monster-hunter-wilds/hammer-guide
- [R19] Diablo IV 고대의 망치 + 지진: https://maxroll.gg/d4/build-guides/hammer-of-the-ancients-barbarian-guide
- [R20] Monster Hunter 활 곡사·용의 일격: https://www.icy-veins.com/monster-hunter-wilds/bow-guide
- [R21] Dragon's Dogma 2 도탄 화살: https://dragonsdogma2.wiki.fextralife.com/Ricochet+Seeker
- [R22] Ragnarok Online 헌터(앵클 스네어, 블리츠 비트): https://renewal.playragnarok.com/gameguide/classes_skill.aspx?c=10
- [R23] Diablo 서리 구슬: https://maxroll.gg/d4/build-guides/frozen-orb-sorcerer-guide
- [R24] Diablo IV 원소술사(히드라, 순간이동): https://icy-veins.com/d4/guides/hydra-sorcerer-build · https://diablo4.wiki.fextralife.com/Sorcerer
- [R25] Tree of Savior 링커(조인트 페널티): https://www.tosbase.com/game/classes/Linker
- [R26] WoW 수양 사제(보호막·속죄): https://www.icy-veins.com/discipline-priest-wow-pve-healing-rotation-cooldowns-abilities
- [R27] Guild Wars 2 문장(Mark): https://wiki.guildwars2.com/wiki/Mark
- [R28] Tree of Savior 세이지(미소 차원): https://www.tosbase.com/game/classes/Sage
- [R29] Tree of Savior 소서러(마도서 카드 소환): https://treeofsavior.com/page/class/view.php?c=Sorcerer
- [R30] Lost Ark 아르카나 카드: https://www.icy-veins.com/lost-ark/arcanist-card-deck

Most-used: Monster Hunter (R1 R3 R6 R18 R20 — charge tiers, counters, vault/kinsect, hammer, bow), Diablo II/IV (R4 R8 R16 R17 R19 R23 R24),
Hades / Elden Ring (R9 R10 R11 — throw-return, timed shots, stomps, step).
