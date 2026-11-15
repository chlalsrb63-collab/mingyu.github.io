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
