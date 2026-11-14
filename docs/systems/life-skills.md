# Life skills (L1 built; L2 rules built, L2 client and the co-op jobs next)

Purpose: six non-combat skills (낚시 fish, 요리 cook, 채집 gather, 제작 craft, 연금 alch, 배달 deliver), levels 1–50 on one
curve, separate from combat level and weapon mastery. They pay in goods (graded fish, dishes, materials, potions, stones,
gear), not stats. Design: `docs/design/life-and-coop.md` B (rules), H ("L1 as built"), **H2 ("L2 rules as built": the
wire and action contract for the client)**. Tables `12-life-tables.js`, code `58-life.js`.
The server runs all six; the client (`public/life.js`) still shows only 낚시/요리 as open until the L2 client lands.

## Key files / functions (`game/src/logic/`)
| symbol (file) | role |
| --- | --- |
| `LIFE LIFE_NAME LIFE_MAX` 50 (12) | skill keys in wire order (`self.life`, sheet `life`), Korean names |
| `lifeNeed(L)` = `10L²+40` (12) | XP from L to L+1 (50 at 1, 1,040 at 10, 24,050 at 49) |
| `GRADE_LV` [1,10,20,30,40], `GRADE_TIER` [1,8,14,24,40], `RXP` [8,14,22,34,50], `LIFE_STALE_D/LIFE_STALE` 20/.25, `LIFE_UNLOCK` (12) | material grade g unlocks at a life level; a map's grade comes from its band; XP per action by grade; work 20+ levels below you pays ×.25 |
| `lifeGrade(L)`, `gradeOfMap(m)`, `mapGradeOf(id)` (58) | highest grade a level handles; a map's grade = editor map `"grade"` (1–5) else its band's first tier (meadow/willow 1, forest/crypt 2, city/sewer 3, cave/abyss 4, maple 5) |
| `lifeOdds(L, unlockLv, s, extra)`, `lifeRoll(S,…)` (58) | the bonus formula, `d=max(0,L−unlock)`: success `min(100, 60+1.2d)` %, 대성공 `min(60, 3+1.2d)` %, score `s` shifts both by `(s−50)·0.2` %p, `extra` adds to the 대성공 (a gathering tap, 쥬쥬's stove); a 대성공 is always a success |
| `lifeTime(L)` (58) | time factor `1−0.008·L` (×0.6 at 50) for bite waits, gathering channels, minimum craft times |
| `lifeAdd` / `gainLife(S,p,k,n)`, `lifeXp` (58) | levelling (event `["lv2",eid,skillIdx,lv]`, toasts, then `checkAch`) |
| `fishLand`, `cookDish`, `FISHING`, `FISH_G`, `COOKING` (58/12) | L1 fishing and campfire cooking (unchanged; see H) |
| `NODE NODE_W NODE_KINDS`, **`lifeNodes(m)`** (12/58) | gathering nodes `[kind 0..2, grade, tx, ty]` per hunting map, seeded by the map id, memoised on `m.nodes`; 1 per 150 open tiles (8–60), ≥ 6 apart, ≥ 3 from doors/signs/stones/NPCs/fires, hidden pockets ×2 |
| `gatDone gatStop nodeReady nodesSpent` (58) | a 2.4 s × time channel (`p.gat`), the "반짝!" tap (+15 %p), 1 material (2 on 대성공), 4 % bonus item, XP `RXP[g]`, per-player cooldown `p.ng = {map: {idx: readyAt}}` (5 min, runtime only) |
| **`RECIPES`** (84), `MG`, `CRAFT`, `GEAR_CRAFT`, `ENH_BLESS` (12) | `{sk, lv, at, in, out, fee, mg, ms, any?, rep?, eq?, gear?}`; stations fire/cook/craft/alch; batch at L ≥ lv+20 (≤ 10, s = 70); gear tier 2–5 at Lv 12/22/32/42, 마법..희귀 |
| `stationNear recipeWhy craftWhy` **`craftOnce`** (58) | station = a fire (or the stove) / an NPC or thing of role `cook craft alch`; inputs from bag + pouch; fee only on success; a failure gives ⌊n/2⌋ of each input back and half XP |
| `pouchHas pouchRoom pouchTake` (58) + `countItem canAdd addItem takeItem` (50) | the 재료 주머니: `pouchOk` items (lmat incl. ingots, staple, flask) go there first (999 each), the bag's share is taken first |
| **`JB`** (32), `JB_PAY`, `JB_ROUTES` (12); `jbOffers jbOffersOf jbEnsure jbRoute jbLimit jbGold jbPay jbFail` (58) | the 알바 board: 4 offers a day seeded by `name:day:jb`, 3 done a day, one active; bring/make/fish/deliver; parcel `p.parcel` (never saved), deadline from the walked path, carrier speed via `parcelSpd` in `deriveStats` (45) |
| `REP_TIER REP_PERK REP_DISC REP_TIP`, `addRep repOf buyCost` (12/58) | trust 0–100 from finished 알바 only: 10 단골 (−5 % at their counter, +10 % 알바 gold), 30 친구 (a recipe / elixirs +5 min / stove +10 %p), 60 가족 (title, ACH `rep_<id>`) |
| `lifeUse lifeUseValidate lifeUseApply` (58) | elixirs `el_*` (scroll buffs, longer), `punch` (+1 socket to the slot cap), `whet` (reroll the weakest affix) |
| **`lifeValidate` / `lifeApply`** (58), 70/75 | actions `gat gat_tap craft_open craft jb`; plus `enh {b:1}`, `sell {pid}`, `wh {a:"put", pid}`, `buy` discount |
| **`lifeTick(S,p,now)`** (58, called from 80 `tick`) | channel tap/finish/interrupt, parcel timeout or death, node cooldowns expire, the board turns at 06:00 KST |
| `lifeSheetClean`, `lifeFresh` (58) | sheet v12 fields `life jobBoard rep coopDay coopDone pouch` cleaned by `migrate`; a mid-delivery sheet loads as "pick up" |
| `lifeView jbView repView lifeSnap lifeDefs` (58), `mapPayload` (34) | wire, below |

## Data shapes and wire (full contract: life-and-coop.md H2)
- Sheet: `life {k: {lv, xp}}`, `jobBoard {day, done[], active {id, npc, prog, expAt} | null}`, `rep {npcId: n}`, `pouch {id: n}`, `cnt.gat/craft/deliver`. No bump: v12.
- `map.nodes [[kind, grade, tx, ty]…]`; snapshot `ng [idx…]` (own spent nodes, on change); self `life`, `jb [day, offers[[id,kind,npcName,text,gold,skIdx]], done, active [id,prog,n,secsLeft] | 0]`, `rep [[id,n]]`, `pouch {}`.
- Events: `lv2`, `gs` (gather start), `gt` (tap now), `ga` (gather end: 0/1/−1), `mk` (mini-game open), `mo` (craft result), `dl` (parcel 1 / handed in 2 / lost 0).
- `defs().life`: L1 keys + `nodes mg craft bless gearCraft jb jbPay rep pouch master`, `recipes` (84 rows).

## Flow
Gather: `gat {i}` → channel → `gt` → `gat_tap` → `lifeTick` → `gatDone`. Craft: talk to the station → `craft_open {r}` → `mk` → client mini-game → `craft {r, s}` (or `craft {r, n}` batch) → `craftOnce`. Board: 포포 `jb take` → gather/make/fish then `jb give` at the NPC, or `jb pick` at the sender → walk → `jb give` at the recipient. Raw `rnd(S)` only.

## NPCs (data/maps)
캉캉 `kangkang` (craft, 캉캉대장간), 보글 `bogle` (alch) + `bogle_shelf` (flask), `juju_stove` 쥬쥬의 화덕 (cook thing) + 쥬쥬 sells `staple`, 포포 `popo` (jobs, 넥서스 마을회관).

## Invariants / gotchas
- Never trust sheet numbers: `lifeClean` clamps; a parcel is never saved; `rep` keys must be static NPC ids (unknown dropped).
- The economy guard (B.7) is a test: inputs at sell value + fee ≥ 60 % of any shop price the output (or its `eq` scrolls) has, and no non-gear recipe sells for more than its inputs + fee. Change a price or a fee → run `lifeskills`.
- `lifeNodes` costs 5–10 ms on a map's first payload; nodes come from the map id, so a map change in the generator moves them (tests compare with a fresh build).
- Korean player text only. No new cosmetics yet (Lv 50 and 가족 give titles); they need wardrobe art.

## Tests
`lifeskills.mjs` (L1 + L2: nodes, gathering, pouch, crafting, gear rarity, blessed stones, punch/whet/elixirs, economy guard, the board, delivery, trust, ACH; `-v` prints fish shares, nodes, the guard table) · `life.mjs` · `content.mjs` (old-sheet rows).
