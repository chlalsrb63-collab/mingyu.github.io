/** Monsters of the crypt and the city (see mobart.js). */
import { mat, C, bez, gait, bob, lunge, legs4, teeth, ribs, tentacle, surf, both, rollPt, pitchPt, hand } from "./mobart_kit.js";

// ── crypt: grave-grey fur, bare red muscle, old bone, and the violet of things that live in the dark
const RAT = mat("#6e6268"), RATD = mat("#4a3e48"), RATT = mat("#c08890", { wet: true }), RATF = mat("#8a6a70");
const SKINLESS = mat("#b8384a", { drip: true, wet: true }), SKINLEG = mat("#a8304a"), SINEW = mat("#e07a84");
const TOAD = mat("#7a7048"), TOADD = mat("#4e4a30"), PIT = mat("#2e1e1e"), TOADB = mat("#b8ac80");
const BAT = mat("#4a3858"), BATW = mat("#5e4466"), BATL = mat("#8a6a92");
// ── city: pigeon greys, a stray's mangy brown, sewer-rat pink, tabby black
const PIG = mat("#8a8ea0"), PIGD = mat("#5e6274"), NECKG = mat("#4aa078", { role: "keep" }), NECKP = mat("#8a5ab0", { role: "keep" }), PFOOT = mat("#e07a84");
const DOG = mat("#7a5a44"), DOGD = mat("#4e3a30"), MANGE = mat("#c87a74", { drip: true });
const SRAT = mat("#8a7a80"), PETAL = mat("#d0607a", { wet: true }), PETALD = mat("#8a2a44");
const CAT = mat("#2e2a36"), CATL = mat("#4a4658");
const FISH = mat("#7a9ab0"), FISHB = mat("#d0dce0"), FISHD = mat("#4a6278"), FIN = mat("#9a7a8a"), LEG = mat("#e0b8a0");

export const BEASTS_B = {
  /** 쥐 왕 — five rats knotted by their tails into one body that pulls five ways; the knot is the heart of it. */
  ratking: {
    size: "m",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      // the knot: tails wound round each other
      for (let i = 0; i < 3; i++) M.tube(bez([-1.6 + i, 2, -1.6], [0.4, 4 + i * 0.6, 1.8 - i], [1.4 - i, 2.2, -0.6 + i], 6), 0.85, RATT);
      M.s([0, 2.8, 0], 1.6, C.GUT);
      const rats = [[0, 1.45, lf], [95, 1.25, 0], [-95, 1.25, 0], [180, 1.15, 0]];
      rats.forEach(([ang, sz, push], i) => {
        const a = (ang * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
        const pull = p.walk ? Math.sin((p.ph + i * 0.37) * Math.PI * 2) * 0.6 : p.idle ? 0.2 * (i % 2) : 0;
        const R = 4.6 + pull + push, c = [ca * R, 2.4 * sz + lu * 0.4 + (p.walk && (i + Math.round(p.ph * 4)) % 2 ? 0.5 : 0), sa * R];
        const m = i === 3 ? RATD : RAT;
        M.e(c, [2.6 * sz, 1.8 * sz, 1.7 * sz], m, [-ang, 0, 0]);
        const h = [c[0] + ca * 2.6 * sz, c[1] + 0.2, c[2] + sa * 2.6 * sz], HR = [1.5 * sz, 1.2 * sz, 1.1 * sz];
        M.e(h, HR, m, [-ang, -6, 0]);
        const n = [h[0] + ca * 1.6 * sz, h[1] - 0.3, h[2] + sa * 1.6 * sz];
        M.s(n, 0.55, RATT);
        both((s) => {
          M.e([h[0] - ca * 0.5 - sa * s * 0.9, h[1] + 1.1 * sz, h[2] - sa * 0.5 + ca * s * 0.9], [0.5, 0.8, 0.8], RATF, [-ang, 0, 0]);
          M.eye([h[0] + ca * 0.7 - sa * s * 0.85, h[1] + 0.5, h[2] + sa * 0.7 + ca * s * 0.85], 1, i === 0 ? "#ff2a2a" : "#e02838");
        });
        if (i === 0 && p.strike) teeth(M, [n[0], n[1] - 0.4, n[2] - 0.4], [n[0], n[1] - 0.4, n[2] + 0.4], 2, 1, 0.8);
        both((s) => { const [sw, up] = gait(p, (i * 0.25 + (s > 0 ? 0.5 : 0)) % 1); M.tube([[c[0] + ca * 1.2 - sa * s * 1.2, c[1] - 0.8, c[2] + sa * 1.2 + ca * s * 1.2], [c[0] + ca * (1.6 + sw) - sa * s * 1.8, up * 0.8, c[2] + sa * (1.6 + sw) + ca * s * 1.8]], 0.5, RATF); });
        M.tube([[c[0] - ca * 2.2 * sz, c[1], c[2] - sa * 2.2 * sz], [ca * 1, 2.6, sa * 1]], 0.55, RATT);
      });
      M.dot([0.4, 4.4, 0.6], "#d82838", 1, 1);
    },
  },

  /** 가죽 벗겨진 사냥개 — a hound with no skin left: bare muscle, ribs like a cage, and a spine working loose along its back. */
  bonehound: {
    size: "m",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.6);
      const f0 = lf, u0 = 7.6 + lu + bob(p, 0.7);
      M.G("body");
      M.e([f0 + 2, u0 + 0.4, 0], [3.6, 3, 2.6], SKINLESS);
      M.e([f0 - 2.6, u0 + 0.2, 0], [2.8, 2.4, 2.2], SKINLESS);
      M.G();
      ribs(M, f0 - 0.6, f0 + 3, u0 - 0.6, 2.9, 3, C.BONEB, 0.98);
      for (let i = 0; i < 5; i++) M.dot([f0 + 3.8 - i * 0.6, u0 + 1.2 - i * 0.5, -2.8], "#e07a84");
      // the spine, sitting proud of the back, one vertebra lifting free
      for (let i = 0; i < 8; i++) { const f = f0 + 4.6 - i * 1.3, u = u0 + 2.9 - Math.abs(i - 4) * 0.12 + (i === 5 && !p.dead ? 1 + (p.idle ? 0.4 : 0) : 0); M.s([f, u, 0], 0.7, C.BONE); if (i % 2) M.cone([f, u, 0], [f - 0.3, u + 1.1, 0], 0.35, C.BONE); }
      for (let i = 0; i < 6; i++) { const wag = p.walk ? Math.sin((p.ph + i * 0.1) * Math.PI * 2) * 0.6 : 0; M.s([f0 - 5.4 - i * 1, u0 + 1.6 + i * 0.5, wag * (i / 5)], 0.6 - i * 0.04, C.BONE); }
      legs4(M, p, { ff: f0 + 3.2, bf: f0 - 3.2, w: 1.7, hu: u0 - 1.6, r: 1, m: SKINLEG, foot: C.BONE, st: 3, li: 1.8, hock: 1.6 });
      // a bare skull with the jaw hanging
      const hf = f0 + 7 + (p.strike ? 1.6 : 0), hu = u0 + 1.8 - (p.wind ? 1.6 : 0);
      const H = [hf, hu, 0], HR = [2.2, 1.8, 1.7];
      M.tube([[f0 + 4.4, u0 + 1.6, 0], [hf - 1.2, hu - 0.4, 0]], [1.6, 1.2], SINEW);
      M.e(H, HR, C.BONE, [0, -8, 0]);
      M.e([hf + 2.2, hu - 0.4, 0], [1.8, 0.9, 1], C.BONE, [0, -8, 0]);
      const open = p.strike ? 1.4 : p.wind ? 0.8 : 0.4;
      M.e([hf + 1.8, hu - 1.4 - open * 0.6, 0], [1.8, 0.5, 0.9], C.BONE, [0, -10 - open * 18, 0]);
      teeth(M, [hf + 1, hu - 1, -0.8], [hf + 3.4, hu - 1, -0.4], 3, 1, 0.6 + open * 0.3);
      teeth(M, [hf + 1, hu - 1, 0.8], [hf + 3.4, hu - 1, 0.4], 3, 1, 0.6 + open * 0.3);
      both((s) => { M.e(surf(H, HR, [0.3, 0.2, s * 0.85]), [0.7, 0.7, 0.4], C.MAW); M.eye(surf(H, HR, [0.35, 0.25, s * 0.95]), 1, "#ff3a2a"); });
    },
  },

  /** 알 밴 두꺼비 — a toad whose back is a comb of pits, and something looks out of every one. */
  toadbrood: {
    size: "l", glow: "#b4cc3c",
    draw(M, p) {
      const hop = p.walk ? [0, 0.6, 0.3, 0][Math.round(p.ph * 4)] : 0;
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 6 + hop * 1.6 + lu + bob(p, 0.5), sw = p.idle ? 0.25 : 0, gulp = p.wind ? 0.8 : 0;
      M.G("body");
      M.e([f0, u0, 0], [8 + sw, 5.6 + sw + gulp, 8 + sw], TOAD, [0, 8, 0]);
      M.e([f0 + 1.6, u0 - 1.8, 0], [6.4, 3.6 + gulp * 1.4, 6.6 + gulp], TOADB, [0, 8, 0]);
      M.G();
      // the pits, and the eyes in them
      const pits = [[-3, 2, 0], [0.6, 2.4, -2.2], [0.4, 2.2, 2.6], [-4, 1, -3.6], [-3.6, 1.2, 3.8], [2.8, 1.8, 0.6], [-6, -0.4, 0], [-1.4, 1.6, -5], [-1.2, 1.4, 5.2], [3, 1, -4], [2.6, 1, 4.4]];
      pits.forEach(([a, b, c], i) => {
        const d = [a / 8, 0.9 + b * 0.05, c / 8], q = surf([f0, u0, 0], [8, 5.6, 8], d);
        M.e(q, [1.1, 0.5, 1.1], PIT);
        if ((i + (p.idle ? 1 : 0)) % 3 !== 2) M.eye([q[0], q[1] + 0.3, q[2]], i % 4 === 0 ? 2 : 1, i % 2 ? "#c8e040" : "#ff3a2a");
      });
      for (const [a, c] of [[-1, -6.4], [1.4, 6.8], [-6.4, 2.6]]) M.dot(surf([f0, u0, 0], [8, 5.6, 8], [a / 8, 0.4, c / 8]), "#4e4a30", 2, 1);
      // legs folded under all that weight
      both((s) => {
        M.e([f0 - 3.6, u0 - 2.6, s * 6.6], [3.8, 2.6, 2], TOAD, [0, -12, 0]);
        M.tube([[f0 - 1.4, 1.4, s * 7.4], [f0 + 1.6 - hop * 2, 0.6, s * 8], [f0 + 3, 0.6, s * 8.6]], [1.4, 1.1, 1.2], TOADD);
        M.tube([[f0 + 4, u0 - 3, s * 4.6], [f0 + 6 + (p.strike ? 1 : 0), 0.7 + hop, s * 5.2]], [1.3, 1], TOAD);
      });
      // the head is just the front of the body: a wide lipless mouth and two heavy-lidded eyes
      const open = p.strike ? 1.6 : p.wind ? 0.8 : 0.2;
      M.e([f0 + 7.6, u0 - 0.6 - open * 0.4, 0], [0.8, 0.6 + open, 5.4], C.MAW);
      if (open > 0.5) M.s([f0 + 7.4, u0 - 1.2, 0], 1.2, C.BILE);
      both((s) => { const e = surf([f0, u0, 0], [8, 5.6, 8], [0.62, 0.55, s * 0.45]); M.e(e, [1.4, 1.2, 1.4], TOAD); M.eye([e[0] + 0.5, e[1] + 0.6, e[2]], 2, "#c8a020"); });
    },
  },

  /** 박쥐 덩어리 — too many bats grown into one ball that screams from every side; it bursts when it dies. */
  batcluster: {
    size: "m", hover: 9, glow: "#ff5a5a", death: "burst",
    draw(M, p) {
      const t = p.walk ? p.ph : p.idle * 0.25 + (p.strike ? 0.5 : 0);
      const [lf, lu] = lunge(p);
      const c = [lf, 6.4 + lu, 0], R = 4.6 + (p.idle ? 0.2 : 0) + (p.wind ? 0.5 : 0);
      M.G("ball");
      M.s(c, R, BAT);
      M.s([c[0] - 1.6, c[1] - 1.4, 1.6], 3.2, BAT);
      M.s([c[0] + 1.2, c[1] + 1.6, -1.8], 3, BAT);
      M.G();
      // two pairs of wings, beating against each other
      [[1, 0, 0.6], [-1.8, 0.5, 2.2]].forEach(([df, ph, du]) => both((s) => {
        const fl = Math.sin((t + ph) * Math.PI * 2) * 0.9, deg = -s * fl * 50;
        const root = [c[0] + df, c[1] + du, s * (R - 1)];
        const W = (d, dd, r) => M.e(rollPt([root[0] + d, root[1], root[2] + s * dd], deg, root), r, BATW, [0, 0, deg]);
        W(0.4, 3.4, [1.8, 0.35, 3.4]);
        W(-1.4, 2.8, [1.6, 0.3, 2.6]);
        const tip = rollPt([root[0] + 0.8, root[1] + 0.4, root[2] + s * 6.8], deg, root);
        M.tube([root, rollPt([root[0] + 1.2, root[1] + 0.5, root[2] + s * 3.2], deg, root), tip], [0.5, 0.3], BATL);
        M.cone(tip, [tip[0] + 0.8, tip[1] + 0.6, tip[2]], 0.35, C.NAIL);
      }));
      // faces: ears, red eyes and fangs, all over it
      const faces = [[1, 0.25, -0.3], [0.6, 0.3, 0.75], [0, 0.95, 0.1], [0.4, -0.45, -0.8], [-0.7, 0.4, -0.6], [-0.6, -0.2, 0.75]];
      faces.forEach((d, i) => {
        const l = Math.hypot(...d), u = [d[0] / l, d[1] / l, d[2] / l], q = [c[0] + u[0] * R, c[1] + u[1] * R, c[2] + u[2] * R];
        both((e) => M.cone([q[0] - u[2] * e * 0.9, q[1] + 0.6, q[2] + u[0] * e * 0.9], [q[0] + u[0] * 0.6 - u[2] * e * 1.4, q[1] + 2.2, q[2] + u[2] * 0.6 + u[0] * e * 1.4], 0.55, BATL));
        M.eye([q[0] + u[0] * 0.2, q[1] + 0.3, q[2] + u[2] * 0.2], i === 0 ? 2 : 1, "#ff3030");
        M.dot([q[0] + u[0] * 0.3, q[1] - 0.8, q[2] + u[2] * 0.3], "#f4eedc", 1, 1);
        if (i < 3 && (p.strike || p.wind)) M.dot([q[0] + u[0] * 0.3, q[1] - 0.8, q[2] + u[2] * 0.3 + 0.6], "#d82838", 1, 2);
      });
      M.tube([[c[0], c[1] - R, c[2]], [c[0] + 0.4, c[1] - R - 1.6, c[2]]], [0.5, 0.3], C.GORE);
    },
  },

  // ── city
  /** 비둘기 떼살 — a flock that melted together under a bridge; three heads still bob for crumbs. */
  pigeonmass: {
    size: "m", hover: 10,
    draw(M, p) {
      const t = p.walk ? p.ph : p.idle * 0.25;
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 6 + lu;
      M.G("mass");
      M.e([f0, u0, 0], [4.6, 3.4, 4.2], PIG);
      M.e([f0 - 2.4, u0 + 1.2, 1.6], [3, 2.6, 2.6], PIG);
      M.e([f0 + 0.6, u0 - 1, -2.4], [3, 2.4, 2.4], PIGD);
      M.G();
      // iridescent throats where the heads come out
      [[2.8, 3, -2.2, -30], [3.6, 4.6, 0.8, 10], [0, 5.2, 3.2, 70]].forEach(([a, b, c, yaw], i) => {
        const bobh = Math.sin((t + i * 0.3) * Math.PI * 2) * 0.6 + (p.strike && i === 1 ? -1 : 0);
        const n = [f0 + a * 0.7, u0 + b * 0.6, c * 0.8], hd = [f0 + a + 0.6, u0 + b + bobh, c];
        M.tube([n, hd], [1.2, 0.9], i % 2 ? NECKP : NECKG);
        M.s(hd, 1.3, PIG);
        const yr = (yaw * Math.PI) / 180;
        M.cone([hd[0] + Math.cos(yr) * 1, hd[1] - 0.2, hd[2] + Math.sin(yr) * 1], [hd[0] + Math.cos(yr) * 2.6, hd[1] - 0.6, hd[2] + Math.sin(yr) * 2.6], 0.5, PFOOT);
        both((s) => M.eye([hd[0] + Math.cos(yr) * 0.4 - Math.sin(yr) * s * 1.1, hd[1] + 0.3, hd[2] + Math.sin(yr) * 0.4 + Math.cos(yr) * s * 1.1], 1, "#ff7a20"));
      });
      // wings, out of time
      [[-1, 0], [1, 0.5], [1, 0.2]].forEach(([s, o], i) => {
        const fl = Math.sin((t + o) * Math.PI * 2);
        const root = [f0 - 1 - i, u0 + 2, s * (2 + i * 0.6)];
        M.e(rollPt([root[0], root[1], root[2] + s * 3.4], -s * fl * 45, root), [2.6, 0.4, 3.6], i ? PIGD : PIG, [0, 0, -s * fl * 45]);
      });
      // too many feet
      for (let i = 0; i < 7; i++) { const f = f0 - 2.4 + (i % 4) * 1.4, s = -3 + i * 1, kick = Math.sin((t + i * 0.21) * Math.PI * 2) * 0.6; M.tube([[f, u0 - 2.4, s], [f + kick, u0 - 4.4, s], [f + 0.8 + kick, u0 - 4.8, s]], [0.38, 0.32], PFOOT); }
      for (const [a, b, c] of [[-1, 2.6, -1.6], [1.6, 1.4, 3], [-3, 0.4, -2]]) M.dot([f0 + a, u0 + b, c], "#d8d4e0");
    },
  },

  /** 세 머리 들개 — one starving stray with three heads and three hungers: one snarls, one gnaws, one hangs dead and drools. */
  doghead: {
    size: "m",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.5);
      const f0 = lf, u0 = 7 + lu + bob(p, 0.7) - (p.wind ? 0.8 : 0);
      M.G("body");
      M.e([f0 + 1.6, u0 + 0.4, 0], [3.8, 3.2, 3.4], DOG);
      M.e([f0 - 2.6, u0, 0], [3, 2.6, 2.6], DOG);
      M.G();
      ribs(M, f0 - 0.6, f0 + 2.4, u0 - 0.4, 2.9, 3, DOGD, 0.95);
      for (const [a, b, c, r] of [[-2, 2, 2.2, 1.2], [1, 2.8, -2, 1], [3, 0, 3, 0.9]]) M.e([f0 + a, u0 + b, c], [r, 0.6, r], MANGE);
      legs4(M, p, { ff: f0 + 3, bf: f0 - 3.4, w: 2, hu: u0 - 1.6, r: 1, m: DOG, foot: DOGD, st: 2.6, li: 1.6 });
      M.tube(bez([f0 - 5, u0 + 1, 0], [f0 - 7, u0 + 3, 0], [f0 - 7.6, u0 + 1, p.walk ? Math.sin(p.ph * 6.28) : 0], 5), [0.8, 0.5], DOGD);
      // three heads off one thick neck
      [[-3, 0, -18], [0, 1, 0], [3, 2, 22]].forEach(([s, kind, yaw]) => {
        const lunge2 = p.strike && kind < 2 ? 1.6 : 0, droop = kind === 2 ? -2.2 : 0;
        const hd = [f0 + 6.4 + lunge2 - (kind === 1 ? 0 : 0.8), u0 + 2.6 + droop + (kind === 1 ? 1 : 0) - (p.wind && kind < 2 ? 1.4 : 0), s * 1.1];
        M.tube([[f0 + 3.6, u0 + 1.6, s * 0.5], [hd[0] - 1, hd[1] - 0.4, hd[2]]], [1.5, 1.2], DOG);
        const HR = [1.8, 1.6, 1.5];
        M.e(hd, HR, DOG, [yaw, kind === 2 ? -40 : 0, kind === 2 ? 30 : 0]);
        const yr = (yaw * Math.PI) / 180, fx = Math.cos(yr), fz = Math.sin(yr);
        const mz = [hd[0] + fx * 2, hd[1] - 0.6 + (kind === 2 ? -1 : 0), hd[2] + fz * 2];
        M.e(mz, [1.5, 0.9, 1], DOG, [yaw, kind === 2 ? -40 : -6, 0]);
        M.dot([mz[0] + fx * 1.3, mz[1] + 0.2, mz[2] + fz * 1.3], "#1a1216");
        both((e) => M.cone([hd[0] - fx * 0.6 - fz * e * 1, hd[1] + 1, hd[2] - fz * 0.6 + fx * e * 1], [hd[0] - fx * 1.4 - fz * e * 1.4, hd[1] + (kind === 2 ? 1.4 : 3), hd[2] - fz * 1.4 + fx * e * 1.4], 0.7, DOGD));
        if (kind === 2) { M.eye([hd[0] + fx * 1, hd[1] + 0.4, hd[2] + 1.4], 2, "#000", { shut: true }); M.tube([[mz[0], mz[1] - 0.6, mz[2]], [mz[0] + 0.2, mz[1] - 2.2, mz[2]]], [0.5, 0.3], C.TONGUE); }
        else both((e) => M.eye([hd[0] + fx * 1 - fz * e * 0.9, hd[1] + 0.6, hd[2] + fz * 1 + fx * e * 0.9], 1, "#ff3a2a"));
        if (kind === 0) teeth(M, [mz[0] + fx * 0.6, mz[1] - 0.4, mz[2] - 0.5], [mz[0] + fx * 0.6, mz[1] - 0.4, mz[2] + 0.5], 2, 1, 0.8);
        if (kind === 1) M.tube([[mz[0] + fx * 1, mz[1] - 0.5, mz[2] - 1.6], [mz[0] + fx * 1.2, mz[1] - 0.6, mz[2] + 1.6]], 0.45, C.BONE);
      });
    },
  },

  /** 촉수 쥐 — a sewer rat whose head opened like a flower: pink petals, a ring of teeth, and feelers tasting the air. */
  squidrat: {
    size: "m",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.3);
      const f0 = lf, u0 = 4.6 + lu + bob(p, 0.5);
      M.G("body");
      M.e([f0, u0, 0], [4.6, 3.2, 3.2], SRAT);
      M.e([f0 - 3, u0 - 0.4, 0], [2.6, 2.6, 2.8], SRAT);
      M.G();
      legs4(M, p, { ff: f0 + 2.6, bf: f0 - 3, w: 2.2, hu: u0 - 1.6, r: 0.7, m: RATT, st: 2, li: 1.2 });
      M.tube(bez([f0 - 5.4, u0, 0], [f0 - 9, u0 - 1, p.walk ? Math.sin(p.ph * 6.28) * 2 : 1], [f0 - 11, 0.6, -1.4], 8), [0.6, 0.3], RATT);
      // the head: five petals, peeled back further the angrier it gets
      const hc = [f0 + 4.4 + (p.strike ? 1.4 : 0), u0 + 0.8 - (p.wind ? 0.6 : 0), 0];
      const bloom = p.strike ? 1 : p.wind ? 0.75 : p.idle ? 0.5 : 0.4;
      M.e(hc, [1.4, 1.8, 1.8], PETALD);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3, cu = Math.cos(a), cs = Math.sin(a);
        const tip = [hc[0] + 1.6 + (1 - bloom) * 1.6, hc[1] + cu * (2 + bloom * 2.6), hc[2] + cs * (2 + bloom * 2.6)];
        M.tube([[hc[0] + 0.4, hc[1] + cu * 1, hc[2] + cs * 1], [hc[0] + 1.6, hc[1] + cu * 2, hc[2] + cs * 2], tip], [1.1, 0.8, 0.4], PETAL);
        M.cone([hc[0] + 1, hc[1] + cu * 0.9, hc[2] + cs * 0.9], [hc[0] + 1.6, hc[1] + cu * 0.2, hc[2] + cs * 0.2], 0.45, C.TOOTH);
        M.eye([tip[0] - 0.4, tip[1], tip[2]], 1, i % 2 ? "#ff3a2a" : "#2a1a22");
      }
      for (let i = 0; i < 3; i++) tentacle(M, [hc[0] + 1, hc[1] + (i - 1) * 0.6, (i - 1) * 0.5], [1, 0.3 - i * 0.3, (i - 1) * 0.5], 3.4 + bloom * 1.4, 0.5, C.TONGUE, (p.walk ? p.ph : p.idle * 0.2) + i * 0.3, 0.7, 5);
    },
  },

  /** 갈라진 고양이 — a black cat opened down the middle like a book; what lives inside it is all teeth. */
  catsplit: {
    size: "m",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.5);
      const f0 = lf, u0 = 6 + lu + bob(p, 0.6) - (p.wind ? 1 : 0);
      const open = p.strike ? 1 : p.wind ? 0.8 : p.idle ? 0.45 : 0.35;
      legs4(M, p, { ff: f0 + 3, bf: f0 - 3.2, w: 1.8, hu: u0 - 1.4, r: 0.85, m: CAT, foot: CATL, st: 2.6, li: 1.6 });
      // two halves, swung apart along the spine; between them, the thing inside
      both((s) => {
        const deg = s * open * 38;
        const piv = [f0, u0 - 1.6, 0];
        M.G("half" + s);
        M.e(rollPt([f0, u0, s * 1.6], deg, piv), [4.8, 2.8, 1.5], CAT, [0, 0, deg]);
        const hd = rollPt([f0 + 5, u0 + 2.2, s * 1.4], deg, piv);
        M.e(hd, [1.8, 2.1, 1.3], CAT, [0, 0, deg]);
        M.G();
        M.cone(hd, rollPt([f0 + 4.6, u0 + 5.4, s * 2.4], deg, piv), 1, CAT);
        M.eye(rollPt([f0 + 6.4, u0 + 2.8, s * 2.2], deg, piv), 2, "#c8e040");
        M.e(rollPt([f0 + 0.4, u0 + 0.8, s * 0.2], deg, piv), [4.2, 2, 0.4], C.RAW, [0, 0, deg]);
        teeth(M, rollPt([f0 + 4, u0 + 2.6, s * 0.4], deg, piv), rollPt([f0 - 3, u0 + 2.4, s * 0.4], deg, piv), 5, -s * 0, 0.4);
      });
      M.e([f0 + 0.6, u0 - 0.4, 0], [4, 1.8, 1.2 + open], C.MAW);
      for (let i = 0; i < 5; i++) both((s) => M.cone([f0 - 2.6 + i * 1.6, u0, s * (0.9 + open)], [f0 - 2.4 + i * 1.6, u0 + 0.4, s * 0.1], 0.5, C.TOOTH));
      M.tube(bez([f0 + 1, u0, 0], [f0 + 3, u0 + 5 * open + 1, 0], [f0 + 6 + (p.strike ? 2 : 0), u0 + 2 + open * 2, 0], 6), [0.9, 0.5], C.TONGUE);
      M.eye([f0 + 6 + (p.strike ? 2 : 0), u0 + 2.6 + open * 2, 0], 2, "#e02838");
      M.tube(bez([f0 - 4.4, u0 + 0.6, 0], [f0 - 7, u0 + 1, 0], [f0 - 7, u0 + 5, p.walk ? Math.sin(p.ph * 6.28) : 0.5], 6), [0.8, 0.6], CAT);
    },
  },

  /** 다리 달린 생선 — a fish that walked out of the river on legs it should not have, and stamps. */
  fishwalker: {
    size: "m",
    draw(M, p) {
      const jump = p.wind ? 2.6 : 0;
      const [lf, lu] = lunge(p, 0.8);
      const f0 = lf, u0 = 11 + lu + bob(p, 1) + jump;
      M.G("fish");
      M.e([f0, u0, 0], [6, 3.2, 2], FISH, [0, p.wind ? 12 : p.strike ? -12 : 0, 0]);
      M.e([f0 + 0.4, u0 - 1.4, 0], [5, 1.6, 1.7], FISHB);
      M.G();
      for (let i = 0; i < 4; i++) M.dot([f0 + 2 - i * 1.6, u0 + 2.6 - Math.abs(i - 1) * 0.2, 0], "#4a6278");
      both((s) => { for (let i = 0; i < 3; i++) M.dot([f0 + 1.5 - i * 1.8, u0 + 0.2 - i * 0.1, s * 2], "#d82838", 1, 2); });
      // fins and the tail
      M.e([f0 - 0.6, u0 + 3.2, 0], [2.6, 1.4, 0.3], FIN, [0, -14, 0]);
      const wag = p.walk ? Math.sin(p.ph * 6.28) * 18 : p.idle ? 6 : 0;
      M.e([f0 - 6.6, u0 + 0.2, 0], [1.8, 2.8, 0.35], FIN, [wag, 0, 0]);
      both((s) => M.e([f0 + 2, u0 - 1, s * 2.2], [1.6, 0.6, 1], FIN, [s * 30, -20, s * 30]));
      // the head: a dead flat eye and a mouth full of someone's teeth
      const HR = [3, 2.6, 1.9];
      both((s) => M.eye(surf([f0 + 3.6, u0 + 0.6, 0], HR, [0.3, 0.2, s * 0.95]), 3, "#e8e0c0", { white: "#c8d0d0" }));
      const open = p.strike ? 1.2 : p.wind ? 0.9 : 0.4;
      M.e([f0 + 6, u0 - 0.8, 0], [0.6, 0.6 + open, 1], C.MAW);
      teeth(M, [f0 + 6.1, u0 - 0.2 + open * 0.4, -0.7], [f0 + 6.1, u0 - 0.2 + open * 0.4, 0.7], 3, 1, 0.7);
      teeth(M, [f0 + 6, u0 - 1.5 - open * 0.5, -0.7], [f0 + 6, u0 - 1.5 - open * 0.5, 0.7], 3, -1, 0.6);
      // two long pale legs, with knees
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0 : 0.5);
        const a = p.dead ? 2 : p.wind ? 0.8 : p.strike ? (s < 0 ? 1.4 : -0.4) : sw * 1.6;
        const top = [f0, u0 - 2.4, s * 1.4], ft = [f0 + a, up * 2.4 + (p.wind ? 1.4 : 0), s * 1.8];
        const kn = [(top[0] + ft[0]) / 2 + 1.6, (top[1] + ft[1]) / 2 + 0.6, s * 1.7];
        M.tube([top, kn, ft], [1.1, 0.9, 0.7], LEG);
        M.e([ft[0] + 0.8, ft[1] + 0.4, ft[2]], [1.5, 0.5, 0.8], LEG);
      });
    },
  },
};
