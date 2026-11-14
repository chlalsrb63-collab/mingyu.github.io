# Loot, items and the gold economy

Purpose: where items/gear come from, how they are rolled, stored, priced, and where gold enters and
leaves. Skills/jobs (J2), life skills and housing internals are being rewritten: only their gold hooks are listed.

## Key files / functions
| symbol (file in `game/src/logic/`) | role |
| --- | --- |
| `ITEMS` (10) | every item `{name,type,price,…}`; types `pot food fish scroll buff camp revive pet mat rune furn` + gear. Gear ids `w_<kind>_<tier>` (`WK_ID`: sword→`warrior`, dagger→`rogue`, spear→`lancer`, staff→`mage`, book, bow) and `<pre>_<tier>` from `GEAR` (h a g b r n). `ITEMS` is extended by loops for runes (`ru_*`), `FURN` (`fn_*`) |
| `GEAR`, `W_ATK`, `G_REQ`, `G_PRICE` (10) | tier 1–5 names/stats/level req (1,29,61,101,149 on the 1–200 scale)/price |
| `RUNES`, `RUNEWORDS`, `AFFIX`, `RARITY`, `RARITY_AFFIX`, `LEGEND`, `SETS` (10) | rarity 0 일반 /1 마법 /2 희귀 /3 전설(one `lg` power) /4 세트(`set`); affixes per rarity `[[0,0],[1,2],[3,4],[4,4],[2,3]]` |
| `rollGear(S,id,q,ilvl)`, `rollRarity(S,rank,mf)`, `setFor`, `tierFor(lv)` (50) | affix pick (value = min..max + grow·ilvl, ×1.3 at q≥3), legend pick, sockets `sk` (≤3; gloves/boots ≤1; non-jewels), q4 falls back to q3 when the base has no set |
| `lootFor(S,rt,mob,p)` (50) | per looter: gold, gear tries, rune, 강화석 `stone`, potions → `rt.drops` (own `pid`, `freeAt` +20 s, `dieAt` +60 s) |
| `pickUp`, `canAdd/addItem/takeItem`, `fits`, `bagFull`, `stackInto`, `whRoom` (50) | bag ops; stacks `STACK`=99; gear never stacks |
| `bagCap`, `sortSlots`, `bagClean`, `bagValidate/Apply` (46-bag.js) | bag 40 (`INV_BASE`) →100 (`INV_MAX`), +`BAG_STEP` 5 per `bag_expand` |
| `sellPrice`, `junk` (50) | non-gear `price×0.4`; gear `price×0.05×(1+0.8q)×(1+0.3enh)`; `junk` = q0, enh0, no runes ("sell all") |
| `enhCost` (70), `ENH_RATE` (10) | enhancement; `gearBonus` (40) applies `+10 %` of base per `enh`, affixes, runes, runeword, set bonuses, legend |
| `goodsNear(p)`, `SHOP` (70/10) | shop NPC (role `shop`, within 56 px) sells `n.goods \|\| SHOP`; `W1`-style key resolves to the hand's weapon kind (`resolveItem`) |
| `case buy/sell/sellall/enh/salv/rune/wh/bag_expand` (70-validate, 75-apply) | the actions |

## Data shapes
- Gear piece: `{id, q, enh, af:[[stat,value]…], sk, ru:[runeKey|null…], lg?, set?}`; stack `{id,n}`. `ch.inv` (len ≤ `bagCap`), `ch.eq` slots (`weapon helm armor gloves boots ring1 ring2 amulet weapon2`), `ch.wh={items,gold}` (`WH`=60 slots, unlimited gold).
- Drop (on map): `{id, it, g, n, q, x, y, own, freeAt, dieAt}`; wire `D` (see wire page).
- `lootFor` details: gold = `ri(mob.gold)×[1,3,12][el]×goldK(lv)×(1+gold%)×(lucky 2)×(rift `DIM.lootGold`)` ÷ party size; `goldK(lv)=1−0.7·clamp((lv−8)/28)`. Gear try chance: boss/chest 1, elite 0.35, normal `d.gear`, each × `(1+mf/100)`; tries boss 4 / 3 for el 2 / else 1. Type weights `DROP_TYPES` (weapon 24, helm 13, armor 15, gloves 13, boots 13, ring 13, amulet 9); tier `tierFor(mob.lv)` (+1 for ranked 25 %); weapon kind = looter's own 50 %. `rollRarity` top (leg/set) `[.012,.07,.2][rank]×(1+mf)`, rare `[.09,.3,.55]`, magic .36; legend 60 / set 40 of top. Rune `(0.02+lv·0.001)×GEAR_CUT(0.3)` normal, 0.25 elite, 1 boss; 강화석 similar; potions 10 %/7 %. `MOB_ATK`, `GEAR_CUT` live in 10-tables.
- Enhancement `enh` 0→10: costs `60×tier×(enh+1)` gold + stones 1/2/3 (by enh <3/<6/else); success `ENH_RATE`=[100,95,90,80,70,55,45,35,25,15]; fail at enh ≥5 drops one level; jewellery cannot be enhanced; needs 대장장이 (`smith` NPC). `salv` breaks gear into 강화석: `[0|1,1,2,5,5][q] + ⌊enh/2⌋`.
- Runes: `rune` action sockets one into `ch.eq[k].ru[i]` (slot must be < `sk`); `runeword(g)` when `ru` equals a `RUNEWORDS.seq` of length `sk` (6 words, adds stats). Sets: bonus at piece counts in `SETS[id].bonus`.

## Gold faucets → sinks (table/constant)
- Faucets: monster gold (`MOBS[k].gold`, `lootFor`) · `sell`/`sellall` (`sellPrice`) · quests `QUESTS[].gold` (`quest`) and editor `SIDE` rewards (62-side-quests) · bounty `bq` (`BOUNTY_N`=25; pays ≈ avg mob gold×need×0.8) · dailies/achievements `payout` (60) · rift fail consolation `DIM.failGold×lv`, chest/loot `DIM.*` (64-dim, see rift page) · fishing items sold · `gold%` from affix/title/`greed` legend (+60 %).
- Sinks: `buy` (`ITEMS[id].price×n`) · enhancement (gold + stones) · `bag_expand` (`BAG_COST`: 500…55 000, twelve steps, total 202 500; `bagCost(cap)`) · house `HOUSE_TIER` 10 000 / 40 000 / 120 000 and `FURN` prices (64-housing) · `job_change` (`JOBS[j].cost`, 5 000 / 20 000) · look change `LOOK_COST` 500 · `cos_buy` (`COSMETICS[].price`, 65-cosmetics) · guild `GUILD_COST` 1 000 · old skill upgrades (being replaced by J2). 망각의 의식 `respec` costs XP (10 % of `xpt`, first free), not gold. Warehouse is free.
- XP is a separate currency (`ch.xp`, spent on stat points via `train`); not covered here.

## Flow (a kill to an item)
1. `killMob` (50) → for each ally in range `lootFor` → `rt.drops`; client sees `D` entries.
2. `pickUp` when a player stands on it (own for 20 s, then anyone, gone at 60 s); pets fetch via `petCheck` and `ch.opt.filter` (`FILTER_Q`).
3. Gear equips with `eq` (`slotsFor`, level `G_REQ`), `afterGear` recomputes stats; sockets via `rune`; `enh` at the smith; surplus → `salv` / `sell` / `wh put`.

## Invariants / gotchas
- All randomness via `rnd(S)`/`ri(S,…)` (deterministic rule); never `Math.random`.
- New item: `ITEMS` entry; shop? add to `SHOP` (or an NPC `goods`); drop? `lootFor`; icon in `public/art.js buildIcons`; quick-slot types `QS_USE`. Removing an id needs `OLD_ID`/`fix` mapping in `migrate`.
- Every bag-space check must go through `bagCap(ch)`/`canAdd`, never `INV_BASE`.
- Prices of gear come from `GEAR cost × G_PRICE[tier]`; changing tiers shifts sell values and `lootFor` tier bands.
- `balance.mjs` pins economy/time-to-level assumptions; bag/house price comments in 10-tables document the intended curve.

## Tests
`loot.mjs` (gear, rarities, repeat hunting) · `growth.mjs` (warehouse, pets, scrolls) · `housing.mjs` (bag expansion, house prices) · `wardrobe.mjs`/`cosmetics.mjs` (cos_buy) · `balance.mjs` · `content.mjs` (old sheets, quests/dailies payouts) · `party.mjs` (shared gold/loot).
