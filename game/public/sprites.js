/**
 * Pixel sprites: people, monsters and weapons, each on a 32×32 sheet.
 *
 * The adventurers are small animals carrying weapons as big as they are. Their
 * ears, eyes, nose, colour, blush, markings and tunic are chosen at creation. The style is as simple as it can be: a big face on a tiny
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
// Small animals that fit a 16×16 box on the 32×32 sheet: a boxy head, ears
// above it, and a tiny body with no arms or legs. Nothing is worn on the head;
// a face is just eyes, a nose and a blush. Every part is chosen at creation.

/** What can be chosen at creation, in the order `look` stores it. */
export const PARTS = [
  { key: "ear", label: "귀", names: ["고양이", "토끼", "곰", "여우", "강아지", "쥐"] },
  { key: "eye", label: "눈", names: ["점 눈", "긴 눈", "큰 눈", "웃는 눈", "졸린 눈", "파란 눈"] },
  { key: "nose", label: "코", names: ["작은 코", "분홍 코", "ㅅ 입", "큰 코", "없음"] },
  { key: "fur", label: "색상", colors: ["#fbfbff", "#fff0d8", "#ffd9c2", "#ffd0dc", "#e2d6ff", "#cfe6ff", "#cff2dc", "#ffeaa0", "#b9bdca", "#b98b68"] },
  { key: "blush", label: "볼", names: ["분홍", "빨강", "주황", "없음"] },
  { key: "pat", label: "무늬", names: ["없음", "눈 얼룩", "줄무늬", "포인트"] },
  { key: "cloth", label: "옷", colors: [null, "#5a8ae0", "#e0605a", "#5ab87a", "#9a78e0", "#f0c050"] },
];
const BLUSH = ["#f6a8a0", "#f07882", "#f8ba7c", null];
const PINK = "#f6a8a0", DARK = "#2b2233";

/**
 * One frame of an adventurer. `o`: ear, eye, nose, fur (a colour), blush (a
 * colour or null), pat, cloth (a colour or null), and for monsters mask / bone.
 * `f`: 0 standing, 1 the top of a hop, 2 the landing.
 */
function person(o, back, f) {
  // The whole animal fits a 16×16 box (outline included) standing on the sheet's
  // foot line: three rows of ear, a seven-row head twelve pixels wide, and a
  // four-row body. At this size every pixel is a decision, so there are few.
  const [c, g] = sheet(S);
  const b = brush(g);
  const fur = o.bone ? "#eef0f6" : o.fur, sh = dk(fur, 0.82), pat = o.pat | 0;
  const H = f === 1 ? -1 : f === 2 ? 1 : 0;                 // the head bobs with the hop
  const by = 24 + H, bh = f === 2 ? 3 : 4;                  // the body squashes on landing
  const r = (x, y, w, h, col) => b.r(x, y + H, w, h, col);
  /** The same block on both sides of the face. */
  const both = (x, y, w, h, col, colR = col) => { r(x, y, w, h, col); r(32 - x - w, y, w, h, colR); };

  // ── tail
  const tc = pat === 3 ? sh : fur;
  if (!o.bone) [
    () => { b.r(19, by + 2, 2, 1, tc); b.r(20, by, 1, 2, tc); },
    () => b.r(19, by + 1, 2, 2, tc),
    () => b.r(19, by + 2, 1, 1, tc),
    () => { b.r(19, by, 3, 3, tc); },
    () => { b.r(19, by + 1, 1, 1, tc); b.r(20, by, 1, 1, tc); },
    () => { b.r(19, by + bh - 1, 3, 1, tc); b.r(21, by + bh - 2, 1, 1, tc); },
  ][o.ear | 0]();

  // ── body: a tiny lump, optionally in a plain tunic
  const cloth = o.bone ? "#4a4868" : o.cloth;
  b.r(13, by, 6, bh, fur);
  if (cloth) b.r(13, by, 6, bh - 1, cloth);
  else b.r(13, by, 6, 1, dk(fur, 0.92));

  // ── ears: three rows above the head
  const eL = pat === 3 ? sh : fur, eR = pat === 3 || pat === 1 ? sh : fur;
  if (!o.bone) [
    () => { both(10, 16, 3, 1, eL, eR); both(10, 15, 2, 1, eL, eR); both(10, 14, 1, 1, eL, eR); },
    () => { both(11, 14, 2, 3, eL, eR); },
    () => { both(10, 15, 3, 2, eL, eR); },
    () => { both(10, 16, 4, 1, eL, eR); both(10, 15, 3, 1, eL, eR); both(10, 14, 2, 1, eL, eR); },
    () => {},                                               // floppy ears hang over the head: drawn after it
    () => { both(9, 14, 3, 3, eL, eR); if (!back) both(10, 15, 1, 1, PINK); },
  ][o.ear | 0]();

  // ── head
  r(11, 17, 10, 7, fur); r(10, 18, 12, 5, fur);
  if (o.ear === 4 && !o.bone) { const d = pat === 3 ? dk(fur, 0.68) : sh; both(9, 17, 2, 5, d, pat === 1 ? dk(fur, 0.68) : d); }
  if (pat === 2) { r(15, 17, 2, 2, sh); both(12, 17, 1, 1, sh); }

  if (back) return finish(c, g, INK, 1);

  if (o.bone) {
    both(12, 19, 2, 2, DARK); both(12, 20, 1, 1, o.glow || "#6ae8f4");
    r(13, 22, 1, 1, DARK); r(15, 22, 1, 1, DARK); r(17, 22, 1, 1, DARK); r(18, 22, 1, 1, DARK);
    return finish(c, g, INK, 1);
  }

  // ── face: eyes, a nose, a blush — nothing else
  if (pat === 1) r(17, 18, 4, 4, sh);
  if (o.mask) { r(10, 19, 12, 2, "#3c3040"); both(12, 20, 1, 1, "#ffffff"); }
  else [
    () => both(12, 19, 1, 2, DARK),
    () => both(12, 18, 1, 3, DARK),
    () => both(12, 19, 2, 2, DARK),
    () => { both(11, 20, 1, 1, DARK); both(12, 19, 1, 1, DARK); both(13, 20, 1, 1, DARK); },
    () => both(12, 20, 2, 1, DARK),
    () => { both(12, 19, 2, 1, DARK); both(12, 20, 2, 1, "#4a90e0"); },
  ][o.eye | 0]();
  [
    () => r(15, 21, 2, 1, "#4a3640"),
    () => r(15, 21, 2, 1, "#f08a9a"),
    () => { r(15, 21, 2, 1, "#4a3640"); both(14, 22, 1, 1, "#4a3640"); },
    () => r(15, 21, 2, 2, "#4a3640"),
    () => {},
  ][o.nose | 0]();
  if (o.blush) both(10, 21, 2, 1, o.blush);
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
/** `look` is the list of choices, one per entry of PARTS. The class shows only in the weapon. */
export function playerLook(cls, look = []) {
  const at = (i) => { const p = PARTS[i], n = (p.names || p.colors).length; return Math.max(0, Math.min(n - 1, look[i] | 0)); };
  return { ear: at(0), eye: at(1), nose: at(2), fur: PARTS[3].colors[at(3)], blush: BLUSH[at(4)], pat: at(5), cloth: PARTS[6].colors[at(6)] };
}
/** Townsfolk wear a tunic in their trade's colour. */
export function npcLook(look, role) {
  if (role === "elder") return { ear: 1, eye: 4, nose: 0, fur: "#e6e6f0", blush: PINK, pat: 0, cloth: "#5a6ac0" };
  if (role === "smith") return { ear: 2, eye: 0, nose: 3, fur: "#c89a74", blush: null, pat: 0, cloth: "#6a5a52" };
  if (role === "shop") return { ear: 0, eye: 3, nose: 1, fur: "#ffe6d2", blush: PINK, pat: 0, cloth: "#e07a8a" };
  if (role === "train") return { ear: 3, eye: 1, nose: 0, fur: "#f6c890", blush: PINK, pat: 3, cloth: "#b84a4a" };
  return { ear: 4, eye: 0, nose: 3, fur: "#f0e0c8", blush: PINK, pat: 0, cloth: "#5e6a88" };
}
export function mobLook(kind) {
  if (kind === "thug") return { ear: 0, eye: 0, nose: 4, fur: "#8a8694", blush: null, pat: 0, cloth: "#6a3040", mask: 1 };
  return { bone: 1, ear: 0, fur: "#eef0f6" };
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
