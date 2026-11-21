/**
 * A boss's shaped telegraphs and turns (split from skillfx.js): the "bt"/"bc" ground shapes, the bloomwhale's dive and
 * the bloodhorn's jet.
 */
import * as S3 from "./scene2d.js";
import { Sound } from "./audio.js";
import { bossPfx } from "./skillpfx.js";
import { P, at, px, INK, now, pixelLine, later, rim, shards, skillNear } from "./skillfx_kit.js";

// ───────────────────────────── a boss's shaped telegraphs ─────────────────────────────
/** The ground a shaped telegraph covers, a path in flat world pixels: shape 0 donut (safe inside R0), 1 cone (facing A,
 *  half-angle H), 2 mark (a circle). The very shape the server tests (56-boss-script.js bsInside). */
function telePath(g, s, x, y, R, R0, A, H) {
  g.beginPath();
  if (s === 1) { g.moveTo(x, y); g.arc(x, y, R, A - H, A + H); g.closePath(); return; }
  g.arc(x, y, R, 0, 7);
  if (s === 0) { g.moveTo(x + R0, y); g.arc(x, y, R0, 0, 7, true); }
}
/** ["bt", shape, x, y, r, ms, a, b]: red ground blinking, an orange edge, the reach filling in as the moment nears (a mark
 *  rides on its hero, eid `a`, with four countdown pips; white-edged on yourself), then the blow flashes where it lands. */
/** The boss mob nearest (x, y) within maxD units, or null: the element of a boss attack comes from it (events carry no mob id). */
export function bossNear(G, x, y, maxD = 1e9) {
  let best = null, bd = maxD * maxD;
  for (const m of G.mobs.values()) { const d = G.defs.mobs[m.k]; if (!d || !d.boss) continue; const q = (m.x - x) ** 2 + (m.y - y) ** 2; if (q < bd) { bd = q; best = m; } }
  return best && best.k !== "bloomwhale" && best.k !== "bloodhorn" ? best : null;   // those two have their own effects
}
export const elOf = (G, m) => G.defs.mobs[m.k].element;
export function bossTele(e, entityPos, G) {
  const [, s, x0, y0, r, ms, a = 0, b = 0] = e;
  const R = r * P, R0 = s === 0 ? a * P : 0, A = s === 1 ? a / 1000 : 0, H = b / 1000, mine = s === 2 && a === G.you;
  const where = () => { const o = s === 2 && entityPos(a); return o ? [o.x * P, o.y * P] : [x0 * P, y0 * P]; };
  Sound.play("warn");
  S3.fx.add({ k: "custom", flat: true, keep: true, dur: ms, draw: (g, k) => {
    const [x, y] = where();
    g.fillStyle = "#ff2a1a"; g.globalAlpha = Math.floor(now() / 140) % 2 ? 0.38 : 0.26;
    telePath(g, s, x, y, R, R0, A, H); g.fill("evenodd");
    g.globalAlpha = 0.5; telePath(g, s, x, y, R0 + (R - R0) * k, R0, A, H); g.fill("evenodd");
    g.globalAlpha = 0.95; g.strokeStyle = mine ? "#ffffff" : "#ffb04a"; g.lineWidth = 3;
    telePath(g, s, x, y, R, R0, A, H); g.stroke();
    if (s === 2) for (let i = 0; i < Math.ceil((1 - k) * 4); i++) { const t = (i * Math.PI) / 2, u = x + Math.cos(t) * R, v = y + Math.sin(t) * R; px(g, u - 7, v - 7, 14, 14, INK); px(g, u - 5, v - 5, 10, 10, "#ffe08a"); }
  }, done: () => {
    const [x, y] = where();
    S3.fx.add({ k: "custom", flat: true, dur: 240, draw: (g, k) => { g.globalAlpha = 0.7 * (1 - k); g.fillStyle = "#ffe08a"; telePath(g, s, x, y, R, R0, A, H); g.fill("evenodd"); } });
    S3.shake(4);
    const boss = bossNear(G, x0, y0);   // the pixelfx blow, once the mark has landed
    const el = boss ? elOf(G, boss) : "";
    const bossSfx = { physical: "boss_hit_physical", bleed: "boss_hit_bleed", fire: "boss_hit_fire", cold: "boss_hit_cold", lightning: "boss_hit_lightning", poison: "boss_hit_poison", dark: "boss_hit_dark", light: "boss_hit_light" }[el];
    Sound.play(bossSfx || "slam");
    if (boss && skillNear(G, x / P, y / P)) bossPfx(["donut", "cone", "mark"][s], x / P, y / P, r, el, s === 0 ? a : A);
  } });
}

/** Recent plain telegraph rings ("t") from the current snapshot tick, read by boss pattern cues ("bc") that follow. */
export const recentTele = [];

/**
 * 꽃무덤 고래 (bloomwhale) dive and resurface:
 * - Dive (0..ms): petals and ripples curling inward into the floor around the departure and landing rings,
 *   while keeping the outer danger boundary and 8 escape chevrons unobstructed.
 * - Resurface (at ms - 60): splitting/fracturing outward ground ripples and vertical pixel splash columns + petals.
 */
export function bloomwhaleDive(sx, sy, tx, ty, r = 70, ms = 1800) {
  const moved = Math.hypot(tx - sx, ty - sy) > 22;
  Sound.play("whale_dive");
  // 1. Dive stage (0..ms): inward-curling spiral ripples + petals sinking into the floor,
  //    while the r=70 outer warning boundary and 8 outward dodge chevrons stay crisp and unobstructed.
  S3.fxCustom((g, k) => {
    const fade = Math.min(1, k * 8, (1 - k) * 9);
    // Departure vortex where the whale sinks into the floor
    if (moved && k < 0.58) {
      const dk = k / 0.58;
      g.globalAlpha = (1 - dk) * 0.9;
      for (let ring = 0; ring < 2; ring++) {
        const u = (dk * 2.2 + ring * 0.5) % 1, rr = 30 * (1 - u * 0.82);
        for (let seg = 0; seg < 6; seg++) {
          const a0 = seg * 1.047 + u * 2.8;
          for (let j = 0; j < 6; j++) {
            const a = a0 + j * 0.08, rad = Math.max(2, rr - j * 1.3);
            const [wx, wy] = at(sx + Math.cos(a) * rad, sy + Math.sin(a) * rad, 0);
            px(g, wx - 2, wy - 1, 4, 3, INK);
            px(g, wx - 1, wy, 2, 1, j === 0 ? "#e0ffff" : ring % 2 ? "#ff5ad8" : "#7ff6ff");
          }
        }
      }
    }
    // Dark abyssal sinkhole at the center of the landing zone (well inside the outer boundary)
    const [cx0, cy0] = at(tx, ty, 0), sinkW = Math.round(12 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5));
    g.globalAlpha = 0.85 * fade;
    for (let dy = -3; dy <= 3; dy++) {
      const w = Math.max(2, sinkW - Math.abs(dy) * 3);
      px(g, cx0 - w - 1, cy0 + dy, w * 2 + 2, 1, INK);
      px(g, cx0 - w, cy0 + dy, w * 2, 1, "#0c1016");
    }
    // Inward-contracting spiral ripples (바닥으로 말려드는 파문, kept inside 0.12*r .. 0.78*r)
    for (let ring = 0; ring < 3; ring++) {
      const u = (k * 2.6 + ring / 3) % 1, rr = r * (0.78 - 0.64 * u);
      g.globalAlpha = Math.sin(u * Math.PI) * 0.95 * fade;
      for (let seg = 0; seg < 8; seg++) {
        const a0 = seg * (Math.PI / 4) + u * 3.0 + ring * 0.45;
        for (let j = 0; j < 8; j++) {
          const a = a0 + j * 0.055, rad = Math.max(4, rr - j * 1.35);
          const [wx, wy] = at(tx + Math.cos(a) * rad, ty + Math.sin(a) * rad, 0);
          px(g, wx - 2, wy - 1, 4, 3, INK);
          px(g, wx - 1, wy, 2, 1, j < 2 ? "#e0ffff" : (seg + ring) % 2 ? "#7ff6ff" : "#ff5ad8");
        }
      }
    }
    // Unobstructed outer warning boundary dashes at exact radius r + 8 outward escape chevrons (피할 방향)
    g.globalAlpha = 0.96;
    for (let i = 0; i < 64; i++) {
      if (i % 4 === 3) continue;
      const a = (i / 64) * Math.PI * 2;
      const [bx, by] = at(tx + Math.cos(a) * r, ty + Math.sin(a) * r, 0);
      px(g, bx - 2, by - 2, 4, 4, INK);
      px(g, bx - 1, by - 1, 2, 2, i % 8 === 0 ? "#ffffff" : i % 2 ? "#ffe08a" : "#7ff6ff");
    }
    const push = ((k * 5) % 1) * 6;
    for (let i = 0; i < 8; i++) {
      const a = i * (Math.PI / 4), ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
      const [tipX, tipY] = at(tx + ux * (r + 8 + push), ty + uy * (r + 8 + push), 0);
      for (const s of [-1, 1]) {
        const [wx, wy] = at(tx + ux * (r + 3 + push) + nx * s * 4.5, ty + uy * (r + 3 + push) + ny * s * 4.5, 0);
        pixelLine(g, tipX, tipY, wx, wy, INK, 3);
        pixelLine(g, tipX, tipY, wx, wy, "#ffe08a", 1);
      }
      px(g, tipX - 1, tipY - 1, 3, 3, "#ffffff");
    }
    // Spirit-flower petals swirling inward and downward into the floor (바닥으로 말려드는 꽃잎)
    const drawPetals = (ox, oy, count, maxR, alpha) => {
      g.globalAlpha = alpha;
      for (let i = 0; i < count; i++) {
        const u = (k * 2.3 + i / count) % 1;
        const d = maxR * (0.76 * (1 - u * 0.88)), a = i * 2.39996 + u * 4.5;
        const lift = Math.round(28 * (1 - u) * (1 - u));
        const [px0, py0] = at(ox + Math.cos(a) * d, oy + Math.sin(a) * d, lift);
        const [tx0, ty0] = at(ox + Math.cos(a - 0.18) * (d + 3.5), oy + Math.sin(a - 0.18) * (d + 3.5), lift + 3);
        const [tx1, ty1] = at(ox + Math.cos(a - 0.34) * (d + 6.5), oy + Math.sin(a - 0.34) * (d + 6.5), lift + 5);
        px(g, tx1 - 1, ty1 - 1, 2, 2, INK); px(g, tx1, ty1, 1, 1, "#7ff6ff");
        px(g, tx0 - 1, ty0 - 1, 3, 3, INK); px(g, tx0, ty0, 2, 2, i % 2 ? "#7ff6ff" : "#ff5ad8");
        px(g, px0 - 2, py0 - 2, 5, 4, INK);
        px(g, px0 - 1, py0 - 3, 3, 6, INK);
        px(g, px0 - 1, py0 - 1, 3, 2, "#ff5ad8");
        px(g, px0, py0 - 2, 2, 4, i % 3 === 0 ? "#7ff6ff" : "#ff5ad8");
        px(g, px0, py0 - 1, 1, 1, "#ffd0f4");
      }
    };
    if (moved && k < 0.56) drawPetals(sx, sy, 8, 34, 1 - k / 0.56);
    drawPetals(tx, ty, 16, r, fade);
    g.globalAlpha = 1;
  }, ms, false);

  // 2. Resurface & afterimage stage (starts at ms - 60, lasts 740 ms):
  //    splitting outward ground ripples (갈라지는 파문) + upward-splashing pixel columns & droplets (위로 튀는 픽셀)
  const delay = Math.max(0, ms - 60), rDur = 740;
  later(delay, () => {
    Sound.play("whale_burst");
    S3.fx.wave(tx, ty, r, "#7ff6ff", 380);
    rim(tx, ty, r, "#0c1016", "#e0ffff", 460, 0.22);
    shards(tx, ty, r * 0.82, 12, 36, "#0c1016", "#7ff6ff", 460, 0);
  });
  S3.fxCustom((g, k) => {
    const fade = k < 0.65 ? 1 : (1 - k) / 0.35;
    const prog = 1 - (1 - Math.min(1, k * 1.45)) ** 3;
    g.globalAlpha = fade;
    // Splitting ground ripples (갈라지는 파문): 8 fractured arc wedges breaking outward with widening angular gaps
    for (let seg = 0; seg < 8; seg++) {
      const span = Math.max(0.11, 0.26 * (1 - k * 0.45)), aMid = seg * (Math.PI / 4);
      // Short radial fracture ticks at the split edges where each ripple segment breaks apart
      if (k < 0.62) {
        for (const edge of [-1, 1]) {
          const aEdge = aMid + edge * (span + 0.04), r0 = r * (0.24 + 0.62 * prog), r1 = r0 + 9;
          const [fx0, fy0] = at(tx + Math.cos(aEdge) * r0, ty + Math.sin(aEdge) * r0, 0);
          const [fx1, fy1] = at(tx + Math.cos(aEdge) * r1, ty + Math.sin(aEdge) * r1, 0);
          pixelLine(g, fx0, fy0, fx1, fy1, INK, 3);
          pixelLine(g, fx0, fy0, fx1, fy1, edge > 0 ? "#e0ffff" : "#ff5ad8", 1);
        }
      }
      for (const [mult, col, hi] of [[0.28 + 0.74 * prog, "#7ff6ff", "#e0ffff"], [0.16 + 0.62 * prog, "#ff5ad8", "#ffd0f4"]]) {
        const rr = r * mult + (seg % 2 ? 4 : -3);
        for (let j = -6; j <= 6; j++) {
          if (k > 0.58 && (j + seg) % 2 !== 0) continue;
          const a = aMid + (j / 6) * span;
          const [wx, wy] = at(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, 0);
          px(g, wx - 2, wy - 2, 5, 4, INK);
          px(g, wx - 1, wy - 1, 3, 2, Math.abs(j) <= 2 ? hi : col);
        }
      }
    }
    // Outer r boundary ring kept crisp through impact and afterimage
    for (let i = 0; i < 64; i++) {
      if (i % 2 === 1) continue;
      const a = (i / 64) * Math.PI * 2;
      const [bx, by] = at(tx + Math.cos(a) * r, ty + Math.sin(a) * r, 0);
      px(g, bx - 2, by - 2, 4, 4, INK);
      px(g, bx - 1, by - 1, 2, 2, k < 0.35 ? "#ffffff" : i % 4 === 0 ? "#ff5ad8" : "#7ff6ff");
    }
    // Segmented vertical pixel splash columns shooting straight upward (위로 튀는 픽셀)
    if (k < 0.68) {
      const ck = k / 0.68, arch = Math.sin(ck * Math.PI);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.15, d = r * (0.2 + (i % 3) * 0.2);
        const [sx0, sy0] = at(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0);
        const hCol = Math.max(6, Math.round((22 + (i % 3) * 9) * arch)), baseLift = Math.round(ck * 10);
        for (let step = 0; step < hCol; step += 4) {
          const w = step > hCol * 0.6 ? 2 : 3, yy = sy0 - baseLift - step;
          px(g, sx0 - 2, yy - 3, w + 2, 4, INK);
          px(g, sx0 - 1, yy - 2, w, 2, step > hCol * 0.65 ? "#e0ffff" : i % 3 === 0 ? "#ff5ad8" : "#7ff6ff");
        }
        px(g, sx0 - 1, sy0 - baseLift - hCol - 3, 3, 3, INK);
        px(g, sx0, sy0 - baseLift - hCol - 2, 2, 2, "#ffffff");
      }
    }
    // 22 upward-splashing pixel droplets & petals rising high and settling in the afterimage
    for (let i = 0; i < 22; i++) {
      const a = i * 1.7136 + 0.3, d = r * (0.14 + ((i * 7) % 11) * 0.07) * (0.52 + 0.52 * k);
      const peak = 28 + (i % 4) * 8, lift = Math.max(2, Math.round(peak * 4 * k * (1 - k * 0.72)));
      const [px0, py0] = at(tx + Math.cos(a) * d, ty + Math.sin(a) * d, lift);
      const isPetal = i % 3 === 0;
      px(g, px0 - 2, py0 - 2, 5, 5, INK);
      px(g, px0 - 1, py0 - 1, 3, 3, isPetal ? "#ff5ad8" : "#7ff6ff");
      px(g, px0, py0 - 2, 2, 2, isPetal ? "#ffd0f4" : "#e0ffff");
      if (k < 0.58) {
        px(g, px0 - 1, py0 + 3, 3, 3, INK);
        px(g, px0, py0 + 3, 2, 2, isPetal ? "#ff5ad8" : "#7ff6ff");
      }
    }
    g.globalAlpha = 1;
  }, rDur, false, delay);
}

/**
 * 혈루 왕도마뱀 (bloodhorn) 혈루 사출 (jet):
 * - Ground warning & escape guide: crisp outer boundary ticks around the 5 circles + lateral corridor rails +
 *   perpendicular sidestep chevrons so the danger boundary and dodge direction remain visible throughout.
 * - Stream & short splatters: bright central directional stream (INK -> #6a0e1e -> #ff3b3b -> #ffb0a0 -> #ffffff)
 *   with forward-pointing chevron pulses and short lateral blood splatters (짧은 비산), followed by a crimson afterimage.
 */
export function bloodhornJet(x0, y0, pts, r = 13, ms = 900) {
  const list = pts && pts.length ? pts : [1, 2, 3, 4, 5].map((j) => [x0 + j * 28, y0]);
  const last = list[list.length - 1], dx0 = last[0] - x0, dy0 = last[1] - y0, len = Math.hypot(dx0, dy0) || 140;
  const ux = dx0 / len, uy = dy0 / len, nx = -uy, ny = ux;
  const hx = x0 + ux * 12, hy = y0 + uy * 12, ex = last[0] + ux * 6, ey = last[1] + uy * 6;
  const totalMs = ms + 420;
  later(380, () => Sound.play("blood_jet"));

  S3.fxCustom((g, k) => {
    const tMs = k * totalMs, inWarn = tMs <= ms, wk = Math.min(1, tMs / ms);
    const fade = inWarn ? 1 : Math.max(0, 1 - (tMs - ms) / 420);
    g.globalAlpha = 0.96 * fade;
    // 1. Unobstructed outer boundary dashes on each of the 5 telegraph circles (leaves the interior ring clear)
    for (let idx = 0; idx < list.length; idx++) {
      const [cx, cy] = list[idx];
      for (let i = 0; i < 16; i++) {
        if (i % 4 === 3) continue;
        const a = (i / 16) * Math.PI * 2;
        const [bx, by] = at(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0);
        px(g, bx - 2, by - 2, 4, 4, INK);
        px(g, bx - 1, by - 1, 2, 2, i % 4 === 0 ? "#ffffff" : "#ffe08a");
      }
    }
    // Parallel outer corridor boundary rails at ±(r + 2) world units
    const steps = 20;
    for (const side of [-1, 1]) {
      for (let i = 0; i <= steps; i++) {
        if (i % 2 === 1) continue;
        const u = i / steps;
        const wx = hx + (ex - hx) * u + nx * side * (r + 2), wy = hy + (ey - hy) * u + ny * side * (r + 2);
        const [sx0, sy0] = at(wx, wy, 0);
        px(g, sx0 - 2, sy0 - 1, 4, 3, INK);
        px(g, sx0 - 1, sy0, 2, 1, inWarn ? "#ffb04a" : "#ff6a5a");
      }
    }
    // Perpendicular sidestep chevrons (< and >) outside the lane showing exact dodge direction (피할 방향)
    if (inWarn) {
      const shift = ((wk * 6) % 1) * 4;
      for (const idx of [0, 2, list.length - 1]) {
        const [cx, cy] = list[idx];
        for (const side of [-1, 1]) {
          const [tipX, tipY] = at(cx + nx * side * (r + 9 + shift), cy + ny * side * (r + 9 + shift), 0);
          for (const arm of [-1, 1]) {
            const [ax0, ay0] = at(cx + nx * side * (r + 4 + shift) + ux * arm * 4, cy + ny * side * (r + 4 + shift) + uy * arm * 4, 0);
            pixelLine(g, tipX, tipY, ax0, ay0, INK, 3);
            pixelLine(g, tipX, tipY, ax0, ay0, "#ffe08a", 1);
          }
          px(g, tipX - 1, tipY - 1, 3, 3, "#ffffff");
        }
      }
    } else {
      // Ground afterimage: cooling crimson blood seam down the center axis
      for (let i = 0; i <= 24; i++) {
        if (i % 2 === 1 && fade < 0.5) continue;
        const u = i / 24, [sx0, sy0] = at(hx + (ex - hx) * u, hy + (ey - hy) * u, 0);
        px(g, sx0 - 2, sy0 - 1, 4, 3, INK);
        px(g, sx0 - 1, sy0, 2, 1, i % 3 === 0 ? "#ff6a5a" : "#6a0e1e");
      }
    }

    // 2. Stream & short splatters layer:
    const [ax, ay] = at(hx, hy, 9), [bxAll, byAll] = at(ex, ey, 3);
    const sdx = bxAll - ax, sdy = byAll - ay, slen = Math.hypot(sdx, sdy) || 1;
    const sux = sdx / slen, suy = sdy / slen, snx = -suy, sny = sux;

    // Stage A (0..380 ms): Warning sight-line with fast directional chevrons from bloodhorn's eyes
    if (tMs < 380) {
      const wProg = tMs / 380;
      g.globalAlpha = 1;
      pixelLine(g, ax, ay, bxAll, byAll, INK, 3);
      pixelLine(g, ax, ay, bxAll, byAll, "#ff3b3b", 1);
      px(g, ax - 3, ay - 3, 7, 7, INK); px(g, ax - 2, ay - 2, 5, 5, "#ff3b3b"); px(g, ax - 1, ay - 1, 3, 3, "#ffffff");
      for (let m = 0; m < 5; m++) {
        const u = ((wProg * 2.8 + m / 5) % 1), cx = ax + sdx * u, cy = ay + sdy * u;
        for (const s of [-1, 1]) {
          pixelLine(g, cx + sux * 2, cy + suy * 2, cx - sux * 5 + snx * s * 4, cy - suy * 5 + sny * s * 4, INK, 3);
          pixelLine(g, cx + sux * 2, cy + suy * 2, cx - sux * 5 + snx * s * 4, cy - suy * 5 + sny * s * 4, "#ffb0a0", 1);
        }
        px(g, cx - 1, cy - 1, 3, 3, "#ffffff");
      }
      return;
    }

    // Stage B (380..960 ms): High-pressure bright central blood stream + directional chevron pulses + short lateral splatters
    if (tMs <= 960) {
      const jk = (tMs - 380) / 580, reach = Math.min(1, jk * 4.5);
      const bx = ax + sdx * reach, by = ay + sdy * reach;
      g.globalAlpha = 1;
      // Bright central stream (뻗는 방향이 한눈에 읽히는 밝은 중심 줄기)
      pixelLine(g, ax, ay, bx, by, INK, 7);
      pixelLine(g, ax, ay, bx, by, "#6a0e1e", 5);
      pixelLine(g, ax, ay, bx, by, "#ff3b3b", 3);
      pixelLine(g, ax, ay, bx, by, "#ffb0a0", 2);
      pixelLine(g, ax, ay, bx, by, "#ffffff", 1);
      // Nozzle flare at bloodhorn's eyes
      px(g, ax - 4, ay - 4, 8, 8, INK); px(g, ax - 3, ay - 3, 6, 6, "#ff3b3b"); px(g, ax - 2, ay - 2, 4, 4, "#ffffff");
      // Directional chevron barbs along the stream so the firing direction reads at a glance
      for (let m = 0; m < 5; m++) {
        const u = ((jk * 3.4 + m / 5) % 1) * reach;
        const cx = ax + sdx * u, cy = ay + sdy * u;
        for (const s of [-1, 1]) {
          pixelLine(g, cx + sux * 3, cy + suy * 3, cx - sux * 5 + snx * s * 5, cy - suy * 5 + sny * s * 5, INK, 3);
          pixelLine(g, cx + sux * 3, cy + suy * 3, cx - sux * 5 + snx * s * 5, cy - suy * 5 + sny * s * 5, "#ffb0a0", 1);
        }
        px(g, cx - 1, cy - 1, 3, 3, "#ffffff");
      }
      // Spearhead tip at the front of the jet
      for (const s of [-1, 1]) {
        pixelLine(g, bx + sux * 4, by + suy * 4, bx - sux * 6 + snx * s * 6, by - suy * 6 + sny * s * 6, INK, 4);
        pixelLine(g, bx + sux * 4, by + suy * 4, bx - sux * 6 + snx * s * 6, by - suy * 6 + sny * s * 6, "#ff3b3b", 2);
      }
      px(g, bx - 2, by - 2, 4, 4, "#ffffff");

      // Short lateral splatters (짧은 비산) at each reached circle node, kept tight inside the r=13 boundary
      for (let idx = 0; idx < list.length; idx++) {
        if ((idx + 1) / list.length > reach + 0.1) continue;
        const [nx0, ny0] = at(list[idx][0], list[idx][1], 5);
        const burst = ((jk * 4 + idx * 0.23) % 1);
        for (const side of [-1, 1]) {
          for (const [fMul, sMul] of [[3.2, 6.8], [-1.8, 5.2]]) {
            const d = 0.55 + burst * 0.65;
            const sx1 = nx0 + (sux * fMul + snx * side * sMul) * d;
            const sy1 = ny0 + (suy * fMul + sny * side * sMul) * d - (1 - burst) * 3;
            pixelLine(g, nx0 + snx * side * 2, ny0 + sny * side * 2, sx1, sy1, INK, 3);
            pixelLine(g, nx0 + snx * side * 2, ny0 + sny * side * 2, sx1, sy1, "#ff3b3b", 1);
            px(g, sx1 - 2, sy1 - 2, 4, 4, INK);
            px(g, sx1 - 1, sy1 - 1, 2, 2, side > 0 ? "#ffb0a0" : "#ff6a5a");
          }
        }
      }
      return;
    }

    // Stage C (960..1320 ms): Afterimage (잔상) — broken crimson droplets settling along the jet axis
    const ak = (tMs - 960) / (totalMs - 960), aFade = Math.max(0, 1 - ak);
    g.globalAlpha = aFade;
    const drop = Math.round(ak * 5);
    for (let i = 0; i <= 26; i++) {
      if ((i + Math.floor(ak * 8)) % 2 === 1) continue;
      const u = i / 26, cx = ax + sdx * u, cy = ay + sdy * u + drop;
      px(g, cx - 2, cy - 2, 4, 4, INK);
      px(g, cx - 1, cy - 1, 2, 2, i % 3 === 0 ? "#ffb0a0" : i % 2 ? "#ff3b3b" : "#6a0e1e");
    }
    for (let idx = 0; idx < list.length; idx++) {
      const [nx0, ny0] = at(list[idx][0], list[idx][1], Math.max(1, 5 - drop));
      for (const side of [-1, 1]) {
        const sx1 = nx0 + snx * side * (5 + ak * 3), sy1 = ny0 + sny * side * (5 + ak * 3);
        px(g, sx1 - 2, sy1 - 2, 4, 4, INK);
        px(g, sx1 - 1, sy1 - 1, 2, 2, "#ff3b3b");
      }
    }
    g.globalAlpha = 1;
  }, totalMs, false);
}
