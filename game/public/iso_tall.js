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
import { UG, GRASS, materials } from "./iso_ground.js";

const INK = C("#2b2233");
/** Heights (pixels) of what stands up. */
const WALL_H = { cave: 26, crypt: 26, sewer: 24, abyss: 26 };
const HEIGHT = { C: 20, H: 13, Z: 28 };

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
  return { img: cv, dx: -16, dy: -h - E };
}

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
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - Math.abs(1.5 - (j)) ; j++) { const [X, Y] = at(2 + i * 4, 1 + j); buf.px(X, Y, C("#ece4cc")); const [X2, Y2] = at(3 + i * 4, 1 + j); if (j < 2) buf.px(X2, Y2, C("#ece4cc")); }
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

/** Cut a building into strips, one per tile along its two front edges; returns pieces keyed "x,y". */
function slice(M, big) {
  const out = new Map(), { buf } = M;
  // the footprint's top corner in the model's pixels
  const X0 = M.ox, Y0 = M.oy;
  // tile (bx + i, by + j) has its top corner at column X0 + (i − j)·16; it owns the
  // columns of its lower edges that lie on the footprint's front
  const cx = (i, j) => X0 + (i - j) * 16;
  const strips = [];
  for (let i = 0; i < 4; i++) strips.push([big.x + i, big.y + 2, i ? cx(i, 2) - 15 : 0, cx(i, 2) + 1]);
  strips[3][3] = cx(3, 2) + 17;
  strips.push([big.x + 3, big.y + 1, cx(3, 2) + 17, cx(3, 2) + 33]);
  strips.push([big.x + 3, big.y, cx(3, 2) + 33, buf.w]);
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
const KINDS = "CHUZF";

export function tall(m, x, y, theme) {
  let S = perMap.get(m);
  if (!S || S.theme !== theme) { S = { theme, pieces: new Map(), houses: null, cache: new Map() }; perMap.set(m, S); }
  const key = x + "," + y;
  if (S.pieces.has(key)) return S.pieces.get(key);
  const p = make(m, x, y, theme, S);
  S.pieces.set(key, p);
  return p;
}

function make(m, x, y, theme, S) {
  const g = (i, j) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? null : m.g[j][i]);
  const o = (i, j) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? null : m.o[j][i]);
  const ch = o(x, y), gr = g(x, y);
  if (ch === "h") {
    if (!S.houses) {
      S.houses = new Map();
      for (const big of m.big || []) {
        if (big.t !== "house") continue;
        const seed = big.x * 7 + big.y * 13;
        const M = big.v >= 4 ? cityTower(big.v, seed) : townHouse(big.v, seed);
        for (const [k, p] of slice(M, big)) S.houses.set(k, p);
      }
    }
    return S.houses.get(x + "," + y) || null;
  }
  if (gr === "W" && ch === " ") return rockWall(m, x, y, theme, S, g);
  if (!KINDS.includes(ch)) return null;
  const same = (i, j) => o(i, j) === ch;
  if (ch === "F") {
    const mask = (same(x, y - 1) ? 1 : 0) | (same(x + 1, y) ? 2 : 0) | (same(x, y + 1) ? 4 : 0) | (same(x - 1, y) ? 8 : 0);
    const k = "F" + mask + theme;
    if (!S.cache.has(k)) S.cache.set(k, fence(mask, theme === "city", 0));
    return S.cache.get(k);
  }
  const hOf = (i, j) => (o(i, j) !== ch ? 0 : ch === "U" ? ruinH(i, j) : HEIGHT[ch]);
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

/** A grassy rise with a rock face. */
function cliff(m, x, y, theme, h, nh, nd) {
  const G = materials(theme)._grass, gHex = GRASS[theme] || GRASS.meadow;
  const lip = C(light(gHex, 1.2)), gD = C(shade(gHex, 0.72));
  const F = faces("#a1967a", "#c6bc9c", "#776c56");
  const face = (side, s, z) => {
    const ws = (side === 2 ? x : y) * 16 + s;
    // grass hangs over the top of the face, a little ragged
    const hang = 1 + Math.floor(hash(ws, side, 5) * 2.2) + (hash(ws >> 2, side, 6) > 0.8 ? 2 : 0);
    if (z >= h - hang) return z === h - hang ? gD : side === 2 ? C(gHex) : C(shade(gHex, 0.82));
    if (z < 2) return F[side][2];
    return facet(F[side], ws, z, 51);
  };
  const top = (a, b) => G.tex(x * 16 + a, y * 16 + b);
  return block({ h, nh, nd, top, face, hi: () => lip, backInk: (a, b, c) => (hash(a, b, x * 31 + y) < 0.0 ? c : C(shade(gHex, 0.6))), seam: F[1][2] });
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
