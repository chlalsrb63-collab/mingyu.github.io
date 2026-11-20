# 직업 자유 — job reset, level reset, skill loadout (owner decisions, 2026-11-15; rules built, client to do)

Goal (owner): one character can eventually play every job. Builds on Codex's job levels (`self.jp`, `45-jobs.js`).

> **Owner change 2026-11-21:** the passive slots and the two cross-weapon (borrowed) passive slots are removed, with the
> Lv.150 quest that improved them (`sq_job_free`). Every learned passive is always on while its weapon is in hand; the
> loadout keeps only the five actives, picked from the weapon in hand (sheet v33 drops old `p`, `x`, `y`). Items 6 and the
> cross-slot notes below are history.

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
6. **After the first job**: two cross-weapon passive slots use learned masteries outside the job's weapon set.
   They grant half of the transferable bonus. The Lv.150 quest improves this to 60%.

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

9. **Two main weapons for everyone** (owner, 2026-11-15; today `weapon2` is hybrid-only, Tab swaps, no stats): anyone
   may wear a second main weapon. Small Roman **Ⅰ / Ⅱ** buttons above the weapon slot in the equipment window swap
   them, plus a rebindable hotkey (reuse the existing swap action in `keymap.js`). Mastery XP: the weapon in hand gets
   full XP; the weapon in the swap slot gets **30 %** of it — but if both are the **same kind**, that kind gets only
   **+10 %** extra (so a different kind in the swap slot is the efficient choice). Hybrids keep working as now.

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
- **Cross-weapon slots (v21)**: `lo[job].x` is preserved; `y` is the second slot and defaults to empty on old sheets.
  A passive cannot be equipped twice, and the hybrid's two native weapon kinds are ineligible for cross-weapon slots.
  New actives keep the on-hand rule. Each weapon learns five passives at Lv.10/20/30/40/50, with four native slots.
- **Transferable perks**: wear a weapon to receive `skill.borrow || skill.perk` at 50%, or 60% after
  `sq_job_free` (Lv.150, give the results of hunting 30 `stumpmaw` to 아르센). Original weapon-mechanic procs require
  the native slots. Cross-weapon selection depends on mastery, independent of progress in another job.
- **Wire**: `self.jobs = [[job, lv, xp]…]`; `self.lo = [actives, passives, x, explicit, open, y, percent]`.
  `t:"lo"` accepts optional `y`; leaving the field out preserves the second slot for an older client.
  `self.sk` row[3] reports whether the skill is active. `defs.jf.borrow` publishes the two percentages.

## As built — gear enhancement (§8; sheet v19)
- `ENH_RATE` 100 100 100 80 70 55 45 35 25 15; `ENH_PCT` [0,4,8,12,14.5,17,19.5,21.5,23.5,25.5,27.5] via `enhMul` (40 stats,
  45 weapon atk); weapon crit `ENH_CRIT` 0.5/step. Each try still costs gold + 강화석 1/2/3 (`enhCost`).
- Failure: one step down and `g.cu = 1` (cursed; `enh` refused). `{t:"uncurse", k}` at the smith with 1 `uncurse`
  저주 해제 주문서 (잡화점 2,500G) → `cu = 2`: the next try +`ENH_UNCURSE` 10 %p, then `cu` goes. Cursed gear still works.
  A 축복 강화석 failure keeps the step and brings no curse, so the player can try again at once (owner confirmed
  2026-11-15: "축복 강화석은 강화 실패 시 저주안붙어서 그냥 다시 강화 시도 가능하게 해줘"). Pity gauges unchanged.
- Wire: gear objects carry `cu`; `defs.enhPct / enhCrit / enhUc`. Client: smith rows (저주 해제 button), "저주받은" name prefix.

## As built — skill enhancement (§7; `48-skill-enh.js`, sheet v19)
- `{t:"ske", id}`: a learned active, town or by a campfire (`jfSafe`), 1 `ske_stone` 스킬 강화석 per try. `SKE_RATE`
  (proposed) 100 100 100 80 65 50 35 25 15 10; a failure eats the stone only. `skGrow` × (1 + 2.5 % × n) → +10 = +25 %.
- Sheet `ch.ske = { [id]: 1..10 }` (kept through job/level resets); wire `self.ske`, `defs.ske = {rate, pct, max, item}`.
- Client: "스킬 강화" list under the K window's 스킬 칸 tab. Stone sources: none yet (gear/content task, §6 of HANDOFF).
## As built — two weapons (§9; no sheet change, still v19)
- `eq weapon2` takes any weapon for anyone (level `req` as the main slot); a hybrid's must still be one of its pair. `wsw`
  works for everyone (same `WSW_MS` wait; dead/fishing refused); a non-hybrid's swap acts as a re-equip (`handChanged`).
- Mastery (`45-jobs.js gainWm` → `wmAdd`, `WM_SWAP`): hand 100 %, second weapon's kind 30 % (its own early bonus included);
  same kind twice → that kind 110 %, no share. **Hybrids use the same rule** — they had no pair share, so nothing doubles.
  Shares are fractional in play; `migrate` and `self.wm` floor them.
- Job reset keeps `weapon2` (level reset still bags gear above Lv.1). Client: slot Ⅱ always shown, "보조 무기로" on every
  weapon, Ⅰ (in hand, lit) / Ⅱ (swap) buttons above the weapon slot; Tab = keymap `swap` "무기 바꾸기 (Ⅰ/Ⅱ)" for anyone.
