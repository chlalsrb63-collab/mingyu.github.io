# 무직 시작 · 여섯 능력치 · 무기 숙련 · 전직 — 설계서 (jobs and stats)

Status: design, ready for implementation (J1 → J2 → J3, section F). Audience: the implementers of J1/J2/J3 and the
agents running Phase 0/1/2 of [`scale-and-rift.md`](scale-and-rift.md) and the game-feel upgrade. Code, identifiers and
commit messages are English; every player-facing string is Korean (AGENTS.md rule 6). Numbers marked (measured) come
from throwaway node scripts run against the built `logic.js` of `origin/main` at 6e80ef5; (model) = a kill-rate model
calibrated to the README bot targets (Lv.7 ≈ 15 min, Lv.40 ≈ 11 h); everything else is a decided design value that
lives in a table so balance edits are data-only.

The owner's contracts (they override any naming below if they ever differ): sheet `st: {str, wil, dex, int, wis, luk}`,
`wm: {sword, dagger, spear, staff, book, bow}` each `{lv: 1..50, xp}`, `job` default `"adventurer"` (모험가), the 6
single jobs and 6 hybrids of C.3/C.4 exactly, `MAXLV = 200`, stat investment through `case "train"`, `gainXp` only
accumulates, mastery XP from `hurtMob`/`killMob` for the equipped kind, bow basic attack along `AIM_V`.

---------------------------------------------------------------------------------------------------------------

## 0. Decisions on one screen

1. **One level scale for players (1–200), one internal tier scale for the world (1–50).** Monster `MOBS[k].lv`, map
   `band`, `FIELD_BOSS`, chest levels and every monster-side formula stay exactly as they are (call it the *tier*). Two
   helpers convert: `toTier(N) = (N + 3) / 4` (player level → tier, real) and `shownLv(t) = 4·t − 3` (tier → the
   level printed on screen). The client only ever sees shown levels (`defs().mobs[k].lv`, door labels, blame text),
   so "Lv.37 player vs Lv.37 monster" means the same as "old Lv.10 vs Lv.10". 단풍 왕도 shows **Lv.157–181**.
2. **The XP economy is untouched.** XP per kill, quests, bounties, dailies, invasion and rift payouts keep their old
   values (expressed through `tierXp(toTier(lvl))`); the new point cost is calibrated so that the cumulative XP to
   level `4L−3` equals the old cumulative XP to level `L` within ±4 % for a typical build (B.2, measured).
3. **Level = 1 + points spent.** Every stat starts at 5 and caps at 99; one point = one level; 199 points at Lv.200.
   Points are bought with unspent XP **at a campfire or at 수련관 카이** (Dark-Souls bonfire). Soft caps at 40 and 60
   (B.3) make spreading better than dumping.
4. **Weapon mastery 1–50 per kind** (`wm`), gained by hitting and killing with that kind in hand; `22·m²` mastery XP per
   level → ≈ 20 min to 10, ≈ 2 h to 20, ≈ 15 h to 50 with one weapon (model). It adds +1 %/level to the weapon's own
   attack and +1 accuracy (removes grazes, B.6), unlocks skills at 1 / 10 / 20 and makes skills grow (+1.2 %/level).
5. **Jobs**: at mastery 20 a 모험가 may take the single job of that weapon (signature skill, +0.1 on that weapon's two
   scaling coefficients); or stay 모험가 until **two** weapons of a listed pair are ≥ 20 and take the hybrid (dual
   scaling table, free swap with a second weapon slot on `Tab`, both weapons' passives always on, fusion signature).
   Job change is irreversible in v1.
6. **Class gauges are retired as classes and reborn as weapon passives** (grit bar → 관성, marks → 표식/출혈, tip →
   창끝, weave → 공명 + elemental reactions, new 낙인 and 매의 시야). Skill levels (`skl`, `sklv`), stat training (`tr`,
   `TRAIN`) and the 24 class skills retire; their XP/gold is refunded on migration.
7. **Bow** is a real projectile simulated on the server (`rt.shots`, stepped per tick, 420 px/s, range 150).
8. Old characters migrate to **level 4L−3** with stats allocated by a class template, the class weapon's mastery = old
   level (cap 50), the matching single job if old level ≥ 20 (mage → 마법사 or 마도사 by the equipped weapon), all
   refunds paid, **one free stat reset**, and **no item ever lost**.

---------------------------------------------------------------------------------------------------------------

## A. Current state (pointers)

| topic | where | facts / what changes |
| --- | --- | --- |
| classes | `00-header.js` `CLASSES` (warrior/rogue/lancer/mage: `wk`, `hp/mp/atk/def` = base + per level, `crit`) | retired → `JOBS` (C.3/C.4). Old ids survive only in `migrate` and the lobby's alias table |
| weapon kinds | `00-header.js` `WKIND` (sword/dagger/spear/staff/book: cd, range, fx 0–5, cleave/line/splash, kb, mult, arc), `COMBO_MS`, `FINISH`, `TIP` | + `bow`; mults rebalanced because atk no longer depends on class (D.1) |
| class mechanics | `00-header.js` `GRIT_MAX MARK_MAX FOCUS_MAX`, `REACT`, `ELEM`; `55-class-skills.js` `addGrit addMarks addFocus spendFocus weave classTick classReset flagsOf crValue crView castSkill` (fx codes 40–75) | J2 replaces 55 by `57-weapon-skills.js`; `weave`/`REACT`, `pullTo`, `reach`, `mobsInLine`, `marksOf/addMarks`, dance stepping, decoy props reused |
| skills | `00-header.js` `SKILLS[cls]` (6 per class, `lv` 3/7/12/18/25/35), `10-tables.js` `SK_MAX SK_STEP skillCost skillCd levelled()`; trainer action `sklv` (70 L250, 75 L119); `qsLearn` on level-up (`50 gainXp`) | retired: `SKILL` by id (C.1), grows with mastery |
| stat training | `10-tables.js` `TRAIN {str vit int grd}`, `trainCost(n) = 120 + 40n`; action `train {k, n}` (70 L242, 75 L109) near `npcNear(p,"train")` | `train` becomes stat investment `{a:[6]}` (B.1) |
| XP curve | `20-helpers-mapkit.js` `XP_STEPS`, `XP_K`, `xpNeed(lv)`; `MAXLV = 50` (00); `gainXp` levels up in a loop (`50` L205) | `xpNeed` renamed `tierXp` (kept as alias), `gainXp` only accumulates |
| derived stats | `40 stats(p)` from `CLASSES[cls]` base + per level, `gearBonus`, `tr`, `armOf/weaponKind` (fallback `CLASSES[cls].wk[0]`) | rewritten from the six stats (B.4) |
| class locks | `ITEMS[w_*].cls` from `WK_CLASS`; `eq` validate "다른 직업의 장비입니다" (70 L224), `buy` (70 L290), `resolveItem("W1", cls)`, `lootFor`/`rewardGear` pick the class's kinds (50 L184, 60 L105), `migrate` replaces a mismatched weapon (40 L78: **would destroy items**, must go) | all locks removed; item ids `w_warrior_N w_rogue_N w_lancer_N w_mage_N w_book_N` kept (persisted), `w_bow_N` added |
| quick slots | `40 QS_N QS_USE qsOk qsLearn`, `["s", index]` into `SKILLS[cls]`; client `quickslots.js` | `["s", skillId]` (J2) |
| auto-hunt | client `client.js` `autoSt`, `autoOk`, skill loop `G.defs.skills[s.cls]` (~L1060), `castSkill(i)` (~L789) | uses `self.sk` usable flags (C.6) |
| fx | server `ev(code,…)` in `castSkill`; client `skillfx.js skillEvent` `case 40–75`, `skillicons.js GLYPH`, `audio.js SFX`, `swing.js STROKES` (no bow), `weapons.js DESIGNS` (no bow) | new codes 6, 80–102, 110–115 (C.5) |
| gauge | `self.cr = crView(p)`; client `classgauge.js drawClassGauge/gaugeTip`; `skillfx.js` mage orb uses `G.self.cls === "mage"` | `crView` by weapon passive (C.7) |
| creation | `lobby.js` class cards `#c-cls`, `draft.cls`, `CLASS`/`CLASS_ICON`; `room.ts` L276 `newChar(name, action.cls, look)`; `protocol.ts` | appearance + name only |
| class elsewhere | `90-views-api.js` `self.cls`, `who[2]`, `party[2]`, `gmates[2]`, `defs().classes`, `defs().skills`; `room.ts` rank rows `{name, cls, lvl, xp}` sorted lvl/xp; `accounts.js` summary `m:<pid> {name, cls, lvl, look}`; `sprites.js playerLook(cls, …)` (ignores cls) | position 2 / key `cls` keeps its slot but carries the **job id** |
| achievements & co | `60-content.js` `ACH` `lv10 lv30 lv50` on `c.lvl`; counters `ch.st` (`ST_KEYS`); dailies/event rewards `xpNeed(min(lvl, MAXLV−1))`; `near` bounty pick `MOBS[k].lv <= ch.lvl + 2`; `bq` "감당하기 어려운" `d.lv > ch.lvl + 4`; `TUT` (7 steps, index persisted) | `ch.st` becomes the six stats ⇒ counters move to `ch.cnt`; level comparisons go through `toTier` |
| tests | `tests/skills.mjs` (38 class refs), `growth.mjs` (49: sklv, train), `aim.mjs` (22), `content.mjs` (old sheets), `loot.mjs`, `hotbar.mjs`, `party/hard/sim/world/life/wardrobe/...` call `newChar(name, cls)` | J1 adds a test helper `hero()` (F.3) |

---------------------------------------------------------------------------------------------------------------

## B. Stat model

### B.1 Sheet, level, investment

```js
ch.st  = { str: 5, wil: 5, dex: 5, int: 5, wis: 5, luk: 5 }    // 5..99 each
ch.lvl = 1 + Σ (st[k] − 5)                                       // stored for rank/lobby, recomputed by migrate (never trusted)
ch.xp  = unspent XP (0..2e9)        ch.xpt = total XP spent on points (respec refunds it; rank tie-break)
```
- `gainXp(S,p,n)`: same multipliers as today (`stats(p).xp`, streak, party share, guild…), adds to `ch.xp`, never
  levels. When `ch.xp` first reaches the cheapest next point, one toast "레벨을 올릴 수 있습니다 — 모닥불이나 수련관에서
  능력치를 고르세요." (`p.lvHint` per session, not saved).
- **Action `{t:"train", a:[str, wil, dex, int, wis, luk]}`** (ints ≥ 0, sum 1..50). Validate (Korean): place
  `fireNear(rt,p) || npcNear(p,"train")` else "모닥불 곁이나 수련관 앞에서 레벨을 올릴 수 있습니다"; each
  `st+a ≤ 99` else "능력치는 99까지 올릴 수 있습니다"; `lvl+Σ ≤ MAXLV` else "최고 레벨입니다"; `ch.xp ≥ batchCost`
  else "경험치가 부족합니다"; not dead. Cost of a batch = points bought **one at a time in stat order** (str…luk),
  each at the then-current level and that stat's then-current value (deterministic; the client mirrors it from
  `defs().lvc`). Apply: `xp −= cost`, `xpt += cost`, `st += a`, `lvl += Σ`, `p.stc = null`, full HP/MP (as old level
  ups), event `["l", eid]`, `saveSoon`, `checkAch`; `sys` broadcast at Lv.50/100/150/200.
- **Action `{t:"respec"}`** at 수련관 only: all stats back to 5, `lvl = 1`, `xp += xpt`, `xpt = 0`. Free while `ch.rs > 0`
  (`rs--`), else costs `ceil(0.1·xpt)` XP taken from the refund ("망각의 의식"). Mastery and job are untouched.
- `MAXLV = 200`. XP still accrues at 200 (sink: respec; future content).

### B.2 Point cost (measured)

```js
const LV_DIV = 4.4, STAT_K = 0.004, STAT_K0 = 30;
pointCost(N, s) = round( tierXp(toTier(N)) / LV_DIV × (1 + STAT_K × max(0, s − STAT_K0)) )
// N = current level (buying N → N+1), s = the stat's value before the point; tierXp = today's xpNeed, real-valued argument
```

| step N→N+1 | 1 | 2 | 10 | 20 | 50 | 77 | 100 | 150 | 181 | 199 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| base cost (s ≤ 30) | 74 | 97 | 438 | 1,206 | 9,206 | 40,324 | 132,911 | 514,121 | 827,216 | 1,039,966 |

A stat at 60 costs ×1.12, at 99 ×1.28. Cumulative XP to reach a level (measured, build shares from B.7):

| new level | 10 | 37 | 77 | 97 | 157 | 181 | 197 | 200 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| typical (45/30/25 %) | 1.9k | 50k | 676k | 2.14M | 23.4M | 42.0M | 59.0M | 62.5M |
| dump (50/50) | 1.9k | 50k | 687k | 2.21M | 25.1M | 45.8M | 62.3M | 65.4M |
| even spread | 1.9k | 50k | 671k | 2.09M | 21.8M | 38.7M | 53.7M | 56.9M |
| old, at old level L = (N+3)/4 | — | 48k (10) | 673k (20) | 2.12M (25) | 23.0M (40) | 41.0M (46) | 56.8M (50) | — |

Time to reach (model, one player at band): Lv.25 ≈ 14 min · 37 ≈ 26 min · 57 ≈ 1 h · 77 ≈ 1.8 h · 97 ≈ 3.2 h · 117 ≈
5.4 h · 157 ≈ 11 h · 181 ≈ 15 h · 197 ≈ 17.5 h · 200 ≈ 18.5 h. Early levels come every minute or two (DS feel), late
ones every ~40 min.

### B.3 Soft caps

```js
eff(s) = min(s,40) + 0.5·clamp(s−40, 0, 20) + 0.25·max(0, s−60)     // eff(40)=40, eff(60)=50, eff(99)=59.75
```
Every stat effect below reads `eff`, never the raw value.

### B.4 Derived stats (`stats(p)`; constants in one table `SFX` so tuning is data-only)

| derived | formula | caps / notes |
| --- | --- | --- |
| max HP | `70 + 2.5·lv + 13·eff(WIL) + gear.hp` | |
| max MP | `30 + 0.6·lv + 6·eff(WIS) + 2·eff(INT) + gear.mp` | book base `mp` unchanged |
| defence | `round(0.12·lv + 0.25·eff(WIL)) + gear.def` | |
| attack | `(3 + 0.1·lv + Σ coef(w,k)·eff(k) + W·(1 + 0.01·wm[w]) + gear.atk_nonweapon) × (1 + atkp/100)` | `W` = equipped weapon's base atk incl. enhancement; coef from B.5 |
| damage type | sword/dagger/spear/bow **physical**: mob def × 0.5 subtracted (today); staff/book and dark/elemental skills **magic**: mob def × 0.25 | `WKIND[w].mag` |
| crit % | `5 + WKIND[w].crit + 0.3·eff(LUK) + weapon enh + gear.crit` | ≤ 75 (today's cap) |
| crit damage | `1.5 + 0.008·eff(LUK) + gear.critd/100` | |
| attack speed | `acd = WKIND[w].cd × (1 − min(0.30, 0.005·eff(DEX)))` (× 0.85 legendary haste) | DEX 60 ≈ cap |
| evasion % | `min(20, 0.3·eff(DEX))` — dodges a direct monster blow or shot in `mobHit`; never telegraphs, pools, bursts, DoTs | event `["h", eid, 0, 3, 1]` "회피" |
| sneak / far | dagger hit on a monster not targeting you, bow hit from ≥ 90 px: `× (1 + 0.004·eff(DEX))` | "ranged/assassination power" |
| cooldown reduction | `min(0.25, 0.004·eff(WIS))` on every skill cd | |
| MP regen | today's `3 %/s` (+fire) `+ 0.04 %·eff(WIS)` of max MP per second | |
| elemental burst | reaction damage (`REACT` mult) × `(1 + 0.008·eff(INT))` | |
| item find | `mf += min(25, 0.4·eff(LUK))` | gear mf on top |
| proc chance | legendary `chain` 25 %, `echo` 20 %, bleed, etc. × `(1 + 0.01·eff(LUK))` | |
| knockback resist | `kbr = min(0.8, 0.015·eff(STR))` | new player stagger (below) |
| poise | `poise = min(0.8, 0.015·eff(WIL))` | |
| status resist | `res = min(0.5, 0.01·eff(WIL))`: burn/poison/slow duration and DoT damage × (1 − res) | in `afflict` |
| move speed | unchanged (gear `spd`, buffs) | |

**Player stagger (new, small).** A monster `charge`/`leap`/`slam`/`fan` hit, or any blow of an elite (`el ≥ 1`) or boss,
pushes the player `14·(1 − kbr)` px (only onto `canStand` ground) and staggers for `300·(1 − poise)` ms
(`p.stag = now + ms`): `atk`/`sk` are refused with the quiet reason `"stag"` (the client drops quiet reasons without a
toast) and the client plays a 2-frame flinch. Lives in `hurtPlayer`/`mobHit` only (not `hurtMob`/`tickMob`).

### B.5 Weapon scaling (grades → coefficients)

`GRADE = { S: 1.0, A: 0.85, B: 0.7, C: 0.5, D: 0.3 }`

| weapon | STR 힘 | WIL 의지 | DEX 민첩 | INT 지능 | WIS 지혜 | LUK 행운 | type |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sword 대검 | A | C | | | | | phys |
| dagger 단검 | | | A | | | C | phys |
| spear 창 | A | | | | C | | phys |
| staff 스태프 | | | | A | C | | magic |
| book 마도서 | | C | | A | | | magic |
| bow 활 | | | A | | | C | phys |

- **Single job**: its weapon gets +0.1 on both coefficients (A 0.95, C 0.6). Other weapons stay at the table.
- **Hybrid** (applies to *both* weapons of the pair, replaces the table for them):

| hybrid | coefficients |
| --- | --- |
| 마검사 sword+staff | STR 0.8, INT 0.8, WIL 0.3, WIS 0.3 |
| 추적자 dagger+bow | DEX 0.8, LUK 0.8 |
| 용기사 spear+book | STR 0.7, WIL 0.7, INT 0.7, WIS 0.3 |
| 주술암살자 dagger+book | DEX 0.8, INT 0.8, LUK 0.3, WIL 0.3 |
| 폭풍기수 spear+bow | STR 0.8, DEX 0.8, WIS 0.3, LUK 0.3 |
| 암흑기사 sword+book | WIL 0.8, STR 0.8, INT 0.3 |

### B.6 Accuracy and grazes

A blow on a monster **grazes** (×0.5, never crits, grey number: `["h", id, dmg, 2, 0]`) with chance
`graze% = clamp(10 + 3·max(0, ceil(tier(mob) − toTier(lvl))) + (boss ? 10 : 0) − wm[w], 0, 60)`.
A fresh weapon grazes 9 % of level-appropriate blows and none from mastery 10; fighting 5 tiers (≈ 20 levels) above
grazes 25 % − mastery. This is the "+1 accuracy per mastery level" and a soft brake on diving too deep.

### B.7 Typical builds (measured with B.3–B.5; no gear, `atkCore` = attack before weapon/gear)

| Lv | build | stats str/wil/dex/int/wis/luk | atkCore | HP | MP | def | crit | aspd | eva | cdr |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 | 대검전사 | 22/19/7/5/7/9 | 39 | 417 | 106 | 10 | 8 % | 4 % | 2 % | 3 % |
| 40 | 도적 | 7/11/22/5/7/17 | 38 | 313 | 106 | 8 | 10 % | 11 % | 7 % | 3 % |
| 40 | 마법사 | 5/13/5/22/17/7 | 38 | 339 | 200 | 8 | 7 % | 3 % | 2 % | 7 % |
| 100 | 대검전사 | 49/40/10/5/10/15 | 79 | 840 | 160 | 22 | 10 % | 5 % | 3 % | 4 % |
| 100 | 도적 | 10/20/49/5/10/35 | 76 | 580 | 160 | 17 | 16 % | 22 % | 13 % | 4 % |
| 100 | 마법사 | 5/25/5/49/35/10 | 76 | 645 | 389 | 18 | 8 % | 3 % | 2 % | 14 % |
| 100 | 마검사 | 40/20/5/39/10/15 | 85 | 580 | 228 | 17 | 10 % | 3 % | 2 % | 4 % |
| 200 | 대검전사 | 94/75/15/5/15/25 | 111 | 1269 | 250 | 37 | 13 % | 8 % | 5 % | 6 % |
| 200 | 도적 | 15/35/94/5/15/65 | 109 | 1025 | 250 | 33 | 20 % | 29 % | 18 % | 6 % |
| 200 | 마법사 | 5/45/5/94/65/15 | 109 | 1123 | 575 | 35 | 10 % | 3 % | 2 % | 21 % |
| 200 | 마검사 | 75/35/5/74/15/25 | 124 | 1025 | 347 | 33 | 13 % | 3 % | 2 % | 6 % |
| 200 | 모험가 sword, STR dump | 99/14/44/14/14/44 | 81 | 752 | 262 | 28 | 18 % | 21 % | 13 % | 6 % |

Parity check (measured): the 모험가 A/C build at level 4L−3 has 0.9–1.07× the old class-average attack
(`9 + 2.3L`) for every L from 1 to 50; the single-job build has 0.9–1.15× from L 15 up (−10 % at L 46–50, made up by
mastery's +50 % on the weapon's own attack ≈ +13 % total). HP of a WIL-secondary build is within ±10 % of the old
warrior/lancer, a DEX/INT build ≈ old rogue/mage + 10–35 %. The dump build loses ≈ 27 % attack and 40 % HP: soft caps
work.

### B.8 World mapping (what converts, what does not)

| call site | rule |
| --- | --- |
| `MOBS[k].lv`, `GEN band`, `MAP_META.band`, `FIELD_BOSS`, chests, `tierFor`, `goldK`, `ATK_EASE`, `resp`, gear chance, `rollGear` ilvl, quest `XP_K` | **unchanged (tier)** |
| `defs().mobs[k].lv`, door labels (`mapPayload` band), `blameOf` "Lv.", death window `lv`, rift name "차원 균열 Lv.N", collection | `shownLv(tier)` |
| gear `req` (`G_REQ`) | new scale: `[1, 29, 61, 101, 149]` (= `shownLv(old)`) |
| `near` bounty choice (60 L60), `bq` take (70 L345) | `MOBS[k].lv <= toTier(lvl) + 2`, `d.lv > toTier(lvl) + 4` |
| dailies/bonus/event XP (60 L81–86, L276) | `tierXp(min(toTier(lvl), 49)) × same factor` (identical XP to today for the mapped level) |
| `deathLoss` | `floor(min(ch.xp, 4·pointCost(lvl, 30)) × 0.03)` (≈ old: 3 % of up to one old level) |
| `ACH lv10 lv30 lv50` (ids persisted) | predicates `lvl ≥ 40 / 120 / 200`, texts "레벨 40/120/200 달성" (holders keep them) |
| editor side quest `req.lv`, `62-side-quests` clamp | player level, clamp to 200; `data/quests.json` values ×4−3 once (J1) |
| editor map `band` (`36` clamp `MAXLV`) | tier, clamp to `TIER_MAX = 50` |
| rift (scale-and-rift D.2/D.6) | party level → `toTier(max lvl)` clamped [10, 49]; reward `0.5·tierXp(tier)`; counter `ch.cnt.dim` (B.11) |
| sys broadcast every 10 levels | at 50/100/150/200 |
| rank rows, lobby summary | `lvl` is the new level; rows written before J1 (no `v`) shown as `4·lvl−3` |

### B.9 Economy notes

- Faucets unchanged (XP per kill, gold, drops). The only new sinks: `pointCost` (replaces `trainCost` + `skillCost`
  XP) and respec. Gold sink lost: skill training gold (`skillCost` up to ≈ 150k per skill) → keep the gold sink by
  making **job change cost 5,000 G** (single) / **20,000 G** (hybrid), and 망각의 의식 respec free of gold.
- Loot: a weapon drop picks its kind 50 % = the looter's equipped kind, 50 % uniform over the six (no more class
  filter); bows enter every table automatically. Legendary powers and the 균열 추적자 set (`types` includes `weapon`)
  roll on bows with no table change.
- Shop: the `"W1"` key is replaced by all six tier-1 weapons (`w_warrior_1 w_rogue_1 w_lancer_1 w_mage_1 w_book_1
  w_bow_1`); `resolveItem` keeps mapping `W<n>` to the equipped kind for old clients.

### B.10 Weapon mastery

```js
const WK_ORDER = ["sword", "dagger", "spear", "staff", "book", "bow"], WM_MAX = 50;
wmNeed(m) = 22 · m²        // XP from m to m+1: 22, 88, … 2,200 (10), 7,942 (19), 52,822 (49); Σ to 10 = 6.3k, to 20 = 54k, to 50 = 889k
```
Gain (always to the kind in hand at that moment; `gainWm(S, p, n)` in `45-jobs.js`, called from 3 hooks):
- **hit**: +1 per action (basic attack or skill) that damaged ≥ 1 monster whose tier ≥ `toTier(lvl) − 8`; skills +2.
  Chests and `still` monsters never count.
- **kill**: each player in `mob.by` (the hitters, not idle party members) gets `(1 + floor(tier/2)) × [1, 4, 10][el]`,
  bosses ×20.
- Level-up: event `["wm", eid, kindIndex, lv]`, toast "[대검] 숙련 10! 새 스킬 [대지 가르기] · 패시브 [거검의 관성]",
  at 20: "[대검] 숙련 20! 전직관 아르센에게 가면 [대검전사]로 전직할 수 있습니다." `qsLearn` for new actives.
- Expected (model): mastery 10 ≈ 20 min, 20 ≈ 2 h (≈ Lv.77), 50 ≈ 15 h (≈ Lv.181) using one weapon; a hybrid needs two
  weapons at 20 ≈ 4 h.
- Effects: weapon attack +1 %/lv (B.4), accuracy (B.6), skill growth `mult × (1 + 0.012·(wm − need))` (hybrid
  signature: the lower of the two), unlocks (C.1).

### B.11 Migration (sheet v11 — housing took v10; idempotent; detects old by `typeof ch.cls === "string" && !ch.job`, not by `v`)

| old | new |
| --- | --- |
| `cls` | removed. Template, main weapon, job: warrior → sword, shares STR .45 WIL .35 DEX .05 WIS .05 LUK .10, 대검전사 · rogue → dagger, DEX .45 LUK .30 WIL .15 STR .05 WIS .05, 도적 · lancer (and old ranger/archer) → spear, STR .40 WIS .25 WIL .25 DEX .10, 창술사 · mage → **book** if the equipped weapon is `w_book_*` (INT .45 WIL .30 WIS .20 LUK .05, 마도사) else staff (INT .45 WIS .30 WIL .20 LUK .05, 마법사) |
| `lvl` L | `lvl = min(197, 4L − 3)`; points allocated one by one to the stat furthest below its share (cap 99, deterministic); `xpt` = Σ `pointCost` along that path |
| `xp` (progress in the old level) | kept as unspent `xp` |
| `tr {str vit int grd}` | refunded: `xp += Σ_{i<n} (120 + 40i)` per stat; field removed |
| `skl[6]` | refunded: XP and gold of every level bought (`skillCost` sums) to `xp`/`gold`; field removed |
| — | `wm[main] = {lv: min(50, L), xp: 0}`; mage's other kind (staff↔book) `lv = max(1, floor(0.6L))`; rest `lv 1` |
| — | `job` = the template's single job if `L ≥ 20`, else `"adventurer"`; `rs = 1` (one free reset); `sw = 1` (no starter pick) |
| `st` (achievement counters) | moved to `cnt` (every key of `CNT_KEYS`, formerly `ST_KEYS`, incl. `dim` if Phase 2 added it) |
| `eq` | gets `weapon2: null`; the old "weapon of another class → replaced" line is **deleted**; nothing is ever dropped |
| `qs` | `["s", i]` entries → `null` (J2 fills unlocked actives via `qsLearn`); items untouched |
| `v` | `11` (Phase 0 took 9, housing (bag + house) took 10; the jobs step runs for any sheet with `cls` and no `job`, whatever its `v`) |

Every new sheet field gets a default in `newChar` and is clamped in `migrate` for v11 sheets too (`st` 5..99 ints,
`lvl` recomputed, `wm` 6 kinds `lv 1..50`, `xp ≥ 0`, `job ∈ JOBS ∪ {adventurer}`, a job whose weapon mastery is < 20
stays (never revoked)).

---------------------------------------------------------------------------------------------------------------

## C. Skills

### C.1 Data model and gating

```js
SKILL[id] = { id, name, kind: "a"|"p"|"j"|"h", wk?: "sword"…, job?: "swordsman"…, need: 1|10|20,
              mp, cd, mult, …params, mag?: 1, el?: "f"|"i"|"l", noAuto?: 1, desc }   // 03-skills.js
SKILL_ORDER = [ per weapon: L1, L10 active, L10 passive ] × 6, then 6 single, then 6 hybrid (= 36 entries)
```
- **Weapon skill** (`a`/`p` with `wk`): usable when the equipped weapon is `wk` and `wm[wk].lv ≥ need`. Passives apply
  automatically under the same condition.
- **Job signature** (`j`): `ch.job === sk.job` and the job weapon in hand. **Hybrid signature** (`h`): `ch.job` is that
  hybrid and either weapon of the pair in hand. A hybrid's two passives are both on whenever either weapon is in hand.
- Action `{t:"sk", id, a}` (string id). Errors: "[대검]을 들어야 쓸 수 있습니다", "[대검] 숙련 10에 배웁니다",
  "[대검전사]의 스킬입니다", "재사용 대기 중입니다", "MP가 부족합니다", quiet `"stag"`.
- Cooldowns `p.cds = {id: until}`; cd × (1 − CDR). Unlocked list for the wire: `skillsFor(ch)` (all kinds whose
  `need` is met, signatures of the job), usable flag per the hand.

### C.2 Weapon skills (mult = × attack; r/len in px; ms)

| weapon | id · name | numbers | effect | fx | reuse |
| --- | --- | --- | --- | --- | --- |
| sword L1 | `slash` 파워 슬래쉬 | mp 8, cd 5000, mult 1.8, r 44, arc 75° | crescent cleave in front; stagger: normal 600 ms, elite 360, knock 14 | 80 | basic cleave code |
| sword L10 | `rend` 대지 가르기 | mp 14, cd 9000, leap 60 (wall-safe `reach`), land r 36 ×1.6, then wave line len 120 half 14 ×1.2 | leap slam then straight shockwave | 81, 82 | `pole` leap, `mobsInLine` |
| sword P10 | `inertia` 거검의 관성 | stacks 0–5: +1 per sword hit, lost 2500 ms after the last hit | per stack +6 % reach, +8 % crit damage | 110 (stack) | grit bar art (max 5) |
| dagger L1 | `ambush` 암습 | mp 7, cd 6000, range 110 cone, mult 1.6 | blink 16 px behind the aimed target and stab; sure crit if it was not targeting you, else +30 % crit chance | 84 | `swap` teleport |
| dagger L10 | `shade` 그림자 칼날 | mp 12, cd 8000, 3 blades ±15°, len 120, ×1.1 each, +1 mark per hit | fan throw | 85 | `coin` throw, `addMarks` |
| dagger P10 | `vitals` 급소 도려내기 | basic stabs leave 1 mark (max 5, 10 s, +4 % crit per mark); hitting a marked monster → bleed 0.12·atk/s 4 s (refresh) and +20 % move speed 2 s | | 111 (bleed) | marks, `venom` dot |
| spear L1 | `spiral` 나선 찌르기 | mp 8, cd 5000, line len 110 half 12, ×1.7, pierces all; the far 28 % counts as a tip | | 87 | `hook`/`javelin` line |
| spear L10 | `comet` 유성창 | mp 14, cd 10000, dash 130 along aim, monsters within 20 px of the path are dragged to the end, ×1.4, stun 500 | | 88 | `hundred` dash + `pullTo` |
| spear P10 | `tip` 창끝의 거리 | blow landing at ≥ 72 % of reach: ×1.5 and ignores 35 % of def | | `"tip"` event (exists) | `TIP` |
| staff L1 | `fireball` 파이어볼 | mp 9, cd 4000, el f, aimed, r 30, ×1.8, burn ground 3 s 0.15/0.5 s | | 70 | `ember` (as is) |
| staff L10 | `frostring` 서리 고리 | mp 13, cd 8000, el i, r 56, ×1.3, slow; slowed → frozen 1 s; push 18 | | 71 | `frost` (+push) |
| staff P10 | `reso` 마력 공명 | every 3rd staff skill → the next staff skill costs 0 MP and deals +30 %; reactions (`REACT`) between fire/ice/lightning stay | | 113 (ready) | weave orb UI, 3 pips |
| book L1 | `soulbolt` 영혼 화살 | mp 8, cd 3500, mag, target in 150/60°, travel 350 px/s (queued hit), ×1.6, heals 6 % of damage | homing dark bolt | 91 | `bolt` hit path |
| book L10 | `gravity` 중력 왜곡진 | mp 15, cd 11000, mag, circle r 60 at 70 ahead, 4 s: every 500 ms pull 6 px to centre + ×0.3 | prop `grav` | 92 | `roar` pull, prop tick |
| book P10 | `brand` 금서의 낙인 | book skill hits brand 6 s: the monster takes +15 % from everyone | `mob.brand` like `vuln` | 114 | `vuln` |
| bow L1 | `pierce` 관통 화살 | mp 7, cd 4500, arrow 600 px/s, len 180 half 8, ×1.6, pierces all | | 94 | shots (D.2) |
| bow L10 | `leapshot` 도약 사격 | mp 13, cd 9000, backstep 60 (`reach`), then 5 arrows ±30° len 150 ×1.0 (≤ 2 per target) | | 95 | `rewind`-style move + shots |
| bow P10 | `hawk` 매의 시야 | bow hit × (1 + 0.25·clamp((d − 40)/110, 0, 1)), d = distance from the firing spot | | 115 (far hit tint) | — |

### C.3 Single jobs (need: mastery 20 in the weapon, from 모험가, at 전직관; 5,000 G)

| job id · name | weapon | signature (`j`) | numbers | fx |
| --- | --- | --- | --- | --- |
| `swordsman` 대검전사 | sword | `verdict` 단죄의 일격 | mp 30, cd 30000, spin r 70, ×2.4 × (1 + min(0.9, missing HP fraction)), knock 20 | 83 |
| `thief` 도적 | dagger | `flurry` 무영난무 | mp 36, cd 36000, 7 slashes every 220 ms on monsters within 90 of you (marked first), ×1.6 + 0.3/mark, untouchable during (`p.ghost`) | 86 (dance renderer) |
| `lancer` 창술사 | spear | `dragon` 뇌룡승천 | mp 34, cd 32000, pillar at 80 ahead r 64: pull 20 inward, 3 hits ×0.9 over 1.2 s, final ×1.6 + stun 1500 (elite 600), el l | 89 |
| `wizard` 마법사 | staff | `meteor` 메테오 스톰 | mp 42, cd 40000, area at 120 ahead r 80: 6 meteors over 2.4 s (r 30, ×1.1, el f), each chains lightning to 1 more (×0.5, el l) → reactions | 90 (+70/73) |
| `warlock` 마도사 | book | `pact` 심연의 계약 | mp 40, cd 38000, phantom beast prop at aim 6 s: bites nearest every 600 ms ×0.8; at the end curse blast r 80 ×2.2 (+25 % if branded), mag | 93 |
| `archer` 궁수 | bow | `rain` 화살비 | mp 34, cd 30000, area r 70 at 110 ahead, 3 s: every 300 ms ×0.45 to all inside + slow | 96 |

### C.4 Hybrid jobs (need: stay 모험가, two weapons of the pair ≥ 20; 20,000 G)

| job id · name | pair | signature (`h`) | numbers | fx |
| --- | --- | --- | --- | --- |
| `spellblade` 마검사 | sword+staff | `crimson` 원소 마검: 홍련참 | mp 40, cd 34000, blade wave len 160 half 20 ×2.0 el f, every hit also takes el l → 과부하 (`REACT.fl`) explosions, INT burst applies | 97 |
| `tracker` 추적자 | dagger+bow | `traps` 사방의 그림자 덫 | mp 38, cd 36000, stealth 3 s (`hide`, +40 % speed), backstep 40, 4 traps at 45 around (8 s): a trap that is touched roots 1.5 s and a clone bursts out: 3 stabs ×0.6 + 2 point-blank shots ×0.8 | 98 |
| `dragoon` 용기사 | spear+book | `dive` 심연의 강림 (드래곤 다이브) | mp 44, cd 40000, untouchable 0.8 s leap to 120 ahead, landing wave r 110 ×2.4 mag, then draining field r 70 4 s: ×0.25 per 500 ms, heals 30 % of damage | 99 |
| `hexblade` 주술암살자 | dagger+book | `bloodburst` 혈흔 폭발 | mp 36, cd 30000, r 100: root 1.2 s, then each takes **fixed** dark damage `atk × (0.6 + 0.5·bleeding + 0.4·marks + 0.6·branded)` ignoring def; clears them | 100 |
| `stormrider` 폭풍기수 | spear+bow | `thunder` 천뢰의 투창 | mp 38, cd 32000, javelin line len 200 half 12 ×2.2 el l, pierced monsters dragged to the end; magnetic storm r 60 3 s ×0.3 per 400 ms + slow | 101 |
| `darkknight` 암흑기사 | sword+book | `sanctuary` 불멸의 성역 | mp 20 + 20 % of current HP, cd 45000, blood sanctuary r 90 for 8 s around you: party inside −25 % damage taken; monsters inside take ×0.2/s, half of it heals the lowest-HP member inside; `noAuto` below 60 % HP | 102 |

Hybrids also get: `weapon2` slot and **swap** `{t:"wsw"}` (Tab; cd 800 ms; not while dead/fishing; a swap keeps both
weapons' gauges), both passives on, dual scaling (B.5). Non-hybrids change weapons with normal `eq` from the bag.

### C.5 fx codes (frozen list; arguments as today's `ev(code, x, y, extra)`)

| code | meaning | code | meaning |
| --- | --- | --- | --- |
| 6 | bow basic (pose; arrow is `ar`, D.2) | 91–93 | soulbolt, gravity, pact |
| 80–83 | slash, rend leap, rend wave, verdict | 94–96 | pierce, leapshot, rain |
| 84–86 | ambush, shade, flurry | 97–102 | crimson, traps, dive, bloodburst, thunder, sanctuary |
| 87–89 | spiral, comet, dragon | 110–115 | passives: inertia stack, bleed, (tip uses `"tip"`), resonance ready, brand, hawk far hit |
| 70, 71, 73 | reused: fireball, frostring, chain lightning | 90 | meteor impact |

Retired after J2 lands: 40–48, 50–55, 60–65, 72, 74, 75 (client handlers deleted in the same J2 change; 55's dance
renderer is reused for 86). Props: `grav`, `phantom`, `rainzone`, `storm`, `sanct`, `trap`, `meteor` in `rt.props`
(existing prop wire).

### C.6 Quick slots, auto-hunt, swapping

- `qs` holds `["s", id]`; `qsOk` accepts any id in `SKILL` with kind `a|j|h` (a skill not yet unlocked is still allowed
  so the bar survives weapon changes). On unlock (`wm` level-up, job change) `qsLearn(ch, id)` fills the first empty slot.
- Client: a slot whose skill is not usable now is drawn dim with a 8×8 weapon badge; pressing it toasts the server's
  reason locally ("[대검]을 들어야 쓸 수 있습니다").
- Auto-hunt casts, in quick-slot order, skills with `usable && !noAuto && mp ≥ cost + 4`, never swaps weapons, keeps
  `0.8·range` distance (bow: 120 px).

### C.7 What happens to the class gauges

Decision: **keep the four mechanics, re-home them on weapons, add two.** They are the best-loved, already-tested parts
of combat; class lock was the only problem. `crView(p)` reads the hand (and, for hybrids, both weapons):
`{k:"inertia", v:0..5}` sword · `{k:"mark", v: marks on aimed target, bleed}` dagger · `{k:"tip", tip:px}` spear ·
`{k:"reso", v:0..3, e: weave element}` staff · `{k:"brand", v: branded nearby}` book · `{k:"hawk"}` bow (no number);
`null` while the passive is locked. `classgauge.js` becomes `weapongauge.js` (same art, two new glyphs). Retired: grit's
"burst" economy, 투지 butt, focus empowerment (`emp`), venom stacks, coin, teapot heal (the party heal role moves to
암흑기사's sanctuary and pact/dive drains).

---------------------------------------------------------------------------------------------------------------

## D. Bow

### D.1 Weapon kinds after the rebalance (atk is class-free now, so per-hit mults follow old class atk ratios)

| kind | name | cd | range | mult | crit | other | mag |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sword | 대검 | 920 | 34 | 1.45 | 3 | cleave 3, kb 9, arc 65 | |
| dagger | 단검 | 520 | 26 | 1.10 | 10 | kb 4, arc 35 | |
| spear | 창 | 780 | 54 | 1.40 | 5 | line 3, kb 7, arc 25 | |
| staff | 스태프 | 980 | 100 | 1.25 | 3 | kb 6, arc 40 | 1 |
| book | 마도서 | 800 | 84 | 1.05 | 3 | splash 26, kb 4, arc 40 | 1 |
| **bow** | **활** | **760** | **150** | **0.90** | **6** | `shot: {spd: 420, r: 6}`, kb 3, arc 20; finisher (3rd of a combo) ×1.4 and pierces 1 | |

Items: `WEAPON_NAMES.bow = ["나무 짧은활", "사냥꾼의 장궁", "기사단 전투활", "카본 컴파운드 보우", "균열의 시위"]`,
`WK_ID.bow = "bow"` → `w_bow_1..5`, base atk `W_ATK`, price `G_PRICE`, req `G_REQ` (new scale). Thorns ignore bows (range
≥ 60, as today). `WK_CLASS` and `ITEMS[…].cls` are deleted.

### D.2 Arrows: server projectiles with travel time

Decision: **simulated**, not instant — dodgeable, wall-blocked, and the only honest way to measure 매의 시야 distance.
```js
rt.shots = [{ id, pid, x, y, ux, uy, spd, left, r, pierce, hit: [mobIds], mult, kind, x0, y0 }]   // max 6 live per player
```
- Fire: aimed monster inside `arc` and `range` → direction to it, else along `AIM_V[p.aim]`; spawn at `(x, y−6)`.
- Step in `tick` (part of `57-weapon-skills.js weaponTick` for J2; J1 adds the minimal stepper in `45-jobs.js`):
  segment of `spd·dt` (42 px per 100 ms tick), first monsters with distance to the segment ≤ `r + big(mob)` take
  `hurtMob(S, rt, mob, p, mult × hawk(dist(x0,y0,mob)))`; stops after `pierce + 1` hits, at `left ≤ 0`, at a `solidAt`
  tile (`canFly` false). Crit and graze are rolled at impact.
- Wire: fire `["a", eid, 6, tx, ty, dir, combo]` + `["ar", id, x0, y0, round(ux·1000), round(uy·1000), spd, kind]`;
  end `["ae", id, x, y, stuck]` (stuck = hit a wall). Client draws the arrow locally from `ar` (no per-tick traffic).
- A shooter who dies or changes map leaves no shots behind (removed in `fall`/`changeMap`).

### D.3 Art and sound (J3)

`weapons.js DESIGNS.bow` 5 tiers (wood self-bow · leather-gripped longbow · knight's recurve with steel tips · neon
carbon compound with cams · rift bow with floating limbs and a violet string) + legendary/set looks + `weaponIcon`;
`assetKey` already supports `weapon.bow.t<n>`. `swing.js STROKES.bow`: nock 0–30 %, draw 30–75 % (string to the cheek,
bow raised), release 75–100 % (string snaps, 1-px recoil); held in the front hand in `sprites.js`. Arrow: code-drawn
9×3 px, 16 directions, steel head, red fletch; tier trail tint (T4 cyan, T5 violet). Sounds `bow_draw`, `bow_shot`
(twang: tone 220→110 + short noise), `arrow_hit` (thunk), `arrow_wall`. Previews: `_swing.html`, `_icons.html`.
Pixel-art rules: `.claude/skills/pixel-art/rules/`.

---------------------------------------------------------------------------------------------------------------

## E. NPCs and UI flows (Korean text is final)

- **Creation** (`lobby.js`): name + look tabs only; one line under the preview: "모든 모험가는 직업 없이 시작합니다.
  무기를 쓰며 숙련을 쌓고, 숙련 20에 전직하세요." `room.ts` ignores `cls`; `protocol.ts` makes it optional.
- **Starter weapon**: new characters start with `w_rogue_1` (낡은 단검) in hand and `sw: 0`. 수련관 카이's talk window
  shows "어떤 무기로 시작하겠나? 하나를 골라 가게." with six buttons (icon, "대검 — 힘·의지", one-line feel). Action
  `{t:"starter", wk}` once (`sw = 1`), item into the bag, toast "[녹슨 대검]을 받았습니다." Tutorial step `equip`
  keeps its id/index, hint becomes "수련관 카이에게 무기를 하나 받아 C 창에서 장착하세요."; a step `level`
  ("모닥불에서 레벨 올리기": "모닥불 곁에서 C 창 → 능력치에서 한 칸 올려 보세요.") is **appended** (indices persisted).
- **Stat panel** (C window, new tab "능력치"): header "Lv.37 모험가 · 보유 경험치 12,480"; six rows: glyph, 힘/의지/
  민첩/지능/지혜/행운, value, pending `+n`, [−][+], one-line effect ("물리 공격 · 밀림 저항 — 대검·창"); footer "다음
  1포인트 438 · 합계 2,190" [확정] [되돌리기]; derived list (공격력, HP, MP, 방어, 치명타, 치명 피해, 공격 속도,
  회피, 재사용 감소, 상태 저항, 강인도, 밀림 저항, 원소 폭발, 아이템 발견). Away from a fire the buttons are disabled
  with "모닥불 곁이나 수련관 앞에서 레벨을 올릴 수 있습니다." Cost preview from `defs().lvc` + `statK` (the only
  rule the client mirrors; the server re-checks). XP bar in the HUD shows unspent XP against the cheapest next point
  and glows when a point is affordable.
- **무기 · 스킬 window** (K, replaces the old skill/training window): six rows: weapon icon, "대검 숙련 17/50", bar,
  scaling letters ("힘 A · 의지 C", job/hybrid-adjusted), skill chips at 1 / 10 / 10P / 20 (locked: grey "숙련 10");
  the hand is highlighted. Right panel "전직의 길": 모험가 in the centre, six single jobs around ("대검 숙련 20" ✓/✗),
  six hybrid links between weapon pairs ("대검 20 + 스태프 20"); the current job lit, others dimmed with "이미 전직한
  몸입니다" after a change. GBA brass frames from `frames.js`.
- **전직관 아르센** (`role: "job"`, in `data/npcs.json` on `town` next to 수련관 카이, tile chosen by J1 with
  `freeTile`; `NPC_ROLES` += `"job"`): talk lists eligible jobs with cost; choosing one opens "[대검전사]로 전직합니다.
  전직은 되돌릴 수 없습니다. 계속할까요? (5,000G)" [전직] [취소] → `{t:"job_change", j}`. Errors: "모험가만 전직할 수
  있습니다", "[대검] 숙련 20이 필요합니다", "[대검]과 [스태프] 숙련이 모두 20이어야 합니다", "골드가 부족합니다",
  "전직관이 너무 멉니다". Success: `sys` "OOO님이 [대검전사]의 길을 걷기 시작했습니다!", event `["jc", eid]`,
  achievements `job1` "첫 전직" and `job2` "두 갈래 길" (hybrid), signature into a quick slot.
- **Hybrid HUD**: a small second-weapon icon beside the quick bar with "Tab"; sound `swap`.
- **Party/guild/who/rank** show job names (`defs().jobs[id].name`, alias old class ids: warrior→대검전사 …).

---------------------------------------------------------------------------------------------------------------

## F. Wire, sheet, tests, implementation plan

### F.1 Sheet v11 (housing took v10) (only these changes)

`+ job, xpt, st{6}, wm{6×{lv,xp}}, rs, sw, cnt{…}, eq.weapon2` · `− cls, tr, skl` · `qs ["s", id]` (J2; J1 nulls
skill entries) · `lvl` recomputed · `v: 11`. Tests in `content.mjs` (every old class at L 1/19/20/35/50, staff vs book
mage, trained stats, skill levels, an old ranger, a mismatched-class weapon, a v9 sheet, run twice = same).

### F.2 Wire (positional, appended; client decoder updated in the same change)

- `self`: `job, lvl, xp, xpt, st:{…}, nx:[6 next-point costs, 0 when capped], rs, sw, wm:[[lv,xp,need]×6 in WK_ORDER],
  wk, wk2, cnt` (was `st`), derived `dv:[atkType(0/1), eva, aspd, cdr, res, poise, kbr, burst, mfS, grazeBase]`;
  removed `tr trc skl skc need cls`. J2: `sk:[[id, mpNow, cdLeftMs, usable01]…]` replaces `skm`/`cds`; `cr` per C.7.
- `who[2]`, `party[2]`, `gmates[2]`: the job id (was class id); `who` appends `wk2` at the end (hybrid back weapon).
- `defs()`: `jobs {id: {name, kind:"single"|"hybrid", wk:[…], scale:{stat:coef}, cost}}`, `stats [[key, name, desc]]`,
  `scale {wk:{stat:"A"…}}`, `lvc` (200 base costs) + `statK [0.004, 30]`, `wmNeed` (50), `maxLv 200`, `mobs[k].lv`
  shown; `classes` removed; J2: `skills` = `SKILL` + `SKILL_ORDER`.
- Events: `["wm", eid, kindIdx, lv]`, `["jc", eid]`, `["ar", …]`, `["ae", …]`, graze `["h", id, dmg, 2, 0]`, evade
  `["h", eid, 0, 3, 1]`, stagger `["sg", eid]`, fx 6/80–115.
- Actions: `train {a}`, `respec`, `starter {wk}`, `job_change {j}`, `wsw`, `sk {id, a}` (J2).
- Vault: rank row `{name, cls: job, lvl, xp: xpt, v: 2}` (sort unchanged), summary `m:<pid>` `cls` = job; readers map
  rows without `v` with `lvl → 4·lvl − 3` and old class ids through the alias table (rule 9: no key changes).

### F.3 Tests

| file | owner | covers |
| --- | --- | --- |
| `tests/jobs.mjs` (new, in `tests/LIST`) | J1 | `newChar` shape; `pointCost` golden values (B.2) and monotonicity; `train` (place, XP, 99, 200, batch order, `lvl` invariant, full heal); `respec` free/paid; `eff` caps; derived stats golden rows (B.7, ±1); `gainXp` never levels; mastery: hit/kill gains go to the hand only, idle party member gets none, `22m²`, cap 50, `wm` event; graze/evasion/stagger (seeded); `job_change`: adventurer only, near NPC, gold, single ≥ 20, exactly the 6 pairs (sword+spear refused), irreversible; `starter` once; `wsw` hybrid-only; world mapping (`shownLv`, door label, `bq` threshold, daily XP = old for the mapped level); bow: arrow lands after ≥ 2 ticks, arc, range, wall stops it, finisher pierces, hawk bonus, no thorns |
| `content.mjs`, `loot.mjs`, `growth.mjs`, `hotbar.mjs`, `accounts.mjs`, `party/hard/sim/aim/world/life/wardrobe/daynight/data` | J1 | migration (F.1); drops of any kind/no class lock; `sklv`/old `train` cases gone (growth tests rewritten for stat investment, warehouse/pets unchanged); rank/summary conversion; every `newChar(name, cls)` → `hero(name, {job, lvl, st, wm, wk})` (exported test helper, like `devPlace`) |
| `tests/skills.mjs` (rewritten) | J2 | every one of the 36 `SKILL` entries castable/active with its fx code; gating messages; passives (inertia stacks/decay, bleed+speed, tip def ignore, resonance free every 3rd, brand +15 %, hawk); signatures need job+hand; hybrid both passives and swap; `qsLearn` on unlock; auto-hunt flags |
| `tests/balance.mjs` (new) | J1 baseline, J2 asserts | probe: a template hero (B.7 shares, band-tier plain gear) fights the band's monsters for 120 s simulated at Lv 20/50/100/157: kills/min, damage taken/min, deaths. J1's **first commit** runs the probe script on pre-J1 `main` with old classes at L = 5/13/25/40 and stores those numbers as constants; J2 asserts new values within ±25 % per weapon kind (bow within −25 %/+10 %) |

### F.4 Phases and file ownership

Starting point (origin/main 81876aa): Phase 0 lazy maps and cells have landed (chunked bake and the sheet v9 bump
next); the game-feel upgrade (swing.js, scene2d.js, skillfx.js, audio.js, hitstun in `hurtMob`/`tickMob`) has landed,
so "after game-feel" below is already satisfied — rebase on it, do not undo its hitstun; later Phase 1 (maps) and
Phase 2 (rift). Jobs work never edits
generators, `MAP_META`, cells, `setup/runtime/changeMap`, `buildTown`, or `tickMob`.

**J1 — rules core** (one agent; after Phase 0's sheet bump merges; `50-loot-combat.js` hunks rebased after game-feel).
- New parts: `02-jobs-stats.js` (tables: `STATS`, `GRADE`, `SCALE`, `JOBS`, `HYBRIDS`, `SFX`, `LV_DIV STAT_K STAT_K0
  WM_MAX WK_ORDER TIER_MAX`, bow names) and `45-jobs.js` (functions: `eff pointCost batchCost toTier shownLv tierXp
  deriveStats scaleOf gainWm grazeChance evadeOrStagger jobOk hybridOf migrateV10 allocate hero` + minimal arrow
  stepper). `00-header.js`: `MAXLV 200`, `WKIND` (D.1). `10-tables.js`: weapon loop (no `cls`), `G_REQ`, `SHOP`, drop
  `TRAIN/trainCost/skillCost/levelled` **only after** the legacy bridge below. `20-helpers`: `tierXp` (+ `xpNeed` alias).
  `40-characters-world.js`: `newChar`, `migrate` (calls `migrateV10`), `stats` → `deriveStats`, `armOf/weaponKind`,
  `SLOTS` + `weapon2`, `CNT_KEYS`. `50-loot-combat.js`: `gainXp`, `lootFor` kinds, `deathLoss`, 3 one-line hooks in
  `hurtMob` (graze, magic def, `gainWm`), `killMob` mastery loop, `hurtPlayer` evade/stagger, `basicAttack` bow branch.
  `60-content.js`: ACH predicates/new `job1 job2`, dailies/event XP, `rewardGear`, `TUT` append, `cnt`. `70/75`: rework
  `train`, delete `sklv`, **append** `respec starter job_change wsw` at the end of the switch. `90-views-api.js`
  (self/defs/who). `36-custom-maps.js` `NPC_ROLES`, `62-side-quests.js` clamp, `data/npcs.json` (전직관),
  `data/quests.json` req levels, `room.ts`/`protocol.ts`/`accounts.js` (+ `.d.ts`). Client "keep it running" only:
  `client.js` (`onSnap` renames, `cnt`, job names, `nx`), `lobby.js` (no class cards, job names, old-row levels),
  `growth.js` (remove skill training), a plain stat-invest list in the C window (J3 restyles), cache tag.
- **Legacy bridge** so every merge is green: until J2, `legacyCls(ch)` = class of the hand (sword warrior, dagger
  rogue, spear lancer, staff/book mage, bow none) drives the old `SKILLS`, gauges and `castSkill`; an old skill is
  usable when `wm[hand].lv ≥ sk.lv`; `skl` is treated as all 1.
- Frozen by J1 for J2/J3: sheet v11, `self`/`defs`/`who` fields above, actions `train respec starter job_change wsw`,
  `deriveStats(p).arm` + `st.mag`, `gainWm(S,p,n)`, `toTier/shownLv/tierXp`, `rt.shots` record and `ar/ae` events,
  `JOBS`/`SCALE` ids.

**J1 as built** (what differs from or adds to the plan above; these are the contracts J2/J3 build on):
- Wire: `ar` is `["ar", id, x0, y0, ux·1000, uy·1000, spd, kind, shooterEid]` (shooter appended for the bow art;
  `kind` 0 plain, 1 finisher, 2+ skill); `ae` is `["ae", id, x, y, how]` with `how` 0 struck, 1 stuck in a wall, 2 out
  of range (or its shooter fell / left: arrows of an absent shooter end on that map's next tick, so `changeMap` and
  `fall` are untouched). The arrow flies 6 px above the ground (`y0 = p.y − 6`), walls are `solidAt` at its foot.
  Swap event `["ws", eid]`. Quiet refusals `"stag"` and `"wsw"` (swap cooldown); the client drops both.
- `self` also carries the bridge field `lc` (the old class of the hand, "" for the bow / bare hands) until J2; the
  client sets `self.cls = self.job` and `self.skLv` (mastery of the hand) for its old code paths. `self.crit` is
  rounded to 0.1. `dv` is exactly the F.2 list. `defs()` also has `mobs[k].tier` (the world tier next to the shown `lv`),
  `wkOrder wkName jobWm grade legacyCls wswMs`; `jobs[id].scale` is the effective table (single: +0.1 applied).
- `deriveStats(p)` is the cached sheet part (`p.stc`): `mhp mmp atk0 core def crit critd ls spd0 xp gold mf lg arm wk mag
  acd aspd eva sneak cdr mpReg burst proc kbr poise res`; `stats(p)` adds buffs and passes those through.
  `evadeOrStagger` became `evadeBlow(S, rt, p)` + `staggerPlayer(S, rt, p, mob)`, called from `mobHit(…, how)`:
  `"blow"`/`"shot"` (volleys) can be evaded; `"charge"`, `"tele"` (leap/slam/fan landing) or any elite/boss blow stagger.
  Mastery per action: `newAct(p, skill)` in `basicAttack`/`castSkill`, `wmHit` in `hurtMob` (arrows carry their action).
  Bare hands fight as the job's weapon, else a dagger, and teach no mastery.
- Sheet version: housing (bag 40→100, a house) landed first as v10, so jobs and stats are **v11**. `migrate` runs the
  jobs step (`migrateV10`, named for the plan) first for any sheet with a `cls` and no `job` — v9 or a v10 housing sheet —
  then housing's `bagClean`/`houseClean`, then sets `v = 11`; both old-sheet tests (content, housing) pass.
- Migration: the old `["s", i]` quick-slot entries are cleared and, until J2, the old kit's skills the old level had
  learned are put back (J2 replaces them). Rank rows `accounts.js rankRow`, old rows read with `fromOldRow`
  (`JOB_ALIAS`); lobby summaries for v11 sheets carry `v: 2`. `newChar(name, look)` still accepts `(name, cls, look)`.
  Test/probe helper `hero(name, {wk, lvl, st, wm, job, wk2, migrate})` (exported, like `devPlace`).
- Content: TUT step 8 `level` (50 G); the town's two hard-coded signposts show the new levels; `data/quests.json`
  `sq_willow_frogs` asks Lv.5 (was 2); 전직관 아르센 stands at town (26, 12).
- Client (keep-running only): stat list, starter pick, respec and job list live in the trainer window (also opened by
  아르센 and by a button in the C window, usable by a campfire); weapon mastery list in K; "보조 무기로" in the bag and a
  hidden `#eq-weapon2` slot for hybrids; Tab swaps; HUD EXP bar = unspent XP vs the cheapest next point.
- Balance probe (`tests/balance.mjs`, baseline from e14fb5e): sword/dagger/spear/staff/book land at ×0.9–1.5 of the
  old class's kills/min (strongest at T40, where mastery 40 and the single job add up), the bow ×0.56–0.70 (no skills
  until J2, and the probe does not kite). J2 owns the ±25 % / −25…+10 % asserts.

**J2 — skills** (after J1 and after the game-feel upgrade merges, since it edits `skillfx.js`/`audio.js`).
New `03-skills.js` (`SKILL`, `SKILL_ORDER`, fx constants) and `57-weapon-skills.js` (`castSkill` by id, passives,
props, shots, `weaponTick`, `crView`, `flagsOf`); moves `pullTo reach weave popDecoy danceStep` from 55 and **deletes
`55-class-skills.js`**, `SKILLS`, `CLASSES`, `legacyCls`, grit/focus/venom/coin code. Edits: `50 basicAttack` passive
hooks, `80-simulation` `classTick` → `weaponTick` (one line), `70/75` `sk`/`qs` cases, `40 qsOk/qsLearn`, `90`
`sk`/`cr`. Client glue in the same change: `client.js` (`castSkill(id)`, auto-hunt), `quickslots.js`, `skillfx.js`
(cases 6, 80–115; delete retired), `skillicons.js` (24 glyphs + 6 passive glyphs), `audio.js` SFX (one per active +
`bow_*`, `swap`), `classgauge.js` → `weapongauge.js`. Contracts: `SKILL` ids/kinds, `sk` wire, `cr` shape, fx codes.

**J3 — client UI and art** (art may start at once on `wk:"bow"` in parallel; merge after game-feel because of
`swing.js`/`scene2d.js`). `weapons.js` bow designs, `swing.js` bow stroke, `sprites.js` held bow, arrow sprite/trails in
`skillfx.js`/`scene2d.js` (draw list from `ar/ae`), `art.js` icons, `index.html` (C "능력치" tab, K "무기 · 스킬" with
전직의 길 tree, job NPC dialog, hybrid swap HUD), `client.js render*`, `hud.css`, `lobby.js`/`lobby.css` creation,
previews `_swing.html _icons.html`, `README.md` rows, AGENTS.md file map (new parts and `weapongauge.js`), cache tag.

Conflict map: `70/75` — Phase 2 and J1 both append cases at the end (keep both); `10-tables.js` — each appends its own
block; `50-loot-combat.js` — J1 rebases on game-feel, touches `hurtMob` with one-line hooks only; `90-views-api.js` —
Phase 2 appends `dim/rc`, J1 edits `self`/`defs` fields (rebuild, never hand-merge `logic.js`). Phase 2 must use
`toTier`/`tierXp` and `ch.cnt` once J1 has merged (before: `ch.lvl`/`xpNeed`/`ch.st` and J1 converts them in its
rebase).

---------------------------------------------------------------------------------------------------------------

## G. Open questions for the owner (implementers use the default unless told otherwise)

1. **Where can points be spent?** Default: within reach of any campfire (a map's fire or a placed 모닥불 kit) or at
   수련관 카이; the panel can be read anywhere.
2. **Death penalty.** Default: keep today's gentle loss (3 % of unspent XP, capped near one old level), no Dark-Souls
   bloodstain that drops all unspent XP.
3. **Shown levels.** Default: monsters, doors and gear requirements are shown on the 1–200 scale (`4·tier − 3`, e.g.
   단풍 왕도 Lv.157–181) so player and monster levels compare directly.
4. **Job permanence.** Default: a job is permanent; a single-job character can never become a hybrid; stat resets
   (first free, then 10 % of spent XP) never touch jobs or mastery.
5. **Job fees and the starter pick.** Default: 5,000 G single / 20,000 G hybrid (replaces the retired skill-training
   gold sink); every new 모험가 picks one free tier-1 weapon from 수련관 카이 and starts holding a 낡은 단검.
