/**
 * Character design.
 *
 * People are drawn as smooth, soft-shaded illustrations rather than pixels: a
 * stylised figure about three heads tall — compact enough to read at a glance,
 * but with a grown-up face, a calm palette and a costume drawn in real detail.
 * Each figure is painted with curves at four times its on-screen size, so it
 * stays clean at any zoom.
 *
 * What you wear is what you see: the armour's tier picks the outfit's cut and
 * colours, the weapon's tier its shape, its rarity an aura, a high enhancement
 * a sparkle, and an accessory hangs at the collar.
 *
 * Two views are painted (three-quarter front and back) and mirrored for the
 * four diagonal facings. Frames: 0–1 idle · 2–5 walk · 6–7 attack.
 */

export const CHAR_W = 40;
export const CHAR_H = 48;
export const FOOT_X = 20;
export const FOOT_Y = 46;
/** Height of the figure above its feet — where a name tag goes. */
export const CHAR_TOP = 38;
/** Supersampling: sheets are K times larger than they are drawn. */
export const K = 4;

export const HAIR = ["#7c5842", "#35353f", "#d6b66c", "#c26a4e", "#9684b4", "#e2e4ec"];
export const SKIN = ["#f8dcc6", "#e8ba98", "#bc8866"];
export const STYLES = ["짧은 머리", "긴 머리", "묶은 머리"];
const LINE = "#2c2430";
const RARITY = [null, "#6aa8ff", "#ffd84a", "#ff8a30"];
const TAU = Math.PI * 2;

// ───────────────────────────── colour ─────────────────────────────

function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const dk = (hex, f = 0.74) => mix(hex, f);
/** Pull a colour toward grey: costumes read as dyed cloth and worn metal, not candy. */
function soft(hex, k = 0.2) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  const l = 0.3 * r + 0.59 * gg + 0.11 * b;
  const ch = (v) => Math.round(v + (l - v) * k).toString(16).padStart(2, "0");
  return `#${ch(r)}${ch(gg)}${ch(b)}`;
}
const lt = (hex, f = 1.3) => mix(hex, f);

/** Outfit colours by armour tier: [main, secondary, trim, glow]. */
const OUTFIT = {
  warrior: [["#c8503e", "#9aa2b2", "#f0cc60"], ["#b06a3e", "#aab4c6", "#f0cc60"], ["#4468b8", "#dbe4f2", "#f6d870"], ["#343a48", "#6a7488", "#ff6a52"], ["#237c8c", "#a6eef4", "#f2ffff", "#8ff4ff"]],
  rogue: [["#555b78", "#d04a5e", "#e6cc88"], ["#6a5244", "#e07a34", "#e6cc88"], ["#345a70", "#5ccab8", "#eaf6f0"], ["#2a2c38", "#ee4668", "#c8ccd8"], ["#1f5666", "#7ef4e2", "#f2ffff", "#8ff4ff"]],
  ranger: [["#6a8a52", "#f2e6c4", "#d0ae64"], ["#96744a", "#f6ecd0", "#d0ae64"], ["#5074a8", "#eef2f8", "#f0d070"], ["#343844", "#d0d4dc", "#ffb44a"], ["#24828e", "#e2fcff", "#f2ffff", "#8ff4ff"]],
  mage: [["#7a68d8", "#f4ecff", "#f6d878"], ["#b4549a", "#ffeaf6", "#f6d878"], ["#4274cc", "#eaf6ff", "#f6d878"], ["#34305a", "#c0b0ff", "#d0b0ff"], ["#22949e", "#eaffff", "#f2ffff", "#8ff4ff"]],
};
const METAL = ["#b8bcc6", "#b8bcc6", "#dfe4ee", "#a8c8f4", "#7fe4ee", "#e49af8"];

// ───────────────────────────── drawing helpers ─────────────────────────────

function sheet() {
  const c = document.createElement("canvas");
  c.width = CHAR_W * K;
  c.height = CHAR_H * K;
  const g = c.getContext("2d");
  g.scale(K, K);
  g.lineJoin = "round";
  g.lineCap = "round";
  return [c, g];
}
/** Fill a path, then ink its edge. `fill` may be a colour or a gradient. */
function shape(g, fill, path, line = LINE, lw = 0.75) {
  g.beginPath();
  path(g);
  g.fillStyle = fill;
  g.fill();
  if (line) { g.strokeStyle = line; g.lineWidth = lw; g.stroke(); }
}
const ell = (cx, cy, rx, ry, rot = 0) => (g) => g.ellipse(cx, cy, rx, ry, rot, 0, TAU);
const box = (x, y, w, h, r) => (g) => g.roundRect(x, y, w, h, r);
const poly = (...pts) => (g) => { pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
/** Soft form shading: light from the upper left. */
function shade(g, col, x0, x1) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, lt(col, 1.12));
  gr.addColorStop(0.55, col);
  gr.addColorStop(1, dk(col, 0.8));
  return gr;
}
/** A rounded limb from a to b: inked, then coloured. */
function limb(g, x0, y0, x1, y1, w, col) {
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
  g.strokeStyle = LINE; g.lineWidth = w + 1.4; g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.stroke();
}
function glow(g, col, blur, draw) {
  g.save();
  g.shadowColor = col;
  g.shadowBlur = blur * K;
  draw();
  g.restore();
}

// ───────────────────────────── poses ─────────────────────────────
// bob: upper body drop · near/far: leg [dx, lift] · an/af: arm swing · atk: 0 none, 1 wind-up, 2 strike

const POSE = [
  { bob: 0, near: [0, 0], far: [0, 0], an: 0, af: 0, atk: 0 },
  { bob: 0.6, near: [0, 0], far: [0, 0], an: 0, af: 0, atk: 0 },
  { bob: 0.7, near: [1.6, 0], far: [-1.4, 1.2], an: -1.4, af: 1.4, atk: 0 },
  { bob: 0, near: [0.2, 0], far: [0, 2.2], an: 0, af: 0, atk: 0 },
  { bob: 0.7, near: [-1.4, 1.2], far: [1.6, 0], an: 1.4, af: -1.4, atk: 0 },
  { bob: 0, near: [0, 2.2], far: [0.2, 0], an: 0, af: 0, atk: 0 },
  { bob: -0.4, near: [-1.2, 0], far: [1.2, 0], an: 0, af: 0, atk: 1 },
  { bob: 0.9, near: [1.6, 0], far: [-1.4, 0], an: 0, af: 0, atk: 2 },
];

// ───────────────────────────── weapons ─────────────────────────────

/** Draw with the weapon's aura: rarity tints it, a high enhancement makes it blaze. */
function aura(g, o, draw) {
  const col = RARITY[o.wq | 0];
  const power = (col ? 2.2 : 0) + (o.we >= 7 ? 2.4 : o.we >= 4 ? 1 : 0);
  if (power) glow(g, col || "#ffffff", power, draw); else draw();
}
function greatsword(g, o, x0, y0, x1, y1) {
  const t = o.wt, m = METAL[t] || METAL[1];
  const n = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / n, uy = (y1 - y0) / n, px = -uy, py = ux;
  const w = 1.5 + t * 0.22, gd = 3 + t * 0.4;
  const at = (a, s) => [x0 + ux * a + px * s, y0 + uy * a + py * s];
  aura(g, o, () => {
    limb(g, ...at(0, 0), ...at(5, 0), 1.3, "#7a5236");
    shape(g, shade(g, m, x0 - 4, x0 + 6), poly(at(6, -w), at(n - 3, -w), at(n, 0), at(n - 3, w), at(6, w)));
    g.beginPath(); g.moveTo(...at(7, 0)); g.lineTo(...at(n - 3, 0)); g.strokeStyle = t >= 4 ? "#f4ffff" : dk(m, 0.86); g.lineWidth = t >= 4 ? 0.9 : 0.5; g.stroke();
    shape(g, "#f0cc60", poly(at(5, -gd), at(6.4, -gd), at(6.4, gd), at(5, gd)));
    shape(g, t >= 3 ? "#7fe4ee" : "#f0cc60", ell(...at(-0.6, 0), 1.1, 1.1));
  });
}
function dagger(g, o, x, y, ux, uy) {
  const m = METAL[o.wt] || METAL[1], len = 5 + o.wt * 0.5;
  const px = -uy, py = ux;
  aura(g, o, () => {
    limb(g, x - ux * 1.6, y - uy * 1.6, x, y, 1.2, "#4a3a44");
    shape(g, shade(g, m, x - 2, x + 4), poly([x + px * 1.1, y + py * 1.1], [x + ux * len, y + uy * len], [x - px * 1.1, y - py * 1.1]));
    shape(g, "#f0cc60", ell(x, y, 1, 1));
  });
}
function gun(g, o, x, y, tilt) {
  const t = o.wt, m = METAL[t] || METAL[1];
  const long = t >= 3 ? 13 + t : 6 + t;
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  aura(g, o, () => {
    shape(g, "#5a4234", box(0.6, 1.4, 2.4, 4.2, 0.8));
    if (t >= 3) shape(g, "#5a4234", box(-4.6, 0.2, 5, 2.8, 1));
    shape(g, shade(g, "#4a4e5c", 0, long), box(0, -1.2, long * 0.55, 3.2, 0.9));
    shape(g, shade(g, m, 0, long), box(long * 0.5, -0.6, long * 0.5, t >= 5 ? 2.8 : 1.8, 0.7));
    if (t >= 4) { g.fillStyle = "#8ff4ff"; g.fillRect(1.2, -0.5, long * 0.4, 0.7); }
    if (t >= 3) shape(g, "#3a3e4a", box(long * 0.28, 1.8, 1.8, 3, 0.5));
  });
  g.restore();
  return [x + Math.cos(tilt) * long, y + Math.sin(tilt) * long];
}
function staff(g, o, x0, y0, x1, y1, lit) {
  const t = o.wt, m = METAL[t] || METAL[1];
  const gem = ["", "#8ad8f0", "#8ad8f0", "#b6a0ff", "#8ff4ff", "#ff9af0"][t] || "#8ad8f0";
  limb(g, x0, y0, x1, y1, 1.3, "#9a6e48");
  aura(g, o, () => {
    if (t >= 3) {
      g.beginPath(); g.arc(x1, y1 - 1.5, 3.4, 0.25 * Math.PI, 1.9 * Math.PI);
      g.strokeStyle = LINE; g.lineWidth = 2.2; g.stroke(); g.strokeStyle = m; g.lineWidth = 1.2; g.stroke();
    } else shape(g, "#b4885c", ell(x1, y1 - 0.4, 2, 1.6));
    glow(g, gem, lit || t >= 4 ? 3 : 1.2, () => shape(g, gem, ell(x1, y1 - 1.6, 1.5 + t * 0.14, 1.7 + t * 0.14)));
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x1 - 0.5, y1 - 2.2, 0.5, 0, TAU); g.fill();
  });
}

// ───────────────────────────── the head ─────────────────────────────

/** The head is drawn a touch smaller than its construction lines, pivoting on the neck. */
function head(g, o, back, by) {
  const k = 0.86;
  g.save();
  g.translate(20.2, 25.4 + by); g.scale(k, k); g.translate(-20.2, -(25.4 + by));
  headShape(g, o, back, by);
  g.restore();
}
function headShape(g, o, back, by) {
  const hair = o.hairCol, skin = o.skinCol;
  const hx = 20.2, hy = 17.4 + by;
  const hg = shade(g, hair, hx - 9, hx + 9);
  if (o.bone) {
    shape(g, shade(g, "#eef0f6", 12, 29), ell(hx, hy, 7.4, 7));
    if (!back) {
      for (const [x, r] of [[17.8, 1.5], [23.4, 1.3]]) { shape(g, "#2a2434", ell(x, hy + 1, r, 2), null); glow(g, o.eye, 1.4, () => shape(g, o.eye, ell(x, hy + 1.4, 0.7, 0.9), null)); }
      g.strokeStyle = LINE; g.lineWidth = 0.5; g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(18.4 + i * 1.4, hy + 4.6); g.lineTo(18.4 + i * 1.4, hy + 6); } g.stroke();
    }
    return;
  }
  // hair that falls behind the head and shoulders
  if (o.style === 1) shape(g, hg, back ? box(11.6, hy - 3, 17.2, 17.5, 6) : box(11.8, hy - 2, 16.8, 15.5, 6));
  else if (o.style === 2) {
    if (back) shape(g, hg, (p) => { p.moveTo(18.6, hy + 5); p.quadraticCurveTo(16.4, hy + 12, 20, hy + 17.5); p.quadraticCurveTo(23.4, hy + 12, 21.8, hy + 5); p.closePath(); });
    else shape(g, hg, (p) => { p.moveTo(13, hy - 2); p.quadraticCurveTo(7.5, hy + 4, 10.4, hy + 13); p.quadraticCurveTo(13.5, hy + 7, 14.4, hy + 1); p.closePath(); });
  }
  shape(g, hg, ell(hx, hy - 0.6, 8.3, 7.7));
  if (back) {
    shape(g, hg, ell(hx, hy, 8.2, 7.5));
    shape(g, shade(g, skin, 24, 30), ell(27.6, hy + 2, 1.3, 1.7));
    g.beginPath(); g.moveTo(15, hy - 3.5); g.quadraticCurveTo(19, hy - 6.5, 24, hy - 4.6);
    g.strokeStyle = lt(hair, 1.35); g.lineWidth = 1.1; g.stroke();
    g.beginPath(); g.moveTo(16, hy + 3); g.quadraticCurveTo(20, hy + 6, 24.5, hy + 3); g.strokeStyle = dk(hair, 0.82); g.lineWidth = 0.6; g.stroke();
    if (o.style === 2) { shape(g, o.accent, poly([20.2, hy + 5.6], [17.2, hy + 4.2], [17.6, hy + 7]), LINE, 0.5); shape(g, o.accent, poly([20.2, hy + 5.6], [23.2, hy + 4.2], [22.8, hy + 7]), LINE, 0.5); }
  } else {
    // face
    shape(g, shade(g, skin, 10, 34), ell(12.9, hy + 1.6, 1.3, 1.7));
    shape(g, shade(g, skin, 8, 36), ell(hx + 0.2, hy + 0.6, 7.3, 6.7));
    g.fillStyle = "rgba(240,120,120,.13)";
    g.beginPath(); g.ellipse(16.6, hy + 3.9, 1.7, 0.8, 0, 0, TAU); g.ellipse(25.2, hy + 3.9, 1.5, 0.8, 0, 0, TAU); g.fill();
    // almond eyes under a firm lash line — alert rather than wide-eyed
    for (const [x, rx] of [[17.8, 1.3], [23.9, 1.15]]) {
      shape(g, "#f6f2ee", ell(x, hy + 1.7, rx, 1.5), null);
      shape(g, o.eye, ell(x + 0.1, hy + 1.9, rx * 0.72, 1.25), null);
      shape(g, "#241c28", ell(x + 0.1, hy + 2, rx * 0.36, 0.7), null);
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x - rx * 0.25, hy + 1.2, 0.36, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(x - rx - 0.35, hy + 1.3); g.quadraticCurveTo(x, hy - 0.5, x + rx + 0.45, hy + 1.1);
      g.strokeStyle = "#241c28"; g.lineWidth = 0.75; g.stroke();
      g.beginPath(); g.moveTo(x - rx - 0.2, hy - 1.2); g.lineTo(x + rx + 0.3, hy - 1.7 + (x > 20 ? 0.4 : 0));
      g.strokeStyle = dk(hair, 0.62); g.lineWidth = 0.5; g.stroke();
    }
    g.beginPath(); g.moveTo(20.3, hy + 5); g.lineTo(21.9, hy + 5); g.strokeStyle = "#9a5a58"; g.lineWidth = 0.45; g.stroke();
    // fringe: a sweep of soft points over the brow
    shape(g, hg, (p) => {
      p.moveTo(12.3, hy + 1.6);
      p.bezierCurveTo(11.2, hy - 7.5, 16.5, hy - 8.6, 20.4, hy - 8.3);
      p.bezierCurveTo(25.6, hy - 8.2, 29.4, hy - 5, 28.1, hy + 1.2);
      p.quadraticCurveTo(27.4, hy - 1.6, 26, hy - 2.2);
      p.quadraticCurveTo(25.6, hy - 0.2, 24.4, hy + 0.3);
      p.quadraticCurveTo(24.2, hy - 1.8, 22.6, hy - 2.8);
      p.quadraticCurveTo(21.8, hy - 0.6, 19.8, hy + 0.2);
      p.quadraticCurveTo(19.8, hy - 1.8, 18.6, hy - 2.8);
      p.quadraticCurveTo(17, hy - 1, 15.4, hy + 0.9);
      p.quadraticCurveTo(15.2, hy - 0.8, 14.6, hy - 1.6);
      p.quadraticCurveTo(13.4, hy + 0.6, 13.6, hy + 3.6);
      p.closePath();
    });
    g.beginPath(); g.moveTo(15.4, hy - 4.6); g.quadraticCurveTo(19.5, hy - 7.4, 24.4, hy - 5.6);
    g.strokeStyle = lt(hair, 1.4); g.lineWidth = 1.1; g.stroke();
  }
  // headwear
  const top = hy - 7.6;
  if (o.cls === "warrior") {
    g.beginPath(); g.moveTo(12.4, hy - 2.2); g.quadraticCurveTo(20, hy - 4.6, 28, hy - 2.4); g.strokeStyle = LINE; g.lineWidth = 2; g.stroke(); g.strokeStyle = o.accent; g.lineWidth = 1.2; g.stroke();
    if (o.at >= 3 && !back) shape(g, o.trim, poly([20, hy - 5.6], [21.6, hy - 3.4], [20, hy - 2.2], [18.4, hy - 3.4]));
  } else if (o.cls === "ranger") {
    shape(g, shade(g, o.main, 11, 30), (p) => { p.moveTo(11.8, hy - 2.6); p.bezierCurveTo(11.4, top - 2.6, 28.6, top - 3.4, 28.8, hy - 3); p.quadraticCurveTo(20, hy - 5.4, 11.8, hy - 2.6); p.closePath(); });
    if (!back) shape(g, dk(o.main), (p) => { p.moveTo(19, hy - 3.6); p.quadraticCurveTo(27, hy - 4.6, 31, hy - 1.4); p.quadraticCurveTo(26, hy - 2.6, 19, hy - 2.2); p.closePath(); });
    if (o.at >= 2 && !back) { shape(g, "#3a3e4a", box(14.6, hy - 6.6, 10.6, 2.4, 1.1)); glow(g, "#8ff4ff", o.at >= 4 ? 1.5 : 0, () => { shape(g, "#9fe8f4", ell(17.4, hy - 5.4, 1.5, 0.95)); shape(g, "#9fe8f4", ell(22.6, hy - 5.4, 1.5, 0.95)); }); }
  } else if (o.cls === "mage") {
    if (o.at >= 2) {
      // a soft pointed hat, its tip flopping back
      shape(g, shade(g, o.main, 10, 30), (p) => { p.moveTo(11.4, hy - 3); p.quadraticCurveTo(14.5, top - 7, 12.6, top - 10.5); p.quadraticCurveTo(22, top - 9.5, 28.8, hy - 3.4); p.quadraticCurveTo(20, hy - 6, 11.4, hy - 3); p.closePath(); });
      shape(g, shade(g, dk(o.main, 0.88), 8, 32), (p) => { p.moveTo(8.6, hy - 2); p.quadraticCurveTo(20, hy - 7.4, 31.6, hy - 2.4); p.quadraticCurveTo(20, hy - 3.6, 8.6, hy - 2); p.closePath(); });
      g.beginPath(); g.moveTo(12.4, hy - 3.9); g.quadraticCurveTo(20, hy - 6.6, 28, hy - 4.2); g.strokeStyle = o.trim; g.lineWidth = 0.9; g.stroke();
      if (!back) glow(g, "#fff6b0", 1, () => shape(g, o.trim, poly([16, hy - 8.4], [16.8, hy - 6.8], [18.4, hy - 6.6], [17.2, hy - 5.6], [17.5, hy - 4], [16, hy - 4.9], [14.5, hy - 4], [14.8, hy - 5.6], [13.6, hy - 6.6], [15.2, hy - 6.8]), null));
    } else if (!back) { shape(g, o.sub, poly([24.6, hy - 6.6], [28.6, hy - 8.4], [27.6, hy - 5.2], [29.6, hy - 2.6], [25.8, hy - 4])); shape(g, o.trim, ell(25.6, hy - 5.2, 1, 1)); }
  } else if (o.cls === "rogue") {
    if (!back) shape(g, o.sub, (p) => { p.moveTo(12.6, hy - 2.4); p.quadraticCurveTo(20, hy - 5.2, 27.8, hy - 2.8); p.lineTo(27.6, hy - 4.4); p.quadraticCurveTo(20, hy - 7, 12.8, hy - 4.2); p.closePath(); });
    else { shape(g, o.sub, box(12.4, hy - 4.4, 15.6, 2, 0.9)); shape(g, o.sub, poly([19, hy - 3], [16.6, hy + 2.6], [18.8, hy + 1.2], [20, hy + 3.4], [21, hy - 3])); }
  }
  if (o.beard && !back) shape(g, "#eef0f6", (p) => { p.moveTo(15, hy + 3.4); p.quadraticCurveTo(20.4, hy + 5, 25.6, hy + 3.4); p.quadraticCurveTo(25, hy + 10, 20.4, hy + 12.4); p.quadraticCurveTo(15.6, hy + 10, 15, hy + 3.4); p.closePath(); });
}

// ───────────────────────────── the figure ─────────────────────────────

function figure(o, back, f) {
  const [c, g] = sheet();
  const P = POSE[f], by = P.bob, cls = o.cls, atk = P.atk;
  const walking = f >= 2 && f <= 5;
  const sway = walking ? [0, 1, 0, -1][f - 2] : 0;
  const main = o.main, sub = o.sub, trim = o.trim, skin = o.skinCol;
  const T = 25 + by;                      // top of the torso
  const lit = (draw) => (o.glow ? glow(g, o.glow, 1.6, draw) : draw());
  const robe = cls === "mage" || cls === "robe";

  // ── behind everything
  if (cls === "warrior" && !back) {
    if (!atk) greatsword(g, o, 27.4, 13 + by, 13.5, 35 + by);
    shape(g, shade(g, o.cape, 12, 29), (p) => { p.moveTo(14.4, T + 1); p.lineTo(26.4, T + 1); p.quadraticCurveTo(28.6 + sway, T + 10, 27 + sway, 41 + by); p.lineTo(13.6 + sway, 41 + by); p.quadraticCurveTo(12.4 + sway, T + 10, 14.4, T + 1); p.closePath(); });
  }
  if (cls === "rogue" && !back) shape(g, shade(g, sub, 6, 16), (p) => { p.moveTo(14.5, T); p.quadraticCurveTo(9 - sway, T + 3, 8 - sway * 1.4, T + 10.5); p.lineTo(10.6 - sway, T + 9.4); p.quadraticCurveTo(11.6, T + 5, 15.4, T + 2.4); p.closePath(); });
  if (cls === "mage" && !atk && !back) staff(g, o, 10.6, 46, 10.6, 13 + by, false);
  if (cls === "ranger" && back) { if (atk) gun(g, o, 21, 29 + by, -0.5); else gun(g, o, 20, 32 + by, 0.5); }

  // ── arms: how far each swings and lifts
  let an = P.an, af = P.af, upN = 0, upF = 0, reachN = 0;
  if (atk) {
    if (cls === "warrior") { upN = upF = atk === 1 ? 7 : 2; reachN = 2.4; af = 1.4; }
    else if (cls === "rogue") { upN = atk === 2 ? 4 : 1; reachN = atk === 2 ? 5 : -2; upF = 2; }
    else if (cls === "ranger") { upN = upF = 5; reachN = 4; af = 1.4; }
    else { upN = 5; reachN = 4; }
  } else if (cls === "ranger") { upN = upF = 3; reachN = 3; af = 1; }
  const sleeve = cls === "warrior" ? dk(main, 0.9) : cls === "rogue" ? skin : main;
  const handF = [26.6 + af, T + 9.4 - upF], handN = [13.6 + an + reachN, T + 9.6 - upN];
  limb(g, 25.4, T + 2.4, handF[0], handF[1], 2.5, dk(sleeve, 0.9));
  shape(g, cls === "warrior" || cls === "ranger" ? dk(o.glove, 0.88) : dk(skin, 0.92), ell(handF[0], handF[1] + 0.4, 1.5, 1.5));

  // ── legs (a robe hides them down to the boots)
  for (const [x, [dx, lift], far] of [[21.3, P.far, 1], [16.2, P.near, 0]]) {
    const sx = x + dx * 0.8, bot = 42.2 - lift;
    if (!robe) limb(g, x + 1.6, 33.4 + by * 0.5, sx + 1.6, bot, 2.9, far ? dk(o.pants, 0.86) : o.pants);
    shape(g, shade(g, far ? dk(o.boot, 0.86) : o.boot, sx - 1, sx + 6), box(sx - 0.5, bot - 1.2, 4.8 + (back ? 0 : 0.6), 5, 1.9));
    if (cls === "warrior" && !robe) shape(g, far ? dk(sub, 0.86) : sub, box(sx - 0.2, bot - 5.2, 3.8, 3.4, 1.2));
  }

  // ── torso and costume
  const torso = box(15.2, T, 10, 10, 3);
  if (cls === "warrior") {
    shape(g, shade(g, main, 14, 27), torso);
    lit(() => shape(g, shade(g, sub, 14, 27), box(15.6, T + 0.6, 9.2, 5.6, 2.4)));
    if (!back) { shape(g, main, poly([18.6, T + 4.4], [21.8, T + 4.4], [21.4, T + 10.6], [19, T + 10.6])); shape(g, trim, ell(20.2, T + 3, 1.1, 1.1)); }
    shape(g, "#7a5236", box(15.2, T + 7, 10, 1.7, 0.6)); shape(g, trim, box(19.3, T + 6.8, 1.9, 2.1, 0.5));
    const pr = 2.5 + o.at * 0.32;
    lit(() => { shape(g, shade(g, sub, 11, 18), ell(14.4, T + 1.5, pr, pr * 0.74)); shape(g, dk(sub, 0.88), ell(26, T + 1.5, pr * 0.84, pr * 0.66)); });
    if (o.at >= 4) { g.fillStyle = trim; g.fillRect(12.6, T + 1.2, 3.6, 0.6); }
    if (back) {
      shape(g, shade(g, o.cape, 12, 29), (p) => { p.moveTo(14.2, T + 1.6); p.lineTo(26.2, T + 1.6); p.quadraticCurveTo(28.8 + sway, T + 10, 27.2 + sway, 41 + by); p.lineTo(13.2 + sway, 41 + by); p.quadraticCurveTo(11.8 + sway, T + 10, 14.2, T + 1.6); p.closePath(); });
      g.beginPath(); g.moveTo(17, T + 4); g.lineTo(16.4 + sway, 39 + by); g.moveTo(23.4, T + 4); g.lineTo(24 + sway, 39 + by); g.strokeStyle = dk(o.cape, 0.8); g.lineWidth = 0.6; g.stroke();
      if (!atk) greatsword(g, o, 12.4, 12 + by, 28, 35 + by);
    }
  } else if (cls === "rogue") {
    shape(g, shade(g, main, 14, 27), torso);
    if (!back) { g.beginPath(); g.moveTo(16, T + 1.4); g.lineTo(24.4, T + 8); g.strokeStyle = "#7a5236"; g.lineWidth = 1.1; g.stroke(); shape(g, trim, ell(20.4, T + 4.8, 0.9, 0.9)); }
    shape(g, "#7a5236", box(15.2, T + 7.2, 10, 1.6, 0.6));
    if (o.at >= 3) lit(() => shape(g, shade(g, lt(main, 1.25), 11, 18), ell(14.6, T + 1.6, 2.4, 1.8)));
    // a big scarf round the neck
    shape(g, shade(g, sub, 13, 28), (p) => { p.moveTo(14.4, T - 0.6); p.quadraticCurveTo(20.2, T + 3.4, 26, T - 0.6); p.quadraticCurveTo(26.6, T + 2.2, 24, T + 3.2); p.quadraticCurveTo(20, T + 4.6, 16.2, T + 3.2); p.quadraticCurveTo(13.8, T + 2.2, 14.4, T - 0.6); p.closePath(); });
    if (back) shape(g, shade(g, sub, 16, 24), (p) => { p.moveTo(18.4 + sway, T + 2.6); p.quadraticCurveTo(16.4 + sway * 2, T + 9, 18.6 + sway * 2, T + 13.4); p.lineTo(21.4 + sway * 2, T + 12); p.quadraticCurveTo(20.6 + sway, T + 7, 22, T + 2.8); p.closePath(); });
  } else if (cls === "ranger") {
    shape(g, shade(g, sub, 14, 27), torso);
    shape(g, "#7a5236", box(15.2, T + 7.2, 10, 1.6, 0.6));
    const hem = T + 12.6 + (o.at >= 3 ? 2.6 : 0);
    if (back) {
      shape(g, shade(g, main, 13, 28), (p) => { p.moveTo(14.6, T - 0.2); p.lineTo(25.8, T - 0.2); p.quadraticCurveTo(27.6 + sway, T + 7, 26.8 + sway, hem); p.lineTo(13.6 + sway, hem); p.quadraticCurveTo(12.8 + sway, T + 7, 14.6, T - 0.2); p.closePath(); });
      shape(g, shade(g, o.pack, 16, 25), box(16.6, T + 2, 7.4, 6.4, 1.8)); shape(g, trim, box(19.4, T + 4.2, 1.8, 1.4, 0.4));
    } else {
      // an open jacket: two panels with the shirt between them
      shape(g, shade(g, main, 13, 20), (p) => { p.moveTo(14.6, T - 0.2); p.lineTo(18.6, T - 0.2); p.lineTo(18.2, T + 5); p.lineTo(17.6 + sway, hem); p.lineTo(13.8 + sway, hem); p.quadraticCurveTo(13, T + 6, 14.6, T - 0.2); p.closePath(); });
      shape(g, shade(g, dk(main, 0.9), 21, 28), (p) => { p.moveTo(25.8, T - 0.2); p.lineTo(22, T - 0.2); p.lineTo(22.4, T + 5); p.lineTo(23 + sway, hem); p.lineTo(26.6 + sway, hem); p.quadraticCurveTo(27.4, T + 6, 25.8, T - 0.2); p.closePath(); });
      shape(g, o.pack, box(18.4, T + 8.2, 2.6, 2.4, 0.6));
      if (o.at >= 4) { g.fillStyle = trim; g.fillRect(14.6, T + 3, 3.2, 0.7); }
    }
  } else if (robe) {
    const hem = 43.4;
    // a dress-length robe that flares toward the hem
    shape(g, shade(g, main, 12, 29), (p) => { p.moveTo(15.4, T + 1); p.lineTo(25, T + 1); p.quadraticCurveTo(27.6 + sway * 0.6, T + 10, 28.6 + sway, hem); p.quadraticCurveTo(20.2, hem + 2, 11.8 + sway, hem); p.quadraticCurveTo(12.8 + sway * 0.6, T + 10, 15.4, T + 1); p.closePath(); });
    g.beginPath(); g.moveTo(12.6 + sway, hem - 1.6); g.quadraticCurveTo(20.2, hem + 0.6, 27.8 + sway, hem - 1.6); g.strokeStyle = trim; g.lineWidth = 1; g.stroke();
    if (!back) { g.beginPath(); g.moveTo(20.2, T + 3); g.lineTo(20.2, hem - 1.4); g.strokeStyle = trim; g.lineWidth = 0.8; g.stroke(); }
    shape(g, o.sash || trim, box(15.4, T + 6.6, 9.6, 1.9, 0.7));
    if (cls === "mage") {
      lit(() => shape(g, shade(g, sub, 12, 29), (p) => { p.moveTo(13.2, T + 0.2); p.quadraticCurveTo(20.2, T - 2.4, 27.2, T + 0.2); p.quadraticCurveTo(28.4, T + 3.6, 26.4, T + 5.4); p.quadraticCurveTo(20.2, T + 7.2, 14, T + 5.4); p.quadraticCurveTo(12, T + 3.6, 13.2, T + 0.2); p.closePath(); }));
      g.beginPath(); g.moveTo(14.2, T + 4.6); g.quadraticCurveTo(20.2, T + 6.2, 26.2, T + 4.6); g.strokeStyle = trim; g.lineWidth = 0.8; g.stroke();
      if (!back) glow(g, "#bff4ff", 1.2, () => shape(g, "#8ad8f0", ell(20.2, T + 1.6, 1.2, 1.3)));
    }
  } else {
    // townsfolk: a tunic, with an apron for those who work
    shape(g, shade(g, main, 14, 27), torso);
    shape(g, "#7a5236", box(15.2, T + 7.2, 10, 1.6, 0.6));
    if (!back && o.apron) shape(g, shade(g, o.apron, 15, 26), box(16.4, T + 2.4, 7.6, 11.4, 1.6));
  }
  if (o.acc && !back) glow(g, o.acc >= 4 ? "#8ff4ff" : "#fff2a8", 1.2, () => shape(g, o.acc >= 4 ? "#8ff4ff" : o.acc >= 3 ? "#eef0f6" : "#e8a860", ell(20.2, T + 0.9, 1, 1.1)));

  head(g, o, back, by);

  // ── near arm and whatever it holds
  limb(g, 15, T + 2.4, handN[0], handN[1], 2.6, sleeve);
  if (cls === "rogue") { g.beginPath(); g.moveTo(14.2 + an * 0.6 + reachN * 0.6, T + 6.4 - upN * 0.6); g.lineTo(handN[0], handN[1]); g.strokeStyle = dk(main); g.lineWidth = 2.6; g.stroke(); }
  if (cls === "warrior" && atk === 1) greatsword(g, o, handN[0] + 1, handN[1], back ? 27 : 24, by - 1);
  if (cls === "warrior" && atk === 2) greatsword(g, o, handN[0] + 1, handN[1] + 1, back ? 37 : 35, back ? 16 + by : 37 + by);
  if (cls === "rogue") {
    if (atk === 2) dagger(g, o, handN[0] + 1, handN[1], 1, back ? -0.4 : 0.25);
    else if (atk === 1) dagger(g, o, handN[0] - 1, handN[1], -0.8, -0.6);
    else { dagger(g, o, handN[0] - 0.4, handN[1] + 1, -0.35, 0.94); if (!back) dagger(g, o, handF[0] + 0.4, handF[1] + 1, 0.35, 0.94); }
  }
  if (cls === "ranger" && !back) {
    const tip = atk ? gun(g, o, handN[0] - 1.6, handN[1] - 0.4, atk === 1 ? -0.16 : 0) : gun(g, o, handN[0] - 2, handN[1] - 0.6, 0.32);
    if (atk === 1) glow(g, "#ffd24a", 2, () => shape(g, "#fff6c8", poly([tip[0], tip[1] - 1.6], [tip[0] + 4.4, tip[1] - 0.2], [tip[0], tip[1] + 1.4], [tip[0] + 1.4, tip[1]]), null));
  }
  if (cls === "mage") {
    if (atk) staff(g, o, handN[0] - 3, handN[1] + 5, handN[0] + 9, handN[1] - 9, true);
    else if (back) staff(g, o, 10.6, 46, 10.6, 13 + by, false);
  }
  shape(g, cls === "warrior" || cls === "ranger" ? o.glove : skin, ell(handN[0], handN[1] + 0.4, 1.6, 1.6));
  return c;
}

// ───────────────────────────── public API ─────────────────────────────

const cache = new Map();
/** A character sheet. Frames are painted the first time each one is needed. */
export function charSprite(o) {
  const key = JSON.stringify(o);
  let s = cache.get(key);
  if (!s) { s = { o, front: [], back: [] }; cache.set(key, s); }
  return s;
}
/** One frame of a sheet (as painted: facing right). */
export function frameOf(s, back, f) {
  const list = back ? s.back : s.front;
  return list[f] || (list[f] = figure(s.o, back, f));
}
/**
 * Draw a character with its top-left at (x, y). dir: 0 down-left · 1 up-left ·
 * 2 down-right · 3 up-right — the grid's four axes as they appear on screen.
 */
export function drawFigure(g, s, dir, f, x, y, w = CHAR_W, h = CHAR_H) {
  const img = frameOf(s, dir === 1 || dir === 3, f);
  if (dir < 2) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img, 0, 0, w, h); g.restore(); }
  else g.drawImage(img, x, y, w, h);
}

function base(look) {
  return { hair: look[0] | 0, skin: look[1] | 0, style: look[2] | 0, hairCol: HAIR[look[0] | 0] || HAIR[0], skinCol: SKIN[look[1] | 0] || SKIN[0], eye: "#4a78c8" };
}
/**
 * A player's look. `gear`: at/aq armour tier and rarity · wt/wq/we weapon tier,
 * rarity and enhancement · acc accessory tier.
 */
export function playerLook(cls, look, gear = {}) {
  if (!OUTFIT[cls]) cls = "warrior";
  const at = Math.max(1, Math.min(5, gear.at | 0 || 1));
  const [m0, s0, trim, glw] = OUTFIT[cls][at - 1];
  const main = soft(m0, 0.22), sub = soft(s0, 0.12);
  const o = { ...base(look), cls, at, main, sub, trim, glow: glw || null, wt: Math.max(1, Math.min(5, gear.wt | 0 || 1)), wq: gear.wq | 0, we: gear.we | 0, acc: gear.acc | 0 };
  o.eye = ["#4a78c8", "#3f9a6a", "#b8683a", "#8a5ac8"][(o.hair + o.skin) % 4];
  if (cls === "warrior") Object.assign(o, { cape: at >= 4 ? dk(trim, 0.8) : dk(main, 0.86), accent: "#e04a4a", pants: "#5a5670", boot: sub, glove: sub });
  else if (cls === "rogue") Object.assign(o, { accent: sub, pants: dk(main, 0.86), boot: "#4a4458", glove: "#4a4458" });
  else if (cls === "ranger") Object.assign(o, { accent: trim, pants: "#6a6478", boot: "#6a4a38", glove: "#5a4636", pack: "#b08a58" });
  else Object.assign(o, { accent: trim, pants: main, boot: "#5a4a78", sash: at >= 4 ? trim : "#7ad8e8" });
  return o;
}
export function npcLook(look, role) {
  const col = look[3] || "#667";
  const o = { ...base(look), main: col, sub: lt(col), trim: "#f0cc60", accent: "#f0cc60", pants: "#5a5468", boot: "#6a4a38", glove: "#6a4a38", at: 1, wt: 2 };
  if (role === "elder") return { ...o, cls: "robe", beard: 1 };
  if (role === "smith") return { ...o, cls: "npc", apron: "#6a5a52" };
  if (role === "shop") return { ...o, cls: "npc", apron: "#fff4e4" };
  if (role === "train") return { ...o, cls: "npc" };
  return { ...o, cls: "warrior", at: 3, sub: "#c8d0e0", cape: dk(col, 0.8), boot: "#c8d0e0", glove: "#c8d0e0" };
}
/** Humanoid monsters reuse the same figure with their own wardrobe. */
export function mobLook(kind) {
  if (kind === "thug") return { ...base([1, 1, 0]), cls: "rogue", at: 2, main: "#8a3a44", sub: "#e8e4d8", trim: "#d0d0d8", accent: "#e8e4d8", pants: "#3c3e4a", boot: "#2a2a32", glove: "#2a2a32", eye: "#c83a3a", wt: 2 };
  return { ...base([5, 0, 0]), cls: "warrior", bone: 1, at: 3, eye: "#6ae8f4", main: "#4a4866", sub: "#7a7896", trim: "#6ae8f4", accent: "#6ae8f4", cape: "#2c2a40", pants: "#34324a", boot: "#7a7896", glove: "#7a7896", wt: 3 };
}
