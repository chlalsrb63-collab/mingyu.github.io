# Story arcs as built (content-audit-2026-11-15.md §3)

Side-quest arcs in `game/data/quests.json` on the P1 engine (`62-side-quests.js`). Rewards follow audit §3: XP 15 % of
`lvt[Lv]` (last step 30 %), gold 30 × Lv (last × 2); optional branch steps 10 % / 15 × Lv. Tests: `tests/sidequests.mjs`.

## P3 — the 피난민 thread (A1 + A2)
**A1 「버드나무의 새 식구」 Lv 5–15** (after `sq_willow_letter`)
1. `sq_doran_blanket` 촌장 버들 → deliver 낡은 담요 to 도란 · 2. `sq_doran_wood` 도란 → collect 마른 가지 × 8 (쓱싹's new line says where)
3. `sq_gamja_kong` 감자 → make 감자구이 × 3 · 4. `sq_kong_wait` 콩알 → choice:
   [같이 기다리자] opens `sq_sol_lullaby` (솔 → talk 콩알) · [내가 찾아볼게] opens `sq_kong_drawing` (deliver 콩알의 그림 to 모리,
   who sends it down the 등불 trail to 치치 — A2's lead one step early). Both branches are optional; both picks go on.
5. `sq_doran_fence` 도란 → talk 마루 (바람초원) → keepsake 버드나무 새집 열쇠, title 「버드나무 이웃」.

**A2 「마지막 불빛」 Lv 55–72** (after A1)
1. `sq_neon_bell` 치치 → talk 도톨 · 2. `sq_dotol_sign` 도톨 → collect 네온 고철 × 6 · 3. `sq_dotol_hound` 도톨 → elite 세 머리 들개
   「쇠사슬을 감은 철문 들개」 in 네온 시티 (the arc's only kill) · 4. `sq_dotol_photo` 도톨 → deliver 가족사진 to 도란
5. `sq_doran_light` 도란 → choice, both → keepsake 마지막 불빛 등, title 「불빛을 지킨 자」:
   [돌아오라고 전할게요] opens `sq_dotol_ember` (deliver 간판등 불씨 to 모리) · [불빛을 지키게 둬요] opens the 알바 row
   `jb_neon_supply` (도란's 채소 볶음 × 2 for the city; JB rows may now carry `flag: [quest, pick]`).

**Retired:** `sq_willow_frogs`, `sq_merc_hares`, `sq_borum_frogs`. Old sheets: one under way is dropped (kill progress paid
nothing), a finished one stays in `sq.done`. `sq_merc_boar` and `sq_borum_blight` no longer need them.

**New NPCs — lore for the owner to check**
- 피난민 도란 (`willow_doran`, willow 25,30, 다람쥐): lost her husband's hand in the crowd at 네온 시티's gate; knits; watches the sky for a light.
- 꼬마 콩알 (`willow_kong`, willow 26,29): her son; keeps three acorns, one for his father; "형아" to the player.
- 간판장이 도톨 (`city_dotol`, city 146,53 by the gate to 버드나무광장): ran the sign shop "도톨 네온"; stayed to keep its lamp lit so stragglers find the road.
- 솔's lullaby is his grandmother's 피난길 song; 모리 knows 도톨 by his drawing and passes word along the seven lantern keepers.
- Not done (owner decision #3): 도톨 does not move home on [돌아오라고]; he still stands in the city. No npclife rows (the cast has no willow members yet).

## P4 + P5 — the sky road, the bell, the last chronicler, the rift writer (A3–A6)
Engine additions: a collect goal of a quest item may name its source — `mob` (35 % a kill, straight into the bag) or
`rift: true` (one per cleared rift chest, `64-dim.js dimChest`); a made quest item is handed over; a recipe with
`sq` is known only while that quest is on (`q_ink`). Each arc has at most one plain kill.

**A3 「바람등호의 항해일지」 Lv 100–125** (after `sq_airship_logbook`) — 1 `sq_chomi_pages` 초미 → 젖은 일지 낱장 × 3 from 집게 소라게
(산호 해안) · 2 `sq_aru_tonic` 아루 → make 신속의 물약 × 2 · 3 `sq_noeul_stone` 노을 → talk 길잡이 망고 (정글 camp: the stone's seven
stars) · 4 `sq_sora_light` 조개잡이 소라 (coast camp) → elite 「등불을 삼킨 산호 뿔 거북」 · 5 `sq_chomi_chart` choice → 바람등호 나침반:
[엘더윈께 보고하자] 「정직한 항해사」 + `sq_elder_chart` (deliver 옛 항로 사본 to 엘더윈) · [옛 지도는 우리만 알자] 「항로의 비밀」 +
A5's hint step `sq_galpi_chart` (바스 knows the star mark behind the chapel).
**A4 「종과 별」 Lv 117–165** — 1 `sq_eunha_bear` 은하 → kill 종지기 곰 (the only kill) · 2 `sq_eunha_rubbing` deliver 종 무늬 탁본 to
대상 몰이꾼 사막 (dunesea camp) · 3 `sq_samak_sieve` 심연 결정 × 6 · 4 `sq_samak_ingot` make 심연 주괴 × 2 · 5 `sq_samak_bell` deliver
모래 속의 종 to 노랑 (older than 루넬샤's letters) · 6 `sq_norang_bell` deliver the bell to 은하: eight bells, the clouds part toward
단풍 왕도 → 작은 사원 종, 「종을 되찾은 자」. Not built: "main 28 must be done" (no main-index gate; Lv 117 stands in).
**A5 「마지막 사관」 Lv 157–190** — 1 `sq_galpi_records` 갈피 → 썩어 가는 왕실 기록 × 4 from 한 꼬리 다람쥐떼 · 2 `sq_galpi_chapel`
talk 무너진 예배당 비문 · 3 `sq_borum_ink` 보름 → make 기록 보존액 (alch 30, quest recipe) · 4 `sq_galpi_stag` elite 「마지막 장을 깔고
앉은 사슴왕」 · 5 `sq_galpi_end` choice → 사관의 깃펜: [도서관에] 「사관의 증인」 + `sq_galpi_archive` (deliver 왕도의 마지막 기록 to
보름) · [함께 묻어요] 「잠든 사관의 벗」 + `sq_galpi_rest` (바스: a maple leaf on the altar). 갈피 still stands after [묻어요] (no
flag-hidden NPCs, as with 도톨).
**A6 「균열을 적는 자」 Lv 60–157** (after `sq_kong_parcel`) — 1 `sq_bogle_shards` 보글 → 균열 조각 × 3 (rift chests) · 2
`sq_borum_rubbing` 보름 → talk 오로 · 3 `sq_bogle_essence` make 경험의 엘릭서 (audit said 연금 정수, alch 50: too steep at Lv 100) ·
4 `sq_borum_krion` kill 크리온 · 5 `sq_bogle_hand` talk 보름 → 균열 표본병, 「균열 기록관」.

**Retired:** `sq_borum_blight` (the 1.02 M XP outlier), `sq_bawi_deer`, `sq_dongdong_pigeons`, `sq_bogle_crows` — as in P3:
under way → dropped, finished → remembered. Camp keepers reused (소라, 사막, 망고, 바스) instead of the audit's 소라/바람 doubles.

**New NPCs and lore — for the owner to check**
- 종지기 은하 (`temple_eunha`, cloudtemple 37,62 by the camp): eight bells made the cloud sea's path; one went missing.
- 금세공사 노랑 (`mesa_norang`, mesa 34,10): reads metal; the bell's letters are older than 루넬샤's royal script.
- 사관 갈피 (`maple_galpi`, maple 168,63): the kingdom's last chronicler, a ghost-lamp; wrote what the king told him.
- 무너진 예배당 비문 (`maple_altar`, maple 182,130, a thing): the crowned stag was the conquered people's beast, crowned by the conquerors.
- One mark ties A3/A4/A6: seven stars in a ring — on the sky road's stones, the bell, the rift shards' "signature". Whose hand: open.
- **Open lore (audit §6.1, undecided):** A5's last page hints all three options and settles none — "a cold wind from the
  north ice castle (b), all night iron hammering under the western ground (a), and that night the long-sleeping thing
  opened its…" — burnt; "the rest the northern 비석 knows" (c). Rewrite one line once the owner picks.
