# 에이전트 작업 지시 틀 — brief template for implementation agents

The integrator (Claude) writes every agent brief from this shape so agents start cheap and finish small.

1. **Goal** — one paragraph, the player-visible result.
2. **Read first** — `AGENTS.md` (always loaded), then only: the design doc + section names
   (`docs/design/README.md`), the `docs/FILEMAP.md` rows for the files to touch, the one `docs/RECIPES.md` recipe.
3. **Own / don't touch** — files this agent owns; files other running agents own.
4. **Contracts** — frozen ids, coordinates, wire fields, sheet version, action names.
5. **Verify** — the relevant tests while working, the full `npm run test:rules` + `typecheck` + `check:split`
   once at the end; ≤5 screenshots for own checks plus the named final shots (gitignored `game/shots_<task>/`).
6. **Land** — logical commits, stage by path, trailer; `git fetch && git rebase origin/main`, rebuild
   `logic.js` after part conflicts, rerun tests, push `HEAD:main`. Never touch `?v=`.
7. **Report** — ≤40 lines: what landed, numbers measured, deviations, screenshot paths, known issues.
