/**
 * The spells' and the support skills' shapes (split from skillfx.js): the book's folio, the support mend, fire, frost,
 * lightning, the gravity well, the blood wave, the bow's muzzle and leap shot, the ice spire.
 */
import * as S3 from "./scene2d.js";
import { Sound } from "./audio.js";
import { at, px, INK, PAL, pixelLine, later, shards, rim, groundRing, BANNER_COLOR, BINDING_COLOR } from "./skillfx_kit.js";

/** Two pages unfold above the caster, releasing ribbons that never imply a target. */
export function bindingFolio(x, y, radius) {
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

export function soulTrail(ax, ay, bx, by, ms) {
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
export function fireBurnPatch(x, y, r = 30) {
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
export function gravityPulse(x, y, r = 60) {
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

/** 빙결창's ice: three crystals shooting up out of the ground at (wx, wy), standing a moment, blinking out as they break. */
export function iceSpire(wx, wy) {
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
