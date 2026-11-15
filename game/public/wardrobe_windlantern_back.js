/**
 * Draft module for Wind-Lantern Airship Engine Crew (바람등호 기관반) — Step A: Back Pieces (등 외형 3종)
 *
 * Dependencies & Integration Locations:
 *   1. `game/src/logic/65-cosmetics.js`
 *      - Add `WINDLANTERN_SET` (`windlantern: "바람등호 기관반"`) to `COSMETIC_SETS`.
 *      - Append `WINDLANTERN_BACK_COSMETICS` (wire codes 121..123, or next free codes) to `COSMETICS`.
 *      - Run `npm run build:logic` to regenerate `game/src/logic.js`.
 *   2. `game/public/wardrobe.js` (native 64×64 renderer `scale = 2` where 0.5 logical unit = 1 native 64px dot)
 *      - Merge `WINDLANTERN_BACK` entries into `BACK` (and register keys in `HARD_BACKS` / `FEATHER_BACKS` as noted).
 *      - Merge `WINDLANTERN_BACK_FRONT` entries into `BACK_FRONT`.
 *      - Merge `WINDLANTERN_BACK_ART` entries into `ART`.
 *   3. `game/public/art.js` / `asset/generated/windlantern-back/`
 *      - `WINDLANTERN_BACK_ICONS` holds the 16×16 bag icon templates (also exported & verified in `asset/generated/windlantern-back/`).
 */

export const WINDLANTERN_SET = {
  windlantern: "바람등호 기관반",
};

export const WINDLANTERN_BACK_COSMETICS = [
  { id: "back_windlantern_boilerpack",  code: 121, slot: "back", name: "바람등호 압력공구 배낭", set: "windlantern", shop: 4 },
  { id: "back_windlantern_ashcape",     code: 122, slot: "back", name: "바람등호 방풍 불티망토", set: "windlantern", shop: 5 },
  { id: "back_windlantern_gliderwings", code: 123, slot: "back", name: "바람등호 돛날개",        set: "windlantern", shop: 6, boss: true },
];

export const WINDLANTERN_PALETTE = {
  // Scorched Iron & Engine Leather (그을린 철 · 먹색 가죽)
  iron:       "#423e4c",
  ironHi:     "#686376",
  ironSh:     "#25222d",
  // Boiler Brass & Copper (황동 · 적동 리벳)
  brass:      "#d89a38",
  brassSh:    "#98641e",
  brassHi:    "#f6cc68",
  // Sailcloth Ivory (바람돛 흰 천)
  sail:       "#eee6d4",
  sailSh:     "#b8ac98",
  // Wind-Lantern Amber Flame (금색 등불)
  amber:      "#ff9c2a",
  amberCore:  "#fff29c",
  // Outlines
  ink:        "#2b2233",
  iconInk:    "#111118",
};

const P = WINDLANTERN_PALETTE;
const sway = (A) => (A.f === 2 ? 1 : A.f === 4 ? -1 : 0);

// 64×64 half-pixel grid helper (`step = 0.5` logical units = 1 native pixel on a 64×64 frame)
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
//   - Add `"windlanternPack"` to `HARD_BACKS`
//   - Add `"windlanternWings"` to `FEATHER_BACKS` (or keep native grid64 shading directly)

// Left-wing 64×64 native templates (16×14 half-pixels = 8×7 logical units). Bottom-right attaches to torso shoulder.
const WING_REST_ROWS = [
  "................",
  "...........hhhbb",
  "........hhbbssss",
  "......hhbssssssi",
  ".....hbsssssssid",
  "....hbssssssiidd",
  "...hbssshssiidd.",
  "...bsssidssidd..",
  "...bsiid.siid...",
  "...baid...dd....",
  "...byd..........",
  "...dd...........",
  "................",
  "................",
];

const WING_STRIDE_ROWS = [
  ".bh.............",
  ".ybbhh..........",
  ".abbssssbh......",
  "..bsssssssbhh...",
  "..bssssssssssbh.",
  "..issssssiidsssb",
  "...dssssiiddsssb",
  "....dssiidd.idsb",
  ".....ddd.....idi",
  "..............dd",
  "................",
  "................",
  "................",
  "................",
];

export const WINDLANTERN_BACK = {
  // 1) 가방 1종: 바람등호 압력공구 배낭 (Boiler tank + amber gauge + protruding wrench + rolled sail tarp)
  windlanternPack: (b, A, p = P) => {
    const y = A.bt;
    const sw = sway(A) * 0.5;
    if (A.back) {
      // Top rolled sailcloth wind-tarp across upper shoulders (leaves head & neck clear)
      b.r(12.0, y - 1.5, 8.0, 1.5, p.sail);
      b.r(12.0, y - 0.5, 8.0, 0.5, p.sailSh);
      b.r(13.5, y - 1.5, 0.5, 1.5, p.ironSh);
      b.r(18.0, y - 1.5, 0.5, 1.5, p.ironSh);
      // Angled brass spanner wrench sticking up cleanly above the left shoulder
      b.r(10.5, y - 3.5, 2.0, 1.5, p.brassHi);
      b.r(11.0, y - 3.0, 0.5, 0.5, p.ironSh);
      b.r(11.5, y - 2.0, 1.0, 2.5, p.brass);
      // Main scorched-iron pack body (y .. y+4, keeps tail space below clear)
      b.r(12.0, y, 8.0, 4.0, p.iron);
      b.r(12.0, y + 3.5, 8.0, 0.5, p.ironSh);
      // Left tool pocket + brass rivet latch
      b.r(12.0, y + 0.5, 3.0, 3.0, p.ironHi);
      b.r(12.5, y + 1.5, 2.0, 1.5, p.ironSh);
      b.r(13.0, y + 1.0, 1.0, 0.5, p.brass);
      // Right pressurized wind-lantern gauge housing with warm amber core
      b.r(15.5, y + 0.5, 4.0, 3.0, p.brass);
      b.r(16.0, y + 1.0, 3.0, 2.0, p.ironSh);
      b.r(16.5, y + 1.0, 2.0, 1.5, p.amber);
      b.r(17.0, y + 1.5, 1.0, 0.5, p.amberCore);
      b.r(15.5, y + 0.5, 0.5, 0.5, p.brassHi);
      return;
    }
    if (A.side) {
      // Side profile: iron cylinder + brass lantern gauge on rear + rolled sail on top + wrench peeking up
      b.r(9.0, y - 1.5, 3.5, 1.5, p.sail);
      b.r(9.0, y - 0.5, 3.5, 0.5, p.sailSh);
      b.r(10.0, y - 3.5, 2.0, 1.5, p.brassHi);
      b.r(10.5, y - 3.0, 0.5, 0.5, p.ironSh);
      b.r(10.5, y - 2.0, 1.0, 2.0, p.brass);
      b.r(8.5, y, 4.0, 4.0, p.iron);
      b.r(8.5, y + 3.5, 4.0, 0.5, p.ironSh);
      b.r(8.5, y + 1.0, 3.0, 2.0, p.brass);
      b.r(9.0, y + 1.5, 2.0, 1.0, p.amber);
      b.r(9.5, y + 1.5, 0.5, 0.5, p.amberCore);
      return;
    }
    // Front view: protruding brass spanner head beside left shoulder + rolled sailcloth edge beside right shoulder
    b.r(9.5, y - 3.0 + sw, 2.0, 2.0, p.brassHi);
    b.r(10.0, y - 2.5 + sw, 0.5, 0.5, p.ironSh);
    b.r(10.5, y - 1.0 + sw, 1.5, 2.0, p.brass);
    b.r(19.5, y - 1.5 - sw, 2.5, 2.0, p.sail);
    b.r(19.5, y - 0.5 - sw, 2.5, 1.0, p.sailSh);
  },

  // 2) 망토 1종: 바람등호 방풍 불티망토 (Split swallow-cut storm cape keeping center/side tail clear)
  windlanternCape: (b, A, p = P) => {
    const sw = sway(A);
    const y0 = A.bt;
    if (A.side) {
      // Compact trailing storm mantle tucked cleanly at x=10..13.5 so rear tails remain legible
      const f = sw * 0.5;
      b.r(11.0, y0, 3.0, 1.5, p.sail);
      b.r(10.5, y0 + 1.5, 3.0, 1.5, p.iron);
      b.r(10.0 + f, y0 + 3.0, 3.0, 1.0, p.brass);
      b.r(10.0 + f, y0 + 4.0, 2.5, 0.5, p.ironSh);
      return;
    }
    if (A.back) {
      // Upper sailcloth mantle across shoulders
      b.r(11.5, y0, 9.0, 1.5, p.sail);
      b.r(11.5, y0 + 1.0, 9.0, 0.5, p.sailSh);
      // Two flared swallow-tail cape wings with clear center V-cutout (y0+2.5..y0+4.5) so tails read clearly
      b.r(11.0, y0 + 1.5, 10.0, 1.0, p.iron);
      b.r(10.5 + sw * 0.5, y0 + 2.5, 4.0, 1.5, p.iron);
      b.r(17.5 + sw * 0.5, y0 + 2.5, 4.0, 1.5, p.iron);
      b.r(14.5 + sw * 0.5, y0 + 2.5, 3.0, 0.5, p.ironSh);
      // Glowing brass/amber hem trim & wind-stripe on left wing
      b.r(10.5 + sw * 0.5, y0 + 4.0, 3.5, 0.5, p.brass);
      b.r(18.0 + sw * 0.5, y0 + 4.0, 3.5, 0.5, p.brassSh);
      b.r(11.5 + sw * 0.5, y0 + 1.5, 1.0, 2.5, p.amber);
      b.r(12.0 + sw * 0.5, y0 + 2.0, 0.5, 1.5, p.amberCore);
      return;
    }
    // Front view: dark storm cape edges peeking cleanly beside the flanks, swaying on step
    b.r(11.0 + sw * 0.5, y0 + 1.0, 1.5, 3.0, p.ironSh);
    b.r(19.5 + sw * 0.5, y0 + 1.0, 1.5, 3.0, p.ironSh);
    b.r(11.0 + sw * 0.5, y0 + 3.5, 1.0, 0.5, p.brassSh);
    b.r(20.0 + sw * 0.5, y0 + 3.5, 1.0, 0.5, p.brassSh);
  },

  // 3) 날개 1종: 바람등호 돛날개 (Folded downward at rest so head+tail stay clear; unfurled upward when walking)
  windlanternWings: (b, A, p = P) => {
    const rest = A.f === 0 || A.f === 3;
    const rows = rest ? WING_REST_ROWS : WING_STRIDE_ROWS;
    const pal = {
      i: p.iron,
      h: p.ironHi,
      d: p.ironSh,
      s: p.sail,
      b: p.brass,
      a: p.amber,
      y: p.amberCore,
    };
    const y = A.bt - (rest ? 2.0 : 4.5);
    if (A.side) {
      // Near glider wing trailing behind the back + far wing tip darker on the far shoulder
      grid64(b, 5.5, y, rows, pal, false);
      grid64(b, 18.5, y - 0.5, rows.slice(0, 8), { ...pal, s: p.sailSh, b: p.brassSh, i: p.ironSh }, true);
      b.r(12.0, A.bt, 1.5, 1.5, p.brass);
      return;
    }
    // Both front and back: wings rooted firmly on left & right shoulder blades (`11..13`, `19..21`)
    grid64(b, 5.0, y, rows, pal, false);
    grid64(b, 19.0, y, rows, pal, true);
    // Brass shoulder hinge brackets anchored onto the upper torso
    b.r(11.5, A.bt, 1.5, 1.5, p.brass);
    b.r(19.0, A.bt, 1.5, 1.5, p.brass);
    if (A.back) {
      b.r(13.0, A.bt + 0.5, 1.0, 1.0, p.ironSh);
      b.r(18.0, A.bt + 0.5, 1.0, 1.0, p.ironSh);
    }
  },
};

export const WINDLANTERN_BACK_FRONT = {
  windlanternPack: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(14.5, y, 1.0, 3.0, p.ironSh);
      b.r(14.5, y + 1.0, 0.5, 0.5, p.brass);
      return;
    }
    // Engine-leather shoulder straps + brass gauge clasp + amber whistle toggle
    b.r(13.0, y, 1.0, 3.0, p.ironSh);
    b.r(18.0, y, 1.0, 3.0, p.ironSh);
    b.r(13.0, y + 1.0, 1.0, 0.5, p.brass);
    b.r(18.0, y + 1.0, 1.0, 0.5, p.brass);
    b.r(13.5, y + 2.0, 0.5, 0.5, p.amber);
  },
  windlanternCape: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(13.5, y, 4.0, 1.0, p.sail);
      b.r(16.5, y, 1.0, 1.0, p.brass);
      return;
    }
    // Ivory sailcloth shoulder yoke + double brass boiler pin clasps
    b.r(12.5, y, 7.0, 1.0, p.sail);
    b.r(12.5, y + 0.5, 7.0, 0.5, p.sailSh);
    b.r(13.5, y, 1.0, 1.0, p.brass);
    b.r(17.5, y, 1.0, 1.0, p.brass);
    b.r(15.5, y + 0.5, 1.0, 0.5, p.ironSh);
  },
  windlanternWings: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(14.0, y, 1.5, 1.0, p.ironSh);
      b.r(14.5, y, 0.5, 0.5, p.brass);
      return;
    }
    // Slim shoulder harness locking the glider wing brackets
    b.r(12.5, y, 1.5, 1.0, p.ironSh);
    b.r(18.0, y, 1.5, 1.0, p.ironSh);
    b.r(13.0, y + 0.5, 0.5, 0.5, p.brass);
    b.r(18.5, y + 0.5, 0.5, 0.5, p.brass);
  },
};

export const WINDLANTERN_BACK_ART = {
  back_windlantern_boilerpack:  ["back", "windlanternPack",  P],
  back_windlantern_ashcape:     ["back", "windlanternCape",  P],
  back_windlantern_gliderwings: ["back", "windlanternWings", P],
};

// ───────────────────── 2. 16×16 BAG ICON TEMPLATES ─────────────────────
// Each 14×14 template paints at (1, 1) on 16×16 with 1px `#111118` outline.
export const WINDLANTERN_BACK_ICONS = {
  back_windlantern_boilerpack: {
    palette: {
      i: P.iron, h: P.ironHi, d: P.ironSh,
      b: P.brass, g: P.brassHi, a: P.brassSh,
      s: P.sail, w: P.sailSh,
      l: P.amber, y: P.amberCore,
    },
    rows: [
      "..gg..........",
      "..g.g.........",
      "...gb.ssssss..",
      "...gbsswwwwws.",
      "..ddiiiiiiiid.",
      ".diihibbbbiiid",
      ".dihidbllbdhid",
      ".diihdblybdhid",
      ".dihbdbbbbdhid",
      ".dihddaaaaddid",
      ".diihiiiiiihid",
      "..dddddddddd..",
      "..............",
      "..............",
    ],
  },
  back_windlantern_ashcape: {
    palette: {
      i: P.iron, h: P.ironHi, d: P.ironSh,
      b: P.brass, g: P.brassHi,
      s: P.sail, w: P.sailSh,
      l: P.amber, y: P.amberCore,
    },
    rows: [
      "..ss......ss..",
      ".ssswsssswsss.",
      ".sbwwdiiidwwbs",
      "..hhiiiiiiiih.",
      "..hlhiiiiiiih.",
      ".dhylhiiiiiiid",
      ".dhylhiiiiiihd",
      ".dhiihiiiiiihd",
      ".diiih...hiiid",
      "diiiid...diiid",
      "dgggdd...ddaad",
      "..............",
      "..............",
      "..............",
    ],
  },
  back_windlantern_gliderwings: {
    palette: {
      i: P.iron, h: P.ironHi, d: P.ironSh,
      b: P.brass, g: P.brassHi, a: P.brassSh,
      s: P.sail, w: P.sailSh,
      l: P.amber, y: P.amberCore,
    },
    rows: [
      "y............y",
      "lbhh......hhbl",
      ".lbsss..sssbl.",
      "..bssshhsssb..",
      "..isshbbhssi..",
      "..dssibbisssd.",
      "...dsiddidsd..",
      "...dsd..dsd...",
      "....d....d....",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
    ],
  },
};
