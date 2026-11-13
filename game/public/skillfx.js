/**
 * The class skills as the player sees them: what each one looks and sounds like,
 * the props they leave standing (a greatsword stuck in the ground, a lancer's banner,
 * a mage's teapot, a rogue's puppet), and the small signs drawn over creatures —
 * a rogue's marks, a frozen monster, a confused one, a superconducted one.
 *
 * client.js hands every snapshot event here first (`skillEvent`: true = handled) and
 * calls `onSnap` after each snapshot so the class bits of the rows get read.
 * Everything is drawn in code, in the game's flat pixel style.
 */
import * as S3 from "./scene2d.js";
import * as SP from "./sprites.js";
import { Sound } from "./audio.js";

const P = 2;                       // world unit → world pixel, as in scene2d
/** What classgauge.js reads: the client state and the live number off the snapshot. */
export const live = { G: null };
/** Monster signs: id → { fz, cf, vu } (end times). */
const signs = new Map();
const sign = (id, key, until) => { const s = signs.get(id) || {}; s[key] = until; signs.set(id, s); };
const now = () => performance.now();

/** After every snapshot: flags and the gauge number on the rows, marks on monsters. */
export function onSnap(s, G, t) {
  live.G = G;
  G.me.fl = s.me[8] | 0;
  G.me.cv = s.me[9] | 0;
  if (s.self) G.selfAt = t;
  for (const r of s.P) { const e = G.players.get(r[0]); if (e) e.fl = r[8] | 0; }
  for (const r of s.M) { const e = G.mobs.get(r[0]); if (e) e.mk = r[8] | 0; }
  if (!hooked) { S3.hooks.push(overlay); hooked = true; }
}
let hooked = false;

// ───────────────────────────── little helpers ─────────────────────────────

function text(G, str, x, y, h, col, big) { G.texts.push({ str, x, y, h, col, big: !!big, t0: now() }); }
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const INK = "#2b2233";
/** A filled ring flat on the ground for `ms`, gently pulsing: the reach of a banner or a teapot. */
function groundRing(wx, wy, r, ms, col) {
  S3.fxCustom((g, k) => {
    const a = Math.min(1, k * 8, (1 - k) * 8);
    g.globalAlpha = 0.16 * a; g.fillStyle = col;
    g.beginPath(); g.ellipse(wx * P, wy * P, r * P, r * P * 0.86, 0, 0, 7); g.fill();
    g.globalAlpha = 0.5 * a; g.strokeStyle = col; g.lineWidth = 2; g.setLineDash([6, 6]); g.lineDashOffset = -k * ms / 40;
    g.beginPath(); g.ellipse(wx * P, wy * P, r * P, r * P * 0.86, 0, 0, 7); g.stroke();
  }, ms, true);
}
/** A tinted copy of a sprite (for the rogue's puppet). */
const tintCache = new Map();
function tinted(img, col) {
  const key = img;
  let c = tintCache.get(key);
  if (c) return c;
  c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-atop"; g.globalAlpha = 0.55; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  if (tintCache.size > 40) tintCache.delete(tintCache.keys().next().value);
  return c;
}
/** The greatsword (or whatever the warrior swings) turning end over end from a to b. */
function flyingBlade(eid, ax, ay, bx, by, ms, spins = 2) {
  const fr = S3.personFrame(eid);
  if (!fr || !fr.weapon) { S3.fx.beam(ax, ay, bx, by, "#dfe8ff", 0.6); return; }
  S3.fxCustom((g, k) => {
    const x = (ax + (bx - ax) * k) * P, y = (ay + (by - ay) * k) * P - 14 - Math.sin(k * Math.PI) * 10;
    g.translate(Math.round(x), Math.round(y)); g.rotate(k * spins * Math.PI * 2);
    g.drawImage(fr.weapon, -SP.GRIP[0] - 8, -SP.GRIP[1]);
  }, ms);
  S3.fx.beam(ax, ay, bx, by, "rgba(220,232,255,.5)", 0.6);
}

// ───────────────────────────── props ─────────────────────────────

function stuckSword(eid, x, y, ms) {
  const fr = S3.personFrame(eid);
  const t0 = now();
  S3.props.set("sw" + eid, {
    x, y, until: t0 + ms,
    draw(g, t, sx, sy) {
      if (t < t0 + 190) return;          // still in the air
      // it lands with a wobble that dies away, and glints now and then
      const w = Math.sin((t - t0) / 45) * Math.max(0, 1 - (t - t0) / 500) * 0.25;
      g.fillStyle = "rgba(20,24,50,.3)"; g.beginPath(); g.ellipse(sx, sy, 6, 2, 0, 0, 7); g.fill();
      px(g, sx - 5, sy - 1, 3, 1, "#7a6a50"); px(g, sx + 3, sy, 3, 1, "#7a6a50");
      g.translate(Math.round(sx), Math.round(sy) - 4);
      g.rotate(Math.PI / 2 + 0.12 + w);
      if (fr && fr.weapon) g.drawImage(fr.weapon, -SP.GRIP[0] - 18, -SP.GRIP[1]);
      else { px(g, -18, -1, 20, 3, "#d8e0f0"); px(g, -22, -3, 3, 7, "#6a5040"); }
      if (Math.sin(t / 300) > 0.97) { g.rotate(-(Math.PI / 2 + 0.12 + w)); px(g, -1, -20, 3, 1, "#fff"); px(g, 0, -21, 1, 3, "#fff"); }
    },
  });
}
function decoy(id, eid, x, y, ms) {
  const fr = S3.personFrame(eid);
  S3.props.set("dc" + id, {
    x, y, until: now() + ms,
    draw(g, t, sx, sy) {
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(sx, sy, 5, 2, 0, 0, 7); g.fill();
      if (!fr) return;
      g.globalAlpha = 0.65 + 0.25 * Math.sin(t / 70);
      const img = tinted(fr.img, "#8a5ad8");
      g.drawImage(img, Math.round(sx - SP.FOOT[0]), Math.round(sy - SP.FOOT[1] + Math.sin(t / 220)));
      // stitches: it is a puppet after all
      g.globalAlpha = 1;
      px(g, sx - 3, sy - 13, 1, 1, "#e8d8ff"); px(g, sx + 2, sy - 12, 1, 1, "#e8d8ff");
    },
  });
}
function banner(id, x, y, r, ms) {
  groundRing(x, y, r, ms, "#5ad0b8");
  S3.props.set("bn" + id, {
    x, y, until: now() + ms,
    draw(g, t, sx, sy) {
      sx = Math.round(sx); sy = Math.round(sy);
      g.fillStyle = "rgba(20,24,50,.3)"; g.beginPath(); g.ellipse(sx, sy, 5, 2, 0, 0, 7); g.fill();
      px(g, sx - 3, sy - 2, 6, 2, INK); px(g, sx - 2, sy - 3, 4, 1, "#6a5040");
      px(g, sx - 1, sy - 32, 3, 30, INK); px(g, sx, sy - 31, 1, 29, "#b08a5a");
      px(g, sx - 1, sy - 34, 3, 3, INK); px(g, sx, sy - 33, 1, 1, "#ffd84a");
      // the cloth waves, column by column
      for (let c = 0; c < 14; c++) {
        const off = Math.round(Math.sin(t / 160 - c * 0.55) * (c / 14) * 2);
        const top = sy - 30 + off, h = 11 - Math.floor(c / 5);
        px(g, sx + 2 + c, top - 1, 1, h + 2, INK);
        px(g, sx + 2 + c, top, 1, h, c % 4 === 0 ? "#3aa894" : "#5ad0b8");
        if (c >= 4 && c <= 7) px(g, sx + 2 + c, top + 3, 1, 3, "#f0f4e0");
      }
    },
  });
}
function teapot(id, x, y, r, ms) {
  groundRing(x, y, r, ms, "#8cff8c");
  S3.props.set("tp" + id, {
    x, y, until: now() + ms, lift: 0,
    draw(g, t, sx, sy) {
      sx = Math.round(sx); sy = Math.round(sy) + Math.round(Math.abs(Math.sin(t / 300)) * -1);
      g.fillStyle = "rgba(20,24,50,.3)"; g.beginPath(); g.ellipse(sx, sy + 1, 7, 2, 0, 0, 7); g.fill();
      // outline, body (cream), a band of blue flowers, lid and knob, spout and handle
      const body = [[-4, -1, 8], [-5, -2, 10], [-6, -3, 12], [-6, -4, 12], [-6, -5, 12], [-6, -6, 12], [-5, -7, 10], [-4, -8, 8]];
      for (const [x0, yy, w] of body) { px(g, sx + x0 - 1, sy + yy, w + 2, 1, INK); }
      px(g, sx - 4, sy, 8, 1, INK); px(g, sx - 4, sy - 9, 8, 1, INK);
      for (const [x0, yy, w] of body) px(g, sx + x0, sy + yy, w, 1, yy > -3 ? "#e6d4b0" : "#f6ecd4");
      for (let i = -5; i <= 5; i += 3) px(g, sx + i, sy - 5, 2, 1, "#5a8ad8");
      px(g, sx - 3, sy - 10, 6, 1, INK); px(g, sx - 2, sy - 9, 4, 1, "#c8b896"); px(g, sx - 1, sy - 12, 2, 2, INK); px(g, sx - 1, sy - 11, 1, 1, "#f6ecd4");
      px(g, sx - 10, sy - 7, 4, 1, INK); px(g, sx - 9, sy - 6, 3, 2, "#e6d4b0"); px(g, sx - 10, sy - 6, 1, 3, INK); px(g, sx - 8, sy - 4, 2, 1, INK);
      px(g, sx + 7, sy - 7, 3, 1, INK); px(g, sx + 9, sy - 6, 1, 4, INK); px(g, sx + 7, sy - 3, 3, 1, INK);
      // steam curling off the spout
      for (let i = 0; i < 3; i++) {
        const ph = ((t / 900 + i / 3) % 1);
        g.globalAlpha = 1 - ph;
        px(g, sx - 10 + Math.round(Math.sin(ph * 7 + i) * 2), sy - 10 - Math.round(ph * 14), 2, 2, "#ffffff");
      }
    },
  });
}

// ───────────────────────────── per-frame signs ─────────────────────────────

const ELEM_COL = [null, "#ff8a3a", "#9fe8ff", "#ffe86a"];
function overlay(g, t) {
  const G = live.G;
  if (!G) return;
  // a rogue's marks over each monster: little violet diamonds, one per stack
  for (const m of G.mobs.values()) {
    const top = m.y * P - (m.h3 || 1.3) * 26 - 4;
    if (m.mk) {
      const n = m.mk, w = n * 5 - 1, x0 = Math.round(m.x * P - w / 2), y0 = Math.round(top - 4);
      const hot = n >= 5 && Math.sin(t / 90) > 0;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * 5;
        px(g, x + 1, y0, 2, 1, INK); px(g, x, y0 + 1, 4, 2, INK); px(g, x + 1, y0 + 3, 2, 1, INK);
        px(g, x + 1, y0 + 1, 2, 2, hot ? "#ffd0ff" : "#c070ff");
      }
    }
    const s = signs.get(m.id);
    if (!s) continue;
    if (s.fz > t) {
      const w = 22, h = Math.max(18, (m.h3 || 1.3) * 22);
      g.globalAlpha = 0.38; g.fillStyle = "#bfe8ff"; g.fillRect(Math.round(m.x * P - w / 2), Math.round(m.y * P - h), w, h);
      g.globalAlpha = 0.9; g.strokeStyle = "#e8f8ff"; g.lineWidth = 1; g.strokeRect(Math.round(m.x * P - w / 2) + 0.5, Math.round(m.y * P - h) + 0.5, w - 1, h - 1);
      g.globalAlpha = 1; px(g, m.x * P - w / 2 + 3, m.y * P - h + 3, 2, 5, "#ffffff");
    }
    if (s.cf > t) {
      for (let i = 0; i < 3; i++) {
        const a = t / 160 + i * 2.1, x = m.x * P + Math.cos(a) * 9, y = top - 2 + Math.sin(a) * 3;
        px(g, x - 1, y, 3, 1, "#ffe86a"); px(g, x, y - 1, 1, 3, "#ffe86a");
      }
    }
    if (s.vu > t && Math.sin(t / 110) > -0.4) {
      // a cracked shield: armour that will not hold
      const x = Math.round(m.x * P + 10), y = Math.round(top + 2);
      px(g, x - 1, y - 1, 7, 8, INK); px(g, x, y, 5, 5, "#8ad8ff"); px(g, x + 1, y + 5, 3, 1, "#8ad8ff"); px(g, x + 2, y, 1, 3, INK); px(g, x + 1, y + 3, 1, 2, INK);
    }
  }
  for (const [id, s] of signs) if (!(s.fz > t || s.cf > t || s.vu > t)) signs.delete(id);
  // players at work: a braced warrior's guard, a lancer's spinning spear, a mage's surge
  const people = [[G.me, true]];
  for (const p of G.players.values()) people.push([p, false]);
  for (const [p, me] of people) {
    const fl = p.fl | 0, x = p.x * P, y = p.y * P;
    if (fl & 4) {
      g.strokeStyle = `rgba(255,216,90,${0.55 + 0.3 * Math.sin(t / 60)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y - 10, 15, 17, 0, Math.PI, 0); g.stroke();
      g.beginPath(); g.ellipse(x, y, 15, 5, 0, 0, Math.PI); g.stroke();
    }
    if (fl & 8) {
      g.strokeStyle = "rgba(230,244,255,.85)"; g.lineWidth = 2;
      for (let i = 0; i < 2; i++) { const a = t / 45 + i * Math.PI; g.beginPath(); g.moveTo(x + Math.cos(a) * 22, y - 8 + Math.sin(a) * 9); g.lineTo(x - Math.cos(a) * 22, y - 8 - Math.sin(a) * 9); g.stroke(); }
      g.globalAlpha = 0.25; g.beginPath(); g.ellipse(x, y - 8, 24, 10, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
    }
    if (fl & 32) {
      for (let i = 1; i <= 3; i++) { const a = t / 260 + i * 2.094, ox = Math.cos(a) * 14, oy = Math.sin(a) * 6; orb(g, x + ox, y - 14 + oy, i, t); }
    }
    // the element a mage is holding (only their own is sent)
    if (me && G.me.cv && !(fl & 32) && G.self && G.self.cls === "mage") orb(g, x, y - 38 + Math.sin(t / 200) * 2, G.me.cv, t);
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

export function skillEvent(e, ctx) {
  const { G, entityPos } = ctx;
  const f = S3.fx, t = ctx.t;
  live.G = G;
  switch (e[0]) {
    case "a": {
      const kind = e[2];
      if (kind < 40) return false;
      const [, eid, , tx, ty] = e;
      const src = entityPos(eid);
      if (!src) return true;
      const beat = kind === 40 ? e[6] | 0 : 2;
      if (eid !== G.you) { src.atkT = t; src.dir = e[5]; src.atkN = beat; }
      else { G.me.dir = e[5]; G.me.atkN = beat; }
      src.aim = [tx, ty + 6];
      G.hitFrom = [src.x, src.y];
      cast(kind, src, eid, tx, ty + 6, e[7], G);
      return true;
    }
    case "b": {
      const kind = e[4] | 0;
      if (kind === 10) { f.burst(e[1] + (Math.random() - 0.5) * e[3], e[2], 0.1, "#ff8a3a", 5, 0.8); f.sparkle(e[1], e[2], 0.1, "#ffd84a", 4); f.ring(e[1], e[2], e[3], "rgba(255,120,40,.6)", 260, true); return true; }
      if (kind === 11) { f.storm(e[1], e[2], e[3], "#e6f4ff", 300, 3); Sound.play("wheel"); return true; }
      return false;
    }
    case "bw": {
      const [, x, y, r, kind] = e;
      if (kind === 1) { f.ring(x, y, r, "#ffd84a", 380, true); f.crack(x, y, r * 0.5, "#ffd84a", 500); f.burst(x, y, 0.3, "#ffe9a0", 26, 2.8); S3.shake(7); Sound.play("shock"); }
      else if (kind === 2) { f.ring(x, y, r, "#ff8a3a", 420, true); f.ring(x, y, r * 0.7, "#ffffff", 300); f.crack(x, y, r * 0.6, "#ff7a3a", 650); f.burst(x, y, 0.3, "#ffb04a", 20 + r / 2, 3.4); S3.shake(Math.min(14, 4 + r / 8)); Sound.play("grit_burst"); }
      else if (kind === 3) { f.ring(x, y, r, "#c8a878", 260); f.burst(x, y, 0.05, "#a89068", 10, 1.6); S3.shake(2); Sound.play("quake"); }
      else if (kind === 5) { f.ring(x, y, r, "#c070ff", 260, true); f.burst(x, y, 0.5, "#d8a0ff", 14, 2.4); f.spark(x, y, "#f0d0ff", 1.4); Sound.play("harvest"); }
      else if (kind === 9) { f.crack(x, y, r * 0.6, "#ffd84a", 700); f.ring(x, y, r, "#ffffff", 320, true); f.burst(x, y, 0.1, "#e0c890", 34, 3); S3.shake(10); Sound.play("slam"); }
      else if (kind === 13) { f.ring(x, y, r, "#ff8a3a", 380, true); f.ring(x, y, r * 0.8, "#9fe8ff", 380, false, 80); f.ring(x, y, r * 0.6, "#ffe86a", 380, false, 160); f.sparkle(x, y, 0.6, "#ffffff", 24); S3.shake(6); }
      else if (kind === 14) { f.ring(x, y, r, "#d0f0e8", 300, true); f.burst(x, y, 0.1, "#b8a878", 16, 2.2); S3.shake(4); Sound.play("boom"); }
      return true;
    }
    case "rx": {
      const [, id, x, y, r] = e;
      if (id === 1) { f.ring(x, y, r, "#ffffff", 420, true); for (let i = 0; i < 18; i++) f.sparkle(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r * 0.6, 0.2, "#eef4ff", 2); f.burst(x, y, 0.3, "#d8e8f0", 30, 2.4); S3.shake(5); Sound.play("steam"); }
      else if (id === 2) { f.ring(x, y, r, "#b8a0ff", 360, true); f.ring(x, y, r * 0.6, "#9fe8ff", 300); for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; f.bolt(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, "#c8b0ff", 260); } Sound.play("supercon"); }
      else { f.ring(x, y, r, "#ffb04a", 340, true); f.ring(x, y, r * 1.2, "#ffe86a", 300); f.crack(x, y, r * 0.7, "#ffb04a", 500); f.burst(x, y, 0.4, "#ffd84a", 30, 3.6); S3.shake(8); Sound.play("overload"); }
      const [s, c] = REACT_NAME[id];
      text(G, s, x, y, 1.6, c, true);
      return true;
    }
    case "sw": stuckSword(e[1], e[2], e[3], e[4]); f.burst(e[2], e[3], 0.1, "#a89068", 12, 1.8); S3.shake(2); return true;
    case "sr": {
      S3.props.delete("sw" + e[1]);
      const o = entityPos(e[1]);
      if (o) flyingBlade(e[1], e[2], e[3], o.x, o.y, 220, 3);
      Sound.play("sword_back");
      return true;
    }
    case "dc": decoy(e[1], e[2], e[3], e[4], e[5]); f.burst(e[3], e[4], 0.6, "#6a5a88", 30, 1.4); Sound.play("decoy"); return true;
    case "dx": S3.props.delete("dc" + e[1]); f.ring(e[2], e[3], e[4], "#a070e0", 320, true); f.burst(e[2], e[3], 0.6, "#c890ff", 30, 3); S3.shake(4); Sound.play("decoy_pop"); return true;
    case "bn": banner(e[1], e[2], e[3], e[4], e[5]); Sound.play("banner"); return true;
    case "tp": teapot(e[1], e[2], e[3], e[4], e[5]); Sound.play("tea"); return true;
    case "tq": { const pr = S3.props.get("tp" + e[1]); if (pr) { f.sparkle(pr.x, pr.y, 0.6, "#b8ffc0", 6); Sound.play("tea"); } return true; }
    case "cf": sign(e[1], "cf", t + e[2]); return true;
    case "fz": { sign(e[1], "fz", t + e[2]); const m = G.mobs.get(e[1]); if (m) { text(G, "빙결", m.x, m.y, (m.h3 || 1.3) + 0.4, "#bfe8ff"); f.sparkle(m.x, m.y, 0.6, "#e8f8ff", 10); } return true; }
    case "vu": sign(e[1], "vu", t + e[2]); return true;
    case "tip": {
      const m = G.mobs.get(e[1]);
      if (m) { text(G, "창끝!", m.x + 6, m.y, (m.h3 || 1.3) + 0.55, "#c8fff0"); f.spark(m.x, m.y, "#c8fff0", 1.2); }
      Sound.play("tip");
      return true;
    }
    case "fo": { const o = entityPos(e[1]); if (o) { f.ring(o.x, o.y, 26, "#5ad0b8", 400, true); f.sparkle(o.x, o.y, 0.7, "#c8fff0", 14); if (e[1] === G.you) text(G, "집중 개방!", o.x, o.y, 1.7, "#7affe0", true); } Sound.play("focus"); return true; }
    case "wl": { const m = G.mobs.get(e[1]); if (m) { text(G, "벽꿍!", m.x, m.y, (m.h3 || 1.3) + 0.5, "#ffe08a", true); f.burst(m.x, m.y, 0.5, "#e0c890", 22, 2.6); f.ring(m.x, m.y, 20, "#ffffff", 240); } S3.shake(6); Sound.play("wall"); return true; }
    case "bl": { const o = entityPos(e[1]); if (o) { f.spark(o.x, o.y - 4, "#e6f4ff", 1.5); f.burst(o.x, o.y, 0.7, "#ffffff", 8, 2); } Sound.play("block"); return true; }
    case "bk": { const o = entityPos(e[1]); if (o) f.spark(o.x, o.y - 4, "#ffd84a", 1.3); Sound.play("clang"); return true; }
    case "cn": {
      // a coin tossed up off the thumb, turning over and over, landing on the target
      const [, eid, x, y, heads] = e;
      const o = entityPos(eid) || { x, y };
      const ax = o.x, ay = o.y;
      S3.fxCustom((g, k) => {
        const u = Math.min(1, k / 0.75);
        const cx = (ax + (x - ax) * u) * P, cy = (ay + (y - ay) * u) * P - 22 - Math.sin(u * Math.PI) * 30;
        const w = k < 0.75 ? [7, 5, 2, 5][Math.floor(k * 24) % 4] : 7;
        const face = k < 0.75 ? Math.floor(k * 12) % 2 : !heads;
        g.translate(Math.round(cx), Math.round(cy));
        px(g, -Math.ceil(w / 2) - 1, -4, w + 2, 8, INK); px(g, -Math.ceil(w / 2), -5, w, 10, INK);
        px(g, -Math.ceil(w / 2), -3, w, 6, face ? "#c89a3a" : "#ffd84a");
        if (w >= 5) px(g, -1, -1, 2, 2, face ? "#8a6a2a" : "#fff6b0");
      }, 900);
      Sound.play("coin_flip");
      setTimeout(() => {
        if (heads) { text(G, "앞면!", x, y, 1.9, "#ffd84a", true); f.sparkle(x, y, 0.9, "#ffd84a", 18); f.ring(x, y, 24, "#ffd84a", 300); Sound.play("heads"); }
        else { text(G, "뒷면 — 다음 스킬 즉시 재사용", x, y, 1.9, "#c8c8d8"); Sound.play("tails"); }
      }, 680);
      return true;
    }
    case "ln": {
      const [, kind, ax, ay, bx, by] = e;
      if (kind === 1) {
        // the hook's chain, drawn out and wound back in
        S3.fxCustom((g, k) => {
          const u = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
          const x0 = ax * P, y0 = ay * P - 12, x1 = x0 + (bx * P - x0) * u, y1 = y0 + (by * P - 10 - y0) * u;
          const n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 4));
          for (let i = 0; i <= n; i++) px(g, x0 + (x1 - x0) * i / n - 1, y0 + (y1 - y0) * i / n - 1, 2, 2, i % 2 ? "#8f8b80" : "#d8d8e0");
          px(g, x1 - 2, y1 - 3, 4, 2, "#e6e0d0"); px(g, x1 + 1, y1 - 1, 2, 3, "#e6e0d0");
        }, 320);
      } else if (kind === 2) {
        S3.fx.proj(ax, ay, 0.7, bx, by, 0.5, "#eef4ff", 0.06, 60);
        f.beam(ax, ay, bx, by, "#d0f0e8", 0.6);
      } else if (kind === 3) {
        f.beam(ax, ay, bx, by, "#ffffff", 0.6); f.beam(ax, ay + 3, bx, by + 3, "#5ad0b8", 0.5);
        for (let i = 1; i <= 4; i++) f.sparkle(ax + (bx - ax) * i / 5, ay + (by - ay) * i / 5, 0.6, "#c8fff0", 3);
      } else if (kind === 4) { f.bolt(ax, ay + 8, bx, by + 8, "#fff27a", 260); f.spark(bx, by + 6, "#fff6b0", 1.3); Sound.play("bolt"); }
      else if (kind === 5) { f.beam(ax, ay - 8, bx, by - 8, "#7a4ac8", 0.5); f.burst(ax, ay, 0.6, "#3a2a58", 8, 1.2); Sound.play("dance"); }
      else if (kind === 6) { f.beam(ax, ay - 8, bx, by - 8, "#a070e0", 0.5); f.burst(ax, ay, 0.6, "#6a4a9a", 12, 1.4); f.burst(bx, by, 0.6, "#6a4a9a", 12, 1.4); }
      else if (kind === 8) { f.beam(ax, ay - 8, bx, by - 8, "#9fd8ff", 0.5); f.ring(bx, by, 22, "#9fd8ff", 420, true); f.sparkle(bx, by, 0.7, "#e0f4ff", 16); }
      else if (kind === 9) {
        // over the top on the pole: a dotted arc and the lancer's dust where they left
        S3.fxCustom((g, k) => {
          for (let i = 0; i <= 12; i++) {
            const u = i / 12;
            if (u > k * 1.6) break;
            const x = (ax + (bx - ax) * u) * P, y = (ay + (by - ay) * u) * P - 10 - Math.sin(u * Math.PI) * 36;
            g.globalAlpha = 1 - k; px(g, x - 1, y - 1, 2, 2, "#d0f0e8");
          }
        }, 420);
        f.burst(ax, ay, 0.1, "#b8a878", 8, 1.4);
      }
      return true;
    }
  }
  return false;
}

/** A skill being used: what it looks like at the caster and where it lands. */
function cast(kind, src, eid, tx, ty, extra, G) {
  const f = S3.fx;
  const ang = Math.hypot(tx - src.x, ty - src.y) > 2 ? Math.atan2(ty - src.y, tx - src.x) : [Math.PI / 2, Math.PI, 0, -Math.PI / 2][src.dir] || 0;
  switch (kind) {
    // ── 전사
    case 40: f.spark(tx, ty, "#ffe9a0", 1.2); f.burst(tx, ty, 0.6, "#ffffff", 6, 1.6); S3.shake(2); Sound.play("headbutt"); break;
    case 41: flyingBlade(eid, src.x, src.y, tx, ty, 200, 2); Sound.play("throw"); break;
    case 42: break;
    case 43: f.ring(src.x, src.y, 18, "#ffd84a", 300); Sound.play("brace"); break;
    case 45: f.ring(src.x, src.y, extra || 96, "#ff6a4a", 520); f.ring(src.x, src.y, (extra || 96) * 0.6, "#ffb04a", 420, false, 80); f.sparkle(src.x, src.y, 0.9, "#ff8a6a", 16); S3.shake(5); Sound.play("roar"); break;
    case 46: f.slash(src.x, src.y, ang, "#ffb04a", 1.6); break;
    case 47: f.ring(src.x, src.y, 40, "#c8a878", 360, true); Sound.play("quake"); break;
    case 48: f.sparkle(src.x, src.y, 1.4, "#ffd84a", 30); f.ring(src.x, src.y, 30, "#ffd84a", 500); S3.shake(8); Sound.play("giant"); if (eid === G.you) text(G, "거신화!", src.x, src.y, 2.4, "#ffd84a", true); break;
    // ── 도적
    case 50: f.slash(tx, ty, ang, "#c890ff", 0.9); Sound.play("swap"); break;
    case 51: f.sparkle(src.x, src.y, 0.6, "#8ad84a", 16); f.burst(src.x, src.y, 0.6, "#5aa83a", 8, 1); Sound.play("venom"); break;
    case 52: break;
    case 53: f.burst(src.x, src.y, 0.5, "#8a8a98", 30, 1.3); break;
    case 54: f.ring(src.x, src.y, extra || 110, "#c070ff", 380); Sound.play("harvest"); break;
    case 55: f.burst(src.x, src.y, 0.6, "#2a2040", 30, 1.8); f.storm(src.x, src.y, 24, "#a070e0", 300, 3); Sound.play("dance"); break;
    case 56: f.burst(src.x, src.y, 0.6, "#6a4a9a", 20, 1.6); f.ring(src.x, src.y, 20, "#c890ff", 300); break;
    case 57: f.slash(tx, ty, ang + 0.8, "#c070ff", 1.1); f.slash(tx, ty, ang - 0.8, "#c070ff", 1.1, true); f.spark(tx, ty, "#f0d0ff", 1.5); S3.shake(3); Sound.play("crit"); break;
    // ── 창술사
    case 60: Sound.play("hook"); break;
    case 61: Sound.play("pole"); break;
    case 62: break;
    case 63: f.storm(src.x, src.y, 36, "#e6f4ff", 300, 4); Sound.play("wheel"); break;
    case 64: Sound.play("javelin"); break;
    case 65: f.slash(src.x, src.y, ang, "#ffffff", 2.2); f.ring(src.x, src.y, 30, "#5ad0b8", 400, true); S3.shake(9); Sound.play("hundred"); if (eid === G.you) text(G, extra ? `백보일섬 · 집중 ${extra}` : "백보일섬", src.x, src.y, 2.2, "#c8fff0", true); break;
    // ── 마도사
    case 70: f.proj(src.x, src.y, 1.1, tx, ty, 0.4, "#ff8a3a", 0.12, 15, () => { f.ring(tx, ty, 26, "#ff8a3a", 300, true); f.burst(tx, ty, 0.4, "#ffd84a", 18, 2.4); S3.shake(2); Sound.play("boom"); }); Sound.play("ember"); break;
    case 71: f.ring(src.x, src.y, extra || 56, "#9fe8ff", 420, true); f.ring(src.x, src.y, (extra || 56) * 0.7, "#ffffff", 300, false, 60); f.sparkle(src.x, src.y, 0.5, "#d0f4ff", 20); Sound.play("frost"); break;
    case 72: break;
    case 73: f.sparkle(src.x, src.y, 0.9, "#fff27a", 10); break;
    case 74: f.ring(src.x, src.y, 24, "#9fd8ff", 500); Sound.play("rewind"); break;
    case 75: f.sparkle(src.x, src.y, 1.2, "#ffffff", 30); S3.shake(6); Sound.play("surge"); if (eid === G.you) text(G, "원소 폭주!", src.x, src.y, 2.2, "#ffe86a", true); break;
  }
}
