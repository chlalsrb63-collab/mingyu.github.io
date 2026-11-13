/**
 * Level art laid over a map after its ground is painted: landmarks that make
 * each area memorable, decals that vary the ground, layers that pulse, small
 * life in the air, waypoint stones and signposts, the town's market dressing,
 * and the slow turn of day into night outdoors.
 *
 * Nothing here changes where anyone can walk. Landmarks only ever stand on
 * tiles that are already blocked, facing open ground, and the tiles they cover
 * are handed back so the scene stops drawing what used to stand there.
 */

const T = 32;
const INK = "#2b2233";

// ───────────────────────────── pixel tools ─────────────────────────────

export const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const dk = (c, f = 0.76) => mix(c, f), lt = (c, f = 1.3) => mix(c, f);
function sheet(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  return [c, x];
}
function tools(x) {
  const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h)); };
  const oval = (cx, cy, rx, ry, col) => {
    x.fillStyle = col;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const k = 1 - ((y + 0.5 - cy) / ry) ** 2;
      if (k <= 0) continue;
      const w = Math.round(rx * Math.sqrt(k));
      x.fillRect(Math.round(cx) - w, y, w * 2, 1);
    }
  };
  const tri = (pts, col) => { x.fillStyle = col; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); };
  return { r, oval, tri };
}
function ink(c, x, col = INK) {
  const w = c.width, h = c.height;
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  x.putImageData(img, 0, 0);
  const src = x.getImageData(0, 0, w, h).data;
  const solid = (a, b) => a >= 0 && b >= 0 && a < w && b < h && src[(b * w + a) * 4 + 3] > 0;
  x.fillStyle = col;
  for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) if (!solid(a, b) && (solid(a - 1, b) || solid(a + 1, b) || solid(a, b - 1) || solid(a, b + 1))) x.fillRect(a, b, 1, 1);
  return c;
}
function prop(w, h, draw) {
  const [c, x] = sheet(w + 4, h + 4);
  x.translate(2, 2);
  draw(tools(x), x);
  x.setTransform(1, 0, 0, 1, 0, 0);
  return ink(c, x);
}
/** A soft round glow, cached by colour and radius, for additive light. */
const glows = new Map();
export function glow(col, r) {
  const key = col + r;
  let c = glows.get(key);
  if (!c) {
    let x;
    [c, x] = sheet(r * 2, r * 2);
    const gr = x.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2);
    glows.set(key, c);
  }
  return c;
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

// ───────────────────────────── sprites ─────────────────────────────

const STONE = ["#cfc8b4", "#aaa290", "#7c7666", "#e6e0cc"];
const MOSS = ["#5a9a4a", "#7abf5a", "#3f7a3e"];
const WOOD = "#8a5a34", WOOD_D = "#6a4226", WOOD_L = "#b08050";
let SPR = null;
/** Every sprite this module draws, made once. Each landmark also lists where it glows. */
export function sprites() {
  if (SPR) return SPR;
  // ── a waypoint: a carved standing stone; its rune is drawn lit or dark at run time
  const RUNE = [[9, 11], [9, 12], [9, 13], [9, 14], [9, 15], [9, 16], [9, 17], [9, 18], [9, 19], [9, 20], [8, 12], [7, 13], [10, 12], [11, 13], [7, 16], [8, 16], [10, 16], [11, 16], [8, 20], [10, 20], [7, 21], [11, 21]];
  const waypoint = prop(20, 44, (b) => {
    b.oval(10, 41, 10, 3, "#5a7a4a"); b.oval(10, 40, 8, 2, "#7aa860");
    b.tri([[3, 40], [17, 40], [15, 6], [11, 1], [6, 3], [4, 8]], "#7d8496");
    b.tri([[11, 1], [15, 6], [17, 40], [12, 40]], "#5e6474");
    b.tri([[6, 3], [11, 1], [9, 9], [5, 12]], "#9aa2b4");
    for (const [x, y] of RUNE) b.r(x, y, 1, 1, "#3a3e4a");
    b.r(5, 30, 3, 2, MOSS[0]); b.r(4, 33, 4, 3, MOSS[0]); b.r(13, 35, 3, 3, MOSS[2]); b.r(5, 31, 1, 1, MOSS[1]);
  });
  // ── signposts: a post with a board, pointing left, right, or nowhere
  const sign = (way) => prop(30, 34, (b) => {
    b.r(13, 10, 4, 24, WOOD); b.r(15, 10, 2, 24, WOOD_D); b.r(11, 32, 8, 2, WOOD_D);
    const L = way < 0 ? 4 : 1, R = way > 0 ? 25 : 28;
    b.r(L, 2, R - L, 11, "#d8b07a"); b.r(L, 2, R - L, 1, "#ecc88c"); b.r(L, 12, R - L, 1, "#a87c4a");
    if (way < 0) b.tri([[4, 2], [4, 13], [0, 7.5]], "#d8b07a");
    if (way > 0) b.tri([[25, 2], [25, 13], [29, 7.5]], "#d8b07a");
    b.r(L + 3, 5, R - L - 7, 1, "#8a6038"); b.r(L + 3, 8, R - L - 10, 1, "#8a6038");
    b.r(14, 4, 2, 2, "#5a5e6c");
  });
  // ── meadow: a ruined watchtower
  const tower = prop(92, 150, (b) => {
    const [l, m, d, h] = STONE;
    b.oval(46, 146, 46, 5, "#6a8a54");
    b.r(14, 40, 64, 106, m); b.r(14, 40, 14, 106, l); b.r(62, 40, 16, 106, d);
    for (let y = 48; y < 146; y += 9) { b.r(14, y, 64, 1, d); for (let x = 14 + ((y / 9) % 2 ? 0 : 8); x < 78; x += 16) b.r(x, y - 8, 1, 8, d); }
    // a broken crown: battlements standing on one side, fallen on the other
    b.r(10, 30, 72, 12, m); b.r(10, 30, 72, 2, h); b.r(10, 40, 72, 2, d);
    for (const [x, hgt] of [[10, 14], [26, 12], [42, 6], [58, 0], [72, 3]]) if (hgt) { b.r(x, 30 - hgt, 10, hgt, m); b.r(x, 30 - hgt, 10, 2, h); b.r(x + 7, 30 - hgt, 3, hgt, d); }
    b.tri([[56, 30], [82, 30], [82, 36]], dk(m, 0.9));
    // a slit window, a door at the foot, ivy climbing one side
    b.r(42, 64, 8, 20, "#2a2632"); b.r(43, 64, 6, 2, "#4a4652"); b.r(42, 96, 8, 16, "#2a2632");
    b.r(36, 120, 20, 26, "#5a3a26"); b.r(36, 118, 20, 3, d); b.r(38, 122, 16, 24, WOOD); b.r(45, 122, 2, 24, WOOD_D); b.r(51, 132, 2, 2, "#e0c060");
    for (let y = 46; y < 140; y += 3) { const x = 16 + Math.round(Math.sin(y / 9) * 5 + (y > 100 ? 4 : 0)); b.r(x, y, 3, 2, MOSS[0]); if (y % 9 === 0) b.r(x + 3, y, 2, 2, MOSS[1]); }
    // rubble at the base
    for (const [x, y, w] of [[0, 138, 12], [80, 140, 10], [70, 134, 8], [4, 132, 6]]) { b.r(x, y, w, 8, m); b.r(x, y, w, 2, h); b.r(x + w - 3, y + 2, 3, 6, d); }
    // a banner still flying
    b.r(20, 0, 2, 20, "#5a5e6c"); b.r(22, 1, 14, 9, "#c84a50"); b.r(22, 1, 14, 2, "#e06a6a"); b.r(28, 4, 3, 3, "#f0d070");
  });
  // ── meadow: a giant old tree, its roots wide, a lantern hung on a low branch
  const oak = prop(140, 150, (b) => {
    const leaf = "#4faa5a", d = "#2e6e48", l = "#6abf5c", hl = "#8ad46a";
    // roots and trunk
    b.tri([[40, 150], [100, 150], [86, 92], [56, 92]], "#7a5030");
    b.tri([[20, 150], [52, 150], [60, 120]], "#7a5030"); b.tri([[88, 150], [124, 150], [82, 118]], "#6a4226");
    b.r(54, 70, 34, 60, "#8a5a34"); b.r(76, 70, 12, 60, "#6a4226"); b.r(58, 74, 4, 50, "#a87446");
    for (const y of [86, 100, 116]) b.r(60, y, 12, 1, "#6a4226");
    b.oval(70, 112, 7, 9, "#3a2618"); b.oval(70, 113, 5, 7, "#24180e");
    // the crown: dark masses, lit masses upper left, highlights
    for (const [x, y, rx, ry] of [[70, 50, 66, 46], [24, 64, 22, 18], [118, 62, 22, 18], [70, 16, 34, 16]]) b.oval(x, y, rx, ry, d);
    for (const [x, y, rx, ry] of [[62, 42, 54, 36], [28, 58, 16, 12], [110, 54, 18, 14], [64, 14, 26, 11]]) b.oval(x, y, rx, ry, leaf);
    for (const [x, y, rx, ry] of [[48, 32, 26, 16], [24, 52, 9, 6], [96, 40, 14, 9], [58, 10, 14, 5]]) b.oval(x, y, rx, ry, l);
    for (const [x, y] of [[40, 24], [56, 20], [88, 34], [30, 48], [70, 28]]) { b.r(x, y, 6, 2, hl); b.r(x + 2, y - 1, 3, 1, hl); }
    // vines hanging and a lantern on a cord
    for (const x of [20, 34, 108, 122]) for (let y = 70; y < 70 + (x % 3) * 8 + 14; y += 2) b.r(x + (y % 4 ? 0 : 1), y, 1, 2, "#3f7a3e");
    b.r(104, 70, 1, 16, "#3a2618"); b.r(100, 86, 9, 10, "#3a3c48"); b.r(102, 88, 5, 6, "#ffe690"); b.r(103, 89, 3, 3, "#fff8d0");
  });
  // ── forest: a mossy shrine, two pillars under a lintel, an altar between
  const shrine = prop(96, 92, (b) => {
    const [l, m, d] = STONE;
    b.oval(48, 88, 48, 5, "#2e5e3e");
    for (const x of [6, 74]) { b.r(x, 18, 16, 70, m); b.r(x, 18, 4, 70, l); b.r(x + 12, 18, 4, 70, d); for (let y = 30; y < 86; y += 12) b.r(x, y, 16, 1, d); b.r(x - 2, 82, 20, 6, d); }
    b.r(0, 6, 96, 14, m); b.r(0, 6, 96, 3, l); b.r(0, 18, 96, 2, d); b.r(4, 0, 88, 7, m); b.r(4, 0, 88, 2, l);
    b.r(36, 8, 24, 9, "#2a2632"); b.r(40, 10, 16, 5, "#7af0b0"); b.r(46, 9, 4, 7, "#d8fff0");
    b.r(30, 62, 36, 22, m); b.r(30, 62, 36, 3, l); b.r(58, 62, 8, 22, d); b.r(26, 82, 44, 6, d);
    b.r(40, 56, 4, 6, "#f2ead0"); b.r(40, 53, 4, 3, "#ffb030"); b.r(52, 57, 3, 5, "#f2ead0"); b.r(52, 54, 3, 3, "#ffb030");
    b.oval(48, 60, 4, 2, "#e8584a");
    // moss over everything, thickest on top
    for (let x = 0; x < 96; x += 3) { const h = 2 + Math.round(hash(x, 5, 3) * 4); b.r(x, 0, 3, h, MOSS[0]); if (h > 4) b.r(x + 1, h, 1, 2, MOSS[2]); }
    for (const x of [6, 74]) for (let y = 24; y < 80; y += 5) if (hash(x, y, 4) > 0.45) b.r(x + (hash(x, y, 5) > 0.5 ? 0 : 10), y, 6, 3, MOSS[hash(x, y, 6) > 0.5 ? 0 : 1]);
  });
  // ── a stone lip where water falls over a ledge (the falling water is drawn live)
  const lip = (w, col) => prop(w, 18, (b) => {
    const [l, m, d] = col;
    b.r(0, 0, w, 18, m); b.r(0, 0, w, 3, l); b.r(0, 14, w, 4, d);
    for (let x = 4; x < w; x += 9) b.r(x, 5, 3, 6, d);
  });
  // ── city: a billboard on two steel legs, framed in neon
  const board = prop(128, 132, (b) => {
    for (const x of [24, 98]) { b.r(x, 80, 6, 52, "#5a6070"); b.r(x + 4, 80, 2, 52, "#3a3e4a"); b.r(x - 4, 128, 14, 4, "#3a3e4a"); }
    b.r(18, 92, 92, 3, "#5a6070"); b.r(30, 92, 2, 36, "#5a6070");
    b.r(0, 0, 128, 84, "#20232c"); b.r(4, 4, 120, 76, "#2c3f6a");
    // the ad: a smiling adventurer and a few lines of type
    b.r(4, 4, 120, 22, "#3a5a9a"); b.oval(34, 48, 20, 18, "#fbfbff"); b.r(18, 26, 8, 12, "#fbfbff"); b.r(42, 26, 8, 12, "#fbfbff"); b.r(20, 28, 4, 6, "#f6a8a0"); b.r(44, 28, 4, 6, "#f6a8a0");
    b.r(26, 46, 4, 5, INK); b.r(38, 46, 4, 5, INK); b.r(31, 54, 6, 2, INK); b.r(22, 52, 4, 2, "#f6a8a0"); b.r(42, 52, 4, 2, "#f6a8a0");
    b.r(64, 32, 52, 8, "#ffd24a"); b.r(64, 46, 44, 5, "#fbfbff"); b.r(64, 56, 38, 5, "#fbfbff"); b.r(64, 66, 24, 8, "#ff5a94");
    b.r(10, 8, 30, 10, "#fbfbff"); b.r(44, 8, 18, 10, "#ffd24a");
    for (let x = 0; x < 128; x += 4) { b.r(x, 0, 2, 2, "#ff5a94"); b.r(x, 82, 2, 2, "#5ae4e4"); }
    for (let y = 0; y < 84; y += 4) { b.r(0, y, 2, 2, "#ff5a94"); b.r(126, y, 2, 2, "#5ae4e4"); }
  });
  // ── city: stairs down to the subway
  const metro = prop(96, 66, (b) => {
    b.r(0, 26, 96, 40, "#5c6474"); b.r(0, 26, 96, 3, "#7a8494");
    b.r(10, 30, 76, 34, "#1a1d26");
    for (let i = 0; i < 6; i++) { b.r(12 + i * 2, 32 + i * 5, 72 - i * 4, 3, "#4a5064"); b.r(12 + i * 2, 32 + i * 5, 72 - i * 4, 1, "#6a7288"); }
    for (const x of [6, 86]) { b.r(x, 14, 4, 50, "#9aa2b4"); b.r(x + 2, 14, 2, 50, "#6a7288"); }
    b.r(6, 14, 84, 3, "#9aa2b4"); b.r(6, 16, 84, 1, "#6a7288");
    // the sign on its post
    b.r(44, 0, 8, 14, "#3a3e4a"); b.r(34, -2, 28, 14, "#2c8a5a"); b.r(34, -2, 28, 2, "#4ab07a");
    b.r(40, 1, 3, 8, "#fbfbff"); b.r(53, 1, 3, 8, "#fbfbff"); b.r(43, 2, 2, 3, "#fbfbff"); b.r(51, 2, 2, 3, "#fbfbff"); b.r(45, 4, 6, 2, "#fbfbff");
  });
  // ── cave: a great cluster of crystals
  const crystals = prop(100, 104, (b) => {
    b.oval(50, 100, 50, 5, "#2a3a58");
    const shard = (x, w, h, a, c) => {
      const base = 100, top = base - h, tip = x + w / 2 + a;
      b.tri([[x, base], [x + w, base], [tip + w * 0.18, top + 6], [tip, top]], c);
      b.tri([[x, base], [x + w * 0.45, base], [tip, top]], lt(c, 1.28));
      b.tri([[x + w * 0.8, base], [x + w, base], [tip + w * 0.18, top + 6]], dk(c, 0.7));
      b.r(Math.round(tip - 1), top + 8, 2, Math.round(h * 0.4), "#ffffff");
    };
    shard(4, 18, 46, -6, "#5ac8d8"); shard(70, 20, 52, 8, "#9a7af4"); shard(18, 24, 72, -4, "#72e6f4");
    shard(52, 26, 88, 2, "#c08af4"); shard(36, 22, 98, -2, "#72e6f4"); shard(82, 14, 34, 6, "#5ac8d8");
  });
  // ── crypt: the nave of a bone cathedral set into the rock, its rose window lit
  const nave = prop(132, 132, (b) => {
    const BONE = "#e2dcc6", BD = "#a8a08a", BL = "#f4f0e0";
    b.r(6, 20, 120, 112, "#3a3438"); b.r(6, 20, 120, 2, "#5a5250");
    b.tri([[6, 30], [66, 0], [126, 30]], "#3a3438");
    // ribs vaulting up into a pointed arch
    for (let i = 0; i < 16; i++) {
      const a = (i / 15) * Math.PI;
      const x = 66 - Math.cos(a) * 56, y = 120 - Math.sin(a) * 100;
      b.r(x - 3, y - 3, 7, 7, i % 2 ? BONE : BL); b.r(x + 2, y - 3, 2, 7, BD);
    }
    // the rose window
    b.oval(66, 56, 26, 26, "#1a1216"); b.oval(66, 56, 23, 23, "#6a1c3a");
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; b.tri([[66, 56], [66 + Math.cos(a) * 22, 56 + Math.sin(a) * 22], [66 + Math.cos(a + 0.4) * 22, 56 + Math.sin(a + 0.4) * 22]], k % 2 ? "#a83a5a" : "#5a3a9a"); }
    b.oval(66, 56, 7, 7, "#e8c060"); b.oval(66, 56, 3, 3, "#fff0a0");
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; b.r(66 + Math.cos(a) * 22 - 1, 56 + Math.sin(a) * 22 - 1, 3, 3, BONE); }
    // skulls in niches down both sides, a doorway of darkness below
    for (const x of [16, 104]) for (let y = 74; y < 124; y += 16) { b.r(x - 2, y - 2, 14, 14, "#1a1216"); b.r(x, y, 10, 8, BONE); b.r(x + 1, y + 8, 8, 3, BONE); b.r(x + 2, y + 3, 2, 2, INK); b.r(x + 6, y + 3, 2, 2, INK); }
    b.tri([[44, 132], [88, 132], [88, 100], [66, 86], [44, 100]], "#0d0a10");
    b.r(40, 128, 52, 4, BD);
  });
  // ── sewer: a culvert in the wall; the sludge pouring out is drawn live
  const culvert = prop(64, 44, (b) => {
    b.r(0, 0, 64, 44, "#5a4636"); b.r(0, 0, 64, 3, "#7a6048"); for (let y = 8; y < 44; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < 64; x += 16) { b.r(x, y, 15, 7, "#6a5040"); b.r(x, y, 15, 1, "#8a6a52"); }
    b.oval(32, 26, 24, 18, "#2a2a26"); b.oval(32, 27, 20, 15, "#141812");
    for (let x = 14; x <= 50; x += 6) b.r(x, 10, 2, 32, "#5a5e6c");
    b.r(10, 18, 44, 2, "#5a5e6c"); b.r(10, 30, 44, 2, "#5a5e6c");
    b.r(12, 38, 40, 6, "#6a9a3a"); b.r(12, 38, 40, 2, "#8cc054");
  });
  // ── abyss: a heart grown into the wall, veins spreading from it
  const heart = prop(128, 120, (b) => {
    b.oval(64, 70, 64, 50, "#5c1e2b"); b.oval(64, 70, 58, 44, "#7c2f3c");
    for (let i = 0; i < 9; i++) { let x = 64, y = 70; const a = (i / 9) * Math.PI * 2; for (let s = 0; s < 14; s++) { x += Math.cos(a + Math.sin(s * 0.9 + i) * 0.6) * 4; y += Math.sin(a + Math.sin(s * 0.9 + i) * 0.6) * 3; b.r(x, y, 3 - (s > 8 ? 1 : 0), 2, s % 3 ? "#a81c2c" : "#c8324a"); } }
    b.oval(58, 64, 28, 26, "#8e1424"); b.oval(76, 58, 22, 20, "#a81c2c"); b.oval(56, 60, 22, 18, "#c8324a");
    b.tri([[34, 72], [94, 72], [64, 108]], "#a81c2c"); b.tri([[34, 72], [64, 72], [64, 108]], "#c8324a");
    b.oval(48, 52, 8, 5, "#e4606c"); b.r(44, 50, 6, 2, "#ff9aa0");
    // the great vessels on top, and ribs holding it in
    b.r(54, 18, 10, 30, "#8c2c3a"); b.r(54, 18, 3, 30, "#ba4e5a"); b.r(70, 24, 12, 26, "#5a1622"); b.oval(76, 24, 7, 4, "#330e18"); b.oval(59, 18, 6, 3, "#330e18");
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const y = 46 + i * 16; b.r(64 + s * 44 - 3, y, 7, 4, "#e2dcc6"); b.r(64 + s * 50 - 2, y + 3, 5, 6, "#a8a08a"); }
  });
  // ── town: market stalls under striped awnings
  const stall = (v) => prop(46, 50, (b) => {
    const stripe = [["#d84c4c", "#f6ecd2"], ["#4a78c0", "#f6ecd2"], ["#4a9a58", "#f2e6b8"]][v];
    for (const x of [3, 39]) { b.r(x, 14, 3, 36, WOOD); b.r(x + 2, 14, 1, 36, WOOD_D); }
    b.r(0, 30, 46, 14, WOOD_L); b.r(0, 30, 46, 2, "#d8a868"); b.r(0, 42, 46, 2, WOOD_D); for (const x of [14, 30]) b.r(x, 32, 1, 10, WOOD_D);
    const goods = [["#e8584a", "#f0a030", "#e8584a", "#9ad070"], ["#8ab4d8", "#e88aa8", "#8ab4d8", "#c8ccd4"], ["#b8303c", "#3058c0", "#5ab85a", "#e8c040"]][v];
    for (let i = 0; i < 8; i++) { const x = 3 + i * 5, c = goods[i % 4]; if (v === 2) { b.r(x, 23, 3, 6, "#c8d8e0"); b.r(x, 25, 3, 4, c); b.r(x + 1, 22, 1, 1, "#7a5430"); } else { b.oval(x + 2, 27, 2.4, 2.4, c); b.r(x + 1, 25, 1, 1, lt(c, 1.4)); } }
    b.tri([[-1, 16], [47, 16], [43, 2], [3, 2]], stripe[0]);
    for (let x = 3; x < 43; x += 8) b.tri([[x, 2], [x + 4, 2], [x + 4 + (x - 23) * 0.12, 16], [x + (x - 23) * 0.12, 16]], stripe[1]);
    for (let x = 0; x < 46; x += 6) b.oval(x + 3, 16, 3, 2, stripe[(x / 6) % 2]);
  });
  // ── town: a notice board for the day's tasks
  const notice = prop(36, 40, (b) => {
    for (const x of [3, 30]) { b.r(x, 8, 3, 32, WOOD); b.r(x + 2, 8, 1, 32, WOOD_D); }
    b.r(0, 4, 36, 24, WOOD_L); b.r(0, 4, 36, 2, "#d8a868"); b.r(0, 26, 36, 2, WOOD_D);
    b.r(2, 0, 32, 5, WOOD); b.r(2, 0, 32, 1, "#a87446");
    for (const [x, y, w, h, c] of [[4, 8, 9, 11, "#f6ecd2"], [15, 7, 8, 9, "#ffe8a0"], [25, 9, 8, 12, "#f6ecd2"], [14, 18, 9, 7, "#d8f0ff"]]) { b.r(x, y, w, h, c); b.r(x + 1, y + 2, w - 3, 1, "#a89878"); b.r(x + 1, y + 4, w - 4, 1, "#a89878"); b.r(x + Math.floor(w / 2), y, 1, 1, "#d84c4c"); }
  });
  // ── town: a statue to stand on the fountain's column
  const statue = prop(22, 34, (b) => {
    const s = ["#e6e2d4", "#c2bcac", "#8c8678"];
    b.r(3, 26, 16, 8, s[1]); b.r(3, 26, 16, 2, s[0]); b.r(15, 28, 4, 6, s[2]);
    b.r(6, 16, 10, 10, s[1]); b.r(6, 16, 3, 10, s[0]); b.r(13, 16, 3, 10, s[2]);
    b.oval(11, 11, 7, 6, s[1]); b.oval(10, 10, 5, 4, s[0]); b.r(5, 3, 3, 4, s[1]); b.r(14, 3, 3, 4, s[1]);
    b.r(8, 10, 1, 2, s[2]); b.r(13, 10, 1, 2, s[2]);
    b.r(17, 0, 2, 18, s[0]); b.r(16, 14, 4, 2, s[2]); b.r(18, 0, 1, 14, s[2]);
  });
  SPR = { waypoint, RUNE, sign: [sign(-1), sign(0), sign(1)], tower, oak, shrine, lip, board, metro, crystals, nave, culvert, heart, stall: [0, 1, 2].map(stall), notice, statue };
  return SPR;
}

// ───────────────────────────── landmarks ─────────────────────────────

/**
 * What each map is known by: [sprite key, footprint w×h in tiles, where on the
 * map to look (fractions), extra]. `falls` asks for a ledge over water.
 */
const LANDMARKS = {
  meadow: [["tower", 3, 2, 0.62, 0.3, { on: "T", any: true }], ["oak", 4, 2, 0.3, 0.72, { on: "T", any: true }]],
  forest: [["shrine", 3, 2, 0.4, 0.6, { on: "P" }], ["falls", 2, 2, 0.6, 0.35, { on: "PBRleCU", water: "#4aa2e2", foam: "#e8f8ff" }]],
  city: [["board", 4, 2, 0.4, 0.4, { on: "Z" }], ["metro", 3, 2, 0.7, 0.7, { on: "Z" }]],
  cave: [["crystals", 3, 2, 0.5, 0.45, { on: "WSK", any: true }], ["crystals", 3, 2, 0.25, 0.75, { on: "WSK", any: true }]],
  crypt: [["nave", 4, 3, 0.55, 0.45, { on: "W" }]],
  sewer: [["falls", 2, 1, 0.4, 0.5, { on: "W", water: "#6a9a3a", foam: "#b0dc70", culvert: true }], ["falls", 2, 1, 0.7, 0.3, { on: "W", water: "#6a9a3a", foam: "#b0dc70", culvert: true }]],
  abyss: [["heart", 4, 3, 0.5, 0.5, { on: "W" }]],
};
const GLOW = { tower: null, oak: "#ffe690", shrine: "#7af0b0", board: "#ff5a94", metro: "#4ab07a", crystals: "#72e6f4", nave: "#c8324a", heart: "#ff4a5a" };

function open(m, x, y) { return x >= 0 && y >= 0 && x < m.w && y < m.h && m.o[y][x] === " " && m.g[y][x] !== "w" && m.g[y][x] !== "W"; }
/** A blocked tile of one of the kinds a landmark may stand on ("W" is bare rock). */
function base(m, x, y, on) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  const o = m.o[y][x], g0 = m.g[y][x];
  if (g0 === "w") return false;
  return o === " " ? g0 === "W" && on.includes("W") : on.includes(o);
}

/**
 * Plan a map's level art. Each landmark stands on blocked tiles of the kinds it
 * suits (trees for the tower, pines for the shrine, rock for the heart), facing
 * open ground on some side, and as close as it can get to its spot on the map.
 * Returns what to draw, the tiles it covers (as "x,y"), and live effects (falls).
 */
export function plan(m, theme) {
  const S = sprites();
  const want = LANDMARKS[theme] || [];
  const taken = [], covered = new Set(), statics = [], falls = [];
  const gates = (m.portals || []).map((p) => [p.x, p.y]);
  const marks = (m.marks || []).map((k) => [k.x, k.y]);
  const bigs = new Set();
  for (const b of m.big || []) for (let j = -1; j < 5; j++) for (let i = -1; i < 6; i++) bigs.add(`${b.x + i},${b.y + j}`);
  for (const [key, w, h, fx, fy, extra] of want) {
    const sp = key === "falls" ? null : S[key], tall = sp ? sp.height : 48, wide = sp ? sp.width : w * T;
    let best = null, bd = 1e9;
    for (let y = 0; y <= m.h - h; y++) for (let x = 0; x <= m.w - w; x++) {
      let ok = true;
      for (let j = 0; j < h && ok; j++) for (let i = 0; i < w && ok; i++) if (!base(m, x + i, y + j, extra.on) || bigs.has(`${x + i},${y + j}`)) ok = false;
      if (!ok) continue;
      // the whole picture has to fit on the map
      const cx = (x + w / 2) * T;
      if ((y + h) * T + 2 - tall < -4 || cx - wide / 2 < 0 || cx + wide / 2 > m.w * T) continue;
      // it has to face something: open ground (or for a waterfall, water) along one side, best of all below
      let pen = 0;
      if (extra.water && !extra.culvert) {
        let n = 0;
        for (let i = 0; i < w; i++) n += m.g[y + h] && m.g[y + h][x + i] === "w" ? 1 : 0;
        if (n < w) continue;
      } else {
        const side = (pts) => pts.filter(([a, b2]) => open(m, a, b2)).length;
        const below = side([...Array(w)].map((_, i) => [x + i, y + h])), above = side([...Array(w)].map((_, i) => [x + i, y - 1]));
        const left = side([...Array(h)].map((_, j) => [x - 1, y + j])), right = side([...Array(h)].map((_, j) => [x + w, y + j]));
        if (below >= Math.ceil(w * 0.6)) pen = 0;
        else if (!extra.any) continue;
        else if (above >= Math.ceil(w * 0.6) || left >= h || right >= h) pen = 6;
        else continue;
      }
      if (gates.some(([gx, gy]) => Math.abs(gx - x - w / 2) < 6 && Math.abs(gy - y - h / 2) < 6)) continue;
      if (marks.some(([gx, gy]) => Math.abs(gx - x - w / 2) < 3 && Math.abs(gy - y - h / 2) < 3)) continue;
      if (taken.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < 10)) continue;
      const d = Math.hypot(x + w / 2 - fx * m.w, y + h / 2 - fy * m.h) + pen + hash(x, y, 77) * 3;
      if (d < bd) { bd = d; best = [x, y, pen]; }
    }
    if (!best) continue;
    const [x, y, pen] = best;
    taken.push(best);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) covered.add(`${x + i},${y + j}`);
    // standing in a tree line, it clears the trees in front of it so it can be seen
    if (pen) for (let i = 0; i < w; i++) for (let j = y + h; j < m.h && base(m, x + i, j, extra.on); j++) covered.add(`${x + i},${j}`);
    if (key === "falls") {
      if (extra.culvert) {
        statics.push({ sp: S.culvert, x: (x + w / 2) * T, y: (y + h) * T - 2, glow: null, glint: -1 });
        falls.push({ x: (x + w / 2) * T - 14, w: 28, top: (y + h) * T - 20, bottom: (y + h) * T + 16, water: extra.water, foam: extra.foam, ph: hash(x, y, 2) * 9, pool: true });
      } else {
        statics.push({ sp: S.lip(w * T, ["#aaa290", "#7c7666", "#5a5650"]), x: (x + w / 2) * T, y: (y + h) * T - 12, glow: null, glint: -1 });
        falls.push({ x: x * T + 4, w: w * T - 8, top: (y + h) * T - 14, bottom: (y + h) * T + 22, water: extra.water, foam: extra.foam, ph: hash(x, y, 2) * 9 });
      }
      continue;
    }
    statics.push({ sp, x: (x + w / 2) * T, y: (y + h) * T + 2, glow: GLOW[key] || null, glint: key === "crystals" ? hash(x, y, 9) * 6 : -1, big: !!GLOW[key], land: key, ph: hash(x, y, 3) * 9 });
  }
  return { statics, covered, falls };
}

// ───────────────────────────── the town's market ─────────────────────────────

/** Stalls where some of the town's crates stand, a notice board by the task-giver, the fountain's statue. */
export function town(m) {
  const S = sprites();
  const out = [], swap = new Set();
  if (!m.safe) return { statics: out, swap, strings: [] };
  let k = 0;
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (m.o[y][x] !== "B" || hash(x, y, 31) > 0.55) continue;
    swap.add(`${x},${y}`);
    out.push({ sp: S.stall[k++ % 3], x: x * T + 16, y: (y + 1) * T - 2, glow: null, glint: -1, nightGlow: "#ffd890" });
  }
  // the day's tasks pinned up beside the one who hands them out, on a blocked tile so it never stands in the way
  for (const n of m.npcs || []) {
    if (n.role !== "daily") continue;
    let best = null, bd = 9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = n.x + dx, y = n.y + dy, o = m.o[y] && m.o[y][x];
      if (!o || !"BFTRe".includes(o) || swap.has(`${x},${y}`)) continue;
      const d = Math.abs(dx) + Math.abs(dy) + (dy > 0 ? 0.5 : 0);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) { swap.add(`${best[0]},${best[1]}`); out.push({ sp: S.notice, x: best[0] * T + 16, y: (best[1] + 1) * T - 2, glow: null, glint: -1 }); }
    else out.push({ sp: S.notice, x: n.x * T + 16, y: n.y * T + 6, glow: null, glint: -1 });
  }
  for (const b of m.big || []) if (b.t === "fountain") out.push({ sp: S.statue, x: (b.x + 1) * T, y: (b.y + 2) * T - 1, lift: 50, glow: null, glint: -1 });
  // lantern strings between lamp posts that stand near each other
  const lamps = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.o[y][x] === "L") lamps.push([x, y]);
  const strings = [];
  for (let i = 0; i < lamps.length; i++) for (let j = i + 1; j < lamps.length; j++) {
    const [ax, ay] = lamps[i], [bx, by] = lamps[j];
    if (ay === by && Math.abs(ax - bx) <= 12 && Math.abs(ax - bx) >= 4) strings.push({ ax: ax * T + 16, ay: ay * T - 20, bx: bx * T + 16, by: by * T - 20 });
  }
  return { statics: out, swap, strings };
}

// ───────────────────────────── ground decals ─────────────────────────────

/** Small, low-contrast variety on open ground: flower patches, mushrooms, cracks, stains, worn spots. */
export function decals(m, theme, ctx) {
  const b = tools(ctx);
  const FL = ["#fffbe8", "#ffd84a", "#ff9ac0", "#9ac8ff", "#c8a0ff"];
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
    if (!open(m, x, y)) continue;
    const g0 = m.g[y][x], h = hash(x, y, 101), X = x * T, Y = y * T;
    const r1 = hash(x, y, 102), r2 = hash(x, y, 103);
    if ((theme === "meadow" || theme === "town") && ".,\"t".includes(g0)) {
      // a flower meadow: drifts of flowers where the grass is undisturbed
      const drift = Math.sin(x * 0.31 + y * 0.17) + Math.sin(x * 0.11 - y * 0.27) > 1.1;
      if (drift && h < 0.7) for (let i = 0; i < 3; i++) { const px = X + 3 + Math.floor(hash(x, y, 110 + i) * 26), py = Y + 3 + Math.floor(hash(x, y, 120 + i) * 26), c = FL[Math.floor(hash(x, y, 130 + i) * 5)]; b.r(px, py - 1, 1, 1, c); b.r(px - 1, py, 3, 1, c); b.r(px, py + 1, 1, 1, c); b.r(px, py, 1, 1, "#ffe890"); b.r(px, py + 2, 1, 2, "#3f8a3e"); }
      else if (h < 0.02) { b.oval(X + 16, Y + 18, 9, 3.6, "#4a8ac0"); b.oval(X + 15, Y + 17, 6, 2.2, "#6aaee0"); b.r(X + 11, Y + 16, 3, 1, "#cfeaff"); }
    } else if (theme === "forest" && ":;\"".includes(g0)) {
      if (h < 0.025) { // a fairy ring of mushrooms
        for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283, px = X + 16 + Math.round(Math.cos(a) * 10), py = Y + 16 + Math.round(Math.sin(a) * 6); b.r(px - 1, py, 3, 2, "#e8dcc0"); b.r(px - 2, py - 2, 5, 2, i % 2 ? "#c8443c" : "#e0b860"); b.r(px - 1, py - 2, 1, 1, "#fff2d0"); }
      } else if (h < 0.08) { b.oval(X + 8 + r1 * 16, Y + 10 + r2 * 12, 6, 3, "#356e46"); b.r(X + 6 + r1 * 16, Y + 9 + r2 * 12, 3, 1, "#4f8f5a"); }
    } else if (theme === "city" && "ak".includes(g0)) {
      if (h < 0.05) { const px = X + 4 + Math.floor(r1 * 18), py = Y + 6 + Math.floor(r2 * 18); b.r(px, py, 5, 1, "#2e3240"); b.r(px + 4, py + 1, 4, 1, "#2e3240"); b.r(px + 7, py + 2, 1, 3, "#2e3240"); b.r(px + 1, py - 1, 1, 1, "#2e3240"); }
      else if (h < 0.075) { b.oval(X + 16, Y + 16, 7, 3, "#2a2c36"); b.r(X + 12, Y + 15, 3, 1, "#7a5ab0"); b.r(X + 17, Y + 16, 2, 1, "#3a8a8a"); }
    } else if (theme === "cave" && "cd".includes(g0)) {
      if (h < 0.06) { const px = X + 4 + Math.floor(r1 * 20), py = Y + 4 + Math.floor(r2 * 20); b.r(px, py, 2, 1, "#5ae8d0"); b.r(px + 3, py + 2, 1, 1, "#5ae8d0"); b.r(px + 1, py + 3, 1, 1, "#9af4e4"); }
      else if (h < 0.1) { const px = X + 6 + Math.floor(r1 * 16), py = Y + 8 + Math.floor(r2 * 14); b.r(px, py, 4, 1, "#2a3a52"); b.r(px + 3, py + 1, 1, 3, "#2a3a52"); b.r(px + 4, py + 3, 3, 1, "#2a3a52"); }
    } else if (theme === "crypt" && "cd".includes(g0)) {
      if (h < 0.05) { const px = X + 5 + Math.floor(r1 * 18), py = Y + 8 + Math.floor(r2 * 16); b.r(px, py, 6, 2, "#c8c2ac"); b.r(px - 1, py - 1, 2, 4, "#e2dcc6"); b.r(px + 5, py - 1, 2, 4, "#e2dcc6"); }
      else if (h < 0.09) { const px = X + 6 + Math.floor(r1 * 16), py = Y + 6 + Math.floor(r2 * 16); b.r(px, py, 1, 4, "#3e3a38"); b.r(px + 1, py + 3, 3, 1, "#3e3a38"); b.r(px + 3, py + 4, 1, 3, "#3e3a38"); }
    } else if (theme === "sewer" && "cd".includes(g0)) {
      if (h < 0.07) { b.oval(X + 10 + r1 * 12, Y + 14 + r2 * 8, 7, 3, "#3e4a3c"); b.r(X + 8 + r1 * 12, Y + 13 + r2 * 8, 3, 1, "#6a8a4a"); }
    } else if (theme === "abyss" && "cd".includes(g0)) {
      if (h < 0.07) { let px = X + 4 + r1 * 10, py = Y + 6 + r2 * 10; for (let s = 0; s < 8; s++) { px += 2 + Math.sin(s + h * 9); py += Math.cos(s * 1.3 + r1 * 6); b.r(px, py, 2, 1, s % 2 ? "#5c1e2b" : "#8e1424"); } }
    }
  }
}

// ───────────────────────────── layers that pulse ─────────────────────────────

/**
 * A canvas the size of the map holding what should breathe: glowing water in
 * the cave, veins in the abyss's walls, a sheen on the sewer's sludge. The
 * scene draws the visible part each frame at a rising and falling strength.
 */
export function pulse(m, theme) {
  if (!["cave", "abyss", "sewer", "crypt"].includes(theme)) return null;
  const [c, x] = sheet(m.w * T, m.h * T);
  const b = tools(x);
  let any = false;
  for (let y = 1; y < m.h - 1; y++) for (let tx = 1; tx < m.w - 1; tx++) {
    const X = tx * T, Y = y * T, g0 = m.g[y][tx];
    if (theme === "cave" && g0 === "w") { b.oval(X + 16, Y + 16, 18, 14, "rgba(90,232,255,0.22)"); b.r(X + 8, Y + 14, 16, 1, "rgba(200,250,255,0.5)"); any = true; }
    if (theme === "sewer" && g0 === "w" && hash(tx, y, 61) < 0.5) { b.r(X + 4 + hash(tx, y, 62) * 14, Y + 10 + hash(tx, y, 63) * 12, 9, 1, "rgba(200,255,140,0.55)"); any = true; }
    if (theme === "crypt" && m.o[y][tx] === "3") { b.oval(X + 16, Y + 10, 22, 16, "rgba(255,190,90,0.18)"); any = true; }
    // veins on rock faces that look out over the floor
    if (theme === "abyss" && g0 === "W" && open(m, tx, y + 1) && hash(tx, y, 64) < 0.6) {
      let px = X + hash(tx, y, 65) * 20, py = Y + 30;
      for (let s = 0; s < 12; s++) { px += (hash(tx, y, 70 + s) - 0.5) * 6; py -= 2 + hash(tx, y, 90 + s) * 2; b.r(px, py, 2, 2, s % 3 ? "#ff3a4a" : "#ff8a8a"); }
      any = true;
    }
  }
  return any ? c : null;
}

// ───────────────────────────── live effects ─────────────────────────────

/** Falling water (or sludge) over a ledge, its foam churning where it lands. */
export function drawFalls(g, falls, t, ox, oy, vw, vh) {
  for (const f of falls) {
    if (f.x > ox + vw || f.x + f.w < ox || f.top > oy + vh || f.bottom < oy) continue;
    const h = f.bottom - f.top - 8;
    g.fillStyle = f.water; g.fillRect(f.x, f.top, f.w, h);
    g.fillStyle = lt(f.water, 1.25);
    for (let i = 0; i < f.w; i += 4) { const off = (t / 6 + i * 13 + f.ph * 40) % h; g.fillRect(f.x + i, f.top + off, 2, 6); }
    g.fillStyle = f.foam;
    for (let i = 0; i < f.w; i += 3) { const k = Math.sin(t / 90 + i + f.ph) * 2; g.fillRect(f.x + i - 1, f.top + h - 2 + k, 4, 3); }
    if (f.pool) { g.fillStyle = f.water; g.beginPath(); g.ellipse(f.x + f.w / 2, f.top + h + 3, f.w / 2 + 8, 5, 0, 0, 7); g.fill(); g.fillStyle = f.foam; }
    g.fillRect(f.x - 3, f.top + h + 2, f.w + 6, 2);
  }
}

/** Points that make small things happen: steam out of the city's road, drips in the cave, rats' eyes in the sewer. */
export function emitters(m, theme) {
  const out = [];
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
    const h = hash(x, y, 141);
    if (theme === "city" && open(m, x, y) && m.g[y][x] === "a" && h < 0.012) out.push({ k: "steam", x: x * T + 16, y: y * T + 20, ph: h * 900 });
    if ((theme === "cave" || theme === "crypt" || theme === "sewer") && m.g[y][x] === "W" && open(m, x, y + 1) && h < 0.07) out.push({ k: "drip", x: x * T + 6 + Math.floor(hash(x, y, 142) * 20), y: y * T + 30, ph: h * 9000 });
    if (theme === "sewer" && m.g[y][x] === "W" && open(m, x, y + 1) && hash(x, y, 143) < 0.06) out.push({ k: "eyes", x: x * T + 10 + Math.floor(hash(x, y, 144) * 12), y: y * T + 22, ph: hash(x, y, 145) * 7000 });
  }
  return out;
}
export function drawEmitters(g, list, t, ox, oy, vw, vh, parts) {
  for (const e of list) {
    if (e.x < ox - 20 || e.x > ox + vw + 20 || e.y < oy - 40 || e.y > oy + vh + 20) continue;
    if (e.k === "steam") { if (Math.random() < 0.08) parts.push({ x: e.x - 3 + Math.random() * 6, y: e.y, vx: (Math.random() - 0.5) * 6, vy: -10 - Math.random() * 6, life: 1.4, color: "#d8dce8", g: -3, s: 3 }); }
    else if (e.k === "drip") {
      const k = ((t + e.ph) % 3200) / 3200;
      if (k < 0.22) { g.fillStyle = "#9ad0f0"; g.fillRect(e.x, e.y + Math.floor((k / 0.22) ** 2 * 26), 1, 2); }
      else if (k < 0.3) { const r = Math.round((k - 0.22) * 60); g.fillStyle = "rgba(170,220,255,.6)"; g.fillRect(e.x - r, e.y + 28, r * 2 + 1, 1); }
    } else if (e.k === "eyes") {
      const k = (t + e.ph) % 7000;
      if (k < 2600 && !(k > 1200 && k < 1320)) { g.fillStyle = "#ff3a3a"; g.fillRect(e.x, e.y, 1, 1); g.fillRect(e.x + 3, e.y, 1, 1); }
    }
  }
}

/** Butterflies over the meadow and town, birds crossing high, a heron of a shadow now and then. */
export function drawCritters(g, list, dt, t, ox, oy, vw, vh, theme) {
  const want = theme === "meadow" ? 8 : theme === "town" ? 5 : theme === "forest" ? 3 : 0;
  while (list.length < want) list.push(spawnCritter(ox, oy, vw, vh, list.length));
  while (list.length > want) list.pop();
  for (const c of list) {
    c.life -= dt;
    if (c.k === "bird") { c.x += c.vx * dt; c.y += Math.sin(t / 400 + c.ph) * 4 * dt; }
    else { c.x += (Math.sin(t / 500 + c.ph) * 16 + c.vx) * dt; c.y += Math.cos(t / 330 + c.ph * 2) * 14 * dt; }
    const sx = Math.round(c.x - ox), sy = Math.round(c.y - oy);
    if (c.life <= 0 || sx < -40 || sx > vw + 40 || sy < -40 || sy > vh + 40) { Object.assign(c, spawnCritter(ox, oy, vw, vh, c.i)); continue; }
    if (c.k === "bird") {
      const up = Math.sin(t / 90 + c.ph) > 0;
      g.fillStyle = "rgba(20,24,50,.18)"; g.fillRect(sx + 6, sy + 46, 6, 2);
      g.fillStyle = "#3a3448"; g.fillRect(sx, sy, 2, 1); g.fillRect(sx + 2, sy + (up ? -1 : 1), 2, 1); g.fillRect(sx + 4, sy, 1, 1); g.fillRect(sx + 5, sy + (up ? -1 : 1), 2, 1); g.fillRect(sx + 7, sy, 2, 1);
    } else {
      const open2 = Math.sin(t / 60 + c.ph) > 0;
      g.fillStyle = c.c;
      if (open2) { g.fillRect(sx - 2, sy - 1, 2, 2); g.fillRect(sx + 1, sy - 1, 2, 2); } else { g.fillRect(sx - 1, sy - 2, 1, 2); g.fillRect(sx + 1, sy - 2, 1, 2); }
      g.fillStyle = "#3a3448"; g.fillRect(sx, sy - 1, 1, 2);
    }
  }
}
function spawnCritter(ox, oy, vw, vh, i) {
  const bird = i % 4 === 3;
  const BF = ["#ffd84a", "#fffbe8", "#ff9ac0", "#9ac8ff", "#f0a040"];
  return bird
    ? { i, k: "bird", x: ox - 30, y: oy + 20 + Math.random() * vh * 0.5, vx: 60 + Math.random() * 30, ph: Math.random() * 9, life: 30 }
    : { i, k: "fly", x: ox + Math.random() * vw, y: oy + Math.random() * vh, vx: (Math.random() - 0.5) * 10, ph: Math.random() * 9, life: 12 + Math.random() * 10, c: BF[Math.floor(Math.random() * 5)] };
}

/** Lanterns strung between lamp posts, swaying a little, lit at night. */
export function drawStrings(g, strings, t, ox, oy, vw, vh, night) {
  const COL = ["#ff6a6a", "#ffd24a", "#7ad0ff", "#9af08a", "#ff9ac0"];
  for (const s of strings) {
    if (Math.max(s.ax, s.bx) < ox || Math.min(s.ax, s.bx) > ox + vw || s.ay > oy + vh + 40 || s.ay < oy - 40) continue;
    const n = Math.round(Math.abs(s.bx - s.ax) / 6), sway = Math.sin(t / 900 + s.ax) * 1.5;
    g.fillStyle = "#3a3448";
    for (let i = 0; i <= n; i++) { const k = i / n, x = s.ax + (s.bx - s.ax) * k, y = s.ay + Math.sin(k * Math.PI) * (14 + sway); g.fillRect(Math.round(x), Math.round(y), 2, 1); }
    const m = Math.max(3, Math.floor(n / 4));
    for (let i = 1; i < m; i++) {
      const k = i / m, x = Math.round(s.ax + (s.bx - s.ax) * k), y = Math.round(s.ay + Math.sin(k * Math.PI) * (14 + sway)) + 1, c = COL[(i + Math.round(s.ax / T)) % 5];
      g.fillStyle = "#3a3448"; g.fillRect(x - 2, y + 1, 5, 6);
      g.fillStyle = night > 0.3 ? lt(c, 1.25) : c; g.fillRect(x - 1, y + 2, 3, 4);
      if (night > 0.3) { g.globalCompositeOperation = "lighter"; g.globalAlpha = night * 0.55; g.drawImage(glow(c, 10), x - 10, y - 6); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
    }
  }
}

// ───────────────────────────── day and night ─────────────────────────────

const CYCLE = 40 * 60 * 1000;
/**
 * The hour outdoors, from the real clock: one full day every forty minutes.
 * Returns how far into night (0–1) and how warm the light is (dusk and dawn).
 */
export function daylight(now = Date.now()) {
  const k = typeof globalThis.__dayK === "number" ? globalThis.__dayK : (now % CYCLE) / CYCLE;
  const ramp = (a, b, v) => Math.max(0, Math.min(1, (v - a) / (b - a)));
  const night = k < 0.45 ? 0 : k < 0.58 ? ramp(0.45, 0.58, k) : k < 0.88 ? 1 : 1 - ramp(0.88, 1, k);
  const warm = Math.max(0, 1 - Math.abs(k - 0.5) / 0.06) + Math.max(0, 1 - Math.abs(k - 0.93) / 0.05) * 0.7;
  return { night, warm, k };
}
/** A uniform wash over the whole view: never a vignette, never darker at the edges. */
export function wash(g, vw, vh, night, warm, cap) {
  if (warm > 0.01) { g.globalAlpha = Math.min(0.09, warm * 0.09); g.fillStyle = "#ff9a50"; g.fillRect(0, 0, vw, vh); }
  const a = Math.min(cap, night * 0.18);
  if (a > 0.005) { g.globalAlpha = a; g.fillStyle = "#141c48"; g.fillRect(0, 0, vw, vh); }
  g.globalAlpha = 1;
}
export { rgba };
