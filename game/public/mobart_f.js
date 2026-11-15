/**
 * Field bosses of the second wave (docs/design/bosses-2.md): 혈루 왕도마뱀 `bloodhorn` (mesa) and
 * 망치 갯가재 `clubshrimp` (coast). Near-black body, ONE glowing accent, bone-white mask.
 * Phase 2 is a separate kind key (`<k>_p2`, same model, brighter / cracked): the scene picks it
 * from the mob's phase (`m.ph >= 2`); frames are cached per kind so a flag in the pose would not do.
 */
import { mat, C, bez, gait, bob, lunge, both, surf } from "./mobart_kit.js";

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

export const BEASTS_F = {
  bloodhorn: bloodhorn(false), bloodhorn_p2: bloodhorn(true),
  clubshrimp: clubshrimp(false), clubshrimp_p2: clubshrimp(true),
  cloakbat: cloakbat(1), cloakbat_p2: cloakbat(2), cloakbat_ch: cloakbat(3),
};
