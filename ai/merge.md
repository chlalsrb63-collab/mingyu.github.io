# Claude — merging the AI team's work (run from the main folder, branch main)

Work autonomously; the owner is not watching. Never force-push, never rewrite main's history.

1. `git status` (main must be clean apart from the owner's edits to `ai/TASKS.md`/`ai/ROADMAP.md`,
   which you will commit). `git fetch origin` and `git merge --ff-only origin/main` if the remote moved.
2. For each worker branch that exists (`codex/work`, `gemini/work`):
   - `git log --oneline main..<branch>` — anything new? If not, skip.
   - Read its new `ai/reports/*.md` and review `git diff main...<branch>` against AGENTS.md §4 and the
     quality bar in `ai/ROADMAP.md` (tone, Korean text, numbers with evidence, small diff, tests).
   - Merge: `git merge --no-ff <branch>`. Conflicts in `game/src/logic.js` → resolve the parts in
     `game/src/logic/`, then `cd game && npm run build:logic`.
   - `cd game && npm run test:rules` must pass. If it fails and the fix is small, fix it; otherwise
     `git merge --abort` and add a follow-up task for that worker to `ai/TASKS.md`.
3. Bookkeeping:
   - Tick `[x]` the task lines the reports quote — in `ai/TASKS.md` or `ai/ROADMAP.md`, wherever they
     are — and append `(ai/reports/<file>)`.
   - Gemini proposals: copy the best NEW lines from `ai/proposals/*.md` (Gemini's, or Codex's planning proposals while Gemini is off) into the **CODEX 백로그**
     of `ai/ROADMAP.md` (skip duplicates and anything that breaks the quality bar; keep the backlog
     under ~15 open lines).
   - If the bump of `?v=` in `game/public/index.html` is missing after client changes, add it.
4. Commit ("AI team: merge <tasks>") and `git push origin main`.
5. Bring the workers up to date for their next session: for each worktree in `.work/`, if
   `git -C .work/<name> status --porcelain` is empty, run `git -C .work/<name> rebase main`.
6. Finish with a short Korean summary for the owner: 합친 작업, 테스트 결과, 다음 차례 작업.
   Also append it with today's date to `ai/LOG.md` (create if missing) and include that in the commit.
