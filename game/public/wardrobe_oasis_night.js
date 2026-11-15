/**
 * Draft module for Batch 1: 모래바람 오아시스 야간 관측반 (Sandwind Oasis Night Observation Squad)
 *
 * Dependencies & Integration Locations:
 *   1. `game/src/logic/65-cosmetics.js`
 *      - Append `OASIS_NIGHT_COSMETICS` (wire codes 117..120) to `COSMETICS`.
 *      - Add `OASIS_NIGHT_SET` (`oasis_night: "모래바람 야간 관측반"`) to `COSMETIC_SETS`.
 *      - Run `npm run build:logic` to regenerate `game/src/logic.js`.
 *   2. `game/public/wardrobe.js` (when the 64×64 character renderer `SZ = 64` with 0.5 logical coordinates is active)
 *      - Merge `OASIS_NIGHT_PALETTE` into palette constants.
 *      - Merge `OASIS_NIGHT_HAT`, `OASIS_NIGHT_TOP`, `OASIS_NIGHT_BACK`, `OASIS_NIGHT_BACK_FRONT`,
 *        `OASIS_NIGHT_FACE`, and `OASIS_NIGHT_ART` into `HAT`, `TOP`, `BACK`, `BACK_FRONT`, `FACE`, and `ART`.
 *   3. `game/public/art.js` / `asset/generated/oasis-night/`
 *      - `OASIS_NIGHT_ICONS` provides the 16×16 bag icon templates (also exported as normalized PNGs in `asset/generated/oasis-night/`).
 */

export const OASIS_NIGHT_SET = {
  oasis_night: "모래바람 야간 관측반",
};

export const OASIS_NIGHT_COSMETICS = [
  { id: "hat_oasis_veilcap",    code: 117, slot: "hat",  name: "사막별 차양모",       set: "oasis_night", shop: 4 },
  { id: "top_oasis_tabard",     code: 118, slot: "top",  name: "야간 관측반 외투",    set: "oasis_night", shop: 4 },
  { id: "back_oasis_astrolabe", code: 119, slot: "back", name: "황동 혼천의 등짐",    set: "oasis_night", shop: 5, boss: true },
  { id: "face_oasis_slitglass", code: 120, slot: "face", name: "모래바람 차광경",     set: "oasis_night", shop: 3 },
];

export const OASIS_NIGHT_PALETTE = {
  // Deep Oasis Night Indigo (짙은 남색)
  indigo:     "#1e2b4f",
  indigoHi:   "#324878",
  indigoSh:   "#121930",
  // Sun-bleached Linen / Sand Cloth (바랜 천)
  linen:      "#e6d8bc",
  linenSh:    "#b8a484",
  // Desert Brass / Astrolabe Bronze (사막의 금속)
  brass:      "#d8a848",
  brassSh:    "#9e6e24",
  starGlint:  "#f6dc88",
  // Oasis Star-glass (청록 별유리)
  cyanGlass:  "#68d8d8",
  cyanGlint:  "#dffafa",
  // Outlines
  ink:        "#2b2233",
  iconInk:    "#111118",
};

const P = OASIS_NIGHT_PALETTE;
const sway = (A) => (A.f === 2 ? 1 : A.f === 4 ? -1 : 0);

// ───────────────────── 1. HAT (64×64 / 0.5 logical coordinates) ─────────────────────
// Uses wardrobe.js two-pass hat structure (`draw` before ear restoration, `over` after ear restoration).
export const OASIS_NIGHT_HAT = {
  oasis_veilcap: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      // Flat-topped deep indigo astronomer's kepi crown sitting cleanly at T-2..T-0.5
      b.cr(T - 2.0, W - 2, 0.5, p.indigoHi);
      b.cr(T - 1.5, W,     1.0, p.indigo);
      b.r(A.x0 + 1, T - 1.5, 2.0, 0.5, p.indigoHi);
      b.r(A.x1 - 1.5, T - 1.5, 1.5, 1.0, p.indigoSh);
      // Desert-brass meridian band & crescent astrolabe dial on the brow
      b.cr(T - 0.5, W, 0.5, p.brassSh);
      if (!A.back) {
        const dx = A.side ? 1.5 : 0;
        b.cr(T - 1.0, 2.5, 1.0, p.brass, dx);
        b.cr(T - 1.0, 1.0, 0.5, p.starGlint, dx);
      } else {
        b.cr(T - 1.0, 2.0, 0.5, p.brass);
      }
    },
    over(b, A, p = P) {
      const T = A.top, W = A.x1 - A.x0 + 1;
      if (A.side) {
        // Forward indigo sun-visor peak + rear sun-bleached linen neck-veil draped behind cheek/ear
        b.r(A.x0 + 1, T, W + 1.5, 0.5, p.indigoSh);
        b.r(A.x0 - 1.5, T, 2.5, 3.0, p.linen);
        b.r(A.x0 - 1.5, T, 0.5, 3.0, p.linenSh);
        b.r(A.x0 - 1.0, T + 2.5, 2.0, 0.5, p.linenSh);
        b.r(A.x0, T + 1.0, 0.5, 0.5, p.brass);
        return;
      }
      if (A.back) {
        // Split bleached-linen desert neck-veil hanging along the left/right nape so the central astrolabe pack stays clear
        b.cr(T, W + 1, 0.5, p.linen);
        b.cr(T + 0.5, W + 1, 0.5, p.linenSh);
        b.r(A.x0 - 0.5, T + 0.5, 2.0, 2.5, p.linen);
        b.r(A.x1 - 0.5, T + 0.5, 2.0, 2.5, p.linen);
        b.r(A.x0 - 0.5, T + 2.5, 2.0, 0.5, p.linenSh);
        b.r(A.x1 - 0.5, T + 2.5, 2.0, 0.5, p.linenSh);
        b.r(b.c0 - 0.5, T, 1.0, 0.5, p.brass);
        return;
      }
      // Front view: crisp indigo visor line at T, bleached-linen side drapes framing the outer temples
      b.cr(T, W + 1, 0.5, p.indigoSh);
      b.r(A.x0 - 0.5, T + 0.5, 1.0, 2.5, p.linen);
      b.r(A.x1 + 0.5, T + 0.5, 1.0, 2.5, p.linen);
      b.r(A.x0 - 0.5, T + 2.5, 1.0, 0.5, p.linenSh);
      b.r(A.x1 + 0.5, T + 2.5, 1.0, 0.5, p.linenSh);
      b.r(A.x0, T + 0.5, 0.5, 0.5, p.brass);
      b.r(A.x1 + 0.5, T + 0.5, 0.5, 0.5, p.brass);
    },
  },
};

// ───────────────────── 2. TOP (64×64 / 0.5 logical coordinates) ─────────────────────
// Anchored to `A.bt .. A.foot` (columns 12.5..19.5) matching `wardrobe.js` torso bounds.
export const OASIS_NIGHT_TOP = {
  oasis_tabard(b, A, p = P) {
    const y0 = A.bt, h = A.foot - y0;
    // Deep indigo observation coat base
    b.r(12.5, y0, 7.0, h, p.indigo);
    b.r(17.5, y0, 2.0, h, p.indigoSh);
    b.r(12.5, y0 + h - 0.5, 7.0, 0.5, p.indigoSh);
    if (A.back) {
      // Bleached-linen upper shoulder yoke + brass meridian spine line
      b.r(12.5, y0, 7.0, 1.0, p.linen);
      b.r(12.5, y0 + 1.0, 7.0, 0.5, p.linenSh);
      b.r(15.5, y0 + 1.0, 1.0, h - 1.0, p.brassSh);
      b.r(15.5, y0 + 1.5, 0.5, 0.5, p.starGlint);
      return;
    }
    if (A.side) {
      // Side profile: bleached-linen sand-stole across shoulder + brass waist belt & cyan plumb weight
      b.r(13.0, y0, 4.5, 1.0, p.linen);
      b.r(14.0, y0 + 1.0, 2.5, h - 1.5, p.linen);
      b.r(16.0, y0 + 1.0, 0.5, h - 1.5, p.linenSh);
      b.r(12.5, y0 + 1.5, 7.0, 0.5, p.brassSh);
      b.r(16.5, y0 + 1.0, 1.0, 1.0, p.brass);
      b.r(16.5, y0 + 1.0, 0.5, 0.5, p.starGlint);
      b.r(16.5, y0 + 2.0, 0.5, 0.5, p.cyanGlass);
      return;
    }
    // Front view: asymmetrical sun-bleached linen sand-stole on left chest + brass meridian ring clasp
    b.r(12.5, y0, 3.0, h - 0.5, p.linen);
    b.r(15.0, y0 + 0.5, 1.5, 1.5, p.linen);
    b.r(15.5, y0 + 0.5, 0.5, h - 1.0, p.linenSh);
    b.r(12.5, y0 + h - 1.0, 3.0, 0.5, p.linenSh);
    // Waist belt & brass astrolabe ring buckle
    b.r(12.5, y0 + 1.5, 7.0, 0.5, p.brassSh);
    b.r(15.5, y0 + 1.0, 1.5, 1.5, p.brass);
    b.r(16.0, y0 + 1.5, 0.5, 0.5, p.indigoSh);
    b.r(15.5, y0 + 1.0, 0.5, 0.5, p.starGlint);
    // Cyan star-glass plumb bob below buckle
    b.r(16.0, y0 + 2.5, 0.5, 0.5, p.cyanGlass);
  },
};

// ───────────────────── 3. BACK & BACK_FRONT (64×64 / 0.5 logical coordinates) ─────────────────────
// Sits on the torso (`y0 = A.bt`), leaving the head (`y < A.bt`) and lower tail clear.
export const OASIS_NIGHT_BACK = {
  oasis_astrolabe(b, A, p = P) {
    const y0 = A.bt;
    const sw = sway(A) * 0.5;
    if (A.side) {
      // Side profile: rolled bleached-linen star-chart tube + brass armillary sphere behind the back
      b.r(10.5, y0 - 0.5, 2.5, 1.0, p.linen);
      b.r(10.5, y0 + 0.5, 2.5, 0.5, p.linenSh);
      b.r(10.0, y0 + 1.0, 2.5, 2.5, p.brass);
      b.r(10.5, y0 + 1.5, 1.5, 1.5, p.indigoSh);
      b.r(11.0, y0 + 2.0, 0.5, 0.5, p.cyanGlint);
      return;
    }
    if (A.front) {
      // Front silhouette peek: rolled linen chart tube end on right shoulder & brass finial on left shoulder
      b.r(19.0, y0 - 0.5 + sw, 2.0, 1.5, p.linen);
      b.r(19.0, y0 + 0.5 + sw, 2.0, 0.5, p.linenSh);
      b.r(11.0, y0 - sw, 1.5, 2.0, p.brass);
      b.r(11.0, y0 - sw, 0.5, 0.5, p.starGlint);
      return;
    }
    // Back view: compact high-mounted astrolabe pack on torso (y0 .. y0+3.5)
    // Rolled sun-bleached linen star-chart cylinder strapped across the top shoulders
    b.r(11.5, y0 - 0.5, 9.0, 1.5, p.linen);
    b.r(11.5, y0 + 0.5, 9.0, 0.5, p.linenSh);
    b.r(13.0, y0 - 0.5, 0.5, 1.5, p.brassSh);
    b.r(18.5, y0 - 0.5, 0.5, 1.5, p.brassSh);
    // Deep-indigo dust cloth backing
    b.r(12.5, y0 + 1.0, 7.0, 2.5, p.indigo);
    b.r(12.5, y0 + 3.0, 7.0, 0.5, p.indigoSh);
    // Desert-brass armillary sphere (interlocking rings + cyan star core)
    b.r(13.5, y0 + 0.5, 5.0, 3.0, p.brass);
    b.r(14.5, y0 + 1.0, 3.0, 2.0, p.indigoSh);
    b.r(14.0, y0 + 1.5, 4.0, 0.5, p.brassSh);
    b.r(15.5, y0 + 0.5, 1.0, 3.0, p.brass);
    b.r(15.5, y0 + 1.5, 1.0, 1.0, p.cyanGlass);
    b.r(15.5, y0 + 1.5, 0.5, 0.5, p.cyanGlint);
    b.r(14.0, y0 + 0.5, 0.5, 0.5, p.starGlint);
  },
};

export const OASIS_NIGHT_BACK_FRONT = {
  oasis_astrolabe(b, A, p = P) {
    const y0 = A.bt;
    if (A.side) {
      b.r(14.0, y0, 1.0, 1.5, p.linenSh);
      b.r(14.0, y0 + 0.5, 0.5, 0.5, p.brass);
      return;
    }
    // Two slim bleached-linen shoulder straps with brass pins on the front shoulders
    b.r(12.5, y0, 1.0, 1.5, p.linenSh);
    b.r(18.5, y0, 1.0, 1.5, p.linenSh);
    b.r(12.5, y0 + 0.5, 0.5, 0.5, p.brass);
    b.r(19.0, y0 + 0.5, 0.5, 0.5, p.brass);
  },
};

// ───────────────────── 4. FACE (64×64 / 0.5 logical coordinates) ─────────────────────
// Uses `covers: false` so `guardEyes` keeps the character's eye pixels 100% intact.
export const OASIS_NIGHT_FACE = {
  oasis_slitglass: {
    covers: false,
    draw(b, A, p = P) {
      if (A.back) return;
      const y = A.eye, lx = A.lx, rx = A.rx;
      if (A.side) {
        // Side profile: indigo temple wind-blinder + upper/lower brass sand-shield rims + cyan corner glint
        b.r(rx - 2.0, y - 0.5, 1.0, 2.0, p.indigo);
        b.r(rx - 1.0, y - 1.0, 2.5, 0.5, p.brass);
        b.r(rx - 1.0, y + 1.0, 2.5, 0.5, p.brassSh);
        b.r(rx + 1.0, y - 0.5, 0.5, 1.5, p.cyanGlass);
        b.r(rx + 1.0, y - 1.0, 0.5, 0.5, p.cyanGlint);
        return;
      }
      // Front view: dark indigo temple wind-blinders at outer edges
      b.r(lx - 1.5, y - 0.5, 0.5, 2.0, p.indigo);
      b.r(rx + 2.0, y - 0.5, 0.5, 2.0, p.indigo);
      // Upper and lower desert-brass sand-shield rims framing the eyes without touching the pupils
      b.r(lx - 1.0, y - 1.0, 3.0, 0.5, p.brass);
      b.r(rx - 1.0, y - 1.0, 3.0, 0.5, p.brass);
      b.r(lx - 1.0, y + 1.0, 3.0, 0.5, p.brassSh);
      b.r(rx - 1.0, y + 1.0, 3.0, 0.5, p.brassSh);
      // Cyan star-glass outer brackets + single 1-dot glint on outer top corner
      b.r(lx - 1.0, y - 0.5, 0.5, 1.5, p.cyanGlass);
      b.r(rx + 1.5, y - 0.5, 0.5, 1.5, p.cyanGlass);
      b.r(lx - 1.0, y - 1.0, 0.5, 0.5, p.cyanGlint);
      b.r(rx + 1.5, y - 1.0, 0.5, 0.5, p.cyanGlint);
      // Brass nose bridge
      b.r(lx + 2.0, y, rx - lx - 3.0, 0.5, p.brass);
    },
  },
};

export const OASIS_NIGHT_ART = {
  hat_oasis_veilcap:    ["hat",  "oasis_veilcap",    P],
  top_oasis_tabard:     ["top",  "oasis_tabard",     P],
  back_oasis_astrolabe: ["back", "oasis_astrolabe",  P],
  face_oasis_slitglass: ["face", "oasis_slitglass",  P],
};

// ───────────────────── 5. 16×16 BAG ICON TEMPLATES ─────────────────────
export const OASIS_NIGHT_ICONS = {
  hat_oasis_veilcap: {
    palette: {
      i: P.indigo, h: P.indigoHi, d: P.indigoSh,
      l: P.linen,  s: P.linenSh,
      b: P.brass,  g: P.starGlint,
    },
    rows: [
      "....hhhhhh....",
      "...hiiiiiiid..",
      "...iiiggiiid..",
      "..bbbbbbbbbbd.",
      ".dddddddddddd.",
      "..ll......lls.",
      "..ll......lls.",
      ".llls....sllls",
      ".llls....sllls",
      ".llss....sslls",
      "..ss......ss..",
      "..............",
      "..............",
      "..............",
    ],
  },
  top_oasis_tabard: {
    palette: {
      i: P.indigo, h: P.indigoHi, d: P.indigoSh,
      l: P.linen,  s: P.linenSh,
      b: P.brass,  a: P.brassSh, g: P.starGlint, c: P.cyanGlass,
    },
    rows: [
      "..lll....hhh..",
      ".lllli..hiiiid",
      ".lllli..iiiiid",
      "..lllsliiiii..",
      "..lllslliiii..",
      "..llssllbgii..",
      "..aaaaaaaaaa..",
      "..llshibciii..",
      "..llshiiiiii..",
      "..llshiiiiii..",
      "..ssdddddddd..",
      "..............",
      "..............",
      "..............",
    ],
  },
  back_oasis_astrolabe: {
    palette: {
      i: P.indigo, d: P.indigoSh,
      l: P.linen,  s: P.linenSh,
      b: P.brass,  a: P.brassSh, g: P.starGlint, c: P.cyanGlass, w: P.cyanGlint,
    },
    rows: [
      "........llll..",
      ".......llllls.",
      "....bbbblllls.",
      "..bbiiiibbss..",
      ".biiabbaiib...",
      ".biabwcbaib...",
      ".biabccbaib...",
      ".biiabbaiib...",
      "..bbiiiibb....",
      "...dbbbbbd....",
      "..ddiiiiidd...",
      "...ddddddd....",
      "..............",
      "..............",
    ],
  },
  face_oasis_slitglass: {
    palette: {
      i: P.indigo, d: P.indigoSh,
      b: P.brass,  a: P.brassSh,
      c: P.cyanGlass, w: P.cyanGlint,
    },
    rows: [
      "..............",
      "..............",
      "..............",
      ".ii.wbbbb..wbb",
      "iiicb...bb.b..",
      "iiic.bbb.bbb.c",
      "iiicb...b..b.c",
      ".dd.aaaa...aaa",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
    ],
  },
};
