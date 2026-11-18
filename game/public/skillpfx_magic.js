/**
 * pixelfx layers of the staff, book and bow skills and the caster/ranged hybrids. The engine and the layer fields are
 * documented in skillpfx.js; CAST / HIT / PROC as in skillpfx_melee.js.
 */
const spark = (pal, ms = 520, up = 14) => ({ fx: "arcane/spell-charge", on: "wind", up, ms, pal });   // a combo wind-up at the caster
const nick = (fx, pal, o = {}) => ({ fx, up: 8, cut: 0.4, speed: 1.6, pal, ...o });                    // a short hit mark

export const CAST = {
  // ── 스태프 (wizard)
  70: [{ fx: "arcane/spell-charge", up: 14, ms: 160, pal: "fire", speed: 2 },
    { fx: "fire/fireball", to: "tgt", up: [16, 6], aim: true, opts: { radius: 6 } },
    { fx: "explosions/small-explosion", at: "tgt", delay: "flight", speed: 2.2, cut: 2.2, opts: { size: 0.7 } }],
  71: [{ fx: "ice/snowflake-burst", speed: 1.6, cut: 2.6 },
    { fx: "ice/ice-crystal", up: 10, ms: 700, pal: "ice", opts: { size: 0.8 } },
    { fx: "ice/icicle-fall", at: "tgt", delay: 150, speed: 1.8, cut: 2 }],
  90: [{ fx: "arcane/mana-burst", up: 6, pal: "fire", speed: 1.8, cut: 1.2 },
    { fx: "fire/meteor", at: "tgt", delay: 150, speed: 1.8, cut: 4.4 },
    { fx: "fire/meteor", at: "tgt", dx: -34, dy: 22, delay: 480, speed: 1.9, cut: 4.4, opts: { seed: 21 } },
    { fx: "fire/meteor", at: "tgt", dx: 30, dy: -18, delay: 860, speed: 2, cut: 4.4, opts: { seed: 33 } }],
  143: [spark("fire"), { fx: "fire/flame-pillar", at: "tgt", speed: 2, cut: 2.6 },
    { fx: "explosions/small-explosion", at: "tgt", delay: 120, speed: 2, cut: 2.6, opts: { size: 0.9 } }],
  152: [spark("volt", 480), { fx: "lightning/chain-lightning", to: "tgt", aim: true, up: [14, 8], ms: 360, speed: 1.4 },
    { fx: "lightning/zap-hit", at: "tgt", up: 8, delay: "flight", speed: 1.4 }],
  // ── 지팡이 패시브
  113: [{ fx: "arcane/mana-burst", up: 4, speed: 1.4 }, { fx: "arcane/spell-charge", up: 14, ms: 400, pal: "arcane" }],
  // ── 마도서 (warlock)
  91: [{ fx: "arcane/spell-charge", up: 14, ms: 160, pal: "arcane", speed: 2 },
    { fx: "projectiles/plasma-shot", to: "tgt", up: [14, 8], aim: true, pal: "arcane" },
    { fx: "arcane/mana-burst", at: "tgt", delay: "flight", speed: 1.6 }],
  92: [{ fx: "shadow/void-orb", at: "tgt", up: 10, ms: 1100 },
    { fx: "explosions/implosion", at: "tgt", up: 8, pal: "shadow", speed: 1.2 },
    { fx: "shadow/shadow-flames", at: "tgt", ms: 1000, pal: "shadow" }],
  93: [{ fx: "shadow/dark-explosion", speed: 1.6, cut: 3 }, { fx: "shadow/grasping-hands", speed: 1.5, cut: 2.2 },
    { fx: "shadow/necro-skulls", up: 14, ms: 900, pal: "shadow" }],
  114: [{ fx: "shadow/hex-sigil", at: "tgt", up: 10, speed: 2.2, cut: 3.4 }, { fx: "shadow/shadow-flames", at: "tgt", up: 4, speed: 1.6, cut: 1.2 }],
  136: [{ fx: "holy/holy-pillar", speed: 1.4, cut: 3 }, { fx: "nature/healing-bloom", speed: 1.5, cut: 2.4 },
    { fx: "holy/feather-burst", up: 8, speed: 1.6, cut: 2.2 }],
  144: [spark("blood"), { fx: "explosions/implosion", at: "tgt", up: 10, pal: "blood", speed: 1.2 },
    { fx: "shadow/void-orb", up: 12, ms: 500, pal: "blood", opts: { size: 0.5 }, delay: 450 }],
  // ── 활 (archer)
  94: [{ fx: "projectiles/arrow", to: "tgt", up: [14, 8], aim: true },
    { fx: "impacts/hit-spark", at: "tgt", up: 8, delay: "flight", size: 2 }],
  95: [{ fx: "spawn/poof", speed: 1.6, cut: 1.2 }, { fx: "projectiles/arrow", to: "tgt", up: [14, 8], aim: true, delay: 120 },
    { fx: "impacts/hit-spark", at: "tgt", up: 8, delay: 300 }],
  96: [{ fx: "arcane/star-fall", at: "tgt", pal: "metal", speed: 1.3 }, { fx: "arcane/star-fall", at: "tgt", dx: 22, dy: -12, delay: 400, pal: "metal", speed: 1.5, opts: { seed: 9 } },
    { fx: "impacts/ricochet", at: "tgt", delay: 700, speed: 1.6, cut: 1 }],
  145: [spark("gold", 560, 16), { fx: "projectiles/bullet-tracer", to: "tgt", up: [16, 8], aim: true, ms: 120, pal: "gold" },
    { fx: "impacts/crit-hit", at: "tgt", up: 8, delay: "flight" }],
  149: [spark("ember"), { fx: "projectiles/cannonball", to: "tgt", up: [20, 4], ms: 380, aim: true },
    { fx: "explosions/small-explosion", at: "tgt", delay: 380, speed: 2, cut: 2.6, opts: { size: 0.8 } }],
  150: [spark("bone", 560), { fx: "arcane/arcane-beam", aim: true, up: 12, ms: 420, pal: "bone" },
    { fx: "impacts/crit-hit", at: "tgt", up: 8, pal: "bone", delay: 150 }],
  151: [spark("dust", 400, 8), { fx: "spawn/poof", speed: 1.6, cut: 1.2 }, { fx: "projectiles/arrow", to: "tgt", up: [12, 8], aim: true, delay: 200 },
    { fx: "impacts/hit-spark", at: "tgt", up: 8, delay: 400 }],
  154: [spark("leaf", 480, 10), { fx: "nature/root-snare", at: "tgt", speed: 1.6, cut: 2.2 }, { fx: "nature/thorns", at: "tgt", aim: true, speed: 1.6, delay: 150 }],
  115: [{ fx: "holy/sunburst", up: 22, ms: 700, pal: "gold", opts: { size: 0.5 } }],
  // ── 혼합 직업 (마법·사격)
  98: [{ fx: "nature/thorns", at: "tgt", pal: "shadow", speed: 1.6 }, { fx: "shadow/shadow-tendrils", at: "tgt", speed: 1.6, cut: 2.2 }],
  125: [{ fx: "ice/ice-lance", to: "tgt", up: [14, 8], aim: true }, { fx: "ice/icicle-fall", at: "tgt", delay: 200, speed: 1.6 }],
  126: [{ fx: "arcane/arcane-orb", at: "tgt", up: 12, ms: 600 }, { fx: "arcane/mana-burst", at: "tgt", up: 4, delay: 500 }],
  128: [{ fx: "projectiles/arrow", to: "tgt", up: [14, 8], aim: true, pal: "shadow" },
    { fx: "impacts/hit-spark", at: "tgt", up: 8, size: 2, pal: "shadow", delay: "flight" }, { fx: "shadow/hex-sigil", at: "tgt", up: 10, speed: 2.4, cut: 2.4, delay: "flight" }],
};

export const HIT = {
  70: [nick("explosions/cartoon-pow", "fire")], 71: [nick("ice/snowflake-burst", "ice", { size: 1 })],
  90: [nick("impacts/hit-spark", "fire", { cut: 0.3 })], 143: [nick("impacts/hit-spark", "fire")],
  152: [nick("lightning/zap-hit", "volt")],
  91: [nick("impacts/hit-spark", "arcane")], 92: [nick("impacts/hit-spark", "shadow", { cut: 0.3 })],
  93: [nick("impacts/hit-spark", "shadow")], 144: [nick("impacts/hit-spark", "blood")],
  94: [nick("impacts/hit-spark")], 95: [nick("impacts/hit-spark", undefined)], 96: [nick("impacts/hit-spark", "metal", { cut: 0.3 })],
  145: [nick("impacts/hit-spark", "gold")], 149: [nick("impacts/hit-spark", "fire")], 150: [nick("impacts/hit-spark", "bone")],
  151: [nick("impacts/hit-spark")], 154: [nick("impacts/hit-spark", "leaf")],
  98: [nick("impacts/hit-spark", "shadow")], 125: [nick("ice/snowflake-burst", "ice")], 126: [nick("impacts/hit-spark", "arcane")], 128: [nick("impacts/hit-spark", "shadow")],
};
for (const k of [70, 143, 91, 94, 95, 145, 149, 150, 151, 128, 152, 144, 93]) HIT[k].push({ ...HIT[k][0], fx: "impacts/crit-hit", crit: true, cut: 0.5, up: 10 });

export const PROC = {
  148: [{ fx: "arcane/mana-burst", at: "tgt", up: 10, speed: 2, cut: 1, pal: "arcane" }],
  149: [{ fx: "arcane/spell-charge", up: 16, ms: 300, pal: "arcane" }],
  150: [{ fx: "arcane/mana-burst", up: 8, speed: 2, cut: 1 }],
  151: [{ fx: "shadow/hex-sigil", up: 10, speed: 3, cut: 2, pal: "shadow" }],
  152: [{ fx: "arcane/spell-charge", up: 16, ms: 300, pal: "shadow" }],
  153: [{ fx: "impacts/hit-spark", up: 8, speed: 1.6, cut: 0.4 }],
  154: [{ fx: "impacts/crit-hit", up: 10, speed: 1.6, cut: 0.5, pal: "gold" }],
};
