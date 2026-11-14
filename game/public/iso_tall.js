/**
 * What stands up, seen from the diagonal: rock walls, cliffs, hedges, ruined
 * walls, the city's concrete, fences, houses and towers.
 *
 * Every solid tile is a block on its diamond: a top face lifted by its height
 * and the two faces that look toward the viewer (+y on the left, +x on the
 * right). A face is only drawn where the neighbour on that side is lower, a
 * back edge is only inked where nothing of the same kind continues behind, so
 * runs of blocks read as one wall. Light comes from the upper left: tops are
 * lightest, left faces middle, right faces darkest, and the convex front edges
 * of a top get a one-pixel highlight. A building is modelled whole (walls, a
 * roof, a chimney) with a depth buffer, outlined, then cut into upright strips
 * — one per tile along its front edges — so every strip sorts against people
 * walking past it like any other tile.
 */
import { hash, vnoise, C, mix, tone, shade, light, Buf, COL, texA, texB } from "./iso_px.js";
import { UG, GRASS, materials, levels } from "./iso_ground.js";

const INK = C("#2b2233");
/** Heights (pixels) of what stands up. */
const WALL_H = { cave: 26, crypt: 26, sewer: 24, abyss: 26 };
const HEIGHT = { C: 20, H: 13, Z: 28, W: 12 };

// ───────────────────────────── one block ─────────────────────────────

/**
 * A block of height h on one tile. `nh` gives the height of the joined
 * neighbour on each side [−y, +x, +y, −x] (0 where nothing joins), `nd` the
 * one diagonally in front (+x+y). `top(a, b)` and `face(side, s, z)` colour
 * the top's texels and the faces' pixels (side 2 = left/+y, 1 = right/+x; s
 * runs 0…15 along the face, z up from the ground). `E` is spare room above.
 */
function block(o) {
  const h = o.h, E = o.E || 0, buf = new Buf(32, h + 16 + E);
  const [n0, n1, n2, n3] = o.nh, nd = o.nd || 0;
  for (let sx = -15; sx <= 15; sx++) {
    const [t0, t1] = COL[sx], X = sx + 16;
    for (let r = t0; r <= t1; r++) {
      const a = texA(sx, r), b = texB(sx, r);
      let c = o.top(a, b);
      if ((b === 0 && n0 < h) || (a === 0 && n3 < h)) c = o.backInk === undefined ? INK : o.backInk(a, b, c);
      else if ((b === 15 && n2 < h) || (a === 15 && n1 < h)) c = o.hi ? o.hi(a, b, c) : c;
      buf.px(X, r + E, c);
    }
    const sL = texA(sx, t1), sR = texB(sx, t1);
    for (let z = 0; z < h; z++) {
      const row = t1 - z + h + E;
      let side;
      if (sx < 0) side = z >= n2 ? 2 : 0;
      else if (sx > 0) side = z >= n1 ? 1 : 0;
      else side = z >= n2 ? 2 : z >= n1 ? 1 : z >= nd ? 3 : 0;
      if (!side) continue;
      let c;
      if (side === 3) c = o.seam || INK;
      else {
        c = o.face(side, side === 2 ? sL : sR, z);
        if (z === 0 && !o.noBase) c = INK;
        else if ((sx === -15 && z >= n3) || (sx === 15 && z >= n0)) c = INK;
      }
      buf.px(X, row, c);
    }
  }
  if (o.after) o.after(buf, E);
  const cv = buf.canvas();
  const piece = { img: cv, dx: -16, dy: -h - E };
  // a cut-down stump of the same block, for a renderer that lowers walls standing in front of someone
  if (!o.isLow && h > LOW_H) {
    let low = null;
    Object.defineProperty(piece, "low", {
      enumerable: false,
      get: () => low || (low = block({ ...o, isLow: true, h: LOW_H, E: 0, after: null, nh: o.nh.map((n) => (n ? LOW_H : 0)), nd: o.nd ? LOW_H : 0 })),
    });
  }
  return piece;
}
const LOW_H = 6;

// ───────────────────────────── the kinds ─────────────────────────────

/** Stone laid in courses on a face: course height ch, block width bw, every other course shifted half a block. */
function coursed(s, z, ch, bw, seed, v) {
  const row = Math.floor(z / ch), s2 = s + (row & 1 ? bw >> 1 : 0) + 16, col = Math.floor(s2 / bw);
  const ls = s2 - col * bw, lz = z - row * ch;
  return { seam: lz === 0 || ls === 0, top: lz === ch - 1, t: hash(col + v * 7, row, seed), ls, lz, row, col };
}
/** Three tones of a face colour, shifted toward violet on the side away from the light. */
function faces(mid, lit, dark) {
  return {
    2: [C(mid), C(lit), C(dark), C(mix(mid, 0.92))],
    1: [C(shade(mid, 0.8)), C(shade(lit, 0.82)), C(shade(dark, 0.8)), C(shade(mid, 0.74))],
  };
}

const PAL = {};
function pal(theme) {
  if (PAL[theme]) return PAL[theme];
  const U = UG[theme] || UG.cave;
  const [base, top, hi, seam] = U.face;
  const P = {
    rock: C(U.rock), cap: C(top), cap2: C(base), capHi: C(hi),
    F: theme === "cave" ? faces("#3a5680", "#5a7cac", "#223450") : faces(top, hi, seam),
    deep: C(theme === "cave" ? "#1a2848" : shade(base, 0.7)),
  };
  return (PAL[theme] = P);
}

/** A wall of the underground, by theme. */
function wallFace(theme, P, x, y, v) {
  const F = P.F;
  if (theme === "crypt") return (side, s, z) => {
    const k = coursed(s, z, 6, 8, 3, v), f = F[side];
    if (k.seam) return f[2];
    if (k.top) return f[1];
    return k.t < 0.2 ? f[3] : f[0];
  };
  if (theme === "sewer") return (side, s, z) => {
    const k = coursed(s, z, 4, 8, 5, v), f = F[side];
    // slime runs down from the top where the damp gets in
    const run = hash(x * 16 + s, side, 61) < 0.12 ? 3 + Math.floor(hash(x * 16 + s, side, 62) * 12) : 0;
    if (run && z >= 24 - run - 3) return z === 24 - run - 3 ? C("#6a9a3a") : C("#4f7a3a");
    if (k.seam) return f[2];
    if (k.top) return f[1];
    return k.t < 0.25 ? f[3] : f[0];
  };
  if (theme === "abyss") return (side, s, z) => {
    const f = F[side], ws = (side === 2 ? x : y) * 16 + s;
    const n = vnoise(ws, z, 6, 41 + side);
    if (Math.abs(n - 0.5) < 0.05) return f[2];
    if (n > 0.72) return f[1];
    return (ws + z) % 7 === 0 && n < 0.3 ? f[3] : f[0];
  };
  // cave rock: broken planes, each its own tone, split by dark cracks
  return (side, s, z) => {
    const ws = (side === 2 ? x : y) * 16 + s;
    if (z < 2) return F[side][2];
    return facet(F[side], ws, z, 31 + side * 0);
  };
}

/**
 * Rock as broken planes: a jittered grid of seeds in face space (u along the
 * face, z up), each plane a flat tone, dark cracks where two planes meet and a
 * lit lip along the top of each plane.
 */
function cellOf(u, z, seed) {
  const cu = Math.floor(u / 7), cz = Math.floor(z / 6);
  let b1 = 1e9, b2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gu = cu + i, gz = cz + j;
    const pu = gu * 7 + hash(gu, gz, seed) * 7, pz = gz * 6 + hash(gu, gz, seed + 1) * 6;
    const d = (u - pu) * (u - pu) + (z - pz) * (z - pz) * 1.7;
    if (d < b1) { b2 = b1; b1 = d; id = gu * 7919 + gz; } else if (d < b2) b2 = d;
  }
  return [id, Math.sqrt(b2) - Math.sqrt(b1)];
}
function facet(f, u, z, seed) {
  const [id, gap] = cellOf(u + 0.5, z + 0.5, seed);
  if (gap < 0.9) return f[2];
  const up = cellOf(u + 0.5, z + 1.5, seed)[0];
  if (up !== id) return f[1];
  const t = hash(id, 0, seed + 2);
  return t < 0.3 ? f[3] : t > 0.8 ? f[1] : f[0];
}

/** Decorations that stand out from a dungeon wall: crystals, a skull in a niche, an eye, teeth. */
function wallDeco(theme, h, x, y, v, faceL, faceR) {
  return (buf, E) => {
    if (!faceL && !faceR) return;
    const side = faceL && (!faceR || v & 1) ? 2 : 1;
    // a point on the chosen face, s along it and z up from the ground
    const at = (s, z) => {
      const sx = side === 2 ? -15 + s : 1 + s, [, t1] = COL[sx];
      return [sx + 16, t1 - z + h + E];
    };
    const k = hash(x, y, 91);
    if (theme === "cave" && k < 0.3) {
      const col = k < 0.15 ? ["#72e6f4", "#3aa8c8", "#ffffff"] : ["#c08af4", "#8a58c8", "#ffffff"];
      const s0 = 4 + Math.floor(hash(x, y, 92) * 6), z0 = 6 + Math.floor(hash(x, y, 93) * 8);
      for (const [ds, dz, len] of [[0, 0, 7], [2, -1, 5], [-2, 1, 4]]) for (let i = 0; i < len; i++) {
        const [X, Y] = at(s0 + ds, z0 + dz + i);
        buf.px(X, Y, C(col[0])); buf.px(X + 1, Y, C(col[1])); if (i === len - 1) buf.px(X, Y - 1, C(col[2]));
      }
      const [X, Y] = at(s0, z0 + 3); buf.px(X, Y, C(col[2]));
    } else if (theme === "crypt" && k < 0.16) {
      // a niche with a skull in it
      const s0 = 4, z0 = 8;
      for (let i = 0; i < 8; i++) for (let j = 0; j < 9; j++) { const [X, Y] = at(s0 + i, z0 + j); buf.px(X, Y, C("#1f1b1e")); }
      const sk = ["..111..", ".11111.", "1211211", ".11111.", "..1.1.."];
      sk.forEach((row, j) => [...row].forEach((c2, i) => { if (c2 === ".") return; const [X, Y] = at(s0 + 1 + i, z0 + 6 - j); buf.px(X, Y, c2 === "1" ? C("#e2dcc6") : C("#2f2a29")); }));
    } else if (theme === "abyss" && k < 0.18) {
      const s0 = 4 + Math.floor(hash(x, y, 92) * 4), z0 = 9;
      const eye = [".1111.", "122221", "123321", "122221", ".1111."];
      eye.forEach((row, j) => [...row].forEach((c2, i) => { if (c2 === ".") return; const [X, Y] = at(s0 + i, z0 + 4 - j); buf.px(X, Y, [0, C("#330e18"), C("#f4ecd8"), C("#c41830")][+c2]); }));
    } else if (theme === "abyss" && k > 0.88) {
      // a row of teeth along the foot of the wall
      for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) {
        const w = j < 2 ? 3 : j < 4 ? 2 : 1;
        for (let q = 0; q < w; q++) { const [X, Y] = at(1 + i * 5 + q + (3 - w + 1) / 2 | 0, 1 + j); buf.px(X, Y, q === 0 ? C("#f8f2e0") : C("#d8ccb0")); }
      }
    }
  };
}

// ───────────────────────────── houses and towers ─────────────────────────────

const ROOF = ["#d8604c", "#5a86cc", "#62a86c", "#9a70c8"];
const NEON = ["#ff5a94", "#5ae4e4", "#ffd24a", "#7aff8a"];
const BWALL = ["#6c7284", "#7c665a", "#5c687c", "#6c5c80"];

/**
 * A little 3D canvas: points (A, B, z) in texels and pixels, painted with a
 * depth buffer (nearer = larger A + B + z), then outlined.
 */
class Model {
  constructor(w, h, ox, oy) { this.buf = new Buf(w, h); this.z = new Float32Array(w * h).fill(-1e9); this.ox = ox; this.oy = oy; }
  put(A, B, z, c, bias = 0) {
    const a = Math.floor(A), b = Math.floor(B);
    const X = this.ox + a - b, Y = this.oy + ((a + b) >> 1) - Math.round(z);
    if (X < 0 || Y < 0 || X >= this.buf.w || Y >= this.buf.h) return;
    const i = Y * this.buf.w + X, d = A + B + z + bias;
    if (d >= this.z[i]) { this.z[i] = d; this.buf.d[i] = c; }
  }
  /** Outline the silhouette in ink, one pixel outside. */
  ink() {
    const { w, h, d } = this.buf, src = d.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x]) continue;
      if ((x > 0 && src[y * w + x - 1]) || (x < w - 1 && src[y * w + x + 1]) || (y > 0 && src[(y - 1) * w + x]) || (y < h - 1 && src[(y + 1) * w + x])) d[y * w + x] = INK;
    }
  }
}

/** A town house: timber-framed walls on a stone footing, a gabled roof along x, a chimney. */
function townHouse(v, seed) {
  const FW = 64, FD = 48, HW = 30, RISE = 22, EAVE = 4;
  const roof = ROOF[v % 4], rC = C(roof), rD = C(shade(roof, 0.74)), rL = C(light(roof, 1.14)), rLine = C(shade(roof, 0.6)), rRidge = C(light(roof, 1.3));
  const wall = C("#f6ecd2"), wallR = C(shade("#f6ecd2", 0.84)), beam = C("#8a5a34"), beamR = C(shade("#8a5a34", 0.8));
  const stone = C("#b8b0a4"), stoneR = C(shade("#b8b0a4", 0.82)), stoneS = C("#958d82"), stoneL = C("#d6cec2");
  const glass = C("#bfe6f4"), glassL = C("#dff4fc"), shut = C(roof), box = C("#b8844e");
  const top = HW + RISE + 16, M = new Model(FW + FD + 24, top + (FW + FD) / 2 + 16, FD + 12, top + 6);
  // walls — the left face is the front (+y), the right face the gable end (+x)
  for (let A = 0; A < FW; A++) for (let z = 0; z < HW; z++) {
    let c = wall;
    if (z < 6) c = z === 5 ? stoneL : (z === 2 && A % 2) || (A + (z < 3 ? 4 : 0)) % 9 === 0 ? stoneS : stone;
    else if (A % 21 === 0 || A === FW - 1 || z === 6 || z === HW - 1 || (z === 18 && (A < 20 || A > 44))) c = beam;
    // the door, in the middle of the front
    const dA = A - 27;
    if (dA >= 0 && dA < 10 && z >= 1 && z < 21) c = dA === 0 || dA === 9 || z === 20 ? beam : dA === 4 ? C("#96623a") : z === 19 ? C("#c8935a") : (dA === 7 && z === 10) ? C("#f0cc60") : C("#b27a44");
    // windows with shutters either side and a box of flowers under
    for (const w0 of [7, 47]) {
      const wa = A - w0;
      if (wa >= -3 && wa < 13 && z >= 10 && z < 21) {
        if (wa < 0 || wa >= 10) c = wa === -3 || wa === 12 ? shut : (z % 3 ? shut : C(shade(roof, 0.8)));
        else c = wa === 0 || wa === 9 || z === 10 || z === 20 || wa === 4 || z === 15 ? beam : z > 17 ? glassL : glass;
      }
      if (wa >= -1 && wa < 11 && z >= 7 && z < 10) c = z === 9 ? C(["#f06a7a", "#fffbe8", "#f0c040"][(A + v) % 3]) : box;
    }
    // the trade's sign over the door
    if (dA >= 1 && dA < 9 && z >= 22 && z < 28) c = z === 22 || z === 27 || dA === 1 || dA === 8 ? beam : C("#f2e0b0");
    M.put(A, FD - 1, z, c);
  }
  // the trade's mark on the sign
  const mark = [[C("#f078a8"), C("#d8f0ff")], [C("#7a8294"), C("#5a6070")], [C("#f0b030"), C("#f0b030")], [C("#8ab4f0"), C("#f2e0b0")]][v % 4];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) M.put(29 + 1 + i, FD - 1, 23 + j, (i + j) % 2 ? mark[0] : mark[1], 0.5);
  for (let B = 0; B < FD; B++) for (let z = 0; z < HW; z++) {
    let c = wallR;
    if (z < 6) c = z === 5 ? C(shade("#d6cec2", 0.84)) : (B + (z < 3 ? 4 : 0)) % 9 === 0 ? C(shade("#958d82", 0.8)) : stoneR;
    else if (B === 0 || B === FD - 1 || B === 24 || z === 6 || z === HW - 1) c = beamR;
    const wb = B - 17;
    if (wb >= 0 && wb < 14 && z >= 11 && z < 21) c = wb === 0 || wb === 13 || z === 11 || z === 20 || wb === 7 ? beamR : C(shade("#bfe6f4", 0.86));
    M.put(FW - 1, B, z, c);
  }
  // the gable: a triangle of wall above the right face, crossed with timber
  for (let B = 0; B < FD; B++) {
    const peak = Math.round(RISE * (1 - Math.abs(B + 0.5 - FD / 2) / (FD / 2 + EAVE)));
    for (let z = HW; z < HW + peak; z++) {
      const c = Math.abs(B + 0.5 - FD / 2) < 1 || z === HW || (z - HW) === Math.round(Math.abs(B + 0.5 - FD / 2) * 0.5) ? beamR : wallR;
      M.put(FW - 1, B, z, c);
    }
  }
  // the roof: shingles in rows along the ridge, eaves overhanging all round
  const half = FD / 2 + EAVE;
  for (let A = -2; A < FW + 2; A += 0.5) for (let B = -EAVE; B < FD + EAVE; B += 0.5) {
    const off = Math.abs(B + 0.5 - FD / 2), z = HW - 2 + RISE * (1 - off / half);
    const front = B + 0.5 > FD / 2, row = Math.floor(off / 3.5), ra = (Math.floor(A) + (row % 2) * 3) % 6;
    let c = front ? rC : rL;
    if (off < 1) c = rRidge;
    else if (off > half - 1.5) c = rLine;
    else if ((off % 3.5) < 0.6) c = front ? rD : C(shade(roof, 0.86));
    else if (ra === 0) c = front ? rD : C(shade(roof, 0.9));
    if (A < -1 || A >= FW + 1) c = rLine;
    M.put(A, B, z, c, 2);
  }
  // a chimney on the back slope
  const cA = 44 + (seed % 3) * 4, cB = 10;
  for (let A = cA; A < cA + 7; A++) for (let B = cB; B < cB + 7; B++) {
    const off = Math.abs(B + 0.5 - FD / 2), zr = HW - 2 + RISE * (1 - off / half);
    for (let z = Math.floor(zr) - 2; z < HW + RISE + 8; z++) {
      const face = A === cA + 6 ? 1 : B === cB + 6 ? 2 : 0;
      let c = face === 1 ? C("#9c8e80") : face === 2 ? C("#b8a898") : C("#8a7e72");
      if (z >= HW + RISE + 6) c = face ? C("#8a7e72") : C("#3a302c");
      else if (face && (z + (face === 1 ? B : A)) % 5 === 0) c = C("#8a7e72");
      M.put(A, B, z, c, 3);
    }
  }
  M.ink();
  return M;
}

/** A city tower: a tall box of windows, a shop front at the bottom of the front face, a flat roof with its plant. */
function cityTower(v, seed) {
  const FW = 64, FD = 48, H = 64 + Math.floor(hash(seed, v, 3) * 4) * 12;
  const wall = BWALL[v % 4], neon = NEON[v % 4];
  const wL = C(wall), wLl = C(light(wall, 1.1)), wLd = C(shade(wall, 0.86)), wR = C(shade(wall, 0.78)), wRd = C(shade(wall, 0.68));
  const top = H + 20, M = new Model(FW + FD + 24, top + (FW + FD) / 2 + 16, FD + 12, top + 6);
  const win = (s, z, f) => {
    // a grid of windows over the shop floor
    if (z < 22 || z > H - 6) return 0;
    const ws = s % 8, wz = (z - 22) % 10, cell = Math.floor(s / 8) * 31 + Math.floor((z - 22) / 10);
    if (ws === 0 || ws === 7 || wz < 3 || wz > 8) return wz === 2 && ws > 0 && ws < 7 ? (f ? wLl : C(light(wall, 1.0))) : 0;
    const on = hash(cell, f, seed + 7) > 0.45;
    const lit = hash(cell, f, seed + 9) > 0.5 ? "#ffd880" : "#a8e4ff";
    if (!on) return wz === 8 && ws < 4 ? C("#48506a") : C("#30364a");
    return wz === 8 ? C("#fff4d0") : ws === 3 ? C("#20232c") : C(f ? lit : shade(lit, 0.82));
  };
  for (let A = 0; A < FW; A++) for (let z = 0; z < H; z++) {
    let c = z === H - 1 ? wLl : (z - 22) % 20 === 19 ? wLd : wL;
    const w = win(A, z, 1); if (w) c = w;
    // the shop front: a band of neon, a striped awning, a shutter, two display windows
    if (z < 22) {
      if (z >= 18) c = z === 21 || z === 18 ? C("#181a22") : (A > 3 && A < 60 && (A % 12 < 9)) ? C(neon) : C("#181a22");
      else if (z >= 15) c = (A >> 2) % 2 ? C("#f4f4f8") : C(neon);
      else if (A >= 24 && A < 40) c = z === 14 ? C("#181a22") : z % 3 === 0 ? C("#444a5a") : C("#262a36");
      else if ((A >= 4 && A < 20) || (A >= 44 && A < 60)) c = z === 14 || A === 4 || A === 19 || A === 44 || A === 59 ? C("#20232c") : z > 10 ? C("#58789a") : z < 6 && (A % 16 < 6) ? C(neon) : C("#3a5a7a");
      else c = z < 2 ? wLd : wL;
    }
    M.put(A, FD - 1, z, c);
  }
  for (let B = 0; B < FD; B++) for (let z = 0; z < H; z++) {
    let c = z === H - 1 ? wR : (z - 22) % 20 === 19 ? wRd : wR;
    const w = win(B, z, 0); if (w) c = w;
    if (z < 22) c = z < 2 ? wRd : (B >= 8 && B < 40 && z >= 4 && z < 16) ? (z === 15 || B === 8 || B === 39 ? C("#20232c") : C(shade("#3a5a7a", 0.8))) : wR;
    // a vertical sign hanging off the corner
    if (B >= 2 && B < 6 && z >= 26 && z < 54) c = B === 2 || B === 5 || z === 26 || z === 53 ? C("#181a22") : (z % 6 < 4 ? C(neon) : C(light(neon, 1.4)));
    M.put(FW - 1, B, z, c);
  }
  // the roof: a parapet round a flat top, a water tank and a box of plant
  for (let A = 0; A < FW; A++) for (let B = 0; B < FD; B++) {
    const edge = A < 2 || B < 2 || A > FW - 3 || B > FD - 3;
    M.put(A, B, edge ? H + 2 : H, edge ? (A < 1 || B < 1 ? C("#6a7288") : C("#4a5064")) : ((A >> 2) + (B >> 2)) % 2 ? C("#3a3e4a") : C("#363a46"));
    if (edge) for (let z = H; z < H + 2; z++) M.put(A, B, z, A > FW - 3 ? C("#3a3e4a") : C("#4a5064"));
  }
  const boxAt = (a0, b0, w, d, h, cT, cL, cR) => {
    for (let A = a0; A < a0 + w; A++) for (let B = b0; B < b0 + d; B++) for (let z = H; z <= H + h; z++) M.put(A, B, z, z === H + h ? cT : A === a0 + w - 1 ? cR : B === b0 + d - 1 ? cL : cT, 1);
  };
  boxAt(10 + (seed % 4) * 4, 8, 14, 10, 8, C("#7a8298"), C("#565e72"), C("#3e4454"));
  if (hash(seed, v, 5) > 0.4) {
    // a water tank on legs
    const a0 = 40, b0 = 24;
    for (const [la, lb] of [[0, 0], [8, 0], [0, 8], [8, 8]]) for (let z = H; z < H + 8; z++) M.put(a0 + la, b0 + lb, z, C("#3a3c48"), 1);
    for (let A = a0; A < a0 + 9; A++) for (let B = b0; B < b0 + 9; B++) {
      if (Math.hypot(A - a0 - 4, B - b0 - 4) > 4.6) continue;
      for (let z = H + 8; z < H + 20; z++) M.put(A, B, z, z === H + 19 ? C("#a87444") : (A - a0) > 5 ? C("#6a4226") : (z % 4 === 0 ? C("#6a4226") : C("#8a5a34")), 2);
    }
  }
  M.ink();
  return M;
}

// ───────────────────────────── the town's named buildings (docs/design/town.md D) ─────────────────────────────
//
// One model for every building: walls on a stone plinth (timber-framed, coursed stone or logs), a window in
// every tile of each face that has no door, the door where the map says (`door` "s" on the front, "e" on the
// right face, `dx` tiles along), a gable, hip or round roof, a chimney; then each style adds what makes it
// read at a glance — the hall's clock gable and banners, the library's round tower, the forge's tall chimney,
// the store's striped awning, the lodge's shields, the lab's copper dome. Sizes come from the footprint
// (16 texels a tile), so a building is exactly as wide as the ground it blocks.

/** wall, timber (null: stone or logs), plinth height and colour, wall height, storeys, roof colour and shape, rise, eaves, chimney. */
const BSTYLE = {
  hall: { wall: "#efe2c4", beam: "#6a4a2e", plinth: 9, stone: "#aaa496", HW: 38, floors: 1, roof: "#5e8a4a", kind: "hip", rise: 24, eave: 5, chim: 0 },
  library: { wall: "#c9c3b3", beam: null, plinth: 5, stone: "#9a9486", HW: 32, floors: 1, roof: "#566a9a", kind: "gable", rise: 22, eave: 4, chim: 0 },
  dojo: { wall: "#e6d2a6", beam: "#5a3a22", plinth: 6, stone: "#a8a090", HW: 22, floors: 1, roof: "#a8542e", kind: "hip", rise: 16, eave: 8, chim: 0 },
  store: { wall: "#eed8aa", beam: "#7a5030", plinth: 5, stone: "#b0a898", HW: 28, floors: 1, roof: "#c8743a", kind: "gable", rise: 20, eave: 4, chim: 1 },
  smithy: { wall: "#a29c90", beam: null, plinth: 28, stone: "#8e887c", HW: 28, floors: 1, roof: "#4e586c", kind: "gable", rise: 18, eave: 4, chim: 2 },
  merc: { wall: "#7a5034", beam: null, logs: 1, plinth: 5, stone: "#8a8478", HW: 28, floors: 1, roof: "#4a3a30", kind: "gable", rise: 20, eave: 5, chim: 1 },
  lab: { wall: "#dcc79c", beam: "#6a4a30", plinth: 5, stone: "#a8a090", HW: 28, floors: 1, roof: "#4a9a86", kind: "hip", rise: 12, eave: 3, chim: 3 },
  diner: { wall: "#f2d9a8", beam: "#7a4a2c", plinth: 5, stone: "#b0a898", HW: 30, floors: 1, roof: "#c8443a", kind: "gable", rise: 22, eave: 4, chim: 1 },
  cafe: { wall: "#f6ecd4", beam: "#a87a54", plinth: 4, stone: "#c0b8a8", HW: 28, floors: 1, roof: "#3a9a9a", kind: "gable", rise: 20, eave: 4, chim: 0 },
  inn: { wall: "#f0e2c0", beam: "#6a4a2e", plinth: 5, stone: "#a8a090", HW: 44, floors: 2, roof: "#3a64b8", kind: "gable", rise: 22, eave: 5, chim: 1 },
  boutique: { wall: "#f6dce2", beam: "#c88a9a", plinth: 4, stone: "#c8bcb8", HW: 28, floors: 1, roof: "#e07aa0", kind: "hip", rise: 16, eave: 4, chim: 0 },
  pet: { wall: "#f2e8c8", beam: "#8a6a3a", plinth: 4, stone: "#b0a898", HW: 20, floors: 1, roof: "#6aa84a", kind: "round", rise: 22, eave: 5, chim: 0 },
  apt: { wall: "#e8d4aa", beam: "#6a4a2e", plinth: 5, stone: "#a8a090", HW: 58, floors: 3, roof: "#8a5a3a", kind: "gable", rise: 18, eave: 4, chim: 1 },
  home: { wall: "#f6ecd2", beam: "#8a5a34", plinth: 5, stone: "#b8b0a4", HW: 26, floors: 1, roof: "#d8604c", kind: "gable", rise: 20, eave: 4, chim: 1 },
  barn: { wall: "#a8503a", beam: "#5a2e22", plinth: 3, stone: "#8a8478", HW: 30, floors: 1, roof: "#6a4a3a", kind: "gable", rise: 26, eave: 4, chim: 0 },
};
const FLOWERS = ["#f06a7a", "#fffbe8", "#f0c040", "#c8a0ff"];

/**
 * A named building `b` ({ k, w, h, door, dx }): the model, and where its lit windows, sign, smoke and
 * glow sit, as pixel offsets from the footprint's top corner.
 */
function building(b) {
  const S = BSTYLE[b.k] || BSTYLE.home, FW = b.w * 16, FD = b.h * 16, HW = S.HW, seed = b.x * 7 + b.y * 13;
  const roof = S.roof, rise = S.rise, eave = S.eave;
  const tall = HW + rise + 48, M = new Model(FW + FD + 40, tall + (FW + FD) / 2 + 24, FD + 20, tall + 6);
  const at = (A, B, z) => [A - B, ((A + B) >> 1) - z];
  const info = { wins: [], sign: null, smoke: [], glow: [], lamps: [] };
  const wallC = [C(S.wall), C(shade(S.wall, 0.82))], beamC = S.beam ? [C(S.beam), C(shade(S.beam, 0.8))] : null;
  const stoneC = [C(S.stone), C(shade(S.stone, 0.82)), C(shade(S.stone, 0.72)), C(light(S.stone, 1.12))];
  const glass = [C("#bfe6f4"), C("#dff4fc"), C(shade("#bfe6f4", 0.86))], shut = C(shade(roof, 0.85));
  const doorFace = b.door === "e" ? 1 : b.door === "s" ? 0 : -1;
  const dA0 = b.dx >= 0 ? b.dx * 16 + 16 : -999;   // the door's centre along its face
  const SH = Math.max(14, Math.floor((HW - S.plinth) / S.floors));
  /** One face's colour at (s along it, z up); f 0 front (+y), 1 right (+x). */
  const face = (f, s, z) => {
    const L = f === 0 ? FW : FD, d = f;
    // the door: a plank door in a frame, a step of stone, a lamp either side for the wide ones
    if (f === doorFace && Math.abs(s + 0.5 - dA0) < (b.k === "barn" ? 18 : 8) && z < (b.k === "barn" ? 26 : 22)) {
      const u = s + 0.5 - dA0, w = b.k === "barn" ? 18 : 8, top = b.k === "barn" ? 25 : 21;
      if (b.k === "barn") return z === top || Math.abs(u) > w - 1.5 ? beamC[d] : z < 12 && Math.abs(u + 6) < 5 ? C(z === 11 ? "#c8945a" : "#9a6a3a") : C("#2a1e22");
      if (Math.abs(u) > w - 1.5 || z === top) return beamC ? beamC[d] : stoneC[2];
      if (z === 0) return stoneC[3];
      return Math.abs(u) < 0.6 ? C("#7a4a2a") : u > 4 && u < 5.5 && z === 10 ? C("#f0cc60") : C(z === top - 1 ? "#c8935a" : "#a8703e");
    }
    // the plinth: stone in courses
    if (z < S.plinth) {
      const k = coursed(s, z, 4, 9, 30 + d, seed);
      return k.seam ? stoneC[2] : k.top && z === S.plinth - 1 ? stoneC[3] : k.t < 0.2 ? stoneC[1] : stoneC[d];
    }
    // windows: one per tile on each face, every storey, none where the door is
    const ti = Math.floor(s / 16), ws = s - ti * 16, storey = Math.floor((z - S.plinth) / SH), wz = z - S.plinth - storey * SH;
    const doorTile = f === doorFace && Math.abs(ti * 16 + 8 - dA0) < 12;
    const big = b.k === "diner" && f === 0 && !doorTile && storey === 0;
    const wx0 = big ? 2 : 4, wx1 = big ? 14 : 12, wz0 = 6, wz1 = Math.min(SH - 4, 15);
    if (!doorTile && storey < S.floors && !(b.k === "barn") && ws >= wx0 - 2 && ws < wx1 + 2 && wz >= wz0 - 1 && wz < wz1 + 1 && ti * 16 + 16 <= L) {
      if (ws < wx0 || ws >= wx1) return wz >= wz0 && wz < wz1 && !big ? shut : beamC ? beamC[d] : stoneC[2];
      if (wz === wz0 - 1 || wz === wz1) return beamC ? beamC[d] : stoneC[2];
      if (b.k === "lab" && wz === wz0) return C(FLOWERS[(ti + s) % 4]);
      return ws === ((wx0 + wx1) >> 1) || wz === ((wz0 + wz1) >> 1) ? (beamC ? beamC[d] : stoneC[2]) : wz > wz1 - 3 ? glass[1] : f ? glass[2] : glass[0];
    }
    // a box of flowers under each window
    if (!doorTile && storey < S.floors && wz === wz0 - 2 && ws >= wx0 - 1 && ws < wx1 + 1 && b.k !== "barn" && b.k !== "smithy" && b.k !== "merc" && ti * 16 + 16 <= L) return C(FLOWERS[(ti + storey + b.x) % 4]);
    if (!doorTile && storey < S.floors && wz === wz0 - 3 && ws >= wx0 - 1 && ws < wx1 + 1 && b.k !== "barn" && b.k !== "smithy" && b.k !== "merc" && ti * 16 + 16 <= L) return C("#8a5a34");
    // the walls themselves
    if (S.logs) { const r = (z - S.plinth) % 5; return r === 0 ? C(shade(S.wall, d ? 0.62 : 0.72)) : r === 1 ? C(light(S.wall, d ? 0.96 : 1.14)) : wallC[d]; }
    if (!beamC) {
      const k = coursed(s, z, 5, 10 + (seed % 3), 40 + d, seed);
      if (k.seam) return C(shade(S.wall, d ? 0.66 : 0.76));
      if (b.k === "library" && hash(Math.floor(s / 3), Math.floor(z / 3), seed) < 0.12 + 0.3 * (z < 14 ? 1 : 0) * hash(s >> 3, 0, 9)) return C(hash(s, z, 3) < 0.5 ? "#5a9a4a" : "#7abf5a");
      return k.t < 0.18 ? C(shade(S.wall, d ? 0.76 : 0.9)) : k.t > 0.88 ? C(light(S.wall, 1.06)) : wallC[d];
    }
    // timber framing: posts at the corners and every tile, a rail at each floor and under the eaves
    if (s === 0 || s === L - 1 || ws === 0 || z === S.plinth || z === HW - 1 || (z - S.plinth) % SH === 0) return beamC[d];
    if (b.k === "barn" && (ws === 8 || (Math.abs((ws - 8) - (wz - 8)) < 1 && wz > 2 && wz < SH - 2))) return beamC[d];
    return wallC[d];
  };
  for (let A = 0; A < FW; A++) for (let z = 0; z < HW; z++) M.put(A, FD - 1, z, face(0, A, z));
  for (let B = 0; B < FD; B++) for (let z = 0; z < HW; z++) M.put(FW - 1, B, z, face(1, B, z));
  // where the windows are, for the lamps behind them at night
  for (const [f, L] of [[0, FW], [1, FD]]) for (let ti = 0; ti * 16 + 16 <= L; ti++) {
    if (b.k === "barn" || (f === doorFace && Math.abs(ti * 16 + 8 - dA0) < 12)) continue;
    for (let st = 0; st < S.floors; st++) {
      const z = S.plinth + st * SH + 10, s = ti * 16 + 8;
      info.wins.push(f === 0 ? at(s, FD, z) : at(FW, s, z));
    }
  }
  // the roof
  const cA = FW / 2, cB = FD / 2, half = Math.min(FW, FD) / 2 + eave;
  const rC = C(roof), rD = C(shade(roof, 0.74)), rL = C(light(roof, 1.14)), rLine = C(shade(roof, 0.6)), rRidge = C(light(roof, 1.3)), rS = C(shade(roof, 0.86));
  const grass = b.k === "pet";
  for (let A = -eave; A < FW + eave; A += 0.5) for (let B = -eave; B < FD + eave; B += 0.5) {
    const oB = Math.abs(B + 0.5 - cB), oA = Math.abs(A + 0.5 - cA);
    let off, side;
    if (S.kind === "gable") { if (A < -2 || A >= FW + 2) continue; off = oB; side = B + 0.5 > cB ? 0 : 2; }
    else { const eA = oA - Math.max(0, (FW - FD) / 2), eB = oB - Math.max(0, (FD - FW) / 2); off = Math.max(eA, eB); side = eB >= eA ? (B + 0.5 > cB ? 0 : 2) : A + 0.5 > cA ? 1 : 3; }
    if (off > half) continue;
    const k = off / half, z = HW - 2 + (S.kind === "round" ? rise * Math.sqrt(Math.max(0, 1 - k * k)) : rise * (1 - k));
    const row = Math.floor(off / 3.5), ra = (Math.floor(side % 2 ? B : A) + (row % 2) * 3) % 6;
    let c = side === 0 ? rC : side === 1 ? rS : rL;
    if (grass) c = hash(Math.floor(A / 2), Math.floor(B / 2), seed) < 0.3 ? C(light(roof, 1.2)) : hash(Math.floor(A), Math.floor(B), 7) < 0.15 ? C(shade(roof, 0.7)) : side === 1 ? rS : side === 0 ? rC : rL;
    else if (off < 1 && S.kind === "gable") c = rRidge;
    else if (off > half - 1.5) c = rLine;
    else if (off % 3.5 < 0.6) c = side === 0 ? rD : C(shade(roof, 0.86));
    else if (ra === 0) c = side === 0 ? rD : C(shade(roof, 0.9));
    if (S.kind === "gable" && (A < -1 || A >= FW + 1)) c = rLine;
    M.put(A, B, z, c, 2);
  }
  // a gable end above the right face
  if (S.kind === "gable") for (let B = 0; B < FD; B++) {
    const o = Math.abs(B + 0.5 - cB), peak = Math.round(rise * (1 - o / half));
    for (let z = HW; z < HW + peak; z++) M.put(FW - 1, B, z, o < 1 || z === HW || (beamC && (z - HW) === Math.round(o * 0.5)) ? (beamC ? beamC[1] : stoneC[2]) : S.logs ? (z % 5 === 0 ? C(shade(S.wall, 0.62)) : wallC[1]) : wallC[1]);
  }
  const box = (a0, b0, z0, w, d, h, top, cl, cr) => {
    for (let A = a0; A < a0 + w; A++) for (let B = b0; B < b0 + d; B++) for (let z = z0; z < z0 + h; z++) {
      M.put(A, B, z, z === z0 + h - 1 ? top : A === a0 + w - 1 ? cr : B === b0 + d - 1 ? cl : top, 3);
    }
  };
  // chimneys: a stone stack, the forge's tall one, the lab's copper pipe
  if (S.chim) {
    const cAa = S.chim === 2 ? FW - 20 : FW - 18 - (seed % 3) * 4, cBb = S.chim === 2 ? 6 : 8, w = S.chim === 2 ? 10 : 7;
    const top = HW + rise + (S.chim === 2 ? 22 : S.chim === 3 ? 10 : 6);
    const col = S.chim === 3 ? ["#c87a3a", "#a8602a", "#e0a060"] : ["#8a7e72", "#9c8e80", "#b8a898"];
    box(cAa, cBb, HW - 4, w, w, top - HW + 4, C(col[0]), C(col[2]), C(col[1]));
    for (let A = cAa + 1; A < cAa + w - 1; A++) for (let B = cBb + 1; B < cBb + w - 1; B++) M.put(A, B, top, C(S.chim === 2 ? "#ff8a3a" : "#3a302c"), 4);
    info.smoke.push(at(cAa + w / 2, cBb + w / 2, top + 2));
    if (S.chim === 2) info.glow.push(at(cAa + w / 2, cBb + w / 2, top + 2));
  }
  // the sign: a plank on a bracket beside the door (scene2d hangs the icon on it)
  if (doorFace >= 0) {
    const s = dA0 - 14, z = 24;
    info.sign = doorFace === 0 ? at(s, FD + 3, z) : at(FW + 3, s, z);
    // a lamp over the door, lit at night
    info.lamps.push(doorFace === 0 ? at(dA0, FD + 2, 24) : at(FW + 2, dA0, 24));
  }
  extras(b, S, M, FW, FD, HW, rise, seed, info, at, box);
  M.ink();
  return { M, info };
}

/** What makes each building read at a glance. */
function extras(b, S, M, FW, FD, HW, rise, seed, info, at, box) {
  const put = (A, B, z, c) => M.put(A, B, z, C(c), 4);
  const disc = (A0, z0, r, col, B = FD, edge = null) => { for (let a = -r; a <= r; a++) for (let z = -r; z <= r; z++) if (a * a + z * z <= r * r + 0.5) put(A0 + a, B, z0 + z, edge && a * a + z * z > (r - 1) * (r - 1) ? edge : col); };
  if (b.k === "hall") {
    // the clock gable over the door, two banners, twin lanterns
    const cA = b.dx * 16 + 16;
    for (let a = -14; a <= 14; a++) for (let z = HW - 2; z < HW + 16 - Math.abs(a); z++) put(cA + a, FD + 1, z, Math.abs(a) > 12 - (z - HW) ? "#6a4a2e" : "#efe2c4");
    disc(cA, HW + 4, 5, "#f6f0dc", FD + 2, "#6a4a2e"); put(cA, FD + 3, HW + 5, "#2b2233"); put(cA, FD + 3, HW + 6, "#2b2233"); put(cA + 1, FD + 3, HW + 4, "#2b2233");
    for (const a of [cA - 26, cA + 22]) for (let z = 10; z < 30; z++) for (let i = 0; i < 5; i++) put(a + i, FD + 1, z, z < 12 && (i === 0 || i === 4) ? "#3a6ac8" : z === 20 && i === 2 ? "#f0cc60" : i === 2 && z > 18 && z < 23 ? "#f0cc60" : z < 12 ? "#2b2233" : "#3a6ac8");
    for (const a of [cA - 11, cA + 11]) { put(a, FD + 2, 22, "#f0cc60"); put(a, FD + 2, 21, "#ffe8a0"); put(a, FD + 2, 23, "#5a3a22"); info.lamps.push(at(a, FD + 2, 22)); }
  } else if (b.k === "library") {
    // a round stone tower at the west end with a slate cone, an owl-eye window
    const tA = 14, tB = FD / 2, R = 13, top = HW + 18;
    for (let a = -R; a <= R; a++) for (let bb = -R; bb <= R; bb++) {
      const d = Math.hypot(a, bb);
      if (d > R) continue;
      for (let z = 0; z < top; z++) if (d > R - 1.5) { const k = coursed(Math.round(Math.atan2(bb, a) * 14), z, 5, 7, 77, 3); put(tA + a, tB + bb, z, k.seam ? "#7a7466" : a + bb > 4 ? "#a8a294" : "#c4beae"); }
      for (let z = top; z < top + 26 * (1 - d / (R + 3)); z++) put(tA + a, tB + bb, z, (a + bb > 0 ? "#3e4e7e" : "#5a6c9e"));
    }
    disc(tA + 6, top - 10, 4, "#ffe8a0", tB + 11, "#5a4a3a"); put(tA + 5, tB + 12, top - 10, "#2b2233"); put(tA + 7, tB + 12, top - 10, "#2b2233");
    info.wins.push(at(tA + 6, tB + 11, top - 10));
  } else if (b.k === "dojo") {
    // banner poles at the front corners, long red banners
    for (const a of [2, FW - 3]) for (let z = 0; z < HW + 18; z++) { put(a, FD + 4, z, "#5a3a22"); if (z > HW - 6 && z < HW + 14) for (let i = 1; i < 6; i++) put(a + i, FD + 4, z, z === HW + 2 ? "#f0e0b0" : "#b83a2e"); }
  } else if (b.k === "store") {
    // a striped awning over the front, barrels' worth of colour
    for (let A = 4; A < FW - 4; A++) for (let B = FD; B < FD + 9; B++) put(A, B, HW - 8 - (B - FD) * 0.8, Math.floor(A / 6) % 2 ? "#f6ecd2" : "#d84c4c");
  } else if (b.k === "merc") {
    // round shields on the front wall
    [[16, "#a83a3a"], [FW - 34, "#3a5a9a"], [FW - 16, "#c8a040"]].forEach(([a, c]) => { disc(a, 18, 5, c, FD + 1, "#4a3a30"); put(a, FD + 2, 18, "#d8d0c0"); });
  } else if (b.k === "lab") {
    // a copper dome with a patina'd lantern
    const dA = FW * 0.35, dB = FD / 2, R = 13;
    for (let a = -R; a <= R; a++) for (let bb = -R; bb <= R; bb++) {
      const d = Math.hypot(a, bb); if (d > R) continue;
      const z = HW + 6 + Math.sqrt(R * R - d * d);
      put(dA + a, dB + bb, z, a + bb > 3 ? "#a8602a" : a + bb < -6 ? "#e0a060" : "#c87a3a");
    }
    for (let z = HW + 18; z < HW + 24; z++) for (const [a, bb] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(dA + a, dB + bb, z, z === HW + 23 ? "#9affc8" : "#4a9a86");
  } else if (b.k === "inn") {
    // a star lantern over the door
    const s = b.dx * 16 + 16, B = s;
    for (const [i, j] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [0, 2], [0, -2], [2, 0], [-2, 0]]) M.put(FW + 3, B + i, 28 + j, C(Math.abs(i) + Math.abs(j) > 1 ? "#f0c040" : "#fff4b0"), 5);
    info.lamps.push(at(FW + 3, B, 28));
  } else if (b.k === "boutique") {
    // a bay window on the front with a mannequin in it
    const a0 = Math.floor(FW / 2) - 12;
    for (let A = a0; A < a0 + 24; A++) for (let B = FD; B < FD + 5; B++) for (let z = 4; z < 22; z++) {
      const edge = A === a0 || A === a0 + 23 || z === 4 || z === 21;
      if (B === FD + 4 || A === a0 || A === a0 + 23) put(A, B, z, edge ? "#c88a9a" : A > a0 + 9 && A < a0 + 14 && z > 6 && z < 18 ? (z > 15 ? "#f0d8c8" : "#e07aa0") : "#cfeaf4");
    }
    for (let A = a0 - 1; A < a0 + 25; A++) for (let B = FD; B < FD + 6; B++) put(A, B, 22, "#e07aa0");
  } else if (b.k === "apt") {
    // balconies on the upper floors
    const SH = Math.floor((HW - S.plinth) / S.floors);
    for (let f = 1; f < S.floors; f++) { const z = S.plinth + f * SH; for (let A = 2; A < FW - 2; A++) for (let B = FD; B < FD + 4; B++) { put(A, B, z, "#8a5a34"); if (B === FD + 3 && A % 3 === 0) for (let zz = z; zz < z + 5; zz++) put(A, B, zz, "#6a4226"); if (B === FD + 3) put(A, B, z + 5, "#a8743e"); } }
  } else if (b.k === "home") {
    // a mailbox on a post by the door, a little "내 집" plaque over it
    const a = b.dx * 16 + 34;
    for (let z = 0; z < 10; z++) put(a, FD + 5, z, "#6a4226");
    for (let A = a - 2; A < a + 3; A++) for (let z = 10; z < 14; z++) put(A, FD + 5, z, z === 13 ? "#e86a5a" : "#c84a3a");
    for (let A = b.dx * 16 + 10; A < b.dx * 16 + 22; A++) for (let z = 23; z < 27; z++) put(A, FD, z, z === 23 || z === 26 ? "#6a4226" : "#f2e0b0");
  } else if (b.k === "barn") {
    // crates stacked inside the open doors
    const cA = b.dx >= 0 ? b.dx * 16 + 16 : FW / 2;
    for (const [a, z, c] of [[cA - 12, 0, "#b8844e"], [cA - 4, 0, "#a8743e"], [cA - 10, 7, "#c8945a"], [cA + 6, 0, "#b8844e"]]) for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) put(a + i, FD - 3, z + j, i === 0 || j === 6 || i === 6 ? "#6a4226" : c);
  } else if (b.k === "cafe") {
    // a chalkboard menu on the wall by the door
    const a = b.dx * 16 + 34;
    for (let A = a; A < a + 8; A++) for (let z = 4; z < 16; z++) put(A, FD + 1, z, A === a || A === a + 7 || z === 4 || z === 15 ? "#8a5a34" : (z === 12 || z === 9) && A > a + 1 && A < a + 6 ? "#f6ecd4" : "#2e3a34");
  } else if (b.k === "diner") info.steam = at(FW - 12, 6, HW + rise - 4);
  if (b.k === "lab") info.puff = at(FW * 0.35, FD / 2, HW + 24);
}

/** Cut a building into strips, one per tile along its two front edges; returns pieces keyed "x,y". */
function slice(M, big) {
  const out = new Map(), { buf } = M;
  const fw = big.w || 4, fh = big.h || 3;
  // the footprint's top corner in the model's pixels
  const X0 = M.ox, Y0 = M.oy;
  // tile (bx + i, by + j) has its top corner at column X0 + (i − j)·16; it owns the
  // columns of its lower edges that lie on the footprint's front
  const cx = (i, j) => X0 + (i - j) * 16;
  const strips = [], c0 = cx(fw - 1, fh - 1);
  for (let i = 0; i < fw; i++) strips.push([big.x + i, big.y + fh - 1, i ? cx(i, fh - 1) - 15 : 0, cx(i, fh - 1) + 1]);
  strips[fw - 1][3] = fh > 1 ? c0 + 17 : buf.w;
  for (let k = 1; k < fh; k++) strips.push([big.x + fw - 1, big.y + fh - 1 - k, c0 + 1 + 16 * k, k === fh - 1 ? buf.w : c0 + 17 + 16 * k]);
  for (const [tx, ty, xa, xb] of strips) {
    const w = xb - xa;
    if (w <= 0) continue;
    let y0 = buf.h, y1 = -1;
    for (let y = 0; y < buf.h; y++) for (let x = xa; x < xb; x++) if (buf.d[y * buf.w + x]) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (y1 < 0) continue;
    const part = new Buf(w, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) for (let x = xa; x < xb; x++) part.d[(y - y0) * w + (x - xa)] = buf.d[y * buf.w + x];
    // this tile's top corner in the model: footprint corner + (tx − bx − (ty − by))·16, (…)·8
    const tx0 = cx(tx - big.x, ty - big.y), ty0 = Y0 + (tx - big.x + ty - big.y) * 8;
    out.set(tx + "," + ty, { img: part.canvas(), dx: xa - tx0, dy: y0 - ty0 });
  }
  return out;
}

// ───────────────────────────── fences ─────────────────────────────

function fence(mask, city, v) {
  const h = 12, E = 0, buf = new Buf(32, 16 + h + 2);
  const post = city ? [C("#5a5e6c"), C("#7a8294"), C("#3e4250")] : [C("#d8ac6e"), C("#f2d8a4"), C("#a87a44")];
  const rail = city ? [C("#6a7288"), C("#8a92a8"), C("#3e4250")] : [C("#d8ac6e"), C("#ecc88c"), C("#a87a44")];
  const base = h + 2;
  const P = (a, b) => [16 + a - b, base + ((a + b) >> 1)];
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const pts = [];
  // rails run from the middle of the tile to the middle of each joined edge
  const runs = [];
  for (let i = 0; i < 4; i++) if (mask & (1 << i)) runs.push(dirs[i]);
  if (!runs.length) runs.push([1, 0], [-1, 0]);
  // back runs first so the front ones overlap them
  runs.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
  for (const [dx, dy] of runs) {
    for (let t = 0; t <= 8; t += 0.5) {
      const a = 8 + dx * t, b = 8 + dy * t;
      const [X, Y] = P(Math.floor(a), Math.floor(b));
      for (const zr of city ? [3, 9] : [4, 9]) {
        buf.px(X, Y - zr, rail[1]); buf.px(X, Y - zr + 1, rail[0]); buf.px(X, Y - zr + 2, rail[2]);
      }
      if (city && Math.floor(t * 2) % 6 === 0) for (let z = 3; z < 10; z++) buf.px(X, Y - z, rail[0]);
    }
    pts.push([8 + dx * 8, 8 + dy * 8]);
  }
  // the post in the middle, and posts at the far ends of rails heading away from the viewer
  const postAt = (a, b, tall) => {
    const [X, Y] = P(a, b);
    for (let z = 0; z < tall; z++) { buf.px(X - 1, Y - z, post[1]); buf.px(X, Y - z, post[0]); buf.px(X + 1, Y - z, post[2]); }
    buf.px(X - 1, Y - tall, post[1]); buf.px(X, Y - tall, post[1]); buf.px(X + 1, Y - tall, post[0]);
  };
  postAt(8, 8, h);
  // outline what was drawn
  const src = buf.d.slice();
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < 32; x++) {
    if (src[y * 32 + x]) continue;
    if ((x > 0 && src[y * 32 + x - 1]) || (x < 31 && src[y * 32 + x + 1]) || (y > 0 && src[(y - 1) * 32 + x]) || (y < buf.h - 1 && src[(y + 1) * 32 + x])) buf.d[y * 32 + x] = INK;
  }
  void E; void v; void pts;
  return { img: buf.canvas(), dx: -16, dy: -base };
}

// ───────────────────────────── per map ─────────────────────────────

const perMap = new WeakMap();
const KINDS = "CHUZFW";

function stateOf(m, theme) {
  let S = perMap.get(m);
  if (!S || S.theme !== theme) { S = { theme, pieces: new Map(), houses: new Map(), built: new Set(), info: new Map(), cache: new Map() }; perMap.set(m, S); }
  return S;
}
export function tall(m, x, y, theme) {
  const S = stateOf(m, theme);
  const key = x + "," + y;
  if (S.pieces.has(key)) return S.pieces.get(key);
  const p = make(m, x, y, theme, S);
  S.pieces.set(key, p);
  return p;
}
/** The house or named building standing over tile (x, y), or null. */
const bigAt = (m, x, y) => (m.big || []).find((b) => (b.t === "house" || b.t === "bld") && x >= b.x && x < b.x + (b.w || 4) && y >= b.y && y < b.y + (b.h || 3));
/** A house or named building modelled and cut into strips (once, the first time one of its tiles is asked for). */
function raise(S, big) {
  if (S.built.has(big)) return;
  S.built.add(big);
  const seed = big.x * 7 + big.y * 13;
  let M;
  if (big.t === "bld") { const r = building(big); M = r.M; S.info.set(big, r.info); }
  else M = big.v >= 4 ? cityTower(big.v, seed) : townHouse(big.v, seed);
  for (const [k, p] of slice(M, big)) S.houses.set(k, p);
}
/**
 * Where a named building's windows, sign, lamps, smoke and glow sit: pixel offsets from its footprint's top
 * corner (builds the model if it is not yet). scene2d lights the windows at night and hangs the sign.
 */
export function bldInfo(m, big, theme) {
  const S = stateOf(m, theme);
  raise(S, big);
  return S.info.get(big) || null;
}

function make(m, x, y, theme, S) {
  const g = (i, j) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? null : m.g[j][i]);
  const o = (i, j) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? null : m.o[j][i]);
  const ch = o(x, y), gr = g(x, y);
  if (ch === "h") {
    const big = bigAt(m, x, y);
    if (!big) return null;
    raise(S, big);
    return S.houses.get(x + "," + y) || null;
  }
  if (gr === "W" && ch === " ") return rockWall(m, x, y, theme, S, g);
  if (!KINDS.includes(ch)) return null;
  const same = (i, j) => o(i, j) === ch;
  if (ch === "F") {
    const mask = (same(x, y - 1) ? 1 : 0) | (same(x + 1, y) ? 2 : 0) | (same(x, y + 1) ? 4 : 0) | (same(x - 1, y) ? 8 : 0);
    // the town's palisade stands on the blight it keeps out: sharpened logs, lashed together
    if (theme === "town" && gr === "&") {
      const k = "PAL" + mask + ((x * 3 + y * 5) % 4);
      if (!S.cache.has(k)) S.cache.set(k, palisade(mask, (x * 3 + y * 5) % 4));
      return S.cache.get(k);
    }
    const k = "F" + mask + theme;
    if (!S.cache.has(k)) S.cache.set(k, fence(mask, theme === "city", 0));
    return S.cache.get(k);
  }
  if (ch === "W") {
    const hW = (i, j) => (o(i, j) === "W" ? HEIGHT.W : 0);
    return stoneWall(m, x, y, theme, [hW(x, y - 1), hW(x + 1, y), hW(x, y + 1), hW(x - 1, y)], hW(x + 1, y + 1));
  }
  // the cave's shelf rims stand as tall as their level (m.lv): a low step, a high wall of rock
  const L = ch === "C" ? levels(m) : null;
  const hOf = (i, j) => (o(i, j) !== ch ? 0 : ch === "U" ? ruinH(i, j) : L ? (L[j * m.w + i] >= 2 ? 30 : 16) : HEIGHT[ch]);
  const h = hOf(x, y);
  const nh = [hOf(x, y - 1), hOf(x + 1, y), hOf(x, y + 1), hOf(x - 1, y)], nd = hOf(x + 1, y + 1);
  if (ch === "C") return cliff(m, x, y, theme, h, nh, nd);
  if (ch === "H") return hedge(x, y, h, nh, nd);
  if (ch === "U") return ruin(x, y, h, nh, nd);
  if (ch === "Z") return concrete(x, y, h, nh, nd, S);
  return null;
}

const ruinH = (x, y) => [10, 14, 18, 18, 22][Math.floor(hash(x, y, 17) * 5)];

/** Rock that stands over open floor: a block whose top is the dark of the deep, capped where it meets the floor. */
function rockWall(m, x, y, theme, S, g) {
  const isW = (i, j) => { const c = g(i, j); return c === null || c === "W"; };
  const open = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => !isW(x + [0, 1, 0, -1, -1, 1, 1, -1][i], y + [-1, 0, 1, 0, -1, -1, 1, 1][i]));
  if (!open.some(Boolean)) return null;
  const h = WALL_H[theme] || 26;
  const nh = [0, 1, 2, 3].map((i) => (open[i] ? 0 : h)), nd = open[6] ? 0 : h;
  const v = Math.floor(hash(x, y, 9) * 4);
  const P = pal(theme);
  const key = "W" + theme + open.map(Number).join("") + v + (x % 2) + (y % 2) + Math.floor(hash(x, y, 91) * 8);
  if (theme !== "abyss" && theme !== "cave" && S.cache.has(key)) return S.cache.get(key);
  const face = wallFace(theme, P, x, y, v);
  // the cap: a band of lit stone along every edge that looks out over the floor
  const top = (a, b) => {
    let d = 9;
    if (open[0]) d = Math.min(d, b); if (open[1]) d = Math.min(d, 15 - a); if (open[2]) d = Math.min(d, 15 - b); if (open[3]) d = Math.min(d, a);
    if (open[4]) d = Math.min(d, Math.max(a, b)); if (open[5]) d = Math.min(d, Math.max(15 - a, b)); if (open[6]) d = Math.min(d, Math.max(15 - a, 15 - b)); if (open[7]) d = Math.min(d, Math.max(a, 15 - b));
    return d <= 1 ? P.cap : d === 2 ? P.cap2 : d === 3 ? P.deep : P.rock;
  };
  const p = block({
    h, nh, nd, top, face, E: theme === "cave" ? 2 : 0, seam: P.F[1][2],
    hi: () => P.capHi,
    after: wallDeco(theme, h, x, y, v, open[2], open[1]),
  });
  if (theme !== "abyss" && theme !== "cave") S.cache.set(key, p);
  return p;
}

/**
 * A rise with a rock face (maps-v2): out of doors grey stone under a grass lip, moss growing over it in
 * patches (thicker in the forest); in the cave a grey shelf of bare rock, moss trailing from its edge, the
 * odd jade crystal in a crack, as tall as the shelf's level.
 */
function cliff(m, x, y, theme, h, nh, nd) {
  if (theme === "cave") return caveShelf(m, x, y, h, nh, nd);
  const G = materials(theme)._grass, gHex = GRASS[theme] || GRASS.meadow;
  const lip = C(light(gHex, 1.2)), gD = C(shade(gHex, 0.72));
  const F = faces("#8e9390", "#b0b5b0", "#5c625f");
  const mossy = theme === "forest" ? 0.5 : 0.62;
  const M = { 2: [C("#5a8a48"), C("#74a85a"), C("#3e6a3a")], 1: [C("#4a7640"), C("#5e8e4c"), C("#34583a")] };
  const face = (side, s, z) => {
    const ws = (side === 2 ? x : y) * 16 + s;
    // grass hangs over the top of the face, a little ragged
    const hang = 1 + Math.floor(hash(ws, side, 5) * 2.2) + (hash(ws >> 2, side, 6) > 0.8 ? 2 : 0);
    if (z >= h - hang) return z === h - hang ? gD : side === 2 ? C(gHex) : C(shade(gHex, 0.82));
    if (z < 2) return F[side][2];
    // moss in soft patches, ragged at the edge, a lit fleck here and there
    const n = vnoise(ws, z * 1.6, 8, 57 + side);
    if (n > mossy + 0.04 || (n > mossy && (ws + z) & 1)) return hash(ws, z, 58) < 0.12 ? M[side][1] : n > mossy + 0.16 ? M[side][2] : M[side][0];
    return facet(F[side], ws, z, 51);
  };
  const top = (a, b) => G.tex(x * 16 + a, y * 16 + b);
  return block({ h, nh, nd, top, face, hi: () => lip, backInk: (a, b, c) => (hash(a, b, x * 31 + y) < 0.0 ? c : C(shade(gHex, 0.6))), seam: F[1][2] });
}

function caveShelf(m, x, y, h, nh, nd) {
  const S = materials("cave")._shelf;
  const F = faces("#6c7370", "#8e9592", "#40464a");
  const moss = [C("#2f7a4c"), C("#4aa86a"), C("#1e4e34")], jade = [C("#5ae4b0"), C("#c8fff0"), C("#2a9a78")];
  const face = (side, s, z) => {
    const ws = (side === 2 ? x : y) * 16 + s;
    // moss trailing down from the edge in strands of different lengths
    const len = hash(ws, side, 71) < 0.55 ? 1 + Math.floor(hash(ws >> 1, side, 72) * (h > 20 ? 9 : 5)) : 0;
    if (z >= h - len) return z === h - len ? moss[2] : hash(ws, z, 73) < 0.18 ? moss[1] : moss[0];
    if (z < 2) return F[side][2];
    // strata: a dark seam every few pixels up, broken; a crystal glinting in the odd crack
    const c = facet(F[side], ws, z, 77);
    if (hash(ws, z >> 1, 78 + side) < 0.006 && z > 3 && z < h - 4) return (z & 1) ? jade[1] : jade[0];
    return c;
  };
  const top = (a, b) => S.tex(x * 16 + a, y * 16 + b);
  const lip = C("#a8aea9"), back = C("#3a4040");
  return block({ h, nh, nd, top, face, hi: (a, b) => (hash(x * 16 + a, y * 16 + b, 79) < 0.3 ? moss[1] : lip), backInk: () => back, seam: F[1][2] });
}

/**
 * 석축: the upper terrace's retaining wall of coursed field stone, a grassy lip on top with a few flowers
 * hanging over, moss low down; runs join like cliffs (12 px: a rise you read, never a climb).
 */
function stoneWall(m, x, y, theme, nh, nd) {
  const h = HEIGHT.W, G = materials(theme)._grass, gHex = GRASS[theme] || GRASS.meadow;
  const F = faces("#a8a090", "#c8c0ae", "#7c7466");
  const lip = C(light(gHex, 1.2)), moss = C("#6a9a4a"), mossL = C("#86b45e");
  const face = (side, s, z) => {
    const ws = (side === 2 ? x : y) * 16 + s;
    if (z >= h - 2) return z === h - 1 ? C(gHex) : (hash(ws, side, 61) < 0.5 ? C(shade(gHex, 0.8)) : F[side][1]);
    if (z >= h - 4 && hash(ws >> 1, side, 62) < 0.22) return hash(ws, z, 63) < 0.5 ? C(["#f06a7a", "#fffbe8", "#f0c040"][ws % 3]) : C(gHex);
    const k = coursed(s + (side === 2 ? x : y) * 16, z, 4, 6 + (hash(ws >> 3, z >> 2, 64) < 0.5 ? 1 : 3), 65 + side, x + y);
    if (z < 3 && hash(ws, z, 66) < 0.4) return z ? moss : mossL;
    if (k.seam) return F[side][2];
    return k.t < 0.25 ? F[side][3] : k.t > 0.8 ? F[side][1] : F[side][0];
  };
  const top = (a, b) => G.tex(x * 16 + a, y * 16 + b);
  return block({ h, nh, nd, top, face, hi: () => lip, backInk: () => C(shade(gHex, 0.6)), seam: F[1][2] });
}

/** The north palisade: sharpened logs of uneven height, lashed with two ropes, on the blighted ground it holds back. */
function palisade(mask, v) {
  const H = 24, buf = new Buf(32, 16 + H + 4), base = H + 2;
  const P = (a, b) => [16 + a - b, base + ((a + b) >> 1)];
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const runs = [];
  for (let i = 0; i < 4; i++) if (mask & (1 << i)) runs.push(dirs[i]);
  if (!runs.length) runs.push([1, 0], [-1, 0]);
  const pts = [[8, 8]];
  for (const [dx, dy] of runs) for (let t = 2; t <= 8; t += 2) pts.push([8 + dx * t, 8 + dy * t]);
  // back to front, so the nearer logs overlap the farther
  pts.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  const WOODS = [["#7a5636", "#9c7448", "#5a3c24"], ["#6e4e30", "#906a42", "#4e3420"]].map((w) => w.map(C));
  for (const [a, b] of pts) {
    const [X, Y] = P(a, b), tall = 18 + Math.floor(hash(a * 3 + v, b * 5, 71) * 5), w = WOODS[(a + b + v) & 1];
    for (let z = 0; z < tall; z++) { buf.px(X - 1, Y - z, w[1]); buf.px(X, Y - z, w[0]); buf.px(X + 1, Y - z, w[2]); }
    // the sharpened point
    buf.px(X, Y - tall, w[1]); buf.px(X, Y - tall - 1, C("#c8a878"));
    for (const zr of [6, 14]) { buf.px(X - 1, Y - zr, C("#c8b480")); buf.px(X, Y - zr, C("#a8945e")); buf.px(X + 1, Y - zr, C("#8a7848")); }
  }
  const src = buf.d.slice(), W = buf.w;
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < W; x++) {
    if (src[y * W + x]) continue;
    if ((x > 0 && src[y * W + x - 1]) || (x < W - 1 && src[y * W + x + 1]) || (y > 0 && src[(y - 1) * W + x]) || (y < buf.h - 1 && src[(y + 1) * W + x])) buf.d[y * W + x] = INK;
  }
  return { img: buf.canvas(), dx: -16, dy: -base };
}

/** A clipped hedge. */
function hedge(x, y, h, nh, nd) {
  const leaf = "#4aa552", F = faces(leaf, "#6ac060", "#33863f");
  const lit = C("#6ac060"), deep = C("#33863f"), base = C(leaf), hl = C("#84d474");
  const leafy = (s, t, seed) => {
    const k = (Math.floor(s / 4) * 7 + Math.floor(t / 3) * 3) % 5, ls = s % 4, lt = t % 3, r = hash(Math.floor(s / 4), Math.floor(t / 3), seed);
    if (lt === 0 && ls > 0 && ls < 3 && r > 0.3) return 1;
    if (lt === 2 && r < 0.4) return 2;
    return k === 0 && r > 0.7 ? 1 : 0;
  };
  const top = (a, b) => { const k = leafy(x * 16 + a + b, y * 16 + b - a + 64, 3); return k === 1 ? lit : k === 2 ? deep : base; };
  const face = (side, s, z) => {
    const f = F[side], k = leafy((side === 2 ? x : y) * 16 + s, z + 2, 4 + side);
    if (z < 2) return C("#256a32");
    return k === 1 ? f[1] : k === 2 ? f[2] : f[0];
  };
  return block({ h, nh, nd, top, face, hi: () => hl, seam: F[1][2] });
}

/** A wall of dressed stone, fallen in to different heights. */
function ruin(x, y, h, nh, nd) {
  const F = faces("#9c9686", "#bcb6a6", "#726c5e");
  const topC = C("#cbc6b6"), seam = C("#aaa494"), moss = C("#6aa85a"), mossL = C("#7ab868");
  const top = (a, b) => {
    if (a === 8 || b === 8) return seam;
    if (hash(x * 2 + (a >> 3), y * 2 + (b >> 3), 3) < 0.2 && ((a + b) & 1)) return mossL;
    return topC;
  };
  const face = (side, s, z) => {
    const k = coursed(s, z, 5, 8, 9 + side, x * 3 + y), f = F[side];
    if (z < 4 && hash((side === 2 ? x : y) * 16 + s, z, 11) < 0.35) return moss;
    if (k.seam) return f[2];
    if (k.top) return f[1];
    return k.t < 0.15 ? f[3] : f[0];
  };
  return block({ h, nh, nd, top, face, hi: () => C("#e2decf"), seam: F[1][2] });
}

/** The city's raw concrete: panels, tags, a roof of gravel behind a parapet. */
function concrete(x, y, h, nh, nd, S) {
  const v = Math.floor(hash(x, y, 4) * 6);
  const open = nh.map((n) => (n ? 1 : 0)).join("") + (nd ? 1 : 0);
  const key = "Z" + open + (v < 2 ? v : 9) + (x & 1);
  if (S.cache.has(key)) return S.cache.get(key);
  const F = faces("#4a5064", "#6a7288", "#343846");
  const tag = v === 0 ? ["#ff5a94", "#5ae4e4"] : v === 1 ? ["#ffd24a", "#7aff8a"] : null;
  const top = (a, b) => (((a >> 2) + (b >> 2) + (x & 1)) % 2 ? C("#3a3e4a") : C("#363a46"));
  const face = (side, s, z) => {
    const f = F[side];
    if (z >= h - 3) return z === h - 1 ? f[1] : f[3];
    if (s === 0 || z === 14) return f[2];
    if (tag && side === 2 && z > 4 && z < 13) {
      // a tag sprayed across the panel
      const c2 = tag[(s >> 2) & 1];
      if ((s + 2 * z) % 9 < 2 && s > 2 && s < 14) return C(c2);
      if (z === 8 && s > 3 && s < 13) return C(c2);
    }
    return f[0];
  };
  const p = block({ h, nh, nd, top, face, hi: () => C("#8a92a8"), seam: F[1][2] });
  S.cache.set(key, p);
  return p;
}
