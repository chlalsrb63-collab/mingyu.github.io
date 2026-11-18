/**
 * pixelfx layers of the staff, book and bow skills and the caster/ranged hybrids. The engine and the layer fields are
 * documented in skillpfx.js; CAST / HIT / PROC as in skillpfx_melee.js.
 */
export const CAST = {
  // ── 스태프 (wizard)
  70: [{ fx: "fire/fireball", to: "tgt", up: [16, 6], aim: true, opts: { radius: 6 } },
    { fx: "explosions/small-explosion", at: "tgt", delay: "flight", speed: 2.2, cut: 2.2, opts: { size: 0.7 } }],
  71: [{ fx: "ice/snowflake-burst", speed: 1.6, cut: 2.6 }],
  90: [{ fx: "fire/meteor", at: "tgt", speed: 1.8, cut: 4.4 },
    { fx: "fire/meteor", at: "tgt", dx: -34, dy: 22, delay: 380, speed: 1.9, cut: 4.4, opts: { seed: 21 } },
    { fx: "fire/meteor", at: "tgt", dx: 30, dy: -18, delay: 760, speed: 2, cut: 4.4, opts: { seed: 33 } }],
  143: [{ fx: "explosions/small-explosion", at: "tgt", speed: 2, cut: 2.6, opts: { size: 0.9 } }],
  152: [{ fx: "lightning/zap-hit", at: "tgt", up: 8, speed: 1.4 }],
  // ── 지팡이 패시브
  113: [{ fx: "arcane/mana-burst", up: 4, speed: 1.4 }],
  // ── 마도서 (warlock)
  91: [{ fx: "projectiles/plasma-shot", to: "tgt", up: [14, 8], aim: true, pal: "arcane" },
    { fx: "arcane/mana-burst", at: "tgt", delay: "flight", speed: 1.6 }],
  92: [{ fx: "shadow/void-orb", at: "tgt", up: 10, ms: 1100 }],
  93: [{ fx: "shadow/dark-explosion", speed: 1.6, cut: 3 }],
  114: [{ fx: "shadow/hex-sigil", at: "tgt", up: 10, speed: 2.2, cut: 3.4 }],
  136: [{ fx: "holy/holy-pillar", speed: 1.4, cut: 3 }],
  144: [{ fx: "shadow/void-orb", at: "tgt", up: 10, ms: 700, pal: "blood" }],
  // ── 활 (archer)
  94: [{ fx: "impacts/hit-spark", at: "tgt", up: 8, size: 2 }],
  95: [{ fx: "spawn/poof" }],
  96: [{ fx: "arcane/star-fall", at: "tgt", pal: "metal", speed: 1.3 }],
  145: [{ fx: "impacts/crit-hit", at: "tgt", up: 8 }],
  149: [{ fx: "explosions/small-explosion", at: "tgt", delay: 260, speed: 2, cut: 2.6, opts: { size: 0.8 } }],
  150: [{ fx: "arcane/arcane-beam", aim: true, up: 12, ms: 420, pal: "bone" }],
  151: [{ fx: "spawn/poof" }],
  154: [{ fx: "nature/thorns", at: "tgt", aim: true, speed: 1.6 }],
  // ── 혼합 직업 (마법·사격)
  98: [{ fx: "nature/thorns", at: "tgt", speed: 1.6 }],
  125: [{ fx: "ice/icicle-fall", at: "tgt", speed: 1.6 }],
  126: [{ fx: "arcane/mana-burst", at: "tgt", up: 4 }],
  128: [{ fx: "impacts/hit-spark", at: "tgt", up: 8, size: 2, pal: "shadow" }],
};

export const HIT = {};

export const PROC = {};
