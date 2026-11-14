# 인수인계 — handoff from the cloud session (2026-11-14)

For the next integrator session (normally Claude Code on the owner's PC, folder `Tales Tales`). Read this,
`AGENTS.md` (loaded), `ai/BRIEF.md`, `docs/design/README.md`; then continue. Reply to the owner in Korean;
they want reports **with screenshots** when work finishes ("다 끝나면 화면과 함께 알려줘").

## 0. First, check what is in flight

The cloud session started three agents before handing off. Two push to `main` by themselves when they finish:

```
git fetch origin && git log --oneline origin/main | head -20
```
- **T-A town exterior** (`docs/design/town.md`, T-A part): commits starting "Town" (buildTown 100×76, terrain,
  exteriors, signs, `public/townfolk.js` residents, enter/exit fade, tests). Until it lands, don't touch
  `buildTown`, `iso_ground.js`, `iso_tall.js`, `scene2d.js`, `decor.js`.
- **J2 weapon skills** (`docs/design/jobs-and-stats.md` J2): commits starting "Skills"/"Jobs J2"
  (`57-weapon-skills.js`, fx 80–115 in `skillfx.js`, `skillicons.js`, balance asserts). Sheet v13 if it bumps.
  Until it lands, don't touch `55/57-*.js`, `skillfx.js`, `skillicons.js`, `audio.js`.
- **T-B town interiors**: finished but NOT on main (its links point at T-A's new town). Saved as patches in
  `ai/pending/town-interiors/`. If `git log origin/main --oneline | grep "Town interiors"` already shows it, the
  cloud session merged it: delete `ai/pending/` and skip this. Otherwise, **after T-A is on main**:
  ```
  git am -3 ai/pending/town-interiors/*.patch
  # on a conflict in game/src/logic.js:  cd game && npm run build:logic && git add src/logic.js && git am --continue
  cd game && npm run test:rules && npm run data:check && npm run typecheck
  ```
  Then remove the "town is not 100×76 yet" skip gate in `tests/interiors.mjs`, check the renderer skips
  `thing: true` NPCs (furniture objects; they must not draw as little animals), `git rm -r ai/pending`, commit, push.
  T-B's notes: ten rooms (owl_library dojo general_store kangkang_forge merc_office bogle_lab juju_diner boutique
  pet_house dongdong_apt), 8 new pieces + 8 room styles + `lobby`, `npcLook` takes a full hero look, `thing` NPCs,
  min room size 8, a few keepers moved behind counters.

If an agent never lands (the cloud container died), redo that phase from its design doc with a fresh agent.

## 1. State of main (f3ce265 + this handoff)

Done and merged: Phase 0–2 (lazy maps, cells, 4× grounds, zones, stones, 차원 균열) · game feel · bow art ·
interiors v1 (cafe/hall/inn) · day/night + weather (maple got weather in 390f321) · autumn map · editor ·
responsive HUD/window safe zone · radar minimap + `#w-map` (M; sound moved to Shift+M) · bag 40→100 + housing
(sheet v10) · J1 jobs/stats core (sheet v11, 전직관 아르센, bow weapon, `legacyCls` bridge until J2) · L1 life core
(sheet v12, 생활 window Shift+L, graded fish, cooking XP) · town design contract · token-saving process
(slim AGENTS.md, `docs/FILEMAP.md`, `docs/RECIPES.md`, `docs/systems/*`, `scripts/stamp.mjs`, quiet tests,
`shot.mjs --el/--clip`).

## 2. Next work, in order

1. Merge T-B (above). Report to the owner with screenshots: town overview, plaza, a street with signs, one
   interior, night residents (+ J2 skill effects when it lands).
2. **Split the big client files** (token plan #4): `public/client.js` → window modules (`win_*.js`), `scene2d.js`
   → render stages; no behaviour change, `shot.mjs --live` with no page errors, FILEMAP rows.
3. `docs/systems/` pages for combat+skills+jobs, town, life, housing (the cloud pass skipped them).
4. **J3** (jobs UI: stat tab, mastery/job tree window, job NPC flow, appearance-only creation) — jobs doc F.
5. **L2 ∥ C1** (gathering/crafting/delivery/알바 board; co-op engine + 동동아파트) — life doc F; town buildings
   now come from town.md (not the old C.1 coordinates). Then C2 (쥬쥬식당), C3 (캉캉대장간/보글연금공방).
6. Codex backlog in `ai/TASKS.md` (owner runs `AI-TEAM.bat`); merge with `ai/merge.md`.

Known follow-ups: quest tracker's last line clipped · windows can overlap after shrinking the browser · editor
can't place stones/shrines and doesn't round-trip a map's `grade` · rift chest drawn under the player · sunset
grade faint, night maybe too dark · old town tiles in `TELLER` (62) and `DIM_TOWN` (31) — T-A was asked to move
them; verify · J1: new heroes strong at high tiers (J2 owns tuning) · L1: materials have no icons yet (L2), the
meadow no longer gives trout (by design).

## 3. Rules the owner set

- **No online deploy until the owner asks.** Then: `npm run stamp`, commit, and deploy (Higgsfield website
  `b29f4e07-243a-4614-aedf-47202eeb93fd`, slug lumentale-online; or `npm run deploy:cf`).
- Work locally, keep improving quality; Codex-only AI team (`ai/TEAM.txt` GEMINI=off).
- Art is code-drawn; external/AI images only via `asset/` + import-art + owner approval (AGENTS rule 7).
- Integration branch `main`; small commits, English messages, Korean UI text; never edit `src/logic.js`.
- Plugins on the PC (superpowers, frontend-design) are welcome; for game UI the pixel-art rules
  (`.claude/skills/pixel-art/rules/`) and the GBA HUD style win over generic web design.
- Local tools: `graphify update game` once, then use it (AGENTS token rule 0); codebase-memory per
  `docs/LOCAL_SETUP.md` §6.
