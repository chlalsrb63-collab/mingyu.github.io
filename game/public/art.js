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
function tinted(src, col) {
  const [c, g] = canvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = col;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// ───────────────────────────── ground ─────────────────────────────

const GROUND = {
  ".": ["#7aa862", "#689450", "#92bc78"],
  ",": ["#7aa862", "#689450", "#92bc78"],
  '"': ["#7aa862", "#689450", "#92bc78"],
  ":": ["#548a5e", "#46764e", "#669c6e"],
  ";": ["#548a5e", "#46764e", "#669c6e"],
  p: ["#d2bc94", "#bea67c", "#e0cca8"],
  o: ["#b6b0a6", "#968f86", "#ccc6bc"],
  s: ["#ecdcaa", "#d8c690", "#f6eac2"],
  w: ["#5c98c4", "#4a82b0", "#a6cce6"],
  b: ["#a87a48", "#7e5630", "#c0925a"],
  c: ["#625c7a", "#524c68", "#726c8c"],
  d: ["#625c7a", "#524c68", "#726c8c"],
  W: ["#14111e", "#100e19", "#181524"],
  a: ["#4a4e5a", "#3e424c", "#585c68"],
  m: ["#4a4e5a", "#3e424c", "#585c68"],
  k: ["#92969e", "#787c84", "#a6aab2"],
};
const GRASSY = '.,":;';
const FLOWERS = ["#e8dc90", "#e8e8e8", "#d88aa8", "#e0b850"];

function drawTile(g, m, tx, ty, frame) {
  const ch = m.g[ty][tx];
  const [base, dark, light] = GROUND[ch] || GROUND["."];
  const X = tx * TILE, Y = ty * TILE;
  g.fillStyle = base;
  g.fillRect(X, Y, TILE, TILE);
  const at = (x, y) => (y < 0 || x < 0 || y >= m.h || x >= m.w ? ch : m.g[y][x]);

  if (GRASSY.includes(ch)) {
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(hash(tx, ty, i) * 16), y = Math.floor(hash(tx, ty, i + 20) * 16);
      px(g, X + x, Y + y, i % 3 ? dark : light);
      if (i < 2) px(g, X + x, Y + ((y + 1) % 16), dark);
    }
    if (ch === "," || ch === ";") {
      const x = 3 + Math.floor(hash(tx, ty, 50) * 9), y = 5 + Math.floor(hash(tx, ty, 51) * 7);
      px(g, X + x, Y + y, dark); px(g, X + x - 1, Y + y - 1, dark); px(g, X + x + 1, Y + y - 1, dark);
      px(g, X + x, Y + y - 2, light); px(g, X + x + 2, Y + y, dark);
    }
    if (ch === '"') {
      for (let i = 0; i < 3; i++) {
        const x = 2 + Math.floor(hash(tx, ty, 60 + i) * 12), y = 2 + Math.floor(hash(tx, ty, 70 + i) * 12);
        const col = FLOWERS[Math.floor(hash(tx, ty, 80 + i) * FLOWERS.length)];
        px(g, X + x, Y + y, col); px(g, X + x + 1, Y + y, col); px(g, X + x, Y + y + 1, col); px(g, X + x + 1, Y + y + 1, col);
        px(g, X + x, Y + y + 2, dark);
      }
    }
    return;
  }
  if (ch === "p" || ch === "s") {
    for (let i = 0; i < 9; i++) {
      px(g, X + Math.floor(hash(tx, ty, i) * 16), Y + Math.floor(hash(tx, ty, i + 9) * 16), i % 3 ? dark : light);
    }
  } else if (ch === "o") {
    g.fillStyle = dark;
    const off = ty % 2 ? 4 : 0;
    g.fillRect(X, Y + 7, 16, 1); g.fillRect(X, Y + 15, 16, 1);
    g.fillRect(X + ((3 + off) % 16), Y, 1, 7); g.fillRect(X + ((11 + off) % 16), Y, 1, 7);
    g.fillRect(X + ((7 + off) % 16), Y + 8, 1, 7); g.fillRect(X + ((15 + off) % 16), Y + 8, 1, 7);
    for (let i = 0; i < 4; i++) px(g, X + Math.floor(hash(tx, ty, i) * 16), Y + Math.floor(hash(tx, ty, i + 5) * 16), light);
  } else if (ch === "w") {
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash(tx, ty, i) * 11), y = 2 + i * 5 + (frame ? 1 : 0);
      g.fillStyle = i === 1 ? light : dark;
      g.fillRect(X + ((x + (frame ? 2 : 0)) % 12), Y + y, 4, 1);
    }
  } else if (ch === "b") {
    g.fillStyle = dark;
    for (let y = 3; y < 16; y += 4) g.fillRect(X, Y + y, 16, 1);
    g.fillStyle = light;
    for (let y = 0; y < 16; y += 4) g.fillRect(X + Math.floor(hash(tx, ty, y) * 10), Y + y, 5, 1);
    g.fillStyle = "#5a3a1a";
    if (at(tx, ty - 1) !== "b") g.fillRect(X, Y, 16, 2);
    if (at(tx, ty + 1) !== "b") g.fillRect(X, Y + 14, 16, 2);
  } else if (ch === "c" || ch === "d") {
    for (let i = 0; i < 6; i++) px(g, X + Math.floor(hash(tx, ty, i) * 16), Y + Math.floor(hash(tx, ty, i + 9) * 16), i % 2 ? dark : light);
    if (ch === "d") {
      g.fillStyle = dark;
      const x = 3 + Math.floor(hash(tx, ty, 30) * 6), y = 3 + Math.floor(hash(tx, ty, 31) * 6);
      g.fillRect(X + x, Y + y, 4, 1); g.fillRect(X + x + 3, Y + y + 1, 1, 3); g.fillRect(X + x + 4, Y + y + 3, 3, 1);
    }
  } else if (ch === "a" || ch === "m") {
    for (let i = 0; i < 8; i++) px(g, X + Math.floor(hash(tx, ty, i) * 16), Y + Math.floor(hash(tx, ty, i + 9) * 16), i % 2 ? dark : light);
    if (ch === "m") { g.fillStyle = "#c8a83a"; g.fillRect(X + 2, Y, 12, 2); }
    const n = at(tx, ty - 1), s2 = at(tx, ty + 1);
    if (n === "k") { g.fillStyle = "#9a9da4"; g.fillRect(X, Y, 16, 2); g.fillStyle = "#24262c"; g.fillRect(X, Y + 2, 16, 1); }
    if (s2 === "k") { g.fillStyle = "#24262c"; g.fillRect(X, Y + 15, 16, 1); }
  } else if (ch === "k") {
    g.fillStyle = dark; g.fillRect(X, Y + 15, 16, 1); g.fillRect(X + 15, Y, 1, 16);
    for (let i = 0; i < 4; i++) px(g, X + Math.floor(hash(tx, ty, i) * 15), Y + Math.floor(hash(tx, ty, i + 9) * 15), i % 2 ? dark : light);
  } else if (ch === "W") {
    for (let i = 0; i < 5; i++) px(g, X + Math.floor(hash(tx, ty, i) * 16), Y + Math.floor(hash(tx, ty, i + 9) * 16), i % 2 ? dark : light);
  }

  // ragged grass creeping over the edge of paths, plazas, sand and water
  if ("posw".includes(ch)) {
    const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (let s = 0; s < 4; s++) {
      const n = at(tx + sides[s][0], ty + sides[s][1]);
      const grass = GRASSY.includes(n);
      const shore = ch === "w" && n !== "w" && n !== "b";
      if (!grass && !shore) continue;
      const col = grass ? GROUND[n][0] : GROUND[n] ? GROUND[n][1] : "#dcc986";
      for (let i = 0; i < 16; i++) {
        const depth = shore && !grass ? 1 : 1 + Math.floor(hash(tx * 16 + i, ty, s) * 2);
        g.fillStyle = col;
        if (s === 0) g.fillRect(X + i, Y, 1, depth);
        else if (s === 1) g.fillRect(X + i, Y + 16 - depth, 1, depth);
        else if (s === 2) g.fillRect(X, Y + i, depth, 1);
        else g.fillRect(X + 16 - depth, Y + i, depth, 1);
      }
      if (ch === "w") {
        g.fillStyle = "#9cc4e8";
        if (s === 0) g.fillRect(X, Y + 2, 16, 1);
        else if (s === 2) g.fillRect(X + 2, Y, 1, 16);
      }
    }
  }
}

/** World → screen: the 2:1 diamond projection every drawable goes through. */
export function iso(wx, wy) {
  return [wx - wy, (wx + wy) / 2];
}
/** Screen → world, for clicks on the ground. */
export function unIso(ix, iy) {
  return [iy + ix / 2, iy - ix / 2];
}

/**
 * The whole ground layer of a map, pre-rendered twice (water animates).
 * Tiles are painted as a flat top-down sheet and that sheet is then projected
 * onto the diamond grid in one go. `ox` is how far the sheet's world origin sits
 * from the left edge of the result.
 */
export function renderGround(m) {
  const out = [];
  for (let f = 0; f < 2; f++) {
    const [flat, fg] = canvas(m.w * TILE, m.h * TILE);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawTile(fg, m, x, y, f);
    const [c, g] = canvas((m.w + m.h) * TILE, ((m.w + m.h) * TILE) / 2);
    g.setTransform(1, 0.5, -1, 0.5, m.h * TILE, 0);
    g.drawImage(flat, 0, 0);
    out.push(c);
  }
  return { frames: out, ox: m.h * TILE };
}

const MINI = { ".": "#4e8a3e", ",": "#4e8a3e", '"': "#568f46", ":": "#35693e", ";": "#35693e", p: "#b89a66", o: "#8e8a84", s: "#cdbd8a", w: "#3a6ea8", b: "#8a6034", c: "#4c475e", d: "#443f56", W: "#17142a", a: "#3a3d46", m: "#3a3d46", k: "#7c7f86" };
const MINI_OBJ = { T: "#2a6030", P: "#1d4a30", R: "#74747c", B: "#35803a", h: "#8a4a3a", a: "#6a9ac8", K: "#5ac8d8", S: "#3a3550", F: "#6a4628", L: "#c8b060", G: "#6a4628", Z: "#22242c", c: "#8a3a3a", y: "#a83a3a", x: "#4a4d56" };
export function renderMini(m, s = 2) {
  const [c, g] = canvas(m.w * s, m.h * s);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    g.fillStyle = MINI_OBJ[m.o[y][x]] || MINI[m.g[y][x]] || "#000";
    g.fillRect(x * s, y * s, s, s);
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

export { charSprite, drawFigure, playerLook, npcLook, HAIR, SKIN, STYLES, CHAR_W, CHAR_H, CHAR_TOP, FOOT_X, FOOT_Y } from "./chars.js";
import { charSprite, frameOf, mobLook, K as CHAR_K } from "./chars.js";

// ───────────────────────────── monsters ─────────────────────────────

const M_SLIME = [
  "................", "................", "................", "................",
  "......oooo......",
  "....ooaaaaoo....",
  "...oaallaaaao...",
  "..oaalaaaaaaao..",
  "..oaaaaaaaaaao..",
  ".oaaeoaaaaeoaao.",
  ".oaaeoaaaaeoaao.",
  ".oaaaaaaaaaaaao.",
  ".oAaaaaaaaaaaAo.",
  ".oAAaaaaaaaaAAo.",
  "..oAAAAAAAAAAo..",
  "...oooooooooo...",
];
const M_SHROOM = [
  "................",
  "....oooooooo....",
  "..oorrrrrrrroo..",
  ".orrwwrrrrrwwro.",
  ".orrwwrrrrrwwro.",
  "orrrrrrwwrrrrrro",
  "orrrrrrwwrrrrrro",
  "oRRrrrrrrrrrrRRo",
  ".ooRRRRRRRRRRoo.",
  "...ooccccccoo...",
  "...occeccecco...",
  "...occcccccco...",
  "...ocCccccCco...",
  "....occcccco....",
  "....oCCooCCo....",
  ".....oo..oo.....",
];
const M_BOAR = [
  "................", "................", "................",
  "......oooooo....",
  "...oooBBBBBBoo..",
  "..obbbbbbbbbbbo.",
  ".obbbbbbbbbbbbbo",
  ".obebbbbbbbbbbbo",
  "oppbbbbbbbbbbbbo",
  "oppbbbbbbbbbbbo.",
  ".owwobbbbbbbbbo.",
  "..oobbbbbbbbbo..",
  "...obbooobbboo..",
  "...obo...obo....",
  "...ooo...ooo....",
  "................",
];
const M_BAT_A = [
  "................", "................",
  "oo............oo",
  "oboo........oobo",
  "obbbo.oooo.obbbo",
  "obbbbobbbbobbbbo",
  ".obbbbbbbbbbbbo.",
  "..obbbrbbrbbbo..",
  "...oobbbbbboo...",
  ".....obwwbo.....",
  "......oooo......",
  "................", "................", "................", "................", "................",
];
const M_BAT_B = [
  "................", "................", "................", "................",
  "......oooo......",
  ".....obbbbo.....",
  "..ooobbbbbbooo..",
  ".obbbbbrbbrbbbbo",
  "obbbbbbbbbbbbbbo",
  "obbo.obwwbo.obbo",
  "obo...oooo...obo",
  "oo............oo",
  "................", "................", "................", "................",
];
const M_GOLEM = [
  "....oooooooo....",
  "...oggggggggo...",
  "..oggkggggkggo..",
  "..ogeeggggeego..",
  "..oggggggggggo..",
  ".ooggggkkggggoo.",
  "oggoggkkkkggoggo",
  "oggoggkkkkggoggo",
  "oggogggkkgggoggo",
  "oggoGGGGGGGGoggo",
  "oGGoGGGGGGGGoGGo",
  ".oo.oGGooGGo.oo.",
  "....oggooggo....",
  "....oggooggo....",
  "...oGGGooGGGo...",
  "...oooo..oooo...",
];
const M_DRONE_A = [
  "................", "................", "................",
  "ooo..........ooo",
  "oppo........oppo",
  ".oo..oooooo..oo.",
  "..oooddddddooo..",
  "..oddddddddddo..",
  "..oddrrrrrrddo..",
  "..oddrwwrrrddo..",
  "..oddddddddddo..",
  "...oDDDDDDDDo...",
  "....oooooooo....",
  "......oyyo......",
  "................", "................",
];
const M_DRONE_B = M_DRONE_A.map((r, i) => (i === 3 ? ".oo..........oo." : i === 4 ? "opppo......opppo" : r));
const PAL = {
  slime: { o: "#16321c", a: "#5a9a4a", A: "#3c7436", l: "#a8d090", e: "#0e1e12" },
  bslime: { o: "#16243e", a: "#4a7aa8", A: "#30588a", l: "#a0c4e0", e: "#0c1628" },
  shroom: { o: "#2e1214", r: "#8e3434", R: "#642224", w: "#d8ccb4", c: "#b8a888", C: "#8e8064", e: "#1c1010" },
  boar: { o: "#1e140c", b: "#6a4a34", B: "#3e2a1c", p: "#b07a78", w: "#e8e4d8", e: "#d83030" },
  bat: { o: "#17101f", b: "#4a3862", r: "#ff4040", w: "#e8e4d8" },
  golem: { o: "#17142a", g: "#6a6688", G: "#4a4668", k: "#5ac8d8", e: "#ffd860" },
  robot: { o: "#101216", g: "#7a808c", G: "#555a66", k: "#ff5a3a", e: "#ff3030" },
  boss: { o: "#0c0818", g: "#4a3c88", G: "#2e2460", k: "#e050b8", e: "#ff4040" },
  drone: { o: "#101216", d: "#5a606c", D: "#3c414b", r: "#23262d", w: "#ff4a4a", p: "#aab4c4", y: "#ffe070" },
};

function mobFrames(map, pal, scale = 1, extra = null) {
  const [c, g] = canvas(16, 16);
  paint(g, map, pal);
  let a = c;
  if (scale !== 1 || extra) {
    const [c2, g2] = canvas(16 * scale, 16 * scale + (extra ? 8 : 0));
    g2.imageSmoothingEnabled = false;
    g2.drawImage(c, 0, extra ? 8 : 0, 16 * scale, 16 * scale);
    if (extra) extra(g2);
    a = c2;
  }
  // second frame: a one-pixel squash, the classic idle "breath"
  const [b, gb] = canvas(a.width, a.height);
  gb.drawImage(a, 0, 0, a.width, a.height, 0, scale, a.width, a.height - scale);
  return [a, b];
}
const sheet = (map, pal) => { const [c, g] = canvas(16, 16); paint(g, map, pal); return c; };

/** `{ frames, right, hurt, hurtR, lift }` per monster sprite id (frames face left). */
export function buildMobs() {
  const out = {};
  const add = (id, frames, lift = 0) => {
    out[id] = { frames, right: frames.map(flip), hurt: frames.map((f) => tinted(f, "#ffffff")), hurtR: frames.map((f) => tinted(flip(f), "#ffffff")), lift };
  };
  add("slime", mobFrames(M_SLIME, PAL.slime));
  add("bslime", mobFrames(M_SLIME, PAL.bslime));
  add("shroom", mobFrames(M_SHROOM, PAL.shroom));
  add("boar", mobFrames(M_BOAR, PAL.boar, 2));
  add("bat", [sheet(M_BAT_A, PAL.bat), sheet(M_BAT_B, PAL.bat)], 8);
  add("drone", [sheet(M_DRONE_A, PAL.drone), sheet(M_DRONE_B, PAL.drone)], 10);
  // humanoids come from the character designer: two walking frames, facing down-left
  for (const kind of ["thug", "skel"]) {
    const sheet = charSprite(mobLook(kind));
    add(kind, [flip(frameOf(sheet, false, 2)), flip(frameOf(sheet, false, 4))]);
    out[kind].k = CHAR_K;
  }
  add("golem", mobFrames(M_GOLEM, PAL.golem, 2));
  add("robot", mobFrames(M_GOLEM, PAL.robot, 2));
  add("boss", mobFrames(M_GOLEM, PAL.boss, 3, (g) => {
    const sh = (x, h) => { for (let y = 0; y < h; y++) { g.fillStyle = y < 2 ? "#ffc0e8" : "#e050b8"; g.fillRect(x - Math.min(2, Math.floor(y / 2)), 8 - h + y, 1 + Math.min(2, Math.floor(y / 2)) * 2, 1); } };
    sh(14, 6); sh(24, 8); sh(34, 6);
  }));
  return out;
}
function recolor(c, g, from, to) {
  const img = g.getImageData(0, 0, c.width, c.height);
  const f = parseInt(from.slice(1), 16), t = parseInt(to.slice(1), 16);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] && d[i] === ((f >> 16) & 255) && d[i + 1] === ((f >> 8) & 255) && d[i + 2] === (f & 255)) {
      d[i] = (t >> 16) & 255; d[i + 1] = (t >> 8) & 255; d[i + 2] = t & 255;
    }
  }
  g.putImageData(img, 0, 0);
}

// ───────────────────────────── icons ─────────────────────────────

/** Rarity colours: common · magic · rare · legendary. */
export const RARITY_COL = ["#d8d4c8", "#6a9cff", "#f0d050", "#ff8a30"];
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
  if (cls === "warrior") {
    // a greatsword: broad blade, long grip
    for (let i = 0; i < 10; i++) { px(g, 13 - i, 2 + i, m); px(g, 14 - i, 2 + i, md); px(g, 13 - i, 1 + i, m); px(g, 12 - i, 2 + i, m); }
    g.fillStyle = "#b08a38"; g.fillRect(1, 9, 3, 1); g.fillRect(2, 10, 3, 1); g.fillRect(3, 11, 3, 1); g.fillRect(4, 12, 3, 1);
    px(g, 3, 12, "#5a3c22"); px(g, 2, 13, "#5a3c22"); px(g, 1, 14, "#3e2a18");
  } else if (cls === "rogue") {
    for (let i = 0; i < 6; i++) { px(g, 10 - i, 4 + i, m); px(g, 11 - i, 4 + i, md); }
    g.fillStyle = "#a83242"; g.fillRect(3, 9, 3, 1); g.fillRect(4, 10, 3, 1);
    px(g, 4, 11, "#2a2a30"); px(g, 3, 12, "#2a2a30"); px(g, 2, 13, "#2a2a30");
  } else if (cls === "ranger") {
    g.fillStyle = m; g.fillRect(2, 5, 12, 3);
    g.fillStyle = md; g.fillRect(2, 7, 12, 1); g.fillRect(13, 4, 1, 1);
    g.fillStyle = "#2a2a30"; g.fillRect(3, 8, 3, 5); g.fillRect(7, 8, 2, 2);
    g.fillStyle = "#4a4a54"; g.fillRect(3, 8, 1, 5);
    if (tier >= 3) { g.fillStyle = md; g.fillRect(8, 3, 4, 2); }
    if (tier >= 4) { g.fillStyle = "#ffffff"; g.fillRect(14, 6, 1, 1); }
  } else {
    for (let i = 0; i < 10; i++) { px(g, 4 + i, 13 - i, "#7a5430"); px(g, 5 + i, 13 - i, "#573a1e"); }
    disc(g, 12, 4, 2.5, 2.5, md);
    disc(g, 11.6, 3.6, 1.5, 1.5, m);
    px(g, 11, 3, "#ffffff");
  }
  outline(c, g, "#111118");
  return c;
}
function armorIcon(tier) {
  const [c, g] = canvas(16, 16);
  const cols = [null, ["#b8ac90", "#8e8468"], ["#7a5530", "#573a1e"], ["#7c8698", "#565e70"], ["#33373f", "#1f2228"], ["#3ab0c0", "#1f7888"]][tier];
  g.fillStyle = cols[0]; g.fillRect(4, 4, 8, 10); g.fillRect(2, 4, 12, 4);
  g.fillStyle = cols[1]; g.fillRect(8, 4, 4, 10); g.fillRect(12, 4, 2, 4); g.fillRect(4, 12, 8, 2);
  g.clearRect(6, 4, 4, 2);
  g.fillStyle = METAL[tier][0]; g.fillRect(7, 8, 2, 2);
  outline(c, g, "#111118");
  return c;
}
function accIcon(tier) {
  const [c, g] = canvas(16, 16);
  const [m, md] = [["#c88a50", "#8e5a2c"], ["#c8ccd4", "#8e94a0"], ["#e080f0", "#9a40c0"]][tier - 2] || METAL[2];
  disc(g, 8, 9, 4.5, 4.5, md);
  disc(g, 8, 9, 4.5, 4.5, m);
  g.clearRect(6, 7, 4, 4);
  g.fillStyle = md; g.fillRect(9, 6, 3, 1); g.fillRect(11, 7, 1, 5);
  g.fillStyle = tier >= 4 ? "#70e0e8" : "#e84a5a"; g.fillRect(7, 3, 2, 2);
  outline(c, g, "#111118");
  return c;
}

/** Item id → data URL (for the windows) and canvas (for loot on the ground and in hand). */
export function buildIcons(items) {
  const cv = { gold: coin(), hp_s: potion("#b8303c", "#f09aa0", false), hp_m: potion("#b8303c", "#f09aa0", true), mp_s: potion("#3058c0", "#9ab4f0", false), mp_m: potion("#3058c0", "#9ab4f0", true), stone: gem() };
  for (const id of Object.keys(items)) {
    const it = items[id];
    if (it.type === "weapon") cv[id] = weaponIcon(it.cls, it.tier);
    else if (it.type === "armor") cv[id] = armorIcon(it.tier);
    else if (it.type === "acc") cv[id] = accIcon(it.tier);
    else if (it.type === "rune") cv[id] = runeIcon(it.rune);
  }
  const url = {}, left = {};
  for (const id of Object.keys(cv)) { url[id] = cv[id].toDataURL(); left[id] = flip(cv[id]); }
  return { cv, url, left };
}
