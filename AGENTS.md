# AGENTS.md — 테일즈테일즈 (Tales Tales)

The one shared guide for every AI working in this repo (Claude Code, OpenAI Codex CLI, Google
Gemini CLI). `CLAUDE.md` and `GEMINI.md` only import this file. Keep it short: details live in
`docs/FILEMAP.md` (file map — update it when you add/move/split a file) and `docs/RECIPES.md` (task recipes, assets).

**Token rules (every AI, every task — the cheap path first):**
0. **Code graph before files.** `codebase-memory` MCP tools if available (owner's PC, `docs/LOCAL_SETUP.md` §6:
   `search_graph get_file_outline get_code_snippet trace_path search_code`). Else **graphify** if installed:
   `graphify explain "<symbol>" --graph "$G"` (callers/callees of one function — the cheapest),
   `graphify affected "<symbol>" --graph "$G"`, `graphify query "<narrow question>" --budget 1500 --graph "$G"`, with
   `G="$(dirname "$(git rev-parse --git-common-dir)")/game/graphify-out/graph.json"` (works in worktrees too:
   it points at the main checkout's graph). Refresh after big merges: `graphify update game` in the main checkout.
1. **Don't re-explore.** Find the file in §3 below or `docs/FILEMAP.md` (full map), open only it, `grep -n`
   the banner/function instead of reading big files whole (`client.js`, `scene2d.js`, `sprites.js`). The
   generated `game/src/logic.js` is excluded from searches (`.ignore`); search `src/logic/*.js`.
2. **Design docs:** read the doc's contents list (`grep -n "^#"`) and only the sections for your phase
   (`docs/design/README.md` says which doc is live).
3. **Tests over screenshots.** While developing run only the relevant tests (`node scripts/test-all.mjs maps
   world`); the full suite once before pushing. Screenshots: only for visual work, ≤5 for your own checks,
   clipped to what changed (`shot.mjs --el "#w-bag"` / `--clip x,y,w,h`).
4. **Small tasks, short reports.** One task = one improvement on a few files; reports ≤40 lines.
5. **Never touch the cache tag** `?v=` — `scripts/stamp.mjs` sets it at deploy, so branches don't conflict.

Owner-facing setup (Korean, Windows): [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md).
Player-facing description (Korean): [`game/README.md`](game/README.md).

---

## 1. 게임 개요 — what the game is

A real-time online party-hunting RPG in the browser (Korean MMORPG lineage: 바람의나라, 어둠의전설,
테일즈위버, MapleStory, plus Diablo-style loot).

- **Heroes**: cute 16×16 pixel animals with tails (15 species, many face parts), carrying weapons as
  big as themselves. No classes: everyone starts as 모험가; six stats, levels 1–200 bought with XP,
  six weapon masteries (sword dagger spear staff book bow, Lv.1–50) unlock single/hybrid jobs
  (`docs/design/jobs-and-stats.md`).
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

## 3. 어디에 무엇이 — where things live (full map: `docs/FILEMAP.md`)

| path | what |
| --- | --- |
| `game/src/worker.ts` `room.ts` `accounts.js` `protocol.ts` | Worker entry, Room/vault Durable Object, accounts, frame parsing |
| `game/src/logic/NN-*.js` | ALL rules, one scope concatenated in name order into the generated `src/logic.js`: 00 header/skills · 02 jobs tables · 10 tables (ITEMS MOBS QUESTS…) · 20 helpers/mapkit · 30–36 maps (overworld, rift, underground, zones, world/`buildTown`, custom maps + lazy registry `mapOf`) · 40 characters/world · 45 jobs · 50 loot/combat · 55/57 skills · 60–66 content (daynight, side quests, rift, cosmetics, housing…) · 70 `validateAction` · 75 `applyAction` · 80 simulation `tick` · 90 `viewFor`/`defs` |
| `game/data/` | editor data built into logic: `maps/*.json` (interiors, editor maps), `links.json`, `npcs.json`, `quests.json` (`docs/editor/SCHEMA.md`) |
| `game/public/` | client (plain ES modules): `client.js` (state, input, HUD windows), `scene2d.js` (renderer), `iso_*.js` (ground, tall blocks, interiors), `sprites.js` `species.js` `weapons.js` `wardrobe.js` `mobart*.js` (art), `skillfx.js` `swing.js` (combat fx), `radar.js`, `sky.js`, `audio.js`, `lobby.js`, `hud.css` |
| `game/tests/*.mjs` · `tests/LIST` | rule tests (node:assert) |
| `game/scripts/` | build-logic, test-all, shot (screenshots), stamp (cache tag), editor server, art import/export |
| `game/editor/` | the map editor app · `ai/` AI-team tasks/roadmap · `asset/` art library · `docs/design/` design contracts |

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
   or "AI-generated (tool, prompt file)", recorded in `asset/CREDITS.md` (`docs/RECIPES.md`, External assets). Unknown licence ⇒ `asset/reference/` only.
8. **Cache tag.** Don't edit `?v=` in `public/index.html` by hand: `npm run stamp` (run by CI and
   `deploy:cf`; run it yourself before a Higgsfield deploy) sets it to a hash of `public/`.
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
npm run stamp               # cache tag ?v= = hash of public/ (CI and deploy:cf do it)
npm run deploy:cf           # checks + tests + stamp, then wrangler deploy -c wrangler.deploy.jsonc (needs `npx wrangler login`)
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

## 8. 레시피와 외부 에셋 — recipes and external assets

Step-by-step recipes (add a monster / item / skill / set piece / UI window / editor content / sound) and the
external-asset pipeline: `docs/RECIPES.md`. Read only the recipe you need.

## 9. Housekeeping

- Keep this file under ~200 lines and change it rarely: it is the cached prefix of every AI session, so each
  edit makes every next session pay for it again. File rows go in `docs/FILEMAP.md`, recipes in `docs/RECIPES.md`.
- Large files to avoid reading whole: `src/logic.js` (generated), `public/client.js`,
  `public/scene2d.js`, `public/sprites.js`. Grep their banners (`// ─────`) instead.
