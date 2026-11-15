/**
 * Bosses-2 adds (docs/design/bosses-2.md): 혈루 결정 전갈 `bloodshard` (bloodhorn),
 * 밤장막 흡혈박쥐 `nightbat` (cloakbat), 먹장어 머리 `hagfishhead` (bloomwhale).
 * Built with the same near-black hide, bone-white mask/ribs, and single glowing accent
 * palette as game/public/mobart_f.js, keeping each sprite within 16 colours including outline.
 */
import { mat, bez, gait, bob, lunge, surf, both, rollPt } from "./mobart_kit.js";

const MASK = mat("#e8dfcf", { role: "keep" });

// F1 add — bloodhorn palette (near-black hide, bone skull plate, crimson blood-crystal shards)
const HIDE = mat("#1a1012"), HIDED = mat("#120a0c", { flat: true });
const SEAM = mat("#ff3b3b", { role: "glow" });

// R1 add — cloakbat palette (near-black cloak flesh, bone skull/ribs, violet-magenta glow)
const CLK = mat("#120a16"), CLKD = mat("#0a060e", { flat: true });
const VIO = mat("#d43cff", { role: "glow" });

// R2 add — bloomwhale palette (near-black abyssal flesh, bone whale-jaw mask, ice-cyan shards)
const WH = mat("#0c1016"), WHD = mat("#070a0e", { flat: true });
const CYN = mat("#7ff6ff", { role: "glow" });

export const BOSSES2_ADD_ART = {
  /** 혈루 결정 전갈 — near-black plated scorpion with a bone skull face, glowing red seams, and warm blood-tear crystal stinger. */
  bloodshard: {
    size: "m", k: 1.12, glow: "#ff3b3b",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.1), rear = p.wind ? 1 : 0, hit = p.strike ? 1 : 0;
      const f0 = lf * 0.8, u0 = 3.2 + lu * 0.5 + bob(p, 0.4);
      // 4 pairs of jointed arachnid legs with bone-white claw tips
      both((s) => {
        for (let i = 0; i < 4; i++) {
          const [sw, up] = gait(p, (i % 2 ? 0.5 : 0) + (s < 0 ? 0 : 0.25));
          const hip = [f0 + 3.2 - i * 2.1, u0 - 0.2, s * 2.4];
          const knee = [f0 + 3.8 - i * 2.2 + sw * 0.7, u0 + 2.2 + up * 0.8 + (rear && i === 0 ? 1.2 : 0), s * 5.4];
          const ft = [f0 + 4.2 - i * 2.3 + sw * 1.3, up * 1.3 + (rear && i === 0 ? 1.4 : 0), s * 7.4];
          M.tube([hip, knee, ft], [0.85, 0.65, 0.45], i % 2 ? HIDED : HIDE);
          M.cone(ft, [ft[0] + 0.9, 0.2, ft[2] + s * 0.6], 0.45, MASK);
        }
      });
      // low, wide armoured carapace and segmented abdomen
      M.G("body");
      M.e([f0 - 0.4, u0 + 0.2, 0], [6.4, 2.8, 4.3], HIDE);
      M.e([f0 + 3.8, u0 - 0.2, 0], [3.2, 2.2, 3.4], HIDED);
      M.G();
      // glowing blood-seams cracked across the dorsal plates
      for (let i = 0; i < 3; i++) {
        const f = f0 + 2.8 - i * 2.5;
        both((s) => M.tube([[f, u0 + 2.6, s * 0.8], [f - 0.6, u0 + 2.1, s * 2.7], [f - 1.1, u0 + 0.6, s * 4.0]], 0.42, SEAM));
        M.dot([f, u0 + 2.9, 0], "#ffb0a0");
      }
      // jagged blood-tear crystal shards erupting through the back
      for (const [df, h, ds] of [[-3.8, 4.0, -1.1], [-1.8, 5.4, 0.9], [0.2, 4.6, -0.8], [2.0, 3.6, 1.0]]) {
        M.cone([f0 + df, u0 + 2.0, ds * 0.6], [f0 + df - 1.2, u0 + 2.2 + h + rear * 0.8, ds * 1.5], 1.1, SEAM);
      }
      // bone-white skull faceplate with horn-spurs, split mandibles, and weeping red slit-eyes
      const H = [f0 + 5.8 + (hit ? 1.0 : 0), u0 + 0.5 + (rear ? 0.8 : 0), 0];
      M.e(H, [2.4, 1.7, 2.8], MASK);
      both((s) => {
        M.cone([H[0] - 0.8, H[1] + 1.1, s * 1.8], [H[0] - 2.6, H[1] + 3.0, s * 3.2], 0.65, MASK);
        M.cone([H[0] + 1.6, H[1] - 0.6, s * (0.9 + (rear || hit ? 0.5 : 0))], [H[0] + 3.6, H[1] - 0.9, s * (0.4 + (rear ? 0.8 : 0))], 0.55, MASK);
        const e = surf(H, [2.4, 1.7, 2.8], [1.1, 0.5, s * 0.9]);
        M.dot(e, "#ffb0a0", 1, 1);
        M.dot([e[0] + 0.4, e[1] - 0.9, e[2] + s * 0.2], "#ff3b3b", 1, 1);
      });
      // heavy crushing pincers swept wide to frame the skull: dark arms, serrated bone-white blades, crimson crystal vein
      const open = rear ? 1.1 : hit ? 0.15 : 0.5, reach = hit ? 2.4 : rear ? -0.6 : 0;
      both((s) => {
        const sh = [f0 + 4.6, u0 + 0.1, s * 2.4];
        const el = [f0 + 7.2 + reach * 0.5, u0 + 0.8, s * 5.8];
        const palm = [f0 + 9.6 + reach, u0 + 0.5, s * 4.8];
        M.tube([sh, el, palm], [1.0, 0.95, 1.45], HIDE);
        M.dot([palm[0] + 0.3, palm[1] + 1.1, palm[2]], "#ff3b3b");
        M.cone([palm[0], palm[1] + 0.2, palm[2] + s * 0.7], [palm[0] + 3.8, palm[1] + 0.1, palm[2] - s * (0.3 - open * 0.95)], 1.0, MASK);
        M.cone([palm[0], palm[1] - 0.3, palm[2] - s * 0.5], [palm[0] + 3.0, palm[1] - 0.4, palm[2] - s * (1.6 + open * 0.8)], 0.75, MASK);
      });
      // high-arched segmented tail with dorsal crystal spines and warm glowing stinger bulb
      const tipAt = hit ? [f0 + 7.8, u0 + 5.8, 0] : rear ? [f0 - 4.2, u0 + 13.8, 0] : [f0 + 1.2, u0 + 11.6 + (p.idle ? 0.6 : 0), 0];
      const tail = bez([f0 - 5.6, u0 + 1.0, 0], [f0 - 11.2, u0 + (hit ? 11.5 : 8.6), 0], tipAt, 6);
      M.tube(tail, [1.9, 1.0], HIDE);
      for (let i = 1; i < 6; i++) {
        const q = tail[i];
        M.cone([q[0], q[1] + 0.7, 0], [q[0] - 1.2, q[1] + 2.9 - i * 0.2, 0], 0.7, i % 2 ? SEAM : MASK);
      }
      const T = tail[6];
      M.e(T, [1.85, 1.45, 1.45], SEAM);
      const st = hit ? [T[0] + 3.2, T[1] - 2.4, 0] : [T[0] + 2.6, T[1] - 2.6, 0];
      M.cone([T[0] + 0.4, T[1] + 0.2, 0], st, 1.2, SEAM);
      M.dot([T[0] + 0.6, T[1] + 0.4, 0], "#ffb0a0", 2, 2);
      M.dot(st, "#ffb0a0", 1, 1);
    },
  },

  /** 밤장막 흡혈박쥐 — hunched bat torn from cloakbat's mantle: bone skull mask, ear-horns, exposed ribcage heart, ragged ribbon wings. */
  nightbat: {
    size: "m", hover: 8, k: 1.12, glow: "#d43cff", death: "burst",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.1), wind = p.wind ? 1 : 0, hit = p.strike ? 1 : 0;
      const c = [lf * 0.8, 6.8 + lu * 0.6 + bob(p, 0.5), 0];
      // gaunt near-black torso and trailing clawed hind legs
      M.G("body");
      M.e(c, [3.5, 4.2, 2.9], CLK);
      M.e([c[0] - 1.8, c[1] - 1.6, 0], [2.3, 2.5, 2.1], CLKD);
      M.G();
      both((s) => {
        M.tube([[c[0] - 1.2, c[1] - 3.0, s * 1.4], [c[0] - 2.8, c[1] - 5.4, s * 1.9], [c[0] - 3.6, c[1] - 6.8, s * 1.5]], [0.85, 0.58, 0.38], CLKD);
        M.cone([c[0] - 3.6, c[1] - 6.8, s * 1.5], [c[0] - 2.9, c[1] - 7.9, s * 1.6], 0.42, MASK);
      });
      // exposed bone ribcage over a glowing violet-magenta blood heart
      const ch = [c[0] + 2.5, c[1] - 0.1, 0];
      for (let i = 0; i < 3; i++) {
        const ru = ch[1] + 1.9 - i * 1.5, sp = wind || hit ? 1.25 : 1;
        both((s) => M.tube([[ch[0] - 0.2, ru, s * 0.5], [ch[0] + 0.5, ru, s * 1.9 * sp], [ch[0] - 0.6, ru - 0.4, s * 3.0 * sp]], [0.55, 0.38], MASK));
      }
      M.s([ch[0] + 0.5, ch[1] + 0.2, 0], wind || hit ? 1.7 : 1.3, VIO);
      M.dot([ch[0] + 1.2, ch[1] + 0.4, 0], "#ffd0f4", 1, 2);
      // tattered cloak-ribbon wings held high in idle0, sweeping wide through the flap cycle
      const fl = p.walk ? Math.sin(p.ph * Math.PI * 2) * 0.9 : wind ? 0.85 : hit ? -0.55 : p.idle ? -0.35 : 0.5;
      both((s) => {
        const deg = -s * fl * 42;
        const sh = [c[0] + 0.2, c[1] + 2.2, s * 2.2];
        const R = (df, ds, du) => rollPt([sh[0] + df, sh[1] + du, sh[2] + s * ds], deg, sh);
        const el = R(1.2, 5.2, 2.8), tip = R(-1.0, 11.4, 2.2);
        M.tube([sh, el, tip], [1.2, 0.82, 0.48], CLK);
        M.tube([sh, el, tip], 0.35, VIO);
        M.cone(el, [el[0] + 1.6, el[1] + 1.4, el[2] + s * 0.4], 0.48, MASK);
        for (let i = 0; i < 4; i++) {
          const k = (i + 1) / 4.5;
          const bx = sh[0] + (tip[0] - sh[0]) * k, bu = sh[1] + (tip[1] - sh[1]) * k, bs = sh[2] + (tip[2] - sh[2]) * k;
          const tail = R(-3.6 - (i % 2) * 1.3, 2.4 + i * 2.3, -4.4 - (i % 2) * 1.6);
          M.cone([bx, bu, bs], tail, 1.15, i % 2 ? CLKD : CLK);
          M.dot(tail, "#ffd0f4", 1, 1);
        }
      });
      // bone-white pig-nosed skull mask, tall ear-horns, glowing sockets, and vampire fangs
      const H = [c[0] + 2.5 + (hit ? 1.2 : 0), c[1] + 3.6 + (wind ? 0.8 : hit ? -0.6 : 0), 0];
      M.e(H, [2.3, 2.2, 2.1], CLK);
      M.e([H[0] + 0.6, H[1] + 0.1, 0], [2.0, 1.9, 1.8], MASK);
      M.e([H[0] + 2.1, H[1] - 0.5, 0], [1.1, 0.9, 1.2], MASK);
      both((s) => {
        M.cone([H[0] - 0.4, H[1] + 1.3, s * 1.3], [H[0] - 1.9, H[1] + 5.8 + (wind ? 0.8 : 0), s * 3.2], 0.8, MASK);
        const e = surf([H[0] + 0.6, H[1] + 0.1, 0], [2.0, 1.9, 1.8], [1.1, 0.4, s * 0.9]);
        M.dot(e, "#ffd0f4", 1, 2);
        M.cone([H[0] + 2.0, H[1] - 1.1, s * 0.7], [H[0] + 2.3, H[1] - 3.1 - (wind || hit ? 0.7 : 0), s * 0.8], 0.45, MASK);
      });
    },
  },

  /** 먹장어 머리 — abyssal hagfish erupting from a whale wound, mimicking the whale's bone-jawed head around a gaping rasping sucker maw. */
  hagfishhead: {
    size: "l", k: 1.08, glow: "#7ff6ff", death: "melt",
    draw(M, p) {
      const sw = p.walk ? Math.sin(p.ph * 6.28) * 1.6 : p.idle ? Math.sin(p.t * 1.5) * 0.8 : 0;
      const [lf, lu] = lunge(p, 1.3), wind = p.wind ? 1 : 0, hit = p.strike ? 1 : 0;
      const f0 = lf * 0.7, u0 = 2.6;
      // dark wound-mound base with broken whale-rib shards and coiled tail anchor
      M.G("base");
      M.e([f0 - 1.5, u0, 0], [7.2, 2.6, 6.8], WHD);
      M.tube(bez([f0 - 2, u0 + 1.2, -5.2], [f0 - 8.5, u0 + 2.0, 0], [f0 - 3.5, u0 + 1.0, 5.6], 6), [2.4, 1.3], WH);
      M.G();
      M.cone([f0 - 7.5, u0 + 1.6, 2.2], [f0 - 11.2, u0 + 4.4, 4.2], 1.1, CYN);
      for (const [df, ds, h] of [[-4.2, -4.8, 5.4], [-0.5, 5.2, 6.0], [3.2, -4.4, 4.8], [3.8, 4.2, 5.0]]) {
        const s = ds < 0 ? -1 : 1;
        M.tube([[f0 + df, u0 + 0.8, ds], [f0 + df + 0.4, u0 + h * 0.6, ds + s * 1.4], [f0 + df - 0.6, u0 + h, ds + s * 0.4]], [0.85, 0.45], MASK);
      }
      // S-curved abyssal hagfish trunk rearing high out of the wound
      const hPos = [f0 + 3.6 + (hit ? 2.8 : wind ? -1.6 : 0), 15.0 + lu * 0.7 + (wind ? 1.8 : hit ? -1.0 : 0) + bob(p, 0.6), sw * 0.4];
      const neck = bez([f0 - 1.2, u0 + 1.6, 0], [f0 - 5.4, 9.5, -sw], hPos, 7);
      M.tube(neck, [3.6, 3.2], WH);
      M.tube([neck[1], neck[3], neck[5]], [2.2, 1.8], WHD);
      // ice-cyan rift crystal shards along the arched dorsal spine and glowing gill seams
      for (let i = 1; i <= 4; i++) {
        const q = neck[i];
        M.cone([q[0] - 1.2, q[1] + 1.4, q[2]], [q[0] - 4.4 - (i % 2) * 1.2, q[1] + 4.4 + (i % 2) * 1.4, q[2]], 1.1, CYN);
        both((s) => M.dot([q[0] + 1.2, q[1], q[2] + s * 2.9], "#e0ffff", 1, 1));
      }
      // dark abyssal head mimicking bloomwhale: jagged bone brow-horns, weeping cyan slits, and split bone whale lower jaws
      const H = hPos;
      M.e([H[0] + 0.6, H[1] + 0.8, H[2]], [4.4, 3.8, 3.8], WH);
      M.cone([H[0] - 2.0, H[1] + 3.6, H[2]], [H[0] - 5.8, H[1] + 7.0, H[2]], 1.25, CYN);
      const jy = H[1] - 3.6 - (wind || hit ? 1.2 : 0);
      both((s) => {
        const hz = H[2] + s * 2.4;
        // jagged bone skull-brow ridges and hollow cyan eyes
        M.cone([H[0] + 1.8, H[1] + 3.2, H[2] + s * 1.2], [H[0] - 1.6, H[1] + 5.2, H[2] + s * 3.4], 0.9, MASK);
        M.dot([H[0] + 2.4, H[1] + 2.4, H[2] + s * 3.2], "#e0ffff", 1, 2);
        // split bone whale mandibles with upward teeth
        M.tube([[H[0] - 1.8, jy + 0.6, H[2] + s * 3.4], [H[0] + 2.2, jy - 0.8, hz], [H[0] + 5.8, jy + 0.2, H[2] + s * 1.2]], [1.15, 0.9, 0.65], MASK);
        for (let i = 0; i < 3; i++) {
          const tf = H[0] + 0.4 + i * 1.7, tz = H[2] + s * (2.8 - i * 0.5);
          M.cone([tf, jy - 0.1, tz], [tf + 0.2, jy + 1.8, tz], 0.45, MASK);
        }
        // sensory hagfish barbels writhing beside the mouth
        M.tube([[H[0] + 3.4, H[1] - 1.0, hz], [H[0] + 6.4, H[1] - 2.6, H[2] + s * 4.2]], [0.6, 0.3], MASK);
      });
      // gaping circular hagfish sucker-maw ringed with inward-hooked rasping bone teeth and cyan throat core
      const mw = [H[0] + 3.2, H[1] - 0.2, H[2]], mr = wind || hit ? 3.5 : 3.0;
      M.e(mw, [1.8, mr + 0.7, mr + 0.7], WH);
      M.e([mw[0] + 0.9, mw[1], mw[2]], [1.1, mr, mr], WHD);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, dy = Math.cos(a) * mr, dz = Math.sin(a) * mr;
        M.cone([mw[0] + 1.4, mw[1] + dy, mw[2] + dz], [mw[0] + 2.0, mw[1] + dy * 0.36, mw[2] + dz * 0.36], 0.5, MASK);
      }
      M.s([mw[0] + 1.4 + (hit ? 0.8 : 0), mw[1], mw[2]], wind || hit ? 1.6 : 1.2, CYN);
      M.dot([mw[0] + 2.4 + (hit ? 0.8 : 0), mw[1] + 0.2, mw[2]], "#e0ffff", 2, 2);
    },
  },
};
