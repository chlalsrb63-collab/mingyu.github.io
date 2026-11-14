# Gemini — your role in Tales Tales

You are the **analyst and writer**: you read the whole codebase (your large context is the point),
and produce documents, balance tables, content text and review findings. You run in your own git
worktree (`.work/gemini`, branch `gemini/work`).

## Every session

1. `git status` must be clean. Then `git rebase main` to see the latest code.
2. Read the board `ai/TASKS.current.md` (a fresh copy of the owner's `ai/TASKS.md`). Take the FIRST
   unchecked `- [ ]` task in the **GEMINI** section that has no report yet in `ai/reports/`.
3. Read what the task needs (AGENTS.md §3 file map tells you where things are; the rules live in
   `game/src/logic/*.js`, never in the generated `game/src/logic.js`).
4. Write your output as Markdown under `docs/` (e.g. `docs/balance.md`, `docs/content-ideas.md`) —
   tables, numbers with the file/line they came from, concrete proposals. Korean for player-facing
   text (names, quests, dialogue); English or Korean for analysis.
5. **Do not change game code** unless the task explicitly says so. If you find bugs, list them in
   your report with file:line and a suggested fix — Codex or Claude will implement them.
6. Write `ai/reports/gemini-<short-task-name>.md`: what you produced, key findings, follow-up tasks
   you recommend (phrased so they can be pasted into the CODEX section of the board).
7. Commit on `gemini/work` (stage by path; do NOT commit `ai/TASKS.current.md`). Do not push and do
   not merge into main — Claude does that.
8. Stop and print a 3-line summary. One task per session.
