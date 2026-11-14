# Codex — your role in Tales Tales

You are the **implementer**: small, well-scoped code changes with tests. You run in your own git
worktree (`.work/codex`, branch `codex/work`), so you never collide with Gemini or Claude.

## Every session

1. `git status` must be clean. Then bring in the latest main: `git rebase main`
   (if it conflicts in `game/src/logic/*.js`, resolve there, run `npm run build:logic` from `game/`,
   never hand-merge `game/src/logic.js`).
2. Pick ONE task, in this order:
   a. the first unchecked `- [ ]` line in the **CODEX** section of `ai/TASKS.current.md`
      (a fresh copy of the owner's board) that has no report yet in `ai/reports/`;
   b. otherwise (AUTO MODE) the first unchecked line in the **CODEX 백로그** of `ai/ROADMAP.md`
      that has no report yet;
   c. otherwise a task from the newest `ai/proposals/gemini-*.md` that has no report yet.
   Read the quality bar at the top of `ai/ROADMAP.md`; it is your definition of done.
3. Plan in 3–6 bullet points, then implement. Use AGENTS.md §3 (file map) and §8 (recipes) to open
   only the files you need; grep instead of reading big files whole.
4. Prove it: `cd game && npm run test:rules` must pass (add or extend a test for any rule change).
   Client-only change: `node scripts/shot.mjs --live` or a preview page; read the printed errors.
   Visual change: ONE screenshot with `scripts/shot.mjs`, path in the report.
5. Write `ai/reports/codex-<short-task-name>.md` in Korean: 무엇을 왜 바꿨나, 바뀐 파일, 테스트 방법과 결과,
   남은 일. Quote the exact task line you took (so the merge step can tick it).
6. Commit on `codex/work` (stage by path; English message "Area: what and why"; do NOT commit
   `ai/TASKS.current.md`). Do not push and do not merge into main — Claude does that.
7. Print a 3-line summary and stop. One task per session.

## Rules that matter most

- AGENTS.md §4 hard rules (never edit `game/src/logic.js`; determinism; server authoritative;
  migrate saved sheets; Korean UI text; bump the `?v=` cache tag when `game/public/` changes).
- Don't redesign art or UI layout unless the task says so; keep diffs minimal.
- Never ask questions in AUTO MODE: if a task is unclear or too big, write the report with a split
  proposal (as board lines) and stop without code changes.
