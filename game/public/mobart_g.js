/**
 * The second wave of beasts (10-tables.js, each with a telegraphed trick): one identifying part apiece —
 * a tongue for a foot, a gnawing maw, a gravestone back, a smoking spine, hook arms, a split grin, a rolled
 * skull, cracked ice tusks. Pieces are modelled in [forward, up, side], like mobart_e.js.
 */
import { mat, gait, bob, lunge, both, legs4, teeth, C } from "./mobart_kit.js";

const SLIME = mat("#7f8a3c", { wet: true }), SLIMED = mat("#55602a", { wet: true });
const BADG = mat("#3a3238"), BADGW = mat("#d8d0c0", { role: "keep" }), BADGG = mat("#6a6068");
const SLAB = mat("#8a8a90", { role: "keep", flat: true }), SLABD = mat("#5a5a64", { role: "keep", flat: true }), CRICK = mat("#3e3428");
const SOOT = mat("#5a4e66"), SOOTD = mat("#352c40"), EMBER = mat("#ff7a2a", { role: "glow" });
const MOSS = mat("#6a6a3a"), MOSSD = mat("#45442a"), HOOK = mat("#e0d6bc", { role: "keep" });
const HYE = mat("#a88a58"), HYED = mat("#6a5234"), SPOT = mat("#3a2a20");
const SCAR = mat("#2e3a4a", { wet: true }), SCARG = mat("#4a8a7a", { wet: true });
const WAL = mat("#6a7a8a"), WALD = mat("#45505e"), ICE = mat("#7ae0f0", { role: "glow" }), ICEC = mat("#d8ffff", { role: "glow" });

export const BEASTS_G = {
  /** 혀 민달팽이 — a slug that lost its shell and grew a tongue instead; it walks on it, and the slime stays behind. */
  slugtongue: {
    size: "m", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p, 0.8);
      const ripple = p.walk ? Math.sin(p.ph * Math.PI * 2) * 0.6 : 0, u = 2.4 + lu * 0.4 + bob(p, 0.3) - (p.dead || 0) * 1.4;
      M.G("body");
      M.e([lf - 3, u, 0], [6.5, 2.4 + ripple * 0.3, 3.4], SLIMED);
      M.e([lf + 1.5, u + 1.2, 0], [4.2, 3 - ripple * 0.3, 3.2], SLIME);
      M.G();
      // the tongue it walks on: out of the mouth and down along the ground, lashing out on a strike
      const reach = p.strike ? 4 : p.wind ? -1.5 : 0;
      M.tube([[lf + 4.6, u + 1.4, 0], [lf + 7 + reach, u - 0.6, 0], [lf + 8.5 + reach * 1.4, 0.5, 0], [lf + 6 + reach, 0.2, 0]], [1.5, 1.4, 1.1, 0.6], C.TONGUE);
      M.e([lf + 4.8, u + 1.6, 0], [0.9, 1.3, 1.8], C.MAW);
      // eyestalks, one longer than the other
      both((s) => {
        const tip = [lf + 2.6 + (s > 0 ? 0.6 : 0), u + 6.4 + (s > 0 ? 1.2 : 0) + ripple, s * 1.6];
        M.tube([[lf + 2, u + 2.6, s * 1], tip], 0.4, SLIME);
        M.s(tip, 0.8, C.EYEW); M.eye([tip[0] + 0.5, tip[1], tip[2]], 1, "#3a1020");
      });
      // slime beads down its sides
      for (const f of [-6, -3, 0]) M.s([lf + f, 0.5, (f % 2 ? 1 : -1) * 2.8], 0.6, C.BILE);
    },
  },

  /** 이빨굴 오소리 — a badger whose teeth kept growing; it digs with them, and comes up under your feet. */
  gnawbadger: {
    size: "m", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const u = 5 + lu + bob(p, 0.4) - (p.dead || 0) * 2.5;
      legs4(M, p, { ff: lf + 3.5, bf: lf - 4, w: 3, hu: u - 1, r: 1.2, m: BADG, foot: HOOK, st: 1.6 });
      M.G("body");
      M.e([lf - 1, u + 1, 0], [6.4, 3.4, 4], BADG);
      M.e([lf - 1, u + 3.6, 0], [5.6, 1.2, 1.6], BADGW);   // the white stripe down its back
      M.G();
      M.cone([lf - 6.5, u + 1.2, 0], [lf - 9, u + 1.8, 0], 1.2, BADGG);
      // a flat striped head, and the teeth: two huge yellowed chisels and a ring of smaller ones
      const hx = lf + 6 + (p.strike ? 1.4 : 0), hy = u + 1.6 + (p.wind ? -0.8 : 0);
      M.G("head");
      M.e([hx, hy, 0], [3.2, 2.4, 2.8], BADG);
      M.e([hx + 0.4, hy + 1.6, 0], [2.8, 0.7, 1], BADGW);
      M.G();
      both((s) => { M.e([hx - 1, hy + 1.8, s * 2.2], [1, 0.8, 0.6], BADGW); M.eye([hx + 1.2, hy + 0.6, s * 1.8], 1, "#f0d040"); });
      const gape = p.strike ? 1.6 : p.wind ? 1 : 0.4;
      M.e([hx + 2.6, hy - 0.8, 0], [1.2, 0.6 + gape * 0.5, 1.8], C.MAW);
      both((s) => M.box([hx + 3.6, hy - 1.6 - gape * 0.4, s * 0.6], [0.6, 1.7, 0.5], C.TOOTH, [0, 0, s * 6]));
      teeth(M, [hx + 2.4, hy - 0.4, -1.6], [hx + 2.4, hy - 0.4, 1.6], 4, 1, 0.7);
    },
  },

  /** 무덤 귀뚜라미 — a cricket grown under a headstone, still wearing it; it sings, then leaps. */
  gravecricket: {
    size: "m", k: 1.05,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const u = 4 + lu + bob(p, 0.3) - (p.dead || 0) * 2;
      // the great hind legs, folded high: they kick straight on a strike
      both((s) => {
        const kick = p.strike ? 1 : 0, coil = p.wind ? 1 : 0;
        const knee = [lf - 5 - kick * 2, u + 5 + coil * 1.5 - kick * 3, s * 3.6], foot = [lf - 3 - kick * 5, 0.3, s * 4];
        M.tube([[lf - 2, u, s * 2], knee], [1.3, 0.9], CRICK);
        M.tube([knee, foot], [0.6, 0.4], CRICK);
        for (const off of [0, 0.5]) {
          const [sw, up] = gait(p, off + (s > 0 ? 0.5 : 0));
          const top = [lf + 1.5 + off * 3, u - 0.5, s * 1.8];
          M.tube([top, [top[0] + 1 + sw, u * 0.5 + up, s * 3], [top[0] + 1.6 + sw * 1.4, up * 0.8, s * 3.8]], [0.5, 0.4, 0.3], CRICK);
        }
      });
      M.e([lf, u + 0.4, 0], [4.6, 2, 2.6], CRICK);
      // the headstone on its back, cracked and rounded at the top
      M.G("stone");
      M.box([lf - 1.4, u + 4.2, 0], [3.2, 3, 0.9], SLAB, [0, -12, 0]);
      M.e([lf - 2, u + 7, 0], [2.9, 1.4, 0.9], SLAB, [0, -12, 0]);
      M.G();
      M.tube([[lf - 0.6, u + 6.8, 0.95], [lf - 1.6, u + 4.8, 0.95], [lf - 0.8, u + 3.2, 0.95]], 0.25, SLABD);
      // a skull for a face, and antennae like grave grass
      const hx = lf + 4.6, hy = u + 1;
      M.e([hx, hy, 0], [2, 2, 2], C.BONE);
      both((s) => { M.e([hx + 1.1, hy + 0.4, s * 0.9], [0.6, 0.7, 0.6], C.MAW); M.eye([hx + 1.5, hy + 0.4, s * 0.9], 1, "#e02838");
        M.tube([[hx + 0.6, hy + 1.6, s * 0.6], [hx + 3, hy + 5 + (p.idle ? 0.4 : 0), s * 2], [hx + 5.5, hy + 4, s * 3]], 0.22, CRICK); });
      M.e([hx + 1.8, hy - 1.2, 0], [0.7, 0.4, 1.1], C.TOOTH);
    },
  },

  /** 매연 도마뱀붙이 — a gecko that lived on a chimney; its spine became one, and it breathes out what it ate. */
  smoggecko: {
    size: "m", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const u = 2.6 + lu * 0.6 + bob(p, 0.3) - (p.dead || 0) * 1.5;
      both((s) => {
        for (const [hip, off] of [[3, 0], [-3.5, 0.5]]) {
          const [sw, up] = gait(p, off + (s > 0 ? 0.5 : 0));
          const foot = [lf + hip + sw * 1.6, up, s * 5.4];
          M.tube([[lf + hip, u, s * 2], [lf + hip + 0.4, u + 1.2, s * 4], foot], [0.8, 0.6, 0.5], SOOTD);
          M.s(foot, 0.9, SOOT);   // sucker toes
        }
      });
      const sway = p.walk ? Math.sin(p.ph * Math.PI * 2) * 1.4 : 0;
      M.tube([[lf - 4, u, 0], [lf - 8, u - 0.6, sway], [lf - 12, u - 1, sway * 1.6]], [1.8, 1.1, 0.4], SOOTD);
      M.G("body");
      M.e([lf, u + 0.6, 0], [5.4, 1.9, 2.8], SOOT);
      M.G();
      // the chimney spine: three stubby flues, the front one smoking orange on a wind-up
      [[-2.6, 2.4], [-0.4, 2.9], [1.8, 2.4]].forEach(([f, h], i) => {
        M.tube([[lf + f, u + 2, 0], [lf + f, u + 2 + h, 0]], 0.9, SLABD);
        M.e([lf + f, u + 2.2 + h, 0], [0.8, 0.3, 0.8], p.wind && i === 2 ? EMBER : C.MAW);
      });
      const hx = lf + 6.2 + (p.strike ? 1 : 0), hy = u + 1.2;
      M.e([hx, hy, 0], [2.6, 1.5, 2.2], SOOT);
      M.e([hx + 0.4, hy - 0.9, 0], [1.9, 0.6 + (p.wind ? 0.5 : 0), 1.7], EMBER);   // the glowing throat it breathes from
      both((s) => { M.s([hx - 0.4, hy + 1, s * 1.5], 0.9, C.EYEW); M.stare([hx - 0.4, hy + 1, s * 1.5], 0.9, "#ffb020"); });
      if (p.strike) M.e([hx + 3.4, hy - 0.4, 0], [1.6, 1, 1.4], EMBER);
    },
  },

  /** 낙하 나무늘보 — a sloth that waits a whole season in the canopy, then drops: three hooks on each arm, a smile of too many teeth. */
  dropsloth: {
    size: "l", k: 1.12,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const u = 6 + lu + bob(p, 0.3) - (p.dead || 0) * 3;
      // short back legs; the long arms do the walking, hooks first
      both((s) => {
        const [sw, up] = gait(p, s > 0 ? 0.5 : 0);
        M.tube([[lf - 3, u - 2, s * 2.4], [lf - 3 + sw, up, s * 3]], [1.3, 0.9], MOSSD);
        const raise = p.wind ? 1 : 0, slash = p.strike ? 1 : 0;
        const [sa, ua] = gait(p, s > 0 ? 0 : 0.5);
        const elbow = [lf + 3 + sa, u + 1 + raise * 4, s * 4.6], hand = [lf + 5.5 + sa * 1.2 + slash * 1.4, ua * 0.8 + 0.8 + raise * 3 - slash * 0.4, s * 4.4];
        M.tube([[lf + 1.5, u + 2, s * 3], elbow, hand], [1.3, 1, 0.8], MOSS);
        for (const t of [-0.8, 0, 0.8]) M.cone(hand, [hand[0] + 1.6, hand[1] - 1.8 + raise * 2, hand[2] + t], 0.45, HOOK);
      });
      M.G("body");
      M.e([lf - 1, u, 0], [4.4, 4, 3.8], MOSSD);
      M.e([lf, u + 1.6, 0], [3.6, 3, 3.6], MOSS);
      M.G();
      for (const [f, h, s] of [[-3, 3, 2], [-1, 4.4, -2.2], [1.6, 3.6, 2.6]]) M.cone([lf + f, u + h, s], [lf + f - 1.4, u + h - 1.4, s * 1.2], 0.6, MOSSD);   // matted moss
      // the face: a pale mask with dark eye-stripes and a grin from cheek to cheek
      const hx = lf + 3.6, hy = u + 4.2;
      M.e([hx, hy, 0], [2.2, 2.2, 2.6], MOSS);
      M.e([hx + 1.2, hy, 0], [1.2, 1.7, 2.2], BADGW);
      both((s) => { M.e([hx + 1.7, hy + 0.5, s * 1.1], [0.5, 0.5, 0.8], SPOT); M.eye([hx + 2.1, hy + 0.6, s * 1.1], 1, "#d8f040"); });
      const gape = p.strike ? 0.8 : 0.3;
      M.e([hx + 2.1, hy - 0.9, 0], [0.5, 0.3 + gape, 1.9], C.MAW);
      teeth(M, [hx + 2.4, hy - 0.6, -1.7], [hx + 2.4, hy - 0.6, 1.7], 6, 1, 0.5);
    },
  },

  /** 웃는 하이에나 — its grin split past the ears; when it laughs, everything near it goes mad. */
  gigglehyena: {
    size: "m", k: 1.12,
    draw(M, p) {
      const [lf, lu] = lunge(p);
      const u = 6 + lu + bob(p, 0.5) - (p.dead || 0) * 3;
      // the sloped back: tall at the shoulder, low at the hip
      legs4(M, p, { ff: lf + 3, bf: lf - 4, w: 2.6, hu: u, r: 1.1, m: HYED, foot: HYED, st: 2 });
      M.G("body");
      M.e([lf + 1.2, u + 1.6, 0], [4, 3, 3.2], HYE, [0, 14, 0]);
      M.e([lf - 3.4, u + 0.2, 0], [3.4, 2.4, 2.8], HYE, [0, 8, 0]);
      M.G();
      for (const [f, h, s] of [[-3.6, 1.6, 2.6], [-1, 3, 3], [1.6, 3.6, -3], [-2.4, 1, -2.6], [2.8, 2.6, 3.2]]) M.s([lf + f, u + h, s], 0.7, SPOT);
      M.tube([[lf + 0.6, u + 4.6, 0], [lf - 2, u + 3.8, 0], [lf - 4.6, u + 2.4, 0]], [0.8, 0.6, 0.3], SPOT);   // the mane
      M.cone([lf - 6.4, u + 0.6, 0], [lf - 8.4, u - 0.6, 0], 0.7, SPOT);
      // the head low and forward, the grin opening wider than the head on a laugh
      const hx = lf + 6.4 + (p.strike ? 1.4 : 0), hy = u + 2.4 - (p.wind ? 0.6 : 0);
      M.e([hx, hy, 0], [2.8, 2, 2.4], HYE);
      both((s) => { M.cone([hx - 1, hy + 1.4, s * 1.4], [hx - 1.6, hy + 3.6, s * 2], 0.8, HYED); M.eye([hx + 0.8, hy + 0.9, s * 1.3], 1, "#b4f040"); });
      const gape = p.wind ? 1.6 : p.strike ? 1.2 : 0.5;
      M.e([hx + 1.8, hy - 0.8, 0], [1.8, 0.4 + gape * 0.6, 2.8], C.MAW);
      teeth(M, [hx + 0.6, hy - 0.4, -2.6], [hx + 3, hy - 0.4, 0], 4, 1, 0.6);
      teeth(M, [hx + 3, hy - 0.4, 0], [hx + 0.6, hy - 0.4, 2.6], 4, 1, 0.6);
      teeth(M, [hx + 0.8, hy - 1.4 - gape, -2.2], [hx + 2.8, hy - 1.4 - gape, 2.2], 5, -1, 0.5);
    },
  },

  /** 해골 쇠똥구리 — a scarab that rolls a skull instead of dung, lays in it, and dives into the sand with it. */
  dunescarab: {
    size: "m", k: 1.1,
    draw(M, p) {
      const [lf, lu] = lunge(p, 0.8);
      const u = 3 + lu * 0.6 + bob(p, 0.3) - (p.dead || 0) * 1.6;
      both((s) => {
        for (const [f, off] of [[2.4, 0], [0, 0.5], [-2.4, 0]]) {
          const [sw, up] = gait(p, off + (s > 0 ? 0.5 : 0));
          const foot = [lf + f + sw * 1.4, up * 0.8, s * 5.2];
          M.tube([[lf + f, u, s * 2.4], [lf + f + 0.4, u + 1.4, s * 4.2], foot], [0.55, 0.45, 0.3], SCAR);
        }
      });
      M.G("shell");
      M.e([lf - 1, u + 1.6, 0], [4.8, 2.8, 3.8], SCAR);
      M.G();
      M.tube([[lf + 3.4, u + 3.8, 0], [lf - 5.4, u + 3, 0]], 0.25, SCARG);   // the seam between the wing cases
      both((s) => M.tube([[lf + 3, u + 3, s * 1.6], [lf - 3.6, u + 3, s * 2.6]], 0.3, SCARG));
      // its head and horned scoop, and the skull it pushes (rolling as it walks)
      const hx = lf + 4.4;
      M.e([hx, u + 1, 0], [1.6, 1.3, 2.2], SCAR);
      both((s) => M.eye([hx + 0.8, u + 1.4, s * 1.5], 1, "#ff4020"));
      M.cone([hx + 1, u + 2, 0], [hx + 2.4, u + 4.2, 0], 0.7, SCARG);
      const roll = p.walk ? p.ph * Math.PI * 2 : 0, sx = hx + 4.2 + (p.strike ? 1.4 : 0), sy = 3.2;
      M.G("skull");
      M.s([sx, sy, 0], 3.2, C.BONE);
      M.G();
      const fx = Math.cos(roll), fy = Math.sin(roll) * 0.6;
      both((s) => M.e([sx + 2 * fx, sy + 0.6 + fy * 2, s * 1.2], [0.7, 0.9, 0.8], C.MAW));
      M.e([sx + 2.6 * fx, sy - 1.6 + fy, 0], [0.6, 0.4, 1.4], C.MAW);
    },
  },

  /** 서리숨 바다코끼리 — a walrus whose tusks froze and cracked; the cold breathes out between them. */
  rimewalrus: {
    size: "l", k: 1.08,
    draw(M, p) {
      const [lf, lu] = lunge(p, 1.2);
      const heave = p.walk ? Math.sin(p.ph * Math.PI * 2) * 0.8 : 0, u = 5.4 + lu + heave * 0.5 + bob(p, 0.3) - (p.dead || 0) * 2.4;
      // the bulk drags itself on fore-flippers; the tail flippers fan behind
      both((s) => {
        const [sw, up] = gait(p, s > 0 ? 0.5 : 0);
        M.tube([[lf + 3, u - 1, s * 4.6], [lf + 4.6 + sw * 1.4, up * 0.8 + 0.6, s * 7]], [1.6, 1.1], WALD);
        M.e([lf + 5.4 + sw * 1.4, 0.5 + up * 0.6, s * 7.4], [2, 0.5, 1.4], WALD);
        M.e([lf - 10.4, 0.8, s * 2.6], [2.2, 0.5, 1.8], WALD, [s * 20, 0, 0]);
      });
      M.G("body");
      M.e([lf - 2.4, u, 0], [8.4, 5, 6], WAL);
      M.e([lf - 7.8, u - 2.2, 0], [4.2, 3, 4], WALD);
      M.G();
      for (const [f, s] of [[-4, 3.2], [-1, -4], [1.2, 3.6], [-6, -2.4]]) M.e([lf + f, u + 3.6, s], [1.2, 0.5, 1], ICEC);   // frost crusted on its back
      // the head: a whiskered muzzle and the tusks, cracked ice glowing at the breaks
      const hx = lf + 6.2, hy = u + 2 - (p.wind ? 0.8 : 0) + (p.strike ? 0.6 : 0);
      M.e([hx, hy, 0], [3.6, 3.2, 3.6], WAL);
      M.e([hx + 2.6, hy - 0.8, 0], [1.8, 1.6, 3], WALD);
      both((s) => {
        M.eye([hx + 1.4, hy + 1.8, s * 2.2], 1, "#7ae0f0");
        for (const w of [-0.6, 0.4]) M.tube([[hx + 3.6, hy - 0.6 + w, s * 1.6], [hx + 5, hy - 1 + w * 1.4, s * 3]], 0.18, ICEC);
        const root = [hx + 3, hy - 1.6, s * 1.2], mid = [hx + 3.6, hy - 4, s * 1.4], tip = [hx + 3.2, 0.6, s * 1.2];
        M.tube([root, mid], [0.9, 0.7], ICE); M.tube([mid, tip], [0.6, 0.3], ICEC);
      });
      if (p.wind || p.strike) M.e([hx + 4.6, hy - 1.6, 0], [1.4, 1, 1.6], ICEC);   // the breath gathering
    },
  },
};
