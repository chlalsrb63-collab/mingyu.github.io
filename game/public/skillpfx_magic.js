/**
 * pixelfx layers of the staff, book and bow skills and the caster/ranged hybrids. The engine and the layer fields are
 * documented in skillpfx.js; CAST / PROC as in skillpfx_melee.js.
 */
const spark = (pal, ms = 520, up = 14) => ({ fx: "arcane/spell-charge", on: "wind", up, ms, pal });   // a combo wind-up at the caster

export const CAST = {
  // ── 스태프 (마법사 / 트릭스터)
  70: [{ fx: "fire/fireball", to: "tgt", aim: true, up: [12, 8], pal: "fire", speed: 1.5 }, { fx: "explosions/small-explosion", at: "tgt", up: 4, pal: "fire", speed: 1.7, cut: 0.55, alpha: 0.78, delay: "flight" }],
  71: [{ fx: "ice/frost-nova", speed: 2.0, cut: 0.85, alpha: 0.7 }, { fx: "ice/snowflake-burst", speed: 2, cut: 0.65, alpha: 0.68 }],
  90: [{ fx: "arcane/spell-charge", up: 14, pal: "fire", ms: 340, alpha: 0.66 }, { fx: "fire/meteor", on: "impact", at: "tgt", up: 12, pal: "fire", speed: 2.0, cut: 0.8 }, { fx: "explosions/big-explosion", on: "impact", at: "tgt", up: 4, pal: "fire", speed: 1.9, cut: 0.65, alpha: 0.78, delay: 90 }],
  124: [{ fx: "arcane/mana-burst", up: 12, pal: "job", cut: 0.75 }, { fx: "arcane/arcane-missiles", aim: true, up: 10, pal: "job", speed: 1.9, cut: 0.85 }, { fx: "lightning/zap-hit", at: "tgt", up: 10, pal: "volt", delay: "flight" }],
  143: [spark("fire"), { fx: "fire/flame-pillar", at: "tgt", speed: 2, cut: 1.45, alpha: 0.72 }, { fx: "explosions/big-explosion", at: "tgt", up: 4, pal: "fire", speed: 1.8, cut: 0.6, alpha: 0.74, delay: 360 }],
  152: [spark("volt", 480), { fx: "lightning/chain-lightning", to: "tgt", aim: true, up: [14, 8], ms: 360, speed: 1.4 },
    { fx: "lightning/zap-hit", at: "tgt", up: 8, delay: "flight", speed: 1.4 }],
  // ── 스태프 패시브
  113: [{ fx: "arcane/mana-burst", up: 4, speed: 1.4 }, { fx: "arcane/spell-charge", up: 14, ms: 400, pal: "arcane" }],
  // ── 마도서 (마도사 / 룬브레이커)
  91: [{ fx: "shadow/void-orb", to: "tgt", aim: true, up: [12, 8], pal: "arcane", speed: 1.6 }, { fx: "impacts/hit-spark", at: "tgt", up: 8, pal: "arcane", speed: 1.7, cut: 0.28, delay: "flight" }],
  92: [{ fx: "shadow/black-hole", at: "tgt", up: 6, pal: "arcane", ms: 900, speed: 1.5, alpha: 0.72 }, { fx: "explosions/implosion", at: "tgt", up: 6, pal: "arcane", speed: 1.5, cut: 1.1, alpha: 0.62 }],
  93: [{ fx: "shadow/necro-skulls", at: "tgt", up: 10, pal: "arcane", speed: 1.7, cut: 0.85 }, { fx: "shadow/dark-explosion", at: "tgt", up: 4, pal: "shadow", speed: 1.6, cut: 0.7, alpha: 0.7, delay: 140 }],
  114: [{ fx: "shadow/hex-sigil", at: "tgt", up: 10, speed: 2.2, cut: 3.4 }, { fx: "shadow/shadow-flames", at: "tgt", up: 4, speed: 1.6, cut: 1.2 }],
  126: [{ fx: "arcane/rune-circle", at: "tgt", up: 2, pal: "job", ms: 900, speed: 1.5, alpha: 0.72 }, { fx: "arcane/mana-burst", at: "tgt", up: 6, pal: "job", delay: 320 }],
  128: [{ fx: "arcane/magic-circle-cast", up: 10, pal: "job", speed: 1.9, cut: 0.65 }, { fx: "arcane/arcane-missiles", aim: true, up: 10, pal: "job", speed: 2.0, cut: 0.75 }, { fx: "shadow/hex-sigil", at: "tgt", up: 8, pal: "job", speed: 2.2, cut: 0.9, delay: "flight" }],
  136: [{ fx: "holy/holy-pillar", speed: 1.4, cut: 3 }, { fx: "nature/healing-bloom", speed: 1.5, cut: 2.4 },
    { fx: "holy/feather-burst", up: 8, speed: 1.6, cut: 2.2 }],
  144: [spark("blood"), { fx: "shadow/soul-drain", at: "tgt", up: 8, pal: "blood", speed: 1.6, cut: 1.2, alpha: 0.72 }],
  // ── 활 (헌터 / 추적자)
  94: [{ fx: "projectiles/arrow", to: "tgt", aim: true, up: [10, 8], pal: "metal", speed: 1.8 }, { fx: "impacts/hit-spark", at: "tgt", up: 8, pal: "metal", speed: 1.8, cut: 0.22, delay: "flight" }],
  95: [{ fx: "spawn/poof", speed: 1.6, cut: 0.5, pal: "dust", alpha: 0.52 }, { fx: "projectiles/arrow", to: "tgt", aim: true, up: [10, 8], pal: "gold", speed: 1.8 }],
  96: [{ fx: "arcane/spell-charge", up: 17, pal: "metal", ms: 290, alpha: 0.64 }, { fx: "projectiles/arrow", at: "tgt", up: 16, pal: "gold", ms: 420, speed: 1.8, delay: 120 }],
  98: [{ fx: "nature/poison-cloud", at: "tgt", up: 4, pal: "poison", speed: 1.5, cut: 1.1, alpha: 0.68 }, { fx: "nature/thorns", at: "tgt", pal: "shadow", speed: 1.6 }],
  145: [spark("gold", 560, 16), { fx: "projectiles/bullet-tracer", to: "tgt", aim: true, up: [10, 8], pal: "gold", speed: 2.0 }, { fx: "impacts/crit-hit", at: "tgt", up: 8, pal: "gold", speed: 1.8, cut: 0.55, delay: "flight" }],
  149: [spark("ember"), { fx: "explosions/small-explosion", at: "tgt", up: 4, pal: "ember", speed: 1.7, cut: 0.55, alpha: 0.78, delay: 500 }],
  150: [spark("bone", 560), { fx: "projectiles/bullet-tracer", to: "tgt", aim: true, up: [10, 8], pal: "bone", speed: 2.0 }, { fx: "impacts/crit-hit", at: "tgt", up: 8, pal: "bone", speed: 1.6, cut: 0.55, delay: "flight" }],
  151: [spark("dust", 400, 8), { fx: "spawn/poof", speed: 1.7, cut: 0.46, pal: "dust", alpha: 0.54 }, { fx: "projectiles/arrow", to: "tgt", aim: true, up: [10, 8], pal: "gold", speed: 1.8 }],
  154: [spark("leaf", 480, 10), { fx: "nature/root-snare", at: "tgt", speed: 1.6, cut: 2.2 }, { fx: "nature/thorns", at: "tgt", aim: true, speed: 1.6, delay: 150 }],
  115: [{ fx: "holy/sunburst", up: 22, ms: 700, pal: "gold", opts: { size: 0.5 } }],
  // ── 마창사 빙결창
  125: [{ fx: "ice/ice-lance", to: "tgt", aim: true, up: [10, 8], pal: "ice", speed: 1.8 }, { fx: "ice/ice-spikes", at: "tgt", up: 2, pal: "ice", speed: 1.9, cut: 0.85, alpha: 0.76, delay: "flight" }],
  // ── JOB-01 caster/ranged Lv.30 signatures (마법사 / 트릭스터 / 마도사 / 헌터 / 추적자)
  162: [{ fx: "arcane/rune-circle", at: "tgt", up: 2, pal: "volt", ms: 900, speed: 1.6, alpha: 0.78 }, { fx: "fire/flame-pillar", at: "tgt", up: 4, pal: "fire", speed: 1.9, cut: 0.85 }, { fx: "lightning/lightning-strike", at: "tgt", pal: "volt", speed: 1.8, cut: 0.9, delay: 140 }],
  163: [{ fx: "arcane/mana-burst", up: 10, pal: "arcane", cut: 0.85 }, { fx: "lightning/spark-arc", up: 12, pal: "volt", speed: 1.9, cut: 0.75, delay: 70 }],
  164: [{ fx: "melee/scythe-reap", up: 8, pal: "shadow", speed: 1.9, cut: 0.95 }, { fx: "shadow/dark-explosion", up: 4, pal: "poison", speed: 1.7, cut: 0.8, alpha: 0.76, delay: 110 }],
  165: [{ fx: "holy/sunburst", up: 14, pal: "gold", cut: 0.55, speed: 1.9, alpha: 0.55 }, { fx: "projectiles/arrow", to: "tgt", aim: true, up: [10, 8], pal: "ice", speed: 2.1 }],
  166: [{ fx: "nature/poison-cloud", at: "tgt", up: 4, pal: "poison", speed: 1.6, cut: 1.2, alpha: 0.75 }, { fx: "nature/thorns", at: "tgt", pal: "blood", speed: 1.8, delay: 90 }],
};

export const PROC = {
  148: [{ fx: "arcane/mana-burst", at: "tgt", up: 10, speed: 2, cut: 1, pal: "arcane" }],
  149: [{ fx: "arcane/spell-charge", up: 16, ms: 300, pal: "arcane" }],
  150: [{ fx: "arcane/mana-burst", up: 8, speed: 2, cut: 1 }],
  151: [{ fx: "shadow/hex-sigil", up: 10, speed: 3, cut: 2, pal: "shadow" }],
  152: [{ fx: "arcane/spell-charge", up: 16, ms: 300, pal: "shadow" }],
  153: [{ fx: "impacts/hit-spark", up: 8, speed: 1.6, cut: 0.4 }],
  154: [{ fx: "impacts/crit-hit", up: 10, speed: 1.6, cut: 0.5, pal: "gold" }],
};
