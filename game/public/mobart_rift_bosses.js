/** Field bosses whose bodies have fused with objects from their hunting grounds. */
import { mat, C, bez, gait, bob, lunge, legs4, teeth, surf, both } from "./mobart_kit.js";

const AMBER = mat("#be722e", { wet: true });
const WAX = mat("#f5b75a", { wet: true, drip: true });
const HARE = mat("#886469");
const HARE_DARK = mat("#513747");
const FLAME = mat("#ffcc57", { role: "glow" });

const BARK = mat("#624337");
const THORN = mat("#a47047");
const HUSK = mat("#3e5541");
const BUD = mat("#a8e35d", { role: "glow" });

const ASH = mat("#393544");
const GILD = mat("#a38a57");
const PATINA = mat("#56636a");
const SHROUD = mat("#56405a", { flat: true });
const SHROUD_HEM = mat("#a08583", { flat: true });

const STONE = mat("#7b778c");
const STONE_DARK = mat("#4e485c");
const STONE_PALE = mat("#b0a39c");
const ARC = mat("#77eee8", { role: "glow" });
const THREAD = mat("#ce9c65", { flat: true });

const SCALES = mat("#30545d", { wet: true });
const EEL_BELLY = mat("#78867c");
const RUST = mat("#925b49");
const LURE = mat("#d7ec83", { role: "glow" });
const FIN_EDGE = mat("#442f47");
const FIN_WEB = mat("#a74656", { wet: true });

const VELVET = mat("#503951");
const MEMBRANE = mat("#68577d", { flat: true });
const QUARTZ = mat("#96cddd");
const AMETHYST = mat("#957adc");

/** A broad, oily fin is an oar on the surface and folds into the armoured coil when submerged. */
function leviathan(dived) {
  return {
    size: "xl", n: 100, glow: "#b9d877", death: "melt",
    draw(M, p) {
      const [f, lift] = lunge(p, dived ? 0.65 : 1.35);
      const u = lift + bob(p, 0.68), low = dived ? 2.45 : 0;
      const wave = p.walk ? Math.sin(p.ph * Math.PI * 2) : 0;
      const head = [f + 8.15 + 1.55 * p.strike, 8.45 + u - low + p.wind * 1.25, -1.48];
      const coil = [
        head, [f + 3.35, 6.4 + u - low, 3.65], [f - 0.5, 6.0 - low * 0.65, 6.5],
        [f - 5.6, 5.2 - low * 0.5, 4.65], [f - 9.1, 4.4, 0.55],
        [f - 8.45, 5.3 - low * 0.43, -4.2], [f - 4.2, 7.9 - low, -5.55],
        [f - 2.65, 11.3 + u - low * 1.7, -1.6 + wave],
      ];
      M.G("belly");
      M.tube(coil.slice(0, 7).map(([x, y, z]) => [x, y - 1.0, z]), [2.6, 1.55], EEL_BELLY);
      M.G("thick coil");
      M.tube(coil, [3.15, 1.35], SCALES);

      // The gate was swallowed whole. It remains a corroded brace between the fin roots.
      M.G("chewed gate");
      const gate = [];
      for (let i = 0; i <= 6; i++) {
        const a = (i - 3) * 0.45;
        gate.push([f - 4.6, 6.1 + Math.cos(a) * 4 - low, Math.sin(a) * 6.55]);
      }
      M.tube(gate, 1.15, RUST);
      both(s => M.box([f - 4.5, 6.5 - low, s * 5.6], [1.28, 1.4, 1.32], PATINA, [s * -11, -5, s * 12]));
      M.G();
      for (let i = 1; i < coil.length - 1; i++) {
        const [x, y, z] = coil[i], k = 1 - i * 0.057;
        M.box([x - 0.18, y + 1.61, z], [1.79 * k, 1.13, 2.14 * k], i % 3 ? PATINA : RUST, [i * -28, i * 4 - 13, -13 + i * 6]);
      }

      both(s => {
        const beat = dived ? 0 : p.wind ? 4.9 : p.strike ? -2.5 : wave * 2.65;
        const fin = (x, y, r) => [
          f + (dived ? x * 0.82 - Math.max(0, r - 6.5) * 0.32 : x),
          y + u + beat * Math.max(0, r - 6.1) / 10 - low * 0.8,
          s * (dived ? 5 + (r - 5) * 0.25 : r),
        ];
        const root = fin(2.45, 7.1, 3.94), elbow = fin(-0.5, 9.65, 8.85), rim = fin(-4.55, 9.15, 13.9);
        const tips = [fin(-7.65, 7.7, 17.4), fin(-10.45, 5.8, 15.3), fin(-10.2, 4.45, 11.2)];
        M.G("red web" + s);
        M.e(fin(-2.95, 7.65, 8.4), [4.65, 1.22, dived ? 1.54 : 4.15], FIN_WEB, [s * -20, 10, s * (17 + beat * 3)]);
        M.cone(rim, tips[0], 2.25, FIN_WEB);
        M.cone(fin(-4.3, 8.15, 11.5), tips[1], 2.66, FIN_WEB);
        M.cone(fin(-4.35, 7.06, 8.82), tips[2], 2.0, FIN_WEB);
        M.G("fin rays" + s);
        M.tube([root, elbow, rim, tips[0]], [1.36, 0.91, 0.64, 0.4], FIN_EDGE);
        M.tube([elbow, fin(-5.2, 8.1, 12.2), tips[1]], [0.75, 0.4], FIN_EDGE);
        M.tube([root, fin(-4.95, 6.8, 8.89), tips[2]], [0.75, 0.4], FIN_EDGE);
        M.G();
      });
      const tail = coil[coil.length - 1];
      const lure = [f - 10.7 + p.wind, 14.65 + p.wind * 2 - low * 2.2, 1.55 + wave * 2.2];
      M.G("tail");
      M.tube(bez(tail, [f - 4.7, 19.2 - low * 2.6, 1.9 + wave], lure, 5), [1.72, 0.65], SCALES);
      M.e(lure, [1.43, 1.18, 1.12], LURE);
      M.G("bite");
      const [x, y, z] = head;
      M.e(head, [4.2, 2.7, 2.85], SCALES);
      M.box([x + 1.15, y + 1.4, z], [2.71, 1.23, 2.46], PATINA, [0, -11, 0]);
      M.e([x + 2.68, y - 0.82, z], [2.87, 1.2, 1.94], EEL_BELLY);
      const bite = y - 1.82 - p.strike * 0.75 - p.wind * 0.68;
      M.e([x + 2.87, bite, z], [2.72, 0.89 + p.strike * 0.42, 1.73], C.MAW, [0, -p.strike * 13, 0]);
      M.e([x + 2.65, bite - 0.74, z], [2.37, 0.59, 1.48], SCALES);
      M.G();
      both(s => {
        M.eye([x + 2.0, y + 0.71, z + s * 2.35], 2, "#edf097");
        M.cone([x - 1.65, y + 0.67, z + s * 1.85], [x - 3.3, y + 2.25, z + s * 3.2], 1.15, PATINA);
        teeth(M, [x + 1.69, y - 1.33, z + s * 1.58], [x + 4.67, y - 1.33, z + s * 0.91], 3, 1, 1.22);
      });
    },
  };
}

export const RIFT_BOSS_ART = {
  // A crouched, broad hare whose two candle ears are visible over the colony's wax collar.
  wickregent: {
    size: "xl", glow: "#f4bc62",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.45);
      const u = 9 + lift + bob(p, 1.6);
      legs4(M, p, { ff: f + 4.2, bf: f - 5.2, w: 3.6, hu: u - 0.8, r: 1.8, st: 3.5, m: HARE_DARK, foot: HARE });
      M.G("hide");
      M.e([f - 2.3, u, 0], [7.2, 5.15, 5.55], HARE);
      M.s([f - 9.1, u + 0.85, -0.8], 2.3, HARE_DARK);
      both(s => M.e([f - 4.6, u - 1.8, s * 4.15], [3.7, 2.95, 1.85], HARE_DARK, [s * 13, 12, 0]));
      M.G("collar");
      M.e([f + 3.7, u + 1.05, 0], [3.05, 4.65, 5.65], AMBER, [0, -18, 0]);
      both(s => {
        M.s([f + 4.85, u + 1.1, s * 4.1], 1.8, WAX);
        M.cone([f + 5.35, u + 0.35, s * 4.65], [f + 5.65, u - (s === 1 ? 3.6 : 2.45), s * 4.35], 1.15, WAX);
        M.dot([f + 4.35, u + 2.4, s * 5.1], "#754024", 2, 1);
      });
      const head = [f + 6.4, u + (p.wind ? 2.1 : 3.6), 0];
      const [hf, hu] = head, hr = [3.6, 3.2, 3.3];
      M.G("face");
      M.e(head, hr, HARE);
      M.e([hf + 2.5, hu - 0.8, 0], [2.25, 1.6, 2.15], HARE_DARK);
      M.box([hf + 4.25, hu - 0.65, 0], [0.5, 0.65, 0.95], C.MAW);
      M.G();
      both(s => {
        M.eye(surf(head, hr, [0.63, 0.1, s * 0.77]), 2, "#ffbf5a");
        M.box([hf + 3.75, hu - 2, s * 0.7], [0.8, 0.75, 0.52], C.TOOTH);
        const tip = [hf - 2.25 - p.wind * 2.7 + p.strike * 2.8, hu + (s === 1 ? 12 : 9.5), s * 3.25];
        M.G("ears");
        M.tube([[hf - 1.7, hu + 1.7, s * 1.7], [hf - 2.35, hu + 6.6, s * 2.8], tip], [1.4, 1.7, 0.85], HARE_DARK);
        M.e([tip[0] + 0.15, tip[1] - 1.1, tip[2]], [0.95, 2.45, 1.13], WAX);
        M.cone(tip, [tip[0] - 0.4, tip[1] + (p.wind ? 2.8 : 1.45), tip[2]], 0.8, FLAME);
        M.G();
      });
    },
  },

  // Eight bent root legs carry a single split bud. The bud opens during the wind-up.
  knotwidow: {
    size: "xl", n: 96, glow: "#b3e568",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.25);
      const u = 7 + lift + bob(p, 0.9);
      const legEnds = [[-9, 12.5], [-4, 15.2], [3.8, 13.5], [9.6, 10.5]];
      both(s => {
        for (let i = 0; i < legEnds.length; i++) {
          const [reach, spread] = legEnds[i];
          const [sw, up] = gait(p, ((i + (s === 1 ? 1 : 0)) % 2) * 0.5);
          const joint = [f + reach * 0.7, u + 4.5 + (i % 2) * 1.45, s * (spread - 4)];
          const foot = [f + reach + sw * 2.65 + p.strike * 2.1, up * 3 + 0.4, s * spread];
          M.G("leg" + s + i);
          M.tube([[f - 2 + i * 1.75, u + 0.8, s * 2.15], joint, foot], [1.25, 1.05, 0.4], BARK);
          M.cone(joint, [joint[0] - 1.85, joint[1] + 3.5, joint[2] + s * 1.55], 1, THORN);
          M.G();
        }
      });
      const b = [f - 4.25, u + 4.65, 0];
      M.G("bud");
      M.e(b, [6.5, 5.3, 5.45], HUSK, [0, -24, 0]);
      M.e([b[0] - 1.3, b[1] + 0.8, 0], [4.5, 4.55, 3.9], BUD, [0, -17, 0]);
      const open = p.wind ? 2.2 : p.strike ? 1.25 : 0;
      both(s => {
        M.e([b[0], b[1], s * (3.1 + open)], [5.1, 4.3, 1.6], HUSK, [s * 22, -25, s * 24]);
        M.cone([b[0] - 3.4, b[1] + 2.8, s * (2.85 + open)], [b[0] - 7.3, b[1] + 7.4, s * (1.8 + open)], 1.25, THORN);
      });
      M.G("face");
      M.e([f + 3.4, u + 1, 0], [3.7, 2.55, 3.25], BARK);
      M.e([f + 5.6, u + 0.7, 0], [2.1, 1.5, 1.65], C.MAW);
      M.G();
      both(s => {
        M.eye([f + 5.2, u + 2, s * 2.58], 2, "#c6ed71");
        M.eye([f + 6.2, u + 1.5, s * 1.55], 1, "#d8fa89");
        M.cone([f + 5.45, u + 0.4, s * 2.25], [f + 8.6 + p.strike, u - 1.4, s * 1.3], 1.2, THORN);
      });
    },
  },

  // The tomb's last watchman bears its bell on a diagonally slung pole.
  knellkeeper: {
    size: "xl", glow: "#d7b981",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.35);
      const u = 15 + lift + bob(p, 0.65);
      const lean = p.wind ? -1.8 : p.strike ? 2.8 : 0;
      const waist = [f - 1.4, u - 3.8, 0], chest = [f + lean, u + 2, 0];
      both(s => {
        const [sw, up] = gait(p, s === 1 ? 0.5 : 0);
        const step = sw * 3 + s * (2.6 + p.strike * 1.5);
        const knee = [f + step * 0.8, u - 8.2 + up, s * 2.9];
        const foot = [f + step, 1.3 + up * 2.2, s * 3.15];
        M.G("greave" + s);
        M.tube([[waist[0], waist[1], s * 1.55], knee, foot], [1.45, 1.35, 0.92], ASH);
        M.box(knee, [1.4, 1.9, 1.3], PATINA, [s * 8, -14, 0]);
        M.box([foot[0] + 0.75, foot[1] - 0.35, foot[2]], [1.85, 0.95, 1.12], PATINA);
        M.G();
      });

      M.G("plate");
      M.tube([waist, chest], [2.15, 3.2], ASH);
      M.box([chest[0] + 0.65, chest[1] + 1, 0], [1.8, 3, 3.32], PATINA, [0, -10, 0]);
      M.box([waist[0] + 0.48, waist[1] + 0.2, 0], [1.42, 0.8, 2.7], GILD);
      M.G();
      both(s => {
        const n = s === 1 ? 1 : 0;
        const rag = p.wind ? 1.9 : p.strike ? -2.4 : 0;
        const root = [chest[0] - 1.67, chest[1] + 1.1, s * 2.85];
        const fold = [f - 5.7 + rag, u - 4.7 + n * 1.9, s * 3.8];
        const end = [f - 10.8 + rag, 2.7 + n * 1.8, s * 4.45];
        M.G("shroud" + s);
        M.e([root[0] - 1.1, root[1] - 3.3, root[2]], [1.4, 4.85, 1.2], SHROUD, [0, -24, s * 6]);
        M.tube([root, fold, end], [1.5, 1.8, 0.4], SHROUD);
        M.cone(fold, [end[0] + 2.4, end[1] - 0.6, s * 5.65], 1.2, SHROUD);
        M.tube([fold, [end[0] + 1.28, end[1] + 1.4, end[2] + s * 0.45]], [0.62, 0.42], SHROUD_HEM);
        M.G();
        M.box([chest[0], chest[1] + 1.55, s * 4], [2.2, 1.38, 1.75], PATINA, [s * 13, -11, s * -14]);
      });
      // A sepulchral hound's skull remains bound to the reverse of the collar.
      M.G("relic");
      M.e([chest[0] - 2.65, chest[1] + 1.35, -1.55], [1.55, 1.92, 1.8], C.BONEB);
      M.e([chest[0] - 3.6, chest[1] + 0.2, -1.62], [1.4, 0.63, 1.04], C.BONE);
      M.e([chest[0] - 3.5, chest[1] + 1.55, -2.45], [0.52, 0.63, 0.52], C.MAW);
      M.G("helm");
      const h = [chest[0] + 0.25, u + 8.35, 0];
      M.e(h, [2.75, 3.4, 2.8], ASH, [0, p.wind * -18, 0]);
      M.box([h[0] - 0.9, h[1] + 2.4, 0], [1.16, 1.55, 1.5], PATINA, [0, -17, 0]);
      M.e([h[0] + 0.72, h[1] - 1.72, 0], [2.23, 0.8, 3.1], GILD);
      M.box([h[0] + 2.16, h[1] + 0.24, 0], [0.65, 0.64, 2.04], C.MAW, [0, p.wind * -9, 0]);
      both(s => M.dot([h[0] + 2.8, h[1] + 0.35, s * 1.25], "#f0b76f", 2, 1));
      M.G();

      const grip = [f + (p.strike ? 10 : p.wind ? 0.8 : 5.4), u + (p.wind ? 3.2 : p.strike ? 0 : -0.7), 5.3];
      const pole = p.wind ? [grip[0] - 4, grip[1] + 11.2, 5.9] : p.strike ? [grip[0] + 13.6, grip[1] + 0.4, 4.9] : [grip[0] - 10.9, grip[1] + 10.1, 5.4];
      const heel = p.wind ? [grip[0] + 4, 3.3, 4.9] : p.strike ? [grip[0] - 10.8, grip[1] - 1, 5.9] : [grip[0] + 10.2, 2.6, 5.2];
      M.G("hands");
      M.tube([[chest[0], chest[1], 4], [f + 0.55, u - 1.6, 5.7], grip], [1.34, 1.05, 1.05], ASH);
      M.tube([[chest[0], chest[1], -4], [f + lean + 2, u - 1.1, -3.6], [grip[0] - 2.8, grip[1] - 1.05, grip[2] - 1.1]], [1.35, 1.06], ASH);
      M.s(grip, 1.35, PATINA);
      M.G("pole");
      M.tube([heel, grip, pole], [0.65, 0.55], GILD);
      M.s(heel, 0.8, PATINA);
      M.G("toll");
      const bell = [pole[0] + p.strike * 0.6, pole[1] - 2.4, pole[2]];
      M.tube([pole, [bell[0], bell[1] + 0.8, bell[2]]], 0.52, PATINA);
      M.e(bell, [1.82, 2.28, 1.8], GILD);
      M.e([bell[0], bell[1] - 1.36, bell[2]], [2.9, 0.8, 2.85], GILD);
      M.e([bell[0], bell[1] - 1.82, bell[2]], [2.63, 0.49, 2.65], C.MAW);
      const clapper = [bell[0] + p.strike * 1.5, bell[1] - 3.2, bell[2]];
      M.tube([[bell[0], bell[1] - 1.6, bell[2]], clapper], [0.58, 0.63], PATINA);
      M.s(clapper, 0.85, GILD);
      M.G();
    },
  },

  // Fallen masonry forms the loom's shoulders. Its arm blocks swing off the stone frame.
  loomcolossus: {
    size: "xl", n: 104, glow: "#6dd5cf", death: "burst",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.1);
      const u = 13.8 + lift + bob(p, 0.85);
      both(s => {
        const [sw, up] = gait(p, s === 1 ? 0.5 : 0);
        const knee = [f + 2.8 + sw * 1.95, u - 6.8 + up, s * 4.75];
        const foot = [f - 0.4 + sw * 3.5, 1.75 + up * 2.35, s * 5.7];
        M.G("leg" + s);
        M.tube([[f - 1.65, u - 2.55, s * 3.8], knee, foot], [2.4, 1.75, 1.55], STONE_DARK);
        M.box(knee, [2.4, 2.15, 2.1], STONE, [s * 13, 8, s * 13]);
        M.box([foot[0] + 0.95, foot[1], foot[2]], [3, 1.6, 2.28], STONE, [s * 7, 0, 0]);
        M.box([foot[0] + 2.38, foot[1] + 0.75, foot[2]], [1.38, 0.94, 2.21], STONE_PALE, [s * 9, 3, 0]);
        M.G();
      });
      M.G("foundations");
      M.box([f - 1.65, u - 1.36, 0], [4.9, 2.5, 5.15], STONE_DARK, [0, -12, 1]);
      M.box([f - 1.1, u + 3.6, 0], [4.95, 3.3, 5.55], STONE, [-4, -6, -3]);
      M.box([f - 2.25, u + 6.4, 0], [5.4, 1.45, 6.3], STONE_PALE, [4, 8, 3]);
      M.G();
      both(s => {
        const edge = s === 1 ? 0 : 1.4;
        const shoulder = [f - 2.1, u + 5.7 + edge, s * 7.7];
        const hoist = p.wind ? (s === 1 ? 11.1 : 2.2) : p.strike ? (s === 1 ? -4.7 : -1.5) : 0;
        const swing = p.walk ? Math.sin(p.ph * Math.PI * 2) * s : 0;
        const elbow = [f + (p.wind ? -2.4 : p.strike ? 4.35 : 0) + swing, u + 1.8 + hoist, s * 9.25];
        const fist = [f + (p.wind ? 1.7 : p.strike ? (s === 1 ? 11.8 : 8.1) : 4.65) + swing, u - 2.75 + hoist * 1.3, s * (p.strike ? 7.6 : 10.2)];
        M.G("limb" + s);
        M.tube([shoulder, elbow, fist], [2.15, 2, 1.73], STONE_DARK);
        M.box(shoulder, [3.35, 2.22, 3], STONE, [s * 11, -9, s * 8]);
        M.box([shoulder[0] - 0.82, shoulder[1] + 2.18, shoulder[2] + s * 0.4], [3.24, 1.11, 2.58], STONE_PALE, [s * 17, 9, s * -10]);
        M.box(fist, [2.88, 2.95, 2.65], STONE, [s * -5, 6 - hoist * 3.1, s * 8]);
        M.box([fist[0] + 1.85, fist[1] + 0.48, fist[2]], [1.2, 1.85, 2.22], STONE_PALE, [s * 5, 11 - hoist * 2.5, 0]);
        M.G();
        // Two broken stone buttresses form the sides of the loom bed.
        for (let i = 0; i < 2; i++) {
          const z = s * (2.95 + i * 1.48);
          M.box([f + 3.25 - i * 0.37, u + 2.12 - i * 0.88, z], [1.15, 3.74 - i * 0.42, 0.78], STONE_PALE, [s * 9, -12, s * 16]);
        }
      });

      M.G("loom");
      // Alternate the angle of the rotating shuttle and the channels of its warp.
      const turn = p.wind ? 42 : p.strike ? 105 : p.walk ? p.ph * 180 : 12 + p.idle * 24;
      const heart = [f + 4.1, u + 2.7, 0];
      M.e([heart[0] - 0.38, heart[1], 0], [1.97, 3.48, 3.22], STONE_DARK);
      M.box([heart[0] + 0.25, heart[1], 0], [1.68, 2.42, 1.54], AMETHYST, [turn, -23, -27 + turn * 0.36]);
      M.box([heart[0] + 1.35, heart[1] + 0.25, 0.05], [0.95, 1.45, 0.74], ARC, [turn, -18, -31 + turn * 0.41]);
      both(s => {
        M.tube([[f + 4.12, u + 5.78, s * 2.14], [f + 5.1, u + 3.05, s * 1.45], [f + 4.3, u - 0.2, s * (p.strike ? 2.6 : 0.85)]], 0.48, THREAD);
      });
      M.G("crown");
      const h = [f + 0.9, u + 10.05, 0];
      M.box(h, [2.65, 2.92, 2.45], STONE, [7, -7, 0]);
      M.box([h[0] - 1, h[1] + 2.05, h[2] - 0.91], [2.23, 1.5, 1.61], STONE_PALE, [10, -14, 17]);
      M.box([h[0] + 2.6, h[1] + 0.2, 0], [0.38, 0.92, 1.65], STONE_DARK);
      both(s => M.dot([h[0] + 3, h[1] + 0.25, s * 0.97], "#a7f7e8", 2, 2));
      M.G();
    },
  },

  sluiceleviathan: leviathan(false),
  sluiceleviathan_dive: leviathan(true),

  // A bat with unequal quartz harmonics: a fork on one wing and a solid shard on the other.
  prismcantor: {
    size: "xl", n: 108, hover: 4, glow: "#b29df6",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.1);
      const u = 11 + lift + bob(p, 2.8);
      const flap = p.walk ? Math.sin(p.ph * Math.PI * 2) * 5.8 : p.wind ? 6 : p.strike ? -3.5 : 0;
      both(s => {
        const wing = (x, y, w) => [f + x, u + y + flap * Math.min(w / 11, 1), s * w];
        const shoulder = wing(0.65, 1.15, 2.35), elbow = wing(-0.8, 4.6, 8.3), wrist = wing(-2, 6.05, 13.3);
        M.G("membrane" + s);
        M.e(wing(-2.55, 1.8, 6.6), [4.2, 1.45, 5.1], MEMBRANE, [s * 22, -14, s * (15 + flap * 3)]);
        M.cone(elbow, wing(-7.8, -2.5, 9.75), 2.8, MEMBRANE);
        M.cone(wrist, wing(-7.7, -0.5, 13), 2.45, MEMBRANE);
        M.cone(wrist, wing(-5.9, 1.75, 17.9), 2.25, MEMBRANE);
        M.G("spar" + s);
        M.tube([shoulder, elbow, wrist], [1.35, 1.08, 0.72], VELVET);
        M.cone(wrist, wing(-2.85, 6.3, 20.25), 1, QUARTZ);
        if (s === 1) {
          M.cone(wing(-2.75, 4.15, 10.2), wing(-4.1, 10.55, 14.65), 2.45, AMETHYST);
          M.cone(wing(-4.25, 3.45, 10.65), wing(-7.2, 7.6, 12.64), 1.4, QUARTZ);
        } else {
          M.box(wing(-2.45, 5.25, 8.8), [1.38, 2.38, 1.55], AMETHYST, [19, -24, 28]);
          M.cone(wing(-2.45, 5.95, 9.15), wing(-1.7, 11.03, 10.5), 1.5, QUARTZ);
        }
        M.G();
        M.tube([[f - 2, u - 2, s * 1.5], [f - 3.35, u - 4, s * 1.85], [f - 2.05, u - 4.65, s * 2.35]], [0.8, 0.47], VELVET);
      });
      M.G("body");
      M.e([f - 1.5, u, 0], [4.35, 3.8, 3], VELVET);
      const h = [f + 3.1 + p.strike * 0.8, u + 1.3, 0], hr = [2.85, 2.55, 2.45];
      M.e(h, hr, VELVET);
      M.e([h[0] + 2.05, h[1] - 0.88, 0], [1.38, 0.95 + p.wind * 0.65, 1.42], C.MAW);
      M.G();
      both(s => {
        M.cone([h[0] - 0.9, h[1] + 1.8, s * 1.32], [h[0] - 1.8, h[1] + 5.7, s * 2.6], 1.15, VELVET);
        M.eye(surf(h, hr, [0.62, 0.17, s * 0.77]), 2, "#cdb7f5");
        M.cone([h[0] + 2.6, h[1] - 0.83, s * 0.9], [h[0] + 2.85, h[1] - 2.05 - p.wind * 0.4, s * 0.8], 0.46, C.TOOTH);
      });
    },
  },
};
