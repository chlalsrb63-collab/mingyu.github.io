# 보스 2차 — two field bosses, two raid bosses (design contract, not built)

Status: design only (2026-11-15). Nothing here is in the code yet. Player-facing names/texts Korean, the rest English.
Reference images from the owner were used for **abstract ideas only** (near-black bodies with one glowing accent,
bone-white masks/ribs, crystal shards, cloak-wings, a chest that opens to channel, spirit-flower glow). No
character, name, pose or layout is taken from them.

Contents: 0 Ground rules · 1 Shared numbers · 2 F1 혈루 왕도마뱀 (mesa) · 3 F2 망치 갯가재 (coast) ·
4 R1 밤장막 박쥐군주 (weekly, tier 45) · 5 R2 꽃무덤 고래 (weekly, tier 50) · 6 Balance table · 7 Rewards ·
8 NEW engine needs (task split) · 9 Open questions

---

## 0. Ground rules

- **Levels are tiers** (`MOBS[k].lv`, 1–50; shown Lv. = 4·t − 3, `docs/design/level-bands.md` 1.1). "mesa 36–42" is
  tiers. The brief's "raid ~Lv.45 / end-game ~Lv.100+" is read as **tier 45** (shown Lv.177) and **tier 50**, the cap
  (shown Lv.197–200), because no tier above 50 exists. If the owner meant player Lv.45/100 (tiers 12/25), see 9.
- **Monsters are hell-beasts of real animals**; all four below are real species whose real biology is the hook
  (blood-squirting horned lizard, cavitating mantis shrimp, flying fox, whale fall).
- **One accent per boss** (two for the last boss, one per phase). Near-black body `#120c10`-ish, one shadow tone,
  dark outline, bone-white mask/ribs `#e8dfcf` with shadow `#a89c8a`. Glow = accent pixels + a 1-px lighter core,
  no blur (pixel-art rules).
- **Telegraph rule**: a ring of radius r with telegraph t is a *walk-out* if t ≥ r / walk speed + 300 ms, otherwise
  it is a *dash check* (Space dash, 72 px, i-frames, 4 s cd). Never two dash checks on the same player inside 4.5 s.
  Existing timings stay the vocabulary: charge 850 ms, slam 1100, blast 1300, volley 650, pool fly 600 / lie 5000.
- **Prefer existing pattern kinds.** Server today: `charge` (lane + run), `leap`, `slam` (ring round itself),
  `pool` (kind 0 poison, 1 burn, 2 slow), `fan` (3/5 landing circles), `volley`/`shot` (basic ranged), `burst` (on
  death), the big-mob party blast (a ring on every player, 1300 ms). Paused branch `claude/rift-tiers` (`64-dim.js`
  chal*): `fan2`, `fan3`, `rings` (in, then out), `pools` (one per player), `charge2`, `leapslam`, the **marked cast
  + stagger gauge** (`DIM_CHAL`: every 4th cast, 6000 ms, break = 3% max HP dealt → 5000 ms stun; fail = 2.4×atk to
  all + fury +15%), soft enrage (240 s, +12% per 10 s), wipe reset. Client fx (`scene_fx.js`): ring tele proj spark
  slash beam pillar burst sparkle flash wave zap lane pool lob volley spit pop storm crack bolt fall snow arrow + shake.
- **NEW pattern kinds: exactly four** — `cone`, `donut`, `mark` (spread/share), `adds` (with shield/feed). Plus one
  NEW mechanism (phases by HP) inside a generalised boss-script runner (section 8).

## 1. Shared numbers (assumptions — verify with a probe before tuning)

Damage % below = `(A·k − 0.6·DEF) / HP` with `hurtPlayer`'s formula (±15% roll ignored), where A is the boss's
effective atk after load (`atk × (1.27 − (lv−16)·0.016)`, ×1.8 for a field boss `ELITE[2]`) and k the pattern
multiplier. Reference heroes (**assumed**, plainly geared, wil ~40; `SFX.hp = 70 + 2.5·lv + 13·wil` + gear):

| band | shown Lv. | ref max HP | ref DEF (−0.6·DEF) | assumed party DPS (4 heroes) |
| --- | --- | --- | --- | --- |
| tier 39 (coast) | 153 | 1,450 | 108 (−65) | ~950/s |
| tier 41 (mesa) | 161 | 1,500 | 110 (−66) | ~1,000/s |
| tier 45 (R1) | 177 | 1,800 | 125 (−75) | ~1,500/s |
| tier 50 (R2) | 197–200 | 2,200 | 140 (−84) | ~2,000/s |

Pattern uptime (boss hittable while patterns run, people dodging) assumed **70%**. Kill time ≈ HP / (DPS × 0.7).

---

## 2. F1 — 혈루 왕도마뱀 (field boss, 붉은바위 황금궁 `mesa`, tier 41)

**Animal**: horned lizard (뿔도마뱀) — the real one squirts blood from its eyes. Key `bloodhorn`.
**Look**: wide, low, flat silhouette 44×28 px (heroes 16×16). Near-black hide `#1a1012`, cracked into plates by
glowing seams `#ff3b3b` (core `#ffb0a0`). A bone-white skull mask with a crown of 7 horns. Rows of red crystal shards
`#ff6a5a` on the back. Eyes are two red slits that drip. **Phase 2**: shards double in height, the jaw splits to show a
red glow, seams pulse every 600 ms. A = 128 × 0.87 × 1.8 ≈ **200** → k1.0 ≈ 9% of ref HP.

| # | pattern (Korean) | what | telegraph | dmg (k → % ref HP) | counterplay | fx |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 혈루 사출 | a jet of blood from the eyes: a line of 5 small circles (r13) toward the target, 140 px, burn pools left on 3 of them | lane 900 ms | k1.6 → 17% + burn | sidestep the lane (walk); don't stand in the trail | lane + spit (pool kind 1) |
| 2 | 뿔관 돌진 | existing `charge` | 850 ms | k1.7 → 18% | dash through or sidestep | lane (existing) |
| 3 | 결정 가시 산탄 | existing `fan` (5 shots); P2 → `fan3` | 650 ms per volley | k1.0 → 9% each | move between landing circles | volley |
| 4 | 모래 잠행 | sinks into the sand, erupts under the farthest hero (`leapslam`) | ring r54, 1300 ms | k1.8 → 20% | the far (ranged) hero dashes out; melee follow | tele + crack + shake |
| 5 | 꼬리 휩쓸기 | a 120° sweep at whoever stands behind it (punishes melee camping its back) | **cone** r56, 1000 ms | k1.5 → 15% | step to the side / front | **NEW cone** |
| 6 | 피의 비 | existing party blast (ring on every hero) | r32, 1300 ms | k1.3 → 13% | everyone walks 1 body-length | tele (existing) |
| 7 | 붉은 결정 성장 (P2) | 3 red crystals sprout (adds: still, 1.5% boss HP each); each pulses a slam ring every 4 s | ring r34, 1100 ms | k1.2 → 12% | ranged break crystals, melee hold boss | **NEW adds** + tele |

- **Phases**: P1 100–60%. P2 60–25% (crystals, charge → `charge2`, fan → `fan3`). P3 < 25% "혈루 폭주": every
  pattern also leaves a burn pool, gap between casts −25%.
- **Stagger "왕관 깨기"**: at 60% and 25% (and each 4th cast after) it rears up for **혈루 대분출** — 4000 ms
  marked cast. 4% max HP dealt in time → crown cracks, 4000 ms stun, +30% damage taken (NEW vuln, tiny). Fail →
  geyser on everyone within 220 px k2.2 (≈ 25%) + a burn pool under each.
- **Enrage**: soft from 150 s (existing step: +12% per 10 s). No hard enrage in the open world (strangers may join).

## 3. F2 — 망치 갯가재 (field boss, 산호 해안 `coast`, tier 39)

Why coast and not cloudtemple: cloudtemple already has a real boss row (`mistiger`, 30,000 HP, `boss: true`), while
the coast's field boss `coralturtle` is **tier 32 inside a 34–40 band** — the weakest field boss for its band.
**Animal**: mantis shrimp (갯가재) — its club punch boils the water (cavitation). Key `clubshrimp`.
**Look**: upright segmented body 36×40 px, near-black carapace `#0e1418`, ice-cyan seams `#5ff2ff` (core `#c8ffff`).
Two bone-white clubs as big as its body (it mirrors the heroes' oversized weapons). Stalk eyes glowing cyan, tail fan
with cyan crystal tips. **Phase 2**: carapace cracks along the seams, clubs grow cyan crystal shards, the glow goes
white-cyan. A = 120 × 0.902 × 1.8 ≈ **195**.

| # | pattern | what | telegraph | dmg | counterplay | fx |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 공동 펀치 | punch circle at the target, then the bubble collapses in a wider ring on the same spot | r22 900 ms, then r40 +600 ms | k1.4 → 14%, then k1.0 → 9% | step out once — don't dash back in | tele ×2 + wave + flash |
| 2 | 연타 돌진 | existing `charge`; P2 `charge2` | 850 ms | k1.7 → 18% | sidestep | lane |
| 3 | 물거품 산탄 | existing `fan` 5, slow bubbles | 650 ms | k1.0 → 9% | weave | volley |
| 4 | 소용돌이 | spins its clubs: safe in its arms' reach, hurt at middle range | **donut** r30–90, 1400 ms (P2 1100) | k2.0 → 22% | melee step **in**, ranged step **out past 90** | **NEW donut** |
| 5 | 거품 함정 | existing `pools`: a slow puddle under every hero | 600 + 5000 ms | k0.4/s + slow | keep moving | spit (kind 2) |
| 6 | 조수 표식 | 2 heroes marked; after 3000 ms a burst at each hits everyone inside | **mark** r36 spread | k1.6 → 17% per overlap | marked heroes walk away from the party | **NEW mark** |
| 7 | 파도 강타 | existing party blast | r32 1300 ms | k1.3 → 13% | walk | tele |

- **Phases**: P1 100–50%, P2 < 50% "갑각 균열": punches in pairs, donut faster, mark on 3.
- **Stagger "눈자루 꺾기"**: each 4th cast **초공동 일격** charges 5000 ms; 4% max HP breaks it → 5000 ms stun
  + vuln. Fail → ring r110 round itself k2.4 (≈ 28%).
- **Enrage**: soft from 150 s.

## 4. R1 — 밤장막 박쥐군주 (raid, weekly boss challenge, tier 45)

**Lives**: the weekly 4-player boss challenge (`DIM_CHAL.bosses`, paused branch `claude/rift-tiers`) — rotation
becomes 크리온 32 → 심연의 어미 40 → **박쥐군주 45** → **꽃무덤 고래 50**. Entry `chalMinLv` = shown Lv.165.
Arena: the existing oval (32×22 tiles), dark theme.
**Animal**: flying fox / vampire bat (큰박쥐). Key `cloakbat`.
**Look**: tall hunched figure 56×64 px wrapped in its own tattered wings like a cloak; near-black `#120a16`,
violet-magenta seams `#d43cff`, core `#ff4fd8`. Bone-white pig-nosed skull mask, ears like horns. The ribcage on
the chest is a door: when it opens, a magenta eye-heart glows inside (the channel). **P2**: cloak tears into
ribbons, wings spread to 96 px, it flies. **P3**: the heart stays exposed and pulses; the arena rim darkens.
A = 260 × 0.806 ≈ **210** → k1.0 ≈ 7.5%.

| # | pattern | what | telegraph | dmg | counterplay | fx |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 장막 휘감기 | wing-cloak sweep at the target | **cone** 150° r60, 1000 ms | k2.0 → 19% | melee to its back/side; tank faces it away | **NEW cone** + slash |
| 2 | 초음파 고리 | existing `rings`: inner ring, then 4 outer | r58 1200 ms / r44 2100 ms | k1.6 → 14% / k1.4 → 12% | out, then back in | tele + wave |
| 3 | 흡혈 표식 | one hero marked; the burst is **shared** by everyone inside | **mark share** r40, 3500 ms | k5.0 split: alone 54%, 3 inside 15% each | the party stacks on the marked hero | **NEW mark** + pillar |
| 4 | 박쥐떼 | 4 `batcluster_blood` from the cloak (scaled to tier 45); alive after 20 s they fly into it, heal 2% each | spawn 800 ms | their own bites | ranged/AoE clears them | **NEW adds** + burst |
| 5 | 거꾸로 낙하 | existing `leapslam` on the farthest hero | r54 1300 ms | k1.8 → 17% | far hero dashes | tele + fall + shake |
| 6 | 날개 탄막 | existing `fan2` | 650 ms ×2 | k1.0 → 7.5% each | step into the first volley's gaps | volley |
| 7 | 핏빛 메아리 | existing `pools` (kind 0, drawn as blood) | 600 + 5000 ms | k0.4/s | keep the fight moving | spit |
| 8 | 심장의 포효 (marked cast) | chest opens, channels 6000 ms | existing `dc` cast bar | fail: k2.4 → 24% all (P3 k4 → 40%) + fury | **stagger** (below) | ring + storm (violet) |

- **Phases**: P1 100–70% grounded: 1, 2, 5, 6. P2 70–35% flying: adds every 3rd cast, mark, pools. P3 < 35%
  "장막 붕괴": 8 slow pools ring the arena rim for the rest of the fight (existing pools, long `until`), cast gap
  5200 → 3900 ms, cone becomes two cones (front + back).
- **Stagger**: break = 3% max HP during the 6000 ms channel (existing gauge) → 5000 ms stun, **+30% damage taken**
  (the heart is exposed — the "burst window" where all cooldowns go in). Missing it twice in P3 is a likely wipe.
- **Enrage**: soft 300 s (existing step), **hard 420 s** "영원한 밤": a k3 blast on all every 3 s. Limit 600 s.

## 5. R2 — 꽃무덤 고래 (raid, weekly boss challenge, tier 50, end-game)

**Lives**: the top slot of the weekly rotation; arena widened to 40×28 tiles for this boss (small NEW override).
Fits the planned 빙하 납골당 later if the owner prefers (9).
**Animal**: humpback whale — real "whale fall": a dead whale on the sea floor feeds a whole garden for decades.
Here the whale fell **through the rift** and the garden grew wrong. Hagfish (먹장어, real whale-fall scavengers)
burrow from its wounds as extra heads. Key `bloomwhale`.
**Look**: huge long silhouette 112×56 px, floating low. Near-black flesh `#0c1016`, bone-white exposed jaw and ribs,
ice-cyan crystal shards `#7ff6ff` growing between the ribs. **P2**: the ribs open like a cage around a cyan heart
crystal. **P3** "꽃무덤": violet-magenta spirit flowers `#ff5ad8` (core `#ffd0f4`) bloom over the whole body; the
cyan fades. A = 300 × 0.726 ≈ **218** → k1.0 ≈ 6%.

| # | pattern | what | telegraph | dmg | counterplay | fx |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 고래 낙하 | rises out of reach (untargetable), falls on the party's centre | ring r70, 1800 ms | k6 → 56% | everyone dashes/walks out; regroup | tele + fall + crack + shake |
| 2 | 수정 갈비 탄막 | existing `fan3` (+ pool) | 650 ms ×3 | k1.2 → 8% each | weave | volley |
| 3 | 꼬리 지느러미 | tail slap at its back | **cone** 120° r72, 1100 ms | k3 → 26% | don't stand behind it | **NEW cone** |
| 4 | 심해의 노래 | donut, then at once existing `rings` (in, then out) | **donut** r30–110 1500 ms, then rings | k3 → 26% each | in → out: the dance | **NEW donut** + wave |
| 5 | 먹장어 머리 | 3 hagfish heads at fixed spots, each shooting volleys; while any lives the whale takes −50% | spawn 1000 ms | volley k1.0 | split: 2 hold boss, 2 kill heads | **NEW adds (shield)** |
| 6 | 혼꽃 표식 | everyone marked; overlapping bursts stack | **mark spread** r36, 4000 ms | k2.5 → 21% per overlap | spread out | **NEW mark** + sparkle |
| 7 | 서리 결정 웅덩이 | existing `pools` kind 2 under everyone | 600 + 5000 ms | k0.4/s + slow | keep moving | spit + snow |
| 8 | 고래의 장송곡 (marked cast) | ribs open, heart channels 7000 ms | `dc` cast bar | fail: k8 → 75% all + fury | **stagger** | storm + pillar |

- **Phases**: P1 100–65%: 1, 2, 3, 4. P2 65–30%: heads at 65% and 45%, spread marks, ribs open (the cast every
  4th). P3 < 30%: the spirit flowers — share mark (as R1 #3) replaces spread; dive every 3rd cast; the song cast
  **cannot be skipped by cadence** (it comes at 30% and 10% too).
- **Stagger**: 3% max HP in 7000 ms → 6000 ms stun + **+30% damage taken**, heart shatters (P2 visual: ribs fall
  shut). The fight is designed around **four burst windows**: 65%, ~45%, 30%, 10%.
- **Enrage**: soft 360 s, **hard 480 s** "심해 합창": k10 to all every 4 s. Limit 600 s.

---

## 6. Balance table (rows to add to `MOBS`; compare with existing rows at the same tier)

Field bosses are plain rows promoted by `spawnFieldBoss` (`ELITE[2]`: hp ×14, atk ×1.8). Challenge bosses are
scaled by the branch's `DIM_CHAL.hp` (×9) × `DIM.hpN[n]` (**assumed 1.0 for 4 heroes**).

| boss | tier | row hp → effective | row atk → A | def | basic cd / cast gap | compare (existing, same tier) | kill time (4 heroes) | first-try deaths |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F1 bloodhorn | 41 | 4,800 → **67,200** | 128 → 200 | 32 | 1,300 / 5,000 ms | `crownpeacock` 42 (current mesa FB): 4,200 → 58,800, atk 124; `rotstag` 46 FB 72,800 | 67,200 / (1,000 × 0.7) ≈ **96 s** | 0–2 |
| F2 clubshrimp | 39 | 4,400 → **61,600** | 120 → 195 | 30 | 1,200 / 5,000 ms | `coralturtle` 32 (current coast FB): 2,100 → 29,400; `lionhand` 35 FB 36,400 | 61,600 / (950 × 0.7) ≈ **93 s** | 1–2 |
| R1 cloakbat | 45 | 60,000 → **540,000** | 260 → 210 | 46 | 1,400 / 5,200 (P3 3,900) | `abyssboss` 40: 48,000 (→ 432,000 as a challenge), atk 200; `crownstag` 50: 520,000 raw | 540,000 / (1,500 × 0.7 + stagger bonus) ≈ **5.0 min** | 4–8 deaths, 1–2 wipes |
| R2 bloomwhale | 50 | 100,000 → **900,000** | 300 → 218 | 52 | 1,500 / 5,200 | `crownstag` 50: 520,000, atk 205, def 50 | 900,000 / (2,000 × 0.7 + windows) ≈ **6.5 min** (hard enrage 8:00) | 8–15 deaths, 2–4 wipes; first clear expected in week 2 |

- Stagger value: a 5–6 s stun at +30% damage ≈ 8–10 s of normal damage → ~4% of a raid's time saved per window.
  A party that misses every window loses ~30 s and eats fury: R1 still clears before hard enrage, R2 does not.
- Tuning knobs (in order of use): cast gap (feel), k per pattern (curve), stag share and cast ms (gate), soft/hard
  enrage (gate), add HP (curve). Keep all in the boss's script row, not in code.

## 7. Rewards

| boss | drops | first kill |
| --- | --- | --- |
| F1 | the field-boss roll as today (`el 2`) + material **피눈물 결정** (100%, 1–3) for crafting/upgrading; 3% a boss-only unique weapon `혈루 왕관 창` (spear) | achievement + title **혈루를 닦은 자** |
| F2 | field-boss roll + **망치 갯가재 집게** (100%, 1–3); 3% unique `공동 망치` | title **망치를 꺾은 자** |
| R1 | `DIM_CHAL.big` (weekly) + 1 guaranteed rare-or-better piece (`gearQ` 3), 12% a set piece of a new 4-piece set **밤장막** (cloak/helm/ring/amulet), 4% legendary `흉곽 등불` (book), cosmetic 박쥐 망토 (wardrobe, 2%) | title **장막을 걷은 자** |
| R2 | `DIM_CHAL.big` ×1.5 + 2 rare-or-better, 10% a set piece of **꽃무덤** (4 pieces), 3% legendary `고래뼈 활` (bow) or `혼꽃 지팡이` (staff), pet 먹장어 아기 (1%) | title **고래의 장송곡**; server-first kill announced to all |

Set/legendary names are proposals: the item tables were not read for this doc; fit them to the existing
rarity/affix/set rules (`docs/RECIPES.md` item/set recipes) when building.

## 8. NEW engine needs — ordered by cost (each ≤ 100k-token task)

1. **Merge or extract the boss-challenge script** from `claude/rift-tiers` (`chalCast`/`chalTick`/stagger in
   `dimDealt`) into a general **boss-script runner** usable by any mob with `MOBS[k].script = { pats, cast, phases }`:
   HP-threshold phases (pattern list, gap, extra steps per phase), the marked cast + stagger anywhere (not only in a
   rift), +30% vuln while stagger-stunned, soft/hard enrage, untargetable flag (whale dive). Field bosses use it when
   `d.script` is set. *Prerequisite for everything; medium.*
2. **`donut`** — tele with inner radius `r0` (server hit `r0 ≤ d ≤ r`; client `fx.tele` draws the hole; event gets one
   more field at the end). *Small.*
3. **`cone`** — sector tele (centre, facing, half-angle, r): server angle test; client NEW `fx.cone` filled wedge
   (like `lane`). *Small.*
4. **`mark`** — per-hero timer: spread (burst hits all inside) or share (damage split by heads inside); event
   `["mk", eid, ms, r, share]`, client NEW `fx.mark` ring following the hero + countdown pips. *Medium.*
5. **`adds`** — a script step spawns temp mobs into the room (kind, n, spots), options `shield` (boss ×0.5 damage
   while any lives) and `feed` (an add reaching the boss heals it). *Medium.*
6. **Data rows + per-boss arena size override** (`DIM_CHAL.bosses[k].w/h`), the four `MOBS` rows, `FIELD_BOSS.mesa`
   and `.coast`, rewards/titles. *Small, one task per pair.*
7. **Art** (code-drawn, `mobart*.js`): one task per boss, P1 + phase variants, plus fx colour sets. *Medium each;
   R2 the largest (112×56).*

Suggested split: T1 = 1 · T2 = 2+3 · T3 = 4 · T4 = 5 · T5 = F1+F2 data/art · T6 = R1 data/art · T7 = R2 data/art.

## 9. Open questions for the owner

1. Levels: tiers 45/50 for the raids (shown Lv.177 / 197–200) — or did you mean player Lv.45/100 (tiers 12/25),
   which would need two lower raids instead?
2. Mesa: replace `crownpeacock` as the field boss (it becomes a lair elite), or keep it and give 혈루 왕도마뱀 its
   own lair/timer?
3. Coast instead of cloudtemple for F2 (cloudtemple already has `운해의 범`) — OK?
4. Raids in the weekly boss challenge requires un-pausing `claude/rift-tiers` (or extracting its boss script). Go?
5. R2 home: weekly rotation only, or also the end boss of the planned 빙하 납골당 (replacing the "얼음 왕" idea)?
