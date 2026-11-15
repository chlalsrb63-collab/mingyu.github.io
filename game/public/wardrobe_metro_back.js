/**
 * Draft module for Metro Streetwear (메트로 스트리트) — Step A: Back Pieces (등 외형 3종)
 * Modern urban streetwear apparel concept: roll-top commuter pack, reflective wind-cape, acrylic pop wings.
 *
 * Integration Locations:
 *   1. `game/src/logic/65-cosmetics.js`
 *      - Add `METRO_SET` (`metro: "메트로 스트리트"`) to `COSMETIC_SETS`.
 *      - Append `METRO_BACK_COSMETICS` (wire codes 124..126, or next free codes) to `COSMETICS`.
 *      - Run `npm run build:logic` to regenerate `game/src/logic.js`.
 *   2. `game/public/wardrobe.js` (native 64×64 renderer `scale = 2`, 0.5 logical step = 1 native pixel)
 *      - Merge `METRO_BACK` entries into `BACK` (register `"metroPack"` in `HARD_BACKS`, `"metroWings"` in `FEATHER_BACKS`).
 *      - Merge `METRO_BACK_FRONT` entries into `BACK_FRONT`.
 *      - Merge `METRO_BACK_ART` entries into `ART`.
 *   3. `game/public/art.js` / `asset/generated/metro-back/`
 *      - `METRO_BACK_ICONS` holds the 16×16 bag icon templates (exported & normalized via `import-art.mjs`).
 */

export const METRO_SET = {
  metro: "메트로 스트리트",
};

export const METRO_BACK_COSMETICS = [
  { id: "back_metro_rolltop",    code: 124, slot: "back", name: "메트로 롤톱 백팩",            set: "metro", shop: 4 },
  { id: "back_metro_windcape",   code: 125, slot: "back", name: "어반 리플렉티브 윈드케이프",  set: "metro", shop: 5 },
  { id: "back_metro_acrylwings", code: 126, slot: "back", name: "어반 아크릴 팝윙",          set: "metro", shop: 6, boss: true },
];

export const METRO_PALETTE = {
  // Charcoal Slate Ripstop Nylon (매트 차콜 · 네이비 나일론)
  navy:      "#354054",
  navyHi:    "#546480",
  navySh:    "#1e2532",
  // Stone Cream Gabardine (스톤 크림 개버딘)
  stone:     "#eae5db",
  stoneHi:   "#ffffff",
  stoneSh:   "#b4aea2",
  // Coral Street Tag & Strap Clip (네온 코랄 스트랩 · 스트리트 태그)
  coral:     "#ff6648",
  coralHi:   "#ffa484",
  coralSh:   "#b8362a",
  // Reflective Volt Lime Tape (리플렉티브 라임 안전 띠)
  volt:      "#c8f254",
  voltHi:    "#ecffb4",
  voltSh:    "#7da628",
  // Clear Sky Acrylic & Brushed Chrome (투명 하늘 아크릴 · 크롬 알루미늄)
  chrome:    "#d8e0ec",
  chromeSh:  "#8b96ae",
  acryl:     "#70dcff",
  acrylHi:   "#ddf8ff",
  acrylSh:   "#368cc2",
  // Outlines
  ink:       "#2b2233",
  iconInk:   "#111118",
};

const P = METRO_PALETTE;
const sway = (A) => (A.f === 2 ? 1 : A.f === 4 ? -1 : 0);

/** Write 0.5-logical-unit pixels onto a 64×64 canvas via wardrobe brush `b.r`. */
function grid64(b, x, y, rows, pal, flip = false) {
  rows.forEach((s, j) => {
    for (let i = 0; i < s.length; i++) {
      const col = pal[s[i]];
      if (col) b.r(flip ? x + (s.length - 1 - i) * 0.5 : x + i * 0.5, y + j * 0.5, 0.5, 0.5, col);
    }
  });
}

// ───────────────────── 1. BACK DESIGNS (64×64 / 0.5 logical coordinates) ─────────────────────
// Recommended wardrobe.js hints:
//   - Add `"metroPack"` to `HARD_BACKS`
//   - Add `"metroWings"` to `FEATHER_BACKS`

// Left-wing 64×64 native templates (16×15 half-pixels = 8×7.5 logical units). Bottom-right / mid-right mounts to shoulder.
const WING_REST_ROWS = [
  "................",
  "............hhmm",
  ".........hhmmaaa",
  ".......hhmaaahha",
  "......hmmaaahhad",
  ".....hmmaaahhad.",
  "....hmmaaaadd...",
  "....hmaad.ad....",
  "....maad..d.....",
  "....caad........",
  "....rcd.........",
  ".....d..........",
  "................",
  "................",
];

const WING_STRIDE_ROWS = [
  ".rm.............",
  ".rcmhh..........",
  ".haaaammmhh.....",
  "..haaaaaaammmhh.",
  "..daaaahaaaaaamm",
  "...ddaaahaaaaaam",
  "...rmmaaahaaaaad",
  "....caaddhadd...",
  "....rcd..dd.....",
  ".....d..........",
  "................",
  "................",
];

export const METRO_BACK = {
  // 1) 가방 1종: 메트로 롤톱 백팩 (Commuter roll-top pack with twin cobra straps, bottle pocket, volt reflector)
  metroPack: (b, A, p = P) => {
    const sw = sway(A);
    const y = A.bt - 1.5;
    const h = A.foot - y;
    if (A.back) {
      const bx = 12.0 + sw * 0.5;
      // Folded stone-cream roll-top collar peeking past neck line + top grab loop
      b.r(bx + 0.5, y - 1.0, 7.0, 2.0, p.stone);
      b.r(bx + 0.5, y - 1.0, 7.0, 0.5, p.stoneHi);
      b.r(bx + 0.5, y + 0.5, 7.0, 0.5, p.stoneSh);
      b.r(bx + 3.0, y - 1.5, 2.0, 0.5, p.navySh);
      // Main ripstop charcoal-navy pack body
      b.r(bx, y + 1.0, 8.0, h - 1.0, p.navy);
      b.r(bx, y + 1.0, 8.0, 0.5, p.navyHi);
      b.r(bx, y + h - 0.5, 8.0, 0.5, p.navySh);
      // Twin vertical cobra straps + coral release buckles
      b.r(bx + 1.5, y + 0.5, 1.0, h - 1.0, p.navySh);
      b.r(bx + 5.5, y + 0.5, 1.0, h - 1.0, p.navySh);
      b.r(bx + 1.5, y + 2.0, 1.0, 0.5, p.coral);
      b.r(bx + 5.5, y + 2.0, 1.0, 0.5, p.coral);
      // Horizontal front zip pocket & lime-volt reflective strip at bottom
      b.r(bx + 2.5, y + 3.0, 3.0, 0.5, p.stoneSh);
      b.r(bx + 2.5, y + h - 1.5, 3.0, 0.5, p.volt);
      b.r(bx + 3.0, y + h - 1.5, 2.0, 0.5, p.voltHi);
      // Right-side insulated commuter tumbler bottle in mesh pocket
      b.r(bx + 8.0, y + 2.0, 1.5, 2.5, p.stoneSh);
      b.r(bx + 8.0, y + 1.5, 1.5, 0.5, p.chrome);
      b.r(bx + 8.0, y + 3.5, 1.5, 1.0, p.navySh);
      return;
    }
    if (A.side) {
      // Shifted slightly back behind torso & taller roll-top so pack reads clearly above/behind tail
      const bx = 6.5 + sw * 0.25;
      const sy = A.bt - 3.0;
      const sh = A.foot - sy - 0.5;
      b.r(bx + 0.5, sy, 4.5, 2.0, p.stone);
      b.r(bx + 0.5, sy, 4.5, 0.5, p.stoneHi);
      b.r(bx + 2.0, sy - 0.5, 1.5, 0.5, p.navySh);
      b.r(bx, sy + 2.0, 5.0, sh - 2.0, p.navy);
      b.r(bx, sy + 2.0, 1.0, sh - 2.0, p.navyHi);
      b.r(bx, sy + sh - 0.5, 5.0, 0.5, p.navySh);
      // Side buckle & reflective bottom patch
      b.r(bx + 1.0, sy + 2.5, 1.5, 0.5, p.coral);
      b.r(bx + 0.5, sy + sh - 1.5, 2.0, 0.5, p.volt);
      return;
    }
    // Front view: stone roll-top edge peeking cleanly beside shoulder corners (`BACK_FRONT` draws chest harness)
    b.r(11.0, A.bt - 1.5, 10.0, 1.5, p.stone);
    b.r(11.0, A.bt - 1.5, 10.0, 0.5, p.stoneHi);
    b.r(11.5, A.bt - 0.5, 9.0, 0.5, p.navySh);
  },

  // 2) 망토 1종: 어반 리플렉티브 윈드케이프 (Sporty trench/anorak wind-cape with V-tail slit & volt hem tape)
  metroWindCape: (b, A, p = P) => {
    const sw = sway(A);
    const stride = A.f !== 0 && A.f !== 3;
    const y0 = A.bt;
    if (A.side) {
      // High collar behind neck + swept wind-cape trailing behind back (`x=7..12.5`) clear of torso
      const flare = stride ? -1.5 : 0;
      b.r(9.5, y0 - 1.5, 3.0, 2.0, p.stone);
      b.r(9.5, y0 - 1.5, 3.0, 0.5, p.stoneHi);
      b.r(8.0 + flare * 0.4, y0 + 0.5, 4.5 - flare * 0.4, 2.0, p.navy);
      b.r(7.0 + flare, y0 + 2.5, 4.5 - flare * 0.5, 1.5, p.navy);
      b.r(7.0 + flare, y0 + 3.5, 4.0 - flare * 0.5, 0.5, p.volt);
      b.r(7.5 + flare, y0 + 2.5, 1.0, 0.5, p.coral);
      return;
    }
    if (A.back) {
      // Shoulder stone storm-flap yoke (`11.0..21.0`)
      b.r(11.0, y0, 10.0, 1.5, p.stone);
      b.r(11.0, y0, 10.0, 0.5, p.stoneHi);
      b.r(11.5, y0 + 1.0, 9.0, 0.5, p.stoneSh);
      // Main navy technical shell flaring wider on walk strides, split cleanly down the center (`15..17`)
      // so every species' tail sits clearly inside the vent without clipping
      const fl = stride ? 1.0 : 0;
      b.r(10.5 + sw * 0.5 - fl * 0.5, y0 + 1.5, 11.0 + fl, 1.5, p.navy);
      b.r(10.0 + sw * 0.75 - fl, y0 + 3.0, 4.5 + fl * 0.5, 2.0, p.navy);
      b.r(17.5 + sw * 0.75 + fl * 0.5, y0 + 3.0, 4.5 + fl * 0.5, 2.0, p.navy);
      b.r(14.5 + sw * 0.75, y0 + 2.5, 3.0, 0.5, p.navySh); // upper bridge above V-vent
      // Reflective lime safety tape along split trailing hems + street coral patch
      b.r(10.0 + sw * 0.75 - fl, y0 + 4.5, 4.5 + fl * 0.5, 0.5, p.volt);
      b.r(17.5 + sw * 0.75 + fl * 0.5, y0 + 4.5, 4.5 + fl * 0.5, 0.5, p.volt);
      b.r(10.5 + sw * 0.75 - fl, y0 + 3.5, 1.5, 0.5, p.coral);
      return;
    }
    // Front view: flared navy-and-volt wind-cape hems peeking cleanly beside the flanks
    b.r(10.5 + sw * 0.5 - (stride ? 0.5 : 0), y0 + 1.0, 1.5, 3.5, p.navySh);
    b.r(20.0 + sw * 0.5 + (stride ? 0.5 : 0), y0 + 1.0, 1.5, 3.5, p.navySh);
    b.r(10.5 + sw * 0.5 - (stride ? 0.5 : 0), y0 + 4.0, 1.5, 0.5, p.voltSh);
    b.r(20.0 + sw * 0.5 + (stride ? 0.5 : 0), y0 + 4.0, 1.5, 0.5, p.voltSh);
  },

  // 3) 날개 1종: 어반 아크릴 팝윙 (Folded cleanly downward at rest; fanned chrome-and-acrylic blades on walk)
  metroWings: (b, A, p = P) => {
    const rest = A.f === 0 || A.f === 3;
    const rows = rest ? WING_REST_ROWS : WING_STRIDE_ROWS;
    const pal = {
      m: p.chrome,
      d: p.chromeSh,
      a: p.acryl,
      h: p.acrylHi,
      c: p.acrylSh,
      r: p.coral,
    };
    const y = A.bt - (rest ? 1.5 : 4.0);
    if (A.side) {
      // Shift wing root cleanly behind torso (`x = 4.5`, raised slightly at rest so tail never hides it)
      const sy = A.bt - (rest ? 3.0 : 4.5);
      grid64(b, 4.5, sy, rows, pal, false);
      grid64(b, 18.0, sy - 0.5, rows.slice(0, 8), { ...pal, a: p.acrylSh, h: p.acryl, m: p.chromeSh, r: p.coralSh }, true);
      b.r(11.5, A.bt - 0.5, 1.5, 1.5, p.navySh);
      b.r(11.5, A.bt, 1.0, 0.5, p.volt);
      return;
    }
    // Rooted symmetrically on left & right shoulders (`11.5..13.0`, `19.0..20.5`), leaving back head & tail clear
    grid64(b, 5.0, y, rows, pal, false);
    grid64(b, 19.0, y, rows, pal, true);
    b.r(11.5, A.bt, 1.5, 1.5, p.navySh);
    b.r(19.0, A.bt, 1.5, 1.5, p.navySh);
    b.r(12.0, A.bt + 0.5, 0.5, 0.5, p.volt);
    b.r(19.5, A.bt + 0.5, 0.5, 0.5, p.volt);
  },
};

export const METRO_BACK_FRONT = {
  metroPack: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(14.5, y, 1.0, 3.0, p.navySh);
      b.r(14.5, y + 1.5, 1.0, 0.5, p.coral);
      return;
    }
    // Commuter padded shoulder straps + horizontal chest sternum strap with coral buckle
    b.r(12.5, y, 1.5, 3.0, p.navySh);
    b.r(18.0, y, 1.5, 3.0, p.navySh);
    b.r(14.0, y + 1.5, 4.0, 0.5, p.navy);
    b.r(15.5, y + 1.5, 1.0, 0.5, p.coral);
  },
  metroWindCape: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(13.5, y, 4.0, 1.0, p.stone);
      b.r(16.0, y + 0.5, 1.5, 0.5, p.volt);
      return;
    }
    // High-neck urban collar yoke + zipper pull & neon volt chest snaps
    b.r(12.0, y, 8.0, 1.0, p.stone);
    b.r(12.0, y + 0.5, 8.0, 0.5, p.stoneSh);
    b.r(15.5, y, 1.0, 1.5, p.navySh);
    b.r(13.5, y + 0.5, 0.5, 0.5, p.volt);
    b.r(18.0, y + 0.5, 0.5, 0.5, p.volt);
  },
  metroWings: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(14.5, y, 1.0, 1.5, p.navySh);
      b.r(14.5, y + 0.5, 0.5, 0.5, p.chrome);
      return;
    }
    // Lightweight cyber-harness shoulder clips
    b.r(12.5, y, 1.5, 1.0, p.navySh);
    b.r(18.0, y, 1.5, 1.0, p.navySh);
    b.r(13.0, y + 0.5, 0.5, 0.5, p.volt);
    b.r(18.5, y + 0.5, 0.5, 0.5, p.volt);
  },
};

export const METRO_BACK_ART = {
  back_metro_rolltop:    ["back", "metroPack",     P],
  back_metro_windcape:   ["back", "metroWindCape", P],
  back_metro_acrylwings: ["back", "metroWings",    P],
};

// ───────────────────── 2. 16×16 BAG ICON TEMPLATES ─────────────────────
// Each 14×14 template renders at (1, 1) inside 16×16 with a 1px `#111118` outline.
export const METRO_BACK_ICONS = {
  back_metro_rolltop: {
    pal: {
      w: P.stone,
      l: P.stoneHi,
      g: P.stoneSh,
      n: P.navy,
      h: P.navyHi,
      d: P.navySh,
      c: P.coral,
      v: P.volt,
      m: P.chrome,
    },
    rows: [
      "....dddddd....",
      "...llllllll...",
      "...wwwwwwww...",
      "..dnnddddnnd..",
      "..dhhnnnnhhd..",
      "..dnnddddnnd..",
      "..dcndnnndcdm.",
      "..dnnngggnddg.",
      "..dnnnnnnnndg.",
      "..dnndvvvdnd..",
      "..dnnnnnnnnd..",
      "..dddddddddd..",
      "..............",
      "..............",
    ],
  },
  back_metro_windcape: {
    pal: {
      w: P.stone,
      l: P.stoneHi,
      g: P.stoneSh,
      n: P.navy,
      h: P.navyHi,
      d: P.navySh,
      v: P.volt,
      y: P.voltHi,
      c: P.coral,
    },
    rows: [
      "....llllll....",
      "...lwwwwwwl...",
      "..ggddwwddgg..",
      "..nhhnddnhhn..",
      ".dnhnnnnnnhnd.",
      ".dnnncnnnnnnd.",
      ".dnnnnnnnnnnd.",
      "dnnnnd..dnnnnd",
      "dnnnd....dnnnd",
      "dyvvd....dvvyd",
      ".ddd......ddd.",
      "..............",
      "..............",
      "..............",
    ],
  },
  back_metro_acrylwings: {
    pal: {
      m: P.chrome,
      s: P.chromeSh,
      a: P.acryl,
      h: P.acrylHi,
      c: P.acrylSh,
      r: P.coral,
      v: P.volt,
      d: P.navySh,
    },
    rows: [
      "rm..........mr",
      "hmh........hmh",
      "haamh....hmaah",
      "dhaaaaddaaaahd",
      ".daaaadvaaaad.",
      ".dcaahddhaacd.",
      "..dccd..dccd..",
      "..rcaa..aacr..",
      "...da....ad...",
      "....c....c....",
      "..............",
      "..............",
      "..............",
      "..............",
    ],
  },
};
