/**
 * What skills leave standing (split from skillfx.js): "pr" placed, "pp" a beat, "pe" gone (a vortex, a phantom beast, a
 * rain of arrows, traps, a storm, a blood sanctuary, a rune circle, a support pennant, the tracker's lure), and the
 * per-frame signs over creatures (`overlay`, hooked into scene2d by skillfx.js onSnap).
 */
import * as S3 from "./scene2d.js";
import * as SP from "./sprites.js";
import { Sound } from "./audio.js";
import { jobPal } from "./jobpal.js";
import { castPfx } from "./skillpfx.js";
import { P, at, px, INK, PAL, setPal, now, rand, groundRing, shards, rim, skillNear, BANNER_COLOR, ELEM_COL, live, signs } from "./skillfx_kit.js";
import { gravityWell, gravityPulse, frostNovaRing } from "./skillfx_spell.js";

const PROP_JOB = { grav: "warlock", phantom: "warlock", rain: "archer", trap: "tracker", pillar: "lancer", meteor: "wizard", storm: "lancer",
  field: "spellspear", burst: "bladedancer", sanct: "paladin", rune: "runearcher", banner: "lancer",
  aether: "spellblade", cataclysm: "wizard", venomrain: "tracker" };

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
// ───────────────────────────── props: what skills leave standing ─────────────────────────────

/** Things standing, by the server's prop id: { kind, x, y, r, eid } (for its beats and its end). */
const placed = new Map();
export function lure(id, eid, x, y, ms) {
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

export function placeProp(G, B, f, id, kind, x, y, r, ms, eid) {
  const p = setPal(jobPal(PROP_JOB[kind] || "adventurer"));
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
    case "aether": groundRing(x, y, r, ms, "#ffe498", 0.16); break;
    case "cataclysm": runeCircle(placed.get(id), x, y, r, ms); break;
    case "venomrain": groundRing(x, y, r, ms, "#88e85a", 0.18); arrowRain(x, y, r, ms); break;
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
export function propBeat(G, B, f, e) {
  const [, id, x, y, extra] = e, o = placed.get(id);
  if (!o) return;
  const p = setPal(jobPal(PROP_JOB[o.kind] || "adventurer"));
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
    case "aether": {
      S3.fx.wave(x, y, o.r, "#ffe498", 300);
      f.burst(x, y, 0.25, "#ff9a46", 12, 2.0);
      f.sparkle(x, y, 0.5, "#fff6c8", 8);
      play("ember");
      break;
    }
    case "cataclysm": {
      const step = extra | 0;
      o.el = step === 1 ? 2 : step === 2 ? 3 : 1;
      o.beatNew = true;
      if (step === 1) {
        frostNovaRing(x, y, o.r);
        B.shake(5); play("frost");
      } else if (step === 2) {
        for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28 + 0.4; B.fx.zap(x + Math.cos(a) * o.r * 0.45, y + Math.sin(a) * o.r * 0.45, "#fff07a", 240, i * 40); }
        S3.fx.wave(x, y, o.r, "#fff07a", 320);
        B.shake(6); play("thunder");
      } else {
        B.fx.ring(x, y, o.r, "#ffffff", 420, true);
        B.fx.ring(x, y, o.r * 0.72, "#ff9246", 340);
        f.crack(x, y, o.r * 0.7, "#b8a0ff", 620);
        f.burst(x, y, 0.35, "#ffe08a", 34, 3.2);
        B.shake(10); play("overload");
      }
      break;
    }
    case "venomrain": {
      S3.fx.wave(x, y, o.r, "#8ef060", 280);
      f.burst(x, y, 0.2, "#fb4b85", 8, 1.5);
      f.sparkle(x, y, 0.4, "#a5ef66", 6);
      break;
    }
  }
}
export function propEnd(G, B, f, e) {
  const [, id, how, mid] = e, o = placed.get(id);
  placed.delete(id);
  S3.props.delete("pr" + id);
  follow.delete(id);
  if (!o) return;
  const p = setPal(jobPal(PROP_JOB[o.kind] || "adventurer"));
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

export function overlay(g, t) {
  const G = live.G;
  if (!G) return;
  for (const m of G.mobs.values()) {
    const [mx, my] = at(m.x, m.y), hPx = Math.max(18, (m.h3 || 1.3) * 26), top = my - hPx - 4;
    const s = signs.get(m.id), cb = m.cb | 0;
    const stg = (cb & 1) !== 0, frz = (cb & 2) !== 0 || (s && s.fz > t), air = (cb & 4) !== 0;
    const brn = (cb >> 3) & 3, drag = (cb & 32) !== 0, vu = !!(s && s.vu > t);
    const mk = m.mk | 0, br = m.br | 0;

    // Body & ground combo state overlays (VFX-01)
    if (frz) {
      const w = 22, h = Math.max(18, (m.h3 || 1.3) * 22), x0 = Math.round(mx - w / 2), y0 = Math.round(my - h);
      g.globalAlpha = 0.38; g.fillStyle = "#bfe8ff"; g.fillRect(x0, y0, w, h);
      g.globalAlpha = 0.9; g.strokeStyle = "#e8f8ff"; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
      g.globalAlpha = 1;
      px(g, x0 + 3, y0 + 3, 2, 5, "#ffffff"); px(g, x0 + w - 5, y0 + h - 7, 2, 4, "#e8f8ff");
    }
    if (air) {
      const bob = Math.sin(t / 70) * 2;
      g.globalAlpha = 0.72; g.strokeStyle = "#fff2a8"; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(mx, my - 2, 13, 5, 0, 0, 7); g.stroke();
      g.globalAlpha = 1;
      for (const dx of [-8, 7]) px(g, mx + dx, my - hPx * 0.55 + bob, 1, 7, "#e8f8ff");
    }
    if (drag) {
      const pull = (t / 220) % 1, r = 16 - pull * 7;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + t / 480;
        const qx = Math.round(mx + Math.cos(a) * r), qy = Math.round(my - hPx * 0.45 + Math.sin(a) * r * 0.5);
        px(g, qx - 1, qy - 1, 3, 3, INK); px(g, qx, qy, 2, 2, "#9fe0c0");
      }
    }
    if (stg) {
      for (let i = 0; i < 3; i++) {
        const a = t / 180 + (i * Math.PI * 2) / 3;
        const sx = Math.round(mx + Math.cos(a) * 10), sy = Math.round(top + 2 + Math.sin(a) * 3.5);
        px(g, sx - 1, sy - 1, 3, 3, INK); px(g, sx, sy, 2, 2, i === 0 ? "#ffffff" : "#ffd86a");
      }
    }

    // Non-overlapping horizontal pixel badge strip above the monster's head (VFX-01)
    const badges = [];
    if (mk > 0) {
      const n = mk, w = n * 5 - 1, hot = n >= 5 && Math.sin(t / 90) > 0;
      badges.push({ w, draw(x0, y0) {
        for (let i = 0; i < n; i++) {
          const x = x0 + i * 5, y = y0 + 2;
          px(g, x + 1, y, 2, 1, INK); px(g, x, y + 1, 4, 2, INK); px(g, x + 1, y + 3, 2, 1, INK);
          px(g, x + 1, y + 1, 2, 2, hot ? "#ffd0ff" : "#c070ff");
        }
      } });
    }
    if (br) {
      badges.push({ w: 7, draw(x, y) {
        const f = Math.sin(t / 120) > 0;
        px(g, x, y, 7, 9, INK); px(g, x + 1, y + 1, 5, 7, "#3a2a58");
        px(g, x + 2, y + 2, 3, 1, "#c8a0ff"); px(g, x + 3, y + 3, 1, 3, f ? "#ff6a8a" : "#c8a0ff"); px(g, x + 2, y + 6, 3, 1, "#c8a0ff");
      } });
    }
    if (brn > 0) {
      const w = brn * 6 - 1;
      badges.push({ w, draw(x0, y0) {
        const fl = Math.floor(t / 95) & 1;
        for (let i = 0; i < brn; i++) {
          const x = x0 + i * 6, dy = ((i + fl) & 1) ? 0 : 1;
          px(g, x, y0 + 1 + dy, 5, 7, INK);
          px(g, x + 1, y0 + 4 + dy, 3, 3, "#e04818");
          px(g, x + 1, y0 + 2 + dy, 3, 3, "#ff8a2a");
          px(g, x + 2, y0 + 1 + dy, 1, 3, "#ffe852");
        }
      } });
    }
    if (stg) {
      badges.push({ w: 7, draw(x, y) {
        px(g, x, y + 1, 7, 7, INK);
        px(g, x + 3, y + 2, 1, 5, "#ffd86a"); px(g, x + 1, y + 4, 5, 1, "#ffd86a");
        px(g, x + 2, y + 3, 3, 3, "#fff6b0"); px(g, x + 3, y + 4, 1, 1, "#ffffff");
      } });
    }
    if (frz) {
      badges.push({ w: 7, draw(x, y) {
        px(g, x, y + 1, 7, 7, INK);
        px(g, x + 2, y + 2, 3, 5, "#7ad4ff"); px(g, x + 1, y + 3, 5, 3, "#bfe8ff");
        px(g, x + 3, y + 2, 1, 5, "#ffffff"); px(g, x + 2, y + 4, 3, 1, "#ffffff");
      } });
    }
    if (air) {
      badges.push({ w: 7, draw(x, y) {
        const lift = Math.sin(t / 80) > 0 ? 0 : 1;
        px(g, x, y + lift, 7, 8, INK);
        px(g, x + 3, y + 1 + lift, 1, 1, "#ffffff"); px(g, x + 2, y + 2 + lift, 3, 1, "#fff2a8"); px(g, x + 1, y + 3 + lift, 5, 1, "#ffd86a");
        px(g, x + 3, y + 4 + lift, 1, 1, "#ffffff"); px(g, x + 2, y + 5 + lift, 3, 1, "#fff2a8");
      } });
    }
    if (drag) {
      badges.push({ w: 7, draw(x, y) {
        px(g, x, y + 1, 7, 7, INK);
        px(g, x + 1, y + 2, 5, 5, "#265c4e");
        px(g, x + 1, y + 4, 2, 1, "#9fe0c0"); px(g, x + 4, y + 4, 2, 1, "#9fe0c0");
        px(g, x + 3, y + 2, 1, 2, "#9fe0c0"); px(g, x + 3, y + 5, 1, 2, "#9fe0c0");
        px(g, x + 3, y + 4, 1, 1, "#ffffff");
      } });
    }
    if (vu && Math.sin(t / 110) > -0.4) {
      badges.push({ w: 7, draw(x, y) {
        px(g, x, y, 7, 8, INK); px(g, x + 1, y + 1, 5, 5, "#8ad8ff"); px(g, x + 2, y + 6, 3, 1, "#8ad8ff");
        px(g, x + 3, y + 1, 1, 3, INK); px(g, x + 2, y + 4, 1, 2, INK);
      } });
    }
    if (badges.length) {
      const gap = 2, totW = badges.reduce((sum, b) => sum + b.w, 0) + (badges.length - 1) * gap;
      let cx = Math.round(mx - totW / 2);
      const cy = Math.round(top - 8);
      for (const b of badges) { b.draw(cx, cy); cx += b.w + gap; }
    }
  }
  for (const [id, s] of signs) if (!(s.fz > t || s.vu > t)) signs.delete(id);
  // holy sanctuaries round their paladins
  for (const [id, o] of follow) {
    if (t > o.until) { follow.delete(id); continue; }
    const e = o.eid === G.you ? G.me : G.players.get(o.eid);
    if (!e) continue;
    const [x, y] = at(e.x, e.y), a = Math.min(1, (t - o.t0) / 200, (o.until - t) / 200), rx = o.r * Math.SQRT2, ry = o.r / Math.SQRT2;
    const p = jobPal("paladin");
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
