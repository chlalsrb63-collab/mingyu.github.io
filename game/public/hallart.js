/**
 * The brick halls' set dressing (maps-v2 A.4, table C), from the map payload: arched doorways you walk under
 * (`m.arches` [x, y, 1 = the way runs east–west], and for a way wider than three tiles its span [.., lo, hi]: the
 * tiles across from (x, y)) and wall torches in the alcoves (`m.torches` [x, y]).
 *
 * An arch is a slab of brick standing across a way three to six tiles wide: two piers at the rock on either side, a segmental
 * arch between them (crown 28 px up, so a hero walks under it), its top a little above the walls. It is cut
 * into 4-px strips, each sorted at the depth of the floor under it, so someone walking through is drawn
 * behind the arch on the far side and in front of it on the near side.
 *
 * A torch is mounted on the alcove's west wall (the one face of the niche the camera sees): an iron bracket,
 * a wrapped stick and a flame drawn live, with a warm flickering pool of light on the floor in front.
 * Plain module: scene_map.js asks `hallProps(m, theme)` for statics once per map.
 */
import { tI, hash } from "./scene_view.js";
import { Buf, C } from "./iso_px.js";
import * as DC from "./decor.js";

const INK = C("#2b2233");
/** Brick, mortar, the arch ring's stones, the keystone, the slab's top, the pier's shaded side. */
const SKIN = {
  crypt: { b: ["#7d776c", "#8f897c", "#6a645c"], mortar: "#3e3a36", ring: ["#a8a294", "#8b867c"], key: "#c8c0a8", top: "#b4ae9e", side: "#55504a" },
  sewer: { b: ["#8a5a42", "#9c6a4e", "#74482f"], mortar: "#2e1e18", ring: ["#b08868", "#8e6a50"], key: "#c8a07a", top: "#a8806a", side: "#4e3226" },
};

const PIER = 5, TOP = 34, THICK = 3;
/** Height of the arch's underside at u along a span L px long (piers solid to the top). */
const under = (u, L) => (u < PIER || u > L - PIER ? TOP : 21 + 7 * Math.sqrt(Math.max(0, 1 - ((u - L / 2) / (L / 2 - PIER)) ** 2)));

const cache = new Map();
/** One arch's sprite, `n` tiles across: `ew` 1 = the slab stands along y (plane x = const), 0 = along x. */
function archSprite(theme, ew, n = 3) {
  const key = theme + ew + "/" + n, L = n * 16;
  if (cache.has(key)) return cache.get(key);
  const P = SKIN[theme] || SKIN.crypt, col = (h) => C(h);
  const brick = P.b.map(col), mortar = col(P.mortar), ring = P.ring.map(col), keyC = col(P.key), topC = col(P.top), side = col(P.side);
  // texel space: u along the span (0…L), a across it (−THICK…THICK, + toward the camera), z up
  const W = L + 2 * THICK + 4, H = TOP + (L + 2 * THICK) / 2 + 6, ox = ew ? L + THICK + 2 : THICK + 2, oy = TOP + 2;
  const buf = new Buf(W, H);
  const put = (u, a, z, c) => {
    // ew: the span runs along B (screen left-down), thickness along A; else the span along A, thickness along B
    const A = ew ? a : u, B = ew ? u : a;
    buf.px(ox + A - B, oy + ((A + B) >> 1) - z, c);
  };
  for (let a = -THICK; a <= THICK; a++) for (let u = 0; u <= L; u++) {
    const zi = Math.round(under(u, L));
    for (let z = u < PIER || u > L - PIER ? 0 : zi; z <= TOP; z++) {
      let c;
      if (z === TOP) c = (u + a) % 7 === 0 ? brick[2] : topC;
      else if (a < THICK) c = side;
      else {
        // the face: a ring of wedge stones round the opening, brick courses above and in the piers
        const inPier = u < PIER || u > L - PIER;
        if (!inPier && z < zi + 4) {
          const stone = Math.floor((u - PIER) / 4);
          c = (u - PIER) % 4 === 0 ? mortar : Math.abs(u - L / 2) < 2 ? keyC : ring[stone & 1];
          if (z === zi) c = ring[1];
        } else {
          const row = Math.floor(z / 4), s = u + (row & 1 ? 4 : 0);
          c = z % 4 === 0 || s % 8 === 0 ? mortar : brick[hash(Math.floor(s / 8), row, 31) < 0.25 ? 2 : hash(Math.floor(s / 8), row, 32) < 0.3 ? 1 : 0];
          if (inPier && (u === 0 || u === L)) c = side;
        }
      }
      put(u, a, z, c);
    }
  }
  // outline the silhouette
  const src = buf.d.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src[y * W + x]) continue;
    if ((x > 0 && src[y * W + x - 1]) || (x < W - 1 && src[y * W + x + 1]) || (y > 0 && src[(y - 1) * W + x]) || (y < H - 1 && src[(y + 1) * W + x])) buf.d[y * W + x] = INK;
  }
  const out = { img: buf.canvas(), ox, oy };
  cache.set(key, out);
  return out;
}

/** A torch's bracket and stick (the flame is drawn live). */
let torchCv = null;
function torchSprite() {
  if (torchCv) return torchCv;
  const b = new Buf(7, 13), iron = C("#3a3440"), ironL = C("#6a6270"), wood = C("#7a5030"), woodL = C("#a87444"), wrap = C("#c8b080");
  // the plate on the wall, the arm out, the cup, the stick in it
  b.rect(0, 7, 2, 5, iron); b.px(1, 8, ironL);
  b.rect(2, 9, 2, 1, iron);
  b.rect(3, 6, 3, 1, iron); b.px(3, 7, iron); b.px(5, 7, iron); b.px(4, 8, iron);
  b.rect(4, 2, 1, 5, wood); b.px(4, 3, woodL); b.px(4, 1, wrap); b.px(4, 2, wrap);
  torchCv = b.canvas();
  return torchCv;
}
/** The flame: three tongues that change every 90 ms, and a warm light that flickers on the floor and wall. */
function torchAnim(seed) {
  return (g, t, X, Y, parts) => {
    const f = Math.floor(t / 90 + seed) % 3, fl = 0.8 + 0.2 * Math.sin(t / 53 + seed) * Math.sin(t / 131 + seed * 3);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.3 * fl; g.drawImage(DC.glow("#ff9a40", 44), Math.round(X - 44), Math.round(Y - 40));
    g.globalAlpha = 0.22 * fl; g.drawImage(DC.glow("#ffb060", 30), Math.round(X - 22), Math.round(Y + 2));
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    const tongue = [[0, 0, 1, 2], [-1, 1, 3, 2], [0, 2, 1, 1]][f];
    g.fillStyle = "#e85a10"; g.fillRect(X - 2, Y - 3, 4, 3);
    g.fillStyle = "#ff9a40"; g.fillRect(X - 1 + tongue[0], Y - 5 - tongue[1], 2 + (f === 1 ? 1 : 0), 3 + tongue[3]);
    g.fillStyle = "#ffe690"; g.fillRect(X, Y - 3 - (f === 2 ? 1 : 0), 1, 2);
    if (Math.random() < 0.05) parts.push({ x: X, y: Y - 6, vx: (Math.random() - 0.5) * 6, vy: -16 - Math.random() * 10, life: 0.6, color: Math.random() < 0.5 ? "#ffd070" : "#ff9040", g: -8, s: 1 });
  };
}

/** Rune marks for the temple pool's ring: little 3×3 glyphs. */
const RUNE = [[1, 0, 1, 0, 1, 0, 1, 0, 1], [0, 1, 0, 1, 1, 1, 0, 1, 0], [1, 1, 0, 0, 1, 0, 0, 1, 1], [1, 0, 0, 1, 1, 0, 1, 0, 0], [0, 1, 1, 0, 1, 0, 1, 1, 0]];
function runePool(g, t, X, Y, parts) {
  const b = 0.5 + 0.5 * Math.sin(t / 1100);
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.25 + 0.2 * b; g.drawImage(DC.glow("#40e0b0", 56), Math.round(X - 56), Math.round(Y - 56 + 12), 112, 64);
  g.globalAlpha = 0.35 + 0.25 * b; g.drawImage(DC.glow("#9affe0", 22), Math.round(X - 22), Math.round(Y - 11), 44, 22);
  g.globalAlpha = 1;
  // twelve runes on an ellipse round the rim, each brightening as the wave of light passes it
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t / 9000, rx = Math.round(X + Math.cos(a) * 46), ry = Math.round(Y + Math.sin(a) * 23);
    const lit = 0.35 + 0.65 * Math.max(0, Math.sin(t / 600 - i * 0.7));
    g.fillStyle = `rgba(140,255,220,${lit})`;
    const r = RUNE[i % RUNE.length];
    for (let k = 0; k < 9; k++) if (r[k]) g.fillRect(rx - 1 + (k % 3), ry - 1 + ((k / 3) | 0), 1, 1);
  }
  g.globalCompositeOperation = "source-over";
  if (Math.random() < 0.08) parts.push({ x: X - 24 + Math.random() * 48, y: Y - 4 + Math.random() * 10, vx: 0, vy: -10, life: 1.4, color: Math.random() < 0.5 ? "#9affe0" : "#e8fff8", g: 0, s: 1 });
}

/** The statics for a brick-hall map's arches and torches, and the alcove tiles whose candle stand they replace. */
export function hallProps(m, theme) {
  const out = [], torchAt = new Set();
  // the forgotten temple's rune pool (maps-v2 A.3, `m.temple.pool`): a breathing jade light on the water and
  // a ring of runes turning slowly round its rim
  if (m.temple && m.temple.pool) {
    const [px, py] = m.temple.pool, [X, Y] = tI(px + 0.5, py + 0.5);
    const blank = document.createElement("canvas"); blank.width = 120; blank.height = 20;
    out.push({ sp: blank, dx: X - 60, dy: Y - 10, x: X, y: Y, d: Y - 40, glow: null, glint: -1, tx: X, ty: Y, anim: runePool });
  }
  if (theme !== "crypt" && theme !== "sewer") return { statics: out, torchAt };
  const seen = new Set();
  for (const [x, y, ew, lo = -1, hi = 1] of m.arches || []) {
    const k = x + "," + y + "," + lo;
    if (seen.has(k)) continue;
    seen.add(k);
    const sp = archSprite(theme, ew, hi - lo + 1);
    // texel origin of the span: ew → the plane x*16+8 across rows y+lo…y+hi; else the plane y*16+8 across x+lo…x+hi
    const A0 = ew ? x * 16 + 8 : (x + lo) * 16, B0 = ew ? (y + lo) * 16 : y * 16 + 8;
    const [X0, Y0] = tI(A0 / 16, B0 / 16), dx = X0 - sp.ox, dy = Y0 - sp.oy;
    const st = { sp: sp.img, dx, dy, x: X0, y: Y0 + 16, d: Y0 + 8, glow: null, glint: -1, slices: [] };
    // each strip sorts at the floor under the slab's middle there
    for (let sx = 0; sx < sp.img.width; sx += 4) {
      const Xrel = dx + sx + 2 - (tI(0, 0)[0]);
      const base = ew ? (A0 + (A0 - Xrel)) / 2 : (B0 + (Xrel + B0)) / 2;
      st.slices.push({ sx, w: Math.min(4, sp.img.width - sx), d: base + 0.5 });
    }
    out.push(st);
  }
  for (const [x, y] of m.torches || []) {
    torchAt.add(x + "," + y);
    const [X, Y] = tI(x, y), sp = torchSprite();
    // on the niche's west wall, halfway along it, 14 px up
    const bx = X - 8, by = Y + 4 - 14;
    const st = { sp, dx: bx - 2, dy: by - 9, x: bx + 2, y: by + 4, d: Y + 4, glow: "#ffb060", glint: -1, tx: bx + 2, ty: by - 6, anim: torchAnim(hash(x, y, 5) * 20) };
    out.push(st);
  }
  return { statics: out, torchAt };
}
