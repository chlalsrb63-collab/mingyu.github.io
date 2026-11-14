/**
 * The old kingdom's autumn (단풍 왕도, theme "autumn"): which colour a tree has turned,
 * shared by the trees themselves (scene2d.js) and the leaves they shed on the ground
 * (iso_ground.js), so a red maple always stands on red litter.
 *
 *   HUE[k]        → { name, leaf: [dark, mid, lit, highlight], fall: [litter colours] }
 *   hueAt(m, x, y) → 0 crimson maple · 1 burnt-orange oak · 2 gold ginkgo · 3 late green
 */

const h32 = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Canopies: one shadow tone leaning violet, one highlight leaning yellow (pixel-art palette rules). */
export const HUE = [
  { name: "maple", leaf: ["#7a1f2a", "#b8322c", "#dc5236", "#f08a4a"], fall: ["#b8322c", "#dc5236", "#8e2a2a"] },
  { name: "oak", leaf: ["#7c3424", "#c0602a", "#e08a34", "#f4b860"], fall: ["#c0602a", "#e08a34", "#9a4a26"] },
  { name: "ginkgo", leaf: ["#8a5a1c", "#d49a26", "#f0c63e", "#fbe68a"], fall: ["#d49a26", "#f0c63e", "#b07c22"] },
  { name: "green", leaf: ["#24483a", "#3f7a44", "#62a050", "#a2c868"], fall: ["#c0602a", "#d49a26", "#7a8a3a"] },
];

/** Smooth, low-frequency: neighbouring trees mostly share a colour, so they read as groves. */
function grove(x, y) {
  const n = Math.sin(x * 0.19 + y * 0.07) * 1.2 + Math.sin(x * 0.05 - y * 0.23) + Math.sin((x + y) * 0.11 + 2) * 0.6 + h32(x >> 2, y >> 2, 31) * 0.5;
  return n;
}
export function hueAt(m, x, y) {
  const g = (i, j) => (m.g[j] && m.g[j][i]) || "";
  // what lies under it and around it decides first: gold litter is a ginkgo stand, red litter a maple grove
  let gold = 0, red = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = g(x + i, y + j); if (c === ";") gold++; else if (c === "%") red++; }
  if (gold >= 3) return 2;
  const n = grove(x, y);
  if (red >= 3) return n > 0.4 ? 1 : 0;
  const stray = h32(x, y, 77);
  if (stray < 0.08) return 3;
  return n > 1.3 ? 2 : n > 0.2 ? 1 : n > -1.1 ? 0 : 3;
}
