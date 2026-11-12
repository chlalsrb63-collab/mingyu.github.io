/**
 * The world, drawn top-down in chunky pixels.
 *
 * Ground, scenery, creatures and effects are all painted here in one style:
 * flat colours, one shadow tone, and a thick dark outline around everything
 * that stands up. Terrain is laid out as soft-cornered patches with a darker
 * rim where two kinds of ground meet. People and monsters come from
 * sprites.js; a weapon is a separate sprite that is rotated around the hand,
 * so an attack is the weapon itself being swung.
 *
 * Units: the server speaks in sixteenths of a tile. One tile is 32 pixels
 * here, so one server unit is two pixels. The view is scaled by a whole number
 * so every pixel stays square.
 */

import * as SP from "./sprites.js";

const T = 32, P = 2;
const INK = "#2b2233";
const DEG = Math.PI / 180;
const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const dk = (c, f = 0.78) => mix(c, f), lt = (c, f = 1.25) => mix(c, f);

let cv, g, Z = 2, vw = 320, vh = 200;
const cam = { x: 0, y: 0 };
let map = null, ground = null, statics = [], npcs = [], G = null, shakeAmt = 0;
export const PARTS = SP.PARTS;
export function playerLook(cls, look, gear = {}) { return { cls, look, gear }; }

export function init(canvas) { cv = canvas; g = cv.getContext("2d"); resize(); }
export function resize() {
  if (!cv) return;
  // about 440×256 world pixels on screen, so the small sprites stay readable
  Z = Math.max(1, Math.round(Math.min(innerWidth / 440, innerHeight / 256)));
  if (innerWidth < 560) Z = Math.max(2, Math.round(innerWidth / 220));
  vw = Math.ceil(innerWidth / Z); vh = Math.ceil(innerHeight / Z);
  cv.width = vw; cv.height = vh;
  cv.style.width = vw * Z + "px"; cv.style.height = vh * Z + "px";
  g.imageSmoothingEnabled = false;
}

// ───────────────────────────── drawing tools ─────────────────────────────

function sheet(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  return [c, x];
}
function tools(x) {
  const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h)); };
  const oval = (cx, cy, rx, ry, col) => {
    x.fillStyle = col;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const k = 1 - ((y + 0.5 - cy) / ry) ** 2;
      if (k <= 0) continue;
      const w = Math.round(rx * Math.sqrt(k));
      x.fillRect(Math.round(cx) - w, y, w * 2, 1);
    }
  };
  const block = (a, b, w, h, col, shade = 3) => { r(a + 1, b, w - 2, h, col); r(a, b + 1, w, h - 2, col); if (shade) r(a, b + h - shade, w, shade - 1, dk(col)); };
  const tri = (pts, col) => { x.fillStyle = col; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); };
  return { r, oval, block, tri };
}
/** Harden edges and ink a two-pixel outline around whatever was drawn. */
function ink(c, x, col = INK) {
  const w = c.width, h = c.height;
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  x.putImageData(img, 0, 0);
  for (let pass = 0; pass < 2; pass++) {
    const src = x.getImageData(0, 0, w, h).data;
    const solid = (a, b) => a >= 0 && b >= 0 && a < w && b < h && src[(b * w + a) * 4 + 3] > 0;
    x.fillStyle = col;
    for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) if (!solid(a, b) && (solid(a - 1, b) || solid(a + 1, b) || solid(a, b - 1) || solid(a, b + 1))) x.fillRect(a, b, 1, 1);
  }
  return c;
}
/** A prop sprite: draw inside a margin, then outline. */
function prop(w, h, draw) {
  const [c, x] = sheet(w + 4, h + 4);
  x.translate(2, 2);
  draw(tools(x), x);
  x.setTransform(1, 0, 0, 1, 0, 0);
  return ink(c, x);
}

// ───────────────────────────── scenery sprites ─────────────────────────────

const ROOF = ["#d8604c", "#5a86cc", "#62a86c", "#9a70c8"];
const NEON = ["#ff5a94", "#5ae4e4", "#ffd24a", "#7aff8a"];
const CAR = ["#c84a50", "#4a78c0", "#e0e0e6", "#484c58", "#d8ac40"];
let SC = null;
function scenery() {
  if (SC) return SC;
  const house = (v) => prop(132, 136, (b) => {
    const roof = ROOF[v % 4];
    b.block(6, 62, 120, 72, "#f4e8cc", 6);
    b.r(6, 62, 120, 4, "#c8b890");
    b.block(54, 96, 24, 38, "#8a5a34", 0); b.r(58, 100, 16, 34, "#a8743e"); b.r(70, 116, 3, 3, "#f0cc60");
    for (const x of [16, 90]) { b.block(x, 82, 26, 24, "#8a5a34", 0); b.r(x + 3, 85, 20, 18, "#ffe6a0"); b.r(x + 12, 85, 2, 18, "#8a5a34"); b.r(x + 3, 93, 20, 2, "#8a5a34"); }
    b.tri([[0, 66], [132, 66], [112, 8], [20, 8]], roof);
    b.tri([[0, 66], [132, 66], [128, 54], [4, 54]], dk(roof));
    for (let y = 20; y < 54; y += 11) b.r(16 - (y - 8) * 0.34, y, 100 + (y - 8) * 0.68, 2, dk(roof));
    b.r(22, 10, 88, 3, lt(roof));
    b.block(88, 0, 16, 22, "#b8a898", 4);
  });
  const building = (v) => prop(132, 208, (b) => {
    const wall = ["#6c7284", "#7c665a", "#5c687c", "#6c5c80"][v % 4], neon = NEON[v % 4];
    b.block(4, 10, 124, 196, wall, 8);
    b.block(0, 0, 132, 14, "#343844", 4);
    for (let r = 0; r < 5; r++) for (let i = 0; i < 5; i++) {
      const on = hash(i, r, v + 3) > 0.42;
      b.r(13 + i * 22, 24 + r * 24, 16, 16, "#20232c");
      b.r(15 + i * 22, 26 + r * 24, 12, 12, on ? (hash(i, r, v + 9) > 0.5 ? "#ffd880" : "#a8e4ff") : "#30364a");
    }
    b.r(10, 146, 112, 14, "#181a22"); b.r(14, 149, 30, 8, neon); b.r(50, 149, 10, 8, neon); b.r(66, 149, 26, 8, neon); b.r(98, 149, 18, 8, neon);
    b.block(46, 166, 40, 40, "#262a36", 0); for (let y = 170; y < 204; y += 6) b.r(50, y, 32, 3, "#444a5a");
    b.block(10, 168, 28, 26, "#20232c", 0); b.r(13, 171, 22, 8, "#58789a"); b.block(94, 168, 28, 26, "#20232c", 0); b.r(97, 171, 22, 8, "#58789a");
  });
  SC = {
    T: prop(60, 76, (b) => { b.block(24, 48, 12, 26, "#8a5a34", 4); b.oval(30, 30, 29, 27, "#2f8048"); b.oval(27, 26, 24, 21, "#46a05a"); b.oval(21, 19, 14, 11, "#62c070"); b.r(14, 14, 6, 3, "#8ad88c"); b.r(36, 38, 8, 3, "#2f8048"); b.r(12, 34, 6, 3, "#2f8048"); }),
    P: prop(52, 84, (b) => { b.block(21, 62, 10, 20, "#7a5030", 4); for (const [y, w] of [[36, 26], [18, 21], [0, 15]]) { b.tri([[26 - w, y + 30], [26 + w, y + 30], [26, y]], "#2a7050"); b.tri([[26 - w, y + 30], [26, y + 30], [26, y]], "#3c8a62"); } }),
    B: prop(38, 28, (b) => { b.oval(19, 16, 18, 12, "#2f8048"); b.oval(13, 13, 10, 9, "#46a05a"); b.oval(25, 13, 10, 9, "#46a05a"); b.r(9, 8, 6, 2, "#62c070"); for (const [x, y] of [[8, 17], [20, 12], [28, 19], [15, 21]]) b.r(x, y, 3, 3, "#f06a7a"); }),
    R: prop(36, 28, (b) => { b.oval(18, 16, 17, 12, "#8a8e9c"); b.oval(16, 13, 13, 9, "#a8acba"); b.oval(12, 9, 6, 3, "#c8ccd8"); b.r(20, 19, 8, 2, "#8a8e9c"); }),
    F: prop(32, 26, (b) => { b.r(0, 8, 32, 5, "#c89a5e"); b.r(0, 17, 32, 5, "#c89a5e"); b.block(4, 0, 7, 26, "#dcb478", 3); b.block(21, 0, 7, 26, "#dcb478", 3); }),
    L: prop(22, 62, (b) => { b.r(9, 18, 4, 40, "#4a4c5a"); b.block(5, 56, 12, 6, "#4a4c5a", 2); b.block(2, 2, 18, 18, "#ffe690", 0); b.r(6, 6, 8, 8, "#fff8d0"); b.r(0, 0, 22, 4, "#4a4c5a"); b.r(2, 18, 18, 3, "#4a4c5a"); }),
    G: prop(30, 32, (b) => { b.r(13, 16, 5, 16, "#8a6238"); b.block(0, 0, 30, 18, "#dcb478", 3); b.r(5, 5, 20, 2, "#8a6238"); b.r(5, 10, 14, 2, "#8a6238"); }),
    K: prop(32, 42, (b) => { const sh = (x, y, w, h, c) => { b.tri([[x, y + h], [x + w, y + h], [x + w, y + 8], [x + w / 2, y], [x, y + 8]], c); b.tri([[x + w / 2, y + h], [x + w, y + h], [x + w, y + 8], [x + w / 2, y]], dk(c, 0.82)); b.r(x + 2, y + 9, 2, h - 14, "#e8fdff"); }; sh(2, 16, 10, 26, "#72e6f4"); sh(11, 0, 12, 42, "#72e6f4"); sh(22, 20, 9, 22, "#72e6f4"); }),
    K2: prop(32, 42, (b) => { const sh = (x, y, w, h, c) => { b.tri([[x, y + h], [x + w, y + h], [x + w, y + 8], [x + w / 2, y], [x, y + 8]], c); b.tri([[x + w / 2, y + h], [x + w, y + h], [x + w, y + 8], [x + w / 2, y]], dk(c, 0.82)); b.r(x + 2, y + 9, 2, h - 14, "#f6e8ff"); }; sh(2, 16, 10, 26, "#c08af4"); sh(11, 0, 12, 42, "#c08af4"); sh(22, 20, 9, 22, "#c08af4"); }),
    S: prop(26, 36, (b) => { b.tri([[0, 36], [26, 36], [13, 0]], "#5a7896"); b.tri([[0, 36], [13, 36], [13, 0]], "#7090b0"); }),
    Z: prop(32, 54, (b) => { b.r(0, 0, 32, 54, "#343846"); b.r(0, 0, 32, 20, "#444a5c"); for (let y = 26; y < 54; y += 8) { b.r(0, y, 32, 2, "#262a36"); b.r((y % 16) + 4, y - 6, 2, 6, "#262a36"); b.r((y % 16) + 20, y - 6, 2, 6, "#262a36"); } }),
    y: prop(16, 24, (b) => { b.block(4, 4, 8, 20, "#d84c4c", 3); b.r(0, 10, 16, 5, "#d84c4c"); b.block(3, 0, 10, 6, "#f07070", 2); }),
    x: prop(20, 26, (b) => { b.block(2, 6, 16, 20, "#5c6070", 4); b.r(6, 10, 2, 12, "#484c5a"); b.r(11, 10, 2, 12, "#484c5a"); b.block(0, 2, 20, 6, "#787c8c", 2); }),
    c: CAR.map((col) => prop(62, 34, (b) => { b.block(0, 12, 62, 18, col, 5); b.block(12, 0, 34, 16, col, 0); b.r(15, 3, 13, 10, "#2a3442"); b.r(31, 3, 12, 10, "#2a3442"); b.r(15, 3, 13, 2, "#6a8cac"); b.r(31, 3, 12, 2, "#6a8cac"); b.r(56, 15, 6, 5, "#ffe8a0"); b.r(0, 15, 4, 5, "#ff5050"); b.oval(14, 30, 6, 5, "#22242c"); b.oval(47, 30, 6, 5, "#22242c"); b.oval(14, 30, 2, 2, "#8a8e9c"); b.oval(47, 30, 2, 2, "#8a8e9c"); })),
    house: [0, 1, 2, 3].map(house).concat([4, 5, 6, 7].map(building)),
    fountain: prop(68, 62, (b) => { b.oval(34, 42, 33, 19, "#9aa0ac"); b.oval(34, 40, 33, 18, "#c2c8d4"); b.oval(34, 39, 27, 13, "#4a9ae0"); b.oval(30, 36, 16, 6, "#7abcf4"); b.block(29, 12, 10, 28, "#c2c8d4", 0); b.r(29, 12, 3, 28, "#dfe4ee"); b.oval(34, 12, 10, 5, "#dfe4ee"); b.r(31, 2, 2, 6, "#dff2ff"); b.r(37, 4, 2, 5, "#dff2ff"); b.r(26, 6, 2, 4, "#dff2ff"); }),
  };
  return SC;
}

// ───────────────────────────── ground ─────────────────────────────

const BASE = { ".": "#62b05c", ",": "#62b05c", '"': "#62b05c", ":": "#3f8a5c", ";": "#3f8a5c", p: "#c89c64", o: "#aab0bc", s: "#ead8a0", w: "#4a9ae0", b: "#b4844c", c: "#456684", d: "#456684", W: "#141c34", a: "#4c5060", m: "#4c5060", k: "#a0a6b4" };
const GROUP = { ".": 0, ",": 0, '"': 0, ":": 1, ";": 1, p: 2, o: 3, s: 4, w: 5, b: 6, c: 7, d: 7, W: 8, a: 9, m: 9, k: 10 };

function paintGround(m) {
  const [c, x] = sheet(m.w * T, m.h * T);
  const b = tools(x);
  const at = (tx, ty) => (ty < 0 || tx < 0 || ty >= m.h || tx >= m.w ? null : m.g[ty][tx]);
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
    const ch = m.g[ty][tx], X = tx * T, Y = ty * T, col = BASE[ch] || "#888", grp = GROUP[ch];
    const h = (s) => hash(tx, ty, s);
    b.r(X, Y, T, T, col);
    if (grp === 0 || grp === 1) {
      const d = dk(col, 0.86), l = lt(col, 1.18);
      for (let i = 0; i < 3; i++) { const a = X + 3 + Math.floor(h(i) * 24), q = Y + 4 + Math.floor(h(i + 9) * 22); b.r(a, q, 2, 4, d); b.r(a + 3, q + 1, 2, 3, d); }
      if (ch === "," || ch === ";") { const a = X + 6 + Math.floor(h(20) * 16), q = Y + 8 + Math.floor(h(21) * 14); b.r(a, q, 2, 7, l); b.r(a - 3, q + 2, 2, 5, l); b.r(a + 3, q + 2, 2, 5, l); b.r(a - 5, q + 5, 2, 2, l); b.r(a + 5, q + 5, 2, 2, l); }
      if (ch === '"') for (let i = 0; i < 2; i++) { const a = X + 5 + Math.floor(h(30 + i) * 20), q = Y + 5 + Math.floor(h(40 + i) * 20), fc = ["#fff6c0", "#ffffff", "#ffb0cc"][Math.floor(h(50 + i) * 3)]; b.r(a - 2, q, 6, 2, fc); b.r(a, q - 2, 2, 6, fc); b.r(a, q, 2, 2, "#f0b040"); }
    } else if (ch === "p" || ch === "s") {
      for (let i = 0; i < 4; i++) b.r(X + 3 + Math.floor(h(i) * 25), Y + 3 + Math.floor(h(i + 9) * 25), 3, 2, i % 2 ? dk(col, 0.9) : lt(col, 1.15));
    } else if (ch === "o" || ch === "k") {
      const d = dk(col, 0.86);
      b.r(X, Y + 15, T, 2, d); b.r(X, Y + 31, T, 1, d); b.r(X + (ty % 2 ? 8 : 24), Y, 2, 15, d); b.r(X + (ty % 2 ? 24 : 8), Y + 17, 2, 14, d);
      b.r(X + 3 + Math.floor(h(1) * 20), Y + 4 + Math.floor(h(2) * 8), 4, 2, lt(col, 1.12));
    } else if (ch === "w") {
      for (let i = 0; i < 2; i++) b.r(X + 3 + Math.floor(h(i) * 18), Y + 7 + i * 14, 9, 2, lt(col, 1.3));
    } else if (ch === "b") {
      for (let q = 0; q < T; q += 8) { b.r(X, Y + q + 7, T, 1, dk(col, 0.74)); b.r(X + Math.floor(h(q) * 20), Y + q + 2, 8, 2, lt(col, 1.15)); }
    } else if (grp === 7) {
      // cave floor: overlapping scales, like wet flagstones
      const d = dk(col, 0.84);
      for (let q = 0; q < 2; q++) for (let i = 0; i < 2; i++) { const a = X + i * 16 + (q ? 8 : 0), z = Y + q * 16; b.r(a + 2, z + 13, 12, 2, d); b.r(a, z + 9, 2, 4, d); b.r(a + 14, z + 9, 2, 4, d); }
      if (ch === "d") b.r(X + 8 + Math.floor(h(3) * 12), Y + 6, 6, 2, lt(col, 1.2));
    } else if (grp === 9) {
      for (let i = 0; i < 4; i++) b.r(X + Math.floor(h(i) * 28), Y + Math.floor(h(i + 9) * 28), 3, 2, i % 2 ? dk(col, 0.86) : lt(col, 1.14));
      if (ch === "m") b.r(X + 4, Y + 14, 24, 4, "#e0bc50");
    } else if (ch === "W") {
      // rock: flat darkness, with a lit face where it stands over open floor
      const below = at(tx, ty + 1);
      if (below && below !== "W") { b.r(X, Y + 8, T, 24, "#2e4468"); b.r(X, Y + 8, T, 4, "#42608c"); for (let i = 0; i < 3; i++) b.r(X + 2 + Math.floor(h(i) * 22), Y + 15 + i * 5, 8, 2, "#223450"); b.r(X, Y + 30, T, 2, INK); }
      else b.r(X + Math.floor(h(1) * 24), Y + Math.floor(h(2) * 24), 5, 2, "#1c2848");
    }
    // a darker rim wherever this patch meets another kind of ground
    if (grp >= 2 && grp !== 8) {
      const rim = grp === 5 ? "#2f74bc" : dk(col, 0.74), edge = grp === 5 ? "#dff2ff" : dk(col, 0.6);
      const dif = (dx, dy) => { const n = at(tx + dx, ty + dy); return n !== null && GROUP[n] !== grp && !(grp === 6 && GROUP[n] === 5) && !(grp === 5 && GROUP[n] === 6) && GROUP[n] !== 8; };
      const n = dif(0, -1), s = dif(0, 1), w = dif(-1, 0), e = dif(1, 0);
      if (n) { b.r(X, Y, T, 4, rim); b.r(X, Y, T, 2, edge); }
      if (s) { b.r(X, Y + T - 4, T, 4, rim); b.r(X, Y + T - 2, T, 2, edge); }
      if (w) { b.r(X, Y, 4, T, rim); b.r(X, Y, 2, T, edge); }
      if (e) { b.r(X + T - 4, Y, 4, T, rim); b.r(X + T - 2, Y, 2, T, edge); }
      // round the outer corners by letting the neighbour's colour bite in
      const bite = (cx, cy, dx, dy) => { const nb = at(tx + dx, ty) ?? at(tx, ty + dy); b.r(cx, cy, 4, 4, BASE[nb] || col); };
      if (n && w) bite(X, Y, -1, -1);
      if (n && e) bite(X + T - 4, Y, 1, -1);
      if (s && w) bite(X, Y + T - 4, -1, 1);
      if (s && e) bite(X + T - 4, Y + T - 4, 1, 1);
    }
  }
  return c;
}

export function loadMap(m) {
  map = m;
  ground = paintGround(m);
  const S = scenery();
  statics = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const ch = m.o[y][x];
    let sp = S[ch];
    if (!sp) continue;
    if (ch === "c") sp = sp[Math.floor(hash(x, y, 3) * sp.length)];
    if (ch === "K" && hash(x, y, 7) > 0.6) sp = S.K2;
    const wide = ch === "c" ? T : 0;
    statics.push({ sp, x: x * T + T / 2 + wide / 2, y: (y + 1) * T - 3, glow: ch === "L" ? "#ffe690" : ch === "K" ? "#72e6f4" : null, sway: ch === "T" || ch === "P" || ch === "B" ? hash(x, y, 4) * 6 : -1 });
  }
  for (const b of m.big) {
    if (b.t === "house") statics.push({ sp: S.house[b.v % 8], x: (b.x + 2) * T, y: (b.y + 3) * T - 2, glow: b.v >= 4 ? NEON[b.v % 4] : null, big: true });
    else statics.push({ sp: S.fountain, x: (b.x + 1) * T, y: (b.y + 2) * T - 2 });
  }
  npcs = m.npcs.map((n) => ({ n, x: n.x * T + T / 2, y: n.y * T + 24, sheet: SP.personSheet(SP.npcLook(n.look, n.role)) }));
  ents.clear();
  fx.clear();
}

// ───────────────────────────── creatures ─────────────────────────────

const ents = new Map();
/** Per-entity presentation state: which way it faces, its stride, its weapon's angle. */
function state(id, key, make) {
  let s = ents.get(id);
  if (!s || s.key !== key) { s = { key, face: 1, walk: 0, ang: null, ...make() }; ents.set(id, s); }
  s.seen = true;
  return s;
}
function personState(id, look) {
  return state(id, JSON.stringify(look), () => {
    const cls = SP.HOLD[look.cls] ? look.cls : "warrior";
    return { cls, sheet: SP.personSheet(SP.playerLook(cls, look.look, look.gear)), weapon: SP.weaponSprite(cls, look.gear), gear: look.gear || {}, h: look.look && look.look[0] === 1 ? 1.1 : 0.95 };
  });
}
const RARITY = [null, "#6aa8ff", "#ffd84a", "#ff8a30"];

/**
 * Draw a person and the weapon in their hand. Attacks are not frames: the
 * weapon sprite is turned about its grip — swept through an arc, thrust, or
 * levelled and kicked back.
 */
function drawPerson(s, e, t, dt, x, y) {
  const back = e.dir === 3;
  if (e.dir === 1) s.face = -1; else if (e.dir === 2) s.face = 1;
  if (e.moving) s.walk += dt * 9;
  const atk = (t - e.atkT) / 1000;
  if (e.aim && atk < 0.5) s.face = e.aim[0] < e.x ? -1 : 1;
  const frame = e.dead ? 0 : e.moving ? 1 + (Math.floor(s.walk) % 2) : 0;
  const img = (back ? s.sheet.back : s.sheet.front)[frame];
  const sg = s.face;
  g.fillStyle = "rgba(20,24,50,.26)";
  g.beginPath(); g.ellipse(x, y, 6, 2.5, 0, 0, 7); g.fill();
  const body = () => {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (e.dead) { g.rotate(sg * 1.45); g.globalAlpha = 0.6; }
    g.scale(sg, 1);
    g.drawImage(img, -SP.FOOT[0], -SP.FOOT[1]);
    g.restore();
  };
  if (!s.weapon || e.dead) return body();
  const hold = SP.HOLD[s.cls];
  // angles here are canvas angles: 0 points right, positive turns clockwise
  const rest = sg > 0 ? -hold.rest * DEG : Math.PI + hold.rest * DEG;
  const aim = e.aim && atk < 0.6 ? Math.atan2(e.aim[1] - e.y, e.aim[0] - e.x) : sg > 0 ? 0.25 : Math.PI - 0.25;
  if (s.ang === null) s.ang = rest;
  const k = atk / hold.time;
  let push = 0;
  if (k < 1) {
    const ease = k * k * (3 - 2 * k);
    if (hold.style === "sweep") { const half = (hold.arc / 2) * DEG * sg; s.ang = aim - half + 2 * half * ease; push = 3; }
    else if (hold.style === "stab") { s.ang = aim; push = Math.sin(k * Math.PI) * 9; }
    else if (hold.style === "shoot") { s.ang = aim - sg * 0.3 * (1 - ease); push = -Math.sin(k * Math.PI) * 3; }
    else { s.ang = aim - sg * hold.arc * DEG * (1 - ease); push = 4; }
  } else {
    const want = hold.style === "shoot" ? (sg > 0 ? 0.2 : Math.PI - 0.2) : rest;
    let d = want - s.ang;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    s.ang += d * Math.min(1, dt * 12);
  }
  const resting = k >= 1;
  // with no arms, the weapon simply floats at the body's side
  const hx = x + sg * (hold.style === "sweep" && resting ? 3 : 8) + Math.cos(s.ang) * push;
  const hy = y - (hold.style === "sweep" && resting ? 7 : 5) + Math.sin(s.ang) * push + (frame === 1 ? -1 : 0);
  const weapon = () => {
    g.save();
    g.translate(Math.round(hx), Math.round(hy));
    g.rotate(s.ang);
    if (Math.cos(s.ang) < 0) g.scale(1, -1);
    const glow = RARITY[s.gear.wq | 0] || (s.gear.we >= 7 ? "#ffffff" : null);
    if (glow) { g.shadowColor = glow; g.shadowBlur = s.gear.we >= 7 ? 9 : 5; }
    g.drawImage(s.weapon, -SP.GRIP[0], -SP.GRIP[1]);
    g.restore();
  };
  // a slung greatsword sits behind the body; everything else is held in front
  const behind = resting ? (hold.style === "sweep") !== back : Math.sin(s.ang) < -0.2;
  if (behind) { weapon(); body(); } else { body(); weapon(); }
}

// ───────────────────────────── effects ─────────────────────────────

const parts = [];
export const fx = {
  list: [],
  clear() { this.list.length = 0; parts.length = 0; },
  add(o) { o.t0 = performance.now() + (o.delay || 0); this.list.push(o); },
  ring(wx, wy, r, color, dur = 300, filled = false, delay = 0) { this.add({ k: "ring", x: wx * P, y: wy * P, r: r * P, color, dur, filled, delay }); },
  tele(wx, wy, r, ms) { this.add({ k: "tele", x: wx * P, y: wy * P, r: r * P, dur: ms }); },
  proj(ax, ay, ah, bx, by, bh, color, size, speed, done) {
    const x0 = ax * P, y0 = ay * P - ah * 22, x1 = bx * P, y1 = by * P - bh * 22;
    this.add({ k: "proj", x0, y0, x1, y1, color, size: Math.max(2, Math.round(size * 44)), dur: Math.max(70, (Math.hypot(x1 - x0, y1 - y0) / (speed * 26)) * 1000), done });
  },
  /** A blade's crescent, centred on the attacker and opening toward `ang`. */
  slash(wx, wy, ang, color, size = 0.8) { this.add({ k: "slash", x: wx * P, y: wy * P - 8, ang, color, r: size * 34, dur: 200 }); },
  beam(ax, ay, bx, by, color, h = 0.6) { this.add({ k: "beam", x0: ax * P, y0: ay * P - h * 22, x1: bx * P, y1: by * P - h * 22, color, dur: 260 }); },
  pillar(wx, wy) { this.add({ k: "pillar", x: wx * P, y: wy * P, dur: 900 }); this.sparkle(wx, wy, 0.5, "#ffd84a", 24); },
  burst(wx, wy, h, color, n = 8, speed = 1.4) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = speed * 34 * (0.3 + Math.random() * 0.7); parts.push({ x: wx * P, y: wy * P - h * 22, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.25 + Math.random() * 0.3, color, g: 220 }); } },
  sparkle(wx, wy, h, color, n = 10) { for (let i = 0; i < n; i++) parts.push({ x: wx * P + Math.random() * 28 - 14, y: wy * P - h * 22 + Math.random() * 18 - 6, vx: 0, vy: -26 - Math.random() * 34, life: 0.4 + Math.random() * 0.5, color, g: 0 }); },
  flash() {},
};
export function shake(n) { shakeAmt = Math.max(shakeAmt, n); }

function drawFx(now, ground2) {
  for (let i = fx.list.length - 1; i >= 0; i--) {
    const f = fx.list[i], k = (now - f.t0) / f.dur;
    if (k < 0) continue;
    if (k >= 1) { fx.list.splice(i, 1); if (f.done) f.done(); continue; }
    const flat = f.k === "ring" || f.k === "tele";
    if (flat !== ground2) continue;
    if (f.k === "ring") {
      g.globalAlpha = 1 - k;
      if (f.filled) { g.fillStyle = f.color; g.globalAlpha = (1 - k) * 0.35; g.beginPath(); g.ellipse(f.x, f.y, f.r * k, f.r * k * 0.86, 0, 0, 7); g.fill(); g.globalAlpha = 1 - k; }
      g.strokeStyle = f.color; g.lineWidth = 3;
      g.beginPath(); g.ellipse(f.x, f.y, f.r * k, f.r * k * 0.86, 0, 0, 7); g.stroke();
    } else if (f.k === "tele") {
      g.fillStyle = `rgba(255,60,120,${0.16 + 0.16 * Math.abs(Math.sin(now / 70))})`;
      g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.86, 0, 0, 7); g.fill();
      g.strokeStyle = "#ff6ad0"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(f.x, f.y, f.r * k, f.r * k * 0.86, 0, 0, 7); g.stroke();
    } else if (f.k === "slash") {
      // a tapered crescent that sweeps open and fades
      const a0 = f.ang - 1.25, a1 = f.ang - 1.25 + 2.5 * Math.min(1, k * 1.8), n = 14;
      g.globalAlpha = k < 0.5 ? 1 : 2 - 2 * k;
      g.fillStyle = f.color;
      g.beginPath();
      for (let j = 0; j <= n; j++) { const a = a0 + ((a1 - a0) * j) / n; g.lineTo(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r); }
      for (let j = n; j >= 0; j--) { const a = a0 + ((a1 - a0) * j) / n, w = f.r * (1 - 0.34 * Math.sin((j / n) * Math.PI)); g.lineTo(f.x + Math.cos(a) * w, f.y + Math.sin(a) * w); }
      g.closePath(); g.fill();
    } else if (f.k === "proj") {
      const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k;
      g.fillStyle = f.color; g.fillRect(Math.round(x - f.size / 2), Math.round(y - f.size / 2), f.size, f.size);
      g.fillStyle = "#ffffff"; g.fillRect(Math.round(x - f.size / 4), Math.round(y - f.size / 4), Math.ceil(f.size / 2), Math.ceil(f.size / 2));
      if (Math.random() < 0.7) parts.push({ x, y, vx: 0, vy: 0, life: 0.18, color: f.color, g: 0 });
    } else if (f.k === "beam") {
      g.globalAlpha = 1 - k; g.strokeStyle = f.color; g.lineWidth = 6; g.beginPath(); g.moveTo(f.x0, f.y0); g.lineTo(f.x1, f.y1); g.stroke();
      g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.beginPath(); g.moveTo(f.x0, f.y0); g.lineTo(f.x1, f.y1); g.stroke();
    } else if (f.k === "pillar") {
      g.globalAlpha = (1 - k) * 0.6; g.fillStyle = "#fff0a0"; g.fillRect(f.x - 14, f.y - 120, 28, 124); g.fillStyle = "#ffffff"; g.fillRect(f.x - 6, f.y - 120, 12, 124);
    }
    g.globalAlpha = 1; g.lineWidth = 1;
  }
}

// ───────────────────────────── the frame ─────────────────────────────

/** How dark each world is, and the colour of its darkness. */
const DARK = { forest: ["#06242a", 0.3], city: ["#0a0e30", 0.56], cave: ["#060a22", 0.5] };
let lightCv = null, lg = null;

export function sync(state2) { G = state2; }

export function render(focusX, focusY, dt, t, snap) {
  if (!map || !ground || !G) return;
  const mw = map.w * T, mh = map.h * T;
  const tx = mw > vw ? clamp(focusX * P - vw / 2, 0, mw - vw) : (mw - vw) / 2;
  const ty = mh > vh ? clamp(focusY * P - 16 - vh / 2, 0, mh - vh) : (mh - vh) / 2;
  if (snap) { cam.x = tx; cam.y = ty; } else { cam.x += (tx - cam.x) * Math.min(1, dt * 10); cam.y += (ty - cam.y) * Math.min(1, dt * 10); }
  shakeAmt = Math.max(0, shakeAmt - dt * 18);
  const ox = Math.round(cam.x + (Math.random() - 0.5) * shakeAmt), oy = Math.round(cam.y + (Math.random() - 0.5) * shakeAmt);
  const now = performance.now();

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#101426";
  g.fillRect(0, 0, vw, vh);
  g.translate(-ox, -oy);
  g.drawImage(ground, 0, 0);

  // gates
  for (const p of map.portals) {
    const px = p.x * T + 16, py = p.y * T + 18;
    for (let i = 0; i < 3; i++) { const ph = (t / 700 + i / 3) % 1; g.strokeStyle = `rgba(${i % 2 ? "170,225,255" : "205,160,255"},${1 - ph})`; g.lineWidth = 2; g.beginPath(); g.ellipse(px, py, 6 + ph * 16, 4 + ph * 10, 0, 0, 7); g.stroke(); }
    if (Math.random() < 0.2) parts.push({ x: px + Math.random() * 24 - 12, y: py, vx: 0, vy: -40, life: 0.6, color: "#d6b8ff", g: 0 });
  }
  g.lineWidth = 1;
  drawFx(now, true);

  // everything that stands up, sorted by its feet
  const list = [];
  const x0 = ox - 80, x1 = ox + vw + 80, y0 = oy - 20, y1 = oy + vh + 220;
  for (const s of statics) if (s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1) list.push({ y: s.y, s });
  for (const n of npcs) list.push({ y: n.y, n });
  for (const d of G.drops.values()) list.push({ y: d.y * P - 2, d });
  for (const m of G.mobs.values()) list.push({ y: m.y * P, m });
  for (const [eid, p] of G.players) list.push({ y: p.y * P, p, eid });
  list.push({ y: G.me.y * P, p: G.me, eid: G.you });
  list.sort((a, b) => a.y - b.y);
  for (const s of ents.values()) s.seen = false;

  const meX = G.me.x * P, meY = G.me.y * P;
  for (const o of list) {
    if (o.s) {
      const sp = o.s.sp, dx = Math.round(o.s.x - sp.width / 2), dy = Math.round(o.s.y - sp.height + 2);
      // tall things in front of you turn translucent
      const hides = sp.height > 60 && o.s.y > meY && meX > dx + 6 && meX < dx + sp.width - 6 && meY - 20 > dy;
      if (hides) g.globalAlpha = 0.42;
      g.drawImage(sp, dx, dy);
      g.globalAlpha = 1;
    } else if (o.n) {
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(o.n.x, o.n.y, 6, 2.5, 0, 0, 7); g.fill();
      g.drawImage(o.n.sheet.front[0], Math.round(o.n.x - SP.FOOT[0]), Math.round(o.n.y - SP.FOOT[1] + Math.sin(t / 600 + o.n.x) * 0.6));
    } else if (o.d) {
      const d = o.d, x = d.x * P, y = d.y * P, ic = G.icons.cv[d.it];
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(x, y, 8, 3, 0, 0, 7); g.fill();
      if (d.q) { g.fillStyle = RARITY[d.q]; g.globalAlpha = 0.3 + 0.15 * Math.sin(t / 180 + d.id); g.fillRect(x - 2, y - 26 - d.q * 16, 4, d.q * 16 + 22); g.globalAlpha = 1; }
      if (ic) g.drawImage(ic, Math.round(x - 8), Math.round(y - 18 + Math.sin(t / 220 + d.id) * 2), 16, 16);
    } else if (o.m) {
      const m = o.m, kind = G.defs.mobs[m.k].sp, x = m.x * P, y = m.y * P;
      if (kind === "thug" || kind === "skel") {
        const s = state("m" + m.id, kind, () => ({ cls: kind === "thug" ? "rogue" : "warrior", sheet: SP.personSheet(SP.mobLook(kind)), weapon: SP.weaponSprite(kind === "thug" ? "rogue" : "warrior", { wt: kind === "thug" ? 2 : 3 }), gear: {}, h: 0.95, px: m.x }));
        const dir = m.x < s.px - 0.05 ? 1 : m.x > s.px + 0.05 ? 2 : s.face < 0 ? 1 : 2;
        s.px = m.x;
        drawPerson(s, { x: m.x, y: m.y, dir, moving: m.moving, atkT: m.atkT, dead: false, aim: null }, t, dt, x, y);
        m.h3 = 0.95;
      } else {
        const s = state("m" + m.id, kind, () => ({ frames: SP.monsterSheet(kind), size: (SP.MOB_SIZE[kind] || [1, 0])[0], hover: (SP.MOB_SIZE[kind] || [1, 0])[1], px: m.x }));
        if (m.x > s.px + 0.05) s.face = -1; else if (m.x < s.px - 0.05) s.face = 1;
        s.px = m.x;
        const img = s.frames[Math.floor(t / (m.moving ? 180 : 360) + m.id) % 2], w = SP.SIZE * s.size;
        const a = t - m.atkT, lunge = a < 220 ? Math.sin((a / 220) * Math.PI) * 8 * -s.face : 0;
        g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(x, y, w * 0.26, w * 0.1, 0, 0, 7); g.fill();
        if (m.el) { g.strokeStyle = `rgba(255,190,60,${0.6 + 0.3 * Math.sin(t / 160)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, w * 0.34, w * 0.14, 0, 0, 7); g.stroke(); g.lineWidth = 1; }
        g.save();
        g.translate(Math.round(x + lunge), Math.round(y - s.hover - (s.hover ? Math.sin(t / 320 + m.id) * 3 : 0)));
        g.scale(s.face, 1);
        if (t - m.hurtT < 110) g.filter = "brightness(2.2)";
        g.drawImage(img, -w / 2, -w * (SP.FOOT[1] / SP.SIZE), w, w);
        g.restore();
        m.h3 = (w * 0.8 + s.hover) / 26;
      }
    } else if (o.p) {
      const w = G.who.get(o.eid);
      if (!w) continue;
      const s = personState(o.eid, playerLook(w.cls, w.look, w.gear));
      drawPerson(s, o.p, t, dt, o.p.x * P, o.p.y * P);
      o.p.h3 = s.h;
    }
  }
  for (const [id, s] of ents) if (!s.seen) ents.delete(id);

  drawFx(now, false);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    g.globalAlpha = clamp(p.life * 3, 0, 1); g.fillStyle = p.color; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
  }
  g.globalAlpha = 1;

  // darkness, with pools of light cut out of it
  const dark = DARK[map.id];
  if (dark) {
    if (!lightCv) [lightCv, lg] = sheet(vw, vh);
    if (lightCv.width !== vw || lightCv.height !== vh) { lightCv.width = vw; lightCv.height = vh; }
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, vw, vh);
    lg.globalAlpha = dark[1]; lg.fillStyle = dark[0]; lg.fillRect(0, 0, vw, vh); lg.globalAlpha = 1;
    lg.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, k = 1) => { const sx = x - ox, sy = y - oy; if (sx < -r || sy < -r || sx > vw + r || sy > vh + r) return; const gr = lg.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, "rgba(0,0,0,0)"); lg.fillStyle = gr; lg.fillRect(sx - r, sy - r, r * 2, r * 2); };
    hole(meX, meY - 12, 130, 0.9);
    for (const o of list) { if (o.p && o.eid !== G.you) hole(o.p.x * P, o.p.y * P - 20, 110, 0.8); else if (o.s && o.s.glow) hole(o.s.x, o.s.y - (o.s.big ? 60 : o.s.sp.height - 12), o.s.big ? 120 : o.s.glow === "#ffe690" ? 110 : 60, 0.85); else if (o.d && o.d.q) hole(o.d.x * P, o.d.y * P - 10, 36, 0.7); }
    for (const p of map.portals) hole(p.x * T + 16, p.y * T + 16, 80, 0.8);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(lightCv, 0, 0);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  cam.ox = ox; cam.oy = oy;
}

/** Where a point of the world lands on screen (CSS pixels). `h` lifts it, in tiles. */
export function project(wx, wy, h = 0) {
  return [(wx * P - (cam.ox ?? cam.x)) * Z, (wy * P - h * 26 - (cam.oy ?? cam.y)) * Z];
}
/** The ground point under a screen position, in server units. */
export function pick(clientX, clientY) {
  return [(clientX / Z + (cam.ox ?? cam.x)) / P, (clientY / Z + (cam.oy ?? cam.y)) / P];
}

// ───────────────────────────── title and creation ─────────────────────────────

let stage = null;
export function showcase(draft) {
  const cast = draft ? [draft] : [playerLook("warrior", [1, 0, 0, 0, 0, 0, 1], { wt: 3 }), playerLook("mage", [0, 2, 1, 3, 0, 0, 4], { wt: 3 }), playerLook("ranger", [3, 1, 2, 7, 2, 3, 3], { wt: 3 }), playerLook("rogue", [2, 4, 3, 8, 3, 0, 0], { wt: 2 })];
  stage = { draft: !!draft, cast: cast.map((look, i) => ({ s: (() => { const cls = look.cls; return { key: "", face: 1, walk: 0, ang: null, cls, sheet: SP.personSheet(SP.playerLook(cls, look.look, look.gear)), weapon: SP.weaponSprite(cls, look.gear), gear: look.gear || {} }; })(), i })) };
  map = null;
}
export function leaveStage() { stage = null; }
export function renderStage(dt, t) {
  if (!cv || !stage) return;
  const S = scenery();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#62b05c"; g.fillRect(0, 0, vw, vh);
  // a strip of meadow scrolling past
  const scroll = stage.draft ? 0 : (t / 28) % 64;
  for (let x = -64; x < vw + 64; x += 32) for (let y = 0; y < vh; y += 32) {
    const hx = Math.floor((x + scroll) / 32) + (stage.draft ? 0 : Math.floor(t / 28 / 64) * 2), h = hash(hx, y, 1);
    g.fillStyle = "#54a050"; const px = x - (stage.draft ? 0 : scroll % 32);
    g.fillRect(px + 4 + h * 20, y + 6 + hash(hx, y, 2) * 18, 2, 4); g.fillRect(px + 7 + h * 20, y + 7 + hash(hx, y, 2) * 18, 2, 3);
  }
  const gy = Math.round(vh * 0.62);
  g.fillStyle = "#c89c64"; g.fillRect(0, gy - 6, vw, 30); g.fillStyle = "#946e40"; g.fillRect(0, gy - 6, vw, 2); g.fillRect(0, gy + 22, vw, 2);
  if (!stage.draft) for (let i = 0; i < Math.ceil(vw / 150) + 2; i++) { const x = ((i * 150 - (t / 28) % 150) + 150) % (vw + 150) - 60, sp = i % 2 ? S.T : S.P; g.drawImage(sp, Math.round(x), gy - 20 - sp.height); g.drawImage(S.B, Math.round(x + 70), gy + 40); }
  const cx = Math.round(vw / 2);
  stage.cast.forEach(({ s, i }) => {
    if (stage.draft) {
      const k = (t % 3200) / 1000, dir = [2, 1, 3, 2][Math.floor(t / 3200) % 4], z = 7;
      g.save(); g.translate(cx + Math.min(120, vw * 0.18), gy + 34); g.scale(z, z);
      drawPerson(s, { x: 0, y: 0, dir, moving: k > 1 && k < 2.2, atkT: k > 2.5 ? t - (k - 2.5) * 1000 : -1e9, dead: false, aim: k > 2.5 ? [dir === 1 ? -40 : 40, 6] : null }, t, dt, 0, 0);
      g.restore();
    } else drawPerson(s, { x: 0, y: 0, dir: 2, moving: true, atkT: -1e9, dead: false, aim: null }, t, dt, cx - 66 + i * 44, gy + 12);
  });
}
