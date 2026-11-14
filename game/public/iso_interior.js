/**
 * Indoors, seen from the diagonal: the cosy rooms behind the town's doors (the cafe, the
 * town hall, the inn). Same quarter view as isotiles.js — 32×16 diamonds, one pixel per
 * texel, light from the upper left, a dark outline round everything that stands up.
 *
 * A room is a diorama with its two front walls cut away: the back walls stand on the
 * map's north row (y = 0) and west column (x = 0) and are full height; the south row and
 * east column hold a low cut-down stub (`_`), so nobody is ever hidden behind a wall.
 *
 *   bakeRoom(m)            → { frames: [canvas], ox, oy }   the floor (planks, rugs, hearth stones)
 *   roomPiece(m, x, y)     → null | { img, dx, dy, glow?, win?, anim? }   a wall or a piece of furniture
 *   roomLight(...)         the warm light over the room (scene2d.js calls it last)
 *   drawPose(...)          a townsperson's little idle act (sipping, reading, dozing …)
 *
 * Ground chars (this theme only): f honey planks · l walnut planks · x hearth flagstones ·
 * q checked rug · u round rug · y runner carpet · e door mat.
 * Object chars (drawn in any theme; every object blocks):
 *   walls  = plain · + window · ^ chalkboard · ~ painting/map · @ clock · ! banner · _ cut-down front wall
 *   things o round table · k chair · m counter · j counter with coffee machine · $ pastry case ·
 *          b bookshelf · r jar cupboard · # fireplace · g potted plant · * lantern · v notice board ·
 *          - long table · p bed · s armchair · t trophy cabinet · w barrel · ] crates · % sleeping cat
 *   (the autumn kingdom owns d f i z N V J in the object layer, so the room uses symbols there)
 * Map `style` (cafe hall inn library) picks the wallpaper, curtains and banners.
 */
import { hash, C, mix, tone, shade, light, Buf, TILE_PX } from "./iso_px.js";
import { daylight } from "./decor.js";

export const WALLS = "=+^~@!", STUB = "_", FURN = "okmj$br#g*v-pstw]%";
export const OBJECTS = WALLS + STUB + FURN;
export const FLOORS = "flxquye";
const INK = C("#2b2233");
/** How tall the back walls stand, in pixels. */
const WH = 46, STUB_H = 7;

// ───────────────────────────── palettes ─────────────────────────────

const STYLE = {
  cafe: { paper: "#e4cc9c", paper2: "#d4b682", pat: "stripe", wood: "#8a5634", curtain: "#6f9a6a", banner: "#a8443c", trim: "#c89a5a" },
  hall: { paper: "#4a6650", paper2: "#3e5844", pat: "damask", dot: "#c8a85a", wood: "#6e4a30", curtain: "#a8343c", banner: "#a8343c", trim: "#d8b050" },
  inn: { paper: "#c49c84", paper2: "#b48a74", pat: "flower", dot: "#efe0c4", wood: "#7a4c2e", curtain: "#4a6a9a", banner: "#4a6a9a", trim: "#c8955a" },
  library: { paper: "#5e5070", paper2: "#524462", pat: "damask", dot: "#c8b47a", wood: "#5e3c28", curtain: "#7a3a5a", banner: "#3a5a8a", trim: "#c8a860" },
};
const styleOf = (m) => STYLE[m.style] || STYLE.cafe;

/** Packed colour of a hex, memoised; `k` 2 = the face away from the light (right/+x faces). */
const FC = new Map();
function F(hex, k = 1) {
  if (k !== 2) return C(hex);
  let v = FC.get(hex);
  if (v === undefined) { v = C(shade(hex, 0.8)); FC.set(hex, v); }
  return v;
}
const HI = new Map();
function Hl(hex) { let v = HI.get(hex); if (v === undefined) { v = C(light(hex, 1.16)); HI.set(hex, v); } return v; }
const DK = new Map();
function Dk(hex, f = 0.7) { const k = hex + f; let v = DK.get(k); if (v === undefined) { v = C(shade(hex, f)); DK.set(k, v); } return v; }

// ───────────────────────────── a little 3D canvas ─────────────────────────────

/**
 * Pieces are modelled in texels (A, B along the ground, z up in pixels) with a depth
 * buffer, then outlined. Local coordinates (u along the wall it backs onto, v away
 * from it) are turned by `o`: N backs onto the north wall (front faces +y), W onto the
 * west wall (front faces +x), S and E the other way round (for chairs facing a table).
 */
class Model {
  constructor(H, o = "N", W = 40) {
    this.w = W; this.h = H + 22; this.ox = W >> 1; this.oy = H + 3;
    this.buf = new Buf(this.w, this.h); this.z = new Float32Array(this.w * this.h).fill(-1e9);
    this.o = o;
  }
  put(A, B, z, c, bias = 0) {
    if (!c) return;
    const a = Math.floor(A), b = Math.floor(B);
    const X = this.ox + a - b, Y = this.oy + ((a + b) >> 1) - Math.round(z);
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) return;
    const i = Y * this.w + X, d = A + B + z + bias;
    if (d >= this.z[i]) { this.z[i] = d; this.buf.d[i] = c; }
  }
  /** Local (u, v) → actual (A, B). */
  at(u, v) {
    switch (this.o) {
      case "W": return [v, u];
      case "S": return [u, 15 - v];
      case "E": return [15 - v, u];
      default: return [u, v];
    }
  }
  /** A local box → the actual box [A0, B0, A1, B1) and which local face shows on +B (L) and +A (R). */
  frame(u0, v0, u1, v1) {
    switch (this.o) {
      case "W": return [v0, u0, v1, u1, "side", "front"];
      case "S": return [u0, 16 - v1, u1, 16 - v0, "back", "side"];
      case "E": return [16 - v1, u0, 16 - v0, u1, "side", "back"];
      default: return [u0, v0, u1, v1, "front", "side"];
    }
  }
  /**
   * A box from (u0, v0, z0) of size du × dv × dz in hex `col`. `deco(face, s, z, k, n)` may
   * colour a face pixel (face "front" | "back" | "side" | "top"; s left→right as seen, n the
   * face's length; for the top s, z are local u, v); return 0 to keep the default.
   */
  box(u0, v0, z0, du, dv, dz, col, deco = null, bias = 0) {
    const [A0, B0, A1, B1, fL, fR] = this.frame(u0, v0, u0 + du, v0 + dv);
    const top = C(col), hi = Hl(col), zt = z0 + dz - 1;
    for (let A = A0; A < A1; A++) for (let B = B0; B < B1; B++) {
      let c = A === A1 - 1 || B === B1 - 1 ? hi : top;
      if (deco) { const [u, v] = this.local(A, B); const d = deco("top", u - u0, v - v0, 0, 0); if (d) c = d; }
      this.put(A, B, zt, c, bias);
    }
    for (let z = z0; z < zt; z++) {
      for (let A = A0; A < A1; A++) {
        let c = F(col, 1);
        if (deco) { const d = deco(fL, A - A0, z - z0, 1, A1 - A0); if (d) c = d; }
        this.put(A, B1 - 1, z, c, bias);
      }
      for (let B = B0; B < B1; B++) {
        let c = F(col, 2);
        if (deco) { const d = deco(fR, B1 - 1 - B, z - z0, 2, B1 - B0); if (d) c = d; }
        this.put(A1 - 1, B, z, c, bias);
      }
    }
  }
  /** Actual (A, B) → local (u, v). */
  local(A, B) {
    switch (this.o) {
      case "W": return [B, A];
      case "S": return [A, 15 - B];
      case "E": return [B, 15 - A];
      default: return [A, B];
    }
  }
  /** An upright cylinder centred on local (cu, cv); `deco(kind, ang, z, k)` may colour it. */
  cyl(cu, cv, r, z0, dz, col, deco = null, bias = 0) {
    const [ca, cb] = this.at(cu, cv), zt = z0 + dz - 1;
    const R = Math.ceil(r) + 1;
    for (let A = Math.floor(ca - R); A <= ca + R; A++) for (let B = Math.floor(cb - R); B <= cb + R; B++) {
      const da = A + 0.5 - ca, db = B + 0.5 - cb, d = Math.hypot(da, db);
      if (d > r) continue;
      const rim = d > r - 1.1;
      let c = rim && db + da > 0 ? Hl(col) : C(col);
      if (deco) { const x = deco("top", Math.atan2(db, da), d, 0); if (x) c = x; }
      this.put(A, B, zt, c, bias);
      if (!rim) continue;
      // the wall of the cylinder, lit on the left (+B), dark on the right (+A)
      const k = db - da > 0.3 ? 1 : 2;
      for (let z = z0; z < zt; z++) {
        let cc = F(col, k);
        if (deco) { const x = deco("side", Math.atan2(db, da), z - z0, k); if (x) cc = x; }
        this.put(A, B, z, cc, bias);
      }
    }
  }
  /** A rounded lump (leaves, a cushion, a sleeping cat): an ellipsoid shaded by its normal. */
  blob(cu, cv, cz, rx, ry, rz, pick, bias = 0) {
    const [ca, cb] = this.at(cu, cv);
    const [ra, rb] = this.o === "W" || this.o === "E" ? [ry, rx] : [rx, ry];
    for (let A = Math.floor(ca - ra - 1); A <= ca + ra + 1; A++) for (let B = Math.floor(cb - rb - 1); B <= cb + rb + 1; B++) {
      const na = (A + 0.5 - ca) / ra, nb = (B + 0.5 - cb) / rb, q = 1 - na * na - nb * nb;
      if (q < 0) continue;
      const nz = Math.sqrt(q), top = cz + rz * nz;
      for (let z = Math.round(cz - rz * nz * 0.6); z <= top; z++) {
        const zz = (z - cz) / rz, nn = Math.max(0, 1 - na * na - nb * nb - zz * zz);
        // light from the upper left and above: −A, a little +B, up
        const lit = -na * 0.45 + nb * 0.25 + zz * 0.8 + nn * 0.2;
        this.put(A, B, z, pick(lit, A, B, z), bias);
      }
    }
  }
  ink() {
    const { w, h, d } = this.buf, src = d.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x]) continue;
      if ((x > 0 && src[y * w + x - 1]) || (x < w - 1 && src[y * w + x + 1]) || (y > 0 && src[(y - 1) * w + x]) || (y < h - 1 && src[(y + 1) * w + x])) d[y * w + x] = INK;
    }
  }
  /** Screen offset (from the tile's top corner) of a local point. */
  scr(u, v, z) { const [A, B] = this.at(u, v); return [A - B, ((A + B) >> 1) - z]; }
  piece(extra = {}) {
    this.ink();
    // trim empty rows and columns so the sprite is no bigger than it needs to be
    const { w, h, d } = this.buf;
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const out = new Buf(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.d[(y - y0) * out.w + x - x0] = d[y * w + x];
    return { img: out.canvas(), dx: x0 - this.ox, dy: y0 - this.oy, ...extra };
  }
}

// ───────────────────────────── the floor ─────────────────────────────

const PLANK = { base: ["#c48a52", "#ba804a", "#cc935a"], gap: "#8a5634", lit: "#d29c64", grain: "#ae7642", knot: "#8a5a34" };
const WALNUT = { base: ["#8e5c3a", "#865636", "#966242"], gap: "#5e3a26", lit: "#a2704a", grain: "#7a4c30", knot: "#5e3a24" };

/** Boards 4 texels wide laid along A (or along B), staggered joints, a lit edge, a little grain. */
function planks(P, A, B, alongB) {
  const L = alongB ? B : A, W = alongB ? A : B;
  const row = Math.floor(W / 4), lw = W & 3, off = Math.floor(hash(row, 3, 71) * 30), len = 22 + (row % 3) * 4;
  const s = L + off, board = Math.floor(s / len), ls = s - board * len;
  if (lw === 3 || ls === 0) return C(P.gap);
  if (lw === 0) return C(P.lit);
  const h = hash(board, row, 72);
  if (ls > 4 && ls < 9 && lw === 1 && h < 0.4) return C(P.grain);
  if (ls > 12 && ls < 15 && lw === 2 && h > 0.75) return C(P.grain);
  if (ls === 17 && lw === 2 && h > 0.85) return C(P.knot);
  return C(P.base[Math.floor(h * 3)]);
}
function flags(A, B) {
  const row = Math.floor(B / 7), s = A + (row & 1 ? 5 : 0), col = Math.floor(s / 10);
  if (B % 7 === 6 || s % 10 === 9) return C("#5e5048");
  const t = hash(col, row, 73);
  if (B % 7 === 0 || s % 10 === 0) return C("#c4b6a2");
  return C(t < 0.33 ? "#a2958a" : t < 0.66 ? "#988a7e" : "#ab9e90");
}

/** The tiles of each rug, grouped so a rug drawn across many tiles is one rug. */
function rugs(m) {
  const seen = new Uint8Array(m.w * m.h), out = new Map();
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const ch = m.g[y][x];
    if (!"quy".includes(ch) || seen[y * m.w + x]) continue;
    const st = [[x, y]], box = [x, y, x, y];
    seen[y * m.w + x] = 1;
    const tiles = [];
    while (st.length) {
      const [a, b] = st.pop();
      tiles.push([a, b]);
      box[0] = Math.min(box[0], a); box[1] = Math.min(box[1], b); box[2] = Math.max(box[2], a); box[3] = Math.max(box[3], b);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = a + dx, j = b + dy;
        if (i < 0 || j < 0 || i >= m.w || j >= m.h || seen[j * m.w + i] || m.g[j][i] !== ch) continue;
        seen[j * m.w + i] = 1; st.push([i, j]);
      }
    }
    const r = { ch, A0: box[0] * 16, B0: box[1] * 16, A1: box[2] * 16 + 16, B1: box[3] * 16 + 16 };
    for (const [a, b] of tiles) out.set(a + "," + b, r);
  }
  return out;
}
/** A rug's texel, or 0 where the floor shows through (round rugs). */
function rugTex(r, A, B, under) {
  const ra = A - r.A0, rb = B - r.B0, RW = r.A1 - r.A0, RH = r.B1 - r.B0;
  const edge = Math.min(ra, rb, RW - 1 - ra, RH - 1 - rb);
  if (r.ch === "q") {
    // a checked rug: a red border, a cream line, red and cream squares
    if (edge < 1) return C("#6a2a2a");
    if (edge < 3) return C(edge === 1 ? "#b04a40" : "#c4584a");
    if (edge < 4) return C("#f0dcb4");
    const ck = ((Math.floor((ra - 4) / 5) + Math.floor((rb - 4) / 5)) & 1) === 0;
    const weave = (ra + rb) % 7 === 0;
    return ck ? C(weave ? "#b85448" : "#c8604e") : C(weave ? "#e2c89e" : "#ecd6ae");
  }
  if (r.ch === "y") {
    // a runner: deep red with a gold border and a row of diamonds down the middle
    if (edge < 1) return C("#4e1a22");
    if (edge < 2) return C("#d8a640");
    if (edge < 3) return C("#8a2630");
    const long = RW >= RH, s = long ? ra : rb, t = long ? rb : ra, span = long ? RH : RW;
    const dm = Math.abs((s % 12) - 6) + Math.abs(t - span / 2 + 0.5);
    if (dm < 2.2) return C("#e8c060");
    if (dm < 3.4) return C("#7a2028");
    if (edge === 3) return C("#b8862e");
    return C((s + t) % 9 === 0 ? "#982c34" : "#a2323a");
  }
  // a round rug: navy rim, a gold line, a teal field, a rose in the middle
  const cx = (RW - 1) / 2, cy = (RH - 1) / 2, d = Math.hypot((ra - cx) / (RW / 2 - 0.5), (rb - cy) / (RH / 2 - 0.5));
  if (d > 1) return under;
  if (d > 0.93) return C("#28304e");
  if (d > 0.84) return C("#3a4a7a");
  if (d > 0.79) return C("#e0b450");
  if (d > 0.36) {
    const ang = Math.atan2(rb - cy, ra - cx), petal = Math.abs(Math.sin(ang * 4)) > 0.92 && d > 0.5 && d < 0.66;
    return petal ? C("#e0b450") : C((Math.floor(ra / 3) + Math.floor(rb / 3)) % 5 === 0 ? "#3e7a80" : "#468a8e");
  }
  if (d > 0.3) return C("#e0b450");
  return C(d < 0.14 ? "#f0d8c8" : "#c85a6a");
}
function matTex(A, B) {
  const a = A & 15, b = B & 15, e = Math.min(a, b, 15 - a, 15 - b);
  if (e < 2) return C(e === 0 ? "#5a3a22" : "#7a5230");
  return C((a + b) % 3 === 0 ? "#a8824c" : "#b8925a");
}

export function bakeRoom(m) {
  const S = styleOf(m);
  const W = (m.w + m.h) * 16, H = (m.w + m.h) * 8 + 24, ox = m.h * 16, oy = 8;
  const px = new Uint32Array(W * H);
  const RUG = rugs(m);
  const obj = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? null : m.o[y][x]);
  const isWall = (x, y) => { const c = obj(x, y); return c !== null && WALLS.includes(c); };
  const stands = (x, y) => { const c = obj(x, y); return c !== null && c !== " " && !WALLS.includes(c) && c !== STUB; };
  const OFF = TILE_PX.map(([sx, sy]) => sy * W + sx);
  const darkFloor = C("#3a2418");
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const ch = m.g[y][x], o = obj(x, y);
    const base = (oy + (x + y) * 8) * W + ox + (x - y) * 16;
    const wallN = isWall(x, y - 1), wallW = isWall(x - 1, y);
    const shN = stands(x, y - 1), shW = stands(x - 1, y), shNW = stands(x - 1, y - 1);
    TILE_PX.forEach(([, , a, b], k) => {
      const A = x * 16 + a, B = y * 16 + b;
      let c;
      if (WALLS.includes(o)) c = darkFloor;
      else {
        const plank = ch === "l" ? planks(WALNUT, A, B, true) : planks(PLANK, A, B, false);
        if (ch === "x") c = flags(A, B);
        else if (ch === "e") c = matTex(A, B);
        else if ("quy".includes(ch)) c = rugTex(RUG.get(x + "," + y), A, B, plank);
        else c = plank;
        // a soft band of shade along the foot of the back walls
        let f = 1;
        if (wallN && b < 5) f = b < 2 ? 0.66 : b < 4 ? 0.78 : 0.88;
        if (wallW && a < 5) f = Math.min(f, a < 2 ? 0.7 : a < 4 ? 0.8 : 0.9);
        // and the short shadow furniture throws down and to the right
        if ((shW && a < 4) || (shN && b < 3) || (shNW && a < 3 && b < 3)) f = Math.min(f, 0.8);
        if (stands(x, y) && Math.hypot(a - 9, b - 9) < 7.5) f = Math.min(f, 0.72);
        if (f < 1) c = C(shade(hexOfPx(c), f));
      }
      px[base + OFF[k]] = c;
    });
  }
  void S;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  cv.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(px.buffer), W, H), 0, 0);
  return { frames: [cv], ox, oy };
}
const HX = new Map();
function hexOfPx(u) {
  let v = HX.get(u);
  if (v === undefined) { const r = u & 255, g = (u >> 8) & 255, b = (u >> 16) & 255; v = "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0"); HX.set(u, v); }
  return v;
}

// ───────────────────────────── walls ─────────────────────────────

/** The room side of a back wall, by texel `u` along the wall (world) and height z. */
function wallSkin(S, u, z, k) {
  if (z < 2) return F("#4a2c1e", k);
  if (z === 2) return F("#9a6440", k);
  if (z < 17) {
    // wainscot: panels 8 texels wide, a groove between them, a lit bevel on top
    const p = u & 7;
    if (z === 3 || z === 16) return F(z === 16 ? light(S.wood, 1.2) : shade(S.wood, 0.7), k);
    if (p === 0) return F(shade(S.wood, 0.66), k);
    if (p === 1 || z === 15) return F(light(S.wood, 1.14), k);
    if (p === 7 || z === 4) return F(shade(S.wood, 0.84), k);
    return F(S.wood, k);
  }
  if (z === 17) return F(light(S.trim, 1.1), k);
  if (z === 18) return F(shade(S.wood, 0.72), k);
  if (z >= WH - 3) return F(z === WH - 1 ? light(S.wood, 1.24) : z === WH - 2 ? S.wood : shade(S.wood, 0.62), k);
  // the paper: stripes, a damask diamond or a little flower
  if (S.pat === "stripe") return F((u % 8) < 3 ? S.paper2 : S.paper, k);
  if (S.pat === "damask") {
    const du = Math.abs(((u + 4) % 8) - 4), dz = Math.abs(((z - 19 + (Math.floor((u + 4) / 8) & 1 ? 5 : 0)) % 10) - 5);
    if (du + dz * 0.8 < 1.5) return F(S.dot, k);
    if (du + dz * 0.8 < 3) return F(S.paper2, k);
    return F(S.paper, k);
  }
  const cu = u % 10, cz = (z - 19 + (Math.floor(u / 10) & 1 ? 5 : 0)) % 10;
  if ((cu === 4 && (cz === 3 || cz === 5)) || (cz === 4 && (cu === 3 || cu === 5))) return F(S.dot, k);
  if (cu === 4 && cz === 4) return F("#d86a6a", k);
  return F(S.paper, k);
}

/** A cut edge of a wall: the dollhouse section, plaster with a dark core. */
function cutSkin(s, z, k) {
  if (z >= WH - 2 || s < 2 || s > 13) return F("#e8d8bc", k);
  if (z < 1) return F("#6a4e3a", k);
  return F((z + s) % 11 === 0 ? "#3a2a24" : "#4a3830", k);
}

/** What hangs on a wall tile, painted over its skin; `s` 0…15 left→right as seen. */
function wallDeco(S, ch, s, z, k, x, y, join) {
  if (ch === "+") {
    // a tall window: curtains, a wooden frame, four panes of daylight, a sill
    if ((s < 2 || s > 13) && z >= 21 && z <= 42) return F((s + (z >> 1)) % 3 === 0 ? shade(S.curtain, 0.78) : s === 0 || s === 15 ? shade(S.curtain, 0.88) : S.curtain, k);
    if (z === 43 && s >= 0 && s <= 15) return F("#3a2a22", k);
    if (s >= 2 && s <= 13) {
      if (z === 19) return F(light(S.trim, 1.25), k);
      if (z === 18) return F(shade(S.wood, 0.6), k);
      if (z >= 20 && z <= 41) {
        if (s === 2 || s === 13 || z === 20 || z === 41) return F("#7a4e30", k);
        if (s === 7 || s === 8 || z === 31) return F("#8a5a38", k);
        // glass: pale sky, a band of far trees low down, a glint
        const gz = z - 21;
        if ((s + gz) % 9 === 0 && gz > 12) return F("#ffffff", k);
        if (gz < 3) return F("#9ac87a", k);
        if (gz < 5) return F("#cfe6c0", k);
        return F(gz > 14 ? "#e6f4f8" : "#cfe8f2", k);
      }
    }
    return 0;
  }
  if (ch === "^") {
    // a chalkboard menu; two side by side share one frame
    const L = join[0], R = join[1];
    if (z < 20 || z > 40) return 0;
    if (z === 20 || z === 40 || (!L && s === 1) || (!R && s === 14)) return F("#8a5a36", k);
    if ((!L && s < 1) || (!R && s > 14)) return 0;
    const gs = s + (L ? 16 : 0);
    // chalk: a title, prices in rows, a little cup
    if (z === 37 && gs > 4 && gs < 26 && gs % 4 !== 0) return F("#f6f2e6", k);
    if ((z === 33 || z === 29 || z === 25) && ((gs > 3 && gs < 14 && (gs + z) % 3 !== 0) || (gs > 22 && gs < 27))) return F(z === 29 ? "#f0c8d0" : "#e8eef0", k);
    if (!L && R && s > 9 && s < 14 && z > 22 && z < 27 && (s === 10 || s === 13 || z === 23)) return F("#f0e08a", k);
    return F((s * 7 + z * 3) % 13 === 0 ? "#34463e" : "#2a3a34", k);
  }
  if (ch === "~") {
    // a framed picture: a meadow for the cafe and the inn, the region's map for the hall
    if (s < 2 || s > 13 || z < 22 || z > 38) return 0;
    if (s === 2 || s === 13 || z === 22 || z === 38) return F("#c89a3a", k);
    if (s === 3 || s === 12 || z === 23 || z === 37) return F("#8a6424", k);
    if (S.pat === "damask") {
      const coast = Math.sin(s * 0.9 + x) * 2 + 30;
      if (Math.abs(z - coast) < 0.6) return F("#7a5a3a", k);
      if (z > coast) return F("#8ab4c8", k);
      if ((s === 6 && z === 27) || (s === 9 && z === 26) || (s === 7 && z === 26)) return F("#c03030", k);
      return F((s + z) % 5 === 0 ? "#d8c49a" : "#e8d8b0", k);
    }
    const hill = 28 + Math.round(Math.sin(s * 0.7 + y) * 1.5);
    if (z < hill) return F(z < hill - 2 ? "#5a9a50" : "#7ab860", k);
    if (s === 9 && z < 34 && z >= hill) return F("#6a4a30", k);
    if (Math.hypot(s - 9, z - 34) < 2.2) return F("#4a8a46", k);
    return F(z > 34 ? "#a8d4e8" : "#c8e4ee", k);
  }
  if (ch === "@") {
    // a wall clock in a tall wooden case, its pendulum showing through a little window
    if (s < 5 || s > 10 || z < 19 || z > 39) return 0;
    const fc = Math.hypot(s - 7.5, z - 34.5);
    if (z >= 30) { if (fc < 2.4) return F(fc < 0.8 ? "#2b2233" : "#f8f0dc", k); if (fc < 3.5) return F("#d8b050", k); }
    if (s === 5 || s === 10 || z === 19 || z === 39) return F("#5a3420", k);
    if (z >= 21 && z <= 28 && s >= 6 && s <= 9) return F(s === 7 || s === 8 ? (z < 23 ? "#e0b850" : "#b89040") : "#2a1c18", k);
    return F("#7a4a2c", k);
  }
  if (ch === "!") {
    // a banner on a gold rod, pointed at the foot, with the town's paw mark
    if (z === 41 && s >= 3 && s <= 12) return F("#e0b850", k);
    if (s < 4 || s > 11 || z > 40) return 0;
    const tip = 20 + Math.abs(s - 7.5);
    if (z < tip) return 0;
    if (s === 4 || s === 11 || z < tip + 1.5) return F(S.trim, k);
    const pd = Math.hypot(s - 7.5, z - 29);
    if (pd < 1.8 || [[5.5, 32], [9.5, 32], [6.5, 34], [8.5, 34]].some(([a, b]) => Math.hypot(s - a, z - b) < 0.9)) return F(S.trim, k);
    return F((z & 3) === 0 ? shade(S.banner, 0.9) : S.banner, k);
  }
  if (ch === "=" && hash(x, y, 77) < 0.3) {
    // a brass sconce with a candle
    if (s >= 7 && s <= 8 && z >= 26 && z <= 28) return F("#c89a3a", k);
    if (s >= 7 && s <= 8 && z >= 29 && z <= 31) return F("#f4ecd8", k);
    if (s >= 7 && s <= 8 && z === 32) return F("#ffd060", k);
  }
  return 0;
}

function wallPiece(m, x, y, ch) {
  const S = styleOf(m);
  const o = (i, j) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? null : m.o[j][i]);
  const solidWall = (c) => c !== null && WALLS.includes(c);
  const roomish = (c) => c !== null && !WALLS.includes(c) && c !== STUB;
  const nB = o(x, y + 1), nA = o(x + 1, y);
  const showL = !solidWall(nB), showR = !solidWall(nA);
  const M = new Model(WH);
  const joinL = (dx, dy) => o(x + dx, y + dy) === ch;
  // the face toward +y (left on screen) runs along x; the face toward +x along y
  if (showL) for (let A = 0; A < 16; A++) for (let z = 0; z < WH; z++) {
    const u = x * 16 + A;
    let c;
    if (!roomish(nB)) c = cutSkin(A, z, 1);
    else { c = wallSkin(S, u, z, 1); const d = wallDeco(S, ch, A, z, 1, x, y, [joinL(-1, 0), joinL(1, 0)]); if (d) c = d; }
    M.put(A, 15, z, c);
  }
  if (showR) for (let B = 0; B < 16; B++) for (let z = 0; z < WH; z++) {
    const s = 15 - B, u = y * 16 + B;
    let c;
    if (!roomish(nA)) c = cutSkin(s, z, 2);
    else { c = wallSkin(S, u, z, 2); const d = wallDeco(S, ch, s, z, 2, x, y, [joinL(0, 1), joinL(0, -1)]); if (d) c = d; }
    M.put(15, B, z, c);
  }
  // the top of the wall: the dark of its thickness, a lit cap where it looks over the room
  for (let A = 0; A < 16; A++) for (let B = 0; B < 16; B++) {
    let c = C("#2a1d1a");
    if ((showL && B >= 13) || (showR && A >= 13)) c = C((showL && B === 15) || (showR && A === 15) ? "#e0c8a0" : "#b08058");
    M.put(A, B, WH, c);
  }
  const extra = {};
  if (ch === "+" && (showL || showR)) {
    extra.win = showL ? "N" : "W";
    // the glass, in screen terms from the tile's top corner, so night can darken it
    const P = (s, z) => (showL ? [s - 15, ((s + 15) >> 1) - z] : [15 - (15 - s), ((15 + 15 - s) >> 1) - z]);
    extra.glass = [...P(3, 21), ...P(13, 21), ...P(13, 41), ...P(3, 41)];
  }
  if (ch === "=" && hash(x, y, 77) < 0.3) { const [sx, sy] = showL ? [7.5 - 15, ((7.5 + 15) >> 1) - 32] : [15 - 7.5, ((15 + 7.5) >> 1) - 32]; extra.glow = { x: sx, y: sy, r: 34, col: "#ffc070", k: 0.5 }; }
  return M.piece(extra);
}

/** The cut-down front wall: a low stub, outside face of cream plaster on a stone footing; posts beside the door. */
function stubPiece(m, x, y) {
  const o = (i, j) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? null : m.o[j][i]);
  const out = (i, j) => o(i, j) === null;
  const open = (i, j) => { const c = o(i, j); return c !== null && c !== STUB && !WALLS.includes(c) && (j === m.h - 1 || i === m.w - 1); };
  // the bottom row runs along x, the right column along y
  const along = y === m.h - 1 && x < m.w - 1 ? "N" : "W";
  const M = new Model(30, along, 84);
  const lo = along === "N" ? open(x - 1, y) : open(x, y - 1), hi = along === "N" ? open(x + 1, y) : open(x, y + 1);
  const ext = (s, z, k) => (z < 3 ? F(z === 2 ? "#c8c0b0" : "#9a9286", k) : F(z === STUB_H - 1 ? "#a87a4c" : (s & 7) === 0 ? "#cdbd9c" : "#e8dcc0", k));
  M.box(0, 0, 0, 16, 16, STUB_H, "#b88a5c", (f, s, z, k) => (f === "top" ? 0 : ext(s, z, k)));
  void out;
  // beside the way out: a door post, and over the opening a lintel with a little lamp
  const post = (pu) => M.box(pu, 5, STUB_H, 4, 6, 16, "#7a4e30", (f, s, z, k) => (f === "top" ? C("#c89a5a") : s === 0 && f !== "side" ? F("#a87a4c", k) : 0));
  const extra = {};
  if (lo) post(0);
  if (hi) {
    post(12);
    M.box(12, 5, STUB_H + 16, 24, 6, 4, "#8a5a36", (f, s, z, k) => (f === "top" ? 0 : z === 0 ? F("#5a3a22", k) : z === 3 ? F("#c89a5a", k) : 0));
    M.cyl(24, 11.5, 1.6, STUB_H + 11, 4, "#ffd890", (kind, a, z, k) => (kind === "side" ? (k === 2 ? C("#f4c070") : C("#fff0c0")) : C("#4a3e44")));
    const [sx, sy] = M.scr(24, 11.5, STUB_H + 13);
    extra.glow = { x: sx, y: sy, r: 40, col: "#ffc070", k: 0.7, flick: 0.05 };
  }
  return M.piece(extra);
}

// ───────────────────────────── furniture ─────────────────────────────

const WOOD = "#9a6440", WOOD_D = "#6e4428", WOOD_L = "#c08a58";
const BOOK = ["#a8443c", "#3e6a8a", "#5a8a4a", "#c8963a", "#7a4a7a", "#d8c8a0", "#4a4a6a", "#b86a3a"];

/** Which way a piece backs onto a wall: N (wall behind it to the north) or W, else free (N). */
function backing(m, x, y) {
  const o = (i, j) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? null : m.o[j][i]);
  const wall = (c) => c !== null && WALLS.includes(c);
  if (wall(o(x, y - 1))) return "N";
  if (wall(o(x - 1, y))) return "W";
  return "N";
}
/** Which way a chair or an armchair turns: its back away from the nearest table or hearth. */
function facing(m, x, y) {
  const o = (i, j) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? null : m.o[j][i]);
  for (const want of ["o-", "#", "mj$"]) {
    if (want.includes(o(x, y + 1))) return "N";
    if (want.includes(o(x + 1, y))) return "W";
    if (want.includes(o(x, y - 1))) return "S";
    if (want.includes(o(x - 1, y))) return "E";
  }
  return backing(m, x, y);
}
/** Whether a run of the same kind (counter, long table) continues along x or y. */
function run(m, x, y, set) {
  const o = (i, j) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? null : m.o[j][i]);
  const along = (c) => c !== null && set.includes(c);
  const ax = along(o(x - 1, y)) || along(o(x + 1, y)), ay = along(o(x, y - 1)) || along(o(x, y + 1));
  const o2 = ax || !ay ? "N" : "W";
  // in local terms: whether the run goes on to the left (−u) and to the right (+u)
  return o2 === "N" ? { o: o2, lo: along(o(x - 1, y)), hi: along(o(x + 1, y)) } : { o: o2, lo: along(o(x, y - 1)), hi: along(o(x, y + 1)) };
}

/** A small lamp with a warm shade, standing at local (u, v, z). */
function lamp(M, u, v, z) {
  M.cyl(u, v, 1.6, z, 2, "#c8963a");
  M.cyl(u, v, 0.8, z + 1, 4, "#8a5a30");
  M.cyl(u, v, 2.8, z + 5, 4, "#ffd890", (kind, a, zz, k) => (kind === "side" ? (zz === 0 ? C("#e8a850") : k === 2 ? C("#f4c070") : C("#ffe4a8")) : C("#fff0c8")));
  const [sx, sy] = M.scr(u, v, z + 7);
  return { x: sx, y: sy, r: 44, col: "#ffc070", k: 0.75, flick: 0.06 };
}
function cup(M, u, v, z, col = "#f4ecdc") { M.cyl(u, v, 1.2, z, 3, col, (kind, a, zz) => (kind === "top" ? C("#6a3e22") : 0)); }

function roundTable(m, x, y) {
  const M = new Model(30), S = styleOf(m), h = hash(x, y, 81);
  M.cyl(8, 8, 3.2, 0, 2, WOOD_D);
  M.cyl(8, 8, 1.2, 1, 8, WOOD_D);
  M.cyl(8, 8, 6.6, 8, 2, WOOD, (kind, a, zz, k) => (kind === "top" && zz > 5.6 ? C(WOOD_L) : 0));
  const extra = {};
  if (m.style === "hall") {
    // papers and an inkwell
    M.box(4, 6, 10, 5, 4, 1, "#f2ead6"); M.box(9, 8, 10, 4, 3, 1, "#e8dcc0"); M.cyl(10, 5, 1, 10, 3, "#2a2a3a");
    extra.glow = lamp(M, 5, 4, 10);
  } else {
    extra.glow = lamp(M, 5, 5, 10);
    if (h < 0.7) { cup(M, 9, 9, 10); cup(M, 11, 6, 10, "#e8d0b0"); extra.steam = [M.scr(9, 9, 13), M.scr(11, 6, 13)]; }
    else { M.box(8, 7, 10, 5, 4, 1, BOOK[Math.floor(h * 8)]); M.box(8, 7, 11, 5, 4, 1, "#f4ecdc"); }
  }
  void S;
  return M.piece(extra);
}

function chair(m, x, y) {
  const M = new Model(20, facing(m, x, y));
  const c = m.style === "hall" ? "#6a3e26" : m.style === "inn" ? "#8a5a36" : "#9a6038";
  for (const [lu, lv] of [[4, 5], [11, 5], [4, 11], [11, 11]]) M.box(lu, lv, 0, 1, 1, 6, WOOD_D);
  M.box(3, 4, 5, 10, 9, 2, c);
  const cushion = m.style === "hall" ? "#a8343c" : m.style === "inn" ? "#4a6a9a" : "#6f9a6a";
  M.box(4, 6, 7, 8, 6, 1, cushion);
  // the back, toward the wall side of the chair, with two slats
  M.box(3, 4, 7, 10, 2, 9, c, (f, s, z) => (f !== "top" && z > 1 && z < 7 && (s === 3 || s === 6) ? C(shade(c, 0.6)) : 0));
  return M.piece();
}

/** An armchair turns to the fireplace if one is near, else like a chair. */
function hearthward(m, x, y) {
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    if (m.o[y + j] && m.o[y + j][x + i] === "#") return Math.abs(j) >= Math.abs(i) ? (j < 0 ? "S" : "N") : i < 0 ? "E" : "W";
  }
  return facing(m, x, y);
}
function armchair(m, x, y) {
  const M = new Model(24, hearthward(m, x, y));
  const fab = m.style === "hall" ? "#8a2e38" : m.style === "inn" ? "#46669a" : "#a8503e", top = light(fab, 1.18);
  for (const [lu, lv] of [[3, 4], [12, 4], [3, 13], [12, 13]]) M.box(lu, lv, 0, 1, 1, 3, WOOD_D);
  // the seat, a plump cushion, a rolled back and two rolled arms
  M.box(2, 3, 2, 12, 11, 5, fab, (f, s, z, k) => (f !== "top" && z === 0 ? F(shade(fab, 0.7), k) : 0));
  M.box(4, 6, 7, 8, 7, 2, top, (f, s, z, k) => (f !== "top" ? F(fab, k) : 0));
  M.box(2, 3, 7, 12, 3, 10, fab, (f, s, z, k) => (f === "top" ? C(top) : z === 9 ? F(top, k) : 0));
  for (const au of [2, 12]) M.box(au, 3, 7, 2, 11, 5, fab, (f, s, z, k) => (f === "top" ? C(top) : z === 4 ? F(top, k) : 0));
  return M.piece();
}

function counter(m, x, y, kind) {
  const R = run(m, x, y, "mj$");
  const M = new Model(34, R.o);
  const u0 = R.lo ? 0 : 1, u1 = R.hi ? 16 : 15;
  const front = m.style === "inn" ? "#7a4a2c" : "#8a5634";
  if (kind === "$") {
    // a pastry case: a wooden base, a glass box with two shelves of cakes and loaves
    M.box(u0, 3, 0, u1 - u0, 10, 8, front, (f, s, z, k) => (f !== "top" && (z === 0 ? C("#3a2418") : (s & 7) === 0 ? F(shade(front, 0.7), k) : 0)));
    const pastry = ["#e8b860", "#d88a5a", "#f4e0c0", "#c86a5a", "#b07a40"];
    for (let i = 0; i < 4; i++) {
      const u = u0 + 2 + i * 3.4, c1 = pastry[(x * 3 + i) % 5], c2 = pastry[(x * 3 + i + 2) % 5];
      M.cyl(u, 8, 1.4, 8, 2, c1); M.cyl(u + 1, 7, 1.2, 12, 2, c2);
    }
    M.box(u0, 4, 11, u1 - u0, 8, 1, "#f0e4d0");
    // the glass: a thin frame and diagonal glints, so the cakes show through
    M.box(u0, 3, 8, u1 - u0, 10, 8, "#bfe0e8", (f, s, z, k) => {
      if (f === "top") return s === 0 || z === 0 || s >= u1 - u0 - 1 || z === 9 ? C("#8a5634") : 0;
      if (z === 7 || ((s === 0 || s === u1 - u0 - 1) && f === "front")) return F("#8a5634", k);
      if ((s + z) % 7 === 0) return F("#ffffff", k);
      return 0;
    }, -40);
    // keep the cakes visible through the glass: the glass sits behind them in depth (bias −40)
    return M.piece();
  }
  M.box(u0, 3, 0, u1 - u0, 10, 11, front, (f, s, z, k) => {
    if (f === "top") return 0;
    if (z === 0) return C("#3a2418");
    if (z === 9) return F(shade(front, 0.7), k);
    const p = (s + (R.lo ? 0 : 1)) % 8;
    if (p === 0) return F(shade(front, 0.72), k);
    if (p === 1 || z === 8) return F(light(front, 1.12), k);
    return 0;
  });
  M.box(u0 - (R.lo ? 0 : 1), 2, 11, u1 - u0 + (R.lo ? 0 : 1) + (R.hi ? 0 : 1), 12, 2, m.style === "cafe" ? "#e6dccc" : "#b07a48");
  const extra = {};
  if (kind === "j") {
    // a copper coffee machine with two spouts, a gauge and cups warming on top
    const cu = "#c87a3a";
    M.box(4, 4, 13, 8, 6, 10, cu, (f, s, z, k) => {
      if (f === "top") return 0;
      if (f === "front" && z >= 2 && z <= 4 && (s === 2 || s === 5)) return C("#3a2a24");
      if (f === "front" && Math.hypot(s - 3.5, z - 7.5) < 1.6) return C("#f4ecd8");
      if (z === 9) return F("#e8a860", k);
      if (s === 0) return F("#f0b070", k);
      return 0;
    });
    M.cyl(8, 6, 1.6, 23, 2, "#8a4a2a");
    cup(M, 5, 6, 23); cup(M, 10, 6, 23);
    extra.steam = [M.scr(6, 9, 18), M.scr(9, 9, 18)];
    extra.puff = true;
  } else if (hash(x, y, 83) < 0.5 && !(R.lo && R.hi)) {
    // a jar of cookies or a till
    if (hash(x, y, 84) < 0.5) M.cyl(8, 7, 2.2, 13, 5, "#d8eef0", (kind, a, z) => (kind === "top" ? C("#a87a4c") : z < 3 ? C("#c8904a") : 0));
    else M.box(6, 5, 13, 5, 4, 4, "#8a8a9a", (f, s, z) => (f === "top" ? C("#5a5a6a") : 0));
  }
  return M.piece(extra);
}

function shelf(m, x, y, kind) {
  const o = backing(m, x, y), M = new Model(40, o);
  const H = kind === "t" ? 30 : 34, frame = kind === "r" ? "#7a4a2c" : m.style === "hall" ? "#5a3620" : WOOD_D;
  const rows = kind === "b" ? [2, 10, 18, 26] : [2, 12, 22];
  M.box(0, 0, 0, 16, 6, H, frame, (f, s, z, k) => {
    if (f === "top") return 0;
    if (f !== "front") return 0;
    if (s < 1 || s > 14 || z < 1 || z >= H - 2) return z >= H - 2 ? F(light(frame, 1.2), k) : 0;
    const rz = rows.findIndex((r, i) => z >= r && z < (rows[i + 1] || H - 2));
    const r0 = rows[rz];
    if (z === r0) return F(light(frame, 1.15), k);
    const lz = z - r0;
    if (kind === "b") {
      // books: spines of different widths and heights, a gap here and there, one leaning
      let at = 1, i = 0;
      while (at < 15) {
        const w = 1 + Math.floor(hash(x * 5 + i, y * 3 + rz, 85) * 2.4), hgt = 4 + Math.floor(hash(i, x + rz, 86) * 3);
        if (s >= at && s < at + w) {
          if (hash(i, rz + x, 87) < 0.1 || lz > hgt) return F("#2a1c16", k);
          const col = BOOK[Math.floor(hash(i, y + rz, 88) * BOOK.length)];
          return F(lz === hgt ? light(col, 1.2) : lz === 2 && w > 1 ? "#e8d098" : col, k);
        }
        at += w; i++;
      }
      return F("#2a1c16", k);
    }
    if (kind === "t") {
      // trophies: a gold cup, a silver shield, a medal on a ribbon
      const slot = Math.floor((s - 1) / 5), ls = (s - 1) % 5;
      const which = (slot + rz + x) % 3;
      if (which === 0 && ls >= 1 && ls <= 3 && lz >= 1 && lz <= 6) return F(lz <= 1 ? "#a87a2a" : lz === 6 ? "#fff0a8" : ls === 1 ? "#f0d060" : "#d8a830", k);
      if (which === 1 && ls >= 1 && ls <= 3 && lz >= 2 && lz <= 6) return F(ls === 2 && lz === 4 ? "#c03838" : "#c8ccd8", k);
      if (which === 2 && ls === 2 && lz >= 3 && lz <= 7) return F(lz <= 4 ? "#e8b840" : "#3a5ab0", k);
      return F("#3a2620", k);
    }
    // jars of honey, tea and jam, and a clock
    const slot = Math.floor((s - 1) / 5), ls = (s - 1) % 5;
    const col = ["#e8a830", "#7aa85a", "#c0404a", "#d8c8a0", "#8a6a4a"][(slot + rz * 2 + x) % 5];
    if (rz === rows.length - 1 && slot === 1 && Math.hypot(ls - 2, lz - 4) < 2.6) return F(Math.hypot(ls - 2, lz - 4) < 1.6 ? "#f8f0dc" : "#c89a3a", k);
    if (ls >= 1 && ls <= 3 && lz >= 1 && lz <= 6) return F(lz === 6 ? "#a87a4c" : lz === 5 ? "#e8f4f4" : ls === 1 ? light(col, 1.2) : col, k);
    return F("#3a2620", k);
  });
  // a crown along the top
  M.box(0, 0, H, 16, 7, 2, light(frame, 1.08));
  if (kind === "r" && hash(x, y, 89) < 0.6) M.cyl(8, 3, 2, H + 2, 5, "#d8eef0", (kind2, a, z) => (z > 3 ? C("#a87a4c") : 0));
  return M.piece();
}

function fireplace(m, x, y) {
  const o = backing(m, x, y), M = new Model(WH + 4, o);
  const stone = (f, s, z, k) => {
    if (f === "top") return 0;
    const row = Math.floor(z / 4), ss = s + (row & 1 ? 3 : 0);
    if (z % 4 === 3 || ss % 6 === 0) return F("#6e6058", k);
    const t = hash(Math.floor(ss / 6), row, 90 + x);
    return F(t < 0.3 ? "#a89888" : t < 0.7 ? "#b8a898" : "#c8b8a6", k);
  };
  // the chimney breast up to the cornice, the hearth box, the mantel
  M.box(2, 0, 20, 12, 5, WH - 20, "#b8a898", stone);
  M.box(0, 0, 0, 16, 8, 20, "#b8a898", (f, s, z, k) => {
    if (f === "front" && s >= 3 && s <= 12 && z >= 1 && z <= 13) {
      const arch = z > 10 && Math.abs(s - 7.5) > 4.5 - (z - 10) * 1.2;
      if (!arch) return z <= 2 && (s === 5 || s === 6 || s === 9 || s === 10) ? C("#5a3420") : C(z === 1 ? "#3a2018" : "#1e1210");
    }
    return stone(f, s, z, k);
  });
  M.box(-1, 0, 20, 18, 10, 2, "#7a4a2c");
  // things on the mantel: a candle pair and a small picture
  M.cyl(2, 6, 0.8, 22, 4, "#f4ecd8"); M.cyl(13, 6, 0.8, 22, 4, "#f4ecd8");
  M.box(6, 3, 22, 4, 1, 5, "#c89a3a", (f, s, z) => (f !== "top" && s > 0 && s < 3 && z > 0 && z < 4 ? C("#6a9ac8") : 0));
  // where the fire burns, in screen terms from the tile's top corner
  const [fx, fy] = M.scr(7.5, 8, 3);
  return M.piece({ fire: { x: fx, y: fy }, glow: { x: fx, y: fy - 4, r: 70, col: "#ff9a40", k: 0.9, flick: 0.18 } });
}

function plant(m, x, y) {
  const M = new Model(28), h = hash(x, y, 91);
  M.cyl(8, 8, 3.4, 0, 6, "#c0643c", (kind, a, z) => (z === 4 || z === 5 ? C("#d8784a") : 0));
  M.cyl(8, 8, 2.8, 5, 1, "#4a2e1e");
  const leaf = ["#4e9a4a", "#3a7e3e", "#6ab85a", "#2a5e34"];
  const pick = (lit, A, B, z) => {
    const n = hash(A >> 1, (B + z) >> 1, 92);
    return C(lit > 0.55 ? (n < 0.5 ? leaf[2] : leaf[0]) : lit > 0.15 ? (n < 0.25 ? leaf[2] : leaf[0]) : lit > -0.25 ? (n < 0.3 ? leaf[0] : leaf[1]) : leaf[3]);
  };
  if (h < 0.5) { M.blob(8, 8, 12, 4.5, 4.5, 5, pick); M.blob(6, 10, 16, 3, 3, 3.5, pick); M.blob(10, 7, 17, 2.6, 2.6, 3, pick); }
  else {
    // a tall leafy one
    M.cyl(8, 8, 0.8, 5, 10, "#6a4a2a");
    M.blob(8, 8, 18, 4, 4, 5, pick); M.blob(7, 9, 12, 3.6, 3.4, 3, pick);
  }
  return M.piece();
}

function lantern(m, x, y) {
  const M = new Model(34);
  M.cyl(8, 8, 2.6, 0, 2, "#3a3036");
  M.cyl(8, 8, 1, 2, 20, "#4a3e44");
  M.box(5, 5, 22, 6, 6, 8, "#ffd890", (f, s, z, k) => (f === "top" ? C("#3a3036") : s === 0 || s === 5 || z === 0 ? F("#4a3e44", k) : F(z > 4 ? "#fff0c0" : "#ffcc70", k)));
  M.box(4, 4, 30, 8, 8, 2, "#4a3e44");
  const [sx, sy] = M.scr(8, 8, 26);
  return M.piece({ glow: { x: sx, y: sy, r: 56, col: "#ffc070", k: 0.8, flick: 0.08 } });
}

function board(m, x, y) {
  const M = new Model(34, backing(m, x, y));
  M.box(1, 6, 0, 2, 2, 28, WOOD_D); M.box(13, 6, 0, 2, 2, 28, WOOD_D);
  M.box(1, 7, 8, 14, 2, 18, "#c89a6a", (f, s, z, k) => {
    if (f === "top") return 0;
    if (z === 0 || z === 17 || s === 0 || s === 13) return F("#7a4e30", k);
    // pinned notes, slightly askew
    for (const [a, b, w, hh, col] of [[1, 9, 4, 5, "#f8f0dc"], [6, 11, 4, 4, "#f0e080"], [10, 8, 3, 6, "#f8f0dc"], [2, 2, 5, 5, "#e8d8f0"], [8, 2, 4, 4, "#f8f0dc"]]) {
      if (s >= a && s < a + w && z >= b && z < b + hh) return (s === a + 1 && z === b + hh - 1) ? C("#c03838") : (z - b) % 2 === 1 && s > a && s < a + w - 1 ? F("#8a8070", k) : F(col, k);
    }
    return F((s + z) % 5 === 0 ? "#b88a5a" : "#c89a6a", k);
  });
  // a little roof over it
  M.box(0, 5, 26, 16, 5, 2, "#a8443c");
  return M.piece();
}

function longTable(m, x, y) {
  const R = run(m, x, y, "-");
  const M = new Model(30, R.o);
  const u0 = R.lo ? 0 : 1, u1 = R.hi ? 16 : 15;
  if (!R.lo) { M.box(2, 4, 0, 2, 2, 8, WOOD_D); M.box(2, 10, 0, 2, 2, 8, WOOD_D); }
  if (!R.hi) { M.box(12, 4, 0, 2, 2, 8, WOOD_D); M.box(12, 10, 0, 2, 2, 8, WOOD_D); }
  M.box(u0, 2, 8, u1 - u0, 12, 2, m.style === "hall" ? "#7a4a2c" : WOOD);
  const h = hash(x, y, 93), extra = {};
  if (m.style === "hall") {
    // a cloth runner, papers, a candlestick
    M.box(u0, 6, 10, u1 - u0, 4, 1, "#a8343c", (f, s, z) => (f === "top" && (z === 0 || z === 3) ? C("#d8b050") : 0));
    if (h < 0.5) { M.box(3, 3, 10, 4, 3, 1, "#f2ead6"); M.box(10, 11, 10, 3, 4, 1, "#e8dcc0"); }
    else { M.cyl(8, 8, 1.3, 11, 1, "#d8b050"); M.cyl(8, 8, 0.8, 12, 5, "#f4ecd8"); const [sx, sy] = M.scr(8, 8, 18); extra.glow = { x: sx, y: sy, r: 34, col: "#ffc070", k: 0.6, flick: 0.12 }; extra.candle = [sx, sy]; }
  } else {
    // plates, mugs and a loaf
    if (h < 0.4) { M.cyl(5, 6, 2.2, 10, 1, "#f4ecdc"); M.cyl(11, 12, 2.2, 10, 1, "#f4ecdc"); M.cyl(5, 6, 1.4, 11, 1, "#b0602a"); }
    else if (h < 0.75) { cup(M, 6, 6, 10, "#c8b08a"); cup(M, 10, 11, 10, "#c8b08a"); extra.steam = [M.scr(6, 6, 13)]; }
    else M.blob(8, 8, 11, 3.5, 2.2, 2, (lit) => C(lit > 0.4 ? "#e8b870" : lit > 0 ? "#c88a48" : "#9a6430"));
  }
  return M.piece(extra);
}

function bed(m, x, y) {
  const M = new Model(22, backing(m, x, y));
  const quilt = m.style === "inn" ? ["#4a6a9a", "#e8d8b8", "#a8443c"] : ["#6f9a6a", "#f0e4c8", "#c8963a"];
  M.box(2, 0, 0, 12, 16, 4, WOOD_D);
  M.box(2, 0, 0, 12, 2, 14, WOOD, (f, s, z) => (f === "top" ? 0 : z === 12 ? C(WOOD_L) : z > 4 && z < 11 && s % 4 === 1 ? C(WOOD_D) : 0));
  M.box(3, 2, 4, 10, 13, 3, "#f4ecdc");
  M.box(4, 2, 7, 8, 4, 2, "#ffffff", (f, s, z) => (f !== "top" ? C("#e0d8cc") : 0));
  M.box(3, 6, 6, 10, 9, 2, quilt[0], (f, s, z) => {
    const ck = f === "top" ? ((Math.floor(s / 3) + Math.floor(z / 3)) % 3) : 0;
    return f === "top" ? C(quilt[ck]) : 0;
  });
  M.box(2, 15, 0, 12, 1, 7, WOOD);
  return M.piece();
}

function barrel(m, x, y) {
  const M = new Model(20);
  M.cyl(8, 8, 4.6, 0, 13, "#9a6440", (kind, a, z, k) => {
    if (kind === "top") return z > 3.6 ? C("#6e4428") : C("#a87048");
    if (z === 2 || z === 9) return F("#4a4048", k);
    return Math.round(a * 4) % 3 === 0 ? F("#86542e", k) : 0;
  });
  return M.piece();
}
function crates(m, x, y) {
  const M = new Model(26);
  const wood = (f, s, z, k) => (f === "top" ? 0 : s === 0 || z === 0 || (z % 4 === 0) ? F("#7a5230", k) : F("#c8945a", k));
  M.box(2, 2, 0, 11, 11, 9, "#c8945a", wood);
  M.box(5, 4, 9, 8, 8, 7, "#c8945a", wood);
  return M.piece();
}

/** The cat's cushion; the cat itself breathes in the anim (drawn each frame). */
function catCushion(m, x, y) {
  const M = new Model(10);
  M.blob(8, 8, 1.5, 5.6, 4.8, 2, (lit) => C(lit > 0.5 ? "#c86a7a" : lit > 0 ? "#a8505e" : "#843c4c"));
  const [sx, sy] = M.scr(8, 8, 3);
  return M.piece({ cat: { x: sx, y: sy } });
}

// ───────────────────────────── per map ─────────────────────────────

const perMap = new WeakMap();
export function roomPiece(m, x, y) {
  let S = perMap.get(m);
  if (!S) { S = new Map(); perMap.set(m, S); }
  const key = x + "," + y;
  if (S.has(key)) return S.get(key);
  const ch = m.o[y][x];
  let p = null;
  if (WALLS.includes(ch)) p = wallPiece(m, x, y, ch);
  else if (ch === STUB) p = stubPiece(m, x, y);
  else switch (ch) {
    case "o": p = roundTable(m, x, y); break;
    case "k": p = chair(m, x, y); break;
    case "s": p = armchair(m, x, y); break;
    case "m": case "j": case "$": p = counter(m, x, y, ch); break;
    case "b": case "r": case "t": p = shelf(m, x, y, ch); break;
    case "#": p = fireplace(m, x, y); break;
    case "g": p = plant(m, x, y); break;
    case "*": p = lantern(m, x, y); break;
    case "v": p = board(m, x, y); break;
    case "-": p = longTable(m, x, y); break;
    case "p": p = bed(m, x, y); break;
    case "w": p = barrel(m, x, y); break;
    case "]": p = crates(m, x, y); break;
    case "%": p = catCushion(m, x, y); break;
  }
  if (p) p.anim = animFor(p);
  S.set(key, p);
  return p;
}

// ───────────────────────────── what moves ─────────────────────────────

const FLAME = [
  ["..1...", ".121..", ".1221.", "12321.", "123321", ".1221."],
  ["...1..", "..121.", ".1221.", ".12321", "123321", ".1221."],
  [".1....", ".12.1.", "12211.", "123321", "123321", ".1221."],
];
const FLAME_C = [null, "#e8542a", "#ffa040", "#fff0a0"];
const CAT = [
  // a curled ginger cat, asleep, head on its paws and its tail round its front
  ".1...1..........",
  "121.121.........",
  "12222221.111111.",
  "1252522112222221",
  "1233322224424421",
  ".122222242224421",
  ".133332222222331",
  "..11111111111111",
];
const CAT_C = [null, "#2b2233", "#e8934a", "#f6e2c0", "#b8622e", "#5a2a2a"];

function animFor(p) {
  if (!p.fire && !p.steam && !p.cat && !p.candle && !p.glass) return null;
  return (g, t, X, Y, parts) => {
    if (p.glass) {
      // after dark the window goes deep blue, with a star or two
      const night = daylight().night;
      if (night > 0.02) {
        const q = p.glass;
        g.globalAlpha = night * 0.85; g.fillStyle = "#1c2848";
        g.beginPath(); g.moveTo(X + q[0], Y + q[1]); for (let i = 2; i < 8; i += 2) g.lineTo(X + q[i], Y + q[i + 1]); g.closePath(); g.fill();
        g.globalAlpha = night; g.fillStyle = "#e8ecff";
        g.fillRect(Math.round(X + (q[0] + q[2]) / 2 - 2), Math.round(Y + (q[1] + q[7]) / 2 - 4), 1, 1);
        g.fillRect(Math.round(X + q[0] + 2), Math.round(Y + q[7] + 5), 1, 1);
        g.globalAlpha = 1;
      }
    }
    if (p.fire) {
      const fr = FLAME[Math.floor(t / 120) % 3], x0 = Math.round(X + p.fire.x - 3), y0 = Math.round(Y + p.fire.y - 6);
      for (let j = 0; j < fr.length; j++) for (let i = 0; i < 6; i++) { const c = fr[j][i]; if (c !== ".") { g.fillStyle = FLAME_C[+c]; g.fillRect(x0 + i, y0 + j, 1, 1); } }
      if (Math.random() < 0.1) parts.push({ x: X + p.fire.x + (Math.random() - 0.5) * 4, y: Y + p.fire.y - 6, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 10, life: 0.5, color: Math.random() < 0.5 ? "#ffd070" : "#ff9040", g: 0, s: 1 });
    }
    if (p.candle && Math.sin(t / 90 + X) > -0.6) { g.fillStyle = "#ffd060"; g.fillRect(Math.round(X + p.candle[0]), Math.round(Y + p.candle[1]) - 1, 1, 2); }
    if (p.steam) for (const [sx, sy] of p.steam) if (Math.random() < (p.puff ? 0.05 : 0.025)) parts.push({ x: X + sx + (Math.random() - 0.5) * 2, y: Y + sy, vx: (Math.random() - 0.5) * 3, vy: -7 - Math.random() * 4, life: 1.1 + Math.random() * 0.6, color: "#f4f0ea", g: -1, s: 1 });
    if (p.cat) {
      // breathing: on the in-breath the back rises a pixel
      const inb = Math.floor(t / 1500) % 2, x0 = Math.round(X + p.cat.x - 8), y0 = Math.round(Y + p.cat.y - 7);
      for (let j = 0; j < CAT.length; j++) for (let i = 0; i < 16; i++) { const c = CAT[j][i]; if (c !== ".") { g.fillStyle = CAT_C[+c]; g.fillRect(x0 + i, y0 + j, 1, 1); } }
      if (inb) for (let j = 2; j <= 4; j++) for (let i = 9; i < 16; i++) { const c = CAT[j][i]; if (c !== ".") { g.fillStyle = CAT_C[+c]; g.fillRect(x0 + i, y0 + j - 1, 1, 1); } }
      if (Math.random() < 0.006) parts.push({ x: x0 + 3, y: y0 - 2, vx: 3, vy: -6, life: 1.6, color: "#f4ecf8", g: 0, s: 2, z: 1 });
    }
  };
}

/** A townsperson's idle act, drawn over their sprite (x, y: feet, iso pixels). */
export function drawPose(g, pose, x, y, t, parts, seed = 0) {
  const T = t + seed * 997;
  const px = (c, i, j, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x + i), Math.round(y + j), w, h); };
  if (pose === "sip") {
    // a cup that comes up to the mouth now and then
    const up = (T % 5200) < 1300;
    const cx = up ? 2 : 5, cy = up ? -15 : -10;
    px("#2b2233", cx - 1, cy - 1, 5, 5); px("#f4ecdc", cx, cy, 3, 3); px("#6a3e22", cx, cy, 3, 1); px("#f4ecdc", cx + 3, cy + 1, 1, 1);
    if (!up && Math.random() < 0.03) parts.push({ x: x + cx + 1, y: y + cy - 2, vx: (Math.random() - 0.5) * 2, vy: -6, life: 1, color: "#f4f0ea", g: -1, s: 1 });
  } else if (pose === "read" || pose === "write") {
    // an open book held low; a page turns every few seconds (or a quill scratches)
    const k = (T % 4600) / 4600, turn = pose === "read" && k > 0.9;
    px("#2b2233", -6, -11, 12, 6);
    px(pose === "read" ? "#3e6a8a" : "#7a4a2c", -5, -10, 10, 4);
    px("#f8f0dc", -4, -10, 4, 3); px("#f8f0dc", turn ? -1 : 1, -10, 3, 3);
    px("#b8b0a0", -3, -9, 2, 1); px("#b8b0a0", 2, -9, 2, 1);
    if (pose === "write") { const q = Math.sin(T / 140) * 1.5; px("#2b2233", 2 + q, -15, 1, 5); px("#f4f4f8", 3 + q, -17, 1, 3); }
  } else if (pose === "wipe") {
    const q = Math.round(Math.sin(T / 260) * 3);
    px("#2b2233", 2 + q, -10, 5, 4); px("#e8eef4", 3 + q, -9, 3, 2);
  } else if (pose === "doze") {
    if (Math.random() < 0.012) parts.push({ x: x + 4, y: y - 24, vx: 4, vy: -7, life: 1.8, color: "#f4ecf8", g: 0, s: 2, z: 1 });
  }
}

// ───────────────────────────── the light ─────────────────────────────

let lightCv = null, lg = null;
const glows = new Map();
function glowSprite(col, r) {
  const key = col + r;
  let c = glows.get(key);
  if (!c) {
    c = document.createElement("canvas"); c.width = c.height = r * 2;
    const x = c.getContext("2d"), gr = x.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, col); gr.addColorStop(0.45, col + "66"); gr.addColorStop(1, col + "00");
    x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2);
    glows.set(key, c);
  }
  return c;
}

/**
 * The room's light, over everything: a warm, even dimming (never darker at the screen's
 * edges), holes of light round every lamp and the fire, sunlight falling in through the
 * windows with dust turning in it, and warm pools added on top.
 *   L = { glows: [{X, Y, r, col, k, flick}], wins: [[x0,y0, x1,y1, x2,y2, x3,y3]], motes: [] }
 */
export function roomLight(g, L, t, dt, ox, oy, vw, vh, night = 0) {
  if (!lightCv) { lightCv = document.createElement("canvas"); lg = lightCv.getContext("2d"); }
  if (lightCv.width !== vw || lightCv.height !== vh) { lightCv.width = vw; lightCv.height = vh; }
  lg.globalCompositeOperation = "source-over";
  lg.clearRect(0, 0, vw, vh);
  lg.globalAlpha = 0.24 + night * 0.14; lg.fillStyle = "#2a1408"; lg.fillRect(0, 0, vw, vh); lg.globalAlpha = 1;
  lg.globalCompositeOperation = "destination-out";
  const flick = (gl) => 1 - (gl.flick || 0) * (0.5 + 0.5 * Math.sin(t / 70 + gl.X * 0.37) * Math.sin(t / 113 + gl.Y));
  for (const gl of L.glows) {
    const sx = gl.X - ox, sy = gl.Y - oy, r = gl.r * 1.6;
    if (sx < -r || sy < -r || sx > vw + r || sy > vh + r) continue;
    const gr = lg.createRadialGradient(sx, sy, 0, sx, sy, r);
    gr.addColorStop(0, `rgba(0,0,0,${0.9 * flick(gl)})`); gr.addColorStop(1, "rgba(0,0,0,0)");
    lg.fillStyle = gr; lg.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  lg.fillStyle = `rgba(0,0,0,${0.8 * (1 - night)})`;
  for (const w of L.wins) { lg.beginPath(); lg.moveTo(w[0] - ox, w[1] - oy); for (let i = 2; i < 8; i += 2) lg.lineTo(w[i] - ox, w[i + 1] - oy); lg.closePath(); lg.fill(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(lightCv, 0, 0);
  // warm pools and sunlight, added
  g.globalCompositeOperation = "lighter";
  for (const gl of L.glows) {
    const sx = gl.X - ox, sy = gl.Y - oy;
    if (sx < -gl.r || sy < -gl.r || sx > vw + gl.r || sy > vh + gl.r) continue;
    g.globalAlpha = (0.26 + night * 0.1) * (gl.k || 0.6) * flick(gl);
    g.drawImage(glowSprite(gl.col, gl.r), Math.round(sx - gl.r), Math.round(sy - gl.r));
  }
  if (night < 0.95) {
    for (const w of L.wins) {
      g.globalAlpha = 0.11 * (1 - night); g.fillStyle = "#fff0c8";
      g.beginPath(); g.moveTo(w[0] - ox, w[1] - oy); for (let i = 2; i < 8; i += 2) g.lineTo(w[i] - ox, w[i + 1] - oy); g.closePath(); g.fill();
      // the window's four panes, brighter inside the patch
      g.globalAlpha = 0.07 * (1 - night);
      for (const [p0, p1, q0, q1] of [[0.06, 0.46, 0.06, 0.46], [0.54, 0.94, 0.06, 0.46], [0.06, 0.46, 0.54, 0.94], [0.54, 0.94, 0.54, 0.94]]) {
        const P = (a, b) => [w[0] + (w[2] - w[0]) * a + (w[6] - w[0]) * b - ox, w[1] + (w[3] - w[1]) * a + (w[7] - w[1]) * b - oy];
        const c = [P(p0, q0), P(p1, q0), P(p1, q1), P(p0, q1)];
        g.beginPath(); g.moveTo(c[0][0], c[0][1]); for (let i = 1; i < 4; i++) g.lineTo(c[i][0], c[i][1]); g.closePath(); g.fill();
      }
    }
    // dust turning slowly in the sunlight
    const want = L.wins.length * 7;
    while (L.motes.length < want) L.motes.push(mote(L, Math.random()));
    g.fillStyle = "#fff6dc";
    for (const d of L.motes) {
      d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx += (Math.random() - 0.5) * dt * 4;
      if (d.life <= 0) Object.assign(d, mote(L, 1));
      g.globalAlpha = Math.min(1, d.life, (d.max - d.life) * 2) * 0.55 * (1 - night) * (0.6 + 0.4 * Math.sin(t / 300 + d.ph));
      g.fillRect(Math.round(d.x - ox), Math.round(d.y - oy), 1, 1);
    }
  }
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
}
function mote(L, k) {
  const w = L.wins[Math.floor(Math.random() * L.wins.length)], a = Math.random(), b = Math.random();
  const x = w[0] + (w[2] - w[0]) * a + (w[6] - w[0]) * b, y = w[1] + (w[3] - w[1]) * a + (w[7] - w[1]) * b - Math.random() * 30;
  const max = 3 + Math.random() * 4;
  return { x, y, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2, life: max * k, max, ph: Math.random() * 9 };
}

/** The floor patch a window's light falls on, in iso pixels (tile coords → tI). */
export function windowPatch(side, x, y, tI) {
  const q = side === "N"
    ? [[x + 0.12, 1], [x + 0.88, 1], [x + 0.88 + 1.1, 3.6], [x + 0.12 + 1.1, 3.6]]
    : [[1, y + 0.12], [3.8, y + 0.12 + 0.5], [3.8, y + 0.88 + 0.5], [1, y + 0.88]];
  return q.flatMap(([a, b]) => tI(a, b));
}
void mix; void tone;
