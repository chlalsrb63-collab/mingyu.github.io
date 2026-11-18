/**
 * The weapon skills as the player sees them (docs/design/jobs-and-stats.md C.5, H.4): what each skill looks and
 * sounds like (fx codes 70–102 and the nine later hybrids' 120–128 on an "a" event), the passives' little
 * flashes (110–115), the things skills leave standing (a vortex, a phantom beast, a rain of arrows, traps, a
 * storm, a blood sanctuary, a rune circle, a support pennant: "pr" placed, "pp" a beat, "pe" gone), the tracker's lure, the bow's
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
import { HAMMER_IMPACT } from "./swing.js";
import { comboEvent } from "./skillfx_combo.js";
import { fxPal, jobPal, skillPal, fxSkill, skillDef, skillOwner } from "./jobpal.js";
import { castPfx, procPfx } from "./skillpfx.js";

const P = 2;                       // world unit → world pixel, as in scene2d (flat effects are drawn in these)
/** Server units → iso pixels, lifted `up` pixels: where things in the air are drawn. */
const at = (wx, wy, up = 0) => { const [x, y] = S3.iso(wx, wy); return [x, y - up]; };
/** What weapongauge.js reads: the client state and the live number off the snapshot. */
export const live = { G: null };
/** Monster signs: id → { fz, vu } (end times). */
const signs = new Map();
const sign = (id, key, until) => { const s = signs.get(id) || {}; s[key] = until; signs.set(id, s); };
const now = () => performance.now();
/** The palette the skill being drawn uses (jobpal.js): set where a skill's event comes in, read by the helpers as `p`. */
let PAL = jobPal("adventurer");
/** Which job's palette a line ("ln" kind) or a placed thing ("pr" kind) is drawn in. */
const LN_JOB = { 2: "lancer", 3: "lancer", 4: "wizard", 5: "thief", 6: "thief", 7: "trickster", 8: "archer", 9: "swordsman", 10: "warlock" };
const PROP_JOB = { grav: "warlock", phantom: "warlock", rain: "archer", trap: "tracker", pillar: "lancer", meteor: "wizard", storm: "lancer",
  field: "dragoon", burst: "hexblade", sanct: "darkknight", rune: "runesage", banner: "lancer" };

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
const later = (ms, fn) => { const q = PAL; S3.fx.add({ k: "custom", draw() {}, dur: Math.max(1, ms), done: () => { const o = PAL; PAL = q; fn(); PAL = o; } }); };
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

/** A broken wake following the server's actual blink or charge path. */
function streakWake(ax, ay, bx, by, edge, light, width) {
  const [sx, sy] = at(ax, ay, 13), [ex, ey] = at(bx, by, 13);
  const dx = ex - sx, dy = ey - sy, length = Math.hypot(dx, dy);
  if (length < 2) return;
  const nx = -dy / length, ny = dx / length;
  S3.fxCustom((g, k) => {
    const back = k ** 1.4, front = Math.min(1, 0.65 + k * 3);
    for (let i = Math.ceil(back * length); i < front * length; i += 2) {
      const u = i / length, taper = width * Math.sin(Math.PI * u) * (1 - k);
      for (const side of [-1, 1]) {
        if ((i + (side < 0 ? 2 : 0)) % 20 > 13) continue;
        const offset = side * (1 + taper);
        px(g, sx + dx * u + nx * offset, sy + dy * u + ny * offset, 2, k < 0.34 ? 2 : 1, k < 0.42 && u > 0.5 ? light : edge);
      }
    }
  }, 230);
}

/** A small blade shape crosses its lane before the paired trail burns away. */
function shadowDart(ax, ay, bx, by) {
  const p = PAL;
  const [sx, sy] = at(ax, ay, 11), [ex, ey] = at(bx, by, 11);
  const dx = ex - sx, dy = ey - sy, length = Math.hypot(dx, dy);
  if (length < 2) return;
  const ux = dx / length, uy = dy / length;
  S3.fxCustom((g, k) => {
    const u = Math.min(1, 0.21 + k * 2.6), x = sx + dx * u, y = sy + dy * u;
    const tail = Math.min(length * u, 26 * (1 - k));
    for (let i = 2; i < tail; i += 2) {
      const spread = Math.min(4, i / 5);
      for (const side of [-1, 1]) px(g, x - ux * i - uy * spread * side, y - uy * i + ux * spread * side, 2, 2, i < 10 ? p.m : p.md);
    }
    if (u === 1) return;
    for (let i = 0; i <= Math.min(12, length * u); i++) {
      const w = Math.min(4, i, (12 - i) / 2);
      pixelLine(g, x - ux * i + uy * w, y - uy * i - ux * w, x - ux * i - uy * w, y - uy * i + ux * w, INK, 2);
      if (i > 1 && i < 11) px(g, x - ux * i, y - uy * i, 2, 2, i < 7 ? p.w : p.m);
    }
  }, 185);
}

function ambushCuts(wx, wy, ang) {
  const p = PAL;
  const [x, y] = at(wx, wy, 12);
  const heading = S3.sAng(Math.cos(ang), Math.sin(ang));
  S3.fx.flash(wx, wy, 9, 0, 0.14);
  shards(wx, wy, 18, 5, 14, p.md, p.w, 210);
  S3.fxCustom((g, k) => {
    for (const [offset, span, edge, core] of [[-0.68, 19, p.m, p.w], [0.64, 15, p.a, p.al]]) {
      const a = heading + offset, ux = Math.cos(a), uy = Math.sin(a);
      const start = span * (k * 1.25 - 0.72), end = span * (0.78 + k * 0.22);
      const ax = x + ux * start, ay = y + uy * start, bx = x + ux * end, by = y + uy * end;
      pixelLine(g, ax, ay, bx, by, INK, k < 0.55 ? 5 : 3);
      pixelLine(g, ax, ay, bx, by, edge, k < 0.5 ? 3 : 2);
      if (k < 0.42) pixelLine(g, ax, ay, bx, by, core, 1);
    }
    if (k < 0.48) {
      const r = Math.max(2, Math.round(6 * (1 - k)));
      px(g, x - r - 1, y - 1, r * 2 + 3, 3, INK);
      px(g, x - 1, y - r - 1, 3, r * 2 + 3, INK);
      px(g, x - r, y, r * 2 + 1, 1, p.a);
      px(g, x, y - r, 1, r * 2 + 1, p.a);
      px(g, x - 1, y - 1, 3, 3, "#ffffff");
    }
  }, 190);
}

/** A shadow clone silhouette left behind where a rogue blinked or danced from. */
function shadowAfterimage(wx, wy, ms = 240) {
  const p = PAL;
  const [sx, sy] = at(wx, wy);
  S3.fxCustom((g, k) => {
    const lift = Math.round(k * 5);
    g.globalAlpha = Math.max(0, (1 - k) * 0.85);
    px(g, sx - 5, sy - 14 - lift, 10, 13, INK);
    px(g, sx - 4, sy - 13 - lift, 8, 11, p.d);
    px(g, sx - 3, sy - 12 - lift, 6, 4, p.md);
    px(g, sx - 2, sy - 11 - lift, 2, 1, p.l);
    px(g, sx + 1, sy - 11 - lift, 2, 1, p.l);
    g.globalAlpha = 1;
  }, ms);
}

/** 무영난무's single strike: a bold dark-outlined violet X-gash and bursting shadow petals. */
function flurrySlash(wx, wy, ang) {
  const p = PAL;
  const [x, y] = at(wx, wy, 12);
  const heading = S3.sAng(Math.cos(ang), Math.sin(ang));
  S3.fx.flash(wx, wy, 8, 0, 0.12);
  shards(wx, wy, 20, 4, 13, p.md, p.w, 190);
  S3.fxCustom((g, k) => {
    for (const [offset, span, shade, light] of [[-0.78, 22, p.m, p.w], [0.78, 20, p.m, p.al]]) {
      const a = heading + offset, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
      const s0 = -span * (0.85 - k * 0.4), s1 = span * (0.65 + k * 0.35);
      for (let q = Math.floor(s0); q <= Math.ceil(s1); q += 2) {
        const u = (q - s0) / Math.max(1, s1 - s0), w = Math.max(1, Math.round(Math.sin(u * Math.PI) * 3 * (1 - k * 0.5)));
        const px0 = x + ux * q, py0 = y + uy * q;
        pixelLine(g, px0 - nx * (w + 1), py0 - ny * (w + 1), px0 + nx * (w + 1), py0 + ny * (w + 1), INK, 2);
        pixelLine(g, px0 - nx * w, py0 - ny * w, px0 + nx * w, py0 + ny * w, k < 0.4 && Math.abs(u - 0.5) < 0.28 ? light : shade, 2);
      }
    }
    if (k < 0.45) {
      px(g, x - 5, y - 1, 11, 3, INK); px(g, x - 1, y - 5, 3, 11, INK);
      px(g, x - 4, y, 9, 1, p.w); px(g, x, y - 4, 1, 9, p.w);
      px(g, x - 1, y - 1, 3, 3, "#ffffff");
    }
  }, 185);
}

/**
 * 창 직선 찌르기 (inter-basic melee & spiral thrust):
 * 3 distinct phases (0..0.18 anticipation draw-back -> 0.18..0.62 straight thrust & locked endpoint -> 0.62..1 dissipation),
 * with clear `±half` lane ticks, 72% sweet-spot collar, and an unmistakable barbed spearhead + target chevron at (bx, by).
 */
export function meleeSpearThrust(ax, ay, bx, by, half = 12, farRatio = 0.72) {
  const p = PAL;
  const [sx, sy] = at(ax, ay, 13), [ex, ey] = at(bx, by, 13);
  const dx = ex - sx, dy = ey - sy, length = Math.hypot(dx, dy);
  if (length < 2) return;
  const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
  const wdx = bx - ax, wdy = by - ay, wlen = Math.hypot(wdx, wdy) || 1;
  const wux = wdx / wlen, wuy = wdy / wlen, wnx = -wuy, wny = wux;

  // Ground lane ticks (`±half`) and endpoint ground bracket — open segments so boss telegraphs underneath stay visible
  S3.fxCustom((g, k) => {
    if (k < 0.18) {
      // Phase 1 (Anticipation): converging aim ticks near caster
      const ak = k / 0.18, pull = (1 - ak) * 6;
      for (const side of [-1, 1]) {
        const [gx, gy] = at(ax - wux * pull + wnx * side * half * (1.15 - 0.25 * ak), ay - wuy * pull + wny * side * half * (1.15 - 0.25 * ak), 0);
        px(g, gx - 2, gy - 1, 4, 3, INK);
        px(g, gx - 1, gy, 2, 1, p.al);
      }
      return;
    }
    const fade = k < 0.62 ? 1 : (1 - k) / 0.38;
    g.globalAlpha = fade;
    // Subtle `±half` lane boundary ticks at 35%, 72% (sweet-spot start), and 100% (endpoint)
    for (const u of [0.35, farRatio, 1]) {
      if (k >= 0.62 && u < farRatio) continue;
      for (const side of [-1, 1]) {
        const [gx, gy] = at(ax + wdx * u + wnx * side * half, ay + wdy * u + wny * side * half, 0);
        px(g, gx - 2, gy - 1, 4, 3, INK);
        px(g, gx - 1, gy, 2, 1, u >= farRatio ? p.al : p.m);
      }
    }
  }, 260);

  // Air spear shaft, spiral wake, sweet-spot collar, and locked endpoint spearhead
  S3.fxCustom((g, k) => {
    // Phase 1 (0..0.18): Anticipation — spear point drawn back behind (sx, sy) with focus glint
    if (k < 0.18) {
      const ak = k / 0.18, back = (1 - ak) * 8;
      const bx0 = sx - ux * (back + 10), by0 = sy - uy * (back + 10), tx0 = sx + ux * (8 - back), ty0 = sy + uy * (8 - back);
      pixelLine(g, bx0, by0, tx0, ty0, INK, 5);
      pixelLine(g, bx0, by0, tx0, ty0, p.md, 3);
      pixelLine(g, bx0, by0, tx0, ty0, p.al, 1);
      const r = Math.round(6 * (1 - ak * 0.5));
      for (const s of [-1, 1]) {
        px(g, sx - ux * back + nx * s * r - 1, sy - uy * back + ny * s * r - 1, 3, 3, INK);
        px(g, sx - ux * back + nx * s * r, sy - uy * back + ny * s * r, 2, 2, p.l);
      }
      px(g, tx0 - 1, ty0 - 1, 3, 3, "#ffffff");
      return;
    }

    // Phase 2 (0.18..0.62): Strike & endpoint lock  |  Phase 3 (0.62..1): Segmented dissipation
    const sk = (k - 0.18) / 0.82;
    const inStrike = k < 0.62;
    const from = inStrike ? 0 : Math.min(0.82, ((k - 0.62) / 0.38) * 0.85);
    const to = Math.min(1, 0.45 + sk * 4.2);

    // Straight spear shaft (solid in Phase 2, breaking into dashes in Phase 3)
    if (inStrike) {
      pixelLine(g, sx + dx * from, sy + dy * from, sx + dx * to, sy + dy * to, INK, 6);
      pixelLine(g, sx + dx * from, sy + dy * from, sx + dx * to, sy + dy * to, p.md, 4);
      pixelLine(g, sx + dx * from, sy + dy * from, sx + dx * to, sy + dy * to, p.l, 2);
      pixelLine(g, sx + dx * Math.max(from, farRatio), sy + dy * Math.max(from, farRatio), sx + dx * to, sy + dy * to, "#ffffff", 1);
    } else {
      for (let i = Math.ceil(length * from); i < length * to; i += 6) {
        const u0 = i / length, u1 = Math.min(to, (i + 3) / length);
        pixelLine(g, sx + dx * u0, sy + dy * u0, sx + dx * u1, sy + dy * u1, INK, 4);
        pixelLine(g, sx + dx * u0, sy + dy * u0, sx + dx * u1, sy + dy * u1, u0 >= farRatio ? p.al : p.m, 2);
      }
    }

    // Double-helix spiral wake along the thrust
    for (let i = Math.ceil(length * from); i < length * to; i += 3) {
      if (!inStrike && (i & 1)) continue;
      const u = i / length, inTip = u >= farRatio;
      const spread = (inTip ? 8 : 6) * Math.sin(Math.PI * u) * (1 - sk * 0.55);
      const twist = Math.sin(u * Math.PI * 5 - sk * 5.5) * spread;
      px(g, sx + dx * u + nx * twist - 1, sy + dy * u + ny * twist - 1, 4, 4, INK);
      px(g, sx + dx * u + nx * twist, sy + dy * u + ny * twist, 2, 2, inTip ? p.al : p.l);
      if (k < 0.76) {
        px(g, sx + dx * u - nx * twist - 1, sy + dy * u - ny * twist - 1, 4, 4, INK);
        px(g, sx + dx * u - nx * twist, sy + dy * u - ny * twist, 2, 2, inTip ? p.l : p.m);
      }
    }

    // Sweet-spot collar at `farRatio` (72% reach)
    if (to >= farRatio && k < 0.78) {
      const cx = sx + dx * farRatio, cy = sy + dy * farRatio, collar = Math.round(7 * (1 - sk * 0.45));
      pixelLine(g, cx - nx * collar, cy - ny * collar, cx + nx * collar, cy + ny * collar, INK, 4);
      pixelLine(g, cx - nx * collar, cy - ny * collar, cx + nx * collar, cy + ny * collar, p.al, 2);
    }

    // Distinct endpoint spearhead + target chevron at (ex, ey) so 1x scale clearly reads the exact tip
    const hx = sx + dx * to, hy = sy + dy * to, headLen = Math.min(18, length * 0.25);
    const scale = inStrike ? 1 : Math.max(0.35, 1 - (k - 0.62) / 0.38);
    for (let q = 0; q <= headLen * scale; q += 2) {
      const w = Math.max(1, Math.round((1 - q / (headLen * scale + 1)) * 5 * scale));
      const px0 = hx - ux * q, py0 = hy - uy * q;
      pixelLine(g, px0 - nx * (w + 1), py0 - ny * (w + 1), px0 + nx * (w + 1), py0 + ny * (w + 1), INK, 2);
      pixelLine(g, px0 - nx * w, py0 - ny * w, px0 + nx * w, py0 + ny * w, q < 5 ? "#ffffff" : q < 11 ? p.al : p.m, 2);
    }
    // Endpoint lock chevron & compact point spark at (ex, ey)
    if (to >= 0.95) {
      const wing = Math.round(8 * scale);
      for (const s of [-1, 1]) {
        pixelLine(g, ex + ux * 3, ey + uy * 3, ex - ux * 5 + nx * s * wing, ey - uy * 5 + ny * s * wing, INK, 4);
        pixelLine(g, ex + ux * 3, ey + uy * 3, ex - ux * 5 + nx * s * wing, ey - uy * 5 + ny * s * wing, inStrike ? p.al : p.m, 2);
      }
      px(g, ex - 2, ey - 2, 5, 5, INK);
      px(g, ex - 1, ey - 1, 3, 3, inStrike ? "#ffffff" : p.al);
    }
  }, 260);
}

function spiralThrust(ax, ay, bx, by) {
  meleeSpearThrust(ax, ay, bx, by, 12, 0.72);
}

/** 유성창 (comet): wide drag corridor (`half = 20`) + blazing spear comet + landing stun crater. */
function cometCharge(ax, ay, bx, by, half = 20) {
  const p = PAL;
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
  // Ground corridor rails showing exact `half = 20` drag width
  S3.fxCustom((g, k) => {
    const steps = Math.max(4, Math.ceil(d / 8));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      if (u < k * 0.5 || u > Math.min(1, 0.35 + k * 2.2)) continue;
      for (const side of [-1, 1]) {
        const wx = (ax + dx * u + nx * side * half) * P, wy = (ay + dy * u + ny * side * half) * P;
        px(g, wx - 2, wy - 2, 6, 6, INK);
        px(g, wx - 1, wy - 1, 4, 4, k < 0.45 ? p.l : p.a);
        // Inward chevron teeth showing enemy pull toward center line
        if (i % 2 === 0 && k < 0.65) {
          const ix = (ax + dx * Math.min(1, u + 0.08) + nx * side * half * 0.48) * P;
          const iy = (ay + dy * Math.min(1, u + 0.08) + ny * side * half * 0.48) * P;
          pixelLine(g, wx, wy, ix, iy, p.al, 3);
        }
      }
    }
  }, 310, true);
  // Air comet spear head and wake
  const [sx, sy] = at(ax, ay, 13), [ex, ey] = at(bx, by, 13);
  const sdx = ex - sx, sdy = ey - sy, slen = Math.hypot(sdx, sdy) || 1;
  const sux = sdx / slen, suy = sdy / slen, snx = -suy, sny = sux;
  S3.fxCustom((g, k) => {
    const u = Math.min(1, 0.3 + k * 2.5), hx = sx + sdx * u, hy = sy + sdy * u;
    const tail = Math.min(slen * u, 48 * (1 - k * 0.65));
    for (let q = 0; q < tail; q += 2) {
      const w = Math.max(1, Math.round((1 - q / Math.max(1, tail)) * 7 * (1 - k * 0.4)));
      const px0 = hx - sux * q, py0 = hy - suy * q;
      pixelLine(g, px0 - snx * (w + 1), py0 - sny * (w + 1), px0 + snx * (w + 1), py0 + sny * (w + 1), INK, 2);
      pixelLine(g, px0 - snx * w, py0 - sny * w, px0 + snx * w, py0 + sny * w, q < 10 ? p.l : q < 24 ? p.a : p.ad, 2);
    }
    if (k < 0.72) {
      // Stun star burst at landing endpoint
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 4 + k * 1.2, r = (10 + (i % 2) * 5) * (1 - k * 0.4);
        pixelLine(g, ex - Math.cos(a) * r, ey - Math.sin(a) * r * 0.75, ex + Math.cos(a) * r, ey + Math.sin(a) * r * 0.75, INK, 4);
        pixelLine(g, ex - Math.cos(a) * r, ey - Math.sin(a) * r * 0.75, ex + Math.cos(a) * r, ey + Math.sin(a) * r * 0.75, i % 2 ? p.a : p.l, 2);
      }
    }
  }, 280);
  S3.fx.flash(bx, by, 11, 0, 0.2);
  S3.fx.wave(bx, by, half, p.al, 290);
  rim(bx, by, half, p.ad, p.l, 340, 0.34);
  shards(bx, by, half * 0.9, 8, 22, p.ad, p.l, 300);
}

/** 대지 가르기 (rend): landing slam (`r = 38`) + forward earth-splitting corridor (`len = 120, half = 14`). */
function rendSlam(wx, wy, r) {
  const p = PAL;
  S3.fx.flash(wx, wy, 12, 0, 0.18);
  S3.fx.wave(wx, wy, r, p.m, 300);
  rim(wx, wy, r, p.md, p.l, 390, 0.35);
  shards(wx, wy, r * 0.86, 9, 24, p.md, p.l, 340);
  S3.fxCustom((g, k) => {
    const reach = r * Math.min(1, 0.35 + k * 2.4);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + (i % 2 ? 0.18 : -0.14), ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
      for (let d = 4; d <= reach; d += 3) {
        const jag = ((d + i * 5) % 6 - 3) * 0.7;
        const gx = (wx + ux * d + nx * jag) * P, gy = (wy + uy * d + ny * jag) * P;
        px(g, gx - 2, gy - 2, 6, 6, INK);
        px(g, gx - 1, gy - 1, 4, 4, k < 0.45 && d < reach * 0.7 ? p.l : p.m);
      }
    }
  }, 420, true);
}

function rendWave(ax, ay, bx, by, half = 14) {
  const p = PAL;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  // Ground fault corridor matching exact `len` and `half = 14`
  S3.fxCustom((g, k) => {
    const front = Math.min(1, 0.18 + k * 1.75), steps = Math.max(6, Math.ceil(len / 6));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      if (u > front) break;
      const age = k - u * 0.45;
      if (age > 0.72) continue;
      const jag = ((i * 7) % 5 - 2) * 1.4;
      const cx = (ax + dx * u + nx * jag) * P, cy = (ay + dy * u + ny * jag) * P;
      px(g, cx - 3, cy - 3, 7, 7, INK);
      px(g, cx - 2, cy - 2, 5, 5, age < 0.25 ? p.l : p.m);
      for (const side of [-1, 1]) {
        const rx = (ax + dx * u + nx * side * half) * P, ry = (ay + dy * u + ny * side * half) * P;
        px(g, rx - 2, ry - 2, 5, 5, INK);
        px(g, rx - 1, ry - 1, 3, 3, age < 0.22 ? p.l : p.md);
      }
    }
  }, 430, true);
  // Erupting pixel rock teeth and golden shockwave crest racing down the corridor
  S3.fxCustom((g, k) => {
    const front = Math.min(1, 0.18 + k * 1.75), rocks = 9;
    for (let i = 1; i <= rocks; i++) {
      const u = i / rocks;
      if (u > front) break;
      const localK = Math.max(0, (k - u * 0.42) / 0.58);
      if (localK >= 1) continue;
      const side = (i % 3 - 1) * half * 0.55;
      const [sx, sy] = at(ax + dx * u + nx * side, ay + dy * u + ny * side);
      const h = Math.max(3, Math.round(Math.sin(Math.min(1, localK * 1.3) * Math.PI) * (16 + (i % 3) * 4)));
      const w = 3 + (i % 2);
      for (let j = 0; j < h; j++) {
        const hw = Math.max(1, Math.round(w * (1 - j / (h + 2))));
        px(g, sx - hw - 1, sy - j - 1, hw * 2 + 3, 2, INK);
        px(g, sx - hw, sy - j - 1, hw * 2 + 1, 1, j > h - 4 ? p.l : p.m);
        if (hw > 1) px(g, sx - hw, sy - j - 1, hw, 1, p.md);
      }
    }
  }, 390);
  along(ax, ay, bx, by, 18).forEach(([x, y], i) => later(i * 32, () => {
    S3.fx.burst(x, y, 0.08, p.m, 5, 1.5);
  }));
}

/** 단죄의 일격 (verdict): full 360° pixel great-blade whirlwind covering `r = 70`. */
function verdictSpin(wx, wy, ang, r = 70) {
  const p = PAL;
  S3.fx.flash(wx, wy, 14, 0, 0.2);
  S3.fx.wave(wx, wy, r, p.m, 340);
  rim(wx, wy, r, p.md, p.a, 430, 0.3);
  rim(wx, wy, r * 0.62, p.md, p.m, 340, 0.25);
  shards(wx, wy, r * 0.88, 12, 26, p.md, p.a, 370);
  S3.fxCustom((g, k) => {
    const spin = ang + k * Math.PI * 2.4;
    for (const [bandR, thick0, colEdge, colMid, colHot] of [
      [r * 0.94, 12, p.md, p.m, p.a],
      [r * 0.58, 8, p.md, p.m, p.a],
    ]) {
      for (let step = 0; step < 56; step++) {
        const u = step / 56;
        if (u > Math.min(1, 0.38 + k * 1.4)) continue;
        const a = spin - u * Math.PI * 1.85, ca = Math.cos(a), sa = Math.sin(a);
        const thick = Math.max(1, (1 - u * 0.75) * thick0 * (1 - k * 0.45));
        const [ax, ay] = at(wx + ca * (bandR - thick), wy + sa * (bandR - thick), 11);
        const [bx, by] = at(wx + ca * bandR, wy + sa * bandR, 11);
        pixelLine(g, ax, ay, bx, by, INK, 4);
        pixelLine(g, ax, ay, bx, by, u < 0.22 ? colHot : u < 0.6 ? colMid : colEdge, 2);
        if (u < 0.16 && k < 0.55) px(g, bx - 1, by - 1, 3, 3, "#ffffff");
      }
    }
    // 8 radial execution sword spikes on the outer perimeter
    if (k < 0.65) {
      for (let i = 0; i < 8; i++) {
        const a = ang + i * (Math.PI / 4), ca = Math.cos(a), sa = Math.sin(a);
        const [p0x, p0y] = at(wx + ca * r * 0.68, wy + sa * r * 0.68, 11);
        const [p1x, p1y] = at(wx + ca * r * 1.02, wy + sa * r * 1.02, 11);
        pixelLine(g, p0x, p0y, p1x, p1y, INK, 4);
        pixelLine(g, p0x, p0y, p1x, p1y, i % 2 ? p.a : p.m, 2);
      }
    }
  }, 330);
}

/** 십자 난도 (crosscut): wide `r = 64, arc = 100°` sword crescent + crossing violet dagger arc. */
function crossCutFx(wx, wy, ang, r = 64) {
  const p = PAL;
  const halfArc = (50 * Math.PI) / 180; // 100° total cone
  const fx = wx + Math.cos(ang) * r * 0.62, fy = wy + Math.sin(ang) * r * 0.62;
  S3.fx.flash(fx, fy, 11, 0, 0.16);
  shards(fx, fy, r * 0.48, 8, 18, p.m, p.al, 280);
  S3.fxCustom((g, k) => {
    // Great blade sweeping crescent (-halfArc → +halfArc)
    for (let s = -22; s <= 22; s++) {
      const u = s / 22, a = ang + u * halfArc;
      const reach = r * (0.86 + 0.12 * Math.cos(u * 1.4));
      const thick = Math.max(1, (1 - Math.abs(u) * 0.72) * 11 * (1 - k * 0.55));
      const [ax, ay] = at(wx + Math.cos(a) * (reach - thick), wy + Math.sin(a) * (reach - thick), 11);
      const [bx, by] = at(wx + Math.cos(a) * reach, wy + Math.sin(a) * reach, 11);
      pixelLine(g, ax, ay, bx, by, INK, 4);
      pixelLine(g, ax, ay, bx, by, k < 0.42 ? p.l : p.m, 2);
      px(g, bx - 1, by - 1, 2, 2, k < 0.35 ? "#ffffff" : p.w);
    }
    // Crossing violet dagger slash forming an X across the cone
    const [cx, cy] = at(fx, fy, 12), sa = S3.sAng(Math.cos(ang), Math.sin(ang));
    for (const [off, span, col, core] of [[-0.62, r * 0.68, p.l, "#ffffff"], [0.62, r * 0.64, p.a, p.al]]) {
      const a = sa + off, ux = Math.cos(a), uy = Math.sin(a);
      const ax = cx - ux * span * 0.85, ay = cy - uy * span * 0.85;
      const bx = cx + ux * span * 0.85, by = cy + uy * span * 0.85;
      pixelLine(g, ax, ay, bx, by, INK, k < 0.5 ? 5 : 3);
      pixelLine(g, ax, ay, bx, by, col, k < 0.5 ? 3 : 2);
      if (k < 0.38) pixelLine(g, ax, ay, bx, by, core, 1);
    }
  }, 240);
}

/** 심연의 강림 (dive): high-altitude abyssal spear pillar + `r = 110` crater rim & shards. */
function abyssDive(wx, wy, r = 110) {
  const p = PAL;
  const [sx, sy] = at(wx, wy);
  S3.fx.flash(wx, wy, 15, 0, 0.22);
  S3.fx.wave(wx, wy, r, p.a, 380);
  rim(wx, wy, r, p.ad, p.l, 460, 0.3);
  rim(wx, wy, 70, p.md, p.m, 410, 0.24);
  shards(wx, wy, r * 0.82, 12, 28, p.ad, p.l, 390);
  // Descending abyssal dragon-spear pillar + 8 radial ground fissures
  S3.fxCustom((g, k) => {
    if (k < 0.65) {
      const h = Math.round(115 * (1 - k * 0.45)), w = Math.max(2, Math.round(11 * (1 - k * 1.2)));
      for (let j = 0; j < h; j += 3) {
        const hw = Math.max(1, Math.round(w * (1 - j / (h + 20))));
        px(g, sx - hw - 1, sy - j - 2, hw * 2 + 3, 4, INK);
        px(g, sx - hw, sy - j - 2, hw * 2 + 1, 3, j < 28 ? p.m : p.a);
        if (k < 0.38) px(g, sx - Math.max(1, hw >> 1), sy - j - 2, Math.max(2, hw), 3, "#ffffff");
      }
    }
    // Spears of dark crystal ringing the impact center
    for (const [dx, cw, ch] of [[-18, 3, 24], [18, 3, 24], [-9, 4, 32], [9, 4, 32], [0, 5, 42]]) {
      const H = Math.max(2, Math.round(ch * Math.sin(Math.min(1, k * 1.35) * Math.PI)));
      for (let j = 0; j < H; j += 2) {
        const hw = Math.max(1, Math.round(cw * (1 - j / H)));
        px(g, sx + dx - hw - 1, sy - j - 1, hw * 2 + 3, 2, INK);
        px(g, sx + dx - hw, sy - j - 1, hw * 2 + 1, 2, j > H - 5 ? p.l : p.ad);
      }
    }
  }, 380);
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

/**
 * 대검 호 형태 검기 (inter-basic melee & 파워 슬래쉬):
 * 3 distinct phases:
 * - Phase 1 (0..0.19): Anticipation glint & cocked blade line at the back-swing edge (-halfArc).
 * - Phase 2 (0.19..0.60): Directional crescent sweep from -halfArc to +halfArc at exact radius `r` (thin tail -> wide beveled leading head)
 *   + single compact contact spark at apex + open boundary ticks.
 * - Phase 3 (0.60..1.0): Segmented pixel steel-qi fragments drifting outward and vanishing cleanly without hiding boss telegraphs.
 */
export function meleeSwordArc(x, y, ang, r = 46, arcDeg = 75) {
  const p = PAL;
  const halfArc = (arcDeg * Math.PI) / 360;
  S3.fxCustom((g, k) => {
    // Phase 1 (0..0.19): Anticipation at back-swing edge (-halfArc)
    if (k < 0.19) {
      const ak = k / 0.19, a0 = ang - halfArc * (1.08 - 0.08 * ak);
      const u = Math.cos(a0), v = Math.sin(a0);
      const [p0x, p0y] = at(x + u * r * 0.34, y + v * r * 0.34, 11);
      const [p1x, p1y] = at(x + u * r * (0.72 + 0.16 * ak), y + v * r * (0.72 + 0.16 * ak), 11);
      pixelLine(g, p0x, p0y, p1x, p1y, INK, 5);
      pixelLine(g, p0x, p0y, p1x, p1y, p.m, 3);
      pixelLine(g, p0x, p0y, p1x, p1y, p.w, 1);
      px(g, p1x - 2, p1y - 2, 5, 5, INK);
      px(g, p1x - 1, p1y - 1, 3, 3, "#ffffff");
      return;
    }

    const sk = (k - 0.19) / 0.81;
    const inStrike = k < 0.60;
    const steps = 28;
    const fromStep = inStrike ? Math.floor(Math.max(0, (sk - 0.15) * 0.55) * steps) : Math.floor(((k - 0.60) / 0.40) * 0.45 * steps);
    const toStep = Math.min(steps, Math.ceil((0.28 + sk * 2.8) * steps));
    const drift = inStrike ? 0 : ((k - 0.60) / 0.40) * 4.5;

    // Open ground cone boundary ticks at exact radius `r` and `±halfArc` side limits (never an opaque fill)
    if (k < 0.82) {
      for (const side of [-1, 1]) {
        const aLim = ang + side * halfArc;
        const [gx0, gy0] = at(x + Math.cos(aLim) * r * 0.68, y + Math.sin(aLim) * r * 0.68, 0);
        const [gx1, gy1] = at(x + Math.cos(aLim) * r, y + Math.sin(aLim) * r, 0);
        pixelLine(g, gx0, gy0, gx1, gy1, INK, 3);
        pixelLine(g, gx0, gy0, gx1, gy1, p.m, 1);
      }
    }

    // Crescent body: thin at trailing tail (-halfArc), thickening toward the leading beveled head (+halfArc)
    for (let i = fromStep; i <= toStep; i++) {
      // Phase 3 breaks the crescent into segmented pixel clusters
      if (!inStrike && (i % 4 === 2 || i % 4 === 3)) continue;
      const u = i / steps; // 0 = trailing tail (-halfArc), 1 = leading head (+halfArc)
      const a = ang + (u * 2 - 1) * halfArc;
      const ca = Math.cos(a), sa = Math.sin(a);
      const reach = r * (0.90 + 0.10 * Math.sin(u * Math.PI)) + drift;
      // Asymmetric directional taper: tail is 2px, leading 75% swells to 11px, tip bevels to a point
      const profile = u < 0.84 ? 0.18 + 0.82 * (u / 0.84) ** 0.85 : Math.max(0.15, (1 - u) / 0.16);
      const thick = Math.max(1.5, profile * (inStrike ? 11.5 : 6.5 * (1 - (k - 0.60) / 0.40)));
      const [ax, ay] = at(x + ca * (reach - thick), y + sa * (reach - thick), 10);
      const [bx, by] = at(x + ca * reach, y + sa * reach, 10);
      pixelLine(g, ax, ay, bx, by, INK, 4);
      pixelLine(g, ax, ay, bx, by, u > 0.58 && inStrike ? p.l : p.m, 2);
      // Outer cutting edge & leading specular ridge
      px(g, bx - 2, by - 2, 4, 4, INK);
      px(g, bx - 1, by - 1, 2, 2, u > 0.52 && inStrike ? "#ffffff" : p.l);
      if (inStrike && u > 0.35 && u < 0.88) {
        px(g, (ax + bx) * 0.5 - 1, (ay + by) * 0.5 - 1, 2, 2, p.w);
      }
    }

    // Directional leading sword-point head at `toStep` so swing direction reads at 1x
    if (inStrike) {
      const uLead = toStep / steps, aLead = ang + (uLead * 2 - 1) * halfArc;
      const tx = -Math.sin(aLead), ty = Math.cos(aLead);
      const [hx, hy] = at(x + Math.cos(aLead) * (r * 0.94), y + Math.sin(aLead) * (r * 0.94), 10);
      const [tipX, tipY] = at(x + Math.cos(aLead) * (r * 0.96) + tx * 6, y + Math.sin(aLead) * (r * 0.96) + ty * 6, 10);
      pixelLine(g, hx, hy, tipX, tipY, INK, 4);
      pixelLine(g, hx, hy, tipX, tipY, "#ffffff", 2);
    }

    // Single compact directional impact spark at the apex (no repeated flash)
    if (k >= 0.22 && k < 0.46) {
      const [ix, iy] = at(x + Math.cos(ang) * r * 0.82, y + Math.sin(ang) * r * 0.82, 11);
      const sr = Math.round(7 * (1 - (k - 0.22) / 0.24));
      px(g, ix - sr - 1, iy - 1, sr * 2 + 3, 3, INK);
      px(g, ix - 1, iy - sr - 1, 3, sr * 2 + 3, INK);
      px(g, ix - sr, iy, sr * 2 + 1, 1, p.w);
      px(g, ix, iy - sr, 1, sr * 2 + 1, p.w);
      px(g, ix - 1, iy - 1, 3, 3, "#ffffff");
    }
  }, 275);
}

function swordCrescent(x, y, ang, r) {
  meleeSwordArc(x, y, ang, r || 46, 75);
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

const BANNER_COLOR = { cloth: "#427c76", shade: "#235954", light: "#a4ecd2", metal: "#d9b468", shine: "#fff0b0" };
const BINDING_COLOR = { edge: "#9176ba", page: "#f1dcff", ribbon: "#be9cee", clasp: "#f6d484" };

/** Two pages unfold above the caster, releasing ribbons that never imply a target. */
function bindingFolio(x, y, radius) {
  const [cx, cy] = at(x, y, 30);
  const c = BINDING_COLOR;
  S3.fx.wave(x, y, radius * 0.49, c.ribbon, 350);
  S3.fxCustom((g, k) => {
    const spread = Math.round(5 + 6 * Math.min(1, k * 5));
    const lift = Math.round(k * 15), yy = cy - lift;
    g.globalAlpha = Math.min(1, 0.4 + k * 9, (1 - k) * 3);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? cx - spread : cx + 1;
      px(g, x0 - 1, yy - 5, spread + 2, 13, INK);
      px(g, x0, yy - 5, spread, 2, c.edge);
      px(g, x0, yy - 3, spread, 8, c.page);
      px(g, x0 + 1, yy - 1, spread - 2, 1, c.ribbon);
      px(g, x0 + 1, yy + 2, spread - 3, 1, c.ribbon);
      px(g, x0, yy + 5, spread, 2, c.edge);
      // The last pixels race out after the thick ribbon leaves the spine.
      const n = Math.min(28, Math.floor(k * 72));
      for (let i = Math.max(0, n - 17); i <= n; i++) {
        const u = i / 28, xx = cx + side * (spread + u * radius * 0.38);
        const ry = yy + 4 + u * 22 - Math.sin(u * Math.PI * 2) * 9;
        const size = i < n - 4 ? 2 : 1;
        px(g, xx, ry, size, size + 1, i % 7 === 0 ? c.clasp : c.ribbon);
      }
    }
    px(g, cx - 1, yy - 4, 2, 12, "#55426e");
    px(g, cx - 1, yy + 1, 2, 4, c.clasp);
  }, 560);
}

/** Only a positive heal produces these short marks, pinned to the recipient. */
export function supportMend(target, cue) {
  const banner = cue === 4, color = banner ? BANNER_COLOR.light : BINDING_COLOR.page;
  S3.fx.wave(target.x, target.y, banner ? 14 : 18, color, 295);
  S3.fxCustom((g, k) => {
    const [x, y] = at(target.x, target.y, 19 + k * 14);
    g.globalAlpha = Math.min(1, (1 - k) * 3);
    if (banner) {
      px(g, x - 2, y - 5, 5, 11, INK); px(g, x - 5, y - 2, 11, 5, INK);
      px(g, x - 1, y - 4, 3, 9, color); px(g, x - 4, y - 1, 9, 3, color);
      px(g, x - 1, y - 1, 2, 2, BANNER_COLOR.shine);
    } else {
      for (const side of [-1, 1]) for (let i = 0; i <= 10; i++) {
        const a = Math.PI * i / 10;
        px(g, x + side * (Math.cos(a) * (8 + k * 3)), y + side * Math.sin(a) * 4, 2, 2, color);
      }
      px(g, x - 1, y - 5, 3, 11, BINDING_COLOR.clasp);
      px(g, x - 4, y - 1, 9, 3, color);
    }
  }, banner ? 330 : 420);
}

function soulTrail(ax, ay, bx, by, ms) {
  const p = PAL;
  const [x0, y0] = at(ax, ay, 19), [x1, y1] = at(bx, by, 11);
  const d = Math.max(1, Math.hypot(x1 - x0, y1 - y0)), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
  S3.fxCustom((g, k) => {
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 7;
    const tail = Math.min(26, d * k);
    for (let i = 0; i < tail; i += 2) {
      const o = Math.sin(i * 0.31 - k * 8) * Math.min(6, i * 0.35);
      const sx = x - ux * i, sy = y - uy * i;
      px(g, sx + uy * o - 1, sy - ux * o - 1, 4, 4, INK);
      px(g, sx + uy * o, sy - ux * o, 2, 2, i < 10 ? p.l : i < 18 ? p.m : p.md);
      if (i < 16) {
        px(g, sx - uy * o - 1, sy + ux * o - 1, 3, 3, INK);
        px(g, sx - uy * o, sy + ux * o, 2, 2, p.m);
      }
    }
    // Outlined dark-element diamond head with abyssal core and magenta-violet rim
    for (let j = -5; j <= 5; j++) {
      const w = 5 - Math.abs(j);
      px(g, x - w - 1, y + j, 2 * w + 3, 1, INK);
      if (w >= 1) px(g, x - w, y + j, 2 * w + 1, 1, p.m);
      if (w >= 2) px(g, x - w + 1, y + j, 2 * w - 1, 1, "#12091f");
      if (w >= 3) px(g, x - w + 2, y + j, 2 * w - 3, 1, p.l);
    }
  }, ms);
}

/**
 * [불 Fire] 파이어볼 (`fx: 70`):
 * A hot core with a thin ember trail. At landing, leave the ring and a short spark fan.
 */
export function fireballOrb(ax, ay, bx, by, r = 30, audible = false) {
  const p = { m: "#ef6a32", al: "#ffc35c" };
  const dist = Math.hypot(bx - ax, by - ay);
  const flightMs = Math.max(110, Math.min(210, Math.round(dist * 1.35)));
  const [x0, y0] = at(ax, ay, 16), [x1, y1] = at(bx, by, 6);
  const d = Math.max(1, Math.hypot(x1 - x0, y1 - y0)), ux = (x1 - x0) / d, uy = (y1 - y0) / d, nx = -uy, ny = ux;
  S3.fxCustom((g, k) => {
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 10;
    const tailLen = Math.min(30, d * k);
    for (let i = 3; i < tailLen; i += 4) {
      const sway = Math.sin(i * 0.45 - k * 14) * (i < 14 ? 1.5 : 3);
      const tx = x - ux * i + nx * sway, ty = y - uy * i + ny * sway;
      g.globalAlpha = 1 - i / 35;
      pixelLine(g, tx, ty, tx - ux * 3, ty - uy * 3, i < 12 ? p.al : p.m, i < 12 ? 2 : 1);
    }
    g.globalAlpha = 1;
    for (let dy = -3; dy <= 3; dy++) {
      const w = 4 - Math.abs(dy);
      px(g, x - w, y + dy, w * 2 + 1, 1, dy > 1 ? p.m : p.al);
      if (Math.abs(dy) <= 1) px(g, x - 2, y + dy, 4, 1, "#fff5c8");
    }
  }, flightMs);

  later(flightMs, () => {
    S3.fx.flash(bx, by, 7, 0, 0.18);
    S3.fx.wave(bx, by, r, p.al, 220);
    shards(bx, by, r * 0.8, 7, 17, p.m, p.al, 230);
    if (audible) { S3.shake(2.1, Math.atan2(by - ay, bx - ax)); Sound.play("fireball_land"); }
  });
}

/** [불 Fire] 화상 장판 틱 (`b` kind 10): pixel ground embers and small flame tongues inside `r`. */
function fireBurnPatch(x, y, r = 30) {
  const p = PAL;
  rim(x, y, r, p.md, p.m, 260, 0.18);
  S3.fxCustom((g, k) => {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + (Math.round(x + y) % 5) * 0.3, d = r * (0.28 + (i % 3) * 0.24);
      const [sx, sy] = at(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.round(k * 9));
      const h = k < 0.65 ? 5 : 3;
      px(g, sx - 1, sy - h + 1, 2, h, p.m);
      px(g, sx, sy - h + 2, 1, Math.max(1, h - 2), p.al);
    }
  }, 260);
}

/**
 * [얼음 Ice] 서리 고리 (`fx: 71`):
 * Expanding r=56 frost ring with 12 jagged pixel ice crystal spikes jutting outward around the perimeter
 * and crisp hexagonal frost facets (#2b5c8f -> #7be0ff -> #dbfaff -> #ffffff).
 */
export function frostNovaRing(x, y, r = 56) {
  const p = PAL;
  S3.fx.flash(x, y, 10);
  S3.fx.wave(x, y, r, p.al, 360);
  rim(x, y, r, p.ad, "#ffffff", 430, 0.55);
  shards(x, y, r * 0.9, 12, 18, p.ad, p.al, 370, 30);
  S3.fxCustom((g, k) => {
    const grow = Math.min(1, k / 0.22);
    const fade = k < 0.72 ? 1 : (1 - k) / 0.28;
    g.globalAlpha = fade;
    // 12 jagged pixel glacier spikes around the r=56 ring
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rad = r * (0.35 + 0.62 * grow) * (i % 2 ? 0.86 : 1);
      const [ix, iy] = at(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 0);
      const tall = Math.max(4, Math.round((i % 2 ? 11 : 16) * grow));
      for (let row = 0; row < tall; row++) {
        const hw = Math.max(0, Math.round((1 - row / tall) * (i % 2 ? 2.5 : 3.5)));
        px(g, ix - hw - 1, iy - row - 1, hw * 2 + 3, 1, INK);
        px(g, ix - hw, iy - row - 1, hw * 2 + 1, 1, p.a);
        px(g, ix - hw, iy - row - 1, Math.max(1, hw), 1, row > tall * 0.6 ? "#ffffff" : p.al);
        if (hw >= 1) px(g, ix + hw, iy - row - 1, 1, 1, p.ad);
      }
      px(g, ix - 1, iy - tall - 1, 3, 1, INK);
    }
    // 6 inner ice crystal stars
    if (k < 0.68) {
      for (let i = 0; i < 6; i++) {
        const a = i * (Math.PI / 3) + 0.26, [sx, sy] = at(x + Math.cos(a) * r * 0.52 * grow, y + Math.sin(a) * r * 0.52 * grow, 4);
        px(g, sx - 1, sy - 4, 3, 9, INK); px(g, sx - 4, sy - 1, 9, 3, INK);
        px(g, sx, sy - 3, 1, 7, p.al); px(g, sx - 3, sy, 7, 1, p.al);
        px(g, sx, sy, 1, 1, "#ffffff");
      }
    }
    g.globalAlpha = 1;
  }, 420);
}

/**
 * [번개 Lightning] 연쇄 번개 (`ln: 4`):
 * INK-outlined jagged pixel lightning arc with forked branches and high-voltage yellow/cyan-blue flash.
 */
export function chainLightningArc(ax, ay, bx, by) {
  const p = PAL;
  const [x0, y0] = at(ax, ay, 10), [x1, y1] = at(bx, by, 10);
  const dx = x1 - x0, dy = y1 - y0, len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  S3.fxCustom((g, k) => {
    const segs = 7, pts = [[x0, y0]];
    const flicker = Math.floor(k * 12);
    for (let i = 1; i < segs; i++) {
      const u = i / segs;
      const jag = ((i * 5 + flicker * 3) % 7 - 3) * 2.4;
      pts.push([x0 + dx * u + nx * jag, y0 + dy * u + ny * jag]);
    }
    pts.push([x1, y1]);
    for (let i = 0; i < pts.length - 1; i++) {
      pixelLine(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], INK, 5);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      pixelLine(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], p.l, 3);
      pixelLine(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i % 2 ? "#ffffff" : p.a, 1);
      if (i % 2 === 1 && k < 0.7) {
        const side = i % 4 === 1 ? 1 : -1;
        const fx = pts[i][0] + ux * 7 + nx * side * 7, fy = pts[i][1] + uy * 7 + ny * side * 7;
        pixelLine(g, pts[i][0], pts[i][1], fx, fy, INK, 3);
        pixelLine(g, pts[i][0], pts[i][1], fx, fy, p.a, 1);
      }
    }
    // Electric impact star at (x1, y1)
    px(g, x1 - 2, y1 - 5, 5, 11, INK); px(g, x1 - 5, y1 - 2, 11, 5, INK);
    px(g, x1 - 1, y1 - 4, 3, 9, p.a); px(g, x1 - 4, y1 - 1, 9, 3, p.l);
    px(g, x1 - 1, y1 - 1, 3, 3, "#ffffff");
  }, 240);
}

/**
 * [암흑 Dark] 중력 왜곡진 (`fx: 92` + `pr`/`pp` `"grav"`):
 * Pixel-art abyssal singularity at (x, y) and inward-spiraling void shards + gravity chevrons across radius `r = 60`
 * (replaces the anti-aliased Canvas2D `g.arc` vortex).
 */
export function gravityWell(x, y, r = 60, ms = 4000) {
  const p = PAL;
  groundRing(x, y, r, ms, p.m, 0.08);
  S3.fxCustom((g, k) => {
    const t = k * ms, fade = Math.min(1, k * 10, (1 - k) * 8);
    const [cx, cy] = at(x, y, 0);
    g.globalAlpha = fade;
    // 1. Segmented pixel outer boundary ring at exact radius r = 60
    for (let i = 0; i < 48; i++) {
      if (i % 4 === 3) continue;
      const a = (i / 48) * Math.PI * 2 - t / 1800;
      const [bx, by] = at(x + Math.cos(a) * r, y + Math.sin(a) * r, 0);
      px(g, bx - 1, by, 2, 1, i % 4 === 0 ? p.l : i % 2 ? p.m : p.md);
    }
    // 2. Two inward-contracting pixel octagons + 8 inward suction chevrons showing pull toward center
    for (let ring = 0; ring < 2; ring++) {
      const u = ((t / 850 + ring * 0.5) % 1);
      const rad = r * (0.92 - 0.74 * u);
      for (let s = 0; s < 8; s++) {
        const a = s * (Math.PI / 4) + u * 1.8 + ring * 0.4;
        const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
        const [px0, py0] = at(x + ux * rad, y + uy * rad, 0);
        const [px1, py1] = at(x + ux * (rad + 5) + nx * 4, y + uy * (rad + 5) + ny * 4, 0);
        pixelLine(g, px0, py0, px1, py1, ring === 0 ? p.m : p.md, 1);
        px(g, px0 - 1, py0, 2, 1, p.l);
      }
    }
    // 3. 10 dark-matter pixel shards spiraling inward and getting crushed into the singularity
    for (let i = 0; i < 10; i++) {
      const u = ((t / 720 + i / 10) % 1);
      const d = r * 0.88 * (1 - u * 0.85), a = i * 1.884 + u * 3.6;
      const lift = Math.round(Math.sin(u * Math.PI) * 9);
      const [sx, sy] = at(x + Math.cos(a) * d, y + Math.sin(a) * d, lift);
      px(g, sx - 1, sy, 2, 1, i % 2 ? p.m : p.md);
      px(g, sx, sy - 1, 1, 1, p.l);
    }
    // 4. Central pixel black-hole core (abyssal void #12091f ringed by #b44cff and #f0c4ff)
    const pulse = Math.floor(t / 140) % 2;
    for (let dy = -5; dy <= 5; dy++) {
      const w = Math.max(2, 7 - Math.abs(dy));
      px(g, cx - w - 1, cy + dy, w * 2 + 2, 1, INK);
      px(g, cx - w, cy + dy, w * 2, 1, Math.abs(dy) >= 4 ? p.m : p.md);
      if (Math.abs(dy) <= 3) px(g, cx - w + 2, cy + dy, w * 2 - 4, 1, "#12091f");
    }
    px(g, cx - 6 - pulse, cy, 2, 1, p.l);
    px(g, cx + 5 + pulse, cy, 2, 1, p.l);
    px(g, cx, cy - 5 - pulse, 1, 2, p.l);
    px(g, cx, cy + 4 + pulse, 1, 2, p.l);
    g.globalAlpha = 1;
  }, ms, false);
}

/** [암흑 Dark] 중력 왜곡진 틱 파동 (`pp` `"grav"`): radial pixel pull streaks snapping into center. */
function gravityPulse(x, y, r = 60) {
  const p = PAL;
  rim(x, y, r * 0.82, p.md, p.l, 260, 0.25);
  S3.fxCustom((g, k) => {
    const [cx, cy] = at(x, y, 2);
    for (let i = 0; i < 8; i++) {
      const a = i * (Math.PI / 4) + 0.2;
      const d0 = r * 0.85 * (1 - k * 0.7), d1 = Math.max(4, d0 - 14);
      const [ax, ay] = at(x + Math.cos(a) * d0, y + Math.sin(a) * d0, 3);
      const [bx, by] = at(x + Math.cos(a) * d1, y + Math.sin(a) * d1, 2);
      pixelLine(g, ax, ay, bx, by, i % 2 ? p.l : p.m, 1);
    }
    px(g, cx - 3, cy - 2, 7, 5, INK);
    px(g, cx - 2, cy - 1, 5, 3, "#12091f");
  }, 250);
}

/**
 * [불+번개 Fire+Lightning] 원소 마검: 홍련참 (`fx: 97`):
 * Full width (`half = 20`, total 40px) dual-element crescent wave flying from (ax, ay) to (bx, by),
 * pairing a roaring crimson-gold flame edge with a coiling high-voltage yellow/cyan lightning wake.
 */
export function crimsonArcWave(ax, ay, bx, by, half = 20) {
  const p = PAL;
  const dist = Math.max(1, Math.hypot(bx - ax, by - ay));
  const ux = (bx - ax) / dist, uy = (by - ay) / dist, nx = -uy, ny = ux;
  const ang = Math.atan2(uy, ux), dur = Math.max(180, Math.min(320, Math.round(dist * 1.8)));
  S3.fxCustom((g, k) => {
    const wx = ax + (bx - ax) * k, wy = ay + (by - ay) * k;
    const [cx, cy] = at(wx, wy, 11), sa = S3.sAng(ux, uy);
    // 1. Coiling Fire + Lightning dual wake along the path
    const tailSteps = Math.min(12, Math.floor(k * 16));
    for (let s = 1; s <= tailSteps; s++) {
      const u = Math.max(0, k - s * 0.045);
      const tx0 = ax + (bx - ax) * u, ty0 = ay + (by - ay) * u;
      const boltOff = ((s * 5 + Math.floor(k * 20)) % 5 - 2) * (half * 0.35);
      const [lx, ly] = at(tx0 + nx * boltOff, ty0 + ny * boltOff, 10);
      const [fx, fy] = at(tx0 - nx * boltOff * 0.7, ty0 - ny * boltOff * 0.7, 8);
      px(g, fx - 2, fy - 2, 4, 4, INK);
      px(g, fx - 1, fy - 1, 2, 2, s < 5 ? p.m : p.a);
      px(g, lx - 2, ly - 2, 4, 4, INK);
      px(g, lx - 1, ly - 1, 2, 2, s % 2 ? p.m : p.a);
    }
    // 2. Full-width (half=20) outlined Fire + Lightning crescent blade
    for (let i = -9; i <= 9; i++) {
      const u = i / 9, a = sa + u * 1.18;
      const thick = Math.max(2, Math.round((1 - Math.abs(u) * 0.65) * 6));
      const rx = cx + Math.cos(a) * half, ry = cy + Math.sin(a) * half * 0.82;
      px(g, rx - (thick >> 1) - 1, ry - (thick >> 1) - 1, thick + 2, thick + 2, INK);
      px(g, rx - (thick >> 1), ry - (thick >> 1), thick, thick, i < 0 ? p.a : p.m);
      if (Math.abs(i) <= 4) px(g, rx - 1, ry - 1, 2, 2, p.l);
      // Lightning barbs crackling across the inner curve
      if (i % 3 === 0) {
        const ix = cx + Math.cos(a) * (half - 6), iy = cy + Math.sin(a) * (half - 6) * 0.82;
        pixelLine(g, rx, ry, ix, iy, INK, 3);
        pixelLine(g, rx, ry, ix, iy, i % 2 ? p.m : p.a, 1);
      }
    }
  }, dur);
}

/**
 * [활 관통 화살] (`fx: 94` muzzle cone):
 * Outlined pixel wind-shear shock rings and directional rails showing the `r = 8` (16px wide) high-velocity pierce corridor.
 */
export function pierceMuzzle(x, y, tx, ty) {
  const p = PAL;
  const ang = Math.atan2(ty - y, tx - x), ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  S3.fxCustom((g, k) => {
    const [sx, sy] = at(x + ux * 10, y + uy * 10, 11);
    const [ex, ey] = at(x + ux * (26 + k * 24), y + uy * (26 + k * 24), 11);
    // Double sonic compression rings around the bow nozzle
    for (const [dist, span] of [[6 + k * 8, 9], [14 + k * 14, 6]]) {
      const [rx, ry] = at(x + ux * dist, y + uy * dist, 11);
      for (let j = -span; j <= span; j += 2) {
        const px0 = rx + nx * j - ux * Math.abs(j) * 0.35;
        const py0 = ry + ny * j - uy * Math.abs(j) * 0.35;
        px(g, px0 - 1, py0 - 1, 3, 3, INK);
        px(g, px0, py0, 2, 2, Math.abs(j) <= 2 ? "#ffffff" : p.m);
      }
    }
    pixelLine(g, sx, sy, ex, ey, INK, 3);
    pixelLine(g, sx, sy, ex, ey, p.w, 1);
  }, 210);
}

/**
 * [활 도약 사격] (`ln: 8` vaulted backflip arc + wind feathers):
 * Replaces the flat ground line with an airborne pixel jump arc (`lift` up to 32px), launch dust ring, and wind-feather wake.
 */
export function leapShotArc(ax, ay, bx, by) {
  const p = PAL;
  rim(ax, ay, 18, p.ad, p.l, 240, 0.32);
  S3.fxCustom((g, k) => {
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      if (u > k * 1.5) break;
      const lift = 8 + Math.sin(u * Math.PI) * 32;
      const [sx, sy] = at(ax + (bx - ax) * u, ay + (by - ay) * u, lift);
      if (k > 0.65 && (i & 1)) continue;
      px(g, sx - 2, sy - 2, 5, 4, INK);
      px(g, sx - 1, sy - 1, 3, 2, i % 2 ? p.a : p.l);
      if (i % 3 === 0) px(g, sx, sy - 3, 2, 2, "#ffffff");
    }
  }, 340);
  later(160, () => rim(bx, by, 15, p.ad, p.a, 220, 0.25));
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
      g.drawImage(tinted(fr.img, "#3a2a58"), Math.round(sx - SP.FOOT[0]), Math.round(sy - SP.FOOT[1] + Math.sin(t / 220)), SP.SIZE, SP.SIZE);
      g.globalAlpha = 1;
    },
  });
}
/** The phantom beast of 심연의 계약: a hunched shape of dark smoke with two eyes, padding after its prey. */
function phantom(id, x, y, ms) {
  const p = PAL;
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
      rows.forEach(([a, b], j) => { const y = sy - 3 - j * 2 - breathe; px(g, sx + a + lean, y, b - a, 2, j > 5 ? p.md : p.d); });
      // wisps trailing off its back
      for (let i = 0; i < 4; i++) { const ph = (t / 600 + i / 4) % 1; g.globalAlpha = 1 - ph; px(g, sx - 9 - ph * 8, sy - 10 - i * 3 - ph * 6, 2, 2, p.md); }
      g.globalAlpha = 1;
      // the eyes: two hot pixels, flaring when it bites
      const eye = this.bite > t ? "#ffffff" : p.a;
      px(g, sx + 5 + lean, sy - 16 - breathe, 2, 1, eye); px(g, sx + 8 + lean, sy - 16 - breathe, 2, 1, eye);
      if (t - t0 < 300) { g.globalAlpha = 1 - (t - t0) / 300; px(g, sx - 12, sy - 22, 24, 22, p.m); g.globalAlpha = 1; }
    },
  });
}
/** A shadow trap: a small dark sigil on the ground, its corners blinking. */
function trap(id, x, y, ms) {
  const p = PAL;
  S3.props.set("pr" + id, {
    x, y, until: now() + ms,
    draw(g, t, sx, sy) {
      sx = Math.round(sx); sy = Math.round(sy);
      g.globalAlpha = 0.85;
      px(g, sx - 6, sy - 1, 13, 3, INK); px(g, sx - 4, sy - 2, 9, 5, INK);
      px(g, sx - 5, sy, 11, 1, p.md); px(g, sx - 3, sy - 1, 7, 3, p.md);
      const on = Math.sin(t / 200) > 0;
      for (const [dx, dy] of [[-6, 0], [6, 0], [0, -2], [0, 2]]) px(g, sx + dx, sy + dy, 1, 1, on ? p.l : p.md);
      g.globalAlpha = 1;
    },
  });
}
/** Arrows falling out of the sky over a round patch for `ms` (화살비). */
function arrowRain(x, y, r, ms) {
  const p = PAL;
  groundRing(x, y, r, ms, p.m, 0.1);
  const drops = Array.from({ length: 26 }, () => ({ a: Math.random() * 6.28, d: Math.sqrt(Math.random()) * r, ph: Math.random() }));
  S3.fxCustom((g, k) => {
    const t = k * ms;
    for (const o of drops) {
      const u = ((t / 340 + o.ph) % 1), [sx, sy] = at(x + Math.cos(o.a) * o.d, y + Math.sin(o.a) * o.d);
      const top = sy - 70 * (1 - u);
      if (u < 0.9) { px(g, sx, top - 6, 1, 6, p.w); px(g, sx - 1, top, 3, 1, p.al); }
      else { px(g, sx - 1, sy - 2, 1, 3, p.m); px(g, sx - 2, sy, 3, 1, p.md); }
    }
  }, ms);
}

/** A brass spear with a teal pennant marks the fixed point of the party's recovery area. */
function rallyPennant(o, id, ms) {
  const { x, y, r } = o, c = BANNER_COLOR, t0 = now();
  S3.fxCustom((g, k) => {
    if (placed.get(id) !== o) return;
    const a = Math.min(1, k * 55, (1 - k) * 10);
    g.globalAlpha = 0.05 * a;
    g.fillStyle = c.light;
    g.beginPath(); g.arc(x * P, y * P, r * P, 0, 7); g.fill();
    g.globalAlpha = 0.54 * a;
    for (let i = 0; i < 64; i++) {
      if (i % 8 > 4) continue;
      const arc = i * Math.PI / 32;
      px(g, (x + Math.cos(arc) * r) * P, (y + Math.sin(arc) * r) * P, 4, 4, i % 8 === 0 ? c.shine : c.light);
    }
  }, ms, true);
  S3.props.set("pr" + id, {
    x, y, until: t0 + ms,
    draw(g, t, sx, sy) {
      const top = sy - 27 - Math.round(Math.max(0, 1 - (t - t0) / 105) * 12);
      const lit = o.pulseUntil > t;
      const furl = Math.round(Math.sin((t - t0) / 140) * 2);
      g.globalAlpha = Math.min(1, Math.max(0, (this.until - t) / 170));
      px(g, sx - 4, sy - 1, 9, 3, INK); px(g, sx - 2, sy - 2, 5, 3, "#856543");
      px(g, sx - 1, top + 4, 4, sy - top - 4, INK);
      px(g, sx, top + 4, 2, sy - top - 4, c.metal);
      px(g, sx - 1, top - 2, 4, 8, INK); px(g, sx, top - 4, 2, 9, c.shine);
      for (let j = 0; j < 12; j++) {
        const width = 22 - Math.floor(j / 2) - (j > 8 ? 4 : 0) + furl;
        px(g, sx + 3, top + 6 + j, width, 1, j === 0 || j === 11 ? INK : j >= 8 ? c.shade : c.cloth);
        if (j > 0 && j < 11) px(g, sx + width + 2, top + 6 + j, 1, 1, INK);
      }
      const ink = lit ? c.shine : c.light;
      px(g, sx + 8, top + 8, 2, 7, ink); px(g, sx + 6, top + 10, 6, 3, ink);
    },
  });
}

function placeProp(G, B, f, id, kind, x, y, r, ms, eid) {
  const p = (PAL = jobPal(PROP_JOB[kind] || "adventurer"));
  placed.set(id, { kind, x, y, r, eid });
  if (placed.size > 60) placed.delete(placed.keys().next().value);
  switch (kind) {
    case "grav": {
      gravityWell(x, y, r, ms);
      break;
    }
    case "phantom": phantom(id, x, y, ms); f.burst(x, y, 0.4, p.md, 24, 1.8); f.ring(x, y, 22, p.m, 360, true); break;
    case "rain": arrowRain(x, y, r, ms); break;
    case "trap": trap(id, x, y, ms); break;
    case "pillar": groundRing(x, y, r, ms, p.l, 0.14); break;
    case "meteor": groundRing(x, y, r, ms, p.m, 0.12); break;
    case "storm": {
      groundRing(x, y, r, ms, p.l, 0.12);
      // a low spinning cloud over it
      S3.fxCustom((g, k) => {
        const t = k * ms, [cx, cy] = at(x, y, 34);
        for (let i = 0; i < 9; i++) { const a = t / 400 + (i / 9) * 6.28, ox = Math.cos(a) * r * 0.9, oy = Math.sin(a) * r * 0.3; g.globalAlpha = 0.55; px(g, cx + ox - 4, cy + oy - 2, 8, 4, i % 2 ? p.md : p.md); }
        g.globalAlpha = 1;
      }, ms);
      break;
    }
    case "field": {
      groundRing(x, y, r, ms, p.m, 0.18);
      S3.fxCustom((g, k) => {
        const t = k * ms;
        for (let i = 0; i < 12; i++) {
          const a = i * (Math.PI / 6) + t / 1800, [rx, ry] = at(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
          px(g, rx - 2, ry - 2, 4, 4, INK);
          px(g, rx - 1, ry - 1, 2, 2, i % 2 ? p.m : p.a);
        }
        for (let i = 0; i < 10; i++) {
          const ph = ((t / 650 + i / 10) % 1), a = i * 0.628;
          const [sx, sy] = at(x + Math.cos(a) * r * 0.76 * (1 - ph * 0.45), y + Math.sin(a) * r * 0.76 * (1 - ph * 0.45), 4 + ph * 20);
          g.globalAlpha = 1 - ph;
          px(g, sx - 1, sy - 1, 4, 5, INK);
          px(g, sx, sy, 2, 3, i % 2 ? p.m : p.a);
        }
        g.globalAlpha = 1;
      }, ms);
      break;
    }
    case "burst": {
      // the binding: a red sigil tightening on the ground until the blood bursts
      S3.fxCustom((g, k) => {
        const rr = r * P * (1 - 0.7 * k);
        g.globalAlpha = 0.7; g.strokeStyle = p.m; g.lineWidth = 4; g.setLineDash([16, 10]); g.lineDashOffset = k * 120;
        g.beginPath(); g.arc(x * P, y * P, rr, 0, 7); g.stroke();
        g.globalAlpha = 0.18; g.fillStyle = p.m; g.fill(); g.globalAlpha = 1;
      }, ms, true);
      break;
    }
    case "sanct": follow.set(id, { eid, r, until: now() + ms, t0: now() }); break;
    case "rune": runeCircle(placed.get(id), x, y, r, ms); break;
    case "banner": rallyPennant(placed.get(id), id, ms); break;
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
  const p = PAL;
  let beatT = -1e9;
  S3.fxCustom((g, k) => {
    const t = k * ms, a = Math.min(1, k * 10, (1 - k) * 8), R = r * P, cx = x * P, cy = y * P;
    if (o.beatNew) { o.beatNew = false; beatT = t; }
    const beat = Math.max(0, 1 - (t - beatT) / 340), col = ELEM_COL[o.el] || p.l;
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
  const p = (PAL = jobPal(PROP_JOB[o.kind] || "adventurer"));
  const canHear = o.eid === G.you || skillNear(G, x, y);
  const play = (key) => { if (canHear) Sound.play(key); };
  switch (o.kind) {
    case "grav": gravityPulse(x, y, o.r); f.sparkle(x, y, 0.3, p.m, 4); play("gravity_tick"); break;
    case "phantom": {
      const pr = S3.props.get("pr" + id);
      if (pr) { pr.tx = x; pr.ty = y; pr.bite = now() + 220; }
      const m = G.mobs.get(extra);
      if (m) { f.slash(m.x, m.y, Math.atan2(m.y - y, m.x - x), p.m, 0.9); f.slash(m.x, m.y, Math.atan2(m.y - y, m.x - x) + 0.6, p.a, 0.7, true); }
      play("phantom_bite");
      break;
    }
    case "pillar": {
      const last = extra === 1;
      B.fx.zap(x + rand(-10, 10), y + rand(-6, 6), p.l, 260);
      if (last) { B.fx.zap(x, y, "#ffffff", 360); B.fx.ring(x, y, o.r, p.l, 360, true); f.crack(x, y, o.r * 0.6, p.l, 600); B.shake(9); play("dragon_final"); }
      else play("bolt");
      break;
    }
    case "meteor": {
      // The server applies each meteor strike with this pulse. Show the crater and the falling trail together.
      const r = G.defs?.skills?.meteor?.hr || 30, flat = S3.fx;
      const [sx, sy] = at(x, y);
      castPfx(90, { x, y }, x, y, 0, 0, p, "impact");
      S3.fxCustom((g, k) => {
        const h = Math.round(72 * (1 - k)), w = Math.ceil(7 * (1 - k));
        for (let j = 0; j < h; j += 3) {
          const offset = -Math.floor(j / 7), width = Math.max(1, w - (j >> 4));
          px(g, sx + offset - width, sy - j - 2, width * 2, 3, j < 24 ? p.m : p.m);
          if (k < 0.42) px(g, sx + offset, sy - j - 2, 2, 3, p.l);
        }
      }, 145);
      flat.flash(x, y, 13, 0, 0.12);
      flat.wave(x, y, r, p.m, 260);
      flat.crack(x, y, r * 0.78, p.m, 400);
      shards(x, y, r, 7, 23, p.m, p.l, 270);
      if (canHear) B.shake(4);
      play("meteor_hit");
      break;
    }
    case "storm": B.fx.zap(x + rand(-o.r, o.r) * 0.7, y + rand(-o.r, o.r) * 0.5, p.l, 220); break;
    case "banner": {
      o.pulseUntil = now() + 250;
      S3.fx.wave(x, y, o.r, BANNER_COLOR.light, 330);
      rim(x, y, o.r, BANNER_COLOR.cloth, BANNER_COLOR.shine, 290, 0.19);
      break;
    }
    case "rune": {
      // the beat's element floods the circle (the flat drawing reads o.el), and shows in the air over it
      const el = extra >= 1 && extra <= 3 ? extra : 1, col = ELEM_COL[el];
      o.el = el; o.beatNew = true;
      S3.fx.wave(x, y, o.r, col, 340); S3.fx.wave(x, y, o.r * 0.6, "#ffffff", 260, 40);
      if (el === 1) { for (let i = 0; i < 5; i++) { const a = rand(0, 6.28), d = rand(0.2, 0.8) * o.r; f.burst(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 0.1, i % 2 ? p.m : p.m, 4, 1.6); } play("ember"); }
      else if (el === 2) { for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), d = rand(0.2, 0.85) * o.r; f.sparkle(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 0.2, i % 2 ? p.al : p.al, 3); } play("frost"); }
      else { for (let i = 0; i < 2; i++) { const a = rand(0, 6.28), d = rand(0.25, 0.75) * o.r; S3.fx.zap(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, p.l, 200, i * 70); } play("bolt"); }
      break;
    }
    case "burst": {
      B.fx.ring(x, y, o.r, p.m, 380, true);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; f.burst(x + Math.cos(a) * o.r * 0.5, y + Math.sin(a) * o.r * 0.5, 0.3, p.m, 6, 2.4); }
      B.shake(9); play("blood_burst");
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
  const p = (PAL = jobPal(PROP_JOB[o.kind] || "adventurer"));
  if (o.kind === "trap" && how === 1) {
    // sprung: a shadow of the tracker bursts out of the ground at it — three stabs and two shots
    const m = G.mobs.get(mid), tx = m ? m.x : o.x, ty = m ? m.y : o.y;
    f.burst(o.x, o.y, 0.2, p.md, 26, 2.2);
    for (let i = 0; i < 3; i++) setTimeout(() => f.slash(tx, ty, rand(0, 6.28), p.l, 0.9, i % 2 === 1), i * 90);
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
    const p = jobPal("darkknight");
    g.globalAlpha = 0.14 * a; g.fillStyle = p.d; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
    g.globalAlpha = 0.7 * a; g.strokeStyle = p.m; g.lineWidth = 2; g.setLineDash([6, 6]); g.lineDashOffset = -t / 40;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.stroke(); g.setLineDash([]);
    for (let i = 0; i < 6; i++) { const ph = ((t / 900 + i / 6) % 1), ang = i * 1.05; g.globalAlpha = a * (1 - ph); px(g, x + Math.cos(ang) * rx * 0.8, y + Math.sin(ang) * ry * 0.8 - ph * 22, 2, 3, p.a); }
    g.globalAlpha = 1;
  }
  // players at work: untouchable in the air, a staff's full resonance, the element a staff holds
  const people = [[G.me, true]];
  for (const p of G.players.values()) people.push([p, false]);
  for (const [p, me] of people) {
    const fl = p.fl | 0, [x, y] = at(p.x, p.y);
    if (fl & 4) { g.globalAlpha = 0.5 + 0.3 * Math.sin(t / 50); g.strokeStyle = "#e8e0ff"; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y - 12, 12, 16, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
    if (fl & 128) {
      const q = jobPal("wizard"), k = 0.5 + 0.5 * Math.sin(t / 160), hx = Math.round(x), hy = Math.round(y - 44 - k * 2);
      g.globalAlpha = 0.25 + 0.25 * k; g.fillStyle = q.m; g.beginPath(); g.ellipse(x, y - 14, 11, 15, 0, 0, 7); g.fill();
      g.globalAlpha = 1; px(g, hx - 1, hy - 3, 3, 7, INK); px(g, hx - 3, hy - 1, 7, 3, INK);
      px(g, hx, hy - 2, 1, 5, q.l); px(g, hx - 2, hy, 5, 1, q.l); px(g, hx, hy, 1, 1, k > 0.5 ? "#ffffff" : q.a);
    }
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

/**
 * 양손해머 예비 동작 (Phase 1: Wind-up target brace on the ground before `hm` lands):
 * 4 open corner brackets contracting onto exact radius `r` + a directional approach tick along `-ang`.
 * Keeps the ground interior open so boss telegraphs (`bt`/`t`) are never obscured.
 */
export function hammerWindup(x, y, r = 28, windMs = 200, ang = 0) {
  const dur = Math.max(90, Math.min(450, windMs || 200));
  S3.fxCustom((g, k) => {
    const rad = r * (1.12 - 0.12 * k);
    // 4 contracting corner brackets around radius `r`
    for (let c = 0; c < 4; c++) {
      const aMid = ang + c * (Math.PI / 2) + Math.PI / 4;
      for (let j = -2; j <= 2; j++) {
        const a = aMid + j * 0.09;
        const [gx, gy] = at(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 0);
        px(g, gx - 2, gy - 1, 4, 3, INK);
        px(g, gx - 1, gy, 2, 1, j === 0 ? "#fff4ce" : "#d8b888");
      }
    }
    // Directional approach shadow tick from caster toward landing center (x, y)
    const [cx, cy] = at(x, y, 0);
    const [bx, by] = at(x - Math.cos(ang) * r * (0.65 * (1 - k)), y - Math.sin(ang) * r * (0.65 * (1 - k)), 0);
    pixelLine(g, bx, by, cx, cy, INK, 3);
    pixelLine(g, bx, by, cx, cy, "#ffe7a5", 1);
    px(g, cx - 2, cy - 1, 5, 3, INK);
    px(g, cx - 1, cy, 3, 1, "#fff4ce");
  }, dur);
}

/**
 * 3-plane pixel stone chunks (22-materials-hard.md Rule 10) bursting from landing center (x, y) toward radius `r`,
 * then settling as thin stone chips that fade at ground level.
 */
function stoneDebris(x, y, r, count, ang, topCol, midCol, dur) {
  S3.fxCustom((g, k) => {
    const settle = k >= 0.58;
    g.globalAlpha *= Math.min(1, (1 - k) * 2.6);
    for (let i = 0; i < count; i++) {
      // Bias half the stones into the forward hemisphere along `ang` so attack direction reads clearly
      const a = ang + (i - (count - 1) / 2) * (Math.PI * 1.45 / Math.max(1, count - 1)) + (i % 2 ? 0.18 : -0.18);
      const distU = 0.34 + ((i * 3) % 5) * 0.12;
      const reach = r * distU * Math.min(1, k * 1.45);
      const lift = settle
        ? Math.max(0, Math.round(Math.sin(((k - 0.58) / 0.42) * Math.PI) * 4))
        : Math.round(Math.sin((k / 0.58) * Math.PI) * (14 + (i % 3) * 5));
      const [sx, sy] = at(x + Math.cos(a) * reach, y + Math.sin(a) * reach, lift);
      if (settle) {
        if (k > 0.84 && (i & 1)) continue;
        px(g, sx - 1, sy, 2, 1, midCol);
      } else {
        const w = i % 3 === 0 ? 4 : 3, tilt = i % 2 ? 1 : -1;
        px(g, sx - 1, sy, w, 1, midCol);
        px(g, sx - 1 + tilt, sy - 1, w - 1, 1, topCol);
      }
    }
  }, dur);
}

/**
 * 양손해머 착지 충격 (Phase 2: Impact ground ripple + stone debris -> Phase 3: Dissipation settle):
 * Expanding segmented pixel ground ripples starting from the landing point (x, y) out to `r`,
 * directional forward wave emphasis, 3-plane stone debris, and stepped radial ground cracks.
 */
export function hammerImpact(x, y, r, hit, crit, kind, ang = 0) {
  const stamp = kind === 130, fault = kind === 131, final = kind === 132;
  const f = S3.fx;
  const col = crit ? "#ffdc75" : final ? "#f3a567" : fault ? "#ffc05c" : stamp ? "#c9e6e5" : hit ? "#e4be83" : "#a98c6d";
  const edge = fault ? "#a65a30" : stamp ? "#678d94" : "#8d7159";
  const [cx, cy] = at(x, y);
  const dur = final ? 410 : 285;

  // Outward ground ripples starting from landing point (x, y) -> exact radius `r` (open segments, never hiding boss telegraphs)
  S3.fxCustom((g, k) => {
    const inImpact = k < 0.56;
    const prog = inImpact ? 0.16 + 0.84 * (1 - (1 - k / 0.56) ** 2.4) : 1;
    for (const [ringScale, segs] of [[1, 8], [0.64, 6]]) {
      if (!inImpact && ringScale < 1) continue;
      const rad = r * ringScale * prog;
      for (let s = 0; s < segs; s++) {
        const aMid = ang + (s / segs) * Math.PI * 2;
        const isFront = Math.cos(aMid - ang) > 0.35;
        const span = (inImpact ? (isFront ? 0.24 : 0.18) : 0.10 * (1 - (k - 0.56) / 0.44));
        const steps = Math.max(2, Math.ceil(rad * span * 0.45));
        for (let j = -steps; j <= steps; j++) {
          const a = aMid + (j / steps) * span;
          const [gx, gy] = at(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 0);
          const sz = inImpact && isFront ? 3 : 2;
          px(g, gx, gy, sz, Math.max(1, sz - 1), inImpact && (isFront || Math.abs(j) <= 1) ? "#fff4ce" : col);
          if (inImpact) px(g, gx, gy + sz - 1, sz, 1, edge);
        }
      }
    }
  }, dur);

  // 3-plane pixel stone debris bursting from (x, y) and settling near `r`
  const rockCount = final ? 8 : (stamp || fault) ? 6 : hit ? 5 : 3;
  stoneDebris(x, y, r, rockCount, ang, stamp ? "#dff7f4" : "#fff4ce", edge, dur);

  f.burst(x, y, 0.08, col, final ? 14 : hit ? 7 : 4, final ? 1.9 : 1.1);
  if (hit && (stamp || fault || final)) {
    shards(x, y, r * 0.78, final ? 8 : 5, final ? 24 : 16, edge, col, final ? 340 : 240, 12);
  }

  // Stepped radial ground cracks starting at (x, y): dark crevice body, lighter pixel at the crack tip (Rule 12)
  const arms = final ? 8 : fault ? 7 : stamp ? 4 : 5, shift = ((Math.round(x) + Math.round(y)) % 7) * Math.PI / 7;
  S3.fxCustom((g, k) => {
    if (k < 0.16) {
      // Single compact landing contact star at (cx, cy)
      for (let row = -2; row <= 2; row++) {
        const w = (final ? 6 : 4) - Math.abs(row);
        px(g, cx - w, cy + row, 1 + w * 2, 1, "#fff4ce");
      }
    }
    const extent = r * Math.min(0.9, 0.22 + 4.8 * k);
    for (let i = 0; i < arms; i++) {
      const a = shift + (i / arms) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
      const armLen = Math.floor(extent * (i % 2 ? 0.74 : 1));
      for (let j = 2; j <= armLen; j += 2) {
        if (k > 0.58 && ((i + j) % 3 === 0 || j / Math.max(1, armLen) < (k - 0.58) * 1.9)) continue;
        const bend = j < 5 ? 0 : (i % 2 ? -1 : 1) * (j < 9 ? 1.2 : 0.6);
        const [sx, sy] = at(x + ux * j - uy * bend, y + uy * j + ux * bend);
        const isTip = j >= armLen - 2;
        px(g, sx, sy + 1, 2, 1, "#604940");
        px(g, sx, sy, 2, 1, isTip ? "#fff4ce" : k < 0.35 ? col : "#604940");
      }
    }
  }, dur);
}

/** Standalone helper for previewing or invoking the full 3-phase hammer blow (wind-up -> impact -> settle). */
export function meleeHammerSlam(x, y, r = 28, windMs = 200, kind = 130, ang = 0) {
  if (windMs > 0) {
    hammerWindup(x, y, r, windMs, ang);
    later(windMs, () => hammerImpact(x, y, r, true, false, kind, ang));
  } else {
    hammerImpact(x, y, r, true, false, kind, ang);
  }
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

/** Recent plain telegraph rings ("t") from the current snapshot tick, read by boss pattern cues ("bc") that follow. */
const recentTele = [];

/**
 * 꽃무덤 고래 (bloomwhale) dive and resurface:
 * - Dive (0..ms): petals and ripples curling inward into the floor around the departure and landing rings,
 *   while keeping the outer danger boundary and 8 escape chevrons unobstructed.
 * - Resurface (at ms - 60): splitting/fracturing outward ground ripples and vertical pixel splash columns + petals.
 */
export function bloomwhaleDive(sx, sy, tx, ty, r = 70, ms = 1800) {
  const moved = Math.hypot(tx - sx, ty - sy) > 22;
  // 1. Dive stage (0..ms): inward-curling spiral ripples + petals sinking into the floor,
  //    while the r=70 outer warning boundary and 8 outward dodge chevrons stay crisp and unobstructed.
  S3.fxCustom((g, k) => {
    const fade = Math.min(1, k * 8, (1 - k) * 9);
    // Departure vortex where the whale sinks into the floor
    if (moved && k < 0.58) {
      const dk = k / 0.58;
      g.globalAlpha = (1 - dk) * 0.9;
      for (let ring = 0; ring < 2; ring++) {
        const u = (dk * 2.2 + ring * 0.5) % 1, rr = 30 * (1 - u * 0.82);
        for (let seg = 0; seg < 6; seg++) {
          const a0 = seg * 1.047 + u * 2.8;
          for (let j = 0; j < 6; j++) {
            const a = a0 + j * 0.08, rad = Math.max(2, rr - j * 1.3);
            const [wx, wy] = at(sx + Math.cos(a) * rad, sy + Math.sin(a) * rad, 0);
            px(g, wx - 2, wy - 1, 4, 3, INK);
            px(g, wx - 1, wy, 2, 1, j === 0 ? "#e0ffff" : ring % 2 ? "#ff5ad8" : "#7ff6ff");
          }
        }
      }
    }
    // Dark abyssal sinkhole at the center of the landing zone (well inside the outer boundary)
    const [cx0, cy0] = at(tx, ty, 0), sinkW = Math.round(12 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5));
    g.globalAlpha = 0.85 * fade;
    for (let dy = -3; dy <= 3; dy++) {
      const w = Math.max(2, sinkW - Math.abs(dy) * 3);
      px(g, cx0 - w - 1, cy0 + dy, w * 2 + 2, 1, INK);
      px(g, cx0 - w, cy0 + dy, w * 2, 1, "#0c1016");
    }
    // Inward-contracting spiral ripples (바닥으로 말려드는 파문, kept inside 0.12*r .. 0.78*r)
    for (let ring = 0; ring < 3; ring++) {
      const u = (k * 2.6 + ring / 3) % 1, rr = r * (0.78 - 0.64 * u);
      g.globalAlpha = Math.sin(u * Math.PI) * 0.95 * fade;
      for (let seg = 0; seg < 8; seg++) {
        const a0 = seg * (Math.PI / 4) + u * 3.0 + ring * 0.45;
        for (let j = 0; j < 8; j++) {
          const a = a0 + j * 0.055, rad = Math.max(4, rr - j * 1.35);
          const [wx, wy] = at(tx + Math.cos(a) * rad, ty + Math.sin(a) * rad, 0);
          px(g, wx - 2, wy - 1, 4, 3, INK);
          px(g, wx - 1, wy, 2, 1, j < 2 ? "#e0ffff" : (seg + ring) % 2 ? "#7ff6ff" : "#ff5ad8");
        }
      }
    }
    // Unobstructed outer warning boundary dashes at exact radius r + 8 outward escape chevrons (피할 방향)
    g.globalAlpha = 0.96;
    for (let i = 0; i < 64; i++) {
      if (i % 4 === 3) continue;
      const a = (i / 64) * Math.PI * 2;
      const [bx, by] = at(tx + Math.cos(a) * r, ty + Math.sin(a) * r, 0);
      px(g, bx - 2, by - 2, 4, 4, INK);
      px(g, bx - 1, by - 1, 2, 2, i % 8 === 0 ? "#ffffff" : i % 2 ? "#ffe08a" : "#7ff6ff");
    }
    const push = ((k * 5) % 1) * 6;
    for (let i = 0; i < 8; i++) {
      const a = i * (Math.PI / 4), ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
      const [tipX, tipY] = at(tx + ux * (r + 8 + push), ty + uy * (r + 8 + push), 0);
      for (const s of [-1, 1]) {
        const [wx, wy] = at(tx + ux * (r + 3 + push) + nx * s * 4.5, ty + uy * (r + 3 + push) + ny * s * 4.5, 0);
        pixelLine(g, tipX, tipY, wx, wy, INK, 3);
        pixelLine(g, tipX, tipY, wx, wy, "#ffe08a", 1);
      }
      px(g, tipX - 1, tipY - 1, 3, 3, "#ffffff");
    }
    // Spirit-flower petals swirling inward and downward into the floor (바닥으로 말려드는 꽃잎)
    const drawPetals = (ox, oy, count, maxR, alpha) => {
      g.globalAlpha = alpha;
      for (let i = 0; i < count; i++) {
        const u = (k * 2.3 + i / count) % 1;
        const d = maxR * (0.76 * (1 - u * 0.88)), a = i * 2.39996 + u * 4.5;
        const lift = Math.round(28 * (1 - u) * (1 - u));
        const [px0, py0] = at(ox + Math.cos(a) * d, oy + Math.sin(a) * d, lift);
        const [tx0, ty0] = at(ox + Math.cos(a - 0.18) * (d + 3.5), oy + Math.sin(a - 0.18) * (d + 3.5), lift + 3);
        const [tx1, ty1] = at(ox + Math.cos(a - 0.34) * (d + 6.5), oy + Math.sin(a - 0.34) * (d + 6.5), lift + 5);
        px(g, tx1 - 1, ty1 - 1, 2, 2, INK); px(g, tx1, ty1, 1, 1, "#7ff6ff");
        px(g, tx0 - 1, ty0 - 1, 3, 3, INK); px(g, tx0, ty0, 2, 2, i % 2 ? "#7ff6ff" : "#ff5ad8");
        px(g, px0 - 2, py0 - 2, 5, 4, INK);
        px(g, px0 - 1, py0 - 3, 3, 6, INK);
        px(g, px0 - 1, py0 - 1, 3, 2, "#ff5ad8");
        px(g, px0, py0 - 2, 2, 4, i % 3 === 0 ? "#7ff6ff" : "#ff5ad8");
        px(g, px0, py0 - 1, 1, 1, "#ffd0f4");
      }
    };
    if (moved && k < 0.56) drawPetals(sx, sy, 8, 34, 1 - k / 0.56);
    drawPetals(tx, ty, 16, r, fade);
    g.globalAlpha = 1;
  }, ms, false);

  // 2. Resurface & afterimage stage (starts at ms - 60, lasts 740 ms):
  //    splitting outward ground ripples (갈라지는 파문) + upward-splashing pixel columns & droplets (위로 튀는 픽셀)
  const delay = Math.max(0, ms - 60), rDur = 740;
  later(delay, () => {
    S3.fx.wave(tx, ty, r, "#7ff6ff", 380);
    rim(tx, ty, r, "#0c1016", "#e0ffff", 460, 0.22);
    shards(tx, ty, r * 0.82, 12, 36, "#0c1016", "#7ff6ff", 460, 0);
  });
  S3.fxCustom((g, k) => {
    const fade = k < 0.65 ? 1 : (1 - k) / 0.35;
    const prog = 1 - (1 - Math.min(1, k * 1.45)) ** 3;
    g.globalAlpha = fade;
    // Splitting ground ripples (갈라지는 파문): 8 fractured arc wedges breaking outward with widening angular gaps
    for (let seg = 0; seg < 8; seg++) {
      const span = Math.max(0.11, 0.26 * (1 - k * 0.45)), aMid = seg * (Math.PI / 4);
      // Short radial fracture ticks at the split edges where each ripple segment breaks apart
      if (k < 0.62) {
        for (const edge of [-1, 1]) {
          const aEdge = aMid + edge * (span + 0.04), r0 = r * (0.24 + 0.62 * prog), r1 = r0 + 9;
          const [fx0, fy0] = at(tx + Math.cos(aEdge) * r0, ty + Math.sin(aEdge) * r0, 0);
          const [fx1, fy1] = at(tx + Math.cos(aEdge) * r1, ty + Math.sin(aEdge) * r1, 0);
          pixelLine(g, fx0, fy0, fx1, fy1, INK, 3);
          pixelLine(g, fx0, fy0, fx1, fy1, edge > 0 ? "#e0ffff" : "#ff5ad8", 1);
        }
      }
      for (const [mult, col, hi] of [[0.28 + 0.74 * prog, "#7ff6ff", "#e0ffff"], [0.16 + 0.62 * prog, "#ff5ad8", "#ffd0f4"]]) {
        const rr = r * mult + (seg % 2 ? 4 : -3);
        for (let j = -6; j <= 6; j++) {
          if (k > 0.58 && (j + seg) % 2 !== 0) continue;
          const a = aMid + (j / 6) * span;
          const [wx, wy] = at(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, 0);
          px(g, wx - 2, wy - 2, 5, 4, INK);
          px(g, wx - 1, wy - 1, 3, 2, Math.abs(j) <= 2 ? hi : col);
        }
      }
    }
    // Outer r boundary ring kept crisp through impact and afterimage
    for (let i = 0; i < 64; i++) {
      if (i % 2 === 1) continue;
      const a = (i / 64) * Math.PI * 2;
      const [bx, by] = at(tx + Math.cos(a) * r, ty + Math.sin(a) * r, 0);
      px(g, bx - 2, by - 2, 4, 4, INK);
      px(g, bx - 1, by - 1, 2, 2, k < 0.35 ? "#ffffff" : i % 4 === 0 ? "#ff5ad8" : "#7ff6ff");
    }
    // Segmented vertical pixel splash columns shooting straight upward (위로 튀는 픽셀)
    if (k < 0.68) {
      const ck = k / 0.68, arch = Math.sin(ck * Math.PI);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.15, d = r * (0.2 + (i % 3) * 0.2);
        const [sx0, sy0] = at(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0);
        const hCol = Math.max(6, Math.round((22 + (i % 3) * 9) * arch)), baseLift = Math.round(ck * 10);
        for (let step = 0; step < hCol; step += 4) {
          const w = step > hCol * 0.6 ? 2 : 3, yy = sy0 - baseLift - step;
          px(g, sx0 - 2, yy - 3, w + 2, 4, INK);
          px(g, sx0 - 1, yy - 2, w, 2, step > hCol * 0.65 ? "#e0ffff" : i % 3 === 0 ? "#ff5ad8" : "#7ff6ff");
        }
        px(g, sx0 - 1, sy0 - baseLift - hCol - 3, 3, 3, INK);
        px(g, sx0, sy0 - baseLift - hCol - 2, 2, 2, "#ffffff");
      }
    }
    // 22 upward-splashing pixel droplets & petals rising high and settling in the afterimage
    for (let i = 0; i < 22; i++) {
      const a = i * 1.7136 + 0.3, d = r * (0.14 + ((i * 7) % 11) * 0.07) * (0.52 + 0.52 * k);
      const peak = 28 + (i % 4) * 8, lift = Math.max(2, Math.round(peak * 4 * k * (1 - k * 0.72)));
      const [px0, py0] = at(tx + Math.cos(a) * d, ty + Math.sin(a) * d, lift);
      const isPetal = i % 3 === 0;
      px(g, px0 - 2, py0 - 2, 5, 5, INK);
      px(g, px0 - 1, py0 - 1, 3, 3, isPetal ? "#ff5ad8" : "#7ff6ff");
      px(g, px0, py0 - 2, 2, 2, isPetal ? "#ffd0f4" : "#e0ffff");
      if (k < 0.58) {
        px(g, px0 - 1, py0 + 3, 3, 3, INK);
        px(g, px0, py0 + 3, 2, 2, isPetal ? "#ff5ad8" : "#7ff6ff");
      }
    }
    g.globalAlpha = 1;
  }, rDur, false, delay);
}

/**
 * 혈루 왕도마뱀 (bloodhorn) 혈루 사출 (jet):
 * - Ground warning & escape guide: crisp outer boundary ticks around the 5 circles + lateral corridor rails +
 *   perpendicular sidestep chevrons so the danger boundary and dodge direction remain visible throughout.
 * - Stream & short splatters: bright central directional stream (INK -> #6a0e1e -> #ff3b3b -> #ffb0a0 -> #ffffff)
 *   with forward-pointing chevron pulses and short lateral blood splatters (짧은 비산), followed by a crimson afterimage.
 */
export function bloodhornJet(x0, y0, pts, r = 13, ms = 900) {
  const list = pts && pts.length ? pts : [1, 2, 3, 4, 5].map((j) => [x0 + j * 28, y0]);
  const last = list[list.length - 1], dx0 = last[0] - x0, dy0 = last[1] - y0, len = Math.hypot(dx0, dy0) || 140;
  const ux = dx0 / len, uy = dy0 / len, nx = -uy, ny = ux;
  const hx = x0 + ux * 12, hy = y0 + uy * 12, ex = last[0] + ux * 6, ey = last[1] + uy * 6;
  const totalMs = ms + 420;

  S3.fxCustom((g, k) => {
    const tMs = k * totalMs, inWarn = tMs <= ms, wk = Math.min(1, tMs / ms);
    const fade = inWarn ? 1 : Math.max(0, 1 - (tMs - ms) / 420);
    g.globalAlpha = 0.96 * fade;
    // 1. Unobstructed outer boundary dashes on each of the 5 telegraph circles (leaves the interior ring clear)
    for (let idx = 0; idx < list.length; idx++) {
      const [cx, cy] = list[idx];
      for (let i = 0; i < 16; i++) {
        if (i % 4 === 3) continue;
        const a = (i / 16) * Math.PI * 2;
        const [bx, by] = at(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0);
        px(g, bx - 2, by - 2, 4, 4, INK);
        px(g, bx - 1, by - 1, 2, 2, i % 4 === 0 ? "#ffffff" : "#ffe08a");
      }
    }
    // Parallel outer corridor boundary rails at ±(r + 2) world units
    const steps = 20;
    for (const side of [-1, 1]) {
      for (let i = 0; i <= steps; i++) {
        if (i % 2 === 1) continue;
        const u = i / steps;
        const wx = hx + (ex - hx) * u + nx * side * (r + 2), wy = hy + (ey - hy) * u + ny * side * (r + 2);
        const [sx0, sy0] = at(wx, wy, 0);
        px(g, sx0 - 2, sy0 - 1, 4, 3, INK);
        px(g, sx0 - 1, sy0, 2, 1, inWarn ? "#ffb04a" : "#ff6a5a");
      }
    }
    // Perpendicular sidestep chevrons (< and >) outside the lane showing exact dodge direction (피할 방향)
    if (inWarn) {
      const shift = ((wk * 6) % 1) * 4;
      for (const idx of [0, 2, list.length - 1]) {
        const [cx, cy] = list[idx];
        for (const side of [-1, 1]) {
          const [tipX, tipY] = at(cx + nx * side * (r + 9 + shift), cy + ny * side * (r + 9 + shift), 0);
          for (const arm of [-1, 1]) {
            const [ax0, ay0] = at(cx + nx * side * (r + 4 + shift) + ux * arm * 4, cy + ny * side * (r + 4 + shift) + uy * arm * 4, 0);
            pixelLine(g, tipX, tipY, ax0, ay0, INK, 3);
            pixelLine(g, tipX, tipY, ax0, ay0, "#ffe08a", 1);
          }
          px(g, tipX - 1, tipY - 1, 3, 3, "#ffffff");
        }
      }
    } else {
      // Ground afterimage: cooling crimson blood seam down the center axis
      for (let i = 0; i <= 24; i++) {
        if (i % 2 === 1 && fade < 0.5) continue;
        const u = i / 24, [sx0, sy0] = at(hx + (ex - hx) * u, hy + (ey - hy) * u, 0);
        px(g, sx0 - 2, sy0 - 1, 4, 3, INK);
        px(g, sx0 - 1, sy0, 2, 1, i % 3 === 0 ? "#ff6a5a" : "#6a0e1e");
      }
    }

    // 2. Stream & short splatters layer:
    const [ax, ay] = at(hx, hy, 9), [bxAll, byAll] = at(ex, ey, 3);
    const sdx = bxAll - ax, sdy = byAll - ay, slen = Math.hypot(sdx, sdy) || 1;
    const sux = sdx / slen, suy = sdy / slen, snx = -suy, sny = sux;

    // Stage A (0..380 ms): Warning sight-line with fast directional chevrons from bloodhorn's eyes
    if (tMs < 380) {
      const wProg = tMs / 380;
      g.globalAlpha = 1;
      pixelLine(g, ax, ay, bxAll, byAll, INK, 3);
      pixelLine(g, ax, ay, bxAll, byAll, "#ff3b3b", 1);
      px(g, ax - 3, ay - 3, 7, 7, INK); px(g, ax - 2, ay - 2, 5, 5, "#ff3b3b"); px(g, ax - 1, ay - 1, 3, 3, "#ffffff");
      for (let m = 0; m < 5; m++) {
        const u = ((wProg * 2.8 + m / 5) % 1), cx = ax + sdx * u, cy = ay + sdy * u;
        for (const s of [-1, 1]) {
          pixelLine(g, cx + sux * 2, cy + suy * 2, cx - sux * 5 + snx * s * 4, cy - suy * 5 + sny * s * 4, INK, 3);
          pixelLine(g, cx + sux * 2, cy + suy * 2, cx - sux * 5 + snx * s * 4, cy - suy * 5 + sny * s * 4, "#ffb0a0", 1);
        }
        px(g, cx - 1, cy - 1, 3, 3, "#ffffff");
      }
      return;
    }

    // Stage B (380..960 ms): High-pressure bright central blood stream + directional chevron pulses + short lateral splatters
    if (tMs <= 960) {
      const jk = (tMs - 380) / 580, reach = Math.min(1, jk * 4.5);
      const bx = ax + sdx * reach, by = ay + sdy * reach;
      g.globalAlpha = 1;
      // Bright central stream (뻗는 방향이 한눈에 읽히는 밝은 중심 줄기)
      pixelLine(g, ax, ay, bx, by, INK, 7);
      pixelLine(g, ax, ay, bx, by, "#6a0e1e", 5);
      pixelLine(g, ax, ay, bx, by, "#ff3b3b", 3);
      pixelLine(g, ax, ay, bx, by, "#ffb0a0", 2);
      pixelLine(g, ax, ay, bx, by, "#ffffff", 1);
      // Nozzle flare at bloodhorn's eyes
      px(g, ax - 4, ay - 4, 8, 8, INK); px(g, ax - 3, ay - 3, 6, 6, "#ff3b3b"); px(g, ax - 2, ay - 2, 4, 4, "#ffffff");
      // Directional chevron barbs along the stream so the firing direction reads at a glance
      for (let m = 0; m < 5; m++) {
        const u = ((jk * 3.4 + m / 5) % 1) * reach;
        const cx = ax + sdx * u, cy = ay + sdy * u;
        for (const s of [-1, 1]) {
          pixelLine(g, cx + sux * 3, cy + suy * 3, cx - sux * 5 + snx * s * 5, cy - suy * 5 + sny * s * 5, INK, 3);
          pixelLine(g, cx + sux * 3, cy + suy * 3, cx - sux * 5 + snx * s * 5, cy - suy * 5 + sny * s * 5, "#ffb0a0", 1);
        }
        px(g, cx - 1, cy - 1, 3, 3, "#ffffff");
      }
      // Spearhead tip at the front of the jet
      for (const s of [-1, 1]) {
        pixelLine(g, bx + sux * 4, by + suy * 4, bx - sux * 6 + snx * s * 6, by - suy * 6 + sny * s * 6, INK, 4);
        pixelLine(g, bx + sux * 4, by + suy * 4, bx - sux * 6 + snx * s * 6, by - suy * 6 + sny * s * 6, "#ff3b3b", 2);
      }
      px(g, bx - 2, by - 2, 4, 4, "#ffffff");

      // Short lateral splatters (짧은 비산) at each reached circle node, kept tight inside the r=13 boundary
      for (let idx = 0; idx < list.length; idx++) {
        if ((idx + 1) / list.length > reach + 0.1) continue;
        const [nx0, ny0] = at(list[idx][0], list[idx][1], 5);
        const burst = ((jk * 4 + idx * 0.23) % 1);
        for (const side of [-1, 1]) {
          for (const [fMul, sMul] of [[3.2, 6.8], [-1.8, 5.2]]) {
            const d = 0.55 + burst * 0.65;
            const sx1 = nx0 + (sux * fMul + snx * side * sMul) * d;
            const sy1 = ny0 + (suy * fMul + sny * side * sMul) * d - (1 - burst) * 3;
            pixelLine(g, nx0 + snx * side * 2, ny0 + sny * side * 2, sx1, sy1, INK, 3);
            pixelLine(g, nx0 + snx * side * 2, ny0 + sny * side * 2, sx1, sy1, "#ff3b3b", 1);
            px(g, sx1 - 2, sy1 - 2, 4, 4, INK);
            px(g, sx1 - 1, sy1 - 1, 2, 2, side > 0 ? "#ffb0a0" : "#ff6a5a");
          }
        }
      }
      return;
    }

    // Stage C (960..1320 ms): Afterimage (잔상) — broken crimson droplets settling along the jet axis
    const ak = (tMs - 960) / (totalMs - 960), aFade = Math.max(0, 1 - ak);
    g.globalAlpha = aFade;
    const drop = Math.round(ak * 5);
    for (let i = 0; i <= 26; i++) {
      if ((i + Math.floor(ak * 8)) % 2 === 1) continue;
      const u = i / 26, cx = ax + sdx * u, cy = ay + sdy * u + drop;
      px(g, cx - 2, cy - 2, 4, 4, INK);
      px(g, cx - 1, cy - 1, 2, 2, i % 3 === 0 ? "#ffb0a0" : i % 2 ? "#ff3b3b" : "#6a0e1e");
    }
    for (let idx = 0; idx < list.length; idx++) {
      const [nx0, ny0] = at(list[idx][0], list[idx][1], Math.max(1, 5 - drop));
      for (const side of [-1, 1]) {
        const sx1 = nx0 + snx * side * (5 + ak * 3), sy1 = ny0 + sny * side * (5 + ak * 3);
        px(g, sx1 - 2, sy1 - 2, 4, 4, INK);
        px(g, sx1 - 1, sy1 - 1, 2, 2, "#ff3b3b");
      }
    }
    g.globalAlpha = 1;
  }, totalMs, false);
}

export function skillEvent(e, ctx) {
  if (e[0] === "cb" || (e[0] === "a" && e[2] >= 140 && e[2] <= 159)) return comboEvent(e, ctx);
  const { G, entityPos } = ctx;
  // the skills' effects go through the scaled-up set (scene2d big): denser, bigger, a core flash, shockwaves
  const B = S3.big(), f = B.fx, t = ctx.t;
  live.G = G;
  switch (e[0]) {
    case "t": {
      if (!e[5]) {
        recentTele.push({ x: e[1], y: e[2], r: e[3], ms: e[4], at: now() });
        while (recentTele.length > 16 || (recentTele.length && now() - recentTele[0].at > 200)) recentTele.shift();
      }
      return false;
    }
    case "hm": {
      const [, eid, x, y, r, hit, crit, kind] = e;
      const src = entityPos(eid);
      const ang = src ? (src.hammerYaw ?? Math.atan2(y - src.y, x - src.x)) : 0;
      hammerImpact(x, y, r, hit, crit, kind, ang);
      if (eid === G.you || skillNear(G, x, y)) castPfx(kind, src || { x, y }, x, y, r, ang, fxPal(kind, G, eid));
      if (eid === G.you || skillNear(G, x, y)) Sound.play("hammer_land", { kind, hit, crit, final: kind === 132 });
      if (eid === G.you && hit) {
        const strength = kind === 132 ? 4.5 : crit ? 3.3 : kind === 131 ? 2.5 : kind === 130 ? 2 : 1.5;
        S3.shake(strength, Math.atan2(y - G.me.y, x - G.me.x));
      }
      return true;
    }
    case "a": {
      const kind = e[2];
      if (kind < 70) return false;
      const [, eid, , tx, ty] = e;
      const src = entityPos(eid);
      if (!src) return true;
      // the pixelfx layers (skillpfx.js), over the game's own marks below (combo skills 140–159 call it in skillfx_combo.js)
      if (eid === G.you || skillNear(G, src.x, src.y) || skillNear(G, tx, ty)) castPfx(kind, src, tx, ty + 6, e[7], Math.atan2(ty + 6 - src.y, tx - src.x), fxPal(kind, G, eid));
      if (kind === 135 || kind === 136) {
        const y = ty + 6, near = eid === G.you || skillNear(G, tx, y);
        if (kind === 135) {
          S3.fx.wave(tx, y, (e[7] || 76) * 0.52, BANNER_COLOR.light, 260);
          S3.fx.sparkle(tx, y, 0.25, BANNER_COLOR.shine, 6);
          if (near) Sound.play("rally_banner");
        } else {
          bindingFolio(tx, y, e[7] || 105);
          if (near) Sound.play("revive_binding");
        }
        return true;
      }
      if (kind === 133 || kind === 134) {
        const ward = kind === 134, color = ward ? "#ffe3a0" : "#9ce6d8", y = ty + 6, dir = e[5];
        const radius = e[7] || (ward ? 34 : 23), flat = S3.fx;
        const line = ward ? null : lineOf(9);
        const dash = line && Math.hypot(line.bx - tx, line.by - y) < 2 ? line : null;
        const aim = dash && (dash.ax !== dash.bx || dash.ay !== dash.by) ? Math.atan2(dash.by - dash.ay, dash.bx - dash.ax)
          : [Math.PI / 2, Math.PI, 0, -Math.PI / 2][dir] || 0;
        const ux = Math.cos(aim), uy = Math.sin(aim);
        const wk = G.who?.get(eid)?.gear?.wk || (eid === G.you ? G.self?.wk : "");
        src.dir = dir; src.aim = [tx + 30 * ux, y + 30 * uy];
        src.atkN = wk === "hammer" ? 0 : 2;
        src.hammerWind = HAMMER_IMPACT; src.hammerYaw = aim;
        src.atkT = t - (wk ? S3.impactMs(wk, src.atkN) : HAMMER_IMPACT);
        G.hitFrom = dash ? [dash.ax, dash.ay] : [tx, y];
        const near = eid === G.you || skillNear(G, tx, y);
        flat.wave(tx, y, radius, color, 320);
        flat.flash(tx, y, 8, 0, 0.15);
        if (ward) {
          rim(tx, y, radius, "#bd9157", color, 330, 0.36);
          oathSeal(tx, y, G.defs?.skills?.oathward?.healR || 70);
          if (near) Sound.play("oath_cast");
        } else {
          if (dash) {
            const half = (G.defs?.skills?.ironsiege?.half || 11) * 0.76;
            for (const side of [-half, half]) flat.beam(dash.ax - uy * side, dash.ay + ux * side, tx - uy * side, y + ux * side, color, 0.24);
          }
          rim(tx, y, radius, "#46948d", color, 275);
          shards(tx, y, radius, 7, 20, "#458878", color, 295, 16);
          if (near) { S3.shake(eid === G.you ? 4 : 2, aim); Sound.play("merc_dash"); }
        }
        return true;
      }
      if (PASSIVE.has(kind)) { passive(kind, src, eid, tx, ty + 6, G); return true; }
      if (eid !== G.you) { src.atkT = t; src.dir = e[5]; src.atkN = 2; }
      else { G.me.dir = e[5]; G.me.atkN = 2; }
      if (kind === 84 || kind === 85 || kind === 87 || kind === 88) src.skillFxT = src.atkT;
      src.aim = [tx, ty + 6];
      G.hitFrom = [src.x, src.y];
      cast(kind, src, eid, tx, ty + 6, e[7], G);
      return true;
    }
    case "b": {
      if ((e[4] | 0) === 10) { PAL = jobPal("wizard"); fireBurnPatch(e[1], e[2], e[3] || 30); return true; }
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
    case "ps": procFx(G, e); return true;
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
      const m = (G.mobs && G.mobs.get(e[1])) || entityPos(e[1]), code = e[2], tNow = now();
      if (m && m.k === "bloomwhale") {
        const diveTele = [...recentTele].reverse().find((o) => tNow - o.at < 120 && o.r >= 55);
        const ph = m.bph || 1;
        const isDive = !!diveTele || m.bst === 2 || (ph <= 1 && code === 0) || ((ph === 2 || ph === 3) && code === 6) || (ph >= 4 && (code === 2 || code === 5));
        if (isDive && code !== 7 && code !== 8 && code !== 9) {
          const tx = diveTele ? diveTele.x : G.me ? G.me.x : m.x;
          const ty = diveTele ? diveTele.y : G.me ? G.me.y : m.y;
          bloomwhaleDive(m.x, m.y, tx, ty, diveTele ? diveTele.r : 70, diveTele ? diveTele.ms : 1800);
          return true;
        }
      }
      if (m && m.k === "bloodhorn" && code === 0) {
        const rings = recentTele.filter((o) => tNow - o.at < 120 && o.r <= 18);
        let pts, r = 13, ms = 900;
        if (rings.length >= 2) {
          rings.sort((a, b) => (a.x - m.x) ** 2 + (a.y - m.y) ** 2 - ((b.x - m.x) ** 2 + (b.y - m.y) ** 2));
          pts = rings.slice(-5).map((o) => [o.x, o.y]);
          r = rings[0].r || 13; ms = rings[0].ms || 900;
        } else {
          const dx = G.me ? G.me.x - m.x : 1, dy = G.me ? G.me.y - m.y : 0, l = Math.hypot(dx, dy) || 1;
          pts = [1, 2, 3, 4, 5].map((j) => [m.x + (dx / l) * 28 * j, m.y + (dy / l) * 28 * j]);
        }
        bloodhornJet(m.x, m.y, pts, r, ms);
        return true;
      }
      if (m && code === 8) { f.burst(m.x, m.y, 0.8, "#ffe08a", 30, 2.6); B.shake(6); Sound.play("slam"); }
      else if (m && code === 7) { f.ring(m.x, m.y, 90, "#ff3a2a", 420, true); B.shake(8); Sound.play("boom"); }
      else if (m && code === 6) f.burst(m.x, m.y, 0.6, "#ff4fd8", 18, 2);   // an add flew into it and healed it
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
      const p = (PAL = jobPal(LN_JOB[kind] || "adventurer"));
      lastLn = { kind, ax, ay, bx, by, at: now() };
      if (kind === 2) {
        // the thunder javelin: a bolt of a spear down the line
        S3.fx.proj(ax, ay, 0.7, bx, by, 0.5, p.l, 0.07, 70);
        f.beam(ax, ay, bx, by, p.al, 0.6); f.bolt(ax, ay, bx, by, p.l, 240);
      } else if (kind === 3) {
        streakWake(ax, ay, bx, by, p.a, p.l, 10);
        S3.fx.burst(ax, ay, 0.1, p.m, 8, 1.6);
      } else if (kind === 4) { chainLightningArc(ax, ay, bx, by); Sound.play("bolt"); }
      else if (kind === 5) {
        shadowAfterimage(ax, ay, 240);
        streakWake(ax, ay, bx, by, p.md, p.l, 7);
        f.burst(ax, ay, 0.6, p.md, 8, 1.3);
        Sound.play("dance");
      }
      else if (kind === 6) {
        shadowAfterimage(ax, ay, 220);
        streakWake(ax, ay, bx, by, p.md, p.l, 7);
        S3.fx.burst(ax, ay, 0.45, p.m, 7, 1.3);
      }
      else if (kind === 7) {
        // 원소 비수 sends three blades coloured fire, ice and lightning after its cast.
        const el = fan.n > 0 && now() - fan.at < 80 ? 4 - fan.n-- : 0;
        if (!el) {
          shadowDart(ax, ay, bx, by);
          return true;
        }
        const col = ELEM_COL[el], far = Math.hypot(bx - ax, by - ay), ms = Math.max(120, far * 2.4);
        S3.fxCustom((g, k) => {
          const [x, y] = at(ax + (bx - ax) * k, ay + (by - ay) * k, 10);
          const a = k * 18;
          g.translate(Math.round(x), Math.round(y)); g.rotate(a);
          px(g, -5, -1, 10, 3, INK); px(g, -4, 0, 8, 1, col); px(g, 3, -1, 2, 1, "#ffffff");
        }, ms);
        // each leaves its element along the way and a puff of it at the end
        f.beam(ax, ay, bx, by, col, 0.45);
        along(ax, ay, bx, by, 26).forEach(([x, y], i, all) => later((i / all.length) * ms, () => S3.fx.sparkle(x, y, 0.4, col, 2)));
        later(ms, () => { S3.fx.ring(bx, by, 10, col, 240); S3.fx.burst(bx, by, 0.4, col, 6, 1.6); });
      } else if (kind === 10) {
        // 낙인 전염: the brand leaps from the fallen to its next host in a hopping arc, landing with a stamp
        S3.fxCustom((g, k) => {
          for (let i = 0; i <= 12; i++) {
            const u = i / 12;
            if (u > k * 1.6) break;
            const [x, y] = at(ax + (bx - ax) * u, ay + (by - ay) * u, 14 + Math.sin(u * Math.PI) * 30);
            g.globalAlpha = Math.max(0, 1 - k);
            px(g, x - 2, y - 2, 4, 4, INK); px(g, x - 1, y - 1, 2, 2, i % 3 ? p.m : p.a);
          }
          g.globalAlpha = 1;
        }, 380);
        later(240, () => { S3.fx.ring(bx, by, 14, p.m, 260); S3.fx.spark(bx, by, p.a, 1); });
        Sound.play("brand");
      } else if (kind === 8) { leapShotArc(ax, ay, bx, by); f.burst(ax, ay, 0.1, p.m, 10, 1.6); }
      else if (kind === 9) {
        // up and over: an inked pixel leap arc and launch dust
        S3.fxCustom((g, k) => {
          for (let i = 0; i <= 14; i++) {
            const u = i / 14;
            if (u > k * 1.65) break;
            const [x, y] = at(ax + (bx - ax) * u, ay + (by - ay) * u, 10 + Math.sin(u * Math.PI) * 38);
            g.globalAlpha = Math.max(0, 1 - k * 1.05);
            px(g, x - 2, y - 2, 4, 4, INK);
            px(g, x - 1, y - 1, 2, 2, i > 9 ? p.l : p.l);
          }
          g.globalAlpha = 1;
        }, 420);
        f.burst(ax, ay, 0.1, p.m, 10, 1.6);
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
const skillNear = (G, x, y) => !!G.me && dist2(G.me, x, y) < 180 ** 2;

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
/** How far each special arrow flies (the server's `len`): 관통 화살, 도약 사격, 삼원소 화살's three, 룬 먹화살. */
const ARROW_RANGE = { 2: 180, 3: 150, 4: 190, 5: 190, 6: 190, 7: 170 };
/**
 * The dressed arrows (docs/design/jobs-and-stats.md H.4): kind 2 관통 화살, 3 도약 사격, 4 fire, 5 ice, 6 lightning, 7 rune ink.
 * `tier` picks the ink of the white-hot arrow underneath (scene_fx ARROW_HOT: 1 gold, 4 cyan, 5 violet, 6 starlight gold);
 * `tail` is what streams behind it, nearest first; `shaft` repaints the arrow itself (the ink arrow is black).
 */
const ARROW_LOOK = {
  2: { tier: 4, how: "pierce", tail: ["#ffffff", "#d8fff4", "#5ce6c8", "#24786e"], shaft: "#d8fff4" },
  3: { tier: 1, how: "gale", tail: ["#ffffff", "#fff2a6", "#8ee874", "#328a48"], shaft: "#fff2a6" },
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
  if (look.how === "pierce") {
    // Outlined heavy bodkin warhead + swept wind-shear wings + sonic compression ring wake (r=8)
    for (const s of [-1, 1]) {
      dot(-2, s * 2, 3, INK); dot(-2, s * 2, 2, T[1]);
      dot(1, s * 4, 3, INK); dot(1, s * 4, 2, T[2]);
    }
    dot(-5, 0, 3, INK); dot(-5, 0, 2, T[0]);
    for (let i = 0; i < 7; i++) {
      const d = 4 + i * 3;
      const spread = (i % 2 === 0 ? 5 : 3) * (((n + i) % 2) ? 1 : -1);
      dot(d, spread, 3, INK); dot(d, spread, 2, T[Math.min(3, 1 + (i >> 1))]);
      dot(d, 0, 2, T[i < 3 ? 0 : 2]);
    }
  } else if (look.how === "gale") {
    // Outlined emerald-gold feathered head + spiralling leaf-wind trail
    for (const s of [-1, 1]) {
      dot(-2, s * 2, 3, INK); dot(-2, s * 2, 2, T[1]);
    }
    dot(-4, 0, 3, INK); dot(-4, 0, 2, T[0]);
    for (let i = 0; i < 6; i++) {
      const d = 4 + i * 2.6, o = Math.round(Math.sin(i * 1.1 + n * 0.6) * 2.5);
      dot(d, o, 3, INK);
      dot(d, o, 2, T[Math.min(3, 1 + (i >> 1))]);
    }
  } else if (look.how === "flame") {
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
  if (src === G.me || skillNear(G, src.x, src.y)) {
    Sound.play("bow_draw");
    setTimeout(() => Sound.play("bow_shot", beat === 2 || up), left);
  }
}

/** A passive showing itself where it happened: no swing, a sign and a small sound. */
function passive(kind, src, eid, tx, ty, G) {
  const p = (PAL = fxPal(kind, G, eid));
  const f = S3.fx, mine = eid === G.you;
  switch (kind) {
    case 110: f.ring(src.x, src.y, 22, p.m, 300); f.sparkle(src.x, src.y, 0.6, p.m, 10); if (mine) { text(G, "관성 최대", src.x, src.y, 1.9, p.m); Sound.play("inertia_full"); } break;
    case 111: f.burst(tx, ty, 0.5, p.m, 10, 1.6); f.spark(tx, ty, p.m, 0.9); if (mine) Sound.play("bleed"); break;
    case 113: f.ring(src.x, src.y, 20, p.l, 360); f.sparkle(src.x, src.y, 0.8, p.l, 14); if (mine) { text(G, "공명!", src.x, src.y, 1.9, p.l); Sound.play("reso_ready"); } break;
    case 114: f.spark(tx, ty, p.al, 1); f.ring(tx, ty, 12, p.m, 260); if (mine) Sound.play("brand"); break;
    case 115: f.spark(tx, ty, p.m, 1.1); if (mine) text(G, "원거리!", tx, ty, 1.5, p.m); break;
  }
}

/** A skill being used: what it looks like at the caster and where it lands. */
function cast(kind, src, eid, tx, ty, extra, G) {
  const p = (PAL = fxPal(kind, G, eid));
  const ang = Math.hypot(tx - src.x, ty - src.y) > 2 ? Math.atan2(ty - src.y, tx - src.x) : [Math.PI / 2, Math.PI, 0, -Math.PI / 2][src.dir] || 0;
  // scaled-up effects, and a shake that kicks along the skill's aim
  const B = S3.big(ang), f = B.fx, mine = eid === G.you;
  const near = mine || skillNear(G, src.x, src.y) || skillNear(G, tx, ty);
  const play = (key) => { if (near) Sound.play(key); };
  switch (kind) {
    // ── 스태프
    case 70: {
      const r = G.defs?.skills?.fireball?.r || 30;
      fireballOrb(src.x, src.y, tx, ty, r, near);
      play("fireball_cast"); break;
    }
    case 71: {
      const r = extra || 56;
      frostNovaRing(src.x, src.y, r);
      B.shake(4); play("frost"); break;
    }
    case 90: f.sparkle(src.x, src.y, 1.2, p.m, 18); f.ring(tx, ty, extra || 80, p.m, 500); if (mine) text(G, "메테오 스톰!", src.x, src.y, 2.2, p.m, true); play("meteor_cast"); break;
    // ── 대검
    case 80: {
      // a wide crescent of steel thrown off the swing, and everything in it reels
      const r = extra || 46;
      swordCrescent(src.x, src.y, ang, r);
      shards(tx, ty, r * 0.32, 5, 12, p.m, p.w, 240, 96);
      B.shake(6); play("power_slash");
      break;
    }
    case 81: {
      rendSlam(tx, ty, extra || 38);
      B.shake(8); play("slam");
      break;
    }
    case 82: {
      // the split running on ahead: full-width earth corridor (half = 14, len = 120) from the landing point
      const l = lineOf(9), wl = extra || 120;
      const ax = l && Math.hypot(tx - l.bx, ty - l.by) > 8 ? l.bx : Math.hypot(tx - src.x, ty - src.y) > wl + 15 ? tx - Math.cos(ang) * wl : src.x;
      const ay = l && Math.hypot(tx - l.bx, ty - l.by) > 8 ? l.by : Math.hypot(tx - src.x, ty - src.y) > wl + 15 ? ty - Math.sin(ang) * wl : src.y;
      rendWave(ax, ay, tx, ty, G.defs?.skills?.rend?.half || 14);
      play("quake");
      break;
    }
    case 83: {
      verdictSpin(src.x, src.y, ang, extra || 70);
      B.shake(12); play("verdict");
      if (mine) text(G, "단죄의 일격!", src.x, src.y, 2.3, p.m, true);
      break;
    }
    // ── 단검
    case 84: {
      // The blink is a separate line event; these cuts belong only to the struck target.
      ambushCuts(tx, ty, ang);
      S3.fx.arrowHit(tx, ty, ang, p.l, true, 12);
      if (near) B.shake(3.5);
      play("swap"); break;
    }
    case 85: {
      // The three blade lanes arrive immediately after this cast; keep the release local.
      S3.fx.arrowHit(src.x + Math.cos(ang) * 8, src.y + Math.sin(ang) * 8, ang, p.l, false, 14);
      S3.fx.burst(src.x, src.y, 0.55, p.m, 5, 1.1);
      play("shade"); break;
    }
    case 86:
      if (extra === 1) {
        flurrySlash(tx, ty, ang);
        B.shake(3.5); play("crit");
      } else {
        const r = G.defs?.skills?.flurry?.r || 90;
        rim(src.x, src.y, r, p.md, p.l, 420, 0.2);
        for (let i = 0; i < 4; i++) {
          const a = i * (Math.PI / 2) + 0.4;
          shadowAfterimage(src.x + Math.cos(a) * 18, src.y + Math.sin(a) * 18, 280);
        }
        f.burst(src.x, src.y, 0.6, p.d, 28, 1.8);
        play("dance");
        if (mine) text(G, "무영난무!", src.x, src.y, 2.2, p.l, true);
      }
      break;
    // ── 창
    case 87: {
      spiralThrust(src.x, src.y, tx, ty);
      if (near) B.shake(3.5);
      play("spiral");
      break;
    }
    case 88: {
      const line = lineOf(3);
      const a = line && Math.hypot(line.bx - tx, line.by - ty) < 6
        ? Math.atan2(line.by - line.ay, line.bx - line.ax) : ang;
      const ax = line ? line.ax : tx - Math.cos(a) * 96;
      const ay = line ? line.ay : ty - Math.sin(a) * 96;
      cometCharge(ax, ay, tx, ty, G.defs?.skills?.comet?.half || 20);
      if (near) B.shake(6, a);
      play("hundred");
      break;
    }
    case 89: {
      const r = extra || 64;
      S3.fx.zap(tx, ty, p.l, 240);
      rim(tx, ty, r, p.m, p.w, 500, 0.72);
      rim(tx, ty, r * 0.61, p.m, p.l, 340, 0.4);
      shards(tx, ty, r * 0.7, 8, 28, p.m, p.l, 325, 27);
      B.shake(6); play("dragon"); if (mine) text(G, "뇌룡승천!", src.x, src.y, 2.2, p.l, true); break;
    }
    // ── 마도서
    case 91: {
      // a dark bolt that takes its time (the server's queued hit lands when it arrives)
      const ms = extra || 300;
      soulTrail(src.x, src.y, tx, ty, ms);
      later(ms, () => {
        S3.fx.flash(tx, ty, 6);
        rim(tx, ty, 16, p.md, p.l, 260, 0.6);
        shards(tx, ty, 15, 6, 14, p.md, p.m, 240);
        play("soulbolt_end");
      });
      S3.fx.sparkle(src.x, src.y, 0.8, p.m, 6); play("soulbolt");
      break;
    }
    case 92: {
      const r = extra || 60;
      rim(tx, ty, r, p.md, p.l, 340, 0.45);
      B.shake(1.8); play("gravity");
      break;
    }
    case 93: f.sparkle(src.x, src.y, 1, p.m, 20); play("pact"); if (mine) text(G, "심연의 계약", src.x, src.y, 2.2, p.l, true); break;
    // ── 활 (the pose and the twang: bowFire; the arrows come as "ar")
    case 94: SkillFx_bow(G, src, false); pierceMuzzle(src.x, src.y, tx, ty); play("pierce"); break;
    case 95: {
      SkillFx_bow(G, src, false);
      for (let j = -2; j <= 2; j++) {
        const a = ang + j * 0.13;
        S3.fx.spark(src.x + Math.cos(a) * 10, src.y + Math.sin(a) * 10, j % 2 ? p.m : p.al, 0.9);
      }
      f.burst(src.x, src.y, 0.1, p.m, 10, 1.5);
      play("leapshot");
      break;
    }
    case 96: SkillFx_bow(G, src, true); f.sparkle(src.x, src.y, 1.4, p.w, 10); play("rain"); if (mine) text(G, "화살비!", src.x, src.y, 2.2, p.l, true); break;
    // ── hybrid signatures
    case 97: {
      // 원소 마검: 홍련참 — full-width (half=20) Fire + Lightning crescent wave
      crimsonArcWave(src.x, src.y, tx, ty, G.defs?.skills?.crimson?.half || 20);
      B.shake(8); play("crimson");
      if (mine) text(G, "홍련참!", src.x, src.y, 2.2, p.m, true);
      break;
    }
    case 98: f.burst(tx, ty, 0.6, p.d, 30, 1.6); f.ring(tx, ty, 45, p.m, 400); play("decoy"); break;
    case 99: {
      abyssDive(tx, ty, extra || 110);
      B.shake(10); play("dive");
      if (mine) text(G, "심연의 강림!", src.x, src.y, 2.3, p.l, true);
      break;
    }
    case 100: f.ring(src.x, src.y, extra || 100, p.m, 400); f.sparkle(src.x, src.y, 0.8, p.m, 16); play("blood_bind"); break;
    case 101: f.zap(tx, ty, p.l, 300); f.ring(tx, ty, 40, p.al, 360, true); B.shake(9); play("thunder"); if (mine) text(G, "천뢰!", src.x, src.y, 2.2, p.l, true); break;
    // ── the hybrid expansion (docs/design/jobs-and-stats.md H.4)
    case 120: {
      // 십자 난도: the great blade's crescent across everything ahead, then a dagger's X on each one it swept
      const r = extra || 64;
      crossCutFx(src.x, src.y, ang, r);
      B.shake(9); play("cross_cut");
      const swept = [...G.mobs.values()].filter((m) => !m.dead && Math.hypot(m.x - src.x, m.y - src.y) <= r + 8 && Math.cos(Math.atan2(m.y - src.y, m.x - src.x) - ang) > 0.5).slice(0, 8);
      later(170, () => {
        if (swept.length) {
          for (const m of swept) flurrySlash(m.x, m.y, ang);
          B.shake(4);
        } else {
          flurrySlash(src.x + Math.cos(ang) * r * 0.58, src.y + Math.sin(ang) * r * 0.58, ang);
        }
      });
      if (mine) text(G, "십자 난도!", src.x, src.y, 2.2, p.l, true);
      break;
    }
    case 121: {
      // 파진돌격: the charge's streak is the "ln 3" before this; here the great blade comes down where it
      // stopped (the cracks and the ring are the "bw" after) and the spear's reach shows on the rim
      const r = extra || 56, l = lineOf(3), a = l ? Math.atan2(l.by - l.ay, l.bx - l.ax) : ang;
      if (l) { f.beam(l.ax, l.ay - 3, l.bx, l.by - 3, p.l, 0.5); for (const [x, y] of along(l.ax, l.ay, l.bx, l.by, 16)) f.burst(x, y, 0.05, p.m, 3, 1.4); }
      f.fall(tx, ty, p.al, 90);
      f.slash(tx, ty, a, p.m, 1.7); f.slash(tx, ty, a + Math.PI, p.al, 1.3, true);
      for (let i = 0; i < 10; i++) { const q = (i / 10) * 6.28; S3.fx.sparkle(tx + Math.cos(q) * r * 0.86, ty + Math.sin(q) * r * 0.86, 0.2, i % 2 ? p.a : p.al, 2); }
      S3.fx.ring(tx, ty, r * 0.86, p.a, 320, false, 60);
      B.shake(11, a); play("verdict");
      if (mine) text(G, "파진돌격!", tx, ty, 2.3, p.m, true);
      break;
    }
    case 122: {
      // 검기 화살: the bow looses a sword's edge — a white-gold crescent head on a long streak, to the line's end
      SkillFx_bow(G, src, false);
      const ax = src.x, ay = src.y, ms = Math.max(140, Math.hypot(tx - ax, ty - ay) * 1.5);
      const [sx0, sy0] = at(ax, ay, 11), [sx1, sy1] = at(tx, ty, 11), sl = Math.hypot(sx1 - sx0, sy1 - sy0) || 1, ux = (sx1 - sx0) / sl, uy = (sy1 - sy0) / sl, sa = Math.atan2(uy, ux);
      S3.fxCustom((g, k) => {
        const x = sx0 + (sx1 - sx0) * k, y = sy0 + (sy1 - sy0) * k, back = Math.min(sl * k, 46);
        for (let q = 3; q < back; q++) { g.globalAlpha = 1 - q / 46; const w = q < 14 ? 3 : q < 28 ? 2 : 1; px(g, x - ux * q - (w >> 1), y - uy * q - (w >> 1), w, w, q < 10 ? "#ffffff" : q % 3 ? p.l : p.m); }
        g.globalAlpha = 1;
        // the head: a crescent bowed forward, inked gold round a white edge
        for (const [rr, c, w] of [[11, p.m, 3], [10, "#ffffff", 2]]) for (let i = -7; i <= 7; i++) { const q = sa + (i / 7) * 1.15; px(g, x + Math.cos(q) * rr - ux * 7 - 1, y + Math.sin(q) * rr * 0.85 - uy * 7 - 1, w, w, c); }
      }, ms);
      f.beam(ax, ay, tx, ty, p.l, 0.5);
      along(ax, ay, tx, ty, 24).forEach(([x, y], i, all) => later((i / all.length) * ms, () => S3.fx.sparkle(x, y, 0.5, i % 2 ? "#ffffff" : p.m, 2)));
      qi.at = now(); qi.ms = ms;
      f.flash(src.x, src.y, 12); B.shake(7); play("pierce"); play("power_slash");
      if (mine) text(G, "검기 화살!", src.x, src.y, 2.2, p.l, true);
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
        for (let q = 0; q < L; q++) px(g, hx - ux * q, hy - uy * q, 1, 1, q < 7 ? p.w : q % 4 === 3 ? p.md : p.m);
        for (const o of [-1, 1]) for (let q = 3; q < 7; q++) px(g, hx - ux * q - uy * o * (q - 2) * 0.7, hy - uy * q + ux * o * (q - 2) * 0.7, 1, 1, p.w);
      }, 420);
      along(ax, ay, tx, ty, 26).forEach(([x, y], i) => { f.burst(x, y, 0.5, i % 2 ? p.md : p.md, 4, 0.9); });
      f.burst(tx, ty, 0.5, p.m, 10, 1.8); S3.fx.spark(tx + Math.cos(a) * 10, ty + Math.sin(a) * 10, p.w, 1.2);
      B.shake(7, a); play("shade"); play("spiral");
      if (mine) text(G, "그림자 관통!", tx, ty, 2.2, p.l, true);
      break;
    }
    case 124: {
      // 원소 비수: the three blades are the "ln 7"s that follow (the ln case colours them); here, the throw
      fan.n = 3; fan.at = now();
      [1, 2, 3].forEach((el, j) => { const a = ang + (j - 1) * 0.32; S3.fx.spark(src.x + Math.cos(a) * 12, src.y + Math.sin(a) * 12, ELEM_COL[el], 0.8); });
      f.slash(src.x, src.y, ang, p.w, 0.9);
      B.shake(5); play("element_dagger");
      if (mine) text(G, "원소 비수!", src.x, src.y, 2.2, p.w, true);
      break;
    }
    case 125: {
      // 빙결창: a line of frost down the thrust, and ice standing up out of the ground where the point stopped
      f.beam(src.x, src.y, tx, ty, "#ffffff", 0.55); f.beam(src.x, src.y + 2, tx, ty + 2, p.l, 0.5);
      along(src.x, src.y, tx, ty, 12).forEach(([x, y], i) => f.sparkle(x, y, 0.5, i % 2 ? p.w : p.l, 2));
      f.ring(tx, ty, 44, p.l, 380, true); f.burst(tx, ty, 0.3, p.w, 16, 2.6);
      iceSpire(tx, ty);
      B.shake(8); play("frost_lance");
      if (mine) text(G, "빙결창!", src.x, src.y, 2.2, p.l, true);
      break;
    }
    case 126: f.sparkle(src.x, src.y, 1, p.l, 14); f.ring(tx, ty, extra || 64, p.l, 420, true); f.burst(tx, ty, 0.2, p.m, 16, 2); B.shake(4); play("rune_circle"); if (mine) text(G, "메아리 법진", src.x, src.y, 2.2, p.l, true); break;
    case 127: {
      // 삼원소 화살: the three arrows come as "ar" kinds 4–6; here the string's glow in all three
      SkillFx_bow(G, src, false);
      [1, 2, 3].forEach((el, j) => S3.fx.sparkle(src.x + Math.cos(ang + (j - 1) * 0.5) * 8, src.y + Math.sin(ang + (j - 1) * 0.5) * 8, 0.8, ELEM_COL[el], 5));
      f.flash(src.x, src.y, 12); B.shake(5); play("pierce"); play("ember");
      if (mine) text(G, "삼원소 화살!", src.x, src.y, 2.2, p.w, true);
      break;
    }
    case 128: {
      // 룬 먹화살: five arrows as "ar" kind 7; here ink thrown off the string
      SkillFx_bow(G, src, false);
      f.burst(src.x, src.y, 0.6, p.d, 14, 1.8); S3.fx.sparkle(src.x, src.y, 0.9, p.m, 8);
      S3.fx.ring(src.x, src.y, 16, p.m, 280);
      B.shake(5); play("inkshot");
      if (mine) text(G, "룬 먹화살!", src.x, src.y, 2.2, p.l, true);
      break;
    }
    case 102: f.ring(src.x, src.y, extra || 90, p.m, 500, true); f.sparkle(src.x, src.y, 1, p.m, 20); B.shake(5); play("sanctuary"); if (mine) text(G, "불멸의 성역", src.x, src.y, 2.2, p.l, true); break;
  }
  jobBeat(kind, src, tx, ty, p, near);
}
/** The job's own note under every skill (skills-v2.md §6): accent motes at the target, a signature's palette ring. */
function jobBeat(kind, src, tx, ty, p, near) {
  const id = fxSkill(kind), sig = /^[jh]$/.test(skillDef(id)?.kind || "");
  S3.fx.sparkle(tx, ty, 0.5, p.a, sig ? 8 : 4);
  if (sig) { S3.fx.ring(src.x, src.y, 20, p.l, 240); S3.fx.ring(src.x, src.y, 30, p.m, 320, true); }
  if (near && id) Sound.play("job_note", { job: skillOwner(id), sig });
}

// ───────────────────────────── passive procs ("ps", eid, code, x, y: skills-v2.md §4) ─────────────────────────────

/** code → [passive, the word popped over the one who has it]. */
const PS = {
  140: ["sword_fortify30", "벼랑 끝 투지!"], 141: ["sword_weight40", ""], 142: ["sword_edge50", ""], 143: ["dagger_snap30", "회수"],
  144: ["dagger_edge40", "빈틈!"], 145: ["dagger_fang50", "피의 갈증"], 146: ["spear_advance30", ""], 147: ["spear_edge50", "일점!"],
  148: ["staff_chant30", "증폭!"], 149: ["staff_spark40", "집중!"], 150: ["staff_flood50", ""], 151: ["book_clause30", "낙인 전염"],
  152: ["book_return50", ""], 153: ["bow_string30", ""], 154: ["bow_quill50", "약점 포착!"],
};
const PS_SOUND = { 140: "inertia_full", 141: "quake", 143: "reso_ready", 144: "tip", 145: "bleed", 147: "tip", 148: "reso_ready", 149: "reso_ready", 151: "brand", 152: "brand", 154: "tip" };
function procFx(G, e) {
  const [, eid, code, x, y] = e, d = PS[code];
  if (!d) return;
  const p = skillPal(d[0], G.who?.get(eid)?.cls), f = S3.fx, mine = eid === G.you;
  const who = mine ? G.me : G.players.get(eid);
  switch (code) {
    case 140: if (who) { f.ring(who.x, who.y, 22, p.m, 360, true); f.burst(who.x, who.y, 0.4, p.l, 12, 1.8); } break;
    case 141: S3.big().fx.ring(x, y, 36, p.m, 300, true); f.crack(x, y, 22, p.l, 420); f.burst(x, y, 0.1, p.md, 10, 1.6); if (mine) S3.shake(2.5); break;
    case 142: f.spark(x, y, p.a, 0.8); break;
    case 143: if (who) { f.ring(who.x, who.y, 12, p.l, 220); f.sparkle(who.x, who.y, 0.6, p.a, 6); } break;
    case 144: case 147: f.spark(x, y, p.a, 1.3); f.ring(x, y, 10, p.l, 200); break;
    case 145: if (who) { f.sparkle(who.x, who.y, 0.9, p.a, 12); f.ring(who.x, who.y, 18, p.l, 300); } break;
    case 146: if (who) f.sparkle(who.x, who.y, 0.6, p.a, 3); break;
    case 148: f.ring(x, y, 24, p.a, 300, true); f.sparkle(x, y, 0.6, p.l, 8); break;
    case 149: if (who) { f.ring(who.x, who.y, 16, p.l, 240); f.sparkle(who.x, who.y, 1, p.a, 8); } break;
    case 150: if (who) f.sparkle(who.x, who.y, 0.8, p.a, 4); break;
    case 151: f.ring(x, y, 16, p.m, 280); f.burst(x, y, 0.5, p.a, 8, 1.6); break;
    case 152: if (who) f.proj(x, y, 0.6, who.x, who.y, 0.8, p.a, 0.04, 30); break;
    case 153: f.spark(x, y, p.l, 0.9); break;
    case 154: f.ring(x, y, 14, p.a, 280, true); f.spark(x, y, p.a, 1.2); break;
  }
  const word = d[1], at0 = code === 144 || code === 147 || code === 154 || code === 151 ? [x, y] : who ? [who.x, who.y] : [x, y];
  if (mine || skillNear(G, at0[0], at0[1])) procPfx(code, at0[0], at0[1], who ? Math.atan2(y - who.y, x - who.x) : 0, p);
  if (mine && word) text(G, word, at0[0], at0[1], 1.9, code === 154 || code === 144 ? p.a : p.l);
  if (mine && PS_SOUND[code]) Sound.play(PS_SOUND[code]);
}
/** 빙결창's ice: three crystals shooting up out of the ground at (wx, wy), standing a moment, blinking out as they break. */
function iceSpire(wx, wy) {
  const p = PAL;
  let broke = false;
  S3.fxCustom((g, k) => {
    const [x0, y0] = at(wx, wy), x = Math.round(x0), y = Math.round(y0), up = Math.min(1, k / 0.1);
    if (k > 0.8) {
      if (!broke) { broke = true; S3.fx.burst(wx, wy, 0.8, p.w, 14, 2.2); S3.fx.burst(wx, wy, 0.4, p.l, 10, 1.6); }
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
        px(g, x + dx - a, y - j - 1, a * 2 + 1, 1, p.l);
        px(g, x + dx - a, y - j - 1, a + 1, 1, p.w);
        if (a > 1) px(g, x + dx - a + 1, y - j - 1, 1, 1, "#ffffff");
        if (a > 0) px(g, x + dx + a, y - j - 1, 1, 1, p.m);
      }
    }
  }, 900);
}
/** The bow skills draw and loose like a finisher (or up at the sky). */
function SkillFx_bow(G, src, up) { bowFire(G, src, 2, up); }
