/** Monsters of the sewer, cave, abyss and frostkeep, the great bosses and the treasure chest (see mobart.js). */
import { mat, C, bez, gait, bob, lunge, legs4, teeth, ribs, tentacle, surf, both, rollPt, pitchPt, hand } from "./mobart_kit.js";

// ── sewer: sludge browns, pale drowned skin and sick yellow-green
const LEECH = mat("#4a3448", { wet: true }), LEECHB = mat("#5e4458", { wet: true }), RING = mat("#d07a84", { wet: true });
const GATOR = mat("#4e6a40"), GATORB = mat("#c0c090"), GATORD = mat("#2e4430");
const CRAB = mat("#c85a3a"), CRABD = mat("#8a3426"), SKULL = mat("#e2d6b8");
const EEL = mat("#34404e", { wet: true }), EELB = mat("#5e6a50", { wet: true }), BIGEYE = mat("#f0e8c8", { role: "keep", wet: true });
// ── cave: blind-pale skin, velvet greys, bark brown
const SKIN = mat("#dcbcaa"), SKIND = mat("#b48c7c");
const QUARTZ = mat("#ada4ce");
const MOLE = mat("#5a5266"), MOLED = mat("#3a3444"), NOSE = mat("#e89aa4", { wet: true });
const BEAR = mat("#5a4236"), BEARD = mat("#3a2a24");
const OWL = mat("#8a6a50"), OWLL = mat("#d8c4a0"), OWLD = mat("#5a4434");
// ── abyss: bone-white, old blood and the black-red of the deep
const GOAT = mat("#d8d0c0"), GOATD = mat("#a89c8c");
const HORSE = mat("#4a3436"), HORSEM = mat("#2a1e22"), TENDRIL = mat("#e0a8b0", { wet: true });
const LION = mat("#c89a5a"), LIOND = mat("#8a5a34"), ARM = mat("#e0c0a8");
const MANE_HIDE = mat("#514055"), MANE_SHADOW = mat("#2c2333", { flat: true });
const MANE_SKIN = mat("#a16b62"), MANE_CLAW = mat("#e2c4a0", { role: "keep" });
const MANE_PLATE = mat("#755663"), MANE_BONE_SHADE = mat("#a98069", { role: "keep" });
const MANE_EYE = mat("#ffc584", { role: "glow" });
const SERP = mat("#8a3048"), SERPB = mat("#e0c070"), SERPW = mat("#5a2234");
const SOW = mat("#b07880"), SOWD = mat("#8a5866"), SORE = mat("#b83a4a", { wet: true, drip: true });
// ── the great ones
const RIFT = mat("#e848ff", { role: "glow" }), RIFT_CORE = mat("#ffe8ff", { role: "glow" }), VOID = mat("#120620", { role: "keep", flat: true });
const HIDE = mat("#2a1e3a"), MANE = mat("#582048"), BULL = mat("#3a2844"), KRION_PL = mat("#422e5c"), KRION_DK = mat("#1a1228"), KRION_GOLD = mat("#cfa04c", { role: "keep" });
const MOTHER = mat("#3e2038"), MOTHERD = mat("#221022"), BROOD = mat("#7a1c34");
const MORMA_PALE = mat("#ddd4e2", { role: "keep" }), MORMA_HAIR = mat("#c4b8d0", { role: "keep" }), MORMA_EYE = mat("#ff2838", { role: "glow" }), MORMA_EYEC = mat("#ffd870", { role: "glow" });
const GLASS = mat("#7b606d"), CINDER = mat("#ba4845", { role: "keep", flat: true });
const EMBER = mat("#ff7946", { role: "glow" }), LANTERN = mat("#ffe298", { role: "glow" });
const WOOD = mat("#8a5a3a"), WOODD = mat("#5e3a26"), IRON = mat("#6a6a7a"), GOLD = mat("#f0c050", { role: "keep" });
// ── frostkeep: dark winter coats, opaque blue ice, and a warm eye highlight
const RIME = mat("#66749b"), RIME_D = mat("#354364"), FROST = mat("#9ed7e3"), FROST_D = mat("#478da8");
const MOTH_CLOAK = mat("#786db8"), MOTH_EDGE = mat("#a9a6dd"), MOTH_CORE = mat("#39324e");
const STAG = mat("#354154"), STAG_MANE = mat("#64819a");

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
        const u = r + Math.max(0, w) * 1.2 + (i < 2 ? rear * (3 - i) * 1.2 : 0);
        M.s([f, u, 0], r, i % 2 ? LEECH : LEECHB);
        if (i === 2 || i === 4) {
          // Paired bile bladders swell in sequence as the segment contracts.
          both((s) => M.e([f, u + r * 0.55, s * r * 0.65], [1.15, 1.4 + w * 0.45, 1.2], GATORB));
        }
      }
      M.G();
      for (const [a, b, c] of [[1, 5.4, -1], [-2, 5, 1.2], [-5, 4, -0.6], [-8, 3, 0.8], [2.4, 4.8, 1.6]]) M.dot([lf + a, b, c], "#b4cc3c");
      // the mouth: a ring of pink flesh, teeth turned inward
      const mc = [lf + 6.2 + (p.strike ? 1 : 0), 3.4 + rear * 3.4, 0], open = p.strike ? 1.3 : p.wind ? 1.1 : 0.9;
      M.e(mc, [1.2, 3.2 * open, 3.2 * open], RING, [0, rear * 30, 0]);
      M.e([mc[0] + 0.8, mc[1], mc[2]], [0.6, 1.8 * open, 1.8 * open], C.MAW, [0, rear * 30, 0]);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, cu = Math.cos(a), cs = Math.sin(a); M.cone([mc[0] + 1.1, mc[1] + cu * 2.2 * open, mc[2] + cs * 2.2 * open], [mc[0] + 1.6, mc[1] + cu * 1.1 * open, mc[2] + cs * 1.1 * open], 0.5, C.TOOTH); }
      M.dot([mc[0] + 1, mc[1] - 2.8, 0], "#b4cc3c", 1, 2);
    },
  },

  /** 반쪽 악어 — the front half of an alligator, hauling itself on two legs and dragging the bare spine of the rest. */
  gatorhalf: {
    size: "l", n: 72, k: 1.15,
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
    size: "l", n: 70, glow: "#ff5a5a",
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
      M.stare(c, 3.4 + (p.wind ? 0.3 : 0), p.strike ? "#ff8a20" : "#e8b020", 4 + look);
      M.tube([[c[0] - 1, 1.4, -1.6], [c[0] + 1.6, 0.6, -3.2], [c[0] + 3.6, 0.5, -2.4]], [0.9, 0.5], EEL);
      M.tube([[c[0] - 1.6, 1.4, 1.6], [c[0] - 3.6, 0.6, 3.2], [c[0] - 5.4, 0.5, 2]], [0.9, 0.5], EELB);
    },
  },

  // ── cave
  /** 손가락 거미 — it walks on fingers. Whose, nobody has asked. A palm for a body, and one eye in it. */
  spiderhand: {
    size: "m", n: 58,
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
    size: "l", n: 72,
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
      // A broken seam of purple quartz grows out of the digging shoulder.
      for (const [f, h] of [[-3, 3.3], [-1, 4.8]]) {
        M.cone([f0 + f, u0 + 3.6, -2.3], [f0 + f - 1.5, u0 + 3.6 + h, -3.4], 1.35, QUARTZ);
      }
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

  /** 균열의 군주 크리온 — towering bipedal obsidian-and-gold Rift Overlord with colossal crystal pauldrons, tattered violet cape, blazing chest vortex, clawed gauntlets, and orbiting rift crystals. */
  boss: {
    size: "boss", n: 204, glow: "#e848ff",
    draw(M, p) {
      const [lf, lu] = lunge(p, 2.4);
      const rear = p.wind ? 1 : 0, strike = p.strike ? 1 : 0;
      const f0 = lf, u0 = 26 + lu + bob(p, 1.4) + rear * 3.5;
      const pit = rear * 12 + (strike ? -10 : 0), P = (c) => pitchPt(c, pit, [f0, 8, 0]);
      // armored bipedal legs & tattered obsidian-violet war skirt
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0.5 : 0);
        const ft = [f0 + sw * 4.5, 1.5 + up * 2.5, s * 7.2];
        const knee = [f0 + 2 + sw * 2, u0 * 0.44 + up, s * 7.6];
        M.tube([P([f0 - 1, u0 - 6, s * 5.8]), knee, ft], [4.6, 3.6, 2.8], KRION_DK);
        M.box([knee[0] + 1.4, knee[1] + 0.6, knee[2] + s * 0.6], [2.4, 3.6, 2.4], KRION_PL, [s * 12, -12, s * 10]);
        M.tube([[knee[0] + 2.4, knee[1] + 2.4, knee[2] + s * 1.4], [ft[0] + 1.6, ft[1] + 1.4, ft[2] + s * 1.2]], 0.55, KRION_GOLD);
        M.e([ft[0] + 1.6, ft[1], ft[2]], [3.6, 1.6, 2.8], KRION_DK);
      });
      // billowing tattered shadow-violet cape streaming behind
      const wave = p.walk ? Math.sin(p.ph * 6.28) * 3.5 : p.idle ? 1.8 : 0;
      for (const [s, len, drop, w] of [[-13, 24, 14, 2.8], [-6, 28, 18, 3.4], [0, 30, 19, 3.8], [6, 28, 18, 3.4], [13, 24, 14, 2.8]]) {
        const c1 = P([f0 - 6, u0 + 13, s * 0.7]);
        const c2 = [f0 - 15 - rear * 3, u0 + 7 - drop * 0.35, s * 1.15 + wave * 0.5];
        const c3 = [f0 - len - rear * 4, Math.max(3, u0 + 4 - drop), s * 1.35 + wave];
        M.tube([c1, c2, c3], [w, w * 0.85, 0.5], Math.abs(s) === 6 ? MANE : KRION_DK);
      }
      // heavy V-tapered obsidian-and-gold armored torso
      M.G("torso");
      M.e(P([f0, u0 - 2, 0]), [7.2, 8.5, 7.6], KRION_DK);
      M.e(P([f0 + 1.5, u0 + 9.5, 0]), [9.8, 10.2, 12.6], HIDE);
      M.box(P([f0 + 2.5, u0 + 11, 0]), [7.5, 7.2, 11.4], KRION_PL, [0, -8, 0]);
      M.G();
      // gold chest-plate trim & glowing rift cracks across waist/flanks
      both((s) => {
        M.tube([P([f0 + 5.5, u0 + 17, s * 8.5]), P([f0 + 8.5, u0 + 10, s * 6.2]), P([f0 + 6.5, u0 + 2, s * 4.5])], [0.9, 0.75, 0.55], KRION_GOLD);
        M.tube([P([f0 + 4, u0 + 3, s * 6.2]), P([f0 + 1, u0 - 3, s * 6.8]), P([f0 + 3, u0 - 8, s * 5.6])], 0.65, RIFT);
      });
      // blazing diamond dimensional Rift Core in the center of the chest
      const rc = P([f0 + 9.8, u0 + 10.5, 0]), pulse = p.idle || rear ? 1.18 : 1;
      M.box(rc, [1.8, 5.8 * pulse, 4.4 * pulse], RIFT, [0, pit, 45]);
      M.box([rc[0] + 0.7, rc[1], rc[2]], [1.4, 3.8 * pulse, 2.8 * pulse], VOID, [0, pit, 45]);
      M.e([rc[0] + 1.2, rc[1], rc[2]], [1.1, 2.2 * pulse, 1.5 * pulse], RIFT_CORE);
      // colossal jagged crystal-encrusted shoulder pauldrons & huge clawed gauntlet arms
      both((s) => {
        const sh = P([f0 + 1, u0 + 16.5, s * 14.5]);
        M.G("pauldron" + s);
        M.box(sh, [6.4, 4.2, 5.8], KRION_DK, [s * 18, -10, -s * 24]);
        M.box([sh[0] + 1.2, sh[1] + 2.2, sh[2] + s * 1.6], [5.2, 2.4, 4.8], KRION_PL, [s * 20, -12, -s * 28]);
        M.tube([[sh[0] + 5.2, sh[1] + 1.5, sh[2] + s * 3.8], [sh[0] - 2.4, sh[1] + 3.2, sh[2] + s * 5.2], [sh[0] - 4.8, sh[1] - 1.2, sh[2] + s * 3.2]], 0.85, KRION_GOLD);
        // twin giant amethyst-obsidian crystals erupting upward from each pauldron
        M.cone([sh[0] - 1, sh[1] + 3, sh[2] + s * 1.5], [sh[0] - 6, sh[1] + 14.5, sh[2] + s * 7.5], 2.8, KRION_PL);
        M.cone([sh[0] - 0.4, sh[1] + 3.4, sh[2] + s * 2.2], [sh[0] - 4.6, sh[1] + 12.2, sh[2] + s * 6.5], 1.4, RIFT);
        M.cone([sh[0] + 1.8, sh[1] + 2.5, sh[2] + s * 2.8], [sh[0] + 0.5, sh[1] + 10.5, sh[2] + s * 8.5], 1.9, KRION_DK);
        M.G();
        // massive armored arms & huge clawed demon gauntlets
        const reach = strike * 9 - rear * 4;
        const liftA = rear * 9 - strike * 5 + (p.walk ? Math.sin(p.ph * 6.28 + s) * 2.5 : 0);
        const elb = P([f0 + 4 + reach * 0.4, u0 + 7.5 + liftA * 0.5, s * 18.5]);
        const handC = P([f0 + 13.5 + reach, u0 + 5.5 + liftA, s * (16.5 - strike * 4)]);
        M.tube([sh, elb, handC], [4.2, 3.6, 3.4], KRION_DK);
        M.box(elb, [3.2, 3.4, 3.2], KRION_PL, [s * 16, -20, 0]);
        M.tube([[elb[0] + 1, elb[1] + 1, elb[2] + s * 2.4], [handC[0], handC[1] + 1, handC[2] + s * 2.2]], 0.75, RIFT);
        M.e(handC, [3.8, 3.6, 3.8], KRION_PL);
        M.tube([[handC[0] - 1.5, handC[1] + 2.2, handC[2] - s * 1.5], [handC[0] + 1.5, handC[1] + 2.2, handC[2] + s * 2.2]], 0.75, KRION_GOLD);
        for (let i = 0; i < 4; i++) {
          const cf = [handC[0] + 2.8, handC[1] + (i - 1.5) * 1.4, handC[2] + s * (i - 1.5) * 1.2];
          M.cone(cf, [cf[0] + 5.2, cf[1] - 1.6 + (i === 0 ? 2 : 0), cf[2] + s * 1.4], 1.15, KRION_DK);
        }
      });
      // dark horned obsidian crown-helm with blazing vertical visor slit
      const H = P([f0 + 3.5 + strike * 2.5, u0 + 23.5 + rear * 1.5, 0]);
      M.G("helm");
      M.e(H, [4.6, 5.4, 4.4], KRION_DK);
      M.box([H[0] + 2.4, H[1] - 0.6, 0], [3.2, 4.6, 3.2], KRION_PL, [0, -10, 0]);
      M.G();
      M.box([H[0] + 4.8, H[1] - 0.4, 0], [1.2, 3.6, 1.5], VOID);
      M.tube([[H[0] + 5.2, H[1] + 1.4, 0], [H[0] + 5.2, H[1] - 2.0, 0]], 0.65, RIFT_CORE);
      // tall royal crown spikes & huge sweeping crescent demon horns
      M.cone([H[0] + 1.4, H[1] + 4.6, 0], [H[0] + 0.5, H[1] + 14.5, 0], 1.5, KRION_GOLD);
      both((s) => {
        M.cone([H[0] + 0.6, H[1] + 4.2, s * 2.2], [H[0] - 0.5, H[1] + 11.2, s * 4.5], 1.2, KRION_GOLD);
        M.tube(bez([H[0] - 0.5, H[1] + 3.8, s * 3.4], [H[0] - 5, H[1] + 13.5, s * 12.5], [H[0] + 2, H[1] + 18.5, s * 15.5], 9), [2.4, 0.7], KRION_DK);
        M.tube(bez([H[0] - 0.2, H[1] + 4.2, s * 3.8], [H[0] - 4.2, H[1] + 12.5, s * 11.8], [H[0] + 1.5, H[1] + 16.5, s * 14.2], 6), [0.85, 0.3], RIFT);
      });
      // 4 large floating faceted rift crystals orbiting behind shoulders
      const fl = p.walk ? Math.sin(p.ph * 6.28) * 2.5 : p.idle ? 2 : 0;
      const flare = rear ? 4 : strike ? 3 : 0;
      both((s) => {
        const c1 = P([f0 - 4, u0 + 27 + fl + flare * 0.5, s * (24 + flare)]);
        M.cone([c1[0], c1[1], c1[2]], [c1[0], c1[1] + 6.5, c1[2]], 2.4, RIFT);
        M.cone([c1[0], c1[1], c1[2]], [c1[0], c1[1] - 5.2, c1[2]], 2.4, KRION_PL);
        const c2 = P([f0 - 15, u0 + 20 - fl, s * (20 + flare * 0.8)]);
        M.cone([c2[0], c2[1], c2[2]], [c2[0], c2[1] + 4.8, c2[2]], 1.8, RIFT_CORE);
        M.cone([c2[0], c2[1], c2[2]], [c2[0], c2[1] - 3.8, c2[2]], 1.8, KRION_DK);
      });
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
        // A coal-red throat shows as each head cranes out of its ash coat.
        M.e([f0 + 4.7, u0 + 1.2 - low, s * 1.7], [2, 1.1 + p.wind * 0.7, 1.35], CINDER);
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
    size: "l", n: 70,
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

  /** The field king's mane grows into uneven, grasping arms above its lion paws. */
  lionhand_boss: {
    size: "boss", n: 128, glow: "#ffc584",
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.7), wind = p.wind ? 1 : 0, strike = p.strike ? 1 : 0;
      const f = lf * 0.75, u = 15 + lu + bob(p, 0.9) - (p.dead || 0) * 5;
      legs4(M, p, { ff: f + 7, bf: f - 9.8, w: 5.2, hu: u - 2.1, r: 2.85, m: MANE_HIDE, foot: MANE_SHADOW, st: 3.5, li: 2.2, splay: 1.22 });
      const tail = p.walk ? Math.sin(p.ph * Math.PI * 2) * 3 : 0;
      M.tube([[f - 11, u + 1, 0], [f - 17, u + 4, 2 + tail * 0.4], [f - 21, u + 7, 5 + tail], [f - 23, u + 4, 7 + tail]], [1.65, 1.25, 0.94, 0.46], MANE_SHADOW);
      M.e([f - 23.5, u + 4.1, 7.1 + tail], [2, 1.2, 1.32], MANE_HIDE, [20, -30, 0]);
      M.G("body");
      M.e([f - 5, u - 0.8, 0], [10.8, 5.4, 6.6], MANE_SHADOW);
      M.e([f + 3.9 - wind, u + 4.5, 0], [8.0, 8.6, 7.6], MANE_HIDE, [0, 15, 0]);
      M.G();
      both((s) => {
        for (const [offset, high] of [[-5.9, 1.1], [-2.9, 1.9], [0.2, 3]]) {
          M.tube([[f + offset - 1.45, u + high + 2.3, s * 4.8], [f + offset, u + high + 0.8, s * 6.65], [f + offset - 0.75, u + high - 2.0, s * 6.72]], [0.98, 0.82, 0.44], MANE_PLATE);
        }
        M.e([f + 6.2 - wind, u + 1.1, s * 6.1], [2.55, 3.55, 1.75], MANE_HIDE, [s * 15, -15, s * 17]);
      });
      const head = [f + 11 + strike * 2.6 - wind * 2.6, u + 8.9 - strike * 1.2 + wind * 2.3, 0], [hx, hy] = head;
      M.G("ruff");
      M.e([hx - 4, hy - 0.25, 0], [6.1, 7.5, 7.1], MANE_SHADOW);
      for (const [x, y, w, tip] of [[-6, 3.9, 5.8, 5.3], [-3, 5.8, 5.7, 4.8], [0.5, 4.2, 4.2, 3.3]]) both((s) => {
        M.cone([hx + x, hy + y - 2.1, s * (w - 1.2)], [hx + x - 3.0, hy + y + tip, s * w], 2.1, MANE_HIDE);
      });
      M.G();

      // Two long arms crown one shoulder. Three shorter arms creep around the other's ribs.
      const limbs = [
        [-6.1, 3.9, -4.0, -4.6, 16.7, -13.0, 5.4, 19.4, -19.5, 2.8],
        [-2.1, 1.2, -5.3, 2.1, 7.1, -14.2, 12.4, 5.8, -20.0, 2.45],
        [-4.7, 4.8, 4.2, -3.2, 11.9, 12.0, 8.1, 13.7, 16.3, 2.13],
        [-4.6, -0.7, 5.6, -2.8, 3.1, 14.4, 7.3, -1.7, 20.1, 2.6],
        [-8.0, -1.6, 3.9, -13.1, 3.6, 8.3, -15.8, 9.0, 11.5, 1.8],
      ];
      for (const [i, [rf, ru, rs, ef, eu, es, wf, wu, ws, w]] of limbs.entries()) {
        const wave = p.walk ? Math.sin((p.ph + i * 0.22) * Math.PI * 2) * 1.4 : p.idle ? (i % 2 ? 0.45 : -0.45) : 0;
        const front = i === 4 ? 0.15 : 1, curl = wind ? 0.35 : strike ? 2.35 : 1.0;
        const wrist = [f + wf + front * (strike * 9 - wind * 4), u + wu + wave + wind * 4.7 - strike * (i ? 2.6 : 5.1), ws * (strike ? 0.81 : 1)];
        const elbow = [f + ef + front * (strike * 3 - wind * 2.4), u + eu + wave * 0.3 + wind * 3.0, es];
        M.G("arm" + i);
        M.tube([[f + rf, u + ru + 5.5, rs], elbow, wrist], [w * 1.4, w * 0.84, w * 0.68], i < 2 ? MANE_SKIN : MANE_HIDE);
        M.e(elbow, [w * 0.82, w * 0.92, w], MANE_HIDE);
        M.e(wrist, [w * 1.15, w * 0.76, w * 1.15], MANE_SKIN, [0, wind ? 26 : -12, 0]);
        M.tube([[elbow[0] + 0.5, elbow[1] + w * 0.6, elbow[2]], [wrist[0] - 1.7, wrist[1] + w * 0.78, wrist[2]]], [0.96, 0.52], MANE_PLATE);
        M.G();
        // Separate the long middle digits from the thumb so the attack still reads as a grasp.
        const [x, y, s0] = wrist, sign = Math.sign(ws);
        for (const [j, length] of [3.2, 4.45, 4.05, 2.9].entries()) {
          const side = s0 + (j - 1.5) * 1.65;
          const tip = [x + length + (strike ? 0.8 : 0), y - curl, side + (j - 1.5) * 0.46];
          M.tube([[x + w * 0.4, y + 0.4, side], [x + length * 0.75, y + 0.75, tip[2]], tip], [0.88, 0.70, 0.31], MANE_CLAW);
          M.e([x + 1.1, y + w * 0.58, side], [0.82, 0.63, 0.64], MANE_BONE_SHADE);
        }
        M.tube([[x + 0.4, y - 0.6, s0 - sign * w], [x + 2.2, y - 1.45, s0 - sign * (w + 1.7)], [x + 3.0, y - 1.4 - curl * 0.22, s0 - sign * (w + 2)]], [0.95, 0.65, 0.3], MANE_CLAW);
      }

      M.G("mask");
      M.e(head, [4.95, 4.55, 4.8], MANE_HIDE);
      const mask = [hx + 1.55, hy + 0.58, 0], r = [3.7, 3.55, 4.12];
      M.e(mask, r, MANE_CLAW);
      M.box([hx + 3.9, hy - 1.15, 0], [1.8, 1.3, 2.25], MANE_SKIN, [0, -16, 0]);
      M.e([hx + 5.47, hy - 1.14, 0], [0.63, 0.57, 1.20], MANE_SHADOW);
      M.G();
      M.e([hx + 4.1, hy - 2.4, 0], [2.0, 1.05 + strike * 0.95, 2.67], C.MAW, [0, -16, 0]);
      M.e([hx + 3.8, hy - 3.3 - strike * 1.1, 0], [2.35, 0.85, 2.2], MANE_BONE_SHADE);
      both((s) => {
        const socket = surf(mask, r, [0.63, 0.26, s * 0.84]);
        const outer = surf(mask, r, [0.27, 0.49, s * 0.88]);
        const inner = surf(mask, r, [0.91, 0.11, s * 0.52]);
        M.tube([outer, socket, inner], [0.83, 0.94, 0.48], MANE_SHADOW);
        if (!p.dead) M.tube([[socket[0] + 0.55, socket[1] - 0.12, socket[2] + s * 0.61], [inner[0] + 0.42, inner[1] + 0.15, inner[2] + s * 0.4]], 0.43, MANE_EYE);
        const cheek = surf(mask, r, [0.55, -0.38, s * 0.88]);
        M.tube([[cheek[0] - 1.2, cheek[1] + 0.25, cheek[2]], cheek, [hx + 4.65, hy - 1.8, s * 2.40]], [0.84, 0.90, 0.6], MANE_BONE_SHADE);
        M.cone([hx + 4.46, hy - 1.5, s * 2], [hx + 4.9, hy - 3.45 - strike * 0.7, s * 2.0], 0.8, MANE_CLAW);
      });
    },
  },

  /** 날개 구렁이 — a serpent that grew wings and never learned to land. */
  serpentwing: {
    size: "l", n: 70, hover: 10, glow: "#e8c840", k: 1.3,
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
          const q = surf([f0, u0, 0], [8, 5.4, 5.6], [0.6 - i * 0.36, 0.42, s * 0.85]);
          M.e(q, [1.1, 0.9, 0.7], SOWD);
          if (!((i + (p.idle ? 1 : 0) + (s > 0 ? 1 : 0)) % 4 === 0) || p.wind) M.eye([q[0], q[1] - 0.2, q[2] + s * 0.4], i === 1 ? 3 : 2, i % 2 ? "#c8a020" : "#e02838");
        }
      });
      // her face: the snout works, the eyes are stitched shut
      const H = [f0 + 8.6 + (p.strike ? 1 : 0), u0 + 1.4 - (p.wind ? 1 : 0), 0], HR = [3.4, 3.4, 3.6];
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

  /** 심연의 어미 모르마 — eldritch brood-horror: pale bone-crowned maiden emerging from a colossal eye-studded abyssal mass, surrounded by 10 wildly writhing tentacles. */
  abyssboss: {
    size: "boss", n: 210, glow: "#ff3850",
    draw(M, p) {
      const [lf, lu] = lunge(p, 2.2), wind = p.wind ? 1 : 0, strike = p.strike ? 1 : 0;
      const f = lf * 0.75, u = 16 + lu + bob(p, 0.9) - (p.dead || 0) * 5;
      const ph = p.walk ? p.ph : p.idle ? 0.25 : 0;
      // 10 thick, wildly curling eldritch tentacles erupting from the brood-mass in all directions
      const tents = [
        // [side, rootF, rootU, midF, midU, midS, tipF, tipU, tipS, r0]
        [-1, -14, 14, -26, 26, -18, -32, 34, -10, 3.2],
        [1, -14, 14, -26, 26, 18, -32, 34, 10, 3.2],
        [-1, -16, 4, -28, 12, -26, -24, 24, -30, 3.4],
        [1, -16, 4, -28, 12, 26, -24, 24, 30, 3.4],
        [-1, -10, -2, -16, 2, -27, -6, 10, -32, 3.0],
        [1, -10, -2, -16, 2, 27, -6, 10, 32, 3.0],
        [-1, -20, -4, -32, -2, -18, -34, 8, -22, 2.8],
        [1, -20, -4, -32, -2, 18, -34, 8, 22, 2.8],
        [-1, -2, -6, 6, -8, -20, 16, 2, -24, 2.6],
        [1, -2, -6, 6, -8, 20, 16, 2, 24, 2.6],
      ];
      tents.forEach(([s, rf, ru, mf, mu, ms, tf, tu, ts, r0], i) => {
        const wv = Math.sin((ph + i * 0.17) * Math.PI * 2) * (p.walk ? 4.2 : 2.0);
        const flare = wind * 4.5 + strike * 3.5;
        const p0 = [f + rf, Math.max(2, u + ru), s * 10];
        const p1 = [f + mf + strike * 3, Math.max(2, u + mu + wv + wind * 2), ms + s * flare * 0.4];
        const p2 = [f + tf + strike * 6, Math.max(3, u + tu - wv * 1.2 + wind * 3.5), ts + s * flare * 0.7];
        const pts = bez(p0, p1, p2, 8);
        M.tube(pts, [r0, 0.55], i % 2 ? MOTHERD : MOTHER);
        // crimson underside ridge / sucker beads
        M.tube([pts[2], pts[4], pts[6]], [r0 * 0.42, r0 * 0.28], BROOD);
        if (!p.dead && i < 6) M.dot(pts[6], "#ff5a6a", 2, 2);
      });
      // colossal swollen dark-plum eldritch brood-mass behind the maiden
      const mass = [f - 10, u + 5, 0], massR = [16.5, 14.5, 16.5];
      M.G("mass");
      M.e(mass, massR, MOTHER);
      M.e([f - 13, u - 1, 0], [15.2, 10.5, 15.5], MOTHERD);
      M.e([f - 8, u + 14.5, 0], [11.5, 8.2, 11.8], MOTHERD);
      M.G();
      // 7 huge glowing crimson slit-pupil eldritch eyes staring out of the brood-mass
      const eyeDirs = [
        [0.45, 0.35, -0.82, 4.2], [0.45, 0.35, 0.82, 4.2],
        [-0.15, 0.65, -0.72, 3.6], [-0.15, 0.65, 0.72, 3.6],
        [0.15, -0.15, -0.95, 3.2], [0.15, -0.15, 0.95, 3.2],
        [-0.75, 0.45, 0.0, 4.0],
      ];
      for (const [dx, dy, dz, sz] of eyeDirs) {
        const ep = surf(mass, massR, [dx, dy, dz]);
        M.s(ep, sz * 0.95, BROOD);
        M.s([ep[0] + dx * 0.9, ep[1] + dy * 0.9, ep[2] + dz * 0.9], sz * 0.72, MORMA_EYE);
        if (!p.dead) M.stare([ep[0] + dx * 1.1, ep[1] + dy * 1.1, ep[2] + dz * 1.1], sz * 0.75, "#ffd060", Math.round(sz * 0.9));
      }
      // tattered dark-violet abyssal mantle skirt draping down from the front maiden
      for (const [s, len] of [[-10, 14], [-4, 16], [4, 16], [10, 14]]) {
        M.tube([[f + 4, u + 6, s * 0.6], [f + 8, u - 3, s * 0.95], [f + 6, 1.5, s * 1.25]], [3.4, 2.8, 1.0], MOTHERD);
      }
      // pale ghostly-white maiden upper torso emerging from the front of the brood-mass
      const mx = f + 8.5 + strike * 2.5, my = u + 8.5 + wind * 2.2;
      M.G("maiden");
      M.e([mx - 1.5, my - 5.5, 0], [4.6, 7.2, 5.2], MORMA_PALE, [0, -10, 0]);
      M.e([mx + 0.5, my + 2.5, 0], [4.2, 5.2, 5.4], MORMA_PALE);
      M.G();
      // crimson vein scars across her pale torso
      both((s) => M.tube([[mx + 3.2, my + 4.5, s * 2.2], [mx + 2.6, my - 2.5, s * 3.2]], 0.52, BROOD));
      // long skeletal clawed arms lunging wildly forward
      both((s) => {
        const reach = strike * 9.5 - wind * 4.5;
        const sh = [mx + 0.5, my + 5.8, s * 5.6];
        const elb = [mx + 6.5 + reach * 0.45, my + 2.5 + wind * 4.5, s * 11.2];
        const wrist = [mx + 14.5 + reach, my - 1.2 + wind * 6.5 - strike * 2.5, s * (10.5 - strike * 2.5)];
        M.tube([sh, elb, wrist], [1.9, 1.4, 1.15], MORMA_PALE);
        M.tube([[elb[0], elb[1] - 0.5, elb[2]], [wrist[0], wrist[1] - 0.4, wrist[2]]], 0.48, BROOD);
        for (let i = 0; i < 4; i++) {
          M.cone([wrist[0] + 0.8, wrist[1] + (i - 1.5) * 0.7, wrist[2] + s * (i - 1.5) * 0.9], [wrist[0] + 5.8, wrist[1] - 2.8 + (i - 1.5) * 0.8, wrist[2] + s * (i - 1.5) * 1.4], 0.55, i % 2 ? BROOD : MORMA_PALE);
        }
      });
      // pale head with flowing ghostly hair & glowing crimson eyes
      const H = [mx + 1.5, my + 10.8, 0], HR = [3.6, 4.2, 3.6];
      M.e(H, HR, MORMA_PALE);
      both((s) => {
        // streaming pale-violet hair tendrils billowing back and down
        M.tube(bez([H[0] - 0.5, H[1] + 3.2, s * 2.2], [H[0] - 5, H[1] - 2, s * 8.5], [H[0] - 11, H[1] - 12, s * 11.5], 7), [1.9, 0.55], MORMA_HAIR);
        M.tube(bez([H[0] - 1.5, H[1] + 2.4, s * 3.0], [H[0] - 8, H[1] + 1, s * 11], [H[0] - 15, H[1] - 7, s * 14], 7), [1.5, 0.45], MORMA_HAIR);
        if (!p.dead) M.eye(surf(H, HR, [0.7, 0.15, s * 0.6]), 2, "#ff2838");
      });
      // tall spiked bone-and-crimson sun-halo crown framing her head
      const haloR = 9.2;
      const haloPts = [];
      for (let i = 0; i <= 10; i++) {
        const a = -0.25 + (i / 10) * (Math.PI + 0.5);
        haloPts.push([H[0] - 2.6, H[1] + 1.2 + Math.sin(a) * haloR, Math.cos(a) * haloR]);
      }
      M.tube(haloPts, 1.05, C.BONE);
      for (let i = 1; i <= 9; i++) {
        const a = -0.15 + (i / 10) * (Math.PI + 0.3);
        const root = [H[0] - 2.6, H[1] + 1.2 + Math.sin(a) * haloR, Math.cos(a) * haloR];
        const tip = [H[0] - 3.2, H[1] + 1.2 + Math.sin(a) * (haloR + 5.8), Math.cos(a) * (haloR + 5.8)];
        M.cone(root, tip, 1.05, C.BONE);
        M.s(root, 1.15, i % 2 ? MORMA_EYE : BROOD);
      }
    },
  },

  // ── frostkeep
  /** Ice ears jut forward as the hare springs out of its crouch. */
  rimehare: {
    size: "s",
    draw(M, p) {
      const hop = p.walk ? [0, 1.5, 0.8, 0][Math.round(p.ph * 4)] : 0;
      const [f, lift] = lunge(p);
      const u = 4.8 + lift + hop;
      const head = [f + 4.1, u + 2.1 - (p.wind ? 0.6 : 0), 0], hr = [2.4, 2.2, 2];
      M.G("coat");
      M.e([f - 0.7, u, 0], [4.7, 3.1, 3.5], RIME);
      M.s([f - 5.2, u + 0.1, 0], 1.25, FROST);
      M.e(head, hr, RIME);
      M.e([head[0] + 1.5, head[1] - 1.1, 0], [1.5, 1, 1.4], RIME_D);
      M.G();
      both((s) => {
        M.e([f - 2.7, u - 1.3, 2.4 * s], [2.6, 2.5, 1.2], RIME);
        M.e([f - 1.6 - hop, 0.8 + hop, 2.5 * s], [2.2, 0.7, 0.9], RIME_D);
        M.tube([[f + 2.5, u - 1, 1.7 * s], [f + 3.4 + hop, 0.7 + hop, 1.8 * s]], [0.85, 0.65], RIME_D);
        const ear = [head[0] - 0.7, head[1] + 1.1, 0.95 * s];
        const lean = p.wind ? -3.8 : p.strike ? 3.5 : -1.6 - hop + p.idle * s;
        M.cone(ear, [ear[0] + lean - 1.7, ear[1] + 3.4, 2.7 * s], 1.1, FROST_D);
        M.cone(ear, [ear[0] + lean, ear[1] + (s === 1 ? 6.1 : 5.1), 2.1 * s], 1, s === 1 ? FROST : FROST_D);
        M.eye(surf(head, hr, [0.67, 0.22, 0.72 * s]), 2, "#f0b45d");
      });
      M.dot([head[0] + 2.1, head[1] - 1.45, -0.55], "#d7eff0", 1, 2);
    },
  },

  /** Four angular wings open to reveal a dark body and orange feelers. */
  frostmoth: {
    size: "m", hover: 10,
    draw(M, p) {
      const [f, lift] = lunge(p);
      const u = 6.6 + lift;
      const angle = p.dead ? 0 : p.wind ? 47 : p.strike ? -37 : p.hurt ? -10 : (p.fr % 2 === 0 ? 25 : -24);
      M.G("body");
      M.e([f - 1.6, u, 0], [4.1, 1.9, 1.75], MOTH_CORE);
      M.s([f + 2.4, u + 0.4, 0], 1.75, MOTH_EDGE);
      M.G();
      both((s) => {
        const root = [f + 0.7, u + 0.45, 0];
        const turn = (df, du, side) => rollPt([f + df, u + du, s * side], -s * angle, root);
        M.G("w" + s);
        M.e(turn(-1.9, 0.12, 5.1), [2.8, 0.42, 4.3], MOTH_CLOAK, [s * 12, 0, -s * angle]);
        M.box(turn(1.7, 0.45, 6), [2.35, 0.42, 4.8], MOTH_EDGE, [s * -25, 0, -s * angle]);
        M.box(turn(2.4, 0.93, 6.8), [0.65, 0.28, 3.95], FROST, [s * -25, 0, -s * angle]);
        M.G();
        M.tube([[f + 3.3, u + 1, 0.7 * s], [f + 4.15, u + 2.65, 1.1 * s], [f + 4.6, u + 3.35, 2.1 * s]], [0.48, 0.27], MOTH_CORE);
        M.dot([f + 4.6, u + 3.35, 2.1 * s], "#e8a761");
        M.eye([f + 3.55, u + 0.7, 1.02 * s], 1, "#ffd49a");
      });
    },
  },

  /** A high, icy three-pronged crown tips forward before the stag slams. */
  crownstag: {
    size: "xl",
    draw(M, p) {
      const [f, lift] = lunge(p, 1.4);
      const u = 12.1 + bob(p, 0.65) + lift + (p.wind ? 1.7 : 0);
      legs4(M, p, { ff: f + 4.3, bf: f - 4.9, w: 2.3, hu: u - 1.8, r: 1.13, st: 2.8, li: 1.6, m: STAG, foot: RIME_D });
      M.G("coat");
      M.e([f - 0.6, u, 0], [7, 3.25, 3.05], STAG);
      M.e([f + 3.4, u + 0.8, 0], [3.8, 3.65, 3.45], STAG_MANE);
      M.cone([f - 6, u + 1, 0], [f - 8.2, u + 2, 0], 0.95, STAG_MANE);
      const head = [f + 7.7 + (p.strike ? 1.5 : 0), u + 6.5 - (p.strike ? 2.7 : 0), 0], hr = [2.6, 2, 1.75];
      M.tube([[f + 4.6, u + 1.25, 0], [f + 5.8, u + 4.2, 0], head], [2.4, 1.65], STAG_MANE);
      M.e(head, hr, STAG_MANE);
      M.e([head[0] + 2, head[1] - 0.7, 0], [1.65, 1.05, 1.26], STAG);
      M.G();
      both((s) => {
        M.eye(surf(head, hr, [0.52, 0.18, 0.82 * s]), 2, "#f4bd65");
        M.cone([head[0] - 1.5, head[1] + 0.85, 1.15 * s], [head[0] - 2.7, head[1] + 1.5, 2.8 * s], 0.7, STAG);
        const n = p.strike ? 2.1 : p.wind ? -1.2 : 0;
        const antler = (df, du, side) => [head[0] + df + du * n * 0.11, head[1] + du, s * side];
        M.G("crown" + s);
        M.tube([antler(-1, 1.4, 1.2), antler(-2.2, 4.1, 3.6), antler(-2.1, 6.7, 5.7)], [0.9, 0.6], FROST_D);
        M.cone(antler(-2.1, 6.7, 5.7), antler(-2.9, 10.25, 6.3), 1.05, FROST);
        M.cone(antler(-2.2, 5.1, 4.8), antler(0.4, 8.5, 5.8), 0.85, FROST);
        M.cone(antler(-2.25, 4.4, 4), antler(-5.15, 6.1, 6.7), 0.75, FROST_D);
        M.G();
      });
      M.box([head[0] - 0.3, head[1] + 1.65, 0], [1.2, 0.45, 1.38], FROST_D);
      M.cone([head[0] + 0.2, head[1] + 1.7, 0], [head[0] - 0.4, head[1] + 5.25, 0], 0.9, FROST);
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
