# 레벨 밴드 — 사냥터 권장 레벨 1–200 (level bands and the map roadmap)

Status: **design only — nothing here is built.** Owner's decision (2026-11-15): do not re-band the existing maps and
do not change rules, monster levels, quests or tests now; build more maps first, balance the hunting grounds after.
This doc is (1) the measurement of today, (2) the map roadmap that covers Lv.1–200, (3) the balancing pass to run
once those maps exist. Numbers marked (measured) come from a throwaway node script over the built `logic.js` of
`main` at 500891d (`defs().maps`, `defs().mobs`, `defs().lvc`) and the kill rates stored in `tests/balance.mjs BASE`.

---------------------------------------------------------------------------------------------------------------

## 1. Today (measured)

### 1.1 Two scales, one mapping

- Players: Lv.1–200 (`MAXLV`, one level per stat point). World: **tiers 1–50** (`TIER_MAX`; `MOBS[k].lv`, `GEN[id].band`,
  chests, `FIELD_BOSS`, rift level, charm tier). `toTier(N) = (N + 3) / 4`, `shownLv(t) = 4·t − 3` (`45-jobs.js`).
- So a tier is **four player levels**: tier `t` ↔ Lv.`4t−3 … 4t`. Tier 1 = Lv.1–4, tier 25 = Lv.97–100, tier 46 =
  Lv.181–184, tier 50 = Lv.197–200. A Lv.200 hero is tier 50.75.
- Everything the client prints is already a shown level (`defs().mobs[k].lv`, `defs().maps[i].band`, door labels, the
  `net.js` "권장 레벨" warning). No rule is tier-gated on entering a map: bands only label and warn.
- **Label quirk**: a band `[a, b]` is printed `Lv.(4a−3)–(4b−3)`, i.e. the level of its top *monster*, not the last
  player level that belongs there. 바람초원 prints 1–25 and 속삭임 숲 29–49, so Lv.26–28 look like nobody's ground
  although tier 7 covers them. Section 3 proposes printing `4a−3 … 4b`.

### 1.2 Every map

Band = recommended player levels (`4a−3 … 4b`); "printed" = what doors show today. Hours = solo, kills only, at the
probe's kill rate for the middle of the roster, to walk the whole band (see 1.3 for the model and its limits).

| map | kind | tiers | band (printed) | monsters (tier) | field boss · chest | xp/kill | XP/h | hours in band |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 바람초원 `meadow` | field | 1–7 | 1–28 (1–25) | twinhare 1, gutfrog 3, eyecrow 5, lambmaw 6 | lambmaw 6 · 4 | 23 | 58k | 0.4 |
| 속삭임 숲 `forest` | field | 8–13 | 29–52 (29–49) | splitboar 8, ribdeer 10, hydrasnake 11, foxtwine 12, mothface 13 | ribdeer 10 · 11 | 94 | 219k | 0.7 |
| 뼈의 지하묘지 `crypt` | dungeon | 12–17 | 45–68 (45–65) | ratking 12, twinhare_bone 13, bonehound 14, toadbrood 15, batcluster 16 | toadbrood 15 · 15 | 139 | 301k | 1.1 |
| 네온 시티 `city` | field | 14–21 | 53–84 (53–81) | pigeonmass 14, gutfrog_poison 16, doghead 17, squidrat 18, catsplit 19, fishwalker 21 | doghead 17 · 18 | 220 | 415k | 2.3 |
| 정글 해안도로 `jungle` | field | 20–26 | 77–104 (77–101) | catsplit_gold 20, toadbrood_poison 21, hydrasnake_poison 23, mothface_bile 24, ribdeer_bile 26 | ribdeer_bile 26 · 23 | 402 | 577k | 4.5 |
| 하수도 `sewer` | dungeon | 22–27 | 85–108 (85–105) | leechmaw 22, ratking_bile 23, gatorhalf 24, crabskull 25, eelknot 26 | crabskull 25 · 24 | 445 | 603k | 4.8 |
| 수정 동굴 `cave` | field + boss | 24–32 | 93–128 (93–125) | spiderhand 24, splitboar_frost 25, moleworm 26, bearmaw 27, hydrasnake_steel 28, owlstare 29; **크리온 32** | moleworm 26 · 27 | 580 | 721k | 10.7 |
| 모래바람 오아시스 `oasis` | field | 28–34 | 109–136 (109–133) | foxtwine_gold 28, hydrasnake_gold 29, lambmaw_bone 30, eyecrow_ash 31, twingoat_gold 33, bearmaw_gold 34 | bearmaw_gold 34 · 31 | 848 | 974k | 8.7 |
| 피의 심연 `abyss` | dungeon + boss | 32–40 | 125–160 (125–157) | twingoat 32, bonehound_ash 33, horsehalf 34, batcluster_blood 35, lionhand 35, serpentwing 36, sowseer 37, doghead_fire 38; **심연의 어미 40** | lionhand 35 · 35 | 1,138 | 1.21M | 13.8 |
| 산호 해안 `coast` | field | 34–40 | 133–160 (133–157) | crabskull_blood 34, fishwalker_frost 35, eelknot_frost 36, squidrat_blood 37, leechmaw_bone 38, gatorhalf_steel 40 | gatorhalf_steel 40 · 37 | 1,265 | 1.29M | 10.8 |
| 모래바다 `dunesea` (**built, placeholder numbers — to be balanced later**) | field (the biggest: 288 × 192) | 31–37 | 121–148 (121–145) | ratking_gold 31, spiderhand_bone 32, bonehound_gold 33, owlstare_gold 34, fishwalker_blood 35, crabskull_frost 36, moleworm_gold 37 | moleworm_gold 37 · 34 | not measured | not measured | not measured |
| 단풍 왕도 `maple` | field | 40–46 | 157–184 (157–181) | blightsquirrel 40, stumpmaw 41, crowscare 42, shroomboar 43, gravrose 44; rotstag 46 (lair only) | rotstag 46 · 43 | 1,726 | 1.60M | 13.0 |
| 차원 균열 (rift) | party instance | 10–49 | 37–196 | `dimPool`: the theme's kinds within [lv−3, lv+2], else the four kinds nearest lv−1 | — | — | — | 5–10 min a run |

Zones inside a ground (`33-maps-zones.js`): safe plaza → normal ground (the roster's lower 85 %, by depth) → elite
ground (its upper half, 35 % elites) → hidden pockets. So a map's own sub-bands are roughly "lower two thirds of the
band near the door, top third deep in". World graph (`GATE_LINKS`): town → meadow → forest → {crypt, cave, maple};
town → city → {sewer, jungle → coast → oasis → cave}; oasis → dunesea ← coast; cave → abyss; maple → abyss (out). Two doors jump far:
forest (8–13) → cave (24–32) and forest → maple (40–46).

Other things that follow tiers and need no change now: life grades `GRADE_TIER = [1, 8, 14, 24, 40]` by a map's
first tier (meadow G1, forest/crypt G2, city/jungle/sewer G3, cave/oasis/abyss/coast G4, maple G5); charms drop from
monsters no more than `CHARM_LOW = 4` tiers under the hero; weapon mastery from monsters no more than 8 tiers under;
bounties `MOBS.lv ≤ tier + 2`; dailies/rift rewards by `tierXp(min(tier, 49))`. Main quests carry no level
requirement (they follow the chain), the charm quests ask Lv.30 / 50 / 90.

### 1.3 Pacing (model)

Kill rates from `tests/balance.mjs BASE` (mean of the four baselines): tier 5 ≈ 41 kills/min, tier 13 ≈ 37, tier 25
≈ 21, tier 40 ≈ 16, interpolated between. XP per kill = the mean of the monsters of that tier. Cost = `defs().lvc`
(+3 % for stats past 30). **Solo, kills only**: no quests, dailies, streak, party, rift or gear `xp` bonus — an upper
bound on time. `jobs-and-stats.md` B.2 gives a faster model with those included (Lv.157 ≈ 11 h, 200 ≈ 18.5 h).

| reach Lv. | 28 | 52 | 84 | 100 | 128 | 150 | 160 | 184 | 200 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cumulative XP | 0.02M | 0.16M | 1.2M | 2.5M | 8.2M | 18.5M | 24.5M | 42.2M | 57.9M |
| hours, kills only (this doc) | 0.3 | 0.9 | 2.9 | 5.4 | 12.8 | 20.3 | 24.4 | 35.3 | 43.3 |

B.2's own points (with quests, dailies, streak): Lv.57 ≈ 1 h · 77 ≈ 1.8 h · 97 ≈ 3.2 h · 117 ≈ 5.4 h · 157 ≈ 11 h · 181 ≈ 15 h ·
200 ≈ 18.5 h.

XP/h rises 58k → 1.6M (×27) while a level's cost rises ×14,000, so bands lengthen by themselves: minutes in the
meadow, 2 h in the city, 9–14 h in each late ground. Gold per kill rises 4 → 150 (tier 1 → 44), ≈ 10k → 140k gold/h.

### 1.4 The gap

- **Highest sensible hunting level today: about Lv.184.** The top common monster is tier 44 (묘지 장미, shows Lv.173);
  the only tier-46 kind is the lair's 썩은 관 사슴왕. Tiers 45 and 47–50 have no monster at all.
- **Lv.185–200 has no ground.** A hero there still gains XP (no over-level penalty) but farms monsters 4–7 tiers
  under: charms stop dropping from tier-44 kinds at Lv.193, and the last 16 levels cost 15.7M XP ≈ 8 h of the same
  five monsters. The rift at tiers 47–49 fills its pool with those same tier 43–46 kinds.
- **Thin stretches** (one ground only): Lv.1–44 (fine: under an hour), **69–76** (city only), **161–184** (maple only).
- **No party dungeon above Lv.160**; the cave doubles as field and boss room for 93–128.
- **Monotone route**: maple is reached only through the forest (tier 13 → 40) or out of the abyss.

---------------------------------------------------------------------------------------------------------------

## 2. Map roadmap to cover 1–200

Target: every level has a field; from Lv.45 up at least two grounds overlap; every field band has a party dungeon
2–4 tiers above its start; early bands 6–7 tiers, late bands 7 tiers but each tier takes longer; the last ground
ends exactly at tier 50 (Lv.200). **9 new maps** (5 fields, 4 dungeons) → 20 in all (13 fields, 7 dungeons).
Existing bands stay where they are.

| # | map (id) | kind | tiers | Lv. | theme — cute heroes vs hell-beasts | connects | pairs with |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **눈꽃 성채** `citadel` | field | 44–50 | 173–200 | the owner's reference: walled snow terraces, corner towers, gorge and arch bridges; frozen guard beasts fused into their armour, gargoyle owls, a wolf pack sharing one spine | frostlake east ↔ citadel west; a ledge down to abyss `out` | dungeon #3 |
| 2 | **얼어붙은 호수** `frostlake` | field | 41–47 | 161–188 | a wide frozen lake under aurora: ice sheets you cross, cracked holes, fishing huts, snowy pines on the shore; things frozen mid-lunge under the ice, antlered seals, a swan with a neck of vertebrae | maple north ↔ frostlake south | maple (field twin), ice fishing G5 |
| 3 | **빙하 납골당** `icevault` | party dungeon | 46–50 | 181–200 | the citadel's crypt cut into the glacier: `halls` generator with ice walls, frozen kings in the walls; end boss at tier 50 (the game's last, a three-phase "얼음 왕") | stair inside the citadel's keep | citadel |
| 4 | **잿불 화산** `volcano` | field | 36–42 | 141–168 | basalt terraces, lava rivers crossed on cooled crust, ash fields, hot springs (campfire spots); salamanders turned inside out, cinder boars (`_fire` kin at first), a tortoise carrying a vent | oasis east ↔ volcano west; volcano north ↔ maple south | abyss / deepsea |
| 5 | **안개 늪** `swamp` | field | 17–23 | 65–92 | mangrove boardwalks over black water, fireflies, drowned shrines; bloated herons, a newt with hands, leech blooms | forest south ↔ swamp north; swamp west ↔ jungle east | crypt above, sewer below |
| 6 | **태엽 심층** `clockwork` | party dungeon | 26–31 | 101–124 | under the neon city: brass halls, turning floor gears, steam vents as telegraphed hazards; rats wound into clock springs, a mastiff with a boiler belly | a lift at the end of the sewer; exit to city | cave, oasis |
| 7 | **하늘 유적** `skyruins` | field | 30–36 | 117–144 | floating islands joined by chain bridges and wind shrines (질주의 바람), broken colonnades; storks with too many wings, cloud jellyfish, lightning rams | a shaft at the top of the cave ↔ skyruins; skyruins ↔ oasis north-east | abyss |
| 8 | **가라앉은 항구** `deepsea` | party dungeon | 38–44 | 149–176 | a drowned harbour in an air pocket under the reef: wrecks, coral halls, glowing anglers for light; an anglerfish that wears a diver, barnacled gulls; boss "난파선의 어미" at 44 | a dive off the coast's reef | coast, volcano, maple |
| 9 | **꿀벌 굴** `burrow` | first party dungeon | 5–9 | 17–36 | a warm earthen hive under the meadow: honeycomb rooms, root tunnels; bees with one shared eye, a queen mole; short (10 min), teaches parties | a burrow mouth in the meadow's far end | meadow, forest |
| 10 | **모래바다** `dunesea` — **built** (maps-v2.md J) | field, the biggest ground | 31–37 | 121–148 | the dune sea running down to the shore: dune ridges, salt flat, dry riverbed, four oases and a village, a buried ruin (field boss), beach, shallows, islets; existing bodies in new tints for now. **Band, stats, XP and drops are placeholders: balance it in the pass after the next maps exist** (it overlaps oasis 28–34, abyss 32–40 and coast 34–40, so it may move up) | oasis south ↔ dunesea north, coast west ↔ dunesea east | — |

Choices per level once all nine stand (fields **bold**, dungeons plain):

| Lv. | grounds |
| --- | --- |
| 1–16 | **meadow** |
| 17–28 | **meadow**, burrow |
| 29–44 | **forest**, burrow (to 36), rift from 37 |
| 45–64 | **forest** (to 52), crypt, **city** (from 53) |
| 65–92 | **city** (to 84), **swamp**, crypt (to 68), **jungle** (from 77), sewer (from 85) |
| 93–124 | **jungle** (to 104), sewer (to 108), **cave**, clockwork (from 101), **oasis** (from 109), **skyruins** (from 117) |
| 125–160 | **cave** (to 128), **oasis** (to 136), **skyruins** (to 144), abyss, **coast** (from 133), **volcano** (from 141), deepsea (from 149), **maple** (from 157) |
| 161–184 | **maple**, **frostlake**, **volcano** (to 168), deepsea (to 176), **citadel** (from 173), icevault (from 181) |
| 185–200 | **frostlake** (to 188), **citadel**, icevault, rift (tier 50 once its cap is raised) |

World graph after: town → meadow → {burrow, forest → {crypt, swamp → jungle, cave, maple}}; town → city → {sewer →
clockwork, jungle → coast → {deepsea, oasis → {cave → {abyss, skyruins}, volcano → maple → frostlake → citadel →
icevault}}}. Every new ground has a neighbour nearer the town whose band starts lower, so a player can walk to the
top without the forest → maple jump (that door stays as a shortcut with its warning).

### Build order (batches of 2–3)

1. **citadel + frostlake** — closes Lv.185–200 and doubles 161–184; the snow theme (ground, pines, gothic walls) is
   shared; citadel is already M4 in `maps-v2.md` (move its band from 40–46 to 44–50).
2. **icevault + volcano** — the end-game party dungeon and last boss; the walkable route oasis → volcano → maple.
3. **swamp + clockwork** — the Lv.69–76 thin stretch and a mid-game dungeon so the cave is no longer the only one.
4. **skyruins + deepsea** — third choices at 117–176 and the Lv.149–176 party dungeon.
5. **burrow** — an early party dungeon (onboarding); last because Lv.1–44 passes in under an hour anyway.

Each new map needs (per `docs/RECIPES.md`): a `GEN` entry + `GATE_LINKS`, 5–6 monsters across its band (new species
for the theme's signature two, tinted kin for the rest as M3 did), a `FIELD_BOSS`, `chest_<id>`, `DENSITY`,
`REGION_BONUS`, life nodes by `GRADE_TIER` (a sixth grade at tier 44+ is a later question), a BGM, client theme art.

---------------------------------------------------------------------------------------------------------------

## 3. The balancing pass (after the maps exist — a plan, not built)

1. **Labels**: print a band as `Lv.(4a−3)–(4b)` through one helper (`bandLv`) used by `doorName`, `mapPayload`,
   `defs().maps`, `defs().waypoints`; tests that pin `[157, 181]` / "바람초원 Lv.1–25" change deliberately.
2. **Monster curve for tiers 45–50**: extend the hand-tuned table along the 40–44 slope (per tier ≈ +3.5 atk, +250 hp,
   +80 xp, +4 gold) and probe at a new tier (add 48 to `PROBE.tiers` with a baseline taken once, then hold ±25 %).
   Keep the tier-indexed baselines; re-point maps, never the baselines.
3. **Zone sub-bands**: an optional `cfg.deep` roster for elite ground (`zoneSpawns`), so a long late band reads
   "outer 44–47, keep 48–50" instead of mixing by the 85 %/50 % split.
4. **Rift**: cap `dimLvOf` at `TIER_MAX` (today 49), check `dimPool` at 47–50 draws tier 46–50 kinds, add snow /
   lava themes to `DIM_THEMES`; re-run the four-bot clear times at tier 48.
5. **Pacing**: decide the target time to 200 (today 18.5 h by the B.2 model, ≈ 43 h kills-only). If it should be
   longer, raise `LV_DIV`-side costs only above Lv.160 so nobody already there is set back; hold XP/h monotone
   across neighbouring grounds (a dungeon ≥ 1.15× its field for a full party, ≤ 0.9× solo).
6. **Economy**: gold/h and chest gold per band against shop prices and `ENH_RATE` costs; chest tiers = band middle.
7. **Followers of the band**: field bosses (top tier of the normal roster), bounties and dailies (`rewardTier` cap
   49 → 50), charm `CHARM_LOW`, mastery `lowTier`, life grades, job-board/delivery destinations, main-quest chain
   steps for each new ground (each step's monster inside the band of the map it sends you to).
8. **Old characters**: no map gains an entry requirement; warnings only; collections that gain kinds keep an earned
   region bonus (grandfather in `migrate`).
9. **New test `tests/levelbands.mjs`** (add to `tests/LIST`): every Lv.1..200 lies in ≥ 1 field band and, from 45
   up, ≥ 2 bands; every map but the town has a neighbour nearer the town whose band starts no higher; every monster
   of a map sits inside its band (chests too, bosses at the top); every dungeon's band starts 2–6 tiers above the
   field it hangs from; no quest (main, side `req.lv`, charm) asks a level above the band of the map it sends you
   to; XP/h by band is non-decreasing; `defs()` bands equal `bandLv(GEN.band)`.

## Integration note — Codex's hunting routes and the frost keep (2026-11-15)

Merging `codex/local-play` changed what §1–2 above describe; the tables there are the plan as written before it.

- **성에왕의 성채 `frostkeep` is built and fills the top slot**: 96 × 64, tier 50 (shown Lv.197), entered only at
  character Lv.200 (`minLv`, checked on the server for doors, stones, recall, reconnect), reached from the old
  kingdom (`maple` "ice" ↔ `frostkeep` "west"), packs of rimehare / frostmoth and the permanent boss 성에왕
  `crownstag`. It reuses the cave's ground and crystals — it has no snow art of its own yet.
- **What that means for the roadmap**: the Lv.200 end point exists, so `citadel` (44–50) is no longer the map that
  closes the top; it and `frostlake` (41–47) now have to fill Lv.161–199 *below* the keep, and `icevault`
  (46–50, party dungeon with the tier-50 last boss) overlaps the keep — fold it into the keep (a party wing) or
  drop it. The open question "is the last boss the citadel's 얼음 왕" is answered for now by 성에왕. `maple` was
  stretched to 40–50 (four new kinds: bogcrown, hollowowl, rootwarden + rotstag in packs) to reach the keep.
- **Bands that moved** (Codex's values kept for the maps it touched): `coast` 34–40 → **26–32** (its six kinds
  rebalanced to tiers 26–32, chest 30), `maple` 40–46 → **40–50**. Ours kept where Codex had nothing: `dunesea`
  31–37 (placeholders), the widened crypt/sewer/cave/abyss layouts, jungle/oasis/coast art.
- **The route is a line now**: town → meadow → forest → crypt → city → sewer → cave → abyss → maple → frostkeep, with
  the coast branch city → jungle → coast → oasis → cave and `dunesea` hanging off oasis (south) and coast (west).
  A dungeon's far door leads on, not back: crypt "out" ↔ city "ossuary", sewer "out" ↔ cave "drain" (made two-way in
  the merge so no door is a one-way trip). `GEN[id].route` names each ground's way on for the signposts.
- Balance stays "later" (§3): Codex's early-mastery and coast numbers are in as built, not re-tuned here.

## Open questions for the owner

- Target hours to Lv.200 (18.5 h model today) — longer for an MMO?
- Is the last boss the citadel's 얼음 왕 (tier 50), or does the abyss get a deeper wing instead?
- New species per map (two signature + tinted kin) or all new art for the snow maps?
- Should the forest → maple door stay once volcano → maple exists?
