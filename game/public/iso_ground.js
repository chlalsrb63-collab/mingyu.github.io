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
import { HUE, hueAt } from "./autumn.js";

// ───────────────────────────── palettes ─────────────────────────────

/** The dungeons share bones with the cave but each has its own skin (same values as scene2d's UG). */
export const UG = {
  crypt: { floor: ["#6f6a64", "#55504c", "#8b867c"], rock: "#15121a", face: ["#4b4540", "#77705f", "#989078", "#2f2a29"], wet: ["#3d5a66", "#33505c", "#7aa0a8", "#243a44", "#5a8088"] },
  sewer: { floor: ["#5d6a5e", "#47534a", "#768476"], rock: "#0d130f", face: ["#6a4636", "#8a6048", "#aa7c5e", "#3c2820"], wet: ["#6a9a3a", "#5a8a30", "#b0dc70", "#36561e", "#8cc054"] },
  abyss: { floor: ["#7c2f3c", "#5c1e2b", "#9e4855"], rock: "#19070c", face: ["#5a1622", "#8c2c3a", "#ba4e5a", "#330e18"], wet: ["#a81c2c", "#8e1424", "#e4606c", "#560a16", "#d04858"] },
  cave: { floor: ["#486a8a", "#3c5a78", "#5a7ea0"], rock: "#131a32", face: ["#2e4468", "#4a6a98", "#5a7cac", "#223450"], wet: ["#3f8fd0", "#3478bc", "#8ad4f8", "#245a8c", "#6ab8ec"] },
};
export const GRASS = { meadow: "#6cbf5e", town: "#6cbf5e", city: "#6cbf5e", forest: "#3f8a5c", autumn: "#71843a" };
export const underground = (theme) => !!UG[theme];

/** Material ids, as stored per pixel so later passes know what they are drawing on. */
export const MID = { void: 1, grass: 2, forest: 3, path: 4, sand: 5, plaza: 6, ruin: 7, water: 8, deep: 9, bank: 10, mud: 11, steps: 12, asph: 13, pave: 14, floor: 15, deck: 16, line: 17, curb: 18, leaves: 19, gold: 20, royal: 21, blight: 22, needle: 23 };

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
  sludge: [".22./2..2/.22.", "1111/.11.", ".2./2.2/.2."].map(shape),
  asph: ["11", "22", "1/1", "111"].map(shape),
  mud: ["22", "11", "111", "3/1"].map(shape),
  flesh: ["22", "222", "2/1", "11"].map(shape),
  stone: ["1", "2", "11"].map(shape),
  // fallen leaves: little blades and lobes, each one colour, lying every which way
  leaf: ["44/.4", "55", "5./.5", "33.", ".3/3.", "11/.1", "2.2", "4/4", ".5/55"].map(shape),
  leaf2: ["22/.2", "1.1/.1.", "3/33"].map(shape),
  needle: ["1.1/.1.", "11", "3./.3", "22", ".2/2."].map(shape),
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

/** Which of a tile's 256 pixels sits at (sx + 16, sy) from its top corner, or −1. */
const KAT = new Int16Array(32 * 16).fill(-1);
TILE_PX.forEach(([sx, sy], k) => { KAT[sy * 32 + sx + 16] = k; });

/**
 * Organic ground: clusters in two layers, thicker where low noise says the
 * ground is busy. `tex(A, B)` answers for one texel; `fill(x, y, TEX)` lays a
 * whole tile at once by stamping just the clusters that touch it.
 */
function organic(m, l1, l2, seed, d1, d2, cw = 7, ch = 5) {
  let lastT = -1, busy = 1;
  const busyAt = (tx, ty) => { const t = (tx << 16) | ty; if (t !== lastT) { lastT = t; busy = 0.45 + vnoise(tx * 16 + 8, ty * 16 + 8, 40, seed) * 1.1; } return busy; };
  const tex = (A, B) => {
    const SX = A - B, SY = (A + B) >> 1, bz = busyAt(A >> 4, B >> 4);
    let k = clu(SX, SY, cw, ch, seed, d1 * bz, l1);
    if (k < 0 && l2) k = clu(SX + 3, SY + 2, cw + 4, ch + 3, seed + 7, d2 * bz, l2);
    return k < 0 ? m.pal[0] : m.pal[k];
  };
  const layer = (TEX, X0, Y0, ox, oy, cw2, ch2, sd, dens, shapes) => {
    for (let cy = Math.floor((Y0 + oy) / ch2); cy <= Math.floor((Y0 + 15 + oy) / ch2); cy++) {
      const sh0 = cy & 1 ? cw2 >> 1 : 0;
      for (let cx = Math.floor((X0 - 15 + ox + sh0) / cw2); cx <= Math.floor((X0 + 15 + ox + sh0) / cw2); cx++) {
        if (hash(cx, cy, sd) >= dens) continue;
        const sh = shapes[(hash(cx, cy, sd + 1) * shapes.length) | 0];
        const offx = (hash(cx, cy, sd + 2) * (cw2 - sh.w)) | 0, offy = (hash(cx, cy, sd + 3) * (ch2 - sh.h)) | 0;
        for (let ly = 0; ly < sh.h; ly++) for (let lx = 0; lx < sh.w; lx++) {
          const c = sh.p[ly * sh.w + lx];
          if (c < 0) continue;
          const sx = cx * cw2 + offx + lx - sh0 - ox - X0, sy = cy * ch2 + offy + ly - oy - Y0;
          if (sx < -16 || sx > 15 || sy < 0 || sy > 15) continue;
          const k = KAT[sy * 32 + sx + 16];
          if (k >= 0) TEX[k] = m.pal[c];
        }
      }
    }
  };
  const fill = (x, y, TEX) => {
    TEX.fill(m.pal[0]);
    const bz = busyAt(x, y), X0 = (x - y) * 16, Y0 = (x + y) * 8;
    if (l2) layer(TEX, X0, Y0, 3, 2, cw + 4, ch + 3, seed + 7, d2 * bz, l2);
    layer(TEX, X0, Y0, 0, 0, cw, ch, seed, d1 * bz, l1);
  };
  tex.fill = fill;
  return tex;
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

/**
 * A base texture with marks laid over it by two smooth noises (lattice cells
 * that divide 16): `pick(n1, n2, A, B)` gives a colour, or 0 to keep the base.
 */
function veined(baseTex, c1, s1, c2, s2, pick) {
  const N1 = new Float32Array(256), N2 = new Float32Array(256);
  const tex = (A, B) => pick(vnoise(A + 0.5, B + 0.5, c1, s1), vnoise(A + 0.5, B + 0.5, c2, s2), A, B) || baseTex(A, B);
  tex.fill = (x, y, TEX) => {
    if (baseTex.fill) baseTex.fill(x, y, TEX);
    else for (let k = 0; k < 256; k++) TEX[k] = baseTex(x * 16 + TILE_PX[k][2], y * 16 + TILE_PX[k][3]);
    tileNoise(x, y, c1, s1, N1, 1, false); tileNoise(x, y, c2, s2, N2, 1, false);
    for (let k = 0; k < 256; k++) { const c = pick(N1[k], N2[k], x * 16 + TILE_PX[k][2], y * 16 + TILE_PX[k][3]); if (c) TEX[k] = c; }
  };
  return tex;
}
/** Rough rock underfoot: broken plates with dark cracks between, pebbles where it is busy. */
function roughRock(m, crack, plate) {
  return veined(organic(m, SHP.pebble, null, 88, 0.42, 0, 7, 5), 8, 89, 16, 90, (n, n2) => (Math.abs(n - 0.5) < 0.03 && n2 > 0.35 ? crack : n > 0.5 && n < 0.58 && n2 > 0.5 ? plate : 0));
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
  } else if (theme === "autumn") {
    // the old kingdom's grass: olive going gold, with orange and red leaves lying in it
    grass.pal.push(C("#d07a30"), C("#b03c2c"));
    grass.tex = organic(grass, SHP.forest, SHP.grass2, 11, 0.5, 0.3);
  }
  // ── the fallen kingdom's floor: leaf litter red and gold, its royal road, the blight, pine needles
  const leaves = mk(MID.leaves, 2, "#b4622e", { pal: ["#b4622e", "#8c4228", "#d88a38", "#a0522a", "#c8382a", "#e2aa3c"], style: "soft", amp: 3.2, line: "#6a3020" });
  leaves.tex = organic(leaves, SHP.leaf, SHP.leaf2, 91, 0.78, 0.42, 5, 4);
  const goldL = mk(MID.gold, 2.5, "#d09a34", { pal: ["#d09a34", "#a8742a", "#eec458", "#bc8430", "#f4dc78", "#c86a2a"], style: "soft", amp: 3.2, line: "#7a5020" });
  goldL.tex = organic(goldL, SHP.leaf, SHP.leaf2, 93, 0.74, 0.4, 5, 4);
  const royal = mk(MID.royal, 1, "#a69c88", { pal: ["#a69c88", "#776e62", "#c6bca6", "#958b78", "#b4aa94"], amp: 2.6, depth: 2, line: "#5a5248" });
  const mossR = C("#6f8a3a"), leafR = [C("#c8502c"), C("#e0a038"), C("#a83a2a")];
  royal.tex = veined(laid(royal, 11, 7, 5, 95, { crack: true, moss: mossR }), 8, 96, 4, 97, (n, n2, A, B) => {
    // moss creeping in from the joints, and leaves blown onto the stones
    if (n > 0.74 && ((A + B) & 1 || n > 0.8) && n2 > 0.3) return mossR;
    const hh = hash(A >> 1, B >> 1, 98);
    return hh < 0.022 ? leafR[(hh * 1000) % 3 | 0] : 0;
  });
  const blight = mk(MID.blight, 6, "#4a3450", { pal: ["#4a3450", "#36263e", "#604a68"], style: "soft", amp: 3.4 });
  const vein = C("#9a5ad0"), veinL = C("#d6a0ff");
  blight.tex = veined(organic(blight, SHP.flesh, null, 99, 0.35, 0, 8, 5), 16, 100, 8, 101, (n, n2) => (Math.abs(n - 0.5) < 0.03 ? (n2 > 0.62 ? veinL : vein) : Math.abs(n2 - 0.5) < 0.035 && n > 0.55 ? vein : 0));
  const needle = mk(MID.needle, 0.5, "#5e6a36", { pal: ["#5e6a36", "#4a5430", "#76804a", "#7a5a32"], style: "soft", amp: 2.6 });
  needle.tex = organic(needle, SHP.needle, null, 103, 0.55, 0, 6, 4);
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
  const wet = U ? U.wet : theme === "autumn" ? ["#3f86b8", "#336fa0", "#80bede", "#285c8a", "#6aa8d0"] : ["#4aa2e2", "#3f8ad2", "#8accf6", "#2f78c0", "#86c8f4"];
  const water = mk(MID.water, 10, wet[0], { pal: [wet[0], wet[1], mix(wet[0], 1.08)], style: "bank", line: wet[3] });
  water.tex = theme === "sewer" ? organic(water, SHP.water, SHP.sludge, 61, 0.42, 0.3, 9, 5) : organic(water, SHP.water, null, 61, 0.2, 0, 11, 6);
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
      // brick, and grime spreading over it in patches with ragged edges
      const grime = C("#4a6a3e");
      floor.tex = veined(laid(floor, 8, 4, 4, 83), 8, 84, 4, 85, (n, n2, A, B) => (n > 0.72 && (n > 0.78 || ((A + B) & 1 && n2 > 0.4)) ? grime : 0));
    } else if (theme === "abyss") {
      // flesh: deep veins wandering through it, finer ones branching off
      const vein = C(dark), deepV = C(U.face[3]);
      floor.tex = veined(organic(floor, SHP.flesh, null, 85, 0.35, 0, 8, 5), 16, 86, 8, 87, (n, n2) => (Math.abs(n - 0.5) < 0.035 ? deepV : Math.abs(n2 - 0.5) < 0.04 && n > 0.56 ? vein : 0));
    } else {
      floor.tex = roughRock(floor, C(shade(mid, 0.72)), C(mix(mid, 1.06)));
    }
  } else {
    floor = mk(MID.floor, 4, "#486a8a", { pal: ["#486a8a", "#3c5a78", "#5a7ea0", "#4e7090", "#42627e"], straight: true, depth: 1, line: "#2a4262" });
    floor.tex = roughRock(floor, C("#34506c"), C("#4e7192"));
  }
  T = {
    ".": grass, ",": grass, '"': grass, t: grass, ":": grass, ";": grass,
    p: path, s: sand, o: plaza, r: ruin, j: mud, v: steps, w: water, b: water,
    a: asph, m: asph, k: pave, c: floor, d: floor, g: floor, n: floor, i: floor, W: rock,
    "%": leaves, "=": royal, "&": blight,
    _deep: deep, _water: water, _floor: floor, _grass: grass,
  };
  if (theme === "autumn") { T[";"] = goldL; T[":"] = needle; }
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
  const PA = Int32Array.from(TILE_PX, (p) => p[2]), PB = Int32Array.from(TILE_PX, (p) => p[3]);
  const OFF = Int32Array.from(TILE_PX, ([sx, sy]) => sy * W + sx);
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
    } else if (me.tex.fill) { me.tex.fill(x, y, TEX); TM.fill(me.id); }
    else for (let k = 0; k < 256; k++) {
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
  const t1 = performance.now();
  // 5 — upright details in screen space
  details(S);
  if (ext.screen) ext.screen(S);
  const t2 = performance.now();
  // 6 — two frames of water
  const px2 = px.slice();
  glints(S, px, 0); glints(S, px2, 1);
  const t3 = performance.now();
  const frames = [px, px2].map((d) => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(d.buffer), W, H), 0, 0);
    return c;
  });
  const t4 = performance.now();
  return { frames, ox, oy, ms: t4 - t0, parts: [t1 - t0, t2 - t1, t3 - t2, t4 - t3].map(Math.round) };
}

/** Per-texel tables for one tile: distance to each side and corner, and the rounded outer corners. */
const R0 = 8;
const DT = [], RT = [];
for (let i = 0; i < 12; i++) { DT.push(new Float32Array(256)); }
for (let k = 0; k < 256; k++) {
  const a = TILE_PX[k][2], b = TILE_PX[k][3], da = a + 0.5, db = b + 0.5, ea = 16 - da, eb = 16 - db;
  const r = (p, q) => (p < R0 && q < R0 ? R0 - Math.hypot(R0 - p, R0 - q) : 99);
  [db, ea, eb, da, Math.hypot(da, db), Math.hypot(ea, db), Math.hypot(ea, eb), Math.hypot(da, eb), r(da, db), r(ea, db), r(ea, eb), r(da, eb)].forEach((v, i) => { DT[i][k] = v; });
}
/** Smooth noise over one tile on a lattice of `cell` texels (cell divides 16). */
const LAT = new Float32Array(81);
function tileNoise(x, y, cell, seed, out, amp, add) {
  const n = 16 / cell + 1, ia = (x * 16) / cell, ib = (y * 16) / cell;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) LAT[j * n + i] = hash(ia + i, ib + j, seed);
  for (let k = 0; k < 256; k++) {
    const fa = (TILE_PX[k][2] + 0.5) / cell, fb = (TILE_PX[k][3] + 0.5) / cell, i = Math.floor(fa), j = Math.floor(fb);
    let tx = fa - i, ty = fb - j;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const p = LAT[j * n + i], q = LAT[j * n + i + 1], r = LAT[(j + 1) * n + i], t = LAT[(j + 1) * n + i + 1];
    const v = (p + (q - p) * tx) * (1 - ty) + (r + (t - r) * tx) * ty;
    out[k] = add ? out[k] + v * amp : v * amp;
  }
}
const NZ = new Float32Array(256);

/** One donor material biting into this tile. */
function fringe(D, R, x, y, nb, TEX, TM, PA, PB) {
  const has = nb.map((n) => n === D);
  const straight = D.straight || R.straight;
  const style = R.style === "bank" || R.style === "soft" ? R.style : R.style === "curb" && D.id === MID.pave ? "curb" : "lip";
  const dirs = [];
  for (let i = 0; i < 8; i++) if (has[i]) dirs.push(i);
  if (!straight) {
    if (has[0] && has[3]) dirs.push(8);
    if (has[0] && has[1]) dirs.push(9);
    if (has[1] && has[2]) dirs.push(10);
    if (has[2] && has[3]) dirs.push(11);
    tileNoise(x, y, 4, 3, NZ, D.amp, false);
    tileNoise(x, y, 2, 4, NZ, 0.9, true);
  }
  for (let k = 0; k < 256; k++) {
    let d = 99, dir = -1;
    for (let i = 0; i < dirs.length; i++) { const v = DT[dirs[i]][k]; if (v < d) { d = v; dir = dirs[i]; } }
    if (d > 9) continue;
    if (dir > 7) dir -= 4;
    const a = PA[k], b = PB[k], A = x * 16 + a, B = y * 16 + b;
    const dep = straight ? D.depth : D.depth + Math.floor(NZ[k]);
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
  // tall grass: root shadow, blade, lit blade, warm tip (highlights lean yellow)
  const TG = theme === "autumn" ? "#b89a44" : G.hex;          // the old kingdom's tall grass has gone to straw
  const tgD = C(shade(TG, 0.66)), tgL = C(shade(TG, 0.84)), tgR = C(light(TG, 1.22)), tgT = C(light(TG, 1.42));
  const fleaf = C(shade(G.hex, 0.62));
  // flower drifts change colour every few squares, smoothly enough to read as planted swathes
  const flowerFam = (x, y) => {
    const n = Math.sin(x * 0.23 + y * 0.11) * 1.3 + Math.sin(x * 0.07 - y * 0.29) + hash(x >> 2, y >> 2, 140) * 0.6;
    const k = ((Math.floor((n + 3) * 1.4) % 6) + 6) % 6;
    return theme === "forest" ? [0, 1, 2][k % 3] : [0, 2, 1, 3, 5, 4][k];
  };
  const free = (x, y) => m.o[y][x] === " ";
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const ch = m.g[y][x], h = (s) => hash(x, y, s);
    if (MT[ch] === G) {
      if (ch === "," || ch === ";") {
        // a clump of taller blades (ferns in the forest)
        const [X, Y] = spot(S, x, y, 0.3 + h(20) * 0.4, 0.3 + h(21) * 0.4);
        stamp(S, X - 3, Y - 6, ch === ";" || theme === "forest"
          ? ["1.....1", ".1...1.", "..1.1..", "1..1..1", ".1.2.1.", "..222.."]
          : ["..1.2..", "1.1.2.2", ".11.22.", "..121..", "...2..."], theme === "autumn" ? [0, C("#cc7a36"), C("#8a4428")] : [0, gL, gd], gm);
      } else if (ch === "t") {
        // tall grass: a jittered 3×2 grid of clumps, each a dark root patch with blades over it —
        // the dark bases make the stand read as one mass, the warm tips catch the light
        for (let i = 0; i < 6; i++) {
          if (h(60 + i) < 0.12) continue;
          const fa = 0.12 + (i % 3) * 0.28 + h(30 + i) * 0.16, fb = 0.14 + Math.floor(i / 3) * 0.42 + h(40 + i) * 0.22;
          const [X, Y] = spot(S, x, y, fa, fb);
          const tall = h(50 + i) > 0.45;
          stamp(S, X - 3, Y - (tall ? 8 : 6), tall
            ? ["4....4.", "1...12.", "1..12..", ".1.2.2.", ".1.22..", "..122..", "3.122.3", ".33333."]
            : ["4...4.", "1..2..", ".1.2.2", ".122..", "3122.3", ".3333."], [0, tgD, tgL, tgR, tgT], gm);
        }
      } else if (ch === '"') {
        // a flower field: blooms in drifts of one colour (with the odd stray), each on a dark leaf pair
        const fam = flowerFam(x, y);
        for (let i = 0; i < 6; i++) {
          if (h(60 + i) < 0.18) continue;
          const fa = 0.12 + (i % 3) * 0.28 + h(30 + i) * 0.14, fb = 0.12 + Math.floor(i / 3) * 0.42 + h(40 + i) * 0.2;
          const [X, Y] = spot(S, x, y, fa, fb);
          const pi = h(50 + i) < 0.78 ? fam : Math.floor(h(55 + i) * (theme === "forest" ? 3 : 6));
          stamp(S, X - 1, Y - 3, [".1.", "121", "313", ".3."], [0, FLOWER[pi], pi === 1 ? C("#e0782a") : yel, fleaf], gm);
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
      if ((theme === "meadow" || theme === "town") && free(x, y) && ch !== "t" && ch !== '"') {
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
  if (theme === "autumn") autumnDetails(S, free);
}

/**
 * The old kingdom in autumn: every tree drops its own colour of leaves round its foot (and a
 * few blow further, onto the road), little grey toadstools stand in the needles, and the blight
 * puts up violet caps with a pale eye.
 */
function autumnDetails(S, free) {
  const { m } = S;
  const onto = [MID.grass, MID.leaves, MID.gold, MID.royal, MID.path, MID.needle, MID.line];
  const LEAF = [["1", "1"], ["11"], [".1", "1."], ["1.", ".1"]];
  const fall = HUE.map((h) => h.fall.map(C));
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (!free(x, y)) continue;
    const h = (s) => hash(x, y, s);
    // the nearest tree, if one stands beside this square
    let tree = null;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) if (m.o[y + dy][x + dx] === "T") { tree = [x + dx, y + dy]; break; }
    const n = tree ? 4 + Math.floor(h(150) * 4) : m.g[y][x] === "=" ? (h(151) < 0.35 ? 2 : 0) : h(151) < 0.12 ? 1 : 0;
    const pal = tree ? fall[hueAt(m, tree[0], tree[1])] : fall[hueAt(m, x, y)];
    for (let i = 0; i < n; i++) {
      const [X, Y] = spot(S, x, y, 0.08 + hash(x, y, 160 + i) * 0.84, 0.08 + hash(x, y, 170 + i) * 0.84);
      const c = pal[Math.floor(hash(x, y, 180 + i) * pal.length)];
      stamp(S, X, Y, LEAF[Math.floor(hash(x, y, 190 + i) * LEAF.length)], [0, c], onto);
    }
    const g0 = m.g[y][x];
    if (g0 === ":" && h(152) < 0.08) {
      const [X, Y] = spot(S, x, y, 0.3 + h(153) * 0.4, 0.3 + h(154) * 0.4);
      stamp(S, X - 2, Y - 3, [".11.", "1221", ".33."], [0, C("#b8ae98"), C("#ded4bc"), C("#8a8070")], [MID.needle]);
    } else if (g0 === "&" && h(152) < 0.3) {
      const [X, Y] = spot(S, x, y, 0.3 + h(153) * 0.4, 0.3 + h(154) * 0.4);
      stamp(S, X - 2, Y - 4, [".11.", "1231", ".44.", ".44."], [0, C("#7a3a9a"), C("#b06ad8"), C("#f0e4ff"), C("#c8b8a8")], [MID.blight]);
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
    else if (ch === "n") carpet(x, y, TEX, TM, PA, PB);
    else if (ch === "i") inlay(x, y, TEX, TM, PA, PB);
    if (theme === "city" && (ch === "a" || ch === "m")) zebra(x, y, TEX, PA, PB);
  }
  const hexOfC = (u) => "#" + (((u & 255) << 16) | (u & 0xff00) | ((u >> 16) & 255)).toString(16).padStart(6, "0");

  // the run of bridge squares through (x, y) along one axis
  const runB = (x, y, dx, dy) => { let n = 1; for (let i = 1; isB(x + dx * i, y + dy * i); i++) n++; for (let i = 1; isB(x - dx * i, y - dy * i); i++) n++; return n; };
  const overWater = (x, y) => { const c = at(x, y); return c === "w" || c === "W"; };
  function deck(x, y, TEX, TM, PA, PB) {
    // planks run across the leg this square belongs to (an L-shaped bridge turns at its corner)
    const rx = runB(x, y, 1, 0), ry = runB(x, y, 0, 1);
    const alongX = rx !== ry ? rx > ry : axis.get(x + "," + y) === 1;
    // a rail on every edge that faces the drop; the ends, where the bridge meets land, stay open
    const wN = overWater(x, y - 1), wS = overWater(x, y + 1), wW = overWater(x - 1, y), wE = overWater(x + 1, y);
    for (let k = 0; k < 256; k++) {
      const a = PA[k], b = PB[k];
      const along = alongX ? a : b, across = alongX ? b : a, wA = (alongX ? x : y) * 16 + along;
      // distance to the nearest railed edge; `lit` = a north or west rail (light from the upper left)
      let d = 99, lit = true;
      if (wN && b < d) d = b;
      if (wW && a < d) d = a;
      if (wS && 15 - b < d) { d = 15 - b; lit = false; }
      if (wE && 15 - a < d) { d = 15 - a; lit = false; }
      let c;
      if (theme === "abyss") {
        // ribs laid across, bound with sinew along both rails
        const r = wA % 6;
        c = r === 5 ? C("#3c0e16") : r === 0 ? C("#f4f0e0") : r === 4 ? C("#a8a08a") : C("#e2dcc6");
        if (d < 3) c = d === 1 ? C("#8c2c3a") : r === 5 ? C("#3c0e16") : C("#c8c0a8");
      } else if (theme === "crypt") {
        // slabs of stone with a low kerb either side
        const r = wA % 8, t = hash(Math.floor(wA / 8), across >> 3, 6);
        c = r === 7 ? C("#55504c") : r === 0 ? C("#a8a294") : t < 0.3 ? C("#8b867c") : C("#7d786e");
        if (d < 3) c = d === 1 ? C("#989080") : (d === 0) === lit ? C("#b8b2a4") : C("#4b4540");
      } else if (theme === "sewer") {
        // an iron grating between two rails
        c = (along % 4 === 0 || across % 4 === 0) ? C("#2a302c") : C("#5a625c");
        if (d < 2) c = (d === 0) === lit ? C("#8a948c") : C("#3a423e");
      } else {
        const r = wA % 5, plank = Math.floor(wA / 5), t = hash(plank, alongX ? y : x, 3);
        c = r === 4 ? wood.seam : t < 0.3 ? wood.lt : t > 0.8 ? wood.dk : wood.mid;
        if (r === 1 && (across === 3 || across === 12)) c = wood.nail;
        if (r !== 4 && hash(plank, across >> 2, 4) < 0.08) c = wood.seam;
        if (d < 2) c = (d === 0) === lit ? wood.railT : wood.rail;
      }
      TEX[k] = c; TM[k] = MID.deck;
    }
  }
  // a chapel's runner: wine-red, a gold border where it ends, a row of lozenges down the middle
  const isN = (x, y) => at(x, y) === "n";
  const CAR = { edge: C("#2f2a29"), gold: C("#c8a050"), goldD: C("#8a6a34"), wine: C("#7a2a3a"), wineD: C("#5a1e2c"), wineL: C("#a04850") };
  function carpet(x, y, TEX, TM, PA, PB) {
    const alongX = isN(x - 1, y) || isN(x + 1, y);
    const eN = !isN(x, y - 1), eS = !isN(x, y + 1), eW = !isN(x - 1, y), eE = !isN(x + 1, y);
    for (let k = 0; k < 256; k++) {
      const a = PA[k], b = PB[k];
      let d = 99;
      if (eN) d = Math.min(d, b);
      if (eW) d = Math.min(d, a);
      if (eS) d = Math.min(d, 15 - b);
      if (eE) d = Math.min(d, 15 - a);
      const along = alongX ? a : b, across = alongX ? b : a;
      let c;
      if (d === 0) c = CAR.edge;
      else if (d === 1) c = CAR.gold;
      else if (d === 2) c = CAR.goldD;
      else {
        const u = Math.abs(across - 7.5), v = Math.abs((along % 8) - 3.5);
        const q = u / 1.6 + v;
        c = q < 1.2 ? CAR.gold : q < 3.4 ? CAR.wineL : q < 4.4 ? CAR.wineD : CAR.wine;
      }
      TEX[k] = c; TM[k] = MID.line;
    }
  }
  // an octagon's floor: a ring of brass set in the stone round a rosette of pale and dark marble
  const inl = new Map();
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (at(x, y) !== "i" || inl.has(x + "," + y)) continue;
    const comp = [], st = [[x, y]], key = (a, b) => a + "," + b;
    const rec = {};
    inl.set(key(x, y), rec);
    while (st.length) {
      const [cx, cy] = st.pop(); comp.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(cx + dx, cy + dy) === "i" && !inl.has(key(cx + dx, cy + dy))) { inl.set(key(cx + dx, cy + dy), rec); st.push([cx + dx, cy + dy]); }
    }
    rec.cx = comp.reduce((s, p) => s + p[0], 0) / comp.length * 16 + 8;
    rec.cy = comp.reduce((s, p) => s + p[1], 0) / comp.length * 16 + 8;
    let R = Infinity;
    for (const [cx, cy] of comp) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(cx + dx, cy + dy) !== "i") R = Math.min(R, Math.hypot((cx + dx) * 16 + 8 - rec.cx, (cy + dy) * 16 + 8 - rec.cy) - 8);
    rec.R = Math.max(12, R);
  }
  const INL = { edge: C("#2f2a29"), brass: C("#c8a050"), brassD: C("#8a6a34"), pale: C("#aca696"), mid: C("#78726a"), dark: C("#4b4540") };
  function inlay(x, y, TEX, TM, PA, PB) {
    const rec = inl.get(x + "," + y);
    if (!rec) return;
    const R = rec.R, ri = Math.max(6, (R - 4) * 0.42);
    for (let k = 0; k < 256; k++) {
      const A = x * 16 + PA[k] + 0.5, B = y * 16 + PB[k] + 0.5, d = Math.hypot(A - rec.cx, B - rec.cy), e = R - d;
      if (e < 0) continue;
      let c;
      if (e < 1) c = INL.edge;
      else if (e < 2) c = INL.brass;
      else if (e < 3) c = INL.brassD;
      else if (e < 4) c = INL.edge;
      else if (d < ri - 1.5) c = INL.dark;
      else if (d < ri) c = INL.brass;
      else {
        // sixteen petals, pale and darker by turns
        const t = ((Math.atan2(B - rec.cy, A - rec.cx) / 6.2832) * 16 + 16) % 16;
        c = Math.floor(t) & 1 ? INL.mid : INL.pale;
      }
      TEX[k] = c; TM[k] = MID.line;
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
      const faceC = theme === "abyss" ? [C("#a8a08a"), C("#5c1e2b")] : theme === "sewer" ? [C("#3a423e"), C("#1c2220")] : theme === "crypt" ? [C("#6a645c"), C("#3a3632")] : [C("#7a5030"), C("#5a3a22")];
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
      if (theme === "crypt" && (ch === "d" ? h(7) < 0.8 : ch === "c" && h(7) < 0.05)) {
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
