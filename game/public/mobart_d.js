/**
 * Monsters of 단풍 왕도, the fallen kingdom's autumn forest (see mobart.js for how they are drawn).
 * Everything here caught the blight that came up through the roots from the abyss: animals
 * and plants alike sprout violet rot, glowing veins and eyes where no eyes should be.
 */
import { mat, C, bez, gait, bob, lunge, legs4, teeth, tentacle, surf, both, pitchPt } from "./mobart_kit.js";

// ── autumn: rust fur, bark, straw and old royal blue; the blight's violet is the one accent that glows
const BLIGHT = mat("#b06ad8", { role: "glow" }), ROT = mat("#5a2a6a", { wet: true }), ROTL = mat("#8a4aa8", { wet: true });
const FUR = mat("#b8642e"), FURD = mat("#7a3c24"), FURL = mat("#e8b47a");
const BARK = mat("#6a4e3a"), BARKD = mat("#43302a"), RING = mat("#d8b47a"), RINGD = mat("#a8804a"), FUNGUS = mat("#e0a848");
const LEAF = mat("#c8502c"), LEAFG = mat("#d89a30");
const STRAW = mat("#d8b45a"), STRAWD = mat("#a8843a"), SACK = mat("#b49a74"), TABARD = mat("#34508e"), TABARDD = mat("#203266"), POLE = mat("#5a4030");
const CROWB = mat("#2e2a3e"), BEAKY = mat("#c8a050");
const HOG = mat("#5a4434"), HOGD = mat("#3a2a24"), CAPR = mat("#c8402e"), CAPS = mat("#f0e4d0", { role: "keep" }), STALK = mat("#e4d8c4");
const ROSE = mat("#b01e34"), ROSED = mat("#6a0e1e"), BRIAR = mat("#2e4430"), BRIARL = mat("#4a6a3a"), THORN = mat("#9a5ad0");
const STAG = mat("#7a6656"), STAGD = mat("#4e4038"), STAGL = mat("#b8a68c"), CROWN = mat("#c8a040", { role: "keep" }), CAPE = mat("#2c4478"), BRANCH = mat("#5a4636");

/** An eye opened in bark or rot: a violet ring round a pale eye. */
const blightEye = (M, c, n = 2) => { M.s(c, 0.9, ROTL); M.eye(c, n, "#c868ff"); };

export const BEASTS_D = {
  /** 한 꼬리 다람쥐떼 — five squirrels grown into the root of one enormous tail, gone violet and soft with rot; they move as one, in bounds. */
  blightsquirrel: {
    size: "m", glow: "#b06ad8", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const hop = p.walk ? Math.sin(p.ph * Math.PI * 2) * 1.6 + 1.2 : 0;
      const f0 = lf, u0 = 3 + lu + hop;
      // the tail: a great plume curling up and over, rust at the root, rotted violet toward the tip
      const tail = bez([f0 - 2, u0 + 2, 0], [f0 - 9, u0 + 12, 0], [f0 + 1, u0 + 15 + (p.idle ? 0.6 : 0), 0], 8);
      tail.forEach((q, i) => {
        const r = 2.6 + Math.sin((i / 8) * Math.PI) * 2;
        M.s(q, r, i < 3 ? FUR : i < 6 ? FURD : ROT);
        if (i >= 4 && i % 2 === 0) M.dot([q[0] + 0.6, q[1] + r * 0.7, r * 0.4], "#d6a0ff");
      });
      blightEye(M, [tail[6][0] + 1.4, tail[6][1] + 1, 1.6]);
      blightEye(M, [tail[4][0] - 1.6, tail[4][1] + 2, -1.8], 1);
      // five little bodies round the root, each facing its own way, all on the same tail
      const S = [[3.2, 0, 0, 0], [1.4, 0, 2.8, 30], [1.4, 0, -2.8, -30], [-0.8, 1.6, 2.2, 70], [-0.8, 1.6, -2.2, -70]];
      S.forEach(([f, u, s, yaw], i) => {
        const b = [f0 + f, u0 + u, s], a = (yaw * Math.PI) / 180, fd = [Math.cos(a), 0, Math.sin(a)];
        M.e(b, [1.8, 1.6, 1.4], i % 2 ? FUR : FURD, [yaw, 10, 0]);
        M.e([b[0] + fd[0] * 0.9, b[1] - 0.6, b[2] + fd[2] * 0.9], [1.1, 1, 1], FURL);
        const h = [b[0] + fd[0] * 1.8, b[1] + 1.6 + (p.strike && i === 0 ? -0.8 : 0), b[2] + fd[2] * 1.8];
        M.s(h, 1.2, FUR);
        M.cone([h[0] - fd[0] * 0.3, h[1] + 0.8, h[2] - 0.5], [h[0] - fd[0] * 0.4, h[1] + 2, h[2] - 0.6], 0.4, FURD);
        M.cone([h[0] - fd[0] * 0.3, h[1] + 0.8, h[2] + 0.5], [h[0] - fd[0] * 0.4, h[1] + 2, h[2] + 0.6], 0.4, FURD);
        M.eye([h[0] + fd[0] * 1, h[1] + 0.2, h[2] + fd[2] * 1], 1, i === 0 ? "#ff3030" : "#c868ff");
        // tiny paws, scrabbling
        const [sw, up] = gait(p, i * 0.2);
        M.s([b[0] + fd[0] * 1.2 + sw * 0.4, Math.max(0.4, up * 0.8 + 0.4), b[2] + fd[2] * 1.2 + 0.6], 0.5, FURD);
      });
    },
  },

  /** 아가리 그루터기 — the stump of a royal oak that walked off on its roots; its rings split down the middle into a mouth. */
  stumpmaw: {
    size: "l", glow: "#b06ad8", k: 1.15,
    draw(M, p) {
      const [lf, lu] = lunge(p, 0.8);
      const f0 = lf * 0.6, u0 = 4 + lu + bob(p, 0.5), lean = p.wind ? 12 : p.strike ? -12 : 0;
      const P = (c) => pitchPt(c, -lean, [f0, 1, 0]);
      // roots for legs, shuffling
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3, [sw, up] = gait(p, i / 6);
        const top = [f0 + Math.cos(a) * 3.4, u0 + 1, Math.sin(a) * 3.4], ft = [f0 + Math.cos(a) * 6.4 + sw * 0.8, up * 1.2, Math.sin(a) * 6.4];
        M.tube([top, [(top[0] + ft[0]) / 2, u0 * 0.8 + 1, (top[2] + ft[2]) / 2], ft], [1.9, 1.3, 0.7], i % 2 ? BARK : BARKD);
      }
      M.G("body");
      for (let j = 0; j < 4; j++) M.e(P([f0, u0 + 2 + j * 2.6, 0]), [5.2 - j * 0.2, 2.2, 5.2 - j * 0.2], j === 1 ? BARKD : BARK);
      M.G();
      // the top: rings showing, a crown of dead twigs and a few last leaves
      const top = P([f0, u0 + 11, 0]);
      M.e(top, [4.2, 0.7, 4.2], RING);
      M.e([top[0], top[1] + 0.3, 0], [2.4, 0.5, 2.4], RINGD);
      M.e([top[0], top[1] + 0.5, 0], [0.9, 0.4, 0.9], RING);
      for (const [a, h] of [[0.6, 4], [2.2, 3], [3.6, 5], [5, 3.4]]) M.tube([[top[0] + Math.cos(a) * 2.8, top[1], Math.sin(a) * 2.8], [top[0] + Math.cos(a) * 4, top[1] + h, Math.sin(a) * 4]], [0.5, 0.3], BARKD);
      for (const [a, h] of [[0.6, 4], [3.6, 5]]) M.s([top[0] + Math.cos(a) * 4, top[1] + h + 0.4, Math.sin(a) * 4], 0.9, a < 1 ? LEAF : LEAFG);
      // the mouth: the trunk splits down its front, ringed with splinter teeth
      const open = p.strike ? 1.4 : p.wind ? 1.1 : p.idle ? 0.75 : 0.6;
      const mc = P([f0 + 4.2, u0 + 6, 0]);
      M.e(mc, [1, 4 * open + 0.6, 1 + open], C.MAW, [0, lean, 0]);
      both((s) => { for (let i = 0; i < 4; i++) M.cone(P([f0 + 4.6, u0 + 3.4 + i * 1.8, s * (1.2 + open)]), P([f0 + 4.9, u0 + 3.6 + i * 1.8, s * 0.2]), 0.5, C.TOOTH); });
      M.e(P([f0 + 4.2, u0 + 3.6, 0]), [0.8, 1, 0.8], C.TONGUE);
      // shelf fungus and the blight's eyes in the bark
      both((s) => M.e(P([f0 + 1.6, u0 + 8.6, s * 4.2]), [1.6, 0.5, 1.2], FUNGUS, [0, 0, s * 20]));
      blightEye(M, P([f0 + 3.4, u0 + 9.4, -2.6]), 2);
      blightEye(M, P([f0 + 3.2, u0 + 9, 2.8]), 2);
      blightEye(M, P([f0 - 1.6, u0 + 5, 4.2]), 1);
      M.dot(P([f0 + 4.4, u0 + 1.2, -2.4]), "#d6a0ff", 1, 2);
    },
  },

  /** 까마귀 허수아비 — a scarecrow in a royal tabard, its straw belly torn open and full of crows; it hops on its one pole and throws them. */
  crowscare: {
    size: "l", glow: "#ff6a40",
    draw(M, p) {
      const hop = p.walk ? Math.abs(Math.sin(p.ph * Math.PI * 2)) * 2 : 0;
      const [lf, lu] = lunge(p, 0.8);
      const f0 = lf * 0.5, u0 = 10 + lu + hop + (p.idle ? 0.3 : 0), sway = p.walk ? Math.sin(p.ph * Math.PI * 2) * 8 : p.wind ? -10 : p.strike ? 12 : 0;
      M.tube([[f0, hop, 0], [f0, u0 + 8, 0]], 0.7, POLE);
      M.G("body");
      M.e([f0, u0 + 2, 0], [2.6, 4.2, 3.2], STRAW, [0, 0, sway * 0.3]);
      M.e([f0 + 0.4, u0 + 2.4, 0], [2.4, 3.8, 3.4], TABARD, [0, 0, sway * 0.3]);
      M.G();
      // the tabard's crown, and the rent where the crows come out
      M.dot([f0 + 2.8, u0 + 4, 0], "#d8b050", 2, 1); M.dot([f0 + 2.8, u0 + 4.6, -0.6], "#d8b050"); M.dot([f0 + 2.8, u0 + 4.6, 0.6], "#d8b050");
      M.e([f0 + 2.2, u0 + 1, 0], [0.8, 1.8, 1.4], C.MAW);
      for (const [a, b, s] of [[0, 0.4, -0.6], [0.4, -0.6, 0.5]]) { M.s([f0 + 2.8 + a, u0 + 1 + b, s], 0.9, CROWB); M.cone([f0 + 3.4 + a, u0 + 1 + b, s], [f0 + 4.4 + a, u0 + 0.8 + b, s], 0.35, BEAKY); }
      for (let i = 0; i < 6; i++) M.cone([f0 - 0.4, u0 - 2, (i - 2.5) * 0.9], [f0 - 0.6 + (i % 2) * 0.6, u0 - 4.2 - (i % 3) * 0.6, (i - 2.5) * 1.2], 0.45, STRAWD);
      // the crossbar for arms, straw hanging from the sleeves, a crow on each end
      const arm = (s) => [f0 + 0.6, u0 + 5 + (s * sway) / 12, s * 7];
      M.tube([arm(-1), [f0 + 0.6, u0 + 5, 0], arm(1)], 0.6, POLE);
      both((s) => {
        M.e([f0 + 0.6, u0 + 4.8, s * 4.4], [1.4, 1.2, 2.6], TABARDD);
        const e = arm(s);
        for (let i = 0; i < 3; i++) M.cone([e[0], e[1] - 0.4, e[2]], [e[0] + (i - 1) * 0.6, e[1] - 2.2, e[2] + s * 0.4], 0.35, STRAW);
        const cb = [e[0] - 0.2, e[1] + 1.4 + (p.wind ? 0.8 : 0), e[2] - s * 0.6];
        M.e(cb, [1.4, 1, 0.9], CROWB);
        M.s([cb[0] + 1.2, cb[1] + 0.8, cb[2]], 0.75, CROWB);
        M.cone([cb[0] + 1.8, cb[1] + 0.7, cb[2]], [cb[0] + 2.8, cb[1] + 0.4, cb[2]], 0.3, BEAKY);
        M.eye([cb[0] + 1.6, cb[1] + 1.1, cb[2] + s * 0.5], 1, "#ff4030");
      });
      // the sack head, stitched mouth, button eyes that burn, a ragged hat
      const H = [f0 + 0.6, u0 + 9, 0], HR = [2.6, 2.8, 2.6];
      M.e(H, HR, SACK, [0, 0, sway * 0.4]);
      M.seam([surf(H, HR, [0.8, -0.3, -0.6]), surf(H, HR, [0.95, -0.35, 0]), surf(H, HR, [0.8, -0.3, 0.6])], "#3a2630");
      both((s) => M.eye(surf(H, HR, [0.7, 0.25, s * 0.55]), 2, "#ff6a30"));
      M.e([H[0] - 0.2, H[1] + 2.6, 0], [3.8, 0.5, 3.8], STRAWD);
      M.e([H[0] - 0.4, H[1] + 3.6, 0], [2, 1.4, 2], STRAWD, [0, -10, 8]);
    },
  },

  /** 버섯등 멧돼지 — a boar whose back has become a bed of toadstools; it charges, and its caps puff poison where it stops. */
  shroomboar: {
    size: "m", n: 58, glow: "#b06ad8",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.4);
      const f0 = lf, u0 = 6.2 + lu + bob(p, 0.6) - (p.wind ? 0.6 : 0);
      legs4(M, p, { ff: f0 + 3.2, bf: f0 - 3.4, w: 2.4, hu: u0 - 1.6, r: 1.2, m: HOG, foot: HOGD, st: 2.2 });
      M.G("body");
      M.e([f0, u0, 0], [5.4, 4, 4], HOG);
      M.e([f0 + 3, u0 + 0.6, 0], [3.2, 3.8, 3.6], HOG);
      M.G();
      M.e([f0 - 0.6, u0 + 3.2, 0], [4.6, 1.2, 3], ROT);
      // the mushrooms: red caps flecked white, and the blight's violet among them
      [[2.4, 0, 1.6, 0], [0.4, 1.4, 1.3, 1], [-1.4, -1.2, 1.4, 0], [-3.2, 0.6, 1.1, 1], [1, -1.8, 1, 0], [-0.8, 2, 1, 0], [3.4, 1.4, 0.9, 1]].forEach(([f, s, r, v], i) => {
        const b = [f0 + f, u0 + 3.6 + (i % 3) * 0.3, s];
        const h = 1.4 + r * 1.2 + (p.idle ? 0.2 : 0);
        M.tube([b, [b[0], b[1] + h, b[2]]], [0.45, 0.35], STALK);
        const cap = [b[0], b[1] + h + 0.3, b[2]];
        M.e(cap, [r * 1.3, r * 0.7, r * 1.3], v ? ROTL : CAPR);
        if (!v) M.dot([cap[0] + 0.4, cap[1] + r * 0.5, cap[2] - 0.4], "#f0e4d0");
        else M.dot([cap[0], cap[1] + r * 0.5, cap[2]], "#e0b8ff");
      });
      if (p.wind || p.strike) for (let i = 0; i < 5; i++) M.dot([f0 - 1 + i, u0 + 9 + (i % 2), (i - 2) * 0.8], "#c890ff");
      // the head, low, with tusks
      const hf = f0 + 6.2 + (p.strike ? 1 : 0), hu = u0 - 0.4 - (p.wind ? 1.4 : 0), H = [hf, hu, 0], HR = [2.8, 2.6, 2.6];
      M.e(H, HR, HOG, [0, -16, 0]);
      M.e([hf + 2.8, hu - 1.2, 0], [1.3, 1.5, 1.7], HOGD, [0, -10, 0]);
      both((s) => {
        M.tube(bez([hf + 2, hu - 1.8, s * 1.6], [hf + 3.6, hu - 2, s * 2.8], [hf + 3.4, hu + 0.6, s * 3], 5), [0.7, 0.3], C.BONE);
        M.eye(surf(H, HR, [0.45, 0.4, s * 0.75]), 2, "#c868ff");
        M.e([hf - 1.4, hu + 2.4, s * 1.8], [0.9, 1.4, 0.5], HOGD, [0, -30, s * 20]);
      });
      M.tube([[f0 - 5.2, u0 + 1, 0], [f0 - 6.4, u0 + 0.2, 0.6]], [0.5, 0.3], HOGD);
    },
  },

  /** 묘지 장미 — a rosebush from the royal graveyard that learned to walk on its briars; its biggest bloom opens on teeth. */
  gravrose: {
    size: "m", glow: "#b06ad8",
    draw(M, p) {
      const [lf, lu] = lunge(p, 0.8);
      const f0 = lf * 0.7, u0 = 5.6 + lu + bob(p, 0.4);
      // briar legs, curling: thorns violet with the blight
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, ph = (p.walk ? p.ph : p.idle * 0.15) + i * 0.17;
        const end = tentacle(M, [f0 + Math.cos(a) * 2, u0 - 1.6, Math.sin(a) * 2], [Math.cos(a) * 0.9, -0.7, Math.sin(a) * 0.9], 6, 0.8, BRIAR, ph, 0.7, 6);
        M.cone(end, [end[0] + Math.cos(a) * 0.8, end[1] + 0.8, end[2] + Math.sin(a) * 0.8], 0.3, THORN);
      }
      // the bush
      M.G("body");
      M.e([f0, u0 + 2, 0], [4.6, 3.6, 4.6], BRIAR);
      M.G();
      for (const [f, u, s, r] of [[2, 4, 2.6, 1.8], [-2, 4.6, -2, 2], [0.4, 5.6, -0.4, 1.8], [-2.6, 2.4, 2.8, 1.6], [2.6, 2, -3, 1.6], [-0.6, 3, 4, 1.4]]) M.s([f0 + f, u0 + u, s], r, BRIARL);
      for (const [f, u, s] of [[3.6, 3, -1.6], [-3.6, 4, 1.6], [1, 6.6, 2.4], [-1.6, 6.4, -2.6]]) M.cone([f0 + f * 0.8, u0 + u, s * 0.8], [f0 + f * 1.15, u0 + u + 0.6, s * 1.15], 0.35, THORN);
      // roses, small, and the great one in front that opens
      for (const [f, u, s] of [[-1.6, 6.8, 2.2], [-3, 4.6, -2.4], [1.6, 6.2, -2.6], [-0.4, 3, 4.2]]) { M.s([f0 + f, u0 + u, s], 1.2, ROSE); M.s([f0 + f + 0.3, u0 + u + 0.3, s], 0.6, ROSED); }
      const open = p.strike ? 1.4 : p.wind ? 1.1 : 0.7;
      const R0 = [f0 + 4, u0 + 4.4 + (p.wind ? 0.8 : 0), 0];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; M.e([R0[0], R0[1] + Math.cos(a) * 1.8 * open, Math.sin(a) * 1.8 * open], [0.9, 1.4, 1.4], ROSE, [0, 0, (a * 180) / Math.PI]); }
      M.e([R0[0] + 0.5, R0[1], 0], [0.6, 1.2 * open, 1.2 * open], C.MAW);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5; M.cone([R0[0] + 0.7, R0[1] + Math.cos(a) * 1.3 * open, Math.sin(a) * 1.3 * open], [R0[0] + 1.1, R0[1] + Math.cos(a) * 0.5 * open, Math.sin(a) * 0.5 * open], 0.35, C.TOOTH); }
      blightEye(M, [f0 + 2.6, u0 + 1.2, 2.6], 1);
      blightEye(M, [f0 + 1.2, u0 + 6.2, -2.2], 2);
    },
  },

  /** 썩은 관 사슴왕 — the old king's quarry, crowned in death: its antlers grew into blighted branches thick with eyes, his tattered banner still on its back. */
  rotstag: {
    size: "xl", glow: "#b06ad8", k: 1.15,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.6);
      const rear = p.wind ? 1 : 0, f0 = lf, u0 = 13 + lu + bob(p, 0.8) + rear * 2;
      const pit = rear ? 18 : p.strike ? -10 : 0, P = (c) => pitchPt(c, pit, [f0 - 4, u0, 0]);
      // legs: long, the hide worn through to bone at the knees
      both((s) => {
        for (const [ff, off, front] of [[f0 + 4.6, s < 0 ? 0 : 0.5, 1], [f0 - 5.2, s < 0 ? 0.5 : 0, 0]]) {
          let [sw, up] = gait(p, off);
          if (p.strike) sw = front ? 1 : -0.3;
          const top = P([ff, u0 - 2.2, s * 2.6]);
          const ft = p.dead ? [ff + (front ? 2.6 : -2.6), 2.4, s * 3.2] : front && rear ? [ff + 3, top[1] - 3, s * 2.6] : [ff + sw * 3, up * 2, s * 2.7];
          const kn = front ? [(top[0] + ft[0]) / 2 + 0.6, (top[1] + ft[1]) / 2, s * 2.6] : [(top[0] + ft[0]) / 2 - 2.2, (top[1] + ft[1]) * 0.45, s * 2.6];
          M.tube([top, kn, ft], [1.4, 0.9, 0.7], STAG);
          M.s(kn, 0.8, C.BONE);
          M.s([ft[0] + 0.3, ft[1] + 0.5, ft[2]], 0.85, STAGD);
        }
      });
      M.G("body");
      M.e(P([f0, u0, 0]), [7.4, 4.2, 4], STAG, [0, pit, 0]);
      M.e(P([f0 + 4.6, u0 + 0.8, 0]), [3.6, 4.6, 3.8], STAG, [0, pit, 0]);
      M.G();
      M.e(P([f0 - 0.4, u0 - 3, 0]), [5.4, 1, 2.6], STAGL, [0, pit, 0]);
      // the rot along its flank: ribs showing through violet flesh
      both((s) => {
        M.e(P([f0 - 1.4, u0 + 0.4, s * 3.4]), [3.2, 2.4, 0.8], ROT, [0, pit, 0]);
        for (let i = 0; i < 4; i++) M.tube([P([f0 - 3.6 + i * 1.4, u0 + 2.4, s * 3.6]), P([f0 - 3.4 + i * 1.4, u0 - 1.6, s * 3.9])], 0.38, C.BONE);
      });
      blightEye(M, P([f0 - 1, u0 + 1, -4.2]), 2);
      // the king's banner, rotted, laid over its back like a saddle-cloth
      M.e(P([f0 - 1, u0 + 3.4, 0]), [4.4, 1, 4.4], CAPE, [0, pit, 0]);
      both((s) => { for (let i = 0; i < 4; i++) M.e(P([f0 - 3.6 + i * 2.2, u0 + 1.2 - (i % 2) * 0.8, s * 4.3]), [1, 2, 0.4], i % 2 ? CAPE : TABARDD, [0, pit, 0]); });
      M.dot(P([f0 - 1, u0 + 4.5, 0]), "#d8b050", 2, 1);
      M.tube([P([f0 - 7.2, u0 + 1.6, 0]), P([f0 - 8.6, u0 + 2.8, 0])], [1, 0.5], STAGL);
      // neck and head
      const nb = P([f0 + 6, u0 + 3, 0]), hd = P([f0 + 9.6 + (p.strike ? 2 : 0), u0 + 9 - (p.strike ? 4 : 0) + (p.hurt ? 0.8 : 0), 0]);
      M.tube([nb, [nb[0] + 2, (nb[1] + hd[1]) / 2, 0], [hd[0] - 1.2, hd[1] - 0.8, 0]], [2.2, 1.6], STAG);
      const HR = [2.6, 2.3, 2];
      M.e(hd, HR, STAG, [0, -20, 0]);
      M.e([hd[0] + 2.8, hd[1] - 1.6, 0], [2, 1.2, 1.3], STAGD, [0, -24, 0]);
      M.e([hd[0] + 1.6, hd[1] - 1, 0], [1.4, 0.8, 1.4], C.BONE, [0, -24, 0]);
      both((s) => {
        M.eye(surf(hd, HR, [0.3, 0.2, s * 0.9]), 2, "#c868ff");
        M.e([hd[0] - 1.2, hd[1] + 1.6, s * 2.2], [0.7, 1.6, 0.5], STAG, [0, -40, s * 40]);
      });
      // the crown, rusted gold, sunk between the antlers
      const cr = [hd[0] - 0.6, hd[1] + 2.2, 0];
      M.e(cr, [1.8, 0.7, 1.8], CROWN);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; M.cone([cr[0] + Math.cos(a) * 1.5, cr[1] + 0.4, Math.sin(a) * 1.5], [cr[0] + Math.cos(a) * 1.6, cr[1] + 1.6, Math.sin(a) * 1.6], 0.35, CROWN); }
      // antlers: dead branches, forking, every fork with an eye; violet buds at the tips
      const sway = p.idle ? 0.3 : p.wind ? -0.6 : 0;
      both((s) => {
        const a0 = [hd[0] - 0.6, hd[1] + 2, s * 1.2], a1 = [hd[0] - 1.6 + sway, hd[1] + 6, s * 4], a2 = [hd[0] - 3.4 + sway, hd[1] + 9.6, s * 5.6];
        M.tube([a0, a1, a2], [0.8, 0.6, 0.45], BRANCH);
        const b1 = [hd[0] + 1.6 + sway, hd[1] + 8.4, s * 3.4], b2 = [hd[0] - 5.6, hd[1] + 7.4, s * 7.4], b3 = [hd[0] - 1.4, hd[1] + 11.6, s * 4.4];
        M.tube([a1, b1], [0.5, 0.35], BRANCH);
        M.tube([a2, b2], [0.45, 0.3], BRANCH);
        M.tube([a2, b3], [0.45, 0.3], BRANCH);
        M.eye(a1, 2, "#c868ff");
        M.eye([a2[0] + 0.2, a2[1], a2[2]], 1, "#ff3030");
        for (const t of [b1, b2, b3]) M.s(t, 0.7, BLIGHT);
        M.s([b2[0] + 0.6, b2[1] - 0.8, b2[2]], 0.6, LEAF);
      });
    },
  },
};
