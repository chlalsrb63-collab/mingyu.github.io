/**
 * The renderer's shared core (split from scene2d.js): the 2:1 projection (`iso sqI tI sAng FLAT`),
 * colour helpers (`hash mix dk lt tone`), the canvas and its scale (`cv g Z vw vh`, `init resize`,
 * `setCtx` for drawing on another canvas), the camera `cam`, the client state `G` (`sync`),
 * screen ↔ world (`project pick`), and the drawing tools (`sheet tools ink prop`).
 * Every scene_*.js module reads these live bindings; only this module assigns them.
 */

import * as SP from "./sprites.js";
import { map } from "./scene_map.js";
import { npcOut } from "./scene_people.js";

export const T = 32, P = 2;
/** Iso pixels per server unit along the screen's x; y is half that. Height lifts by 26 px per unit `h`. */
export const K = 1, LIFT = 26;
/** Server units → iso pixels (camera-free). */
export function iso(wx, wy, h = 0) { return [(wx - wy) * K, ((wx + wy) * K) / 2 - h * LIFT]; }
/** World pixels (the square ground's, two per server unit) → iso pixels. */
export const sqI = (u, v) => [((u - v) * K) / 2, ((u + v) * K) / 4];
/** Tile coordinates (fractions allowed) → iso pixels. */
export const tI = (tx, ty) => [(tx - ty) * 16 * K, (tx + ty) * 8 * K];
/** The screen angle (canvas convention) of a direction on the ground. */
export function sAng(dx, dy) { return Math.atan2((dx + dy) / 2, dx - dy); }
/** The matrix that lays world-pixel drawing flat onto the diamond ground. */
export const FLAT = [K / 2, K / 4, -K / 2, K / 4];
export const DXW = [0, -1, 1, 0], DYW = [1, 0, 0, -1];
export const INK = "#2b2233";
export const DEG = Math.PI / 180;
export const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
export const dk = (c, f = 0.78) => mix(c, f), lt = (c, f = 1.25) => mix(c, f);
/** `t` of the way from colour `a` to colour `b` — used to lean shadows toward a hue. */
export function tone(a, b, t) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

export let cv, g, Z = 2, vw = 320, vh = 200;
export const cam = { x: 0, y: 0 };
export let G = null;
export const PARTS = SP.PARTS;
export function playerLook(cls, look, gear = {}) { return { cls, look, gear }; }

export function init(canvas) { cv = canvas; g = cv.getContext("2d"); resize(); }
/** Draw on another canvas for a moment (`drawFigure`); put the old one back after. */
export function setCtx(ctx) { g = ctx; }
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

export function sheet(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  return [c, x];
}
export function tools(x) {
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
export function ink(c, x, col = INK, passes = 1) {
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
export function prop(w, h, draw) {
  const [c, x] = sheet(w + 4, h + 4);
  x.translate(2, 2);
  draw(tools(x), x);
  x.setTransform(1, 0, 0, 1, 0, 0);
  return ink(c, x);
}

// ───────────────────────────── the client state, screen ↔ world ─────────────────────────────

export function sync(state2) { G = state2; }

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
