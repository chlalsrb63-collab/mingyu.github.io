/**
 * Pixel sprites: people, monsters and weapons, each on a 32×32 sheet.
 *
 * The adventurers are small white animals — cats, foxes and bears — carrying
 * weapons as big as they are, and wearing nothing else. The style is as simple as it can be: a big face on a tiny
 * body with no arms or legs, dot eyes, flat colours with one shadow tone and a
 * dark outline, so a figure reads instantly at any size. Weapons are separate sprites drawn
 * pointing right from their grip, because in play they are not animation
 * frames: the weapon itself is swung around the hand.
 *
 * People have two views (front, back; mirrored for left and right) and three
 * frames each: 0 standing, 1 and 2 the two steps of a walk.
 */

/** Every sheet is 32×32. Weapons and monsters are drawn at twice that and halved. */
export const SIZE = 32;
const S = 32, BIG = 64;
/** Where the feet touch the ground, and the grip a weapon pivots on. */
export const FOOT = [16, 29];
export const GRIP = [5, 16];
const INK = "#2b2233";

function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const dk = (c, f = 0.76) => mix(c, f);
const lt = (c, f = 1.3) => mix(c, f);

// ───────────────────────────── pixel tools ─────────────────────────────

function sheet(n = BIG) {
  const c = document.createElement("canvas");
  c.width = c.height = n;
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
/** Halve a 64-pixel drawing to the 32-pixel sheet (its outline thins to one pixel). */
function half(src) {
  const [c, g] = sheet(S);
  g.drawImage(src, 0, 0, S, S);
  return c;
}
/** Snap soft edges to solid pixels, then ink an outline `passes` pixels thick. */
function finish(c, g, ink = INK, passes = 2) {
  const SIZE = c.width;
  const img = g.getImageData(0, 0, SIZE, SIZE), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  g.putImageData(img, 0, 0);
  for (let pass = 0; pass < passes; pass++) {
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
// Small animals drawn on a 32×32 sheet and kept as simple as they can be: a big
// face with the species' ears, a little body in the class's colours, a tail —
// and no arms or legs. The weapon floats at their side.

export const SPECIES = ["고양이", "여우", "곰"];
/** Fur colours and the paler colour of the muzzle. */
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
 * One frame of an adventurer. `o`: cls, fur, belly, kind (species), at (armour
 * tier), main/sub/trim, and optional apron, band, bone, mask, old.
 * `f`: 0 standing, 1 the top of a hop, 2 the landing.
 */
function person(o, back, f) {
  const [c, g] = sheet(S);
  const b = brush(g);
  const cls = o.cls;
  const fur = o.bone ? "#eef0f6" : o.fur, belly = o.bone ? "#eef0f6" : o.belly, kind = o.bone ? -1 : o.kind;
  const main = o.main, sub = o.sub, trim = o.trim;
  const up = f === 1 ? 2 : 0, sq = f === 2 ? 1 : 0;   // hop, then squash
  const hy = 14 - up + sq, by = 21 - up + sq, bh = 8 - sq;

  const tail = () => {
    if (kind === 0) { b.r(20, by + 5, 3, 1, fur); b.r(22, by + 1, 1, 4, fur); b.r(23, by, 1, 2, fur); }
    else if (kind === 1) { b.oval(23, by + 3, 3, 3.5, fur); }
    else if (kind === 2) b.r(21, by + 5, 2, 2, fur);
  };
  if (!back) { tail(); if (cls === "warrior") b.r(9, by + 1, 14, bh - 2, dk(o.cape || main, 0.85)); }

  // ── body: a small rounded lump in the class's colours
  b.r(12, by, 8, bh, main); b.r(11, by + 1, 10, bh - 2, main);
  b.r(11, by + bh - 3, 10, 2, dk(main)); b.r(12, by + bh - 1, 8, 1, dk(main));
  if (!back) {
    if (cls === "warrior") { b.r(12, by + 1, 8, 3, sub); b.r(15, by + 1, 2, 4, main); }
    else if (cls === "ranger") { b.r(14, by + 1, 4, bh - 3, sub); }
    else if (cls === "mage" || cls === "robe") { b.r(15, by + 1, 2, bh - 2, trim); if (cls === "mage") b.r(15, by + 1, 2, 2, "#8adcf4"); }
    else if (cls === "rogue") { b.r(13, by + 3, 6, 1, "#7a5236"); }
    else if (o.apron) b.r(13, by + 2, 6, bh - 3, o.apron);
    if (cls !== "mage" && cls !== "robe" && !o.apron) b.r(15, by + bh - 4, 2, 2, trim);
  } else if (cls === "ranger") b.r(13, by + 1, 6, 4, "#b08a58");
  if (cls === "mage" || cls === "robe") b.r(11, by + bh - 2, 10, 1, trim);
  if (o.at >= 5) b.r(12, by + bh - 1, 8, 1, "#bff8ff");

  // ── ears
  const ear = (x, s) => {
    if (kind === 0) { b.tri([[x - 3 * s, hy - 4], [x - 2 * s, hy - 12], [x + 3 * s, hy - 7]], fur); if (!back) b.r(x - (s > 0 ? 1 : 0), hy - 8, 1, 2, "#f6a8a0"); }
    else if (kind === 1) { b.tri([[x - 4 * s, hy - 3], [x - 3 * s, hy - 14], [x + 3 * s, hy - 7]], fur); if (!back) b.r(x - (s > 0 ? 1 : 0), hy - 9, 1, 3, "#f6a8a0"); }
    else if (kind === 2) { b.oval(x - 1 * s, hy - 7, 3, 3, fur); if (!back) b.r(x - (s > 0 ? 2 : -1), hy - 8, 2, 2, "#f6a8a0"); }
  };
  ear(10, 1); ear(22, -1);

  // ── the big face
  b.oval(16, hy, 10, 8, fur);
  if (back) {
    if (!o.bone) b.oval(16, hy + 3, 7, 4, dk(fur, 0.9));
  } else if (o.bone) {
    b.r(11, hy - 1, 3, 4, "#2b2233"); b.r(18, hy - 1, 3, 4, "#2b2233"); b.r(12, hy, 1, 2, o.eye || "#6ae8f4"); b.r(19, hy, 1, 2, o.eye || "#6ae8f4");
    b.r(13, hy + 5, 1, 2, "#2b2233"); b.r(15, hy + 5, 1, 2, "#2b2233"); b.r(17, hy + 5, 1, 2, "#2b2233"); b.r(19, hy + 5, 1, 2, "#2b2233");
  } else {
    if (kind === 1) { b.r(5, hy + 1, 3, 3, fur); b.r(24, hy + 1, 3, 3, fur); }
    b.oval(16, hy + 4, 5, 3, belly);
    if (o.mask) b.r(8, hy - 2, 16, 4, "#3c3040");
    b.r(11, hy - 1, 2, 3, "#2b2233"); b.r(19, hy - 1, 2, 3, "#2b2233");
    b.r(11, hy - 1, 1, 1, "#ffffff"); b.r(19, hy - 1, 1, 1, "#ffffff");
    b.r(15, hy + 2, 2, 1, "#4a3640");
    b.r(8, hy + 3, 2, 1, "#f6a8a0"); b.r(22, hy + 3, 2, 1, "#f6a8a0");
    if (o.old) { b.r(10, hy - 3, 4, 1, "#eef0f6"); b.r(18, hy - 3, 4, 1, "#eef0f6"); b.r(13, hy + 5, 6, 3, "#eef0f6"); }
  }

  // ── what marks the class: a band, a scarf, goggles, a hat
  if (cls === "warrior" || o.band) { b.r(7, hy - 5, 18, 2, o.band || "#e04a4a"); if (back) b.r(17, hy - 3, 2, 4, o.band || "#e04a4a"); }
  if (cls === "rogue") { b.r(9, by - 1, 14, 3, sub); b.r(9, by + 1, 14, 1, dk(sub)); if (back) b.r(16, by + 2, 3, 5, sub); else b.r(8, by + 2, 3, 4, sub); }
  if (cls === "ranger") {
    b.r(7, hy - 5, 18, 1, "#3a3e4a");
    if (!back) { const lens = o.at >= 4 ? "#ffd060" : "#8fe8f4"; b.r(10, hy - 7, 5, 4, "#3a3e4a"); b.r(17, hy - 7, 5, 4, "#3a3e4a"); b.r(11, hy - 6, 3, 2, lens); b.r(18, hy - 6, 3, 2, lens); }
  }
  if (cls === "mage") {
    b.tri([[11, hy - 5], [21, hy - 5], [19, hy - 14], [16, hy - 10]], main);
    b.r(18, hy - 14, 4, 2, main); b.r(21, hy - 13, 2, 2, main);
    b.r(9, hy - 6, 14, 2, dk(main, 0.88));
    b.r(12, hy - 8, 8, 1, trim);
  }
  if (back) { if (cls === "warrior") { b.r(10, by, 12, bh - 1, o.cape || dk(main, 0.85)); b.r(12, by + 1, 1, bh - 3, lt(o.cape || main)); } tail(); }
  if (o.acc && !back) b.r(15, by, 2, 1, o.acc >= 4 ? "#8ff4ff" : o.acc >= 3 ? "#eef0f6" : "#f0b060");
  return finish(c, g, INK, 1);
}

const cache = new Map();
/** `{ front: [3 frames], back: [3 frames] }` for a look. Frames face right. */
export function personSheet(o) {
  const key = JSON.stringify(o);
  let s = cache.get(key);
  if (!s) { s = { front: [0, 1, 2].map((f) => person(o, false, f)), back: [0, 1, 2].map((f) => person(o, true, f)) }; cache.set(key, s); }
  return s;
}
const WHITE = "#fbfbff";
/** A plain look: one colour of fur, no costume — just eyes, blush and a nose. */
const plain = (kind, fur = WHITE) => ({ cls: "plain", kind, fur, belly: fur, main: fur, sub: fur, trim: fur, at: 1 });
/**
 * Players are plain white animals; `look[2]` picks the species. What they
 * carry — the weapon — is what tells the classes apart.
 */
export function playerLook(cls, look) {
  return plain(Math.min(2, look[2] | 0));
}
/** Townsfolk are the same simple animals in soft tints, so they read as not-you. */
export function npcLook(look, role) {
  if (role === "elder") return plain(2, "#e2e4f0");
  if (role === "smith") return plain(2, "#e6d2bc");
  if (role === "shop") return plain(0, "#ffe6d2");
  if (role === "train") return plain(1, "#f6dcdc");
  return plain(1, "#dce8f6");
}
export function mobLook(kind) {
  if (kind === "thug") return { ...plain(0, "#7a7684"), mask: 1 };
  return { cls: "plain", bone: 1, kind: -1, fur: "#eef0f6", belly: "#eef0f6", at: 1, main: "#4a4868", sub: "#7c7a98", trim: "#4a4868", eye: "#6ae8f4" };
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
  const m = METAL[wt], y = 32;
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
  c = half(finish(cv, g, [INK, "#2c4a8c", "#8a6a14", "#9a4a12"][wq] || INK));
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
    return half(finish(c, g));
  };
  s = [draw(0), draw(1)];
  cache.set(key, s);
  return s;
}
/** Per monster: how many times its sheet is enlarged, and how many pixels it floats. */
export const MOB_SIZE = { slime: [1, 0], bslime: [1, 0], shroom: [1, 0], boar: [1, 0], bat: [1, 12], drone: [1, 16], robot: [1, 0], golem: [2, 0], boss: [3, 0] };
