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
  "theme": "meadow",              // town meadow forest crypt city sewer cave abyss interior (ground/wall art + palette)
  "bgm": "field",                 // audio.js TRACKS key
  "safe": false,                  // true = no monsters, no PvE damage (like town)
  "band": [5, 9],                 // level band shown on doors, or null
  "w": 48, "h": 36,               // tiles; 16..160 each
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

- `role`: `talk` (lines only), `quest` (gives side quests whose `giver` is this id), or any built-in
  service role (`shop smith train bank warp daily collector achieve costume`).
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
- `fishing: false` forbids fishing on that map.
- `big`: `[{ "t": "house", "x", "y", "v": 0..7 }, { "t": "fountain", "x", "y" }]` — the 4×3 house
  sprites (v 0–3 town houses, 4–7 city blocks) and the plaza fountain. Omitted: one house per
  4×3 block of `h` objects.
- `marks`: `[{ "x", "y", "kind": "sign", "label": "↑ 넥서스 광장", "to"?: mapId }]` — signpost texts
  for `G` objects (the waypoint mark is added by the game).
- NPC `lines` (≤ 12 strings, `{n}` = player name) are what the talk window shows, replacing the
  role's stock lines; role `elder` (main-quest giver) is allowed too.
- **Interiors** (`"theme": "interior"`, art in `public/iso_interior.js`; examples
  `tales_cafe.json`, `town_hall.json`, `starlight_inn.json`): a diorama room. Back walls stand on
  the north row (y = 0) and west column (x = 0) only; the south row and east column hold the low
  cut-down wall `_`, with one open tile (ground `e`, door mat) as the way out — no tall wall ever
  stands in front of the player. Optional `"style"`: `cafe` `hall` `inn` `library` (wallpaper,
  curtains, banners). Floors: `f` honey planks, `l` walnut, `x` hearth flagstones, `q` checked rug,
  `u` round rug, `y` runner carpet, `e` door mat (rugs are drawn whole across touching tiles).
  Walls: `=` plain, `+` window (sunlight on the floor), `^` chalkboard (two side by side share a
  frame), `~` picture/map, `@` clock, `!` banner. Furniture (any theme draws it, every object
  blocks): `o` round table with lamp, `k` chair (turns to the next table), `s` armchair (turns to
  the hearth), `m` counter, `j` counter with coffee machine, `$` pastry case (counters join in
  runs), `b` bookshelf, `r` jar cupboard, `t` trophy cabinet, `#` fireplace (put a `fires` entry
  on the tile in front: it becomes the hearth to rest and cook by), `g` plant, `*` lantern, `v`
  notice board, `-` long table (joins), `p` bed, `w` barrel, `]` crates, `%` sleeping cat
  (symbols because the autumn kingdom owns `d f i z N V J` in the object layer).
  Pieces against a back wall turn to face the room. Doors between town and a room (`links.json`
  on the house's doorstep, the room's `portals` back out) are drawn as house doors with a mat,
  not magic gates. Arrive one tile inside / one tile below the step, never on the door itself.
- NPC `goods` (role `shop` only): the item ids this keeper sells instead of the general shop
  list (the cafe's drinks, the inn's stew); the server refuses anything else at that counter.
  A keeper may stand one tile behind a counter (served across it).
- NPC `pose`: a small idle act drawn over the sprite — `sip` `read` `write` `wipe` `doze`.
- NPC `look` with 5–6 values `[ear 0–4, eye 0–4, nose 0–4, clothHex, furHex, pattern 0–3]` gives
  an editor NPC its own fur and clothes (4-value looks keep the role's built-in appearance).
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
      //      { "type": "talk", "npc": "town_baker" }
      //      { "type": "visit", "map": "willow" }
      "req": { "lv": 3, "quest": null },         // min level; side quest id that must be done first
      "reward": { "xp": 300, "gold": 120, "items": [["hp_s", 3]] },
      "repeat": false
    }
  ]
}
```

Side-quest progress lives in the character sheet (`ch.sq`, migrated, sheet `v` bumped).

Game side, as built (62-side-quests.js): `ch.sq = { on: { id: progress }, done: { id: times } }`
(sheet v8; old sheets get `{on:{}, done:{}}`). Up to 10 under way. Actions (validated, Korean
errors): `{t:"sq", a:"take"|"done", id}` beside the giver, `{a:"drop", id}` anywhere,
`{a:"talk", npc}` beside that NPC (the client sends it when you talk to a talk target).
Progress: kill = kills of `mob` (party credit like the main quest), collect = what is in the bag
(taken on hand-in), talk = once, visit = arriving on the map (or taking it while there).
The client gets `defs.side` (each quest + `giverName giverMap target`) and `self.sq` =
`[[id, state, have, need]]`, state 0 locked · 1 can take · 2 under way · 3 ready · 4 done.
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
