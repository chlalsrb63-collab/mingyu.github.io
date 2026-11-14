# 넥서스 광장 — 숲 속 피난 마을 재설계 (town redesign) — 설계서

Status: **frozen design contract**, ready for two parallel implementers (T-A exterior, T-B interiors; section J).
Audience: those two agents and the integrator. Code, identifiers and commit messages English; every player-facing
string Korean (AGENTS.md rule 6). Checked against `origin/main` at b8dac97 (housing + Jobs J1 landed).

Concept (owner): **a warm, peaceful refuge where animal friends who escaped the darkness-eaten forest live
together.** A cosy, lamp-lit centre (plaza, market, hearths) fading outward into mysterious woods; along the north
edge a palisade, watch posts and creeping blight where the dark forest presses in. Everything looks hand-built by
animals helping each other: timber, stone, thatch/shingle, leaves and vines, one unified natural style, each
building readable by its silhouette, its sign and its lights.

Anything this doc does not freeze (exact prop scatter, tree placement, colours of a roof) is the implementer's call.
Coordinates marked **frozen** are shared between T-A and T-B (or with tests/other docs) and must not move without
updating this doc in the same commit.

---------------------------------------------------------------------------------------------------------------

## A. What exists (pointers, checked)

| topic | where | facts the design relies on |
| --- | --- | --- |
| town build | `34-maps-world.js buildTown()` | 40×30, seed 1101, `house(m,x,y,v)` = 4×3 `h` + `big {t:"house"}`; built at module load (eager: `START` reads `mapOf("town").entry`) |
| town hooks elsewhere | `31 DIM_TOWN {ob, keeper, land}`, `10 HOUSE_TOWN {house, door, out, agent}`, `62 TELLER` (x,y), `FIRES.town[0]` (plaza fire; tests read `camps[0]` with 4 stumps), `WP.town` | all are plain constants: moving them is a one-line change each |
| doors | `GATE_LINKS` (`town east→meadow`, `town west→city`), `data/links.json` (town → willow, tales_cafe, town_hall, starlight_inn), each interior's own `portals` back to town | links are one-way; door tile object is cleared |
| editor data NPCs on town | `data/npcs.json`: `town_willow_guide` (21,26), `town_job_arsen` 전직관 아르센 role `job` (26,12) | `tests/jobs.mjs` asserts a role-`job` NPC named 전직관 아르센 **on the town map** |
| services | role → window in `client.js interact()`; server checks `npcNear(p, role)` (56 px) **by role on the current map** | any NPC with a role, on any map, gives that service (interiors included) |
| interiors | `public/iso_interior.js` (legend in header), `SCHEMA.md` Interiors; `ROOM_STYLES` `NPC_POSES` `NPC_ROLES` in `36-custom-maps.js` | furniture objects draw in **any** theme; door convention: town door tiles under the footprint, room door `e` mat on the south stub row |
| height | `iso_tall.js`: `C` grassy rise (h 20), `H` hedge, `U` ruin, `Z` concrete, `F` fence; ground `v` = stone steps (`stepsTex`, orients by solid neighbours); ground `W` rock | **no walkable elevation**: players are never lifted. Height is visual + collision only |
| ground | `iso_ground.js materials()`: `& blight`, `v steps`, `o plaza`, `r gravel`, `p path`, `b bridge/dock`, `s shore`, `w water` exist in every theme | no new ground char is needed |
| chunking | `isotiles.js CHUNK_AREA = 80*60` | a town over 4,800 tiles is chunk-baked like the hunting grounds (fine) |
| speed | `BASE_SPD = 48` px/s, `T = 16` | **3 tiles/s**; 25 s ≈ 75 path tiles |
| transitions | `client.js loadMap`: interior ↔ outdoor = `doorFade()` + `door` sound | already smooth; keep |
| radar / map | `radar.js ROLE` glyphs, `COL.door`; `#w-map` | draws NPC role glyphs and doors; no buildings yet |
| tests touching town coords | `world.mjs` (start 20,18), `data.mjs`, `housing.mjs`, `content.mjs` (every town sign has `to`), `dimrift.mjs` (`camps[0]` 4 seats), `jobs.mjs` (`npc(role)` finds the first NPC with a role **on town**), `interiors.mjs` | T-A rewrites hard-coded town tiles to read `mapOf("town").entry` / NPC positions |

Free object chars (all ASCII is taken except these): `W & ' : ; < > | \`` (backtick) plus `" \ . ,` (avoided:
JSON escaping / look like empty). This doc spends exactly 9: `W` outdoors, the other 8 indoors (section E).

---------------------------------------------------------------------------------------------------------------

## B. Size, seed, entry, gates (frozen)

- **Map 100 × 76 tiles**, `seed: 2203` (new; layout is hand-placed, the seed only drives scatter/variation).
  Why: 6.3× the old area holds five districts + a forest margin; the plaza sits in the middle so every key service
  is ≤ 48 path tiles (16 s) from the waypoint stone and every pair of key services ≤ 58 tiles (≈ 20 s, measured on
  the plan grid below with BFS). 7,600 tiles → chunk-baked; build is hand placement + hash scatter (budget section I).
- `m.entry = [50, 43]` (plaza, south of the fountain). `START` follows automatically.
- `WP.town = { x: 46, y: 43, ax: 47, ay: 43 }` (stone `Q` west of the entry).
- Gates (names unchanged, `GATE_LINKS` unchanged):
  `m.gates = { east: { t: [[98,40],[98,41]], a: [[96,40],[96,41]] }, west: { t: [[1,40],[1,41]], a: [[3,40],[3,41]] } }`.
- South door to 버드나무 마을 (links.json): town tiles **(49,73),(50,73)** → willow (19,3),(20,3) as now; willow's
  portals back → town **(49,71),(50,71)** (edit `data/maps/willow.json` portals `tx/ty`).
- `DIM_TOWN = { ob: [58, 34], keeper: [57, 35], land: [56, 34] }`.
- `HOUSE_TOWN = { map: "town", house: [14, 43], door: [[15, 46], [16, 46]], out: [15, 47], agent: [18, 47] }`.
- `FIRES.town = [[58, 46], [29, 60]]` — index 0 is still the plaza fire (storyteller, `camps[0]` with 4 stumps),
  index 1 the pond clearing's fire.
- `TELLER` x,y = (56,46). Spirit tree `T` + `big {t:"spirit"}` at (56,44). Fountain `big {t:"fountain"}` at (49,39)
  (tiles 49–50 × 39–40, object `a`).

**Old saved positions.** New sheet field `tw` (town revision): `newChar` sets `tw: TOWN_REV` (const `TOWN_REV = 2`
in `34-maps-world.js`); `migrate`: `if ((ch.tw | 0) < TOWN_REV) { if (ch.map === "town") { ch.x = -1; ch.y = -1; } ch.tw = TOWN_REV; }`
→ `addPlayer` already sends an unstandable position to `m.entry`. Additive field, no `v` bump needed (the field is
self-describing); add an old-sheet case to `content.mjs`. Sheets saved in an interior or a house are unaffected
(interior sizes do not change; a house exit uses the new `HOUSE_TOWN.out`). A future layout change bumps `TOWN_REV`.

---------------------------------------------------------------------------------------------------------------

## C. Layout

### C.1 Schematic (1 char = 2×2 tiles; column c = x 2c…2c+1, row label = y)

```
   x0        x20       x40       x60       x80      x98
 0 TTTTTTTTTTTwTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT    T trees · & blight (the dead forest beyond the wall)
 2 TTTTTTTTTTTwTT&&&T&&&&T&&&&T&&&&T&&&&T&&&&T&&&&TTT    F palisade · a landmark (watch posts, fountain,
 4 TTTTCCCTTTTwTT&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&TT      obelisk, spirit tree)
 6 TTCCCCCCTTTwTT&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&TT    C hill mound / ravine bank (solid grassy rise)
 8 TTCCCCCCCTCwCFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFTT    w stream / pond · b bridge / dock
10 TTCCCCCCC.CwC.......a...........a..............FTT    , upper terrace (윗마을) · W 석축 retaining wall
12 TTCCCCCCC.CwC..,,,,,,,,,,,,,,,,,,,,,rr.........FTT    S stone steps (ground v) · o plaza · p road · r lane
14 TT.CCCCC..CwC..,,,,,,,,,,,,,,,,,,,,,rr.........FTT    + door tiles (links.json / HOUSE_TOWN)
16 TT........CwC..,LLLL,,,,,,,,,,JJJ,,,rr.........FTT    H 마을회관 · L 부엉이 도서관 · J 넥서스 수련관
18 TT........CwC..,LLLL,,,,,,,,,,JJJ,,,rr.........FTT    A 보글연금공방 · G 다람쥐 잡화점 · K 캉캉대장간
20 TT........CwC..,LL+L,,,HHHH,,,,+,,,,rr.........FTT    M 늑대발 용병사무소 · R 마을 창고 (barn, no door)
22 TThh.hhh..CwC..,,,,,,,,HHHH,,,,,,,,,rr........aFTT    Z 동동아파트 · h villagers' cottages (no doors)
24 TThh.hhh..CwC..,,,,,,,,H++H,,,,,,,,,rr.AAA.....FTT    N 내 집 (housing) · P 몽글 펫 돌봄집 · U 루루 의상실
26 TT.........w...,rrrrrrrrrrrrrrrrrrrrrr.AAA.....FTT    D 쥬쥬식당 · Y 테일즈 카페 · I 모닥별 여관
28 TT.........w...WWWWWWWWWSSWWWWWWWWWWWr..+......FTT
30 TT..ZZZ....w.....SS.....SSS.............r......FTT
32 TT..ZZZ....w...RRR...oooooooo..GGG.KKK..rMMMM..FTT
34 TT...+.....w...RRR..oooooooooaoGGG.KKK..rMMMM...TT
36 TThh.hh....w...RRR.ooooooooooooG++.K+K..r.++....TT
38 TThh.hh....w.......oooooaaoooooo........r.......TT
40 TppppppppppbpppppppoooooaaoooooppppppppppppppppppT    west gate (1,40–41) ← road → east gate (98,40–41)
42 TT.....NN..w.......ooooaoooooooo......r.........TT
44 TThh...NN..w..PP...oooooooooaoo....DDDr.........TT
46 TThh...++..b..++.....ooooooooo.....DDDrYYY......TT
48 TT.........w...........ooooo.......D+Dr++Y......TT
50 TT.....wwwww........UU+.pp....III+rrrrrrr.......TT    모닥별 뜰 square x 68–80 × y 50–56
52 TT....wwwwwww.......UU+.pp....III+rrrrrrr.......TT
54 TT...wwwwwwww...........pp........rrrrrrr.......TT
56 TT...wwwwwwbbb..........pp........rrrrrrr.......TT    pond + dock (23–26,56) · pond fire (29,60)
58 TT....wwwwwww...........pp.................CCCC.TT    노을 언덕 (south-east hill)
60 TT....wwwwww............pp................CCCCCCTT
62 TT.....w................pp................CCCCCCTT
64 TT.....w................pp................CCCCCCTT
66 TT.....w................pp................CCCCCCTT
68 TT.....w................pp................CCCCC.TT
70 TT.....w................pp......................TT
72 TTTTTTTwTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT    south road x 49–50 → 버드나무 마을 door (49–50,73)
74 TTTTTTTwTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
```

The grid was rasterised and checked (all doors, landings, NPC tiles open and reachable from the entry; scratch
script, not committed). T-A builds it with tile precision from the tables below; the schematic is the shape.

### C.2 Districts and terrain

| district | area (tiles) | mood and content |
| --- | --- | --- |
| **중앙 광장** plaza | ellipse centre (50,40), rx 12.5, ry 8.5, ground `o` | fountain, waypoint stone, 엘더윈, 하루's board, 노바, 리나's stall, spirit tree + fire, obelisk + 오르카, benches, lamp strings (existing `L` string logic), flower tubs |
| **윗마을** upper terrace (public) | x 30–74, y 12–28; promenade `r` y 26–27 x 32–72 | 마을회관 (centre, facing the plaza stairs), 부엉이 도서관 (west, by the ravine, reading garden), 넥서스 수련관 + training yard (east). Quiet, stone + ivy, flower beds along the wall |
| **장터 거리** market (commercial) | north side of the east road y 40–41, x 62–98; lane x 80–81 north to y 29 | 잡화점, 캉캉대장간 + open forge yard x 76–79 × 33–38, 용병사무소 near the east gate, 보글연금공방 up the lane. Awnings, crates, barrels, carts |
| **모닥별 뜰** hospitality | lane x 76–77 (y 42–49) to square x 68–80 × 50–56 (`r`) | 쥬쥬식당, 테일즈 카페, 모닥별 여관 around a lantern-strung square with outdoor tables (`o` + `k`), a well |
| **살림 마을** residential (west, across the stream) | x 3–20, y 20–50 | 동동아파트, 내 집 + 하우징 안내인 포근, five villagers' cottages (legacy `house()` v0–3, no doors), vegetable gardens, laundry lines, chicken-less pens, mailboxes |
| between stream and plaza | x 26–38, y 32–48 | 마을 창고 (barn, open front, 도담), 몽글 펫 돌봄집, 루루 의상실 (x 40–44 by the south road) |
| **연못과 숲길** nature (south-west) | pond centre (18,56) rx 7.5 ry 5.5; outflow x 14–15 south to the edge | dock (`b` 23–26,56), reeds `e`, fireflies at night (sky.js), the pond-clearing fire (29,60), stepping-stone path to the south road |
| **어둠의 숲 경계** north edge | palisade `F` y 9 (x 26–95) and x 95 (y 9–32); beyond: pines + `&` blight + `A` dead trees | three watch posts (big props 2×2 at (40,10), (64,10), (92,22)), lanterns on the posts, a faint dark mist (client particles), sentries (ambient residents) |
| hills | NW mound centre (10,10) rx 6.5 ry 5.5; SE 노을 언덕 centre (89,64) r 6 (`C`, solid, trees around) | frame the village; a bench + lookout prop at the SE hill's foot |

Terrain and height (renderer-honest):
- **Stream**: `w` x 22–23 from the north edge to the pond (y 0–50). **Ravine** y 8–24: `C` banks x 20–21 and x 24–25
  (reads as a cut). Bridges `b`: west road (22–23, 40–41), footbridge (22–23, 46). The stream is uncrossable
  elsewhere (that is the point: two bridges = two clear routes west).
- **Terrace**: object **`W` 석축** (new, section E) along y 29, x 30–72, with steps (ground `v`, object empty) at
  x 48–52 (main, facing the hall) and x 35–36 (to the library), rows y 29–30. Cheek walls `W` at x 47/53 and x 34/37
  for y 28–30 so `stepsTex` reads them as north–south steps (T-A: make `stepsTex` also orient a horizontal run of
  `v` that touches `W` as north–south; check one screenshot). East end: the lane x 73–74 climbs without a wall
  (a gentle ramp). The terrace ground stays at z 0; the 12 px wall + steps + lighter flowering lip sell the rise.
- **Mounds** `C` (solid) only at the periphery; never on a route.
- **Darkness traces**: `&` blight ground + `A` dead trees north of the palisade, two small `&` tongues reaching
  under the palisade at x≈44 and x≈80 (y 10–11) with spirit lanterns (`*` furniture-lantern drawn outdoors) holding
  them back. Client: a slow dark-violet mist band over y < 9 (decor emitter, theme town only).

---------------------------------------------------------------------------------------------------------------

## D. Buildings (frozen: footprint, door, interior id/size/entry, portal back)

Representation (T-A): a named building is `m.big.push({ t: "bld", k, x, y, w, h, door: "s"|"e", name, icon })` over
an `h` footprint (solid). `door: "s"` = the two door tiles are on the row below the footprint (y + h); `"e"` = the
column right of it (x + w), two tiles stacked. Doors themselves come from `links.json` (T-B) exactly at the tiles
below. Legacy `house(m,x,y,v)` 4×3 stays for doorless cottages. Room door convention for every new interior:
the room's door tile is (dx, H−1) with ground `e`, entry (dx, H−2); its portal goes to the town **landing**.

| k (`bld.k`) | sign (name · icon) | function | district | footprint x,y,w,h | town door tiles | town landing | interior id · size · door/entry | exterior style |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hall | 넥서스 마을회관 · `banner` | civic, main-quest elder outside, daily board inside | 윗마을 | 46,20,8,5 s | (49,25)(50,25) | (49,26) | `town_hall` 22×18 · (11,17)/(11,16) (exists) | big timber hall on a stone plinth, moss-green shingle hip roof, clock gable, two banners, twin lanterns |
| library | 부엉이 도서관 · `book` | lore, 도감, records | 윗마을 W | 33,16,7,5 s | (36,21)(37,21) | (36,22) | `owl_library` 22×16 · (11,15)/(11,14) | round stone tower + timber wing, slate-blue roof, round "owl-eye" window, ivy, reading garden with benches |
| dojo | 넥서스 수련관 · `sword` | stat training, jobs | 윗마을 E | 60,16,6,4 s | (62,20)(63,20) | (62,21) | `dojo` 18×14 · (9,13)/(9,12) | long low timber hall, deep eaves, rust roof, banner poles; yard x 66–72 × 17–25 with dummies |
| store | 다람쥐 잡화점 · `bag` | potions, scrolls, sundries | 장터 | 63,33,5,4 s | (65,37)(66,37) | (65,38) | `general_store` 16×12 · (8,11)/(8,10) | timber, striped awning, barrels/crates out front, hanging acorn-bag sign |
| smithy | 캉캉대장간 · `anvil` | enhance, salvage, gear, runes | 장터 | 70,33,6,4 s | (72,37)(73,37) | (72,38) | `kangkang_forge` 18×12 · (9,11)/(9,10) | stone ground floor, tall chimney (glow + sparks), slate roof; open forge yard x 76–79 × 33–38 with outdoor anvil |
| merc | 늑대발 용병사무소 · `swords` | requests, party finding, rift tips | 장터 E (by the gate) | 83,32,6,4 s | (85,36)(86,36) | (85,37) | `merc_office` 20×14 · (10,13)/(10,12) | log lodge, dark wood, shields on the front wall, notice board outside, crossed-swords sign |
| lab | 보글연금공방 · `flask` | alchemy (life-and-coop, later) | 장터 lane N | 78,25,5,3 s | (80,28)(81,28) | (80,29) | `bogle_lab` 18×12 · (9,11)/(9,10) | crooked timber, copper dome/chimney puffing coloured smoke, jars on sills |
| diner | 쥬쥬식당 · `bowl` (sign text "쥬쥬식당 · 선술집") | food, cooking, socialising | 모닥별 뜰 | 70,45,6,4 s | (72,49)(73,49) | (72,50) | `juju_diner` 20×14 · (10,13)/(10,12) | warm timber, red roof, big front window, outdoor tables, steam from the vent |
| cafe | 테일즈 카페 · `cup` | drinks, rest | 모닥별 뜰 | 78,46,5,3 s | (79,49)(80,49) | (79,50) | `tales_cafe` 20×16 · (10,15)/(10,14) (exists) | cream walls, teal roof, chalkboard menu outside |
| inn | 모닥별 여관 · `bed` | rest, stew, travel goods | 모닥별 뜰 W | 61,50,6,4 **e** | (67,51)(67,52) | (68,51) | `starlight_inn` 20×16 · (10,15)/(10,14) (exists) | two-storey timber, blue roof, a star lantern over the door |
| boutique | 루루 의상실 · `shirt` | cosmetics | plaza S | 40,50,5,3 **e** | (45,51)(45,52) | (46,51) | `boutique` 16×12 · (8,11)/(8,10) | pastel plaster, pink roof, bay window with a mannequin, ribbon sign |
| pet | 몽글 펫 돌봄집 · `paw` | pets | between stream and plaza | 28,44,4,3 s | (29,47)(30,47) | (29,48) | `pet_house` 14×10 · (7,9)/(7,8) | round cottage, grass roof, little picket pen |
| apt | 동동아파트 · `house` | residents' block (co-op delivery later) | 살림 마을 | 8,30,5,4 s | (10,34)(11,34) | (10,35) | `dongdong_apt` 14×10 · (7,9)/(7,8) | 3-storey stacked timber, balconies, flower boxes |
| home | 내 집 · `house` | the player's own house (64-housing.js) | 살림 마을 | 14,43,4,3 s | `HOUSE_TOWN.door` (15,46)(16,46) — **not** links.json | `HOUSE_TOWN.out` (15,47) | private instance `house_<eid>` | cottage with a mailbox and a "내 집" plaque |
| barn | 마을 창고 · `crate` | warehouse (도담 outside) | between stream and plaza | 30,33,5,4 — | none (open front, no interior) | — | — | big red-brown barn, doors open with crates inside |

Doorless cottages (legacy `house()` 4×3, `v` 0–3 varied): (4,23), (11,22), (4,36), (10,36), (4,44).

**life-and-coop mapping** (supersedes `docs/design/life-and-coop.md` C.1 coordinates): 캉캉대장간 → `smithy`
(interior `kangkang_forge`), 동동아파트 → `apt` (`dongdong_apt`), 보글연금공방 → `lab` (`bogle_lab`), 쥬쥬식당 →
`diner` (`juju_diner`). The lobby interior ids are the ones that doc named; C1 adds its `coop` fields/roles later.

### D.1 Outdoor NPCs (code ids keep id, role, name; only x,y move) — frozen tiles

Principle: every service you use every session stays **outdoors** within ~20 tiles of the stone; each building's
interior has its own themed hosts (section F). Built-in NPCs stay defined in `buildTown` (T-A); `data/npcs.json`
entries stay in that file (T-B edits their x,y).

| id | name | role | tile | note |
| --- | --- | --- | --- | --- |
| elder | 관리자 엘더윈 | elder | (52,37) | "광장 분수 앞" (tutorial text stays true) at the foot of the hall stairs |
| warp | 이동술사 노바 | warp | (45,44) | beside the stone (46,43) |
| daily | 게시판지기 하루 | daily | (44,36) | a `B` at (43,35) carries the notice board (decor.js picks it) |
| shop | 보급상 리나 | shop | (61,39) | her stall at the plaza's east mouth (tutorial "물약 사기" unchanged) |
| dimkeeper | 균열 지기 오르카 | dim | `DIM_TOWN.keeper` (57,35) | obelisk (58,34) |
| smith | 대장장이 볼칸 | smith | (77,37) | the open forge yard of 캉캉대장간 |
| train | 수련관 카이 | train | (68,23) | training yard |
| town_job_arsen (npcs.json) | 전직관 아르센 | job | (70,23) | beside 카이 (stays on town: `jobs.mjs`) |
| bank | 창고지기 도담 | bank | (32,38) | barn's open front |
| collector | 학자 몽 | collector | (34,23) | library reading garden |
| achieve | 기록관 루 | achieve | (39,23) | library reading garden, by a record stone |
| costume | 의상실 주인 루루 | costume | (47,53) | outside her boutique |
| housing | 하우징 안내인 포근 | house | `HOUSE_TOWN.agent` (18,47) | beside the 내 집 door |
| guard | 경비병 토비 | talk | (94,38) | east gate; lines unchanged |
| story (TELLER) | 이야기꾼 할머니 소담 | talk, night | (56,46) | by the plaza fire (58,46) |
| town_willow_guide (npcs.json) | 길잡이 다람 | talk | (52,70) | south road, by the willow door |

---------------------------------------------------------------------------------------------------------------

## E. New characters (frozen)

No new ground chars (`v` steps, `&` blight, `b` dock exist in every theme). One new outdoor object, eight new
interior objects. Every object blocks (`finalize`). Names go in `scripts/editor-lib.mjs OBJECT_NAME`, minimap
colours in `public/art.js MINI_OBJ`.

| char | name (editor) | where | draws (file · owner) | minimap |
| --- | --- | --- | --- | --- |
| `W` | 석축 (돌 축대) | outdoors | `iso_tall.js` new kind in `KINDS`, height 12, coursed field stone, mossy grass lip on top, joins in runs like `C`; `scene2d` lazy-tall set `"CHUZW"` and `blockKind` · **T-A** | `#9a9080` |
| `&` | 모루 | indoors (forge) | `iso_interior.js` furniture · **T-B** | `#5a5e6c` |
| `<` | 화덕 (용광로) | forge | furniture with `glow` (orange) + spark anim · T-B | `#d8603a` |
| `>` | 진열대 | forge/office/dojo: weapon & shield rack; boutique: clothes rail; shop: tool rack (by room `style`) · T-B | `#8a6a4a` |
| `\|` | 독서대 | library/hall: lectern with an open book | T-B | `#7a5a3a` |
| `;` | 표본 진열장 | library: glass case with a pickled hell-beast specimen (도감) | T-B | `#9ad0c8` |
| `:` | 화덕 (요리) | diner: stove with a stew pot (put a `fires` entry on the tile in front: hearth for cook/rest) | T-B | `#b8a898` |
| `'` | 전신 거울 | boutique (and the town hall foyer if wanted) | T-B | `#bfe0ee` |
| `` ` `` | 수련 인형 | dojo (indoors); outdoors the yard uses the same char | T-B (draws in any theme) | `#c8a060` |

Room styles added to `ROOM_STYLES` + `iso_interior.js STYLE` (T-B): `office forge tavern shop boutique dojo lab`
(wallpaper/curtain/banner palettes; furniture variants by style: `j` = beer taps in `tavern`, scale + register in
`shop`; `$` = goods display in `shop`, cake case elsewhere; `>` per the table).

New NPC poses (T-B: `NPC_POSES` + `iso_interior.js drawPose`; T-A's residents use the same function):
`sweep hammer stir carry fish water knit wave` (water = watering can). Unknown poses draw nothing, so T-A can ship
before T-B.

**Interactive objects = "thing" NPCs** (one small generic feature, T-B owns the rule, T-A the drawing):
an editor NPC with `"thing": true` is an interactive object, not a person — no sprite, no mat, no idle, no radar
glyph; it may stand **on** a furniture tile (data:check: allowed only with `thing`, and one orthogonal neighbour
must be open); its `name` shows on the F prompt; its `role` gives the service (`collector`, `achieve`, `daily`,
`costume`, `smith`, `job`, or `talk` with `lines`). `npcFrom` whitelists `thing`; `scene2d` (NPC draw, `paintExtras`
mats) and `radar.js` skip `n.thing`. No wire change (NPCs already travel in the map payload).

---------------------------------------------------------------------------------------------------------------

## F. Interiors (T-B) — ids, NPCs, objects

Coordinates inside rooms are suggestions (T-B may move pieces ±2) except door/entry. Every room: back walls on
row 0 / column 0, `_` stub south/east, `e` mat at the door, `portals: [{ x: dx, y: H-1, to: "town", tx, ty }]` with
tx,ty = the town landing (section D); `links.json` gets both town door tiles → the room entry, `label` = sign name.
Every room is `safe`, `theme: "interior"`, has ≥ 1 light (`*`, `o`, `#`, `<` or windows `+`).

| room | style · bgm | NPCs (id · name · role · species look hint · pose · tile) | things (thing NPCs) | furniture highlights |
| --- | --- | --- | --- | --- |
| `owl_library` 부엉이 도서관 | library · cafe | `lib_borum` 사서 보름 · talk · 양, round glasses · read · (5,3)<br>`hall_pipi` 지도 제작자 피피 · collector · (moved from town_hall) · read · (16,4)<br>`hall_momo` 서기관 모모 · achieve · (moved) · write · (17,10) | `lib_case` 괴수 도감 진열장 · collector · on `;` (14,2)<br>`lib_tablet` 기록의 서판 · achieve · on `t` (20,8)<br>`lib_book_1..3` 낡은 책: 정령나무 / 어둠에 먹힌 숲 / 첫 이주민들 · talk (4–6 lore lines each) · on `\|` | walls of `b`, ladders implied, reading tables `o`+`k`, `~` old maps, `;` specimen row, fireplace `#` + `fires`, rug `y` runner |
| `merc_office` 늑대발 용병사무소 | office · town | `merc_grey` 용병단장 그레이 · quest · 강아지 (wolfish grey), scar · — · (10,3)<br>`merc_mimi` 접수원 미미 · daily · 토끼 · write · (4,6)<br>`merc_bawi` 은퇴한 용병 바위 · talk · 곰 · doze · (16,10) | `merc_board` 의뢰 게시판 · daily · on `v`<br>`merc_party` 파티 구인판 · talk (how to party: P, invites, 4 max, 차원 균열 ready check at the obelisk) · on `v` | map table `-` with `~` maps above, `>` weapon racks, `!` banners, `]` `w` supplies, armchairs `s` by `#` |
| `general_store` 다람쥐 잡화점 | shop · town | `store_dari` 잡화점 주인 다리 · shop `goods: hp_s hp_m hp_l mp_s mp_m mp_l recall camp feather sc_atk sc_def sc_xp stone` · 다람쥐 · wipe · behind `m` (8,3)<br>`store_kong` 심부름꾼 콩콩 · talk · 햄스터 · carry · (12,8) | — | counter `m` run + `j` (register), `$` displays, `r` jar shelves, `]` crates, `w` barrels |
| `kangkang_forge` 캉캉대장간 | forge · town | `forge_tong` 견습 대장장이 통통 · smith · 생쥐 · hammer · (6,4)<br>`forge_musoe` 갑옷장이 무쇠 · shop `goods: W1 w_book_1 h_1 a_1 g_1 b_1 h_2 a_2 g_2 b_2 ru_ign ru_aeg ru_vit ru_men ru_cel ru_acu ru_san ru_lum ru_fos` · 곰 · wipe · (13,3)<br>reserved tile (11,6) for 캉캉 (life-and-coop C1, role `craft`) | `forge_anvil` 모루 · smith · on `&` | furnace `<`, anvil `&`, quench `w`, `>` racks, `]` ore crates, flagstone `x` floor |
| `juju_diner` 쥬쥬식당 | tavern · cafe | `juju` 쥬쥬 · shop `goods: food_s food_m food_l inn_bread` · 너구리, apron · stir · by the stove (5,2)<br>`diner_piri` 떠돌이 악사 피리 · talk · 사슴 · — · (16,8)<br>`diner_reg1`, `diner_reg2` 단골 손님 · talk · sip · at tables | — | stove `:` with `fires` in front (cook + rest), bar `m` + `j` taps, `w` kegs, tables `o` + `k`, fireplace `#` |
| `boutique` 루루 의상실 | boutique · cafe | `bout_silvi` 재봉사 실비 · costume · 고양이, tape measure · knit · (11,3) | `bout_mirror` 전신 거울 · costume · on `'` | `>` clothes rails, `'` mirrors, `s` armchair, `g` plants, `u` round rug, counter `m` |
| `dojo` 넥서스 수련관 | dojo · town | `dojo_panpan` 사범 판판 · train · 판다, headband · — · (9,3) | `dojo_scroll` 전직의 두루마리 · job · on `v` (the job window opens here too) | `` ` `` dummies, `>` racks, `!` banners, `t` trophy cabinet, `x` / `y` mat floor |
| `pet_house` 몽글 펫 돌봄집 | inn · cafe | `pet_monggeul` 펫 돌보미 몽글 · shop `goods: pet_chick pet_bat pet_wisp` · 양 · — · (7,2) | — | `%` cats, `g` plants, `w` feed barrel, `u` rug, counter `m` |
| `dongdong_apt` 동동아파트 1층 로비 | inn · town | `dongdong` 관리인 동동 · talk · 펭귄 · sweep · (4,3) | `apt_mail` 우편함 · talk ("편지가 없네요." + resident gossip) · on `r` | mailboxes `r` along the back wall, a `~` painting of the building day, `g` plants, a long bench `-` |
| `bogle_lab` 보글연금공방 | lab · cafe | `bogle` 보글 · talk (role `alch` later) · 개구리, goggles · stir · (9,3) | — | cauldron = `:` (no `fires` entry: not a hearth), `r` jar shelves, `;` specimen jars, `b` books |
| `town_hall` (exists) | hall | keeps `hall_bori`, `hall_hana`; **moves** `hall_pipi`, `hall_momo` to the library | `hall_map` 마을 지도 · talk (one line per district, where each building is) · on `~` | unchanged otherwise; portal → (49,26) |
| `tales_cafe`, `starlight_inn` (exist) | — | unchanged | — | portals → (79,50) and (68,51) |

Side quests (T-B, `quests.json`, giver `merc_grey`): three, Korean, existing goal types only, e.g.
`sq_merc_hares` (kill 10 twinhare, lv 1), `sq_merc_boar` (kill 8 splitboar, lv 10, req the first),
`sq_merc_letter` (talk `smith`, then reward) — any three that pass `data:check`.

Optional, NOT in T-A/T-B scope (one proposal): **파티 구인판** as a real party finder (`role: "lfg"`: a channel list of
players flagged "파티 구함" with level/job, click → invite). Until someone builds it, `merc_party` is a talk thing.

---------------------------------------------------------------------------------------------------------------

## G. Signs, signposts, navigation

- **Building signs** come from `bld` (`name`, `icon`): T-A draws a hanging plank with the 12×12 icon (uiicons `icon()`)
  on the front face beside the door, lit by a small lamp at night, and the name as a label like signpost labels
  (shown when within ~8 tiles; the map window shows them all). Icons: existing `banner book sword bag
  anvil swords shirt paw`; new in `uiicons.js G` (T-A): `bowl cup bed house flask crate`.
- **Signposts** (`G` + `marks`, every one with a `to` — `content.mjs` requires it; interior ids are map ids, so
  `signWay` points at their doors). Tiles ±2 at T-A's discretion; labels computed, the gate ones from
  `doorName(MAP_META[id])` so shown levels never drift (today "바람초원 Lv.1–25", "네온 시티 Lv.53–81"):

| tile | label | to |
| --- | --- | --- |
| (93,42) | `${doorName(meadow)} →` | meadow |
| (5,42) | `← ${doorName(city)}` | city |
| (47,31) | ↑ 마을회관 · 도서관 · 수련관 | town_hall |
| (31,26) | ← 부엉이 도서관 | owl_library |
| (71,28) | → 수련장 · 전직관 | dojo |
| (62,43) | → 장터 거리 · 잡화점 · 대장간 | general_store |
| (79,39) | ↑ 보글연금공방 · 용병사무소 → | bogle_lab |
| (75,42) | ↓ 쥬쥬식당 · 카페 · 여관 | juju_diner |
| (38,43) | ← 살림 마을 · 창고 · 펫 돌봄집 | dongdong_apt |
| (24,42) | ← 동동아파트 · 내 집 | dongdong_apt |
| (52,49) | ↓ 버드나무 마을 · 연못 | willow |

- **Routes** (BFS on the plan grid, tiles → seconds at 3 tiles/s): stone → elder 10 (3 s), 리나 17, 도담 19, hall
  door 20, store 24, pet 22, inn 28, smithy 31, diner 31, willow door 32, library 33, 볼칸 35, dock 35, home 37,
  dojo 38, cafe 38, 카이 40, merc 45, apt 46, lab 48 (16 s), east gate 54, west gate 49. Pairs: 리나↔볼칸 18,
  도담↔볼칸 46, 엘더윈↔merc 35, library↔볼칸 58 (≈ 19 s, the longest service pair). Test bound: ≤ 75.
- **Radar / map window** (T-A, `radar.js`): `bld` footprints as filled roofs in a muted roof colour + the sign icon
  at the door (radar: icon only; `#w-map`: icon + name). Doorless cottages: roof colour only. Things: nothing.
- **Transition**: keep `doorFade()` + `door` sound for every building door (already triggered by interior theme).
  The town door caption shows the sign name (links `label`). No camera pan on arrival.

---------------------------------------------------------------------------------------------------------------

## H. Residents and life (T-A): client-side, deterministic, wire-free

**Decision: client-side ambient residents** in a new module `public/townfolk.js`, driven by the synced sky clock
(`Sky.hour()`, `Sky.phase()`). Why: zero wire cost (no snapshot fields), the server rules stay deterministic and
untouched (no `tick` work, no collisions, no saves), and every client computes the same position from the same clock
(+ the resident's seed), so two players see the same baker at the same stall. Residents are not server NPCs: they
never block movement (players walk through them), give no services and are not quest targets (anything that needs
those is a real NPC in D.1/F). They are drawn with `sprites.js` player looks (species from `species.js`) like heroes.

API: `init(deps)`, `load(map)` (town only; builds each resident's route with BFS over open tiles of `m.o`/`m.g`,
cached), `update(dt, me)` (bubble logic), `drawables(t)` → `[{x, y, look, dir, frame, pose, bubble}]` that `scene2d`
merges into its depth-sorted list (`stand`-style entries). Position at hour h: each resident has 5 phase anchors
(새벽 아침 낮 노을 밤, `sky.js` phases 4.5/7/11/17/19.5 h); within a phase they idle at the anchor (pose) except the
first 0.25 game-hours of the phase, when they walk the BFS path from the previous anchor at walking speed (a game
hour = 2 real min, so a 75-tile walk fits). `hidden` anchors = indoors (not drawn). Talking: within 1.5 tiles a
resident turns to you and shows one of their lines in a speech bubble (client `bubbleFrame`), at most once per 20 s
per resident; no F prompt (F stays for real NPCs/doors/fishing). Cap 16 drawn; off-screen ones skip animation.

| id | name · species · look | personality | 새벽 | 아침 | 낮 | 노을 | 밤 | lines (Korean, final) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r_dotori | 도토리 · 다람쥐 kid | restless | hidden | pond (24,52) wave | chase loop round the fountain with 콩알 | fountain | hidden | "술래잡기 할래? 나 엄청 빠르다!" |
| r_kongal | 콩알 · 햄스터 kid | giggly | hidden | pond | chase loop (behind 도토리) | fountain | hidden | "도토리 잡았다! …아니 놓쳤다!" |
| r_bodeul | 보들 할머니 · 양 | gentle knitter | home cottage (6,39) hidden | plaza bench (44,46) knit | plaza bench knit | library garden (36,24) read | hidden | "털실이 남으면 목도리 떠 줄게." |
| r_neogul | 너굴 아저씨 · 너구리, big pack | chatty peddler | barn (33,38) carry | east road stall (68,39) wave | east road stall | square (74,54) sip | square doze | "숲 너머 소식? 한 냥만 주면… 농담이야!" |
| r_gaegul | 개굴 · 개구리 | patient fisher | dock (25,56) fish | dock fish | pond shore (12,51) fish | pond fire (29,61) sip | hidden | "비 오는 날엔 큰 놈이 문다니까." |
| r_peng | 펭 · 펭귄, satchel | dutiful mail carrier | hidden | loop: apt door → hall → store → diner (carry) | same loop | hall steps (50,27) | hidden | "편지 왔어요! …아, 당신 건 아니네요." |
| r_saessak | 새싹 · 사슴 | gardener | garden (14,28) water | terrace beds (40,27) water | garden water | bench (12,40) | hidden | "꽃이 피면 어둠도 조금 물러나는 것 같아요." |
| r_daenamu | 대나무 · 판다 | slow builder | hidden | palisade (50,11) hammer | palisade hammer, doze 12–13 h | plaza (55,42) | hidden | "울타리 한 칸이면 모두가 한 밤 더 편히 자." |
| r_meongdae | 멍멍 대장 · 강아지, helmet | proud sentry | watch post (41,12) | watch post 1 | patrol palisade y 11 x 30–70 | watch post 1 wave | watch post 1 (lantern) | "북쪽 숲은 내가 지킨다! …무서운 건 아니고." |
| r_kkamang | 까망 · 고양이, scarf | night watcher | watch post 2 (65,12) | terrace sun spot (56,14) doze | doze | stretch → watch post 2 | watch post 2 | "밤엔 눈이 더 잘 보여. 어둠도 잘 보이지." |
| r_yeoreum | 여름 · 여우, books | curious scholar | hidden | library garden read | hall steps write | library garden read | hidden | "도서관 3층에는 아무도 안 가 봤대. 3층이 없거든." |
| r_jjik | 찍찍 · 생쥐, apron | smith's runner | forge yard (78,35) carry | barn ↔ forge yard carry loop | forge yard hammer | diner square sip | hidden | "볼칸 아저씨 망치 소리 들으면 잠이 와요." |
| r_ggul | 꿀단지 · 곰, chef hat | jolly cook | barn carry | diner square (71,51) stir | square sweep | square stir | hidden | "오늘 국물은 엄마 손맛이야. 우리 엄마 손맛!" |
| r_riri | 리리 · 토끼 | laundress | laundry (6,42) carry | laundry water | bench (12,40) knit | laundry carry | hidden | "빨래가 바람에 춤추면 비가 안 온대요." |
| r_noeul | 노을 · 사슴, lute | dreamy musician | hidden | hidden | square (76,53) | plaza fire (60,47) wave (plays) | plaza fire | "모닥불엔 노래가 어울리지. 들어 볼래?" |
| r_bawi2 | 반들 · 기본, cap | ferryman of the bridge | bridge (24,41) wave | bridge | bridge | footbridge (24,46) | hidden | "다리 건너면 살림 마을이에요. 발밑 조심!" |

Anchors may be nudged ≤ 2 tiles to the nearest open tile by T-A (tested: every anchor reachable).

**Small life (client, cheap, T-A):** chimney smoke from every `bld`/house (existing `smokers`); windows and sign
lamps glow when `Sky.nightK() > 0.3`; lantern strings over the square and plaza (existing `L` strings); laundry lines
flap (big prop `laundry`, 3 frames); forge sparks + `hammer` sound near the smithy yard (volume by distance,
throttled); diner steam; coloured puffs from the lab; fireflies over the pond at night (sky.js already); butterflies
by day (decor critters, town = 5 already); a cat `%` sleeping on the hall steps; leaves drifting on the terrace;
the dark mist at the north edge; the watch-post lanterns swing at night.

**Benches (T-A, small rule change, optional P2):** big prop `bench` (1×1 or 2×1, footprint `a`); `m.benches =
[[px, py]…]` seat points; `sitDown` (62-daynight) snaps to a free bench seat within `SEAT_R` when no camp seat is
closer. No warmth from benches. Without this, benches are scenery and `sit` works beside them as today.

Big outdoor props (T-A, `m.big {t:"prop", k, x, y, w, h}` over footprint object `a`; `scene2d` skips every tile a
non-house big covers): `watch` (2×2), `well` (1×1), `bench`, `laundry` (2×1), `cart` (2×1), `stall` (2×1),
`dummy` (1×1, or the `` ` `` char), `garden` (2×2 veg bed), `lookout` (2×2, SE hill foot). Footprints never on a
route; tested by connectivity.

---------------------------------------------------------------------------------------------------------------

## I. Budgets

- `buildTown` ≤ 20 ms on the dev box, test bound 60 ms (`maps.mjs` measures it; town is built at load in every
  Room isolate). Hand placement + `hash`/`rnd` scatter only; no noise fields over the whole map, no A*.
- Client: chunk-baked ground (automatic over 4,800 tiles); `W` walls lazy like `CHUZ`; residents ≤ 16 drawables;
  big props ≤ 80. Frame time in town within 10 % of meadow's on the same machine (`radar` perf / `shot.mjs --live`).
- Map payload: g/o rows ≈ 15 KB + big/npcs/marks, sent once per entry — fine.

---------------------------------------------------------------------------------------------------------------

## J. Work split (parallel; file ownership)

**T-A "town exterior"** owns: `src/logic/34-maps-world.js` (`buildTown`, `TOWN_REV`), `31-maps-dim.js` (`DIM_TOWN`
only), `10-tables.js` (`HOUSE_TOWN` only), `40-characters-world.js` (`tw` in `newChar`/`migrate` only),
`60-content.js` (TUT hint text only if needed), `62-daynight.js` (`TELLER` x,y; optional benches),
`public/iso_tall.js` (`W`, `bld` models + generalised `slice(w,h)`), `iso_ground.js` (`stepsTex` orientation),
`scene2d.js` (bld/props/signs/residents/`thing` skip), `decor.js` (town dressing, mist, critters), `art.js`
(`MINI_OBJ` for `W` **and** T-B's eight chars, colours from E), `radar.js`, `uiicons.js` (new glyphs),
`public/townfolk.js` (new), `audio.js` (ambient one-shots if any), `client.js` (wiring only), `index.html` cache tag,
tests: `tests/town.mjs` (new, add to `tests/LIST`) + fixing hard-coded town tiles in existing tests.
T-A never edits `data/**`, `iso_interior.js`, `36-custom-maps.js`, `scripts/editor-lib.mjs`, `game/editor/**`.

**T-B "interiors"** owns: `data/maps/{owl_library,merc_office,general_store,kangkang_forge,juju_diner,boutique,dojo,
pet_house,dongdong_apt,bogle_lab}.json` (new), edits to `data/maps/{town_hall,tales_cafe,starlight_inn,willow}.json`
(portals, moved NPCs), `data/links.json` (every town door tile in D), `data/npcs.json` (x,y of `town_job_arsen`,
`town_willow_guide`), `data/quests.json` (3 side quests), `public/iso_interior.js` (8 chars, 7 styles, 8 poses,
style variants), `src/logic/36-custom-maps.js` (`ROOM_STYLES`, `NPC_POSES`, `npcFrom` `thing`), `scripts/editor-lib.mjs`
(`OBJECT_NAME` for all nine new chars incl. `W` = "석축"), `game/editor/validate.js` (+ NPC form checkbox
"상호작용 물건" optional), `docs/editor/SCHEMA.md` (chars, styles, poses, `thing`), tests: `tests/interiors.mjs`
(extend to every room). T-B never edits `34-maps-world.js`, `scene2d.js`, `iso_tall.js`, `radar.js`, `art.js`.

Shared: `AGENTS.md` (each appends its own lines; rebase resolves), `logic.js` (regenerate, never hand-merge).
Ordering: independent. Before T-A lands, T-B's town doors land on the **new** coordinates (they would point into
the old 40×30 town's trees): so T-B's `links.json`/portal/npcs.json edits are committed **together with or after**
T-A's `buildTown`; T-B develops against a scratch copy (`EDITOR_DATA=` or a local stub of the new town) and the
integrator merges T-A first, then T-B (rebase, `npm run test:rules`). `data:check` on T-B's branch alone may flag
the town door tiles as blocked — expected until T-A is in.

---------------------------------------------------------------------------------------------------------------

## K. Acceptance checklist

Tests (`npm run test:rules` green; new `tests/town.mjs` by T-A unless marked T-B):
- [ ] town is 100×76, entry (50,43) standable, `START` there; build time < 60 ms.
- [ ] walk graph from the entry reaches: both gates' `t` tiles, the willow door, every door tile in D, `HOUSE_TOWN`
      door/out, the stone arrival, `DIM_TOWN.land`, every NPC's tile neighbourhood, every resident anchor.
- [ ] BFS route stone → every door ≤ 60 tiles; every pair of {elder, shop, bank, smith, warp, daily, dim} ≤ 75.
- [ ] every built-in id present on town with its role: `shop smith elder train bank guard warp collector achieve
      daily costume dimkeeper housing` + `story` at night, `town_job_arsen` (role job), `town_willow_guide`.
- [ ] (T-B) every building door ↔ interior round trip: step on each town door tile → lands on the room entry; step
      on the room door → lands on the D landing, which is open; nobody lands on a door or in a wall.
- [ ] (T-B) every interior: diorama rule (back walls only N/W, stubs S/E), all NPC tiles open (things: on furniture
      with an open neighbour), every role NPC/thing reachable from the entry, `goods` only from existing buyable ids,
      `data:check` clean.
- [ ] every town sign has `label` and `to`; gate signs equal `doorName(MAP_META[...])`.
- [ ] `camps[0]` at (58,46) has 4 stumps; `camps[1]` at the pond clearing.
- [ ] old sheets: a v9/v10/v11 sheet saved in town at (20,18) (old coords) wakes at the entry and gets `tw: 2`;
      a sheet saved at a valid new tile keeps it; a sheet saved in `tales_cafe` stays there; a sheet saved in a house
      wakes at `HOUSE_TOWN.out`.
- [ ] housing: 내 집 door enters the private house and back to (15,47); agent `house_visit` works near (18,47).
- [ ] rift: obelisk at (58,34), returning party lands on (56,34).

Screenshots (one each, T-A unless noted): `shot.mjs --map town --x 50 --y 40` (plaza, day);
`--q "hour=21"` same spot (night lights, mist off-screen OK); `--x 50 --y 26` (terrace stairs + hall);
`--x 76 --y 38` (market + forge yard); `--x 20 --y 44` (stream, bridges, residential); `--x 50 --y 12` (palisade,
watch posts, blight); `--page over --map town` (whole layout). T-B: one per new interior
(`--page scene --map <id>`), and `_house`-style preview of the eight new pieces if added to a preview page.
