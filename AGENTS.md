# AGENTS.md — 테일즈테일즈 (Tales Tales)

The one shared guide for every AI working in this repo (Claude Code, OpenAI Codex CLI, Google
Gemini CLI). `CLAUDE.md` and `GEMINI.md` only import this file. Keep it accurate: when you add,
move or split a file, update the file map here in the same commit.

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
  abyss (dungeon). Hunting grounds are procedurally generated from fixed seeds (same map every boot).
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
  `F` fires, `ev` events, `chat`, plus `map` / `who` / `self` only when changed. Static tables go once
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
| `env.ts` [17] | `Env` bindings: `ASSETS`, `ROOMS`, `HF_ENV`, `APP_SLUG` |
| `logic.js` [6046] | **GENERATED** — never edit; built from `src/logic/*.js` |

### Rules — `game/src/logic/` (fragments of ONE scope, concatenated in name order; not modules)
| part | contents |
| --- | --- |
| `00-header.js` [122] | file doc, `meta`, core constants (`T`=16 tile px, `INV`, `MAXLV`, view range, party), `WKIND` weapon kinds, `CLASSES`, class-mechanic constants, elements `REACT`, **`SKILLS`** (per class) |
| `10-tables.js` [309] | gear names/tiers `GEAR`, **`ITEMS`**, `RUNES`, `RUNEWORDS`, `AFFIX`, `RARITY`, `LEGEND`, `SETS`, `TRAIN`, skill costs, `SHOP`, `ENH_RATE`, campfire/fishing/guild consts, `MASTERY`, `FIELD_BOSS`, elite `TRAITS`, `DENSITY`, **`MOBS`**, chests, **`QUESTS`** |
| `20-helpers-mapkit.js` [568] | `rnd(box)`/`ri`/`clamp`/`dist`, XP curve `xpNeed`, map primitives (`blank rect road portal finalize`), noise (`fbm`), A* `walk`, `bfs`, `poisson`, Voronoi `partition`, `grow`, `knit`, `stamp`, cellular `automaton`, spawn banding |
| `30-maps-overworld.js` [667] | set pieces `PIECE` legend + **`PIECES`**, `piece()`, `wilds(cfg)` (meadow/forest generator), `metro(cfg)` (city generator) |
| `32-maps-underground.js` [630] | `tunnel`, `cavern` (cave), `catacomb` (crypt), `sewers`, `abyssal` (abyss) |
| `34-maps-world.js` [358] | `buildTown()`, **`buildMaps()`** (every map's cfg: seed, size, mobs, chest, features), `markRoutes`, `MAPS`, `START`, collision `solidAt/canStand/canFly`, `mapPayload` |
| `40-characters-world.js` [426] | `validName`, **`newChar`** (sheet `v:7`), **`migrate`** (old sheets), gear stats `stats()`, `exportChar`; world `setup`, mobs `newMob/placeMob`, field boss, `addPlayer/removePlayer`, `changeMap`, `sys/toast`; parties |
| `50-loot-combat.js` [503] | bag/stack/warehouse helpers, pickup, prices, `rollGear`, `rollRarity`, `lootFor`; `gainXp`, `hurtMob`, `killMob`, `hurtPlayer`, targeting helpers, `basicAttack` |
| `55-class-skills.js` [611] | class mechanics (grit, marks, focus, weave), `classTick`, `crView` gauge, **`castSkill`** (switch on skill id; emits numeric fx events `ev(code,…)`) |
| `60-content.js` [317] | waypoints + recall, dailies (06:00 KST), achievements `ACH` + titles, collection, world event (rift), tutorial `TUT` |
| `65-cosmetics.js` [125] | `COSMETICS` catalogue, `COS_SLOTS`, wardrobe helpers `cosClean cosWire giveCos cosFrom` |
| `70-validate.js` [348] | **`validateAction`** — one `case` per action `t`: respawn opt look chat p*/g* (party/guild) qs sort emo cos_* title daily tut mv atk warp sk use eq uneq rune train sklv wh sellall buy sell enh sit fish hook reel cook salv bq quest |
| `75-apply.js` [522] | **`applyAction`** (same cases, mutates state), `afterGear` |
| `80-simulation.js` [394] | mob AI (`tickMob`, specials, traits), **`tick(S, now)`**, `endTick`, `isGameOver` |
| `90-views-api.js` [144] | `selfPayload`, **`viewFor`**, `atlas` (tests), **`defs()`** (tables sent to the client) |

### Client — `game/public/` (plain ES modules, no build step; `index.html` loads `client.js?v=…`)
| file | owns · key exports |
| --- | --- |
| `index.html` [364] | all HUD/window markup (`section.window#w-<id>`), `#menu`, cache tag `?v=` |
| `client.js` [2563] | game client. Sections (grep `// ───`): connection, state `G`, messages (`onSnap`), effects, input (keydown hotkeys ~L537), player actions, update, render, HUD & windows (`WIN` list ~L1236, `openWin`, `render<Window>()`), main loop. `window.__game = {G, act, S3, go}` for automation |
| `lobby.js` [593] | title, 로그인/회원가입, server/channel list, character creation, in-game channel switch/logout |
| `account.js` [99] | HTTP side of accounts: `session signup login logout me servers`, `API` base |
| `scene2d.js` [2052] | the world renderer: `iso/project/pick`, `init/resize`, `loadMap`, `sync(G)`, `render`, scenery sprites, ground, raised blocks, creatures, effects `fx/fxCustom/shake`, pets, title/creation stage |
| `isotiles.js` [29] · `iso_px.js` [118] · `iso_ground.js` [725] · `iso_tall.js` [601] | quarter-view ground baking (`bakeGround`), pixel buffers/projection (`TW=32, TH=16`), ground materials and transitions, tall blocks (cliffs, walls, houses) |
| `decor.js` [590] | landmarks, decals, pulses, critters, waypoint stones/signs, town dressing, day/night `daylight` |
| `art.js` [910] | item icons `buildIcons`, minimap `renderMini`, old scenery helpers; re-exports `chars.js` |
| `chars.js` [471] | legacy smooth illustrated figures (re-exported by art.js; heroes now come from sprites.js) |
| `sprites.js` [1259] | 32×32 sheets: heroes `personSheet/playerLook`, NPCs, pets, weapons `weaponSprite`, `monsterSheet`, tints |
| `species.js` [356] | hero species and face parts: `SPECIES PARTS TABS PRESETS cleanLook withSpecies` (limits mirror logic `LOOK_MAX`) |
| `looks.js` [244] | look editor (creation tabs) and the town mirror |
| `mobart.js` [587] + `mobart_kit.js` [139] + `mobart_a/b/c.js` [376/309/561] | monsters as 3D-primitive models rasterised to pixels; `BEASTS_A` meadow/forest, `_B` crypt/city, `_C` sewer/cave/abyss/bosses/chest; `has draw icon KINDS` |
| `weapons.js` [526] | weapon art per kind × tier, legendary/set looks, skins, glow: `DESIGNS weaponSprite weaponIcon` |
| `wardrobe.js` [593] · `wardrobe_ui.js` [283] | cosmetic layers drawn over heroes (`ART SLOTS dress`); costume shop + 외형 tab |
| `swing.js` [131] | weapon stroke poses for attacks/casts |
| `skillfx.js` [408] | skill visuals/sounds per server fx code (`skillEvent`, switch on codes 40–75), props, marks |
| `skillicons.js` [471] · `uiicons.js` [105] · `emoticons.js` [164] | 16×16 skill glyphs, 12×12 UI glyphs (`MENU_ICON TRAIT`), chat emoticons |
| `classgauge.js` [152] | class gauge in the status panel |
| `growth.js` [292] | skill training, warehouse, pets, auto-potion, drop names (client side) |
| `quickslots.js` [327] | quick slots 1–9 (drag skills/items, keys) |
| `minigames.js` [269] | fishing rhythm game, cooking tangram |
| `npctalk.js` [80] | NPC flavour lines by role |
| `frames.js` [85] | HUD 9-slice frame art → CSS custom properties |
| `audio.js` [658] | chiptune synth: `TRACKS` (per-map music), `SFX` catalogue, `Sound.play(name)` |
| `titlescene.js` [510] | title-screen diorama and pixel logo |
| `assetlib.js` [122] | OPTIONAL external asset loader (unused by default): `ready canvas has loadImage loadAudio loadSounds play` |
| `style.css` [351] · `hud.css` [473] · `lobby.css` [225] | base + CRT, HUD/windows, lobby |
| `assets/manifest.json` | external asset keys (empty = all code-drawn) |
| `fonts/` | Galmuri pixel fonts (OFL) |
| `_*.html` | dev preview pages (never deployed, `.assetsignore`): scene world iso over mobs sheet species wardrobe swing title icons uicons emo mini |

### Tests — `game/tests/*.mjs` (plain node + `node:assert`; list in `tests/LIST`)
sim (smoke) · party · loot (gear, repeat hunting) · life (fires, fishing, cooking, guilds) · world
(map graph, dungeons, quests) · hard (crowds, elites, traits) · content (long game, old sheets) ·
growth (skill levels, warehouse, pets, scrolls) · skills (class mechanics) · maps (generators:
connectivity, determinism, speed) · hotbar (quick slots, party chat, tidy) · wardrobe (cosmetics) ·
looks (species ↔ LOOK_MAX) · mobart (every mob has a model that fits its canvas) · accounts (vault
logic with a fake store + client contract).

### Scripts — `game/scripts/` (pure node; work on Windows)
`build-logic.mjs` (concat parts → logic.js; `--check`, `--watch`) · `test-all.mjs` (build + run
tests/LIST; `--no-build`, names to filter, `-v`) · `dump-maps.mjs` (public/_maps.json for previews) ·
`shot.mjs` (one screenshot; `--serve` for previews). `build.mjs`/`check-logic.mjs` referenced by the
`build` script are Higgsfield's and are not in the repo.

### Other
`game/assets/` external asset drop zone (not deployed; see §9) · `.claude/skills/pixel-art/` pixel-art
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
   **No AI image generation** for in-game art: art is code-drawn; external art only from `game/assets`
   with its licence recorded (§9).
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
npm run test:rules          # build + all 15 rule tests (~10 s); one: node scripts/test-all.mjs maps
npm run check:split         # is logic.js up to date?
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

- One task = one branch (or one `git worktree`) per AI: `claude/<task>`, `codex/<task>`,
  `gemini/<task>`. Never two AIs in the same working tree at once.
  `git worktree add ../tt-codex -b codex/<task>` → work there → `git worktree remove ../tt-codex`.
- Small commits, English messages "Area: what changed and why" (see `git log`). Stage by path, not
  `git add -A`. Run `npm run test:rules` before every commit that touches rules.
- Before handing back: `git fetch && git rebase origin/<integration-branch>`; regenerate logic.js
  after resolving conflicts in parts (`npm run build:logic`) — never hand-merge `logic.js`.
- The integrator (normally Claude) reviews the diff, runs tests, merges into the integration branch
  (currently `claude/topdown-2d-mmorpg-dev-jke7w3`), and pushes. Pushing there triggers the CI deploy.
- Never commit secrets, `node_modules`, `.wrangler/`, `shots/`, or downloaded assets outside `game/assets`.

## 8. 작업 레시피 — task recipes (which files to touch)

**Add a monster**
1. `src/logic/10-tables.js` `MOBS`: `key: { name:"한글", lv, hp, atk, def, spd, xp, gold:[a,b], aggro, range, cd, …moves }`
   (moves: `charge leap slam pool fan`, `fly`; `sp`/`tint` reuse another body in another colour).
2. Spawn it: the map cfg `mobs:[…]` in `src/logic/34-maps-world.js buildMaps()` (and `FIELD_BOSS`/
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
3. Data it needs: `selfPayload` in `90-views-api.js` (send only when dirty) or `defs()`; actions via
   `act({t:…})` + validate/apply cases. Bump the `?v=` cache tag.
4. `shot.mjs --live --keys <key>`.

**Add a sound / music**
- Effect: a function in `public/audio.js SFX` (synth: `this.tone`, `this.noise`), optional level in
  `BOOST`, rate limit in `THROTTLE`, priority in `IMPORTANT`; play with `Sound.play("name")`. Server-driven sounds are
  played from event handlers in `client.js`/`skillfx.js`.
- Music: a track in `audio.js TRACKS`; a map picks it with `bgm` in its cfg.
- External file instead: §9 + `Assets.play(ctx, "sfx.<key>")` (fall back to the synth).

## 9. External assets (외부 에셋)

- Drop zone: `game/assets/{incoming,sprites,tiles,ui,fonts,sfx,music}` — raw packs, never deployed.
  Every pack gets a line in `game/assets/CREDITS.md` (name, author, URL, licence). Allowed: CC0 /
  public domain (preferred), CC-BY (credit must be shown in-game), OFL for fonts. Not allowed:
  non-commercial, no-redistribution, unclear licences.
- Curating (AI task): copy only what is used into `game/public/assets/<type>/`, PNG for images,
  OGG/MP3 for audio, integer scaling only (16×16 heroes on 32×32 sheets, 32×16 iso diamonds), list it
  in `public/assets/manifest.json`, and wire it with `public/assetlib.js`:
  `await Assets.ready()` at start-up, then `Assets.canvas("key") || drawnInCode()`. Keep the code
  path as the fallback. Fill in "사용 중" in CREDITS.md.

## 10. Housekeeping

- Update this file's map when files move; keep it under ~400 lines.
- Large files to avoid reading whole: `src/logic.js` (generated), `public/client.js`,
  `public/scene2d.js`, `public/sprites.js`. Grep their banners (`// ─────`) instead.
