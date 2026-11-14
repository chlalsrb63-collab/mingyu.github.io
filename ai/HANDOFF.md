# 인수인계 — handoff from the cloud session to the local PC session (2026-11-14)

For the next integrator session: Claude Code on the owner's PC, folder `Tales Tales`. From now on development is
**local first** (work and test on the PC, push to GitHub `main`), side by side with Codex in its worktree.
Read this, `AGENTS.md` (loaded), `ai/BRIEF.md`, `docs/design/README.md`, `docs/systems/README.md`; then continue.
Reply to the owner in Korean; they want reports **with screenshots** ("다 끝나면 화면과 함께 알려줘").

Nothing is in flight in the cloud any more: everything is on `origin/main`. Start with `git pull` (UPDATE.bat).

## 1. First task — merge Codex's work (owner's decision)

The owner gave Codex (on this PC) the "living town NPCs" request: every NPC follows a daily routine by job and
personality, moves between the town and interiors with the time of day, keeps its role, relationships (walk
together, chat side by side), NPC positions on the map window. Codex's result was never pushed to GitHub.
1. Find it: `git worktree list`, `git branch -a`, `.work/codex` (branch `codex/work`), `ai/reports/`, uncommitted
   changes in the main folder (`git status`). Ask the owner if nothing is found.
2. Map it onto the contract `docs/design/npc-life.md` (section K.1 lists the six points to check: one pure
   `npcAt(id, now)`, data in `game/data/npclife.json` → `DATA.npclife` / `defs().npclife` (NOT `life`: that name is
   the life skills'), wire `nl`/`nw`, services stay at the post, `npcReach`, no sheet change). Keep what fits,
   rewrite what doesn't; rebase onto `main` (the client was split into modules — see §2 — so Codex edits to the
   old `client.js`/`scene2d.js` must be moved to the new files; never hand-merge `src/logic.js`, rebuild it).
3. `npm run test:rules`, `npm run data:check`, `npm run typecheck`, a live check; then push.
4. Continue the contract's work split for whatever Codex did not cover: N1 rules → N2 client ∥ N3 content (61
   plans, 38 relationships, lines; data only, lighter model) → N4 the eight quest lines (`meet` goal, `이야기`
   chip so service NPCs can give quests).

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
- Local development on the PC, pushing to GitHub `main`; Codex works in parallel (`ai/TEAM.txt` GEMINI=off).
  Give Codex small, well-specified tasks through `ai/TASKS.md`; point it at the design contracts.
- Art is code-drawn; external/AI images only via `asset/` + import-art + owner approval (AGENTS rule 7).
- Small commits, English messages, Korean UI text; never edit `src/logic.js`; never bump `?v=` by hand.
- Token saving matters: follow `ai/BRIEF.md` (small agent tasks, lighter model for mechanical work, clipped shots).
- PC plugins (superpowers, frontend-design) are welcome; for game UI the pixel-art rules
  (`.claude/skills/pixel-art/rules/`) and the GBA HUD style win over generic web design.
- Local tools: `graphify update game` once (AGENTS token rule 0); codebase-memory per `docs/LOCAL_SETUP.md` §6.
