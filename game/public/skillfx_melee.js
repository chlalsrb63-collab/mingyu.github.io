/**
 * The blades' and the hammer's strike shapes (split from skillfx.js): dagger cuts and shadow darts, spear thrusts and
 * charges, sword arcs, rends and spins, the two-handed hammer's wind-up and impact. Drawn in the palette `PAL` holds.
 */
import * as S3 from "./scene2d.js";
import { P, at, px, INK, PAL, pixelLine, shards, rim, along, later } from "./skillfx_kit.js";

/** A broken wake following the server's actual blink or charge path. */
export function streakWake(ax, ay, bx, by, edge, light, width) {
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
export function shadowDart(ax, ay, bx, by) {
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

export function ambushCuts(wx, wy, ang) {
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
export function shadowAfterimage(wx, wy, ms = 240) {
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
export function flurrySlash(wx, wy, ang) {
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

export function spiralThrust(ax, ay, bx, by) {
  meleeSpearThrust(ax, ay, bx, by, 12, 0.72);
}

/** 유성창 (comet): wide drag corridor (`half = 20`) + blazing spear comet + landing stun crater. */
export function cometCharge(ax, ay, bx, by, half = 20) {
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
export function rendSlam(wx, wy, r) {
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

export function rendWave(ax, ay, bx, by, half = 14) {
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
export function verdictSpin(wx, wy, ang, r = 70) {
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
export function crossCutFx(wx, wy, ang, r = 64) {
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
export function abyssDive(wx, wy, r = 110) {
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

export function swordCrescent(x, y, ang, r) {
  meleeSwordArc(x, y, ang, r || 46, 75);
}

/** Holy light rises in points spaced along the healing seal, leaving the centre clear. */
export function oathSeal(x, y, r) {
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
