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
];
const NOSE_EDGE = [
  [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 1], null, [0, 1, 1], [-1, 2, 0],
  [0, 1, 0], [0, 1, -1], [0, 1, 0], [0, 1, 0], [0, 1, 0], [-1, 1, 0], [-2, 3, 0],
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

/** Ink the join where an exposed tail meets the head, retaining the one-pixel read at half scale. */
function tailJoin(pixels, head, tail) {
  const on = (rows, x, y) => (rows[y] >>> x) & 1;
  const exposed = (x, y) => on(tail, x, y) && !on(head, x, y);
  const meets = (x, y, nx, ny) => (
    (on(head, x, y) && exposed(nx, ny)) || (exposed(x, y) && on(head, nx, ny))
  );
  for (let y = 0; y < LOGICAL - 1; y++) for (let x = 0; x < LOGICAL - 1; x++) {
    if (meets(x, y, x + 1, y)) {
      const i = at(x * 2 + 2, y * 2);
      if (pixels[i]) pixels[i] = INK;
      if (pixels[i + NATIVE]) pixels[i + NATIVE] = INK;
    }
    if (meets(x, y, x, y + 1)) {
      const i = at(x * 2, y * 2 + 2);
      if (pixels[i]) pixels[i] = INK;
      if (pixels[i + 1]) pixels[i + 1] = INK;
    }
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
    if (seam?.head) tailJoin(pixels, seam.head, seam.tail);
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
