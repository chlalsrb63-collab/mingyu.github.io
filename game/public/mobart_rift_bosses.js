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

const ASH = mat("#443e52");
const GILD = mat("#b89965");
const PATINA = mat("#535f65");

const IRON = mat("#444858");
const TIN = mat("#778794");
const COPPER = mat("#b66c43");
const CLOTH = mat("#b94b5e", { flat: true });
const ARC = mat("#77eee8", { role: "glow" });

const SCALES = mat("#345c64", { wet: true });
const EEL_BELLY = mat("#768666");
const RUST = mat("#925b49");
const LURE = mat("#d7ec83", { role: "glow" });

const VELVET = mat("#503951");
const MEMBRANE = mat("#68577d", { flat: true });
const QUARTZ = mat("#96cddd");
const AMETHYST = mat("#957adc");

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

  // The open rib cage is the bell's yoke. Its clapper swings ahead of the hound's jaw.
  knellkeeper: {
    size: "xl", glow: "#d7b981",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.4);
      const u = 11 + bob(p, 0.8) + lift;
      legs4(M, p, { ff: f + 5.7, bf: f - 6.9, w: 3.15, hu: u - 0.65, r: 1.58, st: 3.3, li: 1.5, m: C.BONEB, foot: ASH });
      M.G("spine");
      M.e([f - 6.6, u - 0.6, 0], [3.75, 3.15, 3.45], ASH);
      M.e([f + 4.6, u + 0.45, 0], [3.65, 3.75, 3.9], ASH);
      M.tube([[f - 8.7, u + 0.8, 0], [f - 4, u + 3.1, 0], [f + 3.5, u + 4.2, 0]], [1.55, 1.25], C.BONE);
      M.tube([[f - 8.7, u + 0.85, 0], [f - 11.8, u + 2.25, -0.75], [f - 13.2, u + 4.7, -1.8]], [1.2, 0.55], C.BONEB);
      M.G();
      for (let i = 0; i < 3; i++) {
        const x = f - 5.35 + i * 3.15;
        both(s => M.tube([[x, u + 3.45, 0], [x, u + 2.55, s * 3.05], [x - 0.9, u - 0.05, s * 4.35], [x - 2, u - 3.1, s * 3.2]], [0.82, 1.15, 0.95, 0.5], C.BONE));
      }
      const swing = p.strike ? 2.8 : p.wind ? -1.7 : p.walk ? Math.sin(p.ph * Math.PI * 2) * 0.95 : 0;
      const bell = [f - 1.6 + swing, u - 2.95, 0];
      M.G("bell");
      M.tube([[f - 1.6, u + 3.4, 0], [bell[0], bell[1] + 2.25, 0]], [0.8, 0.65], PATINA);
      M.e(bell, [2.65, 3.15, 2.6], GILD, [0, -swing * 10, 0]);
      M.e([bell[0] + swing * 0.22, bell[1] - 2.15, 0], [3.1, 0.8, 2.95], PATINA, [0, swing * 5, 0]);
      M.s([bell[0] + swing * 0.45, bell[1] - 3.35, 0], 0.9, GILD);
      M.G("skull");
      const h = [f + 7.4, u + 3.4 - p.wind * 1.45, 0];
      M.e(h, [3.55, 2.7, 2.8], C.BONE);
      M.e([h[0] + 3.1, h[1] - 1.4, 0], [3.3, 0.95, 1.78], C.BONEB);
      M.G();
      const jawY = h[1] - 2.5 - p.strike * 1.2;
      M.e([h[0] + 2.6, jawY, 0], [2.65, 0.63, 1.5], C.BONE, [0, -p.strike * 13, 0]);
      both(s => {
        M.e([h[0] + 1.7, h[1] + 0.25, s * 2.22], [1.15, 0.95, 0.65], C.MAW);
        M.eye([h[0] + 1.75, h[1] + 0.28, s * 2.84], 1, "#f9c172");
        M.cone([h[0] - 1.6, h[1] + 1.6, s * 1.62], [h[0] - 3, h[1] + 4.8, s * 2.6], 0.95, ASH);
        teeth(M, [h[0] + 2.2, h[1] - 1.65, s * 1.52], [h[0] + 5.6, h[1] - 1.65, s * 1.24], 3, 1, 1.22);
      });
    },
  },

  // The unequal loom pylons bracket a sparrow engine with long iron knees.
  loomcolossus: {
    size: "xl", n: 104, glow: "#6dd5cf", death: "burst",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.45);
      const u = 12.25 + lift + bob(p, 0.6);
      both(s => {
        const [sw, up] = gait(p, s === 1 ? 0.5 : 0);
        const knee = [f + 3.2 + sw * 2, u - 6.3 + up, s * 4.45];
        const pad = [f - 0.3 + sw * 4, 0.65 + up * 2.25, s * 5.2];
        M.G("leg" + s);
        M.tube([[f - 1.85, u - 2, s * 3.7], knee, pad], [1.35, 1.08, 0.8], IRON);
        M.s(knee, 1.55, COPPER);
        M.box([pad[0] + 0.8, pad[1], pad[2]], [1.9, 0.7, 1.3], TIN);
        M.G();
      });
      M.G("frame");
      M.box([f - 2, u + 0.2, 0], [5.9, 3.25, 4.25], IRON, [0, 12, 0]);
      M.e([f + 1.7, u + 1.4, 0], [4.85, 3.4, 3.55], TIN);
      M.box([f - 4, u + 2.6, 0], [2.75, 1.4, 5], COPPER);
      M.G("head");
      const h = [f + 6.4 + p.strike * 1.8, u + 3.55 - p.wind, 0];
      M.tube([[f + 2, u + 1.1, 0], [f + 4.15, u + 3.7, 0], h], [1.7, 1.15], IRON);
      M.box(h, [2.4, 1.85, 1.85], TIN, [0, -12, 0]);
      M.cone([h[0] + 1.85, h[1] - 0.15, 0], [h[0] + 5.25, h[1] - 1.5, 0], 1.38, COPPER);
      M.G();
      both(s => {
        M.eye([h[0] + 0.9, h[1] + 0.26, s * 1.9], 2, "#8cf5de");
        const tall = s === -1 ? 12.4 : 9.8;
        const top = [f - 1 + p.wind * 1.8, u + tall, s * 5.5];
        M.G("pylon" + s);
        M.tube([[f - 4, u + 1, s * 3.75], [f - 5.4, u + tall - 2.15, s * 4.9], top], [1.5, 0.95, 0.75], IRON);
        M.s(top, 1.45, COPPER);
        M.s([top[0], top[1] + 0.85, top[2]], p.wind ? 1.15 : 0.75, ARC);
        M.G("ribbon" + s);
        const end = [f - 12.4 - p.strike * 2.6, u + 1.2 + (s === 1 ? 2 : 0), s * 5.5];
        const roll = p.strike ? -23 : p.wind ? 18 : (s === 1 ? 8 : -13);
        M.box([f - 6.25, u + tall - 3.25, s * 5.45], [2, 3.3, 0.35], CLOTH, [0, -35, 0]);
        M.box([f - 9.3, u + tall - 6.8, s * 5.5], [2.9, 2.5, 0.35], CLOTH, [0, -30 + roll, 0]);
        M.cone([f - 10.1, u + tall - 7.3, s * 5.5], end, 1.25, CLOTH);
        M.G();
      });
    },
  },

  // A drain collar frames the coil. The low jaws and the high lure point in opposite directions.
  sluiceleviathan: {
    size: "xl", n: 100, glow: "#b9d877", death: "melt",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.55);
      const u = lift + bob(p, 0.6);
      M.G("iron collar");
      const ring = [];
      for (let i = 0; i <= 12; i++) {
        const a = i * Math.PI / 6;
        ring.push([f - 3.2, 8 + Math.cos(a) * 5.6, Math.sin(a) * 6.05]);
      }
      M.tube(ring, 1.55, RUST);
      both(s => M.box([f - 3.3, 3.1, s * 6.25], [1.3, 1.25, 1.65], PATINA));
      M.G("eel");
      const wave = p.walk ? Math.sin(p.ph * Math.PI * 2) : 0;
      const head = [f + 7.8 + 1.5 * p.strike, 7.4 + u, -1.6];
      const coil = [head, [f + 3.3, 5.8 + u, 2.8], [f + 0.25, 5.15, 4.95], [f - 4.6, 4.25, 3.75], [f - 8, 4.1, -0.2], [f - 7.3, 5.5, -4.8], [f - 3.8, 7.8, -3.6], [f - 3.9, 11.1, 0.35 + wave]];
      M.tube(coil, [2.6, 1.05], SCALES);
      for (let i = 1; i < coil.length - 1; i++) {
        const [x, y, s] = coil[i];
        M.e([x, y + 0.7, s], [1.75 - i * 0.095, 1.6, 1.8 - i * 0.1], i % 2 ? PATINA : RUST);
      }
      const tail = coil[coil.length - 1];
      const lure = [f - 12.25 + p.wind * 0.9, 13.25 + p.wind * 2, 3.35 + wave * 2];
      M.tube(bez(tail, [f - 4.65, 16.8, 2.15 + wave], lure, 4), [1.65, 0.56], SCALES);
      M.e(lure, [1.55, 1.25, 1.25], LURE);
      M.G("jaw");
      const [hf, hu, hs] = head;
      M.e(head, [3.55, 2.5, 2.65], SCALES);
      M.e([hf + 2.25, hu - 0.75, hs], [2.7, 1.35, 1.75], EEL_BELLY);
      M.G();
      M.e([hf + 2.3, hu - 2.1, hs], [2.5, 0.65 + p.strike * 0.4, 1.5], C.MAW, [0, p.strike * -12, 0]);
      both(s => {
        M.eye([hf + 0.95, hu + 0.6, hs + s * 2.3], 2, "#edf097");
        M.cone([hf - 0.95, hu + 0.8, hs + s * 1.7], [hf - 4.2, hu + 3.9, hs + s * 2.9], 1.1, EEL_BELLY);
        teeth(M, [hf + 1.65, hu - 1.45, hs + s * 1.5], [hf + 4.3, hu - 1.45, hs + s * 0.95], 3, 1, 1.25);
      });
    },
  },

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
