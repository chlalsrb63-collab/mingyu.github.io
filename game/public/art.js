/**
 * Every pixel in the game is drawn here, in code — tiles, trees, houses,
 * characters, monsters and item icons. Nothing is loaded from an image file.
 *
 * Two techniques:
 *   - small sprites are character maps ("o" = outline, "h" = hair …) painted
 *     through a palette, so one map gives every hair / skin / outfit combination;
 *   - larger scenery is built from shapes and then given a 1px dark outline,
 *     which is what makes it read as a hand-held-era sprite.
 */

import * as WPN from "./weapons.js";
import * as Assets from "./assetlib.js";
import { furnIcon } from "./houseart.js";
import { matIcon } from "./gatherart.js";
import { LIFE_ICONS } from "./lifeicons.js";

export const TILE = 16;

export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return [c, g];
}

/** Stable pseudo-random in [0,1) from integers — used for per-tile variation. */
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function paint(g, rows, pal, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const col = pal[r[x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
}
function px(g, x, y, col) {
  g.fillStyle = col;
  g.fillRect(x, y, 1, 1);
}
function disc(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
    }
  }
}
/** Give every opaque shape a 1px outline. */
function outline(c, g, col) {
  const { width: w, height: h } = c;
  const src = g.getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  g.fillStyle = col;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x, y, 1, 1);
  }
}
function flip(src) {
  const [c, g] = canvas(src.width, src.height);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/** World → screen: the 2:1 diamond projection every drawable goes through. */
export function iso(wx, wy) {
  return [wx - wy, (wx + wy) / 2];
}
const MINI = { f: "#c48a52", l: "#8e5c3a", h: "#d8b07a", x: "#a2958a", q: "#c8604e", u: "#468a8e", y: "#a2323a", e: "#b8925a", t: "#447e38", r: "#8a8a80", ".": "#4e8a3e", ",": "#4e8a3e", '"': "#568f46", ":": "#35693e", ";": "#35693e", p: "#b89a66", o: "#8e8a84", s: "#cdbd8a", w: "#3a6ea8", b: "#8a6034", c: "#4c475e", d: "#443f56", W: "#17142a", a: "#3a3d46", m: "#3a3d46", k: "#7c7f86", j: "#5a5638", v: "#b0a68e", g: "#4a5248", "=": "#a8a090", "%": "#b0602a", "&": "#4a2a52",
  // maps-v2 M3 (the south-west coast): dune sand, white sand, shallows you can wade, the surf line
  z: "#d8a858", S: "#f0e8cc", "~": "#58c8c0", "-": "#d8f0ec" };
const MINI_OBJ = { "=": "#3a2620", "+": "#bfe0ee", "^": "#2a3a34", "~": "#c89a3a", "@": "#5a3420", "!": "#a8343c", _: "#e8dcc0", o: "#9a6440", k: "#6e4428", s: "#9a4a3a", m: "#8a5634", j: "#c87a3a", "$": "#e8b860", b: "#5a8a4a", r: "#7a4a2c", t: "#d8a830", "#": "#b8a898", g: "#4e9a4a", "*": "#ffd890", v: "#c89a6a", "-": "#7a4a2c", p: "#4a6a9a", w: "#9a6440", "]": "#c8945a", "%": "#e89a50", "[": "#b07440", "Ω": "#6a7480", "Δ": "#7656b4", "Ψ": "#c08048", "Φ": "#5aa0d8", "?": "#e0b048",
  C: "#6e6654", H: "#2f7036", U: "#8a8478", l: "#6a4628", u: "#6a4628", e: "#5a9a58", q: "#a8a498", n: "#8a6a3a", M: "#6a4628", D: "#2c5a48", E: "#c8b888", T: "#2a6030", P: "#1d4a30", R: "#74747c", B: "#35803a", h: "#8a4a3a", a: "#6a9ac8", K: "#5ac8d8", S: "#3a3550", F: "#6a4628", L: "#c8b060", G: "#6a4628", Z: "#22242c", c: "#8a3a3a", y: "#a83a3a", x: "#4a4d56",
  1: "#8a8478", 2: "#5a3e2a", 3: "#d8a850", 4: "#c8c2ac", 5: "#8a8478", 6: "#6a7280", 7: "#6a5a44", 8: "#c8c2ac", 0: "#c0303c", 9: "#c8a050", I: "#6a4226", Q: "#7ae0ff", "/": "#9affc8", J: "#b4b2a8", V: "#3a5a9a", z: "#c8c4b4", N: "#9a9484", d: "#c8a050", i: "#9a9484", f: "#9a9484", O: "#9a9cb0", A: "#5a4434", Y: "#c8503e", X: "#e02a3a",
  // the town's stone terrace wall and the new interior pieces (docs/design/town.md E)
  W: "#9a9080", "&": "#5a5e6c", "<": "#d8603a", ">": "#8a6a4a", "|": "#7a5a3a", ";": "#9ad0c8", ":": "#b8a898", "'": "#bfe0ee", "`": "#c8a060",
  // maps-v2 M3: palm, reef rock, black shore boulder, mud hut
  "Ψ": "#3a9a50", "Φ": "#6a8a80", "Ω": "#2e2e36", "Δ": "#b88a58",
  // maps-batch2: twisted pine, a hall's footprint (gold roof / pagoda), rock pillar
  "Σ": "#2f6e4e", "Π": "#d8a838", "Θ": "#9a7a6a" };
/** The old kingdom's canopy turns: maples red, the rest gold; pines stay dark. */
const AUTUMN_OBJ = { T: "#b4442a", P: "#24503a", B: "#a8582a" };
/** Dungeons share the cave's tiles but not its colours. */
const MINI_THEME = {
  crypt: { c: "#5c5852", d: "#524e48", n: "#7a2a3a", i: "#8a8478", W: "#141218", w: "#3d5a66" },
  sewer: { c: "#4c584e", d: "#435046", W: "#0c120e", w: "#5a8a30", g: "#2c342e", b: "#6a7280" },
  abyss: { c: "#6a2632", d: "#5c1e2a", W: "#16060a", w: "#a01828", b: "#d8d0b8" },
  autumn: { ".": "#7a8a3e", ",": "#7a8a3e", t: "#9a8a3e", '"': "#8a8a46", ":": "#556a34", ";": "#c8a032" },
  jungle: { w: "#1f7f92", ":": "#2f7a40", ";": "#2a6a3a", r: "#6a6a70", m: "#c8a838", T: "#1f5a2c" },
  coast: { w: "#1f7f92", z: "#e4c890" },
  desert: { s: "#e2c88a", w: "#3aa0b8", r: "#a89878" },
  mesa: { s: "#d98a5a", z: "#e29a62", r: "#b86a48", w: "#3aa0b8", "=": "#e2ca92", ",": "#a4a058", t: "#8a9a50" },
  mist: { w: "#dfe7f0", b: "#b8bcb8", ":": "#5f8a5c", ";": "#5f8a5c", ",": "#6a9464", r: "#9a9e9c", "%": "#b4622e" },
};
/** A zoned hunting ground's minimap tint by 4 × 4 block (m.zq): the safe plaza cool, the elite ground red; hidden pockets stay hidden. */
const ZONE_TINT = { 0: "rgba(120,220,255,0.22)", 2: "rgba(255,70,60,0.2)" };
export function renderMini(m, s = 2) {
  const [c, g] = canvas(m.w * s, m.h * s);
  const skin = MINI_THEME[m.theme] || {};
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const o = m.o[y][x];
    g.fillStyle = (m.theme === "autumn" && AUTUMN_OBJ[o]) || MINI_OBJ[o] || skin[m.g[y][x]] || MINI[m.g[y][x]] || "#000";
    g.fillRect(x * s, y * s, s, s);
  }
  if (typeof m.zq === "string") {
    const bw = Math.ceil(m.w / 4);
    for (let i = 0; i < m.zq.length; i++) {
      const tint = ZONE_TINT[m.zq[i]];
      if (!tint) continue;
      g.fillStyle = tint;
      g.fillRect((i % bw) * 4 * s, Math.floor(i / bw) * 4 * s, 4 * s, 4 * s);
    }
  }
  return c;
}

// ───────────────────────────── scenery ─────────────────────────────

function tree() {
  const [c, g] = canvas(44, 62);
  g.fillStyle = "#7a5030"; g.fillRect(19, 38, 6, 22);
  g.fillStyle = "#5a3a20"; g.fillRect(23, 38, 2, 22); g.fillRect(17, 59, 10, 1);
  g.fillStyle = "#8e6238"; g.fillRect(19, 40, 1, 16);
  disc(g, 22, 22, 20, 20, "#3f8246");
  disc(g, 20, 19, 17, 16, "#569a52");
  disc(g, 16, 14, 11, 9, "#78b266");
  disc(g, 13, 10, 5, 4, "#a2cc8a");
  disc(g, 30, 28, 8, 7, "#2f7a38");
  for (let i = 0; i < 40; i++) px(g, 5 + Math.floor(hash(i, 1) * 34), 6 + Math.floor(hash(i, 2) * 32), i % 3 ? "#3f8246" : "#78b266");
  outline(c, g, "#245c30");
  return c;
}
function pine() {
  const [c, g] = canvas(38, 68);
  g.fillStyle = "#6a4428"; g.fillRect(16, 52, 6, 14);
  g.fillStyle = "#4a2e1a"; g.fillRect(20, 52, 2, 14);
  const tier = (top, h, half) => {
    for (let y = 0; y < h; y++) {
      const w = Math.round(1 + (half * y) / (h - 1));
      g.fillStyle = "#327a50"; g.fillRect(19 - w, top + y, w * 2, 1);
      g.fillStyle = "#46925e"; g.fillRect(19 - w, top + y, Math.max(1, Math.round(w * 0.6)), 1);
      g.fillStyle = "#225a3c"; g.fillRect(19 + Math.round(w * 0.45), top + y, w - Math.round(w * 0.45), 1);
    }
  };
  tier(1, 16, 8); tier(11, 18, 11); tier(23, 20, 14); tier(36, 20, 17);
  outline(c, g, "#1a4a2c");
  return c;
}
function rock(cols) {
  const [c, g] = canvas(16, 14);
  disc(g, 8, 8, 7, 5, cols[1]);
  disc(g, 7, 7, 5.5, 4, cols[0]);
  disc(g, 5.5, 5.5, 2.5, 1.5, cols[2]);
  g.fillStyle = cols[1]; g.fillRect(9, 8, 3, 1); g.fillRect(4, 10, 2, 1);
  outline(c, g, "#3a3a44");
  return c;
}
function bush() {
  const [c, g] = canvas(16, 14);
  disc(g, 8, 8, 7, 5, "#3f8246");
  disc(g, 5, 7, 4, 4, "#569a52"); disc(g, 11, 7, 4, 4, "#569a52");
  disc(g, 6, 5, 2.5, 2, "#78b266");
  for (const [x, y] of [[4, 8], [9, 6], [12, 9], [7, 10]]) { px(g, x, y, "#b83a48"); px(g, x + 1, y, "#d86a78"); }
  outline(c, g, "#245c30");
  return c;
}
function fence() {
  const [c, g] = canvas(16, 14);
  g.fillStyle = "#b88a54"; g.fillRect(0, 4, 16, 2); g.fillRect(0, 9, 16, 2);
  g.fillStyle = "#d0a468"; g.fillRect(2, 1, 3, 12); g.fillRect(11, 1, 3, 12);
  g.fillStyle = "#8a6238"; g.fillRect(4, 1, 1, 12); g.fillRect(13, 1, 1, 12); g.fillRect(0, 5, 16, 1); g.fillRect(0, 10, 16, 1);
  outline(c, g, "#4a3018");
  return c;
}
function lamp() {
  const [c, g] = canvas(14, 50);
  g.fillStyle = "#3e3e4a"; g.fillRect(6, 11, 2, 36); g.fillRect(4, 46, 6, 2); g.fillRect(3, 48, 8, 1);
  g.fillStyle = "#5c5c6c"; g.fillRect(6, 11, 1, 36);
  g.fillStyle = "#3e3e4a"; g.fillRect(2, 1, 10, 1); g.fillRect(3, 10, 8, 1); g.fillRect(5, 0, 4, 1);
  g.fillStyle = "#ffe890"; g.fillRect(3, 2, 8, 8);
  g.fillStyle = "#fff8d0"; g.fillRect(5, 3, 4, 5);
  g.fillStyle = "#3e3e4a"; g.fillRect(3, 2, 1, 8); g.fillRect(10, 2, 1, 8);
  outline(c, g, "#16161e");
  return c;
}
function sign() {
  const [c, g] = canvas(14, 16);
  g.fillStyle = "#8a6238"; g.fillRect(6, 8, 2, 7);
  g.fillStyle = "#d0a468"; g.fillRect(1, 1, 12, 8);
  g.fillStyle = "#b88a54"; g.fillRect(1, 8, 12, 1);
  g.fillStyle = "#7a5228"; g.fillRect(3, 3, 8, 1); g.fillRect(3, 5, 6, 1);
  outline(c, g, "#4a3018");
  return c;
}
function crystal(a, b, hi) {
  const [c, g] = canvas(16, 22);
  const shard = (x, top, w, h) => {
    for (let y = 0; y < h; y++) {
      const ww = y < 4 ? Math.max(1, Math.round((w * (y + 1)) / 4)) : w;
      const x0 = x + Math.floor((w - ww) / 2);
      g.fillStyle = a; g.fillRect(x0, top + y, ww, 1);
      g.fillStyle = b; g.fillRect(x0 + Math.ceil(ww / 2), top + y, Math.floor(ww / 2), 1);
    }
    g.fillStyle = hi; g.fillRect(x + 1, top + 4, 1, Math.max(1, h - 8));
  };
  shard(2, 9, 4, 12); shard(6, 2, 5, 19); shard(11, 11, 3, 10);
  outline(c, g, "#1a3a5a");
  return c;
}
function stalagmite() {
  const [c, g] = canvas(14, 18);
  for (let y = 0; y < 16; y++) {
    const w = Math.max(1, Math.round((y + 1) * 0.38));
    g.fillStyle = "#7a7492"; g.fillRect(7 - w, 1 + y, w * 2, 1);
    g.fillStyle = "#8e88a8"; g.fillRect(7 - w, 1 + y, Math.max(1, w - 1), 1);
    g.fillStyle = "#565070"; g.fillRect(7 + Math.floor(w / 2), 1 + y, w - Math.floor(w / 2), 1);
  }
  outline(c, g, "#1c1830");
  return c;
}
const ROOFS = [["#d8604a", "#a84238", "#ee8068"], ["#5a84c8", "#3f629c", "#7aa2e0"], ["#5aa468", "#3f7a4a", "#78c084"], ["#9a6cc8", "#74489c", "#b88ae0"]];

/**
 * Paint a box standing on the diamond grid. (nx, ny) is where its far (north)
 * corner touches the ground; w and d are its world-space footprint, H its
 * height. Each face callback draws in that face's own flat coordinates.
 */
function isoBox(g, nx, ny, w, d, H, top, left, right) {
  g.setTransform(1, 0.5, -1, 0.5, nx, ny - H);
  top(g, w, d);
  g.setTransform(1, 0.5, 0, 1, nx - d, ny + d / 2 - H);
  left(g, w, H);
  g.setTransform(1, -0.5, 0, 1, nx + w - d, ny + (w + d) / 2 - H);
  right(g, d, H);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
const fill = (col) => (g, a, b) => { g.fillStyle = col; g.fillRect(0, 0, a, b); };
/** A sprite for a box with footprint w×d: `{ cv, ax, ay }`, (ax, ay) being the north ground corner. */
function boxSprite(w, d, tall, draw, line) {
  const [c, g] = canvas(w + d + 8, (w + d) / 2 + tall + 8);
  const ax = d + 4, ay = tall + 4;
  draw(g, ax, ay);
  if (line) outline(c, g, line);
  return { cv: c, ax, ay };
}

function house(v) {
  const W = 64, D = 48, H = 34, R = 22;
  const [roof, roofD, roofL] = ROOFS[v % ROOFS.length];
  return boxSprite(W, D, H + R, (g, nx, ny) => {
    isoBox(g, nx, ny, W, D, H, fill("#000"),
      (g2, w, h) => {
        g2.fillStyle = "#f2e6cc"; g2.fillRect(0, 0, w, h);
        g2.fillStyle = "#7a5430"; g2.fillRect(0, 0, 2, h); g2.fillRect(w - 2, 0, 2, h); g2.fillRect(0, 10, w, 2); g2.fillRect(20, 0, 2, 10); g2.fillRect(46, 0, 2, 10);
        g2.fillStyle = "#d8ccb2"; g2.fillRect(2, h - 4, w - 4, 4);
        g2.fillStyle = "#5a3c22"; g2.fillRect(26, h - 22, 14, 22);
        g2.fillStyle = "#8a6034"; g2.fillRect(28, h - 20, 10, 20);
        g2.fillStyle = "#6e4a28"; g2.fillRect(32, h - 20, 1, 20); g2.fillRect(28, h - 11, 10, 1);
        g2.fillStyle = "#e8c860"; g2.fillRect(36, h - 10, 1, 2);
        for (const x of [6, 46]) { g2.fillStyle = "#5a3c22"; g2.fillRect(x, 14, 12, 12); g2.fillStyle = "#f0d890"; g2.fillRect(x + 1, 15, 10, 10); g2.fillStyle = "#5a3c22"; g2.fillRect(x + 5, 15, 2, 10); g2.fillRect(x + 1, 19, 10, 1); }
      },
      (g2, w, h) => {
        g2.fillStyle = "#cfc2a6"; g2.fillRect(0, 0, w, h);
        g2.fillStyle = "#5e4024"; g2.fillRect(0, 0, 2, h); g2.fillRect(w - 2, 0, 2, h); g2.fillRect(0, 10, w, 2); g2.fillRect(23, 0, 2, 10);
        g2.fillStyle = "#b4a88e"; g2.fillRect(2, h - 4, w - 4, 4);
        g2.fillStyle = "#4a3018"; g2.fillRect(17, 14, 14, 12); g2.fillStyle = "#c8b070"; g2.fillRect(18, 15, 12, 10); g2.fillStyle = "#4a3018"; g2.fillRect(23, 15, 2, 10);
      });
    // a hipped roof: two slopes face the camera, two fall away behind the ridge
    const pt = (x, y, z) => [nx + x - y, ny + (x + y) / 2 - z];
    const poly = (col, ...pts) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
    const o = 4;
    const N = pt(-o, -o, H), E = pt(W + o, -o, H), S = pt(W + o, D + o, H), Wc = pt(-o, D + o, H);
    const r1 = pt(D / 2, D / 2, H + R), r2 = pt(W - D / 2, D / 2, H + R);
    poly(roofD, N, E, r2, r1);
    poly(roofD, N, Wc, r1);
    poly(roof, Wc, S, r2, r1);
    poly(roofL, S, E, r2);
    g.strokeStyle = roofD;
    for (const t of [0.3, 0.6]) {
      g.beginPath();
      g.moveTo(Wc[0] + (r1[0] - Wc[0]) * t, Wc[1] + (r1[1] - Wc[1]) * t);
      g.lineTo(S[0] + (r2[0] - S[0]) * t, S[1] + (r2[1] - S[1]) * t);
      g.stroke();
    }
  }, "#1c120c");
}

const BLD = [["#5a5e6a", "#444852", "#ff4a8a"], ["#6a5448", "#4e3c34", "#4ae0e0"], ["#4a5464", "#363e4c", "#ffd04a"], ["#584a68", "#40344e", "#7aff8a"]];
/** A flat-roofed city block with lit windows and a neon sign. */
function building(v) {
  const W = 64, D = 48, H = 78;
  const [wall, wallD, neon] = BLD[v % BLD.length];
  const windows = (g2, w, h, seed, lit) => {
    for (let r = 0; r < 5; r++) for (let x = 5; x + 7 <= w - 3; x += 11) {
      const on = hash(x, r, v + seed) > 0.45;
      g2.fillStyle = "#14161c"; g2.fillRect(x, 5 + r * 10, 8, 7);
      g2.fillStyle = on ? (hash(x, r, v + seed + 9) > 0.5 ? lit : "#9fe0ff") : "#262c38"; g2.fillRect(x + 1, 6 + r * 10, 6, 5);
    }
  };
  return boxSprite(W, D, H, (g, nx, ny) => {
    isoBox(g, nx, ny, W, D, H,
      (g2, w, d) => { g2.fillStyle = "#23252c"; g2.fillRect(0, 0, w, d); g2.fillStyle = "#30333c"; g2.fillRect(4, 4, w - 8, d - 8); g2.fillStyle = "#3c404a"; g2.fillRect(10, 10, 14, 10); },
      (g2, w, h) => {
        g2.fillStyle = wall; g2.fillRect(0, 0, w, h);
        windows(g2, w, h, 0, "#ffd880");
        g2.fillStyle = wall; g2.fillRect(0, h - 26, w, 26);
        g2.fillStyle = "#101116"; g2.fillRect(3, h - 27, w - 6, 6);
        g2.fillStyle = neon; g2.fillRect(6, h - 26, 14, 4); g2.fillRect(24, h - 26, 5, 4); g2.fillRect(33, h - 26, 12, 4); g2.fillRect(49, h - 26, 8, 4);
        g2.fillStyle = "#14161c"; g2.fillRect(22, h - 20, 20, 20);
        g2.fillStyle = "#3c4250"; for (let y = h - 19; y < h; y += 3) g2.fillRect(23, y, 18, 2);
        g2.fillStyle = "#1c2430"; g2.fillRect(4, h - 18, 14, 12); g2.fillRect(46, h - 18, 14, 12);
        g2.fillStyle = "#4a6480"; g2.fillRect(5, h - 17, 12, 2); g2.fillRect(47, h - 17, 12, 2);
      },
      (g2, w, h) => { g2.fillStyle = wallD; g2.fillRect(0, 0, w, h); windows(g2, w, h, 40, "#e8c070"); g2.fillStyle = wallD; g2.fillRect(0, h - 24, w, 24); g2.fillStyle = "rgba(0,0,0,.25)"; g2.fillRect(0, h - 20, w, 20); });
  }, "#08090c");
}
/** One tile of wall, raised: cave rock or city brick. */
function cube(kind) {
  const H = kind === "rock" ? 22 : 30;
  const c = kind === "rock" ? ["#3a3550", "#2c2842", "#201c32", "#463f60"] : ["#343742", "#282a34", "#1c1e26", "#40434e"];
  return boxSprite(16, 16, H, (g, nx, ny) => {
    isoBox(g, nx, ny, 16, 16, H,
      (g2, w, d) => { g2.fillStyle = c[0]; g2.fillRect(0, 0, w, d); g2.fillStyle = c[3]; g2.fillRect(2, 3, 4, 2); g2.fillRect(9, 10, 3, 2); },
      (g2, w, h) => {
        g2.fillStyle = c[1]; g2.fillRect(0, 0, w, h);
        g2.fillStyle = c[2];
        if (kind === "rock") { g2.fillRect(3, 4, 5, 1); g2.fillRect(9, 9, 4, 1); g2.fillRect(2, 12, 3, 1); }
        else for (let y = 4; y < h; y += 5) { g2.fillRect(0, y, w, 1); g2.fillRect(((y * 3) % 12) + 2, y - 4, 1, 4); }
      },
      (g2, w, h) => {
        g2.fillStyle = c[2]; g2.fillRect(0, 0, w, h);
        g2.fillStyle = "rgba(0,0,0,.3)";
        if (kind === "rock") { g2.fillRect(4, 6, 5, 1); g2.fillRect(8, 11, 4, 1); }
        else for (let y = 4; y < h; y += 5) g2.fillRect(0, y, w, 1);
      });
  }, null);
}
const CARS = ["#8a3238", "#3a5a8a", "#c8c8cc", "#3a3a40", "#b89030"];
function car(v) {
  const col = CARS[v % CARS.length], dark = shadeHex(col);
  return boxSprite(32, 15, 20, (g, nx, ny) => {
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath(); g.ellipse(nx + 8, ny + 12, 25, 10, 0, 0, Math.PI * 2); g.fill();
    isoBox(g, nx, ny - 3, 32, 15, 8, fill(col),
      (g2, w, h) => { g2.fillStyle = dark; g2.fillRect(0, 0, w, h); g2.fillStyle = lt2(col); g2.fillRect(0, 0, w, 1); g2.fillStyle = "#101116"; g2.fillRect(3, h - 3, 7, 3); g2.fillRect(22, h - 3, 7, 3); g2.fillStyle = "#5a5c64"; g2.fillRect(5, h - 2, 3, 1); g2.fillRect(24, h - 2, 3, 1); },
      (g2, w, h) => { g2.fillStyle = shadeHex(dark); g2.fillRect(0, 0, w, h); g2.fillStyle = "#ffe8a0"; g2.fillRect(2, 2, 3, 2); g2.fillRect(w - 5, 2, 3, 2); g2.fillStyle = "#14161c"; g2.fillRect(5, 5, w - 10, 2); });
    isoBox(g, nx + 6, ny - 3 + 4 - 8 + 2, 17, 11, 7, fill(dark),
      (g2, w, h) => { g2.fillStyle = "#1c2430"; g2.fillRect(0, 0, w, h); g2.fillStyle = "#587896"; g2.fillRect(1, 1, w - 2, 2); g2.fillStyle = dark; g2.fillRect(8, 0, 1, h); },
      (g2, w, h) => { g2.fillStyle = "#141a24"; g2.fillRect(0, 0, w, h); g2.fillStyle = "#3a5068"; g2.fillRect(1, 1, w - 2, 1); });
  }, "#08090c");
}
const lt2 = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (x) => Math.min(255, Math.round(x * 1.25)).toString(16).padStart(2, "0"); return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`; };
function shadeHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (x) => Math.round(x * 0.68).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
function hydrant() {
  const [c, g] = canvas(10, 14);
  g.fillStyle = "#a83232"; g.fillRect(3, 3, 4, 9); g.fillRect(1, 6, 8, 2); g.fillRect(2, 11, 6, 2);
  g.fillStyle = "#d85a5a"; g.fillRect(3, 3, 1, 9); g.fillRect(3, 1, 4, 2);
  outline(c, g, "#0c0d12");
  return c;
}
function trash() {
  const [c, g] = canvas(12, 15);
  g.fillStyle = "#4a4d56"; g.fillRect(2, 4, 8, 10);
  g.fillStyle = "#33363e"; g.fillRect(7, 4, 3, 10); g.fillRect(3, 6, 1, 7); g.fillRect(5, 6, 1, 7);
  g.fillStyle = "#62656e"; g.fillRect(1, 2, 10, 2);
  outline(c, g, "#0c0d12");
  return c;
}
function fountain(frame) {
  const [c, g] = canvas(34, 34);
  disc(g, 17, 20, 15, 11, "#8f897f");
  disc(g, 17, 19, 15, 10.5, "#c2bcae");
  disc(g, 17, 19, 12, 8, "#4f9ae6");
  disc(g, 16, 18, 9, 5, "#6eb4f4");
  g.fillStyle = "#c2bcae"; g.fillRect(15, 8, 4, 12);
  g.fillStyle = "#d8d3c6"; g.fillRect(15, 8, 1, 12);
  disc(g, 17, 8, 4, 2, "#d8d3c6");
  const spray = frame ? [[13, 5], [21, 6], [17, 2], [11, 10], [23, 11]] : [[12, 7], [22, 4], [17, 3], [10, 12], [24, 9]];
  for (const [x, y] of spray) { px(g, x, y, "#e0f2ff"); px(g, x, y + 1, "#9fd2ff"); }
  outline(c, g, "#3a3a44");
  return c;
}

/** Scenery sprites keyed by the object-layer character; `ax`/`ay` anchor the bottom centre. */
export function buildScenery() {
  const s = {
    T: tree(), P: pine(), R: rock(["#a8a8b0", "#7a7a86", "#d0d0d8"]), B: bush(), F: fence(), L: lamp(), G: sign(),
    K: crystal("#6ae0f0", "#3aa8d8", "#d8fbff"), K2: crystal("#c08af0", "#8a5ad0", "#f0dcff"), S: stalagmite(),
    house: [house(0), house(1), house(2), house(3), building(0), building(1), building(2), building(3)], fountain: [fountain(0), fountain(1)],
    c: [0, 1, 2, 3, 4].map(car), y: hydrant(), x: trash(), Z: cube("brick"), W: cube("rock"),
  };
  return s;
}

// ───────────────────────────── characters ─────────────────────────────
// People are designed in their own module; see chars.js.

export { charSprite, drawFigure, setStyle, playerLook, npcLook, HAIR, SKIN, STYLES, CHAR_W, CHAR_H, CHAR_TOP, FOOT_X, FOOT_Y } from "./chars.js";

// ───────────────────────────── icons ─────────────────────────────

/** Rarity colours: common · magic · rare · legendary. */
export const RARITY_COL = ["#d8d4c8", "#6a9cff", "#f0d050", "#ff8a30", "#5fd47a"];
const METAL = [null, ["#a8acb4", "#74787f"], ["#c8ccd4", "#8e94a0"], ["#9ab8e0", "#5a78b0"], ["#70e0e8", "#2a98a8"], ["#e080f0", "#9a40c0"]];
const RUNE_COL = { ign: "#ff6a3a", aeg: "#8aa0c0", vit: "#e84a5a", men: "#4a8aff", cel: "#7ae8a0", acu: "#ffd84a", san: "#c03048", lum: "#fff0a0", fos: "#b07aff" };

function potion(liquid, light, big) {
  const [c, g] = canvas(16, 16);
  const r = big ? 5.5 : 4.5;
  disc(g, 8, 10, r, r, "#c8d8e0");
  disc(g, 8, 10.5, r - 1, r - 1.2, liquid);
  g.fillStyle = "#c8d8e0"; g.fillRect(6, 2, 4, 4);
  g.fillStyle = "#7a5430"; g.fillRect(6, 1, 4, 2);
  px(g, 6, 9, light); px(g, 6, 10, light); px(g, 7, 8, light);
  if (big) { px(g, 10, 11, light); px(g, 9, 12, light); }
  outline(c, g, "#111118");
  return c;
}
/** The cafe's and the inn's fare: a steaming mug, a scone, a slice of pie, a bowl of stew, a loaf. */
function mugIcon(cup, cupD, drink, top) {
  const [c, g] = canvas(16, 16);
  g.fillStyle = cup; g.fillRect(3, 6, 8, 8); g.fillRect(11, 8, 2, 1); g.fillRect(12, 9, 1, 3); g.fillRect(11, 12, 2, 1);
  g.fillStyle = cupD; g.fillRect(8, 6, 3, 8);
  g.fillStyle = drink; g.fillRect(4, 6, 6, 2);
  if (top) { g.fillStyle = top; g.fillRect(5, 5, 2, 2); g.fillRect(7, 6, 2, 1); }
  g.fillStyle = "#f4f0ea"; px(g, 5, 2, "#f4f0ea"); px(g, 6, 3, "#f4f0ea"); px(g, 5, 4, "#f4f0ea"); px(g, 8, 1, "#f4f0ea"); px(g, 9, 2, "#f4f0ea"); px(g, 8, 3, "#f4f0ea");
  outline(c, g, "#111118");
  return c;
}
function bakeIcon(kind) {
  const [c, g] = canvas(16, 16);
  if (kind === "scone") { disc(g, 8, 10, 5.5, 4, "#d8a050"); disc(g, 7.5, 9, 4.5, 3, "#e8b868"); px(g, 6, 8, "#f4d898"); px(g, 9, 10, "#a86a30"); px(g, 6, 11, "#a86a30"); }
  else if (kind === "pie") {
    g.fillStyle = "#d8a050"; for (let y = 0; y < 8; y++) g.fillRect(3 + Math.floor(y / 2), 5 + y, 11 - y, 1);
    g.fillStyle = "#c0303c"; for (let y = 1; y < 7; y++) g.fillRect(4 + Math.floor(y / 2), 5 + y, 8 - y, 1);
    px(g, 6, 7, "#ff7080"); px(g, 9, 8, "#ff7080"); g.fillStyle = "#f0c878"; g.fillRect(3, 5, 11, 1);
  } else if (kind === "stew") {
    disc(g, 8, 10, 6, 3.6, "#8a5a36"); disc(g, 8, 9, 5, 2.2, "#b8602e"); px(g, 6, 9, "#e8a040"); px(g, 9, 8, "#7aa84a"); px(g, 10, 10, "#e8d0a0");
    px(g, 6, 4, "#f4f0ea"); px(g, 7, 5, "#f4f0ea"); px(g, 9, 3, "#f4f0ea"); px(g, 10, 4, "#f4f0ea");
  } else { disc(g, 8, 9, 6, 4, "#a8703a"); disc(g, 7.5, 8, 5, 3, "#c88a48"); g.fillStyle = "#e8b878"; g.fillRect(5, 7, 1, 2); g.fillRect(8, 6, 1, 2); g.fillRect(11, 7, 1, 2); }
  outline(c, g, "#111118");
  return c;
}
function gem() {
  const [c, g] = canvas(16, 16);
  for (let y = 0; y < 11; y++) {
    const w = y < 4 ? 3 + y : 7 - (y - 4);
    if (w <= 0) continue;
    g.fillStyle = "#5ac8d8"; g.fillRect(8 - w, 3 + y, w * 2, 1);
    g.fillStyle = "#2a90b0"; g.fillRect(8, 3 + y, w, 1);
  }
  g.fillStyle = "#c8f4ff"; g.fillRect(5, 5, 2, 1); g.fillRect(4, 6, 1, 2);
  outline(c, g, "#111118");
  return c;
}
function coin() {
  const [c, g] = canvas(16, 16);
  disc(g, 8, 9, 4.5, 4.5, "#b88420");
  disc(g, 7.5, 8.5, 3.5, 3.5, "#e8c040");
  g.fillStyle = "#fff0a0"; g.fillRect(6, 6, 2, 1); g.fillRect(5, 7, 1, 2);
  g.fillStyle = "#b88420"; g.fillRect(8, 7, 1, 4);
  outline(c, g, "#3a2a08");
  return c;
}
function runeIcon(key) {
  const [c, g] = canvas(16, 16);
  disc(g, 8, 8.5, 5.5, 6, "#3a3d48");
  disc(g, 7.5, 8, 4.5, 5, "#4c505c");
  const col = RUNE_COL[key] || "#fff";
  g.fillStyle = col;
  const n = RUNE_KEYS_ART.indexOf(key);
  g.fillRect(7, 4, 2, 9);
  if (n % 3 === 0) { g.fillRect(5, 6, 6, 1); g.fillRect(9, 9, 2, 1); }
  else if (n % 3 === 1) { g.fillRect(5, 5, 2, 1); g.fillRect(9, 8, 2, 1); g.fillRect(5, 11, 2, 1); }
  else { g.fillRect(9, 5, 2, 2); g.fillRect(5, 9, 2, 2); }
  if (n >= 3) px(g, 10, 12, col);
  if (n >= 6) px(g, 5, 4, col);
  outline(c, g, "#111118");
  return c;
}
const RUNE_KEYS_ART = Object.keys(RUNE_COL);

function weaponIcon(cls, tier) {
  const [c, g] = canvas(16, 16);
  const [m, md] = METAL[tier];
  if (cls === "sword") {
    // a greatsword: broad blade, long grip
    for (let i = 0; i < 10; i++) { px(g, 13 - i, 2 + i, m); px(g, 14 - i, 2 + i, md); px(g, 13 - i, 1 + i, m); px(g, 12 - i, 2 + i, m); }
    g.fillStyle = "#b08a38"; g.fillRect(1, 9, 3, 1); g.fillRect(2, 10, 3, 1); g.fillRect(3, 11, 3, 1); g.fillRect(4, 12, 3, 1);
    px(g, 3, 12, "#5a3c22"); px(g, 2, 13, "#5a3c22"); px(g, 1, 14, "#3e2a18");
  } else if (cls === "dagger") {
    for (let i = 0; i < 6; i++) { px(g, 10 - i, 4 + i, m); px(g, 11 - i, 4 + i, md); }
    g.fillStyle = "#a83242"; g.fillRect(3, 9, 3, 1); g.fillRect(4, 10, 3, 1);
    px(g, 4, 11, "#2a2a30"); px(g, 3, 12, "#2a2a30"); px(g, 2, 13, "#2a2a30");
  } else if (cls === "spear") {
    // a long shaft corner to corner, a leaf-shaped head
    for (let i = 0; i < 9; i++) { px(g, 2 + i, 13 - i, "#7a5430"); px(g, 3 + i, 13 - i, "#573a1e"); }
    for (let i = 0; i < 4; i++) { px(g, 11 + i, 4 - i, m); px(g, 12 + i, 4 - i, md); px(g, 10 + i, 4 - i, m); }
    px(g, 10, 5, m); px(g, 12, 5, md); px(g, 11, 6, "#b08a38"); px(g, 10, 6, "#b08a38");
  } else if (cls === "book") {
    const cover = ["#8a4a3a", "#3a5a9a", "#5a3a8a", "#2a7a8a", "#8a3a9a"][tier - 1];
    g.fillStyle = cover; g.fillRect(3, 3, 10, 11);
    g.fillStyle = "#f4ecd8"; g.fillRect(5, 4, 8, 9);
    g.fillStyle = cover; g.fillRect(3, 3, 2, 11);
    g.fillStyle = "#cfc4a8"; g.fillRect(6, 6, 6, 1); g.fillRect(6, 8, 6, 1); g.fillRect(6, 10, 4, 1);
    g.fillStyle = m; g.fillRect(8, 2, 2, 2);
  } else {
    for (let i = 0; i < 10; i++) { px(g, 4 + i, 13 - i, "#7a5430"); px(g, 5 + i, 13 - i, "#573a1e"); }
    disc(g, 12, 4, 2.5, 2.5, md);
    disc(g, 11.6, 3.6, 1.5, 1.5, m);
    px(g, 11, 3, "#ffffff");
  }
  outline(c, g, "#111118");
  return c;
}
function campIcon() {
  const [c, g] = canvas(16, 16);
  g.fillStyle = "#7a5230"; g.fillRect(2, 11, 12, 3); g.fillStyle = "#94683c"; g.fillRect(3, 10, 4, 2); g.fillStyle = "#5e3e22"; g.fillRect(9, 10, 4, 2);
  g.fillStyle = "#f0702a"; g.fillRect(5, 5, 6, 6); g.fillRect(6, 3, 4, 3); g.fillRect(7, 1, 2, 2);
  g.fillStyle = "#ffb030"; g.fillRect(6, 6, 4, 5); g.fillRect(7, 4, 2, 2);
  g.fillStyle = "#fff0a0"; g.fillRect(7, 8, 2, 3);
  outline(c, g, "#111118");
  return c;
}
const HELM_ART = [
  // Cloth hood: a bent peak, an open face, and its draped collar.
  { palette: { l: "#e3d4b4", m: "#b9a78d", s: "#85718a", d: "#4b3b51" }, rows: [
    ".....ll.......", "...lllmm......", "..llmmmmms....", "..lmmmlllsm...",
    ".lmmll.ddsm...", ".lmml...dss...", ".lmml...dss...", ".mmml..dss....",
    "..mmmlssss....", "..mmllmmsss...", "..lmmmmmmsss..", ".mmmmmsssssss.",
    ".mmmmssssss...", "....ss........",
  ] },
  // Leather cap: raised seams over a long brim and one buckled ear flap.
  { palette: { l: "#d09a62", m: "#a16a43", s: "#6c4540", d: "#453241", a: "#eee0a4" }, rows: [
    "..............", "..............", "....lllll.....", "...lmmmlms....",
    "..lmmmmlmss...", "..lmmmmsmss...", "..lmmmmssss...", ".lllmmmmmmml..",
    ".ssssssssssss.", "..smms........", "...mss........", "...sas........", "....s.........",
  ] },
  // Steel helm: swept horns above a ridged dome and open cheek guards.
  { palette: { l: "#d8e1ec", m: "#91a7bf", s: "#5c6a8a", d: "#37354e", a: "#eddca1" }, rows: [
    "..............", ".a..........a.", ".aa........aa.", ".laa.llm.aal..",
    "..lallmmals...", "...llmmmms....", "..lmmmmmmms...", "..lllllmsms...",
    "..lssssssms...", "..md..ld.ms...", "..ms..ms.ss...", "...s..ms.s....",
    "......ss......",
  ] },
  // Tactical helmet: low armor shell, comms plate and a protruding cyan sight.
  { palette: { l: "#9bafaa", m: "#5b716c", s: "#3e4d56", d: "#2e3445", a: "#79e9ee" }, rows: [
    "..............", "..............", "...llll.s.....", "..lmmmmsss....",
    ".llmmmmmmss...", ".lmmssmmmsss..", ".lmssslmmsddd.", ".lmssslmmsaaa.",
    ".lmssslssdddd.", ".lmslmssss....", "..lmss.sss....", "..ssss..ss....",
    "...ds...d.....",
  ] },
  // Rift crown: three uneven crystal blades set around an exposed jewel.
  { palette: { l: "#e3b9fb", m: "#a16dd0", s: "#67458c", d: "#482e73", a: "#9bfff2" }, rows: [
    "......l.......", "......ll......", ".....llm......", ".l...lmm..l...",
    ".ll..lms.lm...", ".lmm.lmslms...", ".lmmslmllms...", "..lmslassms...",
    "..lmsaaasmsl..", "..lmmlasmmls..", "...lllllllls..", "...lmmmmsms...",
    "....sdddds....",
  ] },
];
function paintedGear({ rows, palette }) {
  const [c, g] = canvas(16, 16);
  paint(g, rows, palette, 1, 1);
  outline(c, g, "#2b2233");
  return c;
}
const helmIcon = (tier) => paintedGear(HELM_ART[tier - 1]);

const ARMOR_ART = {
  2: { palette: { l: "#d4a06b", m: "#a96f46", s: "#774b3b", d: "#4b3443", a: "#ecc78c" }, rows: [
    "..............", "..............", "...ll....ls...", "..lmmm..msss..",
    ".llmmmlamsdss.", ".lmmssalmsdss.", "..sssmlamsdd..", "...mmsmamsd...",
    "...lmmslmsd...", "...mmsasmsd...", "...llllmmsd...", "...mmdssssd...",
    "....dddddd....",
  ] },
  3: { palette: { l: "#dbe7ee", m: "#a0adba", s: "#6b768e", d: "#46536d", a: "#e1b86c" }, rows: [
    "..............", "..............", "..llm....mss..", ".lmmml..lmmss.",
    ".lmssmllmssds.", ".lmmalssasmds.", "..dssallassd..", "...lmsamsmd...",
    "...lsmmsmsd...", "...lsssmdsd...", "...llmmsmsd...", "...mssssssd...",
    "....dddddd....",
  ] },
};
const STEEL_GLOVES = { palette: { l: "#dbe7ee", m: "#a0adba", s: "#6b768e", d: "#46536d", a: "#e1b86c" }, rows: [
  "..............", "......llll....", ".....lmmmmss..", ".....lasmdds..",
  ".....lmmmms...", "....lmmmsds...", "....lmmmsdsm..", "...lmmmmsmsms.",
  "...lmmmdmsmms.", "..lmmmds..ms..", "..lmmsds..s...", "..lms.s.......",
  "..ms..........",
] };
const STEEL_BOOTS = { palette: { l: "#dbe7ee", m: "#a0adba", s: "#6b768e", d: "#46536d", a: "#e1b86c" }, rows: [
  "..............", "...lllll......", "..lmmmsms.....", "..lmmmmds.....",
  "..lasmmms.....", "...lssmds.....", "...lmmmds.....", "...lsmdss.....",
  "...lmmms......", "...lmmmsslll..", "...lmmssmmsms.", "...mmsddsssss.",
  "....ddddddddd.",
] };
const RING_ART = {
  // Silver claw setting on a broad band, with a true opening through the shank.
  2: { palette: { l: "#eef4ff", m: "#aeb9ce", s: "#6d7993", g: "#6a9cff", d: "#3a58ac" }, rows: [
    "..............", "......gg......", ".....lggg.....", "....lmggdl....",
    "...lmmlddms...", "..lmm...mss...", "..lm......ms..", "..lm......ms..",
    "..lm......ms..", "...lm....mss..", "...lmmsmsss...", "....msssss....",
    "......ss......",
  ] },
  // A gold signet set low on the diagonal shank, with a shield-cut garnet.
  3: { palette: { l: "#fff0a4", m: "#e7b845", s: "#9e632a", g: "#f86c7d", d: "#973253" }, rows: [
    "..............", "....llllm.....", "...lmmmmmms...", "..lmm....mms..",
    "..lm......ms..", "..lm......ms..", "..lm......ms..", "...lm.....ms..",
    "...lmm..lmmms.", "....mmmslgdms.", ".....sslggdms.", ".......lgdms..",
    "........mms...",
  ] },
};
const AMULET_ART = {
  // Silver cord and a long angular blue stone in a simple cap.
  2: { palette: { l: "#eaf2ff", m: "#aeb9ce", s: "#6d7993", g: "#649df4", d: "#3b57a5" }, rows: [
    "..............", ".lm........sm.", "..mm......ss..", "...mm....ss...",
    "....lm..ss....", ".....lmss.....", "......lms.....", ".....lmgs.....",
    "....lmggds....", "....mggdds....", ".....ggds.....", ".....gdss.....",
    "......s.......",
  ] },
  // A circular ward on a dark cord, its engraved rune picked out in garnet.
  3: { palette: { l: "#fff1a2", m: "#e7b74e", s: "#a66a34", c: "#79503f", r: "#a63c55" }, rows: [
    "..............", ".mc........cm.", "..cc......cc..", "...cc....cc...",
    "....cm..mc....", ".....cmms.....", ".....lllms....", "....lmmrmsm...",
    "...lmrmmmms...", "...lmrrrmsm...", "...lmmmmms....", "....msssss....",
    ".....sss......",
  ] },
};

function glovesIcon(tier) {
  if (tier === 3) return paintedGear(STEEL_GLOVES);
  const [c, g] = canvas(16, 16);
  const [m, md] = tier === 1 ? ["#b8ac90", "#8e8468"] : tier === 2 ? ["#8a6238", "#5e4022"] : METAL[tier];
  g.fillStyle = m; g.fillRect(4, 3, 7, 7); g.fillRect(5, 10, 6, 4); g.fillRect(11, 5, 2, 4);
  g.fillStyle = md; g.fillRect(8, 3, 3, 7); g.fillRect(5, 12, 6, 2);
  g.fillStyle = "#111118"; g.fillRect(6, 3, 1, 3); g.fillRect(8, 3, 1, 3);
  outline(c, g, "#111118");
  return c;
}
function bootsIcon(tier) {
  if (tier === 3) return paintedGear(STEEL_BOOTS);
  const [c, g] = canvas(16, 16);
  const [m, md] = tier === 1 ? ["#c8b070", "#9a8448"] : tier === 2 ? ["#8a6238", "#5e4022"] : METAL[tier];
  // a folded cuff, the shaft, a rounded toe pointing right, a heel and a sole
  g.fillStyle = m; g.fillRect(4, 2, 7, 2); g.fillRect(5, 4, 5, 7); g.fillRect(5, 10, 7, 3); g.fillRect(12, 11, 2, 2);
  g.fillStyle = md; g.fillRect(4, 3, 7, 1); g.fillRect(8, 4, 2, 6); g.fillRect(5, 7, 5, 1); g.fillRect(5, 13, 3, 1); g.fillRect(9, 13, 5, 1);
  if (tier >= 4) { g.fillStyle = "#7af0ff"; g.fillRect(5, 12, 4, 1); }
  outline(c, g, "#111118");
  return c;
}
function ringIcon(tier) {
  if (RING_ART[tier]) return paintedGear(RING_ART[tier]);
  const [c, g] = canvas(16, 16);
  const [m, md] = [["#c88a50", "#8e5a2c"], ["#c8ccd4", "#8e94a0"], ["#f0c840", "#b08a20"], ["#70e0e8", "#2a98a8"], ["#e080f0", "#9a40c0"]][tier - 1];
  disc(g, 8, 10, 4.5, 4.5, m);
  g.fillStyle = md; g.fillRect(9, 12, 3, 2); g.fillRect(12, 9, 1, 3);
  g.clearRect(6, 8, 4, 4);
  g.fillStyle = ["#e84a5a", "#6a9cff", "#e84a5a", "#ffffff", "#ffd84a"][tier - 1]; g.fillRect(7, 3, 2, 3); g.fillRect(6, 4, 4, 1);
  outline(c, g, "#111118");
  return c;
}
function amuletIcon(tier) {
  if (AMULET_ART[tier]) return paintedGear(AMULET_ART[tier]);
  const [c, g] = canvas(16, 16);
  const [m, md] = [["#8a6238", "#5e4022"], ["#c8ccd4", "#8e94a0"], ["#f0c840", "#b08a20"], ["#70e0e8", "#2a98a8"], ["#e080f0", "#9a40c0"]][tier - 1];
  // a cord in a V, a pendant where it meets
  for (let i = 0; i < 6; i++) { px(g, 3 + i, 2 + i, md); px(g, 12 - i, 2 + i, md); }
  disc(g, 8, 10.5, 3, 3.2, m);
  disc(g, 7.6, 10.2, 1.6, 1.8, ["#7ad08a", "#6a9cff", "#e84a5a", "#ffffff", "#ffd84a"][tier - 1]);
  outline(c, g, "#111118");
  return c;
}
function armorIcon(tier) {
  if (ARMOR_ART[tier]) return paintedGear(ARMOR_ART[tier]);
  const [c, g] = canvas(16, 16);
  const cols = [null, ["#b8ac90", "#8e8468"], ["#7a5530", "#573a1e"], ["#7c8698", "#565e70"], ["#33373f", "#1f2228"], ["#3ab0c0", "#1f7888"]][tier];
  g.fillStyle = cols[0]; g.fillRect(4, 4, 8, 10); g.fillRect(2, 4, 12, 4);
  g.fillStyle = cols[1]; g.fillRect(8, 4, 4, 10); g.fillRect(12, 4, 2, 4); g.fillRect(4, 12, 8, 2);
  g.clearRect(6, 4, 4, 2);
  g.fillStyle = METAL[tier][0]; g.fillRect(7, 8, 2, 2);
  outline(c, g, "#111118");
  return c;
}
// ── charms (주아나의 참 공방; docs/design/charms.md) ──
// 16×16, light from the top-left, one dark outline. A sealed charm is a rough shard that tells nothing; an appraised
// one is the same cut crystal in its grade's setting: a bronze band (매직), a silver mount (레어), and for a legendary
// its own emblem (a horn, a knot, a lens) — the setting, not only the colour, names the grade.
const CHARM_ART = {
  sealed: [[
    "", "", ".......ab", "......aabb", ".....alabbc", "....aalabbcc", "....aaabbbcc", "...aaabbkbccc", "...aabbykbccc", "...abbbbkcccc", "....bbbkcccc", "....bbbcccc", ".....bccc", "......cc",
  ], { a: "#a096ac", b: "#72687c", c: "#4c4458", l: "#d0c8d8", k: "#3a3344", y: "#f6e6a0" }],
  g1: [[
    "", ".......oo", "......o..o", ".......oo", "......hggd", ".....hhgggd", "....hhggggdd", "....BBBBBBBB", "....bbbbbbbb", "....hgggggdd", ".....ggggdd", ".....gggddd", "......gddd", ".......dd",
  ], { o: "#c8843c", B: "#e0a45a", b: "#8a5424", g: "#4ac0b0", h: "#b4f4e6", d: "#2a8078" }],
  g2: [[
    "", ".......ss", "......s..s", "......SSss", ".....Shggds", "....Shhgggds", "....Shggggds", "....SgggggdS", "....shggggds", "....sggggdds", ".....sgggds", ".....Ssgdss", "......Ssss", ".......ss",
  ], { S: "#f2f5fa", s: "#9aa2b4", g: "#5a8cf0", h: "#c4dcff", d: "#3458b0" }],
  g3: [[
    "", ".......Y", "...Y...y...Y", "....y.yYy.y", ".....yYYYy", "....yYhppYy", "..YyYYhpppYYyY", "....yYppqqYy", ".....yYqqYy", "....y.yYy.y", "...Y...y...Y", ".......Y",
  ], { Y: "#ffe070", y: "#d89a28", p: "#c070f0", h: "#f0d4ff", q: "#7a3ab0" }],
  echo: [[
    "", "", "..........ii", ".........iiw", "........iiiw", ".......iiiww", "......YYYww", ".....yyYYw", "....iiiyw", "...iiiww", "...iiww", "..hiww", "..hw",
  ], { i: "#f4ecd8", w: "#b8a888", h: "#ffffff", Y: "#ffe070", y: "#d89a28" }],
  knot: [[
    "", "", "....rr....rr", "...rRRr..rRRd", "...rR.RrrR.Rd", "....rRrYYrRd", ".....rYhYYd", "....rRrYYdRd", "...rR.RddR.Rd", "...rRRd..dRRd", "....dd....dd",
  ], { r: "#f08a8a", R: "#d84a5a", d: "#8a2a3c", Y: "#ffd84a", h: "#fff4c0" }],
  lens: [[
    "", ".....YYYYY", "....Yyllly", "...Yyllllly", "...Yllwllly", "...Ylwwwlly", "...Yllwlldy", "...Yylllddy", "....yyldddy", ".....yyyyyy", "..........yy", "...........yy", "............y",
  ], { Y: "#ffe070", y: "#c8882a", l: "#8adcff", w: "#ffffff", d: "#4a9ad0" }],
  nail: [[
    "", "", ".........H", "........HHh", ".........Hhh", "........nmhhd", ".......nm..dd", "......nm", ".....nm", "....nm", "...nm", "...m",
  ], { H: "#fff0b8", h: "#e8c060", d: "#a87a2c", n: "#e8c478", m: "#9a6e2c" }],
};
const charmCache = {};
/** A charm's 16×16 icon: `sealed`, `g1` `g2` `g3` (grade settings), a legendary's own emblem (`echo knot lens`), `nail`. */
export function charmIcon(kind) {
  const k = CHARM_ART[kind] ? kind : "sealed";
  if (!charmCache[k]) { const [c, g] = canvas(16, 16); paint(g, CHARM_ART[k][0], CHARM_ART[k][1]); outline(c, g, "#2b2233"); charmCache[k] = c; }
  return charmCache[k];
}
export const charmIconUrl = (kind) => { const k = "url:" + kind; return charmCache[k] || (charmCache[k] = charmIcon(kind).toDataURL()); };
/** Which icon a bag charm shows: nothing of a sealed one's grade leaks (it has none on the wire). */
export const charmKind = (c) => (!c || !c.rev ? "sealed" : c.lg && CHARM_ART[c.lg] ? c.lg : `g${c.g || 1}`);

/** Item id → data URL (for the windows) and canvas (for loot on the ground and in hand). */
export function buildIcons(items) {
  const cv = { camp: campIcon(), gold: coin(), hp_s: potion("#b8303c", "#f09aa0", false), hp_m: potion("#b8303c", "#f09aa0", true), mp_s: potion("#3058c0", "#9ab4f0", false), mp_m: potion("#3058c0", "#9ab4f0", true), stone: gem(),
    cafe_coffee: mugIcon("#f4ecdc", "#cfc4b2", "#5a3420", "#c8a070"), cafe_cocoa: mugIcon("#d86a6a", "#b04e56", "#8a4a2a", "#ffffff"), cafe_tea: mugIcon("#8ac0a0", "#6a9a80", "#c8b040", null),
    charm: charmIcon("sealed"), charm_nail: charmIcon("nail"),
    cafe_scone: bakeIcon("scone"), cafe_pie: bakeIcon("pie"), inn_stew: bakeIcon("stew"), inn_bread: bakeIcon("bread") };
  for (const [id, { rows, palette }] of Object.entries(LIFE_ICONS)) {
    const [c, g] = canvas(16, 16);
    paint(g, rows, palette, 2, 2);
    outline(c, g, "#2b2233");
    cv[id] = c;
  }
  for (const id of Object.keys(items)) {
    const it = items[id];
    if (it.type === "weapon") cv[id] = WPN.DESIGNS[it.wk] ? WPN.weaponIcon(it.wk, it.tier) : weaponIcon(it.wk, it.tier);
    else if (it.type === "armor") cv[id] = armorIcon(it.tier);
    else if (it.type === "helm") cv[id] = helmIcon(it.tier);
    else if (it.type === "gloves") cv[id] = glovesIcon(it.tier);
    else if (it.type === "boots") cv[id] = bootsIcon(it.tier);
    else if (it.type === "ring") cv[id] = ringIcon(it.tier);
    else if (it.type === "amulet") cv[id] = amuletIcon(it.tier);
    else if (it.type === "rune") cv[id] = runeIcon(it.rune);
    else if (it.type === "furn") cv[id] = furnIcon(id) || gem();
    // the 재료 주머니's goods: herbs, ores, woods and ingots by grade, 식재료 꾸러미, 빈 병 (gatherart.js)
    else if (it.type === "lmat" || id === "staple" || id === "flask") { const m = matIcon(id, it); if (m) cv[id] = m; }
  }
  // an approved external icon (public/assets/manifest.json "icon.item.<id>") wins over the code
  for (const id of new Set([...Object.keys(cv), ...Object.keys(items)])) { const a = Assets.canvas("icon.item." + id); if (a) cv[id] = a; }
  const url = {}, left = {};
  for (const id of Object.keys(cv)) { url[id] = cv[id].toDataURL(); left[id] = flip(cv[id]); }
  return { cv, url, left };
}
