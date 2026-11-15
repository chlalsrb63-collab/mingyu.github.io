# Content audit 2026-11-16: Lv.40 to Lv.200, hour by hour

Follows `content-audit-2026-11-15.md`. P1 to P12 from that audit are built. This audit asks one question: what does a
player do between Lv.40 and Lv.200 (about 44 of the 45 hours), and where does the work turn into plain grinding?
The code is the source. Counts were taken from `game/data/quests.json` (side quests; `"main": null`, so the
built-in chain at `10-tables.js:556-598` is live), `game/data/npcs.json`, `34-maps-world.js` (bands) and
`balance-2026-11-15.md` §8 (hours). The run was cut short, so anything this audit did not check in code is marked
**unverified**.

Owner decisions this audit keeps: about 45 h solo to Lv.200. Tier-6 gear at Lv.181 is the last tier. 칼날 소용돌이
hits 3. 도적 gets no AoE. The rift is a 3-floor raid of about 10 min. Hunting gold is ×0.4 and 알바 is the main gold
source. Co-op 알바 needs a party of 2 to 4, the leader starts it, it rewards once a day and can be replayed. Only the
owner adds jobs.

## 0. Conversions used

- Map bands in `34-maps-world.js:296-604` are in monster tiers (1 to 50). Player Lv ≈ 4·tier − 3, as used in
  `balance-2026-11-15.md` §1 (T13 = Lv.49, T25 = 97, T40 = 157, T50 = 197). A monster's `lv` in `MOBS` is also a tier.
- Hours per band come from the kills-only probe after the §8 curve: 41–60 **0.8 h** (this is the 1–60 figure of 1.2 h
  minus 1–40), 61–100 **4.1 h**, 101–150 **15.2 h**, 151–180 **14.4 h**, 181–200 **10.3 h**.
- Side quests are bucketed by `req.lv`. There are **110 side quests in all**, and **1 is repeatable**
  (`quests.json:245`, 바위's collect at Lv.41).

## 1. Band table

| Lv band (h) | grounds (tier band → Lv) | main rows | side quests (per h) | bosses met | field NPC givers | what the player chases |
| --- | --- | ---: | ---: | --- | --- | --- |
| 40–60 (0.8) | forest 8–13 (29–49) · crypt 12–17 (45–65) · city 14–21 (53–81) | 5 (`10-tables.js:562-568`) | **15** (19/h) | ribdeer, toadbrood (fb) | 느티, 오로, 치치, 도톨 | tier-2 gear, first job (숙련 20), 등불 line, 도톨 arc |
| 61–100 (4.1) | city · jungle 20–26 (77–101) · sewer 22–27 (85–105) · cave 24–32 (93–125) | 7 (`:566-574`) | **19** (4.6/h), but 7 of them sit at exactly Lv.100 | doghead, crabskull (fb) | 도톨, 토룩 | tier-3 gear at 61, 도톨 arc to 72, then a gap until the 100 pile-up |
| 101–150 (15.2) | coast 26–32 · oasis 28–34 · cloudtemple 30–36 · dunesea 31–37 · abyss 32–40 (101–157) | **14** (`:574-587`) | **28** (1.8/h) | moleworm, loggator, mummycamel, lionhand, bearmaw_ash, sandmaw (fb) · 크리온 (party) | 울로, 유리, 노을 + airship, 소라, 은하, 사막 | tier-4 gear at 101, airship arc, temple and dune-bell arcs, 5장 크리온 |
| 151–180 (14.4) | abyss · mesa 36–42 (141–165) · inklake 40–46 (157–181) · maple 40–50 (157–197) | **5** (`:588-592`) | **12** (0.8/h) | 심연의 어미 (party), crownpeacock (fb) | 노랑, 갈피, 바스 | tier-5 gear at 149 (none after until 181), 사관 arc, hermit kill steps |
| 181–200 (10.3) | maple · frostkeep 50 (`minLv: MAXLV`, `:604`) | 6 (`:593-598`) | **6** (0.6/h): 1 at 181, 4 at 190, 1 at 200 | rotstag (fb) · 성에왕 유리뿔 (party, Lv.200) | 갈피, 바스, 비석 | tier-6 운철 at 181, then frostkeep at 200 |

| Lv band | 알바 / co-op 알바 | rift raid | dailies / achievements |
| --- | --- | --- | --- |
| all bands | **unverified**: the band rows in `12-life-tables.js`, `68-coop.js` and `69-coop-pipes.js` were not read | **unverified**: `xpNeed` scales with `tierXp` (balance §8), floors were not read | **unverified** |

Reading the table: quest density drops by a factor of **30** from 40–60 to 181–200. Lv.40–100 has more quests than
there is time to play them, while Lv.101–200 holds 40 h of play and 71 quests in total (main and side together).

## 2. Top 8 gaps, ranked by player impact

1. **Quests run out in the last 25 hours.** Lv.151–200 has 18 side quests and 11 main rows across 24.7 h, which is
   about one quest every 85 min. **Lv.191–199 has zero side quests.** Every 181–200 side quest unlocks at 181, 190 or
   200 (`quests.json:1104,1115,1133,1145,686,300`). In those hours the player only grinds the main rows `bogcrown`
   24, `hollowowl` 28 and `rootwarden` 32 (`10-tables.js:595-597`), which are the three biggest kill counts in
   the chain.
2. **The main chain is still "kill N" only.** `QUESTS` rows have only `mob` and `n` (`10-tables.js:551-555`). All 43
   rows are kill or boss rows, and story moves only through the 6 `sq_mc_*` chapter quests (`quests.json:1210-1283`).
   Lv.151–200 has two of them: `sq_mc_maple` at 150 and `sq_mc_frost` at 175. Chapters 7 and 8 together cover 9 kill
   rows (`:591-598`).
3. **잉크 호수 (inklake, Lv.157–181) is a ground with no story at all.** It has no entry in `npcs.json`, no camp keeper
   in the `34-maps-world.js:655-667` list (only maple, coast and dunesea were seen; the full list is unverified), no
   main row and no side quest. Its field boss `serpentwing_ash` (`10-tables.js:231`) appears in no quest. It covers
   the hardest band of the curve (151–180, 30.5 min/level).
4. **Lv.85–99 has a dead stretch.** After 피리's elite step at 84 (`quests.json:466`), the next quest is 토룩's at 93
   (`:155`), then nothing until **7 quests unlock together at Lv.100** (`:266,277,288,499,909,1181,1244`). This is
   about 2 h at 8.1 min/level, and it falls exactly where the ramp makes leveling 2× slower (balance §8).
5. **Late arcs fall back to "kill N".** 은자 바스's line is kill 168, collect 170, elite 180, kill 190
   (`quests.json:653-686`). The 등불 trail steps at 105, 137 and 149 are all kills (`:166,177,210`). Of the 40
   quests at Lv.101 and above, about 17 are kill goals. Only the 사관 갈피 arc (`:1056-1133`) uses the
   talk/make/choice/deliver steps that P1 built.
6. **Little reason to play together after 크리온.** Every field-boss row says "홀로" (for example `10-tables.js:590,594`).
   Party content between Lv.125 and Lv.200 is the 심연의 어미 row, the rift and the 성에왕 (Lv.200). No side quest
   needs or rewards a party: `SQ_GOALS` has no party condition (`62-side-quests.js:16`). Co-op 알바 exists, but its
   late-band rows are **unverified**.
7. **Little repeatable story work.** There is 1 repeatable side quest (`quests.json:245`, Lv.41). Once the late arcs
   are done, the only repeat loops are 알바, dailies, weekly boxes and the rift (their counts are **unverified**).
   The reference games all keep a repeatable story loop for the endgame: Maple daily quests per area, FFXIV tribe
   quests, 테일즈위버 episode replays.
8. **Lv.200 ends in a single talk step.** `frostkeep` opens only at `MAXLV` (`34-maps-world.js:604`). After 유리뿔, the
   chain ends on `sq_lunelsha_tablet` (talk, `quests.json:293-300`). Nothing shows what Lv.200 is for: mastery,
   collection, harder versions or titles (post-200 systems are **unverified**). Lunelsha's third reveal, "what woke
   the spell", is still undecided (prior audit §1.5).

Smaller items, not ranked: 붉은바위 (mesa, Lv.141–165) has one side quest (노랑, deliver at 165, `quests.json:1044`).
정글 has one main row (loggator fb). Hunting is fun to watch but has no reward besides XP.

## 3. Build plan (one agent each; story steps over "kill N"; existing systems only)

Reward scale for all new steps (same as the prior audit §3): XP = 15 % of `lvt[Lv]` (an arc's last step 30 %),
gold = 30 × Lv (last step × 2), keepsakes and titles for arc ends. 알바 stays the gold road.

### Q1 — 잉크 호수 arc 「나루터의 먹물」 (Lv.158–180) · size M · data only
- A new field giver at the 나루터 stone of `inklake` (`npcs.json`). Five steps, using the P1 goal types: talk, visit
  (외딴 탑 섬), make (a cooking or alch recipe), elite on inklake, then a choice that ends the arc and gives a
  keepsake and a title. Kill goals: at most 1 step of 5.
- Files: `game/data/npcs.json`, `game/data/quests.json`, and a keepsake row in `ITEMS` (`10-tables.js`) if a new
  one is needed.
- Test: `npm run data:check`, plus a chain case in `tests/content.mjs` (req.quest order, rewards in scale).

### Q2 — Bridge Lv.85–99: 토룩 and 울로, 「거꾸로 흐르는 물」 · size S · data only
- Four steps (Lv.86, 90, 94, 98), sewer to cave: deliver to 울로, collect, make, talk. They lead into the airship
  arc at 100, so the 7 quests at Lv.100 stop arriving all at once. Move 2 of those 7 down to Lv.96–98 (`req.lv` only).
- Files: `quests.json`. Test: `data:check` and `content.mjs`.
- **As built:** `sq_toruk_bottle` (86, 토룩 → deliver 거꾸로 담긴 물 to 울로), `sq_ullo_silt` (90, 울로: collect 4 수정 앙금
  from the sewer's 거머리 아가리), `sq_toruk_wedge` (94, 토룩: make 수문 쐐기 at 캉캉, a quest-only craft recipe, 제작
  Lv.20), `sq_ullo_sky` (98, 울로 → talk to 신호수 노을, who points at 바람등호). Rewards 15 % `lvt` / 30 × Lv, the last
  step 30 % / × 2. Moved down: `sq_bogle_essence` 100 → 96 and `sq_monggeul_bears` 100 → 98. New quest items have
  icons (`lifeicons.js`). The chain is walked step by step at its levels in `tests/sidequests.mjs`.

### Q3 — Main-chain beats for chapters 7–8 · size S · **owner decision** (kill counts)
- Add two `sq_mc_*` chapter quests: one before `rotstag` ×4 (`10-tables.js:593`, the chapel inscription
  `maple_altar` already exists), and one before `rootwarden` (a 갈피 talk/deliver beat).
- Optional, needs the owner: cut the counts 24/28/32 to 16/18/20. The XP stays the same; this only shortens the grind.
- Files: `10-tables.js` (the `sq` field on two rows) and `quests.json`. Test: the `SQ_MAIN` gate in `content.mjs`.

### Q4 — Party goal flag for side quests · size M · **owner decision**
- Add `goal.party: 2..4` to the `elite`, `fb` and `kill` goals. Progress counts only when the player is in a party
  of at least that size and on the same map (`sqProgress`, `62-side-quests.js:129`; validate in the `SIDE` filter at
  `:34`). Apply it to 2 or 3 late arc steps (바스 elite 180, Q1's elite) and to an inklake boss step.
- This is not a co-op 알바. The owner's 알바 rules stay as they are.
- Files: `62-side-quests.js`, `quests.json`, then rebuild `logic.js`. Test: a new case in `tests/content.mjs`
  (solo does not count, a party of 2 does).

### Q5 — Rewrite 바스's arc as a story · size S · data only
- Change the steps at 168 and 190 from kill to talk/deliver/make (a hermit's 단풍 부적 recipe), and keep the elite at
  180. Add one step at Lv.195 that leads into 성에왕, which fills the Lv.191–199 gap.
- Files: `quests.json`. Test: `data:check` and `content.mjs`.

### Q6 — Late field-boss 기록 (weekly, repeatable) · size M · **owner decision** (repeat cadence)
- Each late field giver (노랑, 갈피, the Q1 giver) holds one weekly side quest against their ground's boss. Its text
  changes with the giver's arc flags (`req.flag`). It rewards XP and 강화석 ≤ 2, **no gold above scale**.
- This needs a weekly repeat rule (`repeat: "week"`, reset by `S.now`), next to the existing weekly boxes in
  `63-social-weekly.js`.
- Files: `62-side-quests.js`, `quests.json`. Test: `content.mjs` (it cannot be retaken before the reset, and an old
  sheet still migrates).

### Q7 — Inventory of post-Lv.200 goals · size S · audit only, **owner decision** on what to build
- Read the achievements in `60-content.js`/`67-trophies.js`, the dailies, the band rows of 알바 and co-op 알바
  (`12-life-tables.js`, `68-coop.js`), and the rift floors (`64-dim.js`). Fill in the **unverified** row of §1 and
  list what a Lv.200 player repeats each week. This also decides whether Lunelsha's third reveal needs new content.

**Order:** Q2 and Q5 first (S, data only, they fill the two dead stretches), then Q1, Q3, Q4, Q6, with Q7 alongside
any of them. Q1, Q2 and Q5 need no owner decision.
