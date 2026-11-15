/**
 * The weapon skills as the player sees them (docs/design/jobs-and-stats.md C.5, H.4): what each skill looks and
 * sounds like (fx codes 70–102 and the nine later hybrids' 120–128 on an "a" event), the passives' little
 * flashes (110–115), the things skills leave standing (a vortex, a phantom beast, a rain of arrows, traps, a
 * storm, a blood sanctuary, a rune circle: "pr" placed, "pp" a beat, "pe" gone), the tracker's lure, the bow's
 * arrows ("ar"/"ae": plain, piercing, and the element and ink arrows of kinds 4–7), and the signs drawn over
 * creatures — a dagger's marks, a book's brand, a frozen monster, a superconducted one.
 *
 * client.js hands every snapshot event here first (`skillEvent`: true = handled) and calls `onSnap` after each
 * snapshot so the flags and marks on the rows get read. Everything is drawn in code, in the game's flat pixel
 * style, through the scaled-up effect set (scene2d `big`): sparks, rings with shockwaves, a core flash, a shake
 * along the skill's aim.
 */
import * as S3 from "./scene2d.js";
import * as SP from "./sprites.js";
import { Sound } from "./audio.js";

const P = 2;                       // world unit → world pixel, as in scene2d (flat effects are drawn in these)
/** Server units → iso pixels, lifted `up` pixels: where things in the air are drawn. */
const at = (wx, wy, up = 0) => { const [x, y] = S3.iso(wx, wy); return [x, y - up]; };
/** What weapongauge.js reads: the client state and the live number off the snapshot. */
export const live = { G: null };
/** Monster signs: id → { fz, vu } (end times). */
const signs = new Map();
const sign = (id, key, until) => { const s = signs.get(id) || {}; s[key] = until; signs.set(id, s); };
const now = () => performance.now();

/** After every snapshot: flags and the gauge number on the rows, marks and brands on monsters. */
export function onSnap(s, G, t) {
  live.G = G;
  G.me.fl = s.me[8] | 0;
  G.me.cv = s.me[9] | 0;
  if (s.self) G.selfAt = t;
  for (const r of s.P) { const e = G.players.get(r[0]); if (e) e.fl = r[8] | 0; }
  for (const r of s.M) { const e = G.mobs.get(r[0]); if (e) { e.mk = r[8] | 0; e.br = r[9] | 0; } }
  if (!hooked) { S3.hooks.push(overlay); hooked = true; }
}
let hooked = false;

// ───────────────────────────── little helpers ─────────────────────────────

function text(G, str, x, y, h, col, big) { G.texts.push({ str, x, y, h, col, big: !!big, t0: now() }); }
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const INK = "#2b2233";
const rand = (a, b) => a + Math.random() * (b - a);
/** Do `fn` in `ms`, on the effects' own clock (so the preview pages that step time by hand see it too). */
const later = (ms, fn) => S3.fx.add({ k: "custom", draw() {}, dur: Math.max(1, ms), done: fn });
/** A filled ring flat on the ground for `ms`, gently pulsing, its edge marching: the reach of something standing. */
function groundRing(wx, wy, r, ms, col, fill = 0.16) {
  S3.fxCustom((g, k) => {
    const a = Math.min(1, k * 8, (1 - k) * 8);
    g.globalAlpha = fill * a; g.fillStyle = col;
    g.beginPath(); g.arc(wx * P, wy * P, r * P, 0, 7); g.fill();
    g.globalAlpha = 0.5 * a; g.strokeStyle = col; g.lineWidth = 4; g.setLineDash([12, 12]); g.lineDashOffset = -k * ms / 20;
    g.beginPath(); g.arc(wx * P, wy * P, r * P, 0, 7); g.stroke();
  }, ms, true);
}
/** A tinted copy of a sprite (for the tracker's lure). */
const tintCache = new Map();
function tinted(img, col) {
  let c = tintCache.get(img);
  if (c) return c;
  c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-atop"; g.globalAlpha = 0.55; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  tintCache.set(img, c);
  if (tintCache.size > 40) tintCache.delete(tintCache.keys().next().value);
  return c;
}
/** Points every `step` units from a to b (for things that run down a line one after another). */
function along(ax, ay, bx, by, step) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.floor(d / step)), out = [];
  for (let i = 1; i <= n; i++) out.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  return out;
}

function pixelLine(g, ax, ay, bx, by, color, width = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  for (let i = 0; i <= n; i++) px(g, ax + (bx - ax) * i / n, ay + (by - ay) * i / n, width, width, color);
}

/** Segmented light at the exact world radius, on the ground behind actors and danger markers. */
function rim(x, y, r, edge, light, ms, spread = 0.25) {
  if (!(r > 0)) return;
  const points = Math.ceil(r / 3);
  S3.fxCustom((g, k) => {
    const radius = r * (1 - spread * (1 - k) ** 3);
    const arc = Math.max(2, Math.ceil(points * (0.77 - k * 0.53)));
    for (let i = 0; i < 8; i++) for (let j = 0; j < arc; j++) {
      const a = Math.PI * (i + j / points) / 4;
      const wx = (x + Math.cos(a) * radius) * P, wy = (y + Math.sin(a) * radius) * P;
      px(g, wx, wy, k < 0.42 ? 3 : 2, k < 0.42 ? 3 : 2, k < 0.42 && j < 4 ? light : edge);
    }
  }, ms, true);
}

/** Bright strokes rise from fixed points, split and fall back into the impact. */
function shards(x, y, r, count, height, edge, light, ms, delay = 0) {
  S3.fxCustom((g, k) => {
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996, rest = (i % 4) * 0.08;
      const distance = r * (0.22 + rest + 0.39 * k), u = Math.cos(a), v = Math.sin(a);
      const [xx, yy] = at(x + u * distance, y + v * distance);
      const rise = Math.sin(k * Math.PI) * height * (0.65 + rest), lean = (u - v) * (2 + k * 6);
      const len = Math.max(2, height * (1 - k) * (0.26 + rest));
      const bx = xx + lean, by = yy - rise;
      if (k > 0.57) px(g, bx, by - len, 2, 2, edge);
      else {
        pixelLine(g, xx, by, bx, by - len, edge, 3);
        pixelLine(g, xx + 1, by - 2, bx + 1, by - len, light);
      }
    }
  }, ms, false, delay);
}

function swordCrescent(x, y, ang, r) {
  S3.fxCustom((g, k) => {
    const from = -1.18 + Math.max(0, k - 0.24) * 2.58;
    const to = Math.min(1.15, -0.26 + k * 5.2);
    for (let a = from; a < to; a += 0.025) {
      const u = Math.cos(ang + a), v = Math.sin(ang + a), reach = r * (0.78 + 0.1 * Math.cos(a * 1.4));
      const thick = Math.max(1, (1 - Math.abs(a) / 1.28) * (k < 0.32 ? 11 : 6 * (1 - k)));
      const [ax, ay] = at(x + u * (reach - thick), y + v * (reach - thick), 10);
      const [bx, by] = at(x + u * reach, y + v * reach, 10);
      pixelLine(g, ax, ay + 2, bx, by + 2, k < 0.52 ? "#648bc9" : "#7297b0", 2);
      px(g, bx, by, 2, 2, k < 0.39 ? "#ecfdff" : "#a6cced");
      if (k < 0.32) px(g, (ax + bx) / 2, (ay + by) / 2 + 1, 2, 1, "#b2e0ff");
    }
  }, 220, false, 58);
}

/** Holy light rises in points spaced along the healing seal, leaving the centre clear. */
function oathSeal(x, y, r) {
  rim(x, y, r, "#82bca4", "#e8eeb7", 430, 0.29);
  S3.fxCustom((g, k) => {
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 5 * i + k * 0.28, u = 0.45 + (i % 3) * 0.14;
      const lift = k * (21 + 4 * (i % 4)), radius = r * u;
      const [sx, sy] = at(x + Math.cos(a) * radius, y + Math.sin(a) * radius, lift);
      if (k < 0.58 && i % 2 === 0) {
        px(g, sx - 1, sy - 4, 3, 9, "#b7e7c2");
        px(g, sx - 4, sy - 1, 9, 3, "#d5efac");
        px(g, sx - 1, sy - 1, 3, 3, "#fff6ce");
      } else if (k < 0.83 || i % 2) px(g, sx, sy, 2, 2, "#acd7ac");
    }
  }, 565);
}

function soulTrail(ax, ay, bx, by, ms) {
  const [x0, y0] = at(ax, ay, 19), [x1, y1] = at(bx, by, 11);
  const d = Math.max(1, Math.hypot(x1 - x0, y1 - y0)), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
  S3.fxCustom((g, k) => {
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 7;
    const tail = Math.min(23, d * k);
    for (let i = 0; i < tail; i++) {
      const o = Math.sin(i * 0.31 - k * 8) * Math.min(6, i * 0.35);
      const sx = x - ux * i, sy = y - uy * i;
      px(g, sx + uy * o, sy - ux * o, 2, 2, i < 11 ? "#b387ed" : "#50346d");
      if (i < 16) px(g, sx - uy * o, sy + ux * o, 2, 2, "#8563bc");
    }
    for (let j = -4; j <= 4; j++) {
      const w = 4 - Math.abs(j);
      px(g, x - w, y + j, 2 * w + 1, 1, "#b878e3");
      if (w > 1) px(g, x - w + 2, y + j, 2 * w - 3, 1, "#f8dcff");
    }
  }, ms);
}

// ───────────────────────────── props: what skills leave standing ─────────────────────────────

/** Things standing, by the server's prop id: { kind, x, y, r, eid } (for its beats and its end). */
const placed = new Map();
function lure(id, eid, x, y, ms) {
  const fr = S3.personFrame(eid);
  S3.props.set("dc" + id, {
    x, y, until: now() + ms,
    draw(g, t, sx, sy) {
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(sx, sy, 5, 2, 0, 0, 7); g.fill();
      if (!fr) return;
      g.globalAlpha = 0.55 + 0.25 * Math.sin(t / 70);
      g.drawImage(tinted(fr.img, "#3a2a58"), Math.round(sx - SP.FOOT[0]), Math.round(sy - SP.FOOT[1] + Math.sin(t / 220)));
      g.globalAlpha = 1;
    },
  });
}
/** The phantom beast of 심연의 계약: a hunched shape of dark smoke with two eyes, padding after its prey. */
function phantom(id, x, y, ms) {
  const t0 = now();
  S3.props.set("pr" + id, {
    x, y, tx: x, ty: y, until: t0 + ms,
    draw(g, t, sx, sy) {
      // it glides to where it last bit (the beat moves tx/ty)
      this.x += (this.tx - this.x) * 0.25; this.y += (this.ty - this.y) * 0.25;
      sx = Math.round(sx); sy = Math.round(sy);
      const breathe = Math.round(Math.sin(t / 160)), lean = this.bite > t ? 2 : 0;
      g.fillStyle = "rgba(20,10,40,.35)"; g.beginPath(); g.ellipse(sx, sy, 10, 3, 0, 0, 7); g.fill();
      // body: rows of a hunched beast, outlined
      const rows = [[-7, 7], [-9, 9], [-10, 9], [-10, 8], [-9, 8], [-8, 9], [-6, 10], [-4, 10]];
      rows.forEach(([a, b], j) => { const y = sy - 3 - j * 2 - breathe; px(g, sx + a - 1 + lean, y - 1, b - a + 2, 3, INK); });
      rows.forEach(([a, b], j) => { const y = sy - 3 - j * 2 - breathe; px(g, sx + a + lean, y, b - a, 2, j > 5 ? "#3a2a5a" : "#24183c"); });
      // wisps trailing off its back
      for (let i = 0; i < 4; i++) { const ph = (t / 600 + i / 4) % 1; g.globalAlpha = 1 - ph; px(g, sx - 9 - ph * 8, sy - 10 - i * 3 - ph * 6, 2, 2, "#5a3a8a"); }
      g.globalAlpha = 1;
      // the eyes: two hot pixels, flaring when it bites
      const eye = this.bite > t ? "#ffffff" : "#ff5a8a";
      px(g, sx + 5 + lean, sy - 16 - breathe, 2, 1, eye); px(g, sx + 8 + lean, sy - 16 - breathe, 2, 1, eye);
      if (t - t0 < 300) { g.globalAlpha = 1 - (t - t0) / 300; px(g, sx - 12, sy - 22, 24, 22, "#8a5ad8"); g.globalAlpha = 1; }
    },
  });
}
/** A shadow trap: a small dark sigil on the ground, its corners blinking. */
function trap(id, x, y, ms) {
  S3.props.set("pr" + id, {
    x, y, until: now() + ms,
    draw(g, t, sx, sy) {
      sx = Math.round(sx); sy = Math.round(sy);
      g.globalAlpha = 0.85;
      px(g, sx - 6, sy - 1, 13, 3, INK); px(g, sx - 4, sy - 2, 9, 5, INK);
      px(g, sx - 5, sy, 11, 1, "#3a2a58"); px(g, sx - 3, sy - 1, 7, 3, "#3a2a58");
      const on = Math.sin(t / 200) > 0;
      for (const [dx, dy] of [[-6, 0], [6, 0], [0, -2], [0, 2]]) px(g, sx + dx, sy + dy, 1, 1, on ? "#c890ff" : "#6a4a9a");
      g.globalAlpha = 1;
    },
  });
}
/** Arrows falling out of the sky over a round patch for `ms` (화살비). */
function arrowRain(x, y, r, ms) {
  groundRing(x, y, r, ms, "#e8c070", 0.1);
  const drops = Array.from({ length: 26 }, () => ({ a: Math.random() * 6.28, d: Math.sqrt(Math.random()) * r, ph: Math.random() }));
  S3.fxCustom((g, k) => {
    const t = k * ms;
    for (const o of drops) {
      const u = ((t / 340 + o.ph) % 1), [sx, sy] = at(x + Math.cos(o.a) * o.d, y + Math.sin(o.a) * o.d);
      const top = sy - 70 * (1 - u);
      if (u < 0.9) { px(g, sx, top - 6, 1, 6, "#fff4dc"); px(g, sx - 1, top, 3, 1, "#c8c8d8"); }
      else { px(g, sx - 1, sy - 2, 1, 3, "#e8c070"); px(g, sx - 2, sy, 3, 1, "#a07a3a"); }
    }
  }, ms);
}
function placeProp(G, B, f, id, kind, x, y, r, ms, eid) {
  placed.set(id, { kind, x, y, r, eid });
  if (placed.size > 60) placed.delete(placed.keys().next().value);
  switch (kind) {
    case "grav": {
      groundRing(x, y, r, ms, "#8a5ad8", 0.2);
      // the vortex: dark rings turning inward
      S3.fxCustom((g, k) => {
        const t = k * ms;
        for (let i = 0; i < 3; i++) {
          const u = ((t / 900 + i / 3) % 1), rr = r * P * (1 - u);
          g.globalAlpha = 0.6 * u; g.strokeStyle = i % 2 ? "#c8a0ff" : "#3a2a58"; g.lineWidth = 3;
          g.beginPath(); g.arc(x * P, y * P, Math.max(1, rr), t / 300 + i, t / 300 + i + 4.4); g.stroke();
        }
        g.globalAlpha = 1;
      }, ms, true);
      break;
    }
    case "phantom": phantom(id, x, y, ms); f.burst(x, y, 0.4, "#3a2a58", 24, 1.8); f.ring(x, y, 22, "#8a5ad8", 360, true); break;
    case "rain": arrowRain(x, y, r, ms); break;
    case "trap": trap(id, x, y, ms); break;
    case "pillar": groundRing(x, y, r, ms, "#9fdcff", 0.14); break;
    case "meteor": groundRing(x, y, r, ms, "#ff5a3a", 0.12); break;
    case "storm": {
      groundRing(x, y, r, ms, "#bfe8ff", 0.12);
      // a low spinning cloud over it
      S3.fxCustom((g, k) => {
        const t = k * ms, [cx, cy] = at(x, y, 34);
        for (let i = 0; i < 9; i++) { const a = t / 400 + (i / 9) * 6.28, ox = Math.cos(a) * r * 0.9, oy = Math.sin(a) * r * 0.3; g.globalAlpha = 0.55; px(g, cx + ox - 4, cy + oy - 2, 8, 4, i % 2 ? "#5a6a8a" : "#3a4a6a"); }
        g.globalAlpha = 1;
      }, ms);
      break;
    }
    case "field": {
      groundRing(x, y, r, ms, "#c8324a", 0.18);
      S3.fxCustom((g, k) => {
        const t = k * ms;
        for (let i = 0; i < 8; i++) { const ph = ((t / 700 + i / 8) % 1), a = i * 0.8, [sx, sy] = at(x + Math.cos(a) * r * 0.7 * (1 - ph), y + Math.sin(a) * r * 0.7 * (1 - ph), 4 + ph * 16); g.globalAlpha = 1 - ph; px(g, sx, sy, 2, 2, "#ff6a8a"); }
        g.globalAlpha = 1;
      }, ms);
      break;
    }
    case "burst": {
      // the binding: a red sigil tightening on the ground until the blood bursts
      S3.fxCustom((g, k) => {
        const rr = r * P * (1 - 0.7 * k);
        g.globalAlpha = 0.7; g.strokeStyle = "#c8324a"; g.lineWidth = 4; g.setLineDash([16, 10]); g.lineDashOffset = k * 120;
        g.beginPath(); g.arc(x * P, y * P, rr, 0, 7); g.stroke();
        g.globalAlpha = 0.18; g.fillStyle = "#c8324a"; g.fill(); g.globalAlpha = 1;
      }, ms, true);
      break;
    }
    case "sanct": follow.set(id, { eid, r, until: now() + ms, t0: now() }); break;
    case "rune": runeCircle(placed.get(id), x, y, r, ms); break;
  }
}
/** The six marks of 메아리 법진, 3×3 each (a few strokes apiece: never a letter of any real script). */
const RUNES = ["#.#.#.#.#", ".#.###.#.", "##..#..##", "#.####..#", ".#.#.#.#.", "###.#.#.#"];
/**
 * A rune circle cut into the ground for `ms`: two rings, a triangle turning slowly inside them, six marks
 * between the rings. It is violet until its first beat; every beat ("pp") floods it with that beat's element
 * and the flood drains again before the next.
 */
function runeCircle(o, x, y, r, ms) {
  let beatT = -1e9;
  S3.fxCustom((g, k) => {
    const t = k * ms, a = Math.min(1, k * 10, (1 - k) * 8), R = r * P, cx = x * P, cy = y * P;
    if (o.beatNew) { o.beatNew = false; beatT = t; }
    const beat = Math.max(0, 1 - (t - beatT) / 340), col = ELEM_COL[o.el] || "#c8a0ff";
    g.globalAlpha = (0.16 + 0.3 * beat) * a; g.fillStyle = col;
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.globalAlpha = (0.8 + 0.2 * beat) * a; g.strokeStyle = beat > 0.6 ? "#ffffff" : col;
    g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * 0.74, 0, 7); g.stroke();
    // the triangle: three chords of the inner ring, turning
    g.beginPath();
    for (let i = 0; i <= 3; i++) { const q = t / 2600 + (i / 3) * 6.2832; g[i ? "lineTo" : "moveTo"](cx + Math.cos(q) * R * 0.74, cy + Math.sin(q) * R * 0.74); }
    g.stroke();
    // the marks ride between the rings the other way round, lit one after another
    g.fillStyle = col;
    for (let i = 0; i < 6; i++) {
      const q = -t / 3400 + (i / 6) * 6.2832, mx = Math.round(cx + Math.cos(q) * R * 0.87), my = Math.round(cy + Math.sin(q) * R * 0.87);
      g.globalAlpha = (Math.floor(t / 160) % 6 === i || beat > 0.3 ? 1 : 0.75) * a;
      for (let j = 0; j < 9; j++) if (RUNES[i][j] === "#") g.fillRect(mx - 6 + (j % 3) * 4, my - 6 + ((j / 3) | 0) * 4, 4, 4);
    }
    g.globalAlpha = 1;
  }, ms, true);
}
/** A sanctuary moves with its knight: drawn in the overlay each frame round wherever they stand. */
const follow = new Map();
function propBeat(G, B, f, e) {
  const [, id, x, y, extra] = e, o = placed.get(id);
  if (!o) return;
  switch (o.kind) {
    case "grav": f.ring(x, y, o.r * 0.5, "#c8a0ff", 300); f.sparkle(x, y, 0.3, "#8a5ad8", 4); Sound.play("gravity_tick"); break;
    case "phantom": {
      const pr = S3.props.get("pr" + id);
      if (pr) { pr.tx = x; pr.ty = y; pr.bite = now() + 220; }
      const m = G.mobs.get(extra);
      if (m) { f.slash(m.x, m.y, Math.atan2(m.y - y, m.x - x), "#8a5ad8", 0.9); f.slash(m.x, m.y, Math.atan2(m.y - y, m.x - x) + 0.6, "#ff5a8a", 0.7, true); }
      Sound.play("phantom_bite");
      break;
    }
    case "pillar": {
      const last = extra === 1;
      B.fx.zap(x + rand(-10, 10), y + rand(-6, 6), "#bfe8ff", 260);
      if (last) { B.fx.zap(x, y, "#ffffff", 360); B.fx.ring(x, y, o.r, "#9fdcff", 360, true); f.crack(x, y, o.r * 0.6, "#bfe8ff", 600); B.shake(9); Sound.play("dragon_final"); }
      else Sound.play("bolt");
      break;
    }
    case "meteor": {
      // a stone out of the sky, then the crater
      f.fall(x, y, "#ff8a3a", 300);
      setTimeout(() => { B.fx.ring(x, y, 30, "#ff8a3a", 300, true); f.crack(x, y, 22, "#ff7a3a", 600); f.burst(x, y, 0.3, "#ffd84a", 22, 3); B.shake(6); Sound.play("meteor_hit"); }, 300);
      break;
    }
    case "storm": B.fx.zap(x + rand(-o.r, o.r) * 0.7, y + rand(-o.r, o.r) * 0.5, "#bfe8ff", 220); break;
    case "rune": {
      // the beat's element floods the circle (the flat drawing reads o.el), and shows in the air over it
      const el = extra >= 1 && extra <= 3 ? extra : 1, col = ELEM_COL[el];
      o.el = el; o.beatNew = true;
      S3.fx.wave(x, y, o.r, col, 340); S3.fx.wave(x, y, o.r * 0.6, "#ffffff", 260, 40);
      if (el === 1) { for (let i = 0; i < 5; i++) { const a = rand(0, 6.28), d = rand(0.2, 0.8) * o.r; f.burst(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 0.1, i % 2 ? "#ffd84a" : "#ff8a3a", 4, 1.6); } Sound.play("ember"); }
      else if (el === 2) { for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), d = rand(0.2, 0.85) * o.r; f.sparkle(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 0.2, i % 2 ? "#e8f8ff" : "#9fe8ff", 3); } Sound.play("frost"); }
      else { for (let i = 0; i < 2; i++) { const a = rand(0, 6.28), d = rand(0.25, 0.75) * o.r; S3.fx.zap(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, "#fff27a", 200, i * 70); } Sound.play("bolt"); }
      break;
    }
    case "burst": {
      B.fx.ring(x, y, o.r, "#c8324a", 380, true);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; f.burst(x + Math.cos(a) * o.r * 0.5, y + Math.sin(a) * o.r * 0.5, 0.3, "#c8324a", 6, 2.4); }
      B.shake(9); Sound.play("blood_burst");
      break;
    }
  }
}
function propEnd(G, B, f, e) {
  const [, id, how, mid] = e, o = placed.get(id);
  placed.delete(id);
  S3.props.delete("pr" + id);
  follow.delete(id);
  if (!o) return;
  if (o.kind === "trap" && how === 1) {
    // sprung: a shadow of the tracker bursts out of the ground at it — three stabs and two shots
    const m = G.mobs.get(mid), tx = m ? m.x : o.x, ty = m ? m.y : o.y;
    f.burst(o.x, o.y, 0.2, "#3a2a58", 26, 2.2);
    for (let i = 0; i < 3; i++) setTimeout(() => f.slash(tx, ty, rand(0, 6.28), "#c890ff", 0.9, i % 2 === 1), i * 90);
    for (let i = 0; i < 2; i++) setTimeout(() => { S3.fx.arrowHit(tx, ty, rand(0, 6.28), "#ffffff", true); }, 280 + i * 90);
    B.shake(4); Sound.play("decoy_pop");
  }
}

// ───────────────────────────── per-frame signs ─────────────────────────────

const ELEM_COL = [null, "#ff8a3a", "#9fe8ff", "#ffe86a"];
function overlay(g, t) {
  const G = live.G;
  if (!G) return;
  for (const m of G.mobs.values()) {
    const [mx, my] = at(m.x, m.y), top = my - (m.h3 || 1.3) * 26 - 4;
    // a dagger's marks over each monster: little violet diamonds, one per stack
    if (m.mk) {
      const n = m.mk, w = n * 5 - 1, x0 = Math.round(mx - w / 2), y0 = Math.round(top - 4);
      const hot = n >= 5 && Math.sin(t / 90) > 0;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * 5;
        px(g, x + 1, y0, 2, 1, INK); px(g, x, y0 + 1, 4, 2, INK); px(g, x + 1, y0 + 3, 2, 1, INK);
        px(g, x + 1, y0 + 1, 2, 2, hot ? "#ffd0ff" : "#c070ff");
      }
    }
    // a book's brand: a small burning sigil beside its head
    if (m.br) {
      const x = Math.round(mx - 14), y = Math.round(top + 1), f = Math.sin(t / 120) > 0;
      px(g, x - 1, y - 1, 7, 9, INK); px(g, x, y, 5, 7, "#3a2a58"); px(g, x + 1, y + 1, 3, 1, "#c8a0ff"); px(g, x + 2, y + 2, 1, 3, f ? "#ff6a8a" : "#c8a0ff"); px(g, x + 1, y + 5, 3, 1, "#c8a0ff");
    }
    const s = signs.get(m.id);
    if (!s) continue;
    if (s.fz > t) {
      const w = 22, h = Math.max(18, (m.h3 || 1.3) * 22);
      g.globalAlpha = 0.38; g.fillStyle = "#bfe8ff"; g.fillRect(Math.round(mx - w / 2), Math.round(my - h), w, h);
      g.globalAlpha = 0.9; g.strokeStyle = "#e8f8ff"; g.lineWidth = 1; g.strokeRect(Math.round(mx - w / 2) + 0.5, Math.round(my - h) + 0.5, w - 1, h - 1);
      g.globalAlpha = 1; px(g, mx - w / 2 + 3, my - h + 3, 2, 5, "#ffffff");
    }
    if (s.vu > t && Math.sin(t / 110) > -0.4) {
      // a cracked shield: armour that will not hold
      const x = Math.round(mx + 10), y = Math.round(top + 2);
      px(g, x - 1, y - 1, 7, 8, INK); px(g, x, y, 5, 5, "#8ad8ff"); px(g, x + 1, y + 5, 3, 1, "#8ad8ff"); px(g, x + 2, y, 1, 3, INK); px(g, x + 1, y + 3, 1, 2, INK);
    }
  }
  for (const [id, s] of signs) if (!(s.fz > t || s.vu > t)) signs.delete(id);
  // blood sanctuaries round their knights
  for (const [id, o] of follow) {
    if (t > o.until) { follow.delete(id); continue; }
    const e = o.eid === G.you ? G.me : G.players.get(o.eid);
    if (!e) continue;
    const [x, y] = at(e.x, e.y), a = Math.min(1, (t - o.t0) / 200, (o.until - t) / 200), rx = o.r * Math.SQRT2, ry = o.r / Math.SQRT2;
    g.globalAlpha = 0.14 * a; g.fillStyle = "#c8324a"; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
    g.globalAlpha = 0.7 * a; g.strokeStyle = "#ff6a8a"; g.lineWidth = 2; g.setLineDash([6, 6]); g.lineDashOffset = -t / 40;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.stroke(); g.setLineDash([]);
    for (let i = 0; i < 6; i++) { const ph = ((t / 900 + i / 6) % 1), ang = i * 1.05; g.globalAlpha = a * (1 - ph); px(g, x + Math.cos(ang) * rx * 0.8, y + Math.sin(ang) * ry * 0.8 - ph * 22, 2, 3, "#ff3a5a"); }
    g.globalAlpha = 1;
  }
  // players at work: untouchable in the air, a staff's full resonance, the element a staff holds
  const people = [[G.me, true]];
  for (const p of G.players.values()) people.push([p, false]);
  for (const [p, me] of people) {
    const fl = p.fl | 0, [x, y] = at(p.x, p.y);
    if (fl & 4) { g.globalAlpha = 0.5 + 0.3 * Math.sin(t / 50); g.strokeStyle = "#e8e0ff"; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y - 12, 12, 16, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
    if (fl & 32) for (let i = 1; i <= 3; i++) { const a = t / 260 + i * 2.094; orb(g, x + Math.cos(a) * 14, y - 14 + Math.sin(a) * 6, i, t); }
    // the element held (only one's own is sent): live number = resonance + 4 × element
    const e = me && G.self && G.self.cr && G.self.cr.k === "reso" ? (G.me.cv | 0) >> 2 : 0;
    if (me && e && !(fl & 32)) orb(g, x, y - 38 + Math.sin(t / 200) * 2, e, t);
  }
}
/** A little pixel orb of an element: 1 fire, 2 ice, 3 lightning. */
function orb(g, x, y, e, t) {
  x = Math.round(x); y = Math.round(y);
  const c = ELEM_COL[e];
  px(g, x - 2, y - 3, 5, 7, INK); px(g, x - 3, y - 2, 7, 5, INK);
  px(g, x - 2, y - 2, 5, 5, c); px(g, x - 1, y - 3, 3, 1, c); px(g, x - 1, y + 3, 3, 1, c);
  px(g, x - 1, y - 1, 2, 2, "#ffffff");
  if (e === 1 && Math.sin(t / 70) > 0) px(g, x, y - 5, 1, 2, "#ffd84a");
  if (e === 3 && Math.sin(t / 50) > 0.3) { px(g, x + 3, y - 4, 1, 2, "#fff6b0"); px(g, x - 4, y + 2, 1, 2, "#fff6b0"); }
}

// ───────────────────────────── events ─────────────────────────────

const REACT_NAME = [null, ["증기 폭발!", "#ffffff"], ["초전도!", "#b8a0ff"], ["과부하!", "#ffb04a"]];
/** Passive flashes: no swing of the weapon, only a sign where it happened. */
const PASSIVE = new Set([110, 111, 113, 114, 115]);

/** Dust and a stepped crack on the ground mark the server's exact circle. */
export function hammerImpact(x, y, r, hit, crit, kind) {
  const final = kind === 132;
  const f = S3.fx, col = crit ? "#ffdc75" : final ? "#f3a567" : hit ? "#e4be83" : "#a98c6d";
  const [cx, cy] = at(x, y);
  f.wave(x, y, r, col, final ? 310 : 220);
  if (kind === 7) rim(x, y, r, "#8d7159", col, 160, 0.1);
  f.burst(x, y, 0.08, col, final ? 19 : hit ? 10 : 5, final ? 2.1 : 1.2);
  if (!hit) return;
  if (kind !== 7) {
    rim(x, y, r, "#a96945", "#ffe7a5", final ? 350 : 240);
    shards(x, y, r, final ? 10 : 6, final ? 29 : 13, "#ae623d", col, final ? 380 : 248, 22);
  }
  if (crit || kind !== 7) f.spark(x, y, col, final ? 1.65 : 0.95);
  // Draw native pixels on the projected plane so the branches fade without a blurred edge.
  const arms = final ? 8 : 5, shift = ((Math.round(x) + Math.round(y)) % 7) * Math.PI / 7;
  S3.fxCustom((g, k) => {
    if (k < 0.055) {
      for (let row = -2; row <= 2; row++) {
        const w = (final ? 6 : 4) - Math.abs(row);
        px(g, cx - w, cy + row, 1 + w * 2, 1, "#fff4ce");
      }
    }
    const extent = r * Math.min(0.9, 0.2 + 6 * k);
    for (let i = 0; i < arms; i++) {
      const ang = shift + (i / arms) * Math.PI * 2, ux = Math.cos(ang), uy = Math.sin(ang);
      for (let j = 1; j < extent * (i % 2 ? 0.72 : 1); j++) {
        if (k > 0.58 && ((i + j) % 3 === 0 || j / extent > (1 - k) * 2.3)) continue;
        const bend = j < 5 ? 0 : (i % 2 ? -1 : 1) * (j < 9 ? 1.2 : 0.6);
        const [sx, sy] = at(x + ux * j - uy * bend, y + uy * j + ux * bend);
        px(g, sx, sy, 2, 1, k < 0.24 ? col : "#604940");
        if (k < 0.24) px(g, sx, sy + 1, 2, 1, "#604940");
      }
    }
  }, final ? 410 : 260);
}

// ───────────────────────────── a boss's shaped telegraphs ─────────────────────────────
/** The ground a shaped telegraph covers, a path in flat world pixels: shape 0 donut (safe inside R0), 1 cone (facing A,
 *  half-angle H), 2 mark (a circle). The very shape the server tests (56-boss-script.js bsInside). */
function telePath(g, s, x, y, R, R0, A, H) {
  g.beginPath();
  if (s === 1) { g.moveTo(x, y); g.arc(x, y, R, A - H, A + H); g.closePath(); return; }
  g.arc(x, y, R, 0, 7);
  if (s === 0) { g.moveTo(x + R0, y); g.arc(x, y, R0, 0, 7, true); }
}
/** ["bt", shape, x, y, r, ms, a, b]: red ground blinking, an orange edge, the reach filling in as the moment nears (a mark
 *  rides on its hero, eid `a`, with four countdown pips; white-edged on yourself), then the blow flashes where it lands. */
function bossTele(e, entityPos, G) {
  const [, s, x0, y0, r, ms, a = 0, b = 0] = e;
  const R = r * P, R0 = s === 0 ? a * P : 0, A = s === 1 ? a / 1000 : 0, H = b / 1000, mine = s === 2 && a === G.you;
  const where = () => { const o = s === 2 && entityPos(a); return o ? [o.x * P, o.y * P] : [x0 * P, y0 * P]; };
  Sound.play("warn");
  S3.fx.add({ k: "custom", flat: true, dur: ms, draw: (g, k) => {
    const [x, y] = where();
    g.fillStyle = "#ff2a1a"; g.globalAlpha = Math.floor(now() / 140) % 2 ? 0.38 : 0.26;
    telePath(g, s, x, y, R, R0, A, H); g.fill("evenodd");
    g.globalAlpha = 0.5; telePath(g, s, x, y, R0 + (R - R0) * k, R0, A, H); g.fill("evenodd");
    g.globalAlpha = 0.95; g.strokeStyle = mine ? "#ffffff" : "#ffb04a"; g.lineWidth = 3;
    telePath(g, s, x, y, R, R0, A, H); g.stroke();
    if (s === 2) for (let i = 0; i < Math.ceil((1 - k) * 4); i++) { const t = (i * Math.PI) / 2, u = x + Math.cos(t) * R, v = y + Math.sin(t) * R; px(g, u - 7, v - 7, 14, 14, INK); px(g, u - 5, v - 5, 10, 10, "#ffe08a"); }
  }, done: () => {
    const [x, y] = where();
    S3.fx.add({ k: "custom", flat: true, dur: 240, draw: (g, k) => { g.globalAlpha = 0.7 * (1 - k); g.fillStyle = "#ffe08a"; telePath(g, s, x, y, R, R0, A, H); g.fill("evenodd"); } });
    S3.shake(4); Sound.play("slam");
  } });
}

export function skillEvent(e, ctx) {
  const { G, entityPos } = ctx;
  // the skills' effects go through the scaled-up set (scene2d big): denser, bigger, a core flash, shockwaves
  const B = S3.big(), f = B.fx, t = ctx.t;
  live.G = G;
  switch (e[0]) {
    case "hm": {
      const [, eid, x, y, r, hit, crit, kind] = e;
      hammerImpact(x, y, r, hit, crit, kind);
      if (eid === G.you || Math.hypot(x - G.me.x, y - G.me.y) < 180) Sound.play("hammer_land", { hit, crit, final: kind === 132 });
      if (eid === G.you && hit && kind === 132) S3.shake(4.5);
      return true;
    }
    case "a": {
      const kind = e[2];
      if (kind < 70) return false;
      const [, eid, , tx, ty] = e;
      const src = entityPos(eid);
      if (!src) return true;
      if (kind === 133 || kind === 134) {
        const ward = kind === 134, color = ward ? "#ffe3a0" : "#9ce6d8", y = ty + 6;
        const radius = e[7] || (ward ? 34 : 23), flat = S3.fx;
        src.atkT = t; src.atkN = 0;
        flat.wave(tx, y, radius, color, 320);
        flat.flash(tx, y, 8, 0, 0.15);
        if (ward) {
          oathSeal(tx, y, G.defs?.skills?.oathward?.healR || 70);
          Sound.play("sanctuary");
        } else {
          rim(tx, y, radius, "#46948d", color, 275);
          shards(tx, y, radius, 7, 20, "#458878", color, 295, 16);
          if (eid === G.you) S3.shake(4);
          Sound.play("hammer_land", { hit: 1, final: true });
        }
        return true;
      }
      if (PASSIVE.has(kind)) { passive(kind, src, eid, tx, ty + 6, G); return true; }
      if (eid !== G.you) { src.atkT = t; src.dir = e[5]; src.atkN = 2; }
      else { G.me.dir = e[5]; G.me.atkN = 2; }
      src.aim = [tx, ty + 6];
      G.hitFrom = [src.x, src.y];
      cast(kind, src, eid, tx, ty + 6, e[7], G);
      return true;
    }
    case "b": {
      if ((e[4] | 0) === 10) { f.burst(e[1] + (Math.random() - 0.5) * e[3], e[2], 0.1, "#ff8a3a", 5, 0.8); f.sparkle(e[1], e[2], 0.1, "#ffd84a", 4); f.ring(e[1], e[2], e[3], "rgba(255,120,40,.6)", 260, true); return true; }
      return false;
    }
    // ── the bow's arrows (docs/design/jobs-and-stats.md D.2): fired ["ar", id, x0, y0, ux·1000, uy·1000,
    // spd, kind, shooter?] — kind 0 a plain shot, 1 the finisher (pierces one), 2 관통 화살, 3 도약 사격's fan;
    // the optional 9th field names the shooter, else it is the bow drawn nearest the arrow's start —
    // and ended ["ae", id, x, y, how] (0 struck or ran out, 1 stuck in a wall, 2 ran out of range)
    case "ar": {
      const [, id, x0, y0, ux, uy, spd, kind, pid] = e, n = Math.hypot(ux, uy) || 1;
      // a staff's missile or a book's orb (kinds 8, 9; the 10th field the monster it homes on): no bow drawn for it
      if (MISSILE_LOOK[kind]) { missile(G, id, x0, y0, ux / n, uy / n, spd, kind, e[9]); return true; }
      let sh = null, best = 40;
      for (const s of bowShots) {
        if (t - s.t > 700 || (pid !== undefined && s.eid !== pid)) continue;
        const d = Math.hypot(s.x - x0, s.y - y0);
        if (d < best) { best = d; sh = s; }
      }
      // (a volley shares one draw of the string)
      const kd = kind | 0, look = ARROW_LOOK[kd];
      if (sh && kd !== 3 && !look) bowShots.splice(bowShots.indexOf(sh), 1);
      const range = ARROW_RANGE[kd] || (G.defs && G.defs.wkinds && G.defs.wkinds.bow && G.defs.wkinds.bow.range) || 150;
      arrowFrom.set(id, [x0, y0, range, kd]);
      if (arrowFrom.size > 64) arrowFrom.delete(arrowFrom.keys().next().value);
      const delay = sh ? Math.max(0, sh.at - t) : 0, o = { id, spd: spd || 420, delay, tier: look ? look.tier : sh ? sh.wt : 1, pierce: kd === 1 || kd === 2 || !!look };
      // an element or ink arrow wears its dress over the white-hot arrow: queued first, so drawn after it
      const hold = {};
      if (look) S3.fxCustom((g) => dressArrow(g, hold.f, look), (range / o.spd) * 1000 + delay + 400);
      hold.f = S3.fx.arrow(x0, y0, x0 + (ux / n) * range, y0 + (uy / n) * range, o);
      return true;
    }
    case "ae": {
      const [, id, x, y, how] = e, from = arrowFrom.get(id);
      if (missiles.has(id)) { missileEnd(f, id, x, y, how, e[5] | 0); return true; }
      arrowFrom.delete(id);
      // struck nothing and simply ran its whole range: it drops out of sight, no spark
      const spent = how === 2 || (!how && from && Math.hypot(x - from[0], y - from[1]) >= from[2] - 6);
      S3.fx.arrowEnd(id, x, y, how === 1 ? "stuck" : spent ? "fade" : "hit");
      if (how === 1) Sound.play("arrow_wall"); else if (!spent) Sound.play("arrow_hit");
      // an element or ink arrow leaves a puff of what it carried where it stops
      const look = from && ARROW_LOOK[from[3]];
      if (look && !spent) { S3.fx.burst(x, y, 0.4, look.tail[1], 6, 1.4); S3.fx.ring(x, y, 9, look.tail[2], 220); }
      return true;
    }
    case "pr": { const [, id, kind, x, y, r, ms, eid] = e; placeProp(G, B, f, id, kind, x, y, r, ms, eid); return true; }
    case "pp": propBeat(G, B, f, e); return true;
    case "pe": propEnd(G, B, f, e); return true;
    case "bw": {
      const [, x, y, r, kind] = e;
      // 검기 화살's crescent bursts when its arrow gets there, not when the string lets go
      if (kind === 2 && now() - qi.at < 80) { const ms = qi.ms; qi.at = 0; later(ms, () => skillEvent(e, ctx)); return true; }
      if (kind === 2) { f.ring(x, y, r, "#ff8a3a", 420, true); f.ring(x, y, r * 0.7, "#ffffff", 300); f.crack(x, y, r * 0.6, "#ff7a3a", 650); f.burst(x, y, 0.3, "#ffb04a", 20 + r / 2, 3.4); B.shake(Math.min(14, 4 + r / 8)); }
      else if (kind === 9) { f.crack(x, y, r * 0.6, "#c8a0ff", 700); f.ring(x, y, r, "#ffffff", 320, true); f.burst(x, y, 0.1, "#8a5ad8", 34, 3); B.shake(10); Sound.play("slam"); }
      else if (kind === 15) { f.ring(x, y, r, "#8a5ad8", 420, true); f.ring(x, y, r * 0.6, "#ff5a8a", 340); f.burst(x, y, 0.4, "#3a2a58", 40, 3.2); f.sparkle(x, y, 0.6, "#c8a0ff", 20); B.shake(8); Sound.play("pact_end"); }
      return true;
    }
    case "rx": {
      const [, id, x, y, r] = e;
      if (id === 1) { f.ring(x, y, r, "#ffffff", 420, true); for (let i = 0; i < 18; i++) f.sparkle(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r * 0.6, 0.2, "#eef4ff", 2); f.burst(x, y, 0.3, "#d8e8f0", 30, 2.4); B.shake(5); Sound.play("steam"); }
      else if (id === 2) { f.ring(x, y, r, "#b8a0ff", 360, true); f.ring(x, y, r * 0.6, "#9fe8ff", 300); for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; f.bolt(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, "#c8b0ff", 260); } Sound.play("supercon"); }
      else { f.ring(x, y, r, "#ffb04a", 340, true); f.ring(x, y, r * 1.2, "#ffe86a", 300); f.crack(x, y, r * 0.7, "#ffb04a", 500); f.burst(x, y, 0.4, "#ffd84a", 30, 3.6); B.shake(8); Sound.play("overload"); }
      const [s, c] = REACT_NAME[id];
      text(G, s, x, y, 1.6, c, true);
      return true;
    }
    case "dc": lure(e[1], e[2], e[3], e[4], e[5]); f.burst(e[3], e[4], 0.6, "#3a2a58", 30, 1.4); return true;
    case "bt": bossTele(e, entityPos, G); return true;
    case "bc": {
      // a scripted boss's turn (56-boss-script.js): 8 its marked cast broken, 7 the cast (or the hard enrage) went off
      const m = entityPos(e[1]);
      if (m && e[2] === 8) { f.burst(m.x, m.y, 0.8, "#ffe08a", 30, 2.6); B.shake(6); Sound.play("slam"); }
      else if (m && e[2] === 7) { f.ring(m.x, m.y, 90, "#ff3a2a", 420, true); B.shake(8); Sound.play("boom"); }
      else if (m && e[2] === 6) f.burst(m.x, m.y, 0.6, "#ff4fd8", 18, 2);   // an add flew into it and healed it
      return true;
    }
    case "dx": S3.props.delete("dc" + e[1]); f.ring(e[2], e[3], e[4], "#8a5ad8", 320, true); f.burst(e[2], e[3], 0.6, "#c890ff", 30, 3); B.shake(4); Sound.play("decoy_pop"); return true;
    case "fz": { sign(e[1], "fz", t + e[2]); const m = G.mobs.get(e[1]); if (m) { text(G, "빙결", m.x, m.y, (m.h3 || 1.3) + 0.4, "#bfe8ff"); f.sparkle(m.x, m.y, 0.6, "#e8f8ff", 10); } return true; }
    case "vu": sign(e[1], "vu", t + e[2]); return true;
    case "tip": {
      const m = G.mobs.get(e[1]);
      if (m) { text(G, "창끝!", m.x + 6, m.y, (m.h3 || 1.3) + 0.55, "#c8fff0"); f.spark(m.x, m.y, "#c8fff0", 1.2); }
      Sound.play("tip");
      return true;
    }
    case "ln": {
      const [, kind, ax, ay, bx, by] = e;
      lastLn = { kind, ax, ay, bx, by, at: now() };
      if (kind === 2) {
        // the thunder javelin: a bolt of a spear down the line
        S3.fx.proj(ax, ay, 0.7, bx, by, 0.5, "#fff6b0", 0.07, 70);
        f.beam(ax, ay, bx, by, "#bfe8ff", 0.6); f.bolt(ax, ay, bx, by, "#fff27a", 240);
      } else if (kind === 3) {
        // the comet's dash: a streak and the dust it kicks up
        f.beam(ax, ay, bx, by, "#ffffff", 0.6); f.beam(ax, ay + 3, bx, by + 3, "#5ad0b8", 0.5);
        for (const [x, y] of along(ax, ay, bx, by, 22)) f.sparkle(x, y, 0.4, "#c8fff0", 3);
        f.burst(ax, ay, 0.1, "#b8a878", 10, 1.6);
      } else if (kind === 4) { f.bolt(ax, ay + 8, bx, by + 8, "#fff27a", 260); f.spark(bx, by + 6, "#fff6b0", 1.3); Sound.play("bolt"); }
      else if (kind === 5) { f.beam(ax, ay - 8, bx, by - 8, "#7a4ac8", 0.5); f.burst(ax, ay, 0.6, "#3a2a58", 8, 1.2); Sound.play("dance"); }
      else if (kind === 6) { f.beam(ax, ay - 8, bx, by - 8, "#a070e0", 0.5); f.burst(ax, ay, 0.6, "#3a2a58", 14, 1.4); f.burst(bx, by, 0.6, "#6a4a9a", 12, 1.4); }
      else if (kind === 7) {
        // a shadow blade spinning down its line; 원소 비수's three (fx 124 just before them) come in fire, ice, lightning
        const el = fan.n > 0 && now() - fan.at < 80 ? 4 - fan.n-- : 0, col = el ? ELEM_COL[el] : "#c8a0ff";
        const far = Math.hypot(bx - ax, by - ay), ms = Math.max(120, far * 2.4);
        S3.fxCustom((g, k) => {
          const [x, y] = at(ax + (bx - ax) * k, ay + (by - ay) * k, 10);
          const a = k * 18;
          g.translate(Math.round(x), Math.round(y)); g.rotate(a);
          px(g, -5, -1, 10, 3, INK); px(g, -4, 0, 8, 1, col); px(g, 3, -1, 2, 1, "#ffffff");
        }, ms);
        if (el) {
          // each leaves its element along the way and a puff of it at the end
          f.beam(ax, ay, bx, by, col, 0.45);
          along(ax, ay, bx, by, 26).forEach(([x, y], i, all) => later((i / all.length) * ms, () => S3.fx.sparkle(x, y, 0.4, col, 2)));
          later(ms, () => { S3.fx.ring(bx, by, 10, col, 240); S3.fx.burst(bx, by, 0.4, col, 6, 1.6); });
        } else f.beam(ax, ay, bx, by, "rgba(160,112,224,.5)", 0.45);
      } else if (kind === 8) { f.beam(ax, ay - 4, bx, by - 4, "#d8c8a0", 0.3); f.burst(ax, ay, 0.1, "#b8a878", 12, 1.6); }
      else if (kind === 9) {
        // up and over: a dotted arc and the dust where they left
        S3.fxCustom((g, k) => {
          for (let i = 0; i <= 12; i++) {
            const u = i / 12;
            if (u > k * 1.6) break;
            const [x, y] = at(ax + (bx - ax) * u, ay + (by - ay) * u, 10 + Math.sin(u * Math.PI) * 36);
            g.globalAlpha = 1 - k; px(g, x - 1, y - 1, 2, 2, "#f0e8d0");
          }
        }, 420);
        f.burst(ax, ay, 0.1, "#b8a878", 8, 1.4);
      }
      return true;
    }
    case "ds": {
      // the dash (59-dash.js, Space): ghosts of the body left down the run, wind streaks, dust kicked up at both
      // ends; the hero itself is put at the far end by the snapshot's position fix (never predicted here)
      const [, eid, x0, y0, x1, y1] = e, mine = eid === G.you;
      if (!mine && dist2(G.me, x1, y1) > 360 * 360) return true;
      const [sx0, sy0] = at(x0, y0), [sx1, sy1] = at(x1, y1), sl = Math.hypot(sx1 - sx0, sy1 - sy0) || 1, ux = (sx1 - sx0) / sl, uy = (sy1 - sy0) / sl;
      S3.fxCustom((g, k) => {
        for (let i = 1; i <= 3; i++) {
          const q = i / 4, gx = sx0 + (sx1 - sx0) * q, gy = sy0 + (sy1 - sy0) * q;
          g.globalAlpha = Math.max(0, (0.2 + q * 0.35) * (1 - k * (1.6 - q)));
          px(g, gx - 4, gy - 13, 8, 12, INK); px(g, gx - 3, gy - 12, 6, 10, "#9ad0ff"); px(g, gx - 3, gy - 12, 6, 2, "#e8f6ff");
        }
        g.globalAlpha = Math.max(0, 1 - k * 1.5);
        const L = Math.min(sl, 34) * (1 - k * 0.6);
        for (const o of [-5, 0, 5]) for (let q = 0; q < L; q++) if (q % 7 < 4) px(g, sx1 - ux * (q + 7) - uy * o, sy1 - 6 - uy * (q + 7) + ux * o * 0.5, 1, 1, o ? "#9ad0ff" : "#ffffff");
        g.globalAlpha = 1;
      }, 340);
      f.burst(x0, y0, 0, "#c8b898", 7, 0.8); f.burst(x1, y1, 0, "#c8b898", 4, 0.6);
      Sound.play("dash");
      return true;
    }
    case "dg": {
      // a monster's blow slipped mid-dash
      const src = entityPos(e[1]);
      if (src) text(G, "회피!", src.x, src.y, 2, "#9ad0ff", e[1] === G.you);
      if (e[1] === G.you) Sound.play("dodge");
      return true;
    }
  }
  return false;
}
const dist2 = (a, x, y) => (a.x - x) ** 2 + (a.y - y) ** 2;

// ── the bow's shot: client.js attackFx calls bowFire for fx code 6 (the "a" event of a bow's basic
// attack); the bow skills call it too. The arrow itself comes on its own ("ar", above): it is held on
// the string until the stroke's release (swing.js IMPACT) and still lands on time.
/** The last "ln" seen (a charge's or a run's line: the skill event that follows it reads where it began). */
let lastLn = null;
const lineOf = (kind) => (lastLn && lastLn.kind === kind && now() - lastLn.at < 80 ? lastLn : null);
/** 검기 화살 (fx 122) just loosed: when, and how long its arrow flies (the "bw" that follows waits that long). */
const qi = { at: 0, ms: 0 };
/** 원소 비수 (fx 124) just thrown: how many of its three "ln 7" blades are still to come, and when it was. */
const fan = { n: 0, at: 0 };
/** How far each special arrow flies (the server's `len`): 관통 화살, 삼원소 화살's three, 룬 먹화살. */
const ARROW_RANGE = { 2: 180, 4: 190, 5: 190, 6: 190, 7: 170 };
/**
 * The dressed arrows (docs/design/jobs-and-stats.md H.4): kind 4 fire, 5 ice, 6 lightning, 7 rune ink.
 * `tier` picks the ink of the white-hot arrow underneath (scene2d ARROW_HOT: 1 gold, 4 cyan, 5 violet);
 * `tail` is what streams behind it, nearest first; `shaft` repaints the arrow itself (the ink arrow is black).
 */
const ARROW_LOOK = {
  4: { tier: 1, how: "flame", tail: ["#ffffff", "#ffd84a", "#ff8a3a", "#d83a2a"] },
  5: { tier: 4, how: "frost", tail: ["#ffffff", "#e8f8ff", "#9fe8ff", "#5aa8e0"] },
  6: { tier: 1, how: "spark", tail: ["#ffffff", "#fff27a", "#ffe86a", "#c8a030"] },
  7: { tier: 5, how: "ink", tail: ["#b46aff", "#3a2a58", "#b46aff", "#1a1426"], shaft: "#1a1426" },
};
/** Draw the dress of arrow `f` (scene2d keeps where it is in `f.at`: screen x, y, angle) for this frame. */
function dressArrow(g, f, look) {
  if (!f || f.gone || !f.at) return;
  const [x, y, a] = f.at, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, n = (f.n = (f.n || 0) + 1);
  const dot = (d, o, w, c) => px(g, x - ux * d + nx * o - (w >> 1), y - uy * d + ny * o - (w >> 1), w, w, c);
  if (look.shaft) {
    // the arrow as long as scene2d drew it (shorter flying toward or away from the eye), its middle inked over
    const L = Math.max(6, Math.round(11 / Math.sqrt(2 * uy * uy + (ux * ux) / 2) / Math.SQRT2));
    for (let q = -L / 2 + 2; q <= L / 2 - 2; q++) px(g, x + ux * q, y + uy * q, 1, 1, look.shaft);
  }
  const T = look.tail;
  if (look.how === "flame") {
    // a tongue of fire licking back off the head, flickering, embers lifting off it as it cools
    for (let i = 0; i < 7; i++) {
      const d = 4 + i * 2.2;
      dot(d, ((n + i * 5) % 3) - 1, i < 2 ? 2 : 1, T[Math.min(3, (i + 1) >> 1)]);
      if (i > 3 && (n + i) % 2) px(g, x - ux * d, y - uy * d - 2 - (i - 3), 1, 1, T[2]);
    }
  } else if (look.how === "frost") {
    // a wake of ice crystals either side, and a hard glint on the head
    for (let i = 0; i < 6; i++) dot(4 + i * 3, i % 2 ? 2 : -2, 1, T[1 + Math.min(2, i >> 1)]);
    for (const [d, o] of [[-5, 1], [-5, -1], [-6, 0], [-4, 0]]) dot(d, o, 1, T[(n >> 1) % 2]);
  } else if (look.how === "spark") {
    // a jagged thread of lightning trailing it, re-forked every frame
    let o = 0;
    for (let i = 0; i < 9; i++) { o = Math.max(-2, Math.min(2, o + ((n * 7 + i * 13) % 5) - 2)); dot(3 + i * 2, o, 1, T[i < 3 ? 0 : 1 + (i % 2)]); }
    if (n % 3 === 0) dot(8, o > 0 ? -4 : 4, 1, T[1]);
  } else {
    // drops of ink shed behind, violet rune pixels riding between them
    for (let i = 0; i < 6; i++) dot(5 + i * 3, i % 2 ? 1 : -1, i < 3 ? 2 : 1, i % 2 ? T[0] : T[3]);
    dot(-3 - (n % 2), 0, 1, T[0]);
  }
}
/**
 * The basic attacks' magic missiles (45-jobs.js magicShot): kind 8 the staff's violet bolt with a short
 * sparkling tail, 9 the book's bigger lilac orb. `r` the glow's half-size in px, `hot` its core,
 * `glow` the body, `rim` the dark edge that keeps it readable on bright ground, `tail` nearest first.
 */
const MISSILE_LOOK = {
  8: { r: 4, hot: "#ffffff", glow: "#c8a8ff", rim: "#5a3aa8", tail: ["#e8dcff", "#b08aff", "#8a5ad8", "#5a3aa8"] },
  9: { r: 6, hot: "#ffffff", glow: "#e0c8ff", rim: "#7a4ac8", tail: ["#e0c8ff", "#c8a0ff", "#a07ae0"] },
};
/** A pixel disc (rows of fillRect, no anti-aliasing) of radius r centred on (x, y). */
function disc(g, x, y, r, c) {
  g.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r + r - dy * dy)); g.fillRect(Math.round(x) - hw, Math.round(y) + dy, hw * 2 + 1, 1); }
}
/** One missile frame: the tail's sparks and motes, then the head (stepped halo, dark rim, body, white-hot core). */
function drawMissile(g, m, L) {
  const T = L.tail, n = m.n, r = L.r, nine = m.kind === 9;
  for (let i = 1; i < m.trail.length; i++) {
    const [tx, ty] = m.trail[i], j = ((n + i * 3) % 3) - 1, c = T[Math.min(T.length - 1, i >> 1)];
    px(g, tx + j * 2, ty - j, 2, 2, c);
    if (i < (nine ? 7 : 6)) px(g, tx - 1, ty - 1, 3, 3, c);
  }
  // loose motes drifting off the path
  for (let k = 0; k < 3; k++) { const i = 3 + k * 3; if (i >= m.trail.length) break; const [tx, ty] = m.trail[i], s = (n + k * 5) % 6 - 3; px(g, tx + s * 2, ty + (k % 2 ? 4 : -4) + s, 1, 1, "#ffffff"); }
  const [x, y] = m.trail[0], pulse = n % 4 < 2 ? 0 : 1;
  g.globalAlpha = 0.22; disc(g, x, y, r + 3, L.glow);
  g.globalAlpha = 0.45; disc(g, x, y, r + 1 + pulse, L.glow);
  g.globalAlpha = 1;
  disc(g, x, y, r, L.rim); disc(g, x, y, r - 1, L.glow); disc(g, x, y, Math.max(1, r >> 1), L.tail[0]); disc(g, x, y, Math.max(1, (r >> 2) + pulse), L.hot);
}
/** Missiles in flight: id → { x, y, ux, uy, spd, kind, home, trail, end }. */
const missiles = new Map();
/**
 * A magic missile cast at (x0, y0): flies at `spd`, steering at monster `home` (where it is drawn now)
 * while there is one, until the server's "ae" says where it ended (or it gives up after a while).
 * It is drawn again over the night grade (S3.glows) so the dark never swallows it.
 */
export function missile(G, id, x0, y0, ux, uy, spd, kind, home) {
  const L = MISSILE_LOOK[kind], m = { x: x0, y: y0, ux, uy, spd: spd || 300, kind, home, trail: [], end: false, t: 0, n: 0 };
  missiles.set(id, m);
  if (missiles.size > 48) missiles.delete(missiles.keys().next().value);
  const dur = 1600, lit = (g) => { if (m.trail.length) { g.globalCompositeOperation = "screen"; drawMissile(g, m, L); g.globalCompositeOperation = "source-over"; drawMissile(g, m, L); } };
  S3.glows.add(lit);
  S3.fx.spark(x0, y0, "#ffffff", kind === 9 ? 1 : 0.8); S3.fx.ring(x0, y0, kind === 9 ? 12 : 9, L.glow, 160);   // launch flash
  S3.fxCustom((g, k) => {
    if (m.end || k >= 0.99) { S3.glows.delete(lit); if (m.end) return; }
    const t = k * dur, dt = Math.min(60, t - m.t) / 1000;
    m.t = t; m.n++;
    const o = m.home && G.mobs.get(m.home);
    let step = m.spd * dt;
    if (o) {
      const dx = o.x - m.x, dy = o.y - 6 - m.y, d = Math.hypot(dx, dy) || 1;
      m.ux = dx / d; m.uy = dy / d; step = Math.min(step, d);   // (it waits on its monster for the server's word)
    }
    m.x += m.ux * step; m.y += m.uy * step;
    m.trail.unshift(at(m.x, m.y, 9));
    if (m.trail.length > 11) m.trail.pop();
    drawMissile(g, m, L);
  }, dur);
}
/** The server ended missile `id` at (x, y): 0 struck (a burst; `ring` the book's splash or a finisher's), 1 a wall, 2 spent. */
export function missileEnd(f, id, x, y, how, ring) {
  const m = missiles.get(id), L = MISSILE_LOOK[m.kind];
  missiles.delete(id);
  m.end = true;
  if (how === 2) { f.burst(x, y, 0.4, L.tail[1], 3, 0.6); return; }
  f.burst(x, y, 0.4, L.glow, m.kind === 9 ? 14 : 9, 1.8);
  f.burst(x, y, 0.4, "#ffffff", 5, 1.1);
  f.spark(x, y, "#ffffff", m.kind === 9 ? 1.4 : 1.1);
  f.ring(x, y, m.kind === 9 ? 16 : 11, L.tail[1], 240);
  // the flash itself shines over the night grade for a moment: stepped discs shrinking away
  const t0 = now(), [hx, hy] = at(x, y, 9), R = m.kind === 9 ? 12 : 9;
  const flash = (g) => {
    const k = (now() - t0) / 260;
    if (k >= 1) { S3.glows.delete(flash); return; }
    const r = Math.round(R * (1 - k * 0.5));
    g.globalCompositeOperation = "screen"; g.globalAlpha = 0.5; disc(g, hx, hy, r + 3, L.glow);
    g.globalAlpha = 0.9; disc(g, hx, hy, r, L.glow); g.globalAlpha = 1; disc(g, hx, hy, r >> 1, "#ffffff");
    g.globalCompositeOperation = "source-over";
  };
  S3.glows.add(flash);
  if (ring) { f.ring(x, y, ring, "#ffffff", 260, true); f.ring(x, y, ring * 0.7, "#c8a0ff", 300, true, 40); }
  Sound.play("magic_hit", m.kind === 9 || ring > 0);
}
/** Bows drawn in the last moments, waiting for their arrows: { eid, x, y, t, at (release time), wt (tier) }. */
const bowShots = [];
/** Where each arrow in flight started, and its range: id → [x0, y0, range]. */
const arrowFrom = new Map();
/**
 * A bow drawn (fx code 6): remember the shooter for the arrow that follows, creak the bow now and
 * twang it at the release. `beat` 2 is the finisher; `up` the skyward skill shot (src.bowUp, the pose).
 */
export function bowFire(G, src, beat = 0, up = false) {
  const t = now(), eid = src === G.me ? G.you : src.id, w = G.who && G.who.get(eid);
  const left = Math.max(0, (src.atkT ?? t) + S3.impactMs("bow", beat) - t);
  src.bowUp = !!up;
  bowShots.push({ eid, x: src.x, y: src.y, t, at: t + left, wt: (w && w.gear && w.gear.wt) || 1 });
  if (bowShots.length > 24) bowShots.shift();
  Sound.play("bow_draw");
  setTimeout(() => Sound.play("bow_shot", beat === 2 || up), left);
}

/** A passive showing itself where it happened: no swing, a sign and a small sound. */
function passive(kind, src, eid, tx, ty, G) {
  const f = S3.fx, mine = eid === G.you;
  switch (kind) {
    case 110: f.ring(src.x, src.y, 22, "#ffb04a", 300); f.sparkle(src.x, src.y, 0.6, "#ffd84a", 10); if (mine) { text(G, "관성 최대", src.x, src.y, 1.9, "#ffd84a"); Sound.play("inertia_full"); } break;
    case 111: f.burst(tx, ty, 0.5, "#c8324a", 10, 1.6); f.spark(tx, ty, "#ff6a8a", 0.9); if (mine) Sound.play("bleed"); break;
    case 113: f.ring(src.x, src.y, 20, "#b08aff", 360); f.sparkle(src.x, src.y, 0.8, "#e0c8ff", 14); if (mine) { text(G, "공명!", src.x, src.y, 1.9, "#e0c8ff"); Sound.play("reso_ready"); } break;
    case 114: f.spark(tx, ty, "#c8a0ff", 1); f.ring(tx, ty, 12, "#ff6a8a", 260); if (mine) Sound.play("brand"); break;
    case 115: f.spark(tx, ty, "#ffd84a", 1.1); if (mine) text(G, "원거리!", tx, ty, 1.5, "#ffd84a"); break;
  }
}

/** A skill being used: what it looks like at the caster and where it lands. */
function cast(kind, src, eid, tx, ty, extra, G) {
  const ang = Math.hypot(tx - src.x, ty - src.y) > 2 ? Math.atan2(ty - src.y, tx - src.x) : [Math.PI / 2, Math.PI, 0, -Math.PI / 2][src.dir] || 0;
  // scaled-up effects, and a shake that kicks along the skill's aim
  const B = S3.big(ang), f = B.fx, mine = eid === G.you;
  switch (kind) {
    // ── 스태프
    case 70: {
      f.proj(src.x, src.y, 1.1, tx, ty, 0.4, "#ff8a3a", 0.12, 15, () => {
        S3.fx.flash(tx, ty, 9);
        rim(tx, ty, 26, "#c55337", "#ffd58e", 305, 0.56);
        shards(tx, ty, 26, 8, 24, "#e97b32", "#ffdc7f", 330, 12);
        f.burst(tx, ty, 0.25, "#d67b49", 7, 1.2);
        B.shake(3); Sound.play("boom");
      }); Sound.play("ember"); break;
    }
    case 71: {
      const r = extra || 56;
      S3.fx.flash(src.x, src.y, 10);
      S3.fx.wave(src.x, src.y, r, "#d4f9ff", 360);
      rim(src.x, src.y, r, "#6caddd", "#d5f8ff", 415, 0.57);
      shards(src.x, src.y, r * 0.88, 12, 18, "#549acc", "#d5f8ff", 360, 30);
      B.shake(4); Sound.play("frost"); break;
    }
    case 90: f.sparkle(src.x, src.y, 1.2, "#ff8a3a", 18); f.ring(tx, ty, extra || 80, "#ff5a3a", 500); if (mine) text(G, "메테오 스톰!", src.x, src.y, 2.2, "#ffb04a", true); Sound.play("meteor_cast"); break;
    // ── 대검
    case 80: {
      // a wide crescent of steel thrown off the swing, and everything in it reels
      const r = extra || 46;
      swordCrescent(src.x, src.y, ang, r);
      shards(tx, ty, r * 0.32, 5, 12, "#739aca", "#deefff", 240, 96);
      B.shake(6); Sound.play("power_slash");
      break;
    }
    case 81: f.ring(tx, ty, extra || 38, "#e0c890", 360, true); f.crack(tx, ty, (extra || 38) * 0.7, "#ffd84a", 600); f.burst(tx, ty, 0.1, "#b8a878", 22, 2.6); B.shake(8); Sound.play("slam"); break;
    case 82: {
      // the split running on ahead: bursts of earth one after another
      along(src.x, src.y, tx, ty, 14).forEach(([x, y], i) => { f.ring(x, y, 10, "#e0c890", 220, true, i * 35); setTimeout(() => f.burst(x, y, 0.05, "#a89068", 6, 1.8), i * 35); });
      Sound.play("quake");
      break;
    }
    case 83: {
      f.storm(src.x, src.y, extra || 70, "#ffd84a", 360, 6); f.slash(src.x, src.y, ang, "#ff5a3a", 2); f.slash(src.x, src.y, ang + Math.PI, "#ff5a3a", 2, true);
      B.shake(12); Sound.play("verdict");
      if (mine) text(G, "단죄의 일격!", src.x, src.y, 2.3, "#ffb04a", true);
      break;
    }
    // ── 단검
    case 84: f.slash(tx, ty, ang, "#c890ff", 1.1); f.spark(tx, ty, "#f0d0ff", 1.3); B.shake(4); Sound.play("swap"); break;
    case 85: f.burst(src.x, src.y, 0.6, "#3a2a58", 10, 1.4); Sound.play("shade"); break;
    case 86:
      if (extra === 1) { f.slash(tx, ty, ang + 0.8, "#c070ff", 1.1); f.slash(tx, ty, ang - 0.8, "#c070ff", 1.1, true); f.spark(tx, ty, "#f0d0ff", 1.5); B.shake(3); Sound.play("crit"); }
      else { f.burst(src.x, src.y, 0.6, "#2a2040", 30, 1.8); f.storm(src.x, src.y, 24, "#a070e0", 300, 3); Sound.play("dance"); if (mine) text(G, "무영난무!", src.x, src.y, 2.2, "#d8b0ff", true); }
      break;
    // ── 창
    case 87: {
      // the twist: a white-hot line with a spiral of the spear's green wound round it
      f.beam(src.x, src.y, tx, ty, "#ffffff", 0.55);
      along(src.x, src.y, tx, ty, 10).forEach(([x, y], i) => { const a = i * 1.3, o = 3; f.sparkle(x - Math.sin(ang) * Math.cos(a) * o, y + Math.cos(ang) * Math.cos(a) * o, 0.55, i % 2 ? "#5ad0b8" : "#c8fff0", 2); });
      f.spark(tx, ty, "#c8fff0", 1.3); B.shake(5); Sound.play("spiral");
      break;
    }
    case 88: f.ring(src.x, src.y, 26, "#5ad0b8", 360, true); f.burst(src.x, src.y, 0.2, "#c8fff0", 20, 2.4); B.shake(8); Sound.play("hundred"); break;
    case 89: {
      const r = extra || 64;
      S3.fx.zap(tx, ty, "#b6e6ff", 240);
      rim(tx, ty, r, "#649add", "#d2f7ff", 500, 0.72);
      rim(tx, ty, r * 0.61, "#7063b5", "#a1bfff", 340, 0.4);
      shards(tx, ty, r * 0.7, 8, 28, "#5e77d6", "#bae8ff", 325, 27);
      B.shake(6); Sound.play("dragon"); if (mine) text(G, "뇌룡승천!", src.x, src.y, 2.2, "#bfe8ff", true); break;
    }
    // ── 마도서
    case 91: {
      // a dark bolt that takes its time (the server's queued hit lands when it arrives)
      const ms = extra || 300;
      soulTrail(src.x, src.y, tx, ty, ms);
      later(ms, () => {
        S3.fx.flash(tx, ty, 6);
        rim(tx, ty, 16, "#936bc4", "#dabaff", 260, 0.6);
        shards(tx, ty, 15, 5, 12, "#8256a9", "#dba7fa", 235);
      });
      S3.fx.sparkle(src.x, src.y, 0.8, "#ae78db", 6); Sound.play("soulbolt");
      break;
    }
    case 92: f.ring(tx, ty, extra || 60, "#8a5ad8", 420, true); f.burst(tx, ty, 0.3, "#3a2a58", 24, 2); B.shake(4); Sound.play("gravity"); break;
    case 93: f.sparkle(src.x, src.y, 1, "#8a5ad8", 20); Sound.play("pact"); if (mine) text(G, "심연의 계약", src.x, src.y, 2.2, "#c8a0ff", true); break;
    // ── 활 (the pose and the twang: bowFire; the arrows come as "ar")
    case 94: SkillFx_bow(G, src, false); f.flash(src.x, src.y, 10); Sound.play("pierce"); break;
    case 95: SkillFx_bow(G, src, false); f.burst(src.x, src.y, 0.1, "#b8a878", 14, 1.8); Sound.play("leapshot"); break;
    case 96: SkillFx_bow(G, src, true); f.sparkle(src.x, src.y, 1.4, "#fff4dc", 10); Sound.play("rain"); if (mine) text(G, "화살비!", src.x, src.y, 2.2, "#ffe9a0", true); break;
    // ── hybrid signatures
    case 97: {
      // a crescent of fire flying the length of the line
      const ax = src.x, ay = src.y;
      S3.fxCustom((g, k) => {
        const [x, y] = at(ax + (tx - ax) * k, ay + (ty - ay) * k, 12), sa = S3.sAng(Math.cos(ang), Math.sin(ang));
        for (let i = -6; i <= 6; i++) {
          const a = sa + (i / 6) * 1.1, r = 16 - Math.abs(i);
          px(g, x + Math.cos(a) * r - 1, y + Math.sin(a) * r * 0.8 - 1, 3, 3, Math.abs(i) < 3 ? "#ffffff" : i % 2 ? "#ff5a3a" : "#ffd84a");
        }
      }, Math.max(160, Math.hypot(tx - ax, ty - ay) * 2));
      f.beam(ax, ay, tx, ty, "#ff8a3a", 0.6); B.shake(8); Sound.play("crimson");
      if (mine) text(G, "홍련참!", src.x, src.y, 2.2, "#ff8a5a", true);
      break;
    }
    case 98: f.burst(tx, ty, 0.6, "#2a2040", 30, 1.6); f.ring(tx, ty, 45, "#8a5ad8", 400); Sound.play("decoy"); break;
    case 99: f.fall(tx, ty, "#c8a0ff", 260); B.shake(10); Sound.play("dive"); if (mine) text(G, "심연의 강림!", src.x, src.y, 2.3, "#e0c8ff", true); break;
    case 100: f.ring(src.x, src.y, extra || 100, "#c8324a", 400); f.sparkle(src.x, src.y, 0.8, "#ff3a5a", 16); Sound.play("blood_bind"); break;
    case 101: f.zap(tx, ty, "#fff27a", 300); f.ring(tx, ty, 40, "#bfe8ff", 360, true); B.shake(9); Sound.play("thunder"); if (mine) text(G, "천뢰!", src.x, src.y, 2.2, "#fff27a", true); break;
    // ── the hybrid expansion (docs/design/jobs-and-stats.md H.4)
    case 120: {
      // 십자 난도: the great blade's crescent across everything ahead, then a dagger's X on each one it swept
      const r = extra || 64;
      f.slash(src.x, src.y, ang, "#e8f0ff", 2.1); f.slash(src.x, src.y, ang, "#9fb8ff", 1.6, true);
      for (let i = -2; i <= 2; i++) { const a = ang + i * 0.36; f.spark(src.x + Math.cos(a) * r * 0.86, src.y + Math.sin(a) * r * 0.86, "#ffffff", 0.7); }
      B.shake(9); Sound.play("power_slash");
      const swept = [...G.mobs.values()].filter((m) => !m.dead && Math.hypot(m.x - src.x, m.y - src.y) <= r + 8 && Math.cos(Math.atan2(m.y - src.y, m.x - src.x) - ang) > 0.5).slice(0, 8);
      later(170, () => {
        for (const m of swept) { f.slash(m.x, m.y, ang + 0.8, "#c890ff", 0.6); f.slash(m.x, m.y, ang - 0.8, "#f0d0ff", 0.6, true); S3.fx.spark(m.x, m.y, "#f0d0ff", 1.2); }
        if (swept.length) { B.shake(4); Sound.play("crit"); }
      });
      if (mine) text(G, "십자 난도!", src.x, src.y, 2.2, "#d8c8ff", true);
      break;
    }
    case 121: {
      // 파진돌격: the charge's streak is the "ln 3" before this; here the great blade comes down where it
      // stopped (the cracks and the ring are the "bw" after) and the spear's reach shows on the rim
      const r = extra || 56, l = lineOf(3), a = l ? Math.atan2(l.by - l.ay, l.bx - l.ax) : ang;
      if (l) { f.beam(l.ax, l.ay - 3, l.bx, l.by - 3, "#e0c890", 0.5); for (const [x, y] of along(l.ax, l.ay, l.bx, l.by, 16)) f.burst(x, y, 0.05, "#a89068", 3, 1.4); }
      f.fall(tx, ty, "#e8f0ff", 90);
      f.slash(tx, ty, a, "#ffd84a", 1.7); f.slash(tx, ty, a + Math.PI, "#e8f0ff", 1.3, true);
      for (let i = 0; i < 10; i++) { const q = (i / 10) * 6.28; S3.fx.sparkle(tx + Math.cos(q) * r * 0.86, ty + Math.sin(q) * r * 0.86, 0.2, i % 2 ? "#5ad0b8" : "#c8fff0", 2); }
      S3.fx.ring(tx, ty, r * 0.86, "#5ad0b8", 320, false, 60);
      B.shake(11, a); Sound.play("verdict");
      if (mine) text(G, "파진돌격!", tx, ty, 2.3, "#ffd84a", true);
      break;
    }
    case 122: {
      // 검기 화살: the bow looses a sword's edge — a white-gold crescent head on a long streak, to the line's end
      SkillFx_bow(G, src, false);
      const ax = src.x, ay = src.y, ms = Math.max(140, Math.hypot(tx - ax, ty - ay) * 1.5);
      const [sx0, sy0] = at(ax, ay, 11), [sx1, sy1] = at(tx, ty, 11), sl = Math.hypot(sx1 - sx0, sy1 - sy0) || 1, ux = (sx1 - sx0) / sl, uy = (sy1 - sy0) / sl, sa = Math.atan2(uy, ux);
      S3.fxCustom((g, k) => {
        const x = sx0 + (sx1 - sx0) * k, y = sy0 + (sy1 - sy0) * k, back = Math.min(sl * k, 46);
        for (let q = 3; q < back; q++) { g.globalAlpha = 1 - q / 46; const w = q < 14 ? 3 : q < 28 ? 2 : 1; px(g, x - ux * q - (w >> 1), y - uy * q - (w >> 1), w, w, q < 10 ? "#ffffff" : q % 3 ? "#ffe9a0" : "#ffc23a"); }
        g.globalAlpha = 1;
        // the head: a crescent bowed forward, inked gold round a white edge
        for (const [rr, c, w] of [[11, "#ffc23a", 3], [10, "#ffffff", 2]]) for (let i = -7; i <= 7; i++) { const q = sa + (i / 7) * 1.15; px(g, x + Math.cos(q) * rr - ux * 7 - 1, y + Math.sin(q) * rr * 0.85 - uy * 7 - 1, w, w, c); }
      }, ms);
      f.beam(ax, ay, tx, ty, "#ffe9a0", 0.5);
      along(ax, ay, tx, ty, 24).forEach(([x, y], i, all) => later((i / all.length) * ms, () => S3.fx.sparkle(x, y, 0.5, i % 2 ? "#ffffff" : "#ffd84a", 2)));
      qi.at = now(); qi.ms = ms;
      f.flash(src.x, src.y, 12); B.shake(7); Sound.play("pierce"); Sound.play("power_slash");
      if (mine) text(G, "검기 화살!", src.x, src.y, 2.2, "#ffe9a0", true);
      break;
    }
    case 123: {
      // 그림자 관통: a spear of shadow thrown down the run (its streak is the "ln 6" before this), afterimages left on the way
      const l = lineOf(6), far = extra || 100;
      const a = l ? Math.atan2(l.by - l.ay, l.bx - l.ax) : ang, ax = l ? l.ax : tx - Math.cos(a) * far, ay = l ? l.ay : ty - Math.sin(a) * far;
      const [sx0, sy0] = at(ax, ay, 10), [sx1, sy1] = at(tx, ty, 10), sl = Math.hypot(sx1 - sx0, sy1 - sy0) || 1, ux = (sx1 - sx0) / sl, uy = (sy1 - sy0) / sl;
      S3.fxCustom((g, k) => {
        const u = Math.min(1, k / 0.3), hx = sx0 + (sx1 - sx0) * u + ux * 8, hy = sy0 + (sy1 - sy0) * u + uy * 8, L = Math.min(sl * u + 8, 60);
        if (k > 0.3) g.globalAlpha = Math.max(0, 1 - (k - 0.3) / 0.7);
        // an inked shaft, a violet core, a pale head with two barbs
        for (let q = 0; q < L; q++) px(g, hx - ux * q - 1, hy - uy * q - 1, 3, 3, INK);
        for (let q = 0; q < L; q++) px(g, hx - ux * q, hy - uy * q, 1, 1, q < 7 ? "#f0d0ff" : q % 4 === 3 ? "#6a4a9a" : "#a070e0");
        for (const o of [-1, 1]) for (let q = 3; q < 7; q++) px(g, hx - ux * q - uy * o * (q - 2) * 0.7, hy - uy * q + ux * o * (q - 2) * 0.7, 1, 1, "#f0d0ff");
      }, 420);
      along(ax, ay, tx, ty, 26).forEach(([x, y], i) => { f.burst(x, y, 0.5, i % 2 ? "#3a2a58" : "#6a4a9a", 4, 0.9); });
      f.burst(tx, ty, 0.5, "#a070e0", 10, 1.8); S3.fx.spark(tx + Math.cos(a) * 10, ty + Math.sin(a) * 10, "#f0d0ff", 1.2);
      B.shake(7, a); Sound.play("shade"); Sound.play("spiral");
      if (mine) text(G, "그림자 관통!", tx, ty, 2.2, "#d8b0ff", true);
      break;
    }
    case 124: {
      // 원소 비수: the three blades are the "ln 7"s that follow (the ln case colours them); here, the throw
      fan.n = 3; fan.at = now();
      [1, 2, 3].forEach((el, j) => { const a = ang + (j - 1) * 0.32; S3.fx.spark(src.x + Math.cos(a) * 12, src.y + Math.sin(a) * 12, ELEM_COL[el], 0.8); });
      f.slash(src.x, src.y, ang, "#f0d0ff", 0.9);
      B.shake(5); Sound.play("shade"); Sound.play("swap");
      if (mine) text(G, "원소 비수!", src.x, src.y, 2.2, "#f0d0ff", true);
      break;
    }
    case 125: {
      // 빙결창: a line of frost down the thrust, and ice standing up out of the ground where the point stopped
      f.beam(src.x, src.y, tx, ty, "#ffffff", 0.55); f.beam(src.x, src.y + 2, tx, ty + 2, "#9fe8ff", 0.5);
      along(src.x, src.y, tx, ty, 12).forEach(([x, y], i) => f.sparkle(x, y, 0.5, i % 2 ? "#e8f8ff" : "#9fe8ff", 2));
      f.ring(tx, ty, 44, "#9fe8ff", 380, true); f.burst(tx, ty, 0.3, "#e8f8ff", 16, 2.6);
      iceSpire(tx, ty);
      B.shake(8); Sound.play("spiral"); Sound.play("frost");
      if (mine) text(G, "빙결창!", src.x, src.y, 2.2, "#bfe8ff", true);
      break;
    }
    case 126: f.sparkle(src.x, src.y, 1, "#c8a0ff", 14); f.ring(tx, ty, extra || 64, "#c8a0ff", 420, true); f.burst(tx, ty, 0.2, "#8a5ad8", 16, 2); B.shake(4); Sound.play("pact"); if (mine) text(G, "메아리 법진", src.x, src.y, 2.2, "#e0c8ff", true); break;
    case 127: {
      // 삼원소 화살: the three arrows come as "ar" kinds 4–6; here the string's glow in all three
      SkillFx_bow(G, src, false);
      [1, 2, 3].forEach((el, j) => S3.fx.sparkle(src.x + Math.cos(ang + (j - 1) * 0.5) * 8, src.y + Math.sin(ang + (j - 1) * 0.5) * 8, 0.8, ELEM_COL[el], 5));
      f.flash(src.x, src.y, 12); B.shake(5); Sound.play("pierce"); Sound.play("ember");
      if (mine) text(G, "삼원소 화살!", src.x, src.y, 2.2, "#fff4dc", true);
      break;
    }
    case 128: {
      // 룬 먹화살: five arrows as "ar" kind 7; here ink thrown off the string
      SkillFx_bow(G, src, false);
      f.burst(src.x, src.y, 0.6, "#2a2040", 14, 1.8); S3.fx.sparkle(src.x, src.y, 0.9, "#b46aff", 8);
      S3.fx.ring(src.x, src.y, 16, "#b46aff", 280);
      B.shake(5); Sound.play("leapshot"); Sound.play("brand");
      if (mine) text(G, "룬 먹화살!", src.x, src.y, 2.2, "#d8a8ff", true);
      break;
    }
    case 102: f.ring(src.x, src.y, extra || 90, "#c8324a", 500, true); f.sparkle(src.x, src.y, 1, "#ff6a8a", 20); B.shake(5); Sound.play("sanctuary"); if (mine) text(G, "불멸의 성역", src.x, src.y, 2.2, "#ff8a9a", true); break;
  }
}
/** 빙결창's ice: three crystals shooting up out of the ground at (wx, wy), standing a moment, blinking out as they break. */
function iceSpire(wx, wy) {
  let broke = false;
  S3.fxCustom((g, k) => {
    const [x0, y0] = at(wx, wy), x = Math.round(x0), y = Math.round(y0), up = Math.min(1, k / 0.1);
    if (k > 0.8) {
      if (!broke) { broke = true; S3.fx.burst(wx, wy, 0.8, "#e8f8ff", 14, 2.2); S3.fx.burst(wx, wy, 0.4, "#9fe8ff", 10, 1.6); }
      if (Math.floor(k * 50) % 2) return;
    }
    // [dx, half width, height]: the small ones first, the tall one in front of them
    for (const [dx, w, h] of [[-10, 3, 20], [9, 3, 24], [0, 5, 42]]) {
      const H = Math.max(1, Math.round(h * up));
      // how wide half the crystal is at row j of H: swelling over the first fifth, tapering to a point
      const half = (j) => { const u = j / H; return Math.max(0, Math.round(w * (u < 0.2 ? 0.5 + u * 2.5 : 1 - (u - 0.2) / 0.8))); };
      for (let j = 0; j < H; j++) px(g, x + dx - half(j) - 1, y - j - 1, half(j) * 2 + 3, 1, INK);
      px(g, x + dx - 1, y - H - 1, 3, 1, INK);
      for (let j = 0; j < H; j++) {
        const a = half(j);
        px(g, x + dx - a, y - j - 1, a * 2 + 1, 1, "#9fe8ff");
        px(g, x + dx - a, y - j - 1, a + 1, 1, "#e8f8ff");
        if (a > 1) px(g, x + dx - a + 1, y - j - 1, 1, 1, "#ffffff");
        if (a > 0) px(g, x + dx + a, y - j - 1, 1, 1, "#5aa8e0");
      }
    }
  }, 900);
}
/** The bow skills draw and loose like a finisher (or up at the sky). */
function SkillFx_bow(G, src, up) { bowFire(G, src, 2, up); }
