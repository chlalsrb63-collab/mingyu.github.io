# 생활 기술 · 협동 아르바이트 — 설계서 (life skills and co-op part-time jobs)

Status: **L1 built** (section H, sheet v12); **L2 rules built** (section H2: the wire and actions for the client), L2 client and C1–C3 next. Originally ready for implementation **after J1** of [`jobs-and-stats.md`](jobs-and-stats.md) (sheet v10,
`toTier`, `tierXp`, `ch.cnt`) and **after Phase 2** of [`scale-and-rift.md`](scale-and-rift.md) (ready check,
instance closing). Phases L1 → L2 and C1 → C2 → C3 (section F). Code, identifiers and commit messages are English;
every player-facing string is Korean (AGENTS.md rule 6). Numbers are first values that live in tables, so balance
edits are data-only; (model) = a throwaway node model, (bot) = calibrated by a bot test in the phase that builds it.

**What came from the owner and what is proposed.** The owner sent two specs. The co-op spec arrived whole. The
life-skill spec was cut off after its first section. Tags used below:
- **(owner)**: taken from the owner's text. These contracts win if any naming below ever differs: `life: {fish,
  cook, gather, craft, alch, deliver}` each `{lv: 1..50, xp}`; `jobBoard: {day, done: [], active: {id, npc, prog,
  expAt}}`; `rep: {}`; XP from every life activity and part-time job; unlocks at Lv 10/20/30/40/50; success and
  대성공 chance +1.2 % per level; less time per level; `coopDay`, `coopDone: []` reset at 06:00 KST; `coop_start`,
  `coop_tool`, `coop_act`; instance ids `coop_diner_<partyId>`, `coop_apt_<partyId>`, …; the four buildings, their
  mini-games, the HUD, the sounds and the tests listed in the owner's spec.
- **(proposal)**: everything else in the life-skill half (gathering nodes, recipes, material grades, delivery,
  the solo job board's rules, reputation tiers, the 재료 주머니). The owner should check these against the part of
  the spec that was lost (section G).

---------------------------------------------------------------------------------------------------------------

## 0. Decisions on one screen

1. **Six life skills, levels 1–50, one curve** `lifeNeed(L) = 10·L² + 40` (≈ 1.3 h to Lv 10, ≈ 16 h to 30,
   ≈ 41 h to 50 of steady work in one skill (model); part-time jobs make it faster). They are separate from
   combat level and weapon mastery. Combat stats never depend on them; what they give is goods.
2. **One formula for every bonus**: `d = L − unlock level of the recipe or grade`; success `min(100, 60 + 1.2·d) %`,
   대성공 `min(60, 3 + 1.2·d) %`, time `× (1 − 0.008·L)` (−40 % at 50). Low recipes turn into mass production; new
   recipes stay chancy. **No stamina bar** (proposal; question G.2). The game has none today, and the time cuts
   plus per-node cooldowns do the same job.
3. **Five material grades = five zone groups**: G1 meadow/버드나무 마을, G2 forest/crypt, G3 city/sewer, G4 cave/abyss,
   G5 단풍 왕도. Grade *g* unlocks at life Lv `10·(g−1)` (1, 10, 20, 30, 40); Lv 50 opens one 명장 recipe per skill.
4. **Gathering** (proposal) uses fixed nodes (약초 · 광맥 · 통나무) that the server places on every hunting map from
   its seed. Each player has their own 5-minute cooldown per node, so nobody can steal or block a node. A 2.4 s
   channel carries one "반짝!" timing tap that raises the 대성공 chance.
5. **Crafting / alchemy / stove cooking** (proposal) happen at town stations: 캉캉대장간, 보글연금공방, 쥬쥬식당
   (campfires keep the simple fish recipes). Each craft is one short client mini-game reporting 0–100, judged by
   the server, like today's fishing and cooking. A recipe 20+ levels below you can be batch-made without the game.
6. **Outputs that matter but do not replace hunting**: potions/foods/elixirs at ≤ 60 % of shop value, enhancement
   stones, **축복 강화석** (+10 %p, no downgrade), crafted gear with at least one affix, a **홈 송곳** (+1 socket), rune
   transmutation, and a cosmetic + title at Lv 50 in each skill.
7. **The solo 알바 게시판** (proposal, fits `jobBoard`): 4 offers a day from named town NPCs, up to 3 done a day, one
   active at a time. They are gather/make/fish/deliver jobs that pay gold, life XP and **rep** with the NPC who asked
   (0–100; tiers 10/30/60 give discounts, a recipe and a cosmetic).
8. **Co-op jobs run in party instances** using Phase 0's `registerDim`/`closeDim` (id check widened to `coop_*`)
   and Phase 2's ready check (`party.rc` gains `kind` and `map`). Only parties of 2–4 can start one. The leader starts
   it inside the building. Each job lasts 5–6 minutes, the last 60 s is 피버 타임, and the grade is C/B/A/S against
   cut-offs scaled for party size.
9. **The four co-op jobs share one engine** (`66-coop.js`: roles, tool racks, carrying, `coop_act` target picking,
   score, combo, fever, grade, anti-AFK, rewards). Each job adds only its own state machine and stations. The
   alchemy kiln is the forge engine with a different look.
10. **Instance layouts are editor-data maps** (`data/maps/jobtpl_*.json`, interior theme, new station furniture
    characters). The owner can rearrange a kitchen in the map editor, and data:check plus a test enforce the
    stations each job needs.
11. **Sheet v11** (one bump, after J1's v10): `life, jobBoard, rep, coopDay, coopDone` (owner) + `pouch` (proposal).
    Migration gives old characters life XP from their fish/cook counters.
12. **Once-a-day rewards per job** (first clear at C or better): XP `tierXp(T)·[.08 .14 .20 .28]`, gold
    `T·[40 60 80 110]`, one `rewardGear`, enhancement stones `[1 2 3 5]`, life XP `lifeNeed(L)·[.3 .45 .6 .8]` in the
    matching skill (T = `toTier(lvl)`). A member who already cleared today can still join as a helper for a tip.

---------------------------------------------------------------------------------------------------------------

## A. Current state (pointers, origin/main d54f0d3)

| what | where | used by this design |
| --- | --- | --- |
| fishing | `70/75` cases `fish hook reel`; client `minigames.js` rhythm game reports `s` 0–100; `75 reel` rolls `fish_s/m/l`/`stone` from the score; `ch.fish` counter; `nofish` maps | L1 adds life XP, grade fish, a bonus to bite time; contract unchanged |
| cooking | `70/75 cook {id, s}` at `fireNear`; tangram score; < 35 burnt, ≥ 85 two; `ITEMS[fish].cook` | L1 adds life XP; L2 turns it into the recipe `craft` path, keeps `cook` as an alias |
| food buffs | `75 use`: `p.food = {id, until, xp, atk}` (one food at a time); scrolls `sc_*` `buff:"atk"/"def"/"xp"` refill, not stack | elixirs reuse the scroll buff keys; dishes reuse `p.food` |
| enhancement | `70/75 enh` at `npcNear("smith")`, `ENH_RATE`, `enhCost`, fail at +5 or higher drops one step | L2 adds option `b:1` (축복 강화석) |
| sockets | gear `sk` (0–3; gloves/boots 1), `rune` action fills | 홈 송곳 raises `sk` up to that cap |
| dailies | `60-content.js` `dayOf` (06:00 KST), `rollDaily` seeded by `strHash(name:day)`, `dailyProg` | the same day number and seeding style for `jobBoard` and `coopDay` |
| bag | `INV = 30` slots, `STACK = 99` | the materials would fill it → proposal `pouch` (B.10) |
| NPC roles | `36 NPC_ROLES`; `70 npcNear(p, role)` 56 px | add `cook craft alch jobs` + optional NPC field `coop` |
| instances | `40 registerDim` (accepts only `dim:` ids), `closeDim` (moves to `START`, clears `party.dim`), `runtime`, `exportChar` saves instance → town | C1 widens the id check, adds `home` and `party.coop` |
| ready check | Phase 2 (in progress): `party.rc = {id, seed, lv, theme, until, resp}`, `dim_ready/dim_cancel`, `out.rc`, `#w-rc` | reused with `rc.kind = "coop"`, `rc.map` (where members must stand) |
| speed | `BASE_SPD = 48` px/s (3 tiles/s); `p.spdBuff` gives ×1.4 | set inside co-op maps (4.2 tiles/s) |
| actions | room applies each action as it arrives with `world.now = Date.now()` | rhythm timing is judged when the action arrives |
| town | `34 buildTown()` 40×30; interiors `tales_cafe` (door 29–30,23), `town_hall` (18–19,5), `starlight_inn` (9–10,8) via `links.json`; houses with no door at (27,4) and (7,21) | C.1 placement |

---------------------------------------------------------------------------------------------------------------

## B. Life skills (생활 기술)

### B.1 Data and curve

```js
const LIFE = ["fish", "cook", "gather", "craft", "alch", "deliver"];          // wire order (owner keys)
const LIFE_NAME = ["낚시", "요리", "채집", "제작", "연금", "배달"];
const LIFE_MAX = 50, lifeNeed = (L) => 10 * L * L + 40;                       // 50, 1,040 (10), 4,040 (20), 9,040 (30), 16,040 (40), 24,050 (49)
const GRADE_LV = [1, 10, 20, 30, 40];                                         // grade g (1..5) unlocks at GRADE_LV[g-1]; 50 = 명장
const RXP = [8, 14, 22, 34, 50];                                              // life XP for one action at grade g; ×1.5 on 대성공
```
- `gainLife(S, p, k, n)` in `58-life.js`: adds XP and levels up (several levels if needed). On level-up it sends the
  event `["lv2", eid, LIFE index, lv]` and a toast ("[채집] 레벨 20! 3등급 재료를 다룰 수 있습니다."). At 10/20/30/40
  it toasts the unlock; at 50 it gives the cosmetic and title (B.9).
- Stale work earns less: an action on a recipe/grade unlocked ≥ 20 levels below you gives ×0.25 XP.
- Totals (model, 5 actions/min at the matching grade): Lv 10 ≈ 1.3 h, 20 ≈ 6.6 h, 30 ≈ 16 h, 40 ≈ 28 h, 50 ≈ 41 h.
  The 알바 board (≈ +15 %) and co-op jobs (up to 0.8 level per clear) shorten this by roughly a third for a daily
  player.

### B.2 Bonuses (owner's numbers, one helper `lifeRoll(S, L, unlockLv)`)

| bonus | formula (`d = max(0, L − unlockLv)`) | at d = 0 | d = 20 | d = 49 |
| --- | --- | --- | --- | --- |
| success | `min(100, 60 + 1.2·d)` % | 60 | 84 | 100 |
| 대성공 (double yield / +1 rarity / +50 % count, per skill) | `min(60, 3 + 1.2·d)` % | 3 | 27 | 60 |
| time (channel, bite wait, cook/brew minimum time) | `× (1 − 0.008·L)` | — | — | ×0.6 at L 50 |

A mini-game score shifts both rolls: `+ (s − 50)·0.2` %p (−10…+10). A failed craft keeps half of each input
(rounded down) and pays no fee. Fishing and gathering never "fail": failure there means the lower-tier result.

### B.3 Material grades by zone (proposal; the names are final Korean text)

| grade (unlock) | maps | 약초 `herb` | 광석 `ore` | 목재 `wood` | fish (fishing) |
| --- | --- | --- | --- | --- | --- |
| G1 (1) | meadow, willow | 들꽃잎 `h1` | 구리 원석 `o1` | 마른 가지 `w1` | 송사리 `fish_s` |
| G2 (10) | forest, crypt | 이끼버섯 `h2` | 철광석 `o2` | 참나무 목재 `w2` | 무지개 송어 `fish_m` |
| G3 (20) | city, sewer | 형광 덩굴 `h3` | 네온 고철 `o3` | 기름 먹은 판자 `w3` | 은빛 메기 `fish_c` (new) |
| G4 (30) | cave, abyss | 수정꽃 `h4` | 심연 결정 `o4` | 화석 목재 `w4` | 동굴 장님고기 `fish_v` (new) |
| G5 (40) | maple (단풍 왕도) | 붉은 단풍잎 `h5` | 왕도 은괴석 `o5` | 단풍 고목 `w5` | 황금 잉어 `fish_l` (rare everywhere, common-ish here) |

Item ids are `m_h1`…`m_w5` (type `lmat`, sell price `[6, 14, 30, 60, 110]`), defined in a loop in
`12-life-tables.js`. Editor maps take the grade of their `band` (tier → group) unless they set `"grade"`. Town and
interiors have no nodes unless an editor map lists them (`"nodes": [[kind, x, y]…]`, optional field).

### B.4 Gathering (채집) — proposal

- **Placement** (`lifeNodes(m)` in `58-life.js`, memoised on `m.nodes`, computed in `mapOf` after `buildCells`): it
  uses a box seeded with `m.seed ^ 0x6e0d` and picks reachable tiles at least 6 tiles apart. Nodes are kept at least
  3 tiles from doors, signs, waypoint stones, NPCs and fires. The count is `clamp(round(open / 150), 8, 60)`, so a
  4× map gets roughly 4× the nodes. Kind weights per theme: meadow herb .5 wood .3 ore .2 · forest wood .45 herb .4
  ore .15 · crypt ore .5 herb .3 wood .2 · city/sewer ore .55 wood .25 herb .2 · cave/abyss ore .6 herb .3 wood .1 ·
  autumn wood .45 herb .4 ore .15. Hidden pockets (Phase 1 high zones) get double weight in the pick, so exploring
  pays.
- **Per-player cooldown, never depleted**: `p.ng = {mapId: {nodeIdx: readyAt}}` (runtime only, not persisted;
  `NODE_CD = 300000`). A node always looks the same to others; your own spent nodes look harvested (stump, empty
  vein) until they are ready again.
- **Action** `gat {i}`: within 24 px, node ready for you, `life.gather.lv ≥ GRADE_LV[g−1]` ("채집 레벨이 부족합니다
  (Lv.20 필요)"), not hit in the last 3 s, room for 2 in the pouch/bag. The channel lasts `2400 × time`. Moving more
  than 6 px, being hit, attacking or sitting cancels it ("채집이 끊겼습니다"). At a seeded moment (35–75 % of the
  channel) the server sends `["gt", eid, 700]` ("반짝!"). A `gat_tap` that arrives within 700 + 250 ms (latency
  allowance) adds +15 %p 대성공 to this harvest. A tap at any other moment does nothing, and only one tap counts.
- **Yield**: 1 of the node's grade-material (2 on 대성공). There is also a 4 % chance of one bonus item: herb nodes give
  a seed of the next grade's herb, ore nodes give `stone`, wood nodes give `camp`.
- Life XP `RXP[g]`; daily task kind `gather` (L2 appends to `DAILY_OTHER`); counter `cnt.gat`.

### B.5 Fishing and cooking: what changes (L1)

- Fishing: bite wait `× time(fish.lv)`. The keep threshold drops from 30 to `30 − 0.3·L` (15 at L 50). The fish
  table becomes grade-based: candidates are fish of grade ≤ min(map grade, the player's unlocked grade). Today's
  score split (gold/trout/stone/small) becomes "top candidate / next / stone / lowest". `fish_l` keeps its own
  roll `0.01 + 0.07·k² + 0.001·L`. 대성공 = 2 fish. XP `RXP[grade of the fish] × (0.5 + s/100)`. Nothing changes in
  the `fish/hook/reel` wire.
- Cooking: still the tangram. The burnt threshold becomes `35 − 0.4·d` (min 10). Two portions now come at score
  ≥ 85 **or** on a 대성공 roll. XP `RXP[recipe grade]`. `cook {id, s}` stays as an alias of `craft {r: ITEMS[id].
  recipe, s}` so old clients keep working.

### B.6 Recipes (proposal; one table `RECIPES` in `12-life-tables.js`)

`RECIPES[id] = {sk, lv, at, in: [[item, n]…], out: [item, n], fee, mg, ms}` where `at` is the station: `fire` (any
campfire, `fireNear`), `cook` (쥬쥬 at the diner stove), `craft` (캉캉), `alch` (보글); `mg` is the mini-game:
`pan` (tangram), `forge` (timing needle), `brew` (colour match); `ms` is the minimum mini-game time before `craft`
is accepted.

| skill | Lv | recipe → output | inputs (+ fee) | at | why it matters |
| --- | --- | --- | --- | --- | --- |
| cook | 1 | 구운 송사리 `food_s` | fish_s | fire | existing |
| cook | 5 | 들꽃 주먹밥 `fd_rice` (HP 150, 10 min def +5 %) | h1×2, 식재료 꾸러미 `staple` | fire/cook | early food buff |
| cook | 10 | 송어 소금구이 `food_m` | fish_m | fire | existing |
| cook | 15 | 버섯 꼬치 `fd_skewer` (HP 320, 15 min atk +4 %) | h2×2, staple | cook | |
| cook | 20 | 메기 매운탕 `fd_stew` (HP 600 MP 120, 15 min xp +8 %) | fish_c, h3, staple | cook | |
| cook | 30 | 장님고기 찜 `fd_steam` (HP 1,100, 20 min xp +10 % atk +4 %) | fish_v, h4×2, staple | cook | |
| cook | 40 | 황금 잉어찜 `food_l` | fish_l | fire/cook | existing |
| cook | 50 | 쥬쥬 특선 정식 `fd_feast` (full HP/MP, 30 min xp +15 % atk +8 %) | fish_l, h5×2, h4, staple×2 | cook | 명장 |
| alch | 1 | 빨간 물약 ×3 `hp_s` · 파란 물약 ×3 `mp_s` | h1×2, 빈 병 `flask`×3 | alch | cheaper potions |
| alch | 10 | 큰 빨간/파란 물약 ×3 | h2×2, flask×3 | alch | |
| alch | 15 | 공격의 엘릭서 `el_atk` (buff `atk` 12 %, 15 min) | h2×2, o2, flask | alch | replaces a scroll |
| alch | 20 | 농축 빨간/파란 물약 ×3 | h3×2, flask×3 | alch | |
| alch | 25 | 수호의 엘릭서 `el_def` (`def` 14 %, 15 min) · 경험의 엘릭서 `el_xp` (`xp` 20 %, 15 min) | h3×2, o3, flask | alch | |
| alch | 30 | 신속의 물약 `el_spd` (×1.4 speed 60 s, existing `spdBuff`) | h4, w4, flask | alch | |
| alch | 35 | 부활 깃털 `feather` | h4×2, o4, w3 | alch | |
| alch | 40 | 룬 변환 (3 runes of tier *t* → 1 random rune of tier *t+1*) | runes + h5 | alch | rune sink |
| alch | 50 | 연금 정수 `el_all` (atk 10 % def 10 % xp 10 %, 20 min, one buff slot) | h5×2, o5, w5, flask | alch | 명장 |
| craft | 1 | 강화석 `stone` | o1×4, w1 (+40 G) | craft | the main sink and goal |
| craft | 5 | 모닥불 꾸러미 `camp` | w1×5 | craft | |
| craft | 12/22/32/42 | gear tier 2/3/4/5, chosen slot or weapon kind (48 recipes from a loop) | ingot (o_g×3 → `ing_g` at Lv `GRADE_LV`) ×4, w_g×2 (+30 % of shop price) | craft | rarity ≥ 1 (one affix), 대성공 +1 rarity (cap 3, never legendary/set) |
| craft | 20 | 축복 강화석 `stone_b` | stone×3, o3×2 (+300 G) | craft | `enh {k, b:1}`: +10 %p, a fail never drops a step |
| craft | 30 | 홈 송곳 `punch` | o4×3, w4×2 (+2,000 G) | craft | `+1 sk` up to the slot's cap; one use |
| craft | 50 | 명장의 숫돌 `whet` (re-roll the lowest affix of one item) | o5×4, w5×2, stone_b (+5,000 G) | craft | 명장 |

Staples `staple` (식재료 꾸러미, 12 G) and `flask` (빈 병, 5 G) are sold by 쥬쥬 and 보글 (`goods`). Batch mode: when
`L ≥ lv + 20`, `craft {r, n: 1..10}` without a mini-game is scored as `s = 70`. Gear crafting has no batch mode.
Delivery (B.8) has no recipes.

### B.7 Economy guard (proposal; enforced by a table test)

- Faucets: material sell prices (low) and 알바 gold (B.9). Sinks: crafting fees, staples, flasks, socket and whetstone
  fees, rune transmutation.
- **For any output the shop also sells, inputs at sell value + fee ≥ 60 % of the shop price** (`tests/lifeskills.mjs`
  walks `RECIPES` and asserts it). So crafting saves at most ~40 % against buying, and gatherers still sell some
  materials. Crafted consumables sell at the normal sell ratio, so a craft→sell loop loses gold.
- Enhancement stones: shop 150 G. Crafted cost ≈ 4×6 + 6 + 40 = 70 G plus ≈ 1 min of work. That halves the stone
  sink for crafters, which is intended because stones are a big gate. Watch `stone` purchases per player-hour in
  analytics after L2.

### B.8 Delivery (배달) — proposal

- A parcel is runtime state `p.parcel = {jb id, from, to, until}` mirrored in `jobBoard.active` (`prog` 0 = to pick
  up, 1 = carrying; `expAt` = deadline in server ms). It does not take a bag slot. A parcel crate is drawn over
  the head, using the same carry gauge as co-op (C.11).
- **Time limit** = `path(from → to) / (BASE_SPD·0.85) × 1.8 + 20 s`. The path length comes from `walk` A* on town +
  interiors with doors counted as 2 tiles (precomputed per pair in `JB_ROUTES`). Moving speed while carrying is
  `× (0.85 + 0.006·L)` (0.85 at 1, 1.0 at 25, 1.15 at 50) through the existing speed multiplier in `deriveStats`
  (`p.parcel` read there; one line, coordinated with J1).
- Delivered in time: gold `20 + 4·L`, + up to 50 % tip by time left, life XP `RXP[g] × 4`, rep +3 with the
  recipient and +1 with the sender. Late or dead: the parcel is lost, "배달 실패", no rep change (gentle).
- Range by level: Lv 1 town and its interiors · Lv 10 버드나무 마을 · Lv 25 the four co-op buildings' back
  rooms (lobby NPCs) · Lv 40 단풍 왕도 은자 바스 (a long trip with gate travel, big tip).

### B.9 알바 게시판 (solo part-time board) and NPC trust — proposal fitting the owner's fields

- **Where**: NPC 알바 중개인 포포 (`role: "jobs"`) beside a notice board in 버드나무광장 회관 (`data/maps/town_hall.json`,
  west side, e.g. (4,9); L2 picks a free tile). The plaza board 하루 (daily tasks) is not touched.
- **Offers**: `jbOffers(ch, day)` is seeded like `rollDaily` (`strHash(name:day:jb)`) and draws 4 templates from
  `JB` the player qualifies for (life level). The board view shows them; `jobBoard.done` lists today's finished
  template ids. **3 per day**, one `active` at a time. `jobBoard.day` resets lazily with `dayOf` (06:00 KST) like
  `ensureDaily`.
- **Template kinds** (`JB[id] = {kind, npc, lv, sk, item?, n?, to?}`; Korean text final in the table):
  - `bring`: "보글이 [이끼버섯] 6개가 필요하대요" → hand the items in to `npc` (items consumed; `jb {a:"give"}`).
  - `make`: "여관 주인 마루가 [메기 매운탕] 3그릇을 주문했어요" → crafted or cooked goods that no shop sells.
  - `fish`: "낚시꾼 갈대가 [은빛 메기] 2마리를 원해요" → hand in fish.
  - `deliver`: "카페 주인 모카의 원두 자루를 쥬쥬식당 쥬쥬에게" → B.8 (`npc` = sender, `to` = recipient).
- **Reward**: gold `30 + 6·L(sk)`, life XP `lifeNeed(L(sk)) × 0.25` in the template's skill, rep +2 (deliver: B.8).
  Gold cap per day ≈ 3 × (30 + 6·50) ≈ 1,000 G at most. This is pocket money; the co-op jobs are the paycheck.
- **Rep** `rep: {npcId: 0..100}` (keys must be static NPC ids; `migrate` drops unknown keys and clamps). Tiers:
  **10 단골**: −5 % at that NPC's counter (`goods` shops) or +10 % tips · **30 친구**: that NPC teaches one recipe
  (모카 → 산딸기 파이 `cafe_pie` recipe, 마루 → 여관 스튜, 캉캉 → 강화석 ×2 batch line, 보글 → 엘릭서 duration +5 min …,
  listed in `REP_PERK`) · **60 가족**: a cosmetic (`giveCos`, source `rep`) and the title "<NPC>의 단골".
  Talking does not give rep; only finished jobs and co-op clears at that NPC's building (+5) do.
- **Lv 50 in a skill** (mastery): a cosmetic (낚시꾼 밀짚모자 · 요리사 모자 · 채집꾼 바구니(back) · 대장장이 앞치마(top) ·
  연금술사 고글(face) · 배달부 가방(back)) and a title (명인 낚시꾼 …) via 6 `ACH` entries; also ACH for Lv 10/30.

### B.10 재료 주머니 (pouch) — proposal, question G.3

`pouch: {itemId: n}` holds only `type: "lmat"` materials plus `staple`/`flask`, up to 999 each, and is never part of
the 30 bag slots. `addItem` routes those types there first. Recipes, `bring` jobs and selling read the pouch plus
the bag; the warehouse can take pouch items. Without it, three node kinds × five grades would take a third of the
bag.

### B.11 Actions (life; Korean errors; all appended at the end of the `70`/`75` switches)

| action | check | effect |
| --- | --- | --- |
| `gat {i}` | node within 24 px, ready for p, grade level, not fighting (3 s), room | start channel `p.gat = {i, end, tapAt, tapped}` |
| `gat_tap` | `p.gat` and inside the tap window, not tapped | +15 %p 대성공 for this harvest |
| `craft_open {r}` | recipe known (lv, rep perk), station near, inputs, fee, room for max output | `p.mk = {r, at: now}`; event to open the mini-game |
| `craft {r, s, n?}` | `p.mk.r === r` and `now − p.mk.at ≥ RECIPES[r].ms × time` (or batch: n ≤ 10, `L ≥ lv+20`, no `p.mk` needed) | consume, pay, roll success/대성공, give, XP |
| `cook {id, s}` | kept: alias for `craft` on the fish's recipe | — |
| `jb {a: "take"/"drop", id}` | near 포포; offer of today; not done; take: no active; done count < 3 | sets/clears `jobBoard.active` |
| `jb {a: "give"}` | near the active job's `npc` (`to` for deliveries), items/parcel present, not expired | pay out, `done.push(id)`, rep |
| `jb {a: "pick"}` | deliver job, `prog 0`, near the sender | `p.parcel`, `prog = 1`, `expAt` |
| `enh {k, b: 1}` | (L2 extends `enh`) has `stone_b` | +10 %p, no downgrade |
| `use` (`punch`, `whet`, `el_*`) | `punch`: target gear `{k}` with `sk < cap` · `whet`: gear with affixes | as B.6 |

`lifeTick(S, p, now)` (called once per player from `tick`, 80-simulation, one line) finishes gathering channels,
cancels them on movement or damage, and expires delivery deadlines.

### B.12 Wire and client (life)

- `self.life = [[lv, xp, need] × 6]` (LIFE order), `self.jb = [day, [[id, kind, npcName, text, gold, skIdx] × 4],
  doneIds, active ? [id, prog, need, secsLeft] : 0]`, `self.rep = [[npcId, n]…]` (only non-zero), `self.pouch`
  (object) — all only when `dirty`. `mapPayload` gets `nodes: [[kind 0..2, grade, tx, ty]…]`. The snapshot field
  `ng` (spent node indices on this map for this player) is sent only when it changes. Events: `["lv2", eid, k, lv]`,
  `["gt", eid, ms]`, `["ga", eid, kind, great]` (gathering done).
- `defs().life = {names, need: [50 values], grades, recipes (RECIPES flattened), mats, jb (texts), repTier}`.
- Client: new `public/life.js` (생활 window: six bars; the station window opened by talking to 쥬쥬/캉캉/보글 or at a fire
  with a recipe list, missing inputs greyed, a 일괄 제작 toggle; the 알바 board window; node draw list and channel
  bar for scene2d). `minigames.js` gains `forge` (a needle sweeps; stop it in the gold band, 3 strokes) and `brew`
  (stir to shift the potion colour onto the target swatch). There is no free letter key, so the 생활 window opens
  from a `#menu` button (`uiicons.js MENU_ICON.life`) and from the C window's tab row once J3 lands.
- Art: nodes are 16×16 code-drawn sprites per kind with a grade tint (`decor.js` style; herb tuft with a sparkle,
  ore vein in rock, log with an axe notch); a "spent" variant; gathering pose with a sickle/pick/axe drawn from
  `tools.js` (C.11).
- Sound: `gat_herb`, `gat_ore`, `gat_wood`, `gat_spark`, `craft_ok`, `craft_great`, `craft_fail`, `brew_bubble`,
  `deliver_ok`, `lifeup` (a short fanfare, quieter than a combat level-up).

---------------------------------------------------------------------------------------------------------------

## C. Co-op part-time jobs (협동 아르바이트) — owner's spec, engineered

### C.1 Buildings and town placement (checked against the current town)

> **Superseded coordinates.** The town is being rebuilt at 100×76 by `docs/design/town.md`; the four buildings
> keep their names and interior ids but stand where that doc puts them: 캉캉대장간 = `smithy` (70,33) door
> (72–73,37) → `kangkang_forge`; 동동아파트 = `apt` (8,30) door (10–11,34) → `dongdong_apt`; 보글연금공방 = `lab`
> (78,25) door (80–81,28) → `bogle_lab`; 쥬쥬식당 = `diner` (70,45) door (72–73,49) → `juju_diner`. town.md also
> builds the four lobby interiors (owners as talk/shop NPCs: `juju`, `dongdong`, `bogle`, a reserved tile for 캉캉);
> C1 later adds the `coop` fields and roles. The 40×30 coordinates below are kept only as history.

Free tiles were checked against a dump of `buildTown()` + `links.json` at d54f0d3. Phase 2's obelisk (24,18)/NPC
(23,19), the spirit tree (20,20), the campfire (22,22), 이야기꾼 소담 (20,22), 길잡이 다람 (21,26) and the south door to
버드나무 마을 (19–20,27) are all left clear. Two of the four buildings reuse the houses that have no door today.

```
   0123456789012345678901234567890123456789      H town hall · I inn · C cafe (existing interiors)
 4 TT...............HHHH......KKKK..AAAA.TT      K 캉캉대장간   = house (27,4) v1, door (28,7)(29,7), beside 대장장이 볼칸 (30,8)
 5 TT......IIII.B....__p......KKKK..AAAA.TT      A 보글연금공방 = new house (33,4), door (34,7)(35,7)
 6 TT......IIII.......pp...B..KKKK..AAAA.TT        → north-east "장인 거리": smithing and alchemy side by side
 7 TT......IIII.......pp.......__....__..TT
 8 TT.......__.BB.....pp........p@.......TT
   …                                              Ø Phase 2 obelisk (24,18) and its NPC (23,19)
18 TT.......pp...ooooooooooØo.....bbbbwwwwT
19 TT.......pp...Loooooooo@oL.....swwwwwewT
20 TT.......pp....HHH.pT.HHH...CCCCswwewwTT
21 TT.....DDDD........pp.......CCCC..sss.TT      D 동동아파트 = house (7,21), redrawn as a 3-storey block, door (8,24)(9,24);
22 TT.....DDDD..@.....p@.#.....CCCC......TT        의상실 루루 (13,22) stays beside it
23 TT.....DDDD........pp........__..JJJJ.TT      J 쥬쥬식당 = new house (33,23), door (34,26)(35,26), next to the cafe
24 TT......__.........pp............JJJJ.TT        → south-east "먹자 골목"
25 TT.................pp............JJJJ.TT
26 TT..FFFFF..FF......pp@............__..TT
27 TT.................__.................TT
```

- `buildTown()` gets **one block** (L1): `house(m, 33, 4, 2)`, `house(m, 33, 23, 3)`, big entry `{t: "apt", x: 7,
  y: 21}` instead of house v5 (taller art, same 4×3 footprint). It also adds a road stub (34,8)→(34,13) to 보글, and
  four hanging shop signs drawn on the house art (`big.sign`: `juju | dongdong | kangkang | bogle`). Phase 2's block
  is separate; both append.
- `links.json`: two door tiles per building → its lobby interior. Each interior has a `portals` entry back out to
  the doorstep + 1 tile.
- **Lobby interiors** (editor data, `theme: interior`, safe, shared by everyone, not instances):
  - `juju_diner` 쥬쥬식당 (20×14): dining room + open stove. **쥬쥬** (`role: "cook"`, `coop: "diner"`, `goods`:
    staples and diner dishes). The stove counts as the station for `at: "cook"` recipes.
  - `dongdong_apt` 동동아파트 1층 로비 (14×10): mailboxes (delivery drop), stairs (decor), **관리인 동동** (`role:
    "talk"`, `coop: "apt"`).
  - `kangkang_forge` 캉캉대장간 (18×12): furnace + anvil furniture, **캉캉** (`role: "craft"`, `coop: "forge"`).
  - `bogle_lab` 보글연금공방 (18×12): cauldron, shelves, **보글** (`role: "alch"`, `coop: "alch"`, `goods`: flasks).
- Each lobby also has a `v` notice board beside the owner. Its talk window shows the 협동 아르바이트 card: today's
  state (✓ if cleared), the party-size rule, "근무 시작 (파티장)", the last grade and the building's best score this
  channel.

### C.2 Instance lifecycle (reuses Phase 0 and Phase 2)

1. **Start**: the leader talks to the owner and sends `coop_start {k}` (k ∈ `apt diner forge alch`). Validation
   (Korean): in a party "2~4명 파티만 일할 수 있습니다"; the sender is the leader "파티장만 근무를 시작할 수 있습니다";
   near the owner with `npc.coop === k` (56 px); ≥ 2 members on this lobby map "가게 안에 파티원이 2명 이상
   있어야 합니다"; no `party.rc` and no `party.coop`; `COOP_MAX = 6` running per channel room ("지금은 일손이 꽉
   찼습니다 (6/6)"); nobody in the party is inside a `dim:*` instance.
2. **Ready check** (Phase 2's): `party.rc = {id, kind: "coop", k, map: <lobby id>, until: now + 20000, resp}`. It goes
   only to members on that lobby map; others are listed as "가게 밖". The `#w-rc` modal is titled "협동 아르바이트 ·
   <job> — 수락/거절". `dim_ready`/`dim_cancel` work unchanged on any `party.rc`; the only change is that they check
   `p.map === rc.map` instead of `"town"` (C1 makes that one-line change in `64-dim.js`). The job starts when all
   have answered or time runs out, **if ≥ 2 accepted**; otherwise "인원이 부족해 근무가 취소되었습니다".
3. **Open**: id `coop_<k>_<partyId>` (owner). C1 widens Phase 0's guard to `INST_RE = /^(dim:\d+|coop_(apt|diner|
   forge|alch)_\d+)$/`; `fromEditor`/data:check reserve the `coop_` prefix. `map = cloneTpl(mapOf(COOP[k].tpl), id)`
   is a shallow clone: its own `id`, `npcs: []`, `portals: []` (the exit is closed during the shift), with the
   template's `g/o/solid/reach/cells` shared read-only. Then `registerDim(S, {id, map, party: party.id, seed:
   strHash(id + ":" + S.nextId++), lv: T of the leader, expire: born + (mins + 3) min, home: {map: lobby, x, y}})`.
   C1 adds the optional `home` to the record; `closeDim` sends players there instead of `START`. `party.coop = id`;
   `closeDim` clears it next to `party.dim`. `dim.coop = newCoop(k, members, seed)` is the job state (C.3).
4. **Enter**: `changeMap` each accepter to the template's `coop.start` tiles. Each gets a tool by the default
   rotation (C.3), `p.spdBuff = endAt` (×1.4), `p.coopPts = 0`. Weapons are hidden: `who` carries the tool, and
   `atk`/`sk`/`fish`/`gat`/`craft*` are refused inside ("근무 중에는 할 수 없습니다").
5. **Phases**: `brief` 8 s (3-2-1 countdown, role hints, nothing spawns) → `run` (`COOP[k].mins`: apt 5:00, diner
   6:00, forge 6:00, alch 6:00) → `fever` (last 60 s) → `end`. At `end` the score freezes, rewards are paid (C.7),
   the report card goes out, and the exit portal opens back to the lobby (`home`). The instance closes 60 s later or
   when it is empty for 20 s (`closeDim`).
6. **Leaving and disconnects**: `coop_leave` or recall = leave at once, no reward ("근무를 포기했습니다"). If a
   member disconnects, the shift continues and the cut-offs stay at the starting party size. `coop_join` (a member
   of `party.coop`'s party in the lobby, `state` brief/run, not leaving earlier) lets them rejoin within the shift.
   A restart loses the instance; Phase 0's `exportChar` already saves anyone inside as standing in town.

### C.3 The shared engine (`66-coop.js`)

```js
dim.coop = { k, state: "brief"|"run"|"fever"|"end", t0, runAt, feverAt, endAt, n /*party size at start*/,
  members: [pid…], box /*seeded rnd*/, score, combo, comboAt, best, ents: {…per job}, ver /*bumps on change*/, log: [] };
p.tool = "broom"|"bin"|"pan"|"tray"|"tongs"|"hammer"|"fan"|"paddle"|null;  p.hold = {c: code, n} | null;  p.prog = 0..100
```
- **Tools and racks** (`&` station): a rack holds `ceil(n/2)` of each of the job's two tools. `coop_tool {t}` within
  24 px of a rack, the tool must be free there, and your hands must be empty ("들고 있는 것을 먼저 내려놓으세요").
  Your tool goes back on the rack and the new one goes in your hand. The default rotation gives tool A to members
  1 and 3 and tool B to members 2 and 4 (apt broom/bin, diner pan/tray, forge tongs/hammer, alch fan/paddle).
- **`coop_act {a?}`** (`a` = aim, optional) is the one context action: the attack key and the tap button send it
  inside co-op maps. Rate limit 250 ms (`p.coopAt`). Target picking is deterministic: the job's `interact(S, inst,
  p)` gathers candidates within reach (stations 24 px from the tile centre, entities 28 px), keeps those in the
  facing arc (reuse `inArc`, 120°) or the nearest overall if none is in the arc, sorts by (priority, distance, id),
  and takes the first one whose rule accepts p's tool and hold. If nothing accepts it, the error is a quiet toast
  for the most relevant reason ("빗자루로는 쓰레기를 치울 수 없어요 — 쓰레기통 담당에게!").
- **Score, combo, fever**: each job emits `good(S, inst, pts, credits)` / `fail(S, inst, pen)`. `mult = (1 + 0.1 ·
  min(combo, 10)) × (fever ? 1.5 : 1)`. A `good` within `COMBO_MS[k]` (apt 20 s, diner 25 s, forge/alch 40 s) of
  the last raises combo by 1. A `fail` sets combo to 0. `credits` splits points among the pids who did the work
  (`p.coopPts`, report card, eligibility).
- **Grade**: `cut(k, n, g) = COOP[k].par × PAR_N[n] × [0.30, 0.50, 0.70, 0.88][g]` with `PAR_N = {2: 1, 3: 1.35, 4:
  1.65}` (sub-linear: more hands, more bumping). First pars (bot): apt 900, diner 1,400, forge 900, alch 900. The
  spawn tempo follows `PAR_N` as well, so a full party is busy, not bored.
- **Anti-AFK**: `p.coopIdle` is when p last moved ≥ 16 px or did an accepted `coop_act`. At 45 s idle the gauge shows
  "zzz" and p gets a toast. At 90 s idle, or with `p.coopPts < 0.15 × team average` at the end, p is **not
  eligible** for the reward (the report card says "근무 태도 불량 — 보상 없음"). Eligible members always get the
  same grade.

### C.4 동동아파트 청소 (apt; C1)

Template `jobtpl_apt` (30×16): four rooms (8×5 each, 2×2 grid) above a corridor along the south. Each room opens
onto the corridor through a 2-tile doorway. The 소각로 `(` is at the corridor's west end, the 재활용함 `)` at the east
end, and the tool rack `&` in the middle. Start tiles are around the rack. The farthest room corner is ≤ 14 tiles
from either chute (≈ 3.5 s at ×1.4).

| entity | spawns | behaviour | broom | bin |
| --- | --- | --- | --- | --- |
| 쓰레기 더미 `pile` | every `7 s / PAR_N` in the room with the fewest messes (seeded tiebreak), on a free tile | still; hp 3 | 1 sweep = hp −1; at 0 it becomes a `bundle` there | — |
| 먼지구름 `dust` | 25 % of spawns | drifts 6 px/s, bounces off walls; unswept for 40 s → splits in two (cap 6) | 2 sweeps → small `bundle` | — |
| 묶은 쓰레기 `bundle` | from sweeps | still | — | pick up (1 slot) |
| 바퀴 `roach` / 쥐 `rat` | 1 per 20 s / PAR_N, cap 3 + n (roach 60 px/s, rat 45 px/s) | wander with short pauses; flee a player within 48 px; a rat that touches a bundle tears it back into a pile | hit in a 30 px / 100° arc → stunned 5 s | pick up a stunned pest (1 slot); after 5 s it wakes and flees fast (+20 % for 5 s) |

- **The broom alone can't remove anything** (owner). Only bins score. Bin capacity **5**; a full bin refuses pickups
  (red gauge). At the 소각로 everything is dumped: `pts = Σ (bundle 10, pest 15) × (1 + 0.1·(count − 1))`. At the
  재활용함 only bundles are taken (×1.5); with a pest in the bin it refuses ("벌레는 소각로로!"). Credit: the bin
  holder gets 60 %, and each sweeper/stunner whose work is in the load shares 40 % (every bundle and pest remembers
  who made it).
- **Mess meter** `mess = 2·piles + dust + 2·pests + bundles`; cap `10 + 4·n`. Above the cap a **민원** fires every
  10 s: −20, combo 0, 동동 shouts on the HUD.
- Priority in `interact`: broom → stun a pest in the arc > sweep a pile/dust; bin → chute > stunned pest > bundle.
- Sounds: `sweep`, `bundle_tie`, `pest_squeak`, `pest_stun`, `bin_pick`, `bin_dump` (big clatter), `recycle_ding`,
  `complaint_buzz`.

### C.5 쥬쥬식당 주방 (diner; C2)

Template `jobtpl_diner` (22×14): in the north kitchen, crates `1` fish · `2` veg · `3` meat · `4` bread, chopping
boards `[` ×2, stoves `{` ×3, a trash can `(`. A counter run `m` with the pass `|` (3 slots) splits the kitchen from
the dining room. One 2-tile gap beside the sinks `}` ×2 lets people through. The dining room has 6 tables `o` with
chairs `k`; the rack `&` stands by the gap.

| recipe (unlocks at shift time) | steps | base pts |
| --- | --- | --- |
| 채소 샐러드 (0:00) | veg → board (4 chops) → plate at the pass | 20 |
| 생선구이 (0:00) | fish → board (4) → stove 6 s → plate | 30 |
| 고기 스튜 (1:30) | meat → board (4) and veg → board (4) → both into one stove pot → 8 s → plate | 45 |
| 쥬쥬 버거 (3:00) | meat → board → stove 6 s; bread (no chop); both put on one plate at the pass | 40 |

- **Cook (pan/ladle)**: pick from a crate (one thing in hand), put it on a board and chop (each `coop_act` = 1 chop,
  4 chops), take it to a stove. Doneness: `cookAt + 6 s` done → `+6 s` "탄다!" warning (the stove blinks) → `+5 s`
  burnt (smoke; −5, combo 0; the burnt food must go in the trash). Taking it: plating needs a **clean plate** from
  the pass stack. The plated dish sits in a pass slot.
- **Server (tray)**: takes up to **2 dishes** from the pass and serves a table whose order matches ("주문과 다른
  요리예요" otherwise). The customer eats 6 s and leaves 1 dirty plate per dish; the table stays blocked until it is
  cleared. The tray carries either dishes or up to **3 dirty plates**, never both. At the sink, each `coop_act` is one
  scrub, 3 scrubs per plate, and each clean plate goes onto the pass stack.
- **Customers**: active tables `min(6, n + 2)`. A new party sits at an empty, clean table every `16 s / PAR_N` (first
  at 0:03) with a menu bubble. Patience is 70 s (55 s in fever), shown as a bar that goes green → yellow → red.
  Serving pays `base × (1 + 0.5·patienceLeft/patience) × mult`, split cook 50 % (the plater) / server 50 %. When
  patience runs out the customer leaves angry: −15, combo 0, and the table frees itself with no plate.
- Clean plates at the start: `n + 2`. With none left the pass refuses plating ("깨끗한 접시가 없어요!"); that is
  why washing matters.
- Priority: pan → board with your item > stove > pass > crate > trash; tray → table > pass > sink.
- Sounds: `order_bell` (new customer), `chop`, `sizzle`, `burn_alarm`, `plate_clink`, `serve_ding`, `wash_scrub`,
  `customer_happy`, `customer_angry`, `fever_start`.

### C.6 캉캉대장간 단조 / 보글연금공방 가마 (forge and alch; C3, one engine)

Template `jobtpl_forge` (18×12): iron crate `1`, furnace `<` (2 bars), anvils `>` ×2, quench barrel `;`, order
chute `:`, rack `&`. The chalkboard `^` on the back wall shows the orders, which also appear on the HUD.

- **Orders**: 3 visible. A new one comes every `30 s / PAR_N`, with a deadline of 100 s. Kinds: 편자 (6 strikes, 40
  pts), 괭이날 (8, 55), 검날 (10, 70), 냄비 (8, 55; it needs 2 heats). The kinds are seeded.
- **Furnace temperature** `T` 0–100 loses 4/s. Each `coop_act` by the **tongs/bellows** holder on the furnace pumps
  +9 (one per 300 ms). The good band is 60–80. A bar in the furnace heats +12/s inside the band and +4/s below it.
  Above 90 it scorches (quality −1 per 2 s). A bar at heat 100 glows "hot" and stays hot 12 s out of the fire.
- **Tongs** carry: crate → furnace → (hot) anvil. Placing a hot bar starts the anvil's beat: period 750 ms (600 ms in
  fever), first beat 1 s after placing; the event `["cb", anvilId, beatAtMs]` lets clients draw the ring.
- **Hammer**: each `coop_act` at the anvil is judged against the nearest beat when it arrives: |Δ − p.lat| ≤ 160 ms
  **perfect** (+2 quality), ≤ 320 **good** (+1), otherwise **miss** (−1). `p.lat` is the median offset of the
  player's last 5 strikes, clamped to ±150 ms, so a steady ping is calibrated out. Once it has the order's strikes,
  the piece is shaped. If the bar cools first, the tongs must reheat it. The hammer holder quenches at the barrel
  (one act, hiss) and delivers at the chute to a matching open order.
- **Piece grade** from quality q vs strikes N: 걸작 q ≥ 1.6N (×1.6) · 상 ≥ 1.0N (×1.3) · 중 ≥ 0.4N (×1.0) · 하
  (×0.5). pts = `base × grade × (1 + 0.3·deadlineLeft) × mult`; credit tongs 45 % / hammer 55 %. A missed deadline
  costs −20 and resets combo.
- **보글 skin** (`jobtpl_alch`, `COOP.alch.skin`): furnace → 가마 (fan `fan` keeps the heat), iron crate → 약재 선반
  (herb basket in the order's colour), anvil → 가마솥 (paddle `paddle` stirs on the beat), quench → 병입대, chute →
  납품 선반. Orders: 빨간 물약 / 파란 물약 / 엘릭서 / 묘약 (2 heats). Rules and numbers are identical, so it costs one
  table plus art.
- Sounds: `bellows_puff` / `kiln_whoosh`, `furnace_roar` (band entered), `anvil_perfect`, `anvil_good`,
  `anvil_miss`, `quench_hiss` / `bottle_pop`, `order_done`, `order_late`.

### C.7 Rewards (once a day per job and character; owner's list, proposal numbers)

On `end`, for every **eligible** member (present at the end, not AFK) whose `coopDone` does not include k (after the
lazy reset `coopDay !== dayOf(now)` → `coopDone = []`, `coopDay = today`):

| grade | XP | gold | gear (`rewardGear(S, p, T, minQ)`) | 강화석 | life XP (matching skill) | extra |
| --- | --- | --- | --- | --- | --- | --- |
| C | `tierXp(T)·0.08` | `40·T` | minQ 0 | 1 | `lifeNeed(L)·0.30` | rep +5 with the owner |
| B | ·0.14 | `60·T` | minQ 1 | 2 | ·0.45 | |
| A | ·0.20 | `80·T` | minQ 1 | 3 | ·0.60 | |
| S | ·0.28 | `110·T` | minQ 2 | 5, 25 % +1 축복 강화석 | ·0.80 | first S ever in this job: cosmetic (쥬쥬 앞치마 · 동동 고무장갑 · 캉캉 두건 · 보글 고글) |

- T = `toTier(ch.lvl)`; L = the member's level in the matching skill: diner → `cook`, forge → `craft`, alch →
  `alch`, apt → `deliver` (proposal; question G.4). Below C ("근무 평가 미달") pays a tip `10·T` gold and 10 % of the
  life XP, and does not use up the day, so the party can retry.
- Helpers (k already in `coopDone`) get a tip `15·T` and life XP ×0.25 only. That lets friends help without being
  farmed.
- Economy (economy-designer view): at most 4 × 110·T = 440·T gold a day (T 10 → 4,400 G, T 40 → 17,600 G ≈ 25
  min of band-level hunting) and 4 × 0.28 = 1.12 old levels of XP. That is below a day of 차원 균열 (3 × 0.5).
  These are the "paycheck" and the life-skill booster, not a replacement for hunting. Gear is one roll per clear,
  rare at S, never legendary or set (`rewardGear` `minQ ≤ 2`).
- Achievements: `coop1` (first clear), `coopS4` (S in all four, title "만능 알바생"), counters `cnt.coop`, daily
  task kind `coop` (L2/C1 append).

### C.8 Anti-exploit checklist

- Every number lives on the server: tools, holds, stations, scores. Proximity is checked against the server-side
  position (the existing `mv` correction). Nothing a client reports is trusted except the aim, which only orders
  candidates.
- There are no items inside: dishes, bundles, bars and plates are instance state, so nothing can be duped or traded
  out. `use` is limited to potions and food; recall = leave.
- Rate limits: `coop_act` 250 ms, pumps 300 ms, 3 scrubs per plate, 4 chops per item, pickups need the hand state.
- Rewards: once per job per day, only for members who are eligible (C.3). The cut-offs are fixed at the starting
  party size, so dropping members does not make the job easier. Helpers get tips only. Two accounts of one person
  can still team up. That is accepted; the payout per character is capped anyway.
- Instances: one per party at a time (`party.coop`), cap 6 per channel, hard `expire`, empty → closed in 20 s.
  Tests assert there are no leftover `coop_*` keys in `S.maps`.
- Determinism: all spawns and choices come from `dim.coop.box` (seeded). The same seed and the same action script
  give the same score (test).

### C.9 Template maps (editor data — recommended)

- `data/maps/jobtpl_apt.json`, `jobtpl_diner.json`, `jobtpl_forge.json`, `jobtpl_alch.json`: theme `interior`,
  `safe: true`, a new optional field `"tpl": "coop"`. MAP_META marks them `tpl`; no `links.json` entry may point to
  them; door labels and the warp list skip them. They also carry `"coop": {"start": [[x, y]…4], "rooms": [[x0, y0,
  x1, y1]…]}` (apt rooms; diner `dining` rect).
- **Station furniture characters** (proposal; L1/C1 confirm they are free in `GET /api/palette`): `&` tool rack,
  `(` trash / 소각로, `)` 재활용함, `1 2 3 4` crates, `[` chopping board, `{` stove, `}` sink, `|` pass, `<` furnace /
  가마, `>` anvil / 가마솥, `;` quench barrel / 병입대, `:` order chute. `coopStations(m)` scans the object layer once
  (memoised) into `[{id, kind, tx, ty}]`. The stations are solid furniture, interacted with from a neighbouring tile.
- **data:check rules** (Korean): each template has its job's required stations (apt: `& ( )`; diner: `& 1 2 3 4 [ { }
  | ( o`; forge/alch: `& 1 < > ; :`); every station has a reachable neighbour tile; 2–4 `start` tiles are reachable;
  every station is ≤ 14 tiles (path) from a start tile. `tests/coop.mjs` repeats this for the shipped files.
- Why editor data and not code: the owner tunes kitchens visually in an editor that already exists; the interior art
  (walls, rugs, lamps) comes free; the files are small. Cost: one new field (`tpl`), 12 furniture characters, and
  validation, all covered by data:check and tests.

### C.10 Wire (compact, appended; the client decoder changes in the same commit)

- `out.cj` only inside a co-op map, at most every 500 ms or when it changes: `[kIdx, state 0..3, secsLeft, score,
  combo, mult×10, grade 0..4 (-,C,B,A,S), nextCut, a, b]`, where `a/b` is the job's summary (apt: mess, cap ·
  diner: waiting orders, clean plates · forge/alch: furnace T, open orders).
- `out.C` only when `dim.coop.ver` changed (and with `sendMap`): the entities `[[id, type, tx|x, ty|y, st, msLeft,
  extra]…]`. Types cover table/customer (recipe, patience ms), board/stove/sink/pass state, pile/bundle/dust,
  order, anvil. `msLeft` counts down on the client, so patience bars and stoves never need per-tick updates.
  Budget ≤ 600 B per change.
- `out.Q` every tick, moving things only (pests, dust): `[[id, kind, x, y, stun01]…]`, ≤ 10 entries.
- `me` and `P` entries append `tool, holdCode, holdN, prog` only inside co-op maps (missing = 0). `who` appends
  `tool` (0 outside), so the client draws the tool instead of the weapon. Setting `rt.who` on swap resends it.
- Events: `["cj", code, x, y, a]` (sounds/fx: 1 serve, 2 bell, 3 wash, 4 sweep, 5 bin dump, 6 stun, 7 burn, 8 angry,
  9/10/11 strike perfect/good/miss, 12 quench, 13 deliver, 14 fever, 15 complaint, 16 chop, 17 pump), `["cb", id,
  beatAtMs]`, and the report `["cr", grade, score, best, [[eid, pts, toolIdx, eligible]…]]`. Rewards use the
  existing `p.gain` popup and toasts.
- `defs().coop = {jobs: {k: [name, mins, tools, par]}, cuts: [.3, .5, .7, .88], parN, recipes (diner), orders
  (forge/alch), tools: {id: name}}`.

### C.11 Client: rendering, HUD, audio

| piece | file | notes |
| --- | --- | --- |
| tool sprites (broom, bin, pan, ladle, tray with stacked plates, tongs with glowing bar, hammer, fan, paddle; sickle, pick, axe for gathering) | new `public/tools.js` (`toolSprite(id, hold)`), drawn where `weaponSprite` goes | code-drawn 16–24 px, one shadow tone, dark outline (pixel-art rules) |
| strokes | `swing.js`: `sweep` (low flat arc), `strike` (overhead), `chop` (short taps), `scrub`, `pump`, `stir` | reuse the stroke timing table |
| carry gauge | `scene2d.js` over the head, under the name: 5 pips (bin), 2/3 slot icons (tray), a progress bar (chop/scrub/channel), "zzz" when idle | 2-px tall bars, GBA palette |
| customers | `coop.js` draw list: townsfolk NPC sheets (`sprites.js`) with seeded looks, seated pose (`iso_interior drawPose`), menu bubble with a 12×12 dish glyph, patience bar | angry: red puff and stomp-off walk |
| stations | `iso_interior.js` new furniture for the 12 characters; overlays from `C` (pan contents, flame, smoke when burning, board chop marks, plate stack count, furnace glow by T, anvil beat ring) | glow rules as in sky.js (no blur) |
| mess and pests | `coop.js`: piles (3 sizes by hp), tied bag, dithered dust puff (2-frame), roach 8×6 and rat 10×7 hell-cute (too many legs, one big eye) | stunned: spinning stars |
| HUD | `index.html #coop-hud` (top centre, `frames.js` brass 9-slice): `[⏱ 6:00 | 점수 1,240 ×1.4 | C▮B▮A▮S gauge with the next cut-off tick | 주문 3 · 접시 2]`; fever turns the frame red-gold and the clock pulses | `hud.css`; `client.js` `onSnap` `cj/C/Q` 3 lines → `coop.js` |
| report card | `#w-coop` modal: the grade stamp (big pixel letter), score vs cut-offs, per-member points and role, "보상 없음" lines, then the reward popup (existing `gain`) | sound `grade_reveal` per letter |
| lobby card | talk window of an NPC with `coop` (`client.js` talk handler + `coop.js renderCoopCard`) | |
| audio | `audio.js`: the SFX listed in C.4–C.6, `TRACKS.coop` (bright chiptune, 132 bpm) chosen by the template `bgm`; fever = `Music.tempo(1.25)` (add if missing) + `fever_start` sting | `IMPORTANT`: bell, burn, complaint, fever |

---------------------------------------------------------------------------------------------------------------

## D. Sheet v11 (L1; one bump after J1's v10) and migration

`+ life {6 × {lv, xp}}, jobBoard {day, done, active}, rep {}, coopDay, coopDone [], pouch {}` · `v: 11`.

| field | `newChar` | `migrate` (idempotent; also clamps v11 sheets) |
| --- | --- | --- |
| `life` | each `{lv: 1, xp: 0}` | from v10: `fish.xp` = `ch.fish × 8` and `cook.xp` = `cnt.cook × 10`, both run through `gainLife` (cap Lv 20); every key `lv 1..50` int, `0 ≤ xp < lifeNeed(lv)`; unknown keys dropped |
| `jobBoard` | `{day: 0, done: [], active: null}` | `done`: strings that are `JB` ids, ≤ 3, unique · `active`: `{id ∈ JB, npc ∈ NPC ids, prog int ≥ 0, expAt ≥ 0}` or null; a deliver job loses its parcel on load (`prog 0`, so it can be picked up again) |
| `rep` | `{}` | keys ∈ static NPC ids, values int 0..100, zeros dropped |
| `coopDay` | `0` | int ≥ 0 |
| `coopDone` | `[]` | unique members of `COOP_KINDS`, ≤ 4 |
| `pouch` | `{}` | keys whose `ITEMS[id].type` is `lmat` (or `staple`/`flask`), `n` int 1..999 |

Tests: `content.mjs` gets a v10 sheet (with fish/cook counters) → v11, a messy v11 sheet, and "run twice = same".
`data.mjs` keeps its v7 → current walk.

---------------------------------------------------------------------------------------------------------------

## E. Glossary for implementers (to avoid name clashes)

- J1's `job` (모험가, 대검전사…) is the combat job. Part-time jobs are **알바** in Korean and `jb`/`jobBoard`/`coop` in
  code. Never call them "job" in identifiers or UI text.
- J1's `st` = the six stats and `cnt` = counters: life counters go into `cnt` (`gat`, `craft`, `deliver`, `coop`).
- 차원 균열 instances are `dim:<n>`; co-op instances are `coop_<k>_<partyId>`. Both use the same registry, and
  "instance" means either.

---------------------------------------------------------------------------------------------------------------

## F. Implementation plan (phases, ownership, tests)

Order: **J1 → L1 → (L2 ∥ C1) → C2 → C3**. C1 also needs Phase 2 merged (ready check). J2/J3 may run in parallel:
L/C touch `70/75` only by appending cases, and `client.js` only through `onSnap` lines and window hooks.

**L1 — life core, sheet v11, buildings shell** (one agent, after J1 merges)
- New parts: `12-life-tables.js` (`LIFE LIFE_NAME LIFE_MAX lifeNeed GRADE_LV RXP`, grade map by tier, material and
  fish items appended to `ITEMS` in a loop, `RECIPES` with the cooking rows only) and `58-life.js` (`gainLife
  lifeRoll lifeTime gradeOfMap lifeClean`). Edits: `40` `newChar`/`migrate` (v11 fields of D, all of them, so later
  phases never bump), `75` `reel`/`cook` (XP, grade fish, bonuses), `90` `self.life` + `defs().life`, `36`
  `NPC_ROLES` += `cook craft alch jobs` and NPC field `coop` passed through `fromEditor`.
- Town: the `buildTown()` block (C.1), `links.json` doors, 4 lobby interiors with owner NPCs (services stubbed: the
  talk lines say "곧 문을 엽니다"), `big.t: "apt"` + shop-sign art in `scene2d.js`, `iso_interior.js` station
  furniture (the art can follow in L2/C1; the characters must exist for data:check).
- Client: `life.js` (생활 window, read-only bars), `#menu` button, `onSnap` `life`, cache tag. AGENTS.md file map:
  new parts, `life.js`, the lobbies.
- Tests: new `tests/lifeskills.mjs` (in `tests/LIST`): `lifeNeed` golden values, `gainLife` multi-level and event,
  `lifeRoll` table of B.2, fishing grade table per map and XP, cooking threshold by level, `cook` alias; `content.mjs`
  migration rows; `world.mjs`: town doors in/out of the 4 lobbies, nothing collides with the obelisk tiles.

**L2 — gathering, crafting, alchemy, delivery, 알바 board, rep** (after L1; parallel with C1)
- Parts: `12` (`RECIPES` full, `JB`, `JB_ROUTES`, `REP_PERK`, items `stone_b punch whet el_* fd_* staple flask ing_*`),
  `58` (`lifeNodes`, `lifeTick`, gather/craft/jb logic, `jbOffers`), `70/75` append `gat gat_tap craft_open craft jb`,
  extend `enh` (`b`) and `use` (`punch whet el_*`), `50 addItem` pouch routing (one branch), `60` ACH + `DAILY_OTHER`
  kinds `gather craft`, `80 tick` one line `lifeTick`, `90` `jb rep pouch nodes ng`, `deriveStats` speed line (with
  J1's owner), `data/npcs.json`/`town_hall.json` (포포), lobby NPCs get their real roles and `goods`.
- Client: `life.js` (station and board windows, nodes, channel), `minigames.js` (`forge`, `brew`), `tools.js`
  (sickle/pick/axe), `decor.js` node sprites, `audio.js` SFX, `art.js buildIcons` (materials by grade tint, new
  items), cache tag.
- Tests: `lifeskills.mjs` + nodes (deterministic per seed, count bounds, reachable, clearances, 4× map count), gather
  (range, own cooldown, grade lock, interrupt, tap window, seeded 대성공), craft (station, inputs exactly consumed,
  fee, success/fail halves, 대성공, batch rule, `ms` minimum), gear craft rarity bounds, `stone_b` never downgrades,
  `punch` cap, delivery (pick, deadline, speed factor, death fail), board (same offers per name/day, 3/day,
  06:00 boundary, rep clamp, perk unlock), **economy guard** (B.7), pouch (routing, 999 cap, warehouse).

**C1 — co-op engine + 동동아파트** (after L1 and Phase 2)
- Parts: `14-coop-tables.js` (`COOP`, `PAR_N`, `CUTS`, `COMBO_MS`, rewards table, tools), `66-coop.js` (engine C.2/
  C.3, `coopTick`, rewards, apt state machine C.4). Edits: `40` `INST_RE` + `home` in `registerDim`/`closeDim` +
  `party.coop` (with Phase 0's owner), `64-dim.js` `rc.map`/`rc.kind` (with Phase 2's owner), `70/75` append
  `coop_start coop_tool coop_act coop_leave coop_join`, refusals of combat/life actions inside, `80 tick` one line,
  `90` `cj C Q`, `me/P/who` appends, `36` `tpl` + `coop` template fields, `scripts/editor-lib.mjs`/`data-check.mjs`
  rules (C.9), `data/maps/jobtpl_apt.json`.
- Client: `coop.js` (HUD, report card, lobby card, apt draw lists), `tools.js` broom/bin, `swing.js` strokes,
  `scene2d.js` hooks (carry gauge, tool in hand, draw lists), `index.html` `#coop-hud #w-coop`, `hud.css`, `audio.js`
  (apt SFX, `TRACKS.coop`, tempo), `iso_interior.js` furniture art, cache tag, AGENTS.md map.
- Tests: new `tests/coop.mjs`: 2-player party entry (ready check → `coop_apt_<id>`, both moved, tools rotated,
  weapons hidden, `atk` refused); solo / non-leader / outside lobby / cap / already in an instance refused; sweep →
  bundle → bin → 소각로 scores, broom alone never scores, bin cap 5, recycling refuses pests, stun 5 s and wake,
  a rat tears a bundle, mess complaint; combo, fever ×1.5, grade cut-offs for n = 2/3/4; **once-a-day reward**
  (second clear the same day pays only the helper tip, again after 06:00 KST); below C keeps the day; AFK member
  ineligible; leave/disconnect/rejoin; instance closed 60 s after end and 20 s when empty, no leftovers; same seed +
  script = same score; `cj` ≤ 40 B and `C` ≤ 600 B. A **bot crew** (scripted, 350 ms reaction) reaches S at n = 2/3/4;
  one working bot + idle partners stays below B. These two results set `par`.

**C2 — 쥬쥬식당** (after C1): `67-coop-diner.js` (C.5), rows in `14`, `data/maps/jobtpl_diner.json`, client draw
lists (customers, dishes, stations), `tools.js` pan/ladle/tray, SFX. Tests in `coop.mjs`: cook → serve chain (each
dish), wrong dish refused, burn timing, plate economy and sink, tray capacity and dishes-xor-plates, role refusals
(a tray can't chop, a pan can't serve), patience → angry, the menu unlock times, bot-crew par for the diner.

**C3 — 캉캉대장간 / 보글연금공방** (after C1; parallel with C2 if two agents, since the files are separate):
`68-coop-forge.js` (C.6 with the `skin` table), `jobtpl_forge.json`, `jobtpl_alch.json`, client stations/overlays,
`tools.js` tongs/hammer/fan/paddle, SFX. Tests: furnace decay/pump/band, heat rates and scorch, hot-bar cooling,
beat judging with a fixed fake latency (calibration converges, clamp ±150), quality → grade, quench + deliver to the
matching order, deadline penalty, the alch skin runs the same script to the same score, bot-crew par.

**Conflict map**: `70/75` (J1, Phase 2, L2, C1 each append at the end, keep all) · `40` (`migrate` only in L1;
`registerDim`/`closeDim` lines only in C1) · `90` (append fields; rebuild, never hand-merge `logic.js`) · `buildTown`
(Phase 2's block and L1's block are separate) · `client.js` (`onSnap` lines + talk handler hooks only; the logic lives
in `life.js`/`coop.js`) · `index.html` (new sections) · `audio.js` (append SFX keys). Every phase: `npm run
test:rules`, `npm run data:check`, one targeted screenshot for art (`shot.mjs --page scene --map juju_diner`, a
`_coop.html` preview page with a fake `C`/`Q` feed in C1), cache tag, AGENTS.md map.

---------------------------------------------------------------------------------------------------------------

## G. Open questions for the owner (implementers use the default unless told otherwise)

1. **The truncated life-skill spec.** Everything tagged (proposal) in B (nodes, recipes, grades, delivery, board
   rules, rep tiers) fills the missing part. Default: build B as written. If the lost text defines different
   recipes or a different board, it replaces the matching tables only. The engine (`gainLife`, `lifeRoll`,
   `RECIPES`, `JB`) stays.
2. **Stamina.** The owner's text mentions "less time/stamina", but the sheet fields have no stamina. Default: **no
   stamina bar**; time cuts and per-node cooldowns pace gathering. If wanted later, a `life.sta` pool that refills
   at campfires slots into `lifeRoll` without another bump.
3. **재료 주머니 (pouch).** Default: yes, as B.10 (one extra sheet field `pouch` in the same v11 bump), because a
   30-slot bag cannot hold 15 material kinds.
4. **Which life skill 동동아파트 feeds.** The six skills have no "cleaning". Default: `deliver` (배달 = odd jobs and
   errands); alternative `gather`.
5. **Reward size and helpers.** Default: the C.7 table (≤ 440·T gold and ≤ 1.12 old levels of XP a day for all four
   jobs at S, below a day of 차원 균열), helpers who already cleared that job today get a tip only. The bot-crew test
   sets `par`, so the C/B/A/S cut-offs are measured, not guessed.

---------------------------------------------------------------------------------------------------------------

## H. L1 as built (deviations and contracts only)

- **Sheet v12**, not v11 (housing took v10, J1 v11). One bump carries every field of D: `life jobBoard rep coopDay
  coopDone pouch`; L2/C1 never bump for them. `migrate` → `lifeSheetClean` (58-life.js) runs last, after `cnt` is
  cleaned; old sheets get 낚시 `ch.fish × 8` and 요리 `cnt.cook × 10` XP through `lifeAdd` capped at Lv 20. `JB` is
  an empty table and `COOP_KINDS = ["apt","diner","forge","alch"]` lives in `12-life-tables.js` (C1 may move it).
- **Town scope dropped** (the town redesign owns buildings, doors, interiors): L1 only adds the NPC roles `cook craft
  alch jobs` (talk-only, "곧 문을 엽니다" lines in `public/npctalk.js`, names in the editor's role list). The NPC field
  `coop` is not passed through yet (C1).
- **Fish**: grade-3/4 fish `fish_c` 은빛 메기 (220 G) and `fish_v` 동굴 장님고기 (400 G) got **campfire dishes**
  `food_c` 은빛 메기 구이 (HP 450, 12 min xp +10 % atk +3 %) and `food_v` 장님고기 꼬치구이 (HP 800, 15 min xp +12 %
  atk +5 %), between the old 송어/잉어 dishes — the client cooks any fish by `ITEMS[id].cook`, and the cook ladder
  now has one dish per grade (Lv 1/10/20/30/40). L2's stove rows (`fd_*`, staples) are not in `RECIPES` yet.
- **Catch split** (`FISHING`, `fishLand`): candidates `FISH_G[0..cap−1]`, cap = min(map grade, angler grade);
  황금 잉어 `0.01 + 0.07k² + 0.001L` first (any grade), then top `0.1 + 0.3k` (cap ≥ 2), next `0.2` (cap ≥ 3), stone
  `0.04`, else 송사리. On a grade-5 map the top candidate is 황금 잉어 (≈ 45 % at k = 0.8, Lv 40). The meadow is
  grade 1, so it no longer gives trout (tests/life.mjs adjusted). 대성공 = 2 fish (stones never), XP
  `RXP[g] × (0.5 + s/100)`, ×1.5 on 대성공, ×0.25 when the fish's grade unlocked 20+ levels below.
- **Cooking** keeps every fish cookable at any level (no level gate, as before); `cook {id, s}` goes through
  `fishRecipe` → `RECIPES[ITEMS[id].recipe]` → `cookDish`. A burnt pan gives no XP. ×1.5 XP on 대성공 as in B.1.
- **Map grade**: `gradeOfMap` = an editor map's optional `"grade"` (1–5, read by `fromEditor`; the editor does not
  show it yet) else the first tier of its band against `GRADE_TIER = [1, 8, 14, 24, 40]`; `defs.life.mapGrade`
  carries it for every map (town 1, willow 1, meadow 1, forest/crypt 2, city/sewer 3, cave/abyss 4, maple 5).
- **Wire**: `self.life` (dirty only), `defs().life = {keys names max need grades gradeName rxp stale roll unlock fish
  fishing cooking recipes mats mapGrade}`, event `["lv2", eid, k, lv]`. Not yet: `jb rep pouch nodes ng`.
- **Client**: `public/life.js`, the 생활 window `#w-life`; no free letter key, so **Shift+L** (L alone stays 의뢰) and
  the `#menu` button with the `life` sprout glyph. The level-up sound reuses `achieve` (audio.js untouched).
- Tests: `tests/lifeskills.mjs` (in LIST after `life`), old-sheet rows v9/v10/v11 + a messy v12 + idempotence in
  `content.mjs`; every `v === 11` assertion now says 12.

---------------------------------------------------------------------------------------------------------------

## H2. L2 rules as built (contracts for the client agent; deviations)

The server half of L2 is in `12-life-tables.js` / `58-life.js` (+ one line or branch each in 34 40 45 50 60 70 75 80
90). No sheet bump (v12 carries every field). The client half (station and board windows, node sprites, the channel
bar, `forge`/`brew` mini-games, SFX, icons) only has to draw and ask, as below.

**Map payload** `map.nodes = [[kind, grade, tx, ty]…]` — kind 0 약초 · 1 광맥 · 2 통나무, grade 1–5 (= the map's grade),
tile coordinates; the array index is the node id. Only hunting grounds (not safe maps, not instances): 8–60 per map
(one per 150 open tiles: meadow/forest/maple 60, city 54, cave 42, abyss 43, sewer 37, crypt 32), placed once from
the map id (`lifeNodes`, ≈ 5–10 ms on first use). A node is not solid; you stand on it.

**Snapshot** `ng = [nodeIdx…]` — this map's nodes *this player* has spent (each waits `NODE.cd` = 5 min per player),
sorted; sent on arrival and whenever the list changes (an empty list when the last one is back). Draw those as
harvested for this player only.

**self** (only when dirty, appended after `life`):
- `jb = [day, offers, doneIds, active]` — `offers` ≤ 4 rows `[id, kind, npcName, text, gold, skIdx]` (kind `bring` ·
  `make` · `fish` · `deliver`; `gold` before a delivery's tip, with the 단골 +10 %; `skIdx` into `LIFE`); `doneIds`
  today's finished template ids (≤ 3); `active` = `0` or `[id, prog, n, secsLeft]` — `prog` 0 = to do / pick up,
  1 = carrying a parcel; `n` items to hand in (0 for deliveries); `secsLeft` only while carrying (count down locally).
- `rep = [[npcId, 0..100]…]` (only non-zero) · `pouch = {itemId: n}` (materials incl. ingots, `staple`, `flask`;
  ≤ 999 each) · `cnt` gains `gat craft deliver` · `spd` already includes the parcel factor (predict with it).

**Events** (in `ev`): `["gs", eid, kind, ms]` gathering started (pose + channel bar of `ms`) · `["gt", eid, 700]` 반짝!
(tap now; the server accepts `gat_tap` up to 700 + 250 ms after it) · `["ga", eid, kind, r]` r = 0 done, 1 대성공,
−1 interrupted · `["mk", eid, recipeId]` a station mini-game may start (`RECIPES[r].mg` = `pan` / `forge` / `brew`;
it must run at least `ms × (1 − 0.008·L)` before `craft`) · `["mo", eid, recipeId, best]` craft result 0 failed (or
burnt) / 1 made / 2 대성공 (batch: the best of the batch) · `["dl", eid, c]` c = 1 parcel picked, 2 an 알바 handed in
(any kind), 0 parcel lost · `["e", eid, 1]` after a punch/whetstone (reuses the enhancement flash) · `["u", eid, 2]`
an elixir drunk · `["lv2", …]` unchanged. Gains arrive in `gain` as before (`["item", id, n, q]`, `["gold", n]`).

**defs().life additions**: `nodes {kinds:["h","o","w"], names, cd, ch, range, tap}`, `mg {at: [mg, ms]}`, `craft {batch:10,
batchS:70, batchD:20, failXp}`, `bless` 10, `gearCraft {q:[1,2]}`, `jb {id: {kind, npc, lv, sk, item?, n?, to?, text,
npcName, toName}}`, `jbPay`, `rep {tier:[10,30,60], name:["단골","친구","가족"], disc, tip, perk}`, `pouch {max, ids}`,
`master` (Lv-50 titles); `recipes` = 84 rows `{id, sk, lv, at, in, out, fee, mg, ms, any?, rep?, eq?, gear?}` —
`at` fire (any campfire or 쥬쥬's stove) · cook (쥬쥬의 화덕) · craft (캉캉) · alch (보글); input/output `"rune*"` = any
rune (`ru_mix`: three of your most plentiful runes + `m_h5` → one random rune); `any` = an L1 fish dish (any level,
pan rules); `rep` = needs that NPC's trust ≥ 30; `gear` = no batch, comes 마법/희귀.

**Actions** (Korean errors in `error`):
| action | where / when | effect |
| --- | --- | --- |
| `gat {i}` | within 24 px of node `i`, ready for you, 채집 Lv ≥ grade's unlock, not hit for 3 s, room for 2 | channel `2400 × time` ms; breaks on > 6 px movement, a hit taken or struck, sitting, fishing, death, map change |
| `gat_tap {}` | while gathering | the first tap only; inside the window → +15 %p 대성공 |
| `craft_open {r}` | at the station, recipe known, inputs, fee, room | `p.mk`, event `mk` |
| `craft {r, s}` | after `craft_open {r}` and its minimum time; `s` 0–100 | one craft (fee only on success; a failure gives back ⌊n/2⌋ of each input, half XP) |
| `craft {r, n}` (no `s`) | batch: life Lv ≥ recipe + 20, n 1–10, not gear, not L1 fish | n crafts scored 70 |
| `cook {id, s}` | unchanged (L1 alias) | — |
| `jb {a:"take", id}` | near 알바 중개인 포포 (`role: "jobs"`, town hall); an offer of today, not done, none active, < 3 done | `active` |
| `jb {a:"pick"}` | delivery, prog 0, near the sender | parcel, `prog 1`, deadline `path / (48·0.85) × 1.8 + 20 s`, speed × (0.85 + 0.006·L) |
| `jb {a:"give"}` | near `npc` (deliveries: `to`) with the items (bag + pouch) or the parcel in time | pay, trust, `done` |
| `jb {a:"drop"}` | anywhere | the job (and parcel) dropped, not counted |
| `enh {k, b:1}` | as `enh`, plus a `stone_b` | +10 %p; a failure at +5 or more keeps the step |
| `use {id:"punch", k}` · `use {id:"whet", k}` | `k` an equipped slot | +1 socket up to 3 (gloves/boots 1, jewellery none) · the weakest affix rerolled (no duplicate key) |
| `use {id:"el_*"}` | — | the scroll's buff for 15 min (`el_all` all three, 20 min; `el_spd` the ×1.4 speed buff 60 s); never shortens a running one |
| `sell {pid, n}` · `wh {a:"put", pid, n}` | at a shop · at 도담 | from the pouch (`wh take` and `buy` refill the pouch through `addItem`) |
| `buy` | unchanged shape | 5 % off at a counter whose keeper counts you a 단골 (trust ≥ 10) |

**NPCs** (data): `kangkang` 캉캉 (`craft`, forge (11,6)), `bogle` 보글 (`talk` → `alch`), `bogle_shelf` 빈 병 선반 (thing,
`shop`, goods `flask`), `juju_stove` 쥬쥬의 화덕 (thing on the stove, `cook`), 쥬쥬 keeps `shop` and sells `staple`,
`popo` 알바 중개인 포포 (`jobs`, town hall (4,9)). The client should drop the "곧 문을 엽니다" lines for `craft alch cook
jobs` and open the station / board windows.

**Numbers (B.7 guard, enforced by `lifeskills.mjs`)** — inputs at sell value + fee against the shop: stone 90/150
(0.60), camp 72/120, potions ×3 0.60 each, elixirs against their scrolls 0.60 (`el_all` 0.80 of all three), feather
0.84, 산딸기 파이 0.60, 여관 스튜 0.67, tier-2 gear against 무쇠's counter 0.63–0.84; no non-gear recipe sells for more
than its inputs + fee. Faucets: the board (≤ 3 a day) pays 30 + 6·L gold (deliveries 20 + 4·L + up to 50 % tip;
+10 % for a 단골), at most ≈ 1,100 G a day at Lv 50, and lifeNeed(L)·0.25 life XP per job.

**Deviations from B**
- **No new cosmetics.** The Lv-50 and 가족 cosmetics need wardrobe art (client/art phase); Lv 50 in each skill gives
  a title (`life50_<skill>`, 명인 낚시꾼 …), trust 60 gives "<NPC>의 단골" (`rep_<id>`); plus `life10`, `life30`,
  `gat100`, `craft50`, `deliver20`. Daily kinds `gather` / `craft` joined `DAILY_OTHER` (rolls change from the next reset).
- **Elixirs = scroll strength, longer** (the stats read the scrolls' `pct`); B.6's 12 % / 14 % were not used. 들꽃
  주먹밥 gives xp +4 % atk +2 % (food has no defence buff).
- **Fees raised to meet the guard**: stone 60 G (B.6 said 40 → 70 G < 90 G), camp 42 G, potions/elixirs as above;
  주먹밥/꼬치 sell prices lowered so a cook → sell loop never pays. L1 campfire fish dishes are exempt (`any`).
- **Stations**: 쥬쥬 stays a shop (her counter keeps working on today's client); the stove is a `cook` thing; flasks
  come from a shelf thing in the lab instead of 보글's own `goods` (roles other than `shop` carry no goods).
- **Runes have no tiers**: 룬 변환 is three runes → one random rune. **Gear rarity** caps at 희귀 ("cap 3" read as
  "never 전설").
- **Delivery**: routes are computed on first use (`jbRoute`, memo `JB_ROUTES`), 27–94 tiles (39–86 s); no Lv-40
  단풍 왕도 route (that map is built lazily); Lv 25 routes are 쥬쥬 → 동동 and 캉캉 → 보글. Board XP is B.9's
  `lifeNeed(L)·0.25` for every kind; gold for deliveries is B.8's.
- **Offers** are drawn once per session-day (`p.jbOff`), so a level gained at noon does not reshuffle them.
- **Perks** (proposal filled in): 모카 → 산딸기 파이, 마루 → 여관 스튜, 캉캉 → `stone_x2` (two stones a craft), 보글 →
  elixirs +5 min, 쥬쥬 → +10 %p 대성공 at her stove. Editor maps' optional `"nodes"` list is not wired.

---------------------------------------------------------------------------------------------------------------

## H3. L2a client as built (gathering + pouch; deviations only)

`public/gather.js` (logic) + `public/gatherart.js` (art), wired from client/net/events/input/actions/update; the
contract is H2's, unchanged. Notes for L2b/L2c:
- **Nodes** are scene props (`S3.props` keys `gn<i>`, made in `Gather.loadMap` after scene2d's) at the server's own
  spot `(tx·16+8, ty·16+10)`; spent ones (`ng`) draw a cut tuft / a picked rock / a stump. The node in reach (range
  − 2 px, ready or not) names itself on the existing F prompt (`#prompt`, only when no NPC is nearer), with
  "(다시 자라는 중)" or "(채집 Lv.N 필요)"; those two are refused on the client with the server's own words, so no
  request is sent. No minimap marks for nodes yet (radar.js untouched).
- **Asking**: F or a click/tap on the node's sprite (out of reach: walk there, start on arrival). Auto-hunt is
  switched off when a channel starts. While a channel runs, F / Space / a click in the world / the `#gat-tap` button
  are the tap, and never an attack or a talk. **Every** tap is sent (once), so an early tap is the player's one
  miss — the client does not filter to the window (only the first 250 ms after the start are ignored, the starting
  press bouncing). The channel bar reuses the recall scroll's `#cast` (`G.cast = {start, end, name, gat}`).
- **Others**: `gs`/`ga` with another eid put that player in the pose (`e.gat`) and a small bar over their head
  (drawn by the node's prop); the node is found as the nearest of that kind within range + 8 px.
- **Pose**: no tool sprite; the hero crouches at a herb and dips on each beat at a vein or log, facing the node,
  with chips/sparks/leaves (`fx.burst`) and a sound (`gat_work`) every 480 ms.
- **Pouch**: shown under the bag (`#inv-pouch`, folded state per place in `lumentale:pouch:<where>`) and under the
  생활 window's cards. At a shop a click sells one, Shift+click all (`sell {pid, n}`). Icons for all 22 pouch goods
  (`m_*`, `ing_*`, `staple`, `flask`) are code-drawn (`matIcon`); preview `_gather.html`.
- Gains of pouch goods also float over the head (`+들꽃잎 ×2`). 대성공 shows "대성공!" and its own sound.

## H4. L2b client as built (stations + mini-games; deviations only)

`public/station.js` (window, flow) + `minigames.js` `forge`/`brew`, wired from actions/events/hud; the contract is
H2's, unchanged. Notes for L2c:
- **One window** `#w-craft` (WIN id `craft`) for all four stations, titled by kind; no menu button or hotkey — F at
  캉캉 / 보글 / 쥬쥬의 화덕 opens it (their "곧 문을 엽니다" lines are replaced by station tips), and it closes itself
  once you are > 72 px from that role's NPC (a campfire: `fireNear()` or the stove). With no NPC near, F tries a
  node, then a **campfire** (요리 window), then water — so F at a fire by a lake no longer casts; step away to fish.
- **Lists**: `craft` · `alch` show their `at`; the stove shows `cook` + `fire`; a campfire `fire` only. The L1 fish
  dishes (`any`) sit in a "생선 구이" band and are made through `craft_open`/`craft` too (the bag's double-click
  `cook` alias still works). Another class's weapons are hidden, as at the shop. Bands are the five grades.
- **Odds** shown are `lifeOdds` at score 50 mirrored on the client (쥬쥬's +10 %p perk is not shown); the minimum
  time is `ms × (1 − roll.time·L)` from `defs`, not a hard-coded 0.008.
- **Timing**: the clock starts when `mk` arrives; the score is sent at the earliest `mk + min + 250 ms` (a "마무리하는
  중…" toast if the game ended sooner). No `mk` within 3 s (a refusal) gives the 만들기 button back.
- **Mini-games**: `pan` is L1's `cooking` (Esc still scores what is in the pan); `forge` = five blows on a swinging
  heat bar (100/75/40/5 by distance to a band that narrows and moves); `brew` = hold to raise a needle, keep it in a
  wandering green band for `max(5 s, min + 1.2 s)`, score = time inside. Esc in forge/brew sends nothing (the
  server's `p.mk` just waits for the next `craft_open`).
- **Results**: `mo` plays `craft_great` / `craft_ok` (`dish_done` for pan) / `craft_fail` and floats "대성공!" /
  "실패…" over you; the result toast is the server's. Anyone's 대성공 sparkles over their head; others' `mk` is
  ignored (no pose).
- `nearestNpc` gives station roles (`craft alch cook`) the same −14 px counter bias as a shopkeeper: without it 쥬쥬 (goods)
  always won over her own stove; now the stove is the F target from its side of the counter.
- The 생활 window now counts 제작 and 연금 as open (배달 waits for L2c).

## H5. L2c client as built (알바 board, delivery, trust; deviations only)

`public/board.js`, wired from actions/update/hud/events/life/win_shop/client; the contract is H2's, unchanged.
- **Board** `#w-board` (WIN id `board`, no menu button or hotkey): F at 포포 opens it, and the 생활 window's 알바 card
  has an "알바 게시판 보기" button, so it can be read anywhere; 맡기 is enabled only within 52 px of 포포 (the server's
  56), otherwise greyed with "포포 곁에서 맡을 수 있습니다". It never closes itself. Offers show kind tag, NPC, text,
  gold (+ "팁 최대 50%" for deliveries), skill Lv and where (deliveries: sender → recipient); done ones grey out; done
  ids no longer offered are listed under "오늘 끝낸 알바". 포포 has editor `lines`, so `npctalk.js` `jobs` lines (now
  board tips) only speak for an NPC without them.
- **Where**: defs carry no NPC → map table, so `HOME` in board.js maps the 18 알바 NPC ids to their map ids (names
  from `defs.maps`; "(여기)" when the NPC is on this map). A new 알바 NPC needs a row there (else no place is shown).
- **Hand-ins**: F at the NPC the job wants next (sender to pick up, recipient to hand over, the giver for
  bring/make/fish when bag + pouch hold enough) sends `jb pick`/`jb give` before that NPC's own window (shop,
  station); the prompt reads "<이름> — 알바: 꾸러미 받기 / 꾸러미 전하기 / <아이템> ×n 전하기". Without the items F opens the
  NPC as usual. A talk-role NPC's talk window shows the job card with the same button (disabled with have/need).
- **Parcel**: `#dl` sits 28 px above `#cast` (same look, brown; red under 10 s), counting down from the latest
  `secsLeft` (resynced on every new `self`). A 12×10 code-drawn parcel bobs over the carrier's head (S3 hook).
  Others are known only from `dl` events seen while on their map (no snapshot field), so someone already carrying
  when you arrive shows no parcel. `dl`: 1 `item` sound + "꾸러미!", 2 `quest` + "알바 완료!" + sparkle, 0 `fail` +
  "배달 실패…" (the toasts are the server's).
- **Trust**: `repBadge` = tier tag (낯선 사이 / 단골 / 친구 / 가족) + a bar with marks at 10/30/60 + "신뢰 n", the tooltip
  lists what each tier gives (perks from `defs.life.rep.perk`); shown only for NPCs some 알바 names. In the talk
  window (`#talk-rep`), the shop header (`#shop-rep`), and the 생활 window's 신뢰 list. A 단골's shop prices show the
  old price struck and `floor(price·n·disc)` (as `buyCost`); the station window has no badge.
- **Tracker**: the job in hand is listed first (before the main quest): its text up to the first "." / "!", a
  have/need bar for item jobs, and "→ <NPC> · <map>".
- Verified live (wrangler dev, fresh account): take at 포포, 마루 → 다리 delivery end to end (pick, 44 s, speed 48 →
  41, door walk, give: +31 G, trust 다리 3 / 마루 1), take a bring job. The 단골 price look and the talk card were
  checked with client-side staged state only (trust 12 and a fake job), not by the server.

## H6. As built — board v2 (grades, 긴급, hunts, scouting, situations; no sheet bump, v19)

- **Grades** per offer from `strHash(name:day:id:g)`: 쉬움/보통/어려움 (odds 45/35/20) — items or kills ×1/×1.5/×2 (rounded up), parcel clock ×1/×0.8/×0.65, scouting map `map[grade]`; gold, life XP, trust ×1/×1.6/×2.5 (`JB_GRADE`).
- **긴급** (`JB_RUSH`): 1 non-delivery offer in 4, and every `rush` row: finish within `min` (15, or the row's) minutes for gold ×1.5; late still pays the base. Deadline in `active.expAt`.
- **New kinds**: `hunt` (kill n of `mob`; `lv` = character level; the starting kill count kept in `active.prog`, read from `ch.mk`), `scout` (walk onto the map, report back; `prog` 1). 27 new rows over 17 NPCs (13 new to the board: `HOME` rows added in board.js).
- **Situations**: `when` night/rain rows are never drawn; one per situation is added while it holds in the town (re-sent when it changes); a taken one stays. `rep` rows need that trust with the NPC (단골 10 / 친구 30).
- **Mix**: each draw prefers a kind not drawn yet. Wire (appended): offers `[…, grade, need, rushMin]`, active `[…, rushSecs (−1 missed), got]`; defs `jbGrade`, `jbRush`. The `#dl` bar also counts down 긴급.
- Economy: the board's ceiling rises to ≈ 4,000 G/day at life Lv 50 (어려움 × 긴급 × 단골), but 어려움 also asks twice the goods.

## H7. As built — co-op v1 (shared engine + 동동아파트 청소; deviations and contracts only)

- **Engine** `68-coop.js` (66 is charms): a shift is a `dim:<n>` instance with `dim.coop` (registerDim/closeDim like the story arena; 64-dim.js and 40 untouched, so no `coop_*` ids and no `home` on the record — `c.home`). Numbers: `12-life-tables.js` `COOP COOP_T COOP_TOOLS COOP_APT`.
- **Start**: `coop_start {k}` within 56 px of the owner in the lobby (`dongdong_apt` → 관리인 동동). **1–4 players** (owner's v1 order; solo allowed, `parN[1] = 0.6`); a party's leader starts it and every member in the lobby comes along. **No ready check** (Phase 2's `rc` is town-bound in 64-dim.js), no `coop_join`. Cap 6 shifts and `DIM.max` rooms.
- **Map** (v2, bigger for 4): built in code from `COOP.apt.tpl` (45×19 interior through `fromEditor`, 574 open tiles ≈ 2.4× v1): eight flats (10×6, a 2-tile door each) north and south of a 3-tile corridor; 소각로 `<` (1,9) at its west end, 재활용함 `w` (43,9, ×1.5) at its east end, 44 tiles apart, rack `>` (22,9) in the middle; existing furniture only.
- **Play** (brief 8 s → 5:00 → last 60 s fever ×1.5 → report, home after 30 s): an opening spread of `3 + 3n` piles (6 · 9 · 12 · 15) over the flats, then a pile every `pileMs[n−1]` = 9 · 5 · 3.6 · 2.8 s, at most `8 + 6n` at once; piles hp 3, broom sweeps → bundle; the bin (5) carries to a chute, `10·n·(1+0.1(n−1))`, credit 60 % bin / 40 % sweepers. A pile left 40 s spreads. **낡은 소파** (shifts of 2+, every `45 s / parN`): two players act within 1.5 s, 4 times → 3 bundles. Mess `2·piles + bundles + 3·sofa` over `16 + 8n` → 민원 −20 every 10 s. Tool swap = `coop_act` at the rack (no per-tool stock). No pests or dust yet.
- **Actions** `coop_start {k}`, `coop_act` (250 ms), `coop_leave`. **Wire**: `cj` [job, state, secs, score, combo, mult×10, grade, next cut, mess, cap, [[eid, tool, held, zzz]…]], `C` [[id, 0 pile·1 bundle·2 sofa, x, y, hp]…], `cr` [grade, score, best, [[name, pts, tool, ok]…], cuts]; events `["cj", code, x, y, a]`; `self.coop` (paid today); `defs().coop`. Nothing on `me`/`P`/`who`: tools are drawn from `cj`.
- **Cut-offs** `par · parN[n] · cuts` with a job’s own `parN` (apt: par 1000, parN 0.28 · 2.0 · 3.8 · 4.5 → S at 246 · 1,760 · 3,344 · 3,960). Tuned on walking bots in `tests/coop.mjs` (BFS paths at the shift’s ×1.4 player speed, an act every 300 ms): 1–4 bots score 265 · 1,960 · 3,846 · 4,414, just over S; a real party at 60–80 % of a bot lands on B–A. Solo is slow by design (one worker swaps tools). Retune after playtests.
- **쥬쥬식당 서빙** (C.5 v1, `k: "diner"`, started at 쥬쥬 in `juju_diner`; numbers `COOP.diner`, `COOP_DINER`): a 44×24 map (832 open tiles) — a kitchen along the north wall (stoves `:` ×3, boards `-` ×2, crates 채소/생선/고기, trash), a counter with a 4-tile pass, the rack and two doors, and a hall of 12 tables (3 × 4, 4–16 tiles from the pass). Tools **프라이팬** (cook) / **쟁반** (server), rotation pan·tray; alone you swap at the rack. Dishes: 채소 샐러드 (veg → 4 chops, 20) · 생선구이 (fish → stove 6 s, 30) · 고기 스튜 (meat → 4 chops → stove 8 s, 45; ordered from 1:30). A pot burns 8 s after it is done (−5). Plated dishes wait on the pass (6 max); a tray carries 2 to the table that ordered them ("주문과 다른 요리예요" otherwise): `pts × (1 + 0.5·patience left)` × mult, cook 50 % / server 50 %. By party size 1–4: tables ordering at once 3 · 4 · 6 · 8, a new order every 16 · 12 · 8 · 6.5 s (n at the open), patience 90 · 75 · 70 · 65 s (×0.8 in fever); a customer who runs out leaves angry (−15, combo 0); a served table eats 6 s before the next. Cut-offs par 1000 × parN 0.48 · 1.0 · 2.4 · 3.0 (walking bots 464 · 992 · 2,390 · 2,965, just over S). No plates to wash, no burger, no big two-carrier order yet. Wire: `cj[8..9]` = served, missed; team rows gain `what` (dish·3 + stage); `C` rows 3 order [.., dish, ds left, ds patience] · 4 pot [.., dish, ds to done, ds to burnt] · 5 plated [.., dish]; events 30–40; `defs().coop` gains hint, stations, dishes, cook, trayCap. Reward skill `cook`, trust with 쥬쥬.
- **Rewards** as C.7 (`deliver` skill, rep +5 with 동동, `rewardGear` at T = ⌊toTier⌋), without the S cosmetic, the 25 % 축복 강화석, achievements and the daily task. AFK = 90 s without a step or an accepted act, or < 15 % of the team average.
- **Client** `public/coop.js` (props, `#coop-hud`, lobby card `#coop-card`, report `#coop-res`, Space/F captured inside); one hook line each in `client.js`, `net.js` (`onSnap`), `events.js`.
- **Left**: the diner’s plates/washing, burger and two-carrier orders, 캉캉대장간 / 보글연금공방 (C.6), pests/dust, ready check + `coop_join`, editor templates (C.9), tool sprites (`tools.js`), sounds and the coop BGM, S cosmetics and achievements.
