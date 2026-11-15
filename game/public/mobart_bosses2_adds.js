/** Bosses-2 adds with their own bodies: 혈루 결정 전갈, 밤장막 흡혈박쥐, 먹장어 머리. */
import { mat, C, bez, gait, bob, lunge, surf, both, rollPt } from "./mobart_kit.js";

const SHELL = mat("#5a2a34"), SHELLD = mat("#3c1c28");
const SHARD = mat("#e0485a", { role: "glow" }), SHARDD = mat("#a02840", { flat: true });
const WARM = mat("#ffb450", { role: "glow" });

const BATB = mat("#3a2448"), BATM = mat("#6a2c50", { flat: true }), BATR = mat("#8a3a5a");

const HAG = mat("#7a7090", { wet: true, drip: true }), HAGD = mat("#544c68", { wet: true });
const HAGP = mat("#b8a4b8", { wet: true });
const ICE = mat("#9ad8f0", { role: "glow" });

export const BOSSES2_ADD_ART = {
  /** 혈루 결정 전갈 — a scorpion with the lizard king's blood-tear crystals grown through its back and tail. */
  bloodshard: {
    size: "m", k: 1.1, glow: "#ff5a6a",
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 3 + lu + bob(p, 0.4);
      both((s) => {
        for (let i = 0; i < 4; i++) {
          const [sw, up] = gait(p, (i % 2 ? 0.5 : 0) + (s < 0 ? 0 : 0.5));
          const top = [f0 + 2.4 - i * 1.9, u0, s * 1.6], ft = [f0 + 3.4 - i * 2.2 + sw * 1.1, up * 1.2, s * 6];
          M.tube([top, [(top[0] + ft[0]) / 2, u0 + 1.8, s * 4.4], ft], [0.7, 0.6, 0.4], i % 2 ? SHELLD : SHELL);
        }
      });
      M.G("body");
      M.e([f0, u0, 0], [5.6, 2.8, 3.4], SHELL);
      M.e([f0 + 4.4, u0 - 0.2, 0], [2.6, 2.2, 2.6], SHELLD);
      M.G();
      // crystals through the back, bigger toward the tail
      [[-2.4, 3.4], [0, 4.4], [2.2, 3]].forEach(([d, h], i) => {
        M.cone([f0 + d, u0 + 1.8, (i - 1) * 0.9], [f0 + d - 0.6, u0 + 1.8 + h, (i - 1) * 1.3], 1.1, i % 2 ? SHARDD : SHARD);
      });
      const tipAt = p.strike ? [f0 + 7, u0 + 5, 0] : p.wind ? [f0 - 4, u0 + 13, 0] : [f0 + 0.5, u0 + 11 + (p.idle ? 0.5 : 0), 0];
      const tail = bez([f0 - 5.4, u0 + 1.2, 0], [f0 - 10.5, u0 + (p.strike ? 11 : 8), 0], tipAt, 6);
      M.tube(tail, [1.7, 1], SHELL);
      tail.forEach((q, i) => { if (i && i < 6) M.cone([q[0], q[1] + 0.6, 0], [q[0] - 0.8, q[1] + 3 - i * 0.2, 0], 0.7, i % 2 ? SHARD : SHARDD); });
      const T = tail[6];
      M.cone([T[0], T[1] + 0.4, 0], [T[0] + 1.8, T[1] - 2.4, 0], 1.2, WARM);
      M.dot([T[0] + 1.8, T[1] - 2.4, 0], "#fff0b0", 1, 1);
      const open = p.wind ? 1 : p.strike ? 0.1 : 0.45, re = p.strike ? 1.6 : 0;
      both((s) => {
        const el = [f0 + 6, u0 + 0.8, s * 3.8], hd = [f0 + 8.4 + re, u0 + 0.4, s * 3 - s * open];
        M.tube([[f0 + 4.4, u0 + 0.2, s * 1.4], el, hd], [0.9, 0.9, 1.2], SHELL);
        M.cone([hd[0], hd[1], hd[2]], [hd[0] + 2.2, hd[1], hd[2] - s * (0.8 + open * 1.6)], 0.9, SHARD);
        M.eye([f0 + 6.6, u0 + 1.4, s * 1], 1, "#ffd060");
      });
    },
  },

  /** 밤장막 흡혈박쥐 — a small dark-crimson bat fallen from the lord's cloak, mostly wings and fangs. */
  nightbat: {
    size: "m", hover: 9, glow: "#c0306a", death: "burst",
    draw(M, p) {
      const t = p.walk ? p.ph : p.idle * 0.25 + (p.strike ? 0.5 : 0);
      const [lf, lu] = lunge(p);
      const c = [lf, 6.4 + lu, 0];
      M.G("body");
      M.e(c, [3.2, 2.8, 2.6], BATB);
      M.e([c[0] - 3, c[1] - 0.8, 0], [2.4, 1.6, 1.6], BATB);
      M.G();
      both((s) => {
        const fl = Math.sin(t * Math.PI * 2) * 0.9, deg = -s * fl * 55;
        const root = [c[0] + 0.4, c[1] + 0.8, s * 2.2];
        const R = (d, dd, h) => rollPt([root[0] + d, root[1] + h, root[2] + s * dd], deg, root);
        const tip = R(1.2, 8.4, 1), t2 = R(-2.6, 7, -0.8), t3 = R(-4.6, 4.4, -1.4);
        M.tube([root, R(0.6, 4.2, 1.6), tip], [0.7, 0.4], BATR);
        M.tube([root, R(-0.6, 4, 0.2), t2], [0.5, 0.3], BATR);
        M.e(R(-1.2, 4.4, 0.4), [2.2, 0.3, 3.8], BATM, [0, 0, deg]);
        M.e(R(-2.8, 3.6, -0.4), [1.8, 0.3, 2.4], BATM, [0, 0, deg]);
        M.cone(tip, [tip[0] + 0.8, tip[1] + 0.5, tip[2]], 0.35, C.NAIL);
        M.cone(t3, [t3[0] - 0.4, t3[1], t3[2]], 0.3, BATR);
        M.cone([c[0] + 0.4, c[1] + 2.2, s * 1.6], [c[0] - 0.2, c[1] + 4.6, s * 2.2], 0.7, BATB);
        M.eye([c[0] + 2.8, c[1] + 0.7, s * 1.3], 1, "#ff3a78");
        M.cone([c[0] + 3.2, c[1] - 1.2, s * 0.7], [c[0] + 3.4, c[1] - 3.1 - (p.wind || p.strike ? 0.8 : 0), s * 0.7], 0.4, C.TOOTH);
      });
      M.e([c[0] + 3.2, c[1] - 0.2, 0], [1.1, 1, 1.2], BATB);
      if (p.strike || p.wind) M.dot([c[0] + 3.7, c[1] - 0.9, 0], "#d82838", 1, 2);
    },
  },

  /** 먹장어 머리 — a hagfish playing a whale's head: a slimy grey-violet body coiled up, a round toothed sucker for a mouth. */
  hagfishhead: {
    size: "l", glow: "#7ad0f0", death: "melt",
    draw(M, p) {
      const t = p.walk ? p.ph : p.idle * 0.2;
      const [lf, lu] = lunge(p, 1.2);
      const c = [lf, 8 + lu, 0], R = 6.4;
      // two loops of body round a middle
      [0, 1].forEach((i) => {
        const pts = [];
        for (let a = 0; a <= 1.02; a += 0.07) {
          const th = a * Math.PI * 1.9 + i * 2.2 + t * 0.8;
          pts.push([c[0] - 2 + Math.cos(th) * (R - i * 1.2), 3.2 + i * 3.6 + a * 2 + lu * 0.5, Math.sin(th) * (R + 1 - i * 1.2)]);
        }
        M.tube(pts, [2.4, 2.8], i ? HAG : HAGD);
      });
      // the head rises out of the coil, mouth forward
      const nk = bez([c[0] - 3, 7, 3], [c[0] - 1, 12 + (p.wind ? 2 : 0), 2], [c[0] + 3 + (p.strike ? 3 : 0), 13.5 + lu, 0], 5);
      M.tube(nk, [2.4, 2.8], HAG);
      const h = nk[5], mouth = [h[0] + 1.8, h[1] - 0.2, 0];
      M.G("mouth");
      M.e(mouth, [1.6, 3.6, 3.6], HAGP);
      M.e([mouth[0] + 1, mouth[1], 0], [0.7, p.wind ? 2.8 : 2.2, p.wind ? 2.8 : 2.2], C.MAW);
      M.G();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, y = Math.cos(a) * 2.6, z = Math.sin(a) * 2.6;
        M.cone([mouth[0] + 1.5, mouth[1] + y, z], [mouth[0] + 1.2, mouth[1] + y * 0.45, z * 0.45], 0.45, C.TOOTH);
      }
      M.dot([mouth[0] + 1.6, mouth[1], 0], p.strike ? "#ff8a60" : "#7a1830", 2, 2);
      both((s) => {
        M.eye(surf(h, [2.8, 2.8, 2.8], [0.2, 0.7, s * 0.8]), 1, "#b8e8ff");
        const b = [h[0] - 0.5, h[1] - 2.6, s * 1.6];
        M.tube([b, [b[0] + 0.8, b[1] - 1.2, s * 2.4]], [0.5, 0.3], HAGP);
      });
      // frost-blue slime flecks along the coil, and a pale tail tip
      [[-6, 5.5, 5], [4, 7.5, -5.5], [-1, 10.6, 5.2], [-3, 9, 6.2]].forEach(([x, y, z]) => M.dot([c[0] + x, y, z], "#9ad8f0", 1, 1));
      M.cone([c[0] - 7.6, 4, 0], [c[0] - 11, 3, 2], 1, ICE);
    },
  },
};
