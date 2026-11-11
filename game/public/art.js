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
  ".": ["#6cbf4b", "#58a83e", "#86d45e"],
  ",": ["#6cbf4b", "#58a83e", "#86d45e"],
  '"': ["#6cbf4b", "#58a83e", "#86d45e"],
  ":": ["#4a9a50", "#3c8444", "#5cae5e"],
  ";": ["#4a9a50", "#3c8444", "#5cae5e"],
  p: ["#e0c383", "#cdae6c", "#edd59c"],
  o: ["#c2bcae", "#9d968a", "#d8d3c6"],
  s: ["#eedfa4", "#dcc986", "#f8eebc"],
  w: ["#4f9ae6", "#3d84d4", "#9fd2ff"],
  b: ["#a8743e", "#7c5228", "#c08a50"],
  c: ["#6a6480", "#5a546e", "#7a7492"],
  d: ["#6a6480", "#5a546e", "#7a7492"],
  W: ["#2b2740", "#231f36", "#342f4c"],
};
const GRASSY = '.,":;';
const FLOWERS = ["#fff6a0", "#ffffff", "#ff9ac0", "#ffd060"];

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
  } else if (ch === "W") {
    for (let i = 0; i < 5; i++) px(g, X + Math.floor(hash(tx, ty, i) * 16), Y + Math.floor(hash(tx, ty, i + 9) * 16), i % 2 ? dark : light);
    // a rock face where the wall meets open floor below it
    const below = at(tx, ty + 1);
    if (below === "c" || below === "d") {
      g.fillStyle = "#4c4568"; g.fillRect(X, Y + 4, 16, 12);
      g.fillStyle = "#5e5780"; g.fillRect(X, Y + 4, 16, 2);
      g.fillStyle = "#3a3452";
      for (let i = 0; i < 4; i++) g.fillRect(X + Math.floor(hash(tx, ty, 40 + i) * 14), Y + 7 + i * 2, 3, 1);
      g.fillStyle = "#1c1830"; g.fillRect(X, Y + 15, 16, 1);
    }
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
        g.fillStyle = "#bfe2ff";
        if (s === 0) g.fillRect(X, Y + 2, 16, 1);
        else if (s === 2) g.fillRect(X + 2, Y, 1, 16);
      }
    }
  }
}

/** The whole ground layer of a map, pre-rendered twice (water animates). */
export function renderGround(m) {
  const out = [];
  for (let f = 0; f < 2; f++) {
    const [c, g] = canvas(m.w * TILE, m.h * TILE);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawTile(g, m, x, y, f);
    out.push(c);
  }
  return out;
}

const MINI = { ".": "#5fb04a", ",": "#5fb04a", '"': "#6cc058", ":": "#3f8a48", ";": "#3f8a48", p: "#d9b97a", o: "#b9b3a8", s: "#ead9a0", w: "#4a90d9", b: "#a8743e", c: "#6a6480", d: "#625c78", W: "#221e34" };
const MINI_OBJ = { T: "#2f7f33", P: "#235c3a", R: "#8a8a92", B: "#3f9a3c", h: "#c8563c", a: "#7fb8e8", K: "#6ae0f0", S: "#4a4560", F: "#8a5a30", L: "#e8d070", G: "#8a5a30" };
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
  const [c, g] = canvas(26, 34);
  g.fillStyle = "#8a5a30"; g.fillRect(11, 22, 4, 10);
  g.fillStyle = "#6a4222"; g.fillRect(14, 22, 1, 10); g.fillRect(10, 31, 6, 1);
  disc(g, 13, 13, 11, 11, "#2f7f33");
  disc(g, 12, 11, 9.5, 9, "#3f9a3c");
  disc(g, 10, 8, 6, 5, "#62b84c");
  disc(g, 8, 6, 2.5, 2, "#8ad466");
  for (let i = 0; i < 14; i++) px(g, 4 + Math.floor(hash(i, 1) * 18), 6 + Math.floor(hash(i, 2) * 15), i % 2 ? "#2f7f33" : "#62b84c");
  outline(c, g, "#1f4a26");
  return c;
}
function pine() {
  const [c, g] = canvas(24, 38);
  g.fillStyle = "#7a5030"; g.fillRect(10, 28, 4, 8);
  g.fillStyle = "#5a3a20"; g.fillRect(13, 28, 1, 8);
  const tier = (top, h, half) => {
    for (let y = 0; y < h; y++) {
      const w = Math.round(1 + (half * y) / (h - 1));
      g.fillStyle = "#2d7046"; g.fillRect(12 - w, top + y, w * 2, 1);
      g.fillStyle = "#3f8a56"; g.fillRect(12 - w, top + y, Math.max(1, Math.round(w * 0.6)), 1);
      g.fillStyle = "#205638"; g.fillRect(12 + Math.round(w * 0.5), top + y, w - Math.round(w * 0.5), 1);
    }
  };
  tier(1, 11, 6); tier(8, 12, 8.5); tier(16, 13, 11);
  outline(c, g, "#143826");
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
  disc(g, 8, 8, 7, 5, "#2f7f33");
  disc(g, 5, 7, 4, 4, "#3f9a3c"); disc(g, 11, 7, 4, 4, "#3f9a3c");
  disc(g, 6, 5, 2.5, 2, "#62b84c");
  for (const [x, y] of [[4, 8], [9, 6], [12, 9], [7, 10]]) { px(g, x, y, "#e84a5a"); px(g, x + 1, y, "#ff8a94"); }
  outline(c, g, "#1f4a26");
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
  const [c, g] = canvas(12, 30);
  g.fillStyle = "#4a4a58"; g.fillRect(5, 9, 2, 19); g.fillRect(3, 27, 6, 2);
  g.fillStyle = "#6a6a7a"; g.fillRect(5, 9, 1, 19);
  g.fillStyle = "#4a4a58"; g.fillRect(2, 1, 8, 1); g.fillRect(3, 8, 6, 1);
  g.fillStyle = "#ffe890"; g.fillRect(3, 2, 6, 6);
  g.fillStyle = "#fff8d0"; g.fillRect(4, 3, 3, 3);
  outline(c, g, "#22222c");
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
const ROOFS = [["#d8503c", "#a8342c", "#f07a5c"], ["#4a78c8", "#34569a", "#6e9ae4"], ["#4f9a58", "#377040", "#72bc7a"], ["#8a5ac0", "#643e94", "#aa80dc"]];
function house(v) {
  const [c, g] = canvas(64, 66);
  const [roof, roofD, roofL] = ROOFS[v % ROOFS.length];
  // walls
  g.fillStyle = "#f2e4c4"; g.fillRect(3, 30, 58, 34);
  g.fillStyle = "#d8c8a4"; g.fillRect(3, 58, 58, 6);
  g.fillStyle = "#8a5a30";
  g.fillRect(3, 30, 2, 34); g.fillRect(59, 30, 2, 34); g.fillRect(3, 44, 58, 2); g.fillRect(20, 30, 2, 14); g.fillRect(42, 30, 2, 14);
  // door
  g.fillStyle = "#8a5a30"; g.fillRect(26, 46, 12, 18);
  g.fillStyle = "#a8743e"; g.fillRect(28, 48, 8, 16);
  g.fillStyle = "#6a4222"; g.fillRect(31, 48, 1, 16);
  px(g, 34, 56, "#ffe890");
  // windows
  for (const x of [8, 46]) {
    g.fillStyle = "#8a5a30"; g.fillRect(x, 48, 11, 10);
    g.fillStyle = "#9fd2ff"; g.fillRect(x + 1, 49, 9, 8);
    g.fillStyle = "#e0f2ff"; g.fillRect(x + 2, 50, 3, 2);
    g.fillStyle = "#8a5a30"; g.fillRect(x + 5, 49, 1, 8); g.fillRect(x + 1, 53, 9, 1);
  }
  // roof
  for (let y = 0; y < 30; y++) {
    const inset = Math.max(0, 10 - Math.floor(y / 2.4));
    g.fillStyle = y % 6 === 5 ? roofD : roof;
    g.fillRect(inset, 2 + y, 64 - inset * 2, 1);
    g.fillStyle = roofL; g.fillRect(inset, 2 + y, 2, 1);
    g.fillStyle = roofD; g.fillRect(62 - inset, 2 + y, 2, 1);
  }
  g.fillStyle = roofD; g.fillRect(0, 30, 64, 2);
  g.fillStyle = roofL; g.fillRect(10, 2, 44, 1);
  // chimney
  g.fillStyle = "#b0a090"; g.fillRect(45, 0, 7, 9);
  g.fillStyle = "#8a7c6e"; g.fillRect(50, 0, 2, 9); g.fillRect(45, 0, 7, 2);
  outline(c, g, "#3a2414");
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
    house: [0, 1, 2, 3].map(house), fountain: [fountain(0), fountain(1)],
  };
  return s;
}

// ───────────────────────────── characters ─────────────────────────────

const C_DOWN = [
  "....oooooooo....",
  "...ohhhhhhhho...",
  "..ohhhhhhhhhho..",
  "..ohhhhhhhhhho..",
  "..ohhhsssshhho..",
  "..ohsessssesho..",
  "..ossessssesso..",
  "...osssssssso...",
  "....oooooooo....",
  "...occcccccco...",
  "..osccxxxxccso..",
  "..osccccccccso..",
  "...oCCCCCCCCo...",
  "....occoocco....",
  "....obboobbo....",
  ".....oo..oo.....",
];
const C_UP = [
  "....oooooooo....",
  "...ohhhhhhhho...",
  "..ohhhhhhhhhho..",
  "..ohhhhhhhhhho..",
  "..ohhhhhhhhhho..",
  "..ohhhhhhhhhho..",
  "..ohhHHHHHHhho..",
  "...ohHHHHHHho...",
  "....oooooooo....",
  "...occcccccco...",
  "..osccccccccso..",
  "..osccccccccso..",
  "...oCCCCCCCCo...",
  "....occoocco....",
  "....obboobbo....",
  ".....oo..oo.....",
];
const C_SIDE = [
  "....oooooooo....",
  "...ohhhhhhhho...",
  "..ohhhhhhhhhho..",
  "..ohhhhhhhhhho..",
  "..osshhhhhhhho..",
  "..osesshhhhhho..",
  "..osesshhhhhho..",
  "...ossssshhho...",
  "....oooooooo....",
  "....occcccco....",
  "....occscxco....",
  "....occscxco....",
  "....oCCCCCCo....",
  ".....occcco.....",
  ".....obbbbo.....",
  "......oooo......",
];
const SIDE_STEP = ["....occoocco....", "...obbo..obbo...", "....oo....oo...."];

export const HAIR = [["#6a4630", "#4a3020"], ["#2a2a36", "#16161e"], ["#f0cc58", "#c89c30"], ["#d85a34", "#a83c20"], ["#f29ac0", "#c86a94"], ["#ecebf2", "#b8b6c8"]];
export const SKIN = [["#ffd9b0", "#e8b088"], ["#f0b98a", "#cc9060"], ["#c68a5c", "#9c6440"]];
const CLOTH = { warrior: ["#d0483c", "#9c2c28"], archer: ["#3f9a58", "#2a7040"], mage: ["#6a58c8", "#4838a0"] };
const ARMOR = [null, null, ["#b07a40", "#855628"], ["#9aa6bc", "#6c7890"], ["#5cd4e4", "#30a0b8"]];

function charFrame(base, o, legs, bob) {
  const [c, g] = canvas(16, 22);
  const rows = base.slice();
  if (legs === "side") rows.splice(13, 3, ...SIDE_STEP);
  const hair = HAIR[o.hair] || HAIR[0], skin = SKIN[o.skin] || SKIN[0];
  const pal = {
    o: o.line || "#2a1a14", h: hair[0], H: hair[1], s: skin[0], S: skin[1], e: o.eye || "#2a1a14",
    c: o.cloth[0], C: o.cloth[1], x: o.trim, b: o.boot || "#5a3a22",
  };
  const oy = 6 + (bob ? 1 : 0);
  // head + body share one bob; legs are painted separately so a foot can lift
  paint(g, rows.slice(0, 13), pal, 0, oy);
  const legRows = rows.slice(13);
  for (let y = 0; y < legRows.length; y++) for (let x = 0; x < 16; x++) {
    const col = pal[legRows[y][x]];
    if (!col) continue;
    const lift = (legs === "l" && x < 8) || (legs === "r" && x >= 8) ? 1 : 0;
    px(g, x, 6 + 13 + y - lift, col);
  }
  // long hair
  if (o.style === 1 && !o.hat) {
    g.fillStyle = hair[0];
    if (base === C_SIDE) { g.fillRect(10, oy + 8, 3, 3); g.fillStyle = hair[1]; g.fillRect(12, oy + 8, 1, 3); }
    else { g.fillRect(2, oy + 7, 2, 4); g.fillRect(12, oy + 7, 2, 4); if (base === C_UP) g.fillRect(4, oy + 8, 8, 2); }
  }
  // headgear
  if (o.hat === "warrior") {
    g.fillStyle = "#c4ccd8"; g.fillRect(3, oy + 1, 10, 3); g.fillRect(4, oy, 8, 1);
    g.fillStyle = "#8e98a8"; g.fillRect(3, oy + 3, 10, 1);
    g.fillStyle = "#e8eef4"; g.fillRect(5, oy + 1, 3, 1);
    g.fillStyle = "#d0483c"; g.fillRect(7, oy - 2, 2, 2);
  } else if (o.hat === "archer") {
    g.fillStyle = "#2f8048"; g.fillRect(3, oy + 1, 10, 3); g.fillRect(4, oy, 8, 1);
    g.fillStyle = "#1f5c32"; g.fillRect(3, oy + 3, 10, 1);
    g.fillStyle = "#fff0a0"; g.fillRect(11, oy - 2, 1, 3); g.fillRect(12, oy - 3, 1, 2);
  } else if (o.hat === "mage") {
    g.fillStyle = "#4a3aa8";
    g.fillRect(1, oy + 2, 14, 2);
    for (let i = 0; i < 6; i++) g.fillRect(4 + Math.floor(i / 2), oy + 1 - i, 8 - i - Math.floor(i / 2), 1);
    g.fillStyle = "#ffd860"; g.fillRect(3, oy + 1, 10, 1);
    g.fillStyle = "#32267c"; g.fillRect(1, oy + 3, 14, 1);
  }
  if (o.beard) {
    g.fillStyle = "#ecebf2";
    if (base === C_DOWN) { g.fillRect(4, oy + 7, 8, 2); g.fillRect(5, oy + 9, 6, 1); }
    else if (base === C_SIDE) g.fillRect(3, oy + 7, 4, 3);
  }
  outline(c, g, pal.o);
  return c;
}

const charCache = new Map();
/**
 * A full character sheet: `[dir][frame]`, dir 0 down · 1 left · 2 right · 3 up,
 * frame 0 idle · 1/2 walking.
 */
export function charSprite(o) {
  const key = JSON.stringify(o);
  let s = charCache.get(key);
  if (s) return s;
  const set = (base, legs) => [charFrame(base, o, null, false), charFrame(base, o, legs[0], true), charFrame(base, o, legs[1], true)];
  const down = set(C_DOWN, ["l", "r"]);
  const up = set(C_UP, ["l", "r"]);
  const left = set(C_SIDE, ["side", null]);
  s = [down, left, left.map(flip), up];
  charCache.set(key, s);
  return s;
}

/** Sprite options for a player from the server's public record. */
export function playerLook(cls, look, armorTier) {
  return {
    hair: look[0] | 0, skin: look[1] | 0, style: look[2] | 0, hat: cls,
    cloth: ARMOR[armorTier] || CLOTH[cls] || CLOTH.warrior, trim: (CLOTH[cls] || CLOTH.warrior)[0],
  };
}
export function npcLook(look, role) {
  const col = look[3] || "#888";
  return { hair: look[0] | 0, skin: look[1] | 0, style: look[2] | 0, cloth: [col, shade(col)], trim: "#fff0c0", beard: role === "elder" };
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.72).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

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
const PAL = {
  slime: { o: "#1f5a2a", a: "#74d85e", A: "#48a840", l: "#d0f8b8", e: "#14301a" },
  bslime: { o: "#1f3a6a", a: "#62b8f4", A: "#3a84d4", l: "#d0ecff", e: "#10244a" },
  shroom: { o: "#4a1a1a", r: "#dc4c40", R: "#a8302c", w: "#fff4e0", c: "#f0e0c0", C: "#d0b890", e: "#2a1a1a" },
  boar: { o: "#3a2414", b: "#a06e46", B: "#6a4428", p: "#eca4a4", w: "#ffffff", e: "#1a1010" },
  bat: { o: "#2a1a3a", b: "#74529a", r: "#ff5050", w: "#ffffff" },
  golem: { o: "#2a2540", g: "#908aae", G: "#6a6488", k: "#6ae0f0", e: "#ffe060" },
  boss: { o: "#140f2a", g: "#6252a8", G: "#40347c", k: "#ff6ad0", e: "#ff5050" },
};

function mobFrames(map, pal, scale = 1, extra = null) {
  const [c, g] = canvas(16, 16);
  paint(g, map, pal);
  let a = c;
  if (scale !== 1 || extra) {
    const [c2, g2] = canvas(16 * scale, 16 * scale + (extra ? 8 : 0));
    g2.drawImage(c, 0, extra ? 8 : 0, 16 * scale, 16 * scale);
    if (extra) extra(g2);
    a = c2;
  }
  // second frame: a one-pixel squash, the classic idle "breath"
  const [b, gb] = canvas(a.width, a.height);
  gb.drawImage(a, 0, 0, a.width, a.height, 0, scale, a.width, a.height - scale);
  return [a, b];
}

/** `{ frames:[l0,l1], right:[r0,r1], white:[…] , lift }` per monster sprite id. */
export function buildMobs() {
  const out = {};
  const add = (id, frames, lift = 0) => {
    out[id] = { frames, right: frames.map(flip), hurt: frames.map((f) => tinted(f, "#ffffff")), hurtR: frames.map((f) => tinted(flip(f), "#ffffff")), lift };
  };
  add("slime", mobFrames(M_SLIME, PAL.slime));
  add("bslime", mobFrames(M_SLIME, PAL.bslime));
  add("shroom", mobFrames(M_SHROOM, PAL.shroom));
  add("boar", mobFrames(M_BOAR, PAL.boar));
  const [ba, ga] = canvas(16, 16); paint(ga, M_BAT_A, PAL.bat);
  const [bb, gb] = canvas(16, 16); paint(gb, M_BAT_B, PAL.bat);
  add("bat", [ba, bb], 8);
  const skel = charSprite({ hair: 5, skin: 0, style: 0, cloth: ["#5a5468", "#3e3a4c"], trim: "#3e3a4c", line: "#1c1826", eye: "#101018", boot: "#b8b6c8", skel: 1 });
  // bones instead of skin
  const bone = skel[1].map((f) => { const [c, g] = canvas(16, 22); g.drawImage(f, 0, 0); recolor(c, g, "#ffd9b0", "#ecebf2"); recolor(c, g, "#e8b088", "#b8b6c8"); return c; });
  add("skel", [bone[1], bone[2]]);
  add("golem", mobFrames(M_GOLEM, PAL.golem));
  add("boss", mobFrames(M_GOLEM, PAL.boss, 2, (g) => {
    // a crown of crystal shards
    const sh = (x, h) => { for (let y = 0; y < h; y++) { g.fillStyle = y < 2 ? "#ffd0f0" : "#ff6ad0"; g.fillRect(x - Math.min(2, Math.floor(y / 2)), 8 - h + y, 1 + Math.min(2, Math.floor(y / 2)) * 2, 1); } };
    sh(10, 6); sh(16, 8); sh(22, 6);
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

export const TIER_COL = ["#ffffff", "#e8e8e8", "#7be07b", "#6aa8ff", "#e680ff"];
const METAL = [null, ["#c8ccd4", "#8e94a0"], ["#9be89b", "#4fa85a"], ["#8ab8ff", "#4a78d0"], ["#f0a0ff", "#b050d8"]];

function potion(liquid, light, big) {
  const [c, g] = canvas(16, 16);
  const r = big ? 5.5 : 4.5;
  disc(g, 8, 10, r, r, "#e8f6ff");
  disc(g, 8, 10.5, r - 1, r - 1.2, liquid);
  g.fillStyle = "#e8f6ff"; g.fillRect(6, 2, 4, 4);
  g.fillStyle = "#a8743e"; g.fillRect(6, 1, 4, 2);
  px(g, 6, 9, light); px(g, 6, 10, light); px(g, 7, 8, light);
  if (big) { px(g, 10, 11, light); px(g, 9, 12, light); }
  outline(c, g, "#1c1c2c");
  return c;
}
function gem() {
  const [c, g] = canvas(16, 16);
  for (let y = 0; y < 11; y++) {
    const w = y < 4 ? 3 + y : 7 - (y - 4);
    if (w <= 0) continue;
    g.fillStyle = "#6ae0f0"; g.fillRect(8 - w, 3 + y, w * 2, 1);
    g.fillStyle = "#3aa8d8"; g.fillRect(8, 3 + y, w, 1);
  }
  g.fillStyle = "#d8fbff"; g.fillRect(5, 5, 2, 1); g.fillRect(4, 6, 1, 2);
  outline(c, g, "#1a3a5a");
  return c;
}
function coin() {
  const [c, g] = canvas(16, 16);
  disc(g, 8, 9, 4.5, 4.5, "#e8a820");
  disc(g, 7.5, 8.5, 3.5, 3.5, "#ffd84a");
  g.fillStyle = "#fff4b0"; g.fillRect(6, 6, 2, 1); g.fillRect(5, 7, 1, 2);
  g.fillStyle = "#e8a820"; g.fillRect(8, 7, 1, 4);
  outline(c, g, "#6a4a10");
  return c;
}
function weaponIcon(cls, tier) {
  const [c, g] = canvas(16, 16);
  const [m, md] = METAL[tier];
  if (cls === "warrior") {
    for (let i = 0; i < 9; i++) { px(g, 12 - i, 3 + i, m); px(g, 13 - i, 3 + i, md); px(g, 12 - i, 2 + i, m); }
    g.fillStyle = "#e8b840"; g.fillRect(2, 9, 2, 1); g.fillRect(3, 10, 2, 1); g.fillRect(4, 11, 2, 1); g.fillRect(5, 12, 2, 1);
    g.fillStyle = "#8a5a30"; px(g, 3, 12, "#8a5a30"); px(g, 2, 13, "#8a5a30"); px(g, 1, 14, "#6a4222");
  } else if (cls === "archer") {
    for (let i = 0; i < 12; i++) {
      const x = 4 + Math.round(Math.sin((i / 11) * Math.PI) * 6);
      px(g, x, 2 + i, m); px(g, x + 1, 2 + i, md);
    }
    g.fillStyle = "#f0f0f0"; g.fillRect(4, 2, 1, 12);
    g.fillStyle = "#8a5a30"; g.fillRect(9, 7, 2, 2);
  } else {
    for (let i = 0; i < 10; i++) { px(g, 4 + i, 13 - i, "#a8743e"); px(g, 5 + i, 13 - i, "#7c5228"); }
    disc(g, 12, 4, 2.5, 2.5, md);
    disc(g, 11.6, 3.6, 1.5, 1.5, m);
    px(g, 11, 3, "#ffffff");
  }
  outline(c, g, "#1c1c2c");
  return c;
}
function armorIcon(tier) {
  const [c, g] = canvas(16, 16);
  const cols = [null, ["#e8dcc0", "#c0b090"], ["#b07a40", "#855628"], ["#9aa6bc", "#6c7890"], ["#5cd4e4", "#30a0b8"]][tier];
  g.fillStyle = cols[0]; g.fillRect(4, 4, 8, 10); g.fillRect(2, 4, 12, 4);
  g.fillStyle = cols[1]; g.fillRect(8, 4, 4, 10); g.fillRect(12, 4, 2, 4); g.fillRect(4, 12, 8, 2);
  g.clearRect(6, 4, 4, 2);
  g.fillStyle = METAL[tier][0]; g.fillRect(7, 8, 2, 2);
  outline(c, g, "#1c1c2c");
  return c;
}

/** Item id → data URL (for the windows) and canvas (for loot on the ground). */
export function buildIcons(items) {
  const cv = { gold: coin(), hp_s: potion("#e8404c", "#ffb0b4", false), hp_m: potion("#e8404c", "#ffb0b4", true), mp_s: potion("#4070e8", "#b0c8ff", false), mp_m: potion("#4070e8", "#b0c8ff", true), stone: gem() };
  for (const id of Object.keys(items)) {
    const it = items[id];
    if (it.type === "weapon") cv[id] = weaponIcon(it.cls, it.tier);
    else if (it.type === "armor") cv[id] = armorIcon(it.tier);
  }
  const url = {};
  for (const id of Object.keys(cv)) url[id] = cv[id].toDataURL();
  return { cv, url };
}
