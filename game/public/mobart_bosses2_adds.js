/**
 * Bosses-2 adds (docs/design/bosses-2.md): 혈루 결정 전갈 `bloodshard` (bloodhorn),
 * 밤장막 흡혈박쥐 `nightbat` (cloakbat), 먹장어 머리 `hagfishhead` (bloomwhale).
 * Built with the same near-black hide, bone-white mask/ribs, and single glowing accent
 * palette as game/public/mobart_f.js, keeping each sprite within 16 colours including outline.
 */
import { mat, gait, bob, lunge, surf, both, rollPt } from "./mobart_kit.js";

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
  /** 혈루 결정 전갈 — asymmetrical blood-crystal crusher claw vs bone cutter pincer, angular segmented tail with warm crystal stinger. */
  bloodshard: {
    size: "m", k: 1.12, glow: "#ff3b3b",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.1), rear = p.wind ? 1 : 0, hit = p.strike ? 1 : 0;
      const f0 = lf * 0.8, u0 = 3.2 + lu * 0.5 + bob(p, 0.4);
      // 4 pairs of jointed arachnid legs with bone-white claw tips
      both((s) => {
        for (let i = 0; i < 4; i++) {
          const [sw, up] = gait(p, (i % 2 ? 0.5 : 0) + (s < 0 ? 0 : 0.25));
          const hip = [f0 + 3.0 - i * 2.1, u0 - 0.2, s * 2.4];
          const knee = [f0 + 3.6 - i * 2.2 + sw * 0.7, u0 + 2.2 + up * 0.8 + (rear && i === 0 ? 1.2 : 0), s * 5.5];
          const ft = [f0 + 4.0 - i * 2.3 + sw * 1.3, up * 1.3 + (rear && i === 0 ? 1.4 : 0), s * 7.5];
          M.tube([hip, knee, ft], [0.85, 0.65, 0.45], i % 2 ? HIDED : HIDE);
          M.cone(ft, [ft[0] + 0.9, 0.2, ft[2] + s * 0.6], 0.45, MASK);
        }
      });
      // low, wide armoured carapace and segmented abdomen
      M.G("body");
      M.e([f0 - 0.6, u0 + 0.2, 0], [6.4, 2.8, 4.3], HIDE);
      M.e([f0 + 3.6, u0 - 0.2, 0], [3.2, 2.2, 3.4], HIDED);
      M.G();
      // glowing blood-seams cracked across the dorsal plates
      for (let i = 0; i < 3; i++) {
        const f = f0 + 2.6 - i * 2.5;
        both((s) => M.tube([[f, u0 + 2.6, s * 0.8], [f - 0.6, u0 + 2.1, s * 2.7], [f - 1.1, u0 + 0.6, s * 4.0]], 0.42, SEAM));
        M.dot([f, u0 + 2.9, 0], "#ffb0a0");
      }
      // jagged blood-tear crystal shards erupting through the back
      for (const [df, h, ds] of [[-4.0, 4.0, -1.1], [-1.8, 5.4, 0.9], [0.2, 4.6, -0.8], [2.0, 3.6, 1.0]]) {
        M.cone([f0 + df, u0 + 2.0, ds * 0.6], [f0 + df - 1.2, u0 + 2.2 + h + rear * 0.8, ds * 1.5], 1.1, SEAM);
      }
      // bone-white skull faceplate with horn-spurs, split mandibles, and weeping red slit-eyes
      const H = [f0 + 5.6 + (hit ? 1.0 : 0), u0 + 0.5 + (rear ? 0.8 : 0), 0];
      M.e(H, [2.4, 1.7, 2.8], MASK);
      both((s) => {
        M.cone([H[0] - 0.8, H[1] + 1.1, s * 1.8], [H[0] - 2.6, H[1] + 3.0, s * 3.2], 0.65, MASK);
        M.cone([H[0] + 1.6, H[1] - 0.6, s * (0.9 + (rear || hit ? 0.5 : 0))], [H[0] + 3.5, H[1] - 0.9, s * (0.4 + (rear ? 0.8 : 0))], 0.55, MASK);
        const e = surf(H, [2.4, 1.7, 2.8], [1.1, 0.5, s * 0.9]);
        M.dot(e, "#ffb0a0", 1, 1);
        M.dot([e[0] + 0.4, e[1] - 0.9, e[2] + s * 0.2], "#ff3b3b", 1, 1);
      });
      // ASYMMETRICAL PINCERS:
      // Right side (s = +1): massive overgrown crimson blood-crystal crusher claw
      const open = rear ? 1.15 : hit ? 0.15 : 0.55, reach = hit ? 2.6 : rear ? -0.6 : 0;
      {
        const sh = [f0 + 4.6, u0 + 0.2, 2.6], el = [f0 + 7.6 + reach * 0.5, u0 + 1.2, 6.6], palm = [f0 + 10.4 + reach, u0 + 1.0, 5.4];
        M.tube([sh, el, palm], [1.2, 1.3, 1.9], HIDE);
        M.box(palm, [2.2, 1.6, 1.8], SEAM, [15, 8, 0]);
        M.cone([palm[0] - 0.6, palm[1] + 1.2, palm[2] + 0.8], [palm[0] - 2.0, palm[1] + 4.2, palm[2] + 2.2], 1.1, SEAM);
        M.cone([palm[0] + 0.6, palm[1] + 0.5, palm[2] + 0.9], [palm[0] + 5.2, palm[1] + 0.4, palm[2] - (0.2 - open * 1.2)], 1.35, SEAM);
        M.cone([palm[0] + 0.4, palm[1] - 0.5, palm[2] - 0.7], [palm[0] + 4.2, palm[1] - 0.6, palm[2] - (2.0 + open * 0.9)], 1.0, MASK);
        M.dot([palm[0] + 1.4, palm[1] + 0.8, palm[2]], "#ffb0a0", 2, 2);
      }
      // Left side (s = -1): compact, razor-sharp serrated bone scissor pincer
      {
        const sh = [f0 + 4.4, u0, -2.4], el = [f0 + 6.4 + reach * 0.4, u0 + 0.4, -5.2], palm = [f0 + 8.4 + reach * 0.7, u0 + 0.1, -4.2];
        M.tube([sh, el, palm], [0.85, 0.8, 1.1], HIDE);
        M.cone([palm[0], palm[1] + 0.2, palm[2] - 0.5], [palm[0] + 3.2, palm[1] + 0.1, palm[2] + (0.4 - open * 0.8)], 0.8, MASK);
        M.cone([palm[0], palm[1] - 0.2, palm[2] + 0.4], [palm[0] + 2.6, palm[1] - 0.3, palm[2] + (1.4 + open * 0.7)], 0.6, MASK);
      }
      // ANGULAR TAIL: sharp kinked segments (not a smooth curve) with corner spikes and warm crystal stinger
      const k1 = [f0 - 5.4, u0 + 0.8, 0];
      const k2 = [f0 - 10.4, u0 + (hit ? 4.8 : 3.8), 0];
      const k3 = [f0 - 9.2, u0 + (hit ? 11.4 : rear ? 11.8 : 9.8), 0];
      const k4 = [f0 - 2.4, u0 + (hit ? 11.8 : rear ? 14.2 : 12.2 + (p.idle ? 0.5 : 0)), 0];
      const tipAt = hit ? [f0 + 7.4, u0 + 6.2, 0] : rear ? [f0 - 4.4, u0 + 13.6, 0] : [f0 + 2.2, u0 + 10.8 + (p.idle ? 0.5 : 0), 0];
      const tail = [k1, k2, k3, k4, tipAt];
      M.tube(tail, [2.0, 1.7, 1.45, 1.25, 1.05], HIDE);
      // angular joint plates and crystal hooks at the sharp bends
      for (const [q, df, du, m] of [[k2, -2.2, 1.4, MASK], [k3, -2.0, 2.4, SEAM], [k4, -0.8, 2.6, SEAM]]) {
        M.cone(q, [q[0] + df, q[1] + du, 0], 0.85, m);
      }
      const st = hit ? [tipAt[0] + 3.4, tipAt[1] - 2.4, 0] : [tipAt[0] + 2.8, tipAt[1] - 2.6, 0];
      M.box(tipAt, [1.9, 1.4, 1.4], SEAM, [0, -20, 0]);
      M.cone([tipAt[0] + 0.4, tipAt[1] + 0.2, 0], st, 1.25, SEAM);
      M.dot([tipAt[0] + 0.6, tipAt[1] + 0.4, 0], "#ffb0a0", 2, 2);
      M.dot(st, "#ffb0a0", 1, 1);
    },
  },

  /** 밤장막 흡혈박쥐 — wide wings that fold around the body like a torn cloak in idle and spread ragged in flight/attack. */
  nightbat: {
    size: "m", hover: 8, k: 1.12, glow: "#d43cff", death: "burst",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.1), wind = p.wind ? 1 : 0, hit = p.strike ? 1 : 0;
      const c = [lf * 0.8, 7.2 + lu * 0.6 + bob(p, 0.5), 0];
      // gaunt near-black torso and trailing clawed hind legs
      M.G("body");
      M.e(c, [3.4, 4.4, 3.0], CLK);
      M.e([c[0] - 1.6, c[1] - 1.8, 0], [2.4, 2.6, 2.2], CLKD);
      M.G();
      both((s) => {
        M.tube([[c[0] - 1.0, c[1] - 3.2, s * 1.4], [c[0] - 2.6, c[1] - 5.6, s * 1.9], [c[0] - 3.4, c[1] - 7.0, s * 1.5]], [0.85, 0.58, 0.38], CLKD);
        M.cone([c[0] - 3.4, c[1] - 7.0, s * 1.5], [c[0] - 2.7, c[1] - 8.0, s * 1.6], 0.42, MASK);
      });
      // exposed bone ribcage over a glowing violet-magenta blood heart
      const ch = [c[0] + 2.4, c[1] - 0.1, 0];
      for (let i = 0; i < 3; i++) {
        const ru = ch[1] + 1.9 - i * 1.5, sp = wind || hit ? 1.25 : 1;
        both((s) => M.tube([[ch[0] - 0.2, ru, s * 0.5], [ch[0] + 0.5, ru, s * 1.9 * sp], [ch[0] - 0.6, ru - 0.4, s * 3.0 * sp]], [0.55, 0.38], MASK));
      }
      M.s([ch[0] + 0.5, ch[1] + 0.2, 0], wind || hit ? 1.7 : 1.3, VIO);
      M.dot([ch[0] + 1.2, ch[1] + 0.4, 0], "#ffd0f4", 1, 2);
      // WIDE TORN-CLOAK WINGS:
      // In idle (or mid-walk wrap), the wide wings arch out and fold sharply down/forward like a tattered cloak mantle;
      // on wind/strike/flap-up they spread wide with long ragged cloak-ribbons.
      const cloakFold = !wind && !hit && (!p.walk || p.ph >= 0.5);
      const fl = p.walk ? Math.sin(p.ph * Math.PI * 2) * 0.85 : wind ? 0.9 : hit ? -0.55 : p.idle ? -0.25 : 0.15;
      both((s) => {
        const sh = [c[0] + 0.2, c[1] + 2.6, s * 2.4];
        if (cloakFold) {
          const sw = p.idle ? 0.6 : 0;
          const el = [c[0] + 1.8, c[1] + 4.4 - sw, s * 7.8];
          const wrist = [c[0] + 3.0, c[1] + 0.4 - sw, s * 9.8];
          const hem = [c[0] + 1.4, c[1] - 6.8, s * 8.2];
          M.tube([sh, el, wrist, hem], [1.35, 1.15, 0.95, 0.55], CLK);
          M.tube([sh, el, wrist], 0.38, VIO);
          M.cone(el, [el[0] + 1.5, el[1] + 1.6, el[2] + s * 0.5], 0.5, MASK);
          // wide folded cloak panels with ragged torn bottom spikes
          for (let i = 0; i < 4; i++) {
            const top = [c[0] + 2.2 - i * 1.3, c[1] + 2.4 - i * 0.8, s * (9.2 - i * 0.9)];
            const bot = [c[0] + 0.8 - i * 1.5, c[1] - 7.4 - (i % 2) * 1.8, s * (8.4 - i * 0.6)];
            M.cone(top, bot, 1.35, i % 2 ? CLKD : CLK);
            M.dot(bot, "#ffd0f4", 1, 1);
          }
        } else {
          const deg = -s * fl * 38;
          const R = (df, ds, du) => rollPt([sh[0] + df, sh[1] + du, sh[2] + s * ds], deg, sh);
          const el = R(1.2, 5.6, 3.0), tip = R(-0.8, 12.0, 2.4);
          M.tube([sh, el, tip], [1.3, 0.9, 0.5], CLK);
          M.tube([sh, el, tip], 0.38, VIO);
          M.cone(el, [el[0] + 1.6, el[1] + 1.4, el[2] + s * 0.4], 0.5, MASK);
          for (let i = 0; i < 4; i++) {
            const k = (i + 1) / 4.4;
            const bx = sh[0] + (tip[0] - sh[0]) * k, bu = sh[1] + (tip[1] - sh[1]) * k, bs = sh[2] + (tip[2] - sh[2]) * k;
            const tail = R(-3.8 - (i % 2) * 1.4, 2.6 + i * 2.4, -5.2 - (i % 2) * 1.6);
            M.cone([bx, bu, bs], tail, 1.25, i % 2 ? CLKD : CLK);
            M.dot(tail, "#ffd0f4", 1, 1);
          }
        }
      });
      // bone-white pig-nosed skull mask, tall ear-horns, glowing sockets, and vampire fangs
      const H = [c[0] + 2.5 + (hit ? 1.2 : 0), c[1] + 3.8 + (wind ? 0.8 : hit ? -0.6 : 0), 0];
      M.e(H, [2.3, 2.2, 2.1], CLK);
      M.e([H[0] + 0.6, H[1] + 0.1, 0], [2.0, 1.9, 1.8], MASK);
      M.e([H[0] + 2.1, H[1] - 0.5, 0], [1.1, 0.9, 1.2], MASK);
      both((s) => {
        M.cone([H[0] - 0.4, H[1] + 1.3, s * 1.3], [H[0] - 1.9, H[1] + 6.0 + (wind ? 0.8 : 0), s * 3.3], 0.8, MASK);
        const e = surf([H[0] + 0.6, H[1] + 0.1, 0], [2.0, 1.9, 1.8], [1.1, 0.4, s * 0.9]);
        M.dot(e, "#ffd0f4", 1, 2);
        M.cone([H[0] + 2.0, H[1] - 1.1, s * 0.7], [H[0] + 2.3, H[1] - 3.1 - (wind || hit ? 0.7 : 0), s * 0.8], 0.45, MASK);
      });
    },
  },

  /** 먹장어 머리 — abyssal hagfish with a wide gaping toothed maw and a thick, protruding bone-plated whale lower jaw. */
  hagfishhead: {
    size: "l", k: 1.08, glow: "#7ff6ff", death: "melt",
    draw(M, p) {
      const sw = p.walk ? Math.sin(p.ph * 6.28) * 1.6 : p.idle ? Math.sin(p.t * 1.5) * 0.8 : 0;
      const [lf, lu] = lunge(p, 1.3), wind = p.wind ? 1 : 0, hit = p.strike ? 1 : 0;
      const f0 = lf * 0.7, u0 = 2.6;
      // dark wound-mound base with broken whale-rib shards and coiled tail anchor
      M.G("base");
      M.e([f0 - 2.0, u0, 0], [7.0, 2.5, 6.4], WHD);
      M.tube([[f0 - 2.5, u0 + 1.2, -5.0], [f0 - 8.2, u0 + 1.8, 0], [f0 - 3.8, u0 + 1.0, 5.2]], [2.3, 1.8, 1.2], WH);
      M.G();
      M.cone([f0 - 7.5, u0 + 1.6, 2.0], [f0 - 11.4, u0 + 4.6, 4.0], 1.1, CYN);
      for (const [df, ds, h] of [[-4.4, -4.6, 5.2], [-0.8, 4.8, 5.8], [2.8, -4.2, 4.6]]) {
        const s = ds < 0 ? -1 : 1;
        M.tube([[f0 + df, u0 + 0.8, ds], [f0 + df + 0.4, u0 + h * 0.6, ds + s * 1.3], [f0 + df - 0.6, u0 + h, ds + s * 0.4]], [0.85, 0.45], MASK);
      }
      // S-curved abyssal trunk arched back so the huge gaping head and thick jaw dominate the front silhouette
      const H = [f0 + 3.2 + (hit ? 2.6 : wind ? -1.4 : 0), 15.6 + lu * 0.7 + (wind ? 1.6 : hit ? -0.8 : 0) + bob(p, 0.6), sw * 0.4];
      const neck = [[f0 - 1.6, u0 + 1.6, 0], [f0 - 6.2, 7.6, -sw * 0.7], [f0 - 3.4, 12.8, -sw * 0.3], H];
      M.tube(neck, [3.6, 3.4, 3.2, 3.4], WH);
      for (let i = 1; i <= 2; i++) {
        const q = neck[i];
        M.cone([q[0] - 1.2, q[1] + 1.0, q[2]], [q[0] - 4.8, q[1] + 4.0, q[2]], 1.15, CYN);
        both((s) => M.dot([q[0] + 1.2, q[1], q[2] + s * 2.9], "#e0ffff", 1, 1));
      }
      // UPPER CRANIUM & WIDE GAPING SUCKER MAW (tilted up to open the mouth chasm wide)
      const upY = H[1] + 2.2 + (wind || hit ? 1.0 : 0);
      M.e([H[0] + 1.2, upY, H[2]], [4.6, 3.0, 3.8], WH, [0, 18, 0]);
      M.cone([H[0] - 1.8, upY + 2.4, H[2]], [H[0] - 5.8, upY + 6.0, H[2]], 1.25, CYN);
      both((s) => {
        M.cone([H[0] + 2.0, upY + 2.0, H[2] + s * 1.4], [H[0] - 1.4, upY + 4.2, H[2] + s * 3.6], 0.9, MASK);
        M.dot([H[0] + 3.2, upY + 1.2, H[2] + s * 3.1], "#e0ffff", 1, 2);
      });
      // cavernous dark mouth interior + ring of upper rasping teeth + glowing cyan throat core
      const mw = [H[0] + 3.6, H[1] - 0.2, H[2]];
      M.e(mw, [2.4, 3.8, 3.6], WHD);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, dy = Math.cos(a) * 3.2, dz = Math.sin(a) * 3.0;
        M.cone([mw[0] + 1.2, mw[1] + dy, mw[2] + dz], [mw[0] + 2.0, mw[1] + dy * 0.42, mw[2] + dz * 0.42], 0.52, MASK);
      }
      M.s([mw[0] + 1.0 + (hit ? 0.9 : 0), mw[1] + 0.2, mw[2]], wind || hit ? 1.7 : 1.3, CYN);
      M.dot([mw[0] + 2.1 + (hit ? 0.9 : 0), mw[1] + 0.4, mw[2]], "#e0ffff", 2, 2);
      // THICK, HEAVY LOWER JAW (굵은 턱): massive bone-white whale mandible jutting far forward and dropped wide open
      const jy = H[1] - 4.6 - (wind || hit ? 1.4 : 0), jf = H[0] + 4.4 + (hit ? 1.0 : 0);
      M.G("jaw");
      M.box([jf, jy, H[2]], [4.8, 1.7, 3.6], MASK, [0, -22, 0]);
      M.e([jf - 0.6, jy - 1.1, H[2]], [4.2, 1.3, 3.2], WH, [0, -22, 0]);
      M.G();
      // huge upward-pointing lower jaw fangs framing the gaping mouth
      both((s) => {
        for (const [df, h, r] of [[3.4, 2.8, 0.75], [1.2, 2.2, 0.6], [-1.0, 1.8, 0.55]]) {
          const tf = jf + df, tz = H[2] + s * 2.8;
          M.cone([tf, jy + 0.6, tz], [tf - 0.2, jy + 0.6 + h, tz * 0.85], r, MASK);
        }
      });
    },
  },
};
