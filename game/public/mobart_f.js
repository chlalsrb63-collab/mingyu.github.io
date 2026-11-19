/**
 * Second-wave field bosses and rift encounters. Pieces are modelled in [forward, up, side];
 * the renderer keeps the same origin as the hit and telegraph markers.
 */
import { mat, gait, bob, lunge, both, surf } from "./mobart_kit.js";
import { BOSSES2_ADD_ART } from "./mobart_bosses2_adds.js";

const MASK = mat("#dfd2bd", { role: "keep" });
const MASKD = mat("#978b7f", { role: "keep" });
const CAVITY = mat("#180e1a", { role: "keep", flat: true });
const HIDE = mat("#44252e"), HIDED = mat("#281a24");
const REDPLATE = mat("#70353d"), REDROCK = mat("#9e414c");
const SEAM = mat("#e8494e", { role: "glow" }), SEAMC = mat("#ffab99", { role: "glow" });
const BRONZE = mat("#9f7351", { role: "keep" }), BRONZED = mat("#604641", { role: "keep" });
const RIBSTONE = mat("#c7ac7e", { role: "keep" });
const SHELL = mat("#36525e"), SHELLD = mat("#20313d");
const CLUB = mat("#9fac9c", { role: "keep" }), CLUBD = mat("#576978");
const ICE = mat("#55dcef", { role: "glow" }), ICEC = mat("#cbffff", { role: "glow" });

/** A bronze-ribbed battering beast, with red crystals splitting its carapace. */
const bloodhorn = (p2) => ({
  size: "xl", n: 104, glow: p2 ? "#ff8a7a" : "#ff3b3b", k: 1.22,
  draw(M, p) {
    const [stepF, lift] = lunge(p, 1.6), brace = p.wind, bite = p.strike, down = p.dead;
    const f = stepF * 0.85, u = 7.8 + lift * 0.56 + bob(p, 0.44) - down * 3.9 + brace * 1.1;
    const fire = p2 ? SEAMC : SEAM;
    for (const [hip, s, phase] of [[4.8, -1, 0], [4.8, 1, 0.5], [-9, -1, 0.5], [-9, 1, 0]]) {
      const [sw, up] = gait(p, phase), front = hip > 0;
      const step = front ? (bite ? (s < 0 ? 4.8 : 1.2) : -brace * 1.8) : (-bite * 1.5);
      const claw = [f + hip + sw * (front ? 2.2 : 2.6) + step, 1.25 + up * 1.45 + (front && s < 0 ? bite * 1.45 : 0), s * (front ? 9.9 + brace * 0.6 : 8.4)];
      const elbow = [f + hip - 0.9 + step * 0.38, u + (front ? 0.75 : -1.7), s * (front ? 8.5 : 8.0)];
      const root = [f + hip, u + (front ? 2.4 : 0.6), s * (front ? 5.6 : 5.2)];
      M.G((front ? "foreleg" : "hindleg") + s);
      M.tube([root, elbow, claw], front ? [4.3, 3.3, 2.1] : [3.0, 2.6, 1.75], HIDED);
      M.e([claw[0] + 0.75, claw[1], claw[2]], front ? [3.5, 1.28, 2.55] : [2.6, 1.08, 2.15], front ? BRONZED : HIDE);
      M.G();
      if (front) {
        M.box([elbow[0] + 0.25, elbow[1] + 0.45, elbow[2] + s * 0.57], [2.45, 2.38, 1.7], BRONZE, [s * 13, -20 - bite * 6, s * 13]);
        M.tube([[elbow[0] - 1.4, elbow[1] + 1.9, elbow[2] + s * 1.65], [elbow[0] + 1.9, elbow[1] + 1.45, elbow[2] + s * 1.85], [elbow[0] + 2.7, elbow[1] - 0.4, elbow[2] + s * 1.23]], 0.61, RIBSTONE);
      }
      for (const toe of front ? [-1.35, 0.1, 1.5] : [-1.05, 1.05]) {
        M.cone([claw[0] + 1.65, claw[1] + 0.38, claw[2] + toe], [claw[0] + (front ? 4.0 : 3.05), claw[1] - 0.28, claw[2] + toe * 1.13], front ? 0.72 : 0.60, MASKD);
      }
    }

    const sweep = p.walk ? Math.sin(p.ph * Math.PI * 2) * 3.3 : bite ? -3.8 : 1.25;
    M.tube([[f - 9, u + 0.45, 0], [f - 16, u - 1.8, sweep * 0.44], [f - 22.1, u - 3.1, sweep], [f - 25.7, 3.7, sweep * 1.35]], [4.35, 3.0, 1.65, 0.44], HIDED);
    for (const [x, h, s, q] of [[-15, -0.75, 0.4, 3.1], [-19.25, -1.63, 0.66, 2.18], [-22.9, -2.9, 1.02, 1.32]]) {
      M.e([f + x, u + h, sweep * s], [1.35, Math.max(0.6, q * 0.64), q], BRONZED, [sweep * -2, -22, 0]);
    }

    M.G("body");
    M.e([f - 1.65, u - 0.75, 0], [12.8, 4.85, 8.7], HIDED);
    M.e([f - 6.8, u + 1.05, 0], [7.0, 4.65, 7.9], HIDE);
    M.e([f + 3.7, u + 2.1, 0], [7.4, 5.5, 9.2], HIDE);
    M.G();
    // Each angled plate overlaps the next, tapering down the spine. Pale rims stop at the exposed flank.
    const ridges = [[5.9, 7.35, 8.15, 1.65], [1.9, 7.66, 8.65, 1.52], [-2.35, 7.2, 8.35, 1.33], [-6.5, 6.02, 7.85, 1.28], [-10.35, 4.65, 6.45, 1.1]];
    ridges.forEach(([x, y, w, r], i) => both((s) => {
      const uneven = s * (i % 2 ? 0.54 : -0.15), up = u + y + brace * (i < 2 ? 0.6 : 0);
      const spine = [f + x + uneven, up, s * 0.69];
      const upper = [f + x - 0.64 + uneven, up - 0.73, s * w * 0.67];
      const shoulder = [f + x - 1.38 + uneven, up - 3.75, s * w];
      const shard = [f + x - 1.9 + uneven, up - 5.65 + (i % 2) * 0.42, s * (w + 0.85)];
      M.G("panel" + i + s);
      M.tube([spine, upper, shoulder, shard], [r, r * 1.16, r * 1.18, r * 0.43], i % 2 ? BRONZED : BRONZE);
      M.tube([spine, upper, [shoulder[0] + 0.45, shoulder[1] + 0.27, shoulder[2]]], [0.83, 0.66, 0.46], RIBSTONE);
      M.G();
    }));

    // Warm seams show the inward fracture; towering blood-crystal spires erupt along the spine.
    for (const [x, y, height, width] of [[6, 7.9, 5.2, 1.35], [1.2, 8.3, 9.2, 2.8], [-3.9, 7.4, 6.8, 1.9], [-8.35, 5.6, 5.2, 1.4], [-12.7, 4.15, 3.6, 1.0]]) {
      const z = u + y, growth = p2 ? 2.4 : 0;
      M.e([f + x, z - 0.42, 0], [2.4, 1.3, 2.9], REDPLATE, [0, 6, 0]);
      M.box([f + x - 0.63, z + height * 0.37, 0.16], [width, height * 0.52, width * 0.9], REDROCK, [0, 29, -13]);
      const tip = [f + x - 2.8 - p2 * 0.78, z + height + growth + brace * 0.63, 0.45];
      M.cone([f + x, z + 0.54, 0.25], tip, width, REDROCK);
      M.tube([[f + x + 0.27, z + 0.6, 0.78], [f + x - 0.85, z + height * 0.51, 1.05], [tip[0] + 0.52, tip[1] - 1.1, 0.62]], [0.68, 0.52, 0.32], fire);
      if (width > 1.8) both((s) => M.cone([f + x - 0.8, z + 0.2, s * 2.1], [f + x - 3.8, z + height * (p2 ? 0.88 : 0.66), s * 4.2], p2 ? 1.15 : 0.85, SEAM));
    }

    const hx = f + 11.9 + bite * 2.5, hy = u + 2.45 + brace * 2.1 - bite * 1.36;
    const jaw = bite ? 3.5 : p2 ? 2.0 : 1.15;
    M.G("skull");
    M.e([hx - 2, hy + 0.2, 0], [5.1, 3.75, 7.2], HIDED);
    M.box([hx + 2.55, hy + 0.75, 0], [4.65, 1.8, 4.72], MASKD, [0, -10, 0]);
    M.e([hx - 0.55, hy + 2.33, 0], [5.15, 2.25, 6.92], MASK);
    M.box([hx + 4.45, hy + 0.96, 0], [2.95, 1.62, 3.48], MASK, [0, -12, 0]);
    M.G();
    M.e([hx + 3.15, hy - 1.65 - jaw, 0], [5.0, 1.23, 4.12], HIDED, [0, bite ? -14 : -4, 0]);
    M.e([hx + 4.35, hy - 0.92 - jaw * 0.5, 0], [3.7, 0.82 + bite * 0.52, 3.85], CAVITY);
    both((s) => {
      M.tube([[hx - 2.33, hy + 2.2, s * 4.7], [hx - 4.75, hy + 4.2, s * 7.45], [hx - 8.75, hy + 6.35, s * 9.1]], [1.93, 1.4, 0.29], BRONZE);
      M.tube([[hx - 1.75, hy + 2.5, s * 4.2], [hx - 4.45, hy + 4.85, s * 7.1], [hx - 8.55, hy + 6.45, s * 8.94]], [1.17, 0.81, 0.22], MASK);
      M.cone([hx - 0.9, hy + 3.65, s * 2.74], [hx - 2.8, hy + 6.9, s * 3.4], 1.26, RIBSTONE);
      M.tube([[hx - 2.05, hy + 0.1, s * 5.78], [hx + 1.7, hy + 0.62, s * 5.7], [hx + 4.0, hy + 0.01, s * 4.78]], [0.94, 0.70, 0.29], CAVITY);
      if (!down) M.tube([[hx + 0.45, hy + 0.18, s * 6.03], [hx + 2.85, hy + 0.12, s * 5.4]], [0.58, 0.35], fire);
      M.cone([hx + 1.76, hy - 1.13, s * 4.21], [hx + 2.62, hy - 2.85 - jaw * 0.41, s * 4.43], 0.89, MASK);
      M.cone([hx + 5.64, hy - 1.03, s * 2.51], [hx + 5.81, hy - 2.2, s * 2.80], 0.58, MASK);
      if (bite) {
        M.tube([[hx + 3.1, hy - 0.2, s * 4.65], [hx + 8.4, hy - 1.45, s * 5.03], [hx + 12.8, hy - 2.73, s * 5.5]], [0.73, 0.25], SEAM);
        if (p2) M.tube([[hx + 3.5, hy - 0.13, s * 4.48], [hx + 8.1, hy - 1.1, s * 4.84]], [0.55, 0.29], SEAMC);
      }
    });
  },
});

/** A broad reef breaker on six short legs. Its high shoulder plates brace two heavy hammer clubs. */
const clubshrimp = (p2) => ({
  size: "xl", n: 104, glow: p2 ? "#d8ffff" : "#5ff2ff", k: 1.20,
  draw(M, p) {
    const [lf, lift] = lunge(p, 1.4);
    const f = lf * 0.6, u = 9 + lift * 0.65 + bob(p, 0.48) - (p.dead || 0) * 5;
    const charge = p.wind ? 1 : 0, strike = p.strike ? 1 : 0;
    const accent = p2 ? ICEC : ICE;
    for (const [x, phase] of [[5.5, 0], [0.5, 0.5], [-5, 0]]) both((s) => {
      const [sw, up] = gait(p, phase + (s > 0 ? 0.5 : 0));
      M.tube([[f + x, u - 1, s * 6.8], [f + x - 2.5 + sw, u - 2, s * 10.7], [f + x - 0.8 + sw * 2.2, 1 + up * 1.9, s * 13.5]], [1.65, 1.22, 0.54], SHELLD);
    });
    M.tube([[f - 4, u + 5, 0], [f - 10, u + 1.7, 0], [f - 14, u - 3.8, 0]], [5.8, 4, 1.5], SHELLD);
    for (const [s, bend] of [[-6, 1.3], [0, 0], [6, 1.3]]) {
      M.e([f - 16.2, u - 4.2, s * 0.65], [3.1, 1.1, 2.5], SHELL, [s * 6, -12, 0]);
      M.cone([f - 15.5, u - 4, s * 0.64], [f - 19.1 + bend, u - 5, s], 1.4, SHELLD);
    }
    M.G("body");
    M.e([f - 2, u + 3.3, 0], [8.7, 7.6, 9.9], SHELLD);
    M.e([f + 1.4, u + 5.6, 0], [7.9, 7.9, 10.7], SHELL);
    M.e([f + 5.55, u + 3, 0], [4.3, 5.3, 8.5], SHELLD);
    M.G();
    for (const [x, h, w] of [[-6.3, 10.7, 7.5], [-2.8, 12.2, 9.15], [0.9, 12.6, 9.9]]) both((s) => {
      M.tube([[f + x, u + h, 0], [f + x - 0.8, u + h - 2.4, s * w * 0.55], [f + x - 1.3, u + h - 5.7, s * w]], [0.72, 0.66, 0.52], CLUBD);
      if (p2) M.tube([[f + x - 0.8, u + h - 2.4, s * w * 0.55], [f + x - 1.3, u + h - 5.7, s * w]], [0.42, 0.30], ICE);
    });
    const hx = f + 7.8, hy = u + 8.2;
    M.e([hx, hy, 0], [3.2, 2.75, 5.3], SHELLD);
    both((s) => {
      M.cone([hx - 0.3, hy + 1.9, s * 2.4], [hx - 2.2, hy + 7, s * 6.4], 0.8, SHELL);
      M.box([hx + 1.9, hy + 0.6, s * 2.5], [0.8, 1.3, 1.65], CLUBD, [s * 15, 0, s * 15]);
      if (!p.dead) M.tube([[hx + 2.55, hy + 0.15, s * 1.5], [hx + 2.6, hy + 0.48, s * 3.4]], 0.46, accent);
    });
    both((s) => {
      // Opposite hands hold staggered hammer guards; both rise on the wind-up.
      const sh = [f + 3, u + 8, s * 8.8], offset = s > 0 ? 0.0 : -1.45;
      const elbow = [f + 8.3 - charge * 3.5 + strike * 3.2, u + 6.2 + charge * 7, s * 14.5];
      const hand = [f + 16 + offset - charge * 8.3 + strike * 4.6, u + 7.7 + charge * 13.5 - strike * 3.3 + (p.walk ? Math.sin(p.ph * 6.28 + s) : 0), s * (15.6 - strike * 3.25)];
      const pitch = charge ? 53 : strike ? -21 : s * 8;
      M.tube([sh, elbow, hand], [3.1, 2.35, 2.5], SHELL);
      M.e(elbow, [2.8, 3.2, 2.95], SHELLD);
      M.G(s < 0 ? "hammerNear" : "hammerFar");
      M.box(hand, [3.8, 3.25, 4.25], CLUBD, [s * -12, pitch, s * 5]);
      M.e([hand[0] + 1.45 + strike * 0.8, hand[1] + charge * 1.55, hand[2]], [4.4, 3.5, 4.75], CLUB, [s * -12, pitch, s * 5]);
      M.box([hand[0] + 4.15 - charge * 1.4, hand[1] + charge * 3.05 - strike * 1.45, hand[2]], [1.9, 2.8, 3.45], CLUB, [s * -12, pitch, s * 5]);
      M.G();
      const top = hand[1] + 3.1 + charge * 1.5;
      M.tube([[hand[0] + 0.1, top, hand[2] - 2.5], [hand[0] + 1.3, top + 0.45, hand[2]], [hand[0] + 0.7, top + 0.5, hand[2] + 2.7]], 0.50, accent);
      if (p2) M.cone([hand[0] - 0.4, top - 0.35, hand[2] + s * 2.3], [hand[0] - 1.7, top + 4.1, hand[2] + s * 3.1], 1.05, ICE);
    });
  },
});

const CLK = mat("#26162c"), CLKD = mat("#160c1c");
const WEB = mat("#a81e36"), WEBD = mat("#6e1026");
const VAMP_FUR = mat("#ebe4f0", { role: "keep" }), VAMP_GOLD = mat("#d8a84e", { role: "keep" });
const VIO = mat("#ff3858", { role: "glow" }), HEART = mat("#ff4fd8", { role: "glow" }), HEARTC = mat("#ffd0f4", { role: "glow" });

/** Fill a taut membrane with narrow strips along the edge between two spars. */
function web(M, root, a, b, ink) {
  const d = p => Math.hypot(p[0] - root[0], p[1] - root[1], p[2] - root[2]);
  const strips = Math.ceil(Math.max(d(a), d(b)) / 1.5);
  const df = b[0] - a[0], du = b[1] - a[1], ds = b[2] - a[2], span = Math.hypot(df, du, ds);
  const yaw = Math.atan2(ds, df) * 180 / Math.PI, pitch = Math.atan2(du, Math.hypot(df, ds)) * 180 / Math.PI;
  for (let i = 1; i <= strips; i++) {
    const t = i / strips, c = root.map((v, j) => v + ((a[j] + b[j]) * 0.5 - v) * t);
    M.box(c, [span * t * 0.5 + 0.45, 0.8, 0.85], ink, [yaw, pitch, 0]);
  }
}

/** 밤장막 박쥐군주 벨모라 — feral crimson-winged vampire-bat demon lord in a gold-trimmed gothic cloak with huge sweeping crimson bat wings, white-furred beast head, and clawed forelimbs. */
const cloakbat = (ph) => ({
  size: "boss", n: 198, glow: ph > 1 ? "#ff4fd8" : "#ff3858", k: 1.18,
  draw(M, p) {
    const [lf, lift] = lunge(p, 1.9);
    const fly = ph === 2, channel = ph === 3, wind = p.wind ? 1 : 0, strike = p.strike ? 1 : 0, death = p.dead || 0;
    const f = lf * 0.8, u = (fly ? 22 : 14) + lift + bob(p, 0.9) - death * 7;
    const flap = fly && p.walk ? Math.sin(p.ph * Math.PI * 2) * 5.0 : p.idle ? -1.1 : 0;
    // crouched beast hind legs
    both((s) => {
      const [sw, up] = gait(p, s < 0 ? 0 : 0.5);
      const foot = fly ? [f - 7, u - 16, s * 5.5] : [f - 4 + sw * 2.8, 1.2 + up * 1.6, s * 7.2];
      M.tube([[f - 1, u - 3, s * 4.5], [f - 6, u - 7, s * 8], foot], [3.2, 2.5, 1.8], CLKD);
      M.e([foot[0] + 1, foot[1], foot[2]], [2.4, 1.2, 2.2], VAMP_FUR);
      for (const t of [-1.2, 0, 1.2]) M.cone([foot[0] + 2, foot[1], foot[2] + t], [foot[0] + 4.4, foot[1] - 0.6, foot[2] + t * 1.2], 0.55, WEB);
    });
    // billowing tattered crimson-lined & gold-trimmed gothic cloak trailing behind
    const cw = p.walk ? Math.sin(p.ph * 6.28) * 3.2 : 1.5;
    for (const [s, len, drop] of [[-15, 24, 11], [-8, 29, 13], [0, 31, 13.5], [8, 29, 13], [15, 24, 11]]) {
      const c0 = [f - 2, u + 9, s * 0.6];
      const c1 = [f - 14 - wind * 2, u + 3, s * 1.15 + cw * 0.4];
      const c2 = [f - len - wind * 3, Math.max(1.5, u - drop), s * 1.4 + cw];
      M.tube([c0, c1, c2], [3.6, 3.0, 0.85], Math.abs(s) === 8 ? WEB : CLKD);
      if (Math.abs(s) === 15) M.tube([c0, c1, c2], [0.7, 0.45], VAMP_GOLD);
    }
    // aristocratic hunched torso (SDF smooth-blended) + ruffled white cravat & crimson-ruby brooch
    M.G("body", { smooth: 2.8 });
    M.e([f - 1, u + 1.5, 0], [7.2, 9.8, 6.4], CLKD, [0, 14, 0]);
    M.e([f + 1.5, u + 7.8, 0], [7.6, 6.8, 9.8], CLK);
    M.G();
    // high upturned crimson & gold gothic collar framing the head
    both((s) => {
      M.box([f - 1.5, u + 13.5, s * 7.8], [3.2, 5.8, 1.8], WEB, [s * -24, 14, s * 18]);
      M.tube([[f + 1.2, u + 17.5, s * 8.6], [f - 4.2, u + 19.2, s * 9.5], [f - 5.2, u + 12.2, s * 8.2]], 0.72, VAMP_GOLD);
    });
    // colossal sweeping crimson-membrane black-rimmed vampire bat wings
    both((s) => {
      const flare = fly ? 1.08 : channel || wind ? 1.02 : 0.90;
      const root = [f - 0.5, u + 9.2, s * 7.2];
      const wing = (x, h, span) => [f + x + strike * span * 0.14, u + h + (wind * 3.8 + flap) * span / 36, s * (span * flare)];
      const elbow = wing(3.5, 19.5, 17.5), tip = wing(-5.5, 16.5, 40), claw = wing(-10, 13.5, 43.5);
      const fringe = [
        elbow, tip, claw, wing(-9.5, 7.5, 34),
        wing(-17, -0.5, 34), wing(-12.5, 0.8, 25.5), wing(-17, -9.5, 25),
        wing(-10, -4.5, 17.5), wing(-13.5, -13.5, 14.5), wing(-6, -6, 9),
      ];
      M.G(s < 0 ? "leftWing" : "rightWing");
      for (let i = 0; i + 1 < fringe.length; i++) web(M, root, fringe[i], fringe[i + 1], i % 2 === 0 ? WEB : WEBD);
      M.tube([root, elbow, tip, claw], [2.6, 2.0, 0.95, 0.35], CLKD);
      for (const i of [4, 6, 8]) M.tube([root, fringe[i]], [1.25, 0.38], CLKD);
      M.cone(elbow, [elbow[0] + 2.4, elbow[1] + 4.4, elbow[2] - s * 0.8], 1.4, MASK);
      M.G();
      if (ph > 1 || wind) M.tube([[elbow[0] + 0.2, elbow[1] + 1, elbow[2]], [tip[0] + 0.3, tip[1] + 0.6, tip[2] + s * 0.2]], 0.48, HEART);
    });
    // chest cravat / open glowing heart ribcage in channel phase
    const chest = [f + 6.5, u + 4.5, 0], open = channel || wind;
    if (open) {
      M.e(chest, [2.4, 4.8, 4.4], CAVITY);
      M.e([chest[0] + 0.8, chest[1], 0], [2.1, 3.2, 2.6], HEART);
      M.e([chest[0] + 2.0, chest[1] + 0.6, 0], [0.85, 1.3, 1.2], HEARTC);
    } else {
      M.e([chest[0] + 0.8, chest[1] + 2.2, 0], [2.2, 4.2, 3.2], VAMP_FUR);
      M.s([chest[0] + 2.4, chest[1] + 4.4, 0], 1.3, VIO);
    }
    // massive hunched clawed forelimbs with broad gothic cloak sleeves
    both((s) => {
      const reach = strike * 8.5 - wind * 3.5;
      const sh = [f + 3.5, u + 8.5, s * 9.8];
      const elb = [f + 4.5 + reach * 0.35, u + 3.5 + wind * 5.0, s * 16.5];
      const hand = [f + 12.5 + reach, fly ? u - 4 : 2.2 + wind * 7.5 - strike * 1.5, s * (11.5 - strike * 2.5)];
      M.tube([sh, elb, hand], [4.2, 3.5, 2.8], CLK);
      M.box([sh[0] - 0.5, sh[1] + 1.4, sh[2] + s * 1.6], [4.6, 3.0, 3.6], CLKD, [s * 18, -14, -s * 24]);
      M.tube([[sh[0] + 1.5, sh[1] + 2.0, sh[2] + s * 2.2], [elb[0] - 0.5, elb[1] + 1.4, elb[2] + s * 1.4]], 0.78, VAMP_GOLD);
      // crimson cloak cuff draping from the elbow
      M.tube([elb, [elb[0] - 4.5, Math.max(2, elb[1] - 6.5), elb[2] + s * 1.8]], [3.0, 1.1], WEB);
      M.e(hand, [3.6, 2.5, 3.4], VAMP_FUR);
      for (let i = 0; i < 4; i++) {
        M.cone([hand[0] + 2.4, hand[1] + 0.2, hand[2] + s * (i - 1.5) * 1.1], [hand[0] + 6.6, hand[1] - 1.5, hand[2] + s * (i - 1.5) * 1.4], 0.8, WEB);
      }
    });
    // feral pale-white-furred bat-wolf beast head (SDF smooth-blended cranium + snout)
    const hx = f + 6.8 + strike * 3.0, hy = u + 13.8 - strike * 1.5 + wind * 1.8;
    M.G("head", { smooth: 1.8 });
    M.e([hx - 1.2, hy, 0], [5.8, 5.2, 6.2], VAMP_FUR);
    M.box([hx + 4.2, hy - 0.5, 0], [3.2, 2.2, 2.8], VAMP_FUR, [0, -14, 0]);
    M.G();
    const jaw = 1.6 + strike * 1.8 + wind * 1.0;
    M.e([hx + 4.2, hy - 2.6 - jaw * 0.5, 0], [2.6, 1.4 + jaw * 0.45, 2.3], CAVITY);
    M.box([hx + 4.0, hy - 3.6 - jaw, 0], [2.8, 1.0, 2.2], VAMP_FUR, [0, -24 - jaw * 8, 0]);
    both((s) => {
      // tall feral swept-back bat ears with crimson inner ear
      M.cone([hx - 0.5, hy + 3.6, s * 3.4], [hx - 3.5, hy + 14.2, s * 7.8], 2.2, CLKD);
      M.cone([hx + 0.2, hy + 3.8, s * 3.4], [hx - 2.2, hy + 11.8, s * 6.8], 1.15, WEB);
      // glowing crimson eyes & long sharp vampire fangs
      if (!death) M.tube([[hx + 3.4, hy + 1.4, s * 2.9], [hx + 4.4, hy + 0.8, s * 1.8]], 0.62, ph > 1 ? HEART : VIO);
      M.cone([hx + 5.6, hy - 1.8, s * 1.4], [hx + 5.9, hy - 4.6 - strike * 0.8, s * 1.5], 0.62, MASK);
    });
  },
});

const WH = mat("#5a3288"), WHD = mat("#2c1846");
const WPLATE = mat("#dcd2e4", { role: "keep" });
const TRUNK = mat("#4e2c26"), WH_LANTERN = mat("#ffdf78", { role: "glow" });
const CYN = mat("#b472ff", { role: "glow" }), CYNC = mat("#f0d8ff", { role: "glow" });
const FLW = mat("#ff8ae0", { role: "glow" }), FLWC = mat("#ffe6f8", { role: "glow" });

/** 꽃무덤 고래 모비화 — colossal bone-plated spirit whale with a luminous violet pleated belly, gnarled cherry-blossom tree growing on its back, and hanging golden spirit lanterns. */
const bloomwhale = (ph) => ({
  size: "boss", n: 212, glow: ph > 2 ? "#ff8ae0" : "#c888ff", k: 1,
  draw(M, p) {
    const [lf, lift] = lunge(p, 2.5);
    const dive = ph === 4, open = ph === 2 || ph === 3, bloom = ph >= 3;
    const charge = p.wind ? 1 : 0, strike = p.strike ? 1 : 0, death = p.dead || 0;
    const f = lf * 0.62, u = (dive ? 10 : 15) + lift * 0.45 + bob(p, 1.15) - death * 6 + charge * 4.2;
    const sw = p.walk ? Math.sin(p.ph * Math.PI * 2) * 3.2 : p.idle ? -1.5 : 0, glow = bloom ? FLW : CYN;
    M.G("body", { smooth: 4.2 });
    M.e([f - 5, u + 2, 0], [27, 11.2, 14.5], WH);
    M.e([f - 13, u - 2.6, 0], [21.0, 8.8, 13.0], WHD);
    M.e([f + 11, u + (open ? 1.2 : 7.5), 0], [16.2, 7.2, 12.8], open ? WHD : WH);
    M.G();
    // luminous glowing violet belly grooves
    for (const yOff of [-3.2, -5.8, -8.0]) {
      M.tube([[f + 26, u + yOff + 2, 0], [f + 8, u + yOff, 0], [f - 12, u + yOff + 1.5, 0]], [0.85, 0.72, 0.4], glow);
    }
    // ethereal lavender-white glowing tail fluke
    const fin = [f - 43 - strike * 2.5, u + 6.5 - strike * 5.3 + charge * 3.4, sw * 1.5];
    M.tube([[f - 22, u + 1.5, 0], [f - 33, u + 2.2, sw], fin], [7.2, 4.8, 1.7], WH);
    both((s) => {
      const tailTip = [fin[0] - 7, fin[1] + 3.2, fin[2] + s * 16.5], notch = [fin[0] - 9.8, fin[1] + 0.5, fin[2] + s * 3.4];
      M.G(s < 0 ? "leftFluke" : "rightFluke");
      web(M, fin, tailTip, notch, CYN);
      M.tube([fin, [fin[0] - 1.8, fin[1] + 2.0, fin[2] + s * 8.4], tailTip], [2.0, 1.4, 0.4], CYNC);
      M.G();
    });
    if (!dive) {
      const head = f + 22 + strike * 3, brow = u + 7.6 + strike * 0.8;
      // cracked bone-white skull armor over the brow
      M.G("skull");
      M.e([head, brow + 0.3, 0], [13.8, 6.5, 13.0], WHD, [0, -5, 0]);
      M.box([head + 6.4, brow + 2.1, 0], [9.4, 2.7, 9.2], WPLATE, [0, -7, 0]);
      M.e([head + 1.6, brow + 3.5, 0], [10.4, 3.2, 10.6], MASK, [0, -9, 0]);
      M.e([head + 9.6, brow + 1.2, 0], [7.6, 2.4, 8.5], MASK);
      M.G();
      // hanging golden spirit lantern dangling from the front jaw
      const lan1 = [head + 16.5, brow - 10.5 + Math.sin(sw) * 1.2, 0];
      M.tube([[head + 16.5, brow - 1.2, 0], lan1], 0.35, TRUNK);
      M.box(lan1, [1.5, 2.4, 1.5], WH_LANTERN);
      const jaw = u - 3.2 - strike * 3.1 - charge * 0.9, reach = head + 18;
      both((s) => {
        M.tube([[f + 11, u + 3.5, s * 10.6], [head + 0.5, jaw, s * 10.5], [head + 9.5, jaw - 1.4, s * 7.9], [reach, jaw - 0.2, s * 3.6]], [2.2, 2.5, 1.8, 0.8], MASKD);
        M.tube([[head + 5.6, jaw - 1.45, s * 9.8], [head + 12.7, jaw - 1.3, s * 6.4], [reach, jaw - 0.15, s * 3.7]], [0.92, 0.72, 0.28], MASK);
        for (const [tooth, side, depth] of [[3, 10, 4.6], [8, 8.4, 3.3], [12.5, 6.2, 3.9]]) {
          M.cone([head + tooth, brow - 1.5, s * side], [head + tooth + 0.25, brow - 1.5 - depth, s * (side - 0.25)], 1.02, MASK);
        }
        M.tube([[head - 1.9, brow + 1.35, s * 10.5], [head + 1.8, brow + 0.35, s * 11.4], [head + 4.7, brow + 0.45, s * 9.8]], [1.35, 0.95, 0.35], CAVITY);
        if (!death) M.tube([[head - 0.5, brow + 0.8, s * 11.3], [head + 2.32, brow + 0.44, s * 11.7]], 0.58, glow);
        const wingRoot = [f + 8, u - 1.8, s * 10.4];
        const wingElbow = [f + 3.8, u - 6.2 - sw * 0.35, s * 20.8], wingTip = [f - 7.5, u - 7.4 + strike * 2, s * 29.8];
        M.G(s < 0 ? "leftPectoral" : "rightPectoral");
        web(M, wingRoot, wingElbow, [f - 8, u - 5.8, s * 12.5], WPLATE);
        web(M, wingRoot, wingElbow, wingTip, MASK);
        M.tube([wingRoot, wingElbow, wingTip], [2.2, 1.8, 0.5], MASKD);
        M.G();
      });
      // exposed bone-white ribcage armor & pink funeral ribbons along flanks
      for (const [x, top, span] of [[-18, 10.8, 12.5], [-10.5, 13.6, 13.8], [-2.7, 13.9, 14.5], [5.4, 13.2, 13.9], [13.0, 10.8, 11.9]]) both((s) => {
        const rise = open && x > -11 ? 2.7 : 0, turn = open ? 1.8 : 0, rib = s * (span + turn);
        M.tube([[f + x, u + top + rise, s * (open ? 3.2 : 0.7)], [f + x + 1.35, u + top - 2.2 + rise, rib * 0.65], [f + x + 0.35, u + 3.6, rib], [f + x - 1.4, u - 3.7, rib * 0.87]], [1.2, 1.22, 1.18, 0.65], x % 3 > 1 ? MASKD : WPLATE);
      });
      // gnarly cherry-blossom tree growing straight out of the whale's spine!
      const tBase = [f - 5, u + 12.5, 0], tMid = [f - 9, u + 22, -2], tTop = [f - 14, u + 29, -4];
      M.tube([tBase, tMid, tTop], [2.6, 1.7, 0.9], TRUNK);
      M.tube([tMid, [f - 1, u + 27, 4], [f + 4, u + 29, 6]], [1.4, 0.9, 0.45], TRUNK);
      M.tube([tMid, [f - 17, u + 26, 4], [f - 22, u + 28, 7]], [1.3, 0.8, 0.4], TRUNK);
      // lush glowing pink cherry-blossom canopy clusters
      const canopy = [
        [tTop[0], tTop[1] + 2, tTop[2], 5.8],
        [f - 8, u + 31, 1, 5.2],
        [f + 3, u + 29.5, 5.5, 4.6],
        [f - 21, u + 28.5, 6.5, 4.4],
        [f - 15, u + 27, -8, 4.2],
        [f + 12, u + 14.5, 0, 3.6],
        [f + 22, u + 12.2, 2, 3.0],
      ];
      for (const [cx, cy, cz, cr] of canopy) {
        M.e([cx, cy, cz], [cr, cr * 0.65, cr * 0.9], FLW);
        M.s([cx + 0.8, cy + cr * 0.3, cz], cr * 0.48, FLWC);
      }
      // second golden spirit lantern hanging from the tree branch
      const lan2 = [f - 19, u + 19.5, 6.5];
      M.tube([[f - 19, u + 27.5, 6.5], lan2], 0.35, TRUNK);
      M.box(lan2, [1.6, 2.6, 1.6], WH_LANTERN);
      if (open) {
        const light = bloom ? FLWC : CYNC;
        M.e([f + 0.8, u + 11, 0], [5.8, 2.9, 2.7], CAVITY);
        M.e([f + 3.1, u + 12.8, 0], [3.3, 1.8, 1.7], glow);
        M.s([f + 3.45, u + 13.9, 0], 1.2, light);
      }
      if (ph === 2) for (const [x, s] of [[10.2, 1], [-9.3, -1]]) {
        M.tube([[f + x, u + 1, s * 11], [f + x + 0.8, u + 4.4, s * 14.8], [f + x + 3.2, u + 5, s * 17.3]], [2.2, 1.45, 1.2], MASKD);
        M.dot([f + x + 4.27, u + 5.25, s * 17.6], "#30434b", 2, 1);
      }
    }
    if (dive) M.e([f + 22, u - 4, 0], [12.6, 2.1, 10.7], WHD);
  },
});

const ASH = mat("#777c84", { flat: true }), ASH_DARK = mat("#48465b", { flat: true });
const GROWTH = mat("#a4d2b1", { role: "glow", flat: true }), BEAK = mat("#c3a985", { flat: true });

/** Fast boarding raptor: an ash-grey arrow with wing tips missing in uneven chunks. */
const airshipGale = {
  size: "s", hover: 8, k: 1.13,
  draw(M, p) {
    const [f, rise] = lunge(p, 1.3);
    const flap = p.dead ? -0.3 : p.wind ? 1 : p.strike ? -1 : p.walk ? Math.cos(p.ph * Math.PI * 2) : p.idle ? 0.1 : 0.6;
    const u = 6.2 + rise - flap * 0.6;
    M.G("body");
    M.e([f - 0.8, u, 0], [3.8, 2.25, 2.15], ASH, [0, 12, 0]);
    M.e([f + 0.8, u - 0.75, 0], [2.35, 1.35, 1.7], ASH_DARK);
    both((s) => M.cone([f - 3.2, u - 0.2, s * 0.9], [f - 8.3, u + 0.9, s * 2.65], 1.02, ASH_DARK));
    M.G();

    // Raised leading edges with jagged, swept-back primary feathers.
    both((s) => {
      M.G(s < 0 ? "left-wing" : "right-wing");
      const shoulder = [f - 1.1, u + 1.45, s * 1.5];
      const elbow = [f + 0.7, u + 2.35 + flap * 2.5, s * 5.2];
      const tip = [f - 2.8, u + 1.4 + flap * 3.8, s * 10.4];
      M.tube([shoulder, elbow, tip], [1.45, 1.15, 0.55], ASH);
      for (const [forward, height, span, feather] of [[0.3, 2.1, 4, 3.6], [-0.2, 2.1, 5.5, 4.7], [-1.6, 1.9, 7.4, 2.5], [-2.8, 1.6, 9.1, 3.2]]) {
        const v = u + height + flap * span * 0.35;
        M.cone([f + forward, v, s * span], [f + forward - feather, v - 1, s * (span + 0.9)], 0.94, ASH_DARK);
      }
      M.G();
      if (p.strike) M.cone([f + 0.8, u - 1.3, s * 1.3], [f + 3.4, u - 2.6, s * 1.7], 0.58, BEAK);
    });

    const head = [f + 3.1 + p.strike * 0.8, u + 1.15 - p.strike * 1.05, 0];
    M.e(head, [2.05, 1.65, 1.55], ASH_DARK);
    M.cone([head[0] + 0.3, head[1] + 1.1, 0], [head[0] - 1.9, head[1] + 2.2, 0], 0.85, GROWTH);
    M.tube([[head[0] + 1.2, head[1] + 0.15, 0], [head[0] + 2.9, head[1] - 0.2, 0], [head[0] + 3.1, head[1] - 1.45, 0]], [0.9, 0.65, 0.3], BEAK);
    both((s) => M.eye(surf(head, [2.05, 1.65, 1.55], [0.75, 0.45, s]), 1, "#a4d2b1"));
  },
};

const OBSIDIAN = mat("#232336", { flat: true }), OBSIDIAN_RIM = mat("#454158", { flat: true });
const PINION = mat("#9b384a", { flat: true }), PINION_RIM = mat("#d66558", { flat: true });

/** The lookout's amber eye sits beneath a blade-like crest, with one torn red wing. */
const airshipLookout = {
  size: "l", hover: 11, glow: "#ffc16b", k: 1.09,
  draw(M, p) {
    const [f, rise] = lunge(p, 1.6);
    const beat = p.dead ? -0.4 : p.wind ? 1 : p.strike ? -0.8 : p.walk ? Math.cos(p.ph * Math.PI * 2) * 0.72 : p.idle ? 0.05 : 0.48;
    const u = 9.2 + rise - beat * 0.8;
    M.G("body");
    M.e([f - 1.65, u, 0], [6.4, 3.9, 3.85], OBSIDIAN, [0, 18, 0]);
    M.e([f + 1.4, u - 0.95, 0], [3.8, 2.95, 3.2], OBSIDIAN_RIM);
    for (const s of [-1, 0, 1]) M.cone([f - 4.7, u - 0.5, s * 1.5], [f - 11.6 + Math.abs(s) * 1.6, u + 1, s * 3.3], 1.35, OBSIDIAN);
    M.G();

    both((s) => {
      const red = s > 0;
      const wing = red ? PINION : OBSIDIAN;
      const rim = red ? PINION_RIM : OBSIDIAN_RIM;
      const shoulder = [f - 0.5, u + 2.8, s * 3.1];
      const elbow = [f + 1.05, u + 3.8 + beat * 3.9, s * 7.8];
      const tip = [f - 4.3, u + 3 + beat * 6, s * (red ? 15 : 17)];
      M.G(red ? "red-wing" : "black-wing");
      M.tube([shoulder, elbow, tip], [2.15, 1.7, 0.65], wing);
      M.tube([[elbow[0] - 0.4, elbow[1] + 1.2, elbow[2]], [tip[0] + 0.65, tip[1] + 0.25, tip[2] - s]], [0.75, 0.4], rim);
      const lengths = red ? [6.6, 7.2, 3.3, 7.9, 3.4] : [5.8, 6.6, 7.4, 7.1, 6.6];
      for (let i = 0; i < lengths.length; i++) {
        const span = 5.3 + i * 2.1;
        const a = [f + 0.65 - i * 0.96, u + 3.5 + beat * span * 0.4, s * span];
        const b = [a[0] - lengths[i], a[1] - 1.5 - (red ? (i % 2) * 1.6 : 0), a[2] + s * 2.0];
        M.cone(a, b, 1.4 - i * 0.13, wing);
      }
      M.G();

      const spread = p.strike ? 1.7 : 0;
      const foot = [f + 1.1 + spread, u - 4.85, s * 1.85];
      M.tube([[f - 0.8, u - 1.6, s * 2.1], [f - 0.4, u - 3.6, s * 2.25], foot], [0.85, 0.64, 0.57], OBSIDIAN_RIM);
      M.cone(foot, [foot[0] + 1.8, foot[1] - 0.4, foot[2] + s * 0.65], 0.58, BEAK);
    });

    const head = [f + 4.3 + p.strike * 1.25, u + 3.1 - p.strike * 1.95, 0];
    M.e(head, [3.4, 3, 2.8], OBSIDIAN);
    M.cone([head[0] - 0.1, head[1] + 1.65, 0], [head[0] - 3.35, head[1] + 5.55, 0], 1.42, OBSIDIAN_RIM);
    M.tube([[head[0] + 1.9, head[1] - 0.9, 0], [head[0] + 4.9, head[1] - 1.1, 0], [head[0] + 5.25, head[1] - 3.1, 0]], [1.55, 1.02, 0.35], BEAK);
    const eye = [head[0] + 1.35, head[1] + 0.6, 0];
    M.s(eye, 1.8, OBSIDIAN_RIM);
    M.stare(eye, 1.8, "#ffc16b", 4);
  },
};

export const BEASTS_F = {
  bloodhorn: bloodhorn(false), bloodhorn_p2: bloodhorn(true),
  clubshrimp: clubshrimp(false), clubshrimp_p2: clubshrimp(true),
  cloakbat: cloakbat(1), cloakbat_p2: cloakbat(2), cloakbat_ch: cloakbat(3),
  bloomwhale: bloomwhale(1), bloomwhale_p2: bloomwhale(2), bloomwhale_ch: bloomwhale(3), bloomwhale_dive: bloomwhale(4),
  airship_gale: airshipGale, airship_lookout: airshipLookout,
  ...BOSSES2_ADD_ART,
};
