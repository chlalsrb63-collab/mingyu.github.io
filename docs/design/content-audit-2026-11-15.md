# Content audit 2026-11-15 — life, items, side-quest arcs, cosmetics, story

**Design only.** The owner's order: audit every piece of content, compare with other MMORPGs, then add and
balance life content, items, story-driven side quests (few, with a story, not monotonous), hero cosmetics and
the story. Counts come from scripts that load the built rules (`L.defs()`, `data/*.json`) on `main` @ `2909748`.
Numbers in §3 follow `economy-review-2026-11-15.md` §6 (kill gold × 0.4; 알바 board 120 + 24·L, × 1/1.6/2.5;
co-op × 2.5). **Skills: separate task** (job colour icons, balance, felt passives) — not designed here.

Contents: §1 inventory · §2 gaps vs reference games · §3 packages P1–P12 in build order · §4 what not to add ·
§5 heads-up list for Codex's 64×64 hero conversion · §6 owner decisions.

---

## 1. Inventory (numbers)

### 1.1 Items — 199 in `ITEMS`

| type | n | notes |
| --- | ---: | --- |
| weapon | 54 | 7 kinds × tiers 1–5 (35) + 정찰대 t4/t5 (14) + 5 uniques |
| armour, jewellery | 30 | helm/armor/gloves/boots/ring/amulet × t1–5; + 8 set pieces (장막·꽃무덤, no `type` field) |
| legendary affixes · sets · runes · runewords | 8 · 5 · 9 · 6 | `legend`, `sets` (개척자, 네온 러너 …), `runes`, `runewords` |
| pot · buff · revive | 6 · 8 · 1 | HP/MP s/m/l; 3 주문서 + 5 엘릭서 (same three buffs, longer) + 신속의 물약; 부활 깃털 |
| food | 18 | **every food = heal + xp % (+ atk %)**; 5 fish dishes, 5 cook dishes, 5 cafe, 2 inn, 숯덩이 |
| fish | 5 | 송사리, 무지개 송어, 은빛 메기, 동굴 장님고기, 황금 잉어 — one per life grade |
| lmat (life materials) | 20 | herb/ore/wood × 5 grades + 5 ingots |
| mat · scroll · camp · tool | 12 · 1 · 1 · 2 | 강화석, 축복 강화석, 저주 해제, 초기화 주문서 2, 되새김 인장, 보스 재료 2 · 귀환 · 모닥불 · 홈 송곳, 명장의 숫돌 |
| furn | 19 | **all bought in the shop**; none crafted |
| pet | 4 | 병아리, 꼬마 박쥐, 도깨비불 (shop) + 꼬마 먹장어 (boss); **all four do the same thing** (loot pickup, radius 56–104) |
| quest / keepsake | **0** | no quest items, no collectibles, no trade goods |

### 1.2 Life skills — 6 skills, Lv 1–50, 5 grades (1/10/20/30/40), 명장 at 50

| | value |
| --- | --- |
| XP to Lv 50 | 431,250 (bands L1–10 / 11–20 / 21–30 / 31–40 / 41–50 = 4,250 / 25,250 / 66,250 / 127,250 / 208,250) |
| XP per action by grade | 8 / 14 / 22 / 34 / 50 (stale: grade unlocked 20+ levels below → × 0.25) |
| actions per band at the band's grade | **531 / 1,804 / 3,011 / 3,743 / 4,165** = 13,254 per skill (≈ 55 h at 4 actions/min) |
| what a level unlocks | only the next grade every 10 levels, and the 명인 title + cosmetic at 50; nothing in between |
| recipes | 91: 제작 65 (**52 are the gear table again**, 13 others), 연금 14, 요리 12 |
| recipe value (shop price out ÷ inputs + fee) | 48 at 0.9–1.3, 23 at 1.3–2, 8 ≥ 2, **12 below 0.9**: 여관 스튜 0.62, 신속의 물약 0.56, 부활 깃털 0.48, 장님고기 찜 0.79, 연금 정수 0.80, t2 craft of 모자·장갑·장화·반지·목걸이 0.60–0.76 |
| gather nodes | 3 kinds (약초 광맥 통나무), channel 2.4 s, 5 min per-node cooldown; `mapGrade`: g1 town/meadow/willow, g2 forest/crypt, g3 city/sewer/jungle, **g4 = 7 maps (Lv 93–165)**, g5 maple + frostkeep only |
| fish | 5 species for 5 grades; no per-map fish, no records, no fish collection |
| materials never consumed | none among herbs/ore/wood/fish (good); 초기화/해제 scrolls are by design |

### 1.3 알바 board, chores, co-op

| | count |
| --- | --- |
| board rows (`jb`) | 69 · kind: bring 15, make 13, deliver 12, hunt 10, fish 8, chore 6, scout 5 · skill: gather 28, deliver 20, fish 8, cook 6, **alch 4, craft 3** |
| rows by life level | L1 18, L3–10 18, L15–28 19, L30 6, **L31–50: 3** (ore L40, gather L48, cook L50); 4 hunt/scout rows at character Lv 68–156 |
| givers | 36 NPCs; 버드나무 마을 has 4 rows + 6 chores (우유 배달, 제초, 전단지, 쓰레기, 꽃밭 물주기, 강아지 산책) |
| pay | 4 jobs a day (4 offers + 2 chores), life XP = 25 % of the current level per job |
| co-op | 4 shifts (동동아파트 청소, 쥬쥬식당 서빙, 캉캉대장간 단조, 보글연금공방 가마), once a day each |

### 1.4 Quests

**Main chain (`QUESTS`): 39 quests, 39 are "kill N" or "kill the boss".** Story text lives in quests 0–2 (작은꼬리들,
네온 시티의 함락, 피난), 30–31 (병이 뿌리를 타고 왕도로) and 38 (비석); the other 33 texts describe how a monster attacks.
One voice tells all of it (관리자 엘더윈). Two `mainChapter` side quests: `sq_job_free` (Lv 150), `sq_lunelsha_tablet` (Lv 200).

**Side quests: 34** · goals kill 23, talk 8, collect 2, visit 1 · one repeatable · 24 givers.

| band | main quests (by mob level) | side quests | quest givers out in the field |
| --- | ---: | ---: | --- |
| 1–25 | 5 | 14 | 울타리지기 마루 |
| 26–60 | 7 | 10 | 느티, 오로, 치치 |
| 61–100 | 7 | **4** (Lv 93, three at 100) | 토룩, 노을 |
| 101–150 | 11 | **5** | 울로, 유리 |
| 151–200 | 9 | **1** (+ `sq_job_free`) | 비석 only |

Main-chain map gaps: **산호 해안 (101–125) and 붉은바위 황금궁 (141–165) have no main quest**, 정글·운해 사원 one boss
each. **정글, 산호 해안, 모래바다, 운해 사원, 붉은바위, 단풍 왕도 have no NPC at all.**

Side reward scale is inconsistent: `sq_borum_blight` (Lv 150) pays 1.02 M XP = 45 % of a level while
`sq_lantern_abyss` (Lv 137) pays 90 k = 5 %. Duplicates: 창자 개구리 is hunted by main 1 + `sq_willow_frogs` +
`sq_borum_frogs`; 쌍두 토끼 by main 0 + `sq_merc_hares` + `sq_lantern_fence`.

**Already designed, not built:** `npc-life.md` §I (N4) — a `meet` goal, quest items (`q_lunch` …), `grant`/`auto`/`hint`,
`reward.rep`, and eight town lines (H, A, D, E, B, F, C, G) at Lv 3–40. §3 builds on it and does not repeat those town lines.

### 1.5 NPCs and story sources

| source | content |
| --- | --- |
| editor maps + `npcs.json` | 73 NPCs, 70 with lines, 169 lines (avg 2.3); silent: 게시판, 공동 부엌 화덕, 버들의 수리대 |
| `npclife.json` | 61-member cast with traits, homes, routines, relationships (`rel`) — **relationships are not used by any quest yet** |
| 버드나무 마을 | 13 NPCs (촌장 버들, 갈대, 봄이, 솔, 음메, 수국, 팔랑, 쓱싹, 감자 …): 1 quest giver, 2 side quests |
| `11-mob-lore.js` | one bestiary line per monster (150) — good flavour, read only in the 도감 |
| `lunelsha-story.md` | three reveals: opening (피난), Lv 100 (바람등호 log), Lv 200 (조상의 변이 흑마법). **What woke the spell is undecided.** |
| `willow-job-economy.md` | 버드나무마을 = 피난민 supply base; 12 job designs, no story people among the 피난민 |
| 등불 thread (모리 + 7 trail keepers) | the best existing side story (등불 that lost its way home), but 7 of its 10 steps are "kill 5" |

### 1.6 Cosmetics, titles, housing, pets, events

| | count |
| --- | --- |
| cosmetics | 108 · hat 38, top 25, back 20, **face 13, wskin 12** · source: shop 45, ach 26, chest 11, boss 9, daily 8, rift 5, weekly 3, **quest 1** (여우 탈) |
| sets (`cosSets`) | 10 sets of 3–6 pieces: 바닷가, 사막 여행자, 밀림 탐험가, 동방 사원, 던전 탐험가, 생활 명인, 가족의 선물, 균열, 포근포근, 협동 알바 |
| art keys (`wardrobe.js`) | HAT 25, TOP 21, BACK 17, FACE 12 shapes; the 108 ids are palette variants of them; **no dye, no pattern, no trim** |
| missing sources | village, season/festival, story keepsake, life levels below 50, co-op grade, fishing records |
| achievements | 67 (사냥 19, 생활 21, 함께 8, 성장 7, 장비 5, 숙련 4, 탐험 3) · 41 give a title · 17 a bonus · **no story or quest titles** |
| housing | 3 house tiers, 19 shop furniture, 4 floors, 5 wallpapers; no crafted, quest or trophy furniture |
| collection | 15 monster groups (30 kills each); no fish or keepsake collection |
| events | half-hourly 차원 균열 (14 maps), 3-floor rift raid, weekly boxes, dailies, day/night; **no calendar season, no festival** |

---

## 2. Gaps against reference games

| area | reference | what Tales Tales lacks or does monotonously |
| --- | --- | --- |
| quest variety | FFXIV/WoW chains: characters recur, the goal changes every step (talk → gather → make → fight a named foe → choose) | 62 of 73 quest steps are "kill N"; 0 make/deliver/choice; no quest items; no recurring character outside 등불 and 바위 |
| town storylines | MapleStory town arcs (Henesys, Ludibrium), 테일즈위버 character episodes | 버드나무 마을's 13 villagers have no story; 피난민 have no faces; 6 hunting maps have no NPC at all |
| main story | FFXIV MSQ alternates fights with "story beats" (talk, travel, cutscene) | 39 straight kill quests; the story stops between Lv 22 and Lv 157; two maps skipped |
| life skill depth | Mabinogi: each rank unlocks a recipe/technique, part-time jobs per NPC; FFXIV: leves, masterbooks, gathering buffs | a life level unlocks nothing except every 10th; recipes are copies of the gear table; no food or tool that helps life work; L31–50 has 3 board rows |
| life economy | Black Desert: village produce, trade goods, workers | no village produce or trade goods; furniture not craftable (wood has one sink); 12 recipes lose money |
| collecting | Stardew/Animal Crossing fish & museum; Maple monster book | 5 fish total, no records, no fish book; no keepsakes or display shelf |
| relationships | Stardew hearts and heart events | `rep` tiers give a title and a discount; `npclife.rel` is unused by quests |
| cosmetics | MapleStory/Mabinogi: themed full sets, dyes, seasonal outfits, story rewards | 1 quest cosmetic; no dye; face/wskin thin; no season or village set; sets of 3–6 pieces across random slots |
| consumables | Ragnarok/Maple: clear roles (cure, resist, travel, life) | foods differ only in numbers; nothing for gathering speed, fishing luck, crafting quality, travel |
| events | Maple/Mabinogi seasonal festivals, weekly village market | only the half-hourly rift |

**By level band — where a player runs out of things that are not grinding:**
- **1–25** fine (town, 버드나무, N4 lines). **26–60** fair. **61–100** thin: 4 side quests, all town-side; 네온 시티 is
  the story's fallen city yet has one NPC. **101–150** thin: 6 overworld maps, 2 givers. **151–200** empty: 단풍 왕도
  holds 8 main kill quests and zero people.
- Life L31–50 is the longest grind (60 % of all actions) with the fewest jobs, recipes or rewards.

---

## 3. Packages (build order; one agent task each)

**Order rule (owner, 2026-11-15):** non-art packages first (P1–P8). Every cosmetics or hero-art package (P9–P12)
waits **until Codex's 64×64 hero conversion lands**, so nothing is drawn twice. Arc rewards that will become
cosmetics are handed out now as **keepsakes** (기념품, no stats); P9 lets 루루 의상실 sew each keepsake into its outfit
piece, so early players lose nothing.

**Reward scale for every new quest step** (fixes the 1.02 M vs 90 k mess): XP = 15 % of `lvt[Lv]` (arc's last step
30 %), gold = 30 × Lv (last step × 2), no 강화석 above 2. At Lv 57 that is 8.4 k XP / 1.7 k G, at Lv 137 264 k / 4.1 k —
in line with the 등불 steps, well under one day of 알바 (≈ 12–13 k G), so 알바 stays the gold road.

### P1 — 퀘스트 엔진: make · deliver · elite · choice · keepsake (rules) · size M
- **Goal:** the goal types an arc needs. Build `npc-life.md` §I.1 as written if N4 has not landed (`meet`, `grant`, `auto`,
  `hint`, `reward.rep`, quest items), plus:
  - `make {item, n}` — counts only outputs of the player's own craft/cook/brew (hook where `gainLife` pays a recipe).
  - `deliver {npc, item, n}` — `grant` gives the item on take; talking to `npc` takes it and completes.
  - `kill {mob, n, elite:1}` — counts elite kills only ("정예 철문 들개"); `named` text comes from the quest, no new mob.
  - `choice` on a quest: `choice: [["label", flag], ["label", flag]]`; turn-in sends `{t:"sq", a:"done", id, pick:0|1}`;
    `ch.sq.flags[id] = pick`; `req.flag: [questId, pick]` lets a later step branch; `reward` may be `[rwA, rwB]`.
  - `reward.cos`, `reward.title` (new title list `QUEST_TITLES`, shown with achievement titles), `reward.keep`.
  - ITEMS types `quest` (no sell/drop/warehouse, taken back on drop) and `keep` (기념품: no stats, no sell, 1 each,
    lives in `ch.keep: {id: 1}` not the bag).
- **Touches:** `62-side-quests.js`, `10-tables.js` (types), `40-characters-world.js` (`newChar`/`migrate`: `sq.flags`,
  `keep`, bump `v`), `70-validate.js`/`75-apply.js` (pick), `90-views-api.js` (defs: titles; `self.keep`), `docs/editor/SCHEMA.md`.
- **Tests:** `tests/sidequest.mjs` cases for each goal; choice branch; keepsake not sellable; old sheet without `keep`.
- **Art:** none.

### P2 — 기념품 상자 and quest dialogue UI (client) · size S
- **Goal:** the client side of P1: two buttons on a choice turn-in, progress text for make/deliver/elite, a 기념품 tab
  in the 도감 window (keepsake name, desc, which arc), quest titles in the title picker. Uses the existing 추적 button.
- **Touches:** `public/win_quests*.js` (or the quest window file in `docs/FILEMAP.md`), `client.js onSnap` for `self.keep`,
  `hud.css`. **Art:** keepsake icons code-drawn 12×12 in the existing item-icon style (not hero art).

### P3 — Arcs A1 + A2: 버드나무와 네온 시티의 피난민 (data) · size M
**Built 2026-11-15 — see [arcs.md](arcs.md)** (steps, branches, retired quests, new NPC lore; tests in `tests/sidequests.mjs`).
Retires: `sq_willow_frogs`, `sq_merc_hares`, `sq_borum_frogs` (three duplicate kill quests). New 피난민 NPCs are data
rows in `willow.json` / `npcs.json` with `npclife` entries (homes in the village's empty cots).

**A1 「버드나무의 새 식구」 Lv 5–20** — a 피난민 family (다람쥐 엄마 도란, 아들 콩알) arrives with nothing.
| # | giver → goal | synopsis |
| --- | --- | --- |
| 1 | 촌장 버들 → talk 도란 (deliver `q_blanket` 낡은 담요) | 광장에서 넘어온 가족에게 담요를 전한다. 도란은 네온 시티 북문에서 남편과 헤어졌다. |
| 2 | 도란 → collect `m_w1` × 8 | 빈 오두막 바닥을 말릴 땔감. 쓱싹이 어디에 마른 가지가 많은지 알려 준다 (hint). |
| 3 | 감자 → make `fd_rice` × 3 | 콩알이 아무것도 먹지 않는다. 텃밭 감자가 "들꽃 주먹밥이라면 먹을걸" 하고 부엌을 내 준다. |
| 4 | 콩알 → choice | 콩알이 아빠를 찾으러 혼자 초원에 가겠다고 한다. **[같이 기다리자]** → 솔이 자장가를 가르쳐 준다 · **[내가 찾아볼게]** → A2 가 한 단계 일찍 열린다. |
| 5 | 도란 → visit 바람초원 울타리 (meet 마루) | 마루가 동쪽에서 온 꼬리 긴 다람쥐를 봤다고 한다. 실마리가 네온 시티로 이어진다. |
Last reward: keep `kp_willow_key` 버드나무 새집 열쇠 (→ P9 버드나무 밀짚 두건), title 「버드나무 이웃」.

**A2 「마지막 불빛」 Lv 55–85** — 도란의 남편 도톨 is alive in 네온 시티, keeping a shop lamp lit for stragglers.
| # | giver → goal | synopsis |
| --- | --- | --- |
| 1 | 종지기 치치 → visit 네온 시티 북문 (`map:city`) | 치치의 종이 두 번 울릴 때 북문 쪽에서 불빛이 깜빡인다. |
| 2 | 도톨 (new, city) → collect `m_o3` × 6 | 낡은 간판등을 고칠 네온 고철. 그는 떠날 수 없다: 불이 꺼지면 아직 오는 피난민이 길을 잃는다. |
| 3 | 도톨 → kill `doghead` × 1 elite (「철문 들개」) | 불빛을 노리는 정예 세 머리 들개. |
| 4 | 도톨 → deliver `q_photo` 가족사진 to 도란 | 사진 뒷면: "불은 내가 지킬게. 콩알이 잠들면 이걸 보여 줘." |
| 5 | 도란 → choice | **[도톨에게 돌아오라고 전한다]** → 도톨이 버드나무 마을로 와서 불빛을 모리에게 맡긴다 (등불 thread와 연결) · **[불빛을 지키게 둔다]** → 도톨은 시티에 남고 매주 보급 알바 한 줄이 열린다 (`jb_neon_supply`). |
Last reward: keep `kp_neon_lamp` 마지막 불빛 등 (→ P9 네온 간판 등 배낭), title 「불빛을 지킨 자」.

**Touches:** `data/quests.json`, `data/npcs.json`, `data/maps/willow.json`, `data/npclife.json`, `10-tables.js` (4 quest/keep
items), `12-life-tables.js` (1 jb row). **Tests:** `tests/arcs.mjs` (new, in `tests/LIST`) walks A1 + A2 both branches.
**Art:** 3 NPC looks via existing `look` arrays (species + colours) — no new art.

### P4 — Arcs A3 + A4: 하늘길과 사원 (data, new field givers) · size M
**Built 2026-11-16 — see [arcs.md](arcs.md)** (camp keepers stand in for 소라 and 바람; tests in `tests/sidequests.mjs`).
Retires nothing (these bands are empty); adds a giver to 산호 해안, 운해 사원, 모래바다, 붉은바위.

**A3 「바람등호의 항해일지」 Lv 100–125** — follows the Lv 100 reveal: the anomaly follows an old road.
1 기록관 초미 → collect `q_logpage` × 3 (dropped by `crabskull`… on 산호 해안; quest-only drop row) — 바다에 흩어진 일지 낱장.
2 선장 아루 → make `el_spd` × 2 — 엔진이 멎은 정찰정 승무원용 신속의 물약.
3 신호수 노을 → visit 정글 해안도로 옛 표지석 (`map:jungle`) — 표지석의 문양이 비석과 같다 (복선).
4 산호 해안 등대지기 「소라」 (new) → kill elite `coralturtle` × 1 — 등대 불을 먹는 정예.
5 초미 → choice: **[엘더윈에게 보고]** (title 「정직한 항해사」) · **[옛 지도는 우리만 안다]** (title 「항로의 비밀」; A5 step 2 gets a hint line).
Last reward: keep `kp_compass` 바람등호 나침반 (→ P9 하늘 항해사 모자).

**A4 「종과 별」 Lv 117–165** — 운해 사원의 종지기 원숭이 「은하」 and 모래바다 대상 「사막여우 바람」 search for one bell.
1 은하 (new, cloudtemple) → kill `bearmaw_ash` (main 28 must be done) → talk 은하 — 재가 떨어지자 종 하나가 없다.
2 은하 → visit 모래바다 (`map:dunesea`) meet 바람 (new) — 대상이 모래 속에서 종소리를 들었다.
3 바람 → collect `m_o4` × 6 + make `ing_4` × 2 — 모래를 걸러 낼 체.
4 붉은바위 금세공사 「노랑」 (new, mesa) → deliver `q_bell` 모래 속의 종 — 노랑이 종에 새겨진 이름을 읽는다: 루넬샤 이전의 문자.
5 은하 → talk — 종을 다시 걸자 운해가 걷히고 단풍 왕도 쪽 하늘이 보인다.
Last reward: keep `kp_bell` 작은 사원 종 (→ P9 운해 종지기 등장식), title 「종을 되찾은 자」.
**Touches/Tests/Art:** as P3 (`npcs.json` 4 new NPCs, map spots in custom-map data, `tests/arcs.mjs`). No new art.

### P5 — Arcs A5 + A6: 왕도의 사관, 균열을 적는 자 (data) · size M
**Built 2026-11-16 — see [arcs.md](arcs.md)** (A5's last page hints §6.1 without settling it).
Retires: `sq_borum_blight` (its 1.02 M XP is the outlier), `sq_bawi_deer`, `sq_dongdong_pigeons`, `sq_bogle_crows`
(kill duplicates of main 7, 12, 2).

**A5 「마지막 사관」 Lv 157–197** — 단풍 왕도's old record-keeper, a grey squirrel ghost-lamp 「갈피」 who cannot leave.
1 갈피 (new, maple) → collect `q_record` × 4 (from `blightsquirrel`/`shroomboar`, quest-only drop) — 썩어 가는 왕실 기록.
2 갈피 → visit 무너진 예배당 (`map:maple`, spot) — 왕관 사슴은 옛 왕의 "사냥감"이 아니라 정복한 땅의 짐승이었다.
3 사서 보름 (town) → make `stat_seal`-like 「기록 보존액」 (`q_ink`, alch L30 recipe, quest only) — 기록을 굳힐 약.
4 갈피 → kill `rotstag` elite × 1 — 마지막 기록을 깔고 앉은 정예.
5 갈피 → choice: **[기록을 광장 도서관에]** (보름 gets a new line set; title 「사관의 증인」) · **[기록을 왕도에 묻는다]** (갈피 lights out; title 「잠든 사관의 벗」). Either way the 비석 (Lv 200) reads as the end of this record.
Last reward: keep `kp_quill` 사관의 깃펜 (→ P9 사관 모자).

**A6 「균열을 적는 자」 Lv 60–157, rift lore** — 보글 and 보름 compare rift samples.
1 보글 → collect `q_shard` × 3 (one per 차원 균열 closed; granted at rift close while the quest is on).
2 보름 → talk 오로 (crypt) — 탁본쟁이가 균열 테두리의 글자를 떠 둔 적이 있다.
3 보글 → make `el_all` × 1 — 샘플을 녹일 정수.
4 보름 → kill `boss` (크리온) in the rift raid or field, `req.lv` 125.
5 보글 → talk — 균열 글자와 바람등호 표지석, 사원 종의 문자는 같은 손이 썼다. (Leads to P6 chapter 4.)
Last reward: keep `kp_shardjar` 균열 표본병 (→ P9 균열 연구원 고글), title 「균열 기록관」.
**Touches:** as P3 + rift close hook in `64-dim.js` (grant `q_shard` when quest active). **Tests:** `tests/arcs.mjs`.

### P6 — 주요 의뢰 막간 장 (main story chapters) · size M
**Built 2026-11-16 — see [arcs.md](arcs.md)** (8 chapters, 6 beats; 망치 갯가재 left out of the chain; §6.1 still open).
- **Goal:** story beats between the kill quests, the two skipped maps, and one voice besides 엘더윈. Added as
  `mainChapter` side quests (pattern of `sq_job_free`), so the `QUESTS` order and XP curve stay.

| ch. | after main # | Lv | beat (goal) |
| --- | --- | --- | --- |
| 1 「광장의 등불」 | 4 | 22 | talk 촌장 버들, 소담 — 피난 첫 겨울 이야기; opens A1 if missed |
| 2 「함락의 밤」 | 14 | 65 | visit 네온 시티 북문 → talk 치치 — 함락 날의 증언 (opens A2) |
| 3a 「산호 해안」 (new main kill pair) | 22 | 105–118 | kill `coralturtle` × 10, then the coast boss — fills the 101–125 hole |
| 3b 「붉은바위」 (new main kill pair) | 29 | 145–160 | kill a mesa mob × 12 + mesa boss — fills 141–165 |
| 4 「같은 손의 글씨」 | 30 | 157 | talk 보름 → visit 단풍 왕도 입구 — the three scripts match; the spell is older than the 군주 |
| 5 「왕도의 겨울」 | 35 | 185 | talk 갈피 or 보름 (A5 result) — sets up 성에왕 |
- **Touches:** `data/quests.json` (4 chapters), `10-tables.js` `QUESTS` (+4 rows for 3a/3b at their position), quest texts
  rewritten for 6 bland main quests (12, 15, 18, 21, 26, 36) so a person speaks, not a manual. **Needs the owner's
  answer to §6.1 for ch. 4–5.** **Tests:** `tests/quests.mjs` order + level monotone; `tests/levelbands.mjs` if present.

### P7 — 생활 밸런스 (numbers only) · size S
| change | from → to | why |
| --- | --- | --- |
| XP per action by grade `RXP` | 8/14/22/34/50 → **8/16/30/50/75** | actions per band 531/1,578/2,208/2,545/2,777 (13.3 k → 9.6 k, −27 %); the L31–50 wall drops a third |
| `mapGrade.mesa` | 4 → **5** | grade 4 spans 7 maps over Lv 93–165; mesa (141–165) is the natural grade-5 door before 왕도 |
| 여관 스튜 price | 110 → **190** | recipe ratio 0.62 → 1.07 |
| 장님고기 찜 price | 560 → **760** | 0.79 → 1.07 |
| 신속의 물약 | price 200 → **400** | 0.56 → 1.13 (shop does not sell it) |
| 부활 깃털 recipe | inputs ≈ 525 → **≈ 230** (drop one herb, fee 50) | shop sells it at 250; crafting must not lose 275 G |
| 연금 정수 price | 1,200 → **1,650** | 0.80 → 1.10 |
| t2 craft (모자 장갑 장화 반지 목걸이) | fee −40 % | 0.60–0.76 → ≥ 0.95 (quality roll is the profit) |
| board rows L31–50 | 3 → **15**: +2 per skill at L33 and L45 (gather, fish, cook, craft, alch, deliver) | the longest band had nothing to do; craft/alch 3/4 rows → 5/6 |
| pay check | 120 + 24·L stays; at L45 normal 1,728 G, hard 2,700 G | under the 1.2–1.6 × hunting net target in `willow-job-economy.md` |
- **Touches:** `12-life-tables.js`, `10-tables.js` (prices). **Tests:** extend `tests/lifebal.mjs` (or the life test):
  every recipe ratio ≥ 0.9 at shop price, each skill has ≥ 2 board rows per grade.

### P8 — 생활 아이템 · size M
Consumables with roles, village produce, fish, crafted furniture. No combat stat higher than today's foods.
| item | how | role |
| --- | --- | --- |
| 숲향 허브차 `fd_herbtea` | 요리 L12: 이끼버섯 2 + 우유 1 | 20 min: gather channel −20 % |
| 갈대의 낚시 도시락 `fd_fishbox` | 요리 L18 | 20 min: fishing great-catch chance +3 %p |
| 대장장이 보리차 `fd_barley` | 요리 L25 | 20 min: craft great +3 %p |
| 연금 향초 `al_candle` | 연금 L22 | 20 min: brew window wider (score tolerance +20 %) |
| 해독 물약 `al_cure` | 연금 L8 | clears poison/slow (pools: 포자, 독) — the first cure item |
| 음메 우유 · 감자 · 버들 꿀 `pr_milk` `pr_potato` `pr_honey` | 버드나무 chores give 1–2 (우유 배달, 텃밭, 꽃밭) | cook inputs; sell 20–40 G (no faucet beyond chores) |
| 감자 버터구이 · 치즈 수프 · 꿀 호밀빵 | 요리 L8/L22/L35 | mid-grade HP+MP dishes using produce |
| fish +6: 산호 도미, 정글 메기, 모래 장어, 운해 은어, 단풍 송어, 서리 빙어 | per-map tables (grade 3–5), size roll | fish book: 11 species × 3 sizes, collection bonus like `collection` |
| furniture +8 (제작 L5–40): 버들 바구니 의자, 참나무 책상, 기름등 선반, 화석 목재 침대, 단풍 병풍, 어탁 액자 (largest fish), 기념품 진열장 (shows `ch.keep`), 협동 알바 감사패 | wood + ingots | the second wood sink; housing fills from life |
- **Touches:** `10-tables.js`, `12-life-tables.js`, `58-life.js` (life buffs read in roll/channel), `59-chores.js` (produce),
  `64-housing.js` (furn rows), `90-views-api.js` (fish book in defs). **Tests:** life buff applies once and expires;
  produce only from chores; fish book completion. **Art:** item icons + 8 furniture sprites, code-drawn (not hero art).

### P9 — 외형 규칙: 염색 · keepsake 재봉 · set table (after Codex's 64×64 hero conversion lands) · size M
- **Dye (염색):** each owned cosmetic keeps `ch.cosDye[id] = 0–5` (palette index into the piece's own 6 trims). Dyes are
  연금 items made from herbs: 들꽃 분홍, 이끼 초록, 형광 청록, 수정 보라, 단풍 주홍, 숯 검정 (alch L5–40, the herb sink
  the life loop lacks). Dyeing at 루루 의상실 eats one dye; 0 = original, free to reset.
- **Keepsake sewing:** 루루 turns each `kp_*` from P3–P5 into its outfit piece (keepsake stays in the 기념품 tab).
- **Sets ≥ 4 pieces across 4 slots**, each with a source (table in P10/P11). Wire: `self.cosDye` only when changed.
- **Touches:** `65-cosmetics.js`, `40-characters-world.js` (migrate `cosDye`), `70`/`75` (`dye` action), `90` (defs),
  `public/win_wardrobe*.js`, `wardrobe.js` (`dress` takes a dye index). **Tests:** `tests/wardrobe.mjs` dye, reset, old sheet.
- **As built (2026-11-16):** `ch.cosDye` { id: 1–6 } — six dyes, so 0 (original, not stored) + 1–6, one per dye in
  `COS_DYES` order (분홍 초록 청록 보라 주홍 검정); sheet v25, `cosDyeClean` drops junk/unowned/weapon skins. Dyes are
  bag `mat` items brewed by 연금: 분홍 L5 (들꽃잎), 초록 L10 (이끼버섯), 검정 L15 (마른 가지 숯), 청록 L20 (형광 덩굴),
  보라 L30 (수정꽃), 주홍 L40 (붉은 단풍잎), two per brew, priced by the no-loss rule. Actions `cos_dye {id, d}` (near
  루루, one dye; `d: 0` free) and `cos_sew {k}`. Weapon skins are not dyeable (weapons.js draws them). Wire: a worn
  code + 1000 × dye (`defs.cosDyeK`), so undyed codes are unchanged; `self.cosDye` rides on the dirty `self`.
  Art: `wardrobe.js dyed()` swaps the piece's trim `b` (else its main `c`) for the dye; dye 0 returns the same art
  entry (golden hashes untouched). UI: 루루's window (`wardrobe_ui.js`, not `win_wardrobe*`) has a 염색 row — worn
  slot, six swatches (greyed with none; tooltip shows the count), 원래대로, 물들이기 after a preview. Preview page:
  `_wardrobe.html?m=dye`. **Keepsake sewing is a hook only:** `KEEP_SEW` (65-cosmetics.js) lists all seven `kp_*`
  with `""` — no outfit piece exists yet; P11 fills in the ids and 루루 shows a 재봉 button per sewable keepsake.

### P10 — 외형 세트 1: 마을과 생활 (after 64×64; art) · size M–L
| set (slots) | earned by | what 64×64 adds |
| --- | --- | --- |
| 버드나무 마을 (밀짚 두건 · 덧댄 앞치마 · 장바구니 · 볼터치) | A1 keepsake, 버드나무 rep 친구, chores 100 | woven straw texture, patched pocket with stitches, basket weave, leaf pin |
| 견습 장인 × 6 (one piece per life skill at L30) | life L30 achievement per skill | tool belt with readable tools (가위, 망치, 국자), soot/flour smudges |
| 명인 (existing 6) re-drawn | life L50 (unchanged) | trims and badge embroidery; dye-ready |
| 협동 알바 왕 (조끼 · 모자 · 명찰) | co-op S grade in all 4 shifts | name-tag text pixel, pocket pens, stripe pattern |
| 낚시 기록가 (어부 모자 · 비옷 · 어탁 두루마리 등장식) | fish book complete / record fish | raincoat seams, scroll with fish print |
- **As built (2026-11-16, sets 1–3; 견습 장인 and the 명인 redraw not done):** codes 131–140, sets `willow` `coopking`
  `fishlog`. `COS_ACH` is now achievement → [ids] (one achievement may pay several pieces of one set). 버드나무 마을:
  밀짚 두건 src `sew` (`KEEP_SEW.kp_willow_key`), 덧댄 앞치마 ACH `repwillow` (three `willow_*` villagers at 친구),
  장바구니 + 볼터치 ACH `chore100` (new `ch.cnt.chore`, counted in `jbPay`; old sheets 0, no v bump — as `mvp`).
  협동 알바 왕: all three from ACH `coopall` (every `coopS_*` counter ≥ 1; 68-coop.js untouched). 낚시 기록가: 비옷 +
  두루마리 from the existing `fbook`, 방수모 from `fbig10` (ten species at 대). 64px-only detail through `brush.fp`
  (a half-pixel dot, nothing at 32px) and an optional `TOP[k].fine`; every piece has a trim `b` except the blush
  (its dye is its colour). Wardrobe source text for `sew` names the keepsake. Tests: wardrobe.mjs P10 block.
- **As built (2026-11-16, 견습 장인; the 명인 redraw still not done):** codes 163–168, top slot (a chest strap, a tool belt
  `b` = the dye, a short canvas flap `c` at the feet row), no set (one slot only). ACH `life30_<skill>` (new, 10 pts, name
  `견습 …`; the generic `life30` stays). wardrobe.js `toolBelt` + `APPRENTICE`: the tool hangs on the hip, 2×3 px —
  찌 (fish), 국자 (cook), 가위 (gather), 망치 (craft), 약병 (alch), 편지 (deliver) — with 64px parts, and a stain on the
  fur at 64px only (spray, flour, grass, soot, potion, ink). Tests: wardrobe.mjs "견습 장인" block (an old sheet holding the
  achievement catches up through cosClean).
- **As built (2026-11-16, the 명인 redraw):** all six have a trim `b` for the dye (basket: a leather band; satchel: a
  red courier flap, its own `courier` template so 책가방 keeps `satchel`) and 64px embroidery: a shared `masterBadge`
  (gold over trim), the fisher's crown fish, hem piping, rivets, vial glints, basket weave, the letter's seal.

### P11 — 외형 세트 2: 이야기와 계절 (after 64×64; art) · size M–L
| set | earned by | what 64×64 adds |
| --- | --- | --- |
| 이야기 기념품 (네온 간판 등 배낭, 하늘 항해사 모자, 운해 종지기 등장식, 사관 모자, 균열 연구원 고글, 버드나무 밀짚 두건) | A1–A6 keepsakes sewn | a glowing sign with letters, brass compass face, bell with rope, quill feather barbs, goggle lens glare |
| 사계절 × 4 (벚꽃 · 한여름 바다 · 단풍 · 눈꽃): hat, top, back, wskin each | P12 seasonal festival tokens | layered petals/leaves, knit and fur patterns, snow trim; wskin motifs `maple`, `snow`, `sakura` gain shape not just colour |
| face slot +8 (주근깨, 반창고 별, 꽃 귀걸이, 눈꽃 볼 화장, 장인 고글 이마걸이 …) | shop 4, chores/arcs 4 | room for small details a 32×32 face could not hold |
| wskin +6 (버들 가지, 등불, 사원 종, 단풍, 고래뼈, 별사탕) | arcs, festival, co-op | wrap patterns along the blade, hanging charms |
- **As built (2026-11-16, 사계절 and 이야기 기념품; face +8 and wskin +6 not done):** codes 141–162, new source `fair`
  (COSMETICS price 0: FAIR_SHOP holds it; the wardrobe names the season and price). **사계절** sets `spring` `summer` `autumn`
  `winter`, the fixed P12 ids, so 다래's stall sells every row (no "곧 들어옵니다" left): 벚꽃 머리띠 · 벚꽃 카디건 · 벚꽃
  종이우산 · 벚꽃 가지 무기 외형; 불가사리 머리핀 · 꽃무늬 여름 셔츠 · 줄무늬 튜브 (round the waist: far half behind, near half
  BACK_FRONT) · 파도; 단풍잎 화관 · 꽈배기 스웨터 · 도토리 배낭 · 단풍; 눈꽃 털모자 · 털깃 겨울 코트 · 눈사람 배낭 · 눈꽃.
  Weapon skins are four new weapons.js motifs `ssnSakura ssnSea ssnMaple ssnSnow` (shapes along the blade: a blossoming
  twig, foam crests, five-point leaves, three-line snowflakes). **이야기 기념품** set `story`, all `sew`, KEEP_SEW filled:
  갈대 찌 → 빨간 찌 귀걸이 (face), 마지막 불빛 등 → 네온 간판 등 배낭 (a sign raised over the head, 「집」 in native pixels),
  나침반 → 하늘 항해사 모자 (compass badge), 작은 사원 종 → 운해 종지기 등장식 (bell on a crook), 깃펜 → 사관 모자 (사모 with
  flat wings and a quill), 균열 표본병 → 균열 연구원 고글 (violet lenses the eyes show through); the A1 key stays 버드나무
  마을's 밀짚 두건. Every piece but the starfish (dyes whole) has a trim `b`; 64px detail via `brush.fp`. The knit hat and
  the navigator cap cover the ears (`behind`): with holes a rabbit's ears hid the crown. Tests: wardrobe.mjs P11 block,
  festival.mjs buys a 사계절 piece.
- **As built (2026-11-16, face +8, wskin +5, contrast):** face codes 169–176, no set. Shop: 주근깨 600 · 반창고 별 500 (q0),
  꽃 귀걸이 1800 · 눈꽃 볼 화장 2000 (q1). From existing achievements (no new counters): 장인 고글 이마걸이 `life30` (goggles
  pushed up on the brow, the eyes stay bare; strap seen from behind), 밀가루 코끝 `craft50`, 풀잎 피리 `gat100`, 참 잘했어요
  도장 `coop20`. Every face has a trim `b` or dyes whole. Weapon skins codes 177–181 (단풍 already existed as
  `ws_ssn_maple`, so five): motifs `willowTwig` (withe and drooping leaves) and `lantern` (paper lantern under the tip),
  `templeBell` (rope wraps, a bell charm) from `quest`; `whalebone` (ribs, a blue fluke) from `boss`; `starCandy` (five-point
  candy stars) from `daily`. No festival or co-op source: FAIR_SHOP and 68-coop.js were off limits, and the co-op
  achievements already pay whole sets. **Contrast:** 벚꽃 카디건 (main pink deepened to #f09ab8) and 꽈배기 스웨터 take the deep
  shade `d` in their outer columns, so they part from white rabbit and tan shiba fur at 1×.

### P12 — 버드나무 장날과 계절 (rules + small art, after P9) · size M
- **Season** from `S.now` only (KST day count ÷ 91, no `Date`): spring/summer/autumn/winter, shown on the sky/HUD.
- **장날** every Sunday 10:00–22:00 KST in 버드나무 마을: produce stalls, a cooking contest (best `pan` score of the
  day), 4 festival 알바 rows; pays 장날 토큰 (no gold). Tokens buy the season set pieces (P11), 6–8 tokens a Sunday,
  a piece 20–30 → one season set ≈ a season of Sundays.
- **Touches:** `60-content.js` or new `63-festival.js`, `12-life-tables.js`, `90` (defs), client banner. **Tests:** season
  boundaries, token cap per day. **Art:** stall props in the village (code-drawn).
- **As built (2026-11-16):** `63-festival.js`. **Season** = (KST calendar day − 20513 [2026-03-01]) ÷ 91 mod 4 → 봄 여름 가을
  겨울 (a 364-day game year: 2026-11-16 is 가을, 겨울 from 11-29, 봄 again 2027-02-28). Wire: `dn` is now [wx, clock s,
  season, 장날 0/1], re-sent when the market opens or closes; `defs.sky.season`; the sky widget reads `낮 14:00 · 맑음 · 가을
  · 장날`. **장날** Sunday 10:00–22:00 KST (`fairOpen`); a toast as it opens (and on joining while open) and as it closes
  (`fairWatch` in lifeTick). **Festival rows** (JB `fair: true`, Lv 1): 장날 채소 좌판 (감자 → 장꾼 다래), 장터 생선 꼬치 (송사리 →
  공동 부엌), 장날 개시 떡 (배달 다래 → 촌장 버들), 장터 뒷정리 (litter chore) — offered only while open, never 긴급, outside
  perDay, pay `FAIR.job` 1/2/2 tokens by grade, no gold and no Willow token. **Contest**: any played `pan` mini-game (campfire
  fish or station cooking, never a batch) in the village while open: the day's best per sheet; 60 → +1, 90 → +1 token once a
  day; the channel's best (`S.fairTop`, memory only) is announced to the village. **Tokens** `ch.fair {t, d, n, pan}` (sheet
  v26, `fairClean`), cap 8 a board day (max 6–8 from jobs, 2 from the contest), purse ≤ 999; `self.fair` [purse, today, my
  pan, day's best, cook]. **Stall** 장꾼 다래 (NPC `willow_fair`, role `fair`, by a third stall prop at 53,23): `FAIR_SHOP`
  per season — sells, for now, one existing piece that fits (봄 데이지 화관, 여름 해바라기 화관, 가을 파란 리본 밀짚모자, 겨울 산타 모자;
  20 tokens) and lists the four P11 pieces as **disabled "곧 들어옵니다"** rows under fixed ids `hat_/top_/back_/ws_ssn_<sakura
  |sea|maple|snow>` (20/30/25/25 = 100 ≈ 13 Sundays × 8): P11 adds those ids to COSMETICS and they go on sale untouched.
  Action `fair_buy {id}` (this season's rows only, beside 다래). Client: the 장날 card on top of the 알바 board (F at 다래 opens
  it; board.js, not actions.js). Not done: a contest prize beyond the steps. Tests: `tests/festival.mjs`.
  Off-hours the willow stalls draw closed (net.js `sceneMap` swaps them for decor.js `stallShut` by `dn[3]`; map
  data and collision unchanged); 다래 stays all week for her token shop.

**Sizes:** S ≈ 30–50 k tokens, M ≈ 60–100 k, L > 100 k (split L by set). Build order: P1 → P2 ∥ P7 → P3 → P4 ∥ P8 →
P5 → P6, then after the 64×64 hero: P9 → P10 ∥ P12 → P11.

**Quest count after P3–P6:** side 34 − 7 retired + 30 arc steps + 4 chapters = 61 (with N4's 33 steps: 94). Arcs give
each band 61–200 at least 8 story steps; no band gains a plain "kill N" quest.

---

## 4. What NOT to add

- No new "kill N" or "bring N" side quest. A kill step is allowed only inside an arc, once, and against a named elite.
- No stat on cosmetics, keepsakes, dyes or furniture. Life foods help life work, not combat; no food above today's
  +15 % XP / +8 % atk.
- No new gold faucet: quest gold stays under one 알바 day; produce sells low; festival pays tokens, not gold.
- No more loot-pickup pets with a bigger radius; a pet rework (pets that fish, gather or carry) is a later, separate idea.
- No seventh life skill (farming, taming) until L31–50 of the six has content (P7, P8).
- No auction house, no cosmetic gacha, no paid-only cosmetics, no `Date` in rules (season from `S.now`).
- No dialogue trees deeper than one choice per arc step; no branch that locks content out (both picks finish the arc).
- Skills: separate task.

## 5. Heads-up for Codex's 64×64 hero conversion (list only, no art here)

`game/public/wardrobe.js`:
- `FALLBACK_HEAD`, `anchors()` (head top, ear box, eye row, per-view offsets) — every piece is placed from these.
- `ears()`, `guardEyes()`, `eyeBoxes()`, `isEyePix()` — ear cut-outs and the eye guard rows.
- `HAT` 25 shapes: beanie straw wizard crown horncrown wreath bow cap tricorn santa helm frog halo horns chef beret
  sunhat turban goggles pith bamboo miner bucket kerchief shards.
- `TOP` 21 + `wearTop()`: overalls hoodie sailor armor robe dress suit hanbok vest pajama necklace swim safari dopo
  beads delver chefcoat apron smith alch scarf.
- `BACK` 17 + `BACK_FRONT` + `wingPair()`: cape batcape angel bat fairy pack dragon surf gourd lantern basket satchel
  hammer trophy plush tray cauldron.
- `FACE` 12 + `rim()` (`covers` flag): glasses shades forge patch bandage mask heart monocle stache snorkel paint fox.
- `ART` (108 catalogue ids → shape + palette), `seenFrom()`, `coversEyes()`, `dress()`, `cosIcon()`, `_test` export
  (used by `tests/wardrobe.mjs`).
`game/public/weapons.js`:
- `DESIGNS` 7 kinds × 5 tiers (sword dagger spear staff book bow hammer), `SIL`, `MOTIF_SIL`, `UNIQ_SIL`
  (w_bloodcrown, w_bloomstaff), `silhouetteSamples()`.
- `MOTIF` 30 (`MOTIFS`, incl. 6 unique-weapon motifs and the wskin motifs sakura frost candy bone star flame coral dune
  bamboo shard bee) + `EXTRA` colours; rasteriser, `weaponSprite()`, `bowSprite()` (pull frames, arrow),
  `weaponIcon()`, `assetKey()`/external images, `entryIconUrl()`.
Also: `species.js` head measures, `swing.js` grip points, and the `--page wardrobe` / `--page sheet` previews.

## 6. Owner decisions

1. **What woke the spell** (`lunelsha-story.md` leaves it open) — needed for P6 ch. 4–5 and A5's ending. Options:
   (a) 네온 시티's power plant dug into the old spell-stone; (b) the 성에왕's dying wish; (c) leave it for the 비석.
2. Retiring 7 plain side quests (P3, P5) — players who finished them keep their rewards; is retiring OK?
3. Arc choices change small things (a line, a title, one 알바 row) — or should one choice change an NPC's home?
4. The 장날 day and hours (P12: Sunday 10–22 KST) and whether season sets come back each year.
5. Dye count per piece (6 trims) and whether dyes are tradeable.

## 7. P7/P8 as built (2026-11-15)

- **P7 numbers** (`12-life-tables.js`): `RXP` 8/16/30/50/75; `GRADE_MAP.mesa` 5. Every recipe sells for ≥ 0.9 × its inputs
  at shop price + fee (`lifeskills.mjs`; the B.7 guard still passes): 여관 스튜 220 G with fee 66 (the inn sells it, so the
  guard needs the fee), 장님고기 찜 700, 신속의 물약 400, 연금 정수 1,650, 부활 깃털 = 수정꽃 + 참나무 목재, fee 80 (0.48 → 0.94);
  tier-2 helm/gloves/boots/ring/amulet take **2 ingots** (a fee cut alone could not reach 0.9), fee ≥ the guard's floor;
  gear fee 30 → 29 %. 되새김 인장 has no price (exempt).
- **Board** +13 rows (87): two per skill at L33/L45 (심연 결정, 붉은 단풍잎, 산호 도미, 단풍 송어, 장님고기 찜, 꿀 호밀빵, 심연 주괴,
  단풍 병풍, 집중의 향초, 경험의 엘릭서, 음메 → 마루 and 수국 → 피피 parcels) and 연금's first grade (해독 물약 for 토비).
  Every skill has a row in each grade and ≥ 2 past L30 (`lifeskills.mjs`); `jobaudit` passes.
- **Every level shows progress**: the level-up toast names the recipes first known there, else the steady gains (time,
  대성공, keep score, parcel pace); 채집's 덤 grows 4 % → 23.6 % (`LIFE_STEP`).
- **Hours to L50** (Σ lifeNeed / RXP at the band's grade; an action = its channel × lifeTime(L) + handling: gather 2.4 s
  + 8 s walk, fish 4.75 + 5, cook 3 + 4, craft 4.5 + 4, alch 4 + 4; no 대성공, board or buffs):

  | | 채집 | 낚시 | 요리 | 제작 | 연금 |
  | --- | --- | --- | --- | --- | --- |
  | hours | 33.4 → 24.2 | 29.1 → 21.1 | 21.2 → 15.4 | 25.0 → 18.2 | 23.8 → 17.3 |

  Actions 12,296 → 8,895 (L31–49: 7,256 → 4,881). 배달 has no action XP: 196 쉬움 jobs (≈ 137 at the grade mix), unchanged.
- **P8**: produce `pr_milk` `pr_honey` (우유 배달 / 꽃밭 물주기 pay 1–2, 제초 감자; 쥬쥬 also sells them — buying is a sink);
  dishes 감자 버터구이 (요리 8), 치즈 수프 (22), 꿀 호밀빵 (35); life-buff foods in the one food slot (`buff.lf`, `lifeBuff`):
  숲향 허브차 (12, 채집 −20 %), 갈대의 낚시 도시락 (18, 입질 −25 %), 대장장이 보리차 (25, station 대성공 +3 %p), 버들 꿀떡 (28,
  parcel/milk clock +20 % — not speed: the parcel factor lives in 45-jobs.js), 집중의 향초 (연금 22, life XP +10 %; the brew
  window is client-only); 해독 물약 (연금 8, `cure`: poison, burn, slow).
- **Fish**: 정글 메기, 산호 도미, 모래 장어 (dunesea, oasis), 운해 은어, 단풍 송어, 붉은바위 쏘가리 (mesa: frostkeep has no water)
  take `FISH_LOCAL` 40 % of their grade's catch (grade 5 takes 장님고기's place, never 황금 잉어's). **물고기 도감**: sheet
  `fbook {id: [best cm, size bits]}` (lifeFresh + lifeSheetClean; optional field, no `v` bump), 11 × 소/중/대 = 33; rewards at
  5/11/22/33 (1,000 G · 3,000 G + 축복 강화석 · 6,000 G + 어탁 액자 · 15,000 G + title 물고기 박사). Wire `self.fbook`,
  `defs.life.fbook/fishMap/step`; a card in the life window.
- **Furniture** (캉캉, 제작 5–40): 버들 바구니 의자, 참나무 책상, 협동 알바 감사패, 기름등 선반, 어탁 액자, 화석 목재 침대 (rest),
  기념품 진열장, 단풍 병풍 — `FURN` rows (placeable, not in the agent's shop) on **reused** interior sprites. Left: their own
  sprites, the frame showing your record fish, the cabinet showing `ch.keep`. Icons `lifeicons.js` (`shots/life-items.png`).
