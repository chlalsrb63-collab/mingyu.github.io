/**
 * The shared kit for drawing monsters (see mobart.js): materials, the common
 * flesh palette, and body parts many of them are built from — legs that walk,
 * jaws that open, teeth, ribs. Coordinates are [forward, up, right] in pixels.
 */

export const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/**
 * A material: its base colour and what it is. `role`: body (tinted), keep (eyes,
 * teeth, bone that stays bone), blood (an accent; some tints swap it), glow (never
 * shaded dark). `wet` catches a highlight, `drip` bleeds off its lower edges,
 * `flat` takes only two tones.
 */
export function mat(base, o = {}) {
  return { base: hex(base), role: o.role || "body", wet: !!o.wet, drip: !!o.drip, flat: !!o.flat, r: {} };
}

/** Points along a quadratic curve. */
export function bez(a, c, b, n = 6) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]]);
  }
  return out;
}
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * Where a foot is in its step: [forward swing −1…1, lift 0…1]. `off` shifts the
 * leg in the cycle (0.5 for the opposite pair). Four frames: plant, pass, plant, lift.
 */
export function gait(p, off = 0) {
  if (!p.walk) return [0, 0];
  const ph = (p.ph + off + 1) % 1;
  if (ph < 0.5) return [1 - ph * 4, 0];
  const q = (ph - 0.5) * 2;
  return [-1 + q * 2, Math.sin(q * Math.PI)];
}
/** How far the body rises in a step: up on the passing frames, down a touch on a breath. */
export const bob = (p, k = 1) => (p.walk ? ((Math.round(p.ph * 4)) % 2 === 1 ? k : 0) : p.idle ? -0.45 * k : 0);
/** Wind-up crouches back, the strike throws forward, a flinch rocks back: [forward shift, height shift]. */
export const lunge = (p, k = 1) => (p.wind ? [-1.2 * k, -1 * k] : p.strike ? [2.2 * k, 0.3 * k] : p.hurt ? [-1 * k, 0.4 * k] : [0, 0]);

// ── the flesh palette: the opposite of the adventurers' clean whites
export const C = {
  MEAT: mat("#a83848", { drip: true }), RAW: mat("#c8505a", { drip: true, wet: true }), CLOT: mat("#4a1020"),
  GORE: mat("#d82838", { role: "blood", wet: true, drip: true }), GUT: mat("#d8808c", { wet: true }), GUTD: mat("#b85a6c", { wet: true }),
  BONE: mat("#e8dcc0", { role: "keep" }), BONEB: mat("#e2d4b4"), TOOTH: mat("#f4eedc", { role: "keep", flat: true }),
  MAW: mat("#2a0a14", { role: "keep", flat: true }), TONGUE: mat("#e06a7a", { wet: true }),
  EYEW: mat("#f2ecdc", { role: "keep", wet: true }), BILE: mat("#b4cc3c", { role: "glow" }), STITCH: mat("#3a2630", { role: "keep" }),
  HORN: mat("#d8ccb0"), NAIL: mat("#e8d8c8", { role: "keep" }),
};

/**
 * Four legs under a body. `o`: ff / bf where the front and back legs hang (forward),
 * w half the spread across, hu hip height, r thickness, m material, st stride,
 * li lift, foot (a material for hooves or paws), hock (back legs bend backwards).
 */
export function legs4(M, p, o) {
  const st = o.st ?? 2, li = o.li ?? 1.4, r = o.r ?? 1;
  const L = [[o.ff, -o.w, 0, 1], [o.ff, o.w, 0.5, 1], [o.bf, -o.w, 0.5, 0], [o.bf, o.w, 0, 0]];
  const [lf] = lunge(p);
  for (const [f, s, off, front] of L) {
    let [sw, up] = gait(p, off);
    if (p.wind) sw = front ? 0.6 : -0.6;
    if (p.strike) sw = front ? 1 : -0.4;
    if (p.hurt) sw = front ? -0.4 : 0.3;
    const hu = o.hu - (p.wind ? 1 : 0);
    const top = [f + lf * 0.5, hu, s];
    let foot = [f + sw * st, up * li, s * (o.splay || 1)];
    if (p.dead) foot = [f + (front ? 1.6 : -1.6), o.hu * 0.2, s * 1.2];
    const knee = front
      ? [(top[0] + foot[0]) / 2 + 0.5, hu * 0.48 + up * li * 0.6, s]
      : [(top[0] + foot[0]) / 2 - (o.hock ?? 1.3), hu * 0.4 + up * li * 0.5, s];
    M.tube([top, knee, foot], [r, r * 0.78, r * 0.62], o.m);
    if (o.foot) M.s([foot[0] + 0.2, foot[1] + r * 0.45, foot[2]], r * 0.72, o.foot);
  }
}

/** A row of teeth along a jaw line from `a` to `b`, pointing `dir` (+1 down, −1 up). */
export function teeth(M, a, b, n, dir = 1, len = 1.1, m = C.TOOTH) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    M.cone(q, [q[0] + 0.2, q[1] - dir * len, q[2]], 0.5, m);
  }
}

/** Ribs: bone arcs over the top of a body from `f0` to `f1`, around a centre height `u`, `rr` out. */
export function ribs(M, f0, f1, u, rr, n, m = C.BONEB, open = 1) {
  for (let i = 0; i < n; i++) {
    const f = f0 + ((f1 - f0) * i) / Math.max(1, n - 1);
    const pts = [];
    for (let a = -150; a <= 150; a += 30) { const t = (a * Math.PI) / 180; pts.push([f, u + Math.cos(t) * rr * 0.9, Math.sin(t) * rr * open]); }
    M.tube(pts, 0.5, m);
  }
}

/** A tentacle from `a` waving: `len` long along `dir` [f, u, s], curling by `curl`, `ph` its phase. */
export function tentacle(M, a, dir, len, r, m, ph = 0, curl = 1, n = 7) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = Math.sin(ph * Math.PI * 2 + t * 3.2) * curl * t * 1.6;
    pts.push([a[0] + dir[0] * len * t + w * 0.4, a[1] + dir[1] * len * t + w * 0.5, a[2] + dir[2] * len * t + w]);
  }
  M.tube(pts, [r, r * 0.35], m);
  return pts[pts.length - 1];
}

/** The point on an egg's skin (centre `c`, radii `r`) in direction `d` from its centre. */
export function surf(c, r, d) {
  const k = 1 / Math.sqrt((d[0] / r[0]) ** 2 + (d[1] / r[1]) ** 2 + (d[2] / r[2]) ** 2);
  return [c[0] + d[0] * k, c[1] + d[1] * k, c[2] + d[2] * k];
}
/** Do `fn(sign)` for the left (−1) and right (+1) side. */
export const both = (fn) => { fn(-1); fn(1); };
/** A point turned about the forward axis by `deg` (as an egg's roll is), around `o`. */
export function rollPt(c, deg, o = [0, 0, 0]) {
  const a = (deg * Math.PI) / 180, cr = Math.cos(a), sr = Math.sin(a), u = c[1] - o[1], s = c[2] - o[2];
  return [c[0], o[1] + cr * u - sr * s, o[2] + sr * u + cr * s];
}
/** A point turned about the side axis by `deg` (nose up positive), around `o`. */
export function pitchPt(c, deg, o = [0, 0, 0]) {
  const a = (deg * Math.PI) / 180, cp = Math.cos(a), sp = Math.sin(a), f = c[0] - o[0], u = c[1] - o[1];
  return [o[0] + cp * f - sp * u, o[1] + sp * f + cp * u, c[2]];
}
/** A small hand: a palm at `c` and `n` fingers spread toward `dir`. */
export function hand(M, c, dir, m, n = 4, len = 1.8, curl = 0) {
  M.s(c, 0.95, m);
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 0.5;
    const d = [dir[0] + Math.sin(a) * 0.3, dir[1], dir[2] + Math.sin(a) * 0.9];
    const l = Math.hypot(d[0], d[1], d[2]);
    const tip = [c[0] + (d[0] / l) * len, c[1] + (d[1] / l) * len - curl, c[2] + (d[2] / l) * len];
    M.tube([c, tip], [0.42, 0.34], m);
  }
}
