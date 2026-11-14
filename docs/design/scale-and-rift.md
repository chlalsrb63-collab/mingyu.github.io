# 사냥터 4배 확장 + 파티 전용 「차원 균열」 던전 — 설계서

Status: Phase 0 in progress (see F. for what is built). Audience: two implementers working in parallel (Phase 1 / Phase 2) after one
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
