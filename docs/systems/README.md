# System summaries (docs/systems)

One page per system so an agent reads one page instead of exploring code. Each: purpose, key
functions, data shapes, flow, invariants, tests. Code is the truth; file map = `docs/FILEMAP.md`.
**Update the page in the same commit when you change the system.**

- [`server-and-saves.md`](server-and-saves.md) — Worker routes, Room/vault DOs, accounts and keys, saves, sheet versions + `migrate`, `exportChar`
- [`maps-and-spawning.md`](maps-and-spawning.md) — lazy map registry, generators, doors, zones, stones, wind shrines, cells/waves, instances, chunked ground bake
- [`loot-and-economy.md`](loot-and-economy.md) — items, gear rolling, drops, enhancement, shop/sell, warehouse, bag, gold faucets and sinks
- [`rift.md`](rift.md) — 차원 균열 party instance (the 균열 침공 world event was removed)
- [`world-life.md`](world-life.md) — day/night, weather, camps, fishing/cooking, dailies, achievements, collection, tutorial, side quests
- [`wire-and-client.md`](wire-and-client.md) — snapshot/`defs()`, action flow, client state, windows, renderer, radar
- [`combat-skills-jobs.md`](combat-skills-jobs.md) — six stats, levels 1–200, mastery, jobs, weapon skills, basic attacks/bow arrows, aim, hitstun, mob damage hooks, balance probe
- [`life-skills.md`](life-skills.md) — L1 as built (fishing/cooking levels, grades, rolls, wire) and what L2/C1–C3 add
- [`housing-and-bag.md`](housing-and-bag.md) — bag expansion, the house (tiers, `house_<eid>` instances, furniture, storage, rest buff)

Not covered yet (being rewritten): town redesign.
