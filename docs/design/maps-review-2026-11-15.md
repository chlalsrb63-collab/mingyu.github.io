# Maps and level design review — 2026-11-15

Owner's order: review the terrain of every map, widen the grounds that are cramped, develop them, and extend the
level design over Lv 1–200. Character balance is a separate task. Numbers below are from the built rules
(`atlas(true)`, `defs()`, `mapStats()`), shown levels (internal × 4 − 3).

Contents: 1 table · 2 verdict per map · 3 level design by band · 4 what was applied · 5 next steps.

## 1. Every map (after this pass)

walk = reachable tiles · dens = regular monsters per 1,000 walkable tiles · kinds = monster kinds incl. regional/boss ·
ms = cold build time on one core (the `maps` test holds each ground under 150 ms warm, dunesea 400).

| map | band | size | walk | open % | mobs | dens | kinds | mob Lv | stones | NPCs | fires | pockets | courts | camp | doors |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 버드나무광장 town | safe | 100×76 | 3,949 | 52 | – | – | – | – | 1 | 17 | 2 | – | – | – | meadow city willow + 13 interiors |
| 버드나무 마을 willow | safe | 70×56 | 2,368 | 60 | – | – | – | – | 1 | 15 | 1 | – | – | – | town |
| 바람초원 meadow | 1–25 | 152×102 | 11,687 | 75 | 781 | 67 | 6 | 1–25 | 3 | 1 | 2 | 2 | – | yes | town forest |
| 속삭임 숲 forest | 29–49 | 152×102 | 11,274 | 73 | 790 | 70 | 8 | 29–49 | 3 | 1 | 2 | 3 | – | yes | meadow cave crypt maple |
| 뼈의 지하묘지 crypt | 45–65 | 132×102 | 8,294 | 62 | 1,197 | 144 | 7 | 45–61 | 3 | 1 | 2 | 3 | – | – | forest city |
| 네온 시티 city | 53–81 | 152×102 | 8,111 | 52 | 648 | 80 | 8 | 53–81 | 3 | 2 | 2 | 3 | – | – | town sewer crypt jungle |
| 정글 해안도로 jungle | 77–101 | 168×112 | 12,400 | 66 | 857 | 69 | 6 | 77–101 | 3 | **0 → 1** | 2 | 5 | – | yes | city coast |
| 하수도 sewer | 85–105 | **152×102 → 160×120** | **9,260 → 11,580** | 60 | 1,555 | 134 | 7 | 85–101 | 3 | 1 | 2 | 4 | – | – | city cave |
| 수정 동굴 cave | 93–125 | 132×100 | 8,454 | 64 | 754 | 89 | 8 | 93–113 (+boss 125) | 3 | 1 | 3 | 3 | – | – | forest abyss sewer oasis cloudtemple |
| 산호 해안 coast | 101–125 | 176×120 | 14,519 | 69 | 981 | 68 | 6 | 101–125 | 3 | **0 → 1** | 2 | 2 | – | yes | jungle oasis dunesea |
| 모래바람 오아시스 oasis | 109–133 | 168×116 | 15,242 | 78 | 1,010 | 66 | 7 | 109–133 | 3 | 1 | 2 | 2 | – | yes | coast cave dunesea mesa airship |
| 운해 사원 cloudtemple | 117–141 | 176×128 | 14,509 | 64 | 979 | 68 | 8 | 117–137 (+boss 141) | 3 | **0 → 1** | 2 | 4 | 4 | yes | cave mesa |
| 모래바다 dunesea | 121–145 | 288×192 | 45,297 | 82 | 3,107 | 69 | 7 | 121–145 | 5 | **0 → 1** | 3 | 5 | – | yes | oasis coast |
| 피의 심연 abyss | 125–157 | 152×120 | 10,700 | 59 | 1,289 | 121 | 9 | 125–149 (+boss 157) | 3 | 1 | 2 | 5 | – | – | cave maple |
| 붉은바위 황금궁 mesa | 141–165 | 184×124 | 15,906 | 70 | 1,065 | 67 | 9 | 141–165 | 3 | **0 → 1** | 2 | 3 | 4 | yes | cloudtemple oasis |
| 단풍 왕도 maple | 157–197 | **160×112 → 196×136** | **12,151 → 18,583** | 70 | **864 → 1,322** | 71 | **9 → 11** | 157–197 | **3 → 5** | 1 | 2 | **2 → 5** | – | yes | forest abyss frostkeep |
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
| meadow | **widen (next)** | the only ground for Lv 1–25. 156×124 and 160×120 pass `maps` and `mapflow` but leave fewer than 8 ram packs behind the elite line (`hunt-routes`); a heavier ram roster puts rams on normal ground. Needs a ram pen vault in the deep end, then widen. |
| forest | **widen (next)** | 152×102 for Lv 29–49 next to a crypt that is denser. Every size from 156×120 to 160×124 tried makes the gorge's ways too straight (tortuosity < 1.12) or narrows a chest route; scale `gorge.every` with the height first. |
| crypt | **restructure** | densest ground (144/1k), 8.3k tiles. At every larger size the catacomb's elite `guard` lands inside the (larger) safe plaza. Keep guards out of zone 0, then widen to ~152×118 (and point the `lifeskills` "below NODE.max" check at a smaller ground). |
| city | **widen + POIs (next)** | 52 % open, 8.1k tiles, four doors. Blocked by `corridorGate(m, "ossuary", 129, 72)` (a door fixed to one tile of this layout) and two `npcs.json` NPCs placed by the east gate. Make the ossuary an edge gate like maple's `ice`, re-place the two NPCs, then 160×120. |
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
| 151–200 | maple (+ frostkeep at 200) | **0–1 → 1** | 1,600 → 1,800 → 1,250 | the real gap: one ground for 40 levels, Lv 177 and 189 had no monster; `inklake` (maps-batch2) is the planned second ground |

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

1. **Fixed hallway doors → gates** (rules, S): city `ossuary` (129, 72) and cave `drain` (10, 34) as edge/auto
   gates, as done for maple; re-place `trail_clock`, `city_dotol` from the new gate positions. Unblocks 2.
2. **Widen city and cave** to 160×120 (rules, S) after 1; add a market square / plaza POI to the city.
3. **Crypt guard placement** (rules, S): keep the elite `guard` out of zone 0, then widen the crypt to ~152×118.
4. **Meadow ram pen** (rules, S): a deep-end vault that holds the ram herd, then widen meadow to 160×120.
5. **Forest gorge spacing** (rules, S): scale `gorge.every` with the map height, then widen to 160×116.
6. **Second ground for Lv 151–200** (rules + art + world map, M): build `inklake` 먹빛 호수 from `maps-batch2.md`
   (Lv 153–180, south ↔ mesa north, north ↔ maple south). Maple's south edge already carries the `ice` gate at 0.86;
   put the inklake gate west of it (≈ 0.3). Its "first monster at tier 45" is now `shroomboar_frost` on maple, so
   inklake's own kinds can sit at 46–47 instead.
7. **Quests on the new keepers** (data, S): coast and mesa have no main quest; give each keeper one side quest
   (content-audit P4) and villagers to the dunesea oasis village.
8. **Pacing** (balance task): smooth the xp jump at Lv 185–197 noted in §3.
