/**
 * The ground of a map, baked once into two canvases (two frames of water).
 *
 * Every tile is worked out as a 16×16 patch of texels and projected onto its
 * diamond (iso_px.js). Each kind of ground is a material: a base colour, a
 * texture of pixel clusters laid in screen space (so they read as pixel art,
 * not as squashed squares), and a rank. Where two materials meet, the one
 * that lies higher (lower rank: grass over path over sand over water) bites
 * into its neighbour along a wavering line that is continuous from tile to
 * tile, with a dark lip on its edge, a lit rim where the edge faces up the
 * screen and a cast shadow where it faces down. Water sits lower than the land
 * around it: a little earth bank shows under the far shore. Raised things
 * (walls, cliffs, hedges, houses) throw a short shadow down and to the right.
 * After projection, upright details — tufts, flowers, blades — are stamped
 * in screen space onto the pixels of the material they belong to.
 */
import { hash, vnoise, C, mix, tone, shade, light, shadePx, TILE_PX } from "./iso_px.js";

// ───────────────────────────── palettes ─────────────────────────────

/** The dungeons share bones with the cave but each has its own skin (same values as scene2d's UG). */
export const UG = {
  crypt: { floor: ["#6f6a64", "#55504c", "#8b867c"], rock: "#15121a", face: ["#4b4540", "#77705f", "#989078", "#2f2a29"], wet: ["#3d5a66", "#33505c", "#7aa0a8", "#243a44", "#5a8088"] },
  sewer: { floor: ["#5d6a5e", "#47534a", "#768476"], rock: "#0d130f", face: ["#6a4636", "#8a6048", "#aa7c5e", "#3c2820"], wet: ["#6a9a3a", "#5a8a30", "#b0dc70", "#36561e", "#8cc054"] },
  abyss: { floor: ["#7c2f3c", "#5c1e2b", "#9e4855"], rock: "#19070c", face: ["#5a1622", "#8c2c3a", "#ba4e5a", "#330e18"], wet: ["#a81c2c", "#8e1424", "#e4606c", "#560a16", "#d04858"] },
  cave: { floor: ["#486a8a", "#3c5a78", "#5a7ea0"], rock: "#131a32", face: ["#2e4468", "#4a6a98", "#5a7cac", "#223450"], wet: ["#3f8fd0", "#3478bc", "#8ad4f8", "#245a8c", "#6ab8ec"] },
};
export const GRASS = { meadow: "#6cbf5e", town: "#6cbf5e", city: "#6cbf5e", forest: "#3f8a5c" };
export const underground = (theme) => !!UG[theme];

/** Material ids, as stored per pixel so later passes know what they are drawing on. */
export const MID = { void: 1, grass: 2, forest: 3, path: 4, sand: 5, plaza: 6, ruin: 7, water: 8, deep: 9, bank: 10, mud: 11, steps: 12, asph: 13, pave: 14, floor: 15, deck: 16, line: 17, curb: 18 };

/** A cluster shape: rows separated by "/", "." empty, a digit picks a colour from the material's palette. */
function shape(s) {
  const rows = s.split("/"), h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const p = new Int8Array(w * h).fill(-1);
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== ".") p[y * w + x] = +c; }));
  return { w, h, p };
}
/**
 * Clusters scattered on a jittered grid of cw×ch screen cells: at most one per
 * cell, never touching the next. Returns a palette index or −1.
 */
function clu(SX, SY, cw, ch, seed, dens, shapes) {
  const cy = Math.floor(SY / ch), sx = SX + (cy & 1 ? cw >> 1 : 0), cx = Math.floor(sx / cw);
  if (hash(cx, cy, seed) >= dens) return -1;
  const sh = shapes[(hash(cx, cy, seed + 1) * shapes.length) | 0];
  const ox = (hash(cx, cy, seed + 2) * (cw - sh.w)) | 0, oy = (hash(cx, cy, seed + 3) * (ch - sh.h)) | 0;
  const lx = sx - cx * cw - ox, ly = SY - cy * ch - oy;
  if (lx < 0 || ly < 0 || lx >= sh.w || ly >= sh.h) return -1;
  return sh.p[ly * sh.w + lx];
}
const SHP = {
  grass: ["1.1/.1.", "2.2/.2.", "11", "22", "1/1", ".2/2.", "2./.2"].map(shape),
  grass2: ["3.3/.3.", "3./33", "11/.11", "333"].map(shape),
  forest: ["1.1/.1.", "11", "2.2/.2.", "45", "54", ".4/5.", "22"].map(shape),
  pebble: ["2/1", "22/11", "11", "33", "2./11", "3/1"].map(shape),
  sand: ["22", "11", "222", "1.1", "3/1"].map(shape),
  water: ["111", "1111", "22", "11.11"].map(shape),
  asph: ["11", "22", "1/1", "111"].map(shape),
  mud: ["22", "11", "111", "3/1"].map(shape),
  flesh: ["22", "222", "2/1", "11"].map(shape),
  stone: ["1", "2", "11"].map(shape),
};

function mk(id, rank, hex, o = {}) {
  const base = C(hex);
  return {
    id, rank, hex, base, pal: (o.pal || [hex, shade(hex, 0.84), light(hex, 1.12)]).map(C),
    line: C(o.line || shade(hex, 0.62)), hi: C(o.hi || light(hex, 1.24)), style: o.style || "lip", straight: !!o.straight,
    depth: o.depth ?? 2, amp: o.amp ?? 2.4, tex: o.tex || (() => base), kind: o.kind || "", wet: C(o.wet || shade(hex, 0.86)),
  };
}

// ───────────────────────────── textures ─────────────────────────────

/** Organic ground: clusters in two layers, thicker where low noise says the ground is busy. */
function organic(m, l1, l2, seed, d1, d2, cw = 7, ch = 5) {
  let lastT = -1, busy = 1;
  return (A, B) => {
    const SX = A - B, SY = (A + B) >> 1, t = ((A >> 3) << 16) | (B >> 3);
    if (t !== lastT) { lastT = t; busy = 0.45 + vnoise(A, B, 40, seed) * 1.1; }
    let k = clu(SX, SY, cw, ch, seed, d1 * busy, l1);
    if (k < 0 && l2) k = clu(SX + 3, SY + 2, cw + 4, ch + 3, seed + 7, d2 * busy, l2);
    return k < 0 ? m.pal[0] : m.pal[k];
  };
}
/**
 * Laid stone: rectangles of sw×sh texels in courses (each course shifted by
 * `bond`), every stone its own shade, lit along its upper-left edges and dark
 * along its lower-right ones.
 */
function laid(m, sw, sh, bond, seed, o = {}) {
  return (A, B) => {
    const row = Math.floor(B / sh), a2 = A + (row & 1 ? bond : 0), col = Math.floor(a2 / sw);
    const la = a2 - col * sw, lb = B - row * sh, t = hash(col, row, seed);
    if (la === sw - 1 || lb === sh - 1) return m.pal[1];
    if (la === 0 || lb === 0) return o.flatRim ? m.pal[0] : m.pal[2];
    if (o.moss && t > 0.9 && (la < 3 || lb < 2) && hash(A, B, seed + 5) < 0.6) return o.moss;
    if (o.crack && t < 0.05 && Math.abs(la - lb * (sw / sh) * 0.6 - 2) < 0.6) return m.pal[1];
    return t < 0.22 ? m.pal[3] || m.pal[2] : t > 0.82 ? m.pal[4] || m.pal[1] : m.pal[0];
  };
}

/** The materials of a theme, by ground char. */
const matCache = new Map();
export function materials(theme) {
  let T = matCache.get(theme);
  if (T) return T;
  const U = UG[theme];
  const gHex = GRASS[theme] || GRASS.meadow;
  const grass = mk(theme === "forest" ? MID.forest : MID.grass, theme === "forest" ? 1 : 0, gHex, {
    pal: [gHex, shade(gHex, 0.84), light(gHex, 1.14), shade(gHex, 0.9)], line: shade(gHex, 0.6),
  });
  grass.tex = theme === "forest"
    ? organic(grass, SHP.forest, SHP.grass2, 11, 0.62, 0.3)
    : organic(grass, SHP.grass, SHP.grass2, 11, 0.6, 0.28);
  if (theme === "forest") {
    grass.pal.push(C("#c0843e"), C("#9a6232"));
  }
  const path = mk(MID.path, 3, "#d9ab6c", { pal: ["#d9ab6c", "#b08650", "#ecd0a0", "#c49660"], line: "#8f6238" });
  path.tex = organic(path, SHP.pebble, null, 21, 0.5, 0, 7, 5);
  const sand = mk(MID.sand, 7, "#ecd9a2", { pal: ["#ecd9a2", "#d6c08a", "#fbf0c8", "#c8b07a"], line: "#b89a5e" });
  sand.tex = organic(sand, SHP.sand, null, 31, 0.5, 0, 8, 5);
  const plaza = mk(MID.plaza, 5, "#b4b9c6", { pal: ["#b4b9c6", "#8e94a4", "#d0d4de", "#c2c6d2", "#a6acba"], straight: true, depth: 1, line: "#6e7486" });
  plaza.tex = laid(plaza, 8, 8, 4, 41);
  const ruin = mk(MID.ruin, 4, "#aeb0a0", { pal: ["#aeb0a0", "#868a7c", "#c8cabc", "#bcbeae", "#9a9c8c"], straight: true, depth: 1, line: "#6e7266" });
  ruin.tex = laid(ruin, 12, 8, 5, 43, { moss: C("#7ab868"), crack: true });
  const mud = mk(MID.mud, 8, "#6a6444", { pal: ["#6a6444", "#585236", "#7e7652", "#8a8270"], line: "#4a4430" });
  const mudT = organic(mud, SHP.mud, null, 51, 0.45, 0, 7, 5);
  const pool = C("#4e5e58"), sky = C("#8aa6a0"), poolE = C("#4a4430");
  mud.tex = (A, B) => {
    const ca = Math.floor(A / 11), cb = Math.floor(B / 11);
    if (hash(ca, cb, 52) < 0.5) {
      const r = 2.2 + hash(ca, cb, 53) * 1.8, pa = ca * 11 + 5.5, pb = cb * 11 + 5.5, d = Math.hypot(A + 0.5 - pa, B + 0.5 - pb);
      if (d < r) return Math.abs(A - B - (pa - pb) + 2) < 1 && B + 0.5 < pb ? sky : pool;
      if (d < r + 1) return poolE;
    }
    return mudT(A, B);
  };
  const steps = mk(MID.steps, 2, "#bdb39a", { straight: true, depth: 1 });
  // water: shallow and deep; the bank under a far shore
  const wet = U ? U.wet : ["#4aa2e2", "#3f8ad2", "#8accf6", "#2f78c0", "#86c8f4"];
  const water = mk(MID.water, 10, wet[0], { pal: [wet[0], wet[1], mix(wet[0], 1.08)], style: "bank", line: wet[3] });
  water.tex = organic(water, SHP.water, null, 61, 0.2, 0, 11, 6);
  water.foam = C(U ? wet[2] : "#d8f0ff"); water.foam2 = C(wet[4]);
  water.bank = (U ? [U.face[1], U.face[0], U.face[3]] : ["#b08650", "#8f6238", "#6a4426"]).map(C);
  const deep = mk(MID.deep, 11, wet[1], { pal: [wet[1], mix(wet[1], 0.9), mix(wet[1], 1.06)], style: "soft", amp: 3, depth: 2 });
  deep.tex = organic(deep, SHP.water, null, 63, 0.16, 0, 12, 6);
  // the city: asphalt below, pavement above at the curb
  const asph = mk(MID.asph, 7, "#474b5a", { pal: ["#474b5a", "#3c404c", "#545868"], style: "curb", straight: true, depth: 0 });
  asph.tex = organic(asph, SHP.asph, null, 71, 0.35, 0, 7, 5);
  const pave = mk(MID.pave, 6, "#9aa0ae", { pal: ["#9aa0ae", "#7e8492", "#b0b6c2", "#a2a8b6", "#9298a6"], straight: true, depth: 0 });
  pave.tex = laid(pave, 8, 8, 0, 73, { flatRim: true });
  // what lies under everything in a cave: rock that is not drawn, and the floor
  const rock = mk(MID.void, -99, U ? U.rock : "#131a32", { style: "none" });
  let floor;
  if (U) {
    const [mid, dark, lit] = U.floor;
    floor = mk(MID.floor, 4, mid, { pal: [mid, dark, lit, mix(mid, 1.05), mix(mid, 0.95)], straight: true, depth: 1, line: dark });
    if (theme === "crypt") floor.tex = laid(floor, 16, 8, 8, 81, { crack: true });
    else if (theme === "sewer") {
      const br = laid(floor, 8, 4, 4, 83), grime = C("#4f7a3a");
      floor.tex = (A, B) => (vnoise(A, B, 9, 84) > 0.74 && ((A + B) & 1 || vnoise(A, B, 9, 84) > 0.8) ? grime : br(A, B));
    } else if (theme === "abyss") {
      const fl = organic(floor, SHP.flesh, null, 85, 0.35, 0, 8, 5), vein = C(dark), deepV = C(U.face[3]);
      floor.tex = (A, B) => {
        const n = vnoise(A, B, 13, 86), n2 = vnoise(A, B, 7, 87);
        if (Math.abs(n - 0.5) < 0.028) return deepV;
        if (Math.abs(n2 - 0.5) < 0.03 && n > 0.5) return vein;
        return fl(A, B);
      };
    } else {
      // rough rock underfoot: broken plates with dark cracks between, pebbles where it is busy
      const rough = organic(floor, SHP.pebble, null, 88, 0.42, 0, 7, 5), crack = C(shade(mid, 0.72)), plate = C(mix(mid, 1.06));
      floor.tex = (A, B) => {
        const n = vnoise(A, B, 7, 89), n2 = vnoise(A, B, 13, 90);
        if (Math.abs(n - 0.5) < 0.03 && n2 > 0.35) return crack;
        if (n > 0.5 && n < 0.6 && n2 > 0.45) return plate;
        return rough(A, B);
      };
    }
  } else {
    floor = mk(MID.floor, 4, "#486a8a", { pal: ["#486a8a", "#3c5a78", "#5a7ea0", "#4e7090", "#42627e"], straight: true, depth: 1, line: "#2a4262" });
    // rough rock underfoot: broken plates with dark cracks between, pebbles where it is busy
    const rough = organic(floor, SHP.pebble, null, 88, 0.42, 0, 7, 5), crack = C("#34506c"), plate = C("#4e7192");
    floor.tex = (A, B) => {
      const n = vnoise(A, B, 7, 89), n2 = vnoise(A, B, 13, 90);
      if (Math.abs(n - 0.5) < 0.03 && n2 > 0.35) return crack;
      if (n > 0.5 && n < 0.58 && n2 > 0.5) return plate;
      return rough(A, B);
    };
  }
  T = {
    ".": grass, ",": grass, '"': grass, t: grass, ":": grass, ";": grass,
    p: path, s: sand, o: plaza, r: ruin, j: mud, v: steps, w: water, b: water,
    a: asph, m: asph, k: pave, c: floor, d: floor, g: floor, W: rock,
    _deep: deep, _water: water, _floor: floor, _grass: grass,
  };
  matCache.set(theme, T);
  return T;
}

// ───────────────────────────── what stands up ─────────────────────────────

/** How far each raised thing's shadow reaches: [along its right face, along its left face] in texels. */
const RAISED = { C: [6, 3], H: [4, 2], U: [5, 2], Z: [6, 3], h: [8, 4] };
export function raisedAt(m, x, y) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null;
  if (m.g[y][x] === "W") return [6, 3];
  return RAISED[m.o[y][x]] || null;
}

// ───────────────────────────── the bake ─────────────────────────────

const DX = [0, 1, 0, -1, -1, 1, 1, -1], DY = [-1, 0, 1, 0, -1, -1, 1, 1];
const UP = [1, 0, 0, 1, 1, 0, 0, 0], DOWN = [0, 1, 1, 0, 0, 0, 1, 0];

export function bake(m, theme) {
  const t0 = performance.now();
  const MT = materials(theme), U = UG[theme];
  const W = (m.w + m.h) * 16, H = (m.w + m.h) * 8 + 24, ox = m.h * 16, oy = 8;
  const px = new Uint32Array(W * H), mat = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? null : m.g[y][x]);
  const isWater = (x, y) => { const c = at(x, y); return c === "w" || c === "b"; };
  const tmat = new Array(m.w * m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) tmat[y * m.w + x] = MT[m.g[y][x]] || MT._grass;
  // deep water lies a little way out from every shore, along a wavering line
  const D0 = U ? 11 : 17, land = [];
  const deepTex = MT._deep.tex, wetId = MT._water.id, deepId = MT._deep.id;
  const matAt = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? null : tmat[y * m.w + x]);
  const ext = extras(m, theme, MT);

  const TEX = new Uint32Array(256), TM = new Uint8Array(256);
  const PA = TILE_PX.map((p) => p[2]), PB = TILE_PX.map((p) => p[3]);
  const OFF = TILE_PX.map(([sx, sy]) => sy * W + sx);
  const nb = new Array(8), dn = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const me = tmat[y * m.w + x], ch = m.g[y][x];
    // 1 — the material itself
    if (me.id === wetId) {
      land.length = 0;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { if (i || j) { const c = at(x + i, y + j); if (c !== null && !isWater(x + i, y + j)) land.push((x + i) * 16, (y + j) * 16); } }
      for (let k = 0; k < 256; k++) {
        const a = PA[k], b = PB[k], A = x * 16 + a, B = y * 16 + b;
        let d = 99;
        for (let i = 0; i < land.length; i += 2) {
          const dx = Math.max(land[i] - A - 0.5, 0, A + 0.5 - land[i] - 16), dy = Math.max(land[i + 1] - B - 0.5, 0, B + 0.5 - land[i + 1] - 16);
          const e = dx * dx + dy * dy;
          if (e < d) d = e;
        }
        d = Math.sqrt(d);
        const lim = D0 + vnoise(A, B, 9, 13) * 7 - 3;
        if (d > lim + 1 || (d > lim && (A + B) & 2)) { TEX[k] = deepTex(A, B); TM[k] = deepId; }
        else { TEX[k] = me.tex(A, B); TM[k] = wetId; }
      }
    } else for (let k = 0; k < 256; k++) {
      const a = PA[k], b = PB[k], A = x * 16 + a, B = y * 16 + b;
      TEX[k] = me.tex(A, B); TM[k] = me.id;
    }
    // 2 — higher ground biting in from the neighbours
    dn.length = 0;
    for (let i = 0; i < 8; i++) {
      const n = (nb[i] = matAt(x + DX[i], y + DY[i]));
      if (n && n !== me && n.rank < me.rank && n.style !== "none" && me.style !== "none" && !dn.includes(n)) dn.push(n);
    }
    if (dn.length) {
      dn.sort((p, q) => q.rank - p.rank);
      for (const D of dn) fringe(D, me, x, y, nb, TEX, TM, PA, PB);
    }
    // 3 — texel decals: the plaza's rings, mats, beds, crossings, bridges, grates, steps
    if (ext.tile) ext.tile(x, y, ch, me, TEX, TM, PA, PB);
    // 4 — the shadow of what stands to the upper left and upper right
    if (!raisedAt(m, x, y)) {
      const rl = raisedAt(m, x - 1, y), rr = raisedAt(m, x, y - 1), rc = raisedAt(m, x - 1, y - 1);
      if (rl || rr || rc) for (let k = 0; k < 256; k++) {
        const a = PA[k], b = PB[k];
        if ((rl && a < rl[0] - (b > 13 ? 15 - b : 0) * 0) || (rr && b < rr[1]) || (rc && a < rc[0] && b < rc[1])) TEX[k] = shadePx(TEX[k], 0.8);
      }
    }
    // project
    const base = (oy + (x + y) * 8) * W + ox + (x - y) * 16;
    for (let k = 0; k < 256; k++) { px[base + OFF[k]] = TEX[k]; mat[base + OFF[k]] = TM[k]; }
  }
  const S = { m, theme, W, H, ox, oy, px, mat, MT };
  // 5 — upright details in screen space
  details(S);
  if (ext.screen) ext.screen(S);
  // 6 — two frames of water
  const px2 = px.slice();
  glints(S, px, 0); glints(S, px2, 1);
  const frames = [px, px2].map((d) => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d"), img = g.createImageData(W, H);
    new Uint32Array(img.data.buffer).set(d);
    g.putImageData(img, 0, 0);
    return c;
  });
  return { frames, ox, oy, ms: performance.now() - t0 };
}

/** One donor material biting into this tile. */
function fringe(D, R, x, y, nb, TEX, TM, PA, PB) {
  const has = nb.map((n) => n === D);
  const R0 = 8;
  const straight = D.straight || R.straight;
  const style = R.style === "bank" || R.style === "soft" ? R.style : R.style === "curb" && D.id === MID.pave ? "curb" : "lip";
  for (let k = 0; k < 256; k++) {
    const a = PA[k], b = PB[k], da = a + 0.5, db = b + 0.5, ea = 16 - da, eb = 16 - db;
    let d = 99, dir = -1;
    const take = (v, i) => { if (v < d) { d = v; dir = i; } };
    if (has[0]) take(db, 0);
    if (has[1]) take(ea, 1);
    if (has[2]) take(eb, 2);
    if (has[3]) take(da, 3);
    if (has[4]) take(Math.hypot(da, db), 4);
    if (has[5]) take(Math.hypot(ea, db), 5);
    if (has[6]) take(Math.hypot(ea, eb), 6);
    if (has[7]) take(Math.hypot(da, eb), 7);
    if (!straight) {
      // round this patch's outer corners where two sides give way at once
      if (has[0] && has[3] && da < R0 && db < R0) take(R0 - Math.hypot(R0 - da, R0 - db), 4);
      if (has[0] && has[1] && ea < R0 && db < R0) take(R0 - Math.hypot(R0 - ea, R0 - db), 5);
      if (has[1] && has[2] && ea < R0 && eb < R0) take(R0 - Math.hypot(R0 - ea, R0 - eb), 6);
      if (has[2] && has[3] && da < R0 && eb < R0) take(R0 - Math.hypot(R0 - da, R0 - eb), 7);
    }
    if (d > 9) continue;
    const A = x * 16 + a, B = y * 16 + b;
    const dep = straight ? D.depth : D.depth + Math.floor(vnoise(A, B, 5, 3) * D.amp + vnoise(A, B, 2.5, 4) * 0.9);
    const up = UP[dir], down = DOWN[dir];
    if (style === "lip") {
      if (d < dep - 1 || (d < dep && !down)) { TEX[k] = D.tex(A, B); TM[k] = D.id; }
      else if (d < dep) { TEX[k] = D.hi; TM[k] = D.id; }
      else if (d < dep + 1) { TEX[k] = D.line; TM[k] = MID.line; }
      else if (d < dep + 2 && up) TEX[k] = shadePx(TEX[k], 0.8);
    } else if (style === "bank") {
      if (up && dir < 4) {
        if (d < dep) { TEX[k] = D.tex(A, B); TM[k] = D.id; }
        else if (d < dep + 1) { TEX[k] = D.line; TM[k] = MID.line; }
        else if (d < dep + 4) { const r = Math.floor(d - dep - 1); TEX[k] = R.bank[r] ; TM[k] = MID.bank; if (r === 1 && hash(A, B, 9) < 0.18) TEX[k] = R.bank[0]; }
        else if (d < dep + 5) { TEX[k] = (A >> 1) & 1 || hash(A >> 2, B, 7) < 0.5 ? R.foam : R.foam2; TM[k] = MID.water; }
      } else {
        if (d < dep - 1) { TEX[k] = D.tex(A, B); TM[k] = D.id; }
        else if (d < dep) { TEX[k] = D.wet; TM[k] = D.id; }
        else if (d < dep + 1) { TEX[k] = R.foam; TM[k] = MID.water; }
        else if (d < dep + 2 && hash(A >> 1, B >> 1, 8) < 0.5) { TEX[k] = R.foam2; }
      }
    } else if (style === "soft") {
      if (d < dep) { TEX[k] = D.tex(A, B); TM[k] = D.id; }
      else if (d < dep + 1 && (A + B) & 2) { TEX[k] = D.tex(A, B); TM[k] = D.id; }
    } else if (style === "curb") {
      if (up) {
        if (d < 2) { TEX[k] = d < 1 ? C("#6a7080") : C("#5a606e"); TM[k] = MID.curb; }
        else if (d < 3) TEX[k] = C("#30343e");
      } else {
        if (d < 1) { TEX[k] = C("#c4c8d2"); TM[k] = MID.curb; }
        else if (d < 2) TEX[k] = C("#30343e");
      }
    }
  }
}

// ───────────────────────────── upright details ─────────────────────────────

/** Stamp a little sprite (rows of palette digits) at screen (X, Y), only onto pixels of the allowed materials. */
function stamp(S, X, Y, rows, pal, allow) {
  const { W, H, px, mat } = S;
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const c = rows[j][i];
    if (c === ".") continue;
    const x = X + i, y = Y + j;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const o = y * W + x;
    if (!allow.includes(mat[o])) continue;
    px[o] = pal[+c];
  }
}
/** The screen position of a point inside tile (x, y): fa, fb are 0…1 along its sides. */
const spot = (S, x, y, fa, fb) => {
  const A = x * 16 + fa * 16, B = y * 16 + fb * 16;
  return [S.ox + Math.round(A - B), S.oy + Math.round((A + B) / 2)];
};
const FLOWER = ["#fffbe8", "#ffd84a", "#ff9ac0", "#9ac8ff", "#f06a7a", "#c8a0ff"].map(C);
const TUFT = ["..1../.1.1./1.1.1", "1.1/.1."];

function details(S) {
  const { m, theme } = S;
  const MT = S.MT, G = MT._grass, gm = [G.id];
  const gl = C(light(G.hex, 1.3)), gd = C(shade(G.hex, 0.82)), gL = C(light(G.hex, 1.14)), stem = C(shade(G.hex, 0.7));
  const yel = C("#f0b030");
  const free = (x, y) => m.o[y][x] === " ";
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const ch = m.g[y][x], h = (s) => hash(x, y, s);
    if (MT[ch] === G) {
      if (ch === "," || ch === ";") {
        // a clump of taller blades (ferns in the forest)
        const [X, Y] = spot(S, x, y, 0.3 + h(20) * 0.4, 0.3 + h(21) * 0.4);
        stamp(S, X - 3, Y - 6, ch === ";" || theme === "forest"
          ? ["1.....1", ".1...1.", "..1.1..", "1..1..1", ".1.2.1.", "..222.."]
          : ["..1.2..", "1.1.2.2", ".11.22.", "..121..", "...2..."], [0, gL, gd], gm);
      } else if (ch === "t") {
        // tall grass: clumps of blades standing clear of one another
        for (let i = 0; i < 5; i++) {
          const [X, Y] = spot(S, x, y, 0.15 + ((i * 0.37 + h(30 + i) * 0.3) % 0.75), 0.15 + ((i * 0.61 + h(40 + i) * 0.3) % 0.75));
          const tall = h(50 + i) > 0.5;
          stamp(S, X - 2, Y - (tall ? 8 : 6), tall
            ? ["1...2", "1..2.", ".1.2.", ".1.2.", ".1.2.", "..12.", "..12.", ".333."]
            : ["1..2", ".1.2", ".1.2", ".12.", ".12.", "333."], [0, gL, gl, gd], gm);
        }
      } else if (ch === '"') {
        for (let i = 0; i < 3; i++) {
          const [X, Y] = spot(S, x, y, 0.15 + h(30 + i) * 0.7, 0.15 + h(40 + i) * 0.7);
          const col = FLOWER[Math.floor(h(50 + i) * (theme === "forest" ? 3 : 5))];
          stamp(S, X - 1, Y - 3, [".1.", "121", ".1.", ".3."], [0, col, yel, stem], gm);
        }
      } else if (free(x, y)) {
        const k = h(70);
        const [X, Y] = spot(S, x, y, 0.25 + h(71) * 0.5, 0.25 + h(72) * 0.5);
        if (k < 0.04) stamp(S, X - 2, Y - 2, [".11.", "1221", "3333"], [0, C("#a8acba"), C("#c8ccd8"), gd], gm);           // a pebble
        else if (k < 0.08) stamp(S, X - 1, Y - 3, [".1.", "121", ".1.", ".3."], [0, FLOWER[Math.floor(h(73) * 5)], yel, stem], gm);
        else if (theme === "forest" && k < 0.13) {
          const cap = h(73) > 0.5 ? C("#d05a4e") : C("#e8b060");
          stamp(S, X - 2, Y - 4, [".11.", "1121", ".33.", ".33."], [0, cap, C("#fff4e0"), C("#f2e6cc")], gm);
        }
      }
      // drifts of flowers where the meadow grass is undisturbed
      if ((theme === "meadow" || theme === "town") && free(x, y) && ch !== "t") {
        const drift = Math.sin(x * 0.31 + y * 0.17) + Math.sin(x * 0.11 - y * 0.27) > 1.1;
        if (drift && h(101) < 0.7) for (let i = 0; i < 3; i++) {
          const [X, Y] = spot(S, x, y, 0.1 + hash(x, y, 110 + i) * 0.8, 0.1 + hash(x, y, 120 + i) * 0.8);
          stamp(S, X - 1, Y - 2, [".1.", "121", ".1."], [0, FLOWER[Math.floor(hash(x, y, 130 + i) * 6)], C("#ffe890")], gm);
        }
      }
    } else if (ch === "p" && free(x, y) && h(30) < 0.25) {
      const [X, Y] = spot(S, x, y, 0.3 + h(31) * 0.4, 0.3 + h(32) * 0.4);
      stamp(S, X - 1, Y - 1, ["12.", "333"], [0, C("#ecd0a0"), C("#c0986a"), C("#b08650")], [MID.path]);
    } else if (ch === "s" && free(x, y) && h(30) < 0.1) {
      const [X, Y] = spot(S, x, y, 0.3 + h(31) * 0.4, 0.3 + h(32) * 0.4);
      stamp(S, X - 1, Y - 1, ["11.", ".21"], [0, C("#fff4f0"), C("#f0a8b0")], [MID.sand]);
    }
  }
}

/** Glints on open water that move between the two frames. */
function glints(S, px, f) {
  const { m, W, mat, MT } = S;
  const wm = [MID.water, MID.deep], g1 = MT._water.foam, g2 = C(light(MT._water.hex, 1.32));
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.g[y][x] !== "w") continue;
    const h = hash(x, y, 5);
    for (let i = 0; i < 2; i++) {
      const ph = (Math.floor(h * 4) + f * 2 + i) % 4;
      const fa = 0.2 + ((h * 7 + i * 0.45) % 0.55), fb = 0.25 + ((h * 3 + i * 0.3) % 0.5);
      const [X, Y] = spot(S, x, y, fa, fb);
      const len = 3 + (ph & 1), dx = (f ? 2 : -1) + i;
      for (let k = 0; k < len; k++) {
        const o = (Y + (i ? 0 : 0)) * W + X + dx + k;
        if (wm.includes(mat[o])) px[o] = ph === 0 && k === 1 ? g1 : g2;
      }
    }
    if ((h * 10 + f * 3) % 4 < 1) {
      const [X, Y] = spot(S, x, y, 0.5, 0.5);
      const o = Y * W + X + (f ? 3 : -3);
      if (wm.includes(mat[o])) px[o] = C("#ffffff");
    }
  }
}

// ───────────────────────────── per-map extras ─────────────────────────────

/**
 * Things laid flat on a particular map: bridges, steps and grates (in texel
 * space, inside the tile pass), the plaza's rings and mats, lane marks and
 * puddles, the dead and the drains of the dungeons (in screen space, after).
 */
function extras(m, theme, MT) {
  const U = UG[theme];
  const at = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? null : m.g[y][x]);
  const isB = (x, y) => at(x, y) === "b";
  // each bridge runs one way: the way its ends touch land
  const axis = new Map();
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!isB(x, y) || axis.has(x + "," + y)) continue;
    const comp = [], st = [[x, y]];
    axis.set(x + "," + y, 0);
    while (st.length) {
      const [cx, cy] = st.pop(); comp.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = cx + dx + "," + (cy + dy); if (isB(cx + dx, cy + dy) && !axis.has(k)) { axis.set(k, 0); st.push([cx + dx, cy + dy]); } }
    }
    let lx = 0, ly = 0;
    const land = (c) => c !== null && c !== "w" && c !== "b" && c !== "W";
    for (const [cx, cy] of comp) { lx += land(at(cx - 1, cy)) + land(at(cx + 1, cy)); ly += land(at(cx, cy - 1)) + land(at(cx, cy + 1)); }
    const xs = comp.map((p) => p[0]), ys = comp.map((p) => p[1]);
    const ax = lx > ly || (lx === ly && Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys)) ? 1 : 2;
    for (const [cx, cy] of comp) axis.set(cx + "," + cy, ax);
  }
  const solid = (x, y) => { const c = at(x, y); return c === null || c === "W" || "CHUZTPRBF".includes(m.o[y][x]); };
  // rings around the fountain, mats where the townsfolk stand (in texels)
  const rings = [];
  for (const big of m.big || []) if (big.t === "fountain") rings.push([(big.x + 1) * 16, (big.y + 1) * 16]);
  const mats = (m.npcs || []).map((n) => [n.x * 16 + 8, n.y * 16 + 11, C({ shop: "#e07a8a", smith: "#8a90a0", elder: "#5a6ac0", train: "#b84a4a", warp: "#7a5ae0", collector: "#4a7a4a", achieve: "#d8a830", daily: "#4a8ad0", bank: "#a07a3a" }[n.role] || "#6a8a5a")]);
  const beds = [];
  for (const big of m.big || []) if (big.t === "house" && big.v < 4) beds.push([big.x * 16 + 1, (big.y + 3) * 16, 13, 4], [(big.x + 3) * 16 + 2, (big.y + 3) * 16, 13, 4]);
  const ringC = [C("#8f95a6"), C("#d6dae4")], matC = C("#f2e0b0");
  const wood = { mid: C("#b98a50"), dk: C("#7a5030"), lt: C("#d8a868"), seam: C("#6a4426"), nail: C("#5a3a22"), rail: C("#8a5a34"), railT: C("#c8935a") };

  function tile(x, y, ch, me, TEX, TM, PA, PB) {
    const isPlaza = me.id === MID.plaza || me.id === MID.grass || me.id === MID.path;
    const rs = isPlaza ? rings.filter(([cx, cy]) => Math.hypot(x * 16 + 8 - cx, y * 16 + 8 - cy) < 62) : [];
    const ms = mats.filter(([cx, cy]) => Math.abs(x * 16 + 8 - cx) < 18 && Math.abs(y * 16 + 8 - cy) < 18);
    const bs = beds.filter(([bx, by, bw, bh]) => x * 16 + 17 >= bx && x * 16 - 1 <= bx + bw && y * 16 + 17 >= by && y * 16 - 1 <= by + bh);
    if (rs.length || ms.length || bs.length) for (let k = 0; k < 256; k++) {
      const a = PA[k], b = PB[k], A = x * 16 + a, B = y * 16 + b;
      for (const [cx, cy] of rs) {
        const d = Math.hypot(A + 0.5 - cx, B + 0.5 - cy);
        if (Math.abs(d - 47) < 0.5 || Math.abs(d - 29) < 0.5) TEX[k] = ringC[0];
        else if (Math.abs(d - 48) < 0.5 || Math.abs(d - 30) < 0.5) TEX[k] = ringC[1];
        else if (d > 34 && d < 43) {
          // sixteen inlaid tiles between the rings, blue and gold
          const ang = Math.atan2(B + 0.5 - cy, A + 0.5 - cx), i = Math.round((ang / 6.2832) * 16), ia = cx + Math.cos((i / 16) * 6.2832) * 38.5, ib = cy + Math.sin((i / 16) * 6.2832) * 38.5;
          const e = Math.abs(A + 0.5 - ia) + Math.abs(B + 0.5 - ib);
          if (e < 3.2) TEX[k] = e < 2.2 ? (i & 1 ? C("#e2c486") : C("#7aa6e8")) : ringC[0];
        }
      }
      for (const [cx, cy, col] of ms) {
        if (Math.abs(A - cx) > 9 || Math.abs(B - cy) > 9) continue;
        const d = Math.hypot(A + 0.5 - cx, B + 0.5 - cy);
        if (d < 7.5) { TEX[k] = d < 2.5 || (d >= 4.5 && d < 6.5) ? col : d < 4.5 ? C(light(hexOfC(col), 1.3)) : matC; TM[k] = MID.line; }
      }
      for (const [bx, by, bw, bh] of bs) {
        if (A >= bx && A < bx + bw && B >= by && B < by + bh) { TEX[k] = A === bx || B === by ? C("#8a6a4a") : C("#5a4030"); TM[k] = MID.line; }
        else if (A >= bx - 1 && A <= bx + bw && B >= by && B <= by + bh && (B === by + bh || A === bx + bw)) TEX[k] = C("#8f6238");
      }
    }
    if (ch === "b") deck(x, y, TEX, TM, PA, PB);
    else if (ch === "v") stepsTex(x, y, me, TEX, PA, PB);
    else if (ch === "g") grate(x, y, me, TEX, PA, PB);
    else if (ch === "m") lane(x, y, TEX, PA, PB);
    if (theme === "city" && (ch === "a" || ch === "m")) zebra(x, y, TEX, PA, PB);
  }
  const hexOfC = (u) => "#" + (((u & 255) << 16) | (u & 0xff00) | ((u >> 16) & 255)).toString(16).padStart(6, "0");

  function deck(x, y, TEX, TM, PA, PB) {
    const alongX = axis.get(x + "," + y) === 1;
    const sideN = alongX ? !isB(x, y - 1) : !isB(x - 1, y), sideS = alongX ? !isB(x, y + 1) : !isB(x + 1, y);
    for (let k = 0; k < 256; k++) {
      const a = PA[k], b = PB[k];
      const along = alongX ? a : b, across = alongX ? b : a, wA = (alongX ? x : y) * 16 + along;
      let c;
      if (theme === "abyss") {
        // ribs laid across, bound with sinew along both rails
        const r = wA % 6;
        c = r === 5 ? C("#3c0e16") : r === 0 ? C("#f4f0e0") : r === 4 ? C("#a8a08a") : C("#e2dcc6");
        if ((sideN && across < 3) || (sideS && across > 12)) c = across === 1 || across === 14 ? C("#8c2c3a") : r === 5 ? C("#3c0e16") : C("#c8c0a8");
      } else if (theme === "sewer") {
        // an iron grating between two rails
        c = (along % 4 === 0 || across % 4 === 0) ? C("#2a302c") : C("#5a625c");
        if ((sideN && across < 2) || (sideS && across > 13)) c = across === 0 || across === 14 ? C("#8a948c") : C("#3a423e");
      } else {
        const r = wA % 5, plank = Math.floor(wA / 5), t = hash(plank, alongX ? y : x, 3);
        c = r === 4 ? wood.seam : t < 0.3 ? wood.lt : t > 0.8 ? wood.dk : wood.mid;
        if (r === 1 && (across === 3 || across === 12)) c = wood.nail;
        if (r !== 4 && hash(plank, across >> 2, 4) < 0.08) c = wood.seam;
        if ((sideN && across < 2) || (sideS && across > 13)) c = across === 0 || across === 14 ? wood.railT : wood.rail;
      }
      TEX[k] = c; TM[k] = MID.deck;
    }
  }
  function stepsTex(x, y, me, TEX, PA, PB) {
    const alongY = solid(x - 1, y) || solid(x + 1, y);
    const col = me.hex, nose = C(light(col, 1.16)), riser = C(shade(col, 0.7)), mid = me.base, crack = C(shade(col, 0.88));
    for (let k = 0; k < 256; k++) {
      const a = PA[k], b = PB[k], s = alongY ? b : a, t = alongY ? a : b;
      const r = s % 5;
      TEX[k] = r === 0 ? nose : r >= 3 ? riser : (hash(x * 3 + Math.floor(s / 5), t >> 2, 5) < 0.1 ? crack : mid);
      if (t === 0 || t === 15) TEX[k] = riser;
    }
  }
  function grate(x, y, me, TEX, PA, PB) {
    for (let k = 0; k < 256; k++) {
      const a = PA[k], b = PB[k];
      if (a < 2 || b < 2 || a > 13 || b > 13) continue;
      let c = C("#1c2220");
      if (a === 2 || b === 2) c = C("#8a948c");
      else if (a === 13 || b === 13) c = C("#3a423e");
      else if (a % 3 === 1) c = C("#5e6862");
      else if (b === 7) c = C("#4a524c");
      TEX[k] = c;
    }
  }
  function lane(x, y, TEX, PA, PB) {
    const alongX = at(x - 1, y) === "a" || at(x + 1, y) === "a" || at(x - 1, y) === "m";
    for (let k = 0; k < 256; k++) {
      const a = PA[k], b = PB[k], s = alongX ? a : b, t = alongX ? b : a;
      if ((t === 7 || t === 8) && s > 2 && s < 13) TEX[k] = t === 7 ? C("#e8e4d0") : C("#b8b4a0");
    }
  }
  function zebra(x, y, TEX, PA, PB) {
    const ka = (i) => { const c = at(x + i, y); return c === "k"; };
    const road = (i, j) => { const c = at(x + i, y + j); return c === "a" || c === "m"; };
    // a crossing at regular steps along each road, where the road runs between pavements
    const ns = road(0, -1) && road(0, 1) && (ka(-4) || ka(4)) && [-1, -2, -3, -4].some(ka) && [1, 2, 3, 4].some(ka);
    if (!ns || y % 9 !== 4) return;
    for (let k = 0; k < 256; k++) { const a = PA[k], b = PB[k]; if (a % 5 < 3 && b > 1 && b < 14) TEX[k] = b === 13 ? C("#b8b4a0") : C("#e8e4d0"); }
  }

  function screen(S) {
    const { W, px, mat } = S;
    // the thickness of a bridge's deck, where it stands over water toward the viewer
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.g[y][x] !== "b") continue;
      const faceC = theme === "abyss" ? [C("#a8a08a"), C("#5c1e2b")] : theme === "sewer" ? [C("#3a423e"), C("#1c2220")] : [C("#7a5030"), C("#5a3a22")];
      const X0 = S.ox + (x - y) * 16, Y0 = S.oy + (x + y) * 8;
      for (let sx = -15; sx <= 15; sx++) {
        const right = sx > 0;
        if (right ? isB(x + 1, y) || !(isWaterC(at(x + 1, y))) : isB(x, y + 1) || !isWaterC(at(x, y + 1))) continue;
        // the bottom pixel of this tile's column
        const bot = 15 - Math.ceil(Math.abs(sx - 0.5) / 2) + (sx <= 0 ? 0 : 0);
        let yb = -1;
        for (let r = 15; r >= 0; r--) { const o = (Y0 + r) * W + X0 + sx; if (mat[o] === MID.deck) { yb = r; break; } }
        if (yb < 0) continue;
        for (let r = 1; r <= 3; r++) { const o = (Y0 + yb + r) * W + X0 + sx; if (mat[o] !== MID.deck) { px[o] = faceC[r === 3 ? 1 : 0]; mat[o] = MID.line; } }
        void bot;
      }
    }
    // dungeon dead and drains, cave glow, city puddles
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
      const ch = m.g[y][x], h = (s) => hash(x, y, s), free = m.o[y][x] === " ";
      if (!free) continue;
      const [X, Y] = spot(S, x, y, 0.3 + h(5) * 0.4, 0.3 + h(6) * 0.4);
      const fl = [MID.floor];
      if (theme === "crypt" && (ch === "d" ? h(7) < 0.8 : h(7) < 0.05)) {
        if (h(8) < 0.5) stamp(S, X - 4, Y - 2, ["1......1", "21111112", "1.3333.1"], [0, C("#e8e2cc"), C("#d8d0b8"), C("#a8a08a")], fl);
        else stamp(S, X - 3, Y - 4, [".1111.", "122221", "131131", ".2222.", "..33.."], [0, C("#f4f0e0"), C("#e2dcc6"), C("#2f2a29")], fl);
      } else if (theme === "sewer" && ch === "d" && h(7) < 0.7) {
        stamp(S, X - 5, Y - 2, ["..1111..", ".122221.", "12232221", ".122221.", "..1111.."].map((r) => r + ".."), [0, C(U.wet[3]), C(U.wet[0]), C(U.wet[2])], fl);
      } else if (theme === "abyss" && ch === "d" && h(7) < 0.75) {
        if (h(8) < 0.7) stamp(S, X - 3, Y - 3, [".1111.", "122211", "123221", ".1111.", "4....4"], [0, C("#c4606a"), C("#e89aa0"), C("#fff0f0"), C(U.floor[1])], fl);
        else stamp(S, X - 4, Y - 2, ["..1111..", ".122221.", "12234221", ".122221.", "..1111.."], [0, C(U.floor[1]), C("#f4ecd8"), C("#3a0a12"), C("#ffffff")], fl);
      } else if (theme === "cave" && free) {
        if (h(9) < 0.05) stamp(S, X - 1, Y - 3, [".1.", "121", "121", ".1."], [0, h(10) > 0.5 ? C("#72e6f4") : C("#c08af4"), C("#ffffff")], fl);
        else if (h(9) < 0.1) for (let i = 0; i < 3; i++) stamp(S, X - 4 + i * 4, Y - 2 + (i & 1) * 2, [".1.", "121", ".3."], [0, C("#5ae4d0"), C("#c8fff4"), C("#dff4ff")], fl);
      } else if (theme === "city" && (ch === "a" || ch === "k") && h(90) < 0.035) {
        const neon = C(["#ff5a94", "#5ae4e4", "#ffd24a", "#7aff8a"][Math.floor(h(93) * 4)]);
        stamp(S, X - 6, Y - 2, ["...11111....", ".112222211..", "1122332222211", ".1122224211.", "...111111..."], [0, C("#2a3048"), C("#34406a"), neon, C(light("#5ae4e4", 1.3))], [MID.asph, MID.pave]);
      } else if (theme === "city" && ch === "a" && h(20) < 0.012) {
        stamp(S, X - 5, Y - 2, ["..11111..", ".1222221.", "122323221", ".1222221.", "..11111.."], [0, C("#2e303a"), C("#5a5e6c"), C("#3c404c")], [MID.asph]);
      }
    }
    // flowers in the beds by the town's doors
    for (const big of m.big || []) if (big.t === "house" && big.v < 4) for (const tx of [big.x, big.x + 3]) for (let i = 0; i < 5; i++) {
      const [X, Y] = spot(S, tx, big.y + 3, 0.12 + i * 0.17, 0.12);
      stamp(S, X - 1, Y - 3, [".1.", "121", ".3."], [0, FLOWER[(i + big.v) % 5], C("#f0b030"), C("#4faa5a")], [MID.line, MID.grass, MID.plaza, MID.path]);
    }
  }
  const isWaterC = (c) => c === "w";
  return { tile, screen };
}
