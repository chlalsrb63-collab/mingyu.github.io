# 설계서 목록 — design docs index

Read only the doc for your task, and in it only your phase's sections (`grep -n "^#" <doc>` first).
"Built" docs are reference: the code and tests are the truth; open them only to learn why something is so.

| doc | status | read when |
| --- | --- | --- |
| [`lunelsha-story.md`](lunelsha-story.md) | **live** — 루넬샤 세계관과 주요 의뢰의 공개 순서 | 초반 피난 서사, 바람등호 관측 기록, 성채에서 밝혀지는 과거 |
| [`town.md`](town.md) | **live** — T-A exterior + T-B interiors building | working on the town, its buildings, interiors, residents |
| [`jobs-and-stats.md`](jobs-and-stats.md) | built — J1, J2, J3 ("… as built" in F.4); open: bow art polish, `_icons`/`_swing` previews | stats, levels, weapon mastery, jobs, weapon skills, the bow |
| [`skills-v2.md`](skills-v2.md) | built — rules and data (palettes, felt passives, balance); open: icons and effects (client) | job palettes, skill inventory, passive redesign, measurements, the icon/effect brief |
| [`player-interaction.md`](player-interaction.md) | **live** — built 2026-11-15 | the menu on another player, 따라가기, trade, mini-games (가위바위보) |
| [`life-and-coop.md`](life-and-coop.md) | **live** — L1 built ("L1 as built", sheet v12); L2 rules built ("L2 rules as built": wire + actions for the client), L2 client ∥ C1 next, then C2 → C3; town coords now in `town.md` | life skills, part-time jobs, co-op instances |
| [`willow-job-economy.md`](willow-job-economy.md) | **draft** — waits for Claude's Willow village expansion | village facilities, 12 job designs, net-income targets and rollout |
| [`npc-life.md`](npc-life.md) | **N1 rules built** — N2 client ∥ N3 content → N4 quests (section K; K.1 maps a Codex build onto it) | NPC daily routines (`npcAt`, `data/npclife.json`, wire `nl`/`nw`), posts and services while away, places, the 61-member cast, relationships, `meet` quests and the eight quest lines |
| [`scale-and-rift.md`](scale-and-rift.md) | built (Phases 0–2; sections F–H "as built") | lazy maps, cells, 4× grounds, zones, stones, 차원 균열 |
| [`hunt-progression.md`](hunt-progression.md) | testing targets for the upcoming maps | hunting bands, solo and party benchmarks, and the Lv.200 gate |
| [`maps-v2.md`](maps-v2.md) | **live** — M1 built (meadow 고원 폭포, forest 이끼 협곡 + 잊힌 신전, `tests/mapflow.mjs`; "M1 as built" F); M2 cave + crypt/sewer next, M3 oasis/coast/jungle, M4 citadel | map generators, reference images → biomes, path-quality rules, new tiles the art steps need |
| [`level-bands.md`](level-bands.md) | **design only** — today's bands measured (tiers 1–46 = Lv.1–184; Lv.185–200 has no ground), roadmap of 9 new maps to cover 1–200, the balancing pass to run after they exist | planning a new hunting ground or dungeon, its level band and doors; later the band balancing pass and `tests/levelbands.mjs` |
| [`content-audit-2026-11-15.md`](content-audit-2026-11-15.md) | **design only** — full content inventory with counts, gaps vs reference MMORPGs, packages P1–P12 (quest engine, story arcs A1–A6, main chapters, life balance, life items; cosmetics/dye after Codex's 64×64 hero) | adding quests, life items or cosmetics; balancing life skills; the story between Lv.22 and Lv.200 |
| [`arcs.md`](arcs.md) | **as built** — side-quest story arcs on the P1 engine: A1/A2 피난민 thread (steps, branches, retired quests, NPC lore) | writing or changing an arc; checking quest rewards against audit §3 |
| [`maps-batch2.md`](maps-batch2.md) | **design only** — six maps from the owner's second set of references: 바람개비 능선 `ridge`, 물결 항구 `harbor` (second town + dock ward), 수련 삼각주 `delta`, 운해 사원 `cloudtemple`, 붉은바위 황금궁 `mesa`, 먹빛 호수 `inklake`; provisional bands, build order in three pairs | building one of those six maps: layout recipe, monster placement per region, new species + tinted fallbacks, art list, doors |

When a phase lands, its implementer adds a short "<phase> as built" section (deviations and contracts only)
and updates the status column here.
