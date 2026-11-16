/**
 * Scenery sprites (split from scene2d.js): `scenery()` (trees, rocks, houses, props, per theme),
 * `autumnScenery` (단풍 왕도), and the wall pieces `WALL wallPiece`.
 */

import { HUE } from "./autumn.js";
import { prop, tone, lt, dk, hash, sheet, tools, ink } from "./scene_view.js";

// ───────────────────────────── scenery sprites ─────────────────────────────

const ROOF = ["#d8604c", "#5a86cc", "#62a86c", "#9a70c8"];
export const NEON = ["#ff5a94", "#5ae4e4", "#ffd24a", "#7aff8a"];
const CAR = ["#c84a50", "#4a78c0", "#e0e0e6", "#484c58", "#d8ac40"];
const WOOD = "#8a5a34", WOOD_D = "#6a4226";
let SC = null;
export function scenery() {
  if (SC) return SC;

  // A broad-leaf tree: a dark mass, a lit mass on the upper left, a highlight, and loose leaves.
  const tree = (leaf, fruit) => prop(48, 62, (b) => {
    const d = tone(leaf, "#143a4a", 0.42), l = lt(leaf, 1.16), hl = lt(leaf, 1.36);
    b.r(20, 42, 8, 18, WOOD); b.r(18, 58, 12, 3, WOOD); b.r(25, 42, 3, 19, WOOD_D); b.r(21, 47, 2, 3, WOOD_D); b.r(17, 60, 3, 1, WOOD_D);
    b.oval(24, 25, 23, 20, d); b.oval(7, 31, 6, 6, d); b.oval(41, 31, 6, 6, d); b.oval(25, 7, 10, 6, d); b.oval(38, 14, 7, 7, d);
    b.oval(21, 22, 19, 16, leaf); b.oval(8, 28, 5, 5, leaf); b.oval(24, 7, 8, 4, leaf); b.oval(35, 16, 6, 6, leaf);
    b.oval(16, 15, 11, 8, l); b.oval(13, 11, 6, 4, hl);
    for (const [x, y] of [[29, 13], [33, 25], [9, 22], [21, 30], [14, 35], [27, 35]]) b.r(x, y, 3, 2, d);
    for (const [x, y] of [[31, 38], [37, 31], [19, 40], [40, 24]]) b.r(x, y, 3, 2, leaf);
    for (const [x, y] of [[8, 17], [21, 6], [17, 20]]) b.r(x, y, 2, 1, hl);
    if (fruit) for (const [x, y] of [[13, 23], [26, 17], [32, 29], [20, 33], [37, 20], [8, 30]]) { b.r(x, y, 3, 3, fruit); b.r(x, y, 1, 1, lt(fruit, 1.5)); }
  });
  // The blossom branches spread outward from a forked trunk, leaving small openings under the crown.
  const cherry = (v) => prop(78, 78, (b) => {
    const bend = v === 0 ? -4 : v === 1 ? 3 : 0;
    const [d, m, l, cream] = [
      ["#b56f91", "#de9ab3", "#f4bdcb", "#ffe7dd"],
      ["#a56986", "#d790aa", "#f0b4c5", "#ffe1da"],
      ["#be8498", "#e8acbc", "#f9cbd0", "#fff0e6"],
    ][v];
    b.tri([[26,76], [33,71], [35,47], [34+bend,36], [40+bend,35], [43,62], [44,71], [52,76]], "#76564f");
    b.tri([[34,73], [38,59], [37+bend,41], [41+bend,38], [45,72], [49,75], [42,76]], "#59414a");
    b.tri([[37,59], [31,50], [18,42], [12,31], [16,34], [24,41], [39,49]], "#76564f");
    b.tri([[40,56], [44,45], [54,39], [62,25], [62,34], [57,42], [46,54]], "#62474d");
    b.r(34, 67, 2, 5, "#a9816c"); b.r(37, 57, 2, 9, "#a17a68"); b.r(42, 64, 1, 6, "#906358");
    const spread = v === 1 ? 0.85 : 1;
    const crowns = [
      [12,31,11,8], [20,23,14,11], [32,15,13,12], [45,16,14,12],
      [58,20,13,10], [66,32,11,9], [53,37,14,11], [37,34,15,12], [22,39,14,8],
    ].map(([x, y, w, h], i) => [39 + (x - 39) * spread + bend, y + (v === 2 && i < 6 ? 4 : 0),
      w * spread, h + (v === 1 && i < 6 ? 2 : 0)]);
    for (const [x, y, w, h] of crowns) b.oval(x, y + 2, w, h, d);
    for (const [x, y, w, h] of crowns) {
      b.oval(x - 1, y, w - 1, h - 2, m);
      b.oval(x - 3, y - 3, w * 0.72, h * 0.58, l);
    }
    b.tri([[35,54], [31,47], [23,42], [25,41], [33,44], [38,50]], "#76564f");
    b.tri([[40,51], [48,44], [54,42], [50,46], [42,54]], "#76564f");
    for (let i = 0; i < 75; i++) {
      const [cx, cy, w, h] = crowns[i % crowns.length];
      const x = Math.round(cx + (hash(i, v, 171) - 0.5) * w * 1.25);
      const y = Math.round(cy + (hash(v, i, 169) - 0.6) * h * 1.22);
      b.r(x, y, i % 4 ? 2 : 3, 1, y < cy ? cream : l);
      if (i % 3 === 0) b.r(x + 1, y - 1, 1, 3, y < cy ? cream : m);
    }
  });
  const rapeseed = (v) => prop(31, 26, (b) => {
    for (let i = 0; i < 7; i++) {
      const x = 3 + i * 4, y = 15 + ((i + v) % 3) * 3, height = 7 + Math.floor(hash(i, v, 47) * 8);
      const tip = y - height, tilt = i % 2 ? 1 : -1;
      b.r(x, tip + 3, 1, height - 2, "#608340");
      b.r(x + tilt, y - 5, 3, 2, "#719848");
      b.r(x - tilt, y - 8, 2, 1, "#a0af57");
      b.r(x - 2, tip + 1, 5, 2, "#e4aa2d");
      b.r(x - 1, tip - 1, 3, 3, "#f6ca3b");
      b.r(x - 1, tip, 2, 1, "#fff0a0");
    }
  });
  const pine = (tall) => prop(40, 68, (b) => {
    b.r(17, 54, 6, 12, "#7a5030"); b.r(21, 54, 2, 12, "#5e3c22"); b.r(15, 65, 10, 2, "#7a5030");
    const tiers = tall ? [[36, 19, 20], [22, 15, 19], [8, 11, 18], [0, 6, 11]] : [[38, 18, 18], [25, 14, 17], [12, 9, 16]];
    for (const [y, w, h] of tiers) {
      for (let x = 20 - w; x < 20 + w; x += 6) b.tri([[x, y + h], [x + 6, y + h], [x + 3, y + h + 4]], x < 17 ? "#3f8c64" : "#2a6a50");
      b.tri([[20 - w, y + h], [20 + w, y + h], [20, y]], "#2a6a50");
      b.tri([[20 - w, y + h], [20, y + h], [20, y]], "#3f8c64");
      b.r(20 - w * 0.55, y + h * 0.6, 4, 2, "#5cae7c"); b.r(18, y + h * 0.35, 2, 2, "#5cae7c"); b.r(22 + w * 0.2, y + h * 0.7, 4, 2, "#1f5440");
    }
  });
  const bush = (v) => prop(30, 22, (b) => {
    const leaf = "#4faa5a", d = tone(leaf, "#143a4a", 0.42);
    b.oval(15, 13, 14, 9, d); b.oval(13, 11, 12, 8, leaf); b.oval(21, 10, 7, 6, leaf); b.oval(10, 8, 7, 4, lt(leaf, 1.16)); b.oval(8, 6, 3, 2, lt(leaf, 1.36));
    b.r(14, 15, 3, 2, d); b.r(21, 13, 3, 2, d); b.r(6, 14, 2, 1, d);
    const dot = [null, "#f06a7a", "#fffbe8"][v];
    if (dot) for (const [x, y] of [[6, 12], [15, 8], [23, 9], [12, 16], [20, 15]]) { b.r(x, y, 2, 2, dot); if (v === 2) b.r(x, y, 1, 1, "#f0c040"); }
  });
  const rock = (moss) => prop(30, 24, (b) => {
    b.tri([[3, 23], [1, 13], [8, 4], [19, 2], [27, 9], [29, 20], [24, 23]], "#8f93a3");
    b.tri([[8, 5], [19, 3], [25, 9], [14, 12], [5, 12]], "#b4b8c6");
    b.tri([[14, 12], [25, 9], [29, 20], [24, 23], [12, 23]], "#7a7e90");
    b.r(10, 5, 6, 1, "#d8dce8"); b.r(17, 13, 1, 2, "#5e6274"); b.r(18, 15, 1, 2, "#5e6274"); b.r(17, 17, 1, 2, "#5e6274"); b.r(8, 15, 2, 1, "#a0a4b4"); b.r(4, 21, 20, 2, "#6a6e80");
    if (moss) { b.oval(10, 6, 6, 2.6, "#6ab85a"); b.r(17, 4, 6, 2, "#6ab85a"); b.r(5, 10, 3, 2, "#4faa5a"); }
  });
  const shard = (b, x, y, w, h, c) => {
    b.tri([[x, y + h], [x + w, y + h], [x + w, y + 7], [x + w / 2, y], [x, y + 7]], c);
    b.tri([[x + w / 2, y + h], [x + w, y + h], [x + w, y + 7], [x + w / 2, y]], tone(c, "#2a2a7a", 0.34));
    b.r(x + 1, y + 8, 1, h - 12, "#ffffff"); b.r(x + 2, y + 6, 1, 3, lt(c, 1.5));
  };
  const crystal = (c) => prop(32, 44, (b) => {
    shard(b, 2, 18, 9, 24, c); shard(b, 10, 2, 12, 40, c); shard(b, 21, 21, 9, 21, c);
    b.r(0, 39, 9, 5, "#3a4a6c"); b.r(7, 41, 20, 3, "#2e3c5c"); b.r(24, 40, 8, 4, "#3a4a6c");
  });
  const house = (v) => prop(132, 138, (b) => {
    const roof = ROOF[v % 4], wall = "#f6ecd2", beam = WOOD;
    // walls on a stone footing, framed in timber
    b.r(8, 70, 116, 66, wall); b.r(8, 73, 116, 4, "#dccdac");
    b.r(8, 124, 116, 12, "#b8b0a4"); b.r(8, 124, 116, 1, "#d6cec2");
    for (let x = 8; x < 124; x += 14) b.r(x + (x % 28 ? 5 : 0), 128, 1, 8, "#958d82");
    b.r(8, 130, 116, 1, "#958d82");
    for (const x of [8, 44, 85, 121]) b.r(x, 70, 3, 54, beam);
    b.r(8, 98, 36, 2, beam); b.r(88, 98, 36, 2, beam);
    // door, step and a sign for the trade inside
    b.r(54, 94, 24, 42, beam); b.r(57, 97, 18, 39, "#b27a44"); b.r(57, 97, 18, 3, "#c8935a"); b.r(65, 97, 2, 39, "#96623a"); b.r(71, 116, 3, 3, "#f0cc60");
    b.r(50, 134, 32, 3, "#d6cec2");
    b.r(57, 80, 18, 12, "#f2e0b0"); b.r(57, 80, 18, 1, beam); b.r(57, 91, 18, 1, beam); b.r(57, 80, 1, 12, beam); b.r(74, 80, 1, 12, beam);
    if (v % 4 === 0) { b.r(64, 85, 5, 5, "#f078a8"); b.r(65, 82, 3, 3, "#d8f0ff"); b.r(65, 82, 3, 1, "#8a5a34"); }
    else if (v % 4 === 1) { b.r(61, 84, 10, 3, "#7a8294"); b.r(64, 87, 4, 2, "#7a8294"); b.r(62, 89, 8, 1, "#5a6070"); }
    else if (v % 4 === 2) { b.r(65, 82, 2, 8, "#f0b030"); b.r(62, 85, 8, 2, "#f0b030"); b.r(64, 84, 4, 4, "#f0b030"); }
    else { b.r(62, 83, 6, 6, "#8ab4f0"); b.r(65, 83, 4, 4, "#f2e0b0"); }
    // windows with shutters and flower boxes
    for (const x of [18, 94]) {
      b.r(x - 4, 82, 4, 16, roof); b.r(x + 20, 82, 4, 16, roof); b.r(x - 3, 86, 2, 1, dk(roof)); b.r(x + 21, 86, 2, 1, dk(roof)); b.r(x - 3, 92, 2, 1, dk(roof)); b.r(x + 21, 92, 2, 1, dk(roof));
      b.r(x, 80, 20, 20, beam); b.r(x + 2, 82, 16, 16, "#bfe6f4"); b.r(x + 2, 82, 16, 5, "#dff4fc"); b.r(x + 9, 82, 2, 16, beam); b.r(x + 2, 89, 16, 2, beam);
      b.r(x - 2, 100, 24, 5, "#b8844e"); b.r(x - 2, 104, 24, 1, WOOD_D);
      for (let i = 0; i < 5; i++) { b.r(x + i * 5, 97, 2, 3, "#4faa5a"); b.r(x - 1 + i * 5, 95, 3, 3, ["#f06a7a", "#fffbe8", "#f0c040"][(i + v) % 3]); }
    }
    // roof: rows of shingles, a pale ridge, a dark eave
    b.tri([[2, 72], [130, 72], [112, 14], [20, 14]], roof);
    for (let y = 22, k = 0; y < 68; y += 9, k++) {
      const half = 46 + (y - 14) * 0.31;
      b.r(66 - half, y, half * 2, 1, dk(roof, 0.8));
      for (let x = 66 - half + (k % 2 ? 5 : 0); x < 66 + half - 2; x += 10) b.r(x, y + 1, 1, 4, dk(roof, 0.8));
    }
    b.tri([[2, 72], [130, 72], [127, 63], [5, 63]], dk(roof, 0.82)); b.r(2, 71, 128, 2, dk(roof, 0.66));
    b.r(20, 12, 92, 4, lt(roof, 1.25)); b.r(20, 15, 92, 1, dk(roof, 0.8));
    b.tri([[20, 14], [26, 14], [10, 44], [6, 56]], lt(roof, 1.12));
    // chimney
    b.r(89, 0, 16, 24, "#b8a898"); b.r(87, 0, 20, 4, "#8a7e72"); b.r(100, 4, 5, 20, "#9c8e80");
    for (let y = 8; y < 22; y += 5) b.r(89, y, 16, 1, "#9c8e80");
  });
  const building = (v) => prop(132, 208, (b) => {
    const wall = ["#6c7284", "#7c665a", "#5c687c", "#6c5c80"][v % 4], neon = NEON[v % 4];
    b.r(4, 12, 124, 196, wall); b.r(4, 12, 4, 196, lt(wall, 1.14)); b.r(120, 12, 8, 196, dk(wall, 0.84));
    for (let y = 44; y < 140; y += 24) b.r(8, y, 112, 1, dk(wall, 0.86));
    b.r(0, 6, 132, 8, "#2e3240"); b.r(0, 6, 132, 2, "#4a5064");
    b.r(86, 0, 26, 8, "#565e72"); b.r(86, 0, 26, 2, "#7a8298"); b.r(22, 0, 2, 7, "#2e3240"); b.r(18, 2, 10, 1, "#2e3240");
    for (let r = 0; r < 5; r++) for (let i = 0; i < 5; i++) {
      const on = hash(i, r, v + 3) > 0.42, x = 13 + i * 22, y = 22 + r * 24;
      b.r(x, y, 16, 17, "#20232c");
      b.r(x + 2, y + 2, 12, 12, on ? (hash(i, r, v + 9) > 0.5 ? "#ffd880" : "#a8e4ff") : "#30364a");
      if (on) { b.r(x + 2, y + 2, 12, 3, "#fff4d0"); b.r(x + 7, y + 2, 2, 12, "#20232c"); } else b.r(x + 3, y + 3, 4, 2, "#48506a");
      b.r(x - 1, y + 16, 18, 2, lt(wall, 1.2));
      if (hash(i, r, v + 21) > 0.8) { b.r(x + 3, y + 17, 10, 5, "#8a90a0"); b.r(x + 4, y + 18, 8, 1, "#5a6070"); b.r(x + 4, y + 20, 8, 1, "#5a6070"); }
    }
    // shop front: a neon sign, a striped awning, a shutter and two display windows
    b.r(10, 146, 112, 14, "#181a22"); b.r(14, 149, 30, 8, neon); b.r(50, 149, 10, 8, neon); b.r(66, 149, 26, 8, neon); b.r(98, 149, 18, 8, neon);
    b.r(14, 149, 102, 2, lt(neon, 1.5));
    for (let x = 8; x < 124; x += 8) b.r(x, 162, 8, 6, (x >> 3) % 2 ? "#f4f4f8" : neon);
    b.r(8, 168, 116, 1, "#181a22");
    b.r(46, 170, 40, 38, "#262a36"); for (let y = 174; y < 206; y += 5) b.r(49, y, 34, 2, "#444a5a");
    for (const x of [10, 94]) { b.r(x, 172, 28, 26, "#20232c"); b.r(x + 2, 174, 24, 22, "#3a5a7a"); b.r(x + 2, 174, 24, 6, "#58789a"); b.r(x + 4, 186, 6, 10, neon); b.r(x + 14, 190, 8, 6, "#f4f4f8"); }
    b.r(4, 200, 124, 8, dk(wall, 0.7));
  });
  const car = (col) => prop(62, 32, (b) => {
    b.r(2, 13, 58, 13, col); b.r(0, 16, 62, 8, col); b.r(13, 2, 32, 12, col); b.r(11, 5, 36, 9, col);
    b.r(0, 22, 62, 3, dk(col, 0.76)); b.r(2, 13, 58, 1, lt(col, 1.3)); b.r(13, 2, 32, 1, lt(col, 1.3));
    b.r(15, 4, 13, 9, "#2a3442"); b.r(30, 4, 13, 9, "#2a3442"); b.r(15, 4, 13, 2, "#7aa0c0"); b.r(30, 4, 13, 2, "#7aa0c0"); b.r(17, 7, 3, 4, "#4a6480");
    b.r(29, 14, 1, 9, dk(col, 0.7)); b.r(33, 16, 4, 1, dk(col, 0.6));
    b.r(57, 16, 5, 4, "#ffe8a0"); b.r(0, 16, 3, 4, "#ff5050"); b.r(0, 24, 62, 2, "#3a3e4a");
    for (const x of [14, 47]) { b.oval(x, 26, 6, 5.4, "#22242c"); b.oval(x, 26, 3, 2.6, "#8a8e9c"); b.r(x - 1, 25, 2, 2, "#c8ccd8"); }
  });
  // ── maps-v2 M3 art (the south-west coast): palms, reef rocks, basalt boulders, mud huts, the jungle's trees
  const atop = (x, f) => { x.globalCompositeOperation = "source-atop"; f(); x.globalCompositeOperation = "source-over"; };
  // A coconut palm: a ringed trunk that curves as it leans, drooping fronds (dark behind, lit in front), nuts under the crown.
  const palm = (lean, v) => prop(64, 68, (b) => {
    const tr = "#b08a54", trD = "#84623a", trL = "#d0ac74", leaf = "#3fae5a", mid = "#2c9450", d = "#1c7446", hl = "#8ade6a";
    const top = 19, base = 63, cx = 32;
    const tx = (y) => cx + Math.round(lean * 8 * ((base - y) / (base - top)) ** 1.7);
    for (let y = base; y >= top; y--) {
      const x = tx(y), w = y > base - 4 ? 6 : y > 42 ? 5 : 4, x0 = x - (w >> 1);
      b.r(x0, y, w, 1, y % 5 === 0 ? trD : tr); b.r(x0 + w - 2, y, 2, 1, trD);
      if (y % 5 === 2) b.r(x0, y, 2, 1, trL);
    }
    b.r(tx(base) - 5, base, 10, 2, trD); b.r(tx(base) - 4, base, 4, 1, tr);
    const hx = tx(top), hy = top;
    const frond = (dir, len, rise, droop, c1, c2) => {
      for (let i = 0; i <= len; i++) {
        const t = i / len, x = Math.round(hx + dir * i), y = Math.round(hy - rise * Math.sin(t * 2) + droop * t * t), h = t < 0.2 ? 2 : t < 0.8 ? 3 : 2;
        b.r(x, y, 1, h, c1); b.r(x, y, 1, 1, c2);
        if (i > 3 && i % 2 === 0) b.r(x, y + h, 1, i % 4 === 0 ? 3 : 2, c1);
      }
    };
    frond(-1, 21, 3, 15, d, d); frond(1, 21, 3, 15, d, d);
    frond(0.72, 17, 10, 3, mid, leaf); frond(1, 20, 7, 8, mid, leaf);
    frond(-0.72, 17, 10, 3, leaf, hl); frond(-1, 20, 7, 8, leaf, hl);
    frond(v ? 0.25 : -0.2, 11, 9, -2, leaf, hl);
    b.oval(hx, hy + 1, 4, 3, "#5e4226");
    for (const [dx, dy] of v ? [[-3, 2], [2, 3]] : [[-3, 3], [0, 4], [3, 2]]) { b.r(hx + dx, hy + dy, 3, 3, "#8a5a2c"); b.r(hx + dx, hy + dy, 1, 1, "#c8904a"); }
  });
  // A reef rock standing in the shallows: moss over its top, pink coral, a dark wet foot with foam against it.
  const reef = (v) => prop(32, 26, (b, x) => {
    const c = "#8c9692", top = "#b2bab0", dkc = "#5e6a6c", wet = "#3a4e56", moss = "#58a85e", mossL = "#8ad06c", mossD = "#3a7848";
    b.oval(15, 15, 13, 9, c); if (v) b.oval(25, 18, 6, 6, c);
    b.oval(20, 18, 9, 6, dkc); b.oval(12, 13, 10, 6, c); b.oval(13, 10, 9, 4, top);
    if (v) b.oval(25, 16, 4, 3, top);
    b.oval(13, 8, 9, 3.4, moss); b.oval(10, 7, 5, 1.8, mossL);
    for (const [mx, mh] of [[5, 2], [8, 3], [12, 2], [16, 4], [20, 2], [22, 3]]) b.r(mx, 10, 2, mh, mossD);
    if (v) { b.oval(25, 14, 4, 1.8, moss); b.r(23, 15, 2, 2, mossD); }
    atop(x, () => { b.r(0, 20, 32, 6, wet); b.r(0, 20, 32, 1, "#4e666c"); });
    for (const [fx, fy, fw] of [[2, 23, 4], [9, 24, 3], [17, 24, 5], [26, 23, 3]]) b.r(fx, fy, fw, 1, "#ffffff");
    b.r(21, 13, 2, 2, "#f08a8a"); b.r(22, 12, 1, 1, "#ffb8b0"); b.r(7, 16, 2, 2, "#f0a060"); b.r(15, 18, 1, 1, "#f08a8a");
  });
  // Basalt on the strand: black angular blocks, a cold gloss along the edges that face the sky, spray at the foot.
  const basalt = (v) => prop(34, 28, (b) => {
    const k = "#24252c", m = "#3a3c48", t = "#565a6a", g = "#a2aec8";
    const body = v ? [[2, 27], [1, 16], [6, 6], [15, 2], [24, 5], [32, 14], [33, 24], [28, 27]] : [[3, 27], [2, 13], [9, 4], [20, 3], [29, 10], [32, 22], [27, 27]];
    b.tri(body, m);
    b.tri(v ? [[6, 6], [15, 2], [24, 5], [20, 11], [9, 12]] : [[9, 4], [20, 3], [26, 9], [16, 13], [6, 11]], t);
    b.tri(v ? [[20, 11], [24, 5], [32, 14], [33, 24], [28, 27], [17, 27]] : [[16, 13], [26, 9], [29, 10], [32, 22], [27, 27], [14, 27]], k);
    b.tri(v ? [[1, 16], [9, 12], [11, 27], [2, 27]] : [[2, 13], [6, 11], [9, 27], [3, 27]], "#30323c");
    // the gloss: thin lines on the upper edges, one hard glint
    if (v) { b.r(8, 5, 6, 1, g); b.r(15, 3, 6, 1, g); b.r(10, 12, 9, 1, "#70788e"); b.r(4, 10, 1, 4, "#70788e"); b.r(17, 5, 2, 1, "#e8f0ff"); b.r(21, 13, 1, 9, "#30323c"); }
    else { b.r(10, 5, 8, 1, g); b.r(19, 4, 5, 1, g); b.r(8, 12, 8, 1, "#70788e"); b.r(4, 9, 1, 4, "#70788e"); b.r(13, 6, 2, 1, "#e8f0ff"); b.r(18, 15, 1, 9, "#30323c"); }
    b.r(22, 17, 2, 1, "#4a4e5c"); b.r(25, 21, 3, 1, "#4a4e5c");
    if (v) { b.r(4, 25, 2, 1, "#dff4f4"); b.r(22, 26, 3, 1, "#dff4f4"); } else { b.r(11, 26, 3, 1, "#dff4f4"); b.r(27, 24, 2, 1, "#dff4f4"); }
  });
  // A twisted pine (maps-batch2): a trunk that winds as it climbs, flat pads of needles — dark under, lit on top.
  const tpine = (lean, v) => prop(52, 60, (b) => {
    const tr = "#6a4630", trD = "#4a2e20", trL = "#8e6646", lf = "#2f6e4e", lfD = "#1f4e3c", lfL = "#5aa474";
    const base = 56, cx = 26, tx = (y) => { const t = (base - y) / 40; return cx + Math.round(Math.sin(t * 3.4 + v) * 4 * lean + lean * 7 * t); };
    b.r(cx - 5, base, 10, 2, trD); b.r(cx - 3, base, 4, 1, tr);
    for (let y = base; y >= 16; y--) {
      const x = tx(y), w = y > 46 ? 5 : y > 30 ? 4 : 3, x0 = x - (w >> 1);
      b.r(x0, y, w, 1, tr); b.r(x0 + w - 1, y, 1, 1, trD);
      if (y % 6 === 0) b.r(x0, y, 1, 1, trL);
    }
    const pad = (px, py, rx) => { b.oval(px, py + 2, rx, 3.6, lfD); b.oval(px, py, rx, 3.2, lf); b.oval(px - 1, py - 1.5, rx - 2.5, 1.5, lfL); };
    const top = tx(16);
    // a side branch out to each lower pad
    for (let i = 0; i < 8; i++) { b.r(tx(30) + i * (lean >= 0 ? 1 : -1), 29 - (i >> 2), 2, 2, tr); b.r(tx(36) - i * (lean >= 0 ? 1 : -1), 35 - (i >> 2), 2, 2, trD); }
    pad(tx(36) - 10 * (lean >= 0 ? 1 : -1), 32, 8); pad(tx(30) + 10 * (lean >= 0 ? 1 : -1), 26, 9);
    pad(top - 1, 14, 12); if (v) pad(top + 5, 7, 7);
  });
  // A rock pillar (maps-batch2): a weathered column narrowing upward under a wider cap stone, banded.
  const hoodoo = (pal, v) => prop(30, 62, (b) => {
    const [mid, lit, dark, band] = pal, base = 58;
    b.oval(15, base, 11, 3.6, dark);
    for (let y = base; y >= 12; y--) {
      const t = (base - y) / 46, w = Math.max(3, Math.round((v ? 9 : 8) - 3.5 * t + Math.sin(y / 5 + v * 2) * 1.5));
      b.r(15 - w, y, w * 2, 1, y % 8 < 2 ? band : mid); b.r(15 - w, y, 2 + (w >> 2), 1, lit); b.r(15 + w - 3, y, 3, 1, dark);
    }
    b.oval(15, 10, 10, 4.2, mid); b.oval(13, 8.6, 7, 2, lit); b.r(6, 12, 18, 1, dark);
  });
  // A round mud hut: daubed wall, a cone of thatch in courses with a ragged eave, a dark doorway.
  const hut = (v) => prop(46, 44, (b, x) => {
    const wall = v ? "#d4a66a" : "#c89a62", wD = "#a47a48", wL = "#e4bc84", th = v ? "#b08c48" : "#bc9850", thD = "#84642f", thL = "#dcbc6c";
    b.r(8, 22, 30, 17, wall); b.oval(23, 38, 15, 4, wall);
    atop(x, () => { b.r(28, 20, 12, 24, wD); b.r(8, 22, 3, 20, wL); b.r(8, 40, 30, 3, "#86603a"); });
    b.r(18, 29, 8, 12, "#3a281c"); b.oval(22, 29, 4, 3, "#3a281c"); b.r(18, 40, 9, 1, "#6a4a30"); b.r(17, 29, 1, 11, wD);
    b.r(31, 28, 4, 4, "#3a281c"); b.r(31, 28, 4, 1, "#5e4028");
    b.r(11, 31, 3, 1, wD); b.r(13, 32, 1, 3, wD); b.r(12, 26, 2, 1, wL);
    b.tri([[1, 23], [45, 23], [23, 2]], th); b.oval(23, 23, 22, 3, th);
    atop(x, () => { b.r(23, 0, 23, 27, thD); });
    for (const y of [8, 13, 18]) { const hw = Math.round(((y - 2) * 22) / 21); b.r(23 - hw, y, hw, 1, thD); b.r(23, y, hw, 1, "#644a22"); }
    for (let i = 2; i < 44; i += 3) b.r(i, 25 + (i % 2), 2, 2, i < 23 ? th : thD);
    b.r(21, 0, 4, 4, thD); b.r(21, 0, 2, 2, thL); b.r(11, 16, 5, 1, thL); b.r(16, 10, 3, 1, thL); b.r(8, 21, 4, 1, thL);
  });
  // A jungle tree: buttress roots, a wide dark crown built of broad leaves, vines hanging from it.
  const jtree = (v) => prop(54, 68, (b) => {
    const leaf = v === 1 ? "#2e8a50" : "#2a8048", d = "#134a38", l = "#4aac58", hl = "#84d470", tr = "#70543a", trD = "#4c3624";
    b.r(23, 36, 8, 28, tr); b.r(28, 36, 3, 28, trD); b.r(24, 44, 1, 6, trD); b.r(25, 54, 1, 5, "#8e6e4c");
    b.tri([[23, 56], [15, 65], [23, 65]], tr); b.tri([[31, 56], [39, 65], [31, 65]], trD); b.r(15, 64, 24, 2, trD);
    b.oval(27, 23, 25, 17, d); b.oval(9, 31, 8, 7, d); b.oval(45, 31, 8, 7, d); b.oval(27, 8, 13, 6, d);
    for (const [lx, ly, w] of [[13, 15, 8], [26, 8, 8], [39, 14, 7], [8, 26, 7], [21, 20, 9], [34, 23, 8], [45, 27, 6], [14, 33, 7], [28, 33, 8], [40, 35, 6]]) {
      const lit = lx + ly < 44;
      b.oval(lx, ly, w, 3.6, lit ? l : leaf); b.r(lx - w + 2, ly, w * 2 - 4, 1, lit ? hl : l); b.r(lx - w + 1, ly + 3, w, 1, d);
    }
    for (const [vx, vy, vh] of [[7, 37, 9], [12, 39, 5], [41, 40, 8], [47, 37, 6], [35, 39, 4]]) { b.r(vx, vy, 1, vh, d); b.r(vx, vy + vh, 1, 1, l); }
    if (v === 2) for (const [fx, fy] of [[17, 12], [31, 19], [10, 28], [40, 30], [24, 30]]) { b.r(fx, fy, 3, 3, "#e8484e"); b.r(fx + 1, fy + 1, 1, 1, "#ffd24a"); }
  });
  SC = {
    "桜": [cherry(0), cherry(1), cherry(2)],
    rapeseed: [rapeseed(0), rapeseed(1), rapeseed(2)],
    "Ψ": [palm(0, 0), palm(1, 1), palm(-1, 0), palm(0.5, 1)],
    "Φ": [reef(0), reef(1), prop(26, 18, (b, x) => {
      // a low one, barely out of the water
      b.oval(12, 11, 11, 6, "#8c9692"); b.oval(16, 13, 7, 4, "#5e6a6c"); b.oval(10, 9, 8, 3, "#b2bab0");
      b.oval(10, 7, 7, 2.2, "#58a85e"); b.r(6, 6, 4, 1, "#8ad06c"); b.r(5, 9, 2, 2, "#3a7848"); b.r(13, 9, 2, 3, "#3a7848");
      atop(x, () => { b.r(0, 13, 26, 5, "#3a4e56"); b.r(0, 13, 26, 1, "#4e666c"); });
      b.r(2, 15, 3, 1, "#ffffff"); b.r(12, 16, 4, 1, "#ffffff"); b.r(18, 12, 2, 2, "#f08a8a");
    })],
    "Ω": [basalt(0), basalt(1)],
    "Δ": [hut(0), hut(1)],
    // maps-batch2 art, step 1: twisted pines, rock pillars (grey; RΘ the mesa's red hoodoos)
    "Σ": [tpine(1, 0), tpine(-1, 1), tpine(0.4, 1)],
    "Θ": [hoodoo(["#8e9496", "#b4babc", "#5c6266", "#787e82"], 0), hoodoo(["#8e9496", "#b4babc", "#5c6266", "#787e82"], 1)],
    "RΘ": [hoodoo(["#c4603a", "#e4885a", "#82361e", "#a2442a"], 0), hoodoo(["#c4603a", "#e4885a", "#82361e", "#a2442a"], 1)],
    JT: [jtree(0), jtree(1), jtree(2)],
    // driftwood on the beach: a sea-bleached trunk, a forked branch
    DW: [0, 1].map((v) => prop(30, 14, (b) => {
      const w = "#c8c0b0", wD = "#9a9282", wL = "#e8e2d4";
      b.r(2, 6, 25, 5, w); b.r(1, 7, 27, 3, w); b.r(2, 10, 25, 2, wD); b.r(4, 6, 18, 1, wL);
      for (const x of [8, 15, 21]) b.r(x, 8, 3, 1, wD);
      if (v) { b.r(18, 2, 2, 5, w); b.r(20, 1, 4, 2, w); b.r(19, 5, 1, 2, wD); } else { b.r(7, 3, 2, 4, w); b.r(4, 2, 4, 2, w); }
      b.r(v ? 0 : 26, 7, 2, 3, wD);
    })),
    T: [tree("#4faa5a"), tree("#58b05a", "#e8584a"), tree("#7abf52"), tree("#f4a8c4")],
    P: [pine(true), pine(false)],
    B: [bush(0), bush(1), bush(2)],
    R: [rock(false), rock(true)],
    // what stands where a bush would, in town: a planter, a barrel, a pair of crates
    TB: [
      prop(30, 22, (b) => { b.r(1, 10, 28, 11, "#b8844e"); b.r(1, 10, 28, 2, "#d8a868"); b.r(1, 19, 28, 2, WOOD_D); for (const x of [9, 19]) b.r(x, 12, 1, 7, WOOD_D); b.r(2, 8, 26, 2, "#5a4030"); for (let i = 0; i < 6; i++) { b.r(4 + i * 4, 4, 2, 4, "#4faa5a"); b.r(3 + i * 4, 1 + (i % 2), 4, 4, ["#f06a7a", "#fffbe8", "#f0c040", "#b48cff"][i % 4]); b.r(4 + i * 4, 2 + (i % 2), 2, 2, "#fff2c0"); } }),
      prop(22, 26, (b) => { b.r(3, 3, 16, 22, "#a8743e"); b.r(2, 6, 18, 16, "#a8743e"); b.r(15, 4, 4, 20, "#8a5a34"); b.r(6, 8, 2, 12, "#c8935a"); b.r(2, 7, 18, 2, "#5a5e6c"); b.r(2, 18, 18, 2, "#5a5e6c"); b.oval(11, 4, 8, 3, "#c8935a"); b.oval(11, 4, 5, 1.6, "#a8743e"); }),
      prop(30, 28, (b) => { const box = (x, y, w, h) => { b.r(x, y, w, h, "#c89a5e"); b.r(x, y, w, 2, "#e0b87a"); b.r(x, y + h - 2, w, 2, "#a8743e"); b.r(x, y, 2, h, "#a8743e"); b.r(x + w - 2, y, 2, h, "#96623a"); for (let i = 0; i < w - 4; i++) b.r(x + 2 + i, y + 2 + Math.round((i * (h - 5)) / (w - 5)), 1, 1, "#a8743e"); }; box(1, 9, 20, 19); box(14, 0, 15, 13); }),
    ],
    F: prop(32, 24, (b) => { for (const y of [7, 15]) { b.r(0, y, 32, 4, "#d8ac6e"); b.r(0, y + 3, 32, 1, "#b0844c"); b.r(0, y, 32, 1, "#ecc88c"); } for (const x of [5, 21]) { b.r(x, 2, 6, 22, "#e6c088"); b.r(x + 4, 3, 2, 21, "#b88a52"); b.r(x - 1, 0, 8, 3, "#f2d8a4"); } }),
    L: prop(18, 56, (b) => { b.r(8, 18, 2, 34, "#4a4c5a"); b.r(5, 50, 8, 4, "#4a4c5a"); b.r(3, 54, 12, 2, "#3a3c48"); b.r(3, 4, 12, 13, "#3a3c48"); b.r(5, 6, 8, 9, "#ffe690"); b.r(7, 8, 4, 5, "#fff8d0"); b.r(5, 14, 8, 1, "#f0b848"); b.r(1, 2, 16, 3, "#3a3c48"); b.r(5, 0, 8, 2, "#4a4c5a"); b.r(6, 17, 6, 2, "#4a4c5a"); }),
    L2: prop(22, 64, (b) => { b.r(8, 8, 2, 52, "#70788a"); b.r(9, 8, 1, 52, "#565e72"); b.r(5, 58, 8, 4, "#565e72"); b.r(3, 62, 12, 2, "#3a3c48"); b.r(8, 4, 12, 2, "#70788a"); b.r(13, 2, 9, 4, "#3a3c48"); b.r(14, 6, 7, 1, "#dff4ff"); }),
    G: prop(32, 30, (b) => { b.r(13, 12, 4, 18, WOOD); b.r(15, 12, 2, 18, WOOD_D); b.r(1, 2, 26, 12, "#e0b87a"); b.tri([[27, 2], [32, 8], [27, 14]], "#e0b87a"); b.r(1, 2, 26, 1, "#f2d8a4"); b.r(1, 12, 27, 2, "#b88a52"); b.r(5, 5, 14, 1, WOOD); b.r(5, 8, 10, 1, WOOD); }),
    K: crystal("#72e6f4"), K2: crystal("#c08af4"),
    S: [
      prop(24, 36, (b) => { b.tri([[1, 36], [23, 36], [12, 0]], "#5a7896"); b.tri([[1, 36], [12, 36], [12, 0]], "#7694b4"); b.r(9, 12, 2, 10, "#9ab4d0"); b.r(14, 20, 4, 1, "#42607e"); b.r(13, 27, 6, 1, "#42607e"); b.r(0, 33, 24, 3, "#42607e"); }),
      prop(28, 26, (b) => { b.tri([[0, 26], [13, 26], [7, 6]], "#7694b4"); b.tri([[7, 26], [13, 26], [7, 6]], "#5a7896"); b.tri([[11, 26], [28, 26], [20, 0]], "#5a7896"); b.tri([[11, 26], [20, 26], [20, 0]], "#7694b4"); b.r(17, 10, 2, 8, "#9ab4d0"); b.r(0, 24, 28, 2, "#42607e"); }),
    ],
    // the city's edge: concrete panels, some of them tagged
    Z: [0, 1, 2].map((v) => prop(32, 56, (b) => {
      b.r(0, 0, 32, 56, "#4a5064"); b.r(0, 0, 32, 5, "#6a7288"); b.r(0, 5, 32, 1, "#343846"); b.r(0, 50, 32, 6, "#343846");
      b.r(15, 6, 1, 44, "#3c4254"); b.r(0, 27, 32, 1, "#3c4254");
      if (v === 1) { b.r(4, 14, 9, 2, "#ff5a94"); b.r(6, 16, 2, 8, "#ff5a94"); b.r(10, 20, 6, 2, "#ff5a94"); b.r(20, 32, 8, 2, "#5ae4e4"); b.r(22, 34, 2, 7, "#5ae4e4"); }
      if (v === 2) { b.r(18, 12, 10, 12, "#e8e0c8"); b.r(20, 14, 6, 3, "#c84a50"); b.r(20, 19, 6, 1, "#6a7288"); b.r(20, 21, 4, 1, "#6a7288"); }
    })),
    y: prop(16, 24, (b) => { b.r(4, 5, 8, 19, "#d84c4c"); b.r(10, 6, 2, 18, "#a83a40"); b.r(0, 10, 16, 5, "#d84c4c"); b.r(0, 13, 16, 2, "#a83a40"); b.r(3, 0, 10, 6, "#f07070"); b.r(6, 11, 4, 3, "#f4f4f8"); b.r(2, 22, 12, 2, "#a83a40"); }),
    x: prop(20, 26, (b) => { b.r(2, 7, 16, 19, "#5c6474"); b.r(14, 8, 4, 18, "#48505e"); b.r(5, 11, 2, 12, "#48505e"); b.r(10, 11, 2, 12, "#48505e"); b.r(0, 3, 20, 5, "#7a8494"); b.r(0, 3, 20, 1, "#98a2b2"); b.r(7, 0, 6, 3, "#48505e"); }),
    c: CAR.map(car),
    // a fallen log, lying either way, sometimes mossed over
    l: [0, 1].map((v) => prop(30, 15, (b) => {
      b.r(2, 3, 26, 11, "#8a5a34"); b.r(1, 5, 28, 7, "#8a5a34"); b.r(2, 10, 26, 4, "#6a4226"); b.r(4, 4, 20, 1, "#a87446");
      for (const x of [9, 16, 22]) b.r(x, 6, 1, 5, "#6a4226");
      const cap = v ? 25 : 0;
      b.r(cap, 4, 5, 9, "#d8ac6e"); b.r(cap + 1, 6, 3, 5, "#b88a52"); b.r(cap + 2, 8, 1, 1, "#8a5a34");
      if (v) { b.r(6, 2, 7, 2, "#6ab85a"); b.r(15, 3, 4, 1, "#4faa5a"); } else b.r(12, 1, 2, 3, "#8a5a34");
    })),
    // a tree stump with its rings showing
    u: prop(20, 17, (b) => {
      b.r(3, 6, 14, 10, "#8a5a34"); b.r(12, 7, 5, 9, "#6a4226"); b.r(1, 13, 4, 3, "#8a5a34"); b.r(15, 14, 4, 2, "#6a4226"); b.r(6, 10, 1, 4, "#6a4226");
      b.oval(10, 6, 8, 4.4, "#e0b87a"); b.oval(10, 6, 5, 2.6, "#c8985a"); b.oval(10, 6, 2, 1, "#e0b87a"); b.r(4, 4, 3, 1, "#f2d8a4");
    }),
    // reeds standing in shallow water
    e: [0, 1].map((v) => prop(22, 27, (b) => {
      for (const [x, h, c] of v ? [[3, 17, 0], [8, 23, 1], [13, 19, 0], [17, 14, 1]] : [[4, 21, 1], [10, 25, 0], [15, 17, 1]]) {
        b.r(x, 27 - h, 2, h, c ? "#5fae52" : "#4a9648"); b.r(x + (c ? 2 : -1), 27 - h + 5, 1, 6, "#7acf6c");
        if (h > 18) { b.r(x - 1, 27 - h - 1, 4, 5, "#7a4a2a"); b.r(x - 1, 27 - h - 1, 1, 5, "#9a6a3e"); }
      }
    })),
    // what is left of a column
    q: [0, 1].map((v) => prop(18, 36, (b) => {
      const top = v ? 12 : 3;
      b.r(3, top, 12, 36 - top - 5, "#d2cdbd"); b.r(11, top, 4, 31 - top, "#aaa494"); b.r(3, top, 2, 31 - top, "#e6e2d4");
      for (let y = top + 6; y < 30; y += 7) b.r(3, y, 12, 1, "#aaa494");
      b.r(1, 30, 16, 6, "#c2bcac"); b.r(1, 30, 16, 1, "#e6e2d4"); b.r(1, 34, 16, 2, "#8c8678");
      if (v) { b.r(3, top, 4, 2, "#aaa494"); b.r(9, top - 2, 4, 2, "#d2cdbd"); b.r(5, 22, 4, 2, "#6aa85a"); } else { b.r(1, 1, 16, 4, "#c2bcac"); b.r(1, 1, 16, 1, "#e6e2d4"); }
    })),
    // a mine cart with a load of ore
    M: prop(32, 24, (b) => {
      b.r(3, 8, 26, 11, "#8a5a34"); b.r(5, 19, 22, 2, "#6a4226"); b.r(3, 8, 26, 2, "#b08050"); b.r(3, 14, 26, 1, "#6a4226"); b.r(3, 8, 2, 11, "#5a5e6c"); b.r(27, 8, 2, 11, "#5a5e6c"); b.r(15, 8, 2, 11, "#6a4226");
      b.oval(16, 7, 11, 4, "#5a6a88"); b.r(9, 3, 4, 4, "#72e6f4"); b.r(10, 2, 2, 1, "#ffffff"); b.r(18, 4, 4, 3, "#c08af4"); b.r(14, 5, 3, 2, "#7a8aa8");
      for (const x of [9, 23]) { b.oval(x, 21, 3.4, 3, "#3a3c48"); b.r(x - 1, 20, 2, 2, "#8a8e9c"); }
    }),
    // a dumpster with its lid half open
    D: prop(36, 27, (b) => {
      b.r(2, 9, 32, 16, "#3f7a62"); b.r(2, 9, 32, 2, "#56987c"); b.r(2, 21, 32, 4, "#2c5a48"); b.r(28, 11, 6, 14, "#2c5a48");
      for (const x of [9, 18]) b.r(x, 12, 1, 9, "#2c5a48");
      b.tri([[1, 9], [35, 9], [33, 3], [5, 5]], "#4a5064"); b.r(5, 5, 26, 1, "#6a7288");
      b.r(21, 14, 6, 4, "#e8e0c8"); b.r(22, 15, 4, 1, "#c84a50");
      for (const x of [7, 29]) b.oval(x, 25, 2.4, 2, "#22242c");
    }),
    // a traveller's tent
    E: prop(44, 34, (b) => {
      b.tri([[2, 33], [42, 33], [22, 2]], "#e6d2a4"); b.tri([[22, 2], [42, 33], [27, 33]], "#c2aa78"); b.tri([[15, 33], [29, 33], [22, 12]], "#4a3a34"); b.tri([[15, 33], [22, 33], [22, 12]], "#5e4a40");
      b.r(21, 0, 2, 5, "#8a5a34"); b.r(2, 32, 40, 2, "#b09866"); b.r(10, 22, 3, 1, "#f6ecd2"); b.r(7, 27, 4, 1, "#f6ecd2");
      b.r(0, 31, 3, 3, "#8a5a34"); b.r(41, 31, 3, 3, "#6a4226");
    }),
    // a standing stone, leaning a little, with moss at its foot
    O: [0, 1].map((v) => prop(24, 46, (b) => {
      const lit = "#cfd0dc", mid = "#a2a4b6", dk2 = "#74768c", ln = "#5e6076";
      b.tri([[2, 45], [22, 45], [20, 8], [14, 1], [5, 5]], mid);
      b.tri([[14, 1], [20, 8], [22, 45], [16, 45]], dk2);
      b.tri([[5, 5], [14, 1], [12, 7], [4, 12]], lit);
      b.r(4, 12, 2, 30, lit); b.r(16, 9, 1, 34, ln);
      b.r(8, 18, 4, 1, ln); b.r(9, 19, 1, 4, ln); b.r(9, 22, 4, 1, ln); b.r(12, 15, 1, 8, ln);          // a carved mark, worn almost away
      if (v) { b.r(8, 30, 5, 1, ln); b.r(10, 27, 1, 6, ln); } else { b.r(7, 32, 1, 3, ln); b.r(8, 34, 4, 1, ln); }
      b.r(2, 40, 9, 5, "#6ab85a"); b.r(3, 38, 4, 2, "#6ab85a"); b.r(16, 42, 6, 3, "#4faa5a"); b.r(3, 39, 2, 1, "#9ad884");
      b.r(0, 44, 24, 2, "#4e5a4a");
    })),
    // a dead tree: bare branches, bark gone grey
    A: [0, 1].map((v) => prop(40, 58, (b) => {
      const bark = "#6e5e50", dark = "#4c4036", lit = "#8e7e6c";
      const br = (x0, y0, x1, y1, w) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) b.r(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, w, bark); };
      b.r(17, 24, 7, 32, bark); b.r(21, 24, 3, 32, dark); b.r(17, 24, 1, 32, lit);
      b.r(12, 53, 17, 4, bark); b.r(10, 55, 4, 2, dark); b.r(27, 55, 5, 2, dark);
      if (v) { br(19, 30, 5, 13, 3); br(6, 15, 2, 5, 2); br(6, 15, 11, 5, 2); br(21, 27, 34, 10, 3); br(32, 12, 37, 3, 2); br(20, 25, 22, 2, 3); }
      else { br(19, 28, 7, 10, 3); br(9, 12, 9, 2, 2); br(21, 30, 35, 16, 3); br(33, 17, 38, 8, 2); br(33, 17, 28, 6, 2); br(20, 25, 16, 3, 3); br(17, 5, 21, 0, 2); }
      b.oval(20, 40, 2, 3.4, "#2a2420"); b.r(18, 33, 1, 5, dark);
      if (v) for (const [x, y] of [[8, 14], [30, 14]]) { b.r(x, y, 1, 7, "#7a8a5a"); b.r(x + 1, y + 2, 1, 4, "#5a6a42"); }
    })),
    // great mushrooms, red or amber caps flecked white
    Y: [["#d0503e", "#fff4e4"], ["#e09a3a", "#fff4e4"]].map(([cap, spot]) => prop(30, 32, (b) => {
      b.r(12, 15, 7, 15, "#efe4cc"); b.r(16, 15, 3, 15, "#cfc2a6"); b.r(10, 28, 11, 3, "#efe4cc");
      b.oval(15, 12, 14, 8, dk(cap, 0.66)); b.oval(15, 10, 14, 8, cap); b.oval(10, 7, 6, 3.4, lt(cap, 1.25));
      b.r(4, 16, 22, 2, "#e8dcc0");
      for (const [x, y] of [[6, 9], [15, 5], [21, 9], [11, 12]]) b.r(x, y, 3, 2, spot);
      b.r(24, 25, 2, 6, "#efe4cc"); b.oval(25, 24, 4, 2.6, cap); b.r(24, 23, 1, 1, spot);
    })),
    // underground, they glow
    Y2: [["#3ac8c0", "#d8fffa"], ["#6a8ae8", "#e8f0ff"]].map(([cap, spot]) => prop(30, 32, (b) => {
      b.r(12, 15, 7, 15, "#dff4ff"); b.r(16, 15, 3, 15, "#a8c8d8"); b.r(10, 28, 11, 3, "#dff4ff");
      b.oval(15, 12, 14, 8, dk(cap, 0.6)); b.oval(15, 10, 14, 8, cap); b.oval(10, 7, 6, 3.4, lt(cap, 1.3));
      b.r(4, 16, 22, 2, lt(cap, 1.45));
      for (const [x, y] of [[6, 9], [15, 5], [21, 9], [11, 12]]) b.r(x, y, 3, 2, spot);
      b.r(24, 25, 2, 6, "#dff4ff"); b.oval(25, 24, 4, 2.6, cap);
    })),
    // a blood altar: a slab of flesh-stone, a bowl brimming, candles of tallow
    X: prop(40, 34, (b) => {
      b.r(4, 14, 32, 18, "#5a1622"); b.r(4, 14, 32, 3, "#8c2c3a"); b.r(30, 16, 6, 16, "#3c0e16");
      b.r(2, 10, 36, 6, "#9e4855"); b.r(2, 10, 36, 1, "#ba5e6a"); b.r(2, 15, 36, 1, "#5a1622");
      b.oval(20, 11, 9, 3, "#3c0e16"); b.oval(20, 11, 8, 2.2, "#c41830"); b.r(15, 10, 4, 1, "#ff6a7a");
      for (const x of [5, 33]) { b.r(x, 2, 2, 9, "#f2ead0"); b.r(x, 0, 2, 3, "#ffb030"); b.r(x, 0, 1, 1, "#fff0a0"); }
      b.r(10, 16, 1, 6, "#c41830"); b.r(24, 16, 1, 9, "#c41830"); b.r(24, 25, 2, 1, "#c41830");
      b.r(7, 31, 10, 2, "#e2dcc6"); b.r(6, 30, 2, 4, "#f4f0e0"); b.r(16, 30, 2, 4, "#f4f0e0");
    }),
    house: [0, 1, 2, 3].map(house).concat([4, 5, 6, 7].map(building)),
    fountain: prop(72, 64, (b) => {
      b.oval(36, 45, 35, 18, "#8a909e"); b.oval(36, 43, 35, 18, "#c2c8d4"); b.oval(36, 41, 34, 16, "#dfe4ee"); b.oval(36, 43, 31, 14, "#aab0be");
      b.oval(36, 42, 29, 12.5, "#4a9ae0"); b.oval(36, 44, 27, 10, "#3f8ad2"); b.oval(30, 39, 14, 4, "#7abcf4");
      b.r(31, 22, 10, 22, "#c2c8d4"); b.r(31, 22, 3, 22, "#dfe4ee"); b.r(38, 22, 3, 22, "#9aa0ae");
      b.oval(36, 22, 14, 5, "#c2c8d4"); b.oval(36, 21, 14, 4, "#dfe4ee"); b.oval(36, 21, 11, 2.6, "#7abcf4");
      b.r(34, 10, 4, 10, "#c2c8d4"); b.oval(36, 9, 4, 3, "#dfe4ee");
      for (const [x, y, h] of [[35, 1, 6], [30, 6, 5], [41, 5, 6], [26, 12, 4], [45, 12, 4]]) b.r(x, y, 2, h, "#dff4ff");
    }),
  };
  SC.n = SC.TB[2];
  SC.AU = autumnScenery(rock);
  // ── dungeon furniture: the crypt's dead, the sewer's plumbing, the abyss's anatomy
  const BONE = "#e2dcc6", BONE_D = "#a8a08a", BONE_L = "#f4f0e0";
  Object.assign(SC, {
    // a stone sarcophagus, its lid carved with a cross
    1: prop(30, 24, (b) => {
      b.r(1, 8, 28, 15, "#7a746a"); b.r(1, 18, 28, 5, "#5a5550"); b.r(24, 9, 5, 14, "#5a5550");
      b.r(0, 3, 30, 7, "#989080"); b.r(0, 3, 30, 1, "#b8b09c"); b.r(0, 9, 30, 1, "#6a645c");
      b.r(13, 4, 4, 5, "#6a645c"); b.r(10, 5, 10, 2, "#6a645c");
      b.r(4, 13, 2, 6, "#5a5550"); b.r(12, 13, 2, 6, "#5a5550"); b.r(20, 13, 2, 6, "#5a5550");
    }),
    // a coffin stood against the wall, lid ajar
    2: [0, 1].map((v) => prop(20, 38, (b) => {
      b.tri([[4, 0], [16, 0], [20, 10], [16, 38], [4, 38], [0, 10]], "#6a4a34"); b.tri([[10, 0], [16, 0], [20, 10], [16, 38], [10, 38]], "#523624");
      b.r(5, 2, 10, 1, "#8a6646"); b.r(9, 8, 2, 12, "#3a2618"); b.r(6, 12, 8, 2, "#3a2618");
      if (v) { b.tri([[13, 2], [16, 2], [19, 10], [16, 36], [13, 36]], "#1a1216"); b.r(14, 16, 3, 2, BONE); b.r(14, 19, 2, 1, BONE_D); }
      b.r(4, 36, 12, 2, "#3a2618");
    })),
    // an iron stand of candles, burning low
    3: prop(16, 34, (b) => {
      b.r(7, 12, 2, 18, "#3a3c48"); b.r(3, 30, 10, 3, "#3a3c48"); b.r(1, 32, 14, 2, "#2a2c36"); b.r(1, 11, 14, 2, "#4a4c5a");
      for (const [x, h] of [[1, 5], [7, 8], [13, 4]]) { b.r(x, 11 - h, 2, h, "#f2ead0"); b.r(x + 1, 11 - h, 1, h, "#cfc6a8"); b.r(x, 8 - h, 2, 3, "#ffb030"); b.r(x, 7 - h, 1, 2, "#fff0a0"); }
    }),
    // a heap of bones with a skull on top
    4: [0, 1].map((v) => prop(28, 16, (b) => {
      b.r(2, 10, 24, 5, BONE_D); b.r(4, 8, 20, 3, BONE); b.r(1, 12, 8, 2, BONE); b.r(18, 12, 9, 2, BONE); b.r(0, 11, 2, 4, BONE_L); b.r(26, 11, 2, 4, BONE_L);
      b.r(6, 9, 1, 5, BONE_D); b.r(13, 10, 1, 4, "#7a7462"); b.r(20, 9, 1, 5, BONE_D);
      const x = v ? 15 : 7;
      b.r(x, 1, 8, 7, BONE); b.r(x + 1, 8, 6, 2, BONE); b.r(x, 1, 8, 1, BONE_L); b.r(x + 1, 4, 2, 2, "#2f2a29"); b.r(x + 5, 4, 2, 2, "#2f2a29"); b.r(x + 3, 7, 2, 1, "#2f2a29"); b.r(x + 2, 9, 1, 1, "#7a7462"); b.r(x + 4, 9, 1, 1, "#7a7462");
    })),
    // a pillar of stacked stone under a capital of skulls
    5: prop(20, 46, (b) => {
      b.r(4, 8, 12, 32, "#7a746a"); b.r(12, 8, 4, 32, "#5a5550"); b.r(4, 8, 2, 32, "#989080");
      for (let y = 16; y < 38; y += 8) b.r(4, y, 12, 1, "#5a5550");
      b.r(1, 40, 18, 6, "#6a645c"); b.r(1, 40, 18, 1, "#989080"); b.r(1, 44, 18, 2, "#4a4642");
      b.r(1, 2, 18, 7, "#989080"); b.r(1, 2, 18, 1, "#b8b09c"); b.r(1, 8, 18, 1, "#5a5550");
      for (const x of [3, 11]) { b.r(x, 3, 6, 5, BONE); b.r(x + 1, 5, 1, 2, "#2f2a29"); b.r(x + 4, 5, 1, 2, "#2f2a29"); }
    }),
    // a chapel altar: a stone table under a wine-red cloth, a skull, an open book and a gold cup on top
    9: prop(32, 28, (b) => {
      b.r(1, 14, 26, 13, "#8a8478"); b.r(27, 13, 5, 14, "#5a5550"); b.r(1, 25, 31, 2, "#4a4642");
      b.r(0, 8, 32, 6, "#b8b09c"); b.r(0, 8, 32, 1, "#d2c8b0"); b.r(0, 13, 32, 1, "#6a645c");
      b.r(10, 8, 11, 6, "#7a2a3a"); b.r(10, 14, 11, 10, "#7a2a3a"); b.r(10, 14, 11, 1, "#5a1e2c"); b.r(19, 14, 2, 10, "#5a1e2c");
      b.r(10, 23, 11, 1, "#c8a050"); b.r(14, 16, 2, 6, "#c8a050"); b.r(12, 18, 6, 2, "#c8a050");
      b.r(2, 3, 6, 5, BONE); b.r(2, 3, 6, 1, BONE_L); b.r(3, 5, 1, 1, "#2f2a29"); b.r(6, 5, 1, 1, "#2f2a29"); b.r(3, 8, 4, 1, BONE_D);
      b.r(11, 6, 9, 2, "#f2ead0"); b.r(11, 5, 4, 1, "#f2ead0"); b.r(16, 5, 4, 1, "#f2ead0"); b.r(15, 5, 1, 3, "#8a8070");
      b.r(24, 1, 5, 3, "#e0b860"); b.r(24, 1, 5, 1, "#f4dc90"); b.r(25, 4, 3, 2, "#c8a050"); b.r(24, 6, 5, 2, "#8a6a34");
    }),
    // a pew, seen from behind: a slanted back-board along the row (two ways: along x, along y)
    I: [0, 1].map((v) => prop(24, 30, (b) => {
      const face = v ? ["#5a3a22", "#7a5030", "#3a2416", "#9a6a3c"] : ["#6a4226", "#8a5a34", "#4a2e1a", "#b08048"];
      for (let i = 0; i < 18; i++) {
        const x = v ? 20 - i : 3 + i, yb = 21 + (i >> 1);
        b.r(x, yb - 9, 1, 2, face[3]);            // the seat behind, catching the light
        b.r(x, yb - 7, 1, 1, face[1]);            // the top rail
        b.r(x, yb - 6, 1, 7, face[0]);            // the board
        b.r(x, yb - 3, 1, 1, face[2]);            // a groove
        b.r(x, yb + 1, 1, 1, face[2]);            // its foot
      }
      for (const i of [0, 17]) { const x = v ? 20 - i : 3 + i, yb = 21 + (i >> 1); b.r(x - (v ? 1 : 0), yb - 10, 2, 12, face[2]); b.r(x - (v ? 1 : 0), yb - 10, 1, 1, face[3]); }
    })),
    // a pipe mouth in the wall, drooling
    6: [0, 1].map((v) => prop(24, 30, (b) => {
      b.r(2, 2, 20, 14, "#6a7280"); b.r(2, 2, 20, 2, "#98a2b2"); b.r(2, 13, 20, 3, "#48505e"); b.r(0, 0, 4, 18, "#7a8494"); b.r(20, 0, 4, 18, "#565e6e");
      b.oval(12, 9, 7, 5, "#1a1e22"); b.oval(12, 10, 5, 3, "#2c3a26");
      b.r(9, 12, 6, 12 + v * 4, "#6a9a3a"); b.r(9, 12, 2, 12 + v * 4, "#8cc054"); b.r(8, 24 + v * 4, 8, 2, "#5a8a30"); b.r(6, 26 + v * 4, 12, 2, "#6a9a3a");
      b.r(1, 5, 2, 2, "#3a4048"); b.r(21, 5, 2, 2, "#3a4048");
    })),
    // a rusted drum, banded and leaking
    7: [0, 1].map((v) => prop(20, 28, (b) => {
      const c = v ? "#8a5a3a" : "#5a7a6a";
      b.r(2, 3, 16, 23, c); b.r(1, 6, 18, 17, c); b.r(13, 4, 5, 21, dk(c, 0.76)); b.r(4, 7, 2, 14, lt(c, 1.25));
      b.r(1, 8, 18, 2, "#3a3c48"); b.r(1, 19, 18, 2, "#3a3c48"); b.oval(10, 4, 8, 3, lt(c, 1.18)); b.oval(10, 4, 5, 1.6, dk(c, 0.8));
      if (v) { b.r(6, 12, 8, 5, "#e8c040"); b.r(8, 13, 4, 3, "#2a2c36"); } else { b.r(3, 22, 3, 5, "#6a9a3a"); b.r(1, 26, 8, 2, "#5a8a30"); }
    })),
    // ribs rising out of the ground, curving in over the path
    8: [0, 1].map((v) => prop(30, 42, (b) => {
      for (const [x, s] of [[3, 1], [26, -1]]) {
        for (let i = 0; i < 9; i++) { const y = 40 - i * 4, bx = x + s * Math.round(Math.sin((i / 9) * 1.5) * (v ? 9 : 7)); b.r(bx - 1, y - 4, 4, 5, i % 2 ? BONE : BONE_L); b.r(bx + (s > 0 ? 2 : -1), y - 4, 1, 5, BONE_D); }
      }
      b.r(0, 38, 8, 4, "#5c1e2b"); b.r(22, 38, 8, 4, "#5c1e2b"); b.r(1, 37, 5, 1, "#9e4855"); b.r(24, 37, 5, 1, "#9e4855");
    })),
    // 질주의 바람: a wind shrine — a carved plinth with a glowing rune, a pole, a long green pennant streaming in the wind
    "/": prop(26, 46, (b) => {
      b.r(4, 36, 18, 7, "#8f93a3"); b.r(4, 36, 18, 2, "#b4b8c6"); b.r(18, 38, 4, 5, "#6e7284"); b.r(2, 42, 22, 4, "#6a6e80"); b.r(2, 42, 22, 1, "#8f93a3");
      b.r(8, 39, 2, 2, "#5ae4a0"); b.r(11, 39, 4, 1, "#5ae4a0"); b.r(16, 39, 1, 2, "#5ae4a0");
      b.r(12, 4, 3, 33, "#8a5a34"); b.r(14, 4, 1, 33, "#6a4226"); b.r(11, 1, 5, 4, "#e0c070"); b.r(11, 1, 5, 1, "#fff0b0");
      b.tri([[15, 6], [26, 10], [21, 12], [26, 16], [15, 17]], "#3fae72");
      b.tri([[15, 6], [26, 10], [15, 11]], "#7ae0a4");
      b.r(16, 7, 4, 1, "#c8ffe0"); b.r(18, 14, 5, 1, "#2a8a58");
    }),
    // a stalk of flesh with an eye at the end of it
    0: [0, 1].map((v) => prop(22, 30, (b) => {
      b.r(8, 12, 6, 16, "#8c2c3a"); b.r(12, 12, 2, 16, "#5a1622"); b.r(8, 14, 1, 10, "#ba4e5a"); b.r(4, 26, 14, 4, "#6e2230"); b.r(4, 26, 14, 1, "#9e4855");
      b.oval(11, 8, 9, 8, "#8c2c3a"); b.oval(11, 8, 7, 6, "#f4ecd8"); b.oval(11 + (v ? 1 : -1), 8, 3.4, 3.6, "#c41830"); b.r(10 + (v ? 1 : -1), 7, 2, 3, "#19070c"); b.r(8, 5, 2, 1, "#ffffff");
      b.r(3, 16, 2, 5, "#8c2c3a"); b.r(17, 18, 2, 4, "#8c2c3a");
    })),
  });
  return SC;
}

/**
 * 단풍 왕도 — the fallen kingdom's things, used in place of the usual ones on an autumn map:
 * broadleaf trees in four turned colours (two shapes each), shrubs and graveyard roses,
 * leaning headstones, rotted royal banners, an old king's statue, rubble where a big ruin
 * would stand if its picture found no room, dead trees with an eye in the bark, and the
 * blight's toadstools. `T` is picked by autumn.js hueAt so trees match the litter below.
 */
function autumnScenery(rock) {
  const bark = "#6a4e3a", barkD = "#43302a", barkL = "#8a6a4e";
  const STONE = ["#d2ccba", "#aaa494", "#7e786a", "#e6e2d4"], MOSS = "#5f7a3a", BL = "#9a5ad0", BLL = "#d6a0ff";
  const trunk = (b, x, y, w, h) => {
    b.r(x, y, w, h, bark); b.r(x + w - 3, y, 3, h, barkD); b.r(x + 1, y + 2, 1, h - 6, barkL);
    b.r(x - 3, y + h - 3, w + 6, 3, bark); b.r(x - 4, y + h - 1, 4, 1, barkD); b.r(x + w, y + h - 1, 5, 1, barkD);
  };
  // a round crown (oak, ginkgo): a dark mass, mid clusters, lit clusters to the upper left, a few dark gaps
  const round = (hue) => prop(50, 64, (b) => {
    const [d, m, l, hi] = HUE[hue].leaf;
    trunk(b, 21, 40, 8, 22);
    b.r(15, 44, 7, 2, bark); b.r(29, 46, 7, 2, barkD);
    for (const [x, y, rx, ry] of [[25, 26, 24, 18], [8, 32, 7, 6], [42, 31, 7, 7], [25, 8, 12, 7], [38, 15, 9, 8], [12, 15, 9, 8]]) b.oval(x, y, rx, ry, d);
    for (const [x, y, rx, ry] of [[23, 23, 20, 14], [9, 29, 5, 5], [24, 8, 9, 5], [37, 16, 7, 6], [13, 15, 7, 6], [40, 28, 5, 4]]) b.oval(x, y, rx, ry, m);
    for (const [x, y, rx, ry] of [[17, 16, 10, 7], [30, 11, 6, 4], [10, 26, 5, 4], [26, 25, 7, 4]]) b.oval(x, y, rx, ry, l);
    for (const [x, y] of [[12, 11], [19, 9], [8, 22], [29, 8], [23, 22]]) { b.r(x, y, 3, 2, hi); b.r(x + 1, y - 1, 1, 1, hi); }
    for (const [x, y] of [[31, 23], [36, 31], [14, 33], [23, 33], [41, 21], [6, 25], [18, 21]]) b.r(x, y, 3, 2, d);
    for (const [x, y] of [[34, 39], [16, 41], [43, 37]]) b.r(x, y, 2, 2, m);
  });
  // a maple: tiers of lobed foliage, each with a dark underside, narrowing to a point
  const maple = (hue) => prop(46, 66, (b) => {
    const [d, m, l, hi] = HUE[hue].leaf;
    trunk(b, 19, 44, 7, 20);
    b.r(13, 48, 7, 2, bark);
    const tiers = [[23, 35, 21, 9], [23, 23, 17, 8], [23, 12, 12, 7]];
    for (const [x, y, rx, ry] of tiers) { b.oval(x, y + 3, rx, ry, d); for (let k = -2; k <= 2; k++) b.oval(x + k * rx * 0.42, y + 4 + Math.abs(k), rx * 0.34, ry * 0.8, d); }
    for (const [x, y, rx, ry] of tiers) {
      b.oval(x - 1, y, rx - 2, ry - 1, m);
      for (let k = -2; k <= 1; k++) b.oval(x + k * rx * 0.42, y + Math.abs(k), rx * 0.3, ry * 0.62, m);
      b.oval(x - rx * 0.38, y - ry * 0.3, rx * 0.42, ry * 0.42, l);
      b.r(x - rx * 0.55, y - ry * 0.6, 3, 2, hi); b.r(x + rx * 0.1, y - ry * 0.4, 2, 1, hi);
      b.r(x + rx * 0.3, y + ry * 0.2, 3, 2, d);
    }
    b.r(22, 0, 2, 5, d); b.oval(23, 3, 3, 2, m);
  });
  const shrub = (hue, rose) => prop(30, 22, (b) => {
    const [d, m, l, hi] = rose ? ["#26362c", "#3a5636", "#567644", "#7a9a5a"] : HUE[hue].leaf;
    b.oval(15, 13, 14, 9, d); b.oval(13, 11, 12, 8, m); b.oval(21, 10, 7, 6, m); b.oval(10, 8, 7, 4, l); b.r(7, 5, 3, 1, hi);
    b.r(14, 15, 3, 2, d); b.r(21, 13, 3, 2, d); b.r(6, 14, 2, 1, d);
    // the graveyard's roses: blood-red heads, thorns gone violet with the blight
    if (rose) {
      for (const [x, y] of [[5, 10], [13, 6], [22, 7], [10, 14], [19, 14]]) { b.r(x, y, 3, 3, "#b01e34"); b.r(x, y, 1, 1, "#ec5a6a"); b.r(x + 1, y + 1, 1, 1, "#5a0a1a"); }
      for (const [x, y] of [[2, 15], [27, 11], [16, 18]]) { b.r(x, y, 1, 3, BL); b.r(x, y, 1, 1, BLL); }
    }
  });
  const grave = (v) => prop(18, 26, (b) => {
    const s = STONE, L = v ? 2 : -2;
    b.oval(9, 23, 9, 3, "#5a4634"); b.oval(9, 22, 7, 2, "#6e5a3e");
    b.tri([[4, 23], [15, 23], [15 + L, 8], [4 + L, 8]], s[1]);
    b.oval(9.5 + L, 8, 5.5, 5, s[1]); b.r(4 + L, 8, 2, 13, s[0]); b.oval(7 + L, 6, 3, 2, s[0]); b.r(13 + L, 9, 2, 13, s[2]);
    b.r(7 + L, 11, 6, 1, s[2]); b.r(9 + L, 9, 2, 7, s[2]);
    b.r(3, 19, 5, 3, MOSS); b.r(12, 20, 3, 2, MOSS);
    if (v) { b.r(14 + L, 14, 1, 4, BL); b.r(13 + L, 17, 1, 1, BLL); }
  });
  const banner = (v) => prop(22, 52, (b) => {
    b.r(4, 2, 2, 49, "#5a4a3a"); b.r(5, 2, 1, 49, "#3a2e26"); b.r(2, 0, 6, 3, "#c8a050"); b.r(1, 49, 8, 3, "#5a5248");
    b.r(6, 5, 14, 2, "#5a4a3a");
    const blue = "#34508e", blueD = "#203266", gold = "#d8b050";
    b.r(7, 7, 12, 26, blue); b.r(16, 7, 3, 26, blueD);
    for (let x = 7; x < 19; x += 2) b.r(x, 33, 2, ((x * 7) % 5) + (v ? 2 : 0), (x >> 1) % 2 ? blue : blueD);
    b.r(7, 7, 12, 2, gold);
    b.r(10, 14, 6, 2, gold); b.r(10, 12, 1, 2, gold); b.r(12, 11, 2, 3, gold); b.r(15, 12, 1, 2, gold);
    b.r(11, 19, 4, 5, gold); b.r(12, 20, 2, 3, blueD);
    if (v) { b.r(8, 24, 3, 4, "#4a2a52"); b.r(9, 25, 1, 1, BL); b.r(15, 28, 2, 3, blueD); }
  });
  const statue = prop(26, 50, (b) => {
    const s = STONE;
    b.r(1, 40, 24, 10, s[1]); b.r(1, 40, 24, 2, s[3]); b.r(19, 42, 6, 8, s[2]); b.r(1, 47, 24, 3, s[2]);
    b.tri([[5, 40], [21, 40], [18, 18], [8, 18]], s[1]); b.tri([[14, 40], [21, 40], [18, 18], [14, 18]], s[2]); b.r(8, 18, 3, 22, s[0]);
    b.r(6, 15, 14, 5, s[1]); b.r(6, 15, 4, 5, s[0]); b.r(17, 15, 3, 5, s[2]);
    b.oval(13, 10, 4.5, 5, s[1]); b.oval(12, 9, 2.5, 3, s[0]); b.r(15, 8, 2, 6, s[2]);
    b.r(8, 3, 10, 3, "#b89a54"); for (const x of [8, 12, 16]) b.r(x, 0, 2, 3, "#b89a54"); b.r(8, 5, 10, 1, "#7a6034");
    b.r(12, 21, 3, 3, s[3]); b.r(13, 24, 1, 8, s[3]); b.r(10, 21, 7, 1, s[2]);
    b.r(2, 37, 6, 3, MOSS); b.r(20, 36, 3, 4, MOSS); b.r(16, 26, 1, 6, s[2]); b.r(17, 31, 1, 3, s[2]);
    b.r(4, 43, 1, 4, BL); b.r(5, 42, 3, 1, BL); b.r(7, 41, 1, 1, BLL);
  });
  const rubble = prop(32, 26, (b) => {
    for (const [x, y, w, h] of [[1, 12, 12, 12], [11, 5, 14, 19], [20, 13, 11, 11]]) { b.r(x, y, w, h, STONE[1]); b.r(x, y, w, 2, STONE[3]); b.r(x + w - 3, y + 2, 3, h - 2, STONE[2]); }
    b.r(5, 10, 5, 3, MOSS); b.r(14, 4, 4, 2, MOSS); b.r(2, 23, 28, 2, STONE[2]);
  });
  // a dead tree whose bark has opened an eye
  const eyetree = (v) => prop(40, 58, (b) => {
    const bk = "#5a4a50", dark = "#3a2e38", lit = "#7a6a6c";
    const br = (x0, y0, x1, y1, w) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) b.r(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, w, bk); };
    b.r(17, 24, 7, 32, bk); b.r(21, 24, 3, 32, dark); b.r(17, 24, 1, 32, lit);
    b.r(12, 53, 17, 4, bk); b.r(10, 55, 4, 2, dark); b.r(27, 55, 5, 2, dark);
    if (v) { br(19, 30, 5, 13, 3); br(6, 15, 2, 5, 2); br(21, 27, 34, 10, 3); br(32, 12, 37, 3, 2); br(20, 25, 22, 2, 3); }
    else { br(19, 28, 7, 10, 3); br(9, 12, 9, 2, 2); br(21, 30, 35, 16, 3); br(33, 17, 38, 8, 2); br(20, 25, 16, 3, 3); }
    b.oval(20, 38, 4, 3, "#2a1a2e"); b.oval(20, 38, 3, 2, "#f0e4d8"); b.r(20, 37, 2, 2, "#7a1a3a"); b.r(20, 37, 1, 1, "#1a0a14");
    for (const [x, y] of [[18, 44], [22, 31], [19, 50]]) { b.r(x, y, 1, 3, BL); b.r(x + 1, y + 2, 1, 1, BLL); }
  });
  // the blight's fruit: a violet cap with pale spots like eyes
  const toad = prop(30, 32, (b) => {
    const cap = "#7a3a9a";
    b.r(12, 15, 7, 15, "#e4d8cc"); b.r(16, 15, 3, 15, "#b8a89c"); b.r(10, 28, 11, 3, "#e4d8cc");
    b.oval(15, 12, 14, 8, "#4a2060"); b.oval(15, 10, 14, 8, cap); b.oval(10, 7, 6, 3.4, "#a466c8");
    b.r(4, 16, 22, 2, "#c8b0d8");
    for (const [x, y] of [[6, 9], [15, 5], [21, 9], [11, 12]]) { b.r(x, y, 3, 2, "#f0e4ff"); b.r(x + 1, y, 1, 1, "#2a1030"); }
    b.r(24, 25, 2, 6, "#e4d8cc"); b.oval(25, 24, 4, 2.6, cap); b.r(24, 23, 1, 1, BLL);
  });
  return {
    T: [0, 1, 2, 3].map((k) => [round(k), maple(k)]),
    B: [shrub(0), shrub(1), shrub(2), shrub(0, true)],
    J: [grave(0), grave(1)], V: [banner(0), banner(1)], z: statue,
    N: rubble, d: rubble, i: rubble, f: rubble,
    A: [eyetree(0), eyetree(1)], toad,
  };
}

// ── barriers that run on: cliffs, hedges and ruined walls are built from joined pieces
export const WALL = {
  // a raised ledge: grass on top, a rim of pale rock where it is lit, a rock face to the south
  C(b, o, grass) {
    const rock = "#c6bc9c", mid = "#a1967a", dark = "#776c56";
    // the top is bare rock, with a tuft or a patch of moss that the ground below lends it
    b.r(0, 0, 32, 32, "#b4aa8c");
    if (o.v) { b.r(7, 9, 6, 1, mid); b.r(12, 10, 3, 1, mid); b.r(19, 20, 5, 3, grass); b.r(20, 19, 3, 1, lt(grass, 1.2)); b.r(24, 8, 2, 2, rock); }
    else { b.r(17, 8, 5, 3, grass); b.r(18, 7, 3, 1, lt(grass, 1.2)); b.r(6, 20, 7, 1, mid); b.r(8, 21, 3, 1, mid); b.r(24, 24, 2, 2, rock); }
    if (!o.n) { b.r(0, 0, 32, 4, rock); b.r(0, 0, 32, 1, lt(rock, 1.14)); b.r(0, 4, 32, 1, mid); }
    if (!o.w) { b.r(0, 0, 4, 32, rock); b.r(0, 0, 1, 32, lt(rock, 1.14)); if (!o.n) b.r(0, 0, 4, 4, lt(rock, 1.08)); }
    if (!o.e) { b.r(28, 0, 4, 32, mid); b.r(27, o.n ? 0 : 4, 1, 32, dark); }
    if (!o.s) {
      b.r(0, 28, 32, 4, rock); b.r(0, 27, 32, 1, mid);
      b.r(0, 32, 32, 14, mid); b.r(0, 32, 32, 3, "#b5ab8c"); b.r(0, 42, 32, 4, dark);
      const k = o.v ? 9 : 0;
      b.r(5 + k, 35, 1, 6, dark); b.r(6 + k, 39, 2, 1, dark); b.r(22 - k, 36, 1, 5, dark); b.r(12, 38, 7, 1, "#8c8168"); b.r(26 - k, 34, 3, 1, "#b5ab8c");
      if (!o.e) b.r(28, 32, 4, 14, dark);
    }
  },
  // a clipped hedge
  H(b, o) {
    const leaf = "#4aa552", lit = "#6ac060", deep = "#33863f";
    b.r(0, 0, 32, 32, leaf);
    b.oval(9, 9, 6, 4, lit); b.oval(23, 20, 6, 4, lit); b.oval(21, 7, 4, 3, deep); b.oval(8, 23, 5, 3, deep);
    for (const [x, y] of o.v ? [[15, 15], [4, 16], [27, 12], [16, 26]] : [[14, 18], [5, 4], [26, 28], [17, 3]]) { b.r(x, y, 3, 2, deep); b.r(x + 1, y - 1, 2, 1, lit); }
    if (!o.n) b.r(0, 0, 32, 2, "#84d474");
    if (!o.w) b.r(0, 0, 2, 32, lit);
    if (!o.e) b.r(30, 0, 2, 32, deep);
    if (!o.s) {
      b.r(0, 29, 32, 17, deep); b.r(0, 29, 32, 2, leaf);
      for (let i = 0; i < 5; i++) { b.r(2 + i * 6, 34 + (i % 2) * 5, 3, 2, leaf); b.r(4 + i * 6, 38 - (i % 2) * 4, 2, 1, "#256a32"); }
      b.r(0, 43, 32, 3, "#256a32");
    }
  },
  // a wall of dressed stone, long since fallen in
  U(b, o) {
    const top = "#cbc6b6", lit = "#e2decf", face = "#9c9686", dark = "#726c5e";
    b.r(0, 0, 32, 32, top);
    b.r(0, 15, 32, 1, "#aaa494"); b.r(15, 0, 1, 15, "#aaa494"); b.r(8, 16, 1, 16, "#aaa494"); b.r(24, 16, 1, 16, "#aaa494");
    if (o.v) { b.oval(10, 8, 5, 3, "#7ab868"); b.r(20, 22, 5, 2, "#6aa85a"); b.r(3, 26, 3, 2, "#aaa494"); } else { b.r(20, 5, 5, 3, "#b8b2a2"); b.r(4, 21, 2, 4, "#aaa494"); }
    if (!o.n) b.r(0, 0, 32, 2, lit);
    if (!o.w) b.r(0, 0, 2, 32, lit);
    if (!o.e) b.r(30, 0, 2, 32, "#aaa494");
    if (!o.s) {
      b.r(0, 30, 32, 16, face); b.r(0, 30, 32, 2, "#bcb6a6"); b.r(0, 37, 32, 1, dark);
      for (const x of [10, 26]) b.r(x, 32, 1, 5, dark);
      for (const x of [4, 18]) b.r(x, 38, 1, 6, dark);
      b.r(0, 44, 32, 2, dark);
      if (o.v) { b.r(22, 32, 4, 3, "#6aa85a"); b.r(23, 35, 2, 2, "#6aa85a"); }
    }
  },
};
const wallCache = new Map();
/** One piece of a barrier. `mask` says which neighbours are the same thing: 1 north, 2 east, 4 south, 8 west. */
function wallPiece(kind, mask, v, grass) {
  const key = kind + mask + v + grass;
  let c = wallCache.get(key);
  if (c) return c;
  const o = { n: mask & 1, e: mask & 2, s: mask & 4, w: mask & 8, v };
  // no margin — so no outline — on a side that joins the next piece
  const padL = o.w ? 0 : 2, padR = o.e ? 0 : 2, padT = o.n ? 0 : 2, padB = o.s ? 0 : 2;
  const [cv2, x] = sheet(32 + padL + padR, (o.s ? 32 : 46) + padT + padB);
  x.translate(padL, padT);
  WALL[kind](tools(x), o, grass);
  x.setTransform(1, 0, 0, 1, 0, 0);
  c = ink(cv2, x);
  c.ax = (padR - padL) / 2; c.padT = padT;
  wallCache.set(key, c);
  return c;
}
