# Claude — merging the AI team's work (run from the main folder, branch main)

1. `git status` (main must be clean apart from the owner's edits to `ai/TASKS.md`, which you will
   commit). `git fetch origin && git merge --ff-only origin/main` if the remote moved.
2. For each worker branch that exists (`codex/work`, `gemini/work`):
   - `git log --oneline main..<branch>` — anything new? If not, skip.
   - Read its new `ai/reports/*.md` and review `git diff main...<branch>` against AGENTS.md §4.
   - Merge: `git merge --no-ff <branch>`. Conflicts in `game/src/logic.js` → resolve the parts in
     `game/src/logic/`, then `cd game && npm run build:logic`.
   - `cd game && npm run test:rules` must pass. If it fails and the fix is small, fix it; otherwise
     `git merge --abort` and add a follow-up task for that worker to the board.
3. Update `ai/TASKS.md`: tick `[x]` the merged tasks (add the report file name), and add follow-up
   tasks that the reports recommend (Gemini's findings usually become CODEX tasks).
4. Commit ("AI team: merge <tasks>"), push main (`git push origin main`).
5. Bring the workers up to date so their next session starts clean: for each worktree in `.work/`,
   `git -C .work/<name> rebase main` (only if its status is clean).
6. Tell the owner in Korean, in a few lines: what was merged, test result, what's next on the board.
