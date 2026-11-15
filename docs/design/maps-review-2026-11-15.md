# Maps and level design review — 2026-11-15

Owner's order: review the terrain of every map, widen the grounds that are cramped, develop them, and extend the
level design over Lv 1–200. Character balance is a separate task. Numbers below are from the built rules
(`atlas(true)`, `defs()`, `mapStats()`), shown levels (internal × 4 − 3).

Contents: 1 table · 2 verdict per map · 3 level design by band · 4 what was applied · 5 next steps · 6 the second pass.

## 1. Every map (after this pass)

walk = reachable tiles · dens = regular monsters per 1,000 walkable tiles · kinds = monster kinds incl. regional/boss ·
ms = cold build time on one core (the `maps` test holds each ground under 150 ms warm, dunesea 400).

| map | band | size | walk | open % | mobs | dens | kinds | mob Lv | stones | NPCs | fires | pockets | courts | camp | doors |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 버드나무광장 town | safe | 100×76 | 3,949 | 52 | – | – | – | – | 1 | 17 | 2 | – | – | – | meadow city willow + 13 interiors |
| 버드나무 마을 willow | safe | 70×56 | 2,368 | 60 | – | – | – | – | 1 | 15 | 1 | – | – | – | town |
| 바람초원 meadow | 1–25 | **152×102 → 160×120** | **11,687 → 14,716** | 75 | 781 | 67 | 6 | 1–25 | 3 | 1 | 2 | 2 | – | yes | town forest |
| 속삭임 숲 forest | 29–49 | **152×102 → 160×116** | **11,274 → 13,339** | 72 | **790 → 932** | 70 | 8 | 29–49 | 3 | 1 | 2 | 3 | – | yes | meadow cave crypt maple |
| 뼈의 지하묘지 crypt | 45–65 | **132×102 → 148×112** | **8,294 → 10,615** | 64 | **1,197 → 1,615** | 152 | 7 | 45–61 | 3 | 1 | 2 | 3 | – | – | forest city |
| 네온 시티 city | 53–81 | **152×102 → 160×120** | **8,111 → 10,133** | 53 | 813 | 80 | 8 | 53–81 | 3 | 2 | 2 | 3 | – | – | town sewer crypt jungle |
| 정글 해안도로 jungle | 77–101 | 168×112 | 12,400 | 66 | 857 | 69 | 6 | 77–101 | 3 | **0 → 1** | 2 | 5 | – | yes | city coast |
| 하수도 sewer | 85–105 | **152×102 → 160×120** | **9,260 → 11,580** | 60 | 1,555 | 134 | 7 | 85–101 | 3 | 1 | 2 | 4 | – | – | city cave |
| 수정 동굴 cave | 93–125 | 132×100 | 8,454 | 64 | 754 | 89 | 8 | 93–113 (+boss 125) | 3 | 1 | 3 | 3 | – | – | forest abyss sewer oasis cloudtemple |
| 산호 해안 coast | 101–125 | 176×120 | 14,519 | 69 | 981 | 68 | 6 | 101–125 | 3 | **0 → 1** | 2 | 2 | – | yes | jungle oasis dunesea |
| 모래바람 오아시스 oasis | 109–133 | 168×116 | 15,242 | 78 | 1,010 | 66 | 7 | 109–133 | 3 | 1 | 2 | 2 | – | yes | coast cave dunesea mesa airship |
| 운해 사원 cloudtemple | 117–141 | 176×128 | 14,509 | 64 | 979 | 68 | 8 | 117–137 (+boss 141) | 3 | **0 → 1** | 2 | 4 | 4 | yes | cave mesa |
| 모래바다 dunesea | 121–145 | 288×192 | 45,297 | 82 | 3,107 | 69 | 7 | 121–145 | 5 | **0 → 1** | 3 | 5 | – | yes | oasis coast |
| 피의 심연 abyss | 125–157 | 152×120 | 10,700 | 59 | 1,289 | 121 | 9 | 125–149 (+boss 157) | 3 | 1 | 2 | 5 | – | – | cave maple |
| 붉은바위 황금궁 mesa | 141–165 | 184×124 | 15,927 | 70 | 1,065 | 67 | 9 | 141–165 | 3 | **0 → 1** | 2 | 3 | 4 | yes | cloudtemple oasis |
| 단풍 왕도 maple | 157–197 | **160×112 → 196×136** | **12,151 → 18,583** | 70 | **864 → 1,322** | 71 | **9 → 11** | 157–197 | **3 → 5** | 1 | 2 | **2 → 5** | – | yes | forest abyss frostkeep |
| **먹빛 호수 inklake (new)** | 157–181 | 176×120 | 15,890 | 75 | 814 | 51 | 7 | 157–177 (+field boss 181) | 3 | 1 | 2 | 2 | 2 | yes | mesa maple |
| 성에왕의 성채 frostkeep | 197 (Lv 200 only) | 96×64 | 2,579 | 42 | 153 | 59 | 4 | 197 | 3 | 1 | 2 | – | – | – | maple |
| 바람등호 airship | safe (Lv 100) | 50×32 | 699 | 44 | – | – | – | – | 1 | 4 | – | – | – | – | oasis |
| 13 interiors | safe | 14×10 … 22×18 | 83–244 | 59–69 | – | – | – | – | – | 1–8 | 0–2 | – | – | – | town |

Every hunting ground already has: zones by the walk (safe / normal / elite / hidden pockets with a chest and a
guard), signposts, three stones with a wind shrine past each later one, a plaza fire, gathering nodes scaled by open
tiles (`lifeNodes`, 8–60), regional beasts on the first six, vault set-pieces and ruins. What differs is size, how
much of it is a corridor, and whether anybody lives there.

## 2. Verdict per map

| map | verdict | why |
| --- | --- | --- |
| town, willow, interiors | keep | dense, every tile used; 17 + 15 NPCs |
| meadow | **pen built, widened** (§6) | the only ground for Lv 1–25, now 160×120 with the ram pen (`cfg.pen`) holding the deep ram packs (`hunt-routes`). |
| forest | **widened** (§6) | 152×102 for Lv 29–49 next to a crypt that is denser. Every size from 156×120 to 160×124 tried makes the gorge's ways too straight (tortuosity < 1.12) or narrows a chest route; scale `gorge.every` with the height first. |
| crypt | **widened** (§6) | densest ground (144/1k), 8.3k tiles. At every larger size the catacomb's elite `guard` lands inside the (larger) safe plaza. Keep guards out of zone 0, then widen to ~152×118 (and point the `lifeskills` "below NODE.max" check at a smaller ground). |
| city | **widened**; POIs next | was 52 % open, 8.1k tiles, four doors, its ossuary door fixed to tile (129, 72). `corridorGate` now takes fractions and steps to the nearest open hallway, so the city grew to 160×120 (10.1k tiles); `trail_clock`, `city_dotol` re-placed by the east gate. Still the least open field: add a market square. |
| jungle | keep, **NPC added** | big enough; a road map with five pockets. No NPC before; no main quest. |
| sewer | **widened** | 9.3k → 11.6k tiles, plazas and loops held (`mapflow` green). |
| cave | widen later | 8.5k tiles with five doors (the busiest junction). Same fixed-door blocker (`drain` at 10,34). |
| coast | keep, **NPC added** | no NPC before; no main quest (`content-audit` §1.4). |
| oasis | keep | caravan camp + airship signal NPC. |
| cloudtemple | keep, **NPC added** | five levels, four courts; no NPC before. |
| dunesea | keep, **NPC added** | biggest ground; the oasis village has a fire but no villagers yet. |
| abyss | keep | dungeon, dense by design. |
| mesa | keep, **NPC added** | four courts; no NPC and no main quest before. |
| maple | **widened + restructured** | the only ground for 40 levels (157–197) had 12k tiles and two empty level steps. |
| frostkeep | keep | hand-laid endgame arena. |

Monotony at the default camera: the open grounds read well (biomes, tiers, rivers, vaults every ~1,200 tiles); the
flattest stretches are the meadow's top shelf and the dunesea's crests (by design: open sand). Dungeons read as
rooms and ways; the crypt is the one that feels crowded rather than monotonous.

## 3. Level design by band

Regular monster kinds per internal level step (1 step = 4 shown levels), and kills of an even-level monster per
character level (`lvt` ÷ average `xp` of kinds within ±4 levels; relative, before party and buffs):

| band | grounds | kinds per step | kills / level | verdict |
| --- | --- | --- | --- | --- |
| 1–25 | meadow (+ town, willow) | 1 (Lv 5 empty) | 48 → 170 | one ground; fine for a tutorial band, but it is the first impression — widen meadow |
| 26–60 | forest, crypt, city from 53 | 1–2 | 170 → 430 | thin but adjacent; widen forest and crypt |
| 61–100 | city, jungle, sewer, cave | 2–4 | 430 → 1,300 | enough ground; side quests are the gap (4), not maps |
| 101–150 | coast, oasis, cloudtemple, dunesea, abyss, mesa | 3–4 | 1,300 → 1,600 | richest band: six overlapping grounds; add main quests to coast and mesa, nothing new on the map |
| 151–200 | maple, **inklake** (+ frostkeep at 200) | **0–1 → 1** | 1,600 → 1,800 → 1,250 | the real gap: one ground for 40 levels, Lv 177 and 189 had no monster; `inklake` (maps-batch2) is the planned second ground |

Pacing note for the balance task: kills per level peak at Lv 161–177 (~1,800) and drop to ~1,250 at 189–197
because `bogcrown`/`hollowowl`/`rootwarden` jump from 2,200 to 3,100–3,950 xp. The two new kinds sit on that curve
(1,980 at 177, 3,320 at 189); the jump itself is a balance call.

## 4. Applied in this pass (commit "Maps: widen 단풍 왕도 and 하수도 …")

- **단풍 왕도** 160×112 → 196×136 (walkable 12,151 → 18,583, +53 %): loops 0.12 → 0.2, vaults 10 → 14, ruins 4 → 6,
  lakes 2 → 3, five named stones (숲 어귀 · 단풍 숲길 · 금빛 숲 · 무너진 성문 · 얼음 왕릉 앞), pockets 2 → 5. The frost
  keep's door was a hallway door fixed to tile (137, 81) of the old layout; it is now the `ice` gate on the south
  edge at 0.86, where the inner kingdom freezes (main quest "단풍 왕도 남동쪽" still holds).
- **Band gap fixed**: `shroomboar_frost` 서리 버섯등 멧돼지 (Lv 177) and `crowscare_frost` 서리 까마귀 허수아비 (Lv 189),
  frost-tinted bodies of maple kinds (no new art), with lore. Placed by the walk like the rest: deeper than 묘지 장미
  and before 검은 왕관 뿌리짐승, and between 뿌리짐승 and 왕릉 파수꾼. Lv 153–197 now has a regular monster at every step.
- **네온 시티** 152×102 → 160×120 (8,111 → 10,133 walkable); `corridorGate` takes fractions, so the ossuary door
  follows the layout instead of a fixed tile; the two NPCs by the east gate re-placed in `data/npcs.json`.
- **하수도** 152×102 → 160×120 (9,260 → 11,580 walkable). 160 is the editor's size cap (`editor/validate.js`).
- **Camp keepers** (`CAMP_KEEPERS`, 34-maps-world.js): the maple hermit moved into the table; a field merchant stands
  by the camp fire of 정글 해안도로 (길잡이 망고), 산호 해안 (조개잡이 소라), 모래바다 (대상 몰이꾼 사막), 운해 사원
  (순례자 무명) and 붉은바위 황금궁 (협곡 짐꾼 바위), each with two lines about the ground's route and danger and
  `goods` = medium/large potions, 귀환, 모닥불, 부활 깃털. All five are in the NPC registry (`defs().npcMap`), so a
  later side quest can name them as givers.
- Tests: `maps` size pins; `hunt-routes` checks every level step 153–197, the frost kinds' order along the route,
  maple's five stones and the five keepers; `world` keeps dunesea at least twice any other ground (was 2.4×).

Checked with before/after world views of maple and sewer (`shot.mjs --page world --map <id> --full`, not committed).

## 5. Next steps (one agent task each)

1. ~~Fixed hallway doors~~ done: `corridorGate` takes fractions of the map and finds the nearest open hallway
   (city and cave lay out exactly as before at their old sizes; the city then grew).
2. **Widen the cave** (rules, S): unblocked, but it is the slowest field to build (~80 ms quiet); try ≤ 148×112 and
   watch the `maps` time budget. Add a market square / plaza POI to the city.
3. ~~**Crypt guard placement**~~ done (§6) (rules, S): keep the elite `guard` out of zone 0, then widen the crypt to ~152×118.
4. ~~**Meadow ram pen**~~ done (§6): the pen holds the ram herd and the meadow is 160×120.
5. ~~**Forest gorge spacing**~~ done (§6) (rules, S): scale `gorge.every` with the map height, then widen to 160×116.
6. **Second ground for Lv 151–200** — rules/terrain step done (§6); art step next (rules + art + world map, M): build `inklake` 먹빛 호수 from `maps-batch2.md`
   (Lv 153–180, south ↔ mesa north, north ↔ maple south). Maple's south edge already carries the `ice` gate at 0.86;
   put the inklake gate west of it (≈ 0.3). Its "first monster at tier 45" is now `shroomboar_frost` on maple, so
   inklake's own kinds can sit at 46–47 instead.
7. **Quests on the new keepers** (data, S): coast and mesa have no main quest; give each keeper one side quest
   (content-audit P4) and villagers to the dunesea oasis village.
8. **Pacing** (balance task): smooth the xp jump at Lv 185–197 noted in §3.

## 6. Applied in the second pass (commits "Maps: 먹빛 호수 …", "Maps: widen 속삭임 숲 …", "Maps: widen 뼈의 지하묘지 …")

- **먹빛 호수 `inklake`** (maps-batch2 §6, rules/terrain step): 176×120, 15,890 walkable, 75 % open, DENSITY 17 (51
  monsters per 1,000 tiles: the quietest field). A `wilds` lake whose ground is walkable shallows `~`; nine ink pools
  `w` ringed by grey sand bars and islet chains (rock Θ, pine Σ, bramble) are the barriers; the islets, plum banks,
  pool rims and the landing are dry ground so the set pieces can stand. Regions by place, south to north: A 나루터
  (camp, 나루지기 먹선 sells field goods, stone 1), B 거울 여울, C pine islets / D red plum banks (a pagoda court, stone
  2 "붉은 매화 둔덕", kept by the rare 흰 꼬인 여우), E reed mist (elite), F ink pools (pockets), G the lone pagoda isle
  (the belltower court, stone 3 "외딴 탑 섬", field boss 먹빛 날개 구렁이 Lv.181, trophy). Doors: south ↔ the mesa's new
  north door, north ↔ the maple's new `ink` door on its south edge west of the frost keep's (both `doors` cut into the
  finished grounds: neither layout moved). Six kin of existing bodies, one per level step 157–177 (먹 거머리 아가리,
  먹빛 다리 달린 생선, 먹빛 겹날개 두루미, 인면 먹나방, 매화 손가락 거미, 붉은 묘지 매화), grade-5 gathering, fishing,
  world-map pin, mob lore. Band [40, 46] (Lv 157–181). Theme `mist` for now: the art step (ink palette for `~`/`w`,
  blossom tree, moon gate, the new bodies 매화 거미 / 먹빛 이무기, the rare-spawn rule) is still to do.
- **속삭임 숲** 152×102 → 160×116 (11,274 → 13,339): the gorge keeps three crossings at the new height
  (`gorge.every` scaled with it) and grows windier (wind 0.9, loops 0.16): tortuosity 1.27 / 1.23 / 1.17, no narrow way.
- **뼈의 지하묘지** 132×102 → 148×112 (8,294 → 10,615): `zoneSpawns` steps any guardian or chest a generator stood on
  the quiet ground round a door to the nearest hunting ground (the catacomb's guard room by the way out). 152×118 and
  156×114 lose their pockets; 148×112 holds stones, pockets and every mapflow rule. The rubbing keeper moved to the plaza.
- **바람초원**: `cfg.pen` [kind, from] makes the deep part of the elite ground one kind's pen; the meadow's rams hold its
  deep 55 % (83 rams, all past the elite line, at the old size). 160×120 passes `maps`, `mapflow` and `hunt-routes`
  with the pen. The balance probes (`balance`, `skills3`, `hammer`) now measure in a fixed arena of their own
  (`scripts/balance-probe.mjs` `arena()`: ARENA laid flat over the meadow, no cell spawns, rolls from `ARENA.seed`,
  skills3's monsters of fixed kinds), so the meadow grew to 160×120 (11,687 → 14,716 walkable; ram spawns 41 → 33,
  `hunt-routes` still finds 8+ ram packs past the elite line); 울타리지기 마루 moved from (9, 46) to (9, 55) beside the re-centred west gate (60).
- Tests: `maps` size pins, `mapflow` (inklake held, 16 loops), `hunt-routes` (mesa → inklake → maple legs, the lake's
  order and rare fox, its keeper), `world` (doors both ways, courts, field boss ground, band), `lifeskills` (grade 5; the
  "below NODE.max" check on the frost keep), `trophies`. Two tests were coupled to the ground list: `social-actions`
  now starts the meadow runtime it steps onto, and the `dimrift` balance run starts between two world events (which
  ground the half-hourly event picks shifted its draws once a ground was added).
- World views (not committed): `game/shots/maps2-inklake.png`, `maps2-forest-before/after.png`,
  `maps2-crypt-before/after.png`, `maps2-meadow-before.png` and `maps2-meadow-160x120-trial.png`.
