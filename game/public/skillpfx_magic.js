/**
 * pixelfx layers of the staff, book and bow skills and the caster/ranged hybrids. The engine and the layer fields are
 * documented in skillpfx.js; CAST / PROC as in skillpfx_melee.js.
 */
const spark = (pal, ms = 520, up = 14) => ({ fx: "arcane/spell-charge", on: "wind", up, ms, pal });   // a combo wind-up at the caster

export const CAST = {
  // ── 스태프 (wizard)
  70: [{ fx: "arcane/spell-charge", up: 14, ms: 150, pal: "fire", alpha: 0.65 }],
  71: [{ fx: "ice/snowflake-burst", speed: 2, cut: 0.6, alpha: 0.65 }],
  90: [{ fx: "arcane/spell-charge", up: 14, pal: "fire", ms: 340, alpha: 0.66 }, { fx: "impacts/hit-spark", on: "impact", at: "tgt", up: 2, pal: "fire", speed: 1.7, cut: 0.28 }],
  143: [spark("fire"), { fx: "fire/flame-pillar", at: "tgt", speed: 2, cut: 1.45, alpha: 0.7 }],
  152: [spark("volt", 480), { fx: "lightning/chain-lightning", to: "tgt", aim: true, up: [14, 8], ms: 360, speed: 1.4 },
    { fx: "lightning/zap-hit", at: "tgt", up: 8, delay: "flight", speed: 1.4 }],
  // ── 지팡이 패시브
  113: [{ fx: "arcane/mana-burst", up: 4, speed: 1.4 }, { fx: "arcane/spell-charge", up: 14, ms: 400, pal: "arcane" }],
  // ── 마도서 (warlock)
  91: [{ fx: "arcane/spell-charge", up: 14, ms: 150, pal: "arcane", alpha: 0.6 }],
  92: [{ fx: "arcane/spell-charge", at: "tgt", up: 3, ms: 230, pal: "arcane", alpha: 0.5 }],
  93: [{ fx: "shadow/shadow-tendrils", at: "tgt", speed: 1.6, cut: 0.66, alpha: 0.64 }],
  114: [{ fx: "shadow/hex-sigil", at: "tgt", up: 10, speed: 2.2, cut: 3.4 }, { fx: "shadow/shadow-flames", at: "tgt", up: 4, speed: 1.6, cut: 1.2 }],
  136: [{ fx: "holy/holy-pillar", speed: 1.4, cut: 3 }, { fx: "nature/healing-bloom", speed: 1.5, cut: 2.4 },
    { fx: "holy/feather-burst", up: 8, speed: 1.6, cut: 2.2 }],
  144: [spark("blood"), { fx: "arcane/spell-charge", up: 10, ms: 350, pal: "blood", alpha: 0.56 }],
  // ── 활 (archer)
  94: [{ fx: "lightning/spark-arc", up: 10, pal: "metal", cut: 0.22, speed: 1.4, alpha: 0.65 }],
  95: [{ fx: "spawn/poof", speed: 1.6, cut: 0.5, pal: "dust", alpha: 0.52 }],
  96: [{ fx: "arcane/spell-charge", up: 17, pal: "metal", ms: 290, alpha: 0.64 }],
  145: [spark("gold", 560, 16)],
  149: [spark("ember")],
  150: [spark("bone", 560)],
  151: [spark("dust", 400, 8), { fx: "spawn/poof", speed: 1.7, cut: 0.46, pal: "dust", alpha: 0.54 }],
  154: [spark("leaf", 480, 10), { fx: "nature/root-snare", at: "tgt", speed: 1.6, cut: 2.2 }, { fx: "nature/thorns", at: "tgt", aim: true, speed: 1.6, delay: 150 }],
  115: [{ fx: "holy/sunburst", up: 22, ms: 700, pal: "gold", opts: { size: 0.5 } }],
  // ── 혼합 직업 (마법·사격)
  98: [{ fx: "nature/thorns", at: "tgt", pal: "shadow", speed: 1.6 }, { fx: "shadow/shadow-tendrils", at: "tgt", speed: 1.6, cut: 2.2 }],
  125: [{ fx: "ice/ice-crystal", at: "tgt", up: 5, ms: 380, pal: "ice", alpha: 0.66 }],
  126: [{ fx: "arcane/arcane-orb", at: "tgt", up: 12, ms: 600 }, { fx: "arcane/mana-burst", at: "tgt", up: 4, delay: 500 }],
  128: [{ fx: "arcane/spell-charge", up: 12, ms: 205, pal: "shadow", alpha: 0.62 }],
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
