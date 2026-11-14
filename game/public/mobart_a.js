/**
 * Monsters of the meadow and the forest (see mobart.js for how they are drawn).
 * Each entry: size class (s, m, l, xl, boss), how it dies, how high it floats,
 * and draw(M, p) which builds the creature in pose `p`.
 */
import { mat, C, bez, gait, bob, lunge, legs4, teeth, ribs, tentacle, surf, both, rollPt, pitchPt, hand } from "./mobart_kit.js";

// ── meadow: bruised greys and pink meat against the bright grass
const HARE = mat("#b4a8b2"), HARED = mat("#9aa4b8"), SCUT = mat("#f0eaf0");
const FROG = mat("#7a9448"), FROGB = mat("#d0d4a0"), FROGD = mat("#566c34");
const CROW = mat("#3e3654"), CROWD = mat("#2c2640"), BEAK = mat("#c8bea0"), TALON = mat("#8a7a58");
const LAMB = mat("#c24a52", { drip: true, wet: true }), LAMBL = mat("#a83848"), WOOL = mat("#efe6d6"), HOOF = mat("#3a2a30");
// ── forest: hide browns, moss and a bruise-violet that does not belong
const BOAR = mat("#5e4436"), BOARD = mat("#3a2a26"), SNOUT = mat("#9a6a62"), TENT = mat("#8e4a86", { wet: true }), TENTL = mat("#d896c4");
const DEER = mat("#8a6a52"), DEERL = mat("#c8a888"), HAND = mat("#e0c4b0");
const SNAKE = mat("#4e7a44"), SNAKEB = mat("#c8c890"), SNAKED = mat("#2e4a30");
const FOX = mat("#c8642c"), FOX2 = mat("#8a3a2a"), FOXW = mat("#efe2d0"), FOXD = mat("#3a2422");
const MOTH = mat("#b8a68a"), MOTHD = mat("#7a6a58"), MOTHW = mat("#d6c8a8"), FACE = mat("#ecdcc8");

export const BEASTS_A = {
  /** 쌍두 토끼 — two hares sewn flank to flank down a raw seam; only the left head is still alive. */
  twinhare: {
    size: "s",
    draw(M, p) {
      const hop = p.walk ? [0, 1, 0.55, 0.1][Math.round(p.ph * 4)] : 0;
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 4.2 + hop * 2.4 + lu + bob(p, 0.5);
      M.G("body");
      M.e([f0, u0, 0], [4.4, 3.2, 4.4], HARE);
      M.e([f0 - 2.6, u0 - 0.2, 0], [3.2, 3.1, 4.2], HARE);
      both((s) => M.e([f0 - 2.8, u0 - 1, s * 3], [2.4, 2.2, 1.3], HARE));
      M.G();
      // the seam where the two were joined: raw, stitched, bleeding
      M.e([f0 - 0.6, u0 + 2.6, 0], [4.2, 0.9, 0.9], C.RAW);
      M.seam([[f0 + 3, u0 + 2.9, -1.2], [f0 - 4.2, u0 + 2.2, -1.2]]);
      M.seam([[f0 + 3, u0 + 2.9, 1.2], [f0 - 4.2, u0 + 2.2, 1.2]]);
      M.s([f0 - 5.6, u0 + 1.2, 0], 1.3, SCUT);
      // haunches and long feet: both kick at once
      both((s) => {
        M.tube([[f0 - 2.4, u0 - 2.4, s * 3], [f0 - 3.8 - hop * 1.6, 0.9 + hop * 1.2, s * 3], [f0 - 0.6 - hop * 2.4, 0.5 + hop * 1.4, s * 3.1]], [1.1, 0.8, 0.7], HARE);
        M.tube([[f0 + 2.6, u0 - 1.6, s * 2], [f0 + 3.2 + hop * 1.4, 0.5 + hop * 0.6, s * 2.1]], [0.9, 0.6], HARE);
      });
      // the live head, on the left, low and forward
      const hf = f0 + 4.6 + (p.strike ? 1 : 0), hu = u0 + 2.6 - (p.wind ? 1.2 : 0);
      const H = [hf, hu, -2.8], HR = [2.5, 2.2, 2.1];
      M.e(H, HR, HARE);
      M.e([hf + 2, hu - 0.8, -2.8], [1.5, 1.2, 1.3], HARE);
      both((s) => M.e([hf - 0.8, hu + 3.6 - (p.hurt ? 1 : 0), -2.8 + s * 0.9], [0.8, 3.2, 0.55], HARE, [0, -14 - (p.wind ? 30 : 0), s * 10]));
      M.eye(surf(H, HR, [0.55, 0.25, -0.8]), 3, "#ff2a2a");
      M.eye(surf(H, HR, [0.6, 0.25, 0.75]), 1, "#e02838");
      const mz = surf([hf + 2, hu - 0.8, -2.8], [1.5, 1.2, 1.3], [0.7, -0.6, 0]);
      M.dot(mz, "#f4eedc", 1, 2);
      if (!p.dead) M.dot([mz[0], mz[1] - 2, mz[2]], "#d82838", 1, p.strike ? 2 : 1);
      // the dead one, lolling on the right with its eye sewn shut and its tongue out
      const D = [hf - 0.8, hu - 1.8 + (p.walk ? hop * 0.8 : 0), 3.4], DR = [2.3, 2, 1.9];
      M.e(D, DR, HARED, [0, -30, 28]);
      M.e([hf + 1.2, hu - 3, 3.1], [1.4, 1.1, 1.2], HARED, [0, -30, 0]);
      M.tube(bez([hf - 1.2, hu, 3.4], [hf - 3.6, hu + 1.2, 5.2], [hf - 4.6, hu - 2.6, 5.4]), [0.8, 0.5], HARED);
      M.tube(bez([hf - 1.6, hu - 0.4, 1.8], [hf - 4.2, hu + 0.6, 2.2], [hf - 5.4, hu - 1.8, 3.4]), [0.8, 0.5], HARED);
      M.eye(surf(D, DR, [0.45, 0.1, 0.85]), 2, "#000", { shut: true });
      M.seam([surf(D, DR, [0.3, 0.45, 0.8]), surf(D, DR, [0.62, -0.2, 0.75])], "#2a1a22");
      M.tube([[hf + 1.8, hu - 3.6, 3.2], [hf + 2.2, hu - 4.6, 3.3]], [0.6, 0.45], C.TONGUE);
    },
  },

  /** 창자 개구리 — a frog swollen tight, its own guts hanging out where a tongue should be. */
  gutfrog: {
    size: "s",
    draw(M, p) {
      const hop = p.walk ? [0, 1, 0.5, 0][Math.round(p.ph * 4)] : 0;
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 4.6 + hop * 2 + lu + bob(p, 0.4), sw = p.idle ? 0.15 : 0;
      M.G("body");
      M.e([f0, u0, 0], [5 + sw, 4.2 + sw, 5.4 + sw], FROG, [0, 14, 0]);
      M.e([f0 + 1.2, u0 - 1.2, 0], [4, 3.2, 4.6], FROGB, [0, 14, 0]);
      M.G();
      // veins under the stretched belly, warts on the back
      for (const [a, b, c] of [[1.5, -1.4, -2.6], [2.6, -2, 2.2], [0.5, -2.6, 0.8], [3.4, -0.6, -1]]) M.dot([f0 + a, u0 + b, c + (c > 0 ? 2 : -2)], "#8a5a9a");
      for (const [a, b, c] of [[-2, 3.4, -2], [-0.4, 4, 1.6], [-3, 2.6, 2.6], [1, 3.8, -0.6]]) M.dot([f0 + a, u0 + b, c], "#4e6230");
      // eyes pushed out of the skull on stalks
      both((s) => {
        const e = [f0 + 2.6, u0 + 4 + (p.hurt ? 0.6 : 0), s * 2.3];
        M.tube([[f0 + 2, u0 + 2.6, s * 1.8], e], 0.9, FROG);
        M.s(e, 1.6, C.EYEW);
        M.eye([e[0] + 1, e[1] + 0.6, e[2] + s * 0.3], 2, s < 0 ? "#e02838" : "#c8a020");
      });
      // folded hind legs and thin arms
      both((s) => {
        M.e([f0 - 2.6, u0 - 2.4 + hop, s * 4.2], [3, 1.8, 1.4], FROG, [0, -10, 0]);
        M.tube([[f0 - 1, 1.2 + hop, s * 4.6], [f0 + 1.6 - hop * 2, 0.4, s * 5], [f0 + 3, 0.4, s * 5.4]], [1.1, 0.8, 0.9], FROGD);
        M.tube([[f0 + 3, u0 - 2, s * 3.2], [f0 + 4.2, 0.5 + hop * 0.6, s * 3.6]], [0.8, 0.6], FROG);
      });
      // the mouth, and what comes out of it
      const m0 = [f0 + 5.1, u0 + 0.2, 0];
      M.e(m0, [0.7, 0.8, 3.4], C.MAW);
      teeth(M, [m0[0] + 0.3, m0[1] + 0.7, -2.4], [m0[0] + 0.3, m0[1] + 0.7, 2.4], 4, 1, 0.9);
      const swing = p.walk ? Math.sin(p.ph * Math.PI * 2) : p.idle ? 0.4 : 0, out = p.strike ? 3 : 0;
      M.tube(bez(m0, [m0[0] + 2 + out, m0[1] - 2, -1 + swing], [m0[0] + 1 + out * 1.4, 0.6, -2.6 + swing], 8), 0.9, C.GUT);
      M.tube(bez([m0[0], m0[1], 0.6], [m0[0] + 3 + out, m0[1] - 3, 1.6 - swing], [m0[0] + 3.6 + out * 1.2, 0.5, 0.2 - swing], 8), 0.8, C.GUTD);
      M.s([m0[0] + 3.6 + out * 1.2, 0.6, 0.2 - swing], 0.9, C.GORE);
    },
  },

  /** 눈알 까마귀 — a crow that grew an eye wherever a feather fell out. */
  eyecrow: {
    size: "s", hover: 10, glow: "#ff6a50",
    draw(M, p) {
      const flap = p.dead ? 0.2 : [0.9, 0.2, -0.7, 0.1][p.walk ? Math.round(p.ph * 4) : p.idle ? 1 : 0] + (p.strike ? -0.4 : 0);
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 6 + lu - flap * 0.6;
      M.G("body");
      M.e([f0, u0, 0], [4.2, 2.8, 2.6], CROW, [0, p.strike ? -18 : 6, 0]);
      M.e([f0 - 4.4, u0 + 0.4, 0], [2.8, 0.6, 1.8], CROWD, [0, 14, 0]);
      M.G();
      const H = [f0 + 3.6, u0 + 2 - (p.strike ? 1.4 : 0), 0], HR = [2, 1.9, 1.8];
      M.e(H, HR, CROW);
      M.cone([H[0] + 1.4, H[1] - 0.3, 0], [H[0] + 4.4, H[1] - 1.2 - (p.strike ? 1 : 0), 0], 0.9, BEAK);
      M.dot([H[0] + 3.4, H[1] - 1.8, 0], "#d82838", 1, 2);
      both((s) => M.eye(surf(H, HR, [0.4, 0.3, s * 0.85]), 2, "#ff3030"));
      // wings: the bone, then the fan of feathers, each one with an eye where a quill was
      both((s) => {
        const a = flap * 55 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        const root = [f0 + 0.4, u0 + 1.2, s * 1.6];
        for (let i = 0; i < 4; i++) {
          const L = 3.2 + i * 1.3, back = -i * 0.9;
          M.e([root[0] + back, root[1] + sa * L, root[2] + s * ca * L], [1.8 - i * 0.1, 0.45, 1.6 + i * 0.25], i % 2 ? CROWD : CROW, [0, 0, -s * flap * 55]);
        }
        const tip = [root[0] - 1.6, root[1] + sa * 6.5, root[2] + s * ca * 6.5];
        M.eye([tip[0] + 1, tip[1] + 0.5, tip[2] - s * 2], 2, "#e02838");
        M.eye([tip[0] - 1.6, tip[1] + 0.5, tip[2]], 1, "#ff7a30");
      });
      M.eye([f0 + 1, u0 + 2.6, -1.2], 2, "#ff3030");
      M.eye([f0 - 1.6, u0 + 2.4, 1], 2, "#ff7a30");
      M.eye([f0 - 0.4, u0 - 1, -2.4], 1, "#e02838");
      // talons, hanging
      both((s) => M.tube([[f0, u0 - 2.2, s * 1], [f0 + 0.4, u0 - 4.4, s * 1.2], [f0 + 1.4, u0 - 4.8, s * 1.2]], [0.5, 0.45, 0.4], TALON));
    },
  },

  /** 뒤집힌 양 — a lamb turned inside out: ribs worn outside, wool bursting from where the guts were, and its face is a mouth. */
  lambmaw: {
    size: "m", glow: "#ff5a5a",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.4);
      const f0 = lf, u0 = 7 + lu + bob(p, 0.6);
      M.G("body");
      M.e([f0, u0, 0], [6.4, 4.6, 4.6], LAMB);
      M.e([f0 + 3.4, u0 + 0.8, 0], [3.6, 4, 4], LAMB);
      M.G();
      ribs(M, f0 - 3.4, f0 + 3.4, u0 + 0.4, 4.9, 5, C.BONE, 0.9);
      // wool where the insides used to be, spilling out of the split belly
      for (const [a, b, c, r] of [[-1.6, -3.6, -1.2, 1.7], [1, -3.8, 1, 1.6], [-3.6, -3, 0.6, 1.4], [0.2, 4.2, 0.4, 1.3]]) M.s([f0 + a, u0 + b, c], r, WOOL);
      M.e([f0, u0 - 2.6, 0], [4.6, 1.2, 2.6], C.CLOT);
      legs4(M, p, { ff: f0 + 3.6, bf: f0 - 3.8, w: 2.6, hu: u0 - 2, r: 1.15, m: LAMBL, foot: HOOF, st: 2.2, hock: 1 });
      // the head: a lamb's skull split from brow to chin into a mouth
      const hf = f0 + 7 + (p.strike ? 1.2 : 0), hu = u0 + 2.6 - (p.wind ? 2.2 : 0);
      const H = [hf, hu, 0], HR = [2.6, 2.8, 2.4];
      M.e(H, HR, C.BONE, [0, p.wind ? -30 : -10, 0]);
      both((s) => M.tube(bez([hf - 1, hu + 1.8, s * 1.6], [hf - 2.6, hu + 3.8, s * 3.6], [hf - 0.6, hu + 2.2, s * 4.2], 6), [1, 0.5], C.HORN));
      const open = p.strike ? 1.6 : p.wind ? 1 : 0.5;
      M.e([hf + 2, hu - 0.2, 0], [0.8, 2.4, 0.6 + open], C.MAW);
      teeth(M, [hf + 2.4, hu + 1.8, -0.6 - open], [hf + 2.4, hu - 2, -0.6 - open], 4, 0, 0.1);
      both((s) => { for (let i = 0; i < 4; i++) M.cone([hf + 2.3, hu + 1.6 - i * 1.2, s * (0.7 + open)], [hf + 2.6, hu + 1.6 - i * 1.2, s * (0.1 + open * 0.3)], 0.45, C.TOOTH); });
      both((s) => M.eye(surf(H, HR, [0.3, 0.5, s * 0.8]), 2, "#ff2a2a"));
      M.dot([hf + 2.4, hu - 2.8, 0.4], "#d82838", 1, 2);
      M.s([f0 - 6.4, u0 + 1.4, 0], 1.2, LAMB);
    },
  },

  // ── forest
  /** 반쪽 멧돼지 — the front half of a boar, still charging; the back half is a nest of tentacles. */
  splitboar: {
    size: "m",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.4);
      const f0 = lf, u0 = 6.4 + lu + bob(p, 0.6) - (p.wind ? 0.6 : 0);
      M.G("body");
      M.e([f0 + 1, u0, 0], [5, 4.6, 4.4], BOAR);
      M.e([f0 + 3.2, u0 + 1.2, 0], [3.6, 4.2, 4], BOAR);
      M.G();
      // the cut: raw meat and a spine end where the rest of it was
      M.e([f0 - 3.6, u0, 0], [1.2, 4, 3.8], C.RAW);
      M.s([f0 - 4.4, u0 + 2, 0], 1, C.BONE);
      M.s([f0 - 4.6, u0 - 1, 1.6], 0.8, C.BONE);
      // a ridge of bristles down the neck
      for (let i = 0; i < 5; i++) M.cone([f0 + 4 - i * 1.6, u0 + 4.2 - i * 0.3, 0], [f0 + 3.4 - i * 1.6, u0 + 6.4 - i * 0.2, 0], 0.9, BOARD);
      // the head, low and armed
      const hf = f0 + 6.6 + (p.strike ? 1 : 0), hu = u0 - 0.2 - (p.wind ? 1.6 : 0);
      const H = [hf, hu, 0], HR = [3, 2.8, 2.8];
      M.e(H, HR, BOAR, [0, -16, 0]);
      M.e([hf + 3, hu - 1.4, 0], [1.4, 1.6, 1.8], SNOUT, [0, -10, 0]);
      M.dot(surf([hf + 3, hu - 1.4, 0], [1.4, 1.6, 1.8], [1, 0, -0.5]), "#2a1a22");
      M.dot(surf([hf + 3, hu - 1.4, 0], [1.4, 1.6, 1.8], [1, 0, 0.5]), "#2a1a22");
      both((s) => M.tube(bez([hf + 2.2, hu - 2, s * 1.8], [hf + 3.8, hu - 2.2, s * 3], [hf + 3.6, hu + 0.4, s * 3.2], 5), [0.8, 0.35], C.BONE));
      both((s) => M.eye(surf(H, HR, [0.45, 0.45, s * 0.75]), 2, "#ff2a2a"));
      both((s) => M.e([hf - 1.6, hu + 2.6, s * 2], [1, 1.6, 0.5], BOARD, [0, -30, s * 20]));
      // front legs; the back half walks on tentacles
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0 : 0.5);
        const a = p.wind ? 0.6 : p.strike ? 1 : p.dead ? 1.5 : sw;
        M.tube([[f0 + 3.4, u0 - 2.4, s * 2.6], [f0 + 3.8 + a, u0 * 0.45 + up, s * 2.6], [f0 + 3.4 + a * 2, up * 1.4, s * 2.7]], [1.3, 1, 0.8], BOAR);
        M.s([f0 + 3.6 + a * 2, up * 1.4 + 0.5, s * 2.7], 0.8, BOARD);
      });
      for (let i = 0; i < 5; i++) {
        const s = (i - 2) * 1.6, ph = (p.walk ? p.ph : p.idle * 0.1) + i * 0.23;
        const end = tentacle(M, [f0 - 4, u0 - 1 + (i % 2), s], [-0.8, -0.55, s * 0.12], 7.4 - Math.abs(i - 2) * 0.6, 1.1, TENT, ph, 1.1);
        M.s(end, 0.6, TENTL);
      }
    },
  },
  /** 갈비뼈 사슴 — a stag whose chest hangs open on a still-beating heart; its antlers end in hands. */
  ribdeer: {
    size: "m", glow: "#ff5a5a",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const rear = p.wind ? 1 : 0, f0 = lf, u0 = 9.4 + lu + bob(p, 0.6) + rear * 1.5;
      const pit = rear ? 22 : p.strike ? -10 : 0;
      const P = (c) => pitchPt(c, pit, [f0 - 3, u0, 0]);
      M.G("body");
      M.e(P([f0, u0, 0]), [5.6, 3.2, 3], DEER, [0, pit, 0]);
      M.e(P([f0 + 3.6, u0 + 0.6, 0]), [2.8, 3.4, 3], DEER, [0, pit, 0]);
      M.G();
      M.e(P([f0 - 0.6, u0 + 2.6, 0]), [4.6, 0.8, 1.6], DEERL, [0, pit, 0]);
      // the chest, hanging open: the ribs pulled apart around the cavity and the heart
      M.e(P([f0 + 2.6, u0 - 1.6, 0]), [2.4, 2, 2.2], C.CLOT, [0, pit, 0]);
      both((s) => { for (let i = 0; i < 3; i++) M.tube([P([f0 + 1 + i * 1.3, u0 + 1.4, s * 2.6]), P([f0 + 1.4 + i * 1.3, u0 - 1.8, s * 3.2]), P([f0 + 1.6 + i * 1.3, u0 - 3.6, s * 2.6 + s * (p.strike ? 1 : 0.4)])], 0.42, C.BONE); });
      M.s(P([f0 + 3, u0 - 1.8, 0]), p.idle || p.strike ? 1.5 : 1.2, C.GORE);
      // legs: stilts with a hock behind; rearing lifts the front pair
      both((s) => {
        for (const [ff, off, front] of [[f0 + 3.4, s < 0 ? 0 : 0.5, 1], [f0 - 3.8, s < 0 ? 0.5 : 0, 0]]) {
          let [sw, up] = gait(p, off);
          if (p.strike) sw = front ? 1 : -0.3;
          const top = P([ff, u0 - 1.6, s * 1.8]);
          if (front && rear) { M.tube([top, [ff + 1.6, top[1] - 2.6, s * 1.8], [ff + 2.6, top[1] - 1.2, s * 1.9]], [0.9, 0.7, 0.6], DEER); M.s([ff + 2.8, top[1] - 1.6, s * 1.9], 0.6, HOOF); continue; }
          const ft = p.dead ? [ff + (front ? 2 : -2), 2, s * 2.4] : [ff + sw * 2.4, up * 1.6, s * 1.9];
          const kn = front ? [(top[0] + ft[0]) / 2 + 0.4, top[1] * 0.5, s * 1.8] : [(top[0] + ft[0]) / 2 - 1.6, top[1] * 0.45, s * 1.8];
          M.tube([top, kn, ft], [1, 0.62, 0.52], DEER);
          M.s([ft[0] + 0.2, ft[1] + 0.4, ft[2]], 0.62, HOOF);
        }
      });
      M.tube([P([f0 - 5.4, u0 + 1.2, 0]), P([f0 - 6.6, u0 + 2.4, 0])], [0.9, 0.5], DEERL);
      // the neck and the head
      const nb = P([f0 + 4.4, u0 + 2.4, 0]), hd = P([f0 + 7.2 + (p.strike ? 1.4 : 0), u0 + 7.4 - (p.strike ? 3 : 0) + (p.hurt ? 0.6 : 0), 0]);
      M.tube([nb, [nb[0] + 1.6, (nb[1] + hd[1]) / 2, 0], [hd[0] - 1, hd[1] - 0.6, 0]], [1.6, 1.2], DEER);
      const HR = [2, 1.8, 1.6];
      M.e(hd, HR, DEER, [0, -20, 0]);
      M.e([hd[0] + 2.2, hd[1] - 1.2, 0], [1.6, 1, 1], DEER, [0, -24, 0]);
      M.dot([hd[0] + 3.4, hd[1] - 1.6, 0], "#2a1a22");
      both((s) => { M.eye(surf(hd, HR, [0.3, 0.2, s * 0.9]), 2, "#ff2a2a"); M.e([hd[0] - 1, hd[1] + 1.4, s * 1.8], [0.6, 1.4, 0.4], DEER, [0, -40, s * 40]); });
      // antlers, branching, every tine ending in a small pale hand
      both((s) => {
        const a0 = [hd[0] - 0.4, hd[1] + 1.4, s * 0.9], a1 = [hd[0] - 1, hd[1] + 4.4, s * 2.6], a2 = [hd[0] - 2.4, hd[1] + 7, s * 3.4];
        M.tube([a0, a1, a2], [0.6, 0.45], C.HORN);
        const b1 = [hd[0] + 1.2, hd[1] + 6.4, s * 2.4];
        M.tube([a1, b1], 0.4, C.HORN);
        const grab = p.wind ? 1.2 : 0;
        hand(M, a2, [-0.4, 1, s * 0.6], HAND, 4, 1.5 + grab * 0.4);
        hand(M, b1, [0.8, 1, s * 0.3], HAND, 3, 1.3);
      });
    },
  },

  /** 세 머리 뱀 — one coil, three necks, and the heads do not agree: one spits, one bites, one only watches you. */
  hydrasnake: {
    size: "m", k: 1.25,
    draw(M, p) {
      const ph = p.walk ? p.ph : p.idle * 0.12;
      const pts = [];
      for (let a = 0; a <= 1; a += 0.05) {
        const t = a * Math.PI * 2.3 + ph * 2, r = 5.4 - a * 2.4;
        pts.push([Math.cos(t) * r * 0.9 - 1, 1.2 + a * 2.4, Math.sin(t) * r]);
      }
      M.G("coil");
      M.tube(pts, [1.9, 1.5], SNAKE);
      M.G();
      for (let i = 2; i < pts.length; i += 3) M.dot([pts[i][0], pts[i][1] + 1.6, pts[i][2]], "#2e4a30", 1, 1);
      const top = pts[pts.length - 1];
      const heads = [[-2.6, 9.4, 0], [0.6, 12, 0.4], [-0.6, 8.6, 1]];
      [[-3, 0.5, -34], [0, 1, 0], [3, 0.7, 40]].forEach(([s, h, yaw], i) => {
        const back = p.wind ? -2 : p.strike ? 2.4 : 0, sway = Math.sin((ph + i * 0.3) * Math.PI * 2) * 0.8;
        const hd = [2.2 + back + (i === 1 ? 1 : 0), 7 + h * 3.6 + (p.hurt ? 1 : 0), s * 1.5 + sway];
        const mid = [top[0] + 0.6 + back * 0.3, top[1] + h * 3 + 1, s * 0.6];
        M.tube(bez([top[0], top[1], s * 0.4], mid, [hd[0] - 1.2, hd[1] - 0.6, hd[2]], 7), [1.3, 1], SNAKE);
        const r = i === 1 ? 1 : 0.85, HR = [2 * r, 1.3 * r, 1.4 * r];
        M.e(hd, HR, SNAKE, [yaw, p.strike ? -10 : 8, 0]);
        M.e([hd[0] + 0.4, hd[1] - 0.7 * r, hd[2]], [1.8 * r, 0.5, 1.1 * r], SNAKEB, [yaw, 0, 0]);
        if (p.strike || (i === 0 && p.wind)) { M.e([hd[0] + 1.6 * r, hd[1] - 0.6, hd[2]], [0.6, 0.9, 0.9], C.MAW, [yaw, 0, 0]); M.cone([hd[0] + 1.8, hd[1] - 0.1, hd[2] - 0.5], [hd[0] + 2, hd[1] - 1.1, hd[2] - 0.5], 0.4, C.TOOTH); }
        if (i === 2) M.eye(surf(hd, HR, [0.2, 0.8, 0.5]), 2, "#e8c020");
        else both((ss) => M.eye(surf(hd, HR, [0.45, 0.55, ss * 0.7]), 1, i ? "#ff3030" : "#e8c020"));
        M.tube([[hd[0] + 1.9 * r, hd[1] - 0.6, hd[2]], [hd[0] + 3 * r, hd[1] - 1 - (p.idle ? 0.4 : 0), hd[2] + 0.4]], 0.32, C.TONGUE);
      });
    },
  },

  /** 꼬인 여우 — two foxes wrung together like wet cloth: one runs on the ground, the other on its back, running at the sky. */
  foxtwine: {
    size: "m",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.3);
      const f0 = lf, u0 = 5.4 + lu + bob(p, 0.7);
      M.G("body");
      M.e([f0, u0, 0], [4.8, 2.4, 2.4], FOX);
      M.e([f0 + 0.4, u0 - 1, 0], [3.8, 1.4, 1.8], FOXW);
      M.G();
      legs4(M, p, { ff: f0 + 3.2, bf: f0 - 3.2, w: 1.4, hu: u0 - 1.2, r: 0.75, m: FOX, foot: FOXD, st: 2.6, li: 1.6 });
      // the second fox, belly up on the first's back, wrung round it
      const u1 = u0 + 3.6;
      M.G("body2");
      M.e([f0 - 0.4, u1, 0], [4.4, 2.2, 2.2], FOX2, [0, 0, 180]);
      M.e([f0 - 0.4, u1 + 1, 0], [3.4, 1.3, 1.6], FOXW);
      M.G();
      for (let i = 0; i < 4; i++) { const f = f0 - 2.6 + i * 1.6; M.tube([[f, u0 + 1.4, -2.2 + i * 0.4], [f + 0.8, u0 + 2.8, 0], [f + 1.4, u0 + 3.6, 2.2 - i * 0.4]], 0.6, C.MEAT); }
      both((s) => {
        for (const [ff, off] of [[f0 + 2.4, s < 0 ? 0.25 : 0.75], [f0 - 3, s < 0 ? 0.75 : 0.25]]) {
          const [sw, up] = gait(p, off);
          const k = p.walk ? sw : p.idle ? 0.3 : p.hurt ? -1 : 0;
          M.tube([[ff, u1 + 1.6, s * 1.2], [ff - k * 1.4, u1 + 3.4 + up, s * 1.4], [ff - k * 2.4 + 0.6, u1 + 5 + up * 0.6, s * 1.6]], [0.7, 0.5, 0.45], FOX2);
          M.s([ff - k * 2.4 + 0.6, u1 + 5.4 + up * 0.6, s * 1.6], 0.5, FOXD);
        }
      });
      // the walking head, sharp and forward
      const hf = f0 + 5.6 + (p.strike ? 1.6 : 0), hu = u0 + 1.6 - (p.wind ? 1.4 : 0);
      const H = [hf, hu, 0], HR = [1.8, 1.6, 1.7];
      M.e(H, HR, FOX);
      M.e([hf + 2, hu - 0.6, 0], [1.6, 0.8, 0.9], FOX, [0, -6, 0]);
      M.e([hf + 1.6, hu - 1.1, 0], [1.4, 0.4, 0.8], FOXW);
      M.dot([hf + 3.5, hu - 0.4, 0], "#1a1216");
      if (p.strike) teeth(M, [hf + 2.6, hu - 1, -0.5], [hf + 2.6, hu - 1, 0.5], 2, 1, 0.8);
      both((s) => { M.cone([hf - 0.6, hu + 1.2, s * 1], [hf - 0.8, hu + 3.6, s * 1.4], 0.9, FOX); M.eye(surf(H, HR, [0.6, 0.3, s * 0.7]), 1, "#f0d020"); });
      // the other head hangs off the back end, upside down, mouth open on a scream
      const bh = [f0 - 5.4, u1 + 0.4, 0];
      M.e(bh, [1.7, 1.5, 1.6], FOX2, [0, 0, 180]);
      M.e([bh[0] - 2, bh[1] + 0.4, 0], [1.5, 0.7, 0.8], FOX2);
      M.e([bh[0] - 2.4, bh[1] - 0.4, 0], [0.7, 0.6, 0.6], C.MAW);
      both((s) => { M.cone([bh[0] + 0.4, bh[1] - 1, s * 1], [bh[0] + 0.6, bh[1] - 3, s * 1.3], 0.8, FOX2); M.eye(surf(bh, [1.7, 1.5, 1.6], [-0.4, -0.2, s * 0.8]), 1, "#f0d020"); });
      // two brushes, knotted
      M.tube(bez([f0 - 4.6, u0 + 0.6, 0], [f0 - 7.6, u0 + 1, -2], [f0 - 7, u0 + 4, 1.6], 7), [1.2, 1.5], FOX);
      M.s([f0 - 7, u0 + 4.4, 1.6], 1.2, FOXW);
    },
  },

  /** 인면 나방 — a moth with a person's face, and two more on its wings that blink when it does. */
  mothface: {
    size: "m", hover: 9, glow: "#f4efe0",
    draw(M, p) {
      const flap = p.dead ? 0 : [0.6, -0.1, -0.6, 0.1][p.walk ? Math.round(p.ph * 4) : p.idle ? 1 : 0] + (p.wind ? 0.8 : 0) + (p.strike ? -0.8 : 0);
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 6 + lu;
      M.G("body");
      M.s([f0 + 1.2, u0 + 0.4, 0], 2.2, MOTHW);
      M.e([f0 - 2.4, u0 - 0.6, 0], [3.2, 2, 2], MOTH, [0, p.strike ? 30 : 10, 0]);
      M.G();
      for (let i = 0; i < 3; i++) M.dot([f0 - 1.6 - i * 1.2, u0 + 1.3 - i * 0.3, 0], "#5a4a3a");
      both((s) => {
        const deg = -s * flap * 50;
        // forewing and hindwing, each a pale sheet; the forewing carries an eye that stares
        const root = [f0 + 0.6, u0 + 1, s * 1.4];
        const W = (df, d, r, m) => { const c = rollPt([root[0] + df, root[1], root[2] + s * d], deg, root); M.e(c, r, m, [0, 0, deg]); return c; };
        const c1 = W(0.8, 5.4, [3.2, 0.4, 5.2], MOTH);
        W(-2.6, 4.2, [2.6, 0.38, 4], MOTHD);
        const e = rollPt([root[0] + 1.2, root[1] + 0.5, root[2] + s * 5.6], deg, root);
        M.eye(e, 3, "#2a1a22");
        M.dot(rollPt([root[0] - 0.8, root[1] + 0.5, root[2] + s * 6.4], deg, root), "#5a4a3a", 2, 1);
        M.dot(rollPt([root[0] + 2.8, root[1] + 0.5, root[2] + s * 7.6], deg, root), "#efe2c8", 1, 1);
        M.tube(bez([f0 + 2.6, u0 + 2, s * 0.6], [f0 + 4.6, u0 + 4.6, s * 1.2], [f0 + 4, u0 + 6, s * 2.6], 5), 0.32, MOTHD);
      });
      // the face: smooth, human, sad, too big for a moth
      const H = [f0 + 3.2 + (p.strike ? 0.8 : 0), u0 + 0.6, 0], HR = [1.6, 2, 1.9];
      M.e(H, HR, FACE);
      both((s) => M.eye(surf(H, HR, [0.75, 0.25, s * 0.55]), 2, "#3a2a40", { white: "#f6f0e6" }));
      M.dot(surf(H, HR, [0.9, -0.15, 0]), "#c8a090");
      M.dot(surf(H, HR, [0.85, -0.5, -0.2]), "#8a3a4a", 2, p.strike ? 2 : 1);
      both((s) => M.tube([[f0, u0 - 1.4, s * 1], [f0 + 0.6, u0 - 3.4, s * 1.4], [f0 + 1.6, u0 - 3.8, s * 1.4]], 0.34, MOTHD));
    },
  },
};
