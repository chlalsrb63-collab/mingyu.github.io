/**
 * Field bosses of the second wave (docs/design/bosses-2.md): 혈루 왕도마뱀 `bloodhorn` (mesa) and
 * 망치 갯가재 `clubshrimp` (coast). Near-black body, ONE glowing accent, bone-white mask.
 * Phase 2 is a separate kind key (`<k>_p2`, same model, brighter / cracked): the scene picks it
 * from the mob's phase (`m.ph >= 2`); frames are cached per kind so a flag in the pose would not do.
 */
import { mat, C, bez, gait, bob, lunge, both, surf } from "./mobart_kit.js";
import { BOSSES2_ADD_ART } from "./mobart_bosses2_adds.js";

const HIDE = mat("#1a1012"), HIDED = mat("#120a0c"), MASK = mat("#e8dfcf", { role: "keep" }), MASKD = mat("#a89c8a");
const SEAM = mat("#ff3b3b", { role: "glow" }), SEAMC = mat("#ffb0a0", { role: "glow" }), SHARD = mat("#ff6a5a", { role: "glow" });
const SHELL = mat("#0e1418"), SHELLD = mat("#080c10"), ICE = mat("#5ff2ff", { role: "glow" }), ICEC = mat("#c8ffff", { role: "glow" });
const CLUB = mat("#e8dfcf", { role: "keep" }), CLUBD = mat("#a89c8a");

/** 혈루 왕도마뱀: wide, low, plated; red seams, a bone skull crown of 7 horns, eyes that drip. */
const bloodhorn = (p2) => ({
  size: "xl", n: 104, glow: p2 ? "#ff8a7a" : "#ff3b3b", k: 1.12,
  draw(M, p) {
    const [lf, lu] = lunge(p, 1.4), rear = p.wind ? 1 : 0, bite = p.strike ? 1 : 0;
    const f0 = lf * 0.8, u0 = 5.2 + lu * 0.5 + bob(p, 0.4) - (p.dead ? 2.4 * p.dead : 0);
    // sprawled legs: elbow out to the side, foot down
    for (const [f, s, off] of [[5, -1, 0], [5, 1, 0.5], [-6, -1, 0.5], [-6, 1, 0]]) {
      const [sw, up] = gait(p, off), st = rear && f > 0 ? 1 : 0;
      const ft = [f0 + f + sw * 1.8 + st, up * 1.4, s * 9.5], hip = [f0 + f, u0 - 0.5, s * 5.2];
      M.tube([hip, [f0 + f + sw, u0 + 0.2 - st, s * 9.2], ft], [2, 1.4, 1.1], HIDE);
      for (const k of [-1, 0, 1]) M.cone(ft, [ft[0] + 2.4, 0.2, ft[2] + k * 1.5 + s * 0.8], 0.5, MASKD);
    }
    // the tail drags behind, swept sideways in a stride
    const sw = p.walk ? Math.sin(p.ph * 6.28) * 3 : 0;
    M.tube(bez([f0 - 8, u0, 0], [f0 - 16, u0 - 2, sw], [f0 - 24, u0 - 1.5, -sw * 1.4 + (p.strike ? 4 : 0)], 6), [3.4, 0.5], HIDE);
    M.G("body");
    M.e([f0, u0, 0], [10.5, 4.2, 7], HIDE);
    M.e([f0 + 2, u0 - 1, 0], [7, 2.6, 6], HIDED);
    M.G();
    // seams: glowing cracks over the back; P2 has more of them
    for (let i = 0; i < (p2 ? 6 : 4); i++) {
      const f = f0 + 6 - i * 3.2;
      both((s) => { M.tube([[f, u0 + 4, s * 1.2], [f - 1, u0 + 3.2, s * 4.4], [f - 1.6, u0 + 0.8, s * 6.6]], 0.45, SEAM); M.dot([f, u0 + 4.2, s * 1.2], "#ffb0a0"); });
    }
    // crystal shards along the spine (double height in P2)
    for (let i = 0; i < 7; i++) {
      const f = f0 + 7 - i * 2.5, h = (3 + (i % 3 === 1 ? 1.8 : 0)) * (p2 ? 2 : 1) * (1 - i * 0.04) + rear * 1.5;
      M.cone([f, u0 + 3.6, 0], [f - 1.2, u0 + 3.6 + h, 0], 1.1, i % 2 ? SHARD : SEAM);
    }
    // head: bone mask, jaw (splits and glows in P2 and when striking), the crown of seven horns
    const dip = bite ? -1.4 : rear ? 2.8 : 0, H = [f0 + 12.5 + (bite ? 2 : 0), u0 + 1 + dip, 0];
    M.e(H, [5.4, 2.6, 4], HIDE);
    M.e([H[0] + 0.4, H[1] + 1.2, 0], [4.6, 2, 3.5], MASK);
    M.e([H[0] + 2.5, H[1] + 0.6, 0], [2.4, 1.4, 2.4], MASKD);
    const jaw = bite || p2 ? 2.4 : 0.6;
    M.e([H[0] + 1.6, H[1] - 2.2 - jaw * 0.5, 0], [4.2, 1.1, 3], HIDED);
    if (bite || p2) {
      M.e([H[0] + 1.8, H[1] - 1.5 - jaw * 0.2, 0], [3, 0.7, 2.2], SEAMC);
      for (const k of [-1.6, 0, 1.6]) M.cone([H[0] + 3.2, H[1] - 1.8, k], [H[0] + 3.6, H[1] - 0.6, k], 0.4, MASK);
    }
    for (let i = 0; i < 7; i++) {
      const a = ((i - 3) / 3) * 1.15, L = 4.6 - Math.abs(i - 3) * 0.5;
      M.cone([H[0] - 1.6, H[1] + 2.4, Math.sin(a) * 3], [H[0] - 3.4, H[1] + 2.4 + Math.cos(a) * L, Math.sin(a) * (4 + L * 0.9)], 0.9, i % 2 ? MASK : MASKD);
    }
    // the eyes: two red slits that weep; striking, they jet a line of blood
    both((s) => {
      const e = surf([H[0] + 0.4, H[1] + 1.2, 0], [4.6, 2, 3.5], [1.2, 0.5, s * 1]);
      M.dot([e[0], e[1], e[2]], "#ff2a2a", 1, 2);
      if (!p.dead) M.dot([e[0] + 0.6, e[1] - 2 - (p.idle ? 1 : 0), e[2] + s * 0.8], "#d82838");
      if (bite) M.tube([[e[0], e[1], e[2]], [e[0] + 6, e[1] - 0.6, s * 1.6], [e[0] + 12, e[1] - 2.2, s * 2.2]], [0.7, 0.3], C.GORE);
    });
  },
});

/** 망치 갯가재: upright, carapace near-black, ice seams; two bone clubs as big as its body. */
const clubshrimp = (p2) => ({
  size: "xl", n: 104, glow: p2 ? "#d8ffff" : "#5ff2ff", k: 1.1,
  draw(M, p) {
    const [lf, lu] = lunge(p, 1.2), f0 = lf * 0.6, u0 = 6 + lu * 0.4 + bob(p, 0.5);
    const top = p.dead ? 0.55 : 1, ice = p2 ? "#d8ffff" : "#5ff2ff";
    // tail fan on a curled tail
    M.tube(bez([f0 - 2, u0 + 2, 0], [f0 - 9, u0 - 1, 0], [f0 - 11, 1.2, 0], 5), [4, 1.5], SHELL);
    for (let i = -2; i <= 2; i++) { M.cone([f0 - 10, 2, i * 0.8], [f0 - 14, 1 + Math.abs(i) * 0.2, i * 3.6], 1.2, SHELLD); M.dot([f0 - 14, 1.2, i * 3.6], ice); }
    // stacked carapace plates with an ice seam between them
    M.G("body");
    for (let i = 0; i < 6; i++) {
      const u = u0 + 1 + i * 4.2 * top, f = f0 + 1.5 + Math.sin(i * 0.6) * 1.2 + (p.wind ? -i * 0.25 : 0);
      M.e([f, u, 0], [5.2 - i * 0.2, 2.5, 5.6 - i * 0.35], i % 2 ? SHELL : SHELLD);
    }
    M.G();
    for (let i = 0; i < 5; i++) {
      const u = u0 + 3.2 + i * 4.2 * top;
      both((s) => M.tube([[f0 + 4.6, u, s * 1.5], [f0 + 3.6, u, s * 4], [f0 + 1.2, u, s * 5.4]], p2 ? 0.7 : 0.4, ICE));
      M.dot([f0 + 6, u, 0], "#c8ffff");
      if (p2) M.tube([[f0 + 4, u, 0.5], [f0 + 4.4, u + 1.8, 2.2], [f0 + 4, u + 3, 1.4]], 0.35, ICEC);
    }
    // small walking legs
    both((s) => {
      for (const [f, off] of [[3.5, 0], [-0.5, 0.5]]) {
        const [sw, up] = gait(p, off + (s > 0 ? 0.25 : 0));
        M.tube([[f0 + f, u0 + 0.6, s * 3.6], [f0 + f + sw + 1.4, u0 * 0.5 + up, s * 6], [f0 + f + sw * 2 + 2.4, up * 1.4, s * 5.6]], [1, 0.7, 0.45], SHELLD);
      }
    });
    // head: stalk eyes with a cyan glow, antennae
    const Hy = u0 + 1 + 6 * 4.2 * top, Hf = f0 + 3.4 + (p.strike ? 1.4 : 0);
    M.e([Hf, Hy, 0], [4.2, 2.6, 4.6], SHELL);
    both((s) => {
      const e = [Hf + 1.4, Hy + 5.4, s * 5];
      M.tube([[Hf + 0.6, Hy + 1.4, s * 2.4], [Hf + 1, Hy + 4, s * 4], e], [0.9, 0.7], SHELLD);
      M.s(e, 1.7, ICE); M.dot([e[0] + 1, e[1] + 0.4, e[2]], "#c8ffff");
      M.tube([[Hf + 3.6, Hy + 1, s * 1], [Hf + 8, Hy + 2.6, s * 3.4], [Hf + 11, Hy + 1, s * 5.6]], [0.5, 0.2], ICE);
    });
    // the clubs: a folded arm, a bone-white club at the end (raised to wind up, thrown forward to strike)
    both((s) => {
      const sh = [Hf + 0.6, Hy - 4, s * 5.2];
      let el = [sh[0] + 5, sh[1] - 3.6, s * 8.6], cl = [el[0] + 5, el[1] + 1.8, s * 7.2], tv = [1, 0.25, 0];
      if (p.wind) { el = [sh[0] - 1, sh[1] + 5, s * 8]; cl = [el[0] - 2, el[1] + 5.6, s * 5.6]; tv = [0.1, 1, 0]; }
      else if (p.strike) { el = [sh[0] + 6, sh[1] - 1, s * 6]; cl = [el[0] + 8, el[1] - 4.4, s * 3.4]; tv = [1, -0.6, 0]; }
      else if (p.walk) cl = [cl[0], cl[1] + Math.sin(p.ph * 6.28 + s) * 0.9, cl[2]];
      M.tube([sh, el, cl], [1.8, 1.4, 1.5], SHELL);
      const e1 = [cl[0] + tv[0] * 4.4, cl[1] + tv[1] * 4.4, cl[2]];
      M.e([(cl[0] + e1[0]) / 2, (cl[1] + e1[1]) / 2, cl[2]], [4.4, 3.4, 3.4], CLUB, [0, p.wind ? 80 : p.strike ? -30 : 0, 0]);
      M.s(e1, 2.6, CLUBD);
      M.dot([e1[0] + 2.4, e1[1] + 0.6, e1[2]], ice, 2, 2);
      if (p2) for (const k of [0.6, 1.8, 3]) M.cone([cl[0] + tv[0] * k, cl[1] + tv[1] * k + 2.2, cl[2] + s * 1.4], [cl[0] + tv[0] * k + 0.4, cl[1] + tv[1] * k + 6.4, cl[2] + s * 2.4], 0.8, ICE);
    });
  },
});

const CLK = mat("#120a16"), CLKD = mat("#0a060e"), VIO = mat("#d43cff", { role: "glow" }), HEART = mat("#ff4fd8", { role: "glow" }), HEARTC = mat("#ffd0f4", { role: "glow" });

/** 밤장막 박쥐군주 (raid): hunched, wrapped in its own wings. ph 1 cloaked, 2 torn + flying, 3 chest open (the channel). */
const cloakbat = (ph) => ({
  size: "boss", n: 160, glow: ph > 1 ? "#ff4fd8" : "#d43cff", k: 1.2,
  draw(M, p) {
    const [lf, lu] = lunge(p, 1.8), wind = p.wind ? 1 : 0, hit = p.strike ? 1 : 0, dead = p.dead || 0;
    const fly = ph === 2, open = ph === 3 || wind;
    const f0 = lf * 0.6, u0 = (fly ? 24 : 17) + lu + bob(p, 1) - dead * 8;
    const flap = fly ? (p.walk ? Math.sin(p.ph * 6.28) * 5 : p.idle ? 2 : 0) + (wind ? 6 : 0) : 0;
    if (!fly) both((s) => { for (const f of [2, -4]) { const [a, up] = gait(p, (f > 0 ? 0 : 0.5) + (s > 0 ? 0.25 : 0)); M.tube([[f0 + f, u0 - 8, s * 4], [f0 + f + a * 2, 4 + up, s * 6], [f0 + f + a * 3 + 1.5, up * 1.4, s * 6]], [2.6, 1.8, 1.3], CLKD); } });
    else both((s) => M.tube([[f0 - 1, u0 - 8, s * 2.6], [f0 - 4, u0 - 15 - flap * 0.3, s * 3.2], [f0 - 6, u0 - 19, s * 2.4]], [1.8, 1, 0.5], CLKD));
    M.G("body");
    M.e([f0, u0, 0], [8.5, 11, 7.5], CLK);
    M.e([f0 + 3, u0 - 2, 0], [5.5, 7, 6.5], CLKD);
    M.G();
    // chest: closed = a bone ribcage plate with a violet seam; open = ribs swung apart round a glowing eye-heart
    const ch = [f0 + 6.8, u0 + 1.5, 0];
    if (open) {
      M.e([ch[0] - 0.4, ch[1], 0], [2.6, 5.4, 4.6], CLKD);
      for (let i = 0; i < 4; i++) both((s) => M.tube([[ch[0] + 0.4, ch[1] + 4.4 - i * 2.6, s * 1.4], [ch[0] + 1.4, ch[1] + 4.8 - i * 2.6, s * 4.6], [ch[0] - 0.4, ch[1] + 3.4 - i * 2.6, s * 7]], [0.8, 0.5], MASK));
      M.s([ch[0] + 0.8, ch[1], 0], ph === 3 ? 3.6 : 3, HEART);
      M.s([ch[0] + 1.6, ch[1] + 0.6, 0], 1.7, HEARTC);
      both((s) => M.dot([ch[0] + 2.8, ch[1] + 0.2, s * 1.2], "#ffd0f4", 1, 2));
    } else {
      for (let i = 0; i < 4; i++) both((s) => M.tube([[ch[0], ch[1] + 4.4 - i * 2.6, 0.4 * s], [ch[0] + 0.5, ch[1] + 4.2 - i * 2.6, s * 3.2], [ch[0] - 0.8, ch[1] + 3.4 - i * 2.6, s * 6]], [0.8, 0.5], i % 2 ? MASK : MASKD));
      M.tube([[ch[0] + 0.8, ch[1] + 5, 0], [ch[0] + 1, ch[1], 0], [ch[0] + 0.8, ch[1] - 5, 0]], 0.5, VIO);
    }
    // wings: P1 hang like a cloak round the body; P2 spread (torn ribbons); P3 half raised, ragged
    both((s) => {
      const sh = [f0 - 1, u0 + 8, s * 7];
      if (ph === 1 && !wind) {
        const sw = hit ? 6 : 0;
        M.tube([sh, [f0 + 2 + sw, u0 - 1, s * 11], [f0 - 1 + sw, u0 - 12, s * 9.4]], [3, 2.6, 1.2], CLK);
        for (let i = 0; i < 4; i++) M.cone([f0 + 1 - i * 2.4 + sw * 0.5, u0 + 2 - i * 3, s * (9.6 - i * 0.5)], [f0 - 2 - i * 2.4, u0 - 15 - (i % 2) * 2.5, s * (10 + i)], 1.3, i % 2 ? CLKD : CLK);
        M.tube([[f0 + 2 + sw, u0 + 1, s * 11], [f0 + 1 + sw, u0 - 6, s * 10.4]], 0.4, VIO);
      } else {
        const sp = ph === 2 ? 1 : 0.6 + (wind ? 0.4 : 0), tip = [f0 - 4 + (wind ? 6 : 0), u0 + 6 + flap + (ph === 3 ? 4 : 0), s * (26 * sp + 6)], el = [f0 - 2, u0 + 12 + flap * 0.5, s * 15 * sp + 4];
        M.tube([sh, el, tip], [3, 1.8, 0.8], CLK);
        M.tube([sh, el, tip], 0.35, VIO);
        // ribbons: finger bones trailing down, ragged and uneven
        for (let i = 0; i < 5; i++) {
          const t = (i + 1) / 6, bx = sh[0] + (tip[0] - sh[0]) * t - 1, bu = sh[1] + (tip[1] - sh[1]) * t * 0.7, bs = sh[2] + (tip[2] - sh[2]) * t;
          const len = ph === 2 ? 7 + ((i * 7) % 5) * 2.2 : 9 - i * 0.8;
          M.cone([bx, bu, bs], [bx - 2 - (i % 2) * 1.6, bu - len - flap * 0.4, bs + s * 1.4], 1.4, i % 2 ? CLKD : CLK);
          M.dot([bx - 2 - (i % 2) * 1.6, bu - len - flap * 0.4, bs + s * 1.4], ph > 1 ? "#ff4fd8" : "#d43cff", 1, 1);
        }
      }
    });
    // head: bone pig-nosed skull mask, ear-horns, one violet glow in each socket
    const dip = wind ? 1.8 : hit ? -1.4 : 0, H = [f0 + 5.5 + (hit ? 2 : 0), u0 + 12 + dip - dead * 3, 0];
    M.e(H, [4.4, 4.2, 3.6], CLK);
    M.e([H[0] + 0.8, H[1] + 0.2, 0], [3.6, 3.4, 3], MASK);
    M.e([H[0] + 3.6, H[1] - 1, 0], [2, 1.5, 2.2], MASKD);
    both((s) => { M.dot([H[0] + 4.9, H[1] - 1, s * 0.9], "#120a16", 1, 1); M.cone([H[0] - 1, H[1] + 2, s * 2.6], [H[0] - 3 - (ph > 1 ? 1 : 0), H[1] + 10 + (wind ? 2 : 0), s * (6 + (wind ? 1.5 : 0))], 1.3, MASK); });
    both((s) => { const e = surf([H[0] + 0.8, H[1] + 0.2, 0], [3.6, 3.4, 3], [1.2, 0.5, s * 1]); M.dot([e[0], e[1] + 0.6, e[2]], ph > 1 ? "#ff4fd8" : "#d43cff", 1, 2); });
    if (hit || ph > 1) for (const k of [-1.2, 1.2]) M.cone([H[0] + 3.4, H[1] - 2.4, k], [H[0] + 3.6, H[1] - 4.6, k * 1.2], 0.4, MASK);
  },
});

const WH = mat("#0c1016"), WHD = mat("#070a0e"), CYN = mat("#7ff6ff", { role: "glow" }), CYNC = mat("#e0ffff", { role: "glow" });
const FLW = mat("#ff5ad8", { role: "glow" }), FLWC = mat("#ffd0f4", { role: "glow" });

/**
 * 꽃무덤 고래 (raid R2): a long whale carcass floating low. ph 1 cyan shards between closed ribs, 2 ribs open round a
 * cyan heart (+ hagfish heads from the wounds), 3 the channel: ribs open, heart and flowers magenta, 4 dive (sunk, only back + flowers show).
 */
const bloomwhale = (ph) => ({
  size: "boss", n: 190, glow: ph > 2 ? "#ff5ad8" : "#7ff6ff", k: 1,
  draw(M, p) {
    const [lf, lu] = lunge(p, 3), wind = p.wind ? 1 : 0, hit = p.strike ? 1 : 0, dead = p.dead || 0;
    const dive = ph === 4, open = ph === 2 || ph === 3, bloom = ph >= 3;
    const A = bloom ? FLW : CYN, AC = bloom ? FLWC : CYNC;
    const sw = p.walk ? Math.sin(p.ph * 6.28) * 3 : p.idle ? Math.sin(p.ph * 6.28) * 1 : 0;
    const f0 = lf * 0.5, u0 = (dive ? 10 : 12) + lu * 0.5 + bob(p, 1.2) - dead * 6 + (wind ? 5 : 0); // dive sits 10 up: lower is cut off at the canvas edge (tests/mobart)
    // body: a long near-black barrel, belly hanging lower than the back
    M.G("body");
    M.e([f0, u0 + 1, 0], [34, 11, 12.5], WH);
    M.e([f0 - 8, u0 - 2, 0], [24, 9, 11], WHD);
    M.G();
    // tail: tapers back and up, flukes spread sideways, slaps on strike
    const tu = hit ? -4 : 6 + (wind ? 5 : 0);
    const tail = [[f0 - 26, u0 + 2, 0], [f0 - 38, u0 + 3 + sw * 0.3, sw], [f0 - 46, u0 + tu + 5, sw * 1.6]];
    M.tube(tail, [8, 4, 1.6], WH);
    const te = tail[2];
    both((s) => M.tube([te, [te[0] - 5 - (hit ? 4 : 0), te[1] + 2, s * 8], [te[0] - 3, te[1] + 1, s * 16]], [2, 1.4, 0.4], WHD));
    if (!dive) {
      // lower jaw (bone) and a ragged upper head
      const jy = u0 - 5 - (wind ? 1.5 : 0) - dead * 3 - (hit ? 2.5 : 0);
      M.e([f0 + 30, u0 + 1, 0], [8, 8, 9], WH);
      both((s) => M.tube([[f0 + 12, jy - 2, s * 8], [f0 + 26, jy - 4, s * 7], [f0 + 38, jy - 2 + (hit ? 0 : 2), s * 3]], [1.8, 1.3, 0.8], MASK));
      for (let i = 0; i < 7; i++) both((s) => M.cone([f0 + 20 + i * 2.6, jy - 3 + i * 0.3, s * (7 - i * 0.6)], [f0 + 20 + i * 2.6, jy + 0.6, s * (7 - i * 0.6)], 0.5, MASKD));
      both((s) => { M.dot([f0 + 32, u0 + 6, s * 8.2], "#e8dfcf", 1, 1); });
      // pectoral fins, long and drooping
      both((s) => M.tube([[f0 + 12, u0 - 6, s * 10], [f0 + 8, u0 - 11 - sw * 0.3, s * 18], [f0 + 1, u0 - 10, s * 25]], [2.6, 1.8, 0.6], WHD));
    }
    // ribs: closed = low arcs with cyan seam; open = swung wide round the heart
    const rs = dive ? 0 : 1;
    if (rs) {
      const wd = open ? 1.25 : 0.5 + wind * 0.2;
      if (open) M.e([f0 + 1, u0 + 8, 0], [16, 5, 10], WHD);
      for (let i = 0; i < 6; i++) {
        const f = f0 - 12 + i * 5, pts = [];
        for (let a = -100; a <= 100; a += 25) { const t = a * Math.PI / 180; pts.push([f, u0 + 3 + Math.cos(t) * 11.5, Math.sin(t) * 12.5 * wd]); }
        M.tube(pts, [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9], i % 2 ? MASKD : MASK);
      }
      if (open) {
        M.s([f0 + 2, u0 + 9, 0], bloom ? 4.6 : 3.8, A);
        M.s([f0 + 3, u0 + 10, 0], 2.2, AC);
        M.tube([[f0 + 2, u0 + 9, 0], [f0 - 6, u0 + 5, 0]], 0.7, A);
        M.tube([[f0 + 2, u0 + 9, 0], [f0 + 10, u0 + 5, 0]], 0.7, A);
      } else {
        for (let i = 0; i < 4; i++) { const f = f0 - 9 + i * 7; M.cone([f, u0 + 12, 1.5], [f + 1, u0 + 17 + (i % 2) * 2, 1.5], 1.1, A); }
      }
    }
    // spirit flowers / crystal shards on the spine; P3 and the dive carry the whole garden
    const n = ph === 1 ? 3 : bloom || dive ? 10 : 5;
    for (let i = 0; i < n; i++) {
      const f = f0 + 22 - i * (50 / n) - (i % 2) * 2, s = ((i * 5) % 7 - 3) * 1.6, top = u0 + 11 + (i % 3) * 2 - (ph === 4 ? 2 : 0);
      if (bloom || dive) {
        M.tube([[f, top - 2, s], [f, top + 1, s]], 0.5, WHD);
        M.s([f, top + 3, s], 2, FLW); M.s([f, top + 3.4, s], 0.9, FLWC);
        both((q) => M.dot([f + q * 2.4, top + 2.4, s + q * 0.6], "#ff5ad8", 1, 1));
      } else M.cone([f, top - 2, s], [f + 1, top + 4 + (i % 2) * 3, s], 1.4, CYN);
    }
    // hagfish heads burrowing out of wounds (P2)
    if (ph === 2) for (const [f, s, d] of [[16, 11.5, 1], [-6, -11.8, -1], [-18, 11, 1]]) {
      M.tube([[f0 + f, u0 - 1, s], [f0 + f, u0 + 1, s + d * 3], [f0 + f + 1.5, u0 + 3, s + d * 6]], [2.2, 1.6, 1.3], MASKD);
      M.dot([f0 + f + 2.8, u0 + 3.6, s + d * 6.6], "#120a0c", 1, 1);
    }
    // dive: a dark wake instead of a head
    if (dive) M.e([f0 + 26, 1, 0], [9, 3, 8], WHD);
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
