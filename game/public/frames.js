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
function toUrl({ px, n }) {
  const c = document.createElement("canvas");
  c.width = c.height = n * S;
  const g = c.getContext("2d");
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!px[y][x]) continue;
    g.fillStyle = px[y][x];
    g.fillRect(x * S, y * S, S, S);
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
  for (const [ox, oy] of [[1, 1], [n - 6, 1], [1, n - 6], [n - 6, n - 6]]) {
    RIV.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") G.set(ox + x, oy + y, C[ch]); }));
  }
  // a faint line just inside, so the face reads as a raised board
  for (let i = 6; i < n - 6; i++) { G.set(i, 6, P.line); G.set(6, i, P.line); }
  return toUrl(G);
}
function screen(P) {
  const n = 8;
  const G = rings(n, [[P.ink, P.lip], [P.deep, P.rim]], P.scr);
  for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) G.set(x, y, null);
  return toUrl(G);
}
function plate(P) {
  const n = 8;
  const G = rings(n, [[P.ink, P.ink], [P.hi, P.lo]], P.mid);
  for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) G.set(x, y, null);
  return toUrl(G);
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
}
