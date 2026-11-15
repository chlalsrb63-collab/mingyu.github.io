/**
 * Monsters of the new grounds (see mobart.js for how they are drawn): the coral coast, the desert
 * (oasis, dune sea, mesa), the jungle road and the eastern mountains (cloud temple, mesa palace).
 * Each is one real animal gone wrong in one way: one dominant shape, one thing to know it by,
 * and whatever is sharp sits at its ends.
 */
import { mat, C, bez, gait, bob, lunge, legs4, teeth, ribs, tentacle, surf, both, pitchPt } from "./mobart_kit.js";

// ── coast: shell cream, wet slate, sea teal; coral red is the accent
const CONCH = mat("#ecc4a8"), CONCHD = mat("#c47e66"), HCRAB = mat("#5a6ab8"), HCRABD = mat("#38447e");
const GULLW = mat("#eae6da"), GULLG = mat("#8a94a6"), GULLK = mat("#2e2c38"), BEAKY = mat("#e0a030"), NERVE = mat("#c8505a", { wet: true });
const BRAIN = mat("#e890a8", { wet: true }), BRAIND = mat("#b85a7c", { wet: true }), BELL = mat("#8ad8d8", { wet: true }), CORD = mat("#d8f0e8", { role: "glow" });
const TSHELL = mat("#2e6a6a"), TSHELLD = mat("#1e4648"), TSHELLL = mat("#5a9a8a"), TSKIN = mat("#9aa070"), TSKIND = mat("#5e6a4a");
const CORAL = mat("#e8564e"), CORALL = mat("#ffa890");
const SEAL = mat("#5a6a82", { wet: true }), SEALD = mat("#3a465c", { wet: true }), SEALB = mat("#a8b0b4", { wet: true }), BARN = mat("#efe6cc", { role: "keep" }), BARND = mat("#cdbf9c", { role: "keep" });

// ── desert: sand, old linen, dried meat; the cactus green and the curse's teal are the accents
const SAND = mat("#d8b070"), SANDD = mat("#8a6a44"), WORM = mat("#c8744a"), WORMD = mat("#96502e"), WORMB = mat("#ecc494");
const VERT = mat("#dccca4"), VERTD = mat("#a48e6a"), SINEW = mat("#8a3a3a");
const VULT = mat("#4a3a36"), VULTD = mat("#2c2226"), VULTL = mat("#7a6252"), NECK = mat("#d87a70", { wet: true }), RUFF = mat("#ece4d2");
const CACT = mat("#5a9a4a"), CACTD = mat("#356a3a"), FLOWER = mat("#f06a9a"), HOGF = mat("#e8c8a0"), HOGD = mat("#a87850");
const LINEN = mat("#dccca4"), LINEND = mat("#a8946c"), DRY = mat("#6a4a3a"), CURSE = mat("#40d8b0", { role: "glow" });

// ── jungle: wet bark and vine green; orchid pink and the dart frog's blue are the warnings
const MONK = mat("#6a4a3a"), MONKD = mat("#46302a"), MONKF = mat("#d8b08a"), VINE = mat("#4a8a3a"), VINED = mat("#2e5a30"), LEAFJ = mat("#84c44a");
const TRAP = mat("#9ac848"), TRAPR = mat("#d83a5a", { role: "blood", wet: true });
const DART = mat("#2a5ae0", { wet: true }), DARTK = mat("#1a2466", { wet: true }), DARTY = mat("#f0c830", { wet: true }), SAC = mat("#f4e8a8", { wet: true });
const OPET = mat("#f6dce8"), OPINK = mat("#ea80ac"), OMAG = mat("#b83a78");
const BARKJ = mat("#6e553a"), BARKJD = mat("#46342a"), RINGS = mat("#dcbc84"), MOSS = mat("#5a9038"), SHROOM = mat("#e8a040");
const GAT = mat("#4e6a40"), GATD = mat("#2e4430"), GATB = mat("#c4c494");
// ── the eastern mountains: gold fur and red beads, crane white, mist, gilt
const GOLDM = mat("#dc9c48"), GOLDMD = mat("#a8682e"), FACEB = mat("#9ab8dc"), BEAD = mat("#6a2430"), TASSEL = mat("#d83a3a");
const WCR = mat("#f2eee6"), WCRK = mat("#2a2832"), CROWNR = mat("#d83030", { role: "blood" });
const TIG = mat("#eceae6"), TIGS = mat("#b4c0d4"), STRIPE = mat("#2e2a3a"), MIST = mat("#dfeefa", { role: "glow" });
const PEA = mat("#1e7a8e"), PEAD = mat("#12506a"), GILT = mat("#f0c040"), GILTD = mat("#b88422");

/** How a wing sits in this frame: up (1) … down (−1). */
const flapOf = (p, a = [0.9, 0.2, -0.7, 0.1]) => (p.dead ? 0.2 : a[p.walk ? Math.round(p.ph * 4) % 4 : p.idle ? 1 : 0] + (p.strike ? -0.4 : 0));
/** A pincer at `c` reaching along `d`: a knuckle and two fingers, `open` 0…1 apart. */
function pincer(M, c, d, r, open, m, tip = m) {
  M.s(c, r, m);
  for (const s of [1, -1]) {
    const o = s * (0.35 + open * 0.75) * r;
    M.cone([c[0] + d[0] * r * 0.6, c[1] + d[1] * r * 0.6 + o * 0.6, c[2] + d[2] * r * 0.6], [c[0] + d[0] * r * 2.6, c[1] + d[1] * r * 2.6 + o, c[2] + d[2] * r * 2.6], r * (s > 0 ? 0.62 : 0.5), tip);
  }
}
/** A branch of coral from `a`, `h` tall, leaning by `lean` [f, s]: a trunk and two forks. */
function coral(M, a, h, lean, m = CORAL, tip = CORALL) {
  const b = [a[0] + lean[0], a[1] + h * 0.55, a[2] + lean[1]];
  M.tube([a, b], [h * 0.2 + 0.35, h * 0.14 + 0.3], m);
  const t1 = [b[0] + lean[0] * 0.9 + h * 0.16, b[1] + h * 0.5, b[2] + lean[1] * 0.9], t2 = [b[0] - h * 0.24, b[1] + h * 0.34, b[2] - lean[1] * 0.4 + h * 0.12];
  M.tube([b, t1], [h * 0.13 + 0.3, 0.4], m); M.tube([b, t2], [h * 0.12 + 0.3, 0.4], m);
  M.s(t1, 0.55, tip); M.s(t2, 0.5, tip);
}

/** One wing of `n` feathers from `root` on side `s`, raised `deg` degrees; `mats` from the root outward. */
function wing(M, root, s, deg, n, step, chord, mats, back = 0.5) {
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  for (let i = 0; i < n; i++) { const L = step * (i + 1); M.e([root[0] - i * back, root[1] + sa * L, root[2] + s * ca * L], [chord - i * 0.15, 0.42, step * 0.75], mats[Math.min(mats.length - 1, i)], [0, 0, -s * deg]); }
}

export const BEASTS_E = {
  /** 집게 소라게 떼 — one conch, and a whole brood of hermit crabs that never left it: a fan of eyestalks and mismatched claws carries the shell about. */
  hermitskull: {
    size: "m", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 3 + lu + bob(p, 0.5);
      both((s) => {
        for (let i = 0; i < 3; i++) {
          const [sw, up] = gait(p, (i % 2 ? 0.5 : 0) + (s < 0 ? 0 : 0.5));
          const top = [f0 + 2 - i * 1.8, u0, s * 2.2], ft = [f0 + 3.4 - i * 2.4 + sw * 1.2, up * 1.2, s * (5.6 + (i === 1 ? 0.8 : 0))];
          M.tube([top, [(top[0] + ft[0]) / 2, u0 + 1.8, s * 4.8], ft], [0.75, 0.6, 0.4], i % 2 ? HCRABD : HCRAB);
        }
      });
      // the shell: whorls winding up and back to a point, a thorn on every turn
      const W = bez([f0 - 0.6, u0 + 2.6, 0], [f0 - 2.5, u0 + 9.5, 0], [f0 - 8, u0 + 12 + (p.idle ? 0.5 : 0), 0], 5);
      M.G("shell");
      W.forEach((q, i) => M.e(q, [4.8 - i * 0.72, 3.5 - i * 0.48, 4.8 - i * 0.72], i % 2 ? CONCHD : CONCH, [0, 30, 0]));
      M.G();
      W.forEach((q, i) => { if (i > 0 && i < 5) both((s) => M.cone([q[0], q[1] + 1, s * (3.6 - i * 0.6)], [q[0] - 0.8, q[1] + 2.6, s * (6 - i * 0.8)], 0.7, CONCH)); });
      M.cone(W[5], [W[5][0] - 2.6, W[5][1] + 1.4, 0], 0.9, CONCHD);
      // the mouth of the shell, and everyone in it looking out
      const mo = [f0 + 3.4, u0 + 1.8, 0];
      M.e(mo, [1.5, 2.5, 3.2], C.MAW);
      const look = p.strike ? 1.4 : p.wind ? -0.6 : 0;
      [[-2.4, 3.6, 0], [-1.1, 5, 0.3], [0.2, 5.6, 0.6], [1.4, 4.8, 0.2], [2.5, 3.4, 0.5]].forEach(([s, h, ph], i) => {
        const w = Math.sin(((p.walk ? p.ph : p.idle * 0.25) + ph) * Math.PI * 2) * 0.5;
        const tip = [mo[0] + 2.2 + look + w * 0.4, u0 + h + (p.hurt ? -1 : 0), s * 1.3 + w];
        M.tube([[mo[0] + 0.6, u0 + 2.2, s * 0.8], tip], 0.42, i % 2 ? HCRAB : HCRABD);
        M.s(tip, 0.8, C.EYEW); M.eye([tip[0] + 0.6, tip[1], tip[2]], 1, "#201020");
      });
      // claws that do not match: one great crusher, one small, more behind them
      const open = p.wind ? 1 : p.strike ? 0 : 0.4, re = p.strike ? 2.4 : p.wind ? -0.8 : 0;
      M.tube([[mo[0] + 0.4, u0 + 0.6, 2], [mo[0] + 2.4 + re, u0 + 1.4, 4.4]], [0.9, 0.8], HCRABD);
      pincer(M, [mo[0] + 3.4 + re, u0 + 1.8, 4.8], [1, 0.1, -0.2], 1.7, open, HCRAB, CONCH);
      M.tube([[mo[0] + 0.4, u0 + 0.4, -2], [mo[0] + 2.4 + re * 0.5, u0 + 0.8, -3.6]], [0.6, 0.5], HCRABD);
      pincer(M, [mo[0] + 3 + re * 0.5, u0 + 0.9, -3.8], [1, 0, 0.1], 0.9, open, HCRAB, CONCH);
      pincer(M, [mo[0] + 1.6, u0 - 0.6, 0.4], [1, -0.2, 0], 0.6, 0.5, HCRABD);
    },
  },

  /** 갈매기 눈알 — a gull whose whole head went to one eye; it cannot blink, and the nerve trails behind it like a ribbon. */
  eyegull: {
    size: "s", hover: 10, glow: "#ffd040", k: 1.2,
    draw(M, p) {
      const flap = flapOf(p, [0.8, 0.15, -0.6, 0.1]);
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 6 + lu - flap * 0.5;
      M.G("body");
      M.e([f0, u0, 0], [3.6, 2.3, 2.3], GULLW, [0, p.strike ? -16 : 8, 0]);
      M.e([f0 - 3.8, u0 + 0.2, 0], [2.4, 0.6, 1.9], GULLG, [0, 12, 0]);
      M.G();
      tentacle(M, [f0 - 4.6, u0 - 0.4, 0], [-1, -0.25, 0], 4.6, 0.55, NERVE, p.walk ? p.ph : p.idle * 0.3, 0.9, 5);
      // the eye, hooded in grey feathers, the beak hanging under it
      const H = [f0 + 3.4, u0 + 1.6 - (p.strike ? 1.2 : 0), 0];
      M.e([H[0] - 1.3, H[1] + 0.5, 0], [2.4, 2.5, 2.7], GULLG);
      M.s(H, 2.6, C.EYEW);
      M.stare(H, 2.6, "#e8a020", 3);
      const gape = p.strike ? 1.3 : p.wind ? 0.8 : 0.1;
      M.cone([H[0] + 0.8, H[1] - 2.2, 0], [H[0] + 4.6, H[1] - 2.6 + gape * 0.4, 0], 0.9, BEAKY);
      M.cone([H[0] + 0.6, H[1] - 2.8, 0], [H[0] + 3.6, H[1] - 3.2 - gape, 0], 0.6, BEAKY);
      M.dot([H[0] + 3.2, H[1] - 3.2 - gape * 0.6, 0], "#d82838", 1, 1);
      // long narrow wings, black at the tips
      both((s) => {
        const a = (flap * 50 * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
        const root = [f0 + 0.6, u0 + 1, s * 1.5];
        for (let i = 0; i < 5; i++) {
          const L = 2.4 + i * 1.7, bend = i > 2 ? (i - 2) * -0.7 * Math.sign(flap || 1) : 0;
          M.e([root[0] - i * 0.55, root[1] + sa * L + bend, root[2] + s * ca * L], [1.7 - i * 0.16, 0.42, 1.5], i > 3 ? GULLK : i > 1 ? GULLG : GULLW, [0, 0, -s * flap * 50]);
        }
      });
      both((s) => M.tube([[f0 - 0.6, u0 - 1.9, s * 0.9], [f0 - 1.2, u0 - 3.8, s * 1.1], [f0 - 0.2, u0 - 4.2, s * 1.1]], [0.42, 0.4, 0.5], BEAKY));
    },
  },

  /** 해파리 뇌 — a brain that slipped its skull and learned to swim; two eyes still hang off it by their cords. */
  brainjelly: {
    size: "m", hover: 9, glow: "#8ad8d8", death: "melt", k: 1.1,
    draw(M, p) {
      const pulse = p.dead ? 0 : p.walk ? [0, 0.6, 1, 0.4][Math.round(p.ph * 4) % 4] : p.idle ? 0.5 : p.wind ? 1 : 0;
      const [lf, lu] = lunge(p, 0.8);
      const f0 = lf, u0 = 8.6 + lu + pulse * 0.8;
      const ph = p.walk ? p.ph : p.idle * 0.25;
      // what hangs below: the stem, the stingers, the two eyes
      const reach = p.strike ? 1 : 0;
      M.tube(bez([f0 - 0.6, u0 - 1, 0], [f0 - 1.6, u0 - 4.4, 0], [f0 - 0.4 + reach * 2, u0 - 7.6 + reach, 0], 5), [1.2, 0.5], CORD);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5, r = 4.4 - pulse * 0.8;
        tentacle(M, [f0 + Math.cos(a) * r, u0 - 0.8, Math.sin(a) * r], [reach * 0.5 + Math.cos(a) * 0.12, -1, Math.sin(a) * 0.12], 5.6 + (i % 2) * 1.6, 0.5, i % 2 ? BELL : BRAIND, ph + i * 0.17, 0.8, 6);
      }
      both((s) => {
        const e = [f0 + 4.2 + reach * 1.6, u0 - 3.6 + Math.sin((ph + (s > 0 ? 0.3 : 0)) * Math.PI * 2) * 0.4, s * 2.2];
        M.tube([[f0 + 2.6, u0 - 0.6, s * 1.6], [f0 + 3.8, u0 - 2, s * 2], e], 0.4, NERVE);
        M.s(e, 1.15, C.EYEW); M.eye([e[0] + 0.8, e[1] - 0.1, e[2]], 2, "#2aa0a0");
      });
      // the bell: a frilled skirt, and over it the two halves of the brain
      M.e([f0, u0 - 0.4, 0], [6 - pulse, 1.3 + pulse * 0.5, 6 - pulse], BELL);
      M.G("brain");
      both((s) => M.e([f0, u0 + 2 + pulse * 0.3, s * 2.1], [4.8 - pulse * 0.4, 3.5 + pulse * 0.4, 2.7], BRAIN));
      M.G();
      M.seam([[f0 + 4.4, u0 + 2, 0], [f0 + 3, u0 + 4.8, 0], [f0, u0 + 5.6, 0], [f0 - 3, u0 + 4.8, 0], [f0 - 4.4, u0 + 2, 0]], "#8a3a5c");
      both((s) => {
        M.seam([[f0 + 2.6, u0 + 4.2, s * 1.4], [f0 + 1, u0 + 4.6, s * 2.8], [f0 + 2, u0 + 3, s * 3.8]], "#b85a7c");
        M.seam([[f0 - 2.4, u0 + 4.4, s * 1.5], [f0 - 1, u0 + 4.2, s * 3], [f0 - 2.6, u0 + 2.6, s * 3.6]], "#b85a7c");
      });
    },
  },

  /** 따개비 물개 — a seal that lay on the rocks too long: barnacles took its back, and the big ones have learned to bite. */
  barnacleseal: {
    size: "m", n: 60, k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.3);
      const hump = p.walk ? Math.sin(p.ph * Math.PI * 2) : 0, rear = p.wind ? 1 : 0;
      const f0 = lf, u0 = 3.2 + lu;
      const neck = [f0 + 5.4 - rear * 1.4, u0 + 2.8 + rear * 2.6 - (p.strike ? 1.6 : 0), 0];
      const spine = [[f0 - 8.6, u0 - 1.6, 0], [f0 - 5, u0 - 0.4 + hump * 0.6, 0], [f0 - 1, u0 + 0.6 + hump * 1.4, 0], [f0 + 3, u0 + 0.8 + rear * 1.2, 0], neck];
      M.G("body");
      M.tube(spine, [1.3, 3, 4.1, 3.7, 2.5], SEAL);
      M.e([f0 + 1.4, u0 - 1.6 + hump * 0.6, 0], [4.4, 1.8, 3.1], SEALB);
      M.G();
      // flippers: two to drag itself by, a split tail behind
      both((s) => {
        const [sw] = gait(p, s < 0 ? 0 : 0.5);
        M.e([f0 + 2.6 + sw * 1.3 + (p.strike ? 1.4 : 0), 0.7, s * 4.6], [2.5, 0.6, 1.5], SEALD, [s * 28, 0, 0]);
        M.e([f0 - 10, u0 - 1.8 + hump * 0.4, s * 1.5], [2.1, 0.5, 1.1], SEALD, [-s * 30, 12, 0]);
      });
      // the crust: every barnacle a little cone with a dark throat, the big ones toothed
      [[-5, 0, 1.1], [-3, 1.7, 1.4], [-2.4, -1.8, 1.2], [-0.6, 0, 2], [0.8, 2.3, 1.2], [1.8, -1.9, 1.4], [3, 0.4, 1.1]].forEach(([f, s, r], i) => {
        const t = Math.min(1, Math.max(0, (f + 5) / 8)), base = [f0 + f, u0 + 2.4 + t * 1.6 + hump * (1.2 - Math.abs(f + 1) * 0.15) - Math.abs(s) * 0.5, s];
        const tip = [base[0] - 0.3, base[1] + 1.7 * r + (p.idle && i % 2 ? 0.3 : 0), s * 1.25];
        M.tube([base, tip], [r * 1.05, r * 0.6], i % 2 ? BARND : BARN);
        M.dot([tip[0], tip[1] + 0.3, tip[2]], "#2a0a14", r > 1.1 ? 2 : 1, 1);
        if (r > 1.8) { M.eye([tip[0] + 0.2, tip[1] + 0.5, tip[2]], 2, "#e02838"); teeth(M, [tip[0] + 0.9, tip[1] + 0.2, tip[2] - 0.7], [tip[0] + 0.9, tip[1] + 0.2, tip[2] + 0.7], 3, -1, 0.7); }
      });
      // the head: blind milk eyes, and a mouth that opens further back than a seal's should
      const H = [neck[0] + 1.6, neck[1] + 0.9, 0], open = p.strike ? 1 : p.wind ? 0.7 : 0.12;
      M.s(H, 2.3, SEAL);
      M.e([H[0] + 1.9, H[1] - 0.2 + open * 0.5, 0], [1.6, 1, 1.5], SEALB);
      M.e([H[0] + 1.5, H[1] - 1.3 - open * 1.1, 0], [1.5, 0.6, 1.3], SEALD);
      if (open > 0.4) { M.e([H[0] + 1.6, H[1] - 0.9 - open * 0.3, 0], [1.2, open * 0.8, 1.1], C.MAW); teeth(M, [H[0] + 2.4, H[1] - 0.5, -0.9], [H[0] + 2.4, H[1] - 0.5, 0.9], 3, 1, 0.9); }
      M.dot([H[0] + 3.3, H[1] + 0.3, 0], "#241a2a", 1, 1);
      both((s) => M.eye(surf(H, [2.3, 2.3, 2.3], [0.55, 0.35, s * 0.8]), 2, "#c8d4dc"));
    },
  },

  /** 산호 뿔 거북 — an old sea turtle the reef grew through: coral for horns, coral out of one eye, and it still comes ashore every year. */
  coralturtle: {
    size: "xl", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const f0 = lf * 0.7, u0 = 5.4 + lu + bob(p, 0.5);
      legs4(M, p, { ff: 5.6, bf: -5.6, w: 6.4, hu: u0 - 1, r: 2, m: TSKIN, st: 1.7, li: 1.2, foot: TSKIND, splay: 1.3, hock: 0.6 });
      M.tube([[f0 - 8.6, u0 - 0.6, 0], [f0 - 11.4, u0 - 2, 0]], [1.3, 0.5], TSKIND);
      // the shell: a low dome on a paler rim, ridged down the middle
      M.G("shell");
      M.e([f0, u0 - 0.2, 0], [10, 2.3, 8.6], TSHELLL);
      M.e([f0 - 0.4, u0 + 1.6, 0], [9, 5.4, 7.6], TSHELL);
      M.G();
      for (let i = 0; i < 4; i++) M.e([f0 + 5 - i * 3.4, u0 + 5.4 - Math.abs(i - 1.4) * 0.9, 0], [1.5, 1.1, 2.2], TSHELLD);
      // the reef on its back, and the two great branches that serve it for horns
      coral(M, [f0 - 4, u0 + 5, -3], 5, [-1, -1.4]);
      coral(M, [f0 - 2.4, u0 + 5.6, 3.2], 6.4, [-0.6, 1.6]);
      coral(M, [f0 + 1.6, u0 + 6.2, -0.6], 4.2, [0.4, -0.6]);
      const tilt = p.wind ? -1.6 : p.strike ? 2.4 : 0;
      both((s) => coral(M, [f0 + 5.2, u0 + 3.6, s * 5], 7.4, [2.2 + tilt, s * 2.4]));
      // the head on its creased neck: a bone beak, one red eye, and coral where the other was
      const out = p.strike ? 3 : p.wind ? -2.4 : p.hurt ? -1.6 : 0;
      const H = [f0 + 12.6 + out, u0 + 1.8 + (p.strike ? -1 : 0), 0], open = p.strike ? 1 : p.wind ? 0.6 : 0.1;
      M.tube([[f0 + 7.6, u0 - 0.2, 0], [H[0] - 1.6, H[1] - 0.4, 0]], [2.5, 2], TSKIND);
      M.e(H, [3.2, 2.6, 2.7], TSKIN);
      M.cone([H[0] + 2, H[1] + 0.2, 0], [H[0] + 4.4, H[1] - 1.5, 0], 1.4, C.HORN);
      M.e([H[0] + 0.9, H[1] - 1.8 - open * 1.3, 0], [2.3, 0.7, 1.9], TSKIND);
      if (open > 0.4) M.e([H[0] + 1.2, H[1] - 1.3 - open * 0.4, 0], [1.9, open, 1.5], C.MAW);
      M.eye(surf(H, [3, 2.4, 2.5], [0.5, 0.4, 0.9]), 2, "#ff3030");
      coral(M, surf(H, [3, 2.4, 2.5], [0.4, 0.5, -0.9]), 3, [0.5, -1.2]);
    },
  },
  /** 전갈 등뼈 — a scorpion with nothing left on it but the spine: vertebra after vertebra up into the tail, and the sting is a little skull that bites. */
  spinescorp: {
    size: "m", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 2.8 + lu + bob(p, 0.4);
      // rib legs, four a side
      both((s) => {
        for (let i = 0; i < 4; i++) {
          const [sw, up] = gait(p, (i % 2 ? 0.5 : 0) + (s < 0 ? 0 : 0.5));
          const top = [f0 + 2.6 - i * 1.9, u0, s * 1], ft = [f0 + 3.4 - i * 2.2 + sw * 1.1, up * 1.2, s * 5.6];
          M.tube([top, [(top[0] + ft[0]) / 2, u0 + 2.2, s * 4], ft], [0.55, 0.5, 0.35], i % 2 ? VERTD : VERT);
        }
      });
      // the spine: along the ground, then up and over
      const tipAt = p.strike ? [f0 + 7, u0 + 5, 0] : p.wind ? [f0 - 5, u0 + 14.5, 0] : [f0 + 0.5, u0 + 12.5 + (p.idle ? 0.5 : 0), 0];
      const back = [[f0 + 4.4, u0, 0], [f0 + 2.2, u0 + 0.3, 0], [f0, u0 + 0.4, 0], [f0 - 2.2, u0 + 0.3, 0], [f0 - 4.4, u0 + 0.4, 0]];
      const tail = bez([f0 - 6.2, u0 + 1.2, 0], [f0 - 11, u0 + (p.strike ? 12 : 9), 0], tipAt, 6);
      [...back, ...tail].forEach((q, i, A) => {
        const r = i < 5 ? 1.7 - Math.abs(i - 1.5) * 0.12 : 1.5 - (i - 5) * 0.09;
        if (i) M.s([(q[0] + A[i - 1][0]) / 2, (q[1] + A[i - 1][1]) / 2, 0], r * 0.62, SINEW);
        M.s(q, r, i % 2 ? VERTD : VERT);
        // each bone's wings and its thorn
        if (i < A.length - 1) {
          both((s) => M.cone([q[0], q[1] + 0.2, s * r * 0.7], [q[0], q[1] + 0.5, s * (r + 1.6)], 0.5, VERT));
          if (i < 5) M.cone([q[0], q[1] + r * 0.6, 0], [q[0] - 0.3, q[1] + r + 1.6, 0], 0.5, VERT);
        }
      });
      // the sting: a skull the size of a fist, one long fang
      const T = tail[6], sk = [T[0] + 0.8, T[1] - 0.2, 0];
      M.s(sk, 2, C.BONE);
      M.e([sk[0] + 1.3, sk[1] - 1.1, 0], [1.2, 0.8, 1.2], C.BONE);
      both((s) => M.dot([sk[0] + 1.5, sk[1] + 0.4, s * 0.9], "#2a0a14", 1, 1));
      M.eye([sk[0] + 1.5, sk[1] + 0.4, 0.9], 1, "#ff3030");
      M.cone([sk[0] + 1.6, sk[1] - 1.6, 0], [sk[0] + 2.6, sk[1] - 4.4, 0], 0.7, C.TOOTH);
      M.dot([sk[0] + 2.6, sk[1] - 4.4, 0], "#d82838", 1, 2);
      // the arms: two more runs of bone, ending in rib pincers
      const open = p.wind ? 1 : p.strike ? 0.1 : 0.45, re = p.strike ? 1.6 : 0;
      both((s) => {
        const el = [f0 + 6.4, u0 + 1.6, s * 3.6], hd = [f0 + 8.6 + re, u0 + 1 + (p.wind ? 1.6 : 0), s * 3];
        M.tube([[f0 + 4.4, u0 + 0.2, s * 1], el, hd], [0.8, 0.9, 0.8], VERTD);
        pincer(M, hd, [1, 0, -s * 0.25], 1.25, open, VERT, C.BONE);
      });
      both((s) => M.eye([f0 + 5.6, u0 + 0.9, s * 0.8], 1, "#ff3030"));
    },
  },

  /** 독수리 갈비 — a vulture that ate until its chest came open; now it keeps what it finds in there, behind its own ribs. */
  ribvulture: {
    size: "m", hover: 10, glow: "#ff5a5a", k: 1.15,
    draw(M, p) {
      const flap = flapOf(p, [0.7, 0.1, -0.5, 0.1]);
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 7 + lu - flap * 0.6;
      // the open chest: dark inside, ribs over it, and a thigh bone it will not let go of
      M.e([f0 + 0.6, u0 - 0.2, 0], [3.2, 2.7, 2.4], C.CLOT);
      ribs(M, f0 - 1, f0 + 2.6, u0 - 0.4, 3, 4, C.BONE, 0.95);
      M.G("hunch");
      M.e([f0 - 1.6, u0 + 2, 0], [3.8, 2.2, 3.3], VULT, [0, 16, 0]);
      M.e([f0 - 5, u0 + 0.6, 0], [2.6, 0.7, 2.2], VULTD, [0, 20, 0]);
      M.G();
      both((s) => M.tube([[f0 - 0.4, u0 - 2.4, s * 1.1], [f0 + 0.4, u0 - 4.6, s * 1.2]], [0.55, 0.45], HOGD));
      M.tube([[f0 - 2.8, u0 - 5.2, -0.6], [f0 + 3.6, u0 - 5, 0.6]], 0.55, C.BONE);
      M.s([f0 - 3, u0 - 5.2, -0.6], 0.95, C.BONE); M.s([f0 + 3.8, u0 - 5, 0.6], 0.95, C.BONE);
      // a bare neck out of a dirty ruff, and the small hooked head at the end of it
      const dip = p.strike ? 1 : p.wind ? -0.6 : 0;
      const H = [f0 + 6.2 + dip * 1.6, u0 + 1.2 - dip * 2.6, 0];
      M.tube(bez([f0 + 1.6, u0 + 2.6, 0], [f0 + 5, u0 + 5.4 - dip, 0], [H[0] - 0.6, H[1] + 0.6, 0], 5), [1.15, 0.85], NECK);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; M.s([f0 + 1.8 + Math.cos(a) * 0.4, u0 + 2.6 + Math.cos(a) * 1.3, Math.sin(a) * 1.7], 1.05, RUFF); }
      M.e(H, [1.7, 1.5, 1.4], NECK);
      M.cone([H[0] + 1, H[1] + 0.1, 0], [H[0] + 3.2, H[1] - 0.4, 0], 0.85, VULTD);
      M.cone([H[0] + 2.8, H[1] - 0.2, 0], [H[0] + 3.2, H[1] - 1.9, 0], 0.5, VULTD);
      both((s) => M.eye(surf(H, [1.7, 1.5, 1.4], [0.4, 0.4, s * 0.85]), 1, "#ffd040"));
      // broad hanging wings, fingered at the ends
      both((s) => {
        const a = (flap * 46 * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
        const root = [f0 - 1, u0 + 2.6, s * 2.4];
        for (let i = 0; i < 4; i++) {
          const L = 2.4 + i * 2.1;
          M.e([root[0] - i * 0.5, root[1] + sa * L - i * i * 0.22, root[2] + s * ca * L], [2.9 - i * 0.2, 0.5, 1.9], i % 2 ? VULTD : VULT, [0, 0, -s * (flap * 46 - i * 9)]);
        }
        for (let j = 0; j < 3; j++) {
          const L = 9.6, b = [root[0] - 2.4 + j * 1.5, root[1] + sa * L - 3.4, root[2] + s * ca * L];
          M.cone([b[0], b[1] + 0.8, b[2] - s * 0.8], [b[0] - 0.4, b[1] - 1.8, b[2] + s * 1.2], 0.7, j === 1 ? VULTL : VULTD);
        }
      });
    },
  },

  /** 선인장 고슴도치 — a hedgehog that slept one summer under a cactus and woke up as one; the flower on its back opens to look at you. */
  cactushog: {
    size: "s", k: 1.25,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 3.6 + lu + bob(p, 0.5), puff = p.wind ? 1 : p.hurt ? 0.6 : 0;
      legs4(M, p, { ff: 2.4, bf: -2.6, w: 2.4, hu: u0 - 1.6, r: 0.8, m: HOGD, st: 1.2, li: 1, hock: 0.4 });
      const B = [f0 - 0.8, u0 + 1.2, 0], R = [4.6 + puff * 0.4, 4.1 + puff * 0.4, 4.3 + puff * 0.4];
      M.e(B, R, CACT);
      // the ribs of a barrel cactus, and a thorn at every knot of them
      for (let j = -2; j <= 2; j++) {
        const s = Math.sin(j * 0.55), c = Math.cos(j * 0.55), line = [];
        for (let a = -70; a <= 110; a += 30) { const t = (a * Math.PI) / 180; line.push(surf(B, R, [-Math.sin(t) * c * 0.9, Math.cos(t) * c + 0.05, s])); }
        M.seam(line, "#2c5a34");
      }
      for (let j = -2; j <= 2; j++) for (let a = -60; a <= 105; a += 33) {
        const t = ((a + (j & 1) * 16) * Math.PI) / 180, s = Math.sin(j * 0.55 + 0.27), c = Math.cos(j * 0.55 + 0.27), d = [-Math.sin(t) * c * 0.9, Math.cos(t) * c + 0.05, s];
        const q = surf(B, R, d), l = 1.9 + puff * 1.2;
        M.cone(q, [q[0] + d[0] * l, q[1] + d[1] * l, q[2] + d[2] * l], 0.42, C.NAIL);
      }
      // the flower: petals round an eye
      const F = [B[0] - 0.4, B[1] + R[1] + 0.4, 0];
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; M.s([F[0] + Math.cos(a) * 1.5, F[1] + (p.wind ? 0.5 : 0), Math.sin(a) * 1.5], 1, FLOWER); }
      M.s([F[0], F[1] + 0.5, 0], 1, C.EYEW); M.eye([F[0] + 0.3, F[1] + 1, 0.3], 2, "#e02838");
      // the little face it kept
      const H = [f0 + 4 + (p.strike ? 1 : 0), u0 - 0.4, 0], open = p.strike ? 1 : p.wind ? 0.5 : 0;
      M.e(H, [2.2, 1.8, 2], HOGF);
      M.cone([H[0] + 1.4, H[1] + 0.1 + open * 0.3, 0], [H[0] + 3.6, H[1] - 0.2 + open * 0.6, 0], 0.9, HOGF);
      M.dot([H[0] + 3.6, H[1] - 0.2 + open * 0.6, 0], "#241a2a", 1, 1);
      if (open) { M.e([H[0] + 1.6, H[1] - 1.1, 0], [1.3, 0.5 + open * 0.4, 1], C.MAW); teeth(M, [H[0] + 2.2, H[1] - 0.6, -0.6], [H[0] + 2.2, H[1] - 0.6, 0.6], 3, 1, 0.7); }
      both((s) => { M.eye(surf(H, [2.2, 1.8, 2], [0.5, 0.45, s * 0.75]), 1, "#ff3030"); M.s([H[0] - 0.6, H[1] + 1.5, s * 1.4], 0.6, HOGD); });
    },
  },

  /** 모래 지렁이 아가리 — all you see is the mound moving; then the sand stands up, and the top of it is a ring of teeth round one wet eye. */
  sandmaw: {
    size: "l", n: 74,
    draw(M, p) {
      const [lf] = lunge(p, 1);
      const f0 = lf * 0.4, up = p.walk ? 0.5 + Math.sin(p.ph * Math.PI * 2) * 0.1 : p.hurt ? 0.8 : 1, sway = p.idle ? 0.6 : 0;
      // the mound it travels in
      M.G("mound");
      M.e([f0, 0.7, 0], [7.4, 1.5, 7.4], SAND);
      M.e([f0 - 0.4, 1.5, 0], [4.6, 1.2, 4.6], SANDD);
      M.G();
      if (p.walk) for (let i = 0; i < 5; i++) { const a = i * 1.3 + p.ph * 6; M.s([f0 - 5 + Math.cos(a) * 3, 1.6 + (i % 2) * 1.2, Math.sin(a) * 5.6], 0.7, SAND); }
      // the worm, ring on ring
      const H = p.strike ? [f0 + 9, 6, 0] : p.wind ? [f0 - 2.6, 17, 0] : [f0 + 3.4 + sway, 4 + 11 * up, 0];
      const body = bez([f0 - 1, 1, 0], [f0 - 3.4 - (p.strike ? 1 : 0), (p.strike ? 12 : 10) * up, 0], H, 7);
      M.G("worm");
      body.forEach((q, i) => { if (i < 7) M.s(q, 3.6 - i * 0.1, i % 2 ? WORMD : WORM); });
      M.G();
      body.forEach((q, i) => { if (i > 1 && i < 7) M.s([q[0] + 2.4, q[1] - 0.6, 0], 1.5, WORMB); });
      // the mouth: straight ahead of the last ring
      const P = body[6], l = Math.hypot(H[0] - P[0], H[1] - P[1]) || 1, d = [(H[0] - P[0]) / l, (H[1] - P[1]) / l], n = [-d[1], d[0]];
      const at = (a, r, o) => [H[0] + d[0] * o + n[0] * Math.cos(a) * r, H[1] + d[1] * o + n[1] * Math.cos(a) * r, Math.sin(a) * r];
      const open = p.wind ? 1 : p.strike ? 0.2 : 0.6;
      M.s(H, 3.7, WORM);
      M.s(at(0, 0, 1.6), 2.9, C.MAW);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; M.s(at(a, 2.9, 1.5), 0.9, C.RAW); M.cone(at(a, 2.7, 2.2), at(a, 1 + open * 0.5, 3.6), 0.6, C.TOOTH); }
      M.s(at(0, 0, 2.6), 1.1, C.EYEW); M.eye(at(0, 0, 3.6), 2, "#ffb020");
      // four hooks outside the ring, opening like a flower
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.8; M.tube([at(a, 3.3, 0.6), at(a, 4.6 + open * 1.6, 3), at(a, 3 + open * 2.4, 5.6)], [1.1, 0.8, 0.3], C.HORN); }
    },
  },

  /** 미라 낙타 — a caravan's camel, wrapped and buried with its master and dug up wrong: two heads now, one still bandaged, one worn down to the skull. */
  mummycamel: {
    size: "xl", n: 96, glow: "#40d8b0", k: 1.25,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const f0 = lf * 0.7, u0 = 11.4 + lu + bob(p, 0.6);
      legs4(M, p, { ff: 5.4, bf: -5.6, w: 2.7, hu: u0 - 1.6, r: 1.25, m: LINEN, st: 2.6, li: 1.8, foot: DRY, hock: 1.6 });
      M.tube([[f0 - 7.6, u0 + 1.4, 0], [f0 - 9.4, u0 - 2, 0], [f0 - 9, u0 - 5 + (p.idle ? 0.4 : 0), 0]], [0.7, 0.5, 0.4], LINEND);
      M.G("body");
      M.e([f0, u0, 0], [8, 4.4, 4.2], LINEN);
      M.e([f0 + 2.8, u0 + 4.2, 0], [3, 3.2, 2.8], LINEN);
      M.G();
      // the back hump has burst: dry meat and the ribs that held it
      M.e([f0 - 3.4, u0 + 3.8, 0], [3, 2.8, 2.7], DRY);
      ribs(M, f0 - 5, f0 - 1.8, u0 + 3.6, 3.1, 3, C.BONE, 0.9);
      // wrappings: bands across the barrel and the hump, and the ends that came loose
      for (const f of [-6.2, -1, 1.6, 4.4, 6.6]) { const k = Math.sqrt(1 - (f / 8) ** 2); M.e([f0 + f, u0, 0], [0.55, 4.5 * k, 4.3 * k], LINEND); }
      const fl = Math.sin((p.walk ? p.ph : p.idle * 0.25) * Math.PI * 2) * 0.8;
      M.tube([[f0 + 1, u0 - 4, 2.6], [f0 - 0.6 - fl, u0 - 7, 3.2], [f0 - 2.4 - fl * 1.6, u0 - 8.4, 3]], [0.6, 0.5, 0.3], LINEND);
      M.tube([[f0 - 4.6, u0 - 3.6, -2.4], [f0 - 6 - fl, u0 - 6.4, -2.8]], [0.6, 0.3], LINEND);
      // two necks from one chest: one carried high, one hung low
      const hi = p.wind ? 3 : p.strike ? -2 : 0, lo = p.strike ? 4 : p.wind ? -2 : 0;
      const H1 = [f0 + 10.4 - hi * 0.4, u0 + 10.5 + hi * 0.6 + (p.idle ? 0.4 : 0), -3.4], H2 = [f0 + 13.4 + lo, u0 - 0.4 - lo * 0.3, 3.8];
      M.tube(bez([f0 + 6.4, u0 + 1.6, -1.2], [f0 + 8, u0 + 6, -2], [H1[0] - 1.4, H1[1] - 0.6, H1[2]], 5), [2.2, 1.45], LINEN);
      M.tube(bez([f0 + 6.6, u0 + 0.2, 1.2], [f0 + 9, u0 - 2.6, 2.2], [H2[0] - 1.6, H2[1] + 0.2, H2[2]], 5), [2.1, 1.4], LINEND);
      // the high head: still wrapped, one light showing through the cloth
      M.e(H1, [2.9, 1.9, 1.7], LINEN, [0, -18, 0]);
      M.e([H1[0] + 2.4, H1[1] - 1.1, H1[2]], [1.6, 1.2, 1.3], LINEND);
      M.seam([[H1[0] + 0.6, H1[1] + 1.8, H1[2] - 1], [H1[0] + 1, H1[1] + 0.4, H1[2] + 1.6], [H1[0] + 1.6, H1[1] - 1.4, H1[2] + 1.2]], "#8a7654");
      M.s([H1[0] + 0.8, H1[1] + 0.5, H1[2] + 1.5], 0.9, CURSE); M.s([H1[0] + 0.8, H1[1] + 0.5, H1[2] - 1.5], 0.9, CURSE);
      both((s) => M.cone([H1[0] - 1.6, H1[1] + 1.2, H1[2] + s * 1.2], [H1[0] - 2.6, H1[1] + 2.8, H1[2] + s * 1.8], 0.6, LINEND));
      M.tube([[H1[0] + 1.6, H1[1] - 2, H1[2]], [H1[0] + 1 - fl, H1[1] - 5, H1[2] + 0.4]], [0.5, 0.3], LINEND);
      // the low head: a skull with its teeth and the same light in the sockets
      const open = p.strike ? 1 : p.wind ? 0.5 : 0.15;
      M.e(H2, [3.1, 2.1, 2], C.BONE, [0, -8, 0]);
      M.e([H2[0] + 2.3, H2[1] - 0.2, H2[2]], [1.7, 1.1, 1.3], C.BONE);
      M.e([H2[0] + 1.6, H2[1] - 1.7 - open * 1.4, H2[2]], [2.2, 0.55, 1.2], C.BONEB, [0, -open * 16, 0]);
      if (open > 0.3) M.e([H2[0] + 1.8, H2[1] - 1.2 - open * 0.5, H2[2]], [1.8, open * 0.9, 1], C.MAW);
      teeth(M, [H2[0] + 1.2, H2[1] - 0.9, H2[2] + 1.1], [H2[0] + 3.4, H2[1] - 0.9, H2[2] + 1.1], 4, 1, 0.8);
      both((s) => M.s([H2[0] + 0.7, H2[1] + 0.6, H2[2] + s * 1.6], 0.9, CURSE));
    },
  },
  /** 덩굴 원숭이 — a monkey the creepers grew into: its arms are vines now, and the tail it hangs by ends in a flytrap that eats first. */
  vinemonkey: {
    size: "m", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 5.6 + lu + bob(p, 0.6);
      both((s) => { const [sw, up] = gait(p, s < 0 ? 0.5 : 0); M.tube([[f0 - 3, u0 - 1, s * 1.6], [f0 - 3.8, u0 * 0.45 + up, s * 2.5], [f0 - 2.4 + sw * 1.2, up * 1.2 + 0.5, s * 2.3]], [1.2, 0.9, 0.8], MONKD); });
      // the tail: up, over, and a mouth at the end of it
      const snap = p.strike ? 1 : 0, T = snap ? [f0 + 8.6, u0 + 2.6, 0] : p.wind ? [f0 - 1, u0 + 13.5, 0] : [f0 + 3, u0 + 10.4 + (p.idle ? 0.6 : 0), 0];
      const tail = bez([f0 - 3.8, u0 + 0.8, 0], [f0 - 9.5, u0 + (snap ? 13 : 12), 0], T, 7);
      M.tube(tail, [0.95, 0.65], VINE);
      tail.forEach((q, i) => { if (i % 2 && i < 7) M.e([q[0], q[1] + 0.7, (i % 4 === 1 ? 1 : -1) * 1.1], [1.2, 0.4, 0.9], LEAFJ, [0, 0, 30]); });
      const gape = p.wind ? 1 : snap ? 0.1 : 0.55;
      M.e([T[0] + 1.4, T[1] - 0.1, 0], [1.7, gape * 1 + 0.25, 1.5], TRAPR);
      M.e([T[0] + 1.6, T[1] + 0.6 + gape * 0.9, 0], [2.5, 0.9, 2], TRAP, [0, gape * 22 - 8, 0]);
      M.e([T[0] + 1.6, T[1] - 0.8 - gape * 0.9, 0], [2.5, 0.9, 2], TRAP, [0, -gape * 22 - 8, 0]);
      both((s) => {
        teeth(M, [T[0] + 0.8, T[1] + 0.3 + gape * 0.7, s * 1.7], [T[0] + 3.8, T[1] + gape * 1.5, s * 0.6], 3, 1, 1);
        teeth(M, [T[0] + 0.8, T[1] - 0.5 - gape * 0.7, s * 1.7], [T[0] + 3.8, T[1] - 0.6 - gape * 1.5, s * 0.6], 3, -1, 1);
      });
      M.G("body");
      M.e([f0 - 0.8, u0 + 0.6, 0], [3.8, 3, 2.9], MONK, [0, 24, 0]);
      M.e([f0 + 0.9, u0 - 0.5, 0], [2, 1.8, 2], MONKF);
      M.G();
      // arms gone to vine, too long, knuckles on the ground
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0 : 0.5), reach = p.strike ? 2 : p.wind ? -1 : sw * 1.6;
        const sh = [f0 + 1.4, u0 + 2.2, s * 2.6], el = [f0 + 4.4 + reach * 0.4, u0 + 3.2, s * 5.4], hd = [f0 + 6 + reach, 0.9 + up * 1.6 + (p.wind ? 3 : 0), s * 4.4];
        M.tube([sh, el, hd], [1, 0.8, 0.7], VINE);
        M.e([el[0], el[1] + 0.8, el[2] + s * 0.4], [1.3, 0.4, 1], LEAFJ, [0, 0, -s * 30]);
        M.s(hd, 1.25, VINED);
      });
      const H = [f0 + 2.8 + (p.strike ? 0.8 : 0), u0 + 4.4, 0], open = p.strike ? 1 : p.wind ? 0.6 : 0.25;
      M.s(H, 2.5, MONK);
      M.e([H[0] + 1.3, H[1] - 0.3, 0], [1.6, 1.7, 1.8], MONKF);
      M.e([H[0] + 2.3, H[1] - 1.2, 0], [0.9, 0.35 + open * 0.6, 1.4], C.MAW);
      teeth(M, [H[0] + 2.9, H[1] - 0.9, -0.9], [H[0] + 2.9, H[1] - 0.9, 0.9], 4, 1, 0.6);
      both((s) => { M.eye(surf(H, [2.5, 2.5, 2.5], [0.7, 0.25, s * 0.5]), 2, "#b4e020"); M.s([H[0] - 0.4, H[1] + 0.5, s * 2.5], 0.9, MONKF); });
    },
  },

  /** 독개구리 떼 — a heap of dart frogs that stuck where they touched; the heap hops as one, and the top one sings before the tongue comes out. */
  dartbrood: {
    size: "s", n: 50, glow: "#f0d030", k: 1.4,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const hop = p.walk ? Math.abs(Math.sin(p.ph * Math.PI * 2)) * 2 : 0, sq = p.wind ? 0.82 : 1;
      const f0 = lf, u0 = 2 + lu + hop;
      const F = [[2.4, 0, 0, 0, 1.05], [-1.5, 0.2, 2.5, 60, 0.95], [-1.5, 0.2, -2.5, -60, 0.95], [0, 3.3, 0, 0, 0.9]];
      F.forEach(([f, u, s, yaw, k], i) => {
        const a = (yaw * Math.PI) / 180, fd = [Math.cos(a), 0, Math.sin(a)], sd = [-fd[2], 0, fd[0]], b = [f0 + f, u0 + u * sq, s], m = i === 3 ? DARTY : DART, top = i === 3;
        // legs: the ones below stand, the ones above hold on
        [-1, 1].forEach((w) => {
          const hip = [b[0] - fd[0] * 0.8 * k + sd[0] * w * 1.5 * k, b[1] - 0.2, b[2] - fd[2] * 0.8 * k + sd[2] * w * 1.5 * k];
          const ft = i < 3 ? [hip[0] + sd[0] * w * 1.6 - fd[0] * (hop ? 1.6 : 0), 0.4 + hop * 0.3, hip[2] + sd[2] * w * 1.6 - fd[2] * (hop ? 1.6 : 0)] : [hip[0] + sd[0] * w * 0.6, hip[1] - 1.8, hip[2] + sd[2] * w * 0.6];
          M.tube([hip, [(hip[0] + ft[0]) / 2 + sd[0] * w * 0.8, hip[1] + 0.6, (hip[2] + ft[2]) / 2 + sd[2] * w * 0.8], ft], [0.6, 0.5, 0.42], DARTK);
        });
        M.e(b, [2.3 * k, 1.7 * k, 2 * k], m, [yaw, 12, 0]);
        M.dot([b[0] - fd[0] * 0.8, b[1] + 1.6 * k, b[2] - fd[2] * 0.8], i === 3 ? "#201820" : "#101a50", 1, 1);
        M.dot([b[0] + sd[0] * 1.2, b[1] + 1.2 * k, b[2] + sd[2] * 1.2], i === 3 ? "#201820" : "#f0d030", 1, 1);
        [-1, 1].forEach((w) => {
          const e = [b[0] + fd[0] * 1.2 * k + sd[0] * w * 1.05 * k, b[1] + 1.35 * k, b[2] + fd[2] * 1.2 * k + sd[2] * w * 1.05 * k];
          M.s(e, 0.78 * k, m); M.eye([e[0] + fd[0] * 0.5, e[1] + 0.2, e[2] + fd[2] * 0.5], 1, i === 3 ? "#e02838" : "#ffe040");
        });
        if (i === 3 && (p.wind || p.idle)) M.s([b[0] + 1.3, b[1] - 0.5, 0], p.wind ? 1.5 : 1, SAC);
        if (i === 0) { M.seam([[b[0] + 2.1, b[1] - 0.2, -1.2], [b[0] + 2.4, b[1] - 0.4, 0], [b[0] + 2.1, b[1] - 0.2, 1.2]], "#0c1440"); if (p.strike) { M.tube([[b[0] + 2, b[1] - 0.2, 0], [b[0] + 6.4, b[1] + 0.8, 0]], [0.45, 0.6], C.TONGUE); M.s([b[0] + 6.8, b[1] + 0.9, 0], 0.9, C.TONGUE); } }
      });
    },
  },

  /** 난초 사마귀 — it stands in the flowers as one of them; the petals are its legs, the pink is a warning, and the two blades are the last thing in bloom. */
  orchidmantis: {
    size: "m", n: 60, glow: "#ff8ac0", k: 1.12,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 4 + lu + bob(p, 0.5), sway = p.idle ? 0.5 : 0;
      both((s) => {
        for (let i = 0; i < 2; i++) {
          const [sw, up] = gait(p, (i ? 0.5 : 0) + (s < 0 ? 0 : 0.5));
          const top = [f0 - 0.6 - i * 2, u0, s * 0.8], kn = [f0 + 0.6 - i * 4, u0 + 2.4, s * 4.4], ft = [f0 + 1.6 - i * 5.4 + sw * 1.3, up * 1.3, s * 5.8];
          M.tube([top, kn, ft], [0.42, 0.38, 0.28], OMAG);
          M.e([(top[0] + kn[0]) / 2, (top[1] + kn[1]) / 2 + 0.3, (top[2] + kn[2]) / 2], [1.2, 0.4, 1], OPINK, [0, 0, -s * 35]);
        }
      });
      // the abdomen: swollen and curled up behind, lobed like a lip
      const A = [f0 - 5, u0 + 1, 0];
      M.G("abd");
      M.e(A, [4.6, 1.6, 1.9], OPET, [0, -10, 0]);
      M.s([A[0] - 4.4, A[1] + 1.2, 0], 1, OPINK);
      M.G();
      both((s) => M.e([A[0] - 0.6, A[1] + 0.6, s * 2], [3, 0.4, 1.3], OPINK, [0, -10, s * 30]));
      M.seam([[A[0] + 3, A[1] + 1, 0], [A[0], A[1] + 1.9, 0], [A[0] - 3.4, A[1] + 2.2, 0]], "#b83a78");
      // the thorax upright, a collar of petals, the three-cornered head
      const N = [f0 + 2.6 + (p.strike ? 2 : 0) + sway * 0.4, u0 + 11 - (p.strike ? 2.4 : 0), 0];
      M.tube([[f0 - 1, u0 + 0.6, 0], [f0 + 0.8, u0 + 5, 0], N], [1.3, 1, 0.8], OPET);
      for (let i = 0; i < 5; i++) { const a = ((-100 + i * 50) * Math.PI) / 180; M.e([N[0] - 1, N[1] - 0.8 + Math.cos(a) * 2.5, Math.sin(a) * 2.7], [0.5, 1.5, 1.5], i % 2 ? OPINK : OPET, [0, 0, -100 + i * 50]); }
      const H = [N[0] + 1, N[1] + 0.9, 0];
      M.e(H, [1.3, 1.2, 2.1], OPET);
      both((s) => {
        M.s([H[0] + 0.3, H[1] + 0.4, s * 1.9], 0.95, OMAG); M.eye([H[0] + 0.9, H[1] + 0.5, s * 2], 1, "#ffe040");
        M.tube([[H[0], H[1] + 1, s * 0.6], [H[0] - 1.6, H[1] + 3.6, s * 1.4]], 0.3, OMAG);
        M.cone([H[0] + 1, H[1] - 0.8, s * 0.4], [H[0] + 1.6, H[1] - 2, s * 0.2], 0.4, OMAG);
      });
      // the blades
      both((s) => {
        const raise = p.wind ? 1 : 0, cut = p.strike ? 1 : 0, sh = [N[0] - 0.4, N[1] - 1.6, s * 1.3];
        const el = [sh[0] + 3.2 + cut * 1.4, sh[1] + 2.4 + raise * 2 - cut * 2, s * 2.8];
        const tip = cut ? [el[0] + 4, el[1] - 4, s * 2] : raise ? [el[0] + 1.8, el[1] + 5, s * 3.4] : [el[0] + 1.6, el[1] - 4.2, s * 2.4];
        M.tube([sh, el], [0.8, 0.95], OPINK);
        M.e([(sh[0] + el[0]) / 2, (sh[1] + el[1]) / 2 + 0.7, (sh[2] + el[2]) / 2], [1.4, 0.5, 1], OPET);
        M.tube([el, tip], [1.05, 0.3], OMAG);
        for (let j = 1; j < 4; j++) { const t = j / 4, q = [el[0] + (tip[0] - el[0]) * t, el[1] + (tip[1] - el[1]) * t, el[2] + (tip[2] - el[2]) * t]; M.cone(q, [q[0] + 1.2, q[1] + 0.3, q[2]], 0.4, C.TOOTH); }
      });
    },
  },

  /** 악어 통나무 — a gator that lay in the river so long the log it hid in grew shut round it; the log walks now, and one end of it opens. */
  loggator: {
    size: "xl", n: 96, k: 1.05,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.3);
      const f0 = lf * 0.8, u0 = 5.2 + lu + bob(p, 0.5), open = p.strike ? 0.12 : p.wind ? 1 : p.idle ? 0.3 : 0.22;
      legs4(M, p, { ff: 4.6, bf: -6, w: 4.6, hu: u0 - 1, r: 1.6, m: GAT, st: 2, li: 1.2, foot: GATD, splay: 1.5, hock: 0.8 });
      const sw = p.walk ? Math.sin(p.ph * Math.PI * 2) * 2.4 : p.strike ? -2.4 : p.idle ? 0.8 : 0;
      M.tube([[f0 - 8.6, u0 - 0.4, 0], [f0 - 13, u0 - 1.4, sw * 0.6], [f0 - 17.5, u0 - 2.8, sw * 1.6]], [2.6, 1.8, 0.5], GAT);
      for (let i = 0; i < 4; i++) M.cone([f0 - 10.4 - i * 1.8, u0 + 1.4 - i * 0.7, sw * 0.2 * i], [f0 - 10.8 - i * 1.8, u0 + 3 - i * 0.8, sw * 0.2 * i], 0.65, GATD);
      // the log: bark, the sawn end with its rings, moss and brackets, one branch still in leaf
      M.G("log");
      M.tube([[f0 - 8.4, u0, 0], [f0 + 5, u0 + 0.2, 0]], 4.3, BARKJ);
      M.G();
      M.e([f0 - 9.3, u0, 0], [0.9, 4, 4], RINGS); M.e([f0 - 9.9, u0, 0], [0.6, 2.5, 2.5], C.MAW);
      both((s) => { M.seam([[f0 - 8, u0 + 3.9, s * 1.8], [f0 + 4, u0 + 4.1, s * 1.8]], "#3a2a22"); M.seam([[f0 - 8, u0 + 1.6, s * 4], [f0 + 4, u0 + 1.8, s * 4]], "#3a2a22"); });
      M.e([f0 - 3.4, u0 + 4, 0.8], [3.6, 1, 2.6], MOSS); M.e([f0 + 2.4, u0 + 4.2, -1.2], [2.2, 0.8, 1.8], MOSS);
      both((s) => { M.e([f0 - 5.6, u0 + 1.4, s * 4.2], [1.4, 0.5, 1.2], SHROOM); M.e([f0 - 4.2, u0 + 0.2, s * 4.3], [1, 0.4, 0.9], SHROOM); });
      M.tube([[f0 - 0.6, u0 + 3.6, -2.4], [f0 - 2, u0 + 7.6, -4]], [1.1, 0.5], BARKJD);
      M.s([f0 - 2.2, u0 + 8.4, -4.2], 1.5, LEAFJ); M.s([f0 - 0.8, u0 + 7.4, -3.2], 1.1, MOSS);
      M.cone([f0 + 1.6, u0 + 3.8, 2.6], [f0 + 2.4, u0 + 6, 3.8], 0.8, BARKJD);
      // the end that opens
      const J = [f0 + 5, u0 + 0.2, 0];
      M.e([J[0] + 3, J[1] - 0.2 + open * 0.8, 0], [3.8, 0.7 + open * 2.2, 2.9], C.MAW);
      if (open > 0.5) M.e([J[0] + 3.6, J[1] - 1.9 - open * 0.8, 0], [2.8, 0.5, 1.5], C.TONGUE);
      M.e([J[0] + 4.4, J[1] + 1.5 + open * 2.6, 0], [5.4, 1.9, 3.7], BARKJ, [0, open * 24, 0]);
      M.e([J[0] + 4, J[1] - 2.2 - open * 1.2, 0], [5, 1.4, 3.3], GATB, [0, -open * 12, 0]);
      both((s) => {
        teeth(M, [J[0] + 1.6, J[1] + 0.5 + open * 1.6, s * 3.3], [J[0] + 9, J[1] + 0.3 + open * 4.8, s * 1.7], 5, 1, 1.5);
        teeth(M, [J[0] + 1.6, J[1] - 1.5 - open * 0.8, s * 3], [J[0] + 8.4, J[1] - 1.7 - open * 2.4, s * 1.5], 4, -1, 1.3);
        const e = [f0 + 4.4, u0 + 4 + open * 1.4, s * 2.3];
        M.s(e, 1.35, BARKJD); M.eye([e[0] + 0.7, e[1] + 0.7, e[2] + s * 0.5], 2, "#e8c020");
        M.s([J[0] + 9.2, J[1] + 2.4 + open * 5, s * 0.9], 0.6, BARKJD);
      });
    },
  },

  /** 염주 원숭이 — five snub-nosed monkeys strung on one spine like the beads of a rosary; they walk as a loop, and the whole string strikes like a whip. */
  beadmonkey: {
    size: "m", n: 60, k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const st = p.walk ? Math.sin(p.ph * Math.PI * 2) : 0;
      const span = 6 + st * 1.6, top = 13.4 - st * 1.8 + (p.idle ? 0.5 : 0) + lu;
      const A = p.strike ? [lf + 10, 4.6, 0] : p.wind ? [lf + 3, 15, 0] : [lf + span, 2.5, 0], B = [lf - span, 2.5, 0];
      const arc = bez(A, [lf + (p.strike ? 1 : p.wind ? -3.6 : 0), p.strike ? top + 2 : top * 2 - 2.5, 0], B, 8);
      M.tube(arc, 0.5, C.BONE);
      // the tassel behind the last of them
      M.s([B[0] - 1.8, 2, 0], 1.5, BEAD);
      M.tube([[B[0] - 2.8, 1.8, 0], [B[0] - 4.4, 1.2, st * 0.6], [B[0] - 6, 0.9, st * 1.2]], [0.5, 0.9, 1.3], TASSEL);
      arc.forEach((q, i) => {
        if (i % 2) { M.s(q, 1.35, BEAD); return; }
        const lead = i === 0, sd = [0, 1, -1, 1, 0][i / 2], r = lead ? 2.7 : 2.3;
        both((s) => M.tube([[q[0], q[1] - 0.6, s * r * 0.8], [q[0] + (lead ? 1 : -0.2), Math.max(0.5, q[1] - r - 1.4), s * (r * 0.8 + 0.8)]], [0.55, 0.42], GOLDMD));
        M.s(q, r, i % 4 ? GOLDMD : GOLDM);
        const fc = [q[0] + r * 0.62, q[1] - 0.1, q[2] + sd * r * 0.5];
        M.e(fc, [r * 0.6, r * 0.72, r * 0.76], FACEB);
        both((s) => M.eye([fc[0] + r * 0.45, fc[1] + 0.35, fc[2] + s * 0.65], 1, "#ff3030"));
        const open = lead ? (p.strike ? 1 : p.wind ? 0.7 : 0.3) : i === 4 && p.wind ? 0.6 : 0;
        if (open) { M.e([fc[0] + r * 0.36, fc[1] - 0.75, fc[2]], [0.6, 0.25 + open * 0.5, 0.85], C.MAW); if (lead) teeth(M, [fc[0] + r * 0.5, fc[1] - 0.5, fc[2] - 0.6], [fc[0] + r * 0.5, fc[1] - 0.5, fc[2] + 0.6], 3, 1, 0.6); }
      });
    },
  },

  /** 겹날개 두루미 — a crane with six wings where two would do, and a neck it tied in a knot to keep the cry in. */
  wingcrane: {
    size: "m", n: 64, hover: 9, glow: "#f0f4ff", k: 1.15,
    draw(M, p) {
      const fl = flapOf(p, [0.8, 0.1, -0.6, 0.1]);
      const [lf, lu] = lunge(p);
      const f0 = lf, u0 = 8 + lu - fl * 0.5;
      both((s) => M.tube([[f0 - 2, u0 - 1.4, s * 0.8], [f0 - 5.6, u0 - 3.6, s * 0.9], [f0 - 9.4, u0 - 3.2, s * 1]], [0.5, 0.4, 0.35], WCRK));
      M.G("body");
      M.e([f0, u0, 0], [4.4, 2.3, 2.2], WCR, [0, 10, 0]);
      M.e([f0 - 4.2, u0 - 0.2, 0], [2.6, 1.3, 1.8], WCRK, [0, -14, 0]);
      M.G();
      // three pairs of wings, beating out of step
      both((s) => {
        wing(M, [f0 + 1.4, u0 + 1.6, s * 1.4], s, 30 + fl * 34, 5, 2.1, 2, [WCR, WCR, WCR, WCRK, WCRK]);
        wing(M, [f0 - 0.2, u0 + 0.6, s * 1.6], s, -fl * 30, 4, 2.1, 1.9, [WCR, WCR, WCRK, WCRK], 0.7);
        wing(M, [f0 - 1.8, u0 - 0.4, s * 1.4], s, -32 + fl * 26, 3, 2, 1.7, [WCR, WCRK, WCRK], 0.9);
      });
      // the neck: up, once round itself, and on to the red crown and the long bill
      const dip = p.strike ? 1 : p.wind ? -0.7 : 0;
      const K = [f0 + 5, u0 + 4.4, 0], H = [f0 + 8 + dip * 2.4, u0 + 8.4 - dip * 4.8, 0];
      M.tube(bez([f0 + 3.4, u0 + 0.8, 0], [f0 + 5.4, u0 + 1.6, 0], [K[0] - 0.9, K[1] - 1, 0], 4), [1.1, 0.8], WCR);
      const loop = [];
      for (let a = -120; a <= 240; a += 40) { const t = (a * Math.PI) / 180; loop.push([K[0] + Math.cos(t) * 1.6, K[1] + Math.sin(t) * 1.6, Math.sin(t * 0.5) * 0.9]); }
      M.tube(loop, 0.78, WCR);
      M.tube(bez([K[0] + 0.8, K[1] + 1.2, 0], [K[0] + 1.2, K[1] + 4.6 - dip, 0], [H[0] - 0.8, H[1] - 0.2, 0], 4), [0.8, 0.65], WCRK);
      M.e(H, [1.5, 1.3, 1.2], WCR);
      M.e([H[0] - 0.1, H[1] + 0.9, 0], [1.1, 0.6, 0.9], CROWNR);
      M.cone([H[0] + 1, H[1] - 0.1, 0], [H[0] + 5.6, H[1] - 1 - dip * 0.8, 0], 0.7, C.HORN);
      both((s) => M.eye(surf(H, [1.5, 1.3, 1.2], [0.4, 0.2, s * 0.9]), 1, "#ff3030"));
    },
  },

  /** 운해의 범 — the mountain's white tiger, three faces stacked on one neck; where the stripes cross its ribs they have opened into mouths. */
  mistiger: {
    size: "xl", n: 98, glow: "#bfe8ff", k: 1.12,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.4);
      const f0 = lf, u0 = 8 + lu + bob(p, 0.6);
      legs4(M, p, { ff: 5.6, bf: -5.6, w: 3, hu: u0 - 1.4, r: 1.7, m: TIG, st: 2.6, li: 1.8, foot: TIGS, hock: 1.6 });
      const tw = p.walk ? Math.sin(p.ph * Math.PI * 2) : p.idle ? 0.5 : 0;
      const tail = bez([f0 - 7.4, u0 + 1, 0], [f0 - 13.5, u0 - 2, tw], [f0 - 13.6, u0 + 7 + tw * 0.6, tw * 1.6], 6);
      tail.forEach((q, i) => M.s(q, 1.25 - i * 0.03, i % 2 ? STRIPE : TIG));
      M.s(tail[6], 1.9, MIST); M.s([tail[6][0] - 1.4, tail[6][1] + 1, tail[6][2]], 1.3, MIST);
      M.G("body");
      M.e([f0 - 1, u0, 0], [7.4, 3.9, 3.8], TIG);
      M.e([f0 + 4.6, u0 + 0.8, 0], [4.4, 4.6, 4.2], TIG);
      M.e([f0, u0 - 2.2, 0], [6, 1.8, 3], TIGS);
      M.G();
      // stripes over the back; two of them are mouths
      const gape = p.wind ? 1 : p.strike ? 0.7 : p.idle ? 0.35 : 0.2;
      [-6.2, -4, -1.8, 0.6, 3, 5.4].forEach((f, j) => {
        const big = f > 2, c = big ? [f0 + 4.6, u0 + 0.8] : [f0 - 1, u0], R = big ? [4.4, 4.6, 4.2] : [7.4, 3.9, 3.8];
        const k = Math.sqrt(Math.max(0.06, 1 - ((f0 + f - c[0]) / R[0]) ** 2)) * 1.03, line = [];
        for (let a = -72; a <= 72; a += 18) { const t = (a * Math.PI) / 180; line.push([f0 + f, c[1] + Math.cos(t) * R[1] * k, Math.sin(t) * R[2] * k]); }
        M.tube(line, 0.42, STRIPE);
        if (j === 2 || j === 4) both((s) => {
          const t = (s * 62 * Math.PI) / 180, m = [f0 + f, c[1] + Math.cos(t) * R[1] * k, Math.sin(t) * R[2] * k];
          M.e(m, [1.8, 0.45 + gape * 0.8, 0.8], C.MAW);
          M.dot([m[0] - 0.7, m[1] + 0.2 + gape * 0.4, m[2] + s * 0.8], "#f4eedc", 1, 1); M.dot([m[0] + 0.7, m[1] + 0.2 + gape * 0.4, m[2] + s * 0.8], "#f4eedc", 1, 1);
          M.dot([m[0], m[1] - 0.3, m[2] + s * 0.8], "#e02838", 1, 1);
        });
      });
      // three faces on the one neck: the lowest roars, the middle watches, the top one sleeps
      const roar = p.strike ? 1 : p.wind ? 0.7 : 0.12, out = p.strike ? 2 : p.wind ? -1.4 : 0;
      M.tube([[f0 + 6.4, u0 + 2, 0], [f0 + 8.4 + out * 0.5, u0 + 7.5, 0.6], [f0 + 8 + out * 0.3, u0 + 13.4, -0.6]], [3.2, 2.3, 1.7], TIGS);
      [[10.4, 2.2, 3.4, roar], [10, 8.4, 2.9, p.wind ? 0.5 : 0], [9.2, 13.8 + (p.idle ? 0.4 : 0), 2.5, 0]].forEach(([f, u, r, op], i) => {
        const H = [f0 + f + out * (1 - i * 0.3), u0 + u - (p.strike && !i ? 0.8 : 0), [0, 1.5, -1.3][i]];
        if (i) M.e([H[0] - r * 0.5, H[1] - r * 0.95, H[2] * 0.5], [r * 0.9, 0.6, r * 0.9], STRIPE);
        M.s(H, r, TIG);
        M.e([H[0] + r * 0.75, H[1] - r * 0.28 + op * 0.3, H[2]], [r * 0.6, r * 0.42, r * 0.62], TIGS);
        M.e([H[0] + r * 0.6, H[1] - r * 0.75 - op * r * 0.45, H[2]], [r * 0.62, r * 0.22, r * 0.55], TIGS);
        if (op > 0.3) {
          M.e([H[0] + r * 0.72, H[1] - r * 0.5 - op * 0.3, H[2]], [r * 0.5, op * r * 0.3, r * 0.45], C.MAW);
          both((s) => M.cone([H[0] + r * 1.1, H[1] - r * 0.4, H[2] + s * r * 0.3], [H[0] + r * 1.15, H[1] - r * 0.4 - 1.5, H[2] + s * r * 0.3], 0.45, C.TOOTH));
        }
        M.dot([H[0] + r * 1.36, H[1] - r * 0.12, H[2]], "#d06a7a", 2, 1);
        both((s) => {
          M.cone([H[0] - r * 0.2, H[1] + r * 0.7, H[2] + s * r * 0.65], [H[0] - r * 0.35, H[1] + r * 1.45, H[2] + s * r * 0.95], r * 0.36, STRIPE);
          M.eye(surf(H, [r, r, r], [0.62, 0.3, s * 0.6]), 2, "#30d0e8", { shut: i === 2 && !p.wind && !p.strike });
          M.seam([[H[0] + r * 0.15, H[1] + r * 0.25, H[2] + s * r * 0.95], [H[0] - r * 0.1, H[1] - r * 0.45, H[2] + s * r * 0.98]], "#2e2a3a");
        });
        M.seam([[H[0] + r * 0.5, H[1] + r * 0.86, H[2]], [H[0] - r * 0.2, H[1] + r, H[2]]], "#2e2a3a");
      });
      for (const [f, s] of [[6, 3.6], [-6, 3.4], [5, -3.6], [-6.4, -3]]) M.s([f0 + f + (p.walk ? Math.sin(p.ph * 6.28 + f) * 0.6 : 0), 1.1, s], 1.5, MIST);
    },
  },

  /** 금관 공작 — the palace's peacock: every feather of its train beaten into a gilt blade, and every eye on them one that sees. */
  crownpeacock: {
    size: "xl", n: 100, glow: "#ffd860", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const f0 = lf * 0.8, u0 = 8 + lu + bob(p, 0.6);
      const spread = p.wind ? 1.1 : p.strike ? 1 : p.walk ? 0.7 : p.idle ? 0.86 : 0.8, tip = p.strike ? 5 : p.wind ? -2 : 0;
      // the train: a fan of blades, an eye near the point of each
      const root = [f0 - 3.4, u0 + 0.6, 0];
      for (let i = 0; i < 9; i++) {
        const a = ((i - 4) / 4) * 1.75 * spread, L = 15.5 - Math.abs(i - 4) * 0.7, d = [-0.3 + tip / L, Math.cos(a), Math.sin(a)];
        const at = (t) => [root[0] + d[0] * L * t, root[1] + d[1] * L * t, root[2] + d[2] * L * t];
        M.tube([at(0.08), at(0.55), at(0.84), at(1)], [0.6, 1, 1.7, 0.3], i % 2 ? GILTD : GILT);
        const e = at(0.8);
        M.s([e[0] + 0.6, e[1], e[2]], 1.1, C.EYEW); M.eye([e[0] + 1.6, e[1], e[2]], 2, "#18a0b0");
      }
      both((s) => {
        const [sw, up] = gait(p, s < 0 ? 0 : 0.5), ft = [f0 + 0.6 + sw * 2.2, up * 1.8, s * 1.8];
        M.tube([[f0 - 0.4, u0 - 2.6, s * 1.5], [f0 - 1.4 + sw, u0 * 0.42 + up, s * 1.7], ft], [1.1, 0.6, 0.5], GILTD);
        for (const k of [-1, 0, 1]) M.cone(ft, [ft[0] + 2, ft[1], ft[2] + k * 1.1], 0.45, GILT);
      });
      M.G("body");
      M.e([f0, u0, 0], [4.8, 3.8, 3.4], PEA, [0, 14, 0]);
      M.e([f0 + 2.6, u0 + 1.4, 0], [2.6, 2.8, 2.5], PEA);
      M.G();
      both((s) => M.e([f0 - 0.6, u0 + 0.2, s * 3], [3.2, 2, 0.8], PEAD, [0, 10, 0]));
      // the neck and the crowned head
      const dip = p.strike ? 1 : p.wind ? -0.6 : 0;
      const H = [f0 + 6.6 + dip * 3, u0 + 9.6 - dip * 4.4 + (p.idle ? 0.4 : 0), 0];
      M.tube(bez([f0 + 3.2, u0 + 2.4, 0], [f0 + 3.4, u0 + 8 - dip * 2, 0], [H[0] - 0.8, H[1] - 0.6, 0], 5), [1.9, 1.1], PEA);
      M.e(H, [1.8, 1.6, 1.5], PEA);
      M.cone([H[0] + 1.2, H[1] - 0.2, 0], [H[0] + 4, H[1] - 1, 0], 0.8, GILT);
      both((s) => M.eye(surf(H, [1.8, 1.6, 1.5], [0.4, 0.3, s * 0.85]), 2, "#ff3030"));
      for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.42, t = [H[0] - 1, H[1] + 1.3 + Math.cos(a) * 3.4, Math.sin(a) * 3.2]; M.tube([[H[0] - 0.6, H[1] + 1.3, Math.sin(a) * 1], t], [0.4, 0.3], GILT); M.s(t, 0.7, GILT); }
    },
  },
};
