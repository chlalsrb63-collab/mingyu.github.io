/** Named hunting-ground beasts with their own bodies: 금 간 뿔 숫양, 검은 왕관 뿌리짐승, 눈먼 문지기 올빼미, 얼어붙은 왕릉 파수꾼. */
import { mat, C, bez, gait, bob, lunge, legs4, both } from "./mobart_kit.js";

const WOOL = mat("#8a8068"), WOOLD = mat("#5e5646"), HOOF = mat("#2a2024", { role: "keep", flat: true });
const RHORN = mat("#c8b890"), POST = mat("#7a5a3a", { flat: true });

const ROOT = mat("#4a3a2a"), ROOTD = mat("#2e2218"), MOSS = mat("#5a6a2c", { wet: true });
const CROWN = mat("#1a1420", { role: "keep", flat: true });

const FEA = mat("#8a7c68"), FEAD = mat("#5a4e40"), FEAL = mat("#b8aa90", { flat: true });
const GATE = mat("#a89a3c", { role: "keep" });

const ST = mat("#a8c4d4"), STD = mat("#6e8ca0"), STB = mat("#d8e8f0", { role: "keep" });
const ANT = mat("#c8dce8", { role: "glow" }), CAPE = mat("#44586c", { flat: true });

export const NAMED_ART = {
  /** 금 간 뿔 숫양 — a stout ram: one great curl of horn split by a crack, the other snapped off round a fence post. */
  meadowram: {
    size: "m", glow: "#ff5a5a",
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 6.2 + lu + bob(p, 0.4);
      legs4(M, p, { ff: f0 + 3.4, bf: f0 - 3.6, w: 2.4, hu: u0 - 1.6, r: 1.1, m: WOOLD, foot: HOOF, st: 2.2, hock: 1 });
      M.G("body");
      M.e([f0, u0, 0], [5.6, 3.6, 3.8], WOOL);
      M.e([f0 - 1, u0 + 1.6, 0], [4, 2, 3], WOOL);
      M.G();
      const hd = [f0 + 5.6, u0 + 1.2 - (p.wind ? 0.6 : 0), 0];
      M.tube([[f0 + 3, u0 + 1, 0], [f0 + 4.4, u0 + 1.6, 0], hd], [2.2, 1.9, 1.7], WOOLD);
      M.e([hd[0] + 1.4, hd[1] - 0.6, 0], [2.6, 1.7, 1.7], WOOLD);
      M.e([hd[0] + 3.6, hd[1] - 1, 0], [0.8, 0.9, 0.9], HOOF);
      M.cone([hd[0] + 2.4, hd[1] - 1.8, 0.6], [hd[0] + 2.6, hd[1] - 3.2 - (p.strike ? 0.8 : 0), 0.6], 0.4, C.TOOTH);
      // the whole horn on the left, a full curl, split by a dark crack
      const hl = bez([hd[0] - 1, hd[1] + 1.2, -1.4], [hd[0] - 3.6, hd[1] + 5, -4.4], [hd[0] + 1.2, hd[1] + 0.2, -5], 6);
      M.tube(hl, [1.5, 0.3], RHORN);
      hl.forEach((q, i) => { if (i > 0 && i < 6 && i % 2) M.dot([q[0], q[1] + 0.4, q[2]], "#3a2018", 1, 1); });
      // the right horn snapped to a stump, a splinter of fence post through it
      M.tube([[hd[0] - 1, hd[1] + 1.2, 1.4], [hd[0] - 1.6, hd[1] + 2.6, 2.4]], [1.4, 1.2], RHORN);
      M.tube([[hd[0] - 2.2, hd[1] + 1.4, 2.2], [hd[0] - 1.2, hd[1] + 6.4, 2.6]], [0.9, 0.9], POST);
      M.dot([hd[0] - 1.4, hd[1] + 2.8, 2.4], "#e8d8b0", 1, 1);
      both((s) => M.eye([hd[0] + 1.4, hd[1] + 0.5, s * 1.3], 1, "#ff9a50"));
      M.tube([[f0 - 5, u0 + 1, 0], [f0 - 6, u0 + 0.4, 0]], [1, 0.6], WOOLD);
    },
  },

  /** 검은 왕관 뿌리짐승 — a hunched mass of roots on four root-legs, a black thorn crown strangling its head. */
  bogcrown: {
    size: "l", glow: "#b06ad8", k: 1.15,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const f0 = lf, u0 = 7.4 + lu + bob(p, 0.5);
      both((s) => {
        for (let i = 0; i < 2; i++) {
          const [sw, up] = gait(p, (i ? 0.5 : 0) + (s < 0 ? 0 : 0.5));
          const top = [f0 + 3 - i * 6.4, u0 - 1, s * 2.6], ft = [f0 + 4.4 - i * 7.6 + sw * 2, up * 1.5, s * 5.4];
          M.tube([top, [(top[0] + ft[0]) / 2, u0 * 0.5, s * 5.2], ft], [1.9, 1.3, 0.8], ROOTD);
        }
      });
      M.G("body");
      M.e([f0, u0, 0], [6.4, 4.2, 4.4], ROOT);
      M.e([f0 - 1, u0 + 2.8, 0], [4.6, 2.4, 3.4], ROOTD);
      M.G();
      both((s) => M.tube([[f0 - 2, u0 + 1, s * 4], [f0 - 4, u0 - 2, s * 5.4], [f0 - 5, u0 - 5, s * 5]], [1.1, 0.4], ROOT));
      [[-2, 4.4, 2.4], [1.5, 4.8, -2], [-4, 3.6, -1.4]].forEach(([d, h, z]) => M.s([f0 + d, u0 + h - 1, z], 1.1, MOSS));
      const hd = [f0 + 6.6, u0 + 1 + (p.wind ? 1 : 0), 0];
      M.tube([[f0 + 3.4, u0 + 1.4, 0], [f0 + 5, u0 + 1.8, 0], hd], [3.2, 2.8, 2.4], ROOT);
      M.e([hd[0] + 1.6, hd[1] - 1, 0], [2.6, 1.8, 2.2], ROOTD);
      M.G("mouth");
      M.e([hd[0] + 3, hd[1] - 1.6, 0], [0.8, p.strike || p.wind ? 1.6 : 1, 1.8], C.MAW);
      M.G();
      // the black crown: a ring of thorns round the head, every other one tipped with a violet spark
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2, y = Math.sin(a), z = Math.cos(a) * 2.4, bx = hd[0] - 0.6, by = hd[1] + 2 + y * 0.5;
        M.cone([bx + y * 0.8, by, z], [bx + y * 0.8 - 0.4, by + (i % 2 ? 3.8 : 2.6), z * 1.1], 0.7, CROWN);
        if (i % 2) M.dot([bx + y * 0.8 - 0.4, by + 3.9, z * 1.1], "#c08aff", 1, 1);
      }
      M.tube([[hd[0] - 0.8, hd[1] + 2, -2.5], [hd[0] + 0.4, hd[1] + 2, 0], [hd[0] - 0.8, hd[1] + 2, 2.5]], 0.6, CROWN);
      both((s) => M.eye([hd[0] + 2.2, hd[1] + 0.2, s * 1.5], 1, "#c07aff"));
    },
  },

  /** 눈먼 문지기 올빼미 — a gaunt grey owl with pale-sealed eyes, a rusted gate ring at its neck, wings held open like doors. */
  hollowowl: {
    size: "m", hover: 9, glow: "#ff7a30",
    draw(M, p) {
      const t = p.walk ? p.ph : p.idle * 0.25 + (p.strike ? 0.5 : 0);
      const [lf, lu] = lunge(p);
      const c = [lf, 7 + lu, 0];
      M.G("body");
      M.e(c, [3.4, 4.4, 3], FEA);
      M.e([c[0] - 0.4, c[1] - 0.4, 0], [2.4, 3, 2.4], FEAL);
      M.G();
      // long dangling legs with hooked talons
      both((s) => {
        const a = [c[0] + 0.2, c[1] - 3.4, s * 1.2], b = [c[0] + 0.8 + (p.strike ? 2 : 0), c[1] - 7.4, s * 1.4];
        M.tube([a, b], [0.7, 0.5], FEAD);
        for (let k = -1; k <= 1; k++) M.cone(b, [b[0] + 1.6, b[1] - 1.4, b[2] + k * 0.9], 0.4, C.NAIL);
      });
      // big square wings, flap-open
      both((s) => {
        const fl = Math.sin(t * Math.PI * 2) * 0.9, up = fl * 3;
        const r0 = [c[0] - 0.4, c[1] + 1.4, s * 2.6], r1 = [c[0] - 1.4, c[1] + 3.2 + up, s * 8.6], r2 = [c[0] - 3.6, c[1] + 1 + up * 1.3, s * 11.6];
        M.tube([r0, r1, r2], [1.3, 0.9, 0.5], FEAD);
        M.e([c[0] - 2.6, c[1] + 1 + up * 0.6, s * 7.4], [3.4, 0.4, 4.4], FEA, [0, 0, -s * up * 6]);
        for (let k = 0; k < 3; k++) M.cone([c[0] - 4 - k * 0.2, c[1] + 0.4 + up, s * (8.4 + k * 1.2)], [c[0] - 6.4, c[1] - 0.8 + up * 1.3, s * (9 + k * 1.3)], 0.5, FEAL);
      });
      // flat round face, eyes sealed shut by pale lids
      const hd = [c[0] + 1.2, c[1] + 5, 0];
      M.e(hd, [2.8, 2.8, 3.4], FEA);
      M.e([hd[0] + 1.4, hd[1], 0], [1.2, 2.4, 3], FEAL);
      both((s) => {
        M.e([hd[0] + 2.4, hd[1] + 0.3, s * 1.5], [0.6, 1, 1], STB);
        M.dot([hd[0] + 3, hd[1] + 0.3, s * 1.5], "#4a4a58", 1, 1);
        M.cone([hd[0] - 0.6, hd[1] + 2.4, s * 2.4], [hd[0] - 1.4, hd[1] + 4.6, s * 3.2], 0.6, FEAD);
      });
      M.cone([hd[0] + 3, hd[1] - 0.6, 0], [hd[0] + 4.4, hd[1] - 2.2 - (p.wind || p.strike ? 0.8 : 0), 0], 0.8, GATE);
      // the rusted gate ring hanging at the neck
      const ring = [];
      for (let a = 0; a <= 6.4; a += 0.8) ring.push([c[0] + 3.2, c[1] + 1.6 + Math.cos(a) * 1.5, Math.sin(a) * 1.5]);
      M.tube(ring, 0.35, GATE);
    },
  },

  /** 얼어붙은 왕릉 파수꾼 — a tall frost-grey stag with a tomb-cloth cape frozen to its back and antlers hung with ice. */
  rootwarden: {
    size: "xl", glow: "#9ad8f0", k: 1.15,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const f0 = lf, u0 = 11 + lu + bob(p, 0.5);
      legs4(M, p, { ff: f0 + 5, bf: f0 - 5, w: 2.6, hu: u0 - 2.4, r: 1.3, m: STD, foot: STB, st: 2.8, hock: 1.6, li: 1.8 });
      M.G("body");
      M.e([f0, u0, 0], [7.4, 4.2, 4], ST);
      M.e([f0 + 3, u0 + 0.6, 0], [4.6, 3.6, 3.4], ST);
      M.G();
      // frozen cape over the shoulders, ending in ice teeth
      M.e([f0 - 1.4, u0 + 3.2, 0], [5.4, 1.2, 4.8], CAPE);
      for (let i = -2; i <= 2; i++) M.cone([f0 - 3 + (i % 2), u0 + 2.6, i * 1.6], [f0 - 3.2 + (i % 2), u0 - 1.4, i * 1.8], 0.7, STB);
      // long neck, a narrow bony head
      const nk = bez([f0 + 6, u0 + 2, 0], [f0 + 9.4, u0 + 5, 0], [f0 + 10.4 + (p.strike ? 2 : 0), u0 + 7.2 - (p.wind ? 1.4 : 0), 0], 4);
      M.tube(nk, [3, 1.9], ST);
      const hd = nk[4];
      M.e([hd[0] + 1.6, hd[1] - 0.6, 0], [2.8, 1.5, 1.5], STD);
      M.G("mouth");
      M.e([hd[0] + 3.4, hd[1] - 1, 0], [0.7, 0.6, 1], C.MAW);
      M.G();
      M.cone([hd[0] + 2, hd[1] - 1.2, 0.5], [hd[0] + 2.4, hd[1] - 2.8, 0.5], 0.4, STB);
      both((s) => {
        M.eye([hd[0] + 1, hd[1] + 0.5, s * 1.2], 1, "#c8f0ff");
        // antlers: a main beam sweeping back with frost-lit tines
        const b0 = [hd[0] - 0.4, hd[1] + 1.2, s * 1.2], b1 = [hd[0] - 2.2, hd[1] + 5, s * 2.8], b2 = [hd[0] - 4.4, hd[1] + 8.4, s * 4.6];
        const mid = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2, (b1[2] + b2[2]) / 2];
        M.tube([b0, b1, b2], [0.9, 0.7, 0.4], STB);
        M.cone(b1, [b1[0] + 2.4, b1[1] + 3.2, b1[2] + s * 1.4], 0.45, ANT);
        M.cone(mid, [mid[0] + 1.8, mid[1] + 3.4, mid[2] + s * 1.4], 0.45, ANT);
        M.cone(b2, [b2[0] - 1, b2[1] + 2.6, b2[2] + s * 0.4], 0.45, ANT);
      });
      M.tube([[f0 - 7, u0 + 1, 0], [f0 - 8.4, u0 + 0.2, 0]], [1.1, 0.5], STD);
    },
  },
};
