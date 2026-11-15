# 보스전리품 + 메인퀘스트 혼자 도전 (boss trophies, solo story fights)

Rules: `game/src/logic/67-trophies.js` (+ `fbHome`/`spawnFieldBoss` in 40, hooks in 45/50/64/80/90). Test: `tests/trophies.mjs`.

## Decisions (owner)
1. **Field bosses stand.** Each hunting ground's `FIELD_BOSS` stands at a fixed spot (`fbHome`: `m.bossAt`, else the
   reachable tile deepest from the map's entry, moved clear of the waypoint and signposts) as soon as anyone is on the
   map, and is back there `FB_RESP` = 10 min after it falls. The 60-kill summon (`rt.kc`, `FB_KILLS`) is gone.
   Strength unchanged (elite rank 2: 14× HP, 1.8× atk, two traits drawn from the ground's own seed box `rt.fbRng`).
   The rift invasion (`mob.evt`) is untouched.
2. **One trophy per boss kind**, fixed effect, all held trophies apply at once, sums capped (`TROPHY_CAP`).
3. **Getting one:** the solo story fight's clear gives it for sure; a share of the real field boss's kill gives it at
   `TROPHY_P` = 5 % to each sharer who lacks it. A duplicate (story clear when already held) pays `TROPHY_GOLD` (40) ×
   the boss's world tier in gold. Korean toasts + a server-wide `sys` line on a new trophy.
4. **Main chain:** a quest `{ mob: <boss>, n: 1, fb: 1 }` closes each ground's segment (meadow, forest, crypt, city,
   sewer, cave, abyss, maple; the city's sits before 생선 so quest tiers keep rising). `fb` quests count only rank-2
   kills (the real boss or the story copy). Old sheets (< v17) keep the same errand: `questV17` maps the old index.
5. **Story fight:** holding an accepted `fb` quest and stepping within `STORY.r` = 4 tiles of that ground's boss spot
   moves the hero, alone (party members are not pulled), into a private `dim:` instance (`registerDim`, `dimArena`
   with the ground's theme, `dim.story`). The copy: same kind and tricks, rank 2, no traits, `mob.hk` = 0.5 (half the
   field boss's health), `mob.ak` = 0.6. Clear → trophy + quest completed on the spot (its gold/xp paid) → back where
   they stepped in after 6 s (loot can be picked up). A fall (1.5 s) or [떠나기] (`dim_leave`) → back outside, on
   their feet, nothing lost; step out of the ring and in again to retry. 10-minute limit. Disconnect closes it.
   Measured (bot, basic attacks + potions, tier gear at the quest's tier): lambmaw ≈ 17 s, rotstag ≈ 70 s.

## TROPHIES (whole %, crit in points)
| boss (tier) | trophy | fx |
| --- | --- | --- |
| lambmaw (6) | 뒤집힌 양털 | xp 2 |
| ribdeer (10) | 갈비뼈 사슴뿔 | move 2 |
| toadbrood (15) | 두꺼비 알주머니 | hp 2 |
| doghead (17) | 세 머리 들개 송곳니 | aspd 2 |
| crabskull (25) | 두개골 게딱지 | gold 3 |
| moleworm (26) / loggator (26) | 눈먼 두더지 발톱 / 악어 통나무 비늘 | drop 3 / hp 3 |
| coralturtle (32) / mummycamel (34) | 산호 뿔 조각 / 미라 낙타 붕대 | move 3 / gold 4 |
| lionhand (35) / bearmaw_ash (35) | 손갈기 사자 갈기 / 종지기 곰의 종 | xp 4 / aspd 4 |
| sandmaw (37) / crownpeacock (42) | 모래 아가리 이빨 / 금관 공작 깃 | drop 4 / crit 2 + gold 2 |
| rotstag (46) | 썩은 사슴왕의 관 | xp 3 + crit 3 |

Caps: gold 8, xp 8, move 5, aspd 5, drop 6, hp 5, crit 4. Applied in `deriveStats`: `xp`/`gold` (+%), `spd0`
(+% of base, beside gear's), `acd` (× (1 − aspd %)), `mf` (+drop), `mhp` (× (1 + hp %)), `crit` (+, under the cap).

## Wire (append-only)
- Sheet v17: `ch.tro = [kind…]` (order won; `newChar` [], `migrate` keeps known kinds once).
- `self.tro` — the same list, sent with `self` (`dirty`) when a trophy is won.
- `defs.trophies = { list: { kind: { name, fx } }, cap, p, gold, story: { r, limit } }`; `defs.fbResp` (ms) replaces
  `defs.fbKills`. `defs.quests[i].fb` = 1 for a boss quest.
- Story arena: a normal `dim:<n>` map (`map` sent on entry, title "<boss>의 자리"); no `dimr` row (no `prog`);
  event `["dm","open",x,y]` on entry; toasts for entry, clear, fall, leave, timeout.

## Client task (later)
- 보스전리품 window like the charm window: every `defs.trophies.list` entry, owned (`self.tro`) lit / unowned dim, its
  effects, and the capped totals.
- Quest tracker: an `fb` quest line "우두머리 [이름] 홀로 쓰러뜨리기 — 그 자리로 가세요" with the boss spot on the
  radar (`fb`); inside the arena a [떠나기] button (sends `dim_leave`) and the time left (`defs.trophies.story.limit`).
- Check the arena floor art for overworld themes (`dimArena` paints `c`/`d` tiles with the ground's theme).
