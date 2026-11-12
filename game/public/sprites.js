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

/** Blend two colours: `t` of the way from `a` to `b`. */
function blend(a, b, t) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
/** Shadows lean toward violet instead of grey, so white fur stays clean. */
const shade = (c, t = 0.16) => blend(c, "#6a5a96", t);

/** Frames of a person sheet. */
export const FRAME = { stand: 0, breathe: 1, stepA: 2, stretch: 3, stepB: 4, blink: 5 };

/**
 * One frame of an adventurer, inside a 16×16 box standing on the foot line:
 * four rows of ear, a six-row head twelve pixels wide, and a four-row body on
 * two one-pixel feet. `view` is "front", "side" (a three-quarter turn to the
 * right) or "back"; `f` is one of FRAME.
 *
 * `o`: ear, eye, nose, fur (a colour), blush (a colour or null), pat, cloth (a
 * colour or null), and for monsters mask / bone.
 */
function person(o, view, f) {
  const [c, g] = sheet(S);
  const b = brush(g);
  const side = view === "side", back = view === "back";
  const fur = o.bone ? "#eef0f6" : o.fur, soft = shade(fur), deep = shade(fur, 0.32), pat = o.pat | 0;
  const H = f === FRAME.breathe ? 1 : f === FRAME.stretch ? -1 : 0;   // the head sinks on a breath, lifts mid-stride
  const r = (x, y, w, h, col) => b.r(x, y + H, w, h, col);
  /** The same block on both sides of the face. */
  const both = (x, y, w, h, col, colR = col) => { r(x, y, w, h, col); r(32 - x - w, y, w, h, colR); };
  /** A block behind the body: on the right from the front, trailing on the left in a turn. */
  const behind = (x, y, w, h, col) => b.r(side ? 32 - x - w : x, y, w, h, col);

  // ── tail
  const tc = pat === 3 ? deep : fur;
  if (!o.bone) [
    () => { behind(19, 26, 2, 1, tc); behind(20, 24, 1, 2, tc); },
    () => behind(19, 25, 2, 2, tc),
    () => behind(19, 26, 1, 1, tc),
    () => { behind(19, 24, 3, 3, tc); behind(21, 24, 1, 1, pat === 3 ? fur : soft); },
    () => { behind(19, 25, 1, 1, tc); behind(20, 24, 1, 1, tc); },
    () => { behind(19, 26, 3, 1, tc); behind(21, 25, 1, 1, tc); },
  ][o.ear | 0]();

  // ── body: a tiny lump on two feet; a step lifts one of them
  const bt = 24 + H, cloth = o.bone ? "#4a4868" : o.cloth;
  b.r(13, bt, 6, 27 - bt, fur);
  if (f !== FRAME.stepB) b.r(13, 27, 2, 1, fur);
  if (f !== FRAME.stepA) b.r(17, 27, 2, 1, fur);
  if (cloth) {
    b.r(13, bt, 6, 26 - bt, cloth); b.r(13, 25, 6, 1, shade(cloth, 0.3));
    if (!back && !o.bone) b.r(side ? 16 : 15, bt, 2, 1, lt(cloth, 1.45));
  } else b.r(13, bt, 6, 1, soft);

  // ── ears: four rows above the head, pink inside
  const eL = pat === 3 ? deep : fur, eR = pat === 3 || pat === 1 ? deep : fur;
  const pink = (x, y, w, h) => { if (!back) both(x, y, w, h, PINK); };
  if (!o.bone) [
    () => { both(10, 17, 4, 1, eL, eR); both(10, 16, 3, 1, eL, eR); both(10, 15, 2, 1, eL, eR); both(10, 14, 1, 1, eL, eR); pink(11, 16, 1, 2); },
    () => { both(11, 14, 3, 4, eL, eR); pink(12, 15, 1, 3); },
    () => { both(9, 16, 3, 2, eL, eR); both(10, 15, 2, 1, eL, eR); pink(10, 16, 1, 1); },
    () => { both(9, 17, 5, 1, eL, eR); both(9, 16, 4, 1, eL, eR); both(9, 15, 3, 1, eL, eR); both(9, 14, 2, 1, eL, eR); pink(10, 16, 1, 2); },
    () => {},                                               // floppy ears hang over the head: drawn after it
    () => { both(9, 15, 4, 2, eL, eR); both(10, 14, 2, 1, eL, eR); both(10, 17, 3, 1, eL, eR); pink(10, 15, 2, 2); },
  ][o.ear | 0]();

  // ── head
  r(11, 18, 10, 6, fur); r(10, 19, 12, 4, fur);
  if (o.ear === 4 && !o.bone) { const d = pat === 3 ? shade(fur, 0.46) : deep; both(10, 17, 2, 1, d, pat === 1 ? shade(fur, 0.46) : d); both(9, 18, 2, 5, d, pat === 1 ? shade(fur, 0.46) : d); }
  if (pat === 2) { r(15, 18, 2, 2, deep); both(12, 18, 1, 1, deep); }

  if (back) return finish(c, g, INK, 1);

  // the face turns with the body: in a three-quarter view everything slides toward the far cheek
  const lx = side ? 14 : 12, rx1 = side ? 20 : 19, rx2 = side ? 19 : 18, nx = side ? 17 : 15;
  const eyes = (w, y, h, col) => { r(lx, y, w, h, col); r(w === 1 ? rx1 : rx2, y, w, h, col); };

  if (o.bone) {
    eyes(2, 20, 2, DARK); r(lx, 21, 1, 1, o.glow || "#6ae8f4"); r(rx2, 21, 1, 1, o.glow || "#6ae8f4");
    r(nx - 1, 23, 1, 1, DARK); r(nx + 1, 23, 1, 1, DARK); r(nx + 3, 23, 1, 1, DARK);
    return finish(c, g, INK, 1);
  }

  // ── face: eyes, a nose, a blush — nothing else
  if (pat === 1) r(side ? 18 : 17, 19, 4, 4, deep);
  if (o.mask) { r(10, 20, 12, 2, "#3c3040"); eyes(1, 21, 1, "#ffffff"); }
  else if (f === FRAME.blink && o.eye !== 3) eyes(2, 21, 1, DARK);
  else [
    () => eyes(1, 20, 2, DARK),
    () => eyes(1, 19, 3, DARK),
    () => { eyes(2, 20, 2, DARK); r(lx, 20, 1, 1, "#ffffff"); r(rx2, 20, 1, 1, "#ffffff"); },
    () => { for (const x of [lx - 1, rx2]) { r(x, 21, 1, 1, DARK); r(x + 1, 20, 1, 1, DARK); r(x + 2, 21, 1, 1, DARK); } },
    () => eyes(2, 21, 1, DARK),
    () => { eyes(2, 20, 1, DARK); eyes(2, 21, 1, "#4a90e0"); },
  ][o.eye | 0]();
  [
    () => r(nx, 22, 2, 1, "#4a3640"),
    () => r(nx, 22, 2, 1, "#f08a9a"),
    () => { r(nx, 22, 2, 1, "#4a3640"); r(nx - 1, 23, 1, 1, "#4a3640"); r(nx + 2, 23, 1, 1, "#4a3640"); },
    () => r(nx, 22, 2, 2, "#4a3640"),
    () => {},
  ][o.nose | 0]();
  if (o.blush) { if (side) { r(12, 22, 2, 1, o.blush); r(21, 22, 1, 1, o.blush); } else both(10, 22, 2, 1, o.blush); }
  return finish(c, g, INK, 1);
}

let fireFrames = null;
/** A campfire — crossed logs in a ring of stones, the flame flickering through three frames. Stands on the foot line. */
export function campfire() {
  if (fireFrames) return fireFrames;
  fireFrames = [0, 1, 2].map((f) => {
    const [c, g] = sheet(S);
    const b = brush(g);
    b.r(9, 26, 14, 2, "#8a8e9c"); b.r(8, 25, 3, 2, "#a4a8b6"); b.r(21, 25, 3, 2, "#a4a8b6"); b.r(13, 27, 6, 1, "#6e7280");
    b.r(10, 23, 12, 3, "#7a5230"); b.r(11, 22, 4, 2, "#94683c"); b.r(17, 22, 4, 2, "#5e3e22"); b.r(10, 24, 2, 1, "#c89a5a"); b.r(20, 24, 2, 1, "#c89a5a");
    const tip = [0, -1, 1][f], lean = [0, 1, -1][f];
    b.r(12, 17, 8, 6, "#f0702a"); b.r(13, 14 + (f === 1 ? 1 : 0), 6, 4, "#f0702a"); b.r(14 + lean, 11 + tip, 4, 4, "#f0702a"); b.r(15 + lean, 9 + tip, 2, 2, "#f0702a");
    b.r(13, 18, 6, 5, "#ffb030"); b.r(14, 15, 4, 4, "#ffb030"); b.r(15 + lean, 13 + tip, 2, 3, "#ffb030");
    b.r(14, 20, 4, 3, "#fff0a0"); b.r(15, 18, 2, 2, "#fff0a0");
    return finish(c, g, INK, 1);
  });
  return fireFrames;
}

const cache = new Map();
/** `{ front, side, back }`, each a list of frames indexed by FRAME. Side frames face right. */
export function personSheet(o) {
  const key = JSON.stringify(o);
  let s = cache.get(key);
  if (!s) {
    const frames = (view) => [0, 1, 2, 3, 4, 5].map((f) => person(o, view, f));
    s = { front: frames("front"), side: frames("side"), back: frames("back") };
    cache.set(key, s);
  }
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
const GEM = ["#8ad8f0", "#8ad8f0", "#8ad8f0", "#b6a0ff", "#8ff4ff", "#ff9af0"];
const COVER = ["#8a5a3a", "#8a5a3a", "#3f6ab0", "#7a48b0", "#2a8a96", "#b03a6a"];
const GOLD = "#f0cc60";
const RARE_INK = [INK, "#2c4a8c", "#8a6a14", "#9a4a12", "#1f6a3a"];

/** The weapon each class starts with; a mage may also carry a `book`. */
export const WEAPON_OF = { warrior: "sword", rogue: "dagger", lancer: "spear", ranger: "spear", mage: "staff" };
/** The kind of weapon to draw: what the gear says, else the class's own. */
export function weaponKind(cls, gear = {}) {
  return HOLD[gear && gear.wk] ? gear.wk : WEAPON_OF[cls] || "sword";
}

/**
 * A weapon sprite. Swords, daggers, spears and staves point right with the
 * grip at `GRIP`; a book is drawn open and upright around the sheet's centre.
 * `kind`: sword · dagger · spear · staff · book (a class id is accepted too).
 * `gear`: wt tier (1–5) · wq rarity (0–4) · we enhancement.
 */
export function weaponSprite(kind, gear = {}) {
  if (!HOLD[kind]) kind = weaponKind(kind, gear);
  const wt = Math.max(1, Math.min(5, gear.wt | 0 || 1)), wq = Math.max(0, Math.min(4, gear.wq | 0));
  const key = `w:${kind}:${wt}:${wq}`;
  let c = cache.get(key);
  if (c) return c;
  const [cv, g] = sheet(kind === "spear" ? 48 : S);
  const b = brush(g);
  const m = METAL[wt], y = GRIP[1];
  if (kind === "sword") {
    const len = 14 + wt, wide = wt >= 4 ? 1 : 0;
    b.r(1, y - 1, 2, 3, GOLD); b.r(3, y - 1, 5, 3, "#7a5236"); b.r(4, y - 1, 1, 3, "#5a3a26"); b.r(6, y - 1, 1, 3, "#5a3a26");
    b.r(8, y - 4 - wide, 2, 9 + wide * 2, GOLD); b.r(8, y + 3 + wide, 2, 2, shade(GOLD, 0.3));
    b.r(10, y - 2 - wide, len, 5 + wide * 2, m);
    b.r(10 + len, y - 1, 1, 3, m); b.r(11 + len, y, 1, 1, m);
    b.r(10, y - 2 - wide, len, 1, lt(m, 1.25)); b.r(10, y + 1, len + 1, 2 + wide, shade(m, 0.24));
    b.r(11, y, len - 2, 1, wt >= 4 ? "#f6ffff" : shade(m, 0.12));
    if (wt >= 3) b.r(8, y, 2, 1, GEM[wt]);
  } else if (kind === "dagger") {
    const len = 5 + wt;
    b.r(2, y - 1, 1, 3, GOLD); b.r(3, y - 1, 4, 3, "#4a3a44"); b.r(7, y - 3, 1, 7, GOLD);
    b.r(8, y - 1, len, 3, m); b.r(8 + len, y, 1, 1, m);
    b.r(8, y - 1, len, 1, lt(m, 1.25)); b.r(8, y + 1, len, 1, shade(m, 0.24));
    if (wt >= 4) b.r(9, y, len - 2, 1, GEM[wt]);
  } else if (kind === "spear") {
    const xs = 29 + wt;                                          // where the shaft ends and the head begins
    b.r(0, y, xs, 1, "#9a6e48"); b.r(0, y - 1, 2, 3, "#6a7080");
    b.r(xs - 4, y + 1, 2, 3, wt >= 4 ? GEM[wt] : "#e0564a"); b.r(xs - 3, y + 4, 1, 1, wt >= 4 ? GEM[wt] : "#e0564a");
    b.r(xs, y - 1, 2, 3, GOLD);
    if (wt >= 3) b.r(xs + 1, y - 4, 1, 9, m);
    b.r(xs + 2, y - 2, 3, 5, m); b.r(xs + 5, y - 1, 3, 3, m); b.r(xs + 8, y, 2, 1, m);
    b.r(xs + 2, y - 2, 3, 1, lt(m, 1.25)); b.r(xs + 5, y - 1, 3, 1, lt(m, 1.25));
    b.r(xs + 2, y + 1, 3, 2, shade(m, 0.24)); b.r(xs + 5, y + 1, 3, 1, shade(m, 0.24));
  } else if (kind === "staff") {
    const gem = GEM[wt];
    b.r(1, y, 20, 1, "#9a6e48"); b.r(1, y, 2, 1, "#6a4a30");
    // a wooden crook, or from tier 3 a metal cradle, holding the gem
    if (wt >= 3) { b.r(20, y - 3, 1, 7, m); b.r(21, y - 4, 3, 1, m); b.r(21, y + 4, 3, 1, m); b.r(24, y - 5, 1, 1, m); b.r(24, y + 5, 1, 1, m); }
    else b.r(20, y - 2, 2, 5, "#7a5236");
    b.r(22, y - 2, 5, 5, gem); b.r(23, y - 3, 3, 7, gem); b.r(27, y - 1, 1, 3, gem);
    b.r(23, y - 2, 1, 1, "#ffffff"); b.r(24, y + 1, 3, 2, shade(gem, 0.26)); b.r(23, y + 3, 3, 1, shade(gem, 0.26));
  } else {
    // an open book, seen from the front
    const cover = COVER[wt], page = "#fff8e8";
    b.r(8, 13, 16, 9, cover); b.r(8, 21, 16, 1, shade(cover, 0.3));
    b.r(9, 12, 6, 9, page); b.r(17, 12, 6, 9, page);
    b.r(14, 12, 1, 9, "#e2d6c0"); b.r(17, 12, 1, 9, "#e2d6c0"); b.r(15, 12, 2, 10, shade(cover, 0.3));
    b.r(10, 14, 3, 1, "#b8a890"); b.r(10, 16, 4, 1, "#b8a890"); b.r(10, 18, 3, 1, "#b8a890");
    b.r(19, 14, 3, 1, GEM[wt]); b.r(20, 15, 1, 2, GEM[wt]); b.r(19, 17, 3, 1, GEM[wt]); b.r(20, 18, 1, 1, GEM[wt]);
    b.r(16, 22, 1, 3, "#e0564a");
  }
  // rare weapons are inked in their rarity's colour
  c = finish(cv, g, RARE_INK[wq] || INK, 1);
  cache.set(key, c);
  return c;
}
/**
 * How each kind of weapon is carried and used. Angles are in degrees (0 points
 * right, counter-clockwise). `style`: sweep through `arc`, stab forward by
 * `push` pixels, cast with a short flick, or float beside the caster.
 */
export const HOLD = {
  sword: { rest: 58, arc: 260, time: 0.48, push: 6, grow: 0.4, style: "sweep" },
  dagger: { rest: -38, arc: 160, time: 0.28, push: 13, grow: 0.3, style: "stab" },
  spear: { rest: 64, arc: 220, time: 0.4, push: 18, grow: 0.3, style: "stab" },
  staff: { rest: 84, arc: 110, time: 0.48, push: 7, grow: 0.3, style: "cast" },
  book: { rest: 0, arc: 0, time: 0.44, push: 9, grow: 0.3, style: "float" },
};

// ───────────────────────────── monsters ─────────────────────────────
// Each creature is drawn at its real size with a one-pixel outline, facing
// left, standing on the sheet's foot line. `f` is the frame (0 or 1).

const WHITE = "#fbfbff";
const MOB = {
  /** 도토리 병정 — an acorn that marches under its own cap. */
  acorn(b, f, px) {
    const o = -f, nut = "#e8bc7c", cap = "#8a5a34";
    b.r(12, 27 + o, 2, 1, "#6a4426"); b.r(18, 27 + o, 2, 1, "#6a4426");
    b.r(11, 18 + o, 10, 8, nut); b.r(12, 26 + o, 8, 1, shade(nut, 0.2)); b.r(20, 19 + o, 1, 7, shade(nut, 0.2));
    b.r(10, 14 + o, 12, 3, cap); b.r(11, 13 + o, 10, 1, cap); b.r(9, 17 + o, 14, 1, shade(cap, 0.3));
    for (const [x, y] of [[12, 14], [15, 15], [18, 14], [13, 16], [17, 16], [20, 15]]) px(x, y + o, "#b07a48");
    b.r(15, 10 + o, 2, 3, "#6a4426"); b.r(17, 10 + o, 3, 1, "#6ab85a"); b.r(18, 9 + o, 2, 1, "#6ab85a");
    px(12, 19 + o, DARK); px(19, 19 + o, DARK);
    b.r(13, 20 + o, 1, 2, DARK); b.r(18, 20 + o, 1, 2, DARK);
    b.r(15, 23 + o, 2, 1, "#4a3640"); px(12, 22 + o, PINK); px(19, 22 + o, PINK);
  },
  /** 화분 소라게 — a hermit crab that moved into a flower pot, flower and all. */
  potcrab(b, f, px) {
    const o = -f, pot = "#d8784e", crab = "#f39a4a", leaf = "#6ab85a";
    for (const s of [0, 1]) {                                   // claws and legs, mirrored
      const m = (x, w) => (s ? 32 - x - w : x);
      b.r(m(6, 3), 22 + o, 3, 3, crab); b.r(m(5, 1), 22 + o, 1, 1, crab); b.r(m(5, 1), 24 + o, 1, 1, crab);
      b.r(m(9, 2), 25, 2, 1, crab); px(m(10, 1), 27, shade(crab, 0.3)); px(m(12, 1), 27, shade(crab, 0.3));
    }
    b.r(11, 24, 10, 3, crab); b.r(15, 26, 2, 1, "#4a3640");
    b.r(10, 16, 12, 3, pot); b.r(11, 19, 10, 3, pot); b.r(12, 22, 8, 1, pot);
    b.r(19, 16, 3, 3, shade(pot, 0.26)); b.r(18, 19, 3, 3, shade(pot, 0.26)); b.r(11, 20, 7, 1, "#f6dcb8");
    b.r(9, 13, 14, 3, pot); b.r(9, 13, 14, 1, lt(pot, 1.22)); b.r(10, 12, 12, 1, "#5a4030");
    b.r(16, 8, 1, 4, "#4a9a50"); b.r(13, 10, 3, 1, leaf); b.r(17, 9, 3, 1, leaf);
    b.r(15 + f, 5, 3, 3, "#ff9ac0"); px(16 + f, 6, "#ffe070");
    for (const x of [12, 17]) { b.r(x + 1, 21, 1, 3, crab); b.r(x, 19, 3, 3, WHITE); px(x + 1, 20, DARK); }
  },
  /** 민들레 홀씨 — a dandelion clock that drifts where the wind forgot it. */
  puff(b, f, px) {
    for (let i = 0; i < 12; i++) { const a = (i * 30 + f * 15) * (Math.PI / 180); px(Math.round(15.5 + Math.cos(a) * 8), Math.round(12.5 + Math.sin(a) * 7.5), WHITE); }
    b.oval(16, 13, 6.5, 6, WHITE); b.oval(16, 16, 5, 2.6, shade(WHITE, 0.12));
    b.r(13, 12, 1, 2, DARK); b.r(18, 12, 1, 2, DARK); b.r(15, 15, 2, 1, "#4a3640"); px(12, 15, PINK); px(19, 15, PINK);
    b.r(16, 19, 1, 3, "#8ab868"); b.r(16 + f, 22, 1, 2, "#8ab868"); b.r(15 + f, 24, 2, 3, "#8a6238");
  },
  /** 버섯 개구리 — a frog that never took its mushroom hat off. */
  capfrog(b, f, px) {
    const o = f, gr = "#6ab85a", red = "#d05a4e";
    b.r(8, 24, 3, 3, shade(gr, 0.26)); b.r(21, 24, 3, 3, shade(gr, 0.26)); b.r(7, 27, 4, 1, gr); b.r(21, 27, 4, 1, gr);
    b.r(11, 20 + o, 10, 8 - o, gr); b.r(10, 21 + o, 12, 6 - o, gr); b.r(13, 24 + o, 6, 4 - o, "#c8e8a0");
    b.oval(16, 15 + o, 8.5, 6, red, -99, 17 + o); b.r(8, 17 + o, 16, 1, shade(red, 0.3));
    b.r(11, 12 + o, 2, 2, "#fff4e0"); b.r(17, 11 + o, 3, 2, "#fff4e0"); b.r(20, 14 + o, 2, 1, "#fff4e0"); px(14, 15 + o, "#fff4e0");
    for (const x of [10, 19]) { b.r(x, 18 + o, 3, 3, WHITE); px(x + 1, 19 + o, DARK); }
    b.r(12, 23 + o, 8, 1, DARK); px(11, 22 + o, DARK); px(20, 22 + o, DARK);
  },
  /** 그루터기 거북 — a tortoise whose shell is the stump it fell asleep under. */
  stump(b, f, px) {
    const bark = "#7a5636", wood = "#e6c896", skin = "#7aa860";
    b.r(8, 25, 3, 3, skin); b.r(22, 25, 3, 3, skin); b.r(13, 26, 2, 2, shade(skin, 0.24)); b.r(19, 26, 2, 2, shade(skin, 0.24));
    px(25, 23, skin); px(26, 24, skin);
    b.r(8 - f, 20, 2, 3, skin); b.r(4 - f, 19, 5, 4, skin); b.r(5 - f, 18, 3, 1, skin); px(5 - f, 20, DARK); px(4 - f, 22, shade(skin, 0.36));
    b.r(9, 16, 16, 10, bark); b.r(9, 24, 16, 2, shade(bark, 0.26));
    b.r(12, 19, 1, 6, shade(bark, 0.3)); b.r(17, 18, 1, 7, shade(bark, 0.3)); b.r(21, 20, 1, 5, shade(bark, 0.3));
    b.oval(17, 16, 8, 3.2, wood); b.oval(17, 16, 5, 2, "#c8a070"); b.oval(17, 16, 3, 1.2, wood); px(16, 16, "#c8a070");
    b.r(20, 11, 1, 3, "#4a9a50"); b.r(21, 10, 3, 2, "#6ab85a"); b.r(18, 12, 2, 1, "#6ab85a");
  },
  /** 초롱 반딧불 — a firefly that carries its light in a paper lantern. */
  lantern(b, f, px) {
    const paper = f ? "#fff0a8" : "#ffd870", red = "#e0564a";
    const wy = f ? 14 : 10;
    b.r(6, wy, 5, 3, "#d8f0ff"); b.r(21, wy, 5, 3, "#d8f0ff"); px(6, wy, "#ffffff"); px(25, wy, "#ffffff");
    px(14, 6, DARK); px(17, 6, DARK); px(13, 5, "#ffe070"); px(18, 5, "#ffe070");
    b.r(12, 7, 8, 2, "#3a3048");
    b.r(12, 9, 8, 12, paper); b.r(11, 10, 10, 10, paper);
    b.r(13, 10, 1, 10, "#f0a848"); b.r(18, 10, 1, 10, "#f0a848");
    b.r(12, 9, 8, 1, red); b.r(12, 20, 8, 1, red);
    b.r(14, 13, 1, 2, DARK); b.r(17, 13, 1, 2, DARK); b.r(15, 16, 2, 1, "#4a3640");
    b.r(13, 21, 6, 1, "#3a3048"); b.r(15, 22, 2, 3, red); px(15 + f, 25, red);
  },
  /** 털실 거미 — a ball of yarn that grew needle legs and unravels as it walks. */
  yarn(b, f, px, line) {
    const pink = "#f078a8", legs = "#4a3a5a";
    for (const s of [0, 1]) {
      const m = (x) => (s ? 31 - x : x), k = (s + f) % 2;
      line(m(9), 17, m(6), 15 - k, legs); line(m(6), 15 - k, m(4), 19 - k, legs);
      line(m(8), 20, m(5), 20 + k, legs); line(m(5), 20 + k, m(3), 25, legs);
      line(m(9), 23, m(6), 24 - k, legs); line(m(6), 24 - k, m(6), 27, legs);
    }
    b.oval(16, 19, 7.5, 7, pink);
    for (let i = 0; i < 9; i++) { px(11 + i, 15 + (i >> 1), shade(pink, 0.3)); px(10 + i, 20 + (i >> 1), shade(pink, 0.3)); px(21 - i, 14 + (i >> 1), lt(pink, 1.3)); }
    b.oval(16, 24, 6, 1.6, shade(pink, 0.22));
    b.r(11, 17, 3, 3, WHITE); px(12, 18, DARK); b.r(18, 18, 2, 2, WHITE); px(18, 19, DARK);
    px(21, 12, pink); px(22, 11, pink); px(23, 11, pink); px(24, 12, pink); px(24, 13 + f, pink);
  },
  /** 감시 눈알 CCTV — a security camera that grew a real eye, and never blinks. */
  eyecam(b, f, px) {
    const body = "#e8ecf4", grey = "#aab2c4";
    b.r(17, 7, 2, 3, "#6a7080"); b.r(f ? 15 : 12, 6, f ? 6 : 12, 1, "#b6c0d0");
    px(24, 16, DARK); px(25, 17, DARK); px(26, 17, DARK); px(27, 18, DARK);
    b.r(11, 11, 13, 8, body); b.r(11, 17, 13, 2, shade(body, 0.2)); b.r(8, 10, 17, 2, grey);
    px(22, 13, f ? "#ff4040" : "#7a2a30");
    b.oval(10, 15, 4.6, 4.6, WHITE); b.r(6, 11, 8, 1, grey);
    b.r(7 + f, 13, 3, 4, "#e04848"); b.r(7 + f, 14, 2, 2, DARK); px(9 + f, 13, "#ffffff");
  },
  /** 신호등 보행 로봇 — a traffic light that got tired of standing still. */
  signbot(b, f, px) {
    const box = "#f0b83a", leg = "#8a90a0";
    b.r(13, 23, 2, 4, leg); b.r(17, 23, 2, 4, leg);
    b.r(f ? 13 : 11, 27, 3, 1, "#1c1e28"); b.r(f ? 18 : 17, 27, 3, 1, "#1c1e28");
    b.r(9, 12, 2, 1, leg); b.r(8, 13, 1, 3, leg); b.r(21, 12, 2, 1, leg); b.r(23, 13, 1, 3, leg);
    b.r(11, 5, 10, 17, box); b.r(12, 4, 8, 19, box); b.r(19, 6, 2, 15, shade(box, 0.3)); b.r(12, 5, 8, 16, "#2e3240");
    const lamps = [["#ff5a4a", "#6a2a2e"], ["#ffd24a", "#6a5a2e"], ["#5ae07a", "#2a5a3e"]], lit = f ? 2 : 0;
    lamps.forEach(([on, off], i) => {
      const y = 6 + i * 5;
      b.r(13, y, 6, 4, i === lit ? on : off); b.r(12, y - 1, 8, 1, "#1c1e28");
      if (i === lit) { px(14, y + 1, DARK); px(17, y + 1, DARK); b.r(15, y + (lit ? 2 : 3), 2, 1, DARK); if (lit) { px(14, y + 2, DARK); px(17, y + 2, DARK); } px(13, y, "#ffffff"); }
    });
  },
  /** 자판기 미믹 — the vending machine that takes your coin, then your arm. */
  vend(b, f, px) {
    const box = "#4aa8d8", dark = "#1c2430";
    b.r(11, 27, 3, 1, "#2e3240"); b.r(19, 27, 3, 1, "#2e3240");
    b.r(10, 7, 13, 20, box); b.r(11, 6, 11, 1, box); b.r(21, 7, 2, 20, shade(box, 0.26)); b.r(10, 7, 13, 1, lt(box, 1.3));
    b.r(11, 9, 9, 7, dark);
    for (const x of [12, 16]) { b.r(x, 10, 3, 2, "#ffe070"); px(x + 1 - f, 11, DARK); }
    ["#e0564a", "#ffd24a", "#5ae07a"].forEach((c, i) => b.r(12 + i * 3, 13, 2, 2, c));
    px(21, 10, f ? "#ffe070" : "#f0a030");
    const my = f ? 17 : 18, mh = f ? 6 : 4;
    b.r(11, my, 10, mh, "#3a1420");
    for (const x of [12, 14, 16, 18]) px(x, my, WHITE);
    for (const x of [13, 15, 17, 19]) px(x, my + mh - 1, WHITE);
    b.r(14, my + 2, 3, f ? 5 : 1, "#f07888");
    b.r(10, 24, 13, 1, "#fbfbff");
  },
  /** 브라운관 유령 — a ghost still haunting the last television it watched. */
  tvhead(b, f, px) {
    const sheet2 = "#dcdcf4", wood = "#8a6240", scr = f ? "#c8fff4" : "#9af0e0";
    b.r(8, 20 - f, 2, 2, sheet2); b.r(22, 20 - f, 2, 2, sheet2);
    b.r(11, 19, 10, 4, sheet2); b.r(12, 23, 8, 2, sheet2); b.r(13, 25, 5, 1, sheet2); b.r(14 + f, 26, 3, 1, sheet2); px(15 + f * 2, 27, sheet2);
    b.r(18, 20, 3, 3, shade(sheet2, 0.16));
    for (let i = 0; i < 4; i++) { px(13 - i, 7 - i, DARK); px(18 + i, 7 - i, DARK); }
    b.r(9, 8, 14, 11, wood); b.r(10, 7, 12, 13, wood); b.r(9, 17, 14, 2, shade(wood, 0.28));
    b.r(11, 10, 9, 7, scr);
    for (let i = 0; i < 4; i++) b.r(11 + ((i * 3 + f * 2) % 7), 10 + i * 2 + f, 2, 1, "#ffffff");
    b.r(13, 12, 1, 2, DARK); b.r(17, 12, 1, 2, DARK); b.r(14, 15, 3, 1, DARK);
    px(21, 11, "#f0cc60"); px(21, 14, "#d05a4e");
  },
  /** 촛농 유령 — a candle that kept burning after it finished melting. */
  candle(b, f, px) {
    const wax = "#fff4dc";
    b.r(10, 24, 12, 2, wax); b.r(f ? 8 : 9, 26, f ? 16 : 14, 1, wax); b.r(10, 27, 12, 1, shade(wax, 0.2));
    b.r(8, 17 + f, 3, 2, wax); b.r(21, 18 - f, 3, 2, wax);
    b.r(11, 12, 10, 13, wax); b.r(12, 11, 8, 1, wax); b.r(20, 15, 1, 10, shade(wax, 0.18));
    b.r(11, 12, 10, 2, "#fffdf2"); b.r(11, 14, 2, 3, "#fffdf2"); b.r(17, 14, 2, 2 + f, "#fffdf2"); b.r(20, 14, 1, 3, "#fffdf2");
    px(12, 16, DARK); px(19, 16, DARK); b.r(13, 17, 1, 2, DARK); b.r(18, 17, 1, 2, DARK); b.r(15, 20, 2, 2, "#4a3640");
    b.r(16, 9, 1, 2, DARK);
    if (f) { b.r(14, 5, 4, 4, "#ffb040"); b.r(16, 2, 2, 3, "#ffb040"); b.r(15, 6, 2, 3, "#fff0a0"); }
    else { b.r(14, 4, 4, 5, "#ffb040"); b.r(15, 2, 2, 2, "#ffb040"); b.r(15, 5, 2, 3, "#fff0a0"); }
    px(15, 8, "#8ad8f0"); px(16, 8, "#8ad8f0");
  },
  /** 정동 골렘 — a boulder cracked open around the crystals it grew inside. */
  geode(b, f, px) {
    const rock = "#8a8698", hole = "#3a2a5a";
    b.r(3, 17 + f, 4, 5, rock); b.r(3, 21 + f, 4, 1, shade(rock, 0.3)); b.r(25, 17 - f, 4, 5, rock); b.r(25, 21 - f, 4, 1, shade(rock, 0.3));
    b.r(10, 26, 4, 2, shade(rock, 0.36)); b.r(18, 26, 4, 2, shade(rock, 0.36));
    b.oval(16, 18, 11, 9.5, rock); b.oval(16, 23, 10, 4, shade(rock, 0.24));
    b.r(9, 11, 4, 1, lt(rock, 1.3)); px(8, 13, lt(rock, 1.3)); px(22, 12, shade(rock, 0.3)); px(23, 13, shade(rock, 0.3));
    b.r(11, 13, 10, 10, hole); b.r(10, 15, 12, 6, hole); px(12, 12, hole); px(15, 12, hole); px(19, 12, hole); px(13, 23, hole); px(17, 23, hole); px(18, 24, hole);
    for (const [x, y, h, c] of [[11, 19, 4, "#b48cff"], [13, 17, 6, "#72e6f4"], [16, 18, 5, "#b48cff"], [18, 16, 7, "#72e6f4"], [20, 19, 3, "#b48cff"]]) { b.r(x, y, 2, h, c); px(x, y - (f ? 0 : 0), "#ffffff"); px(x + 1, y + 1, shade(c, 0.26)); }
    b.r(13, 14, 2, 2, f ? "#ffffff" : "#c8fbff"); b.r(18, 14, 2, 2 - 0, f ? "#ffffff" : "#c8fbff");
  },
  /** 프리즘 해파리 — a jellyfish of cut glass trailing every colour it swallowed. */
  prism(b, f, px) {
    ["#ff6a6a", "#ffa850", "#ffe070", "#7ae08a", "#72e6f4", "#6a9cff", "#b48cff"].forEach((c, i) => {
      const x = 10 + i * 2, len = 5 + ((i * 3) % 4);
      for (let j = 0; j < len; j++) px(x + ((j + f + i) % 4 < 2 ? 0 : 1), 18 + j, c);
    });
    b.tri([[16, 4], [8.5, 17.5], [23.5, 17.5]], "#f4fdff"); b.tri([[16, 4], [16, 17.5], [23.5, 17.5]], "#a8e4f8");
    b.r(9, 17, 15, 1, "#8adcf0");
    px(13, 9 + f, "#ffffff"); px(12, 10 + f, "#ffffff"); px(19, 14, "#f4fdff");
    b.r(13, 13, 1, 2, DARK); b.r(18, 13, 1, 2, DARK); px(12, 15, PINK); px(19, 15, PINK);
  },
};
/** 균열의 군주 — an empty royal robe held open around a tear in the world. Drawn at 96×96. */
function riftLord(b, f, px) {
  const robe = "#3a2a6a", trim = "#8ae8f8", bone = "#f0ecf8", void2 = "#120a2a", rift = "#ff72d6";
  const o = f ? -1 : 0;
  // hands that belong to no arm
  for (const s of [0, 1]) {
    const m = (x, w) => (s ? 96 - x - w : x), hy = 50 + (s === f ? -2 : 2);
    b.r(m(8, 11), hy, 11, 10, bone); b.r(m(9, 9), hy - 1, 9, 1, bone); b.r(m(8, 11), hy + 7, 11, 3, shade(bone, 0.2));
    for (let i = 0; i < 3; i++) b.r(m(9 + i * 4, 2), hy + 10, 2, 4, bone);
    b.r(m(10, 7), hy - 5, 7, 4, robe); b.r(m(10, 7), hy - 2, 7, 1, trim);
    b.r(m(12, 3), hy + 3, 3, 3, rift);
  }
  // the robe, and the tattered hem
  b.tri([[28, 36 + o], [68, 36 + o], [79, 78], [17, 78]], robe);
  for (let x = 18; x < 78; x += 8) b.tri([[x, 78], [x + 8, 78], [x + 4 + (f ? 1 : -1), 85]], robe);
  b.tri([[48, 36 + o], [68, 36 + o], [79, 78], [58, 78]], shade(robe, 0.3));
  b.tri([[42, 38 + o], [54, 38 + o], [61, 79], [35, 79]], void2);
  b.tri([[42, 38 + o], [44, 38 + o], [37, 79], [35, 79]], trim); b.tri([[52, 38 + o], [54, 38 + o], [61, 79], [59, 79]], trim);
  b.r(18, 76, 60, 2, trim);
  for (const [x, y] of [[40, 52], [55, 60], [43, 70], [53, 46], [46, 74], [57, 72]]) px(x, y, f ? "#ffffff" : "#b6a0ff");
  // the tear itself
  const zig = [[48, 41], [45, 48], [50, 54], [45, 61], [50, 67], [47, 76]];
  for (let i = 0; i < zig.length - 1; i++) { const [x0, y0] = zig[i], [x1, y1] = zig[i + 1]; b.tri([[x0 - 2, y0], [x0 + 3, y0], [x1 + 3, y1], [x1 - 2, y1]], rift); b.tri([[x0, y0], [x0 + (f ? 2 : 1), y0], [x1 + (f ? 2 : 1), y1], [x1, y1]], "#ffffff"); }
  // shoulders of raw crystal
  b.tri([[20, 40 + o], [35, 29 + o], [38, 41 + o]], "#6a58b0"); b.tri([[76, 40 + o], [61, 29 + o], [58, 41 + o]], "#6a58b0");
  b.tri([[27, 35 + o], [35, 29 + o], [36, 37 + o]], "#9a88e0"); b.tri([[69, 35 + o], [61, 29 + o], [60, 37 + o]], "#9a88e0");
  // the hood and the cracked mask
  b.oval(48, 23 + o, 14, 14.5, robe); b.oval(52, 25 + o, 9, 11, shade(robe, 0.3));
  b.oval(48, 23 + o, 9, 11, bone); b.oval(51, 27 + o, 5, 6.5, shade(bone, 0.14));
  b.r(41, 21 + o, 6, 2, rift); b.r(42, 21 + o, 2, 1, "#ffffff");
  b.r(51, 19 + o, 4, 5, void2); px(52, 21 + o, f ? "#ffffff" : rift);
  for (const [x, y] of [[53, 12], [52, 13], [53, 14], [54, 15], [53, 16], [54, 17], [55, 18], [55, 24], [54, 25], [55, 26], [54, 27], [53, 28]]) px(x, y + o, void2);
  // a crown of shards that never touches the head
  [[34, 7], [41, 10], [48, 13], [55, 10], [62, 7]].forEach(([x, h], i) => { const y = 9 + o * 2 + (i % 2 ? 1 : 0); b.tri([[x - 3, y], [x + 3, y], [x, y - h]], i % 2 ? rift : trim); b.tri([[x, y], [x + 3, y], [x, y - h]], i % 2 ? shade(rift, 0.3) : shade(trim, 0.3)); });
}

// A treasure chest: iron-bound wood with a gold lock that glints now and then.
MOB.chest = (b, f) => {
  b.r(8, 17, 16, 11, "#9a6238"); b.r(8, 24, 16, 4, "#74462a"); b.r(9, 13, 14, 5, "#b47a46"); b.r(8, 14, 16, 3, "#b47a46"); b.r(10, 13, 12, 1, "#d49a5e");
  for (const x of [10, 20]) { b.r(x, 13, 2, 15, "#5a6074"); b.r(x, 13, 1, 15, "#8a90a4"); }
  b.r(8, 17, 16, 1, "#4a3020");
  b.r(14, 16, 4, 5, "#f0c040"); b.r(15, 18, 2, 2, "#6a4a18"); b.r(14, 16, 4, 1, "#fff0a0");
  if (f) { b.r(13, 15, 1, 1, "#ffffff"); b.r(18, 14, 1, 1, "#fff8d0"); }
};

/** Old names from before the redesign, so a stale server still draws something sensible. */
const MOB_ALIAS = { slime: "acorn", bslime: "potcrab", shroom: "capfrog", boar: "stump", bat: "lantern", drone: "eyecam", thug: "tvhead", robot: "signbot", skel: "candle", golem: "geode" };

/** Two frames of a monster. Anything unknown gets a plain blob rather than an error. */
export function monsterSheet(kind) {
  kind = MOB_ALIAS[kind] || kind;
  const key = "m:" + kind;
  let s = cache.get(key);
  if (s) return s;
  const draw = (f) => {
    const [c, g] = sheet(kind === "boss" ? 96 : S);
    const b = brush(g);
    const px = (x, y, col) => b.r(x, y, 1, 1, col);
    const line = (x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col); };
    if (kind === "boss") riftLord(b, f, px);
    else if (MOB[kind]) MOB[kind](b, f, px, line);
    else { b.oval(16, 21 - f, 6, 6, "#a8a4b8"); b.r(13, 19 - f, 1, 2, DARK); b.r(18, 19 - f, 1, 2, DARK); }
    return finish(c, g, INK, 1);
  };
  s = [draw(0), draw(1)];
  cache.set(key, s);
  return s;
}
/** Per monster: how many times its sheet is enlarged, and how many pixels it floats. */
export const MOB_SIZE = {
  acorn: [1, 0], potcrab: [1, 0], puff: [1, 8], capfrog: [1, 0], stump: [1, 0], lantern: [1, 9], yarn: [1, 0],
  eyecam: [1, 12], signbot: [1, 0], vend: [1, 0], tvhead: [1, 5], candle: [1, 3], geode: [1, 0], prism: [1, 10], boss: [3, 0], chest: [1, 0],
};
for (const [old, now] of Object.entries(MOB_ALIAS)) MOB_SIZE[old] = MOB_SIZE[now];
/** The light a creature gives off in dark places, if any. */
export const MOB_GLOW = { lantern: "#ffe690", candle: "#ffb040", prism: "#a8e4f8", tvhead: "#9af0e0", eyecam: "#ff6a6a", geode: "#b48cff", boss: "#ff72d6", bat: "#ffe690", skel: "#ffb040", thug: "#9af0e0", golem: "#b48cff" };
