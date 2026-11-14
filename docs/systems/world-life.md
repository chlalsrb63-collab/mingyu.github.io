# World life: sky, camps, fishing/cooking, dailies, achievements, collection, tutorial, side quests

Purpose: the "living world" systems around the combat loop. **Being changed**: life (L1) adds life skills and
town redesign moves the plaza — see `docs/design/README.md`; fishing/cooking here are the *current* mini-games only.

## Key files / functions (`game/src/logic/` unless noted)
| symbol (file) | role |
| --- | --- |
| `SKY_DAY_MS` 48 min, `PHASES` 새벽 4.5 / 아침 7 / 낮 11 / 노을 17 / 밤 19.5, `dayHour`, `dayPhase`, `isNight` (62-daynight) | outdoor clock from server time only (hour = (now mod 48 min)/2 min), same on every channel |
| `WEATHER`, `WX`, `WX_MS` 6 min, `WX_ODDS`, `wxRoll`, `weatherAt(id, now)` (62) | per-map weather per 6-min slot from hash(map id, slot); `-1` indoors/underground/instances. `WX_ODDS` keys: only `town meadow forest city` (outdoor = theme/id in it). Rain ×`WX_FISH` .75 bite time; fog ×`WX_FOG_AGGRO` .9; fog burns off at midday |
| `skyTick(S,now)` (62) | per live map sets `rt.wx`; at night in town pushes event `["tl", tale]` every `TALE_MS` 100 s |
| `campsOf(m)`, `SEAT_AT`, `sitDown`, `sittersAt`, `warmthFor`, `warmTick`, `warmRegen` (62) | stumps around every always-burning fire (`FIRES[mapId]`; wilds seat 3, town 4; none indoors); sitting: +10 % XP, +3 % per extra sitter (≤4), +1 % at night, regen .5 %/s per sitter, lasts `WARM_MS` 10 min, checked each `WARM_SEC` 6 s (`warmTick`); counts `cnt.rest`, tutorial `rest` |
| `JAM` 연주/건배, `JAM_CD` (62), action `emo` | only while `p.sit` (validate "앉아서 할 수 있습니다") |
| `TELLER`, `TALES`, `nightNpc`, `taleAt` (62) | night storyteller NPC pushed into the town map (hard-coded tile x20,y22, **tied to the old town**) |
| `skyAt(map, now)` (62, exported) | test/tool view: hour, phase, weather, teller, camps |
| fishing: actions `fish hook reel` (70/75), tick in `80-simulation` ~L473 | `fish`: needs water (`waterNear`), not in combat 3 s, bag room. Server sets `p.fish={at,bite,hook}`; bite after 2.5–7 s; unhooked bite lost after 1.8 s; hooked fight ≤25 s. `reel{s}` client score 0–100 (capped 40 if <2.5 s) → `fish_s/m/l` / `stone`; `ch.fish`, `cnt.carp`, daily `fish` |
| cooking: action `cook{id,s}` (75) | fish → dish at a fire (`fireNear`); score <35 burnt, ≥85 two dishes; `cnt.cook`, daily `cook` |
| `public/minigames.js` `fishing(onDone)`, `cooking(dish,onDone)` | rhythm / tangram mini-games; client computes score `s` — **server trusts it only within the caps above** |
| daily (60-content): `dayOf`, `RESET_AT` 06:00 KST, `rollDaily`, `ensureDaily`, `dailyProg(S,p,kind,k)`, `dailyReward/Bonus`; action `daily` | 3 tasks/day: 1 kill (kind near tier) + 2 of `elite fish cook chest bounty`; seeded by `name:day` |
| `ACH` (`[id,cat,name,desc,pts,test,title?,bonus?]`), `checkAch`, `achPoints`, `titleOf`, `ACH_BY` (60) | achievements tested on counters `ch.cnt` (`CNT_KEYS`), `ch.kills`; titles worn via action `title` add `bonus` stats (in `gearBonus`); cosmetics via `COS_ACH` |
| `REGION_BONUS`, `COL_MOBS`, `regionDone`, `registered` (60/36) | monster collection: a kind registers at first mastery star (`MASTERY[0]` kills), a map's region completes when all its kinds do → permanent bonus; editor maps get empty bonus |
| `TUT`, `tutStep(S,p,id)` (60) | first-steps chain `ch.tut={i,n}`, indices persisted (append only); each step pays gold/items; `migrate` skips it for characters with tier ≥5 or ≥20 kills |
| `QUESTS` (10), actions `quest`, `bq` (bounty at 관리자, `BOUNTY_N` 25 kills, repeat) | main quest chain `ch.q={i,n,st}`; `data/quests.json` `main` may replace it |
| side quests (62-side-quests): `SIDE`, `SQ_BY`, `sqClean`, `sqProgress(S,p,type,match)`, `sqPicked`, `sqValidate/sqApply`, `sqView`; client `public/sidequests.js` | editor quests `data/quests.json` `side`; goals `kill collect talk visit`; `ch.sq={on:{id:n},done:{id:times}}`; max `SQ_MAX` 10 active; actions `sq{a:take|done|drop|talk,id}`; hooks in `killMob`, pickup, talk, `changeMap` |
| `worldEvent` (60) | the half-hourly 균열 침공: see `rift.md` |

## Flow samples
1. Sit by a fire: `sit` → `sitDown` (nearest free stump ≤18 px) → each second `warmTick` → buff `p.warm/warmPct/warmN` → `stats()` adds XP% (`40-characters-world.js`); moving/combat calls `rouse`.
2. Fishing: `fish` → alarm tick sets bite → client sees fx `["f",eid,2]` → `hook` → client mini-game → `reel{s}` → item, `dailyProg("fish")`, `checkAch`.
3. Day reset: `ensureDaily` on join and on use compares `ch.daily.day` to `dayOf(S.now)`; rolling is deterministic, no server cron.
4. Side quest: giver NPC (role `quest`) → `sq take` → kills call `sqProgress("kill")` → `sq done` pays gold/items/xp.

## Wire
`self.daily`, `self.tut`, `self.evt`, `self.col` etc. via `selfPayload` (dirty-flag); snapshot `dn=[weather, serverSecs]` (on map change, weather change, or every 60 s) feeds `public/sky.js` (`setSky`, `grade`, `drawWeather`, `hour`, `phase`, `nightK`); events `tl` (tale), `f` (fishing), `ac` (achievement), `rc` (recall).

## Invariants / gotchas
- No `Date`/`Math.random` in logic: time is `S.now`; the day number is `dayOf(now)`; weather/tales derive from hashes of ids and slots.
- New weather odds: add the map's `theme`/`id` to `WX_ODDS`, else it is "indoor" (-1). **`maple` (theme `autumn`) and the dungeon themes have no entry → no weather/day-night grading logic server side** (client `sky.js` decides visuals by theme; check before assuming).
- New counter for achievements ⇒ add to `CNT_KEYS`, defaulted/clamped in `migrate` (it iterates `CNT_KEYS`).
- New tutorial/daily kinds: append only (indices persisted); client text for daily kinds is `DAILY_TEXT`.
- Stump seats are computed from `FIRES` once per map (`m.camps` cache); interior fires have no seats.

## Tests
`daynight.mjs` (clock, weather per map/slot, wire `dn`, stumps, warmth 1–4, 연주/건배, storyteller, rain/fog) · `life.mjs` (fires, fishing, cooking, guilds) · `content.mjs` (achievements, collection, dailies, old sheets, long game) · `data.mjs` (side quests, quest data errors) · `hotbar.mjs` · `party.mjs`.
