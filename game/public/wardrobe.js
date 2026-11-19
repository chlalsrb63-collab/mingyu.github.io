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

import { HANBOK_HAT, HANBOK_TOP, HANBOK_ART } from "./wardrobe_hanbok_sets.js";
import { CAREER_HAT, CAREER_TOP, CAREER_ART } from "./wardrobe_career_uniforms.js";

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
  const size = base.width, scale = size / SZ;
  const d = base.getContext("2d").getImageData(0, 0, size, size).data;
  const side = view === "side", back = view === "back";
  const rows = ha.rows || FALLBACK_HEAD.rows, top = ha.top + bob;
  const halfAt = (y) => rows[Math.max(0, Math.min(rows.length - 1, y - top))];
  const A = {
    top, x0: ha.x0, x1: ha.x1, cx: 15.5, rows, halfAt,
    earTop: ha.earTop + bob, ear: ha.ear, earIn: ha.earIn, bumps: !!ha.bumps,
    eye: fa.ey + bob, lx: fa.lx, rx: fa.rx, nx: fa.nx, ny: fa.ny + bob, cheekL: fa.cheekL, cheekR: fa.cheekR,
    bt: 24 + bob, foot: 27, H: bob, f, side, back, front: !side && !back, view,
    fur: (o && o.fur) || "#fbfbff",
    under: (x, y) => {
      if (x < 0 || y < 0 || x >= SZ || y >= SZ) return null;
      const i = (Math.floor(y * scale) * size + Math.floor(x * scale)) * 4;
      return d[i + 3] ? [d[i], d[i + 1], d[i + 2]] : null;
    },
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
function canvas(size = SZ) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return [c, g];
}
/** A painter for one layer, measured from the frame's anchors. */
function brush(g, A, scale) {
  /** A rect; `col` may be a function (x, y) → colour, for pieces that adapt to what lies under each pixel. */
  const r = (x, y, w, h, col) => {
    if (w <= 0 || h <= 0 || !col) return;
    x = Math.round(x * scale); y = Math.round(y * scale); w = Math.round(w * scale); h = Math.round(h * scale);
    if (typeof col === "function") { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { g.fillStyle = col((x + i) / scale, (y + j) / scale); g.fillRect(x + i, y + j, 1, 1); } return; }
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  const c0 = Math.floor(A.cx + 0.5);
  /** A rect centred on the head. */
  const cr = (y, w, h, col, dx = 0) => r(A.cx + 0.5 - w / 2 + dx, y, w, h, col);
  /** The same rect on both sides of the head's centre, `off` pixels out. */
  const sym = (off, y, w, h, col, colR = col) => { r(c0 + off, y, w, h, colR); r(c0 - off - w, y, w, h, col); };
  const px = (x, y, col) => r(x, y, 1, 1, col);
  /** One native pixel (half a logical one) at 64px; nothing on the 32px sheet, so the small art stays clean. */
  const fp = (x, y, col) => { if (scale >= 2) r(x, y, 0.5, 0.5, col); };
  /** A pixel template: `rows` of characters looked up in `pal` ('.' or a missing key: nothing); `flip` mirrors it. */
  const grid = (x, y, rows, pal, flip = false) => rows.forEach((s, j) => {
    for (let i = 0; i < s.length; i++) { const col = pal[s[i]]; if (col) r(flip ? x + s.length - 1 - i : x + i, y + j, 1, 1, col); }
  });
  return { r, cr, sym, px, fp, grid, c0, g };
}

const HARD_HATS = new Set(["crown", "horncrown", "helm", "halo", "horns", "goggles", "miner", "surveycap", "shards"]);
const HARD_BACKS = new Set(["surf", "gourd", "lantern", "hammer", "trophy", "tray", "cauldron", "tradeJar", "surveyTanks", "neonSign", "bellFrame"]);
const HARD_FACES = new Set(["browGoggles", "crescentFrames", "amberFrames", "tradePearl", "surveyFilter", "glasses", "shades", "forge", "monocle", "snorkel", "riftGoggles", "reedFloat"]);
const FEATHER_BACKS = new Set(["angel", "bat", "fairy", "dragon"]);

/** Shape and colour the half-pixel steps within a costume's logical pattern, on its native 64px grid. */
function finishNative(d, size, A, part, design) {
  const source = d.slice(), seamTone = new Map();
  const at = (x, y) => (y * size + x) * 4;
  const solid = (x, y) => x >= 0 && y >= 0 && x < size && y < size && source[at(x, y) + 3] > 0;
  let loX = size, loY = size, hiX = 0, hiY = 0;
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    if (!solid(x, y)) continue;
    loX = Math.min(loX, x); loY = Math.min(loY, y); hiX = Math.max(hiX, x); hiY = Math.max(hiY, y);
    const dx = x % 2 ? 1 : -1, dy = y % 2 ? 1 : -1;
    // Bevel a supported corner, leaving thin details such as feathers, straps and spectacles whole.
    if (part !== "face" && !solid(x + dx, y) && !solid(x, y + dy) && solid(x - 2 * dx, y) && solid(x, y - 2 * dy)) d[at(x, y) + 3] = 0;
  }
  if (hiX < loX) return;
  const width = hiX - loX + 1, height = hiY - loY + 1;
  const shadeSpan = (x, y, n, tone, slope = 0) => {
    for (let j = 0; j < n; j++) {
      const u = x + j, v = y + Math.floor(j * slope);
      if (!solid(u, v)) continue;
      const i = at(u, v);
      if (!d[i + 3]) continue;
      const c = toHex(source[i], source[i + 1], source[i + 2]);
      if (c === INK) continue;
      const key = `${c}:${tone}`;
      if (!seamTone.has(key)) seamTone.set(key, hex(tone < 0 ? sh(c, -tone) : li(c, tone)));
      d.set(seamTone.get(key), i);
    }
  };
  const span = (from, y, end, tone, slope) => shadeSpan(loX + Math.round(width * from), y, Math.max(1, Math.round(width * end)), tone, slope);
  if (part === "hat") {
    const hard = HARD_HATS.has(design);
    span(0.16, loY + 1, hard ? 0.38 : 0.5, hard ? 0.67 : 0.27, 0.18);
    if (height > 3) span(A.side ? 0.42 : 0.12, hiY - 1, 0.55, -0.21, A.side ? -0.16 : 0);
    if (hard) span(0.52, loY + Math.floor(height / 2), 0.12, 0.55);
  } else if (part === "top") {
    // Shoulder piping follows the cut of the top. A lower crease helps separate it from the paws.
    span(0.1, loY + 1, 0.43, design === "armor" ? 0.58 : 0.3, 0.14);
    if (height > 3) span(A.side ? 0.21 : 0.43, hiY - 1, 0.45, -0.29, -0.16);
  } else if (part === "back") {
    if (FEATHER_BACKS.has(design)) {
      span(0.09, loY + 2, 0.26, 0.43, 0.35);
      span(0.63, loY + 3, 0.23, -0.34, -0.4);
    } else if (HARD_BACKS.has(design)) {
      span(0.12, loY + Math.floor(height / 3), 0.32, 0.58, 0.14);
      span(0.62, hiY - 1, 0.26, -0.32);
    } else {
      span(0.16, loY + 2, 0.28, 0.3, -0.18);
      span(0.38, hiY - 2, 0.46, -0.32, 0.2);
    }
  } else if (HARD_FACES.has(design) && !A.back) {
    // Tiny specular marks on a lens or metal rim. Eye pixels are restored after the layer.
    span(0.17, loY, 0.15, 0.61);
    span(0.62, loY, 0.15, 0.46);
  } else {
    span(0.22, loY, 0.4, 0.3);
    if (height > 3) span(0.47, hiY, 0.3, -0.28);
  }
}
/**
 * Lay one layer onto `g`: paint it with `fn(b, A, pal)`, keep only the pixels `opt.keep(x, y)`
 * allows, darken edges that would melt into what they touch (`opt.sep`, on by default), then ink.
 * `opt.ink`: "all" inks every empty pixel beside it; "out" only where the picture so far is empty;
 * "hat" where the plain frame is empty or above the head's top row; "none" leaves it bare.
 */
function layer(g, fn, A, pal, opt = {}) {
  if (!fn) return;
  const size = g.canvas.width, scale = size / SZ;
  const [c, lg] = canvas(size);
  fn(brush(lg, A, scale), A, pal);
  const img = lg.getImageData(0, 0, size, size), d = img.data;
  const ud = g.getImageData(0, 0, size, size).data;
  if (scale === 2 && opt.part) finishNative(d, size, A, opt.part, opt.design);
  if (opt.keep) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; if (d[i + 3] && !opt.keep(x, y)) d[i + 3] = 0; }
  if (opt.sep !== false) {
    const dark = [], only = opt.sepOnly ? new Set(opt.sepOnly.map((c) => c.toLowerCase())) : null;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!d[i + 3] || (only && !only.has(toHex(d[i], d[i + 1], d[i + 2])))) continue;
      for (const [u, v] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (u < 0 || v < 0 || u >= size || v >= size) continue;
        const k = (v * size + u) * 4;
        if (d[k + 3] || !ud[k + 3] || isInkAt(ud, k)) continue;
        if (near(d[i], d[i + 1], d[i + 2], ud[k], ud[k + 1], ud[k + 2])) { dark.push(i); break; }
      }
    }
    for (const i of dark) { const [r, gg, b] = hex(sh(toHex(d[i], d[i + 1], d[i + 2]), 0.42)); d[i] = r; d[i + 1] = gg; d[i + 2] = b; }
  }
  lg.putImageData(img, 0, 0);
  const mode = opt.ink || "all";
  if (mode !== "none") {
    const solid = (x, y) => x >= 0 && y >= 0 && x < size && y < size && d[(y * size + x) * 4 + 3] > 0;
    lg.fillStyle = opt.col || INK;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (solid(x, y)) continue;
      if (!(solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) continue;
      const k = (y * size + x) * 4;
      if (mode === "out" && ud[k + 3]) continue;
      if (mode === "hat" && ud[k + 3] && y >= A.top * scale && !isInkAt(ud, k)) continue;
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
  const size = base.width, scale = size / SZ;
  const [c, eg] = canvas(size);
  const d = base.getContext("2d").getImageData(0, 0, size, size).data, out = eg.createImageData(size, size), o = out.data;
  for (let y = 0; y < A.top * scale; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    if (!d[i + 3]) continue;
    if (y >= (A.top - 1) * scale && isInkAt(d, i)) continue;
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
  const size = base.width, scale = size / SZ;
  const d = base.getContext("2d").getImageData(0, 0, size, size).data;
  for (const [x0, y0, x1, y1] of eyeBoxes(A)) for (let y = y0 * scale; y < (y1 + 1) * scale; y++) {
    const h = A.halfAt(Math.floor(y / scale));
    for (let x = Math.max(x0, 16 - h) * scale; x < Math.min(x1 + 1, 16 + h) * scale; x++) {
      const i = (y * size + x) * 4;
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
      const shadow = sh(p.c, 0.32), rib = sh(p.b, 0.34), shift = A.side ? -1 : 0;
      b.cr(T - 4, W - 6, 1, p.c, shift);
      b.cr(T - 3, W - 4, 1, p.c, shift);
      b.cr(T - 2, W - 2, 1, p.c);
      b.cr(T - 1, W, 1, shadow);
      b.r(A.x1 - 2, T - 3, 2, 1, shadow);
      b.r(A.x0 + 2 + shift, T - 3, 2, 1, li(p.c, 0.26));
      b.cr(T, W + 2, 1, p.b);
      b.cr(T + 1, W, 1, rib);
      for (let x = A.x0 + 1; x < A.x1; x += 2) {
        b.px(x, T, sh(p.b, 0.2));
        b.fp(x - 0.5, T + 0.5, li(p.b));
      }
      b.grid(b.c0 - 2 + shift, T - 7, [".ll.", "lpps", ".ss."], { p: p.p, l: li(p.p, 0.7), s: sh(p.p, 0.23) });
    },
  },
  // a wide straw brim, a ribbon round the crown; ears poke up through the crown
  straw: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, shade = sh(p.c, 0.23);
      b.cr(T - 5, W - 4, 1, li(p.c, 0.34));
      b.cr(T - 4, W - 2, 2, p.c);
      b.r(b.c0 + 1, T - 4, Math.floor(W / 2) - 2, 2, shade);
      b.cr(T - 2, W - 2, 1, p.b);
      if (!A.front) b.r(b.c0 - 3, T - 2, 2, 2, sh(p.b, 0.34));
      b.fp(b.c0 - 3, T - 3.5, li(p.c, 0.4));
      b.fp(b.c0 - 2, T - 3.5, li(p.c, 0.4));
      b.fp(b.c0 - 1, T - 3.5, li(p.c, 0.4));
    },
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      const dx = A.side ? 1 : 0;
      b.cr(T - 1, W + 6, 1, p.c, dx);
      b.cr(T, W + 4, 1, sh(p.c, 0.3), dx);
      b.cr(T - 1, W - 2, 1, li(p.c, 0.42), dx - 1);
      if (!A.front) b.px(b.c0 - 3, T - 1, sh(p.b, 0.2));
    },
  },
  // a tall cone that bends at the tip, a band, a star
  wizard: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, x = b.c0 - 5, shadow = sh(p.c, 0.32), light = li(p.c, 0.32);
      b.grid(x, T - 10, [
        "........ll", "......lccs", ".....lcs..", "....lcs...", "...lccs...", "..lcccs...",
        "..lccccs..", ".lcccccss.", "bbbbbbbbbb",
      ], { c: p.c, s: shadow, l: light, b: p.b }, A.side);
      if (!A.back) {
        const sx = b.c0 + (A.side ? 1 : -1);
        b.px(sx, T - 5, p.s);
        b.r(sx - 1, T - 4, 3, 1, p.s);
        b.px(sx, T - 3, p.s);
        b.fp(sx, T - 4, WHITE);
      }
    },
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W + 4, 1, p.c, A.side ? 1 : 0);
      b.cr(T, W + 2, 1, sh(p.c, 0.34), A.side ? 1 : 0);
      b.cr(T - 1, W - 3, 1, li(p.c, 0.27), -1);
    },
  },
  // a small crown in front of the ears
  crown: {
    over(b, A, p) {
      const T = A.top, dx = A.side ? 1 : 0;
      const rows = A.side ? [".....l..", ".l..lc..", ".cllccs.", "..clggs.", "..ssss.."]
        : [ "...ll...", "l..cc..s", "cllgglcs", ".clggcs.", ".ssssss." ];
      b.grid(b.c0 - 4 + dx, T - 5, rows, { c: p.c, s: sh(p.c, 0.4), l: li(p.c, 0.58), g: A.back ? p.c : p.g });
      if (!A.back) b.fp(b.c0 - 0.5 + dx, T - 3, li(p.g, 0.7));
    },
  },
  // a dark-red band with three curved horns and a blood-red gem
  horncrown: {
    over(b, A, p) {
      const T = A.top;
      b.cr(T - 1, 6, 1, sh(p.c)); b.cr(T - 2, 6, 1, p.c);
      b.sym(2, T - 3, 1, 2, p.c); b.sym(3, T - 4, 1, 1, li(p.c));
      b.sym(1, T - 4, 1, 2, p.c);
      if (!A.back) { b.cr(T - 2, 2, 1, p.g); b.cr(T - 3, 1, 1, p.g); b.cr(T - 4, 1, 2, li(p.c), 0); }
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
      b.cr(T, W + 2, 1, p.t || "#f4f0f4"); b.cr(T - 4, 2, 2, p.t || "#f4f0f4", k * 6);
    },
  },
  // an open-faced knight's helm with cheek guards and a plume
  helm: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      const metal = sh(p.c, 0.45), bevel = li(p.c, 0.66);
      b.cr(T - 3, W - 4, 1, bevel);
      b.cr(T - 2, W, 1, p.c);
      b.cr(T - 1, W + 2, 2, p.c);
      b.cr(T + 1, W + 2, 1, metal);
      b.r(b.c0 + 1, T - 2, Math.floor(W / 2) - 1, 3, sh(p.c, 0.24));
      b.cr(T - 1, 2, 2, bevel, -1);
      b.sym(Math.ceil(W / 2) - 1, T + 2, 2, Math.min(2, A.ny - T - 2), metal);
      b.sym(Math.ceil(W / 2) - 1, T + 1, 1, 1, bevel);
      b.grid(b.c0 - 4, T - 7, [".llc...", "cccss..", ".ss.cc.", "....sc."], { c: p.b, s: sh(p.b, 0.36), l: li(p.b, 0.46) }, A.back);
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
  // a wide sun hat: the brim droops at both ends, a flower sits on the band
  sunhat: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top;
      b.cr(T - 4, 6, 1, p.c); b.cr(T - 3, 8, 1, p.c); b.cr(T - 2, 8, 1, p.b);
      b.r(b.c0 + 2, T - 4, 2, 2, sh(p.c)); b.r(b.c0 - 3, T - 4, 2, 1, li(p.c, 0.3));
    },
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W + 6, 1, li(p.c, 0.2)); b.cr(T, W + 8, 1, p.c); b.cr(T, W + 2, 1, sh(p.c));
      b.sym(W / 2 + 2, T + 1, 2, 1, sh(p.c));
      if (!A.back) { b.r(b.c0 + 1, T - 3, 2, 2, p.f); b.px(b.c0 + 1, T - 3, li(p.f, 0.5)); }
    },
  },
  // a wound turban, folds running across it, a jewel at the brow; it covers the ears
  turban: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, dk = sh(p.c, 0.28);
      b.cr(T, W + 2, 1, dk); b.cr(T - 1, W + 2, 1, p.c); b.cr(T - 2, W + 2, 1, p.c); b.cr(T - 3, W, 1, p.c); b.cr(T - 4, W - 4, 1, p.c);
      for (let x = A.x0; x <= A.x1 - 2; x += 3) { b.px(x, T - 1, dk); b.px(x + 1, T - 2, dk); b.px(x + 2, T - 3, dk); }
      b.r(A.x0 + 1, T - 4 + 1, 2, 1, li(p.c, 0.4));
      if (A.back) b.cr(T, 2, 1, sh(p.c, 0.5));
      else { const k = A.side ? 2 : 0; b.cr(T - 2, 2, 2, p.b, k); b.cr(T - 2, 1, 1, li(p.b, 0.6), k - 0.5); }
    },
  },
  // goggles pushed up on the forehead, a strap round the head (in front of the ears)
  goggles: {
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T, W, 1, p.s);
      if (A.back) { b.cr(T, 2, 1, p.b); return; }
      b.sym(0, T - 2, 4, 1, p.b); b.sym(3, T - 1, 1, 2, p.b); b.cr(T - 1, 2, 2, p.b);
      b.sym(1, T - 1, 2, 2, p.c); b.sym(1, T, 2, 1, sh(p.c, 0.3));
      b.px(b.c0 + 1, T - 1, li(p.c, 0.7)); b.px(b.c0 - 3, T - 1, li(p.c, 0.7));
    },
  },
  // an explorer's pith helmet: a round crown, a band, a short brim all round
  pith: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W, 1, p.b); b.cr(T - 2, W, 1, p.c); b.cr(T - 3, W - 2, 1, p.c); b.cr(T - 4, W - 4, 1, p.c); b.cr(T - 5, 2, 1, sh(p.c));
      b.r(A.x1 - 2, T - 3, 2, 2, sh(p.c)); b.r(A.x0 + 2, T - 4, 2, 1, li(p.c, 0.5));
      if (!A.back) b.cr(T - 2, 2, 1, GOLD, A.side ? 2 : 0);
    },
    over(b, A, p) { const W = A.x1 - A.x0 + 1; b.cr(A.top, W + 4, 1, sh(p.c, 0.3)); b.cr(A.top, W, 1, sh(p.c, 0.15)); },
  },
  // a woven bamboo cone, wider than the head; it covers the ears
  bamboo: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      const rows = [[5, 2], [4, 6], [3, W], [2, W + 4], [1, W + 8]];
      for (const [dy, w] of rows) b.cr(T - dy, w, 1, p.c);
      for (const [dy, w] of rows.slice(1)) { b.sym(Math.round((5 - dy) * 1.5), T - dy, 1, 1, sh(p.c)); b.r(Math.round(16 - w / 2) + 1, T - dy, 1, 1, li(p.c, 0.4)); }
      b.cr(T - 5, 2, 1, p.b); b.cr(T, W + 4, 1, sh(p.c, 0.4));
    },
  },
  // a miner's hard hat with a lamp at the brow
  miner: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 1, W, 1, p.c); b.cr(T - 2, W, 1, p.c); b.cr(T - 3, W - 2, 1, p.c); b.cr(T - 4, W - 6, 1, sh(p.c));
      b.r(A.x1 - 2, T - 3, 2, 3, sh(p.c)); b.r(A.x0 + 1, T - 3, 2, 1, li(p.c, 0.5));
      b.cr(T, W + 2, 1, sh(p.c, 0.4));
      if (A.front) { b.cr(T - 2, 4, 2, p.b); b.cr(T - 2, 2, 2, p.l); b.cr(T - 3, 2, 1, p.b); }
      if (A.side) { b.r(A.x1 - 1, T - 2, 3, 2, p.b); b.r(A.x1 + 1, T - 2, 1, 2, p.l); }
      if (A.back) b.cr(T - 1, W, 1, p.b);
    },
  },
  // 명인 낚시꾼: a soft bucket hat, the brim sloping down, a float pinned to the band (the trim, what a dye
  // recolours); at 64px the band's fish embroidery on the crown and the brim's stitched edge, both in the trim
  bucket: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 4, W - 2, 1, p.c); b.cr(T - 3, W, 2, p.c); b.cr(T - 1, W, 1, p.b);
      b.r(A.x1 - 2, T - 4, 2, 3, sh(p.c)); b.r(A.x0 + 1, T - 4, 3, 1, li(p.c, 0.4));
      b.r(A.x1 - 2, T - 1, 2, 1, sh(p.b, 0.25));
      if (A.back) return;
      const x = A.side ? b.c0 - 3 : A.x0 + 2, y = T - 3;   // a fish swimming toward the float
      for (const [u, v] of [[0, 0.5], [0.5, 0], [0.5, 0.5], [1, 0], [1, 0.5], [1.5, 0.5]]) b.fp(x + u, y + v, p.b);
      b.fp(x - 0.5, y, p.b); b.fp(x - 0.5, y + 1, p.b); b.fp(x + 1.5, y, INK);
    },
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, x0 = Math.round(A.cx + 0.5 - (W + 4) / 2);
      b.cr(T, W + 4, 1, p.c); b.cr(T, W, 1, sh(p.c)); b.sym(W / 2 + 2, T + 1, 1, 1, sh(p.c));
      for (let x = x0; x < x0 + W + 4; x++) b.fp(x + (x & 1) * 0.5, T + 0.5, p.b);
      if (!A.back) { const x = b.c0 + (A.side ? 3 : 2); b.px(x, T - 2, p.l); b.px(x, T - 3, "#ffffff"); b.px(x, T - 1, p.l); b.fp(x, T - 2, li(p.l, 0.5)); }
    },
  },
  // a cleaner's polka-dot kerchief snug over the crown, knotted at the back with two short tails
  kerchief: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, dk = sh(p.c, 0.3);
      b.cr(T, W + 2, 1, dk); b.cr(T - 1, W, 1, p.c); b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 3, Math.max(2, W - 6), 1, p.c);
      b.r(A.x1 - 2, T - 2, 2, 2, sh(p.c)); b.r(A.x0 + 2, T - 2, 2, 1, li(p.c, 0.3));
      for (let x = A.x0 + 1; x <= A.x1 - 1; x += 3) b.px(x, T - 1, p.b);
      b.px(b.c0, T - 2, p.b);
      if (A.back) { b.cr(T, 2, 1, p.c); b.px(b.c0 - 2, T + 1, p.c); b.px(b.c0 + 1, T + 1, dk); b.px(b.c0 - 2, T + 2, dk); b.px(b.c0 + 1, T + 2, p.c); }
      else if (A.side) { b.px(A.x0 - 1, T - 1, p.c); b.px(A.x0 - 2, T, p.c); b.px(A.x0 - 2, T + 1, dk); }
    },
  },
  // 버드나무 마을: a woven straw bonnet, a green ribbon band, a willow-leaf pin; ears through, knotted at the nape
  strawhood: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, dk = sh(p.c, 0.3), lt = li(p.c, 0.3);
      b.cr(T, W + 2, 1, lt); b.cr(T - 1, W, 1, p.b); b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 3, Math.max(2, W - 6), 1, p.c);
      for (let x = A.x0; x <= A.x1 + 1; x += 3) b.px(x, T, dk);
      b.r(A.x1 - 2, T - 2, 2, 1, dk); b.r(A.x0 + 2, T - 3, 2, 1, lt);
      // the weave: a native over-under check across the crown
      for (let x = A.x0 + 1; x < A.x1; x++) for (const y of [T - 2, T - 3]) b.fp(x + ((x + y) & 1) * 0.5, y + 0.5, dk);
      // from behind: a bow on the brim, one tail trailing (two straight tails would read as eyes)
      if (A.back) { b.r(b.c0 - 2, T, 5, 1, p.b); b.px(b.c0, T, sh(p.b, 0.35)); b.px(b.c0, T + 1, sh(p.b, 0.2)); b.px(b.c0 + 1, T + 2, sh(p.b, 0.35)); }
      else if (A.side) { b.px(A.x0 - 1, T - 1, p.b); b.px(A.x0 - 2, T, p.b); b.px(A.x0 - 2, T + 1, sh(p.b, 0.3)); }
    },
    over(b, A, p) {
      if (A.back) return;
      const x = A.side ? b.c0 + 1 : A.x1 - 3, y = A.top - 2, lf = "#5aa84a";
      b.grid(x, y, [".l", "lv"], { l: li(lf, 0.25), v: sh(lf, 0.3) });
      b.fp(x + 1, y + 0.5, li(lf, 0.6));
    },
  },
  // 협동 알바 왕: a work cap, a visor in the trim colour, a little gold crown badge on the front
  coopcap: {
    ears: "through",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 1, W, 2, p.c); b.r(A.x1 - 2, T - 2, 2, 3, sh(p.c));
      b.r(A.x0 + 1, T - 2, 2, 1, li(p.c, 0.3)); b.cr(T - 3, 2, 1, p.b);
      if (A.front) b.cr(T + 1, W - 2, 1, p.b);
      if (A.side) { b.r(A.x1 - 1, T, 5, 1, p.b); b.r(A.x1 + 1, T + 1, 3, 1, sh(p.b, 0.3)); }
      if (A.back) { b.cr(T, 4, 1, sh(p.c, 0.5)); b.cr(T, 2, 1, p.b); }
    },
    over(b, A, p) {
      if (A.back) return;
      const x = A.side ? A.x1 - 4 : b.c0 - 2, y = A.top - 2;
      b.grid(x, y, ["y.y.y", "yyyyy"], { y: GOLD });
      b.fp(x + 2.25, y + 1, "#e04a4a");
    },
  },
  // 낚시 기록가: a yellow sou'wester, a band, the back brim long so the rain runs off behind; it covers the ears
  souwester: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, dk = sh(p.c, 0.3), lt = li(p.c, 0.35);
      b.cr(T - 4, W - 4, 1, p.c); b.cr(T - 3, W - 2, 2, p.c); b.cr(T - 1, W - 2, 1, p.b);
      b.r(A.x1 - 3, T - 4, 2, 3, dk); b.r(A.x0 + 2, T - 4, 2, 1, lt);
      // native stitched panel seams down the crown
      for (let y = T - 4; y < T - 1; y += 0.5) { b.fp(b.c0 - 1.5, y, dk); b.fp(b.c0 + 1, y, dk); }
      if (A.side) {
        b.r(A.x0 - 3, T, W + 5, 1, p.c); b.r(A.x0 - 4, T + 1, 4, 1, dk); b.px(A.x0 - 4, T + 2, dk);
        b.r(A.x1 - 1, T, 3, 1, lt);
      } else if (A.back) {
        b.cr(T, W + 4, 1, p.c); b.cr(T + 1, W + 2, 1, dk); b.cr(T + 2, W - 2, 1, dk);
      } else {
        b.cr(T, W + 4, 1, lt); b.sym(W / 2 + 1, T + 1, 1, 1, dk);
      }
    },
  },
  // a short leaf-brimmed patrol cap, a folded tidal brim, and an aviator helmet
  willowcap: {
    ears: "through",
    draw(b, A, p) {
      const y = A.top, w = A.x1 - A.x0 + 1;
      b.cr(y - 2, w - 4, 1, li(p.c));
      b.cr(y - 1, w - 2, 2, p.c);
      b.cr(y + 1, w, 1, sh(p.c, 0.4), A.side ? 1 : 0);
    },
    over(b, A, p) {
      if (A.back) return;
      const x = A.side ? b.c0 + 1 : b.c0 - 1;
      b.grid(x, A.top - 2, ["..ll", ".lls", "cs.."], { l: p.b, s: sh(p.b, 0.4), c: p.c });
    },
  },
  tidebrim: {
    ears: "through",
    draw(b, A, p) {
      const y = A.top, w = A.x1 - A.x0 + 1;
      b.cr(y - 3, w - 6, 1, li(p.c));
      b.cr(y - 2, w - 4, 2, p.c);
      b.cr(y, w, 1, p.b);
    },
    over(b, A, p) {
      const y = A.top, w = A.x1 - A.x0 + 1, x = A.side ? A.x1 - 2 : A.x0;
      b.cr(y, w + 1, 1, sh(p.b, 0.4), A.side ? 1 : 0);
      b.r(x, y - 1, 3, 1, A.back ? p.b : p.r);
      b.r(A.x0 - (A.side ? 0 : 1), y + 1, Math.floor(w / 2), 1, p.b);
    },
  },
  surveycap: {
    ears: "behind",
    draw(b, A, p) {
      const y = A.top, w = A.x1 - A.x0 + 1;
      b.cr(y - 4, w - 6, 1, li(p.c, 0.45));
      b.cr(y - 3, w - 4, 1, p.c);
      b.cr(y - 2, w, 3, p.c);
      b.cr(y + 1, w - 2, 1, sh(p.c, 0.46));
      b.r(A.x0, y, 2, Math.min(3, A.ny - y), sh(p.c, 0.4));
      if (!A.side) b.r(A.x1 - 1, y, 2, Math.min(3, A.ny - y), sh(p.c, 0.4));
      const x = A.side ? b.c0 + 1 : b.c0 - 2;
      b.r(x, y - 2, 4, 2, p.b);
      b.r(x + 1, y - 1, 2, 1, A.back ? sh(p.b) : p.g);
    },
  },
  archiveCap: {
    ears: "through",
    draw(b, A, p) {
      const y = A.top, w = A.x1 - A.x0 + 1;
      b.cr(y - 3, w - 4, 1, li(p.c));
      b.cr(y - 2, w - 2, 2, p.c);
      b.cr(y, w + 2, 1, p.b);
      b.cr(y + 1, w, 1, sh(p.c, 0.4));
    },
    over(b, A, p) {
      const x = A.side ? b.c0 - 3 : A.x1 - 3;
      b.grid(x, A.top - 6, [".ll", "lls", "ls.", "s.."], { l: p.b, s: sh(p.b, 0.4) }, A.back);
    },
  },
  ramblerHat: {
    ears: "behind",
    draw(b, A, p) {
      const y = A.top, w = A.x1 - A.x0 + 1;
      b.cr(y - 4, w - 6, 1, li(p.c, 0.45), -1);
      b.cr(y - 3, w - 4, 2, p.c, -1);
      b.cr(y - 1, w - 2, 1, p.b);
      b.cr(y, w + 4, 1, sh(p.c, 0.35), A.side ? 1 : 0);
      b.cr(y + 1, w + 2, 1, p.c, A.side ? 1 : 0);
    },
    over(b, A, p) {
      const x = A.side ? A.x0 + 1 : b.c0 + 1;
      b.grid(x, A.top - 4, [".l.", "lls", "lss", ".s."], { l: p.r, s: sh(p.r, 0.38) }, A.back);
    },
  },
  // 봄 장날: a twig across the head, three five-petal blossoms on it (petals the trim), the middle one in front;
  // at 64px a lit petal, a shaded one and a stamen each. In front of the ears.
  blossomBand: {
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, tw = p.c, pk = p.b, back = sh(pk, 0.22), lt = li(pk, 0.55), dk = sh(pk, 0.4);
      b.cr(T - 1, W, 1, tw);
      const bloom = (x, y, col) => {
        b.grid(x - 1, y - 1, [".p.", "pyp", ".p."], { p: col, y: "#f8d860" });
        b.fp(x, y - 1, lt); b.fp(x + 1.5, y, dk); b.fp(x + 0.5, y + 1.5, dk); b.fp(x + 0.5, y + 0.5, "#e8904a");
      };
      bloom(A.x0 + 2, T - 2, back); bloom(A.x1 - 2, T - 2, back); bloom(b.c0, T - 3, pk);
      b.fp(A.x0 + 4, T - 1.5, "#7ac05a"); b.fp(A.x1 - 4.5, T - 1.5, "#7ac05a");
    },
  },
  // 여름 장날: an orange starfish clinging to the head (dye recolours it whole), a lit middle and dots at 64px
  starfish: {
    over(b, A, p) {
      const T = A.top, x = A.side ? b.c0 - 3 : A.x1 - 6, lt = li(p.c, 0.5);
      b.grid(x, T - 4, ["..c..", ".ccc.", "ccscc", ".ccc.", ".c.c."], { c: p.c, s: lt });
      for (const [u, v] of [[2, 0.5], [0.5, 2], [3.5, 2], [1, 3.5], [3, 3.5]]) b.fp(x + u, T - 4 + v, lt);
      b.fp(x + 1.5, T - 3, sh(p.c, 0.35)); b.fp(x + 3, T - 2.5, sh(p.c, 0.35));
    },
  },
  // 가을 장날: a twig crown of maple leaves, the big middle leaf the trim, a red and a gold one beside; veins at 64px
  mapleWreath: {
    over(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, tw = "#7a4a34";
      b.cr(T - 1, W, 1, tw);
      const small = (x, col) => { b.grid(x, T - 3, ["c.c", "ccc", ".s."], { c: col, s: tw }); b.fp(x + 1, T - 2.5, sh(col, 0.35)); };
      small(A.x0 + 1, p.c); small(A.x1 - 3, "#e8b030");
      const x = b.c0 - 2;
      b.grid(x, T - 5, ["..c..", "c.c.c", "ccccc", ".ccc.", "..s.."], { c: p.b, s: tw });
      for (let v = 0; v < 3; v += 0.5) b.fp(x + 2.5, T - 4.5 + v, sh(p.b, 0.35));
      b.fp(x + 1, T - 3, li(p.b, 0.5)); b.fp(x + 3.5, T - 2.5, sh(p.b, 0.35));
    },
  },
  // 겨울 장날: a knit hat, a row of snowflakes (the trim) round it, a white fur brim and pompom; it covers the ears (tall ones stand clear above).
  // At 64px the knit ribs, each flake's six arms (a plus on the native grid) and fluffy tufts.
  snowknit: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, fur = "#f4f6fc", fs = "#c8d0e4", rib = sh(p.c, 0.18);
      b.cr(T - 1, W, 1, p.c); b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 3, Math.max(2, W - 6), 1, p.c);
      b.r(A.x1 - 2, T - 3, 2, 2, sh(p.c));
      for (let y = T - 3; y < T; y++) for (let x = A.x0; x <= A.x1; x++) b.fp(x + 0.5, y, rib);
      // a flake: one dot at 32px; at 64px a little x of five native pixels (a plus would read as a red cross)
      for (let x = A.x0 + 2; x < A.x1 - 1; x += 3) {
        b.px(x, T - 2, p.b);
        for (const [u, v] of [[0.5, 0], [0, 0.5], [0.5, 0.5]]) b.fp(x + u, T - 2 + v, p.c);
        for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.fp(x + u, T - 2 + v, p.b);
      }
      b.cr(T, W + 2, 1, fur);
      for (let x = A.x0; x <= A.x1; x += 2) { b.px(x, T, fs); b.fp(x + 0.5, T + 0.5, fur); }
      b.cr(T - 5, 2, 2, fur); b.px(b.c0, T - 4, fs);
      b.fp(b.c0 - 1.5, T - 4.5, fur); b.fp(b.c0 + 1, T - 5.5, fur); b.fp(b.c0 + 1, T - 3.5, fs);
    },
  },
  // 이야기 기념품 · 바람등호: a sky navigator's peaked cap, the crown wider than the brass band (the trim),
  // a dark visor; the keepsake compass on the front (at 64px a cream face, a red needle). It covers the ears.
  navcap: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, vis = "#2e2a3e";
      b.cr(T - 3, W + 2, 1, li(p.c, 0.3)); b.cr(T - 2, W + 2, 1, p.c); b.r(A.x1 - 1, T - 3, 3, 2, sh(p.c, 0.3));
      b.cr(T - 1, W, 1, p.b); b.r(A.x1 - 2, T - 1, 2, 1, sh(p.b, 0.3));
      if (A.front) b.cr(T, W - 2, 1, vis);
      if (A.side) b.r(A.x1 - 1, T, 4, 1, vis);
      if (A.back) b.cr(T - 1, 2, 1, li(p.b, 0.4));
    },
    over(b, A, p) {
      if (A.back) return;
      const x = A.side ? A.x1 - 4 : b.c0 - 1, y = A.top - 3;
      b.r(x, y, 2, 2, GOLD); b.px(x + 1, y + 1, sh(GOLD, 0.3));
      b.fp(x + 0.5, y + 0.5, "#f4ecd8"); b.fp(x + 1, y + 0.5, "#e04a4a"); b.fp(x + 0.5, y + 1, "#f4ecd8"); b.fp(x + 1, y + 1, "#3a3440");
    },
  },
  // 이야기 기념품 · 마지막 사관: a black 사모 (a low front, a round raised crown, a flat wing each side) with
  // 갈피's grey quill (the trim) tucked in the band; its barbs at 64px. It covers the ears.
  samo: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, dk = sh(p.c, 0.3), lt = li(p.c, 0.28);
      b.cr(T - 1, W, 1, p.c); b.cr(T - 2, W - 2, 1, p.c); b.cr(T - 3, W - 4, 1, p.c); b.cr(T - 4, W - 6, 1, lt);
      b.r(A.x1 - 3, T - 3, 2, 2, dk); b.cr(T, W + 2, 1, dk);
      const wing = (x) => { b.r(x, T - 2, 3, 1, p.c); b.fp(x, T - 2, lt); b.fp(x + 0.5, T - 2, lt); b.fp(x + 1, T - 1.5, dk); b.fp(x + 1.5, T - 1.5, dk); };
      if (A.side) { b.r(A.x0 - 1, T - 2, 2, 1, p.c); b.fp(A.x0 - 1, T - 2, lt); return; }
      wing(A.x0 - 2); wing(A.x1);
    },
    over(b, A, p) {
      const x = A.back || A.side ? A.x0 + 1 : A.x1 - 4, y = A.top - 7, q = p.b, ql = li(q, 0.5), qd = sh(q, 0.35);
      b.grid(x, y, ["..qq", ".qqd", "qqd.", "s..."], { q, d: qd, s: sh(q, 0.55) }, A.back || A.side);
      const fx = (u) => (A.back || A.side ? x + 3.5 - u : x + u);
      for (const [u, v] of [[2, 0], [3, 0], [1, 1], [0, 2]]) b.fp(fx(u), y + v, ql);
      for (const [u, v] of [[3.5, 1.5], [2.5, 2.5], [1.5, 2.5]]) b.fp(fx(u), y + v, qd);
    },
  },
  // 이야기 기념품 · 나루터의 먹물: 여울 할머니's 삿갓, a wide shallow cone of woven reed, the rim soaked in ink
  // (the trim, what a dye recolours) and a gold bead, the lamp-oil drop, on a cord at one tip; the weave and the ink
  // creeping up from the rim at 64px. The same cone from every side; it covers the ears.
  satgat: {
    ears: "behind",
    draw(b, A, p) {
      const T = A.top, W = A.x1 - A.x0 + 1, dk = sh(p.c, 0.3), lt = li(p.c, 0.3);
      const L = (w) => Math.round(A.cx + 0.5 - w / 2);   // the left end of a row `w` wide, as cr lays it
      b.cr(T - 4, 2, 1, dk);
      b.cr(T - 3, 6, 1, p.c); b.r(L(6), T - 3, 2, 1, lt);
      b.cr(T - 2, W, 1, p.c); b.r(L(W) + 1, T - 2, 3, 1, lt); b.r(L(W) + W - 3, T - 2, 3, 1, dk);
      b.cr(T - 1, W + 4, 1, p.c); b.r(L(W + 4) + W, T - 1, 4, 1, dk);
      b.cr(T, W + 8, 1, p.b); b.r(L(W + 8) + 1, T, 3, 1, li(p.b, 0.3)); b.r(L(W + 8) + W + 5, T, 3, 1, sh(p.b, 0.35));
      // the weave: native over-under across the cone; the ink seeping a half pixel up into the reed
      for (let x = L(W) + 1; x < L(W) + W - 1; x++) b.fp(x + ((x + T) & 1) * 0.5, T - 1.5, dk);
      for (let x = L(W + 4); x < L(W + 4) + W + 4; x += 2) b.fp(x + 0.5, T - 0.5, sh(p.b, 0.1));
      // the cord and its bead hang from the brim's tip (the far tip from behind)
      const tx = A.back ? L(W + 8) : L(W + 8) + W + 7;
      b.px(tx, T + 1, sh(p.b, 0.2)); b.px(tx, T + 2, GOLD); b.fp(tx, T + 2, "#fff6c0"); b.fp(tx + 0.5, T + 2.5, sh(GOLD, 0.3));
    },
  },
  // shards of the rift circling over the head and the ears, drifting with the walk
  shards: {
    ink: "#3b2a66",
    over(b, A, p) {
      const T = Math.min(A.top, A.earTop) - 7 + (A.f === 1 ? 1 : 0), d = A.f === 2 || A.f === 4 ? 1 : 0;
      b.cr(T, 2, 4, p.c); b.px(b.c0 - 1, T, li(p.c, 0.6)); b.px(b.c0, T + 3, sh(p.c));
      b.sym(3, T + 2 + d, 2, 2, p.c, sh(p.c, 0.15)); b.px(b.c0 - 5, T + 2 + d, li(p.c, 0.6));
      b.sym(6, T + 4 - d, 1, 2, p.b);
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

/** 생활 명인's badge, embroidered at 64px only: a gold bar over a bar of the piece's trim (so it takes the dye). */
const masterBadge = (b, x, y, trim) => { b.fp(x, y, li(GOLD, 0.4)); b.fp(x + 0.5, y, GOLD); b.fp(x, y + 0.5, trim); b.fp(x + 0.5, y + 0.5, trim); };

const TOP = {
  overalls: {
    front: [".blbblb.", ".byccyb.", ".scllcs."],
    side: [".bblbbb.", ".bccycb.", ".sscccs."],
    back: [".lbbbbl.", ".blbbcb.", ".scsscs."],
    icon: ["..bb..bb..", ".bblbblbb.", "bbblbblbbb", "b.byllyb.b", "..sccccs..", "..scllcs..", "..sccccs..", "..ss..ss.."],
    fine(b, A, pal) {
      if (!A.front) return;
      b.fp(15, A.foot - 0.5, pal.s);
      b.fp(16.5, A.foot - 0.5, pal.s);
    },
  },
  hoodie: {
    front: [".lccccs.", ".cwccws.", ".scllcs."],
    side: [".scllcs.", ".scccws.", ".scccls."],
    back: [".lccccs.", ".scddcs.", ".sccccs."],
    nape: "..slls..",
    icon: ["...lccs...", "..ldddcs..", "..lsddcs..", ".lccsscsc.", "lcwccwccss", "cscclcccss", "ssccllcsss", ".ssccccss.", "..ssssss.."],
    fine(b, A, pal) {
      if (!A.front) return;
      b.fp(15, A.foot - 0.5, pal.s);
      b.fp(16.5, A.foot - 0.5, pal.s);
      b.fp(14, A.foot - 1.5, pal.w);
      b.fp(17.5, A.foot - 1.5, pal.w);
    },
  },
  sailor: {
    pal: (p) => ({ c: WHITE, s: sh(WHITE, 0.3), n: p.c, N: sh(p.c), r: "#e04a4a" }),
    front: [".nnrrnn.", ".ccrccc.", ".NNNNNN."], side: [".cnnnrn.", ".cccccr.", ".NNNNNN."], back: [".nccccn.", ".nnnnnn.", ".NNNNNN."],
  },
  armor: {
    pal: (p) => ({ c: p.c, s: sh(p.c, 0.28), l: li(p.c, 0.6), b: "#71503f", B: "#51374a", y: GOLD }),
    front: ["llsclls.", ".slccs..", ".bbybbB."],
    side: [".sclllss", ".ssslcs.", ".Bbbbyb."],
    back: ["llsclls.", ".sclcs..", ".BbbbbB."],
    icon: [".ll....ss.", "llscllcsss", "lssccccsss", ".scllccs..", ".dsccss...", "..sccss...", "..bbybb...", "..sccss..."],
    fine(b, A, pal) {
      b.fp(14, A.foot - 1.5, pal.l);
      b.fp(17.5, A.foot - 1.5, pal.l);
      if (A.front) b.fp(15.5, A.foot - 0.5, pal.B);
    },
  },
  robe: {
    front: [".lcBBcs.", ".scbycs.", "sccBBcds", "..sBBs.."],
    side: [".sscbcs.", ".scclbs.", "sdsccBs.", "...cBs.."],
    back: [".lccccs.", ".scybcs.", "sscccdss", "..ssss.."],
    icon: ["..lc..cs..", ".lccbbccs.", "lcccByccss", "ssccBbcsds", "..ccBbcs..", ".lccBbcds.", ".sccBbcdd.", "scccBbcdss", "ssccBBdsss"],
    fine(b, A, pal) {
      if (!A.front) return;
      b.fp(15, A.foot - 1.5, pal.b);
      b.fp(15.5, A.foot - 1.5, pal.y);
      b.fp(15.5, A.foot - 1, pal.b);
      b.fp(15.5, A.foot - 0.5, pal.b);
    },
  },
  dress: {
    front: [".lcsscl.", ".bcylcb.", "slcsccss", "..cccc.."],
    side: [".sccccl.", ".Bbccyb.", "ssccccss", "..sccc.."],
    back: [".lccccs.", ".sBbbBs.", "slccsccs", "..sccs.."],
    icon: ["..lc..cs..", ".lccssccs.", "..bcylcb..", "...BBbs...", "..lccccs..", ".lccccccs.", ".sccsccss.", "scccccccss", ".ssssssss."],
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
  // a cord round the neck with a shell on it (the fur shows everywhere else)
  necklace: {
    pal: (p) => ({ b: p.c, w: p.b, W: sh(p.b, 0.25) }),
    front: [".b....b.", "..bwWb..", "........"], side: ["..b...b.", "...bwWb.", "........"], back: [".b....b.", "..bbbb..", "........"],
  },
  swim: {
    pal: () => ({ W: sh(WHITE, 0.22) }),
    front: [".lccccs.", ".wwwwwW.", ".lccccs."], side: [".sccccl.", ".Wwwwww.", ".sccccl."], back: [".cccccs.", ".wwwwwW.", ".cccccs."],
  },
  // a pocketed shirt, a red neckerchief, a belt
  safari: {
    front: [".lcrrcl.", ".cdccdc.", ".bbybbb."], side: [".scccrr.", ".sccdcc.", ".bbbbyb."], back: [".lccccl.", ".cccccc.", ".bbbbbb."],
  },
  // a long robe with a white collar and a sash; a crest on the back
  dopo: {
    front: [".clwwlc.", ".bbbbbB.", "sccllccs", "...cc..."], side: [".scccwc.", ".Bbbbbb.", "ssccccc.", "...cc..."], back: [".ccyycc.", ".bbBBbb.", "sccccccs", "...cc..."],
  },
  // wooden prayer beads, a tassel at the bottom
  beads: {
    pal: (p) => ({ b: p.c, B: li(p.c, 0.45), y: p.b }),
    front: [".bB..Bb.", "..bBbB..", "...yy..."], side: ["..bB.Bb.", "....bBb.", ".....y.."], back: [".bBbBbB.", "...bB...", "........"],
  },
  // crossed leather straps over a plain shirt, a belt of pouches
  delver: {
    front: [".bccccb.", ".cbyybc.", ".BBBBBB."], side: [".sccbcc.", ".sccybc.", ".BBBBBB."], back: [".bccccb.", ".cbbbbc.", ".BBBBBB."],
  },
  // 명인 요리사: a white double-breasted coat, the neckerchief (the trim) knotted behind; at 64px the hem's piping
  // in the trim and the 명인 badge between the buttons
  chefcoat: {
    pal: (p) => ({ c: "#f8f8ff", s: sh("#f8f8ff", 0.25), l: "#ffffff", r: p.b }),
    front: [".scrrcs.", ".cyccyc.", ".syccys."], side: [".sccrrc.", ".scccyc.", ".ssccyc."], back: [".scrrcs.", ".csccsc.", ".sccccs."],
    fine(b, A, pal) {
      for (let x = 13; x < 19; x += 0.5) b.fp(x, A.foot - 0.5, pal.r);
      if (A.front) masterBadge(b, 15.5, A.foot - 2, pal.r);
    },
  },
  // a bib apron: straps over the shoulders, a pocket (d), tied in a bow behind
  apron: {
    pal: (p) => ({ d: p.d }),
    front: [".bccccb.", ".ccddcc.", ".cccccc.", "...cc..."], side: [".bbcccc.", "..bccdc.", "...cccc."], back: [".b....b.", "..bbbb..", "...bb..."],
  },
  // 명인 대장장이: a smith's thick apron, straps (the trim), a tool loop, a scorched hem; at 64px brass rivets where
  // the straps meet the bib, the 명인 badge, sparks burnt into the hem
  smith: {
    front: [".bccccb.", ".cccycc.", ".cddddc.", "...cc..."], side: [".bbcccc.", "..bccyc.", "..bdddc."], back: [".b....b.", "..bbbb..", "..b..b.."],
    fine(b, A, pal) {
      if (A.back) return;
      if (A.foot - A.bt >= 3) { b.fp(A.side ? 13 : 13.5, A.foot - 2.5, GOLD); if (A.front) b.fp(18, A.foot - 2.5, GOLD); }
      if (A.front) { masterBadge(b, 14, A.foot - 2, pal.b); b.fp(15, A.foot - 1, "#e8903a"); b.fp(16.5, A.foot - 0.5, "#e8903a"); }
    },
  },
  // 명인 연금술사: a long coat, a bandolier (the trim) of vials across it; at 64px the vials' glints, the hem's
  // piping in the trim and the 명인 badge on the breast
  alch: {
    pal: () => ({ g: "#6ae08a", r: "#ff6a8a" }),
    front: [".bgcccl.", ".ccbrcc.", ".ccccby.", "...cc..."], side: [".scccbg.", ".sccbrc.", ".sccccc.", "...cc..."], back: [".ccccbc.", ".cccbcc.", ".ccbccc.", "...cc..."],
    fine(b, A, pal) {
      for (let x = 15; x < 17; x += 0.5) b.fp(x, A.foot + 0.5, pal.b);
      if (A.back) return;
      if (A.foot - A.bt >= 3) b.fp(A.side ? 18 : 14, A.foot - 3, WHITE);
      b.fp(A.side ? 17 : 16, A.foot - 2, WHITE);
      if (A.front) masterBadge(b, 13.5, A.foot - 2, pal.b);
    },
  },
  // a scarf wound round the neck, one end hanging with a fringe
  scarf: {
    front: ["cccccccc", ".....cs.", ".....b.."], side: [".cccccc.", "cs......", "b......."], back: ["cccccccc", ".cs.....", ".b......"],
  },
  // 버드나무 마을: a linen bib apron patched by the neighbours (p, q); the pocket's stitches at 64px
  patchApron: {
    pal: () => ({ p: "#e8845a", q: "#6a9ad8" }),
    front: [".bccccb.", ".cppccc.", ".ccccqc.", "...cc..."], side: [".bbcccc.", "..bcppc.", "...ccqc."], back: [".b....b.", "..bbbb..", "...bb..."],
    fine(b, A, pal, y0) {
      if (A.back) return;
      const x = A.side ? 16 : 13, y = y0 + 1;
      for (let i = 0; i < 4; i++) b.fp(x + i * 0.5, y, WHITE);
      b.fp(x, y + 0.5, WHITE); b.fp(x + 1.5, y + 0.5, WHITE);
    },
  },
  // 협동 알바 왕: a pinstriped work vest, two pens in the chest pocket
  coopVest: {
    pal: (p) => ({ p: sh(p.c, 0.3), e: "#e04a4a", f: "#4a8ae0" }),
    front: [".cbcbef.", ".cbcbpp.", ".sBsBss."], side: [".scbcbe.", ".scbcbp.", ".ssBsBs."], back: [".cbcbcb.", ".cbcbcb.", ".sBsBsB."],
    fine(b, A, pal, y0) {
      if (A.back) return;
      const x = A.side ? 18 : 17;
      b.fp(x, y0, WHITE); b.fp(A.side ? 18.5 : 18.5, y0, GOLD);
    },
  },
  // 낚시 기록가: a long yellow raincoat, a trim collar, float buttons, every seam stitched (64px)
  raincoat: {
    front: [".lcbbcs.", ".lccrcs.", ".lccrcd.", "..sccs.."], side: [".lcccbb.", ".scccrc.", ".sccsrd.", "...ccs.."], back: [".lbbbbc.", ".lcclcs.", ".lccccd.", "..sccs.."],
    fine(b, A, pal, y0) {
      const seam = sh(pal.c, 0.45);
      for (let y = y0 + 1; y < A.foot; y += 0.5) {
        if (!A.side) { b.fp(13.5, y, seam); b.fp(18, y, seam); } else b.fp(14, y, seam);
      }
      if (!A.back) for (let y = y0 + 1; y < A.foot; y++) b.fp(A.side ? 17 : 16, y, WHITE);
    },
  },
  patrolVest: {
    front: [".lbcccs.", ".scbccs.", ".dcybcd."],
    side: [".lscccs.", ".scybcs.", ".ddcbcd."],
    back: [".lcsscs.", ".scllcs.", ".dclccd."],
  },
  traderCoat: {
    pal: (p) => ({ r: p.r }),
    front: [".cbccbc.", ".lsbbsc.", ".srrrss.", "..sccs.."],
    side: [".bbccbc.", ".bccbcs.", ".srrrss.", "...ccs.."],
    back: [".cbccbc.", ".cbbbbc.", ".srrrss.", "..sccs.."],
  },
  surveyCoat: {
    front: [".lbbbbc.", ".cycysc.", ".cycysd.", "..d..d.."],
    side: [".lcccbb.", ".sccycs.", ".dccycd.", "..d..d.."],
    back: [".lbbbbc.", ".lcbcls.", ".dcbcsd.", "..d..d.."],
  },
  archiveRobe: {
    front: [".wbcbwc.", ".scbcls.", ".dcsbcd.", "..sssc.."],
    side: [".lccwbw.", ".sccbcs.", ".dccbcd.", "...ssc.."],
    back: [".cwwwwc.", ".scllcs.", ".dcsscd.", "..sccs.."],
  },
  ramblerVest: {
    front: [".lbbblc.", ".lyccys.", ".dbssbd."],
    side: [".lcbbbc.", ".lccybs.", ".sdbbsd."],
    back: [".lbbbbc.", ".lcscls.", ".dcsssd."],
  },
  // 봄 장날: an open pink cardigan over a white tee, bud buttons and a ribbed hem in the trim, knitted petals
  // (p); at 64px five-dot blossoms
  blossomCardigan: {
    pal: (p) => ({ p: "#fff2f6" }),
    // deep outer columns so the pale pink still parts from white fur at 1×
    front: [".dcwwcd.", ".dbwwbd.", ".BBBBBB."], side: [".dcccbd.", ".dcpccd.", ".BBBBBB."], back: [".dcpccd.", ".dccccd.", ".BBBBBB."],
    fine(b, A, pal, y0) {
      const at = A.back ? [[15, y0], [18, y0 + 1]] : A.side ? [[15, y0 + 1]] : [[13, y0 + 1]];
      for (const [x, y] of at) { b.fp(x - 0.5, y, pal.p); b.fp(x + 0.5, y, pal.p); b.fp(x, y - 0.5, pal.p); b.fp(x, y + 0.5, pal.p); b.fp(x, y, "#f8d860"); }
      if (!A.back) for (let x = 12.5; x < 19.5; x += 1) b.fp(x, y0 + 2.5, pal.B);
    },
  },
  // 여름 장날: a loud flowered summer shirt (the flowers are the trim), open at the neck, one gold button
  alohaShirt: {
    front: [".lb..bs.", ".cbcycb.", ".sccybs."], side: [".lcbccs.", ".bccbcs.", ".scbccs."], back: [".lcbccs.", ".ccbcbs.", ".sbccbs."],
    fine(b, A, pal, y0) {
      const at = A.back ? [[15, y0], [17, y0 + 1]] : A.side ? [[15, y0], [16, y0 + 1]] : [[14, y0], [18, y0 + 1]];
      for (const [x, y] of at) { b.fp(x + 0.5, y + 0.5, "#fff0a0"); b.fp(x, y, li(pal.b, 0.45)); }
    },
  },
  // 가을 장날: a mustard cable-knit sweater, two cables down the front, a maple-leaf patch (the trim), a ribbed hem;
  // at 64px the cables twist (light and shade halves swapping each half row)
  cableKnit: {
    // deep outer columns: mustard alone melts into a shiba's tan
    front: [".dlccld.", ".dlbcld.", ".dsdsds."], side: [".dclccd.", ".dcbccd.", ".dsdsds."], back: [".dlccld.", ".dlccld.", ".dsdsds."],
    fine(b, A, pal, y0) {
      const cols = A.side ? [15] : [14, 17];
      for (const x of cols) for (let y = y0; y < y0 + 2; y += 0.5) { b.fp(x + ((y * 2) & 1 ? 0.5 : 0), y, pal.s); }
      if (!A.back) { const x = 15; b.fp(x, y0 + 1, li(pal.b, 0.4)); b.fp(x + 0.5, y0 + 1.5, sh(pal.b, 0.35)); }
    },
  },
  // 견습 장인 (P10): one strap across the chest, a tool belt with a short canvas flap, the skill's tool hung on the
  // hip where it breaks the silhouette (so the outline reads it): 망치 국자 가위 찌 약병 편지; at 64px the work's
  // smudges on the fur (soot, flour, grass, spray, potion, ink) and the tool's small parts
  toolBelt: {
    pal: (p) => ({ t: p.t, g: "#d4d8e4", G: "#868aa0", h: "#8a5a3a", e: "#5ad07a", E: "#2e9a5a" }),
    front: ["..b.....", "...b....", ".bbbybb.", "..cccc.."], side: ["....b...", "....b...", ".bbbbyb.", "...cc..."], back: ["......b.", ".....b..", ".bbbbbb.", "..cccc.."],
    fine(b, A, pal, y0) {
      const T = APPRENTICE[pal.t], f = A.foot, x = A.front ? 18 : 12;
      b.grid(x, f - 2, T.rows, pal, !A.front);
      if (T.fine) T.fine(b, x, f - 2, pal, !A.front);
      if (A.back) return;
      for (const [dx, dy] of A.side ? [[16, 0.5], [17.5, 1]] : [[14.5, 0.5], [16.5, 0], [17, 1]]) b.fp(dx, y0 + dy, T.smudge);
    },
  },
  // 겨울 장날: a thick winter coat, a cream fur collar and hem (l, so it still parts from white fur), wooden
  // toggles (the trim); at 64px the fur's tufts along both edges
  furCoat: {
    pal: () => ({ l: "#f2ead8", L: "#d4c8b4" }),
    front: [".llllll.", ".cbccbs.", ".lLlLlL.", "..sccs.."], side: [".sllllL.", ".sccbcs.", ".lLlLlL.", "...ccs.."], back: [".llllll.", ".ccsscs.", ".lLlLlL.", "..sccs.."],
    fine(b, A, pal, y0) {
      for (let x = 13; x < 19; x += 1) { b.fp(x + 0.5, y0 + 1, pal.l); b.fp(x, y0 + 2, pal.c); }
    },
  },
};
/**
 * 견습 장인's tools, two columns by three rows from the hip down (g/G metal, h wood, e/E potion, r red, w white),
 * `fine` adds 64px parts at (x + dx, y + dy), mirrored with the grid; `smudge` is the work's stain on the fur.
 */
const APPRENTICE = {
  hammer: { rows: ["gG", "h.", "h."], smudge: "#4a4652", fine: (b, x, y, p, fl) => { b.fp(x + (fl ? 0 : 1.5), y + 0.5, p.G); } },
  ladle: { rows: ["g.", "g.", "gG"], smudge: "#fffaf0", fine: (b, x, y, p, fl) => { b.fp(x + (fl ? 1.5 : 0), y, p.g); b.fp(x + 0.5, y + 2.5, p.G); } },
  shears: { rows: ["rr", "gg", "g."], smudge: "#6aa84a", fine: (b, x, y, p, fl) => { b.fp(x + 0.5, y + 0.5, WHITE); b.fp(x + (fl ? 0.5 : 1), y + 2, p.g); } },
  float: { rows: ["r.", "r.", "w."], smudge: "#8ad0f4", fine: (b, x, y, p, fl) => { b.fp(x + (fl ? 1.5 : 0), y + 0.5, WHITE); b.fp(x + (fl ? 1 : 0.5), y + 3, p.G); } },
  flask: { rows: ["h.", "ee", "eE"], smudge: "#8ae07a", fine: (b, x, y, p, fl) => { b.fp(x + (fl ? 1 : 0.5), y + 1, WHITE); } },
  letter: { rows: ["ww", "wr"], smudge: "#3a3a6a", fine: (b, x, y, p, fl) => { b.fp(x + 0.5, y + 0.5, "#c8c4d4"); b.fp(x + 1, y, "#c8c4d4"); } },
};
/** The colours a top template reads. */
const topPal = (t, p) => ({ c: p.c, s: sh(p.c), d: sh(p.c, 0.45), l: li(p.c, 0.3), b: p.b || p.c, B: sh(p.b || p.c), w: WHITE, y: GOLD, r: "#e04a4a", k: INK, ...(t.pal ? t.pal(p) : {}) });
/** Draw a top template on the body of this frame. */
function wearTop(t) {
  if (typeof t === "function") return t; // set modules draw their own top
  return (b, A, p) => {
    const rows = t[A.view] || t.front, pal = topPal(t, p);
    const n = A.foot - A.bt, [T, M, B, F] = rows;
    const body = n <= 2 ? [M, B] : n === 3 ? [T, M, B] : [T, T, M, B];
    body.forEach((s, i) => b.grid(12, A.foot - body.length + i, [s], pal));
    if (F) b.grid(12, A.foot, [F], pal);
    if (t.fine) t.fine(b, A, pal, A.foot - body.length);
    if (A.back && t.nape) b.grid(12, A.bt - 1, [t.nape], pal);
  };
}

// ───────────────────────────── back pieces ─────────────────────────────
// Drawn behind the body in front and three-quarter views, over the body but under the head
// from the back. They swing with the walk: `sway` is +1 on one step, −1 on the other.

const sway = (A) => (A.f === 2 ? 1 : A.f === 4 ? -1 : 0);
/**
 * A pair of wings from the shoulder blades. Each template ends with the root at its lower
 * right. The roots stay attached through the walk cycle, and the far wing in the side view
 * sits closer to the centerline and in shadow.
 */
function wingPair(rows, palOf) {
  return (b, A, p) => {
    const pal = palOf(p), w = rows[0].length, h = rows.length;
    const flap = A.f === 1 || A.f === 2 ? -1 : A.f === 3 || A.f === 4 ? 1 : 0;
    const y = A.bt + 1 - h + flap, left = A.side ? 13 : 12, right = A.side ? 17 : 19;
    b.grid(left - w + 1, y, rows, pal);
    if (A.icon) return;
    b.grid(right, A.side ? y + 1 : y, rows, A.side ? { ...pal, c: pal.s, l: pal.c } : pal, true);
    const rootTop = Math.min(A.bt, y + h - 1);
    b.r(left - 1, rootTop, 2, A.bt + 2 - rootTop, pal.s);
    b.r(right, rootTop, 2, A.bt + 2 - rootTop, pal.s);
  };
}
/** The mantle widens into folds at the hem. The walk pulls the lower folds to one side. */
function cloak(b, A, p, bat = false) {
  const last = A.foot - 1, shadow = sh(p.c, 0.31), lining = bat ? "#915991" : sh(p.c, 0.49);
  const top = A.icon ? last - 7 : A.bt;
  for (let y = top; y <= last; y++) {
    const spread = Math.round((y - top) * 3 / Math.max(1, last - top)), shift = y === last ? sway(A) : 0;
    const x = (A.side ? 12 : 13) - spread + shift;
    const w = A.side ? 2 + spread - shift : 6 + 2 * spread;
    if (bat && y === last && !A.side) {
      b.grid(x, y, ["sss.ss.ss.sss"], { s: lining });
      continue;
    }
    b.r(x, y, w, 1, A.front ? shadow : p.c);
    if (A.side) {
      b.px(x, y, y === last ? lining : li(p.c, 0.2));
      b.px(x + w - 1, y, shadow);
    } else if (A.back) {
      b.px(x + w - 2, y, shadow);
      b.px(x + 1, y, spread === 0 ? li(p.c, 0.27) : shadow);
      if (y === last) b.r(x + 1, y, w - 2, 1, lining);
    }
  }
  if (A.icon) b.cr(top, 2, 1, GOLD);
}
const BACK = {
  cape: cloak,
  batcape: (b, A, p) => cloak(b, A, p, true),
  // feathered: a rounded leading edge up top, three feather tips along the bottom
  angel: wingPair([
    "ll........",
    "lcc.......",
    "lcccl.....",
    "lcsccl....",
    "ccssccl...",
    "sccssccs..",
    ".sccscccs.",
    ".s.sccsccs",
    "...s.scccs",
    ".....s.scc",
    "........cc",
  ], (p) => ({ c: p.c, l: "#ffffff", s: p.b })),
  // leathery: a bone along the top from the claw, the membrane scalloped between the fingers
  bat: wingPair([
    "l.........",
    "ll........",
    "lcsl......",
    "lccsl.....",
    "cscccll...",
    "csscsclls.",
    "ccsscslcsl",
    "c..ccsccss",
    "....s..ccs",
    "........sc",
  ], (p) => ({ c: p.c, l: p.b, s: sh(p.c, 0.46) })),
  // two little lobes, the upper one pale with a glint, the lower one tinted
  fairy: wingPair([
    ".lc......",
    "lclc.....",
    "lcccl....",
    ".csccs...",
    "..cccsc..",
    "...sccsc.",
    "..b..csc.",
    ".blbbscc.",
    ".bbBbbBcc",
    "..BBB..cc",
  ], (p) => ({ c: p.c, l: li(p.c, 0.78), b: p.b, B: sh(p.b, 0.32), s: sh(p.c, 0.39) })),
  pack: (b, A, p) => {
    const y = A.foot - 5, pal = {
      c: p.c, s: sh(p.c, 0.36), l: li(p.c, 0.34), d: sh(p.c, 0.57), g: GOLD, a: "#84945f",
    };
    if (A.back) {
      b.grid(12, y, ["..aaaa..", ".llccss.", "dcsssccd", "dclggcsd", ".sssssd."], pal);
      b.fp(15, A.foot - 1.5, pal.d);
      b.fp(16, A.foot - 1.5, pal.d);
    } else if (A.side) {
      b.grid(8, y, [".aaa..", "llcss.", "csgcsd", "clccsd", ".sssd."], pal);
    } else b.r(13, A.bt - 1, 6, 2, pal.c);
  },
  // bigger and spikier than a bat's: a horn at the wrist, two finger spines, a ragged edge
  dragon: wingPair([
    "l..........",
    "ll.........",
    "lcs.l......",
    "lcslcl.....",
    "cscclcl....",
    "csccssll...",
    "csssccscll.",
    "s..csscssll",
    "....s.csccs",
    "........scc",
    ".........sc",
  ], (p) => ({ c: p.c, l: p.b, s: sh(p.c, 0.46) })),
  // a surfboard taller than its owner, upright behind one shoulder
  surf: (b, A, p) => {
    const y0 = A.bt - 13, y1 = A.foot - 1, x = A.front ? 20 : 8, dk = sh(p.c, 0.3);
    b.r(x + 1, y0, 2, 1, p.c); b.r(x, y0 + 1, 4, y1 - y0 - 1, p.c); b.r(x + 1, y1, 2, 1, dk);
    b.r(A.front ? x + 3 : x, y0 + 2, 1, y1 - y0 - 3, dk); b.r(x + 1, y0 + 1, 1, 3, li(p.c, 0.6));
    b.r(x, y0 + 5, 4, 2, p.b); b.r(x, y1 - 4, 4, 1, p.b);
  },
  // a water gourd at the hip: two bulbs, a red cord, a cork; it bounces with the step
  gourd: (b, A, p) => {
    const rows = [".bb.", ".lc.", "lccs", ".rr.", "lccs", "cccs", ".ss."];
    b.grid(A.back ? 19 : 8, A.foot - 6 - (sway(A) ? 1 : 0), rows, { c: p.c, l: li(p.c, 0.45), s: sh(p.c, 0.3), b: p.b, r: "#d04a4a" }, A.back);
  },
  // a lantern swinging from a pole that rises behind the shoulder
  lantern: (b, A, p) => {
    const T = A.top, sw = sway(A), x = A.front ? 23 : A.side ? 9 : 8, out = A.front ? 1 : -1;
    b.r(x, T - 6, 1, A.foot - (T - 6), p.c);
    b.r(out > 0 ? x + 1 : x - 2, T - 6, 2, 1, p.c);
    b.grid((out > 0 ? x + 1 : x - 3) + sw, T - 5, [".k.", "bbb", "yly", "yoy", "bbb"], { k: p.b, b: p.b, y: "#ffe680", l: "#fffbe0", o: "#ffb040" });
  },
  // 명인 채집꾼: a wicker basket brimming with herbs, a leather band round it (the trim); from behind, at 64px, the
  // weave and the 명인 badge on the band
  basket: (b, A, p) => {
    const y = A.bt, last = A.foot - 1, dk = sh(p.c, 0.3), lt = li(p.c, 0.35), leaf = "#5aa84a", lf2 = "#8ad06a", band = p.b || dk;
    if (A.back) {
      b.r(12, y, 8, last - y + 1, p.c); b.r(12, y, 8, 1, lt); b.r(12, last, 8, 1, dk);
      for (let x = 13; x < 20; x += 2) b.px(x, y + 1, dk);
      for (let v = y + 1; v < last; v++) for (let x = 12; x < 20; x++) b.fp(x + ((x + v) & 1) * 0.5, v + 0.5, dk);
      if (last - 1 > y + 1) { b.r(12, last - 1, 8, 1, band); b.r(18, last - 1, 2, 1, sh(band, 0.3)); masterBadge(b, 15.5, last - 1, li(band, 0.25)); }
      b.r(10, y, 2, 1, leaf); b.r(20, y, 2, 1, lf2); b.px(10, y - 1, lf2); b.px(21, y - 1, leaf);
    } else if (A.side) {
      b.r(8, y - 1, 5, last - y + 2, p.c); b.r(8, y - 1, 5, 1, lt); b.r(8, last, 5, 1, dk); b.px(9, y + 1, dk); b.px(11, y + 1, dk);
      if (last - 1 > y + 1) b.r(8, last - 1, 5, 1, band);
      b.r(7, y - 2, 4, 1, leaf); b.px(8, y - 3, lf2); b.px(10, y - 3, leaf); b.px(9, y - 2, lf2);
    } else {
      b.r(10, y, 12, last - y + 1, p.c); b.r(10, y, 12, 1, lt); b.r(10, last, 12, 1, dk); b.px(11, y + 1, dk); b.px(20, y + 1, dk);
      if (last - 1 > y + 1) b.r(10, last - 1, 12, 1, band);
      b.r(8, y - 1, 3, 1, leaf); b.px(8, y - 2, lf2); b.r(21, y - 1, 3, 1, leaf); b.px(23, y - 2, lf2);
    }
  },
  // a courier's satchel at the hip, a letter sticking out
  satchel: (b, A, p) => {
    const rows = ["..ww", "bbbb", "cycc", "cccc", "ssss"];
    b.grid(A.back ? 18 : A.side ? 9 : 8, A.bt - 1, rows, { c: p.c, s: sh(p.c, 0.35), b: sh(p.c, 0.2), y: GOLD, w: WHITE }, A.back);
  },
  // 명인 배달부: the courier's satchel, its flap (the trim) over a tan bag, a buckle, a letter sticking out; at 64px
  // the letter's red seal, the flap's stitched edge and the 명인 badge on the flap
  courier: (b, A, p) => {
    const x = A.back ? 18 : A.side ? 9 : 8, y = A.bt - 1, fl = !!A.back;
    b.grid(x, y, ["..ww", "bbbb", "BybB", "cccc", "ssss"], { c: p.c, s: sh(p.c, 0.35), b: p.b, B: sh(p.b, 0.3), y: GOLD, w: WHITE }, fl);
    const fx = (u) => (fl ? x + 3.5 - u : x + u);
    b.fp(fx(2.5), y, "#d84a3a"); b.fp(fx(3), y + 0.5, "#c8c4d4");
    for (let u = 0; u < 4; u += 0.5) if (u < 1 || u >= 2.5) b.fp(fx(u), y + 2.5, sh(p.b, 0.5));
    masterBadge(b, fx(fl ? 3.5 : 2.5), y + 1, li(p.b, 0.3));
  },
  // a smith's great hammer slung across the back, its head over one shoulder
  hammer: (b, A, p) => {
    const y0 = A.top - 5, y1 = A.foot - 1, dk = sh(p.c, 0.3);
    const head = (x) => { b.r(x, y0 - 4, 6, 4, p.c); b.r(x, y0 - 4, 6, 1, li(p.c, 0.5)); b.r(x, y0 - 1, 6, 1, dk); b.r(x + 5, y0 - 3, 1, 2, dk); b.r(x + 2, y0 - 3, 2, 2, p.s); };
    if (A.side) { b.r(11, y0, 1, y1 - y0 + 1, p.b); head(8); return; }
    const xa = A.back ? 21 : 10, xb = A.back ? 9 : 22;
    for (let y = y0; y <= y1; y++) b.r(Math.round(xb + ((xa - xb) * (y - y0)) / (y1 - y0)), y, 2, 1, p.b);
    head(xb - 2);
  },
  // a horned skull on a pole: what is left of a boss
  trophy: (b, A, p) => {
    const T = A.top, x = A.front ? 23 : A.side ? 9 : 8;
    b.r(x, T - 4, 1, A.foot - (T - 4), p.b);
    b.grid(x - 2, T - 9, ["h...h", "hwwsh", "wewes", ".wws.", ".w.s."], { h: p.h, w: p.c, s: sh(p.c, 0.25), e: p.e });
  },
  // a bear plush riding on the back, peeking over the shoulder
  plush: (b, A, p) => {
    const y = A.bt, pal = { c: p.c, l: li(p.c, 0.55), s: sh(p.c, 0.3), k: INK };
    const head = ["c..c", "cccc", "ckck", "clls"];
    if (A.back) { b.r(17, y, 5, 3, p.c); b.r(17, y + 2, 5, 1, pal.s); b.r(18, y, 4, 1, p.b); b.grid(21, y - 4, head, pal, true); }
    else if (A.side) { b.r(8, y, 5, 3, p.c); b.r(8, y + 2, 5, 1, pal.s); b.r(8, y, 4, 1, p.b); b.grid(6, y - 4, head, pal); }
    else { b.grid(6, y - 4, head, pal); b.r(8, y, 4, 1, p.c); b.r(7, y, 3, 1, p.b); }
  },
  // a waiter's silver tray balanced on the shoulder, a domed lid on it; it bobs with the step
  tray: (b, A, p) => {
    const y = A.bt - 5 - (sway(A) ? 1 : 0);
    const x = A.front ? A.x1 + 1 : A.side ? A.x0 - 7 : 4;
    b.grid(x, y, ["...y...", "..lcc..", ".lcccs.", ".ccccs.", "bbbbbbb", ".BBBBB."], { c: p.c, l: li(p.c, 0.6), s: sh(p.c, 0.3), y: GOLD, b: p.b, B: sh(p.b, 0.35) }, A.back);
    if (!A.back) {
      // A short holder at the tray's inner edge meets the character's shoulder.
      const from = A.front ? x + 1 : x + 5, shoulder = A.front ? 18 : 13;
      b.r(Math.min(from, shoulder), y + 5, Math.abs(from - shoulder) + 1, 1, sh(p.b, 0.35));
      b.r(shoulder, y + 6, 1, 2, sh(p.b, 0.35));
    }
  },
  // a little cauldron worn like a pack, green brew bubbling over its rim
  cauldron: (b, A, p) => {
    const y = A.back ? A.bt : A.bt - 1;
    const x = A.back ? 12 : A.side ? A.x0 - 6 : A.x1 - 1;
    const brew = p.b, foam = li(brew, 0.5);
    const pal = { c: p.c, d: sh(p.c, 0.35), l: li(p.c, 0.3), g: brew, f: foam };
    b.grid(x, y, [".lfgggf.", "lcccccdl", ".lccddd.", "..ddddd."], pal, A.side);
    const edge = x + (A.back ? 5 : A.side ? 1 : 6);
    const rise = A.f & 1;
    if (!A.back) b.px(edge, y - 1 - rise, foam);
    b.px(edge, y + (A.back && rise ? 1 : 0), brew);
  },
  mapcase: (b, A, p) => {
    const pal = { c: p.c, s: sh(p.c, 0.35), l: li(p.c), b: p.b, w: "#f2deaa" };
    if (A.back) {
      b.grid(b.c0 - 5 + sway(A), A.bt, ["..ww.....", ".wblc....", "..blccc..", "...lccbs.", ".....sbs."], pal);
    } else {
      b.grid(A.x0 - (A.side ? 5 : 4), A.bt - 4, [".ww....", "wlbc...", ".lbc...", "..lbc..", "...lbc.", "....cs."], pal);
    }
  },
  tradeJar: (b, A, p) => {
    const y = A.bt - (A.back ? 0 : 2);
    const x = A.back ? b.c0 - 4 + sway(A) : A.side ? A.x0 - 5 : A.x1 - 2;
    const pal = { c: p.c, d: sh(p.c, 0.35), l: li(p.c, 0.45), b: p.b, r: p.r };
    b.grid(x, y, ["..rrrr..", "..lbcd..", ".lbbbdc.", "lcbbbcdc", ".lccccd.", "..dddd.."].slice(0, A.back ? 5 : 6), pal);
  },
  surveyTanks: (b, A, p) => {
    const pal = { c: p.c, s: sh(p.c, 0.4), l: li(p.c, 0.35), b: p.b, g: p.g };
    if (A.back) {
      b.grid(b.c0 - 4 + sway(A), A.bt, [".bb..bb.", "lccsslcs", "lccgglcs", "lcbsslcs", ".ss..ss."], pal);
    } else {
      const x = A.side ? A.x0 - 6 : A.x1 - 1;
      b.grid(x, A.bt - 4, [".bb.", "lccs", "lggs", "lccs", "lcbs", ".ss."], pal);
    }
  },
  // 버드나무 마을: a wicker shopping basket with a gingham cloth (trim), a loaf and a leek sticking out
  marketBasket: (b, A, p) => {
    const y = A.bt, last = A.foot - 1, dk = sh(p.c, 0.32), lt = li(p.c, 0.3);
    const bread = "#e0a050", leek = "#6ac04a", stalk = "#eef0dc";
    const weave = (x0, w) => { for (let yy = y + 1; yy <= last; yy++) for (let x = x0; x < x0 + w; x++) b.fp(x + ((x + yy) & 1) * 0.5, yy + 0.5, dk); };
    if (A.back) {
      b.r(13, y, 7, last - y + 1, p.c); b.r(13, y, 7, 1, lt); b.r(13, last, 7, 1, dk);
      for (let x = 14; x < 20; x += 2) b.px(x, y + 1, dk);
      b.r(14, y, 3, 1, p.b); b.px(15, y, li(p.b, 0.5));
      b.r(20, y - 1, 1, 2, stalk); b.r(21, y - 2, 1, 2, stalk); b.r(22, y - 4, 1, 2, leek); b.px(21, y - 3, leek); b.r(11, y, 2, 1, bread); b.px(11, y - 1, li(bread, 0.3));
      weave(13, 7);
    } else if (A.side) {
      b.r(8, y - 1, 5, last - y + 2, p.c); b.r(8, y - 1, 5, 1, lt); b.r(8, last, 5, 1, dk); b.px(9, y + 1, dk); b.px(11, y + 1, dk);
      b.r(9, y - 2, 2, 1, p.b); b.px(8, y - 3, stalk); b.px(7, y - 4, leek); b.px(8, y - 4, leek); b.r(11, y - 2, 2, 1, bread);
      weave(8, 5);
    } else {
      b.r(10, y, 12, last - y + 1, p.c); b.r(10, y, 12, 1, lt); b.r(10, last, 12, 1, dk); b.px(11, y + 1, dk); b.px(20, y + 1, dk);
      b.r(8, y - 1, 3, 1, bread); b.px(9, y - 2, li(bread, 0.3)); b.r(21, y - 2, 1, 2, stalk); b.r(22, y - 4, 1, 2, leek); b.px(21, y - 3, leek);
    }
  },
  // 협동 알바 왕: the name tag hangs in front (BACK_FRONT); from behind only its cord shows at the nape
  coopTag: (b, A, p) => {
    if (A.back) { b.r(14, A.bt, 4, 1, p.b); b.px(14, A.bt, sh(p.b, 0.3)); b.px(17, A.bt, sh(p.b, 0.3)); }
  },
  // 낚시 기록가: a hanging scroll of a fish print (ink fish, red seal) between two wooden rollers
  fishScroll: (b, A, p) => {
    const y = A.bt, last = A.foot - 1, paper = "#f4ecd8", ink = "#3a3440", wood = p.b, knob = sh(p.b, 0.35);
    if (A.back) {
      const x = 12 + sway(A);
      b.r(x, y, 8, 1, wood); b.px(x, y, knob); b.px(x + 7, y, knob);
      b.r(x + 1, y + 1, 6, last - y, paper);
      b.r(x + 2, y + 1, 3, 1, ink); b.px(x + 6, y + 1, ink); b.px(x + 5, y + 1, sh(paper, 0.2));
      if (last > y + 1) b.px(x + 6, last, "#e04a4a");
      // the print at 64px: an eye, a gill line, a forked tail
      b.fp(x + 2.5, y + 1, paper); b.fp(x + 4, y + 1.5, sh(ink, -0.3)); b.fp(x + 6.5, y + 1.5, paper);
      return;
    }
    if (A.side) {
      b.r(10, y - 3, 2, 1, knob); b.r(10, y - 2, 2, last - y + 2, paper); b.px(11, y - 1, ink); b.px(11, y, ink); b.r(10, last + 0, 2, 1, wood);
      return;
    }
    b.px(11, y, knob); b.px(20, y, knob); b.r(12, y, 1, 1, wood); b.r(19, y, 1, 1, wood);
  },
  moonCape: (b, A, p) => {
    const pal = { c: p.c, s: sh(p.c, 0.5), l: li(p.c, 0.22), g: p.b };
    const sw = sway(A), y = A.bt;
    if (A.back) {
      b.grid(b.c0 - 6 + sw, y, ["..llccccsl..", ".lccgccccss.", ".lcgggcccsc.", "..lcccsscs..", "...ss..ss..."], pal);
    } else if (A.side) {
      b.grid(b.c0 - 9 + sw, y, ["...lcccc", "..lccss.", ".lcsss..", "..s.s..."], pal);
    } else {
      b.grid(b.c0 - 6 + sw, y, ["..lccccssl..", ".lcccccsssc.", ".lssssssssc.", "..ss....ss.."], pal);
    }
  },
  leafCape: (b, A, p) => {
    const pal = { c: p.c, s: sh(p.c, 0.45), l: li(p.c, 0.32), v: p.b };
    const sw = sway(A), y = A.bt;
    if (A.back) {
      b.grid(b.c0 - 6 + sw, y, ["..lllccc....", ".lccvccscss.", "..lccvcscss.", "...lccvsss..", ".....lss...."], pal);
    } else if (A.side) {
      b.grid(b.c0 - 9 + sw, y, ["...llcc.", "..lcccc.", ".lcvcs..", "..css...", "...s...."], pal);
    } else {
      b.grid(b.c0 - 6 + sw, y, ["...llccc....", "..lcccssssc.", "...lcscssss.", ".....csss..."], pal);
    }
  },
};
/** 사계절 and 이야기 기념품 back pieces (P11). */
Object.assign(BACK, {
  // 봄 장날: a paper parasol open over one shoulder, its ribs and scalloped rim the trim; blossoms painted on (64px)
  parasol: (b, A, p) => {
    const sw = sway(A), lt = li(p.c, 0.45), dk = sh(p.c, 0.22), rib = p.b, stick = "#8a5a4a";
    const cx = (A.front ? 8 : A.side ? 8 : 23) + sw, y = A.top - 4 + (A.f === 1 ? 1 : 0), tx = A.back ? 19 : 12;
    b.px(cx, y - 1, stick);
    b.r(cx - 2, y, 5, 1, lt); b.r(cx - 4, y + 1, 9, 1, p.c); b.r(cx - 5, y + 2, 11, 1, p.c);
    for (const dx of [-4, -2, 0, 2, 4]) b.px(cx + dx, y + 3, rib);
    b.px(cx - 2, y + 2, dk); b.px(cx + 2, y + 2, dk); b.px(cx, y + 1, dk);
    for (const [u, v] of [[-3, 1.5], [1.5, 1], [3.5, 2]]) { b.fp(cx + u, y + v, WHITE); b.fp(cx + u + 0.5, y + v, "#f08aa8"); }
    for (const dx of [-4.5, -2.5, -0.5, 1.5, 3.5]) b.fp(cx + dx + 0.5, y + 3.5, sh(rib, 0.3));
    const n = A.bt - (y + 3);
    for (let k = 1; k <= n; k++) b.px(Math.round(cx + ((tx - cx) * k) / n), y + 3 + k, stick);
  },
  // 여름 장날: a striped swim ring round the waist (stripes the trim): the far half here, behind the body; the near
  // half crosses the belly (BACK_FRONT). From behind the whole band shows.
  swimRing: (b, A, p) => {
    const y = Math.min(A.bt + 1, A.foot - 2), st = (x, d) => { const c = (x >> 1) & 1 ? p.b : p.c; return d ? sh(c, 0.28) : c; };
    if (A.back) {
      for (let x = 11; x <= 20; x++) { b.px(x, y, st(x, 0)); b.px(x, y + 1, st(x, 1)); }
      b.px(10, y, st(10, 1)); b.px(21, y, st(21, 1));
      b.fp(12, y, WHITE); b.fp(12.5, y, WHITE);
      return;
    }
    for (let x = 11; x <= 20; x++) b.px(x, y - 1, st(x, 1));
    for (const x of [10, 11, 12, 19, 20, 21]) { b.px(x, y, st(x, 0)); b.px(x, y + 1, st(x, 1)); }
  },
  // 가을 장날: a big acorn pack peeking over one shoulder: the cupule (the trim) cross-hatched at 64px, a glossy nut
  acornPack: (b, A, p) => {
    const pal = { c: p.c, l: li(p.c, 0.45), s: sh(p.c, 0.3), b: p.b, B: sh(p.b, 0.32), k: "#5a3a2a" };
    const rows = ["..k...", ".bbbb.", "bBbBbb", ".BBBB.", ".lccs.", ".lccs.", "..cs.."];
    const x = A.back ? 18 : A.side ? 6 : 7, y = A.bt - 4 + (sway(A) ? 1 : 0);
    b.grid(x, y, rows, pal, !A.back);
    const fx = (u) => (A.back ? x + u : x + 5.5 - u);
    for (const u of [1.5, 2.5, 3.5]) b.fp(fx(u), y + 1.5, pal.B);
    b.fp(fx(1.5), y + 4, WHITE); b.fp(fx(1.5), y + 4.5, li(p.c, 0.7));
  },
  // 겨울 장날: a little snowman riding on the back, peeking over the shoulder, its scarf the trim
  snowmanPack: (b, A, p) => {
    const y = A.bt, snow = "#f4f8ff", pal = { w: snow, s: "#c8d4ec", k: "#3a3440", o: "#f08a3a", b: p.b, B: sh(p.b, 0.35) };
    const head = [".www.", "wkwkw", "wwoow", ".sss.", "bbbbB"];
    if (A.back) { b.r(17, y, 5, 3, snow); b.r(17, y + 2, 5, 1, pal.s); b.px(19, y + 1, pal.k); b.grid(20, y - 5, head, pal, true); }
    else if (A.side) { b.r(8, y, 5, 3, snow); b.r(8, y + 2, 5, 1, pal.s); b.grid(6, y - 5, head, pal); }
    else { b.grid(6, y - 5, head, pal); b.r(8, y, 4, 1, snow); }
    const hx = A.back ? 20 : 6;
    b.fp(hx + 1.5, y - 5, WHITE); b.fp(hx + 4, y - 1, sh(p.b, 0.5)); b.fp(hx + 4.5, y - 1, sh(p.b, 0.5));
  },
  // 이야기 기념품 · 마지막 불빛: a little shop sign raised over the head on two poles, a neon tube round it (the trim)
  // and 「집」 glowing inside (drawn on the native grid at 64px)
  neonSign: (b, A, p) => {
    const sw = sway(A), y = Math.max(2, Math.min(A.top, A.earTop) - 8 + (A.f === 1 ? 1 : 0)), x = (A.side ? 8 : 12) + sw;
    const pole = "#6a5a6a", glow = li(p.b, 0.75);
    b.r(x + 1, y + 5, 1, Math.max(1, A.bt - y - 5), pole); b.r(x + 6, y + 5, 1, Math.max(1, A.bt - y - 5), pole);
    b.grid(x, y, ["bbbbbbbb", "bkkkkkkb", "bkkkkkkb", "bkkkkkkb", "bbbbbbbb"], { b: p.b, k: p.c });
    for (const [u, v] of [[2, 1], [3, 1], [5, 1], [3, 2], [5, 2], [2, 3], [3, 3]]) b.px(x + u, y + v, glow);
    // 집: ㅈ beside ㅣ over ㅂ, one native pixel per stroke
    const G = ["..........", ".gggg.g...", "..gg..g...", ".g..g.g...", ".g..g.....", ".gggg.....", ".gggg....."];
    G.forEach((row, j) => { if (j) for (let i = 0; i < 12; i++) b.fp(x + 1 + i / 2, y + 0.5 + j / 2, row[i] === "g" ? glow : p.c); });
    for (let i = 0; i < 16; i++) b.fp(x + i / 2, y, li(p.b, 0.4));
  },
  // 이야기 기념품 · 종과 별: a little temple bell hanging from a crook rising behind the shoulder, a red rope and
  // tassel (the trim); at 64px its clapper, a rim glint and a wisp of cloud under it
  bellFrame: (b, A, p) => {
    const T = A.top, sw = sway(A), x = A.front ? 23 : A.side ? 9 : 8, out = A.front ? 1 : -1, wood = "#8a5a3a";
    const top = T - 7, bx = (out > 0 ? x + 1 : x - 4) + sw;
    b.r(x, top, 1, A.foot - top, wood);
    b.r(out > 0 ? x + 1 : x - 2, top, 2, 1, wood);
    b.grid(bx, top + 1, ["..b..", ".lcc.", ".lcs.", "lccss", "..b.."], { b: p.b, c: p.c, l: li(p.c, 0.45), s: sh(p.c, 0.3) });
    b.fp(bx + 2, top + 5, sh(p.c, 0.5)); b.fp(bx + 0.5, top + 4, WHITE);
    for (const u of [-1, -0.5, 4.5, 5]) b.fp(bx + u, top + 5.5, "#f4f8ff");
  },
});
/** A strap from one shoulder to the other hip, for what is slung on the back. */
const sling = (b, A, p) => {
  const y = A.bt, n = A.foot - y, st = p.s || sh(p.c, 0.35);
  if (A.side) { b.r(15, y, 1, n, st); return; }
  for (let i = 0; i < n; i++) b.r(Math.max(13, 17 - i * 2), y + i, 2, 1, st);
};
/** What a back piece shows in front of the body (a cape's collar and clasp, a pack's straps), front and side views. */
const BACK_FRONT = {
  surf: sling, gourd: sling, lantern: sling, satchel: sling, courier: sling, hammer: sling, trophy: sling,
  mapcase: sling, tradeJar: sling, fishScroll: sling,
  marketBasket: (b, A, p) => BACK_FRONT.pack(b, A, p),
  // the name tag on the chest: a gold-rimmed card on a cord, a red 「왕」 stroke for a name (64px)
  coopTag: (b, A, p) => {
    const y = A.bt, x = A.side ? 16 : 14, w = A.side ? 2 : 3;
    if (!A.side) { b.px(14, y, p.b); b.px(17, y, p.b); } else b.px(16, y, p.b);
    // a card and its gold rim, kept off the gap between the feet on a sinking breath
    if (y + 2 < A.foot) { b.r(x, y + 2, w, 1, GOLD); b.px(x, y + 2, sh(GOLD, 0.3)); }
    b.r(x, y + 1, w, 1, p.c); b.px(x + w - 1, y + 1, GOLD);
    b.fp(x + 0.5, y + 1.5, "#e04a4a"); b.fp(x + 1, y + 1.5, "#e04a4a"); b.fp(x + 1, y + 1, "#e04a4a");
  },
  surveyTanks: (b, A, p) => BACK_FRONT.pack(b, A, { c: p.b }),
  basket: (b, A, p) => BACK_FRONT.pack(b, A, p), plush: (b, A, p) => BACK_FRONT.pack(b, A, p),
  cauldron: (b, A, p) => BACK_FRONT.pack(b, A, { c: "#6a4434" }),
  cape: (b, A, p) => {
    const y = A.bt;
    if (A.side) { b.r(14, y, 4, 1, p.c); b.px(17, y, GOLD); return; }
    b.r(13, y, 6, 1, p.c); b.px(13, y, sh(p.c)); b.px(18, y, sh(p.c)); b.cr(y, 2, 1, GOLD);
  },
  moonCape: (b, A, p) => BACK_FRONT.cape(b, A, p),
  leafCape: (b, A, p) => {
    const x = b.c0 - (A.side ? 1 : 3), y = A.bt;
    b.r(x, y, 4, 1, p.c); b.px(x + 1, y, p.b);
  },
  batcape: (b, A, p) => BACK_FRONT.cape(b, A, p),
  parasol: sling, bellFrame: sling,
  acornPack: (b, A, p) => BACK_FRONT.pack(b, A, { c: "#6a4434" }),
  snowmanPack: (b, A, p) => BACK_FRONT.pack(b, A, { c: "#8a9ab8" }),
  neonSign: (b, A, p) => BACK_FRONT.pack(b, A, { c: "#6a5a6a" }),
  // the swim ring's near half: one striped row low on the belly (the top stays seen), a shine and a shaded rim at 64px
  swimRing: (b, A, p) => {
    const y = Math.min(A.bt + 1, A.foot - 2), x0 = 13, x1 = 18;
    for (let x = x0; x <= x1; x++) { const c = (x >> 1) & 1 ? p.b : p.c; b.px(x, y + 1, c); b.fp(x, y + 1.5, sh(c, 0.2)); b.fp(x + 0.5, y + 1.5, sh(c, 0.2)); }
    b.fp(x0 + 1, y + 1, WHITE); b.fp(x0 + 1.5, y + 1, WHITE);
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
  crescentFrames: {
    back: true,
    draw(b, A, p) {
      const e = A.eye, c = rim(A, p.c), s = rim(A, p.b);
      if (A.back) { b.px(A.x0, e, s); b.px(A.x1, e, s); return; }
      for (const x of [A.lx, A.rx]) {
        b.r(x - 2, e, 1, 2, s); b.r(x + 2, e, 1, 2, s);
        b.r(x - 1, e + 2, 3, 1, c);
      }
      b.r(A.lx + 2, e, A.rx - A.lx - 3, 1, c);
      if (A.side) b.r(16 - A.halfAt(e), e, A.lx - 1 - (16 - A.halfAt(e)), 1, s);
    },
  },
  amberFrames: {
    back: true,
    draw(b, A, p) {
      const e = A.eye, c = rim(A, p.c), s = rim(A, p.b);
      if (A.back) { b.px(A.x0 + 1, e, s); b.px(A.x1 - 1, e, s); return; }
      for (const x of [A.lx, A.rx]) {
        b.r(x - 2, e - 1, 5, 1, c); b.r(x - 2, e, 1, 2, c); b.r(x + 2, e, 1, 2, c);
        b.r(x - 2, e + 2, 5, 1, s);
      }
      b.r(A.lx + 2, e - 1, A.rx - A.lx - 3, 1, s);
      if (A.side) b.r(16 - A.halfAt(e - 1), e - 1, A.lx - 1 - (16 - A.halfAt(e - 1)), 1, s);
    },
  },
  patrolLeaf: {
    draw(b, A, p) {
      if (A.back) return;
      const x = A.side ? A.cheekL + 1 : A.cheekR - 3;
      const y = A.ny;
      b.grid(x, y, [".lc", "scl"], { l: rim(A, p.b), c: rim(A, p.c), s: rim(A, sh(p.c, 0.5)) });
    },
  },
  tradePearl: {
    draw(b, A, p) {
      if (A.back) return;
      const x = A.side ? A.cheekL + 1 : A.cheekR - 2;
      b.r(x, A.ny, 2, 2, rim(A, p.b));
      b.px(x, A.ny + 1, rim(A, p.c));
      b.px(x + 1, A.ny + 2, rim(A, li(p.c, 0.6)));
    },
  },
  surveyFilter: {
    back: true,
    draw(b, A, p) {
      const y = A.ny, x = A.nx;
      const bnd = rim(A, p.s), metal = rim(A, p.b);
      if (A.back) { b.cr(y, 8, 1, bnd); return; }
      b.r(x - 4, y, 8, 1, bnd);
      b.r(x - 2, y, 4, 2, p.c);
      b.r(x - 3, y + 1, 2, 1, metal);
      b.r(x + 1, y + 1, 2, 1, metal);
      b.r(x - 1, y, 2, 1, li(p.c, 0.35));
    },
  },
  // 이야기 기념품 · 갈대: the old fishing float as an earring by the cheek, red over a band of the trim
  reedFloat: {
    draw(b, A, p) {
      if (A.back) return;
      const x = A.side ? A.cheekL + 1 : A.cheekR - 2, y = A.ny;
      b.px(x + 1, y, rim(A, "#5a4a5a"));
      b.r(x, y + 1, 2, 1, rim(A, p.c)); b.r(x, y + 2, 2, 1, rim(A, p.b));
      b.fp(x + 1, y + 0.5, rim(A, "#5a4a5a")); b.fp(x, y + 1, li(p.c, 0.6)); b.fp(x + 1, y + 2.5, sh(p.b, 0.3));
    },
  },
  // 이야기 기념품 · 균열을 적는 자: 보글's round brass research goggles, violet lenses (the trim) that the eyes
  // show through, a glint in each, a strap round the head
  riftGoggles: {
    back: true,
    draw(b, A, p) {
      const e = A.eye, c = rim(A, p.c), st = rim(A, p.s);
      if (A.back) { b.r(A.x0 + 1, e, A.x1 - A.x0 - 1, 1, st); b.px(A.x0 + 1, e, c); b.px(A.x1 - 1, e, c); return; }
      const ring = (x) => {
        b.r(x, e, 3, 2, p.b);
        b.r(x, e - 1, 3, 1, c); b.r(x, e + 2, 3, 1, c); b.r(x - 1, e, 1, 2, c); b.r(x + 3, e, 1, 2, c);
        b.fp(x + 2, e, li(p.b, 0.8)); b.fp(x + 2.5, e + 0.5, li(p.b, 0.5)); b.fp(x, e - 1, li(p.c, 0.5));
      };
      const L = A.lx - 1, R = A.rx - 1, h = A.halfAt(e);
      ring(L); ring(R);
      if (R - L > 4) b.r(L + 4, e, R - L - 4, 1, c);
      b.r(16 - h, e, Math.max(0, L - 1 - (16 - h)), 1, st);
      if (!A.side) b.r(R + 4, e, Math.max(0, 16 + h - (R + 4)), 1, st);
    },
  },
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
  // a smith's welding goggles: round smoked lenses in brass rims, a thick strap round the head
  forge: {
    covers: true, back: true,
    draw(b, A, p) {
      const e = A.eye, st = rim(A, p.s);
      if (A.back) { b.r(A.x0, e, A.x1 - A.x0 + 1, 1, st); return; }
      const fr = rim(A, p.b);
      for (const x of [A.lx - 1, A.rx - 1]) { b.r(x, e - 1, 4, 1, fr); b.r(x, e, 4, 2, p.c); b.r(x, e + 2, 4, 1, fr); b.px(x + 1, e, li(p.c, 0.6)); b.px(x + 2, e + 1, sh(p.c, 0.3)); }
      b.r(A.lx + 3, e, A.rx - A.lx - 4, 1, fr);
      if (A.side) b.r(16 - A.halfAt(e), e, A.lx - 1 - (16 - A.halfAt(e)), 1, st);
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
  // a diving mask round both eyes (they stay in view) and a breathing tube up the side of the head
  snorkel: {
    back: true,
    draw(b, A, p) {
      const e = A.eye;
      if (A.back) { b.px(A.x0, e, p.c); b.px(A.x1, e, p.c); b.r(A.x0 + 1, A.top, 1, 3, p.b); b.px(A.x0 + 1, A.top, p.t); return; }
      const c = rim(A, p.c), L = A.lx - 2, R = A.rx + 2;
      b.r(L, e - 1, R - L + 1, 1, c); b.r(L, e, 1, 2, c); b.r(R, e, 1, 2, c);
      b.r(L, e + 2, 4, 1, c); b.r(R - 3, e + 2, 4, 1, c);
      const x = A.side ? 16 - A.halfAt(A.top + 1) : 15 + A.halfAt(A.top + 1);
      b.r(x, A.top + 1, 1, e - A.top + 1, p.b); b.px(x, A.top + 1, p.t);
    },
  },
  // stripes of paint on the cheeks and a dab on the brow
  paint: {
    draw(b, A, p) {
      if (A.back) return;
      const y = A.ny, c = rim(A, p.c), c2 = rim(A, p.b);
      for (const [x, k] of A.side ? [[A.cheekR - 3, 1]] : [[A.cheekL, 0], [A.cheekR - 2, 1]]) { b.r(x, y, 3, 1, c); b.r(x + k, y + 1, 2, 1, c2); }
      b.r(A.side ? A.nx : 15, A.top, 2, 1, c);
    },
  },
  // 버드나무 마을: sun-warmed cheeks, a soft rosy dash on each with a native glint
  blush: {
    draw(b, A, p) {
      if (A.back) return;
      const y = A.ny, c = rim(A, p.c);
      for (const x of A.side ? [A.cheekR - 3] : [A.cheekL, A.cheekR - 2]) { b.r(x, y, 3, 1, c); b.fp(x + 0.5, y, li(p.c, 0.6)); b.fp(x + 2, y + 0.5, sh(p.c, 0.2)); }
    },
  },
  // ── face +8 (P11): small marks a 32px face could not hold, sharpened by native pixels at 64px
  // 주근깨: two dots on each cheek, a third between them at 64px
  freckles: {
    draw(b, A, p) {
      if (A.back) return;
      const y = A.ny, c = rim(A, p.c);
      for (const x of A.side ? [A.cheekR - 3] : [A.cheekL, A.cheekR - 2]) { b.px(x, y, c); b.px(x + 2, y, c); b.fp(x + 1, y + 1, c); b.fp(x + 1.5, y - 0.5, c); }
    },
  },
  // 반창고 별: a yellow plaster cut as a star, a pink pad in the middle, two legs at 64px
  starBandage: {
    draw(b, A, p) {
      if (A.back) return;
      const x = Math.min(A.rx + 1, A.cheekR - 3), y = A.ny - 1, c = rim(A, p.c);
      b.grid(x, y, [".c.", "cbc", ".c."], { c, b: p.b });
      b.fp(x, y + 2.5, c); b.fp(x + 2.5, y + 2.5, c); b.fp(x + 1, y + 1, li(p.b, 0.5));
    },
  },
  // 꽃 귀걸이: a hook by the cheek and a five-petal flower under it (a plus at 32px)
  flowerEarring: {
    draw(b, A, p) {
      if (A.back) return;
      const x = A.side ? A.cheekL : A.cheekR - 3, y = A.ny;
      b.px(x + 1, y, rim(A, GOLD));
      b.grid(x, y + 1, [".b.", "bcb", ".b."], { b: rim(A, p.b), c: p.c });
      b.fp(x, y + 1, li(p.b, 0.4)); b.fp(x + 2.5, y + 1, li(p.b, 0.4));
    },
  },
  // 눈꽃 볼 화장: a blue snowflake painted on each cheek, an X at 32px that gains its cross arms at 64px
  snowBlush: {
    draw(b, A, p) {
      if (A.back) return;
      const y = A.ny, s = rim(A, p.b), c = rim(A, p.c);
      for (const x of A.side ? [A.cheekR - 3] : [A.cheekL, A.cheekR - 2]) {
        b.grid(x, y, ["b.b", ".c.", "b.b"], { b: s, c });
        b.fp(x + 1.25, y, s); b.fp(x + 1.25, y + 2.5, s); b.fp(x, y + 1.25, s); b.fp(x + 2.5, y + 1.25, s);
      }
    },
  },
  // 장인 고글 이마걸이: brass work goggles pushed up on the brow (the eyes stay bare), amber lenses, a strap
  browGoggles: {
    back: true,
    draw(b, A, p) {
      const y = Math.max(A.top + 1, A.eye - 3), st = rim(A, p.s);
      if (A.back) { b.r(A.x0, y + 1, A.x1 - A.x0 + 1, 1, st); return; }
      const fr = rim(A, p.c), h = A.halfAt(y + 1);
      b.r(16 - h, y + 1, 2 * h, 1, st);
      for (const x of A.side ? [A.rx - 1] : [A.lx - 1, A.rx - 1]) {
        b.r(x, y, 3, 2, fr); b.px(x + 1, y, p.b); b.fp(x + 1, y, li(p.b, 0.7)); b.fp(x + 0.5, y + 1.5, sh(p.c, 0.35));
      }
    },
  },
  // 밀가루 코끝: flour on the bridge of the nose and a dab on one cheek, sprinkles at 64px
  flourNose: {
    draw(b, A, p) {
      if (A.back) return;
      const y = A.ny, x = A.nx, c = rim(A, p.c);
      b.r(x - 1, y - 1, 2, 1, c);
      b.px(A.side ? A.cheekR - 2 : A.cheekL + 1, y + 1, c);
      b.fp(x - 1.5, y - 1.5, c); b.fp(x + 1, y - 1.5, c); b.fp(x + 1.5, y - 0.5, c);
    },
  },
  // 풀잎 피리: a grass blade at the corner of the mouth, pointing out and down; its midrib at 64px
  grassWhistle: {
    draw(b, A, p) {
      if (A.back) return;
      const y = A.ny + 1, x = A.nx, d = A.side ? -1 : 1, c = rim(A, p.c), s = rim(A, p.b);
      b.px(x + d, y, s); b.px(x + 2 * d, y, c); b.px(x + 3 * d, y + 1, c);
      b.fp(x + 2 * d + 0.5, y + 0.5, li(p.c, 0.5));
    },
  },
  // 참 잘했어요 도장: a red stamped ring on one cheek, the tick inside at 64px
  goodStamp: {
    draw(b, A, p) {
      if (A.back) return;
      const x = A.side ? A.cheekL : A.cheekR - 3, y = A.ny, c = rim(A, p.c);
      b.grid(x, y, ["cc.", "c.c", ".cc"], { c });
      b.fp(x + 1, y + 1, c); b.fp(x + 1.5, y + 1.5, c);
    },
  },
  // a fox mask over the eyes and the nose: slit eyes, red brows, whiskers and a mark on the brow
  fox: {
    covers: true, back: true,
    draw(b, A, p) {
      const e = A.eye;
      if (A.back) { b.r(A.x0, e, 2, 1, p.b); b.r(A.x1 - 1, e, 2, 1, p.b); b.r(15, e, 2, 1, p.b); return; }
      const x0 = A.lx - 2, x1 = A.rx + 3, y1 = A.ny + 1, m = A.side ? A.nx : 15, edge = sh(p.c, 0.34);
      for (let y = e - 2; y <= y1; y++) { const k = y === y1 ? 3 : y === y1 - 1 ? 1 : 0; b.r(x0 + k, y, x1 - x0 + 1 - 2 * k, 1, y >= y1 - 1 ? sh(p.c, 0.14) : p.c); b.px(x0 + k, y, edge); b.px(x1 - k, y, edge); }
      b.r(x0 + 3, y1, x1 - x0 - 5, 1, edge);
      for (const x of [A.lx, A.rx]) b.r(x, e, 2, 1, "#3a2a34");
      b.px(A.lx - 1, e - 1, p.b); b.px(A.rx + 2, e - 1, p.b);
      b.r(m, e - 2, 2, 1, p.b); b.r(m, A.ny, 2, 1, p.b);
      b.px(x0 + 1, A.ny, p.b); b.px(x1 - 1, A.ny, p.b);
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
  hat_bloodcrown: ["hat", "horncrown", { c: "#8a1e2a", g: "#ff3a4a" }],
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
  // ── themed sets (logic COS_SETS): the seaside
  hat_sunhat: ["hat", "sunhat", { c: "#f0d890", b: "#4ab0c8", f: "#ff7a9a" }],
  face_snorkel: ["face", "snorkel", { c: "#3a8ad8", b: "#ffd84a", t: "#ff7a3a" }],
  top_shell: ["top", "necklace", { c: "#c8a070", b: "#ffd8e0" }],
  top_swim: ["top", "swim", { c: "#3a7ad8" }],
  back_surf: ["back", "surf", { c: "#f4f0e0", b: "#ff7a5a", s: "#4a4458" }],
  ws_coral: ["wskin", "coral", {}],
  // the desert
  hat_turban: ["hat", "turban", { c: "#4a6ab8", b: "#f0cc60" }],
  hat_goggles: ["hat", "goggles", { c: "#8ad8f0", b: "#c89a40", s: "#6a4434" }],
  back_cape_sand: ["back", "cape", { c: "#d8b070" }],
  back_gourd: ["back", "gourd", { c: "#c89a50", b: "#6a4434", s: "#6a4434" }],
  ws_dune: ["wskin", "dune", {}],
  // the jungle
  hat_pith: ["hat", "pith", { c: "#e8dcb0", b: "#8a6a44" }],
  top_safari: ["top", "safari", { c: "#c8b078", b: "#6a4434" }],
  face_paint: ["face", "paint", { c: "#4aa84a", b: "#e8f0d8" }],
  // the eastern temple
  hat_bamboo: ["hat", "bamboo", { c: "#d8c070", b: "#8a6a3a" }],
  top_dopo: ["top", "dopo", { c: "#3a5a9a", b: "#f0e8d8" }],
  top_beads: ["top", "beads", { c: "#8a5a3a", b: "#c8402a" }],
  face_fox: ["face", "fox", { c: "#f8f4ec", b: "#e0404a" }],
  ws_bamboo: ["wskin", "bamboo", {}],
  // the brick dungeon
  hat_miner: ["hat", "miner", { c: "#f0c030", b: "#5a5a6a", l: "#fff8c0" }],
  back_lantern: ["back", "lantern", { c: "#8a6a44", b: "#5a4a3a", s: "#6a4434" }],
  top_delver: ["top", "delver", { c: "#a89a80", b: "#7a4a2e" }],
  // the life skill masters
  hat_fisher: ["hat", "bucket", { c: "#8ab06a", b: "#f0e8d0", l: "#e8404a" }],
  top_chefcoat: ["top", "chefcoat", { c: "#f8f8ff", b: "#e04a4a" }],
  back_basket: ["back", "basket", { c: "#c8a060", b: "#8a4a3a" }],
  top_smith: ["top", "smith", { c: "#8a5a3a", b: "#4a3a34" }],
  top_alch: ["top", "alch", { c: "#2e6a6a", b: "#c8a060" }],
  back_satchel: ["back", "courier", { c: "#c8945a", b: "#c8483a" }],
  // gifts from the NPCs who trust you
  top_apron_juju: ["top", "apron", { c: "#ffb0c8", b: "#e0607a", d: "#e04a6a" }],
  back_hammer: ["back", "hammer", { c: "#8a90a0", b: "#8a5a3a", s: "#5a3a2a" }],
  hat_goggles_bogle: ["hat", "goggles", { c: "#7ae07a", b: "#6a7080", s: "#3a3440" }],
  top_apron_moka: ["top", "apron", { c: "#7a543a", b: "#f0e0c0", d: "#f8f0e0" }],
  hat_nightcap: ["hat", "santa", { c: "#4a5aa0", t: "#fff0a0" }],
  // the rift
  hat_shard: ["hat", "shards", { c: "#b07af0", b: "#7af4ff" }],
  back_trophy: ["back", "trophy", { c: "#f0e8d0", h: "#8a7a6a", e: "#e04040", b: "#6a4434", s: "#4a3a34" }],
  ws_shard: ["wskin", "shard", {}],
  // just cute
  hat_wreath_blue: ["hat", "wreath", { c: "#7aa8f0", b: "#e8f0ff" }],
  hat_wreath_white: ["hat", "wreath", { c: "#f8f8ff", b: "#ffd84a" }],
  top_scarf: ["top", "scarf", { c: "#e0404a", b: "#fff0d0" }],
  back_plush: ["back", "plush", { c: "#c89060", b: "#e0405a" }],
  back_batcape: ["back", "batcape", { c: "#4a1a2e" }],   // 밤장막 crimson, bat-wing hem
  ws_bee: ["wskin", "bee", {}],
  ws_clubclaw: ["wskin", "clubclaw", {}],
  ws_porcelain: ["wskin", "porcelain", {}],
  ws_bloodmoon: ["wskin", "bloodmoon", {}],
  ws_dragonflame: ["wskin", "dragonflame", {}],
  ws_seraphwing: ["wskin", "seraphwing", {}],
  ws_prismacrown: ["wskin", "prismacrown", {}],
  // the co-op part-time jobs' S grades
  hat_kerchief: ["hat", "kerchief", { c: "#5a9ae0", b: "#f6f4fa" }],
  back_tray: ["back", "tray", { c: "#d8dce8", b: "#a8acb8" }],
  face_forge: ["face", "forge", { c: "#3a4a40", b: "#c89a40", s: "#4a3a34" }],
  back_cauldron: ["back", "cauldron", { c: "#4a4a58", b: "#7ae07a" }],
  back_booksatchel: ["back", "satchel", { c: "#6a4a9a", b: "#f0c860" }],
  // Willow patrol, coral traders and the brass survey crew
  hat_willow_patrol: ["hat", "willowcap", { c: "#5b734b", b: "#b5c975" }],
  top_willow_patrol: ["top", "patrolVest", { c: "#62794d", b: "#c99755" }],
  back_willow_mapcase: ["back", "mapcase", { c: "#8d6344", b: "#a2ad62", s: "#5c4135" }],
  face_willow_leaf: ["face", "patrolLeaf", { c: "#527741", b: "#b6c973" }],
  hat_coral_merchant: ["hat", "tidebrim", { c: "#eee0b9", b: "#3c928f", r: "#df8669" }],
  top_coral_merchant: ["top", "traderCoat", { c: "#e1d4af", b: "#3c928f", r: "#d57762" }],
  back_coral_jar: ["back", "tradeJar", { c: "#d9e0c7", b: "#3c928f", r: "#dc8569", s: "#765458" }],
  face_coral_pearl: ["face", "tradePearl", { c: "#f0e5c5", b: "#4a9690" }],
  hat_brass_survey: ["hat", "surveycap", { c: "#946348", b: "#dab06b", g: "#b9d2c3" }],
  top_brass_survey: ["top", "surveyCoat", { c: "#555c73", b: "#be9259" }],
  back_brass_tanks: ["back", "surveyTanks", { c: "#bb884e", b: "#5f5a68", g: "#b9d2c3" }],
  face_brass_filter: ["face", "surveyFilter", { c: "#705448", b: "#d9af62", s: "#544751" }],
  hat_moon_archive: ["hat", "archiveCap", { c: "#41516e", b: "#c9cfdb" }],
  top_moon_archive: ["top", "archiveRobe", { c: "#4d587b", b: "#b9c2d5" }],
  back_moon_cape: ["back", "moonCape", { c: "#465377", b: "#f4d99c" }],
  face_moon_glasses: ["face", "crescentFrames", { c: "#c3c5d2", b: "#56637d" }],
  hat_maple_ramblers: ["hat", "ramblerHat", { c: "#966a48", b: "#513a52", r: "#e69242" }],
  top_maple_ramblers: ["top", "ramblerVest", { c: "#a35e47", b: "#e1b976" }],
  back_maple_cape: ["back", "leafCape", { c: "#bc6944", b: "#e4bc75" }],
  face_maple_glasses: ["face", "amberFrames", { c: "#b67e49", b: "#426a65" }],
  // 버드나무 마을, 협동 알바 왕, 낚시 기록가 (P10)
  hat_willow_straw: ["hat", "strawhood", { c: "#e8c272", b: "#6aa84a" }],
  top_willow_apron: ["top", "patchApron", { c: "#f0e4c8", b: "#7a9a4a" }],
  back_willow_basket: ["back", "marketBasket", { c: "#c8945a", b: "#e05a5a" }],
  face_willow_blush: ["face", "blush", { c: "#ff8aa0" }],
  top_coop_vest: ["top", "coopVest", { c: "#3a4a7a", b: "#f0c048" }],
  hat_coop_cap: ["hat", "coopcap", { c: "#3a4a7a", b: "#f0c048" }],
  back_coop_tag: ["back", "coopTag", { c: "#f6f4fa", b: "#e04a4a" }],
  hat_fish_souwester: ["hat", "souwester", { c: "#f0c838", b: "#3a5a8a" }],
  top_fish_raincoat: ["top", "raincoat", { c: "#f0c838", b: "#3a5a8a" }],
  back_fish_scroll: ["back", "fishScroll", { c: "#f4ecd8", b: "#8a5a3a" }],
  // 사계절 (P11): 장꾼 다래's stall; the trim `b` is what a dye recolours (the starfish has none: it dyes whole)
  hat_ssn_sakura: ["hat", "blossomBand", { c: "#8a5a4a", b: "#f8a8c4" }],
  top_ssn_sakura: ["top", "blossomCardigan", { c: "#f09ab8", b: "#d8587a" }],
  back_ssn_sakura: ["back", "parasol", { c: "#f8d0dc", b: "#c8506e" }],
  ws_ssn_sakura: ["wskin", "ssnSakura", {}],
  hat_ssn_sea: ["hat", "starfish", { c: "#ff8a3a" }],
  top_ssn_sea: ["top", "alohaShirt", { c: "#3a9ad0", b: "#ff6a8a" }],
  back_ssn_sea: ["back", "swimRing", { c: "#f6f4fa", b: "#e8484a" }],
  ws_ssn_sea: ["wskin", "ssnSea", {}],
  hat_ssn_maple: ["hat", "mapleWreath", { c: "#c8342a", b: "#f08a2a" }],
  top_ssn_maple: ["top", "cableKnit", { c: "#c8902e", b: "#c83a2a" }],
  back_ssn_maple: ["back", "acornPack", { c: "#b8743a", b: "#8a7a5a" }],
  ws_ssn_maple: ["wskin", "ssnMaple", {}],
  hat_ssn_snow: ["hat", "snowknit", { c: "#4a6ac8", b: "#f4f6fc" }],
  top_ssn_snow: ["top", "furCoat", { c: "#c8404a", b: "#8a5a3a" }],
  back_ssn_snow: ["back", "snowmanPack", { c: "#f4f8ff", b: "#e04a4a" }],
  ws_ssn_snow: ["wskin", "ssnSnow", {}],
  // 이야기 기념품 (P11): 루루 sews the arcs' keepsakes
  face_reed_float: ["face", "reedFloat", { c: "#e04a3a", b: "#f8e070" }],
  back_neon_sign: ["back", "neonSign", { c: "#3a3450", b: "#ff5ab0" }],
  hat_sky_navigator: ["hat", "navcap", { c: "#34406a", b: "#d8a840" }],
  back_cloud_bell: ["back", "bellFrame", { c: "#c89040", b: "#d04a4a" }],
  hat_chronicler: ["hat", "samo", { c: "#3e3a50", b: "#b8bcc8" }],
  face_rift_goggles: ["face", "riftGoggles", { c: "#c8a048", b: "#a070e0", s: "#4a3a4a" }],
  hat_ink_satgat: ["hat", "satgat", { c: "#bcac80", b: "#3c4c7c" }],
  // 견습 장인 (P10): canvas flap `c`, belt `b` (the dye), tool `t` (APPRENTICE)
  top_appr_fish: ["top", "toolBelt", { c: "#5a7aa8", b: "#6a4a3a", t: "float" }],
  top_appr_cook: ["top", "toolBelt", { c: "#f0ece0", b: "#c84a4a", t: "ladle" }],
  top_appr_gather: ["top", "toolBelt", { c: "#7a9a4a", b: "#8a5a3a", t: "shears" }],
  top_appr_craft: ["top", "toolBelt", { c: "#6a5a52", b: "#a8743a", t: "hammer" }],
  top_appr_alch: ["top", "toolBelt", { c: "#7a5aa8", b: "#5a4a3a", t: "flask" }],
  top_appr_deliver: ["top", "toolBelt", { c: "#3a4a7a", b: "#b8743a", t: "letter" }],
  // face +8 (P11)
  face_freckles: ["face", "freckles", { c: "#b0684a" }],
  face_star_bandage: ["face", "starBandage", { c: "#f4d080", b: "#f08aa0" }],
  face_flower_earring: ["face", "flowerEarring", { c: "#f8d860", b: "#f07aa8" }],
  face_snow_blush: ["face", "snowBlush", { c: "#f4f8ff", b: "#5a9ae0" }],
  face_craft_goggles: ["face", "browGoggles", { c: "#c8a048", b: "#e8903a", s: "#5a4040" }],
  face_flour_nose: ["face", "flourNose", { c: "#fffaf0" }],
  face_grass_whistle: ["face", "grassWhistle", { c: "#6ab84a", b: "#3a8a3a" }],
  face_good_stamp: ["face", "goodStamp", { c: "#e04a4a" }],
  // wskin +5 (P11): weapons.js motifs
  ws_willow_twig: ["wskin", "willowTwig", {}],
  ws_lantern: ["wskin", "lantern", {}],
  ws_temple_bell: ["wskin", "templeBell", {}],
  ws_whalebone: ["wskin", "whalebone", {}],
  ws_star_candy: ["wskin", "starCandy", {}],
};
// Set modules (hanbok, career uniforms) merge into the same tables.
Object.assign(HAT, HANBOK_HAT, CAREER_HAT);
Object.assign(TOP, HANBOK_TOP, CAREER_TOP);
Object.assign(ART, HANBOK_ART, CAREER_ART);
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
/**
 * 염색 (P9): the six dyes in the server's order (defs.cosDyes; dye n is DYES[n - 1]). A dye swaps one colour of the
 * piece's own palette — its trim `b`, or its main `c` when it has no trim — so every shade the design derives from
 * that colour follows. Dye 0 hands back the very same art entry: an undyed piece draws byte for byte as before.
 * The black stays off the outline ink (#2b2233) so edges still read.
 */
export const DYES = ["#f08ab4", "#5c9e4a", "#38c4b8", "#9a6ad8", "#e8663a", "#4a4652"];
export function dyed(a, d) {
  if (!a || !d || !DYES[d - 1] || a[0] === "wskin") return a;
  return [a[0], a[1], { ...a[2], ["b" in a[2] ? "b" : "c"]: DYES[d - 1] }];
}
/** Is the item made to cover an eye (shades, a patch)? Everything else must leave the eyes alone. */
export const coversEyes = (id) => !!(ART[id] && ART[id][0] === "face" && FACE[ART[id][1]] && FACE[ART[id][1]].covers);

/**
 * Dress one frame: `base` is the plain frame from sprites.js, `o.cos` a list of
 * cosmetic ids. `highBase`, when given, is the native 64px body with the same anchors.
 * Returns the composited canvas, or the chosen body itself when nothing is worn.
 */
export function dress(base, o, view, f, highBase = null) {
  const artBase = highBase || base, size = artBase.width, scale = size / SZ;
  const list = (o && o.cos ? o.cos : []).map((id) => dyed(ART[id], o.dye && o.dye[id])).filter((a) => a && a[0] !== "wskin");
  if (!list.length) return artBase;
  const A = anchors(artBase, o, view, f);
  const of = (slot) => list.find((a) => a[0] === slot);
  const [c, g] = canvas(size);
  const bk = of("back"), tp = of("top"), fc = of("face"), ht = of("hat");
  const bkFn = bk && BACK[bk[1]];
  const bd = artBase.getContext("2d").getImageData(0, 0, size, size).data;
  const pixel = (x, y) => (y * size + x) * 4;
  const coat = (item, fn, opt) => layer(g, fn, A, item[2], { part: item[0], design: item[1], ...opt });
  // 1. a back piece hangs behind the body (front, side)
  if (bkFn && !A.back) coat(bk, bkFn, { sep: false });
  g.drawImage(artBase, 0, 0);
  // 2. the top, inked only where it sticks out
  if (tp && TOP[tp[1]]) { const fnTop = typeof TOP[tp[1]] === "function", tl = fnTop ? {} : topPal(TOP[tp[1]], tp[2]); coat(tp, wearTop(TOP[tp[1]]), { ink: "out", sepOnly: fnTop ? null : [tl.c, tl.l] }); }
  // 3. from behind, the back piece covers the body but stays under the head
  if (bkFn && A.back) coat(bk, bkFn, { keep: (x, y) => y >= A.bt * scale || !bd[pixel(x, y) + 3] });
  // 4. a cape's clasp, a pack's straps in front of the body
  if (bk && !A.back && BACK_FRONT[bk[1]]) layer(g, BACK_FRONT[bk[1]], A, bk[2], { ink: "none" });
  // 5. the hat: crown, ears, brim
  if (ht && HAT[ht[1]]) {
    const h = HAT[ht[1]];
    coat(ht, h.draw, { ink: "hat", col: h.ink });
    if (h.draw && h.bumps !== false) ears(g, artBase, A, h.ears !== "through");
    coat(ht, h.over, { ink: "hat", col: h.ink });
  }
  // 6. the eyes stay visible, 7. then the face piece (on the head only)
  if (!A.back) guardEyes(g, artBase, A);
  if (fc && FACE[fc[1]]) {
    coat(fc, FACE[fc[1]].draw, { ink: "none", keep: (x, y) => bd[pixel(x, y) + 3] > 0 && !isInkAt(bd, pixel(x, y)) });
    // glasses ring the eyes, they never hide them (big round eyes peek over the rim)
    if (!FACE[fc[1]].covers && !A.back) guardEyes(g, artBase, A);
  }
  return c;
}

const icons = new Map();
/** Fit a layer into a 16px icon with a spare pixel around it. */
function fitIcon(g, frame) {
  const size = frame.width;
  const data = frame.getContext("2d").getImageData(0, 0, size, size).data;
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!data[(y * size + x) * 4 + 3]) continue;
    x0 = Math.min(x, x0);
    y0 = Math.min(y, y0);
    x1 = Math.max(x, x1);
    y1 = Math.max(y, y1);
  }
  if (x1 < x0) return;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const zoom = 14 / Math.max(w, h);
  const dw = Math.max(1, Math.round(w * zoom)), dh = Math.max(1, Math.round(h * zoom));
  g.drawImage(frame, x0, y0, w, h, Math.floor((16 - dw) / 2), Math.floor((16 - dh) / 2), dw, dh);
}

/**
 * Draw costume pieces in isolation using their world art. Face pieces keep the
 * head crop, which shows their position on the face.
 * `sheetOf(o)` is sprites.js personSheet (passed in to avoid a circular import).
 */
export function cosIcon(id, sheetOf, lookOf) {
  if (icons.has(id)) return icons.get(id);
  const a = ART[id];
  const [c, g] = canvas(16);
  if (a && a[0] !== "wskin") {
    const [slot, design, pal] = a;
    const o = { ...lookOf() };
    if (slot === "face") {
      o.cos = [id];
      if (lum(pal.c || "#ffffff") > 0.72) o.fur = "#b98b68";
      const fr = sheetOf(o).front[0], s = fr.width / SZ;
      g.drawImage(fr, 8 * s, 13 * s, 16 * s, 16 * s, 0, 0, 16, 16);
    } else {
      const view = slot === "back" ? "back" : "front";
      const [item, ig] = canvas();
      const A = anchors(sheetOf(o)[view][0], o, view, 0);
      A.icon = true;
      const hat = HAT[design];
      if (slot === "hat" && hat) {
        layer(ig, (b) => { hat.draw?.(b, A, pal); hat.over?.(b, A, pal); }, A, pal, { col: hat.ink });
      } else if (slot === "top" && TOP[design]) {
        const t = TOP[design];
        const draw = t.icon ? (b) => b.grid(8, 8, t.icon, topPal(t, pal)) : wearTop(t);
        layer(ig, draw, A, pal);
      } else if (slot === "back" && BACK[design]) {
        layer(ig, BACK[design], A, pal);
      }
      fitIcon(g, item);
    }
  }
  icons.set(id, c);
  return c;
}

/** Internals for tests/cosmetics.mjs. */
export const _test = { HAT, TOP, BACK, FACE, INK };
