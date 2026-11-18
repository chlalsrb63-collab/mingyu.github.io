/**
 * pixelfx layers of the melee skills: sword, dagger, spear, hammer and the melee hybrids. The engine and the layer
 * fields are documented in skillpfx.js. CAST: played when the skill goes off ("a"/"hm" events; `on: "wind"` layers play
 * on a combo skill's wind-up instead). HIT: played on every monster my own skill strikes (`crit: true` = only on a crit).
 * PROC: a weapon passive's proc (skillfx.js PS codes), played where the proc happened.
 */
export const CAST = {
  // ── 대검 (swordsman)
  80: [{ fx: "impacts/hit-spark", up: 10, cut: 0.6, pal: "gold" }, { fx: "melee/heavy-cleave", aim: true, up: 10, speed: 1.6 }, { fx: "impacts/ground-slam", at: "tgt", speed: 2, cut: 0.6, delay: "flight" }],
  81: [{ fx: "melee/sword-slash", aim: true, up: 8, pal: "dust", speed: 1.8 }, { fx: "nature/quake", aim: true, speed: 2, cut: 2.4, delay: 60 }, { fx: "explosions/dirt-explosion", at: "tgt", speed: 1.8, cut: 0.6, delay: "flight" }],
  83: [{ fx: "holy/sunburst", up: 14, speed: 1.8, cut: 1.2 }, { fx: "holy/smite", at: "tgt", speed: 1.6, cut: 2.4, delay: 120 }, { fx: "holy/feather-burst", at: "tgt", up: 6, speed: 1.6, cut: 1.8, delay: 300 }],
  140: [{ fx: "lightning/spark-arc", on: "wind", up: 14, pal: "metal", cut: 1.2 }, { fx: "melee/sword-slash", at: "tgt", up: 14, speed: 1.6 }, { fx: "impacts/crit-hit", at: "tgt", up: 10, delay: 150 }],
  146: [{ fx: "spawn/poof", on: "wind", pal: "dust", cut: 1 }, { fx: "melee/spin-slash", pal: "job", speed: 1.4 }, { fx: "melee/sword-slash", aim: true, up: 8, pal: "job", speed: 1.8, delay: 150 }],
  153: [{ fx: "spawn/poof", on: "wind", pal: "dust", cut: 1 }, { fx: "melee/sword-slash", aim: true, up: 8, speed: 1.8 }, { fx: "impacts/blunt-hit", at: "tgt", up: 10, delay: "flight" }],
  158: [{ fx: "impacts/shield-block", on: "wind", up: 14, cut: 1 }, { fx: "impacts/parry", up: 14, pal: "metal" }, { fx: "impacts/ricochet", at: "tgt", up: 12, delay: 120, cut: 1 }],
  159: [{ fx: "holy/sunburst", on: "wind", up: 16, pal: "stone", cut: 1.2 }, { fx: "impacts/ground-slam", at: "tgt", speed: 1.6, cut: 0.6 }, { fx: "nature/boulder", at: "tgt", cut: 2, delay: 120 }, { fx: "explosions/dirt-explosion", at: "tgt", speed: 1.6, cut: 0.6, delay: 100 }],
  // ── 단검 (thief)
  84: [{ fx: "spawn/poof", pal: "shadow", cut: 0.8 }, { fx: "melee/double-slash", at: "tgt", up: 8, pal: "shadow", delay: 100 }, { fx: "impacts/crit-hit", at: "tgt", up: 8, pal: "blood", delay: 220, cut: 0.9 }],
  85: [{ fx: "shadow/shadow-tendrils", up: 4, pal: "shadow", cut: 1, speed: 1.6 }, { fx: "melee/dagger-flurry", aim: true, up: 10, pal: "shadow" }, { fx: "impacts/hit-spark", at: "tgt", up: 8, pal: "shadow", delay: "flight" }],
  86: [{ fx: "spawn/poof", pal: "shadow", cut: 0.8 }, { fx: "melee/dagger-flurry", at: "tgt", up: 8, pal: "job" }, { fx: "melee/claw-swipe", at: "tgt", up: 10, pal: "metal", delay: 160, speed: 1.6 }],
  141: [{ fx: "shadow/shadow-tendrils", on: "wind", up: 4, pal: "blood", cut: 1, speed: 1.6 }, { fx: "melee/claw-swipe", at: "tgt", up: 10, pal: "blood", speed: 1.5 }, { fx: "explosions/small-explosion", at: "tgt", up: 8, pal: "blood", delay: 200, cut: 1 }],
  155: [{ fx: "lightning/spark-arc", on: "wind", up: 12, pal: "metal", cut: 1.2 }, { fx: "melee/spin-slash", pal: "metal" }, { fx: "melee/dagger-flurry", up: 8, pal: "metal", delay: 200, cut: 1.4 }],
  157: [{ fx: "explosions/smoke-bomb", on: "wind", up: 6, cut: 1 }, { fx: "explosions/smoke-bomb", at: "tgt", delay: "flight" }, { fx: "spawn/poof", at: "tgt", pal: "smoke", delay: 300, cut: 1 }],
  // ── 창 (lancer)
  87: [{ fx: "impacts/hit-spark", up: 10, pal: "metal", cut: 0.5 }, { fx: "melee/thrust", aim: true, up: 10 }, { fx: "melee/uppercut", at: "tgt", up: 8, pal: "metal", delay: 150, cut: 1.2 }],
  88: [{ fx: "projectiles/flare", at: "tgt", up: [90, 10], pal: "gold", cut: 1 }, { fx: "impacts/ground-slam", at: "tgt", speed: 1.8, cut: 0.6, delay: 150 }, { fx: "explosions/small-explosion", at: "tgt", pal: "gold", delay: 180, cut: 1.2 }],
  89: [{ fx: "lightning/lightning-strike", at: "tgt", pal: "volt", cut: 1.6 }, { fx: "lightning/ball-lightning", at: "tgt", up: 14, pal: "volt", delay: 150, cut: 1.5 }, { fx: "explosions/plasma-explosion", at: "tgt", pal: "volt", delay: 250 }],
  135: [{ fx: "holy/sunburst", up: 18, pal: "gold", speed: 1.4, cut: 1.5 }, { fx: "holy/feather-burst", size: 2, speed: 1.4, cut: 2.4, delay: 150 }],
  142: [{ fx: "spawn/poof", on: "wind", pal: "dust", cut: 0.8 }, { fx: "melee/whip-crack", aim: true, up: 10, size: 2 }, { fx: "impacts/hit-spark", at: "tgt", up: 8, pal: "metal", delay: "flight" }],
  147: [{ fx: "lightning/spark-arc", on: "wind", up: 12, pal: "gold", cut: 1.2 }, { fx: "melee/spear-sweep", aim: true, up: 6, pal: "job" }, { fx: "melee/double-slash", aim: true, up: 10, pal: "job", delay: 100 }],
  // ── 해머 (destroyer)
  130: [{ fx: "impacts/hit-spark", up: 12, pal: "gold", cut: 0.5 }, { fx: "melee/hammer-smash", at: "tgt", speed: 1.5 }, { fx: "impacts/heavy-landing", at: "tgt", delay: 200, cut: 1.2 }],
  131: [{ fx: "explosions/dirt-explosion", up: 2, speed: 1.8, cut: 0.6 }, { fx: "nature/earth-spike", at: "tgt", speed: 1.8, cut: 2.6, delay: 120 }, { fx: "nature/boulder", at: "tgt", cut: 2, delay: 300 }],
  132: [{ fx: "melee/hammer-smash", at: "tgt", speed: 1.4, pal: "stone" }, { fx: "impacts/ground-slam", at: "tgt", speed: 1.6, cut: 0.6, delay: 150 }, { fx: "explosions/big-explosion", at: "tgt", speed: 1.6, cut: 1.1, delay: 250 }],
  148: [{ fx: "spawn/poof", on: "wind", pal: "dust", cut: 1 }, { fx: "impacts/heavy-landing", speed: 1.5, cut: 1.4 }, { fx: "explosions/dirt-explosion", up: 2, speed: 1.6, cut: 0.6, delay: 100 }],
  // ── 혼합 직업 (근접)
  97: [{ fx: "fire/flame-pillar", up: 2, pal: "fire", speed: 1.8, cut: 0.7 }, { fx: "melee/heavy-cleave", aim: true, up: 10, pal: "fire", speed: 1.6 }, { fx: "explosions/small-explosion", at: "tgt", pal: "fire", delay: "flight", cut: 1.3 }],
  99: [{ fx: "spawn/poof", pal: "shadow", cut: 0.8 }, { fx: "shadow/dark-explosion", at: "tgt", speed: 1.5, cut: 3, delay: 200 }, { fx: "shadow/shadow-tendrils", at: "tgt", up: 4, delay: 300, cut: 1.5 }],
  100: [{ fx: "melee/claw-swipe", at: "tgt", up: 10, pal: "blood", speed: 1.6 }, { fx: "explosions/plasma-explosion", at: "tgt", pal: "blood", delay: 150 }, { fx: "shadow/shadow-flames", at: "tgt", pal: "blood", delay: 300, cut: 1.4 }],
  102: [{ fx: "holy/holy-pillar", speed: 1.3, cut: 3 }, { fx: "holy/sunburst", up: 14, pal: "gold", delay: 200, cut: 1.5 }, { fx: "holy/feather-burst", up: 6, speed: 1.4, cut: 2.4, delay: 350 }],
  120: [{ fx: "melee/sword-slash", at: "tgt", up: 12, speed: 1.6 }, { fx: "melee/sword-slash", at: "tgt", up: 12, speed: 1.6, delay: 120, aim: true }, { fx: "impacts/crit-hit", at: "tgt", up: 10, delay: 240, cut: 0.9 }],
  124: [{ fx: "arcane/mana-burst", up: 12, pal: "volt", cut: 0.8 }, { fx: "melee/dagger-flurry", aim: true, up: 10, pal: "volt" }, { fx: "lightning/zap-hit", at: "tgt", up: 10, pal: "volt", delay: "flight" }],
  133: [{ fx: "impacts/shield-block", up: 14, pal: "metal", cut: 0.9 }, { fx: "melee/sword-slash", aim: true, up: 8, pal: "metal" }, { fx: "impacts/blunt-hit", at: "tgt", up: 10, delay: "flight" }],
  134: [{ fx: "holy/sunburst", up: 10, pal: "gold", cut: 1 }, { fx: "holy/feather-burst", up: 6, speed: 1.4, cut: 2.4, delay: 150 }],
};

const hit = (fx, pal) => ({ fx, size: 1, cut: 0.4, up: 8, ...(pal ? { pal } : {}) });
const crit = (pal) => ({ fx: "impacts/crit-hit", crit: true, size: 1, cut: 0.7, up: 12, ...(pal ? { pal } : {}) });
const spark = "impacts/hit-spark", flash = "impacts/hit-flash";
export const HIT = {
  80: [hit(spark), crit()], 81: [hit(spark, "dust")], 83: [hit(spark, "gold"), crit("gold")],
  140: [hit(spark), crit()], 146: [hit(spark)], 153: [hit(flash), crit()], 158: [hit(spark, "metal")], 159: [hit(flash), crit()],
  84: [hit(spark, "shadow"), crit("blood")], 85: [hit(spark, "shadow")], 86: [hit(spark)], 141: [hit(spark, "blood"), crit("blood")], 155: [hit(spark, "metal")],
  87: [hit(spark, "metal"), crit()], 88: [hit(flash, "gold"), crit()], 89: [hit("lightning/zap-hit", "volt"), crit("volt")], 142: [hit(spark)], 147: [hit(spark)],
  130: [hit(flash), crit()], 131: [hit(spark, "earth")], 132: [hit(flash), crit()], 148: [hit(spark, "earth")],
  97: [hit(spark, "fire"), crit("fire")], 99: [hit(spark, "shadow")], 100: [hit(spark, "blood"), crit("blood")],
  120: [hit(spark), crit()], 124: [hit("lightning/zap-hit", "volt")], 133: [hit(flash)],
};

export const PROC = {
  140: [{ fx: "impacts/shield-block", up: 14, cut: 0.8, pal: "gold" }],
  141: [{ fx: "impacts/heavy-landing", cut: 0.8 }],
  142: [{ fx: "impacts/hit-spark", up: 10, pal: "gold", cut: 0.6 }],
  143: [{ fx: "spawn/poof", up: 8, pal: "shadow", cut: 0.7 }],
  144: [{ fx: "impacts/crit-hit", up: 10, pal: "shadow", cut: 0.7 }],
  145: [{ fx: "explosions/small-explosion", up: 8, pal: "blood", cut: 0.7 }],
  146: [{ fx: "impacts/hit-spark", up: 8, pal: "metal", cut: 0.6 }],
  147: [{ fx: "impacts/hit-spark", up: 10, pal: "metal", cut: 0.6 }],
};
