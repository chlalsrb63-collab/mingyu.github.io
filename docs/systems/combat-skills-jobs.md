# Combat, skills and jobs (stats J1, weapon skills J2)

Purpose: how a hero is built (six stats, level 1–200, weapon mastery, jobs), what a blow and a skill do, how monsters
hit back. Design (built through J2; J3 = full skill-tree UI): `docs/design/jobs-and-stats.md` ("J1 as built", "J2 as built").
Tables are in `02-jobs-stats.js` / `03-skills.js`, code in `45-jobs.js` / `57-weapon-skills.js` (`game/src/logic/`).

## Key files / functions
| symbol (file) | role |
| --- | --- |
| `STATS ST_ORDER ST_BASE 5 ST_CAP 99` (02) | six stats `str wil dex int wis luk`, wire order everywhere (`st`, `nx`, `train {a}`) |
| `toTier shownLv tierXp` (45, 20) | level 1–200 = `4·tier−3`; world tier 1–50 (`TIER_MAX`) is what monsters/maps/gear use; players see `shownLv` |
| `pointCost(N,s)`, `batchCost`, `nextCosts`, `levelOf` (45) | a level = one stat point bought with XP: `tierXp(toTier(N))/LV_DIV(4.4) × (1+STAT_K·max(0,s−30))`; `levelOf = 1+Σ(st−5)` |
| `eff(s)` (45) | soft caps: full to 40, half 40–60, quarter beyond |
| `SCALE`, `GRADE` {S1 A.85 B.7 C.5 D.3}, `JOB_PLUS` .1, `scaleOf` (02/45) | which stats scale each weapon kind (sword str A/wil C, dagger+bow dex A/luk C, spear str A/wis C, staff int A/wis C, book int A/wil C); single job +0.1; a hybrid's `JOBS[j].scale` replaces the table |
| `deriveStats(p)` (45) | sheet-only stats cached in `p.stc` (`mhp mmp atk0 core def crit critd ls acd aspd eva sneak cdr mpReg burst proc kbr poise res arm wk mag …`), formulas = `SFX` table; `stats(p)` (40) adds buffs. Invalidate with `p.stc=null` / `afterGear` |
| `JOBS`, `jobOk`, `isHybrid`, `hybridOf` (02/45) | 모험가 + 6 single (mastery 20, 5,000 G) + 6 hybrid (both weapons 20, 20,000 G; 2nd weapon in `eq.weapon2`; Tab = `wsw`, `WSW_MS` 800) |
| actions `train respec starter job_change wsw` (70/75) | `respec` 망각의 의식 (first free, then 10 % of `xpt`; `ch.rs`), `starter` once (`ch.sw`), `job_change` needs the 전직관 NPC (`npcNear "job"`) + gold and puts the job's signature on the bar (`skLearnNew`) |
| `gainWm(S,p,n)`, `wmHit`, `wmKill`, `newAct`, `wmNeed` (45) | mastery 1–50 per kind (`ch.wm[k]={lv,xp}`, need `22·m²`); +1 per hit action, +2 per skill (`WM_GAIN`), kill bonus by rank, ignores mobs `lowTier` 8 below you; each level opens skills (`WK_SKILLS`) |
| `SKILL SKILL_ORDER WK_SKILLS JOB_SKILL WK_PASSIVE SK_GROW` (03) | 30 skills: kind `a` weapon active (mastery 1 / 10), `p` passive (10), `j` single-job signature, `h` hybrid signature; power ×(1+SK_GROW .004·(mastery−need)) |
| `skWhy skLearned skLearnNew skillsFor` (57) | gating: weapon in hand, mastery/job, cooldown `p.cds{id:until}`, MP (`skMp`); Korean errors |
| `castSkill(S,p,id)` (57) | one `case` per id; emits `["a", eid, fx, x, y, dir…]`; helpers `pullTo reach weave addProp dealt healP` |
| `skillProps propPulse addProp` (57) | timed ground effects `rt.props` (grav phantom rain storm field pillar meteor trap burst sanct) |
| `weaponTick(S,p,now)` (57, called from 80) | per tick: passive decay, dance, props; `weaponReset` on death; `crView/crOf` gauge; `flagsOf` bits |
| `basicAttack` (50) | combo of 3 (third = finisher, `FINISH`); a bow goes to `bowShot` (45) |
| aim (50) | `AIM_N` steps, `AIM_V` unit vectors, `setAim(p,i)`, `validAim`, `inArc(p,o,half)`, `aimMob(rt,p,range,half)`: nearest mob inside the weapon arc, else nothing |
| arrows (45) | `fireArrow`, `shotTick` (stepped every tick, walls stop them via `canFly/solidAt`, pierce), `arrowMult` (DEX far bonus past `SFX.far` 90 px, hawk passive), `SHOT_MAX` 6 in flight |
| `STAGGER HOLD holdMob steady knock` (50) | hitstun: a hit holds the mob 140 ms (crit 200, elites ×.65) and pauses its cooldowns; budget `HOLD.cap` 340 ms per `HOLD.win` 2400 ms (no stun-lock); bosses immune |
| `mobHit(S,rt,p,raw,mob,how)` (80), `evadeBlow grazeChance staggerPlayer` (45) | monster damage to a player: `"blow"`/`"shot"` can be evaded (DEX); `"charge"/"tele"` or any elite/boss blow shoves the player (`SFX.stagPx`, cut by `kbr`/`poise`); a rift master hits softer (`mob.ak`) |

## Data shapes
- Sheet (v≥11): `lvl st{6} xpt rs sw job wm{kind:{lv,xp}} cnt eq.weapon eq.weapon2 qs`; `qs` entries `["s", skillId]`.
- Wire `self`: `st nx wm job sk` (every learned skill of every weapon; passives `[id,0,0,on]`), `cr` (hand's passive gauge; a hybrid adds `cr.o`), `dv`, `crit`; `me[9]` inertia/resonance; mob rows `M[i][8..9]` mark/brand. `defs()`: `skills skillOrder skGrow jobs wkOrder wkName jobWm grade wswMs`, `mobs[k].tier`.
- Actions `{t:"sk", id, a?}` (`a` = aim step), `{t:"atk", a?}`. Events: `["a",eid,fx,x,y,dir,combo]`; arrows `["ar",id,x0,y0,ux·1000,uy·1000,spd,kind,shooter]` / `["ae",id,x,y,how 0 hit·1 wall·2 range]`; props `["pr",id,kind,x,y,r,ms,eid]`, `["pp",…]`, `["pe",…]`; `["wm",eid,kind,lv]`, `["jc",eid]`, `["ws",eid]`, `["sg",eid]` (player staggered). Retired: `sw sr bn tp tq cn fo bk bl wl cf`, fx 40–65.

## Flow
Client sends `atk`/`sk` with an aim step → `validateAction` (weapon, cooldown, MP, not staggered) → `applyAction` `setAim` → `basicAttack`/`castSkill` → `hurtMob` (`wmHit` mastery, `holdMob`, crit from `deriveStats`) → `killMob` (`wmKill`). Monsters: `tickMob` (80) picks a move → `mobHit`. Bow: `bowShot` adds to `rt.shots`; damage lands in `shotTick` (`p.hitAct` carries the action for mastery).

## Client (`game/public/`)
`swing.js` (stroke poses, tempo `WIND .15 IMPACT .2 SNAP .5`, `bowPose`) · `skillfx.js` (`skillEvent` switch: fx 80–102 actives, 110–115 passives, 6 = bow draw; `bowFire`, `ar/ae`) · `weapongauge.js` (`drawWeaponGauge`, `gaugeTip`; replaced `classgauge.js`) · `mastery.js` (dock strip `renderStrip`, hover `fillTip`) · `quickslots.js` (bar by skill **id**; dims what the hand cannot use; toasts the server's reason) · `skillicons.js` (24 glyphs + 6 passives) · `audio.js SFX` (`bow_*`, `swap`). Preview: `_feel.html?rows=sk80,sk89:64,pr:grav`.

## Invariants / gotchas
- Never rename `JOBS`/`SKILL` ids or reorder `WK_ORDER` (persisted / wire index). New skill = table + `castSkill` case + fx code + icon + sound + `tests/skills.mjs` (recipe: AGENTS.md §8).
- Balance lives in the tables (`03-skills.js`, `SFX`, `WM_GAIN`), never in `castSkill`. `tests/balance.mjs` asserts kills/min per weapon vs the pre-J1 class (±25 %, bow −25…+10 %); tune the skill table, not the ranges.
- Passives are never cast (`sk` refuses them); `pasOn(p,id)` gates them. Mastery counts once per action (a cleave of 3 = one).
- Rift HP (`DIM.hpBase`) was tuned against these kits; changing skill power moves clear times (`tests/dimrift.mjs -v`).
- `tickMob` still has a dead `wheel` shot-block line from the old mage kit.

## Tests
`jobs.mjs` (stats, costs, derived golden rows, mastery, jobs, respec, starter, swap, tiers, arrows) · `skills.mjs` (all 30 skills, gating, passives, signatures, hybrids, bar, wire) · `aim.mjs` (blows go where aimed) · `feel.mjs` (hitstun, knockback, boss immune) · `balance.mjs` (probe: `scripts/balance-probe.mjs`) · `growth.mjs` · `hotbar.mjs` (quick slots) · `hard.mjs` (elite traits) · `content.mjs` (old sheets).
