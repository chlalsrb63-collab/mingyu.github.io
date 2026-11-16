/**
 * Draft module for Traditional Hanbok Avatars Collection (전통 한복 아바타 4세트 · 8종)
 * Four distinct Korean traditional costume sets (hat + top pairs), avoiding overlap with
 * existing `top_hanbok` (yellow/red) and `top_dopo` (plain indigo):
 *   1. 선비 (Joseon Scholar)       : 흑립 갓 + 옥색 학창의 (죽관 흑립·옥구슬 갓끈 + 옥색 도포·검정 선·매듭 고름)
 *   2. 아씨 (Noble Lady)           : 금박 족두리 + 연홍 당의 (칠보 족두리·비녀·뒷댕기 + 연홍 당의·비취 치마·노리개)
 *   3. 전하 (Royal King)           : 익선관 + 홍룡포 (이단 매미날개 관 + 적색 곤룡포·금용 보·옥대)
 *   4. 무사 (Joseon Officer)       : 공작깃 전립 + 청철릭 쾌자 (홍사·공작깃 갓 + 철릭 주름·쾌자 조끼·붉은 전대)
 *
 * Native 64×64 (`0.5` logical coordinate grid), anchor-driven (`anchors()` in `wardrobe.js`),
 * never modifying `game/src/logic/**` or `game/public/wardrobe.js`.
 *
 * Integration Locations:
 *   1. `game/src/logic/65-cosmetics.js`
 *      - Add `hanbok: "전통 한복"` in `COSMETIC_SETS`.
 *      - Append `HANBOK_COSMETICS` (recommended wire codes 139..146, or next free codes) to `COSMETICS`.
 *      - Run `npm run build:logic`.
 *   2. `game/public/wardrobe.js`
 *      - Merge `HANBOK_HAT` entries into `HAT` and `HANBOK_TOP` entries into `TOP` (`wearTop` supporting function entries).
 *      - Merge `HANBOK_ART` entries into `ART`.
 *   3. `game/public/art.js` / `asset/generated/hanbok-sets/`
 *      - `HANBOK_ICONS` holds 16×16 bag icon templates matching the normalized PNGs.
 */

export const HANBOK_COSMETICS = [
  { id: "hat_hanbok_seonbi", code: 139, slot: "hat", name: "흑립 갓",       set: "hanbok", shop: 5 },
  { id: "top_hanbok_seonbi", code: 140, slot: "top", name: "옥색 학창의",   set: "hanbok", shop: 5 },
  { id: "hat_hanbok_assi",   code: 141, slot: "hat", name: "금박 족두리",   set: "hanbok", shop: 6 },
  { id: "top_hanbok_assi",   code: 142, slot: "top", name: "연홍 당의",     set: "hanbok", shop: 6 },
  { id: "hat_hanbok_king",   code: 143, slot: "hat", name: "익선관",        set: "hanbok", shop: 7 },
  { id: "top_hanbok_king",   code: 144, slot: "top", name: "홍룡포",        set: "hanbok", shop: 7 },
  { id: "hat_hanbok_musa",   code: 145, slot: "hat", name: "공작깃 전립",   set: "hanbok", shop: 6 },
  { id: "top_hanbok_musa",   code: 146, slot: "top", name: "청철릭 쾌자",   set: "hanbok", shop: 6 },
];

export const HANBOK_PALETTE = {
  // 1) Seonbi — Charcoal Horsehair Gat & Celadon Jade Hakchangui
  gatBlk:     "#2b2d3b",
  gatHi:      "#4c526b",
  gatSh:      "#191a24",
  celadon:    "#7bc4b4",
  celadonHi:  "#aae6d6",
  celadonSh:  "#488c80",
  amberBead:  "#eb9c38",

  // 2) Assi — Peony Rose Dangui & Emerald-Jade Chima + Crimson Daenggi
  peony:      "#e87292",
  peonyHi:    "#ffa6bd",
  peonySh:    "#a63c5e",
  jade:       "#3ea38a",
  jadeHi:     "#6cd4b8",
  jadeSh:     "#23695b",
  daenggi:    "#d9364e",
  daenggiSh:  "#8f1c30",

  // 3) King — Royal Scarlet Gonryongpo & Violet-Silk Ikseongwan
  royalRed:   "#cc293c",
  royalRedHi: "#f25767",
  royalRedSh: "#801524",
  silkDark:   "#362b4a",
  silkHi:     "#5a4878",
  silkSh:     "#201830",
  royalBlue:  "#324b82",

  // 4) Musa — Midnight Indigo Kwaeja & Warm Amber-Bronze Cheollik
  kwaeja:     "#314473",
  kwaejaHi:   "#516ba8",
  kwaejaSh:   "#1d2847",
  terracotta: "#d4813b",
  terraHi:    "#f2a963",
  terraSh:    "#8c4c1c",
  peacock:    "#2cb5a0",
  peacockHi:  "#74ebd5",

  // Shared Hanbok Silk White, Gold Foil & Ink
  dongjeong:  "#f7f6fc",
  dongSh:     "#c7c6db",
  gold:       "#f5c542",
  goldHi:     "#fff09e",
  goldSh:     "#ad7c18",
  ink:        "#2b2233",
};

const P = HANBOK_PALETTE;
const stepSwing = (A) => (A.f === 2 ? 0.5 : A.f === 4 ? -0.5 : 0);

// ───────────────────────────── 1. HATS (64×64 / 0.5 logical coordinates) ─────────────────────────────

export const HANBOK_HAT = {
  /**
   * 1) 흑립 갓 (Joseon Scholar Horsehair Gat)
   * Tall flat-topped cylindrical bamboo-mesh crown + wide crisp circular brim + coral-amber beaded chin cord.
   */
  seonbi: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const crownW = A.bumps ? 6.0 : Math.min(8.0, W - 1.0);
      // Cylindrical flat-topped gat crown
      b.cr(T - 4.5, crownW - 1.0, 0.5, p.gatHi);
      b.cr(T - 4.0, crownW,       3.0, p.gatBlk);
      b.r(A.cx - crownW / 2 + 0.5, T - 3.5, 1.5, 2.0, p.gatHi);
      b.r(A.cx + crownW / 2 - 1.5, T - 3.5, 1.5, 2.5, p.gatSh);
      // Subtle gold headband ring (모정/패영)
      b.cr(T - 1.5, crownW, 0.5, p.gatSh);
    },
    over(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      // Wide signature circular brim sitting right along top hairline (tucked narrower between frog eye bumps)
      const brimW = A.bumps ? 8.5 : W + 6.0;
      b.cr(T - 1.0, brimW, 0.5, p.gatHi);
      b.cr(T - 0.5, brimW, 0.5, p.gatBlk);
      if (!A.back) {
        // Amber-gold beaded chin-cord (갓끈) trailing delicately near jaw edges, clear of eyes
        const lx = Math.round((A.bumps ? A.cx - 3.5 : A.x0 + 1.0) * 2) / 2;
        const rx = Math.round((A.bumps ? A.cx + 3.0 : A.x1 - 1.5) * 2) / 2;
        b.r(lx, T,       0.5, 1.0, p.amberBead);
        b.r(lx, T + 1.0, 0.5, 0.5, p.gold);
        if (!A.side) {
          b.r(rx, T,       0.5, 1.0, p.amberBead);
          b.r(rx, T + 1.0, 0.5, 0.5, p.gold);
        }
      }
    },
  },

  /**
   * 2) 금박 족두리 (Noblewoman Jeweled Jokduri + Hairpin + Back Daenggi Ribbon)
   * Compact dark violet-black crown centered on top, golden binyeo pin ends, crimson/jade jewel,
   * and hanging scarlet silk daenggi ribbon in the back view.
   */
  assi: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const capW = A.bumps ? 5.5 : 6.5;
      // Hexagonal tapered black silk jokduri crown
      b.cr(T - 3.5, capW - 1.5, 1.0, p.silkHi);
      b.cr(T - 2.5, capW,       2.0, p.silkDark);
      b.r(A.cx + capW / 2 - 1.5, T - 2.5, 1.5, 2.0, p.silkSh);
      // Golden gold-leaf hairline band
      b.cr(T - 0.5, capW, 0.5, p.gold);
      if (A.back) {
        // Long crimson silk daenggi ribbon pinned at back of head with gold foil stamp
        const sw = stepSwing(A);
        b.r(A.cx - 2.0, T - 1.5, 4.0, 1.0, p.gold); // golden back ornament
        b.r(A.cx - 1.0 + sw * 0.4, T - 0.5, 2.0, 3.0, p.daenggi);
        b.r(A.cx - 0.5 + sw * 0.4, T + 0.5, 1.0, 1.5, p.gold);
        b.r(A.cx + 0.5 + sw * 0.4, T - 0.5, 0.5, 3.0, p.daenggiSh);
      }
    },
    over(b, A, p = P) {
      if (A.back) return;
      const T = A.top;
      const cx = A.side ? A.cx - 0.5 : A.cx;
      // Horizontal golden binyeo hairpin bead tips peeking cleanly from both sides of the jokduri
      const pinHalf = A.bumps ? 3.5 : 4.5;
      b.r(cx - pinHalf,       T - 1.5, 1.0, 0.5, p.goldHi);
      b.r(cx + pinHalf - 1.0, T - 1.5, 1.0, 0.5, p.gold);
      // Front seven-treasure (칠보) crimson + jade central jewel & pearl dots
      b.r(cx - 1.0, T - 2.5, 2.0, 1.5, p.gold);
      b.r(cx - 0.5, T - 2.0, 1.0, 1.0, p.daenggi);
      b.r(cx - 0.5, T - 3.0, 1.0, 0.5, p.jadeHi);
    },
  },

  /**
   * 3) 익선관 (Royal King's Ikseongwan Crown with Curved Back Wings)
   * Distinctive two-stepped royal silk crown with twin upward cicada-wing ears at the rear.
   */
  king: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const baseW = A.bumps ? 7.0 : Math.min(8.5, W);
      // Upper stepped peak + lower crown in royal deep violet silk
      b.cr(T - 4.0, baseW - 2.5, 1.5, p.silkHi);
      b.cr(T - 2.5, baseW,       2.0, p.silkDark);
      b.r(A.cx + baseW / 2 - 2.0, T - 2.5, 2.0, 2.0, p.silkSh);
      // Twin signature upward-curved wing-fins (매미 날개 2매)
      const wx = A.bumps ? 3.5 : 4.5;
      if (A.back) {
        // Seen clearly from back as twin wide translucent wings
        b.r(A.cx - wx - 1.5, T - 5.0, 2.0, 3.0, p.silkDark);
        b.r(A.cx + wx - 0.5, T - 5.0, 2.0, 3.0, p.silkDark);
        b.r(A.cx - wx - 1.0, T - 4.5, 1.0, 2.0, p.silkHi);
        b.r(A.cx + wx,       T - 4.5, 1.0, 2.0, p.silkHi);
        b.r(A.cx - 1.0,      T - 1.5, 2.0, 1.0, p.gold);
      } else if (A.side) {
        // Seen trailing behind the crown in 3/4 view
        b.r(A.cx + 2.5, T - 5.0, 2.5, 2.5, p.silkDark);
        b.r(A.cx + 3.0, T - 4.5, 1.5, 1.5, p.silkHi);
      } else {
        // Wing tips peeking symmetrically beside the upper tier in front view
        b.r(A.cx - wx - 1.0, T - 4.5, 1.5, 2.5, p.silkDark);
        b.r(A.cx + wx - 0.5, T - 4.5, 1.5, 2.5, p.silkDark);
      }
      b.cr(T - 0.5, baseW, 0.5, p.goldSh);
    },
    over(b, A, p = P) {
      if (A.back) return;
      const T = A.top;
      const cx = A.side ? A.cx - 0.5 : A.cx;
      // Front gold royal forehead clasp (옥관자 장식)
      b.r(cx - 1.0, T - 1.5, 2.0, 1.0, p.gold);
      b.r(cx - 0.5, T - 1.5, 1.0, 0.5, p.goldHi);
    },
  },

  /**
   * 4) 공작깃 전립 (Joseon Military Officer Jeollip with Scarlet Plume & Peacock Feather)
   * Rounded slate felt hat crowned with scarlet top knot, wide slanted military brim & sweeping peacock feather.
   */
  musa: {
    ears: "through",
    draw(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const crownW = A.bumps ? 6.5 : Math.min(8.5, W);
      // Rounded martial felt dome
      b.cr(T - 3.5, crownW - 2.0, 1.0, p.gatHi);
      b.cr(T - 2.5, crownW,       2.0, p.kwaejaSh);
      b.r(A.cx - crownW / 2 + 0.5, T - 2.5, 2.0, 1.5, p.kwaeja);
      // Top brass finial + sweeping scarlet tassel & peacock feather plume
      b.cr(T - 4.0, 2.0, 0.5, p.gold);
      const px = A.side ? A.cx + 1.5 : A.cx + 2.0;
      b.r(A.cx - 0.5, T - 4.5, 1.5, 0.5, p.daenggi); // scarlet top tuft
      // Peacock plume sweeping outward-upward to the right side (rear-right on side view)
      b.r(px,       T - 5.0, 1.5, 1.0, p.peacock);
      b.r(px + 1.0, T - 5.5, 1.5, 1.0, p.peacockHi);
      b.r(px + 1.5, T - 5.0, 1.0, 0.5, p.gold); // eye spot of feather!
    },
    over(b, A, p = P) {
      const T = A.top;
      const W = A.x1 - A.x0 + 1;
      const brimW = A.bumps ? 8.5 : W + 4.5;
      // Military wide brim with red inner trim band
      b.cr(T - 1.0, brimW - 2.0, 0.5, p.daenggi);
      b.cr(T - 0.5, brimW,       0.5, p.kwaejaSh);
      if (!A.back) {
        const cx = A.side ? A.cx - 0.5 : A.cx;
        b.r(cx - 1.0, T - 2.0, 2.0, 1.0, p.gold); // brass front crest
        b.r(cx - 0.5, T - 2.0, 1.0, 0.5, p.goldHi);
      }
    },
  },
};

// ───────────────────────────── 2. TOPS (64×64 / 0.5 logical coordinates) ─────────────────────────────

export const HANBOK_TOP = {
  /**
   * 1) 옥색 학창의 (Celadon-Jade Scholar Robe with Black Silk Trim & Knot Goreum)
   * Crisp celadon coat, black silk collar/cuff borders (검정 선), pure white 동정, flowing coat skirt.
   */
  seonbiHak: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    const sw = stepSwing(A);
    // Flowing celadon-jade robe
    b.r(12.5, y0, 7.0, h, p.celadon);
    b.r(12.5, y0, 1.5, h, p.celadonHi);
    b.r(18.0, y0, 1.5, h, p.celadonSh);
    // Signature black silk cuff & hem trim (학창의 검정 선)
    b.r(12.5, y0, 1.0, h, p.gatBlk);
    b.r(18.5, y0, 1.0, h, p.gatBlk);
    // Flared coat tail over foot line
    b.r(13.0 + sw * 0.5, A.foot, 6.0, 0.5, p.celadon);
    b.r(12.5 + sw * 0.5, A.foot, 1.0, 0.5, p.gatBlk);
    b.r(18.5 + sw * 0.5, A.foot, 1.0, 0.5, p.gatBlk);

    if (A.front) {
      // Crisp white overlapped dongjeong V-collar + black silk lapel border
      b.r(14.0, y0, 4.0, 0.5, p.gatBlk);
      b.r(14.5, y0, 3.0, 1.0, p.dongjeong);
      b.r(15.5, y0 + 0.5, 1.0, 0.5, p.dongSh);
      // Black twisted silk waist sash (세조대) + dangling amber/crimson knot goreum
      b.r(13.5, A.foot - 1.5, 5.0, 0.5, p.gatBlk);
      b.r(16.0, y0 + 1.0, 1.0, 1.5, p.daenggi);
      b.r(16.5, y0 + 2.0, 0.5, 0.5, p.gold);
    } else if (A.side) {
      b.r(13.5, y0, 2.0, 1.0, p.dongjeong);
      b.r(13.5, A.foot - 1.5, 5.0, 0.5, p.gatBlk);
      b.r(14.5, y0 + 1.0, 1.0, 1.5, p.daenggi);
    } else {
      // Clean back robe with black collar trim + tied rear silk sash & cranes accent dot
      b.r(14.5, y0 - 0.5, 3.0, 0.5, p.gatBlk);
      b.r(13.5, A.foot - 1.5, 5.0, 0.5, p.gatBlk);
      b.r(15.5, A.foot - 1.5, 1.0, 1.5, p.celadonSh);
    }
  },

  /**
   * 2) 연홍 당의·비취 치마 (Peony-Rose Dangui Jacket & Jade-Emerald Chima Skirt)
   * Curved noblewoman dangui with white dongjeong, gold crest medallion, swaying golden norigae & wide jade skirt.
   */
  assiDangui: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    const sw = stepSwing(A);
    const skirtY = Math.min(A.foot - 1.0, y0 + 2.0);
    // Upper peony-rose dangui jacket
    b.r(12.5, y0, 7.0, Math.max(1.5, skirtY - y0), p.peony);
    b.r(12.5, y0, 1.5, Math.max(1.5, skirtY - y0), p.peonyHi);
    b.r(18.0, y0, 1.5, Math.max(1.5, skirtY - y0), p.peonySh);
    // Wide flared jade-emerald chima skirt covering lower torso + curving cleanly over A.foot
    b.r(12.5, skirtY, 7.0, A.foot - skirtY, p.jade);
    b.r(12.5, skirtY, 1.5, A.foot - skirtY, p.jadeHi);
    b.r(18.0, skirtY, 1.5, A.foot - skirtY, p.jadeSh);
    b.r(12.0 + sw * 0.5, A.foot, 8.0, 0.5, p.jade);
    b.r(13.0 + sw * 0.5, A.foot, 2.0, 0.5, p.jadeHi);
    b.r(18.0 + sw * 0.5, A.foot, 2.0, 0.5, p.jadeSh);
    // Gold foil floral cuffs
    b.r(12.5, y0 + 1.0, 1.0, 0.5, p.dongjeong);
    b.r(18.5, y0 + 1.0, 1.0, 0.5, p.dongjeong);

    if (A.front) {
      // Crisp white dongjeong collar + crimson silk chest goreum
      b.r(14.5, y0, 3.0, 0.5, p.dongjeong);
      b.r(15.5, y0 + 0.5, 1.0, 1.0, p.daenggi);
      // Central gold phoenix medallion on chest
      b.r(15.5, y0 + 1.0, 1.0, 0.5, p.gold);
      // Swaying gold + coral norigae pendant over jade skirt
      b.r(14.0 + sw * 0.4, skirtY, 1.0, 1.5, p.gold);
      b.r(14.0 + sw * 0.4, skirtY + 1.0, 0.5, 0.5, p.daenggi);
    } else if (A.side) {
      b.r(13.5, y0, 1.5, 1.0, p.dongjeong);
      b.r(15.0, skirtY, 1.0, 1.5, p.gold);
    } else {
      // Back gold roundel & curved dangui tail flap overlapping the jade skirt
      b.r(14.5, y0 - 0.5, 3.0, 0.5, p.dongSh);
      b.r(15.5, y0 + 0.5, 1.0, 1.0, p.gold);
      b.r(14.5, skirtY, 3.0, 1.0, p.peony);
      b.r(15.5, skirtY + 0.5, 1.0, 0.5, p.goldSh);
    }
  },

  /**
   * 3) 홍룡포 (Royal Crimson Dragon Robe)
   * Scarlet royal robe, gold circular dragon chest/back roundels (흉배), jade-gold okdae belt, navy inner hem.
   */
  kingYongpo: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    const sw = stepSwing(A);
    // Royal scarlet crimson robe (`12.5..19.5`)
    b.r(12.5, y0, 7.0, h, p.royalRed);
    b.r(12.5, y0, 1.5, h, p.royalRedHi);
    b.r(18.0, y0, 1.5, h, p.royalRedSh);
    // Gold-embroidered shoulder medallions & sleeve cuffs
    b.r(12.5, y0 + 0.5, 1.0, 0.5, p.gold);
    b.r(18.5, y0 + 0.5, 1.0, 0.5, p.gold);
    // Deep royal-blue pleated under-robe peeking at coat hem (`F`)
    b.r(12.5 + sw * 0.5, A.foot, 7.0, 0.5, p.royalBlue);
    b.r(14.5 + sw * 0.5, A.foot, 3.0, 0.5, p.gold); // gold hem trim

    if (A.front) {
      // Pure white dongjeong collar
      b.r(14.5, y0, 3.0, 1.0, p.dongjeong);
      // Iconic gold circular royal dragon bo (보/흉배) centered on chest
      b.r(15.0, y0 + 0.5, 2.0, 1.5, p.gold);
      b.r(15.5, y0 + 0.5, 1.0, 0.5, p.goldHi);
      // Ornate gold & jade okdae (옥대) royal hoop belt near waist
      b.r(13.0, A.foot - 1.0, 6.0, 0.5, p.gold);
      b.r(15.5, A.foot - 1.0, 1.0, 0.5, p.jadeHi);
    } else if (A.side) {
      b.r(13.5, y0, 1.5, 1.0, p.dongjeong);
      b.r(14.5, y0 + 1.0, 1.5, 1.0, p.gold);
      b.r(13.0, A.foot - 1.0, 6.0, 0.5, p.gold);
    } else {
      // Back collar + full gold dragon medallion on back + royal belt
      b.r(14.5, y0 - 0.5, 3.0, 0.5, p.dongSh);
      b.r(15.0, y0 + 0.5, 2.0, 1.5, p.gold);
      b.r(15.5, y0 + 0.5, 1.0, 0.5, p.goldHi);
      b.r(13.0, A.foot - 1.0, 6.0, 0.5, p.gold);
    }
  },

  /**
   * 4) 청철릭 쾌자 (Joseon Military Officer Cheollik & Indigo Kwaeja)
   * Warm terracotta-amber inner sleeves + deep indigo sleeveless kwaeja vest + pleated lower skirt + crimson waist sash.
   */
  musaCheollik: (b, A, p = P) => {
    const y0 = A.bt;
    const h = Math.max(2, A.foot - y0);
    const sw = stepSwing(A);
    // Warm amber-bronze cheollik sleeves (`12.0..13.5` & `18.5..20.0`)
    b.r(12.0, y0, 1.5, h, p.terracotta);
    b.r(12.0, y0, 0.5, h, p.terraHi);
    b.r(18.5, y0, 1.5, h, p.terraSh);
    // Sleeveless midnight-indigo kwaeja vest across torso (`13.5..18.5`)
    b.r(13.5, y0, 5.0, h, p.kwaeja);
    b.r(13.5, y0, 1.0, h, p.kwaejaHi);
    b.r(17.5, y0, 1.0, h, p.kwaejaSh);
    // Pleated flared cheollik hem (`A.foot`)
    b.r(12.5 + sw * 0.5, A.foot, 7.0, 0.5, p.terracotta);
    b.r(14.0 + sw * 0.5, A.foot, 1.0, 0.5, p.kwaeja);
    b.r(17.0 + sw * 0.5, A.foot, 1.0, 0.5, p.kwaeja);

    if (A.front) {
      // Crisp white collar + gold trim down vest opening
      b.r(14.5, y0, 3.0, 0.5, p.dongjeong);
      b.r(15.5, y0 + 0.5, 1.0, h - 1.5, p.gold);
      // Crimson martial belt (전대) + dangling scarlet sash ends
      b.r(13.0, A.foot - 1.0, 6.0, 0.5, p.daenggi);
      b.r(16.0, A.foot - 0.5, 1.0, 0.5, p.gold);
    } else if (A.side) {
      b.r(14.0, y0, 1.5, 0.5, p.dongjeong);
      b.r(13.0, A.foot - 1.0, 6.0, 0.5, p.daenggi);
      b.r(17.5, y0 + 1.0, 1.0, 1.0, p.gold); // quiver/sword ring glint
    } else {
      b.r(14.5, y0 - 0.5, 3.0, 0.5, p.dongSh);
      b.r(15.5, y0 + 0.5, 1.0, 1.0, p.gold);
      b.r(13.0, A.foot - 1.0, 6.0, 0.5, p.daenggi);
    }
  },
};

// ───────────────────────────── 3. COSMETIC WEAR MAPPING ─────────────────────────────

export const HANBOK_ART = {
  hat_hanbok_seonbi: ["hat", "seonbi", HANBOK_PALETTE],
  top_hanbok_seonbi: ["top", "seonbiHak", HANBOK_PALETTE],
  hat_hanbok_assi:   ["hat", "assi", HANBOK_PALETTE],
  top_hanbok_assi:   ["top", "assiDangui", HANBOK_PALETTE],
  hat_hanbok_king:   ["hat", "king", HANBOK_PALETTE],
  top_hanbok_king:   ["top", "kingYongpo", HANBOK_PALETTE],
  hat_hanbok_musa:   ["hat", "musa", HANBOK_PALETTE],
  top_hanbok_musa:   ["top", "musaCheollik", HANBOK_PALETTE],
};

// ───────────────────────────── 4. 16×16 BAG ICONS ─────────────────────────────

export const HANBOK_ICONS = {
  // 1) 흑립 갓 (16×16) — tall cylindrical horsehair crown, wide crisp round brim, amber-gold beaded chin cord
  hat_hanbok_seonbi: {
    pal: {
      k: P.ink, b: P.gatBlk, H: P.gatHi, s: P.gatSh,
      a: P.amberBead, g: P.gold,
    },
    rows: [
      "................",
      ".....kkkkkk.....",
      "....kHHbbbsk....",
      "....kHbbbbdk....",
      "....kHbbbbdk....",
      "....kHbbbbdk....",
      "....kssssssk....",
      "..kkkHHHHsskkk..",
      ".kHHbbbbbbbbssk.",
      ".kssssssssssssk.",
      "..kkkkkkkkkkkk..",
      "....ka....ak....",
      "....kg....gk....",
      ".....k....k.....",
      "................",
      "................",
    ].map((r) => r.replace(/d/g, "s")),
  },

  // 2) 옥색 학창의 (16×16) — celadon-jade robe with black silk sleeves/trim, crisp white collar, crimson goreum
  top_hanbok_seonbi: {
    pal: {
      k: P.ink, c: P.celadon, C: P.celadonHi, s: P.celadonSh,
      b: P.gatBlk, w: P.dongjeong, r: P.daenggi, g: P.gold,
    },
    rows: [
      "................",
      "....kkk..kkk....",
      "..kkbCCwwCCbkk..",
      ".kbbCCcwwccCbbk.",
      ".kbbCccwwrrcbbk.",
      ".kbbCccccrgcbbk.",
      "..kkCcccsrcckk..",
      "...kCccccccsk...",
      "...kbbbbbbbbk...",
      "...kcccscccsk...",
      "...kcccscccsk...",
      "...kcccscccsk...",
      "...kbccccccbk...",
      "....kkkkkkkk....",
      "................",
      "................",
    ],
  },

  // 3) 금박 족두리 (16×16) — hexagonal silk jokduri crown, golden binyeo pin tips, coral & jade jewels, crimson ribbon
  hat_hanbok_assi: {
    pal: {
      k: P.ink, p: P.silkDark, P: P.silkHi, s: P.silkSh,
      g: P.gold, G: P.goldHi, r: P.daenggi, j: P.jadeHi,
    },
    rows: [
      "................",
      ".....kkkkkk.....",
      "....kPPpppsk....",
      "...kPPpjjppsk...",
      "...kPpgGGgpsk...",
      "..kkppgrrgppkk..",
      ".kGGppppppppggk.",
      "..kksssssssskk..",
      "...kggggggggk...",
      "...kkkkkkkkkk...",
      "......krrk......",
      "......kgrk......",
      "......krrk......",
      ".......kk.......",
      "................",
      "................",
    ],
  },

  // 4) 연홍 당의·비취 치마 (16×16) — peony-rose curved dangui over flowing jade skirt, gold crest & norigae
  top_hanbok_assi: {
    pal: {
      k: P.ink, r: P.peony, R: P.peonyHi, d: P.peonySh,
      w: P.dongjeong, j: P.jade, J: P.jadeHi, s: P.jadeSh,
      g: P.gold, c: P.daenggi,
    },
    rows: [
      "................",
      "....kkk..kkk....",
      "..kkRRRwwRRRkk..",
      ".kRRRrwccwrRRdk.",
      ".kRRrrgggrrRRdk.",
      ".kRwRRrrrrdRwdk.",
      "..kkRRRddRRRkk..",
      "...kjjjggjjjk...",
      "...kJJjcgjssk...",
      "...kJJjjjjssk...",
      "..kJJjjjjjjssk..",
      "..kJJjjjjjjssk..",
      "..kssssssssssk..",
      "...kkkkkkkkkk...",
      "................",
      "................",
    ],
  },

  // 5) 익선관 (16×16) — royal king stepped violet-black silk crown with twin angled rear wings & gold crest
  hat_hanbok_king: {
    pal: {
      k: P.ink, p: P.silkDark, P: P.silkHi, s: P.silkSh,
      g: P.gold, G: P.goldHi,
    },
    rows: [
      "................",
      "...kk.kkkk.kk...",
      "..kPpkPpppkpPk..",
      "..kPskppppksPk..",
      "..kppPPPPpppsk..",
      "...kPPpppppsk...",
      "...kPppGGppsk...",
      "...kPppggppsk...",
      "...kssssssssk...",
      "...kggggggggk...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 6) 홍룡포 (16×16) — crimson dragon robe, white dongjeong, gleaming gold bo roundel, jade okdae belt, blue hem
  top_hanbok_king: {
    pal: {
      k: P.ink, r: P.royalRed, R: P.royalRedHi, d: P.royalRedSh,
      w: P.dongjeong, g: P.gold, G: P.goldHi, j: P.jadeHi, b: P.royalBlue,
    },
    rows: [
      "................",
      "....kkk..kkk....",
      "..kkRrrwwrrRkk..",
      ".kRRrrwGGwrrRRk.",
      ".kRgrrGGGGrrrgk.",
      ".kRrrrrggrrrrrk.",
      "..kkrrrrrddddk..",
      "...kggggjggggk..",
      "...krrrrrrrrdk..",
      "...krrrrrrrrdk..",
      "...krrrrrrrrdk..",
      "...kbbbbbbbbbk..",
      "...kgggggggggk..",
      "....kkkkkkkk....",
      "................",
      "................",
    ],
  },

  // 7) 공작깃 전립 (16×16) — slate martial felt hat, crimson peak tassel, wide brim, sweeping peacock feather
  hat_hanbok_musa: {
    pal: {
      k: P.ink, m: P.kwaejaSh, M: P.kwaejaHi, g: P.gold, G: P.goldHi,
      r: P.daenggi, t: P.peacock, T: P.peacockHi,
    },
    rows: [
      "................",
      "......kk...kkk..",
      ".....krrk.ktTtk.",
      "....kkggkktTgtk.",
      "...kMMmmmkttk...",
      "..kMMmmmmmmmk...",
      "..kMmmgGgmmsk...",
      "..krrrrrrrrrk...",
      ".kkmmmmmmmmmmkk.",
      "kMMmmmmmmmmmmssk",
      ".kkkkkkkkkkkkkk.",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },

  // 8) 청철릭 쾌자 (16×16) — indigo sleeveless kwaeja over warm bronze cheollik sleeves, scarlet belt & pleated skirt
  top_hanbok_musa: {
    pal: {
      k: P.ink, b: P.kwaeja, B: P.kwaejaHi, d: P.kwaejaSh,
      o: P.terracotta, O: P.terraHi, s: P.terraSh,
      w: P.dongjeong, r: P.daenggi, g: P.gold,
    },
    rows: [
      "................",
      "....kkk..kkk....",
      "..kkObbwwbbOkk..",
      ".kOObbbwgbbbOOk.",
      ".kOobbbbgbbbbsk.",
      ".kOobbbbgbbbbsk.",
      "..kkbbbddbbbkk..",
      "...krrrrgrrrk...",
      "...kobbobbbok...",
      "...kobbobbbsk...",
      "...kobbobbbsk...",
      "...kssbsssssk...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................",
    ],
  },
};
