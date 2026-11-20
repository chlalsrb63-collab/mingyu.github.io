/**
 * pixelfx layers of the melee skills: sword, dagger, spear, hammer and the melee hybrids. The engine and the layer
 * fields are documented in skillpfx.js. CAST: played when the skill goes off ("a"/"hm" events; `on: "wind"` layers play
 * on a combo skill's wind-up instead).
 * PROC: a weapon passive's proc (skillfx.js PS codes), played where the proc happened.
 */
export const CAST = {
  // ── 대검 (바바리안 / 스펠블레이드)
  80: [{ fx: "impacts/hit-spark", up: 10, cut: 0.22, speed: 1.6, pal: "metal" }, { fx: "melee/sword-slash", aim: true, up: 8, pal: "metal", speed: 2.2, cut: 0.45 }],
  81: [{ fx: "impacts/heavy-landing", at: "tgt", pal: "dust", cut: 0.55, alpha: 0.72 }, { fx: "nature/quake", at: "tgt", pal: "earth", speed: 1.7, cut: 0.65, alpha: 0.68, delay: 90 }],
  83: [{ fx: "melee/heavy-cleave", aim: true, up: 6, pal: "fire", speed: 1.9, cut: 0.9 }, { fx: "fire/flame-pillar", up: 2, pal: "fire", speed: 1.8, cut: 0.85, alpha: 0.85, delay: 110 }],
  97: [{ fx: "fire/flame-pillar", up: 2, pal: "fire", speed: 1.8, cut: 0.5, alpha: 0.68 }, { fx: "melee/heavy-cleave", aim: true, up: 8, pal: "fire", speed: 2.0, cut: 0.75 }, { fx: "lightning/zap-hit", at: "tgt", up: 10, pal: "volt", speed: 1.6, delay: 110 }],
  140: [{ fx: "lightning/spark-arc", on: "wind", up: 14, pal: "metal", cut: 1.2 }, { fx: "melee/heavy-cleave", at: "tgt", up: 10, pal: "metal", speed: 1.9, cut: 0.85 }, { fx: "impacts/crit-hit", at: "tgt", up: 10, delay: 140 }],
  146: [{ fx: "spawn/poof", on: "wind", pal: "dust", cut: 1 }, { fx: "melee/spin-slash", pal: "job", speed: 1.4 }, { fx: "fire/fire-tornado", up: 4, pal: "job", ms: 460, speed: 1.6, alpha: 0.58, delay: 100 }],
  153: [{ fx: "spawn/poof", on: "wind", pal: "dust", cut: 1 }, { fx: "melee/sword-slash", aim: true, up: 8, speed: 1.8 }, { fx: "impacts/blunt-hit", at: "tgt", up: 10, delay: "flight" }],
  158: [{ fx: "impacts/shield-block", on: "wind", up: 14, cut: 1 }, { fx: "impacts/parry", up: 14, pal: "metal" }, { fx: "impacts/ricochet", at: "tgt", up: 12, delay: 120, cut: 1 }],
  159: [{ fx: "holy/sunburst", on: "wind", up: 9, pal: "gold", cut: 0.65, alpha: 0.55 }, { fx: "melee/heavy-cleave", aim: true, up: 8, pal: "gold", speed: 1.9, cut: 0.8 }, { fx: "impacts/ground-slam", at: "tgt", speed: 2.0, cut: 0.5, alpha: 0.66, delay: 80 }],
  // ── 단검 (도적 / 블레이드댄서)
  84: [{ fx: "spawn/poof", pal: "shadow", cut: 0.44, speed: 1.6, alpha: 0.52 }, { fx: "melee/claw-swipe", at: "tgt", up: 10, pal: "arcane", speed: 1.9, cut: 0.45, delay: 70 }],
  85: [{ fx: "lightning/spark-arc", up: 10, pal: "arcane", cut: 0.36, speed: 1.6 }, { fx: "melee/dagger-flurry", aim: true, up: 8, pal: "shadow", speed: 2.2, cut: 0.55 }],
  86: [{ fx: "spawn/poof", pal: "shadow", cut: 0.44, speed: 1.6, alpha: 0.5 }, { fx: "melee/dagger-flurry", aim: true, up: 8, pal: "arcane", speed: 1.7, cut: 1.0, delay: 100 }, { fx: "impacts/crit-hit", at: "tgt", up: 10, pal: "blood", delay: 200 }],
  100: [{ fx: "melee/scythe-reap", at: "tgt", up: 8, pal: "blood", speed: 2.1, cut: 0.85 }, { fx: "shadow/dark-explosion", at: "tgt", up: 6, pal: "blood", speed: 1.8, cut: 0.7, alpha: 0.72, delay: 140 }],
  120: [{ fx: "melee/double-slash", aim: true, at: "tgt", up: 8, pal: "job", speed: 1.9, cut: 0.65 }, { fx: "melee/dagger-flurry", aim: true, at: "tgt", up: 8, pal: "blood", speed: 2.0, cut: 0.65, delay: 110 }],
  141: [{ fx: "shadow/shadow-tendrils", on: "wind", up: 4, pal: "blood", cut: 0.55, speed: 1.6, alpha: 0.55 }, { fx: "melee/scythe-reap", at: "tgt", up: 10, pal: "blood", speed: 2.2, cut: 0.65 }],
  155: [{ fx: "lightning/spark-arc", on: "wind", up: 12, pal: "metal", cut: 1.2 }, { fx: "melee/spin-slash", pal: "metal" }, { fx: "melee/dagger-flurry", up: 8, pal: "metal", delay: 200, cut: 1.4 }],
  157: [{ fx: "spawn/poof", on: "wind", pal: "shadow", cut: 0.48, alpha: 0.46 }, { fx: "explosions/smoke-bomb", at: "tgt", pal: "shadow", speed: 1.5, cut: 1.2, alpha: 0.68 }],
  // ── 창 (창술사 / 마창사)
  87: [{ fx: "impacts/hit-spark", up: 10, pal: "metal", cut: 0.18, speed: 1.5 }, { fx: "melee/thrust", aim: true, up: 8, pal: "metal", speed: 2, cut: 0.45 }],
  88: [{ fx: "impacts/hit-spark", at: "tgt", up: 3, pal: "ember", cut: 0.28, speed: 1.5 }, { fx: "melee/thrust", aim: true, up: 8, pal: "fire", speed: 1.8, cut: 0.55 }],
  89: [{ fx: "lightning/storm-cloud", at: "tgt", up: 28, pal: "volt", ms: 650, alpha: 0.72 }, { fx: "lightning/lightning-strike", at: "tgt", pal: "volt", speed: 1.6, cut: 0.95, delay: 110 }],
  99: [{ fx: "ice/icicle-fall", at: "tgt", up: 14, pal: "ice", speed: 2.0, cut: 0.85 }, { fx: "ice/ice-shatter", at: "tgt", up: 6, pal: "ice", speed: 1.8, cut: 0.75, delay: 100 }, { fx: "lightning/lightning-strike", at: "tgt", pal: "ice", speed: 1.7, cut: 0.8, delay: 60 }],
  135: [{ fx: "holy/sunburst", up: 18, pal: "gold", speed: 1.4, cut: 1.5 }, { fx: "holy/feather-burst", size: 2, speed: 1.4, cut: 2.4, delay: 150 }],
  142: [{ fx: "spawn/poof", on: "wind", pal: "dust", cut: 0.55, alpha: 0.55 }, { fx: "melee/whip-crack", aim: true, up: 10, cut: 0.65, speed: 1.5 }],
  147: [{ fx: "lightning/spark-arc", on: "wind", up: 12, pal: "gold", cut: 1.2 }, { fx: "melee/spear-sweep", aim: true, up: 6, pal: "job" }, { fx: "melee/double-slash", aim: true, up: 10, pal: "job", delay: 100 }],
  // ── 양손해머 (파괴자 / 성기사)
  102: [{ fx: "holy/holy-pillar", pal: "holy", speed: 1.35, cut: 2.4 }, { fx: "holy/heal-aoe", up: 4, pal: "gold", speed: 1.4, cut: 1.8, delay: 120 }, { fx: "holy/sunburst", up: 14, pal: "gold", delay: 220, cut: 1.4 }],
  130: [{ fx: "melee/hammer-smash", at: "tgt", up: 4, pal: "metal", speed: 2.0, cut: 0.55 }, { fx: "impacts/blunt-hit", at: "tgt", up: 8, speed: 1.8, cut: 0.35, delay: 60 }],
  131: [{ fx: "nature/quake", at: "tgt", up: 0, pal: "earth", speed: 1.7, cut: 0.75, alpha: 0.72 }, { fx: "nature/earth-spike", at: "tgt", up: 0, pal: "gold", speed: 1.8, cut: 0.65, alpha: 0.75, delay: 60 }],
  132: [{ fx: "melee/hammer-smash", at: "tgt", up: 6, pal: "gold", speed: 1.8, cut: 0.8 }, { fx: "impacts/ground-slam", at: "tgt", pal: "fire", speed: 1.8, cut: 0.65, alpha: 0.75, delay: 70 }, { fx: "holy/sunburst", at: "tgt", up: 8, pal: "gold", speed: 2, cut: 0.55, alpha: 0.62, opts: { size: 0.65 }, delay: 100 }],
  133: [{ fx: "melee/hammer-smash", at: "tgt", up: 6, pal: "ember", speed: 1.9, cut: 0.75 }, { fx: "impacts/ground-slam", at: "tgt", pal: "ember", speed: 1.8, cut: 0.58, alpha: 0.7, delay: 120 }],
  134: [{ fx: "holy/smite", at: "tgt", up: 6, pal: "gold", speed: 1.7, cut: 0.9 }, { fx: "holy/heal-aoe", up: 4, pal: "holy", speed: 1.5, cut: 1.6, delay: 120 }],
  148: [{ fx: "spawn/poof", on: "wind", pal: "dust", cut: 0.45, alpha: 0.45 }, { fx: "nature/quake", up: 0, pal: "dust", speed: 1.8, cut: 0.65, alpha: 0.68 }],
  // ── JOB-01 melee Lv.30 signatures (스펠블레이드 / 도적)
  160: [{ fx: "holy/holy-pillar", at: "tgt", up: 2, pal: "gold", speed: 1.8, cut: 1.2 }, { fx: "fire/flame-pillar", at: "tgt", up: 2, pal: "fire", speed: 1.9, cut: 0.9, alpha: 0.82, delay: 70 }, { fx: "impacts/ground-slam", at: "tgt", pal: "gold", speed: 1.8, cut: 0.7, delay: 90 }],
  161: [{ fx: "spawn/poof", pal: "shadow", cut: 0.5, speed: 1.8, alpha: 0.58 }, { fx: "melee/double-slash", aim: true, at: "tgt", up: 8, pal: "shadow", speed: 2.1, cut: 0.85 }, { fx: "impacts/crit-hit", at: "tgt", up: 10, pal: "blood", delay: 110 }],
  // ── passive marks on the cast channel & dagger vortex scatter
  110: [{ fx: "holy/sunburst", up: 16, pal: "gold", cut: 0.5, speed: 1.8, alpha: 0.55, opts: { size: 0.5 } }],
  111: [{ fx: "impacts/hit-spark", at: "tgt", up: 8, pal: "blood", speed: 1.8, cut: 0.2 }],
  156: [{ fx: "melee/dagger-flurry", aim: true, up: 8, pal: "metal", speed: 1.8, cut: 1 }],
};

export const PROC = {
  140: [{ fx: "impacts/shield-block", up: 14, cut: 0.8, pal: "gold" }],
  141: [{ fx: "impacts/heavy-landing", cut: 0.8 }],
  142: [{ fx: "impacts/hit-spark", up: 10, pal: "gold", cut: 0.6 }],
  143: [{ fx: "spawn/poof", up: 8, pal: "shadow", cut: 0.7 }],
  144: [{ fx: "impacts/crit-hit", up: 10, pal: "shadow", cut: 0.7 }],
  145: [{ fx: "impacts/hit-spark", up: 8, pal: "blood", speed: 1.6, cut: 0.25 }],
  146: [{ fx: "impacts/hit-spark", up: 8, pal: "metal", cut: 0.6 }],
  147: [{ fx: "impacts/hit-spark", up: 10, pal: "metal", cut: 0.6 }],
};
