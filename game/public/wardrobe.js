/**
 * Cosmetics (외형): hats, tops, back pieces and face accessories drawn as layers
 * over the small animal adventurers of sprites.js, for every view (front, side,
 * back) and every frame of the person sheet.
 *
 * THE RULES every piece follows (tests/cosmetics.mjs checks them for every item ×
 * species × view × frame; ai/prompts/cosmetic-assets.md explains them for new art):
 *
 *  1. Nothing sits at fixed head coordinates. `anchors()` reads species.js
 *     (`headAnchor`, `faceAnchor`, `HEAD_BOB`): the head's top row and width, the ears'
 *     kind and roots, the eyes, the nose and the cheeks, the body's top row — so a
 *     piece follows the head through a walk and fits every head. Per-species fit lives
 *     in species.js (SPECIES, EARS), never in an item.
 *  2. Layer order per view (`dress`):
 *       front / side: back piece · body · top · clasp or straps · hat (crown, ears,
 *                     brim) · eyes put back · face piece
 *       back:         body · top · back piece (under the head) · hat
 *  3. Ears and hats: a hat says `ears: "through"` (ears poke through holes or stand
 *     behind a brim: they are put back over the crown) or "behind" (the hat covers
 *     them; tall ears, antlers and horns show only where they stand clear of it). A
 *     frog's eye bumps always stay on top: every hat sits between them. Small pieces (crown, bow, wreath, horns) sit in
 *     front of the ears; a halo floats above the highest ear.
 *  4. The eyes are never covered: after the hat, every eye pixel of the plain frame is
 *     put back (face pieces made to cover an eye — shades, a patch — come after).
 *  5. Ink: every piece's edge against the background is the dark INK outline; inside
 *     the figure, pieces are told apart from the fur by colour. When a piece's colour
 *     is too close to what it touches (a white hat on white fur), its edge darkens one
 *     step (`sep`). Face pieces read on dark masks too: rims turn light (`contrast`).
 *  6. Tops are drawn from small pixel templates (`TOP`), one per view, anchored to
 *     the feet: the head sinking on a breath hides the top row, a stretch shows it
 *     twice — the motif never flickers. Capes and wings move with the walk.
 */

/** species.js, when sprites.js hands it over (`useSpecies`): it knows where each head is. */
let SPC = null;
export function useSpecies(mod) { SPC = mod; }

const INK = "#2b2233";
const SZ = 32;
const GOLD = "#f0cc60", WHITE = "#f6f4fa";

// ───────────────────────────── colour ─────────────────────────────
function hex(c) { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function blend(a, b, t) {
  const p = hex(a), q = hex(b);
  return "#" + p.map((v, i) => Math.round(v * (1 - t) + q[i] * t).toString(16).padStart(2, "0")).join("");
}
/** Shadows lean violet, lights lean warm (as in sprites.js). */
const sh = (c, t = 0.22) => blend(c, "#4a3a76", t);
const li = (c, t = 0.35) => blend(c, "#fff6dc", t);
const lumOf = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const lum = (c) => lumOf(...hex(c));
const toHex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
/** Two colours too close to tell apart at one pixel. */
const near = (r1, g1, b1, r2, g2, b2) => Math.abs(lumOf(r1, g1, b1) - lumOf(r2, g2, b2)) < 0.07 && Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 60;

// ───────────────────────────── measuring a frame ─────────────────────────────
const isInkAt = (d, i) => d[i] === 0x2b && d[i + 1] === 0x22 && d[i + 2] === 0x33;
const FALLBACK_HEAD = { top: 18, x0: 11, x1: 20, rows: [5, 6, 6, 6, 6, 5], earTop: 14, ear: "tall", earIn: 13, bumps: false, eyeY: 20, ox: 0 };
/**
 * Where things are on this frame (rows already moved by the frame's head bob):
 * top / x0 / x1 the head's top row of fur and its span, `halfAt(y)` the head's
 * half-width on a row, earTop / ear / earIn the ears, eye / lx / rx the eye row and
 * the two eyes' columns, nx / ny the nose, cheekL / cheekR the cheeks, bt the body's
 * top row, foot the feet's row, `under(x, y)` the plain frame's pixel.
 */
export function anchors(base, o, view, f) {
  const bob = SPC && SPC.HEAD_BOB ? SPC.HEAD_BOB[f] | 0 : f === 1 ? 1 : f === 3 ? -1 : 0;
  const ha = SPC && SPC.headAnchor ? SPC.headAnchor(o || {}) : FALLBACK_HEAD;
  const fa = SPC && SPC.faceAnchor ? SPC.faceAnchor(o || {}, view) : { lx: view === "side" ? 14 : 12, rx: view === "side" ? 19 : 18, ey: 20, nx: view === "side" ? 17 : 15, ny: 22, cheekL: 10, cheekR: 21 };
  const d = base.getContext("2d").getImageData(0, 0, SZ, SZ).data;
  const side = view === "side", back = view === "back";
  const rows = ha.rows || FALLBACK_HEAD.rows, top = ha.top + bob;
  const halfAt = (y) => rows[Math.max(0, Math.min(rows.length - 1, y - top))];
  const A = {
    top, x0: ha.x0, x1: ha.x1, cx: 15.5, rows, halfAt,
    earTop: ha.earTop + bob, ear: ha.ear, earIn: ha.earIn, bumps: !!ha.bumps,
    eye: fa.ey + bob, lx: fa.lx, rx: fa.rx, nx: fa.nx, ny: fa.ny + bob, cheekL: fa.cheekL, cheekR: fa.cheekR,
    bt: 24 + bob, foot: 27, H: bob, f, side, back, front: !side && !back, view,
    fur: (o && o.fur) || "#fbfbff",
    under: (x, y) => { if (x < 0 || y < 0 || x >= SZ || y >= SZ) return null; const i = (y * SZ + x) * 4; return d[i + 3] ? [d[i], d[i + 1], d[i + 2]] : null; },
  };
  /** The mean brightness of the plain frame over a box (what a rim sits on). */
  A.lumBox = (x0, y0, x1, y1) => {
    let s = 0, n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const p = A.under(x, y); if (p) { s += lumOf(...p); n++; } }
    return n ? s / n : 1;
  };
  if (o && o.anchor) Object.assign(A, typeof o.anchor === "function" ? o.anchor(view, f) : o.anchor);
  return A;
}

// ───────────────────────────── painting ─────────────────────────────
function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = SZ;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return [c, g];
}
/** A painter for one layer, measured from the frame's anchors. */
function brush(g, A) {
  /** A rect; `col` may be a function (x, y) → colour, for pieces that adapt to what lies under each pixel. */
  const r = (x, y, w, h, col) => {
    if (w <= 0 || h <= 0 || !col) return;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (typeof col === "function") { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { g.fillStyle = col(x + i, y + j); g.fillRect(x + i, y + j, 1, 1); } return; }
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  const c0 = Math.floor(A.cx + 0.5);
  /** A rect centred on the head. */
  const cr = (y, w, h, col, dx = 0) => r(Math.round(A.cx + 0.5 - w / 2 + dx), y, w, h, col);
  /** The same rect on both sides of the head's centre, `off` pixels out. */
  const sym = (off, y, w, h, col, colR = col) => { r(c0 + off, y, w, h, colR); r(c0 - off - w, y, w, h, col); };
  const px = (x, y, col) => r(x, y, 1, 1, col);
  /** A pixel template: `rows` of characters looked up in `pal` ('.' or a missing key: nothing); `flip` mirrors it. */
  const grid = (x, y, rows, pal, flip = false) => rows.forEach((s, j) => {
    for (let i = 0; i < s.length; i++) { const col = pal[s[i]]; if (col) r(flip ? x + s.length - 1 - i : x + i, y + j, 1, 1, col); }
  });
  return { r, cr, sym, px, grid, c0, g };
}
/**
 * Lay one layer onto `g`: paint it with `fn(b, A, pal)`, keep only the pixels `opt.keep(x, y)`
 * allows, darken edges that would melt into what they touch (`opt.sep`, on by default), then ink.
 * `opt.ink`: "all" inks every empty pixel beside it; "out" only where the picture so far is empty;
 * "hat" where the plain frame is empty or above the head's top row; "none" leaves it bare.
 */
function layer(g, fn, A, pal, opt = {}) {
  if (!fn) return;
  const [c, lg] = canvas();
  fn(brush(lg, A), A, pal);
  const img = lg.getImageData(0, 0, SZ, SZ), d = img.data;
  const ud = g.getImageData(0, 0, SZ, SZ).data;
  if (opt.keep) for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) { const i = (y * SZ + x) * 4; if (d[i + 3] && !opt.keep(x, y)) d[i + 3] = 0; }
  if (opt.sep !== false) {
    const dark = [], only = opt.sepOnly ? new Set(opt.sepOnly.map((c) => c.toLowerCase())) : null;
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const i = (y * SZ + x) * 4;
      if (!d[i + 3] || (only && !only.has(toHex(d[i], d[i + 1], d[i + 2])))) continue;
      for (const [u, v] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (u < 0 || v < 0 || u >= SZ || v >= SZ) continue;
        const k = (v * SZ + u) * 4;
        if (d[k + 3] || !ud[k + 3] || isInkAt(ud, k)) continue;
        if (near(d[i], d[i + 1], d[i + 2], ud[k], ud[k + 1], ud[k + 2])) { dark.push(i); break; }
      }
    }
    for (const i of dark) { const [r, gg, b] = hex(sh(toHex(d[i], d[i + 1], d[i + 2]), 0.42)); d[i] = r; d[i + 1] = gg; d[i + 2] = b; }
  }
  lg.putImageData(img, 0, 0);
  const mode = opt.ink || "all";
  if (mode !== "none") {
    const solid = (x, y) => x >= 0 && y >= 0 && x < SZ && y < SZ && d[(y * SZ + x) * 4 + 3] > 0;
    lg.fillStyle = opt.col || INK;
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      if (solid(x, y)) continue;
      if (!(solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) continue;
      const k = (y * SZ + x) * 4;
      if (mode === "out" && ud[k + 3]) continue;
      if (mode === "hat" && ud[k + 3] && y >= A.top && !isInkAt(ud, k)) continue;
      if (opt.keep && !opt.keep(x, y)) continue;
      lg.fillRect(x, y, 1, 1);
    }
  }
  g.drawImage(c, 0, 0);
}
/**
 * Put back what stands above the head's top row over a hat's crown: the ears ("through"), or
 * only a frog's eye bumps (`bumpsOnly`: its eyes live on them, so every hat sits between them).
 * The head's own outline row is left to the hat.
 */
function ears(g, base, A, bumpsOnly) {
  if (bumpsOnly && !A.bumps) return;
  if ((A.ear === "none" || A.ear === "side") && !A.bumps) return;
  const [c, eg] = canvas();
  const d = base.getContext("2d").getImageData(0, 0, SZ, SZ).data, out = eg.createImageData(SZ, SZ), o = out.data;
  for (let y = 0; y < A.top; y++) for (let x = 0; x < SZ; x++) {
    const i = (y * SZ + x) * 4;
    if (!d[i + 3]) continue;
    if (y === A.top - 1 && isInkAt(d, i)) continue;
    o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = 255;
  }
  eg.putImageData(out, 0, 0);
  g.drawImage(c, 0, 0);
}
let EYE_SET = null;
/** The eye boxes of a frame (front and side views): both eyes, a pixel round, brows included. */
export function eyeBoxes(A) {
  if (A.back) return [];
  return [A.lx, A.rx].map((x) => [x - 1, A.eye - 2, x + 2, A.eye + 1]);
}
/** Is this colour one an eye is drawn in (species.js EYE_PIX)? */
export function isEyePix(r, g, b) {
  if (!EYE_SET) EYE_SET = new Set(((SPC && SPC.EYE_PIX) || ["#2b2233", "#ffffff"]).map((c) => c.toLowerCase()));
  return EYE_SET.has(toHex(r, g, b));
}
/** Put back every eye pixel of the plain frame inside the head (nothing worn on the head may hide the eyes). */
function guardEyes(g, base, A) {
  const d = base.getContext("2d").getImageData(0, 0, SZ, SZ).data;
  for (const [x0, y0, x1, y1] of eyeBoxes(A)) for (let y = y0; y <= y1; y++) {
    const h = A.halfAt(y);
    for (let x = Math.max(x0, 16 - h); x <= Math.min(x1, 15 + h); x++) {
      const i = (y * SZ + x) * 4;
      if (!d[i + 3] || !isEyePix(d[i], d[i + 1], d[i + 2])) continue;
      g.fillStyle = toHex(d[i], d[i + 1], d[i + 2]); g.fillRect(x, y, 1, 1);
    }
  }
}

// ───────────────────────────── hats ─────────────────────────────
// `draw` goes under the ears, `over` in front of them. T is the head's top row, W its width there.

const HAT = {
  // a knit cap with a turned-up ribbed band and a bobble; ears come out through holes
  beanie: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W, 1, p.c); b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 3, Math.max(2, W - 6), 1, p.c);
      b.r(A.x1 - 2, T - 2, 2, 2, sh(p.c)); b.r(A.x0 + 1, T - 2, 2, 1, li(p.c, 0.25));
      b.cr(T, W + 2, 2, p.b); for (let x = A.x0; x <= A.x1; x += 2) b.px(x, T + 1, sh(p.b));
      b.cr(T - 5, 2, 2, p.p); b.px(Math.round(A.cx), T - 4, sh(p.p, 0.18));
    },
  },
  // a wide straw brim, a ribbon round the crown; ears poke up through the crown
  straw: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top;
      b.cr(T - 4, 8, 1, p.c); b.cr(T - 3, 8, 1, p.c); b.cr(T - 2, 8, 1, p.b); b.r(Math.round(A.cx + 2), T - 4, 2, 2, sh(p.c));
      b.r(Math.round(A.cx - 3), T - 4, 2, 1, li(p.c, 0.3));
    },
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W + 6, 1, li(p.c, 0.2)); b.cr(T, W + 4, 1, sh(p.c));
      for (let x = Math.round(A.cx + 0.5 - (W + 6) / 2) + 1; x <= Math.round(A.cx + (W + 6) / 2) - 1; x += 3) b.px(x, T - 1, p.c);
    },
  },
  // a tall cone that bends at the tip, a band, a star
  wizard: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, k = A.side ? -1 : 1;
      const rows = [[2, 10], [3, 8], [4, 6], [5, 5], [6, 4], [7, 3], [8, 3], [9, 2]];
      for (const [dy, w] of rows) b.cr(T - dy, w, 1, p.c, dy >= 7 ? k * (dy - 6) : 0);
      b.cr(T - 10, 2, 1, p.c, k * 4);
      for (const [dy, w] of rows.slice(1, 5)) b.r(Math.round(A.cx + 0.5 + w / 2 - 2), T - dy, 2, 1, sh(p.c));
      b.cr(T - 2, 10, 1, p.b);
      if (!A.back) { b.px(Math.round(A.cx) - 1, T - 5, p.s); b.px(Math.round(A.cx) - 1, T - 4, p.s); }
    },
    over(b, A, p) { const W = A.x1 - A.x0 + 1; b.cr(A.top - 1, W + 4, 1, p.c); b.cr(A.top, W + 2, 1, sh(p.c)); },
  },
  // a small crown in front of the ears
  crown: {
    over(b, A, p) {
      const T = A.top;
      b.cr(T - 1, 6, 1, sh(p.c, 0.15)); b.cr(T - 2, 6, 1, p.c);
      b.sym(2, T - 3, 1, 1, p.c); b.sym(0, T - 3, 1, 1, p.c);
      b.sym(2, T - 4, 1, 1, li(p.c));
      if (!A.back) b.cr(T - 2, 2, 1, p.g);
      b.r(Math.round(A.cx + 1.5), T - 2, 2, 1, sh(p.c));
    },
  },
  // a wreath of flowers lying across the head
  wreath: {
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W, 1, "#5aa84a"); b.cr(T, 2, 1, "#3e7a46", -W / 2 + 1); b.cr(T, 2, 1, "#3e7a46", W / 2 - 1);
      for (const dx of [-W / 2 + 1, 0, W / 2 - 1]) { b.cr(T - 2, 2, 2, p.c, dx); b.cr(T - 2, 1, 1, p.b, dx); }
    },
  },
  // a big ribbon bow on top
  bow: {
    over(b, A, p) {
      const T = A.top;
      b.sym(1, T - 3, 3, 3, p.c); b.sym(1, T - 1, 3, 1, sh(p.c)); b.sym(3, T - 4, 1, 1, p.c);
      b.cr(T - 2, 2, 2, sh(p.c, 0.35)); b.sym(1, T - 3, 1, 1, li(p.c));
    },
  },
  // a baseball cap; its visor faces the way the head does
  cap: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 1, W, 2, p.c); b.r(A.x1 - 2, T - 2, 2, 3, sh(p.c));
      b.r(A.x0 + 1, T - 2, 2, 1, li(p.c, 0.3));
      b.cr(T - 3, 2, 1, p.b);
      if (A.front) b.cr(T + 1, W - 2, 1, p.b);
      if (A.side) { b.r(A.x1 - 1, T, 5, 1, p.b); b.r(A.x1 + 1, T + 1, 3, 1, sh(p.b, 0.3)); }
      if (A.back) b.cr(T, 2, 1, sh(p.c, 0.5));
    },
  },
  // a pirate's tricorn with a skull; it covers the ears
  tricorn: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T, W, 1, p.c); b.cr(T - 1, W + 4, 1, p.c); b.cr(T - 2, W - 2, 1, p.c);
      b.sym(Math.ceil(W / 2) - 1, T - 3, 3, 1, p.c); b.cr(T - 3, 4, 1, p.c); b.cr(T - 4, 2, 1, p.c);
      b.cr(T - 1, W + 4, 1, p.b); b.cr(T - 1, W + 2, 1, p.c);
      if (!A.back) { b.cr(T - 2, 2, 1, "#f4f0e8"); b.cr(T - 1, 2, 1, "#f4f0e8"); }
    },
  },
  // a Santa hat flopping backward, white trim and pompom
  santa: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, k = A.side ? -1 : 1;
      b.cr(T - 1, W, 1, p.c); b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 3, W - 4, 1, p.c, k);
      b.cr(T - 4, 4, 1, p.c, k * 3); b.cr(T - 3, 2, 1, sh(p.c), k * 3); b.r(A.x0 + 1, T - 2, 2, 1, li(p.c, 0.25));
      b.cr(T, W + 2, 1, "#f4f0f4"); b.cr(T - 4, 2, 2, "#f4f0f4", k * 6);
    },
  },
  // an open-faced knight's helm with cheek guards and a plume
  helm: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 1, W + 2, 2, p.c); b.cr(T + 1, W + 2, 1, sh(p.c));
      b.sym(Math.ceil(W / 2), T + 2, 1, Math.min(2, A.ny - T - 2), sh(p.c));   // cheek guards stop above the nose
      b.cr(T - 1, W - 4, 1, li(p.c)); b.cr(T - 2, 2, 1, li(p.c, 0.5));
      const k = A.side ? -1 : 1;
      b.cr(T - 3, 2, 1, p.b); b.cr(T - 4, 2, 1, p.b, -k); b.cr(T - 5, 3, 1, p.b, -k * 2); b.cr(T - 4, 2, 1, sh(p.b), -k * 3);
    },
  },
  // a frog hat, two goggle eyes on top
  frog: {
    ears: "behind", bumps: false,
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, k = A.side ? 1 : 0;
      b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 1, W + 2, 2, p.c); b.cr(T + 1, W + 2, 1, sh(p.c));
      b.sym(2, T - 4, 3, 3, p.c); b.r(A.x0 + 1, T - 2, 2, 1, li(p.c, 0.3));
      if (!A.back) { b.sym(2, T - 4, 2, 2, "#ffffff"); b.px(Math.floor(A.cx) + 3 + k, T - 3, INK); b.px(Math.floor(A.cx) - 4 + k, T - 3, INK); b.cr(T, 4, 1, "#e0606a", k); }
    },
  },
  // a halo of light floating over the head and the ears
  halo: {
    ink: "#a8742e",
    over(b, A, p) {
      const T = Math.min(A.top, A.earTop) - 5 + (A.f === 1 ? 1 : 0);
      b.cr(T, 6, 1, p.c); b.sym(3, T + 1, 1, 1, p.c); b.cr(T + 2, 6, 1, sh(p.c, 0.15)); b.cr(T, 2, 1, li(p.c, 0.6), -1);
    },
  },
  // two little devil horns, set at the forehead's edges in front of the ears
  horns: {
    over(b, A, p) {
      const T = A.top, o = Math.max(1, Math.min(2, Math.floor((A.x1 - A.x0 + 1) / 2) - 3));
      b.sym(o, T - 2, 2, 2, p.c); b.sym(o + 1, T - 3, 1, 1, p.c); b.sym(o + 1, T - 4, 1, 1, li(p.c));
      b.sym(o, T - 1, 2, 1, sh(p.c));
    },
  },
  // a tall puffed chef's hat; it covers the ears
  chef: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W - 2, 2, "#f4f4fa"); b.cr(T, W - 2, 1, "#d8d6e6");
      b.cr(T - 5, W, 4, "#ffffff"); b.cr(T - 6, W - 4, 1, "#ffffff");
      b.r(A.x1 - 2, T - 5, 2, 4, "#dcdaea"); b.cr(T - 6, 1, 1, "#dcdaea", 1); b.cr(T - 2, W - 4, 1, "#e8e6f2");
    },
  },
  // a beret, tipped to one side, with a stalk
  beret: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, k = A.side ? -1 : 1;
      b.cr(T - 1, W + 2, 1, p.c, k); b.cr(T - 2, W, 1, p.c, k); b.cr(T, W, 1, sh(p.c));
      b.cr(T - 3, 1, 1, p.c, k);
      b.r(A.x1 - 1 + k, T - 2, 2, 2, sh(p.c)); b.r(A.x0 + 1 + k, T - 2, 2, 1, li(p.c, 0.3));
    },
  },
};

// ───────────────────────────── tops ─────────────────────────────
// Templates eight pixels wide (columns 12–19; the body is 13–18), rows [top, middle, bottom]
// anchored to the feet: on a breath the head hides the top row, on a stretch it shows twice.
// An optional fourth row is the hem at the feet's row (between the feet: a long garment), and
// `nape` a row over the back of the head's lowest row (a hood) in the back view.
// Colours: c main, s shade, d deep shade, l light, b accent, B accent shade, w white, y gold,
// r red, k ink. Every top needs a clear motif in front, side and back.

const TOP = {
  overalls: {
    front: [".bcbbcb.", ".cyccyc.", ".ccsscc."], side: [".bbbbcb.", ".scccyc.", ".sccscc."], back: [".bcbbcb.", ".ccsscc.", ".ccsscc."],
  },
  hoodie: {
    front: [".cwccwc.", ".cccccc.", ".cssssc."], side: [".scccwc.", ".sccccc.", ".scsssc."], back: [".sccccs.", ".cccccc.", ".sccccs."], nape: "..lccl..",
  },
  sailor: {
    pal: (p) => ({ c: WHITE, s: sh(WHITE, 0.3), n: p.c, N: sh(p.c), r: "#e04a4a" }),
    front: [".nnrrnn.", ".ccrccc.", ".NNNNNN."], side: [".cnnnrn.", ".cccccr.", ".NNNNNN."], back: [".nccccn.", ".nnnnnn.", ".NNNNNN."],
  },
  armor: {
    pal: (p) => ({ c: p.c, s: sh(p.c), l: li(p.c, 0.5), b: "#6a4434", y: GOLD }),
    front: [".lllccs.", ".lcclcs.", ".bbybbb."], side: [".scllll.", ".sccclc.", ".bbbbyb."], back: [".sllccs.", ".scccss.", ".bbbbbb."],
  },
  robe: {
    front: [".ccbbcc.", ".scbbcs.", "sccbbccs", "...bb..."], side: [".scccbc.", ".scccbc.", "ssccbcc.", "...cc..."], back: [".lccccl.", ".csccsc.", "sccsccss", "...cc..."],
  },
  dress: {
    front: [".lccccl.", ".bbBBbb.", "sccccccs"], side: [".sccccl.", ".bbbbBb.", "sccccccl"], back: [".cccccc.", ".bBbbBb.", "sccssccs"],
  },
  suit: {
    pal: (p) => ({ c: p.c, s: sh(p.c, 0.3), l: li(p.c, 0.25), w: WHITE, b: p.b }),
    front: [".cwbbwc.", ".llbbll.", ".ccsscc."], side: [".sccwwb.", ".scclcb.", ".scccsc."], back: [".cccccc.", ".ccsscc.", ".ccsscc."],
  },
  hanbok: {
    pal: (p) => ({ c: p.c, s: sh(p.c), w: WHITE, r: "#e0405a", b: p.b, B: sh(p.b) }),
    front: [".cwccwc.", ".cccrrc.", "BbbbbbbB", "...bb..."], side: [".scccwc.", ".sccccr.", "Bbbbbbbb", "...bb..."], back: [".cccccc.", ".sccccs.", "BbbbbbbB", "...bb..."],
  },
  vest: {
    pal: (p) => ({ c: p.c, s: sh(p.c), l: li(p.c, 0.55), b: p.b }),
    front: [".lcbbcl.", ".ccbbcc.", ".lclclc."], side: [".lcccbb.", ".scccbb.", ".lclclc."], back: [".lccccl.", ".cccccc.", ".lclclc."],
  },
  pajama: {
    pal: (p) => ({ c: p.c, s: sh(p.c), l: li(p.c, 0.6), b: p.b }),
    front: [".clcclc.", ".cbcccc.", ".ccccbc."], side: [".sccclc.", ".scbccc.", ".scccbc."], back: [".cccccc.", ".ccccbc.", ".cbcccc."],
  },
};
/** The colours a top template reads. */
const topPal = (t, p) => ({ c: p.c, s: sh(p.c), d: sh(p.c, 0.45), l: li(p.c, 0.3), b: p.b || p.c, B: sh(p.b || p.c), w: WHITE, y: GOLD, r: "#e04a4a", k: INK, ...(t.pal ? t.pal(p) : {}) });
/** Draw a top template on the body of this frame. */
function wearTop(t) {
  return (b, A, p) => {
    const rows = t[A.view] || t.front, pal = topPal(t, p);
    const n = A.foot - A.bt, [T, M, B, F] = rows;
    const body = n <= 2 ? [M, B] : n === 3 ? [T, M, B] : [T, T, M, B];
    body.forEach((s, i) => b.grid(12, A.foot - body.length + i, [s], pal));
    if (F) b.grid(12, A.foot, [F], pal);
    if (A.back && t.nape) b.grid(12, A.bt - 1, [t.nape], pal);
  };
}

// ───────────────────────────── back pieces ─────────────────────────────
// Drawn behind the body in front and three-quarter views, over the body but under the head
// from the back. They swing with the walk: `sway` is +1 on one step, −1 on the other.

const sway = (A) => (A.f === 2 ? 1 : A.f === 4 ? -1 : 0);
/**
 * A pair of wings from the shoulder blades, drawn from a left-wing template whose bottom-right
 * pixel is the root (on the body's top row, beside the body). They rise past the head so they
 * read beside it, and beat with the walk: up on a breath and the first step, down on the
 * stretch and the second. In a three-quarter view the near wing trails behind the back and the
 * far one shows its tip over the other shoulder, a shade darker.
 */
function wingPair(rows, palOf) {
  return (b, A, p) => {
    const pal = palOf(p), w = rows[0].length, h = rows.length;
    const flap = A.f === 1 || A.f === 2 ? -1 : A.f === 3 || A.f === 4 ? 1 : 0;
    const y = A.bt + 2 - h + flap;
    if (A.side) {
      b.grid(13 - w + 1, y, rows, pal);
      b.grid(19, y - 1, rows.slice(0, Math.max(2, h - 4)), { ...pal, c: pal.s, l: pal.c }, true);
      return;
    }
    b.grid(12 - w + 1, y, rows, pal);
    b.grid(19, y, rows, pal, true);
    // the roots stay on the body whatever the beat
    b.r(11, A.bt, 2, 2, pal.c); b.r(19, A.bt, 2, 2, pal.c);
    if (A.back) { b.r(13, A.bt, 1, 2, pal.s); b.r(18, A.bt, 1, 2, pal.s); }
  };
}
const BACK = {
  cape: (b, A, p) => {
    const sw = sway(A), last = A.foot - 1, n = last - A.bt;
    const dk = sh(p.c, 0.3), dd = sh(p.c, 0.5);
    if (A.side) {
      // trailing behind the back, widening toward the hem, the hem flicking with the step
      for (let y = A.bt; y <= last; y++) {
        const k = n ? (y - A.bt) / n : 1, x0 = 12 - Math.round(k * 3) - (y === last ? sw + 1 : 0);
        b.r(x0, y, 14 - x0, 1, y === last ? dk : p.c);
        b.px(x0 + 1, y, y > A.bt ? dk : p.c);
      }
      return;
    }
    for (let y = A.bt - (A.back ? 1 : 0); y <= last; y++) {
      const k = n ? Math.max(0, y - A.bt) / n : 1, half = 3 + Math.round(k * 2), s = y >= last - 1 ? sw : 0;
      const x0 = 16 - half + s, w = half * 2;
      if (!A.back) { b.r(x0, y, w, 1, y === last ? dd : dk); continue; }
      b.r(x0, y, w, 1, p.c);
      if (y > A.bt) { b.px(14 + s, y, dk); b.px(17 + s, y, dk); }
      if (y === A.bt) { b.px(x0, y, li(p.c, 0.3)); b.px(x0 + 1, y, li(p.c, 0.3)); }
      if (y === last) for (let x = x0; x < x0 + w; x += 2) b.px(x, y, dk);
    }
  },
  // feathered: a rounded leading edge up top, three feather tips along the bottom
  angel: wingPair([
    ".ll.....",
    "lccl....",
    "lcccl...",
    "ccsccl..",
    "cscccc..",
    "sccscc..",
    ".s.cscc.",
    "...s.ccc",
    "......cc",
  ], (p) => ({ c: p.c, l: "#ffffff", s: p.b })),
  // leathery: a bone along the top from the claw, the membrane scalloped between the fingers
  bat: wingPair([
    "l.......",
    "cl......",
    "ccl.....",
    "cccll...",
    "ccccsll.",
    "c.ccccsl",
    "...c.ccc",
    "......cc",
  ], (p) => ({ c: p.c, l: p.b, s: sh(p.c, 0.3) })),
  // two little lobes, the upper one pale with a glint, the lower one tinted
  fairy: wingPair([
    ".cc...",
    "clcc..",
    "cclcc.",
    ".cccc.",
    "..ccs.",
    ".bbb.c",
    "bbbs.c",
    ".bb...",
  ], (p) => ({ c: p.c, l: li(p.c, 0.7), b: p.b, s: sh(p.c, 0.25) })),
  pack: (b, A, p) => {
    const y = A.bt, dk = sh(p.c, 0.3), last = A.foot - 1;
    if (A.back) {
      b.r(13, y - 1, 6, last - y + 2, p.c); b.r(13, y - 1, 6, 2, dk); b.px(15, y + 1, GOLD); b.px(16, y + 1, GOLD);
      b.r(13, last, 6, 1, dk); b.r(12, y, 1, last - y, sh(p.c, 0.45)); b.r(19, y, 1, last - y, sh(p.c, 0.45));
      b.r(14, y - 1, 4, 1, "#7a9a5a");
    } else if (A.side) {
      b.r(9, y - 1, 4, last - y + 2, p.c); b.r(9, y - 1, 4, 1, dk); b.px(10, y + 1, GOLD); b.r(9, last, 4, 1, dk);
      b.r(10, y - 2, 3, 1, "#7a9a5a");
    } else b.r(13, y - 1, 6, 2, p.c);        // from the front: only the top of the bag over the shoulders (the straps are BACK_FRONT)
  },
  // bigger and spikier than a bat's: a horn at the wrist, two finger spines, a ragged edge
  dragon: wingPair([
    "l........",
    "ll.......",
    "cll......",
    "ccsll....",
    "cccssll..",
    "cccccsll.",
    "c.ccc.ccl",
    "...c..ccc",
    ".......cc",
  ], (p) => ({ c: p.c, l: p.b, s: sh(p.c, 0.3) })),
};
/** What a back piece shows in front of the body (a cape's collar and clasp, a pack's straps), front and side views. */
const BACK_FRONT = {
  cape: (b, A, p) => {
    const y = A.bt;
    if (A.side) { b.r(14, y, 4, 1, p.c); b.px(17, y, GOLD); return; }
    b.r(13, y, 6, 1, p.c); b.px(13, y, sh(p.c)); b.px(18, y, sh(p.c)); b.cr(y, 2, 1, GOLD);
  },
  pack: (b, A, p) => {
    const y = A.bt, st = sh(p.c, 0.35);
    if (A.side) { b.r(15, y, 1, A.foot - y, st); return; }
    b.r(14, y, 1, A.foot - y, st); b.r(17, y, 1, A.foot - y, st);
  },
};

// ───────────────────────────── face ─────────────────────────────
// On the species' own eye, nose and cheek positions (faceAnchor). Rims turn light on a dark
// mask so they still read. `covers`: made to cover an eye. `back`: drawn from behind too.

/**
 * A rim colour that reads on what each of its pixels sits on: the item's own colour, turned
 * light over a dark patch or dark fur (a panda's eye patches, a raccoon's mask) and dark over
 * a pale face when the item itself is pale.
 */
function rim(A, c) {
  const L = lum(c), light = blend(c, "#f4ecd8", 0.78), dark = sh(c, 0.6);
  return (x, y) => {
    const p = A.under(x, y);
    if (!p) return c;
    const u = lumOf(...p);
    if (Math.abs(L - u) >= 0.25) return c;
    return u < 0.5 ? light : dark;
  };
}
const FACE = {
  glasses: {
    back: true,
    draw(b, A, p) {
      if (A.back) { const y = A.eye; b.px(A.x0 + 0, y, p.c); b.px(A.x1, y, p.c); return; }
      const e = A.eye, c = rim(A, p.c);
      const ring = (x) => { b.r(x, e - 1, 3, 1, c); b.r(x, e + 2, 3, 1, c); b.r(x - 1, e, 1, 2, c); b.r(x + 3, e, 1, 2, c); };
      const L = A.lx - 1, R = A.rx - 1;
      ring(L); ring(R);
      if (R - L > 4) b.r(L + 4, e, R - L - 4, 1, c);
      if (A.side) b.r(16 - A.halfAt(e), e, L - 1 - (16 - A.halfAt(e)), 1, c);
    },
  },
  shades: {
    covers: true, back: true,
    draw(b, A, p) {
      if (A.back) { b.px(A.x0, A.eye, p.c); b.px(A.x1, A.eye, p.c); return; }
      // the lenses lighten a little on a dark mask, and the frame takes the light rim there
      const e = A.eye, dark = A.lumBox(A.lx - 1, e, A.rx + 2, e + 1) < 0.45;
      const lens = dark ? "#4a4a64" : p.c, fr = rim(A, sh(p.c, 0.2));
      for (const x of [A.lx - 1, A.rx - 1]) { b.r(x, e, 4, 2, lens); b.px(x + 1, e, li(lens, 0.75)); b.r(x, e - 1, 4, 1, fr); }
      b.r(A.lx + 3, e, A.rx - A.lx - 4, 1, fr);
      if (A.side) b.r(16 - A.halfAt(e), e, A.lx - 1 - (16 - A.halfAt(e)), 1, fr);
    },
  },
  patch: {
    covers: true, back: true,
    draw(b, A, p) {
      const e = A.eye, st = rim(A, "#3a3040");
      if (A.back) { b.r(A.x0, e - 1, A.x1 - A.x0 + 1, 1, st); return; }
      const R = A.rx - 1;
      b.r(R, e - 1, 4, 3, p.c); b.px(R + 1, e - 1, li(p.c, 0.4));
      if (A.lumBox(R, e - 1, R + 3, e + 1) < 0.4) b.r(R, e + 2, 4, 1, "#c8b8a8");
      b.r(16 - A.halfAt(e - 2), e - 2, R - (16 - A.halfAt(e - 2)), 1, st);
    },
  },
  bandage: {
    draw(b, A, p) {
      if (A.back) return;
      const x = Math.min(A.rx + 1, A.cheekR - 3), y = A.ny;
      b.r(x, y, 3, 1, p.c); b.px(x + 1, y - 1, sh(p.c, 0.1)); b.px(x + 1, y, sh(p.c, 0.3));
    },
  },
  mask: {
    back: true,
    draw(b, A, p) {
      if (A.back) { b.px(A.x0, A.ny, sh(p.c, 0.2)); b.px(A.x1, A.ny, sh(p.c, 0.2)); return; }
      const y = A.ny, x0 = A.nx - 3;
      b.r(x0, y, 8, 2, p.c); b.r(x0, y + 1, 8, 1, sh(p.c, 0.12)); b.r(x0 + 2, y, 4, 1, li(p.c, 0.3));
      b.px(x0, y, sh(p.c, 0.3)); b.px(x0 + 7, y, sh(p.c, 0.3));
    },
  },
  heart: {
    draw(b, A, p) {
      if (A.back) return;
      const y = A.ny;
      for (const x of A.side ? [A.cheekR - 3] : [A.cheekL, A.cheekR - 2]) { b.px(x, y, p.c); b.px(x + 2, y, p.c); b.r(x, y + 1, 3, 1, sh(p.c, 0.1)); b.px(x + 1, y + 2, sh(p.c, 0.2)); b.px(x, y, li(p.c, 0.4)); }
    },
  },
  monocle: {
    draw(b, A, p) {
      if (A.back) return;
      const e = A.eye, R = A.rx - 1, c = rim(A, p.c);
      b.r(R, e - 1, 3, 1, c); b.r(R, e + 2, 3, 1, c); b.r(R - 1, e, 1, 2, c); b.r(R + 3, e, 1, 2, c);
      b.r(R + 3, e + 2, 1, 2, rim(A, sh(p.c, 0.3))); b.px(R + 1, e - 1, li(p.c, 0.5));
    },
  },
  stache: {
    draw(b, A, p) {
      if (A.back) return;
      const y = A.ny + 1, x = A.nx - 2, c = rim(A, p.c);
      b.r(x, y, 6, 1, c); b.px(x - 1, y - 1, c); b.px(x + 6, y - 1, c); b.r(x + 2, y, 2, 1, rim(A, sh(p.c, 0.2)));
    },
  },
};

// ───────────────────────────── the catalogue's art ─────────────────────────────
// id → [slot, design, palette]. The server's catalogue (logic.js COSMETICS) gives
// names, rarity, price and where each is found; tests check the two agree.

export const ART = {
  // hats
  hat_beanie_red: ["hat", "beanie", { c: "#e0505a", b: "#f07a7a", p: "#fff4f4" }],
  hat_beanie_navy: ["hat", "beanie", { c: "#3a4a8a", b: "#5a6ab0", p: "#e8ecff" }],
  hat_beanie_mint: ["hat", "beanie", { c: "#5ac8a0", b: "#8ae0c0", p: "#ffffff" }],
  hat_straw: ["hat", "straw", { c: "#ecc878", b: "#e04a4a" }],
  hat_straw_blue: ["hat", "straw", { c: "#ecc878", b: "#4a7ae0" }],
  hat_wizard: ["hat", "wizard", { c: "#6a4ab0", b: "#f0cc60", s: "#fff0a0" }],
  hat_wizard_night: ["hat", "wizard", { c: "#2e3a6a", b: "#9ab4ff", s: "#e8f4ff" }],
  hat_crown: ["hat", "crown", { c: "#f0c040", g: "#e0405a" }],
  hat_crown_silver: ["hat", "crown", { c: "#d4dae6", g: "#5ab8ff" }],
  hat_wreath_pink: ["hat", "wreath", { c: "#ff9ac0", b: "#fff0a0" }],
  hat_wreath_sun: ["hat", "wreath", { c: "#ffd84a", b: "#e8742a" }],
  hat_bow_red: ["hat", "bow", { c: "#e8404a" }],
  hat_bow_pink: ["hat", "bow", { c: "#ff8ab4" }],
  hat_cap_blue: ["hat", "cap", { c: "#3a6ad0", b: "#f4f4fa" }],
  hat_cap_red: ["hat", "cap", { c: "#d84a3a", b: "#2b2a3a" }],
  hat_tricorn: ["hat", "tricorn", { c: "#3a3440", b: "#c8a040" }],
  hat_santa: ["hat", "santa", { c: "#e0303a" }],
  hat_helm: ["hat", "helm", { c: "#b4bcc9", b: "#e0404a" }],
  hat_frog: ["hat", "frog", { c: "#6ac850" }],
  hat_halo: ["hat", "halo", { c: "#ffe680" }],
  hat_horns: ["hat", "horns", { c: "#c83a4a" }],
  hat_chef: ["hat", "chef", {}],
  hat_beret: ["hat", "beret", { c: "#c83a4a" }],
  hat_beret_black: ["hat", "beret", { c: "#34303e" }],
  // tops
  top_overalls: ["top", "overalls", { c: "#4a72c0", b: "#f6f0e0" }],
  top_hoodie_grey: ["top", "hoodie", { c: "#9a9cac" }],
  top_hoodie_pink: ["top", "hoodie", { c: "#f49ab8" }],
  top_sailor: ["top", "sailor", { c: "#2e3a7a" }],
  top_armor: ["top", "armor", { c: "#a8b0c0" }],
  top_robe: ["top", "robe", { c: "#6a4ab0", b: "#f0cc60" }],
  top_robe_green: ["top", "robe", { c: "#3a8a5a", b: "#e8f0d0" }],
  top_dress_pink: ["top", "dress", { c: "#ff9ac0", b: "#e0405a" }],
  top_dress_white: ["top", "dress", { c: "#f4f2fa", b: "#7ab0f0" }],
  top_suit: ["top", "suit", { c: "#2e3448", b: "#e0303a" }],
  top_hanbok: ["top", "hanbok", { c: "#f0d048", b: "#e04a6a" }],
  top_vest: ["top", "vest", { c: "#9a6a48", b: "#f4ead2" }],
  top_pajama: ["top", "pajama", { c: "#9ac0f0", b: "#fff0a0" }],
  // back
  back_cape_red: ["back", "cape", { c: "#d0404a" }],
  back_cape_blue: ["back", "cape", { c: "#3a5ab0" }],
  back_cape_black: ["back", "cape", { c: "#3a3448" }],
  back_angel: ["back", "angel", { c: "#f8f8ff", b: "#c8cce8" }],
  back_bat: ["back", "bat", { c: "#5a3a7a", b: "#8a5ab0" }],
  back_fairy: ["back", "fairy", { c: "#a8f0f0", b: "#f4b8f0" }],
  back_pack: ["back", "pack", { c: "#c07a48" }],
  back_dragon: ["back", "dragon", { c: "#4aa070", b: "#8ad8a0" }],
  // face
  face_glasses: ["face", "glasses", { c: "#3a3040" }],
  face_glasses_gold: ["face", "glasses", { c: "#c89a30" }],
  face_shades: ["face", "shades", { c: "#2a2a3a" }],
  face_patch: ["face", "patch", { c: "#2a2a34" }],
  face_bandage: ["face", "bandage", { c: "#f4dcb8" }],
  face_mask: ["face", "mask", { c: "#f4f4fa" }],
  face_heart: ["face", "heart", { c: "#ff5a8a" }],
  face_monocle: ["face", "monocle", { c: "#e0b040" }],
  face_stache: ["face", "stache", { c: "#5a3a2a" }],
  // weapon skins (drawn by weapons.js: the design is the motif)
  ws_sakura: ["wskin", "sakura", {}],
  ws_frost: ["wskin", "frost", {}],
  ws_candy: ["wskin", "candy", {}],
  ws_bone: ["wskin", "bone", {}],
  ws_star: ["wskin", "star", {}],
  ws_flame: ["wskin", "flame", {}],
};
/** The cosmetic slots, in the order the wire sends them. */
export const SLOTS = ["hat", "top", "back", "face", "wskin"];
/** A weapon skin id's motif for weapons.js, or "". */
export const skinMotif = (id) => (ART[id] && ART[id][0] === "wskin" ? ART[id][1] : "");
/** Which views an item draws something in (a face piece on the cheek is not seen from behind). */
export function seenFrom(id) {
  const a = ART[id];
  if (!a || a[0] === "wskin") return [];
  if (a[0] === "face") return FACE[a[1]] && FACE[a[1]].back ? ["front", "side", "back"] : ["front", "side"];
  return ["front", "side", "back"];
}
/** Is the item made to cover an eye (shades, a patch)? Everything else must leave the eyes alone. */
export const coversEyes = (id) => !!(ART[id] && ART[id][0] === "face" && FACE[ART[id][1]] && FACE[ART[id][1]].covers);
/** How a hat treats the ears: "through", "behind", or "" for small pieces in front of them. */
export const hatEars = (id) => (ART[id] && ART[id][0] === "hat" && HAT[ART[id][1]] ? HAT[ART[id][1]].ears || "" : "");

/**
 * Dress one frame: `base` is the plain frame from sprites.js, `o.cos` a list of
 * cosmetic ids. Returns a new canvas, or `base` itself when nothing is worn.
 */
export function dress(base, o, view, f) {
  const list = (o && o.cos ? o.cos : []).map((id) => ART[id]).filter((a) => a && a[0] !== "wskin");
  if (!list.length) return base;
  const A = anchors(base, o, view, f);
  const of = (slot) => list.find((a) => a[0] === slot);
  const [c, g] = canvas();
  const bk = of("back"), tp = of("top"), fc = of("face"), ht = of("hat");
  const bkFn = bk && BACK[bk[1]];
  const bd = base.getContext("2d").getImageData(0, 0, SZ, SZ).data;
  // 1. a back piece hangs behind the body (front, side)
  if (bkFn && !A.back) layer(g, bkFn, A, bk[2], { sep: false });
  g.drawImage(base, 0, 0);
  // 2. the top, inked only where it sticks out
  if (tp && TOP[tp[1]]) { const tl = topPal(TOP[tp[1]], tp[2]); layer(g, wearTop(TOP[tp[1]]), A, tp[2], { ink: "out", sepOnly: [tl.c, tl.l] }); }
  // 3. from behind, the back piece covers the body but stays under the head
  if (bkFn && A.back) layer(g, bkFn, A, bk[2], { keep: (x, y) => y >= A.bt || !bd[(y * SZ + x) * 4 + 3] });
  // 4. a cape's clasp, a pack's straps in front of the body
  if (bk && !A.back && BACK_FRONT[bk[1]]) layer(g, BACK_FRONT[bk[1]], A, bk[2], { ink: "none" });
  // 5. the hat: crown, ears, brim
  if (ht && HAT[ht[1]]) {
    const h = HAT[ht[1]];
    layer(g, h.draw, A, ht[2], { ink: "hat", col: h.ink });
    if (h.draw && h.bumps !== false) ears(g, base, A, h.ears !== "through");
    layer(g, h.over, A, ht[2], { ink: "hat", col: h.ink });
  }
  // 6. the eyes stay visible, 7. then the face piece (on the head only)
  if (!A.back) guardEyes(g, base, A);
  if (fc && FACE[fc[1]]) {
    layer(g, FACE[fc[1]].draw, A, fc[2], { ink: "none", keep: (x, y) => bd[(y * SZ + x) * 4 + 3] > 0 && !isInkAt(bd, (y * SZ + x) * 4) });
    // glasses ring the eyes, they never hide them (big round eyes peek over the rim)
    if (!FACE[fc[1]].covers && !A.back) guardEyes(g, base, A);
  }
  return c;
}

const icons = new Map();
/**
 * A 16×16 icon of a cosmetic: worn by a plain cat (the face and head cropped close for
 * hats and face pieces, the body close up for tops, the back for back pieces). The cat's
 * fur is picked to stand apart from the item (a white chef's hat on a brown cat).
 * `sheetOf(o)` is sprites.js personSheet (passed in to avoid a circular import).
 */
export function cosIcon(id, sheetOf, lookOf) {
  if (icons.has(id)) return icons.get(id);
  const a = ART[id];
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  if (a && a[0] !== "wskin") {
    const main = a[2].c || "#ffffff";
    const o = { ...lookOf(), cos: [id] };
    if (lum(main) > 0.72) o.fur = "#b98b68";
    const sh2 = sheetOf(o), fr = sh2.front[0];
    if (a[0] === "hat") g.drawImage(fr, 8, 6, 16, 16, 0, 0, 16, 16);
    else if (a[0] === "face") g.drawImage(fr, 8, 13, 16, 16, 0, 0, 16, 16);
    else if (a[0] === "top") g.drawImage(fr, 12, 20, 8, 8, 0, 0, 16, 16);
    else g.drawImage(sh2.back[0], 8, 14, 16, 16, 0, 0, 16, 16);
  }
  icons.set(id, c);
  return c;
}

/** Internals for tests/cosmetics.mjs. */
export const _test = { HAT, TOP, BACK, FACE, INK };
