# maps-batch2 — 여섯 장의 새 참고 그림 (six new references → six maps)

Status: **design only — nothing here is built.** Follows `maps-v2.md` (generators, path-quality rules D, table C art
lists, tinted kin as M3 did) and `level-bands.md` (tiers, the roadmap). Owner's rule: build maps first, balance later —
every band below is **provisional** (a roadmap slot or a new slot); no existing band, monster or quest moves.

Contracts kept from maps-v2: fixed seed → same map every boot, 3 waypoint stones, a camp, zones (safe plaza → normal →
elite → hidden pockets), build < 150 ms, height is visual only, every door two-way, all six held strictly by
`tests/mapflow.mjs`. Tier `t` ↔ Lv.`4t−3 … 4t`.

## 0. Summary

| # | reference | map (id · theme) | kind | tiers (Lv.) | slot | size | doors (all two-way) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | coastal ridge | **바람개비 능선** `ridge` · `ridge` | field | 9–15 (33–60) | **new** (a second choice beside forest/crypt) | 184 × 112 | north ↔ meadow south* · west ↔ harbor east |
| 2 | harbour town | **물결 항구** `harbor` · `harbor` | **second safe town** + 부두 구역 (dock ward field) | ward 15–20 (57–80) | **new** (thickens the thin Lv.69–76) | 176 × 120 | east ↔ ridge west · north ↔ delta south · (ferry ↔ coast, Q2) |
| 1 | river-delta archipelago | **수련 삼각주** `delta` · `delta` | field | 17–23 (65–92) | roadmap **#5** (`swamp`, re-themed) | 184 × 124 | north ↔ forest south* · west ↔ jungle east* · south ↔ harbor north |
| 5 | misty mountain temple | **운해 사원** `cloudtemple` · `mist` | field + summit boss room (like the cave) | 30–36 (117–144) | roadmap **#7** (`skyruins`, re-themed) | 176 × 128 | west ↔ cave shaft* · south ↔ mesa ledge |
| 4 | red-rock mesa palace | **붉은바위 황금궁** `mesa` · `mesa` | field | 36–42 (141–168) | roadmap **#4** (in place of `volcano`, Q1) | 184 × 124 | west ↔ oasis east* · ledge ↔ cloudtemple south · north ↔ inklake south |
| 6 | ink-wash lake | **먹빛 호수** `inklake` · `ink` | field (sparse, strong monsters) | 39–45 (153–180) | **new** (first common monster at the empty tier 45) | 176 × 120 | south ↔ mesa north · north ↔ maple south* |

\* a new gate on an existing map (meadow south, forest south, jungle east, cave shaft, oasis east, maple south) — the
same kind of change M3 made for the city's south gate (a few dozen tiles, stones and spawns stay).

World graph after (new in bold): meadow → **ridge → harbor → delta** → jungle, and forest → **delta**; cave →
**cloudtemple → mesa → inklake** → maple, and oasis → **mesa**. Every new ground has a neighbour nearer the town whose
band starts lower.

Shared rules for the monster tables below:
- Stats: copy the same-tier neighbour in `MOBS` (hp/atk/def/xp/gold follow the tier), moves as listed. Moves in the
  rules today: `charge leap slam pool fan` plus `fly`, `shot`, `volley`, `burst` (`poolKind` 1 fire, 2 dark).
- **new** = a new body in `mobart_d.js`; **fallback** = an existing body + tint (`fire poison frost steel blood bile ash
  bone gold`) with a fitting Korean name, so the map ships before the art. No fallback key collides with a key in use.
- The two lowest kinds of each ground are **melee** (the rift's fallback pool takes the kinds nearest a level; two
  ranged kinds stopped the solo bot — maps-v2 I).
- Elites: one trait, guardians and field bosses two (`TRAITS`). Pack = monsters per spawn box in that region.
- **Rare spawn is a new small rule** (nothing like it exists): `cfg.rare: { mob, where, p }` — one box in the named
  region rolls the rare kind instead of its pack at each cell wake (p ≈ 0.04), an elite with two traits, gear chance ×3.
  Until it is built the rare kind stands as the guardian of that region's hidden-pocket chest (`vaultMobs`).
- Characters marked † are provisional: every ASCII mark is taken, objects use Greek letters (Ψ Φ Ω Δ are in use);
  check the `PIECE` legend and `editor-lib.mjs` before fixing a mark.

---------------------------------------------------------------------------------------------------------------

## 1. 바람개비 능선 `ridge` — coastal ridge (ref 3)

**Generator**: `wilds`, long east–west. `tiers: 4` (today 3 — needs a fourth level), `tierOpen: 0.25`, `ramp: 2`,
`roadW: 3`, `sea: { side: "s", surf: 2, shallow: 10, beach: 6, sand: "S" }`, rim `C` (grey sheer cliff) on the north.
Level 0 beach and viaduct foot, 1 terraced meadows, 2 hamlet shelf, 3 summit.

| region | level | what | monsters (tier) · pack | elites |
| --- | --- | --- | --- | --- |
| A 흰모래 해변 | 0 | white sand, shallows, driftwood, a wreck | 모래 두개골 게 9 · 3–4 | — |
| B 아치 육교 기슭 | 0 | the stone viaduct over the west road, gate, camp, stone 1 | 게 9, 이끼 뒤집힌 양 10 · 2–3 | — |
| C 계단밭 | 1 | terraced meadows (low `F` fences, steps), scarecrows | 양 10 · 4–5 (herds), 눈알 갈매기 11 · 2 | swift |
| D 붉은 지붕 마을 | 1–2 | two hamlets round a well, stone 2 | 갈매기 11, 벼랑 쌍두 염소 12 · 3 | tough |
| E 갈지자 길 | 2 | the switchback: 5 hairpins on the seaward slope | 염소 12 · 3, 풍차 당나귀 13 · 2 | thorn |
| F 회색 낭떠러지 | 2–3 | back cliffs, ledges, hidden pockets (elite ground) | 당나귀 13, 밀밭 반쪽 멧돼지 14 · 2–3 | swift, burst (35 %) |
| G 풍차 꼭대기 | 3 | the windmill and cliff shrine, stone 3, field boss | 멧돼지 14 · 2 round the arena | — |

- **Routes**: the switchback is the spine (3 wide, dirt centre, grass shoulders) from the west gate to the summit;
  each hairpin pair is joined by a **goat stair** (`v`, 3 wide) so the climb is never forced the long way → loops
  (target cycle rank ≥ 14) and tortuosity held ≤ 2.0 (the bare switchback alone would read ~3). A second way runs
  the beach (shallows are loop ground) and climbs at the east end; the north gate (meadow) lands on level 1 in C.
  Dead ends: the hamlets' back yards and cliff pockets only (≤ 7 cells).
- **Set pieces** (`PIECES`): `windmill` (9 × 9 court, the mill a big prop, chest behind), `redhamlet` (4 cottages `$`
  round a well + chest), `terrace` (3 stepped strips with a scarecrow), `viaduct` (a row of 4 arches; the road walks
  under — the arch tech of table C A.2/A.4), `cliffshrine`, `beachwreck` (a hull on the sand, chest in the ribs).
- **Field boss** (G, tier 15): **바람개비 숫양** — a ram whose horns grew into four windmill vanes that turn as it
  breathes. Traits swift + thorn. `charge` 120 (850 ms line down the hairpin), `fan` 100 (vane sweep), `leap` 90.
- **Rare**: 달빛 쌍두 토끼 (`twinhare_frost`, tier 12) on the beach A. **Chests**: 7 (`chest_ridge` Lv 12): summit,
  two hamlets, wreck, shrine, two cliff pockets (guardian 풍차 당나귀, tough + vamp).

| monster | tier | look | body | moves |
| --- | --- | --- | --- | --- |
| 모래 두개골 게 `crabskull_gold` | 9 | kin | crabskull + gold | charge |
| 이끼 뒤집힌 양 `lambmaw_bile` | 10 | kin | lambmaw + bile | charge |
| **눈알 갈매기** `eyegull` | 11 | a gull crusted with barnacles, one wet eye inside the open beak | **new** (shared with harbor); fallback `eyecrow_frost` 바다 눈알 까마귀 | fly, shot |
| 벼랑 쌍두 염소 `twingoat_bone` | 12 | kin | twingoat + bone | charge |
| **풍차 당나귀** `millmule` | 13 | a donkey split along the spine, ribs spread like mill sails | **new**; fallback `horsehalf_bone` 백골 반쪽 말 | slam, fan |
| 밀밭 반쪽 멧돼지 `splitboar_gold` | 14 | kin | splitboar + gold | charge |
| **바람개비 숫양** `vaneram` | 15 boss | above | **new**; fallback `twingoat_frost` 흰 쌍두 숫양 | charge, fan, leap |

Ground/objects — reuse: `.` `,` `t` `p` `v` `S` `~` `-` `w` `C` `F` `$` `T` `B` `R` `l`. New: none required (windmill
and viaduct are big props). Weather `ridge: [44, 16, 12, 4, 24, 0]` (windy). BGM: bright pastoral — whistle and
plucked strings over a 6/8 lilt, gull calls. Life nodes grade 2: 바닷바람 약초, 조개/소금 (beach), 양털 뭉치 (terraces).

## 2. 물결 항구 `harbor` — harbour town (ref 2): a second safe town with a monster dock ward

**Recommendation: a town, not a plain hunting ground.** The reference is a lived-in town; the world's only hub is
far from the coast. The north-east third is safe (윗마을), the rest is the infested **부두 구역**. One map, the safe
zone enlarged (zone 0 of `33-maps-zones.js`, ~56 × 44) — or two maps (Q3).

**Generator**: `metro` with three new settings: `radial: { x, y, r: 7, spokes: 6 }` (a round cobbled plaza `k` with
the monument and 3-wide alleys radiating, joined by a ring lane → loops), `sea: { side: "s", … }` with **piers**
(`b` planks 3–5 wide running out over `w`, cross-joined by gangways so no pier is a dead end longer than 7), `quay`
(a 5-wide stone `=` band along the waterline). The hill: `tiers: 2`, stairs `v` 3 wide down every spoke.

| region | what | monsters (tier) · pack | elites |
| --- | --- | --- | --- |
| A 윗마을 광장 (safe) | round plaza, monument = stone 1, shop / warehouse / inn / ferry master / fish buyer, the mirror | none | — |
| B 돌 부두 (safe → normal) | the quay, moored boats, fishing spots (G3) | east half safe; west half 그물 고양이 15 · 2 | — |
| C 생선 시장 | stalls, crates, awnings; wide plaza 13 × 11 | 고양이 15 · 4, 소금 쥐 왕 16 · 3 | swift |
| D 창고 골목 | warehouse rows, 3-wide lanes, barricade dead ends with chests | 쥐 왕 16 · 4–5, 따개비 물개 17 · 2 | poison |
| E 그물 말리는 마당 | net racks (soft objects), stone 2 | 물개 17 · 2, 잿빛 눈알 갈매기 18 · 3 (fly over the racks) | frost |
| F 조선소 | a hull on the slip (big prop), timber stacks, cranes — elite ground | 갈매기 18, 먹물 촉수 쥐 19 · 3 | vamp, tough (35 %) |
| G 방파제와 등대 | a long 5-wide breakwater to the lighthouse, stone 3, the wreck pier — field boss | 촉수 쥐 19 · 2 | — |

- **Routes**: plaza → six spokes → ring lane → quay (spine, 5 wide) → ward. The ward is a metro spanning tree with
  `loops: 0.3`; piers and gangways add water-side loops (target cycle rank ≥ 12). Tortuosity 1.2–1.6 to the east and
  north gates. The breakwater is the one long finger: it loops back by the wreck pier's gangway.
- **Set pieces**: `rotunda` (plaza + monument), `fishmarket`, `netyard`, `slipway` (hull), `lighthouse`, `wreckpier`,
  `boathouse` (hidden pocket, door ≤ 8 steps), `customs` (gatehouse between safe quay and ward — the zone line is
  visible: lamps lit on the safe side, broken on the other).
- **Field boss** (G, tier 20): **난파선 소라게** — a hermit crab the size of a cart wearing a rowboat hull, oars for
  legs. Traits tough + poison. `charge` 120 (along the breakwater — sidestep onto a pier), `slam` 40, `pool` 26
  (bilge, `poolKind: 2`).
- **Rare**: 황금 다리 달린 생선 (`fishwalker_gold`, tier 19) in the fish market C. **Chests**: 6 (`chest_harbor` Lv 18):
  warehouse dead ends ×2, boathouse, slipway, lighthouse, wreck pier (guardian 따개비 물개, tough + frost).

| monster | tier | look | body | moves |
| --- | --- | --- | --- | --- |
| **그물 고양이** `netcat` | 15 | dock cats knotted into one fishing net, heads and paws through the mesh | **new**; fallback `catsplit_ash` 부두 갈라진 고양이 | leap |
| 소금 쥐 왕 `ratking_bone` | 16 | kin | ratking + bone | — (fast melee) |
| **따개비 물개** `barnacleseal` | 17 | a seal armoured in barnacles that open like mouths | **new**; fallback `fishwalker_bone` 소금 다리 달린 생선 | slam |
| 잿빛 눈알 갈매기 `eyegull_ash` | 18 | the ridge's gull, soot-grey | eyegull + ash; fallback `pigeonmass_frost` 갈매기 떼살 | fly, shot |
| 먹물 촉수 쥐 `squidrat_ash` | 19 | kin | squidrat + ash | pool (2) |
| **난파선 소라게** `wreckhermit` | 20 boss | above | **new**; fallback `crabskull_steel` 닻 두개골 게 | charge, slam, pool |

Ground/objects — reuse: `k` cobbles, `=` quay stone, `b` planks, `v`, `w`, `m` lane, the city's towers re-skinned as
red-tile / thatch houses (theme skin), `F`, crates and barrels from the rooms' furniture. New: `Γ`† moored boat /
mooring post (also delta, inklake). Weather `harbor: [38, 22, 20, 8, 12, 0]`. BGM: safe side a warm accordion-and-
fiddle waltz; the ward the same tune in a minor key with a low drone (one track, two layers by zone if cheap, else
two tracks). Life: fishing G3 off the quay (sea fish), 따개비, 표류목. Town services follow `town.md` / `npc-life.md`
(a small cast of 6–8; not part of this doc).

## 3. 수련 삼각주 `delta` — river-delta archipelago (ref 1)

Fills roadmap #5 (the 안개 늪 slot and doors) with a brighter face: a garden delta by day, mist and fireflies at
night and in fog — the roadmap's mangrove rim and drowned shrine stay as its far regions.

**Generator**: `wilds` with a new mode `isles: { channel: [4, 6], bridge: 3, lily: 0.3 }`: Voronoi regions shrink
back from their borders, the gaps fill with water `w` (a braided river, edges `~` shallows 1–2 wide); every edge of
the Gabriel graph of region sites becomes a **bridge** — planks `b`, 3 wide, bowed (A* over a meander field, as the
cave's ways) — or, by `lily`, a **lily ford** (`ο`† walkable pads over water, 3 wide, drawn as overlapping pads). One
level only (`tiers: 1`); variety comes from the islets, not height. Dense forest `T` rims the map.

| region | what | monsters (tier) · pack | elites |
| --- | --- | --- | --- |
| A 나루 마을 | docks, boats, 4 domed huts, camp, stone 1 (north gate) | 손 달린 도롱뇽 17 · 2 | — |
| B 꽃밭 정원 섬 | 5–6 small garden isles, flower beds `f`, hedges `H`, arched bridges | 도롱뇽 17 · 3–4, 늪 거머리 아가리 18 · 3 | swift |
| C 둥근 지붕 탑 섬 | whimsical domed towers and a clock dome on two big isles, stone 2 | 거머리 18, 부푼 왜가리 19 · 2 (on the banks) | poison |
| D 수련 여울 | a wide shallow `~` reach strewn with lily fords — open loop ground | 왜가리 19 · 2, 수초 뱀장어 매듭 20 · 2 | frost |
| E 갈대 미로 | reed `e` thickets (soft: `widen` cuts 3-wide lanes), boardwalks | 뱀장어 20, 하루살이 덩어리 21 · 4 (swarms) | burst |
| F 물안개 숲 가장자리 | mangrove roots, black pools, fireflies — elite ground, west gate, stone 3 | 하루살이 21, 이끼 다리 달린 생선 22 · 2–3 | vamp, tough (35 %) |
| G 가라앉은 사당 섬 | a half-drowned shrine ringed by lotus — field boss; south gate beyond | 생선 22 · 2 | — |

- **Routes**: every isle has ≥ 2 crossings (Gabriel graph minus nothing: `loops: 0.6`), so the archipelago is loops by
  nature (target cycle rank ≥ 20). Bridges never narrow under 3 and land on a 3 × 3 pad of bank. Tortuosity 1.25–1.7:
  the spanning tree north → south winds across ~9 isles. No river-road conflict (what broke the jungle's bridge):
  there are no roads, only bridges, and each is cut as a `crossing` with its own banks.
- **Set pieces**: `domehut`, `clockdome` (the tall landmark), `gardenisle` (beds round a fountain + chest), `boatdock`,
  `lotusshrine` (boss court, 13 × 11, flagstones under a hand of water `~`), `reedblind` (hidden pocket), `mooncrossing`
  (a high arched bridge, purely a sight on the main way).
- **Field boss** (G, tier 23): **연꽃등 자라** — a soft-shell turtle with a lotus pond on its back and a second mouth
  where the shell splits. Traits tough + poison. `slam` 42, `pool` 28 (lotus spit, `poolKind: 2`), `charge` 110.
- **Rare**: 흰 세 머리 뱀 (`hydrasnake_frost`, tier 21) on the lily fords D. **Chests**: 8 (`chest_delta` Lv 20): garden
  isle ×2, clock dome, dock, reed blinds ×2, mangrove pocket, shrine (guardian 부푼 왜가리, swift + vamp).

| monster | tier | look | body | moves |
| --- | --- | --- | --- | --- |
| **손 달린 도롱뇽** `handnewt` | 17 | a pale newt walking on four human hands, gills like fingers | **new**; fallback `gutfrog_frost` 수련 창자 개구리 | leap |
| 늪 거머리 아가리 `leechmaw_bile` | 18 | kin | leechmaw + bile | leap |
| **부푼 왜가리** `bloatheron` | 19 | a heron with a throat sack full of staring fish heads | **new**; fallback `owlstare_bone` 흰 목 꺾인 올빼미 | shot (stands; fallback flies) |
| 수초 뱀장어 매듭 `eelknot_bile` | 20 | kin | eelknot + bile | volley |
| 하루살이 덩어리 `batcluster_bile` | 21 | kin (reads as a mayfly swarm) | batcluster + bile | fly, burst |
| 이끼 다리 달린 생선 `fishwalker_bile` | 22 | kin | fishwalker + bile | slam |
| **연꽃등 자라** `lotusturtle` | 23 boss | above | **new**; fallback `gatorhalf_poison` 수련 반쪽 악어 | slam, pool, charge |

Ground/objects — reuse: `.` `,` `f` `t` `b` `w` `~` `e` `H` `T` `B` `j` (bog in F), `=`. New: `ο`† lily ford
(walkable; **not** in `SOLID_G`), `Γ`† boat, domed hut (theme skin of `Δ`). Weather `delta: [34, 20, 22, 20, 4, 0]`.
BGM: music-box and marimba over soft water arpeggios; night/fog thins it to the arpeggio and a low flute. Life G3:
연근, 수련 꽃, river fishing (민물고기), 갈대.

## 4. 운해 사원 `cloudtemple` — misty mountain temple (ref 5)

Fills roadmap #7 (하늘 유적's band and its cave door): crags over a cloud sea instead of floating islands. **Field +
a summit boss room**, as the cave is — the climb is the field, 대웅전 at the top is party content. (As a pure party
dungeon it would lose the weather and the day; Q4.)

**Generator**: `wilds`, `tiers: 5`, `tierOpen: 0.15`, `ramp: 2`, `gorge` + `crossings` (the forest's cut river, here
with **stone bridges** `=` instead of planks and a waterfall at every level step: `m.falls`), `sea` on the south and
east filled with **cloud** — rule-wise deep water `w` (no new solid mark), drawn as cloud by the theme. Cloud also
fills 3–4 `lakes` between crags so the map reads as peaks standing in mist. The entry (west, 산문) is level 0.

| region | level | what | monsters (tier) · pack | elites |
| --- | --- | --- | --- | --- |
| A 산문 | 0 | mountain gate, pilgrim camp, stone 1 | 안개 다람쥐떼 30 · 3 | — |
| B 단풍 돌계단 | 0–1 | broad stair terraces under red and gold trees | 다람쥐떼 30 · 4, 먹빛 반쪽 멧돼지 31 · 3 | swift |
| C 폭포 다리 | 1–2 | the gorge, three falls, the long stone bridge (the reference's centre) | 멧돼지 31, 겹날개 두루미 32 · 2 (over the gorge) | frost |
| D 탑전 마당 | 2–3 | pagoda courts on stepped terraces, flagstones, lanterns, stone 2 | 두루미 32, 단풍 갈비뼈 사슴 33 · 2–3 | tough |
| E 구름 벼랑길 | 2–3 | a ledge walk along the cloud sea with lookout pavilions | 사슴 33, 비단 뱀장어 매듭 34 · 2 (by the fall pools) | thorn |
| F 종루 | 4 | bell-tower terrace — elite ground, field boss, stone 3 | 뱀장어 34, 먹빛 아가리 곰 35 · 2 | fire, vamp (35 %) |
| G 정상 대웅전 | 4 | the summit hall: a walled arena 21 × 17 behind a 3-wide neck (`m.noDig` shell as the cave's) | arena boss only | — |

- **Routes**: the stair way west → summit is the spine (3 wide `r` with `v` ramps 5 wide); each level has a second
  ramp on the far side and the ledge walk E by-passes D, so every level is a loop (target cycle rank ≥ 12, tortuosity
  1.3–1.8 to the south door). Three gorge crossings (bridge, ford below a fall, upper bridge). The south door (to
  mesa) leaves from level 1 down a cliff stair.
- **Set pieces**: `pagoda` (3-tier hall, big prop over a 7 × 7 court + chest), `belltower`, `stonebridge` (the long
  crossing, railings, mist below), `lanterncourt`, `pavilion` (lookout on a spur; hidden pocket behind), `mountaingate`,
  `summithall` (arena).
- **Field boss** (F, tier 35): **종지기 곰** (`bearmaw_ash` grown large) — tough + fire; `slam` 42, `pool` 26 (`poolKind:
  1`, embers from the censer it drags), `charge` 110.
- **Summit boss** (G, tier 36, `boss: true`, respawn as 크리온): **운해의 범** — a tiger with three faces stacked on one
  neck, its stripes opening as mouths. `charge` 150 (roars first), `leap` 120, `fan` 150; at half health clouds roll
  in (the arena's rim tiles fill for 5 s — an existing `pool` ring at the rim, `poolKind: 2`).
- **Rare**: 흰 갈비뼈 사슴 (`ribdeer_frost`, tier 34) on the stair terraces B. **Chests**: 7 (`chest_cloudtemple` Lv 33):
  pagoda ×2, pavilion pockets ×2, lantern court, bridge end, bell tower (guardian 겹날개 두루미, swift + frost).

| monster | tier | look | body | moves |
| --- | --- | --- | --- | --- |
| **염주 원숭이** `beadmonkey` | 30 | small monkeys threaded on one spine like prayer beads, moving as one | **new**; fallback `blightsquirrel_ash` 안개 다람쥐떼 | leap |
| 먹빛 반쪽 멧돼지 `splitboar_ash` | 31 | kin | splitboar + ash | charge |
| **겹날개 두루미** `wingcrane` | 32 | a crane with six wings and a neck tied in a knot | **new** (shared with inklake); fallback `serpentwing_frost` 흰 날개 구렁이 | fly, volley |
| 단풍 갈비뼈 사슴 `ribdeer_gold` | 33 | kin | ribdeer + gold | slam |
| 비단 뱀장어 매듭 `eelknot_gold` | 34 | kin (reads as koi) | eelknot + gold | volley |
| 종지기 곰 `bearmaw_ash` | 35 field boss | kin | bearmaw + ash | slam, pool, charge |
| **운해의 범** `mistiger` | 36 boss | above | **new**; fallback `lionhand_frost` 안개 손갈기 사자 | charge, leap, fan |

Ground/objects — reuse: `r` `=` `v` `%` leaves, `w` (cloud skin), `C` (grey crag skin), `T`/`P` in autumn colours
(maple's), `O`, `3` lantern. New: `Σ`† twisted pine (also mesa, inklake), `Π`† pagoda block (tiered roof; also mesa
gold, inklake grey). Weather `mist: [18, 24, 14, 36, 6, 2]` (fog first; fog already lowers aggro ×0.9). BGM: sparse
bamboo flute and a slow zither figure, a temple bell every eight bars; the arena adds taiko. Life G4: 산삼, 운모 광맥,
단풍 수액.

## 5. 붉은바위 황금궁 `mesa` — red-rock mesa palace (ref 4)

Takes roadmap #4's band and doors (oasis east → here → north toward maple): the red rock is the desert's own edge,
so the walk oasis → mesa needs no story. The volcano idea moves to a later batch or is dropped (Q1).

**Generator**: `wilds`, `tiers: 4`, `tierOpen: 0.1` (canyons mostly shut → the ways wind), `ramp: 2`, `river: true`
with `falls` at each step and misty `pools`, rim and level steps in **red sandstone** (`C`, the `sandstone` skin in a
red tone). New setting `pillars: 0.4`: on the top two levels regions are split into separate **mesa tops** joined by
3-wide bridges `b` (rope-and-plank) — the same bridge pass as the delta's `isles`, over a drop instead of water (the
gap tiles are cliff `C`).

| region | level | what | monsters (tier) · pack | elites |
| --- | --- | --- | --- | --- |
| A 협곡 아랫마을 | 0 | the lower temple town: red walls, market stair, camp, stone 1 (west gate) | 전갈 등뼈 36 · 2 | — |
| B 붉은 협곡 미로 | 0 | slot canyons 3–5 wide, braided | 전갈 36 · 3–4, 붉은 꼬인 여우 37 · 3 | swift |
| C 폭포 웅덩이 | 0–1 | three falls into mist pools, fords, wet ferns | 여우 37, 독수리 갈비 38 · 2 (circle the falls) | poison |
| D 소나무 벼랑길 | 1–2 | pine ledges, stairs cut in the rock, stone 2 | 독수리 38, 벼랑 붉은 염소 39 · 3 | thorn |
| E 바위기둥 숲 | 2 | mesa tops joined by bridges — loop ground with long views | 염소 39 · 2, 금박 암퇘지 40 · 2 | burst |
| F 황금 지붕 궁 | 3 | palace courts: flagstones, colonnades, gold-roofed halls — elite ground, stone 3 | 암퇘지 40, 황금 반쪽 말 41 · 2–3 | fire, tough (35 %) |
| G 옥좌 전각 마당 | 3 | the throne-hall forecourt — field boss | 말 41 · 2 as honour guard | — |

- **Routes**: canyon floor = a braided net (cycle rank target ≥ 14); two stair ways climb (the market stair and the
  pine ledges) and meet in E; the palace is entered by two bridges. Tortuosity 1.4–1.9 west → north. The ledge door
  (cloudtemple) sits on level 1 in D; the north door (inklake) on level 0 below the falls — the river runs out there.
- **Set pieces**: `goldhall` (palace hall, big prop over an 11 × 9 court), `templetown` (stacked houses on a stair),
  `mistfall` (pool + chest behind the sheet — hidden pocket), `rockarch`, `ropebridge`, `colonnade`, `thronecourt`
  (15 × 13), `ledgeshrine`.
- **Field boss** (G, tier 42): **금관 공작** — a peacock whose tail is a fan of gilt blades, each "eye" a real eye.
  Traits fire + swift. `fan` 150 (the tail opens for 850 ms first), `charge` 120, `pool` 28 (`poolKind: 1`, gold fire).
- **Rare**: 백골 날개 구렁이 (`serpentwing_bone`, tier 40) circling the falls C. **Chests**: 8 (`chest_mesa` Lv 39): temple
  town, mist-fall pockets ×2, ledge shrine, pillar tops ×2, palace ×2 (guardian 황금 반쪽 말, tough + fire).

| monster | tier | look | body | moves |
| --- | --- | --- | --- | --- |
| **전갈 등뼈** `spinescorp` | 36 | a scorpion that is one bare spine, the sting a skull (maps-v2 wish list) | **new**; fallback `spiderhand_fire` 붉은 손가락 거미 | charge (fallback leap) |
| 붉은 꼬인 여우 `foxtwine_fire` | 37 | kin | foxtwine + fire | leap |
| **독수리 갈비** `ribvulture` | 38 | a vulture with an open ribcage it carries bones in | **new**; fallback `owlstare_gold` 황금 목 꺾인 올빼미 | fly, shot |
| 벼랑 붉은 염소 `twingoat_blood` | 39 | kin | twingoat + blood | charge |
| 금박 암퇘지 `sowseer_gold` | 40 | kin | sowseer + gold | pool (2) |
| 황금 반쪽 말 `horsehalf_gold` | 41 | kin | horsehalf + gold | leap |
| **금관 공작** `crownpeacock` | 42 boss | above | **new**; fallback `lionhand_gold` 황금 손갈기 사자 | fan, charge, pool |

Ground/objects — reuse: `z` (red sand skin), `s`, `=`, `r`, `v`, `b`, `w`, `C`, `q`/`U` colonnades, `R`. New: `Θ`† rock
pillar / hoodoo (tall, also the inklake's islet rock in grey), `Σ`† pine, `Π`† hall block in gold. Weather `mesa:
[56, 12, 4, 6, 22, 0]`. BGM: wide and bright — horn fifths over hand drums, a pentatonic string line; near the falls
the drums drop out. Life G4: 사금 (river), 붉은 점토, 송진, 금빛 선인장 열매.

## 6. 먹빛 호수 `inklake` — ink-wash lake (ref 6)

A deliberately **quiet** ground: few monsters, each strong — the reference is calm and sparse, and Lv.153–180 hunters
have three crowded fields already. `DENSITY` ≈ 17 (others 11–12.6), packs of 1–2, elite share in the far half 50 %.

**Generator**: `wilds`, one level, `sea`-style water on **all** the inner ground: the lake is mostly walkable mirror
shallows `~` (the coast's mark, drawn pale grey), with deep ink pools `w` as the barriers (`lakes: 9`, irregular),
rocky islets (`Θ` rock, `Σ` pines) as region walls (`walls: [["rocks", 0.5], ["reeds", 0.3], ["pines", 0.2]]`) and
low earth banks for the plum groves. Open ratio target 70–80 % (the shallows count as walkable).

| region | what | monsters (tier) · pack | elites |
| --- | --- | --- | --- |
| A 나루터 | a jetty and two boats, a hermit's hut, camp, stone 1 (south gate) | 먹 거머리 아가리 39 · 1–2 | — |
| B 거울 여울 | wide open shallows, stepping rocks — the empty middle of the painting | 거머리 39 · 2, 먹빛 다리 달린 생선 40 · 1–2 | frost |
| C 굽은 소나무 바위섬 | 8–10 rock islets with one twisted pine each, sand bars between | 생선 40, 먹빛 겹날개 두루미 41 · 1 (one per islet) | swift |
| D 붉은 매화 둔덕 | the only colour: plum and cherry banks, petals on the water, stone 2 | 인면 먹나방 42 · 2, 매화 거미 43 · 1–2 | vamp |
| E 갈대 안개밭 | reeds in standing mist (sight short, lanes 3 wide) — elite ground | 거미 43, 붉은 묘지 매화 44 · 2 | poison, thorn (50 %) |
| F 먹 웅덩이 | black pools ringed by rocks; hidden pockets | 묘지 매화 44 · 1 guarding each | burst |
| G 외딴 탑 섬 | the lone pagoda on the largest islet, stone 3, north gate beyond — field boss | — | — |

- **Routes**: no roads — the open shallows are the way; barriers are pools and islet chains, each chain broken by
  ≥ 2 sand bars 3 wide (cycle rank target ≥ 16). Tortuosity is the risk on an open map: hold ≥ 1.15 by laying the
  two longest islet chains across the south → north line. Signposting: stone lanterns `3` on the bars (lit at night).
- **Set pieces**: `lonepagoda` (5-tier, big prop, court 9 × 9), `plumbank` (three trees round a stone table + chest),
  `pineislet`, `hermitjetty`, `inkpool` (pocket), `moongate` (a round stone gate standing in the water — a sight),
  `stonelanterns`.
- **Field boss** (G, tier 45): **먹빛 이무기** — a serpent drawn in one brush stroke, a pale pink sun for its eye; it
  rises out of the shallows. Traits vamp + frost. `fan` 150 (ink spray), `pool` 30 (ink, `poolKind: 2`), `charge` 130
  (a straight wake on the water telegraphs it). The first common kind at tier 45, which is empty today.
- **Rare**: 흰 꼬인 여우 (`foxtwine_frost`, tier 43) under the plum trees D. **Chests**: 6 (`chest_inklake` Lv 42): plum
  banks ×2, pine islet, ink pools ×2, pagoda (guardian 매화 거미, swift + poison).

| monster | tier | look | body | moves |
| --- | --- | --- | --- | --- |
| 먹 거머리 아가리 `leechmaw_ash` | 39 | kin | leechmaw + ash | leap |
| 먹빛 다리 달린 생선 `fishwalker_ash` | 40 | kin (reads as an ink carp) | fishwalker + ash | slam |
| 먹빛 겹날개 두루미 `wingcrane_ash` | 41 | the cloud temple's crane in ink grey, red crown | wingcrane + ash; fallback `owlstare_ash` 먹빛 올빼미 | fly, volley (fallback shot) |
| 인면 먹나방 `mothface_ash` | 42 | kin | mothface + ash | fly, shot, pool |
| **매화 거미** `plumspider` | 43 | a spider whose abdomen is a flowering plum branch, petals for eyes | **new**; fallback `spiderhand_blood` 매화 손가락 거미 | leap, pool |
| 붉은 묘지 매화 `gravrose_blood` | 44 | kin | gravrose + blood | volley, pool (2) |
| **먹빛 이무기** `inkserpent` | 45 boss | above | **new**; fallback `serpentwing_ash` 먹빛 날개 구렁이 | fan, pool, charge |

Ground/objects — reuse: `~` `w` `S` (grey sand bars) `e` `r` `3` `b`. New: `Σ`† pine, `Θ`† rock, `Π`† pagoda, `Γ`†
boat, a blossom tree (theme skin of `P` in red — the one accent; the theme palette is otherwise grey-on-paper).
Weather `ink: [16, 26, 12, 42, 2, 2]`. BGM: almost silence — single plucked notes with long decay, a breathy flute
phrase every 16 bars, water drops; no percussion until the boss. Life G4: 먹돌, 매화 꽃잎, 은빛 붕어 (fishing), 묵은 솔방울.

---------------------------------------------------------------------------------------------------------------

## 7. Art list (table C style)

| for | what | notes |
| --- | --- | --- |
| ridge | windmill (big prop, sails turn on the two water frames), stone viaduct (walk-under arches), red-tile cottage skin for `$`, terraced field strips, cliff-top shrine, grey sheer cliff skin | reuses coast sand / shallows / surf |
| harbor | cobble `k` and quay `=` skins, red-tile + thatch roofs for the metro blocks, monument, piers `b` with posts, boat `Γ` (3 sizes, bobbing on the water frames), hull on the slip, net racks, crates/barrels, lighthouse (light at night), lit vs broken lamps | town-side signs/NPC props per `town.md` |
| delta | lily ford `ο` (pads, a flower here and there), bowed plank bridge with rails, domed hut and clock dome, garden beds, river water with a slow current line, reeds in clumps, mangrove roots, fireflies | water = the meadow's river in a greener tone |
| cloudtemple | **cloud sea** skin for `w` in the `mist` theme (two frames drifting; soft edge up the cliff foot), grey crag `C` at 5 heights, pagoda `Π` (1/3-tier), stone bridge with railings, autumn trees (maple's), lanterns, bell tower, drifting mist motes | waterfalls reuse A.2's sheet |
| mesa | red sandstone `C` (banded, 4 heights), red sand `z`, hoodoo `Θ`, pine `Σ` on ledges, gold-roof hall `Π`, rope bridge, mist at fall feet, temple-town house stack | `sandstone()` in a red tone |
| inklake | paper-grey shallows `~` (faint ripples, mirror streaks), ink pool `w` (near black), grey islet rock `Θ`, twisted pine `Σ` (3 leans), lone pagoda, red blossom tree + floating petals, moon gate, a pale pink sun in `sky.js` for this theme, standing mist | palette: 4 greys + one red |
| all | minimap/overview colours (`MINI*`, `_over.html`), `OUTDOOR`, skirt colours, editor names (`editor-lib.mjs`) | as M3 |
| monsters | 17 new bodies in `mobart_d.js` (eyegull, millmule, vaneram, netcat, barnacleseal, wreckhermit, handnewt, bloatheron, lotusturtle, beadmonkey, wingcrane, mistiger, spinescorp, ribvulture, crownpeacock, plumspider, inkserpent); 22 tinted kin of existing bodies and 2 tints of the new gull/crane need no art | each new kind ships on its fallback first |
| sound | six BGM tracks (`bgm.js TRACKS`, the map-BGM skill), ambience: gulls/wind, harbour bells, frogs/water, temple bell, canyon wind, drops | |

## 8. Build order (batches of two, each: rules/terrain step → client art step → species step, as M3)

1. **mesa + cloudtemple** — both fill roadmap slots (#4, #7) in the long Lv.117–168 stretch where a new ground is
   worth most; lowest generator risk (`tiers` 4–5, falls, gorge crossings exist); they share the eastern kit
   (`Π` halls, `Σ` pines, cliffs at 4–5 heights, stone bridges). Needs: gates on cave (shaft) and oasis (east).
2. **delta + inklake** — both are "islets in water": the `isles` bridge pass (also used by the mesa's pillar tops, so
   batch 1 builds the first half of it), lily fords, boats; inklake reuses batch 1's pagoda/pine/rock. Needs: gates
   on forest (south), jungle (east), maple (south); mesa north door goes live.
3. **ridge + harbor** — the coast pair (sea, red roofs, the shared gull); last because Lv.33–80 passes in ~2 hours
   and the harbour needs town work (`town.md` services, a small `npc-life` cast, a waypoint/recall point, safe-zone
   rules for a town inside a hunting map). Needs: gate on meadow (south); delta south door goes live.

Dependencies: (a) `wilds` — `tiers` up to 5, the `isles`/`pillars` bridge pass, sea on more than one side; `metro` —
`radial`, piers, quay; (b) per map the usual list (`GEN`, `GATE_LINKS`, `FIELD_BOSS`, `chest_<id>`, `DENSITY`,
`REGION_BONUS`, `WX_ODDS`, `SIZE` in tests/maps, mapflow strict, world doors, lifeskills grades); (c) the rare-spawn
rule (optional, one small step for all six); (d) a second arena boss (`mistiger`) follows the cave boss's pattern;
(e) `level-bands.md` roadmap table rows #4/#5/#7 renamed and three new rows added when a batch lands; (f) the
balancing pass (level-bands §3) stays after all maps — these tables give tiers only.

## 9. Open questions for the owner (5)

1. **Mesa in the volcano's slot** (36–42, oasis ↔ maple side): drop 잿불 화산, or keep it for a later batch at another
   band? Same question, smaller: 수련 삼각주 replaces 안개 늪 and 운해 사원 replaces 하늘 유적 — fine?
2. **Harbour ferry**: should 물결 항구 have a boat door to 산호 해안 (a far jump, tier 20 → 34, with the usual warning)
   and/or to the town, making it a travel hub?
3. **Harbour as one map or two** (safe `harbor` town authored in the editor + generated `docks` ward)? One map keeps
   the reference's single view; two is simpler for town services and NPC routines.
4. **운해 사원**: field + summit boss (proposed) or a pure 4-player party dungeon (instanced, no weather)?
5. **Three of the six sit under Lv.92**, where a band passes in under two hours. Keep them low (they match the
   references' gentle mood) or lift ridge/harbor to a mid band (e.g. 22–28 / 26–31) when the balancing pass runs?
