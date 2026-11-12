/**
 * Pixel sprites: people, monsters and weapons, each on a 64×64 sheet.
 *
 * The adventurers are small animals — cats, foxes and bears — carrying weapons
 * as big as they are. The style is deliberately simple and chunky: a big head on
 * a small body, dot eyes, flat colours with one shadow tone and a thick dark
 * outline, so a figure reads instantly at any size. Weapons are separate sprites drawn
 * pointing right from their grip, because in play they are not animation
 * frames: the weapon itself is swung around the hand.
 *
 * People have two views (front, back; mirrored for left and right) and three
 * frames each: 0 standing, 1 and 2 the two steps of a walk.
 */

export const SIZE = 64;
/** Where the feet touch the ground, and the grip a weapon pivots on. */
export const FOOT = [32, 58];
export const GRIP = [10, 32];
const INK = "#2b2233";

function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const dk = (c, f = 0.76) => mix(c, f);
const lt = (c, f = 1.3) => mix(c, f);

// ───────────────────────────── pixel tools ─────────────────────────────

function sheet() {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return [c, g];
}
/** A hard-edged painter: every shape lands on whole pixels. */
function brush(g) {
  const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  /** A filled ellipse; `cut` keeps only rows above (negative) or below (positive) a line. */
  const oval = (cx, cy, rx, ry, col, y0 = -99, y1 = 99) => {
    g.fillStyle = col;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      if (y < y0 || y > y1) continue;
      const k = 1 - ((y + 0.5 - cy) / ry) ** 2;
      if (k <= 0) continue;
      const w = Math.round(rx * Math.sqrt(k));
      g.fillRect(Math.round(cx) - w, y, w * 2, 1);
    }
  };
  /** A block with clipped corners and a darker lower edge — the basic "form". */
  const block = (x, y, w, h, col, shade = 3) => {
    r(x + 1, y, w - 2, h, col); r(x, y + 1, w, h - 2, col);
    if (shade) { r(x + 1, y + h - shade, w - 2, shade, dk(col)); r(x, y + h - shade, w, shade - 1, dk(col)); }
  };
  const tri = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  return { r, oval, block, tri };
}
/** Snap soft edges to solid pixels, then ink a two-pixel outline. */
function finish(c, g, ink = INK) {
  const img = g.getImageData(0, 0, SIZE, SIZE), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  g.putImageData(img, 0, 0);
  for (let pass = 0; pass < 2; pass++) {
    const src = g.getImageData(0, 0, SIZE, SIZE).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && src[(y * SIZE + x) * 4 + 3] > 0;
    g.fillStyle = ink;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// ───────────────────────────── adventurers ─────────────────────────────
// Small upright animals: a big head with the species' ears, dot eyes and a pale
// muzzle, on a little body dressed for its class, with a tail behind.

export const SPECIES = ["고양이", "여우", "곰"];
/** Fur colours and the paler colour of the muzzle and belly. */
export const FUR = ["#e8a04c", "#6a6e80", "#f2ead8", "#c8643c", "#8a6248", "#3c3a48"];
export const BELLY = ["#fff4e0", "#f6d8b8", "#d8dce8"];

/** Outfit by armour tier: [main, secondary, trim]. */
const OUTFIT = {
  warrior: [["#c8503e", "#a8b0c0", "#f0cc60"], ["#b06a3e", "#b8c2d2", "#f0cc60"], ["#4a6ec0", "#e2eaf6", "#f6d870"], ["#3a4050", "#7a8498", "#ff6a52"], ["#2a8c9c", "#b6f2f8", "#f6ffff"]],
  rogue: [["#4c5270", "#d85064", "#ecd090"], ["#70584a", "#e88238", "#ecd090"], ["#3a6078", "#62d2c0", "#f0faf4"], ["#30323e", "#f24c6e", "#d0d4e0"], ["#246070", "#84f8e6", "#f6ffff"]],
  ranger: [["#70925a", "#f6eacc", "#d6b46a"], ["#9c7a50", "#faf0d6", "#d6b46a"], ["#567ab0", "#f2f6fc", "#f4d674"], ["#3a3e4a", "#d6dae2", "#ffb850"], ["#2a8a96", "#e8ffff", "#f6ffff"]],
  mage: [["#7e6cdc", "#f6f0ff", "#f8dc80"], ["#b85aa0", "#fff0f8", "#f8dc80"], ["#487ad0", "#eef8ff", "#f8dc80"], ["#3a3662", "#c6b6ff", "#d6b6ff"], ["#289aa4", "#eeffff", "#f6ffff"]],
};

/**
 * One frame of an animal adventurer. `o`: cls, fur, belly, kind (species), at
 * (armour tier), main/sub/trim, and optional apron, band, bone, mask, old.
 * `f`: 0 standing, 1 / 2 the two beats of a hop-walk.
 */
function person(o, back, f) {
  const [c, g] = sheet();
  const b = brush(g);
  const cls = o.cls, robe = cls === "mage" || cls === "robe";
  const fur = o.bone ? "#eef0f6" : o.fur, belly = o.bone ? "#eef0f6" : o.belly, kind = o.bone ? -1 : o.kind;
  const main = o.main, sub = o.sub, trim = o.trim;
  const hop = f === 1 ? 2 : 0, lf = f === 1 ? 2 : 0, rf = f === 2 ? 2 : 0;
  const T = 41 - hop, hy = 27 - hop;

  // ── tail (behind the body from the front, over it from the back)
  const tail = () => {
    if (kind === 0) { b.r(41, 48 - hop, 6, 3, fur); b.r(45, 41 - hop, 3, 9, fur); b.r(46, 38 - hop, 4, 4, fur); }
    else if (kind === 1) { b.oval(46, 46 - hop, 7, 8, fur); b.oval(48, 41 - hop, 4, 4, "#fff8ea"); }
    else if (kind === 2) b.oval(42, 51 - hop, 3, 3, fur);
  };
  if (!back) { tail(); if (cls === "warrior") b.block(20, T, 24, 15, dk(o.cape || main, 0.85), 4); }

  // ── feet
  const paw = dk(fur, 0.84);
  if (robe) { b.block(25, 55 - lf, 6, 4, paw, 1); b.block(33, 55 - rf, 6, 4, paw, 1); }
  else { b.block(24, 53 - lf, 7, 6, paw, 2); b.block(33, 53 - rf, 7, 6, paw, 2); }

  // ── body and outfit
  if (robe) {
    b.tri([[24, T], [40, T], [45, 56], [19, 56]], main);
    b.r(20, 53, 24, 3, dk(main)); b.r(20, 52, 24, 1, trim);
    b.r(24, T + 7, 16, 3, o.sash || trim);
    if (cls === "mage") b.block(21, T - 1, 22, 7, sub, 2);
    if (cls === "mage" && !back) { b.r(30, T + 1, 4, 4, "#8adcf4"); b.r(31, T + 1, 1, 1, "#ffffff"); }
  } else {
    b.block(23, T, 18, 14, main, 4);
    if (!back) b.block(28, T + 1, 8, 8, belly, 0);
    b.r(23, T + 9, 18, 2, "#7a5236"); if (!back) b.r(30, T + 8, 4, 4, trim);
    if (cls === "warrior") { b.block(24, T, 16, 8, sub, 2); if (!back) b.r(30, T + 1, 4, 6, main); }
    else if (cls === "ranger") {
      if (back) { b.block(25, T + 1, 14, 10, "#b08a58", 3); b.r(30, T + 4, 4, 3, trim); }
      else { b.block(23, T, 6, 14, sub, 4); b.block(35, T, 6, 14, sub, 4); }
    } else if (cls === "rogue" && !back) { for (let i = 0; i < 7; i++) b.r(26 + i * 2, T + 1 + i, 3, 2, "#7a5236"); }
    else if (o.apron && !back) b.block(26, T + 2, 12, 13, o.apron, 2);
  }

  // ── arms: fur with little paws
  b.block(18, T + 2 + rf / 2, 6, 9, cls === "warrior" ? dk(main, 0.9) : robe ? main : fur, 0); b.r(18, T + 8 + rf / 2, 6, 4, cls === "warrior" ? sub : belly);
  b.block(40, T + 2 + lf / 2, 6, 9, cls === "warrior" ? dk(main, 0.9) : robe ? main : fur, 0); b.r(40, T + 8 + lf / 2, 6, 4, cls === "warrior" ? sub : belly);
  if (cls === "warrior") { const p = 4 + Math.min(3, o.at); b.oval(21, T + 2, p, p * 0.75, sub); b.oval(43, T + 2, p, p * 0.75, sub); b.r(19, T, 3, 1, lt(sub)); b.r(41, T, 3, 1, lt(sub)); }
  if (cls === "rogue") { b.block(20, T - 3, 24, 6, sub, 2); if (!back) b.block(15, T, 6, 9, sub, 2); }

  // ── ears
  const ear = (x, s) => {
    if (kind === 0) { b.tri([[x - 6 * s, hy - 6], [x - 4 * s, hy - 20], [x + 5 * s, hy - 10]], fur); if (!back) b.tri([[x - 3 * s, hy - 9], [x - 3 * s, hy - 16], [x + 1 * s, hy - 10]], "#f6a8a0"); }
    else if (kind === 1) { b.tri([[x - 7 * s, hy - 5], [x - 5 * s, hy - 23], [x + 6 * s, hy - 10]], fur); b.tri([[x - 5 * s, hy - 17], [x - 5 * s, hy - 23], [x - 1 * s, hy - 16]], "#3c3040"); if (!back) b.tri([[x - 3 * s, hy - 9], [x - 3 * s, hy - 15], [x + 1 * s, hy - 10]], "#fff8ea"); }
    else if (kind === 2) { b.oval(x - 2 * s, hy - 11, 6, 6, fur); if (!back) b.oval(x - 2 * s, hy - 11, 3, 3, dk(fur, 0.8)); }
  };
  ear(22, 1); ear(42, -1);

  // ── head
  b.oval(32, hy, 16, 13, fur);
  if (back) {
    if (!o.bone) b.oval(32, hy + 5, 12, 7, dk(fur, 0.9), hy + 6, 99);
  } else if (o.bone) {
    b.r(23, hy, 6, 7, "#2b2233"); b.r(35, hy, 6, 7, "#2b2233"); b.r(25, hy + 2, 3, 3, o.eye || "#6ae8f4"); b.r(37, hy + 2, 3, 3, o.eye || "#6ae8f4");
    for (let i = 0; i < 4; i++) b.r(26 + i * 3, hy + 10, 2, 3, "#2b2233");
  } else {
    if (kind === 1) { b.tri([[14, hy + 3], [20, hy], [21, hy + 9]], "#fff8ea"); b.tri([[50, hy + 3], [44, hy], [43, hy + 9]], "#fff8ea"); }
    b.oval(32, hy + 6, 9, 6, belly);
    if (o.mask) b.block(18, hy - 3, 28, 9, "#3c3040", 0);
    b.r(23, hy - 1, 4, 6, "#2b2233"); b.r(37, hy - 1, 4, 6, "#2b2233");
    b.r(23, hy - 1, 2, 2, "#ffffff"); b.r(37, hy - 1, 2, 2, "#ffffff");
    b.r(30, hy + 3, 4, 3, "#4a3640"); b.r(31, hy + 6, 2, 2, dk(belly, 0.72));
    b.r(19, hy + 6, 4, 2, "#f6a8a0"); b.r(41, hy + 6, 4, 2, "#f6a8a0");
    if (o.old) { b.r(20, hy - 3, 9, 2, "#eef0f6"); b.r(35, hy - 3, 9, 2, "#eef0f6"); b.block(26, hy + 9, 12, 7, "#eef0f6", 2); }
  }

  // ── headgear, worn between the ears
  if (cls === "warrior" || o.band) {
    b.r(16, hy - 8, 32, 3, o.band || "#e04a4a");
    if (back) { b.r(30, hy - 8, 5, 3, dk(o.band || "#e04a4a")); b.r(33, hy - 5, 3, 7, o.band || "#e04a4a"); }
  }
  if (cls === "ranger") {
    if (back) b.r(16, hy - 8, 32, 3, "#3a3e4a");
    else { b.r(17, hy - 9, 30, 2, "#3a3e4a"); b.block(20, hy - 13, 10, 7, "#3a3e4a", 0); b.block(34, hy - 13, 10, 7, "#3a3e4a", 0); b.r(22, hy - 11, 6, 3, o.at >= 4 ? "#ffd060" : "#8fe8f4"); b.r(36, hy - 11, 6, 3, o.at >= 4 ? "#ffd060" : "#8fe8f4"); b.r(22, hy - 11, 2, 1, "#ffffff"); }
  }
  if (cls === "mage") {
    b.tri([[24, hy - 9], [40, hy - 9], [37, hy - 25], [31, hy - 18]], main);
    b.tri([[35, hy - 25], [44, hy - 21], [39, hy - 17]], main);
    b.oval(32, hy - 9, 14, 4, dk(main, 0.88));
    b.r(25, hy - 13, 14, 2, trim);
    if (!back) { b.r(30, hy - 18, 3, 3, trim); }
  }

  // ── on the back
  if (back) {
    if (cls === "warrior") { b.block(20, T - 1, 24, 17, o.cape || dk(main, 0.85), 4); b.r(26, T + 2, 2, 11, lt(o.cape || main)); }
    if (cls === "rogue") b.block(29, T - 2, 7, 13, sub, 2);
    tail();
  }
  if (o.at >= 5) b.r(23, T + 12, 18, 1, "#bff8ff");
  if (o.acc && !back && !robe) b.r(31, T - 1, 3, 3, o.acc >= 4 ? "#8ff4ff" : o.acc >= 3 ? "#eef0f6" : "#f0b060");
  return finish(c, g);
}

const cache = new Map();
/** `{ front: [3 frames], back: [3 frames] }` for a look. Frames face right. */
export function personSheet(o) {
  const key = JSON.stringify(o);
  let s = cache.get(key);
  if (!s) { s = { front: [0, 1, 2].map((f) => person(o, false, f)), back: [0, 1, 2].map((f) => person(o, true, f)) }; cache.set(key, s); }
  return s;
}
/** `look` is [fur, belly, species] as chosen at creation. */
export function playerLook(cls, look, gear = {}) {
  if (!OUTFIT[cls]) cls = "warrior";
  const at = Math.max(1, Math.min(5, gear.at | 0 || 1));
  const [main, sub, trim] = OUTFIT[cls][at - 1];
  return { cls, fur: FUR[look[0] | 0] || FUR[0], belly: BELLY[look[1] | 0] || BELLY[0], kind: Math.min(2, look[2] | 0), at, main, sub, trim, acc: gear.acc | 0 };
}
export function npcLook(look, role) {
  const col = look[3] || "#667";
  const o = { fur: FUR[look[0] | 0] || FUR[0], belly: BELLY[look[1] | 0] || BELLY[0], kind: (look[0] + look[1]) % 3, main: col, sub: lt(col), trim: "#f0cc60", at: 1 };
  if (role === "elder") return { ...o, cls: "robe", fur: "#d8d4cc", kind: 2, old: 1 };
  if (role === "smith") return { ...o, cls: "npc", kind: 2, apron: "#6a5a52" };
  if (role === "shop") return { ...o, cls: "npc", kind: 0, apron: "#fff4e4" };
  if (role === "train") return { ...o, cls: "npc", kind: 1, band: "#f4ece0" };
  return { ...o, cls: "warrior", at: 3, sub: "#c8d0e0", cape: dk(col, 0.8), band: "#5a7ad0" };
}
export function mobLook(kind) {
  if (kind === "thug") return { cls: "rogue", fur: "#7a7684", belly: "#d8d4dc", kind: 0, mask: 1, at: 2, main: "#5a3040", sub: "#b83a4c", trim: "#d0d0d8" };
  return { cls: "warrior", bone: 1, kind: -1, fur: "#eef0f6", belly: "#eef0f6", at: 3, main: "#4a4868", sub: "#7c7a98", trim: "#6ae8f4", eye: "#6ae8f4", cape: "#2c2a40", band: "#6ae8f4" };
}

// ───────────────────────────── weapons ─────────────────────────────

const METAL = ["#c4c8d2", "#c4c8d2", "#e6ebf4", "#b0cef8", "#86e8f2", "#e8a0fa"];
/**
 * A weapon sprite, drawn pointing right with its grip at `GRIP`.
 * `gear`: wt tier (1–5) · wq rarity (0–3) · we enhancement.
 */
export function weaponSprite(cls, gear = {}) {
  const wt = Math.max(1, Math.min(5, gear.wt | 0 || 1)), wq = gear.wq | 0, we = gear.we | 0;
  const key = `w:${cls}:${wt}:${wq}:${we >= 7 ? 2 : we >= 4 ? 1 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  const [cv, g] = sheet();
  const b = brush(g);
  const m = METAL[wt], y = GRIP[1];
  if (cls === "warrior") {
    const len = 34 + wt * 2, w = 10 + wt;
    b.r(4, y - 2, 12, 4, "#7a5236"); b.r(2, y - 3, 3, 6, "#f0cc60");
    b.block(15, y - w / 2 - 3, 5, w + 6, "#f0cc60", 2);
    b.r(20, y - w / 2, len, w, m); b.tri([[20 + len, y - w / 2], [20 + len + 7, y], [20 + len, y + w / 2]], m);
    b.r(20, y, len + 4, w / 2, dk(m, 0.84)); b.r(22, y - 1, len - 2, 2, wt >= 4 ? "#f6ffff" : lt(m, 1.2));
    if (wt >= 3) b.r(16, y - 2, 3, 4, "#7fe4ee");
  } else if (cls === "rogue") {
    const len = 14 + wt * 2;
    b.r(4, y - 2, 9, 4, "#4a3a44"); b.block(12, y - 5, 3, 10, "#f0cc60", 0);
    b.tri([[15, y - 4], [15 + len, y], [15, y + 4]], m); b.tri([[15, y], [15 + len, y], [15, y + 4]], dk(m, 0.84));
  } else if (cls === "ranger") {
    const len = wt >= 3 ? 30 + wt * 2 : 16 + wt * 3;
    b.tri([[6, y + 1], [12, y + 1], [9, y + 12], [4, y + 11]], "#6a4c38");
    if (wt >= 3) b.block(0, y - 3, 8, 7, "#6a4c38", 2);
    b.block(6, y - 5, len * 0.55, 8, "#4c5060", 3);
    b.r(6 + len * 0.5, y - 3, len * 0.5, wt >= 5 ? 6 : 4, m); b.r(6 + len * 0.5, y - 3, len * 0.5, 1, lt(m));
    if (wt >= 3) b.block(6 + len * 0.3, y + 3, 4, 7, "#3c4050", 0);
    if (wt >= 4) b.r(9, y - 4, len * 0.4, 2, "#8ff4ff");
  } else {
    const gem = ["", "#8ad8f0", "#8ad8f0", "#b6a0ff", "#8ff4ff", "#ff9af0"][wt];
    b.r(2, y - 1, 44, 3, "#9a6e48"); b.r(2, y + 1, 44, 1, "#74502f");
    if (wt >= 3) { b.oval(50, y, 9, 9, m); b.oval(51, y, 6, 6, "#00000000"); g.clearRect(46, y - 5, 9, 10); }
    else b.block(44, y - 4, 6, 8, "#b4885c", 2);
    b.oval(50, y, 5 + wt * 0.4, 5 + wt * 0.4, gem); b.r(48, y - 3, 2, 2, "#ffffff");
  }
  // rare weapons are inked in their rarity's colour
  c = finish(cv, g, [INK, "#2c4a8c", "#8a6a14", "#9a4a12"][wq] || INK);
  cache.set(key, c);
  return c;
}
/** How each class carries its weapon at rest and swings it, in degrees (0 = pointing right, counter-clockwise). */
export const HOLD = {
  warrior: { rest: 58, arc: 200, time: 0.24, reach: 0, style: "sweep" },
  rogue: { rest: -38, arc: 0, time: 0.16, reach: 0.34, style: "stab" },
  ranger: { rest: -8, arc: 0, time: 0.16, reach: -0.12, style: "shoot" },
  mage: { rest: 84, arc: 60, time: 0.3, reach: 0.12, style: "cast" },
};

// ───────────────────────────── monsters ─────────────────────────────

/** Two frames of a monster (the second is its bounce). */
export function monsterSheet(kind) {
  const key = "m:" + kind;
  let s = cache.get(key);
  if (s) return s;
  const draw = (f) => {
    const [c, g] = sheet();
    const b = brush(g);
    const q = f ? 2 : 0; // squash
    const eyes = (x1, x2, y, col = "#2b2233", w = 4, h = 6) => { b.r(x1, y, w, h, col); b.r(x2, y, w, h, col); b.r(x1, y, 2, 2, "#ffffff"); b.r(x2, y, 2, 2, "#ffffff"); };
    if (kind === "slime" || kind === "bslime") {
      const col = kind === "slime" ? "#7ccc68" : "#68a8ec";
      b.oval(32, 44 + q, 17 + q, 14 - q, col); b.r(15 - q, 46 + q, 34 + q * 2, 12 - q, col);
      b.oval(32, 54, 17 + q, 5, dk(col)); b.oval(25, 38 + q, 5, 3, lt(col, 1.5));
      eyes(24, 36, 43 + q);
    } else if (kind === "shroom") {
      b.block(24, 40, 16, 18, "#f2e6cc", 4);
      b.oval(32, 34 + q, 21, 15 - q, "#c84c48", -99, 38 + q); b.r(11, 36 + q, 42, 3, dk("#c84c48"));
      for (const [x, y] of [[20, 26], [32, 22], [43, 28], [26, 32]]) b.oval(x, y + q, 3, 2.5, "#fbf2e0");
      eyes(26, 35, 44, "#2b2233", 3, 5);
    } else if (kind === "boar") {
      b.oval(34, 42 + q, 19, 13 - q, "#8a6648"); b.oval(17, 44 + q, 10, 9, "#8a6648");
      b.block(8, 44 + q, 8, 7, "#d09a94", 2); b.r(40, 28 + q, 16, 4, "#4a3626");
      b.tri([[12, 50 + q], [15, 50 + q], [12, 56 + q]], "#fbf6ea"); b.tri([[18, 50 + q], [21, 50 + q], [19, 56 + q]], "#fbf6ea");
      b.r(17, 40 + q, 4, 4, "#e04848"); b.r(17, 40 + q, 2, 2, "#ffffff");
      b.block(24, 52, 6, 6 - q, "#5a4230", 2); b.block(42, 52, 6, 6 - q, "#5a4230", 2);
    } else if (kind === "bat") {
      const wy = f ? 8 : -6;
      b.tri([[26, 30], [4, 26 + wy], [10, 38 + wy / 2], [22, 38]], "#5a4878"); b.tri([[38, 30], [60, 26 + wy], [54, 38 + wy / 2], [42, 38]], "#5a4878");
      b.oval(32, 32, 9, 10, "#6a5690"); b.tri([[25, 24], [27, 16], [31, 24]], "#6a5690"); b.tri([[39, 24], [37, 16], [33, 24]], "#6a5690");
      eyes(27, 34, 29, "#ff5a5a", 3, 4); b.r(30, 37, 2, 3, "#ffffff"); b.r(33, 37, 2, 3, "#ffffff");
    } else if (kind === "drone") {
      b.block(18, 30, 28, 12, "#7a8294", 4); b.block(24, 40, 16, 6, "#4c5262", 2);
      b.oval(32, 36, 5, 5, "#ff5252"); b.r(30, 33, 2, 2, "#ffffff");
      for (const x of [14, 50]) { b.r(x - 1, 22, 2, 9, "#4c5262"); b.r(x - (f ? 9 : 5), 20, f ? 18 : 10, 3, "#b6c0d0"); }
      b.r(31, 46, 2, 5, "#ffe070");
    } else {
      // the golem family: security robot, crystal golem, rift lord
      const robot = kind === "robot", boss = kind === "boss";
      const [A, glow] = robot ? ["#939aa8", "#ff5a40"] : boss ? ["#6a58b0", "#ff72d6"] : ["#928cae", "#72e6f4"];
      b.block(18, 26 + q, 28, 24 - q, A, 6); b.block(22, 12 + q, 20, 16, A, 4);
      b.block(8, 28 + q, 10, 20, dk(A, 0.86), 4); b.block(46, 28 + q, 10, 20, dk(A, 0.86), 4);
      b.block(20, 48, 9, 10, dk(A, 0.8), 3); b.block(35, 48, 9, 10, dk(A, 0.8), 3);
      b.r(25, 18 + q, 14, 4, glow); b.r(26, 18 + q, 3, 1, "#ffffff");
      b.tri([[32, 30 + q], [38, 37 + q], [32, 44 + q], [26, 37 + q]], glow);
      if (!robot) for (const [x, y, h] of [[12, 26, 9], [52, 26, 9], [32, 12, boss ? 12 : 7], [25, 13, boss ? 8 : 0], [39, 13, boss ? 8 : 0]]) if (h) b.tri([[x - 3, y + q], [x, y - h + q], [x + 3, y + q]], glow);
    }
    return finish(c, g);
  };
  s = [draw(0), draw(1)];
  cache.set(key, s);
  return s;
}
/** How big each monster is drawn, in tiles per 64 pixels, and how high it floats. */
export const MOB_SIZE = { slime: [1.5, 0], bslime: [1.6, 0], shroom: [1.7, 0], boar: [2, 0], bat: [1.7, 0.7], drone: [1.7, 0.9], robot: [2.4, 0], golem: [2.8, 0], boss: [5.2, 0] };
