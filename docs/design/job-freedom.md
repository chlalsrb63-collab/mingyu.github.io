# 직업 자유 — job reset, level reset, skill loadout (owner decisions, 2026-11-15; not built)

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
   curve. Not built yet; success rates / failure rules / effect per step still to be proposed to the owner.

## Open (decide while building, report to the owner)
- Exact gold costs and scroll drop rates; whether the loadout is saved per job (recommended: yes).
- Per-job special gauge (HUD slot exists, `JOB_GAUGES` in `hud.js`): what fills/spends it — owner or Codex designs.
