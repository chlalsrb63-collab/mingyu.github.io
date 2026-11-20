/**
 * Skill icons: one 32×32 picture per skill (03-skills.js ids), drawn natively at 32 in its job's palette (jobpal.js,
 * skills-v2.md §6) so a job's skills read as one family. The frame: actives a square with clipped corners, passives a
 * round medal, signatures with accent corners, a hybrid's rim split between its two weapons' colours; a two-pixel
 * bevelled rim (light top-left, dark bottom-right) round the job's dark backing, banded lighter toward the top with a
 * soft glow behind the motif. The motif is a list of parts, each a material and a union of shapes rasterised at pixel
 * centres: solid parts get a 3-step ramp from the light upper left (highlight edge / base / shadow edge) and one dark
 * outline round them all; flat parts (speed lines, arcs, bursts) are one colour, unlined, and an ink line wherever they
 * meet a solid. A combo state the skill puts on a monster is a pip top-right, one it spends a pip bottom-right
 * (skill-combos.md §2). Every icon is painted once per palette and cached (canvas + data URL).
 */
import { skillPal, skillOwner, skillDef, hybridParts, jobPal, mix, onJobDefs } from "./jobpal.js";

const N = 32, INK = "#120e16", WHITE = "#ffffff";
/** Combo states (skill-combos.md §2, colours as skillfx_combo.js pops them). */
const STATE = { stag: "#ffd86a", air: "#fff2a8", frz: "#bfe8ff", mk: "#ff7ad0", brand: "#c890ff", brn: "#ff9a3a", drag: "#9fe0c0" };
/** skill → [state it puts on, state it spends] (either may be empty). */
const COMBO = {
  slash: ["stag", "drag"], rend: ["air"], hook: ["drag"], comet: ["drag"], dragon: ["stag"], frostring: ["frz", "drag"],
  frostspire: ["frz"], shade: ["mk"], elemfan: ["mk"], soulbolt: ["brand"], gravity: ["drag"], fireball: ["brn"], meteor: ["brn"],
  cleave: ["", "stag"], snipe: ["", "stag"], ambush: ["", "air"], spiral: ["", "frz"], rupture: ["", "mk"], drain: ["", "brand"],
  ignite: ["", "brn"], hammer_stamp: ["stag"],
};

// ── shapes: predicates over integer pixel centres (0..31; the canvas centre is 15.5)
const H = Math.hypot, RAD = Math.PI / 180, cos = (a) => Math.cos(a * RAD), sin = (a) => Math.sin(a * RAD);
function seg(x, y, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l));
  return [H(x - x0 - t * dx, y - y0 - t * dy), t];
}
/** a stroke, `w0` wide at its start tapering (or swelling) to `w1` */
const L = (x0, y0, x1, y1, w0 = 2, w1 = w0) => (x, y) => { const [d, t] = seg(x, y, x0, y0, x1, y1); return d <= (w0 + (w1 - w0) * t) / 2; };
const C = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.5;
const E = (cx, cy, rx, ry) => (x, y) => ((x - cx) / (rx + 0.3)) ** 2 + ((y - cy) / (ry + 0.3)) ** 2 <= 1;
const R = (x0, y0, w, h) => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
const P = (...v) => (x, y) => {
  let c = false;
  for (let i = 0, j = v.length - 2; i < v.length; j = i, i += 2) {
    const xi = v[i], yi = v[i + 1], xj = v[j], yj = v[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** an arc band round (cx, cy), clockwise on screen from a0 to a1 degrees (0 = right, 90 = down), tapering w0 → w1 */
const A = (cx, cy, r, a0, a1, w0 = 2, w1 = w0) => (x, y) => {
  const a = (((Math.atan2(y - cy, x - cx) / RAD - a0) % 360) + 360) % 360;
  if (a > a1 - a0) return false;
  return Math.abs(H(x - cx, y - cy) - r) <= (w0 + ((w1 - w0) * a) / (a1 - a0 || 1)) / 2;
};
const U = (...f) => (x, y) => f.some((g) => g(x, y));
const I = (f, g) => (x, y) => f(x, y) && g(x, y);
const D = (f, g) => (x, y) => f(x, y) && !g(x, y);
const ring = (cx, cy, r, w = 2) => A(cx, cy, r, 0, 360, w);
const disc = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
/** an almond (eye, leaf) w wide and h tall: the meeting of two discs */
function almond(cx, cy, w, h, rot = 0) {
  const r = (h / 2 + (w * w) / (2 * h)) / 2, k = r - h / 2, ox = -sin(rot) * k, oy = cos(rot) * k;
  return I(disc(cx + ox, cy + oy, r), disc(cx - ox, cy - oy, r));
}
/** a teardrop of radius r, its point toward `ang` */
function drop(cx, cy, r, ang = -90) {
  const ux = cos(ang), uy = sin(ang), k = r * 0.95, b = r * 0.3;
  return U(C(cx, cy, r), P(cx - uy * k + ux * b, cy + ux * k + uy * b, cx + ux * r * 2.3, cy + uy * r * 2.3, cx + uy * k + ux * b, cy - ux * k + uy * b));
}
const star = (cx, cy, r, t = 0.3) => P(cx, cy - r, cx + r * t, cy - r * t, cx + r, cy, cx + r * t, cy + r * t, cx, cy + r, cx - r * t, cy + r * t, cx - r, cy, cx - r * t, cy - r * t);
const rays = (cx, cy, r0, r1, angs, w = 1.4) => U(...angs.map((a) => L(cx + cos(a) * r0, cy + sin(a) * r0, cx + cos(a) * r1, cy + sin(a) * r1, w, w * 0.6)));
const heart = (cx, cy, s = 1) => U(C(cx - 2.6 * s, cy - 1.4 * s, 3 * s), C(cx + 2.6 * s, cy - 1.4 * s, 3 * s), P(cx - 5.5 * s, cy - 0.6 * s, cx + 5.5 * s, cy - 0.6 * s, cx, cy + 6 * s));
const diamond = (cx, cy, r) => P(cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy);
/** a polyline through [x, y] pairs */
const poly = (w, ...v) => U(...v.slice(2).filter((_, i) => i % 2 === 0).map((_, i) => L(v[i * 2], v[i * 2 + 1], v[i * 2 + 2], v[i * 2 + 3], w)));
/** a sine wave along a line: `per` periods of `amp` */
function wave(x0, y0, x1, y1, amp, per, w = 1.2) {
  const l = H(x1 - x0, y1 - y0), nx = -(y1 - y0) / l, ny = (x1 - x0) / l, v = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, s = Math.sin(t * per * 2 * Math.PI) * amp; v.push(x0 + (x1 - x0) * t + nx * s, y0 + (y1 - y0) * t + ny * s); }
  return poly(w, ...v);
}
/** a leaf-shaped point at (x, y) aimed along `ang`, `len` long and `hw` wide */
function head(x, y, ang, len = 6, hw = 5) {
  const ux = cos(ang), uy = sin(ang), bx = x - ux * len, by = y - uy * len, mx = x - ux * len * 0.55, my = y - uy * len * 0.55;
  return P(bx, by, mx - uy * hw / 2, my + ux * hw / 2, x, y, mx + uy * hw / 2, my - ux * hw / 2);
}

// ── weapons and props: lists of parts
const dir = (x0, y0, x1, y1) => { const l = H(x1 - x0, y1 - y0) || 1; return [(x1 - x0) / l, (y1 - y0) / l]; };
/** a sword from its pommel (x0, y0) to its point (x1, y1): w blade width, g grip length, gw half the guard */
function sword(x0, y0, x1, y1, w = 3, g = 4, gw = w / 2 + 2) {
  const [ux, uy] = dir(x0, y0, x1, y1), gx = x0 + ux * g, gy = y0 + uy * g;
  return [["l", L(gx + ux, gy + uy, x1, y1, w, 1)], ["a", L(gx + uy * gw, gy - ux * gw, gx - uy * gw, gy + ux * gw, 2)], ["m", L(x0, y0, gx, gy, 2)], ["a", C(x0, y0, 1)]];
}
const dagger = (x0, y0, x1, y1) => sword(x0, y0, x1, y1, 2.6, 3, 2);
/** a spear from its butt to its point: hl head length, hw head width */
function spear(x0, y0, x1, y1, hl = 7, hw = 5, w = 2) {
  const [ux, uy] = dir(x0, y0, x1, y1), bx = x1 - ux * hl, by = y1 - uy * hl;
  return [["m", L(x0, y0, bx, by, w)], ["l", head(x1, y1, Math.atan2(uy, ux) / RAD, hl, hw)], ["a", L(bx + uy * 1.6, by - ux * 1.6, bx - uy * 1.6, by + ux * 1.6, 2)]];
}
/** an arrow from its nock to its point */
function arrow(x0, y0, x1, y1, h = 3.2, sw = 1.2) {
  const [ux, uy] = dir(x0, y0, x1, y1), fx = x0 + ux * 3.5, fy = y0 + uy * 3.5;
  return [["m", L(x0, y0, x1 - ux * h, y1 - uy * h, sw)], ["l", P(x1 + ux, y1 + uy, x1 - ux * h * 1.3 - uy * h * 0.8, y1 - uy * h * 1.3 + ux * h * 0.8, x1 - ux * h * 0.9, y1 - uy * h * 0.9, x1 - ux * h * 1.3 + uy * h * 0.8, y1 - uy * h * 1.3 - ux * h * 0.8)],
    ["a", L(fx, fy, x0 - uy * 2.4, y0 + ux * 2.4, 1.2), L(fx, fy, x0 + uy * 2.4, y0 - ux * 2.4, 1.2)]];
}
/** a hammer from the end of its haft to the centre of its head: hw head length across the haft, hh its depth */
function hammer(x0, y0, x1, y1, hw = 12, hh = 6) {
  const [ux, uy] = dir(x0, y0, x1, y1), c = (s, t) => [x1 + ux * s * hh / 2 - uy * t * hw / 2, y1 + uy * s * hh / 2 + ux * t * hw / 2];
  return [["m", L(x0, y0, x1, y1, 2.2)], ["l", P(...c(-1, -1), ...c(-1, 1), ...c(1, 1), ...c(1, -1))], ["a", L(...c(-1.25, -0.2), ...c(-1.25, 0.2), 2), C(x0, y0, 1.1)]];
}
/** a flame rising from (cx, cy): outer m, inner l, a hot core */
const flame = (cx, cy, r, ang = -90) => [["m", drop(cx, cy, r, ang)], ["l", drop(cx - cos(ang) * r * 0.35, cy - sin(ang) * r * 0.35, r * 0.55, ang)]];
/** an open book seen from the front, centred on its spine at (cx, cy) */
const book = (cx, cy, w = 10, h = 6) => [["m", P(cx - w - 1, cy + 1, cx, cy + 3, cx + w + 1, cy + 1, cx + w + 1, cy + h + 2, cx, cy + h + 3, cx - w - 1, cy + h + 2)],
  ["l", P(cx - w, cy - 1, cx - 0.5, cy + 1, cx - 0.5, cy + h + 1, cx - w, cy + h)], ["l", P(cx + 0.5, cy + 1, cx + w, cy - 1, cx + w, cy + h, cx + 0.5, cy + h + 1)]];
const sixAngles = [-90, -30, 30, 90, 150, 210];

/**
 * The pictures. Parts are [material, ...shapes]; later parts paint over earlier ones; "." erases.
 * Solid: l (light body), m (main), a (accent), d (dark), * (white-hot, unshaded), k (ink detail).
 * Flat, unlined: W (white-hot), L (light), M (main), A (accent), S (shadow).
 */
const ICON = {
  // ── 대검 (swordsman)
  slash: [ // 파워 슬래쉬: a greatsword at the end of a wide crescent sweep
    ["L", A(15.5, 18, 10.5, 190, 335, 1, 5)], ["W", A(15.5, 18, 10.5, 230, 330, 0.8, 2)],
    ...sword(6, 26, 20, 12, 3.8, 4.5),
  ],
  rend: [ // 대지 가르기: an overhead sweep that ends in a split in the ground, rocks flung up
    ["L", A(14, 21, 9, 182, 300, 1, 3.5)],
    ["m", D(R(5, 23, 23, 3), P(18, 22, 25, 22, 21.5, 26))], ["k", L(6, 24, 17, 24, 1)],
    ...sword(13, 11, 21.5, 21.5, 3, 4),
    ["a", C(25, 16, 1.3)], ["a", C(26, 20, 0.9)],
  ],
  inertia: [ // 거검의 관성: chevrons of gathering momentum over a five-stack gauge
    ["S", L(5, 14.5, 7, 14.5, 1)], ["m", L(8, 9, 12, 14, 2.2), L(12, 14, 8, 19, 2.2)], ["m", L(13, 9, 17, 14, 2.4), L(17, 14, 13, 19, 2.4)],
    ["l", L(18, 8, 23, 14, 2.8), L(23, 14, 18, 20, 2.8)],
    ["a", R(9, 22, 2, 2), R(12, 22, 2, 2), R(15, 22, 2, 2)], ["d", R(18, 22, 2, 2), R(21, 22, 2, 2)],
  ],
  sword_steadfast20: [ // 반걸음 버티기: a boot planted flat, the ground taking its weight
    ["L", L(7, 20, 8, 18, 1), L(24, 18, 25, 20, 1)],
    ["l", U(R(12, 7, 6, 9), P(11, 15, 18, 15, 23, 18, 23, 21, 11, 21))], ["a", R(11, 7, 8, 2)], ["m", R(10, 21, 14, 2)],
    ["m", L(9, 24.5, 22, 24.5, 2)],
  ],
  sword_fortify30: [ // 벼랑 끝 투지: a cracked shield, flames climbing behind it
    ...flame(11.5, 11, 2.6, -100), ...flame(20, 10, 3, -80),
    ["a", P(8.5, 11, 22.5, 11, 22.5, 17, 15.5, 25, 8.5, 17)], ["k", poly(1, 16, 11, 14, 15, 17, 18, 15.5, 23)],
  ],
  sword_weight40: [ // 날에 실은 무게: a blade driven into the ground, the quake ringing out
    ["M", D(E(15.5, 21.5, 10, 3.6), E(15.5, 21.5, 8, 2.5))], ["L", D(E(15.5, 21.5, 6, 2.4), E(15.5, 21.5, 4, 1.3))],
    ...sword(15.5, 5, 15.5, 21, 3.2, 4),
  ],
  sword_edge50: [ // 칼끝의 결단: a skull struck through by one bright cut
    ["l", C(15.5, 13, 6.5), R(11, 16, 10, 5)],
    ["k", C(12.5, 13.5, 1.6), C(18.5, 13.5, 1.6), P(15.5, 15.5, 14.5, 17.5, 16.5, 17.5), R(13, 19, 1, 2), R(15, 19, 1, 2), R(17, 19, 1, 2)],
    ["*", L(7, 23, 24, 7, 1.2)],
  ],
  verdict: [ // 단죄의 일격: a greatsword brought straight down, the ground bursting round it
    ["M", L(9.5, 5, 9.5, 12, 1), L(21.5, 5, 21.5, 11, 1), L(12, 5, 12, 8, 1)],
    ["L", rays(15.5, 23, 4, 10, [195, 220, 245, 295, 320, 345], 1.6)],
    ["m", R(5, 24, 22, 2)],
    ...sword(15.5, 5, 15.5, 22, 5, 4, 4),
  ],
  cleave: [ // 처형 내려베기: a blade straight down onto the block
    ["M", L(8.5, 6, 8.5, 12, 1), L(18.5, 6, 18.5, 11, 1)],
    ["m", D(R(5, 21, 16, 5), P(10.5, 20, 15.5, 20, 13, 23))],
    ["W", rays(13, 21, 3, 7, [200, 235, 305, 340], 1.4)],
    ...sword(13, 4, 13, 21, 4, 4.5, 3.5),
  ],
  whirl: [ // 돌개바람: a greatsword swung through a whirlwind
    ["L", A(15.5, 15.5, 10, 30, 300, 1, 4)], ["W", A(15.5, 15.5, 6, 210, 480, 1, 2.6)],
    ...sword(7, 24, 23, 8, 3.8, 4.5),
  ],

  // ── 단검 (thief)
  ambush: [ // 암습: gone in smoke, back behind the target with the point first
    ["M", C(8, 20.5, 2.6), C(11.5, 23, 2), C(7, 24, 1.6)], ["L", C(7.5, 19.5, 1)],
    ["A", A(17, 19, 9.5, 190, 255, 1, 2)], ["A", P(13.5, 6.5, 18.5, 9.3, 13.5, 12.5)],
    ...dagger(25, 6, 15, 17),
  ],
  shade: [ // 그림자 칼날: three knives thrown in a fan, shadows streaming behind
    ["M", L(4, 13, 8, 11.5, 1), L(5, 16.5, 9, 16.5, 1), L(4, 20, 8, 21.5, 1)],
    ...dagger(9, 11, 19, 7.5), ...dagger(10, 16.5, 24, 16.5), ...dagger(9, 22, 19, 25.5),
  ],
  vitals: [ // 급소 도려내기: a dagger, a drop running off its point
    ...sword(22.5, 7, 10.5, 19.5, 3.4, 4.5, 2.6), ["a", drop(9.5, 23.5, 2.2, -90)],
  ],
  dagger_shade20: [ // 그림자 보폭: a paw print, its shadow already a step ahead
    ["S", C(20.5, 12, 3), C(17, 7.8, 1.3), C(20.5, 6.6, 1.3), C(24, 7.8, 1.3)], ["L", L(6, 10, 10, 10, 1), L(24, 20, 27, 20, 1)],
    ["l", C(11.5, 21, 3.6), C(7, 16, 1.6), C(11.5, 14.3, 1.6), C(16, 16, 1.6)],
  ],
  dagger_snap30: [ // 그림자 회수: a clock face, the arrow round it winding back
    ["a", A(15.5, 16, 9, 150, 420, 2.4, 1.2)], ["a", P(9.4, 23.4, 5.4, 21.8, 10, 19.2)],
    ["l", C(15.5, 16, 5.5)], ["k", L(15.5, 16, 15.5, 12, 1), L(15.5, 16, 18.5, 16, 1)],
  ],
  dagger_edge40: [ // 빈틈을 읽는 눈: a wide-open eye, a glint of the first strike
    ["l", almond(15.5, 16.5, 19, 10)], ["a", C(15.5, 16.5, 3.8)], ["k", L(15.5, 13, 15.5, 20, 1.6)],
    ["*", star(22.5, 9, 3, 0.25)],
  ],
  dagger_fang50: [ // 피를 머금은 날: two fangs, a drop falling from one
    ["m", P(7, 8, 24, 8, 22, 12.5, 9, 12.5)],
    ["l", P(9.5, 11.5, 14.5, 11.5, 12, 22)], ["l", P(16.5, 11.5, 21.5, 11.5, 19, 21)],
    ["a", drop(12, 25, 1.6, -90)],
  ],
  flurry: [ // 무영난무: two cuts crossing, more flickering round them
    ["M", L(5, 15.5, 9, 15.5, 1), L(22, 15.5, 26, 15.5, 1), L(15.5, 4, 15.5, 7, 1), L(15.5, 24, 15.5, 27, 1)],
    ["L", L(6, 6, 25, 25, 1, 4)], ["L", L(25, 6, 6, 25, 1, 4)], ["W", L(9, 9, 22, 22, 0.8, 1.6), L(22, 9, 9, 22, 0.8, 1.6)],
    ["*", star(15.5, 15.5, 4, 0.3)],
  ],
  rupture: [ // 급소 터뜨리기: a dagger driven into the mark, the mark bursting
    ["W", rays(19.5, 11, 5.5, 8.5, [-90, -45, 0, 45, 135, 180], 1.4)],
    ["a", diamond(19.5, 11, 4.5)], ["k", poly(1, 19.5, 7.5, 18.5, 10.5, 20.5, 12.5, 19.5, 14.5)],
    ...dagger(6, 25, 16, 14.5),
  ],

  // ── 창 (lancer)
  spiral: [ // 나선 찌르기: a spear point, the shaft wound round with a spiral
    ["L", L(4, 21, 8, 17, 1), L(10, 27, 14, 23, 1)],
    ...spear(5, 26, 25, 6, 8, 6), ["a", wave(7, 24, 18, 13, 2.2, 2.5, 1.6)],
  ],
  comet: [ // 유성창: a levelled spear and the comet's tail of wind behind it
    ["M", L(5, 16.5, 22, 16.5, 1, 7)], ["L", L(9, 16.5, 22, 16.5, 1, 4)],
    ["L", L(5, 10, 11, 10, 1), L(7, 23, 13, 23, 1), L(4, 26, 8, 26, 1)],
    ...spear(5, 16.5, 27, 16.5, 8, 6),
  ],
  tip: [ // 창끝의 거리: a ruler to the far end, and the star at the spear's point
    ["m", L(7, 22.5, 22, 22.5, 1.2), L(7, 20.5, 7, 24.5, 1), L(12, 21.5, 12, 23.5, 1), L(17, 21.5, 17, 23.5, 1), L(22, 20.5, 22, 24.5, 1)],
    ...spear(7, 19, 18, 11, 7, 6, 2.4), ["a", star(21, 8.5, 3.4, 0.3)],
  ],
  rally_banner: [ // 전열의 깃발: a swallow-tailed banner, the rally ring at its foot
    ["L", D(E(11, 25, 6, 1.8), E(11, 25, 4, 0.8))],
    ["m", L(10.5, 6, 10.5, 25, 2)], ["a", C(10.5, 5.5, 1.3)],
    ["a", P(12, 6.5, 26, 8, 22, 11.5, 26, 15, 12, 15.5)], ["l", star(17, 11, 2.8, 0.35)],
  ],
  spear_guard20: [ // 전열의 간격: a spear held upright behind a buckler, a guard arc before it
    ["L", A(15.5, 18, 10, 200, 340, 1.4)],
    ...spear(15.5, 26, 15.5, 5, 7, 5), ["a", C(15.5, 17.5, 4)], ["l", C(15.5, 17.5, 1.3)],
  ],
  spear_advance30: [ // 창끝 반동: the point thrusts out, the arrow bending back to the start
    ...spear(6, 12.5, 25, 12.5, 7, 6),
    ["a", A(19, 19, 3.5, -90, 90, 2), L(19, 22.5, 11, 22.5, 2), P(7.5, 22.5, 11.5, 19.5, 11.5, 25.5)],
  ],
  spear_truss40: [ // 굽히지 않는 창대: a shaft bowed under the load, braced on a block
    ["L", L(21, 21, 23, 23, 1), L(18, 23, 19.5, 25, 1)],
    ["a", R(6, 22, 8, 4)], ["m", A(26, 29, 18, 200, 248, 3)], ["l", P(18.8, 13, 23, 14.6, 25, 9.8, 20, 8.3)],
  ],
  spear_edge50: [ // 하나로 모인 힘: lines of force meeting in one bright point
    ["M", L(6, 21, 18, 13, 1), L(9, 25, 19, 14, 1), L(6, 14, 17, 12.5, 1), L(23, 24, 20, 14, 1)],
    ...spear(8, 23, 18, 13, 6, 4.5), ["*", star(20.5, 10.5, 4, 0.25)],
  ],
  dragon: [ // 뇌룡승천: a thunderbolt rising, forking on to the next
    ["L", L(24, 12, 24, 17, 1), L(26, 14, 26, 18, 1)],
    ["a", P(9, 5, 18, 13, 14, 14, 21, 26, 10, 16, 14, 15)], ["a", L(11, 16, 5, 21, 2.2, 0.8)],
    ["W", C(5, 22.5, 0.5), C(21.5, 26.5, 0.5)],
  ],
  hook: [ // 갈고리 창: a shaft ending in a barb turned back, dragging in
    ["L", L(9, 17, 12, 20, 1), L(5, 21, 8, 24, 1)],
    ["m", L(5, 26, 15.5, 15.5, 2)], ["l", A(18.5, 12, 4.6, 120, 390, 2.8, 0.8)], ["a", C(15.5, 15.5, 1.4)],
  ],
  musou: [ // 무쌍난무: spear points whirled round in a ring
    ["L", A(15.5, 15.5, 9, 30, 95, 0.8, 2.6), A(15.5, 15.5, 9, 150, 215, 0.8, 2.6), A(15.5, 15.5, 9, 270, 335, 0.8, 2.6)],
    ["l", head(15.5 + cos(105) * 9 - sin(105) * 3, 15.5 + sin(105) * 9 + cos(105) * 3, 195, 7, 4.5)],
    ["l", head(15.5 + cos(225) * 9 - sin(225) * 3, 15.5 + sin(225) * 9 + cos(225) * 3, 315, 7, 4.5)],
    ["l", head(15.5 + cos(345) * 9 - sin(345) * 3, 15.5 + sin(345) * 9 + cos(345) * 3, 75, 7, 4.5)],
    ["a", C(15.5, 15.5, 3)], ["*", C(14.5, 14.5, 0.5)],
  ],

  // ── 스태프 (wizard)
  fireball: [ // 파이어볼: a blazing ball flying, its fire streaming behind
    ["M", L(4, 22, 15, 17, 1, 8)], ["L", L(5, 17, 14, 15, 1, 3.5), L(7, 25, 15, 19.5, 1, 3)],
    ["m", C(18, 16, 6)], ["l", C(17, 15, 3.5)], ["*", C(16, 14, 1.2)],
  ],
  frostring: [ // 서리 고리: a snowflake in a ring of frost
    ["L", A(14, 16, 10.5, 95, 265, 1, 1.6)],
    ["a", rays(14, 16, 0, 8, sixAngles, 2.2), ...sixAngles.map((a) => L(14 + cos(a) * 5, 16 + sin(a) * 5, 14 + cos(a - 40) * 7.4, 16 + sin(a - 40) * 7.4, 1.2)),
      ...sixAngles.map((a) => L(14 + cos(a) * 5, 16 + sin(a) * 5, 14 + cos(a + 40) * 7.4, 16 + sin(a + 40) * 7.4, 1.2))],
    ["*", C(14, 16, 1.4)],
  ],
  reso: [ // 마력 공명: fire, ice and lightning turning round one point
    ["S", ring(15.5, 15.5, 7.5, 1)], ["L", A(15.5, 15.5, 7.5, -60, -10, 1.6, 0.6), A(15.5, 15.5, 7.5, 60, 110, 1.6, 0.6), A(15.5, 15.5, 7.5, 180, 230, 1.6, 0.6)],
    ["m", C(15.5, 8, 2.8)], ["a", C(9, 19.3, 2.8)], ["l", C(22, 19.3, 2.8)], ["*", C(15.5, 15.5, 1.2)],
  ],
  staff_mind20: [ // 깊은 마력 그릇: a deep bowl, mana pooled and an orb rising from it
    ["m", U(I(disc(15.5, 15, 8), R(0, 16, 32, 16)), R(12, 22, 8, 3))], ["A", E(15.5, 16, 6.5, 1.2)],
    ["a", C(15.5, 9, 3)], ["L", C(10, 6, 0.6), C(21.5, 8, 0.6)],
  ],
  staff_chant30: [ // 원소 증폭: three element rings overlapping
    ["m", ring(12.5, 13, 4.5, 2.2)], ["a", ring(18.5, 13, 4.5, 2.2)], ["l", ring(15.5, 18.5, 4.5, 2.2)], ["*", C(15.5, 15, 1)],
  ],
  staff_spark40: [ // 정신 집중: a closed eye, a light kindled above it
    ["l", A(15.5, 11, 9, 30, 150, 2.4)], ["l", L(10, 18.5, 8.5, 21.5, 1.4), L(15.5, 20, 15.5, 23.5, 1.4), L(21, 18.5, 22.5, 21.5, 1.4)],
    ["W", rays(15.5, 8.5, 4.5, 6.5, [-45, -135, 45, 135], 1)], ["a", star(15.5, 8.5, 4.2, 0.25)],
  ],
  staff_flood50: [ // 쏟아지는 마력: a flask brimming over, mana spilling down its side
    ["l", C(15.5, 18.5, 6), R(13, 8, 5, 6)], ["m", R(12, 7, 7, 2)], ["a", I(C(15.5, 18.5, 4.6), R(0, 17, 32, 15))],
    ["a", L(12, 8, 9, 12, 1.8), drop(8.5, 16, 1.5, -90), drop(23, 12, 1.2, -90)],
  ],
  meteor: [ // 메테오 스톰: a stone falling out of the sky, fire behind it
    ["M", L(5, 5, 16, 16, 1, 10)], ["L", L(7, 7, 16, 16, 1, 5)], ["M", L(4, 15, 8, 19.5, 1, 2.5)],
    ["d", C(18.5, 19.5, 5.5)], ["k", C(20, 22, 1), C(16.5, 18, 0.6)], ["l", L(14.5, 16.5, 17, 17.5, 1)],
    ["m", C(9, 21, 1.6)],
  ],
  ignite: [ // 점화 폭발: a flame bursting out in a ring of rays
    ["L", rays(15.5, 16, 8, 11.5, [0, 45, 90, 135, 180, 225, 270, 315], 1.8)], ["S", ring(15.5, 16, 7, 1)],
    ...flame(15.5, 17, 4.8), ["*", C(15.5, 19, 1)],
  ],

  // ── 마도서 (warlock)
  soulbolt: [ // 영혼 화살: a soul wisp flying, its tail curling behind
    ["M", A(10.5, 21, 4, 300, 560, 0.8, 2.6)], ["L", L(7, 13, 11, 13, 1), L(12, 26, 16, 26, 1)],
    ["l", drop(17.5, 13, 4.6, 135)], ["k", R(16, 11, 1, 2), R(19, 11, 1, 2)],
  ],
  gravity: [ // 중력 왜곡진: a vortex winding in on its dark heart
    ["S", C(5.5, 7, 0.6), C(25, 25, 0.6), C(7, 25, 0.6)],
    ["m", A(15.5, 16, 9, 0, 150, 1, 3.2)], ["m", A(15.5, 16, 9, 180, 330, 1, 3.2)],
    ["l", A(15.5, 16, 6, 60, 210, 1, 2.6)], ["l", A(15.5, 16, 6, 240, 390, 1, 2.6)],
    ["a", C(15.5, 16, 3.2)], ["k", C(15.5, 16, 1.8)],
  ],
  brand: [ // 금서의 낙인: an eye burned into a diamond sigil
    ["m", D(diamond(15.5, 15.5, 10.5), diamond(15.5, 15.5, 7.5))],
    ["l", almond(15.5, 15.5, 11, 6.5)], ["a", C(15.5, 15.5, 2)], ["k", C(15.5, 15.5, 0.5)],
  ],
  revive_binding: [ // 결속의 부활: an open book, a cross rising from its pages
    ["W", rays(15.5, 10, 6, 8, [-30, -150, 0, 180], 1)], ["L", C(8.5, 8, 0.6), C(23, 6.5, 0.6)],
    ...book(15.5, 18, 10, 6), ["a", R(14, 5, 4, 11), R(11, 8, 10, 4)],
  ],
  book_margin20: [ // 널찍한 여백: an open book, a heart written in its margin
    ...book(15.5, 15.5, 9, 6), ["k", L(9, 18, 13, 19, 1), L(9, 20, 12, 20.5, 1)],
    ["m", heart(20, 9.5, 0.75)],
  ],
  book_clause30: [ // 낙인 전염: the brand leaping on to two more
    ["L", L(13.5, 15, 17.5, 11.5, 1), L(14.5, 18.5, 19.5, 19.5, 1)],
    ["m", diamond(10, 18, 5)], ["l", C(10, 18, 1.5)], ["a", diamond(20, 9.5, 3)], ["a", diamond(22.5, 19.5, 3)],
  ],
  book_ink40: [ // 묵향의 잔재: a quill's nib and the heavy drop of ink off it
    ["l", P(15.5, 14, 19.5, 8, 18, 4.5, 13, 4.5, 11.5, 8)], ["k", L(15.5, 8, 15.5, 13, 1), C(15.5, 8, 0.5)],
    ["d", drop(15.5, 21, 3.6, -90)], ["*", C(14, 21, 0.5)],
  ],
  book_return50: [ // 영혼 흡수: a soul drawn down head first into the closed tome
    ["L", L(9, 6, 9, 12, 1), L(22, 7, 22, 13, 1), L(12, 4.5, 12, 7, 1)],
    ["l", drop(15.5, 13.5, 3.4, -90)], ["k", R(14, 13, 1, 2), R(17, 13, 1, 2)],
    ["m", R(8, 19, 16, 6)], ["l", R(9, 23, 14, 1)], ["a", R(14, 19, 4, 6)],
  ],
  drain: [ // 영혼 착취: a soul pulled up out of the target along a thread into the book
    ...book(11, 20, 6.5, 4.5), ["a", wave(12, 18.5, 20, 9.5, 1.3, 1.5, 1.4)],
    ["l", C(22, 8, 3)], ["k", R(21, 7, 1, 2), R(23, 7, 1, 2)],
  ],
  pact: [ // 심연의 계약: the abyss beast's head, horns and burning eyes
    ["l", P(9, 13, 12, 11, 7.5, 4, 5.5, 8.5)], ["l", P(22, 13, 19, 11, 23.5, 4, 25.5, 8.5)],
    ["m", P(9, 11, 22, 11, 24.5, 17, 19.5, 25, 11.5, 25, 6.5, 17)],
    ["a", P(9.5, 15, 14, 16.5, 13, 18.5, 9.5, 17)], ["a", P(21.5, 15, 17, 16.5, 18, 18.5, 21.5, 17)],
    ["k", R(12, 20, 7, 1)], ["l", P(12.5, 21, 14.5, 21, 13.5, 24.5)], ["l", P(16.5, 21, 18.5, 21, 17.5, 24.5)],
  ],

  // ── 활 (archer)
  pierce: [ // 관통 화살: one arrow straight through three marks
    ["L", L(5, 11, 9, 11, 1), L(5, 22, 9, 22, 1)],
    ["a", D(E(10, 16.5, 2.4, 5.5), E(10, 16.5, 0.8, 3.8))], ["a", D(E(16, 16.5, 2.4, 5.5), E(16, 16.5, 0.8, 3.8))], ["a", D(E(22, 16.5, 2.4, 5.5), E(22, 16.5, 0.8, 3.8))],
    ...arrow(4, 16.5, 27, 16.5, 3.4),
  ],
  leapshot: [ // 도약 사격: three arrows fanned forward, the hop back away from them
    ["L", L(9, 11, 13, 9.5, 1), L(9, 15.5, 13, 15.5, 1)],
    ...arrow(13, 13, 26, 7, 3.4), ...arrow(13, 16, 27, 17, 3.4),
    ["A", A(12, 24, 5, 190, 350, 1, 2.4)], ["A", P(4.5, 21.5, 9, 22, 6, 26.5)],
  ],
  hawk: [ // 매의 시야: a hawk's eye, brow and tear-stripe, sighting far
    ["m", P(6, 12, 24, 8.5, 25.5, 11.5, 10, 13.5)],
    ["l", almond(15.5, 16.5, 16, 8.5)], ["a", C(16.5, 16.5, 3.4)], ["k", C(16.5, 16.5, 1.5)], ["*", C(15, 15, 0.5)],
    ["m", P(11.5, 20.5, 15, 21, 13, 25.5, 10, 24.5)],
  ],
  bow_lithe20: [ // 나뭇가지 걸음: a leaf carried on the wind
    ["L", L(6, 10, 11, 10, 1), L(19, 22.5, 25, 22.5, 1), L(5, 14, 8, 14, 1)],
    ["l", I(disc(12, 12, 9), disc(19, 19, 9))], ["m", L(9, 22, 22, 9, 1)], ["m", L(6.5, 24.5, 10, 21, 1.4)],
  ],
  bow_string30: [ // 연속 사격: a drawn bow loosing two arrows at once
    ["m", A(19, 15.5, 10, 120, 240, 2.4)], ["L", L(14, 7, 14, 24, 1)],
    ...arrow(9, 12.5, 25, 12.5, 3), ...arrow(9, 18.5, 25, 18.5, 3),
  ],
  bow_focus40: [ // 바람 틈의 표적: a target and the one small point at its heart
    ["l", ring(15.5, 15.5, 8.5, 2.4)], ["m", ring(15.5, 15.5, 5, 2.2)], ["a", C(15.5, 15.5, 1.6)],
    ["L", L(4.5, 15.5, 6, 15.5, 1), L(25, 15.5, 26.5, 15.5, 1)],
  ],
  bow_quill50: [ // 약점 포착: a target split open where the arrow found its weak point
    ["l", D(ring(15, 16.5, 7.5, 2.4), L(19, 7, 12, 26, 2.4))], ["m", D(ring(15, 16.5, 4, 2.2), L(19, 7, 12, 26, 2.4))],
    ["*", poly(1, 18.5, 8.5, 16.5, 13, 17.5, 15)],
    ...arrow(24, 24, 16.5, 16.5, 3),
  ],
  rain: [ // 화살비: arrows coming down out of the sky
    ...arrow(11, 4.5, 8, 14, 2.8), ...arrow(18, 4, 15, 14, 2.8), ...arrow(25, 6, 22, 15.5, 2.8), ...arrow(14, 13, 11, 24, 2.8), ...arrow(22, 14, 19, 25, 2.8),
    ["W", C(7, 18, 0.5), C(10, 27, 0.5), C(18, 27, 0.5)],
  ],
  snipe: [ // 저격: a long arrow flying into the crosshair's heart
    ["l", ring(17, 13, 6.5, 1.6), L(17, 4, 17, 8, 1.4), L(17, 18, 17, 22, 1.4), L(8, 13, 12, 13, 1.4), L(22, 13, 26, 13, 1.4)],
    ...arrow(4, 26, 15.5, 14.5, 3), ["a", C(17, 13, 1)],
  ],

  // ── hybrid signatures
  crimson: [ // 원소 마검: 홍련참: a blade wrapped in fire
    ...flame(12.3, 16.1, 2.2, -120), ...flame(15.9, 12.4, 2.4, -120), ...flame(19.4, 9, 2, -120),
    ["A", drop(15, 21, 1.4, 20), drop(20, 16, 1.2, 20)],
    ...sword(7, 25, 24, 8, 3.4, 4),
  ],
  traps: [ // 사방의 그림자 덫: a sprung trap, its shadow kin set on every side
    ["m", D(almond(15.5, 16, 15, 9), almond(15.5, 16, 10.5, 4.5))],
    ["l", poly(1.3, 9, 16, 10.5, 13.8, 12, 16, 13.5, 13.8, 15, 16, 16.5, 13.8, 18, 16, 19.5, 13.8, 21, 16, 22.5, 13.8)],
    ["a", diamond(15.5, 6, 2.2), diamond(25.5, 16, 2.2), diamond(15.5, 26, 2.2), diamond(5.5, 16, 2.2)],
  ],
  dive: [ // 빙결 강림 (마창사): a frost lance plunging down, ice shards bursting open
    ["M", L(10.5, 5, 10.5, 11, 1), L(20.5, 5, 20.5, 10, 1), L(13, 4, 13, 7, 1)],
    ["A", rays(15.5, 22, 3, 9, [190, 215, 240, 300, 325, 350], 1.6)],
    ["l", P(6, 25, 9, 18, 12, 25), P(20, 25, 23, 18, 26, 25)],
    ["m", D(R(5, 23, 22, 3), P(13, 22.5, 18, 22.5, 15.5, 26))],
    ...spear(15.5, 4, 15.5, 21, 7, 6), ["*", C(15.5, 21, 1.3)],
  ],
  bloodburst: [ // 혈흔 폭발 (블레이드댄서): a mark split open, crimson blades & blood bursting out
    ...[-90, -30, 30, 90, 150, 210].map((a) => ["m", drop(15.5 + cos(a + 30) * 8, 15.5 + sin(a + 30) * 8, 1.7, a + 30)]),
    ["a", D(diamond(15.5, 15.5, 5.5), L(12.5, 9, 18.5, 22, 1.6))],
  ],
  sanctuary: [ // 성광의 성역 (성기사): a golden ring of light round a radiant holy cross
    ["l", A(15.5, 15.5, 10, 12, 78, 2.6), A(15.5, 15.5, 10, 102, 168, 2.6), A(15.5, 15.5, 10, 192, 258, 2.6), A(15.5, 15.5, 10, 282, 348, 2.6)],
    ["a", R(14, 9, 3, 13), R(10, 13.5, 11, 3)], ["*", R(15, 10, 1, 11), R(11, 14.5, 9, 1)],
  ],
  crosscut: [ // 십자 난도 (블레이드댄서): twin daggers crossing in a rapid blade-dance arc
    ["L", A(15.5, 15.5, 10.5, 120, 410, 1, 3.2)], ["W", A(15.5, 15.5, 10.5, 300, 400, 0.8, 1.6)],
    ...dagger(9, 22, 21, 10), ...dagger(22, 22, 10, 10),
  ],
  elemfan: [ // 원소 환영탄 (트릭스터): a staff fanning three elemental arcane shards (flame, frost, lightning)
    ["m", L(15.5, 27, 15.5, 18, 2.2)], ["a", C(15.5, 17, 2.4)],
    ["L", L(15.5, 17, 8, 9, 1.2, 2.2), L(15.5, 17, 15.5, 7, 1.2, 2.2), L(15.5, 17, 23, 9, 1.2, 2.2)],
    ["a", drop(7.5, 8.5, 2.3, -120)], ["*", star(15.5, 6.5, 3, 0.3)], ["A", poly(1.4, 21.5, 6.5, 24.5, 8.5, 22, 10, 25, 12)],
  ],
  frostspire: [ // 빙결창 (마창사): a spear's thrust, ice standing up where its point stopped
    ["L", L(5, 15, 10, 15, 1), L(6, 25.5, 11, 25.5, 1)],
    ...spear(4, 20.5, 16, 20.5, 6, 5),
    ["l", P(17, 25, 19.5, 11, 22, 25)], ["l", P(21, 25, 24.5, 14, 27, 25)], ["m", P(15, 25, 16.5, 17, 18.5, 25)], ["a", R(14, 25, 14, 2)],
  ],
  runecircle: [ // 메아리 법진 (룬브레이커): a circle cut with a triangle, its echo ringing outward
    ["S", ring(15.5, 15.5, 11.5, 1)], ["m", ring(15.5, 15.5, 8.5, 2)],
    ["a", D(P(15.5, 8, 22.5, 20, 8.5, 20), P(15.5, 11.5, 19.5, 18.5, 11.5, 18.5))], ["l", C(15.5, 16, 1.2)],
  ],
  inkshot: [ // 룬 파쇄탄 (룬브레이커): an open runic tome loosing fanned ink-rune bolts
    ...book(15.5, 18, 9, 5),
    ["L", L(15.5, 18, 7, 7, 1.2, 2.2), L(15.5, 18, 15.5, 5.5, 1.4, 2.4), L(15.5, 18, 24, 7, 1.2, 2.2)],
    ["a", diamond(7, 7, 2.5), diamond(15.5, 5.5, 2.8), diamond(24, 7, 2.5)],
    ["*", C(7, 7, 0.9), C(15.5, 5.5, 1), C(24, 7, 0.9)],
  ],

  // ── 망치 (destroyer)
  hammer_stamp: [ // 내려찍기: a hammer stamping one point, the ground cracking round it
    ["A", rays(15, 23, 2.5, 7, [195, 225, 315, 345], 1.4)], ["m", R(5, 24, 22, 2)], ["k", poly(1, 15, 24, 14, 25, 16, 25.5)],
    ...hammer(6, 6, 15, 18, 12, 6),
  ],
  hammer_fault: [ // 단층 가르기: rock faces split along a stepped fault
    ["a", C(16, 8, 1.2), C(20.5, 11, 1), C(11, 7, 0.9)],
    ["m", P(5, 13, 14, 11, 15, 25, 5, 25)], ["l", P(17, 17, 27, 15, 27, 25, 18, 25)],
    ["k", poly(1, 8, 17, 10, 19, 9, 22), L(21, 19, 24, 21, 1)],
  ],
  hammer_final: [ // 대지의 종언: a great hammer coming down, a low shockwave rolling out
    ["M", L(6.5, 5, 6.5, 11, 1), L(25.5, 5, 25.5, 11, 1)],
    ["L", D(E(15.5, 24, 11, 3), E(15.5, 24, 8, 1.6))], ["A", D(E(15.5, 24, 6.5, 1.8), E(15.5, 24, 4, 0.8))],
    ["m", L(15.5, 4, 15.5, 9, 2.4)], ["l", R(8, 9, 16, 8)], ["a", R(8, 9, 2, 8), R(22, 9, 2, 8)],
    ["W", L(10.5, 18.5, 10.5, 20.5, 1), L(21.5, 18.5, 21.5, 20.5, 1)],
  ],
  hammer_crack: [ // 균열: a boulder split by a crack, chips flying
    ["m", C(15.5, 17, 8)], ["k", poly(1.2, 14, 9, 17, 14, 13, 18, 16, 24.5), L(17, 14, 21.5, 16, 1)],
    ["l", C(23.5, 8.5, 1.2), C(8, 9.5, 1)],
  ],
  hammer_brace: [ // 버팀: a leg braced, its boot set hard against the wall
    ["L", L(15.5, 8, 15.5, 12, 1), L(12.5, 9, 13, 12, 1), L(18.5, 9, 18, 12, 1)],
    ["l", L(11.5, 10, 10, 16, 3.6), P(6, 15, 12.5, 15, 13, 20, 5.5, 20)], ["l", L(19.5, 10, 21, 16, 3.6), P(18.5, 15, 25, 15, 25.5, 20, 18, 20)],
    ["m", R(7, 21, 18, 3)], ["a", R(5, 20, 2, 4), R(25, 20, 2, 4)],
  ],
  hammer_hold: [ // 버티기: a hammer held upright, its grip bound tight
    ["l", R(10, 7, 12, 5)], ["m", L(15.5, 12, 15.5, 25, 2)], ["a", R(14, 17, 4, 2), R(14, 20, 4, 2), R(14, 24, 4, 2)],
  ],
  hammer_breath: [ // 숨 고르기: a long breath let out in a puff
    ["L", wave(16, 23.5, 26, 23.5, 1, 1.5, 1), wave(6, 9, 13, 9, 0.8, 1.2, 1)],
    ["l", U(C(10.5, 16.5, 3.5), C(15.5, 13.5, 4.5), C(21, 16, 3.5), R(8, 16, 16, 4))], ["m", A(15.5, 15, 2.4, 160, 430, 1.4)],
  ],
  hammer_heart: [ // 강철 심장: a heart beating, its pulse at either side
    ["L", A(15.5, 15.5, 10, 160, 200, 1.4), A(15.5, 15.5, 10, -20, 20, 1.4)],
    ["a", heart(15.5, 15.5, 1.15)],
  ],
  ironsiege: [ // 철벽 공성: a hammer swung above a crenellated wall
    ["m", D(R(5, 17, 22, 9), U(R(8, 17, 3, 2), R(14, 17, 3, 2), R(20, 17, 3, 2)))], ["k", L(5, 21.5, 26, 21.5, 1), R(11, 22, 1, 4), R(19, 19, 1, 3)],
    ...hammer(7, 16, 20, 8.5, 10, 5).map(([m, ...s]) => [m === "l" ? "a" : m === "a" ? "l" : m, ...s]),
  ],
  oathward: [ // 맹세의 수호: a gate lit from within, a cross shining in it
    ["l", D(U(R(8, 13, 16, 13), C(15.5, 13, 7.5)), U(R(11, 14, 9, 12), C(15.5, 14, 4.5)))],
    ["A", U(R(11, 14, 9, 12), C(15.5, 14, 4.5))], ["*", R(15, 13, 2, 9), R(12.5, 15, 7, 2)],
  ],
  stomp: [ // 짓밟기: a boot coming down on a cracked shock ring
    ["A", D(E(15.5, 25, 12, 3.2), E(15.5, 25, 9, 1.6))], ["A", L(3, 27, 6, 25, 1), L(26, 25, 29, 27, 1)],
    ["m", R(11, 3, 8, 11)], ["l", P(9, 13, 20, 13, 24, 18, 25, 22, 8, 22, 8, 16)], ["d", R(8, 21, 17, 3)], ["a", R(11, 5, 8, 2)],
    ["k", poly(1, 13, 25, 15, 27, 17, 25, 19, 27)],
  ],
  mortar: [ // 박격: an arrow on a high arc, a powder burst where it lands
    ["L", A(13, 24, 11, 180, 295, 1, 2.2)], ["W", C(2.5, 22, 0.5)],
    ...arrow(14, 8, 24, 14, 3),
    ["A", star(23, 24, 5.5, 0.4)], ["S", C(17, 26, 1.8), C(28, 22, 1.4)], ["W", C(23, 24, 1.2)],
  ],
  dragonpierce: [ // 용아관통: a thick bone arrow, a flash where the bow kicked back
    ["W", star(5, 16, 4.5, 0.25)], ["A", L(3, 9, 7, 11, 1), L(3, 23, 7, 21, 1)],
    ["l", L(9, 16, 21, 16, 3.6)], ["l", C(9, 14.5, 1.7), C(9, 17.5, 1.7)], ["a", L(13, 16, 13, 16, 3.6), L(17, 16, 17, 16, 3.6)],
    ["m", P(28, 16, 20, 10.5, 20, 21.5)], ["k", L(21, 16, 25, 16, 1)],
  ],
  rollshot: [ // 구르며 쏘기: a curled roll trail, an arrow leaving it
    ["M", A(11, 20, 7.5, 100, 430, 1, 3.4)], ["L", A(11, 20, 3.6, 150, 440, 1, 2)], ["W", C(4, 27, 0.5), C(18, 27, 0.5)],
    ...arrow(12, 13, 27, 6, 3.4),
  ],
  chainbolt: [ // 연쇄 번개: a zigzag bolt linking three dots
    ["a", poly(2, 6, 24, 13, 17, 10, 14.5, 15.5, 7), poly(2, 15.5, 7, 20, 15, 18, 16.5, 26, 21)],
    ["l", C(6, 24, 2.7), C(15.5, 7, 2.7), C(26, 21, 2.7)], ["*", C(5.5, 23.5, 1), C(15, 6.5, 1), C(25.5, 20.5, 1)],
  ],
  shoulder: [ // 어깨치기: a pauldron slamming into a wall
    ["m", R(22, 5, 6, 22)], ["k", L(22, 11, 27, 11, 1), L(22, 18, 27, 18, 1), poly(1, 22, 13, 24, 15, 23, 17)],
    ["L", L(2, 11, 6, 11, 1), L(1, 16, 5, 16, 1), L(2, 21, 6, 21, 1)],
    ["m", R(6, 10, 6, 13)], ["l", I(C(11, 16.5, 9), R(11, 0, 21, 32))], ["k", A(11, 16.5, 5.5, -75, 75, 1)], ["a", C(15, 16.5, 1.3)],
    ["W", rays(21, 16.5, 1.5, 4.5, [-70, -25, 25, 70], 1.2)],
  ],
  snare: [ // 올가미: a noose pulled tight round an arrow
    ...arrow(4, 27, 26, 7, 3.4),
    ["a", ring(13, 20, 5.5, 2)], ["l", C(18, 23.5, 2)], ["a", poly(1.8, 18, 25, 20, 28, 25, 26)],
  ],
  bladevortex: [ // 칼날 소용돌이: five knives chasing round a ring
    ["A", A(15.5, 15.5, 5.5, 0, 280, 1, 2.4)],
    ...[0, 1, 2, 3, 4].flatMap((i) => { const a = -90 + 72 * i, b = a + 50, r = 11; return sword(15.5 + cos(a) * r, 15.5 + sin(a) * r, 15.5 + cos(b) * r, 15.5 + sin(b) * r, 2.6, 2, 1.8); }),
    ["W", C(15.5, 15.5, 0.8)],
  ],
  smoke: [ // 연막: a grey puff of smoke
    ["L", L(3, 25, 8, 25, 1), L(24, 26, 29, 26, 1)],
    ["m", U(C(9.5, 19, 5), C(16, 14, 7), C(22.5, 19, 5.5), R(9.5, 19, 13, 6))], ["l", U(C(14, 12.5, 3.8), C(9.5, 18, 2.4))],
    ["k", A(17, 17.5, 3, 200, 430, 1)], ["S", C(6, 9, 1.8), C(26, 10, 1.4), C(24, 5, 1)],
  ],
  parry: [ // 받아치기: a flat blade meeting a blow in a spark
    ["A", L(25, 4, 20, 8, 1.4, 0.6)],
    ...sword(4, 24, 25, 16, 3.4, 4),
    ["W", rays(18.5, 14, 3, 7.5, [-150, -110, -70, -30, 20], 1.2)], ["*", star(18.5, 14, 3.5, 0.25)],
  ],
  mountain: [ // 태산: a blade raised over a split peak
    ["m", P(3, 28, 11, 18, 15, 13, 15, 28)], ["l", P(17, 28, 17, 15, 21, 19, 29, 28)], ["k", L(16, 15, 16, 28, 1)],
    ["*", C(14, 15, 1), C(18.5, 17, 0.8)],
    ...sword(15.5, 17, 15.5, 3, 3.6, 4),
  ],
  // ── JOB-01: remaining 7 Lv.30 job signatures
  aetherblade: [ // 성광 마검: 유성낙하 — a blazing greatsword plunging from a starburst into a radiant impact ring
    ["A", rays(15.5, 8, 2, 10, [-155, -120, -60, -25, 25, 155], 1.4)],
    ["a", E(15.5, 25, 10.5, 3)], ["W", E(15.5, 25, 6, 1.5)],
    ...sword(15.5, 5, 15.5, 25, 3.8, 4.2, 5.2),
    ["*", star(15.5, 12, 4.2, 0.28)],
  ],
  shadowexec: [ // 칠흑의 사형선고 — twin shadow daggers crossing over a crimson execution seal
    ["d", ring(15.5, 15.5, 10, 2.2)], ["A", L(7, 24, 24, 7, 1.8), L(7, 7, 24, 24, 1.8)],
    ...dagger(6, 25, 23, 8),
    ...dagger(25, 25, 8, 8),
    ["*", star(15.5, 15.5, 3.6, 0.25)],
  ],
  cataclysm: [ // 삼원소 대격변 — tri-elemental arcane vortex (fire, frost, lightning) converging on a magic circle
    ["M", ring(15.5, 15.5, 10.5, 1.6)],
    ...flame(15.5, 8.5, 3.2, -90),
    ["l", star(9, 20.5, 4.2, 0.35)],
    ["a", poly(2, 23, 15, 19.5, 20.5, 23.5, 20.5, 20, 26)],
    ["*", C(15.5, 15.5, 2.6)], ["W", rays(15.5, 15.5, 3, 7, [-90, 30, 150], 1.2)],
  ],
  mirageburst: [ // 환영 만화경 — six-way prism shards radiating from a mirror diamond
    ["A", rays(15.5, 15.5, 4, 12, sixAngles, 1.6)],
    ["m", diamond(15.5, 15.5, 7)], ["l", diamond(15.5, 15.5, 4.5)],
    ["a", ...sixAngles.map((a) => C(15.5 + cos(a) * 10.5, 15.5 + sin(a) * 10.5, 1.8))],
    ["*", star(15.5, 15.5, 3, 0.28)],
  ],
  soulharvest: [ // 금서 해방: 영혼 수확 — an open grimoire unleashing a sweeping spectral scythe arc
    ["A", A(16, 15, 10.5, 165, 350, 1.4, 4.2)], ["L", A(16, 15, 10.5, 200, 340, 0.8, 2.2)],
    ...book(15.5, 19, 8.5, 5),
    ["a", drop(10.5, 11, 2.2, -90), drop(20.5, 10, 2.2, -90)],
    ["*", star(15.5, 13, 3.5, 0.28)],
  ],
  galevolley: [ // 질풍 연사: 천궁의 화살 — three piercing wind-feathered arrows streaking through a gale ring
    ["L", A(13, 18, 9, 130, 320, 1.2, 2.6)],
    ...arrow(5, 21, 23, 5, 3.2, 1.3),
    ...arrow(5, 27, 27, 9, 3.5, 1.5),
    ...arrow(10, 27, 27, 15, 3.2, 1.3),
    ["*", star(25, 10, 2.8, 0.25)],
  ],
  venomrain: [ // 맹독 혈우: 사냥감 낙인 — three downward poisoned arrows plunging into a toxic crimson ring
    ["a", E(15.5, 25.5, 10, 3)], ["m", E(15.5, 25.5, 6.2, 1.8)],
    ...arrow(8.5, 5, 10, 21, 3.0, 1.3),
    ...arrow(15.5, 4, 15.5, 22, 3.4, 1.5),
    ...arrow(22.5, 5, 21, 21, 3.0, 1.3),
    ["*", C(10, 24.5, 1.1), C(15.5, 25.5, 1.3), C(21, 24.5, 1.1)],
  ],
  // ── job skills 2026-11-21 (one active + one passive per job)
  warcry: [ // 광폭의 포효: a roaring maw, shout waves bursting out, a greatsword behind
    ...sword(7, 26, 22, 7, 3.4, 4),
    ["A", A(15.5, 16, 10.5, -50, 50, 1.4, 2.4), A(15.5, 16, 10.5, 130, 230, 1.4, 2.4)], ["L", A(15.5, 16, 7.5, -45, 45, 1, 1.6), A(15.5, 16, 7.5, 135, 225, 1, 1.6)],
    ["m", E(15.5, 16, 5.6, 6)], ["k", E(15.5, 17.5, 3.8, 3.8)], ["*", R(11, 11, 2, 3), R(18, 11, 2, 3), R(13, 21, 5, 1)],
  ],
  runeburst: [ // 원소 마검: 뇌화 폭쇄: a sword planted point-down, lightning and flame bursting from it
    ["m", E(15.5, 25, 8, 2.4)],
    ...sword(15.5, 6, 15.5, 23, 3.2, 4),
    ...flame(8.5, 18, 3.6, -100), ...flame(22.5, 18, 3.6, -80),
    ["a", poly(2, 6, 6, 10, 11, 8, 14, 11, 19)], ["a", poly(2, 25, 6, 21, 11, 23, 14, 20, 19)],
    ["*", C(15.5, 21, 1.6)],
  ],
  assassinate: [ // 그림자 암살: a dagger stabbing down behind a dark silhouette's back
    ["d", C(14, 11, 3.8), P(8, 27, 9, 17, 12, 15, 16, 15, 19, 17, 20, 27)], ["k", L(11, 11, 17, 11, 1)],
    ...dagger(21, 3, 15, 19),
    ["*", star(22, 22, 3.6, 0.25)], ["a", L(15, 19, 14, 22, 1.4)],
  ],
  bladewaltz: [ // 칼날 왈츠: twin daggers trailing a swirling dash streak with blood drops
    ["L", A(15.5, 16, 9.5, 150, 400, 1, 4)], ["W", A(15.5, 16, 9.5, 300, 400, 0.8, 2.4)],
    ...dagger(5, 26, 17, 15), ...dagger(26, 8, 14, 18),
    ["a", drop(9, 8, 2.4, -90), drop(23, 24, 2.4, -90), drop(25, 15, 1.6, -90)],
  ],
  javelin: [ // 천공 투창: a spear thrown diagonally, long speed lines, piercing through
    ["L", L(5, 20, 14, 20, 1), L(5, 25, 17, 25, 1), L(7, 15, 12, 15, 1)],
    ["A", ring(24, 8, 4, 1.4)],
    ...spear(7, 24, 25, 7, 8, 6, 2.2),
    ["*", C(24, 8, 1.4)],
  ],
  chainlance: [ // 뇌격 연쇄창: a spear tip, lightning jumping between three small points
    ...spear(15.5, 28, 15.5, 11, 8, 6, 2),
    ["a", poly(2, 6, 7, 10, 11, 8, 14, 12, 12), poly(2, 25, 7, 21, 11, 23, 14, 19, 12)],
    ["*", star(6, 7, 2.2, 0.3), star(25, 7, 2.2, 0.3), star(15.5, 6, 2.6, 0.3)], ["A", poly(1.6, 10, 8, 15.5, 7, 21, 8)],
  ],
  blink: [ // 블링크: 서리 잔영: a fading afterimage, frost where it left, an arrow to the new spot
    ["S", E(9, 17, 3.4, 6), C(9, 9.5, 2.8)], ["L", poly(1, 5, 21, 7, 24), poly(1, 12, 21, 11, 24)],
    ["l", star(8, 24, 3.2, 0.3)], ["W", star(8, 24, 1.6, 0.4)],
    ["a", L(13, 15, 19, 15, 2)], ["a", head(23, 15, 0, 6, 7)],
    ["m", E(25, 20, 2.6, 5), C(25, 12.5, 2.4)], ["*", C(25, 12, 1)],
  ],
  luckydice: [ // 행운의 주사위: two tumbling dice with pips, sparkles
    ["l", P(6, 12, 15, 9, 18, 18, 9, 21)], ["k", C(10, 14, 1), C(14, 13, 1), C(13, 18, 1), C(9, 18, 1)],
    ["m", P(16, 17, 25, 15, 26, 24, 17, 26)], ["*", C(19.5, 20.5, 1.2), C(22.5, 19.5, 1.2), C(21, 23, 1.2)], ["k", C(21, 21.5, 0.6)],
    ["A", star(22, 8, 3.2, 0.28), star(7, 25, 2.2, 0.3)], ["*", C(22, 8, 1)],
  ],
  wraith: [ // 망령 소환: a hooded ghost rising from an open book
    ...book(15.5, 20, 9, 4),
    ["l", P(15.5, 4, 22, 9, 23, 19, 20, 17, 17.5, 20, 15.5, 17, 13.5, 20, 11, 17, 8, 19, 9, 9)],
    ["k", E(15.5, 11, 3.4, 3.8)], ["*", C(14, 11, 0.9), C(17, 11, 0.9)],
  ],
  sealrune: [ // 봉인의 룬: a glowing rune circle with chains and a lock sigil
    ["M", ring(15.5, 15.5, 10, 2)], ["A", L(6, 6, 10, 10, 2), L(25, 6, 21, 10, 2), L(6, 25, 10, 21, 2), L(25, 25, 21, 21, 2)],
    ["l", D(R(11.5, 14, 9, 8), R(13.5, 16, 5, 4))], ["l", D(ring(15.5, 14, 3.4, 2), R(10, 14, 12, 10))],
    ["*", R(15, 17, 2, 3)],
  ],
  barrage: [ // 사냥꾼의 속사: a bow with a fan of quick arrows streaming out
    ["m", A(9, 16, 11, -70, 70, 2.4)], ["L", L(11.5, 6, 11.5, 26, 0.8)],
    ...arrow(10, 16, 27, 7, 2.6, 1), ...arrow(10, 16, 28, 16, 2.8, 1.2), ...arrow(10, 16, 27, 25, 2.6, 1),
  ],
  viperarrow: [ // 독사의 관통 화살: a fang-headed arrow dripping green poison
    ...arrow(5, 25, 24, 8, 2, 1.3),
    ["*", P(22, 4, 27, 9, 23, 8)], ["l", P(23, 6, 27, 6, 26, 12)], ["l", P(26, 9, 28, 14, 23, 11)],
    ["a", drop(10, 19, 2.4, 90), drop(16, 21, 2, 90), drop(21, 24, 2.2, 90)],
  ],
  aftershock: [ // 지각 붕괴: a hammer slamming down, three shockwave rings and cracks
    ["M", D(E(15.5, 24, 11, 3.4), E(15.5, 24, 9.2, 2.4)), D(E(15.5, 24, 7.5, 2.4), E(15.5, 24, 5.8, 1.4))],
    ["k", poly(1, 5, 27, 9, 25, 7, 23), poly(1, 26, 27, 22, 25, 24, 23)],
    ...hammer(15.5, 2, 15.5, 11, 14, 8),
    ["W", rays(15.5, 18, 3, 6, [-150, -30], 1.4)],
  ],
  aegis: [ // 신의 방패: a radiant holy shield, cross emblem, light rays
    ["A", rays(15.5, 15.5, 11, 14, [-90, -50, -130, -10, 190, 10, 170], 1.6)],
    ["m", P(7, 7, 24, 7, 24, 16, 15.5, 26, 7, 16)], ["l", P(9, 9, 22, 9, 22, 15.5, 15.5, 23, 9, 15.5)],
    ["*", R(14.5, 10, 2, 10), R(11, 13, 9, 2)],
  ],

  swordsman_bloodlust: [ // 피의 갈증: a blood drop with a heart and fangs
    ["a", drop(15.5, 17, 8.5, -90)], ["*", heart(15.5, 15, 0.8)],
    ["l", P(10, 20, 12.5, 20, 11.2, 26), P(19, 20, 21.5, 20, 20.2, 26)],
  ],
  spellblade_resonance: [ // 원소 공명검: fire on one edge, lightning on the other
    ...sword(15.5, 27, 15.5, 5, 4, 4, 4.5),
    ...flame(8.5, 14, 3.4, -100), ["a", poly(2, 23, 6, 20, 11, 24, 14, 21, 20)],
    ["*", star(15.5, 14, 2.2, 0.3)],
  ],
  thief_biggame: [ // 거물 사냥꾼: a crowned boss skull with a dagger through it
    ["l", C(15.5, 15, 6.4), R(11.5, 18, 8, 5)], ["a", P(9, 9, 11, 4, 13.5, 8, 15.5, 3, 17.5, 8, 20, 4, 22, 9)],
    ["k", C(12.8, 15.5, 1.6), C(18.2, 15.5, 1.6), R(14, 20, 1, 2), R(16, 20, 1, 2)],
    ...dagger(5, 27, 25, 7),
  ],
  bladedancer_feast: [ // 피의 향연: blood drops leaping in an arc from one target to another
    ["A", A(15.5, 24, 10, 205, 335, 1, 1)], ["m", C(7, 22, 3.4)], ["m", C(24, 22, 3.4)],
    ["a", drop(10, 12, 2.6, -60), drop(15.5, 8, 2.8, -90), drop(21, 12, 2.6, -120)],
    ["*", C(15.5, 7.5, 0.8)],
  ],
  lancer_bulwark: [ // 불굴의 창진: crossed spears in front of a small shield
    ...spear(6, 27, 24, 6, 7, 5, 2), ...spear(25, 27, 7, 6, 7, 5, 2),
    ["m", P(10.5, 14, 20.5, 14, 20.5, 19, 15.5, 25, 10.5, 19)], ["l", P(12, 15.5, 19, 15.5, 19, 18.5, 15.5, 22.5, 12, 18.5)], ["*", R(15, 16, 1, 5)],
  ],
  spellspear_frostbite: [ // 동상: a snowflake with a bite mark
    ["L", rays(15.5, 15.5, 0, 10.5, [-90, -30, 30, 90, 150, 210], 2)], ["W", rays(15.5, 15.5, 4, 8, [-60, -120, 0, 60, 120, 180], 1.2)],
    ["l", C(15.5, 15.5, 3)], [".", C(24, 21, 4)], ["k", P(21, 18, 23, 21, 21, 24)],
  ],
  wizard_manashield: [ // 마나 보호막: a blue hexagonal barrier bubble
    ["M", ring(15.5, 15.5, 10.5, 2)], ["L", ...[0, 1, 2, 3, 4, 5].map((i) => L(15.5 + cos(i * 60 - 90) * 9.5, 15.5 + sin(i * 60 - 90) * 9.5, 15.5 + cos(i * 60 - 30) * 9.5, 15.5 + sin(i * 60 - 30) * 9.5, 1.6))],
    ["m", C(15.5, 15.5, 3)], ["*", C(14.5, 14.5, 1.2)],
  ],
  trickster_sleight: [ // 손속임: a playing card with a sparkle and a small clock hand
    ["l", P(8, 8, 19, 6, 22, 21, 11, 23)], ["k", L(10, 10, 17, 9, 0.8)], ["a", heart(15, 15, 0.6)],
    ["M", ring(22, 22, 5, 2)], ["W", C(22, 22, 3.5)], ["k", L(22, 22, 22, 19.5, 1), L(22, 22, 24, 23, 1)],
    ["*", star(8, 24, 2.4, 0.3)],
  ],
  warlock_thirst: [ // 금서의 갈증: a book mouth drinking a purple soul wisp
    ...book(15.5, 17, 9, 5),
    ["k", P(7, 19, 15.5, 22, 24, 19, 15.5, 25)], ["*", R(10, 19, 1, 2), R(13, 20, 1, 2), R(18, 20, 1, 2), R(21, 19, 1, 2)],
    ["a", drop(15.5, 9, 3.2, -90)], ["*", C(15.5, 8, 1)], ["A", L(15.5, 12, 15.5, 16, 1)],
  ],
  runearcher_lastward: [ // 최후의 룬: a cracked heart behind a rune shield
    ["a", heart(15.5, 11, 1.1)], ["k", poly(1, 15.5, 5, 14, 9, 17, 12)],
    ["m", P(9, 14, 22, 14, 22, 20, 15.5, 27, 9, 20)], ["l", P(11, 16, 20, 16, 20, 19.5, 15.5, 24.5, 11, 19.5)], ["*", L(15.5, 17, 15.5, 22, 1.2), L(13, 19, 18, 19, 1.2)],
  ],
  archer_deadeye: [ // 명사수: a bullseye with an arrow in the centre
    ["M", ring(15.5, 15.5, 10.5, 2)], ["L", ring(15.5, 15.5, 6.5, 2)], ["a", C(15.5, 15.5, 2.4)],
    ...arrow(26, 5, 16, 15, 2.4, 1.2),
  ],
  tracker_venom: [ // 사냥감의 흔적: green poisoned paw prints
    ["l", E(10, 20, 4, 3.2), C(6.5, 15.5, 1.4), C(9, 13.5, 1.4), C(12, 13.5, 1.4), C(14.5, 15.5, 1.4)],
    ["m", E(21, 11, 3.4, 2.8), C(18, 7, 1.2), C(20.5, 5.5, 1.2), C(23, 5.5, 1.2), C(25.5, 7, 1.2)],
    ["a", drop(21, 25, 2.4, 90), drop(26, 20, 1.6, 90)],
  ],
  destroyer_crusher: [ // 분쇄자: a cracked armour plate breaking apart
    ["m", P(6, 8, 14.5, 6, 14, 17, 17, 22, 8, 22)], ["l", P(17.5, 7, 26, 9, 24, 23, 19, 19, 18.5, 12)],
    ["k", poly(1.4, 15.5, 5, 15, 10, 17, 14, 16, 18, 18, 23)],
    ["L", C(8, 26, 1.2), C(22, 26, 1.4), C(26, 5, 1.2)],
  ],
  paladin_blessed: [ // 축복받은 갑옷: a breastplate with a halo and wings
    ["A", ring(15.5, 6.5, 3.6, 1.4)],
    ["L", P(4, 11, 9, 9, 10, 15, 6, 20), P(27, 11, 22, 9, 21, 15, 25, 20)],
    ["m", P(10, 11, 21, 11, 22, 18, 15.5, 27, 9, 18)], ["l", P(12, 13, 19, 13, 20, 17.5, 15.5, 24, 11, 17.5)], ["*", R(15, 14, 1, 7), R(13, 16, 5, 1)],
  ],
};

// a few mastery passives have no prefix in the id but are passives all the same
const BASE_PASSIVE = new Set(["inertia", "vitals", "tip", "reso", "brand", "hawk"]);
// without game data (preview pages): job passives are named "<job>_<word>"
const JOB_PASSIVE = /^(swordsman|spellblade|thief|bladedancer|lancer|spellspear|wizard|trickster|warlock|runearcher|archer|tracker|destroyer|paladin)_/;
const kindOf = (id) => skillDef(id)?.kind || (BASE_PASSIVE.has(id) || /\d0$/.test(id) || JOB_PASSIVE.test(id) ? "p" : "a");

// ── the frame shapes: per pixel, its depth in from the edge (0 outside): 1 ink, 2–3 rim, 4 inner line, 5+ backing
const SQUARE = [3, 2, 1, ...Array(26).fill(0), 1, 2, 3];
const masks = {};
function depthMap(round) {
  const key = round ? "p" : "a";
  if (masks[key]) return masks[key];
  const dep = new Uint8Array(N * N), inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N && (round ? (x - 15.5) ** 2 + (y - 15.5) ** 2 <= 15.9 ** 2 : x >= SQUARE[y] && x < N - SQUARE[y]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inside(x, y)) dep[y * N + x] = 255;
  for (let d = 1; d < 255; d++) {
    let any = false;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (dep[y * N + x] !== 255) continue;
      const near = (i, j) => !inside(i, j) || dep[j * N + i] < d;
      if (near(x - 1, y) || near(x + 1, y) || near(x, y - 1) || near(x, y + 1)) { dep[y * N + x] = d; any = true; }
    }
    if (!any) break;
  }
  return (masks[key] = dep);
}

const SOLID = "lmad*k", FLAT = "WLMAS";
/** One icon's 32×32 colours (null = transparent) and how many motif pixels it drew. */
export function iconPixels(id) {
  const kind = kindOf(id), dep = depthMap(kind === "p"), sig = kind === "j" || kind === "h";
  const p = skillPal(id), parts = hybridParts(skillOwner(id)), pa = parts ? jobPal(parts[0]) : p, pb = parts ? jobPal(parts[1]) : p;
  const glint = mix(p.l, WHITE, 0.8);
  const ramp = { l: [mix(p.l, WHITE, 0.3), p.l, p.m], m: [p.l, p.m, p.md], a: [p.al, p.a, p.ad], d: [p.m, p.md, mix(p.md, p.d, 0.6)] };
  const flat = { W: p.w, L: p.l, M: p.m, A: p.a, S: p.md, "*": glint, k: INK };
  const px = new Array(N * N).fill(null), at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : dep[y * N + x]);
  // frame and backing
  const band = [mix(p.d, p.m, 0.3), mix(p.d, p.m, 0.17), mix(p.d, p.m, 0.07)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = at(x, y);
    if (!d) continue;
    const lit = x + y < 31, rp = lit ? pa : pb;
    const corner = sig && Math.min(x, 31 - x) < 9 && Math.min(y, 31 - y) < 9;
    let c;
    if (d === 1) c = INK;
    else if (d <= 3) c = corner ? (d === 2 ? (lit ? p.al : p.a) : (lit ? p.a : p.ad)) : d === 2 ? (lit ? rp.l : rp.m) : (lit ? rp.m : rp.md);
    else if (d === 4) c = mix(p.d, INK, 0.5);
    else {
      c = band[y < 11 ? 0 : y < 21 ? 1 : 2];
      if ((x - 15.5) ** 2 + (y - 15.5) ** 2 <= 90) c = mix(c, p.a, 0.12);
    }
    if (d === 2 && lit && Math.abs(x - y) <= 1) c = glint;
    px[y * N + x] = c;
  }
  // the motif: who owns each pixel
  const list = ICON[id] || [], own = new Int16Array(N * N).fill(-1);
  list.forEach(([m, ...shapes], i) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (at(x, y) < 5 || !shapes.some((f) => f(x, y))) continue;
      own[y * N + x] = m === "." ? -1 : i;
    }
  });
  const mat = (x, y) => { const o = at(x, y) ? own[y * N + x] : -1; return o < 0 ? "" : list[o][0]; };
  const solid = (x, y) => SOLID.includes(mat(x, y) || "_");
  // light from the upper left: an edge facing it is the highlight, one facing away the shadow (two deep on big shapes)
  let n = 0, glinted = list.some(([m]) => m === "*"), best = null;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const o = own[y * N + x];
    if (o < 0 || at(x, y) < 5) continue;
    const m = list[o][0];
    n++;
    if (!ramp[m]) { px[y * N + x] = flat[m]; continue; }
    const same = (i, j) => at(i, j) && own[j * N + i] === o;
    const tl = !same(x - 1, y) || !same(x, y - 1), br = !same(x + 1, y) || !same(x, y + 1);
    const deep = !tl && !br && (!same(x + 2, y) || !same(x, y + 2)) && same(x - 3, y) && same(x, y - 3);
    const k = tl && !br ? 0 : (br && !tl) || deep ? 2 : 1;
    px[y * N + x] = ramp[m][k];
    if (!glinted && m === "l" && k === 0 && same(x + 1, y + 1) && (!best || x + y < best[0] + best[1])) best = [x, y];
  }
  if (best) px[best[1] * N + best[0]] = glint;
  // one dark outline round every solid, also where a flat part meets it; then a faint glow round that outline
  const line = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (at(x, y) < 4 || solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) { px[y * N + x] = INK; line[y * N + x] = 1; }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (at(x, y) < 5 || own[i] >= 0 || line[i]) continue;
    if (line[i - 1] || line[i + 1] || line[i - N] || line[i + N]) px[i] = mix(px[i], p.l, 0.16);
  }
  // combo pips: the state it puts on (top-right), the one it spends (bottom-right)
  const [give, take] = COMBO[id] || [];
  for (const [st, y0] of [[give, 3], [take, 24]]) {
    if (!st) continue;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
      if ((x === 0 || x === 6) && (y === 0 || y === 4)) continue;
      const edge = x === 0 || x === 6 || y === 0 || y === 4;
      px[(y0 + y) * N + 22 + x] = edge ? INK : y === 1 ? mix(STATE[st], WHITE, 0.5) : y === 3 ? mix(STATE[st], INK, 0.3) : STATE[st];
    }
  }
  return { px, n };
}

const cache = {}, urls = {};
onJobDefs(() => { for (const k in cache) delete cache[k]; for (const k in urls) delete urls[k]; });
/** A 32×32 canvas for one skill id (painted once per palette); unknown ids get an empty frame in 모험가's colours. */
export function skillIcon(id) {
  if (cache[id]) return cache[id];
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d"), img = g.createImageData(N, N), { px } = iconPixels(id);
  px.forEach((col, i) => {
    if (!col) return;
    img.data[i * 4] = parseInt(col.slice(1, 3), 16); img.data[i * 4 + 1] = parseInt(col.slice(3, 5), 16);
    img.data[i * 4 + 2] = parseInt(col.slice(5, 7), 16); img.data[i * 4 + 3] = 255;
  });
  g.putImageData(img, 0, 0);
  return (cache[id] = c);
}
export const skillIconUrl = (id) => urls[id] || (urls[id] = skillIcon(id).toDataURL());
export const ALL = Object.keys(ICON);
/** Icons whose motif came out (nearly) empty, for the preview page and the tests to complain about. */
export const badRows = () => ALL.filter((id) => iconPixels(id).n < 40).map((id) => `${id}: empty motif`);
