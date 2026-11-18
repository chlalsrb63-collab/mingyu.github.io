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
 * After changing the table run `node scripts/pfx-vendor.mjs` (copies the named effects into public/pfx/).
 *
 * A layer: { fx: the effect id (category/name), at: "src" | "tgt" (where it plays; default src), to: "tgt" (fly there, then end),
 *   up: iso px above the ground (or [from, to] when flying), r: server units the effect's own reach option is
 *   scaled to (`reachKey`, default "reach"), size: 1 or 2 (2 = one effect pixel per iso pixel, chunkier and twice as big; the effect's own size knob goes in `opts`), speed (play-rate), cut (seconds of effect time shown, it fades over its last fifth),
 *   delay: ms or "flight", ms: how long a looping effect plays (when it does not fly), aim: true = rotate to the aim, pal: a PAL ramp name or "job" (the caster's job colours),
 *   opts: the effect's own options }.
 */
import * as S3 from "./scene2d.js";
import { lowSpec } from "./postfx.js";
import { createFrame, clearFrame, createFx, composite, PAL as RAMPS } from "./pfx/core/index.js";

const PD = S3.FIGURE_DENSITY;          // fx pixels per iso pixel
const MAX = 6;                          // live pixelfx layers at once; more are skipped (a crowd of casters)
const flightMs = (d) => Math.max(110, Math.min(210, Math.round(d * 1.35)));   // skillfx.js fireballOrb

export const PFX = {
  // ── 스태프 (wizard)
  70: [{ fx: "fire/fireball", to: "tgt", up: [16, 6], aim: true, opts: { radius: 6 } },
    { fx: "explosions/small-explosion", at: "tgt", delay: "flight", speed: 2.2, cut: 2.2, opts: { size: 0.7 } }],
  71: [{ fx: "ice/snowflake-burst", speed: 1.6, cut: 2.6 }],
  90: [{ fx: "fire/meteor", at: "tgt", speed: 1.8, cut: 4.4 },
    { fx: "fire/meteor", at: "tgt", dx: -34, dy: 22, delay: 380, speed: 1.9, cut: 4.4, opts: { seed: 21 } },
    { fx: "fire/meteor", at: "tgt", dx: 30, dy: -18, delay: 760, speed: 2, cut: 4.4, opts: { seed: 33 } }],
  143: [{ fx: "explosions/small-explosion", at: "tgt", speed: 2, cut: 2.6, opts: { size: 0.9 } }],
  152: [{ fx: "lightning/zap-hit", at: "tgt", up: 8, speed: 1.4 }],
  // ── 대검 (swordsman)
  80: [{ fx: "melee/heavy-cleave", aim: true, up: 10, speed: 1.6 }],
  81: [{ fx: "nature/quake", aim: true, speed: 2, cut: 2.4 }],
  83: [{ fx: "holy/smite", at: "tgt", speed: 1.6, cut: 2.4 }],
  140: [{ fx: "impacts/crit-hit", at: "tgt", up: 10 }],
  146: [{ fx: "melee/spin-slash" }],
  153: [{ fx: "impacts/blunt-hit", at: "tgt", up: 10 }],
  158: [{ fx: "impacts/parry", up: 14 }],
  159: [{ fx: "impacts/ground-slam", at: "tgt", speed: 1.6, cut: 2.4 }],
  // ── 단검 (thief)
  84: [{ fx: "melee/double-slash", at: "tgt", up: 8 }],
  85: [{ fx: "melee/dagger-flurry", aim: true, up: 10 }],
  86: [{ fx: "melee/dagger-flurry", at: "tgt", up: 8 }],
  141: [{ fx: "impacts/crit-hit", at: "tgt", up: 8, pal: "blood" }],
  155: [{ fx: "melee/spin-slash", pal: "metal" }],
  157: [{ fx: "spawn/poof", at: "tgt", size: 2 }],
  // ── 창 (lancer)
  87: [{ fx: "melee/thrust", aim: true, up: 10 }],
  88: [{ fx: "impacts/ground-slam", speed: 1.8, cut: 2.4 }],
  89: [{ fx: "explosions/plasma-explosion", at: "tgt", pal: "volt" }],
  135: [{ fx: "holy/feather-burst", size: 2, speed: 1.4, cut: 2.4 }],
  142: [{ fx: "melee/whip-crack", aim: true, up: 10, size: 2 }],
  147: [{ fx: "melee/spear-sweep", aim: true, up: 6 }],
  // ── 지팡이 패시브
  113: [{ fx: "arcane/mana-burst", up: 4, speed: 1.4 }],
  // ── 마도서 (warlock)
  91: [{ fx: "projectiles/plasma-shot", to: "tgt", up: [14, 8], aim: true, pal: "arcane" },
    { fx: "arcane/mana-burst", at: "tgt", delay: "flight", speed: 1.6 }],
  92: [{ fx: "shadow/void-orb", at: "tgt", up: 10, ms: 1100 }],
  93: [{ fx: "shadow/dark-explosion", speed: 1.6, cut: 3 }],
  114: [{ fx: "shadow/hex-sigil", at: "tgt", up: 10, speed: 2.2, cut: 3.4 }],
  136: [{ fx: "holy/holy-pillar", speed: 1.4, cut: 3 }],
  144: [{ fx: "shadow/void-orb", at: "tgt", up: 10, ms: 700, pal: "blood" }],
  // ── 활 (archer)
  94: [{ fx: "impacts/hit-spark", at: "tgt", up: 8, size: 2 }],
  95: [{ fx: "spawn/poof" }],
  96: [{ fx: "arcane/star-fall", at: "tgt", pal: "metal", speed: 1.3 }],
  145: [{ fx: "impacts/crit-hit", at: "tgt", up: 8 }],
  149: [{ fx: "explosions/small-explosion", at: "tgt", delay: 260, speed: 2, cut: 2.6, opts: { size: 0.8 } }],
  150: [{ fx: "arcane/arcane-beam", aim: true, up: 12, ms: 420, pal: "bone" }],
  151: [{ fx: "spawn/poof" }],
  154: [{ fx: "nature/thorns", at: "tgt", aim: true, speed: 1.6 }],
  // ── 해머 (destroyer)
  130: [{ fx: "melee/hammer-smash", at: "tgt", speed: 1.5 }],
  131: [{ fx: "nature/earth-spike", at: "tgt", speed: 1.8, cut: 2.6 }],
  132: [{ fx: "impacts/ground-slam", at: "tgt", speed: 1.6, cut: 2.6 }],
  148: [{ fx: "impacts/ground-slam", speed: 1.6, cut: 2.4 }],
  // ── 혼합 직업 (hybrids)
  97: [{ fx: "melee/heavy-cleave", aim: true, up: 10, pal: "fire", speed: 1.6 }],
  98: [{ fx: "nature/thorns", at: "tgt", speed: 1.6 }],
  99: [{ fx: "shadow/dark-explosion", at: "tgt", speed: 1.5, cut: 3 }],
  100: [{ fx: "explosions/plasma-explosion", at: "tgt", pal: "blood" }],
  102: [{ fx: "holy/holy-pillar", speed: 1.3, cut: 3 }],
  120: [{ fx: "melee/double-slash", at: "tgt", up: 8 }],
  124: [{ fx: "melee/dagger-flurry", aim: true, up: 10, pal: "volt" }],
  125: [{ fx: "ice/icicle-fall", at: "tgt", speed: 1.6 }],
  126: [{ fx: "arcane/mana-burst", at: "tgt", up: 4 }],
  128: [{ fx: "impacts/hit-spark", at: "tgt", up: 8, size: 2, pal: "shadow" }],
  133: [{ fx: "impacts/blunt-hit", up: 10 }],
  134: [{ fx: "holy/feather-burst", up: 6, speed: 1.4, cut: 2.4 }],
};

const mods = new Map(), loads = [];
for (const layers of Object.values(PFX)) for (const l of layers) if (!mods.has(l.fx)) {
  mods.set(l.fx, null);
  loads.push(import(`./pfx/fx/${l.fx}.js`).then((m) => mods.set(l.fx, m), (e) => console.warn("pfx", l.fx, e)));
}
/** Every effect module loaded (a cast before that just skips its pixelfx layers; preview pages wait for it). */
export const ready = Promise.all(loads);

/** The caster's job colours as a dark → bright ramp (jobpal.js palette fields). */
const jobRamp = (p) => [p.d, p.md, p.m, p.l, p.w, "#ffffff"];

/** The pixelfx layers of skill `kind` (server units: src {x, y}, target tx, ty; `p` the job palette). */
export function castPfx(kind, src, tx, ty, extra, ang, p) {
  const layers = PFX[kind];
  if (!layers || lowSpec()) return;
  const dist = Math.hypot(tx - src.x, ty - src.y), fl = flightMs(dist);
  for (const l of layers) {
    const at = l.at === "tgt" ? [tx, ty] : [src.x, src.y];
    const delay = l.delay === "flight" ? fl : l.delay || 0;
    play(l, at[0] + (l.dx || 0), at[1] + (l.dy || 0), { to: l.to === "tgt" ? [tx, ty] : null, ms: fl, delay, ang, p, r: l.r ? extra || l.r : 0 });
  }
}

function play(l, wx, wy, c) {
  const mod = mods.get(l.fx);
  if (!mod || S3.fx.list.reduce((n, o) => n + (o.pfx | 0), 0) >= MAX) return;
  const meta = mod.meta, def = meta.options || {};
  const opts = { ...l.opts };
  if (l.pal) opts.palette = l.pal === "job" ? jobRamp(c.p) : RAMPS[l.pal];
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
  const inst = createFx(mod, { ...opts, x: ox, y: oy, angle: ang ? isoAng : 0, flip: false });
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
  S3.fx.add({ k: "custom", pfx: 1, flat: false, dur: durMs, delay: c.delay, draw: (g, k) => {
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
    if ((meta.loop && !c.to) || (!meta.loop && l.cut && l.cut < meta.duration)) g.globalAlpha = Math.min(1, (1 - k) * 5);
    g.drawImage(cv, Math.round((x - ox / Z) * PD) / PD, Math.round((y - oy / Z) * PD) / PD, W / Z, H / Z);
  } });
}
