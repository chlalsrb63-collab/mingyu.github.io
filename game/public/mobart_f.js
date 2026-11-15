/**
 * Second-wave field bosses and rift encounters. Pieces are modelled in [forward, up, side];
 * the renderer keeps the same origin as the hit and telegraph markers.
 */
import { mat, gait, bob, lunge, both, surf } from "./mobart_kit.js";
import { BOSSES2_ADD_ART } from "./mobart_bosses2_adds.js";

const MASK = mat("#dfd2bd", { role: "keep", flat: true });
const MASKD = mat("#978b7f", { role: "keep", flat: true });
const CAVITY = mat("#180e1a", { role: "keep", flat: true });
const HIDE = mat("#44252e", { flat: true }), HIDED = mat("#281a24", { flat: true });
const REDPLATE = mat("#70353d", { flat: true }), REDROCK = mat("#9e414c", { flat: true });
const SEAM = mat("#e8494e", { role: "glow" }), SEAMC = mat("#ffab99", { role: "glow" });
const SHELL = mat("#36525e", { flat: true }), SHELLD = mat("#20313d", { flat: true });
const CLUB = mat("#9fac9c", { role: "keep", flat: true }), CLUBD = mat("#576978", { flat: true });
const ICE = mat("#55dcef", { role: "glow" }), ICEC = mat("#cbffff", { role: "glow" });

/** A siege-weight monitor lizard. Its wide skull leads a low body and a broken ridge of crystals. */
const bloodhorn = (p2) => ({
  size: "xl", n: 104, glow: p2 ? "#ff8a7a" : "#ff3b3b", k: 1.22,
  draw(M, p) {
    const [lf, lift] = lunge(p, 1.6);
    const f = lf * 0.85, u = 7.5 + lift * 0.6 + bob(p, 0.42) - (p.dead || 0) * 4;
    const rear = p.wind ? 1 : 0, bite = p.strike ? 1 : 0;
    for (const [hip, s, phase] of [[5, -1, 0], [5, 1, 0.5], [-9, -1, 0.5], [-9, 1, 0]]) {
      const [sw, up] = gait(p, phase), reach = hip > 0 ? rear - bite * 2 : 0;
      const foot = [f + hip + sw * 2.6 - reach, 1 + up * 1.5, s * (hip > 0 ? 11 : 9.2)];
      M.tube([[f + hip, u - 1.3, s * 5.7], [f + hip - 1.3, u - 1.2, s * 8.9], foot], [3.2, 2.6, 2.0], HIDED);
      M.e([foot[0] + 0.4, foot[1], foot[2]], [2.7, 1.2, 2.3], HIDE);
      for (const toe of [-1.25, 1.15]) M.cone([foot[0] + 1.7, foot[1] + 0.4, foot[2] + toe], [foot[0] + 3.7, foot[1] - 0.3, foot[2] + toe], 0.73, MASKD);
    }
    const tailSwing = p.walk ? Math.sin(p.ph * Math.PI * 2) * 3 : bite ? -5 : 1;
    M.tube([[f - 9, u, 0], [f - 16, u - 2, tailSwing * 0.45], [f - 22, u - 3, tailSwing], [f - 27, 3.4, tailSwing * 1.45]], [4.5, 3.3, 1.8, 0.4], HIDED);
    M.G("body");
    M.e([f - 2, u - 0.8, 0], [12.8, 4.5, 8.5], HIDED);
    M.e([f + 2.2, u + 1.3, 0], [9.1, 4.8, 8.6], HIDE, [0, 7, 0]);
    M.e([f - 7.4, u + 0.2, 0], [7.3, 4.2, 7.7], HIDE);
    M.G();
    const plates = [[6, 5.2, 5.2, 1.6], [1.5, 6.5, 7.2, 3.4], [-3.4, 5.5, 5.9, 2.1], [-8, 4.4, 4.4, 1.6], [-12.1, 3.2, 3.2, 1.2], [-16.2, 2.2, 3.2, 1.0]];
    for (const [base, y, h, thick] of plates) {
      const y0 = u + y, raise = rear * (base > 0 ? 1.2 : 0);
      M.e([f + base, y0 - 1, 0], [2.9, 1.45, Math.max(3.3, 7 - Math.abs(base) * 0.21)], REDPLATE, [0, 10, 0]);
      M.cone([f + base, y0, 0], [f + base - 3.6, y0 + h + raise + (p2 ? 2.1 : 0), 0], thick, REDROCK);
      if (p2 || thick > 2) M.tube([[f + base + 0.3, y0 + 0.9, 0], [f + base - 1.4, y0 + h * 0.48, 0]], 0.48, p2 ? SEAMC : SEAM);
    }
    const hx = f + 12.2 + bite * 2.4, hy = u + 1.8 + rear * 1.8 - bite * 1.1;
    M.G("skull");
    M.e([hx - 2, hy, 0], [5.0, 3.6, 7.2], HIDED);
    M.box([hx + 2.1, hy + 0.65, 0], [5.3, 1.8, 5.1], MASKD, [0, -7, 0]);
    M.e([hx - 0.8, hy + 2, 0], [5.6, 2.3, 6.8], MASK);
    M.box([hx + 4.55, hy + 0.95, 0], [2.8, 1.6, 3.35], MASK, [0, -8, 0]);
    M.G();
    const jaw = bite ? 3.3 : p2 ? 2.0 : 1.2;
    M.e([hx + 3, hy - 1.8 - jaw, 0], [5.1, 1.05, 3.85], HIDED, [0, bite ? 9 : 1, 0]);
    both((s) => {
      M.tube([[hx - 2.4, hy + 2, s * 4.4], [hx - 4.75, hy + 5.6, s * 7.2], [hx - 8.6, hy + 7.8, s * 8.7]], [2, 1.35, 0.35], MASKD);
      M.cone([hx - 1.4, hy + 3.6, s * 2.8], [hx - 2.6, hy + 7.9, s * 3.4], 1.2, MASK);
      M.tube([[hx - 2, hy - 0.2, s * 5.1], [hx + 1.9, hy + 0.7, s * 5.2], [hx + 4, hy, s * 4.5]], [1.1, 0.7, 0.35], CAVITY);
      if (!p.dead) M.tube([[hx + 0.2, hy + 0.05, s * 5.8], [hx + 2.5, hy - 0.1, s * 5.3]], 0.54, p2 ? SEAMC : SEAM);
      M.cone([hx + 1.7, hy - 1, s * 4.1], [hx + 2.6, hy - 2.8 - jaw * 0.4, s * 4.5], 0.9, MASK);
      M.cone([hx + 5.7, hy - 0.85, s * 2.55], [hx + 5.9, hy - 2.1, s * 2.8], 0.65, MASK);
      if (bite) M.tube([[hx + 3.1, hy - 0.2, s * 4.6], [hx + 8.4, hy - 1.3, s * 5.2], [hx + 13.4, hy - 2.9, s * 5.6]], [0.62, 0.28], SEAM);
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

const CLK = mat("#312341", { flat: true }), CLKD = mat("#211729", { flat: true });
const WEB = mat("#523657", { flat: true }), WEBD = mat("#3a2948", { flat: true });
const VIO = mat("#d43cff", { role: "glow" }), HEART = mat("#ff4fd8", { role: "glow" }), HEARTC = mat("#ffd0f4", { role: "glow" });

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

/** The bat lord carries a cathedral arch on its shoulders, even when it closes its wings. */
const cloakbat = (ph) => ({
  size: "boss", n: 160, glow: ph > 1 ? "#ff4fd8" : "#d43cff", k: 1.2,
  draw(M, p) {
    const [lf, lift] = lunge(p, 1.7);
    const fly = ph === 2, channel = ph === 3, wind = p.wind ? 1 : 0, strike = p.strike ? 1 : 0, death = p.dead || 0;
    const f = lf * 0.8, u = (fly ? 23 : 16) + lift + bob(p, 0.9) - death * 8;
    const flap = fly && p.walk ? Math.sin(p.ph * Math.PI * 2) * 4.5 : p.idle ? -0.9 : 0;
    both((s) => {
      const [sw, up] = gait(p, s < 0 ? 0 : 0.5);
      const foot = fly ? [f - 8, u - 18, s * 4] : [f - 3.4 + sw * 2.6, 1 + up * 1.45, s * 5.0];
      M.tube([[f - 0.2, u - 4, s * 3.1], [f - 5.3, u - 8, s * 6.2], foot], [2.8, 2.3, 1.4], CLKD);
      M.cone(foot, [foot[0] + 2.5, foot[1] - 0.7, foot[2]], 0.8, MASKD);
    });
    M.G("body");
    M.e([f - 1.5, u + 0.6, 0], [6.6, 10.1, 5.2], CLKD, [0, 13, 0]);
    M.e([f + 0.6, u + 6.9, 0], [7.0, 5.9, 8.5], CLK);
    M.G();
    both((s) => {
      // A broad notch between each finger remains readable as the body turns.
      const flare = fly ? 1.05 : channel || wind ? 0.98 : 0.79;
      const lean = s < 0 ? -0.9 : 1.1;
      const root = [f - 0.6, u + 7.8, s * 6.3];
      const wing = (x, h, span) => [f + x + strike * span * 0.12, u + h + (wind * 3.4 + flap) * span / 36, s * (span * flare + lean)];
      const elbow = wing(2.8, 16, 14.7), tip = wing(-5, 13, 36), claw = wing(-9, 10.5, 39);
      const fringe = [
        elbow, tip, claw, wing(-9, 6.5, 29.5),
        wing(-15.6, -1, 30), wing(-11.9, 0.3, 22), wing(-15.5, -8.4, 21.5),
        wing(-9.6, -4, 15), wing(-12.2, -13, 12.8), wing(-5.5, -5.7, 8),
      ];
      M.G(s < 0 ? "leftWing" : "rightWing");
      for (let i = 0; i + 1 < fringe.length; i++) web(M, root, fringe[i], fringe[i + 1], i === 2 || i === 4 || i === 6 ? WEB : WEBD);
      M.tube([root, elbow, tip, claw], [2.25, 1.75, 0.85, 0.3], CLK);
      for (const i of [4, 6, 8]) M.tube([root, fringe[i]], [1.08, 0.34], CLK);
      M.cone(elbow, [elbow[0] + 1.8, elbow[1] + 3.2, elbow[2] - s * 0.8], 1.15, MASKD);
      M.G();
      if (fly || wind) M.tube([[elbow[0] + 0.2, elbow[1] + 1, elbow[2]], [tip[0] + 0.3, tip[1] + 0.6, tip[2] + s * 0.2]], 0.42, VIO);
    });
    const chest = [f + 5.7, u + 1.5, 0], open = channel || wind;
    M.e([chest[0], chest[1], 0], [2.2, 4.5, 4.2], CAVITY);
    for (let i = 0; i < 4; i++) both((s) => {
      const rib = chest[1] + 4.3 - i * 2.2, part = open ? 1.7 : 0.35;
      M.tube([[chest[0] - 1.1, rib + 0.6, s * (5 - i * 0.55)], [chest[0] + 0.7, rib, s * 3], [chest[0] + 0.85, rib - 0.95, s * part]], [0.78, 0.7, 0.4], i % 2 ? MASKD : MASK);
    });
    if (open) {
      M.e([chest[0] + 0.6, chest[1] - 0.1, 0], [1.95, 2.95, 2.4], HEART);
      M.e([chest[0] + 1.99, chest[1] + 0.75, 0], [0.75, 1.2, 1.15], HEARTC);
    } else M.tube([[chest[0] + 0.55, chest[1] + 3.4, 0], [chest[0] + 0.75, chest[1] - 3.3, 0]], 0.37, VIO);
    const hx = f + 5.1 + strike * 2.1, hy = u + 12 - strike * 1.6 + wind * 1.3;
    M.G("skull");
    M.e([hx - 0.85, hy, 0], [5, 4.4, 4.8], CLKD);
    M.e([hx + 1.05, hy + 0.25, 0], [3.9, 3.75, 4.0], MASK);
    M.box([hx + 3.65, hy - 1.65, 0], [1.45, 1.3, 2.25], MASKD, [0, -18, 0]);
    M.G();
    both((s) => {
      M.tube([[hx - 1, hy + 2.35, s * 3.45], [hx - 1.7, hy + 6.9, s * 6.4], [hx + 0.5, hy + 10.3, s * 8.4]], [1.65, 1.1, 0.32], MASKD);
      M.cone([hx - 0.2, hy + 3.35, s * 3.5], [hx - 1.6, hy + 8.3, s * 5.4], 1.1, MASK);
      M.tube([[hx + 2.3, hy + 1.3, s * 3.25], [hx + 3.5, hy + 0.55, s * 2.1], [hx + 3.85, hy + 0.3, s * 1.22]], [1.05, 0.76, 0.32], CAVITY);
      if (!death) M.tube([[hx + 3.15, hy + 0.83, s * 3.15], [hx + 3.98, hy + 0.29, s * 1.95]], 0.45, ph > 1 ? HEART : VIO);
      M.cone([hx + 4.02, hy - 2, s * 1.85], [hx + 4.35, hy - 4.65 - strike, s * 2.05], 0.72, MASK);
    });
  },
});

const WH = mat("#344550", { flat: true }), WHD = mat("#22313c", { flat: true });
const WPLATE = mat("#7c9a9c", { role: "keep", flat: true });
const CYN = mat("#7ff6ff", { role: "glow" }), CYNC = mat("#e0ffff", { role: "glow" });
const FLW = mat("#ff5ad8", { role: "glow" }), FLWC = mat("#ffd0f4", { role: "glow" });

/** A broad-skulled leviathan, with a wedge jaw and exposed rib armour over a sunken keel. */
const bloomwhale = (ph) => ({
  size: "boss", n: 190, glow: ph > 2 ? "#ff5ad8" : "#7ff6ff", k: 1,
  draw(M, p) {
    const [lf, lift] = lunge(p, 2.5);
    const dive = ph === 4, open = ph === 2 || ph === 3, bloom = ph >= 3;
    const charge = p.wind ? 1 : 0, strike = p.strike ? 1 : 0, death = p.dead || 0;
    const f = lf * 0.62, u = (dive ? 10 : 13) + lift * 0.45 + bob(p, 1.05) - death * 6 + charge * 4.2;
    const sw = p.walk ? Math.sin(p.ph * Math.PI * 2) * 3 : p.idle ? -1.5 : 0, glow = bloom ? FLW : CYN;
    M.G("body");
    M.e([f - 5, u + 2, 0], [26, 10.5, 14.0], WH);
    M.e([f - 13, u - 2.3, 0], [20.4, 8.5, 12.7], WHD);
    M.e([f + 11, u + (open ? 1 : 7.2), 0], [15.6, 6.8, 12.3], open ? WHD : WH);
    M.G();
    const fin = [f - 42.5 - strike * 2.5, u + 5.5 - strike * 5.3 + charge * 3.4, sw * 1.5];
    M.tube([[f - 22, u + 1, 0], [f - 33, u + 1.5, sw], fin], [7, 4.8, 1.65], WH);
    both((s) => {
      const tailTip = [fin[0] - 6.5, fin[1] + 2.3, fin[2] + s * 15.5], notch = [fin[0] - 9.4, fin[1] + 0.1, fin[2] + s * 3.2];
      M.G(s < 0 ? "leftFluke" : "rightFluke");
      web(M, fin, tailTip, notch, WHD);
      M.tube([fin, [fin[0] - 1.8, fin[1] + 1.5, fin[2] + s * 8.1], tailTip], [2.05, 1.55, 0.4], WH);
      M.G();
    });
    if (!dive) {
      const head = f + 21.6 + strike * 3, brow = u + 7.1 + strike * 0.8;
      M.G("skull");
      M.e([head, brow + 0.32, 0], [13.2, 6.25, 12.7], WHD, [0, -5, 0]);
      M.box([head + 6.2, brow + 1.9, 0], [8.9, 2.6, 8.7], WPLATE, [0, -7, 0]);
      M.e([head + 1.5, brow + 3.3, 0], [9.8, 3.1, 10.1], MASKD, [0, -9, 0]);
      M.e([head + 9.2, brow + 1, 0], [7.2, 2.3, 8.1], MASK);
      M.G();
      const jaw = u - 3 - strike * 3.1 - charge * 0.9, reach = head + 17.5;
      both((s) => {
        M.tube([[f + 11, u + 3.5, s * 10.3], [head + 0.5, jaw, s * 10.2], [head + 9.5, jaw - 1.4, s * 7.7], [reach, jaw - 0.2, s * 3.5]], [2.2, 2.5, 1.8, 0.8], MASKD);
        M.tube([[head + 5.6, jaw - 1.45, s * 9.5], [head + 12.7, jaw - 1.3, s * 6.2], [reach, jaw - 0.15, s * 3.6]], [0.92, 0.72, 0.28], MASK);
        for (const [tooth, side, depth] of [[3, 9.8, 4.5], [8, 8.2, 3.15], [12.5, 6.1, 3.8]]) {
          M.cone([head + tooth, brow - 1.5, s * side], [head + tooth + 0.25, brow - 1.5 - depth, s * (side - 0.25)], 1.01, MASK);
        }
        M.tube([[head - 1.9, brow + 1.35, s * 10.3], [head + 1.8, brow + 0.35, s * 11.1], [head + 4.7, brow + 0.45, s * 9.5]], [1.3, 0.9, 0.35], CAVITY);
        if (!death) M.tube([[head - 0.5, brow + 0.8, s * 11.05], [head + 2.32, brow + 0.44, s * 11.4]], 0.53, glow);
        const wingRoot = [f + 8, u - 1.7, s * 10.0];
        const wingElbow = [f + 3.8, u - 6.0 - sw * 0.35, s * 20.2], wingTip = [f - 7.2, u - 7.1 + strike * 2, s * 29];
        M.G(s < 0 ? "leftPectoral" : "rightPectoral");
        web(M, wingRoot, wingElbow, [f - 8, u - 5.7, s * 12], WHD);
        web(M, wingRoot, wingElbow, wingTip, WH);
        M.tube([wingRoot, wingElbow, wingTip], [2.1, 1.8, 0.48], WHD);
        M.G();
      });
      for (const [x, top, span] of [[-18, 10.6, 12.2], [-10.5, 13.3, 13.4], [-2.7, 13.6, 14.2], [5.4, 13, 13.6], [13.0, 10.6, 11.6]]) both((s) => {
        const rise = open && x > -11 ? 2.7 : 0, turn = open ? 1.8 : 0, rib = s * (span + turn);
        M.tube([[f + x, u + top + rise, s * (open ? 3.2 : 0.7)], [f + x + 1.35, u + top - 2.2 + rise, rib * 0.65], [f + x + 0.35, u + 3.6, rib], [f + x - 1.4, u - 3.7, rib * 0.87]], [1.18, 1.2, 1.16, 0.64], x % 3 > 1 ? MASKD : WPLATE);
      });
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
    // A few distinct crystal growths turn into funeral flowers when the channel opens.
    for (const [x, y, side, h] of [[15, 10, 3.4, 6], [3, 14, -4.2, 8], [-7, 13, 4.7, 6], [-17, 10.7, -4.0, 8], [-26, 8.0, 2.6, 5]]) {
      const root = [f + x, u + y - (dive ? 2.9 : 0), side];
      const tip = [root[0] - 2.75, root[1] + h, side * 1.25];
      if (!bloom) {
        M.cone(root, tip, 2.35, WPLATE);
        M.cone([root[0] - 0.4, root[1] + 1.3, root[2]], tip, 1.0, CYN);
      } else {
        M.tube([root, tip], [0.94, 0.48], WH);
        M.G("flowers");
        both((s) => M.cone([tip[0] - s * 0.4, tip[1], tip[2]], [tip[0] - 1.15 + s * 2.4, tip[1] + 1.75, tip[2] + s * 2.15], 1.18, FLW));
        M.s([tip[0] - 0.55, tip[1], tip[2]], 0.9, FLWC);
        M.G();
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
