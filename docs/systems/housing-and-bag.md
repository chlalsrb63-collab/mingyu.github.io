# Housing and the bag

Purpose: a character's bag grows for gold; a private furnished house (3 tiers) is bought in town and holds extra storage and a rest
buff. Both landed together as sheet v10. Code: `46-bag.js`, `64-housing.js`, tables in `10-tables.js` (banners "bag expansion and housing").
No design doc beyond the file headers. The house is a runtime instance like the rift but in its own registry.

## Key files / functions (`game/src/logic/`)
| symbol (file) | role |
| --- | --- |
| `INV_BASE 40`, `INV_MAX 100` (00), `BAG_STEP 5`, `BAG_COST`, `bagCost(cap)` (10) | 12 steps, 500 … 55,000 G, 202,500 G in all; a bag is `ch.bagCap` slots |
| `bagCap(ch)`, `roomIn`, `sortSlots`, `bagClean` (46) | every bag-space check asks `bagCap` (pickup, buy, warehouse and house withdrawals, rewards, unequip); `sortSlots` is the 정리 of bag and house storage; `bagClean` rounds old sheets to 40..100 in steps of 5, never below what they carry |
| `bagValidate/bagApply` (46) | action `bag_expand` (anywhere): +5 slots, cost for the next step, refuses at 100 or short of gold |
| `HOUSE_TIER`, `HOUSE_FLOOR`, `HOUSE_WALL`, `FURN`, `FURN_SHOP`, `HOUSE_REST`, `HOUSE_TOWN` (10) | tiers: 아늑한 오두막 10×8 (10,000 G; 12 pieces, 12 rugs, 2 storage), 넓은 목조주택 14×10 (40,000; 22/24/3), 고급 저택 18×13 (120,000; 34/40/5); 18 furniture ids `fn_*` (also `ITEMS` of type `furn`); `HOUSE_TOWN` = door tiles, exit tile and agent in the town |
| `homeEmpty`, `houseClean(h, fix)` (64) | the sheet's `house` normaliser (migrate): clamps tier/styles, drops unknown furniture, enforces room/limits/one object and one rug per tile, wall pieces on row 1/col 1, free entry tile, reachability; whatever cannot stand goes back to `storage` as items (nothing is lost) |
| `homeMap(ch,id)`, `homeOpen`, `homeRebuild`, `homeClose`, `homeEnter`, `homeLeave`, `homeTick`, `homeDoor` (64) | instance: map `house_<owner eid>` (theme `interior`, `safe`, `m.home`, `m.fd` turns, `m.hf` floor) built from the sheet; registry `S.homes[id]={id,owner(pid),map,born,emptyAt}` + `runtime(S,id)`; rebuilt on every change and re-sent to everyone inside; `homeDoor` is the town's "내 집" door (called from `mv`) |
| `placeWhy`, `allReach`, `inRoom`, `wallDir`, `homeEntry/homeDoorAt` (64) | placement rules (below) |
| `homeValidate/homeApply` (64, routed from 70/75) | actions `house_buy house_upgrade house_style furn_buy furn_place furn_rot furn_pick h_dep h_wd h_sort h_rest house_visit house_leave` |
| `homeSelf`, `homeWire`, `homeDefs`, `homeExit` (64) | wire; `homeExit` is where a sheet saved inside wakes (town, beside the door) |

## Data shapes
- Sheet: `bagCap`; `house {tier 0..3, style{floor,wall}, furn[{id,uid,x,y,dir 0..3}], storage[slots], rest, cozy}` (`rest` = next-rest-allowed time, `cozy` = buff end, both ms timestamps).
- Wire `self.house = [tier, floor, wall, storeCap, storeUsed, restCooldownMs, at(0 out·1 home·2 guest), furn[[uid,id,x,y,dir]]|0, storage|0]` (last two only at home); `self.bagCap`; map payload extras `home fd hf`, town gets "내 집" portals; defs `house`, `bag`, `inv`, `invMax`. Event `["ho", eid, kind, x?, y?]` (place 0, pick 1, turn 2, storage 3, style 4, in 5, rest 6).

## Flow
1. 하우징 안내인 (NPC role `house`) → `house_buy` (tier 1) / `house_upgrade` (agent or from inside) / `furn_buy` (to the bag).
2. "내 집" door → `homeDoor` → `homeOpen` builds the instance → `changeMap` to the entry tile. Without a house, a party member's open house is entered instead (or `house_visit`).
3. Inside, the owner places (`furn_place` from the bag), turns, picks up; each change → `homeRebuild`.
4. Storage = sum of placed chest `cap`s (20/40/60) as one shared pool; `h_dep/h_wd` next to a chest (`furnNear` ≤ 30 px), owner only; `h_sort`.
5. Rest: F beside a bed or hearth → `h_rest`: +50 % HP and MP, XP +8 % for 15 min (`cozy`, read in `stats()`), once per 30 min; guests rest at the host's furniture with their own cooldown.
6. Guests (party members) stay while the owner is inside; `homeTick` walks out the rest and closes an empty house after `HOME_EMPTY_MS` 2 s. Never saved as a map; a sheet saved inside wakes at the door.

## Placement rules (`placeWhy`, checked again by `houseClean`)
Inside the walls only; per-tier caps for pieces / rugs / storage; one object and one rug per tile; wall pieces (`wall:1`: shelf, trophy, hearth) on row 1 or column 1 and not turnable; the entry tile in front of the door stays empty; nobody standing on the tile; the layout must keep every open floor tile reachable from the door (`allReach`); rugs are walkable and not turnable; picking up a chest is refused while the storage would no longer fit in the remaining chests (and while the bag is full).

## Invariants / gotchas
- Instance ids are by owner **entity** id (a session), never the account key; `S.homes` is separate so the rift's cap/timers never see houses. Use `mapOfS`, not `mapOf`.
- Sheet fields are persisted: `bagClean`/`houseClean` run in `migrate` (v10); never lose items on a shrink. Bag size must come from `bagCap(ch)`, never `INV_BASE`.
- Wire arrays are positional: append only and update `housing.js` in the same commit; bump `?v=`.
- Prices are balance in `10-tables.js`; `HOUSE_TIER` is also read by the client via `defs().house`.

## Client (`game/public/`)
`housing.js`: `bagBar` (the "+5칸 가방 확장" bar under the bag grid, `client.js` calls it), 하우징 안내인 window `#w-house`, inside a house `#house-hud`, 집 꾸미기 `#w-deco` (ghost on the hovered tile in green/red with the server's reason), 집 보관함 `#w-hstore`; F near chest/bed. `houseart.js` furniture art; `iso_interior.js` draws the room (`bakeRoom`, `roomPiece`).

## Tests
`tests/housing.mjs`: wire defs, bag 40→100 and every way into the bag, buy/enter/upgrade, furniture (place, turn, pick, collisions, wall pieces, doorway, no walling in, limits), storage (deposit, withdraw, stacks, tidy, last chest), rest, bigger house keeps furniture, party guests in and out, old sheets of every version. `content.mjs` and `maps.mjs` (instances in the registry) also touch it.
