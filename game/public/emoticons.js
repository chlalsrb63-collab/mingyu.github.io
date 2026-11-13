/**
 * Pixel emoticons, 16×16: round faces built from a shared head plus eyes, a
 * mouth and an extra, and a handful of symbols drawn as grids. In chat they are
 * written as a word in brackets — "(웃음)" — and drawn as the picture.
 */
const K = "#2b2233";                       // outline and features
const FACE = ["#ffd75a", "#e8a838", "#fff4b8"];   // fill, shade, highlight

/** Feature pixels, as [x, y] lists, drawn in the colour given. */
const EYES = {
  dot: [[5, 6], [5, 7], [10, 6], [10, 7]],
  happy: [[4, 7], [5, 6], [6, 7], [9, 7], [10, 6], [11, 7]],
  shut: [[4, 7], [5, 7], [6, 7], [9, 7], [10, 7], [11, 7]],
  wink: [[4, 7], [5, 6], [6, 7], [10, 6], [10, 7]],
  wide: [[4, 5], [5, 5], [4, 6], [5, 6], [4, 7], [5, 7], [10, 5], [11, 5], [10, 6], [11, 6], [10, 7], [11, 7]],
  cross: [[4, 5], [6, 5], [5, 6], [4, 7], [6, 7], [9, 5], [11, 5], [10, 6], [9, 7], [11, 7]],
  angry: [[4, 5], [5, 6], [6, 6], [5, 7], [11, 5], [10, 6], [9, 6], [10, 7]],
  sad: [[4, 6], [5, 5], [6, 5], [5, 7], [11, 6], [10, 5], [9, 5], [10, 7]],
  spiral: [[4, 5], [5, 5], [6, 5], [6, 6], [6, 7], [5, 7], [4, 7], [4, 6], [9, 5], [10, 5], [11, 5], [11, 6], [11, 7], [10, 7], [9, 7], [9, 6]],
};
const MOUTH = {
  smile: [[5, 10], [6, 11], [7, 11], [8, 11], [9, 11], [10, 10]],
  grin: [[5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [6, 11], [7, 11], [8, 11], [9, 11], [7, 12], [8, 12]],
  frown: [[5, 12], [6, 11], [7, 11], [8, 11], [9, 11], [10, 12]],
  o: [[7, 10], [8, 10], [6, 11], [9, 11], [7, 12], [8, 12]],
  flat: [[6, 11], [7, 11], [8, 11], [9, 11]],
  wavy: [[5, 11], [6, 10], [7, 11], [8, 10], [9, 11], [10, 10]],
  cat: [[5, 10], [6, 11], [7, 10], [8, 10], [9, 11], [10, 10]],
};

/** Symbols: `.` is clear, every other character is a colour from the legend. */
const GRID = {
  heart: { pal: { k: K, r: "#e8405a", l: "#ff9aa8" }, rows: [
    "................", "..kkk....kkk....", ".krrrk..krrrk...", "krlrrrkkrrrrrk..", "krllrrrrrrrrrk..", "krlrrrrrrrrrrk..", "krrrrrrrrrrrrk..", ".krrrrrrrrrrk...",
    "..krrrrrrrrk....", "...krrrrrrk.....", "....krrrrk......", ".....krrk.......", "......kk........", "................", "................", "................"] },
  broken: { pal: { k: K, r: "#a83848", l: "#d8707e" }, rows: [
    "................", "..kkk....kkk....", ".krrrk..krrrk...", "krlrrrkkrrrrrk..", "krlrrrk.krrrrk..", "krrrrrrk.krrrk..", "krrrrrk.krrrrk..", ".krrrrrk.krrk...",
    "..krrrk.krrk....", "...krrrk.rk.....", "....krrk.k......", ".....krk........", "......k.........", "................", "................", "................"] },
  star: { pal: { k: K, y: "#ffd75a", w: "#fff8d0", o: "#e8a838" }, rows: [
    ".......kk.......", "......kyyk......", "......kyyk......", ".....kywyyk.....", "kkkkkkywyyykkkkk", "kyyyyyyyyyyyyyyk", ".kyyyyyyyyyyyyk.", "..kyyyyyyyyyyk..",
    "...kyyyyyyyyk...", "...kyyyooyyyk...", "..kyyyokkoyyyk..", "..kyyokk.koyyk..", ".kyyok....koyyk.", ".kook......kook.", ".kk..........kk.", "................"] },
  note: { pal: { k: K, b: "#6a9cff" }, rows: [
    "................", "......kkkkkkkk..", "......kbbbbbbk..", "......kkkkkkkk..", "......k......k..", "......k......k..", "......k......k..", "......k......k..",
    "......k......k..", "..kkkkk..kkkkk..", ".kbbbbk.kbbbbk..", ".kbbbbk.kbbbbk..", ".kbbbbk.kbbbbk..", "..kkkk...kkkk...", "................", "................"] },
  bang: { pal: { k: K, r: "#ff6a4a" }, rows: [
    "......kkkk......", "......krrk......", "......krrk......", "......krrk......", "......krrk......", "......krrk......", "......krrk......", "......krrk......",
    "......krrk......", "......kkkk......", "................", "......kkkk......", "......krrk......", "......krrk......", "......kkkk......", "................"] },
  ask: { pal: { k: K, b: "#6ad0ff" }, rows: [
    "....kkkkkkk.....", "...kbbbbbbbk....", "..kbbkkkkkbbk...", "..kbk.....kbk...", "..kkk.....kbk...", "..........kbk...", ".........kbbk...", "........kbbk....",
    ".......kbbk.....", "......kbbk......", "......kbbk......", "......kkkk......", "................", "......kkkk......", "......kbbk......", "......kkkk......"] },
  thumb: { pal: { k: K, s: "#ffd75a", d: "#e8a838" }, rows: [
    "......kk........", ".....kssk.......", ".....kssk.......", "....kssk........", "...kssk.........", "kkkkssskkkkk....", "kssksssssssk....", "kssksssssssk....",
    "kssksssskkkk....", "kssksssssssk....", "kssksssskkkk....", "kssksssssssk....", "kssksssskkkk....", "kdsksssssssk....", "kkkkkkkkkkk.....", "................"] },
  flower: { pal: { k: K, p: "#ff9ac8", y: "#ffd75a", g: "#5ab85a" }, rows: [
    "................", ".....kkkkk......", "....kpppppk.....", "..kkkpppppkkk...", ".kpppkyyykpppk..", ".kpppkyyykpppk..", ".kpppkyyykpppk..", "..kkkpppppkkk...",
    "....kpppppk.....", ".....kkgkk......", "...kk..kg.......", "..kgggkkg.......", "...kkggkg.......", ".......kg.......", ".......kk.......", "................"] },
  skull: { pal: { k: K, w: "#eee8d8", g: "#b8b0a0" }, rows: [
    "................", "....kkkkkkkk....", "...kwwwwwwwwk...", "..kwwwwwwwwwwk..", "..kwwwwwwwwwwk..", "..kwkkkwwkkkwk..", "..kwkkkwwkkkwk..", "..kwkkkwwkkkwk..",
    "..kwwwwkkwwwwk..", "...kwwwwwwwwk...", "....kgwgwgwk....", "....kwkwkwkk....", ".....kkkkkk.....", "................", "................", "................"] },
  fire: { pal: { k: K, r: "#ff5a3a", o: "#ffa030", y: "#fff080" }, rows: [
    "........k.......", ".......krk......", "......krrk......", "......krrk..k...", ".....krrrk.krk..", "....krrrrrkrrk..", "...krrorrrrrrk..", "...krooorrrrrk..",
    "..krroooorrrrk..", "..kroooyoorrrk..", "..krooyyyoorrk..", "..krooyyyyoork..", "...kroyyyyork...", "....kkkkkkkk....", "................", "................"] },
  sparkle: { pal: { k: K, y: "#fff080", w: "#ffffff" }, rows: [
    "................", ".......k........", "......kyk.......", "......kyk.......", ".....kywyk......", "..kkkkywykkkk...", ".kyyyywwwyyyyk..", "..kkkkywykkkk...",
    ".....kywyk......", "......kyk....k..", "......kyk...kyk.", ".......k...kywyk", "............kyk.", ".............k..", "................", "................"] },
};

/**
 * Every emoticon: its key, the word written in chat, and how it is drawn —
 * either a face [eyes, mouth, extras…] or a symbol grid.
 */
export const EMO = [
  ["smile", "웃음", ["happy", "smile"]],
  ["grin", "히히", ["happy", "grin", "blush"]],
  ["lol", "크크", ["shut", "grin", "tears"]],
  ["love", "반함", ["hearts", "smile", "blush"]],
  ["wink", "윙크", ["wink", "smile"]],
  ["cry", "엉엉", ["sad", "frown", "tears"]],
  ["angry", "화남", ["angry", "frown", "red"]],
  ["shock", "헉", ["wide", "o"]],
  ["sweat", "땀", ["dot", "flat", "drop"]],
  ["sleep", "졸려", ["shut", "flat", "zz"]],
  ["dizzy", "어지러", ["spiral", "wavy"]],
  ["sick", "으엑", ["cross", "wavy", "green"]],
  ["cool", "멋짐", ["shades", "smile"]],
  ["cat", "냥", ["happy", "cat", "ears"]],
  ["heart", "하트", "heart"],
  ["broken", "상심", "broken"],
  ["star", "별", "star"],
  ["note", "음표", "note"],
  ["bang", "느낌표", "bang"],
  ["ask", "물음표", "ask"],
  ["thumb", "최고", "thumb"],
  ["flower", "꽃", "flower"],
  ["skull", "해골", "skull"],
  ["fire", "불꽃", "fire"],
  ["sparkle", "반짝", "sparkle"],
];
export const COUNT = EMO.length;
const byWord = new Map(EMO.map((e, i) => [e[1], i]));
/** The chat token for emoticon `i`, e.g. "(웃음)". */
export const token = (i) => `(${EMO[i][1]})`;

function face(g, parts) {
  const [fill, shade, light] = parts.includes("red") ? ["#ff8a6a", "#e05a4a", "#ffc0a8"] : parts.includes("green") ? ["#b8e070", "#88b850", "#e0f8b0"] : FACE;
  const solid = (x, y) => Math.hypot(x - 7.5, y - 8) <= 6.9;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (solid(x, y)) {
      g.fillStyle = x + y > 17 && Math.hypot(x - 7.5, y - 8) > 4.2 ? shade : fill;
      g.fillRect(x, y, 1, 1);
    } else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) { g.fillStyle = K; g.fillRect(x, y, 1, 1); }
  }
  g.fillStyle = light; g.fillRect(4, 3, 2, 1); g.fillRect(3, 4, 1, 2);
  if (parts.includes("ears")) { g.fillStyle = K; g.fillRect(2, 1, 1, 3); g.fillRect(3, 1, 1, 1); g.fillRect(13, 1, 1, 3); g.fillRect(12, 1, 1, 1); g.fillStyle = fill; g.fillRect(3, 2, 1, 1); g.fillRect(12, 2, 1, 1); }
  const put = (list, col) => { g.fillStyle = col; for (const [x, y] of list) g.fillRect(x, y, 1, 1); };
  for (const p of parts) {
    if (EYES[p]) put(EYES[p], K);
    if (MOUTH[p]) put(MOUTH[p], K);
  }
  if (parts.includes("grin")) put([[7, 11], [8, 11]], "#e8405a");
  if (parts.includes("hearts")) put([[4, 5], [6, 5], [4, 6], [5, 6], [6, 6], [5, 7], [9, 5], [11, 5], [9, 6], [10, 6], [11, 6], [10, 7]], "#e8405a");
  if (parts.includes("shades")) { put([[3, 6], [4, 6], [5, 6], [6, 6], [9, 6], [10, 6], [11, 6], [12, 6], [4, 7], [5, 7], [10, 7], [11, 7], [7, 6], [8, 6]], K); put([[4, 6], [10, 6]], "#8a9ab8"); }
  if (parts.includes("blush")) put([[3, 9], [4, 9], [11, 9], [12, 9]], "#ff8aa0");
  if (parts.includes("tears")) put([[4, 8], [4, 9], [3, 10], [11, 8], [11, 9], [12, 10]], "#5ab8ff");
  if (parts.includes("drop")) { put([[13, 1], [12, 2], [13, 2], [12, 3], [13, 3], [14, 3]], "#5ab8ff"); put([[13, 2]], "#d8f0ff"); }
  if (parts.includes("zz")) put([[11, 0], [12, 0], [13, 0], [12, 1], [11, 2], [12, 2], [13, 2], [14, 3], [15, 3], [15, 4], [14, 5], [15, 5]], "#8ab8ff");
}

const cache = {};
/** A 16×16 canvas for emoticon `i`. */
export function emoCanvas(i) {
  if (cache[i]) return cache[i];
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  const how = EMO[i] && EMO[i][2];
  if (Array.isArray(how)) face(g, how);
  else if (GRID[how]) {
    const { pal, rows } = GRID[how];
    rows.forEach((r, y) => { for (let x = 0; x < 16; x++) { const col = pal[r[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  }
  return (cache[i] = c);
}
const urls = {};
export const emoUrl = (i) => urls[i] || (urls[i] = emoCanvas(i).toDataURL());

const RE = new RegExp(`\\((${EMO.map((e) => e[1]).join("|")})\\)`, "g");
/** Split a chat line into text and emoticons: [{ s }, { e: index }, …]. */
export function parse(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    if (m.index > last) out.push({ s: text.slice(last, m.index) });
    out.push({ e: byWord.get(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ s: text.slice(last) });
  return out;
}
export function badRows() {
  const bad = [];
  for (const k of Object.keys(GRID)) { const r = GRID[k].rows; if (r.length !== 16) bad.push(`${k}:rows:${r.length}`); r.forEach((row, y) => { if (row.length !== 16) bad.push(`${k}:${y}:${row.length}`); }); }
  return bad;
}
