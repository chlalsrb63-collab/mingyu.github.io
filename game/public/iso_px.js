/**
 * Pixel tools for the quarter-view art (isotiles.js): colours as packed 32-bit
 * pixels, small buffers written pixel by pixel, and the one projection every
 * piece shares.
 *
 * The projection. A tile is 16×16 "texels" on the ground; texel (A, B) of the
 * world (A = 16·x + a, B = 16·y + b) is screen pixel (A − B, ⌊(A + B) / 2⌋)
 * measured from tile (0, 0)'s top corner. That is one pixel per texel, both
 * ways, so every line along the grid is a clean 2:1 stair and the diamonds
 * interlock with no seams and no overlap: each tile owns exactly 256 pixels,
 * three wide at the top corner, thirty-one across, one at the bottom.
 */

export const TW = 32, TH = 16;

export const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Smooth value noise on a lattice of `cell` units, 0…1. */
export function vnoise(x, y, cell, s = 0) {
  const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
}

// ───────────────────────────── colour ─────────────────────────────

const CC = new Map();
/** "#rrggbb" → a packed pixel (little-endian RGBA, opaque), as a signed 32-bit integer. */
export function C(hex) {
  let v = CC.get(hex);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    // kept as a signed 32-bit value: opaque colours then fit V8's small integers and never box
    v = (255 << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255);
    CC.set(hex, v);
  }
  return v;
}
export function hexOf(u) {
  const r = u & 255, g = (u >> 8) & 255, b = (u >> 16) & 255;
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** Scale toward black (f < 1) or toward white (f > 1). */
export function mix(hex, f) {
  const [r, g, b] = rgb(hex);
  const ch = (v) => (f < 1 ? v * f : v + (255 - v) * (f - 1));
  return toHex(ch(r), ch(g), ch(b));
}
/** `t` of the way from `a` to `b`. */
export function tone(a, b, t) {
  const p = rgb(a), q = rgb(b);
  return toHex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
}
/** A shadow: darker and leaning toward violet, never just black-mixed. */
export const shade = (hex, f = 0.78) => tone(mix(hex, f), "#2a1f4a", 0.14);
/** A highlight: lighter and leaning toward warm yellow. */
export const light = (hex, f = 1.18) => tone(mix(hex, f), "#fff4c0", 0.12);

const SH = new Map();
/** The shadowed version of a packed pixel (for shadows laid over finished ground). */
export function shadePx(u, f = 0.74) {
  const k = u * 128 + Math.round(f * 100);
  let v = SH.get(k);
  if (v === undefined) { v = C(shade(hexOf(u), f)); SH.set(k, v); }
  return v;
}

// ───────────────────────────── buffers ─────────────────────────────

export class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  px(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c); }
  /** Copy the opaque pixels of `src` with its top-left at (x, y). */
  blit(src, x, y) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const c = src.d[j * src.w + i]; if (c) this.px(x + i, y + j, c); }
  }
  canvas(c) {
    if (!c) { c = document.createElement("canvas"); c.width = this.w; c.height = this.h; }
    const x = c.getContext("2d");
    const img = x.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.d);
    x.putImageData(img, 0, 0);
    return c;
  }
}

// ───────────────────────────── the projection ─────────────────────────────

/** Pixel → texel, measured from the tile's top corner. */
export const texA = (sx, sy) => (2 * sy + (sx & 1) + sx) >> 1;
export const texB = (sx, sy) => (2 * sy + (sx & 1) - sx) >> 1;
/** The 256 pixels of one tile: [sx, sy, a, b], sx from −15 to 15, sy from 0 to 15. */
export const TILE_PX = (() => {
  const out = [];
  for (let sy = 0; sy < 16; sy++) for (let sx = -16; sx < 16; sx++) {
    const a = texA(sx, sy), b = texB(sx, sy);
    if (a >= 0 && a < 16 && b >= 0 && b < 16) out.push([sx, sy, a, b]);
  }
  return out;
})();
/** Per pixel column sx (−16…15): the tile's topmost and bottommost row there, or null. */
export const COL = (() => {
  const out = {};
  for (const [sx, sy] of TILE_PX) {
    const c = out[sx] || (out[sx] = [99, -1]);
    c[0] = Math.min(c[0], sy); c[1] = Math.max(c[1], sy);
  }
  return out;
})();
