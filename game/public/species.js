/**
 * The adventurers' looks: what kind of animal, and every part chosen at creation.
 *
 * A player is still the same small white creature — a big head on a tiny body
 * with no arms or legs, two one-pixel feet, a face of dot eyes, a nose and a
 * blush — but the head itself now comes in many shapes (a cat's tufted cheeks,
 * a fox's pointed chin, a frog's eye bumps, a sheep's wool, a penguin's face…),
 * with ears, tails, eyes, mouths, markings and colours to mix freely.
 *
 * `look` (what is saved and sent) is a short list of small numbers, in the order
 * of PARTS. The first seven are the original ones and keep their meaning, so an
 * old character looks exactly as before; the rest (species, tail, accent colour,
 * eye colour) are 0 for "as before".
 *
 * sprites.js hands its pixel tools to `animal()` for every player frame. Hats and
 * other things worn on the head can sit by `headAnchor()`.
 */

const DARK = "#2b2233", INK = "#2b2233", PINK = "#f6a8a0", WHITE = "#ffffff";

// ───────────────────────────── palettes ─────────────────────────────

/** Fur: the original ten, then naturals and pastels picked to sit together. */
const FUR = [
  "#fbfbff", "#fff0d8", "#ffd9c2", "#ffd0dc", "#e2d6ff", "#cfe6ff", "#cff2dc", "#ffeaa0", "#b9bdca", "#b98b68",
  "#f2b27a", "#e0b46c", "#8a6450", "#5c4a48", "#8a8a9a", "#4a4654", "#e8d4ae", "#ffb8c4", "#b4ece4", "#cddca0", "#ffcf9a", "#b8c8ff",
];
/** The second colour (markings, muzzles, bellies); 0 works it out from the fur. */
const ACCENT = [null, "#fbfbff", "#fff0d8", "#e8d4ae", "#f2b27a", "#c08050", "#8a6450", "#5c4a48", "#8a8a9a", "#4a4654", "#ffb8c4", "#c8b0f0", "#a8d0f0", "#a8e0b8"];
const EYE_COL = [null, "#8a5a3a", "#4a90e0", "#4ab06a", "#e0a030", "#9a6ad8", "#e86a9a", "#5ac8e0"];
const BLUSH = ["#f6a8a0", "#f07882", "#f8ba7c", null, "#d8b0f0", null];
const FRECKLE = 5;
const CLOTH = [null, "#5a8ae0", "#e0605a", "#5ab87a", "#9a78e0", "#f0c050", "#ec8ab4", "#46b4bc", "#8a6a4a", "#3e4e72", "#f4f0e6", "#e8843a"];

/**
 * Head shapes. `rows` are half-widths from the head's top row (`top`) down to row 23,
 * centred between x 15 and 16; the original head is rows 18–23 at 5,6,6,6,6,5.
 * `ew` is the half-width the ears are set at, `ey` the eye row, `ox` moves the eyes
 * outward. `def` is what suits the animal (offered when the species is picked).
 */
export const SPECIES = [
  { name: "기본", top: 18, rows: [5, 6, 6, 6, 6, 5], def: {} },
  { name: "고양이", top: 18, rows: [5, 6, 6, 6, 6, 6], ex: "tufts", def: { ear: 0, nose: 10, tail: 3 } },
  { name: "강아지", top: 18, rows: [5, 6, 6, 6, 6, 5], ex: "muzzle", def: { ear: 4, nose: 3, tail: 6 } },
  { name: "토끼", top: 17, rows: [4, 5, 5, 5, 5, 5, 4], ew: 5, def: { ear: 1, nose: 1, tail: 5 } },
  { name: "곰", top: 18, rows: [5, 6, 7, 7, 7, 6], def: { ear: 2, nose: 7, tail: 2 } },
  { name: "여우", top: 18, rows: [5, 6, 6, 7, 5, 3], ex: "cheeks", def: { ear: 3, nose: 6, tail: 4 } },
  { name: "햄스터", top: 18, rows: [4, 5, 6, 7, 7, 6], ex: "pouch", ew: 5, def: { ear: 7, nose: 11, tail: 2 } },
  { name: "개구리", top: 19, rows: [6, 7, 7, 7, 6], ex: "bumps", ey: 17, ox: -1, def: { ear: 11, nose: 13, tail: 1 } },
  { name: "펭귄", top: 18, rows: [4, 5, 6, 6, 6, 5], ex: "face", def: { ear: 11, nose: 8, tail: 10, pat: 7 } },
  { name: "양", top: 18, rows: [5, 6, 7, 6, 7, 5], ex: "wool", def: { ear: 9, nose: 2, tail: 5 } },
  { name: "생쥐", top: 19, rows: [4, 5, 6, 6, 5], def: { ear: 5, nose: 9, tail: 7 } },
  { name: "너구리", top: 18, rows: [5, 6, 7, 7, 6, 4], def: { ear: 2, nose: 0, tail: 9, pat: 5, acc: 9 } },
  { name: "사슴", top: 17, rows: [4, 5, 5, 5, 5, 4, 3], ew: 5, def: { ear: 8, nose: 3, tail: 2, pat: 4 } },
  { name: "판다", top: 18, rows: [5, 6, 7, 7, 7, 6], def: { ear: 2, nose: 7, tail: 2, pat: 12, acc: 9 } },
  { name: "다람쥐", top: 18, rows: [5, 6, 6, 6, 6, 5], ex: "pouch", def: { ear: 12, nose: 11, tail: 8, pat: 7 } },
];

/** Everything chosen at creation, in the order `look` stores it, and the tab each sits on. */
export const PARTS = [
  { key: "ear", label: "귀", tab: 2, names: ["고양이", "토끼", "곰", "여우", "강아지", "쥐", "늘어진 귀", "작은 귀", "사슴뿔", "양 귀", "뿔", "없음", "깃털 귀", "사막여우"] },
  { key: "eye", label: "눈", tab: 1, names: ["점 눈", "긴 눈", "큰 눈", "웃는 눈", "졸린 눈", "파란 눈", "반짝 눈", "윙크", "다부진 눈", "글썽 눈", "별 눈", "하트 눈", "동글 눈", "나른한 눈", "감은 눈", "놀란 눈"] },
  { key: "nose", label: "코·입", tab: 1, names: ["작은 코", "분홍 코", "ㅅ 입", "큰 코", "없음", "하트 코", "세모 코", "주둥이", "부리", "수염", "고양이 입", "앞니", "메롱", "활짝"] },
  { key: "fur", label: "털색", tab: 3, colors: FUR },
  { key: "blush", label: "볼", tab: 1, names: ["분홍", "빨강", "주황", "없음", "라벤더", "주근깨"] },
  { key: "pat", label: "무늬", tab: 4, names: ["없음", "눈 얼룩", "줄무늬", "포인트", "점박이", "가면", "양말", "배 무늬", "이마 점", "볼 줄무늬", "얼룩소", "반반", "판다"] },
  { key: "cloth", label: "옷", tab: 4, colors: CLOTH },
  { key: "sp", label: "종류", tab: 0, names: SPECIES.map((s) => s.name) },
  { key: "tail", label: "꼬리", tab: 2, names: ["자동", "없음", "짧은 꼬리", "고양이", "여우", "솜꼬리", "강아지", "쥐", "다람쥐", "줄무늬", "깃털", "돼지"] },
  { key: "acc", label: "보조색", tab: 3, colors: ACCENT },
  { key: "eyeC", label: "눈동자", tab: 1, colors: EYE_COL },
];
/** The tabs of the creation screen. */
export const TABS = ["종류", "얼굴", "귀·꼬리", "색", "무늬·옷"];
/** How many choices each entry of `look` has. */
export const LOOK_N = PARTS.map((p) => (p.names || p.colors).length);
/** Index of each part in `look`. */
export const LI = Object.fromEntries(PARTS.map((p, i) => [p.key, i]));

/** Ready-made looks to start from. */
export const PRESETS = [
  ["치즈 고양이", [0, 2, 10, 10, 2, 2, 5, 1, 3, 2, 4]],
  ["턱시도 고양이", [0, 0, 1, 15, 0, 7, 9, 1, 3, 1, 4]],
  ["흰 토끼", [1, 2, 1, 0, 0, 0, 6, 3, 5, 0, 6]],
  ["갈색 토끼", [6, 6, 5, 12, 3, 7, 10, 3, 5, 2, 0]],
  ["시바견", [3, 3, 3, 11, 2, 7, 2, 2, 6, 1, 0]],
  ["점박이 강아지", [4, 0, 7, 0, 0, 4, 1, 2, 6, 9, 0]],
  ["곰돌이", [2, 0, 7, 9, 2, 0, 3, 4, 2, 2, 0]],
  ["판다", [2, 12, 7, 0, 3, 12, 3, 13, 2, 9, 0]],
  ["여우", [3, 1, 6, 10, 2, 3, 3, 5, 4, 1, 4]],
  ["사막여우", [13, 2, 6, 16, 0, 0, 5, 5, 4, 1, 0]],
  ["햄스터", [7, 0, 11, 20, 0, 7, 6, 6, 2, 1, 0]],
  ["청개구리", [11, 6, 13, 19, 3, 7, 5, 7, 1, 2, 0]],
  ["펭귄", [11, 6, 8, 15, 0, 7, 2, 8, 10, 1, 0]],
  ["솜사탕 양", [9, 4, 2, 3, 4, 0, 4, 9, 5, 2, 0]],
  ["생쥐", [5, 2, 9, 8, 0, 0, 1, 10, 7, 10, 0]],
  ["너구리", [2, 13, 0, 14, 3, 5, 8, 11, 9, 9, 4]],
  ["꽃사슴", [8, 9, 3, 11, 0, 4, 3, 12, 2, 2, 1]],
  ["다람쥐", [12, 0, 11, 10, 2, 7, 3, 14, 8, 2, 0]],
  ["민트 냥", [0, 10, 10, 18, 4, 2, 1, 1, 3, 0, 7]],
  ["라벤더 곰", [7, 11, 5, 4, 0, 8, 6, 4, 2, 0, 5]],
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Make any list into a valid look of full length (unknown or missing entries become 0). */
export function cleanLook(look) {
  const lk = Array.isArray(look) ? look : [];
  return LOOK_N.map((n, i) => clamp(lk[i] | 0, 0, n - 1));
}
/** The drawing description of a saved look. */
export function lookOf(look = []) {
  const lk = cleanLook(look);
  return {
    sp: lk[7], ear: lk[0], eye: lk[1], nose: lk[2], fur: FUR[lk[3]], blush: BLUSH[lk[4]], frk: lk[4] === FRECKLE ? 1 : 0,
    pat: lk[5], cloth: CLOTH[lk[6]], tail: lk[8], acc: ACCENT[lk[9]], eyeC: EYE_COL[lk[10]],
  };
}
/** A look with the species switched and its fitting ears, nose, tail and markings put on. */
export function withSpecies(look, sp) {
  const lk = cleanLook(look);
  const was = SPECIES[lk[7]].def;
  lk[7] = sp;
  const d = SPECIES[sp].def;
  // markings and an accent that came with the old animal go with it
  if (was.pat !== undefined && lk[LI.pat] === was.pat) lk[LI.pat] = 0;
  if (was.acc !== undefined && lk[LI.acc] === was.acc) lk[LI.acc] = 0;
  for (const k of ["ear", "nose", "tail", "pat", "acc"]) if (d[k] !== undefined) lk[LI[k]] = d[k];
  if (sp === 0) lk[8] = 0;
  return lk;
}

// ───────────────────────────── colour helpers ─────────────────────────────

const lum = (c) => { const n = parseInt(c.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

/** Head bob per frame (FRAME order): a breath sinks it, mid-stride lifts it. */
export const HEAD_BOB = [0, 1, 0, -1, 0, 0];

/**
 * Where the head is on the 32×32 sheet (feet at sprites.FOOT), for hats and such:
 * `top` the head's top row, `half` its widest half-width about x = 16, `earTop` the
 * highest row of the ears (or `top` when there are none), `eyeY` the eye row,
 * `tall` whether the ears stand up (a hat sits between them, or the ears poke
 * through). Add HEAD_BOB[frame] to every row for the frame being drawn.
 */
export function headAnchor(look) {
  const o = Array.isArray(look) ? lookOf(look) : look;
  const sp = SPECIES[o.sp | 0] || SPECIES[0];
  const dy = sp.top - 18;
  const earTop = [14, 14, 15, 14, 17, 14, 17, 16, 12, 19, 15, 18, 15, 12][o.ear | 0] + (o.ear === 8 || o.ear === 13 ? 0 : dy);
  const top = sp.top + (sp.ex === "bumps" ? -2 : sp.ex === "wool" ? -1 : 0);
  return { cx: 16, top, half: Math.max(...sp.rows), earTop: Math.min(earTop, top), eyeY: sp.ey || 20, tall: [0, 1, 3, 5, 8, 10, 12, 13].includes(o.ear | 0) };
}

// ───────────────────────────── drawing ─────────────────────────────

/**
 * One frame of a player: `o` from lookOf, `view` front / side / back, `f` a FRAME
 * index, `T` the pixel tools of sprites.js { sheet, brush, finish, shade, blend, lt, FRAME }.
 * With species 0 and the original options it draws exactly what sprites.js always drew.
 */
export function animal(o, view, f, T) {
  const [c, g] = T.sheet(32);
  const b = T.brush(g);
  const { shade, blend, FRAME } = T;
  const side = view === "side", back = view === "back";
  const sp = SPECIES[o.sp | 0] || SPECIES[0];
  const fur = o.fur, soft = shade(fur), acc = o.acc || null, pat = o.pat | 0;
  const deep = acc || shade(fur, 0.32), deeper = acc ? shade(acc, 0.22) : shade(fur, 0.46);
  // muzzles, bellies, cheeks and faces: the accent, or a paler (or, on white, a warmer) fur
  const pale = acc || (lum(fur) > 0.86 ? blend(fur, "#e8c4a8", 0.42) : blend(fur, "#fffaf0", 0.66));
  const darkFur = lum(fur) < 0.36;
  const EYE = darkFur ? "#f8e4a0" : DARK, NOSE = darkFur ? "#f0a8b4" : "#4a3640";
  const H = HEAD_BOB[f] || 0;
  const r = (x, y, w, h, col) => b.r(x, y + H, w, h, col);
  const both = (x, y, w, h, col, colR = col) => { r(x, y, w, h, col); r(32 - x - w, y, w, h, colR); };
  const behind = (x, y, w, h, col) => b.r(side ? 32 - x - w : x, y, w, h, col);
  const top = sp.top, rows = sp.rows, wAt = (y) => rows[clamp(y - top, 0, rows.length - 1)];

  // ── tail (0: as the ears suggest, as it always was)
  const tc = pat === 3 || pat === 12 ? deep : fur;
  const tail = o.tail ? o.tail : (o.ear | 0) <= 5 ? [3, 5, 2, 4, 6, 7][o.ear | 0] : sp.def.tail || 2;
  const tip = pat === 3 ? fur : soft;
  [
    null, () => {},
    () => behind(19, 26, 1, 1, tc),
    () => { behind(19, 26, 2, 1, tc); behind(20, 24, 1, 2, tc); },
    () => { behind(19, 24, 3, 3, tc); behind(21, 24, 1, 1, tip); },
    () => behind(19, 25, 2, 2, tc),
    () => { behind(19, 25, 1, 1, tc); behind(20, 24, 1, 1, tc); },
    () => { behind(19, 26, 3, 1, tc); behind(21, 25, 1, 1, tc); },
    // a squirrel's tail curls up behind the body, half as tall as the creature
    () => {
      const D = pat === 3 || pat === 12 ? deeper : deep;
      behind(19, 24, 3, 3, D); behind(21, 21, 3, 3, D); behind(22, 18, 3, 3, D); behind(22, 16, 4, 2, D); behind(23, 15, 2, 1, D);
      behind(23, 16, 1, 1, fur); behind(23, 18, 1, 3, fur); behind(22, 21, 1, 2, fur); behind(20, 24, 1, 2, fur);
    },
    () => { behind(19, 24, 3, 3, fur); behind(19, 25, 3, 1, deep); behind(21, 24, 1, 1, deep); },
    () => { behind(19, 26, 3, 1, tc); behind(20, 25, 2, 1, tc); behind(21, 24, 1, 1, deep); behind(21, 26, 1, 1, deep); },
    () => { behind(19, 26, 1, 1, tc); behind(20, 25, 1, 1, tc); behind(21, 26, 1, 1, tc); behind(21, 24, 1, 1, tc); },
  ][tail]();

  // ── body: a tiny lump on two feet; a step lifts one of them
  const bt = 24 + H, cloth = o.cloth;
  const foot = pat === 6 || pat === 12 ? deep : fur;
  b.r(13, bt, 6, 27 - bt, fur);
  if (f !== FRAME.stepB) b.r(13, 27, 2, 1, foot);
  if (f !== FRAME.stepA) b.r(17, 27, 2, 1, foot);
  if (pat === 6) b.r(13, 26, 6, 1, deep);
  if (pat === 4) b.r(back ? 14 : 17, 25, 1, 1, deep);
  if (pat === 10) b.r(back ? 16 : 13, 25, 2, 2, deep);
  if (cloth) {
    b.r(13, bt, 6, 26 - bt, cloth); b.r(13, 25, 6, 1, shade(cloth, 0.3));
    if (!back) b.r(side ? 16 : 15, bt, 2, 1, T.lt(cloth, 1.45));
  } else {
    b.r(13, bt, 6, 1, soft);
    if (pat === 7 && !back) b.r(side ? 15 : 14, 25, 4, 2, pale);
  }

  // ── ears, set on this head's top and width
  const dx = 6 - (sp.ew || 6), dy = top - 18;
  const eL = pat === 3 || pat === 12 ? deep : fur, eR = pat === 3 || pat === 1 || pat === 11 || pat === 12 ? deep : fur;
  const E = (x, y, w, h, cl = eL, cr = eR) => both(x + dx, y + dy, w, h, cl, cr);
  const pink = (x, y, w, h) => { if (!back) both(x + dx, y + dy, w, h, PINK); };
  const HORN = "#e8dcb8", HORN2 = "#b8a888", ANT = "#c89a64", ANT2 = "#8a6440";
  const ear = o.ear | 0;
  [
    () => { E(10, 17, 4, 1); E(10, 16, 3, 1); E(10, 15, 2, 1); E(10, 14, 1, 1); pink(11, 16, 1, 2); },
    () => { E(11, 14, 3, 4); pink(12, 15, 1, 3); },
    () => { E(9, 16, 3, 2); E(10, 15, 2, 1); pink(10, 16, 1, 1); },
    () => { E(9, 17, 5, 1); E(9, 16, 4, 1); E(9, 15, 3, 1); E(9, 14, 2, 1); pink(10, 16, 1, 2); },
    () => {},                                                     // floppy: hangs over the head, drawn after it
    () => { E(9, 15, 4, 2); E(10, 14, 2, 1); E(10, 17, 3, 1); pink(10, 15, 2, 2); },
    () => {},                                                     // lop: after the head too
    () => { E(10, 16, 2, 2); pink(10, 17, 1, 1); },
    // antlers: two small ears at the sides, and branching horns from the crown
    () => {
      E(8, 18, 3, 1); pink(9, 18, 1, 1);
      both(12 + dx, 12, 1, 6, ANT, ANT); both(11 + dx, 13, 1, 1, ANT2, ANT2); both(10 + dx, 12, 1, 1, ANT, ANT); both(13 + dx, 14, 1, 1, ANT, ANT); both(14 + dx, 13, 1, 1, ANT2, ANT2);
    },
    () => {},                                                     // sheep: hangs at the sides, after the head
    () => { both(10 + dx, 15 + dy, 3, 1, HORN, HORN); both(9 + dx, 16 + dy, 2, 2, HORN, HORN); both(10 + dx, 18 + dy, 2, 1, HORN2, HORN2); both(11 + dx, 16 + dy, 1, 1, HORN2, HORN2); },
    () => {},
    () => { E(10, 17, 3, 1); E(10, 16, 2, 1); E(10, 15, 1, 1); },
    () => { E(9, 17, 5, 1); E(9, 16, 4, 1); E(9, 15, 4, 1); E(9, 14, 3, 1); E(9, 13, 2, 1); E(9, 12, 1, 1); pink(10, 14, 1, 3); pink(11, 15, 1, 2); },
  ][ear]();

  // ── the head
  rows.forEach((w, j) => r(16 - w, top + j, w * 2, 1, fur));
  if (sp.ex === "bumps") { both(10, 17, 4, 2, fur); both(11, 16, 2, 1, fur); }
  if (sp.ex === "wool") { both(12, 17, 2, 1, fur); r(15, 17, 2, 1, fur); both(8, 20, 1, 1, fur); both(8, 22, 1, 1, fur); }
  if (sp.ex === "tufts") { both(9, 21, 1, 1, fur); both(9, 23, 1, 1, fur); }
  if (ear === 4) {
    const d = pat === 3 || pat === 12 ? deeper : deep;
    both(10 + dx, 17 + dy, 2, 1, d, pat === 1 || pat === 11 ? deeper : d); both(9 + dx, 18 + dy, 2, 5, d, pat === 1 || pat === 11 ? deeper : d);
  }
  if (ear === 6) {
    // a lop rabbit's ears fall past the cheeks
    const d = pat === 3 || pat === 12 ? deep : soft;
    E(10, 17, 3, 1, d, pat === 1 || pat === 11 ? deep : d); E(8, 18, 2, 6, d, pat === 1 || pat === 11 ? deep : d); E(10, 18, 1, 1, d, pat === 1 || pat === 11 ? deep : d);
  }
  if (ear === 9) { E(8, 20, 2, 2, pat === 3 || pat === 12 ? deep : soft); E(9, 19, 1, 1, pat === 3 || pat === 12 ? deep : soft); if (!back) both(8 + dx, 21 + dy, 1, 1, PINK); }
  // markings that wrap round the head
  if (pat === 2) { r(15, top, 2, 2, deep); both(12, top, 1, 1, deep); }
  if (pat === 4) { r(back ? 13 : 18, top, 2, 1, deep); r(back ? 18 : 12, top + 1, 1, 2, deep); r(back ? 16 : 20, top + 3, 1, 1, deep); }
  if (pat === 10) { r(16 - wAt(top + 1), top + 1, 3, 2, deep); r(16 - wAt(top), top, 3, 1, deep); r(back ? 13 : 18, 22, 3, 2, deep); }
  if (pat === 11) for (let y = top; y <= 23; y++) r(16, y, wAt(y), 1, deep);
  if (sp.ex === "bumps" && pat === 11) { r(18, 17, 4, 2, deep); r(19, 16, 2, 1, deep); }

  if (back) return T.finish(c, g, INK, 1);

  // the face turns with the body: in a three-quarter view everything slides toward the far cheek
  const ox = sp.ox | 0;
  const lx = (side ? 14 : 12) + ox, rx1 = (side ? 20 : 19) - ox, rx2 = (side ? 19 : 18) - ox, nx = side ? 17 : 15;
  const ey = sp.ey || 20, ny = 22, s2 = side ? 1 : 0;

  // ── the species' own face: muzzle, cheeks, a face patch
  if (sp.ex === "muzzle") { r(14 + s2 * 2, 21, 4, 1, pale); r(13 + s2 * 2, 22, 6, 2, pale); }
  if (sp.ex === "cheeks") { both(9, 21, 3, 1, pale); both(11, 22, 2, 1, pale); r(13, 23, 6, 1, pale); }
  if (sp.ex === "pouch") { both(16 - wAt(21), 21, 3, 2, pale); }
  if (sp.ex === "face") { r(12 + s2, 19, 3, 1, pale); r(17 + s2, 19, 3, 1, pale); r(11 + s2, 20, 10, 3, pale); r(12 + s2, 23, 8, 1, pale); }
  if (sp.ex === "wool") { const fc = acc || (lum(fur) > 0.6 ? blend(fur, "#d8b49c", 0.5) : blend(fur, "#fff4e8", 0.6)); r(12 + s2, 20, 8, 3, fc); r(13 + s2, 23, 6, 1, fc); r(13 + s2, 19, 6, 1, fc); }

  // ── markings on the face
  if (pat === 1) r((side ? 18 : 17) - ox, ey - 1, 4, 4, deep);
  if (pat === 5) { const w = wAt(ey), BR = blend(fur, "#ffffff", 0.6); r(16 - w + 1, ey - 1, w - 2 + s2, 1, BR); r(17 + s2, ey - 1, w - 2 - s2, 1, BR); r(16 - w, ey, w - 1 + s2, 2, deep); r(17 + s2, ey, w - 1 - s2, 2, deep); }
  if (pat === 8) { r(15 + s2, top, 2, 1, pale); r(15 + s2, top + 1, 2, 1, pale); }
  if (pat === 9) { both(16 - wAt(ey), ey, 2, 1, deep); both(16 - wAt(ny), ny, 2, 1, deep); }
  if (pat === 12) { r(lx - 1, ey - 1, 3, 3, deep); r(rx2, ey - 1, 3, 3, deep); }
  const onDark = pat === 12 || (pat === 5 && lum(deep) < 0.45);

  // ── eyes
  const I = o.eyeC || null;
  const eyes = (w, y, h, col) => { r(lx, y, w, h, col); r(w === 1 ? rx1 : rx2, y, w, h, col); };
  const iris = (w, y) => { if (I) eyes(w, y, 1, I); };
  /** A little shape drawn at both eyes: `x` is the left eye's left column (the right one mirrors). */
  const at2 = (fn) => { fn(lx, 1); fn(rx2, -1); };
  const eye = o.eye | 0;
  if (f === FRAME.blink && eye !== 3 && eye !== 14) eyes(2, ey + 1, 1, EYE);
  else [
    () => { eyes(1, ey, 2, EYE); iris(1, ey + 1); },
    () => { eyes(1, ey - 1, 3, EYE); iris(1, ey + 1); },
    () => { eyes(2, ey, 2, EYE); iris(2, ey + 1); r(lx, ey, 1, 1, WHITE); r(rx2, ey, 1, 1, WHITE); },
    () => { for (const x of [lx - 1, rx2]) { r(x, ey + 1, 1, 1, EYE); r(x + 1, ey, 1, 1, EYE); r(x + 2, ey + 1, 1, 1, EYE); } },
    () => eyes(2, ey + 1, 1, EYE),
    () => { eyes(2, ey, 1, EYE); eyes(2, ey + 1, 1, I || "#4a90e0"); },
    // sparkly: big and wet, a glint above and one below
    () => { eyes(2, ey - 1, 3, EYE); iris(2, ey + 1); r(lx, ey - 1, 1, 1, WHITE); r(rx2, ey - 1, 1, 1, WHITE); r(lx + 1, ey, 1, 1, WHITE); r(rx2 + 1, ey, 1, 1, WHITE); },
    // a wink: one eye open, the other a happy arc
    () => { r(lx, ey, 2, 2, EYE); if (I) r(lx, ey + 1, 2, 1, I); r(lx, ey, 1, 1, WHITE); r(rx2, ey + 1, 1, 1, EYE); r(rx2 + 1, ey, 1, 1, EYE); r(rx2 + 2, ey + 1, 1, 1, EYE); },
    // determined: square eyes under brows that slope down to the nose
    () => { eyes(2, ey, 2, EYE); iris(2, ey + 1); at2((x, s) => { r(s > 0 ? x - 1 : x + 2, ey - 2, 1, 1, EYE); r(s > 0 ? x : x + 1, ey - 1, 1, 1, EYE); }); },
    // teary: big eyes and a drop on one cheek
    () => { eyes(2, ey, 2, EYE); iris(2, ey + 1); r(lx, ey, 1, 1, WHITE); r(rx2, ey, 1, 1, WHITE); r(lx, ey + 2, 1, 1, "#7ac8ff"); },
    // stars
    () => { at2((x, s) => { const cx = s > 0 ? x : x + 1; r(cx - 1, ey, 3, 1, "#f0a828"); r(cx, ey - 1, 1, 3, "#f0a828"); r(cx, ey, 1, 1, "#fff2b0"); }); },
    // hearts
    () => { at2((x) => { const x0 = x === lx ? x - 1 : x; r(x0, ey - 1, 1, 1, "#e8506a"); r(x0 + 2, ey - 1, 1, 1, "#e8506a"); r(x0, ey, 3, 1, "#e8506a"); r(x0 + 1, ey + 1, 1, 1, "#e8506a"); }); },
    // big round
    () => { at2((x, s) => { const x0 = s > 0 ? x - 1 : x; r(x0, ey - 1, 3, 3, EYE); if (I) r(x0, ey + 1, 3, 1, I); r(x0, ey - 1, 1, 1, WHITE); }); },
    // half-lidded
    () => { at2((x, s) => { const x0 = s > 0 ? x - 1 : x; r(x0, ey, 3, 1, EYE); r(x0 + (s > 0 ? 1 : 0), ey + 1, 2, 1, I || EYE); }); },
    // closed, contented: a little cup each
    () => { for (const x of [lx - 1, rx2]) { r(x, ey, 1, 1, EYE); r(x + 1, ey + 1, 1, 1, EYE); r(x + 2, ey, 1, 1, EYE); } },
    // surprised: open rings
    () => { at2((x, s) => { const x0 = s > 0 ? x - 1 : x; r(x0, ey - 1, 3, 3, EYE); r(x0 + 1, ey, 1, 1, darkFur ? DARK : WHITE); }); },
  ][eye]();
  // eyes inside a dark patch keep a glint so they still read
  if (onDark && f !== FRAME.blink && ![3, 4, 13, 14].includes(eye)) { r(lx, ey, 1, 1, WHITE); r(rx2, ey, 1, 1, WHITE); }

  // ── nose and mouth
  const nose = o.nose | 0, HEART = "#f07890";
  const MZ = acc || (lum(fur) > 0.86 ? blend(fur, "#e8c4a8", 0.42) : blend(fur, "#fffaf0", 0.66));
  [
    () => r(nx, ny, 2, 1, NOSE),
    () => r(nx, ny, 2, 1, "#f08a9a"),
    () => { r(nx, ny, 2, 1, NOSE); r(nx - 1, ny + 1, 1, 1, NOSE); r(nx + 2, ny + 1, 1, 1, NOSE); },
    () => r(nx, ny, 2, 2, NOSE),
    () => {},
    () => { r(nx - 1, ny - 1, 1, 1, HEART); r(nx + 2, ny - 1, 1, 1, HEART); r(nx - 1, ny, 4, 1, HEART); r(nx, ny + 1, 2, 1, HEART); },
    () => { r(nx - 1, ny, 4, 1, NOSE); r(nx, ny + 1, 2, 1, NOSE); },
    () => { r(nx - 1, ny, 4, 2, MZ); r(nx, ny, 2, 1, NOSE); r(nx, ny + 1, 2, 1, shade(MZ, 0.18)); },
    () => { r(nx, ny - 1, 2, 1, "#ffb84a"); r(nx - 1 + s2, ny, 4, 1, "#ffb84a"); r(nx + s2, ny + 1, 2, 1, "#e07a28"); },
    () => { r(nx, ny, 2, 1, "#f08a9a"); const W = darkFur ? "#c8b8c8" : "#7a6a80"; r(nx - 3, ny, 1, 1, W); r(nx - 2, ny + 1, 1, 1, W); r(nx + 4, ny, 1, 1, W); r(nx + 3, ny + 1, 1, 1, W); },
    () => { r(nx, ny, 2, 1, "#f08a9a"); r(nx - 2, ny + 1, 1, 1, NOSE); r(nx, ny + 1, 2, 1, NOSE); r(nx + 3, ny + 1, 1, 1, NOSE); },
    () => { r(nx, ny, 2, 1, NOSE); r(nx - 1, ny + 1, 1, 1, NOSE); r(nx, ny + 1, 2, 1, WHITE); r(nx + 2, ny + 1, 1, 1, NOSE); },
    () => { r(nx - 1, ny, 3, 1, NOSE); r(nx + 1, ny + 1, 2, 1, HEART); },
    () => { r(nx - 2, ny, 6, 1, NOSE); r(nx - 1, ny + 1, 4, 1, HEART); },
  ][nose]();

  // ── blush or freckles, on the cheek's edge whatever the head's width
  const bx = 16 - wAt(ny);
  if (o.blush) { if (side) { r(bx + 2, ny, 2, 1, o.blush); r(31 - bx, ny, 1, 1, o.blush); } else both(bx, ny, 2, 1, o.blush); }
  if (o.frk) { const F = "#c07858"; if (side) { r(bx + 2, ny, 1, 1, F); r(bx + 3, ny + 1, 1, 1, F); r(31 - bx - 1, ny, 1, 1, F); } else { both(bx, ny, 1, 1, F); both(bx + 2, ny, 1, 1, F); both(bx + 1, ny + 1, 1, 1, F); } }
  return T.finish(c, g, INK, 1);
}
