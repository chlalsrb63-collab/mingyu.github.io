/**
 * The skill effects' shared kit (split from skillfx.js): world → iso placement `at`, the flat pixel `px`, the ink, the
 * palette of the skill being drawn (`PAL`, set through `setPal`), the effects-clock `later`, rings and shards on the
 * ground, the monster signs table and the small state the events and casts share (`live`, the last "ln", `qi fan`).
 */
import * as S3 from "./scene2d.js";
import { jobPal } from "./jobpal.js";

export const P = 2;                       // world unit → world pixel, as in scene2d (flat effects are drawn in these)
/** Server units → iso pixels, lifted `up` pixels: where things in the air are drawn. */
export const at = (wx, wy, up = 0) => { const [x, y] = S3.iso(wx, wy); return [x, y - up]; };
/** What weapongauge.js reads: the client state and the live number off the snapshot. */
export const live = { G: null };
/** Monster signs: id → { fz, vu } (end times). */
export const signs = new Map();
export const sign = (id, key, until) => { const s = signs.get(id) || {}; s[key] = until; signs.set(id, s); };
export const now = () => performance.now();
/** The palette the skill being drawn uses (jobpal.js): set where a skill's event comes in, read by the helpers as `p`. */
export let PAL = jobPal("adventurer");
/** Set the palette (the other skillfx files cannot assign the binding); returns it, as `p = (PAL = …)` did. */
export function setPal(p) { return (PAL = p); }

// ───────────────────────────── little helpers ─────────────────────────────

export function text(G, str, x, y, h, col, big) { G.texts.push({ str, x, y, h, col, big: !!big, t0: now() }); }
export const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
export const INK = "#2b2233";
export const rand = (a, b) => a + Math.random() * (b - a);
/** Do `fn` in `ms`, on the effects' own clock (so the preview pages that step time by hand see it too). */
export const later = (ms, fn) => { const q = PAL; S3.fx.add({ k: "custom", draw() {}, dur: Math.max(1, ms), done: () => { const o = PAL; PAL = q; fn(); PAL = o; } }); };
/** A filled ring flat on the ground for `ms`, gently pulsing, its edge marching: the reach of something standing. */
export function groundRing(wx, wy, r, ms, col, fill = 0.16) {
  S3.fxCustom((g, k) => {
    const a = Math.min(1, k * 8, (1 - k) * 8);
    g.globalAlpha = fill * a; g.fillStyle = col;
    g.beginPath(); g.arc(wx * P, wy * P, r * P, 0, 7); g.fill();
    g.globalAlpha = 0.5 * a; g.strokeStyle = col; g.lineWidth = 4; g.setLineDash([12, 12]); g.lineDashOffset = -k * ms / 20;
    g.beginPath(); g.arc(wx * P, wy * P, r * P, 0, 7); g.stroke();
  }, ms, true);
}
/** Points every `step` units from a to b (for things that run down a line one after another). */
export function along(ax, ay, bx, by, step) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.floor(d / step)), out = [];
  for (let i = 1; i <= n; i++) out.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  return out;
}

export function pixelLine(g, ax, ay, bx, by, color, width = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  for (let i = 0; i <= n; i++) px(g, ax + (bx - ax) * i / n, ay + (by - ay) * i / n, width, width, color);
}

/** Segmented light at the exact world radius, on the ground behind actors and danger markers. */
export function rim(x, y, r, edge, light, ms, spread = 0.25) {
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
export function shards(x, y, r, count, height, edge, light, ms, delay = 0) {
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

export const BANNER_COLOR = { cloth: "#427c76", shade: "#235954", light: "#a4ecd2", metal: "#d9b468", shine: "#fff0b0" };
export const BINDING_COLOR = { edge: "#9176ba", page: "#f1dcff", ribbon: "#be9cee", clasp: "#f6d484" };

export const ELEM_COL = [null, "#ff8a3a", "#9fe8ff", "#ffe86a"];
export const dist2 = (a, x, y) => (a.x - x) ** 2 + (a.y - y) ** 2;
export const skillNear = (G, x, y) => !!G.me && dist2(G.me, x, y) < 180 ** 2;

/** The last "ln" seen (a charge's or a run's line: the skill event that follows it reads where it began). */
let lastLn = null;
export function setLastLn(v) { lastLn = v; }
export const lineOf = (kind) => (lastLn && lastLn.kind === kind && now() - lastLn.at < 80 ? lastLn : null);
/** 검기 화살 (fx 122) just loosed: when, and how long its arrow flies (the "bw" that follows waits that long). */
export const qi = { at: 0, ms: 0 };
/** 원소 비수 (fx 124) just thrown: how many of its three "ln 7" blades are still to come, and when it was. */
export const fan = { n: 0, at: 0 };
