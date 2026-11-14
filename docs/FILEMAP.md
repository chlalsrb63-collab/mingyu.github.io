# 파일 지도 — file map of 테일즈테일즈 (lines in brackets)

> One-page system summaries (server/saves, maps, loot, rift, world life, wire/client): [`docs/systems/README.md`](systems/README.md).

Moved out of `AGENTS.md` so it is read only when needed. Open the row you need, then `grep -n` the
banner or function it names. **When you add, move or split a file, update its row here in the same commit.**

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
| `00-header.js` [93] | file doc, `meta`, core constants (`T`=16 tile px, `INV`, `MAXLV` = 200, view range, party), `WKIND` weapon kinds (incl. `bow` with `shot`, `crit`, `mag`), combo `FINISH`, aim `AIM_N AIM_CONE`, the passives' constants `MARK_MAX MARK_MS WEAVE_MS TIP`, elements `ELEM REACT pairKey` |
| `02-jobs-stats.js` [97] | jobs and stats tables (docs/design/jobs-and-stats.md): `STATS ST_ORDER`, point cost `LV_DIV STAT_K STAT_K0`, `TIER_MAX`, `WK_ORDER WK_NAME WM_MAX JOB_WM`, `GRADE SCALE JOB_PLUS`, **`JOBS`** (adventurer + 6 single + 6 hybrid), derived-stat constants `SFX`, `WM_GAIN`, templates `BUILD`, `OLD_CLASS`, bridge `LEGACY_CLS`, `WSW_MS SHOT_MAX` |
| `03-skills.js` [98] | weapon skills table (docs/design/jobs-and-stats.md C): **`SKILL`** (30 by id: per weapon an L1 and an L10 active and an L10 passive, 6 single-job and 6 hybrid signatures; `kind wk job need mp cd mult … fx desc` — balance here), `SKILL_ORDER`, `SK_GROW` (mastery growth), `WK_SKILLS JOB_SKILL WK_PASSIVE` |
| `10-tables.js` [347] | gear names/tiers `GEAR`, **`ITEMS`**, `RUNES`, `RUNEWORDS`, `AFFIX`, `RARITY`, `LEGEND`, `SETS`, `TRAIN`, skill costs, `SHOP`, `ENH_RATE`, campfire/fishing/guild consts, `MASTERY`, `FIELD_BOSS`, elite `TRAITS`, `DENSITY`, cell spawning constants (`CELL WAKE_R SLEEP_R WAKE_MAX_MOBS SPAWN_MIN_D CELL_RESPAWN_MS` waves), **`MOBS`**, chests, **`QUESTS`** |
| `12-life-tables.js` [87] | life skills' tables (docs/design/life-and-coop.md B): `LIFE LIFE_NAME LIFE_MAX lifeNeed` (10·L²+40), `GRADE_LV RXP LIFE_STALE_D LIFE_STALE`, the bonus formula `LIFE_ROLL`, `LIFE_UNLOCK`, map grades `GRADE_TIER GRADE_NAME`, materials `m_h1..m_w5` (type `lmat`) and fish `fish_c fish_v` + dishes `food_c food_v` appended to `ITEMS`, `FISH_G`, `FISHING` (catch split, keep, bite wait), campfire **`RECIPES`** (keyed by dish; `ITEMS[fish].recipe`), `COOKING`, later phases' `JB` (empty) `COOP_KINDS POUCH_MAX` |
| `20-helpers-mapkit.js` [568] | `rnd(box)`/`ri`/`clamp`/`dist`, XP curve `xpNeed`, map primitives (`blank rect road portal finalize`), noise (`fbm`), A* `walk`, `bfs`, `poisson`, Voronoi `partition`, `grow`, `knit`, `stamp`, cellular `automaton`, spawn banding |
| `30-maps-overworld.js` [722] | set pieces `PIECE` legend + **`PIECES`** (incl. the fallen kingdom: chapel cottage watchtower kinggate graveyard …; `UPRIGHT` = never rotated, their ruin art stands on footprint chars `N d i f`), `piece()`, `wilds(cfg)` (meadow/forest/maple generator; optional `lair` `campPiece` `vaultMobs` `trail` `padMin`), `metro(cfg)` (city generator) |
| `31-maps-dim.js` [287] | 차원 균열 (party instance, docs/design/scale-and-rift.md D): **`DIM`** table (caps, gauge, shrines, toughness, rewards — balance here), `DIM_THEMES`, `DIM_TOWN` (obelisk/keeper/landing tiles), `dimPool`, **`dimension(cfg)`** (seeded 56×40 rooms-and-corridors map + `m.dim` layout/spawns) |
| `32-maps-underground.js` [630] | `tunnel`, `cavern` (cave), `catacomb` (crypt), `sewers`, `abyssal` (abyss) |
| `33-maps-zones.js` [231] | 4× grounds (docs/design/scale-and-rift.md C): `zoneMap` (m.zone safe/normal/elite/hidden by walk from the entrance, hidden `pockets`, minimap `zq`), `zoneSpawns` (colonies per 8×8 block of each zone), waypoint keys `wpKey wpOk stonesOf stoneName`, 질주의 바람 `windTouch` (`WIND_*`) |
| *(generated)* | `const DATA = {maps, links, npcs, quests}` — `build-logic.mjs` inserts `game/data/**` right after 00-header |
| `34-maps-world.js` [473] | `buildTown()` (being rebuilt as the 100×76 forest village: frozen contract `docs/design/town.md` — layout, buildings/doors, interiors, residents, T-A/T-B split), **`GEN`** (every generated map's generator, band, `stones` and `cfg()`: seed, size (2× per side since Phase 1), mobs, chest, features), `GATE_LINKS` (doors by gate name), `genMap(id)` (one map: terrain, doors, zones + `zoneSpawns`, `markRoutes`: stones, wind shrines `/`, plaza fire, signs incl. zone signs), collision `solidAt/canStand/canFly`, `mapPayload` |
| `36-custom-maps.js` [314] | editor maps over the generated world: `fromEditor` (map file → map), `finishMap` (doors, links, NPCs, finalize, `buildCells` → `m.cells` spawn quotas per 16×16 cell); the **lazy map registry**: `MAP_META` (name/theme/band/size/wp/kinds of every map, nothing built), **`mapOf(id)`** (built on first use, cached), **`mapOfS(S,id)`** (+ instances `S.dims`), `allMaps()` (tools/tests), `arrivalOf` (a door's landing tile, resolved at warp time), `hasWp/wpOf`, sheet stones `wpWoken/wpCount`; `START`, `HUNTED`, `COL_MOBS`, `NPC_MAP`/`NPC_NAME`, `devPlace` (playtest). Town + editor maps are built at load, hunting grounds on first entry: never index a map table directly |
| `40-characters-world.js` [561] | `validName`, **`newChar`** (sheet `v:12`: v12 life skills `life jobBoard rep coopDay coopDone pouch` (58-life.js); v11 jobs `job st wm xpt rs sw cnt eq.weapon2`; v10 `bagCap`, `house`; v9 `wp` = {mapId: stone bitmask}, `dim` = {day, n}), **`migrate`** (old sheets), gear stats `stats()`, `exportChar`; world `setup`, **`runtime(S,id)`** (a map's live state, made on first use: fixed spawns + cell slots), `liveMapIds`, instances `registerDim/closeDim`, mobs `newMob/placeMob`, field boss, `addPlayer/removePlayer`, `changeMap`, `sys/toast`; parties |
| `45-jobs.js` [363] | `toTier shownLv eff pointCost batchCost levelOf nextCosts wmNeed scaleOf hybridOf jobOk`, **`deriveStats(p)`** (the sheet's stats, cached in `p.stc`), mastery `gainWm wmHit newAct wmKill`, `grazeChance evadeBlow staggerPlayer`, arrows `fireArrow shotTick bowShot arrowMult` (`rt.shots`; skill volleys `cap`, 매의 시야), migration `allocate migrateV10 cleanJobs`, test helper `hero()` |
| `46-bag.js` [63] | the bag's size: `bagCap(ch)` (every bag check asks it; 40 → 100), `roomIn` (room in any list of slots), `sortSlots` (the 정리 of bag and house storage), `bagClean` (migrate), action `bag_expand` (`bagValidate/bagApply`, price curve `BAG_COST` in 10-tables) |
| `50-loot-combat.js` [503] | bag/stack/warehouse helpers, pickup, prices, `rollGear`, `rollRarity`, `lootFor` (`dropKind`); `gainXp` (only accumulates), `hurtMob`, `killMob`, `hurtPlayer`, targeting + aim helpers (`AIM_V setAim inArc aimMob`), `basicAttack` |
| `57-weapon-skills.js` [670] | weapon skills: gating `inHand skWks skLearned skillsFor skWhy`, passives `pasOn` (+ hooks in `basicAttack`/`hurtMob`/`arrowMult`), `skGrow skMp inertOf`, marks `marksOf addMarks`, `pullTo tug reach stepTo`, elements `weave react`, the tracker's lure `popDecoy`, lingering props `skillProps propPulse propEnd addProp` (`rt.props`: bolt grav phantom rain storm field pillar meteor trap burst sanct; wire `pr pp pe`), 무영난무 `danceStep`, `weaponTick weaponReset flagsOf crValue crView skWire skLearnNew`, **`castSkill(S, p, id)`** (switch on skill id; fx events `ev(code,…)` 70–102, passives 110–115) |
| `58-life.js` [176] | life skills' engine: `lifeEmpty lifeGrade gradeOfMap mapGradeOf`, `lifeOdds lifeRoll lifeTime lifeXp`, `lifeAdd` (pure, migrate) / **`gainLife`** (event `lv2`, toasts), fishing `fishKeep fishWait fishLand`, cooking `fishRecipe cookBurnt cookDish` (called from 75 `fish reel cook`), sheet `lifeClean pouchOk lifeSheetClean lifeFresh` (newChar/migrate), wire `lifeView` (`self.life`) `lifeDefs` (`defs().life`) |
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
| `life.js` [73] | life skills' client (L1, read-only): the 생활 window `#w-life` (menu 생활, Shift+L) from `self.life` + `defs.life` — levels, bars, grade, 대성공/time bonus, next unlock, the water's grade here; `lv2` events (sound, sparkle) |
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
| `skillfx.js` [575] | weapon-skill visuals/sounds per server fx code (`skillEvent` → `cast` codes 70–102, `passive` 110–115), props (`pr pp pe`: vortex, phantom beast, arrow rain, traps, storm, drain field, blood sanctuary in the overlay), marks and brands over monsters, `ln` lines (2 javelin 3 dash 4 chain 5 blink 6 ambush 7 shadow blade 8 hop back 9 leap); the bow: `bowFire` (fx code 6, from client attackFx) and the arrow events `ar`/`ae` |
| `skillicons.js` [583] (one glyph per `SKILL` id) · `uiicons.js` [114] · `emoticons.js` [164] | 16×16 skill glyphs, 12×12 UI glyphs (`MENU_ICON TRAIT`), chat emoticons |
| `weapongauge.js` [166] | weapon-passive gauge in the status panel (`self.cr`: inertia mark tip reso brand hawk, a hybrid's other as `o`) |
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
| `_*.html` | dev preview pages (never deployed, `.assetsignore`): scene world iso over mobs sheet species wardrobe swing feel (skill blasts, hits, footsteps as frame strips; `rows=sk80,sk89:64,pr:grav` plays weapon-skill fx codes and props) bow (`?m=art|draw|arrows|fight`: tiers × pulls, the shot in 8 aims, arrows) title icons uicons emo mini house (furniture icons + every piece turned N W S E) chunks (chunked vs whole ground bake, pixel by pixel; `scripts/bake-check.mjs`) |

### Tests — `game/tests/*.mjs` (plain node + `node:assert`; list in `tests/LIST`)
sim (smoke) · party · loot (gear, repeat hunting) · life (fires, fishing, cooking, guilds) · lifeskills (life L1: curve golden values, levelling and `lv2`, the B.2 bonus table, map grades, fish by grade and level with shares/대성공/XP, keep threshold, bite wait, cooking burn threshold/two portions/stale XP/`cook` alias, materials, new NPC roles; `-v` prints the fish shares) · world
(map graph, dungeons, quests) · hard (crowds, elites, traits) · content (long game, old sheets) ·
growth (stat points, cooldown cut, mastery attack, warehouse, pets, scrolls) · skills (all 30 weapon skills cast with their fx, gating, the six passives, signatures, hybrids, the bar, the wire) · jobs (six stats, point costs, derived stats golden rows, mastery, grazes/evasion/stagger, job change, respec, starter, hybrid swap, shown levels, the bow's arrows, any-kind drops) · balance (probe vs the pre-jobs baseline: each weapon kind ±25 % kills/min, bow −25…+10 %) · aim (blows/skills go where you aim, nothing behind) · feel (hitstun: stagger pauses cooldowns, knockback stops at walls, bosses immune) · maps (generators:
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
`EDITOR.bat` starts it · `ai/` AI team: `TASKS.md` task board, role files `codex.md` `gemini.md` `merge.md`, `reports/`, `worker.bat` (workers run in git worktrees `.work/<name>` on branch `<name>/work`) · root launchers `PLAY.bat` `AI-TEAM.bat` `AI-MERGE.bat` `UPDATE.bat` `TESTS.bat` `ASSETS.bat` (export + gallery), `install.ps1` (one-step Windows setup), `.vscode/tasks.json` (VS Code: starts the AI team on folder open) · `asset/` (repo root) art/sound library and gallery `index.html` (not deployed; `docs/RECIPES.md` External assets) · `ai/prompts/weapon-assets.md`
(asset review + Codex/ChatGPT weapon prompts) · `.claude/agents/` 22 specialist roles adapted from the MIT "Claude Code Game Studios" template (game/systems/economy/level designer, narrative, writer, art director, technical artist, sound, UX, gameplay/network programmer, QA, performance, live-ops, security, producer…); Claude uses them as subagents, and Codex/Gemini may read one as a role guide (e.g. Gemini doing balance → `economy-designer.md`) · six more from the MIT "The Agency" collection, prefixed `agency-` (whimsy-injector, ui-designer, reality-checker, game-audio-engineer, narrative-designer, accessibility-auditor) · `.claude/skills/pixel-art/` pixel-art
rules (any AI may read `rules/*.md`) · `.github/workflows/deploy-game.yml` CI (split check, tests,
deploy) · root `index.html`/`profile.jpg` = the owner's unrelated GitHub Pages profile.
