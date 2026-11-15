# Economy review 2026-11-15: enhancement, skill enhancement, uncurse, resets

Scope: numbers in `game/src/logic/` as of today. Owner rules held fixed: safe to +3, failure = one step down + curse,
skill failure eats only the stone, skill +10 is "hardcore". Hand-computed (no simulation run); pity is approximate (+-5 %).

## 0. Inputs and gold income (assumptions marked A)
- Try cost (`enhCost`): gold = 60 x tier x (enh+1); 강화석 1 (enh<3), 2 (<6), 3 (>=6). 강화석 shop 150G. Gear tiers 1..5, req Lv 1/29/61/101/149.
- 저주 해제 주문서 2,500G (sells 1,000). 축복 강화석 (`stone_b`) is NOT in the shop: craft 3 강화석 + 2 `m_o3` (Lv20), or weekly top reward x1.
- Failure at +n (n>=3): to n-1, cursed (cannot enhance until uncursed); uncursed piece gets +10 %p on its next try only.
- Kill gold = mob gold x goldK(lv) (1.0 at Lv8, 0.3 from Lv36) x elite 1/3/12, split by party share. Mob gold is flat in level, so kill gold/hit falls.
- Dailies: task (60+25 tr)G, bonus (150+40 tr)G, tr = (Lv+3)/4. Weekly: 900+200 tr (top). Rift chest: 60 x rift Lv G (x tier mult <=3), 3 full chests/day.
- Gear sells for tier price x 0.05 x (1+0.8q) x (1+0.3 enh): rare tier 3 about 290G, tier 4 about 900G. Small next to kills until Lv60+.
- A: 400 kills/h active. Estimated gold/h (kills + sells, excluding dailies and rifts): Lv20 ~14k (35G/kill), Lv40 ~16k (40G/kill), Lv60+ ~22k.
  Per day add dailies ~1.2k / 1.9k / 2.6k and rift chests ~3.6k / 9k / 16k.

## 1. Expected cost to +7 and +10 (no pity, no blessing = curse route)
Chain: p = .80 .70 .55 .45 .35 .25 .15 for +3..+9. After a failure at n the piece sits at n-1 cursed; one scroll gives
q = p+.10 for that single try. Let f_s = failures at step s, a_s = tries at s. Every arrival at s is exactly one try, so
f_s = (1-p_s)(1+f_s) + (1-q_s) f_(s+1) and a_s = 1 + f_s + f_(s+1).
Solved from the top (+10 target): f_9 5.7, f_8 17.7, f_7 29.7, f_6 30.9, f_5 20.5, f_4 6.3, f_3 1.0.

| path | tries | failures = scrolls | 강화석 | gold (tier t) |
| --- | --- | --- | --- | --- |
| to +7, curse route | 15.1 | 4.1 | 29 | 4,380 t |
| to +10, curse route | 233.8 | 111.9 | 605 | 96,100 t |
| to +10, curse + pity (approx.) | 157 | 73.5 | 409 | 65,300 t |
| to +7, blessed every try from +3 | 8.7 | 0 | 15 | 1,400 t |
| to +10, blessed every try from +3 | 17.8 | 0 | 44 | 7,300 t |

Blessed: tries per step 1/(p+.1): 1.11 1.25 1.54 1.82 2.22 2.86 4.0 (sum 14.8 blessings, +3 free tries below +3).
Pity (`PITY`, +5..+9, need 10/12/16/20/26 failures): fraction of sure tries is about (1-p)/(N+1-p) = 4.3 / 4.4 / 3.9 / 3.6 / 3.1 %, i.e. p_eff +2 to +4 %p. The gauge barely moves the mean (-33 % on the full +10 curse route) and mostly cuts the tail (P(26 straight misses at +9) = 1.5 %).

Gold-equivalent (shop 강화석 150G, scroll 2,500G, blessing valued 1,000G, income above):
- Tier 1 (Lv<29) to +7: 4.4k + 4.4k + 10.2k = 19k, about 1.4 h at 14k/h. Fine. To +10: 96k + 91k + 280k = 467k, about 33 h. The scroll is 60 % of it.
- Tier 2 (Lv29+) to +7: 23k (1.4 h). To +10: 563k (35 h); with pity 375k (23 h).
- Tier 3 (Lv61+) to +7: 28k (1.3 h). To +10: 659k (30 h); with pity 441k (20 h).
- Blessed +10 on tier 3: 22k + 6.5k + 14.8k = 43k (2 h). That is 15x cheaper than the curse route.
Findings:
1. The curse route to +7 is healthy (about 1.4 h of gold). To +10 it is a 20-35 h sink per slot, six slots: appropriate for hardcore, but the sink is finite (all slots +10 then nothing left to buy; tier change resets it, which is the sink that does not run out).
2. 축복 강화석 makes the whole curse design optional. Its only limit is supply (craft, `m_o3` rarity not checked here, 1/week from weekly top). If supply is more than 1-2 a week, +10 is trivial; if supply is that low, nearly everyone takes the curse route. Needs a decision, see section 5.
3. Uncurse scroll supply for the curse route: rift (4% + 0.5%/tier, cap 25%) x 3 chests, plus 1 per weekly bracket, plus 1 big-boss, plus 8% per field boss. At rift tier 25 about 10 per week; so +7 (4 scrolls) is covered in a week, +10 (74-112) takes 7-11 weeks. Consistent with the intended difficulty.

## 2. Skill enhancement (+10)
Failure keeps the level, so stones per step = 1/p: steps 0-2 cost 1 each; then 1.25, 1.54, 2.0, 2.86, 4.0, 6.67, 10.0.
- Per skill to +10: 31.3 stones (sd about 12, the last step alone averages 10, sd 9.5). To +7: 10.6. To +8: 14.7.
- Supply per active week (rift chest from tier 10 at 1% +1%/tier, cap 15%, 3 chests/day; big boss 1-2, once/week A; field boss 3% each, about 10 a week A):

| rift tier | rift/wk | big boss | field boss | total/wk | weeks per skill to +10 |
| --- | --- | --- | --- | --- | --- |
| <10 | 0 | 1.5 | 0.3 | 1.8 | 17 |
| 17 | 1.7 | 1.5 | 0.3 | 3.5 | 9 |
| 24+ (cap 15%) | 3.2 | 1.5 | 0.3 | 5.0 | 6 |

A build with 4-6 active skills at +10 takes 25-100 weeks. For "hardcore" that is a long tail; one signature skill to +10 in 6-9 weeks is about right. Weekly boss is the biggest, steadiest source: it is the bottleneck below tier 10, which is where players first want enhancement. Recommendation: lift the floor, not the cap (section 5).

## 3. Is 2,500G right for 저주 해제 주문서?
It is a flat price against a cost that scales by tier. A failure also costs the dropped step. Compared with the try cost at +9:
- Tier 1 try 600G + 3 stones; scroll = 4x a try. Tier 3 try 1,800G; scroll 1.4x. Tier 5 try 3,000G; scroll 0.8x.
- In time: Lv20 2,500G = 11 min, Lv40 9 min, Lv60+ 7 min. Reasonable at Lv40+, harsh at Lv20 (the first curse can cost as much as the next 25 tries combined for tier-1 gear), and negligible for tier 4-5.
- Scroll drops sell for 1,000G, so each drop is a small gold faucet (10/week = 10k). Not a problem at that size.
Answer: no, 2,500G is right for tier 2-3 only. Scale with tier. Cheapest implementation: lower the item price and add a use-time gold fee 400 x tier (same place `enhCost` is read, `uncurse` in validate/apply): tier 1 1.6k, tier 3 2.4k, tier 5 3.2k.

## 4. Reset costs (placeholders)
Job reset 1,000 + 50 x Lv; level reset 5,000 + 100 x Lv; both also need a scroll.
- Job reset: Lv20 2.0k (9 min), Lv60 4.0k (11 min), Lv200 11k. Cheap; the job level stays, so it is a re-pick not a punishment. Keep.
- Level reset: Lv20 7k (30 min), Lv60 11k (30 min), Lv100 15k, Lv200 25k. This throws away up to 200 levels of XP, but gold is under one hour of play at every level. The gate is the scroll (1% per field-boss looter, about 100 kills). Gold should be a visible price: slope 100 -> 250 (Lv60 20k, Lv200 55k, about 2.5 h at Lv60 income). Income at Lv100+ is unknown (mob table ends near Lv40 in the tables read), so re-check once mid-game maps ship.

## 5. Proposed changes
| constant | file | old | new | why |
| --- | --- | --- | --- | --- |
| `uncurse.price` | `10-tables.js:42` | 2500 | 1200 | scroll was 60 % of tier-1 +10 cost |
| uncurse use fee (new) | `70-validate.js` `uncurse`, `75-apply.js` | none | 400 x tier gold | scales the sink with gear tier (tier 1 1.6k .. tier 5 3.2k) |
| `LOOT_X.rift.ske` / `skeMax` | `64-dim.js:308` | 0.01 / 0.15 | 0.015 / 0.20 | per-skill +10 from 6-9 to 4.5-7 weeks at tier 17-24 |
| `LOOT_X.rift.skeFrom` | `64-dim.js:308` | 10 | 5 | players below rift tier 10 get 1.8 stones/wk (17 weeks per skill) |
| `LOOT_X.big.ske` | `64-dim.js:309` | [1, 2] | [2, 3] | weekly boss is the steady floor, 1.5 -> 2.5/wk |
| `stone_b` recipe | `12-life-tables.js:167` | 3 강화석 + 2 `m_o3` | 5 강화석 + 3 `m_o3` | blessed +10 is 15x cheaper than the curse route; only if blessing supply proves above ~2/week (check `m_o3` rate first) |
| `JF_COST.lvl` | `47-job-freedom.js:13` | [5000, 100] | [5000, 250] | gold gate under 1 h at every level |
| `PITY.need`, `ENH_RATE`, `ENH_PCT`, `SKE_RATE`, `JF_COST.job` | | | unchanged | pity mostly trims the tail; owner rules fixed |

## Not checked
Real kills/hour and party gold share, `m_o3` drop rate (blessing supply), how often the weekly big boss can be fought (assumed 1/week),
gold sinks outside enhancement, and income at Lv100+. Pity figures use a mean-field approximation, not a simulation: if the owner wants a hard number, run a seeded Monte Carlo on `enhWin` in a test.
