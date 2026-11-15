# 인수인계 — Claude and Codex, one project on the owner's PC (updated 2026-11-15)

Read by every AI session on this PC (Claude Code in the desktop folder `Tales Tales`, Codex in its worktree).
Development is **local first**: work and test on the PC; the owner decides when anything goes online (§4).
Read this, `AGENTS.md` (loaded), `ai/BRIEF.md`, `docs/design/README.md`, `docs/systems/README.md`; then continue.
Reply to the owner in Korean; they want reports **with screenshots** ("다 끝나면 화면과 함께 알려줘").

## 0. Token budget — owner's order (2026-11-15: "토큰 소모량을 줄이도록 해")

The previous integrator session grew to 750k tokens and ran 6–7 agents at once; every agent notification re-read the
whole context and the 5-hour limit ran out twice. Rules for every Claude session from now on:
- **Integrator stays small.** Start a new session (update this file first) when the context passes ~250k tokens.
  Don't read agent screenshots or long diffs in the integrator; trust the report + run the tests, look at ≤ 2 shots per merge.
- **≤ 2 agents at once** (3 only if they touch disjoint files). One agent ≈ ≤ 100 tool calls / ~100k tokens; split bigger work.
- **Order by files, not by wish list.** Never run two agents on the same files at once (map generators `30/32/34-*`,
  `10-tables.js` MOBS, `hud.*`/`windows.js`, `70/75/90`): run them one after another. Conflicts cost a whole rebase agent.
- **Model per task** (`ai/BRIEF.md`): art, data rows, Korean text, docs, reviews → `model: "sonnet"` (pure text/data → `"haiku"`);
  rules cores, cross-system work, integration → default. Mechanical backlog → Codex via `ai/TASKS.md` (no Claude tokens).
- **Agent briefs**: ≤ 40 lines, point at files instead of pasting specs, ask for reports ≤ 15 lines, ≤ 3 screenshots,
  only the relevant tests while working and the full suite once at the end. Reuse the main checkout's `node_modules`
  in worktrees (junction) instead of `npm install`.
- Turn off MCP servers/plugins this project never uses (Higgsfield, Notion, PixelLab, Summer Engine, Blender, Unity) for
  this folder — ask the owner before changing settings.

## 0.1 State on 2026-11-15 (end of the long session) and what to do next

`main` = everything merged and tested (34–35 suites): life L2 client, side panel (one window at a time), gear-slot icons,
charms C1+C2 (Juana, board), maps v2 M1–M3 + art (meadow falls, forest gorge, jade cave, brick halls, jungle/coast/oasis),
wide dungeons, `dunesea` (288×192), Codex's `codex/local-play` (NPC routines, hunting routes, frost keep Lv.200, BGM),
starter-weapon pick at creation, solid aim arrowhead, job emblems + icon-first HUD with click detail cards (`infocard.js`).
Nothing since `500891d` is pushed (push = deploy; push only with `[skip ci]` when the owner asks for a backup).

**Paused agent branches** (stopped by the usage limit; worktrees under `.claude/worktrees/`; unfinished work saved as a
`WIP:` commit — untested; resume each in its own fresh agent, one or two at a time, in this order):
1. `claude/dash` — Space = dash (≈72 px, 4 s cd, short invulnerability), basic attack → X. Owner asked for it.
2. `claude/social-weekly` (1 commit) — friends/whisper/block, weekly book (7 of 12), enhancement pity, key rebinding,
   text size. Then wire dash/attack into the key-rebinding table.
3. `claude/rift-tiers` (WIP) — endless rift tiers + weekly 4-player boss challenge with a stagger gauge.
4. `claude/new-monsters` (WIP) — real species for coast/desert/jungle (+ mesa/cloudtemple) replacing tinted variants.
5. `claude/cosmetics-2` (1 commit + WIP) — 30+ cosmetics (seaside, desert, jungle, temple, delver, life-mastery outfits, trust gifts).
6. `claude/maps-b2-1` (3 commits) — `mesa` 붉은바위 황금궁 + `cloudtemple` 운해 사원 (`docs/design/maps-batch2.md`).
Owner's priority: **HUD and user-friendly UI/UX first, then content.** Auction house is **on hold** (don't start).
Still to do after those: life → combat loop + 알바/협동 알바 polish (`life-and-coop.md` C1–C3), skill design/FX cleanup,
more quests, maps batch 2 pairs 2–3 (`maps-batch2.md`), level balancing only after the maps exist (`level-bands.md`).
Owner is waiting for **UI screenshots** (HUD with emblems, stats + a detail card, job emblems, creation weapon picker,
arrow, phone) — take them on current `main` and send them first.
Codex: designing the 7th weapon `hammer` + job `destroyer` (spec `codex/rift-beasts:ai/prompts/hammer-destroyer.md`);
our UI is already data-driven for it. Codex's world map prompt was given to the owner (start it after the maps land).

## 0. Token budget — owner's order: "토큰 소모량을 줄이도록 해" (2026-11-15)

The previous integrator session hit the 5-hour limit twice: its own context grew to 750k tokens and every
agent notification re-read it, while 6–7 agents of 120k–400k tokens each ran at once. Rules from now on:
1. **Keep the integrator session short.** When its context passes ~250k tokens, update this file and continue in a
   fresh session. Don't re-read big files or screenshots you already summarised.
2. **At most 2–3 agents at a time**, each scoped to ≤ ~100k tokens (≤ ~80 tool calls). Split bigger work.
3. **Never run two agents on the same files** (map generators `30/32/34`, `10-tables.js`, HUD `hud.*`/`windows.js`,
   `70/75/90`): sequence them. Conflicts cost a whole rebase agent.
4. **Model by job** (`ai/BRIEF.md`): art, data rows, docs, reviews, mechanical ports → `model: "sonnet"` (pure
   text/data → `"haiku"`); rule cores, integration, design → default. Small well-specified items → Codex via `ai/TASKS.md`.
5. Agents: reuse the main checkout's `node_modules` via a junction instead of `npm install`; relevant tests while
   working, the full suite once at the end; ≤ 3 screenshots; reports ≤ 15 lines.
6. Unused MCP servers/plugins (Unity, Summer Engine, Higgsfield, Notion, PixelLab, Blender…) add ~25k tokens to
   every call — the owner may turn them off for this folder.

## 0.1 State at the handoff (2026-11-15, `main` 0a49f58, 35 rule suites)

Merged today (see `ai/LOG.md`): unified Claude+Codex `main` (incl. Codex NPC routines, hunting routes, frost keep),
title subtitle, side panel (one window at a time), gear-slot silhouettes, L2 life client (gathering, stations,
알바 board, delivery, trust), charms C1+C2 (주아나), maps v2: meadow/forest/cave/crypt/sewer/abyss reworked and
widened for 4-player parties, new jungle/coast/oasis/dunesea with art, onboarding fixes, starter weapon at
creation, solid arrowhead aim mark, job emblems + icon-first HUD with click detail cards (`infocard.js`).
**Not yet done after that last merge:** run the full tests on `main`, then send the owner the UI screenshots he asked
for (HUD, stat chips + detail card, job emblems, job tree, party, creation picker, arrow, phone portrait).

**Paused branches** (stopped by the usage limit; worktrees under `.claude/worktrees/`; unfinished work saved as a
`WIP` commit — resume each in its own small agent, finish, test, merge; one at a time where files overlap):
| branch | what | state |
| --- | --- | --- |
| `claude/maps-b2-1` | new maps `mesa` 붉은바위 황금궁 + `cloudtemple` 운해 사원 (`docs/design/maps-batch2.md` batch 1) | 3 commits, unverified |
| `claude/dash` | Space = dash (4 s cd, ~72 px, i-frames), X = basic attack | WIP |
| `claude/rift-tiers` | 균열 단수 ladder + weekly 4-player boss with stagger gauge | WIP (rules mostly, tests in progress) |
| `claude/social-weekly` | friends/whisper/block, 주간 수첩, enhancement pity, key rebinding/text size | 1 commit |
| `claude/new-monsters` | real species for coast/desert/jungle (+ mesa/cloudtemple) replacing tinted variants | WIP |
| `claude/cosmetics-2` | 30+ outfits incl. life-mastery and 가족-trust rewards | 1 commit + WIP |

**Owner's priorities:** content + HUD + user-friendly UI/UX first. The 경매장 (auction house) is **on hold**. After the
paused work: life → combat links and co-op part-time jobs (C1–C3), skill design/effects cleanup, more quests,
then the remaining batch-2 maps. Codex is designing the 7th weapon **해머 / 파괴자** (`codex/rift-beasts`,
`ai/prompts/hammer-destroyer.md`); our UI is already data-driven for a 7th weapon. Level balancing waits until more
maps exist (`docs/design/level-bands.md`).

## 1. One project, one line — how Claude and Codex work together (owner's decision, 2026-11-15)

- **The integration branch is the local `main`.** Every worktree on this PC (desktop folder, `.work/codex`,
  `~/.codex/worktrees/*`) shares one `.git`, so `main` is the same for both AIs without any push. As of
  2026-11-15 `main` holds everything: `origin/main` (the cloud work), Codex's `codex/willow-plaza-release`
  (버드나무광장, fixed-size weapon motions, two greatsword sweeps, legendary silhouettes, map BGM, service-NPC
  quests, the split client), `codex/work` (mirror test), `codex/asset-review-2026-11-14` (sword icon review),
  `codex/map-bgm` and `codex/weapon-sil` (ported in `5a2fad1`). `codex/combat-effects` is **not** merged: it was
  built on the old v11 rules and is being ported piece by piece (`ai/TASKS.md`, "이식").
- **Start every task from `main`, hand it back on top of `main`.** Branch `codex/<task>` / `claude/<task>` from
  `main`; before handing back `git rebase main` (rebuild `game/src/logic.js` after part conflicts, never
  hand-merge it), run `npm run test:rules`, `data:check`, `typecheck`, `check:split`, write `ai/reports/<task>.md`.
  Claude reviews and merges into `main` (`ai/merge.md`); nobody else commits to `main`, nobody rewrites it.
- **Claim before you start.** The "진행 중" table at the top of `ai/TASKS.md` says who is doing what. Add your row
  before the first edit, remove it when merged; never start a task someone else holds. Two AIs never share a
  working tree.
- **Now:** Codex — N1 NPC-life rules ([contract](../docs/design/npc-life.md) §B–D, K), branch `codex/npc-life`,
  worktree `~/.codex/worktrees/willow-plaza-release`, dev server `http://127.0.0.1:8865/`. Claude — L2 life client
  ([contract](../docs/design/life-and-coop.md) H2), branch `claude/life-client`, desktop folder, dev server
  `http://localhost:8787/`. After N1 lands: N2 client and N3 cast data (split in `ai/TASKS.md`).
- For merges, keep sheet v12, use `defs().npclife` for the routines, and keep the owner's local player data
  (`game/.wrangler/` in each folder is per-folder and never committed).

## 2. State of main

Done and merged (all tests green, 29 suites): 4× grounds, zones, stones, 차원 균열 · game feel · day/night +
weather · autumn map · editor · responsive HUD · radar + map window (M) · bag 100 + housing (sheet v10) ·
**jobs**: J1 stats/levels 1–200/mastery/bow (v11), J2 weapon skills, J3 UI (stat tab, job tree, 아르센), **15
hybrids** unlocking at mastery 15/15 (`HYB_WM`), job tree as a 6×6 weapon table · **life**: L1 (v12, 생활 window),
L2 rules (gathering nodes, 84 recipes, pouch, 알바 board, delivery, trust) — **L2 has no client yet** · **new town**
100×76 with 15 signed buildings, 13 interiors, 16 ambient residents (`townfolk.js`, to be replaced by the NPC life
system), 15 side quests · **client split**: `client.js` is a 125-line entry + `state net events input actions
update overlay windows items hud win_char win_world win_shop win_social`; `scene2d.js` keeps the public API +
`scene_view props ground map people fx stage` (see `docs/FILEMAP.md`).

Process: slim `AGENTS.md`, `docs/FILEMAP.md`, `docs/RECIPES.md`, `docs/systems/*` (one page per system),
`ai/BRIEF.md` (brief template, routing by cost), quiet tests, `shot.mjs --el/--clip`, cache tag by
`npm run stamp` (never by hand).

## 3. Next work, in order (after §1)

1. **L2 client** from the contract in `docs/design/life-and-coop.md` H2: gathering nodes on maps (`map.nodes`,
   `ng`), gather channel + tap, station windows (craft/alchemy/cook), pouch view, 알바 board + delivery, trust;
   the 생활 window opens the four closed skills; material icons.
2. **Co-op part-time jobs** C1 (engine + 동동아파트) → C2 (쥬쥬식당) → C3 (캉캉대장간/보글연금공방) — life doc F;
   buildings/interiors already exist (town.md).
3. **Town polish**: the spirit tree's canopy hides the fountain; build building models lazily (town load
   380–450 ms); night light cost (+0.4 ms); sit on benches; job-tree cells cramped ("전직 가능" overlaps progress,
   long names like 주술암살자); "두 갈래 길은 15" hint in `mastery.js`/lobby text.
4. Verify in the live game: the nine new hybrid signatures (fx 120–128 were only seen in `_feel.html`), a real
   job change end to end, a life-skill level-up (`lv2`).
5. Codex backlog in `ai/TASKS.md`; merge with `ai/merge.md` / `AI-MERGE.bat`.

Other known follow-ups: quest tracker's last line clipped · editor can't place stones/shrines, doesn't
round-trip a map's `grade`/`nodes` · rift chest drawn under the player · sunset grade faint · `tests/maps` build-time
assertion flakes when the machine is busy (passes alone) · dead `wheel` line in `tickMob` · Lv-50/trust-60
cosmetics are titles only (need wardrobe art) · no side quests yet from service-role hosts (fixed by N4's chip).

## 4. Rules the owner set

- **No online deploy until the owner asks.** Then `npm run stamp`, commit, deploy (Higgsfield website
  `b29f4e07-243a-4614-aedf-47202eeb93fd`, slug lumentale-online; or `npm run deploy:cf`).
- Local development on the PC; Codex works in parallel (`ai/TEAM.txt` GEMINI=off). A push to GitHub `main` runs
  `.github/workflows/deploy-game.yml`, which **deploys** when the repo has its Cloudflare secrets — so push `main`
  only when the owner says so (or with `[skip ci]` in the head commit's message when the owner wants a backup push).
  Give Codex small, well-specified tasks through `ai/TASKS.md`; point it at the design contracts.
- Art is code-drawn; external/AI images only via `asset/` + import-art + owner approval (AGENTS rule 7).
- Small commits, English messages, Korean UI text; never edit `src/logic.js`; never bump `?v=` by hand.
- Token saving matters: follow `ai/BRIEF.md` (small agent tasks, lighter model for mechanical work, clipped shots).
- PC plugins (superpowers, frontend-design) are welcome; for game UI the pixel-art rules
  (`.claude/skills/pixel-art/rules/`) and the GBA HUD style win over generic web design.
- Local tools: `graphify update game` once (AGENTS token rule 0); codebase-memory per `docs/LOCAL_SETUP.md` §6.
