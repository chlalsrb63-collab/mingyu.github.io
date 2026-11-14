/**
 * Cosmetics (외형): hats, tops, back pieces and face accessories drawn as layers
 * over the small animal adventurers of sprites.js, for every view (front, side,
 * back) and every frame of the person sheet.
 *
 * Nothing here is drawn at fixed head coordinates. Each frame is measured first
 * (`anchors`): the top row of the head, its width, the body's top row and where
 * the face sits — so a hat follows the head as it bobs through a walk and fits
 * whatever head and ears a species has. A character may also carry measured
 * anchors of its own (`o.anchor`), which win.
 *
 * Hats and ears: a hat is drawn, then the ears are put back on top of it (the
 * ear pixels are lifted from the plain frame), then the part of the hat that
 * belongs in front of the ears (a brim, a wreath, horns) — so ears always poke
 * through or stand behind a brim, never vanish under a crown. Hoods and helmets
 * that really do cover the ears say so (`ears: false`).
 *
 * Layers are inked like the rest of the cast: a one-pixel outline in INK —
 * except clothes on the body, which are told apart from the fur by colour only
 * and inked only where they stick out past the body.
 */

/** species.js, when sprites.js hands it over (`useSpecies`): it knows where each head is. */
let SPC = null;
export function useSpecies(mod) { SPC = mod; }

const INK = "#2b2233";
const SZ = 32;

// ───────────────────────────── colour ─────────────────────────────
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function blend(a, b, t) {
  const p = hex(a), q = hex(b);
  return "#" + p.map((v, i) => Math.round(v * (1 - t) + q[i] * t).toString(16).padStart(2, "0")).join("");
}
/** Shadows lean violet, lights lean warm (as in sprites.js). */
const sh = (c, t = 0.22) => blend(c, "#4a3a76", t);
const li = (c, t = 0.35) => blend(c, "#fff6dc", t);

// ───────────────────────────── measuring a frame ─────────────────────────────
const isInk = (d, i) => d[i] === 0x2b && d[i + 1] === 0x22 && d[i + 2] === 0x33;
/**
 * Where things are on this frame: top (the head's first row of fur), x0/x1 (the
 * head's fur on that row), cx (its centre, often a half pixel), eye (the eye row),
 * fx (the face's centre: it slides toward the far cheek in a three-quarter turn),
 * bt (the body's top row), foot (the feet's row).
 */
export function anchors(base, o, view, f) {
  const H = f === 1 ? 1 : f === 3 ? -1 : 0;
  const d = base.getContext("2d").getImageData(0, 0, SZ, SZ).data;
  const solid = (x, y) => d[(y * SZ + x) * 4 + 3] > 0;
  const fur = (x, y) => solid(x, y) && !isInk(d, (y * SZ + x) * 4);
  // the species knows where its head is (species.js); otherwise look for the first full row of fur
  const ha = o && o.sp !== undefined && SPC && SPC.headAnchor ? SPC.headAnchor(o) : null;
  const bob = SPC && SPC.HEAD_BOB ? SPC.HEAD_BOB[f] | 0 : H;
  let top = ha ? ha.top + bob : -1;
  if (!ha) for (let y = 4; y < 28 && top < 0; y++) if (fur(14, y) && fur(15, y) && fur(16, y) && fur(17, y)) top = y;
  if (top < 8 || top > 24) top = 18 + H;
  let x0 = 15, x1 = 16;
  while (x0 > 0 && fur(x0 - 1, top)) x0--;
  while (x1 < SZ - 1 && fur(x1 + 1, top)) x1++;
  if (x1 - x0 < 6 || x1 - x0 > 16) { x0 = 11; x1 = 20; }
  const side = view === "side", back = view === "back";
  const A = { top, x0, x1, cx: (x0 + x1) / 2, eye: ha ? ha.eyeY + bob : top + 2, fx: side ? 17.5 : 15.5, bt: 24 + H, foot: 27, H, f, side, back, front: !side && !back, view };
  // eyes up on top of the head (a frog's): the hat perches above them instead of covering them
  if (A.eye - 2 < A.top) A.top = A.eye - 2;
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
  const r = (x, y, w, h, col) => { if (w <= 0 || h <= 0) return; g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const c0 = Math.floor(A.cx + 0.5);
  /** A rect centred on the head. */
  const cr = (y, w, h, col, dx = 0) => r(Math.round(A.cx + 0.5 - w / 2 + dx), y, w, h, col);
  /** The same rect on both sides of the head's centre, `off` pixels out. */
  const sym = (off, y, w, h, col, colR = col) => { r(c0 + off, y, w, h, colR); r(c0 - off - w, y, w, h, col); };
  const px = (x, y, col) => r(x, y, 1, 1, col);
  const clear = (x, y, w = 1, h = 1) => g.clearRect(x, y, w, h);
  return { r, cr, sym, px, clear, c0, g };
}
/**
 * Outline a layer. `mode`: "all" inks every empty pixel beside it; "out" only
 * where the picture underneath (`under`) is empty too; "none" leaves it bare.
 */
function ink(c, mode, under, col = INK) {
  if (mode === "none") return c;
  const g = c.getContext("2d");
  const src = g.getImageData(0, 0, SZ, SZ).data;
  const ud = mode === "out" && under ? under.getImageData(0, 0, SZ, SZ).data : null;
  const solid = (x, y) => x >= 0 && y >= 0 && x < SZ && y < SZ && src[(y * SZ + x) * 4 + 3] > 0;
  g.fillStyle = col;
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
    if (solid(x, y)) continue;
    if (ud && ud[(y * SZ + x) * 4 + 3] > 0) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x, y, 1, 1);
  }
  return c;
}
/** Paint one layer with `fn(b, A, pal)` and lay it onto `g`. */
function layer(g, fn, A, pal, mode = "all", col = INK) {
  if (!fn) return;
  const [c, lg] = canvas();
  fn(brush(lg, A), A, pal);
  ink(c, mode, g, col);
  g.drawImage(c, 0, 0);
}
/** Put the ears back: every opaque pixel above the head's outline row, and the fur on that row. */
function ears(g, base, A) {
  const [c, eg] = canvas();
  const src = base.getContext("2d").getImageData(0, 0, SZ, SZ);
  const d = src.data, out = eg.createImageData(SZ, SZ), o = out.data;
  for (let y = 0; y < A.top; y++) for (let x = 0; x < SZ; x++) {
    const i = (y * SZ + x) * 4;
    if (!d[i + 3]) continue;
    if (y === A.top - 1 && isInk(d, i)) continue;
    o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = 255;
  }
  eg.putImageData(out, 0, 0);
  g.drawImage(c, 0, 0);
}

// ───────────────────────────── hats ─────────────────────────────
// `draw` goes under the ears, `over` in front of them. T is the head's top row.

const HAT = {
  // a knit cap with a turned-up band and a bobble
  beanie: {
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W, 1, p.c); b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 3, W - 6, 1, p.c);
      b.r(A.x1 - 2, T - 2, 2, 2, sh(p.c));
      b.cr(T, W + 2, 2, p.b); for (let x = A.x0; x <= A.x1; x += 2) b.px(x, T + 1, sh(p.b));
      b.cr(T - 5, 2, 2, p.p);
    },
  },
  // a wide straw brim, a ribbon round the crown
  straw: {
    draw(b, A, p) {
      const T = A.top;
      b.cr(T - 4, 8, 1, p.c); b.cr(T - 3, 8, 1, p.c); b.cr(T - 2, 8, 1, p.b); b.r(Math.round(A.cx + 2), T - 4, 2, 2, sh(p.c));
    },
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W + 6, 1, li(p.c, 0.2)); b.cr(T, W + 4, 1, sh(p.c));
      for (let x = A.x0 - 2; x <= A.x1 + 2; x += 3) b.px(x, T - 1, p.c);
    },
  },
  // a tall cone that bends at the tip, a band, a star
  wizard: {
    draw(b, A, p) {
      const T = A.top, k = A.side ? -1 : 1;
      const rows = [[2, 10], [3, 8], [4, 6], [5, 5], [6, 4], [7, 3], [8, 3], [9, 2]];
      for (const [dy, w] of rows) b.cr(T - dy, w, 1, p.c, dy >= 7 ? k * (dy - 6) : 0);
      b.cr(T - 10, 2, 1, p.c, k * 4);
      for (const [dy, w] of rows.slice(1, 5)) b.r(Math.round(A.cx + 0.5 + w / 2 - 2), T - dy, 2, 1, sh(p.c));
      b.cr(T - 2, 10, 1, p.b); b.px(Math.round(A.cx) - 1, T - 5, p.s); b.px(Math.round(A.cx) - 1, T - 4, p.s);
    },
    over(b, A, p) { const W = A.x1 - A.x0 + 1; b.cr(A.top - 1, W + 4, 1, p.c); b.cr(A.top, W + 2, 1, sh(p.c)); },
  },
  // a small crown between the ears
  crown: {
    over(b, A, p) {
      const T = A.top;
      b.cr(T - 1, 6, 1, p.c); b.cr(T - 2, 6, 1, p.c);
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
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 1, W, 2, p.c); b.r(A.x1 - 2, T - 2, 2, 3, sh(p.c));
      b.cr(T - 3, 2, 1, p.b);
      if (A.front) b.cr(T + 1, W - 2, 1, p.b);
      if (A.side) b.r(A.x1 - 1, T, 5, 1, p.b);
      if (A.back) b.cr(T, 2, 1, INK);
    },
  },
  // a pirate's tricorn with a skull
  tricorn: {
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
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, k = A.side ? -1 : 1;
      b.cr(T - 1, W, 1, p.c); b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 3, W - 4, 1, p.c, k);
      b.cr(T - 4, 4, 1, p.c, k * 3); b.cr(T - 3, 2, 1, sh(p.c), k * 3);
      b.cr(T, W + 2, 1, "#f4f0f4"); b.cr(T - 4, 2, 2, "#f4f0f4", k * 6);
    },
  },
  // an open-faced knight's helm with cheek guards and a plume
  helm: {
    ears: false,
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 1, W + 2, 2, p.c); b.cr(T + 1, W + 2, 1, sh(p.c));
      b.sym(Math.ceil(W / 2), T + 2, 1, 2, sh(p.c));
      b.cr(T - 1, W - 4, 1, li(p.c)); b.cr(T - 2, 2, 1, li(p.c, 0.5));
      const k = A.side ? -1 : 1;
      b.cr(T - 3, 2, 1, p.b); b.cr(T - 4, 2, 1, p.b, -k); b.cr(T - 5, 3, 1, p.b, -k * 2); b.cr(T - 4, 2, 1, sh(p.b), -k * 3);
    },
  },
  // a frog hat, two goggle eyes on top
  frog: {
    ears: false,
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 1, W + 2, 2, p.c); b.cr(T + 1, W + 2, 1, sh(p.c));
      b.sym(2, T - 4, 3, 3, p.c);
      if (!A.back) { b.sym(2, T - 4, 2, 2, "#ffffff"); b.sym(3, T - 3, 1, 1, INK); b.cr(T, 4, 1, "#e0606a"); }
    },
  },
  // a halo of light floating over the head
  halo: {
    ears: true, ink: "#a8742e",
    over(b, A, p) {
      const T = A.top - 6 + (A.f === 1 ? 1 : 0);
      b.cr(T, 6, 1, p.c); b.sym(3, T + 1, 1, 1, p.c); b.cr(T + 2, 6, 1, sh(p.c, 0.15));
    },
  },
  // two little devil horns
  horns: {
    over(b, A, p) {
      const T = A.top;
      b.sym(1, T - 2, 2, 2, p.c); b.sym(2, T - 3, 1, 1, p.c); b.sym(2, T - 4, 1, 1, li(p.c));
      b.sym(1, T - 1, 2, 1, sh(p.c));
    },
  },
  // a tall puffed chef's hat
  chef: {
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W - 2, 2, "#f4f4fa"); b.cr(T, W - 2, 1, "#d8d6e6");
      b.cr(T - 5, W, 4, "#ffffff"); b.cr(T - 6, W - 4, 1, "#ffffff");
      b.r(A.x1 - 2, T - 5, 2, 4, "#dcdaea"); b.cr(T - 6, 1, 1, "#dcdaea", 1);
    },
  },
  // a beret, tipped to one side, with a stalk
  beret: {
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, k = A.side ? -1 : 1;
      b.cr(T - 1, W + 2, 1, p.c, k); b.cr(T - 2, W, 1, p.c, k); b.cr(T, W, 1, sh(p.c));
      b.cr(T - 3, 1, 1, p.c, k);
      b.r(A.x1 - 1 + k, T - 2, 2, 2, sh(p.c));
    },
  },
};

// ───────────────────────────── tops ─────────────────────────────
// The body: rows bt … foot−1, columns 13–18; the feet on row `foot`.

const TOP = {
  overalls: (b, A, p) => {
    const y = A.bt, n = A.foot - y;
    b.r(13, y, 6, n, p.c); b.r(13, A.foot - 1, 6, 1, sh(p.c));
    if (!A.back) { b.r(14, y, 4, 1, p.b); b.px(14, y, p.c); b.px(17, y, p.c); b.px(14, y + 1, "#f0cc60"); b.px(17, y + 1, "#f0cc60"); }
    else { b.r(14, y, 1, n, sh(p.c)); b.r(17, y, 1, n, sh(p.c)); }
  },
  hoodie: (b, A, p) => {
    const y = A.bt, n = A.foot - y;
    b.r(13, y, 6, n, p.c); b.r(13, A.foot - 1, 6, 1, sh(p.c));
    if (A.front) { b.px(15, y + 1, "#ffffff"); b.px(16, y + 1, "#ffffff"); b.r(14, A.foot - 1, 4, 1, sh(p.c, 0.35)); }
    if (A.side) b.r(13, y, 2, n, sh(p.c));
    if (A.back) { b.r(13, y, 6, 1, sh(p.c)); b.r(14, y - 1, 4, 1, p.c); }
  },
  sailor: (b, A, p) => {
    const y = A.bt, n = A.foot - y;
    b.r(13, y, 6, n, "#f6f4fa");
    for (let k = y + 1; k < A.foot; k += 2) b.r(13, k, 6, 1, p.c);
    b.r(13, y, 6, 1, p.c);
    if (A.front) { b.px(15, y, "#e04a4a"); b.px(16, y, "#e04a4a"); b.px(15, y + 1, "#e04a4a"); }
    if (A.side) b.px(17, y, "#e04a4a");
  },
  armor: (b, A, p) => {
    const y = A.bt, n = A.foot - y;
    b.r(13, y, 6, n, p.c); b.r(13, y, 6, 1, li(p.c)); b.r(17, y, 2, n, sh(p.c));
    b.r(13, A.foot - 1, 6, 1, "#6a4434"); b.px(15, A.foot - 1, "#f0cc60");
    if (A.front) b.px(14, y + 1, li(p.c, 0.6));
  },
  robe: (b, A, p) => {
    const y = A.bt;
    b.r(13, y, 6, A.foot - y, p.c); b.r(12, A.foot - 1, 8, 1, p.c); b.r(12, A.foot - 1, 8, 1, sh(p.c));
    b.r(17, y, 2, A.foot - y, sh(p.c));
    if (!A.back) b.r(A.side ? 16 : 15, y, 1, A.foot - y, p.b);
    else b.r(15, y, 2, 1, sh(p.c, 0.4));
  },
  dress: (b, A, p) => {
    const y = A.bt;
    b.r(13, y, 6, A.foot - y, p.c); b.r(12, A.foot - 1, 8, 1, p.c);
    b.r(13, y + 1, 6, 1, p.b); if (!A.back) b.px(A.side ? 17 : 15, y + 1, li(p.b));
    b.r(12, A.foot - 1, 8, 1, li(p.c, 0.5)); b.r(17, y + 2, 2, A.foot - y - 3, sh(p.c));
  },
  suit: (b, A, p) => {
    const y = A.bt, n = A.foot - y;
    b.r(13, y, 6, n, p.c); b.r(17, y, 2, n, sh(p.c));
    if (A.front) { b.r(15, y, 2, 2, "#f6f4fa"); b.px(15, y, p.b); b.px(15, y + 1, p.b); }
    if (A.side) { b.r(17, y, 2, 1, "#f6f4fa"); b.px(17, y + 1, p.b); }
  },
  hanbok: (b, A, p) => {
    const y = A.bt;
    b.r(13, y, 6, 2, p.c); b.r(12, y + 2, 8, A.foot - y - 2, p.b); b.r(12, A.foot - 1, 8, 1, sh(p.b));
    if (!A.back) { b.r(13, y, 6, 1, "#f6f4fa"); b.px(A.side ? 17 : 15, y + 1, "#e0405a"); b.px(A.side ? 17 : 15, y + 2, "#e0405a"); }
    else b.r(13, y, 6, 1, sh(p.c, 0.3));
  },
  vest: (b, A, p) => {
    const y = A.bt, n = A.foot - y;
    b.r(13, y, 6, n, p.c); b.r(13, y, 1, n, li(p.c, 0.6)); b.r(18, y, 1, n, li(p.c, 0.6)); b.r(13, A.foot - 1, 6, 1, li(p.c, 0.6));
    if (A.front) b.r(15, y, 2, n - 1, p.b);
  },
  pajama: (b, A, p) => {
    const y = A.bt, n = A.foot - y;
    b.r(13, y, 6, n, p.c); b.r(13, A.foot - 1, 6, 1, sh(p.c));
    b.px(14, y + 1, p.b); b.px(17, y, p.b); b.px(16, A.foot - 1, p.b);
  },
};

// ───────────────────────────── back pieces ─────────────────────────────
// Drawn behind the body in front and three-quarter views, over it from the back.

/** x on the trailing side in a turn (the figure faces right, so "behind" is the left). */
const BACK = {
  cape: (b, A, p) => {
    const y = A.bt, sw = A.f === 2 ? 1 : A.f === 4 ? -1 : 0;
    if (A.back) {
      b.r(12, y - 1, 8, A.foot - y + 1, p.c); b.r(12, A.foot, 8, 1, sh(p.c)); b.r(14, y + 1, 1, A.foot - y - 1, sh(p.c)); b.r(17, y + 1, 1, A.foot - y - 1, sh(p.c));
      b.r(12, y - 1, 8, 1, li(p.c, 0.25));
    } else if (A.side) {
      b.r(11, y, 3, A.foot - y, p.c); b.r(10 + sw, A.foot - 2, 3, 2, p.c); b.r(10 + sw, A.foot - 1, 2, 1, sh(p.c));
    } else {
      b.r(11, y, 10, A.foot - y, sh(p.c)); b.r(10 + (sw > 0 ? 1 : 0), A.foot - 1, 12 - Math.abs(sw), 2, sh(p.c));
    }
  },
  angel: (b, A, p) => wings(b, A, p, [[0, 4], [1, 5], [2, 5], [3, 4], [4, 2]], true),
  bat: (b, A, p) => wings(b, A, p, [[0, 3], [1, 6], [2, 5], [3, 2], [4, 1]], false),
  fairy: (b, A, p) => {
    const y = A.bt - 3, up = A.f === 1 ? 1 : A.f === 3 ? -1 : 0;
    const w = (s, x0) => { b.r(x0, y + up, 3, 3, p.c); b.r(x0 + (s < 0 ? 0 : 1), y + 3, 2, 2, p.b); b.px(x0 + 1, y + 1 + up, li(p.c, 0.6)); };
    if (A.side) { w(-1, 9); return; }
    w(-1, 9); w(1, 20);
  },
  pack: (b, A, p) => {
    const y = A.bt;
    if (A.back) { b.r(13, y - 1, 6, A.foot - y, p.c); b.r(13, y - 1, 6, 2, sh(p.c)); b.px(15, y + 1, "#f0cc60"); b.px(16, y + 1, "#f0cc60"); b.r(13, A.foot - 2, 6, 1, sh(p.c)); }
    else if (A.side) { b.r(10, y - 1, 4, A.foot - y, p.c); b.r(10, y - 1, 4, 1, sh(p.c)); b.px(11, y + 1, "#f0cc60"); }
    else { b.r(12, y, 1, 3, p.c); b.r(19, y, 1, 3, p.c); }
  },
  dragon: (b, A, p) => wings(b, A, p, [[0, 2], [1, 4], [2, 6], [3, 4], [4, 3], [5, 1]], false, true),
};
/** What a back piece shows in front of the body (a cape's collar and clasp, a pack's straps), front and side views. */
const BACK_FRONT = {
  cape: (b, A, p) => {
    const y = A.bt;
    if (A.side) { b.r(14, y, 4, 1, p.c); b.px(17, y, "#f0cc60"); return; }
    b.r(13, y, 6, 1, p.c); b.px(13, y, sh(p.c)); b.px(18, y, sh(p.c)); b.cr(y, 2, 1, "#f0cc60");
  },
  pack: (b, A, p) => {
    const y = A.bt;
    if (A.side) { b.r(14, y, 1, A.foot - y - 1, sh(p.c, 0.3)); return; }
    b.r(14, y, 1, A.foot - y - 1, sh(p.c, 0.3)); b.r(17, y, 1, A.foot - y - 1, sh(p.c, 0.3));
  },
};
/** A pair of wings from the shoulders: `rows` [dy, length] from the top; flapping with the frames. */
function wings(b, A, p, rows, round, spikes) {
  const flap = A.f === 1 || A.f === 2 ? 1 : A.f === 3 || A.f === 4 ? -1 : 0;
  const y0 = A.bt - 3 + flap;
  const one = (dir, base) => {
    for (const [dy, n] of rows) {
      const x = dir < 0 ? base - n : base;
      b.r(x, y0 + dy, n, 1, p.c);
      if (dy === rows.length - 1 || (spikes && dy % 2)) b.r(dir < 0 ? x : x + n - 1, y0 + dy, 1, 1, sh(p.c));
    }
    b.r(dir < 0 ? base - 2 : base, y0 + 1, 2, 1, round ? li(p.c, 0.6) : p.b);
  };
  if (A.side) { one(-1, 13); return; }
  one(-1, 13); one(1, 19);
}

// ───────────────────────────── face ─────────────────────────────
// Front and three-quarter views only; from the back, at most a strap.

const FACE = {
  glasses: (b, A, p) => {
    if (A.back) { b.cr(A.eye, 10, 1, p.c); return; }
    const e = A.eye, L = Math.round(A.fx - 4.5), R = Math.round(A.fx + 1.5);
    for (const x of A.side ? [R] : [L, R]) { b.r(x, e - 1, 3, 1, p.c); b.r(x, e + 2, 3, 1, p.c); b.r(x - 1, e, 1, 2, p.c); b.r(x + 3, e, 1, 2, p.c); }
    if (A.side) { b.r(R - 3, e, 3, 1, p.c); } else b.r(L + 4, e, R - L - 5, 1, p.c);
  },
  shades: (b, A, p) => {
    if (A.back) { b.cr(A.eye, 10, 1, INK); return; }
    const e = A.eye, L = Math.round(A.fx - 4.5), R = Math.round(A.fx + 1.5);
    for (const x of A.side ? [R] : [L, R]) { b.r(x - 1, e, 4, 2, p.c); b.px(x, e, li(p.c, 0.7)); }
    b.r(A.side ? R - 3 : L + 3, e, A.side ? 2 : R - L - 4, 1, p.c);
  },
  patch: (b, A, p) => {
    if (A.back) { b.r(A.x0, A.eye - 1, A.x1 - A.x0 + 1, 1, INK); return; }
    const e = A.eye, R = Math.round(A.fx + 1.5);
    b.r(R - 1, e - 1, 4, 3, p.c); b.px(R, e - 1, li(p.c, 0.4));
    b.r(A.x0, e - 2, R - A.x0 - 1, 1, INK);
  },
  bandage: (b, A, p) => {
    if (A.back) return;
    const x = Math.round(A.fx + (A.side ? 2.5 : 3.5)), y = A.eye + 2;
    b.r(x, y, 3, 1, p.c); b.px(x + 1, y - 1, sh(p.c, 0.1)); b.px(x + 1, y, sh(p.c));
  },
  mask: (b, A, p) => {
    if (A.back) { b.r(A.x0, A.eye + 2, A.x1 - A.x0 + 1, 1, sh(p.c)); return; }
    const y = A.eye + 2;
    b.r(Math.round(A.fx - 3.5), y, 8, 2, p.c); b.r(Math.round(A.fx - 3.5), y + 1, 8, 1, sh(p.c, 0.12));
    if (A.front) { b.px(A.x0, y, sh(p.c)); b.px(A.x1, y, sh(p.c)); }
  },
  heart: (b, A, p) => {
    if (A.back) return;
    const y = A.eye + 2;
    for (const x of A.side ? [Math.round(A.fx + 3)] : [A.x0, A.x1 - 2]) { b.px(x, y, p.c); b.px(x + 2, y, p.c); b.r(x, y + 1, 3, 1, sh(p.c, 0.1)); b.px(x, y, li(p.c, 0.4)); }
  },
  monocle: (b, A, p) => {
    if (A.back) return;
    const e = A.eye, R = Math.round(A.fx + 1.5);
    b.r(R - 1, e - 1, 4, 1, p.c); b.r(R - 1, e + 2, 4, 1, p.c); b.r(R - 2, e, 1, 2, p.c); b.r(R + 2, e, 1, 2, p.c);
    b.r(R + 2, e + 3, 1, 2, sh(p.c));
  },
  stache: (b, A, p) => {
    if (A.back) return;
    const y = A.eye + 3, x = Math.round(A.fx - 2.5);
    b.r(x, y, 6, 1, p.c); b.px(x - 1, y - 1, p.c); b.px(x + 6, y - 1, p.c);
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
  back_angel: ["back", "angel", { c: "#f8f8ff", b: "#d8dcf0" }],
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

/**
 * Dress one frame: `base` is the plain frame from sprites.js, `o.cos` a list of
 * cosmetic ids. Returns a new canvas, or `base` itself when nothing is worn.
 */
export function dress(base, o, view, f) {
  const list = (o && o.cos ? o.cos : []).map((id) => ART[id]).filter(Boolean);
  if (!list.length) return base;
  const A = anchors(base, o, view, f);
  const of = (slot) => list.find((a) => a[0] === slot);
  const [c, g] = canvas();
  const bk = of("back"), tp = of("top"), fc = of("face"), ht = of("hat");
  const bkFn = bk && BACK[bk[1]];
  if (bkFn && !A.back) layer(g, bkFn, A, bk[2]);
  g.drawImage(base, 0, 0);
  if (tp && TOP[tp[1]]) layer(g, TOP[tp[1]], A, tp[2], "out");
  if (bkFn && A.back) layer(g, bkFn, A, bk[2]);
  if (bk && !A.back && BACK_FRONT[bk[1]]) layer(g, BACK_FRONT[bk[1]], A, bk[2], "none");
  if (fc && FACE[fc[1]]) layer(g, FACE[fc[1]], A, fc[2], "none");
  if (ht && HAT[ht[1]]) {
    const h = HAT[ht[1]];
    layer(g, h.draw, A, ht[2], "all", h.ink);
    if (h.ears !== false) ears(g, base, A);
    layer(g, h.over, A, ht[2], "all", h.ink);
  }
  return c;
}

const icons = new Map();
/**
 * A 16×16 icon of a cosmetic: worn by a plain white cat (the face and head
 * cropped close for hats and face pieces, the whole figure for the rest).
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
    const o = { ...lookOf(), cos: [id] };
    const sh = sheetOf(o), fr = sh.front[0];
    // a hat on the head; a face piece on the face; a top close up (twice the size) on the body;
    // a back piece seen from behind
    if (a[0] === "hat") g.drawImage(fr, 8, 7, 16, 16, 0, 0, 16, 16);
    else if (a[0] === "face") g.drawImage(fr, 8, 13, 16, 16, 0, 0, 16, 16);
    else if (a[0] === "top") g.drawImage(fr, 12, 20, 8, 8, 0, 0, 16, 16);
    else g.drawImage(sh.back[0], 8, 14, 16, 16, 0, 0, 16, 16);
  }
  icons.set(id, c);
  return c;
}
