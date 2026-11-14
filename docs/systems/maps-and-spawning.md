# Maps, doors, zones and spawning

Purpose: how a map id becomes a built map, how doors/stones link maps, and how monsters appear
around players. Design background: `docs/design/scale-and-rift.md` (built; code is truth).
The town (`buildTown`) is being redesigned (`docs/design/town.md`): do not rely on its layout here.

## Key files / functions (all `game/src/logic/`)
| symbol (file) | role |
| --- | --- |
| `MAP_META` (36) | `{id,name,theme,band,safe,w,h,wp,wpn,kinds,eager}` for every map, filled at load from `GEN`/`DATA`; nothing generated. **Use it, never index maps directly** |
| `mapOf(id)` (36) | built map, cached in `MAP_CACHE`: `finishMap(EAGER[id] \|\| baseMap(id))`; null for unknown id. Town + editor maps are built at load (`EAGER`), generated grounds on first use |
| `mapOfS(S,id)` (36) | + runtime instances: `S.dims[id].map` (`dim:<n>`), `S.homes[id].map` (`house_<eid>`), else `mapOf`. Use it wherever a player's `p.map` may be an instance |
| `allMaps()` (36) | build everything + resolve all doors (tests/tools only) |
| `GEN` (34) | per generated map `{make, band, stones, theme?, kinds?, after?, npcs?, cfg()}`: meadow forest crypt city sewer cave abyss maple. `cfg()` has seed, `w h` (2× per side since Phase 1, ≈150×100), `mobs[]`, `chest`, features, gates. Generators: `wilds metro` (30), `tunnel cavern catacomb sewers abyssal` (32), `dimension` (31) |
| `genMap(id)` (34) | `g.make(cfg)` → `gateDoors` → `zoneMap` + `zoneSpawns` (33) → `markRoutes` (stones, wind shrines `/`, signs, plaza fire) → prune `pockets` |
| `baseMap(id)` (36) | editor file (`FILES[id]`, via `fromEditor`) → town (`buildTown`+`gateDoors`) → `genMap`. An editor map may `replaces` a built-in id (keeps generated `band`) |
| `finishMap(m)` (36) | lays editor `doors`, `DATA.links`, `DATA.npcs` over the map, `finalize`, `buildCells` |
| `GATE_LINKS` (34) | `[a, gateA, b, gateB, both]`; a door stores only the gate name, `arrivalOf(S,pt)` (36) finds the landing tile on first use (editor door: its `tx,ty`; nearest free tile; else `entry`) and caches `pt.tx/ty/ok` |
| `zoneMap`, `zoneSpawns`, `stonesOf`, `stoneName`, `windTouch` (33) | zones, colonies, stones, 질주의 바람 (`WIND_K` 1.3 ×, 20 s, per-shrine 60 s cd) |
| `buildCells(m)` (36) | `m.cells={cw,ch,spawns[cell],fixed,open,zone}`: each spawn box shared out over 16×16 cells by walkable tiles (largest remainder); chests/bosses/`sp.el` go to `fixed` |
| `runtime(S,id)` (40) | live state of a map in world `S` (`S.maps[id]`): `mobs drops ev fires props cells slots lastKill base …`; fixed mobs placed, one `slot` per cell quota monster (empty until woken) |
| `cellPass(S,m,rt,pids)` (80) | every `CELL_PASS_MS`=500 ms per occupied map: wake/sleep cells, crowd scaling, waves, fill slots |
| `registerDim/closeDim` (40), `homeTick` (64-housing) | instance lifecycle (`dim:<n>`, houses); `changeMap(S,p,to,x,y)` moves a player (drops aggro, `sendMap`, `explore`, side-quest visit) |
| `mapPayload(m)` (34) | what the client gets once per map change (`sendMap`): `g o big portals(to=label) npcs camps zq marks theme band` — no spawns, no cells |

## Data shapes
- Built map `m`: `id name w h g[][] o[][] (→ strings after finalize) theme band safe entry [x,y] gates{} portals[{x,y,to,gate?,k?,tx,ty,ok}] npcs spawns[{k,n,r:[x0,y0,x1,y1],zone,elite?}] reach solid cells zone zdist zinfo pockets stones[{x,y,ax,ay,i}] shrines marks`.
- Zones `Z_SAFE 0 / NORMAL 1 / ELITE 2 / HIDDEN 3` by BFS walk from the entrance: safe `ZONE_SAFE`=8 % of D (≥`SAFE_MIN` 10 tiles; side doors `GATE_SAFE` 5), elite from 55 % of D (≤30 % of ground), hidden = dead-end pockets (≤`POCKET_N` 5, chest + one guardian). `ZONE_DENS=[0,1,.6,0]`, `ZONE_EP` .35. Editor maps are never zoned.
- Waypoints: `ch.wp={mapId: bitmask}` (`WP_MASK` 0xff, bit i = stone i); `wpWoken`, `wpCount`; `STONE_NAMES` by count (입구/중턱/안쪽). `warp` action: must stand within `WP_R` of a stone (`wpNear`), stone woken, not in combat (`WARP_CALM`), `a.i` picks the stone; same-map warp is a step (no map resend). `explore` wakes the stone you stand beside. Recall scroll (`RECALL_MS`) → town.
- Cell constants (10-tables): `CELL 16, WAKE_R 3, SLEEP_R 5, WAKE_MAX_MOBS 230, SPAWN_MIN_D 14, CELL_RESPAWN_MS 25000, DENSITY_MAX 1.5, WAVE_MS 90000, WAVE_MOVE 8, WAVE_AHEAD 2, WAVE_K .25`; `DENSITY[mapId]` = walkable tiles per monster.

## Flow
1. Load: `MAP_META` built from `GEN` cfgs and `DATA` (editor maps/links/npcs from `game/data/**`, inserted by `build-logic.mjs` after 00-header); town + editor maps built.
2. A player steps on a portal tile (`mv` in 75-apply.js, <12 px) → `arrivalOf` → `changeMap` → `runtime(S,to)` (→ `mapOfS` → generates the map if first visit; → `buildCells`) → `sendMap` flag makes `viewFor` send `map` once.
3. Each tick `tick()` skips maps with `rt.n<=0` (frozen), else `cellPass`: cells within `WAKE_R` (Chebyshev, living players) wake; `crowdTo` sizes the crowd ×(0.75+0.25·players near, ≤1.5); cells beyond `SLEEP_R` of any player (dead count as holding) sleep — calm mobs removed, empty slots wait until last kill + 25 s; every 90 s a hunter who moved >8 tiles gets +25 % mobs 2 cells ahead; awake cells fill nearest-first via `placeAway` (≥14 tiles from everyone, same zone), never past 230 standing mobs.
4. `fixed` spawns (chests, bosses, guardians, placed elites) exist from `runtime()` and never sleep; field boss in `rt.fb`.
5. Instances: `registerDim` (rift, `dim:<n>` in `S.dims`) and homes (`S.homes`) have the same runtime shape; never in `MAP_META`, never saved (`exportChar` puts the player in town / house door).

## Client (public/)
`scene2d.loadMap` consumes `mapPayload`; ground is baked in `iso_ground.js`. Maps over `CHUNK_AREA`=80×60 tiles (`isotiles.chunked`) use `groundChunks` (1024×512 px chunks baked on demand, LRU `keep`=12, `bakeChunk` pixel-identical to whole `bake`; `?chunks=1` forces); interiors never. Minimap uses `zq`; `_chunks.html` + `scripts/bake-check.mjs` verify.

## Invariants / gotchas
- Generation is deterministic (seeded `cfg`); changing a seed/size moves every old sheet's position — `addPlayer` repositions to `entry` if the tile is no longer reachable.
- Never index `MAP_CACHE`/maps directly; a new place that needs a door needs `GATE_LINKS` (or editor link) AND `MAP_META` data (it comes from `GEN`).
- `m.o`/`m.g` are arrays of arrays until `finalize` joins rows: only `finishMap` and generators touch the array form.
- `door` labels come from `MAP_META` so describing a door never builds the neighbour.
- New spawn kind on a map ⇒ `GEN[id].cfg().mobs`; `MAP_META.kinds` follows (maps test checks meta ↔ built map).

## Tests
`maps.mjs` (generators, connectivity, determinism, build time, lazy registry, MAP_META ↔ built, instances, 4× sizes, zones, pockets, stones, shrines) · `cells.mjs` (wake/sleep, out of sight, farming, party density, cap, waves) · `scale.mjs` (stones + warp, wind shrine, old sheets moved, cells round the hunter) · `world.mjs` (map graph, dungeons, quests) · `data.mjs` (editor maps/links) · `dimrift.mjs` (instances) · `interiors.mjs`.
