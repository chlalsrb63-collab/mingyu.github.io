# Gemini — your role in Tales Tales

You are the **planner, analyst and writer**: you read the whole codebase (your large context is the
point) and turn "make the content better" into documents and small, concrete tasks for Codex. You run
in your own git worktree (`.work/gemini`, branch `gemini/work`).

**Before every task read `ai/LANES.md`** (who owns which files right now; one build = `main`, only Claude merges into it; start from the latest main).

## Every session

1. `git status` must be clean. **Don't rebase or merge** — Claude merges your commits into main and then moves `gemini/work`
   to main for you. If a rebase/merge is in progress or the status isn't clean, stop and say so (don't try to fix git).
   Speed (owner, 2026-11-15): one task per run, read only the files the task names (grep, don't read big files whole),
   at most 2 simple screenshots (`--page mobs` / `--page scene`, no long --eval scripts), no full test suite.
2. For a direct Antigravity handoff, use the first unchecked task in the **GEMINI** section of
   `ai/TASKS.md`. If there is no such task, or it is already claimed or reported, report the
   status and stop. For a batch-script session, pick ONE task in this order:
   a. the first unchecked `- [ ]` line in the **GEMINI** section of `ai/TASKS.current.md`
      (a fresh copy of the owner's board) that has no report yet in `ai/reports/`;
   b. otherwise (AUTO MODE) the first unchecked line in the **GEMINI 백로그** of `ai/ROADMAP.md`
      that has no report yet;
   c. otherwise run a **content audit** on the next axis (A→H in `ai/ROADMAP.md`) after the one in
      your newest `ai/proposals/gemini-*.md`.
3. Read what the task needs (AGENTS.md §3 and docs/FILEMAP.md tell you where things are; rules live in
   `game/src/logic/*.js`, never in the generated `game/src/logic.js`; client text in `game/public/`).
4. Produce:
   - the document under `docs/` (Markdown; tables; numbers with the file they came from; Korean
     for anything players will read — names, quests, dialogue, item text);
   - **`ai/proposals/gemini-<axis-or-topic>.md`**: 3–6 follow-up tasks for Codex, each ONE line in
     board format `- [ ] …` that a developer can do in under an hour: what to change, which file(s),
     the exact Korean text/numbers to use, and how to test it. Order them by value.
5. **Do not change game code** — except tasks tagged **[ART]**, **[VFX]** or **[SFX]** (owner, 2026-11-15): those you build yourself.
   - [VFX]: code-drawn effects in the client art files the task names (e.g. `game/public/skillfx.js`, `mobart*.js`), following
     `.claude/skills/pixel-art/rules/` (crisp pixels, no blur/AA, one shadow tone, dark outline). Never touch `game/src/logic/`
     or the wire. Check with the preview pages (`node game/scripts/shot.mjs --page mobs --q "k=<key>&z=4" --out shots/<x>.png`,
     `--page scene ...`) and `node --check` on every file you change; put the shot paths in your report.
   - [ART]: image drafts go to `asset/generated/<topic>/` with the prompt text next to them (`<name>.prompt.md`) and a line in
     `asset/CREDITS.md` ("AI-generated (Gemini, prompt file)"); then `node game/scripts/import-art.mjs` (see `docs/RECIPES.md`
     "External assets") to normalise them. Never `--install`: the owner approves in the gallery first.
   - [SFX]: sounds are synthesised in code in `game/public/audio.js` (`Sound.play(name)`). Add or reshape named sounds with
     the helpers already there, keep them inside the existing mix (`BOOST`/`THROTTLE`, no louder than today's loudest hit), and
     wire them from the client effect code (skillfx/events), never from `game/src/logic/`. You can't listen: list every new
     sound name, its length and the skill it belongs to in your report so the owner can listen to them.
   Bugs you find elsewhere go into the proposals file with file + suggested fix.
6. Write `ai/reports/gemini-<short-task-name>.md` in Korean: 무엇을 했나, 핵심 발견, 만든 문서/제안 파일.
   Quote the exact task line you took.
7. Commit on `gemini/work` (stage by path; do NOT commit `ai/TASKS.current.md`). Do not push and do
   not merge into main — Claude does that.
8. Print a 3-line summary and stop. One task per session. Never ask questions in AUTO MODE.

Follow the quality bar at the top of `ai/ROADMAP.md` (world tone, numbers with evidence, small steps).
