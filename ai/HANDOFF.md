# 인수인계 — Claude and Codex, one project on the owner's PC (updated 2026-11-15)

Read by every AI session on this PC (Claude Code in the desktop folder `Tales Tales`, Codex in its worktree).
Development is **local first**: work and test on the PC; the owner decides when anything goes online (§4).
Read this, `AGENTS.md` (loaded), `ai/BRIEF.md`, `docs/design/README.md`, `docs/systems/README.md`; then continue.
Reply to the owner in Korean; they want reports **with screenshots** ("다 끝나면 화면과 함께 알려줘").

Claude · Gemini · Codex: 새 의뢰와 지역 서사를 쓰기 전에 [루넬샤 이야기](../docs/design/lunelsha-story.md)를 읽는다. 작은꼬리들(Tinytales)은 자칭이며, 조상들의 기록은 마지막 고대비석에서 공개한다.

## 현재 인계 · 직업 성장, 해머, 월드맵, 로컬 BGM

- 17:00 로컬 `main`의 게임 변경 기준은 `ccbd26c`다. 파티 공유 거리, 창·마도서 회복, 교차 패시브 2칸, 주민 일과 34명, 되새김 인장, 협동 근무 4곳이 함께 적용됐다. [현황과 검수](reports/codex-local-status-2026-11-15.md)
- `codex/hammer` 통합 묶음은 해머·파괴자, 머서너리·성기사, 직업 Lv.1–50, 전용기 4단계, 지형 월드맵과 해금 돌 이동을 포함한다. 성문 서약의 유효 파티 회복도 직업 XP에 기여한다. [직업 규칙과 UI](reports/codex-job-skill-ranks.md) · [파티 밸런스와 연출](reports/codex-party-balance-fx.md)
- 현재 저장 시트는 **v21**이다. `cleanJobs`가 직업·해머 숙련 및 교차 패시브를, `dimClean`이 균열 단계·주간 보스 기록을 보정한다. 기본 공격은 `X`, 대시는 `Space`이며 사용자 키 설정을 따른다.
- 로컬 MP3는 `game/public/assets/music/<map>.mp3`로 재생한다. 개발 폴더의 개인 세이브와 MP3는 각 워크트리에 보관한다. [지역별 Gemini 프롬프트](prompts/gemini-map-bgm.md)
- 이어서 확인할 부분은 장기 사냥의 직업 Lv.20·35·50 도달 시간과 상위 파티의 전용기 MP 유지율이다.

## 0. Token budget — owner's order: "토큰 소모량을 줄이도록 해" (2026-11-15)

The integrator session that ran on 2026-11-14/15 hit the 5-hour limit twice: its own context grew to 750k tokens, every
agent notification re-read it, and 6–7 agents of 120k–400k tokens each ran at once. Rules from now on:
1. **Keep the integrator session short.** When its context passes ~250k tokens, update this file and continue in a
   fresh session (never a fork of a long session). Don't re-read big files or screenshots you already summarised.
2. **At most 2–3 agents at a time**, each scoped to ≤ ~100k tokens (≤ ~80 tool calls). Split bigger work.
3. **Never run two agents on the same files** (map generators `30/32/34`, `10-tables.js`, HUD `hud.*`/`windows.js`,
   `70/75/90`): sequence them. Conflicts cost a whole rebase agent.
4. **Model by job** (`ai/BRIEF.md`): art, data rows, docs, reviews, mechanical ports → `model: "sonnet"` (pure
   text/data → `"haiku"`); rule cores, integration, design → default. Small well-specified items → Codex via `ai/TASKS.md`.
5. Agents: reuse the main checkout's `node_modules` (junction) instead of `npm install`; relevant tests while working,
   the full suite once at the end; ≤ 3 screenshots; reports ≤ 15 lines. The integrator trusts the report, runs the
   related tests after each merge and the full suite once per batch, and looks at ≤ 2 screenshots per merge.
6. **Dev servers:** several sessions run `wrangler dev` at once; sharing `game/.wrangler/state` stops room snapshots
   (black screen). Live checks use their own `--port` + `--persist-to .wrangler/<name>` (`.claude/launch.json`
   "game-shots" = port 8823).
7. Unused MCP servers/plugins (Unity, Summer Engine, Higgsfield, Notion, PixelLab, Blender, fullstory…) add ~25k tokens
   to every call — the owner may turn them off for this folder. Ponytail (lazy-senior-dev rules) is installed.

## 0.1 State (2026-11-15 17:00 play build, tag `play-2026-11-15-1700` — `main` sheet v21 (Codex mastery passives cc71714), rules suite all green, nothing pushed)

Done this session (contracts + as-built in `docs/design/job-freedom.md` §7–9): **gear enhancement rebalance** (safe to
+3, +27.5 % at +10, crit 0.5/step, failure = one step down + 저주받은 `g.cu`, 저주 해제 주문서 `uncurse` in the shop 2,500G,
blessed failure keeps the step and brings no curse) · **two main weapons for everyone** (Ⅰ/Ⅱ above the weapon slot,
`wsw` + Tab for anyone, swap-slot kind 30 % mastery XP, same kind +10 %) · **모닥불 피우기** (앉기 in the field, calm 5 s,
no live monster within 160 px → 2-minute fire, `fieldFire` in 62) · **client**: 스킬 칸 loadout tab (`loadout.js`), 전직관
reset buttons, 보스 전리품 window (`trophies.js`, Shift+T), job-reset wording · **skill enhancement +10** (`48-skill-enh.js`,
`ske_stone`, rates 100×3 80 65 50 35 25 15 10 — proposed, UI under the 스킬 칸 tab).
**타격감** (owner, mid-session): per-weapon layered impact sounds (`audio.js` `IMPACT`), own big-hit hit-stop 45→60 ms,
plain-hit shake 2.5→1.5 so crits stand out. Server hitstun lengthened on the owner's order ("경직 더 길게"):
140/200 → 220/320 ms, elites ×0.65, bosses immune, budget 340 → 520 ms per 2.4 s (`STAGGER`/`HOLD` in 50). Test expectations moved:
`dimrift.mjs` judges a clear rate over 5 draws (≥ 90 % in 3.5–10.5 min), `balance.mjs` hand floor stays ×0.7 —
runearcher's bow hand got DEX ×0.95 instead (`hand` in 02, read by `scaleOf`; T25 ×0.73). Sounds not heard by a human yet.

Afternoon (owner: "3시 30분까지 … 완성도 높게", hunting/job first, then life): **loot sources** `LOOT_X` (64-dim; ske_stone from rift
tier 5, uncurse, reset scrolls from rift/weekly/field boss; numbers from `docs/design/economy-review-2026-11-15.md`; level reset
250 G/lv) · 축복 강화석 failure = same step, no curse, retry at once (owner confirmed) · **알바 board v2** (grades 쉬움/보통/어려움,
긴급, hunt/scout kinds, night/rain + trust rows, 55 rows) · **boss patterns** donut/cone/mark/adds/share/shield/feed/jet/punch…
(56-boss-script, event `bt`; boss turn events are `bc`) · **bosses-2**: 망치 갯가재 = coast field boss, 혈루 왕도마뱀 = mesa lair
boss, 밤장막 박쥐군주 + 꽃무덤 고래 = weekly raid challenges (`DIM_CHAL.bosses`, sets 밤장막/꽃무덤, 3 legendaries; tuned
down from §6 so 4 geared bots win) + first-kill titles · **main quest** steps for jungle/oasis/cloudtemple/dunesea field
bosses (sheet v20, `questV20` remaps a v17–19 chain index) · Codex `region-beasts-refresh` merged.
**Co-op** (`68-coop.js`, `public/coop.js`, doc life-and-coop H7): 동동아파트 청소 (45×19, piles 3+3n, spawn by party) and
쥬쥬식당 서빙 (44×24, 12 tables, cook/server split; tables/orders/patience by party) — targets from a walking bot, retune after
playtests. **Weekly challenge difficulty steps** 보통…심연 up to Lv.200 (`DIM_CHAL.steps`, gate step−10, `dim.bs` best step) +
Codex rotating regional bosses (`chalOfWeek`, `rotationBig`); wire `dimr` [6 old, bs, rotation idx]. **Boss/elite HP numbers**
on bars incl. rift toughness (snapshot `HK`). Rift party scaling `DIM.hpN` [0.3,0.6,0.8,1] already existed (owner asked).
Other session: dash 72→36 px (f8b955a).

**15:30 → 17:00 (integrator, owner away: "컨텐츠 개선과 에셋 디자인"):** bosses-2 follow-ups (`docs/design/bosses-2.md` §10): trophy
recipes (피눈물 결정 → 축복 강화석, 갯가재 집게 → 홈 송곳), 박쥐 망토 + 먹장어 pet (2 % from 꽃무덤 고래), quest/weekly cosmetics now drop
(wardrobe "곧 열립니다" gone), **server-first notice** (vault op `first`, key `first:<server>:<boss>`), field-boss **stagger gauge** on the
wire (`M` row [12]) + bar, **damage ranking** toast after a boss/guardian (`dmgBoard`) + 업적 선봉장 (`cnt.mvp`), 바위 side-quest chain for the
new bosses (data/quests.json), uncurse = scroll 1,200 G + 400 G × gear tier, story-arena HUD (`sty` wire: time left + [떠나기]),
char window fits 960×600, 앉기 tooltip names the campfire. **Co-op 3–4**: 캉캉대장간 단조 (forge, `life-and-coop.md` H8) and 보글연금공방
가마 (alch = forge skin, H9; names in `COOP[k].skin`), own synthesized cues (audio.js), S-grade cosmetics 105–108 + achievements
`coopS_<k>` / `coop20` (`cnt.coop*`). Bosses-2 legendaries have their own looks (weapons.js MOTIF by item id, `UNIQ_SIL`; `who` sends a
unique weapon's id as its look). **Art**: own sprites for the bosses-2 adds (`mobart_bosses2_adds.js`) and for 숫양 / 검은 왕관 뿌리짐승 / 눈먼
문지기 올빼미 / 왕릉 파수꾼 (`mobart_named.js`); icons for 스킬 강화석, the two trophies, reset scrolls and the 8 raid set pieces (every item
now has a bag icon); 혈루 뿔 왕관 + 갯가재 집게 weapon skin (boss pool); bat-wing hem for 박쥐 망토. Codex `daily-party-hunt` merged.

Play server: `.claude/launch.json` "play-1530" (port 8830, persist `game/.wrangler/play`) restarted 16:20 on this build;
`public/index.html` carries a local `npm run stamp` cache tag (not committed, as the rules say).

**Rift = 3-floor raid** (owner, after 17:00): one run is 1단 → 2단 (하강의 문, 10 s or all stepped in) → 3단, whose 100% wakes the
final boss in the far hall; 15 min limit, ~10 min target; the 1–100 ladder is gone (sheet **v22** resets ladder records; `dim[14]` = floor).
Bots 4 × Lv 17/32/44 × 4 draws: 11/12 clear, 8.6–11.3 min, avg 9.6 (one Lv 17 draw wiped on the boss). `docs/design/scale-and-rift.md` H.7.

**Evening (owner):** rift floors 5.4–7.5× bigger, one procedural concept per floor (`DIM_FLOORS`: 무너진 지하 회랑 / 수정 동굴 / 핏빛 심연;
gauge = fixed weight ≈ 26 kills of 70–110; 균열의 문 to the boss hall; bots 11/12 in 8.1–11.4 min). **Economy**: kill gold × `HUNT_GOLD` 0.4,
`JB_PAY` ×4, co-op gold ×2.5 (economy review §6). **버드나무 마을** 70×56 with river/pond/plaza/market/dairy/fields, 6 new villagers, board kind
`chore` (`59-chores.js`, `public/chores.js`: 우유 배달 · 제초 · 쓰레기 줍기 · 전단지 · 물주기 · 강아지 산책; `perDay` 4); facilities for Codex's
`docs/design/willow-job-economy.md` (집하장, 공동 부엌, 수리대, 꽃밭, 연못) — coordinates in life-and-coop.md H10. Codex wires its 12 jobs next.

**Next, in order:**
1) Play-test the four co-op jobs (forge/alch bots hit every beat — real players score lower; retune cut-offs) and the bosses-2 raids.
2) Co-op leftovers: diner burger + two-carrier orders and a clean-plate stack (plates/sink done, C row kind 9; the 3-player cut-off
   fell to parN 1.38 because one tray clears plates — check in play); forge scorch fx; editor templates; ready check + `coop_join`.
3) Server-first notice reaches only the channel where it happened (the other channel of that server doesn't hear it).
4) 55 monsters are regional tints of another sprite (deliberate variants); the four that were different creatures now have art.
5) Town polish (§3): benches to sit on (seats would sit on a solid prop — needs care), spirit-tree canopy over the fountain.
Known (superseded by the 3-floor raid): rift tier 5+ (measured 16:10, 4 plain-geared bots at Lv.32, 3 draws: tier 1 3/3 ~5 min · 5 2/3 ~7 min · 6 0/3 · 7 1/3 ·
10/15/20 0/3 with 50–85 deaths; no single table step — monster HP ×1.08^t is the lever (tier 10 with HP ×1 clears 2/3), rewards grow
linearly; owner decision: how far plain gear should climb before enhancement/sets — nothing changed); `maps` test's build-time assert flakes under load (passes alone); job reset costs as reviewed.
**Agent worktrees from `isolation: "worktree"` start at origin/main (stale) — first step of every brief: `git rebase main`.**
Typed agents (`ui-programmer` etc.) stop at 20 turns — use `general-purpose` for anything bigger. Only the owner adds jobs.

**Owner's priorities:** content + HUD + user-friendly UI/UX first. The 경매장 (auction house) is **on hold**.

## 1. One project, one line — how Claude and Codex work together (owner's decision, 2026-11-15)

- **The integration branch is the local `main`.** Every worktree on this PC (desktop folder, `.work/codex`,
  `~/.codex/worktrees/*`) shares one `.git`, so `main` is the same for both AIs without any push. As of
  2026-11-15 `main` holds everything: `origin/main` (the cloud work), Codex's `codex/willow-plaza-release`
  (버드나무광장, fixed-size weapon motions, two greatsword sweeps, legendary silhouettes, map BGM, service-NPC
  quests, the split client), `codex/work` (mirror test), `codex/asset-review-2026-11-14` (sword icon review),
  `codex/map-bgm` and `codex/weapon-sil` (ported in `5a2fad1`). `codex/combat-effects` is **not** merged: it was
  built on the old v11 rules and is being ported piece by piece (`ai/TASKS.md`, "이식").
- **Start every task from `main`, hand it back on top of `main`.** Branch `codex/<task>` / `claude/<task>` from
  `main`; before handing back `git rebase main` (rebuild `game/src/logic.js` after part conflicts, never
  hand-merge it), run `npm run test:rules`, `data:check`, `typecheck`, `check:split`, write `ai/reports/<task>.md`.
  Claude reviews and merges into `main` (`ai/merge.md`); nobody else commits to `main`, nobody rewrites it.
- **Claim before you start.** The "진행 중" table at the top of `ai/TASKS.md` says who is doing what. Add your row
  before the first edit, remove it when merged; never start a task someone else holds. Two AIs never share a
  working tree.
- **Now:** Codex — N1 NPC-life rules ([contract](../docs/design/npc-life.md) §B–D, K), branch `codex/npc-life`,
  worktree `~/.codex/worktrees/willow-plaza-release`, dev server `http://127.0.0.1:8865/`. Claude — L2 life client
  ([contract](../docs/design/life-and-coop.md) H2), branch `claude/life-client`, desktop folder, dev server
  `http://localhost:8787/`. After N1 lands: N2 client and N3 cast data (split in `ai/TASKS.md`).
- For merges, keep sheet v12, use `defs().npclife` for the routines, and keep the owner's local player data
  (`game/.wrangler/` in each folder is per-folder and never committed).

## 2. State of main

Done and merged (all tests green, 29 suites): 4× grounds, zones, stones, 차원 균열 · game feel · day/night +
weather · autumn map · editor · responsive HUD · radar + map window (M) · bag 100 + housing (sheet v10) ·
**jobs**: J1 stats/levels 1–200/mastery/bow (v11), J2 weapon skills, J3 UI (stat tab, job tree, 아르센), **15
hybrids** unlocking at mastery 15/15 (`HYB_WM`), job tree as a 6×6 weapon table · **life**: L1 (v12, 생활 window),
L2 rules (gathering nodes, 84 recipes, pouch, 알바 board, delivery, trust) — **L2 has no client yet** · **new town**
100×76 with 15 signed buildings, 13 interiors, 16 ambient residents (`townfolk.js`, to be replaced by the NPC life
system), 15 side quests · **client split**: `client.js` is a 125-line entry + `state net events input actions
update overlay windows items hud win_char win_world win_shop win_social`; `scene2d.js` keeps the public API +
`scene_view props ground map people fx stage` (see `docs/FILEMAP.md`).

Process: slim `AGENTS.md`, `docs/FILEMAP.md`, `docs/RECIPES.md`, `docs/systems/*` (one page per system),
`ai/BRIEF.md` (brief template, routing by cost), quiet tests, `shot.mjs --el/--clip`, cache tag by
`npm run stamp` (never by hand).

## 3. Next work, in order (after §1)

1. **L2 client** from the contract in `docs/design/life-and-coop.md` H2: gathering nodes on maps (`map.nodes`,
   `ng`), gather channel + tap, station windows (craft/alchemy/cook), pouch view, 알바 board + delivery, trust;
   the 생활 window opens the four closed skills; material icons.
2. **Co-op part-time jobs** C1 (engine + 동동아파트) → C2 (쥬쥬식당) → C3 (캉캉대장간/보글연금공방) — life doc F;
   buildings/interiors already exist (town.md).
3. **Town polish**: the spirit tree's canopy hides the fountain; build building models lazily (town load
   380–450 ms); night light cost (+0.4 ms); sit on benches; job-tree cells cramped ("전직 가능" overlaps progress,
   long names like 주술암살자); "두 갈래 길은 15" hint in `mastery.js`/lobby text.
4. Verify in the live game: the nine new hybrid signatures (fx 120–128 were only seen in `_feel.html`), a real
   job change end to end, a life-skill level-up (`lv2`).
5. Codex backlog in `ai/TASKS.md`; merge with `ai/merge.md` / `AI-MERGE.bat`.

Other known follow-ups: quest tracker's last line clipped · editor can't place stones/shrines, doesn't
round-trip a map's `grade`/`nodes` · rift chest drawn under the player · sunset grade faint · `tests/maps` build-time
assertion flakes when the machine is busy (passes alone) · dead `wheel` line in `tickMob` · Lv-50/trust-60
cosmetics are titles only (need wardrobe art) · no side quests yet from service-role hosts (fixed by N4's chip).

## 4. Rules the owner set

- **No online deploy until the owner asks.** Then `npm run stamp`, commit, deploy (Higgsfield website
  `b29f4e07-243a-4614-aedf-47202eeb93fd`, slug lumentale-online; or `npm run deploy:cf`).
- Local development on the PC; Codex works in parallel (`ai/TEAM.txt` GEMINI=off). A push to GitHub `main` runs
  `.github/workflows/deploy-game.yml`, which **deploys** when the repo has its Cloudflare secrets — so push `main`
  only when the owner says so (or with `[skip ci]` in the head commit's message when the owner wants a backup push).
  Give Codex small, well-specified tasks through `ai/TASKS.md`; point it at the design contracts.
- Art is code-drawn; external/AI images only via `asset/` + import-art + owner approval (AGENTS rule 7).
- Small commits, English messages, Korean UI text; never edit `src/logic.js`; never bump `?v=` by hand.
- Token saving matters: follow `ai/BRIEF.md` (small agent tasks, lighter model for mechanical work, clipped shots).
- PC plugins (superpowers, frontend-design) are welcome; for game UI the pixel-art rules
  (`.claude/skills/pixel-art/rules/`) and the GBA HUD style win over generic web design.
- Local tools: `graphify update game` once (AGENTS token rule 0); codebase-memory per `docs/LOCAL_SETUP.md` §6.

## 0.2 Paused at the usage limit (2026-11-15 night, integrator session 2)
Main is green (last full run 58/58). The play server on 8830 is the frozen worktree `C:\Users\mankyu\Desktop\tt-play-101` (tag alpha-1.0.1),
using the persist dir `game/.wrangler/play`, so merges to main don't touch it. Unmerged agent branches, stopped mid-way (check each, finish, test, merge):
- `worktree-agent-aff621ff5bf7e238a` UX pass 2: window-state memory, tracker collapse, minimap filters, whisper key, first-time hints, settings tabs,
  drag & drop, chat item links, theme contrast (8 commits plus 2 uncommitted files: hud.css theme contrast fixes).
- `worktree-agent-a8d048b05e7609c67` HD-2D post-fx (`public/postfx.js`: bloom, tilt-shift, grading, shafts, a 끔/보통/높음 setting), 3 commits; docs not written.
- `worktree-agent-a6f4a39dde6fb34e3` life balance P7 + life items P8, 3 commits.
- `worktree-agent-a95efc88d42be57df` balance 2 (smooth the Lv.69–109 ramp keeping ≈45 h total; gear tier 6 at Lv.181), only 1 uncommitted file — redo.
Owner decisions this evening: co-op rewards are once a day, unpaid replays allowed; ~45 h to Lv.200; tier 6 at Lv.181; 칼날 소용돌이 hits 3;
the 도적's high single-target is intended. Next after those: story arcs A3–A6 (audit P4–P5), main chapters (P6), the cosmetics packages after Codex's 64 px heroes.

## 0.3 Resumed after the limit (2026-11-16, integrator session 2) — main green 59/59, sheet v24
Merged since 0.2:
- UX pass 2: window memory, tracker fold/pin, minimap filters, Shift+R whisper reply, first-time hints, settings tabs, bag↔warehouse drag,
  chat item links, theme contrast.
- HD-2D post-fx: `public/postfx.js`, the 그래픽 효과 끔/보통/높음 setting, auto-drop.
- Life P7/P8: hours to L50 −27 %, recipes never lose money, 87 board rows, 25 life items, 물고기 도감 `fbook`.
- Balance 2: curve smoothed, 45.2 h to Lv.200, gear tier 6 운철 at Lv.181.
- Story arcs A3–A6 (docs/design/arcs.md; lore to review), main chapters P6 (8 chapters, chain 43 steps, `mainChapter` side quests, v24).
- Maps 2: new ground `inklake` 먹빛 호수 (Lv.157–181); 속삭임 숲 and 뼈의 지하묘지 widened. 바람초원 widening is blocked because the balance tests
  measure on its layout.
In flight: co-op polish (apt walls/dumpster, library walk-ins, forge anvil ingot).
Next:
- Give the balance/skills/hammer tests a fixed arena, so 바람초원 can widen.
- inklake ink palette and monster bodies (art).
- Cosmetics, after Codex's 64 px heroes.
- Owner lore picks: the spell origin, whether 도톨/갈피 move, the seven-star mark.
The play server on 8830 still serves the frozen alpha-1.0.1 worktree (C:/Users/mankyu/Desktop/tt-play-101).

## 0.4 Round 2 after the limit (2026-11-16, integrator session 2) — main green 59/59, sheet v25
Merged, each from its own worktree agent (nothing pushed; play server 8830 still on alpha-1.0.1 in tt-play-101):
- **UX pass 3** (ux-audit §Pass 3): world-map [걸어서 이동] / double-click → `Track` walk; chat [시각] toggle
  (`lumentale:chattime`); item links in whispers (validated by `chatLinks`, carried across channels as `whisperItems`);
  trade walked live with two players (particle + "거래를 취소했습니다" fixes).
- **먹빛 호수 art**: inkleech, inkfish, inkmoth, plumspider, inkrose redrawn bigger (mobart_inklake.js).
- **Main quest texts**: 10 flat main rows rewritten in 엘더윈's voice (arcs.md P6). Owner check: row 22 (moleworm) echoes
  "함락되던 밤" — only an echo, not lore.
- **P9 dye** (v25): `ch.cosDye {id: 1–6}`, six 연금 dyes, `cos_dye` / `cos_sew` at 루루; worn code `n + 1000 × dye`;
  `KEEP_SEW` is a hook (all `kp_*` → "" until P11 draws the pieces).
- **New-player QA** (sign-up → Lv.7): tutorial bag step sent twice, 추적 to 리나 at night, empty chore rows, last-line
  dialogue button, particles.
- Mine: tier-6 arrow colours (scene_fx.js), job text shows the grade's count (board.js `sayN`), tracker walks to a
  monster's spawn area when none is in sight (`map.sp`, 34-maps-world.js `spawnHints`; test in worldmap.mjs).
Open from QA: 경비병 토비 lines 1/4 repeat; 리나's window says "어서 와요!" while she is away; auto-hunt leaves gold.
Next: P10 outfit set 1 (64px art) → fills `KEEP_SEW`; P12 장날 after P10.

## 0.5 Round 3 (2026-11-16) — main green 60/60, sheet v26
- **P10 outfit set 1** (codes 131–140): 버드나무 마을 (kp_willow_key sewn, repwillow, chore100 → `cnt.chore`), 협동 알바 왕
  (`coopall` = all 5 coopS_*), 낚시 기록가 (fbook, fbig10). `COS_ACH` maps one achievement to a list. `brush.fp` half-pixel
  details only on the 64px rig. Not done: 견습 장인 ×6, 명인 redraw.
- **Mid-game 2-player QA**: npctalk repeat line, 무인 판매함 greeting, auto-hunt grabs drops on the way, tip box vs player menu
  z-order, co-op card position, "(Space / F)". The library is **올빼미 도서관** everywhere (owner's name; data + docs renamed).
- Mine: co-op start button only for the leader; **party rejoin within 60 s** after a reload (`partyRejoin`, tests/party.mjs);
  join toasts in your own voice; guild invite uses [길드].
- **P12 장날** (`63-festival.js`, tests/festival.mjs): season from S.now (epoch 2026-03-01 KST, 91-day blocks; now 가을);
  `dn` = [wx, clock, season, 장날]; Sunday 10–22 KST: 4 fair 알바 rows (tokens, cap 8/day), pan contest (60/90 → +1),
  장꾼 다래 (willow 53,23) sells a season piece for 20; P11 season ids `hat_/top_/back_/ws_ssn_<sakura|sea|maple|snow>` are
  listed disabled ("곧 들어옵니다") until P11 adds them to COSMETICS.
Next: P11 (season set art + story keepsake pieces → fills the rest of KEEP_SEW); stalls only on Sundays (art).

## 0.6 Round 4 (2026-11-16) — main green 60/60
- **P11** (codes 141–162): four season sets (hat/top/back/wskin, sold by 장꾼 다래 for tokens) and the story keepsake
  pieces; `KEEP_SEW` filled. **Cosmetics remainder** (163–181): 견습 장인 ×6 (`life30_<skill>`), face +8 (4 shop, 4
  achievements), wskin +5 (버들 가지, 등불, 사원 종, 고래뼈, 별사탕). Not done: 명인 redraw.
- **content-audit-2026-11-16.md** (Lv.40–200): Q1 잉크 호수 「나루터의 먹물」 (사공 여울, 158–180, choice ending),
  Q2 「거꾸로 흐르는 물」 (토룩/울로, 86–98), Q5 바스's arc as a story (+ `sq_bas_frost` 195) are built.
  **Owner decisions pending:** Q3 (late main-chain kill counts 24/28/32 + beats), Q4 (party-only side goals),
  Q6 (weekly field-boss 기록, reset cadence), Q7 (what a Lv.200 player repeats). Q5's old rewards are above scale.
- Open: Q1 has no keepsake (needs a wardrobe piece); 장날 stalls stand all week; bench-tick 43 players ≈ 1 ms/tick.

## 0.7 Token-saving rules in force (owner's order, 2026-11-16, after the usage breakdown)
Session 404739f1 spent ~75 % of its tokens in 64 agents (2–6 M each, all on the big model) and ~20 % on an integrator
context that sat at ~380 k per turn. From now on:
1. **Hand over at ~250 k context:** update this file (§0.x), then start a fresh integrator session from it.
2. **≤ 2 agents at a time, `model: "sonnet"`** for QA, text, data, art and docs. The big model only for rules design.
3. **One full-suite run per merge, by the integrator.** Agents run only the tests for their own files (`node scripts/test-all.mjs <names>`);
   `maps` flakes under load — rerun it alone, never twice the whole suite.
4. **Agent briefs are short** (goal, files, "done" test, ≤ 20-line report). Don't paste whole docs into briefs.
5. **Screenshots from worktrees work out of the box** — `scripts/artkit.mjs` now falls back to the main checkout's
   playwright, so `node scripts/shot.mjs …` runs in any worktree (no custom harness, no node_modules link).
6. Prune merged agent worktrees after each round (`git worktree remove` only if clean and merged into `main`).
7. The owner can also cut ~5 % of every turn by disabling unused MCP connectors (pixellab, summer-engine, blender, notion,
   ads tool, unity) in the app's settings — an app setting, not ours to change.

## 0.8 Late-game QA merged (2026-11-16) — main green 60/60, sheet v26
Fixed: tracker label for quest stations, board hint text, finished quests as one line (weekly shows "월요일 6시"), auto-hunt
no longer walks out of a rift. Q6 weekly boss quests are in. **Open (owner/balance, not fixed):** rift 15 min is tight for
2 players (gauges ≈ 12.5 min, boss by hand); auto-hunt ignores elites (elite quests need manual chasing); Lv.161 먹빛 호수
mobs kill a Lv.196 tier-6 char; tracker never uses waypoint stones/귀환; NPC idle lines don't change after arcs end;
재봉사 실비 opens a window titled 루루 and a sewn piece isn't auto-worn; docked quest window 228 px wide at 1100×680.
Pending owner picks: Q3 (late main kill counts), Q4 (party-only side goals), Q7 (post-Lv.200 goals).

## 0.9 레이드던전 (was 차원 균열) retuned (2026-11-16) — main green 60/60
Players see "레이드던전" (owner's name; 균열 지기 / 차원의 오벨리스크 unchanged). Owner's pacing: gauges of all 3 floors ≈ 6 min
for fast mob killing, boss ≤ 3 min; the 15 min `limit` is only a cap against pushing the step to farm, not a time attack.
Retune: `gK` 2.5→4.2, `hpBase` 4.9→4, `bossHp` 0.65→0.6 (31-maps-dim.js); tests/dimrift.mjs has pace bands for duo/trio.
Bots ≈ 4–5 min, real play expected 6–8 (QA duo took 12.5 before). If still slow: `gK` 4.5. Solo/low-tier trios still wipe on some bot draws.

## 0.10 Diablo-style item system + tooltips (2026-11-16) — main green 61/61
Owner's spec: item level 1–200 (`il` on every gear entry; worn from `il − 10`, legacy pieces derive `il = req + 10` so nothing moves;
crafts keep their old levels, tier 6 still Lv.181), affix lines 마법 2 / 희귀 3 / 전설 4 (+ the legend power), new **유니크** (q5, beige
#D2B48C, a legendary's power `lg` named like a 전설 (`[효과 접두사] 이름`, no suffix, no `un`) + 4 ordinary lines ×1.45 (`AFFIX_MUL[5]`, ≈ +12 % over a 전설); drop 0.1/0.4/1 % by rank × MF).
Client: items.js `itemTip` Diablo card + side-by-side `[장착 중]` compare, `public/_tip.html` (`shot.mjs --page tip`) preview,
HUD menu icons now show a label under the glyph (desktop glyph 24→12 px) + hover tooltip name (key). Sheet stays v26 (`il` additive).
Unverified: unique drop rate and strength in real play; server wear gate vs client `reqLv` agree in tests only.

## 0.11 Prefix effects: build plan in progress (owner: "implement all 95, balance later")
Design: docs/design/prefix-effects.md (95 effects, 87 phase 1 + 8 phase 2, incl. 단련의/약탈의). Order: P1a infrastructure (agent running;
registry LEGEND/PFX/PFX_FN, dispatchers in 51-prefix.js, no-stack, pools) → P1b-A offense + **Enchant** → P1b-B defense/utility + P2 hooks.
New files for effects go in part files ≥ 52 extending the registry with Object.assign (no edits to 10-tables/51-prefix).
**Enchant (owner 2026-11-16):** each prefix has a low-chance drop scroll (item `es_<key>`, generated late from LEGEND); a town enchant NPC applies it.
Only 희귀(q2)+ gear; 희귀 → +1 random affix line, becomes 전설 with the prefix; 전설/유니크 → the prefix is overwritten (same key refused);
the scroll only fits slots its prefix may roll on; set pieces excluded; **costs gold scaled by item level** (constant table, below a craft fee,
shown in the window, validated server-side).
**Enchant NPC (owner):** name **지선** — a cute 햄스터 NPC who stays at the 대장간 (forge) and is **대장장이 볼칸's younger sister** (owner wrote 불칸 = the town smith `smith` "대장장이 볼칸", 34-maps-world.js:231).
Give her a look (햄스터 species), a few talk lines mentioning 볼칸 as her older brother, and a one-line mention in 볼칸's own talk if cheap.
**Collaboration with Codex (owner 2026-11-16):** the whole item/prefix/enchant overhaul is written up in `docs/design/item-system-spec-2026-11-16.md`
(requirements, contracts, who does what). **Claude agents:** W0 infrastructure (running) and W3-B (defense 39 + helm 8 + phase-2 hooks 8).
**Codex:** W5 content plan (start now), W1 affix categories, W2 enchant + NPC 지선, W3-A offense 48, W4 balance — tasks are in ai/TASKS.md CODEX.
After W0 merges, remove its claim row from ai/TASKS.md and write "P1a merged <hash>" here so Codex starts W1/W2/W3-A.
## 0.11 Prefix powers, P1a infrastructure (2026-11-16) — main green 62/62, no sheet change (`lg:"key"` as before)
Design: `docs/design/prefix-effects.md` (95 powers). Built: the registry, the hooks, the caps, the roll by slot pool, no-stack + `self.lgOff` + the grey tooltip line, the
8 old powers moved onto `PFX_FN` with identical results (differential run of 24 bots × 8 powers over 2500 ticks: same hashes). **How to add powers (do NOT edit 10-tables / 51-prefix / any shared file):**
- One NEW part per group, name `NN-prefix-<group>.js` with NN ≥ 52 (`52-prefix-blow.js`, `53-prefix-guard.js` …; the build loads parts by name, after 51). Per power, three load-time lines:
  `Object.assign(PFX, { frost: { p: 0.15, ms: 1200, elite: 0.5 } });` (numbers only here; add `on: 1` when code + test are done, until then it never drops),
  `Object.assign(LEGEND, { frost: ["빙결의", pfxText("frost", "공격 시 {p:%}% 확률로 적을 {ms:s}초 얼린다"), "WG", "O", "M", "blow"] });` (`{k}` raw · `{k:%}` ×100 · `{k:+%}` (×−1)×100 · `{k:-%}` (1−×)×100 · `{k:s}` ms→s; slots W R G A B N H; cat O/D/U; rating S/M/L; fam as in the design §3),
  `Object.assign(PFX_FN, { frost: { blow(S, rt, p, st, mob, x, y, fin, skip) { … } } });`.
- Hooks (all signatures in the header of `51-prefix.js`): `pre mul hit crit kill blow skill miti hurt lethal dash evade tick status pot loot stat sheet num`. Damage a power deals: `hurtMob(S, rt, mob, p, mult, false, PX)`
  (a `px` blow runs no `blow/hit/crit` hook; `pre/mul` and `kill` still run). Chances `pfxChance(S, st, base)`; ICD `pfxIcd(S, p, key, ms)`; counters `pfxStack`; heals `pfxHeal` (≤ 8 % mhp/s);
  state `pfxPc(p)` (`cd` survives map change and death, `n t v heal` do not). Caps are enforced by the dispatchers (dmg ×1.6, speed ×0.8 / 45 %, miti ×0.6, absorb 20 %, xp +15, gold +100, 1 stone).
- Test: `tests/prefix.mjs` already walks every `LEGEND` row (shape, slots vs cat, Korean tooltip with a number, PFX numbers, PFX_FN hooks, `defs.legend`) and, once all 95 exist, the pool sizes. Add your own per-power
  tests in the same file's style (or a new `tests/prefix-<group>.mjs` + `tests/LIST`): fire with `rnd` forced via `S.seed`, numbers from `PFX`, ICD, `px` no-chain, bosses immune where stated. Wear a power on any piece: `W.wear(slot, id, "key", il)` pattern in `prefix.mjs`.
- Phase 2 needs no new hook: ZN = `rt.zones.push({ …, px: 1 })` (the zone loop honours `px`); ABS = a shield kept in `pfxPc(p).v` and offered through `miti`'s `r.abs` (the dispatcher caps it at 20 % mhp; reduce your shield by what you offered);
  AURA = the `tick` hook walking `members(S, p)`; DOT2 = a `mob.pd` your `hit` hook sets and your own `tick` hook (1 s) pays out with `hurtMob(…, PX)` (the dagger's `mob.dot` is untouched).
Known: a basic arrow now calls `blow` (so 뇌명의 works on a bow; before it silently did not); `deathLoss(ch, p)`, `skMp`, `dashCd(p)`, recall, pet interval, campfire rest read `pfxNum`.
**P1a merged 4d02d68 (2026-11-16).** Codex: W1/W2/W3-A may start. Effect part files: Codex offense = `52-prefix-*.js`, Claude defense = `53-prefix-guard.js`,
helm utility + phase-2 hooks = `54-prefix-util.js`; extension recipe, hook signatures and helpers are in §0.11 above. Suite 62/62.
**W3-B merged (2026-11-16, suite 64/64):** `53-prefix-guard.js` (33 defense; 28 `on`, **5 held back `on:0`: after relax chase panic slick** — their move-speed half only changes
`stats(p).spd`; the client walks at `self.spd` (= `spd0`) × its own buff constants (`public/update.js:203`), so a timed/conditional prefix speed needs a wire field first) +
`54-prefix-util.js` (8 helm + 8 phase-2, all `on`). Shared edits: `80-simulation.js mobHit` sets `p.hitHow`; `51-prefix.js pfxMiti` reads `p.pc.aura`.
Known: 추적(trace) +25 % xp is cut to +15 % by the prefix xp cap (tooltip overpromises); 후광(halo) works solo; zone events shake the screen every 0.5 s; new weapons' `lg` have no weapon look
(only the first 8 powers do, `tests/wardrobe.mjs LOOKS`). Codex W3-A/W2 will touch `itemlevel.mjs`/`wardrobe.mjs` the same way — keep the permissive wardrobe check.
**W2 ownership (owner 2026-11-16):** the enchant system (scrolls + icons, 지선, window, fee, 추출의 마법망치) is **Codex's** task (a short Claude agent was started and stopped; nothing was built). Spec §3.3/§3.4.
**장날 market merged (2026-11-16, suite 65/65, sheet v27):** `FAIR` = Tue+Sat 19:00–21:00 KST (`63-festival.js`), merchants `fm_leg fm_scr fm_rune fm_cos fm_food fm_dye` (`64-fair-market.js`, `public/fairmkt.js`),
once per player per product per day (`ch.fairBuy`), prices in `FAIR_PRICE` (legendary 15k×(il/30)^1.35, scroll 40k, costume 60k …). 몽실 (scroll vendor) fills itself once `es_*` items exist (Codex W2).
**Sheet `v` is now 27:** Codex's branches that bump `v` must rebase and re-pin the ~16 tests that assert it. Help/Guide read days from `defs.fair.days`.

## 0.12 Smartphone UI + local play server (2026-11-16)
Merged: smartphone menu (`public/phone.js/.css`, setting "메뉴 방식", key `phone` = Backquote, "내 핸드폰" tag over the pocket button). **Local play server:** frozen worktree `../tt-play-current` at 644a4d8,
launch config `play-local` (port 8830, LAN http://192.168.31.58:8830, saves in `game/.wrangler/play`). To update the build: `git -C ../tt-play-current checkout --detach <commit>` then restart `play-local`.
Weekly usage of the integrator was ~10 % left at this point: new sessions should start from this file, run ≤ 1 agent at a time, and leave heavy work (W1/W2/W3-A/W4/W5, prompts in the item spec) to Codex.
