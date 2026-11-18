/**
 * pixelfx layers for boss attacks (engine and layer fields: skillpfx.js; played by `bossPfx` when a telegraph LANDS, so the
 * red ground marks stay readable while they are pending). Keyed by the boss's element (defs.mobs[k].element: physical bleed
 * fire cold lightning poison dark light) and by the moment; `bossPlan` spreads the effect over the telegraph's shape because
 * pixelfx is drawn from the side (points and columns, no flat rings).
 *   burst = a blast at the spot · col = a tall column/eruption (the big moments) · pal = the element's ramp
 */
const L = (fx, o = {}) => ({ speed: 2.2, alpha: 0.85, ...o, fx });
export const ELEM = {
  physical: { burst: L("explosions/dirt-explosion", { speed: 2.6, cut: 1.3 }), col: L("nature/earth-spike", { speed: 2, cut: 1.7 }), pal: "stone" },
  bleed: { burst: L("explosions/small-explosion", { pal: "blood", cut: 1.7 }), col: L("impacts/crit-hit", { pal: "blood", speed: 1.8 }), pal: "blood" },
  fire: { burst: L("explosions/small-explosion", { cut: 1.7 }), col: L("fire/flame-pillar", { speed: 2, cut: 1.9 }), pal: "fire" },
  cold: { burst: L("ice/snowflake-burst", { speed: 1.8, cut: 1.5 }), col: L("ice/icicle-fall", { speed: 1.8, cut: 1.5 }), pal: "ice" },
  lightning: { burst: L("lightning/zap-hit", { speed: 1.6, up: 6 }), col: L("lightning/lightning-strike", { speed: 1.6 }), pal: "volt" },
  poison: { burst: L("explosions/small-explosion", { pal: "poison", cut: 1.7 }), col: L("nature/thorns", { pal: "poison", speed: 2 }), pal: "poison" },
  dark: { burst: L("shadow/dark-explosion", { speed: 2, cut: 1.6 }), col: L("shadow/grasping-hands", { speed: 2, cut: 1.9 }), pal: "shadow" },
  light: { burst: L("holy/smite", { speed: 1.8, cut: 1.5 }), col: L("holy/holy-pillar", { speed: 1.8, cut: 2 }), pal: "holy" },
};
const BREAK = L("impacts/hit-spark", { pal: "gold", up: 12, speed: 1.4, cut: 0.35 });   // a cast broken: a gold spark
const CHARGE = L("arcane/spell-charge", { up: 18, ms: 450, speed: 1, alpha: 0.6 });      // a cast starts: a glow on the boss
export const LAYERS = [...Object.values(ELEM).flatMap((e) => [e.burst, e.col]), BREAK, CHARGE];

/**
 * Placements [layer, dx, dy] for a moment at (0,0) of radius r: "donut" (inner radius a) 4 blasts on the band, "cone"
 * (aim a, half-angle b, radians) 3 along the axis, "mark" one column, "ring" one column (+3 blasts round it when wide),
 * "cast" the glow on the boss, "broke" the spark, "off" a column on the boss.
 */
export function bossPlan(kind, el, r, a = 0) {
  const e = ELEM[el] || ELEM.physical;
  const ring = (n, d, lay, ph) => Array.from({ length: n }, (_, i) => [lay, Math.cos(ph + (i * Math.PI * 2) / n) * d, Math.sin(ph + (i * Math.PI * 2) / n) * d]);
  switch (kind) {
    case "donut": return ring(4, (r + a) / 2, e.burst, 0.8);
    case "cone": return [0.4, 0.7, 0.95].map((f) => [f > 0.8 ? e.col : e.burst, Math.cos(a) * r * f, Math.sin(a) * r * f]);
    case "mark": case "off": return [[e.col, 0, 0]];
    case "ring": return [[e.col, 0, 0], ...(r > 40 ? ring(3, r * 0.65, e.burst, 0.5) : [])];
    case "cast": return [[{ ...CHARGE, pal: e.pal }, 0, 0]];
    case "broke": return [[BREAK, 0, 0]];
  }
  return [];
}
