/**
 * Gathering art, drawn in code (life skills L2, docs/design/life-and-coop.md B.4/H2): the nodes that stand on
 * the hunting grounds — 약초 (a leafy clump), 광맥 (a rock with ore in it), 통나무 (a fallen log) — in each map
 * grade's look, ready and spent, and the 16×16 icons of the 재료 주머니's goods (herbs, ores, woods, ingots,
 * 식재료 꾸러미, 빈 병). Quarter view, light from the upper left, three flat tones per material and one dark
 * outline, no soft pixels. Every sprite is baked once and cached; only a glint and a work highlight move.
 */

const INK = "#2b2233";          // world sprites' outline (as dimart.js)
const ICON_INK = "#111118";     // item icons' outline (as art.js)
const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
function sheet(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
/** A one-pixel outline around everything drawn (4-neighbours), in `col`. */
function outline(c, g, col) {
  const w = c.width, h = c.height, src = g.getImageData(0, 0, w, h), d = src.data, out = g.createImageData(w, h);
  out.data.set(d);
  const R = parseInt(col.slice(1, 3), 16), Gc = parseInt(col.slice(3, 5), 16), B = parseInt(col.slice(5, 7), 16);
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3]) continue;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { out.data[i] = R; out.data[i + 1] = Gc; out.data[i + 2] = B; out.data[i + 3] = 255; }
  }
  g.putImageData(out, 0, 0);
  return c;
}
/** Rows of letters → pixels (`.` is empty), at (ox, oy). */
function rows(g, list, pal, ox = 0, oy = 0) {
  list.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const k = r[x]; if (k !== "." && pal[k]) px(g, ox + x, oy + y, 1, 1, pal[k]); } });
}

// ───────────────────────────── palettes by grade ─────────────────────────────
// grade 1 meadow · 2 forest/crypt · 3 city/sewer · 4 cave/abyss · 5 단풍 왕도 (12-life-tables.js LMAT)

/** Herb clumps: leaves dark/mid/light and the grade's crown (flowers, caps, glowing berries, crystals, red leaves). */
const HERB = [
  { leaf: ["#2f6a3a", "#4f9a48", "#8fd060"], top: ["#f4e48a", "#fff6c8", "#e89a3a"] },      // 들꽃잎
  { leaf: ["#3a5a2a", "#5a8a3a", "#8ab84a"], top: ["#7a2e2a", "#b8503a", "#f4e8d0"] },      // 이끼버섯
  { leaf: ["#1a4a40", "#2a6a5a", "#4a9a7a"], top: ["#2aa8a0", "#5af0e0", "#d0fff8"] },      // 형광 덩굴
  { leaf: ["#2f5a4a", "#4a8a6a", "#7ac09a"], top: ["#7a5ab8", "#b89ae8", "#f0e6ff"] },      // 수정꽃
  { leaf: ["#8a1e1e", "#d83a2a", "#f08a4a"], top: ["#7a1818", "#b82a22", "#ffc070"] },      // 붉은 단풍잎
];
/** Ore veins: the rock's top/front/side and the ore's dark/mid/bright. */
const ORE = [
  { rock: ["#9a8e7e", "#7a6e62", "#544a48"], ore: ["#8a4a22", "#d07a3a", "#ffc890"] },     // 구리 원석
  { rock: ["#8e8e96", "#6e6e7a", "#4a4a5a"], ore: ["#3a4a6a", "#8a9ab8", "#e8eef8"] },     // 철광석
  { rock: ["#6e6a74", "#54505e", "#3a3644"], ore: ["#a02a8a", "#f05ad0", "#7af0f0"] },     // 네온 고철
  { rock: ["#5e5870", "#463e5a", "#2e2842"], ore: ["#4a2e8a", "#9a6ae8", "#e0c8ff"] },     // 심연 결정
  { rock: ["#a89880", "#857660", "#5e5040"], ore: ["#9a9aae", "#dcdce8", "#ffe08a"] },     // 왕도 은괴석
];
/** Logs: bark top/front/underside, the cut face and its ring. */
const WOOD = [
  { bark: ["#b8a080", "#8a7458", "#5e4e3a"], face: ["#e8d4a8", "#b89868"], thin: true },   // 마른 가지
  { bark: ["#9a6a3e", "#74502e", "#4e3420"], face: ["#e8c890", "#b88a50"] },               // 참나무 목재
  { bark: ["#6a4a3a", "#4e342a", "#34221e"], face: ["#c8a070", "#8a6040"], sheen: "#8a6aa0" }, // 기름 먹은 판자
  { bark: ["#a8a4a0", "#807a78", "#5a5458"], face: ["#d8d0c4", "#9a9088"], crack: true },  // 화석 목재
  { bark: ["#8a4a30", "#6a3424", "#46221a"], face: ["#e8b890", "#b87050"], leaf: true },   // 단풍 고목
];
const gi = (grade) => Math.max(0, Math.min(4, (grade | 0) - 1));

// ───────────────────────────── world nodes ─────────────────────────────
// Each sprite's foot (the node's spot on the ground) is at (FOOT_X, FOOT_Y) of its canvas.
const W = 34, H = 30, FX = 17, FY = 24;
export const FOOT = [FX, FY];

/** A leafy clump with the grade's crown. */
function herbSprite(grade) {
  const P = HERB[gi(grade)], [c, g] = sheet(W, H), [dk, md, lt] = P.leaf, [t0, t1, t2] = P.top;
  const cx = FX, cy = FY;
  // the clump: a dark base, the mid body, lit tufts to the upper left, leaf tips poking out
  rows(g, [
    "....l..........l....",
    "...ll.m......m.ll...",
    "...lmmm..l..mmmm....",
    "..lmmmmmllmmmmmmm...",
    ".llmmmmmmmmmmmmmmd..",
    ".lmmmmmmmmmmmmmmmdd.",
    "lmmmmmmmmmmmmmmmmddd",
    "mmmmmmmmmmmmmmmdmddd",
    ".dmmmmmmmmmmmmddddd.",
    "..ddmmmddmmmdddddd..",
    "....dddddddddddd....",
  ], { l: lt, m: md, d: dk }, cx - 10, cy - 11);
  // clusters of light leaves and dark gaps inside the body
  rows(g, ["ll...", ".l..."], { l: lt }, cx - 6, cy - 7);
  rows(g, ["dd", ".d"], { d: dk }, cx + 2, cy - 5);
  rows(g, ["d.", "dd"], { d: dk }, cx - 3, cy - 3);
  const k = gi(grade);
  if (k === 0) {
    // three plus-shaped wildflowers (petals, a warm centre)
    for (const [x, y] of [[-5, -12], [2, -14], [6, -9]]) rows(g, [".a.", "aca", ".a."], { a: t1, c: t2 }, cx + x - 1, cy + y);
    px(g, cx - 4, cy - 10, 1, 1, t0); px(g, cx + 7, cy - 7, 1, 1, t0);
  } else if (k === 1) {
    // two mushroom caps out of the moss, white spots on red-brown
    rows(g, [".bbbb.", "bbwbbb", "aaaaaa", "..ss.."], { a: t0, b: t1, w: t2, s: "#e8dcc0" }, cx - 6, cy - 14);
    rows(g, [".bbb.", "bwbbb", "aaaaa", "..s.."], { a: t0, b: t1, w: t2, s: "#e8dcc0" }, cx + 2, cy - 12);
  } else if (k === 2) {
    // a curling vine and pairs of glowing berries
    rows(g, ["..vv.", ".v..v", ".v...", "..v.."], { v: md }, cx - 2, cy - 15);
    for (const [x, y] of [[-6, -11], [1, -15], [5, -10]]) rows(g, ["cb", "bb"], { b: t1, c: t2 }, cx + x, cy + y);
  } else if (k === 3) {
    // crystal petals: small diamonds, lit on their upper left
    for (const [x, y, s] of [[-5, -14, 0], [1, -17, 1], [6, -12, 0]]) {
      rows(g, s ? ["..a..", ".aab.", "aaabb", ".abb.", "..b.."] : [".a.", "aab", ".b."], { a: t1, b: t0 }, cx + x - (s ? 2 : 1), cy + y);
      px(g, cx + x - (s ? 1 : 0), cy + y + (s ? 1 : 0), 1, 1, t2);
    }
  } else {
    // a red sapling: points of maple leaves standing up out of the clump
    for (const [x, y] of [[-6, -13], [0, -16], [5, -12]]) rows(g, ["..a..", "a.a.a", "aabaa", ".abb.", "..b.."], { a: t2, b: t1 }, cx + x - 2, cy + y);
  }
  return outline(c, g, INK);
}
/** A herb picked: a low tuft of cut stalks. */
function herbSpent(grade) {
  const P = HERB[gi(grade)], [c, g] = sheet(W, H), [dk, md] = P.leaf;
  rows(g, [
    "..m..m...m..",
    "..m..m..mm..",
    ".dmd.md.md..",
    "dddddddddddd",
    ".dddddddddd.",
  ], { m: md, d: dk }, FX - 6, FY - 5);
  return outline(c, g, INK);
}

/** A rock of three planes (lit top, front, shaded side) with ore showing through; a pebble beside it. */
function oreSprite(grade, spent) {
  const P = ORE[gi(grade)], [c, g] = sheet(W, H), [tp, fr, sd] = P.rock, [o0, o1, o2] = P.ore;
  rows(g, [
    ".......TTTTTT...........",
    ".....TTTTTTTTTT.........",
    "....TTTTTTTTTTTTTS......",
    "...TTTTTTTTTTTTTTSS.....",
    "..TTTTTTTTTTTTTTTSSS....",
    ".FTTTTTTTTTTTTTTSSSSS...",
    ".FFTTTTTTTTTTTTSSSSSSS..",
    ".FFFFTTTTTTTTTSSSSSSSS..",
    "FFFFFFFFTTTTTSSSSSSSSSS.",
    "FFFFFFFFFFFFTSSSSSSSSSS.",
    "FFFFFFFFFFFFSSSSSSSSSSS.",
    "FFFFFFFFFFFFSSSSSSSSSSS.",
    ".FFFFFFFFFFFSSSSSSSSSS..",
    "..FFFFFFFFFFSSSSSSSSS...",
    "....FFFFFFFFSSSSSSS.....",
  ], { T: tp, F: fr, S: sd }, FX - 13, FY - 15);
  // the pebble in front, to the right (an odd group: one big, one small)
  rows(g, ["..TT..", ".TTTS.", "FFTSSS", "FFFSS."], { T: tp, F: fr, S: sd }, FX + 8, FY - 4);
  // a crack in the darkest tone across the front
  rows(g, ["s...", ".s..", ".ss.", "...s"], { s: sd }, FX - 8, FY - 8);
  if (!spent) {
    // ore: clusters of two or three, a bright pixel on their upper left
    for (const [x, y, big] of [[-7, -13, 1], [0, -11, 0], [4, -7, 1], [-10, -6, 0], [-3, -4, 1]]) rows(g, big ? [".bm", "bmm", "mmo"] : ["bm", "mo"], { b: o2, m: o1, o: o0 }, FX + x, FY + y);
    if (gi(grade) === 3) {
      // the abyss's crystals jut out of the top
      rows(g, ["..b.", ".bm.", ".bmo", "bmmo", "bmmo"], { b: o2, m: o1, o: o0 }, FX - 6, FY - 20);
      rows(g, [".b.", "bmo", "bmo", "bmo"], { b: o2, m: o1, o: o0 }, FX + 1, FY - 18);
    }
  } else {
    // picked clean: pick marks where the ore was, and a little rubble
    for (const [x, y] of [[-7, -12], [0, -10], [-9, -5]]) rows(g, ["s.", ".s"], { s: sd }, FX + x, FY + y);
    rows(g, ["ff.f"], { f: fr }, FX - 15, FY - 1);
  }
  return outline(c, g, INK);
}

/**
 * One log along the ground's x axis (down-right on screen, 2:1), lit along its top, its cut end towards the
 * camera: an oval of pale wood with one darker ring.
 */
function oneLog(g, P, x0, y0, len, thick, bare) {
  const [tp, fr, sd] = P.bark, [face, ring] = P.face;
  for (let i = 0; i < len; i++) {
    const x = x0 + i, y = y0 + Math.floor(i / 2);
    px(g, x, y, 1, 1, tp);
    px(g, x, y + 1, 1, Math.max(1, thick - 3), fr);
    px(g, x, y + thick - 2, 1, 2, sd);
  }
  if (!bare) {
    // bark texture: dark dashes running with the log, an oily sheen, fossil cracks
    for (let i = 3; i < len - 3; i += 5) px(g, x0 + i, y0 + Math.floor(i / 2) + (thick > 4 ? 2 : 1), 2, 1, sd);
    if (P.sheen) for (let i = 2; i < len - 2; i += 3) px(g, x0 + i, y0 + Math.floor(i / 2) + 1, 2, 1, P.sheen);
    if (P.crack) { px(g, x0 + 7, y0 + 4, 1, 1, sd); px(g, x0 + 8, y0 + 5, 2, 1, sd); px(g, x0 + 13, y0 + 7, 2, 1, sd); }
  }
  const ex = x0 + len, ey = y0 + Math.floor(len / 2) + Math.floor(thick / 2) - 1;
  const ry = Math.max(2, Math.floor(thick / 2)), rx = Math.max(1, ry - 1);
  for (let y = -ry; y < ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - ((y + 0.5) / ry) ** 2))); px(g, ex - w, ey + y, w * 2 + 1, 1, face); }
  if (thick >= 6) { px(g, ex - 1, ey - 2, 3, 1, ring); px(g, ex - 2, ey - 1, 1, 2, ring); px(g, ex + 2, ey - 1, 1, 2, ring); px(g, ex - 1, ey + 1, 3, 1, ring); }
  else px(g, ex, ey - 1, 1, 1, ring);
}
/** A fallen log (or, grade 1, a pile of dry branches); spent = a short stump end and sawdust. */
function logSprite(grade, spent) {
  const P = WOOD[gi(grade)], [c, g] = sheet(W, H), [tp, fr] = P.bark, [face, ring] = P.face;
  if (spent) {
    oneLog(g, P, FX - 5, FY - 8, 6, P.thin ? 4 : 7, true);
    rows(g, ["ff..f"], { f: face }, FX - 9, FY + 1);
    rows(g, ["f", "f"], { f: ring }, FX + 6, FY - 1);
  } else if (P.thin) {
    // three dry branches heaped, each with a twig or two
    oneLog(g, P, FX - 12, FY - 13, 18, 4);
    oneLog(g, P, FX - 9, FY - 9, 16, 4);
    oneLog(g, P, FX - 14, FY - 7, 13, 4);
    px(g, FX - 6, FY - 15, 1, 2, fr); px(g, FX - 7, FY - 16, 1, 1, tp);
    px(g, FX + 1, FY - 9, 1, 2, fr); px(g, FX + 2, FY - 10, 1, 1, tp);
  } else {
    oneLog(g, P, FX - 13, FY - 15, 22, 8);
    // a stub of a branch on top; the maple's log keeps a sprig of red leaves
    px(g, FX - 6, FY - 15, 2, 2, fr); px(g, FX - 7, FY - 16, 2, 1, tp);
    if (P.leaf) rows(g, ["a.a.", "aaaa", ".ab.", "..b."], { a: "#f05a3a", b: "#a82a22" }, FX - 1, FY - 13);
  }
  return outline(c, g, INK);
}

// ── crops (H10 farm): a tilled ridge running along the row (tile x: +16, +8 on screen, so neighbours join up) and
// the plant on it, grown, or a sprout while it regrows for you. Crop c = 1 감자 · 2 당근 · 3 양배추 · 4 무 · 5 옥수수 · 6 호박.
const SOIL = ["#a8784a", "#7e5230", "#56361e"];
const LEAF = { d: "#2f6a3a", m: "#4f9a48", l: "#8fd060" };
const CROP_ART = [
  // 감자: a bushy potato plant in flower
  [["...w.l..w...", "..wyw.l.wyw.", "...wlmmlmw..", "..lmmmmmmml.", ".lmmdmmmdmml", ".mmmmdmmmmmd", "..dmmmmmmdd.", "...ddmmddd.."],
    { w: "#f6f0e0", y: "#f0c040" }],
  // 당근: feathery tops over an orange shoulder
  [["..l...l...l.", ".lml.lml.lml", "..m.l.m.l.m.", "...mm.m.mm..", "....mmmmm...", ".....mmm....", "....oOOo....", "....ooOo...."],
    { O: "#ff9a40", o: "#c85a18" }],
  // 양배추: a round pale head in its outer leaves
  [["...llllll...", "..lLLLLLLl..", ".lLLmLLmLLl.", "lmLLLmmLLLml", "mmlLLLLLLlmm", ".mmmllllmmm.", "..dmmmmmmd..", "....dddd...."],
    { L: "#d4f0a0" }],
  // 무: broad leaves and the white top of the root
  [["..m......m..", ".lml....lml.", ".lmml..lmml.", "..lmml.lml..", "...lmmlmm...", "....mmmm....", "....wWWw....", "....wWWw...."],
    { W: "#fbfbf2", w: "#c8ccbc" }],
  // 옥수수: a tall stalk, a tassel, a cob in its husk
  [["......t.....", ".....tTt....", "......s.....", "......s.....", "..l...s.....", "...l..sYy...", "....l.sYYh..", ".....lsYYh..", "......sYy...", "......s..l..", "..l...s.l...", "...l..sl....", "....l.s.....", ".....ls.....", "......s....."],
    { t: "#c8a050", T: "#f0d080", s: "#3f8a40", Y: "#ffe070", y: "#d0a020", h: "#8fd060" }],
  // 호박: a ribbed pumpkin under its vine leaves
  [["...l....l...", "..lml..lml..", ".lmmmlmmmml.", "..mm.ss.mm..", "...OOOoOOO..", "..OOOOoOOOo.", ".OoOOOoOOoOo", ".OoOOOoOOoOo", "..ooOOoOOoo.", "...oooooo..."],
    { O: "#f8962a", o: "#b8561a", s: "#3f6a2a" }],
];
/** A ridge of turned soil across the tile, lit on top, one shadow tone below. */
function ridge(g) {
  for (let t = -10; t <= 10; t++) {
    const x = FX + t, y = FY - 1 + Math.round(t / 2);
    px(g, x, y - 2, 1, 1, SOIL[0]); px(g, x, y - 1, 1, 2, SOIL[1]); px(g, x, y + 1, 1, 1, SOIL[2]);
  }
  // clods and a dimple of darker earth
  px(g, FX - 6, FY - 5, 1, 1, SOIL[2]); px(g, FX + 5, FY, 1, 1, SOIL[0]);
}
function cropSprite(c, spent) {
  const [list, pal] = CROP_ART[Math.max(0, Math.min(CROP_ART.length - 1, (c | 0) - 1))], [cv, g] = sheet(W, H);
  ridge(g);
  if (spent) rows(g, ["l.l", ".m."], LEAF, FX - 1, FY - 5);
  else rows(g, list, { ...LEAF, ...pal }, FX - 6, FY - 3 - list.length);
  return outline(cv, g, INK);
}

/** The baked sprite of a node: kind 0 herb · 1 ore · 2 log · 3 crop (grade = the crop); `spent` = picked by you. */
export function nodeSprite(kind, grade, spent) {
  if (kind === 3) return once(`n3.${grade}.${spent ? 1 : 0}`, () => cropSprite(grade, spent));
  return once(`n${kind}.${gi(grade)}.${spent ? 1 : 0}`, () => kind === 0 ? (spent ? herbSpent(grade) : herbSprite(grade))
    : kind === 1 ? oreSprite(grade, spent) : logSprite(grade, spent));
}

/** A dashed quarter-view diamond on the ground round the node you could gather now (blinks; no soft pixels). */
export function drawReach(g, t, sx, sy) {
  if (Math.floor(t / 420) % 3 === 2) return;
  g.fillStyle = "#ffe08a";
  const hw = 14, hh = 7;
  for (let i = 0; i <= hw; i += 2) {
    const dy = Math.round((i / hw) * hh);
    g.fillRect(sx - hw + i, sy - dy, 2, 1); g.fillRect(sx - hw + i, sy + dy, 2, 1);
    g.fillRect(sx + hw - i - 1, sy - dy, 2, 1); g.fillRect(sx + hw - i - 1, sy + dy, 2, 1);
  }
}
/** A four-pointed glint: small now and then on a ready node, big and bright at "반짝!". */
export function drawGlint(g, x, y, big) {
  x = Math.round(x); y = Math.round(y);
  const r = big ? 4 : 2;
  g.fillStyle = INK;
  g.fillRect(x - r - 1, y - 1, r * 2 + 3, 3); g.fillRect(x - 1, y - r - 1, 3, r * 2 + 3);
  g.fillStyle = big ? "#fff2a0" : "#fffbe8";
  g.fillRect(x - r, y, r * 2 + 1, 1); g.fillRect(x, y - r, 1, r * 2 + 1);
  if (big) { g.fillStyle = "#ffffff"; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
}
/** A gatherer's little channel bar over their head (others; your own is the HUD's #cast). */
export function drawBar(g, x, y, k, col) {
  x = Math.round(x - 9); y = Math.round(y);
  g.fillStyle = INK; g.fillRect(x, y, 18, 4);
  g.fillStyle = "#3a3444"; g.fillRect(x + 1, y + 1, 16, 2);
  g.fillStyle = col; g.fillRect(x + 1, y + 1, Math.round(16 * Math.max(0, Math.min(1, k))), 2);
}
/** Each kind's colour (bars, chips flying off the work). */
export const KIND_COL = ["#8fd060", "#d07a3a", "#c8a070", "#a8784a"];

// ───────────────────────────── item icons (16×16) ─────────────────────────────

function icon(list, pal) {
  const [c, g] = sheet(16, 16);
  rows(g, list, pal, 1, 1);
  return outline(c, g, ICON_INK);
}
const HERB_ICON = [
  // 들꽃잎: a sprig of three wildflowers
  [["..........a...", "...a.....aca..", "..aca.....a...", "...a......m...", "...m.....m....", "...m....m.a...", "...m...m.aca..", ".l.m..m...a...", "llmm.m...m....", ".lmmm...m.....", "...mmmmm......", "....mmm.......", "....dmd.......", ".....d........"],
    (P) => ({ a: P.top[1], c: P.top[2], m: P.leaf[1], l: P.leaf[2], d: P.leaf[0] })],
  // 이끼버섯: two caps on a mound of moss
  [["..............", "....bbbb......", "...bwbbwb.....", "..bbbbbbbb....", "..aaaaaaaa....", ".....ss...bb..", ".....sS..bwbb.", ".....sS.aaaaa.", ".....sS...sS..", "..llmsSmll.sS.", ".lmmmmmmmmmmml", ".mmmmmmmmmmmmd", "..dmmmmmmmmdd.", "....dddddd...."],
    (P) => ({ a: P.top[0], b: P.top[1], w: P.top[2], s: "#e8dcc0", S: "#b8a888", m: P.leaf[1], l: P.leaf[2], d: P.leaf[0] })],
  // 형광 덩굴: a curl of vine hung with glowing berries
  [["......VVV.....", ".....V...V....", "....V..cC.V...", "....V..cc.V...", ".....V...V....", "..cC..VVV.....", "..cc...V..kk..", "......V..kVVk.", ".....V..kVk...", "..kk.V...V.cC.", ".kVVkV...V.cc.", "..kVVV..V.....", "....vVVV......", ".....vv......."],
    (P) => ({ V: P.leaf[2], v: P.leaf[1], k: P.leaf[0], c: P.top[1], C: P.top[2] })],
  // 수정꽃: crystal petals round a white heart
  [["......P.......", ".....PPp......", "..P..PPp..p...", "..PP.Ppq.pp...", "...PPpWpppq...", "....pWWWq.....", "..PPpWWWppq...", "...ppqpqqq....", "....q.m.q.....", "......m.......", "...mm.m.......", "...mmmm..m....", ".....mm.mm....", "......dd......"],
    (P) => ({ P: P.top[2], p: P.top[1], q: P.top[0], W: "#ffffff", m: P.leaf[1], d: P.leaf[0] })],
  // 붉은 단풍잎: one five-pointed leaf on its stalk
  [["......O.......", "......OR......", "..O..ORR..O...", "..OO.ORR.RR...", "...ORORRRRr...", "O..ORRRRRr..R.", ".OOORRRRRRRRr.", "..ORRRRRRRRr..", "...ORRRRRRr...", "..ORRRRRRRRr..", ".....rRrr.....", "......b.......", "......b.......", ".....b........"],
    () => ({ O: "#f08a4a", R: "#d83a2a", r: "#8a1e1e", b: "#7a3a20" })],
];
const NUGGET = ["..............", "..............", ".....TTTT.....", "...TTTTTTTT...", "..TTTbmTTTTS..", ".FTTTmoTbmSS..", ".FFFTTTTmoSSS.", ".FbmFFFFSSbmS.", ".FmoFFFFSSmoS.", ".FFFFbmFFSSSS.", "..FFFmoFFSSS..", "...FFFFFFSS...", "..............", ".............."];
const LOG = ["..............", "..............", ".TT...........", "TTTTT.........", "FTTTTTT.......", "FFFTTTTTT.....", ".FFFFTTTTTee..", "..SFFFFTTeccS.", "...SSFFFFcRcS.", "....SSSFFcccS.", "......SSSScS..", "........SSS...", "..............", ".............."];
const TWIGS = ["..............", ".T..........T.", "..T.......TT..", "..FT.....TF...", "...FT...TF....", "....FT.TF.....", ".....FrF......", ".....rFr......", "....TF.FT.....", "...TF...FT....", "..TF.....FT...", ".TF.......FS..", ".S.........S..", ".............."];
const PLANK = ["..............", "..............", "..........TT..", "........TTTTS.", "......TxTTTSS.", "....TTTTTxSS..", "..TxTTTTTSS...", ".TTTTxTTSS....", ".FTTTTTSS.....", ".FFFTTSS......", "..FFFSS.......", "...FFS........", "..............", ".............."];
const INGOT = ["..............", "..............", "..............", "..............", "....TTTTTTT...", "...TXTTTTTTS..", "..TTTTTTTTSS..", ".FFFFFFFFFSSS.", ".FFFFFFFFFSSS.", ".FFFFFFFFFSS..", ".FFFFFFFFFS...", "..............", "..............", ".............."];
const STAPLE = ["..............", ".....L..L.....", "....LBLBB.....", ".....tttt.....", "....BLBBBb....", "...BLLBBBBb...", "..BLLBBBBBBb..", "..BLBBBBBBBb..", ".BLBBBBBBBBbb.", ".BBBBBBBBBBbb.", ".BBBBBBBBBbbb.", "..bBBBBBBbbb..", "...bbbbbbbb...", ".............."];
const FLASK = ["..............", ".....kkk......", ".....kKK......", ".....aAs......", ".....aAs......", "....aAees.....", "...aAeeeas....", "..aAeeeeeas...", "..aAeeeeeas...", "..aeeeeeeas...", "..aeeeeeeas...", "..aseeeeess...", "...ssssssss...", ".............."];
/** Ingots by grade: dark, mid, light and a bright corner. */
const ING = [["#8a4a22", "#c06a32", "#f0a060", "#ffe0b0"], ["#4a4e5e", "#7a8090", "#b8c0d0", "#f4f8ff"], ["#7a2a7a", "#c04ab8", "#f08ae8", "#a8ffff"], ["#3a2a6a", "#6a4ab0", "#a888f0", "#ece0ff"], ["#8a8a9e", "#c0c0d0", "#ececf6", "#ffe08a"]];

/**
 * The icon of a pouch good (art.js buildIcons asks): `it` is the item ({type:"lmat", mk, grade} or staple/flask).
 * Returns null for anything else.
 */
export function matIcon(id, it) {
  if (id === "staple") return once("i.staple", () => icon(STAPLE, { L: "#f4e4c0", B: "#d8c098", b: "#a08860", t: "#b8503a" }));
  if (id === "flask") return once("i.flask", () => icon(FLASK, { k: "#a87a4a", K: "#7a5030", a: "#9ac8e0", A: "#e0f4ff", s: "#5a8aa8", e: "#c8e4f0" }));
  if (!it || it.type !== "lmat" || it.mk === "c") return null;   // crops: lifeicons.js
  const k = gi(it.grade);
  return once(`i.${id}`, () => {
    if (it.mk === "h") { const [list, pal] = HERB_ICON[k]; return icon(list, pal(HERB[k])); }
    if (it.mk === "o") { const P = ORE[k]; return icon(NUGGET, { T: P.rock[0], F: P.rock[1], S: P.rock[2], b: P.ore[2], m: P.ore[1], o: P.ore[0] }); }
    if (it.mk === "w") {
      const P = WOOD[k], pal = { T: P.bark[0], F: P.bark[1], S: P.bark[2], c: P.face[0], R: P.face[1], e: P.bark[0], r: P.bark[2], x: P.sheen || P.bark[2] };
      return icon(k === 0 ? TWIGS : k === 2 ? PLANK : LOG, pal);
    }
    const q = ING[k];
    return icon(INGOT, { S: q[0], F: q[1], T: q[2], X: q[3] });
  });
}
