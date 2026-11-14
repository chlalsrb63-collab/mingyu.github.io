/**
 * The world, seen from the diagonal (a 2:1 quarter view) in chunky pixels.
 *
 * Ground, scenery, creatures and effects are all painted here in one style:
 * flat colours, one shadow tone, and a thick dark outline around everything
 * that stands up. People and monsters come from sprites.js; a weapon is a
 * separate sprite that is rotated around the hand, so an attack is the weapon
 * itself being swung.
 *
 * Units: the server speaks in sixteenths of a tile, on a square grid. The
 * ground is laid out in that square grid first ("world pixels", one tile = 32,
 * one server unit = 2) and then projected onto diamonds: a server point
 * (wx, wy) lands at iso pixel (wx − wy, (wx + wy) / 2), so one tile is a
 * 32×16 diamond and a character (32 px) is about a tile wide. Everything that
 * stands up is drawn upright at its projected foot and painted back to front
 * by wx + wy. The view is scaled by a whole number so every pixel stays square.
 */

import * as SP from "./sprites.js";
import * as Sw from "./swing.js";
import * as DC from "./decor.js";
import * as IT from "./isotiles.js";
import * as Art from "./art.js";
import * as MA from "./mobart.js";
import * as Sky from "./sky.js";
import * as Camp from "./camp.js";
import { HUE, hueAt } from "./autumn.js";
import * as IN from "./iso_interior.js";

const T = 32, P = 2;
/** Iso pixels per server unit along the screen's x; y is half that. Height lifts by 26 px per unit `h`. */
const K = 1, LIFT = 26;
/** Server units → iso pixels (camera-free). */
export function iso(wx, wy, h = 0) { return [(wx - wy) * K, ((wx + wy) * K) / 2 - h * LIFT]; }
/** World pixels (the square ground's, two per server unit) → iso pixels. */
const sqI = (u, v) => [((u - v) * K) / 2, ((u + v) * K) / 4];
/** Tile coordinates (fractions allowed) → iso pixels. */
const tI = (tx, ty) => [(tx - ty) * 16 * K, (tx + ty) * 8 * K];
/** The screen angle (canvas convention) of a direction on the ground. */
export function sAng(dx, dy) { return Math.atan2((dx + dy) / 2, dx - dy); }
/** The matrix that lays world-pixel drawing flat onto the diamond ground. */
const FLAT = [K / 2, K / 4, -K / 2, K / 4];
const DXW = [0, -1, 1, 0], DYW = [1, 0, 0, -1];
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
/** Fit the world to a W×H screen rect (the HUD passes the play viewport; default the whole window). */
export function resize(W = innerWidth, H = innerHeight, zoom = 0) {
  if (!cv) return;
  // about 440×256 world pixels on screen, so the small sprites stay readable
  Z = Math.max(1, Math.round(Math.min(W / 440, H / 256)));
  if (W < 560) Z = Math.max(2, Math.round(W / 220));
  if (zoom) Z = zoom;                    // preview pages ask for a fixed zoom (1 = the whole map at world size)
  vw = Math.ceil(W / Z); vh = Math.ceil(H / Z);
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
    // a standing stone, leaning a little, with moss at its foot
    O: [0, 1].map((v) => prop(24, 46, (b) => {
      const lit = "#cfd0dc", mid = "#a2a4b6", dk2 = "#74768c", ln = "#5e6076";
      b.tri([[2, 45], [22, 45], [20, 8], [14, 1], [5, 5]], mid);
      b.tri([[14, 1], [20, 8], [22, 45], [16, 45]], dk2);
      b.tri([[5, 5], [14, 1], [12, 7], [4, 12]], lit);
      b.r(4, 12, 2, 30, lit); b.r(16, 9, 1, 34, ln);
      b.r(8, 18, 4, 1, ln); b.r(9, 19, 1, 4, ln); b.r(9, 22, 4, 1, ln); b.r(12, 15, 1, 8, ln);          // a carved mark, worn almost away
      if (v) { b.r(8, 30, 5, 1, ln); b.r(10, 27, 1, 6, ln); } else { b.r(7, 32, 1, 3, ln); b.r(8, 34, 4, 1, ln); }
      b.r(2, 40, 9, 5, "#6ab85a"); b.r(3, 38, 4, 2, "#6ab85a"); b.r(16, 42, 6, 3, "#4faa5a"); b.r(3, 39, 2, 1, "#9ad884");
      b.r(0, 44, 24, 2, "#4e5a4a");
    })),
    // a dead tree: bare branches, bark gone grey
    A: [0, 1].map((v) => prop(40, 58, (b) => {
      const bark = "#6e5e50", dark = "#4c4036", lit = "#8e7e6c";
      const br = (x0, y0, x1, y1, w) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) b.r(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, w, bark); };
      b.r(17, 24, 7, 32, bark); b.r(21, 24, 3, 32, dark); b.r(17, 24, 1, 32, lit);
      b.r(12, 53, 17, 4, bark); b.r(10, 55, 4, 2, dark); b.r(27, 55, 5, 2, dark);
      if (v) { br(19, 30, 5, 13, 3); br(6, 15, 2, 5, 2); br(6, 15, 11, 5, 2); br(21, 27, 34, 10, 3); br(32, 12, 37, 3, 2); br(20, 25, 22, 2, 3); }
      else { br(19, 28, 7, 10, 3); br(9, 12, 9, 2, 2); br(21, 30, 35, 16, 3); br(33, 17, 38, 8, 2); br(33, 17, 28, 6, 2); br(20, 25, 16, 3, 3); br(17, 5, 21, 0, 2); }
      b.oval(20, 40, 2, 3.4, "#2a2420"); b.r(18, 33, 1, 5, dark);
      if (v) for (const [x, y] of [[8, 14], [30, 14]]) { b.r(x, y, 1, 7, "#7a8a5a"); b.r(x + 1, y + 2, 1, 4, "#5a6a42"); }
    })),
    // great mushrooms, red or amber caps flecked white
    Y: [["#d0503e", "#fff4e4"], ["#e09a3a", "#fff4e4"]].map(([cap, spot]) => prop(30, 32, (b) => {
      b.r(12, 15, 7, 15, "#efe4cc"); b.r(16, 15, 3, 15, "#cfc2a6"); b.r(10, 28, 11, 3, "#efe4cc");
      b.oval(15, 12, 14, 8, dk(cap, 0.66)); b.oval(15, 10, 14, 8, cap); b.oval(10, 7, 6, 3.4, lt(cap, 1.25));
      b.r(4, 16, 22, 2, "#e8dcc0");
      for (const [x, y] of [[6, 9], [15, 5], [21, 9], [11, 12]]) b.r(x, y, 3, 2, spot);
      b.r(24, 25, 2, 6, "#efe4cc"); b.oval(25, 24, 4, 2.6, cap); b.r(24, 23, 1, 1, spot);
    })),
    // underground, they glow
    Y2: [["#3ac8c0", "#d8fffa"], ["#6a8ae8", "#e8f0ff"]].map(([cap, spot]) => prop(30, 32, (b) => {
      b.r(12, 15, 7, 15, "#dff4ff"); b.r(16, 15, 3, 15, "#a8c8d8"); b.r(10, 28, 11, 3, "#dff4ff");
      b.oval(15, 12, 14, 8, dk(cap, 0.6)); b.oval(15, 10, 14, 8, cap); b.oval(10, 7, 6, 3.4, lt(cap, 1.3));
      b.r(4, 16, 22, 2, lt(cap, 1.45));
      for (const [x, y] of [[6, 9], [15, 5], [21, 9], [11, 12]]) b.r(x, y, 3, 2, spot);
      b.r(24, 25, 2, 6, "#dff4ff"); b.oval(25, 24, 4, 2.6, cap);
    })),
    // a blood altar: a slab of flesh-stone, a bowl brimming, candles of tallow
    X: prop(40, 34, (b) => {
      b.r(4, 14, 32, 18, "#5a1622"); b.r(4, 14, 32, 3, "#8c2c3a"); b.r(30, 16, 6, 16, "#3c0e16");
      b.r(2, 10, 36, 6, "#9e4855"); b.r(2, 10, 36, 1, "#ba5e6a"); b.r(2, 15, 36, 1, "#5a1622");
      b.oval(20, 11, 9, 3, "#3c0e16"); b.oval(20, 11, 8, 2.2, "#c41830"); b.r(15, 10, 4, 1, "#ff6a7a");
      for (const x of [5, 33]) { b.r(x, 2, 2, 9, "#f2ead0"); b.r(x, 0, 2, 3, "#ffb030"); b.r(x, 0, 1, 1, "#fff0a0"); }
      b.r(10, 16, 1, 6, "#c41830"); b.r(24, 16, 1, 9, "#c41830"); b.r(24, 25, 2, 1, "#c41830");
      b.r(7, 31, 10, 2, "#e2dcc6"); b.r(6, 30, 2, 4, "#f4f0e0"); b.r(16, 30, 2, 4, "#f4f0e0");
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
  SC.AU = autumnScenery(rock);
  // ── dungeon furniture: the crypt's dead, the sewer's plumbing, the abyss's anatomy
  const BONE = "#e2dcc6", BONE_D = "#a8a08a", BONE_L = "#f4f0e0";
  Object.assign(SC, {
    // a stone sarcophagus, its lid carved with a cross
    1: prop(30, 24, (b) => {
      b.r(1, 8, 28, 15, "#7a746a"); b.r(1, 18, 28, 5, "#5a5550"); b.r(24, 9, 5, 14, "#5a5550");
      b.r(0, 3, 30, 7, "#989080"); b.r(0, 3, 30, 1, "#b8b09c"); b.r(0, 9, 30, 1, "#6a645c");
      b.r(13, 4, 4, 5, "#6a645c"); b.r(10, 5, 10, 2, "#6a645c");
      b.r(4, 13, 2, 6, "#5a5550"); b.r(12, 13, 2, 6, "#5a5550"); b.r(20, 13, 2, 6, "#5a5550");
    }),
    // a coffin stood against the wall, lid ajar
    2: [0, 1].map((v) => prop(20, 38, (b) => {
      b.tri([[4, 0], [16, 0], [20, 10], [16, 38], [4, 38], [0, 10]], "#6a4a34"); b.tri([[10, 0], [16, 0], [20, 10], [16, 38], [10, 38]], "#523624");
      b.r(5, 2, 10, 1, "#8a6646"); b.r(9, 8, 2, 12, "#3a2618"); b.r(6, 12, 8, 2, "#3a2618");
      if (v) { b.tri([[13, 2], [16, 2], [19, 10], [16, 36], [13, 36]], "#1a1216"); b.r(14, 16, 3, 2, BONE); b.r(14, 19, 2, 1, BONE_D); }
      b.r(4, 36, 12, 2, "#3a2618");
    })),
    // an iron stand of candles, burning low
    3: prop(16, 34, (b) => {
      b.r(7, 12, 2, 18, "#3a3c48"); b.r(3, 30, 10, 3, "#3a3c48"); b.r(1, 32, 14, 2, "#2a2c36"); b.r(1, 11, 14, 2, "#4a4c5a");
      for (const [x, h] of [[1, 5], [7, 8], [13, 4]]) { b.r(x, 11 - h, 2, h, "#f2ead0"); b.r(x + 1, 11 - h, 1, h, "#cfc6a8"); b.r(x, 8 - h, 2, 3, "#ffb030"); b.r(x, 7 - h, 1, 2, "#fff0a0"); }
    }),
    // a heap of bones with a skull on top
    4: [0, 1].map((v) => prop(28, 16, (b) => {
      b.r(2, 10, 24, 5, BONE_D); b.r(4, 8, 20, 3, BONE); b.r(1, 12, 8, 2, BONE); b.r(18, 12, 9, 2, BONE); b.r(0, 11, 2, 4, BONE_L); b.r(26, 11, 2, 4, BONE_L);
      b.r(6, 9, 1, 5, BONE_D); b.r(13, 10, 1, 4, "#7a7462"); b.r(20, 9, 1, 5, BONE_D);
      const x = v ? 15 : 7;
      b.r(x, 1, 8, 7, BONE); b.r(x + 1, 8, 6, 2, BONE); b.r(x, 1, 8, 1, BONE_L); b.r(x + 1, 4, 2, 2, "#2f2a29"); b.r(x + 5, 4, 2, 2, "#2f2a29"); b.r(x + 3, 7, 2, 1, "#2f2a29"); b.r(x + 2, 9, 1, 1, "#7a7462"); b.r(x + 4, 9, 1, 1, "#7a7462");
    })),
    // a pillar of stacked stone under a capital of skulls
    5: prop(20, 46, (b) => {
      b.r(4, 8, 12, 32, "#7a746a"); b.r(12, 8, 4, 32, "#5a5550"); b.r(4, 8, 2, 32, "#989080");
      for (let y = 16; y < 38; y += 8) b.r(4, y, 12, 1, "#5a5550");
      b.r(1, 40, 18, 6, "#6a645c"); b.r(1, 40, 18, 1, "#989080"); b.r(1, 44, 18, 2, "#4a4642");
      b.r(1, 2, 18, 7, "#989080"); b.r(1, 2, 18, 1, "#b8b09c"); b.r(1, 8, 18, 1, "#5a5550");
      for (const x of [3, 11]) { b.r(x, 3, 6, 5, BONE); b.r(x + 1, 5, 1, 2, "#2f2a29"); b.r(x + 4, 5, 1, 2, "#2f2a29"); }
    }),
    // a chapel altar: a stone table under a wine-red cloth, a skull, an open book and a gold cup on top
    9: prop(32, 28, (b) => {
      b.r(1, 14, 26, 13, "#8a8478"); b.r(27, 13, 5, 14, "#5a5550"); b.r(1, 25, 31, 2, "#4a4642");
      b.r(0, 8, 32, 6, "#b8b09c"); b.r(0, 8, 32, 1, "#d2c8b0"); b.r(0, 13, 32, 1, "#6a645c");
      b.r(10, 8, 11, 6, "#7a2a3a"); b.r(10, 14, 11, 10, "#7a2a3a"); b.r(10, 14, 11, 1, "#5a1e2c"); b.r(19, 14, 2, 10, "#5a1e2c");
      b.r(10, 23, 11, 1, "#c8a050"); b.r(14, 16, 2, 6, "#c8a050"); b.r(12, 18, 6, 2, "#c8a050");
      b.r(2, 3, 6, 5, BONE); b.r(2, 3, 6, 1, BONE_L); b.r(3, 5, 1, 1, "#2f2a29"); b.r(6, 5, 1, 1, "#2f2a29"); b.r(3, 8, 4, 1, BONE_D);
      b.r(11, 6, 9, 2, "#f2ead0"); b.r(11, 5, 4, 1, "#f2ead0"); b.r(16, 5, 4, 1, "#f2ead0"); b.r(15, 5, 1, 3, "#8a8070");
      b.r(24, 1, 5, 3, "#e0b860"); b.r(24, 1, 5, 1, "#f4dc90"); b.r(25, 4, 3, 2, "#c8a050"); b.r(24, 6, 5, 2, "#8a6a34");
    }),
    // a pew, seen from behind: a slanted back-board along the row (two ways: along x, along y)
    I: [0, 1].map((v) => prop(24, 30, (b) => {
      const face = v ? ["#5a3a22", "#7a5030", "#3a2416", "#9a6a3c"] : ["#6a4226", "#8a5a34", "#4a2e1a", "#b08048"];
      for (let i = 0; i < 18; i++) {
        const x = v ? 20 - i : 3 + i, yb = 21 + (i >> 1);
        b.r(x, yb - 9, 1, 2, face[3]);            // the seat behind, catching the light
        b.r(x, yb - 7, 1, 1, face[1]);            // the top rail
        b.r(x, yb - 6, 1, 7, face[0]);            // the board
        b.r(x, yb - 3, 1, 1, face[2]);            // a groove
        b.r(x, yb + 1, 1, 1, face[2]);            // its foot
      }
      for (const i of [0, 17]) { const x = v ? 20 - i : 3 + i, yb = 21 + (i >> 1); b.r(x - (v ? 1 : 0), yb - 10, 2, 12, face[2]); b.r(x - (v ? 1 : 0), yb - 10, 1, 1, face[3]); }
    })),
    // a pipe mouth in the wall, drooling
    6: [0, 1].map((v) => prop(24, 30, (b) => {
      b.r(2, 2, 20, 14, "#6a7280"); b.r(2, 2, 20, 2, "#98a2b2"); b.r(2, 13, 20, 3, "#48505e"); b.r(0, 0, 4, 18, "#7a8494"); b.r(20, 0, 4, 18, "#565e6e");
      b.oval(12, 9, 7, 5, "#1a1e22"); b.oval(12, 10, 5, 3, "#2c3a26");
      b.r(9, 12, 6, 12 + v * 4, "#6a9a3a"); b.r(9, 12, 2, 12 + v * 4, "#8cc054"); b.r(8, 24 + v * 4, 8, 2, "#5a8a30"); b.r(6, 26 + v * 4, 12, 2, "#6a9a3a");
      b.r(1, 5, 2, 2, "#3a4048"); b.r(21, 5, 2, 2, "#3a4048");
    })),
    // a rusted drum, banded and leaking
    7: [0, 1].map((v) => prop(20, 28, (b) => {
      const c = v ? "#8a5a3a" : "#5a7a6a";
      b.r(2, 3, 16, 23, c); b.r(1, 6, 18, 17, c); b.r(13, 4, 5, 21, dk(c, 0.76)); b.r(4, 7, 2, 14, lt(c, 1.25));
      b.r(1, 8, 18, 2, "#3a3c48"); b.r(1, 19, 18, 2, "#3a3c48"); b.oval(10, 4, 8, 3, lt(c, 1.18)); b.oval(10, 4, 5, 1.6, dk(c, 0.8));
      if (v) { b.r(6, 12, 8, 5, "#e8c040"); b.r(8, 13, 4, 3, "#2a2c36"); } else { b.r(3, 22, 3, 5, "#6a9a3a"); b.r(1, 26, 8, 2, "#5a8a30"); }
    })),
    // ribs rising out of the ground, curving in over the path
    8: [0, 1].map((v) => prop(30, 42, (b) => {
      for (const [x, s] of [[3, 1], [26, -1]]) {
        for (let i = 0; i < 9; i++) { const y = 40 - i * 4, bx = x + s * Math.round(Math.sin((i / 9) * 1.5) * (v ? 9 : 7)); b.r(bx - 1, y - 4, 4, 5, i % 2 ? BONE : BONE_L); b.r(bx + (s > 0 ? 2 : -1), y - 4, 1, 5, BONE_D); }
      }
      b.r(0, 38, 8, 4, "#5c1e2b"); b.r(22, 38, 8, 4, "#5c1e2b"); b.r(1, 37, 5, 1, "#9e4855"); b.r(24, 37, 5, 1, "#9e4855");
    })),
    // 질주의 바람: a wind shrine — a carved plinth with a glowing rune, a pole, a long green pennant streaming in the wind
    "/": prop(26, 46, (b) => {
      b.r(4, 36, 18, 7, "#8f93a3"); b.r(4, 36, 18, 2, "#b4b8c6"); b.r(18, 38, 4, 5, "#6e7284"); b.r(2, 42, 22, 4, "#6a6e80"); b.r(2, 42, 22, 1, "#8f93a3");
      b.r(8, 39, 2, 2, "#5ae4a0"); b.r(11, 39, 4, 1, "#5ae4a0"); b.r(16, 39, 1, 2, "#5ae4a0");
      b.r(12, 4, 3, 33, "#8a5a34"); b.r(14, 4, 1, 33, "#6a4226"); b.r(11, 1, 5, 4, "#e0c070"); b.r(11, 1, 5, 1, "#fff0b0");
      b.tri([[15, 6], [26, 10], [21, 12], [26, 16], [15, 17]], "#3fae72");
      b.tri([[15, 6], [26, 10], [15, 11]], "#7ae0a4");
      b.r(16, 7, 4, 1, "#c8ffe0"); b.r(18, 14, 5, 1, "#2a8a58");
    }),
    // a stalk of flesh with an eye at the end of it
    0: [0, 1].map((v) => prop(22, 30, (b) => {
      b.r(8, 12, 6, 16, "#8c2c3a"); b.r(12, 12, 2, 16, "#5a1622"); b.r(8, 14, 1, 10, "#ba4e5a"); b.r(4, 26, 14, 4, "#6e2230"); b.r(4, 26, 14, 1, "#9e4855");
      b.oval(11, 8, 9, 8, "#8c2c3a"); b.oval(11, 8, 7, 6, "#f4ecd8"); b.oval(11 + (v ? 1 : -1), 8, 3.4, 3.6, "#c41830"); b.r(10 + (v ? 1 : -1), 7, 2, 3, "#19070c"); b.r(8, 5, 2, 1, "#ffffff");
      b.r(3, 16, 2, 5, "#8c2c3a"); b.r(17, 18, 2, 4, "#8c2c3a");
    })),
  });
  return SC;
}

/**
 * 단풍 왕도 — the fallen kingdom's things, used in place of the usual ones on an autumn map:
 * broadleaf trees in four turned colours (two shapes each), shrubs and graveyard roses,
 * leaning headstones, rotted royal banners, an old king's statue, rubble where a big ruin
 * would stand if its picture found no room, dead trees with an eye in the bark, and the
 * blight's toadstools. `T` is picked by autumn.js hueAt so trees match the litter below.
 */
function autumnScenery(rock) {
  const bark = "#6a4e3a", barkD = "#43302a", barkL = "#8a6a4e";
  const STONE = ["#d2ccba", "#aaa494", "#7e786a", "#e6e2d4"], MOSS = "#5f7a3a", BL = "#9a5ad0", BLL = "#d6a0ff";
  const trunk = (b, x, y, w, h) => {
    b.r(x, y, w, h, bark); b.r(x + w - 3, y, 3, h, barkD); b.r(x + 1, y + 2, 1, h - 6, barkL);
    b.r(x - 3, y + h - 3, w + 6, 3, bark); b.r(x - 4, y + h - 1, 4, 1, barkD); b.r(x + w, y + h - 1, 5, 1, barkD);
  };
  // a round crown (oak, ginkgo): a dark mass, mid clusters, lit clusters to the upper left, a few dark gaps
  const round = (hue) => prop(50, 64, (b) => {
    const [d, m, l, hi] = HUE[hue].leaf;
    trunk(b, 21, 40, 8, 22);
    b.r(15, 44, 7, 2, bark); b.r(29, 46, 7, 2, barkD);
    for (const [x, y, rx, ry] of [[25, 26, 24, 18], [8, 32, 7, 6], [42, 31, 7, 7], [25, 8, 12, 7], [38, 15, 9, 8], [12, 15, 9, 8]]) b.oval(x, y, rx, ry, d);
    for (const [x, y, rx, ry] of [[23, 23, 20, 14], [9, 29, 5, 5], [24, 8, 9, 5], [37, 16, 7, 6], [13, 15, 7, 6], [40, 28, 5, 4]]) b.oval(x, y, rx, ry, m);
    for (const [x, y, rx, ry] of [[17, 16, 10, 7], [30, 11, 6, 4], [10, 26, 5, 4], [26, 25, 7, 4]]) b.oval(x, y, rx, ry, l);
    for (const [x, y] of [[12, 11], [19, 9], [8, 22], [29, 8], [23, 22]]) { b.r(x, y, 3, 2, hi); b.r(x + 1, y - 1, 1, 1, hi); }
    for (const [x, y] of [[31, 23], [36, 31], [14, 33], [23, 33], [41, 21], [6, 25], [18, 21]]) b.r(x, y, 3, 2, d);
    for (const [x, y] of [[34, 39], [16, 41], [43, 37]]) b.r(x, y, 2, 2, m);
  });
  // a maple: tiers of lobed foliage, each with a dark underside, narrowing to a point
  const maple = (hue) => prop(46, 66, (b) => {
    const [d, m, l, hi] = HUE[hue].leaf;
    trunk(b, 19, 44, 7, 20);
    b.r(13, 48, 7, 2, bark);
    const tiers = [[23, 35, 21, 9], [23, 23, 17, 8], [23, 12, 12, 7]];
    for (const [x, y, rx, ry] of tiers) { b.oval(x, y + 3, rx, ry, d); for (let k = -2; k <= 2; k++) b.oval(x + k * rx * 0.42, y + 4 + Math.abs(k), rx * 0.34, ry * 0.8, d); }
    for (const [x, y, rx, ry] of tiers) {
      b.oval(x - 1, y, rx - 2, ry - 1, m);
      for (let k = -2; k <= 1; k++) b.oval(x + k * rx * 0.42, y + Math.abs(k), rx * 0.3, ry * 0.62, m);
      b.oval(x - rx * 0.38, y - ry * 0.3, rx * 0.42, ry * 0.42, l);
      b.r(x - rx * 0.55, y - ry * 0.6, 3, 2, hi); b.r(x + rx * 0.1, y - ry * 0.4, 2, 1, hi);
      b.r(x + rx * 0.3, y + ry * 0.2, 3, 2, d);
    }
    b.r(22, 0, 2, 5, d); b.oval(23, 3, 3, 2, m);
  });
  const shrub = (hue, rose) => prop(30, 22, (b) => {
    const [d, m, l, hi] = rose ? ["#26362c", "#3a5636", "#567644", "#7a9a5a"] : HUE[hue].leaf;
    b.oval(15, 13, 14, 9, d); b.oval(13, 11, 12, 8, m); b.oval(21, 10, 7, 6, m); b.oval(10, 8, 7, 4, l); b.r(7, 5, 3, 1, hi);
    b.r(14, 15, 3, 2, d); b.r(21, 13, 3, 2, d); b.r(6, 14, 2, 1, d);
    // the graveyard's roses: blood-red heads, thorns gone violet with the blight
    if (rose) {
      for (const [x, y] of [[5, 10], [13, 6], [22, 7], [10, 14], [19, 14]]) { b.r(x, y, 3, 3, "#b01e34"); b.r(x, y, 1, 1, "#ec5a6a"); b.r(x + 1, y + 1, 1, 1, "#5a0a1a"); }
      for (const [x, y] of [[2, 15], [27, 11], [16, 18]]) { b.r(x, y, 1, 3, BL); b.r(x, y, 1, 1, BLL); }
    }
  });
  const grave = (v) => prop(18, 26, (b) => {
    const s = STONE, L = v ? 2 : -2;
    b.oval(9, 23, 9, 3, "#5a4634"); b.oval(9, 22, 7, 2, "#6e5a3e");
    b.tri([[4, 23], [15, 23], [15 + L, 8], [4 + L, 8]], s[1]);
    b.oval(9.5 + L, 8, 5.5, 5, s[1]); b.r(4 + L, 8, 2, 13, s[0]); b.oval(7 + L, 6, 3, 2, s[0]); b.r(13 + L, 9, 2, 13, s[2]);
    b.r(7 + L, 11, 6, 1, s[2]); b.r(9 + L, 9, 2, 7, s[2]);
    b.r(3, 19, 5, 3, MOSS); b.r(12, 20, 3, 2, MOSS);
    if (v) { b.r(14 + L, 14, 1, 4, BL); b.r(13 + L, 17, 1, 1, BLL); }
  });
  const banner = (v) => prop(22, 52, (b) => {
    b.r(4, 2, 2, 49, "#5a4a3a"); b.r(5, 2, 1, 49, "#3a2e26"); b.r(2, 0, 6, 3, "#c8a050"); b.r(1, 49, 8, 3, "#5a5248");
    b.r(6, 5, 14, 2, "#5a4a3a");
    const blue = "#34508e", blueD = "#203266", gold = "#d8b050";
    b.r(7, 7, 12, 26, blue); b.r(16, 7, 3, 26, blueD);
    for (let x = 7; x < 19; x += 2) b.r(x, 33, 2, ((x * 7) % 5) + (v ? 2 : 0), (x >> 1) % 2 ? blue : blueD);
    b.r(7, 7, 12, 2, gold);
    b.r(10, 14, 6, 2, gold); b.r(10, 12, 1, 2, gold); b.r(12, 11, 2, 3, gold); b.r(15, 12, 1, 2, gold);
    b.r(11, 19, 4, 5, gold); b.r(12, 20, 2, 3, blueD);
    if (v) { b.r(8, 24, 3, 4, "#4a2a52"); b.r(9, 25, 1, 1, BL); b.r(15, 28, 2, 3, blueD); }
  });
  const statue = prop(26, 50, (b) => {
    const s = STONE;
    b.r(1, 40, 24, 10, s[1]); b.r(1, 40, 24, 2, s[3]); b.r(19, 42, 6, 8, s[2]); b.r(1, 47, 24, 3, s[2]);
    b.tri([[5, 40], [21, 40], [18, 18], [8, 18]], s[1]); b.tri([[14, 40], [21, 40], [18, 18], [14, 18]], s[2]); b.r(8, 18, 3, 22, s[0]);
    b.r(6, 15, 14, 5, s[1]); b.r(6, 15, 4, 5, s[0]); b.r(17, 15, 3, 5, s[2]);
    b.oval(13, 10, 4.5, 5, s[1]); b.oval(12, 9, 2.5, 3, s[0]); b.r(15, 8, 2, 6, s[2]);
    b.r(8, 3, 10, 3, "#b89a54"); for (const x of [8, 12, 16]) b.r(x, 0, 2, 3, "#b89a54"); b.r(8, 5, 10, 1, "#7a6034");
    b.r(12, 21, 3, 3, s[3]); b.r(13, 24, 1, 8, s[3]); b.r(10, 21, 7, 1, s[2]);
    b.r(2, 37, 6, 3, MOSS); b.r(20, 36, 3, 4, MOSS); b.r(16, 26, 1, 6, s[2]); b.r(17, 31, 1, 3, s[2]);
    b.r(4, 43, 1, 4, BL); b.r(5, 42, 3, 1, BL); b.r(7, 41, 1, 1, BLL);
  });
  const rubble = prop(32, 26, (b) => {
    for (const [x, y, w, h] of [[1, 12, 12, 12], [11, 5, 14, 19], [20, 13, 11, 11]]) { b.r(x, y, w, h, STONE[1]); b.r(x, y, w, 2, STONE[3]); b.r(x + w - 3, y + 2, 3, h - 2, STONE[2]); }
    b.r(5, 10, 5, 3, MOSS); b.r(14, 4, 4, 2, MOSS); b.r(2, 23, 28, 2, STONE[2]);
  });
  // a dead tree whose bark has opened an eye
  const eyetree = (v) => prop(40, 58, (b) => {
    const bk = "#5a4a50", dark = "#3a2e38", lit = "#7a6a6c";
    const br = (x0, y0, x1, y1, w) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) b.r(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, w, bk); };
    b.r(17, 24, 7, 32, bk); b.r(21, 24, 3, 32, dark); b.r(17, 24, 1, 32, lit);
    b.r(12, 53, 17, 4, bk); b.r(10, 55, 4, 2, dark); b.r(27, 55, 5, 2, dark);
    if (v) { br(19, 30, 5, 13, 3); br(6, 15, 2, 5, 2); br(21, 27, 34, 10, 3); br(32, 12, 37, 3, 2); br(20, 25, 22, 2, 3); }
    else { br(19, 28, 7, 10, 3); br(9, 12, 9, 2, 2); br(21, 30, 35, 16, 3); br(33, 17, 38, 8, 2); br(20, 25, 16, 3, 3); }
    b.oval(20, 38, 4, 3, "#2a1a2e"); b.oval(20, 38, 3, 2, "#f0e4d8"); b.r(20, 37, 2, 2, "#7a1a3a"); b.r(20, 37, 1, 1, "#1a0a14");
    for (const [x, y] of [[18, 44], [22, 31], [19, 50]]) { b.r(x, y, 1, 3, BL); b.r(x + 1, y + 2, 1, 1, BLL); }
  });
  // the blight's fruit: a violet cap with pale spots like eyes
  const toad = prop(30, 32, (b) => {
    const cap = "#7a3a9a";
    b.r(12, 15, 7, 15, "#e4d8cc"); b.r(16, 15, 3, 15, "#b8a89c"); b.r(10, 28, 11, 3, "#e4d8cc");
    b.oval(15, 12, 14, 8, "#4a2060"); b.oval(15, 10, 14, 8, cap); b.oval(10, 7, 6, 3.4, "#a466c8");
    b.r(4, 16, 22, 2, "#c8b0d8");
    for (const [x, y] of [[6, 9], [15, 5], [21, 9], [11, 12]]) { b.r(x, y, 3, 2, "#f0e4ff"); b.r(x + 1, y, 1, 1, "#2a1030"); }
    b.r(24, 25, 2, 6, "#e4d8cc"); b.oval(25, 24, 4, 2.6, cap); b.r(24, 23, 1, 1, BLL);
  });
  return {
    T: [0, 1, 2, 3].map((k) => [round(k), maple(k)]),
    B: [shrub(0), shrub(1), shrub(2), shrub(0, true)],
    J: [grave(0), grave(1)], V: [banner(0), banner(1)], z: statue,
    N: rubble, d: rubble, i: rubble, f: rubble,
    A: [eyetree(0), eyetree(1)], toad,
  };
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

const GROUND = { t: "#6cbf5e", r: "#aeb0a0", ".": "#6cbf5e", ",": "#6cbf5e", '"': "#6cbf5e", ":": "#3f8a5c", ";": "#3f8a5c", p: "#d9ab6c", o: "#b4b9c6", s: "#ecd9a2", w: "#4aa2e2", b: "#b98a50", c: "#486a8a", d: "#486a8a", n: "#486a8a", i: "#486a8a", W: "#131a32", a: "#474b5a", m: "#474b5a", k: "#9aa0ae", j: "#6a6444", v: "#bdb39a", g: "#486a8a", "%": "#b4622e", "=": "#a69c88", "&": "#3e2c46" };
const GROUP = { t: 0, r: 3, ".": 0, ",": 0, '"': 0, ":": 1, ";": 1, p: 2, o: 3, s: 4, w: 5, b: 6, c: 7, d: 7, g: 7, n: 7, i: 7, W: 8, a: 9, m: 9, k: 10, j: 11, v: 12, "%": 2, "=": 3, "&": 11 };
/** The outline where a patch of ground ends: [dark edge line, soft inner rim]. */
const EDGE = { 2: ["#8f6238", "#bd8c54"], 3: ["#6e7486", "#969cac"], 4: ["#b89a5e", "#d8c088"], 5: ["#2f78c0", "#86c8f4"], 6: ["#6a4426", "#96683a"], 7: ["#2a4262", "#3a5878"], 10: ["#5e6474", "#c4c8d2"], 11: ["#4a4430", "#7e7652"], 12: ["#7e7562", "#d6cdb4"] };
const FLOWER = ["#fffbe8", "#ffd84a", "#ff9ac0", "#9ac8ff", "#f06a7a"];

// ── the dungeons underground share the cave's bones (rock `W`, floor `c`/`d`, liquid `w`) but each has its own skin
/**
 * Per theme: floor [mid, dark, light], the dark behind everything, the wall's
 * lit face [base, top, highlight, seam], the liquid [shallow, deep, glint,
 * edge line, edge rim], and the motes in the air.
 */
const UG = {
  crypt: { floor: ["#6f6a64", "#55504c", "#8b867c"], rock: "#15121a", face: ["#4b4540", "#77705f", "#989078", "#2f2a29"], wet: ["#3d5a66", "#33505c", "#7aa0a8", "#243a44", "#5a8088"], mote: "#d8d0c0" },
  sewer: { floor: ["#5d6a5e", "#47534a", "#768476"], rock: "#0d130f", face: ["#6a4636", "#8a6048", "#aa7c5e", "#3c2820"], wet: ["#6a9a3a", "#5a8a30", "#b0dc70", "#36561e", "#8cc054"], mote: "#b8e890" },
  abyss: { floor: ["#7c2f3c", "#5c1e2b", "#9e4855"], rock: "#19070c", face: ["#5a1622", "#8c2c3a", "#ba4e5a", "#330e18"], wet: ["#a81c2c", "#8e1424", "#e4606c", "#560a16", "#d04858"], mote: "#ff8a7a" },
};

/** One tile of dungeon floor. `d` is the busier variant; `under` means rock stands directly above. */
function underFloor(b, U, theme, X, Y, ch, h, free, under) {
  const [mid, dark, light] = U.floor;
  if (theme === "crypt") {
    // flagstones a tile across, worn at the corners; now and then a crack, and bones on the busy ones
    b.r(X, Y + 31, T, 1, dark); b.r(X + 31, Y, 1, T, dark); b.r(X, Y, T, 1, light); b.r(X, Y, 1, T, light);
    if (h(1) < 0.5) { b.r(X + 15, Y + 1, 1, 30, dark); b.r(X + 16, Y + 1, 1, 30, light); } else { b.r(X + 1, Y + 15, 30, 1, dark); b.r(X + 1, Y + 16, 30, 1, light); }
    if (h(2) < 0.22) { const a = X + 5 + Math.floor(h(3) * 18), q = Y + 5 + Math.floor(h(4) * 16); b.r(a, q, 1, 4, dark); b.r(a + 1, q + 3, 3, 1, dark); b.r(a + 3, q + 4, 1, 3, dark); }
    if (ch === "d" && free) {
      const a = X + 5 + Math.floor(h(5) * 14), q = Y + 7 + Math.floor(h(6) * 14);
      if (h(7) < 0.5) { b.r(a, q + 1, 9, 2, "#d8d0b8"); b.r(a - 1, q, 2, 4, "#e8e2cc"); b.r(a + 8, q, 2, 4, "#e8e2cc"); b.r(a + 1, q + 3, 7, 1, "#a8a08a"); }      // a thigh bone
      else { b.r(a, q, 6, 5, "#e2dcc6"); b.r(a + 1, q + 5, 4, 2, "#e2dcc6"); b.r(a + 1, q + 2, 1, 2, "#2f2a29"); b.r(a + 4, q + 2, 1, 2, "#2f2a29"); b.r(a + 1, q + 6, 4, 1, "#a8a08a"); b.r(a, q, 6, 1, "#f4f0e0"); }   // a skull
    }
  } else if (theme === "sewer") {
    // brick laid in four courses, every other one shifted; grime between, a grate on the busy ones
    for (let r = 0; r < 4; r++) {
      const y = Y + r * 8, off = r % 2 ? 8 : 0;
      b.r(X, y + 7, T, 1, dark);
      for (let x = off; x < T; x += 16) b.r(X + x, y, 1, 7, dark);
      b.r(X + ((off + 3) % 16), y + 1, 6, 1, light);
    }
    if (h(2) < 0.3) { const a = X + 4 + Math.floor(h(3) * 20), q = Y + 4 + Math.floor(h(4) * 20); b.r(a, q, 5, 2, "#4f7a3a"); b.r(a + 1, q + 2, 3, 1, "#3e6a30"); }
    if (ch === "d" && free) {
      if (h(7) < 0.4) { const a = X + 8, q = Y + 9; b.r(a, q, 16, 14, "#262c28"); b.r(a, q, 16, 1, "#8a968a"); b.r(a, q + 13, 16, 1, "#161a18"); for (let i = 2; i < 16; i += 4) b.r(a + i, q + 2, 2, 10, "#6a766c"); }        // a drain
      else { const a = X + 7 + Math.floor(h(5) * 10), q = Y + 10 + Math.floor(h(6) * 10); b.oval(a + 6, q + 3, 7, 3.4, U.wet[3]); b.oval(a + 6, q + 3, 6, 2.6, U.wet[0]); b.r(a + 3, q + 2, 4, 1, U.wet[2]); }   // a puddle of what leaks
    }
  } else {
    // flesh: no joints at all — veins under the surface, wet highlights, a blister on the busy ones
    for (let i = 0; i < 3; i++) {
      const a = X + 2 + Math.floor(h(10 + i) * 22), q = Y + 3 + Math.floor(h(14 + i) * 24);
      b.r(a, q, 4, 1, dark); b.r(a + 3, q + 1, 3, 1, dark); b.r(a + 5, q + 2, 1, 2, dark);
    }
    for (let i = 0; i < 2; i++) b.r(X + 4 + Math.floor(h(20 + i) * 22), Y + 4 + Math.floor(h(24 + i) * 22), 3, 1, light);
    if (ch === "d" && free) {
      const a = X + 8 + Math.floor(h(5) * 12), q = Y + 9 + Math.floor(h(6) * 12);
      if (h(7) < 0.72) { b.oval(a + 4, q + 3, 5, 3.4, "#c4606a"); b.oval(a + 3, q + 2, 3, 1.8, "#e89aa0"); b.r(a + 2, q + 1, 2, 1, "#fff0f0"); b.r(a, q + 6, 9, 1, dark); }       // a blister
      else { b.oval(a + 4, q + 3, 5, 3, "#f4ecd8"); b.oval(a + 4, q + 3, 2.4, 2.4, "#3a0a12"); b.r(a + 3, q + 2, 1, 1, "#ffffff"); b.r(a - 1, q + 2, 1, 3, dark); b.r(a + 9, q + 2, 1, 3, dark); }   // an eye in the floor
    }
  }
  if (ch === "g") grate(b, X, Y, dark, light);
  if (under) b.r(X, Y, T, 5, dark);                        // the wall's shadow falls a little way onto the floor
}
/** An iron grate set in the floor, black below the bars. */
function grate(b, X, Y, dark, light) {
  b.r(X + 3, Y + 3, 26, 26, "#1c2220"); b.r(X + 3, Y + 3, 26, 2, "#8a948c"); b.r(X + 3, Y + 27, 26, 2, "#3a423e"); b.r(X + 3, Y + 3, 2, 26, "#6a746c"); b.r(X + 27, Y + 3, 2, 26, "#3a423e");
  for (let i = 9; i < 27; i += 6) { b.r(X + i, Y + 5, 2, 22, "#5e6862"); b.r(X + i, Y + 5, 1, 22, "#8a948c"); }
  b.r(X + 5, Y + 15, 22, 2, "#5e6862");
}

/** One tile of dungeon rock: flat dark, with a lit face where it stands over open floor. */
function underRock(b, U, theme, X, Y, h, faced, lipN, lipW, lipE) {
  const [base, top, hi, seam] = U.face;
  if (faced) {
    b.r(X, Y + 6, T, 26, base); b.r(X, Y + 6, T, 3, top); b.r(X, Y + 9, T, 1, hi); b.r(X, Y + 30, T, 2, seam);
    if (theme === "crypt") {
      // coursed stone, and here and there a niche with a skull in it
      for (let r = 0; r < 2; r++) { b.r(X, Y + 16 + r * 7, T, 1, seam); for (let x = r ? 8 : 0; x < T; x += 16) b.r(X + x, Y + 10 + r * 7, 1, 7, seam); }
      if (h(6) < 0.2) { const a = X + 9 + Math.floor(h(7) * 8); b.r(a, Y + 13, 12, 12, "#1f1b1e"); b.r(a + 3, Y + 16, 6, 5, "#e2dcc6"); b.r(a + 4, Y + 21, 4, 2, "#e2dcc6"); b.r(a + 4, Y + 18, 1, 2, "#1f1b1e"); b.r(a + 7, Y + 18, 1, 2, "#1f1b1e"); b.r(a + 3, Y + 16, 6, 1, "#f4f0e0"); }
    } else if (theme === "sewer") {
      // brick, streaked with slime where the damp runs down
      for (let r = 0; r < 3; r++) { b.r(X, Y + 14 + r * 5, T, 1, seam); for (let x = r % 2 ? 8 : 0; x < T; x += 16) b.r(X + x, Y + 10 + r * 5, 1, 5, seam); }
      if (h(6) < 0.35) { const a = X + 4 + Math.floor(h(7) * 22), len = 6 + Math.floor(h(8) * 12); b.r(a, Y + 9, 2, len, "#4f7a3a"); b.r(a, Y + 9 + len, 1, 2, "#6a9a3a"); }
    } else {
      // flesh, with eyes that follow you from the wall — or a row of teeth
      for (let i = 0; i < 2; i++) b.r(X + 3 + Math.floor(h(i) * 20), Y + 13 + i * 8, 8, 1, seam);
      if (h(6) < 0.22) { const a = X + 8 + Math.floor(h(7) * 10), q = Y + 15; b.oval(a + 5, q + 4, 7, 5, seam); b.oval(a + 5, q + 4, 6, 3.6, "#f4ecd8"); b.oval(a + 5, q + 4, 2.6, 2.8, "#c41830"); b.r(a + 4, q + 3, 2, 2, "#19070c"); b.r(a + 3, q + 2, 1, 1, "#ffffff"); }
      else if (h(6) > 0.86) { for (let i = 0; i < 5; i++) b.tri([[X + 4 + i * 5, Y + 26], [X + 8 + i * 5, Y + 26], [X + 6 + i * 5, Y + 31]], "#ece4cc"); }
    }
  } else {
    if (h(1) < 0.5) b.r(X + Math.floor(h(2) * 24), Y + Math.floor(h(3) * 26), 6, 2, seam);
    if (lipN) { b.r(X, Y, T, 4, base); b.r(X, Y, T, 1, top); }
  }
  if (lipW) { b.r(X, Y, 4, T, base); b.r(X, Y, 1, T, top); }
  if (lipE) { b.r(X + T - 4, Y, 4, T, base); b.r(X + T - 1, Y, 1, T, top); }
}

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
  const U = UG[theme] || null;
  const BASE = theme === "forest" ? { ...GROUND, ".": GROUND[":"], ",": GROUND[":"], '"': GROUND[":"], t: GROUND[":"] }
    : U ? { ...GROUND, c: U.floor[0], d: U.floor[0], g: U.floor[0], W: U.rock, w: U.wet[0] } : GROUND;
  const EDG = U ? { ...EDGE, 5: [U.wet[3], U.wet[4]], 7: [U.floor[1], U.floor[2]], 6: theme === "abyss" ? ["#5a1622", "#a8a08a"] : theme === "sewer" ? ["#1c2220", "#6a746c"] : EDGE[6] } : EDGE;
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
    } else if (ch === "j") {
      // mud: a darker skin, wet hollows that catch the sky, a few pale stones half sunk
      const d = dk(col, 0.8), l = lt(col, 1.14);
      for (let i = 0; i < 4; i++) b.r(X + 2 + Math.floor(h(i) * 26), Y + 2 + Math.floor(h(i + 9) * 27), 3, 1, i % 2 ? d : l);
      if (h(20) < 0.55) { const a = X + 5 + Math.floor(h(21) * 14), q = Y + 7 + Math.floor(h(22) * 14); b.oval(a + 7, q + 4, 8, 4, d); b.oval(a + 7, q + 4, 6.5, 2.8, "#4e5e58"); b.r(a + 3, q + 3, 4, 1, "#8aa6a0"); }
      if (h(23) < 0.25) { const a = X + 6 + Math.floor(h(24) * 18), q = Y + 6 + Math.floor(h(25) * 18); b.r(a, q, 3, 2, "#a8a08a"); b.r(a, q, 2, 1, "#c8c0a8"); b.r(a + 1, q + 2, 2, 1, d); }
    } else if (ch === "v") {
      // stone steps cut into a rise: three treads, lit on the nose, dark at the riser
      for (let s2 = 0; s2 < 3; s2++) {
        const y0 = Y + 1 + s2 * 10;
        b.r(X, y0, T, 2, lt(col, 1.16)); b.r(X, y0 + 2, T, 5, col); b.r(X, y0 + 7, T, 3, dk(col, 0.72));
        b.r(X + Math.floor(h(s2) * 20) + 4, y0 + 3, 5, 1, dk(col, 0.9));
      }
      b.r(X, Y, 1, T, dk(col, 0.82)); b.r(X + T - 1, Y, 1, T, dk(col, 0.82));
      if (h(30) < 0.4) b.r(X + 3 + Math.floor(h(31) * 22), Y + 8, 4, 2, "#7ab868");
    } else if (ch === "k") {
      b.r(X, Y, T, 1, lt(col, 1.1)); b.r(X + 15, Y, 1, T, dk(col, 0.9)); b.r(X, Y + 15, T, 1, dk(col, 0.9)); b.r(X + 31, Y, 1, T, dk(col, 0.86)); b.r(X, Y + 31, T, 1, dk(col, 0.86));
      if (h(1) < 0.2) b.r(X + 3 + Math.floor(h(2) * 22), Y + 3 + Math.floor(h(3) * 22), 5, 3, dk(col, 0.93));
      if (h(4) < 0.05) { const a = X + 6 + Math.floor(h(5) * 14), q = Y + 6 + Math.floor(h(6) * 14); b.r(a, q, 1, 5, dk(col, 0.74)); b.r(a + 1, q + 4, 4, 1, dk(col, 0.74)); }
    } else if (ch === "w") {
      const deep = grp(tx, ty - 1) === 5 && grp(tx, ty + 1) === 5 && grp(tx - 1, ty) === 5 && grp(tx + 1, ty) === 5;
      if (deep) b.r(X, Y, T, T, U ? U.wet[1] : "#4196d8");
      if (U) { for (let i = 0; i < 2; i++) b.r(X + 4 + Math.floor(h(i + 2) * 20), Y + 6 + Math.floor(h(i + 5) * 20), 4, 1, U.wet[1]); }
      else if (deep && h(1) < 0.07) { const a = X + 8 + Math.floor(h(2) * 14), q = Y + 9 + Math.floor(h(3) * 12); b.oval(a + 4, q + 3, 5, 3.4, "#4faa5a"); b.r(a + 4, q + 3, 3, 1, "#4196d8"); b.oval(a + 3, q + 2, 2.4, 1.4, "#7acf70"); if (h(4) < 0.5) { b.r(a + 6, q + 1, 2, 2, "#ff9ac0"); b.r(a + 6, q + 1, 1, 1, "#fff2c0"); } }
    } else if (ch === "b" && theme === "abyss") {
      // a bridge of bone: ribs laid across, bound with sinew along both rails
      const across = grp(tx - 1, ty) === 6 || grp(tx + 1, ty) === 6;
      b.r(X, Y, T, T, "#3c0e16");
      for (let i = 1; i < T; i += 8) {
        if (across) { b.r(X + i, Y + 2, 5, 28, "#e2dcc6"); b.r(X + i, Y + 2, 5, 2, "#f4f0e0"); b.r(X + i + 4, Y + 2, 1, 28, "#a8a08a"); b.r(X + i - 1, Y + 1, 7, 3, "#e2dcc6"); b.r(X + i - 1, Y + 28, 7, 3, "#c8c0a8"); }
        else { b.r(X + 2, Y + i, 28, 5, "#e2dcc6"); b.r(X + 2, Y + i, 28, 2, "#f4f0e0"); b.r(X + 2, Y + i + 4, 28, 1, "#a8a08a"); b.r(X + 1, Y + i - 1, 3, 7, "#e2dcc6"); b.r(X + 28, Y + i - 1, 3, 7, "#c8c0a8"); }
      }
      if (across) { b.r(X, Y + 3, T, 2, "#8c2c3a"); b.r(X, Y + 27, T, 2, "#8c2c3a"); } else { b.r(X + 3, Y, 2, T, "#8c2c3a"); b.r(X + 27, Y, 2, T, "#8c2c3a"); }
    } else if (ch === "b" && theme === "sewer") {
      // an iron footbridge: a grating between two rails, rivets at the joints
      b.r(X, Y, T, T, "#4a524c");
      for (let i = 2; i < T; i += 5) { b.r(X + i, Y, 2, T, "#2a302c"); b.r(X, Y + i, T, 1, "#2a302c"); }
      b.r(X, Y, T, 2, "#8a948c"); b.r(X, Y + T - 2, T, 2, "#2a302c");
      for (const [a, q] of [[2, 3], [T - 4, 3], [2, T - 5], [T - 4, T - 5]]) b.r(X + a, Y + q, 2, 2, "#b0b8b0");
    } else if (ch === "b") {
      for (let i = 0; i < T; i += 8) { b.r(X + i, Y, 1, T, dk(col, 0.72)); b.r(X + i + 1, Y, 2, T, lt(col, 1.14)); b.r(X + i + 4, Y + 3, 1, 1, "#5a3a22"); b.r(X + i + 4, Y + 28, 1, 1, "#5a3a22"); if (hash(tx * 4 + i, ty, 3) < 0.3) b.r(X + i + 3, Y + 8 + Math.floor(hash(tx * 4 + i, ty, 4) * 14), 3, 1, dk(col, 0.84)); }
      if (grp(tx, ty - 1) !== 6) { b.r(X, Y, T, 5, "#7a5030"); b.r(X, Y, T, 1, "#a87a48"); b.r(X, Y + 5, T, 2, dk(col, 0.7)); }
      if (grp(tx, ty + 1) !== 6) { b.r(X, Y + T - 6, T, 6, "#7a5030"); b.r(X, Y + T - 6, T, 1, "#a87a48"); }
    } else if (g0 === 7 && U) {
      underFloor(b, U, theme, X, Y, ch, h, free(tx, ty), grp(tx, ty - 1) === 8);
    } else if (ch === "W" && U) {
      const below = at(tx, ty + 1);
      underRock(b, U, theme, X, Y, h, !!below && below !== "W", grp(tx, ty - 1) === 7, grp(tx - 1, ty) === 7, grp(tx + 1, ty) === 7);
    } else if (g0 === 7) {
      // cave floor: worn flagstones
      const d = dk(col, 0.84);
      for (let q = 0; q < 2; q++) for (let i = 0; i < 2; i++) { const a = X + i * 16 + (q ? 8 : 0), z = Y + q * 16; b.r(a + 2, z + 13, 12, 1, d); b.r(a + 1, z + 10, 1, 3, d); b.r(a + 14, z + 10, 1, 3, d); b.r(a + 4, z + 3, 5, 1, lt(col, 1.1)); }
      if (ch === "d") { const a = X + 6 + Math.floor(h(3) * 14), q = Y + 6 + Math.floor(h(4) * 14); b.r(a, q, 5, 3, "#5c80a0"); b.r(a, q, 5, 1, "#7a9cbc"); b.r(a + 7, q + 4, 3, 2, "#5c80a0"); }
      if (ch === "g") grate(b, X, Y, d, lt(col, 1.1));
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
    const ed = EDG[g0];
    if (ed) {
      const dif = (dx, dy) => { const n = grp(tx + dx, ty + dy); return n !== -1 && n < g0 && !(g0 === 6 && n === 5) && n !== 8; };
      const nb = (dx, dy) => BASE[at(tx + dx, ty + dy)];
      const side = (dx, dy) => {
        if (!dif(dx, dy)) return false;
        const bite = nb(dx, dy), straight = g0 === 3 || g0 === 5 || g0 === 10 || g0 === 6 || g0 === 12;
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
    if (n.night) continue;
    // a woven mat marks where each of the townsfolk stands
    const cx = n.x * T + 16, cy = n.y * T + 25, col = { shop: "#e07a8a", smith: "#8a90a0", elder: "#5a6ac0", train: "#b84a4a", warp: "#7a5ae0", collector: "#4a7a4a", achieve: "#d8a830", daily: "#4a8ad0", bank: "#a07a3a" }[n.role] || "#6a8a5a";
    b.oval(cx, cy, 15, 6.5, "#f2e0b0"); b.oval(cx, cy, 13, 5, col); b.oval(cx, cy, 9, 3, lt(col, 1.3)); b.oval(cx, cy, 5, 1.6, col);
  }
}

let theme = "meadow", waterTiles = [], smokers = [];
/** The fires that always burn on this map, on screen, with their stumps (camp.js art; sky.js fireflies). */
let camps = [];
/** Level art from decor.js: falling water, a layer that breathes, little emitters, lantern strings, critters, signs. */
let falls = [], pulseCv = null, pulseParts = null, emit = [], strings = [], critters = [], signs = [], lights = [];
/** An interior's lamps, fire and window light (iso_interior.js roomLight). */
let roomL = { glows: [], wins: [], motes: [] };
/** Whether the ground came from isotiles.js (its water animates itself). */
let artGround = false;

/** Project a square world-pixel canvas of the whole map onto the diamond grid. */
function toIso(m, src, smooth = false) {
  const [c, x] = sheet((m.w + m.h) * 16 * K, (m.w + m.h) * 8 * K);
  x.imageSmoothingEnabled = smooth;
  x.setTransform(FLAT[0], FLAT[1], FLAT[2], FLAT[3], m.h * 16 * K, 0);
  x.drawImage(src, 0, 0);
  x.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

/** Stand a sprite on tile (tx, ty): its foot a little in front of the tile's middle, sorted at the middle. */
function stand(st, tx, ty, nudge = 0) {
  const [X, Y] = tI(tx + 0.5, ty + 0.5);
  st.x = X + nudge; st.y = Y + 4;
  st.dx = Math.round(st.x - st.sp.width / 2); st.dy = Math.round(st.y - st.sp.height + 2 - (st.lift || 0));
  st.d = Y + (st.lift ? 1 : 0);
  return st;
}
/** Does the pew at (x, y) run along x? With its row-mates if it has any, else across the nearest runner. */
function pewAlongX(m, x, y) {
  const o = (i, j) => (m.o[j] && m.o[j][i]) || null, g = (i, j) => (m.g[j] && m.g[j][i]) || null;
  if (o(x - 1, y) === "I" || o(x + 1, y) === "I") return true;
  if (o(x, y - 1) === "I" || o(x, y + 1) === "I") return false;
  for (let d = 1; d < 8; d++) { if (g(x - d, y) === "n" || g(x + d, y) === "n") return true; if (g(x, y - d) === "n" || g(x, y + d) === "n") return false; }
  return true;
}
/** Stand a big sprite over a footprint of fw×fh tiles at (fx, fy), painted in upright strips. */
function standBig(st, fx, fy, fw, fh, down = 0) {
  const [X, Y] = tI(fx + fw / 2, fy + fh / 2);
  st.x = X; st.y = Y + (fw + fh) * 2 + down;
  st.dx = Math.round(st.x - st.sp.width / 2); st.dy = Math.round(st.y - st.sp.height + 2 - (st.lift || 0));
  st.d = Y;
  slice(st, fx, fy, fw, fh);
  return st;
}
/**
 * Cut a wide sprite into strips 16 pixels across, each sorted by the front edge of
 * the footprint under it, so someone standing before one face of a building is
 * painted over it while someone behind it is hidden.
 */
function slice(st, fx, fy, fw, fh) {
  const [Lx, Ly] = tI(fx, fy + fh), [Bx, By] = tI(fx + fw, fy + fh), [Rx, Ry] = tI(fx + fw, fy);
  const front = (X) => (X <= Lx ? Ly : X >= Rx ? Ry : X < Bx ? Ly + ((X - Lx) * (By - Ly)) / (Bx - Lx) : By + ((X - Bx) * (Ry - By)) / (Rx - Bx));
  st.slices = [];
  const w = st.sp.width;
  for (let sx = 0; sx < w; sx += 16) {
    const sw = Math.min(16, w - sx), X0 = st.dx + sx;
    st.slices.push({ sx, w: sw, d: Math.min(front(X0), front(X0 + sw)) - 3 });
  }
  st.foot = [fx, fy, fw, fh];
}

// ── raised blocks: cliffs, hedges, walls, the city's panels and underground rock, one per tile
/** [height, top, lit rim, dark rim, south face, east face, seam]. */
function blockStyle(kind) {
  if (kind === "W") {
    const U = UG[theme];
    if (U) return { h: 30, top: tone(U.rock, U.face[3], 0.55), rim: U.face[1], low: tone(U.rock, U.face[0], 0.5), s: U.face[0], e: dk(U.face[0], 0.72), seam: U.face[3], cap: U.face[1], kind };
    return { h: 30, top: "#1b2644", rim: "#4a6a98", low: "#141c34", s: "#2e4468", e: "#223450", seam: "#141c34", cap: "#3a5680", kind };
  }
  return {
    C: { h: 20, top: "#b4aa8c", rim: "#d2c8a8", low: "#8c8168", s: "#a1967a", e: "#776c56", seam: "#8c8168", cap: "#c6bc9c", kind },
    H: { h: 14, top: "#4aa552", rim: "#84d474", low: "#256a32", s: "#33863f", e: "#256a32", seam: "#2a7036", cap: "#6ac060", kind },
    U: { h: 16, top: "#cbc6b6", rim: "#e2decf", low: "#8c8678", s: "#9c9686", e: "#726c5e", seam: "#827c6e", cap: "#bcb6a6", kind },
    Z: { h: 34, top: "#5a6278", rim: "#848ca2", low: "#2e3240", s: "#4a5064", e: "#343846", seam: "#3c4254", cap: "#6a7288", kind },
  }[kind];
}
const blockCache = new Map();
/**
 * One raised tile: a lit top diamond and the two faces that look at the camera.
 * `mask` says which neighbours are blocks too (1 north, 2 east, 4 south, 8 west)
 * so joined pieces read as one mass. The image's top-left sits at the tile's top
 * corner + (−16, −h), as isotiles.js pieces do.
 */
function blockSprite(kind, mask, v, topOnly) {
  const key = theme + kind + mask + v + (topOnly ? "t" : "");
  let c = blockCache.get(key);
  if (c) return c;
  const B = blockStyle(kind), H = B.h;
  let x;
  [c, x] = sheet(32, 16 + H);
  const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  const top = (cl) => (cl < 16 ? 7 - (cl >> 1) : (cl - 16) >> 1), bot = (cl) => (cl < 16 ? 8 + (cl >> 1) : 15 - ((cl - 16) >> 1));
  const h = (s) => hash(mask, v, s);
  // the faces, where nothing of the same stands in front of them
  if (!topOnly) for (let cl = 0; cl < 32; cl++) {
    const south = cl < 16;
    if (south ? mask & 4 : mask & 2) continue;
    const y0 = bot(cl) + 1, col = south ? B.s : B.e;
    r(cl, y0, 1, H, col);
    // courses of stone (or strata, or leaves) running along the face
    if (B.kind === "H") { for (let k = 3; k < H; k += 4) if (hash(cl, k, v) < 0.5) r(cl, y0 + k, 1, 1, south ? B.cap : B.seam); }
    else if (B.kind === "Z") { if (cl % 8 === 3) r(cl, y0, 1, H, B.seam); r(cl, y0 + 3, 1, 1, B.seam); }
    else for (let k = 5; k < H - 1; k += B.kind === "C" ? 6 : 5) {
      r(cl, y0 + k, 1, 1, B.seam);
      const joint = ((cl + (((k / 5) | 0) % 2) * 4 + v * 3) % 8) === 0;
      if (joint && B.kind !== "C") r(cl, y0 + k - 4, 1, 4, B.seam);
    }
    if (B.kind === "C" && hash(cl, v, 7) < 0.12) r(cl, y0 + 3 + Math.floor(hash(cl, v, 8) * (H - 8)), 1, 3, B.seam);
    r(cl, y0 + H - 1, 1, 1, INK);                                     // where it meets the ground
  }
  // the top: flat, lit along the edges that face the light, dark along the others
  for (let cl = 0; cl < 32; cl++) r(cl, top(cl), 1, bot(cl) - top(cl) + 1, B.top);
  for (let i = 0; i < 3; i++) {
    const a = 6 + Math.floor(h(i) * 20), b = Math.max(top(a) + 2, Math.min(bot(a) - 2, 4 + Math.floor(h(i + 5) * 8)));
    if (B.kind === "C") { r(a, b, 3, 1, i ? "#6cbf5e" : B.seam); if (!i) r(a + 1, b - 1, 1, 1, "#8ad070"); }
    else if (B.kind === "H") { r(a, b, 2, 1, i % 2 ? B.cap : B.low); }
    else if (B.kind === "W") { if (i < 2) r(a, b, 2, 1, B.low); }
    else r(a, b, 2, 1, B.seam);
  }
  for (let cl = 0; cl < 32; cl++) {
    if (cl < 16 ? !(mask & 8) : !(mask & 1)) { r(cl, top(cl), 1, 1, B.rim); if (B.kind !== "W") r(cl, top(cl) + 1, 1, 1, B.cap); }
    if (cl < 16 ? !(mask & 4) : !(mask & 2)) r(cl, bot(cl), 1, 1, B.low);
  }
  // an outline where the mass ends
  if (!topOnly) {
    if (!(mask & 8) && !(mask & 4)) r(0, 7, 1, H + 2, INK);
    if (!(mask & 1) && !(mask & 2)) r(31, 7, 1, H + 2, INK);
  }
  c.H = H;
  blockCache.set(key, c);
  return c;
}

/** The iso house, city block and car sprites from art.js, used until isotiles.js has its own. */
let ARTSC = null;
const artSc = () => ARTSC || (ARTSC = Art.buildScenery());

/** What the last loadMap cost, ms: the ground, the sprite sets, the landmarks' plan, the per-tile pass, the rest (tools). */
let loadCost = null;
export function loadMap(m) {
  const lt = [performance.now()];
  map = m;
  theme = m.theme || themeOf(m);
  // the ground: isotiles.js bakes it — a big map in chunks, as they come on screen (?chunks=1 forces that) —
  // or, failing that, it is painted flat on the square grid and laid onto diamonds
  // (indoors there is no flat fallback: iso_interior.js bakes the floor)
  ground = null; artGround = false;
  if (IT.ready) {
    const force = !!globalThis.__chunks || (typeof location !== "undefined" && /[?&]chunks=1/.test(location.search));
    if (IT.chunked(m, theme, force)) { ground = IT.groundChunks(m, theme); artGround = true; }
    else {
      const b = IT.bakeGround(m, theme);
      if (b && b.frames && b.frames.length) { ground = b; artGround = true; }
    }
  }
  if (!ground) {
    const flat = theme === "interior" ? sheet(m.w * T, m.h * T)[0] : paintGround(m, theme);
    if (theme !== "interior") { DC.decals(m, theme, flat.getContext("2d")); paintExtras(m, flat); }
    ground = { frames: [toIso(m, flat)], ox: m.h * 16 * K, oy: 0 };
  }
  lt.push(performance.now());
  const S = scenery(), D = DC.sprites(), lazyWalls = IT.ready && !!ground.chunked;
  lt.push(performance.now());
  statics = []; waterTiles = []; smokers = []; signs = []; lights = [];
  const spiritAt = new Set(m.big.filter((b) => b.t === "spirit").map((b) => b.x + "," + b.y));
  roomL = { glows: [], wins: [], motes: [] };
  const lay = DC.plan(m, theme), mkt = theme === "town" ? DC.town(m) : { statics: [], swap: new Set(), strings: [] };
  // the glowing layer of the deep places: one canvas, or for a chunked map pieces made as they come on screen
  pulseCv = null; pulseParts = ground.chunked && ["cave", "abyss", "sewer", "crypt"].includes(theme) ? new Map() : null;
  if (!pulseParts) { const pc = DC.pulse(m, theme); pulseCv = pc ? toIso(m, pc) : null; }
  // falling water runs down the face of a ledge, which now runs along the diagonal
  falls = lay.falls.map((f) => { const [X0, Y0] = sqI(f.x, f.edge), [X1] = sqI(f.x + f.w, f.edge); return { ...f, X0, Y0, len: X1 - X0, H: f.pool ? 22 : 30 }; });
  emit = DC.emitters(m, theme).map((e) => { const [X, Y] = sqI(e.x, e.y); return { ...e, x: X, y: Y - (e.k === "drip" ? 26 : e.k === "eyes" ? 12 : 0) }; });
  strings = mkt.strings.map((s) => {
    const lamp = (x, y) => { const [X, Y] = tI((x - 16) / T + 0.5, (y + 20) / T + 0.5); return [X, Y - 44]; };
    const [ax, ay] = lamp(s.ax, s.ay), [bx, by] = lamp(s.bx, s.by);
    return { ax, ay, bx, by };
  });
  critters = [];
  lt.push(performance.now());
  const marks = new Map((m.marks || []).map((k) => [k.x + "," + k.y, k]));
  const edge = (x, y) => x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2;
  // the pieces isotiles.js stands up, by tile; a house it draws is not drawn again here
  const art = new Map(), artHouse = new Set();
  const houseAt = (x, y) => m.big.find((b) => b.t === "house" && x >= b.x && x < b.x + 4 && y >= b.y && y < b.y + 3);
  const isRock = (x, y) => { const r = m.g[y]; return !!r && r[x] === "W" && m.o[y][x] === " "; };
  const blockKind = (x, y) => { const r = m.o[y]; if (!r || x < 0 || x >= m.w) return null; const ch = r[x]; return ch === " " ? (isRock(x, y) ? "W" : null) : WALL[ch] || ch === "Z" ? ch : null; };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.g[y][x] === "w") {
      const sh = (dx, dy) => { const r = m.g[y + dy], ch = r && r[x + dx]; return ch !== undefined && ch !== "w" && ch !== "b" ? 1 : 0; };
      const [X, Y] = tI(x, y);
      waterTiles.push({ X, Y, x: x * T, y: y * T, h: hash(x, y, 5), n: sh(0, -1), s: sh(0, 1), w: sh(-1, 0), e: sh(1, 0) });
    }
    const ch = m.o[y][x], key = x + "," + y;
    // a landmark stands where it stands: nothing else is drawn on the tiles it covers
    if (lay.covered.has(key) || spiritAt.has(key)) continue;
    // on a big (chunked) map the walls, cliffs, hedges and rock stand up when they first come near the
    // screen (render: lazyTall); what isotiles.js draws for them, or nothing, is decided then
    if (lazyWalls && (isRock(x, y) || "CHUZ".includes(ch))) {
      const [X, Y] = tI(x, y);
      statics.push({ lazy: [x, y], sp: null, dx: X, dy: Y, x: X, y: Y + 16, d: Y + 8, glow: null, glint: -1, art: true, tx: X, ty: Y });
      continue;
    }
    if (IT.ready && (ch !== " " || isRock(x, y))) {
      const pc2 = IT.tallAt(m, x, y, theme);
      if (pc2 && pc2.img) {
        const [X, Y] = tI(x, y), st = { sp: pc2.img, dx: X + pc2.dx, dy: Y + pc2.dy, x: X, y: Y + 16, d: Y + 8, glow: null, glint: -1, art: true, tx: X, ty: Y };
        // a wall tall enough to hide someone can be cut down to a stump when they stand behind it
        if (ch !== "h" && "low" in pc2) st.cut = pc2;
        if (ch === "h") { const hb = houseAt(x, y); if (hb) { artHouse.add(hb); slice(st, hb.x, hb.y, 4, 3); } }
        // indoors: a fire, steam, a sleeping cat; lamps and windows light the room (iso_interior.js)
        if (pc2.anim) st.anim = pc2.anim;
        if (pc2.glow) roomL.glows.push({ ...pc2.glow, X: X + pc2.glow.x, Y: Y + pc2.glow.y });
        if (pc2.win) roomL.wins.push(IN.windowPatch(pc2.win, x, y, tI));
        art.set(key, st);
        statics.push(st);
        continue;
      }
      // the art draws the deep rock between walls into the ground itself
      if (isRock(x, y) || "CHUZ".includes(ch)) continue;
    }
    if (ch === "Q") { statics.push(stand({ sp: D.waypoint, glow: null, glint: -1, wp: true, ph: hash(x, y, 6) * 9 }, x, y)); continue; }
    if (ch === "G" && marks.has(key)) {
      const k = marks.get(key), way = signWay(m, x, y, k);
      const st = stand({ sp: D.sign[way + 1], glow: null, glint: -1, label: k && k.label ? k.label : null }, x, y);
      statics.push(st); if (st.label) signs.push(st);
      continue;
    }
    if (mkt.swap.has(key)) continue;
    const bk = blockKind(x, y);
    if (bk) {
      // underground rock deep inside the mass shows only its top
      const same = (dx, dy) => (blockKind(x + dx, y + dy) ? 1 : 0);
      const mask = same(0, -1) | (same(1, 0) << 1) | (same(0, 1) << 2) | (same(-1, 0) << 3);
      const sp = blockSprite(bk, mask, hash(x, y, 4) < 0.5 ? 0 : 1, (mask & 6) === 6);
      const [X, Y] = tI(x, y);
      statics.push({ sp, dx: X - 16 * K, dy: Y - sp.H, x: X, y: Y + 16, d: Y + 8, glow: null, glint: -1, block: true });
      continue;
    }
    const au = theme === "autumn";
    let sp = (au && S.AU[ch]) || S[ch];
    if (!sp || ch === "c") continue;
    const h = hash(x, y, 3);
    if (au && ch === "T") { const hu = hueAt(m, x, y); sp = sp[hu][hu === 0 ? (h < 0.65 ? 1 : 0) : h < 0.25 ? 1 : 0]; }
    else if (au && ch === "Y") sp = h < 0.55 ? S.AU.toad : S.Y[Math.floor(h * 2)];
    else if (au && ch === "B") {
      // roses grow by the graves and the fences round them, and wherever the blight is
      const grave = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]].some(([dx, dy]) => "JF".includes((m.o[y + dy] || [])[x + dx] || "."));
      sp = sp[grave || m.g[y][x] === "&" || hash(x, y, 5) < 0.08 ? 3 : Math.min(2, hueAt(m, x, y))];
    }
    else if (ch === "T") sp = sp[edge(x, y) ? (h < 0.7 ? 0 : 2) : h < 0.5 ? 0 : h < 0.72 ? 2 : h < 0.88 ? 1 : 3];
    else if (ch === "B") sp = theme === "town" ? S.TB[Math.floor(h * 3)] : sp[Math.floor(h * 3)];
    else if (ch === "L") sp = theme === "city" ? S.L2 : S.L;
    else if (ch === "K") sp = hash(x, y, 7) > 0.6 ? S.K2 : S.K;
    else if (ch === "Y") sp = (theme === "cave" ? S.Y2 : S.Y)[Math.floor(h * 2)];
    else if (ch === "I") sp = sp[pewAlongX(m, x, y) ? 0 : 1];
    else if (Array.isArray(sp)) sp = sp[Math.floor(h * sp.length)];
    statics.push(stand({
      sp, glow: ch === "L" ? "#ffe690" : ch === "K" ? "#72e6f4" : ch === "3" || ch === "9" ? "#ffd070" : ch === "0" || ch === "X" ? "#ff6a7a" : ch === "Y" && theme === "cave" ? "#5ae4d0" : ch === "/" ? "#9affc8" : null, glint: ch === "K" ? hash(x, y, 9) * 6 : -1,
    }, x, y, ch === "T" || ch === "P" ? Math.round((hash(x, y, 8) - 0.5) * 6) : 0));
  }
  // cars stand across two tiles; houses and city blocks over four by three
  const A = artSc();
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.o[y][x] !== "c" || art.has(x + "," + y)) continue;
    const car = A.c[Math.floor(hash(x, y, 3) * A.c.length)], [X, Y] = tI(x, y);
    const st = { sp: car.cv, dx: X - car.ax, dy: Y - car.ay, x: X + 8, y: Y + 16, d: Y + 12, glow: null, glint: -1 };
    slice(st, x, y, 2, 1);
    statics.push(st);
  }
  for (const b of m.big) {
    if (b.t === "house") {
      if (artHouse.has(b)) continue;
      const city = b.v >= 4, hs = A.house[b.v % 8], [X, Y] = tI(b.x, b.y);
      const s = { sp: hs.cv, dx: X - hs.ax, dy: Y - hs.ay, x: tI(b.x + 2, b.y + 1.5)[0], y: tI(b.x + 4, b.y + 3)[1], glow: city ? NEON[b.v % 4] : null, big: true, neon: city ? NEON[b.v % 4] : null, ph: hash(b.x, b.y, 2) * 9, house: !city };
      slice(s, b.x, b.y, 4, 3);
      statics.push(s);
      if (!city) smokers.push({ x: s.x + 6, y: s.dy + 10 });
    } else if (b.t === "spirit") statics.push(stand({ sp: Camp.spiritTree(), glow: "#5ab8ff", land: "spirit", spirit: true, ph: 1.3, glint: -1 }, b.x, b.y));
    else statics.push(standBig({ sp: S.fountain, water: true }, b.x, b.y, 2, 2, -4));
  }
  // every fire that always burns: a ring of stones, stumps to sit on; in town a tripod, a pot and a bedroll
  lt.push(performance.now());
  camps = (m.camps || []).map((c) => {
    const [X, Y] = iso(c.x, c.y), flat = (sp, cx, cy, d) => statics.push({ sp, dx: Math.round(X + cx), dy: Math.round(Y + cy), x: X, y: Y, d, glow: null, glint: -1 });
    flat(Camp.ring(), -17, -10, Y - 30);
    for (const [sx, sy] of c.seats) { const [SX, SY] = iso(sx, sy); statics.push({ sp: Camp.stump(), dx: Math.round(SX - 9), dy: Math.round(SY - 9), x: SX, y: SY, d: SY - 0.5, glow: null, glint: -1, stump: true }); }
    if (m.safe) {
      const [BX, BY] = iso(c.x + 23, c.y + 29);
      statics.push({ sp: Camp.bedroll(), dx: Math.round(BX - 13), dy: Math.round(BY - 8), x: BX, y: BY, d: BY - 4, glow: null, glint: -1 });
      statics.push({ sp: Camp.tripod(0), sp1: Camp.tripod(1), dx: Math.round(X - 17), dy: Math.round(Y - 31), x: X, y: Y, d: Y + 0.5, glow: null, glint: -1, pot: true });
    }
    return { x: X, y: Y, wx: c.x, wy: c.y, seats: c.seats, pot: !!m.safe };
  });
  const fromDC = (st) => {
    if (st.lip) return null;
    if (st.foot) { const [x, y, w, h] = st.foot; return standBig(st, x, y, w, h); }
    if (st.tile) return stand(st, st.tile[0], st.tile[1]);
    return stand(st, (st.x - 16) / T, (st.y + 3) / T - 1);
  };
  for (const st of lay.statics) { const s = fromDC(st); if (s) statics.push(s); }
  for (const st of mkt.statics) { const s = fromDC(st); if (s) statics.push(s); }
  // what lights up after dark: lamps, windows, landmarks, runes
  for (const st of statics) if (st.glow || st.wp || st.nightGlow || st.house || st.pot) lights.push(st);
  lazyLeft = statics.filter((st) => st.lazy).length;
  npcs = m.npcs.map((n) => { const [x, y] = iso(n.x * 16 + 8, n.y * 16 + 12); return { n, x, y, sheet: SP.personSheet(SP.npcLook(n.look, n.role)) }; });
  ents.clear();
  fx.clear();
  amb.length = 0;
  lt.push(performance.now());
  loadCost = { ground: lt[1] - lt[0], sprites: lt[2] - lt[1], plan: lt[3] - lt[2], tiles: lt[4] - lt[3], rest: lt[5] - lt[4] };
  for (const k of Object.keys(loadCost)) loadCost[k] = Math.round(loadCost[k]);
}

/**
 * A signpost's board points at the gate it names, if the gate is clearly to one
 * side; otherwise it is a plain board. Returns -1 (left), 0 or 1 (right).
 */
function signWay(m, x, y, k) {
  if (!k) return 0;
  // the label may carry its own arrow
  const lab = String(k.label || "");
  if (/[←⇐◀↖↙]/.test(lab)) return -1;
  if (/[→⇒▶↗↘]/.test(lab)) return 1;
  if (/[↑↓]/.test(lab) || !k.to) return 0;
  const want = String(k.to);
  const gate = (m.portals || []).find((p) => p.to === want || p.id === want || p.map === want || (p.to && (p.to.startsWith(want) || want.startsWith(p.to.split(" Lv")[0]))));
  if (!gate) return 0;
  const dx = gate.x - x, dy = gate.y - y;
  return Math.abs(dx) < Math.abs(dy) * 0.5 ? 0 : Math.sign(dx);
}
/** Where each signpost's words go on screen (CSS pixels, the centre of a line just above the board), for the page to letter crisply. */
const labelOut = [];
export function labels() {
  labelOut.length = 0;
  const ox = cam.ox ?? cam.x, oy = cam.oy ?? cam.y;
  for (const s of signs) {
    const sx = s.x - ox, sy = s.y - 40 - oy;
    if (sx < -60 || sx > vw + 60 || sy < -20 || sy > vh + 40) continue;
    labelOut.push({ x: sx * Z, y: sy * Z, text: s.label });
  }
  return labelOut;
}
/** Whether the waypoint here has been touched: unknown counts as lit, so a stone never looks dead by mistake. */
function wpLit() {
  const self = G && G.self;
  const got = self && self.wp;
  // (self.wp: { mapId: bitmask of its stones })
  return !got || typeof got !== "object" || (Array.isArray(got) ? got.includes(map.id) : !!(got[map.id] & 1));
}

// ───────────────────────────── ambient life ─────────────────────────────

/** Drifting motes: pollen in the open, fireflies and leaves under trees, rain in the city, dust underground. */
const amb = [];
const AMB_N = { town: 16, meadow: 24, forest: 26, city: 80, cave: 26, crypt: 18, sewer: 22, abyss: 36, autumn: 40 };
function respawn(p, ox, oy, fresh) {
  const k = theme === "forest" ? (Math.random() < 0.45 ? "fly" : "leaf") : theme === "autumn" ? (Math.random() < 0.12 ? "spore" : "leaf") : theme === "city" ? "rain" : theme === "cave" || UG[theme] ? "dust" : "pollen";
  p.k = k;
  p.x = ox - 20 + Math.random() * (vw + 40);
  p.y = k === "rain" && !fresh ? oy - 10 : oy - 10 + Math.random() * (vh + 20);
  p.max = k === "rain" ? 9 : 3 + Math.random() * 4;
  p.life = fresh ? Math.random() * p.max : p.max;
  p.ph = Math.random() * 6.28;
  p.vx = k === "rain" ? -46 : k === "pollen" ? 5 + Math.random() * 9 : k === "leaf" ? -6 - Math.random() * 8 : (Math.random() - 0.5) * 6;
  p.vy = k === "rain" ? 400 + Math.random() * 120 : k === "leaf" ? 9 + Math.random() * 6 : k === "dust" ? -3 - Math.random() * 4 : (Math.random() - 0.5) * 4;
  p.c = k === "leaf" ? (theme === "autumn" ? HUE[Math.random() < 0.9 ? Math.floor(Math.random() * 3) : 3].fall[Math.floor(Math.random() * 3)] : Math.random() < 0.5 ? "#d89a48" : "#7abf52") : null;
  if (k === "spore") { p.vx = (Math.random() - 0.5) * 5; p.vy = -4 - Math.random() * 4; }
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
    else if (p.k === "spore") { const a = (0.5 + 0.5 * Math.sin(t / 400 + p.ph * 3)) * fade; g.globalAlpha = a * 0.35; g.fillStyle = "#b06ad8"; g.fillRect(sx - 1, sy - 1, 3, 3); g.globalAlpha = a; g.fillStyle = "#e0b8ff"; g.fillRect(sx, sy, 1, 1); }
    else if (p.k === "dust") { g.globalAlpha = fade * (theme === "abyss" ? 0.8 : 0.55); g.fillStyle = UG[theme] ? UG[theme].mote : "#bfe8ff"; g.fillRect(sx, sy, 1, theme === "sewer" ? 2 : 1); }
    else { g.globalAlpha = fade * 0.8; g.fillStyle = "#fffbe0"; g.fillRect(sx, sy, 1, 1); if (p.ph > 4) g.fillRect(sx + 1, sy, 1, 1); }
  }
  g.globalAlpha = 1;
}
/** Water never sits still: glints slide across it and foam breathes along the shore. (Iso pixels.) */
function drawWater(t, ox, oy) {
  const beat = Math.floor(t / 520);
  const wet = UG[theme] ? UG[theme].wet : null;
  for (const w of waterTiles) {
    if (w.X < ox - 20 || w.X > ox + vw + 20 || w.Y < oy - 20 || w.Y > oy + vh) continue;
    const ph = (beat + Math.floor(w.h * 8)) % 4, cx = w.X, cy = w.Y + 8;
    g.fillStyle = wet ? wet[2] : "#8accf6";
    g.fillRect(cx - 9 + ph * 3 + Math.floor(w.h * 4), cy - 3, 4, 1);
    g.fillRect(cx + 4 - ph * 2, cy + 2, 3, 1);
    if (ph === 0 && w.h > 0.6) { g.fillStyle = "#ffffff"; g.fillRect(cx - 1 + Math.floor(w.h * 6), cy, 2, 1); }
    if (w.n | w.s | w.w | w.e) {
      // foam along the diamond's open edges: north runs up-right from the top corner, west up-left, and so on
      g.fillStyle = wet ? wet[4] : "#e8f8ff";
      const o = ph % 2;
      const dash = (x0, y0, dx, dy) => { for (const f of [0.18 + o * 0.1, 0.6 - o * 0.08]) g.fillRect(Math.round(x0 + dx * f * 16), Math.round(y0 + dy * f * 8), 3, 1); };
      if (w.n) dash(cx + 1, w.Y + 1, 1, 1);
      if (w.w) dash(cx - 4, w.Y + 1, -1, 1);
      if (w.e) dash(cx + 13, w.Y + 9, -1, 1);
      if (w.s) dash(cx - 2, w.Y + 15, -1, -1);
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
  // a brisk, bouncy stride; the feet kick up whatever they walk on (stepLife, below)
  if (e.moving) s.walk += dt * 8;
  const life = e.scr || e.dead ? null : stepLife(s, e, t, dt, x, y);
  // a blow that connects freezes for a beat (`e.hs`), then carries on from where it stopped
  const hs = e.hs && e.atkT <= e.hs.at ? e.hs : null;
  const te = !hs || t < hs.at ? t : t < hs.at + hs.dur ? hs.at : t - hs.dur;
  const atk = (te - e.atkT) / 1000;
  // a whole stroke and the beat it is held after: the time the attacker keeps facing the target
  const strokeT = (SP.HOLD[s.wk] || SP.HOLD.sword).time * ((e.atkN | 0) === 2 ? 1.15 : 1);
  const engaged = !!e.aim && atk > -0.2 && atk < strokeT + 0.35;
  // which way they face on screen: the way they last moved, or the way the server says they turned
  let view;
  if (e.scr) {
    // the title stage still speaks in screen directions: 0 front, 1 left, 2 right, 3 back
    view = e.dir === 3 ? "back" : e.dir === 0 ? "front" : "side";
    if (e.dir === 1) s.face = -1; else if (e.dir === 2) s.face = 1;
    if (engaged) s.face = e.aim[0] < e.x ? -1 : 1;
  } else {
    if (s.lx !== undefined && Math.hypot(e.x - s.lx, e.y - s.ly) > 0.05) { s.fa = sAng(e.x - s.lx, e.y - s.ly); s.ldir = e.dir; }
    else if (s.fa === undefined || e.dir !== s.ldir) { s.fa = sAng(DXW[e.dir | 0], DYW[e.dir | 0]); s.ldir = e.dir; }
    s.lx = e.x; s.ly = e.y;
    let fa = s.fa;
    if (e.sit && e.seatFa !== undefined) fa = e.seatFa;       // on a stump, turned to the fire
    if (engaged && (!e.moving || atk < 0.5) && Math.hypot(e.aim[0] - e.x, e.aim[1] - e.y) > 2) fa = sAng(e.aim[0] - e.x, e.aim[1] - e.y);
    // eight ways on screen: straight down shows the face, the three ways up show the back,
    // and everything else is the three-quarter turn, mirrored for the left
    const sec = ((Math.round(fa / (Math.PI / 4)) % 8) + 8) % 8;
    view = sec === 2 ? "front" : sec >= 5 ? "back" : "side";
    if (sec === 0 || sec === 1 || sec === 7) s.face = 1; else if (sec >= 3 && sec <= 5) s.face = -1;
  }
  const back = view === "back";
  const ang = (dx, dy) => (e.scr ? Math.atan2(dy, dx) : sAng(dx, dy));
  // walking steps foot to foot; standing still breathes, and blinks now and then
  if (s.ph === undefined) s.ph = Math.random() * 4000;
  const F = SP.FRAME;
  let frame = e.dead ? F.stand
    : e.sit ? F.breathe
    : e.moving ? [F.stepA, F.stretch, F.stepB, F.stretch][Math.floor(s.walk) % 4]
    : (t + s.ph) % 3600 < 140 ? F.blink
    : Math.floor((t + s.ph) / 560) % 2 ? F.breathe : F.stand;
  const sg = s.face;
  // the stroke being made, if any (swing.js): poses keyed on a 0–1 clock, the blow landing at Sw.IMPACT
  const hold = SP.HOLD[s.wk] || SP.HOLD.sword;
  const beat = e.atkN | 0, fin = beat === 2, stroke = strokeT;
  const k = atk / stroke, resting = k >= 1, live = !!e.aim && atk >= 0 && !resting && !e.dead;
  const aimS = e.aim ? ang(e.aim[0] - e.x, e.aim[1] - e.y) : sg > 0 ? 0.25 : Math.PI - 0.25;
  const aimYaw = e.aim ? (e.scr ? Sw.groundYaw(e.aim[0] - e.x, e.aim[1] - e.y) : Math.atan2(e.aim[1] - e.y, e.aim[0] - e.x)) : 0;
  const sk = Sw.has(s.wk) ? s.wk : hold.style === "sweep" ? "sword" : hold.style === "stab" ? "spear" : "staff";
  const side = (beat === 1 ? -1 : 1) * sg;             // the second stroke comes back the other way
  const bowy = hold.style === "bow";
  const P = !live ? null : hold.style === "float" ? Sw.bookPose(beat, k) : bowy ? Sw.bowPose(beat, k, side, e.bowUp) : Sw.pose(sk, beat, k, side);
  if (s.t0 !== e.atkT) { s.t0 = e.atkT; s.from = s.ang; s.fromLen = s.len ?? 1; s.fromPush = s.push || 0; s.fromLean = s.lean || 0; }
  // the body rocks back on the wind-up, leans (or steps) into the blow, and settles back after
  if (P) s.lean = P.pre !== undefined ? s.fromLean + (P.lean - s.fromLean) * Sw.eOut(P.pre) : P.lean;
  else s.lean = (s.lean || 0) * Math.max(0, 1 - dt * 7);
  if (s.lean) { x += Math.cos(aimS) * s.lean; y += Math.sin(aimS) * s.lean * 0.75; }
  // the weight shows in the body: crouched on the wind-up and the landing, stretched at full reach
  if (P && P.fr && !e.moving && !e.sit) frame = P.fr === "crouch" ? F.breathe : F.stretch;
  // facing the camera shows the full face; walking sideways turns it three-quarters
  const img = s.sheet[view][frame];
  s.img = img;
  g.fillStyle = "rgba(20,24,50,.26)";
  g.beginPath(); g.ellipse(x, y, 5, 2, 0, 0, 7); g.fill();
  const fl = e.fl | 0;
  // walking: a 1-px hop on the stretched steps; a short squash when they stop or turn
  const hop = life && e.moving && !e.sit && frame === F.stretch ? 1 : 0;
  const body = () => {
    if (life) drawTrail(s, t);
    g.save();
    g.translate(Math.round(x), Math.round(y - hop));
    if (e.dead) { g.rotate(sg * 1.45); g.globalAlpha = 0.6; }
    else if (fl & 64) g.globalAlpha = 0.4;             // slipped away behind a puppet
    else if (fl & 16) g.globalAlpha = 0.55 + 0.25 * Math.sin(t / 40);   // a shadow, blinking about
    const sq = life ? life.sq : 0;
    g.scale(sg * (1 + sq * 0.9), (e.sit && !e.dead ? 0.8 : 1) * (1 - sq));       // sitting: tucked down a little
    // leaning one pixel into the walk: the upper body drawn a pixel ahead of the legs
    const ln = life ? life.lean * sg : 0, cut = SP.FOOT[1] - 6;
    if (ln) { g.drawImage(img, 0, 0, img.width, cut, -SP.FOOT[0] + ln, -SP.FOOT[1], img.width, cut); g.drawImage(img, 0, cut, img.width, img.height - cut, -SP.FOOT[0], -SP.FOOT[1] + cut, img.width, img.height - cut); }
    else g.drawImage(img, -SP.FOOT[0], -SP.FOOT[1]);
    g.restore();
  };
  if (!s.weapon || e.dead || (fl & 2)) return body();    // (the greatsword is off stuck in the ground)
  const bob = (frame === F.stretch ? -1 : frame === F.breathe ? 1 : 0) - hop;
  const glow = RARITY[s.gear.wq | 0] || (s.gear.we >= 7 ? "#ffffff" : null);
  if (hold.style === "float") {
    // a spellbook hovers open beside its reader, is drawn back to the chest, and darts out to cast
    const out = P ? P.out * hold.push : 0, big = P ? P.big : 1;
    const bx = x + sg * 9 + Math.cos(aimS) * out, by = y - 8 + Math.sin(t / 380 + s.ph) * 1.2 + Math.sin(aimS) * out + bob - (P ? P.lift : 0);
    const book = () => {
      g.save();
      if (P && k > Sw.WIND * 0.8 && k < 0.4) { g.shadowColor = "#fff2b0"; g.shadowBlur = 10; } else if (glow) { g.shadowColor = glow; g.shadowBlur = 5; }
      g.translate(Math.round(bx), Math.round(by)); g.scale(big, big);
      g.drawImage(s.weapon, -16, -16);
      g.restore();
    };
    if (back) { book(); body(); } else { body(); book(); }
    if (live && k >= Sw.IMPACT && k < Sw.IMPACT + 0.2 && s.qiT !== e.atkT) { s.qiT = e.atkT; qiBurst("book", beat, bx, by, aimS, side, 12, glow); }
    return;
  }
  const rest = sg > 0 ? -hold.rest * DEG : Math.PI + hold.rest * DEG;
  if (s.ang === null) { s.ang = rest; s.len = 1; }
  const turn = (a, b, u) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * u; };
  const held = resting && atk < stroke + 0.6;           // poised at the end of the stroke, ready for the next
  let push = 0, len = 1, depth = 0, grow = 0;
  /** A pose → [screen angle, foreshortened length, depth, hand push]. */
  const place = (p) => { const [a, l, d] = Sw.project(aimYaw + p.yaw, p.pitch); return [a, l, d, p.reach]; };
  if (P) {
    let [pa, pl, pd, pp] = place(P);
    // the wind-up starts from wherever the weapon was: at rest, or where the last stroke ended
    // (a bow is not wound up from where it hung: it comes straight onto the aim, raised by s.bw)
    if (P.pre !== undefined && !bowy) { const u = Sw.eOut(P.pre); pa = turn(s.from ?? pa, pa, u); pl = (s.fromLen ?? 1) + (pl - (s.fromLen ?? 1)) * u; pp = s.fromPush + (pp - s.fromPush) * u; }
    s.ang = pa; len = pl; depth = pd; push = pp;
    // through the strike the weapon swells toward the eye
    if (P.strike) grow = Math.sin(clamp((k - Sw.WIND + 0.02) / 0.16, 0, 1) * Math.PI) * hold.grow * (fin ? 1.4 : 1);
    s.endAng = s.ang; s.endLen = len; s.endPush = push; s.endDepth = depth;
  } else if (held) {
    s.ang = s.endAng ?? s.ang; len = s.endLen ?? 1; push = s.endPush ?? 0; depth = s.endDepth ?? 0;
  } else {
    // the run is over: the weapon comes down and is slung again, unhurried
    s.ang = turn(s.ang, rest, Math.min(1, dt * 5));
    len = (s.len ?? 1) + (1 - (s.len ?? 1)) * Math.min(1, dt * 6);
    push = (s.push || 0) * Math.max(0, 1 - dt * 6);
  }
  s.push = push; s.len = len;
  // a greatsword is slung across the back between fights, and comes off it to fight
  s.sl = (s.sl ?? 1) + ((hold.style === "sweep" && resting && !held ? 1 : 0) - (s.sl ?? 1)) * Math.min(1, dt * 8);
  // with no arms, the weapon simply floats at the body's side; a bow's pivot is the drawing hand:
  // at the cheek while shooting (the riser out ahead of it), dropped to the hip at rest
  // (raised at once — a shot has no wind-up to spare — and lowered unhurried)
  if (bowy) s.bw = P ? 1 : (s.bw ?? 0) + ((held ? 1 : 0) - (s.bw ?? 0)) * Math.min(1, dt * 8);
  const hx0 = bowy ? x - sg * 1.5 * (1 - s.bw) + Math.cos(aimS) * 3 * s.bw : x + sg * (7 - 4 * s.sl);
  const hy0 = bowy ? y - 5 - 2 * s.bw + Math.sin(aimS) * 1.5 * s.bw + bob : y - (3 + 2 * s.sl) + bob;
  const hx = hx0 + Math.cos(s.ang) * push * len, hy = hy0 + Math.sin(s.ang) * push * len;
  const long = Sw.bladeLen(s.weapon, SP.GRIP);
  // the bow at this moment of its shot: the string's pull and whether an arrow is on it
  const bs = bowy ? P || (held ? Sw.BOW_READY : null) : null;
  const wimg = bowy ? SP.bowSprite(s.gear, bs ? bs.pull : 0, bs ? bs.arrow : false) : s.weapon;
  const weapon = () => {
    // the smear: the band the blade's outer half swept through in the last few hundredths of a
    // second, sampled along the stroke itself so it bends with the arc as the view shows it
    if (P && P.strike && grow > 0.05) {
      const pts = [], inner = [], span = 0.07 / stroke;
      for (let j = 0; j <= 6; j++) {
        const kk = Math.max(Sw.WIND, k - (span * j) / 6);
        const q = Sw.pose(sk, beat, kk, side);
        if (!q) continue;
        const [a, l, , r] = place(q), L = long * Math.max(0.45, l) * (1 + grow);
        const ox = hx0 + Math.cos(a) * r * l, oy = hy0 + Math.sin(a) * r * l;
        pts.push([ox + Math.cos(a) * L, oy + Math.sin(a) * L]);
        inner.push([ox + Math.cos(a) * L * 0.62, oy + Math.sin(a) * L * 0.62]);
      }
      if (pts.length > 2) {
        g.save();
        g.beginPath();
        pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
        for (let i = inner.length - 1; i >= 0; i--) g.lineTo(inner[i][0], inner[i][1]);
        g.closePath();
        g.globalAlpha = 0.4; g.fillStyle = glow || "#dfe8ff"; g.fill();   // faint: the burst of qi at the snap carries the stroke
        g.globalAlpha = 0.9; g.strokeStyle = "#ffffff"; g.lineWidth = 1;
        g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
        g.restore();
      }
    }
    g.save();
    g.translate(Math.round(hx), Math.round(hy));
    g.rotate(s.ang);
    if (Math.cos(s.ang) < 0) g.scale(1, -1);
    // turned toward or away from the camera, the blade is seen end-on and looks shorter
    g.scale((1 + grow) * Math.max(0.45, len), 1 + grow);
    if (glow) { g.shadowColor = glow; g.shadowBlur = s.gear.we >= 7 ? 9 : 5; }
    g.drawImage(wimg, -SP.GRIP[0], -SP.GRIP[1]);
    g.restore();
    // the finisher's overdraw: the arrowhead catches the light, a four-point glint blinking at full draw
    if (bs && bs.glint && Math.floor(t / 45) % 2 === 0) {
      const tl = (13 + push) * Math.max(0.45, len), gx = Math.round(hx0 + Math.cos(s.ang) * tl), gy = Math.round(hy0 + Math.sin(s.ang) * tl);
      g.fillStyle = "#fff6c0"; g.fillRect(gx - 2, gy, 5, 1); g.fillRect(gx, gy - 2, 1, 5);
      g.fillStyle = "#ffffff"; g.fillRect(gx, gy, 1, 1);
    }
  };
  // a slung greatsword sits behind the body; in a stroke, a blade pointing away from the camera does too
  const behind = resting && !held ? (hold.style === "sweep") !== back : depth < -0.35 || (Math.sin(s.ang) < -0.45 && depth < 0.2);
  if (behind) { weapon(); body(); } else { body(); weapon(); }
  // the blow lands: a burst of sword-qi as big as the weapon, at the snap (once per stroke)
  // (a bow throws no qi: the string snaps, and the arrow is the blow — fx.arrow, from the server's shot)
  if (live && bowy && k >= Sw.IMPACT && k < Sw.IMPACT + 0.2 && s.qiT !== e.atkT) {
    s.qiT = e.atkT;
    bowSnap(hx0 + Math.cos(s.ang) * (7 + push) * len, hy0 + Math.sin(s.ang) * (7 + push) * len, s.ang, fin || !!e.bowUp, glow);
  } else if (live && !bowy && k >= Sw.IMPACT && k < Sw.IMPACT + 0.2 && s.qiT !== e.atkT) {
    s.qiT = e.atkT;
    const [ia, il, , ir] = place(Sw.pose(sk, beat, Sw.IMPACT, side));
    const tipX = hx0 + Math.cos(ia) * (ir * il + long * Math.max(0.45, il)), tipY = hy0 + Math.sin(ia) * (ir * il + long * Math.max(0.45, il));
    qiBurst(s.wk in QI_COL ? s.wk : sk, beat, hold.style === "sweep" || (beat === 1 && hold.style === "stab") ? hx0 : tipX, hold.style === "sweep" || (beat === 1 && hold.style === "stab") ? hy0 : tipY, aimS, side, long + 6, glow);
  }
}

// ── movement life: the stride's bounce, a lean into the walk, a squash when stopping or
// turning, footsteps that kick up the ground underfoot, and an afterimage when running fast

/** What the ground under (wx, wy) gives a footstep: grass, leaf, dirt, stone, water, wet, mud, soft (indoors). */
function footKind(wx, wy) {
  if (!map || !map.g) return "dirt";
  if (theme === "interior") return "soft";
  const row = map.g[Math.floor(wy / 16)], c = row ? row[Math.floor(wx / 16)] : null;   // 16 server units a tile
  if (c === "w" || c === "b") return "water";
  if (c === "j") return "mud";
  if (theme === "sewer" || theme === "abyss") return "wet";
  if (theme === "autumn" && (c === "%" || c === ";" || c === ":" || c === "." || c === ",")) return "leaf";
  if (c === "." || c === "," || c === '"' || c === "t" || c === ":" || c === ";") return UG[theme] ? "stone" : "grass";
  if (c === "p" || c === "s") return "dirt";
  return "stone";
}
const LEAF = ["#e0602a", "#f0a030", "#c83a2a", "#e8c040"];
const WET = { sewer: ["#9ac860", "#cfe8a0"], abyss: ["#e06070", "#ffb0b8"] };
/** One footfall (the sound of your own is client.js soundscape's) at iso pixel (x, y): a puff and bits of whatever the ground is made of. */
function footstep(kind, x, y, fast, wx, wy) {
  const R = Math.random, f = fast ? 1.3 : 1, x0 = wx * P, y0 = wy * P;   // flat effects speak in world pixels
  const puff = (col, n) => { for (let i = 0; i < n; i++) parts.push({ x: x + (R() - 0.5) * 6, y: y - 1, vx: (R() - 0.5) * 20 * f, vy: -6 - R() * 7, life: 0.26 + R() * 0.14, color: col, g: 12, s: i ? 2 : 3 }); };
  const bits = (cols, n, vy, grav, s = 1) => { for (let i = 0; i < n; i++) parts.push({ x: x + (R() - 0.5) * 6, y: y - 1, vx: (R() - 0.5) * 26 * f, vy: -vy * (0.7 + R() * 0.5), life: 0.28 + R() * 0.14, color: cols[(R() * cols.length) | 0], g: grav, s }); };
  const ripple = (col) => fxCustom((q, k) => { q.globalAlpha = 1 - k; q.strokeStyle = col; q.lineWidth = 1.5; q.beginPath(); q.ellipse(x0, y0, 3 + k * 9, 3 + k * 9, 0, 0, 7); q.stroke(); }, 420, true);
  if (kind === "grass") { puff("#e8e0c0", 1 + (R() < 0.5)); bits(["#2f7a34", "#b8f080", "#8ad86a"], 2, 30, 170); }
  else if (kind === "leaf") { puff("#d8b888", 1); bits(LEAF, 2, 26, 90, R() < 0.5 ? 2 : 1); }
  else if (kind === "dirt") puff(R() < 0.5 ? "#d8c08a" : "#c8ac78", 2);
  else if (kind === "stone") puff(UG[theme] ? "#a8a4b0" : "#d0ccc4", 2);
  else if (kind === "water" || kind === "wet" || kind === "mud") {
    const cols = kind === "mud" ? ["#8a6a48", "#b0906a"] : WET[theme] || ["#cfeaff", "#9fd0f0", "#ffffff"];
    bits(cols, 3, 40, 260);
    ripple(kind === "mud" ? "rgba(120,90,60,.7)" : kind === "wet" && WET[theme] ? WET[theme][1] : "rgba(225,245,255,.85)");
  } else if (kind === "soft" && R() < 0.5) parts.push({ x, y: y - 1, vx: (R() - 0.5) * 8, vy: -5, life: 0.25, color: "#c8b8a0", g: 0, s: 1 });
}
/** Per frame, for anyone standing in the world: how they lean and squash, and their footfalls. */
function stepLife(s, e, t, dt, x, y) {
  const out = { lean: 0, sq: 0 };
  if (s.mx !== undefined && dt > 0) {
    const dx = e.x - s.mx, dy = e.y - s.my, v = Math.hypot(dx, dy) / dt;
    if (v < 900) s.v = (s.v || 0) * 0.75 + v * 0.25;          // (a warp is not a run)
    const sdx = dx - dy;                                       // across the screen
    if (e.moving && Math.abs(sdx) > 0.05) {
      const d = sdx > 0 ? 1 : -1;
      if (s.sdir && s.sdir !== d) s.landT = t;                 // turned round: a quick squash
      s.sdir = d;
    }
    if (s.wasMv && !e.moving) s.landT = t;                     // stopped: the weight lands
  }
  s.mx = e.x; s.my = e.y; s.wasMv = e.moving;
  if (e.sit) return out;
  const fast = (s.v || 0) > 62;                                // hasted (×1.4), or dashing
  if (e.moving) {
    out.lean = s.sdir || 0;
    const st = Math.floor(s.walk * (fast ? 2 : 1));
    if (st !== s.step) {
      if (s.step !== undefined && st % 2 === 0) {
        footstep(footKind(e.x, e.y), x + (st % 4 ? 2 : -2), y, fast, e.x, e.y);
      }
      s.step = st;
    }
  }
  const q = (t - (s.landT || -1e9)) / 120;
  if (q >= 0 && q < 1) out.sq = 0.12 * (1 - q) * (1 - q);
  // running fast leaves a faint afterimage behind
  if (fast && e.moving && s.img && t - (s.trailT || 0) > 45) {
    s.trailT = t;
    (s.trail ||= []).push({ img: s.img, x: Math.round(x), y: Math.round(y), face: s.face, t0: t });
  }
  return out;
}
/** The afterimages, fading over 180 ms, drawn just before the body. */
function drawTrail(s, t) {
  if (!s.trail || !s.trail.length) return;
  s.trail = s.trail.filter((a) => t - a.t0 < 180);
  for (const a of s.trail) {
    g.save();
    g.globalAlpha = 0.28 * (1 - (t - a.t0) / 180);
    g.translate(a.x, a.y); g.scale(a.face, 1);
    g.drawImage(tintWhite(a.img, "#bfe0ff"), -SP.FOOT[0], -SP.FOOT[1]);
    g.restore();
  }
}
/** A one-colour silhouette of a sprite (afterimages, hit flashes), cached per sprite and colour. */
const silCache = new WeakMap();
export function tintWhite(img, col = "#ffffff") {
  let m = silCache.get(img);
  if (!m) { m = new Map(); silCache.set(img, m); }
  let c = m.get(col);
  if (c) return c;
  let x;
  [c, x] = sheet(img.width, img.height);
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = col; x.fillRect(0, 0, img.width, img.height);
  m.set(col, c);
  return c;
}

// ───────────────────────────── effects ─────────────────────────────

const parts = [];
/** The colour an elite takes from its first trait (names from the sprite sheet's tint list). */
const TRAIT_TINT = { fire: "fire", poison: "poison", frost: "frost", tough: "steel", vamp: "blood", swift: "gold", burst: "ash", thorn: "bone" };
/** What a spat puddle looks like, by kind: poison, fire, blood. */
const POOL_COL = ["#8ad84a", "#ff8a3a", "#c8324a"];
/**
 * Things the class skills leave standing in the world — a stuck greatsword, a banner,
 * a teapot, a rogue's puppet: id → { x, y, until, draw(g, t, sx, sy) } in world units,
 * sorted in with everything else that stands up. `hooks` draw over the creatures
 * each frame (marks over monsters and the like): (g, t, P) in world pixels.
 */
export const props = new Map();
export const hooks = [];
/** A person's standing frame (front view) and weapon sprite, for drawing copies of them. */
export function personFrame(eid) {
  const w = G && G.who.get(eid);
  if (!w) return null;
  const s = personState(eid, playerLook(w.cls, w.look, w.gear));
  return { img: s.sheet.front[SP.FRAME.stand], weapon: s.weapon, wk: s.wk };
}
export const FOOT = SP.FOOT;
/** A custom effect: draw(g, k, f) is called with k running 0 → 1 over `dur` ms. */
export function fxCustom(draw, dur, flat = false, delay = 0) { fx.add({ k: "custom", draw, dur, flat, delay }); }
/** The effects' clock: the time of the frame being drawn (so previews that step time by hand animate them too). */
let fxClock = null;
const fxNow = () => fxClock ?? performance.now();

// ── sword-qi: the burst each basic blow throws off at the snap (drawPerson calls qiBurst once a
// stroke, at swing.js IMPACT). Pixel-built, never smoothed: a white-hot first frame or two, then
// the weapon's colour, thinning and breaking into a dither as it evaporates.
const QI_COL = { sword: "#cfe0ff", dagger: "#ecdcff", spear: "#d0f8ec", staff: "#c8a8ff", book: "#dcc0ff" };
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const qiCache = new Map();
/**
 * A crescent of sword-qi R pixels across, bulging toward screen angle `ang`, squashed `sq` up and
 * down (a level sweep lies flat, a chop stands up), thickest toward the end the blade swept to.
 * `ph` 0 white-hot, 1 coloured with a white edge, 2 thinner and dithered, 3 nearly gone.
 */
function qiSprite(R, ang, side, sq, ph, col) {
  const step = ((Math.round((ang / (2 * Math.PI)) * 48) % 48) + 48) % 48, key = `${R}|${step}|${side}|${sq}|${ph}|${col}`;
  let c = qiCache.get(key);
  if (c) return c;
  if (qiCache.size > 600) qiCache.clear();
  const a = (step / 48) * 2 * Math.PI, au = Math.atan2(Math.sin(a) / sq, Math.cos(a));
  const N = 2 * R + 3, mid = R + 1, span = 1.3, thick = R * 0.5 * [1, 0.8, 0.55, 0.38][ph];
  let x;
  [c, x] = sheet(N, N);
  const im = x.createImageData(N, N), d = im.data, [cr, cg, cb] = hexRGB(col);
  const put = (i, j, r, gg, b) => { const o = (j * N + i) * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = i - mid, dy = (j - mid) / sq, rho = Math.hypot(dx, dy);
    if (rho > R + 0.5) continue;
    const th = Math.atan2(Math.sin(Math.atan2(dy, dx) - au), Math.cos(Math.atan2(dy, dx) - au));
    if (Math.abs(th) > span) continue;
    const u = (th * side / span + 1) / 2, w = thick * Math.sin(Math.PI * u ** 0.75);
    if (w < 0.6 || rho < R - w) continue;
    const rim = rho > R - 1.4, inner = rho < R - w + 1.2, odd = (i + j) & 1;
    if (ph === 0) inner ? put(i, j, cr, cg, cb) : put(i, j, 255, 255, 255);
    else if (ph === 1) rim ? put(i, j, 255, 255, 255) : put(i, j, cr, cg, cb);
    else if (ph === 2) { if (rim) put(i, j, (cr + 255) >> 1, (cg + 255) >> 1, (cb + 255) >> 1); else if (!odd) put(i, j, cr, cg, cb); }
    else if (!odd && (rim || (i & 1))) put(i, j, cr, cg, cb);
  }
  x.putImageData(im, 0, 0);
  qiCache.set(key, c);
  return c;
}
/**
 * Throw off the burst of a blow landing: `wk` the weapon kind, `beat` the blow of the combo,
 * (x, y) the hand (sweeps) or the point (thrusts, staff, book) in iso pixels, `ang` the aim on
 * screen, `side` which way the stroke swept, `size` about the weapon's length, `glow` its rarity ink.
 */
export function qiBurst(wk, beat, x, y, ang, side, size, glow) {
  const fin = beat === 2, col = glow && glow !== "#ffffff" ? glow : QI_COL[wk] || QI_COL.sword;
  const sweep = (R, sq, dur) => fx.add({ k: "qi", s: "cres", x, y: y - 2, ang, side, R: Math.round(R), sq, col, dur, fin });
  const thrust = (L, dur) => fx.add({ k: "qi", s: "thrust", x, y, ang, L, col, dur, fin });
  if (wk === "sword") fin ? sweep(size * 1.3, 1, 240) : sweep(size + 4, 0.62, 190);
  else if (wk === "dagger") beat === 1 ? sweep(size + 3, 0.7, 140) : thrust(size + 8 + (fin ? 6 : 0), 140);
  else if (wk === "spear") beat === 1 ? sweep(size + 2, 0.6, 180) : thrust(size + 14 + (fin ? 10 : 0), 180);
  else if (wk === "staff") fx.add({ k: "qi", s: "star", x, y, ang, R: fin ? 13 : 9, col, dur: 170, fin });
  else fx.add({ k: "qi", s: "rune", x, y, ang, R: fin ? 13 : 9, col, dur: 180, fin });
  if (fin) fx.add({ k: "qi", s: "shock", x: x + Math.cos(ang) * size * 0.8, y: y + Math.sin(ang) * size * 0.5 + 4, ang, R: size, col, dur: 260 });
}
/** Draw one burst of sword-qi at k (0-1 of its life). */
function drawQi(f, k) {
  const ph = k < 0.16 ? 0 : k < 0.42 ? 1 : k < 0.7 ? 2 : 3;
  const px = (x, y, w, c) => { g.fillStyle = c; g.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w); };
  const ux = Math.cos(f.ang), uy = Math.sin(f.ang);
  if (f.s === "cres") {
    const R = Math.round(f.R * (0.9 + 0.18 * Sw.oExpo(k))), img = qiSprite(R, f.ang, f.side, f.sq, ph, f.col);
    g.drawImage(img, Math.round(f.x - R - 1), Math.round(f.y - R - 1));
  } else if (f.s === "thrust") {
    // a streak along the thrust that burns away from the back, and a ring of air punched off its point
    const L = f.L, from = L * Math.min(1, k * 1.3);
    for (let s = Math.floor(from); s <= L; s++) {
      const q = s / L, w = q > 0.9 ? 1 : Math.max(1, Math.round((f.fin ? 5 : 4) * Math.sin(Math.PI * q) * (1 - k * 0.8)));
      if (ph >= 2 && s & 1) continue;
      px(f.x + ux * (s - L * 0.7), f.y + uy * (s - L * 0.7), w, ph === 0 || q > 0.8 ? "#ffffff" : f.col);
    }
    const r = 4 + (f.fin ? 13 : 10) * Sw.oExpo(k), cx = f.x + ux * (L * 0.3 + 4 * k), cy = f.y + uy * (L * 0.3 + 4 * k);
    for (let i = 0; i < 28; i++) {
      if (ph >= 2 && i & 1) continue;
      const a = (i / 28) * 2 * Math.PI, along = Math.cos(a) * r * 0.35, across = Math.sin(a) * r;
      px(cx + ux * along - uy * across, cy + uy * along + ux * across, ph === 0 ? 2 : 1, ph === 0 ? "#ffffff" : f.col);
    }
  } else if (f.s === "star") {
    const n = 8, r0 = 1 + 5 * k, r1 = f.R * (0.5 + 0.7 * Sw.oExpo(k)), w = ph < 2 ? 2 : 1;
    for (let j = 0; j < n; j++) {
      const a = f.ang + (j / n) * 2 * Math.PI, long = j % 2 ? 0.6 : 1;
      for (let r = r0; r <= r1 * long; r += w) px(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.8, w, ph === 0 ? "#ffffff" : f.col);
    }
    if (ph === 0) px(f.x, f.y, 5, "#ffffff");
  } else if (f.s === "rune") {
    const r = f.R * (0.5 + 0.6 * Sw.oExpo(k));
    for (let i = 0; i < 32; i++) { if (ph >= 2 && i & 1) continue; const a = (i / 32) * 2 * Math.PI; px(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.6, 1, ph === 0 ? "#ffffff" : f.col); }
    for (let j = 0; j < 4; j++) { const a = k * 3 + (j / 4) * 2 * Math.PI; px(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.6, ph < 2 ? 3 : 2, ph < 2 ? "#ffffff" : f.col); }
  } else if (f.s === "shock") {
    // the finisher's ring of air lying on the ground where it lands
    const r = f.R * (0.3 + 0.9 * Sw.oExpo(k));
    for (let i = 0; i < 40; i++) { if (ph >= 2 && i % 3 === 0) continue; const a = (i / 40) * 2 * Math.PI; px(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.45, ph < 2 ? 2 : 1, ph === 0 ? "#ffffff" : f.col); }
  }
}

/**
 * Effects. Things flat on the ground (rings, telegraphs, lanes, puddles, cracks,
 * snow) keep world-pixel coordinates and are drawn through the FLAT matrix, so a
 * circle on the ground comes out as a 2:1 ellipse; things in the air (sparks,
 * crescents, shots, beams, bolts) are placed at their projected point and drawn
 * upright in iso pixels.
 */
// ── arrows: a bow's shot in flight (fx.arrow), its faint dotted trail or a piercing streak, the spark
// where it strikes (fx.arrowHit), one left quivering in a wall, and the snap of the string at the
// release (bowSnap, from drawPerson). Every sprite is built pixel by pixel in 64 directions, inked.
const ARROW_STEPS = 64, arrowSprites = new Map(), arrows = new Map();
/** By bow tier (1–5): the trail's dots and the fletching (T4 cyan, T5 violet; else red). */
const ARROW_TRAIL = [null, "#fff4dc", "#fff4dc", "#fff4dc", "#7af4ff", "#d8a8ff"];
const ARROW_FLETCH = [null, "#e04a3c", "#e04a3c", "#e04a3c", "#3ab8d0", "#a05ae0"];
/** The piercing shot's ink: a white-hot arrow outlined in gold (T4 cyan, T5 violet). */
const ARROW_HOT = [null, "#ffc23a", "#ffc23a", "#ffc23a", "#3ad0f0", "#b46aff"];
/** How long a ground direction looks on screen at screen angle `a`, relative to one straight across. */
const isoLen = (a) => 1 / Math.sqrt(2 * Math.sin(a) ** 2 + Math.cos(a) ** 2 / 2) / Math.SQRT2;
/**
 * The arrow sprite for screen angle `ang` (snapped to 64 steps), centred on a 17×17 canvas:
 * a pale shaft, a two-pixel steel head with barbs, fletching at the nock, a dark outline. It is
 * 11 px long flying across the screen and shorter (down to 6) flying toward or away from the eye.
 * `hot`: the piercing shot — white-hot, inked in its tier's colour.
 */
export function arrowSprite(ang, tier = 1, hot = false) {
  const step = ((Math.round((ang / (2 * Math.PI)) * ARROW_STEPS) % ARROW_STEPS) + ARROW_STEPS) % ARROW_STEPS;
  const key = `${step}|${tier}|${hot ? 1 : 0}`;
  let c = arrowSprites.get(key);
  if (c) return c;
  const a = (step / ARROW_STEPS) * 2 * Math.PI, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const N = 17, C = 8, Lr = Math.max(6, Math.round(11 * isoLen(a)));
  const px = new Map(), set = (i, j, col) => { if (i >= 1 && j >= 1 && i < N - 1 && j < N - 1) px.set(j * N + i, col); };
  const at = (d, o = 0) => [Math.round(C + ux * d + nx * o), Math.round(C + uy * d + ny * o)];
  const glowInk = ARROW_HOT[tier] || ARROW_HOT[1];
  const shaft = hot ? "#fff6d8" : "#e8cc94", head = hot ? "#ffffff" : "#e2e8f0", headD = hot ? "#ffffff" : "#9aa2b4", fl = hot ? glowInk : ARROW_FLETCH[tier] || ARROW_FLETCH[1];
  const pts = [];
  for (let q = 0; q <= Lr; q++) { const [i, j] = at(q - Lr / 2); pts.push([i, j]); set(i, j, q >= Lr - 1 ? head : q <= 1 ? fl : shaft); }
  // the head's barbs and the fletching's vanes stand out one pixel either side: square to the shaft
  // when it runs near an axis, else on the two axis neighbours behind the head (a chevron) and ahead of the nock
  const diag = Math.abs(ux) > 0.38 && Math.abs(uy) > 0.38, sx = Math.sign(ux), sy = Math.sign(uy);
  const [hi, hj] = pts[pts.length - 1], [ti, tj] = pts[0];
  if (diag) { set(hi - sx, hj, headD); set(hi, hj - sy, headD); set(ti + sx, tj, fl); set(ti, tj + sy, fl); }
  else for (const o of [-1, 1]) { const [i, j] = at(Lr / 2 - 1, o); set(i, j, headD); const [fi, fj] = at(-Lr / 2 + 0.5, o); set(fi, fj, fl); }
  let x;
  [c, x] = sheet(N, N);
  const ink = hot ? glowInk : INK;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const col = px.get(j * N + i);
    if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
    else if (px.has(j * N + i - 1) && i > 0 || px.has(j * N + i + 1) && i < N - 1 || px.has((j - 1) * N + i) || px.has((j + 1) * N + i)) { x.fillStyle = ink; x.fillRect(i, j, 1, 1); }
  }
  if (arrowSprites.size > 900) arrowSprites.clear();
  arrowSprites.set(key, c);
  return c;
}
/** Where an arrow is at distance d along its flight: [ground x, ground y, screen x, screen y (lifted), screen angle]. */
function arrowAt(f, d) {
  const wx = f.wx + f.ux * d, wy = f.wy + f.uy * d, [x, y] = iso(wx, wy), q = d / f.full;
  // a shallow arc over the whole range: it rises a little and comes down a little at the end
  const arc = Math.min(4, f.full * 0.02), lift = f.h + Math.sin(q * Math.PI) * arc;
  const sx = f.ux - f.uy, sy = (f.ux + f.uy) / 2 - (arc * Math.PI * Math.cos(q * Math.PI)) / f.full;
  return [x, y, x, y - lift, Math.atan2(sy, sx)];
}
/** Draw one arrow in flight at k (0–1 of the flight that is left to it). */
function drawArrow(f, k) {
  const d = f.len * k, [gx, gy, x, y, ang] = arrowAt(f, d), col = (f.pierce ? ARROW_HOT : ARROW_TRAIL)[f.tier] || ARROW_TRAIL[1];
  f.at = [x, y, ang];
  // a one-pixel shadow running along the ground under it
  g.globalAlpha = 0.28; g.fillStyle = "#141832";
  g.fillRect(Math.round(gx - 2), Math.round(gy), 4, 1);
  g.globalAlpha = 1;
  // the trail: dots pinned to the path (they stay where they were left), thinning out behind
  const back = Math.min(d, f.pierce ? 34 : 16);
  for (let u = Math.floor(d) - 2; u > d - back; u--) {
    const far = (d - u) / back, gap = f.pierce ? (far < 0.5 ? 1 : 2) : far < 0.4 ? 2 : 3;
    if (u % gap) continue;
    const [, , tx, ty] = arrowAt(f, u);
    g.fillStyle = f.pierce && far < 0.6 ? "#ffffff" : col;
    g.fillRect(Math.round(tx), Math.round(ty), 1, 1);
    // the piercing streak is two pixels thick near the arrow, its edge in the tier's colour
    if (f.pierce && far < 0.6) { g.fillStyle = col; g.fillRect(Math.round(tx), Math.round(ty) + 1, 1, 1); }
  }
  g.drawImage(arrowSprite(ang, f.tier, f.pierce), Math.round(x) - 8, Math.round(y) - 8);
}
/** An arrow has come to the end of its flight: it strikes, sticks or simply drops out of sight. */
function arrowLanded(f) {
  f.gone = true; f.goneAt = fxNow();
  const [, , x, y, ang] = arrowAt(f, f.len), wx = f.wx + f.ux * f.len, wy = f.wy + f.uy * f.len;
  if (f.end === "stuck") stuckArrow(x, y, ang, f.tier);
  else if (f.end === "hit") fx.arrowHit(wx, wy, Math.atan2(f.uy, f.ux), f.pierce ? ARROW_HOT[f.tier] : "#ffffff", f.pierce, f.h);
}
/** An arrow driven into a wall: its head buried, the shaft quivering a step either way, then gone. */
function stuckArrow(x, y, ang, tier) {
  const L = Math.max(6, Math.round(11 * isoLen(ang)));
  // the head goes in: the sprite drawn back along its own line by a third of its length
  const ox = Math.round(x - Math.cos(ang) * L * 0.3), oy = Math.round(y - Math.sin(ang) * L * 0.3);
  fx.add({ k: "custom", dur: 1100, draw: (c, k) => {
    const wob = k < 0.2 ? (Math.floor(k * 60) % 2 ? 1 : -1) * (2 * Math.PI / ARROW_STEPS) * (1 - k / 0.2) * 1.5 : 0;
    if (k > 0.8 && Math.floor(k * 40) % 2) return;            // blinks out
    c.drawImage(arrowSprite(ang + wob, tier), ox - 8, oy - 8);
  } });
  for (let i = 0; i < 5; i++) parts.push({ x, y, vx: -Math.cos(ang) * (10 + Math.random() * 20) + (Math.random() - 0.5) * 16, vy: -Math.sin(ang) * 10 - 10 - Math.random() * 14, life: 0.22 + Math.random() * 0.12, color: i % 2 ? "#cdbfa6" : "#8a7e70", g: 140, s: 1 });
}
/** The string let go: two short speed lines leaping forward off the riser and a fleck off the string (drawPerson, at the release). */
function bowSnap(x, y, ang, fin, glow) {
  fx.add({ k: "custom", dur: fin ? 150 : 110, draw: (c, k) => {
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, run = (fin ? 9 : 6) * (0.4 + k), len = Math.max(1, Math.round((fin ? 6 : 4) * (1 - k)));
    c.fillStyle = k < 0.35 ? "#ffffff" : glow && glow !== "#ffffff" ? glow : "#fff4dc";
    for (const o of fin ? [-4, 0, 4] : [-3, 3]) for (let i = 0; i < len; i++) c.fillRect(Math.round(x + ux * (run + i) + nx * o), Math.round(y + uy * (run + i) + ny * o), 1, 1);
  } });
}

export const fx = {
  list: [],
  clear() { this.list.length = 0; parts.length = 0; arrows.clear(); },
  add(o) { o.t0 = fxNow() + (o.delay || 0); this.list.push(o); },
  ring(wx, wy, r, color, dur = 300, filled = false, delay = 0) { this.add({ k: "ring", x: wx * P, y: wy * P, r: r * P, color, dur, filled, delay }); },
  tele(wx, wy, r, ms) { this.add({ k: "tele", x: wx * P, y: wy * P, r: r * P, dur: ms }); },
  proj(ax, ay, ah, bx, by, bh, color, size, speed, done) {
    const [x0, y0] = iso(ax, ay), [x1, y1] = iso(bx, by), far = Math.hypot(bx - ax, by - ay) * P;
    this.add({ k: "proj", x0, y0: y0 - ah * 22, x1, y1: y1 - bh * 22, arc: Math.min(16, far * 0.05), color, size: Math.max(2, Math.round(size * 44)), dur: Math.max(70, (far / (speed * 26)) * 1000), done });
  },
  /** An impact: spokes thrown out from a point a little above the ground. */
  spark(wx, wy, color = "#ffffff", size = 1) { const [x, y] = iso(wx, wy); this.add({ k: "spark", x, y: y - 6, color, r: 13 * size, n: size > 1.3 ? 8 : 6, a0: Math.random() * 6.28, dur: 190 }); },
  /** A blade's crescent, centred on the attacker and opening toward `ang` (an angle on the ground). */
  slash(wx, wy, ang, color, size = 0.8, rev = false) { const [x, y] = iso(wx, wy); this.add({ k: "slash", x, y: y - 8, ang: sAng(Math.cos(ang), Math.sin(ang)), color, r: size * 30, rev, dur: 260, delay: 90 }); },
  beam(ax, ay, bx, by, color, h = 0.6) { const [x0, y0] = iso(ax, ay), [x1, y1] = iso(bx, by); this.add({ k: "beam", x0, y0: y0 - h * 22, x1, y1: y1 - h * 22, color, dur: 260 }); },
  pillar(wx, wy) { const [x, y] = iso(wx, wy); this.add({ k: "pillar", x, y, dur: 900 }); this.sparkle(wx, wy, 0.5, "#ffd84a", 24); },
  burst(wx, wy, h, color, n = 8, speed = 1.4) { const [x, y] = iso(wx, wy); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = speed * 34 * (0.3 + Math.random() * 0.7); parts.push({ x, y: y - h * 22, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 30, life: 0.25 + Math.random() * 0.3, color, g: 220 }); } },
  sparkle(wx, wy, h, color, n = 10) { const [x, y] = iso(wx, wy); for (let i = 0; i < n; i++) parts.push({ x: x + Math.random() * 28 - 14, y: y - h * 22 + Math.random() * 18 - 6, vx: 0, vy: -26 - Math.random() * 34, life: 0.4 + Math.random() * 0.5, color, g: 0 }); },
  /** A skill's core flash: a white-hot disc for the first frame or two, a yellow one shrinking after (60 ms). */
  flash(wx, wy, r = 14, delay = 0, h = 0.35) { const [x, y] = iso(wx, wy); this.add({ k: "flash", x, y: y - h * 22, r, dur: 64, delay }); },
  /** A shockwave: a thin bright ring racing out flat over the ground to radius r, a fainter one behind it. */
  wave(wx, wy, r, color = "#ffffff", dur = 340, delay = 0) { this.add({ k: "wave", x: wx * P, y: wy * P, r: r * P, color, dur, delay }); },
  /** A pillar of lightning striking (wx, wy) out of the sky, re-forked every frame. */
  zap(wx, wy, color = "#bfe8ff", dur = 240, delay = 0) { const [x, y] = iso(wx, wy); this.add({ k: "zap", x, y, color, dur, delay }); this.flash(wx, wy, 16, delay, 0.1); this.wave(wx, wy, 26, color, 300, delay); },
  /** A marked line something is about to run down, from a to b; it fills as the moment (`ms`) nears. */
  lane(ax, ay, bx, by, ms, color = "#ff5a6a", width = 13) { this.add({ k: "lane", x0: ax * P, y0: ay * P, x1: bx * P, y1: by * P, w: width * P, color, dur: ms }); },
  /** A puddle on the ground: appears after `delay` ms and lies there for `ms`. */
  pool(wx, wy, r, ms, color = POOL_COL[0], delay = 0) { this.add({ k: "pool", x: wx * P, y: wy * P, r: r * P, color, dur: ms, delay, seed: Math.random() * 6.28 }); },
  /** Something lobbed from a to b: it arcs over for `ms`, with its landing spot marked meanwhile. */
  lob(ax, ay, bx, by, ms, color = "#ff8a5a", r = 13) {
    this.add({ k: "mark", x: bx * P, y: by * P, r: r * P, color, dur: ms });
    const [x0, y0] = iso(ax, ay), [x1, y1] = iso(bx, by);
    this.add({ k: "lob", x0, y0: y0 - 10, x1, y1, color, dur: ms });
  },
  /** A spread of shots from one point to several (`pts` is [[x, y], …]), all landing after `ms`. */
  volley(ax, ay, pts, ms, color = "#ff8a5a") { for (const [bx, by] of pts) this.lob(ax, ay, bx, by, ms, color); },
  /** A monster spitting a puddle: the gob flies for `fly` ms, then the puddle lies for `life` ms. `kind`: 0 poison, 1 fire, 2 blood. */
  spit(ax, ay, bx, by, r, fly, life, kind = 0) { const c = POOL_COL[kind] || POOL_COL[0]; this.lob(ax, ay, bx, by, fly, c, r); this.pool(bx, by, r, life, c, fly); },
  /** A small hit on the ground where a shot lands: no shake, no noise. */
  pop(wx, wy, r = 13, color = "#ff8a5a") { this.ring(wx, wy, r, color, 220, true); this.burst(wx, wy, 0.1, color, 6, 1.2); },
  // ── for the second-tier skills and the ultimates
  /** Blades whirling round a point: `n` short arcs sweeping a ring of radius `r` (an ellipse on the ground). */
  storm(wx, wy, r, color = "#d8e8ff", dur = 420, n = 5) { const [x, y] = iso(wx, wy); this.add({ k: "storm", x, y: y - 6, r: r * Math.SQRT2 * K, color, dur, n, a0: Math.random() * 6.28 }); },
  /** The ground split open: jagged cracks running out from a point, flat on the ground. */
  crack(wx, wy, r, color = "#ffb04a", dur = 700, scar = false) {
    const rays = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28 + Math.random() * 0.4, pts = [[0, 0]]; let d = 0; while (d < 1) { d += 0.18 + Math.random() * 0.12; pts.push([Math.cos(a) * d + (Math.random() - 0.5) * 0.12, Math.sin(a) * d + (Math.random() - 0.5) * 0.12]); } rays.push(pts); }
    this.add({ k: "crack", x: wx * P, y: wy * P, r: r * P, color, dur, rays, scar });
  },
  /** A jagged bolt of lightning from a to b, redrawn a little differently each frame. */
  bolt(ax, ay, bx, by, color = "#9fdcff", dur = 240) { const [x0, y0] = iso(ax, ay), [x1, y1] = iso(bx, by); this.add({ k: "bolt", x0, y0: y0 - 14, x1, y1: y1 - 14, color, dur }); },
  /** Something huge coming straight down out of the sky onto (wx, wy), landing at `ms`. */
  fall(wx, wy, color = "#ffd84a", ms = 450) { const [x, y] = iso(wx, wy); this.add({ k: "fall", x, y, color, dur: ms + 260, land: ms / (ms + 260) }); },
  /** Snow driven across a round patch of ground for `ms`. */
  snow(wx, wy, r, ms = 3600) { this.add({ k: "snow", x: wx * P, y: wy * P, r: r * P, dur: ms }); },
  // ── the bow's arrows (server units throughout; skillfx.js turns the wire's "ar"/"ae" into these)
  /**
   * An arrow loosed at (ax, ay) toward (bx, by): it flies the whole way unless arrowEnd cuts it short.
   * `o`: spd units/s (420) · h height above the ground in px (9) · delay ms it waits on the string
   * (the stroke's release, impactMs("bow", beat), minus what has passed) — it flies a little faster
   * to land when an undelayed one would · tier 1–5 (trail: T4 cyan, T5 violet) · pierce (the
   * piercing streak, white-hot) · id (for arrowEnd) · end "fade" | "hit" | "stuck" (how it ends if it
   * flies the whole way; default fade) · done(). Returns the effect.
   */
  arrow(ax, ay, bx, by, o = {}) {
    const far = Math.hypot(bx - ax, by - ay) || 1, spd = o.spd || 420, flight = (far / spd) * 1000, delay = Math.max(0, o.delay || 0);
    const v = far / Math.max(flight * 0.5, flight - delay);   // units per ms, caught up
    const now = fxNow();
    for (const [id, a] of arrows) if (a.gone && now - a.goneAt > 1500) arrows.delete(id);
    const f = { k: "arrow", wx: ax, wy: ay, ux: (bx - ax) / far, uy: (by - ay) / far, len: far, full: far, v, h: o.h ?? 9, tier: Math.max(1, Math.min(5, o.tier | 0 || 1)), pierce: !!o.pierce, end: o.end || "fade", delay, dur: far / v };
    f.done = () => { arrowLanded(f); if (o.done) o.done(); };
    if (o.id !== undefined) arrows.set(o.id, f);
    this.add(f);
    return f;
  },
  /**
   * The server says arrow `id` ended at (wx, wy): `how` "hit" (a spark), "stuck" (left in a wall) or
   * "fade" (ran out of range). An arrow still in flight is cut short there (it lands when it gets
   * there); one already gone — or never seen — just ends there now.
   */
  arrowEnd(id, wx, wy, how = "hit") {
    const f = arrows.get(id);
    if (f && !f.gone) {
      f.len = Math.min(f.len, Math.max(0, (wx - f.wx) * f.ux + (wy - f.wy) * f.uy));
      f.dur = Math.max(1, f.len / f.v); f.end = how;
      return;
    }
    const ang = f ? Math.atan2(f.uy, f.ux) : 0, tier = f ? f.tier : 1, h = f ? f.h : 9;
    if (how === "stuck" && f) { const [x, y] = iso(wx, wy); stuckArrow(x, y - h, sAng(f.ux, f.uy), tier); }
    else if (how === "hit") this.arrowHit(wx, wy, ang, "#ffffff", false, h);
  },
  /** Where an arrow strikes: a white-hot pixel core and short spokes thrown on along its flight (`ang` on the ground). */
  arrowHit(wx, wy, ang = 0, color = "#ffffff", big = false, h = 9) {
    const [x, y] = iso(wx, wy);
    this.add({ k: "ahit", x, y: y - h, ang: sAng(Math.cos(ang), Math.sin(ang)), color, big, dur: big ? 200 : 150 });
  },
};
/**
 * The skills' effects, scaled up (skillfx.js and growth.js draw through this): bursts and sparkles
 * 1.8× as dense and 1.35× as fast, sparks and slashes 1.5×, decorative rings 1.5× (a filled ring
 * marks the real reach of a blast, so it keeps its size and gets a shockwave racing out to 1.6×
 * past it instead), cracks 1.5× over a dark scar that lingers, a white-hot core flash wherever a
 * blast, a spark or a falling thing lands (once per spot), a lightning pillar at the end of every
 * bolt, and a shake that is stronger and, given `ang` (the skill's aim on the ground), directional.
 */
export function big(ang) {
  const F = fx, flashed = new Set();
  const flash = (wx, wy, r, delay = 0) => { const key = `${Math.round(wx / 8)},${Math.round(wy / 8)},${delay}`; if (!flashed.has(key)) { flashed.add(key); F.flash(wx, wy, r, delay); } };
  const W = Object.create(F);
  W.ring = (wx, wy, r, color, dur = 300, filled = false, delay = 0) => {
    if (!filled) return F.ring(wx, wy, r * 1.5, color, dur * 1.15, false, delay);
    F.ring(wx, wy, r, color, dur * 1.15, true, delay);
    F.wave(wx, wy, r * 1.6, color, dur + 80, delay);
    flash(wx, wy, Math.min(26, 8 + r * 0.22), delay);
  };
  W.burst = (wx, wy, h, color, n = 8, speed = 1.4) => F.burst(wx, wy, h, color, Math.round(n * 1.8), speed * 1.35);
  W.sparkle = (wx, wy, h, color, n = 10) => F.sparkle(wx, wy, h, color, Math.round(n * 1.8));
  W.spark = (wx, wy, color, size = 1) => { F.spark(wx, wy, color, size * 1.5); flash(wx, wy, 7 + size * 5); };
  W.storm = (wx, wy, r, color, dur = 420, n = 5) => F.storm(wx, wy, r * 1.15, color, dur * 1.1, n + 2);
  W.slash = (wx, wy, a, color, size = 0.8, rev = false) => F.slash(wx, wy, a, color, size * 1.5, rev);
  W.crack = (wx, wy, r, color = "#ffb04a", dur = 700) => {
    F.crack(wx, wy, r * 1.3, "#2b2233", dur + 1100, true);   // the scar it leaves, under the glow
    F.crack(wx, wy, r * 1.5, color, dur);
    F.wave(wx, wy, r * 2.2, "#ffffff", 300);
    F.wave(wx, wy, r * 1.5, color, 380, 60);
  };
  W.bolt = (ax, ay, bx, by, color = "#9fdcff", dur = 240) => { F.bolt(ax, ay, bx, by, color, dur); F.zap(bx, by, color, dur); };
  W.fall = (wx, wy, color = "#ffd84a", ms = 450) => { F.fall(wx, wy, color, ms); flash(wx, wy, 20, ms); F.wave(wx, wy, 44, color, 360, ms); };
  return { fx: W, shake: (n, a = ang) => shake(n * 1.3, a), big };
}
/**
 * Shake the view. With no direction: a short sharp jitter of about ±n/2 px (a plain hit: 2–3).
 * With `ang` (a direction on the ground, radians): a kick of n px along it that swings back and
 * forth and dies in about a tenth of a second — crits and the big skills, along the blow.
 */
export function shake(n, ang) {
  if (ang === undefined || !isFinite(ang)) { shakeAmt = Math.max(shakeAmt, n); return; }
  if (n < kick.amt) return;
  const sx = Math.cos(ang) - Math.sin(ang), sy = (Math.cos(ang) + Math.sin(ang)) / 2, l = Math.hypot(sx, sy) || 1;
  kick.x = sx / l; kick.y = sy / l; kick.amt = n; kick.t0 = fxNow();
  shakeAmt = Math.max(shakeAmt, n * 0.25);
}
const kick = { x: 0, y: 0, amt: 0, t0: 0 };

// ───────────────────────────── pets ─────────────────────────────
// A pet trots a little behind its owner, on the side away from where they face,
// and darts out to whatever it fetches (메이플 펫처럼 따라다니며 줍는다).
const pets = new Map();
/** The pet of `eid` runs to (wx, wy) and back: called when the server says it picked something up. */
export function petFetch(eid, wx, wy) {
  const pt = pets.get(eid);
  if (pt) { pt.go = { x: wx, y: wy, t0: performance.now() }; }
  fx.sparkle(wx, wy, 0.3, "#fff0a0", 6);
}
function petsNow(dt, t) {
  const out = [];
  const owners = [[G.you, G.me]];
  for (const [eid, p] of G.players) owners.push([eid, p]);
  const live = new Set();
  for (const [eid, p] of owners) {
    const w = G.who.get(eid);
    if (!w || !w.pet || p.dead) continue;
    live.add(eid);
    let pt = pets.get(eid);
    const face = p.dir === 1 ? -1 : p.dir === 2 ? 1 : 0, back = p.dir === 3 ? 1 : p.dir === 0 ? -1 : 0;
    const hx = p.x - face * 13 + (face ? 0 : 10), hy = p.y + 2 - back * 8;
    if (!pt || pt.kind !== w.pet) { pt = { kind: w.pet, x: hx, y: hy, face: 1, px: hx, id: eid }; pets.set(eid, pt); }
    let tx = hx, ty = hy, k = 4;
    if (pt.go) {
      const a = (t - pt.go.t0) / 1000;
      if (a < 0.16) { tx = pt.go.x; ty = pt.go.y; k = 18; } else if (a > 0.5) pt.go = null;
    }
    pt.x += (tx - pt.x) * Math.min(1, dt * k);
    pt.y += (ty - pt.y) * Math.min(1, dt * k);
    const sdx = (pt.x - pt.px) - (pt.y - (pt.py ?? pt.y));
    if (sdx > 0.05) pt.face = 1; else if (sdx < -0.05) pt.face = -1;
    pt.moving = Math.abs(pt.x - pt.px) + Math.abs(pt.y - pt.py || 0) > 0.03;
    pt.px = pt.x; pt.py = pt.y;
    out.push(pt);
  }
  for (const id of pets.keys()) if (!live.has(id)) pets.delete(id);
  return out;
}
function drawPet(pt, t) {
  const frames = SP.petSheet(pt.kind), hover = SP.PET_HOVER[pt.kind] || 0;
  const [ix, iy] = iso(pt.x, pt.y), x = Math.round(ix), y = Math.round(iy);
  // walkers hop when they move, flyers flap and bob all the time
  const fr = hover ? Math.floor(t / 140 + pt.id) % 2 : pt.moving ? Math.floor(t / 120) % 2 : Math.floor(t / 900) % 6 === 0 ? 1 : 0;
  const lift = hover ? hover + Math.round(Math.sin(t / 260 + pt.id) * 2) : 0;
  g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(x, y, hover ? 5 : 6, 2, 0, 0, 7); g.fill();
  if (pt.kind === "pet_wisp") { g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.35; g.drawImage(DC.glow("#5ad0ff", 20), x - 20, y - lift - 30); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; if (Math.random() < 0.15) parts.push({ x: x - 3 + Math.random() * 6, y: y - lift - 16, vx: 0, vy: -16, life: 0.5, color: "#bfeaff", g: 0, s: 1 }); }
  g.save();
  g.translate(x, y - lift);
  g.scale(pt.face, 1);
  g.drawImage(frames[fr], -SP.FOOT[0], -SP.FOOT[1]);
  g.restore();
}

function drawFx(now, ground2) {
  for (let i = fx.list.length - 1; i >= 0; i--) {
    const f = fx.list[i], k = (now - f.t0) / f.dur;
    if (k < 0) continue;
    if (k >= 1) { fx.list.splice(i, 1); if (f.done) f.done(); continue; }
    const flat = f.k === "ring" || f.k === "wave" || f.k === "tele" || f.k === "lane" || f.k === "pool" || f.k === "mark" || f.k === "crack" || f.k === "snow" || (f.k === "custom" && f.flat);
    if (flat !== ground2) continue;
    if (f.k === "custom") { g.save(); f.draw(g, k, f); g.restore(); continue; }
    if (f.k === "qi") { g.globalAlpha = 1; drawQi(f, k); continue; }
    if (f.k === "arrow") { g.globalAlpha = 1; drawArrow(f, k); continue; }
    if (f.k === "ahit") {
      // pixel spokes thrown on along the flight (a cone of five, one kicked back), a white core for the first frames
      g.globalAlpha = 1;
      const R = f.big ? 11 : 7, n = f.big ? 7 : 5;
      g.fillStyle = k < 0.3 ? "#ffffff" : f.color;
      for (let j = 0; j <= n; j++) {
        const a = j === n ? f.ang + Math.PI : f.ang + (j / (n - 1) - 0.5) * 2.2, r0 = R * (0.2 + 0.7 * k), r1 = R * (0.5 + 0.6 * k) * (j === n ? 0.5 : 1);
        for (let r = r0; r <= r1; r += 1.5) g.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r * 0.75), 1, 1);
      }
      if (k < 0.3) { const c = f.big ? 2 : 1; g.fillStyle = "#ffffff"; g.fillRect(Math.round(f.x) - c, Math.round(f.y) - c, c * 2 + 1, c * 2 + 1); }
      continue;
    }
    if (f.k === "flash") {
      // pixel rows, no smoothing: white-hot with a yellow rim, then a smaller yellow core
      const hot = k < 0.5, rx = Math.round(f.r * (hot ? 1 : 0.6)), ry = Math.max(1, Math.round(rx * 0.75));
      g.globalAlpha = 1;
      for (let dy = -ry; dy <= ry; dy++) {
        const w = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
        g.fillStyle = hot ? "#fff6b0" : "#ffd84a"; g.fillRect(Math.round(f.x) - w, Math.round(f.y) + dy, w * 2 + 1, 1);
        if (hot && w > 2) { g.fillStyle = "#ffffff"; g.fillRect(Math.round(f.x) - w + 2, Math.round(f.y) + dy, w * 2 - 3, 1); }
      }
      continue;
    }
    if (f.k === "zap") {
      // a jagged column from high above down to the ground, forked anew each frame, a branch now and then
      const top = f.y - 150, n = 12, pts = [];
      for (let q = 0; q <= n; q++) pts.push([f.x + (q === 0 || q === n ? 0 : (Math.random() - 0.5) * 14), top + ((f.y - top) * q) / n]);
      g.globalAlpha = k < 0.6 ? 1 : (1 - k) / 0.4;
      for (const [col, w] of [[f.color, 6], ["#ffffff", 2]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (const [x, y] of pts) g.lineTo(x, y); g.stroke(); }
      if (Math.random() < 0.5) { const [bx, by] = pts[4 + ((Math.random() * 5) | 0)]; g.strokeStyle = f.color; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (Math.random() - 0.5) * 30, by + 10 + Math.random() * 14); g.stroke(); }
      g.globalAlpha = 1; g.lineWidth = 1;
      continue;
    }
    if (f.k === "ring") {
      g.globalAlpha = 1 - k;
      if (f.filled) { g.fillStyle = f.color; g.globalAlpha = (1 - k) * 0.35; g.beginPath(); g.arc(f.x, f.y, f.r * k, 0, 7); g.fill(); g.globalAlpha = 1 - k; }
      g.strokeStyle = f.color; g.lineWidth = 5;
      g.beginPath(); g.arc(f.x, f.y, f.r * k, 0, 7); g.stroke();
    } else if (f.k === "wave") {
      const u = Sw.oExpo(k);
      g.strokeStyle = f.color; g.globalAlpha = 1 - k; g.lineWidth = 3;
      g.beginPath(); g.arc(f.x, f.y, f.r * (0.15 + 0.85 * u), 0, 7); g.stroke();
      g.globalAlpha = (1 - k) * 0.5; g.lineWidth = 2;
      g.beginPath(); g.arc(f.x, f.y, f.r * (0.1 + 0.68 * u), 0, 7); g.stroke();
    } else if (f.k === "tele") {
      g.fillStyle = `rgba(255,60,120,${0.16 + 0.16 * Math.abs(Math.sin(now / 70))})`;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill();
      g.strokeStyle = "#ff6ad0"; g.lineWidth = 4;
      g.beginPath(); g.arc(f.x, f.y, f.r * k, 0, 7); g.stroke();
    } else if (f.k === "lane") {
      // a band along the ground, pulsing, with a brighter part that runs out to the far end as time runs out
      const dx = f.x1 - f.x0, dy = f.y1 - f.y0, len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * f.w / 2, ny = (dx / len) * f.w / 2;
      const quad = (t) => { g.beginPath(); g.moveTo(f.x0 + nx, f.y0 + ny); g.lineTo(f.x0 + dx * t + nx, f.y0 + dy * t + ny); g.lineTo(f.x0 + dx * t - nx, f.y0 + dy * t - ny); g.lineTo(f.x0 - nx, f.y0 - ny); g.closePath(); };
      g.fillStyle = f.color;
      g.globalAlpha = 0.16 + 0.12 * Math.abs(Math.sin(now / 70)); quad(1); g.fill();
      g.globalAlpha = 0.42; quad(k); g.fill();
      g.globalAlpha = 0.9; g.strokeStyle = f.color; g.lineWidth = 2; quad(1); g.stroke();
    } else if (f.k === "pool") {
      // a lumpy puddle that seeps in, lies, and dries out
      const a = k < 0.06 ? k / 0.06 : k > 0.85 ? (1 - k) / 0.15 : 1;
      g.fillStyle = f.color;
      g.globalAlpha = 0.46 * a;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill();
      for (let j = 0; j < 5; j++) { const an = f.seed + j * 1.257, rr = f.r * 0.8; g.beginPath(); g.ellipse(f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr, f.r * 0.3, f.r * 0.26, an, 0, 7); g.fill(); }
      g.globalAlpha = 0.85 * a; g.strokeStyle = f.color; g.lineWidth = 2;
      const pr = f.r * (0.5 + 0.12 * Math.sin(now / 300 + f.seed));
      g.beginPath(); g.arc(f.x, f.y, pr, 0, 7); g.stroke();
      if (Math.random() < 0.12) { const [px2, py2] = sqI(f.x + (Math.random() - 0.5) * f.r * 1.4, f.y + (Math.random() - 0.5) * f.r * 1.4); parts.push({ x: px2, y: py2, vx: 0, vy: -14, life: 0.5, color: f.color, g: 0, s: 2 }); }
    } else if (f.k === "mark") {
      // where a lobbed shot will land: a ring that fills in as it comes down
      g.strokeStyle = f.color; g.lineWidth = 2; g.globalAlpha = 0.9;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.stroke();
      g.fillStyle = f.color; g.globalAlpha = 0.14 + 0.3 * k;
      g.beginPath(); g.arc(f.x, f.y, f.r * k, 0, 7); g.fill();
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
      const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * (f.arc || 0);
      g.fillStyle = f.color; g.fillRect(Math.round(x - f.size / 2), Math.round(y - f.size / 2), f.size, f.size);
      g.fillStyle = "#ffffff"; g.fillRect(Math.round(x - f.size / 4), Math.round(y - f.size / 4), Math.ceil(f.size / 2), Math.ceil(f.size / 2));
      if (Math.random() < 0.7) parts.push({ x, y, vx: 0, vy: 0, life: 0.18, color: f.color, g: 0 });
    } else if (f.k === "lob") {
      // a gob in the air: straight along the ground, up and over in an arc
      const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 28;
      g.fillStyle = "#2b2233"; g.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
      g.fillStyle = f.color; g.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
      g.fillStyle = "#ffffff"; g.fillRect(Math.round(x - 1), Math.round(y - 2), 2, 2);
      if (Math.random() < 0.5) parts.push({ x, y, vx: 0, vy: 0, life: 0.16, color: f.color, g: 0 });
    } else if (f.k === "beam") {
      g.globalAlpha = 1 - k; g.strokeStyle = f.color; g.lineWidth = 6; g.beginPath(); g.moveTo(f.x0, f.y0); g.lineTo(f.x1, f.y1); g.stroke();
      g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.beginPath(); g.moveTo(f.x0, f.y0); g.lineTo(f.x1, f.y1); g.stroke();
    } else if (f.k === "pillar") {
      g.globalAlpha = (1 - k) * 0.6; g.fillStyle = "#fff0a0"; g.fillRect(f.x - 14, f.y - 120, 28, 124); g.fillStyle = "#ffffff"; g.fillRect(f.x - 6, f.y - 120, 12, 124);
    } else if (f.k === "storm") {
      // short tapered arcs chasing each other round, fast at first and easing off
      const spin = f.a0 + (1 - (1 - k) * (1 - k)) * 7.5, n = 9;
      g.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      for (let j = 0; j < f.n; j++) {
        const a0 = spin + (j / f.n) * 6.28;
        for (const [col, rr, w] of [[f.color, f.r, 4], ["#ffffff", f.r - 1, 2]]) {
          g.strokeStyle = col; g.lineWidth = w;
          g.beginPath();
          for (let q = 0; q <= n; q++) { const a = a0 + (q / n) * 0.9; g.lineTo(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.5); }
          g.stroke();
        }
      }
      if (Math.random() < 0.6) { const a = Math.random() * 6.28; parts.push({ x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r * 0.5, vx: -Math.sin(a) * 60, vy: Math.cos(a) * 30 - 10, life: 0.25, color: f.color, g: 0, s: 2 }); }
    } else if (f.k === "crack") {
      // cracks run out in the first fifth, glow, then darken and fade
      const run = Math.min(1, k * 5), a = k < 0.6 ? 1 : (1 - k) / 0.4;
      if (f.scar) {
        // the scar a slam leaves: thin dark fissures, already there, fading slowly
        g.globalAlpha = 0.5 * Math.min(1, (1 - k) / 0.5); g.strokeStyle = f.color; g.lineWidth = 3;
        for (const pts of f.rays) { g.beginPath(); for (const [px2, py2] of pts) g.lineTo(f.x + px2 * f.r, f.y + py2 * f.r); g.stroke(); }
        g.globalAlpha = 1; g.lineWidth = 1;
        continue;
      }
      for (const pts of f.rays) {
        const m = Math.max(1, Math.ceil(pts.length * run));
        for (const [col, w] of [["#2b2233", 8], [k < 0.35 ? "#fff0b0" : f.color, 3.5]]) {
          g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w;
          g.beginPath();
          for (let q = 0; q < m; q++) g.lineTo(f.x + pts[q][0] * f.r, f.y + pts[q][1] * f.r);
          g.stroke();
        }
      }
    } else if (f.k === "bolt") {
      // a fresh zig-zag every frame between the two ends, a bright core inside a coloured glow
      const dx = f.x1 - f.x0, dy = f.y1 - f.y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, segs = Math.max(3, Math.round(len / 14));
      const pts = [[f.x0, f.y0]];
      for (let q = 1; q < segs; q++) { const o = (Math.random() - 0.5) * 18; pts.push([f.x0 + (dx * q) / segs + nx * o, f.y0 + (dy * q) / segs + ny * o]); }
      pts.push([f.x1, f.y1]);
      g.globalAlpha = k < 0.5 ? 1 : 2 - 2 * k;
      for (const [col, w] of [[f.color, 6], ["#ffffff", 2]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (const [x, y] of pts) g.lineTo(x, y); g.stroke(); }
    } else if (f.k === "fall") {
      // a shaft of light dropping onto its mark, then a flash where it lands
      if (k < f.land) {
        const q = k / f.land, top = f.y - 220 + q * 200;
        g.fillStyle = f.color; g.globalAlpha = 0.35 + q * 0.4; g.fillRect(f.x - 9, top - 60, 18, 60);
        g.fillStyle = "#ffffff"; g.globalAlpha = 0.9; g.fillRect(f.x - 3, top - 70, 6, 72);
        g.fillStyle = f.color; g.fillRect(f.x - 7, top, 14, 6); g.fillRect(f.x - 4, top + 6, 8, 5); g.fillRect(f.x - 1, top + 11, 2, 4);
      } else {
        const q = (k - f.land) / (1 - f.land);
        g.globalAlpha = 1 - q; g.fillStyle = "#ffffff"; g.fillRect(f.x - 16 * (1 - q), f.y - 140, 32 * (1 - q), 140);
        g.fillStyle = f.color; g.fillRect(f.x - 26 * (1 - q) - 2, f.y - 6, 52 * (1 - q) + 4, 6);
      }
    } else if (f.k === "snow") {
      // flakes blown slantwise over the patch, a pale wash under them
      const a = k < 0.08 ? k / 0.08 : k > 0.9 ? (1 - k) / 0.1 : 1;
      g.globalAlpha = 0.24 * a; g.fillStyle = "#cfeaff";
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill();
      // a pale rim turning slowly, so the patch reads as one storm
      g.globalAlpha = 0.7 * a; g.strokeStyle = "#ffffff"; g.lineWidth = 4;
      for (let j = 0; j < 4; j++) { const a0 = now / 500 + j * 1.57; g.beginPath(); g.arc(f.x, f.y, f.r, a0, a0 + 0.8); g.stroke(); }
      g.globalAlpha = a;
      for (let q = 0; q < 7; q++) if (Math.random() < 0.9) { const ang = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * f.r, [sx2, sy2] = sqI(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr); parts.push({ x: sx2 - 20, y: sy2 - 46, vx: 70 + Math.random() * 30, vy: 60 + Math.random() * 30, life: 0.6, color: Math.random() < 0.6 ? "#ffffff" : "#bfe6ff", g: 0, s: Math.random() < 0.3 ? 3 : 2 }); }
    }
    g.globalAlpha = 1; g.lineWidth = 1;
  }
}

// ───────────────────────────── the frame ─────────────────────────────

/** Townsfolk who come out only at night (the storyteller) are about only after dark. */
export const npcOut = (n) => !n.night || (map && OUTDOOR.has(theme) && Sky.nightK() > 0.5);
/** A song on the lute (strummed, notes rising) or a cup raised to the fire, over a seated figure. */
function drawJam(j, s, t, x, y) {
  const k = (t - j.t0) / 2600, face = s.face || 1;
  if (j.k === 0) {
    const strum = Math.floor(t / 120) % 2;
    g.save(); g.translate(Math.round(x + face * 1), Math.round(y - 8 + strum * 0)); g.scale(face, 1);
    g.drawImage(Camp.lute(), -6, -4); g.restore();
    if (strum && Math.random() < 0.25) parts.push({ x: x + face * 4, y: y - 14, vx: face * 6, vy: -20, life: 1.1, color: ["#ffe08a", "#ffb8e0", "#b8e8ff"][Math.floor(Math.random() * 3)], g: 0, s: 2 });
  } else {
    const lift = k < 0.25 ? k / 0.25 : k > 0.8 ? (1 - k) / 0.2 : 1, cx = x + face * 6, cy = y - 10 - lift * 8;
    g.drawImage(Camp.cup(), Math.round(cx - 3), Math.round(cy - 3));
    if (Math.random() < 0.15) parts.push({ x: cx, y: cy - 4, vx: 0, vy: -10, life: 0.8, color: "#f4f0f8", g: 0, s: 1 });
    if (k > 0.3 && k < 0.36) parts.push({ x: cx, y: cy - 6, vx: 0, vy: -26, life: 0.4, color: "#fff4b0", g: 0, s: 2 });
  }
}
/** The stump someone sits on, if they sit on one: the camp it belongs to. */
function seatOf(e) {
  if (!e.sit) return null;
  for (const c of camps) for (const [sx, sy] of c.seats) if (Math.abs(e.x - sx) < 2 && Math.abs(e.y - sy) < 2) return c;
  return null;
}

/** The worlds under the open sky, where day turns to night. */
const OUTDOOR = new Set(["town", "meadow", "forest", "city", "autumn"]);
/** A waypoint's rune: lit and breathing once touched, dark until then. */
function drawRune(st, dx, dy, t) {
  if (!wpLit()) return;
  const D = DC.sprites(), k = 0.5 + 0.5 * Math.sin(t / 520 + st.ph);
  g.fillStyle = k > 0.7 ? "#e8fbff" : "#7ae0ff";
  for (const [x, y] of D.RUNE) g.fillRect(dx + 2 + x, dy + 2 + y, 1, 1);
  g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.25 + k * 0.3;
  g.drawImage(DC.glow("#5ad0ff", 26), dx + 11 - 26, dy + 18 - 26);
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  if (Math.random() < 0.06) parts.push({ x: st.x - 5 + Math.random() * 10, y: st.y - 20 - Math.random() * 16, vx: (Math.random() - 0.5) * 4, vy: -14, life: 1.1, color: Math.random() < 0.5 ? "#9af0ff" : "#ffffff", g: 0, s: 1 });
}
/**
 * What gives light after dark, on screen: pools on the ground under lamps, in front of lit
 * windows, around runes, landmarks, gates and the spirit tree, and the warm round of every fire.
 */
function skyLights(t, ox, oy) {
  const out = [];
  for (const st of lights) {
    const sx = st.x - ox, sy = st.y - oy;
    if (sx < -200 || sx > vw + 200 || sy < -60 || sy > vh + 300) continue;
    if (st.house) {
      const f = 0.85 + 0.15 * Math.sin(t / 300 + st.ph * 4);
      out.push({ x: sx - 24, y: sy - 4, r: 34, col: "#ffb860", k: 0.75 * f, bloom: 14, by: sy - 34 }, { x: sx + 22, y: sy - 6, r: 30, col: "#ffb860", k: 0.65 * f, bloom: 12, by: sy - 36 });
    } else if (st.spirit) {
      const b = 0.85 + 0.15 * Math.sin(t / 1300);
      out.push({ x: sx, y: sy - 6, r: 104, col: "#4aa8ff", k: 0.85 * b, flat: 1.8 }, { x: sx, y: sy - 70, r: 64, col: "#3a78d8", k: 0.5 * b, flat: 1.3, bloom: 52, by: sy - 76 });
    } else if (st.wp) out.push({ x: sx, y: sy - 4, r: 40, col: "#7ae0ff", k: wpLit() ? 0.9 : 0.35, bloom: 12, by: sy - 22 });
    else if (st.land) out.push({ x: sx, y: sy - 10, r: 70, col: st.glow || "#ffe690", k: 0.7, flat: 1.7 });
    else if (st.neon) out.push({ x: sx, y: sy - 10, r: 64, col: st.neon, k: 0.75 });
    else if (st.glow === "#ffe690") out.push({ x: sx, y: sy - 2, r: 46, col: "#ffd890", k: 0.8, bloom: 14, by: sy - st.sp.height + 10 });
    else if (st.nightGlow) out.push({ x: sx, y: sy - 4, r: 34, col: st.nightGlow, k: 0.7, bloom: 10, by: sy - 30 });
    else if (st.glow) out.push({ x: sx, y: sy - 6, r: 40, col: st.glow, k: 0.7, bloom: 10, by: sy - st.sp.height + 10 });
  }
  for (const f of G.fires ? G.fires.values() : []) {
    const [X, Y] = iso(f.x, f.y), k = 0.9 + 0.1 * Math.sin(t / 70 + f.id) * Math.sin(t / 130);
    out.push({ x: X - ox, y: Y - oy, r: 108, col: "#e85a10", k }, { x: X - ox, y: Y - oy - 2, r: 56, col: "#ff9a40", k: k * 0.9, bloom: 26, by: Y - oy - 14 });
  }
  for (const p of map.portals) { const [px, py] = tI(p.x + 0.5, p.y + 0.5); out.push({ x: px - ox, y: py - oy, r: 48, col: "#c8a0ff", k: 0.7 }); }
  // your own feet keep a faint halo, so you never lose yourself in the dark
  if (G.me) { const [mx, my] = iso(G.me.x, G.me.y); out.push({ x: mx - ox, y: my - oy - 4, r: 30, col: "#8a96c8", k: 0.4 }); }
  return out;
}

/** What shines by its own light at night is laid on again over the grade: the spirit tree's crown, the flames. */
function glowAfterDark(n, t, ox, oy) {
  g.save();
  g.setTransform(1, 0, 0, 1, -ox, -oy);
  g.globalCompositeOperation = "screen";
  for (const st of lights) {
    if (!st.spirit || st.dx - ox > vw || st.dx + st.sp.width - ox < 0) continue;
    g.globalAlpha = n * (0.42 + 0.08 * Math.sin(t / 1300));
    g.drawImage(st.sp, st.dx, st.dy);
  }
  for (const f of G.fires ? G.fires.values() : []) {
    const [X, Y] = iso(f.x, f.y), fr = SP.campfire()[Math.floor(t / 140 + f.id) % 3];
    g.globalAlpha = n * 0.75;
    g.drawImage(fr, Math.round(X - SP.FOOT[0]), Math.round(Y - SP.FOOT[1] + 2));
  }
  // the pot still hangs in front of the flame, lit by it
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  for (const st of lights) if (st.pot) g.drawImage(Math.floor(t / 380) % 3 === 0 ? st.sp1 : st.sp, st.dx, st.dy);
  g.restore();
}

/** How dark each world is, and the colour of its darkness. */
const DARK = { forest: ["#06242a", 0.1], city: ["#0a0e30", 0.18], cave: ["#060a22", 0.17], crypt: ["#0a0810", 0.2], sewer: ["#04100a", 0.17], abyss: ["#1e0208", 0.16] };
/** What lies beyond the edge of the map, and the earth its edge is cut from. */
const VOID = { interior: "#120c0a", cave: "#05060e", crypt: "#060508", sewer: "#040806", abyss: "#0c0204", city: "#07080e" };
const SKIRT = { interior: ["#5a3a26", "#3a2418"], meadow: ["#7a5a3a", "#5a4030"], town: ["#7a5a3a", "#5a4030"], forest: ["#5a4632", "#3e3024"], city: ["#4a5064", "#343846"], cave: ["#2e4468", "#1b2644"] };
let lightCv = null, lg = null;

export function sync(state2) { G = state2; }
/** Milliseconds from the start of a stroke to the moment its blade crosses the target. */
export function impactMs(wk, beat) {
  const hold = SP.HOLD[wk] || SP.HOLD.sword;
  return hold.time * (beat === 2 ? 1.15 : 1) * 1000 * Sw.IMPACT;
}

/**
 * The ground: one canvas, or for a big map the chunks on screen (baked on the spot if missing),
 * and then one more of those just off screen, nearest first, so walking on rarely waits.
 */
const PREFETCH = 192;
function drawGround(f, ox, oy) {
  const Gc = ground;
  if (!Gc.chunked) { drawLayer(Gc.frames[f % Gc.frames.length], Gc.ox, Gc.oy, ox, oy); return; }
  const x0 = ox + Gc.ox, y0 = oy + Gc.oy, x1 = x0 + vw + 2, y1 = y0 + vh + 2;
  const span = (a, b, n, s) => [clamp(Math.floor(a / s), 0, n - 1), clamp(Math.floor(b / s), 0, n - 1)];
  const [i0, i1] = span(x0, x1, Gc.nx, Gc.CW), [j0, j1] = span(y0, y1, Gc.ny, Gc.CH);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const c = Gc.get(i, j);
    const sx = Math.max(0, Math.floor(x0 - c.X)), sy = Math.max(0, Math.floor(y0 - c.Y));
    const sw = Math.min(c.w, Math.ceil(x1 - c.X)) - sx, sh = Math.min(c.h, Math.ceil(y1 - c.Y)) - sy;
    if (sw > 0 && sh > 0) g.drawImage(c.frames[f % 2], sx, sy, sw, sh, c.X + sx - Gc.ox, c.Y + sy - Gc.oy, sw, sh);
  }
  const [p0, p1] = span(x0 - PREFETCH, x1 + PREFETCH, Gc.nx, Gc.CW), [q0, q1] = span(y0 - PREFETCH, y1 + PREFETCH, Gc.ny, Gc.CH);
  let next = null, nd = Infinity;
  for (let j = q0; j <= q1; j++) for (let i = p0; i <= p1; i++) {
    if (Gc.has(i, j)) continue;
    const d = Math.abs((i + 0.5) * Gc.CW - (x0 + x1) / 2) + Math.abs((j + 0.5) * Gc.CH - (y0 + y1) / 2);
    if (d < nd) { nd = d; next = [i, j]; }
  }
  if (next) Gc.get(next[0], next[1]);
}
/**
 * A chunked map's glow layer, in 1024 × 512 pieces of the whole layer's canvas: each made when first on
 * screen from the world pixels that land in it (laid flat exactly as toIso lays the whole), the last
 * dozen kept. A piece with nothing in it is remembered as empty.
 */
const PULSE_W = 1024, PULSE_H = 512;
function pulsePiece(m, th, i, j) {
  const X0 = i * PULSE_W, Y0 = j * PULSE_H, hx = m.h * 16 * K;
  // the world pixels under this piece: u = X − hx + 2Y, v = 2Y − (X − hx), over its four corners
  const u0 = Math.floor(X0 - hx + 2 * Y0) - 2, v0 = Math.floor(2 * Y0 - (X0 + PULSE_W - hx)) - 2;
  const flat = DC.pulse(m, th, { u: u0, v: v0, w: PULSE_W + 2 * PULSE_H + 4, h: PULSE_W + 2 * PULSE_H + 4 });
  if (!flat) return null;
  const [cv, x] = sheet(PULSE_W, PULSE_H);
  x.imageSmoothingEnabled = false;
  x.setTransform(FLAT[0], FLAT[1], FLAT[2], FLAT[3], hx - X0, -Y0);
  x.drawImage(flat, u0, v0);
  flat.width = flat.height = 0;
  return cv;
}
/** For the bake check (_chunks.html): the glow layer whole and in pieces, laid side by side — { whole, parts } canvases or null. */
export function pulseBoth(m, th) {
  const pc = DC.pulse(m, th);
  if (!pc) return null;
  const whole = toIso(m, pc), [parts, x] = sheet(whole.width, whole.height);
  for (let j = 0; j * PULSE_H < whole.height; j++) for (let i = 0; i * PULSE_W < whole.width; i++) { const c = pulsePiece(m, th, i, j); if (c) x.drawImage(c, i * PULSE_W, j * PULSE_H); }
  return { whole, parts };
}
function pulsePart(i, j) {
  const key = i + "," + j;
  if (pulseParts.has(key)) { const c = pulseParts.get(key); pulseParts.delete(key); pulseParts.set(key, c); return c; }
  const c = pulsePiece(map, theme, i, j);
  pulseParts.set(key, c);
  while (pulseParts.size > 12) { const [k0, old] = pulseParts.entries().next().value; pulseParts.delete(k0); if (old) old.width = old.height = 0; }
  return c;
}
function drawPulseParts(ox, oy) {
  const hx = map.h * 16 * K, x0 = ox + hx, y0 = oy, W = (map.w + map.h) * 16 * K, H = (map.w + map.h) * 8 * K;
  for (let j = Math.max(0, Math.floor(y0 / PULSE_H)); j <= Math.min(Math.ceil(H / PULSE_H) - 1, Math.floor((y0 + vh + 2) / PULSE_H)); j++)
    for (let i = Math.max(0, Math.floor(x0 / PULSE_W)); i <= Math.min(Math.ceil(W / PULSE_W) - 1, Math.floor((x0 + vw + 2) / PULSE_W)); i++) {
      const c = pulsePart(i, j);
      if (c) g.drawImage(c, i * PULSE_W - hx, j * PULSE_H);
    }
}
/**
 * Stand up the walls and rock of a chunked map that are near the screen: everything that could show
 * now, and up to LAZY_STEP more a little further out, nearest the view first (they cost a canvas each).
 */
let lazyLeft = 0;
const LAZY_NEAR = 160, LAZY_FAR = 448, LAZY_STEP = 16;
function lazyTall(X0, X1, Y0, Y1) {
  let budget = LAZY_STEP, left = 0;
  for (const st of statics) {
    if (!st.lazy) continue;
    const must = st.x > X0 - LAZY_NEAR && st.x < X1 + LAZY_NEAR && st.y > Y0 - 24 && st.y - LAZY_NEAR < Y1;
    const soon = !must && budget > 0 && st.x > X0 - LAZY_FAR && st.x < X1 + LAZY_FAR && st.y > Y0 - LAZY_FAR / 2 && st.y - LAZY_FAR < Y1;
    if (!must && !soon) { left++; continue; }
    if (soon) budget--;
    const [x, y] = st.lazy, pc2 = IT.tallAt(map, x, y, theme);
    st.lazy = null;
    if (pc2 && pc2.img) { st.sp = pc2.img; st.dx = st.tx + pc2.dx; st.dy = st.ty + pc2.dy; if ("low" in pc2) st.cut = pc2; }
  }
  lazyLeft = left;
}
/** The ground's bake for the tools: whole or chunked, and what chunks cost so far. */
export function groundInfo() { return ground && { load: loadCost, ...(ground.chunked ? { chunked: true, nx: ground.nx, ny: ground.ny, ...ground.stats } : { chunked: false, ms: ground.ms || 0, parts: ground.parts || null }) }; }
/** Draw the on-screen part of a whole-map layer whose map origin sits at (lx, ly) inside it. */
function drawLayer(c, lx, ly, ox, oy) {
  const sx = Math.max(0, Math.floor(ox + lx)), sy = Math.max(0, Math.floor(oy + ly));
  const sw = Math.min(c.width - sx, vw + 2), sh = Math.min(c.height - sy, vh + 2);
  if (sw > 0 && sh > 0) g.drawImage(c, sx, sy, sw, sh, sx - lx, sy - ly, sw, sh);
}
/** The map's two front edges fall away into the dark, so it reads as a slab of land. */
function drawSkirt() {
  const U = UG[theme], [a, b] = U ? [U.face[0], U.face[3]] : SKIRT[theme] || SKIRT.meadow, d = 18;
  const [Lx, Ly] = tI(0, map.h), [Bx, By] = tI(map.w, map.h), [Rx, Ry] = tI(map.w, 0);
  const quad = (x0, y0, x1, y1, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1, y1 + d); g.lineTo(x0, y0 + d); g.closePath(); g.fill(); };
  quad(Lx, Ly, Bx, By, a); quad(Bx, By, Rx, Ry, b);
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(Bx - 1, By, 2, d);
}

// ── the aim mark: a tiny pointed crescent lying on the ground in front of your own feet, its
// bulge toward where your blows and skills will go (G.me.aimI, the server's aim steps). A pale
// sliver inside a dark outline, so it reads on grass, stone, crypt and abyss alike.
const AIM_STEPS = 64, aimSprites = new Map(), aimArrow = { a: null };
// the sliver a touch see-through inside a firmer outline: drawn at .82, the fill shows at about 70%
const AIM_FILL = "rgba(255,246,218,.86)", AIM_INK = "#1a1320", AIM_C = 9;
/**
 * The crescent for screen angle step `k`, worked out pixel by pixel (no smoothed curves): an arc
 * of a small circle whose outer edge bulges toward the aim, thickest in the middle and thinning
 * to a point at each horn, squashed a little so it lies on the floor. The apex is at (AIM_C, AIM_C).
 */
function aimSprite(k) {
  let c = aimSprites.get(k);
  if (c) return c;
  const ang = (k / AIM_STEPS) * 2 * Math.PI, ax = Math.cos(ang), ay = Math.sin(ang);
  const R = 4.5, SPAN = (80 * Math.PI) / 180, TH = 2.2, SQ = 0.9, N = AIM_C * 2 + 1;
  const fill = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const cx = i - AIM_C + ax * R, cy = (j - AIM_C) / SQ + ay * R, rho = Math.hypot(cx, cy) || 1;
    const d = Math.acos(clamp((cx * ax + cy * ay) / rho, -1, 1));
    fill[j * N + i] = d <= SPAN && rho <= R + 0.5 && rho >= R + 0.5 - TH * (1 - (d / SPAN) ** 2);
  }
  const on = (i, j) => i >= 0 && j >= 0 && i < N && j < N && fill[j * N + i];
  let x;
  [c, x] = sheet(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (on(i, j)) { x.fillStyle = AIM_FILL; x.fillRect(i, j, 1, 1); }
    else if (on(i + 1, j) || on(i - 1, j) || on(i, j + 1) || on(i, j - 1)) { x.fillStyle = AIM_INK; x.fillRect(i, j, 1, 1); }
  }
  aimSprites.set(k, c);
  return c;
}
/** Draw the mark: under the bodies when it points down the screen, over them when it points up,
 *  lifted clear of the head (your name lifts to make room: G.aimUpK) rather than lying on your back.
 *  It slides smoothly round between steps and brightens for a moment with each blow or spell. */
function drawAimArrow(t, dt, top) {
  const me = G.me;
  if (G.aimArrow === false || me.aimI === undefined || me.dead || me.sit || !G.defs) return;
  const n = (G.defs.aim && G.defs.aim[0]) || 64, want = (me.aimI / n) * 2 * Math.PI;
  if (!top) {
    if (aimArrow.a === null) aimArrow.a = want;
    let d = want - aimArrow.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    aimArrow.a += d * Math.min(1, dt * 16);
  }
  const wx = Math.cos(aimArrow.a), wy = Math.sin(aimArrow.a);
  const s = Math.atan2((wx + wy) / 2, wx - wy);           // the same way, as it looks on screen
  const up = Math.sin(s) < -0.3;
  if (!top) G.aimUpK = (G.aimUpK || 0) + ((up ? 1 : 0) - (G.aimUpK || 0)) * Math.min(1, dt * 10);
  if (up !== top) return;
  const [fx, fy] = iso(me.x, me.y - 1);
  // out along the ground: wider across the screen than up and down, as a ring on the floor looks
  const ux = Math.cos(s) * 18, uy = Math.sin(s) * (12 + 12 * Math.max(0, -Math.sin(s)) ** 3);
  const k = ((Math.round((s / (2 * Math.PI)) * AIM_STEPS) % AIM_STEPS) + AIM_STEPS) % AIM_STEPS;
  const hit = t - Math.max(G.aimFlash || -1e9, G.lastSkill || -1e9);
  const flash = hit >= 0 && hit < 300 ? 1 - hit / 300 : 0;
  g.globalAlpha = 0.82 + 0.18 * flash;
  g.drawImage(aimSprite(k), Math.round(fx + ux) - AIM_C, Math.round(fy + uy) - AIM_C);
  g.globalAlpha = 1;
}

export function render(focusX, focusY, dt, t, snap) {
  if (!map || !ground || !G) return;
  const [fX, fY] = iso(focusX, focusY);
  const minX = -map.h * 16 * K, maxX = map.w * 16 * K, maxY = (map.w + map.h) * 8 * K;
  // the view follows you, but never wanders far past the corners of the map's diamond
  let tx = fX - vw / 2, ty = fY - 14 - vh / 2;
  tx = maxX - minX > vw ? clamp(tx, minX - 24, maxX - vw + 24) : (minX + maxX - vw) / 2;
  ty = maxY > vh ? clamp(ty, -60, maxY - vh + 40) : (maxY - vh) / 2;
  if (snap) { cam.x = tx; cam.y = ty; } else { cam.x += (tx - cam.x) * Math.min(1, dt * 10); cam.y += (ty - cam.y) * Math.min(1, dt * 10); }
  shakeAmt = Math.max(0, shakeAmt - dt * 18);
  // a directional kick (crits, big skills) swings along the blow and dies in a few swings
  kick.amt = Math.max(0, kick.amt - dt * 40);
  const kq = kick.amt * Math.cos(((t - kick.t0) / 1000) * 2 * Math.PI * 18);
  const ox = Math.round(cam.x + (Math.random() - 0.5) * shakeAmt + kick.x * kq), oy = Math.round(cam.y + (Math.random() - 0.5) * shakeAmt + kick.y * kq);
  fxClock = t;
  const now = t;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = VOID[theme] || "#0b0d18";
  g.fillRect(0, 0, vw, vh);
  g.translate(-ox, -oy);
  drawSkirt();
  drawGround(artGround ? Math.floor(t / 650) % 2 : 0, ox, oy);
  if (!artGround) drawWater(t, ox, oy);
  if (pulseCv || pulseParts) {
    const beat = theme === "abyss" ? Math.max(0, Math.sin(t / 260)) ** 3 * 0.6 + Math.max(0, Math.sin(t / 260 - 0.9)) ** 3 * 0.3 : 0.5 + 0.5 * Math.sin(t / 1100);
    g.globalAlpha = 0.25 + beat * 0.6;
    if (pulseCv) drawLayer(pulseCv, map.h * 16 * K, 0, ox, oy); else drawPulseParts(ox, oy);
    g.globalAlpha = 1;
  }
  // gates and everything else that lies flat on the ground, drawn through the diamond matrix
  g.setTransform(FLAT[0], FLAT[1], FLAT[2], FLAT[3], -ox, -oy);
  for (const p of map.portals) {
    const px = p.x * T + 16, py = p.y * T + 16;
    if (p.door) {
      // a house door: a mat on the step outside (indoors it is part of the floor) and a warm, breathing light
      if (theme !== "interior") { g.fillStyle = "#5a3a22"; g.fillRect(px - 13, py - 11, 26, 22); g.fillStyle = "#b8925a"; g.fillRect(px - 11, py - 9, 22, 18); g.fillStyle = "#a8824c"; for (let i = -9; i < 9; i += 4) g.fillRect(px - 11, py + i, 22, 2); }
      const k = 0.5 + 0.5 * Math.sin(t / 900 + p.x);
      g.fillStyle = theme === "interior" ? `rgba(255,246,214,${0.1 + k * 0.08})` : `rgba(255,200,120,${0.08 + k * 0.08})`;
      g.beginPath(); g.arc(px, py, 18 + k * 3, 0, 7); g.fill();
      continue;
    }
    for (let i = 0; i < 3; i++) { const ph = (t / 700 + i / 3) % 1; g.strokeStyle = `rgba(${i % 2 ? "170,225,255" : "205,160,255"},${1 - ph})`; g.lineWidth = 4; g.beginPath(); g.arc(px, py, 8 + ph * 20, 0, 7); g.stroke(); }
  }
  g.lineWidth = 1;
  drawFx(now, true);
  g.setTransform(1, 0, 0, 1, -ox, -oy);
  drawAimArrow(t, dt, false);
  for (const p of map.portals) if (!p.door && Math.random() < 0.2) { const [px, py] = tI(p.x + 0.5, p.y + 0.5); parts.push({ x: px + Math.random() * 24 - 12, y: py + Math.random() * 8 - 4, vx: 0, vy: -40, life: 0.6, color: "#d6b8ff", g: 0 }); }
  DC.drawFalls(g, falls, t, ox, oy, vw, vh);
  for (const s of smokers) if (s.x > ox - 20 && s.x < ox + vw + 20 && s.y > oy - 60 && s.y < oy + vh && Math.random() < 0.07) parts.push({ x: s.x + Math.random() * 4, y: s.y, vx: 5 + Math.random() * 5, vy: -13, life: 1.3 + Math.random(), color: "#eef0f6", g: -5, s: 3 });

  // everything that stands up, painted back to front by how far down the diagonal it stands
  const list = [];
  const X0 = ox - 8, X1 = ox + vw + 8, Y0 = oy - 8, Y1 = oy + vh + 8;
  const on = (X, Y, up = 80) => X > X0 - 48 && X < X1 + 48 && Y > Y0 && Y - up < Y1;
  if (lazyLeft) lazyTall(X0, X1, Y0, Y1);
  for (const st of statics) {
    const sp = st.sp;
    if (!sp) continue;
    if (st.dx > X1 || st.dx + sp.width < X0 || st.dy > Y1 || st.dy + sp.height < Y0) continue;
    if (st.slices) { for (const sl of st.slices) if (st.dx + sl.sx < X1 && st.dx + sl.sx + sl.w > X0) list.push({ y: sl.d, s: st, sl }); }
    else list.push({ y: st.d, s: st });
  }
  for (const n of npcs) if (on(n.x, n.y) && npcOut(n.n)) list.push({ y: n.y, X: n.x, Y: n.y, n });
  const add = (wx, wy, o, dy = 0) => { const [X, Y] = iso(wx, wy); if (!on(X, Y, 140)) return; o.X = X; o.Y = Y; o.y = Y + dy; list.push(o); };
  for (const d of G.drops.values()) add(d.x, d.y, { d }, -1);
  if (G.fires) for (const f of G.fires.values()) add(f.x, f.y, { f });
  if (G.bobs) for (const b of G.bobs.values()) add(b.x, b.y, { b }, -1);
  for (const m of G.mobs.values()) add(m.x, m.y, { m });
  for (const [eid, p] of G.players) add(p.x, p.y, { p, eid });
  add(G.me.x, G.me.y, { p: G.me, eid: G.you, me: true }, 0.01);
  for (const pt of petsNow(dt, t)) add(pt.x, pt.y, { pet: pt }, -1);
  for (const [id, pr] of props) { if (t >= pr.until) props.delete(id); else add(pr.x, pr.y, { pr }, -(pr.lift || 0)); }
  list.sort((a, b) => a.y - b.y);
  for (const s of ents.values()) s.seen = false;

  const [meX, meY] = iso(G.me.x, G.me.y);
  let hidden = false, meDrawn = false;
  for (const o of list) {
    if (o.s) {
      const st = o.s, sl = o.sl;
      let sp = st.sp, dx = st.dx, dy = st.dy;
      if (st.pot) {
        if (Math.floor(t / 380) % 3 === 0) sp = st.sp1;
        if (Math.random() < 0.18) parts.push({ x: st.x - 3 + Math.random() * 6, y: st.dy + 9, vx: 3 + Math.random() * 4, vy: -12 - Math.random() * 6, life: 1 + Math.random() * 0.6, color: Math.random() < 0.5 ? "#f4f0f8" : "#d8d4e4", g: -4, s: 2 });
      }
      // walls just in front of you are cut down to their stumps, Diablo-style, so a corridor never swallows you
      if (st.cut && meDrawn) {
        const ex = (st.x - meX) / 72, ey = (st.d - meY) / 40;
        if (ey > 0 && ex * ex + ey * ey < 1) { const lo = st.cut.low; if (lo) { sp = lo.img; dx = st.tx + lo.dx; dy = st.ty + lo.dy; } }
      }
      // anything else in front of you that covers you turns see-through
      const ax = sl ? dx + sl.sx : dx, aw = sl ? sl.w : sp.width;
      if (meDrawn && !st.cut && sp.height > 20 && ax < meX + 8 && ax + aw > meX - 8 && dy < meY - 4 && dy + sp.height > meY - 26 && !G.me.dead) { g.globalAlpha = 0.48; hidden = true; }
      if (sl) g.drawImage(sp, sl.sx, 0, sl.w, sp.height, ax, dy, sl.w, sp.height);
      else g.drawImage(sp, dx, dy);
      g.globalAlpha = 1;
      if (sl && sl.sx !== 0) continue;           // what goes on a big sprite goes on once
      // a crystal that catches the light, a waypoint's rune, a landmark's glow, a fountain that splashes
      if (st.glint >= 0 && Math.sin(t / 420 + st.glint) > 0.86) { g.fillStyle = "#ffffff"; g.fillRect(dx + 16, dy + 6, 5, 1); g.fillRect(dx + 18, dy + 4, 1, 5); }
      if (st.wp) drawRune(st, dx, dy, t);
      if (st.anim) st.anim(g, t, st.tx, st.ty, parts);
      if (st.land && st.glow) {
        const beat = st.land === "heart" ? Math.max(0, Math.sin(t / 260)) ** 3 + Math.max(0, Math.sin(t / 260 - 0.9)) ** 3 * 0.5 : 0.5 + 0.5 * Math.sin(t / 900 + st.ph);
        const r = st.land === "heart" ? 70 : 44, gy = st.land === "heart" ? dy + 70 : st.land === "board" ? dy + 44 : st.land === "shrine" ? dy + 14 : st.land === "oak" ? dy + 94 : dy + sp.height * 0.45;
        g.globalCompositeOperation = "lighter"; g.globalAlpha = (0.12 + beat * 0.16) * (DARK[theme] ? 1.4 : 1);
        g.drawImage(DC.glow(st.glow, r), Math.round(st.x - r), Math.round(gy - r));
        g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
        if (st.land === "crystals" && Math.random() < 0.04) parts.push({ x: dx + 10 + Math.random() * (sp.width - 20), y: dy + 20 + Math.random() * 60, vx: 0, vy: -8, life: 1.2, color: "#cffaff", g: 0, s: 1 });
      }
      if (st.water && Math.random() < 0.45) parts.push({ x: st.x - 9 + Math.random() * 18, y: st.y - 50, vx: (Math.random() - 0.5) * 34, vy: -24 - Math.random() * 20, life: 0.55, color: "#dff4ff", g: 170, s: 2 });
    } else if (o.n) {
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(o.n.x, o.n.y, 6, 3, 0, 0, 7); g.fill();
      const pose = o.n.n.pose, nt = t + o.n.x * 37;
      const nf = pose === "doze" || nt % 3900 < 140 ? SP.FRAME.blink : Math.floor(nt / (pose === "doze" ? 1400 : 620)) % 2 ? SP.FRAME.breathe : SP.FRAME.stand;
      g.drawImage(o.n.sheet.front[nf], Math.round(o.n.x - SP.FOOT[0]), Math.round(o.n.y - SP.FOOT[1]));
      if (pose) IN.drawPose(g, pose, o.n.x, o.n.y, t, parts, o.n.n.x * 7 + o.n.n.y);
    } else if (o.f && theme === "interior") {
      // indoors the fire burns in the fireplace (iso_interior.js), not on the floor
    } else if (o.f) {
      // a campfire: warm light on the ground, a flickering flame, sparks drifting up
      const x = o.X, y = o.Y, fr = SP.campfire()[Math.floor(t / 140 + o.f.id) % 3];
      g.fillStyle = "rgba(255,170,60,.13)"; g.beginPath(); g.ellipse(x, y - 2, 30, 15, 0, 0, 7); g.fill();
      g.drawImage(fr, Math.round(x - SP.FOOT[0]), Math.round(y - SP.FOOT[1] + 2));
      if (Math.random() < 0.12) parts.push({ x: x - 3 + Math.random() * 6, y: y - 16, vx: (Math.random() - 0.5) * 10, vy: -18 - Math.random() * 14, life: 0.7, color: Math.random() < 0.5 ? "#ffd070" : "#ff9040", g: -10, s: 1 });
    } else if (o.b) {
      // a fishing float riding the water, its line running back to the angler
      const bx = Math.round(o.X), by = Math.round(o.Y + Math.sin(t / 260) * 1.2 + (o.b.bite ? Math.sin(t / 40) * 2 : 0));
      const who = o.b.eid === G.you ? G.me : G.players.get(o.b.eid);
      g.lineWidth = 1;
      if (who) { const [wx2, wy2] = iso(who.x, who.y); g.strokeStyle = "rgba(240,240,255,.6)"; g.beginPath(); g.moveTo(bx, by - 4); g.lineTo(Math.round(wx2) + 4, Math.round(wy2) - 12); g.stroke(); }
      g.strokeStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(bx, by + 1, 4 + ((t / 200) % 3), 2, 0, 0, 7); g.stroke();
      g.fillStyle = "#2b2233"; g.fillRect(bx - 2, by - 4, 4, 5); g.fillStyle = "#ffffff"; g.fillRect(bx - 1, by - 3, 2, 1); g.fillStyle = "#e84a5a"; g.fillRect(bx - 1, by - 2, 2, 2);
    } else if (o.d) {
      const d = o.d, x = o.X, y = o.Y, ic = G.icons.cv[d.it];
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(x, y, 8, 4, 0, 0, 7); g.fill();
      if (d.q) { g.fillStyle = RARITY[d.q]; g.globalAlpha = 0.3 + 0.15 * Math.sin(t / 180 + d.id); g.fillRect(x - 2, y - 26 - d.q * 16, 4, d.q * 16 + 22); g.globalAlpha = 1; }
      if (ic) g.drawImage(ic, Math.round(x - 8), Math.round(y - 18 + Math.sin(t / 220 + d.id) * 2), 16, 16);
    } else if (o.m) {
      const m = o.m, kind = G.defs.mobs[m.k].sp, x = o.X, y = o.Y, el = m.el | 0;
      // an elite wears the colour of its first trait; a recoloured kind wears its own
      const tint = (m.tr && TRAIT_TINT[m.tr[0]]) || G.defs.mobs[m.k].tint || null;
      // the quarter-view cast: four facings and a pose for every moment (mobart.js)
      if (MA.has(kind)) { MA.draw(g, m, G.defs.mobs[m.k], tint, state("m" + m.id, "q", () => ({})), t, x, y, parts, G); continue; }
      const s = state("m" + m.id, kind + ":" + el + ":" + (tint || ""), () => { const z = SP.MOB_SIZE[kind] || [1, 0]; return { frames: SP.monsterSheet(kind, tint), size: z[0] * (el === 2 ? 2 : 1), hover: z[1] * (el === 2 ? 1.5 : 1), px: m.x, py: m.y }; });
      // sprites face left; they turn by which way they move across the screen
      const sdx = (m.x - s.px) - (m.y - (s.py ?? m.y));
      if (sdx > 0.05) s.face = -1; else if (sdx < -0.05) s.face = 1;
      s.px = m.x; s.py = m.y;
      const img = s.frames[Math.floor(t / (m.moving ? 180 : 360) + m.id) % 2], w = SP.SIZE * s.size;
      const a = t - m.atkT, lunge = a < 220 ? Math.sin((a / 220) * Math.PI) * 6 * -s.face : 0;
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(x, y, w * 0.26, w * 0.13, 0, 0, 7); g.fill();
      if (el) {
        const pulse = 0.55 + 0.3 * Math.sin(t / 160 + m.id);
        g.strokeStyle = el === 2 ? `rgba(255,110,214,${pulse})` : `rgba(255,196,64,${pulse})`; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x, y, w * 0.32, w * 0.16, 0, 0, 7); g.stroke();
        if (el === 2) { g.strokeStyle = `rgba(138,232,248,${pulse * 0.8})`; g.beginPath(); g.ellipse(x, y, w * 0.4 + Math.sin(t / 240) * 2, w * 0.2, 0, 0, 7); g.stroke(); }
        if (Math.random() < (el === 2 ? 0.3 : 0.1)) parts.push({ x: x + (Math.random() - 0.5) * w * 0.5, y: y - Math.random() * w * 0.4, vx: 0, vy: -22, life: 0.5, color: el === 2 ? "#ff8ae0" : "#ffe08a", g: 0, s: 1 });
      }
      g.save();
      const hk = (t - m.hurtT) / 200, rec = hk < 1 ? (1 - hk) * (1 - hk) : 0;
      const pow = m.hurtP || 1;
      // knocked back along the blow, as the blow looks on screen
      const ha = m.hurtA || 0, hx = Math.cos(ha) - Math.sin(ha), hy = (Math.cos(ha) + Math.sin(ha)) / 2;
      const jx = rec ? hx * rec * 6 * pow + Math.sin(t / 14) * rec * 2 : 0, jy = rec ? hy * rec * 6 * pow : 0;
      g.translate(Math.round(x + lunge + jx), Math.round(y + jy - s.hover - (s.hover ? Math.sin(t / 320 + m.id) * 2 : 0)));
      g.scale(s.face * (1 + rec * 0.24), 1 - rec * 0.2);
      // struck: pure white for the first frames (and through a hitstop), then a bright blink
      const hw = t - m.hurtT, white = hw >= 0 && hw < 36 + (m.hsMs || 0);
      if (!white && hw >= 0 && hw < 110) g.filter = "brightness(1.8)";
      else if (!white && el) { g.shadowColor = el === 2 ? "#ff5ad0" : "#ffc040"; g.shadowBlur = el === 2 ? 8 : 4; }
      g.drawImage(white ? tintWhite(img) : img, -w / 2, -w * (SP.FOOT[1] / SP.SIZE), w, w);
      g.restore();
      m.h3 = (w * (G.defs.mobs[m.k].boss ? 0.92 : 0.72) + s.hover) / 26;
    } else if (o.pr) {
      g.save(); o.pr.draw(g, t, o.X, o.Y); g.restore();
    } else if (o.pet) {
      drawPet(o.pet, t);
    } else if (o.p) {
      const w = G.who.get(o.eid);
      if (!w) continue;
      const s = personState(o.eid, playerLook(w.cls, w.look, w.gear));
      const seat = seatOf(o.p);
      o.p.seatFa = seat ? sAng(seat.wx - o.p.x, seat.wy - o.p.y) : undefined;
      const px = o.X, py = o.Y - (seat ? 3 : 0);
      // a giant grows (and shrinks back) over a quarter of a second
      const gz = o.p.gz = (o.p.gz || 1) + (((o.p.fl | 0) & 1 ? 1.6 : 1) - (o.p.gz || 1)) * Math.min(1, dt * 8);
      if (gz > 1.01) { g.save(); g.translate(px, py); g.scale(gz, gz); g.translate(-px, -py); drawPerson(s, o.p, t, dt, px, py); g.restore(); }
      else drawPerson(s, o.p, t, dt, px, py);
      const jam = G.jams && G.jams.get(o.eid);
      if (jam && t - jam.t0 < 2600) drawJam(jam, s, t, px, py);
      o.p.h3 = s.h * gz;
      if (o.me) { meDrawn = true; ghost.s = s; ghost.gz = gz; }
    }
  }
  // seen through a wall: a pale ghost of you on top of whatever hides you
  if (hidden && ghost.s && ghost.s.img) {
    const s = ghost.s;
    g.save(); g.globalAlpha = 0.42; g.translate(Math.round(meX), Math.round(meY)); g.scale(s.face * ghost.gz, ghost.gz);
    g.drawImage(s.img, -SP.FOOT[0], -SP.FOOT[1]);
    g.restore();
  }
  for (const [id, s] of ents) if (!s.seen) ents.delete(id);
  g.setTransform(1, 0, 0, 1, -ox, -oy);
  drawAimArrow(t, dt, true);
  for (const h of hooks) { g.save(); h(g, t, P); g.restore(); }

  drawFx(now, false);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    const sz = p.s || 3;
    // a sleeper's "z", drifting up
    if (p.z) { g.globalAlpha = clamp(p.life, 0, 1); g.fillStyle = p.color; const zx = Math.round(p.x), zy = Math.round(p.y); g.fillRect(zx, zy, 3, 1); g.fillRect(zx + 1, zy + 1, 1, 1); g.fillRect(zx, zy + 2, 3, 1); continue; }
    g.globalAlpha = clamp(p.life * 3, 0, 1); g.fillStyle = p.color; g.fillRect(Math.round(p.x) - (sz >> 1), Math.round(p.y) - (sz >> 1), sz, sz);
  }
  g.globalAlpha = 1;
  const outdoor = OUTDOOR.has(theme) && !map.indoor && Sky.weather() !== -1, night = outdoor ? Sky.nightK() : 0;
  DC.drawEmitters(g, emit, t, ox, oy, vw, vh, parts);
  DC.drawStrings(g, strings, t, ox, oy, vw, vh, night);
  g.setTransform(1, 0, 0, 1, 0, 0);
  DC.drawCritters(g, critters, dt, t, ox, oy, vw, vh, theme);

  // darkness, with pools of light cut out of it: the same everywhere on screen, never darker at the edges
  const dark = DARK[theme];
  if (dark) {
    if (!lightCv) [lightCv, lg] = sheet(vw, vh);
    if (lightCv.width !== vw || lightCv.height !== vh) { lightCv.width = vw; lightCv.height = vh; }
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, vw, vh);
    lg.globalAlpha = dark[1]; lg.fillStyle = dark[0]; lg.fillRect(0, 0, vw, vh); lg.globalAlpha = 1;
    lg.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, k = 1) => { const sx = x - ox, sy = y - oy; if (sx < -r || sy < -r || sx > vw + r || sy > vh + r) return; const gr = lg.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, "rgba(0,0,0,0)"); lg.fillStyle = gr; lg.fillRect(sx - r, sy - r, r * 2, r * 2); };
    for (const o of list) {
      if (o.sl && o.sl.sx !== 0) continue;
      if (o.f) hole(o.X, o.Y - 8, 120, 0.95);
      else if (o.s && o.s.wp) hole(o.s.x, o.s.y - 22, 70, wpLit() ? 0.85 : 0.3);
      else if (o.s && o.s.glow) hole(o.s.x, o.s.y - (o.s.big ? 60 : o.s.sp.height - 12), o.s.big ? 120 : o.s.glow === "#ffe690" ? 110 : 60, 0.85);
      else if (o.d && o.d.q) hole(o.X, o.Y - 10, 36, 0.7);
      else if (o.m && SP.MOB_GLOW[G.defs.mobs[o.m.k].sp]) hole(o.X, o.Y - 14, o.m.el === 2 ? 90 : 48, 0.75);
    }
    for (const p of map.portals) { const [px, py] = tI(p.x + 0.5, p.y + 0.5); hole(px, py, 80, 0.8); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(lightCv, 0, 0);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // indoors: warm lamplight and the fire, sunlight through the windows by day (iso_interior.js)
  if (theme === "interior") { IN.roomLight(g, roomL, t, dt, ox, oy, vw, vh, Sky.nightK()); cam.ox = ox; cam.oy = oy; return; }
  // outdoors the day turns: the whole view graded by the hour and the weather (one even multiply,
  // never darker at the edges), with lamps, windows, runes and fires cut into the night as pools
  const L = outdoor ? Sky.grade(g, vw, vh, dt, t, skyLights(t, ox, oy), Sky.cloudPainter(ox, oy, t)) : null;
  if (L && L.night > 0.05) glowAfterDark(L.night, t, ox, oy);
  drawAmbient(dt, t, ox, oy);
  Sky.drawWeather(g, vw, vh, dt, t, ox, oy, outdoor, theme, outdoor ? camps.map((c) => ({ x: c.x - ox, y: c.y - oy })) : [], L);
  cam.ox = ox; cam.oy = oy;
}
/** The local player's last drawn look, for the ghost shown through walls. */
const ghost = { s: null, gz: 1 };

/** Where a point of the world lands on screen (CSS pixels). `h` lifts it, in tiles. */
export function project(wx, wy, h = 0) {
  const [X, Y] = iso(wx, wy, h);
  return [(X - (cam.ox ?? cam.x)) * Z, (Y - (cam.oy ?? cam.y)) * Z];
}
/**
 * What is under a screen position, in server units: the feet of whatever stands
 * there (a monster, one of the townsfolk, a waypoint stone) if the click is on
 * its body, else the point on the ground.
 */
export function pick(clientX, clientY) {
  const X = clientX / Z + (cam.ox ?? cam.x), Y = clientY / Z + (cam.oy ?? cam.y);
  let best = null, bd = -1e9;
  const test = (wx, wy, w, h) => { const [x, y] = iso(wx, wy); if (X > x - w / 2 && X < x + w / 2 && Y > y - h && Y < y + 4 && y > bd) { bd = y; best = [wx, wy]; } };
  if (G && map && G.defs) {
    for (const m of G.mobs.values()) { const d = G.defs.mobs[m.k], z = ((SP.MOB_SIZE[d && d.sp] || [1])[0] * (m.el === 2 ? 2 : 1)) * SP.SIZE; test(m.x, m.y, z * 0.6, z * 0.75); }
    for (const n of map.npcs) if (npcOut(n)) test(n.x * 16 + 8, n.y * 16 + 12, 18, 28);
    for (const k of map.marks || []) if (k.kind === "waypoint") test(k.x * 16 + 8, k.y * 16 + 8, 18, 44);
  }
  if (best) return best;
  return [Y / K + X / (2 * K), Y / K - X / (2 * K)];
}

// ───────────────────────────── title and creation ─────────────────────────────

let stage = null;
export function showcase(draft) {
  const cast = draft ? [draft] : [playerLook("warrior", [1, 0, 0, 0, 0, 0, 1, 3, 5, 0, 0], { wt: 3 }), playerLook("mage", [11, 6, 8, 15, 0, 7, 4, 8, 10, 1, 0], { wt: 3 }), playerLook("lancer", [3, 1, 6, 10, 2, 3, 3, 5, 4, 1, 4], { wt: 3 }), playerLook("rogue", [0, 2, 10, 10, 2, 2, 0, 1, 3, 2, 4], { wt: 2 })];
  stage = { draft: !!draft, cast: cast.map((look, i) => ({ s: { key: "", face: 1, walk: 0, ang: null, ...makePerson(look) }, i })) };
  map = null;
}
export function leaveStage() { stage = null; }
/**
 * One person with their weapon, drawn on another canvas (the title diorama and the
 * creation preview, lobby.js): `figure(look)` makes the scratch state, `drawFigure`
 * draws it with the same strokes as in the world. `e` speaks in screen directions.
 */
export function figure(look) { return { key: "", face: 1, walk: 0, ang: null, ...makePerson(look) }; }
export function drawFigure(ctx, s, e, t, dt, x, y) {
  const keep = g;
  g = ctx;
  try { drawPerson(s, { scr: true, x: 0, y: 0, dir: 2, moving: false, atkT: -1e9, dead: false, aim: null, ...e }, t, dt, x, y); } finally { g = keep; }
}
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
      const k = (t % 3200) / 1000, dir = [0, 2, 3, 1][Math.floor(t / 3200) % 4], z = Math.max(3, Math.round(15 / Z));
      g.save(); g.translate(cx + Math.min(120, vw * 0.18), gy + 34); g.scale(z, z);
      drawPerson(s, { scr: true, x: 0, y: 0, dir, moving: k > 1 && k < 2.2, atkT: k > 2.5 ? t - (k - 2.5) * 1000 : -1e9, dead: false, aim: k > 2.5 ? [dir === 1 ? -40 : 40, 6] : null }, t, dt, 0, 0);
      g.restore();
    } else drawPerson(s, { scr: true, x: 0, y: 0, dir: 2, moving: true, atkT: -1e9, dead: false, aim: null }, t, dt, cx - 66 + i * 44, gy + 12);
  });
}
