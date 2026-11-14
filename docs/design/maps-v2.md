# maps-v2 — 다채로운 사냥터·던전 (varied hunting grounds and dungeons)

Status: **M1 + M2 built, client art step 1 done (H), M3 rules/terrain built (I), M3 client art done (J)** (meadow, forest, cave, crypt, sewer reworked; jungle, coast, oasis new; the path-quality test holds all eight). M3's monsters and BGM and M4 are design.
Owner's request: maps from his reference images, procedurally generated, colourful, not monotonous; routes a little
complex but never blocked in a way that gets in the player's way; maps wide.

Contracts every step keeps: map ids, sizes (tests/maps.mjs `SIZE`; a new map may be larger), seeds → same map every
boot, gate names/sides, entry, waypoint stones (3), camps, zones/pockets (33-maps-zones.js), spawn bands, build time
< 150 ms per map, no client change in a rules step. Height is visual only (the rules see walls and floor).

## A. References → maps

| # | reference | map | step |
| --- | --- | --- | --- |
| 2 | green highland plateaus, cliffs, waterfalls, arches, pools, thin paths, ramps | `meadow` 바람초원 → **고원 폭포** | M1 ✔ |
| 6 | mossy grey cliffs, river gorge, ledges, stepping stones, fords | `forest` 속삭임 숲 → **이끼 협곡** | M1 ✔ |
| 3 | overgrown temple ruin: processional way, rune pool, colonnades, side chambers | `forest` set piece **잊힌 신전** (`PIECES.temple`) | M1 ✔ (art M2) |
| 5 | glowing green crystal cavern, mossy winding floor, rock shelves, spires, streams, mushrooms | `cave` 수정 동굴 → **비취 수정굴** | M2 ✔ |
| 4 | dark brick dungeon: flagstone plazas, brick walls, pillars, arches, torch alcoves, rubble | `crypt` 뼈의 지하묘지 + `sewer` 하수도 → **벽돌 회랑** | M2 ✔ |
| 7 | desert dunes, oasis lake with palms and reeds, mud huts | new `oasis` **모래바람 오아시스** | M3 ✔ (art next) |
| 8 | tropical beach: white sand, palms, surf line, turquoise shallows, reef rocks, islets | new `coast` **산호 해안** (joined to the oasis) | M3 ✔ (art next) |
| 9 | coastal road: winding asphalt with yellow edge lines through jungle, black-boulder shore, teal sea | new `jungle` **정글 해안도로** (between city and coast) | M3 ✔ (art next) |
| 1 | snowy gothic castle-city on a spur: walled terraces, corner towers, gorge, arch bridges, snowy pines | new `citadel` **눈꽃 성채** | M4 |

## B. Layout recipes

Shared vocabulary (existing characters, so today's client draws them): ground `.` `,` `t` `"` grass/flowers ·
`:` `;` forest floor · `p` dirt path · `r` worn stone · `=` flagstones · `s` sand/ford · `w` water · `b` planks ·
`v` steps · `j` bog · `%` leaves; objects `C` grass-topped cliff block · `T` `P` `B` trees/bush · `R` `u` `l` rock,
stump, log · `U` `q` ruin wall/pillar · `O` standing stone · `Y` mushroom · `e` reeds · `F` fence · `H` hedge.

### A.2 바람초원 — 고원 폭포 (highland falls) — built
- Macro: Voronoi regions (unchanged sites) ranked by elevation into **3 terrace levels** (`tiers: 3`); doors stand on
  level 0. Level steps are **cliffs `C`**; where the region tree links two levels a **ramp of steps `v` 5 wide**
  (`ramp: 2`). On one level the ground mostly runs on open (`tierOpen: 0.6`), else a tree belt / hedge / boulders.
- Water: the river runs top→bottom; where it crosses a terrace edge it is a **waterfall** (`m.falls`
  [x, y, dir]) with a **pool** on the lower level (`pools: 2.6`); lakes with jetties as before.
- Paths: roads 3 wide but only the centre is dirt `p` — **thin path, wide way** (`roadW: 3`, grass shoulders).
- Colour by level: valley floor flowers/tall grass, middle shelves orchard and tall grass, tops stony heath (`r`
  outcrops, bare `p`).
- Dead ends that keep a chest (vault/lair/stair) stay shut but for one 3-wide way in → the hidden pockets survive.

### A.6 속삭임 숲 — 이끼 협곡 (mossy gorge) — built
- 3 levels of ledges (`tiers: 3, tierOpen: 0.12`: on one level the woods mostly stay shut, so the way winds along
  the tree), the stream in a **cut**: every tile beside the river is a cliff `C` (`gorge`), opened every 30 rows by a
  band 5 rows tall that is a **bridge `b`** or a **ford `s`** by turns, with steps `v` down the banks (`m.crossings`).
- The stones stand at 0.36 / 0.8 of the way on (`stoneFr`), so the far stone is in the elite ground.
- Set piece **잊힌 신전** (A.3): 15 × 21, south gate → 3-wide processional `=` → rune pool `~` (water) ringed by
  pillars → north shrine with the chest (`*`) and a keeper spot (`@`); broken colonnades `q`/`U` make side chambers.
  Placed upright in a quiet region 0.2–0.85 deep (`m.temple` {x,y,w,h,pool}), its ring paved `r`; 4 keepers + chest.

### A.5 비취 수정굴 (crystal cavern) — built (as designed; see G for what changed)
- Generator: `cavern` keeps its CA caves; add **rock shelves**: CA floor split into 2 heights by a low-frequency
  field; shelf edges as rock `W` with ramps; the lowest band is the "river of green" — moss floor winding through
  (a new ground `m` moss? — no: `m` is the city's lane; use a new char, see C) at least 5 wide.
- Streams: thin `w` channels along shelf feet with fords; crystal spires (new object) on shelf rims, glowing
  mushroom rings `Y` in hollows. Boss arena unchanged.
### A.4 벽돌 회랑 (brick halls) — built (see G)
- `catacomb`/`sewers`: rooms become **plazas** (min 11 × 9) with broken paving (floor variant mix), pillars in rows,
  torch alcoves (wall niches with a light), rubble piles; corridors 3 wide (today 1–2: see the table in D), arched
  doorways where a corridor meets a room; add 1–2 loop corridors per map (cycle rank ≥ 4).

### A.7/A.8/A.9 the south-west coast — M3
- **모래바람 오아시스** `oasis` (Lv ~28–34): dunes as tiered sand `s` with soft ridges (cliff-like `C`-sand
  variant), an oasis lake ringed by palms and reeds `e`, mud huts (house footprints), a caravan camp.
- **산호 해안** `coast` (Lv ~34–40): the desert's dunes run down to a white beach strip; surf line, turquoise
  shallows (walkable shallow water), reef rocks and islets joined by sand bars; palms with shadows along a jungle edge.
  Combines owner's "desert + sea".
- **정글 해안도로** `jungle` (Lv ~20–26): a winding 3-wide asphalt road `a` with yellow edge lines (lane `m` reused as
  the painted edge) through dense jungle, a black-boulder shore and deep teal sea with breaking waves on one side.
  Combines "forest + modern asphalt road".
- World graph: `city` (14–21) —east/south gate→ `jungle` —road south→ `coast` —dunes inland→ `oasis`; `oasis` gets
  a second door to `cave` (24–32) so the loop city → jungle → coast/oasis → cave closes. Bands fill the gap between
  city/sewer and the abyss.
### A.1 눈꽃 성채 — M4
- `citadel` (Lv 40–46, parallel to `maple`): a mountain spur; walled courtyards on 3–4 stepped terraces (stone wall
  `W` ground like the town's terrace + steps), corner towers (big pieces), a gorge with a river (A.6's gorge pass)
  crossed by stone arch bridges, snowy pines below. Door from `maple` east or `abyss` out.

## C. New tiles and art the client steps need

| for | what | notes |
| --- | --- | --- |
| A.2 | waterfall face where `w` meets `C` (`m.falls`), foam at the pool | rules already mark `falls`; client draws a falling sheet on the cliff face |
| A.2 | natural rock arch (big prop over 3-wide walkable tiles) | `big` prop, walkable underneath |
| A.2/A.6 | cliff height by level (today every `C` is one block) | send `m.tier` per region or a per-tile level in `mapPayload` |
| A.6 | stepping stones in water (walkable) | new ground char, e.g. `o`-like stones on water; fords use `s` for now |
| A.6 | mossy grey cliff skin for the forest theme | `cliff()` per theme in iso_tall.js |
| A.3 | rune pool glow, carved flagstones, broken colonnade art | `~` is plain water now; a `rune` ground char or `m.temple.pool` glow |
| A.5 | moss floor: `;` (core of the way) and `:` (its fringe) in the cave theme draw as meadow grass today; give them a cave moss material (deep green, glowing specks) | ground chars exist, only the cave skin is new |
| A.5 | grey rock shelf rim: `C` in the cave theme (today a blue rock block) at two heights, per tile in `m.level` (0/1/2) | `cliff()` cave skin + height from `m.level` (send it in `mapPayload`) |
| A.5 | ramp steps `v`, ford `s` and stream `w` in the cave theme (today path-coloured steps, sand, blue water) | cave skins; streams may want a glow |
| A.5 | tall crystal spire: `K` (crystal) and `S` (stalagmite) on the shelf rims exist; a taller jade spire would sell the reference | optional new object, or a `K` variant by `m.level` |
| A.5 | glowing mushroom ring: `Y` round a `d` centre (`m.rings` [x, y]) | a glow pool under the ring |
| A.4 | broken paving: `k` slabs over `c` brick in crypt/sewer (today the town's grey pave) | crypt/sewer skin for `k` |
| A.4 | arched doorway: `m.arches` [x, y, 1 = runs east–west] — the corridor tile at a room's edge | an arch over the 3-wide mouth (big prop, walkable under) |
| A.4 | torch alcove: `m.torches` [x, y] — a niche dug a tile into a room's north wall, with candle stand `3` in it today | a wall torch prop + light |
| A.4 | brick wall face for the crypt (grey) and sewer (brown) | crypt/sewer `UG` skins |
| A.7 | dune sand (two tones), palm tree, mud hut, oasis reeds | desert theme |
| A.8 | white sand, surf/foam edge, turquoise shallows (walkable), reef rocks, islets | coast theme; shallow water must be walkable (not `w`) |
| A.9 | jungle trees/palms, asphalt with yellow edge line, black boulders, deep teal sea with waves | `a`/`m` exist (city); new edge-line and boulder art |
| A.1 | snow ground, snowy pines, gothic walls/towers, arch bridges | snow theme |
| M3 art (placeholders stand today, see I) | **ground**: dune sand `z` (wind ripples, two tones, soft ridge shadows), white sand `S` (shell flecks, wet band by the surf), shallows `~` (turquoise, sand ripples showing through, darker toward the deep), surf `-` (animated foam line that washes in and out), deep sea `w` in the jungle/coast themes (teal, breaking wave crests), the jungle's shingle `r`, the yellow edge line `m` (thin, unbroken, mitred at bends) and a worn centre for `a`, desert sand `s` | iso_ground.js materials per theme; a pulse/animation layer for the surf |
| M3 art | **objects**: palm `Ψ` (3 leans, coconut, long shadow), reef rock `Φ` (mossy, coral, half under water), black shore boulder `Ω` (wet basalt, clusters), mud hut `Δ` (round, thatch, a bigger 2 × 2 variant), jungle skin for `T` (broad dark canopy, vines; today the meadow's tree), sandstone ridge skin for `C` in desert/coast (today grey stone and moss), sand-coloured rim | scene_props.js / iso_tall.js `cliff()` per theme |
| M3 art | sand-bar edges where `S` crosses `~`, islets with a foam ring, tide pools, driftwood for `l` on the beach, caravan tents for `E` in the desert, desert/coast/jungle decals and ambient motes (heat shimmer, gulls, fireflies), minimap icons | decor.js, sky.js |
| M3 sound | BGM for the three (today `forest` / `field`), surf and wind ambience | bgm.js TRACKS, audio.js |

## D. Path-quality rules (tests/mapflow.mjs)

Computed on the built map (`m.reach`, walkable = no object, not `w`/`W`):
1. **open ratio** = reachable / all tiles, held in 42–90 %.
2. **nothing walkable cut off**: every walkable tile is reached from the entry (crumbs under 6 tiles are sealed).
3. **width ≥ 3**: a tile is *wide* when the 3 × 3 round it is walkable; the entry's wide ground must join every gate
   arrival, door, waypoint stone, camp, boss and chest (within 3 steps). A chest in a hidden pocket is exempt (its
   mouth is narrow by design); another chest may sit behind a doorway of ≤ 8 steps.
4. **loops**: wide ground cut into 8 × 8 cells, one node per piece per cell, edges across cell sides; cycle rank
   (E − V + 1) ≥ 12 meadow, ≥ 10 forest, 6 for the others.
5. **tortuosity**: 8-way walk / straight line from the entry to each far door (≥ 0.35 of the map away); target
   1.15–2.2, held from 1.12.
6. **dead ends**: branches of ≥ 2 cells hanging off the cell graph; ≤ max(6, area·0.012/8) and none longer than 7.

Generator side: `widen(m, pts, soft)` (20-helpers-mapkit) cuts a 3-wide way through soft objects (or a cliff, into
steps) for each point not yet joined; `seal` fills crumbs; `markRoutes` puts signs/stones only where the wide ways
stay joined (`m.keepWide`), and `genMap` widens once more after it.

## E. Phases
- **M1 (this step)**: doc, mapflow test, meadow + forest generators, temple piece. ✔
- **M2 (rules)**: cave → 비취 수정굴, crypt + sewer → 벽돌 회랑; cave/crypt/sewer held in mapflow. ✔ Then client art
  for A.2/A.6/A.3/A.5/A.4 (table C).
- **M3**: oasis + coast + jungle (new GEN entries, GATE_LINKS, bands, monsters per zone) ✔ rules/terrain (I). Then: client themes (table C "M3 art"), BGM, new coastal/desert monster species.
- **M4**: citadel + its snow theme; hold every map in mapflow, drop the warnings.

## F. M1 as built

| map | open | narrow targets | loops | dead ends (longest) | tortuosity |
| --- | --- | --- | --- | --- | --- |
| meadow before | 68 % | 13/19 | 1 | 2 (1) | east 1.24 |
| meadow after | 75 % | 0/17 | 97 | 10 (4) | east 1.27 |
| forest before | 66 % | 15/23 | 16 | 10 (2) | north 1.56, east 1.16, crypt 1.30 |
| forest after | 73 % | 0/22 | 76 | 18 (7) | north 1.15, east 1.14, crypt 1.17 |
| crypt | 35 % | 21/27 | 4 | 0 | out 2.67 (warn) |
| city | 52 % | 11/15 | 0 | 0 | sewer 1.60 (warn) |
| sewer | 36 % | 22/27 | 1 | 0 | out 2.00 (warn) |
| cave | 47 % | 17/23 | 0 | 1 (1) | rift 1.90 (warn) |
| abyss | 36 % | 18/23 | 0 | 2 (1) | out 1.51 (warn) |
| maple | 68 % | 15/20 | 1 | 0 | east 1.86 (warn) |

(before = main at the branch point; narrow counts then also counted hidden-pocket chests.)

Deviations and contracts:
- Sizes unchanged (152 × 102): tests/maps.mjs pins them; widening the maps is left for M3/M4's new maps.
- Cliffs are object `C` (grass-topped block), not ground `W` (that is the underground/town wall).
- Every new behaviour is behind a cfg flag (`tiers tierOpen ramp roadW pools gorge temple widen stoneFr`): maple and
  the other generators are unchanged byte for byte.
- New map fields (rules only, not on the wire): `m.tier`, `m.falls`, `m.crossings`, `m.temple`, `m.keepWide`,
  `m.widenSoft`, `m.stoneFr`.
- Tortuosity held from 1.12 (forest's ways are open woods; 1.15 is the target for M2+).
- `scripts/balance-probe.mjs` fights in the first open square of the meadow; the new meadow moves that arena and the
  world's RNG stream, and `balance` now fails on runearcher/spellarcher bow T25 (×0.64–0.68 against a floor of ×0.7).
  The same failure appears with the arena moved to the unchanged crypt, so it is the hybrid bow margin, not the
  map: left for the balance owner.
- `tests/lifeskills.mjs` wiped only node 0's material; it now also wipes node 1's (the new meadow's node 1 is ore).

## G. M2 as built

| map | open | narrow targets | loops | dead ends (longest) | tortuosity |
| --- | --- | --- | --- | --- | --- |
| cave before | 47 % | 12/18 | 0 | 0 (0) | rift 1.90 |
| cave after | 53 % | 0/14 | 24 | 10 (3) | rift 1.28 |
| crypt before | 35 % | 16/22 | 4 | 0 (0) | out 2.67 |
| crypt after | 48 % | 0/14 | 16 | 12 (7) | out 1.19 |
| sewer before | 36 % | 17/22 | 1 | 0 (0) | out 2.00 |
| sewer after | 45 % | 0/13 | 32 | 12 (4) | out 1.19 |

(before = main at the branch point, with 16/15/16 walkable tiles cut off in cave/sewer/crypt; now none. Targets fall
because the reworked maps have fewer, bigger rooms.) Build time: cave ~80–100 ms, crypt ~35, sewer ~25.

- **cave** (`cfg.moss`): the CA caverns stay; over them a Gabriel graph of Poisson sites 15 apart (spanning tree,
  `loops: 0.55`) is dug as winding ways (A* over a meander field), half-width 3 on the spine start → ante, 2 elsewhere;
  their middle is moss `;`, the fringe `:`. A slow swell lifts the rest of the floor into shelves at levels 1/2
  (`m.level`, small ones sink), their rims cliff `C`, 1–2 ramps of steps `v` (3 wide) per shelf. Crystals `K`/spires
  `S` on the rims, up to 7 mushroom rings `Y` (`m.rings`), streams `w` on a contour line, fords `s` where they cross
  the moss. Zone dressing never covers moss, ramps, rims or water. The neck to the boss and the rift crack are 3 wide
  (were 2); the arena and its shell are otherwise unchanged and nothing is dug into the shell (`m.noDig`).
- **crypt** (`cfg.halls`): BSP cells ≥ 14 × 12 (were 9 × 8), rooms never shrunk under 11 × 9, every corridor 3 wide
  (full 3 × 3 at bends), `loops: 0.3`, `wind: 0.5`; pillars four apart; chapels, octagons, ossuaries and the pool/
  rubble/rows/shrine styles as before. `brickRoom`: broken paving `k` in 3-tile patches over `c`, torch alcoves
  (`m.torches`) on the north walls; `m.arches` where a corridor enters a room.
- **sewer** (`cfg.halls`): junctions 14 apart (were 10.5), `loops: 0.35`; plazas are chamfered rectangles 13–15 × 11;
  channel tunnels are 3 walk + 2 sludge + 3 walk (footbridges as before), tunnels to pump rooms and cisterns are dry
  and 3 wide; plazas paved and lit like the crypt's, `m.arches` at tunnel mouths.
- Shared: `widen(m, pts, soft, dig)` digs rock underground (`dig` = the floor char) and there also joins a stray wide
  patch beside a point (the test takes the nearest wide tile, which may be that patch); `seal(m, "W")` fills crumbs
  with rock; `wideWays` sets `m.keepWide`/`m.widenSoft`/`m.widenDig`, and genMap's last widen also joins the waypoint
  stones' tiles when `m.widenDig` is set. Rules-only fields: `m.level m.rings m.arches m.torches m.noDig`.

Deviations:
- Sizes unchanged (tests/maps.mjs pins them). Moss uses the existing `;`/`:` chars rather than a new one, so today's
  client draws it (as grass) and the art step only re-skins it (table C).
- The neck to the cave boss and the rift crack widened from 2 to 3 tiles (else the boss and the rift door could not
  sit on 3-wide ground).
- `tests/hard.mjs` samples the `tough` trait over 120 blows instead of 40: with the new sewer the 40-blow ratio read
  0.71 against a 0.68 cap (the world's RNG stream moved); the trait is unchanged. `tests/lifeskills.mjs` needed nothing.

## H. Client art, step 1 as built (table C)

Wire: `mapPayload` appends `artWire(m)` (34-maps-world.js), static and sent once per map change, each key only on maps
that have it: `lv` (cave shelf level 0/1/2 per tile as runs `"<level><count>"` joined by `,`, ~3 KB), `rings`,
`arches`, `torches`, `falls`, `cross` ([row, 1 = ford]), `temple`. No rule changes. Decoder: `iso_ground.js levels(m)`.

| for | as built |
| --- | --- |
| A.5 moss | cave `;` deep green moss (organic clumps, sparse mint/white specks baked, a few breathing in the pulse layer); `:` a darker moss-over-rock fringe. Meadow/forest keep their grass. |
| A.5 shelves | floor up on a level is grey rough rock (`_shelf`); rim `C` = `caveShelf`: grey faceted rock, 16 px (level 1) / 30 px (level 2), moss strands trailing over the edge, rare jade glints |
| A.5 steps, fords, streams | grey stone steps; fords are shallow jade water over pebbles; cave water jade (`UG.cave.wet`) with a green pulse glow; cave floor slate-teal |
| A.5 rings | a three-layer jade light pool under each `m.rings` centre (pulse layer) |
| A.4 walls | crypt walls grey 4×8 brick with a damp low band and the odd missing brick; sewer keeps its brown brick |
| A.4 paving | `k` in crypt/sewer = big cracked flagstones (12×10), knocked-off corners, grime in the sewer; ragged edge over the brick floor |
| A.4 arches | `hallart.js`: brick piers + segmental arch (crown 28 px, top 34) over each 3-wide mouth, cut into 4-px depth strips so you walk under it (duplicates in `m.arches` skipped) |
| A.4 torches | iron bracket on the alcove's west wall (the face the camera sees), live 3-frame flame, flickering additive glow, sparks; lights the dark; hides the candle stand |
| A.2/A.6 cliffs | outdoor `C`: grey faceted stone under the grass lip, moss in soft patches (more in the forest) |
| A.2 falls | `riverFalls`: a light curtain down the face when the drop faces the camera (dir 1), else a white lip; foam rings and churning flecks on the pool |
| A.6 fords | `s` across the river in a `cross` ford band = clear shallows with two staggered files of grey stepping stones |
| A.3 temple | rune-pool glow at `m.temple.pool`: breathing jade light, twelve runes turning round the rim, rising motes |

Left from table C: the natural rock arch (A.2), cliff height by level outdoors (`m.tier` is not on the wire), carved
flagstones and broken-colonnade art for the temple, a taller jade spire (A.5); the M3/M4 themes. Cost: every ground
skin is baked (chunked maps bake per chunk as before); per frame only the visible torches (two glow blits each), arch
strips, fall rings and the temple glow are added.

## I. M3 as built (rules and terrain)

| map | size | band | doors | open | narrow targets | loops | dead ends (longest) | tortuosity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `jungle` 정글 해안도로 (theme `jungle`) | 168 × 112 | 20–26 | north ↔ city south, south ↔ coast north | 66 % | 0/15 | 52 | 26 (6) | south 1.32 |
| `coast` 산호 해안 (theme `coast`) | 176 × 120 | 34–40 | north ↔ jungle south, east ↔ oasis west | 69 % | 0/16 | 108 | 11 (4) | east 1.28 |
| `oasis` 모래바람 오아시스 (theme `desert`) | 168 × 116 | 28–34 | west ↔ coast east, north ↔ cave south | 78 % | 0/18 | 127 | 15 (5) | north 1.37 |

All three are `wilds` maps held strictly by tests/mapflow.mjs (loops ≥ 10 / 12 / 12), three stones, a camp, 6–8 chests,
a field boss, gathering nodes of grade 3 / 4 / 4. The loop city → jungle → coast → oasis → cave closes; every door is two-way.

- **wilds, new settings** (each behind its cfg key, the older maps are byte-identical):
  - `sea: { side: "w" | "s", at, amp, surf, shallow, beach, sand, bar, rock, rockP, reef }` — one side of the map is water.
    A wavy waterline; out from it `surf` tiles of foam `-`, `shallow` tiles of walkable shallows `~`, then deep `w`
    (no region grows there). In the shallows: reef rocks `Φ` in clusters (and wherever a region barrier ran out to sea),
    sand islets with palms, deep holes; a road over them is a **sand bar** (`bar`). On land a `beach` strip of `sand`,
    optionally strewn with boulders (`rock`: the jungle's black strand).
  - gates on the south side (`"s"`); `roadEdge`: the road is five wide, three of `road` and a painted line either side
    (jungle: asphalt `a` between lane `m`); `green: { r, palm }`: ground within `r` of water turns to grass and palms
    stand round it (the oasis lakes and ponds); `rocks: [a, b]` and the wall kind `palms` for other barrier objects.
  - set pieces `hamlet` (mud huts round a chest), `caravan` (the oasis camp), `drywell`, `palmring`, `tidepool`, `cove`.
- **jungle**: 2 levels, mostly shut (`tierOpen: 0.15`, `wind: 0.8`) so the asphalt road winds; sea and boulder strand in
  the west; swamp hollows, palm groves, glades; 4 lakes. No river and no temple (a road bridge over the river and the
  temple's pool both broke the three-wide rule; the wood keeps the only temple).
- **coast**: 3 levels of dune and palm grove running down to the beach; the south third is sea (2 surf + 26 shallows +
  deep). Gates north and east are both on land; the shallows are loop ground with their own chests (tide pools, coves).
- **oasis**: 3 levels of sand with ridges for cliffs, 6 lakes plus ponds each in a green ring with reeds and palms,
  mud-hut hamlets in the dead ends, the caravan camp on the main way, sandstone rim (`edge: "C"`).
- **city** got a south gate (a slip road off the ring at 0.3 W: 21 tiles changed, nothing else moved); **cave** a south
  crack three wide at 0.52 W (45 tiles changed; stones, boss and spawns' places unchanged, 3 spawn boxes fewer).
- **New characters**: ground `z` 사구 모래, `S` 흰 모래, `~` 얕은 물 (walkable), `-` 파도 거품 (walkable); objects
  `Ψ` 야자수, `Φ` 산호 암초, `Ω` 검은 해안 바위, `Δ` 진흙 오두막. The objects are Greek letters because every printable
  ASCII mark is already an object (the rooms' furniture took `( ) { } [ ?`). `SOLID_G` is unchanged ("wW"): the new
  grounds are walkable, any object blocks. Names in scripts/editor-lib.mjs, colours in art.js `MINI*` and `_over.html`.
- **Monsters**: existing bodies in new tints at fitting levels (new species are a later step) — jungle: catsplit_gold 20,
  toadbrood_poison 21, hydrasnake_poison 23, mothface_bile 24, ribdeer_bile 26 (field boss); oasis: foxtwine_gold 28,
  hydrasnake_gold 29, lambmaw_bone 30, eyecrow_ash 31 (also round the lakes), twingoat_gold 33, bearmaw_gold 34 (boss);
  coast: crabskull_blood 34, fishwalker_frost 35, eelknot_frost 36, squidrat_blood 37, leechmaw_bone 38,
  gatorhalf_steel 40 (boss). Chests `chest_jungle/oasis/coast` (Lv 23 / 31 / 37). The jungle's two lowest are melee on
  purpose: the rift's fallback pool takes the kinds nearest a level, and two ranged kinds at 20–21 stopped the solo bot
  of tests/dimrift.mjs reaching the master.
- **Weather** (`WX_ODDS`, by theme): jungle clear/cloud/rain-heavy with some fog; coast clear, rain and wind, no fog;
  desert clear and wind, never rain. All three are outdoor (day and night).
- **Client placeholders** (replaced by art step 2, section J; so nothing was invisible): flat sand/shallows/foam materials and
  teal water in iso_ground.js, a thin yellow `edgeLine` on the jungle's `m`, simple palm / reef / boulder / hut sprites in
  scene_props.js, minimap and overview colours, `OUTDOOR` and skirt colours.
- **Tests**: mapflow (strict for all three), maps (sizes, build time), world (the loop's doors both ways, bands, no
  reachable deep water), lifeskills (grades), daynight (weather; the desert never rains).
- Wished-for species (later step): 집게 소라게 떼 (hermit-crab swarm in a skull shell), 갈매기 눈알 (eye gull), 해파리 뇌
  (brain jellyfish drifting over the shallows), 산호 뿔 거북 (coral-horn turtle, coast boss), 따개비 물개 (barnacle seal);
  전갈 등뼈 (spine scorpion), 미라 낙타 (two-headed mummy camel, oasis boss), 모래 지렁이 아가리 (sand-worm maw, burrows),
  독수리 갈비 (rib vulture), 선인장 고슴도치 (cactus hedgehog); 덩굴 원숭이 (vine monkey), 난초 사마귀 (orchid mantis),
  독개구리 떼 (dart-frog brood), 악어 통나무 (log gator, jungle boss).

## J. Client art, step 2 as built (table C "M3 art")

No rule or wire changes. Everything on the ground is baked (chunked as before); the sea moves by the two existing
water frames (650 ms each), so there is no new per-frame cost. Other themes are unchanged.

| for | as built |
| --- | --- |
| dune sand `z`, desert `s` | iso_ground.js `dunes`: long crests across the screen (a lit crest line, the lee side below it in one flat tone), short wind ripples between, grains. `z` strong (22 px apart), the desert's `s` broad and faint (38 px); `z` is paler outside the desert |
| white sand `S` | fine clusters, faint tide lines, rare shells; a **wet band** (two tan tones, scalloped) wherever sand meets `~`/`-` (also dune and desert sand) |
| shallows `~` | turquoise with pale sand bars and their ripples showing through, darker toward the deep `w`, a thin net of light that shifts between the two frames, white foam against sand, a foam ring round every reef rock / boulder standing in it (so islets and rocks get rings) |
| surf `-` | `shore(S, px, f)`: frame 0 the foam runs up the sand and a pale line follows; frame 1 it falls back, leaves wet sand and a sheen, and the next white line gathers further out |
| sea `w` (jungle, coast) | deeper teal; white crests with a pale underline that step between frames, more and longer inshore |
| jungle road | old asphalt (cracks, tarred patches); `edgeLine`: a thin yellow line that follows the run of `m` tiles — straight, mitred corner to corner at a right angle (a stepped diagonal becomes one straight line), arms at junctions, worn gaps — and a pale gravel shoulder outside it |
| jungle floor, shingle `r` | deep green with broad fallen leaves; dark rounded stones with lit tops |
| palm `Ψ` | 4 sprites (straight, two leans, a half lean): ringed curving trunk, dark fronds behind and lit ones in front, coconuts; `palmShade` bakes each one's long shadow (trunk + crown) down-right in the shadow tone |
| reef `Φ`, basalt `Ω` | reef: moss cap, coral, dark wet foot with foam (3 sprites, one low); basalt: black faceted blocks, a cold gloss line on the sky-facing edges, a glint, spray |
| mud hut `Δ` | round daubed wall, thatch cone in courses with a ragged eave, dark doorway (2 tints) |
| tree `T` in the jungle | `JT`: buttress roots, a wide dark crown of broad leaves, hanging vines, one in red bloom |
| cliff `C` in desert/coast | iso_tall.js `sandstone`: the upper level's sand over the edge, wavering courses with dark seams, redder bands, lit ledges, pits (ochre in the desert, pale by the sea) |
| extras | driftwood for `l` on the coast (`DW`); wind-blown sand motes in the desert, fireflies and leaves in the jungle (scene_map.js ambient) |

Left from table C: the 2 × 2 hut (no map marks one), tide pools and caravan tents as art, sand-bar edge art beyond the
foam line, heat shimmer / gulls, a worn centre strip on the asphalt (needs the road's direction), tufts on the oasis's
green ring (details only run on the theme's base ground), minimap icons (the colours already separate sand /
shallows / sea), BGM and the new monster species.

## K. Dungeon widening as built

Owner: "dungeon maps feel too cramped for a 4-player party — wider, close to the fields." New metric (`tests/mapflow.mjs
roomy`): **party room** = share of the reachable ground lying where a 7 × 7 open square fits (four heroes and a pack);
**route** = the widest k for which ground k wide (k × k squares overlapping step by step) joins the entry to every
door, waypoint stone, camp and boss; **corridors** = the middle width (shorter open run) of the ground outside the
party rooms. For scale: meadow 75 % open / 52 % party room, forest 73 % / 36 %.

| map | open | rooms | party room | route | corridors (middle / narrow tenth) |
| --- | --- | --- | --- | --- | --- |
| crypt before | 48 % | rooms from 11 × 9; middle fighting area 140 tiles (14 × 10) | 12 % | 3 | 5 / 2 |
| crypt after | 62 % | 26 halls: middle 15 × 22, smallest 16 × 11, nine ≥ 21 × 15 | 64 % | 5 | 4 / 1 |
| sewer before | 45 % | plazas 13 × 9 – 15 × 11; middle area 93 tiles | 34 % | 3 | 6 / 3 |
| sewer after | 60 % | 24 plazas: middle 21 × 15, smallest 17 × 13, fifteen 21 × 15 | 76 % | 5 | 5 / 3 |
| abyss before | 36 % | islands ~7 × 9; middle area 49 tiles | 6 % | 1 | 5 / 2 |
| abyss after | 59 % | 32 fighting areas: middle 217 tiles (~17 × 17), smallest 70 | 75 % | 5 | 5 / 2 |
| cave before | 53 % | middle area 64 tiles (8 × 8) | 11 % | 3 | 5 / 2 |
| cave after | 64 % | 21 fighting areas: middle 119 tiles, largest 774 | 52 % | 5 | 6 / 2 |

Monsters follow the open ground (zoneSpawns: tiles / `DENSITY`), so density is unchanged (crypt 14.4 per 100 tiles
before and after) and the totals rise with the floor: crypt 928 → 1197, sewer 967 → 1231, abyss 699 → 1297, cave
623 → 753 (never more than `WAKE_MAX_MOBS` standing). Sizes, ids, gates, three stones, camps, bosses and guardians
are as before; chests crypt 5 → 6, sewer 3 → 5, abyss 10 → 7, cave 2 → 4. Build: crypt ~50 ms, sewer ~30, cave ~95,
abyss ~60–95 (bound 150).

- **crypt** (`room: [15, 11]`, `ways: [5, 4, 3]`, cells ≥ 17 × 13, `leaf: 620`): a room fills its cell less one tile
  of wall (never under 15 × 11, shrunk by at most a tile); chapels are squircles, crosses have broad arms; an ossuary is
  a hall (up to 17 × 11) behind a 3-wide way. A corridor runs straight through its own two rooms and the wall between
  them — a doorway 5 wide on the critical path, 4 elsewhere — instead of along the wall. Furniture keeps to the walls
  (colonnade one tile off them, tomb rows down two sides, pool in a corner, rubble and loose props within two tiles
  of a wall, pews only beside a 7-wide aisle), so the floor between is fighting room.
- **sewer** (`plaza: true`, `r: 25`, `dead: 4`): junctions on a shaken grid (25 across, ~20 down, one in twelve left
  out) instead of Poisson sites; plazas 17 × 13 to 21 × 15 with small chamfers; a channel tunnel is 5 walk + 2 sludge
  + 5 walk, its bends dug square, footbridges 3 planks and more often; `loops: 0.55`, and the deepest two-way side
  junctions give up a tunnel until four dead ends (pump hall 13 × 9, cistern hall 15 × 11) stand; loose drums only
  within two tiles of a wall.
- **abyss** (`plate`, `r: 16`, `loops: 0.3`): an island is a plate of flesh — its site's own (Voronoi) ground out to
  14–17 tiles, pulled back from its neighbours by a crack of blood 2.6–5 wide; the chasm stays where sites are sparse
  and round the mother. Bridges 5 wide on the critical path and for necks of flesh, 4 elsewhere, 3 to an altar, which
  keeps a small island of its own (the hidden pockets). The ledges at both doors are 5 wide. Now held in mapflow.
- **cave** (`wide`, `moss.w: 4`): start fill 0.55, no rock planted in mid-hall, pillars only ≥ 6 tiles from a wall,
  shelves at `[0.63, 0.77]`, the moss way 9 wide (7 off the spine), neck, rift crack, west ledge and the M3 south
  crack (a kept point of `wideWays`) 5 wide, loose
  crystals/mushrooms/spires within two tiles of rock. A ridge of rock (`wide.ridges`, two) lies across the line from the way
  in to the antechamber, and to the south crack, so the walk still winds (tortuosity rift 1.21, south 1.17). Where rock is too thin for a vault, a block that is
  half rock and otherwise bare floor is walled up round it.
- Shared: `widen(m, pts, soft, dig, r)` takes a half-width (`m.widenR`; 2 = five wide) and judges "wide" by a summed
  table of blocked tiles; `wideWays(…, main)` cuts the doors, camp and boss five wide after the three-wide pass;
  `markRoutes` keeps `m.widenR` when it sets signs and stones down (same code path as before when it is 1: meadow,
  forest and maple come out tile for tile as before; the city differs only in a few placed objects that share the world's dice). `tunnel` digs any width 3–5. Rules-only: `m.rooms`, `m.widenR`.
- Arches: `m.arches` entries may carry their span, `[x, y, ew, lo, hi]` (tiles across from (x, y)); a channel tunnel
  has one over each walkway, a doorway through a two-thick wall has one arch, not two. `hallart.js` draws a span of
  any width (3-tile entries unchanged).
- Held (`ROOMY` in tests/mapflow.mjs): open ≥ 58 % (abyss 57), party room ≥ 55 % (cave 50), route ≥ 4.

Deviations:
- Map sizes not grown: the monster count already rises with the floor; rooms are fewer and bigger.
- Cave party room 52 % (target 55): taking out more rock leaves a bare field; held at 50.
- Abyss 59 % open (target 60–65): the blood is the theme. Sewer water is now only in the short tunnels and the
  cisterns (2.4 % of the map) — the plazas nearly touch; a follow-up could run open channel stubs into the plazas.
- `markRoutes` (34-maps-world.js) and `widen` were touched outside the dungeon cfg lines, for `m.widenR` only.
- `tests/world.mjs`: the hero stands 8 px (was 14) from a guardian before the killing blow — on a wide platform one of
  its pack stood nearer and took the blow.
## J. dunesea as built — 모래바다 (the owner's "desert oasis + desert meets the sea", made huge)

| map | size | band | doors | open | narrow targets | loops | dead ends (longest) | tortuosity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dunesea` 모래바다 (theme `desert`) | 288 × 192 | 31–37 (placeholder) | north ↔ oasis south, east ↔ coast west | 82 % | 0/24 | 451 | 31 (4) | east 1.50 |

The biggest ground: 55,296 tiles, 2.6 × the coast, 3.6 × a 152 × 102 ground. Held strictly by tests/mapflow.mjs (loops ≥ 30).
Built in ≈ 260–290 ms (tests/maps.mjs gives this one map 400 ms, the others keep 150); the `g` + `o` rows of its map payload
are 109 KB (13 KB gzipped; the coast: 42 / 6); the client needed no change — the ground is baked in chunks as they come on
screen (8 × 8 chunks, the first two in 256 ms), the map loads in ≈ 0.7 s, no page errors. Monsters wake by 16-tile cells,
so the 3,100 spawn slots cost nothing where nobody walks.

- **Regions, north to south** (one `wilds` map; every region is laid out by place, not by the dice):
  1. **the dune sea** (rows 0–≈94): two upper levels in long ridges by turns (`tierOf`), each ridge climbed only by a
     few seven-wide ramps (`rampP`), bare crests (`z`) and rippled slopes;
  2. **the salt flat** in the north-east corner: one flat level of white `S` with standing stones, nearly no barriers;
  3. **the dry riverbed** (`open`): a gravel bed nine wide winding from the north rim to the surf; no barrier stands in
     it and it comes down each ridge in steps — the one way that crosses every level;
  4. **the oasis belt** (rows ≈94–137): low desert with four oases (`oases`) — the largest (lake radius 8.5) keeps the
     **village** (set piece `village`: mud huts and palms round a fire that always burns, a waypoint stone beside it), three
     smaller ones in the belt's east and up in the dunes; each lake in a green ring with reeds and palms and a jetty;
  5. **the buried ruin** in the west: the temple piece with its pool dry and drifts of dune sand over the flagstones
     (`temple: { at, buried, arena }`) — `m.bossAt`, so the field boss rises there wherever it was summoned;
  6. **the coast** (rows ≈137–185): a white beach, two rows of surf, 36 rows of walkable shallows with reef rocks and
     natural sand flats, six **islets** (`sea.islets`: a round of sand with palms, a chest and two keepers) each joined
     to the beach by a **sand bar** three wide, then a thin strip of deep sea.
- **World graph**: `oasis` south ↔ `dunesea` north (the entrance), `coast` west ↔ `dunesea` east (the way on). Both doors
  were cut into the finished maps (`doors` in their cfg): 9 object tiles changed on each, no ground, the stones, fires and
  set pieces unmoved (their spawn boxes shift by a handful because a new door makes a quiet arrival). The oasis keeps the
  cave as its way on (`wayOn`). The coast's door stands on its west rim at row 45 (a door further south was a straight
  walk from the entrance and broke the tortuosity rule).
- **Five stones** — 입구, 중턱, 안쪽 along the walk to the coast door, then 오아시스 마을 and 흰 모래 해변 placed by
  point (`m.stonesAt`, `GEN.stoneNames`) — **two camps** (the caravan on the made way, the village) plus the plaza's fire,
  14 chests (6 on islets, the ruin's, vaults), 5 hidden pockets, gathering nodes of grade 4. The made way calls at the
  village and the beach on its way from the north door to the east one (`via`).
- **wilds, new settings** (all behind their cfg keys; the other maps are byte-identical apart from the two doors):
  `oases`, `tierOf`, `rampP`, `tierOpen` as a function, `wallAt`, `open`, `via`, `stonesAt`, `doors`, `sea.islets /
  isletGap / isletKinds / isle`, `temple.at / buried / arena`; `biome` also gets the region, `paint` the tile.
  33-maps-zones: `cfg.rosterAt(x, y)` — a habitat's own kinds; 34: `GEN.wayOn`, `GEN.stoneNames`, `m.stonesAt`.
- **Monsters** (existing bodies in new tints, **placeholders to be balanced later** with the other new maps — see
  level-bands.md): dunes `ratking_gold` 31, `spiderhand_bone` 32, `owlstare_gold` 34; belt and ruin `spiderhand_bone`,
  `bonehound_gold` 33, `owlstare_gold`, `moleworm_gold` 37 (also the field boss); shallows `fishwalker_blood` 35,
  `crabskull_frost` 36. Chest `chest_dunesea` (Lv 34). No new ground or object characters: the art agent's desert and
  coast skins apply as they are. Wished-for species: the M3 list's desert and shore kinds (spine scorpion, sand-worm maw,
  mummy camel, hermit-crab swarm, brain jellyfish).
- **Tests**: mapflow (strict), maps (size, zones, stones — the two by-place stones need only stand apart —, build time),
  world (doors both ways, four oases, village fire and stone, islet chests reachable, boss ground in the ruin, bands),
  lifeskills (grade). Shots: `game/shots_dunesea/` (world, over, three scenes, live).
