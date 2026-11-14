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
  "theme": "meadow",              // town meadow forest crypt city sewer cave abyss (ground/wall art + palette)
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
- `boss`: `{ k }` = the field boss the map's kills call out (like generated hunting grounds);
  `x, y` are informational. A map with monsters, a waypoint and a boss joins the rift rotation;
  with monsters it gets a collection page (no region bonus).
- `fishing: false` forbids fishing on that map.
- `big`: `[{ "t": "house", "x", "y", "v": 0..7 }, { "t": "fountain", "x", "y" }]` — the 4×3 house
  sprites (v 0–3 town houses, 4–7 city blocks) and the plaza fountain. Omitted: one house per
  4×3 block of `h` objects.
- `marks`: `[{ "x", "y", "kind": "sign", "label": "↑ 넥서스 광장", "to"?: mapId }]` — signpost texts
  for `G` objects (the waypoint mark is added by the game).
- NPC `lines` (≤ 12 strings, `{n}` = player name) are what the talk window shows, replacing the
  role's stock lines; role `elder` (main-quest giver) is allowed too.
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
