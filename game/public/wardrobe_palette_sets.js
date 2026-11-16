/**
 * Draft module for Palette Challenge Collection (팔레트 챌린지 의상 4세트 · 12종)
 * Four 3-piece coordinate sets (Hat + Top + Back Bag/Cape, zero wings) inspired by
 * `TR's Palette Challenge` color ramps and sporty/RPG streetwear silhouettes:
 *   1. 버블검 성운 (`Bubblegum Nebula`) : 바시티 스냅백 + 버블검 바시티 자켓 + 성운 메신저백
 *   2. 산호초 리조트 (`Great Barrier Reef`): 리프 선바이저 + 산호초 아노락 + 산호초 데이팩
 *   3. 포르투나 별빛 (`Fortuna`)         : 포르투나 베레모 + 라벤더 더블 코트 + 별빛 반망토
 *   4. 모닥불 아웃도어 (`Bonfire × Deep`) : 모닥불 플랩캡 + 본파이어 푸퍼 파카 + 스퀘어 사첼
 *
 * Native 64×64 (`0.5` logical coordinate grid), anchor-driven (`anchors()` in `wardrobe.js`),
 * never modifying `game/src/logic/**` or `game/public/wardrobe.js`.
 *
 * Integration Locations:
 *   1. `game/src/logic/65-cosmetics.js`
 *      - Add `palette: "팔레트 컬렉션"` in `COSMETIC_SETS`.
 *      - Append `PALETTE_COSMETICS` (recommended wire codes 147..158, or next free codes) to `COSMETICS`.
 *      - Run `npm run build:logic`.
 *   2. `game/public/wardrobe.js`
 *      - Merge `PALETTE_HAT` → `HAT`, `PALETTE_TOP` → `TOP`, `PALETTE_BACK` → `BACK`,
 *        `PALETTE_BACK_FRONT` → `BACK_FRONT`, and `PALETTE_ART` → `ART`.
 *      - Add `"nebulaMessenger"`, `"reefDaypack"`, `"bonfireSatchel"` to `HARD_BACKS` if using rigid outline pass.
 *   3. `game/public/art.js` / `asset/generated/palette-sets/`
 *      - `PALETTE_ICONS` holds all 12 16×16 bag icon templates matching the normalized PNGs.
 */

export const PALETTE_COSMETICS = [
  // Set 1: Bubblegum Nebula
  { id: "hat_pal_nebula",   code: 147, slot: "hat",  name: "네뷸라 스냅백",     set: "palette", shop: 5 },
  { id: "top_pal_nebula",   code: 148, slot: "top",  name: "버블검 바시티",     set: "palette", shop: 5 },
  { id: "back_pal_nebula",  code: 149, slot: "back", name: "네뷸라 메신저백",   set: "palette", shop: 5 },
  // Set 2: Great Barrier Reef
  { id: "hat_pal_reef",     code: 150, slot: "hat",  name: "리프 선바이저",     set: "palette", shop: 5 },
  { id: "top_pal_reef",     code: 151, slot: "top",  name: "산호초 아노락",     set: "palette", shop: 5 },
  { id: "back_pal_reef",    code: 152, slot: "back", name: "산호초 데이팩",     set: "palette", shop: 5 },
  // Set 3: Fortuna
  { id: "hat_pal_fortuna",  code: 153, slot: "hat",  name: "포르투나 베레모",   set: "palette", shop: 6 },
  { id: "top_pal_fortuna",  code: 154, slot: "top",  name: "라벤더 코트",       set: "palette", shop: 6 },
  { id: "back_pal_fortuna", code: 155, slot: "back", name: "성운 별빛 반망토",  set: "palette", shop: 6 },
  // Set 4: Bonfire × Challenger Deep
  { id: "hat_pal_bonfire",  code: 156, slot: "hat",  name: "모닥불 플랩캡",     set: "palette", shop: 6 },
  { id: "top_pal_bonfire",  code: 157, slot: "top",  name: "본파이어 푸퍼",     set: "palette", shop: 6 },
  { id: "back_pal_bonfire", code: 158, slot: "back", name: "본파이어 사첼",     set: "palette", shop: 6 },
];

export const PALETTE_COLORS = {
  // 1) Bubblegum Nebula
  nebPink:    "#ffa6c9",
  nebPinkHi:  "#ffd1e6",
  nebMag:     "#e64588",
  nebPlum:    "#8f2664",
  nebNavy:    "#22204a",
  nebNavyHi:  "#3b3778",
  nebCream:   "#fff3e0",

  // 2) Great Barrier Reef
  reefTeal:   "#2bc4a5",
  reefTealHi: "#74ebd0",
  reefTealSh: "#197a70",
  reefSun:    "#ffde73",
  reefSunHi:  "#fff4b8",
  reefCoral:  "#f27457",
  reefPlum:   "#733658",

  // 3) Fortuna
  forGold:    "#ffd285",
  forGoldHi:  "#fff1c2",
  forGoldSh:  "#c48d3b",
  forLilac:   "#cf8cff",
  forViolet:  "#6a5ae8",
  forIndigo:  "#29225e",
  forIndHi:   "#44388c",

  // 4) Bonfire × Challenger Deep Accent
  bonRust:    "#ba3f29",
  bonOrange:  "#f57622",
  bonGold:    "#ffbc38",
  bonCream:   "#fff1d6",
  bonCreamSh: "#cfb997",
  deepTeal:   "#205e6b",
  deepTealHi: "#3da194",
  deepTealSh: "#113340",

  ink:        "#2b2233",
};

const P = PALETTE_COLORS;
const sway = (A) => (A.f === 2 ? 1 : A.f === 4 ? -1 : 0);

// ───────────────────────────── 1. HATS (64×64 / 0.5 logical coordinates) ─────────────────────────────

export const PALETTE_HAT = {
  /**
   * 1) 네뷸라 스냅백 (Bubblegum Nebula Two-Tone Flat-Brim Snapback)
   * Midnight-navy crown with pastel bubblegum front panel, hot-magenta star emblem & flat visor.
   */
  nebula: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const capW = A.bumps ? 7.5 : W;
      // Rounded snapback dome
      b.cr(T - 3.5, Math.max(5.5, capW - 2), 0.5, p.nebPinkHi);
      b.cr(T - 3.0, capW, 1.5, p.nebPink);
      b.cr(T - 1.5, capW, 1.5, p.nebNavy);
      b.r(A.cx + capW / 2 - 2.0, T - 3.0, 2.0, 1.5, p.nebMag);
      if (A.back) {
        // Classic plastic snapback strap cutout + cream clasp
        b.r(A.cx - 1.5, T - 1.5, 3.0, 1.0, p.nebCream);
        b.r(A.cx - 0.5, T - 1.5, 1.0, 0.5, p.nebMag);
      }
    },
    over(b, A, p = P) {
      if (A.back) return;
      const T = A.top;
      const cx = A.side ? A.cx - 0.5 : A.cx;
      // Flat wide street visor + hot magenta star patch on forehead panel
      const vw = A.bumps ? 6.0 : A.side ? 7.0 : 8.0;
      const vx = A.side ? A.cx - vw / 2 - 1.0 : A.cx - vw / 2;
      b.r(vx, T - 0.5, vw, 1.0, p.nebNavyHi);
      b.r(vx + 0.5, T, vw - 1.0, 0.5, p.nebMag);
      b.r(cx - 1.0, T - 2.5, 2.0, 1.5, p.nebMag);
      b.r(cx - 0.5, T - 2.0, 1.0, 0.5, p.nebCream);
    },
  },

  /**
   * 2) 리프 선바이저 (Great Barrier Reef Sporty Open-Crown Visor)
   * Open crown (lets top hair/ears/antlers stay totally free!) with sunlit butter headband & reef-teal visor.
   */
  reef: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const bandW = A.bumps ? 7.5 : W;
      // Sunlit butter sweatband hugging forehead (leaves top of head/ears completely open!)
      b.cr(T - 1.5, bandW, 1.5, p.reefSun);
      b.cr(T - 1.5, bandW, 0.5, p.reefSunHi);
      if (A.back) {
        b.r(A.cx - 1.5, T - 1.5, 3.0, 1.0, p.reefCoral);
      }
    },
    over(b, A, p = P) {
      if (A.back) return;
      const T = A.top;
      const vw = A.bumps ? 6.0 : A.side ? 7.0 : 8.0;
      const vx = A.side ? A.cx - vw / 2 - 1.0 : A.cx - vw / 2;
      // Crisp curved reef-teal bill + coral side clip
      b.r(vx, T - 0.5, vw, 1.0, p.reefTeal);
      b.r(vx + 1.0, T - 0.5, vw - 2.0, 0.5, p.reefTealHi);
      b.r(vx + 0.5, T + 0.5, vw - 1.0, 0.5, p.reefTealSh);
      b.r(A.cx + (A.side ? 1.5 : 2.5), T - 1.5, 1.5, 1.0, p.reefCoral);
    },
  },

  /**
   * 3) 포르투나 베레모 (Fortuna Asymmetrical Indigo Beret with Gold Star-Crescent Pin)
   * Soft slouched indigo beret tilted slightly to one side with warm apricot-gold crescent badge.
   */
  fortuna: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const bw = A.bumps ? 7.5 : W + 1.0;
      const tilt = A.side ? -0.5 : 0.5;
      // Slouchy gathered indigo beret crown
      b.cr(T - 3.5, bw - 3.0, 0.5, p.forIndHi, tilt);
      b.cr(T - 3.0, bw,       1.5, p.forIndigo, tilt);
      b.r(A.cx - bw / 2 + 1.0 + tilt, T - 3.0, 2.5, 1.0, p.forLilac);
      b.cr(T - 1.5, bw - 1.0, 1.0, p.forIndigo);
      // Tiny beret stem tip on crown
      b.r(A.cx - 0.5 + tilt, T - 4.0, 1.0, 0.5, p.forIndHi);
    },
    over(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const bw = A.bumps ? 7.0 : W;
      // Gold filigree band edge
      b.cr(T - 0.5, bw, 0.5, p.forGoldSh);
      if (A.back) return;
      // Apricot-gold star crest badge on upper right side of beret
      const bx = A.side ? A.cx - 2.0 : A.cx + 1.5;
      b.r(bx,       T - 2.5, 2.0, 1.5, p.forGold);
      b.r(bx + 0.5, T - 2.5, 1.0, 0.5, p.forGoldHi);
    },
  },

  /**
   * 4) 모닥불 플랩캡 (Bonfire Fur-Cuffed Winter Trapper Cap)
   * Ember-orange quilted shell, cream fleece front fold, deep pine-teal front patch & warm ear flaps.
   */
  bonfire: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const cw = A.bumps ? 7.5 : W;
      // Quilted ember-orange rounded cap crown
      b.cr(T - 3.5, cw - 2.0, 0.5, p.bonGold);
      b.cr(T - 3.0, cw,       1.5, p.bonOrange);
      b.r(A.cx + cw / 2 - 2.5, T - 3.0, 2.5, 1.5, p.bonRust);
      b.cr(T - 1.5, cw,       1.0, p.bonRust);
      // Warm cream fleece ear flaps hanging gently at side/back temple edges (`A.x0` / `A.x1`)
      if (!A.bumps) {
        b.r(A.x0 - 0.5, T - 0.5, 1.5, 2.0, p.bonOrange);
        b.r(A.x0 - 0.5, T + 0.5, 1.0, 1.5, p.bonCream);
        if (!A.side) {
          b.r(A.x1,     T - 0.5, 1.5, 2.0, p.bonRust);
          b.r(A.x1 + 0.5, T + 0.5, 1.0, 1.5, p.bonCreamSh);
        }
      }
      if (A.back) {
        b.cr(T - 0.5, cw - 1.0, 1.0, p.bonCreamSh);
      }
    },
    over(b, A, p = P) {
      if (A.back) return;
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const cw = A.bumps ? 6.5 : W - 1.0;
      // Turned-up cream fleece front cuff + deep pine-teal explorer diamond badge
      b.cr(T - 1.0, cw, 1.0, p.bonCream);
      b.cr(T - 0.5, cw, 0.5, p.bonCreamSh);
      const cx = A.side ? A.cx - 0.5 : A.cx;
      b.r(cx - 1.0, T - 2.5, 2.0, 1.5, p.deepTeal);
      b.r(cx - 0.5, T - 2.0, 1.0, 0.5, p.deepTealHi);
    },
  },
};

// ───────────────────────────── 2. TOPS (64×64 / 0.5 logical coordinates) ─────────────────────────────

export const PALETTE_TOP = {
  /**
   * 1) 버블검 바시티 자켓 (Bubblegum Nebula Letterman Bomber)
   * Vivid bubblegum-magenta chest with cream snap buttons & star crest, deep navy sleeves, striped rib cuffs.
   */
  nebulaVarsity: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    // Deep midnight-navy outer sleeves (`12.5..13.5` & `18.5..19.5`)
    b.r(12.5, y0, 1.5, h, p.nebNavy);
    b.r(18.0, y0, 1.5, h, p.nebNavy);
    // Pastel bubblegum-pink inner torso + ribbed cuff stripes
    b.r(14.0, y0, 4.0, h, p.nebPink);
    b.r(14.0, y0, 1.5, h, p.nebPinkHi);
    b.r(17.0, y0, 1.0, h, p.nebMag);
    // Ribbed navy + cream striped cuffs & hem band
    b.r(12.5, A.foot - 0.5, 7.0, 0.5, p.nebNavy);
    b.r(13.0, A.foot - 1.0, 6.0, 0.5, p.nebCream);

    if (A.front) {
      // Striped varsity collar + vertical cream snap placket + magenta star letterman patch
      b.r(14.0, y0, 4.0, 0.5, p.nebNavy);
      b.r(15.5, y0 + 0.5, 1.0, h - 1.0, p.nebCream);
      b.r(16.5, y0 + 0.5, 1.0, 1.0, p.nebMag);
    } else if (A.side) {
      b.r(14.0, y0, 2.0, 0.5, p.nebNavy);
      b.r(15.0, y0 + 0.5, 1.5, 1.0, p.nebMag);
    } else {
      b.r(14.5, y0 - 0.5, 3.0, 0.5, p.nebNavy);
      b.r(15.0, y0 + 0.5, 2.0, 1.0, p.nebMag); // back varsity crest
    }
  },

  /**
   * 2) 산호초 아노락 (Great Barrier Reef Sporty Colorblock Anorak)
   * Crisp aqua-teal pullover windbreaker with sunlit butter chest chevron & coral-peach cuffs/zip.
   */
  reefAnorak: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    // Aqua-teal windbreaker shell
    b.r(12.5, y0, 7.0, h, p.reefTeal);
    b.r(12.5, y0, 1.5, h, p.reefTealHi);
    b.r(18.0, y0, 1.5, h, p.reefTealSh);
    // Bold sunlit-butter + coral-peach colorblock horizontal stripe across torso
    b.r(12.5, y0 + 0.5, 7.0, 1.0, p.reefSun);
    b.r(12.5, y0 + 1.5, 7.0, 0.5, p.reefCoral);
    // Coral wrist cuffs & drawcord hem
    b.r(12.5, A.foot - 0.5, 1.5, 0.5, p.reefCoral);
    b.r(18.0, A.foot - 0.5, 1.5, 0.5, p.reefCoral);
    b.r(13.5, A.foot - 0.5, 5.0, 0.5, p.reefTealSh);

    if (A.front) {
      // High collar + coral half-zip pull + butter toggle
      b.r(14.5, y0, 3.0, 0.5, p.reefTealSh);
      b.r(15.5, y0, 1.0, 1.5, p.reefCoral);
      b.r(15.5, y0 + 0.5, 1.0, 0.5, p.reefSunHi);
    } else if (A.side) {
      b.r(14.0, y0, 2.0, 0.5, p.reefCoral);
    } else {
      // Dropped anorak hood edge along upper back
      b.r(14.0, y0 - 0.5, 4.0, 0.5, p.reefCoral);
    }
  },

  /**
   * 3) 라벤더 코트 (Fortuna Lavender Riding Jacket & Gold-Buttoned Vest)
   * Tailored lilac-violet short coat over deep indigo waist & apricot-cream shirt with gold buttons.
   */
  fortunaCoat: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    const sw = sway(A);
    // Lavender-violet outer jacket
    b.r(12.5, y0, 7.0, h, p.forViolet);
    b.r(12.5, y0, 1.5, h, p.forLilac);
    b.r(18.0, y0, 1.5, h, p.forIndigo);
    // Deep indigo waist band & tailored flared lower split-tail (`F`)
    b.r(13.0, A.foot - 1.0, 6.0, 1.0, p.forIndigo);
    b.r(12.5 + sw * 0.3, A.foot, 2.5, 0.5, p.forViolet);
    b.r(17.0 + sw * 0.3, A.foot, 2.5, 0.5, p.forIndigo);

    if (A.front) {
      // Apricot-cream inner shirt V + gold lapel clasp + twin metallic coat buttons
      b.r(14.5, y0, 3.0, 1.0, p.forGoldHi);
      b.r(15.5, y0 + 0.5, 1.0, 1.5, p.forGold);
      b.r(14.5, y0 + 1.5, 0.5, 0.5, p.forGoldHi);
      b.r(17.0, y0 + 1.5, 0.5, 0.5, p.forGold);
    } else if (A.side) {
      b.r(13.5, y0, 1.5, 1.0, p.forGoldHi);
      b.r(15.0, y0 + 0.5, 1.0, 1.0, p.forGold);
    } else {
      b.r(14.5, y0 - 0.5, 3.0, 0.5, p.forLilac);
      b.r(15.5, A.foot - 1.0, 1.0, 1.0, p.forGold);
    }
  },

  /**
   * 4) 본파이어 푸퍼 (Bonfire Quilted Parka with Cream Fleece Collar)
   * Warm ember-orange puffer jacket with cream fleece stand collar, horizontal quilt lines & pine-teal pockets.
   */
  bonfireParka: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    // Padded cozy puffer (`12.0..20.0`)
    b.r(12.0, y0, 8.0, h, p.bonOrange);
    b.r(12.0, y0, 1.5, h, p.bonGold);
    b.r(18.5, y0, 1.5, h, p.bonRust);
    // Fluffy cream fleece collar around neck!
    b.r(13.5, y0 - 0.5, 5.0, 1.0, p.bonCream);
    b.r(13.5, y0, 5.0, 0.5, p.bonCreamSh);
    // Horizontal puffer baffle quilt seam
    b.r(12.0, y0 + 1.5, 8.0, 0.5, p.bonRust);
    // Deep Challenger-Teal pocket/hem accents
    b.r(12.5, A.foot - 1.0, 2.0, 1.0, p.deepTeal);
    b.r(17.5, A.foot - 1.0, 2.0, 1.0, p.deepTeal);

    if (A.front) {
      // Center teal storm zip placket + marigold zipper pull
      b.r(15.5, y0 + 0.5, 1.0, h - 0.5, p.deepTeal);
      b.r(15.5, y0 + 0.5, 1.0, 0.5, p.bonGold);
    } else if (A.side) {
      b.r(15.5, y0 + 0.5, 1.5, 1.0, p.deepTealHi); // sleeve badge
    } else {
      b.r(14.0, y0 - 0.5, 4.0, 0.5, p.bonCream);
      b.r(13.0, y0 + 0.5, 6.0, 0.5, p.bonGold);
    }
  },
};

// ───────────────────────────── 3. BACK PIECES (Bags & Cape, ZERO wings) ─────────────────────────────

export const PALETTE_BACK = {
  /**
   * 1) 네뷸라 메신저백 (Bubblegum Nebula Boxy Crossbody Messenger Bag)
   * Rigid rectangular messenger pack slung across back/hip (`Image 3 row 5` vibe).
   */
  nebulaMessenger: (b, A, p = P) => {
    const sw = sway(A);
    const y = A.bt;
    if (A.back) {
      // Diagonal magenta crossbody strap
      for (let i = 0; i < 6; i++) {
        b.r(12.0 + i * 1.2, y + i * 0.5, 1.5, 0.5, p.nebMag);
      }
      const bx = 13.5 + sw * 0.3;
      const by = y + 1.0;
      b.r(bx, by, 6.0, 3.0, p.nebNavy);
      b.r(bx, by, 6.0, 1.5, p.nebPink);     // pastel bubblegum top flap!
      b.r(bx, by, 6.0, 0.5, p.nebPinkHi);
      b.r(bx + 2.5, by + 1.0, 1.0, 0.5, p.nebCream); // star snap clasp
    } else if (A.side) {
      b.r(10.5, y + 1.0, 3.0, 2.5, p.nebNavy);
      b.r(10.5, y + 1.0, 3.0, 1.0, p.nebPink);
      b.r(11.5, y + 1.5, 1.0, 0.5, p.nebMag);
    } else {
      b.r(19.0, y + 1.5, 2.0, 2.0, p.nebNavy);
      b.r(19.0, y + 1.5, 2.0, 0.5, p.nebPink);
    }
  },

  /**
   * 2) 산호초 데이팩 (Great Barrier Reef Rounded Outdoor Backpack)
   * Classic dual-strap rounded daypack peeking neatly behind shoulders on front/side, full pack on back.
   */
  reefDaypack: (b, A, p = P) => {
    const sw = sway(A);
    const y = A.bt - 0.5;
    if (A.back) {
      const bx = 12.5 + sw * 0.25;
      b.r(bx + 1.5, y - 0.5, 3.5, 0.5, p.reefSun); // top grab loop
      b.r(bx, y, 7.0, 3.5, p.reefTeal);
      b.r(bx, y, 7.0, 0.5, p.reefTealHi);
      // Warm coral lower zip compartment + sunlit butter zip trim
      b.r(bx + 0.5, y + 2.0, 6.0, 1.5, p.reefCoral);
      b.r(bx + 1.0, y + 1.5, 5.0, 0.5, p.reefSun);
      b.r(bx + 5.5, y, 1.5, 3.5, p.reefTealSh);
    } else if (A.side) {
      b.r(10.5, y + 0.5, 3.0, 3.0, p.reefTeal);
      b.r(10.5, y + 2.0, 2.5, 1.5, p.reefCoral);
      b.r(11.0, y + 1.5, 1.5, 0.5, p.reefSun);
    } else {
      // Side edges peeking gently outside shoulders on front view
      b.r(11.5, y + 0.5, 1.5, 2.5, p.reefTealSh);
      b.r(19.0, y + 0.5, 1.5, 2.5, p.reefTealSh);
    }
  },

  /**
   * 3) 성운 별빛 반망토 (Fortuna Asymmetric Starlight Half-Cape)
   * Draped single-shoulder royal half-cape sweeping diagonally across back with gold border & star dots.
   */
  fortunaHalfCape: (b, A, p = P) => {
    const sw = sway(A);
    const last = A.foot - 0.5;
    if (A.back) {
      for (let y = A.bt - 0.5; y <= last; y += 0.5) {
        const k = (y - A.bt) / Math.max(1, last - A.bt);
        const x0 = 12.0 + Math.round(k * 1.5 * 2) / 2 + (y >= last - 1 ? sw * 0.5 : 0);
        const w = 6.5 + Math.round(k * 1.5 * 2) / 2;
        b.r(x0, y, w, 0.5, y >= last - 0.5 ? p.forIndigo : p.forViolet);
        b.r(x0, y, 1.0, 0.5, p.forLilac);
      }
      // Gold hem piping + tiny twinkling star pixel
      b.r(13.5 + sw * 0.5, last, 6.0, 0.5, p.forGold);
      b.r(16.0 + sw * 0.5, last - 1.0, 0.5, 0.5, p.forGoldHi);
    } else if (A.side) {
      for (let y = A.bt; y <= last; y += 0.5) {
        const k = (y - A.bt) / Math.max(1, last - A.bt);
        const x0 = 11.5 - Math.round(k * 2.0 * 2) / 2 - (y >= last - 1 ? sw * 0.5 : 0);
        b.r(x0, y, 13.5 - x0, 0.5, y >= last - 0.5 ? p.forIndigo : p.forViolet);
      }
      b.r(10.0 - sw * 0.5, last, 2.5, 0.5, p.forGold);
    } else {
      // Draped dark indigo cape fold peeking behind one hip
      b.r(11.0, A.bt + 0.5, 2.0, A.foot - A.bt - 0.5, p.forIndigo);
      b.r(18.5, A.bt + 1.0, 1.5, A.foot - A.bt - 1.0, p.forIndigo);
      b.r(11.0, last, 2.0, 0.5, p.forGoldSh);
    }
  },

  /**
   * 4) 본파이어 사첼 (Bonfire × Challenger Deep Boxy Brass-Clasp Satchel)
   * Structured pine-teal field satchel trimmed with blazing bonfire-orange straps & cream buckle.
   */
  bonfireSatchel: (b, A, p = P) => {
    const sw = sway(A);
    const y = A.bt + 0.5;
    if (A.back) {
      const bx = 13.0 + sw * 0.3;
      b.r(bx, y, 6.0, 3.0, p.deepTeal);
      b.r(bx, y, 6.0, 1.0, p.deepTealHi);
      b.r(bx + 5.0, y, 1.0, 3.0, p.deepTealSh);
      // Blazing bonfire-orange vertical buckle straps & top handle
      b.r(bx + 2.0, y - 0.5, 2.0, 0.5, p.bonRust);
      b.r(bx + 1.0, y, 1.0, 2.5, p.bonOrange);
      b.r(bx + 4.0, y, 1.0, 2.5, p.bonOrange);
      b.r(bx + 1.0, y + 1.5, 1.0, 0.5, p.bonGold);
      b.r(bx + 4.0, y + 1.5, 1.0, 0.5, p.bonGold);
    } else if (A.side) {
      b.r(10.5, y + 0.5, 3.0, 2.5, p.deepTeal);
      b.r(11.5, y + 0.5, 1.0, 2.0, p.bonOrange);
      b.r(11.5, y + 1.5, 1.0, 0.5, p.bonGold);
    } else {
      b.r(19.0, y + 1.0, 2.0, 2.0, p.deepTealSh);
      b.r(19.5, y + 1.0, 0.5, 1.5, p.bonOrange);
    }
  },
};

// Front/Side shoulder straps & cape clasps (drawn over body & top)
export const PALETTE_BACK_FRONT = {
  nebulaMessenger: (b, A, p = P) => {
    const y = A.bt;
    if (A.front) {
      for (let i = 0; i < 4; i++) b.r(13.5 + i * 1.2, y + i * 0.5, 1.0, 0.5, p.nebMag);
    } else if (A.side) {
      b.r(13.5, y, 1.0, 2.0, p.nebMag);
    }
  },
  reefDaypack: (b, A, p = P) => {
    const y = A.bt;
    if (A.front) {
      b.r(13.5, y, 0.5, 2.0, p.reefCoral);
      b.r(18.0, y, 0.5, 2.0, p.reefCoral);
    } else if (A.side) {
      b.r(13.5, y, 0.5, 2.0, p.reefCoral);
    }
  },
  fortunaHalfCape: (b, A, p = P) => {
    const y = A.bt;
    if (A.front) {
      b.r(13.0, y, 1.5, 0.5, p.forLilac);
      b.r(13.5, y, 1.0, 0.5, p.forGold); // golden star clasp!
    } else if (A.side) {
      b.r(13.0, y, 1.0, 0.5, p.forGold);
    }
  },
  bonfireSatchel: (b, A, p = P) => {
    const y = A.bt;
    if (A.front) {
      for (let i = 0; i < 4; i++) b.r(17.5 - i * 1.2, y + i * 0.5, 1.0, 0.5, p.bonRust);
    } else if (A.side) {
      b.r(14.5, y, 1.0, 2.0, p.bonRust);
    }
  },
};

// ───────────────────────────── 4. COSMETIC WEAR MAPPING ─────────────────────────────

export const PALETTE_ART = {
  hat_pal_nebula:   ["hat",  "nebula",          PALETTE_COLORS],
  top_pal_nebula:   ["top",  "nebulaVarsity",   PALETTE_COLORS],
  back_pal_nebula:  ["back", "nebulaMessenger", PALETTE_COLORS],
  hat_pal_reef:     ["hat",  "reef",            PALETTE_COLORS],
  top_pal_reef:     ["top",  "reefAnorak",      PALETTE_COLORS],
  back_pal_reef:    ["back", "reefDaypack",     PALETTE_COLORS],
  hat_pal_fortuna:  ["hat",  "fortuna",         PALETTE_COLORS],
  top_pal_fortuna:  ["top",  "fortunaCoat",     PALETTE_COLORS],
  back_pal_fortuna: ["back", "fortunaHalfCape", PALETTE_COLORS],
  hat_pal_bonfire:  ["hat",  "bonfire",         PALETTE_COLORS],
  top_pal_bonfire:  ["top",  "bonfireParka",    PALETTE_COLORS],
  back_pal_bonfire: ["back", "bonfireSatchel",  PALETTE_COLORS],
};

// ───────────────────────────── 5. 16×16 BAG ICONS (12 items) ─────────────────────────────

export const PALETTE_ICONS = {
  // 1) 네뷸라 스냅백
  hat_pal_nebula: {
    pal: {
      k: P.ink, p: P.nebPink, P: P.nebPinkHi, m: P.nebMag,
      n: P.nebNavy, N: P.nebNavyHi, c: P.nebCream,
    },
    rows: [
      "................",
      "................",
      ".....kkkkkk.....",
      "...kkPPppmmkk...",
      "..kPPppmmcmmpk..",
      "..kPpppmmmmpnk..",
      "..kppnnnnnnnnk..",
      "..knnnnnnnnnnk..",
      "..kkkkkkkkkkkk..",
      "...kNNNNmmNNk...",
      "...kmmmmmmmmk...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 2) 버블검 바시티
  top_pal_nebula: {
    pal: {
      k: P.ink, p: P.nebPink, P: P.nebPinkHi, m: P.nebMag,
      n: P.nebNavy, N: P.nebNavyHi, c: P.nebCream,
    },
    rows: [
      "................",
      "....kkk..kkk....",
      "..kkNnnccnnNkk..",
      ".kNNnpPPcpcmNNk.",
      ".kNnnppPcpcmnNk.",
      ".kNnnpppcppnnNk.",
      ".kNnnpppmppnnNk.",
      "..kknpppmppnkk..",
      "...knpppmppnk...",
      "...knccccccnk...",
      "...knnnnnnnnk...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 3) 네뷸라 메신저백
  back_pal_nebula: {
    pal: {
      k: P.ink, p: P.nebPink, P: P.nebPinkHi, m: P.nebMag,
      n: P.nebNavy, N: P.nebNavyHi, c: P.nebCream,
    },
    rows: [
      "................",
      ".....kkkkkk.....",
      "....kmmmmmmk....",
      "...kmmkkkkmmk...",
      "..kkkkkkkkkkkk..",
      "..kPPpppppppmk..",
      "..kPpppppppmmk..",
      "..kpppppccppmk..",
      "..kNNNNnnnnnnk..",
      "..kNnnnnnnnnnk..",
      "..kNnnnnmmnnnk..",
      "..knnnnnnnnnnk..",
      "...kkkkkkkkkk...",
      "................",
      "................",
      "................",
    ],
  },

  // 4) 리프 선바이저
  hat_pal_reef: {
    pal: {
      k: P.ink, t: P.reefTeal, T: P.reefTealHi, d: P.reefTealSh,
      y: P.reefSun, Y: P.reefSunHi, c: P.reefCoral,
    },
    rows: [
      "................",
      "................",
      "................",
      "....kkkkkkkk....",
      "...kYYyyyyyck...",
      "..kYyyyyyyycck..",
      "..kkkkkkkkkkkk..",
      "..kTTtttttttdk..",
      ".kTTttttttttddk.",
      ".kdddddddddddk..",
      "..kkkkkkkkkkk...",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 5) 산호초 아노락
  top_pal_reef: {
    pal: {
      k: P.ink, t: P.reefTeal, T: P.reefTealHi, d: P.reefTealSh,
      y: P.reefSun, Y: P.reefSunHi, c: P.reefCoral,
    },
    rows: [
      "................",
      "....kkkkkkkk....",
      "..kkTTtccTtTkk..",
      ".kTTttYccyytTTk.",
      ".kTtyyyyyyyyytk.",
      ".kTtccccccccctk.",
      ".kTtttttttttdtk.",
      "..kktttttttdkk..",
      "...ktttttttdk...",
      "...kccddddcck...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 6) 산호초 데이팩
  back_pal_reef: {
    pal: {
      k: P.ink, t: P.reefTeal, T: P.reefTealHi, d: P.reefTealSh,
      y: P.reefSun, Y: P.reefSunHi, c: P.reefCoral,
    },
    rows: [
      "................",
      ".....kkkkkk.....",
      "....kyyccyyk....",
      "...kkTTTTTTkk...",
      "..kTTtttttttdk..",
      "..kTttttttttdk..",
      "..kTttttttttdk..",
      "..ktyyyyyyyydk..",
      "..kccyccccycck..",
      "..kcccccccccdk..",
      "..kcccccccccdk..",
      "...kddddddddk...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................",
    ],
  },

  // 7) 포르투나 베레모
  hat_pal_fortuna: {
    pal: {
      k: P.ink, v: P.forIndigo, V: P.forIndHi, l: P.forLilac,
      g: P.forGold, G: P.forGoldHi, s: P.forGoldSh,
    },
    rows: [
      "................",
      ".......kk.......",
      "....kkkVVkkk....",
      "..kkllVVVVvvkk..",
      ".kllVVvvvvvvvvk.",
      ".kVVvvvvvvgGvvsk",
      ".kvvvvvvvvggvvsk",
      "..ksssssssssssk.",
      "..kggggggggggsk.",
      "...kkkkkkkkkkk..",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 8) 라벤더 코트
  top_pal_fortuna: {
    pal: {
      k: P.ink, v: P.forViolet, l: P.forLilac, d: P.forIndigo,
      g: P.forGold, G: P.forGoldHi,
    },
    rows: [
      "................",
      "....kkk..kkk....",
      "..kklvvGGvvlkk..",
      ".kllvvgGGgvvllk.",
      ".klvvvgvvgvvvdk.",
      ".klvvvgvvgvvvdk.",
      "..kkvvvvvvvdkk..",
      "...kddddddddk...",
      "...kvvvkkvvdk...",
      "...kdddkkdddk...",
      "....kkk..kkk....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 9) 성운 별빛 반망토
  back_pal_fortuna: {
    pal: {
      k: P.ink, v: P.forViolet, l: P.forLilac, d: P.forIndigo,
      g: P.forGold, G: P.forGoldHi,
    },
    rows: [
      "................",
      "...kkkk..kkkk...",
      "..klvvvgggvvdk..",
      "..klvvvvvvvvdk..",
      "..klvvvvvvvvdk..",
      "...klvvvvvvvdk..",
      "...klvvvvGvvdk..",
      "...kdvvvvvvvdk..",
      "....kddddddddk..",
      "....kggggggggk..",
      ".....kkkkkkkk...",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 10) 모닥불 플랩캡
  hat_pal_bonfire: {
    pal: {
      k: P.ink, o: P.bonOrange, O: P.bonGold, r: P.bonRust,
      w: P.bonCream, s: P.bonCreamSh, t: P.deepTeal, T: P.deepTealHi,
    },
    rows: [
      "................",
      "....kkkkkkkk....",
      "..kkOOooootTkk..",
      ".kOOooootTTtook.",
      ".kOoooorrttrosk.",
      ".kwwwwwwwwwwssk.",
      ".kwwksssssskwwk.",
      ".kwwk......kwwk.",
      "..kk........kk..",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 11) 본파이어 푸퍼
  top_pal_bonfire: {
    pal: {
      k: P.ink, o: P.bonOrange, O: P.bonGold, r: P.bonRust,
      w: P.bonCream, s: P.bonCreamSh, t: P.deepTeal,
    },
    rows: [
      "................",
      "...kkkkkkkkkk...",
      "..kOOwwwwwwOOk..",
      ".kOOoossOttoOOk.",
      ".kOoooooottoook.",
      ".krrrrrrrttrrrk.",
      ".kOoooOoottoOrk.",
      "..kktttootttkk..",
      "...kttttttttk...",
      "...krrrrrrrrk...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 12) 본파이어 사첼
  back_pal_bonfire: {
    pal: {
      k: P.ink, o: P.bonOrange, O: P.bonGold, r: P.bonRust,
      t: P.deepTeal, T: P.deepTealHi, d: P.deepTealSh, G: P.bonCream,
    },
    rows: [
      "................",
      ".....kkkkkk.....",
      "....krrrrrrk....",
      "..kkkkkkkkkkkk..",
      ".kTTtOttttOtTdk.",
      ".kTttOttttOttdk.",
      ".ktttGttttGttdk.",
      ".ktttOttttOttdk.",
      ".ktttttttttttdk.",
      ".kdddddddddddk..",
      "..kkkkkkkkkkk...",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
};
