/**
 * The ground (split from scene2d.js): materials `GROUND GROUP EDGE FLOWER`, the deep places `UG`
 * (`underFloor grate underRock`), `themeOf`, `paintGround`/`paintExtras` (the bake), and per frame
 * `drawGround` (whole canvas, or the visible chunks + one prefetched), the glow in pieces
 * (`pulsePiece pulseBoth pulsePart drawPulseParts`), walls and rock stood up lazily near the screen
 * (`lazyTall`), `groundInfo`, `drawLayer drawSkirt`.
 */

import * as DC from "./decor.js";
import * as IT from "./isotiles.js";
import { T, sheet, tools, hash, lt, dk, vw, vh, clamp, g, K, FLAT, tI } from "./scene_view.js";
import { NEON } from "./scene_props.js";
import { ground, toIso, pulseParts, map, theme, statics, loadCost } from "./scene_map.js";

// ───────────────────────────── ground ─────────────────────────────

const GROUND = { t: "#6cbf5e", r: "#aeb0a0", ".": "#6cbf5e", ",": "#6cbf5e", '"': "#6cbf5e", ":": "#3f8a5c", ";": "#3f8a5c", p: "#d9ab6c", o: "#b4b9c6", s: "#ecd9a2", w: "#4aa2e2", b: "#b98a50", c: "#486a8a", d: "#486a8a", n: "#486a8a", i: "#486a8a", W: "#131a32", a: "#474b5a", m: "#474b5a", k: "#9aa0ae", j: "#6a6444", v: "#bdb39a", g: "#486a8a", "%": "#b4622e", "=": "#a69c88", "&": "#3e2c46" };
const GROUP = { t: 0, r: 3, ".": 0, ",": 0, '"': 0, ":": 1, ";": 1, p: 2, o: 3, s: 4, w: 5, b: 6, c: 7, d: 7, g: 7, n: 7, i: 7, W: 8, a: 9, m: 9, k: 10, j: 11, v: 12, "%": 2, "=": 3, "&": 11 };
GROUND["❋"] = "#a6ac50";
GROUP["❋"] = 0;
/** The outline where a patch of ground ends: [dark edge line, soft inner rim]. */
const EDGE = { 2: ["#8f6238", "#bd8c54"], 3: ["#6e7486", "#969cac"], 4: ["#b89a5e", "#d8c088"], 5: ["#2f78c0", "#86c8f4"], 6: ["#6a4426", "#96683a"], 7: ["#2a4262", "#3a5878"], 10: ["#5e6474", "#c4c8d2"], 11: ["#4a4430", "#7e7652"], 12: ["#7e7562", "#d6cdb4"] };
const FLOWER = ["#fffbe8", "#ffd84a", "#ff9ac0", "#9ac8ff", "#f06a7a"];

// ── the dungeons underground share the cave's bones (rock `W`, floor `c`/`d`, liquid `w`) but each has its own skin
/**
 * Per theme: floor [mid, dark, light], the dark behind everything, the wall's
 * lit face [base, top, highlight, seam], the liquid [shallow, deep, glint,
 * edge line, edge rim], and the motes in the air.
 */
export const UG = {
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
export function themeOf(m) {
  let cave = 0, city = 0, forest = 0;
  for (const row of m.g) for (const ch of row) { if (ch === "W" || ch === "c") cave++; else if (ch === "a" || ch === "k") city++; else if (ch === ":" || ch === ";") forest++; }
  const n = m.w * m.h;
  return cave > n * 0.3 ? "cave" : city > n * 0.3 ? "city" : forest > n * 0.3 ? "forest" : m.safe ? "town" : "meadow";
}

export function paintGround(m, theme) {
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
      } else if (ch === "❋") {
        for (let i = 0; i < 5; i++) flower(X + 4 + Math.floor(h(30 + i) * 24), Y + 4 + Math.floor(h(40 + i) * 24), i % 2 ? "#ffe783" : "#f0cb52");
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
export function paintExtras(m, c) {
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
    if (n.thing) continue;           // an interactive object (town.md E) has no mat
    if (n.night) continue;
    // a woven mat marks where each of the townsfolk stands
    const cx = n.x * T + 16, cy = n.y * T + 25, col = { shop: "#e07a8a", smith: "#8a90a0", elder: "#5a6ac0", train: "#b84a4a", warp: "#7a5ae0", collector: "#4a7a4a", achieve: "#d8a830", daily: "#4a8ad0", bank: "#a07a3a" }[n.role] || "#6a8a5a";
    b.oval(cx, cy, 15, 6.5, "#f2e0b0"); b.oval(cx, cy, 13, 5, col); b.oval(cx, cy, 9, 3, lt(col, 1.3)); b.oval(cx, cy, 5, 1.6, col);
  }
}
const SKIRT = { jungle: ["#4a4034", "#322a22"], coast: ["#c8b48a", "#9a8662"], desert: ["#c09a5e", "#8e6e40"], mesa: ["#a85a34", "#74381f"], mist: ["#8a8e96", "#60646c"], jianmen: ["#7c644c", "#4e3e30"], interior: ["#5a3a26", "#3a2418"], meadow: ["#7a5a3a", "#5a4030"], town: ["#7a5a3a", "#5a4030"], forest: ["#5a4632", "#3e3024"], city: ["#4a5064", "#343846"], cave: ["#2e4468", "#1b2644"] };

// ───────────────────────────── the ground, frame by frame ─────────────────────────────

/**
 * The ground: one canvas, or for a big map the chunks on screen (baked on the spot if missing),
 * and then one more of those just off screen, nearest first, so walking on rarely waits.
 */
const PREFETCH = 192;
export function drawGround(f, ox, oy) {
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
export function drawPulseParts(ox, oy) {
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
export let lazyLeft = 0;
export function setLazyLeft(n) { lazyLeft = n; }
const LAZY_NEAR = 160, LAZY_FAR = 448, LAZY_STEP = 16;
export function lazyTall(X0, X1, Y0, Y1) {
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
export function drawLayer(c, lx, ly, ox, oy) {
  const sx = Math.max(0, Math.floor(ox + lx)), sy = Math.max(0, Math.floor(oy + ly));
  const sw = Math.min(c.width - sx, vw + 2), sh = Math.min(c.height - sy, vh + 2);
  if (sw > 0 && sh > 0) g.drawImage(c, sx, sy, sw, sh, sx - lx, sy - ly, sw, sh);
}
/** The map's two front edges fall away into the dark, so it reads as a slab of land. */
export function drawSkirt() {
  const U = UG[theme], [a, b] = U ? [U.face[0], U.face[3]] : SKIRT[theme] || SKIRT.meadow, d = 18;
  const [Lx, Ly] = tI(0, map.h), [Bx, By] = tI(map.w, map.h), [Rx, Ry] = tI(map.w, 0);
  const quad = (x0, y0, x1, y1, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1, y1 + d); g.lineTo(x0, y0 + d); g.closePath(); g.fill(); };
  quad(Lx, Ly, Bx, By, a); quad(Bx, By, Rx, Ry, b);
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(Bx - 1, By, 2, d);
}
