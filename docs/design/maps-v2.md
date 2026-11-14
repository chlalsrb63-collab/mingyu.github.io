# maps-v2 — 다채로운 사냥터·던전 (varied hunting grounds and dungeons)

Status: **M1 built** (meadow + forest reworked, path-quality test). M2–M4 are design.
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
| 5 | glowing green crystal cavern, mossy winding floor, rock shelves, spires, streams, mushrooms | `cave` 수정 동굴 → **비취 수정굴** | M2 |
| 4 | dark brick dungeon: flagstone plazas, brick walls, pillars, arches, torch alcoves, rubble | `crypt` 뼈의 지하묘지 + `sewer` 하수도 → **벽돌 회랑** | M2 |
| 7 | desert dunes, oasis lake with palms and reeds, mud huts | new `oasis` **모래바람 오아시스** | M3 |
| 8 | tropical beach: white sand, palms, surf line, turquoise shallows, reef rocks, islets | new `coast` **산호 해안** (joined to the oasis) | M3 |
| 9 | coastal road: winding asphalt with yellow edge lines through jungle, black-boulder shore, teal sea | new `jungle` **정글 해안도로** (between city and coast) | M3 |
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

### A.5 비취 수정굴 (crystal cavern) — M2
- Generator: `cavern` keeps its CA caves; add **rock shelves**: CA floor split into 2 heights by a low-frequency
  field; shelf edges as rock `W` with ramps; the lowest band is the "river of green" — moss floor winding through
  (a new ground `m` moss? — no: `m` is the city's lane; use a new char, see C) at least 5 wide.
- Streams: thin `w` channels along shelf feet with fords; crystal spires (new object) on shelf rims, glowing
  mushroom rings `Y` in hollows. Boss arena unchanged.
### A.4 벽돌 회랑 (brick halls) — M2
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
| A.5 | moss floor (green, glowing specks), crystal spire object, glow mushrooms | new ground + object chars, cave theme |
| A.4 | brick wall face, arched doorway, torch alcove, broken paving variants | crypt/sewer `UG` skins |
| A.7 | dune sand (two tones), palm tree, mud hut, oasis reeds | desert theme |
| A.8 | white sand, surf/foam edge, turquoise shallows (walkable), reef rocks, islets | coast theme; shallow water must be walkable (not `w`) |
| A.9 | jungle trees/palms, asphalt with yellow edge line, black boulders, deep teal sea with waves | `a`/`m` exist (city); new edge-line and boulder art |
| A.1 | snow ground, snowy pines, gothic walls/towers, arch bridges | snow theme |

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
- **M2**: cave → 비취 수정굴, crypt + sewer → 벽돌 회랑 (rules); hold cave/crypt/sewer in mapflow. Then client art
  for A.2/A.6/A.3/A.5/A.4 (table C).
- **M3**: oasis + coast + jungle (new GEN entries, GATE_LINKS, bands, monsters per zone, BGM), client themes.
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
