/**
 * Character design.
 *
 * Every adventurer, townsperson and humanoid monster is painted here, limb by
 * limb, onto a 40×48 canvas: a figure about three and a half heads tall with
 * its weapon, costume and hair layered in the order they overlap. Two views are
 * drawn — three-quarter front and three-quarter back — and mirrored to give the
 * four diagonal facings of the game's grid.
 *
 * Frames: 0–1 idle (breathing) · 2–5 walk cycle · 6–7 attack (wind-up, strike).
 */

export const CHAR_W = 40;
export const CHAR_H = 48;
/** Where the feet touch the ground inside the canvas. */
export const FOOT_X = 20;
export const FOOT_Y = 46;
/** Height of the figure above its feet — where a name tag goes. */
export const CHAR_TOP = 42;
export const FRAMES = { idle: [0, 1], walk: [2, 3, 4, 5], attack: [6, 7] };

export const HAIR = ["#6b4630", "#22232c", "#d0aa58", "#a8432e", "#7d5c9a", "#d4d6de"];
export const SKIN = ["#f0c9a4", "#d9a47c", "#a6714e"];
export const STYLES = ["짧은 머리", "긴 머리", "묶은 머리"];
const LINE = "#16121c";

// ───────────────────────────── colour ─────────────────────────────

function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const dk = (hex) => mix(hex, 0.7);
const lt = (hex) => mix(hex, 1.28);

const METAL = ["#8e939c", "#8e939c", "#b4bac6", "#8fb0e0", "#62d6e2", "#d684f0"];
/** Each class's signature material, by armour tier (index 0–5). */
const TIER = {
  warrior: ["#7e8696", "#7e8696", "#8f9aae", "#aab6cc", "#565c6e", "#58c0d0"],
  rogue: ["#373a45", "#373a45", "#4c3e36", "#3c4656", "#24262e", "#2a6a78"],
  ranger: ["#4f6044", "#4f6044", "#665840", "#56627a", "#2e323a", "#2a7a84"],
  mage: ["#40367e", "#40367e", "#5c3672", "#34528c", "#28263e", "#2a8a94"],
};

// ───────────────────────────── canvas helpers ─────────────────────────────

function sheet() {
  const c = document.createElement("canvas");
  c.width = CHAR_W;
  c.height = CHAR_H;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return [c, g];
}
function flip(src) {
  const [c, g] = sheet();
  g.translate(CHAR_W, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}
function outline(c, g) {
  const w = c.width, h = c.height;
  const src = g.getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  g.fillStyle = LINE;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
  }
}

/** A tiny painter working in figure space: x 0–23 across, y 0–38 down, soles on row 38. */
const BASE = 39;
function brush(g) {
  const OX = FOOT_X - 12, OY = FOOT_Y - BASE;
  const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(OX + x, OY + y, w, h); };
  /** A shaded block: lit from the upper left, shadowed on the right. */
  const part = (x, y, w, h, col, shine) => {
    r(x, y, w, h, col);
    if (w >= 3) r(x + w - 1, y, 1, h, dk(col));
    if (shine) r(x, y, 1, Math.max(1, h - 1), lt(col));
  };
  const rows = (x, y, map, pal) => {
    for (let j = 0; j < map.length; j++) for (let i = 0; i < map[j].length; i++) {
      const col = pal[map[j][i]];
      if (col) r(x + i, y + j, 1, 1, col);
    }
  };
  /** A straight run of pixels from a to b, `w` thick — blades, barrels, staves. */
  const line = (x0, y0, x1, y1, w, col) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / (n || 1)), y = Math.round(y0 + ((y1 - y0) * i) / (n || 1));
      r(x, y, w, w, col);
    }
  };
  return { r, part, rows, line };
}

// ───────────────────────────── heads ─────────────────────────────
// h hair · H hair shadow · i hair shine · s skin · S skin shadow · E lash · c iris · w eye white · m mouth

const HEAD_F = [
  "...hhhhhh...",
  "..hiihhhhh..",
  ".hhiihhhhhh.",
  ".hhhhhhhhhH.",
  ".hHhhhhsshH.",
  ".hHhhssssshH",
  ".HHhsEEsEEs.",
  ".HSSscwscws.",
  "..HSsssssss.",
  "..H.ssssmss.",
  "....Sssssss.",
  ".....Ssss...",
];
const HEAD_B = [
  "...hhhhhh...",
  "..hhhhiihh..",
  ".hhhhhhiihh.",
  ".Hhhhhhhhhh.",
  ".Hhhhhhhhhhs",
  ".HHhhhhhhhss",
  ".HHhhhhhhhSs",
  ".HHHhhhhhhS.",
  "..HHHhhhhH..",
  "..HHHHHHHH..",
  "...SsssSS...",
  "....Ssss....",
];
const HEAD_X = 6, HEAD_Y = 2;

function head(b, o, back, by) {
  const hair = HAIR[o.hair] || HAIR[0], skin = SKIN[o.skin] || SKIN[0];
  const pal = { h: hair, H: dk(hair), i: lt(hair), s: skin, S: dk(skin), E: "#1c1620", c: o.eye || "#3c5a8a", w: "#f4f0ea", m: dk(skin) };
  const x = HEAD_X, y = HEAD_Y + by;
  if (o.bone) { pal.h = pal.H = pal.i = pal.s = "#d6d8e0"; pal.S = "#a0a2b0"; pal.E = "#101018"; pal.c = o.eye; pal.w = "#101018"; pal.m = "#101018"; }

  // hair that hangs behind the shoulders is painted before the head
  if (!o.hood && !o.bone) {
    if (o.style === 1) {
      if (back) { b.part(x + 1, y + 8, 10, 9, hair); b.r(x + 2, y + 16, 8, 2, dk(hair)); b.r(x + 4, y + 9, 1, 7, lt(hair)); }
      else { b.r(x, y + 6, 2, 10, dk(hair)); b.r(x + 1, y + 6, 1, 9, hair); b.r(x + 10, y + 7, 2, 8, dk(hair)); }
    } else if (o.style === 2) {
      if (back) { b.part(x + 4, y + 7, 4, 4, hair); b.part(x + 5, y + 10, 3, 8, hair); b.r(x + 5, y + 11, 1, 6, lt(hair)); }
      else { b.r(x - 1, y + 5, 2, 3, hair); b.r(x - 2, y + 7, 2, 8, hair); b.r(x - 2, y + 9, 1, 6, dk(hair)); }
    }
  }
  b.rows(x, y, back ? HEAD_B : HEAD_F, pal);
  if (o.bone) return;

  if (o.hood) {
    // a hood: bigger than the skull, with the face in its shadow
    const hd = o.hood, hD = dk(hd);
    if (back) {
      b.r(x + 3, y - 1, 6, 1, hd); b.r(x + 1, y, 10, 1, hd); b.part(x, y + 1, 12, 8, hd); b.r(x + 1, y + 9, 10, 2, hD);
      b.r(x + 3, y + 1, 1, 6, lt(hd)); b.r(x + 4, y, 3, 1, lt(hd)); b.r(x + 9, y + 3, 2, 6, hD); b.r(x + 5, y + 10, 3, 2, hD);
    } else {
      b.r(x + 3, y - 1, 6, 1, hd); b.r(x + 1, y, 10, 1, hd); b.r(x, y + 1, 12, 3, hd); b.r(x, y + 4, 4, 7, hd); b.r(x + 10, y + 4, 2, 6, hD);
      b.r(x + 4, y + 4, 6, 1, hD); b.r(x + 4, y, 3, 1, lt(hd)); b.r(x + 2, y + 1, 1, 8, lt(hd)); b.r(x + 1, y + 10, 3, 1, hD);
      b.r(x + 4, y + 5, 6, 1, dk(pal.s));
    }
  }
  if (o.mask && !back) { b.r(x + 4, y + 8, 7, 3, o.mask); b.r(x + 4, y + 10, 7, 1, dk(o.mask)); b.r(x + 5, y + 11, 4, 1, o.mask); }
  if (o.band) { if (back) b.r(x + 1, y + 4, 10, 1, o.band); else { b.r(x + 1, y + 4, 10, 1, o.band); b.r(x, y + 5, 1, 3, o.band); } }
  if (o.goggles) {
    if (back) b.r(x + 1, y + 3, 10, 1, "#24252c");
    else { b.r(x + 1, y + 3, 10, 2, "#24252c"); b.r(x + 5, y + 3, 2, 2, o.goggles); b.r(x + 8, y + 3, 2, 2, o.goggles); b.r(x + 5, y + 3, 1, 1, "#ffffff"); }
  }
  if (o.circlet) { if (!back) { b.r(x + 4, y + 4, 6, 1, o.circlet); b.r(x + 7, y + 3, 1, 1, "#9ff0ff"); } else b.r(x + 2, y + 4, 8, 1, o.circlet); }
  if (o.beard && !back) { b.r(x + 4, y + 9, 7, 2, "#d4d6de"); b.r(x + 5, y + 11, 5, 2, "#d4d6de"); b.r(x + 6, y + 13, 3, 1, "#b0b2be"); }
}

// ───────────────────────────── limbs ─────────────────────────────

/** One leg: [dx, lift] slides it forward/back and raises the foot. */
function leg(b, x, [dx, lift], cloth, boot, knee) {
  const top = 24, len = 12 - lift;
  b.part(x + dx, top, 3, len, cloth);
  if (knee) { b.r(x + dx, top + 4, 3, 3, knee); b.r(x + dx, top + 4, 1, 2, lt(knee)); }
  b.part(x + dx, top + len - 2, 4, 4, boot);
  b.r(x + dx, top + len - 2, 3, 1, lt(boot));
  b.r(x + dx, top + len + 2, 4, 1, dk(boot));
}
/** One arm hanging from the shoulder; `fwd` swings it, `up` raises the hand. */
function arm(b, x, y, fwd, up, sleeve, skin, glove) {
  const len = 8 - up;
  b.part(x + (fwd > 0 ? 0 : 0), y, 3, 4, sleeve);
  b.part(x + fwd, y + 3, 3, len - 3, sleeve);
  b.r(x + fwd, y + len, 3, 2, glove || skin);
  if (!glove) b.r(x + fwd + 2, y + len, 1, 2, dk(skin));
}

// ───────────────────────────── weapons ─────────────────────────────

function greatsword(b, x0, y0, x1, y1, tier) {
  const m = METAL[tier] || METAL[1];
  const n = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / n, uy = (y1 - y0) / n;
  // grip, guard, then a broad blade with a bright edge
  b.line(x0, y0, x0 + ux * 4, y0 + uy * 4, 2, "#5a3c26");
  const gx = x0 + ux * 5, gy = y0 + uy * 5;
  b.line(gx - uy * 3, gy + ux * 3, gx + uy * 3, gy - ux * 3, 2, "#c8a040");
  b.line(x0 + ux * 7, y0 + uy * 7, x1, y1, 3, m);
  b.line(x0 + ux * 7, y0 + uy * 7, x1, y1, 1, lt(m));
  b.line(x0 + ux * 7 - uy * 2, y0 + uy * 7 + ux * 2, x1 - uy * 2 - ux * 2, y1 + ux * 2 - uy * 2, 1, dk(m));
  b.r(Math.round(x0 - ux), Math.round(y0 - uy), 2, 2, "#c8a040");
}
function dagger(b, x, y, ux, uy, tier, len = 6) {
  const m = METAL[tier] || METAL[1];
  b.r(x, y, 2, 2, "#2c2630");
  b.line(x + ux * 2, y + uy * 2, x + ux * len, y + uy * len, 2, m);
  b.line(x + ux * 2, y + uy * 2, x + ux * len, y + uy * len, 1, lt(m));
}
function gun(b, x, y, tier, up) {
  const m = METAL[tier] || METAL[1], body = "#2a2c34";
  const long = tier >= 3;
  const dy = up ? -1 : 0;
  // receiver, barrel, grip and (on rifles) a stock and magazine
  b.r(x, y + dy, long ? 8 : 5, 3, body);
  b.r(x, y + dy, long ? 8 : 5, 1, mix(body, 1.3));
  b.r(x + (long ? 8 : 5), y + dy + (up ? 0 : 0), long ? 6 : 3, 2, m);
  b.r(x + (long ? 8 : 5), y + dy, long ? 6 : 3, 1, lt(m));
  b.r(x + 1, y + 3 + dy, 2, 3, "#3a2c22");
  if (long) { b.r(x - 3, y + 1 + dy, 3, 3, "#3a2c22"); b.r(x + 4, y + 3 + dy, 2, 3, body); }
  if (tier >= 4) b.r(x + 3, y - 1 + dy, 3, 1, "#62d6e2");
  return x + (long ? 14 : 8);
}
function staff(b, x0, y0, x1, y1, tier, glow) {
  const m = METAL[tier] || METAL[1];
  b.line(x0, y0, x1, y1, 2, "#6a4a30");
  b.line(x0, y0, x1, y1, 1, "#8a6644");
  // a crescent head cradling a gem
  b.r(x1 - 2, y1 - 3, 5, 1, m); b.r(x1 - 3, y1 - 2, 2, 3, m); b.r(x1 + 2, y1 - 2, 2, 3, dk(m));
  b.r(x1 - 1, y1 - 2, 3, 3, glow ? "#e8fbff" : "#7ad6e8");
  b.r(x1 - 1, y1 - 2, 1, 1, "#ffffff");
  if (glow) { b.r(x1 - 4, y1 - 1, 1, 1, "#bff4ff"); b.r(x1 + 4, y1 - 1, 1, 1, "#bff4ff"); b.r(x1, y1 - 5, 1, 1, "#bff4ff"); }
}

// ───────────────────────────── poses ─────────────────────────────
// bob: upper body drop · near/far: leg [dx, lift] · an/af: arm swing · atk: 0 none, 1 wind-up, 2 strike

const POSE = [
  { bob: 0, near: [0, 0], far: [0, 0], an: 0, af: 0, atk: 0 },
  { bob: 1, near: [0, 0], far: [0, 0], an: 0, af: 0, atk: 0 },
  { bob: 1, near: [1, 0], far: [-1, 1], an: -1, af: 1, atk: 0 },
  { bob: 0, near: [0, 0], far: [0, 2], an: 0, af: 0, atk: 0 },
  { bob: 1, near: [-1, 1], far: [1, 0], an: 1, af: -1, atk: 0 },
  { bob: 0, near: [0, 2], far: [0, 0], an: 0, af: 0, atk: 0 },
  { bob: 0, near: [-1, 0], far: [1, 0], an: 0, af: 0, atk: 1 },
  { bob: 1, near: [1, 0], far: [-1, 0], an: 0, af: 0, atk: 2 },
];

// ───────────────────────────── the figure ─────────────────────────────

function figure(o, back, f) {
  const [c, g] = sheet();
  const b = brush(g);
  const P = POSE[f];
  const by = P.bob;
  const cls = o.cls;
  const skin = SKIN[o.skin] || SKIN[0];
  const main = o.main, wt = o.wt || 0;
  const sway = f >= 2 && f <= 5 ? [0, 1, 0, -1][f - 2] : 0;

  // ── behind the body
  if (cls === "warrior") {
    if (!back) {
      if (P.atk === 0) greatsword(b, 20, 2 + by, 9, 22 + by, wt);
      b.part(6, 15 + by, 12, 17, o.cape); b.r(6, 31 + by, 12, 1, dk(o.cape)); b.r(7 + sway, 32 + by, 10, 1, dk(o.cape));
    }
  } else if (cls === "mage" && !back && P.atk === 0) {
    staff(b, 4, 38, 4, 5 + by, wt, false);
  } else if (cls === "ranger" && back) {
    if (P.atk) gun(b, 14, 15 + by, wt, P.atk === 1);
    else gun(b, 13, 19 + by, wt, false);
  } else if (cls === "rogue" && !back) {
    b.r(4 - sway, 15 + by, 3, 2, o.scarf); b.r(2 - sway, 16 + by, 3, 5, o.scarf); b.r(1 - sway, 19 + by, 2, 4, dk(o.scarf));
  }

  // ── far arm (hidden behind the torso edge)
  const sleeve = cls === "warrior" ? o.under : cls === "ranger" ? main : cls === "mage" ? o.mantle || main : main;
  const glove = cls === "warrior" ? main : cls === "rogue" ? "#1e1f26" : cls === "ranger" ? "#2a2c34" : null;
  let af = P.af, an = P.an, upF = 0, upN = 0;
  if (P.atk && cls !== "mage") { af = 1; upF = cls === "warrior" ? (P.atk === 1 ? 5 : 1) : 3; an = 1; upN = cls === "warrior" ? (P.atk === 1 ? 5 : 1) : cls === "rogue" ? (P.atk === 2 ? 3 : 1) : 3; }
  if (P.atk && cls === "mage") { an = 1; upN = 4; }
  if (cls === "ranger" && !P.atk) { af = 0; upF = 2; an = 1; upN = 2; }
  arm(b, 16, 15 + by, af, upF, sleeve, skin, glove);

  // ── legs
  if (o.skirt) {
    // a long robe hides the legs; only the feet show, and the hem sways with each step
    b.part(13 + P.far[0], 36 - P.far[1], 4, 2, o.boot); b.part(8 + P.near[0], 36 - P.near[1], 4, 2, o.boot);
    b.r(8 + P.near[0], 38 - P.near[1], 4, 1, dk(o.boot)); b.r(13 + P.far[0], 38 - P.far[1], 4, 1, dk(o.boot));
  } else {
    leg(b, 13, P.far, dk(o.pants), dk(o.boot), cls === "warrior" ? dk(main) : null);
    leg(b, 9, P.near, o.pants, o.boot, cls === "warrior" ? main : null);
  }

  // ── torso
  const T = 14 + by;
  if (cls === "warrior") {
    b.part(8, T, 9, 10, o.under);
    b.part(8, T, 9, 6, main, true); b.r(9, T + 5, 7, 1, dk(main));          // breastplate
    b.part(10, T + 1, 4, 10, o.tabard); b.r(11, T + 3, 2, 2, o.trim);          // tabard and crest
    b.part(8, T + 9, 9, 2, "#4a3426"); b.r(12, T + 9, 2, 2, o.trim);            // belt
    b.part(8, T + 11, 9, 2, o.under);
    if (back) { b.part(8, T, 9, 6, main, true); b.r(9, T + 2, 7, 1, dk(main)); }
  } else if (cls === "rogue") {
    b.part(8, T, 9, 12, main);
    b.r(9, T + 1, 7, 1, lt(main));
    if (!back) { b.line(9, T + 1, 15, T + 8, 1, o.belt); b.r(12, T + 4, 2, 2, o.trim); }   // bandolier
    b.part(8, T + 9, 9, 2, o.belt); b.r(11, T + 9, 2, 2, o.trim);
    b.r(8, T + 11, 9, 2, dk(main));
    b.r(7, T - 1, 11, 2, o.scarf); b.r(7, T, 11, 1, dk(o.scarf));                // scarf round the neck
  } else if (cls === "ranger") {
    b.part(8, T, 9, 12, o.shirt);
    b.part(8, T + 9, 9, 2, "#2a221c"); b.r(12, T + 9, 2, 2, o.trim);
    // an open long coat: two panels with the shirt showing between them
    const hem = 34 + by;
    if (back) {
      b.part(7, T, 11, hem - T, main); b.r(12, T + 11, 1, hem - T - 11, dk(main)); b.part(7 + sway, hem, 11, 1, dk(main));
      b.r(8, T - 1, 9, 2, lt(main)); b.r(8, T + 9, 9, 1, dk(main));                 // collar, waist seam
      b.line(9, T + 1, 15, T + 8, 1, "#2a221c"); b.part(10, T + 3, 5, 5, o.vest); b.r(10, T + 3, 5, 1, lt(o.vest));   // sling and pack
    }
    else {
      b.part(7, T, 3, hem - T, main, true); b.part(15, T, 3, hem - T, dk(main));
      b.r(7 + sway, hem, 3, 1, dk(main)); b.r(15 + sway, hem, 3, 1, dk(main));
      b.r(10, T, 1, 4, lt(main)); b.r(14, T, 1, 4, main);                         // lapels
      b.r(10, T + 5, 2, 3, o.vest); b.r(13, T + 5, 2, 3, o.vest);                 // pouches
    }
  } else if (cls === "mage") {
    const hem = 37;
    b.part(8, T, 9, 10, main);
    b.part(7 - (sway > 0 ? 1 : 0), T + 9, 11 + Math.abs(sway), hem - T - 9, main);
    b.r(7, hem - 1, 11, 1, o.trim); b.r(7, hem, 11, 1, dk(main));
    if (!back) { b.r(12, T + 2, 1, hem - T - 3, o.trim); b.part(8, T + 8, 9, 2, o.sash); b.r(11, T + 10, 2, 5, o.sash); b.r(11, T + 14, 2, 1, dk(o.sash)); }
    else b.part(8, T + 8, 9, 2, o.sash);
    // a short mantle over the shoulders
    b.part(6, T - 1, 13, 5, o.mantle, true); b.r(6, T + 3, 13, 1, o.trim); b.r(7, T + 4, 11, 1, dk(o.mantle));
    if (!back) b.r(12, T, 2, 2, "#9ff0ff");
  } else if (cls === "robe") {
    b.part(8, T, 9, 10, main); b.part(7, T + 9, 11, 37 - T - 9, main); b.r(7, 36, 11, 1, o.trim); b.r(7, 37, 11, 1, dk(main));
    if (!back) b.r(12, T + 1, 1, 21, o.trim);
    b.part(8, T + 8, 9, 2, o.trim);
  } else {
    // townsfolk: a tunic over trousers, with an optional apron
    b.part(8, T, 9, 12, main); b.r(9, T + 1, 7, 1, lt(main));
    b.part(8, T + 9, 9, 2, "#4a3426");
    if (!back) { b.r(11, T, 3, 2, skin); if (o.apron) { b.part(9, T + 3, 7, 12, o.apron); b.r(9, T + 3, 7, 1, lt(o.apron)); } }
  }
  // neck
  if (!back && cls !== "rogue" && cls !== "mage") b.r(11, T - 1, 3, 1, dk(skin));

  // ── pauldrons sit over the shoulders
  if (cls === "warrior") {
    b.part(5, T - 1, 5, 4, main, true); b.r(5, T + 2, 5, 1, dk(main)); b.r(6, T - 1, 3, 1, lt(main));
    b.part(15, T - 1, 4, 4, dk(main)); b.r(15, T - 1, 3, 1, main);
  }

  // ── cape and slung weapons on the back view
  if (back && cls === "warrior") {
    b.part(7, T + 1, 11, 18, o.cape); b.r(8, T + 2, 1, 15, lt(o.cape)); b.r(13, T + 4, 1, 14, dk(o.cape)); b.r(7 + sway, T + 19, 11, 1, dk(o.cape));
    b.part(5, T - 1, 5, 3, main, true); b.part(15, T - 1, 4, 3, dk(main));
    if (P.atk === 0) greatsword(b, 5, 3 + by, 21, 31 + by, wt);
  }
  if (back && cls === "rogue") { b.r(10 + sway, T + 1, 3, 2, o.scarf); b.r(11 + sway, T + 3, 3, 6, o.scarf); b.r(12 + sway, T + 8, 2, 4, dk(o.scarf)); }
  if (back && cls === "mage" && P.atk === 0) staff(b, 4, 38, 4, 5 + by, wt, false);

  // ── head
  head(b, o, back, by);

  // ── near arm, and whatever it holds
  arm(b, 5, 15 + by, an, upN, sleeve, skin, glove);
  if (cls === "warrior" && P.atk === 1) greatsword(b, back ? 16 : 8, 13 + by, back ? 22 : 15, by - 6, wt);
  if (cls === "warrior" && P.atk === 2) { if (back) greatsword(b, 16, 20 + by, 29, 9 + by, wt); else greatsword(b, 9, 21 + by, 24, 31 + by, wt); }
  if (cls === "rogue") {
    if (P.atk === 2) dagger(b, 9, 19 + by, 1, back ? -0.5 : 0.35, wt);
    else if (P.atk === 1) dagger(b, 4, 19 + by, -1, -0.3, wt);
    else { dagger(b, 5 + an, 24 + by, -0.4, 1, wt, 5); if (!back) dagger(b, 17 + af, 24 + by, 0.4, 1, wt, 5); }
  }
  if (cls === "ranger" && !back) {
    const tip = P.atk ? gun(b, 8, 17 + by, wt, P.atk === 1) : gun(b, 7, 20 + by, wt, false);
    if (P.atk === 1) { b.r(tip, 16 + by, 2, 3, "#fff2b0"); b.r(tip + 2, 17 + by, 2, 1, "#ffd24a"); b.r(tip, 15 + by, 1, 1, "#ffd24a"); b.r(tip, 19 + by, 1, 1, "#ffd24a"); }
  }
  if (cls === "mage" && P.atk) { if (back) staff(b, 8, 26 + by, 20, 5 + by, wt, true); else staff(b, 7, 25 + by, 21, 9 + by, wt, P.atk === 1); }

  outline(c, g);
  // a few glints painted over the outline so they stay bright
  if (cls === "mage") { const hx = P.atk ? null : 4; if (hx !== null) { g.fillStyle = "#ffffff"; g.fillRect(FOOT_X - 12 + 3, FOOT_Y - BASE + 3 + by, 1, 1); } }
  if (o.glow) { g.fillStyle = o.glow; g.fillRect(FOOT_X - 12 + (back ? 9 : 12), FOOT_Y - BASE + 17 + by, 2, 1); }
  return c;
}

// ───────────────────────────── public API ─────────────────────────────

const cache = new Map();
/**
 * `[dir][frame]` for one character. dir: 0 down-left · 1 up-left · 2 down-right ·
 * 3 up-right (the grid's four axes as they appear on screen).
 */
export function charSprite(o) {
  const key = JSON.stringify(o);
  let s = cache.get(key);
  if (s) return s;
  const front = POSE.map((_, f) => figure(o, false, f));
  const back = POSE.map((_, f) => figure(o, true, f));
  s = [front.map(flip), back.map(flip), front, back];
  cache.set(key, s);
  return s;
}

/** A player's look from the server's public record. */
export function playerLook(cls, look, armorTier, weaponTier) {
  const t = Math.max(0, Math.min(5, armorTier | 0));
  const main = (TIER[cls] || TIER.warrior)[t];
  const o = { cls, hair: look[0] | 0, skin: look[1] | 0, style: look[2] | 0, main, wt: Math.max(1, weaponTier | 0), glow: t === 5 ? "#bff8ff" : null };
  if (cls === "warrior") Object.assign(o, { under: "#34303e", tabard: "#8c2a30", cape: "#6e1e26", trim: "#d0a848", pants: "#3a3644", boot: main, band: "#8c2a30" });
  else if (cls === "rogue") Object.assign(o, { hood: mix(main, 1.12), mask: "#1e1f26", scarf: "#a62c3c", belt: "#6a4c36", trim: "#c8b070", pants: mix(main, 0.9), boot: "#1c1d24" });
  else if (cls === "ranger") Object.assign(o, { shirt: "#c4b48c", vest: "#6e5c40", trim: "#c8b070", pants: "#3a3d46", boot: "#2a221c", goggles: "#6ad0e0" });
  else Object.assign(o, { cls: "mage", mantle: mix(main, 1.22), trim: "#d8b860", sash: "#62c6d8", boot: "#2a2440", skirt: 1, circlet: "#d8b860" });
  return o;
}
export function npcLook(look, role) {
  const col = look[3] || "#667";
  const base = { hair: look[0] | 0, skin: look[1] | 0, style: look[2] | 0, main: col, trim: "#c8b070", pants: "#3a3440", boot: "#2c241e" };
  if (role === "elder") return { ...base, cls: "robe", beard: 1, skirt: 1 };
  if (role === "smith") return { ...base, cls: "npc", apron: "#3c3430" };
  if (role === "shop") return { ...base, cls: "npc", apron: "#d8ceb8" };
  if (role === "train") return { ...base, cls: "npc", band: "#e8e0d0" };
  return { ...base, cls: "warrior", under: "#34303e", tabard: "#3a4a6a", cape: "#2c3850", wt: 2 };
}
/** Humanoid monsters reuse the same figure with their own wardrobe. */
export function mobLook(kind) {
  if (kind === "thug") return { cls: "rogue", hair: 1, skin: 1, style: 0, main: "#5a2a30", hood: "#3e1c22", mask: "#18181c", scarf: "#d8d4c8", belt: "#2a2a30", trim: "#c8c8cc", pants: "#2c2e36", boot: "#16161a", wt: 2 };
  return { cls: "warrior", bone: 1, hair: 5, skin: 0, style: 0, eye: "#5ac8d8", main: "#4a4860", under: "#201e2c", tabard: "#2c2840", cape: "#1c1a28", trim: "#5ac8d8", pants: "#2a2836", boot: "#3c3a50", wt: 3 };
}
