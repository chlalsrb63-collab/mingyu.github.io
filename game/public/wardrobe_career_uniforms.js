/**
 * Draft module for Career Uniforms Collection (직업 제복 코스튬 4세트 · 8종)
 * Four distinct occupation uniform sets (hat + top pairs):
 *   1. 경찰 (Police Officer)     : 경찰 정모 + 경찰 제복 (딥 네이비 · 아이스블루 셔츠 · 금장 방패 배지 · 듀티 벨트)
 *   2. 간호사 (Hospital Nurse)   : 간호사 캡 + 간호사 가운 (순백 · 파스텔 민트 · 적십자 마크 · 은색 청진기)
 *   3. 소방관 (Firefighter)      : 소방 헬멧 + 소방 방화복 (크림슨 헬멧 · 황금오커 방화복 · 형광라임/실버 이중 반사띠)
 *   4. 항공 기장 (Airline Pilot) : 기장 정모 + 기장 제복 (백색 탑 정모 · 챠콜 더블블레이저 · 금장 윙 배지 · 견장/소매 줄무늬)
 *
 * Native 64×64 (`0.5` logical coordinate grid), anchor-driven (`anchors()` in `wardrobe.js`),
 * never modifying `game/src/logic/**` or `game/public/wardrobe.js`.
 *
 * Integration Locations:
 *   1. `game/src/logic/65-cosmetics.js`
 *      - Add `career: "직업 제복"` in `COSMETIC_SETS`.
 *      - Append `CAREER_COSMETICS` (recommended wire codes 131..138, or next free codes) to `COSMETICS`.
 *      - Run `npm run build:logic`.
 *   2. `game/public/wardrobe.js`
 *      - Merge `CAREER_HAT` entries into `HAT` and `CAREER_TOP` entries into `TOP` (wearable directly or wrapped via `topFn`).
 *      - Merge `CAREER_ART` entries into `ART`.
 *   3. `game/public/art.js` / `asset/generated/career-uniforms/`
 *      - `CAREER_ICONS` holds 16×16 bag icon templates matching the normalized PNGs.
 */

export const CAREER_COSMETICS = [
  { id: "hat_career_police", code: 131, slot: "hat", name: "경찰 정모",   set: "career", shop: 5 },
  { id: "top_career_police", code: 132, slot: "top", name: "경찰 제복",   set: "career", shop: 5 },
  { id: "hat_career_nurse",  code: 133, slot: "hat", name: "간호사 캡",   set: "career", shop: 5 },
  { id: "top_career_nurse",  code: 134, slot: "top", name: "간호사 가운", set: "career", shop: 5 },
  { id: "hat_career_fire",   code: 135, slot: "hat", name: "소방 헬멧",   set: "career", shop: 6 },
  { id: "top_career_fire",   code: 136, slot: "top", name: "소방 방화복", set: "career", shop: 6 },
  { id: "hat_career_pilot",  code: 137, slot: "hat", name: "기장 정모",   set: "career", shop: 6 },
  { id: "top_career_pilot",  code: 138, slot: "top", name: "기장 제복",   set: "career", shop: 6 },
];

export const CAREER_PALETTE = {
  // 1) Police Navy & Patrol Blue
  polNavy:    "#2d4778",
  polNavyHi:  "#4c70ad",
  polNavySh:  "#1d2c4f",
  polShirt:   "#8fc4eb",
  polShirtHi: "#bee3fa",
  polVisor:   "#242836",
  polVisorHi: "#515b75",

  // 2) Nurse Crisp White & Soft Medical Mint
  white:      "#f5f7fc",
  whiteHi:    "#ffffff",
  whiteSh:    "#c2cde0",
  mint:       "#64c7b5",
  mintHi:     "#9ae8d9",
  mintSh:     "#3b8f85",
  crossRed:   "#e83b48",
  crossSh:    "#a11d2a",

  // 3) Firefighter Crimson Helmet & Ochre Turnout + High-Vis Lime/Silver
  fireRed:    "#d93829",
  fireRedHi:  "#ff6e59",
  fireRedSh:  "#8c1c16",
  ochre:      "#d99626",
  ochreHi:    "#f7c55c",
  ochreSh:    "#945f12",
  hiVis:      "#ccf53b",
  hiVisSh:    "#8cb81a",
  flapDark:   "#343947",
  flapSh:     "#1f222c",

  // 4) Airline Pilot Charcoal Black & Aviator Crimson/Gold
  pilotBlk:   "#2d3242",
  pilotBlkHi: "#4b536b",
  pilotBlkSh: "#1a1d26",
  aviRed:     "#a62d3d",
  aviRedHi:   "#d44c5c",
  aviGlass:   "#5896b5",

  // Shared Metals
  gold:       "#f5c542",
  goldHi:     "#fff099",
  goldSh:     "#ad7c18",
  silver:     "#dce4f2",
  silverSh:   "#8a98b0",
  steth:      "#687c9c",
  stethSh:    "#44526b",
  ink:        "#2b2233",
};

const P = CAREER_PALETTE;
const stepSwing = (A) => (A.f === 2 ? 0.5 : A.f === 4 ? -0.5 : 0);

// ───────────────────────────── 1. HATS (64×64 / 0.5 logical coordinates) ─────────────────────────────

export const CAREER_HAT = {
  /**
   * 1) 경찰 정모 (Peaked Police Officer Cap)
   * Tall navy flared crown + crisp white cap band + centered gold shield emblem + glossy dark visor.
   * Uses `ears: "through"` so rabbit ears and antlers poke cleanly out from the crown sides.
   */
  police: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const crownW = A.bumps ? 8.5 : W + 2;
      const bandW = A.bumps ? 7.5 : W;
      // Flared upper peak
      b.cr(T - 4.0, Math.max(6, crownW - 2), 0.5, p.polNavyHi);
      b.cr(T - 3.5, crownW, 1.5, p.polNavy);
      // Warm left highlight & cool right shadow on crown
      b.r(A.cx - crownW / 2 + 0.5, T - 3.5, 2.5, 1.0, p.polNavyHi);
      b.r(A.cx + crownW / 2 - 2.5, T - 3.0, 2.5, 1.5, p.polNavySh);
      // Crisp white cap band around head top
      b.cr(T - 2.0, bandW, 1.5, p.white);
      b.r(A.cx + bandW / 2 - 2.0, T - 2.0, 2.0, 1.5, p.whiteSh);
      // Seated dark rim touching forehead (stays above frog eye bumps on back/top edge)
      b.cr(T - 0.5, bandW, 0.5, p.polNavySh);
      // Back view brass adjuster buckle on rear band
      if (A.back) {
        b.r(A.cx - 1.0, T - 1.5, 2.0, 1.0, p.polVisor);
        b.r(A.cx - 0.5, T - 1.5, 1.0, 0.5, p.gold);
      }
    },
    over(b, A, p = P) {
      const T = A.top;
      if (A.back) return;
      // Centered gold police shield badge sitting over white band + lower crown
      const badgeX = A.side ? A.cx - 1.5 : A.cx - 1.0;
      b.r(badgeX, T - 3.0, 2.0, 1.5, p.gold);
      b.r(badgeX + 0.5, T - 3.0, 1.0, 0.5, p.goldHi);
      b.r(badgeX + 0.5, T - 2.0, 1.0, 0.5, p.goldSh);
      // Glossy dark visor bill (kept within eye gap / above A.eye; safe for FROG eye bumps)
      const vw = A.bumps ? 5 : A.side ? 6.5 : 7;
      const vx = A.side ? A.cx - vw / 2 - 1.0 : A.cx - vw / 2;
      b.r(vx, T - 0.5, vw, 1.0, p.polVisor);
      b.r(vx + 1.0, T - 0.5, vw - 2.5, 0.5, p.polVisorHi);
      b.r(vx + 0.5, T + 0.5, vw - 1.0, 0.5, p.ink);
    },
  },

  /**
   * 2) 간호사 캡 (Starched Winged Nurse Cap)
   * Crisp white folded geometric cap seated centrally between ears/horns, mint lower trim, crimson cross.
   */
  nurse: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const capW = A.bumps ? 6.5 : A.side ? 7.5 : 8.5;
      const x0 = Math.round((A.cx - capW / 2) * 2) / 2;
      // Winged folded peak tapering slightly upward
      b.r(x0 + 1.0, T - 3.5, capW - 2.0, 0.5, p.whiteHi);
      b.r(x0 + 0.5, T - 3.0, capW - 1.0, 1.0, p.white);
      b.r(x0,       T - 2.0, capW,       1.5, p.white);
      // Wing-fold shadow creases along outer corners
      b.r(x0,              T - 2.0, 1.0, 1.5, p.whiteSh);
      b.r(x0 + capW - 1.0, T - 2.0, 1.0, 1.5, p.whiteSh);
      // Mint headband trim at base
      b.r(x0 + 0.5, T - 0.5, capW - 1.0, 0.5, p.mint);
      if (A.back) {
        // Back pleat + hairpins / mint strap
        b.r(A.cx - 1.5, T - 2.5, 3.0, 1.5, p.whiteSh);
        b.r(A.cx - 2.0, T - 0.5, 4.0, 0.5, p.mintSh);
      }
    },
    over(b, A, p = P) {
      if (A.back) return;
      const T = A.top;
      const cx = A.side ? A.cx - 0.5 : A.cx;
      // Crisp 2.5×2.5 crimson medical cross emblem
      b.r(cx - 0.5, T - 3.0, 1.0, 2.0, p.crossRed);
      b.r(cx - 1.0, T - 2.5, 2.0, 1.0, p.crossRed);
      b.r(cx,       T - 1.5, 0.5, 0.5, p.crossSh);
    },
  },

  /**
   * 3) 소방 헬멧 (Firefighter Rescue Helmet with Rear Neck Flap & Brass Shield)
   * Wide flared crimson dome with top crest ridge, brass front plate, and charcoal heat-shield neck cape.
   * Uses `ears: "behind"` so the protective shell encloses ears neatly while preserving frog eye bumps.
   */
  fire: {
    ears: "behind",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      // Raised top ridge crest
      b.cr(T - 4.5, 3.0, 1.0, p.fireRedHi);
      b.cr(T - 4.0, 4.0, 0.5, p.fireRed);
      // Rounded helmet shell
      b.cr(T - 3.5, Math.max(6, W - 2), 1.0, p.fireRedHi);
      b.cr(T - 2.5, W, 1.5, p.fireRed);
      b.r(A.cx + W / 2 - 2.5, T - 2.5, 2.5, 1.5, p.fireRedSh);
      // Wide signature swept brim & rear/side heat-resistant charcoal neck flap
      if (A.back) {
        b.cr(T - 1.0, W + 4, 1.0, p.fireRedSh);
        b.cr(T,       W + 4, 1.0, p.fireRed);
        // Dark Nomex neck protector drape down nape
        // (kept above the nose row so short heads never get it over the muzzle)
        if (T + 1.0 < A.ny) b.cr(T + 1.0, W + 1, Math.min(1.5, A.ny - T - 1.0), p.flapDark);
        if (T + 3.0 < A.ny) b.cr(T + 2.5, W - 1, 0.5, p.flapSh);
        // Hi-vis reflective helmet sticker stripes on back
        b.r(A.cx - 2.5, T - 2.0, 1.0, 1.0, p.hiVis);
        b.r(A.cx + 1.5, T - 2.0, 1.0, 1.0, p.hiVis);
      } else {
        // Side / rear swept brim wing behind head
        b.cr(T - 1.0, W + 3, 1.0, p.fireRed);
        if (A.side) {
          b.r(A.x1 - 0.5, T, 2.5, 2.0, p.flapDark);
          b.r(A.x1 + 0.5, T, 2.0, 0.5, p.fireRedSh);
        }
      }
    },
    over(b, A, p = P) {
      if (A.back) return;
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const fx = A.side ? A.cx - 1.5 : A.cx - 1.0;
      // Front crimson brim edge (skipping outer frog bump columns when A.bumps)
      const brimW = A.bumps ? 5.0 : W + 2.0;
      b.cr(T - 0.5, brimW, 0.5, p.fireRed);
      // Gold Maltese-style front helmet shield + subtle yellow stripe
      b.r(fx - 0.5, T - 3.0, 3.0, 2.0, p.gold);
      b.r(fx,       T - 3.0, 1.5, 0.5, p.goldHi);
      b.r(fx + 0.5, T - 2.0, 1.5, 1.0, p.goldSh);
      // Compact tucked clear-amber visor rim above eye level
      b.r(fx - 1.0, T, 4.0, 0.5, p.ochreHi);
    },
  },

  /**
   * 4) 기장 정모 (Airline Captain Peaked Cap)
   * Snow-white flared crown + charcoal band with gold braid cord + spread-wing gold emblem + glossy visor.
   */
  pilot: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const crownW = A.bumps ? 8.5 : W + 2;
      const bandW = A.bumps ? 7.5 : W;
      // Flared crisp white captain crown (contrasts directly against police navy crown)
      b.cr(T - 4.0, Math.max(6, crownW - 2), 0.5, p.whiteHi);
      b.cr(T - 3.5, crownW, 1.5, p.white);
      b.r(A.cx + crownW / 2 - 2.5, T - 3.5, 2.5, 1.5, p.whiteSh);
      // Charcoal cap band + golden chin-cord ribbon
      b.cr(T - 2.0, bandW, 1.5, p.pilotBlk);
      b.cr(T - 1.0, bandW, 0.5, p.gold);
      b.cr(T - 0.5, bandW, 0.5, p.pilotBlkSh);
      if (A.back) {
        b.r(A.cx - 1.5, T - 1.5, 3.0, 0.5, p.goldSh);
      }
    },
    over(b, A, p = P) {
      if (A.back) return;
      const T = A.top;
      const cx = A.side ? A.cx - 0.5 : A.cx;
      // Spread-wing gold captain emblem (`w = 5` at 0.5px precision)
      b.r(cx - 2.5, T - 3.0, 5.0, 0.5, p.goldHi);
      b.r(cx - 1.5, T - 2.5, 3.0, 1.0, p.gold);
      b.r(cx - 0.5, T - 3.0, 1.0, 1.5, p.whiteHi);
      // Visor bill with subtle gold "scrambled egg" oak-leaf glints on edges
      const vw = A.bumps ? 5.0 : A.side ? 6.5 : 7.0;
      const vx = A.side ? A.cx - vw / 2 - 1.0 : A.cx - vw / 2;
      b.r(vx, T - 0.5, vw, 1.0, p.pilotBlk);
      b.r(vx + 0.5, T - 0.5, 1.5, 0.5, p.gold);
      b.r(vx + vw - 2.0, T - 0.5, 1.5, 0.5, p.gold);
      b.r(vx + 0.5, T + 0.5, vw - 1.0, 0.5, p.ink);
    },
  },
};

// ───────────────────────────── 2. TOPS (64×64 / 0.5 logical coordinates) ─────────────────────────────
// Body x occupies ~12.5..19.5 (torso center 13..18.5, arms on 12..13 & 18.5..19.5), y = A.bt..A.foot.

export const CAREER_TOP = {
  /**
   * 1) 경찰 제복 (Police Patrol Uniform)
   * Navy service tunic + light-blue V-collar + dark tie + shoulder epaulets + gold badge + duty belt.
   */
  policeUniform: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    // Main navy tunic covering torso (`12.5..19.5`)
    b.r(12.5, y0, 7.0, h, p.polNavy);
    b.r(12.5, y0, 2.0, h, p.polNavyHi);
    b.r(18.0, y0, 1.5, h, p.polNavySh);
    // Shoulder epaulets with tiny brass pips
    b.r(12.5, y0, 1.5, 0.5, p.polNavySh);
    b.r(18.0, y0, 1.5, 0.5, p.polNavySh);
    b.r(13.0, y0, 0.5, 0.5, p.gold);
    b.r(18.5, y0, 0.5, 0.5, p.gold);

    if (A.front) {
      // Ice-blue shirt V-neck + navy patrol tie
      b.r(14.5, y0, 3.0, 1.0, p.polShirt);
      b.r(15.0, y0, 2.0, 0.5, p.polShirtHi);
      b.r(15.5, y0 + 0.5, 1.0, Math.max(1.0, h - 1.5), p.polNavySh);
      // Left-chest gleaming gold shield badge + pocket flap
      b.r(16.5, y0 + 0.5, 1.5, 1.0, p.gold);
      b.r(17.0, y0 + 0.5, 0.5, 0.5, p.goldHi);
      // Black duty belt + silver square buckle at bottom row
      b.r(12.5, A.foot - 1.0, 7.0, 0.5, p.polVisor);
      b.r(15.5, A.foot - 1.0, 1.0, 0.5, p.silver);
    } else if (A.side) {
      // Asymmetrical collar + badge + side radio pouch on duty belt
      b.r(13.5, y0, 2.0, 1.0, p.polShirt);
      b.r(14.0, y0 + 0.5, 1.0, Math.max(1.0, h - 1.5), p.polNavySh);
      b.r(15.5, y0 + 0.5, 1.0, 1.0, p.gold);
      b.r(12.5, A.foot - 1.0, 7.0, 0.5, p.polVisor);
      b.r(17.5, A.foot - 1.5, 1.5, 1.0, p.polVisorHi); // radio/cuff case
    } else {
      // Back yoke + nape collar + rear belt & utility pouch
      b.r(14.5, y0 - 0.5, 3.0, 0.5, p.polNavySh);
      b.r(13.5, y0 + 0.5, 5.0, 0.5, p.polNavySh);
      b.r(12.5, A.foot - 1.0, 7.0, 0.5, p.polVisor);
      b.r(13.5, A.foot - 1.5, 1.5, 1.0, p.polVisorHi);
      b.r(17.0, A.foot - 1.5, 1.5, 1.0, p.polVisorHi);
    }
  },

  /**
   * 2) 간호사 가운 (Hospital Nurse Gown & Scrubs)
   * Crisp white flared tunic coat, pastel mint V-collar + hem piping, silver stethoscope, red cross tag.
   */
  nurseScrub: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    const sw = stepSwing(A);
    // Crisp white gown body
    b.r(12.5, y0, 7.0, h, p.white);
    b.r(12.5, y0, 1.5, h, p.whiteHi);
    b.r(18.0, y0, 1.5, h, p.whiteSh);
    // Flared apron-skirt hem (`F` row right at A.foot, animated subtly on walk)
    b.r(12.5 + sw * 0.5, A.foot, 7.0, 0.5, p.white);
    b.r(12.5 + sw * 0.5, A.foot, 7.0, 0.5, p.mint);
    b.r(17.5 + sw * 0.5, A.foot, 2.0, 0.5, p.mintSh);

    if (A.front) {
      // Soft mint V-collar + crisp mint pocket band
      b.r(14.0, y0, 4.0, 0.5, p.mint);
      b.r(15.0, y0 + 0.5, 2.0, 0.5, p.mintHi);
      // Draped high-contrast steel stethoscope around neck & chestpiece on left chest
      b.r(13.5, y0, 0.5, 1.5, p.steth);
      b.r(18.0, y0, 0.5, 1.0, p.steth);
      b.r(14.0, y0 + 1.5, 3.0, 0.5, p.steth);
      b.r(14.0, y0 + 2.0, 0.5, 0.5, p.stethSh); // chestpiece diaphragm
      // Right chest medical red cross badge
      b.r(16.5, y0 + 0.5, 1.5, 0.5, p.crossRed);
      b.r(17.0, y0,       0.5, 1.5, p.crossRed);
    } else if (A.side) {
      b.r(13.5, y0, 2.0, 1.0, p.mint);
      b.r(14.5, y0, 0.5, 1.5, p.silverSh);
      b.r(15.5, y0 + 1.0, 1.0, 0.5, p.crossRed);
      b.r(13.5, A.foot - 1.0, 5.0, 0.5, p.whiteSh);
    } else {
      // Clean back mint collar + waist tie bow
      b.r(14.5, y0 - 0.5, 3.0, 0.5, p.mint);
      b.r(13.5, y0 + 1.0, 5.0, 0.5, p.mint);
      b.r(15.0, A.foot - 1.0, 2.0, 1.0, p.mintSh);
    }
  },

  /**
   * 3) 소방 방화복 (Heavy Turnout Firefighter Coat)
   * Ochre-gold bunker coat (`12.0..20.0` slightly padded), high charcoal collar,
   * unmistakable double neon-lime + silver reflective safety bands & front silver clasps.
   */
  fireTurnout: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    // Padded bunker jacket (`x = 12..19.5`, wide sleeves)
    b.r(12.0, y0, 8.0, h, p.ochre);
    b.r(12.0, y0, 1.5, h, p.ochreHi);
    b.r(18.5, y0, 1.5, h, p.ochreSh);
    // High protective stand collar & dark reinforced cuffs
    b.r(14.0, y0 - 0.5, 4.0, 0.5, p.flapDark);
    b.r(12.0, A.foot - 0.5, 1.5, 0.5, p.flapDark);
    b.r(18.5, A.foot - 0.5, 1.5, 0.5, p.flapDark);
    // Signature horizontal neon-lime + silver high-visibility safety bands around waist & cuffs
    b.r(12.0, A.foot - 1.5, 8.0, 1.0, p.hiVis);
    b.r(12.0, A.foot - 1.0, 8.0, 0.5, p.silver);

    if (A.front) {
      // Vertical high-vis suspender / chest strap + storm placket + 2 silver turnout latches
      b.r(13.5, y0, 1.0, h - 1.5, p.hiVisSh);
      b.r(17.5, y0, 1.0, h - 1.5, p.hiVisSh);
      b.r(15.5, y0, 1.0, h, p.ochreSh);
      b.r(15.5, y0 + 0.5, 1.0, 0.5, p.silver);
      b.r(15.5, y0 + 1.5, 1.0, 0.5, p.silver);
    } else if (A.side) {
      b.r(14.5, y0, 1.0, h - 1.5, p.hiVis);
      b.r(15.5, y0 + 0.5, 1.5, 1.0, p.fireRed); // shoulder radio patch
    } else {
      // Vertical rear reflective straps + bright back "RESCUE" lime bar across shoulders
      b.r(13.5, y0 + 0.5, 5.0, 0.5, p.hiVis);
      b.r(13.5, y0 + 0.5, 1.0, h - 1.5, p.hiVisSh);
      b.r(17.5, y0 + 0.5, 1.0, h - 1.5, p.hiVisSh);
    }
  },

  /**
   * 4) 기장 제복 (Airline Captain Double-Breasted Blazer)
   * Crisp charcoal black blazer, white shirt & burgundy aviator tie, 4-stripe gold epaulets,
   * gold cuff rank stripes, double brass buttons, and wing crest badge.
   */
  pilotBlazer: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    // Tailored charcoal black blazer
    b.r(12.5, y0, 7.0, h, p.pilotBlk);
    b.r(12.5, y0, 1.5, h, p.pilotBlkHi);
    b.r(18.0, y0, 1.5, h, p.pilotBlkSh);
    // 4-stripe captain gold shoulder epaulets
    b.r(12.5, y0, 1.5, 0.5, p.gold);
    b.r(18.0, y0, 1.5, 0.5, p.gold);
    // Twin gold rank stripes at sleeve cuffs
    b.r(12.5, A.foot - 1.0, 1.5, 0.5, p.gold);
    b.r(12.5, A.foot - 0.5, 1.5, 0.5, p.goldSh);
    b.r(18.0, A.foot - 1.0, 1.5, 0.5, p.gold);
    b.r(18.0, A.foot - 0.5, 1.5, 0.5, p.goldSh);

    if (A.front) {
      // Crisp white dress shirt V-neck + crimson-burgundy tie
      b.r(14.5, y0, 3.0, 1.0, p.white);
      b.r(15.5, y0 + 0.5, 1.0, Math.max(1.0, h - 1.5), p.aviRed);
      // Double-breasted brass buttons
      b.r(14.5, y0 + 1.5, 0.5, 0.5, p.gold);
      b.r(17.0, y0 + 1.5, 0.5, 0.5, p.gold);
      if (h >= 3) {
        b.r(14.5, y0 + 2.5, 0.5, 0.5, p.goldSh);
        b.r(17.0, y0 + 2.5, 0.5, 0.5, p.goldSh);
      }
      // Spread-wing gold badge on chest
      b.r(16.5, y0 + 0.5, 2.0, 0.5, p.goldHi);
    } else if (A.side) {
      b.r(13.5, y0, 1.5, 1.0, p.white);
      b.r(14.0, y0 + 0.5, 0.5, 1.5, p.aviRed);
      b.r(15.5, y0 + 0.5, 1.5, 0.5, p.goldHi);
    } else {
      // Crisp back collar + center blazer vent shadow
      b.r(14.5, y0 - 0.5, 3.0, 0.5, p.whiteSh);
      b.r(15.5, A.foot - 1.5, 1.0, 1.5, p.pilotBlkSh);
    }
  },
};

// ───────────────────────────── 3. COSMETIC WEAR MAPPING ─────────────────────────────

export const CAREER_ART = {
  hat_career_police: ["hat", "police", CAREER_PALETTE],
  top_career_police: ["top", "policeUniform", CAREER_PALETTE],
  hat_career_nurse:  ["hat", "nurse", CAREER_PALETTE],
  top_career_nurse:  ["top", "nurseScrub", CAREER_PALETTE],
  hat_career_fire:   ["hat", "fire", CAREER_PALETTE],
  top_career_fire:   ["top", "fireTurnout", CAREER_PALETTE],
  hat_career_pilot:  ["hat", "pilot", CAREER_PALETTE],
  top_career_pilot:  ["top", "pilotBlazer", CAREER_PALETTE],
};

// ───────────────────────────── 4. 16×16 BAG ICONS ─────────────────────────────

export const CAREER_ICONS = {
  // 1) 경찰 정모 (16×16) — navy peaked cap, centered gold shield emblem, white band, glossy visor
  hat_career_police: {
    pal: {
      k: P.ink, n: P.polNavy, N: P.polNavyHi, d: P.polNavySh,
      w: P.white, s: P.whiteSh, g: P.gold, G: P.goldHi, v: P.polVisor, V: P.polVisorHi,
    },
    rows: [
      "................",
      "................",
      "....kkkkkkkk....",
      "..kkNNNNnnnnkk..",
      ".kNNnnngGgnnnnk.",
      ".kNnnnngGgnnndk.",
      ".kddddggGgddddk.",
      "..kwwwwddwwwwk..",
      "..kwwwwssssssk..",
      "..kkkkkkkkkkkk..",
      "...kvvVVVVvvvk..",
      "....kvvvvvvvk...",
      ".....kkkkkkk....",
      "................",
      "................",
      "................",
    ],
  },

  // 2) 경찰 제복 (16×16) — navy tunic, epaulets, ice-blue collar, tie, gold badge, duty belt
  top_career_police: {
    pal: {
      k: P.ink, n: P.polNavy, N: P.polNavyHi, d: P.polNavySh,
      b: P.polShirt, B: P.polShirtHi, g: P.gold, G: P.goldHi,
      v: P.polVisor, s: P.silver,
    },
    rows: [
      "................",
      "....kkk..kkk....",
      "..kkNnnBBnnNkk..",
      ".kNgnnBddBnnngk.",
      ".kNnnbbddbbnnnk.",
      ".kNNnnnddngGndk.",
      ".kNNnnnddnggndk.",
      ".kNnnnndddnnndk.",
      "..kknndddnnnkk..",
      "...knndddnndk...",
      "...kvvvssvvvk...",
      "...kddddddddk...",
      "...knnnnnnnnk...",
      "....kkkkkkkk....",
      "................",
      "................",
    ],
  },

  // 3) 간호사 캡 (16×16) — starched winged white nurse cap, symmetrical crisp red cross, mint trim
  hat_career_nurse: {
    pal: {
      k: P.ink, w: P.white, W: P.whiteHi, s: P.whiteSh,
      r: P.crossRed, R: P.crossSh, m: P.mint, M: P.mintSh,
    },
    rows: [
      "................",
      "................",
      ".....kkkkkk.....",
      "...kkWWWWWWkk...",
      "..kWWwwrrwwWWk..",
      ".kWWwwrrrrwwWsk.",
      ".kWwwwrRRrwwwsk.",
      ".kWwwwwrrwwwwsk.",
      ".kswwwwwwwwwssk.",
      "..kssssssssssk..",
      "..kmmmmmmmmMMk..",
      "...kkkkkkkkkk...",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 4) 간호사 가운 (16×16) — bright white medical tunic, mint collar/hem, draped stethoscope, crisp '+' cross
  top_career_nurse: {
    pal: {
      k: P.ink, w: P.white, W: P.whiteHi, s: P.whiteSh,
      m: P.mint, M: P.mintSh, r: P.crossRed, z: P.steth, Z: P.stethSh,
    },
    rows: [
      "................",
      "....kkk..kkk....",
      "..kkWmmwwmmWkk..",
      ".kWWzwwmmwwzWWk.",
      ".kWWzwwwwwrzzWk.",
      ".kWzzwwwwrrrzzk.",
      ".kWwZwwwwwrwwsk.",
      ".kWwwZZZwwwwwsk.",
      "..kkwwwwwwwwkk..",
      "...kwwwwwwwsk...",
      "...kwwwwwwwsk...",
      "...kmmmmmmmMk...",
      "...kwwwwwwwsk...",
      "....kkkkkkkk....",
      "................",
      "................",
    ],
  },

  // 5) 소방 헬멧 (16×16) — crimson domed helmet with top ridge, brass front shield & dark rear neck flap
  hat_career_fire: {
    pal: {
      k: P.ink, r: P.fireRed, R: P.fireRedHi, d: P.fireRedSh,
      g: P.gold, G: P.goldHi, f: P.flapDark, F: P.flapSh,
    },
    rows: [
      "................",
      "......kkkk......",
      "....kkRRRRkk....",
      "...kRRrrrrddk...",
      "..kRRrrggrrddk..",
      "..kRrrgGGgrddk..",
      "..krrrggggdddk..",
      ".kkddddddddddkk.",
      "kRRRRrrrrrrrrddk",
      ".kkkrrrrrrrrrdk.",
      "....kkkkkffffFk.",
      ".........kfffFk.",
      "..........kkkk..",
      "................",
      "................",
      "................",
    ],
  },

  // 6) 소방 방화복 (16×16) — ochre turnout coat, dark collar, twin neon-lime + silver reflective bands
  top_career_fire: {
    pal: {
      k: P.ink, o: P.ochre, O: P.ochreHi, d: P.ochreSh,
      h: P.hiVis, H: P.hiVisSh, s: P.silver, f: P.flapDark,
    },
    rows: [
      "................",
      "....kkkkkkkk....",
      "..kkOffffffOkk..",
      ".kOOohhddhhooOk.",
      ".kOOohhddhhoook.",
      ".kOoooHddHooook.",
      ".kOoooHddHooook.",
      ".khhhhhhhhhhddk.",
      "..kkssssssskkk..",
      "...khhhhhhhhk...",
      "...kssssssssk...",
      "...kddddddddk...",
      "...kffddddffk...",
      "....kkkkkkkk....",
      "................",
      "................",
    ],
  },

  // 7) 기장 정모 (16×16) — crisp white airline cap crown, charcoal band, gold cord & spread-wing badge
  hat_career_pilot: {
    pal: {
      k: P.ink, w: P.white, W: P.whiteHi, s: P.whiteSh,
      b: P.pilotBlk, B: P.pilotBlkSh, g: P.gold, G: P.goldHi,
    },
    rows: [
      "................",
      "................",
      "....kkkkkkkk....",
      "..kkWWWWwwwwkk..",
      ".kWWwwwwwwwwssk.",
      ".kWwwwgGGgwwwsk.",
      ".kssggggggssssk.",
      "..kbbbbbbbbbbk..",
      "..kggggggggggk..",
      "..kBBBBBBBBBBk..",
      "..kkkkkkkkkkkk..",
      "...kgbbbbbbgk...",
      "....kBBBBBBk....",
      ".....kkkkkk.....",
      "................",
      "................",
    ],
  },

  // 8) 기장 제복 (16×16) — charcoal double-breasted blazer, gold epaulets/cuffs, white shirt & crimson tie
  top_career_pilot: {
    pal: {
      k: P.ink, b: P.pilotBlk, B: P.pilotBlkHi, d: P.pilotBlkSh,
      w: P.white, r: P.aviRed, g: P.gold, G: P.goldHi,
    },
    rows: [
      "................",
      "....kkk..kkk....",
      "..kkgggwwgggkk..",
      ".kBBbbwrrwbbBBk.",
      ".kBbbwwrrwwgGbk.",
      ".kBbbgddddgbbdk.",
      ".kBbbbbddbbbbdk.",
      ".kBbbgddddgbbdk.",
      "..kkbbbddbbbkk..",
      "...kbbbddbbdk...",
      "...kgggddgggk...",
      "...kddddddddk...",
      "...kbbbbbbbbk...",
      "....kkkkkkkk....",
      "................",
      "................",
    ],
  },
};
