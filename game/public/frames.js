/**
 * The HUD's frame art, drawn here pixel by pixel and handed to CSS as
 * 9-slice border images (custom properties on :root). Every frame is laid out
 * at 1× on a small grid and blown up 2× with hard edges, so the borders stay
 * chunky and crisp the way a handheld's menu boxes are.
 *
 *  --fr-brass   the big panels (side column, bottom dock, windows): a dark
 *               outline, a three-tone brass bevel lit from the top left, a
 *               rivet in each corner, a plum-ink face.
 *  --fr-screen  sunken "screens" (minimap, chat log, bag, portrait): shade on
 *               the top and left, a lit lip on the bottom and right.
 *  --fr-plate   the small brass name plates that title a panel.
 *
 * Colours follow the HUD colour theme (hud.css, "HUD colour themes"): the
 * default set (--fr-*) is drawn from the :root values for the title screen,
 * the themed set (--frt-*) from #hud's, which the HUD containers use.
 * installFrames() runs again whenever the theme changes (keymap.js).
 */
const S = 2;   // every art pixel is S×S screen pixels

const INK = "#0d0b12";
export const FACE = "#211c2a";
/** The talk and quest windows' face opacity (hud.css "see-through talk"). */
const SEE_A = 0.74;

/** The frame colours of an element's theme; each fallback is the original brass look. */
function palette(cs) {
  const v = (name, d) => cs.getPropertyValue(name).trim() || d;
  return {
    ink: v("--fr-ink", INK), face: v("--face", FACE), line: v("--sf3", "#2c2537"),
    hi: v("--b-hi", "#f4dfa4"), mid: v("--b-mid", "#cf9f55"), lo: v("--b-lo", "#7c5326"), sh: v("--b-sh", "#4a2e14"),
    shine: v("--b-w", "#fff6d8"), warm: v("--b-m", "#e2b868"),
    scr: v("--scr", "#120f18"), lip: v("--sf4", "#3d3448"), deep: v("--sf0", "#07060b"), rim: v("--sf3", "#2a2433"),
  };
}

function grid(n) {
  const px = Array.from({ length: n }, () => Array(n).fill(null));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < n && y < n) px[y][x] = c; };
  return { px, set, n };
}
/** Parse #rgb / #rrggbb / rgba(...) into [r, g, b, a]. */
function parseRgba(c) {
  let m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(c);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((d) => d + d).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
}
function shiftRgb(c, dr, dg, db) {
  const p = parseRgba(c);
  if (!p) return c;
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return p[3] < 1 ? `rgba(${cl(p[0] + dr)},${cl(p[1] + dg)},${cl(p[2] + db)},${p[3]})` : `rgb(${cl(p[0] + dr)},${cl(p[1] + dg)},${cl(p[2] + db)})`;
}
function toUrl({ px, n }, grad) {
  const c = document.createElement("canvas");
  c.width = c.height = n * S;
  const g = c.getContext("2d");
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!px[y][x]) continue;
    g.fillStyle = px[y][x];
    g.fillRect(x * S, y * S, S, S);
  }
  if (grad) {
    const [inset, topCol, midCol, botCol] = grad;
    const x0 = inset * S, w = (n - inset * 2) * S;
    const lg = g.createLinearGradient(0, x0, 0, x0 + w);
    lg.addColorStop(0, topCol);
    lg.addColorStop(0.45, midCol);
    lg.addColorStop(1, botCol);
    g.fillStyle = lg;
    g.fillRect(x0, x0, w, w);
  }
  return `url(${c.toDataURL()})`;
}
/** Concentric rings from the outside in; `ring(i)` gives [lit-side colour, shade-side colour]. */
function rings(n, list, face) {
  const G = grid(n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.min(x, y, n - 1 - x, n - 1 - y);
    if (d >= list.length) { G.set(x, y, face); continue; }
    const [lit, shade] = list[d];
    // lit on the top and left edges, shaded on the bottom and right; the corner
    // diagonals split the difference the way a hand-drawn bevel does
    const litSide = (y === d && x < n - 1 - d) || (x === d && y < n - 1 - d);
    G.set(x, y, litSide ? lit : shade);
  }
  return G;
}

function brass(P) {
  const n = 18, INK = P.ink;
  const G = rings(n, [[INK, INK], [P.hi, P.lo], [P.mid, P.mid], [P.mid, P.mid], [P.lo, P.hi], [INK, INK]], P.face);
  // round the outer corners by one pixel
  for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) G.set(x, y, null);
  for (const [x, y] of [[1, 1], [n - 2, 1], [1, n - 2], [n - 2, n - 2]]) G.set(x, y, INK);
  // a domed rivet sits in each corner on the brass band
  const RIV = ["._hm.", "_hwmL", "hwhmL", "mmmLs", ".LLs."];
  const C = { _: P.mid, h: P.hi, w: P.shine, m: P.warm, L: P.lo, s: P.sh };
  // top-left and bottom-right carry a leaf sprout, top-right a little flower, bottom-left keeps its rivet;
  // the greens are a fixed ramp (dark outline keeps them readable on every HUD theme)
  const LEAF = [".dd..", "dgld.", "dlggd", ".dgd.", "..d.."], FLOWER = [".ppp.", "ppypp", ".ppp.", "..d..", "..d.."];
  const LC = { d: "#1e4a22", g: "#4f9a35", l: "#9fd45a", p: "#f08aa8", y: "#ffe27a" };
  const put = (rows, ox, oy, C, flip) => rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== ".") G.set(ox + (flip ? 4 - x : x), oy + y, C[ch]);
  }));
  put(RIV, 1, n - 6, C);
  put(LEAF, 1, 1, LC);
  put(FLOWER, n - 6, 1, LC);
  put(LEAF, n - 6, n - 6, LC, true);
  // a faint line just inside, so the face reads as a raised board
  for (let i = 6; i < n - 6; i++) { G.set(i, 6, P.line); G.set(6, i, P.line); }
  // subtle vertical gradient on the panel face (warm-lit top -> deep cozy bottom, respects HUD themes & opacity)
  return toUrl(G, [6, shiftRgb(P.face, 15, 12, 18), P.face, shiftRgb(P.face, -10, -9, -12)]);
}
function screen(P) {
  const n = 8;
  const G = rings(n, [[P.ink, P.lip], [P.deep, P.rim]], P.scr);
  for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) G.set(x, y, null);
  return toUrl(G, [2, shiftRgb(P.scr, -6, -5, -7), P.scr, shiftRgb(P.scr, 9, 8, 12)]);
}
function plate(P) {
  const n = 8;
  const G = rings(n, [[P.ink, P.ink], [P.hi, P.lo]], P.mid);
  for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) G.set(x, y, null);
  return toUrl(G);
}

/**
 * Ornaments that hang over a window's top corners (hud.css "window ornaments"): a meadow flower in leaves on the left, a
 * sprout on the right. Fixed leaf greens with a dark green outline, so they read on every HUD theme.
 */
const ORN_C = { O: "#17301a", D: "#2e6a2c", M: "#4c9a3a", L: "#8ccd52", H: "#c9ef8a", P: "#f4a3c4", Q: "#c8608e", W: "#ffe3ef", Y: "#ffd84a", y: "#c8901a" };
const ORN_FLOWER = [
  "..OOO...........",
  ".OWPPO..OO......",
  "OWPPQQOOLHO.....",
  "OPPYyQOLMLHO....",
  "OPQyyQOMMMLO....",
  ".OQQQOODMMO.....",
  "..OOODDOOOO.....",
  "...ODMO.........",
  "..OLMDO.........",
  ".OLHMO..........",
  ".OLMDO..........",
  "..OMO...........",
  "..ODO...........",
  "...O............",
];
const ORN_SPROUT = [
  "......OO....",
  ".....OHLO...",
  "..OO.OLMO...",
  ".OHLOOMDO...",
  ".OLMMODO.OO.",
  "..OMDOO.OLHO",
  "...OODOOLMO.",
  ".....ODMDO..",
  ".....OOOO...",
];
function sprite(rows) {
  const c = document.createElement("canvas");
  c.width = rows[0].length * S; c.height = rows.length * S;
  const g = c.getContext("2d");
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ORN_C[ch]) { g.fillStyle = ORN_C[ch]; g.fillRect(x * S, y * S, S, S); } }));
  return `url(${c.toDataURL()})`;
}

/** `c` (#rgb / #rrggbb) at opacity `a`; anything else comes back as it is. */
function fade(c, a) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (!m || a >= 1) return c;
  const h = m[1].length === 3 ? [...m[1]].map((d) => d + d).join("") : m[1];
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

export function installFrames() {
  const root = document.documentElement, r = root.style, hud = document.getElementById("hud");
  for (const [pre, P] of [["--fr-", palette(getComputedStyle(root))], ["--frt-", palette(getComputedStyle(hud || root))]]) {
    r.setProperty(pre + "brass", brass(P));
    r.setProperty(pre + "screen", screen(P));
    r.setProperty(pre + "plate", plate(P));
  }
  // the HUD's see-through faces (설정 HUD 투명도: --hud-a on :root, hud.css "HUD transparency"): same frames, the face at that opacity
  const P = palette(getComputedStyle(hud || root)), a = parseFloat(getComputedStyle(root).getPropertyValue("--hud-a")) || 1;
  r.setProperty("--frt-brass-a", brass({ ...P, face: fade(P.face, a) }));
  r.setProperty("--frt-screen-a", screen({ ...P, scr: fade(P.scr, a) }));
  // the talk and quest windows always see through a little (owner 2026-11-19): at most SEE_A, less when the HUD is set lower
  const see = Math.min(a, SEE_A);
  r.setProperty("--frt-brass-see", brass({ ...P, face: fade(P.face, see) }));
  r.setProperty("--frt-screen-see", screen({ ...P, scr: fade(P.scr, see) }));
  r.setProperty("--see-a", String(see));
  if (!r.getPropertyValue("--orn-flower")) { r.setProperty("--orn-flower", sprite(ORN_FLOWER)); r.setProperty("--orn-sprout", sprite(ORN_SPROUT)); }
  dispatchEvent(new Event("hud-skin"));   // the smartphone's bezel (phone.js) is drawn in the same theme colours
}
