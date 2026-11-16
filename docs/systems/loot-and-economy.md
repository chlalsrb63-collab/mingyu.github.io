# Loot, items and the gold economy

Purpose: where items/gear come from, how they are rolled, stored, priced, and where gold enters and
leaves. Skills/jobs (J2), life skills and housing internals are being rewritten: only their gold hooks are listed.

## Key files / functions
| symbol (file in `game/src/logic/`) | role |
| --- | --- |
| `ITEMS` (10) | every item `{name,type,price,…}`; types `pot food fish scroll buff camp revive pet mat rune furn` + gear. Gear ids `w_<kind>_<tier>` (`WK_ID`: sword→`warrior`, dagger→`rogue`, spear→`lancer`, staff→`mage`, book, bow) and `<pre>_<tier>` from `GEAR` (h a g b r n). `ITEMS` is extended by loops for runes (`ru_*`), `FURN` (`fn_*`) |
| `GEAR`, `W_ATK`, `G_REQ`, `G_PRICE` (10) | tier 1–5 names/stats/level req (1,29,61,101,149 on the 1–200 scale)/price |
| `RUNES`, `RUNEWORDS`, `AFFIX`, `RARITY`, `RARITY_AFFIX`, `LEGEND`, `SETS` (10) | rarity 0 일반 /1 마법 /2 희귀 /3 전설(one `lg` power) /4 세트(`set`) /5 유니크 (`lg` + stronger lines); ordinary lines per rarity `RARITY_AFFIX` = `[[0,0],[2,2],[3,3],[4,4],[2,3],[4,4]]` at `AFFIX_MUL` = `[1,0.85,1,1.3,1.3,1.45]`. Rarities are told apart only by the NUMBER of lines; only an item with a strong separate effect (`lg`, the 고유 효과) gets a name prefix, a plain stat line needs no prefix or suffix. **유니크 (owner 2026-11-16, simplified)** = a 전설's power + stronger lines: one of the 8 `LEGEND` powers rolled like a 전설's (same code path: `gearBonus` → `stats(p).lg`), named `[LEGEND word of lg] item` like a 전설 (beige colour + 유니크 label tell them apart), 4 ordinary random lines ×1.45 — about +12 % over a 전설's 4 (measured 1.120 in `itemlevel.mjs`, band 1.10–1.15). No suffix, no `un`, no `defs.uniq`, no "own" lines (every line re-rolls with the whetstone); sockets/skill bonus/price/salvage/announcement/첫 전설 follow q ≥ 3 like a 전설. Sheets: a q5 keeps its lines and `il`, `un` is dropped; the first shape `un:[prefix,suffix]` with no `lg` loads with the power `UNIQ_OLD_LG[prefix]`; a q5 with no power to keep or derive demotes to 희귀. The 마법/희귀 names still use their first affix's word (`희귀 잔혹한 …`) as before |
| `rollGear(S,id,q,ilvl,rank)`, `rollRarity(S,rank,mf)`, `setFor`, `tierFor(lv)` (50) | stamps `il` (item level = `shownLv(ilvl)` + `IL_RANK[rank]` [0,4,8], ≥ the base tier's `G_REQ`, ≤200); affix pick (`rollLine`: value = (min..max + grow·ilvl) × `AFFIX_MUL[q]`), legend pick, sockets `sk` (≤3; gloves/boots ≤1; non-jewels), q4 falls back to q3 when the base has no set |
| `lootFor(S,rt,mob,p)` (50) | per looter: gold, gear tries, rune, 강화석 `stone`, potions → `rt.drops` (own `pid`, `freeAt` +20 s, `dieAt` +60 s) |
| `pickUp`, `canAdd/addItem/takeItem`, `fits`, `bagFull`, `stackInto`, `whRoom` (50) | bag ops; stacks `STACK`=99; gear never stacks |
| `bagCap`, `sortSlots`, `bagClean`, `bagValidate/Apply` (46-bag.js) | bag 40 (`INV_BASE`) →100 (`INV_MAX`), +`BAG_STEP` 5 per `bag_expand` |
| `sellPrice`, `junk` (50) | non-gear `price×0.4`; gear `price×0.05×(1+0.8q)×(1+0.3enh)`; `junk` = q0, enh0, no runes ("sell all") |
| `enhCost` (70), `ENH_RATE` (10) | enhancement; `gearBonus` (40) applies `+10 %` of base per `enh`, affixes, runes, runeword, set bonuses, legend |
| `goodsNear(p)`, `SHOP` (70/10) | shop NPC (role `shop`, within 56 px) sells `n.goods \|\| SHOP`; `W1`-style key resolves to the hand's weapon kind (`resolveItem`) |
| `case buy/sell/sellall/enh/salv/rune/wh/bag_expand` (70-validate, 75-apply) | the actions |

## 접두사 고유 효과 (`lg`) — pools and no-stack (docs/design/prefix-effects.md; machinery `51-prefix.js`, tables in 10-tables)
- A power is `LEGEND[key] = [word, tooltip, slots, cat, rating, fam]` + numbers `PFX[key]` + code `PFX_FN[key]`. `rollGear` (q3 / q5) draws from the pool of the item type (`SLOT_L`: W weapon · R ring · G gloves · A armor · B boots · N amulet · H helm; offense on W R G, defense on A B N, helm mixed + utility) over the keys with `PFX[key].on`, weighted by rating S 1 · M 2 · L 1 (`PFX_W`; `pfxPick`, one `rnd`). The slot letters restrict ROLLING only: an old piece keeps its power anywhere.
- The same power on several worn pieces counts once (`gearBonus`): the highest item level (`gearIl`) wins, a tie goes to the earlier `SLOTS` entry; the others' slots are `b.lgOff` (wire `self.lgOff`, the tooltip greys them "중복 적용되지 않음"; a bag piece is greyed when a worn piece with the same power has `il ≥` its own). Their ordinary lines still count. `st.lg` stays `{key: 1}` in slot order.
- Today's eight run through `PFX_FN` with the same numbers as before (a basic arrow now answers `blow` too, so a bow wearing 뇌명의 chains; before it silently did not).

## Data shapes
- Gear piece: `{id, q, il, enh, af:[[stat,value]…], sk, ru:[runeKey|null…], lg?, set?, un?}`; `il` = item level (shown 1–200); worn from player level `gearReq(g)` = max(1, il − `IL_GAP` 10); a piece without `il` (old sheet, shop stock, test fixtures) counts as `ITEMS[id].req + 10` (1 for req 1), so its wear level never moved (`gearIl`/`gearReq`, 50). `un` only at q 5; stack `{id,n}`. `ch.inv` (len ≤ `bagCap`), `ch.eq` slots (`weapon helm armor gloves boots ring1 ring2 amulet weapon2`), `ch.wh={items,gold}` (`WH`=60 slots, unlimited gold).
- Drop (on map): `{id, it, g, n, q, x, y, own, freeAt, dieAt}`; wire `D` (see wire page).
- `lootFor` details: gold = `ri(mob.gold)×[1,3,12][el]×goldK(lv)×(1+gold%)×(lucky 2)×(rift `DIM.lootGold`)` ÷ party size; `goldK(lv)=1−0.7·clamp((lv−8)/28)`. Gear try chance: boss/chest 1, elite 0.35, normal `d.gear`, each × `(1+mf/100)`; tries boss 4 / 3 for el 2 / else 1. Type weights `DROP_TYPES` (weapon 24, helm 13, armor 15, gloves 13, boots 13, ring 13, amulet 9); tier `tierFor(mob.lv)` (+1 for ranked 25 %); weapon kind = looter's own 50 %. `rollRarity` top (leg/set) `[.012,.07,.2][rank]×(1+mf)`, rare `[.09,.3,.55]`, magic .36; legend 60 / set 40 of top. A 유니크 is the lowest slice of the same roll, `UNIQ_P` `[.001,.004,.01][rank]×(1+mf)` (never from crafts or the 알바 board). Rune `(0.02+lv·0.001)×GEAR_CUT(0.3)` normal, 0.25 elite, 1 boss; 강화석 similar; potions 10 %/7 %. `MOB_ATK`, `GEAR_CUT` live in 10-tables.
- Enhancement `enh` 0→10: costs `60×tier×(enh+1)` gold + stones 1/2/3 (by enh <3/<6/else); success `ENH_RATE`=[100,95,90,80,70,55,45,35,25,15]; fail at enh ≥5 drops one level; jewellery cannot be enhanced; needs 대장장이 (`smith` NPC). `salv` breaks gear into 강화석: `[0|1,1,2,5,5,8][q] + ⌊enh/2⌋`.
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
`loot.mjs` (gear, rarities, repeat hunting) · `itemlevel.mjs` (il, wear level, lines per rarity, 유니크) · `growth.mjs` (warehouse, pets, scrolls) · `housing.mjs` (bag expansion, house prices) · `wardrobe.mjs`/`cosmetics.mjs` (cos_buy) · `balance.mjs` · `content.mjs` (old sheets, quests/dailies payouts) · `party.mjs` (shared gold/loot).
