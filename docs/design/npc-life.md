# NPC 생활 — every NPC lives a day (frozen contract)

Status: **design, frozen** (N1–N4 build against it). Owner's request: no NPC stands in one spot; each lives
its own day by job, personality and habit, walks the town and its interiors with the clock, keeps friends, can be
found on the map, and quest lines and an interactive town grow on top.
Reads with: `town.md` D/F/H (tiles, rooms, residents), `docs/systems/world-life.md` (clock, side quests),
`wire-and-client.md` (snapshot rules), `life-and-coop.md` B.9 (trust `rep`).

Words: **body** = the person walking about · **post** = the tile where a service NPC stands today (its entry in
`map.npcs`, unchanged) · **place** = a named anchor with spots · **leg** = one stay or one walk on one map ·
**life day** = one 48-min sky day counted from 04:00 · **cycle day** = life day mod 4.

## A. Decisions in one screen

1. **One pure function, no simulation.** `npcAt(id, now)` gives every body's map, tile, act and companion from a
   static plan (`game/data/life.json`) and the sky clock. No per-tick movement, no RNG (hashes of id + life day
   only), nothing saved, identical on every channel and after every restart.
2. **Posts keep the services; bodies live.** Every service is validated at the static post exactly as today
   (`npcNear(p, role)` is not touched). When the body is away the post still serves (a small "자리 비움" sign, the
   apprentice named on it). The body in person gives talk, quests and relationship lines. Nothing a player uses
   every session ever gets farther away or closes.
3. **Nobody is unreachable.** A quest giver/target is reached at its body, at its post, or by knocking at the door
   of the home it sleeps in. Old `talk` quests, the tutorial and the main quest (role `elder` → post) cannot dead-end.
4. **Wire: legs, not positions.** The server sends a body's current leg once when it begins (`snap.nl`); the
   client interpolates along it with the synced sky clock. The client holds no plans and finds no paths.
5. **One mover.** The 16 ambient residents of `public/townfolk.js` become cast members of the same system (real
   NPCs: talkable, quest-capable). `townfolk.js` is replaced by `public/npclife.js`.
6. **One new quest goal, `meet`** (talk to X while X is at place P / in phase F / doing A / with Y, optionally
   handing over an item) + quest fields `grant auto hint reward.rep req.rep`. No escort, no timers, no fail states.
7. **No sheet change** (stays v12): quest progress uses `ch.sq`, trust uses `ch.rep`; "talked today" is client memory.

## B. Clock and plan model (rules: new part `src/logic/62-npc-life.js`, between 62-daynight and 62-side-quests)

- `LIFE_T0 = 4 h` of sky time. `lifeDay(now) = floor((now − 4·120 000) / SKY_DAY_MS)`;
  `ls(now)` = life second = seconds since 04:00 of that life day, `0 ≤ ls < 2880` (1 game hour = 120 s);
  `cycle = lifeDay mod LIFE_CYCLE` (`LIFE_CYCLE = 4`, global: companions always share it).
- A cast member's **plan** is a list of blocks sorted by hour `h` (4 ≤ h < 28; h ≥ 24 is after midnight). A block
  lasts until the next one; the last runs to 04:00, and the next life day starts from wherever it ended.
  Blocks with `days` apply only on those cycle days and win over an undated block of the same `h`.
- **Departure jitter**: a body leaves for block `b` at `h·120 − 480 + hash(id, lifeDay, b) mod 31` life seconds
  (0–30 s late), so the town never moves in one tick. A block naming `with` leaves 1 s after its companion.
- **Walking**: 3 tiles/s (players' base speed) along the BFS path over open tiles (townfolk.js `open` rule: no object,
  no `w`/`W` ground), stay tile → stay tile. Another map: walk to the door tile (`links.json`), vanish, appear on
  the other map's arrival tile (`arrivalOf`) the same instant, walk on. Room ↔ room goes through the town (3 legs).
  Bodies never block and are never blocked (the town and its rooms are safe maps).
- **Rain**: if the block's place is outdoors and the block (or the cast member's `shelter`) names a rain place,
  and `weatherAt(placeMap, blockStart)` is rain, the body goes there instead. Decided once at block start.
- **Rounds**: a place of kind `round` is a closed route; the body walks it for the whole block (`lag` tiles behind).
- **Spots and capacity**: a place lists spots `[x, y, dir, "sit"?]`. Occupants of a place in a block take spots in
  cast order; a `with` pair takes neighbouring spots. `sit` spots may be furniture (`k`, `s`) with one open
  orthogonal neighbour: the path ends on the neighbour, the last step hops onto the seat. Places with `"in": true`
  (homes) hide the body (unlimited capacity, the door tile is the **knock** spot). `data:check` fails when any
  block on any cycle day (rain variants included) needs more spots than a place has; at run time an overflowing
  body stands on the nearest open tile (never throws).
- **`thing` objects never move and may not be cast members** (data:check error). Posts are not removed or moved.

### B.1 Exported API (frozen names; tests call them as `L.*`)

| function | returns |
| --- | --- |
| `npcAt(id, now)` | `null` (not a cast member) or `{ id, map, x, y, tx, ty, dir, act, place, with, moving, hidden, onPost, until }` — `x,y` px in the NPC convention (`tx·16+8`, `ty·16+12`, fractional while walking), `act` a key of C.3, `place` id, `with` companion id or null, `hidden` = inside an `in` place, `until` = ms when this leg ends |
| `npcPlan(id, now)` | `{ place, act, until, next: { place, act, at } }` — block level only, no path finding (the map list) |
| `npcsOn(mapId, now)` | ids whose body is on that map now (hidden ones included) |
| `lifeLegs(mapId, now, since?)` | wire rows (C.2) of that map: all, or only legs begun after `since` |
| `lifeWhere(now)` | wire rows of the whole cast for the map window (C.2 `nw`) |
| `npcReach(p, id)` | true when player `p` may talk to `id` now: body within 56 px (88 px while it walks: clock skew), or its post within 56 px, or its knock spot within 40 px while hidden — replaces `npcNearId` everywhere (`sq`, `meet`) |
| `lifeCheck()` | list of plan errors (Korean, for `data:check` and the test) |

Internals (free to shape): block table per (id, cycle, rain variant) built at load with no paths; a leg's path is
found on first use and cached by `map:fromTile>toTile`. `npcNear(p, role)` and `goodsNear` stay as they are.

## C. Data, wire, client

### C.1 `game/data/life.json` (new; `build-logic.mjs readData` → `DATA.life`; schema added to `docs/editor/SCHEMA.md`)

```jsonc
{ "v": 1,
  "places": {
    "terrace":  { "map": "town", "name": "쥬쥬식당 야외석", "spots": [[71,51,"s","sit"], [72,52,"e"]] },
    "cot3":     { "map": "town", "name": "살림 마을 셋째 집", "in": true, "spots": [[5,39,"n"]] },
    "r_mail":   { "map": "town", "name": "우편 배달 길", "round": [[10,35],[50,27],[65,39],[72,50]] } },
  "cast": {
    "smith": {                                  // an existing NPC id: name, look, role, post come from its map entry
      "traits": ["무뚝뚝", "대식가", "의리"], "home": "forge_back", "cover": "forge_tong", "away": "바깥 모루",
      "shelter": "diner_hearth",
      "plan": [ { "h": 7, "at": "post", "act": "work" },
                { "h": 12, "at": "terrace", "act": "eat", "with": "r_jjik" },
                { "h": 13, "at": "post", "act": "work" },
                { "h": 19.5, "at": "diner_t3", "act": "eat", "with": "bank", "days": [0,1,2] },
                { "h": 19.5, "at": "diner_bar", "act": "drink", "with": "kangkang", "days": [3] },
                { "h": 23, "at": "forge_back", "act": "sleep" } ],
      "lines": { "work": ["…"], "off": ["…"], "eat": ["…"], "with": ["…"], "rain": ["…"], "night": ["…"],
                 "again": ["…"], "knock": ["…"] } },
    "r_dotori": { "name": "도토리", "hero": [12,2,11,10,2,7,1,14,8,2,0], "cos": [], "kid": 1, "…": "…" } },
  "rel": [ { "a": "smith", "b": "bank", "kind": "friend", "story": "…", "chat": ["a: …", "b: …", "a: …"] } ] }
```
- `at`: a place id, or `"post"` (cast members with a post only). `act`: C.3. Optional per block: `with`, `days`,
  `rain`, `pose` (an `iso_interior.js drawPose` name overriding the act's), `lag` (rounds).
- A cast id is either an existing NPC id (town, a town room, willow) or a new resident (`name` + `hero` look in
  `species.js` order + `cos`; residents join `NPC_MAP`/`NPC_NAME` so quests and `rep` may name them).
- Line keys (Korean; `work off` ≥ 2 lines, others ≥ 1 or omitted → falls back to `off`, then `npctalk.js`):
  `work off eat with rain night again knock`. `again` = second talk the same life day. `rel[].chat` alternates a/b.
- `data:check` (`editor-lib.mjs checkData`, shared `editor/validate.js`): ids exist, spots open and reachable from
  the map entry, every consecutive pair of places walkable, **every trip ≤ 60 s**, **every block ≥ 120 s (one game hour) with ≥ 30 s of it spent there**, capacity,
  `with` names an edge of `rel` whose two plans agree on `h`/`at`, `avoid` pairs never share a place, first `h` ≥ 4.

### C.2 Wire (append-only, ints only; `i` = cast index in `defs().life.cast` order)

| where | field | content |
| --- | --- | --- |
| `welcome.defs` | `life` | `{ cast: [[id, name, look, cos, postMap, traits]], places: [[id, map, name]], acts: [key…], rel: [[i, j, kind]], lines: { id: {…} }, chat: [[i, j, [..]]], cycle: 4 }` — static, once. Budget ≤ 24 KB (the lines are most of it) |
| `snap` | `nl` | leg rows of **your map**: all of them with `map` (arrival), afterwards only a leg that just began |
| `snap` | `nw` | whole-cast rows `[i, placeIdx, actIdx, nextLs, nextPlaceIdx]`, only in the snapshot after action `{t:"nw"}` (throttle 5 s) |

`nl` rows — a body with **no row is standing on its own post, working** (drawn as today):
- stay `[i, 0, x, y, d, a, ls1, w?]` — tile, facing 0–3, act index, life second it ends, companion index
- walk `[i, 1, ls0, ls1, a, fl, x0, y0, x1, y1, …]` — corner tiles of the path, constant speed between `ls0` and
  `ls1`; `fl` bit 0 = came in through the door at `x0,y0` (fade in), bit 1 = leaves through the door at the end
  (fade out, then gone), bit 2 = a round (repeat until `ls1`)
- gone `[i, 2, ls1]` — its post is on this map but the body is elsewhere or indoors: draw the post sign

A door crossing is therefore two rows on two maps: a walk with `fl & 2` where it leaves, a walk with `fl & 1`
where it arrives; players on either map see their half. The client turns `ls` into time with `Sky`'s clock
(`dn`), never extrapolates past `ls1` (holds the last pose until the next row) and drops rows on `map`.

Server cost: per **occupied** town-system map one compare per tick (`now < rt.lifeNext`); when a boundary passes,
`lifeLegs(map, now, rt.lifeAt)` goes into that tick's snapshots (shared row list, like `rt.ev`). Empty maps: nothing.

### C.3 Acts (frozen order = `actIdx`) — Korean label · default pose

`work` 일하는 중 · the NPC's own `pose` | `walk` 이동 중 | `eat` 식사 중 · sip | `drink` 한잔하는 중 · sip |
`rest` 쉬는 중 · — | `sleep` 자는 중 · doze | `stroll` 산책 중 | `chat` 수다 중 · wave | `shop` 장 보는 중 · carry |
`fish` 낚시 중 · fish | `train` 수련 중 · hammer | `read` 책 읽는 중 · read | `play` 노는 중 | `perform` 공연 중 · wave |
`tend` 가꾸는 중 · water/sweep/knit by `pose` | `watch` 망보는 중.

### C.4 Client (`public/npclife.js` replaces `townfolk.js`; same shape so scene2d/client change little)

`init(deps)`, `load(map)`, `onLegs(rows)`, `onWhere(rows)`, `update(dt, me, now)`, `drawables(now)` (bodies: hero
sheets for residents, NPC sheets for the rest, pose, fade), `bubbles(now)`, `at(id)` (px or null), `list()`.
- `scene2d`: a posted NPC whose row says away is not drawn at the post; `decor.js postSign(role)` (a small hanging
  plaque with the role glyph) is. Bodies depth-sort like players. Doors: 0.3 s fade + the door's light pulse.
- F prompt (`client.js`): nearest of bodies, posts, things, knock spots. Body off duty → talk window (lines by
  situation + quest cards). Post → the service window as today; if the keeper is away its header says
  "볼칸은 쥬쥬식당에서 식사 중 — 견습 통통이 대신 봐 드립니다" (`cover`) or "… — 종을 울리면 됩니다".
- **Quest cards for service NPCs** (solves the old limitation): every service window gets a header chip
  `이야기` (with `!`/`?` when that NPC has a quest to give/take) that opens the talk window with the cards.
- Paired chat: two bodies with a `rel` edge standing ≤ 2 tiles apart show their `chat` lines in turn, line index =
  `floor(ls / 5) mod n` (the same line for every player, nothing on the wire). Rivals banter the same way;
  a `crush` pair shows "…" and turns away instead. Bubbles only within 9 tiles of the player, ≤ 3 at once.
- Small reactions (client only): greeting by phase before the line ("좋은 아침!", "늦은 밤이군."), `again` lines
  when `localStorage tt.met.<char>.<lifeDay>` has the id, a wave back to the player's `emo` wave within 3 tiles,
  lit window on a home while someone is inside.

## D. Services while away (the rule, per role)

| role (post) | while the body is away | F on the body off duty |
| --- | --- | --- |
| `shop` (리나, 다리, 무쇠, 쥬쥬, 모카, 마루, 몽글) | post sells as always ("무인 판매함 — 값은 통에") | talk, quests; line points back ("가게는 열려 있어요") |
| `smith` (볼칸) / `craft` (캉캉) / `alch` (보글) | post works; `cover` apprentice named (통통 keeps the night shift inside) | talk, quests ("내일 아침 대장간에서 보세") |
| `train` `job` `bank` `costume` `house` `collector` `achieve` `jobs` | post works (dummy, scroll, barn door, mirror, plaque, case, tablet, board) | talk, quests |
| `elder` (main quest, bounty) | post works at all hours ("관리자의 접수 종"); tutorial text "광장 분수 앞" stays true | talk, side quests |
| `warp` `daily` `dim` — **keepers** | post works; their plans stay within 8 tiles of the post except one short break a day | talk, quests |
| `quest` / `talk` (no service) | — | everything they have, wherever they are (or through the door when asleep) |

Never dead-end: `talk` goals, `take` and `done` use `npcReach` (body ∪ post ∪ knock). Only `meet` insists on the
body. The quest window shows where the next person is ("지금: 쥬쥬식당 · 식사 중") and a `추적` button (F).
Sitting by an NPC at a fire gives no warmth (`warmthFor` counts players only). The storyteller's `tl` tales fire
only while 소담 is at `fire` at night (today's `nightNpc` becomes her plan).

## E. Places (ids frozen; tiles are data in `life.json`, the editor may move them)

Town tiles below were checked open and reachable on the built town (commit 5df82df); room chairs are the maps'
own `k`/`s`. `~` = suggestion, N3 settles within ±2 (data:check judges).

| place | name | spots |
| --- | --- | --- |
| `fire` | 광장 모닥불 | (60,48) (56,48) (60,44) (61,46) — 소담's post (56,46) beside |
| `fountain` | 분수대 | (48,37) (50,37) (48,42) (51,42) (49,43) (52,43) |
| `bench` | 광장 벤치 | (44,47) (45,47) (43,47) |
| `garden` | 도서관 뜰 | (36,24) (37,24) (38,24) (36,25) |
| `steps` | 마을회관 계단 | (48,27) (50,27) (52,27) (47,27) |
| `yard` | 수련 마당 | (67,24) (69,24) (71,24) (67,21) (69,21) |
| `forgeyard` | 대장간 마당 | (78,37) (78,36) (76,36) |
| `market` | 장터 좌판 | (65,39) (63,39) (64,40) |
| `terrace` | 쥬쥬식당 야외석 | (71,51) (72,52) (73,52) (74,53) (74,54) (76,53) (75,51) |
| `pond` · `pondfire` | 연못가 · 연못 모닥불 | (24,52) (25,52) (25,56) (12,51) · (29,62) (30,62) (28,62) |
| `bridge` · `laundry` | 돌다리 · 빨래터 | (24,41) (24,46) · (6,42) (7,42) (13,41) |
| `flowers` | 꽃밭 | (14,28) (15,28) (12,40) (40,27) |
| `wall` | 북쪽 목책 | (50,11) (41,12) (56,14) (65,12) (64,12) (30,11) (70,11) |
| `egate` · `wgate` · `sroad` | 동문 · 서문 · 남쪽 길 | (93,40) (92,38) · (5,40) (6,41) · (50,68) (51,68) |
| `barn` · `obelisk` · `stone` | 창고 앞 · 오벨리스크 앞 · 이동의 돌 곁 | (33,38) (34,38) (31,39) · (56,36) (59,36) · (47,45) (44,45) |
| `cot1`…`cot5` (`in`) | 살림 마을 집들 | door fronts (5,26) · (12,25) · (5,39) · (11,39) · (6,47) |
| rounds | `r_fountain` `r_mail` `r_errand` `r_watch` (townfolk.js routes) · `r_night` 밤 순찰 | (41,12)→(30,11)→(5,40)→(50,68)→(93,40)→(70,11) |
| `diner_t1`…`t5` (sit) | 쥬쥬식당 식탁 | (5,6)(7,6) · (14,7)(16,7) · (9,8)(11,8) · (6,11)(8,11) · (14,11)(16,11) |
| `diner_bar` · `diner_hearth` (sit) · `diner_stage` · `diner_back` (`in`) | 바 · 난롯가 · 무대 · 살림방 | (12,4)(13,4)(15,4) · (3,8)(3,10) · (16,5) · (3,1) |
| `cafe_t1`…`t3` (sit) · `cafe_hearth` (sit) · `cafe_bar` | 테일즈 카페 | (7,9)(9,9) · (13,7)(13,9) · (2,6)(2,8) · (3,3)(7,3) · (13,5)(15,5) |
| `inn_hearth` (sit) · `inn_table` (sit) · `inn_beds` · `inn_up` (`in`) | 모닥별 여관 · 위층 객실 | (3,3)(7,3) · (3,7)…(7,7), (3,9)…(7,9) · (11,2)(13,2)(15,2) · (17,2) |
| `lib_hearth` (sit) · `lib_table` (sit) · `lib_nook` (sit) · `lib_stacks` | 부엉이 도서관 | (3,3)(6,3) · (15,7)(16,7)(17,7)(15,9)(16,9)(17,9) · (3,8)(5,8)(3,11)(5,11) · (2,6)(8,2) |
| `hall_seats` (sit) · `hall_desk` | 마을회관 | (3,6)(4,6)(14,6)(15,6) · (10,4)(12,4) |
| `merc_hearth` (sit) · `merc_table` (sit) · `merc_bench` (sit) | 용병사무소 | (16,3)(18,3) · (7,5)(10,5) · (3,10)(5,10) |
| `apt_lobby` · `apt_up` (`in`) | 동동아파트 로비 · 위층 | (8,6)(10,6) · (9,1) |
| `forge_floor` · `forge_back` (`in`) · `dojo_floor` · `store_floor` · `lab_floor` | 대장간 · 다락 · 수련관 · 잡화점 · 연금공방 | (4,2)(8,4)(10,7) · (2,2) · (5,7)(12,7)(8,10) · (6,6)(9,6) · (10,5)(14,8 sit) |
| `bout_floor` · `pet_floor` | 의상실 · 펫 돌봄집 | ~(8,6) · ~(5,5) |

## F. The cast — 61 in the town system (45 existing NPCs keep id, name, role, post; 16 residents promoted)

Reading: `place:act`; **post** = at the post working; `d0–d3` = cycle days; `☂` = where rain sends them; home is
where the last block ends (hidden). The five columns are the phases 새벽 4.5 · 아침 7 · 낮 11 · 노을 17 · 밤 19.5;
N3 turns them into blocks (lunch breaks 12–13 h, bedtimes 22–24 h) and may shift ±1 h. Willow's four
(`willow_elder` `willow_fisher` `willow_florist` `willow_bard`) and 은자 바스 stay static in N1–N3 (a plan is
optional later: places on `willow`).

### F.1 Outdoor services

| id · name | traits | home | 새벽 | 아침 | 낮 | 노을 | 밤 | off-duty line |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `elder` 엘더윈 (keeper) | 점잖음, 걱정 많음, 차 애호 | cot2 | home | post | post · 13h `cafe_t3`:drink+보리 (d1,d3) | `fountain`:stroll | `hall_desk`:work → 22h home | "새 모이를 주다 보면 근심이 좀 가라앉는다네." |
| `warp` 노바 (keeper) | 몽상가, 별지기, 건망증 | inn_up | `stone`:watch | post | post · 12h `cafe_bar`:drink (d0,d2) | post | `wall`:watch+까망 → 1h inn | "저 별은 이름이 없어. 그래서 좋아해." |
| `daily` 하루 (keeper) | 칼같음, 명랑, 아침형 | apt_up | post (새 과제 붙이기) | post | post · 12h `terrace`:eat+미미 | `hall_seats`:chat+해나 | home | "게시판은 내일 6시에 또 바뀌어. 난 그때 일어나고." |
| `shop` 리나 | 알뜰, 수다, 맏언니 | cot4 | `barn`:shop+도담 | post | post | post | `cafe_t1`:drink+루루 (d0,d2) · `bench`:rest (d1,d3) ☂cafe_hearth | "장부는 덮었어. 오늘은 코코아가 먼저야." |
| `dimkeeper` 오르카 (keeper) | 엄숙, 수수께끼, 단것 좋아함 | lib_nook | `obelisk`:watch | post | post · 15h `cafe_bar`:eat (d1) | post | post → 23h `lib_nook`:read | "…균열은 케이크처럼 층이 있다네. 비유일세." |
| `smith` 볼칸 | 무뚝뚝, 대식가, 의리 | forge_back | home | post | post · 12h `terrace`:eat+찍찍 ☂diner_hearth | post | `diner_t3`:eat+도담 (d0–2) · `diner_bar`:drink+캉캉 (d3) → 23h | "망치는 내려놨네. 지금은 숟가락 들 시간이야." |
| `train` 카이 | 열혈, 엄격, 아이들에겐 물렁 | dojo_floor | `yard`:train | post | post | `yard`:train+판판 | `diner_t2`:eat+아르센 (d0,d2) · `inn_table`:eat (d1,d3) | "수련은 쉬는 것까지가 수련이다. …방금 지어냈다." |
| `town_job_arsen` 아르센 | 학구적, 차분, 신중 | apt_up | home | `garden`:read | post | post | `diner_t2`:eat+카이 (d0,d2) · `lib_table`:read+몽 (d1,d3) | "길은 고르는 게 아니라 걸어 보고 아는 걸세." |
| `bank` 도담 | 꼼꼼, 느긋, 장사 | apt_up | `barn`:work+리나 | post | post · 12h `diner_t4`:eat | post | `diner_t3`:eat+볼칸 (d0–2) · `diner_hearth`:drink+바위 (d3) | "창고 열쇠는 주머니에, 걱정은 창고에 두고 왔지." |
| `collector` 몽 | 덜렁댐, 호기심, 올빼미 | lib_hearth | `lib_hearth`:sleep | post | post · `wall`:watch (d2, 목책 너머 관찰) | post | `lib_table`:read+아르센/피피 | "쉿, 저 울음소리… 도감에 없는 놈이야!" |
| `achieve` 루 | 단정, 자부심, 감상적 | apt_up | home | post | post · 12h `cafe_t2`:eat+모모 | post | `hall_desk`:work → 22h home | "오늘 일도 누군가의 기록이 되겠지요." |
| `costume` 루루 | 멋쟁이, 소문통, 통 큼 | cot4 | home | post | post · 13h `bout_floor`:chat+실비 | post | `cafe_t1`:drink+리나 (d0,d2) · `fire`:chat (d1,d3) ☂cafe_hearth | "그 망토엔 이 리본이지! …아, 퇴근했지 참." |
| `housing` 포근 | 넉살, 다정, 깔끔 | apt_up | home | post | post · 12h `terrace`:eat | post | `apt_lobby`:chat+동동 | "집은 사는 게 아니라 사는 곳이죠. 말장난 맞아요." |
| `guard` 토비 | 성실, 졸음, 동경 | apt_up | post | post | post · 13h `terrace`:eat | post | `merc_hearth`:rest+바위 (d0,d2) · `r_night`:watch (d1,d3) | "근무 끝! …이라고 말하면 꼭 뭔가 나타나던데." |
| `story` 소담 | 푸근, 이야기꾼, 귀 밝음 | cot1 | home | `bench`:tend+보들 (knit) | `lib_nook`:read | `fire`:rest | post (모닥불 이야기) → 1h home | "낮에는 이야기가 잠을 자요. 밤에 오렴." |
| `town_willow_guide` 다람 | 활달, 떠돌이, 길눈 | inn_up | home | post | post · 13h `market`:shop | post | `inn_table`:eat | "길은 다 이어져 있어. 식당으로도!" |

### F.2 Building hosts

| id · name | traits | home | 새벽 | 아침 | 낮 | 노을 | 밤 | off-duty line |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hall_bori` 이장 보리 | 수다, 마을 자랑, 깜빡 | cot1 | home | post | post · 13h `cafe_t3`:drink+엘더윈 (d1,d3) | `steps`:chat | `hall_seats`:rest → 22h | "우리 마을 자랑? 앉아 봐, 길어." |
| `hall_hana` 해나 | 수줍음, 성실 | apt_up | home | post | post · 12h `steps`:eat (펭이 지나는 시간) | `hall_seats`:chat+하루 | home | "저, 저는 그냥 계단에서 점심 먹는 게 좋아서요…" |
| `popo` 포포 | 수완, 속사포, 속정 | apt_up | home | post | post · `market`:chat (d0,d2 14h) | post | `diner_bar`:drink | "일자리? 지금은 내 잔부터 채우고!" |
| `lib_borum` 보름 | 조용함, 정숙 단속, 고양이 사랑 | lib_hearth | `lib_hearth`:sleep | post | post · 13h `garden`:rest | post | `lib_stacks`:work | "쉿. …밤의 도서관은 책이 숨 쉬는 소리가 나요." |
| `hall_pipi` 피피 | 모험심, 좀이 쑤심, 스케치광 | apt_up | home | post | `wall`:watch (d0) · `egate`:watch (d2) · post | post | `lib_table`:read+몽 | "지도는 발로 그리는 거야. 연필은 거들 뿐." |
| `hall_momo` 모모 | 정확, 마른 농담, 단것 | apt_up | home | post | post · 12h `cafe_t2`:eat+루 | post | `cafe_t2`:eat (d1) · home | "기록에 따르면, 저는 지금 쉬는 중입니다." |
| `merc_grey` 그레이 | 엄격, 공정, 옛 상처 | merc_table | `wall`:watch | post | post | `yard`:train | `merc_table`:work · `wall`:watch (d3, 혼자) | "밤의 목책은 조용할수록 귀를 세워야 하네." |
| `merc_mimi` 미미 | 발랄, 정리왕, 소문통 | apt_up | home | post | post · 12h `terrace`:eat+하루 | post | `cafe_t3`:drink+솜이 | "접수는 내일! 지금은 수다 접수 중~" |
| `merc_bawi` 바위 | 과묵, 향수, 낮잠 | merc_hearth | home | post (doze) | `pond`:fish+개굴 (d0,d2) · post | `merc_hearth`:rest | `merc_hearth`:rest+토비 (d0,d2) · `diner_hearth`:drink (d1,d3; d3 +도담) | "…낚시는 기다리는 싸움이지. 그건 내가 잘해." |
| `store_dari` 다리 | 쟁여 두기, 명랑, 흥정 | cot5 | `egate`:shop+너굴 (동문으로 들어온 물건) | post | post | post | `diner_t4`:eat+도토리 → 22h | "도토리 저 녀석, 또 주머니에 돌멩이를!" |
| `store_kong` 콩콩 | 의욕, 덤벙, 먹보 | apt_up | home | `r_errand`:walk (carry) | post | `fountain`:play+콩알 | home | "심부름 값은 붕어빵으로 받아요!" |
| `forge_tong` 통통 (볼칸의 `cover`) | 성실, 덤벙, 스승 바라기 | forge_back | home | post | post · 12h `forgeyard`:eat | post | post (야간 당번) → 23h | "스승님 안 계실 땐 제가… 아, 아니 잘할 수 있어요!" |
| `forge_musoe` 무쇠 | 말수 적음, 완벽주의, 온순 | apt_up | home | post | post | post | `inn_hearth`:rest+대나무 | "…갑옷은, 안 보이는 데를 더 다듬는 거요." |
| `kangkang` 캉캉 | 호탕, 통 큼, 웃음소리 | forge_back | home | post | post | post | `diner_bar`:drink (+볼칸 d3) · post (d2 야근) | "캉캉캉! 볼칸 그 녀석, 아직도 내 망치질엔 못 미치지!" |
| `juju` 쥬쥬 | 엄마 손, 잔소리, 요리 자부심 | diner_back | `market`:shop+꿀단지 | post | post | post | post → 1h home | "장은 새벽에 봐야 해. 좋은 건 먼저 가거든." |
| `diner_piri` 피리 | 자유로움, 흥, 빈 주머니 | inn_up | home | `inn_beds`:sleep (늦잠) | `fountain`:perform ☂cafe_hearth | `terrace`:perform ☂post | post (`diner_stage`에 노을) | "동전 말고 박수도 받아요. 동전이 더 좋지만." |
| `diner_reg1` 나비 | 쾌활, 애주가, 소문통 | apt_up | home | home | `fountain`:chat | post | post | "소문 하나 줄까? 대신 한 잔 사." |
| `diner_reg2` 뭉치 | 허풍 낚시꾼, 대식가 | apt_up | `pond`:fish | `pond`:fish | post | post | post | "아까 놓친 놈은 이만~했다니까!" |
| `inn_maru` 마루 | 손님맞이, 아침형, 걱정 | inn_up | post | post | post · 14h `market`:shop | post | post → 0h home | "이불은 볕에 말렸어요. 푹 주무세요." |
| `inn_lira` 리라 | 낭만, 극적임, 피리의 맞수 | inn_up | home | `inn_hearth`:rest | `garden`:perform (작곡) ☂lib_nook | post | post · `fire`:perform+노을 (d1) | "피리 그 사람 노래요? …나쁘진 않죠. 나쁘진." |
| `inn_toto` 토토 | 졸음, 수수께끼, 먼 길 | inn_up | post (doze) | post | `bench`:sleep ☂post | post | post · `wall`:watch (d1,d3 — 아무에게도 말 없이) | "…음? 목책? 난 그냥 산책을… 쿨." |
| `cafe_moka` 모카 | 차분, 완벽주의, 잘 들어 줌 | apt_up | `flowers`:tend+새싹 (허브) | post | post | post | post → 21h home | "허브는 새벽 이슬 맞은 게 향이 좋아요." |
| `cafe_somi` 솜이 | 몽상, 소설가 지망 | apt_up | home | home | post | `bridge`:stroll ☂post | `cafe_t3`:drink+미미 | "다리 위에서 첫 문장을 주웠어요. 아직 한 줄이지만." |
| `cafe_lumi` 루미 | 책벌레, 수줍음 | apt_up | home | `lib_nook`:read | post | `garden`:read (여름 곁, 따로) ☂lib_nook | home | "여, 여름 씨도 그 책을… 아, 아무것도 아니에요." |
| `bogle` 보글 | 괴짜, 흥분 잘함, 건망증 | lab_floor | `pond`:tend (이슬 받기) | post | post | post | post (d0,d2 야간 실험) · `diner_t5`:eat+개굴 | "이슬 세 방울, 개구리밥 한 줌… 어디까지 셌더라?" |
| `bout_silvi` 실비 | 꼼꼼, 수줍음, 도도 | apt_up | home | post | post (13h 루루 방문) | `laundry`:tend+리리 | home | "천은 거짓말을 안 해요. 사람보다 편하죠." |
| `dojo_panpan` 판판 | 유쾌, 절도, 죽순 간식 | dojo_floor | `yard`:train | post | post | `yard`:train+카이 | `diner_t2`:eat (d1,d3) · home | "카이 그 친구, 주먹은 빠른데 젓가락은 내가 빠르지!" |
| `dongdong` 동동 | 깐깐, 다정, 모르는 게 없음 | apt_up | `apt_lobby`:tend (sweep) | post | post | post | `apt_lobby`:chat+포근 | "302호는 오늘도 늦네. 아니, 흉보는 건 아니고." |
| `pet_monggeul` 몽글 | 온화, 동물 말동무, 졸음 | cot3 | home | post | post | `pond`:stroll (펫 산책) ☂post | home (+보들) | "얘들이 그러는데, 오늘은 당신 냄새가 좋대요." |

### F.3 Residents (plans = today's `townfolk.js` anchors, plus a home and the evenings; lines kept as `off`)

| id · name | traits | home | 새벽 | 아침 | 낮 | 노을 | 밤 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `r_dotori` 도토리 (kid, 다리의 아이) | 잠시도 못 있음 | cot5 | home | `pond`:play | `r_fountain`:play | `fountain`:play | `diner_t4`:eat+다리 → home |
| `r_kongal` 콩알 (kid, 콩콩의 동생) | 깔깔이 | apt_up | home | `pond`:play | `r_fountain`:play (lag 3) | `fountain`:play+콩콩 | home |
| `r_bodeul` 보들 할머니 | 온화, 뜨개질 | cot3 | home | `bench`:tend+소담 (knit) | `bench`:tend | `garden`:read | home (+몽글) |
| `r_neogul` 너굴 아저씨 (쥬쥬의 오빠) | 넉살 행상, 허풍 | inn_up | `egate`:shop+다리 (carry) | `market`:work | `market`:work | `terrace`:drink | `diner_t1`:eat → inn |
| `r_gaegul` 개굴 (보글의 사촌) | 낚시광, 비를 좋아함 | apt_up | `pond`:fish | `pond`:fish | `pond`:fish+바위 (d0,d2) | `pondfire`:drink | `diner_t5`:eat+보글 · home |
| `r_peng` 펭 (동동의 조카) | 부지런, 덜렁 | apt_up | home | `r_mail`:walk | `r_mail`:walk (12h `steps` 지남) | `steps`:rest | home |
| `r_saessak` 새싹 | 다정, 꽃 박사 | apt_up | `flowers`:tend+모카 | `flowers`:tend | `flowers`:tend | `flowers`:rest | home |
| `r_daenamu` 대나무 | 묵묵, 손재주 | apt_up | home | `wall`:work (hammer) | `wall`:work | `fountain`:rest | `inn_hearth`:rest+무쇠 |
| `r_meongdae` 멍멍 대장 | 허세, 겁 조금, 그레이 동경 | merc_bench | `wall`:watch | `wall`:watch | `r_watch`:watch | `wall`:watch | `r_night`:watch (d0,d2) · `wall`:watch+까망 |
| `r_kkamang` 까망 | 밤눈, 과묵 | merc_bench | `wall`:watch | `wall`:sleep (56,14) | `wall`:sleep | `wall`:watch | `wall`:watch (+노바 / +멍멍 대장) |
| `r_yeoreum` 여름 | 공부벌레, 엉뚱 | apt_up | home | `garden`:read | `steps`:work (write) | `garden`:read | `lib_table`:read (d0,d2) · home |
| `r_jjik` 찍찍 (통통의 동생) | 싹싹, 잠꾸러기 | forge_back | `forgeyard`:work | `r_errand`:walk | `forgeyard`:work · 12h `terrace`:eat+볼칸 | `terrace`:drink | home |
| `r_ggul` 꿀단지 (쥬쥬의 아이) | 엄마 자랑, 씩씩 | diner_back | `market`:shop+쥬쥬 | `terrace`:work (stir) | `terrace`:tend (sweep) | `terrace`:work | home |
| `r_riri` 리리 | 꼼꼼, 날씨 점쟁이 | apt_up | `laundry`:work | `laundry`:tend | `laundry`:tend (knit) | `laundry`:tend+실비 | home |
| `r_noeul` 노을 | 흥, 올빼미 | apt_up | home | home | `fire`:rest | `fire`:perform | `diner_stage`:perform+피리 (d0,d2,d3) · `fire`:perform+리라 (d1) |
| `r_bawi2` 반들 | 길 안내 좋아함 | apt_up | `bridge`:chat | `bridge`:chat | `bridge`:chat | `bridge`:rest | home |

### F.4 Full line sets for the leads (N3 writes the rest in the same voices; every string Korean)

| who | work | off | eat | with | rain | night |
| --- | --- | --- | --- | --- | --- | --- |
| 볼칸 | "쇠는 달궈졌을 때 쳐야 하네. 용건도 그렇고." | "망치는 내려놨네. 지금은 숟가락 들 시간이야." | "쥬쥬네 국밥은 두 그릇이 한 그릇이지." | "도담, 자네 창고엔 술은 안 맡아 주나?" | "비 오는 날은 불이 순해져. 일하긴 좋지." | "오늘 일은 오늘 식혔네. 자네도 쉬게." |
| 쥬쥬 | "앉아 앉아, 국물부터 한 숟갈 떠 봐!" | "장은 새벽에 봐야 해. 좋은 건 먼저 가거든." | "내가 한 건 내가 제일 맛있게 먹지." | "꿀단지, 손 씻었니? 두 번 씻어!" | "비 오는 날엔 전이지. 아무렴." | "막차 손님까지 든든히 먹여 보내야 발 뻗고 자." |
| 펭 | "편지 왔어요! …아, 당신 건 아니네요." | "오늘 배달 끝! 다리가 편지처럼 접혔어요." | "빵은 걸으면서 먹어야 제맛이에요." | "삼촌, 로비 바닥 또 닦았어요? 미끄러워요!" | "편지가 젖으면 글씨가 울어요. 뛰어야 해요!" | "밤 편지는 내일 아침 첫 번째로 갈게요." |
| 토토 | "…쿨… 아, 안 잤어요. 눈으로 쉬는 중." | "먼 길을 걸으면, 앉는 법부터 배우지." | "여관 스튜는 어느 마을보다… 쿨." | "마루 씨, 방값은 이야기로 내도 되나?" | "비 냄새가 옛길 냄새랑 같군." | "…음? 목책? 난 그냥 산책을… 쿨." |
| 루미 | "이 책, 세 번째 읽는 중이에요. 처음처럼요." | "여, 여름 씨도 그 책을… 아, 아무것도 아니에요." | "케이크는 책갈피처럼 얇게 잘라 주세요." | "…" (책 뒤로 숨는다) | "빗소리는 쪽 넘기는 소리랑 닮았어요." | "한 장만 더 읽고… 벌써 밤이네요." |
| 보름 | "쉿. 책은 제자리에, 발소리는 살금살금." | "뜰의 고양이가 오늘은 다섯 마리예요." | "(작게) …도서관에선 과자 금지예요. 저만 빼고." | "몽 선생님, 그 책 반납일이 삼 년 지났어요." | "비 오는 날 책 냄새가 제일 좋아요." | "쉿. …밤의 도서관은 책이 숨 쉬는 소리가 나요." |
| 소담 | "옛날 옛적, 숲이 아직 푸르던 때에…" | "낮에는 이야기가 잠을 자요. 밤에 오렴." | "이 나이엔 죽 한 그릇이면 든든해요." | "보들아, 그 목도리 내 이야기보다 길구나." | "비 오는 날 이야기는 지붕 밑에서 하는 법이지." | "불가에 앉으렴. 오늘 이야기는 조금 무섭단다." |
| 그레이 | "의뢰는 게시판에. 목숨은 스스로 챙기게." | "검은 쉬어도 눈은 못 쉬는 게 이 일일세." | "먹어 둘 수 있을 때 먹어 두게. 전장의 첫 수칙이야." | "멍멍, 짖기 전에 세 번 보라고 했지." | "비는 발소리를 지워 주지. 놈들 것도." | "밤의 목책은 조용할수록 귀를 세워야 하네." |

## G. Relationships (`life.json rel`; kinds frozen)

What a kind does — `friend`: may be each other's `with` (walk together, neighbouring spots, same table), paired
chat · `family`: `friend` + shared home, a kid follows the parent home · `mentor`: `friend` + the junior may be
the senior's `cover` · `rival`: banter lines when ≤ 3 tiles apart, `train` together in the yard · `crush`: never
`with`; when ≤ 4 tiles apart the shy one turns away with "…" · `avoid`: data:check refuses the same place.

| a — b | kind | one-line story |
| --- | --- | --- |
| 볼칸 — 도담 | friend | 저녁마다 같은 식탁, 한 사람은 말이 없고 한 사람은 느리다 |
| 볼칸 — 캉캉 | rival | 같은 스승 밑의 사형제. 넷째 날 밤에만 바에서 나란히 마신다 |
| 볼칸 — 통통 | mentor | 스승이 식당에 간 밤, 견습생이 모루를 지킨다 |
| 통통 — 찍찍 | family | 생쥐 남매. 점심은 대장간 마당에서 |
| 리나 — 루루 | friend | 한 집에 사는 단짝. 장부와 리본 이야기로 코코아가 식는다 |
| 루루 — 실비 | mentor | 의상실 주인과 재봉사, 낮 한 시의 가봉 시간 |
| 실비 — 리리 | friend | 노을의 빨래터에서 천을 같이 넌다 |
| 하루 — 해나 | family | 게시판지기 남매. 노을에 회관 의자에서 하루를 맞춰 본다 |
| 해나 — 펭 | crush | 펭이 계단을 지나는 정오에 해나는 꼭 거기서 점심을 먹는다 |
| 루미 — 여름 | crush | 노을의 도서관 뜰, 같은 책, 두 자리 건너 |
| 카이 — 판판 | rival | 노을마다 수련 마당에서 겨루고 밥값을 건다 |
| 카이 — 아르센 | friend | 주먹과 책, 이틀에 한 번 같은 식탁 |
| 아르센 — 몽 | friend | 밤의 도서관 탁자, 서로 책을 안 돌려준다 |
| 몽 — 피피 | friend | 도감과 지도, 목책 너머를 같이 궁금해한다 |
| 루 — 모모 | friend | 기록하는 두 사람의 점심 케이크 |
| 엘더윈 — 보리 | friend | 관리자와 이장의 이틀 걸러 차 한 잔 |
| 소담 — 보리 | family | 이야기꾼 할머니의 아들이 이장. 한 집에 산다 |
| 소담 — 보들 | friend | 아침 벤치의 오랜 벗, 뜨개질과 옛이야기 |
| 보들 — 몽글 | family | 할머니와 손녀, 살림 마을 셋째 집 |
| 쥬쥬 — 꿀단지 | family | 새벽 장보기는 늘 둘이서 |
| 쥬쥬 — 너굴 | family | 식당 주인과 행상 오빠, 외상은 사절 |
| 다리 — 도토리 | family | 잡화점 주인과 술래잡기 대장 |
| 콩콩 — 콩알 | family | 심부름꾼 형과 동생, 노을의 분수 |
| 동동 — 펭 | family | 관리인 삼촌과 우체부 조카 |
| 동동 — 포근 | friend | 밤의 로비에서 집 이야기 |
| 보글 — 개굴 | family | 개구리 사촌, 실험과 낚시의 저녁 |
| 개굴 — 바위 | friend | 말 없는 낚시 친구 (d0, d2) |
| 도담 — 바위 | friend | 넷째 날 밤, 식당 난롯가의 느린 두 사람 |
| 바위 — 토비 | mentor | 은퇴한 용병이 젊은 경비병의 밤 근무 이야기를 들어 준다 |
| 그레이 — 멍멍 대장 | mentor | 단장을 닮고 싶은 자칭 대장 |
| 멍멍 대장 — 까망 | friend | 목책의 밤 짝. 한쪽은 짖고 한쪽은 본다 |
| 노바 — 까망 | friend | 별 보는 사람과 밤눈 밝은 아이 |
| 하루 — 미미 | friend | 게시판과 접수대, 야외석의 점심 |
| 미미 — 솜이 | friend | 카페의 밤 수다, 소설의 첫 독자 |
| 모카 — 새싹 | friend | 새벽 꽃밭의 허브 |
| 대나무 — 무쇠 | friend | 말수 적은 두 장인의 난롯가 |
| 피리 — 노을 | friend | 식당 무대의 이중주 |
| 피리 — 리라 | avoid | 맞수 음유시인. 같은 무대엔 서지 않는다 (퀘스트 G에서만 말이 오간다) |

## H. Player-facing

- **Map window (`radar.js #w-map`)**: a `주민` tab — the cast grouped by where they are now, one line each:
  "대장장이 볼칸 — 쥬쥬식당 (식사 중) · 아침에 대장간으로". Data = `nw` (asked on open and when a listed
  `nextLs` passes, ≤ 1 per 20 s). Filter chips: 서비스 · 퀘스트 · 주민. Click a line → `추적`.
- **Track** (client only, one at a time): radar arrow + map marker on the body; on another map the arrow points to
  the door on the way (`defs.maps[].to` / town doors). Active quest targets get the same marker automatically.
- **Radar**: bodies on your map are dots from `nl` (service glyphs stay on posts); a tracked one pulses.
- **Talk window**: under the name, "지금: 식사 중 · 쥬쥬식당"; lines picked by situation (`with` > `rain` >
  `night` > the act's key); trust tier badge (단골/친구/가족) when `rep` ≥ 10; at 친구 the NPC adds where it will be
  next ("이따 밤엔 식당에 있을 걸세").
- No new window; nothing on the HUD until the player opens the map or takes a quest.

## I. Quests on top (N4)

### I.1 Rules added to side quests (`62-side-quests.js`, `data/quests.json`)

- Goal **`meet`**: `{ "type": "meet", "npc": id, "at"?: placeId | "map:<id>", "phase"?: ["dawn"|"morn"|"noon"|"dusk"|"night"],
  "act"?: actKey, "with"?: npcId, "days"?: [0–3], "item"?: [itemId, n] }`. Action `{t:"sq", a:"meet", id:<questId>}`:
  the body (not the post, not a knock) within reach, every condition true at `S.now` (`with` = both bodies in the
  same place), the item in the bag (taken). Errors in Korean say what is missing ("밤에 다시 찾아가 보세요",
  "지금은 혼자가 아닙니다", "여기서는 이야기하기 어렵습니다"). Missed the hour → come back next day; nothing fails.
- Quest fields: `grant: [[item, n]]` (given on take, taken back on drop) · `auto: true` (pays on reaching the goal,
  no walk back) · `hint` (Korean, quest window: "밤 · 쥬쥬식당") · `reward.rep: [[npcId, n]]` (`addRep`; ≤ 5 a step,
  ≤ 12 per NPC from all quests, so 알바 stays the main road) · `req.rep: [npcId, tier 0–2]`.
- Quest items: `ITEMS` type `quest` (no sell, drop, warehouse, quick slot): `q_lunch` 쥬쥬의 도시락, `q_letter`
  펭의 편지, `q_book` 빌린 책, `q_bouquet` 들꽃 다발, `q_page` 도감의 낱장, `q_ward` 낡은 부적.
- Rewards: XP/gold of the existing side quest nearest in level (`quests.json`); a `meet` step pays 0.6×, a line's
  last step 1.5× + items + `rep`. Table values below are final unless a test finds the economy guard objects.

### I.2 The eight lines (each step is one quest chained by `req.quest`; ids `sq_<line>_<n>`)

| line · lv | steps (giver → goal) | last reward |
| --- | --- | --- |
| **H 「편지 왔어요」** · 3 · teaches the map list | 1 `r_peng` → meet `daily` with `q_letter` (auto) · 2 meet `hall_hana` at `steps`, phase noon, with `q_letter` (she asks who sent it) · 3 meet `smith` anywhere with `q_letter` — "그 아저씨는 해 지면 대장간에 없어요" | 375 xp · 255 g · `recall`×2 · rep 펭 +5 |
| **A 「대장장이의 저녁」** · 5 → 10 | 1 `juju` → grant `q_lunch`, meet `smith` at post, phase morn (정오 전에) · 2 `smith` → kill `splitboar`×8 (lv 10, 식당에 낼 고기) · 3 `smith` → meet `smith` at `map:juju_diner`, phase night, act eat (술친구) · 4 `kangkang` → meet `kangkang` with `smith`, days [3], phase night (사형제의 건배) | 1350 xp · 600 g · `stone`×2 · rep 볼칸 +5, 캉캉 +3 |
| **D 「두 책벌레」** · 8 | 1 `cafe_moka` → meet `cafe_lumi` at `map:tales_cafe` (grants `q_book`) · 2 meet `r_yeoreum` at `steps`, phase noon, with `q_book` · 3 `r_saessak` → meet `r_saessak` at `flowers`, phase dawn/morn (grants `q_bouquet`) · 4 meet `r_yeoreum` at `garden`, phase dusk, with `cafe_lumi`, item `q_bouquet` — the two read side by side | 975 xp · 450 g · `food_m`×3 · rep 모카 +5 |
| **E 「사서의 잃어버린 낱장」** · 12 | 1 `lib_borum` → meet `pet_monggeul` at `pond`, phase dusk (병아리가 물고 갔다) · 2 meet `r_dotori` at `fountain`, act play · 3 meet `r_gaegul` at `pond`, phase dawn/morn (낚아 올린 낱장) · 4 kill `gutfrog`×8 (삼킨 놈) · 5 meet `lib_borum` at `lib_stacks`, phase night | 1665 xp · 615 g · `sc_xp`×1 · rep 보름 +5 |
| **B 「밤의 수상한 나그네」** · 15 | 1 `guard` → meet `inn_toto` at `map:starlight_inn` (he dozes it off) · 2 meet `inn_toto` at `wall`, phase night (days 1, 3 — find him on the map) · 3 `inn_toto` → kill `eyecrow`×10 (grants `q_ward` on done) · 4 meet `merc_grey` at `wall`, phase night, days [3], item `q_ward` — the old ward-keeper's secret | 2100 xp · 700 g · `hp_m`×5 · rep 그레이 +5 |
| **F 「소담 할머니의 옛 친구들」** · 20 | 1 `story` → meet `r_bodeul` at `bench`, with `story` (morn) · 2 meet `merc_bawi` at `pond`, act fish · 3 meet `elder` at `fountain`, phase dusk · 4 meet `story` at `fire`, phase night — the tale of the first settlers | 2865 xp · 765 g · `inn_bread`×3 · rep 소담 +5 |
| **C 「경비대의 밤 순찰」** · 33 | 1 `r_meongdae` → meet `r_meongdae` at `wall`, phase night · 2 meet `r_kkamang` at `wall`, phase night, with `r_meongdae` · 3 `merc_grey` → kill `ribdeer`×8 · 4 meet `merc_grey` at `wall`, phase dawn (새벽 보고) | 9900 xp · 1485 g · `stone`×2 · rep 그레이 +5 |
| **G 「쥬쥬식당 잔칫날」** · 40 · `req.rep` 쥬쥬 단골 | 1 `juju` → collect `fish_m`×5 · 2 meet `r_neogul` at `market`, phase dawn (새벽 물건) · 3 meet `inn_lira` at `map:starlight_inn`, phase dusk · 4 meet `diner_piri` at `map:juju_diner`, phase night, with `r_noeul` · 5 meet `juju`, phase night | 21000 xp · 1950 g · `food_l`×3 · rep 쥬쥬 +8 |

Kept: the 15 existing side quests unchanged (their `talk` goals work at posts). `follow`/`escort` are not built:
"following" is finding a moving person with the map list, which costs no rules.

## J. Budgets (N1/N2 measure and report)

| what | bound |
| --- | --- |
| tick cost, no player on any town-system map | 0 (no code runs) |
| tick cost, occupied map | 1 compare; a boundary tick ≤ 0.3 ms |
| block tables at load (61 cast × 4 days, no paths) | ≤ 15 ms total (`tests/npclife.mjs` bound 60) |
| one path (town 100×76 BFS), cached | ≤ 2 ms (bound 8); ≤ 400 cached paths |
| `npcAt` warm | ≤ 5 µs |
| `nl` on arrival | ≤ 25 B per body present: town ≤ 1.2 KB, a room ≤ 300 B (the map payload it rides with is far larger) |
| `nl` afterwards | ≈ 0; one row (≤ 60 B) per leg begun on your map — town average < 10 B/s, never > 6 rows in one snapshot |
| `nw` | ≤ 1.2 KB, only on request |
| `defs.life` | ≤ 24 KB once |
| client | ≤ 24 bodies animated (nearest), rest still; town render ≤ +0.25 ms/frame over today's residents |

## K. Work split (in order; N2 ∥ N3 after N1's first commit)

| task | owns | does | accepts when |
| --- | --- | --- | --- |
| **N1 rules** (default model) | `src/logic/62-npc-life.js` (new), `70-validate.js` (`npcReach` in place of `npcNearId`), `80-simulation.js` (`rt.lifeNext`), `90-views-api.js` (`nl nw defs.life`), `62-daynight.js` (소담 from her plan), `scripts/build-logic.mjs` + `editor-lib.mjs` + `editor/validate.js` (life.json), `data/life.json` (places of E + a 6-member sample: smith, bank, juju, forge_tong, r_peng, story), `docs/editor/SCHEMA.md`, `tests/npclife.mjs`, `logic.d.ts` | sections B, C.1–C.3, D | `npclife.mjs`: same `now` ⇒ same answer on two worlds; every leg walkable, ends where the next begins; no two bodies on one spot over 4 cycle days at 1-min steps; door crossing = two rows; services pass at every hour at every post; `talk`/`take`/`done` reachable at every hour for every NPC; budgets of J; old tests green |
| **N2 client** (default model) | `public/npclife.js` (new; delete `townfolk.js`), `scene2d.js` (bodies, post signs, door fade), `decor.js postSign`, `client.js` (F prompt, talk header, chip `이야기`, `onSnap nl nw`), `radar.js` (주민 tab, track, dots), `sidequests.js` (cards from the chip), `hud.css`, `tests/town.mjs` (resident section → reads life.json) | C.4, H | page errors none; 3 shots: plaza at noon, diner at night (볼칸 + 도담 at `diner_t3` with bubbles), map window 주민 tab; a body crossing a door seen from both sides (`bots.mjs` or two tabs) |
| **N3 content** (sonnet; data only) | `data/life.json` `cast` `rel` lines | F (all 61 plans), G (all edges + `chat`), F.4 voices for everyone (≥ 9 lines each) | `npm run data:check` clean (capacity, trips, `with` agreement); `defs.life` ≤ 24 KB |
| **N4 quests** (default model for rules, sonnet for text) | `62-side-quests.js` (`meet`, `grant auto hint rep`), `10-tables.js` (quest items), `50-loot-combat.js` (quest-item guards), `data/quests.json`, `sidequests.js` (hint line), `tests/npcquests.mjs`, `data.mjs` | I | each line finished by a scripted player moving the clock; wrong hour/place/companion refused in Korean; dropped quest returns its grant; `rep` caps; economy guard test green |

Every task: `npm run test:rules`, `typecheck`, `check:split`; rules + rebuilt `logic.js` in one commit; an
"N<n> as built" section here (deviations only) and the status row in `docs/design/README.md`.

### K.1 For the integrator — mapping a Codex implementation (`codex/work`) onto this contract

Keep whatever Codex built that already satisfies these; change the rest to match, in this order of importance:
1. `L.npcAt(id, now)` exists, is pure (no state, no RNG, no tick movement) and returns the B.1 shape.
2. Services are validated at the static posts; `npcNear` behaves as before at every hour (section D).
3. Plans live in `game/data/life.json` with `places / cast / rel` (a `schedules.json` or a table in code is
   converted by script; field names of C.1).
4. Wire is `snap.nl` leg rows + on-request `nw` + `defs().life`; no NPC positions in every snapshot, no plans or
   path finding in the client.
5. Residents are cast members; `townfolk.js` is gone; no second mover.
6. Quest/talk reach = body ∪ post ∪ knock (`npcReach`); `meet` is the only new goal; the sheet stays v12.
Place ids (E), cast ids and the relationship kinds (G) are the vocabulary N3/N4 data is written in; Codex names
that differ are renamed, not aliased.
