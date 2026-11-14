/** Monsters of the sewer, the cave and the abyss, the two great bosses, and the treasure chest (see mobart.js). */
import { mat, C, bez, gait, bob, lunge, legs4, teeth, ribs, tentacle, surf, both, rollPt, pitchPt, hand } from "./mobart_kit.js";

// ── sewer: sludge browns, pale drowned skin and sick yellow-green
const LEECH = mat("#4a3448", { wet: true }), LEECHB = mat("#5e4458", { wet: true }), RING = mat("#d07a84", { wet: true });
const GATOR = mat("#4e6a40"), GATORB = mat("#c0c090"), GATORD = mat("#2e4430");
const CRAB = mat("#c85a3a"), CRABD = mat("#8a3426"), SKULL = mat("#e2d6b8");
const EEL = mat("#34404e", { wet: true }), EELB = mat("#5e6a50", { wet: true }), BIGEYE = mat("#f0e8c8", { role: "keep", wet: true });
// ── cave: blind-pale skin, velvet greys, bark brown
const SKIN = mat("#dcbcaa"), SKIND = mat("#b48c7c");
const MOLE = mat("#5a5266"), MOLED = mat("#3a3444"), NOSE = mat("#e89aa4", { wet: true });
const BEAR = mat("#5a4236"), BEARD = mat("#3a2a24");
const OWL = mat("#8a6a50"), OWLL = mat("#d8c4a0"), OWLD = mat("#5a4434");
// ── abyss: bone-white, old blood and the black-red of the deep
const GOAT = mat("#d8d0c0"), GOATD = mat("#a89c8c");
const HORSE = mat("#4a3436"), HORSEM = mat("#2a1e22"), TENDRIL = mat("#e0a8b0", { wet: true });
const LION = mat("#c89a5a"), LIOND = mat("#8a5a34"), ARM = mat("#e0c0a8");
const SERP = mat("#8a3048"), SERPB = mat("#e0c070"), SERPW = mat("#5a2234");
const SOW = mat("#c08a8e"), SOWD = mat("#8a5866"), SORE = mat("#b83a4a", { wet: true, drip: true });
// ── the great ones
const RIFT = mat("#ff72d6", { role: "glow" }), VOID = mat("#1a0a2a", { role: "keep", flat: true }), HIDE = mat("#4a3a4e"), MANE = mat("#6a2a3a"), BULL = mat("#7a5040");
const MOTHER = mat("#b898a8", { wet: true }), MOTHERD = mat("#6e4a6a"), BROOD = mat("#5a2a5a", { wet: true });
const WOOD = mat("#8a5a3a"), WOODD = mat("#5e3a26"), IRON = mat("#6a6a7a"), GOLD = mat("#f0c050", { role: "keep" });

export const BEASTS_C = {
  // ── sewer
  /** 거머리 아가리 — a leech the size of a dog; the whole front of it is a round mouth with teeth all the way down. */
  leechmaw: {
    size: "m", death: "melt", glow: "#b4cc3c", k: 1.25,
    draw(M, p) {
      const [lf] = lunge(p, 1.4);
      const rear = p.wind ? 1 : p.strike ? 0.6 : 0;
      M.G("body");
      for (let i = 0; i < 7; i++) {
        const w = p.walk ? Math.sin((p.ph - i * 0.14) * Math.PI * 2) : 0;
        const f = lf + 3.6 - i * 2 + (p.walk ? Math.max(0, w) * 0.5 : 0), r = 3.1 - Math.abs(i - 2) * 0.3 - (i > 4 ? (i - 4) * 0.3 : 0);
        M.s([f, r + Math.max(0, w) * 1.2 + (i < 2 ? rear * (3 - i) * 1.2 : 0), 0], r, i % 2 ? LEECH : LEECHB);
      }
      M.G();
      for (const [a, b, c] of [[1, 5.4, -1], [-2, 5, 1.2], [-5, 4, -0.6], [-8, 3, 0.8], [2.4, 4.8, 1.6]]) M.dot([lf + a, b, c], "#b4cc3c");
      // the mouth: a ring of pink flesh, teeth turned inward
      const mc = [lf + 6.2 + (p.strike ? 1 : 0), 3.4 + rear * 3.4, 0], open = p.strike ? 1.3 : p.wind ? 1.1 : 0.9;
      M.e(mc, [1.2, 3.2 * open, 3.2 * open], RING, [0, rear * 30, 0]);
      M.e([mc[0] + 0.5, mc[1], mc[2]], [0.6, 1.6 * open, 1.6 * open], C.MAW, [0, rear * 30, 0]);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, cu = Math.cos(a), cs = Math.sin(a); M.cone([mc[0] + 0.6, mc[1] + cu * 2.1 * open, mc[2] + cs * 2.1 * open], [mc[0] + 1, mc[1] + cu * 1 * open, mc[2] + cs * 1 * open], 0.42, C.TOOTH); }
      M.dot([mc[0] + 1, mc[1] - 2.8, 0], "#b4cc3c", 1, 2);
    },
  },

  /** 반쪽 악어 — the front half of an alligator, hauling itself on two legs and dragging the bare spine of the rest. */
  gatorhalf: {
    size: "l", k: 1.15,
    draw(M, p) {
      const rear = p.wind ? 1 : 0;
      const [lf, lu] = lunge(p, 1);
      const f0 = lf, u0 = 3.6 + lu + bob(p, 0.4) + rear * 3;
      const pit = rear * 26 + (p.strike ? -6 : 0), P = (c) => pitchPt(c, pit, [f0 - 3, 1, 0]);
      M.G("body");
      M.e(P([f0, u0, 0]), [5, 2.6, 3.4], GATOR, [0, pit, 0]);
      M.G();
      M.e(P([f0 + 0.4, u0 - 1.2, 0]), [4.6, 1.4, 3], GATORB, [0, pit, 0]);
      for (let i = 0; i < 5; i++) both((s) => M.cone(P([f0 + 3 - i * 1.6, u0 + 2, s * 1.2]), P([f0 + 2.8 - i * 1.6, u0 + 3.2, s * 1.2]), 0.6, GATORD));
      // the cut, and the spine dragging behind
      M.e(P([f0 - 4.6, u0, 0]), [0.8, 2.4, 3.2], C.RAW, [0, pit, 0]);
      const sp = [];
      for (let i = 0; i < 9; i++) sp.push([f0 - 5 - i * 1.3, Math.max(0.7, u0 * (1 - i / 3)), Math.sin((p.walk ? p.ph : 0) * 6.28 + i * 0.6) * (i / 9) * 1.4]);
      sp.forEach((q, i) => { M.s(q, 0.75 - i * 0.03, C.BONE); if (i % 2 === 0) both((s) => M.cone(q, [q[0] + 0.2, q[1] + 0.2, q[2] + s * 1.2], 0.3, C.BONE)); });
      M.tube([P([f0 - 4.6, u0 - 0.4, 0.6]), [f0 - 6, 0.8, 1.6], [f0 - 7.4, 0.5, 2.6]], [0.6, 0.3], C.GUT);
      // two splayed front legs doing all the work
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0 : 0.5);
        const a = p.strike ? 1.4 : sw * 1.8, ft = rear ? [f0 + 5, 3 + u0 * 0.4, s * 5] : [f0 + 2.6 + a, up * 1.4, s * 5.6];
        M.tube([P([f0 + 2.6, u0 - 0.6, s * 2.6]), [f0 + 2.8 + a * 0.5, u0 * 0.5 + 1.4 + up, s * 5], ft], [1.3, 1, 0.9], GATOR);
        hand(M, ft, [1, -0.2, s * 0.3], GATORD, 3, 1.2);
      });
      // the head: long, flat, smiling
      const open = p.strike ? 1 : p.wind ? 0.8 : 0.15;
      const hb = P([f0 + 5, u0 + 0.4, 0]);
      M.e(P([f0 + 6, u0 + 0.4, 0]), [2.2, 1.6, 2.2], GATOR, [0, pit, 0]);
      M.e(P([f0 + 9.6, u0 + 0.4 + open * 0.6, 0]), [3.4, 0.8, 1.6], GATOR, [0, pit + open * 18, 0]);
      M.e(P([f0 + 9.2, u0 - 0.9, 0]), [3.2, 0.6, 1.4], GATORB, [0, pit - open * 10, 0]);
      M.e(P([f0 + 9, u0 - 0.2, 0]), [3, 0.5 + open * 0.5, 1.2], C.MAW, [0, pit, 0]);
      both((s) => { teeth(M, P([f0 + 7, u0 - 0.1, s * 1.3]), P([f0 + 12, u0 + 0.1, s * 1.1]), 4, 1, 0.8); M.s(P([f0 + 6.4, u0 + 1.8, s * 1.1]), 0.9, GATOR); M.eye(P([f0 + 6.8, u0 + 2.3, s * 1.2]), 2, "#e8c020"); });
      void hb;
    },
  },

  /** 두개골 게 — a crab that moved into a skull too big for anything alive, and grew more claws than it can count. */
  crabskull: {
    size: "l", glow: "#ff5a5a",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.6);
      const f0 = lf, u0 = 7 + lu + bob(p, 0.6) - (p.wind ? 1 : 0);
      // legs first: four a side, jointed high
      both((s) => {
        for (let i = 0; i < 4; i++) {
          const [sw, up] = gait(p, ((i % 2 ? 0.5 : 0) + (s > 0 ? 0.5 : 0)) % 1);
          const f = f0 + 2 - i * 2, root = [f, u0 - 1.4, s * 3.4];
          const ft = p.dead ? [f, 2, s * 9] : [f + sw * 1.2 - (i - 1.5) * 0.8, up * 1.4, s * (8 + (i === 0 ? -0.6 : 0))];
          M.tube([root, [f - (i - 1.5) * 0.4, u0 + 2.4, s * 6.4], ft], [1, 0.8, 0.4], i % 2 ? CRABD : CRAB);
        }
      });
      // the skull: brow, sockets, a broken jaw
      const S = [f0, u0 + 1.4, 0], SR = [5.6, 4.8, 4.8];
      M.G("skull");
      M.e(S, SR, SKULL);
      M.e([f0 + 3.6, u0 - 0.8, 0], [2.6, 2.8, 3.6], SKULL);
      M.G();
      M.seam([surf(S, SR, [-0.2, 1, 0]), surf(S, SR, [0.4, 0.8, 0.3]), surf(S, SR, [0.6, 0.6, -0.2])], "#8a7a64");
      const eyesOut = p.wind ? 1.6 : p.strike ? 1 : 0.6;
      both((s) => {
        const so = surf([f0 + 3.6, u0 + 0.6, 0], [3, 2.6, 3.6], [0.7, 0.3, s * 0.6]);
        M.e(so, [0.9, 1.2, 1.1], C.MAW);
        const st = [so[0] + 0.8 + eyesOut, so[1] + 1.4 + eyesOut, so[2] + s * 0.4];
        M.tube([so, st], 0.45, CRAB);
        M.s(st, 0.95, C.EYEW);
        M.eye([st[0] + 0.6, st[1] + 0.3, st[2]], 2, "#ff2a2a");
      });
      M.dot(surf([f0 + 3.6, u0 - 0.8, 0], [2.6, 2.8, 3.6], [1, -0.1, 0]), "#3a2a20", 1, 2);
      teeth(M, [f0 + 6, u0 - 2.6, -1.8], [f0 + 6, u0 - 2.6, 1.8], 5, 1, 0.9, C.BONE);
      // claws: two great ones and a small cluttered pair, snapping
      both((s) => {
        const snap = p.strike ? 0.2 : p.wind ? 1 : p.idle ? 0.6 : 0.4;
        const arm = [f0 + 3, u0 - 2, s * 4.4], el = [f0 + 6, u0 - 1, s * 6.4], cl = [f0 + 8.6 + (p.strike ? 2 : 0), u0 - 0.6, s * 5.2];
        M.tube([arm, el, cl], [1.2, 1.1, 1], CRAB);
        M.e([cl[0] + 1.4, cl[1] + 0.6, cl[2]], [2.2, 1.4, 1.4], CRAB, [s * 10, 10 + snap * 20, 0]);
        M.e([cl[0] + 1.4, cl[1] - 0.8 - snap * 0.8, cl[2]], [2, 0.7, 1], CRABD, [s * 10, -snap * 25, 0]);
        M.tube([[f0 + 4.4, u0 - 3, s * 2], [f0 + 6.4, u0 - 3.4, s * 2.6]], [0.6, 0.4], CRABD);
        M.e([f0 + 7, u0 - 3.2, s * 2.6], [0.9, 0.5, 0.5], CRAB);
      });
    },
  },

  /** 뱀장어 매듭 — eels wound into a tight ball round the one great eye they share; they spit as one. */
  eelknot: {
    size: "m", glow: "#e8c840", death: "melt", k: 1.3,
    draw(M, p) {
      const t = p.walk ? p.ph : p.idle * 0.2;
      const [lf, lu] = lunge(p, 0.8);
      const c = [lf, 6 + lu, 0], R = 4.2;
      M.s(c, 3.4 + (p.wind ? 0.3 : 0), BIGEYE);
      const look = p.hurt ? 0 : 1;
      // the coils: each eel a loop round the eye at its own tilt
      [0, 60, 120, 30, 150].forEach((tilt, i) => {
        const pts = [], tr = (tilt * Math.PI) / 180;
        for (let a = 0; a <= 1.02; a += 0.06) {
          const th = a * Math.PI * 1.7 + i * 1.3 + t * 2.4;
          const x = Math.cos(th) * R, y = Math.sin(th) * R;
          pts.push([c[0] + x * Math.cos(tr) * (i % 2 ? 1 : 0.6), c[1] + y, c[2] + x * Math.sin(tr) + (i % 2 ? 0 : x * 0.6)]);
        }
        M.tube(pts, [1.1, 0.7], i % 2 ? EEL : EELB);
        const h = pts[pts.length - 1];
        M.s(h, 1, EEL);
        M.dot([h[0], h[1] + 0.6, h[2]], "#e8c020");
        if (p.strike || p.wind) M.dot([h[0], h[1] - 0.4, h[2]], "#2a0a14", 1, 1);
      });
      // the pupil: a slit that turns to follow you
      M.eye([c[0] + 3.3 * look, c[1] + 0.4, c[2] - 0.6], 3, "#e8b020");
      M.dot([c[0] + 3.4 * look, c[1] + 1.8, c[2] - 0.6], "#1a1216", 1, 3);
      M.tube([[c[0] - 1, 1.4, -1.6], [c[0] + 1.6, 0.6, -3.2], [c[0] + 3.6, 0.5, -2.4]], [0.9, 0.5], EEL);
      M.tube([[c[0] - 1.6, 1.4, 1.6], [c[0] - 3.6, 0.6, 3.2], [c[0] - 5.4, 0.5, 2]], [0.9, 0.5], EELB);
    },
  },

  // ── cave
  /** 손가락 거미 — it walks on fingers. Whose, nobody has asked. A palm for a body, and one eye in it. */
  spiderhand: {
    size: "m",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const f0 = lf, u0 = 6.4 + lu + bob(p, 0.7) - (p.wind ? 1.4 : 0);
      M.G("body");
      M.e([f0, u0, 0], [3.6, 2, 3.2], SKIN);
      M.e([f0 - 3.4, u0 + 0.6, 0], [3, 2.6, 2.8], SKIND);
      M.G();
      for (const [a, c] of [[-1, -1.6], [0.6, 1], [-2, 1.4]]) M.dot([f0 + a, u0 + 1.9, c], "#a87868");
      M.eye([f0 + 2.6, u0 + 1.2, 0], 3, "#2a1a22");
      M.dot([f0 - 3.4, u0 + 3, 0.6], "#e8d8c8", 2, 1);
      both((s) => {
        for (let i = 0; i < 4; i++) {
          const [sw, up] = gait(p, ((i % 2 ? 0.5 : 0) + (s > 0 ? 0.5 : 0) + i * 0.1) % 1);
          const fa = f0 + 2 - i * 1.5, root = [fa, u0, s * 2.6];
          const reach = p.strike && i === 0 ? 3 : 0;
          const kn = [fa + (1.5 - i) * 1.2 + reach * 0.5, u0 + 3.6 + (p.wind ? 1 : 0), s * 5.2];
          const ft = p.dead ? [fa, u0 + 4, s * 7] : [fa + (1.5 - i) * 2.4 + sw * 1.2 + reach, up * 1.6, s * 7.4];
          M.tube([root, kn, ft], [0.85, 0.7, 0.55], SKIN);
          M.dot(kn, "#b48c7c");
          M.s([ft[0], ft[1] + 0.3, ft[2]], 0.5, C.NAIL);
        }
      });
    },
  },

  /** 눈먼 두더지 — no eyes, a nose made of wet pink fingers, and a jaw that opens sideways. It digs with hands. */
  moleworm: {
    size: "l",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.4);
      const rear = p.wind ? 1 : 0;
      const f0 = lf, u0 = 6 + lu + bob(p, 0.6) + rear * 2;
      M.G("body");
      M.e([f0, u0, 0], [7, 5, 5.4], MOLE, [0, rear * 18, 0]);
      M.e([f0 + 5, u0 + 0.6 + rear * 1.6, 0], [3.4, 3.6, 4], MOLE);
      M.G();
      for (const [a, b, c] of [[-3, 4.4, -2], [0, 5, 1.4], [-5.4, 3, 2.4], [2, 4.2, -3]]) M.dot([f0 + a, u0 + b, c], "#7a7088");
      M.tube([[f0 - 6.6, u0, 0], [f0 - 8.6, u0 - 2.6, 0]], [0.9, 0.4], NOSE);
      // the hands it digs with: wide, pale, every nail a spade
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0 : 0.5);
        const a = p.strike ? 2 : rear ? 1 : sw * 1.6;
        const sh = [f0 + 3.4, u0 - 1.4, s * 4.2], ft = rear ? [f0 + 7, u0 + 1, s * 6.4] : [f0 + 5 + a, 0.8 + up * 1.4, s * 6.4];
        M.tube([sh, [f0 + 4.4 + a * 0.4, u0 * 0.4 + up, s * 6], ft], [1.6, 1.3], MOLE);
        M.e(ft, [1.6, 0.8, 1.8], SKIN);
        for (let i = 0; i < 4; i++) M.cone([ft[0] + 1, ft[1], ft[2] + (i - 1.5) * 0.8], [ft[0] + 2.8, ft[1] - 0.6, ft[2] + (i - 1.5) * 1.1], 0.45, C.NAIL);
        M.tube([[f0 - 3.6, u0 - 2.4, s * 3.6], [f0 - 3.4 + gait(p, s < 0 ? 0.5 : 0)[0], 0.6, s * 4]], [1.3, 1], MOLED);
      });
      // the face: no eyes; a jaw split left and right; a star of fingers for a nose
      const hc = [f0 + 8.2 + (p.strike ? 1.2 : 0), u0 + 0.4 + rear * 2.6, 0];
      const open = p.strike ? 1 : p.wind ? 0.8 : 0.25;
      both((s) => {
        M.e([hc[0] - 0.2, hc[1] - 1.4, s * (1 + open * 1.6)], [1.8, 1, 0.8], MOLED, [s * open * 30, 0, 0]);
        teeth(M, [hc[0] - 1, hc[1] - 1, s * (0.4 + open * 1.4)], [hc[0] + 1, hc[1] - 1, s * (0.4 + open * 1.2)], 3, 1, 0.7);
      });
      if (open > 0.5) M.e([hc[0] - 0.6, hc[1] - 1.4, 0], [1.4, 0.7, open * 1.4], C.MAW);
      M.s(hc, 1.3, NOSE);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, w = Math.sin(((p.walk ? p.ph : p.idle * 0.2) + i * 0.2) * Math.PI * 2) * 0.4;
        M.tube([[hc[0] + 0.6, hc[1] + Math.cos(a) * 0.8, Math.sin(a) * 0.8], [hc[0] + 2 + w, hc[1] + Math.cos(a) * 2.4, Math.sin(a) * 2.4]], [0.5, 0.36], NOSE);
      }
    },
  },

  /** 아가리 곰 — a bear that eats with its chest. The little head on top is only for watching. */
  bearmaw: {
    size: "l", glow: "#ff5a5a",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const up = p.wind ? 1.6 : 0;
      const f0 = lf * 0.6, u0 = 11 + lu + bob(p, 0.8) + up;
      const lean = p.strike ? -16 : p.wind ? 14 : p.hurt ? 8 : 0, P = (c) => pitchPt(c, -lean, [f0, 2, 0]);
      // hind legs, thick columns
      both((s) => {
        const [sw, li] = gait(p, s < 0 ? 0 : 0.5);
        const a = p.dead ? 1.6 : sw * 1.6;
        M.tube([[f0 - 0.6, u0 - 4.6, s * 2.8], [f0 + a * 0.5 + 0.6, 3.4 + li, s * 3], [f0 + a, li * 1.6 + 0.4, s * 3]], [2, 1.7, 1.6], BEAR);
        M.e([f0 + a + 0.8, li * 1.6 + 0.5, s * 3], [1.8, 0.7, 1.4], BEARD);
      });
      M.G("body");
      M.e(P([f0, u0, 0]), [4.2, 6, 5.2], BEAR, [0, lean, 0]);
      M.e(P([f0 - 0.6, u0 - 4.4, 0]), [3.6, 3.2, 4.4], BEAR);
      M.G();
      // the chest: a mouth from collar to belly
      const open = p.strike ? 1.3 : p.wind ? 1 : p.idle ? 0.7 : 0.55;
      M.e(P([f0 + 3.6, u0 - 0.6, 0]), [1, 4.6, 1.2 + open * 1.4], C.MAW, [0, lean, 0]);
      M.e(P([f0 + 3.4, u0 - 2.4, 0]), [1, 1.6, 0.9], C.TONGUE, [0, lean - 20, 0]);
      both((s) => {
        for (let i = 0; i < 5; i++) M.cone(P([f0 + 3.8, u0 + 3.2 - i * 1.6, s * (1.5 + open * 1.2)]), P([f0 + 4.2, u0 + 3 - i * 1.6, s * 0.3]), 0.55, C.TOOTH);
        M.e(P([f0 + 3.6, u0 - 0.6, s * (1.3 + open * 1.4)]), [0.8, 4.4, 0.6], C.RAW, [0, lean, 0]);
      });
      // arms that hang to the knees, and the claws
      both((s) => {
        const sw = p.strike ? -2 : p.wind ? 3 : p.walk ? -gait(p, s < 0 ? 0.5 : 0)[0] : 0;
        const sh = P([f0 + 1, u0 + 3.6, s * 5]), hd = [f0 + 3 + (p.strike ? 3 : 0), u0 - 6 + sw + (p.wind ? 8 : 0), s * 6.4];
        M.tube([sh, [f0 + 1.6, u0 - 1, s * 6.6], hd], [2, 1.7, 1.5], BEAR);
        for (let i = 0; i < 3; i++) M.cone([hd[0] + 0.8, hd[1] - 0.6, hd[2] + (i - 1) * 0.8], [hd[0] + 2.4, hd[1] - 2, hd[2] + (i - 1) * 0.9], 0.45, C.NAIL);
      });
      // the head: small, high and calm
      const H = P([f0 + 0.8, u0 + 7.4, 0]), HR = [2.4, 2.2, 2.4];
      M.e(H, HR, BEAR);
      M.e([H[0] + 2, H[1] - 0.6, 0], [1.4, 1, 1.2], BEARD);
      M.dot([H[0] + 3.2, H[1] - 0.5, 0], "#1a1216");
      both((s) => { M.s([H[0] - 0.6, H[1] + 2, s * 1.8], 1, BEAR); M.eye(surf(H, HR, [0.55, 0.3, s * 0.7]), 1, "#f0e0c0"); });
    },
  },

  /** 목 꺾인 올빼미 — an owl whose head went all the way round and stayed there: beak up, eyes down, never blinking. */
  owlstare: {
    size: "m", hover: 9, glow: "#ff7a30",
    draw(M, p) {
      const flap = p.dead ? 0.1 : [0.5, 0.05, -0.4, 0.05][p.walk ? Math.round(p.ph * 4) : p.idle ? 1 : 0] + (p.wind ? 0.6 : 0);
      const [lf, lu] = lunge(p, 0.6);
      const f0 = lf, u0 = 6 + lu;
      M.G("body");
      M.e([f0, u0, 0], [3, 4, 3.2], OWL);
      M.e([f0 + 1.4, u0 - 0.6, 0], [1.8, 3, 2.6], OWLL);
      M.G();
      for (let i = 0; i < 4; i++) both((s) => M.dot([f0 + 3, u0 - 2 + i * 1.1, s * (0.6 + (i % 2) * 0.6)], "#8a6a50"));
      both((s) => {
        const root = [f0 - 0.4, u0 + 2, s * 2.6];
        for (let i = 0; i < 3; i++) M.e(rollPt([root[0] - i * 1.6, root[1], root[2] + s * (4 + i * 0.4)], -s * flap * 55, root), [3 - i * 0.4, 0.5, 4], i % 2 ? OWLD : OWL, [0, 0, -s * flap * 55]);
        M.tube([[f0 + 0.6, u0 - 3.6, s * 1.2], [f0 + 1.2, u0 - 5.4, s * 1.2], [f0 + 2.2, u0 - 5.8, s * 1.4]], [0.6, 0.5, 0.4], C.NAIL);
      });
      // the head, upside down: the tufts hang under the chin, the beak points at the sky
      const H = [f0 + 0.6, u0 + 5.4, 0], HR = [2.6, 2.6, 3];
      M.e(H, HR, OWL, [0, 0, 180]);
      M.e([H[0] + 1.6, H[1] + 0.2, 0], [1.2, 2.2, 2.8], OWLL);
      both((s) => { M.cone([H[0] - 0.4, H[1] - 1.8, s * 2], [H[0] - 0.4, H[1] - 3.6, s * 2.6], 0.8, OWLD); M.eye([H[0] + 2.6, H[1] - 0.6, s * 1.2], 3, "#ff8a20"); });
      M.cone([H[0] + 2.4, H[1] + 1, 0], [H[0] + 3, H[1] + 2.6, 0], 0.6, C.HORN);
      M.seam([[H[0] + 1, H[1] - 2.6, -1.6], [H[0] + 1.4, H[1] - 2.4, 1.6]], "#d82838");
    },
  },

  /** 균열의 군주 크리온 — a beast-king stitched from four animals around a hole in the world: a bull's back, a lion's front, a ram's skull, and the rift where its heart was. */
  boss: {
    size: "boss", glow: "#ff72d6",
    draw(M, p) {
      const [lf, lu] = lunge(p, 2);
      const rear = p.wind ? 1 : 0;
      const f0 = lf, u0 = 20 + lu + bob(p, 1.2) + rear * 3;
      const pit = rear * 14 + (p.strike ? -8 : 0), P = (c) => pitchPt(c, pit, [f0 - 8, 4, 0]);
      // hind legs of a bull, front legs of a lion
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0.5 : 0);
        M.tube([P([f0 - 9, u0 - 4, s * 6]), [f0 - 11 + sw * 2, u0 * 0.45 + up, s * 6.4], [f0 - 9 + sw * 4, up * 2.4 + 1, s * 6.6]], [4, 2.6, 2], BULL);
        M.e([f0 - 8.6 + sw * 4, up * 2.4 + 1.2, s * 6.6], [2.4, 1.2, 2], HIDE);
        const [sw2, up2] = gait(p, s < 0 ? 0 : 0.5);
        const a = rear ? 3 : p.strike ? 3 : sw2 * 3.6;
        const ft = rear ? [f0 + 13, u0 - 2, s * 7] : [f0 + 9 + a, up2 * 2.4 + 1, s * 7.4];
        M.tube([P([f0 + 7, u0 - 3, s * 7]), [f0 + 9 + a * 0.5, u0 * 0.5 + up2 + rear * 6, s * 7.6], ft], [4, 3, 2.6], LION);
        for (let i = 0; i < 4; i++) M.cone([ft[0] + 2, ft[1], ft[2] + (i - 1.5) * 1.2], [ft[0] + 4.4, ft[1] - 1.2, ft[2] + (i - 1.5) * 1.4], 0.7, C.NAIL);
      });
      M.G("body");
      M.e(P([f0 - 6, u0 + 1, 0]), [9, 8, 9], BULL);
      M.e(P([f0 + 6, u0 + 3, 0]), [9, 10, 10], HIDE);
      M.G();
      M.seam([P([f0, u0 + 12, -4]), P([f0 - 1, u0 + 6, -9]), P([f0 - 1, u0 - 4, -8])]);
      M.seam([P([f0, u0 + 12, 4]), P([f0 - 1, u0 + 6, 9]), P([f0 - 1, u0 - 4, 8])]);
      // the mane, a dark red ruff of spikes
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        M.cone(P([f0 + 9, u0 + 6 + ca * 7, sa * 8]), P([f0 + 6, u0 + 6 + ca * 13, sa * 14]), 2.2, MANE);
      }
      // the rift in its chest: a ring of torn light around nothing
      const rc = P([f0 + 13.4, u0 + 1, 0]), pulse = p.idle ? 1.1 : 1;
      M.e(rc, [1.6, 6 * pulse, 4.4 * pulse], RIFT, [0, pit, 0]);
      M.e([rc[0] + 0.6, rc[1], rc[2]], [1.2, 4.4 * pulse, 3 * pulse], VOID, [0, pit, 0]);
      for (const [a, b] of [[-1.6, 1], [1.2, -0.6], [2, 2.6], [-0.4, -2.6], [0.8, 0.4]]) M.dot([rc[0] + 1.8, rc[1] + b, rc[2] + a], "#ffd0f4");
      M.seam([P([f0 + 11, u0 + 8, -4]), P([f0 + 13, u0 + 1, -5.4]), P([f0 + 11, u0 - 6, -4])], "#ff9ae6");
      // a ram's skull for a head, crowned with its own horns
      const H = P([f0 + 17 + (p.strike ? 3 : 0), u0 + 12 - (p.wind ? 0 : 0), 0]), HR = [4, 4.4, 3.8];
      M.e(H, HR, C.BONE, [0, -14, 0]);
      M.e([H[0] + 4, H[1] - 2.6, 0], [3, 2.4, 2.4], C.BONE, [0, -24, 0]);
      const open = p.strike ? 1.4 : p.wind ? 1 : 0.3;
      M.e([H[0] + 4.4, H[1] - 4.6 - open, 0], [2.6, 1, 2], C.BONE, [0, -10 - open * 20, 0]);
      teeth(M, [H[0] + 2.4, H[1] - 4.4, -1.6], [H[0] + 6.4, H[1] - 4.4, -1], 4, 1, 1.2);
      teeth(M, [H[0] + 2.4, H[1] - 4.4, 1.6], [H[0] + 6.4, H[1] - 4.4, 1], 4, 1, 1.2);
      both((s) => {
        M.e(surf(H, HR, [0.55, 0.15, s * 0.8]), [1.4, 1.4, 0.8], C.MAW);
        M.eye(surf(H, HR, [0.6, 0.2, s * 0.85]), 2, "#ff72d6");
        M.tube(bez([H[0] - 1, H[1] + 3, s * 2.4], [H[0] - 7, H[1] + 7, s * 8], [H[0] - 2, H[1] - 1, s * 9], 10), [2, 0.8], C.HORN);
        M.cone([H[0] - 1, H[1] + 4, s * 1], [H[0] - 2, H[1] + 10, s * 1.6], 1.1, C.HORN);
      });
      M.tube(bez(P([f0 - 14, u0 + 4, 0]), [f0 - 22, u0 + 8, 0], [f0 - 22, u0 - 6, p.walk ? Math.sin(p.ph * 6.28) * 4 : 2], 8), [2, 1], BULL);
    },
  },

  // ── abyss
  /** 쌍두 염소 — two goats' heads on one neck, four horns, and sideways pupils that look at everything at once. */
  twingoat: {
    size: "m",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.5);
      const f0 = lf, u0 = 8 + lu + bob(p, 0.6) - (p.wind ? 1 : 0);
      M.G("body");
      M.e([f0, u0, 0], [5.2, 3.4, 3.4], GOAT);
      M.e([f0 + 3.4, u0 + 0.6, 0], [2.8, 3.4, 3.2], GOAT);
      M.G();
      for (const [a, b, c] of [[-2, 2.8, -1.6], [1, 3.2, 1.4], [-4, 1.8, 2.4]]) M.dot([f0 + a, u0 + b, c], "#8a3a3a", 2, 1);
      legs4(M, p, { ff: f0 + 3.4, bf: f0 - 3.4, w: 2, hu: u0 - 1.8, r: 1.05, m: GOAT, foot: HORSEM, st: 2.6, li: 1.6 });
      M.cone([f0 - 5, u0 + 1.4, 0], [f0 - 6.6, u0 + 3, 0], 1, GOATD);
      both((s) => {
        const low = p.wind || p.strike ? 1 : 0;
        const H = [f0 + 6.6 + (p.strike ? 1.6 : 0), u0 + 3.4 - low * 2.6, s * 2], HR = [1.8, 2, 1.6];
        M.tube([[f0 + 4, u0 + 1.6, s * 0.8], [H[0] - 1, H[1] - 0.4, H[2]]], [1.6, 1.2], GOAT);
        M.e(H, HR, GOAT, [s * 14, -20 - low * 30, 0]);
        M.e([H[0] + 1.8, H[1] - 1.6 - low * 0.6, H[2] + s * 0.4], [1.4, 1, 1], GOAT, [s * 14, -30 - low * 30, 0]);
        M.e([H[0] + 2, H[1] - 3 - low * 0.6, H[2]], [0.6, 1, 0.5], GOATD);
        M.dot([H[0] + 2.6, H[1] - 2.2 - low, H[2]], "#d82838", 1, 2);
        // the eye: yellow, the pupil a flat bar
        const e = surf(H, HR, [0.3, 0.3, s * 0.9]);
        M.dot(e, "#e8c020", 2, 1); M.dot([e[0], e[1] - 0.6, e[2]], "#1a1216", 2, 1);
        for (const k of [-1, 1]) M.tube(bez([H[0] - 0.6, H[1] + 1.4, H[2] + k * 0.8], [H[0] - 3.6, H[1] + 4.6, H[2] + k * 2], [H[0] - 3, H[1] + 1, H[2] + k * 3.4], 7), [0.8, 0.3], C.HORN);
      });
    },
  },

  /** 반쪽 말 — a horse that kept walking after it lost its head; the stump grew a bundle of feelers and a mouth. */
  horsehalf: {
    size: "l",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.6);
      const f0 = lf, u0 = 11 + lu + bob(p, 0.8) - (p.wind ? 1 : 0);
      M.G("body");
      M.e([f0, u0, 0], [6.6, 3.8, 3.6], HORSE);
      M.e([f0 + 4.4, u0 + 0.6, 0], [3, 3.8, 3.4], HORSE);
      M.G();
      M.e([f0 - 0.4, u0 + 3, 0], [5.6, 0.8, 1.6], mat("#6a4a48"));
      for (let i = 0; i < 4; i++) both((s) => M.dot([f0 - 2 + i * 1.8, u0 + 0.4, s * 3.6], "#2a1e22"));
      legs4(M, p, { ff: f0 + 4.4, bf: f0 - 4.6, w: 2, hu: u0 - 2, r: 1.2, m: HORSE, foot: HORSEM, st: 3.6, li: 2.4, hock: 1.8 });
      M.tube(bez([f0 - 6.4, u0 + 1.4, 0], [f0 - 9, u0 + 1, 0], [f0 - 9.4, u0 - 4, p.walk ? Math.sin(p.ph * 6.28) : 0], 6), [1.2, 0.8], HORSEM);
      // the neck rises to a stump, and from the stump the thing that replaced its head
      const nk = [f0 + 8.4 + (p.strike ? 1.6 : 0), u0 + 6.6 - (p.wind ? 2 : 0), 0];
      M.tube([[f0 + 5, u0 + 2, 0], [f0 + 7, u0 + 4.6, 0], nk], [2.6, 2.1], HORSE);
      for (let i = 0; i < 6; i++) M.tube([[f0 + 4.6 + i * 0.7, u0 + 3.6 + i * 0.6, 0], [f0 + 3.6 + i * 0.7, u0 + 2 + i * 0.6, 1.8]], [0.6, 0.3], HORSEM);
      M.e(nk, [1, 2.4, 2.4], C.RAW, [0, -40, 0]);
      const open = p.strike ? 1.4 : p.wind ? 1 : 0.6;
      M.e([nk[0] + 0.6, nk[1] + 0.3, 0], [0.5, 1.2 * open, 1.2 * open], C.MAW, [0, -40, 0]);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        tentacle(M, [nk[0] + ca * 0.4, nk[1] + ca * 1.8, sa * 1.8], [0.5 + open * 0.3, 0.6 + ca * 0.7, sa * 0.9], 4.4 + (i % 3), 0.6, TENDRIL, (p.walk ? p.ph : p.idle * 0.2) + i * 0.17, 0.8, 5);
      }
      M.s([nk[0] + 0.5, nk[1] - 2, 0.6], 0.6, C.GORE);
    },
  },

  /** 손갈기 사자 — a lion whose mane is a ring of arms; every hand is reaching for something, and the face never moves. */
  lionhand: {
    size: "l",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.4);
      const f0 = lf, u0 = 9 + lu + bob(p, 0.7) - (p.wind ? 1 : 0);
      M.G("body");
      M.e([f0 - 1, u0, 0], [6.6, 3.8, 3.8], LION);
      M.e([f0 + 3.6, u0 + 0.8, 0], [3.4, 4.2, 4], LION);
      M.G();
      legs4(M, p, { ff: f0 + 3.6, bf: f0 - 4.6, w: 2.4, hu: u0 - 2, r: 1.5, m: LION, foot: LIOND, st: 3, li: 1.8 });
      M.tube(bez([f0 - 7.4, u0 + 1, 0], [f0 - 11, u0 + 3, 0], [f0 - 11, u0 - 3, p.walk ? Math.sin(p.ph * 6.28) * 1.4 : 0.6], 8), [0.8, 0.5], LION);
      M.s([f0 - 11, u0 - 3.4, 0.6], 1, LIOND);
      // the face: a lion's, perfectly still, with blank eyes
      const H = [f0 + 7 + (p.strike ? 1.4 : 0), u0 + 3.2 - (p.wind ? 1 : 0), 0], HR = [2.8, 2.8, 2.8];
      M.e(H, HR, LION);
      M.e([H[0] + 2.2, H[1] - 1.2, 0], [1.6, 1.4, 1.6], LIOND);
      M.dot([H[0] + 3.6, H[1] - 0.8, 0], "#2a1a1a", 2, 1);
      both((s) => M.eye(surf(H, HR, [0.6, 0.3, s * 0.7]), 2, "#f4efe0"));
      if (p.strike) teeth(M, [H[0] + 2.6, H[1] - 2.4, -0.8], [H[0] + 2.6, H[1] - 2.4, 0.8], 3, 1, 1);
      // the mane: arms all round the head, hands open, each a little out of time
      const t = p.walk ? p.ph : p.idle * 0.25 + (p.wind ? 0.5 : 0);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), w = Math.sin((t + i * 0.29) * Math.PI * 2) * 0.8;
        const reach = 4.6 + w + (p.wind ? 1.4 : 0);
        const root = [H[0] - 1.6, H[1] + ca * 2.4, sa * 2.4], el = [H[0] - 2.6, H[1] + ca * (reach - 1), sa * (reach - 0.6)], hd = [H[0] - 1.2 + w * 0.6, H[1] + ca * (reach + 1.4), sa * (reach + 1.6)];
        M.tube([root, el, hd], [0.75, 0.6, 0.5], ARM);
        hand(M, hd, [0.3, ca, sa], ARM, 4, 1.1 + (p.wind ? 0.4 : 0));
      }
    },
  },

  /** 날개 구렁이 — a serpent that grew wings and never learned to land. */
  serpentwing: {
    size: "l", hover: 10, glow: "#e8c840", k: 1.3,
    draw(M, p) {
      const t = p.walk ? p.ph : p.idle * 0.25;
      const flap = p.dead ? 0 : [0.8, 0.1, -0.6, 0.1][p.walk ? Math.round(p.ph * 4) : p.idle ? 1 : 0] + (p.wind ? 0.8 : 0);
      const [lf, lu] = lunge(p, 1.2);
      const pts = [];
      for (let i = 0; i <= 14; i++) { const k = i / 14; pts.push([lf + 6 - k * 16, 5 + lu + Math.sin(k * 5 + t * 6.28) * 1.4 - k * 2, Math.sin(k * 4 - t * 6.28) * 2.6 * k]); }
      M.G("body");
      M.tube(pts, [1.9, 0.5], SERP);
      M.G();
      for (let i = 1; i < 13; i += 2) M.dot([pts[i][0], pts[i][1] - 1.2, pts[i][2]], "#e0c070");
      // the wings: bat wings off the front third
      both((s) => {
        const root = [lf + 2, 6 + lu, s * 1.4], deg = -s * flap * 55;
        const W = (df, d, r, m) => M.e(rollPt([root[0] + df, root[1], root[2] + s * d], deg, root), r, m, [0, 0, deg]);
        W(0, 4.6, [2.6, 0.4, 4.4], SERPW);
        W(-2.4, 4, [2, 0.35, 3.6], SERPW);
        const tip = rollPt([root[0] + 0.6, root[1] + 0.6, root[2] + s * 9], deg, root);
        M.tube([root, rollPt([root[0] + 1.2, root[1] + 0.6, root[2] + s * 4.6], deg, root), tip], [0.6, 0.35], SERP);
        M.cone(tip, [tip[0] + 1, tip[1] + 0.6, tip[2]], 0.4, C.NAIL);
      });
      // the head
      const H = [lf + 7.6 + (p.strike ? 1.4 : 0), 6.4 + lu + (p.wind ? 1.4 : 0), 0], HR = [2.4, 1.4, 1.6];
      M.e(H, HR, SERP, [0, p.wind ? 20 : 0, 0]);
      M.e([H[0] + 0.6, H[1] - 0.9, 0], [1.9, 0.4, 1.2], SERPB);
      both((s) => { M.eye(surf(H, HR, [0.3, 0.5, s * 0.8]), 2, "#e8c020"); M.cone([H[0] - 1, H[1] + 0.8, s * 1], [H[0] - 3, H[1] + 1.6, s * 1.4], 0.6, C.HORN); });
      if (p.strike || p.wind) { M.e([H[0] + 2, H[1] - 0.4, 0], [0.8, 0.8, 0.9], C.MAW); both((s) => M.cone([H[0] + 2, H[1] + 0.2, s * 0.5], [H[0] + 2.2, H[1] - 1, s * 0.5], 0.4, C.TOOTH)); }
    },
  },

  /** 눈 달린 암퇘지 — a sow with her own eyes sewn shut, and a row of others along her belly where she fed her young. */
  sowseer: {
    size: "l",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1);
      const f0 = lf, u0 = 7 + lu + bob(p, 0.6), sw = p.idle ? 0.3 : 0;
      M.G("body");
      M.e([f0, u0, 0], [8 + sw, 5.4 + sw, 5.6 + sw], SOW);
      M.G();
      for (const [a, b, c] of [[-3, 4.6, -2.4], [1, 5, 2], [3.6, 4, -1.6], [-5.6, 3.4, 1.6]]) M.e([f0 + a, u0 + b, c], [1.1, 0.6, 1], SORE);
      legs4(M, p, { ff: f0 + 4.6, bf: f0 - 5, w: 3.2, hu: u0 - 3, r: 1.5, m: SOW, foot: SOWD, st: 1.6, li: 1 });
      M.tube(bez([f0 - 8, u0 + 1, 0], [f0 - 10, u0 + 3, 1], [f0 - 9, u0 + 3.4, -1], 6), 0.5, SOWD);
      // the eyes along her belly, each looking a different way
      both((s) => {
        for (let i = 0; i < 4; i++) {
          const q = surf([f0, u0, 0], [8, 5.4, 5.6], [0.55 - i * 0.34, 0.1, s * 0.9]);
          M.e(q, [1.1, 0.9, 0.7], SOWD);
          if (!((i + (p.idle ? 1 : 0) + (s > 0 ? 1 : 0)) % 4 === 0) || p.wind) M.eye([q[0], q[1] - 0.2, q[2] + s * 0.4], 2, i % 2 ? "#c8a020" : "#e02838");
        }
      });
      // her face: the snout works, the eyes are stitched shut
      const H = [f0 + 8.4 + (p.strike ? 1 : 0), u0 + 1 - (p.wind ? 1 : 0), 0], HR = [3, 3, 3.2];
      M.e(H, HR, SOW);
      M.e([H[0] + 2.8, H[1] - 0.6, 0], [1, 1.6, 1.8], mat("#e8b6ba"));
      both((s) => {
        M.dot([H[0] + 3.8, H[1] - 0.6, s * 0.8], "#5a2a3a");
        const e = surf(H, HR, [0.5, 0.5, s * 0.7]);
        M.seam([[e[0] - 0.6, e[1] + 0.5, e[2]], [e[0] + 0.6, e[1] - 0.5, e[2]]], "#2a1a22");
        M.seam([[e[0] - 0.6, e[1] - 0.5, e[2]], [e[0] + 0.6, e[1] + 0.5, e[2]]], "#2a1a22");
        M.e([H[0] - 1, H[1] + 2.6, s * 2.4], [1.4, 1.8, 0.5], SOWD, [0, -30, s * 30]);
      });
      if (p.strike || p.wind) M.dot([H[0] + 3, H[1] - 2.6, 0], "#b4cc3c", 1, 2);
    },
  },

  /** 심연의 어미 — the mother of all of it: one swollen body, five necks, and a brood you can see moving inside. */
  abyssboss: {
    size: "boss", glow: "#b4cc3c",
    draw(M, p) {
      const [lf, lu] = lunge(p, 2);
      const f0 = lf * 0.6, u0 = 15 + lu + bob(p, 1) + (p.idle ? 0.4 : 0), sw = p.idle ? 0.6 : 0;
      // stubby legs, too many of them
      both((s) => { for (let i = 0; i < 4; i++) { const [a, up] = gait(p, (i * 0.25 + (s > 0 ? 0.5 : 0)) % 1); const f = f0 + 8 - i * 6; M.tube([[f, u0 - 8, s * 10], [f + a * 2, 3 + up * 2, s * 13], [f + a * 3, up * 1.6 + 1, s * 13.6]], [3, 2.4, 2], MOTHERD); } });
      M.G("body");
      M.e([f0 - 2, u0, 0], [16 + sw, 12 + sw, 14 + sw], MOTHER);
      M.G();
      // the brood under the skin: dark shapes, each with an eye open
      [[0.3, 0.5, -0.6], [-0.3, 0.7, 0.3], [0.1, 0.2, 0.9], [-0.7, 0.3, -0.5], [0.6, 0.1, 0.5], [-0.5, -0.1, 0.85], [0.2, 0.8, 0.1]].forEach((d, i) => {
        const q = surf([f0 - 2, u0, 0], [16, 12, 14], d);
        M.e(q, [2.6, 1.4, 2.2], BROOD);
        M.eye([q[0] + 0.4, q[1] + 0.8, q[2]], i % 2 ? 2 : 1, i % 3 ? "#c8e040" : "#ff3a2a");
      });
      for (const [a, b] of [[[0.8, 0.3, -0.4], [0.5, 0.7, -0.5]], [[-0.1, 0.9, -0.4], [-0.5, 0.8, 0.3]], [[0.5, 0.6, 0.6], [0.1, 0.4, 0.9]], [[-0.8, 0.5, 0.2], [-0.6, 0.2, 0.75]]]) M.seam([surf([f0 - 2, u0, 0], [16.2, 12.2, 14.2], a), surf([f0 - 2, u0, 0], [16.2, 12.2, 14.2], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.1, (a[2] + b[2]) / 2]), surf([f0 - 2, u0, 0], [16.2, 12.2, 14.2], b)], "#7a3a6a");
      // five necks fanned out in front, each ending in a mouth
      const t = p.walk ? p.ph : p.idle * 0.2;
      for (let i = 0; i < 5; i++) {
        const sd = (i - 2) * 4.6, h = 6 + (2 - Math.abs(i - 2)) * 4, w = Math.sin((t + i * 0.23) * Math.PI * 2) * 1.4;
        const back = p.wind ? -3 : p.strike ? 4 : 0;
        const hd = [f0 + 20 + back - Math.abs(i - 2) * 2, u0 + h + 4 + w, sd * 1.5];
        M.tube(bez([f0 + 10, u0 + 2 + h * 0.3, sd * 0.8], [f0 + 16, u0 + h + 7, sd * 1.2], [hd[0] - 1.6, hd[1], hd[2]], 9), [3.2, 2.2], MOTHERD);
        M.e(hd, [3.4, 2.6, 2.6], MOTHER, [0, -10, 0]);
        const open = p.strike ? 1.4 : p.wind ? 1 : 0.4;
        M.e([hd[0] + 2.2, hd[1] - 0.4, hd[2]], [0.8, 0.8 + open, 1.4], C.MAW);
        teeth(M, [hd[0] + 2.4, hd[1] + 0.4 + open * 0.4, hd[2] - 1], [hd[0] + 2.4, hd[1] + 0.4 + open * 0.4, hd[2] + 1], 3, 1, 0.8);
        both((s) => M.eye([hd[0] + 1, hd[1] + 1.4, hd[2] + s * 1.4], 1, "#c8e040"));
        if (open > 0.8) M.dot([hd[0] + 2.4, hd[1] - 1.6 - open, hd[2]], "#b4cc3c", 1, 2);
      }
    },
  },

  /** 보물 상자 — an iron-bound chest; break it open for a sure piece of gear. */
  chest: {
    size: "s", death: "burst",
    draw(M, p) {
      const sh = p.hurt ? 1 : 0;
      M.box([0, 3.6, 0], [4, 3.4, 5.6], WOOD, [0, 0, sh * 6]);
      M.e([0, 7, 0], [4, 1.8, 5.6], WOODD, [0, 0, sh * 6]);
      both((s) => M.box([0, 4, s * 3.6], [4.3, 3.9, 0.6], IRON, [0, 0, sh * 6]));
      M.box([4.1, 5.4, 0], [0.5, 1.2, 1], GOLD, [0, 0, sh * 6]);
      M.dot([4.6, 5.2, 0], "#2a1a22");
    },
  },
};
