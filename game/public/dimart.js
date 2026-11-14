/**
 * 차원 균열 art, drawn in code: the town's obelisk (차원의 오벨리스크), the shrines an elite leaves
 * behind (pylons: 분노 · 질풍 · 수호 · 정령), the progress orb, the way home and the master's chest.
 * Quarter view, light from the upper left, one dark outline, one shadow tone per material
 * (shifted toward violet), no soft edges. Static parts are baked once; what moves (a bob, a
 * flicker, a swirl) is drawn on top each frame by the `draw*` functions.
 */

const INK = "#2b2233";
const sheet = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());
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
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const oval = (g, cx, cy, rx, ry, col) => { g.fillStyle = col; for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } };

/** The kinds of shrine: colours (dark, mid, light, core) and a 5 × 5 glyph. */
export const PYLON = {
  atk: { col: ["#7a1e2a", "#d83a3a", "#ff8a5a", "#ffe0a0"], glyph: ["..#..", "..#..", ".###.", "..#..", "..#.."] },
  spd: { col: ["#0e5a4a", "#22b07a", "#7affb8", "#e0fff0"], glyph: ["#..#.", ".#..#", "..#..", ".#..#", "#..#."] },
  shield: { col: ["#1e3a8a", "#3a7ae8", "#9ac8ff", "#f0f8ff"], glyph: ["#####", "#...#", "#...#", ".#.#.", "..#.."] },
  gauge: { col: ["#4a1e7a", "#9a4ae8", "#d8a0ff", "#fff0ff"], glyph: ["..#..", ".###.", "#####", ".###.", "..#.."] },
};
const VIO = ["#2a1a44", "#4a2e78", "#7a4ac0", "#b880ff", "#f0d8ff"];

/** 차원의 오벨리스크: a tapering monolith of dark slate on a stepped plinth, split down its face by a violet rift. Foot at (20, 82). */
export const obelisk = () => once("obelisk", () => {
  const W = 40, H = 86, [c, g] = sheet(W, H);
  // the plinth: two stepped slabs
  oval(g, 20, 80, 17, 4, "#3a3450"); oval(g, 20, 79, 17, 4, "#5a5270");
  oval(g, 20, 76, 13, 3, "#4a4262"); oval(g, 20, 75, 13, 3, "#6e6688");
  px(g, 8, 79, 4, 1, "#8a82a6"); px(g, 10, 75, 3, 1, "#9a92b8");
  // the shaft: lit west face, shadowed east face, tapering to a point
  for (let y = 10; y <= 74; y++) {
    const k = (y - 10) / 64, half = Math.round(4 + k * 6);
    px(g, 20 - half, y, half, 1, "#4e4470");          // west face (lit)
    px(g, 20, y, half, 1, "#2e2848");                 // east face (shade)
    px(g, 20 - half, y, 1, 1, "#6a5e92");             // the lit edge
    if (y % 14 === 0) px(g, 20 - half + 1, y, half - 1, 1, "#3e365c");   // courses of stone
  }
  // the pyramidion
  for (let y = 2; y < 10; y++) { const half = Math.max(1, Math.round((y - 1) * 0.55)); px(g, 20 - half, y, half, 1, "#6a5e92"); px(g, 20, y, half, 1, "#3a3258"); }
  // the rift down its face: a jagged seam of violet light, brightest in the middle
  let x0 = 19;
  for (let y = 14; y <= 70; y++) {
    if (y % 4 === 0) x0 += y % 8 === 0 ? 1 : -1;
    const mid = Math.abs(y - 42) < 16;
    px(g, x0, y, 2, 1, mid ? VIO[3] : VIO[2]);
    if (mid && y % 3 !== 0) px(g, x0, y, 1, 1, VIO[4]);
  }
  // runes cut into the plinth's front
  for (const rx of [12, 17, 23, 28]) px(g, rx, 77, 2, 1, VIO[2]);
  return outline(c, g);
});
/** What moves on the obelisk: two shards circling its waist and a pulse in the seam. (dx, dy) is where the sprite sits. */
export function obeliskAnim(g, t, dx, dy) {
  const beat = 0.5 + 0.5 * Math.sin(t / 420);
  g.globalAlpha = 0.35 + 0.45 * beat;
  px(g, dx + 19, dy + 30, 2, 24, VIO[4]);
  g.globalAlpha = 1;
  for (let i = 0; i < 2; i++) {
    const a = t / 900 + i * Math.PI, sx = dx + 20 + Math.cos(a) * 15, sy = dy + 40 + Math.sin(a) * 5 + Math.sin(t / 300 + i) * 2;
    if (Math.sin(a) < 0) g.globalAlpha = 0.6;   // behind the stone: dimmer
    px(g, sx - 2, sy - 3, 4, 6, INK); px(g, sx - 1, sy - 2, 2, 4, VIO[2]); px(g, sx - 1, sy - 2, 1, 2, VIO[4]);
    g.globalAlpha = 1;
  }
}

/** A shrine: a squat stone stele with the kind's crystal floating over it and its glyph cut into the face. Foot at (9, 30). */
export const pylon = (kind) => once("py:" + kind, () => {
  const K = PYLON[kind] || PYLON.gauge, [c, g] = sheet(18, 32);
  oval(g, 9, 29, 7, 2, "#3a3450");
  px(g, 3, 14, 6, 15, "#6e6688"); px(g, 9, 14, 6, 15, "#4a4262"); px(g, 3, 14, 1, 15, "#9a92b8");
  px(g, 2, 12, 14, 3, "#5a5270"); px(g, 2, 12, 14, 1, "#8a82a6");
  // the glyph, cut in and glowing (one pixel per cell: it reads at this size)
  K.glyph.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "#") px(g, 6 + x, 18 + y * 2, 1, 2, K.col[2]); }));
  return outline(c, g);
});
/** Draw a shrine standing at screen (sx, sy): its stele, the crystal bobbing over it, and a ring that shrinks as its time runs out. */
export function drawPylon(g, t, sx, sy, kind, left) {
  const K = PYLON[kind] || PYLON.gauge, sp = pylon(kind);
  sx = Math.round(sx); sy = Math.round(sy);
  // the reach on the ground, pulsing
  g.globalAlpha = 0.18 + 0.1 * Math.sin(t / 200);
  oval(g, sx, sy, 14, 5, K.col[2]);
  g.globalAlpha = 1;
  g.drawImage(sp, sx - 9, sy - 30);
  // the crystal: a diamond, lit on its upper left
  const by = sy - 38 + Math.round(Math.sin(t / 260) * 2);
  for (let i = 0; i < 6; i++) { px(g, sx - i, by + i, i * 2 + 1, 1, INK); px(g, sx - i, by + 12 - i, i * 2 + 1, 1, INK); }
  for (let i = 1; i < 6; i++) { px(g, sx - i + 1, by + i, i, 1, K.col[2]); px(g, sx, by + i, i, 1, K.col[1]); px(g, sx - i + 1, by + 12 - i, i * 2 - 1, 1, K.col[0]); }
  px(g, sx - 2, by + 3, 1, 2, K.col[3]);
  // the time left: a dashed arc under it that goes as the seconds go
  if (left !== undefined) {
    const k = Math.max(0, Math.min(1, left / 30));
    for (let i = 0; i < 12; i++) if (i / 12 < k) { const a = -Math.PI / 2 + (i / 12) * Math.PI * 2; px(g, sx + Math.cos(a) * 12, sy + Math.sin(a) * 4, 2, 1, K.col[3]); }
  }
}
/** A progress orb an elite left: a violet ball of light hovering over its shadow. */
export function drawOrb(g, t, sx, sy, id = 0) {
  sx = Math.round(sx); sy = Math.round(sy);
  oval(g, sx, sy, 4, 1, "rgba(20,10,40,.45)");
  const oy = sy - 10 + Math.round(Math.sin(t / 180 + id) * 2);
  oval(g, sx, oy, 4, 4, INK);
  oval(g, sx, oy, 3, 3, VIO[2]);
  oval(g, sx - 1, oy - 1, 2, 2, VIO[3]);
  px(g, sx - 2, oy - 2, 1, 1, VIO[4]);
  // motes falling off it
  const m = (t / 90 + id * 7) % 12;
  px(g, sx + 3 - (m % 3), oy + m - 4, 1, 1, VIO[3]);
}
/** The way home: an upright ring of stone round a violet swirl. Foot at its middle bottom. */
export const portalFrame = () => once("portal", () => {
  const [c, g] = sheet(36, 46);
  oval(g, 18, 43, 15, 3, "#3a3450");
  // the ring: an ellipse of dressed stones
  for (let a = 0; a < 40; a++) {
    const th = (a / 40) * Math.PI * 2, x = 18 + Math.cos(th) * 13, y = 23 + Math.sin(th) * 18;
    px(g, x - 2, y - 2, 4, 4, Math.cos(th) < -0.2 || Math.sin(th) < -0.6 ? "#8a82a6" : Math.cos(th) > 0.4 ? "#4a4262" : "#6e6688");
  }
  return outline(c, g);
});
export function drawPortal(g, t, sx, sy) {
  sx = Math.round(sx); sy = Math.round(sy);
  const sp = portalFrame();
  // the swirl first (behind the stones): rings of violet turning inward
  const cy = sy - 21;
  for (let r = 0; r < 4; r++) {
    const rr = 10 - r * 2.4, ph = t / (300 - r * 50) + r;
    g.fillStyle = VIO[Math.min(4, r + 1)];
    for (let i = 0; i < 14; i++) { const a = ph + (i / 14) * Math.PI * 2; if (i % 3 === 0) continue; g.fillRect(Math.round(sx + Math.cos(a) * rr * 0.75), Math.round(cy + Math.sin(a) * rr * 1.3), 2, 2); }
  }
  oval(g, sx, cy, 2, 3, VIO[4]);
  g.drawImage(sp, sx - 18, sy - 44);
}
/** The master's chest: dark wood bound in violet iron, a glowing lock; open, its lid thrown back. Foot at (12, 18). */
export const chest = (open) => once("chest:" + (open ? 1 : 0), () => {
  const [c, g] = sheet(24, 22);
  oval(g, 12, 19, 10, 2, "#3a3450");
  px(g, 2, 9, 20, 9, "#6a3e2a"); px(g, 2, 9, 3, 9, "#8a5a3a"); px(g, 17, 9, 5, 9, "#4e2a22");
  for (const x0 of [4, 11, 18]) px(g, x0, 9, 2, 9, VIO[1]);
  if (!open) {
    px(g, 2, 4, 20, 5, "#7a4a30"); px(g, 2, 4, 20, 1, "#9a6a44"); px(g, 2, 8, 20, 1, "#4e2a22");
    for (const x0 of [4, 11, 18]) px(g, x0, 4, 2, 5, VIO[2]);
    px(g, 10, 8, 4, 4, VIO[2]); px(g, 11, 9, 2, 2, VIO[4]);
  } else {
    px(g, 2, 1, 20, 4, "#4e2a22"); px(g, 2, 1, 20, 1, "#6a3e2a"); px(g, 4, 1, 2, 4, VIO[1]); px(g, 18, 1, 2, 4, VIO[1]);
    px(g, 4, 6, 16, 3, "#20142e"); px(g, 6, 6, 3, 2, "#ffd84a"); px(g, 12, 6, 4, 2, VIO[3]);
  }
  return outline(c, g);
});
/** Draw the chest; `state` 0 waiting for you, 1 you have opened it, 2 not yours. */
export function drawChest(g, t, sx, sy, state) {
  sx = Math.round(sx); sy = Math.round(sy);
  const sp = chest(state === 1);
  if (state === 0) { g.globalAlpha = 0.25 + 0.15 * Math.sin(t / 220); oval(g, sx, sy - 1, 14, 5, VIO[3]); g.globalAlpha = 1; }
  g.drawImage(sp, sx - 12, sy - 19);
  if (state === 0 && Math.sin(t / 300) > 0.6) { px(g, sx - 9, sy - 22, 1, 3, "#ffffff"); px(g, sx - 10, sy - 21, 3, 1, "#ffffff"); }
}
