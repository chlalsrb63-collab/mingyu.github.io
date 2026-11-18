/**
 * Skill effects drawn with pixelfx (vendored in public/pfx/, MIT: https://github.com/patch-gg/pixelfx). skillfx.js
 * `cast` calls `castPfx` for every skill's "a" event; a code listed in PFX plays its pixelfx layers on top of the
 * game's own drawing (which keeps the gameplay marks: reach rings, telegraphs, shake, sound).
 *
 * An effect runs live: the effect module draws into a pixelfx frame (colour + additive light), composited to RGBA
 * over transparency at the effect's fps, put on a small canvas and drawn in the world at FIGURE_DENSITY pixels per
 * iso pixel — the same pixel size as the 64-px heroes. Nothing is baked or cached, so memory stays flat.
 * pixelfx is drawn from the side: its floor rings (frost-nova, fire-ring, quake…) lie flat as a line in our 2:1 view, so
 * the table uses point and column effects (bursts, blasts, pillars, strikes) and leaves the reach rings to skillfx.js.
 * The tables live in skillpfx_melee.js and skillpfx_magic.js (CAST, PROC). Monster hit flashes come from the damage event.
 * After changing the tables run
 * `node scripts/pfx-vendor.mjs` (copies the named effects into public/pfx/).
 *
 * A layer: { fx: the effect id (category/name), at: "src" | "tgt" (where it plays; default src), to: "tgt" (fly there, then end),
 *   up: iso px above the ground (or [from, to] when flying), r: server units the effect's own reach option is
 *   scaled to (`reachKey`, default "reach"), size: 1 or 2 (2 = one effect pixel per iso pixel, chunkier and twice as big; the effect's own size knob goes in `opts`), speed (play-rate), cut (seconds of effect time shown, it fades over its last fifth),
 *   delay: ms or "flight", on: "wind" or "impact" (explicit phase), alpha: opacity, ms: how long a looping
 *   effect plays (when it does not fly), aim: true = rotate to the aim, pal: a PAL ramp name, a dark→bright
 *   hex array, or "job" (the caster's job colours),
 *   opts: the effect's own options }.
 */
import * as S3 from "./scene2d.js";
import { lowSpec } from "./postfx.js";
import { createFrame, clearFrame, createFx, composite, PAL as RAMPS } from "./pfx/core/index.js";

const PD = S3.FIGURE_DENSITY;          // fx pixels per iso pixel
const MAX = 6;                          // live cast/proc layers at once; more are skipped (a crowd of casters)
const flightMs = (d) => Math.max(110, Math.min(210, Math.round(d * 1.35)));   // skillfx.js fireballOrb

import * as Melee from "./skillpfx_melee.js";
import * as Magic from "./skillpfx_magic.js";

/** Skill code → cast layers; passive proc code → layers. */
export const PFX = { ...Melee.CAST, ...Magic.CAST };
export const PROC = { ...Melee.PROC, ...Magic.PROC };

const mods = new Map(), loads = [];
for (const t of [PFX, PROC]) for (const layers of Object.values(t)) for (const l of layers) if (!mods.has(l.fx)) {
  mods.set(l.fx, null);
  loads.push(import(`./pfx/fx/${l.fx}.js`).then((m) => mods.set(l.fx, m), (e) => console.warn("pfx", l.fx, e)));
}
/** Every effect module loaded (a cast before that just skips its pixelfx layers; preview pages wait for it). */
export const ready = Promise.all(loads);

/** The caster's job colours as a dark → bright ramp (jobpal.js palette fields). */
const jobRamp = (p) => [p.d, p.md, p.m, p.l, p.w, "#ffffff"];

/** Draw the layers assigned to this explicit stage of the skill. */
export function castPfx(kind, src, tx, ty, extra, ang, p, stage = "") {
  const layers = PFX[kind];
  if (!layers || lowSpec()) return;
  const dist = Math.hypot(tx - src.x, ty - src.y), fl = flightMs(dist);
  for (const l of layers) {
    if ((l.on || "") !== stage) continue;
    const at = l.at === "tgt" ? [tx, ty] : [src.x, src.y];
    const delay = l.delay === "flight" ? fl : l.delay || 0;
    play(l, at[0] + (l.dx || 0), at[1] + (l.dy || 0), { to: l.to === "tgt" ? [tx, ty] : null, ms: fl, delay, ang, p, r: l.r ? extra || l.r : 0 });
  }
}

/** A weapon passive proc'd (skillfx.js procFx, PS code) at (x, y). */
export function procPfx(code, x, y, ang = 0, p = null) {
  const layers = PROC[code];
  if (!layers || lowSpec()) return;
  for (const l of layers) play(l, x + (l.dx || 0), y + (l.dy || 0), { ms: 0, delay: l.delay || 0, ang, p, r: 0 });
}

function play(l, wx, wy, c) {
  const mod = mods.get(l.fx);
  if (!mod || mod.act?.onBody || S3.fx.list.reduce((n, o) => n + !!o.pfx, 0) >= MAX) return;
  const meta = mod.meta, def = meta.options || {};
  const opts = { ...l.opts };
  if (l.pal) opts.palette = l.pal === "job" ? (c.p ? jobRamp(c.p) : undefined) : Array.isArray(l.pal) ? l.pal : RAMPS[l.pal];
  if (!opts.palette) delete opts.palette;
  // the frame grows with the reach a skill asks for: a ring of r server units is r·√2 iso px wide each side
  let grow = 1;
  const Z = l.size === 2 ? PD / 2 : PD;   // fx pixels per iso pixel for this layer (whole backing pixels either way)
  const key = l.reachKey || "reach";
  if (c.r && def[key]) { opts[key] = Math.round(c.r * Math.SQRT2 * Z); grow *= opts[key] / def[key]; }
  const ang = l.aim ? c.ang : 0;
  // an aimed or flying effect turns round its origin: give it a square frame centred on the origin
  const [mw, mh] = meta.size, side = Math.ceil(Math.max(mw, mh) * grow * (l.aim ? 2 : 1));
  const W = l.aim ? side : Math.ceil(mw * grow), H = l.aim ? side : Math.ceil(mh * grow);
  const ox = l.aim ? side / 2 : meta.origin[0] * grow, oy = l.aim ? side / 2 : meta.origin[1] * grow;
  const isoAng = Math.atan2((Math.sin(ang) + Math.cos(ang)) / 2, Math.cos(ang) - Math.sin(ang));   // the aim on the ground, as seen
  // effects that paint the wrapped character's body (curse, life-steal, divine-shield…) are left out of the tables: given
  // no actor, pixelfx wraps its stock 24×38 one, and the melee effects only use it to find the hands
  const inst = createFx(mod, { ...opts, x: ox, y: oy, angle: l.aim ? isoAng : 0, flip: false });
  const frame = createFrame(W, H), img = new ImageData(W, H);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const cx = cv.getContext("2d");
  const speed = l.speed || 1, fps = Math.min(24, meta.fps || 30);
  const full = meta.loop ? (c.to ? c.ms : l.ms || 600) / 1000 * speed : Math.min(meta.duration, l.cut || meta.duration);
  const durMs = c.to ? c.ms : (full / speed) * 1000;
  const up = Array.isArray(l.up) ? l.up : [l.up || 0, l.up || 0];
  const [x0, y0] = S3.iso(wx, wy), [x1, y1] = c.to ? S3.iso(c.to[0], c.to[1]) : [x0, y0];
  let last = 0, shown = -1;
  S3.fx.add({ k: "custom", pfx: true, flat: false, dur: durMs, delay: c.delay, draw: (g, k) => {
    const t = Math.min(full, k * full);
    if (t > last) { inst.update(t - last); last = t; }
    const q = Math.floor(t * fps);
    if (q !== shown) {
      shown = q;
      clearFrame(frame);
      inst.draw(frame);
      composite(frame, img.data, null, 1);
      cx.putImageData(img, 0, 0);
    }
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - (up[0] + (up[1] - up[0]) * k);
    g.imageSmoothingEnabled = false;
    const fades = (meta.loop && !c.to) || (!meta.loop && l.cut && l.cut < meta.duration);
    g.globalAlpha *= (l.alpha ?? 1) * (fades ? Math.min(1, (1 - k) * 5) : 1);
    g.drawImage(cv, Math.round((x - ox / Z) * PD) / PD, Math.round((y - oy / Z) * PD) / PD, W / Z, H / Z);
  } });
}
