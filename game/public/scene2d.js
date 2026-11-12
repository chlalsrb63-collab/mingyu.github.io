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
/** `t` of the way from colour `a` to colour `b` — used to lean shadows toward a hue. */
function tone(a, b, t) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

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
/** Harden edges and ink a one-pixel outline around whatever was drawn. */
function ink(c, x, col = INK, passes = 1) {
  const w = c.width, h = c.height;
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  x.putImageData(img, 0, 0);
  for (let pass = 0; pass < passes; pass++) {
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
const WOOD = "#8a5a34", WOOD_D = "#6a4226";
let SC = null;
function scenery() {
  if (SC) return SC;

  // A broad-leaf tree: a dark mass, a lit mass on the upper left, a highlight, and loose leaves.
  const tree = (leaf, fruit) => prop(48, 62, (b) => {
    const d = tone(leaf, "#143a4a", 0.42), l = lt(leaf, 1.16), hl = lt(leaf, 1.36);
    b.r(20, 42, 8, 18, WOOD); b.r(18, 58, 12, 3, WOOD); b.r(25, 42, 3, 19, WOOD_D); b.r(21, 47, 2, 3, WOOD_D); b.r(17, 60, 3, 1, WOOD_D);
    b.oval(24, 25, 23, 20, d); b.oval(7, 31, 6, 6, d); b.oval(41, 31, 6, 6, d); b.oval(25, 7, 10, 6, d); b.oval(38, 14, 7, 7, d);
    b.oval(21, 22, 19, 16, leaf); b.oval(8, 28, 5, 5, leaf); b.oval(24, 7, 8, 4, leaf); b.oval(35, 16, 6, 6, leaf);
    b.oval(16, 15, 11, 8, l); b.oval(13, 11, 6, 4, hl);
    for (const [x, y] of [[29, 13], [33, 25], [9, 22], [21, 30], [14, 35], [27, 35]]) b.r(x, y, 3, 2, d);
    for (const [x, y] of [[31, 38], [37, 31], [19, 40], [40, 24]]) b.r(x, y, 3, 2, leaf);
    for (const [x, y] of [[8, 17], [21, 6], [17, 20]]) b.r(x, y, 2, 1, hl);
    if (fruit) for (const [x, y] of [[13, 23], [26, 17], [32, 29], [20, 33], [37, 20], [8, 30]]) { b.r(x, y, 3, 3, fruit); b.r(x, y, 1, 1, lt(fruit, 1.5)); }
  });
  const pine = (tall) => prop(40, 68, (b) => {
    b.r(17, 54, 6, 12, "#7a5030"); b.r(21, 54, 2, 12, "#5e3c22"); b.r(15, 65, 10, 2, "#7a5030");
    const tiers = tall ? [[36, 19, 20], [22, 15, 19], [8, 11, 18], [0, 6, 11]] : [[38, 18, 18], [25, 14, 17], [12, 9, 16]];
    for (const [y, w, h] of tiers) {
      for (let x = 20 - w; x < 20 + w; x += 6) b.tri([[x, y + h], [x + 6, y + h], [x + 3, y + h + 4]], x < 17 ? "#3f8c64" : "#2a6a50");
      b.tri([[20 - w, y + h], [20 + w, y + h], [20, y]], "#2a6a50");
      b.tri([[20 - w, y + h], [20, y + h], [20, y]], "#3f8c64");
      b.r(20 - w * 0.55, y + h * 0.6, 4, 2, "#5cae7c"); b.r(18, y + h * 0.35, 2, 2, "#5cae7c"); b.r(22 + w * 0.2, y + h * 0.7, 4, 2, "#1f5440");
    }
  });
  const bush = (v) => prop(30, 22, (b) => {
    const leaf = "#4faa5a", d = tone(leaf, "#143a4a", 0.42);
    b.oval(15, 13, 14, 9, d); b.oval(13, 11, 12, 8, leaf); b.oval(21, 10, 7, 6, leaf); b.oval(10, 8, 7, 4, lt(leaf, 1.16)); b.oval(8, 6, 3, 2, lt(leaf, 1.36));
    b.r(14, 15, 3, 2, d); b.r(21, 13, 3, 2, d); b.r(6, 14, 2, 1, d);
    const dot = [null, "#f06a7a", "#fffbe8"][v];
    if (dot) for (const [x, y] of [[6, 12], [15, 8], [23, 9], [12, 16], [20, 15]]) { b.r(x, y, 2, 2, dot); if (v === 2) b.r(x, y, 1, 1, "#f0c040"); }
  });
  const rock = (moss) => prop(30, 24, (b) => {
    b.tri([[3, 23], [1, 13], [8, 4], [19, 2], [27, 9], [29, 20], [24, 23]], "#8f93a3");
    b.tri([[8, 5], [19, 3], [25, 9], [14, 12], [5, 12]], "#b4b8c6");
    b.tri([[14, 12], [25, 9], [29, 20], [24, 23], [12, 23]], "#7a7e90");
    b.r(10, 5, 6, 1, "#d8dce8"); b.r(17, 13, 1, 2, "#5e6274"); b.r(18, 15, 1, 2, "#5e6274"); b.r(17, 17, 1, 2, "#5e6274"); b.r(8, 15, 2, 1, "#a0a4b4"); b.r(4, 21, 20, 2, "#6a6e80");
    if (moss) { b.oval(10, 6, 6, 2.6, "#6ab85a"); b.r(17, 4, 6, 2, "#6ab85a"); b.r(5, 10, 3, 2, "#4faa5a"); }
  });
  const shard = (b, x, y, w, h, c) => {
    b.tri([[x, y + h], [x + w, y + h], [x + w, y + 7], [x + w / 2, y], [x, y + 7]], c);
    b.tri([[x + w / 2, y + h], [x + w, y + h], [x + w, y + 7], [x + w / 2, y]], tone(c, "#2a2a7a", 0.34));
    b.r(x + 1, y + 8, 1, h - 12, "#ffffff"); b.r(x + 2, y + 6, 1, 3, lt(c, 1.5));
  };
  const crystal = (c) => prop(32, 44, (b) => {
    shard(b, 2, 18, 9, 24, c); shard(b, 10, 2, 12, 40, c); shard(b, 21, 21, 9, 21, c);
    b.r(0, 39, 9, 5, "#3a4a6c"); b.r(7, 41, 20, 3, "#2e3c5c"); b.r(24, 40, 8, 4, "#3a4a6c");
  });
  const house = (v) => prop(132, 138, (b) => {
    const roof = ROOF[v % 4], wall = "#f6ecd2", beam = WOOD;
    // walls on a stone footing, framed in timber
    b.r(8, 70, 116, 66, wall); b.r(8, 73, 116, 4, "#dccdac");
    b.r(8, 124, 116, 12, "#b8b0a4"); b.r(8, 124, 116, 1, "#d6cec2");
    for (let x = 8; x < 124; x += 14) b.r(x + (x % 28 ? 5 : 0), 128, 1, 8, "#958d82");
    b.r(8, 130, 116, 1, "#958d82");
    for (const x of [8, 44, 85, 121]) b.r(x, 70, 3, 54, beam);
    b.r(8, 98, 36, 2, beam); b.r(88, 98, 36, 2, beam);
    // door, step and a sign for the trade inside
    b.r(54, 94, 24, 42, beam); b.r(57, 97, 18, 39, "#b27a44"); b.r(57, 97, 18, 3, "#c8935a"); b.r(65, 97, 2, 39, "#96623a"); b.r(71, 116, 3, 3, "#f0cc60");
    b.r(50, 134, 32, 3, "#d6cec2");
    b.r(57, 80, 18, 12, "#f2e0b0"); b.r(57, 80, 18, 1, beam); b.r(57, 91, 18, 1, beam); b.r(57, 80, 1, 12, beam); b.r(74, 80, 1, 12, beam);
    if (v % 4 === 0) { b.r(64, 85, 5, 5, "#f078a8"); b.r(65, 82, 3, 3, "#d8f0ff"); b.r(65, 82, 3, 1, "#8a5a34"); }
    else if (v % 4 === 1) { b.r(61, 84, 10, 3, "#7a8294"); b.r(64, 87, 4, 2, "#7a8294"); b.r(62, 89, 8, 1, "#5a6070"); }
    else if (v % 4 === 2) { b.r(65, 82, 2, 8, "#f0b030"); b.r(62, 85, 8, 2, "#f0b030"); b.r(64, 84, 4, 4, "#f0b030"); }
    else { b.r(62, 83, 6, 6, "#8ab4f0"); b.r(65, 83, 4, 4, "#f2e0b0"); }
    // windows with shutters and flower boxes
    for (const x of [18, 94]) {
      b.r(x - 4, 82, 4, 16, roof); b.r(x + 20, 82, 4, 16, roof); b.r(x - 3, 86, 2, 1, dk(roof)); b.r(x + 21, 86, 2, 1, dk(roof)); b.r(x - 3, 92, 2, 1, dk(roof)); b.r(x + 21, 92, 2, 1, dk(roof));
      b.r(x, 80, 20, 20, beam); b.r(x + 2, 82, 16, 16, "#bfe6f4"); b.r(x + 2, 82, 16, 5, "#dff4fc"); b.r(x + 9, 82, 2, 16, beam); b.r(x + 2, 89, 16, 2, beam);
      b.r(x - 2, 100, 24, 5, "#b8844e"); b.r(x - 2, 104, 24, 1, WOOD_D);
      for (let i = 0; i < 5; i++) { b.r(x + i * 5, 97, 2, 3, "#4faa5a"); b.r(x - 1 + i * 5, 95, 3, 3, ["#f06a7a", "#fffbe8", "#f0c040"][(i + v) % 3]); }
    }
    // roof: rows of shingles, a pale ridge, a dark eave
    b.tri([[2, 72], [130, 72], [112, 14], [20, 14]], roof);
    for (let y = 22, k = 0; y < 68; y += 9, k++) {
      const half = 46 + (y - 14) * 0.31;
      b.r(66 - half, y, half * 2, 1, dk(roof, 0.8));
      for (let x = 66 - half + (k % 2 ? 5 : 0); x < 66 + half - 2; x += 10) b.r(x, y + 1, 1, 4, dk(roof, 0.8));
    }
    b.tri([[2, 72], [130, 72], [127, 63], [5, 63]], dk(roof, 0.82)); b.r(2, 71, 128, 2, dk(roof, 0.66));
    b.r(20, 12, 92, 4, lt(roof, 1.25)); b.r(20, 15, 92, 1, dk(roof, 0.8));
    b.tri([[20, 14], [26, 14], [10, 44], [6, 56]], lt(roof, 1.12));
    // chimney
    b.r(89, 0, 16, 24, "#b8a898"); b.r(87, 0, 20, 4, "#8a7e72"); b.r(100, 4, 5, 20, "#9c8e80");
    for (let y = 8; y < 22; y += 5) b.r(89, y, 16, 1, "#9c8e80");
  });
  const building = (v) => prop(132, 208, (b) => {
    const wall = ["#6c7284", "#7c665a", "#5c687c", "#6c5c80"][v % 4], neon = NEON[v % 4];
    b.r(4, 12, 124, 196, wall); b.r(4, 12, 4, 196, lt(wall, 1.14)); b.r(120, 12, 8, 196, dk(wall, 0.84));
    for (let y = 44; y < 140; y += 24) b.r(8, y, 112, 1, dk(wall, 0.86));
    b.r(0, 6, 132, 8, "#2e3240"); b.r(0, 6, 132, 2, "#4a5064");
    b.r(86, 0, 26, 8, "#565e72"); b.r(86, 0, 26, 2, "#7a8298"); b.r(22, 0, 2, 7, "#2e3240"); b.r(18, 2, 10, 1, "#2e3240");
    for (let r = 0; r < 5; r++) for (let i = 0; i < 5; i++) {
      const on = hash(i, r, v + 3) > 0.42, x = 13 + i * 22, y = 22 + r * 24;
      b.r(x, y, 16, 17, "#20232c");
      b.r(x + 2, y + 2, 12, 12, on ? (hash(i, r, v + 9) > 0.5 ? "#ffd880" : "#a8e4ff") : "#30364a");
      if (on) { b.r(x + 2, y + 2, 12, 3, "#fff4d0"); b.r(x + 7, y + 2, 2, 12, "#20232c"); } else b.r(x + 3, y + 3, 4, 2, "#48506a");
      b.r(x - 1, y + 16, 18, 2, lt(wall, 1.2));
      if (hash(i, r, v + 21) > 0.8) { b.r(x + 3, y + 17, 10, 5, "#8a90a0"); b.r(x + 4, y + 18, 8, 1, "#5a6070"); b.r(x + 4, y + 20, 8, 1, "#5a6070"); }
    }
    // shop front: a neon sign, a striped awning, a shutter and two display windows
    b.r(10, 146, 112, 14, "#181a22"); b.r(14, 149, 30, 8, neon); b.r(50, 149, 10, 8, neon); b.r(66, 149, 26, 8, neon); b.r(98, 149, 18, 8, neon);
    b.r(14, 149, 102, 2, lt(neon, 1.5));
    for (let x = 8; x < 124; x += 8) b.r(x, 162, 8, 6, (x >> 3) % 2 ? "#f4f4f8" : neon);
    b.r(8, 168, 116, 1, "#181a22");
    b.r(46, 170, 40, 38, "#262a36"); for (let y = 174; y < 206; y += 5) b.r(49, y, 34, 2, "#444a5a");
    for (const x of [10, 94]) { b.r(x, 172, 28, 26, "#20232c"); b.r(x + 2, 174, 24, 22, "#3a5a7a"); b.r(x + 2, 174, 24, 6, "#58789a"); b.r(x + 4, 186, 6, 10, neon); b.r(x + 14, 190, 8, 6, "#f4f4f8"); }
    b.r(4, 200, 124, 8, dk(wall, 0.7));
  });
  const car = (col) => prop(62, 32, (b) => {
    b.r(2, 13, 58, 13, col); b.r(0, 16, 62, 8, col); b.r(13, 2, 32, 12, col); b.r(11, 5, 36, 9, col);
    b.r(0, 22, 62, 3, dk(col, 0.76)); b.r(2, 13, 58, 1, lt(col, 1.3)); b.r(13, 2, 32, 1, lt(col, 1.3));
    b.r(15, 4, 13, 9, "#2a3442"); b.r(30, 4, 13, 9, "#2a3442"); b.r(15, 4, 13, 2, "#7aa0c0"); b.r(30, 4, 13, 2, "#7aa0c0"); b.r(17, 7, 3, 4, "#4a6480");
    b.r(29, 14, 1, 9, dk(col, 0.7)); b.r(33, 16, 4, 1, dk(col, 0.6));
    b.r(57, 16, 5, 4, "#ffe8a0"); b.r(0, 16, 3, 4, "#ff5050"); b.r(0, 24, 62, 2, "#3a3e4a");
    for (const x of [14, 47]) { b.oval(x, 26, 6, 5.4, "#22242c"); b.oval(x, 26, 3, 2.6, "#8a8e9c"); b.r(x - 1, 25, 2, 2, "#c8ccd8"); }
  });
  SC = {
    T: [tree("#4faa5a"), tree("#58b05a", "#e8584a"), tree("#7abf52"), tree("#f4a8c4")],
    P: [pine(true), pine(false)],
    B: [bush(0), bush(1), bush(2)],
    R: [rock(false), rock(true)],
    // what stands where a bush would, in town: a planter, a barrel, a pair of crates
    TB: [
      prop(30, 22, (b) => { b.r(1, 10, 28, 11, "#b8844e"); b.r(1, 10, 28, 2, "#d8a868"); b.r(1, 19, 28, 2, WOOD_D); for (const x of [9, 19]) b.r(x, 12, 1, 7, WOOD_D); b.r(2, 8, 26, 2, "#5a4030"); for (let i = 0; i < 6; i++) { b.r(4 + i * 4, 4, 2, 4, "#4faa5a"); b.r(3 + i * 4, 1 + (i % 2), 4, 4, ["#f06a7a", "#fffbe8", "#f0c040", "#b48cff"][i % 4]); b.r(4 + i * 4, 2 + (i % 2), 2, 2, "#fff2c0"); } }),
      prop(22, 26, (b) => { b.r(3, 3, 16, 22, "#a8743e"); b.r(2, 6, 18, 16, "#a8743e"); b.r(15, 4, 4, 20, "#8a5a34"); b.r(6, 8, 2, 12, "#c8935a"); b.r(2, 7, 18, 2, "#5a5e6c"); b.r(2, 18, 18, 2, "#5a5e6c"); b.oval(11, 4, 8, 3, "#c8935a"); b.oval(11, 4, 5, 1.6, "#a8743e"); }),
      prop(30, 28, (b) => { const box = (x, y, w, h) => { b.r(x, y, w, h, "#c89a5e"); b.r(x, y, w, 2, "#e0b87a"); b.r(x, y + h - 2, w, 2, "#a8743e"); b.r(x, y, 2, h, "#a8743e"); b.r(x + w - 2, y, 2, h, "#96623a"); for (let i = 0; i < w - 4; i++) b.r(x + 2 + i, y + 2 + Math.round((i * (h - 5)) / (w - 5)), 1, 1, "#a8743e"); }; box(1, 9, 20, 19); box(14, 0, 15, 13); }),
    ],
    F: prop(32, 24, (b) => { for (const y of [7, 15]) { b.r(0, y, 32, 4, "#d8ac6e"); b.r(0, y + 3, 32, 1, "#b0844c"); b.r(0, y, 32, 1, "#ecc88c"); } for (const x of [5, 21]) { b.r(x, 2, 6, 22, "#e6c088"); b.r(x + 4, 3, 2, 21, "#b88a52"); b.r(x - 1, 0, 8, 3, "#f2d8a4"); } }),
    L: prop(18, 56, (b) => { b.r(8, 18, 2, 34, "#4a4c5a"); b.r(5, 50, 8, 4, "#4a4c5a"); b.r(3, 54, 12, 2, "#3a3c48"); b.r(3, 4, 12, 13, "#3a3c48"); b.r(5, 6, 8, 9, "#ffe690"); b.r(7, 8, 4, 5, "#fff8d0"); b.r(5, 14, 8, 1, "#f0b848"); b.r(1, 2, 16, 3, "#3a3c48"); b.r(5, 0, 8, 2, "#4a4c5a"); b.r(6, 17, 6, 2, "#4a4c5a"); }),
    L2: prop(22, 64, (b) => { b.r(8, 8, 2, 52, "#70788a"); b.r(9, 8, 1, 52, "#565e72"); b.r(5, 58, 8, 4, "#565e72"); b.r(3, 62, 12, 2, "#3a3c48"); b.r(8, 4, 12, 2, "#70788a"); b.r(13, 2, 9, 4, "#3a3c48"); b.r(14, 6, 7, 1, "#dff4ff"); }),
    G: prop(32, 30, (b) => { b.r(13, 12, 4, 18, WOOD); b.r(15, 12, 2, 18, WOOD_D); b.r(1, 2, 26, 12, "#e0b87a"); b.tri([[27, 2], [32, 8], [27, 14]], "#e0b87a"); b.r(1, 2, 26, 1, "#f2d8a4"); b.r(1, 12, 27, 2, "#b88a52"); b.r(5, 5, 14, 1, WOOD); b.r(5, 8, 10, 1, WOOD); }),
    K: crystal("#72e6f4"), K2: crystal("#c08af4"),
    S: [
      prop(24, 36, (b) => { b.tri([[1, 36], [23, 36], [12, 0]], "#5a7896"); b.tri([[1, 36], [12, 36], [12, 0]], "#7694b4"); b.r(9, 12, 2, 10, "#9ab4d0"); b.r(14, 20, 4, 1, "#42607e"); b.r(13, 27, 6, 1, "#42607e"); b.r(0, 33, 24, 3, "#42607e"); }),
      prop(28, 26, (b) => { b.tri([[0, 26], [13, 26], [7, 6]], "#7694b4"); b.tri([[7, 26], [13, 26], [7, 6]], "#5a7896"); b.tri([[11, 26], [28, 26], [20, 0]], "#5a7896"); b.tri([[11, 26], [20, 26], [20, 0]], "#7694b4"); b.r(17, 10, 2, 8, "#9ab4d0"); b.r(0, 24, 28, 2, "#42607e"); }),
    ],
    // the city's edge: concrete panels, some of them tagged
    Z: [0, 1, 2].map((v) => prop(32, 56, (b) => {
      b.r(0, 0, 32, 56, "#4a5064"); b.r(0, 0, 32, 5, "#6a7288"); b.r(0, 5, 32, 1, "#343846"); b.r(0, 50, 32, 6, "#343846");
      b.r(15, 6, 1, 44, "#3c4254"); b.r(0, 27, 32, 1, "#3c4254");
      if (v === 1) { b.r(4, 14, 9, 2, "#ff5a94"); b.r(6, 16, 2, 8, "#ff5a94"); b.r(10, 20, 6, 2, "#ff5a94"); b.r(20, 32, 8, 2, "#5ae4e4"); b.r(22, 34, 2, 7, "#5ae4e4"); }
      if (v === 2) { b.r(18, 12, 10, 12, "#e8e0c8"); b.r(20, 14, 6, 3, "#c84a50"); b.r(20, 19, 6, 1, "#6a7288"); b.r(20, 21, 4, 1, "#6a7288"); }
    })),
    y: prop(16, 24, (b) => { b.r(4, 5, 8, 19, "#d84c4c"); b.r(10, 6, 2, 18, "#a83a40"); b.r(0, 10, 16, 5, "#d84c4c"); b.r(0, 13, 16, 2, "#a83a40"); b.r(3, 0, 10, 6, "#f07070"); b.r(6, 11, 4, 3, "#f4f4f8"); b.r(2, 22, 12, 2, "#a83a40"); }),
    x: prop(20, 26, (b) => { b.r(2, 7, 16, 19, "#5c6474"); b.r(14, 8, 4, 18, "#48505e"); b.r(5, 11, 2, 12, "#48505e"); b.r(10, 11, 2, 12, "#48505e"); b.r(0, 3, 20, 5, "#7a8494"); b.r(0, 3, 20, 1, "#98a2b2"); b.r(7, 0, 6, 3, "#48505e"); }),
    c: CAR.map(car),
    // a fallen log, lying either way, sometimes mossed over
    l: [0, 1].map((v) => prop(30, 15, (b) => {
      b.r(2, 3, 26, 11, "#8a5a34"); b.r(1, 5, 28, 7, "#8a5a34"); b.r(2, 10, 26, 4, "#6a4226"); b.r(4, 4, 20, 1, "#a87446");
      for (const x of [9, 16, 22]) b.r(x, 6, 1, 5, "#6a4226");
      const cap = v ? 25 : 0;
      b.r(cap, 4, 5, 9, "#d8ac6e"); b.r(cap + 1, 6, 3, 5, "#b88a52"); b.r(cap + 2, 8, 1, 1, "#8a5a34");
      if (v) { b.r(6, 2, 7, 2, "#6ab85a"); b.r(15, 3, 4, 1, "#4faa5a"); } else b.r(12, 1, 2, 3, "#8a5a34");
    })),
    // a tree stump with its rings showing
    u: prop(20, 17, (b) => {
      b.r(3, 6, 14, 10, "#8a5a34"); b.r(12, 7, 5, 9, "#6a4226"); b.r(1, 13, 4, 3, "#8a5a34"); b.r(15, 14, 4, 2, "#6a4226"); b.r(6, 10, 1, 4, "#6a4226");
      b.oval(10, 6, 8, 4.4, "#e0b87a"); b.oval(10, 6, 5, 2.6, "#c8985a"); b.oval(10, 6, 2, 1, "#e0b87a"); b.r(4, 4, 3, 1, "#f2d8a4");
    }),
    // reeds standing in shallow water
    e: [0, 1].map((v) => prop(22, 27, (b) => {
      for (const [x, h, c] of v ? [[3, 17, 0], [8, 23, 1], [13, 19, 0], [17, 14, 1]] : [[4, 21, 1], [10, 25, 0], [15, 17, 1]]) {
        b.r(x, 27 - h, 2, h, c ? "#5fae52" : "#4a9648"); b.r(x + (c ? 2 : -1), 27 - h + 5, 1, 6, "#7acf6c");
        if (h > 18) { b.r(x - 1, 27 - h - 1, 4, 5, "#7a4a2a"); b.r(x - 1, 27 - h - 1, 1, 5, "#9a6a3e"); }
      }
    })),
    // what is left of a column
    q: [0, 1].map((v) => prop(18, 36, (b) => {
      const top = v ? 12 : 3;
      b.r(3, top, 12, 36 - top - 5, "#d2cdbd"); b.r(11, top, 4, 31 - top, "#aaa494"); b.r(3, top, 2, 31 - top, "#e6e2d4");
      for (let y = top + 6; y < 30; y += 7) b.r(3, y, 12, 1, "#aaa494");
      b.r(1, 30, 16, 6, "#c2bcac"); b.r(1, 30, 16, 1, "#e6e2d4"); b.r(1, 34, 16, 2, "#8c8678");
      if (v) { b.r(3, top, 4, 2, "#aaa494"); b.r(9, top - 2, 4, 2, "#d2cdbd"); b.r(5, 22, 4, 2, "#6aa85a"); } else { b.r(1, 1, 16, 4, "#c2bcac"); b.r(1, 1, 16, 1, "#e6e2d4"); }
    })),
    // a mine cart with a load of ore
    M: prop(32, 24, (b) => {
      b.r(3, 8, 26, 11, "#8a5a34"); b.r(5, 19, 22, 2, "#6a4226"); b.r(3, 8, 26, 2, "#b08050"); b.r(3, 14, 26, 1, "#6a4226"); b.r(3, 8, 2, 11, "#5a5e6c"); b.r(27, 8, 2, 11, "#5a5e6c"); b.r(15, 8, 2, 11, "#6a4226");
      b.oval(16, 7, 11, 4, "#5a6a88"); b.r(9, 3, 4, 4, "#72e6f4"); b.r(10, 2, 2, 1, "#ffffff"); b.r(18, 4, 4, 3, "#c08af4"); b.r(14, 5, 3, 2, "#7a8aa8");
      for (const x of [9, 23]) { b.oval(x, 21, 3.4, 3, "#3a3c48"); b.r(x - 1, 20, 2, 2, "#8a8e9c"); }
    }),
    // a dumpster with its lid half open
    D: prop(36, 27, (b) => {
      b.r(2, 9, 32, 16, "#3f7a62"); b.r(2, 9, 32, 2, "#56987c"); b.r(2, 21, 32, 4, "#2c5a48"); b.r(28, 11, 6, 14, "#2c5a48");
      for (const x of [9, 18]) b.r(x, 12, 1, 9, "#2c5a48");
      b.tri([[1, 9], [35, 9], [33, 3], [5, 5]], "#4a5064"); b.r(5, 5, 26, 1, "#6a7288");
      b.r(21, 14, 6, 4, "#e8e0c8"); b.r(22, 15, 4, 1, "#c84a50");
      for (const x of [7, 29]) b.oval(x, 25, 2.4, 2, "#22242c");
    }),
    // a traveller's tent
    E: prop(44, 34, (b) => {
      b.tri([[2, 33], [42, 33], [22, 2]], "#e6d2a4"); b.tri([[22, 2], [42, 33], [27, 33]], "#c2aa78"); b.tri([[15, 33], [29, 33], [22, 12]], "#4a3a34"); b.tri([[15, 33], [22, 33], [22, 12]], "#5e4a40");
      b.r(21, 0, 2, 5, "#8a5a34"); b.r(2, 32, 40, 2, "#b09866"); b.r(10, 22, 3, 1, "#f6ecd2"); b.r(7, 27, 4, 1, "#f6ecd2");
      b.r(0, 31, 3, 3, "#8a5a34"); b.r(41, 31, 3, 3, "#6a4226");
    }),
    house: [0, 1, 2, 3].map(house).concat([4, 5, 6, 7].map(building)),
    fountain: prop(72, 64, (b) => {
      b.oval(36, 45, 35, 18, "#8a909e"); b.oval(36, 43, 35, 18, "#c2c8d4"); b.oval(36, 41, 34, 16, "#dfe4ee"); b.oval(36, 43, 31, 14, "#aab0be");
      b.oval(36, 42, 29, 12.5, "#4a9ae0"); b.oval(36, 44, 27, 10, "#3f8ad2"); b.oval(30, 39, 14, 4, "#7abcf4");
      b.r(31, 22, 10, 22, "#c2c8d4"); b.r(31, 22, 3, 22, "#dfe4ee"); b.r(38, 22, 3, 22, "#9aa0ae");
      b.oval(36, 22, 14, 5, "#c2c8d4"); b.oval(36, 21, 14, 4, "#dfe4ee"); b.oval(36, 21, 11, 2.6, "#7abcf4");
      b.r(34, 10, 4, 10, "#c2c8d4"); b.oval(36, 9, 4, 3, "#dfe4ee");
      for (const [x, y, h] of [[35, 1, 6], [30, 6, 5], [41, 5, 6], [26, 12, 4], [45, 12, 4]]) b.r(x, y, 2, h, "#dff4ff");
    }),
  };
  SC.n = SC.TB[2];
  return SC;
}

// ── barriers that run on: cliffs, hedges and ruined walls are built from joined pieces
const WALL = {
  // a raised ledge: grass on top, a rim of pale rock where it is lit, a rock face to the south
  C(b, o, grass) {
    const rock = "#c6bc9c", mid = "#a1967a", dark = "#776c56";
    // the top is bare rock, with a tuft or a patch of moss that the ground below lends it
    b.r(0, 0, 32, 32, "#b4aa8c");
    if (o.v) { b.r(7, 9, 6, 1, mid); b.r(12, 10, 3, 1, mid); b.r(19, 20, 5, 3, grass); b.r(20, 19, 3, 1, lt(grass, 1.2)); b.r(24, 8, 2, 2, rock); }
    else { b.r(17, 8, 5, 3, grass); b.r(18, 7, 3, 1, lt(grass, 1.2)); b.r(6, 20, 7, 1, mid); b.r(8, 21, 3, 1, mid); b.r(24, 24, 2, 2, rock); }
    if (!o.n) { b.r(0, 0, 32, 4, rock); b.r(0, 0, 32, 1, lt(rock, 1.14)); b.r(0, 4, 32, 1, mid); }
    if (!o.w) { b.r(0, 0, 4, 32, rock); b.r(0, 0, 1, 32, lt(rock, 1.14)); if (!o.n) b.r(0, 0, 4, 4, lt(rock, 1.08)); }
    if (!o.e) { b.r(28, 0, 4, 32, mid); b.r(27, o.n ? 0 : 4, 1, 32, dark); }
    if (!o.s) {
      b.r(0, 28, 32, 4, rock); b.r(0, 27, 32, 1, mid);
      b.r(0, 32, 32, 14, mid); b.r(0, 32, 32, 3, "#b5ab8c"); b.r(0, 42, 32, 4, dark);
      const k = o.v ? 9 : 0;
      b.r(5 + k, 35, 1, 6, dark); b.r(6 + k, 39, 2, 1, dark); b.r(22 - k, 36, 1, 5, dark); b.r(12, 38, 7, 1, "#8c8168"); b.r(26 - k, 34, 3, 1, "#b5ab8c");
      if (!o.e) b.r(28, 32, 4, 14, dark);
    }
  },
  // a clipped hedge
  H(b, o) {
    const leaf = "#4aa552", lit = "#6ac060", deep = "#33863f";
    b.r(0, 0, 32, 32, leaf);
    b.oval(9, 9, 6, 4, lit); b.oval(23, 20, 6, 4, lit); b.oval(21, 7, 4, 3, deep); b.oval(8, 23, 5, 3, deep);
    for (const [x, y] of o.v ? [[15, 15], [4, 16], [27, 12], [16, 26]] : [[14, 18], [5, 4], [26, 28], [17, 3]]) { b.r(x, y, 3, 2, deep); b.r(x + 1, y - 1, 2, 1, lit); }
    if (!o.n) b.r(0, 0, 32, 2, "#84d474");
    if (!o.w) b.r(0, 0, 2, 32, lit);
    if (!o.e) b.r(30, 0, 2, 32, deep);
    if (!o.s) {
      b.r(0, 29, 32, 17, deep); b.r(0, 29, 32, 2, leaf);
      for (let i = 0; i < 5; i++) { b.r(2 + i * 6, 34 + (i % 2) * 5, 3, 2, leaf); b.r(4 + i * 6, 38 - (i % 2) * 4, 2, 1, "#256a32"); }
      b.r(0, 43, 32, 3, "#256a32");
    }
  },
  // a wall of dressed stone, long since fallen in
  U(b, o) {
    const top = "#cbc6b6", lit = "#e2decf", face = "#9c9686", dark = "#726c5e";
    b.r(0, 0, 32, 32, top);
    b.r(0, 15, 32, 1, "#aaa494"); b.r(15, 0, 1, 15, "#aaa494"); b.r(8, 16, 1, 16, "#aaa494"); b.r(24, 16, 1, 16, "#aaa494");
    if (o.v) { b.oval(10, 8, 5, 3, "#7ab868"); b.r(20, 22, 5, 2, "#6aa85a"); b.r(3, 26, 3, 2, "#aaa494"); } else { b.r(20, 5, 5, 3, "#b8b2a2"); b.r(4, 21, 2, 4, "#aaa494"); }
    if (!o.n) b.r(0, 0, 32, 2, lit);
    if (!o.w) b.r(0, 0, 2, 32, lit);
    if (!o.e) b.r(30, 0, 2, 32, "#aaa494");
    if (!o.s) {
      b.r(0, 30, 32, 16, face); b.r(0, 30, 32, 2, "#bcb6a6"); b.r(0, 37, 32, 1, dark);
      for (const x of [10, 26]) b.r(x, 32, 1, 5, dark);
      for (const x of [4, 18]) b.r(x, 38, 1, 6, dark);
      b.r(0, 44, 32, 2, dark);
      if (o.v) { b.r(22, 32, 4, 3, "#6aa85a"); b.r(23, 35, 2, 2, "#6aa85a"); }
    }
  },
};
const wallCache = new Map();
/** One piece of a barrier. `mask` says which neighbours are the same thing: 1 north, 2 east, 4 south, 8 west. */
function wallPiece(kind, mask, v, grass) {
  const key = kind + mask + v + grass;
  let c = wallCache.get(key);
  if (c) return c;
  const o = { n: mask & 1, e: mask & 2, s: mask & 4, w: mask & 8, v };
  // no margin — so no outline — on a side that joins the next piece
  const padL = o.w ? 0 : 2, padR = o.e ? 0 : 2, padT = o.n ? 0 : 2, padB = o.s ? 0 : 2;
  const [cv2, x] = sheet(32 + padL + padR, (o.s ? 32 : 46) + padT + padB);
  x.translate(padL, padT);
  WALL[kind](tools(x), o, grass);
  x.setTransform(1, 0, 0, 1, 0, 0);
  c = ink(cv2, x);
  c.ax = (padR - padL) / 2; c.padT = padT;
  wallCache.set(key, c);
  return c;
}

// ───────────────────────────── ground ─────────────────────────────

const GROUND = { t: "#6cbf5e", r: "#aeb0a0", ".": "#6cbf5e", ",": "#6cbf5e", '"': "#6cbf5e", ":": "#3f8a5c", ";": "#3f8a5c", p: "#d9ab6c", o: "#b4b9c6", s: "#ecd9a2", w: "#4aa2e2", b: "#b98a50", c: "#486a8a", d: "#486a8a", W: "#131a32", a: "#474b5a", m: "#474b5a", k: "#9aa0ae" };
const GROUP = { t: 0, r: 3, ".": 0, ",": 0, '"': 0, ":": 1, ";": 1, p: 2, o: 3, s: 4, w: 5, b: 6, c: 7, d: 7, W: 8, a: 9, m: 9, k: 10 };
/** The outline where a patch of ground ends: [dark edge line, soft inner rim]. */
const EDGE = { 2: ["#8f6238", "#bd8c54"], 3: ["#6e7486", "#969cac"], 4: ["#b89a5e", "#d8c088"], 5: ["#2f78c0", "#86c8f4"], 6: ["#6a4426", "#96683a"], 7: ["#2a4262", "#3a5878"], 10: ["#5e6474", "#c4c8d2"] };
const FLOWER = ["#fffbe8", "#ffd84a", "#ff9ac0", "#9ac8ff", "#f06a7a"];

/** What kind of place a map is, from the ground it is made of. */
function themeOf(m) {
  let cave = 0, city = 0, forest = 0;
  for (const row of m.g) for (const ch of row) { if (ch === "W" || ch === "c") cave++; else if (ch === "a" || ch === "k") city++; else if (ch === ":" || ch === ";") forest++; }
  const n = m.w * m.h;
  return cave > n * 0.3 ? "cave" : city > n * 0.3 ? "city" : forest > n * 0.3 ? "forest" : m.safe ? "town" : "meadow";
}

function paintGround(m, theme) {
  const [c, x] = sheet(m.w * T, m.h * T);
  const b = tools(x);
  const BASE = theme === "forest" ? { ...GROUND, ".": GROUND[":"], ",": GROUND[":"], '"': GROUND[":"], t: GROUND[":"] } : GROUND;
  const at = (tx, ty) => (ty < 0 || tx < 0 || ty >= m.h || tx >= m.w ? null : m.g[ty][tx]);
  const forest = theme === "forest";
  const grp = (tx, ty) => { const ch = at(tx, ty); return ch === null ? -1 : forest && GROUP[ch] === 0 ? 1 : GROUP[ch]; };
  const free = (tx, ty) => m.o[ty][tx] === " ";
  const tuft = (a, q, col) => { b.r(a, q + 1, 1, 2, col); b.r(a + 1, q, 1, 3, col); b.r(a + 2, q + 1, 1, 2, col); };
  const flower = (a, q, col) => { b.r(a - 1, q, 3, 1, col); b.r(a, q - 1, 1, 3, col); b.r(a, q, 1, 1, "#f0b030"); };

  // 1 — grass everywhere it grows, with soft lighter and darker drifts
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) { const g0 = grp(tx, ty); if (g0 <= 1) b.r(tx * T, ty * T, T, T, BASE[m.g[ty][tx]]); }
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
    const g0 = grp(tx, ty);
    if (g0 > 1) continue;
    const col = BASE[m.g[ty][tx]], h = hash(tx, ty, 61);
    if (h < 0.1) b.oval(tx * T + 16, ty * T + 16, 22 + hash(tx, ty, 62) * 14, 14 + hash(tx, ty, 63) * 9, lt(col, 1.04));
    else if (h > 0.9) b.oval(tx * T + 16, ty * T + 16, 20 + hash(tx, ty, 62) * 14, 12 + hash(tx, ty, 63) * 9, dk(col, 0.965));
  }

  // 2 — every tile's own surface
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
    const ch = m.g[ty][tx], X = tx * T, Y = ty * T, col = BASE[ch] || "#888", g0 = grp(tx, ty);
    const h = (s) => hash(tx, ty, s);
    if (g0 <= 1) {
      const d = dk(col, 0.86), l = lt(col, 1.2);
      for (let i = 0; i < 2; i++) tuft(X + 3 + Math.floor(h(i) * 25), Y + 3 + Math.floor(h(i + 9) * 25), i ? d : l);
      if (ch === "," || ch === ";") {
        // a clump of taller blades (ferns in the forest)
        const a = X + 9 + Math.floor(h(20) * 12), q = Y + 10 + Math.floor(h(21) * 10);
        for (let i = -1; i <= 1; i++) { const bh = i ? 5 : 8, bx = a + i * 3; b.r(bx, q + 9 - bh, 2, bh - 1, i < 0 ? lt(col, 1.3) : l); b.r(bx + (i > 0 ? 1 : 0), q + 8 - bh, 1, 1, lt(col, 1.3)); }
        b.r(a - 4, q + 8, 10, 1, d);
      } else if (ch === "t") {
        // tall grass: six clumps of blades, standing clear of one another
        for (let i = 0; i < 6; i++) {
          const a = X + 3 + (i % 3) * 10 + Math.floor(h(20 + i) * 3), q = Y + 2 + Math.floor(i / 3) * 15 + Math.floor(h(30 + i) * 3), bh = 7 + Math.floor(h(40 + i) * 4);
          b.r(a, q + 11 - bh, 2, bh, l); b.r(a + 3, q + 13 - bh, 2, bh - 2, lt(col, 1.32)); b.r(a - 2, q + 15 - bh, 1, bh - 4, d); b.r(a - 2, q + 11, 7, 1, d);
        }
      } else if (ch === '"') {
        for (let i = 0; i < 3; i++) flower(X + 5 + Math.floor(h(30 + i) * 22), Y + 5 + Math.floor(h(40 + i) * 22), FLOWER[Math.floor(h(50 + i) * (g0 ? 3 : 5))]);
      } else if (free(tx, ty)) {
        const k = h(70);
        if (k < 0.05) { const a = X + 8 + Math.floor(h(71) * 14), q = Y + 10 + Math.floor(h(72) * 12); b.r(a, q, 4, 2, "#a8acba"); b.r(a + 1, q - 1, 2, 1, "#c8ccd8"); b.r(a, q + 2, 4, 1, d); }
        else if (k < 0.1) { const a = X + 8 + Math.floor(h(71) * 14), q = Y + 8 + Math.floor(h(72) * 14); for (const [i, j] of [[0, 0], [3, 1], [1, 3], [4, 4]]) b.r(a + i, q + j, 2, 2, d); }
        else if (k < 0.13) flower(X + 8 + Math.floor(h(71) * 16), Y + 8 + Math.floor(h(72) * 16), FLOWER[Math.floor(h(73) * 5)]);
        else if (g0 === 1 && k < 0.19) { const a = X + 8 + Math.floor(h(71) * 14), q = Y + 10 + Math.floor(h(72) * 12), cap = h(73) > 0.5 ? "#d05a4e" : "#e8b060"; b.r(a + 1, q + 2, 2, 3, "#f2e6cc"); b.r(a, q, 4, 2, cap); b.r(a + 1, q - 1, 2, 1, cap); b.r(a + 1, q, 1, 1, "#fff4e0"); }
        else if (g0 === 1 && k < 0.27) { for (let i = 0; i < 3; i++) b.r(X + 4 + Math.floor(h(74 + i) * 24), Y + 4 + Math.floor(h(78 + i) * 24), 2, 1, i % 2 ? "#d89a48" : "#b8703a"); }
      }
      continue;
    }
    b.r(X, Y, T, T, col);
    if (ch === "p") {
      for (let i = 0; i < 5; i++) b.r(X + 2 + Math.floor(h(i) * 27), Y + 2 + Math.floor(h(i + 9) * 27), 2, 1, i % 2 ? dk(col, 0.9) : lt(col, 1.12));
      if (h(30) < 0.3) { const a = X + 6 + Math.floor(h(31) * 18), q = Y + 6 + Math.floor(h(32) * 18); b.r(a, q, 3, 2, "#c0986a"); b.r(a, q, 3, 1, "#ecd0a0"); b.r(a, q + 2, 3, 1, "#b08650"); }
    } else if (ch === "s") {
      for (let i = 0; i < 5; i++) b.r(X + 2 + Math.floor(h(i) * 27), Y + 2 + Math.floor(h(i + 9) * 27), 2, 1, i % 2 ? dk(col, 0.92) : "#fbf0c8");
      if (h(30) < 0.14) { const a = X + 8 + Math.floor(h(31) * 16), q = Y + 8 + Math.floor(h(32) * 16); b.r(a, q, 3, 2, "#fff4f0"); b.r(a + 1, q + 1, 1, 1, "#f0a8b0"); }
    } else if (ch === "o" || ch === "r") {
      // paving: two courses of stones per tile, each stone its own shade
      for (let r2 = 0; r2 < 2; r2++) {
        const off = (ty * 2 + r2) % 2 ? 8 : 0;
        for (let i = -1; i < 2; i++) {
          const sx = X + off + i * 16, t2 = hash(tx * 2 + i + (off ? 1 : 0), ty * 2 + r2, 7);
          const x0 = Math.max(X, sx), x1 = Math.min(X + T, sx + 16);
          if (x1 <= x0) continue;
          b.r(x0, Y + r2 * 16, x1 - x0, 16, t2 < 0.25 ? lt(col, 1.06) : t2 > 0.8 ? dk(col, 0.94) : col);
          b.r(x0, Y + r2 * 16, x1 - x0, 1, lt(col, 1.12));
          if (sx >= X && sx < X + T) b.r(sx, Y + r2 * 16, 1, 16, dk(col, 0.82));
        }
        b.r(X, Y + r2 * 16 + 15, T, 1, dk(col, 0.82));
      }
      if (h(40) < 0.04) { const a = X + 6 + Math.floor(h(41) * 16), q = Y + 5 + Math.floor(h(42) * 18); b.r(a, q, 1, 4, dk(col, 0.72)); b.r(a + 1, q + 3, 3, 1, dk(col, 0.72)); }
      if (h(43) < (ch === "r" ? 0.6 : 0.08)) b.r(X + Math.floor(h(44) * 26), Y + 14, 4, 2, "#7ab868");
      if (ch === "r") {
        // old stones: moss in the joints, a broken corner here and there
        if (h(45) < 0.5) { const a = X + 3 + Math.floor(h(46) * 20), q = Y + 3 + Math.floor(h(47) * 20); b.r(a, q, 5, 2, "#7ab868"); b.r(a + 1, q + 2, 3, 1, "#6aa85a"); }
        if (h(48) < 0.3) { const a = X + 4 + Math.floor(h(49) * 20), q = Y + 18 + Math.floor(h(50) * 8); b.r(a, q, 1, 4, dk(col, 0.72)); b.r(a + 1, q + 3, 3, 1, dk(col, 0.72)); }
      }
    } else if (ch === "k") {
      b.r(X, Y, T, 1, lt(col, 1.1)); b.r(X + 15, Y, 1, T, dk(col, 0.9)); b.r(X, Y + 15, T, 1, dk(col, 0.9)); b.r(X + 31, Y, 1, T, dk(col, 0.86)); b.r(X, Y + 31, T, 1, dk(col, 0.86));
      if (h(1) < 0.2) b.r(X + 3 + Math.floor(h(2) * 22), Y + 3 + Math.floor(h(3) * 22), 5, 3, dk(col, 0.93));
      if (h(4) < 0.05) { const a = X + 6 + Math.floor(h(5) * 14), q = Y + 6 + Math.floor(h(6) * 14); b.r(a, q, 1, 5, dk(col, 0.74)); b.r(a + 1, q + 4, 4, 1, dk(col, 0.74)); }
    } else if (ch === "w") {
      const deep = grp(tx, ty - 1) === 5 && grp(tx, ty + 1) === 5 && grp(tx - 1, ty) === 5 && grp(tx + 1, ty) === 5;
      if (deep) b.r(X, Y, T, T, "#4196d8");
      if (deep && h(1) < 0.07) { const a = X + 8 + Math.floor(h(2) * 14), q = Y + 9 + Math.floor(h(3) * 12); b.oval(a + 4, q + 3, 5, 3.4, "#4faa5a"); b.r(a + 4, q + 3, 3, 1, "#4196d8"); b.oval(a + 3, q + 2, 2.4, 1.4, "#7acf70"); if (h(4) < 0.5) { b.r(a + 6, q + 1, 2, 2, "#ff9ac0"); b.r(a + 6, q + 1, 1, 1, "#fff2c0"); } }
    } else if (ch === "b") {
      for (let i = 0; i < T; i += 8) { b.r(X + i, Y, 1, T, dk(col, 0.72)); b.r(X + i + 1, Y, 2, T, lt(col, 1.14)); b.r(X + i + 4, Y + 3, 1, 1, "#5a3a22"); b.r(X + i + 4, Y + 28, 1, 1, "#5a3a22"); if (hash(tx * 4 + i, ty, 3) < 0.3) b.r(X + i + 3, Y + 8 + Math.floor(hash(tx * 4 + i, ty, 4) * 14), 3, 1, dk(col, 0.84)); }
      if (grp(tx, ty - 1) !== 6) { b.r(X, Y, T, 5, "#7a5030"); b.r(X, Y, T, 1, "#a87a48"); b.r(X, Y + 5, T, 2, dk(col, 0.7)); }
      if (grp(tx, ty + 1) !== 6) { b.r(X, Y + T - 6, T, 6, "#7a5030"); b.r(X, Y + T - 6, T, 1, "#a87a48"); }
    } else if (g0 === 7) {
      // cave floor: worn flagstones
      const d = dk(col, 0.84);
      for (let q = 0; q < 2; q++) for (let i = 0; i < 2; i++) { const a = X + i * 16 + (q ? 8 : 0), z = Y + q * 16; b.r(a + 2, z + 13, 12, 1, d); b.r(a + 1, z + 10, 1, 3, d); b.r(a + 14, z + 10, 1, 3, d); b.r(a + 4, z + 3, 5, 1, lt(col, 1.1)); }
      if (ch === "d") { const a = X + 6 + Math.floor(h(3) * 14), q = Y + 6 + Math.floor(h(4) * 14); b.r(a, q, 5, 3, "#5c80a0"); b.r(a, q, 5, 1, "#7a9cbc"); b.r(a + 7, q + 4, 3, 2, "#5c80a0"); }
      if (grp(tx, ty - 1) === 8) b.r(X, Y, T, 5, dk(col, 0.8));
      if (free(tx, ty) && h(5) < 0.06) { const a = X + 8 + Math.floor(h(6) * 16), q = Y + 8 + Math.floor(h(7) * 16), kc = h(8) > 0.5 ? "#72e6f4" : "#c08af4"; b.r(a, q + 1, 3, 3, kc); b.r(a + 1, q, 1, 5, kc); b.r(a + 1, q + 1, 1, 1, "#ffffff"); }
      else if (free(tx, ty) && h(5) < 0.11) {
        // a few glowing mushrooms
        for (let i = 0; i < 3; i++) { const a = X + 6 + Math.floor(h(12 + i) * 18), q = Y + 8 + Math.floor(h(16 + i) * 16); b.r(a + 1, q + 2, 1, 2, "#dff4ff"); b.r(a, q, 3, 2, "#5ae4d0"); b.r(a + 1, q - 1, 1, 1, "#5ae4d0"); b.r(a, q, 1, 1, "#c8fff4"); }
      } else if (h(5) > 0.9) { const a = X + 6 + Math.floor(h(6) * 16), q = Y + 8 + Math.floor(h(7) * 16); b.r(a, q, 4, 2, "#6a88a8"); b.r(a, q + 2, 4, 1, d); b.r(a + 6, q + 3, 2, 2, "#6a88a8"); }
    } else if (g0 === 9) {
      for (let i = 0; i < 5; i++) b.r(X + Math.floor(h(i) * 29), Y + Math.floor(h(i + 9) * 30), 2, 1, i % 2 ? dk(col, 0.86) : lt(col, 1.16));
      if (ch === "m") { b.r(X + 5, Y + 14, 22, 4, "#e8e4d0"); b.r(X + 5, Y + 17, 22, 1, "#b8b4a0"); }
      // zebra crossings, at regular steps along each road
      const ns = grp(tx, ty - 1) === 9 && grp(tx, ty + 1) === 9 && (grp(tx - 4, ty) === 10 || grp(tx + 4, ty) === 10) && (grp(tx - 1, ty) === 10 || grp(tx - 2, ty) === 10 || grp(tx - 3, ty) === 10 || grp(tx - 4, ty) === 10) && (grp(tx + 1, ty) === 10 || grp(tx + 2, ty) === 10 || grp(tx + 3, ty) === 10 || grp(tx + 4, ty) === 10);
      if (ns && ty % 9 === 4) for (let i = 2; i < T; i += 8) { b.r(X + i, Y + 4, 4, 24, "#e8e4d0"); b.r(X + i, Y + 27, 4, 1, "#b8b4a0"); }
      if (free(tx, ty) && h(20) < 0.012 && ch === "a") { b.oval(X + 16, Y + 16, 9, 8, "#2e303a"); b.oval(X + 16, Y + 15, 8, 7, "#5a5e6c"); for (let i = -4; i <= 4; i += 4) b.r(X + 11, Y + 14 + i, 10, 1, "#3c404c"); }
    } else if (ch === "W") {
      // rock: flat darkness, with a lit face where it stands over open floor
      const below = at(tx, ty + 1);
      if (below && below !== "W") {
        b.r(X, Y + 6, T, 26, "#2e4468"); b.r(X, Y + 6, T, 3, "#4a6a98"); b.r(X, Y + 9, T, 1, "#3a5680");
        for (let i = 0; i < 3; i++) b.r(X + 2 + Math.floor(h(i) * 20), Y + 14 + i * 5, 9, 2, "#223450");
        b.r(X + Math.floor(h(5) * 26), Y + 11, 4, 1, "#5a7cac");
        if (h(6) < 0.16) { const a = X + 6 + Math.floor(h(7) * 18), kc = h(8) > 0.5 ? "#72e6f4" : "#c08af4"; b.r(a, Y + 17, 3, 5, kc); b.r(a + 1, Y + 15, 1, 9, kc); b.r(a + 1, Y + 17, 1, 2, "#ffffff"); }
        b.r(X, Y + 30, T, 2, "#141c34");
      } else {
        if (h(1) < 0.5) b.r(X + Math.floor(h(2) * 24), Y + Math.floor(h(3) * 26), 6, 2, "#1b2644");
        if (h(4) < 0.2) b.r(X + Math.floor(h(5) * 26), Y + Math.floor(h(6) * 28), 3, 1, "#24325a");
        // the lip of the rock where it drops to open floor above it
        if (grp(tx, ty - 1) === 7) { b.r(X, Y, T, 4, "#22335a"); b.r(X, Y, T, 1, "#3e5c8a"); }
      }
      for (const dx of [-1, 1]) if (grp(tx + dx, ty) === 7) { b.r(dx < 0 ? X : X + T - 4, Y, 4, T, "#22335a"); b.r(dx < 0 ? X : X + T - 1, Y, 1, T, "#3e5c8a"); }
    }
    // the edge of this patch: a wavering line with the neighbour's colour biting into it
    const ed = EDGE[g0];
    if (ed) {
      const dif = (dx, dy) => { const n = grp(tx + dx, ty + dy); return n !== -1 && n < g0 && !(g0 === 6 && n === 5) && n !== 8; };
      const nb = (dx, dy) => BASE[at(tx + dx, ty + dy)];
      const side = (dx, dy) => {
        if (!dif(dx, dy)) return false;
        const bite = nb(dx, dy), straight = g0 === 3 || g0 === 5 || g0 === 10 || g0 === 6;
        for (let i = 0; i < 8; i++) {
          const dpt = straight ? 0 : 1 + Math.floor(hash(tx * 8 + i * (dx ? 0 : 1), ty * 8 + i * (dx ? 1 : 0), 3 + dx + dy * 2) * 3);
          const horiz = dy !== 0, a = i * 4;
          if (horiz) {
            if (bite && dpt) b.r(X + a, dy < 0 ? Y : Y + T - dpt, 4, dpt, bite);
            b.r(X + a, dy < 0 ? Y + dpt : Y + T - dpt - 1, 4, 1, ed[0]);
            b.r(X + a, dy < 0 ? Y + dpt + 1 : Y + T - dpt - 3, 4, 2, ed[1]);
          } else {
            if (bite && dpt) b.r(dx < 0 ? X : X + T - dpt, Y + a, dpt, 4, bite);
            b.r(dx < 0 ? X + dpt : X + T - dpt - 1, Y + a, 1, 4, ed[0]);
            b.r(dx < 0 ? X + dpt + 1 : X + T - dpt - 3, Y + a, 2, 4, ed[1]);
          }
        }
        return true;
      };
      const n = side(0, -1), s = side(0, 1), w = side(-1, 0), e = side(1, 0);
      // round the outer corners by letting the neighbour's colour bite in
      const corner = (cx, cy, dx, dy) => {
        const col2 = BASE[at(tx + dx, ty) ?? at(tx, ty + dy)] || col;
        b.r(cx, cy, 6, 6, col2);
        // quarter-round: three steps of the patch's own colour back in, edged
        for (let i = 0; i < 6; i++) {
          const run = [0, 0, 1, 2, 4, 5][i];
          if (run) b.r(dx < 0 ? cx + 6 - run : cx, cy + (dy < 0 ? i : 5 - i), run, 1, col);
          b.r(dx < 0 ? cx + 5 - run : cx + run, cy + (dy < 0 ? i : 5 - i), 1, 1, ed[0]);
        }
      };
      if (n && w) corner(X, Y, -1, -1);
      if (n && e) corner(X + T - 6, Y, 1, -1);
      if (s && w) corner(X, Y + T - 6, -1, 1);
      if (s && e) corner(X + T - 6, Y + T - 6, 1, 1);
    }
  }
  // puddles on city ground, catching the neon
  if (theme === "city") for (let ty = 2; ty < m.h - 2; ty++) for (let tx = 2; tx < m.w - 2; tx++) {
    const g0 = grp(tx, ty);
    if ((g0 !== 9 && g0 !== 10) || !free(tx, ty) || hash(tx, ty, 90) > 0.035 || grp(tx + 1, ty) !== g0 || m.g[ty][tx] === "m") continue;
    const X = tx * T + 10 + Math.floor(hash(tx, ty, 91) * 10), Y = ty * T + 12 + Math.floor(hash(tx, ty, 92) * 8), neon = NEON[Math.floor(hash(tx, ty, 93) * 4)];
    b.oval(X + 9, Y + 4, 11, 4.4, "#2a3048"); b.oval(X + 8, Y + 4, 8, 2.8, "#34406a"); b.r(X + 4, Y + 3, 6, 1, neon); b.r(X + 11, Y + 5, 3, 1, lt(neon, 1.4));
  }
  return c;
}

/** Things painted flat on the ground after it is laid: the plaza's rings, mats, flower beds. */
function paintExtras(m, c) {
  const x = c.getContext("2d"), b = tools(x);
  for (const big of m.big) {
    if (big.t === "fountain") {
      const cx = (big.x + 1) * T, cy = (big.y + 1) * T + 6;
      const ring = (r, col, w) => { for (let i = 0; i < r * 8; i++) { const a = (i / (r * 8)) * 6.2832; b.r(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.78), w, w, col); } };
      ring(94, "#8f95a6", 2); ring(96, "#d6dae4", 1); ring(58, "#8f95a6", 2); ring(60, "#d6dae4", 1);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 6.2832, px = Math.round(cx + Math.cos(a) * 76), py = Math.round(cy + Math.sin(a) * 59), col = i % 2 ? "#e2c486" : "#7aa6e8";
        b.r(px - 1, py - 3, 2, 7, "#8f95a6"); b.r(px - 3, py - 1, 6, 3, "#8f95a6"); b.r(px - 2, py - 2, 4, 5, "#8f95a6");
        b.r(px - 1, py - 2, 2, 5, col); b.r(px - 2, py - 1, 4, 3, col); b.r(px - 1, py - 1, 1, 1, "#ffffff");
      }
    } else if (big.t === "house" && big.v < 4) {
      // flower beds either side of the door
      for (const tx of [big.x, big.x + 3]) {
        const X = tx * T + 3, Y = (big.y + 3) * T + 1;
        b.r(X, Y, 26, 9, "#5a4030"); b.r(X, Y, 26, 1, "#8a6a4a"); b.r(X - 1, Y + 9, 28, 1, "#8f6238");
        for (let i = 0; i < 6; i++) { b.r(X + 2 + i * 4, Y + 4, 2, 4, "#4faa5a"); b.r(X + 1 + i * 4, Y + 1 + (i % 2), 4, 3, FLOWER[(i + big.v) % 5]); }
      }
    }
  }
  for (const n of m.npcs) {
    // a woven mat marks where each of the townsfolk stands
    const cx = n.x * T + 16, cy = n.y * T + 25, col = { shop: "#e07a8a", smith: "#8a90a0", elder: "#5a6ac0", train: "#b84a4a" }[n.role] || "#6a8a5a";
    b.oval(cx, cy, 15, 6.5, "#f2e0b0"); b.oval(cx, cy, 13, 5, col); b.oval(cx, cy, 9, 3, lt(col, 1.3)); b.oval(cx, cy, 5, 1.6, col);
  }
}

let theme = "meadow", waterTiles = [], smokers = [];
export function loadMap(m) {
  map = m;
  theme = themeOf(m);
  ground = paintGround(m, theme);
  paintExtras(m, ground);
  const S = scenery();
  statics = []; waterTiles = []; smokers = [];
  const edge = (x, y) => x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.g[y][x] === "w") {
      const sh = (dx, dy) => { const r = m.g[y + dy], ch = r && r[x + dx]; return ch !== undefined && ch !== "w" && ch !== "b" ? 1 : 0; };
      waterTiles.push({ x: x * T, y: y * T, h: hash(x, y, 5), n: sh(0, -1), s: sh(0, 1), w: sh(-1, 0), e: sh(1, 0) });
    }
    const ch = m.o[y][x];
    if (WALL[ch]) {
      const same = (dx, dy) => { const r = m.o[y + dy]; return r && r[x + dx] === ch ? 1 : 0; };
      const piece = wallPiece(ch, same(0, -1) | (same(1, 0) << 1) | (same(0, 1) << 2) | (same(-1, 0) << 3), hash(x, y, 4) < 0.5 ? 0 : 1, theme === "forest" ? GROUND[":"] : GROUND["."]);
      statics.push({ sp: piece, x: x * T + 16 + piece.ax, y: y * T - 14 - piece.padT + piece.height - 2, glow: null, glint: -1 });
      continue;
    }
    let sp = S[ch];
    if (!sp) continue;
    const h = hash(x, y, 3);
    if (ch === "T") sp = sp[edge(x, y) ? (h < 0.7 ? 0 : 2) : h < 0.5 ? 0 : h < 0.72 ? 2 : h < 0.88 ? 1 : 3];
    else if (ch === "B") sp = theme === "town" ? S.TB[Math.floor(h * 3)] : sp[Math.floor(h * 3)];
    else if (ch === "L") sp = theme === "city" ? S.L2 : S.L;
    else if (ch === "K") sp = hash(x, y, 7) > 0.6 ? S.K2 : S.K;
    else if (Array.isArray(sp)) sp = sp[Math.floor(h * sp.length)];
    const wide = ch === "c" ? T : 0;
    statics.push({
      sp, x: x * T + T / 2 + wide / 2 + (ch === "T" || ch === "P" ? Math.round((hash(x, y, 8) - 0.5) * 6) : 0), y: (y + 1) * T - 3,
      glow: ch === "L" ? "#ffe690" : ch === "K" ? "#72e6f4" : null, glint: ch === "K" ? hash(x, y, 9) * 6 : -1,
    });
  }
  for (const b of m.big) {
    if (b.t === "house") {
      const city = b.v >= 4, s = { sp: S.house[b.v % 8], x: (b.x + 2) * T, y: (b.y + 3) * T - 2, glow: city ? NEON[b.v % 4] : null, big: true, neon: city ? NEON[b.v % 4] : null, ph: hash(b.x, b.y, 2) * 9 };
      statics.push(s);
      if (!city) smokers.push({ x: s.x + 31, y: s.y - 134 });
    } else statics.push({ sp: S.fountain, x: (b.x + 1) * T, y: (b.y + 2) * T - 2, water: true });
  }
  npcs = m.npcs.map((n) => ({ n, x: n.x * T + T / 2, y: n.y * T + 24, sheet: SP.personSheet(SP.npcLook(n.look, n.role)) }));
  ents.clear();
  fx.clear();
  amb.length = 0;
}

// ───────────────────────────── ambient life ─────────────────────────────

/** Drifting motes: pollen in the open, fireflies and leaves under trees, rain in the city, dust underground. */
const amb = [];
const AMB_N = { town: 16, meadow: 24, forest: 26, city: 80, cave: 26 };
function respawn(p, ox, oy, fresh) {
  const k = theme === "forest" ? (Math.random() < 0.45 ? "fly" : "leaf") : theme === "city" ? "rain" : theme === "cave" ? "dust" : "pollen";
  p.k = k;
  p.x = ox - 20 + Math.random() * (vw + 40);
  p.y = k === "rain" && !fresh ? oy - 10 : oy - 10 + Math.random() * (vh + 20);
  p.max = k === "rain" ? 9 : 3 + Math.random() * 4;
  p.life = fresh ? Math.random() * p.max : p.max;
  p.ph = Math.random() * 6.28;
  p.vx = k === "rain" ? -46 : k === "pollen" ? 5 + Math.random() * 9 : k === "leaf" ? -6 - Math.random() * 8 : (Math.random() - 0.5) * 6;
  p.vy = k === "rain" ? 400 + Math.random() * 120 : k === "leaf" ? 9 + Math.random() * 6 : k === "dust" ? -3 - Math.random() * 4 : (Math.random() - 0.5) * 4;
  p.c = k === "leaf" ? (Math.random() < 0.5 ? "#d89a48" : "#7abf52") : null;
}
function drawAmbient(dt, t, ox, oy) {
  const want = AMB_N[theme] || 20;
  while (amb.length < want) { const p = {}; respawn(p, ox, oy, true); amb.push(p); }
  for (const p of amb) {
    p.life -= dt;
    p.x += (p.vx + (p.k === "fly" ? Math.sin(t / 700 + p.ph) * 9 : p.k === "pollen" || p.k === "leaf" ? Math.sin(t / 900 + p.ph) * 5 : 0)) * dt;
    p.y += (p.vy + (p.k === "fly" ? Math.cos(t / 900 + p.ph) * 7 : 0)) * dt;
    const sx = Math.round(p.x - ox), sy = Math.round(p.y - oy);
    if (p.life <= 0 || sx < -30 || sx > vw + 30 || sy > vh + 20 || sy < -30) { respawn(p, ox, oy, false); continue; }
    const fade = Math.min(1, p.life, p.max - p.life) ;
    if (p.k === "rain") { g.globalAlpha = 0.3; g.fillStyle = "#a8c4ff"; g.fillRect(sx, sy, 1, 6); }
    else if (p.k === "fly") { const a = (0.45 + 0.55 * Math.sin(t / 260 + p.ph * 3)) * fade; g.globalAlpha = a * 0.28; g.fillStyle = "#e8ff8a"; g.fillRect(sx - 1, sy - 2, 3, 5); g.fillRect(sx - 2, sy - 1, 5, 3); g.globalAlpha = a; g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3); g.fillStyle = "#ffffff"; g.fillRect(sx, sy, 1, 1); }
    else if (p.k === "leaf") { g.globalAlpha = fade * 0.9; g.fillStyle = p.c; g.fillRect(sx, sy, 2, 1); g.fillRect(sx + (Math.sin(t / 300 + p.ph) > 0 ? 1 : 0), sy + 1, 1, 1); }
    else if (p.k === "dust") { g.globalAlpha = fade * 0.55; g.fillStyle = "#bfe8ff"; g.fillRect(sx, sy, 1, 1); }
    else { g.globalAlpha = fade * 0.8; g.fillStyle = "#fffbe0"; g.fillRect(sx, sy, 1, 1); if (p.ph > 4) g.fillRect(sx + 1, sy, 1, 1); }
  }
  g.globalAlpha = 1;
}
/** Water never sits still: glints slide across it and foam breathes along the shore. */
function drawWater(t, ox, oy) {
  const beat = Math.floor(t / 520);
  for (const w of waterTiles) {
    if (w.x < ox - T || w.x > ox + vw || w.y < oy - T || w.y > oy + vh) continue;
    const ph = (beat + Math.floor(w.h * 8)) % 4;
    g.fillStyle = "#8accf6";
    g.fillRect(w.x + 3 + ph * 5 + Math.floor(w.h * 6), w.y + 8, 6, 1);
    g.fillRect(w.x + 20 - ph * 4, w.y + 22, 5, 1);
    if (ph === 0 && w.h > 0.6) { g.fillStyle = "#ffffff"; g.fillRect(w.x + 12 + Math.floor(w.h * 10), w.y + 15, 2, 1); }
    if (w.n | w.s | w.w | w.e) {
      g.fillStyle = "#e8f8ff";
      const o = ph % 2;
      if (w.n) g.fillRect(w.x + (o ? 4 : 0), w.y + 5 + o, 12, 1), g.fillRect(w.x + 18 + (o ? 2 : 0), w.y + 6 - o, 10, 1);
      if (w.s) g.fillRect(w.x + (o ? 2 : 6), w.y + T - 7 - o, 12, 1);
      if (w.w) g.fillRect(w.x + 5 + o, w.y + (o ? 4 : 0), 1, 12);
      if (w.e) g.fillRect(w.x + T - 7 - o, w.y + (o ? 14 : 18), 1, 12);
    }
  }
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
/** Everything needed to draw one person: their sheet, and the weapon their gear (or class) calls for. */
function makePerson(look) {
  const wk = SP.weaponKind(look.cls, look.gear);
  return { cls: look.cls, wk, sheet: SP.personSheet(SP.playerLook(look.cls, look.look, look.gear)), weapon: SP.weaponSprite(wk, look.gear), gear: look.gear || {}, h: 0.62 };
}
function personState(id, look) {
  return state(id, JSON.stringify(look), () => makePerson(look));
}
/** Glow by rarity: none, magic, rare, legendary, set. */
const RARITY = [null, "#6aa8ff", "#ffd84a", "#ff8a30", "#5fd47a"];

/**
 * Draw a person and the weapon in their hand. Attacks are not frames: the
 * weapon sprite is turned about its grip — swept through an arc, thrust, or
 * levelled and kicked back.
 */
function drawPerson(s, e, t, dt, x, y) {
  const back = e.dir === 3;
  if (e.dir === 1) s.face = -1; else if (e.dir === 2) s.face = 1;
  if (e.moving) s.walk += dt * 7;
  // a blow that connects freezes for a beat (`e.hs`), then carries on from where it stopped
  const hs = e.hs && e.atkT <= e.hs.at ? e.hs : null;
  const te = !hs || t < hs.at ? t : t < hs.at + hs.dur ? hs.at : t - hs.dur;
  const atk = (te - e.atkT) / 1000;
  if (e.aim && atk < 0.5) s.face = e.aim[0] < e.x ? -1 : 1;
  // walking steps foot to foot; standing still breathes, and blinks now and then
  if (s.ph === undefined) s.ph = Math.random() * 4000;
  const F = SP.FRAME;
  const frame = e.dead ? F.stand
    : e.sit ? F.breathe
    : e.moving ? [F.stepA, F.stretch, F.stepB, F.stretch][Math.floor(s.walk) % 4]
    : (t + s.ph) % 3600 < 140 ? F.blink
    : Math.floor((t + s.ph) / 560) % 2 ? F.breathe : F.stand;
  // facing the camera shows the full face; walking sideways turns it three-quarters
  const img = (back ? s.sheet.back : e.dir === 0 ? s.sheet.front : s.sheet.side)[frame];
  const sg = s.face;
  g.fillStyle = "rgba(20,24,50,.26)";
  g.beginPath(); g.ellipse(x, y, 5, 2, 0, 0, 7); g.fill();
  // a strike leans the whole body into the blow for a moment
  if (e.aim && atk >= 0 && atk < 0.22 && !e.dead) {
    const a = Math.atan2(e.aim[1] - e.y, e.aim[0] - e.x), n = Math.sin((atk / 0.22) * Math.PI) * (e.atkN === 2 ? 8 : 4.5);
    x += Math.cos(a) * n; y += Math.sin(a) * n;
  }
  const body = () => {
    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (e.dead) { g.rotate(sg * 1.45); g.globalAlpha = 0.6; }
    g.scale(sg, e.sit && !e.dead ? 0.8 : 1);       // sitting: tucked down a little
    g.drawImage(img, -SP.FOOT[0], -SP.FOOT[1]);
    g.restore();
  };
  if (!s.weapon || e.dead) return body();
  const hold = SP.HOLD[s.wk] || SP.HOLD.sword;
  // which blow of the three this is: 0 and 1 are the strokes, 2 the finisher (slower, bigger)
  const beat = e.atkN | 0, fin = beat === 2;
  const k = atk / (hold.time * (fin ? 1.25 : 1)), resting = k >= 1;
  const bob = frame === F.stretch ? -1 : frame === F.breathe ? 1 : 0;
  // angles here are canvas angles: 0 points right, positive turns clockwise
  const aim = e.aim && atk < 0.6 ? Math.atan2(e.aim[1] - e.y, e.aim[0] - e.x) : sg > 0 ? 0.25 : Math.PI - 0.25;
  const glow = RARITY[s.gear.wq | 0] || (s.gear.we >= 7 ? "#ffffff" : null);
  if (hold.style === "float") {
    // a spellbook hovers open beside its reader and darts forward to cast
    const out = resting ? 0 : Math.sin(k * Math.PI) * hold.push * (fin ? 2.2 : 1) * (beat === 1 ? -0.6 : 1);
    const big = resting ? 1 : 1 + Math.sin(k * Math.PI) * (fin ? 0.7 : 0.35);
    const bx = x + sg * 9 + Math.cos(aim) * out, by = y - 8 + Math.sin(t / 380 + s.ph) * 1.2 + Math.sin(aim) * out + bob;
    const book = () => {
      g.save();
      if (!resting) { g.shadowColor = "#fff2b0"; g.shadowBlur = 10; } else if (glow) { g.shadowColor = glow; g.shadowBlur = 5; }
      g.translate(Math.round(bx), Math.round(by)); g.scale(big, big);
      g.drawImage(s.weapon, -16, -16);
      g.restore();
    };
    if (back) { book(); body(); } else { body(); book(); }
    return;
  }
  const rest = sg > 0 ? -hold.rest * DEG : Math.PI + hold.rest * DEG;
  if (s.ang === null) s.ang = rest;
  let push = 0, grow = 0;
  if (!resting) {
    // a blow has three parts: draw back, strike, follow through. `w` runs from a
    // little below 0 (the wind-up) to 1 (the end of the stroke) and settles there.
    const sm = (v) => v * v * (3 - 2 * v);
    const w = k < 0.24 ? -0.16 * sm(k / 0.24) : k < 0.62 ? -0.16 + 1.16 * sm((k - 0.24) / 0.38) : 1 + 0.05 * Math.sin(((k - 0.62) / 0.38) * Math.PI);
    const side = beat === 1 ? -sg : sg;                 // the second stroke comes back the other way
    const arc = hold.arc * DEG;
    if (hold.style === "sweep") {
      // a greatsword: left to right, right to left, then an overhead chop that ends on the target
      if (fin) { s.ang = aim - sg * 3.3 + sg * 3.6 * w; push = hold.push + 6 * Math.max(0, w); }
      else { s.ang = aim - side * arc / 2 + side * arc * w; push = hold.push + 1; }
    } else if (hold.style === "stab") {
      // a thrust, a quick cut across, then a long lunge
      if (beat === 1) { s.ang = aim - side * arc / 2 + side * arc * w; push = hold.push * 0.45; }
      else { s.ang = aim; push = (w < 0 ? w * 14 : Math.sin(Math.min(1, w) * Math.PI) * hold.push * (fin ? 1.7 : 1)); }
    } else if (fin) { s.ang = aim + sg * Math.PI * 2 * (1 - Math.max(0, w)); push = hold.push + 3; }   // a full twirl of the staff
    else { s.ang = aim - side * arc * (1 - w); push = hold.push; }
    // mid-stroke the weapon swells toward the eye, and leaves its last two positions behind as a smear
    grow = Math.sin(Math.max(0, Math.min(1, w)) * Math.PI) * hold.grow * (fin ? 1.6 : 1);
    if (!s.smear) s.smear = [];
    s.smear.unshift(s.ang); s.smear.length = Math.min(s.smear.length, 3);
  } else {
    s.smear = null;
    let d = rest - s.ang;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    s.ang += d * Math.min(1, dt * 12);
  }
  // with no arms, the weapon simply floats at the body's side
  const slung = hold.style === "sweep" && resting;
  const hx = x + sg * (slung ? 3 : 7) + Math.cos(s.ang) * push;
  const hy = y - (slung ? 5 : 3) + Math.sin(s.ang) * push + bob;
  const blade = (ang, alpha) => {
    g.save();
    g.translate(Math.round(hx), Math.round(hy));
    g.rotate(ang);
    if (Math.cos(ang) < 0) g.scale(1, -1);
    g.scale(1 + grow, 1 + grow);
    g.globalAlpha = alpha;
    if (glow && alpha === 1) { g.shadowColor = glow; g.shadowBlur = s.gear.we >= 7 ? 9 : 5; }
    g.drawImage(s.weapon, -SP.GRIP[0], -SP.GRIP[1]);
    g.restore();
  };
  const weapon = () => {
    if (s.smear && grow > 0.08) { if (s.smear[2] !== undefined) blade(s.smear[2], 0.16); if (s.smear[1] !== undefined) blade(s.smear[1], 0.34); }
    blade(s.ang, 1);
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
  spark(wx, wy, color = "#ffffff", size = 1) { this.add({ k: "spark", x: wx * P, y: wy * P - 6, color, r: 13 * size, n: size > 1.3 ? 8 : 6, a0: Math.random() * 6.28, dur: 190 }); },
  slash(wx, wy, ang, color, size = 0.8, rev = false) { this.add({ k: "slash", x: wx * P, y: wy * P - 5, ang, color, r: size * 32, rev, dur: 260, delay: 90 }); },
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
      const way = f.rev ? -1 : 1;
      const a0 = f.ang - 1.25 * way, a1 = a0 + 2.5 * way * Math.min(1, k * 1.8), n = 14;
      g.globalAlpha = k < 0.5 ? 1 : 2 - 2 * k;
      g.fillStyle = f.color;
      g.beginPath();
      for (let j = 0; j <= n; j++) { const a = a0 + ((a1 - a0) * j) / n; g.lineTo(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r); }
      for (let j = n; j >= 0; j--) { const a = a0 + ((a1 - a0) * j) / n, w = f.r * (1 - 0.34 * Math.sin((j / n) * Math.PI)); g.lineTo(f.x + Math.cos(a) * w, f.y + Math.sin(a) * w); }
      g.closePath(); g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      for (let j = 0; j <= n; j++) { const a = a0 + ((a1 - a0) * j) / n; g.lineTo(f.x + Math.cos(a) * f.r * 0.97, f.y + Math.sin(a) * f.r * 0.97); }
      for (let j = n; j >= 0; j--) { const a = a0 + ((a1 - a0) * j) / n, w = f.r * (0.97 - 0.14 * Math.sin((j / n) * Math.PI)); g.lineTo(f.x + Math.cos(a) * w, f.y + Math.sin(a) * w); }
      g.closePath(); g.fill();
    } else if (f.k === "spark") {
      // an impact: a white core and spokes thrown outward
      g.globalAlpha = 1 - k;
      g.fillStyle = f.color;
      for (let j = 0; j < f.n; j++) {
        const a = f.a0 + (j / f.n) * Math.PI * 2, r0 = f.r * (0.25 + 0.5 * k), r1 = f.r * (0.6 + 0.9 * k), w = Math.max(1, Math.round(3 * (1 - k)));
        for (let q = 0; q <= 4; q++) { const r = r0 + ((r1 - r0) * q) / 4; g.fillRect(Math.round(f.x + Math.cos(a) * r - w / 2), Math.round(f.y + Math.sin(a) * r - w / 2), w, w); }
      }
      if (k < 0.35) { g.fillStyle = "#ffffff"; const c = Math.round(f.r * 0.45 * (1 - k)); g.fillRect(Math.round(f.x - c), Math.round(f.y - c), c * 2, c * 2); }
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
const DARK = { forest: ["#06242a", 0.3], city: ["#0a0e30", 0.52], cave: ["#060a22", 0.48] };
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
  drawWater(t, ox, oy);
  for (const s of smokers) if (s.x > ox - 20 && s.x < ox + vw + 20 && s.y > oy - 60 && s.y < oy + vh && Math.random() < 0.07) parts.push({ x: s.x + Math.random() * 4, y: s.y, vx: 5 + Math.random() * 5, vy: -13, life: 1.3 + Math.random(), color: "#eef0f6", g: -5, s: 3 });

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
  if (G.fires) for (const f of G.fires.values()) list.push({ y: f.y * P, f });
  if (G.bobs) for (const b of G.bobs.values()) list.push({ y: b.y * P - 1, b });
  for (const m of G.mobs.values()) list.push({ y: m.y * P, m });
  for (const [eid, p] of G.players) list.push({ y: p.y * P, p, eid });
  list.push({ y: G.me.y * P, p: G.me, eid: G.you });
  list.sort((a, b) => a.y - b.y);
  for (const s of ents.values()) s.seen = false;

  const meX = G.me.x * P, meY = G.me.y * P;
  for (const o of list) {
    if (o.s) {
      const st = o.s, sp = st.sp, dx = Math.round(st.x - sp.width / 2), dy = Math.round(st.y - sp.height + 2);
      // tall things in front of you turn translucent
      const hides = sp.height > 60 && st.y > meY && meX > dx + 6 && meX < dx + sp.width - 6 && meY - 20 > dy;
      if (hides) g.globalAlpha = 0.42;
      g.drawImage(sp, dx, dy);
      g.globalAlpha = 1;
      // a neon sign that sputters, a crystal that catches the light, a fountain that splashes
      if (st.neon && Math.sin(t / 130 + st.ph) + Math.sin(t / 71 + st.ph * 3) > 1.55) { g.globalAlpha = 0.55; g.fillStyle = "#181a22"; g.fillRect(dx + 12, dy + 148, 112, 14); g.globalAlpha = 1; }
      if (st.glint >= 0 && Math.sin(t / 420 + st.glint) > 0.86) { g.fillStyle = "#ffffff"; g.fillRect(dx + 16, dy + 6, 5, 1); g.fillRect(dx + 18, dy + 4, 1, 5); }
      if (st.water && Math.random() < 0.45) parts.push({ x: st.x - 9 + Math.random() * 18, y: st.y - 52, vx: (Math.random() - 0.5) * 34, vy: -24 - Math.random() * 20, life: 0.55, color: "#dff4ff", g: 170, s: 2 });
    } else if (o.n) {
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(o.n.x, o.n.y, 5, 2, 0, 0, 7); g.fill();
      const nt = t + o.n.x * 37, nf = nt % 3900 < 140 ? SP.FRAME.blink : Math.floor(nt / 620) % 2 ? SP.FRAME.breathe : SP.FRAME.stand;
      g.drawImage(o.n.sheet.front[nf], Math.round(o.n.x - SP.FOOT[0]), Math.round(o.n.y - SP.FOOT[1]));
    } else if (o.f) {
      // a campfire: warm light on the ground, a flickering flame, sparks drifting up
      const x = o.f.x * P, y = o.f.y * P, fr = SP.campfire()[Math.floor(t / 140 + o.f.id) % 3];
      g.fillStyle = "rgba(255,170,60,.13)"; g.beginPath(); g.ellipse(x, y - 2, 30, 14, 0, 0, 7); g.fill();
      g.drawImage(fr, Math.round(x - SP.FOOT[0]), Math.round(y - SP.FOOT[1] + 2));
      if (Math.random() < 0.12) parts.push({ x: x - 3 + Math.random() * 6, y: y - 16, vx: (Math.random() - 0.5) * 10, vy: -18 - Math.random() * 14, life: 0.7, color: Math.random() < 0.5 ? "#ffd070" : "#ff9040", g: -10, s: 1 });
    } else if (o.b) {
      // a fishing float riding the water, its line running back to the angler
      const bx = Math.round(o.b.x * P), by = Math.round(o.b.y * P + Math.sin(t / 260) * 1.2 + (o.b.bite ? Math.sin(t / 40) * 2 : 0));
      const who = o.b.eid === G.you ? G.me : G.players.get(o.b.eid);
      g.lineWidth = 1;
      if (who) { g.strokeStyle = "rgba(240,240,255,.6)"; g.beginPath(); g.moveTo(bx, by - 4); g.lineTo(Math.round(who.x * P) + 4, Math.round(who.y * P) - 12); g.stroke(); }
      g.strokeStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(bx, by + 1, 4 + ((t / 200) % 3), 1.5, 0, 0, 7); g.stroke();
      g.fillStyle = "#2b2233"; g.fillRect(bx - 2, by - 4, 4, 5); g.fillStyle = "#ffffff"; g.fillRect(bx - 1, by - 3, 2, 1); g.fillStyle = "#e84a5a"; g.fillRect(bx - 1, by - 2, 2, 2);
    } else if (o.d) {
      const d = o.d, x = d.x * P, y = d.y * P, ic = G.icons.cv[d.it];
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(x, y, 8, 3, 0, 0, 7); g.fill();
      if (d.q) { g.fillStyle = RARITY[d.q]; g.globalAlpha = 0.3 + 0.15 * Math.sin(t / 180 + d.id); g.fillRect(x - 2, y - 26 - d.q * 16, 4, d.q * 16 + 22); g.globalAlpha = 1; }
      if (ic) g.drawImage(ic, Math.round(x - 8), Math.round(y - 18 + Math.sin(t / 220 + d.id) * 2), 16, 16);
    } else if (o.m) {
      const m = o.m, kind = G.defs.mobs[m.k].sp, x = m.x * P, y = m.y * P, el = m.el | 0;
      // an elite glows gold; a field boss is twice the size and glows like the rift
      const s = state("m" + m.id, kind + ":" + el, () => { const z = SP.MOB_SIZE[kind] || [1, 0]; return { frames: SP.monsterSheet(kind), size: z[0] * (el === 2 ? 2 : 1), hover: z[1] * (el === 2 ? 1.5 : 1), px: m.x }; });
      if (m.x > s.px + 0.05) s.face = -1; else if (m.x < s.px - 0.05) s.face = 1;
      s.px = m.x;
      const img = s.frames[Math.floor(t / (m.moving ? 180 : 360) + m.id) % 2], w = SP.SIZE * s.size;
      const a = t - m.atkT, lunge = a < 220 ? Math.sin((a / 220) * Math.PI) * 6 * -s.face : 0;
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(x, y, w * 0.24, w * 0.09, 0, 0, 7); g.fill();
      if (el) {
        const pulse = 0.55 + 0.3 * Math.sin(t / 160 + m.id);
        g.strokeStyle = el === 2 ? `rgba(255,110,214,${pulse})` : `rgba(255,196,64,${pulse})`; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x, y, w * 0.3, w * 0.12, 0, 0, 7); g.stroke();
        if (el === 2) { g.strokeStyle = `rgba(138,232,248,${pulse * 0.8})`; g.beginPath(); g.ellipse(x, y, w * 0.38 + Math.sin(t / 240) * 2, w * 0.15, 0, 0, 7); g.stroke(); }
        if (Math.random() < (el === 2 ? 0.3 : 0.1)) parts.push({ x: x + (Math.random() - 0.5) * w * 0.5, y: y - Math.random() * w * 0.4, vx: 0, vy: -22, life: 0.5, color: el === 2 ? "#ff8ae0" : "#ffe08a", g: 0, s: 1 });
      }
      g.save();
      const hk = (t - m.hurtT) / 200, rec = hk < 1 ? (1 - hk) * (1 - hk) : 0;
      const pow = m.hurtP || 1;
      const jx = rec ? Math.cos(m.hurtA || 0) * rec * 8 * pow + Math.sin(t / 14) * rec * 2 : 0, jy = rec ? Math.sin(m.hurtA || 0) * rec * 5 * pow : 0;
      g.translate(Math.round(x + lunge + jx), Math.round(y + jy - s.hover - (s.hover ? Math.sin(t / 320 + m.id) * 2 : 0)));
      g.scale(s.face * (1 + rec * 0.24), 1 - rec * 0.2);
      if (t - m.hurtT < 110) g.filter = "brightness(2.2)";
      else if (el) { g.shadowColor = el === 2 ? "#ff5ad0" : "#ffc040"; g.shadowBlur = el === 2 ? 8 : 4; }
      g.drawImage(img, -w / 2, -w * (SP.FOOT[1] / SP.SIZE), w, w);
      g.restore();
      m.h3 = (w * (kind === "boss" ? 0.92 : 0.72) + s.hover) / 26;
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
    const sz = p.s || 3;
    g.globalAlpha = clamp(p.life * 3, 0, 1); g.fillStyle = p.color; g.fillRect(Math.round(p.x) - (sz >> 1), Math.round(p.y) - (sz >> 1), sz, sz);
  }
  g.globalAlpha = 1;

  // darkness, with pools of light cut out of it
  const dark = DARK[theme];
  if (dark) {
    if (!lightCv) [lightCv, lg] = sheet(vw, vh);
    if (lightCv.width !== vw || lightCv.height !== vh) { lightCv.width = vw; lightCv.height = vh; }
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, vw, vh);
    lg.globalAlpha = dark[1]; lg.fillStyle = dark[0]; lg.fillRect(0, 0, vw, vh); lg.globalAlpha = 1;
    lg.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, k = 1) => { const sx = x - ox, sy = y - oy; if (sx < -r || sy < -r || sx > vw + r || sy > vh + r) return; const gr = lg.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, "rgba(0,0,0,0)"); lg.fillStyle = gr; lg.fillRect(sx - r, sy - r, r * 2, r * 2); };
    hole(meX, meY - 8, 130, 0.9);
    for (const o of list) { if (o.f) hole(o.f.x * P, o.f.y * P - 8, 120, 0.95); else if (o.p && o.eid !== G.you) hole(o.p.x * P, o.p.y * P - 20, 110, 0.8); else if (o.s && o.s.glow) hole(o.s.x, o.s.y - (o.s.big ? 60 : o.s.sp.height - 12), o.s.big ? 120 : o.s.glow === "#ffe690" ? 110 : 60, 0.85); else if (o.d && o.d.q) hole(o.d.x * P, o.d.y * P - 10, 36, 0.7); else if (o.m && SP.MOB_GLOW[G.defs.mobs[o.m.k].sp]) hole(o.m.x * P, o.m.y * P - 14, o.m.el === 2 ? 90 : 48, 0.75); }
    for (const p of map.portals) hole(p.x * T + 16, p.y * T + 16, 80, 0.8);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(lightCv, 0, 0);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawAmbient(dt, t, ox, oy);
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
  const cast = draft ? [draft] : [playerLook("warrior", [1, 0, 0, 0, 0, 0, 1], { wt: 3 }), playerLook("mage", [0, 2, 1, 3, 0, 0, 4], { wt: 3 }), playerLook("lancer", [3, 1, 2, 7, 2, 3, 3], { wt: 3 }), playerLook("rogue", [2, 4, 3, 8, 3, 0, 0], { wt: 2 })];
  stage = { draft: !!draft, cast: cast.map((look, i) => ({ s: { key: "", face: 1, walk: 0, ang: null, ...makePerson(look) }, i })) };
  map = null;
}
export function leaveStage() { stage = null; }
export function renderStage(dt, t) {
  if (!cv || !stage) return;
  const S = scenery();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#6cbf5e"; g.fillRect(0, 0, vw, vh);
  // a strip of meadow scrolling past
  const scroll = stage.draft ? 0 : (t / 28) % 64;
  for (let x = -64; x < vw + 64; x += 32) for (let y = 0; y < vh; y += 32) {
    const hx = Math.floor((x + scroll) / 32) + (stage.draft ? 0 : Math.floor(t / 28 / 64) * 2), h = hash(hx, y, 1);
    g.fillStyle = "#57a850"; const px = x - (stage.draft ? 0 : scroll % 32);
    g.fillRect(px + 4 + h * 20, y + 6 + hash(hx, y, 2) * 18, 2, 4); g.fillRect(px + 7 + h * 20, y + 7 + hash(hx, y, 2) * 18, 2, 3);
  }
  const gy = Math.round(vh * 0.62);
  g.fillStyle = "#d9ab6c"; g.fillRect(0, gy - 6, vw, 30); g.fillStyle = "#8f6238"; g.fillRect(0, gy - 6, vw, 1); g.fillRect(0, gy + 23, vw, 1); g.fillStyle = "#bd8c54"; g.fillRect(0, gy - 5, vw, 2); g.fillRect(0, gy + 21, vw, 2);
  if (!stage.draft) for (let i = 0; i < Math.ceil(vw / 150) + 2; i++) { const x = ((i * 150 - (t / 28) % 150) + 150) % (vw + 150) - 60, sp = i % 2 ? S.T[i % 4] : S.P[0]; g.drawImage(sp, Math.round(x), gy - 20 - sp.height); g.drawImage(S.B[i % 3], Math.round(x + 70), gy + 40); }
  const cx = Math.round(vw / 2);
  stage.cast.forEach(({ s, i }) => {
    if (stage.draft) {
      const k = (t % 3200) / 1000, dir = [2, 1, 3, 2][Math.floor(t / 3200) % 4], z = Math.max(3, Math.round(15 / Z));
      g.save(); g.translate(cx + Math.min(120, vw * 0.18), gy + 34); g.scale(z, z);
      drawPerson(s, { x: 0, y: 0, dir, moving: k > 1 && k < 2.2, atkT: k > 2.5 ? t - (k - 2.5) * 1000 : -1e9, dead: false, aim: k > 2.5 ? [dir === 1 ? -40 : 40, 6] : null }, t, dt, 0, 0);
      g.restore();
    } else drawPerson(s, { x: 0, y: 0, dir: 2, moving: true, atkT: -1e9, dead: false, aim: null }, t, dt, cx - 66 + i * 44, gy + 12);
  });
}
