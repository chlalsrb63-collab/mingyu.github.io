# 차원 균열 (party rift) and 균열 침공 (world event)

Purpose: two different systems that share the word "rift". **차원 균열** = a party's private timed
instance dungeon opened at the town obelisk. **균열 침공** = a half-hourly open-world event on one hunting ground.
Design doc (built, code is truth): `docs/design/scale-and-rift.md` D.

## 1. 차원 균열 — key files / functions (`game/src/logic/`)
| symbol (file) | role |
| --- | --- |
| `DIM` (31-maps-dim) | every balance number: `max` 4 instances per room, `party` 4, map `w h` 56×40, `limit` 15 min, `warn` 3 min, `emptyMs` 20 s, `portalMs` 90 s, `rcMs` 20 s; gauge `normal` .9 / `elite` 4 / `orb` 3 / `full` 118; shrines (`shrineP`, `shrineMs`, `pylons` atk/spd/shield/gauge); toughness `hpBase hpLow hpN lvK bossHp bossAtk`; `reviveMs`; `reward {gold:60·lv, xp, gearQ:3, stone:2, rune:.6}`, `dailyFull` 3, `failGold`, `lootGold` .5 |
| `DIM_THEMES`, `dimThemesFor(lv)`, `dimPool`, `dimBossKind`, `DIM_TOWN` (31) | looks (crypt/sewer/cave/abyss), mob pool (theme kinds within lv−3..lv+2 else nearest kinds), master (theme field boss else toughest), town obelisk/keeper/landing tiles (**town redesign may move these**) |
| `dimension(cfg)`/`dimBuild` (31) | pure seeded generator → finalized map + `m.dim={rooms,start,boss,bossRoom,dead,spawns[{k,n,at,room,el,guard?,chest?}],pool,bossK,path,elites,cap}` |
| `registerDim/closeDim` (40) | `S.dims["dim:<n>"]={id,map,party,seed,lv,theme,expire,state,rt}`; close sends everyone to town, deletes maps/fires/WP |
| `dimOpen`, `rcCheck`, `rcEnd` (64) | open: alone → start now; party → `party.rc={id,leader,until,resp{pid:0 asked/1 yes/2 no/3 not in town}}`, checked every tick |
| `dimStart(S,ps,partyId)` (64) | cap check, `dimLvOf` (highest member tier, clamp 10..TIER_MAX−1), seed, `dimension`, `registerDim`, spawn packs (`temp`, `dim`, `hk` toughness), `gK` scales gauge so a full clear ≈ 118, `changeMap` members in |
| `dimKill(S,rt,mob,looters)` (64) | from `killMob`: marks `hit`, adds gauge (`dimProg`), elite → orb + maybe shrine (3rd, 6th always); ≥100 → `dimBoss` |
| `dimBoss` / `dimClear` / `dimChest` (64) | master appears; on its death state `clear`, chest + exit portal (`portalMs`); each `hit` member opens its own chest once (`payout`, `ch.dim.n` daily count, xp ×0.5 after `dailyFull`) |
| `dimTick(S,now)` (64) | per tick: ready checks, expiry/warning, empty close, orbs (fly to near player), shrines → `dimBuff`, chest/portal handling; `dimFail` (timer/wipe, `failGold`) |
| `dimValidate/dimApply` (64) | actions `dim_open dim_ready dim_cancel dim_leave dim_join` (obelisk within reach, leader only, `dimJoinable`: member seen ≤`memberMs` 3 min ago or party match) |
| `dimRespawn` (64) | death inside → stand up in the start room after `reviveMs`, no loss |
| `dimView`, `dimDefs` (64) | wire + `defs().dim` |

## Data shapes (wire, appended to snapshot only when changed)
- `dim` (inside): `[gauge×10, secsLeft, state(0 run/1 boss/2 clear/3 fail), bossEid|0, lv, team[[eid,hp%,alive]], pylons[[id,kind,x,y,secs]], orbs[[id,x,y]], portal[x,y]|0, chest[x,y,0 open-able/1 got/2 none]|0, theme, bossIdx, wardSecs, reviveWait]`; `dim:0` when leaving.
- `rc` (ready check): `[id, secsLeft, [[eid,name,answer]…], lv, amLeader]`; `0` when over. `dj` (in town, joinable rift): `[secsLeft, inside, gauge×10, lv]`.
- Events `["dm", kind, x, y]` (orb/chest/open/boss/pylon kinds), `["dp", x, y]` portal, `["dz", id, x, y]` dissolve. Sheet: `ch.dim={day,n}`, `ch.cnt.dim` (achievement counter).

## Flow
1. Leader at obelisk (`obeliskNear`, NPC role `dim` opens window `#w-dim`) → `dim_open` → ready check (20 s) → members who said yes (and are in town) enter via `dimStart`; others may `dim_join` later.
2. Kills fill the gauge (elites/orbs more); shrines buff nearby players 20–30 s; at 100 % wild mobs dissolve, master appears.
3. Master dies → chest (per member, once, needs `hit`) + portal home; fail on timeout or wipe → portal after `failMs`.
4. Nobody inside 20 s → `closeDim`. Never saved: `exportChar` stores the town; `S.dims` max `DIM.max` per channel.

## Client (`game/public/`)
`dimrift.js`: `onSnap` (`dim rc dj`, sounds, `body.in-dim`, death-panel text), `onEvent` (`dm dp dz`), `syncProps` (shrines/orbs/portal/chest as `S3.props`), HUD `#dim-hud`, ready-check window `#w-rc`, keeper window `#w-dim` (`openKeeper`), `miniDots` (radar). Wired in `client.js` (`Dim.init/onSnap/onEvent/tick/openKeeper`). `dimart.js`: `obelisk obeliskAnim drawPylon drawOrb drawPortal drawChest`, `PYLON` kinds. Debug: `window.__dim`.

## 2. 균열 침공 (60-content.js `worldEvent`, older, different)
Open-world event, **not** an instance: `EVT={every 30 min, warn 2 min, len 8 min, waves [0,150 s,300 s], boss at 360 s}`. Slot = `⌊now/every⌋`; map = `evtMap(slot)` (hash over `EVT_MAPS`: unsafe maps with stone + field boss + collection mobs); gathers at `evtStone` (middle stone on big grounds). `spawnWave` (5+2·players, ≤14 elite mobs of the map's two top kinds, `mob.evt`), `spawnEvtBoss` (the map's `FIELD_BOSS`), `endEvent` pays by damage share (`e.dmg`), top-3 get runes, rank 1 gear, cosmetic roll. State `S.evt` per channel (no persistence; a channel waking mid-window joins late). Wire: `self.evt` from `evtView` (`phase next nextMap nextSt map st name in left waves mine top`); client `G.evt`, HUD `#evt`.
| | 차원 균열 | 균열 침공 |
| --- | --- | --- |
| scope | private party instance `dim:<n>`, ≤4 per channel | one real hunting ground, everyone there |
| trigger | leader at obelisk | clock, every 30 min |
| ends | gauge→master→chest; 15 min limit | 8 min or boss dead |
| reward | own chest, daily count | damage-share payout |

## Invariants / gotchas
- Instances are not in `MAP_META`; use `mapOfS`. `dimTick` skips `dim.prog === undefined` (registry tests register bare instances).
- Add balance in `DIM` only; `dimHk` multiplies mob HP, calibrated by the bot party in `dimrift.mjs` (`-v` prints clear times; `HPB= BOSSHP= NOCLEAR=1 MORE=1`).
- Rift-killed mobs: `lootFor` multiplies gold by `DIM.lootGold`; `mob.temp` ones are removed on death.
- Wire changes: `dimView` arrays are positional — append only, update `dimrift.js` in the same commit.

## Tests
`dimrift.mjs` (generator, ready check, gauge/orbs/shrines, master, chest, death, cleanup, wire, bot-party clear time) · `content.mjs` / `life.mjs` (world event) · `maps.mjs` (instances in registry) · `housing.mjs` (homes share the instance machinery).
