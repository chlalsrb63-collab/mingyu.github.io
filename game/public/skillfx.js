/**
 * The weapon skills as the player sees them (docs/design/jobs-and-stats.md C.5): what each skill looks and
 * sounds like (fx codes 70–102 on an "a" event), the passives' little flashes (110–115), the things skills
 * leave standing (a vortex, a phantom beast, a rain of arrows, traps, a storm, a blood sanctuary: "pr" placed,
 * "pp" a beat, "pe" gone), the tracker's lure, the bow's arrows ("ar"/"ae"), and the signs drawn over
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
  }
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

export function skillEvent(e, ctx) {
  const { G, entityPos } = ctx;
  // the skills' effects go through the scaled-up set (scene2d big): denser, bigger, a core flash, shockwaves
  const B = S3.big(), f = B.fx, t = ctx.t;
  live.G = G;
  switch (e[0]) {
    case "a": {
      const kind = e[2];
      if (kind < 70) return false;
      const [, eid, , tx, ty] = e;
      const src = entityPos(eid);
      if (!src) return true;
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
      let sh = null, best = 40;
      for (const s of bowShots) {
        if (t - s.t > 700 || (pid !== undefined && s.eid !== pid)) continue;
        const d = Math.hypot(s.x - x0, s.y - y0);
        if (d < best) { best = d; sh = s; }
      }
      // (a volley shares one draw of the string)
      if (sh && (kind | 0) !== 3) bowShots.splice(bowShots.indexOf(sh), 1);
      const range = (kind | 0) === 2 ? 180 : (G.defs && G.defs.wkinds && G.defs.wkinds.bow && G.defs.wkinds.bow.range) || 150;
      arrowFrom.set(id, [x0, y0, range]);
      if (arrowFrom.size > 64) arrowFrom.delete(arrowFrom.keys().next().value);
      S3.fx.arrow(x0, y0, x0 + (ux / n) * range, y0 + (uy / n) * range, { id, spd: spd || 420, delay: sh ? Math.max(0, sh.at - t) : 0, tier: sh ? sh.wt : 1, pierce: (kind | 0) === 1 || (kind | 0) === 2 });
      return true;
    }
    case "ae": {
      const [, id, x, y, how] = e, from = arrowFrom.get(id);
      arrowFrom.delete(id);
      // struck nothing and simply ran its whole range: it drops out of sight, no spark
      const spent = how === 2 || (!how && from && Math.hypot(x - from[0], y - from[1]) >= from[2] - 6);
      S3.fx.arrowEnd(id, x, y, how === 1 ? "stuck" : spent ? "fade" : "hit");
      if (how === 1) Sound.play("arrow_wall"); else if (!spent) Sound.play("arrow_hit");
      return true;
    }
    case "pr": { const [, id, kind, x, y, r, ms, eid] = e; placeProp(G, B, f, id, kind, x, y, r, ms, eid); return true; }
    case "pp": propBeat(G, B, f, e); return true;
    case "pe": propEnd(G, B, f, e); return true;
    case "bw": {
      const [, x, y, r, kind] = e;
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
        // a shadow blade spinning down its line
        S3.fxCustom((g, k) => {
          const [x, y] = at(ax + (bx - ax) * k, ay + (by - ay) * k, 10);
          const a = k * 18;
          g.translate(Math.round(x), Math.round(y)); g.rotate(a);
          px(g, -5, -1, 10, 3, INK); px(g, -4, 0, 8, 1, "#c8a0ff"); px(g, 3, -1, 2, 1, "#ffffff");
        }, Math.max(120, Math.hypot(bx - ax, by - ay) * 2.4));
        f.beam(ax, ay, bx, by, "rgba(160,112,224,.5)", 0.45);
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
  }
  return false;
}

// ── the bow's shot: client.js attackFx calls bowFire for fx code 6 (the "a" event of a bow's basic
// attack); the bow skills call it too. The arrow itself comes on its own ("ar", above): it is held on
// the string until the stroke's release (swing.js IMPACT) and still lands on time.
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
    case 70: f.proj(src.x, src.y, 1.1, tx, ty, 0.4, "#ff8a3a", 0.12, 15, () => { f.ring(tx, ty, 30, "#ff8a3a", 300, true); f.burst(tx, ty, 0.4, "#ffd84a", 18, 2.4); B.shake(3); Sound.play("boom"); }); Sound.play("ember"); break;
    case 71: f.ring(src.x, src.y, extra || 56, "#9fe8ff", 420, true); f.ring(src.x, src.y, (extra || 56) * 0.7, "#ffffff", 300, false, 60); f.sparkle(src.x, src.y, 0.5, "#d0f4ff", 20); B.shake(4); Sound.play("frost"); break;
    case 90: f.sparkle(src.x, src.y, 1.2, "#ff8a3a", 18); f.ring(tx, ty, extra || 80, "#ff5a3a", 500); if (mine) text(G, "메테오 스톰!", src.x, src.y, 2.2, "#ffb04a", true); Sound.play("meteor_cast"); break;
    // ── 대검
    case 80: {
      // a wide crescent of steel thrown off the swing, and everything in it reels
      f.slash(src.x, src.y, ang, "#e8f0ff", 1.5); f.slash(src.x, src.y, ang, "#9fb8ff", 1.1, true);
      for (let i = -2; i <= 2; i++) { const a = ang + i * 0.3, r = (extra || 46) * 0.8; f.spark(src.x + Math.cos(a) * r, src.y + Math.sin(a) * r, "#ffffff", 0.7); }
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
    case 89: f.zap(tx, ty, "#bfe8ff", 320); f.ring(tx, ty, extra || 64, "#9fdcff", 420); B.shake(6); Sound.play("dragon"); if (mine) text(G, "뇌룡승천!", src.x, src.y, 2.2, "#bfe8ff", true); break;
    // ── 마도서
    case 91: {
      // a dark bolt that takes its time (the server's queued hit lands when it arrives)
      const ms = extra || 300, far = Math.hypot(tx - src.x, ty - src.y) * P;
      f.proj(src.x, src.y, 0.9, tx, ty, 0.5, "#8a5ad8", 0.1, Math.max(4, (far / (ms * 26)) * 1000), () => { f.ring(tx, ty, 16, "#c8a0ff", 260, true); f.sparkle(tx, ty, 0.5, "#e0c8ff", 8); });
      f.sparkle(src.x, src.y, 0.8, "#8a5ad8", 8); Sound.play("soulbolt");
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
    case 102: f.ring(src.x, src.y, extra || 90, "#c8324a", 500, true); f.sparkle(src.x, src.y, 1, "#ff6a8a", 20); B.shake(5); Sound.play("sanctuary"); if (mine) text(G, "불멸의 성역", src.x, src.y, 2.2, "#ff8a9a", true); break;
  }
}
/** The bow skills draw and loose like a finisher (or up at the sky). */
function SkillFx_bow(G, src, up) { bowFire(G, src, 2, up); }
