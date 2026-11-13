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
 */
const S = 2;   // every art pixel is S×S screen pixels

const INK = "#0d0b12";
const BRASS = { hi: "#f4dfa4", mid: "#cf9f55", lo: "#7c5326", sh: "#4a2e14" };
export const FACE = "#211c2a";

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

function brass() {
  const n = 18;
  const G = rings(n, [[INK, INK], [BRASS.hi, BRASS.lo], [BRASS.mid, BRASS.mid], [BRASS.mid, BRASS.mid], [BRASS.lo, BRASS.hi], [INK, INK]], FACE);
  // round the outer corners by one pixel
  for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) G.set(x, y, null);
  for (const [x, y] of [[1, 1], [n - 2, 1], [1, n - 2], [n - 2, n - 2]]) G.set(x, y, INK);
  // a domed rivet sits in each corner on the brass band
  const RIV = ["._hm.", "_hwmL", "hwhmL", "mmmLs", ".LLs."];
  const C = { _: BRASS.mid, h: BRASS.hi, w: "#fff6d8", m: "#e2b868", L: BRASS.lo, s: BRASS.sh };
  for (const [ox, oy] of [[1, 1], [n - 6, 1], [1, n - 6], [n - 6, n - 6]]) {
    RIV.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") G.set(ox + x, oy + y, C[ch]); }));
  }
  // a faint lit line just inside, so the face reads as a raised board
  for (let i = 6; i < n - 6; i++) { G.set(i, 6, "#2c2537"); G.set(6, i, "#2c2537"); }
  return toUrl(G);
}
function screen() {
  const n = 8;
  const G = rings(n, [[INK, "#3d3448"], ["#07060b", "#2a2433"]], "#120f18");
  for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) G.set(x, y, null);
  return toUrl(G);
}
function plate() {
  const n = 8;
  const G = rings(n, [[INK, INK], [BRASS.hi, BRASS.lo]], BRASS.mid);
  for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) G.set(x, y, null);
  return toUrl(G);
}

export function installFrames() {
  const r = document.documentElement.style;
  r.setProperty("--fr-brass", brass());
  r.setProperty("--fr-screen", screen());
  r.setProperty("--fr-plate", plate());
}
