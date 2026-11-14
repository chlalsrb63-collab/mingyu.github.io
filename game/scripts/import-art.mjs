#!/usr/bin/env node
// Turn an AI-generated or downloaded image into clean, game-ready pixel art, and wire
// approved files into the game. Details and the whole workflow: asset/README.md,
// prompts: ai/prompts/weapon-assets.md.
//
// NORMALISE (writes into asset/…, never into the game):
//   node scripts/import-art.mjs <image> --kind sword --tier 3            → asset/weapons/sword/sword_t3.png
//   node scripts/import-art.mjs <image> --kind sword --tier 3 --icon     → asset/weapons/sword/icon_sword_t3.png
//   node scripts/import-art.mjs <image> --kind staff --lg chain | --set rift | --skin frost
//   node scripts/import-art.mjs <sheet> --split --names sword_t1,sword_t2,sword_t3,sword_t4,sword_t5
//   node scripts/import-art.mjs <image> --category items/potion --name hp_s --size 16x16
//   node scripts/import-art.mjs <image> --out asset/generated/try1.png --size 32x32
//   Steps: find the pixel grid of an upscaled/blurred picture (or --scale N) → sample one
//   colour per cell → cut the background away (flood from the edges) → split a sheet into
//   sprites (--split) → reduce the palette (--colors 16, --palette game snaps to weapons.js
//   colours) → remove specks → rotate/flip → a 1-px #2b2233 outline if missing → place on the
//   game canvas (world weapon: pointing right, hand at GRIP [5,16]; icon 16×16 centred).
//   Prints a before/after picture in asset/_preview/. Existing files need --force.
//   Options: --scale N (or WxH) · --colors N · --palette game · --tolerance 48 (background) · --holes
//            (also clear enclosed background) · --outline auto|add|keep · --rotate 90|180|270|45|-45
//            (clockwise) · --flip h|v · --grip x,y (hand point in the cleaned sprite) · --fit
//            (shrink a sprite that is too big) · --size WxH · --gap 2 (--split grouping) · --force
//
// INSTALL (only after the owner approved the file and asset/CREDITS.md records its source):
//   node scripts/import-art.mjs --install asset/weapons/sword/sword_t3.png [more files]
//     → copies to game/public/assets/weapons/sword/sword_t3.png, manifest key "weapon.sword.t3"
//     keys: <kind>_t<n> → weapon.<kind>.t<n> · <kind>_lg_<p> → weapon.<kind>.lg.<p> · _set_ · _skin_
//           icon_<kind>_… → icon.weapon.<kind>.… · gear/<type>/<id>.png, items/<cat>/<id>.png → icon.item.<id>
//     --key <key> to choose one yourself (one file).
//   node scripts/import-art.mjs --uninstall weapon.sword.t3      (or the file) — back to the code drawing
//   node scripts/import-art.mjs --list
import { readFile, writeFile, mkdir, copyFile, rm, rmdir, access } from "node:fs/promises";
import { join, dirname, basename, extname, resolve, relative, sep, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { args, readPng, writePng, decodeInBrowser, GAME, PUBLIC, ASSET, REPO } from "./artkit.mjs";

const INK = [0x2b, 0x22, 0x33];
const KINDS = ["sword", "dagger", "spear", "staff", "book", "bow"];
/** World sprite canvases, as weapons.js weaponSprite draws them. */
const WORLD = { sword: [44, 32], spear: [52, 32], dagger: [32, 32], staff: [32, 32], book: [32, 32], bow: [32, 32] };
const GRIP = [5, 16];
const MANIFEST = join(PUBLIC, "assets", "manifest.json");

const opt = args();
if (opt.help || opt.h || (!opt._.length && !opt.list && !opt.uninstall && !opt.install)) {
  const head = (await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).slice(0, 36);
  console.log(head.map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}
const fail = (msg) => { console.error("✗ " + msg); process.exit(1); };
const exists = (p) => access(p).then(() => true, () => false);
/** A path the user typed: absolute, relative to where they are, or relative to the repo. */
async function where(p) {
  if (isAbsolute(p)) return p;
  for (const base of [process.cwd(), REPO, ASSET]) { const q = resolve(base, p); if (await exists(q)) return q; }
  return resolve(REPO, p);
}

// ───────────────────────────── pixels ─────────────────────────────
const img = (w, h) => ({ w, h, d: new Uint8Array(w * h * 4) });
const at = (m, x, y) => (y * m.w + x) * 4;
const solid = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.d[at(m, x, y) + 3] >= 128;
const rgb = (m, i) => [m.d[i], m.d[i + 1], m.d[i + 2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const luma = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const set = (m, x, y, c, a = 255) => { const i = at(m, x, y); m.d[i] = c[0]; m.d[i + 1] = c[1]; m.d[i + 2] = c[2]; m.d[i + 3] = a; };
const clear = (m, x, y) => { m.d[at(m, x, y) + 3] = 0; };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** Make alpha binary (pixel art has no half-transparent pixels). */
function hard(m) { for (let i = 3; i < m.d.length; i += 4) m.d[i] = m.d[i] >= 128 ? 255 : 0; return m; }

// ───────────────────────────── the pixel grid ─────────────────────────────
/** How much the colour changes across each boundary along one axis, smoothed. */
function profile(m, axis) {
  const n = (axis === "x" ? m.w : m.h) - 1, E = new Float64Array(Math.max(1, n));
  const step = axis === "x" ? 4 : m.w * 4;
  for (let y = 0; y < (axis === "x" ? m.h : m.h - 1); y++) for (let x = 0; x < (axis === "x" ? m.w - 1 : m.w); x++) {
    const i = at(m, x, y), j = i + step, ai = m.d[i + 3] / 255, aj = m.d[j + 3] / 255;
    let e = Math.abs(m.d[i + 3] - m.d[j + 3]);
    for (let k = 0; k < 3; k++) e += Math.abs(m.d[i + k] * ai - m.d[j + k] * aj);
    // small differences are noise or gradients (JPEG, dithered backgrounds), not pixel edges
    E[axis === "x" ? x : y] += Math.max(0, e - 40);
  }
  const S = new Float64Array(E.length);
  for (let k = 0; k < E.length; k++) S[k] = (E[k - 1] || 0) + 2 * E[k] + (E[k + 1] || 0);
  return { raw: E, smooth: S };
}
/** The period of the comb that best catches the edge energy, its phase and its score. */
function comb(E, p) {
  let mean = 0;
  for (const v of E) mean += v;
  mean = mean / E.length || 1;
  let best = 0, phase = 0;
  for (let ph = 0; ph < p; ph += 0.5) {
    let s = 0, n = 0;
    for (let x = ph; x < E.length; x += p) { s += E[Math.min(E.length - 1, Math.round(x))]; n++; }
    const v = n ? s / n / mean : 0;
    if (v > best) { best = v; phase = ph; }
  }
  return { p, phase, score: best };
}
/**
 * The grid period along one axis. A boundary is an "edge" where the colour jumps; the true
 * period is the SMALLEST spacing whose teeth land on an edge almost every time (inside the
 * drawing — empty background is skipped), clearly more often than teeth at random would.
 * Multiples of it hit as often (so the smallest wins); halves hit only half the time.
 */
function period({ raw: E, smooth }, maxP) {
  const n = E.length;
  let peak = 0;
  for (const v of E) peak = Math.max(peak, v);
  const sorted = [...E].filter((v) => v > 0).sort((a, b) => a - b);
  const T = Math.max(1, (sorted[Math.floor(sorted.length * 0.9)] || peak) * 0.1);
  const edge = (r, w) => { for (let k = Math.max(0, r - w); k <= Math.min(n - 1, r + w); k++) if (E[k] > T) return true; return false; };
  // where the drawing is: within one period of some edge
  const near = new Int32Array(n + 1);
  for (let k = 0; k < n; k++) near[k + 1] = near[k] + (E[k] > T ? 1 : 0);
  const active = (r, p) => near[Math.min(n, Math.ceil(r + p))] - near[Math.max(0, Math.floor(r - p))] > 0;
  // how often a tooth at any position would hit, over the same stretch of drawing
  const chance = (w, p) => { let h = 0, a = 0; for (let r = 0; r < n; r++) if (active(r, p)) { a++; if (edge(r, w)) h++; } return a ? h / a : 1; };
  let pick = null;
  for (let p = 2; p <= maxP && !pick; p += p < 8 ? 0.25 : 0.5) {
    const w = p >= 6 ? 1 : 0;
    let best = 0;
    for (let ph = 0; ph < p; ph += 0.5) {
      let h = 0, a = 0;
      for (let x = ph; x < n; x += p) { const r = Math.round(x); if (!active(r, p)) continue; a++; if (edge(r, w)) h++; }
      if (a >= 8) best = Math.max(best, h / a);
    }
    if (best >= 0.85 && best >= chance(w, p) + 0.3) pick = p;
  }
  if (!pick) return { p: 1, phase: 0, score: 0 };
  // refined: the spacing near it whose teeth gather the most edge energy
  let c = comb(smooth, pick);
  for (let q = pick * 0.97; q <= pick * 1.03; q += 0.05) { const d = comb(smooth, q); if (d.score > c.score) c = d; }
  return c;
}
/** Pixels per art pixel (and where the grid starts) of an upscaled picture. */
function detectGrid(m) {
  // a small picture is already pixel art at 1:1 (generated pictures are hundreds of pixels)
  if (Math.max(m.w, m.h) <= 96) return { px: 1, py: 1, ox: 0, oy: 0 };
  const maxP = Math.max(2, Math.floor(Math.min(m.w, m.h) / 6));
  const ex = profile(m, "x"), ey = profile(m, "y");
  const gx = period(ex, maxP), gy = period(ey, maxP);
  // cells are square, but one axis may only find a multiple of the period (a long horizontal
  // blade has few column edges): then the smaller one is the period. Two unrelated periods
  // mean a stretched picture: keep both.
  let px = gx.p, py = gy.p;
  if (gx.p > 1 && gy.p > 1) {
    const [a, b] = gx.p <= gy.p ? [gx, gy] : [gy, gx], k = Math.round(b.p / a.p);
    if (Math.abs(b.p - k * a.p) <= 0.05 * b.p) px = py = k === 1 ? (a.p + b.p) / 2 : a.p;
  } else px = py = Math.max(gx.p, gy.p);
  if (px <= 1) return { px: 1, py: 1, ox: 0, oy: 0 };
  return { px, py, ...gridOrigin(m, px, py, ex, ey) };
}
/** Where a grid of (px, py) cells starts: the phase that puts the most edges on cell borders. */
function gridOrigin(m, px, py, ex = profile(m, "x"), ey = profile(m, "y")) {
  const origin = (E, p) => { if (p <= 1) return 0; const c = comb(E.smooth, p); let o = (c.phase + 1) % p; if (o > 0) o -= p; return o; };
  return { ox: origin(ex, px), oy: origin(ey, py) };
}
/** One colour per grid cell: the most common colour in the cell's middle (blur stays out). */
function sample(m, px, ox = 0, oy = 0, py = px) {
  const nx = Math.max(1, Math.ceil((m.w - ox) / px - 1e-6)), ny = Math.max(1, Math.ceil((m.h - oy) / py - 1e-6));
  const out = img(nx, ny), ix = px >= 3 ? px * 0.25 : 0, iy = py >= 3 ? py * 0.25 : 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x0 = Math.min(m.w - 1, Math.max(0, Math.ceil(ox + i * px + ix - 1e-6))), x1 = Math.min(m.w - 1, Math.max(x0, Math.ceil(ox + (i + 1) * px - ix) - 1));
    const y0 = Math.min(m.h - 1, Math.max(0, Math.ceil(oy + j * py + iy - 1e-6))), y1 = Math.min(m.h - 1, Math.max(y0, Math.ceil(oy + (j + 1) * py - iy) - 1));
    const buckets = new Map();
    let clearN = 0, all = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = at(m, x, y);
      all++;
      if (m.d[k + 3] < 128) { clearN++; continue; }
      const key = ((m.d[k] >> 4) << 8) | ((m.d[k + 1] >> 4) << 4) | (m.d[k + 2] >> 4);
      const b = buckets.get(key) || [0, 0, 0, 0];
      b[0]++; b[1] += m.d[k]; b[2] += m.d[k + 1]; b[3] += m.d[k + 2];
      buckets.set(key, b);
    }
    if (!all || clearN * 2 >= all) continue;
    let best = null;
    for (const b of buckets.values()) if (!best || b[0] > best[0]) best = b;
    set(out, i, j, [Math.round(best[1] / best[0]), Math.round(best[2] / best[0]), Math.round(best[3] / best[0])]);
  }
  return out;
}

// ───────────────────────────── background ─────────────────────────────
/** Clear the background: colours common along the border, flooded in from the edges. */
function unbackground(m, tol, holes) {
  const border = [];
  for (let x = 0; x < m.w; x++) border.push([x, 0], [x, m.h - 1]);
  for (let y = 1; y < m.h - 1; y++) border.push([0, y], [m.w - 1, y]);
  const groups = [];
  let opaque = 0;
  for (const [x, y] of border) {
    if (!solid(m, x, y)) continue;
    opaque++;
    const c = rgb(m, at(m, x, y));
    const g = groups.find((q) => dist(q.c, c) <= tol / 2);
    if (g) { g.n++; for (let k = 0; k < 3; k++) g.sum[k] += c[k]; } else groups.push({ c, n: 1, sum: c.slice() });
  }
  // a picture that is already mostly transparent round the edge has no painted background
  const bg = opaque < border.length * 0.5 ? [] : groups.filter((g) => g.n >= Math.max(2, opaque * 0.08)).map((g) => g.sum.map((v) => v / g.n));
  const isBg = (x, y) => !solid(m, x, y) || bg.some((c) => dist(c, rgb(m, at(m, x, y))) <= tol);
  const seen = new Uint8Array(m.w * m.h), stack = [];
  for (const [x, y] of border) if (isBg(x, y)) { seen[y * m.w + x] = 1; stack.push([x, y]); }
  while (stack.length) {
    const [x, y] = stack.pop();
    clear(m, x, y);
    for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= m.w || Y >= m.h || seen[Y * m.w + X] || !isBg(X, Y)) continue;
      seen[Y * m.w + X] = 1; stack.push([X, Y]);
    }
  }
  if (holes) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (solid(m, x, y) && bg.some((c) => dist(c, rgb(m, at(m, x, y))) <= tol / 2)) clear(m, x, y);
  return bg.length;
}

// ───────────────────────────── sprites in a sheet ─────────────────────────────
/** Connected groups of solid pixels (8-way), merged when closer than `gap`; reading order. */
function sprites(m, gap) {
  const lab = new Int32Array(m.w * m.h).fill(-1), comps = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!solid(m, x, y) || lab[y * m.w + x] >= 0) continue;
    const c = { x0: x, y0: y, x1: x, y1: y, n: 0 }, st = [[x, y]];
    lab[y * m.w + x] = comps.length;
    while (st.length) {
      const [px, py] = st.pop();
      c.n++; c.x0 = Math.min(c.x0, px); c.x1 = Math.max(c.x1, px); c.y0 = Math.min(c.y0, py); c.y1 = Math.max(c.y1, py);
      for (const [dx, dy] of N8) {
        const X = px + dx, Y = py + dy;
        if (solid(m, X, Y) && lab[Y * m.w + X] < 0) { lab[Y * m.w + X] = comps.length; st.push([X, Y]); }
      }
    }
    comps.push(c);
  }
  let groups = comps.map((c) => ({ ...c }));
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < groups.length && !merged; i++) for (let j = i + 1; j < groups.length && !merged; j++) {
      const a = groups[i], b = groups[j];
      if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) {
        groups[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), n: a.n + b.n };
        groups.splice(j, 1); merged = true;
      }
    }
  }
  const big = Math.max(...groups.map((g) => g.n), 0);
  groups = groups.filter((g) => g.n >= Math.min(6, big));
  // rows: a sprite whose middle lies within the current row's height joins it
  groups.sort((a, b) => a.y0 - b.y0);
  const rows = [];
  for (const g of groups) {
    const mid = (g.y0 + g.y1) / 2, row = rows.find((r) => mid >= r.y0 && mid <= r.y1);
    if (row) { row.list.push(g); row.y0 = Math.min(row.y0, g.y0); row.y1 = Math.max(row.y1, g.y1); } else rows.push({ y0: g.y0, y1: g.y1, list: [g] });
  }
  return rows.flatMap((r) => r.list.sort((a, b) => a.x0 - b.x0));
}
function crop(m, b) {
  const out = img(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.d.set(m.d.subarray(at(m, b.x0 + x, b.y0 + y), at(m, b.x0 + x, b.y0 + y) + 4), at(out, x, y));
  return out;
}
function bounds(m) {
  let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (solid(m, x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
const trim = (m) => { const b = bounds(m); return b ? crop(m, b) : m; };
function pad(m, n) {
  const out = img(m.w + 2 * n, m.h + 2 * n);
  for (let y = 0; y < m.h; y++) out.d.set(m.d.subarray(at(m, 0, y), at(m, 0, y) + m.w * 4), at(out, n, y + n));
  return out;
}

// ───────────────────────────── palette ─────────────────────────────
/** The game's colours: every material in weapons.js (and the ink). */
async function gamePalette() {
  const src = await readFile(join(PUBLIC, "weapons.js"), "utf8");
  const block = src.slice(src.indexOf("const M = {"), src.indexOf("};", src.indexOf("const M = {")));
  const hex = new Set(["#2b2233", ...(block.match(/#[0-9a-fA-F]{6}/g) || []).map((h) => h.toLowerCase())]);
  return [...hex].map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
}
/** Reduce to `k` colours (deterministic k-means over the distinct colours), optionally snapped to `snap`. */
function reduce(m, k, snap) {
  const count = new Map();
  for (let i = 0; i < m.d.length; i += 4) if (m.d[i + 3] >= 128) { const key = (m.d[i] << 16) | (m.d[i + 1] << 8) | m.d[i + 2]; count.set(key, (count.get(key) || 0) + 1); }
  const cols = [...count.entries()].map(([key, n]) => ({ c: [(key >> 16) & 255, (key >> 8) & 255, key & 255], n }));
  let cents;
  if (cols.length <= k) cents = cols.map((o) => o.c.slice());
  else {
    cols.sort((a, b) => b.n - a.n);
    cents = [cols[0].c.slice()];
    while (cents.length < k) {
      let best = null, bv = -1;
      for (const o of cols) { const dd = Math.min(...cents.map((c) => dist(c, o.c))); const v = Math.sqrt(o.n) * dd * dd; if (v > bv) { bv = v; best = o; } }
      if (!best || bv <= 0) break;
      cents.push(best.c.slice());
    }
    for (let it = 0; it < 12; it++) {
      const acc = cents.map(() => [0, 0, 0, 0]);
      for (const o of cols) { let bi = 0, bd = 1e9; cents.forEach((c, i) => { const dd = dist(c, o.c); if (dd < bd) { bd = dd; bi = i; } }); const a = acc[bi]; a[0] += o.n; for (let q = 0; q < 3; q++) a[q + 1] += o.c[q] * o.n; }
      cents = cents.map((c, i) => (acc[i][0] ? [1, 2, 3].map((q) => Math.round(acc[i][q] / acc[i][0])) : c));
    }
  }
  if (snap) cents = cents.map((c) => snap.reduce((a, b) => (dist(b, c) < dist(a, c) ? b : a)));
  const near = new Map();
  for (const o of cols) { const key = o.c.join(); near.set(key, cents.reduce((a, b) => (dist(b, o.c) < dist(a, o.c) ? b : a))); }
  for (let i = 0; i < m.d.length; i += 4) if (m.d[i + 3] >= 128) { const c = near.get(rgb(m, i).join()); m.d[i] = c[0]; m.d[i + 1] = c[1]; m.d[i + 2] = c[2]; }
  return new Set(cents.map((c) => c.join())).size;
}

// ───────────────────────────── clean-up ─────────────────────────────
/** Remove lone specks, fill one-pixel pinholes, and smooth a stray off-colour pixel into its surround. */
function despeckle(m) {
  let n = 0;
  const src = { w: m.w, h: m.h, d: m.d.slice() };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const nb = N8.filter(([dx, dy]) => solid(src, x + dx, y + dy));
    if (solid(src, x, y)) {
      if (!nb.length) { clear(m, x, y); n++; continue; }
      if (nb.length < 8) continue;
      const me = rgb(src, at(src, x, y)), first = rgb(src, at(src, x + N8[0][0], y + N8[0][1]));
      if (N8.every(([dx, dy]) => dist(rgb(src, at(src, x + dx, y + dy)), first) < 1) && dist(me, first) > 0 && dist(me, first) < 60) { set(m, x, y, first); n++; }
    } else if (N4.every(([dx, dy]) => solid(src, x + dx, y + dy))) {
      const cs = N4.map(([dx, dy]) => rgb(src, at(src, x + dx, y + dy)));
      const pick = cs.reduce((a, b) => (cs.filter((c) => dist(c, b) < 1).length > cs.filter((c) => dist(c, a) < 1).length ? b : a));
      set(m, x, y, pick); n++;
    }
  }
  return n;
}
const edgePixels = (m) => { const out = []; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (solid(m, x, y) && N4.some(([dx, dy]) => !solid(m, x + dx, y + dy))) out.push([x, y]); return out; };
/** Does the sprite already have a dark outline? */
function outlined(m) { const e = edgePixels(m); return e.length > 0 && e.filter(([x, y]) => luma(rgb(m, at(m, x, y))) < 70).length >= 0.6 * e.length; }
/** Take a dark outline away (before rotating or shrinking). */
function unoutline(m) { for (const [x, y] of edgePixels(m)) if (luma(rgb(m, at(m, x, y))) < 70) clear(m, x, y); return m; }
/** A one-pixel ink outline round everything solid (the canvas grows by one pixel each side). */
function addOutline(m) {
  const o = pad(m, 1), src = { w: o.w, h: o.h, d: o.d.slice() };
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (!solid(src, x, y) && N4.some(([dx, dy]) => solid(src, x + dx, y + dy))) set(o, x, y, INK);
  return o;
}
/** Snap dark edge pixels to the exact ink colour. */
function inkEdges(m) { for (const [x, y] of edgePixels(m)) if (luma(rgb(m, at(m, x, y))) < 70) set(m, x, y, INK); }

// ───────────────────────────── geometry ─────────────────────────────
function rotate(m, deg) {
  const r = (((deg % 360) + 360) % 360) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const right = Math.abs(deg % 90) < 1e-9;
  const W = right ? (Math.abs(c) > 0.5 ? m.w : m.h) : Math.ceil(Math.abs(m.w * c) + Math.abs(m.h * s)) + 2;
  const H = right ? (Math.abs(c) > 0.5 ? m.h : m.w) : Math.ceil(Math.abs(m.w * s) + Math.abs(m.h * c)) + 2;
  const out = img(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // clockwise on screen (y down): source = R(−θ)·(dest − centre)
    const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2;
    const sx = Math.floor(dx * c + dy * s + m.w / 2), sy = Math.floor(-dx * s + dy * c + m.h / 2);
    if (sx >= 0 && sy >= 0 && sx < m.w && sy < m.h) out.d.set(m.d.subarray(at(m, sx, sy), at(m, sx, sy) + 4), at(out, x, y));
  }
  return trim(out);
}
function flip(m, axis) {
  const out = img(m.w, m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const X = axis === "h" ? m.w - 1 - x : x, Y = axis === "v" ? m.h - 1 - y : y; out.d.set(m.d.subarray(at(m, X, Y), at(m, X, Y) + 4), at(out, x, y)); }
  return out;
}
function place(m, W, H, dx, dy) {
  const out = img(W, H);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && solid(m, x, y)) out.d.set(m.d.subarray(at(m, x, y), at(m, x, y) + 4), at(out, X, Y)); }
  return out;
}

// ───────────────────────────── preview ─────────────────────────────
/** Before (fitted to 256 px high) | after (zoomed) | after at 1× and 2×, on a checker. */
function compare(before, after) {
  const H = 256, kb = Math.min(1, H / before.h, 320 / before.w), bw = Math.max(1, Math.round(before.w * kb)), bh = Math.max(1, Math.round(before.h * kb));
  const z = Math.max(1, Math.min(12, Math.floor(H / after.h), Math.floor(420 / after.w)));
  const W = 16 + bw + 16 + after.w * z + 16 + after.w * 3 + 16 + 16;
  const out = img(W, H + 32);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) set(out, x, y, [42, 40, 52]);
  const blit = (m, X, Y, k, checker) => {
    const w = Math.round(m.w * k), h = Math.round(m.h * k);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = at(m, Math.min(m.w - 1, Math.floor(x / k)), Math.min(m.h - 1, Math.floor(y / k))), a = m.d[i + 3] / 255;
      const back = checker ? (((x >> 3) + (y >> 3)) & 1 ? [150, 150, 160] : [120, 120, 132]) : [42, 40, 52];
      set(out, X + x, Y + y, [0, 1, 2].map((q) => Math.round(m.d[i + q] * a + back[q] * (1 - a))));
    }
  };
  blit(before, 16, 16, kb, true);
  blit(after, 32 + bw, 16, z, true);
  blit(after, 48 + bw + after.w * z, 16, 1, true);
  blit(after, 48 + bw + after.w * z, 32 + after.h, 2, true);
  return out;
}

// ───────────────────────────── names and keys ─────────────────────────────
const NAME_RE = new RegExp(`^(icon_)?(${KINDS.join("|")})_(t[1-5]|lg_[a-z0-9]+|set_[a-z0-9]+|skin_[a-z0-9]+)$`);
/** What a file name says: a weapon sprite or icon, or nothing. */
function parseName(name) {
  const m = NAME_RE.exec(name);
  return m ? { icon: !!m[1], kind: m[2], look: m[3] } : null;
}
function targetOf(name, o) {
  const w = parseName(name);
  if (w) {
    const size = o.size ? o.size.split("x").map(Number) : w.icon ? [16, 16] : WORLD[w.kind];
    return { file: join(ASSET, "weapons", w.kind, name + ".png"), size, mode: w.icon || w.kind === "book" ? "centre" : "grip" };
  }
  const size = o.size ? String(o.size).split("x").map(Number) : null;
  const file = o.out && !o._many ? resolve(REPO, String(o.out)) : join(ASSET, ...(o.category ? String(o.category).split("/") : ["generated"]), name + ".png");
  return { file, size, mode: "centre" };
}

// ───────────────────────────── normalise ─────────────────────────────
async function load(file) {
  const buf = await readFile(file);
  try { const p = readPng(buf); return { w: p.w, h: p.h, d: p.data }; } catch {
    const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" }[extname(file).toLowerCase()] || "image/png";
    const p = await decodeInBrowser(buf, mime, opt.channel);
    return { w: p.w, h: p.h, d: p.data };
  }
}

/** Clean one cut-out sprite and put it on its canvas. */
function finish(sp, target, snap, log) {
  let m = trim(sp);
  const colors = reduce(m, Number(opt.colors || 16), snap);
  const specks = despeckle(m);
  m = trim(m);
  const rot = Number(opt.rotate || 0), right = rot % 90 === 0;
  if (rot && !right) { unoutline(m); m = rotate(m, rot); despeckle(m); m = trim(m); } else if (rot) m = rotate(m, rot);
  if (opt.flip) for (const a of String(opt.flip).split(",")) m = flip(m, a);
  const mode = String(opt.outline || "auto");
  const had = outlined(m);
  if (mode === "add" || (mode === "auto" && (!had || (rot && !right)))) m = addOutline(m);
  else if (mode === "auto") inkEdges(m);
  if (target.size) {
    const [W, H] = target.size;
    if (m.w > W || m.h > H) {
      if (!opt.fit) throw new Error(`the sprite is ${m.w}×${m.h}, bigger than the ${W}×${H} canvas: check --scale (or the picture), or add --fit to shrink it`);
      const k = Math.max((m.w) / (W - 2), (m.h) / (H - 2));
      unoutline(m); m = trim(sample(pad(m, 0), k)); despeckle(m); m = addOutline(trim(m));
      log.push(`shrunk ×1/${k.toFixed(2)} to fit`);
    }
    let dx = Math.floor((W - m.w) / 2), dy = Math.floor((H - m.h) / 2);
    if (target.mode === "grip") {
      if (opt.grip) { const [gx, gy] = String(opt.grip).split(",").map(Number); dx = GRIP[0] - gx; dy = GRIP[1] - gy; }
      else {
        // the hand end is the left: the pommel's outline at x = 0, the grip's middle on GRIP's row
        let s = 0, n = 0;
        for (let y = 0; y < m.h; y++) for (let x = 0; x < Math.min(6, m.w); x++) if (solid(m, x, y)) { s += y; n++; }
        dx = 0; dy = Math.round(GRIP[1] - (n ? s / n : m.h / 2));
        dy = Math.max(0, Math.min(H - m.h, dy));
      }
      if (m.h > m.w * 0.7 && m.w > 8) log.push("looks diagonal or upright: a world sprite points RIGHT (try --rotate 45, or make an --icon)");
    }
    m = place(m, W, H, dx, dy);
  }
  log.push(`${colors} colours`, `${specks} specks cleaned`, had ? "outline kept" : "outline added");
  return hard(m);
}

async function normalise() {
  const input = await where(opt._[0]);
  if (!(await exists(input))) fail("no such image: " + opt._[0]);
  const src = hard(await load(input));
  let grid;
  if (opt.scale) { const [a, b] = String(opt.scale).split("x").map(Number); grid = { px: a, py: b || a, ...gridOrigin(src, a, b || a) }; }
  else grid = detectGrid(src);
  const up = grid.px > 1 || grid.py > 1;
  const small = up ? sample(src, grid.px, grid.ox, grid.oy, grid.py) : { w: src.w, h: src.h, d: src.d.slice() };
  const said = grid.px === grid.py ? grid.px.toFixed(2) : `${grid.px.toFixed(2)}×${grid.py.toFixed(2)}`;
  const bgN = unbackground(small, Number(opt.tolerance || 48), !!opt.holes);
  console.log(`${basename(input)}: ${src.w}×${src.h}, grid ${up ? said + " px per pixel" + (opt.scale ? " (given)" : " (detected)") : "1 (not upscaled)"} → ${small.w}×${small.h}, ${bgN} background colour(s) removed`);
  if (!up && Math.max(src.w, src.h) > 200) console.log("  ! no pixel grid found in a big picture (smoothly scaled?): measure one art pixel in an image viewer and give --scale N");
  const snap = opt.palette === "game" ? await gamePalette() : null;

  let parts;
  if (opt.split) parts = sprites(small, Number(opt.gap ?? 2)).map((b) => crop(small, b));
  else { const b = bounds(small); if (!b) fail("nothing left after removing the background: try a smaller --tolerance"); parts = [crop(small, b)]; }
  const names = opt.names ? String(opt.names).split(",").map((s) => s.trim()).filter(Boolean) : null;
  if (opt.split) console.log(`found ${parts.length} sprite(s)` + (names && names.length !== parts.length ? ` — but ${names.length} --names were given: extra sprites get numbered names` : ""));

  const base = basename(input, extname(input)).replace(/[^\w-]+/g, "_");
  const single = (() => {
    if (opt.name) return String(opt.name);
    if (opt.kind) {
      if (!KINDS.includes(opt.kind)) fail("--kind must be one of " + KINDS.join(" "));
      const look = opt.lg ? `lg_${opt.lg}` : opt.set ? `set_${opt.set}` : opt.skin ? `skin_${opt.skin}` : `t${Number(opt.tier || 1)}`;
      return (opt.icon ? "icon_" : "") + `${opt.kind}_${look}`;
    }
    return base + "_clean";
  })();
  for (let i = 0; i < parts.length; i++) {
    const name = names && names[i] ? names[i] : parts.length > 1 ? `${single}_${String(i + 1).padStart(2, "0")}` : single;
    const target = targetOf(name, { ...opt, _many: parts.length > 1 });
    const log = [];
    let m;
    try { m = finish(parts[i], target, snap, log); } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); process.exitCode = 1; continue; }
    if ((await exists(target.file)) && !opt.force) { console.log(`  ✗ ${name}: ${rel(target.file)} exists — add --force to replace it`); process.exitCode = 1; continue; }
    await mkdir(dirname(target.file), { recursive: true });
    await writeFile(target.file, writePng({ w: m.w, h: m.h, data: m.d }));
    const prev = join(ASSET, "_preview", name + ".compare.png");
    await mkdir(dirname(prev), { recursive: true });
    await writeFile(prev, writePng((({ w, h, d }) => ({ w, h, data: d }))(compare(src, m))));
    console.log(`  ✓ ${rel(target.file)}  ${m.w}×${m.h}  (${log.join(", ")})\n    before/after: ${rel(prev)}`);
  }
  console.log("Look at it in the gallery (ASSETS.bat) and, once approved and credited in asset/CREDITS.md:\n  node scripts/import-art.mjs --install <file>");
}
const rel = (p) => relative(REPO, p).split(sep).join("/");

// ───────────────────────────── install ─────────────────────────────
async function readManifest() {
  try { return JSON.parse(await readFile(MANIFEST, "utf8")); } catch { return { images: {}, audio: {} }; }
}
async function writeManifest(man) {
  const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  const out = { _readme: man._readme, images: sorted(man.images || {}), audio: sorted(man.audio || {}) };
  await writeFile(MANIFEST, JSON.stringify(out, null, 2) + "\n");
}
/** Bump the ?v= cache tag in public/index.html (AGENTS.md rule 8). */
async function bumpCacheTag() {
  const f = join(PUBLIC, "index.html"), s = await readFile(f, "utf8");
  const m = s.match(/\?v=(\d+)/);
  if (!m) return null;
  const v = String(Number(m[1]) + 1);
  await writeFile(f, s.replace(/\?v=\d+/g, "?v=" + v));
  return v;
}
function keyOf(relPath) {
  const parts = relPath.split("/"), name = basename(relPath, ".png");
  if (parts[0] === "weapons") {
    const w = parseName(name);
    if (!w) return null;
    return (w.icon ? "icon.weapon." : "weapon.") + w.kind + "." + w.look.replace("_", ".");
  }
  if (parts[0] === "gear" || parts[0] === "items") return "icon.item." + name;
  return null;
}
async function install(files) {
  const man = await readManifest();
  const credits = (await readFile(join(ASSET, "CREDITS.md"), "utf8").catch(() => "")).replace(/<!--[\s\S]*?-->/g, "");
  const L = await import(pathToFileURL(join(GAME, "src", "logic.js")).href);
  const items = L.defs().items;
  let n = 0;
  for (const f of files) {
    const file = await where(f);
    const r = relative(ASSET, file).split(sep).join("/");
    if (r.startsWith("..") || !(await exists(file))) { console.log(`  ✗ ${f}: not a file inside asset/`); process.exitCode = 1; continue; }
    if (extname(file).toLowerCase() !== ".png") { console.log(`  ✗ ${r}: only PNG images are installed`); process.exitCode = 1; continue; }
    const key = files.length === 1 && opt.key ? String(opt.key) : keyOf(r);
    if (!key) { console.log(`  ✗ ${r}: no manifest key for this name/folder — rename it (see --help) or give --key`); process.exitCode = 1; continue; }
    const name = basename(r, ".png"), dir = r.slice(0, r.lastIndexOf("/"));
    if (!opt.force && !credits.includes(name) && !credits.includes(dir)) {
      console.log(`  ✗ ${r}: asset/CREDITS.md does not mention "${name}" or "${dir}" — record its source and licence (or "AI-generated", tool, prompt file) first`);
      process.exitCode = 1; continue;
    }
    const buf = await readFile(file), p = readPng(buf);
    const w = parseName(name);
    const want = w ? (w.icon ? [16, 16] : WORLD[w.kind]) : key.startsWith("icon.item.") ? [16, 16] : null;
    if (want && (p.w !== want[0] || p.h !== want[1])) { console.log(`  ✗ ${r}: ${p.w}×${p.h}, the game needs ${want[0]}×${want[1]} (normalise it with this script first)`); process.exitCode = 1; continue; }
    if (key.startsWith("icon.item.") && !items[name]) console.log(`  ! ${r}: no item "${name}" in ITEMS (10-tables.js) — installed anyway`);
    const dest = join(PUBLIC, "assets", ...r.split("/"));
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(file, dest);
    const hash = createHash("sha1").update(buf).digest("hex").slice(0, 8);
    man.images[key] = { src: `assets/${r}?v=${hash}`, w: p.w, h: p.h };
    console.log(`  ✓ ${key} ← game/public/assets/${r}`);
    n++;
  }
  if (n) {
    await writeManifest(man);
    const v = await bumpCacheTag();
    console.log(`manifest: ${n} entr${n > 1 ? "ies" : "y"} written${v ? `; cache tag ?v=${v}` : ""}. Check the game (npm run dev:local), then commit asset/…, game/public/assets/… and game/public/index.html.`);
  }
}
async function uninstall(what) {
  const man = await readManifest();
  const keys = Object.keys(man.images).filter((k) => k === what || man.images[k].src.split("?")[0].endsWith(String(what).replace(/\\/g, "/").replace(/^.*asset\//, "")));
  if (!keys.length) fail(`nothing installed as "${what}" (see --list)`);
  for (const k of keys) {
    const src = man.images[k].src.split("?")[0];
    delete man.images[k];
    if (!Object.values(man.images).some((e) => e.src.split("?")[0] === src)) {
      const f = join(PUBLIC, ...src.split("/"));
      await rm(f, { force: true });
      // drop folders left empty, up to public/assets/
      for (let d = dirname(f); d.startsWith(join(PUBLIC, "assets") + sep); d = dirname(d)) { try { await rmdir(d); } catch { break; } }
    }
    console.log(`  ✓ removed ${k} (${src}) — the code drawing is back`);
  }
  await writeManifest(man);
  await bumpCacheTag();
}

if (opt.list) {
  const man = await readManifest();
  const ks = Object.keys(man.images || {});
  console.log(ks.length ? ks.map((k) => `${k}  ${man.images[k].src}  ${man.images[k].w}×${man.images[k].h}`).join("\n") : "nothing installed: every look is code-drawn");
} else if (opt.uninstall) await uninstall(String(opt.uninstall));
else if (opt.install) await install(opt.install === true ? opt._ : [String(opt.install), ...opt._]);
else await normalise();
