/**
 * The campfire's company, drawn in code: stumps to sit on, a stone ring, a tripod
 * with a bubbling pot, a rolled bedroll, the town's glowing spirit tree (정령나무),
 * and the little things in hand by the fire — a lute to strum and a warm cup.
 *
 * Quarter view, light from the upper left, one dark outline, one shadow tone per
 * material (shifted toward violet), no soft edges.
 */

const INK = "#2b2233";
function sheet(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function tools(x) {
  const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  /** A hard-edged ellipse, row by row. */
  const oval = (cx, cy, rx, ry, col) => { x.fillStyle = col; for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2))); x.fillRect(cx - w, cy + y, w * 2 + 1, 1); } };
  return { r, oval };
}
/** A one-pixel dark outline around everything drawn so far. */
function outline(c, x, col = INK) {
  const w = c.width, h = c.height, src = x.getImageData(0, 0, w, h), d = src.data, out = x.createImageData(w, h);
  out.data.set(d);
  const [R, G, B] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
    const i = (y * w + X) * 4;
    if (d[i + 3]) continue;
    const on = (a, b) => a >= 0 && b >= 0 && a < w && b < h && d[(b * w + a) * 4 + 3] > 0;
    if (on(X - 1, y) || on(X + 1, y) || on(X, y - 1) || on(X, y + 1)) { out.data[i] = R; out.data[i + 1] = G; out.data[i + 2] = B; out.data[i + 3] = 255; }
  }
  x.putImageData(out, 0, 0);
  return c;
}

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());

/** A log stump, cut flat: rings on top, bark down the sides. Foot at (9, 12). */
export const stump = () => once("stump", () => {
  const [c, x] = sheet(18, 14), { r, oval } = tools(x);
  r(2, 5, 14, 6, "#6a4226"); r(2, 5, 4, 6, "#8a5a34"); r(13, 5, 3, 6, "#4e2e22");
  r(5, 7, 1, 4, "#4e2e22"); r(10, 6, 1, 5, "#8a5a34");
  oval(9, 5, 7, 3, "#d8a868"); oval(9, 5, 5, 2, "#c08848"); oval(9, 5, 2, 1, "#d8a868"); r(9, 5, 1, 1, "#9a6434");
  r(3, 4, 2, 1, "#f0c888");
  r(1, 10, 3, 2, "#6a4226"); r(14, 10, 3, 1, "#4e2e22");      // roots
  return outline(c, x);
});

/** A rolled bedroll, lying along the ground with two straps. Centre at (12, 7). */
export const bedroll = () => once("bedroll", () => {
  const [c, x] = sheet(26, 14), { r, oval } = tools(x);
  // the roll runs down-right on screen, as a log would on the diamond
  for (let i = 0; i < 16; i++) { const X = 4 + i, Y = 3 + (i >> 1); r(X, Y, 1, 6, i < 3 ? "#e07a4a" : "#c8583a"); r(X, Y + 5, 1, 1, "#8e3a34"); r(X, Y, 1, 1, "#f09a68"); }
  oval(21, 11, 2, 3, "#e8c890"); oval(21, 11, 1, 1, "#c8583a"); r(21, 10, 1, 1, "#b04838");
  for (const s of [7, 15]) { const Y = 3 + (s >> 1); r(s, Y, 1, 6, "#5a3a2a"); r(s, Y, 1, 1, "#8a6a4a"); }
  return outline(c, x);
});

/** Stones laid in a ring around a fire, flattened onto the ground. Centre at (17, 9). */
export const ring = () => once("ring", () => {
  const [c, x] = sheet(34, 18), { r } = tools(x);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, X = Math.round(17 + Math.cos(a) * 13), Y = Math.round(9 + Math.sin(a) * 6), big = i % 3 !== 1;
    r(X - 2, Y - 1, big ? 4 : 3, 3, "#8a8e9c"); r(X - 2, Y - 1, big ? 3 : 2, 1, "#c4c8d4"); r(X + (big ? 1 : 0), Y + 1, 1, 1, "#5e6070");
  }
  return outline(c, x);
});

/**
 * Three poles leaning together over the fire, a pot hung from where they meet.
 * Foot line at y 30 (the fire's centre at x 17). Frame 0–1: the lid lifting with the boil.
 */
export const tripod = (f = 0) => once("tripod" + f, () => {
  const [c, x] = sheet(34, 32), { r, oval } = tools(x);
  const pole = (x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) r(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1, col); };
  pole(17, 2, 17, 26, "#5a3a24");                  // the back pole, half hidden
  pole(16, 2, 4, 30, "#7a5232"); pole(17, 2, 5, 30, "#9a6a40");
  pole(18, 2, 30, 30, "#5a3a24"); pole(17, 2, 29, 30, "#7a5232");
  r(15, 1, 5, 2, "#c8a070");                         // the lashing
  r(17, 3, 1, 9, "#3a3448");                         // the chain
  // the pot: dark iron, a lit rim, a lid that lifts as it boils
  oval(17, 17, 6, 5, "#3e3a4a"); r(11, 15, 13, 4, "#3e3a4a"); oval(15, 16, 2, 2, "#5a566a");
  r(10, 12, 15, 2, "#6a667a"); r(10, 12, 15, 1, "#8e8aa0");
  r(12, 11 - f, 11, 1, "#4a4658"); r(16, 10 - f, 3, 1, "#8e8aa0");
  r(11, 20, 2, 1, "#2a2634"); r(22, 20, 2, 1, "#2a2634");
  if (f) { r(14, 11, 2, 1, "#f0e0c0"); r(20, 11, 1, 1, "#f0e0c0"); }
  return outline(c, x);
});

/** A small lute held across the lap. Neck to the right. 14×8. */
export const lute = () => once("lute", () => {
  const [c, x] = sheet(16, 9), { r, oval } = tools(x);
  oval(4, 5, 3, 2, "#c87a3a"); r(2, 4, 2, 1, "#e8a860"); r(4, 5, 1, 1, "#4a2a1a");
  r(7, 4, 6, 1, "#7a4a2a"); r(13, 3, 2, 2, "#5a3420"); r(7, 4, 6, 1, "#9a6a40");
  return outline(c, x);
});
/** A warm cup with a handle. 6×6. */
export const cup = () => once("cup", () => {
  const [c, x] = sheet(7, 7), { r } = tools(x);
  r(1, 1, 4, 5, "#e8d8c0"); r(1, 1, 4, 1, "#8a4a2a"); r(4, 2, 1, 4, "#b8a890"); r(5, 2, 1, 2, "#e8d8c0");
  return outline(c, x);
});

/**
 * The spirit tree: a broad, cloud-like crown of glowing blue leaves over a twisting
 * violet trunk, curling tendrils at its edges, roots gripping mossy ground. An original
 * design for this game. 120×132, the foot of the trunk at (60, 128).
 */
export const spiritTree = () => once("spirit", () => {
  const W = 120, H = 132, [c, x] = sheet(W, H), { r, oval } = tools(x);
  // roots and moss
  oval(60, 126, 22, 4, "#2e7a6a"); oval(60, 125, 16, 3, "#46b090");
  for (const [rx, dir] of [[44, -1], [76, 1], [52, -1], [68, 1]]) for (let i = 0; i < 8; i++) r(rx + dir * i, 122 + (i >> 2), 3, 2, i < 4 ? "#7a5a9a" : "#5a3e7a");
  // the trunk: two strands twisting round each other
  for (let y = 70; y < 126; y++) {
    const k = (y - 70) / 56, w = Math.round(6 + k * 6), sx = Math.round(Math.sin(y / 9) * 3);
    r(60 - w + sx, y, w * 2, 1, "#6a4a8a");
    r(60 - w + sx, y, 3, 1, "#9a7ac0");                       // lit from the left
    r(60 + w + sx - 3, y, 3, 1, "#4a3068");
    const tw = Math.round(Math.sin(y / 5) * (w - 3));
    r(60 + sx + tw, y, 2, 1, (y >> 2) % 2 ? "#4a3068" : "#b898d8");
  }
  // branches up into the crown
  for (const [dx, len] of [[-1, 18], [1, 22], [-1, 10]]) for (let i = 0; i < len; i++) r(60 + dx * i, 72 - i, 4, 3, i % 5 ? "#6a4a8a" : "#9a7ac0");
  // the crown: many small leaf clusters heaped into a dome, back to front; each lit on its
  // upper left, darker toward the crown's lower right, so the edge reads as scalloped leaves
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = [];
  for (let i = 0; i < 400 && pts.length < 120; i++) {
    const a = rnd() * 6.283, d = Math.sqrt(rnd());
    const X = 60 + Math.cos(a) * d * 52, Y = 44 + Math.sin(a) * d * 34 - (1 - d) * 8;
    pts.push([Math.round(X), Math.round(Y), 5 + Math.round(rnd() * 5)]);
  }
  pts.sort((p, q) => p[1] - q[1]);
  const TONES = ["#1a3a80", "#2456b0", "#3378d0", "#4a9ae6", "#74c0f4", "#b0e4ff"];
  for (const [X, Y, rr] of pts) {
    // light: higher and further left is brighter
    const lit = Math.max(0, Math.min(1, 0.55 - (Y - 44) / 60 - (X - 60) / 140 + (rnd() - 0.5) * 0.25));
    const base = 1 + Math.round(lit * 3);
    oval(X + 1, Y + 2, rr, Math.round(rr * 0.75), TONES[Math.max(0, base - 1)]);
    oval(X, Y, rr, Math.round(rr * 0.75), TONES[base]);
    if (base >= 2) oval(X - Math.round(rr * 0.35), Y - Math.round(rr * 0.3), Math.round(rr * 0.45), Math.round(rr * 0.3), TONES[base + 1]);
    if (base >= 3 && rnd() < 0.5) r(X - Math.round(rr * 0.5), Y - Math.round(rr * 0.45), 2, 1, TONES[5]);
  }
  // glowing buds: little pale lights in pairs, never lone specks
  for (let i = 0; i < 26; i++) {
    const [X, Y] = pts[Math.floor(rnd() * pts.length)];
    r(X, Y, 2, 2, "#c8f4ff"); r(X, Y, 1, 1, "#ffffff");
  }
  // tendrils curling off the crown's edge
  const curl = (cx, cy, dir) => { for (let i = 0; i < 14; i++) { const a = i * 0.55, rr = 6 - i * 0.35; r(Math.round(cx + dir * Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 2, 2, "#c8e8ff"); } };
  curl(14, 46, -1); curl(106, 44, 1); curl(26, 18, -1);
  return outline(c, x, "#142456");
});
