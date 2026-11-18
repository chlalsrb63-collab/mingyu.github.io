/**
 * 먹빛 호수 (maps-batch2 §6) beasts with their own bodies: ink-black/indigo hide, pale ink splashes, brush-stroke
 * tails and wings, reed and lotus bits, eerie white eyes. Kinds: inkleech, inkfish, inkcrane, inkmoth, plumspider,
 * inkrose, inkfox (the rare white one) and inkserpent (the field boss).
 */
import { mat, bez, gait, bob, lunge, both, rollPt } from "./mobart_kit.js";

const INK = mat("#1e2236"), INKD = mat("#12151f", { flat: true }), INKL = mat("#3c4870");
const PALE = mat("#dfe3ec", { role: "keep" }), EYE = mat("#f4f8ff", { role: "glow" });
const REED = mat("#6a7a52", { flat: true }), LOTUS = mat("#ecc8d6", { role: "keep" }), PLUM = mat("#c4486a", { role: "keep" });
const FUR = mat("#e6e8ee"), FURD = mat("#aeb4c6");

const eyes = (M, h, s = 1) => both((d) => M.dot([h[0] + 0.9 * s, h[1] + 0.4, h[2] + d * 1.1 * s], "#f4f8ff", 1, 1));
/** Pale splashes over a body: [forward, up, side] offsets from a centre. */
const splash = (M, c, list) => list.forEach(([a, b, d]) => M.dot([c[0] + a, c[1] + b, c[2] + d], "#dfe3ec", 1, 1));
const flap = (p) => (p.walk ? Math.sin(p.ph * Math.PI * 2) * 0.9 : p.wind ? 1 : p.strike ? -0.6 : p.idle ? -0.2 : 0.2);

export const INKLAKE_ART = {
  /** 먹 거머리 아가리 — a fat ringed ink-leech that rears to bite: a sucker mouth of pale teeth with one white eye
   *  staring from its throat, a row of white eyes down each flank, a reed growing from its back. */
  inkleech: {
    size: "m", glow: "#f4f8ff", k: 1.3,
    draw(M, p) {
      const [lf] = lunge(p, 1.2), rear = p.wind ? 1 : p.strike ? 0.6 : 0, seg = [];
      M.G("body");
      for (let i = 0; i < 7; i++) {
        const w = p.walk ? Math.max(0, Math.sin((p.ph - i * 0.14) * Math.PI * 2)) : 0;
        const r = 3.2 - Math.abs(i - 2) * 0.3 - (i > 4 ? (i - 4) * 0.35 : 0);
        const c = [lf + 3.6 - i * 2 + w * 0.5, r + w * 1.2 + (i < 2 ? rear * (3 - i) * 1.2 : 0) + (i ? 0 : bob(p, 0.3)), 0];
        seg.push([c, r]);
        M.s(c, r, i % 2 ? INKL : INK);
      }
      M.G();
      // white eyes down both flanks, one per ring, like a row of lit windows
      for (let i = 1; i < 6; i++) { const [c, r] = seg[i]; both((d) => M.dot([c[0], c[1] + 0.6, d * (r - 0.3)], "#f4f8ff", 1, 1)); }
      splash(M, seg[3][0], [[0.6, 2.6, 0.8], [-1.4, 2.2, -1.2]]);
      // the sucker: a ring of ink flesh, pale teeth turned inward, black throat with an eye in it
      const mc = [seg[0][0][0] + 2.8 + (p.strike ? 1 : 0), seg[0][0][1] + 0.4 + rear * 1.6, 0], open = p.strike ? 1.3 : p.wind ? 1.1 : 0.9;
      M.e(mc, [1.2, 3.2 * open, 3.2 * open], INKL, [0, rear * 30, 0]);
      M.e([mc[0] + 0.8, mc[1], 0], [0.6, 1.9 * open, 1.9 * open], INKD, [0, rear * 30, 0]);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, cu = Math.cos(a), cs = Math.sin(a); M.cone([mc[0] + 1.1, mc[1] + cu * 2.3 * open, cs * 2.3 * open], [mc[0] + 1.7, mc[1] + cu * 1.1 * open, cs * 1.1 * open], 0.5, PALE); }
      M.dot([mc[0] + 1.4, mc[1], 0], "#f4f8ff", 1, 1);
      const t = [seg[3][0][0], seg[3][0][1] + seg[3][1] - 0.4, 0.4];
      M.tube([t, [t[0] - 0.4, t[1] + 4, 0.4], [t[0] - 1.6, t[1] + 7.2, 0.4]], [0.5, 0.4, 0.3], REED);
      M.e([t[0] - 1.6, t[1] + 7.6, 0.4], [0.7, 1.4, 0.7], INKD);
    },
  },
  /** 먹빛 다리 달린 생선 — an upright carp on two thin human legs (pale kneecaps), a wide grin of flat human teeth,
   *  tail fanned like a brush stroke, pale ink-flecks. */
  inkfish: {
    size: "m", glow: "#f4f8ff", k: 1.2,
    draw(M, p) {
      const [lf, lu] = lunge(p), u0 = 7 + lu + bob(p, 0.5);
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0 : 0.5);
        M.tube([[lf - 0.5, u0 - 3, s * 1.2], [lf + sw * 1.4, u0 - 6 + up, s * 1.4], [lf + sw * 1.8 + 0.8, up * 1.2, s * 1.5]], [0.8, 0.6, 0.45], INKD);
        M.dot([lf + sw * 1.4 + 0.6, u0 - 6 + up, s * 1.4], "#dfe3ec", 1, 1);
        M.cone([lf + sw * 1.8 + 0.8, up * 1.2, s * 1.5], [lf + sw * 1.8 + 2.4, 0.1, s * 1.7], 0.5, PALE);
      });
      M.G("body");
      M.e([lf, u0, 0], [5.6, 3.8, 2.4], INK);
      M.e([lf, u0 - 1.8, 0], [4.6, 1.8, 2.2], INKL);
      M.G();
      splash(M, [lf, u0, 0], [[-2, 1.4, 2.3], [0, 2, 2.2], [2, 1.2, 2.3], [-3, -0.4, 2.3], [1, -0.6, -2.3]]);
      M.cone([lf - 0.4, u0 + 3.4, 0], [lf - 3.4, u0 + 6.4, 0], 1, INKD);
      M.cone([lf + 5, u0 + 0.2, 0], [lf + 7, u0 - 0.6 - (p.strike ? 0.8 : 0), 0], 1.1, INKL);
      const tl = bez([lf - 5, u0, 0], [lf - 9, u0 + 1 + (p.walk ? Math.sin(p.ph * 6.28) : 0), 0], [lf - 10, u0 + 5, 0], 5);
      M.tube(tl, [1.6, 0.4], INK);
      M.tube([[lf - 8, u0 + 1, 0], [lf - 11, u0 - 2, 0]], [0.8, 0.2], INKD);
      eyes(M, [lf + 4.6, u0 + 1.2, 0], 1);
      both((d) => {
        M.seam([[lf + 6.6, u0 - 0.2, 0], [lf + 3.4, u0 - 0.9, d * 1.9]], "#12151f");
        for (let i = 0; i < 4; i++) M.dot([lf + 6 - i * 0.8, u0 - 0.5 - i * 0.2, d * i * 0.5], "#dfe3ec", 1, 1);
      });
    },
  },
  /** 먹빛 겹날개 두루미 — a tall crane with two stacked pairs of brush-stroke wings. */
  inkcrane: {
    size: "l", n: 70, hover: 6, glow: "#f4f8ff",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.1), c = [lf, 9 + lu + bob(p, 0.6), 0], fl = flap(p);
      M.G("body");
      M.e(c, [4.4, 3, 2.8], INK);
      M.G();
      M.tube([[c[0] - 3, c[1] - 0.4, 0], [c[0] - 7, c[1] - 1.4, 0], [c[0] - 9.6, c[1] - 0.2, 0]], [1.6, 1, 0.3], INKD);
      both((s) => M.tube([[c[0], c[1] - 2, s * 1], [c[0] + 0.4, c[1] - 5.4, s * 1.2], [c[0] + 0.2, 0.4 + (p.walk ? Math.max(0, gait(p, s > 0 ? 0 : 0.5)[1]) : 0), s * 1.2]], [0.5, 0.4, 0.35], REED));
      const nk = [[c[0] + 3, c[1] + 1, 0], [c[0] + 5.4, c[1] + 4.6, 0], [c[0] + 5, c[1] + 8, 0]];
      M.tube(nk, [1.2, 0.9, 0.9], INK);
      const h = [nk[2][0] + 0.6, nk[2][1] + 0.6, 0];
      M.e(h, [1.5, 1.2, 1.2], PALE);
      M.cone([h[0] + 1, h[1] - 0.2, 0], [h[0] + 6 + (p.strike ? 1.4 : 0), h[1] - 1.4, 0], 0.6, INKD);
      eyes(M, h, 0.8);
      both((s) => {
        for (let k = 0; k < 2; k++) {
          const rise = (k ? 1.8 : 4) + fl * (k ? 2 : 3.4), sh = [c[0] - 0.4 - k * 1.2, c[1] + 1.6, s * 2.2];
          M.tube([sh, [sh[0] - 2 - k, sh[1] + rise, s * 6], [sh[0] - 3 - k * 2, sh[1] + rise * 0.6 - 2, s * (11 - k * 2)]], [1.2, 1, 0.3], k ? INKL : INK);
          M.tube([[sh[0] - 1, sh[1] + 0.4, s * 3], [sh[0] - 4 - k, sh[1] + rise * 0.3 - 1.4, s * (10 - k * 2)]], [0.6, 0.2], PALE);
        }
      });
    },
  },
  /** 인면 먹나방 — a moth with a pale human mask, wide ink wings with ringed eye-spots, reed antennae. */
  inkmoth: {
    size: "m", hover: 7, glow: "#f4f8ff", death: "burst", k: 1.2,
    draw(M, p) {
      const [lf, lu] = lunge(p), c = [lf, 7 + lu + bob(p, 0.7), 0], fl = flap(p);
      M.G("body");
      M.e(c, [2.6, 4, 2.4], INK);
      M.e([c[0] - 1.2, c[1] - 3.4, 0], [2, 2.6, 1.8], INKL);
      M.G();
      // thin wing sheets (fore ink, hind indigo) that tilt with the beat; each forewing carries an eye that stares
      both((s) => {
        const deg = -s * (10 + fl * 35), root = [c[0] - 0.4, c[1] + 1.4, s * 1.6];
        const W = (df, du, d, r, m) => M.e(rollPt([root[0] + df, root[1] + du, root[2] + s * d], deg, root), r, m, [0, 0, deg]);
        W(0.6, 0, 5.2, [3.4, 0.5, 5.2], INK);
        W(-3, -0.6, 4.2, [2.6, 0.45, 4.2], INKL);
        M.eye(rollPt([root[0] + 0.8, root[1] + 0.6, root[2] + s * 5.6], deg, root), 3, "#12151f", { white: "#f4f8ff" });
        M.dot(rollPt([root[0] + 2.4, root[1] + 0.6, root[2] + s * 8.6], deg, root), "#dfe3ec", 1, 1);
      });
      const f = [c[0] + 1.6, c[1] + 4.4, 0];
      M.e(f, [1.9, 2.2, 1.8], PALE);
      M.dot([f[0] + 1.6, f[1] - 1.4, 0], "#12151f", 1, 1);
      eyes(M, [f[0] + 0.6, f[1] + 0.2, 0], 1.1);
      both((d) => M.dot([f[0] + 1.5, f[1] - 0.6, d * 1.2], "#12151f", 1, 2));
      both((s) => M.tube([[f[0] + 0.4, f[1] + 1.6, s * 0.8], [f[0] - 0.4, f[1] + 4.4, s * 2], [f[0] - 1.8, f[1] + 5.4, s * 3.6]], [0.35, 0.3, 0.3], REED));
    },
  },
  /** 매화 손가락 거미 — a spider whose legs are long pale fingers (knuckles, nails), plum blossoms in bloom on its
   *  swollen back, a cluster of six white eyes. */
  plumspider: {
    size: "m", glow: "#c4486a", k: 1.15,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.1), u0 = 3.6 + lu * 0.5 + bob(p, 0.4);
      both((s) => {
        for (let i = 0; i < 4; i++) {
          const [sw, up] = gait(p, (i % 2 ? 0.5 : 0) + (s < 0 ? 0 : 0.25));
          const reach = p.strike && i === 0 ? 2.4 : 0;
          const hip = [lf + 2.6 - i * 1.9, u0, s * 2.4], kn = [lf + 3.4 - i * 2.4 + sw * 0.8 + reach * 0.5, u0 + 3.8 + up, s * 5.2], ft = [lf + 3.4 - i * 2.4 + sw * 1.4 + reach, up * 1.2 + reach, s * 6.8];
          M.tube([hip, kn, ft], [0.9, 0.7, 0.45], FURD);
          M.dot(kn, "#dfe3ec", 1, 1);
          M.cone(ft, [ft[0] + 0.8, 0.1, ft[2] + s * 0.6], 0.5, PALE);
        }
      });
      M.G("body");
      M.e([lf - 2.4, u0 + 1, 0], [4.8, 3.2, 4], INK);
      M.e([lf + 3, u0, 0], [2.8, 2.1, 2.6], INKL);
      M.G();
      for (const [a, b, d] of [[-3.4, 3.2, -1.4], [-1, 3.6, 1.2], [-4.6, 2.6, 1.6]]) {
        M.tube([[lf + a, u0 + 2, d * 0.4], [lf + a, u0 + b, d]], [0.35, 0.3], REED);
        for (let k = 0; k < 5; k++) { const th = k * 1.257; M.dot([lf + a + Math.cos(th) * 0.8, u0 + b + 0.4 + Math.sin(th) * 0.8, d], "#c4486a", 1, 1); }
        M.dot([lf + a, u0 + b + 0.4, d], "#f4e8a0", 1, 1);
      }
      const h = [lf + 5.4 + (p.strike ? 1 : 0), u0 + 0.4, 0];
      for (const [a, b, d] of [[0.9, 0.4, 1.1], [0.9, 0.4, -1.1], [0.3, 1.4, 0.7], [0.3, 1.4, -0.7], [1.1, -0.5, 0.5], [1.1, -0.5, -0.5]]) M.dot([h[0] + a, h[1] + b, d], "#f4f8ff", 1, 1);
      both((s) => M.cone([h[0] + 1.2, h[1] - 0.8, s * 0.8], [h[0] + 2.8, h[1] - 1.8, s * 0.4], 0.5, PALE));
    },
  },
  /** 붉은 묘지 매화 — a black lotus-rose on a thorned stem standing on root legs, one white eye in the bloom. */
  inkrose: {
    size: "m", glow: "#f4f8ff", k: 1.4,
    draw(M, p) {
      const [lf, lu] = lunge(p, 0.8), sway = p.walk ? Math.sin(p.ph * Math.PI * 2) : p.idle * 1.3, open = p.wind ? 0.55 : p.strike ? 1.5 : 1;
      both((s) => { const [sw, up] = gait(p, s < 0 ? 0 : 0.5); M.tube([[lf, 3, s * 0.8], [lf + sw * 1.2, 1.6 + up, s * 3], [lf + sw * 1.6 + s * 0.2, up * 1.1, s * 4.2]], [0.8, 0.6, 0.4], REED); });
      const base = [lf, 3 + lu, 0], top = [lf + 0.8 + sway, 10.4 + lu + bob(p, 0.3), 0];
      M.G("body");
      M.tube([base, [lf - 0.8, 6.4 + lu, 0], top], [1.8, 1.3, 1.4], INKD);
      M.G();
      for (const u of [5, 7.4]) M.cone([lf, u + lu, 0.8], [lf + 1.6, u + 1.4 + lu, 2.2], 0.4, PALE);
      for (const [a, u] of [[-1.4, 4.6], [1.4, 6.6]]) { M.tube([[lf, u + lu, 0], [lf + a * 2.6, u + 1 + lu, a * 2.4]], [0.5, 0.3], REED); M.e([lf + a * 3, u + 1.2 + lu, a * 2.6], [1.8, 0.4, 1.2], INKL); }
      // lotus petals: an outer ring that opens when it strikes, an inner ring of red plum
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047;
        M.cone([top[0], top[1], 0], [top[0] + Math.sin(a) * 1.6 * open - 0.4, top[1] + 2.6 * (2 - open) * 0.7, Math.cos(a) * 4.6 * open], 1.9, i % 3 === 0 ? LOTUS : INKL);
      }
      for (let i = 0; i < 5; i++) { const a = i * 1.257; M.cone([top[0], top[1] + 0.4, 0], [top[0] + Math.sin(a) * 0.8, top[1] + 2.6, Math.cos(a) * 1.8], 0.8, PLUM); }
      M.s([top[0] + 0.4, top[1] + 1.2, 0], 1.6, EYE);
      M.dot([top[0] + 1.6, top[1] + 1.2, 0], "#12151f", 1, 2);
      M.seam([[top[0] + 1.2, top[1] - 0.2, 0], [top[0] + 1.2, top[1] - 1.8, 0.3]], "#12151f");
      for (let i = 0; i < 4; i++) M.dot([top[0] + 1 + i * 0.3, top[1] - 0.6 - i * 0.7, 2 + i * 0.1], "#dfe3ec", 1, 1);
    },
  },
  /** 흰 꼬인 여우 — the rare white fox: pale fur sprinkled with ink, two tails braided into one, ink-ringed eyes. */
  inkfox: {
    size: "m", glow: "#7a88c8", k: 1.06,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2), f0 = lf, u0 = 5 + lu + bob(p, 0.5);
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0 : 0.5);
        M.tube([[f0 + 3, u0 - 0.6, s * 1.4], [f0 + 3.4 + sw, u0 - 3 + up, s * 1.6], [f0 + 3.8 + sw * 1.4, up * 1.1, s * 1.6]], [0.9, 0.6, 0.5], FURD);
        M.tube([[f0 - 3, u0 - 0.4, s * 1.4], [f0 - 3.6 - sw * 0.6, u0 - 2.6 + up, s * 1.6], [f0 - 3.4 - sw * 1.2, up * 1.1, s * 1.6]], [1.1, 0.7, 0.5], FURD);
        M.dot([f0 + 3.8 + sw * 1.4, 0.2, s * 1.6], "#12151f", 1, 1);
      });
      M.G("body");
      M.e([f0, u0, 0], [4.6, 2.4, 2.4], FUR);
      M.e([f0 + 2.8, u0 + 0.4, 0], [2.2, 2.2, 2.2], FUR);
      M.G();
      splash(M, [f0, u0 + 1.4, 0], [[-2, 0.4, 1.8], [0.6, 0.6, -1.8], [2, -0.4, 1.9], [-3.4, -0.4, -1.4]]);
      const h = [f0 + 5.6 + (p.strike ? 1 : 0), u0 + 1.4, 0];
      M.e(h, [2, 1.7, 1.7], FUR);
      M.cone([h[0] + 1.4, h[1] - 0.4, 0], [h[0] + 3.8, h[1] - 0.9, 0], 0.9, FUR);
      M.dot([h[0] + 3.7, h[1] - 0.8, 0], "#12151f", 1, 1);
      both((s) => { M.cone([h[0] - 0.6, h[1] + 1.2, s * 1.2], [h[0] - 1.4, h[1] + 3.8, s * 1.6], 0.9, FURD); M.dot([h[0] + 0.8, h[1] + 0.4, s * 1.5], "#12151f", 1, 2); M.dot([h[0] + 1, h[1] + 0.4, s * 1.5], "#f4f8ff", 1, 1); });
      // two tails braided round one another, tips dipped in ink
      const sw = p.walk ? Math.sin(p.ph * 6.28) * 0.8 : p.idle ? Math.sin(p.ph * 6.28) * 0.5 : 0;
      for (const d of [-1, 1]) {
        const tl = [0, 1, 2, 3, 4, 5].map((i) => [f0 - 3.4 - i * 1.5, u0 + 0.6 + i * 0.9 + (p.wind ? i * 0.2 : 0), Math.sin(i * 1.4) * d * 1.4 + sw * i * 0.2]);
        M.tube(tl, [1.5, 1.6, 1.5, 1.2, 0.9, 0.5], FUR);
        M.cone(tl[5], [tl[5][0] - 1.4, tl[5][1] + 1.6, tl[5][2]], 0.8, INK);
      }
    },
  },
  /** 먹빛 날개 구렁이 — field boss: a great ink serpent coiled on the lake, a pair of torn brush-stroke wings, a lotus crest. */
  inkserpent: {
    size: "xl", n: 92, hover: 5, glow: "#f4f8ff", k: 1.05,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2), c = [lf, 9 + lu + bob(p, 0.7), 0], fl = flap(p), w = p.walk ? Math.sin(p.ph * 6.28) * 1.2 : p.idle ? Math.sin(p.ph * 6.28) * 0.5 : 0;
      const coil = [[c[0] - 14, 2.4, 4 + w], [c[0] - 12, 5.4, -4 - w], [c[0] - 8, 3, -5], [c[0] - 4, 5.6, 3 + w], [c[0], c[1] - 1, 0], [c[0] + 3, c[1] + 3, 0]];
      M.G("body");
      M.tube(coil, [1.2, 2.2, 2.8, 3.2, 3.8, 3.2], INK);
      M.G();
      M.tube(coil.slice(0, 5).map(([a, b, d]) => [a, b - 1.4, d]), [0.8, 1.4, 1.8, 2, 2.4], INKL);
      for (let i = 1; i < 5; i++) splash(M, [coil[i][0], coil[i][1] + 2, coil[i][2]], [[0, 1, 1.6], [1, 0.4, -1.8]]);
      // head rises from the coil, a lotus crest on the brow
      const nk = [coil[5], [c[0] + 5, c[1] + 6.6, 0], [c[0] + 6.4 + (p.strike ? 2.4 : 0), c[1] + 10 + (p.wind ? 1 : 0), 0]];
      M.tube(nk, [3.2, 2.6, 2.4], INK);
      const h = [nk[2][0] + 1.4, nk[2][1] + 0.6, 0];
      M.e(h, [3.6, 2.2, 2.4], INK);
      M.cone([h[0] + 2, h[1] - 0.6, 0], [h[0] + 6, h[1] - 1.6 - (p.strike ? 1.4 : 0), 0], 1.4, INKL);
      both((s) => { M.cone([h[0] + 3.4, h[1] - 1.2, s * 0.8], [h[0] + 4.4, h[1] - 3, s * 0.6], 0.4, PALE); M.dot([h[0] + 1.6, h[1] + 0.8, s * 2.3], "#f4f8ff", 2, 1); });
      for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; M.cone([h[0] - 1.4, h[1] + 1.8, 0], [h[0] - 2.6 + Math.sin(a) * 2, h[1] + 5.4 - Math.abs(a) * 2, Math.sin(a) * 3.2], 1, i % 2 ? PLUM : LOTUS); }
      // torn wings with ink-bleed feathers hanging from the long fingers
      both((s) => {
        const sh = [c[0] - 1.6, c[1] + 2.6, s * 3], up = 5 + fl * 6, tip = [sh[0] - 4, sh[1] + up, s * 17];
        M.tube([sh, [sh[0] - 1, sh[1] + up * 0.8, s * 9], tip], [1.6, 1.3, 0.5], INK);
        for (let i = 0; i < 5; i++) { const t = (i + 1) / 6, b = [sh[0] - 1.4 - 2.4 * t, sh[1] + up * (1 - t * 0.2) - t * 2, s * (4 + 12 * t)]; M.tube([b, [b[0] - 1.4, b[1] - 6 - (i % 2) * 3 + fl * 1.4, b[2] + s * 0.4]], [1.5, 0.3], i % 2 ? INKL : INK); }
        M.tube([[sh[0] - 0.4, sh[1] + 0.6, s * 4], [sh[0] - 3.4, sh[1] + up * 0.4 - 2, s * 14]], [0.8, 0.2], PALE);
      });
    },
  },
};
