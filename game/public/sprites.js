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
import * as WPN from "./weapons.js";
import * as WR from "./wardrobe.js";
import * as SPC from "./species.js";
WR.useSpecies(SPC);

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

/** What can be chosen at creation, in the order `look` stores it (species.js has them all). */
export const PARTS = SPC.PARTS;
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
  // players (any look with a species) are drawn by species.js; townsfolk and monsters below
  if (o.sp !== undefined) return SPC.animal(o, view, f, { sheet, brush, finish, shade, blend, lt, FRAME });
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

// ───────────────────────────── pets ─────────────────────────────
// A pet is about half an adventurer's size, drawn on the same 32×32 sheet and
// standing on the same foot line, facing right; two frames (rest, hop or flap).
// The chick walks, the bat and the wisp hover (the scene lifts them).

const petCache = {};
/** Two frames of a pet: `pet_chick`, `pet_bat` or `pet_wisp`. */
export function petSheet(kind) {
  if (petCache[kind]) return petCache[kind];
  const frames = [0, 1].map((f) => {
    const [c, g] = sheet(S);
    const { r, oval, tri } = brush(g);
    if (kind === "pet_bat") {
      // a round dark body, two ears, wings up then down, yellow eyes
      const B = "#6a4a8a", W = "#4a3068", L = "#9a7ac0";
      if (f === 0) { tri([[13, 21], [6, 15], [9, 24]], W); tri([[19, 21], [26, 15], [23, 24]], W); r(7, 16, 1, 3, L); r(24, 16, 1, 3, L); }
      else { tri([[13, 21], [6, 27], [10, 20]], W); tri([[19, 21], [26, 27], [22, 20]], W); }
      oval(16, 22, 4, 4, B);
      tri([[12, 20], [13, 15], [15, 19]], B); tri([[17, 19], [19, 15], [20, 20]], B);
      oval(16, 24, 2.5, 1.6, L);
      r(14, 21, 1, 1, "#ffe070"); r(17, 21, 1, 1, "#ffe070");
      r(16, 24, 1, 1, "#ffffff");
      return finish(c, g, INK, 1);
    }
    if (kind === "pet_wisp") {
      // a little blue flame with a face: a light, so its edge is deep blue, not ink
      const tip = f ? -1 : 0, lean = f ? 1 : -1;
      oval(16, 23, 5, 5, "#3a8ad0");
      tri([[11, 22], [16 + lean, 12 + tip], [21, 22]], "#3a8ad0");
      oval(16, 24, 3.6, 3.6, "#7ad4ff");
      tri([[13, 23], [16 + lean, 15 + tip], [19, 23]], "#7ad4ff");
      oval(16, 25, 2, 2, "#e8fbff");
      r(14, 23, 1, 2, "#1e3a68"); r(18, 23, 1, 2, "#1e3a68");
      return finish(c, g, "#1e4a78", 1);
    }
    // the chick: a round yellow body, a head with a tuft, a small wing, an orange beak and feet
    const Y = "#ffd84a", O = "#e8a838", up = f ? -1 : 0;
    oval(15, 24 + up, 5.5, 4.2, Y);
    oval(15, 26 + up, 5, 2.2, O, 26 + up);
    oval(18, 19 + up, 3.6, 3.4, Y);
    r(18, 15 + up, 1, 2, Y); r(17, 14 + up, 1, 1, Y);
    if (f) r(11, 20 + up, 4, 2, "#f6c030"); else oval(13, 24, 2.6, 1.6, "#f6c030");
    r(21, 19 + up, 2, 1, "#ff8a3a"); r(21, 20 + up, 1, 1, "#d8642a");
    r(19, 18 + up, 1, 1, INK);
    r(18, 20 + up, 1, 1, "#f6a8a0");
    if (!f) { r(13, 28, 1, 1, "#ff8a3a"); r(17, 28, 1, 1, "#ff8a3a"); }
    else { r(14, 27, 1, 1, "#ff8a3a"); r(16, 27, 1, 1, "#ff8a3a"); }
    return finish(c, g, INK, 1);
  });
  return (petCache[kind] = frames);
}
/** Pets that fly hover this far above their shadow. */
export const PET_HOVER = { pet_chick: 0, pet_bat: 9, pet_wisp: 7 };

const cache = new Map();
/** `{ front, side, back }`, each a list of frames indexed by FRAME. Side frames face right. */
export function personSheet(o) {
  const key = JSON.stringify(o);
  let s = cache.get(key);
  if (!s) {
    // worn cosmetics (wardrobe.js) are layered over each plain frame
    const frames = (view) => [0, 1, 2, 3, 4, 5].map((f) => WR.dress(person(o, view, f), o, view, f));
    s = { front: frames("front"), side: frames("side"), back: frames("back") };
    cache.set(key, s);
  }
  return s;
}
/** `look` is the list of choices, one per entry of PARTS. The class shows only in the weapon. */
export function playerLook(cls, look = [], gear = {}) {
  const o = SPC.lookOf(look);
  // cosmetics worn (ids), so others see the outfit too
  return gear && gear.cos && gear.cos.length ? { ...o, cos: gear.cos } : o;
}
/** Townsfolk wear a tunic in their trade's colour. */
export function npcLook(look, role) {
  if (role === "elder") return { ear: 1, eye: 4, nose: 0, fur: "#e6e6f0", blush: PINK, pat: 0, cloth: "#5a6ac0" };
  if (role === "smith") return { ear: 2, eye: 0, nose: 3, fur: "#c89a74", blush: null, pat: 0, cloth: "#6a5a52" };
  if (role === "shop") return { ear: 0, eye: 3, nose: 1, fur: "#ffe6d2", blush: PINK, pat: 0, cloth: "#e07a8a" };
  if (role === "train") return { ear: 3, eye: 1, nose: 0, fur: "#f6c890", blush: PINK, pat: 3, cloth: "#b84a4a" };
  // the stone-keeper in violet, the collector in hunter's green, the herald of deeds in gold, the task-giver in sky blue
  if (role === "warp") return { ear: 1, eye: 4, nose: 2, fur: "#d8ccff", blush: PINK, pat: 0, cloth: "#6a4ad0" };
  if (role === "collector") return { ear: 2, eye: 1, nose: 3, fur: "#a8845c", blush: null, pat: 1, cloth: "#3a6a42" };
  if (role === "achieve") return { ear: 0, eye: 2, nose: 0, fur: "#fff0c0", blush: PINK, pat: 0, cloth: "#d8a830" };
  if (role === "daily") return { ear: 3, eye: 0, nose: 1, fur: "#ffd0a0", blush: PINK, pat: 2, cloth: "#4a8ad0" };
  // the warehouse keeper, a bear in a storeroom-brown apron
  if (role === "bank") return { ear: 2, eye: 3, nose: 1, fur: "#e6cca4", blush: PINK, pat: 0, cloth: "#8a6a3a" };
  // the costume-shop keeper, a fox, wears her own stock
  if (role === "costume") return { ear: 3, eye: 3, nose: 1, fur: "#fff0e4", blush: PINK, pat: 0, cloth: null, cos: ["hat_beret", "top_dress_white", "face_glasses_gold"] };
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
  // every tier, legendary, set, skin and glow has its own look (weapons.js)
  if (WPN.DESIGNS[kind]) return WPN.weaponSprite(kind, gear);
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
  // `time` is a whole stroke — wind-up, strike, follow-through — and is a little
  // shorter than the weapon's attack interval, so strokes chain with a short pause
  sword: { rest: 58, arc: 260, time: 0.8, push: 6, grow: 0.4, style: "sweep" },
  dagger: { rest: -38, arc: 160, time: 0.42, push: 13, grow: 0.3, style: "stab" },
  spear: { rest: 64, arc: 220, time: 0.66, push: 18, grow: 0.3, style: "stab" },
  staff: { rest: 84, arc: 110, time: 0.86, push: 7, grow: 0.3, style: "cast" },
  book: { rest: 0, arc: 0, time: 0.68, push: 9, grow: 0.3, style: "float" },
};

// ───────────────────────────── monsters ─────────────────────────────
// Everything that hunts here was an animal once. Each is drawn at its real size
// with a one-pixel outline, facing left, standing on the sheet's foot line; `f`
// is the frame (0 or 1). The palette is the opposite of the adventurers': raw
// meat, bruise, bone and bile, with blood as the one bright accent.

const WHITE = "#fbfbff";
const MEAT = "#a83848", GORE = "#e02838", CLOT = "#5a1424", GUT = "#d87a88", BONE = "#e8dfc8", BRUISE = "#5c3c6c", BILE = "#b4cc3c", EYE = "#f4efe0";
/** A polyline, one pixel wide. */
const path = (line, pts, col) => { for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col); };
/** A limb two pixels thick: the line, and the same line one pixel lower in its shadow tone. */
const limb = (line, pts, col, under = shade(col, 0.3)) => { path(line, pts.map(([x, y]) => [x, y + 1]), under); path(line, pts, col); };
/** A lidless eye: two by two, white, with one pixel of iris. */
const orb = (b, px, x, y, iris = GORE, at = 0) => { b.r(x, y, 2, 2, EYE); px(x + (at & 1), y + (at >> 1), iris); };

const MOB = {
  // ── meadow
  /** 쌍두 토끼 — two hares sewn into one; only one of the heads is still alive. */
  twinhare(b, f, px, line) {
    const fur = "#b9b0b6", dead = "#8f8a9c", o = f;
    b.r(22, 24, 5, 3, shade(fur, 0.3)); b.r(24, 27, 4, 1, fur);                    // haunch and long foot
    b.oval(18, 22, 7, 5, fur); b.oval(18, 25, 6, 2, shade(fur, 0.22));
    b.r(11, 25, 2, 3, fur); b.r(14, 26, 2, 2, shade(fur, 0.3));
    b.r(25, 19, 2, 2, WHITE);                                                      // scut
    // the dead head, lolling on top
    b.r(15, 4 + o, 2, 8, dead); b.r(18, 6 + o, 2, 6, dead); px(15, 5 + o, "#6a5a70"); px(18, 7 + o, "#6a5a70");
    b.oval(16, 14 + o, 4, 3.5, dead);
    px(13, 13 + o, DARK); px(14, 14 + o, DARK); px(14, 13 + o, "#3a2a40"); px(13, 14 + o, "#3a2a40");   // an eye sewn shut
    px(12, 16 + o, CLOT);
    // the live one, low and forward
    b.r(6, 8, 2, 8, fur); b.r(9, 9, 2, 7, fur); px(6, 10, PINK); px(6, 11, PINK); px(9, 11, PINK);
    b.oval(9, 19, 4.5, 4, fur); b.oval(9, 21, 3.5, 1.5, shade(fur, 0.2));
    b.r(6, 18, 2, 2, GORE); px(6, 18, "#ff9a9a");                                  // one raw red eye
    px(4, 21, "#7a4a58"); b.r(5, 22, 2, 1, CLOT); px(5, 23, GORE); if (f) px(5, 24, GORE);
    // the seam where they were joined
    for (let y = 16; y <= 25; y += 1) px(14 + (y % 3 === 0 ? 1 : 0), y, y % 2 ? DARK : GORE);
    px(13, 18, DARK); px(16, 20, DARK); px(13, 22, DARK); px(16, 24, DARK);
  },
  /** 창자 개구리 — a frog swollen tight, its own guts hanging out where a tongue should be. */
  gutfrog(b, f, px, line) {
    const skin = "#7d9450", belly = "#cdd2a0", o = f;
    b.r(21, 24, 6, 3, shade(skin, 0.3)); b.r(24, 27, 4, 1, skin);                   // folded hind leg
    b.oval(17, 20 - o, 9, 7 + o, skin);
    b.oval(17, 23, 8, 4, belly);
    for (const [x, y] of [[13, 22], [14, 23], [15, 23], [20, 24], [21, 23], [22, 23]]) px(x, y, "#8a5a9a");   // veins under the stretched skin
    px(18, 21, "#8a5a9a"); px(18, 22, "#8a5a9a");
    b.r(11, 25, 2, 3, skin); b.r(9, 27, 3, 1, skin);
    // eyes pushed out of the skull
    b.r(9, 10 - o, 4, 4, skin); b.r(15, 9 - o, 4, 4, skin);
    b.r(10, 10 - o, 3, 3, EYE); px(10, 11 - o, DARK); px(12, 10 - o, GORE);
    b.r(16, 9 - o, 3, 3, EYE); px(17, 10 - o, DARK); px(16, 11 - o, GORE); px(18, 9 - o, GORE);
    // the mouth, and what comes out of it
    b.r(7, 17, 7, 3, CLOT); px(8, 16, CLOT); px(13, 17, BONE); px(10, 17, BONE);
    const sway = f ? 1 : 0;
    limb(line, [[8, 19], [5, 21], [4 + sway, 24], [6 + sway, 26], [3 + sway, 27]], GUT, "#a84a5c");
    limb(line, [[10, 19], [8, 22], [9 + sway, 25]], GUT, "#a84a5c");
    px(4 + sway, 22, "#f2a6ae"); px(6 + sway, 25, "#f2a6ae"); px(2, 27, GORE);
    for (const [x, y] of [[20, 15], [23, 18], [14, 14]]) px(x, y - o, shade(skin, 0.34));   // warts
  },
  /** 눈알 까마귀 — a crow that grew an eye wherever a feather fell out. */
  eyecrow(b, f, px, line) {
    const feather = "#3d3550", dark = "#2a2438", beak = "#cfc6a8", leg = "#7a6a48";
    b.r(22, 17, 6, 2, dark); b.r(24, 19, 5, 1, dark); px(28, 16, dark); px(29, 18, dark);               // tail
    px(15, 21, leg); px(15, 22, leg); px(14, 23, leg); px(16, 23, leg); px(19, 21, leg); px(19, 22, leg); px(18, 23, leg); px(20, 23, leg);
    b.oval(17, 17, 6, 4, feather); b.oval(18, 19, 5, 2, dark);
    b.oval(10, 14, 3.6, 3.4, feather);
    b.r(3, 14, 5, 2, beak); b.r(4, 16, 3, 1, shade(beak, 0.34)); px(3, 15, GORE); px(2, 16, GORE); if (f) px(2, 17, GORE);
    // one wing, beating: raised, then swept down
    if (!f) { b.tri([[13, 15], [17, 3], [27, 5], [24, 15]], feather); b.tri([[21, 8], [27, 5], [24, 15], [19, 15]], dark); px(17, 3, dark); px(20, 2, feather); px(24, 3, feather); }
    else { b.tri([[13, 16], [23, 16], [28, 27], [17, 25]], feather); b.tri([[20, 19], [23, 16], [28, 27], [21, 26]], dark); }
    // an eye wherever a feather fell out
    b.r(9, 12, 3, 3, EYE); px(10, 13, GORE); px(9, 12, "#ffd0d0");
    for (const [x, y, a] of f ? [[16, 19, 0], [20, 22, 3], [23, 19, 1]] : [[17, 7, 0], [21, 6, 3], [18, 11, 1], [22, 11, 2]]) orb(b, px, x, y, GORE, a);
    orb(b, px, 14, 16, "#ff7a30", 2); if (!f) orb(b, px, 20, 17, GORE, 1);
  },
  // ── forest
  /** 반쪽 멧돼지 — the front half of a boar, still charging; the rest of it is something else now. */
  splitboar(b, f, px, line) {
    const hide = "#5c4238", snout = "#8f5c54", o = f;
    const tent = "#9a4a7a";
    limb(line, [[19, 20], [23, 18 - o], [27, 20 + o], [30, 18]], tent); limb(line, [[19, 23], [24, 24 + o], [28, 22 - o], [30, 24]], tent);
    limb(line, [[19, 25], [23, 27], [27, 26 + o]], tent);
    for (const [x, y] of [[24, 18 - o], [27, 21 + o], [25, 25 + o]]) px(x, y, "#e0a0c0");
    b.oval(13, 20, 7, 6, hide); b.oval(13, 23, 6, 3, shade(hide, 0.3));
    b.oval(19, 21, 2, 5, MEAT); b.r(19, 19, 1, 5, CLOT); px(19, 18, BONE); px(20, 18, BONE); px(19, 21, BONE);   // the cut
    for (const x of [9, 12, 15]) b.tri([[x, 15], [x + 2, 11 - (x % 2)], [x + 3, 15]], "#2f2630");               // bristles
    b.oval(7, 21, 4, 3.5, hide); b.r(2, 21, 4, 4, snout); b.r(2, 24, 4, 1, shade(snout, 0.3)); px(2, 22, DARK); px(4, 22, DARK);
    b.r(5, 24, 1, 3, BONE); px(4, 27 - 1, BONE); b.r(8, 25, 1, 2, BONE); px(5, 27, GORE);                        // tusks
    b.r(7, 18, 2, 2, GORE); px(7, 18, "#ff9a9a");
    px(9, 16, hide); px(10, 15, hide);
    b.r(10, 25 + (f ? 0 : 1), 2, 3 - (f ? 0 : 1), hide); b.r(14, 25 + (f ? 1 : 0), 2, 3 - (f ? 1 : 0), hide);
    px(21, 27, GORE); px(24, 27, GORE); if (f) px(27, 27, GORE);
  },
  /** 갈비뼈 사슴 — a stag walking with its chest hanging open and hands where its antlers were. */
  ribdeer(b, f, px, line) {
    const hide = "#8c6c5a", o = f ? 1 : 0;
    for (const [x, k] of [[12, 0], [15, 1], [21, 1], [24, 0]]) { b.r(x, 22, 1, 5 - (k === o ? 1 : 0), shade(hide, 0.28)); px(x, 27 - (k === o ? 1 : 0), DARK); }
    b.oval(18, 19, 7.5, 4.5, hide); b.r(25, 16, 2, 2, shade(hide, 0.2));
    // the open chest
    b.r(14, 17, 8, 6, CLOT);
    for (const x of [14, 16, 18, 20]) { b.r(x, 17, 1, 5, BONE); px(x, 22, shade(BONE, 0.3)); }
    b.r(17, 19, 2, 2, f ? "#ff5a5a" : GORE);                                        // the heart still going
    px(16, 23, GORE); px(16, 24, GORE); if (f) px(16, 25, GORE); px(19, 23, GORE);
    // neck and head
    b.tri([[11, 20], [14, 16], [9, 10], [7, 13]], hide);
    b.oval(7, 11, 3.5, 2.5, hide); b.r(3, 11, 3, 2, shade(hide, 0.22)); px(3, 12, DARK);
    b.r(7, 10, 2, 2, DARK); px(7, 11, GORE);
    // antlers that end in fingers
    for (const [x, s] of [[8, -1], [11, 1]]) {
      path(line, [[x, 9], [x + s, 6], [x + s * 2, 4]], BONE);
      px(x + s * 2 - 1, 3, BONE); px(x + s * 2, 2, BONE); px(x + s * 2 + 1, 3, BONE); px(x + s * 3, 5, BONE); px(x + s * 2 - 1, 2 - 1, BONE); px(x + s * 2 + 1, 2, BONE);
    }
    px(27, 15, hide);
  },
  /** 세 머리 뱀 — three heads on one body, and they do not agree. */
  hydrasnake(b, f, px, line) {
    const scale = "#56744f", belly = "#cfc67c", eye = "#e8c840", o = f ? 1 : -1;
    // the coil it rises from
    b.oval(17, 25, 10, 2.8, scale); b.oval(16, 22, 7, 2.6, scale); b.r(10, 24, 13, 1, shade(scale, 0.4)); b.oval(17, 26.5, 9, 1.2, shade(scale, 0.3));
    for (const x of [9, 12, 15, 18, 21, 24]) px(x, 26, belly);
    b.r(26, 23, 3, 2, scale); px(29, 22, scale); px(30, 21, shade(scale, 0.3));
    const neck = (pts) => {
      for (const d of [-1, 0, 1]) path(line, pts.map(([x, y]) => [x + d, y]), d > 0 ? shade(scale, 0.32) : scale);
      for (let i = 1; i < pts.length; i++) px(pts[i][0] - 1, pts[i][1] + 1, belly);
    };
    const head = (x, y, dir) => {
      const jx = dir < 0 ? x - 6 : x + 2;
      b.r(x - 3, y - 2, 6, 4, scale); b.r(x - 2, y - 3, 4, 1, scale); b.r(x - 3, y + 1, 6, 1, shade(scale, 0.3));
      b.r(jx, y - 1, 4, 2, scale); b.r(jx, y + 1, 4, 1, CLOT); b.r(jx, y + 2 + (f ? 1 : 0), 4, 1, shade(scale, 0.3)); if (f) b.r(jx, y + 2, 4, 1, CLOT);
      px(dir < 0 ? jx : jx + 3, y + 1, BONE); px(dir < 0 ? jx + 2 : jx + 1, y + 1, BONE);
      b.r(dir < 0 ? x - 2 : x, y - 1, 2, 1, eye); px(dir < 0 ? x - 2 : x + 1, y - 1, DARK);
      px(dir < 0 ? jx - 1 : jx + 4, y + 1, GORE); px(dir < 0 ? jx - 2 : jx + 5, y + (f ? 2 : 0), GORE);
    };
    neck([[12, 22], [9, 18], [8 + o, 14], [8 + o, 12]]); head(8 + o, 10, -1);
    neck([[16, 21], [17, 15], [16 - o, 9], [16 - o, 7]]); head(16 - o, 5, -1);
    neck([[21, 22], [23, 18], [24 + o, 15], [24 + o, 13]]); head(24 + o, 11, 1);
    px(12, 21, GORE); px(16, 20, CLOT); px(21, 21, GORE);
  },
  /** 인면 나방 — the pattern on its wings looks back at you, and blinks. */
  mothface(b, f, px, line) {
    const dust = "#b79c8c", dark = "#6c5560";
    const w = f ? 5 : 7;
    b.oval(16 - w, 13, w, 6.5, dust); b.oval(16 + w, 13, w, 6.5, dust);
    b.oval(16 - w + 1, 21, w - 2, 3.5, dark); b.oval(16 + w - 1, 21, w - 2, 3.5, dark);
    b.tri([[16 - w - 4, 9], [16 - w - 5, 4], [16 - w + 2, 7]], dust); b.tri([[16 + w + 4, 9], [16 + w + 5, 4], [16 + w - 2, 7]], dust);
    b.oval(16 - w, 16, w - 1, 3, shade(dust, 0.22)); b.oval(16 + w, 16, w - 1, 3, shade(dust, 0.22));
    // the face: two eyes high on the wings, a mouth across the lower pair
    for (const s of [-1, 1]) {
      const x = 16 + s * w;
      b.r(x - 2, 10, 4, 4, EYE); b.r(x - 1, 9, 2, 1, EYE);
      b.r(x - 1, 11 + (f ? 1 : 0), 2, 2, DARK); px(x - 1, 11 + (f ? 1 : 0), GORE);
      b.r(x - 3, 8, 6, 1, dark);
      b.r(x - 2, 20, 4, 2, CLOT); px(x - 2, 20, BONE); px(x, 20, BONE); px(x + 1, 21, BONE);
    }
    b.r(15, 9, 2, 13, "#3a2c38"); px(15, 12, dark); px(16, 15, dark); px(15, 18, dark);
    b.r(15, 7, 2, 2, "#3a2c38"); px(14, 8, GORE); px(17, 8, GORE);
    path(line, [[15, 7], [12, 3], [10, 3]], "#3a2c38"); path(line, [[16, 7], [19, 3], [21, 3]], "#3a2c38");
    px(16, 22, GORE); px(16, 23, GORE);
  },
  // ── crypt
  /** 쥐 왕 — a nest of rats knotted together by their tails, pulling four ways at once. */
  ratking(b, f, px, line) {
    const fur = "#6e6876", sick = "#7d8a70", o = f ? 1 : 0;
    const rat = (x, y, dir, col, dead) => {
      b.oval(x, y, 4, 2.8, col); b.oval(x, y + 1.5, 3, 1.3, shade(col, 0.3));
      b.oval(x + dir * 4, y, 2.4, 2, col); px(x + dir * 6, y + 1, PINK);
      px(x + dir * 3, y - 2, PINK); px(x + dir * 4, y - 3, col);
      if (dead) { px(x + dir * 4, y - 1, DARK); px(x + dir * 5, y, DARK); } else px(x + dir * 4, y, GORE);
      px(x - dir, y + 3, PINK); px(x + dir * 2, y + 3, PINK);
    };
    // the knot of tails
    for (const [x0, y0] of [[8, 21], [24, 21], [10, 12], [22, 12]]) path(line, [[x0, y0], [16, 18]], GUT);
    b.oval(16, 18, 4, 3.2, GUT); b.r(14, 17, 4, 1, "#a84a5c"); b.r(15, 19, 3, 1, "#a84a5c"); px(13, 18, "#a84a5c"); px(18, 16, "#a84a5c"); px(17, 20, CLOT);
    rat(7, 23 - o, -1, fur, false); rat(25, 23 + o, 1, fur, false);
    rat(9, 10 + o, -1, sick, true); rat(23, 10 - o, 1, fur, false);
    px(16, 22, GORE); px(15, 23, GORE);
  },
  /** 가죽 벗겨진 사냥개 — a hound with no skin left, and its spine working loose. */
  bonehound(b, f, px, line) {
    const o = f ? 1 : 0, dark = "#7a2434";
    for (const [x, k] of [[10, 0], [13, 1], [21, 1], [24, 0]]) { b.r(x, 21, 2, 5 - (k === o ? 1 : 0), dark); b.r(x, 26 - (k === o ? 1 : 0), 2, 1, BONE); }
    b.oval(17, 18, 8, 4.5, MEAT); b.oval(21, 19, 3, 3, dark); b.oval(13, 20, 4, 2, dark);
    for (const x of [13, 15, 17, 19]) b.r(x, 17, 1, 4, BONE);                       // ribs through the meat
    for (let x = 9; x <= 25; x += 2) { b.r(x, 13, 1, 2, BONE); px(x + 1, 14, CLOT); }  // the spine, standing proud
    path(line, [[26, 14], [28, 11], [30, 10 - o]], BONE); px(27, 13, CLOT); px(29, 11, CLOT);
    // the head: all jaw
    b.oval(7, 15, 3.5, 3, MEAT); b.r(1, 15, 6, 2, MEAT); b.r(2, 18, 5, 1 + o, dark);
    for (const x of [1, 3, 5]) px(x, 17, BONE);
    px(2, 19 + o, BONE); px(4, 19 + o, BONE);
    orb(b, px, 6, 13, DARK, 0); px(1, 14, DARK);
    b.r(8, 11, 2, 2, dark);
    px(15, 23, GORE); px(15, 24, GORE); if (f) px(15, 25, GORE); px(19, 23, GORE);
  },
  /** 박쥐 덩어리 — too many bats to count, grown into one ball that screams from every side. */
  batcluster(b, f, px, line) {
    const body = "#4d3c56", skin = "#7a5270";
    const up = f ? -3 : 1;
    b.tri([[10, 15], [1, 9 + up], [3, 18 + up], [9, 19]], skin); b.tri([[22, 15], [31, 9 + up], [29, 18 + up], [23, 19]], skin);
    path(line, [[10, 15], [1, 9 + up]], body); path(line, [[9, 17], [3, 18 + up]], body); path(line, [[22, 15], [31, 9 + up]], body); path(line, [[23, 17], [29, 18 + up]], body);
    b.oval(16, 16, 8, 8, body); b.oval(18, 19, 6, 5, shade(body, 0.3));
    for (const [x, y] of [[10, 9], [15, 7], [20, 8], [24, 12], [8, 14]]) b.tri([[x - 1, y + 2], [x, y - 2], [x + 2, y + 2]], body);   // ears, everywhere
    for (const [x, y] of [[11, 12], [17, 11], [13, 17], [20, 16], [16, 21]]) { px(x, y, GORE); px(x + 2, y, GORE); b.r(x, y + 2, 3, 1, CLOT); px(x, y + 2, BONE); px(x + 2, y + 2, BONE); }
    px(12, 24, skin); px(12, 25, skin); px(19, 24, skin); px(19, 25, skin); px(16, 25, GORE); if (f) px(16, 26, GORE);
  },
  // ── city
  /** 비둘기 떼살 — a flock that melted together; three of the heads still look for crumbs. */
  pigeonmass(b, f, px, line) {
    const grey = "#7c8698", dark = "#565e70", foot = "#e07a8a", beak = "#d6aaa2";
    const up = f ? -3 : 1;
    b.tri([[10, 14], [1, 8 + up], [2, 15 + up], [9, 18]], grey); b.tri([[2, 15 + up], [1, 8 + up], [0, 13 + up]], dark);
    path(line, [[23, 17], [28, 20], [29, 25]], grey); path(line, [[24, 17], [29, 20], [30, 24]], dark); px(27, 24, dark); px(28, 26, grey);   // the wing that broke
    for (const x of [11, 14, 18, 21]) { const k = (x + f) % 2; px(x, 23, foot); px(x, 24 + k, foot); px(x - 1, 25 + k, foot); px(x + 1, 25 + k, foot); }
    b.oval(16, 17, 8, 6, grey); b.oval(18, 20, 6, 3.5, dark);
    for (const [x, y] of [[11, 15], [12, 15], [19, 13], [20, 13], [15, 19], [16, 19]]) px(x, y, "#6ab890");       // the sheen on a pigeon's neck
    for (const [x, y] of [[13, 14], [14, 14], [21, 15], [17, 20]]) px(x, y, "#9a6ac0");
    const head = (x, y, dir) => {
      b.oval(x, y, 3, 3, grey); b.r(dir < 0 ? x - 5 : x + 3, y, 3, 1, beak); b.r(dir < 0 ? x - 4 : x + 3, y + 1, 2, 1, shade(beak, 0.34));
      px(dir < 0 ? x - 3 : x + 3, y - 1, WHITE);
      b.r(dir < 0 ? x - 2 : x, y - 1, 2, 2, "#ff8a30"); px(dir < 0 ? x - 2 : x + 1, y - 1, DARK); px(x, y + 2, "#6ab890"); px(x - dir, y + 2, "#9a6ac0");
    };
    head(7, 12, -1); head(15, 8 - (f ? 1 : 0), -1); head(25, 13, 1);
    px(16, 22, CLOT); px(13, 18, GORE); px(20, 17, CLOT); px(9, 19, GORE);
  },
  /** 세 머리 들개 — one stray, three hungers. */
  doghead(b, f, px, line) {
    const coat = "#8c765a", bald = "#c48e86", o = f ? 1 : 0;
    for (const [x, k] of [[15, 0], [18, 1], [23, 1], [26, 0]]) b.r(x, 22, 2, 6 - (k === o ? 1 : 0), shade(coat, 0.3));
    b.oval(20, 19, 7, 4.5, coat); b.oval(21, 21, 6, 2.5, shade(coat, 0.26));
    for (const [x, y] of [[18, 17], [19, 17], [23, 18], [24, 18], [21, 20]]) px(x, y, bald);                      // mange
    for (const x of [18, 20, 22]) px(x, 22, shade(coat, 0.4));                                                    // ribs showing
    path(line, [[27, 17], [29, 14], [30, 15 + o]], shade(coat, 0.3));
    const head = (x, y, snarl) => {
      b.tri([[14, 18], [16, 20], [x + 2, y + 2], [x + 2, y - 1]], coat);
      b.oval(x, y, 3.2, 2.6, coat); b.r(x - 6, y, 4, 2, coat); b.r(x - 6, y + 2, 4, 1 + snarl, CLOT);
      px(x - 6, y + 2, BONE); px(x - 4, y + 2, BONE); if (snarl) px(x - 5, y + 3, BONE);
      px(x - 6, y, DARK); px(x - 1, y - 1, GORE); px(x + 1, y - 3, coat); px(x + 2, y - 3, shade(coat, 0.3));
    };
    head(8, 23, o); head(8, 16, 1 - o); head(12, 10, o);
    px(3, 26, GORE); if (f) px(3, 27, GORE); px(15, 19, CLOT); px(15, 17, CLOT);
  },
  /** 갈라진 고양이 — a cat opened down the middle like a flower, with something else living inside. */
  catsplit(b, f, px, line) {
    const fur = "#4c4856", tent = "#9a4a7a", o = f ? 1 : -1;
    // what lives inside
    limb(line, [[15, 16], [13 + o, 10], [14 - o, 5], [12 - o, 3]], tent); limb(line, [[17, 16], [19 - o, 9], [18 + o, 4]], tent); limb(line, [[16, 18], [16 + o, 12], [17, 8]], tent);
    px(13 + o, 9, "#e0a0c0"); px(19 - o, 8, "#e0a0c0"); px(16 + o, 11, "#e0a0c0");
    b.r(12, 14, 8, 13, CLOT); b.r(13, 12, 6, 2, CLOT); b.r(14, 20, 4, 4, MEAT); px(15, 24, GORE); px(16, 25, GORE);
    for (const s of [-1, 1]) {
      const m = (x) => (s < 0 ? x : 31 - x);
      const half = [[m(12), 27], [m(5), 27], [m(4), 20], [m(6), 12], [m(8), 9], [m(12), 11]];
      b.tri(half, fur);
      b.tri([[m(5), 11], [m(6), 5], [m(9), 9]], fur); px(m(7), 8, PINK);                                           // one ear each
      b.r(Math.min(m(8), m(9)), 14, 2, 2, s < 0 ? BILE : EYE); px(m(8), 14 + (f ? 1 : 0), DARK);                   // one eye each
      for (let y = 13; y <= 25; y += 3) px(m(12), y, BONE);                                                       // teeth down the split
      b.r(Math.min(m(5), m(7)), 26, 3, 2, WHITE);
      px(m(4), 16, shade(fur, 0.3)); px(m(4), 18, shade(fur, 0.3));
    }
    path(line, [[26, 24], [29, 20], [28, 16 + o]], fur);
  },
  /** 다리 달린 생선 — a fish that walked out of the river on legs it should not have. */
  fishwalker(b, f, px, line) {
    const scale = "#8aa0a6", belly = "#d6d4c2", leg = "#d8b6a6", o = f ? 1 : 0;
    // the legs: too long, bent the wrong way
    limb(line, [[12, 18], [9 + o, 22], [12 + o, 25], [10 + o, 27]], leg, "#a8847c"); limb(line, [[19, 18], [22 - o, 22], [19 - o, 25], [21 - o, 27]], leg, "#a8847c");
    px(8 + o, 27, leg); px(9 + o, 27, leg); px(22 - o, 27, leg); px(23 - o, 27, leg);
    b.tri([[23, 13], [30, 8], [28, 14], [30, 19]], shade(scale, 0.3));                                              // tail
    b.oval(15, 14, 9, 5, scale); b.oval(15, 17, 8, 2.4, belly);
    b.tri([[14, 9], [19, 5], [20, 10]], shade(scale, 0.3));                                                        // dorsal fin
    for (const [x, y] of [[16, 12], [19, 13], [22, 12], [18, 15], [21, 15]]) px(x, y, shade(scale, 0.3));
    b.r(12, 12, 1, 4, GORE); b.r(14, 12, 1, 4, CLOT);                                                              // gills, working
    b.r(7, 10, 4, 4, EYE); b.r(8, 11, 2, 2, DARK); px(7, 13, GORE);                                                // a dead flat eye
    b.r(5, 15, 4, 2, CLOT); for (const x of [5, 7]) { px(x, 15, BONE); px(x + 1, 16, BONE); }
    px(5, 17, GORE); if (f) px(5, 18, GORE);
  },
  // ── sewer
  /** 거머리 아가리 — a leech the size of a dog; the whole front of it is a mouth. */
  leechmaw(b, f, px, line) {
    const slick = "#4b3a46", under = "#8a5c66", o = f ? 1 : 0;
    b.oval(24, 25, 5, 3, slick); b.oval(19, 23, 5.5, 4.5, slick); b.oval(13, 19 - o, 6, 6, slick);
    for (const [x, y] of [[26, 26], [22, 26], [18, 26], [15, 24], [12, 24 - o]]) b.r(x, y, 2, 1, under);
    for (const [x, y] of [[21, 20], [17, 18], [23, 22]]) px(x, y, lt(slick, 1.5));                                   // the wet shine
    // the maw: a ring of meat, a ring of teeth, and a throat
    b.oval(9, 16 - o, 5, 6, MEAT); b.oval(9, 16 - o, 3.2, 4.2, CLOT); b.oval(9, 16 - o, 1.5, 2, "#1e0810");
    for (const [x, y] of [[9, 11], [6, 13], [12, 13], [5, 16], [12, 17], [6, 19], [11, 20], [8, 21]]) px(x, y - o, BONE);
    px(8, 22 - o, BILE); px(8, 23 - o, BILE); if (f) px(8, 24, BILE);
    px(28, 27, slick); px(29, 27, under);
  },
  /** 반쪽 악어 — an alligator hauling itself along on two legs, towing a bare spine. */
  gatorhalf(b, f, px, line) {
    const hide = "#5d7a4c", belly = "#c2bc88", o = f ? 1 : 0;
    // the spine it drags
    for (let i = 0; i < 6; i++) { const x = 20 + i * 2, y = 22 + Math.round(i * 0.6) + (i % 2 ? o : 0); b.r(x, y, 1, 2, BONE); px(x + 1, y + 1, CLOT); if (i % 2 === 0) { px(x, y + 2, BONE); px(x, y - 1, BONE); } }
    px(22, 26, GORE); px(26, 27, GORE); if (f) px(29, 27, GORE);
    b.oval(15, 21, 6, 4.5, hide); b.oval(15, 23, 5, 2, belly);
    b.oval(20, 21, 1.5, 4, MEAT); px(20, 20, BONE); px(20, 22, CLOT);
    for (const x of [11, 14, 17]) b.tri([[x, 17], [x + 1, 15], [x + 2, 17]], shade(hide, 0.3));                    // ridges
    b.r(9, 23 + o, 3, 2, hide); b.r(7, 25 + o, 4, 2, hide); px(6, 27, BONE); px(8, 27, BONE);
    b.r(16, 24 - o, 3, 2, shade(hide, 0.3)); b.r(17, 26 - o, 4, 1, shade(hide, 0.3));
    // the jaws
    b.r(1, 16 - o, 11, 3, hide); b.r(2, 15 - o, 3, 1, hide); b.r(1, 21, 10, 2, hide); b.r(1, 22, 10, 1, belly);
    b.r(2, 19 - o, 9, 2 + o, CLOT);
    for (const x of [2, 4, 6, 8]) { px(x, 19 - o, BONE); px(x + 1, 20, BONE); }
    b.r(10, 13 - o, 3, 3, hide); b.r(11, 14 - o, 2, 2, BILE); px(11, 14 - o, DARK);
    px(1, 16 - o, DARK);
  },
  /** 뱀장어 매듭 — a ball of eels wound tight around the one eye they share. */
  eelknot(b, f, px, line) {
    const eel = "#3f5e66", band = "#73a4a0", o = f ? 1 : -1;
    const head = (x, y, dx, dy, dir) => {
      for (const d of [0, 1]) path(line, [[16 + dx * 5, 18 + dy * 5 + d], [x, y + d]], d ? shade(eel, 0.34) : eel);
      b.r(x - 2, y - 1, 5, 3, eel); b.r(dir < 0 ? x - 4 : x + 3, y, 2, 1, eel); b.r(dir < 0 ? x - 4 : x + 3, y + 1, 2, 1, CLOT);
      px(x + dir, y - 1, EYE); px(dir < 0 ? x - 4 : x + 4, y + 1, BONE);
    };
    head(5, 22 + o, -1, 0.5, -1); head(25, 7 - o, 1, -1.3, 1); head(27, 24 + o, 1.4, 0.9, 1);
    b.oval(16, 18, 8.5, 8, eel); b.oval(17, 21, 7, 4.5, shade(eel, 0.3));
    for (const pts of [[[9, 15], [13, 11], [19, 10], [23, 14]], [[8, 20], [12, 24], [18, 25], [23, 22]], [[11, 12], [10, 17], [12, 22]], [[21, 12], [23, 17], [21, 23]]]) path(line, pts, band);
    // the one eye they share
    b.oval(16, 18, 4.2, 3.8, EYE); b.oval(16 + (f ? 1 : 0), 18, 2.2, 2.4, "#d8b030"); b.r(16 + (f ? 1 : 0), 16, 1, 5, DARK);
    px(12, 17, GORE); px(13, 20, GORE); px(19, 20, GORE); px(20, 17, GORE);
    px(15, 26, BILE); if (f) px(15, 27, BILE);
  },
  // ── cave
  /** 손가락 거미 — it walks on fingers. Whose, nobody has asked. */
  spiderhand(b, f, px, line) {
    const skin = "#d8b2a0", joint = "#a47670", body = "#3c2f40";
    // five fingers, each with a knuckle and a nail
    const finger = (x0, kx, ky, tx, lift) => {
      for (const d of [-1, 0, 1]) path(line, [[x0 + d, 17], [kx + d, ky], [tx + d, 26 - lift]], d > 0 ? joint : skin);
      b.r(kx - 1, ky - 1, 3, 2, joint); px(kx - 1, ky - 1, skin);
      b.r(tx - 1, 25 - lift, 3, 3, skin); b.r(tx - 1, 26 - lift, 2, 2, "#f6ebe6"); px(tx + 1, 27 - lift, joint);
    };
    finger(12, 5, 11, 3, f ? 2 : 0); finger(13, 9, 9, 8, f ? 0 : 2); finger(19, 23, 9, 24, f ? 2 : 0); finger(20, 27, 11, 28, f ? 0 : 2);
    finger(16, 15, 21, 14, 0);
    b.r(23, 12, 5, 6, skin); b.r(26, 12, 2, 6, MEAT); px(27, 14, BONE); px(27, 15, BONE); px(27, 18, GORE); if (f) px(27, 19, GORE);   // the wrist it was cut from
    b.oval(18, 15, 6, 5, "#c79c8e"); b.oval(19, 17, 5, 3, joint);
    for (const x of [15, 18, 21]) { px(x, 12, joint); px(x, 13, joint); }                                         // tendons
    b.oval(11, 17, 3.5, 3, body);
    for (const [x, y] of [[9, 15], [11, 15], [8, 17], [10, 17]]) px(x, y, GORE);
    px(8, 19, BONE); px(10, 20, BONE);
    b.r(17, 14, 3, 3, EYE); px(18 - (f ? 1 : 0), 15, GORE); px(17, 14, "#ffd0d0");                                // and an eye opened in the back of it
    px(18, 20, CLOT);
  },
  /** 아가리 곰 — a bear that eats with its chest. The head on top is only for watching. */
  bearmaw(b, f, px, line) {
    const fur = "#4c3a36", o = f ? 1 : 0;
    b.r(9, 24, 5, 4, shade(fur, 0.3)); b.r(19, 24, 5, 4, shade(fur, 0.3));
    b.oval(16, 16, 10, 10, fur); b.oval(18, 20, 8, 6, shade(fur, 0.28));
    // arms that hang to the ground
    b.r(3, 12, 4, 13, fur); b.r(25, 12, 4, 13, shade(fur, 0.3)); b.oval(5, 12, 3, 3, fur); b.oval(27, 12, 3, 3, shade(fur, 0.3));
    for (const x of [3, 5, 7]) { px(x - 1, 25, BONE); px(x - 1, 26, BONE); } for (const x of [25, 27, 29]) { px(x, 25, BONE); px(x, 26, BONE); }
    // a small head, sunk between the shoulders
    b.oval(15, 6, 4, 3.5, fur); b.r(11, 2, 2, 2, fur); b.r(18, 2, 2, 2, fur); b.r(12, 7, 3, 2, shade(fur, 0.3));
    px(13, 5, GORE); px(16, 5, GORE); px(12, 8, DARK);
    // the maw in the chest
    b.oval(15, 17 + o * 0.5, 4.5, 6.5 + o, CLOT); b.oval(15, 17, 2.4, 4.5, "#1e0810");
    for (let y = 12; y <= 22; y += 2) { px(11 + (y % 4 ? 1 : 0), y, BONE); px(18 + (y % 4 ? 0 : 1), y + 1, BONE); }
    b.r(14, 20, 2, 4 + o, GUT); px(15, 24 + o, "#a84a5c");
    px(13, 24, GORE); px(13, 25, GORE); if (f) px(13, 26, GORE); px(17, 24, GORE);
  },
  /** 목 꺾인 올빼미 — an owl whose head went all the way round and stayed there. */
  owlstare(b, f, px, line) {
    const plume = "#7b6a5c", dark = "#52443e", pale = "#cbbba2", gold = "#d8a850", socket = "#1c1420";
    const up = f ? -3 : 1;
    b.tri([[10, 16], [1, 13 + up], [3, 22 + up], [10, 23]], dark); b.tri([[22, 16], [31, 13 + up], [29, 22 + up], [22, 23]], dark);
    path(line, [[9, 17], [2, 14 + up]], plume); path(line, [[23, 17], [30, 14 + up]], plume);
    b.oval(16, 21, 6.5, 6, plume); b.oval(16, 22.5, 4.5, 3.6, pale);
    for (const [x, y] of [[14, 21], [18, 21], [16, 23], [14, 25], [18, 25]]) px(x, y, dark);
    b.r(12, 26, 2, 2, BONE); b.r(18, 26, 2, 2, BONE); px(11, 27, BONE); px(20, 27, BONE);
    // the neck, wrung like a cloth
    b.r(13, 13, 6, 3, dark); px(14, 14, CLOT); px(17, 13, CLOT); px(15, 15, GORE);
    // the head, upside down: the beak points at the sky, the ear tufts hang, and it weeps upward
    b.oval(16, 7, 7.5, 5.5, plume); b.oval(16, 8, 6, 4, pale);
    b.r(8, 10, 2, 5, plume); px(8, 15, plume); b.r(22, 10, 2, 5, plume); px(23, 15, plume);
    b.r(11, 6, 4, 4, socket); b.r(17, 6, 4, 4, socket); px(13, 8, f ? "#ff7a30" : GORE); px(18, 8, f ? "#ff7a30" : GORE);
    b.r(15, 2, 2, 3, gold); px(14, 4, gold); px(17, 4, gold); px(16, 1, gold); px(16, 3, shade(gold, 0.34));
    px(12, 5, GORE); px(12, 4, GORE); px(19, 5, GORE); if (f) px(19, 4, GORE);
    px(13, 11, dark); px(14, 12, dark); px(18, 11, dark); px(17, 12, dark);                                         // brows, under the eyes now
  },
  // ── abyss
  /** 쌍두 염소 — two heads, four horns, and pupils that look sideways at everything. */
  twingoat(b, f, px, line) {
    const wool = "#c9c1b0", horn = "#9c8c78", ridge = "#5e5048", o = f ? 1 : 0;
    for (const [x, k] of [[15, 0], [18, 1], [23, 1], [26, 0]]) { b.r(x, 22, 2, 5 - (k === o ? 1 : 0), shade(wool, 0.36)); b.r(x, 27 - (k === o ? 1 : 0), 2, 1, ridge); }
    b.oval(21, 18, 7, 5, wool); b.oval(22, 21, 6, 2.6, shade(wool, 0.24));
    for (const x of [17, 20, 23, 26]) px(x, 23, shade(wool, 0.34));
    px(28, 15, wool); px(29, 14, shade(wool, 0.3));
    const head = (x, y, lift) => {
      b.tri([[15, 14], [19, 21], [x + 3, y + 3], [x + 1, y - 2]], wool);                                           // a neck thick enough to carry it
      b.oval(x, y, 3.4, 3, wool); b.r(x - 6, y, 4, 3, wool); b.r(x - 6, y + 2, 4, 1, shade(wool, 0.3)); px(x - 6, y + 1, DARK);
      b.r(x - 2, y - 1, 3, 2, "#e0b830"); b.r(x - 2, y, 3, 1, DARK);                                               // the sideways pupil
      for (const d of [0, 1]) { path(line, [[x + 1, y - 3 + d], [x + 4, y - 6 + lift + d], [x + 7, y - 5 + lift + d]], d ? ridge : horn); path(line, [[x - 1, y - 3 + d], [x + 1, y - 7 + lift + d], [x + 5, y - 9 + lift + d]], d ? ridge : horn); }
      px(x - 5, y + 3, shade(wool, 0.3)); px(x - 5, y + 4, shade(wool, 0.3)); px(x - 4, y + 3, wool);              // beard
    };
    head(9, 21, 0); head(11, 10 - o, 1);
    for (let y = 14; y <= 20; y++) px(15 + (y % 3 === 0 ? 1 : 0), y, y % 2 ? DARK : GORE);                          // where the necks part
    px(3, 25, GORE); if (f) px(3, 26, GORE); px(5, 14 - o, GORE);
  },
  /** 반쪽 말 — a horse that kept walking after it lost its head; something filled the gap. */
  horsehalf(b, f, px, line) {
    const coat = "#7c5048", mane = "#2c2028", tent = "#a8507e", sucker = "#e6a6c6", o = f ? 1 : -1, s = f ? 1 : 0;
    for (const [x, k] of [[12, 0], [15, 1], [22, 1], [25, 0]]) { b.r(x, 20, 2, 7 - (k === s ? 1 : 0), shade(coat, 0.32)); b.r(x, 27 - (k === s ? 1 : 0), 2, 1, DARK); }
    b.oval(19, 17, 8, 4.8, coat); b.oval(20, 19, 7, 2.6, shade(coat, 0.26));
    path(line, [[27, 15], [30, 18], [29, 24]], mane); path(line, [[28, 15], [31, 19], [30, 23]], mane); px(29, 25, mane);
    b.tri([[13, 20], [16, 14], [11, 9], [7, 12]], coat);
    for (const [x, y] of [[14, 13], [13, 11], [15, 15], [12, 10]]) px(x, y, mane);                                 // what is left of the mane
    // where the head was, and what grew there instead
    const arm = [[9, 10], [8 + o, 6], [10, 3], [7 - o, 1], [3, 3], [1, 7 + o]];
    for (const d of [0, 1]) { path(line, arm.map(([x, y]) => [x + 1, y + d]), d ? shade(tent, 0.34) : tent); path(line, arm.map(([x, y]) => [x, y + d]), d ? shade(tent, 0.34) : tent); }
    for (const [x, y] of [[8 + o, 7], [9, 4], [5, 3], [2, 5]]) px(x, y, sucker);
    path(line, [[11, 10], [13, 6 - o], [12, 3]], tent); px(12, 2, sucker);                                          // and a thinner one, feeling the air
    b.oval(9, 11, 3, 2.2, MEAT); px(7, 10, BONE); px(11, 10, BONE); px(9, 12, CLOT); px(8, 11, CLOT);
    px(8, 14, GORE); px(8, 15, GORE); px(10, 14, GORE); if (f) px(10, 16, GORE);
  },
  /** 날개 구렁이 — a serpent that grew wings and never learned to land. */
  serpentwing(b, f, px, line) {
    const scale = "#8a3040", belly = "#d6c890", skin = "#5c3c5c", eye = "#e8c840";
    const up = f ? -4 : 1;
    b.tri([[15, 14], [4, 7 + up], [3, 15 + up], [9, 17 + (up >> 1)], [14, 17]], skin); b.tri([[19, 14], [30, 7 + up], [31, 15 + up], [25, 17 + (up >> 1)], [20, 17]], skin);
    path(line, [[15, 14], [4, 7 + up]], BONE); path(line, [[15, 15], [3, 15 + up]], BONE); path(line, [[19, 14], [30, 7 + up]], BONE); path(line, [[19, 15], [31, 15 + up]], BONE);
    const body = [[11, 9], [14, 11], [17, 14], [19, 18], [17, 22], [20, 25], [25, 25], [28, 22]];
    path(line, body.map(([x, y]) => [x, y + 2]), belly);
    for (const d of [-1, 0, 1]) path(line, body.map(([x, y]) => [x, y + d]), scale);
    path(line, body.map(([x, y]) => [x + 1, y + 1]), shade(scale, 0.34));
    px(29, 21, scale); px(30, 20, shade(scale, 0.3));
    // the head: mostly jaw
    b.oval(9, 7, 4, 3, scale); b.r(2, 6, 6, 3, scale); b.r(2, 9, 6, 1 + (f ? 1 : 0), CLOT); b.r(3, 10 + (f ? 1 : 0), 6, 1, shade(scale, 0.34));
    px(2, 9, BONE); px(5, 9, BONE); px(4, 9 + (f ? 1 : 0), BONE);
    b.r(8, 5, 2, 2, eye); px(8, 6, DARK); px(1, 10, GORE); px(0, 11, GORE); px(11, 4, scale); px(12, 3, shade(scale, 0.3));
  },
};

/** 균열의 군주 — a beast-king stitched from four animals around a hole in the world. Drawn at 96×96. */
function riftLord(b, f, px, line) {
  const tan = "#8a6a52", black = "#3a3040", green = "#55704a", rift = "#ff72d6";
  const o = f ? -1 : 0;
  // the serpent that is its tail
  const tail = [[70, 62], [80, 56], [86, 44], [82, 32 + o * 2], [76, 28 + o * 2]];
  for (const d of [-2, -1, 0, 1, 2]) path(line, tail.map(([x, y]) => [x + d, y]), d > 0 ? shade(green, 0.3) : green);
  b.oval(74, 27 + o * 2, 5, 4, green); b.r(67, 27 + o * 2, 5, 3, green); b.r(67, 30 + o * 2, 5, 1, CLOT); px(68, 30 + o * 2, BONE); px(70, 30 + o * 2, BONE);
  b.r(73, 25 + o * 2, 2, 2, "#d8b030"); px(65, 31 + o * 2, GORE); px(64, 32 + o * 2, GORE);
  // legs: a bear's on one side, a bird's on the other
  b.r(24, 62, 12, 22, black); b.r(22, 82, 16, 5, black); for (const x of [22, 27, 32]) b.r(x, 86, 3, 4, BONE);
  b.r(60, 62, 8, 20, tan); b.r(62, 80, 3, 8, "#d8a850"); for (const d of [-4, 0, 4]) b.r(62 + d, 86, 3, 3, "#d8a850"); for (const d of [-4, 0, 4]) px(62 + d, 89, BONE);
  b.r(40, 70, 9, 16, shade(tan, 0.34)); b.r(38, 84, 13, 4, shade(tan, 0.34));
  // the body, in three hides
  b.oval(48, 56, 27, 18, tan);
  b.oval(34, 54, 13, 15, black); b.oval(64, 60, 11, 12, green);
  b.oval(48, 66, 24, 8, shade(tan, 0.3));
  for (let y = 40; y <= 70; y += 3) { px(45, y, DARK); px(46, y + 1, GORE); px(56, y + 1, DARK); px(55, y, BONE); }   // the stitches
  for (const [x, y] of [[60, 54], [66, 58], [62, 64], [69, 62], [64, 52]]) b.r(x, y, 2, 1, shade(green, 0.34));
  // the chest, torn open on the rift
  b.oval(49, 58, 9, 11, CLOT);
  for (let y = 49; y <= 67; y += 3) { b.r(41, y, 6, 1, BONE); b.r(52, y, 6, 1, BONE); }
  b.oval(49, 58, 4 + (f ? 1 : 0), 6 + (f ? 1 : 0), rift); b.oval(49, 58, 2, 3, "#ffffff");
  for (const y of [70, 73, 76]) px(48 + (y % 2), y + (f ? 1 : 0), GORE);
  // a wolf's head, low and to the left
  b.tri([[28, 46], [36, 52], [20, 40], [16, 44]], black);
  b.oval(16, 40, 9, 7, black); b.r(2, 40, 12, 5, black); b.r(3, 45, 11, 3 + (f ? 1 : 0), CLOT);
  for (const x of [3, 6, 9, 12]) { px(x, 45, BONE); px(x, 46, BONE); px(x + 1, 47 + (f ? 1 : 0), BONE); }
  b.tri([[18, 34], [21, 26], [24, 35]], black); b.tri([[11, 35], [13, 28], [16, 35]], black);
  b.r(13, 37, 3, 3, GORE); px(13, 37, "#ffb0b0"); px(2, 41, DARK); px(4, 49, GORE); px(4, 50, GORE); if (f) px(4, 51, GORE);
  // a vulture's, on a neck with no feathers
  for (const d of [0, 1, 2, 3]) path(line, [[66 + d, 44], [70 + d, 30], [66 + d, 18 + o]], d > 1 ? "#a86a70" : "#c88a8a");
  b.oval(64, 16 + o, 6, 5, "#c88a8a"); b.tri([[59, 15 + o], [50, 19 + o], [59, 20 + o]], "#d8a850"); px(51, 19 + o, DARK); px(50, 21 + o, GORE);
  b.r(62, 14 + o, 2, 2, DARK); px(62, 14 + o, rift);
  for (let x = 64; x <= 72; x += 2) px(x, 40 + (x % 4 ? 1 : 0), WHITE);                                             // a ruff of dirty down
  // and the goat's skull that wears the crown
  b.tri([[42, 44], [56, 44], [53, 30], [44, 30]], tan);
  b.oval(48, 26 + o, 9, 8, BONE); b.r(43, 30 + o, 10, 9, BONE); b.r(44, 38 + o, 8, 2, shade(BONE, 0.3));
  b.r(43, 24 + o, 4, 5, "#1e0810"); b.r(50, 24 + o, 4, 5, "#1e0810"); px(45, 26 + o, rift); px(51, 26 + o, rift); px(44, 27 + o, f ? "#ffffff" : rift);
  b.r(47, 32 + o, 2, 4, "#1e0810"); for (const x of [44, 46, 48, 50]) px(x, 39 + o, "#1e0810");
  for (const s of [-1, 1]) { const x = 48 + s * 8; path(line, [[x, 21 + o], [x + s * 7, 15 + o], [x + s * 12, 19 + o], [x + s * 10, 26 + o]], "#4a3a36"); path(line, [[x, 22 + o], [x + s * 7, 16 + o], [x + s * 12, 20 + o], [x + s * 10, 27 + o]], "#2c2028"); path(line, [[x, 20 + o], [x + s * 7, 14 + o], [x + s * 13, 19 + o]], "#4a3a36"); }
  [[40, 6], [44, 9], [48, 12], [52, 9], [56, 6]].forEach(([x, h], i) => { const y = 13 + o * 2; b.tri([[x - 2, y], [x + 2, y], [x, y - h]], i % 2 ? rift : BONE); });
  b.r(38, 13 + o * 2, 20, 2, BONE); px(48, 14 + o * 2, GORE);
}

/** 심연의 어미 — the mother of all of it: one swollen body, five necks, and a brood still inside. Drawn at 96×96. */
function abyssMother(b, f, px, line) {
  const flesh = "#b89a9c", dark = "#7c5c6a", o = f ? -1 : 0;
  // six legs, jointed like an insect's and tipped with bone
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x0 = 48 + s * (14 + i * 7), kx = 48 + s * (26 + i * 8), ky = 56 + i * 3 + (i % 2 === (f ? 1 : 0) ? -2 : 0), tx = 48 + s * (30 + i * 7);
    for (const d of [0, 1, 2]) { path(line, [[x0 + d * s, 62], [kx + d * s, ky], [tx + d * s, 88]], d ? dark : shade(flesh, 0.12)); }
    b.r(Math.min(tx, tx + s * 2), 86, 3, 4, BONE);
  }
  // five necks, five heads
  const neck = (x0, pts, col) => { for (const d of [-2, -1, 0, 1, 2]) path(line, [[x0 + d, 50], ...pts.map(([x, y]) => [x + d, y])], d > 0 ? shade(col, 0.3) : col); };
  neck(26, [[18, 36], [14, 26 + o]], "#3a3040");                                    // wolf
  b.oval(13, 23 + o, 7, 5, "#3a3040"); b.r(2, 23 + o, 8, 4, "#3a3040"); b.r(3, 27 + o, 7, 2, CLOT); for (const x of [3, 6, 9]) px(x, 27 + o, BONE); b.r(11, 21 + o, 2, 2, GORE); b.tri([[14, 19 + o], [16, 13 + o], [18, 20 + o]], "#3a3040");
  neck(36, [[32, 30], [30, 16 - o]], "#c6beae");                                    // goat
  b.oval(29, 13 - o, 6, 5, "#c6beae"); b.r(21, 13 - o, 6, 5, "#c6beae"); px(21, 15 - o, DARK); b.r(27, 11 - o, 3, 2, "#d8b030"); b.r(27, 12 - o, 3, 1, DARK);
  path(line, [[31, 8 - o], [36, 3 - o], [40, 5 - o]], "#4a3a36"); path(line, [[31, 9 - o], [36, 4 - o], [40, 6 - o]], "#4a3a36"); px(22, 19 - o, shade("#c6beae", 0.3)); px(22, 20 - o, shade("#c6beae", 0.3));
  neck(48, [[48, 28], [48, 12 + o]], BONE);                                         // a horse's skull, in the middle
  b.oval(48, 9 + o, 6, 6, BONE); b.r(44, 12 + o, 8, 12, BONE); b.r(45, 23 + o, 6, 2, shade(BONE, 0.3)); b.r(44, 7 + o, 3, 4, "#1e0810"); b.r(50, 7 + o, 3, 4, "#1e0810"); px(45, 9 + o, GORE); px(51, 9 + o, GORE);
  for (const x of [45, 47, 49]) px(x, 24 + o, "#1e0810"); b.r(47, 15 + o, 2, 5, shade(BONE, 0.3));
  neck(60, [[64, 30], [66, 16 - o]], "#3a3348");                                    // crow
  b.oval(67, 13 - o, 6, 5, "#3a3348"); b.tri([[72, 11 - o], [80, 15 - o], [72, 16 - o]], BONE); px(79, 15 - o, GORE); orb(b, px, 67, 11 - o, GORE, 1); orb(b, px, 64, 14 - o, GORE, 2); orb(b, px, 69, 15 - o, GORE, 0);
  neck(70, [[78, 36], [82, 26 + o]], "#7c2c3c");                                    // serpent
  b.oval(83, 23 + o, 7, 5, "#7c2c3c"); b.r(86, 23 + o, 8, 4, "#7c2c3c"); b.r(86, 27 + o, 7, 2, CLOT); px(87, 27 + o, BONE); px(91, 27 + o, BONE); b.r(83, 21 + o, 2, 2, "#d8b030"); px(94, 28 + o, GORE); px(95, 29 + o, GORE);
  // the body
  b.oval(48, 62, 31, 19, flesh); b.oval(48, 70, 28, 11, dark);
  b.oval(36, 54, 12, 7, lt(flesh, 1.12));
  for (const [x, y] of [[26, 58], [30, 64], [66, 56], [70, 62], [58, 50], [38, 50]]) path(line, [[x, y], [x + 3, y + 2], [x + 2, y + 5]], "#8a5a9a");   // veins
  // the brood: sacs along the belly, each with something curled inside
  for (let i = 0; i < 6; i++) { const x = 22 + i * 10, y = 76 + (i % 2 ? 2 : 0) + (i % 2 === (f ? 1 : 0) ? 1 : 0); b.oval(x, y, 4.5, 5, BILE); b.oval(x + 1, y + 1, 2.5, 3, shade(BILE, 0.4)); px(x, y, DARK); px(x - 2, y - 2, "#f0ffb0"); }
  // the mouth it feeds them from
  b.oval(48, 60, 6 + (f ? 1 : 0), 11, CLOT); b.oval(48, 60, 3, 8, "#1e0810");
  for (let y = 51; y <= 69; y += 3) { b.r(42 - (f ? 1 : 0), y, 2, 2, BONE); b.r(52 + (f ? 1 : 0), y + 1, 2, 2, BONE); }
  b.r(47, 66, 3, 8 + (f ? 1 : 0), GUT); px(48, 74 + (f ? 1 : 0), "#a84a5c");
  for (const [x, y] of [[44, 74], [45, 77], [52, 73], [53, 76], [50, 80]]) px(x, y + (f ? 1 : 0), GORE);
  for (const [x, y] of [[20, 52], [76, 52], [48, 44]]) { px(x, y, DARK); px(x + 1, y + 1, GORE); px(x + 2, y, DARK); px(x + 3, y + 1, GORE); }   // old stitches
}

// A treasure chest: iron-bound wood with a gold lock that glints now and then.
MOB.chest = (b, f) => {
  b.r(8, 17, 16, 11, "#9a6238"); b.r(8, 24, 16, 4, "#74462a"); b.r(9, 13, 14, 5, "#b47a46"); b.r(8, 14, 16, 3, "#b47a46"); b.r(10, 13, 12, 1, "#d49a5e");
  for (const x of [10, 20]) { b.r(x, 13, 2, 15, "#5a6074"); b.r(x, 13, 1, 15, "#8a90a4"); }
  b.r(8, 17, 16, 1, "#4a3020");
  b.r(14, 16, 4, 5, "#f0c040"); b.r(15, 18, 2, 2, "#6a4a18"); b.r(14, 16, 4, 1, "#fff0a0");
  if (f) { b.r(13, 15, 1, 1, "#ffffff"); b.r(18, 14, 1, 1, "#fff8d0"); }
};

// ── round two: further gone
Object.assign(MOB, {
  /** 뒤집힌 양 — a lamb turned inside out: the ribs are worn on the outside now, and the wool is where its insides were. */
  lambmaw(b, f, px, line) {
    const flesh = "#b04452", wet = "#cf6670", wool = "#efe8dc", fluff = "#c9bfbe", o = f ? 1 : 0;
    for (const [x, k] of [[12, 0], [15, 1], [21, 1], [24, 0]]) { b.r(x, 22, 2, 5 - (k === o ? 1 : 0), shade(flesh, 0.36)); b.r(x, 27 - (k === o ? 1 : 0), 2, 1, DARK); }
    b.oval(19, 18, 8, 5.5, flesh); b.oval(20, 21, 7, 2.6, shade(flesh, 0.3));
    // the fleece it kept: a tail, and what spills from the split belly
    b.r(26, 14, 4, 4, wool); b.r(27, 18, 2, 1, fluff); px(30, 15, fluff);
    b.oval(19, 24, 5, 2, wool); b.r(16, 25, 2, 1 + o, fluff); b.r(20, 25, 2, 2 - o, fluff);
    // spine and ribs, on the outside
    b.r(12, 12, 14, 1, BONE); px(12, 13, shade(BONE, 0.3));
    for (const x of [14, 17, 20, 23]) { b.r(x, 13, 1, 8, BONE); px(x, 21, shade(BONE, 0.34)); px(x - 1, 20, BONE); }
    // the head: no skin, no lids, and its mouth is full of wool
    b.tri([[12, 20], [14, 14], [9, 12], [7, 16]], flesh);
    b.oval(7, 15, 3.8, 3.4, wet); b.r(2, 16, 4, 3, wet); b.r(2, 18, 4, 1, shade(wet, 0.36)); px(2, 17, DARK);
    b.r(9, 10, 2, 3, flesh); px(11, 11, shade(flesh, 0.3));
    b.r(5, 13, 3, 3, EYE); px(6, 14, DARK); px(5, 13, "#ffd0d0");
    b.r(0, 19, 4, 3 + o, wool); px(1, 22 + o, fluff); px(3, 22 + o, fluff);
    px(9, 18, GORE); px(9, 19, GORE); if (f) px(9, 20, GORE);
    px(25, 23, GORE); px(25, 24, GORE); if (!f) px(25, 25, GORE);
  },
  /** 꼬인 여우 — two foxes wrung together like wet cloth. One still walks; the other runs at the sky. */
  foxtwine(b, f, px, line) {
    const fur = "#c8643c", dark = "#8f3f2a", white = "#f0e6d8", sock = "#3a2a30", o = f ? 1 : 0;
    // the near one's legs walk; the far one's point at the sky and keep running
    b.r(8, 22, 2, 5 - o, sock); b.r(12, 22, 2, 4 + o, sock);
    b.r(18, 6 + o, 2, 8 - o, fur); b.r(18, 6 + o, 2, 3, sock); b.r(22, 7 - o, 2, 7 + o, fur); b.r(22, 7 - o, 2, 3, sock);
    // one brush between them, kinked where the twist is
    limb(line, [[14, 13], [12, 9], [14, 6], [12, 3]], fur, dark); b.r(11, 1, 3, 2, white);
    // the trunk: two bodies wrung into one rope
    b.oval(15, 17, 8, 4.6, fur); b.oval(15, 19.6, 7, 2, dark);
    for (const x of [9, 13, 17]) { path(line, [[x, 14], [x + 3, 20]], white); path(line, [[x + 1, 14], [x + 4, 20]], dark); }
    // one head the right way up, low, facing left
    b.oval(6, 20, 3.6, 3, fur); b.tri([[5, 19], [0, 22], [5, 23]], fur); b.r(1, 22, 4, 1, white); px(0, 22, DARK);
    b.tri([[4, 18], [5, 13], [8, 18]], fur); px(5, 15, DARK); px(5, 16, DARK);
    b.r(5, 19, 2, 2, GORE); px(5, 19, "#ff9a9a");
    px(2, 24, GORE); if (f) px(2, 25, GORE);
    // the other upside down at the far end: chin to the sky, ears hanging, tongue falling the wrong way
    b.oval(25, 18, 4, 3.4, fur); b.tri([[27, 16], [32, 19], [27, 21]], fur); b.r(27, 16, 5, 1, white); px(31, 17, DARK);
    b.tri([[22, 20], [23, 26], [26, 21]], fur); px(23, 23, DARK); px(24, 22, DARK);
    b.tri([[26, 21], [28, 26], [29, 21]], dark); px(28, 24, sock);
    b.r(25, 18, 2, 2, GORE); px(26, 19, "#ff9a9a");
    px(29, 15, GUT); px(30, 14, GUT); px(30, 13 - o, GUT); px(30, 12 - o, GORE);
    for (let y = 14; y <= 20; y += 2) px(15, y, DARK);                                  // where they were tied
  },
  /** 알 밴 두꺼비 — a toad whose back is a comb of pits. Something looks out of every one. */
  toadbrood(b, f, px, line) {
    const skin = "#6f7446", dark = "#4c5234", belly = "#c2bb8e", pit = "#241820", milk = "#d6d2b4";
    b.r(21, 23, 8, 3, dark); b.r(25, 26, 6, 1, skin); b.r(6, 24, 3, 3, dark); b.r(3, 27, 5, 1, skin);
    b.oval(18, 18, 10.5, 7.5, skin); b.oval(18, 23, 9, 2.6, belly);
    // the head: low, wide and blind
    b.oval(7, 20, 5, 4, skin); b.r(2, 22, 9, 1, DARK); px(2, 21, DARK); b.r(3, 23, 7, 1, belly);
    b.r(4, 14, 4, 4, skin); b.r(4, 15, 3, 3, milk); px(5, 16, "#a8a48c");
    b.r(9, 13, 4, 4, skin); b.r(9, 14, 3, 3, milk); px(10, 15, "#a8a48c");
    // the back: five pits; an eye in most of them, a hatchling climbing out of the others
    [[13, 10], [19, 9], [24, 13], [16, 15], [22, 18]].forEach(([x, y], i) => {
      b.r(x - 1, y, 5, 3, dark); b.r(x, y - 1, 3, 5, dark); b.r(x, y, 3, 3, pit);
      if (i === 1 || i === 3) {
        const up = (i + f) % 2 ? 2 : 0;
        b.r(x, y - up, 3, 3, BILE); px(x, y - up + 1, DARK); px(x + 2, y - up + 1, DARK); if (up) b.r(x + 1, y + 1, 1, 2, shade(BILE, 0.4));
      } else if (i === 4 && f) b.r(x, y + 1, 3, 1, dark);                                 // this one blinks
      else { b.r(x, y, 3, 3, EYE); px(x + ((i + f) % 3), y + 1, i === 2 ? "#c8a020" : GORE); }
    });
    px(4, 24, BILE); if (f) px(4, 25, BILE);
  },
  /** 촉수 쥐 — a rat whose head came open like a flower. The teeth are in the middle. */
  squidrat(b, f, px, line) {
    const fur = "#6a5e68", tent = "#b0607c", sucker = "#eab0c4", o = f ? 1 : -1;
    limb(line, [[26, 23], [29, 21], [30, 17], [28, 13], [30, 10]], GUT, "#a84a5c");                       // a long bare tail
    b.oval(20, 21, 7, 5, fur); b.oval(21, 24, 6, 2.4, shade(fur, 0.32));
    b.r(15, 26, 3, 2, PINK); b.r(22, 26, 4, 2, PINK); px(14, 27, PINK); px(21, 27, PINK);
    b.oval(15, 15, 2.4, 2.2, fur); px(15, 15, PINK); px(14, 15, PINK);                                    // an ear, still attached to nothing
    // the head, peeled into five arms
    const arms = [
      [[13, 18], [11, 13], [9, 9 + o], [11, 5]],
      [[12, 19], [8, 15 + o], [4, 13], [1, 9 - o]],
      [[12, 20], [7, 19], [3, 19 + o], [0, 17]],
      [[12, 21], [8, 23], [4, 24 - o], [1, 26]],
      [[13, 22], [10, 25 + o], [7, 27]],
    ];
    for (const pts of arms) limb(line, pts, tent);
    for (const pts of arms) { const [x, y] = pts[pts.length - 2]; px(x, y, sucker); px(pts[1][0], pts[1][1], sucker); }
    b.oval(13, 20, 2.6, 3, CLOT); px(13, 20, "#1e0810"); px(13, 21, "#1e0810");
    px(12, 18, BONE); px(14, 19, BONE); px(12, 22, BONE); px(14, 22, BONE); px(11, 20, BONE);
    px(11, 24, GORE); if (f) px(11, 25, GORE);
  },
  /** 두개골 게 — a crab that moved into a skull and grew more claws than it can count. */
  crabskull(b, f, px, line) {
    const shell = "#8a3a36", claw = "#b4503e", tip = "#ecd2b8", socket = "#1c1420", o = f ? 1 : 0;
    for (const [x0, x1] of [[11, 6], [13, 9], [19, 23], [21, 26]]) path(line, [[x0, 22], [x1, 24 + ((x0 + o) % 2)], [x1 + (x1 < 16 ? -1 : 1), 27]], shell);
    // three claws a side, no two the same
    const pincer = (x, y, s, big, open, ax, ay) => {
      path(line, [[ax, ay], [x, y]], shell);
      b.oval(x, y, big ? 3 : 2, big ? 2.6 : 1.8, claw);
      const n = big ? 5 : 3;
      path(line, [[x + s * 2, y - 1], [x + s * n, y - 2 - open]], claw); path(line, [[x + s * 2, y + 1], [x + s * n, y + 1 + open]], claw);
      px(x + s * n, y - 2 - open, tip); px(x + s * n, y + 1 + open, tip);
    };
    pincer(6, 19, -1, true, o, 10, 22); pincer(5, 25, -1, false, 1 - o, 9, 23); pincer(7, 9, -1, false, o, 10, 14);
    pincer(26, 20, 1, true, 1 - o, 22, 22); pincer(27, 25, 1, false, o, 23, 23); pincer(25, 8, 1, false, 1 - o, 22, 13);
    b.oval(16, 23, 8, 3.2, shell); b.oval(16, 24.6, 7, 1.6, shade(shell, 0.32));
    // the skull it wears
    b.oval(16, 13, 6.5, 6, BONE); b.r(12, 17, 9, 3, BONE); b.r(20, 10, 2, 8, shade(BONE, 0.18)); b.r(12, 19, 9, 1, shade(BONE, 0.3));
    b.r(11, 11, 4, 4, socket); b.r(17, 11, 4, 4, socket); b.r(15, 16, 2, 2, socket);
    for (const x of [13, 15, 17, 19]) px(x, 20, BONE);
    path(line, [[18, 7], [19, 9], [18, 10]], "#8a7a70");
    // its own eyes, on stalks, out through the sockets
    path(line, [[12, 13], [11, 8], [10, 4 - o]], claw); b.r(9, 2 - o, 2, 2, GORE); px(9, 2 - o, "#ff9a9a");
    path(line, [[19, 13], [21, 8], [22, 3 + o]], claw); b.r(22, 1 + o, 2, 2, GORE); px(22, 1 + o, "#ff9a9a");
  },
  /** 눈먼 두더지 — no eyes, a nose made of fingers, and a jaw that opens the wrong way. */
  moleworm(b, f, px, line) {
    const pelt = "#4a4454", paw = "#e0a8a0", nail = "#f6ebe6", o = f ? 1 : 0;
    b.r(28, 22, 3, 1, paw); px(31, 21, paw);
    b.oval(20, 20, 9, 6, pelt); b.oval(21, 23.4, 8, 2.8, shade(pelt, 0.34));
    b.r(22, 26, 5, 2, paw); px(21, 27, nail); px(23, 27, nail); px(25, 27, nail);
    b.oval(11, 18, 5.5, 5, pelt);
    px(11, 15, DARK); px(13, 15, DARK); px(12, 16, "#6a6474");                                             // a seam where an eye was
    // the jaw: split down the middle, each half swinging out sideways
    b.tri([[6, 20], [4, 27], [9, 27], [11, 21]], CLOT);
    b.tri([[5, 20], [1 - o, 25], [4, 26], [7, 22]], pelt); b.tri([[10, 21], [12 + o, 27], [9, 27], [8, 23]], pelt);
    px(3, 24, BONE); px(5, 25, BONE); px(9, 25, BONE); px(10, 24, BONE); px(7, 24, GUT); px(7, 25, GUT); px(7, 26 + o, GUT);
    // one great digging hand
    b.oval(15, 25, 3.5, 2.4, paw); for (const [x, y] of [[11, 25], [12, 27], [14, 28 - 1]]) { px(x, y, nail); px(x - 1, y + (y < 27 ? 1 : 0), nail); }
    // the nose: a star of fingers, feeling for you
    const tips = [[1, 12 + o], [5, 11 - o], [9, 12 + o], [0, 16 - o], [1, 20 + o], [9, 15]];
    for (const [x, y] of tips) { path(line, [[5, 17], [x, y]], paw); px(x, y, nail); }
    b.r(4, 16, 3, 3, MEAT); px(5, 17, CLOT);
  },
  /** 손갈기 사자 — a lion whose mane is a ring of arms, every hand reaching for something. */
  lionhand(b, f, px, line) {
    const coat = "#b98c4e", deep = "#8a6436", pale = "#e0c692", skin = "#e2bca8", knuckle = "#a47670", o = f ? 1 : 0;
    for (const [x, k] of [[20, 0], [22, 1], [26, 1], [28, 0]]) { b.r(x, 23, 2, 4 - (k === o ? 1 : 0), deep); b.r(x, 27 - (k === o ? 1 : 0), 2, 1, DARK); }
    b.oval(24, 20, 6, 4.4, coat); b.oval(24, 22.4, 5, 1.8, deep);
    path(line, [[29, 18], [31, 15], [30, 12]], coat); b.r(29, 10, 2, 2, skin);                                      // the tail ends in a small fist
    b.r(15, 17, 5, 5, coat);                                                                                        // neck
    // the mane: five arms, each as thick as a wrist, and every hand opening and closing
    const cx = 13, cy = 17;
    [180, 225, 270, 315, 135].forEach((deg, i) => {
      const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), open = (i + o) % 2 === 0;
      const at = (r, da = 0) => [Math.round(cx + Math.cos(a + da) * r), Math.round(cy + Math.sin(a + da) * r)];
      const [x0, y0] = at(4), [x1, y1] = at(8);
      const wx = Math.round(-s), wy = Math.round(c);                                                                // across the arm
      path(line, [[x0 + wx, y0 + wy], [x1 + wx, y1 + wy]], knuckle); path(line, [[x0, y0], [x1, y1]], skin); path(line, [[x0 - wx, y0 - wy], [x1 - wx, y1 - wy]], skin);
      const [hx, hy] = at(9.5);
      b.r(hx - 2, hy - 2, 4, 4, skin); px(hx + 1, hy + 1, knuckle);                                                 // the palm
      if (open) for (const da of [-0.3, 0, 0.3]) { const [ax, ay] = at(12, da), [bx, by] = at(13, da); px(ax, ay, skin); px(bx, by, skin); }
      else { const [kx, ky] = at(11.4); b.r(kx - 1, ky - 1, 3, 3, skin); px(kx, ky, knuckle); }
    });
    // the face in the middle of them
    b.oval(cx, cy, 5.6, 5.4, deep); b.oval(cx, cy, 4.6, 4.4, coat);
    b.r(cx - 5, cy, 5, 4, pale); b.r(cx - 5, cy, 2, 1, DARK);
    b.r(cx - 2, cy - 3, 2, 2, GORE); px(cx - 2, cy - 3, "#ff9a9a"); b.r(cx + 2, cy - 3, 2, 2, GORE); px(cx + 2, cy - 3, "#ff9a9a");
    b.r(cx - 5, cy + 3, 5, 1 + o, CLOT); px(cx - 5, cy + 3, BONE); px(cx - 2, cy + 3, BONE);
    px(cx - 4, cy + 5 + o, GORE); if (f) px(cx - 4, cy + 7, GORE);
  },
  /** 눈 달린 암퇘지 — a sow with her own eyes sewn shut, and a row of others where she fed her young. */
  sowseer(b, f, px, line) {
    const hide = "#d49aa2", mud = "#a56a78", snout = "#e8b6ba", o = f ? 1 : 0;
    b.r(9, 23, 3, 4 - o, mud); b.r(9, 27 - o, 3, 1, DARK); b.r(25, 23, 3, 3 + o, mud); b.r(25, 26 + o, 3, 1, DARK);
    path(line, [[28, 13], [30, 11], [31, 13], [29, 14]], mud);
    b.oval(18, 16, 10.5, 7, hide); b.oval(19, 20, 9.5, 3.4, shade(hide, 0.28));
    for (const x of [13, 17, 21, 25]) { px(x, 9 + (x > 20 ? 1 : 0), "#7a4a58"); px(x, 8 + (x > 20 ? 1 : 0), "#7a4a58"); }
    // the row of eyes along her belly, each looking somewhere else
    [12, 15, 18, 21, 24].forEach((x, i) => {
      const y = 23 + ((i + o) % 2);
      b.r(x, 22, 2, y - 21, mud);
      b.r(x - 1, y, 4, 3, EYE); b.r(x + ((i + f) % 3) - 1 + (i % 2), y + 1, 2, 2, i % 2 ? "#c8a020" : GORE); px(x + ((i + f) % 3) - 1 + (i % 2), y + 1, DARK);
    });
    // her head: the snout works; the eyes were stitched shut long ago
    b.oval(7, 15, 4.8, 4.4, hide); b.r(0, 15, 5, 4, snout); b.r(0, 18, 5, 1, mud); px(1, 16, DARK); px(3, 16, DARK);
    b.tri([[8, 12], [5, 7], [11, 10]], mud);
    for (const [x, y] of [[6, 12], [8, 12], [7, 13], [6, 14], [8, 14]]) px(x, y, DARK);
    px(7, 15, GORE); px(7, 16, GORE); if (f) px(7, 17, GORE);
    px(2, 20, BILE); if (f) px(2, 21, BILE);
  },
});

/** Creatures that fill a 96×96 sheet instead of the usual 32×32. */
const BIG_MOB = { boss: riftLord, abyssboss: abyssMother };
/** Names from earlier rosters, so a stale server still draws something sensible. */
const MOB_ALIAS = {
  acorn: "twinhare", potcrab: "gutfrog", puff: "eyecrow", capfrog: "gutfrog", stump: "ribdeer", lantern: "mothface", yarn: "spiderhand",
  eyecam: "pigeonmass", signbot: "doghead", vend: "fishwalker", tvhead: "catsplit", candle: "batcluster", geode: "bearmaw", prism: "owlstare",
  slime: "twinhare", bslime: "gutfrog", shroom: "gutfrog", boar: "splitboar", bat: "batcluster", drone: "pigeonmass", thug: "catsplit", robot: "doghead", skel: "bonehound", golem: "bearmaw",
};

// ── tints: the same creature in another skin, for elites and for harder ground
// A tint is a palette remap, not a wash: the outline, the whites of eyes and teeth
// and the small bright accents stay as drawn, and the body's ramp is rebuilt
// around a new hue with its light and dark steps kept apart.

/** hue (0–360) for lit and for shadowed tones, saturation, and what happens to lightness. */
const TINT = {
  fire: { hi: 20, lo: 2, sat: 0.92, l: (l) => l * 0.8 + 0.08, accent: "#ffe890", core: 46 },
  poison: { hi: 104, lo: 282, sat: 0.6, l: (l) => l * 0.92 + 0.03 },
  frost: { hi: 204, lo: 222, sat: 0.42, l: (l) => l * 0.72 + 0.26, rim: "#f4faff" },
  steel: { hi: 212, lo: 228, sat: 0.14, l: (l) => (l - 0.5) * 1.3 + 0.52, rim: "#e6ecf4" },
  blood: { hi: 356, lo: 340, sat: 0.74, l: (l) => l * 0.74 + 0.02, accent: "#ff9a8a" },
  bile: { hi: 80, lo: 104, sat: 0.7, l: (l) => l * 0.9 + 0.05 },
  ash: { hi: 262, lo: 262, sat: 0.07, l: (l) => l * 0.5 + 0.1, fleck: "#cfc9d6" },
  bone: { hi: 42, lo: 28, sat: 0.26, l: (l) => l * 0.5 + 0.44 },
  gold: { hi: 50, lo: 38, sat: 0.74, l: (l) => l * 0.78 + 0.18 },
};
/** The tints a monster sheet can be asked for. */
export const MOB_TINTS = Object.keys(TINT);
/** The light a tinted creature gives off in dark places (only some tints glow). */
export const TINT_GLOW = { fire: "#ff9040", poison: "#9adc50", frost: "#bfe6ff", bile: "#b4cc3c", gold: "#ffd860" };

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, c = mx - mn;
  if (!c) return [0, 0, l, 0];
  const h = mx === r ? ((g - b) / c + 6) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return [h * 60, c / (1 - Math.abs(2 * l - 1)), l, c];
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
/** Move hue `a` a fraction `t` of the way round the wheel to `b`, the short way. */
const turnHue = (a, b, t) => { const d = ((b - a + 540) % 360) - 180; return (a + d * t + 360) % 360; };

function tinted(src, name) {
  const T = TINT[name], n = src.width;
  const [c, g] = sheet(n);
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, n, n), d = img.data;
  const at = (x, y) => (y * n + x) * 4;
  const ink = (i) => d[i + 3] && d[i] < 60 && d[i + 1] < 52 && d[i + 2] < 72;              // the outline and the darkest fills
  // how much of the sprite each colour covers: small bright patches are accents
  const share = new Map();
  let solid = 0;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; solid++; const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; share.set(k, (share.get(k) || 0) + 1); }
  const kind = new Uint8Array(n * n);                                                    // 0 nothing · 1 ink · 2 kept · 3 accent · 4 body
  for (let p = 0, i = 0; i < d.length; i += 4, p++) {
    if (!d[i + 3]) continue;
    if (ink(i)) { kind[p] = 1; continue; }
    const [h, s, l, ch] = toHsl(d[i], d[i + 1], d[i + 2]);
    const part = share.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) / solid;
    if (l > 0.8 && ch < 0.17) kind[p] = 2;                                               // whites of eyes, teeth, bare bone
    else if (s > 0.62 && l > 0.38 && l < 0.74 && part < 0.035) kind[p] = (h > 340 || h < 14) ? 3 : 2;   // blood is an accent; other small brights are kept
    else kind[p] = 4;
    if (kind[p] !== 4) continue;
    const dark = l < 0.36;
    const hue = turnHue(h, dark ? T.lo : T.hi, 0.84);
    const sat = Math.min(1, T.sat * (0.62 + 0.5 * Math.min(1, s)));
    const lit = Math.max(0.06, Math.min(0.95, T.l(l)));
    const [r2, g2, b2] = fromHsl(hue, sat, lit);
    d[i] = r2; d[i + 1] = g2; d[i + 2] = b2;
  }
  const put = (p, hex) => { const v = parseInt(hex.slice(1), 16); d[p * 4] = v >> 16; d[p * 4 + 1] = (v >> 8) & 255; d[p * 4 + 2] = v & 255; };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const p = y * n + x;
    if (kind[p] === 3 && T.accent) put(p, T.accent);
    if (kind[p] !== 4) continue;
    // frost and steel catch the light along their upper edges
    if (T.rim && y > 0 && kind[p - n] === 1 && (y < 2 || kind[p - 2 * n] === 0)) put(p, T.rim);
    // embers: the heart of the body burns hotter than its skin
    if (T.core !== undefined && x > 1 && y > 1 && x < n - 2 && y < n - 2) {
      let deep = true;
      for (let dy = -2; dy <= 2 && deep; dy++) for (let dx = -2; dx <= 2; dx++) if (kind[p + dy * n + dx] !== 4) { deep = false; break; }
      if (deep) { const i = p * 4, [h, s, l] = toHsl(d[i], d[i + 1], d[i + 2]); const [r2, g2, b2] = fromHsl(turnHue(h, T.core, 0.7), s, Math.min(0.9, l + 0.12)); d[i] = r2; d[i + 1] = g2; d[i + 2] = b2; }
    }
    // ash: pale flecks in pairs, where the surface has burnt through
    if (T.fleck && x < n - 1 && kind[p + 1] === 4 && ((x * 7 + y * 13) % 23 === 0) && y % 3 === 0) { put(p, T.fleck); put(p + 1, T.fleck); }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * Two frames of a monster, optionally in one of MOB_TINTS. Anything unknown gets
 * a plain blob rather than an error, and an unknown tint gets the creature as drawn.
 */
export function monsterSheet(kind, tint) {
  kind = MOB_ALIAS[kind] || kind;
  if (!TINT[tint]) tint = "";
  const key = "m:" + kind + (tint ? ":" + tint : "");
  let s = cache.get(key);
  if (s) return s;
  if (tint) s = monsterSheet(kind).map((fr) => tinted(fr, tint));
  else {
    const draw = (f) => {
      const [c, g] = sheet(BIG_MOB[kind] ? 96 : S);
      const b = brush(g);
      const px = (x, y, col) => b.r(x, y, 1, 1, col);
      const line = (x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col); };
      if (BIG_MOB[kind]) BIG_MOB[kind](b, f, px, line);
      else if (MOB[kind]) MOB[kind](b, f, px, line);
      else { b.oval(16, 21 - f, 6, 6, "#a8a4b8"); b.r(13, 19 - f, 1, 2, DARK); b.r(18, 19 - f, 1, 2, DARK); }
      return finish(c, g, INK, 1);
    };
    s = [draw(0), draw(1)];
  }
  cache.set(key, s);
  return s;
}
/** Per monster: how many times its sheet is enlarged, and how many pixels it floats. */
export const MOB_SIZE = {
  twinhare: [1, 0], gutfrog: [1, 0], eyecrow: [1, 10],
  splitboar: [1, 0], ribdeer: [1, 0], hydrasnake: [1, 0], mothface: [1, 9],
  ratking: [1, 0], bonehound: [1, 0], batcluster: [1, 9],
  pigeonmass: [1, 10], doghead: [1, 0], catsplit: [1, 0], fishwalker: [1, 0],
  leechmaw: [1, 0], gatorhalf: [1, 0], eelknot: [1, 0],
  spiderhand: [1, 0], bearmaw: [1, 0], owlstare: [1, 9],
  twingoat: [1, 0], horsehalf: [1, 0], serpentwing: [1, 10],
  lambmaw: [1, 0], foxtwine: [1, 0], toadbrood: [1, 0], squidrat: [1, 0], crabskull: [1, 0], moleworm: [1, 0], lionhand: [1, 0], sowseer: [1, 0],
  boss: [3, 0], abyssboss: [3, 0], chest: [1, 0],
};
for (const [old, now] of Object.entries(MOB_ALIAS)) MOB_SIZE[old] = MOB_SIZE[now];
/** The light a creature gives off in dark places, if any: eyes, bile, an open heart. */
export const MOB_GLOW = {
  eyecrow: "#ff6a50", ribdeer: "#ff5a5a", mothface: "#f4efe0", batcluster: "#ff5a5a", leechmaw: "#b4cc3c", eelknot: "#e8c840",
  owlstare: "#ff7a30", bearmaw: "#ff5a5a", serpentwing: "#e8c840", boss: "#ff72d6", abyssboss: "#b4cc3c",
  toadbrood: "#b4cc3c", crabskull: "#ff5a5a",
};
for (const [old, now] of Object.entries(MOB_ALIAS)) if (MOB_GLOW[now]) MOB_GLOW[old] = MOB_GLOW[now];
