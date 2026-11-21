/**
 * The bow's arrows and the missiles (split from skillfx.js): "ar"/"ae" (plain, piercing, the element and ink arrows of
 * kinds 4–7), their looks and ranges, and the bow's draw and twang (`bowFire`).
 */
import * as S3 from "./scene2d.js";
import { Sound } from "./audio.js";
import { at, px, INK, now, skillNear } from "./skillfx_kit.js";

/** How far each special arrow flies (the server's `len`): 관통 화살, 도약 사격, 삼원소 화살's three, 룬 먹화살. */
export const ARROW_RANGE = { 2: 180, 3: 150, 4: 190, 5: 190, 6: 190, 7: 170 };
/**
 * The dressed arrows (docs/design/jobs-and-stats.md H.4): kind 2 관통 화살, 3 도약 사격, 4 fire, 5 ice, 6 lightning, 7 rune ink.
 * `tier` picks the ink of the white-hot arrow underneath (scene_fx ARROW_HOT: 1 gold, 4 cyan, 5 violet, 6 starlight gold);
 * `tail` is what streams behind it, nearest first; `shaft` repaints the arrow itself (the ink arrow is black).
 */
export const ARROW_LOOK = {
  2: { tier: 4, how: "pierce", tail: ["#ffffff", "#d8fff4", "#5ce6c8", "#24786e"], shaft: "#d8fff4" },
  3: { tier: 1, how: "gale", tail: ["#ffffff", "#fff2a6", "#8ee874", "#328a48"], shaft: "#fff2a6" },
  4: { tier: 1, how: "flame", tail: ["#ffffff", "#ffd84a", "#ff8a3a", "#d83a2a"] },
  5: { tier: 4, how: "frost", tail: ["#ffffff", "#e8f8ff", "#9fe8ff", "#5aa8e0"] },
  6: { tier: 1, how: "spark", tail: ["#ffffff", "#fff27a", "#ffe86a", "#c8a030"] },
  7: { tier: 5, how: "ink", tail: ["#b46aff", "#3a2a58", "#b46aff", "#1a1426"], shaft: "#1a1426" },
};
/** Draw the dress of arrow `f` (scene2d keeps where it is in `f.at`: screen x, y, angle) for this frame. */
export function dressArrow(g, f, look) {
  if (!f || f.gone || !f.at) return;
  const [x, y, a] = f.at, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, n = (f.n = (f.n || 0) + 1);
  const dot = (d, o, w, c) => px(g, x - ux * d + nx * o - (w >> 1), y - uy * d + ny * o - (w >> 1), w, w, c);
  if (look.shaft) {
    // the arrow as long as scene2d drew it (shorter flying toward or away from the eye), its middle inked over
    const L = Math.max(6, Math.round(11 / Math.sqrt(2 * uy * uy + (ux * ux) / 2) / Math.SQRT2));
    for (let q = -L / 2 + 2; q <= L / 2 - 2; q++) px(g, x + ux * q, y + uy * q, 1, 1, look.shaft);
  }
  const T = look.tail;
  if (look.how === "pierce") {
    // Outlined heavy bodkin warhead + swept wind-shear wings + sonic compression ring wake (r=8)
    for (const s of [-1, 1]) {
      dot(-2, s * 2, 3, INK); dot(-2, s * 2, 2, T[1]);
      dot(1, s * 4, 3, INK); dot(1, s * 4, 2, T[2]);
    }
    dot(-5, 0, 3, INK); dot(-5, 0, 2, T[0]);
    for (let i = 0; i < 7; i++) {
      const d = 4 + i * 3;
      const spread = (i % 2 === 0 ? 5 : 3) * (((n + i) % 2) ? 1 : -1);
      dot(d, spread, 3, INK); dot(d, spread, 2, T[Math.min(3, 1 + (i >> 1))]);
      dot(d, 0, 2, T[i < 3 ? 0 : 2]);
    }
  } else if (look.how === "gale") {
    // Outlined emerald-gold feathered head + spiralling leaf-wind trail
    for (const s of [-1, 1]) {
      dot(-2, s * 2, 3, INK); dot(-2, s * 2, 2, T[1]);
    }
    dot(-4, 0, 3, INK); dot(-4, 0, 2, T[0]);
    for (let i = 0; i < 6; i++) {
      const d = 4 + i * 2.6, o = Math.round(Math.sin(i * 1.1 + n * 0.6) * 2.5);
      dot(d, o, 3, INK);
      dot(d, o, 2, T[Math.min(3, 1 + (i >> 1))]);
    }
  } else if (look.how === "flame") {
    // a tongue of fire licking back off the head, flickering, embers lifting off it as it cools
    for (let i = 0; i < 7; i++) {
      const d = 4 + i * 2.2;
      dot(d, ((n + i * 5) % 3) - 1, i < 2 ? 2 : 1, T[Math.min(3, (i + 1) >> 1)]);
      if (i > 3 && (n + i) % 2) px(g, x - ux * d, y - uy * d - 2 - (i - 3), 1, 1, T[2]);
    }
  } else if (look.how === "frost") {
    // a wake of ice crystals either side, and a hard glint on the head
    for (let i = 0; i < 6; i++) dot(4 + i * 3, i % 2 ? 2 : -2, 1, T[1 + Math.min(2, i >> 1)]);
    for (const [d, o] of [[-5, 1], [-5, -1], [-6, 0], [-4, 0]]) dot(d, o, 1, T[(n >> 1) % 2]);
  } else if (look.how === "spark") {
    // a jagged thread of lightning trailing it, re-forked every frame
    let o = 0;
    for (let i = 0; i < 9; i++) { o = Math.max(-2, Math.min(2, o + ((n * 7 + i * 13) % 5) - 2)); dot(3 + i * 2, o, 1, T[i < 3 ? 0 : 1 + (i % 2)]); }
    if (n % 3 === 0) dot(8, o > 0 ? -4 : 4, 1, T[1]);
  } else {
    // drops of ink shed behind, violet rune pixels riding between them
    for (let i = 0; i < 6; i++) dot(5 + i * 3, i % 2 ? 1 : -1, i < 3 ? 2 : 1, i % 2 ? T[0] : T[3]);
    dot(-3 - (n % 2), 0, 1, T[0]);
  }
}
/**
 * The basic attacks' magic missiles (45-jobs.js magicShot): kind 8 the staff's violet bolt with a short
 * sparkling tail, 9 the book's bigger lilac orb. `r` the glow's half-size in px, `hot` its core,
 * `glow` the body, `rim` the dark edge that keeps it readable on bright ground, `tail` nearest first.
 */
export const MISSILE_LOOK = {
  8: { r: 4, hot: "#ffffff", glow: "#c8a8ff", rim: "#5a3aa8", tail: ["#e8dcff", "#b08aff", "#8a5ad8", "#5a3aa8"] },
  9: { r: 6, hot: "#ffffff", glow: "#e0c8ff", rim: "#7a4ac8", tail: ["#e0c8ff", "#c8a0ff", "#a07ae0"] },
};
/** A pixel disc (rows of fillRect, no anti-aliasing) of radius r centred on (x, y). */
function disc(g, x, y, r, c) {
  g.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r + r - dy * dy)); g.fillRect(Math.round(x) - hw, Math.round(y) + dy, hw * 2 + 1, 1); }
}
/** One missile frame: the tail's sparks and motes, then the head (stepped halo, dark rim, body, white-hot core). */
function drawMissile(g, m, L) {
  const T = L.tail, n = m.n, r = L.r, nine = m.kind === 9;
  for (let i = 1; i < m.trail.length; i++) {
    const [tx, ty] = m.trail[i], j = ((n + i * 3) % 3) - 1, c = T[Math.min(T.length - 1, i >> 1)];
    px(g, tx + j * 2, ty - j, 2, 2, c);
    if (i < (nine ? 7 : 6)) px(g, tx - 1, ty - 1, 3, 3, c);
  }
  // loose motes drifting off the path
  for (let k = 0; k < 3; k++) { const i = 3 + k * 3; if (i >= m.trail.length) break; const [tx, ty] = m.trail[i], s = (n + k * 5) % 6 - 3; px(g, tx + s * 2, ty + (k % 2 ? 4 : -4) + s, 1, 1, "#ffffff"); }
  const [x, y] = m.trail[0], pulse = n % 4 < 2 ? 0 : 1;
  g.globalAlpha = 0.22; disc(g, x, y, r + 3, L.glow);
  g.globalAlpha = 0.45; disc(g, x, y, r + 1 + pulse, L.glow);
  g.globalAlpha = 1;
  disc(g, x, y, r, L.rim); disc(g, x, y, r - 1, L.glow); disc(g, x, y, Math.max(1, r >> 1), L.tail[0]); disc(g, x, y, Math.max(1, (r >> 2) + pulse), L.hot);
}
/** Missiles in flight: id → { x, y, ux, uy, spd, kind, home, trail, end }. */
export const missiles = new Map();
/**
 * A magic missile cast at (x0, y0): flies at `spd`, steering at monster `home` (where it is drawn now)
 * while there is one, until the server's "ae" says where it ended (or it gives up after a while).
 * It is drawn again over the night grade (S3.glows) so the dark never swallows it.
 */
export function missile(G, id, x0, y0, ux, uy, spd, kind, home) {
  const L = MISSILE_LOOK[kind], m = { x: x0, y: y0, ux, uy, spd: spd || 300, kind, home, trail: [], end: false, t: 0, n: 0 };
  missiles.set(id, m);
  if (missiles.size > 48) missiles.delete(missiles.keys().next().value);
  const dur = 1600, lit = (g) => { if (m.trail.length) { g.globalCompositeOperation = "screen"; drawMissile(g, m, L); g.globalCompositeOperation = "source-over"; drawMissile(g, m, L); } };
  S3.glows.add(lit);
  S3.fx.spark(x0, y0, "#ffffff", kind === 9 ? 1 : 0.8); S3.fx.ring(x0, y0, kind === 9 ? 12 : 9, L.glow, 160);   // launch flash
  S3.fxCustom((g, k) => {
    if (m.end || k >= 0.99) { S3.glows.delete(lit); if (m.end) return; }
    const t = k * dur, dt = Math.min(60, t - m.t) / 1000;
    m.t = t; m.n++;
    const o = m.home && G.mobs.get(m.home);
    let step = m.spd * dt;
    if (o) {
      const dx = o.x - m.x, dy = o.y - 6 - m.y, d = Math.hypot(dx, dy) || 1;
      m.ux = dx / d; m.uy = dy / d; step = Math.min(step, d);   // (it waits on its monster for the server's word)
    }
    m.x += m.ux * step; m.y += m.uy * step;
    m.trail.unshift(at(m.x, m.y, 9));
    if (m.trail.length > 11) m.trail.pop();
    drawMissile(g, m, L);
  }, dur);
}
/** The server ended missile `id` at (x, y): 0 struck (a burst; `ring` the book's splash or a finisher's), 1 a wall, 2 spent. */
export function missileEnd(f, id, x, y, how, ring) {
  const m = missiles.get(id), L = MISSILE_LOOK[m.kind];
  missiles.delete(id);
  m.end = true;
  if (how === 2) { f.burst(x, y, 0.4, L.tail[1], 3, 0.6); return; }
  f.burst(x, y, 0.4, L.glow, m.kind === 9 ? 14 : 9, 1.8);
  f.burst(x, y, 0.4, "#ffffff", 5, 1.1);
  f.spark(x, y, "#ffffff", m.kind === 9 ? 1.4 : 1.1);
  f.ring(x, y, m.kind === 9 ? 16 : 11, L.tail[1], 240);
  // the flash itself shines over the night grade for a moment: stepped discs shrinking away
  const t0 = now(), [hx, hy] = at(x, y, 9), R = m.kind === 9 ? 12 : 9;
  const flash = (g) => {
    const k = (now() - t0) / 260;
    if (k >= 1) { S3.glows.delete(flash); return; }
    const r = Math.round(R * (1 - k * 0.5));
    g.globalCompositeOperation = "screen"; g.globalAlpha = 0.5; disc(g, hx, hy, r + 3, L.glow);
    g.globalAlpha = 0.9; disc(g, hx, hy, r, L.glow); g.globalAlpha = 1; disc(g, hx, hy, r >> 1, "#ffffff");
    g.globalCompositeOperation = "source-over";
  };
  S3.glows.add(flash);
  if (ring) { f.ring(x, y, ring, "#ffffff", 260, true); f.ring(x, y, ring * 0.7, "#c8a0ff", 300, true, 40); }
  Sound.play("magic_hit", m.kind === 9 || ring > 0);
}
// ── the bow's shot: client.js attackFx calls bowFire for fx code 6 (the "a" event of a bow's basic
// attack); the bow skills call it too. The arrow itself comes on its own ("ar", above): it is held on
// the string until the stroke's release (swing.js IMPACT) and still lands on time.
/** Bows drawn in the last moments, waiting for their arrows: { eid, x, y, t, at (release time), wt (tier) }. */
export const bowShots = [];
/** Where each arrow in flight started, and its range: id → [x0, y0, range]. */
export const arrowFrom = new Map();
/**
 * A bow drawn (fx code 6): remember the shooter for the arrow that follows, creak the bow now and
 * twang it at the release. `beat` 2 is the finisher; `up` the skyward skill shot (src.bowUp, the pose).
 */
export function bowFire(G, src, beat = 0, up = false) {
  const t = now(), eid = src === G.me ? G.you : src.id, w = G.who && G.who.get(eid);
  const left = Math.max(0, (src.atkT ?? t) + S3.impactMs("bow", beat) - t);
  src.bowUp = !!up;
  bowShots.push({ eid, x: src.x, y: src.y, t, at: t + left, wt: (w && w.gear && w.gear.wt) || 1 });
  if (bowShots.length > 24) bowShots.shift();
  if (src === G.me || skillNear(G, src.x, src.y)) {
    Sound.play("bow_draw");
    setTimeout(() => Sound.play("bow_shot", beat === 2 || up), left);
  }
}
