# System summaries (docs/systems)

One page per system so an agent reads one page instead of exploring code. Each: purpose, key
functions, data shapes, flow, invariants, tests. Code is the truth; file map = `docs/FILEMAP.md`.
**Update the page in the same commit when you change the system.**

- [`server-and-saves.md`](server-and-saves.md) — Worker routes, Room/vault DOs, accounts and keys, saves, sheet versions + `migrate`, `exportChar`
- [`maps-and-spawning.md`](maps-and-spawning.md) — lazy map registry, generators, doors, zones, stones, wind shrines, cells/waves, instances, chunked ground bake
- [`loot-and-economy.md`](loot-and-economy.md) — items, gear rolling, drops, enhancement, shop/sell, warehouse, bag, gold faucets and sinks
- [`rift.md`](rift.md) — 차원 균열 party instance and the older 균열 침공 world event
- [`world-life.md`](world-life.md) — day/night, weather, camps, fishing/cooking, dailies, achievements, collection, tutorial, side quests
- [`wire-and-client.md`](wire-and-client.md) — snapshot/`defs()`, action flow, client state, windows, renderer, radar

Not covered yet (being rewritten): combat/skills/jobs (J2), life skills (L1), town redesign, housing internals.
