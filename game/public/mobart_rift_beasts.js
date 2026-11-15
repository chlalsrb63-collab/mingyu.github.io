/** Creatures warped by the tools and materials of their hunting grounds. */
import { mat, C, gait, bob, lunge, legs4, both, surf } from "./mobart_kit.js";

const HARE = mat("#877064", { flat: true });
const WAX = mat("#cf822e", { flat: true });
const WICK = mat("#443028", { flat: true });
const FLAME = mat("#ffd074", { role: "glow" });
const LYNX = mat("#544333", { flat: true });
const BURR = mat("#77873b", { flat: true });
const THORN = mat("#b2a85f", { flat: true });
const NEWT = mat("#685d72", { flat: true });
const BELL = mat("#a87d56", { flat: true });
const SPIRIT = mat("#80d9ac", { role: "glow" });
const STEEL = mat("#545c76", { flat: true });
const COPPER = mat("#b06c46", { flat: true });
const WIRE = mat("#e5a96a", { flat: true });
const SPARK = mat("#5ee1d7", { role: "glow" });
const EEL = mat("#344c55", { flat: true });
const SCUTE = mat("#698a71", { flat: true });
const GRATE = mat("#838b8a", { flat: true });
const MOLE = mat("#af939f", { flat: true });
const VISOR = mat("#493858", { flat: true });
const LENS = mat("#9bd2e2", { flat: true });
const REFRACTION = mat("#ebbbf1", { role: "glow" });

export const RIFT_BEAST_ART = {
  /** A hive-runner that melted into its own signal candle. */
  wickhare: {
    size: "s",
    draw(M, p) {
      const [f, lift] = lunge(p);
      const hop = p.walk ? [0, 1.5, 0.7, 0][Math.round(p.ph * 4)] : 0;
      const u = 4.7 + lift + hop;
      const head = [f + 3.2, u + 2.5, 0], hr = [2.6, 2.25, 2.05];
      M.G("hide");
      M.e([f - 1.2, u, 0], [4.7, 3.15, 2.95], HARE);
      M.s([f - 5.05, u + 1.2, 0], 1.35, WAX);
      M.e(head, hr, HARE);
      M.e([f + 4.9, u + 0.6, 0], [1.9, 0.7, 1.65], WICK);
      M.G();
      both(s => {
        M.e([f - 2.4, u - 0.9, 1.8 * s], [2.65, 2.25, 1.35], HARE);
        M.e([f - 1.8 - hop, 0.9 + hop, 2 * s], [2.35, 0.78, 0.9], HARE);
        M.tube([[f + 1.9, u - 0.7, 1.55 * s], [f + 2.9 + hop, 0.9 + hop, 1.75 * s]], [0.95, 0.65], HARE);
        M.eye(surf(head, hr, [0.63, 0.15, 0.82 * s]), 2, "#ffce83");
      });
      M.cone([f + 1.65, u + 3.65, -1.1], [f - 0.2, u + 8.1, -2.2], 1.05, HARE);
      const stalk = [f + 1.9 - (p.wind ? 1.25 : 0), u + 7.4, 1.15];
      M.G("candle");
      M.tube([[f + 1.9, u + 3.5, 1], [f + 1.6, u + 5.35, 1.4], stalk], [1.45, 1.02], WAX);
      M.cone([stalk[0] + 0.65, u + 6.2, 1.85], [stalk[0] + 1.15, u + 4.5, 2.6], 0.6, WAX);
      M.G();
      const ember = [stalk[0] + (p.strike ? -0.8 : 0.15), stalk[1] + 1.35, stalk[2]];
      M.tube([stalk, ember], [0.53, 0.39], WICK);
      M.e(ember, [0.65, p.idle ? 0.85 : 1.15, 0.59], FLAME, [0, -24, 0]);
      M.cone([f + 5.3, u + 1.2, 0.85], [f + 5.5, u + 0.12, 0.85], 0.63, C.TOOTH);
    },
  },

  /** Its hooked seedpods catch on a tree until the lynx is ready to spring. */
  burrlynx: {
    size: "m",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.35);
      const u = 6.7 + lift + bob(p, 0.75);
      legs4(M, p, { ff: f + 3.1, bf: f - 4.35, hu: u - 0.8, w: 2.1, r: 1.1, m: LYNX, foot: LYNX });
      M.G("hide");
      M.e([f - 0.9, u, 0], [6, 2.7, 2.65], LYNX);
      M.cone([f - 5.7, u + 0.5, 0], [f - 8.2, u + (p.wind ? 0.3 : 2.35), 1.05], 1.15, LYNX);
      const head = [f + 4, u + 1.15, p.wind ? -0.65 : 0], hr = [2.95, 2.12, 2.35];
      M.e(head, hr, LYNX);
      M.e([head[0] + 1.75, head[1] - 0.8, head[2]], [1.85, 0.85, 1.8], LYNX);
      M.G();
      M.G("pods");
      M.e([f - 2.4, u + 2, 0], [3.6, 2.3, 2.65], BURR);
      M.e([f + 0.55, u + 2, 0], [2.55, 2, 2.7], BURR);
      M.G();
      both(s => {
        M.tube([[head[0] - 0.75, u + 2.25, 1.45 * s], [head[0] - 1.5, u + 3.75, 2.45 * s], [head[0] - 2.1, u + 4.55, 2.8 * s]], [0.9, 0.48, 0.33], LYNX);
        M.eye(surf(head, hr, [0.7, 0.04, 0.79 * s]), 2, "#c7df75");
        const raise = p.wind ? 0.7 : p.strike ? -0.45 : 0;
        for (const [site, reversal] of [[-3.85, -0.5], [-0.65, 0.55]]) {
          M.tube([[f + site, u + 2, 1.9 * s], [f + site - 1.05, u + 3.3 + raise, 3.35 * s], [f + site + reversal, u + 3.5 + raise, 3.7 * s]], [1, 0.64, 0.35], THORN);
        }
      });
    },
  },

  /** The crypt keeper's bell rings from inside three fused ribs. */
  bellnewt: {
    size: "m", glow: "#92be91",
    draw(M, p) {
      const [f, lift] = lunge(p, 0.85);
      const u = 3.5 + lift + bob(p, 0.35);
      const sway = p.walk ? Math.sin(p.ph * Math.PI * 2) : p.wind ? -1 : p.strike ? 1 : 0;
      M.G("hide");
      M.e([f - 0.8, u, 0], [5.05, 2.04, 3.15], NEWT);
      M.tube([[f - 4.7, u + 0.15, 0], [f - 7.3, u + 0.5, 1.55 + sway], [f - 9.9, u + 1.15, 2.65 + sway]], [1.65, 0.36], NEWT);
      const head = [f + 3.5, u + (p.strike ? 1.55 : 0.45), 0], hr = [2.75, 1.5, 3];
      M.e(head, hr, NEWT);
      M.e([head[0] + 1.3, head[1] - 0.55, 0], [1.65, 0.57, 2.6], NEWT);
      M.G();
      both(s => {
        const [stride, toe] = gait(p, s === 1 ? 0.5 : 0);
        M.tube([[f + 2.2, u, 1.7 * s], [f + 1.45 + stride * 0.4, u - 0.8, 3.7 * s], [f + 3.35 + stride, 1 + toe, 4.25 * s]], [0.92, 0.84, 0.55], NEWT);
        M.tube([[f - 3.5, u, 2 * s], [f - 2.5 - stride * 0.5, u - 0.45, 4 * s], [f - 4.1 - stride, 1 + toe, 4.55 * s]], [1.1, 0.94, 0.62], NEWT);
        M.s([head[0] + 0.25, head[1] + 0.78, 2.1 * s], 1.02, NEWT);
        M.eye([head[0] + 0.85, head[1] + 0.8, 2.75 * s], 2, "#9de8b5");
      });
      const buoy = p.wind ? 0.6 : 0;
      const bellSide = p.strike ? -0.7 : sway * 0.3;
      M.G("bell");
      M.e([f - 0.9, u + 3.25 + buoy, bellSide], [1.6, 2.05, 1.82], BELL, [0, 0, bellSide * 24]);
      M.e([f - 0.9, u + 1.78 + buoy, bellSide + 0.2], [2.05, 0.68, 2.25], BELL, [0, 0, bellSide * 24]);
      M.G();
      M.s([f - 0.8, u + 1.58 + buoy, bellSide - 0.8], 0.8, SPIRIT);
      for (const ridge of [-2.95, -1.6, 0.85]) {
        M.tube([[f + ridge, u + 0.5, -2.65], [f + ridge, u + 3.3, -1.5], [f + ridge, u + 4, 0], [f + ridge, u + 3.3, 1.5], [f + ridge, u + 0.5, 2.65]], 0.57, C.BONE);
      }
    },
  },

  /** A wading scrap bird that pulls live copper thread through its bill. */
  spoolsnipe: {
    size: "m",
    draw(M, p) {
      const [f, lift] = lunge(p);
      const u = 8.4 + lift + bob(p, 0.8);
      const reach = p.wind ? -1.25 : p.strike ? 1.65 : 0;
      const head = [f + 2.3 + reach, u + (p.strike ? 3.35 : 4.7), 0];
      both(s => {
        const [stride, toe] = gait(p, s === 1 ? 0.5 : 0);
        const foot = f + 0.9 + 2.5 * stride;
        M.tube([[f - 1, u - 0.65, s], [f - 1.9 + stride, 4.2 + toe, 1.25 * s], [foot, 1.1 + toe, 1.65 * s]], [0.74, 0.62, 0.56], STEEL);
        M.e([foot + 0.55, 0.88 + toe, 1.65 * s], [1.5, 0.6, 0.8], STEEL);
      });
      M.G("shell");
      M.e([f - 1.05, u, 0], [3.8, 2.25, 1.9], STEEL);
      M.cone([f - 2.8, u + 0.7, 0], [f - 7.2, u - 0.65, 0], 1.2, STEEL);
      M.tube([[f + 1, u + 0.6, 0], [f + 1.3, head[1] - 1, 0], head], [0.9, 0.73], STEEL);
      M.e(head, [1.55, 1.38, 1.22], STEEL);
      M.G();
      const bill = [head[0] + (p.strike ? 5.05 : 4.15), head[1] - (p.wind ? 0.15 : 0.7), 0];
      M.cone([head[0] + 0.7, head[1] - 0.25, 0], bill, 0.95, p.wind || p.strike ? SPARK : WIRE);
      both(s => {
        const liftWing = p.wind ? 1.05 : 0;
        M.G("spool" + s);
        M.e([f - 1.4, u + 0.1 + liftWing, 2.15 * s], [1.93, 1.52, 0.83], COPPER);
        M.e([f - 1.4, u + 0.1 + liftWing, 2.85 * s], [1.6, 1.28, 0.54], WIRE);
        M.G();
        M.s([f - 1.4, u + 0.1 + liftWing, 3.35 * s], 0.64, STEEL);
        M.eye([head[0] + 0.45, head[1] + 0.33, 1.17 * s], 1, "#86fff1");
      });
    },
  },

  /** A culvert eel that carries the bent filter grate it peeled loose. */
  sluiceeel: {
    size: "m", death: "melt",
    draw(M, p) {
      const [f, lift] = lunge(p);
      const u = 4.2 + lift + bob(p, 0.5);
      const wave = p.walk ? p.ph * Math.PI * 2 : p.idle * 0.65;
      const fold = p.wind ? 1.3 : 0;
      const head = [f + 4.3, u + 1 + fold - (p.strike ? 0.35 : 0), 0], hr = [3.0, 1.92, 1.82];
      M.G("hide");
      const trail = [head];
      for (let i = 1; i <= 6; i++) {
        const s = Math.sin(wave - i * 0.83) * (1.1 + i * 0.2);
        trail.push([f + 4.1 - 2.55 * i, u + (i > 4 ? (i - 4) * 0.72 : 0), s]);
      }
      M.tube(trail, [1.85, 0.52], EEL);
      M.e(head, hr, EEL);
      M.G();
      for (let i = 2; i <= 6; i++) {
        const [a, b, c] = trail[i];
        M.e([a, b + 0.76, c], [0.79, i < 5 ? 1.15 : 0.86, 0.92], SCUTE, [0, -25, 0]);
      }
      M.cone(trail[6], [trail[6][0] - 0.8, trail[6][1] + 2.3, trail[6][2] + 1.15], 0.97, SCUTE);
      const jawLift = p.strike ? -0.75 : 0;
      M.e([head[0] + 1.8, head[1] - 1.15 + jawLift, 0], [2.15, 0.74, 1.48], SCUTE);
      const grate = [f + 0.55, u + 1.15, 0];
      M.G("grate");
      M.box([grate[0] - 1.1, grate[1], 0], [0.39, 0.4, 2.1], GRATE, [0, 20, 0]);
      M.box([grate[0] + 1.0, grate[1] + 1.61, 0], [0.41, 0.39, 2.1], GRATE, [0, 20, 0]);
      for (const s of [-1.73, 0, 1.73]) {
        M.tube([[grate[0] - 1.3, grate[1] - 0.1, s], [grate[0] - 0.25, grate[1] + 1.87, s], [grate[0] + 1.3, grate[1] + 1.1, s]], [0.49, 0.41, 0.4], GRATE);
      }
      M.G();
      both(s => {
        M.eye(surf(head, hr, [0.71, 0.32, 0.82 * s]), 2, "#b5dd76");
        M.cone([head[0] + 2.2, head[1] - 0.62, 1.15 * s], [head[0] + 2.42, head[1] - 1.6, 1.06 * s], 0.55, C.TOOTH);
      });
    },
  },

  /** A crystal quarry mole whose chipped safety lenses grew into its claws. */
  prismmole: {
    size: "m", glow: "#aa96ce",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.1);
      const u = 5.0 + lift + bob(p, 0.65);
      const head = [f + 3.65, u + 1.45 + (p.wind ? 0.85 : 0), 0];
      M.G("hide");
      M.e([f - 0.65, u, 0], [4.9, 3.42, 3.1], MOLE);
      M.e(head, [2.63, 2.42, 2.55], MOLE);
      M.e([head[0] + 1.9, head[1] - 1.16, 0], [1.48, 0.95, 1.35], MOLE);
      M.G();
      M.box([head[0] + 1.28, head[1] + 0.64, 0], [1.05, 1.0, 2.35], VISOR, [0, -18, 0]);
      M.box([head[0] + 2.16, head[1] + 0.77, 0], [0.38, 0.62, 1.89], p.wind ? REFRACTION : LENS, [0, -18, 0]);
      M.box([head[0] + 2.29, head[1] + 1.04, 0], [0.49, 0.34, 0.25], VISOR, [0, -18, 0]);
      both(s => {
        const [stride, toe] = gait(p, s === 1 ? 0.5 : 0);
        M.e([f - 2.7 - stride, 1.05 + toe, 2.25 * s], [1.77, 0.96, 1.34], MOLE);
        const reach = stride * 0.95 + (p.strike ? 1.7 : p.wind ? -0.7 : 0);
        const drill = [f + 3.45 + reach, 1.95 + toe + (p.wind ? 1.9 : 0), 2.85 * s];
        M.tube([[f + 1.33, u + 0.1, 2.35 * s], drill], [1.55, 1.16], MOLE);
        M.G("drill" + s);
        M.box(drill, [1.15, 0.87, 1.02], VISOR, [s * 13, p.wind ? 17 : 0, 0]);
        M.cone([drill[0] + 0.35, drill[1], drill[2]], [drill[0] + 3.15, drill[1] + (p.wind ? 0.8 : -0.56), drill[2] + 0.52 * s], 1.2, p.strike ? REFRACTION : LENS);
        M.G();
      });
    },
  },
};
