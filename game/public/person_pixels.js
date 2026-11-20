import { faceAnchor, headAnchor, HEAD_BOB } from "./species.js";

const LOGICAL = 32, NATIVE = LOGICAL * 2;
const OPAQUE = 0x1000000;
const color = hex => hex ? OPAQUE + Number.parseInt(hex.slice(1), 16) : 0;
const INK = color("#2b2233"), EAR = color("#f6a8a0");
const EYE_GLINT = color("#ffffff"), EYE_PIGMENTS = [INK, color("#f8e4a0"), color("#4a90e0"), color("#f0a828"), color("#e8506a")];
const NOSE_PIGMENTS = [color("#4a3640"), color("#f0a8b4"), color("#f08a9a"), color("#f07890"), color("#ffb84a"), color("#e07a28")];
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const at = (x, y) => y * NATIVE + x;

function tone(base, target, amount) {
  const blend = shift => Math.round(((base >> shift) & 255) * (1 - amount) + ((target >> shift) & 255) * amount);
  return OPAQUE + (blend(16) << 16) + (blend(8) << 8) + blend(0);
}

/** Keep the authored palette and face pixels while moving the form to the half-tile grid. */
function seed(base, dst) {
  const src = base.getContext("2d").getImageData(0, 0, LOGICAL, LOGICAL).data;
  const logical = new Uint32Array(LOGICAL * LOGICAL);
  for (let y = 0; y < LOGICAL; y++) for (let x = 0; x < LOGICAL; x++) {
    const si = y * LOGICAL + x, i = si * 4;
    if (src[i + 3] < 128) continue;
    const pigment = OPAQUE + (src[i] << 16) + (src[i + 1] << 8) + src[i + 2];
    const j = at(x * 2, y * 2);
    logical[si] = pigment;
    dst[j] = dst[j + 1] = dst[j + NATIVE] = dst[j + NATIVE + 1] = pigment;
  }
  return logical;
}

function contour(logical, pixels) {
  const p = (x, y) => logical[y * LOGICAL + x];
  for (let y = 1; y < LOGICAL - 1; y++) for (let x = 1; x < LOGICAL - 1; x++) {
    const source = p(x, y);
    if (source && source !== INK) continue;
    for (const [dx, dy] of CORNERS) {
      const hx = x * 2 + Number(dx > 0), hy = y * 2 + Number(dy > 0);
      const across = p(x + dx, y), down = p(x, y + dy);
      // Bevel convex corners a single native pixel, retaining the old outline weight elsewhere.
      if (source === INK && !across && !down && p(x - dx, y) && p(x, y - dy)) pixels[at(hx, hy)] = 0;
      // At concave steps, join two dark edges without changing the silhouette's outer extent.
      else if (!source && across === INK && down === INK && p(x + dx, y + dy)) pixels[at(hx, hy)] = INK;
    }
  }
}

/** Change only the intended material, so the original markings, iris and mouth always win. */
function stroke(pixels, x, y, from, paint) {
  const i = at(x, y);
  if (pixels[i] === from) pixels[i] = paint;
}

// Native bevel targets in logical space: left offset, right offset, row offset.
// The right anchor starts at the square eye; the tall dots sit a column farther out.
const EYE_EDGE = [
  [0, 1, 0], [0, 1, -1], [0, 1, 1], [-1, 2, 1], // dots, long dots, glints, smiling arc
  [0, 1, 1], [0, 1, 0], [0, 1, 1], [0, 2, 1],   // line, iris, sparkle, wink
  [-1, 2, -2], [0, 1, 1], [0, 1, -1], [-1, 2, -1], // brow, teardrop, stars, hearts
  [-1, 2, -1], [-1, 2, 0], [-1, 2, 0], [-1, 2, -1], // round, sleepy, closed, startled
  [-1, 2, 0], [-1, 2, -1], // eye smile, lashes
];
const NOSE_EDGE = [
  [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 1], null, [0, 1, 1], [-1, 2, 0],
  [0, 1, 0], [0, 1, -1], [0, 1, 0], [0, 1, 0], [0, 1, 0], [-1, 1, 0], [-2, 3, 0],
  [0, 1, 0], [-1, 2, 0],
];

function bevelGlyph(pixels, x, y, side, low, pigments, faceTone) {
  const i = at(x * 2 + Number(side > 0), y * 2 + Number(low));
  const pigment = pixels[i], adjacent = pixels[i + side];
  if (!pigments.includes(pigment)) return;
  // Keep the three neighbouring native pixels of this logical feature; keep every glint intact.
  pixels[i] = adjacent && adjacent !== INK && adjacent !== EYE_GLINT && !pigments.includes(adjacent)
    ? adjacent : tone(pigment, faceTone, 0.24);
}

function faceDetails(pixels, face, bob, look, fur, frame) {
  const eye = look.eye | 0, nose = look.nose | 0;
  const blink = frame === 5 && eye !== 3 && (look.sp === undefined || eye !== 14);
  const [left, right, row] = blink ? [0, 1, 1] : EYE_EDGE[eye] || EYE_EDGE[0];
  const eyeRow = face.ey + bob + row;
  const iris = color(look.eyeC), pigments = iris ? [...EYE_PIGMENTS, iris] : EYE_PIGMENTS;
  bevelGlyph(pixels, face.lx + left, eyeRow, -1, row > 0 && !blink, pigments, fur);
  bevelGlyph(pixels, face.rx + right, eyeRow, 1, row > 0 && !blink, pigments, fur);
  if (!blink && eye === 9) {
    const drop = color("#7ac8ff"), x = face.lx * 2, y = (face.ey + bob + 2) * 2;
    stroke(pixels, x, y + 1, drop, tone(drop, fur, 0.28));
  }

  const tip = NOSE_EDGE[nose];
  if (!tip) return;
  const [a, b, ny] = tip, x = face.nx, y = face.ny + bob + ny;
  bevelGlyph(pixels, x + a, y, -1, ny > 0, NOSE_PIGMENTS, fur);
  bevelGlyph(pixels, x + b, y, 1, ny > 0, NOSE_PIGMENTS, fur);
  if (nose === 8) {
    const beak = color("#ffb84a");
    stroke(pixels, x * 2 + 1, y * 2, beak, tone(beak, color("#ffeea8"), 0.4));
  }
}

function ears(pixels, head, bob, fur, front) {
  const y0 = (head.earTop + bob) * 2, top = (head.top + bob) * 2;
  const inset = tone(EAR, color("#874165"), 0.24);
  const rim = tone(fur, color("#80729f"), 0.17);
  for (let y = y0; y < top; y++) for (let x = 14; x < 50; x++) {
    const i = at(x, y);
    // The inner ear turns under a single darker side; horns and fur marks keep their source colours.
    if (front && pixels[i] === EAR && pixels[i + 1] === fur && pixels[i - 1] === EAR) pixels[i] = inset;
    else if (pixels[i] === fur && pixels[i + 1] === INK && pixels[i - NATIVE] === fur && (y & 1)) pixels[i] = rim;
  }
}

function cheeks(pixels, face, bob, look, fur) {
  const x0 = face.cheekL * 2, x1 = face.cheekR * 2 + 1, row = (face.ny + bob) * 2;
  const soft = tone(fur, color("#84729e"), 0.2);
  // Each cheek turns under the muzzle in a stepped arc. Never cross the eye, muzzle mark or nose.
  for (const [edge, inward] of [[x0, 1], [x1, -1]]) {
    for (let i = 1; i <= 5; i++) stroke(pixels, edge + inward * i, row + (i < 3 ? 3 : 2), fur, soft);
  }
  const blush = color(look.blush);
  if (!blush) return;
  // Clip one pixel off the blush patch and give its lower outside edge a muted blush tone.
  const blushShade = tone(blush, color("#a95786"), 0.17);
  for (const [x, dx] of [[x0 + (face.side ? 4 : 0), 1], [x1, -1]]) {
    if (pixels[at(x, row)] !== blush || pixels[at(x + dx, row)] !== blush) continue;
    if (pixels[at(x, row - 1)] === fur) pixels[at(x, row)] = fur;
    stroke(pixels, x + dx, row + 1, blush, blushShade);
  }
}

function clothes(pixels, cloth, bob, view) {
  const y = (24 + bob) * 2, hem = 51;
  const light = tone(cloth, color("#fff0cf"), 0.28);
  const fold = tone(cloth, color("#453750"), 0.32);
  const middle = view === "side" ? 33 : 31;
  for (let x = 27; x < 37; x++) {
    // A neckline dips a native pixel toward the centre and a fold falls into the lower right.
    stroke(pixels, x, y + (Math.abs(x - middle) < 2 ? 1 : 0), cloth, light);
    if (x >= middle) stroke(pixels, x, Math.min(hem, y + 1 + (x > middle + 2)), cloth, fold);
  }
}

function pawsAndTail(pixels, fur, side) {
  const shadow = tone(fur, color("#706287"), 0.23);
  for (const x of [28, 29, 36, 37]) stroke(pixels, x, 55, fur, shadow);
  const last = side ? 26 : 46, first = side ? 18 : 38;
  for (let y = 45; y < 54; y++) for (let x = first; x < last; x++) {
    const i = at(x, y);
    if (pixels[i] === fur && pixels[i + NATIVE] === INK) pixels[i] = shadow;
  }
}

/** Ink the join between the exposed tail and the character's silhouette. */
function tailJoin(pixels, form, tail) {
  const on = (rows, x, y) => (rows[y] >>> x) & 1;
  const exposed = (x, y) => on(tail, x, y) && !on(form, x, y);
  const meets = (x, y, nx, ny) => (
    (on(form, x, y) && exposed(nx, ny)) || (exposed(x, y) && on(form, nx, ny))
  );
  const bottom = LOGICAL - 2;
  for (let y = 0; y <= bottom; y++) for (let x = 0; x < LOGICAL - 1; x++) {
    if (meets(x, y, x + 1, y)) {
      const i = at(x * 2 + 2, y * 2);
      if (pixels[i]) pixels[i] = INK;
      if (pixels[i + NATIVE]) pixels[i + NATIVE] = INK;
    }
    if (y < bottom && meets(x, y, x, y + 1)) {
      const i = at(x * 2, y * 2 + 2);
      if (pixels[i]) pixels[i] = INK;
      if (pixels[i + 1]) pixels[i + 1] = INK;
    }
  }
}

// Rear tails are authored in native pixels. Each entry is a top row and [x, ink] strips.
const REAR_TAILS = {
  2: [49, [[31, "FF"], [30, "HFF"], [30, "HFFS"], [30, "FFFS"], [31, "FSS"], [32, "SS"]]],
  3: [37, [
    [48, "FF"], [47, "FFFS"], [47, "HFFS"], [48, "FFS"], [48, "FFS"], [48, "FFS"],
    [47, "FFS"], [46, "FFS"], [45, "FFS"], [44, "FFSS"], [42, "FFFSS"], [40, "HFFFSS"],
    [37, "HFFFFSSS"], [33, "HHFFFFFSSS"], [31, "HFFFFFFFFSS"], [30, "FFFFFFFFSS"],
    [30, "FFFFFSSSS"], [31, "SSSSS"],
  ]],
  4: [28, [
    [49, "I"], [48, "II"], [47, "IIII"], [46, "IIIIIT"], [45, "IIIIIIT"], [44, "IIIIIITT"],
    [42, "IIIIIIIIST"], [41, "HIIIIIITTSS"], [40, "HIIITTTTSSSS"], [39, "HFFTTTTTSSSS"],
    [38, "HHFFFTTSSSSS"], [37, "HHFFFFFFSSSSS"], [35, "HHFFFFFFFFSSSS"], [34, "HHFFFFFFFFSSSS"],
    [33, "HHFFFFFFFFSSS"], [32, "HHFFFFFFFSSSS"], [31, "HHFFFFFFFSSS"], [30, "HHFFFFFFSSS"],
    [30, "HHFFFFFSSS"], [29, "HHFFFFFSS"], [29, "HFFFFFSS"], [29, "FFFFFFS"],
    [30, "FFFFFS"], [30, "FFFFSS"], [30, "FSSS"], [31, "SS"],
  ]],
  5: [48, [[32, "II"], [30, "IIIT"], [29, "IIIIIT"], [29, "IIIIIIT"], [28, "IIIIIITS"],
    [28, "TIIIIITS"], [29, "TIIITTS"], [30, "TTTTS"], [31, "SSS"]]],
  6: [42, [[43, "TT"], [42, "TTH"], [41, "THF"], [41, "HFF"], [41, "HFFS"], [40, "HFFS"],
    [39, "HFFSS"], [36, "HHFFSSS"], [32, "HHFFFFSSS"], [30, "HFFFFFFSSS"], [30, "FFFFFSSS"],
    [31, "FFFFSS"], [32, "SSSS"]]],
  7: [44, [[49, "P"], [47, "PP"], [45, "PPQ"], [43, "PPQ"], [41, "PPQ"], [39, "PPQ"],
    [36, "PPPQQ"], [33, "PPPPQQ"], [30, "PPPPPQQ"], [30, "PPPQQ"], [31, "QQQ"]]],
  8: [25, [
    [48, "HH"], [46, "HHHHF"], [44, "HHHHFFFF"], [43, "HHHFFFFFFS"], [42, "HHHFFFFFFFS"],
    [41, "HHHFFFFFFFFS"], [41, "HHFFFFFFFFSS"], [40, "HHFFFFFFFFFSS"], [40, "HHFFFFSFFFSSS"],
    [40, "HFFFSS.FFFSSS"], [40, "FFFS...FFFSSS"], [41, "FSS....HFFSSS"], [48, "HFFFSS"],
    [48, "HFFFSS"], [47, "HHFFFSS"], [46, "HHFFFFSS"], [45, "HHFFFFSS"], [44, "HHFFFFSS"],
    [42, "HHFFFFFSS"], [40, "HHFFFFFFSS"], [38, "HHFFFFFFFSS"], [36, "HHFFFFFFFFSS"],
    [34, "HHFFFFFFFFSS"], [32, "HHFFFFFFFFFSS"], [31, "HHFFFFFFFFSS"], [30, "HFFFFFFFFSS"],
    [30, "FFFFFFFSS"], [30, "FFFFFSS"], [31, "FFFSS"], [32, "SSS"],
  ]],
  9: [40, [[44, "TT"], [43, "TTTF"], [42, "HDDFS"], [41, "HDDDFS"], [40, "HFFFSS"],
    [39, "HHFFSS"], [38, "HDDDDSS"], [36, "HDDDDDSS"], [34, "HHFFFFSSS"], [32, "HHFFFFFSS"],
    [30, "HDDFFFSSS"], [30, "DDDDDSS"], [30, "DDDDSS"], [31, "FSSS"], [32, "SS"]]],
  10: [39, [[44, "I"], [43, "II"], [42, "IIIT"], [41, "IIIIT"], [40, "IIITTS"],
    [38, "IITIITS"], [37, "IITTTTSS"], [35, "HIIITTSS"], [33, "HHTTTFSS"], [31, "HFFFFFSS"],
    [30, "FFFFFSS"], [30, "FFFSS"], [31, "FSS"], [32, "S"]]],
  11: [44, [[41, "PPP"], [39, "PPPPP"], [39, "PP..PQ"], [38, "PP...PQ"], [38, "PP...QQ"],
    [39, "QQ..PQQ"], [39, ".QQPQQ"], [33, "PP....QQQ"], [31, "PPPP.PQQ"], [30, "PPPPPPQ"],
    [30, "PPQQQQ"], [31, "QQQ"]]],
  12: [48, [[31, "HH"], [30, "HFF"], [30, "HFFF"], [30, "HFFFF"], [30, "HFFFFFHHH"],
    [30, "HFFFFFFFFFH"], [30, "FFFFFFFFFFSS"], [31, "FFFFFFFSSSS"], [33, "FSSSSSSS"], [35, "SSSSS"]]],
  13: [32, [
    [17, "I"], [17, "II"], [16, "III"], [15, "IIIT...I"], [15, "IIITT..II"], [14, "IIIITT.III"],
    [14, "IITIIT.IIIT"], [13, "IITIIITIITTT...I"], [12, "IITTIITIITTTS..I"], [12, "IITTIIHIITTSS.II"],
    [12, "ITTTHIHIITSSS.II"], [13, "ITTHHHHITTSSFII"], [13, "ITTHHHHITSSFFIT"],
    [14, "TTTHHFFTTFFFIIT"], [15, "TTHHFFFTTFFFTTS"], [17, "THHFFFFFFFFTSS"],
    [19, "HHFFFFFFFFFSS"], [21, "HHFFFFFFFSSS"], [23, "HHFFFFFSSS"], [25, "HFFFFSSS"],
    [27, "FFFFSS"], [29, "FFSS"], [30, "SS"],
  ]],
  14: [42, [
    [43, "DD"], [42, "DDDT"], [41, "DDDT"], [41, "HDDF"], [39, "HFFFFS"],
    [36, "HHFFFFSS"], [33, "HHFFFFFFSS"], [30, "HFFFFFFFSS"], [30, "FFFFFFSS"],
    [30, "FFFFSS"], [31, "SSSS"],
  ]],
  15: [39, [
    [43, "DD"], [41, "DDDDDD"], [42, "DDDD"], [43, "DD"], [43, "DD"],
    [42, "DD"], [40, "DDD"], [37, "DDDD"], [34, "DDDDD"], [31, "DDDDDS"],
    [30, "DDDDSS"], [30, "DDSSS"], [31, "SSS"],
  ]],
  16: [38, [
    [37, "II....II"], [36, "III..III"], [35, "FFII.FFII"], [34, "HFFTTFFIIT"],
    [33, "HFFFFTTFFTS"], [32, "HHFFFFFFTTSS"], [31, "HHFFFFFFFSSS"], [30, "HHFFFFFFFSSS"],
    [30, "HHFFFFFFSSS"], [29, "HFFFFFFSS"], [29, "FFFFFFSS"], [30, "FFFFFSS"],
    [30, "FFFFSS"], [31, "FSSS"], [32, "SS"],
  ]],
  17: [43, [
    [43, "II"], [42, "IIIT"], [40, "HIIITS"], [37, "HHFFFTSS"], [33, "HHFFFFFFSS"],
    [30, "HFFFFFFFSS"], [30, "FFFFFFTTI"], [31, "FFFFSSIII"], [32, "SSSS..II"],
  ]],
};

/** From behind the tail is nearest to the camera, including above the back of the head. */
export function drawNativeRearTail(ctx, o, tail, frame) {
  const shape = REAR_TAILS[tail];
  if (!shape) return;

  const fur = color(o.fur), accent = color(o.acc);
  const base = tail === 8 ? tone(fur, color("#a75b3a"), 0.38)
    : o.pat === 3 || o.pat === 12 ? accent || tone(fur, INK, 0.26) : fur;
  const pink = tone(fur, color("#c98986"), 0.76);
  const cream = color("#fff1db"), pale = tail === 4 ? cream : accent || tone(fur, cream, 0.68);
  const palette = {
    F: base, H: tone(base, cream, 0.31), S: tone(base, color(tail === 4 || tail === 8 ? "#624052" : "#51435b"), 0.50),
    I: pale, T: tone(pale, color("#ad897c"), 0.45), D: accent || tone(fur, INK, 0.60),
    P: pink, Q: tone(pink, INK, 0.33),
  };
  const css = Object.fromEntries(Object.entries(palette).map(([key, ink]) =>
    [key, "#" + (ink & 0xffffff).toString(16).padStart(6, "0")]));
  const [top, rows] = shape;
  const sway = frame === 2 ? -1 : frame === 4 ? 1 : 0;
  const strips = rows.map(([x, row], dy) => [x + (dy < rows.length / 2 ? sway : 0), top + dy, row]);
  ctx.fillStyle = "#2b2233";
  for (const [x, y, row] of strips) for (let i = 0; i < row.length; i++) {
    if (row[i] !== ".") ctx.fillRect(x + i - 1, y - 1, 3, 3);
  }
  for (const [x, y, row] of strips) for (let i = 0; i < row.length; i++) {
    if (row[i] === ".") continue;
    ctx.fillStyle = css[row[i]];
    ctx.fillRect(x + i, y, 1, 1);
  }
}

/** A native 64×64 player/NPC frame, designed to occupy the same 32 logical pixels on screen. */
export function refinePerson(base, o = {}, view = "front", f = 0, seam) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = NATIVE;
  const ctx = cv.getContext("2d");
  const image = ctx.createImageData(NATIVE, NATIVE);
  const pixels = new Uint32Array(NATIVE * NATIVE);
  contour(seed(base, pixels), pixels);
  const fur = color(o?.fur), cloth = color(o?.cloth), bob = HEAD_BOB[f] || 0;
  if (fur && !o.bone && !o.mask) {
    const head = headAnchor(o);
    ears(pixels, head, bob, fur, view !== "back");
    if (view !== "back") {
      const face = faceAnchor(o, view);
      faceDetails(pixels, face, bob, o, fur, f);
      cheeks(pixels, face, bob, o, fur);
    }
    if (cloth) clothes(pixels, cloth, bob, view);
    pawsAndTail(pixels, fur, view === "side");
    if (seam?.form) tailJoin(pixels, seam.form, seam.tail);
  }
  for (let i = 0, j = 0; i < pixels.length; i++, j += 4) {
    const pigment = pixels[i];
    if (!pigment) continue;
    image.data[j] = (pigment >> 16) & 255;
    image.data[j + 1] = (pigment >> 8) & 255;
    image.data[j + 2] = pigment & 255;
    image.data[j + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return cv;
}
