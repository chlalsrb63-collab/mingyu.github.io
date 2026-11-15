/**
 * What a hero holds in both hands instead of the weapon (the server's carry code, 58-life.js carryOf): 1 the
 * delivery 알바's parcel — cardboard, a strip of tape, red twine and a little tag — and 2 the 우유 배달 chore's
 * milk crate with its bottles. Drawn in code at the heroes' density (64 px sheets drawn at 32: two pixels a
 * unit), three planes lit from the upper left, one dark outline, cached once per kind.
 */

const INK = "#2b2233";
export const W = 14, H = 12;          // logical size (units); the canvas is twice that
const PAL = {
  1: { T: "#e8b878", F: "#c98a4b", S: "#9a5f3a", e: "#ad7140", p: "#f3e3b0", q: "#d9c08a", r: "#d2453c", g: "#fff6e0", d: "#d2453c" },
  2: { T: "#7cc0f0", F: "#4f8fd6", S: "#3a62a8", e: "#335a9c", h: "#2b3f78", b: "#fbfbf4", c: "#ea5a5a" },
};
const cache = {};

/** The sprite of carry code `k` (1 parcel, 2 milk crate), or null. */
export function sprite(k) {
  if (cache[k] !== undefined) return cache[k];
  const pal = PAL[k];
  if (!pal || typeof document === "undefined") return (cache[k] = null);
  const cw = W * 2, chh = H * 2, px = new Array(cw * chh).fill(null);
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < cw && y < chh) px[y * cw + x] = c; };
  // a block in 2:1 three-quarter view: front x0..x1 × y0..y1, its top and right side going back `d` rows
  const x0 = 1, x1 = 18, y0 = 9, y1 = 22, d = 4;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, pal.F);
  for (let i = 1; i <= d; i++) {
    for (let x = x0 + 2 * i; x <= x1 + 2 * i; x++) put(x, y0 - i, pal.T);                       // the lit top
    for (let x = x1 + 2 * i - 1; x <= x1 + 2 * i; x++) for (let y = y0 - i + 1; y <= y1 - i; y++) put(x, y, pal.S);   // the shaded side
  }
  for (let x = x0; x <= x1; x++) put(x, y0, pal.e);                                              // the front's top edge
  if (k === 1) {
    // tape down the middle, over the top; red twine round the waist; a tag hanging off the corner
    for (let i = 0; i <= d; i++) for (let x = 8 + 2 * i; x <= 10 + 2 * i; x++) put(x, y0 - i, i ? pal.p : pal.q);
    for (let y = y0 + 1; y <= y1; y++) for (let x = 8; x <= 10; x++) put(x, y, x === 10 ? pal.q : pal.p);
    for (let x = x0; x <= x1; x++) put(x, 15, pal.r);
    for (let i = 1; i <= d; i++) put(x1 + 2 * i - 1, 15 - i, pal.r), put(x1 + 2 * i, 15 - i, pal.r);
    put(9, 14, pal.r); put(9, 16, pal.r); put(8, 14, pal.r); put(10, 16, pal.r);                  // the knot
    for (let y = 16; y <= 19; y++) for (let x = 2; x <= 5; x++) put(x, y, pal.g);               // the tag
    put(3, 17, pal.d); put(4, 17, pal.d); put(3, 18, pal.q); put(4, 18, pal.q);
  } else {
    // an open plastic crate: holes in the front, the dark inside under the rim, three bottles standing in it
    for (let i = 1; i < d; i++) for (let x = x0 + 2 * i + 1; x <= x1 + 2 * i - 2; x++) put(x, y0 - i, pal.h);
    for (const [hx, hy] of [[3, 12], [8, 12], [13, 12], [3, 17], [8, 17], [13, 17]]) for (let y = hy; y < hy + 3; y++) for (let x = hx; x < hx + 3; x++) put(x, y, pal.h);
    for (const bx of [6, 11, 16]) {
      for (let y = 1; y <= 7; y++) for (let x = bx; x <= bx + 2; x++) put(x, y, y <= 2 ? pal.c : pal.b);
      put(bx + 2, 3, pal.T); put(bx + 2, 4, pal.T);                                                // the glass's shaded side
    }
  }
  const cv = document.createElement("canvas");
  cv.width = cw; cv.height = chh;
  const g = cv.getContext("2d");
  // the outline: every empty pixel beside a filled one
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
    const c = px[y * cw + x];
    const edge = !c && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const u = x + dx, v = y + dy; return u >= 0 && v >= 0 && u < cw && v < chh && px[v * cw + u]; });
    if (c || edge) { g.fillStyle = c || INK; g.fillRect(x, y, 1, 1); }
  }
  return (cache[k] = cv);
}
