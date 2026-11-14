# AGENTS.md — 테일즈테일즈 (Tales Tales)

The one shared guide for every AI working in this repo (Claude Code, OpenAI Codex CLI, Google
Gemini CLI). `CLAUDE.md` and `GEMINI.md` only import this file. Keep it accurate: when you add,
move or split a file, update the file map here in the same commit.

**Token rule #0: if the `codebase-memory` MCP tools are available** (owner's PC, see
`docs/LOCAL_SETUP.md` §6), ask the code graph first — `search_graph`, `get_file_outline`,
`get_code_snippet`, `trace_path`, `get_architecture`, `search_code` — instead of opening files;
re-index after big merges (`index_repository` with `async: true`). Otherwise follow rule #1.
Same idea with **graphify** (owner's PC, `docs/LOCAL_SETUP.md` §7): if `game/graphify-out/graph.json`
exists, use `graphify query "<question>" --graph game/graphify-out/graph.json`, `graphify explain "<symbol>"`,
`graphify affected "<symbol>"` before opening files; refresh with `graphify update game` (no LLM, ~15 s).

**Token rule #1: do not re-explore.** Use the file map (§3) to open the one file you need, then
`grep -n` for the banner or function named there instead of reading big files top to bottom.
Run the rule tests instead of taking screenshots; take one targeted screenshot only for visual work.

Owner-facing setup (Korean, Windows): [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md).
Player-facing description (Korean): [`game/README.md`](game/README.md).

---

## 1. 게임 개요 — what the game is

A real-time online party-hunting RPG in the browser (Korean MMORPG lineage: 바람의나라, 어둠의전설,
테일즈위버, MapleStory, plus Diablo-style loot).

- **Heroes**: cute 16×16 pixel animals with tails (15 species, many face parts), carrying weapons as
  big as themselves. 4 classes: 전사 warrior (sword), 도적 rogue (dagger), 창술사 lancer (spear),
  마도사 mage (staff / book), each with its own gauge mechanic (투지 / 표식 / 창끝·집중 / 원소 엮기).
- **Monsters**: the opposite — grotesque "hell-beast" versions of real animals (two-headed hare,
  gut frog, eye crow …), 25+ kinds, elites with traits, field bosses, two big bosses.
- **View**: 2:1 isometric quarter view (32×16 ground diamonds), chunky pixels, one shadow tone, dark
  outlines. **HUD**: GBA/handheld style — brass 9-slice frames drawn in code (`frames.js`), Galmuri
  pixel font. **CRT** filter: scanlines, slight colour fringe, flicker — **no dark vignette**.
- **World**: hub town 넥서스 광장 → meadow, forest, crypt (dungeon), city, sewer (dungeon), cave,
  abyss (dungeon), and past the forest/abyss the autumn field 단풍 왕도 (`maple`, theme `autumn`, Lv.40–46). Hunting grounds are procedurally generated from fixed seeds (same map every boot).
- **Systems**: loot rarities/affixes/sockets/runewords/legendaries/sets, enhancement +10, endless stat
  training with XP, skill levels, parties (4), guilds, campfires, fishing + cooking mini-games,
  waypoints, dailies, achievements/titles, monster collection, half-hourly rift event, tutorial chain,
  warehouse, pets, cosmetics (외형) wardrobe, quick slots 1–9, chat with emoticons.
- All art and all sound are generated **in code** (no image/audio files except two fonts).

## 2. 구조 — architecture and data flow

```
browser (public/)                       Cloudflare Worker (src/worker.ts)
  lobby.js ── HTTP /api/* ────────────▶ api() ──▶ vault DO  "vault:characters"  (room.ts + accounts.js)
  client.js ─ WebSocket /ws/<channel> ─▶ Room DO, one per channel: s1-ch1 s1-ch2 s2-ch1 s2-ch2
                                           │ every 100 ms (alarm): logic.tick(world, now)
                                           │   for each socket: logic.viewFor(world, pid) → "snap"
                                           │   logic.endTick(world)
                                           │ every 15 s: logic.exportChar → vault "save"
                                           ▼
                                        src/logic.js  (ALL rules; generated from src/logic/*.js)
```

- **Server authoritative.** The client sends intents `{type:"action", action:{t:"mv"|"atk"|"sk"|"buy"…}}`;
  the room calls `logic.validateAction` then `logic.applyAction`. The client only predicts its own
  walking; the server corrects (`me[5]` = position fix flag).
- **Room DO** (`room.ts`): owns sockets and the clock, holds the world in memory only, re-arms an
  alarm while anyone is connected. Wire: in `join{token}` / `action` / `reset`; out `need_char`,
  `welcome{you, defs, room, server}`, `snap`, `rank`, `error{fatal?, auth?}`.
- **Vault DO** (same class, name `vault:characters`, path `/__vault/…`, never reachable from a URL):
  accounts, sessions, character records, name/guild claims, rankings, channel head counts.
  Character key (`pid`) = `<accountId>@<server>` → one character per account per server, shared by
  both channels of that server.
- **Account API** (`worker.ts`): `POST /api/signup|login|logout|me`, `GET /api/servers`; bodies are
  whitelisted by `accounts.js parseApiBody`. PBKDF2 passwords, 30-day session tokens (only hashes
  stored), login throttling. Client side: `public/account.js` + `public/lobby.js`.
- **Snapshots** (`viewFor`): compact positional arrays — `me`, `P` players, `M` mobs, `D` drops,
  `F` fires, `ev` events, `chat`, `fb` field bosses anywhere on the map (radar), `party` (each row ends with
  x, y, map id for the radar), plus `map` / `who` / `self` only when changed. Static tables go once
  in `welcome.defs` (`logic.defs()`); the client duplicates no rules.
- **Two deploy targets**: Higgsfield (app.manifest.json + `wrangler.jsonc`, builds `dist/` with bun;
  its build scripts are injected by the platform) and our own Cloudflare (`wrangler.deploy.jsonc`,
  Worker `lumentale-online`, served from `./public`, GitHub Actions on push). Local dev uses
  `wrangler.local.jsonc`. Storage does **not** move between them.

## 3. 파일 지도 — file map (lines in brackets)

### Server — `game/src/`
| file | owns · key exports |
| --- | --- |
| `worker.ts` [102] | Worker entry: `/api/*` → vault, `/ws/<channel>` → Room; re-exports `Room` (required) |
| `room.ts` [501] | `class Room` DO: join/auth, create character, action dispatch, 100 ms alarm tick, 15 s saves, vault ops `auth count load create save rank guild`; `VAULT_NAME`, `VAULT_PATH` |
| `protocol.ts` [60] | `parseClientMessage` — size limits and shape of untrusted frames |
| `accounts.js` [382] | plain JS (runs in DO and node): `SERVERS`, `CHANNELS`, `class Accounts` (signup/login/logout/auth/me/servers), `parseApiBody`, storage key scheme `K`, `pidFor`, throttle rules |
| `accounts.d.ts` [75], `logic.d.ts` [36] | types for the two plain-JS modules (update when exports change) |
| `env.ts` [22] | `Env` bindings: `ASSETS`, `ROOMS`, `HF_ENV`, `APP_SLUG`, `PLAYTEST` (local only: map-editor playtest join) |
| `logic.js` [7297] | **GENERATED** — never edit; built from `src/logic/*.js` |

### Rules — `game/src/logic/` (fragments of ONE scope, concatenated in name order; not modules)
| part | contents |
| --- | --- |
| `00-header.js` [130] | file doc, `meta`, core constants (`T`=16 tile px, `INV`, `MAXLV` = 200, view range, party), `WKIND` weapon kinds (incl. `bow` with `shot`, `crit`, `mag`), `CLASSES` (unused since jobs; J2 deletes), class-mechanic constants, elements `REACT`, **`SKILLS`** (per old class; until J2 picked by the weapon in hand) |
| `02-jobs-stats.js` [97] | jobs and stats tables (docs/design/jobs-and-stats.md): `STATS ST_ORDER`, point cost `LV_DIV STAT_K STAT_K0`, `TIER_MAX`, `WK_ORDER WK_NAME WM_MAX JOB_WM`, `GRADE SCALE JOB_PLUS`, **`JOBS`** (adventurer + 6 single + 6 hybrid), derived-stat constants `SFX`, `WM_GAIN`, templates `BUILD`, `OLD_CLASS`, bridge `LEGACY_CLS`, `WSW_MS SHOT_MAX` |
| `10-tables.js` [347] | gear names/tiers `GEAR`, **`ITEMS`**, `RUNES`, `RUNEWORDS`, `AFFIX`, `RARITY`, `LEGEND`, `SETS`, `TRAIN`, skill costs, `SHOP`, `ENH_RATE`, campfire/fishing/guild consts, `MASTERY`, `FIELD_BOSS`, elite `TRAITS`, `DENSITY`, cell spawning constants (`CELL WAKE_R SLEEP_R WAKE_MAX_MOBS SPAWN_MIN_D CELL_RESPAWN_MS` waves), **`MOBS`**, chests, **`QUESTS`** |
| `20-helpers-mapkit.js` [568] | `rnd(box)`/`ri`/`clamp`/`dist`, XP curve `xpNeed`, map primitives (`blank rect road portal finalize`), noise (`fbm`), A* `walk`, `bfs`, `poisson`, Voronoi `partition`, `grow`, `knit`, `stamp`, cellular `automaton`, spawn banding |
| `30-maps-overworld.js` [722] | set pieces `PIECE` legend + **`PIECES`** (incl. the fallen kingdom: chapel cottage watchtower kinggate graveyard …; `UPRIGHT` = never rotated, their ruin art stands on footprint chars `N d i f`), `piece()`, `wilds(cfg)` (meadow/forest/maple generator; optional `lair` `campPiece` `vaultMobs` `trail` `padMin`), `metro(cfg)` (city generator) |
| `31-maps-dim.js` [287] | 차원 균열 (party instance, docs/design/scale-and-rift.md D): **`DIM`** table (caps, gauge, shrines, toughness, rewards — balance here), `DIM_THEMES`, `DIM_TOWN` (obelisk/keeper/landing tiles), `dimPool`, **`dimension(cfg)`** (seeded 56×40 rooms-and-corridors map + `m.dim` layout/spawns) |
| `32-maps-underground.js` [630] | `tunnel`, `cavern` (cave), `catacomb` (crypt), `sewers`, `abyssal` (abyss) |
| `33-maps-zones.js` [231] | 4× grounds (docs/design/scale-and-rift.md C): `zoneMap` (m.zone safe/normal/elite/hidden by walk from the entrance, hidden `pockets`, minimap `zq`), `zoneSpawns` (colonies per 8×8 block of each zone), waypoint keys `wpKey wpOk stonesOf stoneName`, 질주의 바람 `windTouch` (`WIND_*`) |
| *(generated)* | `const DATA = {maps, links, npcs, quests}` — `build-logic.mjs` inserts `game/data/**` right after 00-header |
| `34-maps-world.js` [473] | `buildTown()`, **`GEN`** (every generated map's generator, band, `stones` and `cfg()`: seed, size (2× per side since Phase 1), mobs, chest, features), `GATE_LINKS` (doors by gate name), `genMap(id)` (one map: terrain, doors, zones + `zoneSpawns`, `markRoutes`: stones, wind shrines `/`, plaza fire, signs incl. zone signs), collision `solidAt/canStand/canFly`, `mapPayload` |
| `36-custom-maps.js` [314] | editor maps over the generated world: `fromEditor` (map file → map), `finishMap` (doors, links, NPCs, finalize, `buildCells` → `m.cells` spawn quotas per 16×16 cell); the **lazy map registry**: `MAP_META` (name/theme/band/size/wp/kinds of every map, nothing built), **`mapOf(id)`** (built on first use, cached), **`mapOfS(S,id)`** (+ instances `S.dims`), `allMaps()` (tools/tests), `arrivalOf` (a door's landing tile, resolved at warp time), `hasWp/wpOf`, sheet stones `wpWoken/wpCount`; `START`, `HUNTED`, `COL_MOBS`, `NPC_MAP`/`NPC_NAME`, `devPlace` (playtest). Town + editor maps are built at load, hunting grounds on first entry: never index a map table directly |
| `40-characters-world.js` [561] | `validName`, **`newChar`** (sheet `v:11`: v11 jobs `job st wm xpt rs sw cnt eq.weapon2`; v10 `bagCap`, `house`; v9 `wp` = {mapId: stone bitmask}, `dim` = {day, n}), **`migrate`** (old sheets), gear stats `stats()`, `exportChar`; world `setup`, **`runtime(S,id)`** (a map's live state, made on first use: fixed spawns + cell slots), `liveMapIds`, instances `registerDim/closeDim`, mobs `newMob/placeMob`, field boss, `addPlayer/removePlayer`, `changeMap`, `sys/toast`; parties |
| `45-jobs.js` [353] | `toTier shownLv eff pointCost batchCost levelOf nextCosts wmNeed scaleOf hybridOf jobOk legacyCls`, **`deriveStats(p)`** (the sheet's stats, cached in `p.stc`), mastery `gainWm wmHit newAct wmKill`, `grazeChance evadeBlow staggerPlayer`, arrows `fireArrow shotTick bowShot` (`rt.shots`), migration `allocate migrateV10 cleanJobs`, test helper `hero()` |
| `46-bag.js` [63] | the bag's size: `bagCap(ch)` (every bag check asks it; 40 → 100), `roomIn` (room in any list of slots), `sortSlots` (the 정리 of bag and house storage), `bagClean` (migrate), action `bag_expand` (`bagValidate/bagApply`, price curve `BAG_COST` in 10-tables) |
| `50-loot-combat.js` [503] | bag/stack/warehouse helpers, pickup, prices, `rollGear`, `rollRarity`, `lootFor` (`dropKind`); `gainXp` (only accumulates), `hurtMob`, `killMob`, `hurtPlayer`, targeting + aim helpers (`AIM_V setAim inArc aimMob`), `basicAttack` |
| `55-class-skills.js` [611] | class mechanics (grit, marks, focus, weave), `classTick`, `crView` gauge, **`castSkill`** (switch on skill id; emits numeric fx events `ev(code,…)`) |
| `60-content.js` [317] | waypoints + recall, dailies (06:00 KST), achievements `ACH` + titles, collection, world event (rift), tutorial `TUT` |
| `62-daynight.js` [184] | sky: `SKY_DAY_MS` (one outdoor day = 48 real min), `PHASES` 새벽/아침/낮/노을/밤, `weatherAt(map, now)` (6-min slots, `WX_ODDS`, rain → fish, fog → aggro), `CAMPS`/seats `sitDown`, warmth `warmthFor`/`warmTick`, `JAM` 연주/건배, night storyteller `TELLER`/`TALES`, `skyTick`, `skyAt` (tests) |
| `62-side-quests.js` [121] | editor side quests: `SIDE`, `ch.sq` (`sqClean`), `sqProgress` hooks (kill/pickup/talk/visit), `sqValidate`/`sqApply` (action `sq`), `sqView` |
| `64-dim.js` [449] | 차원 균열 manager: ready check (`dimOpen rcCheck`), `dimStart`, `dimKill` (gauge, orbs, shrines), `dimBoss`, `dimClear`/`dimChest`, `dimTick` (timer, cleanup, pickups, portal), `dimRespawn`, actions `dimValidate/dimApply` (`dim_open dim_ready dim_cancel dim_leave dim_join`), wire `dimView` (`dim` `rc` `dj`), `dimDefs`; helpers `dimCnt` `dimLvOf` `dimHk` |
| `64-housing.js` [478] | a house of one's own: sheet `house` (`homeEmpty houseClean`), private runtime map `house_<eid>` in `S.homes` (`homeMap homeOpen homeRebuild homeClose homeEnter homeLeave homeTick`, `homeDoor` = the town's "내 집" door), placement rules `placeWhy allReach`, actions `homeValidate/homeApply` (`house_buy house_upgrade house_style house_visit house_leave furn_buy furn_place furn_rot furn_pick h_dep h_wd h_sort h_rest`), wire `homeSelf homeWire homeDefs`; tables `HOUSE_TIER FURN HOUSE_FLOOR HOUSE_WALL HOUSE_REST HOUSE_TOWN` in 10-tables |
| `65-cosmetics.js` [125] | `COSMETICS` catalogue, `COS_SLOTS`, wardrobe helpers `cosClean cosWire giveCos cosFrom` |
| `70-validate.js` [348] | **`validateAction`** — one `case` per action `t`: respawn opt look chat p*/g* (party/guild) qs sort emo cos_* title daily tut mv atk warp sk use eq uneq rune train sklv wh sellall buy sell enh sit fish hook reel cook salv bq quest |
| `75-apply.js` [522] | **`applyAction`** (same cases, mutates state), `afterGear` |
| `80-simulation.js` [497] | mob AI (`tickMob`, specials, traits), active-area cells (`cellPass`: wake/sleep, density, waves, out-of-sight fill, cap), **`tick(S, now)`**, `endTick`, `isGameOver` |
| `90-views-api.js` [163] | `selfPayload`, **`viewFor`**, `atlas`/`mapStats` (tests), **`defs()`** (tables sent to the client) |

### Client — `game/public/` (plain ES modules, no build step; `index.html` loads `client.js?v=…`)
| file | owns · key exports |
| --- | --- |
| `index.html` [364] | all HUD/window markup (`section.window#w-<id>`), `#menu`, cache tag `?v=` |
| `client.js` [2563] | game client. Sections (grep `// ───`): connection, state `G`, messages (`onSnap`), effects, input (keydown hotkeys ~L537), player actions, update, render, HUD & windows (`WIN` list, `openWin`, window placement `placeWin`/`keepIn`/`fold` — safe zone, side by side, else fold to tabs; `render<Window>()`), main loop. `layout()` sets the docks (`sideW`/`dockH`) and `--vpw --vph --zone-w --zone-h`. `window.__game = {G, act, S3, go, openWin, closeWin, closeAll}` for automation |
| `lobby.js` [593] | title, 로그인/회원가입, server/channel list, character creation, in-game channel switch/logout |
| `account.js` [99] | HTTP side of accounts: `session signup login logout me servers`, `API` base |
| `scene2d.js` [2986] | the world renderer: `iso/project/pick`, `init/resize`, `loadMap`, `sync(G)`, `render`, scenery sprites (+ `autumnScenery`), ground (`drawGround`: whole canvas, or on big maps the visible chunks + one prefetched per frame; walls/rock stand up lazily near the screen, `lazyTall`; the deep places' glow in pieces, `pulsePart`), raised blocks, creatures (`drawPerson`; movement life `stepLife`: bob, lean, stop squash, terrain footsteps `footKind/footstep`, afterimage), effects `fx/fxCustom` (+ `flash wave zap`), sword-qi `qiBurst` at each stroke's impact, bow arrows `fx.arrow/arrowEnd/arrowHit` + `arrowSprite` (64 directions, trail, piercing streak, stuck in walls), the string's snap `bowSnap`, skills' scaled set `big(ang)`, `shake(n, ang)` (directional kick), pets, title/creation stage; `groundInfo()` (load/bake costs for tools) |
| `isotiles.js` [65] · `iso_px.js` [118] · `iso_ground.js` [939] · `iso_tall.js` [601] | quarter-view ground baking (`bakeGround` whole; `groundChunks` = 1024×512 pieces baked on demand with an LRU of 12 for maps over `CHUNK_AREA` 80×60 tiles, `?chunks=1` forces; `bakeChunk` gives the same pixels as the same part of `bake`), pixel buffers/projection (`TW=32, TH=16`), ground materials and transitions, tall blocks (cliffs, walls, houses) |
| `iso_interior.js` [1188] | indoors (theme `interior`): `bakeRoom` floors (herringbone too) and rugs, `roomPiece` back walls / cut front wall / furniture (a texel `Model` with depth buffer), `roomLight` warm lamp/fire/window light, `drawPose` NPC idle acts; a house's turns `fd` and its storage chests, teddy, fishbowl, gramophone; char legend in its header and SCHEMA.md |
| `decor.js` [674] | landmarks (`LANDMARKS` per theme; autumn ruins stand exactly on their footprints), decals, pulses, critters, waypoint stones/signs, town dressing (old `daylight`/`wash`, unused) |
| `autumn.js` [40] | the autumn theme's turned colours: `HUE` (maple, oak, ginkgo, green) and `hueAt(m, x, y)`, shared by trees (scene2d) and their fallen leaves (iso_ground) |
| `sky.js` [366] | the outdoor sky: server-synced clock (`setSky(dn)`, `hour phase nightK clockText`), the grade (`grade`: one multiply + stepped light pools + bloom, never a vignette), weather (`drawWeather`: rain, fog, cloud shadows, wind, snow, fireflies), HUD icon; preview overrides `__skyHour`/`__skyWx` |
| `camp.js` [153] | campfire company art: `stump bedroll ring tripod lute cup spiritTree` (정령나무) |
| `housing.js` [416] · `houseart.js` [389] | bag size bar (`bagBar`), 하우징 안내인 window `#w-house`, inside a house: `#house-hud`, 집 꾸미기 `#w-deco` (furniture in hand, ghost on the hovered tile with the server's refusal reasons, turn/pick, styles, upgrade), 집 보관함 `#w-hstore`, F at a chest/bed, `ho` events; `window.__house` · art: 16×16 furniture icons `furnIcon` (pixel grids; the pieces are `iso_interior.js` chars `[ { } ( ) ?`) |
| `dimrift.js` [215] · `dimart.js` [171] | 차원 균열 client: `onSnap` (`dim` `rc` `dj`), `onEvent` (`dm dp dz`), rift HUD `#dim-hud`, ready check `#w-rc`, keeper window `#w-dim` (`openKeeper`), shrines/orbs/way home/chest as `S3.props`, `miniDots`; `window.__dim` for automation · art: `obelisk obeliskAnim drawPylon drawOrb drawPortal drawChest`, `PYLON` kinds |
| `art.js` [910] | item icons `buildIcons`, minimap colours `renderMini` (the radar's texture), old scenery helpers; re-exports `chars.js` |
| `radar.js` [600] | the radar (side-column minimap, player-centred: zoom `ZOOMS` ± remembered, texture window blitted through the iso turn, glyph marks, party discs pinned to the rim, my aim arrow; `perf` draw ms) and the map window `#w-map` (M; tabs 현재 지역 = whole map, zoom/pan, click a woken stone to warp · 월드 노선도 = regions from `defs.maps[].to` in columns by doors from town); `init(deps) loadMap draw drawWin opened` |
| `chars.js` [471] | legacy smooth illustrated figures (re-exported by art.js; heroes now come from sprites.js) |
| `sprites.js` [1259] | 32×32 sheets: heroes `personSheet/playerLook`, NPCs, pets, weapons `weaponSprite`, `monsterSheet`, tints |
| `species.js` [403] | hero species and face parts: `SPECIES PARTS TABS PRESETS cleanLook withSpecies` (limits mirror logic `LOOK_MAX`); fit data for worn things: `EARS headAnchor faceAnchor EYE_PIX HEAD_BOB` |
| `looks.js` [244] | look editor (creation tabs) and the town mirror |
| `mobart.js` [588] + `mobart_kit.js` [139] + `mobart_a/b/c/d.js` [376/309/561/268] | monsters as 3D-primitive models rasterised to pixels; `BEASTS_A` meadow/forest, `_B` crypt/city, `_C` sewer/cave/abyss/bosses/chest, `_D` 단풍 왕도 (blighted beasts and plants); `has draw icon KINDS` |
| `weapons.js` [749] | weapon art per kind × tier (sword dagger spear staff book bow), legendary/set looks, skins, glow: `DESIGNS weaponSprite weaponIcon`, `bowSprite(gear, pull, arrow)` (a bow at every pull of its string; motifs bent along the limb); an installed image (`assetKey`: manifest `weapon.<kind>.t<n>`/`.lg.`/`.set.`/`.skin.`, `icon.weapon.…`) replaces a look, rarity ink + glow still applied |
| `wardrobe.js` [807] · `wardrobe_ui.js` [283] | cosmetic layers drawn over heroes (`ART SLOTS dress anchors`; designs `HAT TOP BACK FACE`, rules in the header); costume shop + 외형 tab |
| `swing.js` [187] | weapon stroke poses for attacks/casts; the tempo `WIND IMPACT SNAP` (15% wind-up, snap, blow at 0.2) with out-expo/out-back easing; the bow's shot `bowPose` (pull, arrow, release at IMPACT, `bowup` skyward cast) |
| `skillfx.js` [459] | skill visuals/sounds per server fx code (`skillEvent`, switch on codes 40–75), props, marks; the bow: `bowFire` (fx code 6, from client attackFx) and the arrow events `ar`/`ae` |
| `skillicons.js` [471] · `uiicons.js` [114] · `emoticons.js` [164] | 16×16 skill glyphs, 12×12 UI glyphs (`MENU_ICON TRAIT`), chat emoticons |
| `classgauge.js` [152] | class gauge in the status panel |
| `mastery.js` [142] | weapon-mastery strip in the dock (weapon in hand, "숙련 Lv.N", bar; hybrids show both) and its hover card (six weapons, job, next unlock); reads `self.wm/wk/wk2/job`, Lv.1 until the server sends `wm` |
| `growth.js` [292] | skill training, warehouse, pets, auto-potion, drop names (client side) |
| `quickslots.js` [327] | quick slots 1–9 (drag skills/items, keys) |
| `minigames.js` [269] | fishing rhythm game, cooking tangram |
| `npctalk.js` [80] | NPC flavour lines by role (an NPC with `lines` from the editor says those) |
| `sidequests.js` [125] | side-quest cards in the talk window, quest-window entries, "!"/"?" over givers |
| `frames.js` [85] | HUD 9-slice frame art → CSS custom properties |
| `audio.js` [844] | chiptune synth: `TRACKS` (per-map music), `SFX` catalogue, `Sound.play(name)` |
| `titlescene.js` [510] | title-screen diorama and pixel logo |
| `assetlib.js` [131] | external asset loader, `ready()` awaited at client start-up; `canvas meta has loadImage loadAudio loadSounds play`. Used by weapons.js and art.js `buildIcons` (`icon.item.<id>`) |
| `style.css` [351] · `hud.css` [721] · `lobby.css` [225] | base + CRT, HUD/windows (the last section, "responsive": breakpoints ≤1100 wide / ≤640 high / ≤860 phones, the window safe zone, scrolling bodies, folded tabs, text wrapping), lobby |
| `assets/manifest.json` | installed external images/sounds by key (empty = all code-drawn); written by `scripts/import-art.mjs --install` |
| `fonts/` | Galmuri pixel fonts (OFL) |
| `_*.html` | dev preview pages (never deployed, `.assetsignore`): scene world iso over mobs sheet species wardrobe swing feel (skill blasts, hits, footsteps as frame strips) bow (`?m=art|draw|arrows|fight`: tiers × pulls, the shot in 8 aims, arrows) title icons uicons emo mini house (furniture icons + every piece turned N W S E) chunks (chunked vs whole ground bake, pixel by pixel; `scripts/bake-check.mjs`) |

### Tests — `game/tests/*.mjs` (plain node + `node:assert`; list in `tests/LIST`)
sim (smoke) · party · loot (gear, repeat hunting) · life (fires, fishing, cooking, guilds) · world
(map graph, dungeons, quests) · hard (crowds, elites, traits) · content (long game, old sheets) ·
growth (stat points, cooldown cut, mastery attack, warehouse, pets, scrolls) · skills (old class mechanics, via the weapon in hand) · jobs (six stats, point costs, derived stats golden rows, mastery, grazes/evasion/stagger, job change, respec, starter, hybrid swap, shown levels, the bow's arrows, any-kind drops) · balance (probe vs the pre-jobs baseline; J2 asserts) · aim (blows/skills go where you aim, nothing behind) · feel (hitstun: stagger pauses cooldowns, knockback stops at walls, bosses immune) · maps (generators:
connectivity, determinism, per-map build time, lazy registry + MAP_META ↔ built map, instances, 4× sizes, zones, pockets, stones, shrines) · cells (wake/sleep, out of sight, farming not reset, party density, cap, waves) · scale (4× grounds in play: stones and warp between them, wind shrine, old sheets moved to the entrance, cells round the hunter) · hotbar (quick slots, party chat, tidy) · wardrobe (cosmetics) · cosmetics (every cosmetic × species × view ×
frame: inside the sheet, closed outline, eyes uncovered, art in every view, in its place) ·
looks (species ↔ LOOK_MAX) · mobart (every mob has a model that fits its canvas) · accounts (vault
logic with a fake store + client contract) · daynight (clock, weather per map/slot, wire `dn`, stumps, warmth 1–4, 연주/건배, storyteller, rain/fog flavour) · data (editor data: sample map, links, side quests, round
trip, data:check errors, sheet v9) · dimrift (차원 균열: generator, ready check, gauge/orbs/shrines, master, chest, death, cleanup, wire, bot-party clear time; `-v` prints the times, `HPB= BOSSHP= NOCLEAR=1 MORE=1` for tuning) · housing (bag 40→100 and its costs, bag size in every way in, house buy/upgrade, door, furniture place/turn/pick with collisions, wall pieces, reach and limits, storage and its chests, rest, party visits, instance cleanup, old sheets of every version) · interiors (town doors in and out of the cafe/hall/inn, diorama
walls, keepers' own goods).

### Scripts — `game/scripts/` (pure node; work on Windows)
`build-logic.mjs` (concat parts + `data/**` → logic.js; `--check`, `--watch`; exports `readData buildLogic`) ·
`editor-lib.mjs` (for the map editor: `palette mapToEditor defsForEditor listMaps checkData loadLogic`) ·
`data-check.mjs` (`npm run data:check`, Korean errors with file/path) · `editor-server.mjs` [~400]
(`npm run editor`, EDITOR.bat: the map editor's local server on 127.0.0.1:5190 — serves `game/editor/`,
`/public/` and `/asset/` read-only, the SCHEMA.md API; editor-lib runs in a recycled child process;
writes only `data/**` with backups in `data/.backup/`; starts `wrangler dev` for playtests;
`EDITOR_DATA=<dir>` edits another folder) · `test-all.mjs` (build + run
tests/LIST; `--no-build`, names to filter, `-v`) · `dump-maps.mjs` (public/_maps.json for previews) ·
`balance-probe.mjs` (a template hero vs its band's monsters for 120 s: kills/min, damage taken, deaths; tests/balance.mjs) · `bake-check.mjs` (headless: chunked ground bake == whole bake on every map, with bake ms and canvas MB; `--src` other map payloads) · `shot.mjs` (one screenshot; `--serve` for previews; scene preview takes `hour= wx= sitters= jam=`) · `bots.mjs` (dev: N throwaway players sit at the town fire for live shots, `--url --secs --jam`) · `artkit.mjs` (shared: browser launch, static server, PNG
read/write) · `export-art.mjs` (`npm run art:export`: code-drawn art → `asset/_export/` PNGs) · `gallery.mjs`
(`art:gallery`: index `asset/` → `gallery.json/.js`) · `import-art.mjs` (normalise AI/external images into
`asset/<category>/`; `--install`/`--uninstall`/`--list` wire approved files into `public/assets/manifest.json`) ·
`pixcanvas.mjs` (a tiny canvas so the code-drawn heroes render in node) · `cos-audit.mjs` (cosmetics × species
contact sheets → `game/shots_cos/`).
`build.mjs`/`check-logic.mjs` referenced by the `build` script are Higgsfield's and are not in the repo.

### Other
`game/data/` map-editor data, built into logic.js (contract: `docs/editor/SCHEMA.md`): `maps/<id>.json`
(sample `willow.json` 버드나무 마을; the town's interiors `tales_cafe` 테일즈 카페, `town_hall` 넥서스 마을회관,
`starlight_inn` 모닥별 여관), `links.json`, `npcs.json`, `quests.json` · `game/editor/` the map
editor app (plain ES modules, Korean, no build; imports `/public/` art modules; owner guide
`docs/editor/README.md`): `app.js` (tabs, keys, help) · `ui.js` (DOM, API, dialogs, pickers, mob/item/NPC
pictures) · `validate.js` (map/links/npcs/quests checks, shared with the server) · `mapedit.js` (맵 tab:
canvas, tools, layers, undo, panels, NPC form, save/playtest) · `preview.html` (quarter view via
`scene2d.js`) · `quests.js` `npcs.js` `assets.js` `build.js` (other tabs) · `editor.css` · root
`EDITOR.bat` starts it · `ai/` AI team: `TASKS.md` task board, role files `codex.md` `gemini.md` `merge.md`, `reports/`, `worker.bat` (workers run in git worktrees `.work/<name>` on branch `<name>/work`) · root launchers `PLAY.bat` `AI-TEAM.bat` `AI-MERGE.bat` `UPDATE.bat` `TESTS.bat` `ASSETS.bat` (export + gallery), `install.ps1` (one-step Windows setup), `.vscode/tasks.json` (VS Code: starts the AI team on folder open) · `asset/` (repo root) art/sound library and gallery `index.html` (not deployed; §9) · `ai/prompts/weapon-assets.md`
(asset review + Codex/ChatGPT weapon prompts) · `.claude/agents/` 22 specialist roles adapted from the MIT "Claude Code Game Studios" template (game/systems/economy/level designer, narrative, writer, art director, technical artist, sound, UX, gameplay/network programmer, QA, performance, live-ops, security, producer…); Claude uses them as subagents, and Codex/Gemini may read one as a role guide (e.g. Gemini doing balance → `economy-designer.md`) · six more from the MIT "The Agency" collection, prefixed `agency-` (whimsy-injector, ui-designer, reality-checker, game-audio-engineer, narrative-designer, accessibility-auditor) · `.claude/skills/pixel-art/` pixel-art
rules (any AI may read `rules/*.md`) · `.github/workflows/deploy-game.yml` CI (split check, tests,
deploy) · root `index.html`/`profile.jpg` = the owner's unrelated GitHub Pages profile.

## 4. 절대 규칙 — hard rules

1. **Never edit `game/src/logic.js`.** Edit `game/src/logic/NN-*.js`, then `npm run build:logic`
   (or keep `npm run watch:logic` running). Commit the parts AND the rebuilt `logic.js` together.
   CI fails on a stale file. A new part needs a two-digit prefix; order matters (a `const` must be
   declared in an earlier part than any code that runs at load time and reads it).
2. **Determinism in the rules.** No `Math.random`, `Date`, `performance`, `import`/`require` in
   `src/logic/` (the build refuses them, comments included). Randomness: `rnd(box)` / `ri(box,a,b)`
   with a seed box (`S` world state, map cfg). Time: the `now` the room passes in (`S.now`).
3. **Server authoritative.** Every rule, price, cooldown, range and drop lives in logic. The client
   draws and asks; validate in `validateAction`, mutate in `applyAction`. Never trust client numbers.
4. **Character sheets are persisted.** New field → default in `newChar` AND normalise in `migrate`
   (old sheets lack it; clamp everything). Never rename/remove a field without a migrate mapping.
   Bump `v` when the shape changes. Add an old-sheet case to a test (`content.mjs`/`wardrobe.mjs`).
5. **Wire compactness.** Snapshots go 10×/s to every player: positional arrays, append new fields at
   the end, send big things only when changed (`sendMap`, `who`, `dirty` → `self`). Update the client
   decoder (`client.js onSnap`) in the same change. Static data goes in `defs()`, not snapshots.
6. **Korean UI text.** Every player-facing string (items, errors from validateAction, toasts, windows)
   is Korean. Code, comments, identifiers and commit messages are English.
7. **Art direction.** Cute, simple 16×16 animal heroes (dot eyes, one shadow tone, dark outline) vs
   grotesque hell-beasts; 2:1 iso; GBA-style HUD; CRT without dark vignette. Follow
   `.claude/skills/pixel-art/rules/` (no blur/AA mush, no pillow shading, readable silhouettes).
   Art is **code-drawn by default**. External or AI-generated images are allowed ONLY through `asset/` →
   `scripts/import-art.mjs` normalisation → owner approval → `--install` (manifest), with the source and licence,
   or "AI-generated (tool, prompt file)", recorded in `asset/CREDITS.md` (§9). Unknown licence ⇒ `asset/reference/` only.
8. **Cache tag.** After changing anything in `public/`, bump `?v=` (all four occurrences) in
   `public/index.html`.
9. **Accounts/storage keys** (`accounts.js` header) are a live data format: never change a key shape
   without a migration path.
10. **Secrets**: never commit tokens, `.dev.vars`, Cloudflare credentials, or `shots/.shot-account.json`.

## 5. 실행 — how to run (from `game/`)

```
npm install                 # once (Windows: also fine; .npmrc sets legacy-peer-deps)
npm run dev:local           # builds logic, then wrangler dev → http://localhost:8787 (two tabs = two players)
npm run watch:logic         # 2nd terminal while editing src/logic/*.js (wrangler reloads on change)
npm run test:rules          # build + all rule tests in tests/LIST (~15 s); one: node scripts/test-all.mjs maps
npm run check:split         # is logic.js up to date?
npm run data:check          # validate game/data/** (maps, doors, NPCs, quests)
npm run editor              # the world map editor → http://localhost:5190 (EDITOR.bat does this)
npm run typecheck           # tsc --noEmit for the TS server files
npm run deploy:cf           # checks + tests, then wrangler deploy -c wrangler.deploy.jsonc (needs `npx wrangler login`)
```
Higgsfield: its pipeline runs `bun run build` (check:logic, tsc, its own build.mjs → dist/) from the
committed files; `logic.js` must stay a single generated file with no imports. Local wrangler state
lives in `game/.wrangler/` (delete it to reset local accounts/characters).

## 6. 싸게 검증하기 — verify cheaply

1. Rules change → `npm run test:rules` (or the one relevant test). Add/extend a test for new rules;
   tests are the cheapest proof. No screenshot needed.
2. Client JS change without visual impact → nothing type-checks `public/`; load the game once with
   `node scripts/shot.mjs --live` (after `npm run dev:local`) and read the printed page errors.
   Server TS change → `npm run typecheck`.
3. Visual change → ONE targeted screenshot, smallest that shows it:
   - `node scripts/shot.mjs --map meadow --out shots/x.png` (scene preview, stands at the waypoint)
   - `--page scene --map crypt --x 30 --y 22 --q "mobs=ratking,bonehound&el=1&cls=mage&wk=staff"`
   - `--page mobs --q "k=twinhare,lambmaw&z=4"` · `--page sheet` · `--page species` · `--page wardrobe`
     · `--page world --map forest --full` · `--page over --map cave` (spawns, reach, fires) · `--page iso`
   - real game: `--live [--keys i] [--eval "__game.go(400,300)"] [--wait 3000]`
   - `npm run preview` serves the pages for a normal browser (http://127.0.0.1:5178/_scene.html?map=town)
   shot.mjs prints page/console errors; fix those before looking at pixels. Needs `npx playwright
   install chromium` once, or uses installed Edge/Chrome automatically.
4. Prefer preview pages over the live game for art (no login, deterministic, fast).

## 7. 여러 AI의 git 작업 — git workflow for multiple AIs

- On the owner's PC the AI team runs from `ai/` (see `ai/README.md`): Codex and Gemini work in
  `.work/codex` / `.work/gemini` on `codex/work` / `gemini/work`, take tasks from `ai/TASKS.md`, write
  `ai/reports/*.md`, and Claude merges with `ai/merge.md`.
- One task = one branch (or one `git worktree`) per AI: `claude/<task>`, `codex/<task>`,
  `gemini/<task>`. Never two AIs in the same working tree at once.
  `git worktree add ../tt-codex -b codex/<task>` → work there → `git worktree remove ../tt-codex`.
- Small commits, English messages "Area: what changed and why" (see `git log`). Stage by path, not
  `git add -A`. Run `npm run test:rules` before every commit that touches rules.
- Before handing back: `git fetch && git rebase origin/<integration-branch>`; regenerate logic.js
  after resolving conflicts in parts (`npm run build:logic`) — never hand-merge `logic.js`.
- The integrator (normally Claude) reviews the diff, runs tests, merges into the integration branch
  (`main`; the old `claude/topdown-2d-mmorpg-dev-jke7w3` branch is merged into it), and pushes. Pushing there triggers the CI deploy.
- Never commit secrets, `node_modules`, `.wrangler/`, `shots/`, `asset/_export/`, `asset/reference/` files, or
  downloaded assets outside `asset/`.

## 8. 작업 레시피 — task recipes (which files to touch)

**Add a monster**
1. `src/logic/10-tables.js` `MOBS`: `key: { name:"한글", lv, hp, atk, def, spd, xp, gold:[a,b], aggro, range, cd, …moves }`
   (moves: `charge leap slam pool fan`, `fly`; `sp`/`tint` reuse another body in another colour).
2. Spawn it: the map cfg `mobs:[…]` in `src/logic/34-maps-world.js GEN` (and `FIELD_BOSS`/
   `QUESTS`/`REGION_BONUS` if relevant).
3. Art: a `BEASTS_*` entry in `public/mobart_a|b|c.js` (zone file) using `mobart_kit.js` parts; add it
   to the zone list in `public/_mobs.html`.
4. `npm run test:rules` (mobart checks every mob has a model that fits; maps/world check spawns),
   then `node scripts/shot.mjs --page mobs --q "k=<key>&z=4"`.

**Add an item**
1. `src/logic/10-tables.js` `ITEMS` (`type`: pot food fish scroll buff camp revive pet mat rune or gear);
   sold? add to `SHOP`. Gear tiers come from `GEAR`.
2. Behaviour: `case "use"` in `70-validate.js` and `75-apply.js` (or the relevant system); drops in
   `50-loot-combat.js lootFor`.
3. Icon: `public/art.js buildIcons` (by type/id). Quick-slot-usable types: `QS_USE` in 40-characters-world.
4. Test in `tests/loot.mjs` or `growth.mjs`.

**Add a skill**
1. `src/logic/00-header.js SKILLS.<class>`: `{ id, name, lv, mp, cd, mult, …, desc }` (Korean name/desc).
2. Behaviour: `case "<id>"` in `55-class-skills.js castSkill`; emit a new fx code with the local
   `ev(code, x, y)` helper (codes 40s warrior, 50s rogue, 60s lancer, 70s mage).
3. Client: visuals/sound for that code in `public/skillfx.js skillEvent`; icon glyph in
   `public/skillicons.js GLYPH` (`_icons.html` previews); new sound in `audio.js SFX`.
4. `tests/skills.mjs`.

**Add a map set piece**
1. Rows in `src/logic/30-maps-overworld.js PIECES` using the `PIECE` legend (`*` chest, `#` fire …).
2. Use it: add the name to a map cfg's `vaultKinds` or `features` in `34-maps-world.js`.
3. New tile/object character? solidity (`SOLID_G` in 20-helpers-mapkit; any object blocks), drawing in `public/scene2d.js`
   (scenery sprites) / `iso_tall.js` / `iso_ground.js`, minimap colour in `art.js renderMini`,
   preview colours in `_over.html`.
4. `node scripts/test-all.mjs maps world`, then `shot.mjs --page over --map <id>` and `--map <id>`.

**Add a UI window**
1. Markup: `<section class="window" id="w-<id>" hidden>` in `public/index.html` (copy one) + a
   `#menu button[data-win="<id>"]` with a `uiicons.js MENU_ICON`.
2. `public/client.js`: add `<id>` to `WIN`, a hotkey in the keydown switch (Korean 2-set key too, e.g.
   `case "u": case "ㅕ":`), a `render<Id>(s)` registered in `refreshUi()` as `draw("<id>", () => [deps…], render<Id>)`; styles in `public/hud.css`.
   Keep the `header` + `.body` shape: hud.css then caps it to the safe zone (`--win-max` for a wide one) and scrolls the body;
   `placeWin` places it beside open windows or folds them.
3. Data it needs: `selfPayload` in `90-views-api.js` (send only when dirty) or `defs()`; actions via
   `act({t:…})` + validate/apply cases. Bump the `?v=` cache tag.
4. `shot.mjs --live --keys <key>`.

**Add content with the editor data files** (`game/data/`, format in `docs/editor/SCHEMA.md`)
0. Normally the owner does this in the editor (`npm run editor`). Changing the editor: drive it with
   Playwright against a copy (`EDITOR_DATA=<scratch copy of data> npm run editor`), never the real data.
1. A map: `data/maps/<id>.json` (new id, or `"replaces": "<built-in id>"`; start from
   `editor-lib.mjs mapToEditor(id)`); doors in its `portals` + an entry in `links.json` for the way in.
2. NPCs on built-in maps: `npcs.json`; side quests: `quests.json` `side` (giver = an NPC with role
   `quest`); `main` replaces the main chain. No rules code needed.
3. `npm run data:check`, then `npm run test:rules` (rebuilds logic.js; commit data + logic.js together).
   Playtest: `npm run dev:local`, open `http://localhost:8787/?dev=1&map=<id>&x=<tx>&y=<ty>`.

**Add a sound / music**
- Effect: a function in `public/audio.js SFX` (synth: `this.tone`, `this.noise`), optional level in
  `BOOST`, rate limit in `THROTTLE`, priority in `IMPORTANT`; play with `Sound.play("name")`. Server-driven sounds are
  played from event handlers in `client.js`/`skillfx.js`.
- Music: a track in `audio.js TRACKS`; a map picks it with `bgm` in its cfg.
- External file instead: §9 + `Assets.play(ctx, "sfx.<key>")` (fall back to the synth).

## 9. External assets (외부 에셋)

- Library: repo-root `asset/` (Korean guide `asset/README.md`), never deployed. `incoming/` raw packs ·
  `reference/` inspiration only, gitignored, never shipped · `generated/` raw AI outputs · approved game-ready art in
  `weapons/<kind>/` (`<kind>_t<n>`, `_lg_<power>`, `_set_<set>`, `_skin_<motif>`, `icon_<kind>_…`), `gear/<type>/<id>`,
  `items/<cat>/<id>`, `monsters/ characters/ tiles/ ui/ fx/ sfx/ music/ fonts/` · `_export/` and `_preview/` are
  generated (gitignored). Gallery: `ASSETS.bat` (= `npm run art:export && npm run art:gallery`) opens `asset/index.html`.
- Licences: CC0 / public domain (preferred), CC-BY (credit shown in-game), OFL fonts, paid licences that allow
  commercial use + redistribution in a game. Not allowed: NC, no-redistribution, unclear. AI images: tool terms must
  allow commercial use; never prompt for a living artist's or another game's style. One line per pack/batch in
  `asset/CREDITS.md` — `--install` refuses files it does not mention.
- Pipeline: `node scripts/import-art.mjs <img> --kind sword --tier 3 [--icon]` (or `--split --names …`, `--category
  items/potion --name hp_s --size 16x16`) detects the pixel grid, samples, removes the background, reduces the palette
  (`--colors`, `--palette game`), cleans specks, adds the `#2b2233` outline, places on the game canvas (world weapon:
  points right, hand at GRIP [5,16]; icons 16×16), writes `asset/…` + `asset/_preview/<name>.compare.png`. After owner
  approval: `--install <files>` → `public/assets/…` + manifest key + cache tag; `--uninstall <key>` reverts.
- Code: `Assets.canvas("key") || drawnInCode()` (weapons.js, art.js buildIcons already do); keep the code path.
  Prompts for weapon art (Codex code-drawn = preferred, ChatGPT image = concept/rough): `ai/prompts/weapon-assets.md`;
  cosmetics (hats, tops, backs, face pieces — rules, anchors, preview, test): `ai/prompts/cosmetic-assets.md`.

## 10. Housekeeping

- Update this file's map when files move; keep it under ~400 lines.
- Large files to avoid reading whole: `src/logic.js` (generated), `public/client.js`,
  `public/scene2d.js`, `public/sprites.js`. Grep their banners (`// ─────`) instead.
