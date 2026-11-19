/** Jaemaei, the hollow guardian of the Hanok's ritual hall. */
import { mat, C, both, gait, bob, lunge, teeth } from "./mobart_kit.js";

const FUR = mat("#65647e");
const MANE = mat("#423750");
const EAR = mat("#8d627d");
const BELLY = mat("#aca2af");
const TENTACLE = mat("#6f385e", { wet: true });
const TENDON = mat("#9c447a", { wet: true });
const ROOT = mat("#3b2344");
const IVORY = mat("#d9c3a1", { role: "keep" });
const FRAME = mat("#bfa479", { role: "keep", wet: true });
const GLASS = mat("#2b354e", { role: "keep", wet: true });
const CRACK = mat("#b5a7c7", { role: "keep" });
const FLARE = mat("#eb96d4", { role: "glow" });
const ECHO = mat("#ad7bdd", { role: "glow" });

/** A bent spur with a narrower tip and a dark joint visible where it tears through the fur. */
function spur(M, root, elbow, tip, size) {
  M.s(root, size * 1.19, ROOT);
  M.tube([root, elbow, tip], [size, size * 0.55, 0.29], IVORY);
}

function jaemaei(phase, channel = false) {
  return {
    size: "boss", n: 89, glow: "#d290c8", death: "melt",
    draw(M, p) {
      const [shift, rise] = lunge(p, 1.25);
      const f = shift - (channel ? 1.5 : 0), y = rise + bob(p, 1.28) + p.strike * 0.8;
      const flare = (phase > 1 ? 1.65 : 0) + (channel ? 2.5 : 0);
      const sweep = p.strike * 6 - p.wind * 2.4 + p.recover * 2.1;
      const head = 22 + y - p.wind * 1.25 + (channel ? 1.5 : 0);
      const blink = p.hurt || p.dead;
      const fur = phase > 1 ? MANE : FUR;

      // Asymmetrical crests of split vertebrae and a thick, ragged chinchilla tail.
      const crests = [[-8,17,-5,8],[-6,22,-4,10],[-5,25,-1,8],[-7,21,4,11],[-9,15,6,7]];
      for (const [x, h, s, length] of crests) {
        const side = Math.sign(s);
        M.G("back crest " + s);
        const foot = [x + f, h + y, s], elbow = [x + f - 2, h + y + length * 0.55, s + side * 2.5];
        spur(M, foot, elbow, [x + f - 4.7, h + y + length + flare, s + side * 5.5], 1.65);
        M.cone(elbow, [x + f - 6.1, h + y + length * 0.75, s + side * 7], 0.99, IVORY);
      }
      M.G("tail");
      M.tube([[-6,6,0],[-12.4,7.9,-1],[-17.5,12 + y,0],[-21,11.4 + y + flare * 0.65,4.1],
        [-22.5 + sweep * 0.32,8.2 + y,8.8],[-19 + sweep * 0.45,5.2 + y,11.1]], [3.4,2.9,2.45,1.8,1.2,0.5], MANE);
      M.G("body");
      M.e([-1.8 + f, 12 + y, 0], [9.8,11.6,9.3], fur);
      M.e([3.5 + f, 11.2 + y, 0], [6.7,8.6,7.1], BELLY);
      M.e([-4.5 + f, 17.2 + y, 0], [7.8,7.0,9.0], MANE);

      // Small forepaws and broad hind feet preserve the silhouette under the mutations.
      both((s) => {
        const [step, lift] = gait(p, s < 0 ? 0.5 : 0);
        M.G("hind foot " + s);
        M.e([0.8 + step * 2.4 + f * 0.25,2.6 + lift * 1.4, s * 5.6], [4.2,2.6,3.35], fur);
        for (const toe of [-0.9,0.35,1.55]) M.cone([4 + step * 2.4, 1.65 + lift, s * (5.6 + toe)],
          [5.6 + step * 2.4, 1.2 + lift, s * (5.7 + toe)], 0.58, IVORY);
        M.G("paw " + s);
        const palm = [8.1 + f + p.strike * 2.2, 9.0 + y + p.wind * 2.9, s * 5.8];
        M.tube([[3.4 + f,15.0 + y,s * 6.9],[6.7 + f,12.4 + y,s * 7.7],palm], [2.4,1.6], FUR);
        for (const claw of [-1, 0.2, 1.3]) M.cone([palm[0], palm[1] - 0.7, palm[2] + claw],
          [palm[0] + 1.9, palm[1] - 2.2, palm[2] + claw * 1.28], 0.62, IVORY);
      });

      // Twisted ribs frame the second mouth. They fan out during the stagger cast.
      M.G("hollow chest");
      M.e([9.18 + f,11.4 + y,0], [1.22,4.6 + flare * 0.48,4.0 + flare * 0.32], C.MAW);
      M.s([10.13 + f,10.8 + y,0], channel ? 2.25 : 1.03, channel ? FLARE : ECHO);
      both((s) => {
        for (const [index, height] of [14.9,12.45,9.85,7.55].entries()) {
          const h = height + y + flare * (0.36 - index * 0.17);
          const spread = 1 + flare * 0.21, curl = index > 1 ? 0.87 : 1;
          M.G("rib " + s + "," + index);
          M.tube([[5.8 + f,h + 1.7,s * 6.65],[8.9 + f,h + 0.6,s * 5.3 * curl],
            [10.8 + f,h - 0.15,s * (3.45 + spread * 0.53) * curl],[10.65 + f,h - 0.88,s * (1.58 + spread * 0.72)]],
          [0.99,0.8,0.62,0.25], IVORY);
        }

        // High tendrils coil back when threatened and snap out as the boss attacks.
        const wave = p.walk ? Math.sin(2 * Math.PI * (p.ph + (s < 0 ? 0.5 : 0))) * 2.4 : p.idle * (s < 0 ? -0.8 : 1.1);
        M.G("high tendril " + s);
        const joints = [[-3 + f,15 + y,s * 6],[-6 + f,17.6 + y,s * 10.25],[-6.8 + f + sweep * 0.42,21.5 + y,s * (14.8 + flare * 0.48)],
          [-1.5 + f + sweep + wave,25 + y - p.strike * 4.3 + flare,s * (17.8 + wave * 0.38)],
          [3.2 + f + sweep * 1.3 + wave,20.3 + y - p.strike * 4.6 + flare,s * (19 + flare * 0.6)],
          [1.4 + f + sweep * 1.35,17.2 + y + flare + wave - p.strike * 7.8,s * (16.6 + flare * 0.6)]];
        M.tube(joints, [2.7,2.25,1.8,1.45,0.92,0.46], TENTACLE);
        for (const [x,h,z] of joints.slice(2,5)) {
          M.s([x + 0.78,h - 0.93,z - s * 0.33],0.78,TENDON);
          M.s([x + 1.22,h - 1.01,z - s * 0.25],0.28,ROOT);
        }
        M.G("low tendril " + s);
        M.tube([[-6 + f,7 + y,s * 7.1],[-10.5,4.8,s * 11.6],[-8.6 + wave,2.9,s * 15.4],
          [-3.1 + sweep * 0.55,4.8 + p.wind * 2,s * 17.1],[0.75 + sweep,7.7 + wave,s * (14.85 + flare * 0.43)]],
        [2.2,1.85,1.5,1.1,0.35], MANE);
        M.cone([-8.4 + wave,3.0,s * 15.4],[-10.3 + wave,6.0,s * 17.5],0.88,IVORY);
      });

      M.G("head");
      M.e([3.9 + f,head,0], [7.7,6.55,7.7], FUR);
      M.e([8 + f,head - 2.45,0], [3.95,2.87,5.8], BELLY);
      M.e([11.8 + f,head - 1.6,0], [0.9,0.66,1.2], ROOT);
      const mouth = head - 4.24 - p.strike * 1.2;
      M.e([10.55 + f,mouth,0], [1.65,1.05 + p.strike * 0.8,2.57], C.MAW);
      teeth(M, [11.7 + f,mouth + 0.77,-1.75], [11.7 + f,mouth + 0.77,1.75], 4, 1, 1.46);

      both((s) => {
        const ear = head + 4.93 - p.hurt * 1.5 + p.wind * 0.7;
        M.G("round ear " + s);
        M.e([1.25 + f,ear,s * 6.05], [2.16,4.1,3.1], FUR, [s * 11, -12, -s * 22]);
        M.e([2.8 + f,ear + 0.4,s * 6.3], [0.94,2.63,2.04], EAR, [s * 11, -12, -s * 22]);
        M.G("jaw horn " + s);
        spur(M, [6.75 + f,head - 2.75,s * 5.23], [8.75 + f,head - 3.9,s * 7.2],
          [11.45 + f,head - 2.2,s * 8.17], 1.27);
        M.G("whiskers " + s);
        for (const h of [-0.8,0.14,0.92]) M.tube([[10.1 + f,head - 2.6,s * 3.25],
          [10.35 + f,head - 2.5 + h,s * 5.7],[9.35 + f,head - 2.45 + h * 1.8,s * 8.75]],
        [0.28,0.13], MANE);

        // Two deliberately readable round lenses, joined by a brass bridge.
        const lc = 3.08 * s, cy = head + 0.85 + (s < 0 ? 0.22 : 0), cx = 11.15 + f;
        M.G("lens " + s);
        M.e([cx,cy,lc], [0.59,2.18,2.28], channel ? ECHO : GLASS);
        M.G("round rim " + s);
        const rim = Array.from({ length: 13 }, (_, i) => {
          const a = i * Math.PI / 6;
          return [cx + 0.56, cy + Math.cos(a) * 2.33, lc + Math.sin(a) * 2.47];
        });
        M.tube(rim,0.48,FRAME);
        M.tube([[cx + 0.29,cy + 0.64,lc + s * 2.1],[cx - 2.9,cy + 0.55,s * 6.64],[cx - 4.85,cy + 1.55,s * 7.2]],0.43,FRAME);
        if (!blink) M.eye([cx + 0.6,cy - 0.18,lc + s * 0.28], channel ? 3 : 2, channel ? "#fbbad9" : "#f2a59d", { white: channel ? "#fbd6ed" : "#b6a0b0" });
        if (s < 0) {
          M.G("cracked lens");
          M.tube([[cx + 0.61,cy + 1.77,lc - 0.95],[cx + 0.79,cy + 0.66,lc - 0.51],
            [cx + 0.73,cy + 0.44,lc + 0.5]],0.19,CRACK);
        }
      });
      M.G("spectacle bridge");
      M.tube([[11.65 + f,head + 1.02,-0.8],[11.77 + f,head + 1.72,0],[11.65 + f,head + 0.82,0.8]],0.45,FRAME);
    },
  };
}

export const JAEMAEI_ART = { jaemaei: jaemaei(1), jaemaei_p2: jaemaei(2), jaemaei_ch: jaemaei(2, true) };
