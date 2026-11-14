/**
 * The title screen's picture: a side-scrolling forest diorama with a band of
 * little animal adventurers walking the path (each with a hat and a weapon,
 * swinging now and then), hell-beasts watching from the dark between the far
 * trees, falling leaves and fireflies; and the pixel logo for 테일즈테일즈.
 *
 * Everything is drawn at 1× on a small canvas (`P` screen pixels per art pixel)
 * and blown up with hard edges. Light comes from the upper left; shadows lean
 * toward violet. The figures are drawn by scene2d.js (`figure` / `drawFigure`)
 * so they move exactly as they do in the world.
 */
import * as S3 from "./scene2d.js";
import * as SPC from "./species.js";
import * as MobArt from "./mobart.js";

const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const R = Math.round;

// ───────────────────────────── palette ─────────────────────────────

const SKY = ["#7cc4ea", "#94d0ee", "#afdcf0", "#cbe7ee", "#e6ecd8", "#f6e6bc"];
const CLOUD = ["#ffffff", "#e4f2f8", "#c4dcec"];
const HILL = ["#a6cfd0", "#8cbcc2", "#7aaab4"];
const FAR = { lit: "#4f8f78", mid: "#3c7666", dk: "#2c5a54", deep: "#1c3238", deeper: "#142429" };
const TREE = { hi: "#8cd06e", lit: "#62ae52", mid: "#4a9246", dk: "#336e3c", ink: "#1f4430", bark: "#7a5636", barkD: "#523826", barkL: "#9a7048" };
const GRASS = { hi: "#9ad874", lit: "#7cc764", mid: "#6cbf5e", dk: "#57a850", deep: "#3f8a44", ink: "#2c6a3c" };
const PATH = { lit: "#ecc488", mid: "#d9ab6c", dk: "#bd8c54", edge: "#8f6238", peb: "#f6dcaa" };
const FLOWERS = ["#ffffff", "#ffd860", "#ff9ab4", "#b6a0ff"];
const LEAF = ["#f0a040", "#e07a3a", "#f6c860", "#8ccf5a", "#d85a4a"];

// ───────────────────────────── the cast ─────────────────────────────

const look = (name) => (SPC.PRESETS.find((p) => p[0] === name) || SPC.PRESETS[0])[1].slice();
/** Who walks the path: [class, look, gear]. Hats from the wardrobe, weapons of every tier. */
const CAST = [
  ["warrior", look("치즈 고양이"), { wt: 3, cos: ["hat_helm"] }],
  ["mage", look("흰 토끼"), { wt: 4, wq: 2, cos: ["hat_wizard"] }],
  ["lancer", look("시바견"), { wt: 2, cos: ["hat_cap_red"] }],
  ["rogue", look("여우"), { wt: 5, wq: 3, cos: ["hat_tricorn"] }],
  ["mage", look("펭귄"), { wt: 3, wk: "book", cos: ["hat_beanie_mint"] }],
  ["warrior", look("곰돌이"), { wt: 1, cos: ["hat_straw"] }],
  ["rogue", look("햄스터"), { wt: 2, cos: ["hat_bow_pink"] }],
  ["lancer", look("판다"), { wt: 4, wq: 1, cos: ["hat_crown"] }],
  ["mage", look("꽃사슴"), { wt: 5, wq: 4, cos: ["hat_wreath_pink"] }],
  ["warrior", look("턱시도 고양이"), { wt: 5, wq: 2, cos: ["hat_beret_black"] }],
  ["rogue", look("다람쥐"), { wt: 3, cos: ["hat_beanie_red"] }],
  ["lancer", look("솜사탕 양"), { wt: 3, cos: ["hat_halo"] }],
];
/** Beasts that watch from between the far trees. */
const LURKERS = ["bearmaw", "ribdeer", "horsehalf", "foxtwine", "lionhand", "hydrasnake", "doghead", "twingoat", "splitboar", "owlstare"];

let cv = null, g = null, P = 3, iw = 0, ih = 0, built = false;
let cast = [], leaves = [], flies = [];
const shades = new Map();

export function init(canvas) {
  cv = canvas;
  g = cv.getContext("2d");
  resize();
  addEventListener("resize", resize);
}
export function resize() {
  if (!cv) return;
  const W = innerWidth, H = innerHeight;
  P = Math.max(2, Math.round(Math.min(H / 220, W / 140)));
  iw = Math.ceil(W / P); ih = Math.ceil(H / P);
  cv.width = iw; cv.height = ih;
  cv.style.width = iw * P + "px"; cv.style.height = ih * P + "px";
  g.imageSmoothingEnabled = false;
  build();
}
function build() {
  built = true;
  // as many walkers as fit, each a little apart, in a loose line
  const n = Math.max(3, Math.min(CAST.length, Math.floor(iw / 34)));
  const span = Math.min(iw - 40, n * 36), x0 = R((iw - span) / 2) + 14;
  cast = [];
  for (let i = 0; i < n; i++) {
    const [cls, lk, gear] = CAST[i];
    cast.push({ s: S3.figure(S3.playerLook(cls, lk, gear)), x: x0 + R((i + 0.5) * (span / n)) - 14, ph: hash(i, 7) * 9000, atkT: -1e9, atkN: 0, next: 1500 + hash(i, 3) * 6000, hop: -1e9 });
  }
  leaves = Array.from({ length: Math.round(iw / 14) }, (_, i) => newLeaf(i, true));
  flies = Array.from({ length: Math.round(iw / 22) }, (_, i) => ({ x: hash(i, 41) * iw, y: 0, ph: hash(i, 43) * 6, sp: 0.3 + hash(i, 47) * 0.5, k: hash(i, 53) }));
}
function newLeaf(i, any) {
  return { x: hash(i, Date.now() & 1023) * (iw + 60) - 30, y: any ? hash(i, 11) * ih : -4 - hash(i, 13) * 30, vy: 7 + hash(i, 17) * 9, ph: hash(i, 19) * 7, c: LEAF[(hash(i, 23) * LEAF.length) | 0], big: hash(i, 29) > 0.6 };
}

// ───────────────────────────── layers ─────────────────────────────

const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(R(x), R(y), w, h); };
/** The ground line: the path the cast walks on. */
const groundY = () => R(ih * 0.84);

function sky(t) {
  const gy = groundY(), top = gy - 60;
  // flat bands, each dithered into the next on its lower edge
  const n = SKY.length, bh = Math.ceil(top / n);
  for (let i = 0; i < n; i++) {
    px(0, i * bh, iw, bh + 1, SKY[i]);
    if (i + 1 < n) { g.fillStyle = SKY[i + 1]; for (let x = (i & 1); x < iw; x += 2) g.fillRect(x, i * bh + bh - 1, 1, 1); for (let x = 0; x < iw; x += 4) g.fillRect(x + (i & 1) * 2, i * bh + bh - 2, 1, 1); }
  }
  px(0, n * bh, iw, gy - n * bh, SKY[n - 1]);
  // a low warm sun with two rings of light
  const sx = R(iw * 0.8), sy = R(top * 0.72);
  disc(sx, sy, 15, "#fbf0cc"); disc(sx, sy, 11, "#fff8de"); disc(sx, sy, 8, "#ffffff");
  // clouds drifting slowly
  const cs = t / 1000 * 1.2;
  for (let i = -1; i < iw / 70 + 2; i++) {
    const k = Math.floor(cs / 70) + i, x = i * 70 - (cs % 70) + hash(k, 3) * 30, y = 8 + hash(k, 5) * top * 0.4;
    if (hash(k, 9) < 0.55) cloud(x, y, 14 + hash(k, 7) * 18);
  }
}
function disc(cx, cy, r, c) {
  g.fillStyle = c;
  for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
}
function cloud(x, y, w) {
  x = R(x); y = R(y); w = R(w);
  px(x + 4, y + 3, w, 5, CLOUD[1]);
  px(x + 2, y + 4, w + 4, 4, CLOUD[1]);
  px(x + 6, y, R(w * 0.4), 4, CLOUD[0]); px(x + 4 + R(w * 0.35), y - 2, R(w * 0.4), 5, CLOUD[0]);
  px(x + 4, y + 3, w, 2, CLOUD[0]);
  px(x + 3, y + 7, w + 2, 1, CLOUD[2]);
}
function hills(scroll) {
  const gy = groundY(), base = gy - 46;
  for (let layer = 0; layer < 2; layer++) {
    const s = scroll * (layer ? 0.12 : 0.06), amp = layer ? 22 : 34, c = HILL[layer ? 1 : 0];
    for (let x = 0; x < iw; x++) {
      const w = x + s, h = amp * (0.55 + 0.3 * Math.sin(w / 37 + layer) + 0.15 * Math.sin(w / 13 + layer * 3));
      const top = R(base - h - (layer ? 0 : 8));
      px(x, top, 1, gy - top, c);
      if (layer === 0) px(x, top, 1, 1, "#c4e2e0");
    }
  }
}
/** The far woods: a dark wall of pines with the deep forest showing between them, where the beasts wait. */
function farWoods(scroll, t) {
  const gy = groundY(), base = gy - 28;
  // the back row: dense, dark pines — the deep forest where the beasts wait
  const DEEP = { lit: FAR.deep, mid: FAR.deep, dk: FAR.deeper, deeper: FAR.deeper };
  const sb = scroll * 0.22, sb0 = Math.floor(sb / 7) - 2;
  px(0, base - 18, iw, 20, FAR.deep);
  for (let i = sb0; i < sb0 + iw / 7 + 5; i++) pine(R(i * 7 - sb + hash(i, 37) * 4), base - 2, 40 + R(hash(i, 39) * 26), DEEP);
  // the front row, with gaps to see into the dark
  const s = scroll * 0.3, step = 12, i0 = Math.floor(s / step) - 2;
  for (let i = i0; i < i0 + iw / step + 5; i++) {
    if (hash(i, 31) < 0.3) continue;
    const x = R(i * step - s + hash(i, 33) * 5), h = 34 + R(hash(i, 35) * 26);
    pine(x, base, h, FAR);
  }
  lurkers(s, base, t);
  // the meadow between the woods and the path
  px(0, base, iw, gy - base, "#5aa954");
  px(0, base, iw, 1, "#4a944a");
  const ms = scroll * 0.55, m0 = Math.floor(ms / 9) - 1;
  for (let i = m0; i < m0 + iw / 9 + 2; i++) for (let r = 0; r < 3; r++) {
    if (hash(i, 600 + r) < 0.5) continue;
    const x = R(i * 9 - ms + hash(i, 610 + r) * 8), y = base + 3 + r * 7 + R(hash(i, 620 + r) * 3);
    px(x, y, 1, 2, "#4a944a"); px(x + 2, y + 1, 1, 1, "#4a944a");
    if (hash(i, 630 + r) < 0.15) px(x + 1, y - 1, 1, 1, FLOWERS[(hash(i, 640 + r) * 4) | 0]);
  }
}
function pine(x, base, h, C) {
  const w0 = Math.max(5, R(h * 0.36));
  px(x - 1, base - 4, 2, 5, C.deeper);
  for (let y = 0; y < h; y++) {
    const k = y / h, tier = (y % 7) / 7, w = Math.max(1, R(w0 * k * (0.75 + tier * 0.45)));
    const yy = base - 3 - h + y;
    px(x - w, yy, w * 2 + 1, 1, C.mid);
    px(x - w, yy, Math.max(1, R(w * 0.7)), 1, C.lit);
    px(x + R(w * 0.35), yy, Math.max(1, w - R(w * 0.35) + 1), 1, C.dk);
  }
}
/** Hell-beasts as dark shapes in the gaps, eyes and teeth catching the light. */
function lurkers(s, base, t) {
  const step = 140, i0 = Math.floor(s / step) - 1;
  for (let i = i0; i < i0 + iw / step + 3; i++) {
    if (hash(i, 61) < 0.2) continue;
    const kind = LURKERS[(hash(i, 63) * LURKERS.length) | 0];
    const fr = Math.floor((t + hash(i, 65) * 2000) / 700) % 2;
    const img = silhouette(kind, hash(i, 67) < 0.5 ? 0 : 1, fr);
    if (!img) continue;
    const x = R(i * step - s + 30 + hash(i, 69) * 60 - img.width / 2), y = base + 6 - img.height + R(hash(i, 71) * 3);
    g.drawImage(img, x, y);
  }
}
function silhouette(kind, dir, fr) {
  const key = kind + dir + fr;
  if (shades.has(key)) return shades.get(key);
  let out = null;
  try {
    if (MobArt.has(kind)) {
      const src = MobArt.rig(kind, "").frame(dir, fr), N = src.width;
      const d = src.getContext("2d").getImageData(0, 0, N, N).data;
      const c = document.createElement("canvas"); c.width = N; c.height = N;
      const o = c.getContext("2d"), im = o.createImageData(N, N), q = im.data;
      let top = N;
      for (let i = 0; i < N * N; i++) if (d[i * 4 + 3]) { top = Math.min(top, (i / N) | 0); }
      let bot = 0;
      for (let i = 0; i < N * N; i++) {
        if (!d[i * 4 + 3]) continue;
        bot = Math.max(bot, (i / N) | 0);
        q[i * 4] = 14; q[i * 4 + 1] = 18; q[i * 4 + 2] = 26; q[i * 4 + 3] = 255;
      }
      // two red eyes, set in the front of the head: the foremost point of the top part of the body
      const right = dir & 1, lim = top + Math.max(3, Math.round((bot - top) * 0.45));
      let fx = right ? -1 : N;
      for (let y = top; y <= lim; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] && (right ? x > fx : x < fx)) fx = x;
      const ex = right ? fx - 2 : fx + 2;
      let ey = -1;
      for (let y = top; y < bot; y++) if (d[(y * N + ex) * 4 + 3]) { ey = y + 2; break; }
      const eye = (x, y, c) => { if (x < 0 || x >= N || y < 0 || y >= N) return; const i = y * N + x; if (!d[i * 4 + 3]) return; q[i * 4] = c[0]; q[i * 4 + 1] = c[1]; q[i * 4 + 2] = c[2]; };
      if (ey > 0) { eye(ex, ey, [255, 70, 56]); eye(ex + (right ? -3 : 3), ey, [255, 70, 56]); }
      o.putImageData(im, 0, 0);
      out = c;
    }
  } catch { out = null; }
  shades.set(key, out);
  return out;
}
/** The near trees: round crowns on short trunks, lit from the left. */
function midTrees(scroll) {
  const gy = groundY(), s = scroll * 0.55, step = 64, i0 = Math.floor(s / step) - 2;
  for (let i = i0; i < i0 + iw / step + 4; i++) {
    if (hash(i, 81) < 0.3) continue;
    const x = R(i * step - s + hash(i, 83) * 26), h = 48 + R(hash(i, 85) * 34), r = 14 + R(hash(i, 87) * 9);
    roundTree(x, gy - 14, h, r, i);
  }
}
function roundTree(x, base, h, r, seed) {
  // trunk
  px(x - 2, base - h + r, 5, h - r + 1, TREE.bark);
  px(x - 2, base - h + r, 1, h - r + 1, TREE.barkL);
  px(x + 2, base - h + r, 1, h - r + 1, TREE.barkD);
  px(x - 4, base, 9, 1, TREE.barkD); px(x - 3, base - 1, 2, 1, TREE.bark); px(x + 2, base - 1, 2, 1, TREE.bark);
  // crown: three overlapping blobs, outline, light upper-left, shade lower-right
  const cy = base - h;
  const blobs = [[0, 0, r], [-R(r * 0.7), R(r * 0.35), R(r * 0.72)], [R(r * 0.72), R(r * 0.3), R(r * 0.7)]];
  for (const [dx, dy, rr] of blobs) disc(x + dx, cy + dy, rr + 1, TREE.ink);
  for (const [dx, dy, rr] of blobs) disc(x + dx, cy + dy, rr, TREE.dk);
  for (const [dx, dy, rr] of blobs) disc(x + dx - 1, cy + dy - 1, rr - 1, TREE.mid);
  for (const [dx, dy, rr] of blobs) disc(x + dx - R(rr * 0.3), cy + dy - R(rr * 0.35), R(rr * 0.55), TREE.lit);
  disc(x - R(r * 0.35), cy - R(r * 0.45), Math.max(2, R(r * 0.22)), TREE.hi);
  // a few leaf clusters and, on some trees, fruit
  for (let k = 0; k < 6; k++) {
    const a = hash(seed, 90 + k) * 6.28, d = r * (0.3 + hash(seed, 100 + k) * 0.5);
    px(x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 2, 1, hash(seed, 110 + k) < 0.5 ? TREE.hi : TREE.dk);
  }
  if (hash(seed, 120) < 0.4) for (let k = 0; k < 4; k++) { const a = hash(seed, 130 + k) * 6.28, d = r * 0.6; px(x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7 + 2, 2, 2, "#e8504a"); }
}
function ground(scroll, t) {
  const gy = groundY(), s = scroll;
  // grass from the tree line down
  px(0, gy - 6, iw, ih - gy + 6, GRASS.mid);
  px(0, gy - 6, iw, 1, GRASS.dk);
  px(0, gy - 5, iw, 1, GRASS.lit);
  // grass blades in clusters, scrolling with the ground
  const step = 7, i0 = Math.floor(s / step) - 1;
  for (let i = i0; i < i0 + iw / step + 2; i++) {
    for (let r = 0; r < 4; r++) {
      if (hash(i, 200 + r) < 0.45) continue;
      const x = R(i * step - s + hash(i, 210 + r) * 6), y = r < 1 ? gy - 4 + R(hash(i, 220) * 2) : gy + 10 + r * R((ih - gy) / 5) + R(hash(i, 230 + r) * 4);
      if (y > ih) continue;
      px(x, y, 1, 2, GRASS.dk); px(x + 2, y + 1, 1, 1, GRASS.dk);
      if (hash(i, 240 + r) < 0.12) { px(x + 1, y - 1, 1, 1, FLOWERS[(hash(i, 250 + r) * 4) | 0]); px(x + 1, y, 1, 1, GRASS.deep); }
    }
  }
  // the dirt path
  const py = gy - 1, ph = 11;
  px(0, py, iw, ph, PATH.mid);
  px(0, py, iw, 1, PATH.edge); px(0, py + 1, iw, 1, PATH.dk);
  px(0, py + ph - 1, iw, 1, PATH.edge); px(0, py + ph - 2, iw, 1, PATH.lit);
  for (let i = i0; i < i0 + iw / step + 2; i++) {
    const h = hash(i, 300);
    if (h < 0.35) { const x = R(i * step - s + hash(i, 301) * 5), y = py + 3 + R(hash(i, 302) * 4); px(x, y, 2, 1, h < 0.15 ? PATH.peb : PATH.dk); }
  }
  // rocks and mushrooms on the near verge
  const st = 41, j0 = Math.floor(s / st) - 1;
  for (let i = j0; i < j0 + iw / st + 2; i++) {
    const h = hash(i, 400);
    const x = R(i * st - s + hash(i, 401) * 20), y = gy + 13 + R(hash(i, 402) * 6);
    if (h < 0.25) rock(x, y, 2 + R(hash(i, 403) * 2));
    else if (h < 0.4) mushroom(x, y);
    else if (h < 0.55) flowerBed(x, y, i);
  }
}
function rock(x, y, r) {
  px(x - r - 1, y + 1, r * 2 + 3, 1, GRASS.deep);
  px(x - r, y - r, r * 2 + 1, r + 1, "#8a8aa0");
  px(x - r, y - r, r * 2, 1, "#c8c8d8");
  px(x - r, y - r + 1, 1, r - 1, "#b0b0c4");
  px(x + r, y - r + 1, 1, r, "#5c5a74");
  px(x - r, y, r * 2 + 1, 1, "#5c5a74");
}
function mushroom(x, y) {
  px(x - 1, y - 2, 2, 3, "#f4ecd8"); px(x, y - 2, 1, 3, "#d4c8b0");
  px(x - 3, y - 4, 6, 2, "#e0504a"); px(x - 2, y - 5, 4, 1, "#e0504a");
  px(x - 2, y - 4, 1, 1, "#ffffff"); px(x + 1, y - 5, 1, 1, "#ffffff");
  px(x - 3, y - 3, 6, 1, "#a8343e");
}
function flowerBed(x, y, i) {
  for (let k = 0; k < 3; k++) {
    const fx = x + k * 3 - 3, fy = y - (k % 2), c = FLOWERS[(hash(i, 410 + k) * 4) | 0];
    px(fx, fy, 1, 2, GRASS.ink); px(fx - 1, fy - 1, 3, 1, c); px(fx, fy - 2, 1, 1, c); px(fx, fy - 1, 1, 1, "#ffe060");
  }
}
/** Tufts and ferns along the bottom edge, nearer than the path and moving faster. */
function foreground(scroll) {
  const s = scroll * 1.35, step = 16, i0 = Math.floor(s / step) - 1;
  for (let i = i0; i < i0 + iw / step + 2; i++) {
    if (hash(i, 500) < 0.4) continue;
    const x = R(i * step - s + hash(i, 501) * 10), y = ih + 1, h = 5 + R(hash(i, 502) * 6);
    for (let k = -2; k <= 2; k++) {
      const hh = h - Math.abs(k) * 2;
      px(x + k * 2, y - hh, 1, hh, k < 0 ? GRASS.lit : GRASS.deep);
      px(x + k * 2 + (k < 0 ? -1 : 1), y - hh, 1, 1, k < 0 ? GRASS.hi : GRASS.ink);
    }
  }
}
function particles(dt, t) {
  for (let i = 0; i < leaves.length; i++) {
    const l = leaves[i];
    l.y += l.vy * dt; l.x += (Math.sin(t / 700 + l.ph) * 8 - 6) * dt;
    if (l.y > ih + 4 || l.x < -10) leaves[i] = newLeaf(i + ((t / 100) | 0), false);
    const flip = Math.sin(t / 260 + l.ph) > 0;
    px(l.x, l.y, flip ? 2 : 1, flip ? 1 : 2, l.c);
    if (l.big) px(l.x + (flip ? 2 : 0), l.y + (flip ? 0 : 2), 1, 1, l.c);
  }
  const gy = groundY();
  for (const f of flies) {
    const x = (f.x + Math.sin(t / 1000 * f.sp + f.ph) * 14 + iw) % iw, y = gy - 18 - f.k * 36 + Math.sin(t / 1300 * f.sp * 1.7 + f.ph * 2) * 6;
    const on = Math.sin(t / 500 * (0.8 + f.k) + f.ph * 3);
    if (on > 0.3) { px(x, y, 1, 1, "#fff8a0"); if (on > 0.8) { px(x - 1, y, 1, 1, "#d8f070"); px(x + 1, y, 1, 1, "#d8f070"); px(x, y - 1, 1, 1, "#d8f070"); px(x, y + 1, 1, 1, "#d8f070"); } }
  }
}
function walkers(t, dt) {
  const gy = groundY();
  for (const c of cast) {
    c.next -= dt * 1000;
    // now and then someone swings at nothing in particular, or hops
    if (c.next <= 0) {
      if (hash((t / 997) | 0, c.ph) < 0.7) { c.atkT = t; c.atkN = (c.atkN + 1) % 3; c.next = c.atkN ? 520 + hash(c.ph, 1) * 200 : 3500 + hash((t | 0) % 977, c.ph) * 6000; }
      else { c.hop = t; c.next = 3000 + hash((t | 0) % 911, c.ph) * 5000; }
    }
    const hk = (t - c.hop) / 420, hop = hk > 0 && hk < 1 ? R(Math.sin(hk * Math.PI) * 7) : 0;
    S3.drawFigure(g, c.s, { dir: 2, moving: true, atkT: c.atkT, atkN: c.atkN, aim: t - c.atkT < 1400 ? [40, 2] : null }, t + c.ph, dt, c.x, gy + 5 - hop);
  }
}

/** Draw one frame. */
export function render(t, dt) {
  dt = Math.max(0, Math.min(0.05, dt || 0));
  if (!cv || !built) return;
  const scroll = t / 1000 * 16;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  sky(t);
  hills(scroll);
  farWoods(scroll, t);
  midTrees(scroll);
  ground(scroll, t);
  walkers(t, dt);
  particles(dt, t);
  foreground(scroll);
}

// ───────────────────────────── the logo ─────────────────────────────

/** The three syllables, 14 × 16, two-pixel strokes. */
const GLYPH = {
  "테": [
    "........##..##", "........##..##", "######..##..##", "######..##..##", "##......##..##", "##......##..##", "##......##..##", "#####.####..##",
    "#####.####..##", "##......##..##", "##......##..##", "##......##..##", "######..##..##", "######..##..##", "........##..##", "........##..##",
  ],
  "일": [
    "..######....##", ".########...##", "###....###..##", "##......##..##", "###....###..##", ".########...##", "..######....##", "..............",
    ".#############", ".#############", "............##", ".#############", ".#############", ".##...........", ".#############", ".#############",
  ],
  "즈": [
    "..##########..", "..##########..", "......##......", ".....####.....", "....##..##....", "....##..##....", "...##....##...", "..##......##..",
    "..##......##..", ".##........##.", "##..........##", "..............", "..............", "##############", "##############", "..............",
  ],
};
/** A curled tail growing out of the last stroke, with a pale tip. t = tip. */
const TAIL = [
  "...ttt..", "..ttttt.", "..tt.##.", "......##", "......##", "......##", ".....##.", "....##..", "##.##...", "####....", "###.....",
];
const LATIN = {
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

/**
 * The logo as a canvas: 테일즈테일즈 in chunky gold letters with a dark outline, a
 * plum block shadow and a fox's tail curling off the end; TALES TALES on a brass
 * ribbon beneath. `S` is screen pixels per logo pixel.
 */
export function logo(S = 4) {
  const word = "테일즈테일즈", gw = 14, gh = 16, gap = 3;
  const W = word.length * gw + (word.length - 1) * gap + 4 + 8 + 4, H = gh + 30;
  const m = Array.from({ length: H }, () => Array(W).fill(0));   // 1 letter, 2 tail fur, 3 tail tip
  const ox = 3, oy = 3;
  [...word].forEach((ch, i) => {
    const rows = GLYPH[ch], x0 = ox + i * (gw + gap) + (i >= 3 ? 1 : 0);
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === "#") m[oy + y][x0 + x] = 1; }));
  });
  // the tail, rooted on the last 즈's bottom stroke
  const tx = ox + 5 * (gw + gap) + 1 + gw - 2, ty = oy + gh - 1 - TAIL.length + 1;
  TAIL.forEach((r, y) => [...r].forEach((c, x) => { if (c === "#") m[ty + y][tx + x] = m[ty + y][tx + x] || 2; else if (c === "t") m[ty + y][tx + x] = 3; }));
  const cv2 = document.createElement("canvas");
  cv2.width = W * S; cv2.height = H * S;
  const o = cv2.getContext("2d");
  const at = (x, y) => (y >= 0 && y < H && x >= 0 && x < W ? m[y][x] : 0);
  const dot = (x, y, c) => { o.fillStyle = c; o.fillRect(x * S, y * S, S, S); };
  // block shadow: the letters pushed down two pixels, in plum, then the outline round everything
  const solid = (x, y) => at(x, y) || at(x, y - 1) || at(x, y - 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid(x, y)) { if (!at(x, y)) dot(x, y, at(x, y - 1) ? "#8a4060" : "#5a2448"); continue; }
    let near = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (solid(x + dx, y + dy)) near = true;
    if (near) dot(x, y, "#24122a");
  }
  // the faces: cream at the top, gold through the middle, amber at the foot; lit top edges
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = at(x, y);
    if (!v) continue;
    const k = (y - oy) / gh;
    let c = v === 3 ? "#fff8ec" : v === 2 ? (k < 0.55 ? "#ffb85a" : "#f0903a") : k < 0.28 ? "#fff2c4" : k < 0.62 ? "#ffd462" : "#f4a43c";
    if (v === 1 && !at(x, y - 1)) c = "#ffffff";
    else if (v === 1 && !at(x + 1, y) && k > 0.3) c = k < 0.62 ? "#eab04a" : "#d8862e";
    if (v === 2 && !at(x, y - 1)) c = "#ffd08a";
    dot(x, y, c);
  }
  // sparkles
  for (const [x, y] of [[ox + 1, oy - 2], [W - 6, oy + 1], [ox + 3 * (gw + gap) - 2, oy + gh + 1]]) {
    if (x < 0 || y < 0 || y >= H) continue;
    dot(x, y, "#ffffff"); dot(x - 1, y, "#fff2c4"); dot(x + 1, y, "#fff2c4"); dot(x, y - 1, "#fff2c4"); dot(x, y + 1, "#fff2c4");
  }
  // the ribbon with TALES TALES
  const text = "TALES TALES", lw = 6, rw = text.length * lw + 7, rx = Math.round((W - rw) / 2), ry = oy + gh + 6, rh = 11;
  const band = (x, y, w, h, c) => { o.fillStyle = c; o.fillRect(x * S, y * S, w * S, h * S); };
  // folded tails of the ribbon
  for (const sgn of [-1, 1]) {
    const ex = sgn < 0 ? rx - 7 : rx + rw, ey = ry + 3;
    band(ex, ey - 1, 7, rh, "#24122a");
    band(ex + (sgn < 0 ? 1 : 0), ey, 6, rh - 2, "#9a5a2a");
    band(ex + (sgn < 0 ? 0 : 5), ey + Math.floor((rh - 2) / 2), 2, 1, "#24122a");
    band(sgn < 0 ? ex + 5 : ex, ey, 2, rh - 2, "#5a3014");
  }
  band(rx - 1, ry - 1, rw + 2, rh + 2, "#24122a");
  band(rx, ry, rw, rh, "#cf9f55");
  band(rx, ry, rw, 1, "#f4dfa4"); band(rx, ry + 1, 1, rh - 1, "#f4dfa4");
  band(rx, ry + rh - 1, rw, 1, "#7c5326"); band(rx + rw - 1, ry, 1, rh, "#7c5326");
  [...text].forEach((ch, i) => {
    const rows = LATIN[ch] || LATIN[" "], x0 = rx + 4 + i * lw, y0 = ry + 2;
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === "#") { dot(x0 + x + 1, y0 + y + 1, "#f4dfa4"); dot(x0 + x, y0 + y, "#3a1c10"); } }));
  });
  return cv2;
}
