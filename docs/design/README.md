# 설계서 목록 — design docs index

Read only the doc for your task, and in it only your phase's sections (`grep -n "^#" <doc>` first).
"Built" docs are reference: the code and tests are the truth; open them only to learn why something is so.

| doc | status | read when |
| --- | --- | --- |
| [`town.md`](town.md) | **live** — T-A exterior + T-B interiors building | working on the town, its buildings, interiors, residents |
| [`jobs-and-stats.md`](jobs-and-stats.md) | **live** — J1 built ("J1 as built"), J2 building, J3 next | stats, levels, weapon mastery, jobs, weapon skills, the bow |
| [`life-and-coop.md`](life-and-coop.md) | **live** — L1 built ("L1 as built", sheet v12), L2 ∥ C1 next, then C2 → C3; town coords now in `town.md` | life skills, part-time jobs, co-op instances |
| [`scale-and-rift.md`](scale-and-rift.md) | built (Phases 0–2; sections F–H "as built") | lazy maps, cells, 4× grounds, zones, stones, 차원 균열 |

When a phase lands, its implementer adds a short "<phase> as built" section (deviations and contracts only)
and updates the status column here.
