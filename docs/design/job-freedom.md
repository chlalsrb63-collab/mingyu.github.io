# 직업 자유 — job reset, level reset, skill loadout (owner decisions, 2026-11-15; rules built, client to do)

Goal (owner): one character can eventually play every job. Builds on Codex's job levels (`self.jp`, `45-jobs.js`).

## Owner decisions
1. **No mastery cap on hybrids.** A weapon mastery above 15 never blocks choosing a two-weapon (hybrid) job.
2. **전직 초기화 (job reset)**: allowed. Every job's job XP and job level are kept per job (switching back resumes it).
3. **레벨 초기화 (level reset)**: allowed. Only the character level and stat investment go back to 1. Kept: weapon
   masteries, gear, gold, quests, boss trophies, cosmetics, every job's XP/level. Level-locked gear can't be worn
   until the level is reached again.
4. **Cost** of both resets: a dedicated item **초기화 주문서** (job reset / level reset scrolls) **plus gold**; done at
   the 전직 교관 (job NPC). Scroll sources: rift/weekly boss rewards (to be placed with the gear task).
5. **Skill loadout**: at most **5 active skills** and **4 job passive skills** in use. Changed only in a safe place
   (town or beside a campfire), from the skill window.
6. **Lv.150+**: a separate quest from the 전직 교관 unlocks **1 off-job passive** slot (a passive of another job the
   character has unlocked/played).

7. **Active skill enhancement** (owner, 2026-11-15; separate task AFTER the job-freedom rules): each active skill can be
   enhanced up to **+10** with a dedicated **스킬강화 아이템**. Content for very hardcore players — rare material, steep
   curve. Owner's rules: +1..+3 always succeed; from +4 on a chance to fail; a failure only consumes the material, the
   level is kept (no drop, no break). Each step adds a small, flat ≈ 2–3 % over the base skill (so +10 ≈ +25 %).
   Success rates per step still to propose (steep, e.g. 80 % at +4 down to ~10 % at +10).

8. **Gear enhancement rebalance** (owner, 2026-11-15; after job-freedom merges — touches 45/40 stat code): same feel as
   skills in strength only. +10 max; +1..+3 safe (`ENH_RATE` 100/100/100, the rest unchanged: 80 70 55 45 35 25 15),
   ≈4 %/step; +4..+6 ≈2.5 %/step; +7..+10 ≈2 %/step → cumulative [0,4,8,12,14.5,17,19.5,21.5,23.5,25.5,27.5] % on base
   stats (today: +10 % per step, +100 % at +10). Weapon crit per step 1 → 0.5. Keep low/high players close.
   Each try consumes **강화석**. **Failure (owner, overrides "material only")**: the gear drops ONE step below where it
   stood (trying +4→+5 and failing leaves it at +3) and becomes **저주받은** (cursed): it can't be enhanced until a new
   **저주 해제** item is used on it; after lifting the curse its next try gets **+10 %p** success (stacks with the
   blessing, capped at 100). Cursed gear still works when worn (assumption — tell the owner). Pity gauges stay.
   The curse lives on the gear (persisted field; default in normalise, sheet bump). Source of the 저주 해제 item: shop
   for gold + rift/weekly boss drops (gear task).

## Open (decide while building, report to the owner)
- Exact gold costs and scroll drop rates; whether the loadout is saved per job (recommended: yes).

## As built (rules, `src/logic/47-job-freedom.js`; sheet v18) — for the client task
- **Hybrids**: no upper block existed in the rules; both weapons ≥ 15 (`HYB_WM`) opens the job at any higher mastery
  (tested). The 전직관's lines said 20 and "can't be undone" — fixed (`data/npcs.json`, `public/jobtree.js`).
- **Sheet**: `ch.jobs = { [job]: {lv, xp} }` every job walked (ch.jp is the current one's record, same object);
  `ch.lo = { [job]: {a: [≤5 ids], p: [≤4 ids], x: "" | id} }` loadouts once set. v17 sheets: `jp` moves into `jobs`.
- **Job reset** `{t:"job_reset"}` at the 전직관 (role `job`): back to 모험가 (chosen: re-uses `job_change`; taking up a job
  walked before is **free** and resumes its level). 1 `scr_job` 전직 초기화 주문서 + 1,000 + 50 × level G.
  A hybrid's second weapon goes to the bag (needs a free slot).
- **Level reset** `{t:"lv_reset"}` at the 전직관: stats back to 5, level 1, `xpt` 0; spent experience is **not** refunded
  (망각의 의식 `respec` still does that). Kept: unspent XP, masteries, gear, gold, quests, trophies, cosmetics, job levels.
  Worn gear with `req` > 1 goes to the bag (validate asks for the room); wearing it again needs the level (`eq`).
  1 `scr_lvl` 레벨 초기화 주문서 + 5,000 + 100 × level G.
- **Scroll sources (placeholder for the gear task)**: weekly boss challenge big reward → `scr_lvl`; a rift chest's weekly
  bracket bonus at tier ≥ 20 → `scr_job` (64-dim.js `jfScroll`).
- **Loadout** `{t:"lo", a:[ids], p:[ids], x?:id}` replaces the current job's loadout (saved per job); only on a safe map
  (town) or beside a campfire. Unset = the first learned, the hand's (or hybrid pair's) skills first — no one-weapon or
  hybrid kit has more than 5 actives. Skills learned after a set fill free slots. Casting an active not in `a` →
  "스킬 칸에 넣지 않은 스킬입니다 — 마을이나 모닥불 곁에서 바꿀 수 있습니다"; passives not in `p` do nothing.
- **Off-job slot**: side quest `sq_job_free` (giver `town_job_arsen`, Lv.150, kill 30 `stumpmaw`) opens it; `x` = a learned
  passive of a weapon of another job in `ch.jobs`; it works with any weapon in hand (hooks that test the weapon still do).
- **Wire**: `self.jobs = [[job, lv, xp]…]`; `self.lo = [actives, passives, off-job id, set 1/0, off slot open 1/0]`;
  `self.sk` row[3] is 0 for actives out of the loadout; a passive row's flag follows the loadout.
  `defs.jf = { lo: [5, 4], scroll: {job, lvl}, cost: {job: [base, perLv], lvl: [base, perLv]}, quest }`.
- Client to do: loadout editor in the skill window, the two reset buttons at the 전직관, the off-slot picker.
