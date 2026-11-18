/**
 * alba_stage.js — the TOP 480x120 stage of the 알바 window: a scene per job, drawn in code.
 *   back(g,k,t,a)  static layer (cached offscreen per job, one drawImage) + the moving background bits
 *   pose(k,a)      where the hero and the tool are this frame (a per-job motion loop)
 *   front(g,k,t,a,p) foreground bits drawn over the hero (counter, audience, petals, the thing in the tool's reach)
 * a = { ph: motion phase (cycles, speeds up on good hits), act: 0..1 excitement, kind, since (ms since the last react),
 *       fever, prog: 0..1 score/par, run }.  Pixel rules: crisp rects, dark outline, ONE shadow tone per prop, no gradients.
 */
const W = 480, H = 120, OUT = "#2a2236";
const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const B = (g, x, y, w, h, c, sh) => { R(g, OUT, x - 1, y - 1, w + 2, h + 2); R(g, c, x, y, w, h); if (sh) { const s = Math.max(2, h >> 3); R(g, sh, x, y + h - s, w, s); } };
const disc = (g, c, cx, cy, r) => { g.fillStyle = c; for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.5)); g.fillRect(Math.round(cx) - w, Math.round(cy) + dy, 2 * w + 1, 1); } };
const bands = (g, cols, y0, y1) => { const h = (y1 - y0) / cols.length; cols.forEach((c, i) => R(g, c, 0, y0 + Math.floor(i * h), W, Math.ceil(h) + 1)); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const L = (a, b, x) => a + (b - a) * x;
const frac = (x) => x - Math.floor(x);
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const line = (g, c, x0, y0, x1, y1, w = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) R(g, c, L(x0, x1, n ? i / n : 0), L(y0, y1, n ? i / n : 0), w, w); };
const PAL = ["#ff7a8a", "#ffc84a", "#7ad0ff", "#9ae06a", "#c89aff", "#ff9a5a"];

/** A little animal (customer / audience): x centre, y feet. */
function critter(g, x, y, col, t, i, cheer) {
  const bob = Math.round(Math.sin(t / 240 + i * 2) * 1.2), tw = Math.round(Math.sin(t / 200 + i) * 1.5);
  B(g, x - 6, y - 14 + bob, 12, 14, col);
  B(g, x - 7, y - 25 + bob, 14, 11, col);
  R(g, col, x - 7, y - 29 + bob, 4, 5); R(g, col, x + 3, y - 29 + bob, 4, 5); R(g, OUT, x - 7, y - 30 + bob, 4, 1); R(g, OUT, x + 3, y - 30 + bob, 4, 1);
  R(g, OUT, x - 4, y - 20 + bob, 2, 2); R(g, OUT, x + 2, y - 20 + bob, 2, 2); R(g, "#ff9aa8", x - 1, y - 17 + bob, 2, 1);
  R(g, col, x + 7, y - 8 + bob + tw, 5, 3); R(g, OUT, x + 12, y - 8 + bob + tw, 1, 3);
  if (cheer) { const u = Math.round(Math.abs(Math.sin(t / 150 + i)) * 4); R(g, col, x - 10, y - 20 - u + bob, 3, 7); R(g, col, x + 8, y - 20 - u + bob, 3, 7); }
}
const cust = (i) => ["#f0a868", "#e8e0d0", "#a8c8e8", "#e8a8c8", "#b8d890", "#d8b8f0"][((i % 6) + 6) % 6];
function floorTiles(g, y, c1, c2, step = 24) { R(g, c1, 0, y, W, H - y); for (let x = 0; x < W; x += step) R(g, c2, x, y, 1, H - y); for (let yy = y + 14; yy < H; yy += 14) R(g, c2, 0, yy, W, 1); }

// ── scenes ──────────────────────────────────────────────────────────────────────────────────────
const S = {};

S.pipe = {
  st(g) {
    R(g, "#9bbcd6", 0, 0, W, 78);
    for (let y = 0; y < 78; y += 10) { R(g, "#86a8c4", 0, y + 9, W, 1); for (let x = (y / 10 % 2) * 12; x < W; x += 24) R(g, "#86a8c4", x, y, 1, 10); }
    floorTiles(g, 78, "#a8a8b8", "#9494a6", 30); R(g, "#5a6684", 0, 78, W, 2);
    B(g, 0, 13, W, 11, "#e29650", "#b6743a"); R(g, "#f8c88a", 0, 14, W, 2);
    for (const x of [58, 198, 330, 446]) { B(g, x, 10, 7, 17, "#a8a8b8", "#8a8a9c"); }
    B(g, 0, 40, W, 6, "#5aa0e0", "#3a80c0"); R(g, "#9cd0f8", 0, 41, W, 1);
    for (const x of [98, 262, 404]) B(g, x, 38, 5, 10, "#a8a8b8", "#8a8a9c");
    B(g, 26, 24, 8, 54, "#7ad09a", "#56ac78"); B(g, 438, 46, 8, 32, "#e29650", "#b6743a");
    B(g, 346, 34, 56, 44, "#c0c8d8", "#9aa2ba"); for (let i = 0; i < 4; i++) { R(g, "#7a82a0", 351 + i * 14, 38, 2, 2); R(g, "#7a82a0", 351 + i * 14, 72, 2, 2); }
    B(g, 360, 54, 28, 18, "#5a5e72"); R(g, "#ff9a3a", 363, 58, 22, 10);
    for (const [x, y] of [[84, 62], [380, 42]]) { disc(g, OUT, x, y, 9); disc(g, "#fffbe8", x, y, 7); for (let i = 0; i < 7; i++) { const an = Math.PI * (1.1 + i * 0.13); R(g, "#7a6a5a", x + Math.cos(an) * 6, y + Math.sin(an) * 6, 1, 1); } }
    for (const [x, y] of [[30, 60], [442, 58]]) { disc(g, OUT, x, y, 7); disc(g, "#ff5a4a", x, y, 5); R(g, "#ffd0c8", x - 4, y, 9, 1); R(g, "#ffd0c8", x, y - 4, 1, 9); }
    R(g, "#8cb4e0", 196, 79, 14, 2); R(g, "#8cb4e0", 322, 79, 16, 2);
  },
  bk(g, t, a) {
    for (const [x, y, id] of [[84, 62, 0], [380, 42, 1]]) { const an = Math.PI * (1.15 + 0.7 * (0.5 + 0.5 * Math.sin(t / 380 + id * 2 + a.act * 3))); line(g, "#d03a3a", x, y + 1, x + Math.cos(an) * 5, y + 1 + Math.sin(an) * 5); }
    for (const [x, o] of [[201, 0], [333, 0.45]]) { const f = frac(t / (1500 / (1 + a.act)) + o); if (f < 0.85) { const y = 27 + f * f * 50; R(g, "#4a9ae8", x, y, 2, 3); R(g, "#cfe8ff", x, y, 1, 1); } else { const s = (f - 0.85) * 40; R(g, "#8cc4f4", x - s, 77, 2 + s * 2, 1); } }
    for (let i = 0; i < 3; i++) { const f = frac(t / 1700 + i / 3); disc(g, `rgba(255,255,255,${(0.7 * (1 - f)).toFixed(2)})`, 442 + Math.sin(f * 6 + i) * 4, 44 - f * 26, 3 + f * 3); }
  },
};

S.fly = {
  st(g) {
    bands(g, ["#a8dcf4", "#bce6f8", "#d0f0fc"], 0, 16);
    R(g, "#dcc8a6", 0, 16, W, 62); R(g, "#c4ae8a", 0, 16, W, 3);
    for (let r = 0; r < 2; r++) for (let x = 12; x < W; x += 56) { B(g, x, 24 + r * 26, 24, 18, "#8ccaf0", "#6aa8d4"); R(g, "#fff", x + 11, 24 + r * 26, 2, 18); R(g, "#fff", x, 32 + r * 26, 24, 2); }
    R(g, "#b0a090", 0, 78, W, 42); R(g, "#9a8a7a", 0, 78, W, 2); for (const x of [40, 170, 300, 410]) { R(g, "#9a8a7a", x, 92, 24, 1); R(g, "#9a8a7a", x + 12, 92, 1, 8); }
    for (const [x, c, d] of [[8, "#5ac07a", "#3a9a58"], [52, "#5a9ae0", "#3a78bc"], [96, "#e8c84a", "#bc9c2a"], [378, "#5ac07a", "#3a9a58"], [422, "#e0705a", "#b4503a"]]) {
      B(g, x, 46, 34, 32, c, d); B(g, x - 2, 41, 38, 6, d, null); R(g, "#ffffff", x + 6, 56, 22, 3); R(g, OUT, x + 4, 78, 5, 3); R(g, OUT, x + 25, 78, 5, 3);
    }
    for (const [x, y] of [[136, 70], [262, 70], [320, 72], [468, 70]]) { disc(g, OUT, x, y, 9); disc(g, "#4a4a5a", x, y - 0, 8); R(g, "#6a6a7e", x - 4, y - 4, 3, 2); R(g, "#2a2a36", x - 1, y - 9, 3, 3); }
    R(g, "#f0d84a", 280, 76, 8, 3); R(g, "#e8e0c8", 150, 78, 6, 4); R(g, "#7a9a6a", 290, 74, 5, 4);
  },
  bk(g, t, a) {
    const sp = 1 + a.act * 1.4;
    for (const x of [25, 69, 395]) for (let i = 0; i < 2; i++) { const y = 24 - ((t / 40 + i * 12) % 24); R(g, "rgba(120,190,70,.55)", x + Math.sin(t / 220 + i * 3 + x) * 4, 38 + y * 0.3, 2, 3); }
    for (let i = 0; i < 12; i++) {
      const cx = [25, 69, 113, 130, 250, 290, 330, 395, 440, 460, 20, 300][i], cy = 40 + (i % 3) * 8;
      const x = cx + 26 * Math.sin(t / 310 * sp + i * 1.7), y = cy + 12 * Math.sin(t / 230 * sp * 1.3 + i), w = Math.floor(t / 55 + i) % 2;
      R(g, "#2a2a2a", x, y, 3, 2); R(g, "#ffffff", x - 1, y - 1 + w, 2, 1); R(g, "#ffffff", x + 2, y - 1 + w, 2, 1);
    }
  },
};

S.store = {
  st(g) {
    R(g, "#f8ecce", 0, 0, W, 78); R(g, "#fffbe8", 0, 0, W, 5);
    const r = rng(7);
    for (const y of [20, 38, 56]) {
      R(g, "#b07a4a", 0, y + 14, W, 3); R(g, "#80542c", 0, y + 17, W, 2);
      for (let x = 2; x < W;) { const w = 8 + Math.floor(r() * 6), h = 8 + Math.floor(r() * 5); B(g, x, y + 14 - h, w, h, PAL[Math.floor(r() * 6)], null); R(g, "rgba(255,255,255,.5)", x, y + 14 - h, w, 2); x += w + 2; }
    }
    for (let x = 0; x < W; x += 24) R(g, "#ff8a6a", x, 6, 12, 8); R(g, "#e86a4a", 0, 14, W, 2);
    floorTiles(g, 78, "#ece0c0", "#d8ccaa", 24); R(g, "#d8ccaa", 0, 78, W, 2);
  },
  bk(g, t, a) {
    const cyc = a.ph / 2, f = frac(cyc), id = Math.floor(cyc), e = sm(0.62, 1, f);
    for (let i = 0; i < 5; i++) {
      const x = 290 + i * 42 - e * 42, al = i === 0 ? 1 - e : i === 4 ? e : 1;
      if (al < 0.05) continue;
      g.globalAlpha = al; critter(g, x, 84 - (i === 0 ? e * 6 : 0), cust(id + i), t, i + id, i === 0 && f > 0.4 && f < 0.6); g.globalAlpha = 1;
    }
  },
  fr(g, t, a, p) {
    B(g, 252, 84, 228, 36, "#c08850", "#94622e"); R(g, "#f0d098", 248, 80, 236, 5); R(g, OUT, 248, 79, 236, 1);
    R(g, "#e8b878", 256, 90, 220, 1);
    B(g, 306, 62, 30, 17, "#8a96a8", "#68748a"); R(g, "#7aefa0", 310, 65, 18, 6); R(g, "#cfd6e0", 330, 66, 4, 3);
    for (const [x, c] of [[352, "#ff7a8a"], [366, "#ffc84a"], [380, "#7ad0ff"]]) B(g, x, 70, 10, 9, c, null);
    B(g, 410, 66, 16, 13, "#e8f4ff", "#bcd4ec"); R(g, "#ff9a5a", 413, 63, 10, 3);
    if (p.beam) { R(g, "rgba(255,70,70,.9)", 252, 72, 22, 2); R(g, "#ffffff", 252, 72, 3, 2); }
  },
};

S.parcel = {
  st(g) {
    R(g, "#e6cc98", 0, 0, W, 78); for (let x = 0; x < W; x += 16) R(g, "#d0b480", x, 0, 1, 78); R(g, "#c8aa74", 0, 38, W, 2);
    B(g, 36, 9, 44, 24, "#a8e0f8", null); R(g, "#fff", 57, 9, 2, 24); R(g, "#fff", 36, 20, 44, 2); R(g, "rgba(255,255,255,.55)", 40, 11, 6, 10);
    B(g, 360, 9, 44, 24, "#a8e0f8", null); R(g, "#fff", 381, 9, 2, 24); R(g, "#fff", 360, 20, 44, 2);
    R(g, "#a89c88", 0, 78, W, 42); R(g, "#908470", 0, 78, W, 2);
    for (let x = 0; x < W; x += 24) { R(g, "#f0c828", x, 80, 12, 3); R(g, "#3a3640", x + 12, 80, 12, 3); }
    B(g, 8, 44, 34, 34, "#d0a468", "#a67c40"); R(g, "#f0e0b0", 22, 44, 6, 34); B(g, 12, 22, 26, 22, "#dcb478", "#b48a4c"); R(g, "#f0e0b0", 22, 22, 5, 22);
    B(g, 46, 60, 24, 18, "#c89a5c", "#a07038"); R(g, "#f0e0b0", 56, 60, 4, 18); B(g, 74, 66, 18, 12, "#e8c488", "#c09a58");
    B(g, 262, 74, 218, 12, "#53576a", "#3a3d4c"); for (let x = 270; x < 470; x += 36) { R(g, OUT, x, 86, 4, 12); R(g, "#6a6e82", x + 1, 86, 2, 12); }
    B(g, 160, 2, 3, 8, "#6a6e82", null);
  },
  bk(g, t, a) {
    const sp = 60 * (1 + a.act * 1.2), off = (t / 1000 * sp) % 12;
    for (let x = 262 - off; x < 480; x += 12) if (x >= 262) R(g, "#7a7e92", x, 75, 2, 10);
    for (let i = 0; i < 4; i++) { const x = ((i * 64 - t / 1000 * sp * 0.9) % 256 + 256) % 256 + 250; if (x > 262 && x < 466) { B(g, x, 58, 22, 16, ["#d0a468", "#e8c488", "#c89a5c", "#dcb478"][i], "#a67c40"); R(g, "#f0e0b0", x + 9, 58, 4, 16); } }
    disc(g, "#ffe890", 162, 14, 6); R(g, "rgba(255,240,150,.22)", 152, 20, 20, 8);
  },
};

S.laundry = {
  st(g) {
    R(g, "#d4eef8", 0, 0, W, 78); for (let x = 0; x < W; x += 16) R(g, "#b8dcea", x, 0, 1, 78); for (let y = 8; y < 78; y += 16) R(g, "#b8dcea", 0, y, W, 1);
    R(g, "#6ab4e4", 0, 0, W, 8); for (let x = 0; x < W; x += 16) R(g, "#8ccaf0", x + 4, 2, 8, 3);
    floorTiles(g, 78, "#d8e4ec", "#bccad6", 20); R(g, "#9aaab8", 0, 78, W, 2);
    for (const x of [268, 338, 408]) {
      B(g, x, 20, 58, 58, "#f6f6fa", "#d2d6e4"); R(g, "#6ab4e4", x + 4, 24, 50, 8); R(g, "#fff", x + 8, 26, 8, 3); disc(g, "#ff9a5a", x + 44, 28, 2);
      disc(g, OUT, x + 29, 54, 18); disc(g, "#c8d4e0", x + 29, 54, 16); disc(g, "#5ab0e8", x + 29, 54, 13);
    }
    B(g, 10, 62, 38, 17, "#e8a070", "#c27c48"); disc(g, "#fff", 22, 60, 7); disc(g, "#ff9ac0", 34, 59, 7);
    R(g, "#e8f4fc", 196, 80, 30, 3); R(g, "#fff", 200, 80, 12, 2);
  },
  bk(g, t, a) {
    R(g, "#8a7a6a", 0, 14, 150, 2);
    const sw = (i) => Math.round(Math.sin(t / 420 + i * 1.3) * 2);
    [["#ff8aa8", 14], ["#7ad0ff", 46], ["#ffc84a", 80], ["#9ae06a", 112]].forEach(([c, x], i) => { const o = sw(i); B(g, x + o, 17, 22, 24, c, null); R(g, c, x - 6 + o, 17, 6, 9); R(g, c, x + 22 + o, 17, 6, 9); R(g, OUT, x + o, 15, 22, 2); });
    for (const x of [268, 338, 408]) {
      const cx = x + 29, cy = 54, sp = t / (260 / (1 + a.act * 1.5));
      for (let i = 0; i < 3; i++) { const an = sp + i * 2.1; R(g, [PAL[0], PAL[1], "#fff"][i], cx + Math.cos(an) * 8 - 3, cy + Math.sin(an) * 8 - 2, 7, 5); }
      R(g, "rgba(255,255,255,.5)", cx - 9, cy - 10, 6, 3);
      for (let i = 0; i < 3; i++) { const f = frac(t / 1400 + i / 3 + x / 97); const bx = cx - 16 + i * 14 + Math.sin(f * 9 + i) * 3, by = 18 - f * 16; g.strokeStyle = "#fff"; g.lineWidth = 1; g.strokeRect(Math.round(bx) + 0.5, Math.round(by) + 0.5, 4, 4); }
    }
  },
};

function lantern(g, x, y, lit) { R(g, OUT, x - 1, y - 1, 12, 14); R(g, "#e84a3a", x, y, 10, 12); R(g, "#ff8a6a", x + 1, y + 1, 3, 8); R(g, "#ffd060", x + 2, y - 3, 6, 3); R(g, lit ? "#ffe890" : "#e8b04a", x + 3, y + 4, 4, 4); }
S.taiyaki = {
  st(g) {
    bands(g, ["#f6c090", "#f4aa80", "#ee9474"], 0, 56);
    for (const [x, w, h] of [[0, 70, 46], [76, 56, 34], [250, 60, 40], [316, 50, 52], [380, 100, 38]]) { R(g, "#b8725c", x, 56 - h, w, h + 22); R(g, "#9a5a48", x, 56 - h, w, 3); for (let i = 0; i < 3; i++) R(g, "#ffe49a", x + 8 + i * 17, 56 - h + 12, 7, 9); }
    R(g, "#d4a070", 0, 78, W, 42); for (let x = 0; x < W; x += 20) R(g, "#bc8858", x, 78, 1, 42); for (let y = 90; y < H; y += 12) R(g, "#bc8858", 0, y, W, 1); R(g, "#a07044", 0, 78, W, 2);
    R(g, "#6a4a38", 0, 9, W, 1);
    B(g, 258, 24, 220, 12, "#fff6e4", null); for (let x = 258; x < 478; x += 40) R(g, "#e8503a", x, 24, 20, 12); for (let x = 258; x < 478; x += 20) R(g, OUT, x, 36, 20, 2);
    B(g, 262, 76, 210, 44, "#aa6c3c", "#7e4a26"); R(g, "#d49a62", 262, 76, 210, 3); R(g, "#7e4a26", 262, 90, 210, 1);
    B(g, 292, 66, 76, 10, "#4e525e", "#363a46"); for (let i = 0; i < 5; i++) R(g, "#2a2e38", 298 + i * 14, 68, 8, 5);
    B(g, 380, 66, 40, 10, "#8a96a8", "#6a768a"); R(g, "#ff9a5a", 386, 63, 28, 3);
    B(g, 430, 52, 26, 24, "#6a4a38", "#4a3226"); R(g, "#ffd070", 436, 56, 14, 4);
  },
  bk(g, t, a) {
    for (const x of [30, 90, 150, 210, 270, 330, 390, 450]) lantern(g, x, 10, Math.sin(t / 130 + x) > 0);
    for (let i = 0; i < 4; i++) { const f = frac(t / 1600 + i / 4); disc(g, `rgba(255,255,255,${(0.75 * (1 - f)).toFixed(2)})`, 330 + Math.sin(f * 7 + i) * 8 + (i % 2) * 12, 62 - f * 30, 4 + f * 5); }
    critter(g, 40, 102, cust(1), t, 1, false); critter(g, 80, 108, cust(3), t, 2, false);
    const h = Math.round(Math.abs(Math.sin(t / 300)) * 3); R(g, "#ff6a8a", 54, 60 - h, 3, 3); R(g, "#ff6a8a", 58, 60 - h, 3, 3); R(g, "#ff6a8a", 54, 63 - h, 7, 2); R(g, "#ff6a8a", 56, 65 - h, 3, 1);
  },
  fr(g, t, a, p) {
    // the fish that is being flipped on the spatula
    const x = p.hx + p.tx, y = p.hy + p.ty - 14 - p.lift;
    fish(g, x, y, p.fa);
  },
};
function fish(g, x, y, ang) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(ang);
  R(g, OUT, -9, -5, 19, 11); R(g, "#e8a040", -8, -4, 16, 9); R(g, "#f8c868", -6, -3, 10, 3); R(g, OUT, -12, -4, 4, 9); R(g, "#e8a040", -11, -3, 3, 7); R(g, OUT, 5, -2, 2, 2);
  g.restore();
}

S.pest = {
  st(g) {
    R(g, "#8fa68a", 0, 0, W, 78); for (let y = 0; y < 78; y += 12) { R(g, "#788f74", 0, y + 11, W, 1); for (let x = (y / 12 % 2) * 14; x < W; x += 28) R(g, "#788f74", x, y, 1, 12); }
    for (const x of [140, 330]) { B(g, x, 0, 8, 78, "#a8764a", "#80542c"); } B(g, 0, 0, W, 8, "#a8764a", "#80542c");
    R(g, "#a88a62", 0, 78, W, 42); for (let y = 90; y < H; y += 10) R(g, "#8c7048", 0, y, W, 1); for (let x = 0; x < W; x += 60) R(g, "#8c7048", x + (x % 120 ? 20 : 0), 80, 1, 40); R(g, "#7a5e3c", 0, 78, W, 2);
    B(g, 6, 34, 110, 4, "#a8764a", "#80542c"); B(g, 6, 58, 110, 4, "#a8764a", "#80542c");
    [["#ff7aa8", 12], ["#7aefa0", 28], ["#c89aff", 44], ["#ffd84a", 60], ["#7ad0ff", 76], ["#ff9a5a", 92]].forEach(([c, x], i) => { B(g, x, 22 + (i % 2) * 2, 11, 12 - (i % 2) * 2, c, null); R(g, "#d8b070", x + 3, 19 + (i % 2) * 2, 5, 3); B(g, x, 46 + (i % 3), 11, 12 - (i % 3), PAL[(i + 3) % 6], null); R(g, "#d8b070", x + 3, 43 + (i % 3), 5, 3); });
    B(g, 372, 42, 36, 36, "#d0a062", "#a87a38"); R(g, "#a87a38", 372, 60, 36, 2); line(g, "#a87a38", 374, 44, 406, 76); B(g, 412, 54, 44, 24, "#dcae70", "#b4864a"); line(g, "#b4864a", 414, 56, 454, 76);
    B(g, 336, 52, 28, 26, "#b87c42", "#8a5a2a"); R(g, "#6a4a28", 336, 58, 28, 2); R(g, "#6a4a28", 336, 70, 28, 2);
    for (let i = 0; i < 6; i++) { R(g, "rgba(255,255,255,.7)", 142 + i * 2, 76 - 0 + i, 1, 1); R(g, "rgba(255,255,255,.7)", 466 - i * 2, 12 + i, 1, 1); }
    R(g, "#d4e0cf", 410, 12, 52, 1);
  },
  bk(g, t, a) {
    for (let i = 0; i < 6; i++) R(g, `rgba(255,255,200,${(0.1 + 0.08 * Math.sin(t / 300 + i)).toFixed(2)})`, 12 + i * 16, 22, 11, 12);
    R(g, "#6a6e7a", 215, 0, 1, 12); B(g, 205, 11, 20, 14, "#ffd060", "#d09a30"); R(g, "#fff4b0", 209, 14, 12, 6); R(g, `rgba(255,230,130,${(0.18 + 0.05 * Math.sin(t / 200)).toFixed(2)})`, 191, 10, 48, 34);
    for (let i = 0; i < 4; i++) {
      const sp = 38 * (1 + a.act), x = ((t / 1000 * sp * (i % 2 ? -1 : 1) + i * 120) % 520 + 520) % 520 - 20, y = 96 + (i % 2) * 14, d = i % 2 ? -1 : 1, w = Math.floor(t / 70 + i) % 2;
      B(g, x, y, 8, 4, "#8a5a30", null); R(g, "#c88a50", x + (d > 0 ? 6 : 0), y + 1, 2, 2); R(g, OUT, x + 1, y + 4 + w, 1, 2); R(g, OUT, x + 5, y + 4 - w + 1, 1, 2); R(g, OUT, x + (d > 0 ? 8 : -2), y - 1 + w, 2, 1);
    }
  },
  fr(g, t, a, p) {
    // spray mist along the nozzle
    const ox = p.hx + p.tx + 16, oy = p.hy + p.ty + 2;
    if (!a.run && a.act < 0.01) return;
    for (let i = 0; i < 6; i++) { const f = frac(a.ph * 2 + i / 6); disc(g, `rgba(190,250,90,${(0.6 * (1 - f)).toFixed(2)})`, ox + f * 40, oy + f * 14 + Math.sin(i * 2) * 3, 2 + f * 5); }
  },
};

S.wall = {
  st(g) {
    bands(g, ["#9cd6f6", "#b4e2f8", "#cceafa"], 0, 58);
    R(g, "#7ab060", 0, 52, W, 26); for (let x = 0; x < W; x += 22) R(g, "#68a050", x, 56, 14, 2);
    B(g, 0, 20, 112, 58, "#c8946a", "#9a6a42"); R(g, "#8a3a2a", 0, 10, 112, 10); R(g, "#6a2a1e", 0, 18, 112, 2); B(g, 84, 0, 14, 14, "#8a8e9c", "#6a6e7c");
    B(g, 14, 44, 32, 34, "#3a2a2a"); R(g, "#ff9a3a", 17, 52, 26, 24); R(g, "#ffd060", 22, 62, 16, 14);
    B(g, 62, 58, 30, 10, "#5a5e6a", "#3e4250"); R(g, "#5a5e6a", 70, 68, 14, 10); R(g, "#8a8e9c", 62, 58, 30, 2);
    R(g, "#c8a870", 0, 78, W, 42); R(g, "#b09058", 0, 78, W, 2); for (let x = 0; x < W; x += 36) R(g, "#b09058", x, 92 + (x % 72 ? 8 : 0), 14, 2);
    B(g, 262, 8, 218, 70, "#d4806a", "#a85c48");
    for (let y = 8, r = 0; y < 78; y += 9, r++) { R(g, "#f0d0bc", 262, y + 8, 218, 1); for (let x = 262 + (r % 2) * 10; x < 480; x += 20) R(g, "#f0d0bc", x, y, 1, 9); }
    for (const [x, y, w, h] of [[318, 26, 34, 34], [412, 10, 22, 24]]) { R(g, "#5a4a52", x, y, w, h); R(g, "#8a7a82", x, y, w, 2); }
    line(g, OUT, 300, 14, 310, 30); line(g, OUT, 310, 30, 304, 44); line(g, OUT, 304, 44, 320, 62); line(g, OUT, 386, 8, 392, 30); line(g, OUT, 392, 30, 384, 52); line(g, OUT, 384, 52, 396, 76); line(g, OUT, 436, 34, 452, 56);
    for (const [x, y, c] of [[262, 76, "#a85c48"], [284, 70, "#d4806a"], [318, 72, "#a85c48"], [342, 68, "#d4806a"], [372, 74, "#a85c48"], [398, 70, "#8a8e9c"]]) { R(g, OUT, x - 1, y - 1, 14, 10); R(g, c, x, y, 12, 8); }
  },
  bk(g, t, a) {
    const f = frac(a.ph), chimney = 3;
    for (let i = 0; i < chimney; i++) { const q = frac(t / 2200 + i / 3); disc(g, `rgba(220,220,230,${(0.7 * (1 - q)).toFixed(2)})`, 92 + Math.sin(q * 6) * 4, -2 - q * 0 + 2 - q * 6 + 8, 4 + q * 5); }
    R(g, `rgba(255,200,80,${(0.14 + 0.06 * Math.sin(t / 90)).toFixed(2)})`, 4, 40, 56, 40);
    const s = (f - 0.7) * 1000 / 2.0;   // ms-ish since the strike (0..)
    if (f > 0.7 && f < 1) { const q = (f - 0.7) / 0.3; for (let i = 0; i < 5; i++) { const x = 266 + q * (14 + i * 7), y = 50 - Math.sin(q * 3.1) * (10 + i * 4) + q * q * 30 * (i % 2 + 0.5); R(g, OUT, x - 1, y - 1, 6, 5); R(g, i % 2 ? "#d4806a" : "#a85c48", x, y, 4, 3); } disc(g, `rgba(240,230,220,${(0.6 * (1 - q)).toFixed(2)})`, 270, 56, 5 + q * 12); }
  },
};

S.cross = {
  st(g) {
    bands(g, ["#8cd0f4", "#a4dcf8", "#bce6fa"], 0, 56);
    B(g, 22, 14, 96, 44, "#d9a468", "#b07c44"); R(g, "#c0503a", 14, 8, 112, 8); R(g, "#d8684e", 20, 2, 100, 7); R(g, OUT, 14, 7, 112, 1);
    for (const x of [32, 56, 94]) B(g, x, 26, 14, 14, "#ffe49a", null); B(g, 70, 36, 14, 22, "#7a4a2a", null);
    R(g, OUT, 130, 18, 2, 14); B(g, 124, 30, 28, 12, "#ffd870", "#d9a838"); R(g, "#c0503a", 128, 34, 20, 2);
    R(g, "#dcd4c2", 0, 56, W, 12); R(g, "#bcb4a2", 0, 66, W, 2); R(g, OUT, 0, 55, W, 1);
    R(g, "#8e92a2", 0, 68, W, 52); R(g, "#7d8192", 0, 68, W, 3); R(g, "#7d8192", 0, 112, W, 8);
  },
  bk(g, t, a) {
    const sp = a.ph * 70;
    for (const x of [200, 330, 440]) { const px = (((x - sp * 0.4) % 560) + 560) % 560 - 40; R(g, OUT, px + 8, 40, 4, 16); disc(g, "#5ab050", px + 10, 36, 11); disc(g, "#7ad060", px + 7, 33, 6); }
    for (let i = 0; i < 3; i++) { const cx = ((i * 190 - t / 120) % 560 + 560) % 560 - 40; R(g, "#ffffff", cx, 14 + i * 9, 26, 6); R(g, "#ffffff", cx + 5, 10 + i * 9, 14, 6); }
    const off = sp % 40; for (let x = -off; x < W; x += 40) R(g, "#f4f4ec", x, 92, 22, 3);
    for (let x = -(sp % 56); x < W; x += 56) { R(g, "#f4f4ec", x + 8, 68, 8, 44); R(g, "#f4f4ec", x + 22, 68, 8, 44); }
    const cx = 500 - ((t / 14) % 700); if (cx > -50) cart(g, cx, 84, t, "#7ad0ff");
    const c2 = 560 - (((t + 2200) / 9) % 760); if (c2 > -50 && c2 < 520) cart(g, c2, 74, t * 1.4, "#ff9a5a");
  },
  fr(g, t, a) {
    const c = 560 - (((t + 900) / 6) % 900); if (c > -50 && c < 520) cart(g, c, 117, t * 1.8, "#9ae06a");
  },
};
function cart(g, x, y, t, col) {
  const w = Math.floor(t / 90) % 2;
  B(g, x + 14, y - 14, 30, 12, col, null); B(g, x + 18, y - 24, 12, 10, "#e8c488", "#c09a58"); B(g, x + 32, y - 22, 9, 8, "#c89a5c", "#a07038");
  B(g, x - 14, y - 15, 15, 10, "#b09078", "#8a6c54"); B(g, x - 20, y - 20, 10, 8, "#b09078", null); R(g, "#b09078", x - 20, y - 24, 3, 4); R(g, OUT, x - 18, y - 17, 2, 2);
  R(g, OUT, x - 11, y - 5 + w, 2, 5 - w); R(g, OUT, x - 3, y - 5 + (1 - w), 2, 4 + w); R(g, OUT, x + 1, y - 10, 15, 2);
  for (const wx of [x + 20, x + 38]) { disc(g, OUT, wx, y - 4, 5); disc(g, "#e8e0c8", wx, y - 4, 4); R(g, OUT, wx - 3 + w * 2, y - 4, 7 - w * 4, 1); R(g, OUT, wx, y - 7 + w, 1, 7 - w * 2); }
}

S.lamp = {
  st(g) {
    bands(g, ["#3a3a78", "#4e4488", "#7a5a96", "#b87a92", "#e89a82", "#f6bc84"], 0, 62);
    const r = rng(11); for (let i = 0; i < 26; i++) R(g, "#fff4c8", Math.floor(r() * W), Math.floor(r() * 32), 1, 1);
    disc(g, "#fff4c8", 430, 20, 11); disc(g, "#ead8a0", 427, 22, 3); disc(g, "#ead8a0", 433, 16, 2);
    for (const [x, w, h] of [[0, 54, 36], [96, 70, 28], [236, 52, 34], [300, 64, 30], [384, 60, 38]]) { R(g, "#5a4676", x, 62 - h, w, h + 16); R(g, "#463864", x, 62 - h, w, 3); for (let i = 0; i < 2; i++) R(g, "#ffd070", x + 9 + i * 20, 62 - h + 10, 7, 8); }
    R(g, "#7c7aa0", 0, 78, W, 42); for (let y = 78; y < H; y += 14) R(g, "#6a688c", 0, y, W, 1); for (let y = 78, r2 = 0; y < H; y += 14, r2++) for (let x = (r2 % 2) * 14; x < W; x += 28) R(g, "#6a688c", x, y, 1, 14);
    R(g, "#9a98c0", 0, 78, W, 2);
    for (const x of [38, 118, 330, 414]) { B(g, x - 1, 28, 3, 50, "#4a4260", null); R(g, OUT, x - 4, 76, 9, 3); }
  },
  bk(g, t, a) {
    const n = Math.round(a.prog * 4 + (a.act > 0 ? 0 : 0)), lit = (i) => i < n;
    [38, 118, 330, 414].forEach((x, i) => {
      const on = lit(i), fl = on ? 0.5 + 0.5 * Math.sin(t / 140 + i * 2) : 0;
      B(g, x - 6, 14, 12, 14, on ? "#ffe8a0" : "#8a8098", on ? "#ffd060" : "#6a6078"); R(g, OUT, x - 8, 11, 16, 3); R(g, on ? "#fff8d8" : "#a49aaa", x - 3, 17, 5, 5);
      if (on) { for (let k = 3; k >= 1; k--) disc(g, `rgba(255,214,110,${(0.1 + fl * 0.03).toFixed(2)})`, x, 21, 10 + k * 8); R(g, "rgba(255,214,110,.22)", x - 22, 79, 44, 4); }
    });
    for (const x of [64, 392]) { R(g, "#5a4030", x, 40, 6, 38); for (let i = -9; i <= 9; i++) { const len = 20 + (Math.abs(i * 7) % 14), sw = Math.sin(t / 700 + i * 0.5) * 2; R(g, i % 2 ? "#6ab060" : "#4a9050", x + 3 + i * 3 + sw, 36 + Math.abs(i) * 0.6, 2, len); } disc(g, "#58a455", x + 3, 34, 12); }
    for (let i = 0; i < 7; i++) { const x = (i * 71 + Math.sin(t / 900 + i) * 20 + 40) % W, y = 54 + Math.sin(t / 700 + i * 2) * 14 + (i % 3) * 8, o = Math.sin(t / 200 + i * 3) > -0.2; if (o) { R(g, "#e8ff7a", x, y, 2, 2); R(g, "rgba(232,255,122,.35)", x - 1, y - 1, 4, 4); } }
  },
};

S.rhythm = {
  st(g) {
    R(g, "#c84860", 0, 0, W, 78); for (let x = 0; x < W; x += 12) R(g, "#ac3450", x, 0, 3, 78);
    B(g, 124, 16, 232, 58, "#3e3a8a", null); const r = rng(5); for (let i = 0; i < 30; i++) R(g, "#fff4c8", 128 + Math.floor(r() * 224), 20 + Math.floor(r() * 50), 1, 1);
    disc(g, "#ffe890", 300, 36, 12); disc(g, "#3e3a8a", 306, 33, 10); R(g, "#6a60c0", 124, 62, 232, 12);
    B(g, 0, 0, W, 12, "#8e2c44", null); for (let x = 2; x < W; x += 8) R(g, "#ffd060", x, 12, 5, 3); R(g, "#ffd060", 0, 12, W, 1);
    R(g, "#8a5a2a", 0, 76, W, 4); R(g, "#d9a262", 0, 80, W, 40); for (let y = 90; y < H; y += 11) R(g, "#b87e40", 0, y, W, 1); for (let y = 80, q = 0; y < H; y += 11, q++) for (let x = (q % 2) * 20; x < W; x += 40) R(g, "#b87e40", x, y, 1, 11);
    B(g, 392, 52, 40, 24, "#e8a04a", "#c27c28"); disc(g, "#ffe8a0", 412, 50, 12); disc(g, "#e8c878", 412, 50, 8); B(g, 50, 52, 30, 24, "#7a4a2a", "#5a3218"); disc(g, "#ffd070", 64, 50, 6);
    R(g, OUT, 440, 40, 2, 38); disc(g, "#3a8a4a", 441, 34, 9); disc(g, "#5ab060", 438, 31, 5);
  },
  bk(g, t, a) {
    const cols = ["#ffd84a", "#ff6a8a", "#7ad0ff", "#9ae06a"];
    for (let x = 6, i = 0; x < W; x += 12, i++) { const on = Math.floor(t / 280 + i) % 2; disc(g, on ? cols[i % 4] : "#8a7a60", x, 18, 2); }
    const bt = 1 + a.act;
    g.fillStyle = `rgba(255,240,170,${(0.14 + a.act * 0.06).toFixed(2)})`;
    for (const sx of [110, 370]) { g.beginPath(); g.moveTo(sx - 3, 12); g.lineTo(sx + 3, 12); g.lineTo(194 + 22, 100); g.lineTo(194 - 22, 100); g.fill(); }
    for (let i = 0; i < 5; i++) { const f = frac(a.ph * 0.5 * bt + i / 5), x = 232 + Math.sin(f * 9 + i * 2) * 26 + (i - 2) * 14, y = 66 - f * 54; g.globalAlpha = 1 - f * f; const c = cols[i % 4]; R(g, OUT, x - 1, y - 1, 5, 5); R(g, c, x, y, 3, 3); R(g, OUT, x + 3, y - 7, 2, 8); R(g, c, x + 3, y - 6, 1, 7); if (i % 2) R(g, c, x + 3, y - 7, 5, 2); g.globalAlpha = 1; }
  },
  fr(g, t, a) {
    for (let i = 0; i < 9; i++) { const x = 20 + i * 54, c = cust(i + 2), bob = Math.round(Math.abs(Math.sin(a.ph * 3.14 + i)) * 3); B(g, x - 8, 108 - bob, 16, 14, c, null); R(g, c, x - 8, 101 - bob, 4, 4); R(g, c, x + 4, 101 - bob, 4, 4); R(g, OUT, x - 4, 112 - bob, 2, 2); R(g, OUT, x + 2, 112 - bob, 2, 2); if (i % 3 === 0) { R(g, c, x - 12, 98 - bob, 3, 8); R(g, "#ffe890", x - 13, 94 - bob, 5, 4); } }
  },
};

S.garland = {
  st(g) {
    bands(g, ["#b4e4ff", "#c8eeff", "#dcf6ff"], 0, 54);
    R(g, "#a4dc80", 0, 40, W, 40); for (let x = 0; x < W; x += 60) { disc(g, "#a4dc80", x + 20, 38, 22); } R(g, "#8ed46a", 0, 52, W, 28);
    B(g, 4, 22, 100, 56, "#faE4c4", "#dcbe98"); R(g, "#e87a6a", 0, 10, 108, 14); R(g, "#c85a4a", 0, 22, 108, 2); for (let x = 4; x < 104; x += 20) R(g, "#fff", x, 10, 10, 14); B(g, 44, 42, 16, 36, "#8a5a2a", null); B(g, 14, 38, 22, 18, "#a8e0f8", null); R(g, "#fff", 24, 38, 2, 18); B(g, 70, 38, 22, 18, "#a8e0f8", null);
    for (let x = 118; x < W; x += 12) { B(g, x, 54, 6, 20, "#fff8ea", null); R(g, "#fff8ea", x, 51, 2, 3); R(g, "#fff8ea", x + 4, 51, 2, 3); } R(g, OUT, 118, 59, W - 118, 1); R(g, OUT, 118, 67, W - 118, 1);
    R(g, "#8ed46a", 0, 78, W, 42); const r = rng(3); for (let i = 0; i < 120; i++) { const x = Math.floor(r() * W), y = 80 + Math.floor(r() * 40); R(g, "#74c050", x, y, 1, 3); }
    R(g, "#6a4a30", 0, 80, W, 2);
    for (let row = 0; row < 3; row++) for (let x = 4 + (row % 2) * 8; x < W; x += 17) { if (x > 140 && x < 250 && row === 2) continue; const y = 84 + row * 12 + Math.floor(r() * 3); R(g, "#4aa04a", x + 1, y, 1, 8); R(g, "#5ab85a", x - 1, y + 3, 2, 1); disc(g, OUT, x + 1, y - 1, 3); disc(g, PAL[Math.floor(r() * 6)], x + 1, y - 1, 2); R(g, "#fff4a0", x + 1, y - 1, 1, 1); }
  },
  bk(g, t, a) {
    for (let i = 0; i < 4; i++) { const x = 130 + ((t / 30 * (1 + a.act) + i * 112) % 360), y = 46 + Math.sin(t / 400 + i * 2) * 14 + i * 5, w = Math.floor(t / 90 + i) % 2, c = PAL[i % 6]; R(g, c, x - 4, y - w, 4, 4); R(g, c, x + 1, y - w, 4, 4); R(g, OUT, x, y - 1, 1, 6); }
    for (let i = 0; i < 6; i++) { const f = frac(t / 3000 + i / 6), x = (f * 560 + i * 40) % 520 - 20, y = 10 + f * 80 + Math.sin(f * 20 + i) * 6; R(g, PAL[(i + 1) % 6], x, y, 3, 2); }
  },
  fr(g, t, a, p) {
    // the flower chain hanging from the shears
    const x0 = p.hx + p.tx - 8, y0 = p.hy + p.ty + 6;
    for (let i = 0; i < 8; i++) { const q = i / 7, x = x0 + q * 22, y = y0 + 6 + Math.sin(q * Math.PI) * 9 + Math.sin(t / 300 + i) * 0.8; disc(g, OUT, x, y, 3); disc(g, PAL[i % 6], x, y, 2); }
    for (const x of [8, 460]) for (let i = 0; i < 3; i++) { const sw = Math.round(Math.sin(t / 500 + i + x) * 2), h = 22 + i * 6; R(g, "#3f9040", x + i * 7, 120 - h, 2, h); disc(g, OUT, x + i * 7 + sw, 120 - h, 4); disc(g, PAL[(i * 2 + x) % 6], x + i * 7 + sw, 120 - h, 3); R(g, "#fff4a0", x + i * 7 + sw, 120 - h, 1, 1); }
    if (p.snip) { R(g, "#ffffff", x0 + 16, y0 - 4, 2, 2); R(g, "#ffffff", x0 + 20, y0 - 8, 1, 1); }
  },
};

// ── cache + entry points ────────────────────────────────────────────────────────────────────────
const cache = {};
function layer(k) {
  if (cache[k]) return cache[k];
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  if (S[k]) S[k].st(g);
  return (cache[k] = c);
}
export function back(g, k, t, a) {
  g.drawImage(layer(k), 0, 0);
  if (S[k] && S[k].bk) S[k].bk(g, t, a);
}
export function front(g, k, t, a, p) {
  if (S[k] && S[k].fr) S[k].fr(g, t, a, p);
}

/** The hero's job motion this frame. dx/dy move the hero; tx/ty/ta place the tool relative to the hero box; hit = just struck. */
export function pose(k, a) {
  const f = frac(a.ph), p = { dx: 0, dy: 0, tx: 94, ty: 52, ta: -0.5, fr: 0, hit: 0, lift: 0, fa: 0, hx: 0, hy: 0, beam: false, snip: false };
  const sw = (wt, a0, a1, lift) => {
    if (f < wt) { p.ty -= sm(0, wt, f) * lift; return L(-0.3, a0, sm(0, wt, f)); }
    if (f < wt + 0.12) { p.dx = 3; return L(a0, a1, sm(wt, wt + 0.12, f)); }
    p.hit = f < wt + 0.3 ? 1 : 0; return L(a1, -0.3, sm(wt + 0.12, 1, f));
  };
  switch (k) {
    case "pipe": p.ta = sw(0.6, -1.0, 0.9, 8); break;
    case "fly": p.ta = sw(0.55, -0.9, 1.1, 6); break;
    case "wall": p.ta = sw(0.58, -1.3, 1.35, 6); p.tx = 90; break;
    case "store": p.tx = 90 + (0.5 + 0.5 * Math.sin(f * 6.283)) * 14; p.ty = 58; p.ta = 1.35; p.beam = f > 0.45 && f < 0.62; p.hit = p.beam ? 1 : 0; break;
    case "parcel": { const e = 0.5 - 0.5 * Math.cos(f * 6.283); p.tx = 88; p.ty = 58 - 22 * e; p.ta = 0; p.dy = 2 - e * 3; break; }
    case "laundry": p.tx = 90 + Math.sin(f * 6.283 * 3) * 6; p.ty = 60; p.ta = 0.3 * Math.sin(f * 6.283 * 3); p.dy = Math.round(Math.sin(f * 6.283 * 3)); break;
    case "taiyaki": { const e = sm(0.45, 0.85, f); p.ta = 0.3 + e * 6.283; p.ty = 56 - Math.sin(e * Math.PI) * 18; p.lift = Math.sin(e * Math.PI) * 14; p.fa = e * 6.283 * 1.5; p.hit = e > 0 && e < 1 ? 1 : 0; break; }
    case "pest": p.tx = 92 + (Math.sin(f * 12.566) > 0 ? 2 : 0); p.ty = 56; p.ta = 1.15; break;
    case "cross": p.fr = 1 + Math.floor(f * 4) % 2; p.walk = true; p.ty = 54 + Math.sin(f * 12.566) * 2; p.ta = 0.1 + 0.2 * Math.sin(f * 6.283); p.dy = -Math.abs(Math.sin(f * 6.283 * 2)) * 2; break;
    case "lamp": { const up = sm(0.35, 0.6, f) - sm(0.75, 1, f); p.ta = L(0.3, -0.15, up); p.ty = 56 - 22 * up; p.hit = up > 0.9 ? 1 : 0; break; }
    case "rhythm": p.tx = 70 + Math.sin(f * 6.283 * 4) * 2; p.ty = 66; p.ta = 0.7; p.dy = -Math.abs(Math.sin(f * 3.1416 * 2)) * 3; break;
    case "garland": p.ta = 0.2 + Math.sin(f * 6.283 * 3) * 0.25; p.ty = 56; p.snip = Math.sin(f * 6.283 * 3) > 0.9; break;
    default: break;
  }
  return p;
}
