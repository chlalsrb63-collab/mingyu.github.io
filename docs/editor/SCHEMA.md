# 테일즈테일즈 월드맵에디터 — data format and API contract (v1)

The owner edits maps, NPCs, quests and assets in a local editor app; the game reads the result.
This file is the contract between the game side (data pipeline, rules) and the editor UI.
Change it only additively; bump `"v"` in a file when its shape changes and migrate old files.

## Where data lives

```
game/data/                     ← everything the editor writes (committed to git)
  maps/<id>.json               ← one file per hand-made or hand-edited map
  links.json                   ← extra doors between maps (incl. into built-in maps)
  npcs.json                    ← NPCs added to built-in maps
  npclife.json                 ← safe-map resident places, routines and relationships
  quests.json                  ← main quest chain override + side quests
```

`game/scripts/build-logic.mjs` reads `game/data/**` and injects it into the generated
`game/src/logic.js` as `const DATA = {...};` (a generated part placed before `10-tables.js`), so
logic.js stays one file with no imports. Missing files = empty defaults = the game as it is today.
`npm run data:check` validates everything (the editor calls it before saving/building).

## maps/<id>.json

```jsonc
{
  "v": 1,
  "id": "willow",                 // [a-z][a-z0-9_]{1,23}; unique; may equal a built-in id only with "replaces"
  "replaces": null,               // or a built-in map id ("meadow", "town", …): this file REPLACES the generated map
  "name": "버드나무 마을",         // Korean display name
  "theme": "meadow",              // town meadow forest crypt city sewer cave abyss autumn interior mist
  "bgm": "field",                 // audio.js TRACKS key
  "safe": false,                  // true = no monsters, no PvE damage (like town)
  "band": [5, 9],                 // level band shown on doors, or null
  "w": 48, "h": 36,               // tiles; 16..160 each (an interior: 8..160)
  "ground":  ["......", "..."],   // h strings × w chars — ground layer (see palette below)
  "objects": ["      ", "..."],   // h strings × w chars — object layer; " " = empty (any object blocks)
  "entry": [24, 30],              // where players arrive by default (must be standable)
  "spawns": [ { "k": "twinhare", "n": 6, "r": [10, 4, 20, 12], "elite": 0.08 } ],
  "npcs": [ { "id": "willow_elder", "name": "촌장 버들", "role": "talk", "x": 22, "y": 14,
              "look": [0, 0, 0, "#6a4a38"], "lines": ["어서 오게, 꼬마 모험가."] } ],
  "portals": [ { "x": 24, "y": 35, "to": "town", "tx": 20, "ty": 3 } ],
  "fires": [ [30, 20] ],          // campfires (rest/cook spots)
  "waypoint": [26, 28],           // a waypoint stone tile, or null
  "fishing": true,                // allow fishing where water meets walkable ground
  "boss": null                    // or { "k": "lambmaw", "x": 40, "y": 8 } field-boss spot
}
```

Named chapters may set `mainChapter: true` for the main quest UI, while using the named quest
save format. Optional `req.main: true` requires completing the linear main quest chain.

- `role`: `talk` (lines only), `quest` (gives side quests whose `giver` is this id), or any built-in
  service role (`shop smith train bank warp daily collector achieve costume`; `charm` is 주아나 the
  charm appraiser, `66-charms.js`).
- `look`: same 4-value array as built-in NPCs (see `34-maps-world.js buildTown`), or a full player
  look array (species.js) — the game accepts both.
- Ground/object chars: the palette comes from the server (`GET /api/palette`), built from what
  logic/scene2d/iso art actually support, with Korean names, minimap colours and solidity.

Additive fields and rules (game side, v1 files stay valid; `mapToEditor` writes them so a
generated map round-trips tile for tile):
- `replaces`: the map keeps the built-in id (`replaces` value); the file's own `id` is an alias
  that other data may use too. Doors other maps have INTO a replaced map stay; their arrival
  tiles must be open in the new grid (data:check error "대체한 지도 … 도착 칸을 막았습니다").
  `band` omitted (not `null`) on a replacement keeps the built-in band.
- `spawns[].el`: optional fixed rank, 1 elite, 2 guardian (dungeon guardians use it).
  `n` 1..40. `spawns` of a `safe` map are ignored.
- `waypoint`: `[x, y]` or `[x, y, ax, ay]` (ax, ay = the open tile beside the stone travellers
  arrive on; default: the first open side). The stone tile becomes object `Q`.
- `stones`: `[[x, y, ax, ay], …]` (≤ 3) more waypoint stones after `waypoint`, same form; each is
  woken on its own (sheet key `"<id>#<i>"`, i = 1…). Needs `waypoint`. The 4× generated grounds
  export their second and third stones here.
- `shrines`: `[[x, y], …]` (≤ 8) wind shrines (질주의 바람, object `/`): brushing past one gives
  +30% move speed for 20 s, each shrine once a minute per player.
- `spawns[].zone` (written by `mapToEditor` for generated grounds, ignored on editor maps: they
  are not zoned).
- `boss`: `{ k }` = the field boss the map's kills call out (like generated hunting grounds);
  `x, y` (optional) is where it prefers to walk in, still kept ≥3 tiles from the waypoint and signs
  and ≥6 from players. A map with monsters, a waypoint and a boss joins the rift rotation;
  with monsters it gets a collection page (no region bonus).
- `fishing: false` forbids fishing on that map. Optional `grade: 1..5` sets the grade of its fish and life
  materials (default: from `band`; town and bandless maps are grade 1). The editor does not show it yet.
- `big`: `[{ "t": "house", "x", "y", "v": 0..7 }, { "t": "fountain", "x", "y" }]` — the 4×3 house
  sprites (v 0–3 town houses, 4–7 city blocks) and the plaza fountain. Omitted: one house per
  4×3 block of `h` objects.
- `marks`: `[{ "x", "y", "kind": "sign", "label": "↑ 버드나무광장", "to"?: mapId }]` — signpost texts
  for `G` objects (the waypoint mark is added by the game).
- `crops`: `[[x, y, crop], …]` hand-planted crop plots (H10 farm; crop 1 감자 · 2 당근 · 3 양배추 · 4 무 ·
  5 옥수수 · 6 호박, `CROP` in 12-life-tables.js) on open, walkable tiles: gathering nodes of kind 3 (작물), safe
  maps included. Omitted: none.
- NPC `lines` (≤ 12 strings, `{n}` = player name) are what the talk window shows, replacing the
  role's stock lines; role `elder` (main-quest giver) is allowed too.
- **Interiors** (`"theme": "interior"`, art in `public/iso_interior.js`; examples
  `tales_cafe.json`, `town_hall.json`, `starlight_inn.json`): a diorama room. Back walls stand on
  the north row (y = 0) and west column (x = 0) only; the south row and east column hold the low
  cut-down wall `_`, with one open tile (ground `e`, door mat) as the way out — no tall wall ever
  stands in front of the player. Optional `"style"`: `cafe` `hall` `inn` `library`, and for the
  town's workshops (docs/design/town.md F) `office` (log walls, maps on the long table) `forge`
  (coursed stone) `tavern` (half-timber; `j` = beer taps) `shop` (stripes; `j` = till and scale, `$` =
  potion case) `boutique` (pink stripes; `>` = clothes rail) `dojo` (paper screens) `lab` (green
  tiles; `:` = cauldron) `lobby` (flowers; `r` = mailboxes, `-` = a bare bench) — wallpaper,
  curtains, banners, cushions. Floors: `f` honey planks, `l` walnut, `h` herringbone parquet, `x`
  hearth flagstones, `q` checked rug, `u` round rug, `y` runner carpet, `e` door mat (rugs are drawn
  whole across touching tiles). A room may be as small as 8 × 8.
  Walls: `=` plain, `+` window (sunlight on the floor), `^` chalkboard (two side by side share a
  frame), `~` picture/map, `@` clock, `!` banner. Furniture (any theme draws it, every object
  blocks): `o` round table with lamp, `k` chair (turns to the next table), `s` armchair (turns to
  the hearth), `m` counter, `j` counter with coffee machine, `$` pastry case (counters join in
  runs), `b` bookshelf, `r` jar cupboard, `t` trophy cabinet, `#` fireplace (put a `fires` entry
  on the tile in front: it becomes the hearth to rest and cook by), `g` plant, `*` lantern, `v`
  notice board, `-` long table (joins), `p` bed, `w` barrel, `]` crates, `%` sleeping cat,
  `&` anvil, `<` furnace (glows, spits sparks), `>` rack (swords, a spear and a shield; clothes in a
  boutique, tools in a shop), `|` lectern with an open book, `;` specimen case (a pickled hell-beast
  that watches you), `:` stove with a stew pot (a `fires` entry in front makes it a hearth; a
  cauldron in a `lab`), `'` standing mirror, `` ` `` training dummy (drawn outdoors too)
  (symbols because the autumn kingdom owns `d f i z N V J` in the object layer). Outdoors `W` is
  the town's terrace wall (석축).
  Pieces against a back wall turn to face the room. Doors between town and a room (`links.json`
  on the house's doorstep, the room's `portals` back out) are drawn as house doors with a mat,
  not magic gates. Arrive one tile inside / one tile below the step, never on the door itself.
- NPC `goods` (role `shop` only): the item ids this keeper sells instead of the general shop
  list (the cafe's drinks, the inn's stew); the server refuses anything else at that counter.
  A keeper may stand one tile behind a counter (served across it).
- NPC `pose`: a small idle act drawn over the sprite — `sip` `read` `write` `wipe` `doze` `sweep`
  `hammer` `stir` `carry` `fish` `water` (a watering can) `knit` `wave`.
- NPC `thing: true`: an interactive object, not a person (a bookshelf, a notice board, a mirror,
  an anvil): no sprite, no mat, no idle act, no radar glyph; its `name` shows on the F prompt and
  its `role` gives the service (`collector`, `achieve`, `daily`, `costume`, `smith`, `job`, or
  `talk` with `lines`). It may stand ON a piece of furniture or a back wall (never on the cut-down
  front wall `_`) as long as one of its four sides is open floor (data:check says when not).
- NPC `look` with 5–6 values `[ear 0–4, eye 0–4, nose 0–4, clothHex, furHex, pattern 0–3]` gives
  an editor NPC its own fur and clothes (4-value looks keep the role's built-in appearance); a
  full hero look (8–11 numbers, species.js `PARTS` order: ear eye nose fur blush pat cloth species
  tail accent eyeColour) makes them any animal a hero can be (a panda, a penguin, a squirrel …).
- links.json: each entry is ONE-WAY (a two-way connection is two entries, or one entry plus a
  portal in the custom map's own file); the door tile's object is cleared; `label` replaces the
  door's "map name Lv.a–b" caption.

## links.json, npcs.json

```jsonc
// links.json — doors added to ANY map (built-in or custom); each entry makes one tile a door
{ "v": 1, "links": [ { "map": "town", "x": 20, "y": 2, "to": "willow", "tx": 24, "ty": 34, "label": "버드나무 마을" } ] }
// npcs.json — NPCs added to built-in maps (custom maps keep their NPCs in their own file)
{ "v": 1, "npcs": [ { "map": "town", "id": "town_baker", "name": "빵집 주인 보리", "role": "talk", "x": 12, "y": 20, "look": [3,0,0,"#c88a3a"], "lines": ["갓 구운 빵이 있다네!"] } ] }
```

## npclife.json

Optional object with `v: 1`, `places`, `cast` and `rel`. See [the NPC day contract](../design/npc-life.md)
for the fields and wire rows. An ordinary place has a safe map ID, a Korean label and `spots`, e.g.
`[[9,8,"e","sit"],[11,8,"w","sit"]]`. Give a list of `round` waypoints for a patrol, or `in: true`
for a hidden room with a knock spot. A cast entry uses an existing NPC ID, or a new ID with a
name, a full player look (`hero`) and home. `plan` blocks use `h` (04:00–27:59), `at` and `act`.
Optional `days` overrides pick 0–3 in the global four-day cycle. `with`, `rain`, `pose` and `lag`
specify companions, shelter, custom poses and patrol spacing. Fixtures stay in `npcs.json` or their map file.

`data:check` validates seat capacity, references, reachable spots and travel through map doors.
The routines add no character sheet fields.

## quests.json

```jsonc
{
  "v": 1,
  "main": null,          // null = built-in chain; or a full replacement array in the built-in format:
                         // { "mob", "n", "title", "text", "xp", "gold", "items": [[id, n]] }
  "side": [
    {
      "id": "sq_willow_1",                       // unique, [a-z][a-z0-9_]{2,31}
      "giver": "willow_elder",                   // NPC id (custom map NPC or npcs.json NPC)
      "title": "버드나무의 근심",
      "text": "마을 옆 연못에 이상한 개구리가 늘었네. 6마리만 쫓아 주겠나?",
      "done": "고맙네! 이제 밤에 잠 좀 자겠군.",
      "goal": { "type": "kill", "mob": "gutfrog", "n": 6 },
      //      { "type": "collect", "item": "fish_s", "n": 3 }      (items taken on hand-in)
      //      { "type": "collect", "item": "q_record", "n": 4, "mob"?: "blightsquirrel", "rift"?: true }
      //                 (quest item only: a kill of `mob` drops one 35 % of the time; `rift` = one per cleared rift chest)
      //      { "type": "talk", "npc": "town_baker" }
      //      { "type": "visit", "map": "willow" }
      //      { "type": "elite", "n": 1, "map"?: "forest", "mob"?: "hydrasnake", "named"?: "빛나는 눈의 세머리 뱀" }
      //      { "type": "fb", "n": 1, "map"?: "meadow" }
      //      { "type": "make", "item": "fd_rice", "n": 3 }        (own cooking/crafting/brewing; item = a life recipe's output)
      //      { "type": "deliver", "npc": "shop", "item": "q_reed_box", "n"?: 1, "time"?: 900 }
      //                 (item = ITEMS type "quest", given on take; npc takes it and completes; time 30–3600 s)
      //      { "type": "choice" }                                (nothing to do: ready on take, answer at the giver)
      "hint": "연못에서 낚시 · 모닥불에서 요리",           // optional, ≤ 80 chars, quest window
      "req": { "lv": 3, "quest": null, "flag"?: ["sq_reed_lunch", 0] },
      //      min level (1–200); optional named prerequisite; flag = that quest was answered with that pick
      "reward": { "xp": 300, "gold": 120, "items": [["hp_s", 3]], "keep"?: "kp_reed_float", "title"?: "부녀의 심부름꾼" },
      //      keep = a keepsake (ITEMS type "keep"); title (≤ 16) = a quest title (achievement t_<id>[_<pick>], 이야기)
      "choice"?: [                                // 2–3 answers on hand-in; each may have its own reply and reward
        { "label": "「아버지가 보내셨어요.」", "done": "…아빠가?", "reward": { "xp": 450, "gold": 200, "items": [], "keep": "kp_reed_float" } }
      ],
      "repeat": false
    }
  ]
}
```

Side-quest progress lives in the character sheet (`ch.sq`, migrated, sheet `v` bumped).

Game side, as built (62-side-quests.js): `ch.sq = { on: { id: progress }, done: { id: times },
flags: { id: pick }, t: { id: deadline } }` and `ch.keep = { keepsakeId: 1 }` (sheet v23; older sheets
get empty ones, and a delivery under way gets its quest item back). Up to 10 under way. Actions
(validated, Korean errors): `{t:"sq", a:"take", id}` beside the giver, `{a:"done", id, pick?}` beside
the giver — or the recipient of a delivery — (`pick` 0–2 when the quest has `choice`), `{a:"drop", id}`
anywhere (a delivery's item goes back), `{a:"talk", npc}` beside that NPC.
Progress: kill = kills of `mob` (party credit like the main quest), collect / deliver = what is in the
bag (taken on hand-in), talk = once, visit = arriving on the map (or taking it while there), elite /
fb = elite / field-boss kills (on `map`, of `mob`), make = outputs of the player's own recipes (a made quest
item is handed over too; a recipe with `sq: questId` is known only while that quest is under way).
Quest items (ITEMS type `quest`) can't be sold, stored or quick-slotted; one no quest names is removed
when the sheet loads. Steps of a story are quests chained by `req.quest` (branches by `req.flag`).
The client gets `defs.side` (each quest + `giverName giverMap turnIn turnInName turnInMap target
station`) and `self.sq` = `[[id, state, have, need, deadline?]]`, state 0 locked · 1 can take ·
2 under way · 3 ready · 4 done (a branch not chosen is left out), and `self.keep` = keepsake ids.
`main` replacement quests are cleaned (unknown mobs/items dropped) and their `xp` is scaled by
the game's XP curve exactly like the built-in chain.

## Editor server API (game/scripts/editor-server.mjs, http://localhost:5190, local only)

All JSON. Writes are restricted to `game/data/**` and `asset/**`; paths are validated.
```
GET  /api/palette            → { ground: [{ch, name, color, solid, themes}], objects: [{ch, name, color, solid}] }
GET  /api/defs               → { mobs: {key:{name,lv,boss,chest}}, items: {id:{name,type}}, roles: [...], themes: [...], bgm: [...] }
GET  /api/maps               → [ { id, name, builtin, custom, replaces, w, h, theme } ]
GET  /api/map/:id            → the map as editor JSON (custom file if any, else the generated map converted)
PUT  /api/map/:id            → save game/data/maps/<id>.json (validated; 400 with Korean errors)
DELETE /api/map/:id          → remove a custom map (built-in maps come back)
GET  /api/links | /api/npcs | /api/quests        PUT same → save the file (validated)
POST /api/check              → { ok, errors: [{file, path, msg}], warnings: [...] }
POST /api/build              → rebuild logic.js with the data, run data:check and the fast tests
GET  /api/assets             → asset/gallery.json (regenerated)   POST /api/assets/install {file, key} → import-art.mjs --install
POST /api/playtest {map,x,y} → make sure the local game server runs and return a URL that spawns a
                               dev character at that spot (local dev only; never in production)
```

Editor side, as built (additive; the routes above behave exactly as listed):
- `:id` in `/api/map/:id` is the map's id in the game (a built-in id for a replacement); the file
  written is `maps/<body.id>.json` (body.id may be the replacement's alias; body.id or body.replaces
  must equal `:id`). GET finds a file by its own id or by `replaces`. A second file replacing the
  same built-in is refused. PUT runs `game/editor/validate.js` (the same checks the app shows live)
  and answers `{ ok, warnings }` or 400 `{ ok:false, error, errors, warnings }` (`{file, path, msg, x?, y?}`).
  The full cross-file check stays `POST /api/check` (= editor-lib `checkData`).
- Every write: temp file + rename, previous version copied to `data/.backup/<file>.<time>.json`
  (last 20 per file). Bodies over 4 MB are refused. Requests whose Host/Origin is not local are refused.
- `GET /api/defs` adds `mobs[k].sp/tint` and `items[id].tier/wk/rune` (for the pictures) and
  `mainQuests` (the built-in chain as written in 10-tables.js, for "기본 퀘스트를 복사").
- `GET /api/maps` is editor-lib `listMaps` (with `file`). `GET /api/assets` adds `manifest`
  (public/assets/manifest.json). `POST /api/build?stream=1` streams the log as text and ends with
  `__RESULT__{"ok", "steps"}`; build = build-logic, data-check, tests `sim world data`.
- Extra routes: `GET /api/npcs/all` (every NPC: `{...npc, map, mapName, source: builtin|map|npcs.json}`),
  `GET /api/status`, `GET /api/playtest/log` (the wrangler output).
- `/api/playtest` runs build-logic, starts `node node_modules/wrangler/bin/wrangler.js dev -c
  wrangler.local.jsonc --port 8787` if nothing answers there (stopped with the editor), returns
  `{ ok, started, url }` with the URL below.
- `EDITOR_DATA=<dir>` makes the server read/write that folder instead of `game/data` (tests); then
  build only runs the data check and playtest is refused. `EDITOR_PORT` changes the port.

### /api/playtest — how the game honours it

The URL is `http://localhost:8787/?dev=1&map=<id>&x=<tileX>&y=<tileY>` (the dev server started with
`npm run dev:local`, i.e. `wrangler dev -c wrangler.local.jsonc`). The page logs in as usual; the
FIRST join of that page carries `dev: {map, x, y}` (public/lobby.js `joinMsg`). room.ts applies it
only when `env.PLAYTEST === "1"` (set in `wrangler.local.jsonc` only) and `HF_ENV !== "prod"`, via
`logic.devPlace(char, map, x, y)`: the character's saved position becomes that tile, or the nearest
standable one, or the map's entrance. The account needs a character already (make one first).
Rebuild logic.js after saving data (`npm run build:logic`; wrangler reloads) before playtesting.

### Game-side library (game/scripts/editor-lib.mjs) — import these, all async

```js
import { palette, mapToEditor, defsForEditor, listMaps, checkData, loadLogic } from "./editor-lib.mjs";
await palette()              // → GET /api/palette  { ground: [{ch,name,color,solid,themes,themeColors}], objects: [{ch,name,color,solid,themes}] }
await mapToEditor(id)        // the GENERATED map as editor JSON ("replaces": id for built-ins); null if unknown
await mapToEditor(id, { withData: true })   // the map as the game builds it with data/ (or { dataDir })
await defsForEditor()        // → GET /api/defs  { mobs, items, roles, themes, bgm, maps, npcs, quests, goals }
await listMaps(dataDir?)     // → GET /api/maps  [{ id, name, builtin, custom, file, replaces, w, h, theme }]
await checkData(dataDir?)    // → POST /api/check  { ok, errors: [{file, path, msg}], warnings } (Korean msg)
await loadLogic({ dataDir? | data? })      // the rules evaluated with that data (+ .E internals), no file written
```
`scripts/build-logic.mjs` exports `readData(dataDir)` and `buildLogic({dataDir|data})` too;
`node scripts/data-check.mjs [dataDir]` is the CLI (`npm run data:check`).
