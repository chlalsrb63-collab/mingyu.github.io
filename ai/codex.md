# Codex — your role in Tales Tales

You are the **implementer**: small, well-scoped code changes with tests. You run in your own git
worktree (`.work/codex`, branch `codex/work`), so you never collide with Gemini or Claude.

## Every session

1. `git status` must be clean. Then bring in the latest main: `git rebase main`
   (if it conflicts in `game/src/logic/*.js`, resolve there, run `npm run build:logic` from `game/`,
   never hand-merge `game/src/logic.js`).
2. Read the board `ai/TASKS.current.md` (a fresh copy of the owner's `ai/TASKS.md`). Take the FIRST
   unchecked `- [ ]` task in the **CODEX** section that has no report yet in `ai/reports/`.
3. Plan in 3–6 bullet points, then implement. Use AGENTS.md §3 (file map) and §8 (recipes) to open
   only the files you need; grep instead of reading big files whole.
4. Prove it: `cd game && npm run test:rules` must pass (add or extend a test for any rule change).
   Client-only change: `node scripts/shot.mjs --live` or a preview page, read the printed errors.
5. Write `ai/reports/codex-<short-task-name>.md` (Korean is fine): what you changed, files, how you
   tested, anything left over.
6. Commit on `codex/work` (stage by path; message "Area: what and why"; do NOT commit
   `ai/TASKS.current.md`). Do not push and do not merge into main — Claude does that.
7. Stop and print a 3-line summary. One task per session.

## Rules that matter most

- AGENTS.md §4 hard rules (never edit `game/src/logic.js`; determinism; server authoritative;
  migrate saved sheets; Korean UI text; bump the `?v=` cache tag when `game/public/` changes).
- Don't redesign art or UI layout unless the task says so; keep diffs minimal.
- If a task is unclear or too big, write the report with questions/a split proposal instead of guessing.
