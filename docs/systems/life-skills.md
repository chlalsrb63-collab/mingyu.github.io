# Life skills (L1 built; L2 and the co-op jobs next)

Purpose: six non-combat skills (낚시 fish, 요리 cook, 채집 gather, 제작 craft, 연금 alch, 배달 deliver), levels 1–50 on one
curve, separate from combat level and weapon mastery. They pay in goods (graded fish, dishes, later materials), not stats.
Design: `docs/design/life-and-coop.md` B (rules), H ("L1 as built": the deviations). Tables `12-life-tables.js`, code `58-life.js`.
Only 낚시 and 요리 do anything yet; the other four are sheet fields and "곧 열립니다" in the window.

## Key files / functions (`game/src/logic/`)
| symbol (file) | role |
| --- | --- |
| `LIFE LIFE_NAME LIFE_MAX` 50 (12) | skill keys in wire order (`self.life`, sheet `life`), Korean names |
| `lifeNeed(L)` = `10L²+40` (12) | XP from L to L+1 (50 at 1, 1,040 at 10, 24,050 at 49) |
| `GRADE_LV` [1,10,20,30,40], `GRADE_TIER` [1,8,14,24,40], `RXP` [8,14,22,34,50], `LIFE_STALE_D/LIFE_STALE` 20/.25, `LIFE_UNLOCK` (12) | material grade g unlocks at a life level; a map's grade comes from its band; XP per action by grade; work 20+ levels below you pays ×.25 |
| `lifeGrade(L)`, `gradeOfMap(m)`, `mapGradeOf(id)` (58) | highest grade a level handles; a map's grade = editor map `"grade"` (1–5) else its band's first tier (meadow/willow 1, forest/crypt 2, city/sewer 3, cave/abyss 4, maple 5); `mapGradeOf` avoids building hunting grounds |
| `lifeOdds(L, unlockLv, s, extra)`, `lifeRoll(S,…)` (58) | the bonus formula, `d=max(0,L−unlock)`: success `min(100, 60+1.2d)` %, 대성공 `min(60, 3+1.2d)` %, mini-game score `s` shifts both by `(s−50)·0.2` %p (`LIFE_ROLL`); a 대성공 is always a success |
| `lifeTime(L)` (58) | time factor `1−0.008·L` (×0.6 at 50) for bite waits and, later, channels |
| `lifeAdd(e,n,cap)` (58) | pure: add XP to `{lv,xp}`, level up repeatedly, returns levels reached (migrate uses it without a player) |
| `gainLife(S,p,k,n)`, `lifeXp(L,unlock,base)` (58) | player gain: event `["lv2",eid,skillIdx,lv]`, Korean toast (grade unlock lines at 10/20/30/40/50), `p.dirty` |
| `fishLand(S,p,score)`, `fishKeep`, `fishWait`, `FISHING`, `FISH_G` (58/12) | catch: candidates = fish of grade ≤ min(map grade, angler grade). Order: 황금 잉어 `0.01+0.07k²+0.001L` (any grade) → top `0.1+0.3k` (cap≥2) → next `0.2` (cap≥3) → stone `0.04` → lowest; `k=score/100`. 대성공 = 2 fish (never stones), XP `RXP[g]·(0.5+k)` ×1.5. A fight below `30−0.3L` lets it go |
| `RECIPES`, `COOKING`, `fishRecipe`, `cookBurnt`, `cookDish` (12/58) | every fish is cookable at any level (action `cook {id,s}`); burnt below `35−0.4·max(0,L−r.lv)` (floor 10) gives nothing; two portions on 대성공 or pan score ≥ 85; dish ladder one per grade (`food_s/m/c/v/l`, Lv 1/10/20/30/40) |
| `LMAT` (`m_h1…m_w5`, type `lmat`), `POUCH_MAX` 999, `pouchOk`, `JB` (empty), `COOP_KINDS` (12) | materials exist as items; gathering, pouch use, 알바 board and co-op jobs are not wired yet |
| `lifeSheetClean(ch)`, `lifeFresh`, `lifeClean` (58) | sheet v12 fields `life jobBoard rep coopDay coopDone pouch`; `migrate` runs it last; pre-L1 sheets get 낚시 `ch.fish×8` and 요리 `cnt.cook×10` XP, capped at Lv 20; idempotent |
| `lifeView(ch)`, `lifeDefs()` (58) | wire (below) |

## Data shapes
- Sheet: `life {fish:{lv,xp}, cook, gather, craft, alch, deliver}`, plus the empty-for-now `jobBoard {day,done[],active}`, `rep {npc:0–100}`, `coopDay`, `coopDone[]`, `pouch {id:n}`. Never bump `v` for L2/C1 fields (already in v12).
- `self.life` = `[[lv, xp, need|0 at cap] × 6]` in `LIFE` order, sent when dirty. `defs().life` = `{keys names max need grades gradeName rxp stale roll unlock fish fishing cooking recipes mats mapGrade}`. Event `["lv2", eid, skillIdx, lv]`.

## Flow
Fishing/cooking minigames run client-side (`minigames.js`) and report a score: `hook`/`reel` → `fishLand` → `gainLife("fish")`; `cook` → `cookDish` → `gainLife("cook")`. Raw `rnd(S)` only (deterministic rules).

## Client
`game/public/life.js`: 생활 window `#w-life` (Shift+L; `L` stays quests; menu button, `life` sprout glyph): level, XP bar, grade handled, 대성공/time bonus (`greatAt`), next unlock, water grade where you stand; `OPEN` = [true,true,false×4]. Level-up sound reuses `achieve`. NPC roles `cook craft alch jobs` are talk-only ("곧 문을 엽니다", `npctalk.js`).

## What L2 and C1–C3 add (not built; `docs/design/life-and-coop.md`)
L2: gathering nodes B.4, stations and the full recipe table B.6 with the economy guard B.7, delivery B.8, the solo 알바 board and NPC trust B.9 (fills `JB`, `rep`, `jobBoard`), the 재료 주머니 B.10, life actions B.11, wire additions B.12 (`jb rep pouch nodes ng`), and the NPC field `coop` plumbing. C1–C3: co-op part-time jobs in town buildings C.1, instance lifecycle C.2 (reuses `S.homes`/rift machinery), shared engine `66-coop.js` C.3, jobs C.4–C.6, daily rewards C.7, anti-exploit C.8, template maps C.9, wire C.10, client C.11.

## Invariants / gotchas
- Never trust sheet numbers: `lifeClean` clamps `lv` 1..50, `0 ≤ xp < lifeNeed(lv)`; a parcel is never saved (a mid-delivery sheet resets to "pick up").
- The meadow is grade 1, so it no longer gives trout; `tests/life.mjs` was adjusted. Golden values live in `tests/lifeskills.mjs`; edit numbers in the table, then update them.
- Korean player text only; fish grade 3/4 (`fish_c`, `fish_v`) have campfire dishes `food_c`, `food_v`.

## Tests
`lifeskills.mjs` (curve, levelling, B.2 formula, map grades, catch shares, cooking, materials, NPC roles, wire) · `life.mjs` (fires, fishing, cooking, guilds) · `content.mjs` (old-sheet rows v9–v12, messy v12, idempotence).
