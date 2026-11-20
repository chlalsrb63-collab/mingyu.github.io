/**
 * Monsters for the quarter view: every creature is built from a handful of
 * solid shapes (balls, eggs and swept tubes) in its own little 3D space, then
 * rasterised straight to pixels from the same angle the world is seen at —
 * 30° down, turned 45° — with a fixed light from the upper left. So one model
 * gives four facings (front-left, front-right, back-left, back-right) that all
 * share the light, and a pose is just the model built with its legs somewhere
 * else.
 *
 * The raster is pixel art, not a render: every shape gets a four-step colour
 * ramp (lit, base, shadow, deep; shadows lean violet, lights lean yellow),
 * lone pixels are cleaned away, overlapping parts get a dark contact line, the
 * whole silhouette a one-pixel outline, and the small things that carry a
 * face — eyes, teeth, stitches — are placed as hand-picked pixels on top.
 *
 * Frames (FR): two breaths, four steps, a wind-up, a strike and recovery, a flinch and three
 * of falling over. Sheets are drawn the first time a frame is asked for and kept.
 *
 * The creatures themselves live in mobart_*.js; this file is the renderer, the
 * tints, and how a monster is drawn in the scene (facing, poses, aura, death).
 */

import { hex } from "./mobart_kit.js";
import { BEASTS_A } from "./mobart_a.js";
import { BEASTS_B } from "./mobart_b.js";
import { BEASTS_C } from "./mobart_c.js";
import { BEASTS_D } from "./mobart_d.js";
import { BEASTS_E } from "./mobart_e.js";
import { BEASTS_F } from "./mobart_f.js";
import { BEASTS_G } from "./mobart_g.js";
import { RIFT_BEAST_ART } from "./mobart_rift_beasts.js";
import { RIFT_BOSS_ART } from "./mobart_rift_bosses.js";
import { BOSSES2_ADD_ART } from "./mobart_bosses2_adds.js";
import { NAMED_ART } from "./mobart_named.js";
import { INKLAKE_ART } from "./mobart_inklake.js";
import { JAEMAEI_ART } from "./mobart_jaemaei.js";

const INK = [0x1b, 0x13, 0x24];
const mixRgb = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const ELEV = Math.PI / 6, CE = Math.cos(ELEV), SE = Math.sin(ELEV);
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** World (x right, y up, z toward the viewer) → view (screen x, screen y down, depth away). */
const toV = (x, y, z) => [x, -y * CE + z * SE, -y * SE - z * CE];
const LV = norm(toV(...norm([-0.62, 0.72, 0.42])));
const HV = norm([LV[0], LV[1], LV[2] - 1]);

// ───────────────────────────── colours ─────────────────────────────

function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, c = mx - mn;
  if (!c) return [0, 0, l];
  const h = mx === r ? ((g - b) / c + 6) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return [h * 60, c / (1 - Math.abs(2 * l - 1)), l];
}
function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
/** Move hue `a` a fraction `t` of the way round the wheel to `b`, the short way. */
const turn = (a, b, t) => { const d = ((b - a + 540) % 360) - 180; return a + d * t; };
/** Four steps from one base colour: lit (toward yellow), base, shadow and deep (toward violet). */
function ramp4(rgb) {
  const [h, s, l] = toHsl(rgb);
  const grey = s < 0.12;
  return [
    fromHsl(grey ? turn(h, 50, 0.34) : turn(h, 50, 0.16), grey ? s + 0.08 : Math.min(1, s * 1.06 + 0.05), Math.min(0.96, l + 0.16 + (1 - l) * 0.09)),
    rgb,
    fromHsl(turn(h, 266, grey ? 0.62 : 0.22), grey ? 0.18 : Math.min(1, s * 0.96 + 0.03), Math.max(0.05, l - 0.16 - l * 0.06)),
    fromHsl(turn(h, 274, grey ? 0.72 : 0.36), grey ? 0.22 : Math.min(1, s * 0.94 + 0.04), Math.max(0.03, l * 0.48 - 0.04)),
  ];
}
/**
 * Tints: the same creature in another skin, for elites and harder ground. A tint
 * rebuilds each body colour's ramp around a new hue; eyes, teeth, bone that is
 * meant to be bone and blood (unless the tint has its own accent) stay as drawn.
 */
const TINT = {
  fire: { hi: 18, lo: 2, sat: 0.9, l: (l) => l * 0.7 + 0.14, accent: "#ffe27a" },
  poison: { hi: 100, lo: 290, sat: 0.58, l: (l) => l * 0.9 + 0.06 },
  frost: { hi: 200, lo: 218, sat: 0.46, l: (l) => l * 0.55 + 0.3, rim: "#eaf6ff" },
  steel: { hi: 212, lo: 226, sat: 0.14, l: (l) => l * 0.62 + 0.16, rim: "#c8d2e0" },
  blood: { hi: 352, lo: 340, sat: 0.72, l: (l) => l * 0.7 + 0.08, accent: "#ff9a8a" },
  bile: { hi: 76, lo: 100, sat: 0.66, l: (l) => l * 0.84 + 0.1 },
  ash: { hi: 262, lo: 262, sat: 0.06, l: (l) => l * 0.5 + 0.16 },
  bone: { hi: 42, lo: 30, sat: 0.24, l: (l) => l * 0.42 + 0.48 },
  gold: { hi: 48, lo: 36, sat: 0.72, l: (l) => l * 0.66 + 0.26 },
};
export const MOB_TINTS = Object.keys(TINT);
function tintRgb(rgb, T) {
  const [h, s, l] = toHsl(rgb);
  const dark = l < 0.36;
  return fromHsl(turn(h, dark ? T.lo : T.hi, 0.86), Math.min(1, T.sat * (0.6 + 0.5 * Math.min(1, s))), Math.max(0.08, Math.min(0.92, T.l(l))));
}

// Reflected ground light on hide, bark and shell. Keep teeth, eyes and wound accents legible.
const GROUND_LIGHT = {
  meadow: "#e1c179", forest: "#72975c", crypt: "#9480ac", city: "#98a4b6",
  sewer: "#8c9952", cave: "#8486bb", abyss: "#b35b68", autumn: "#da9757",
  coast: "#73b9af", desert: "#e0b279", jungle: "#69a368", mist: "#abb7ce",
  mesa: "#cd855b", frostkeep: "#a4cadb", inklake: "#848dab", jianmen: "#8ba078",
};
const reflected = Object.fromEntries(Object.entries(GROUND_LIGHT).map(([region, color]) => [region, hex(color)]));
function habitatOf(map) {
  if (map?.id === "frostkeep" || map?.id === "inklake") return map.id;
  return Object.hasOwn(reflected, map?.theme) ? map.theme : "";
}
function rampOf(m, tint, habitat) {
  const key = (tint || "") + "/" + habitat;
  if (m.r[key]) return m.r[key];
  const T = TINT[tint];
  let r;
  if (!T || m.role === "keep" || m.role === "glow") r = ramp4(m.base);
  else if (m.role === "blood") r = T.accent ? ramp4(hex(T.accent)) : ramp4(m.base);
  else { r = ramp4(tintRgb(m.base, T)); if (T.rim) r[0] = hex(T.rim); }
  if (m.role === "glow") r = [r[0], r[0], r[1], r[2]];
  if (habitat && m.role === "body") {
    const light = reflected[habitat];
    const mix = (rgb, amount) => rgb.map((channel, i) => Math.round(channel + (light[i] - channel) * amount));
    r = [mix(r[0], 0.18), mix(r[1], 0.11), mix(r[2], 0.24), r[3]];
  }
  return (m.r[key] = r);
}

// ───────────────────────────── the model ─────────────────────────────

/**
 * What a creature function builds into. Coordinates are [f, u, s]: forward (the
 * way it faces), up, and to its right, in pixels at normal size; the ground is u = 0.
 */
class Model {
  constructor() { this.P = []; this.D = []; this.n = 0; this.grp = null; this.sdfK = 0; this.names = {}; }
  /** Parts drawn inside one group get no contact lines between them. Passing `{ smooth }` enables 3D SDF smooth-union blending for the group. G() ends the group. */
  G(name, o) {
    this.grp = name ? (this.names[name] ??= ++this.n + 100000) : null;
    this.sdfK = name && o?.smooth ? o.smooth : 0;
    return this;
  }
  gid() { return this.grp ?? ++this.n; }
  /** A ball. */
  s(c, r, m) { this.P.push({ k: 0, c, r, m, g: this.gid(), sdf: this.sdfK }); return this; }
  /** An egg with radii [f, u, s], turned by [yaw, pitch, roll] degrees. */
  e(c, r, m, rot) { this.P.push({ k: 1, c, r, m, rot, g: this.gid(), sdf: this.sdfK }); return this; }
  /** A box with half-sizes [f, u, s], turned like an egg. */
  box(c, r, m, rot) { this.P.push({ k: 2, c, r, m, rot, g: this.gid(), sdf: this.sdfK }); return this; }
  /** Carve a smooth 3D hollow (sphere if r is number, ellipsoid if [f,u,s]) inside the current `{ smooth }` SDF group. */
  sub(c, r, rot) {
    const isArr = Array.isArray(r);
    this.P.push({ k: isArr ? 1 : 0, c, r, m: null, rot, g: this.gid(), sdf: this.sdfK || 1.5, sub: true });
    return this;
  }
  /** A tube through `pts`, its radius a number, [from, to], or one per point. */
  tube(pts, r, m) {
    const g = this.gid(), sdf = this.sdfK;
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    const tot = L[L.length - 1] || 1;
    const rad = (i, k) => (typeof r === "number" ? r : r.length === 2 && pts.length !== 2 ? r[0] + (r[1] - r[0]) * ((L[i] + k * (L[i + 1] - L[i])) / tot) : r[i] + (r[Math.min(i + 1, r.length - 1)] - r[i]) * k);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = L[i + 1] - L[i], n = Math.max(1, Math.ceil(len / (sdf ? 0.9 : 0.45)));
      for (let j = 0; j <= n; j++) {
        if (j === n && i < pts.length - 2) continue;
        const k = j / n;
        this.P.push({ k: 0, c: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k], r: Math.max(0.01, rad(i, k)), m, g, sdf });
      }
    }
    return this;
  }
  /** A spike from `a` to `b`, `r` thick at the root. */
  cone(a, b, r, m) { return this.tube([a, b], [r, 0.3], m); }
  /** Pixels set by hand: one dot, or w×h. */
  dot(c, col, w = 1, h = 1) { this.D.push({ k: "dot", c, col: hex(col), w, h }); return this; }
  /** An eye on a surface: size 1 (a red dot), 2 (2×2) or 3 (3×3); `iris` its colour. Closed when the creature is dead. */
  eye(c, size = 2, iris = "#e02838", o = {}) { this.D.push({ k: "eye", c, n: size, iris: hex(iris), shut: !!o.shut, white: hex(o.white || "#f4efe0") }); return this; }
  /** A slit-pupilled eye painted on the side of ball `c` (radius r) that faces the viewer, whichever way the body turns. */
  stare(c, r, iris = "#e8b020", n = 3) { this.D.push({ k: "slit", c, r, n, iris: hex(iris) }); return this; }
  /** A row of stitches along a line on the skin. */
  seam(pts, col = "#2a1a22") {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 1.6));
      for (let j = 0; j < n; j++) { const k = j / n; this.D.push({ k: "dot", c: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k], col: hex(col), w: 1, h: 1 }); }
    }
    return this;
  }
}

// ───────────────────────────── poses ─────────────────────────────

/** The frames every monster has. */
export const FR = { idle0: 0, idle1: 1, walk0: 2, walk1: 3, walk2: 4, walk3: 5, wind: 6, strike: 7, hurt: 8, die0: 9, die1: 10, die2: 11, recover: 12 };
const NFR = Object.keys(FR).length;
function pose(fr) {
  const p = { fr, walk: false, ph: 0, idle: 0, wind: 0, strike: 0, hurt: 0, dead: 0, recover: 0, turn: 0, t: fr };
  if (fr === 1) p.idle = 1;
  else if (fr >= 2 && fr <= 5) { p.walk = true; p.ph = (fr - 2) / 4; }
  else if (fr === 6) p.wind = 1;
  else if (fr === 7) p.strike = 1;
  else if (fr === 8) p.hurt = 1;
  else if (fr === FR.recover) { p.recover = 1; p.turn = 9; }
  else if (fr >= 9) p.dead = [0.35, 0.75, 1][fr - 9];
  return p;
}
// ───────────────────────────── the raster ─────────────────────────────

const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const app = (A, v) => [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]];
function inv(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1e-9;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
const D2R = Math.PI / 180;
/** Rotation in the model's own axes: yaw about up, pitch about the side (nose up), roll about forward. */
function rotM([y = 0, p = 0, r = 0]) {
  const cy = Math.cos(y * D2R), sy = Math.sin(y * D2R), cp = Math.cos(p * D2R), sp = Math.sin(p * D2R), cr = Math.cos(r * D2R), sr = Math.sin(r * D2R);
  const Ry = [[cy, 0, -sy], [0, 1, 0], [sy, 0, cy]];
  const Rp = [[cp, -sp, 0], [sp, cp, 0], [0, 0, 1]];
  const Rr = [[1, 0, 0], [0, cr, -sr], [0, sr, cr]];
  return mul(mul(Ry, Rp), Rr);
}
const V = [[1, 0, 0], [0, -CE, SE], [0, -SE, -CE]];
/** Facings: front-left, front-right, back-left, back-right (as the world turns on screen). */
const YAW = [135, 45, 225, 315];

/**
 * Rasterise one pose of a model. `N` the canvas, foot at (N/2, N − pad),
 * `dir` a facing, `k` a size factor, `tint` one of MOB_TINTS or "".
 */
function raster(model, N, foot, dir, k, tint, p, rollK = 1, habitat = "", glowHex = null) {
  // The shoulder follows through after contact before the feet turn again.
  const phi = (YAW[dir] + p.turn) * D2R, F = [Math.cos(phi), 0, Math.sin(phi)], R = [-F[2], 0, F[0]];
  const B = [[F[0], 0, R[0]], [0, 1, 0], [F[2], 0, R[2]]];
  const roll = p.dead * 88 * rollK * D2R, cr = Math.cos(roll), sr = Math.sin(roll);
  const Mr = [[1, 0, 0], [0, cr, -sr], [0, sr, cr]];
  const Mw = mul(B, Mr).map((row) => row.map((v) => v * k));
  // lying down: lift the body so its lowest point rests on the ground
  let lift = 0;
  if (p.dead) {
    let lo = 1e9;
    for (const q of model.P) {
      if (q.sub) continue;
      const w = app(Mw, q.c);
      if (q.k === 0) lo = Math.min(lo, w[1] - q.r * k);
      else if (q.k === 2) { const A = mul(Mw, mul(rotM(q.rot || []), [[q.r[0], 0, 0], [0, q.r[1], 0], [0, 0, q.r[2]]])); lo = Math.min(lo, w[1] - Math.abs(A[1][0]) - Math.abs(A[1][1]) - Math.abs(A[1][2])); }
      else { const A = mul(Mw, mul(rotM(q.rot || []), [[q.r[0], 0, 0], [0, q.r[1], 0], [0, 0, q.r[2]]])); lo = Math.min(lo, w[1] - Math.hypot(A[1][0], A[1][1], A[1][2])); }
    }
    lift = -lo;
  }
  const Vm = mul(V, Mw);
  const ox = foot[0], oy = foot[1] - lift * CE, oz = -lift * SE;
  const NN = N * N;
  const zb = new Float32Array(NN).fill(1e9), mi = new Int16Array(NN).fill(-1), gi = new Int32Array(NN), bd = new Uint8Array(NN), spc = new Uint8Array(NN);
  const mats = [], midx = new Map();
  const matId = (m) => { let i = midx.get(m); if (i === undefined) { i = mats.length; mats.push(m); midx.set(m, i); } return i; };
  const put = (i, z, n, q) => {
    zb[i] = z; mi[i] = matId(q.m); gi[i] = q.g;
    const I = n[0] * LV[0] + n[1] * LV[1] + n[2] * LV[2];
    bd[i] = q.m.flat ? (I < -0.5 ? 2 : 1) : I > 0.46 ? 0 : I > -0.04 ? 1 : I > -0.52 ? 2 : 3;
    const spec = n[0] * HV[0] + n[1] * HV[1] + n[2] * HV[2];
    spc[i] = (q.m.wet && spec > 0.94) ? 2 : (!q.m.flat && (q.m.role === "keep" || q.m.role === "glow") && spec > 0.962) ? 1 : 0;
  };
  const sdfGroups = new Map();
  for (const q of model.P) {
    if (q.sdf > 0) {
      let arr = sdfGroups.get(q.g);
      if (!arr) { arr = []; sdfGroups.set(q.g, arr); }
      arr.push(q);
      continue;
    }
    const c = app(Vm, q.c), cx = c[0] + ox, cy = c[1] + oy, cz = c[2] + oz;
    if (q.k === 0) {
      const r = Math.max(0.62, q.r * k), r2 = r * r;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(N - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(N - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const du = x + 0.5 - cx, dv = y + 0.5 - cy, d2 = du * du + dv * dv;
        if (d2 >= r2) continue;
        const h = Math.sqrt(r2 - d2), z = cz - h, i = y * N + x;
        if (z < zb[i]) put(i, z, [du / r, dv / r, -h / r], q);
      }
    } else if (q.k === 2) {
      const A = mul(Vm, mul(rotM(q.rot || []), [[q.r[0], 0, 0], [0, q.r[1], 0], [0, 0, q.r[2]]]));
      const Ai = inv(A), qv = [Ai[0][2], Ai[1][2], Ai[2][2]];
      const ex = Math.abs(A[0][0]) + Math.abs(A[0][1]) + Math.abs(A[0][2]), ey = Math.abs(A[1][0]) + Math.abs(A[1][1]) + Math.abs(A[1][2]);
      const x0 = Math.max(0, Math.floor(cx - ex)), x1 = Math.min(N - 1, Math.ceil(cx + ex)), y0 = Math.max(0, Math.floor(cy - ey)), y1 = Math.min(N - 1, Math.ceil(cy + ey));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const o = [x + 0.5 - cx, y + 0.5 - cy, -cz];
        let lo = -1e9, hi = 1e9, ax = 0, sg = 1;
        for (let a = 0; a < 3 && lo <= hi; a++) {
          const pa = Ai[a][0] * o[0] + Ai[a][1] * o[1] + Ai[a][2] * o[2], qa = qv[a];
          if (Math.abs(qa) < 1e-9) { if (Math.abs(pa) > 1) lo = 1e9; continue; }
          let t0 = (-1 - pa) / qa, t1 = (1 - pa) / qa, s0 = -1;
          if (t0 > t1) { const tt = t0; t0 = t1; t1 = tt; s0 = 1; }
          if (t0 > lo) { lo = t0; ax = a; sg = s0; }
          if (t1 < hi) hi = t1;
        }
        if (lo > hi) continue;
        const i = y * N + x;
        if (lo >= zb[i]) continue;
        put(i, lo, norm([Ai[ax][0] * sg, Ai[ax][1] * sg, Ai[ax][2] * sg]), q);
      }
    } else {
      const A = mul(Vm, mul(rotM(q.rot || []), [[q.r[0], 0, 0], [0, q.r[1], 0], [0, 0, q.r[2]]]));
      const Ai = inv(A), qv = [Ai[0][2], Ai[1][2], Ai[2][2]], qq = qv[0] * qv[0] + qv[1] * qv[1] + qv[2] * qv[2];
      const ex = Math.hypot(A[0][0], A[0][1], A[0][2]), ey = Math.hypot(A[1][0], A[1][1], A[1][2]);
      const x0 = Math.max(0, Math.floor(cx - ex)), x1 = Math.min(N - 1, Math.ceil(cx + ex)), y0 = Math.max(0, Math.floor(cy - ey)), y1 = Math.min(N - 1, Math.ceil(cy + ey));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const o = [x + 0.5 - cx, y + 0.5 - cy, -cz];
        const pv = [Ai[0][0] * o[0] + Ai[0][1] * o[1] + Ai[0][2] * o[2], Ai[1][0] * o[0] + Ai[1][1] * o[1] + Ai[1][2] * o[2], Ai[2][0] * o[0] + Ai[2][1] * o[1] + Ai[2][2] * o[2]];
        const pq = pv[0] * qv[0] + pv[1] * qv[1] + pv[2] * qv[2], pp = pv[0] * pv[0] + pv[1] * pv[1] + pv[2] * pv[2];
        const disc = pq * pq - qq * (pp - 1);
        if (disc <= 0) continue;
        const t = (-pq - Math.sqrt(disc)) / qq, i = y * N + x;
        if (t >= zb[i]) continue;
        const s = [pv[0] + t * qv[0], pv[1] + t * qv[1], pv[2] + t * qv[2]];
        const n = norm([Ai[0][0] * s[0] + Ai[1][0] * s[1] + Ai[2][0] * s[2], Ai[0][1] * s[0] + Ai[1][1] * s[1] + Ai[2][1] * s[2], Ai[0][2] * s[0] + Ai[1][2] * s[1] + Ai[2][2] * s[2]]);
        put(i, t, n, q);
      }
    }
  }
  // 3D SDF smooth-union (smin) & smooth-subtract groups: organic muscles, torsos, faces, and carved hollows
  for (const [, list] of sdfGroups) {
    const sm = Math.max(0.4, (list[0].sdf || 1.5) * k);
    const pos = [], subs = [];
    let gx0 = N, gy0 = N, gx1 = 0, gy1 = 0, zMin = 1e9, zMax = -1e9;
    for (const q of list) {
      const c = app(Vm, q.c), cx = c[0] + ox, cy = c[1] + oy, cz = c[2] + oz;
      let item, ex, ey, ez;
      if (q.k === 0) {
        const r = Math.max(0.62, q.r * k);
        item = { k: 0, cx, cy, cz, r, q };
        ex = ey = ez = r;
      } else {
        const A = mul(Vm, mul(rotM(q.rot || []), [[q.r[0], 0, 0], [0, q.r[1], 0], [0, 0, q.r[2]]]));
        const Ai = inv(A);
        const minR = Math.max(0.5, Math.min(q.r[0], q.r[1], q.r[2]) * k);
        item = { k: q.k, cx, cy, cz, Ai, minR, q };
        if (q.k === 2) {
          ex = Math.abs(A[0][0]) + Math.abs(A[0][1]) + Math.abs(A[0][2]);
          ey = Math.abs(A[1][0]) + Math.abs(A[1][1]) + Math.abs(A[1][2]);
          ez = Math.abs(A[2][0]) + Math.abs(A[2][1]) + Math.abs(A[2][2]);
        } else {
          ex = Math.hypot(A[0][0], A[0][1], A[0][2]);
          ey = Math.hypot(A[1][0], A[1][1], A[1][2]);
          ez = Math.hypot(A[2][0], A[2][1], A[2][2]);
        }
      }
      if (q.sub) subs.push(item);
      else {
        pos.push(item);
        gx0 = Math.min(gx0, Math.floor(cx - ex - sm * 0.5));
        gx1 = Math.max(gx1, Math.ceil(cx + ex + sm * 0.5));
        gy0 = Math.min(gy0, Math.floor(cy - ey - sm * 0.5));
        gy1 = Math.max(gy1, Math.ceil(cy + ey + sm * 0.5));
        zMin = Math.min(zMin, cz - ez - sm * 0.5);
        zMax = Math.max(zMax, cz + ez + sm * 0.5);
      }
    }
    if (!pos.length) continue;
    gx0 = Math.max(0, gx0); gy0 = Math.max(0, gy0); gx1 = Math.min(N - 1, gx1); gy1 = Math.min(N - 1, gy1);
    const primD = (it, px, py, pz) => {
      const dx = px - it.cx, dy = py - it.cy, dz = pz - it.cz;
      if (it.k === 0) return Math.hypot(dx, dy, dz) - it.r;
      const Ai = it.Ai;
      const lx = Ai[0][0] * dx + Ai[0][1] * dy + Ai[0][2] * dz;
      const ly = Ai[1][0] * dx + Ai[1][1] * dy + Ai[1][2] * dz;
      const lz = Ai[2][0] * dx + Ai[2][1] * dy + Ai[2][2] * dz;
      if (it.k === 2) {
        const bx = Math.abs(lx) - 1, by = Math.abs(ly) - 1, bz = Math.abs(lz) - 1;
        return (Math.hypot(Math.max(bx, 0), Math.max(by, 0), Math.max(bz, 0)) + Math.min(Math.max(bx, by, bz), 0)) * it.minR;
      }
      return (Math.hypot(lx, ly, lz) - 1) * it.minR;
    };
    const evalD = (px, py, pz) => {
      let d = 1e9;
      for (let u = 0; u < pos.length; u++) {
        const dp = primD(pos[u], px, py, pz);
        if (u === 0) d = dp;
        else {
          const h = Math.max(sm - Math.abs(d - dp), 0) / sm;
          d = Math.min(d, dp) - h * h * sm * 0.25;
        }
      }
      const smSub = sm * 0.65;
      for (let u = 0; u < subs.length; u++) {
        const dn = -primD(subs[u], px, py, pz);
        const h = Math.max(smSub - Math.abs(d - dn), 0) / smSub;
        d = Math.max(d, dn) + h * h * smSub * 0.25;
      }
      return d;
    };
    for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
      const i = y * N + x;
      if (zMin >= zb[i]) continue;
      const px = x + 0.5, py = y + 0.5;
      const zEnd = Math.min(zMax + 1.5, zb[i]);
      let z = zMin - 1.5, hit = false;
      for (let st = 0; st < 28 && z < zEnd; st++) {
        const d = evalD(px, py, z);
        if (d < 0.08) { hit = true; break; }
        z += Math.max(0.28, d * 0.85);
      }
      if (!hit || z >= zb[i]) continue;
      const eps = 0.28;
      const nx = evalD(px + eps, py, z) - evalD(px - eps, py, z);
      const ny = evalD(px, py + eps, z) - evalD(px, py - eps, z);
      const nz = evalD(px, py, z + eps) - evalD(px, py, z - eps);
      let bestQ = pos[0].q, bestD = 1e9;
      for (let u = 0; u < pos.length; u++) {
        const dp = primD(pos[u], px, py, z);
        if (dp < bestD) { bestD = dp; bestQ = pos[u].q; }
      }
      put(i, z, norm([nx, ny, nz]), bestQ);
    }
  }
  // clean lone pixels: a band that none of its neighbours share takes theirs
  const nb = [-1, 1, -N, N];
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      if (mi[i] < 0) continue;
      let same = 0, cnt = [0, 0, 0, 0], tot = 0;
      for (const d of nb) { const j = i + d; if (mi[j] === mi[i] && gi[j] === gi[i]) { tot++; cnt[bd[j]]++; if (bd[j] === bd[i]) same++; } }
      if (!same && tot >= 3) { let b = 0; for (let k2 = 1; k2 < 4; k2++) if (cnt[k2] > cnt[b]) b = k2; bd[i] = b; }
    }
  }
  // depth-based crevice AO: pixels tucked behind neighboring geometry drop one shadow band
  const aoThr = 0.9 * Math.max(1, k * 0.8), aoDiag = 0.72 * Math.max(1, k * 0.8);
  const nb8 = [-1, 1, -N, N, -N - 1, -N + 1, N - 1, N + 1];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x;
    if (mi[i] < 0 || mats[mi[i]].role === "glow") continue;
    let card = 0, near = 0;
    for (let u = 0; u < 4; u++) { const j = i + nb[u]; if (mi[j] >= 0 && zb[j] < zb[i] - aoThr) card++; }
    for (let u = 0; u < 8; u++) { const j = i + nb8[u]; if (mi[j] >= 0 && zb[j] < zb[i] - aoDiag) near++; }
    if ((card >= 2 || near >= 4) && bd[i] < 3) bd[i]++;
  }
  // contact lines: where one part passes in front of another, the one behind gets a dark edge
  const line = new Uint8Array(NN), thr = 2.6 * Math.max(1, k * 0.8);
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x;
    if (mi[i] < 0) continue;
    for (const d of nb) { const j = i + d; if (mi[j] >= 0 && gi[j] !== gi[i] && zb[j] < zb[i] - thr) { line[i] = 1; break; } }
  }
  const img = new ImageData(N, N), D = img.data;
  const ramps = mats.map((m) => rampOf(m, tint, habitat));
  const rimCol = glowHex ? mixRgb(hex(glowHex), [245, 240, 255], 0.35) : (habitat && reflected[habitat] ? mixRgb(reflected[habitat], [250, 246, 232], 0.45) : [232, 224, 242]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (mi[i] < 0) continue;
    const m = mats[mi[i]], rm = ramps[mi[i]];
    let c = line[i] ? (bd[i] >= 2 ? INK : rm[3]) : rm[bd[i]];
    // crisp specular glint on wet surfaces and subtle edge sheen on bone/masks
    if (spc[i] && !line[i]) {
      const add = spc[i] === 2 ? 54 : 30;
      c = [Math.min(255, rm[0][0] + add), Math.min(255, rm[0][1] + add), Math.min(255, rm[0][2] + Math.round(add * 0.92))];
    }
    // 1px top/left silhouette rim light so dark hides & armor pop cleanly in 3D
    if (!line[i] && !spc[i] && m.role !== "glow" && bd[i] <= 2) {
      const topEmpty = y === 0 || mi[i - N] < 0;
      const leftEmpty = x === 0 || mi[i - 1] < 0;
      if (topEmpty || (leftEmpty && bd[i] <= 1)) {
        const lum = (c[0] * 3 + c[1] * 6 + c[2]) / 2550;
        const amt = topEmpty ? (lum < 0.35 ? 0.30 : 0.16) : (lum < 0.35 ? 0.22 : 0.12);
        c = mixRgb(c, rimCol, amt);
      }
    }
    // 1px emissive glow bounce from adjacent glow parts onto neighboring body pixels
    if (m.role !== "glow" && x > 0 && x < N - 1 && y > 0 && y < N - 1) {
      for (const d of nb) {
        const j = i + d;
        if (mi[j] >= 0 && mats[mi[j]].role === "glow") {
          c = mixRgb(c, ramps[mi[j]][0], 0.28);
          break;
        }
      }
    }
    D[i * 4] = c[0]; D[i * 4 + 1] = c[1]; D[i * 4 + 2] = c[2]; D[i * 4 + 3] = 255;
  }
  const set = (x, y, c) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const i = (y * N + x) * 4; D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255; };
  // hand-placed pixels: shown only where their spot on the skin faces us
  const fwd = Vm[0][0];                                       // which way the face points on screen
  for (const d of model.D) {
    const c = app(Vm, d.c), x = Math.floor(c[0] + ox), y = Math.floor(c[1] + oy), z = c[2] + oz - (d.k === "slit" ? d.r * k : 0);
    if (x < 0 || y < 0 || x >= N || y >= N) continue;
    const i = y * N + x;
    if (mi[i] < 0 || zb[i] < z - 1.6 * Math.max(1, k)) continue;
    if (d.k === "dot") { for (let a = 0; a < d.w; a++) for (let b = 0; b < d.h; b++) set(x + a, y + b, d.col); continue; }
    if (d.k === "slit") {
      const n = Math.round(d.n * Math.max(1, k * 0.8)), h0 = Math.floor(n / 2);
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (!((a === 0 || a === n - 1) && (b === 0 || b === n - 1))) set(x + a - h0, y + b - h0, d.iris);
      if (p.dead > 0.5 || p.hurt) { for (let a = 0; a < n; a++) set(x + a - h0, y, INK); continue; }
      for (let b = 0; b < n; b++) set(x + (fwd < 0 ? -1 : 0) + (p.wind ? 0 : 0), y + b - h0, INK);
      continue;
    }
    const n = Math.max(1, Math.round(d.n * (k > 1.3 ? 1.5 : 1)));
    const shut = d.shut || p.dead > 0.5 || (p.hurt && n > 1);
    if (shut) { for (let a = 0; a < Math.max(2, n); a++) set(x + a - (n > 2 ? 1 : 0), y, INK); continue; }
    if (n === 1) { set(x, y, d.iris); continue; }
    const s = fwd < 0 ? 0 : n - 1;                              // the iris sits on the side it looks
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) set(x + a - (n > 2 ? 1 : 0), y + b - (n > 2 ? 1 : 0), d.white);
    if (n === 2) set(x + s, y + 1, d.iris);
    else { const ix = x - 1 + (fwd < 0 ? 0 : 1); set(ix, y, d.iris); set(ix + 1, y, d.iris); set(ix, y + 1, d.iris); set(ix + 1, y + 1, INK); }
  }
  // sel-out coloured silhouette outline: lit upper edges take a dark material tone, shadow/bottom edges take deep INK
  const solid = new Uint8Array(NN);
  for (let i = 0; i < NN; i++) solid[i] = D[i * 4 + 3] ? 1 : 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (solid[i]) continue;
    let pick = -1, bestBd = 9, isGlow = false;
    const check = (j) => {
      if (!solid[j]) return;
      if (mi[j] >= 0) {
        if (mats[mi[j]].role === "glow") { pick = j; isGlow = true; return; }
        if (!isGlow && bd[j] < bestBd) { bestBd = bd[j]; pick = j; }
      } else if (pick < 0) pick = j;
    };
    if (x > 0) check(i - 1);
    if (x < N - 1) check(i + 1);
    if (y > 0) check(i - N);
    if (y < N - 1) check(i + N);
    if (pick < 0) continue;
    if (isGlow) set(x, y, mixRgb(ramps[mi[pick]][1], INK, 0.56));
    else if (mi[pick] >= 0 && bestBd === 0) set(x, y, mixRgb(ramps[mi[pick]][3], INK, 0.44));
    else set(x, y, INK);
  }
  // blood runs off the lower edges of anything raw, a little longer each frame
  const B1 = [0x8a, 0x10, 0x22], B2 = [0xd8, 0x24, 0x34];
  for (let x = 0; x < N; x++) for (let y = N - 2; y > 0; y--) {
    const i = y * N + x;
    if (mi[i] < 0 || !mats[mi[i]].drip || mi[i + N] >= 0 || y > foot[1] - 4 * k) continue;
    const h = ((x * 73 + y * 151 + dir * 7) % 97) / 97;
    if (h > 0.34) continue;
    const len = p.dead ? 0 : ((Math.floor(h * 40) + p.t) % 4);
    for (let a = 1; a <= len; a++) set(x, y + a, a === len ? B2 : B1);
  }
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  cv.getContext("2d").putImageData(img, 0, 0);
  return cv;
}

// ───────────────────────────── the cast ─────────────────────────────

const BEASTS = { ...BEASTS_A, ...BEASTS_B, ...BEASTS_C, ...BEASTS_D, ...BEASTS_E, ...BEASTS_F, ...BEASTS_G, ...RIFT_BEAST_ART, ...RIFT_BOSS_ART, ...BOSSES2_ADD_ART, ...NAMED_ART, ...INKLAKE_ART, ...JAEMAEI_ART };
/** Names from earlier rosters, so a stale server still draws something sensible. */
const ALIAS = {
  acorn: "twinhare", potcrab: "gutfrog", puff: "eyecrow", capfrog: "gutfrog", stump: "ribdeer", lantern: "mothface", yarn: "spiderhand",
  eyecam: "pigeonmass", signbot: "doghead", vend: "fishwalker", tvhead: "catsplit", candle: "batcluster", geode: "bearmaw", prism: "owlstare",
  slime: "twinhare", bslime: "gutfrog", shroom: "gutfrog", boar: "splitboar", bat: "batcluster", drone: "pigeonmass", thug: "catsplit", robot: "doghead", skel: "bonehound", golem: "bearmaw",
};
export const has = (kind) => !!BEASTS[ALIAS[kind] || kind];
/** Canvas size by size class; the foot sits this far above the bottom. */
const CANVAS = { s: 44, m: 54, l: 68, xl: 84, boss: 150 };
const PAD = 8;
/** Everything is built a third bigger than its model's pixel numbers: the cast reads at about one and a half adventurers. */
const GK = 1.3;
const rigs = new Map();
const fieldRigs = new Map();
let fieldHabitat = "";
const canvasSize = (def, sc) => Math.ceil((def.n || CANVAS[def.size] || 48) * sc * GK / 2) * 2;

/**
 * One monster's frames, drawn when first asked for. `sc` enlarges it (elites
 * and guardians are drawn bigger, not scaled up, so their pixels stay crisp).
 */
export function rig(kind, tint, sc = 1, habitat = "") {
  if (!Object.hasOwn(reflected, habitat)) habitat = "";
  if (habitat && fieldHabitat !== habitat) { fieldRigs.clear(); fieldHabitat = habitat; }
  const cache = habitat ? fieldRigs : rigs;
  kind = ALIAS[kind] || kind;
  if (!TINT[tint]) tint = "";
  const key = kind + ":" + tint + ":" + sc;
  let R = cache.get(key);
  if (R) return R;
  const def = BEASTS[kind] || BEASTS.chest;
  const N = canvasSize(def, sc), foot = [N / 2, N - Math.round(Math.max(PAD * sc, N * 0.14))];
  const frames = [[], [], [], []];
  R = {
    kind, def, N, foot, sc,
    frame(dir, fr) {
      let c = frames[dir][fr];
      if (!c) {
        const M = new Model();
        const posture = pose(fr);
        def.draw(M, posture);
        c = frames[dir][fr] = raster(M, N, foot, dir, sc * GK * (def.k || 1), tint, posture, def.hover ? 0.25 : 1, habitat, def.glow || null);
      }
      return c;
    },
  };
  cache.set(key, R);
  return R;
}
/** Everything a page needs to know about a kind: size class, hover, glow, how it dies. */
/** For the headless checks (tests/mobart.mjs): the builder, the poses, the cast and how big its canvases are. */
export const _test = { Model, pose, BEASTS, CANVAS, PAD, GK, NFR };

export function info(kind) { const d = BEASTS[ALIAS[kind] || kind]; return d ? { size: d.size, hover: d.hover || 0, glow: d.glow || null, death: d.death || "fall" } : null; }
export const KINDS = () => Object.keys(BEASTS);

/** The front-left idle frame cut to what is drawn, for icons and the collection book. */
const icons = new Map();
export function icon(kind, tint, fr = 0) {
  const key = kind + ":" + (tint || "") + ":" + fr;
  if (icons.has(key)) return icons.get(key);
  const src = rig(kind, tint).frame(0, fr), N = src.width;
  const d = src.getContext("2d").getImageData(0, 0, N, N).data;
  let x0 = N, y0 = N, x1 = 0, y1 = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = Math.max(1, x1 - x0 + 1), h = Math.max(1, y1 - y0 + 1), s = Math.max(w, h);
  const c = document.createElement("canvas");
  c.width = c.height = s;
  c.getContext("2d").drawImage(src, x0, y0, w, h, Math.floor((s - w) / 2), s - h, w, h);
  icons.set(key, c);
  return c;
}

// ───────────────────────────── in the scene ─────────────────────────────
// How a monster moves on screen. The server sends where it is, when it strikes
// ("m"), when it marks a charge ("c", with the wind-up time), a slam or a blast
// ("t") and a spit or volley ("g", "v"); the scene turns those into poses: a
// wind-up held for exactly the telegraph, the strike as the blow lands, a flinch
// when hit, steps counted from the ground it covers, and a fall when it dies.

/** Elites and guardians are drawn bigger. */
const SCALE = [1, 1.15, 1.6];
/** Render boss frames at native resolution around the same ground anchor. */
export const encounterScale = (boss, rank) => boss ? 1.5 : rank === 2 ? 2.16 : SCALE[rank] || 1;
/** The colour of an elite's aura, and a guardian's. */
const AURA = ["", "255,196,64", "255,110,214"];
// Small wings beat quickly. Broad wings and pulsing bells take longer between keyframes.
const BREATH_MS = { s: 330, m: 465, l: 600, xl: 710, boss: 810 };
const WING_MS = { batcluster: 76, frostmoth: 88, brainjelly: 205, wingcrane: 165, ribvulture: 175, inkcrane: 165 };
const nearest = (G, m) => {
  let best = null, bd = 1e9;
  const test = (p) => { if (!p || p.dead) return; const d = (p.x - m.x) ** 2 + (p.y - m.y) ** 2; if (d < bd) { bd = d; best = p; } };
  test(G.me);
  for (const p of G.players.values()) test(p);
  return bd < 160 * 160 ? best : null;
};
/** Which of the four facings shows a screen direction (dx, dy in server units). */
function facing(s, dx, dy) {
  const sx = dx - dy, sy = (dx + dy) / 2;
  if (Math.abs(sx) > 0.02) s.fx = sx > 0 ? 1 : 0;
  if (Math.abs(sy) > 0.02) s.back = sy < 0 ? 1 : 0;
}

/** A scripted boss's look of the moment (net.js `bst` 0 · 1 marked cast · 2 dived, `bph` phase): kind_dive, kind_ch, kind_p2 — each only if drawn. */
export function artKind(kind, m) {
  if (m.el === 2 && BEASTS[kind + "_boss"]) kind += "_boss";
  for (const [on, sfx] of [[m.bst === 2, "_dive"], [m.bst === 1, "_ch"], [m.bph >= 2, "_p2"]]) if (on && BEASTS[kind + sfx]) return kind + sfx;
  return kind;
}
/**
 * Draw monster `m` (its defs entry `d`) standing at iso pixel (X, Y). `s` is the
 * scene's per-monster scratch state, `parts` its particle list, G the game state.
 */
export function draw(g, m, d, tint, s, t, X, Y, parts, G) {
  const el = m.el | 0, boss = d.boss || el === 2;
  const sc = encounterScale(d.boss, el), baseScale = d.boss ? 1 : SCALE[el] || 1;
  const kind = artKind(d.sp, m);
  const habitat = habitatOf(G.map);
  const R = rig(kind, tint, sc, habitat), def = R.def;
  if (s.px === undefined) { s.px = m.x; s.py = m.y; s.fx = (m.id & 1); s.back = 0; s.dist = 0; s.mvT = -1e9; }
  const mx = m.x - s.px, my = m.y - s.py, step = Math.hypot(mx, my);
  if (step > 0.04) { s.mvT = t; s.dist += step; facing(s, mx, my); }
  if (step > 2.6 && !def.hover && !(t - (s.leapT || -1e9) < 320) && !(m.windT && t - m.windT < (m.windMs || 0) + 400)) s.leapT = t;                // a pounce: it covers the ground in a bound
  s.px = m.x; s.py = m.y;
  // a heavy blow holds the struck pose for a hitstop (`hsMs`, set by the client), then plays on
  const h0 = t - m.hurtT, hsz = m.hsMs || 0, h = h0 >= 0 && h0 < hsz ? 0 : h0 - hsz;
  const a = t - m.atkT, w = m.windT ? t - m.windT : 1e9, windMs = m.windMs || 0;
  // turn to whoever it is fighting
  if (w < windMs && m.windAim) facing(s, m.windAim[0], m.windAim[1]);
  else if (a < 450 || w < windMs + 300) { const p = nearest(G, m); if (p) facing(s, p.x - m.x, p.y - m.y); }
  const dir = (s.back ? 2 : 0) + s.fx;
  const moving = t - s.mvT < 200, flyer = !!def.hover;
  let fr, shake = 0, lunge = 0;
  const lp = s.leapT ? t - s.leapT : 1e9;
  if (h < 170 && h >= 0) fr = FR.hurt;
  else if (lp < 200) { fr = FR.strike; lunge = -Math.sin((lp / 200) * Math.PI) * 6 * baseScale; }
  else if (w < windMs) { fr = FR.wind; shake = Math.sin(t / 28) * Math.min(1, w / windMs) * 1.2; }
  else if ((a >= 0 && a < 240) || (w >= windMs && w < windMs + 260)) {
    const melee = a >= 0 && a < 240;
    const progress = melee ? a / 240 : (w - windMs) / 260;
    const hold = def.size === "s" ? 0.42 : boss ? 0.72 : 0.58;
    fr = progress < hold ? FR.strike : FR.recover;
    lunge = Math.sin(progress * Math.PI) * (melee ? 5 : 3) * baseScale;
  }
  else if (flyer) {
    const beat = (WING_MS[kind] || (def.size === "s" ? 100 : 138)) * (moving ? 0.76 : 1);
    fr = FR.walk0 + (Math.floor(t / beat + m.id) % 4);
  }
  else if (moving) fr = FR.walk0 + (Math.floor(s.dist / (2.4 * sc * (def.k || 1) * (def.size === "l" || def.size === "boss" ? 1.4 : 1))) % 4);
  else fr = Math.floor((t + m.id * 137) / BREATH_MS[def.size]) % 2 ? FR.idle1 : FR.idle0;
  const img = R.frame(dir, fr);
  if (!R.h) { R.h = height(img); }
  m._mob = { kind, tint, sc, habitat, dir, death: def.death || "fall", hover: def.hover || 0, col: def.glow };
  // the ground: a shadow, and an elite's ring
  const span = canvasSize(def, baseScale) * (flyer ? 0.16 : 0.24), hover = (def.hover || 0) * sc;
  const shadowSpan = span * Math.sqrt(sc / baseScale);
  g.fillStyle = "rgba(20,24,50,.28)";
  g.beginPath(); g.ellipse(X, Y, shadowSpan, shadowSpan * 0.48, 0, 0, 7); g.fill();
  if (el || d.boss) {
    const pulse = 0.55 + 0.3 * Math.sin(t / 160 + m.id), col = AURA[el] || "255,90,120";
    g.save();
    g.lineWidth = 1;
    g.setLineDash([5, 3]); g.lineDashOffset = -t / 40;
    g.strokeStyle = `rgba(${col},${pulse})`;
    g.beginPath(); g.ellipse(X, Y, span * 1.35, span * 0.65, 0, 0, 7); g.stroke();
    if (el === 2 || d.boss) {
      g.lineDashOffset = t / 30; g.strokeStyle = `rgba(138,232,248,${pulse * 0.8})`;
      g.beginPath(); g.ellipse(X, Y, span * 1.7 + Math.sin(t / 240) * 2, span * 0.82, 0, 0, 7); g.stroke();
    }
    g.restore();
    if (Math.random() < (el === 2 || d.boss ? 0.35 : 0.12)) parts.push({ x: X + (Math.random() - 0.5) * span * 2.2, y: Y - Math.random() * R.h * 0.6, vx: 0, vy: -20 - Math.random() * 10, life: 0.6, color: el === 1 ? "#ffe08a" : Math.random() < 0.5 ? "#ff8ae0" : "#8ae8f8", g: 0, s: 1 });
  }
  // knocked back along the blow, as the blow looks on screen; squashed by it, then springing back
  // through a stretch (a damped wobble: squash, stretch, a smaller squash) over 240 ms
  const hk = h / 240, rec = hk >= 0 && hk < 1 ? (1 - hk) * (1 - hk) : 0, pow = m.hurtP || 1;
  const ha = m.hurtA || 0, hx = Math.cos(ha) - Math.sin(ha), hy = (Math.cos(ha) + Math.sin(ha)) / 2;
  const jx = rec ? hx * rec * 5 * pow : 0, jy = rec ? hy * rec * 5 * pow : 0;
  const lx = lp < 200 ? 0 : lunge * (s.fx ? 1 : -1), ly = lp < 200 ? lunge : lunge * (s.back ? -0.5 : 0.5);
  const fly = hover ? hover + Math.sin(t / 300 + m.id) * 2 : 0;
  g.save();
  g.translate(Math.round(X + lx + jx + shake), Math.round(Y + ly + jy - fly));
  if (rec) { const wob = rec * Math.cos(hk * Math.PI * 3) * pow; g.scale(1 - wob * 0.2, 1 + wob * 0.14); }
  // the first frames of a hit (and a hitstop) are pure white; a bright blink follows
  const white = h >= 0 && h < 36;
  if (!white && h >= 0 && h < 100) g.filter = "brightness(1.8)";
  else if (white) { /* drawn as a silhouette below */ }
  else if (el === 2 || d.boss) { g.shadowColor = d.boss ? "#ff4a8a" : "#ff5ad0"; g.shadowBlur = 8; }
  else if (el) { g.shadowColor = "#ffc040"; g.shadowBlur = 4; }
  g.drawImage(white ? whiteOf(img) : img, -R.foot[0], -R.foot[1]);
  g.restore();
  const labelPad = boss ? Math.min(0, R.foot[1] - R.N + (m.stg ? 31 : 17)) : 0;
  m.h3 = (R.h + fly + labelPad) / 26;
}
/** A frame as a pure white silhouette (the first frames of a hit), cached per frame. */
const whites = new WeakMap();
function whiteOf(img) {
  let c = whites.get(img);
  if (c) return c;
  c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
  whites.set(img, c);
  return c;
}
/** How tall the drawn part of a frame is, in pixels above its foot. */
function height(c) {
  const N = c.width, d = c.getContext("2d").getImageData(0, 0, N, N).data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3]) return N - y;
  return N / 2;
}

/**
 * Server events that change how a monster stands. Call before the client's own
 * handling of the same event; `S3` is the scene (for the corpse it leaves).
 */
export function onEvent(e, G, S3, t) {
  const k = e[0];
  if (k === "c") { const m = G.mobs.get(e[1]); if (m) { m.windT = t; m.windMs = e[6]; m.windAim = [e[4] - e[2], e[5] - e[3]]; } }
  else if (k === "t" && !e[5]) {
    // a slam rings round the monster itself; a blast lands under the players, called by a guardian or a boss
    let hit = null, hd = 1e9;
    for (const m of G.mobs.values()) {
      const dd = (m.x - e[1]) ** 2 + (m.y - e[2]) ** 2, d = G.defs.mobs[m.k];
      if (dd < 16 && dd < hd) { hit = m; hd = dd; }
      else if (!hit && d && (d.boss || m.el === 2) && dd < 240 * 240 && (!m.windT || t - m.windT > 400)) hit = m;
    }
    if (hit && (!hit.windT || t - hit.windT > 200)) { hit.windT = t; hit.windMs = e[4]; hit.windAim = null; }
  } else if (k === "m" || k === "v" || k === "g") {
    const m = G.mobs.get(e[1]);
    if (m && m.windT && t - m.windT < (m.windMs || 0) + 150) m.windT = 0;
  } else if (k === "k") {
    const m = G.mobs.get(e[1]) || G.gone.get(e[1]);
    if (m && m._mob && S3 && S3.props) S3.props.set("mk" + e[1], corpse(m, t));
  }
}

/** What a monster leaves behind for a moment: it falls, bursts or melts where it died. */
function corpse(m, t0) {
  const o = m._mob, R = rig(o.kind, o.tint, o.sc, o.habitat), style = o.death;
  const dur = style === "burst" ? 800 : style === "melt" ? 1300 : 1400;
  const chunks = [];
  if (style === "burst") for (let i = 0; i < 14; i++) chunks.push([Math.cos(i * 2.4) * (30 + (i * 7) % 30), 40 + (i * 13) % 50, i % 3]);
  const hover = o.hover * o.sc;
  return {
    x: m.x, y: m.y, until: t0 + dur,
    draw(g, t, X, Y) {
      const k = t - t0, span = R.N * 0.22;
      // the stain it leaves
      const pool = Math.min(1, k / 450), fade = Math.max(0, Math.min(1, (dur - k) / 400));
      g.globalAlpha = 0.55 * fade;
      g.fillStyle = style === "melt" ? "#4a5a2a" : "#6a0e1e";
      g.beginPath(); g.ellipse(X, Y, span * (0.4 + pool * 0.9), span * (0.2 + pool * 0.45), 0, 0, 7); g.fill();
      g.globalAlpha = 1;
      if (style === "burst") {
        if (k < 110) {
          const img = R.frame(o.dir, FR.hurt), z = 1 + k / 300;
          g.save(); g.translate(Math.round(X), Math.round(Y - hover)); g.scale(z, z); g.filter = "brightness(3)"; g.drawImage(img, -R.foot[0], -R.foot[1]); g.restore();
        }
        const s = k / 1000;
        for (const [vx, vy, c] of chunks) {
          const yy = Math.min(0, -(vy * s - 140 * s * s)) - (hover + R.N * 0.25) * Math.max(0, 1 - s * 3);
          g.fillStyle = ["#6a0e1e", "#d82838", o.col || "#5a3a5a"][c];
          g.globalAlpha = fade;
          g.fillRect(Math.round(X + vx * s), Math.round(Y + yy), 2, 2);
        }
        g.globalAlpha = 1;
        return;
      }
      if (style === "melt") {
        const img = R.frame(o.dir, FR.hurt), q = Math.min(1, k / 900);
        g.save(); g.translate(Math.round(X), Math.round(Y)); g.scale(1 + q * 0.5, Math.max(0.04, 1 - q)); g.drawImage(img, -R.foot[0], -R.foot[1]); g.restore();
        return;
      }
      // fall over: three frames of toppling, a bounce, then a flicker as it goes
      const fr = k < 90 ? FR.die0 : k < 190 ? FR.die1 : FR.die2;
      const lift = hover * Math.max(0, 1 - k / 260) + (k > 190 && k < 290 ? Math.sin(((k - 190) / 100) * Math.PI) * 2 : 0);
      if (k > dur - 450 && Math.floor(k / 70) % 2) return;
      g.save(); g.translate(Math.round(X), Math.round(Y - lift));
      if (k < 70) g.filter = "brightness(2.4)";
      g.drawImage(R.frame(o.dir, fr), -R.foot[0], -R.foot[1]);
      g.restore();
    },
  };
}
