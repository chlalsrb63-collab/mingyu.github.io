# 사냥터 4배 확장 + 파티 전용 「차원 균열」 던전 — 설계서

Status: Phase 0 done (F.), Phase 1 built (G.), Phase 2 built (H.: as built, tuned numbers, deviations). Audience: two implementers working in parallel (Phase 1 / Phase 2) after one
foundation task (Phase 0). Code, identifiers and commit messages are English; every player-facing string is Korean
(AGENTS.md rule 6). All numbers marked (measured) come from throwaway node scripts run against the built `logic.js`
on this repo; numbers marked (est.) are estimates.

Naming: the new instance dungeon is **차원 균열** (`rift` in code ids is avoided; code uses `dim`, e.g. `dim:3`,
`DIM`, action `dim_*`). The half-hourly world event stays **균열 침공** (`S.evt`, `EVT`, `worldEvent`). Players never
see both words in one string: invasion = "균열 침공", instance = "차원 균열". Town object: **차원의 오벨리스크**; NPC:
**균열 지기 오르카** (keeper, stands beside it).

---------------------------------------------------------------------------------------------------------------

## A. Current state (pointers)

| topic | where | facts |
| --- | --- | --- |
| map build | `34-maps-world.js buildMaps()` (L81), `36-custom-maps.js customWorld()` then `const MAPS = customWorld(buildMaps())` (L171) | every map generated at module load, once per isolate (each Room DO isolate = every channel). Generators `wilds metro cavern catacomb sewers abyssal` in 30/32. `finalize(m)` makes `m.solid`, `m.reach` (flood from `m.entry`), joins `g`/`o` rows to strings |
| globals filled at load | `FIRES[id]`, `WP[id]` (waypoint, by `markRoutes`), `CAMPS`, `HUNTED`, `COL_MOBS`, `NPC_MAP`, `REGION_BONUS`, `EVT_MAPS` (60-content), `ACH explore` | all read `MAPS` / `WP` at load time: these are what make lazy generation non-trivial |
| density | `DENSITY` (10-tables L208), `CROWD_MAX = 228`, crowd pass at the end of `buildMaps` (L190-207): spawn counts scaled to `open / DENSITY[id]` capped at `CROWD_MAX` | a map holds ≈ 190-230 monsters, all placed in `setup()` for ALL maps; respawn in `tickMob` (`placeMob` at `respAt`) |
| runtime | `setup()` (40) builds `S.maps[id] = {mobs, drops, ev, tele, zones, pools, fires, props, decoys, who, n, kc, fb}`; `tick()` (80) loops `Object.keys(MAPS)` and skips `rt.n <= 0` | world state is in-memory per channel room only |
| spawn | `newMob`, `placeMob(S,m,mob)` picks a random tile in `mob.r` box that is `m.reach`; `FIELD_BOSS[id]` summoned by `rt.kc` kill count -> `spawnFieldBoss`/`bossSpot` | elites: `mob.ep` chance at (re)placement; guardians/chests are `fix` spawns with 1-tile boxes |
| payload | `mapPayload(m)` (34 L383) sent as `out.map` in `viewFor` when `p.sendMap` (set in `addPlayer`/`changeMap`) | full `g`,`o` rows as JSON strings, `big`, `marks`, `portals`, `npcs` |
| client bake | `scene2d.loadMap` (L1162) -> `isotiles.bakeGround` -> `iso_ground.bake(m, theme)`: one `Uint32Array(W*H)` + `Uint8Array` mat, `W=(w+h)*16`, `H=(w+h)*8+24`; 2 water frames as canvases; `scenery()` loop creates one `statics` entry per object tile and sorts every frame (culled by screen box); minimap `Art.renderMini(m,4)` then `isoMini` | everything is baked/built for the WHOLE map on arrival |
| parties | `S.parties[id]={id,m:[pid…],leader}`; `PARTY_MAX=4`, `PARTY_RANGE=340`; `members/allies/leaveParty` (40 L466+); invites `p.pinv`; XP/loot share via `allies()`; party chat `chat.pt`; actions `p*` in 70/75 | party is per-channel-room (`S.parties`), pid-keyed |
| map change | portals: `m.portals[{x,y,to,tx,ty}]` stepped on in `mv` apply; `changeMap(S,p,to,x,y)` (40 L445) moves counters `S.maps[..].n`, sets `sendMap`/`fix`; waypoint warp `warp` action + `WP`; recall item | `MAPS[...]` is dereferenced in ~40 places (grep `MAPS\[`) |
| invasion event | `60-content.js` `EVT`, `worldEvent/beginEvent/runEvent/spawnWave/spawnEvtBoss/endEvent`, state `S.evt`, wire `self.evt` (`evtView`) | one hunting ground per 30-min slot, 3 elite waves + boss at the waypoint stone, 8 min, damage-share payout |
| town hub | `buildTown()` 40x30 (`34`), entry (20,~20), spirit tree T at (20,20), east gate -> meadow, west gate -> city; interiors cafe/hall/inn via `data/maps`; NPCs in `m.npcs` (`role`: talk/shop/quest/…) + `TELLER` pushed in 62-daynight | there is room for the obelisk in the plaza (see D.9) |

## B. Measurements, budgets, risks

### B.1 Measured today (node 22, built `logic.js`)

| item | value |
| --- | --- |
| module load incl. all `MAPS` | 222 ms (first import); `buildMaps()` rebuild 109 ms (warm) |
| `setup()` (≈1549 mobs placed) | 6 ms |
| map sizes (w x h, tiles) | meadow/forest/city/sewer 76x51, crypt 66x51, cave 66x50, abyss 76x60, maple 80x56, town 40x30 |
| reachable tiles | meadow 2402, forest 2297, crypt 1085, city 2066, sewer 1145, cave 1407, abyss 1256, maple 2704 |
| mobs per map | 152-228 (cap 228) |
| `mapPayload` JSON | 7-10 KB per hunting map; all 85 KB |
| bake canvas `(w+h)*16 x (w+h)*8` | meadow 2032x1016 = 2.1 Mpx, x2 frames x4 B = **15.8 MB** (abyss/maple 18.1 MB) + pixel/mat buffers (5 B/px, ≈10 MB) transient |
| tick (maple, 912 mobs = 4x, all awake) | 4 players 0.37 ms, 20 players 0.94 ms, 40 players 1.52 ms; `viewFor` for all 40: 1.36 ms. 1x map is ≈4x cheaper |
| snapshot size in a fight | ≈8-10 KB average of the sampled frames including the map payload frame; steady snaps are a few hundred bytes to ~2 KB |

### B.2 Measured with every hunting map doubled per side (vault/n counts x2-3)

| item | 1x | 4x |
| --- | --- | --- |
| module load (all maps) | 222 ms | **614 ms** |
| `buildMaps()` rebuild | 109 ms | **473 ms** (linear in area, ≈4.3x) |
| sizes | | 152x102, crypt/cave 132x100, abyss 152x120, maple 160x112 |
| reachable tiles | 1.1-2.7k | 4.8k-12.2k |
| `mapPayload` JSON | 7-10 KB | **27-40 KB** per map (still fine one-off; chat/who unaffected) |
| bake canvases | 2.0-2.2 Mpx | 4064x2072 = 8.4 Mpx (abyss 4.4k x 2.2k), 2 frames **≈ 67-73 MB** + ≈ 42 MB transient buffers; iOS Safari canvas cap is 16.7 Mpx so it still fits, but memory is ~4x and the bake stall ≈ 4x (est. 4x of today's `bake().ms`, which the code already returns; Phase 0 logs it) |
| `statics` | one entry per object tile; sorted per frame | ≈4x entries, culled by screen box -> render cost flat, load cost 4x |

### B.3 Conclusions

1. **Tick CPU is not the problem** (1.5 ms with 40 players on 900 mobs; `tick` already skips empty maps). The
   owner's player-position-based spawning is therefore a *gameplay* feature (density and waves follow players,
   fewer idle mobs, persistence of elites/chests) and a memory/`viewFor` scan saver, not a CPU rescue. Do not
   over-engineer: cells are an index over what exists.
2. **Worker cold start is the real risk.** Cloudflare Worker global-scope startup limit is 1 s; 614 ms plus
   parse is too close (each of 4 channel isolates pays it, again after every eviction), and `tests/maps.mjs`
   asserts `buildMs < 250` (would fail at 473 ms). -> **lazy per-map generation** (B.4a).
3. **Client memory/stall:** 4x canvases 70+ MB and ~4x bake time on arrival. -> **chunked baking** (B.4b).
4. **Payload:** 30-40 KB once on arrival is acceptable. Cheap win only: RLE of rows (B.4c). Do not do anything
   cleverer.
5. **Monster count** grows to ≈ 600-900 per map if density is kept; `CROWD_MAX` must become per-zone and the
   awake set small (cells). Save/`exportChar` unaffected (monsters are not persisted).

### B.4 Mitigations (decided)

**a. Lazy map registry (server).** Replace `const MAPS = …` with a registry:

```js
const MAP_META = {id: {id,name,theme,band,hunting:true,seed,cfgKey}}   // static, built at load, no geometry
function mapOf(id)        // -> built map (generates + finalize + markRoutes on first use, cached); null if unknown
function mapOfS(S, id)    // -> mapOf(id) OR S.dims[id].map for runtime instances "dim:<n>"
function allMaps()        // forces everything (tests, dump-maps, atlas)
```

Rules: `MAPS` stays as a `Proxy`/getter-backed object ONLY for unconverted call sites during Phase 0 (`MAPS[id]`
-> `mapOf(id)`); Phase 0 converts all ~40 sites (grep `MAPS\[`) to `mapOfS(S,id)` / `mapOf(id)` and deletes the
proxy. Town, interiors and editor data maps (small) are built eagerly (`customWorld` for them only). Load-time
globals become derived from `MAP_META` instead of `MAPS`: `HUNT_IDS`, `COL_MOBS` (from cfg `mobs` lists, no
geometry), `EVT_MAPS` (= `HUNT_IDS` with `FIELD_BOSS`; a test asserts each has a waypoint once built),
`NPC_MAP` (static NPC lists come from cfg/data; generated NPCs like the hermit are registered at build time via
`mapOf`), `explore` achievement = `Object.keys(MAP_META)`.
Portals between generated maps are currently wired with neighbour gate coordinates (`join`/`leave`), which would
cascade-build the world. New form: a portal holds `{x,y,to,gate,k}` and the arrival tile is resolved at warp time
by `arrivalOf(to, gate, k)` (builds the target on demand; falls back to `freeTile(entry)` when the gate does not
exist, e.g. an editor map `replaces` the target). `mapPayload` door labels use `MAP_META` (name+band), never the
target geometry. `FIRES[id]`, `WP[id]`, `CAMPS` fill when the map is built; `setup()` no longer spawns monsters
for all maps: `rt` is created lazily in `runtime(S,id)` on first player entry (`rt.n` counter semantics kept).
Expected cost: town + interiors ≈ 20 ms at load; each 4x hunting map ≈ 55-80 ms on first entry (473 ms / 8).

**b. Chunked ground baking (client).** `iso_ground.bake(m, theme)` -> `bakeChunk(m, theme, cx, cy)` for 32x32-tile
chunks (≈1024x536 px each, 2.2 MB/frame), computing the per-map precomputation (`materials`, `extras`, bridge
axis, deep-water distance) once and caching it on `m`; the 2-tile apron reads neighbours from the full `m.g`
(the `at()` helper already bounds-checks), so chunk seams must be pixel-identical to a monolithic bake (test:
bake 1x map both ways in `_iso.html`/playwright, compare). `scene2d` keeps an LRU of ≤12 chunks (+ the 4 around the
player pre-baked on arrival, rest during idle frames, 1 chunk per frame to avoid stalls); `drawLayer` loops
visible chunks. `statics` building (`scenery` loop) stays whole-map but must be profiled; if >100 ms at 4x it is
also split per chunk. Maps <= 80x60 (town, interiors, editor maps) keep the single-chunk path. Peak memory at 4x:
12 chunks x 2 frames x 2.2 MB ≈ 53 MB -> in practice ~9 visible = 40 MB vs 70+ MB.
Minimap: `renderMini(m,4)` at 152x102 is 608x408 px (fine) but `isoMini` doubles it; use scale 2 for maps > 100 wide
(Phase 0: choose `s = m.w > 100 ? 2 : 4`). Add a "fog of war" later, out of scope.

**c. Payload.** Row RLE for `g`/`o` (`"....."` runs as `[char,count]` pairs when shorter) in `mapPayload`, decode in
client `onSnap` (`out.map` consumer). Measured saving not taken; expect 3-5x on open terrain. Optional; only do if
the Phase 0 agent measures a > 25 KB payload. Sent once per entry, never per tick.

**d. Active-area (cell) spawning.** See C.5 for the zoned content; mechanism here:

```js
const CELL = 16;                                  // tiles; a 152x102 map has 10x7 cells
rt.cells = Int32Array(cw*ch)                      // 0 = asleep, 1 = awake
m.cellSpawns[cellIdx] = [{k, n, el?, fix?, zone}] // built with the map from the old `spawns` boxes, deterministic
```
- A cell is **awake** when any living player on the map is within `WAKE_R = 3` cells (Chebyshev; ≈ 48 tiles ≈
  770 px, > view 280 px + aggro). On wake the cell's quota is filled with `placeMob` (mobs spawn out of sight,
  >= `SPAWN_MIN_D = 14` tiles from every player, only if their own `respAt` has passed); cells within 5 cells of a
  player stay loaded; **sleeping a cell** = its normal mobs (not fixed, not in combat, no `tgt`) are removed and a
  per-cell `cooldownUntil[cell]` records when it may refill, so farming a cell empty cannot be reset by walking
  away (`respAt` per cell: `CELL_RESPAWN_MS = 25000` after the cell's last kill, scaled per zone).
- Persistent (never slept, spawned at map runtime creation): chests, guardians/`fix` elites, field-boss state
  (`rt.fb`, `rt.kc`), hidden-area treasure, waypoint/camps. They live in `m.fixedSpawns`.
- Density follows players: `target(cell) = base(zone) * clamp(0.75 + 0.25*alliesNear, 0.75, 1.5)` (party of 4 =
  1.5x) evaluated only when a cell wakes or refills (no mid-fight changes). "Waves": every `WAVE_MS = 90000`, a
  cell within 2 cells ahead of a player that moved > 8 tiles gets `+25%` filled (cap = 1.5x target).
- `tick`: `for each awake cell`, only `rt.mobs` of awake cells are iterated (`rt.active` array rebuilt on
  wake/sleep, not per tick). `viewFor` keeps scanning `rt.active`.
- Existing `tickMob` respawn path (`!mob.temp && now >= mob.respAt`) is replaced for cell mobs by cell refill;
  `mob.temp` mobs (field boss, invasion) are untouched. Invasion `spawnWave` keeps working (it pushes to `rt.mobs`;
  mark them `evt`, they never sleep).
- Determinism: all randomness through `S` (`ri(S,…)`), iteration order over cell index; a replay test with a fixed
  player path yields the same mob ids/positions.

## C. 4x expansion of the hunting grounds (Phase 1)

### C.1 Principles

- Each side x2 (area x4), generated from the **same seeds/generators**; no new generator code except zone banding.
  Rewire every cfg value that is area dependent (region radius `r` stays; region count rises by itself;
  `vaults`, `n`, `leaf`, `lakes`, `ruins`, `tpm` scale with area).
- Zones by **graph distance from the entrance** (BFS over `reach`, reuse `markRoutes.flood`). Zone fractions of
  the maximum distance D of reachable tiles from `m.entry`: **safe** d < 0.08 D (>= 8 tiles wide plaza around the
  entrance, a campfire + waypoint, no spawns, safe-cell flag so cells never wake there), **normal** 0.08-0.55 D,
  **elite** 0.55-0.85 D, **hidden/treasure** = dead-end pockets (reachable tiles whose BFS subtree is a leaf
  region with d > 0.7 D) behind a secret-ish path: a region joined by a single bramble/hedge/ruin "gap" tile (`gap`
  cfg exists), marked by a landmark; contains the chest spots + 1 guardian. Result stored in `m.zone` as
  `Uint8Array(w*h)` (0 safe,1 normal,2 elite,3 hidden) and `m.zones` summary for tests/HUD.
- Level bands (`m.band`) unchanged per map (door labels, `markRoutes` rank). Within a map: normal = band[0..mid],
  elite zone mobs pick from the top mobs of the map and spawn with `ep` 0.35, hidden zone = guardians + chests.
  Mob kinds are already ordered by `MOBS[k].lv` in each cfg; zone assigns `kinds[floor(zone_progress * n)]`.
- Density (per reachable tile = 1/DENSITY): keep today's `DENSITY[id]` for **normal**; elite zone x0.6 count but
  `ep=0.35` (≈ 2x elites per mob); hidden: 0 normal + fixed guardians; safe 0. `CROWD_MAX` is removed from the
  eager pass: counts are cell quotas, so awake mob count per player ≈ today's (≈ 6 cells x ~12 tiles/mob).
  Sanity: wake radius 3 cells -> up to 49 cells x 256 tiles x (1/11) ≈ 1100 tiles... capped by `WAKE_MAX_MOBS = 230`
  awake mobs per map (nearest cells first), the old cap.

### C.2 Per generator

| map | cfg change (w x h) | structure notes |
| --- | --- | --- |
| meadow 76x51 -> 152x102 | `vaults 3->9`, `lakes 2->4`, `ruins 1->3`, `tpm` same, `gates` same | entrance west (safe plaza). 4-5 hedge/rock "gap" side-lobes become hidden pockets; 2 extra waypoints |
| forest 76x51 -> 152x102 | `vaults 3->9`, `ruins 2->5`, `lakes 1->2` | gates west/north/east/crypt stair: keep all door pockets within normal+elite; hidden = dead grove behind bramble |
| maple 80x56 -> 160x112 | `vaults 4->10`, `ruins 2->4`, `lair` stays the elite-zone anchor | the lair chapel (rotstag) is forced into the elite zone; cottage camp is the safe plaza of the west gate |
| city 76x51 -> 152x102 | `metro` grid with bigger subdivision; sewer stair stays where `stair:"sewer"` puts it | entrance east. Elite zone = barricaded blocks; hidden = car park/back lots |
| cave 66x50 -> 132x100 | `vaults 4->10` | cellular automaton: raise blob counts with area; boss arena stays at fixed relative position (far side) = the elite/hidden end |
| crypt 66x51 -> 132x102 | `leaf 150->300`, `n 3->6` | catacomb BSP; entry (y 0.8) is safe; ossuary vault = hidden |
| sewer 76x51 -> 152x102 | `n 3->6`, `r` same | tunnel network; `gatorhalf` guardians are the elite zone |
| abyss 76x60 -> 152x120 | `n 7->14`, boss arena fixed far end | entry safe; the field boss `abyssboss` arena = elite zone end |

Measured: with only w/h/vault/n scaled the generators succeed for every map at 4x (connected, `reach` 4.8-12.2k),
rebuild 473 ms total -> the Phase 1 agent must still run `tests/maps.mjs` connectivity checks for gates/camps/
chests/waypoints. Re-balance expected-clear counts: area x4 means 4x the monsters to cross; keep XP per kill and
raise zone-appropriate `gold`/`xp` only via the elite multiplier already in `ELITE`.

### C.3 Travel aids

- **Waypoints:** `markRoutes` places 1 (at ~12 steps). Add `placeWaypoints(m, k)`: stones at BFS distance ~35% and
  ~70% of the critical path length (maps with D > 120 tiles get 3 total: entrance, 1/3, 2/3), each on
  `m.marks` kind `waypoint`; `WP[id]` becomes `WP[id] = [stone…]`, `warp` action takes `{t:"warp", map, i}`;
  waypoint unlock is per stone (sheet `ch.wp` currently a set of map ids -> migrate: old entry unlocks stone 0 of
  that map, shape `ch.wp = {mapId: bitmask}` — hard rule 4: `migrate` + sheet `v:8` or `v:9` (whatever is next),
  old-sheet test). Gate/boss events (`evtSpot`) keep using stone 0.
- **질주의 바람 (wind path):** on each big map, a "wind shrine" object beside every waypoint after the first:
  stepping on it grants `spdBuff` +30% for 20 s (existing `p.spdBuff`; cooldown 60 s per shrine per player), one
  new object char (see AGENTS recipe "Add a map set piece"), tiny client art (a swirling leaf/pennant, code-drawn).
  No mounts (later).
- **Signposts:** existing `markRoutes` signposts per junction; add one sign per zone boundary ("엘리트 지대 →",
  "비밀 정원 ↗" only after discovery). Minimap marks waypoints (existing) + shows zone tint when the player has the
  stone for that region.

### C.4 Editor maps, tests, migration

- Editor maps (`data/maps/*.json`) are never resized: `replaces: "<built-in>"` maps keep their own size and are
  then not zoned by the generator (cells fall back to the file's `spawns`, treated as zone 1; one spawn box = one
  cell quota). Data maps (`willow`, interiors) unchanged. `data:check` must keep passing: a `replaces` target now
  resolves through `MAP_META`.
- Tests: `tests/maps.mjs`: build budget becomes **per map `< 150 ms` and eager part `< 100 ms`**, not whole world;
  determinism check builds each map twice; add zone checks (safe zone has no spawn, elite zone mobs lv >= normal,
  each hidden pocket reachable, chest tiles in zone 3, `waypoints >= 2` when D > 120). `world.mjs` kill/boss
  tests unchanged (they stand a player on a map via `devPlace`).
- Migration: `addPlayer` already sends a character to town when `!canStand`; new rule: if the map still exists but
  the saved (x,y) is not standable/reach in the new geometry, move to **that map's entry** (not town) with a toast
  "지형이 넓어져 입구로 이동했습니다." `migrate` clamps `x,y` into `[0, w*T)`. Quest/collection/side-quest data refers
  to ids and kinds only: unaffected.

### C.5 Active-area cells: how zones feed them

`buildCells(m)` (called inside `mapOf`) converts the zone map + generator spawn boxes into `m.cellSpawns`.
Quotas per awake cell: `n = round(openTilesInCell * zoneDensity / DENSITY[id])`, kinds distributed by zone as C.1.
Field boss, guardians and chests keep their old `fix`/box semantics and are created at runtime creation.

## D. 차원 균열 — party instance dungeon (Phase 2)

### D.1 Instance model

- Runtime maps inside the channel world: `S.dims = {}`; `S.dims["dim:7"] = {id, seed, map, rt, party, theme, lv, born, expire, state}`;
  `S.maps["dim:7"] = rt` (same shape as any runtime state, so all combat/tick code works); `mapOfS(S, id)` returns
  `S.dims[id].map`. `tick` iterates `Object.keys(MAPS)` + `Object.keys(S.dims)` (helper `liveMapIds(S)`).
- **Phase 0 contract**: every `MAPS[x]` use that can see a player's `p.map` is `mapOfS(S, p.map)`; every `S.maps[id]`
  is created via `runtime(S, id)`; `validateAction` rejects `t:"warp"/"quest"` etc. for ids not in `MAP_META`.
- Caps: `DIM_MAX = 4` concurrent per channel room; a new open is refused with "차원 균열이 모두 사용 중입니다
  (n/4)." Memory: each instance map ≈ 60x44 tiles ≈ 20-30 KB geometry + ≤ 80 mobs.
- Cleanup: when `rt.n === 0` for 20 s (or the cleared-portal timer 90 s expires, or `expire` 20 min hard cap),
  `closeDim(S, id)` deletes `S.dims[id]`/`S.maps[id]`, drops loot, clears party link `party.dim = 0`. Players
  online-but-elsewhere never keep it alive.
- Never persisted; a restart loses instances (players are returned to town: `addPlayer` sees unknown map ->
  `START`). `ch.map` of a character saved inside `dim:*` is rewritten to `"town"` in `exportChar` (save the
  position the player entered from: `ch.dimFrom = {x,y}` is not stored; town obelisk spot is used).
- Instance wire id: map payload carries `id:"dim:7"`, `name:"차원 균열 Lv.N"`, theme of the chosen theme.

### D.2 Generator `dimension(cfg)` (new file `31-maps-dim.js`, part order after 30, before 32 or after 32 (needs mapkit only))

Input `{seed, theme, lv, size}`; pure and deterministic via a seed box `rnd(box)`; no `MAPS` access.
- Grid 56x40 tiles (≈ 2200 tiles, 1/3 of a 4x hunting map); tile alphabet = reuse of an existing underground theme
  (`crypt`, `sewer`, `cave`, `abyss`; chosen `themes[(seed>>3)%4]` ... biased by party level: lv < 20 crypt/sewer,
  20-32 cave/sewer, >= 32 abyss/cave/crypt) — floors/walls come from that theme's `g/o` chars so `scene2d`/`iso_*`
  art works with zero new art: generator only outputs a map with `theme` set.
- Layout: 7-9 rooms (min 7x6, max 13x10, templates reuse the catacomb `shapes`: plain/cross/octagon/ell) placed by
  Poisson/random-rect with rejection, MST via A*/L-corridors (width 2-3), +1-2 loops, 2-3 **dead-end reward
  rooms** (leaf nodes with d from start >= 60% of max), **start room** at the far end from the boss room, **boss room**
  = largest room whose BFS distance from start is maximal (target path length 70-110 tiles).
- Spawns (`m.cellSpawns` empty; `m.dimSpawns` list): packs per room: `pack(n, kinds, ep)`, `n = 3..6`, 12-16
  packs total, total normal mobs ≤ **70** (cap `DIM_MOB_CAP = 90` including elites), elites: 1 in start+1 rooms 0,
  rest 1 per room with `ep` 0.3-0.5; boss room empty until spawn; dead-end rooms: 1 guardian elite + 1 chest each.
  Mob kinds = the chosen theme's `COL_MOBS` pool filtered by `lv`: lowest two kinds for `lv -4`, top two for `lv`;
  `lv` = party max level clamped to `[10, MAXLV-1]` at open time (`MOBS[k].lv` used to pick; band per theme above).
- Output: a normal map object (`g,o,w,h,entry,reach,solid,portals[], npcs[], spawns[], marks[], band, safe:false,
  theme, name`) so `finalize(m)` and `mapPayload` work unchanged. `m.dim = {rooms, boss:[x,y], start:[x,y],
  dead:[ [x,y]… ], elites, cap}`.
- Contract tests: determinism (same seed -> identical `g`,`o`, spawn lists), connectivity (all rooms reachable
  from start; every spawn standable; boss-room has a >= 5x5 open core), size caps, 200 seeds x 4 themes build
  < 40 ms each (budget: one entry must not stall the room: `tick` alarm 100 ms).

### D.3 Progress rules (numbers)

Target clear time: **7 min for 4 players at level (band max)**, 5-10 min window; solo at -2 levels ~ 14 min is
accepted (rift scales mobs with party size: `hp x (1 + 0.25*(n-1))` applied by `ELITE`-like `dimK` multiplier on
`mob.hp` at spawn, not elites' own table; atk unchanged).

- Gauge `rt.prog` 0..100 (float). Per kill (mobs whose `mob.dim`): normal **+0.9** (70 mobs -> ~63), elite **+4**
  (≈ 8 elites -> 32; includes guardians), progress orb drop from elite **+3** (when picked: orbs are `rt.orbs`
  entities, auto-pickup range 36 px, expire 25 s, any party member), chest/boss room guardians count as elites.
  Sum available ≈ 63 + 32 + 24 = 119 >= 100 so a full clear is not needed (~85% of everything). At >= 100 the boss
  spawns; remaining mobs stop giving progress and **despawn** with a short dissolve event (cheap clean).
- Time: instance `limit` 15 min from open (`expire = born + 900000`), a 3-min warning toast and countdown on HUD.
  Failure = timeout or all members dead/left: `state "fail"`, everyone is returned to town after 8 s, no reward
  (consolation: gold `lv*30`). Death inside: normal death handling but respawn point is the instance start room
  (`respawn` action returns to `dim.start` with 1 free revive per player per 60 s; costs: normal `deathLoss` is
  waived inside the rift to keep it fun; set a 25 s respawn delay). Leaving: portal at start room ("마을로"), also
  recall item works; a player who leaves may re-enter by interacting with the obelisk while `state === "run"` and
  `rt.n < 4` (button "합류", only members of `party.dim`'s party).
- Disconnect: `removePlayer` leaves the party slot but the instance keeps `dim.members` pids for 3 min; reconnect
  inside the window: `addPlayer` sees `ch.map` rewritten to town; the obelisk offers "합류". Instance closes if
  everyone is gone > 20 s anyway.

### D.4 Pylons / shrines (buffs)

Two sources, both `rt.props`-like entities `rt.pylons[{id,x,y,kind,until,used}]` sent via snapshot `dim` block:
1. **Elite-dropped orb** (progress; D.3) — `kind:"orb"`.
2. **Shrines** (`kind` atk/spd/shield/haste): spawn when an elite dies with chance 35% (guaranteed for the 3rd
   and 6th elite), at the corpse; stay 30 s; activating = step within 20 px: buff to **all members within 400 px**:
   | kind | name (Korean) | effect | duration |
   | --- | --- | --- | --- |
   | atk | 분노의 기둥 | `p.atkBuff`: +25% atk (existing `atkBuffK`) | 25 s |
   | spd | 질풍의 기둥 | `p.spdBuff` +30% move speed | 20 s |
   | shield | 수호의 기둥 | absorbs 20% max HP (reuse `p.shield` if present, else 10% damage reduction) | 20 s |
   | gauge | 정령의 기둥 | refill class gauge/focus + 30% MP | instant |
   One shrine per kind max alive. Buff values live in a `DIM` table in `10-tables.js`-style part so balance edits
   are data-only.

### D.5 Boss selection and spawn

At `prog >= 100`: choose the boss by theme+band: `DIM_BOSS[theme]` list ordered by lv: crypt `ratking`-class
`FIELD_BOSS.crypt`, sewer `FIELD_BOSS.sewer`, cave/abyss field bosses (the existing `FIELD_BOSS[id]` map).
Spawn mechanism = `spawnFieldBoss`-like `spawnDimBoss(S, rt)`: `bossSpot(S, m, ax, ay)` with anchor = the party
centroid shifted toward the boss room (if party is >= 10 tiles from the boss room it spawns beside them at >= 8 tiles
distance; else it spawns in the boss room). 1.5 s warning ring (`rt.ev.push(["t",x,y,40,1500])` existing), `el:2`,
hp scaled x`dimK`, one extra trait. HUD boss bar uses `M` mob entry hp; add `dim.boss = mobId` field.
On boss death: `rt.state = "clear"`, spawn chest at boss position (`rt.props` chest: loot table
`dimChest(lv, n)`) and a portal object (`rt.portal = {x,y}` on the floor; stepping on it = `changeMap` to the town
obelisk landing). Portal stays 90 s then closes and the instance reaps.

### D.6 Rewards

- Boss chest opens per member (personal loot via existing `payout(S, p, {gold,xp,stone,rune,gear,gearQ})`):
  gold `60*lv`, xp `0.5 * xpNeed(lv)` (so one rift ≈ 4-5% of a level at band; this beats normal hunting ≈ 3x per
  minute — numbers for the economy designer to tune), `gear: 1` quality 3 (rare+), `stone 2`, `rune: 60%`,
  cosmetic roll (`cosRoll(S, p, "rift")` — currently the invasion source `rift`; add a `dim` source in
  `COSMETICS` so both coexist). Extra per member: **균열의 열쇠 조각**? **No** — keep simple: no currency in v1.
  Difficulty tier is one level (`lv`); tiers later via `key.lv` item in v2.
- Per-kill drops inside: normal loot table x0.5 gold, elite drop ×1.2 rarity (existing `lootFor`), guardian chests
  (`chest_<theme>` kinds already in MOBS).
- Anti-abuse: reward only if the player dealt > 0 damage or was within party range of the boss at death; cooldown
  daily bonus `dimDaily` (first 3 clears/day give the full xp, after that 50%): `ch.dim = {day, n}` in the sheet
  (`newChar` default, `migrate` normalise, bump sheet `v`, old-sheet test).

### D.7 Town obelisk, NPC and ready check

- Placement: `town` plaza at tile (24,18) (east of the spirit tree (20,20); tiles must be open — Phase 2 agent
  verifies with `freeTile`): new object char `Ø` ... use a `big` entry `{t:"obelisk", x:24, y:18}` (like `spirit`/`fountain`,
  1x1 solid, art in `scene2d` code-drawn 3-tile pillar with violet glow) and NPC `dimkeeper` "균열 지기 오르카"
  (`role:"dim"`) at (23,19). NPC role `dim` is a new role handled in `70-validate`/`75-apply` + client talk window.
  Both are added by `buildTown()` so editor-data towns that `replace` town must add them via `npcs.json`.
- Opening: only the **party leader** (`party.leader`; a lone player may open solo, uses a "solo" party of 1)
  within 80 px of the obelisk/NPC: action `{t:"dim_open", lv?}` (lv optional, defaults to leader's level clamp;
  future difficulty). Validation messages (Korean): not leader "파티장만 균열을 열 수 있습니다.", too far, a ready
  check running "이미 준비 확인 중입니다.", cap reached, someone in the party not in town -> they are simply not
  asked (listed as "마을 밖"), minimum 1 accepted.
- Ready check: `party.rc = {id, seed, lv, theme, until: now+20000, resp:{pid: 0|1|2}}` (0 pending, 1 yes, 2 no/timeout).
  Sent to all party members **in town map** within the town (`p.map==="town"`). Wire: snapshot field `rc`
  `[id, secsLeft, [[eid, name, state]…], seedHint]` appended to `self`/snap only while active, plus `rc:0` once to
  close. Client: modal "차원 균열 입장 준비 — 수락/거절 (20초)" with member list ticks; buttons send `{t:"dim_ready", id, ok:1|0}`;
  validate: id matches, still pending, player in town. Everyone responded yes OR timeout -> **start** with the
  accepting set (>=1); a decline from any member does **not** cancel for others (the leader may cancel with
  `dim_cancel`). Non-accepting members stay in town, toast "차원 균열 입장을 거절/시간 초과" and the obelisk shows
  "합류" later (D.3). Leader disconnect during RC -> cancel. Party change during RC (leave/kick) -> removes them.
- Entering together: `startDim`: seed = `hash(S.seed, S.nextId++, party.id, now>>10)` (deterministic given room
  state; stored in `dim.seed`; same seed for everyone because one instance), `dimension({seed,theme,lv})`,
  register `S.dims["dim:n"]`, `changeMap(S, p, id, x, y)` for each accepter placed on distinct open tiles in the start
  room around `dim.start` (spiral, `canStand`), `p.sendMap = true` already makes the map payload go out.
- Return: portal / recall / leaving by `dim_leave` action -> `changeMap` to town landing tile beside the obelisk
  (`TOWN_DIM_LANDING`). Death returns to the start room as in D.3.

### D.8 Wire additions (compact, appended; client decoder `onSnap` updated in the same change)

- `out.dim` **only while in an instance**, array: `[prog100 (0..1000 int), secsLeft, state(0 run,1 boss,2 clear,3 fail),
  bossMobId|0, lvl, [[eid,hp%,alive,gotOrb]…] (party, optional every 1 s), pylons:[[id,kind,x,y,secs]…], orbs:[[id,x,y]…], portal:[x,y]|0]`.
  Pylons/orbs only when changed (`rt.dimDirty`), progress each tick only if it changed.
- `out.rc` while a ready check is active (above).
- `defs()` gets `dim:{themes, pylonKinds:{kind:[name,secs]}, limit, capParty}`; text names in Korean.
- Events through `rt.ev`: reuse ev codes 40..75 for skills; **new**: `["dm", kind, x, y]` for progress orb pickup/pylon
  activation, `["dp", 1000]` portal opened; decoded in `client.js` event switch.
- Self payload: `dimNow` (is in an instance) not needed; `ch.dim` daily count sent in `self`.

### D.9 Client UI

| piece | file | notes |
| --- | --- | --- |
| ready-check modal | `index.html` `#w-rc` section.window, `client.js renderRc()` registered in `refreshUi`, hotkey none (opens on event), `hud.css` | sounds `rc_ping`, member chips |
| rift HUD (top-centre gauge bar, % text, timer, party chips) | `client.js renderDim()`, `hud.css`, `index.html #dim-hud` | hidden outside `dim` |
| boss bar | `renderDim()` uses `M` entry of `dim[3]` | |
| obelisk art | `scene2d.js` (code-drawn big entry), glow in `sky.js` night grade | |
| pylons / orbs / portal | `scene2d.js` + `decor.js` (draw lists keyed by `dim` block) | |
| talk window for `dimkeeper` | `client.js` talk handler for `role:"dim"` (open/ready buttons, join) | |
| sounds | `audio.js SFX`: `rc_ping`, `dim_orb`, `dim_pylon`, `dim_boss`, `dim_clear`; music track `TRACKS.dim` (dark, driving) for `m.bgm:"dim"` | music = `bgm` in generated cfg |
| minimap | `renderMini` works from `g/o`; mark boss room after `prog>=100` | |

### D.10 Coexisting with 균열 침공 (world event)

They share nothing but the name root: `S.evt` keeps running in hunting maps; instances `dim:*` are never selected by
`evtMap` (`EVT_MAPS` is built from `MAP_META.hunting`). A party inside a dimension does not get invasion
toasts (`sys()` chat lines are global; the invasion warning is fine to show). Cosmetic source `rift` (invasion)
stays; add `dim` source separately. Achievements/dailies (optional hooks): `ch.st.dim` counter, achievement
"차원 탐험가 (10회)", daily task kind `dim` ("차원 균열 1회 클리어") — each is one entry in `ACH` / `dailyText`.

## E. Work split

### Phase 0 — foundation (ONE agent, ~1-1.5 days). Owner of: `34-maps-world.js` (registry), `36-custom-maps.js`, `40-characters-world.js`
(`setup`, `runtime`, `changeMap`, `addPlayer`), `80-simulation.js` (`tick` loops, cells), `90-views-api.js`, `60-content.js` (derived globals),
`public/iso_ground.js` `scene2d.js` (chunked bake), `client.js` (RLE decode if done).
Deliver, in this order, each with tests green and committed separately:
1. `MAP_META`, `mapOf`, `mapOfS`, `allMaps`, `arrivalOf`, lazy `runtime(S,id)`; convert every `MAPS[x]`; `tests`: all
   existing tests pass with `allMaps()`; new `tests/maps.mjs` budget rules; `S.dims` stub empty; `liveMapIds(S)`.
2. Cells: `buildCells(m)` (legacy: one zone 1 with the old spawn boxes; behaviour parity within tolerance), `rt.cells`,
   `wakeCells/sleepCells`, density multiplier; new `tests/cells.mjs` (spawn out of sight, determinism, farming cannot
   reset by walking away, fixed spawns persist, party density 1.5x, awake cap).
3. Chunked ground bake on the client (`bakeChunk`, LRU), pixel-identical test page, log `ms`/memory; `isoMini` scale.
4. Sheet changes owned by Phase 0 only: bump `v` once (`ch.wp` per-stone, `ch.dim` default) so phases 1/2 do not both
   touch `migrate`. Old-sheet test in `content.mjs`.
Contracts frozen by Phase 0:
```js
mapOf(id) -> Map|null ; mapOfS(S,id) -> Map|null ; allMaps() -> {id:Map} ; liveMapIds(S) -> string[]
runtime(S,id) -> rt   // creates on first use; for "dim:*" requires S.dims[id]
buildCells(m) -> void  // fills m.cells {cw,ch,spawns:[], zone:Uint8Array|null}; called by mapOf; generators may set m.zone first
registerDim(S,{id,map,party,seed,lv,theme,expire}) -> dim  // adds S.dims[id], S.maps[id] via runtime
closeDim(S,id) -> void
WAKE_R=3 CELL=16 WAKE_MAX_MOBS=230   // constants in 10-tables-like part
```
Rule: no one else touches `MAPS`/`setup` after Phase 0 merges.

### Phase 1 — 4x expansion (agent A). Owner: `30-maps-overworld.js`, `32-maps-underground.js`, `34-maps-world.js buildMaps()`
cfg (not the registry), `10-tables.js` `DENSITY`, `public/decor.js` (zone landmarks), `art.js` (minimap tint) and the waypoint/wind-shrine pieces
(`markRoutes`, new object char + client art).
Delivers: C.1-C.3: cfg doubling, zone bands (`m.zone`), hidden pockets, 2-3 waypoints, wind shrine, signs; tests in
`tests/maps.mjs` (zones, connectivity at 4x, determinism, per-map build < 150 ms), `world.mjs` fixes. Allowed
parallel to Phase 2 because it touches generators/cfg only; the interface is `m.zone`/`m.cells` from Phase 0.
Hard-stop: if a generator cannot be doubled without a new algorithm, keep it at 1.5x and report.

### Phase 2 — 차원 균열 (agent B). Owner: new `31-maps-dim.js`, new `64-dim.js` (manager: open/ready-check/progress/pylons/
boss/chest/portal/cleanup), `70-validate.js`/`75-apply.js` (cases `dim_open dim_ready dim_cancel dim_leave dim_join`; **append only,
new cases at the end of the switch**), `62-side-quests.js` untouched, `00-header.js`/`10-tables.js` `DIM` table (append), `buildTown()` obelisk/NPC
(one block), `public/` new `dim.js` (HUD/modal/render of pylons) + hooks in `client.js` (`onSnap` `dim`/`rc`, 3 lines) and `scene2d.js`
(draw lists), `index.html` windows, `audio.js` SFX, `hud.css`.
Actions (all server-validated, Korean errors):

| action | by | validation | effect |
| --- | --- | --- | --- |
| `dim_open` | leader (or solo) in town near obelisk | party.rc none, cap `DIM_MAX`, not in instance | creates ready check |
| `dim_ready {id, ok}` | any member in town | rc id matches, pending | marks; may start |
| `dim_cancel` | leader | rc active | closes rc |
| `dim_leave` | member in `dim:*` | in instance | town landing |
| `dim_join` | member of a running instance's party, in town | `dim.state==="run"`, `rt.n<4` | enters |

Tests (new `tests/dim.mjs`): (1) generator determinism over 200 seeds x themes, connectivity, caps, build ms;
(2) full clear sim with a 4-bot party (use the `tests/hard.mjs` bot style: bots auto-attack nearest mob, walk to boss
room) — clear time in simulated ms must be 5-10 min with level-matched bots, boss spawns exactly once at 100,
chest + portal appear, payout once per member, instance closed after 90 s; (3) ready check: leader-only, decline,
timeout, member leaves/disconnect during RC, party of 1, member outside town, double accept, id mismatch,
cap refusal; (4) cleanup: empty instance reaped in 20 s, restart sends players to town (`exportChar` rewrite),
`S.maps` has no `dim:*` leftovers, never > `DIM_MAX`; (5) coexistence: invasion event runs while an instance is
open and ignores `dim:*`; (6) wire compactness: steady `dim` block <= 120 B average.

### Merge order and conflict map

| step | who | blocks |
| --- | --- | --- |
| 0.1 registry + `mapOfS` | Phase 0 | everything (Phase 2 may stub `registerDim` locally until merged) |
| 0.2 cells, 0.3 chunked bake, 0.4 sheet v bump | Phase 0 | Phase 1 needs 0.2 for `m.cells`; Phase 2 needs 0.1 and 0.4 |
| 1 | Phase 1 | independent after 0.2 |
| 2 | Phase 2 | independent after 0.1; UI work can start on Phase 0 day 1 (pure client + stubbed `dim`) |
Shared hot files: `70-validate.js`/`75-apply.js` (Phase 2 appends cases only), `client.js` (`onSnap`: Phase 2 appends; Phase 0 touches map-load
only), `buildTown()` (Phase 2 only), `10-tables.js` (each appends their own block). Always `npm run build:logic` and commit parts + `logic.js` together; resolve
`logic.js` conflicts by rebuilding. Bump `?v=` at every public change (rule 8). Update the AGENTS.md file map when `31-maps-dim.js`, `64-dim.js`, `dim.js`
are added (same commit).

### Open points for the owner / other roles (decide before Phase 2 tuning)

- Reward economics and level-clamp rules (economy-designer); the number `+0.9/+4/+3` and 15-min limit are first guesses, the bot test measures clear time
  and the numbers are tunable in the `DIM` table.
- Should the cell system ever disappear mobs killed by the player's own "farming" (anti-AFK)? Default: no, sleep only.
- Client chunk bake time at 4x has not been measured in a browser (no Playwright in this sandbox); Phase 0 must record real `bake().ms` at 1x and 4x
  before choosing between chunking only vs chunking + Worker-side pre-baked tiles.

---------------------------------------------------------------------------------------------------------------

## F. Phase 0 — as built (notes for Phases 1 and 2)

### F.1 Lazy map registry (step 0.1, done)

Where: `34-maps-world.js` (`GEN`, `GATE_LINKS`, `gateDoors`, `crowdUp`, `genMap`), `36-custom-maps.js` (registry),
`40-characters-world.js` (`runtime`, `liveMapIds`, `registerDim`, `closeDim`). The `MAPS` table is gone (no proxy left).

- `GEN[id] = {make, band, cfg(), theme?, kinds?, after?, npcs?}` replaces `buildMaps()`. `cfg()` is a function so each
  build starts from a fresh settings object. Phase 1 edits sizes/counts in `cfg()` only; `band` lives beside it.
- `MAP_META[id] = {id, name, theme, band, safe, w, h, wp, kinds, eager}` in a fixed order (`BUILTIN_MAPS` then
  editor-only maps). Generated maps take it from `GEN` without building; eager maps (town + every `data/maps` file,
  replacements included) from their built geometry. `kinds` = every monster kind the map places (cfg `mobs`,
  `pondMob`, `guard`, `lair`, `vaultMobs`, `boss`, `chest`, + `GEN.kinds`); `tests/maps.mjs` asserts each meta field
  equals the built map, so a generator change that adds a kind must add it to cfg (or `GEN.kinds`).
- `mapOf(id)`, `mapOfS(S,id)`, `allMaps()`, `hasWp(id)` (no build), `wpOf(id)` (builds), `arrivalOf(S, portal)`.
  Generated doors are `{x, y, to, gate, k}`; editor/links doors `{x, y, to, tx, ty}`; `arrivalOf` resolves the
  landing tile on first use (gate's arrival tile → the tile itself → nearest reachable → `entry`) and memoises
  `tx, ty, ok` on the door. `allMaps()` and `atlas()` resolve every door (tools see `tx/ty` as before).
- `runtime(S,id)` creates `S.maps[id]` on first use (fires lit, spawns placed); `setup()` creates only the town.
  `tick` loops `liveMapIds(S)` (= `Object.keys(S.maps)`, wake order; deterministic for a given history).
  `S.dims = {}`; `registerDim(S, {id:"dim:<n>", map, party, seed, lv, theme, expire})` sets `map.id = id`,
  registers, creates the runtime and returns `{id, seed, map, party, theme, lv, born, expire, state:"run", rt}`;
  refuses ids that exist or are in `MAP_META`. `closeDim(S,id)` moves anyone inside to `START`, clears
  `party.dim`, deletes `S.maps[id]`, `S.dims[id]`, `FIRES[id]`, `WP[id]`. `exportChar` saves a player inside an
  instance as standing at `START`; `addPlayer` sends an unknown `ch.map` to town.
- Camps: `CAMPS` is gone; `campsOf(m)` memoises on `m.camps` (works for instances). Weather reads `MAP_META`
  (an instance has none → `-1`, underground). Door labels in `mapPayload` read `MAP_META`, never the target map.
- `NPC_MAP` / `NPC_NAME` are static (eager maps' people, `GEN.npcs`, `data/npcs.json`); `npcName` never builds.
- Exports added for tests: `runtime`, `mapStats()` (`{built, meta}`), `atlas(fresh, ids)` (fresh build of only `ids`).
- Deviations: (1) collection lists (`COL_MOBS`), `HUNTED` and `defs().maps[].mobs` are in cfg order (was first-spawn
  order), same sets. (2) A door into a map an editor file `replaces` lands on that map's entrance (the replaced
  geometry's gate is not built), as B.4a allows. Everything else is identical: a dump of every map (g, o, spawns,
  marks, npcs, big, reach, fires, waypoints, resolved doors, `mapPayload`) before/after is byte-identical.
- Measured (node 22, this container, cold process): module load **194-238 ms → 22-29 ms**; `setup()` 5 ms → 0.3 ms
  (town only). First entry (build + runtime, cold): meadow 44-53 ms, forest 26-34, maple 25, cave 19-26, crypt
  12-14, city 8-12, sewer 6-8, abyss 9-13 ms. `tests/maps.mjs` budgets: each map `< 150 ms`, eager maps `< 100 ms`,
  load `< 1000 ms`.

### F.2 Active-area cells (step 0.2, done)

Where: constants after `DENSITY` in `10-tables.js`; `buildCells(m)` in `36-custom-maps.js` (called by `finishMap`, so
every built map has `m.cells`; `runtime()` builds them for an instance map that lacks them); slots in `runtime()`
(`40`); `placeAway / crowdTo / sleepCell / cellPass` in `80-simulation.js` (start of each live map's tick); the kill
hook in `killMob` (`50`).

- `m.cells = {cw, ch, spawns, fixed, open, zone}`: `spawns[cell] = [{k, n, ep, r, zone}]` (box clipped to the cell;
  every old spawn box shared out over its cells by walkable tiles, largest remainder), `fixed` = spawns that never
  sleep (`MOBS.chest`, `MOBS.boss`, any `sp.el`: chests, bosses, guardians, the maple lair guard), `open[cell]` walkable
  tiles, `zone` = `m.zone` if the generator set one (each quota takes the zone of its box centre; else 1).
  **Phase 1**: set `m.zone` in the generator and/or rewrite the quotas in `buildCells` from zones (C.5); keep the
  entry shape. A cell with no quota never wakes (safe plaza = give it none).
- `rt.cells` (Uint8Array awake), `rt.slots[cell] = [{q, c, mob, due, extra}]` (one per monster the cell should
  hold; `rt.base[cell]` of them permanent), `rt.lastKill[cell]`, `rt.cellAt`. A cell monster has `mob.slot`; when it
  dies its slot gets `due = respAt` (today's per-kind respawn time) and the dead body leaves `rt.mobs`
  (`mob.cellGone`). Fixed and `temp` monsters keep the old path (`placeMob` at `respAt` / spliced when dead).
- `cellPass` every `CELL_PASS_MS = 500` on a map with players: wake at `≤ WAKE_R = 3`, sleep at `> SLEEP_R = 5`
  (Chebyshev, living players only); density `crowdTo` = `round(base × min(1.5, 0.75 + 0.25 × players within
  WAKE_R))` (extra slots are added, empty extras dropped; base slots never); waves every `WAVE_MS` per player
  (`p.wave`); then fill empty slots whose `due` passed, nearest cells first, at a random walkable tile of the
  quota box `≥ SPAWN_MIN_D = 14` tiles from every living player (24 tries, else next pass), until
  `WAKE_MAX_MOBS = 230` standing (fixed + cell monsters). Sleeping: calm monsters (no `tgt`, no `act`) leave
  (their slot ready at once on wake); empty slots `due = max(due, lastKill + CELL_RESPAWN_MS)`; a fighting monster
  stays until a later pass finds it calm. New mobs get new ids (no `"r"` event: they appear out of sight).
- Observed at 1x: a 76 × 51 map is 5 × 4 cells, so one player wakes almost all of it and nothing ever sleeps
  (max distance 4 ≤ `SLEEP_R`). The visible change at 1x is the out-of-sight rule: arriving players see an empty
  14-tile ring that fills behind them as they walk; with many players spread over one 1x map fewer slots find a
  spot (bench: 40 spread players on the meadow → 122 standing vs 230 for 4). Phase 1's 4x maps remove both effects.
  With 4+ players near, a 1x map now holds up to 230 (cap) instead of ≈ 200.
- Tick cost (node 22, 600 frames, players wandering): 160 × 112 field, 840 quota: 4/20/40 players → tick
  0.05/0.05/0.06 ms, `viewFor` for all 0.04/0.09/0.18 ms; 1x meadow: tick 0.08/0.29/0.21 ms.
- Tests: `tests/cells.mjs` (cells and fixed split, fixed present before any wake, out of sight + only near the
  living, replay determinism, farmed cell not reset by walking away, sleeping cell keeps its places and refills at
  once, party ×1.5, cap 230 nearest-first, waves). Bot tests now walk a BFS path (`sim`), borrowed test monsters
  drop their slot (`hard`, `hotbar`), and helpers tick once so the cells fill (`loot`, `data`, `daynight`).

### F.3 Chunked client baking (step 0.3, done)

Where: `iso_ground.js` (`bakeRect`, `bake`, `bakeChunk`, `groundSize`; per-map precompute `prep` in a WeakMap),
`isotiles.js` (`CHUNK_AREA`, `chunked`, `groundChunks`), `scene2d.js` (`drawGround`, `lazyTall`, `pulsePiece`/`pulsePart`,
`groundInfo`), `decor.js pulse(m, theme, part)`, `client.js isoMini`. Check: `node scripts/bake-check.mjs`
(`public/_chunks.html`; `--src` another payload file, e.g. a 4x dump).

- Chunks are **screen rectangles of the whole-map ground canvas**, `1024 × 512` px (not 32 × 32-tile squares: a
  tile-square chunk is a diamond on screen and would need masking; a rectangle blits directly). A chunk is baked
  over its rectangle + a 48 px apron: every tile whose diamond touches the buffer goes through the same tile pass,
  every upright detail/glint/bridge face whose tile is within 40 px is stamped in the same global order (all
  writes are bounds-checked; reads of the bridge column too), then the inner rectangle is cropped. **Pixel-identical**
  to the whole bake on every 1x map (9/9) and on a 4x dump of all 8 hunting grounds (both water frames), and the
  glow layer (below) is identical too.
- `scene2d`: maps with `w × h > 80 × 60` (or `?chunks=1` / `globalThis.__chunks`) use chunks: the visible ones are
  baked on the spot, then one more within 192 px of the view per frame (nearest first); LRU of 12 (a dropped chunk's
  canvases are zeroed at once). Town, interiors, editor maps and today's 1x hunting grounds keep the single bake.
- Two more whole-map costs found while profiling, fixed for chunked maps only (1x untouched):
  1. the flat fallback ground (`paintGround` + `toIso`, ≈ 4 Mpx + 2 Mpx canvases at 1x) was built and thrown away on
     every load; now only when isotiles fails.
  2. the deep places' glow layer (`DC.pulse`, cave/abyss/sewer/crypt) is a whole-map world-pixel canvas — at 4x
     abyss 4864 × 3840 = **18.7 Mpx, over iOS Safari's 16.7 Mpx limit**. Chunked maps make it in 1024 × 512 pieces
     (`pulsePiece`: the world pixels under the piece, laid flat with the same matrix), LRU 12, empty pieces cached.
  3. the per-tile statics pass called `IT.tallAt` (one canvas per wall/cliff/rock tile) for the whole map: on chunked
     maps walls, cliffs, hedges and rock are placeholders resolved when within 160 px of the view (and up to 16 per
     frame within 448 px). Everything else (trees, houses, signs, lights) is still built whole-map at load.
- `isoMini`: `renderMini(m, s)` with `s = m.w > 100 ? 2 : 4`, same diamond size.
- Measured (headless Chromium 1920 × 1080, `Z = 2` → 960 × 540 view; "cold" = fresh page):

  | | 1x (today) | 4x dump (152 × 102 …) |
  | --- | --- | --- |
  | whole bake, warm page | meadow 153-220 ms, others 64-167 ms | 253-659 ms (abyss 659, maple 515) |
  | whole canvases (2 frames) | 13.5-18.5 MB (+ ≈ 2x transient buffers) | 53-73 MB (+ transient) |
  | one chunk (warm / cold) | 23-40 ms / ≤ 110 ms | 12-50 ms typ., max 105 ms / ≤ 170 ms |
  | chunk memory | 4 MB each; arrival bakes the 2-4 on screen; ≤ 12 kept = ≤ 48 MB | same |
  | `loadMap` total, cold page | whole 377-489 ms → chunked 109-134 ms | chunked 153-191 ms (was 316-459 before lazy walls) |
  | `loadMap` warm (2nd load) | 9-22 ms chunked | 29-53 ms chunked (tiles pass 18-34 ms; was 176-192) |
  | steady render per frame | 1.0-1.4 ms both ways | 1.2-2.3 ms |

  At 4x, arrival costs ≈ 2-4 chunks (≈ 60-160 ms) instead of a 250-660 ms whole bake, and ground memory is the kept
  chunks (≤ 48 MB, typically 6-9 = 24-36 MB) instead of 53-73 MB + transient. Decision on the open point: **chunking
  only**; no Worker-side pre-baked tiles needed. A cold first chunk can take 100-170 ms (JIT warm-up); a 1-chunk
  per frame prefetch is a ≈ 25-40 ms hitch while walking into new ground — move it to `requestIdleCallback` if felt.
- Not done (deviation from B.4c): payload row RLE. The 4x dump's payloads are 27-40 KB (over the 25 KB trigger), but
  the B.4c form (`[char, count, …]` per row when shorter) measured only 3-8 % smaller on the overworld (meadow 33.6 →
  32.3 KB, city 39.8 → 36.6) and 30-40 % on dungeons (abyss 37.0 → 21.9, sewer 31.6 → 18.7): 266 → 216 KB for all
  eight, not the 3-5x expected. Sent once per map entry, never per tick, so it is left out of the wire for now;
  Phase 1 can add it in `viewFor` (`out.map` only; `mapPayload` stays plain for the tools) + `client.js loadMap`.

### F.4 Sheet v9 (step 0.4, done)

- `ch.wp` is `{ mapId: bitmask }` (bit `i` = stone `i` of that map; `WP_MASK = 0xff`, at most 8 stones per map). `migrate`:
  an old list → each listed map with a stone gets `1`; an object → masked, unknown maps and empty masks dropped;
  `town` always has bit 0. Helpers in `36`: `wpWoken(ch, id, i = 0)`, `wpCount(ch)`. `explore` wakes bit 0; the `warp`
  action checks bit 0; achievements `wp3` = 3 stones, `wpall` = stone 0 of every map with `MAP_META.wp` (was
  `Object.keys(WP)`, which with lazy maps would have counted only built maps).
- Wire: `self.wp` is the same object. `client.js wpWoke(s, id, i = 0)`, `scene2d wpLit` read it.
- `ch.dim = { day, n }` (default `{0, 0}`, clamped) for Phase 2's daily count. `v = 9`. Tests: `content.mjs` (v8 → v9,
  messy v9 masks, warp needs stone 0), `data.mjs` (v7 → 9).
- **Phase 1**: more stones = more bits in `WP[id]` (make it a list) + `warp {to, i}` + `explore` waking the right bit;
  no further sheet bump needed. **Phase 2**: `ch.dim` exists; no sheet bump needed.

### F.5 What Phases 1 and 2 can rely on now

- Frozen contracts (E) exist as written: `mapOf`, `mapOfS`, `allMaps`, `liveMapIds`, `runtime`, `buildCells` (fills
  `m.cells = {cw, ch, spawns, fixed, open, zone}` — `fixed`/`open` added), `registerDim`, `closeDim`, `WAKE_R CELL
  WAKE_MAX_MOBS` (+ `SLEEP_R SPAWN_MIN_D CELL_RESPAWN_MS CELL_PASS_MS DENSITY_MAX WAVE_*`). No `MAPS` anywhere.
- Phase 1: change sizes and counts in `GEN[id].cfg()` only (and `band` beside it); a new monster kind placed by a
  generator must be listed in its cfg (or `GEN.kinds`), `tests/maps.mjs` checks. Set `m.zone` in the generator and
  turn zones into quotas in `buildCells` (keep the entry shape). Per-map build budget 150 ms is asserted; the 4x dump
  built meadow in 142 ms cold, so watch it. Waypoints: `WP[id]` + bits in `ch.wp` (F.4). The client is ready for 4x:
  chunked ground, glow pieces and lazy walls kick in above 80 × 60 tiles by themselves.
- Phase 2: build the instance map, `finalize` it, `registerDim(S, {id: "dim:<n>", map, party, seed, lv, theme,
  expire})`, then `changeMap(S, p, id, x, y)`; place packs straight into `dim.rt.mobs` (an instance map with empty
  `spawns` has no cells; `runtime` builds empty ones). `exportChar` already saves anyone inside as in town;
  `closeDim` already returns them, clears `party.dim` and frees everything. `ch.dim = {day, n}` exists.
  `weatherAt` treats instances as underground; `mapPayload` labels doors from `MAP_META`, so an instance's door to
  town reads "넥서스 광장".
- Verified live (wrangler dev + `shot.mjs --live`): log in, walk town → meadow (monsters about) → forest through the
  gates, no page or worker errors.
---------------------------------------------------------------------------------------------------------------

## G. Phase 1 — as built (4× hunting grounds)

Where: new part `33-maps-zones.js` (`zoneMap`, `zoneSpawns`, waypoint keys, `windTouch`), `34-maps-world.js` (`GEN`
sizes/counts and `stones`, `genMap` calls the zoning, `markRoutes` places the extra stones, shrines, plaza fire and zone
signs), small hooks in `36` (`MAP_META.wpn`, editor `stones`/`shrines`, quota `zone`), `40` (`migrate`, `addPlayer`,
speed), `60`/`70`/`75` (stones and `warp`), `80` (`placeAway` zone, `windTouch`), `90` (`buffs[10]`, `defs.waypoints`).
Client: `client.js` (warp window, `wd` event, buff), `scene2d.js` (shrine art), `art.js` (minimap tint), `uiicons.js`.

### G.1 Sizes and counts (measured, node 22, this container)

| map | before (w×h, reachable) | after (w×h, reachable) | cfg changes | D (walk) | safe/normal/elite/hidden tiles | pockets | cell quota (normal+elite) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| meadow | 76×51, 2402 | 152×102, 10583 | vaults 3→9, lakes 2→4, ruins 1→3 | 231 | 252/7020/3038/273 | 4 | 703 |
| forest | 76×51, 2297 | 152×102, 10291 | vaults 3→9, ruins 2→5, lakes 1→2 | 251 | 483/6837/2707/264 | 3 | 694 |
| crypt | 66×51, 1085 | 132×102, 4779 | leaf 150→300 | 379 | 461/2948/782/588 | 5 | 613 |
| city | 76×51, 2066 | 152×102, 8103 | size only (metro subdivides by itself) | 277 | 214/5427/2233/229 | 3 | 640 |
| sewer | 76×51, 1145 | 152×102, 5504 | size only | 352 | 239/3504/1336/425 | 5 | 696 |
| cave | 66×50, 1407 | 132×100, 6266 | vaults 4→10 | 225 | 260/4121/1753/132 | 5 | 545 |
| abyss | 76×60, 1256 | 152×120, 6507 | size only (boss arena keeps its far place) | 371 | 379/3960/1339/829 | 5 | 682 |
| maple | 80×56, 2704 | 160×112, 12152 | vaults 4→10, ruins 2→4, lakes 1→2 | 463 | 445/8113/3468/126 | 2 | 867 |

Every map: 3 waypoint stones, 2 wind shrines, a plaza fire beside the first stone plus the generator's camp, an "엘리트
지대" sign, a "수상한 샛길" sign at the pockets' mouths. `n` of the underground generators (a per-room count) was left as
is: `zoneSpawns` recomputes every count. No generator needed a new algorithm (no 1.5× fallback).

### G.2 Budgets (measured)

| item | value |
| --- | --- |
| module load | 20-28 ms (unchanged; nothing generated at load) |
| build, warm (tests/maps.mjs) | meadow 86, forest 65, crypt 60, city 35, sewer 61, cave 80, abyss 57, maple 92 ms (budget < 150) |
| first entry, cold process (`runtime()` on a fresh isolate: JIT cold) | meadow 138, forest 131, crypt 90, city 79, sewer 84, cave 107, abyss 85, maple 129 ms — one alarm tick stall per map per isolate |
| zoning + spawns (`zoneMap` + `zoneSpawns`) | 2-20 ms of that (crypt slowest: many chest pocket searches; first ones JIT-cold) |
| `mapPayload` JSON | 28-41 KB per 4× map (city 41.1, abyss 38.5, maple 37.9, meadow 35.0); town 5.4 KB. `zq` adds ≈ 1 KB. RLE (B.4c) not done |
| awake monsters | one hunter at an entrance: 230 (the cap) after 1.5 s on every map but the crypt (207), none in the plaza: `WAKE_R` 3 cells is 112 × 112 tiles, most of a 4× map, so the cap (nearest cells first) is what bounds it |
| client ground bake | before chunking landed (headless Chromium, whole bake of the real 4× maps): 2 frames 4064×2056 (meadow/forest/city/sewer, 64 MB), 3744×1896 (crypt 54 MB), 3712×1880 (cave 53 MB), 4352×2200 (abyss/maple 73 MB); `bakeGround` 244-535 ms; whole `loadMap` 0.7-1.2 s. With F.3's chunks (maps > 80×60 chunk by themselves) arrival is 2-4 chunks and ≤ 48 MB — the F.3 table holds for these maps (it was measured on a 4× dump of the same sizes) |

### G.3 Deviations from C (decided while building)

1. **Stones on the v9 sheet (F.4).** `ch.wp[id]` bit `i` = stone `i`; `explore` wakes the bit of the stone you stand
   by, `warp {to, i?}` checks it; `migrate` also drops bits past the map's `MAP_META[id].wpn` (known without
   building). `WP[id]` stays the first stone (boss spot and editor code read it) instead of becoming a list;
   every stone is in `m.stones` (`{x, y, ax, ay, i}`, `stonesOf(m)`). A warp to another stone of the same map moves
   the player without resending the map. `defs().waypoints[]` gained `n` and `names` (입구 · 중턱 · 안쪽);
   `wpall` still asks for stone 0 of every map.
2. **Elite share.** 0.55 D alone made 40-60% of a map elite (most ground lies deep): elite now starts at
   `max(0.55 D, the walk beyond which only ELITE_SHARE = 30% of the ground lies)`. The doc's 0.85 D upper cut is gone:
   everything past the elite cut that is not a pocket is elite.
3. **Hidden pockets** are found from the chests, not from region leaves (works for every generator): from a chest, the
   largest dead end round it (`{tiles walked further than L}` connected to the chest) whose mouth (tiles at exactly L)
   is ≤ 3 tiles wide and that holds 10-260 tiles, no door, gate or fire; chest ≥ 0.3 D deep; at most 5 per map, deepest
   first. Other chests stay in the open with the colonies round them. Each pocket gets one fixed elite guardian
   (`el:1`, the generator's keeper kind there, else the roster kind for that depth) halfway between mouth and chest.
   The pocket sign is always there (no "after discovery" state).
4. **Safe ground** is also a 5-step ring round the arrival tiles of every gate someone can arrive by (not one-way
   exits: the crypt's guardian by its way out stays).
5. **Spawns**: `zoneSpawns` replaces the generator's roster spawns and the old crowd pass (`crowdUp`, `CROWD_MAX` are
   gone). Per 8×8 block and zone: `n = open tiles × ZONE_DENS / DENSITY` (carried over), kind = roster sorted by level,
   normal ground by progress through it (top 85% of the roster), elite ground the stronger half with `ep 0.35`; a
   block of ≥ 4 takes two neighbouring kinds. Chests, bosses, guards, the maple lair guard and its pack stay as the
   generator put them. Each quota carries `zone`; `placeAway` only uses tiles of that zone (no monster ever appears in
   the plaza or a pocket).
6. **질주의 바람** uses its own `p.wind` (×`WIND_K` 1.3, 20 s, 60 s per shrine per player, touched within 26 px), not
   `spdBuff` (×1.4, skills); the two do not stack (`spdBuff` wins). Wire: `self.buffs[10]`, event `["wd", eid, x, y]`.
7. **Minimap tint** (`mapPayload.zq`, one char per 4×4 block) is always shown for safe (cool) and elite (red);
   pockets are never tinted. Not gated by owning a stone.
8. **Editor format**: `stones` and `shrines` added (SCHEMA.md); `mapToEditor` also writes `spawns[].zone`, which an
   editor map ignores (editor maps are never zoned). Round trip test kept. The editor UI does not place stones or
   shrines yet: it keeps what the file has only if it keeps unknown fields.
9. **Migration**: `addPlayer` moves a sheet whose (x, y) is not standable or not reachable to that same map's entrance
   with the toast "지형이 넓어져 입구로 이동했습니다." (safe maps without the toast); `migrate` clamps x, y into the map.
10. **균열 침공 gathers at the middle stone (중턱)**, not the first (C.3 said stone 0). Seen live: a Lv.1 arriving in
    the meadow during an invasion died in the entrance plaza, where the first stone stands. Lead's decision: `evtStone(id)`
    = 1 on a map with ≥ 2 stones (else 0), `evtSpot` = that stone's arrival tile, so the plaza stays safe. The warning
    and start broadcasts name it ("[바람초원 · 중턱] 이동의 돌 곁으로 모이세요 — 깨운 돌이라면 어느 이동의 돌에서든
    건너갈 수 있습니다"); `self.evt` carries `st` / `nextSt` (the stone index) and its `name` is the stone's; clicking
    the event widget picks that stone in the warp window, or the first stone with a "walk on from the entrance" toast
    when the middle one is not woken yet. Test: `tests/scale.mjs` (broadcast, `st`, first wave around stone 1, none in
    the plaza).

### G.4 Known issues / left for others

- The minimap of a 4× map is shrunk into the same frame (half-scale `renderMini`, dots drawn 2× to stay readable).
- Payload 28-41 KB per arrival: acceptable per B.3; RLE left out (F.3 measured it saves little on the overworld).
- Cold first entry ≈ 80-140 ms per map per isolate (one tick late, once).
- The `wpall` achievement still means "the first stone of every map" (F.4's rule).
---------------------------------------------------------------------------------------------------------------

## H. Phase 2 — as built (차원 균열)

Where: `31-maps-dim.js` (`DIM` table — every number below lives there —, `DIM_THEMES`, `DIM_TOWN`, `dimPool`,
`dimension`), `64-dim.js` (manager, actions, wire), hooks: `dealMob` (`mob.hk`), `mobHit` (vamp heal ÷ `hk`, master's
`mob.ak`), `killMob` → `dimKill`, `lootFor` (gold ×`lootGold`), `stats().guard` (`p.dimWard`), `tick` → `dimTick`,
`viewFor` → `dimView`, `defs().dim`, `respawn` (validate wait / apply `dimRespawn`), actions appended as one block at
the end of the 70/75 switches. Town: `buildTown()` one block (obelisk `big` on an `a` tile at (24,18), keeper
`dimkeeper` role `dim` at (23,19), landing (22,18)); `NPC_ROLES` and the editor's `big` check accept them.
Client: `public/dimart.js` (obelisk, shrines, orb, way home, chest), `public/dimrift.js` (HUD, ready check, keeper
window, scene props, events, minimap marks), hooks in `client.js` (import, `WIN += dim rc`, `onSnap`, `onEvent`,
`interact`, minimap, render), `scene2d.js` (obelisk big piece), `audio.js` (`rc_ping dim_open dim_orb dim_pylon
dim_boss dim_clear dim_portal`, track `dim`), `index.html` (`#dim-hud #w-dim #w-rc`), `hud.css`. Sheet v9 (Phase 0 step 0.4):
`ch.dim = {day, n}`; counter `ch.st.dim` (through `dimCnt(ch)`; jobs-and-stats J1 renames counters); achievements
`dim1` 차원의 틈, `dim10` 차원 탐험가. Party level → instance level through `dimLvOf` (one place for J1's level change).

### H.1 Generator (deviations from D.2)
- Rooms on a jittered **4 × 3 grid** of 13 × 12-tile cells (7–9 rooms grown as a connected set, 7–11 × 6–9 each,
  shapes plain/cross/octagon/ell), random spanning tree over neighbouring cells + 1–2 loops, L-corridors 2–3 wide.
  Start = one end of the longest walk, master's hall = the largest room at ≥ 85% of it (both plain). 2–3 vaults
  (5–7 × 5–6) in free cells next to rooms ≥ 60% of the way, one corridor each: guardian elite + `chest_<theme>`.
- Way to the master: **52–100 tiles** (avg ≈ 65), not 70–110 (a 56 × 40 grid does not hold more); a layout under 52
  is laid out again from a derived seed (≤ 6 tries; still pure). Build: median 0.6 ms, max ≈ 12 ms (800 rifts).
- Pool: the theme's kinds within **[lv−3, lv+2]**, else the 4 kinds of all hunting grounds nearest lv−1 (lv 10 gets
  meadow/forest beasts in a crypt look; lv 45+ gets maple's). Master: the theme's field boss if within 6 levels, else
  the pool's toughest. Theme by level as planned.
- Packs 12–16 of 3–6 (≤ 70 normal), 1 elite per room not next to the start (2 in big rooms 40%), measured
  45–70 normal, 5–12 elites (avg 62 / 7.7). Monsters are `temp` (no respawn, no cells: `m.spawns` is empty).

### H.2 Gauge and toughness (tuned with the bot party; D.3 first guesses replaced)
- Kill +0.9, elite +4, orb +3 as planned, **scaled by `dim.gK = max(1, 118 / (0.9·N + 7·E))`** so a sparse layout can
  still reach 100% (one seed had only 75 points in it).
- Toughness is a **damage divisor `mob.hk`** (not an hp multiplier: the client's hp% stays right):
  `hk = (5.8 + 1.0 × max(0, 24 − lv)) × [0.35, 0.6, 0.8, 1][n−1] × (1 + 0.1 × max(0, lv−1 − mobLv))`. The doc's
  ×(1+0.25(n−1)) made a 4-party clear in **1.4–4 min**; with ×3–4 flat the low bands stayed fast and the high bands
  slow, hence the low-level term. The master: `hk × 0.6`, hits **×0.7** (`mob.ak`), **2 traits** (3 traits + full hp
  wiped every bot party: vamp healed by raw damage, so its heal is now ÷ `hk` too).
- Measured clears (4 bots, gear of their tier q1, no training; walk BFS paths, dodge ground rings, drink at 45%):
  | Lv | theme | master at | clear |
  | --- | --- | --- | --- |
  | 17 | crypt | 4.3 | 5.8 |
  | 24 | sewer | 4.6 | 5.6 |
  | 32 | cave | 4.6 | 5.6 |
  | 40 | cave | 7.1 | 8.4 |
  | extra seeds (`MORE=1`, before the last small tune): 14 6.6 · 20 8.9 · 28 5.7 · 36 7.0 · 44 9.4 · 17 6.0 · 32(abyss) 6.4 |
  Average 6.4 min (test: each 4.5–10.5, average 5.5–9). Solo bot at Lv.22: reaches the master at ≈ 6 min but does not
  kill it (it does not kite; 11 deaths) — measured, not asserted. Re-tune after J1 (stats rework) with
  `HPB= BOSSHP= BOSSATK= LVK= NOCLEAR=1 MORE=1 node tests/dimrift.mjs -v`.

### H.3 Rules that differ from D.3–D.7
- **A wipe does not fail the rift**: everyone gets up in the start room after **25 s** (no XP loss); only the clock
  (15 min) fails it (8 s later everyone is home with `lv × 30` gold). The dead cannot `dim_leave` (they get up first).
- Master spawn: ≥ 10 tiles from its hall → it walks 10 steps from the party toward the hall and lands ≥ 8 tiles away,
  but never within 12 tiles of the start room (where the fallen get up); else in its hall.
- The way home refuses anyone who earned a chest and has not opened it ("먼저 보상 상자를 여세요!").
- Chest: gold 60·lv, **xp 0.05 × xpNeed(lv)** (the plan's 0.5 contradicted its own "4–5% of a level"), rare gear,
  2 stones, rune 60%; full xp for the first 3 clears a day, then half. No new cosmetic source: the master's kill already
  rolls the `boss` source. Eligible: anyone who shared a kill inside or stood within party range of the master.
- Shrines: atk +25% (existing `atkBuff`), spd = the existing ×1.4 move buff, **shield = −25% damage taken**
  (`p.dimWard`), gauge = +30% MP and a full warrior grit / lancer focus. Reach 400 px, 30 s, 35% per elite, always 3rd/6th.
- Party leader = `party.m[0]` (parties have no leader field). A solo open skips the ready check.
- Joining (`dim_join`): anyone seen inside in the last 3 min, or anyone of the instance's party, while it runs, ≤ 4
  inside. Leaving (`dim_leave`, the start room's door, a recall scroll) lands beside the obelisk (the scroll: plaza).

### H.4 Wire as built (D.8)
- `dim` (only on change, `0` once on leaving): `[gauge×10, secs, state 0 run·1 master·2 cleared·3 failed, masterId,
  lv, [[eid, hp%, alive]…], [[id, kind, x, y, secs]…], [[id, x, y]…], [x,y]|0 way home, [x, y, 0 yours·1 opened·2 not
  yours]|0 chest, theme, [x, y]|0 master's hall (minimap), ward secs, revive wait secs]`; measured 19–43 B per snapshot
  averaged over a whole run (test asserts ≤ 120).
- `rc`: `[id, secs, [[eid, name, 0 asked·1 yes·2 no·3 away]…], lv, leader?]` (index 3 is the level, not a seed hint);
  `rc: 0` once when it ends. `dj` (new, in town): `[secs, inside, gauge×10, lv]` when a rift can be joined, `0` after.
- Events: `["dm", kind, x, y]` (orb, atk/spd/shield/gauge, chest, open, boss), `["dp", x, y]`, and new `["dz", id, x, y]`
  (a monster dissolving at 100%).
- `defs().dim = {themes, pylons, limit, party, max, rcMs, obelisk, reviveMs, near}`.

### H.5 Known issues / next
- Solo is very hard against the master (see H.2); consider an el-1 master for parties of one.
- `tests/dimrift.mjs` takes ≈ 8–9 s (the bot runs). Its pool depends on `MAP_META.kinds`: Phase 1 adding kinds may
  move clear times; rerun with `-v`.
- Editor towns that `replace` the town must place the obelisk (`big` `obelisk`) and an NPC with role `dim` themselves.
