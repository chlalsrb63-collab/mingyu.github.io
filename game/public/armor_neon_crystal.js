/**
 * Draft module for Batch 2: 방어구 아이콘 6종 (잿빛 네온시티 수리반 · 수정굴 탐사대)
 *
 * Dependencies & Integration Locations:
 *   1. `game/src/logic/10-tables.js`
 *      - Register set definitions / unique armor item rows if adding themed drops or craftable sets
 *        (e.g., `h_neon_repair`, `a_neon_repair`, `b_neon_repair`, `h_crystal_delver`, `a_crystal_delver`, `b_crystal_delver`).
 *      - Run `npm run build:logic` to regenerate `game/src/logic.js`.
 *   2. `game/public/art.js`
 *      - Import `NEON_CRYSTAL_ARMOR_ART` / `renderNeonCrystalArmorIcon` (or copy the `rows` and `palette`
 *        entries into `art.js`).
 *      - In `buildIcons(items)`, look up `NEON_CRYSTAL_ARMOR_ART[id]` (or `it.art`) before falling back to generic tier icons
 *        (`helmIcon`, `armorIcon`, `bootsIcon`), painting at offset `(1, 1)` on a 16×16 canvas with 1px `#111118` outline.
 *   3. `asset/generated/neon-crystal/`
 *      - Normalized 16×16 PNG icon drafts + `.prompt.md` files (ready for owner approval before `--install`).
 */

export const NEON_CRYSTAL_THEMES = {
  neon_repair:    "잿빛 네온시티 수리반",
  crystal_delver: "수정굴 탐사대",
};

export const NEON_CRYSTAL_ITEMS = [
  {
    id: "h_neon_repair",
    name: "수리반 용접 바이저",
    slot: "helm",
    theme: "neon_repair",
    themeKo: "잿빛 네온시티 수리반",
    dropOrShop: "잿빛 네온시티 잡화/방어구 상점(골드) 또는 수리반 몬스터 드랍·고철 분해 제작",
  },
  {
    id: "a_neon_repair",
    name: "수리반 철판 가죽 작업복",
    slot: "armor",
    theme: "neon_repair",
    themeKo: "잿빛 네온시티 수리반",
    dropOrShop: "잿빛 네온시티 방어구 상점(골드) 또는 정비구역 정예 드랍",
  },
  {
    id: "b_neon_repair",
    name: "수리반 강철 앞코 작업화",
    slot: "boots",
    theme: "neon_repair",
    themeKo: "잿빛 네온시티 수리반",
    dropOrShop: "잿빛 네온시티 방어구 상점(골드) 또는 수리반 일반 몬스터 드랍",
  },
  {
    id: "h_crystal_delver",
    name: "수정굴 각면 탐사 투구",
    slot: "helm",
    theme: "crystal_delver",
    themeKo: "수정굴 탐사대",
    dropOrShop: "수정굴 던전 필드 보스/정예 드랍 또는 수정 광석 연마 제작",
  },
  {
    id: "a_crystal_delver",
    name: "수정굴 결정판 흉갑",
    slot: "armor",
    theme: "crystal_delver",
    themeKo: "수정굴 탐사대",
    dropOrShop: "수정굴 던전 보스 드랍 또는 수정굴 탐사대 공적 교환",
  },
  {
    id: "b_crystal_delver",
    name: "수정굴 아이젠 탐사 장화",
    slot: "boots",
    theme: "crystal_delver",
    themeKo: "수정굴 탐사대",
    dropOrShop: "수정굴 던전 일반/정예 몬스터 드랍 또는 수정 광석 제작",
  },
];

export const NEON_REPAIR_PALETTE = {
  H: "#cfd6e0", // Steel plate highlight
  M: "#838d9c", // Steel plate mid
  S: "#4c5464", // Steel plate shadow
  D: "#2a2e3a", // Dark visor recess / rubber tread
  L: "#b87a48", // Work leather light
  B: "#7d4b28", // Work leather shadow
  C: "#6c707a", // Ash canvas cloth
  A: "#ffaa30", // Neon amber visor / worklamp
  Y: "#fff098", // Amber glare highlight
};

export const CRYSTAL_DELVER_PALETTE = {
  P: "#8a78c8", // Mineral slate-violet highlight
  V: "#52448a", // Mineral slate-violet mid
  D: "#2c2254", // Deep mineral shadow
  C: "#aefafa", // Crystal quartz highlight
  T: "#44c2cc", // Crystal teal mid
  Q: "#1f7a8c", // Crystal teal shadow
  L: "#c49464", // Expedition leather light
  B: "#7a5234", // Expedition leather shadow
  G: "#f0cc68", // Brass/gold clasp
};

// Each 14×14 pixel map paints at (1, 1) inside a 16×16 canvas and receives a 1px `#111118` outline.
export const NEON_CRYSTAL_ARMOR_ART = {
  // 1. 잿빛 네온시티 수리반 (Ash Neon City Repair Crew)
  h_neon_repair: {
    slot: "helm",
    theme: "neon_repair",
    outline: "#111118",
    palette: NEON_REPAIR_PALETTE,
    rows: [
      "..............",
      "....HHHHMM....",
      "...HHMMMMMS...",
      "..HHMMMMMMMS..",
      "..HDDDDDDDDMS.",
      ".BHDYYYYYYDMS.",
      "LBBDAAAAAADMS.",
      "LBBMMMMMMMMMS.",
      "LBBMMDDDDDMMS.",
      ".BBMMSSSSSMMS.",
      "..BMMSSSSSSS..",
      "...BSSSSSSS...",
      "..............",
      "..............",
    ],
  },
  a_neon_repair: {
    slot: "armor",
    theme: "neon_repair",
    outline: "#111118",
    palette: NEON_REPAIR_PALETTE,
    rows: [
      "..............",
      ".HHH.....CCC..",
      "HHMMMC..CCCCS.",
      "HMSSMMCCLLLLS.",
      "SSSSLLMBBLLSS.",
      ".CCLLBBMMMMSS.",
      ".CCLBBAAMMMSS.",
      ".CCBBAYAMMMSS.",
      "..DLLBBBBBBSS.",
      "..BLLLLLLLLBS.",
      "..LLLLBBBSSSS.",
      "..BBBBBBBSSSS.",
      "..BBBB........",
      "..............",
    ],
  },
  b_neon_repair: {
    slot: "boots",
    theme: "neon_repair",
    outline: "#111118",
    palette: NEON_REPAIR_PALETTE,
    rows: [
      "..............",
      "..............",
      "..LLLLLBB.....",
      "..LMMMMBB.....",
      "..BBBBBBB.....",
      "...BLLBBS.....",
      "...BMMAAS.....",
      "...BLLBBS.....",
      "...BLLBBHHHH..",
      "...BBLLHHMMMS.",
      "...BBBMHMMMSS.",
      "...DDDDDDDDDS.",
      "...DDD.DDDDDD.",
      "..............",
    ],
  },

  // 2. 수정굴 탐사대 (Crystal Cavern Expedition)
  h_crystal_delver: {
    slot: "helm",
    theme: "crystal_delver",
    outline: "#111118",
    palette: CRYSTAL_DELVER_PALETTE,
    rows: [
      ".....PPPP.....",
      "...PPPPVVV....",
      "..PPVVVVVVVC..",
      "..PVVVVVVCCCC.",
      ".LPVVVDDDDCTT.",
      ".LPDDDDDDDCQQ.",
      ".LBVDDDDDDVV..",
      ".LBVVDDDDLVV..",
      ".LBBLLLLLBV...",
      "..BBGGGGGB....",
      "...BBBBBB.....",
      "..............",
      "..............",
      "..............",
    ],
  },
  a_crystal_delver: {
    slot: "armor",
    theme: "crystal_delver",
    outline: "#111118",
    palette: CRYSTAL_DELVER_PALETTE,
    rows: [
      "..............",
      ".PP........VV.",
      "PPPV......VVVD",
      "PVVVLL..LLVVDD",
      ".PVVLCCCCLVDD.",
      "..BVLCTTTLVB..",
      "..BVLCCTTQVB..",
      "..PVVQTTQQVD..",
      "...PVGGGGVD...",
      "...BVLLLLVD...",
      "....PVVVVD....",
      ".....PVVD.....",
      "......VD......",
      "..............",
    ],
  },
  b_crystal_delver: {
    slot: "boots",
    theme: "crystal_delver",
    outline: "#111118",
    palette: CRYSTAL_DELVER_PALETTE,
    rows: [
      "..............",
      "...LLLLL......",
      "...LBBBBP.....",
      "....BBBBV.....",
      "....PVVVV.....",
      "....PVVGV.....",
      "....LLVVD.....",
      "...BLLVVVV....",
      "...BBPVVVVVC..",
      "...DDPVVVVCCT.",
      "...DDDVVVVTTTQ",
      "...CC.CC...CC.",
      "...T...T....Q.",
      "..............",
    ],
  },
};

/**
 * Helper compatible with `game/public/art.js` `canvas(16, 16)` + `paint` + `outline`.
 * @param {string} id
 * @param {() => HTMLCanvasElement} [makeCanvas]
 */
export function renderNeonCrystalArmorIcon(id, makeCanvas) {
  const spec = NEON_CRYSTAL_ARMOR_ART[id];
  if (!spec) return null;
  const c = makeCanvas ? makeCanvas() : document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const { rows, palette, outline: outCol } = spec;
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const col = palette[r[x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(1 + x, 1 + y, 1, 1);
      }
    }
  }
  const src = g.getImageData(0, 0, 16, 16).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && src[(y * 16 + x) * 4 + 3] > 0;
  g.fillStyle = outCol || "#111118";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}
