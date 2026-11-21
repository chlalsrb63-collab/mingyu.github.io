// ───────────────────────────── the action table ─────────────────────────────
// One row per action `t`, its check and its mutation side by side:
//   check(S, p, a) → OK or bad(…)   asked by validateAction (70-validate.js) after its shared guards
//   run(S, p, a)                     done by applyAction (75-apply.js) once the check said OK
// A row with `down: true` may be asked while the hero is down; any other row is refused first with
// "쓰러진 상태입니다". A name missing here is "알 수 없는 행동".
const ACTIONS = {
};

// Whole systems keep their check and mutation in their own part; these names go straight to them.
for (const [names, check, run, down] of [
  ["buddy", buddyValidate, buddyApply, true],                 // 69-buddy.js
  ["mingyutest", devTestValidate, devTestApply, true],        // 74-dev-test.js
  ["ab_start ab_act ab_leave ab_close", albaValidate, albaApply, true],   // 일일 아르바이트 (66-alba.js)
  ["rest", restValidate, restApply, true],                    // 69-rest.js
  ["camp", campValidate, campApply],                          // 62-daynight.js
  ["sq", sqValidate, sqApply],                                // 62-side-quests.js
  ["dim_open dim_ready dim_cancel dim_leave dim_join", dimValidate, dimApply],   // 레이드던전 (64-dim.js)
  ["bag_expand", bagValidate, bagApply],                      // 46-bag.js
  ["house_buy house_upgrade house_style house_visit house_leave furn_buy furn_place furn_rot furn_pick h_dep h_wd h_sort h_rest", homeValidate, homeApply],   // 64-housing.js
  ["job_reset lv_reset lo", jfValidate, jfApply],             // 47-job-freedom.js
  ["ske", skeValidate, skeApply],                             // 48-skill-enh.js
  ["gat gat_tap craft_open craft jb", lifeValidate, lifeApply],   // life skills L2 (58-life.js): gathering, the stations, the 알바 board
  ["blk w wk", socialValidate, socialApply],                  // 차단, 귓속말, 주간 수첩 (63-social-weekly.js)
  ["charm_quest charm_id charm_place charm_move charm_remove charm_expand charm_claim charm_destroy charm_preset charm_fuse", charmValidate, charmApply],   // 66-charms.js
  ["enc_apply enc_extract enc_craft rune_fuse rune_extract", encValidate, encApply],   // enchant scrolls, extraction hammer, rune fusion (65-enchant.js)
  ["coop_start coop_act coop_leave", coopValidate, coopApply],   // 협동 아르바이트 (68-coop.js)
  ["fair_buy", fairValidate, fairApply],                      // 63-festival.js
  ["fair_open fair_shop", fairMktValidate, fairMktApply],     // the 장날 merchants (64-fair-market.js)
  ["sx", sxValidate, sxApply],                                // player to player (69-social-play.js)
]) for (const t of names.split(" ")) ACTIONS[t] = { down, check, run };
