import { fxPal, skillDef } from "./jobpal.js";

const RANGE_SQ = 240 ** 2;
const MAX_FX = 96;
const facing = [[0, 1], [-1, 0], [1, 0], [0, -1]];

function poly(g, color, x, y, vertices, scale = 1, mirror = 1) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < vertices.length; i += 2) {
    const px = Math.round(x + vertices[i] * scale * mirror);
    const py = Math.round(y + vertices[i + 1] * scale);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.fill();
}

function dot(g, color, x, y, size = 2) {
  g.fillStyle = color;
  g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}

function stroke(g, color, ax, ay, bx, by, width) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(Math.round(ax), Math.round(ay));
  g.lineTo(Math.round(bx), Math.round(by));
  g.stroke();
}

const bladeSilhouette = [-28, -28, -18, -43, -10, -40, -5, -28, 0, -15, 8, -8, 16, -6, 11, -1, 0, 0, -11, -7, -22, -17];
const bladeEdge = [-23, -28, -18, -37, -12, -32, -8, -21, 1, -10, 9, -7, 15, -6, 8, -4, -2, -7, -12, -13];
const emberTongue = [-10, 0, -11, -8, -7, -15, -7, -24, -2, -20, 1, -36, 5, -29, 6, -17, 11, -21, 10, -8, 6, -2, 0, 1];
const emberCore = [-4, -2, -5, -9, -1, -13, 2, -26, 5, -18, 5, -9, 2, -3];
const shard = [0, -5, 3, -2, 3, 1, 0, 5, -3, 2, -3, -1];

function cleave(S3, x, y, p, opacity, mirror) {
  S3.fxCustom((g, t) => {
    if (t < 0.54) {
      const drop = Math.min(1, t / 0.24);
      g.globalAlpha = opacity * (1 - Math.max(0, (t - 0.30) / 0.24));
      const base = y - 20 * (1 - drop * drop);
      poly(g, p.md, x, base, bladeSilhouette, 1, mirror);
      poly(g, drop < 1 ? p.l : p.w, x, base, bladeEdge, 1, mirror);
    }
    if (t < 0.21) return;
    const q = (t - 0.21) / 0.79;
    g.globalAlpha = opacity * (1 - q);
    for (let i = 0; i < 5; i++) {
      const sx = x + mirror * (4 + i * 5) * q;
      const sy = y - 4 - (10 + (i % 3) * 7) * Math.sin(q * Math.PI) - i;
      stroke(g, i % 2 ? p.a : p.l, sx, sy, sx - mirror * (2 + i % 2), sy + 3, 1);
    }
  }, 300);
}

function rupture(S3, x, y, p, opacity, marks) {
  const hot = marks >= 3;
  const rays = [[-1, -0.18], [0.92, 0.2], [0.3, -0.85], [-0.25, 0.82], [-0.74, -0.64], [0.69, -0.62], [0.65, 0.63]];
  S3.fxCustom((g, t) => {
    g.globalAlpha = opacity * (1 - t);
    for (let i = 0; i < (hot ? rays.length : 4); i++) {
      const [dx, dy] = rays[i];
      const distance = 5 + (hot ? 31 : 12) * t;
      const px = x + dx * distance, py = y + dy * distance;
      const color = t < 0.24 ? p.w : i % 2 ? p.a : p.m;
      poly(g, color, px, py, shard, 1 - 0.6 * t, Math.sign(dx));
      if (hot && t > 0.22) dot(g, p.l, px - dx * 6, py - dy * 4, 1);
    }
  }, hot ? 340 : 250);
}

function hook(S3, ax, ay, bx, by, p, opacity) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const links = Math.min(13, Math.max(2, Math.floor(len / 7)));
  const nx = -dy / len, ny = dx / len;
  S3.fxCustom((g, t) => {
    const progress = t < 0.35 ? t / 0.35 : 1 - Math.max(0, t - 0.42) / 0.58;
    g.globalAlpha = opacity * (1 - Math.max(0, t - 0.78) / 0.22);
    const x = ax + dx * progress, y = ay + dy * progress;
    stroke(g, p.md, ax, ay, x, y, 2);
    for (let i = 1; i <= Math.ceil(links * progress); i++) {
      const u = Math.min(progress, i / links);
      const px = ax + dx * u, py = ay + dy * u;
      const q = i % 2 ? 2.4 : -2.4;
      stroke(g, p.d, px - dx * 0.018 - nx * q, py - dy * 0.018 - ny * q, px + dx * 0.018 + nx * q, py + dy * 0.018 + ny * q, 3);
      stroke(g, i % 2 ? p.l : p.m, px - dx * 0.018 - nx * q, py - dy * 0.018 - ny * q, px + dx * 0.018 + nx * q, py + dy * 0.018 + ny * q, 1);
    }
    stroke(g, p.l, x - dx / len * 6, y - dy / len * 6, x, y, 4);
    stroke(g, p.w, x, y, x - dx / len * 3 + nx * 4, y - dy / len * 3 + ny * 4, 2);
  }, 305);
}

function ignite(S3, x, y, p, opacity) {
  S3.fxCustom((g, t) => {
    for (let i = 0; i < 3; i++) {
      const q = (t - i * 0.07) / (1 - i * 0.07);
      if (q < 0 || q > 0.7) continue;
      const px = x + (i - 1) * 13, py = y + (i % 2) * 3;
      const height = (0.35 + 0.65 * Math.sin(q * Math.PI / 0.70)) * (i === 1 ? 1.05 : 0.7);
      g.globalAlpha = opacity * (1 - q);
      poly(g, p.m, px, py, emberTongue, height, i === 2 ? -1 : 1);
      poly(g, q < 0.24 ? p.w : p.l, px, py, emberCore, height, i === 2 ? -1 : 1);
    }
    g.globalAlpha = opacity * (1 - t);
    for (let i = 0; i < 8; i++) {
      const px = x + (i - 3.5) * (4 + t * 6);
      const py = y - (10 + i % 3 * 6) - t * (25 + i % 4 * 4);
      dot(g, i % 3 ? p.m : p.l, px, py, i % 2 + 1);
    }
  }, 410);
}

function drain(S3, ax, ay, bx, by, p, opacity, phase) {
  S3.fxCustom((g, t) => {
    g.globalAlpha = opacity * (1 - t);
    g.strokeStyle = p.md;
    g.lineWidth = phase === 2 ? 3 : 2;
    g.beginPath();
    g.moveTo(Math.round(bx), Math.round(by));
    for (let i = 1; i <= 8; i++) {
      const q = i / 8;
      const wobble = Math.sin(q * Math.PI) * Math.sin(q * 15 - t * 7) * 6;
      g.lineTo(Math.round(bx + (ax - bx) * q), Math.round(by + (ay - by) * q + wobble));
    }
    g.stroke();
    for (let i = 0; i < 7; i++) {
      const q = (i / 7 + t * 0.63) % 1;
      const px = bx + (ax - bx) * q;
      const py = by + (ay - by) * q + Math.sin(q * 16 - i % 2 * 1.3) * (phase === 2 ? 7 : 4);
      const tx = px + (bx - ax) * 0.055, ty = py + (by - ay) * 0.055;
      stroke(g, p.md, px, py, tx, ty, 3);
      stroke(g, i % 2 ? p.al : p.l, px, py, tx, ty, 1);
      if (phase === 2 && i % 2 === 0) dot(g, p.w, px, py, 2);
    }
  }, phase === 2 ? 300 : 210);
}

function snipe(S3, ax, ay, bx, by, p, opacity) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  S3.fxCustom((g, t) => {
    const head = Math.min(1, 0.06 + t / 0.45), tail = Math.max(0, head - 0.45 * (1 - t));
    const x = ax + head * dx, y = ay + head * dy;
    g.globalAlpha = opacity * (1 - t);
    stroke(g, p.md, ax + tail * dx, ay + tail * dy, x, y, 4);
    stroke(g, p.w, ax + tail * dx, ay + tail * dy, x, y, t < 0.5 ? 2 : 1);
    const tx = x - (dx / len) * 10, ty = y - (dy / len) * 10;
    stroke(g, p.l, tx + nx * 4, ty + ny * 4, x, y, 1);
    stroke(g, p.l, tx - nx * 4, ty - ny * 4, x, y, 1);
    if (t > 0.36) return;
    // The bow recoils while the arrow travels forward on its own line.
    for (let i = -1; i <= 1; i++) {
      const px = ax + nx * i * 4 - dx / len * t * 28;
      const py = ay + ny * i * 4 - dy / len * t * 28;
      stroke(g, p.a, px, py, px - dx / len * 4, py - dy / len * 4, 1);
    }
  }, 230);
}

function charge(S3, x, y, p, opacity, ms, code) {
  S3.fxCustom((g, t) => {
    const width = 6 + 12 * (1 - t);
    const height = code === 143 ? width * 0.42 : 4;
    g.globalAlpha = opacity * (0.36 + 0.48 * t);
    for (const side of [-1, 1]) {
      const px = x + width * side;
      const inward = code === 140 ? 5 : 3;
      stroke(g, p.m, px, y - height, px, y + height, 2);
      stroke(g, p.l, px, y + height, px - inward * side, y + height, 1);
      if (code === 145) stroke(g, p.l, px, y - height, px - inward * side, y - height, 1);
    }
    if (code === 143 || code === 144) poly(g, p.l, x, y - 2 - t * 3, shard, 0.45 + 0.7 * t);
  }, ms, code === 143);
}

function mortar(S3, ax, ay, bx, by, p, opacity, delay) {
  const dx = bx - ax, dy = by - ay;
  S3.fxCustom((g, t) => {
    g.globalAlpha = opacity;
    for (let i = 3; i >= 0; i--) {
      const q = t - i * 0.07;
      if (q < 0) continue;
      const px = ax + dx * q, py = ay + dy * q - 136 * q * (1 - q);
      if (i) dot(g, i === 1 ? p.a : p.m, px, py, 2);
      else {
        const tilt = dy - 136 * (1 - 2 * q);
        const len = Math.hypot(dx, tilt) || 1;
        stroke(g, p.l, px - dx / len * 8, py - tilt / len * 8, px, py, 2);
        dot(g, p.w, px, py, 3);
      }
    }
  }, delay);
}

export function skillFinisherFx(e, G, S3, entityPos) {
  if (e[0] !== "a" || document.hidden || S3.fx.list.length >= MAX_FX) return;
  const [, eid, code, wx, eventY, dir, , extra = 0] = e;
  if ((code < 140 || code > 145) && code !== 149) return;
  const src = entityPos(eid);
  if (!src) return;
  const charging = extra === 0 && (code === 140 || code === 143 || code === 145);
  // Line strikes send ground coordinates directly; target, wind-up and pulse events carry the legacy -6 offset.
  const wy = eventY + (charging || code === 141 || code === 143 || code === 149 || (code === 144 && extra > 0) ? 6 : 0);
  const mine = eid === G.you;
  const viewer = G.me;
  if (!mine && (!viewer || (
    (src.x - viewer.x) ** 2 + (src.y - viewer.y) ** 2 > RANGE_SQ
    && (wx - viewer.x) ** 2 + (wy - viewer.y) ** 2 > RANGE_SQ
  ))) return;
  const p = fxPal(code, G, eid), opacity = mine ? 0.92 : 0.67;
  const [x, y] = S3.iso(wx, wy, code === 143 || code === 149 ? 0.05 : 0.58);
  if (charging) {
    const wind = code === 140 ? skillDef("cleave")?.wind || 500
      : code === 143 ? skillDef("ignite")?.wind || 400
        : skillDef("snipe")?.wind || 700;
    charge(S3, x, y, p, opacity, wind, code);
    return;
  }
  const [ax, ay] = S3.iso(src.x, src.y, 0.58);
  switch (code) {
    case 140: {
      const [dx, dy] = facing[dir] || facing[0];
      const mirror = Math.sign(Math.abs(x - ax) >= 2 ? x - ax : dx - dy);
      cleave(S3, x, y + 12, p, opacity, mirror);
      break;
    }
    case 141: rupture(S3, x, y, p, opacity, extra); break;
    case 142: hook(S3, ax, ay, x, y, p, opacity); break;
    case 143: ignite(S3, x, y, p, opacity); break;
    case 144:
      if (extra === 0) charge(S3, ax, ay - 5, p, opacity, skillDef("drain")?.every || 400, code);
      else drain(S3, ax, ay, x, y, p, opacity, extra);
      break;
    case 145: snipe(S3, ax, ay, x, y, p, opacity); break;
    case 149: if (extra === 1) mortar(S3, ax, ay, x, y, p, opacity, skillDef("mortar")?.delay || 500); break;
  }
}
