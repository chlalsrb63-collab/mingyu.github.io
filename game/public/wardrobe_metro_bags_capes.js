/**
 * Draft module for Metro Streetwear Expansion (메트로 스트리트 — 가방·망토 확장팩 4종)
 * Modern urban apparel: 2 distinct bags (cross-body sling, guitar gig-bag) + 2 distinct capes (trench cape, puffer muffler cape).
 * Zero wing pieces; emphasizes diverse everyday street silhouettes and crisp 64×64 layering.
 *
 * Integration Locations:
 *   1. `game/src/logic/65-cosmetics.js`
 *      - Reuse/add `metro: "메트로 스트리트"` in `COSMETIC_SETS`.
 *      - Append `METRO_EXPAND_COSMETICS` (recommended wire codes 127..130, or next free codes) to `COSMETICS`.
 *      - Run `npm run build:logic`.
 *   2. `game/public/wardrobe.js`
 *      - Merge `METRO_EXPAND_BACK` into `BACK` (add `"metroCrossSling"`, `"metroGuitarBag"` to `HARD_BACKS`).
 *      - Merge `METRO_EXPAND_BACK_FRONT` into `BACK_FRONT`.
 *      - Merge `METRO_EXPAND_BACK_ART` into `ART`.
 *   3. `game/public/art.js` / `asset/generated/metro-bags-capes/`
 *      - `METRO_EXPAND_ICONS` holds the 16×16 bag icon templates.
 */

export const METRO_EXPAND_COSMETICS = [
  { id: "back_metro_crosssling",   code: 127, slot: "back", name: "어반 크로스 슬링백",     set: "metro", shop: 4 },
  { id: "back_metro_guitarbag",    code: 128, slot: "back", name: "어반 기타 긱백",         set: "metro", shop: 5 },
  { id: "back_metro_trenchcape",   code: 129, slot: "back", name: "어반 트렌치 케이프",     set: "metro", shop: 5 },
  { id: "back_metro_pufferscarf",  code: 130, slot: "back", name: "어반 푸퍼 머플러 망토",  set: "metro", shop: 6 },
];

export const METRO_EXPAND_PALETTE = {
  // Olive Sage Tech Nylon (크로스 슬링백 세이지 그린)
  sage:      "#4e695c",
  sageHi:    "#709280",
  sageSh:    "#2f423a",
  // Matte Tech Black & Webbing Strap
  jet:       "#2b303c",
  jetHi:     "#485064",
  jetSh:     "#191c24",
  // Coral Carabiner & Accent Tag
  coral:     "#ff6648",
  coralHi:   "#ffa484",
  // Canvas Sand & Caramel Leather (기타 긱백)
  canvas:    "#d8ceb8",
  canvasHi:  "#f5efe2",
  canvasSh:  "#9c927e",
  leather:   "#9e633a",
  leatherSh: "#663c24",
  // Warm Camel Gabardine & Burgundy Lining (트렌치 케이프)
  camel:     "#c99b66",
  camelHi:   "#ebd0a4",
  camelSh:   "#8c633b",
  burgundy:  "#7d3240",
  burgundySh:"#4c1c28",
  // Dusty Teal-Mint Puffer & Cream Ribbed Knit (푸퍼 머플러 망토)
  puffer:    "#6ba6a2",
  pufferHi:  "#9cd4cf",
  pufferSh:  "#416d6c",
  cream:     "#f0e7d6",
  creamSh:   "#bfb4a0",
  indigo:    "#39486b",
  chrome:    "#dce2ee",
};

const P = METRO_EXPAND_PALETTE;
const sway = (A) => (A.f === 2 ? 1 : A.f === 4 ? -1 : 0);

// ───────────────────── 1. BACK DESIGNS (64×64 / 0.5 logical coordinates) ─────────────────────
export const METRO_EXPAND_BACK = {
  // 1) 가방 1: 어반 크로스 슬링백 (Asymmetrical diagonal sling pack tucked on lower-right back / waist)
  metroCrossSling: (b, A, p = P) => {
    const sw = sway(A);
    const y = A.bt;
    if (A.back) {
      // Diagonal jet-black webbing strap from left shoulder (11.5, y) to right hip (19.5, y+4)
      for (let i = 0; i < 6; i++) {
        b.r(12.0 + i * 1.2, y + i * 0.5, 1.5, 0.5, p.jet);
      }
      // Compact angled sling pouch across mid-to-lower back (`x = 13.5..20.5`)
      const px = 13.5 + sw * 0.4;
      const py = y + 1.0;
      b.r(px, py, 6.5, 3.0, p.sage);
      b.r(px, py, 6.5, 0.5, p.sageHi);
      b.r(px + 0.5, py + 2.5, 6.0, 0.5, p.sageSh);
      // Waterproof slanted zipper seam + coral quick-clip buckle + mini keychain charm
      b.r(px + 1.0, py + 1.0, 4.5, 0.5, p.jetSh);
      b.r(px + 5.0, py + 0.5, 1.0, 0.5, p.chrome);
      b.r(px + 1.5, py + 1.5, 1.0, 1.0, p.coral);
      b.r(px + 0.5, py + 3.0, 0.5, 1.0, p.coralHi);
      return;
    }
    if (A.side) {
      // Contoured sling pack resting snugly behind waist (`x = 7.0..11.5`) clear of curled tail
      const bx = 7.0 + sw * 0.25;
      const sy = y - 1.5;
      b.r(bx + 1.0, sy - 0.5, 2.5, 1.0, p.jet); // upper sling anchor strap
      b.r(bx, sy + 0.5, 4.5, 3.5, p.sage);
      b.r(bx, sy + 0.5, 1.0, 3.5, p.sageHi);
      b.r(bx, sy + 3.5, 4.5, 0.5, p.sageSh);
      b.r(bx + 1.5, sy + 1.5, 2.0, 0.5, p.jetSh);
      b.r(bx + 0.5, sy + 2.5, 1.0, 0.5, p.coral);
      return;
    }
    // Front view: subtle lower-right hip tail of the sling + left-shoulder strap crest
    b.r(10.5, y - 0.5, 1.5, 1.0, p.jet);
    b.r(19.5 + sw * 0.3, y + 1.5, 2.0, 2.0, p.sageSh);
    b.r(20.0 + sw * 0.3, y + 2.0, 1.0, 0.5, p.coral);
  },

  // 2) 가방 2: 어반 기타 긱백 (Diagonal canvas & caramel-leather guitar gig-bag with upper-right headstock)
  metroGuitarBag: (b, A, p = P) => {
    const sw = sway(A);
    const y = A.bt;
    const drawHeadAndNeck = (nx0, ny0, dx) => {
      // Diagonal neck climbing up-right into clear space (`y = A.bt - 7.5`)
      for (let i = 0; i <= 7; i++) {
        b.r(nx0 + dx * i * 0.45, ny0 - i * 0.9, 1.5, 1.0, p.jet);
        b.r(nx0 + dx * i * 0.45 + 0.5, ny0 - i * 0.9, 0.5, 1.0, p.leather);
      }
      // Caramel leather headstock + cream tuning pegs
      const hx = nx0 + dx * 3.4;
      const hy = ny0 - 7.5;
      b.r(hx, hy, 2.0, 2.0, p.leather);
      b.r(hx + 0.5, hy, 1.0, 0.5, p.camelHi);
      b.px(hx - 0.5, hy + 0.5, p.chrome);
      b.px(hx + 2.0, hy + 1.0, p.chrome);
    };

    if (A.back) {
      drawHeadAndNeck(18.5, y + 0.5, 1);
      // Rounded asymmetrical guitar gig-bag body (`x = 11.5..19.5`)
      const bx = 11.5 + sw * 0.35;
      b.r(bx + 1.5, y - 0.5, 5.0, 1.5, p.canvas);
      b.r(bx, y + 1.0, 8.0, 3.0, p.canvas);
      b.r(bx, y + 1.0, 8.0, 0.5, p.canvasHi);
      b.r(bx + 0.5, y + 3.5, 7.0, 1.0, p.canvasSh);
      // Center leather zipper pouch + burgundy street strap patch
      b.r(bx + 2.0, y + 1.5, 4.0, 1.5, p.leather);
      b.r(bx + 2.5, y + 2.0, 3.0, 0.5, p.leatherSh);
      b.r(bx + 1.0, y + 0.5, 1.0, 1.5, p.jet);
      b.r(bx + 5.5, y + 1.5, 1.0, 0.5, p.coral);
      return;
    }
    if (A.side) {
      // Behind shoulder climbing cleanly up-left clear of cheek/tail
      drawHeadAndNeck(9.0, y - 0.5, -0.6);
      const bx = 7.0 + sw * 0.25;
      b.r(bx + 0.5, y, 4.5, 4.0, p.canvas);
      b.r(bx, y + 1.0, 1.5, 2.5, p.leather);
      b.r(bx + 0.5, y + 3.5, 4.5, 0.5, p.canvasSh);
      b.r(bx + 2.0, y + 1.5, 1.0, 1.0, p.coral);
      return;
    }
    // Front view: neck & headstock clearly rising diagonally above the right shoulder
    drawHeadAndNeck(19.0, y - 0.5, 1);
    b.r(11.0, y + 1.5, 1.5, 2.5, p.canvasSh);
  },

  // 3) 망토 1: 어반 트렌치 케이프 (Camel tailored trench cape with belted waist, burgundy lining & center coat slit)
  metroTrenchCape: (b, A, p = P) => {
    const sw = sway(A);
    const stride = A.f !== 0 && A.f !== 3;
    const fl = stride ? 1.0 : 0;
    const y0 = A.bt;
    if (A.side) {
      const flare = stride ? -1.5 : 0;
      b.r(9.0, y0 - 1.5, 3.0, 1.5, p.camelHi); // popped storm collar
      b.r(7.5 + flare * 0.4, y0, 4.5 - flare * 0.4, 2.0, p.camel);
      b.r(8.0 + flare * 0.5, y0 + 1.5, 3.5, 0.5, p.leather); // side waist belt
      b.r(6.0 + flare, y0 + 2.0, 5.0 - flare * 0.5, 2.0, p.camel);
      b.r(6.0 + flare, y0 + 3.5, 4.5 - flare * 0.5, 0.5, p.burgundy); // burgundy lining glimpse
      return;
    }
    if (A.back) {
      // Tailored camel storm yoke + popped upper collar shadow
      b.r(11.0, y0 - 0.5, 10.0, 1.5, p.camelHi);
      b.r(11.5, y0 + 1.0, 9.0, 1.0, p.camel);
      // Horizontal waist belt + center metallic D-ring buckle
      b.r(11.0 + sw * 0.4, y0 + 1.5, 10.0, 0.5, p.leather);
      b.r(15.0 + sw * 0.4, y0 + 1.5, 2.0, 0.5, p.chrome);
      // Long split trench coat tails (`x=10..14.5` & `17.5..22`) parting cleanly at center for every tail
      b.r(10.0 + sw * 0.75 - fl, y0 + 2.0, 4.5 + fl * 0.5, 2.5, p.camel);
      b.r(17.5 + sw * 0.75 + fl * 0.5, y0 + 2.0, 4.5 + fl * 0.5, 2.5, p.camel);
      // Burgundy hem trim peeking underneath coat vent
      b.r(10.0 + sw * 0.75 - fl, y0 + 4.0, 4.5 + fl * 0.5, 0.5, p.burgundy);
      b.r(17.5 + sw * 0.75 + fl * 0.5, y0 + 4.0, 4.5 + fl * 0.5, 0.5, p.burgundy);
      b.r(14.5 + sw * 0.75, y0 + 2.0, 3.0, 0.5, p.camelSh);
      return;
    }
    // Front view: camel coat flaps beside the torso + subtle burgundy lining edge
    b.r(10.5 + sw * 0.4 - (stride ? 0.5 : 0), y0 + 1.0, 1.5, 3.5, p.camelSh);
    b.r(20.0 + sw * 0.4 + (stride ? 0.5 : 0), y0 + 1.0, 1.5, 3.5, p.camelSh);
    b.r(10.5 + sw * 0.4 - (stride ? 0.5 : 0), y0 + 4.0, 1.0, 0.5, p.burgundySh);
    b.r(20.5 + sw * 0.4 + (stride ? 0.5 : 0), y0 + 4.0, 1.0, 0.5, p.burgundySh);
  },

  // 4) 망토 2: 어반 푸퍼 머플러 망토 (Quilted puffer shoulder capelet + twin long striped scarf tails)
  metroPufferScarf: (b, A, p = P) => {
    const sw = sway(A);
    const stride = A.f !== 0 && A.f !== 3;
    const fl = stride ? 1.0 : 0;
    const y0 = A.bt;
    if (A.side) {
      const flare = stride ? -1.5 : 0;
      // Plush cream knit neck warmer + rounded 2-baffle dusty-mint puffer volume
      b.r(10.0, y0 - 1.5, 3.5, 1.5, p.cream);
      b.r(10.0, y0 - 1.5, 3.5, 0.5, p.canvasHi);
      b.r(8.5, y0, 4.5, 2.0, p.puffer);
      b.r(9.0, y0, 3.5, 0.5, p.pufferHi);
      b.r(8.5, y0 + 1.5, 4.5, 0.5, p.pufferSh);
      // Striped scarf tail streaming behind on walk stride
      b.r(6.5 + flare, y0 + 1.5, 3.5 - flare * 0.5, 1.5, p.indigo);
      b.r(7.5 + flare, y0 + 1.5, 1.0, 1.5, p.burgundy);
      b.r(6.0 + flare, y0 + 2.0, 0.5, 1.0, p.cream); // scarf fringe
      return;
    }
    if (A.back) {
      // Rounded quilted puffer capelet across upper back (`10.5..21.5`)
      b.r(11.5, y0 - 0.5, 9.0, 1.0, p.cream); // knit neck roll
      b.r(10.5, y0 + 0.5, 11.0, 2.0, p.puffer);
      b.r(11.0, y0 + 0.5, 10.0, 0.5, p.pufferHi);
      b.r(10.5, y0 + 1.5, 11.0, 0.5, p.pufferSh); // quilt baffle stitch line
      // Twin long knit muffler ends swaying cleanly left & right (`x=10.5..13` & `19..21.5`) — center wide open for tail
      b.r(10.5 + sw * 0.75 - fl, y0 + 2.5, 2.5, 2.0, p.indigo);
      b.r(10.5 + sw * 0.75 - fl, y0 + 3.0, 2.5, 0.5, p.burgundy);
      b.r(10.5 + sw * 0.75 - fl, y0 + 4.5, 2.0, 0.5, p.cream); // fringe
      b.r(19.0 + sw * 0.75 + fl, y0 + 2.5, 2.5, 2.0, p.indigo);
      b.r(19.0 + sw * 0.75 + fl, y0 + 3.5, 2.5, 0.5, p.burgundy);
      b.r(19.5 + sw * 0.75 + fl, y0 + 4.5, 2.0, 0.5, p.cream);
      return;
    }
    // Front view: puffy puffer shoulders peeking left & right
    b.r(10.5, y0, 1.5, 2.0, p.puffer);
    b.r(20.0, y0, 1.5, 2.0, p.puffer);
    b.r(10.5, y0 + 1.5, 1.5, 0.5, p.pufferSh);
    b.r(20.0, y0 + 1.5, 1.5, 0.5, p.pufferSh);
  },
};

export const METRO_EXPAND_BACK_FRONT = {
  metroCrossSling: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(14.5, y, 1.0, 3.0, p.jet);
      b.r(14.5, y + 1.0, 1.0, 0.5, p.coral);
      return;
    }
    // Single diagonal crossbody strap across chest + mini chest buckle + tiny tech pouch
    for (let i = 0; i < 6; i++) {
      b.r(12.5 + i * 1.1, y + i * 0.45, 1.5, 0.5, p.jet);
    }
    b.r(13.5, y + 0.5, 1.5, 1.0, p.jetHi);
    b.r(14.0, y + 0.5, 0.5, 0.5, p.coral); // orange chest buckle
  },
  metroGuitarBag: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(14.5, y, 1.0, 3.0, p.leatherSh);
      return;
    }
    // Soft leather padded shoulder straps + guitar pick badge
    b.r(12.5, y, 1.0, 3.0, p.leatherSh);
    b.r(18.5, y, 1.0, 3.0, p.leatherSh);
    b.r(18.5, y + 1.0, 1.0, 0.5, p.coral);
  },
  metroTrenchCape: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(13.5, y, 3.5, 1.0, p.camel);
      b.r(15.5, y + 0.5, 1.0, 0.5, p.jetSh);
      return;
    }
    // Tailored double-breasted trench lapel yoke + 4 dark tortoiseshell buttons
    b.r(12.0, y, 8.0, 1.0, p.camelHi);
    b.r(12.5, y + 1.0, 7.0, 1.5, p.camel);
    b.px(14.0, y + 1.0, p.jetSh);
    b.px(17.5, y + 1.0, p.jetSh);
    b.px(14.0, y + 2.0, p.jetSh);
    b.px(17.5, y + 2.0, p.jetSh);
    b.r(15.0, y + 1.0, 2.0, 0.5, p.burgundy);
  },
  metroPufferScarf: (b, A, p = P) => {
    const y = A.bt;
    if (A.side) {
      b.r(13.5, y - 0.5, 4.0, 1.5, p.cream);
      b.r(15.5, y + 1.0, 1.5, 1.5, p.indigo);
      b.r(15.5, y + 1.5, 1.5, 0.5, p.burgundy);
      return;
    }
    // Cozy ribbed cream neck warmer + single draped indigo/burgundy scarf end down front left
    b.r(12.0, y - 0.5, 8.0, 1.5, p.cream);
    b.r(12.5, y + 0.5, 7.0, 0.5, p.creamSh);
    b.r(13.0, y + 1.0, 2.0, 2.0, p.indigo);
    b.r(13.0, y + 1.5, 2.0, 0.5, p.burgundy);
    b.r(13.0, y + 3.0, 1.5, 0.5, p.cream); // tiny fringe
  },
};

export const METRO_EXPAND_BACK_ART = {
  back_metro_crosssling:  ["back", "metroCrossSling",  P],
  back_metro_guitarbag:   ["back", "metroGuitarBag",   P],
  back_metro_trenchcape:  ["back", "metroTrenchCape",  P],
  back_metro_pufferscarf: ["back", "metroPufferScarf", P],
};

// ───────────────────── 2. 16×16 BAG ICON TEMPLATES ─────────────────────
// Each 14×14 template renders at (1, 1) inside 16×16 with a 1px `#111118` outline.
export const METRO_EXPAND_ICONS = {
  back_metro_crosssling: {
    pal: {
      j: P.jet,
      k: P.jetHi,
      s: P.sage,
      l: P.sageHi,
      d: P.sageSh,
      c: P.coral,
      m: P.chrome,
    },
    rows: [
      "........jjj...",
      ".......jkkj...",
      "......jjjj....",
      ".....jjjll....",
      "....jjllsssd..",
      "...jjllsjsssd.",
      "..jjllssmjssd.",
      "..jllssjssssd.",
      "..jlccsssssd..",
      "...jssdddds...",
      "....ccdddd....",
      "..............",
      "..............",
      "..............",
    ],
  },
  back_metro_guitarbag: {
    pal: {
      w: P.canvas,
      h: P.canvasHi,
      d: P.canvasSh,
      l: P.leather,
      s: P.leatherSh,
      j: P.jet,
      c: P.coral,
      m: P.chrome,
    },
    rows: [
      ".........mll..",
      ".........lllm.",
      "........jjj...",
      ".......jjj....",
      "......jjj.....",
      "....hhwww.....",
      "...hhwwwwdd...",
      "..hwwlllwwd...",
      "..hwlssslwd...",
      ".hwcwwwwwwd...",
      ".hwwwwwwwd....",
      "..ddddddd.....",
      "..............",
      "..............",
    ],
  },
  back_metro_trenchcape: {
    pal: {
      c: P.camel,
      l: P.camelHi,
      s: P.camelSh,
      b: P.burgundy,
      r: P.leather,
      m: P.chrome,
      j: P.jetSh,
    },
    rows: [
      "....llllll....",
      "...llccccll...",
      "..lcjcccjccl..",
      "..lcccccccccl.",
      ".lccccjjccccl.",
      ".lrrrrrmrrrrs.",
      ".sccccccccccs.",
      "sccccs..sccccs",
      "sccccs..sccccs",
      "sbbbs....sbbbs",
      ".sss......sss.",
      "..............",
      "..............",
      "..............",
    ],
  },
  back_metro_pufferscarf: {
    pal: {
      w: P.cream,
      g: P.creamSh,
      p: P.puffer,
      h: P.pufferHi,
      d: P.pufferSh,
      i: P.indigo,
      b: P.burgundy,
    },
    rows: [
      "....wwwwww....",
      "...wwggggww...",
      "..hhppppppph..",
      ".hpppppppppph.",
      ".dddddddddddd.",
      "..hhppppppph..",
      "..iiii..iiii..",
      "..ibbi..iiii..",
      "..iiii..ibbi..",
      "..iiii..iiii..",
      "...ww....ww...",
      "..............",
      "..............",
      "..............",
    ],
  },
};
