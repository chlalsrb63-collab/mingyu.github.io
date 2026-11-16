/**
 * Effects (split from scene2d.js): particles `parts`, `props`/`hooks` for other modules, the
 * effects' clock (`fxNow`, `setFxClock` from the frame), sword-qi (`qiBurst drawQi`), bow arrows
 * (`arrowSprite`, flight, `stuckArrow`, `bowSnap`), the effect set `fx` (+ `fxCustom`), the skills'
 * scaled set `big`, `shake` (+ `kick`, `shakeAmt`/`setShake`), `drawFx`, and the aim arrow
 * (`aimSprite drawAimArrow`).
 */

import * as SP from "./sprites.js";
import * as Sw from "./swing.js";
import { G, playerLook, sheet, g, INK, iso, P, sAng, K, sqI, clamp } from "./scene_view.js";
import { personState } from "./scene_people.js";

export let shakeAmt = 0;
/** The view's shake, eased back by the frame (`render`). */
export function setShake(n) { shakeAmt = n; }

// ───────────────────────────── effects ─────────────────────────────

export const parts = [];
/** The colour an elite takes from its first trait (names from the sprite sheet's tint list). */
export const TRAIT_TINT = { fire: "fire", poison: "poison", frost: "frost", tough: "steel", vamp: "blood", swift: "gold", burst: "ash", thorn: "bone" };
/** What a spat puddle looks like, by kind: poison, fire, blood. */
const POOL_COL = ["#8ad84a", "#ff8a3a", "#c8324a"];
/**
 * Things the class skills leave standing in the world — a stuck greatsword, a banner,
 * a teapot, a rogue's puppet: id → { x, y, until, draw(g, t, sx, sy) } in world units,
 * sorted in with everything else that stands up. `hooks` draw over the creatures
 * each frame (marks over monsters and the like): (g, t, P) in world pixels.
 */
export const props = new Map();
export const hooks = [];
/** A person's standing frame (front view) and weapon sprite, for drawing copies of them. */
export function personFrame(eid) {
  const w = G && G.who.get(eid);
  if (!w) return null;
  const s = personState(eid, playerLook(w.cls, w.look, w.gear));
  return { img: s.sheet.front[SP.FRAME.stand], weapon: s.weapon, wk: s.wk };
}
export const FOOT = SP.FOOT;
/** A custom effect: draw(g, k, f) is called with k running 0 → 1 over `dur` ms. */
/** Draw callbacks laid over the night grade again (scene2d glowAfterDark): things that shine by their own light. */
export const glows = new Set();
export function fxCustom(draw, dur, flat = false, delay = 0) { fx.add({ k: "custom", draw, dur, flat, delay }); }
/** The effects' clock: the time of the frame being drawn (so previews that step time by hand animate them too). */
let fxClock = null;
export function setFxClock(t) { fxClock = t; }
const fxNow = () => fxClock ?? performance.now();

// ── sword-qi: the burst each basic blow throws off at the snap (drawPerson calls qiBurst once a
// stroke, at swing.js IMPACT). Pixel-built, never smoothed: a white-hot first frame or two, then
// the weapon's colour, thinning and breaking into a dither as it evaporates.
export const QI_COL = { sword: "#cfe0ff", dagger: "#ecdcff", spear: "#d0f8ec", staff: "#c8a8ff", book: "#dcc0ff" };
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const qiCache = new Map();
/**
 * A crescent of sword-qi R pixels across, bulging toward screen angle `ang`, squashed `sq` up and
 * down (a level sweep lies flat, a chop stands up), thickest toward the end the blade swept to.
 * `ph` 0 white-hot, 1 coloured with a white edge, 2 thinner and dithered, 3 nearly gone.
 */
function qiSprite(R, ang, side, sq, ph, col) {
  const step = ((Math.round((ang / (2 * Math.PI)) * 48) % 48) + 48) % 48, key = `${R}|${step}|${side}|${sq}|${ph}|${col}`;
  let c = qiCache.get(key);
  if (c) return c;
  if (qiCache.size > 600) qiCache.clear();
  const a = (step / 48) * 2 * Math.PI, au = Math.atan2(Math.sin(a) / sq, Math.cos(a));
  const N = 2 * R + 3, mid = R + 1, span = 1.3, thick = R * 0.5 * [1, 0.8, 0.55, 0.38][ph];
  let x;
  [c, x] = sheet(N, N);
  const im = x.createImageData(N, N), d = im.data, [cr, cg, cb] = hexRGB(col);
  const put = (i, j, r, gg, b) => { const o = (j * N + i) * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = i - mid, dy = (j - mid) / sq, rho = Math.hypot(dx, dy);
    if (rho > R + 0.5) continue;
    const th = Math.atan2(Math.sin(Math.atan2(dy, dx) - au), Math.cos(Math.atan2(dy, dx) - au));
    if (Math.abs(th) > span) continue;
    const u = (th * side / span + 1) / 2, w = thick * Math.sin(Math.PI * u ** 0.75);
    if (w < 0.6 || rho < R - w) continue;
    const rim = rho > R - 1.4, inner = rho < R - w + 1.2, odd = (i + j) & 1;
    if (ph === 0) inner ? put(i, j, cr, cg, cb) : put(i, j, 255, 255, 255);
    else if (ph === 1) rim ? put(i, j, 255, 255, 255) : put(i, j, cr, cg, cb);
    else if (ph === 2) { if (rim) put(i, j, (cr + 255) >> 1, (cg + 255) >> 1, (cb + 255) >> 1); else if (!odd) put(i, j, cr, cg, cb); }
    else if (!odd && (rim || (i & 1))) put(i, j, cr, cg, cb);
  }
  x.putImageData(im, 0, 0);
  qiCache.set(key, c);
  return c;
}
/**
 * Throw off the burst of a blow landing: `wk` the weapon kind, `beat` the blow of the combo,
 * (x, y) the hand (sweeps) or the point (thrusts, staff, book) in iso pixels, `ang` the aim on
 * screen, `side` which way the stroke swept, `size` about the weapon's length, `glow` its rarity ink.
 */
export function qiBurst(wk, beat, x, y, ang, side, size, glow) {
  const fin = beat === 2, col = glow && glow !== "#ffffff" ? glow : QI_COL[wk] || QI_COL.sword;
  const sweep = (R, sq, dur) => fx.add({ k: "qi", s: "cres", x, y: y - 2, ang, side, R: Math.round(R), sq, col, dur, fin });
  const thrust = (L, dur) => fx.add({ k: "qi", s: "thrust", x, y, ang, L, col, dur, fin });
  if (wk === "sword") fin ? sweep(size * 1.3, 1, 240) : sweep(size + 4, 0.62, 190);
  else if (wk === "dagger") beat === 1 ? sweep(size + 3, 0.7, 140) : thrust(size + 8 + (fin ? 6 : 0), 140);
  else if (wk === "spear") beat === 1 ? sweep(size + 2, 0.6, 180) : thrust(size + 14 + (fin ? 10 : 0), 180);
  else if (wk === "staff") fx.add({ k: "qi", s: "star", x, y, ang, R: fin ? 13 : 9, col, dur: 170, fin });
  else fx.add({ k: "qi", s: "rune", x, y, ang, R: fin ? 13 : 9, col, dur: 180, fin });
  if (fin) fx.add({ k: "qi", s: "shock", x: x + Math.cos(ang) * size * 0.8, y: y + Math.sin(ang) * size * 0.5 + 4, ang, R: size, col, dur: 260 });
}
/** Draw one burst of sword-qi at k (0-1 of its life). */
function drawQi(f, k) {
  const ph = k < 0.16 ? 0 : k < 0.42 ? 1 : k < 0.7 ? 2 : 3;
  const px = (x, y, w, c) => { g.fillStyle = c; g.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w); };
  const ux = Math.cos(f.ang), uy = Math.sin(f.ang);
  if (f.s === "cres") {
    const R = Math.round(f.R * (0.9 + 0.18 * Sw.oExpo(k))), img = qiSprite(R, f.ang, f.side, f.sq, ph, f.col);
    g.drawImage(img, Math.round(f.x - R - 1), Math.round(f.y - R - 1));
  } else if (f.s === "thrust") {
    // a streak along the thrust that burns away from the back, and a ring of air punched off its point
    const L = f.L, from = L * Math.min(1, k * 1.3);
    for (let s = Math.floor(from); s <= L; s++) {
      const q = s / L, w = q > 0.9 ? 1 : Math.max(1, Math.round((f.fin ? 5 : 4) * Math.sin(Math.PI * q) * (1 - k * 0.8)));
      if (ph >= 2 && s & 1) continue;
      px(f.x + ux * (s - L * 0.7), f.y + uy * (s - L * 0.7), w, ph === 0 || q > 0.8 ? "#ffffff" : f.col);
    }
    const r = 4 + (f.fin ? 13 : 10) * Sw.oExpo(k), cx = f.x + ux * (L * 0.3 + 4 * k), cy = f.y + uy * (L * 0.3 + 4 * k);
    for (let i = 0; i < 28; i++) {
      if (ph >= 2 && i & 1) continue;
      const a = (i / 28) * 2 * Math.PI, along = Math.cos(a) * r * 0.35, across = Math.sin(a) * r;
      px(cx + ux * along - uy * across, cy + uy * along + ux * across, ph === 0 ? 2 : 1, ph === 0 ? "#ffffff" : f.col);
    }
  } else if (f.s === "star") {
    const n = 8, r0 = 1 + 5 * k, r1 = f.R * (0.5 + 0.7 * Sw.oExpo(k)), w = ph < 2 ? 2 : 1;
    for (let j = 0; j < n; j++) {
      const a = f.ang + (j / n) * 2 * Math.PI, long = j % 2 ? 0.6 : 1;
      for (let r = r0; r <= r1 * long; r += w) px(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.8, w, ph === 0 ? "#ffffff" : f.col);
    }
    if (ph === 0) px(f.x, f.y, 5, "#ffffff");
  } else if (f.s === "rune") {
    const r = f.R * (0.5 + 0.6 * Sw.oExpo(k));
    for (let i = 0; i < 32; i++) { if (ph >= 2 && i & 1) continue; const a = (i / 32) * 2 * Math.PI; px(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.6, 1, ph === 0 ? "#ffffff" : f.col); }
    for (let j = 0; j < 4; j++) { const a = k * 3 + (j / 4) * 2 * Math.PI; px(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.6, ph < 2 ? 3 : 2, ph < 2 ? "#ffffff" : f.col); }
  } else if (f.s === "shock") {
    // the finisher's ring of air lying on the ground where it lands
    const r = f.R * (0.3 + 0.9 * Sw.oExpo(k));
    for (let i = 0; i < 40; i++) { if (ph >= 2 && i % 3 === 0) continue; const a = (i / 40) * 2 * Math.PI; px(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.45, ph < 2 ? 2 : 1, ph === 0 ? "#ffffff" : f.col); }
  }
}

/**
 * Effects. Things flat on the ground (rings, telegraphs, lanes, puddles, cracks,
 * snow) keep world-pixel coordinates and are drawn through the FLAT matrix, so a
 * circle on the ground comes out as a 2:1 ellipse; things in the air (sparks,
 * crescents, shots, beams, bolts) are placed at their projected point and drawn
 * upright in iso pixels.
 */
// ── arrows: a bow's shot in flight (fx.arrow), its faint dotted trail or a piercing streak, the spark
// where it strikes (fx.arrowHit), one left quivering in a wall, and the snap of the string at the
// release (bowSnap, from drawPerson). Every sprite is built pixel by pixel in 64 directions, inked.
const ARROW_STEPS = 64, arrowSprites = new Map(), arrows = new Map();
/** By bow tier (1–6): the trail's dots and the fletching (T4 cyan, T5 violet, T6 운철 night-blue with starlight gold; else red). */
const ARROW_TRAIL = [null, "#fff4dc", "#fff4dc", "#fff4dc", "#7af4ff", "#d8a8ff", "#ffe9a8"];
const ARROW_FLETCH = [null, "#e04a3c", "#e04a3c", "#e04a3c", "#3ab8d0", "#a05ae0", "#2a3a8a"];
/** The piercing shot's ink: a white-hot arrow outlined in gold (T4 cyan, T5 violet). */
const ARROW_HOT = [null, "#ffc23a", "#ffc23a", "#ffc23a", "#3ad0f0", "#b46aff", "#ffd86a"];
/** How long a ground direction looks on screen at screen angle `a`, relative to one straight across. */
const isoLen = (a) => 1 / Math.sqrt(2 * Math.sin(a) ** 2 + Math.cos(a) ** 2 / 2) / Math.SQRT2;
/**
 * The arrow sprite for screen angle `ang` (snapped to 64 steps), centred on a 17×17 canvas:
 * a pale shaft, a two-pixel steel head with barbs, fletching at the nock, a dark outline. It is
 * 11 px long flying across the screen and shorter (down to 6) flying toward or away from the eye.
 * `hot`: the piercing shot — white-hot, inked in its tier's colour.
 */
export function arrowSprite(ang, tier = 1, hot = false) {
  const step = ((Math.round((ang / (2 * Math.PI)) * ARROW_STEPS) % ARROW_STEPS) + ARROW_STEPS) % ARROW_STEPS;
  const key = `${step}|${tier}|${hot ? 1 : 0}`;
  let c = arrowSprites.get(key);
  if (c) return c;
  const a = (step / ARROW_STEPS) * 2 * Math.PI, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const N = 17, C = 8, Lr = Math.max(6, Math.round((hot ? 14 : 11) * isoLen(a)));
  const px = new Map(), set = (i, j, col) => { if (i >= 1 && j >= 1 && i < N - 1 && j < N - 1) px.set(j * N + i, col); };
  const at = (d, o = 0) => [Math.round(C + ux * d + nx * o), Math.round(C + uy * d + ny * o)];
  const glowInk = ARROW_HOT[tier] || ARROW_HOT[1];
  const shaft = hot ? "#fff6d8" : "#e8cc94", head = hot ? "#ffffff" : "#e2e8f0", headD = hot ? "#ffffff" : "#9aa2b4", fl = hot ? glowInk : ARROW_FLETCH[tier] || ARROW_FLETCH[1];
  const pts = [];
  for (let q = 0; q <= Lr; q++) { const [i, j] = at(q - Lr / 2); pts.push([i, j]); set(i, j, q >= Lr - 1 ? head : q <= 1 ? fl : shaft); }
  // the head's barbs and the fletching's vanes stand out one pixel either side: square to the shaft
  // when it runs near an axis, else on the two axis neighbours behind the head (a chevron) and ahead of the nock
  const diag = Math.abs(ux) > 0.38 && Math.abs(uy) > 0.38, sx = Math.sign(ux), sy = Math.sign(uy);
  const [hi, hj] = pts[pts.length - 1], [ti, tj] = pts[0];
  if (diag) { set(hi - sx, hj, headD); set(hi, hj - sy, headD); set(ti + sx, tj, fl); set(ti, tj + sy, fl); }
  else for (const o of [-1, 1]) { const [i, j] = at(Lr / 2 - 1, o); set(i, j, headD); const [fi, fj] = at(-Lr / 2 + 0.5, o); set(fi, fj, fl); }
  if (hot) for (const o of [-2, 2]) {
    const [i, j] = at(Lr / 2 - 3, o);
    set(i, j, headD);
  }
  let x;
  [c, x] = sheet(N, N);
  const ink = hot ? glowInk : INK;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const col = px.get(j * N + i);
    if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
    else if (px.has(j * N + i - 1) && i > 0 || px.has(j * N + i + 1) && i < N - 1 || px.has((j - 1) * N + i) || px.has((j + 1) * N + i)) { x.fillStyle = ink; x.fillRect(i, j, 1, 1); }
  }
  if (arrowSprites.size > 900) arrowSprites.clear();
  arrowSprites.set(key, c);
  return c;
}
/** Where an arrow is at distance d along its flight: [ground x, ground y, screen x, screen y (lifted), screen angle]. */
function arrowAt(f, d) {
  const wx = f.wx + f.ux * d, wy = f.wy + f.uy * d, [x, y] = iso(wx, wy), q = d / f.full;
  // a shallow arc over the whole range: it rises a little and comes down a little at the end
  const arc = Math.min(4, f.full * 0.02), lift = f.h + Math.sin(q * Math.PI) * arc;
  const sx = f.ux - f.uy, sy = (f.ux + f.uy) / 2 - (arc * Math.PI * Math.cos(q * Math.PI)) / f.full;
  return [x, y, x, y - lift, Math.atan2(sy, sx)];
}
/** Draw one arrow in flight at k (0–1 of the flight that is left to it). */
function drawArrow(f, k) {
  const d = f.len * k, [gx, gy, x, y, ang] = arrowAt(f, d), col = (f.pierce ? ARROW_HOT : ARROW_TRAIL)[f.tier] || ARROW_TRAIL[1];
  f.at = [x, y, ang];
  // a one-pixel shadow running along the ground under it
  g.globalAlpha = 0.28; g.fillStyle = "#141832";
  g.fillRect(Math.round(gx - 2), Math.round(gy), 4, 1);
  g.globalAlpha = 1;
  // the trail: dots pinned to the path (they stay where they were left), thinning out behind
  const back = Math.min(d, f.pierce ? 41 : 16);
  const horizontal = Math.abs(Math.cos(ang)) >= Math.abs(Math.sin(ang));
  const sideX = horizontal ? 0 : 1, sideY = horizontal ? 1 : 0;
  for (let u = Math.floor(d) - 2; u > d - back; u--) {
    const far = (d - u) / back, gap = f.pierce ? (far < 0.5 ? 1 : 2) : far < 0.4 ? 2 : 3;
    if (u % gap) continue;
    const [, , tx, ty] = arrowAt(f, u);
    const px = Math.round(tx), py = Math.round(ty);
    g.fillStyle = col;
    if (f.pierce && far < 0.6) {
      g.fillRect(px - sideX, py - sideY, 1 + 2 * sideX, 1 + 2 * sideY);
      g.fillStyle = "#fff6df";
    }
    g.fillRect(px, py, 1, 1);
  }
  g.drawImage(arrowSprite(ang, f.tier, f.pierce), Math.round(x) - 8, Math.round(y) - 8);
}
/** An arrow has come to the end of its flight: it strikes, sticks or simply drops out of sight. */
function arrowLanded(f) {
  f.gone = true; f.goneAt = fxNow();
  const [, , x, y, ang] = arrowAt(f, f.len), wx = f.wx + f.ux * f.len, wy = f.wy + f.uy * f.len;
  if (f.end === "stuck") stuckArrow(x, y, ang, f.tier);
  else if (f.end === "hit") fx.arrowHit(wx, wy, Math.atan2(f.uy, f.ux), f.pierce ? ARROW_HOT[f.tier] : "#ffffff", f.pierce, f.h);
}

/** Draw a few distinct strokes for each lightning cast so it forks, then leaves an afterimage. */
function lightningFrames(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const steps = Math.min(18, Math.max(4, Math.round(len / 14)));
  const jag = Math.min(12, len / 6);
  return Array.from({ length: 3 }, (_, frame) => {
    const core = new Path2D(), forks = new Path2D();
    core.moveTo(x0, y0);
    for (let i = 1; i < steps; i++) {
      const side = (Math.random() - 0.5) * jag * (frame === 2 ? 0.75 : 1.65);
      const x = Math.round(x0 + dx * (i / steps) + nx * side);
      const y = Math.round(y0 + dy * (i / steps) + ny * side);
      core.lineTo(x, y);
      if ((i + frame) % Math.max(2, Math.ceil(steps / 3)) !== 1) continue;
      const off = (side < 0 ? -1 : 1) * (jag * 1.5 + Math.abs(side));
      const fx = Math.round(x + dx / steps + nx * off);
      const fy = Math.round(y + dy / steps + ny * off);
      forks.moveTo(x, y);
      forks.lineTo(fx, fy);
      forks.lineTo(Math.round(fx + dx / steps - nx * off * 0.25), Math.round(fy + dy / steps - ny * off * 0.25));
    }
    core.lineTo(x1, y1);
    return { core, forks };
  });
}

function drawLightning(f, k) {
  const frame = k < 0.19 ? 0 : k < 0.42 ? 1 : 2;
  const { core, forks } = f.frames[frame];
  const fade = 1 - k;
  g.globalAlpha = fade * 0.35;
  g.strokeStyle = f.color;
  g.lineWidth = frame === 0 ? 9 : 6;
  g.stroke(core);
  g.globalAlpha = fade;
  g.lineWidth = frame === 2 ? 1 : 2;
  g.stroke(forks);
  g.strokeStyle = frame === 2 ? f.color : "#ffffff";
  g.lineWidth = frame === 0 ? 3 : 1.5;
  g.stroke(core);
  g.globalAlpha = 1;
  g.lineWidth = 1;
}

/** A bright cutting edge followed by two pieces of the crescent as it peels away. */
function drawSlash(f, k) {
  const way = f.rev ? -1 : 1;
  const progress = Math.min(1, k * 2.6), fade = Math.min(1, (1 - k) * 1.8);
  const head = f.ang + way * (-1.28 + 2.56 * (1 - (1 - progress) ** 2));
  const span = 2.48 * Math.min(1, progress * 1.55);
  const radius = f.r * (0.92 + k * 0.13);
  const crescent = (reach, tail, scale, thickness, color, alpha) => {
    g.fillStyle = color;
    g.globalAlpha = alpha * fade;
    g.beginPath();
    const n = 10;
    // The thicker section follows the tip. Both the tip and the shed tail come to points.
    for (let i = 0; i <= n * 2 + 1; i++) {
      const inside = i > n, t = (inside ? n * 2 + 1 - i : i) / n;
      const a = head - way * (tail + reach * (1 - t));
      const w = scale - (inside ? thickness * Math.sin(Math.PI * t) * (0.45 + t * 0.75) : 0);
      g.lineTo(Math.round(f.x + Math.cos(a) * radius * w), Math.round(f.y + Math.sin(a) * radius * w));
    }
    g.closePath();
    g.fill();
  };
  if (k > 0.19) {
    const peel = (k - 0.19) * 0.9;
    crescent(span * 0.65, 0.32 + peel, 0.76 - peel * 0.14, 0.082, f.color, 0.58);
    crescent(span * 0.48, 0.57 + peel, 0.59 - peel * 0.14, 0.047, f.color, 0.36);
  }
  crescent(span, k * 0.18, 1, 0.33, f.color, 0.95);
  crescent(span * 0.83, 0, 0.985, k < 0.42 ? 0.16 : 0.083, "#fff9ef", k < 0.51 ? 0.95 : 0.65);
}
/** An arrow driven into a wall: its head buried, the shaft quivering a step either way, then gone. */
function stuckArrow(x, y, ang, tier) {
  const L = Math.max(6, Math.round(11 * isoLen(ang)));
  // the head goes in: the sprite drawn back along its own line by a third of its length
  const ox = Math.round(x - Math.cos(ang) * L * 0.3), oy = Math.round(y - Math.sin(ang) * L * 0.3);
  fx.add({ k: "custom", dur: 1100, draw: (c, k) => {
    const wob = k < 0.2 ? (Math.floor(k * 60) % 2 ? 1 : -1) * (2 * Math.PI / ARROW_STEPS) * (1 - k / 0.2) * 1.5 : 0;
    if (k > 0.8 && Math.floor(k * 40) % 2) return;            // blinks out
    c.drawImage(arrowSprite(ang + wob, tier), ox - 8, oy - 8);
  } });
  for (let i = 0; i < 5; i++) parts.push({ x, y, vx: -Math.cos(ang) * (10 + Math.random() * 20) + (Math.random() - 0.5) * 16, vy: -Math.sin(ang) * 10 - 10 - Math.random() * 14, life: 0.22 + Math.random() * 0.12, color: i % 2 ? "#cdbfa6" : "#8a7e70", g: 140, s: 1 });
}
/** The string let go: two short speed lines leaping forward off the riser and a fleck off the string (drawPerson, at the release). */
export function bowSnap(x, y, ang, fin, glow) {
  fx.add({ k: "custom", dur: fin ? 150 : 110, draw: (c, k) => {
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, run = (fin ? 9 : 6) * (0.4 + k), len = Math.max(1, Math.round((fin ? 6 : 4) * (1 - k)));
    c.fillStyle = k < 0.35 ? "#ffffff" : glow && glow !== "#ffffff" ? glow : "#fff4dc";
    for (const o of fin ? [-4, 0, 4] : [-3, 3]) for (let i = 0; i < len; i++) c.fillRect(Math.round(x + ux * (run + i) + nx * o), Math.round(y + uy * (run + i) + ny * o), 1, 1);
  } });
}

export const fx = {
  list: [],
  clear() { this.list.length = 0; parts.length = 0; arrows.clear(); },
  // a hidden tab draws nothing (no frames): only the effects something waits on (`done`) are kept, the rest would pile up and burst on return
  add(o) { if (document.hidden && !o.done) return; o.t0 = fxNow() + (o.delay || 0); this.list.push(o); },
  ring(wx, wy, r, color, dur = 300, filled = false, delay = 0) { this.add({ k: "ring", x: wx * P, y: wy * P, r: r * P, color, dur, filled, delay }); },
  tele(wx, wy, r, ms) { this.add({ k: "tele", x: wx * P, y: wy * P, r: r * P, dur: ms }); },
  proj(ax, ay, ah, bx, by, bh, color, size, speed, done) {
    const [x0, y0] = iso(ax, ay), [x1, y1] = iso(bx, by), far = Math.hypot(bx - ax, by - ay) * P;
    this.add({ k: "proj", x0, y0: y0 - ah * 22, x1, y1: y1 - bh * 22, arc: Math.min(16, far * 0.05), color, size: Math.max(2, Math.round(size * 44)), dur: Math.max(70, (far / (speed * 26)) * 1000), done });
  },
  /** An impact: spokes thrown out from a point a little above the ground. */
  spark(wx, wy, color = "#ffffff", size = 1) { const [x, y] = iso(wx, wy); this.add({ k: "spark", x, y: y - 6, color, r: 13 * size, n: size > 1.3 ? 8 : 6, a0: Math.random() * 6.28, dur: 190 }); },
  /** A blade's crescent, centred on the attacker and opening toward `ang` (an angle on the ground). */
  slash(wx, wy, ang, color, size = 0.8, rev = false) { const [x, y] = iso(wx, wy); this.add({ k: "slash", x, y: y - 8, ang: sAng(Math.cos(ang), Math.sin(ang)), color, r: size * 30, rev, dur: 260, delay: 90 }); },
  beam(ax, ay, bx, by, color, h = 0.6) { const [x0, y0] = iso(ax, ay), [x1, y1] = iso(bx, by); this.add({ k: "beam", x0, y0: y0 - h * 22, x1, y1: y1 - h * 22, color, dur: 260 }); },
  pillar(wx, wy) { const [x, y] = iso(wx, wy); this.add({ k: "pillar", x, y, dur: 900 }); this.sparkle(wx, wy, 0.5, "#ffd84a", 24); },
  burst(wx, wy, h, color, n = 8, speed = 1.4) { const [x, y] = iso(wx, wy); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = speed * 34 * (0.3 + Math.random() * 0.7); parts.push({ x, y: y - h * 22, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 30, life: 0.25 + Math.random() * 0.3, color, g: 220 }); } },
  sparkle(wx, wy, h, color, n = 10) { const [x, y] = iso(wx, wy); for (let i = 0; i < n; i++) parts.push({ x: x + Math.random() * 28 - 14, y: y - h * 22 + Math.random() * 18 - 6, vx: 0, vy: -26 - Math.random() * 34, life: 0.4 + Math.random() * 0.5, color, g: 0 }); },
  /** A skill's core flash: a white-hot disc for the first frame or two, a yellow one shrinking after (60 ms). */
  flash(wx, wy, r = 14, delay = 0, h = 0.35) { const [x, y] = iso(wx, wy); this.add({ k: "flash", x, y: y - h * 22, r, dur: 64, delay }); },
  /** A shockwave: a thin bright ring racing out flat over the ground to radius r, a fainter one behind it. */
  wave(wx, wy, r, color = "#ffffff", dur = 340, delay = 0) { this.add({ k: "wave", x: wx * P, y: wy * P, r: r * P, color, dur, delay }); },
  /** A pillar of lightning striking (wx, wy) out of the sky. */
  zap(wx, wy, color = "#bfe8ff", dur = 240, delay = 0) {
    if (document.hidden) return;
    const [x, y] = iso(wx, wy);
    this.add({ k: "lightning", frames: lightningFrames(x, y - 150, x, y), color, dur, delay });
    this.flash(wx, wy, 16, delay, 0.1);
    this.wave(wx, wy, 26, color, 300, delay);
  },
  /** A marked line something is about to run down, from a to b; it fills as the moment (`ms`) nears. */
  lane(ax, ay, bx, by, ms, color = "#ff5a6a", width = 13) { this.add({ k: "lane", x0: ax * P, y0: ay * P, x1: bx * P, y1: by * P, w: width * P, color, dur: ms }); },
  /** A puddle on the ground: appears after `delay` ms and lies there for `ms`. */
  pool(wx, wy, r, ms, color = POOL_COL[0], delay = 0) { this.add({ k: "pool", x: wx * P, y: wy * P, r: r * P, color, dur: ms, delay, seed: Math.random() * 6.28 }); },
  /** Something lobbed from a to b: it arcs over for `ms`, with its landing spot marked meanwhile. */
  lob(ax, ay, bx, by, ms, color = "#ff8a5a", r = 13) {
    this.add({ k: "mark", x: bx * P, y: by * P, r: r * P, color, dur: ms });
    const [x0, y0] = iso(ax, ay), [x1, y1] = iso(bx, by);
    this.add({ k: "lob", x0, y0: y0 - 10, x1, y1, color, dur: ms });
  },
  /** A spread of shots from one point to several (`pts` is [[x, y], …]), all landing after `ms`. */
  volley(ax, ay, pts, ms, color = "#ff8a5a") { for (const [bx, by] of pts) this.lob(ax, ay, bx, by, ms, color); },
  /** A monster spitting a puddle: the gob flies for `fly` ms, then the puddle lies for `life` ms. `kind`: 0 poison, 1 fire, 2 blood. */
  spit(ax, ay, bx, by, r, fly, life, kind = 0) { const c = POOL_COL[kind] || POOL_COL[0]; this.lob(ax, ay, bx, by, fly, c, r); this.pool(bx, by, r, life, c, fly); },
  /** A small hit on the ground where a shot lands: no shake, no noise. */
  pop(wx, wy, r = 13, color = "#ff8a5a") { this.ring(wx, wy, r, color, 220, true); this.burst(wx, wy, 0.1, color, 6, 1.2); },
  // ── for the second-tier skills and the ultimates
  /** Blades whirling round a point: `n` short arcs sweeping a ring of radius `r` (an ellipse on the ground). */
  storm(wx, wy, r, color = "#d8e8ff", dur = 420, n = 5) { const [x, y] = iso(wx, wy); this.add({ k: "storm", x, y: y - 6, r: r * Math.SQRT2 * K, color, dur, n, a0: Math.random() * 6.28 }); },
  /** The ground split open: jagged cracks running out from a point, flat on the ground. */
  crack(wx, wy, r, color = "#ffb04a", dur = 700, scar = false) {
    const rays = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28 + Math.random() * 0.4, pts = [[0, 0]]; let d = 0; while (d < 1) { d += 0.18 + Math.random() * 0.12; pts.push([Math.cos(a) * d + (Math.random() - 0.5) * 0.12, Math.sin(a) * d + (Math.random() - 0.5) * 0.12]); } rays.push(pts); }
    this.add({ k: "crack", x: wx * P, y: wy * P, r: r * P, color, dur, rays, scar });
  },
  /** A jagged bolt of lightning from a to b. */
  bolt(ax, ay, bx, by, color = "#9fdcff", dur = 240) {
    if (document.hidden) return;
    const [x0, y0] = iso(ax, ay), [x1, y1] = iso(bx, by);
    this.add({ k: "lightning", frames: lightningFrames(x0, y0 - 14, x1, y1 - 14), color, dur });
  },
  /** Something huge coming straight down out of the sky onto (wx, wy), landing at `ms`. */
  fall(wx, wy, color = "#ffd84a", ms = 450) { const [x, y] = iso(wx, wy); this.add({ k: "fall", x, y, color, dur: ms + 260, land: ms / (ms + 260) }); },
  /** Snow driven across a round patch of ground for `ms`. */
  snow(wx, wy, r, ms = 3600) { this.add({ k: "snow", x: wx * P, y: wy * P, r: r * P, dur: ms }); },
  // ── the bow's arrows (server units throughout; skillfx.js turns the wire's "ar"/"ae" into these)
  /**
   * An arrow loosed at (ax, ay) toward (bx, by): it flies the whole way unless arrowEnd cuts it short.
   * `o`: spd units/s (420) · h height above the ground in px (9) · delay ms it waits on the string
   * (the stroke's release, impactMs("bow", beat), minus what has passed) — it flies a little faster
   * to land when an undelayed one would · tier 1–5 (trail: T4 cyan, T5 violet) · pierce (the
   * piercing streak, white-hot) · id (for arrowEnd) · end "fade" | "hit" | "stuck" (how it ends if it
   * flies the whole way; default fade) · done(). Returns the effect.
   */
  arrow(ax, ay, bx, by, o = {}) {
    const far = Math.hypot(bx - ax, by - ay) || 1, spd = o.spd || 420, flight = (far / spd) * 1000, delay = Math.max(0, o.delay || 0);
    const v = far / Math.max(flight * 0.5, flight - delay);   // units per ms, caught up
    const now = fxNow();
    for (const [id, a] of arrows) if (a.gone && now - a.goneAt > 1500) arrows.delete(id);
    const f = { k: "arrow", wx: ax, wy: ay, ux: (bx - ax) / far, uy: (by - ay) / far, len: far, full: far, v, h: o.h ?? 9, tier: Math.max(1, Math.min(6, o.tier | 0 || 1)), pierce: !!o.pierce, end: o.end || "fade", delay, dur: far / v };
    f.done = () => { arrowLanded(f); if (o.done) o.done(); };
    if (o.id !== undefined) arrows.set(o.id, f);
    this.add(f);
    return f;
  },
  /**
   * The server says arrow `id` ended at (wx, wy): `how` "hit" (a spark), "stuck" (left in a wall) or
   * "fade" (ran out of range). An arrow still in flight is cut short there (it lands when it gets
   * there); one already gone — or never seen — just ends there now.
   */
  arrowEnd(id, wx, wy, how = "hit") {
    const f = arrows.get(id);
    if (f && !f.gone) {
      f.len = Math.min(f.len, Math.max(0, (wx - f.wx) * f.ux + (wy - f.wy) * f.uy));
      f.dur = Math.max(1, f.len / f.v); f.end = how;
      return;
    }
    const ang = f ? Math.atan2(f.uy, f.ux) : 0, tier = f ? f.tier : 1, h = f ? f.h : 9;
    if (how === "stuck" && f) { const [x, y] = iso(wx, wy); stuckArrow(x, y - h, sAng(f.ux, f.uy), tier); }
    else if (how === "hit") this.arrowHit(wx, wy, ang, "#ffffff", false, h);
  },
  /** Where an arrow strikes: a white-hot pixel core and short spokes thrown on along its flight (`ang` on the ground). */
  arrowHit(wx, wy, ang = 0, color = "#ffffff", big = false, h = 9) {
    const [x, y] = iso(wx, wy);
    this.add({ k: "ahit", x, y: y - h, ang: sAng(Math.cos(ang), Math.sin(ang)), color, big, dur: big ? 200 : 150 });
  },
};
/**
 * The skills' effects, scaled up (skillfx.js and growth.js draw through this): bursts and sparkles
 * 1.8× as dense and 1.35× as fast, sparks and slashes 1.5×, decorative rings 1.5× (a filled ring
 * marks the real reach of a blast, so it keeps its size and gets a shockwave racing out to 1.6×
 * past it instead), cracks 1.5× over a dark scar that lingers, a white-hot core flash wherever a
 * blast, a spark or a falling thing lands (once per spot), a lightning pillar at the end of every
 * bolt, and a shake that is stronger and, given `ang` (the skill's aim on the ground), directional.
 */
export function big(ang) {
  const F = fx, flashed = new Set();
  const flash = (wx, wy, r, delay = 0) => { const key = `${Math.round(wx / 8)},${Math.round(wy / 8)},${delay}`; if (!flashed.has(key)) { flashed.add(key); F.flash(wx, wy, r, delay); } };
  const W = Object.create(F);
  W.ring = (wx, wy, r, color, dur = 300, filled = false, delay = 0) => {
    if (!filled) return F.ring(wx, wy, r * 1.5, color, dur * 1.15, false, delay);
    F.ring(wx, wy, r, color, dur * 1.15, true, delay);
    F.wave(wx, wy, r * 1.6, color, dur + 80, delay);
    flash(wx, wy, Math.min(26, 8 + r * 0.22), delay);
  };
  W.burst = (wx, wy, h, color, n = 8, speed = 1.4) => F.burst(wx, wy, h, color, Math.round(n * 1.8), speed * 1.35);
  W.sparkle = (wx, wy, h, color, n = 10) => F.sparkle(wx, wy, h, color, Math.round(n * 1.8));
  W.spark = (wx, wy, color, size = 1) => { F.spark(wx, wy, color, size * 1.5); flash(wx, wy, 7 + size * 5); };
  W.storm = (wx, wy, r, color, dur = 420, n = 5) => F.storm(wx, wy, r * 1.15, color, dur * 1.1, n + 2);
  W.slash = (wx, wy, a, color, size = 0.8, rev = false) => F.slash(wx, wy, a, color, size * 1.5, rev);
  W.crack = (wx, wy, r, color = "#ffb04a", dur = 700) => {
    F.crack(wx, wy, r * 1.3, "#2b2233", dur + 1100, true);   // the scar it leaves, under the glow
    F.crack(wx, wy, r * 1.5, color, dur);
    F.wave(wx, wy, r * 2.2, "#ffffff", 300);
    F.wave(wx, wy, r * 1.5, color, 380, 60);
  };
  W.bolt = (ax, ay, bx, by, color = "#9fdcff", dur = 240) => { F.bolt(ax, ay, bx, by, color, dur); F.zap(bx, by, color, dur); };
  W.fall = (wx, wy, color = "#ffd84a", ms = 450) => { F.fall(wx, wy, color, ms); flash(wx, wy, 20, ms); F.wave(wx, wy, 44, color, 360, ms); };
  return { fx: W, shake: (n, a = ang) => shake(n * 1.3, a), big };
}
/**
 * Shake the view. With no direction: a short sharp jitter of about ±n/2 px (a plain hit: 2–3).
 * With `ang` (a direction on the ground, radians): a kick of n px along it that swings back and
 * forth and dies in about a tenth of a second — crits and the big skills, along the blow.
 */
export function shake(n, ang) {
  if (ang === undefined || !isFinite(ang)) { shakeAmt = Math.max(shakeAmt, n); return; }
  if (n < kick.amt) return;
  const sx = Math.cos(ang) - Math.sin(ang), sy = (Math.cos(ang) + Math.sin(ang)) / 2, l = Math.hypot(sx, sy) || 1;
  kick.x = sx / l; kick.y = sy / l; kick.amt = n; kick.t0 = fxNow();
  shakeAmt = Math.max(shakeAmt, n * 0.25);
}
export const kick = { x: 0, y: 0, amt: 0, t0: 0 };

// ───────────────────────────── drawing the effects ─────────────────────────────

export function drawFx(now, ground2) {
  for (let i = fx.list.length - 1; i >= 0; i--) {
    const f = fx.list[i], k = (now - f.t0) / f.dur;
    if (k < 0) continue;
    if (k >= 1) { fx.list.splice(i, 1); if (f.done) f.done(); continue; }
    const flat = f.k === "ring" || f.k === "wave" || f.k === "tele" || f.k === "lane" || f.k === "pool" || f.k === "mark" || f.k === "crack" || f.k === "snow" || (f.k === "custom" && f.flat);
    if (flat !== ground2) continue;
    if (f.k === "custom") { g.save(); f.draw(g, k, f); g.restore(); continue; }
    if (f.k === "qi") { g.globalAlpha = 1; drawQi(f, k); continue; }
    if (f.k === "arrow") { g.globalAlpha = 1; drawArrow(f, k); continue; }
    if (f.k === "ahit") {
      // pixel spokes thrown on along the flight (a cone of five, one kicked back), a white core for the first frames
      g.globalAlpha = 1;
      const R = f.big ? 11 : 7, n = f.big ? 7 : 5;
      g.fillStyle = k < 0.3 ? "#ffffff" : f.color;
      for (let j = 0; j <= n; j++) {
        const a = j === n ? f.ang + Math.PI : f.ang + (j / (n - 1) - 0.5) * 2.2, r0 = R * (0.2 + 0.7 * k), r1 = R * (0.5 + 0.6 * k) * (j === n ? 0.5 : 1);
        for (let r = r0; r <= r1; r += 1.5) g.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r * 0.75), 1, 1);
      }
      if (k < 0.3) { const c = f.big ? 2 : 1; g.fillStyle = "#ffffff"; g.fillRect(Math.round(f.x) - c, Math.round(f.y) - c, c * 2 + 1, c * 2 + 1); }
      continue;
    }
    if (f.k === "flash") {
      // pixel rows, no smoothing: white-hot with a yellow rim, then a smaller yellow core
      const hot = k < 0.5, rx = Math.round(f.r * (hot ? 1 : 0.6)), ry = Math.max(1, Math.round(rx * 0.75));
      g.globalAlpha = 1;
      for (let dy = -ry; dy <= ry; dy++) {
        const w = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
        g.fillStyle = hot ? "#fff6b0" : "#ffd84a"; g.fillRect(Math.round(f.x) - w, Math.round(f.y) + dy, w * 2 + 1, 1);
        if (hot && w > 2) { g.fillStyle = "#ffffff"; g.fillRect(Math.round(f.x) - w + 2, Math.round(f.y) + dy, w * 2 - 3, 1); }
      }
      continue;
    }
    if (f.k === "lightning") { drawLightning(f, k); continue; }
    if (f.k === "ring") {
      g.globalAlpha = 1 - k;
      if (f.filled) { g.fillStyle = f.color; g.globalAlpha = (1 - k) * 0.35; g.beginPath(); g.arc(f.x, f.y, f.r * k, 0, 7); g.fill(); g.globalAlpha = 1 - k; }
      g.strokeStyle = f.color; g.lineWidth = 5;
      g.beginPath(); g.arc(f.x, f.y, f.r * k, 0, 7); g.stroke();
    } else if (f.k === "wave") {
      const u = Sw.oExpo(k);
      g.strokeStyle = f.color; g.globalAlpha = 1 - k; g.lineWidth = 3;
      g.beginPath(); g.arc(f.x, f.y, f.r * (0.15 + 0.85 * u), 0, 7); g.stroke();
      g.globalAlpha = (1 - k) * 0.5; g.lineWidth = 2;
      g.beginPath(); g.arc(f.x, f.y, f.r * (0.1 + 0.68 * u), 0, 7); g.stroke();
    } else if (f.k === "tele") {
      g.fillStyle = `rgba(255,60,120,${0.16 + 0.16 * Math.abs(Math.sin(now / 70))})`;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill();
      g.strokeStyle = "#ff6ad0"; g.lineWidth = 4;
      g.beginPath(); g.arc(f.x, f.y, f.r * k, 0, 7); g.stroke();
    } else if (f.k === "lane") {
      // a band along the ground, pulsing, with a brighter part that runs out to the far end as time runs out
      const dx = f.x1 - f.x0, dy = f.y1 - f.y0, len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * f.w / 2, ny = (dx / len) * f.w / 2;
      const quad = (t) => { g.beginPath(); g.moveTo(f.x0 + nx, f.y0 + ny); g.lineTo(f.x0 + dx * t + nx, f.y0 + dy * t + ny); g.lineTo(f.x0 + dx * t - nx, f.y0 + dy * t - ny); g.lineTo(f.x0 - nx, f.y0 - ny); g.closePath(); };
      g.fillStyle = f.color;
      g.globalAlpha = 0.16 + 0.12 * Math.abs(Math.sin(now / 70)); quad(1); g.fill();
      g.globalAlpha = 0.42; quad(k); g.fill();
      g.globalAlpha = 0.9; g.strokeStyle = f.color; g.lineWidth = 2; quad(1); g.stroke();
    } else if (f.k === "pool") {
      // a lumpy puddle that seeps in, lies, and dries out
      const a = k < 0.06 ? k / 0.06 : k > 0.85 ? (1 - k) / 0.15 : 1;
      g.fillStyle = f.color;
      g.globalAlpha = 0.46 * a;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill();
      for (let j = 0; j < 5; j++) { const an = f.seed + j * 1.257, rr = f.r * 0.8; g.beginPath(); g.ellipse(f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr, f.r * 0.3, f.r * 0.26, an, 0, 7); g.fill(); }
      g.globalAlpha = 0.85 * a; g.strokeStyle = f.color; g.lineWidth = 2;
      const pr = f.r * (0.5 + 0.12 * Math.sin(now / 300 + f.seed));
      g.beginPath(); g.arc(f.x, f.y, pr, 0, 7); g.stroke();
      if (Math.random() < 0.12) { const [px2, py2] = sqI(f.x + (Math.random() - 0.5) * f.r * 1.4, f.y + (Math.random() - 0.5) * f.r * 1.4); parts.push({ x: px2, y: py2, vx: 0, vy: -14, life: 0.5, color: f.color, g: 0, s: 2 }); }
    } else if (f.k === "mark") {
      // where a lobbed shot will land: a ring that fills in as it comes down
      g.strokeStyle = f.color; g.lineWidth = 2; g.globalAlpha = 0.9;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.stroke();
      g.fillStyle = f.color; g.globalAlpha = 0.14 + 0.3 * k;
      g.beginPath(); g.arc(f.x, f.y, f.r * k, 0, 7); g.fill();
    } else if (f.k === "slash") {
      // a tapered crescent that sweeps open and fades
      drawSlash(f, k);
    } else if (f.k === "spark") {
      // an impact: a white core and spokes thrown outward
      g.globalAlpha = 1 - k;
      g.fillStyle = f.color;
      for (let j = 0; j < f.n; j++) {
        const a = f.a0 + (j / f.n) * Math.PI * 2, r0 = f.r * (0.25 + 0.5 * k), r1 = f.r * (0.6 + 0.9 * k), w = Math.max(1, Math.round(3 * (1 - k)));
        for (let q = 0; q <= 4; q++) { const r = r0 + ((r1 - r0) * q) / 4; g.fillRect(Math.round(f.x + Math.cos(a) * r - w / 2), Math.round(f.y + Math.sin(a) * r - w / 2), w, w); }
      }
      if (k < 0.35) { g.fillStyle = "#ffffff"; const c = Math.round(f.r * 0.45 * (1 - k)); g.fillRect(Math.round(f.x - c), Math.round(f.y - c), c * 2, c * 2); }
    } else if (f.k === "proj") {
      const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * (f.arc || 0);
      g.fillStyle = f.color; g.fillRect(Math.round(x - f.size / 2), Math.round(y - f.size / 2), f.size, f.size);
      g.fillStyle = "#ffffff"; g.fillRect(Math.round(x - f.size / 4), Math.round(y - f.size / 4), Math.ceil(f.size / 2), Math.ceil(f.size / 2));
      if (Math.random() < 0.7) parts.push({ x, y, vx: 0, vy: 0, life: 0.18, color: f.color, g: 0 });
    } else if (f.k === "lob") {
      // a gob in the air: straight along the ground, up and over in an arc
      const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 28;
      g.fillStyle = "#2b2233"; g.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
      g.fillStyle = f.color; g.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
      g.fillStyle = "#ffffff"; g.fillRect(Math.round(x - 1), Math.round(y - 2), 2, 2);
      if (Math.random() < 0.5) parts.push({ x, y, vx: 0, vy: 0, life: 0.16, color: f.color, g: 0 });
    } else if (f.k === "beam") {
      g.globalAlpha = 1 - k; g.strokeStyle = f.color; g.lineWidth = 6; g.beginPath(); g.moveTo(f.x0, f.y0); g.lineTo(f.x1, f.y1); g.stroke();
      g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.beginPath(); g.moveTo(f.x0, f.y0); g.lineTo(f.x1, f.y1); g.stroke();
    } else if (f.k === "pillar") {
      g.globalAlpha = (1 - k) * 0.6; g.fillStyle = "#fff0a0"; g.fillRect(f.x - 14, f.y - 120, 28, 124); g.fillStyle = "#ffffff"; g.fillRect(f.x - 6, f.y - 120, 12, 124);
    } else if (f.k === "storm") {
      // short tapered arcs chasing each other round, fast at first and easing off
      const spin = f.a0 + (1 - (1 - k) * (1 - k)) * 7.5, n = 9;
      g.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      for (let j = 0; j < f.n; j++) {
        const a0 = spin + (j / f.n) * 6.28;
        for (const [col, rr, w] of [[f.color, f.r, 4], ["#ffffff", f.r - 1, 2]]) {
          g.strokeStyle = col; g.lineWidth = w;
          g.beginPath();
          for (let q = 0; q <= n; q++) { const a = a0 + (q / n) * 0.9; g.lineTo(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.5); }
          g.stroke();
        }
      }
      if (Math.random() < 0.6) { const a = Math.random() * 6.28; parts.push({ x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r * 0.5, vx: -Math.sin(a) * 60, vy: Math.cos(a) * 30 - 10, life: 0.25, color: f.color, g: 0, s: 2 }); }
    } else if (f.k === "crack") {
      // cracks run out in the first fifth, glow, then darken and fade
      const run = Math.min(1, k * 5), a = k < 0.6 ? 1 : (1 - k) / 0.4;
      if (f.scar) {
        // the scar a slam leaves: thin dark fissures, already there, fading slowly
        g.globalAlpha = 0.5 * Math.min(1, (1 - k) / 0.5); g.strokeStyle = f.color; g.lineWidth = 3;
        for (const pts of f.rays) { g.beginPath(); for (const [px2, py2] of pts) g.lineTo(f.x + px2 * f.r, f.y + py2 * f.r); g.stroke(); }
        g.globalAlpha = 1; g.lineWidth = 1;
        continue;
      }
      for (const pts of f.rays) {
        const m = Math.max(1, Math.ceil(pts.length * run));
        for (const [col, w] of [["#2b2233", 8], [k < 0.35 ? "#fff0b0" : f.color, 3.5]]) {
          g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w;
          g.beginPath();
          for (let q = 0; q < m; q++) g.lineTo(f.x + pts[q][0] * f.r, f.y + pts[q][1] * f.r);
          g.stroke();
        }
      }
    } else if (f.k === "fall") {
      // a shaft of light dropping onto its mark, then a flash where it lands
      if (k < f.land) {
        const q = k / f.land, top = f.y - 220 + q * 200;
        g.fillStyle = f.color; g.globalAlpha = 0.35 + q * 0.4; g.fillRect(f.x - 9, top - 60, 18, 60);
        g.fillStyle = "#ffffff"; g.globalAlpha = 0.9; g.fillRect(f.x - 3, top - 70, 6, 72);
        g.fillStyle = f.color; g.fillRect(f.x - 7, top, 14, 6); g.fillRect(f.x - 4, top + 6, 8, 5); g.fillRect(f.x - 1, top + 11, 2, 4);
      } else {
        const q = (k - f.land) / (1 - f.land);
        g.globalAlpha = 1 - q; g.fillStyle = "#ffffff"; g.fillRect(f.x - 16 * (1 - q), f.y - 140, 32 * (1 - q), 140);
        g.fillStyle = f.color; g.fillRect(f.x - 26 * (1 - q) - 2, f.y - 6, 52 * (1 - q) + 4, 6);
      }
    } else if (f.k === "snow") {
      // flakes blown slantwise over the patch, a pale wash under them
      const a = k < 0.08 ? k / 0.08 : k > 0.9 ? (1 - k) / 0.1 : 1;
      g.globalAlpha = 0.24 * a; g.fillStyle = "#cfeaff";
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill();
      // a pale rim turning slowly, so the patch reads as one storm
      g.globalAlpha = 0.7 * a; g.strokeStyle = "#ffffff"; g.lineWidth = 4;
      for (let j = 0; j < 4; j++) { const a0 = now / 500 + j * 1.57; g.beginPath(); g.arc(f.x, f.y, f.r, a0, a0 + 0.8); g.stroke(); }
      g.globalAlpha = a;
      for (let q = 0; q < 7; q++) if (Math.random() < 0.9) { const ang = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * f.r, [sx2, sy2] = sqI(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr); parts.push({ x: sx2 - 20, y: sy2 - 46, vx: 70 + Math.random() * 30, vy: 60 + Math.random() * 30, life: 0.6, color: Math.random() < 0.6 ? "#ffffff" : "#bfe6ff", g: 0, s: Math.random() < 0.3 ? 3 : 2 }); }
    }
    g.globalAlpha = 1; g.lineWidth = 1;
  }
}

// ───────────────────────────── the aim mark ─────────────────────────────

// ── the aim mark: a small solid arrowhead lying on the ground just in front of your own feet,
// its sharp tip toward where your blows and skills will go (G.me.aimI, the server's aim steps). A
// dark triangle inside a thin pale rim, so it reads on grass, sand, stone, crypt and abyss alike.
const AIM_STEPS = 64, aimSprites = new Map(), aimArrow = { a: null };
const AIM_FILL = "#1a1320", AIM_RIM = "rgba(255,246,218,.92)", AIM_C = 6;
/**
 * The arrowhead for screen angle step `k`, worked out pixel by pixel (no smoothed edges): a filled
 * triangle LEN px from tip to its flat back, HALF° to each side of the aim at the back corners, its
 * flanks drawn in a little (power BOW) so the tip stays a one-pixel point at every angle — a plain
 * near-equilateral triangle this small reads as pointing three ways at once. Squashed a little so it
 * lies on the floor, a one-pixel rim all round: about 8 px long, rim and all.
 * The sprite's centre is (AIM_C, AIM_C); the tip is TIP px ahead of it.
 */
function aimSprite(k) {
  let c = aimSprites.get(k);
  if (c) return c;
  const ang = (k / AIM_STEPS) * 2 * Math.PI, ax = Math.cos(ang), ay = Math.sin(ang);
  const TIP = 3.6, LEN = 6.6, HALF = (20 * Math.PI) / 180, BOW = 1.25, SQ = 0.9, N = AIM_C * 2 + 1;
  const hw = LEN * Math.tan(HALF);
  const fill = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    // into the mark's own frame: d behind the tip along the aim, v across it
    const px = i - AIM_C, py = (j - AIM_C) / SQ, d = TIP - (px * ax + py * ay), v = Math.abs(-px * ay + py * ax);
    fill[j * N + i] = d >= -0.25 && d <= LEN && v <= hw * (Math.max(0, d) / LEN) ** BOW + 0.3;
  }
  const on = (i, j) => i >= 0 && j >= 0 && i < N && j < N && fill[j * N + i];
  let x;
  [c, x] = sheet(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (on(i, j)) { x.fillStyle = AIM_FILL; x.fillRect(i, j, 1, 1); }
    else if (on(i + 1, j) || on(i - 1, j) || on(i, j + 1) || on(i, j - 1)) { x.fillStyle = AIM_RIM; x.fillRect(i, j, 1, 1); }
  }
  aimSprites.set(k, c);
  return c;
}
/** Draw the mark: under the bodies when it points down the screen, over them when it points up,
 *  lifted clear of the head (your name lifts to make room: G.aimUpK) rather than lying on your back.
 *  It slides smoothly round between steps and brightens for a moment with each blow or spell. */
export function drawAimArrow(t, dt, top) {
  const me = G.me;
  if (G.aimArrow === false || me.aimI === undefined || me.dead || me.sit || !G.defs) return;
  const n = (G.defs.aim && G.defs.aim[0]) || 64, want = (me.aimI / n) * 2 * Math.PI;
  if (!top) {
    if (aimArrow.a === null) aimArrow.a = want;
    let d = want - aimArrow.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    aimArrow.a += d * Math.min(1, dt * 16);
  }
  const wx = Math.cos(aimArrow.a), wy = Math.sin(aimArrow.a);
  const s = Math.atan2((wx + wy) / 2, wx - wy);           // the same way, as it looks on screen
  const up = Math.sin(s) < -0.3;
  if (!top) G.aimUpK = (G.aimUpK || 0) + ((up ? 1 : 0) - (G.aimUpK || 0)) * Math.min(1, dt * 10);
  if (up !== top) return;
  const [fx, fy] = iso(me.x, me.y - 1);
  // out along the ground: wider across the screen than up and down, as a ring on the floor looks
  const ux = Math.cos(s) * 11, uy = Math.sin(s) * (7.5 + 12 * Math.max(0, -Math.sin(s)) ** 3);
  const k = ((Math.round((s / (2 * Math.PI)) * AIM_STEPS) % AIM_STEPS) + AIM_STEPS) % AIM_STEPS;
  const hit = t - Math.max(G.aimFlash || -1e9, G.lastSkill || -1e9);
  const flash = hit >= 0 && hit < 300 ? 1 - hit / 300 : 0;
  g.globalAlpha = 0.86 + 0.14 * flash;
  g.drawImage(aimSprite(k), Math.round(fx + ux) - AIM_C, Math.round(fy + uy) - AIM_C);
  g.globalAlpha = 1;
}
