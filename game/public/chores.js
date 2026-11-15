/**
 * 버드나무 마을 chores (docs/design/life-and-coop.md H10; rules in src/logic/59-chores.js).
 * The chore in hand comes with its spots on `self.jb[3]` (board.js `active`: spots [[x, y, done]…], fill = acts
 * carried). Only its taker sees them: an S3 hook draws a weed tuft, litter, a dry flower bed, a bare lamp post, a
 * mailbox or a sniffable tree at each, with a glint until done, and what is carried over the head (the milk
 * crate, the watering can). F in reach does it (`jb {a:"do", i}`) or fills the can at a well or the water's edge
 * (`jb {a:"pick"}`); the prompt names it (`label`). The server checks reach, order and pace; `["co", eid, i]`
 * says a spot was done (a sparkle).
 */

import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import { G, T, dist, now } from "./state.js";
import { act, entityPos } from "./net.js";
import { active } from "./board.js";

const INK = "#2b2233";
const VERB = { milk: "우유 넣기", weed: "잡초 뽑기", flyer: "전단지 붙이기", litter: "쓰레기 줍기", water: "물 주기", dog: "냄새 맡게 하기" };
const st = { hooked: false, sent: 0 };

const D = () => G.defs && G.defs.life;
/** The chore in hand on this map: { a, c (CHORES row), job } or null. */
function mine() {
  const a = G.self && active(G.self), L = D();
  if (!a || a.t.kind !== "chore" || !a.spots || !L || !L.chores || !G.map || G.map.id !== L.chore.map) return null;
  return { a, c: L.chores[a.t.job], job: a.t.job };
}
const spotXY = ([x, y]) => [x * T + 8, y * T + 8];
/** The nearest spot not done within reach, or -1. */
function nearSpot(m) {
  if (!G.me) return -1;
  let best = -1, bd = D().chore.range - 3;
  m.a.spots.forEach((s, i) => { if (s[2]) return; const [x, y] = spotXY(s), d = dist(G.me.x, G.me.y, x, y); if (d < bd) { bd = d; best = i; } });
  return best;
}
/** Is a well or the water's edge in reach (as the server's choreWater)? */
function waterHere() {
  const m = G.map, tx = Math.floor(G.me.x / T), ty = Math.floor(G.me.y / T), r = D().chore.src;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const row = m.g[ty + dy]; if (row && row[tx + dx] === "w") return true; }
  return (m.big || []).some((b) => b.t === "prop" && b.k === "well" && Math.abs(b.x - tx) <= r + 1 && Math.abs(b.y - ty) <= r + 1);
}
/** What F would do here: { a, i?, label } or null. */
function step() {
  const m = mine();
  if (!m || !G.me || G.me.dead || m.a.got >= m.a.n) return null;
  const i = nearSpot(m);
  if (i >= 0) return { a: "do", i, label: `${VERB[m.job]} (${m.a.got}/${m.a.n})` };
  if (m.c.src === "water" && m.a.fill < m.c.carry && waterHere()) return { a: "pick", label: `${m.c.name} — 물뿌리개 채우기` };
  return null;
}
/** The F prompt's text when a chore step is in reach, else "" (update.js). */
export function label() { const s = step(); return s ? s.label : ""; }
/** F: do the chore step in reach (true), else false (actions.js goes on). */
export function interact() {
  const s = step();
  if (!s) return false;
  if (now() - st.sent < 550) return true;
  st.sent = now();
  act(s.a === "do" ? { t: "jb", a: "do", i: s.i } : { t: "jb", a: "pick" });
  Sound.play(s.a === "do" ? "gat_hit" : "ui");
  return true;
}
/** `["co", eid, i]`: a spot was done. True when handled. */
export function onEvent(e) {
  if (e[0] !== "co") return false;
  const m = mine(), s = m && e[1] === G.you && m.a.spots[e[2]];
  if (s) { const [x, y] = spotXY(s); S3.fx.sparkle(x, y, 0.9, m.job === "water" ? "#8ad8ff" : "#ffe08a", 10); }
  else { const at = entityPos(e[1]); if (at) S3.fx.sparkle(at.x, at.y, 0.7, "#ffe08a", 6); }
  return true;
}

// ───────────────────────────── drawing (an S3 hook: world pixels in the iso frame) ─────────────────────────────

/** Each frame (hud.js): hook the drawing in once. */
export function tick() { if (!st.hooked) { S3.hooks.push(draw); st.hooked = true; } }

function draw(g, t) {
  const m = mine();
  if (!m) return;
  m.a.spots.forEach((s, i) => {
    const [wx, wy] = spotXY(s), [X, Y] = S3.iso(wx, wy), x0 = Math.round(X), y0 = Math.round(Y);
    const px = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x0 + a, y0 + b, w, h); };
    const glint = !s[2] && Math.floor(t / 180 + i * 3) % 6 === 0;
    PROP[m.job](px, !!s[2], t + i * 400);
    if (glint) { px(-1, -26, 3, 1, "#fff8d0"); px(0, -27, 1, 3, "#fff8d0"); }
  });
  // what the taker carries: the milk crate, the watering can (filled)
  const me = G.me && entityPos(G.you);
  if (!me || me.dead || !(m.a.fill > 0) || (m.job !== "milk" && m.job !== "water")) return;
  const [X, Y] = S3.iso(me.x, me.y), bob = me.moving ? Math.round(Math.sin(t / 110)) : 0;
  const x0 = Math.round(X - 6), y0 = Math.round(Y - (me.h3 || 1.32) * 26 - 8 + bob);
  const px = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x0 + a, y0 + b, w, h); };
  if (m.job === "milk") {
    px(0, 3, 12, 7, INK); px(1, 4, 10, 5, "#c8945a"); px(1, 7, 10, 2, "#9a6a3a");          // the crate
    for (let k = 0; k < Math.min(3, m.a.fill); k++) { px(2 + k * 3, -1, 3, 5, INK); px(3 + k * 3, 0, 1, 4, "#f8f4ec"); px(3 + k * 3, -1, 1, 1, "#4a8ad8"); }
  } else {
    px(1, 2, 9, 7, INK); px(2, 3, 7, 5, "#5aa86a"); px(2, 6, 7, 2, "#3a7a4a");             // the can
    px(9, 3, 4, 2, INK); px(12, 1, 2, 2, INK); px(3, 0, 5, 2, INK); px(4, 1, 3, 1, "#8ad8a0");  // spout, handle
    for (let k = 0; k < m.a.fill; k++) px(2 + k * 3, 10, 2, 2, "#8ad8ff");                 // water left: drops
  }
}

/** One spot's prop, bottom-centre at the tile's middle: px(dx, dy, w, h, colour), done?, time. */
const PROP = {
  weed: (px, done) => {
    if (done) { px(-3, 0, 6, 2, "#7a5a3a"); return; }                     // a pulled patch: bare earth
    px(-5, -6, 10, 7, INK);
    px(-4, -5, 2, 5, "#4a8a3a"); px(-1, -8, 2, 8, "#5aa848"); px(2, -6, 2, 6, "#4a8a3a"); px(-1, -9, 2, 1, INK);
    px(-3, -3, 6, 3, "#3a6a2a"); px(1, -8, 1, 1, "#e8d84a");              // a weed's yellow bud
  },
  litter: (px, done) => {
    if (done) return;
    px(-6, -4, 6, 5, INK); px(-5, -3, 4, 3, "#e8e4d8"); px(-4, -3, 1, 1, "#b8b4a8");   // a crumpled paper
    px(1, -6, 5, 7, INK); px(2, -5, 3, 5, "#d84a3a"); px(2, -3, 3, 1, "#f0e0d0");     // a can
  },
  water: (px, done, t) => {
    if (done) { px(-3, -6, 2, 2, "#ff8ab8"); px(1, -7, 2, 2, "#ffd84a"); px(-2, -4, 1, 4, "#4a9a3a"); px(2, -5, 1, 5, "#4a9a3a"); return; }
    px(-2, -6, 1, 6, "#8a7a3a"); px(2, -5, 1, 5, "#8a7a3a"); px(-4, -7, 3, 2, "#b87a4a"); px(2, -6, 3, 2, "#a86a3a");  // drooping, dry
    const b = Math.round(Math.sin(t / 300) * 1.5);
    px(-2, -16 + b, 5, 6, INK); px(-1, -15 + b, 3, 4, "#8ad8ff"); px(0, -17 + b, 1, 1, INK);   // a drop: it wants water
  },
  flyer: (px, done) => {
    // on the post (or board), at hand height
    if (done) { px(-4, -20, 8, 9, INK); px(-3, -19, 6, 7, "#f8f0d8"); px(-2, -17, 4, 1, "#d84a3a"); px(-2, -15, 4, 1, "#8a8a9a"); px(0, -20, 1, 1, "#ffd84a"); return; }
    px(-4, -20, 8, 9, "rgba(255,248,208,0.35)"); px(-4, -20, 8, 1, "#fff8d0"); px(-4, -12, 8, 1, "#fff8d0");
  },
  milk: (px, done) => {
    px(0, -10, 1, 10, INK);                                                // the post
    px(-4, -15, 9, 6, INK); px(-3, -14, 7, 4, "#c84a3a"); px(-3, -14, 7, 1, "#e86a5a");
    if (done) { px(-1, -19, 3, 5, INK); px(0, -18, 1, 4, "#f8f4ec"); }   // a bottle in it
    else { px(5, -16, 1, 4, "#e8c84a"); px(5, -16, 2, 1, "#e8c84a"); }    // the flag up: waiting
  },
  dog: (px, done, t) => {
    if (done) { px(-3, -2, 2, 2, "#8a6a4a"); px(1, -3, 2, 2, "#8a6a4a"); return; }
    const w = Math.round(Math.sin(t / 250));
    px(-4, -2, 3, 2, "#6a4a3a"); px(-1, -4, 2, 2, "#6a4a3a"); px(2, -2, 3, 2, "#6a4a3a"); px(-1, -1, 2, 2, "#6a4a3a");  // a paw print
    px(-2 + w, -12, 1, 3, "#c8b8a8"); px(1 - w, -14, 1, 3, "#c8b8a8");   // a scent on the air
  },
};
