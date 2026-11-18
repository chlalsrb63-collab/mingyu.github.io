/**
 * pixelfx layers of the melee skills: sword, dagger, spear, hammer and the melee hybrids. The engine and the layer
 * fields are documented in skillpfx.js. CAST: played when the skill goes off ("a"/"hm" events; `on: "wind"` layers play
 * on a combo skill's wind-up instead). HIT: played on every monster my own skill strikes (`crit: true` = only on a crit).
 * PROC: a weapon passive's proc (skillfx.js PS codes), played where the proc happened.
 */
export const CAST = {
  // ── 대검 (swordsman)
  80: [{ fx: "melee/heavy-cleave", aim: true, up: 10, speed: 1.6 }],
  81: [{ fx: "nature/quake", aim: true, speed: 2, cut: 2.4 }],
  83: [{ fx: "holy/smite", at: "tgt", speed: 1.6, cut: 2.4 }],
  140: [{ fx: "impacts/crit-hit", at: "tgt", up: 10 }],
  146: [{ fx: "melee/spin-slash" }],
  153: [{ fx: "impacts/blunt-hit", at: "tgt", up: 10 }],
  158: [{ fx: "impacts/parry", up: 14 }],
  159: [{ fx: "impacts/ground-slam", at: "tgt", speed: 1.6, cut: 2.4 }],
  // ── 단검 (thief)
  84: [{ fx: "melee/double-slash", at: "tgt", up: 8 }],
  85: [{ fx: "melee/dagger-flurry", aim: true, up: 10 }],
  86: [{ fx: "melee/dagger-flurry", at: "tgt", up: 8 }],
  141: [{ fx: "impacts/crit-hit", at: "tgt", up: 8, pal: "blood" }],
  155: [{ fx: "melee/spin-slash", pal: "metal" }],
  157: [{ fx: "spawn/poof", at: "tgt", size: 2 }],
  // ── 창 (lancer)
  87: [{ fx: "melee/thrust", aim: true, up: 10 }],
  88: [{ fx: "impacts/ground-slam", speed: 1.8, cut: 2.4 }],
  89: [{ fx: "explosions/plasma-explosion", at: "tgt", pal: "volt" }],
  135: [{ fx: "holy/feather-burst", size: 2, speed: 1.4, cut: 2.4 }],
  142: [{ fx: "melee/whip-crack", aim: true, up: 10, size: 2 }],
  147: [{ fx: "melee/spear-sweep", aim: true, up: 6 }],
  // ── 해머 (destroyer)
  130: [{ fx: "melee/hammer-smash", at: "tgt", speed: 1.5 }],
  131: [{ fx: "nature/earth-spike", at: "tgt", speed: 1.8, cut: 2.6 }],
  132: [{ fx: "impacts/ground-slam", at: "tgt", speed: 1.6, cut: 2.6 }],
  148: [{ fx: "impacts/ground-slam", speed: 1.6, cut: 2.4 }],
  // ── 혼합 직업 (근접)
  97: [{ fx: "melee/heavy-cleave", aim: true, up: 10, pal: "fire", speed: 1.6 }],
  99: [{ fx: "shadow/dark-explosion", at: "tgt", speed: 1.5, cut: 3 }],
  100: [{ fx: "explosions/plasma-explosion", at: "tgt", pal: "blood" }],
  102: [{ fx: "holy/holy-pillar", speed: 1.3, cut: 3 }],
  120: [{ fx: "melee/double-slash", at: "tgt", up: 8 }],
  124: [{ fx: "melee/dagger-flurry", aim: true, up: 10, pal: "volt" }],
  133: [{ fx: "impacts/blunt-hit", up: 10 }],
  134: [{ fx: "holy/feather-burst", up: 6, speed: 1.4, cut: 2.4 }],
};

export const HIT = {};

export const PROC = {};
