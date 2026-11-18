/**
 * 마도서 외형 컬렉션 (Arcane Spellbooks Collection — 10 Designs).
 *
 * Code-drawn Tales Tales `book` geometry (`R`/`P`/`C`/`L`/`D` centered around `[16, 16]` upright,
 * spine on left, creamy bottom page edge, golden corner brackets & hanging bookmark ribbon)
 * inspired by the 10-badge spellbook grimoire reference set:
 *   1. 해일 비술 마도서 (`azuretide`)
 *   2. 태양륜 화염 마도서 (`sunember`)
 *   3. 월식 암흑 마도서 (`eclipsevoid`)
 *   4. 홍옥 봉인 마도서 (`crimsonseal`)
 *   5. 초승달 비취 마도서 (`lunarjade`)
 *   6. 장미 성혈 마도서 (`heartblood`)
 *   7. 대장간 룬문자 마도서 (`runeforge`)
 *   8. 성좌 양피지 법전 (`holyparchment`)
 *   9. 홍련 불꽃 마도서 (`emberflower`)
 *  10. 비전 자수정 눈 마도서 (`arcaneeye`)
 *
 * Compatible with `game/public/weapons.js` rasterizer (`W=32, H=32, ox=16, oy=16`,
 * upright `16×16` bag icon via `book` branch). Zero `src/logic.js` / `weapons.js` files modified.
 *
 * Integration Locations:
 *   1. `game/public/weapons.js`
 *      - Merge `BOOK_COLLECTION_M` into `M` (`BOOK_COLLECTION_EXTRA` into `EXTRA`).
 *      - Register `BOOK_SILHOUETTES` under `SIL.book`.
 *      - Add `MOTIF_SIL.book.<motif>` entries + motifs into `MOTIF`.
 *   2. `game/src/logic/65-cosmetics.js`
 *      - Append `BOOK_COLLECTION_META` (`ws_book_*`, `slot: "wskin"`, `wk: "book"`).
 *   3. `game/public/art.js` / `asset/generated/spellbooks/`
 *      - Normalized 16×16 bag icons (`icon_ws_book_*.png`) ready after owner approval.
 */

const INK = "#2b2233";
const RARE_INK = [INK, "#2c4a8c", "#8a6a14", "#9a4a12", "#1f6a3a"];
const ICON_INK = "#111118";
const GLOW7 = "#fff2a8";
const GLOW10 = "#ffd84a";

const R = (s0, s1, t0, t1, m, o) => ({ k: "p", pts: [[s0, t0], [s1, t0], [s1, t1], [s0, t1]], m, ...o });
const P = (pts, m, o) => ({ k: "p", pts, m, ...o });
const C = (s, t, r, m, o) => ({ k: "c", s, t, r, m, ...o });
const L = (s0, t0, s1, t1, m, o) => ({ k: "l", a: [s0, t0], b: [s1, t1], m, top: true, ...o });
const D = (s, t, m, o) => ({ k: "d", s, t, m, top: true, ...o });

// ───────────────────────────── 1. PALETTE / MATERIALS ─────────────────────────────
export const BOOK_COLLECTION_M = {
  sapphire:   ["#58b8eb", "#1d5d96", "#102e5e"],
  aquaRune:   ["#8cf7ff", "#249ec4", "#125478"],
  crimson:    ["#ff7c70", "#d42b38", "#7a1426"],
  rustRed:    ["#e66c50", "#9e2f2b", "#591820"],
  midnight:   ["#6369a8", "#23254a", "#14142b"],
  violet:     ["#c788ff", "#7b3ee0", "#3f1c80"],
  emerald:    ["#5cd69a", "#187a62", "#0c423b"],
  mahogany:   ["#b86e54", "#6e322a", "#3d1a1e"],
  parchment:  ["#fff9ea", "#ebd7b7", "#b5987c"],
  page:       ["#fff8ea", "#e8d2b8", "#a88a7a"],
  gold:       ["#fff09e", "#f0b844", "#a06420"],
  amber:      ["#ffd478", "#f07c24", "#9e361c"],
  pearl:      ["#ffffff", "#d9e2f2", "#8e9ab8"],
  ribbonBlue: ["#84a8ff", "#3e58b8", "#222c6e"],
  ribbonRed:  ["#ff6b6b", "#c92434", "#701424"],
};

export const BOOK_COLLECTION_EXTRA = {
  glint: "#ffffff",
  spark: "#fff4a0",
  ruby:  "#ff4860",
  core:  "#e8ffff",
};

// ───────────────────────────── 2. ITEM METADATA ─────────────────────────────
export const BOOK_COLLECTION_META = [
  { id: "ws_book_azuretide",     silKey: "azuretide",     wk: "book", slot: "wskin", name: "해일 비술 마도서",   desc: "푸른 심해 가죽 표지에 바다 문양과 진주 보주가 새겨진 마도서." },
  { id: "ws_book_sunember",      silKey: "sunember",      wk: "book", slot: "wskin", name: "태양륜 화염 마도서", desc: "타오르는 팔각 태양 문양과 주홍빛 불꽃핵이 박힌 적갈색 마도서." },
  { id: "ws_book_eclipsevoid",   silKey: "eclipsevoid",   wk: "book", slot: "wskin", name: "월식 암흑 마도서",   desc: "보라빛 성운 고리 중심에 황금 십자별 성검 인장이 새겨진 비전서." },
  { id: "ws_book_crimsonseal",   silKey: "crimsonseal",   wk: "book", slot: "wskin", name: "홍옥 봉인 마도서",   desc: "금박 모서리와 빛나는 마름모 성석 봉인이 걸린 왕실 진홍 마도서." },
  { id: "ws_book_lunarjade",     silKey: "lunarjade",     wk: "book", slot: "wskin", name: "초승달 비취 마도서", desc: "비취빛 표지 위에 황금 초승달과 북극성이 떠오른 숲의 마도서." },
  { id: "ws_book_heartblood",    silKey: "heartblood",    wk: "book", slot: "wskin", name: "장미 성혈 마도서",   desc: "화려한 황금 성배 문장과 붉은 보석이 장식된 장미빛 고서." },
  { id: "ws_book_runeforge",     silKey: "runeforge",     wk: "book", slot: "wskin", name: "대장간 룬문자 마도서", desc: "고목 가죽 위에 X자 황금 룬 격자와 붉은 인장이 잠긴 고대 서적." },
  { id: "ws_book_holyparchment", silKey: "holyparchment", wk: "book", slot: "wskin", name: "성좌 양피지 법전",   desc: "순백 양피지 표지에 진홍빛 오망성 문양이 그려진 신성 법전." },
  { id: "ws_book_emberflower",   silKey: "emberflower",   wk: "book", slot: "wskin", name: "홍련 불꽃 마도서",   desc: "암적색 표지 한가운데 황금 불꽃 꽃송이가 활짝 핀 화염 서적." },
  { id: "ws_book_arcaneeye",     silKey: "arcaneeye",     wk: "book", slot: "wskin", name: "비전 자수정 눈 마도서", desc: "보랏빛 표지 속에서 신비로운 자수정 진실의 눈이 떠진 마도서." },
];

// Helper: Sleek compact pocket grimoire body (`s in [-4.5..4.5]`, `t in [-5.2..5.4]` -> clean 9×11 px, crisp 1:1 icon!)
function tomeBase(coverMat, spineMat, cornerMat, ribbonMat, ribbonX = -2.6) {
  return [
    R(-3.2, 4.5, -5.2, 3.6, coverMat),
    R(-3.2, 4.0, 3.4, 4.5, "page"),
    R(-3.2, 4.5, 4.4, 5.0, spineMat),
    R(-4.5, -2.9, -5.0, 4.8, spineMat),
    R(-4.5, -2.9, -3.5, -2.7, cornerMat),
    R(-4.5, -2.9, 1.8, 2.6, cornerMat),
    P([[2.6, -5.2], [4.5, -5.2], [4.5, -3.2]], cornerMat),
    P([[2.6, 3.6], [4.5, 3.6], [4.5, 1.6]], cornerMat),
    P([[ribbonX - 0.6, 4.8], [ribbonX + 0.6, 4.8], [ribbonX + 0.6, 6.0], [ribbonX, 5.5], [ribbonX - 0.6, 6.0]], ribbonMat),
  ];
}

// ───────────────────────────── 3. SILHOUETTES (Crisp Sleek Upright Books) ─────────────────────────────
export const BOOK_SILHOUETTES = {
  // 1) 해일 비술 마도서 — Crisp aqua scrollwork brackets & sunlit pearl
  azuretide: () => ({
    sh: [
      ...tomeBase("sapphire", "midnight", "gold", "ribbonBlue", -2.6),
      R(-1.6, 2.8, -3.8, -2.9, "aquaRune"),
      R(-1.6, 2.8, 1.2, 2.1, "aquaRune"),
      C(0.6, -0.8, 1.2, "gold"), D(0.4, -1.0, "glint"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["sapphire", "aquaRune"],
  }),

  // 2) 태양륜 화염 마도서 — Crisp golden cross-burst & amber core
  sunember: () => ({
    sh: [
      ...tomeBase("rustRed", "mahogany", "gold", "ribbonRed", -2.6),
      R(0.1, 1.1, -3.9, 2.3, "gold"),
      R(-2.3, 3.5, -1.3, -0.3, "gold"),
      P([[-1.2, -2.6], [2.4, -2.6], [2.4, 1.0], [-1.2, 1.0]], "gold"),
      C(0.6, -0.8, 1.05, "amber"), D(0.5, -0.9, "spark"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["rustRed", "gold"],
  }),

  // 3) 월식 암흑 마도서 — Crisp violet ring & slender golden 4-point star
  eclipsevoid: () => ({
    sh: [
      ...tomeBase("midnight", "midnight", "violet", "ribbonBlue", -2.6),
      C(0.6, -0.8, 2.5, "violet"),
      C(0.6, -0.8, 1.5, "midnight"),
      R(0.2, 1.0, -3.8, 2.2, "gold"),
      R(-1.9, 3.1, -1.2, -0.4, "gold"),
      D(0.6, -0.8, "glint"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["midnight", "violet"],
  }),

  // 4) 홍옥 봉인 마도서 — Crisp diamond crest locking ruby gem
  crimsonseal: () => ({
    sh: [
      ...tomeBase("crimson", "rustRed", "gold", "ribbonRed", -2.6),
      P([[0.6, -3.6], [3.1, -0.8], [0.6, 2.0], [-1.9, -0.8]], "gold"),
      C(0.6, -0.8, 1.05, "amber"),
      D(0.6, -0.8, "ruby"), D(0.3, -1.1, "glint"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["crimson", "gold"],
  }),

  // 5) 초승달 비취 마도서 — Crisp curved golden moon crescent + 4-point star
  lunarjade: () => ({
    sh: [
      ...tomeBase("emerald", "emerald", "gold", "ribbonRed", -2.6),
      C(0.6, 0.0, 2.1, "gold"),
      C(0.6, -1.0, 1.7, "emerald"),
      R(0.2, 1.0, -3.4, -1.5, "gold"),
      R(-0.5, 1.7, -2.8, -2.0, "gold"),
      D(0.6, -2.4, "glint"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["emerald", "gold"],
  }),

  // 6) 장미 성혈 마도서 — Clean twin chalice studs + crisp diamond heart & pedestal bar
  heartblood: () => ({
    sh: [
      ...tomeBase("crimson", "crimson", "gold", "ribbonRed", -2.6),
      C(-0.9, -3.0, 0.8, "gold"), C(2.1, -3.0, 0.8, "gold"),
      P([[0.6, -2.2], [2.3, -0.4], [0.6, 1.4], [-1.1, -0.4]], "gold"),
      R(-1.2, 2.4, 1.3, 2.1, "gold"),
      D(0.6, -0.4, "glint"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["crimson", "gold"],
  }),

  // 7) 대장간 룬문자 마도서 — Crisp sleek golden X-rune lines locking ruby seal
  runeforge: () => ({
    sh: [
      ...tomeBase("mahogany", "mahogany", "gold", "ribbonRed", -2.6),
      L(-1.7, -3.4, 2.9, 1.8, "gold"),
      L(2.9, -3.4, -1.7, 1.8, "gold"),
      C(0.6, -0.8, 1.05, "amber"), D(0.6, -0.8, "ruby"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["mahogany", "gold"],
  }),

  // 8) 성좌 양피지 법전 — Crisp crimson pentagram star cleanly proportioned
  holyparchment: () => ({
    sh: [
      ...tomeBase("parchment", "mahogany", "gold", "ribbonBlue", -2.6),
      P([[0.6, -3.6], [2.9, 1.6], [-2.0, -1.6], [3.2, -1.6], [-1.7, 1.6]], "crimson"),
      C(0.6, -0.6, 1.1, "crimson"),
      D(0.6, -0.8, "spark"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["parchment", "crimson"],
  }),

  // 9) 홍련 불꽃 마도서 — Symmetrical 4-petal + amber heart blossom sigil
  emberflower: () => ({
    sh: [
      ...tomeBase("rustRed", "crimson", "gold", "ribbonBlue", -2.6),
      C(0.6, -2.6, 1.0, "gold"), C(0.6, 1.0, 1.0, "gold"),
      C(-1.2, -0.8, 1.0, "gold"), C(2.4, -0.8, 1.0, "gold"),
      C(0.6, -0.8, 1.2, "amber"), D(0.4, -1.0, "spark"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["rustRed", "gold"],
  }),

  // 10) 비전 자수정 눈 마도서 — Crisp gold eye ring & glowing amethyst mystic pupil
  arcaneeye: () => ({
    sh: [
      ...tomeBase("violet", "midnight", "gold", "ribbonRed", -2.6),
      R(-1.9, 3.1, -1.3, -0.2, "gold"),
      C(0.6, -0.8, 2.1, "gold"),
      C(0.6, -0.8, 1.5, "violet"),
      C(0.6, -0.8, 0.85, "pearl"),
      D(0.6, -0.8, "glint"),
    ],
    head: [-4.5, 4.5, -5.2, 5.2],
    blade: ["violet", "gold"],
  }),
};

// ───────────────────────────── 4. RASTERISERS (mirror weapons.js book 32×32 + 16×16) ─────────────────────────────

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function inPoly(pts, s, t) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [si, ti] = pts[i], [sj, tj] = pts[j];
    if ((ti > t) !== (tj > t) && s < ((sj - si) * (t - ti)) / (tj - ti) + si) c = !c;
  }
  return c;
}

function rasterShapes(shapes, W, H, xf, inv, glow = null) {
  const N = W * H, mat = new Array(N).fill(null), top = new Array(N).fill(null);
  const box = (sh) => {
    let pts = sh.k === "p" ? sh.pts : [[sh.s - sh.r, sh.t - sh.r], [sh.s + sh.r, sh.t + sh.r], [sh.s - sh.r, sh.t + sh.r], [sh.s + sh.r, sh.t - sh.r]];
    pts = pts.map(([s, t]) => xf(s, t));
    return [Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))) - 1), Math.min(W - 1, Math.ceil(Math.max(...pts.map((p) => p[0]))) + 1), Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))) - 1), Math.min(H - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))) + 1)];
  };
  const put = (grid, x, y, m) => { if (x >= 0 && y >= 0 && x < W && y < H) grid[y * W + x] = m; };
  const line = (grid, sh) => {
    let [x0, y0] = xf(sh.a[0] + 0.5, sh.a[1] + 0.5), [x1, y1] = xf(sh.b[0] + 0.5, sh.b[1] + 0.5);
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) put(grid, Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1)), sh.m);
  };
  for (const sh of shapes) {
    const grid = sh.top ? top : mat;
    if (sh.k === "l") { line(grid, sh); continue; }
    if (sh.k === "d") { const [x, y] = xf(sh.s + 0.5, sh.t + 0.5); put(grid, Math.floor(x), Math.floor(y), sh.m); continue; }
    const [x0, x1, y0, y1] = box(sh);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const [s, t] = inv(x + 0.5, y + 0.5);
      const hit = sh.k === "p" ? inPoly(sh.pts, s, t) : (s - sh.s) ** 2 + (t - sh.t) ** 2 <= sh.r * sh.r;
      if (!hit) continue;
      if (sh.m === null) { mat[y * W + x] = null; top[y * W + x] = null; } else grid[y * W + x] = sh.m;
    }
  }
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const img = g.createImageData(W, H), d = img.data;
  const colOf = (m, part) => {
    const v = BOOK_COLLECTION_M[m] ?? BOOK_COLLECTION_EXTRA[m] ?? "#ff00ff";
    return typeof v === "string" ? v : v[part];
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let col = null;
    if (top[i]) col = colOf(top[i], 1);
    else if (mat[i]) {
      const m = mat[i], up = y > 0 ? mat[i - W] : null, dn = y < H - 1 ? mat[i + W] : null;
      const lit = up !== m, dark = dn !== m;
      col = colOf(m, lit && !dark ? 0 : dark && !lit ? 2 : lit ? 0 : 1);
      if (glow && glow.blade.includes(m) && lit) col = glow.col;
    }
    if (!col) continue;
    const [r, gg, b] = hexRgb(col);
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function outlineCanvas(c, inks) {
  const g = c.getContext("2d"), W = c.width, H = c.height;
  for (const ink of inks) {
    const src = g.getImageData(0, 0, W, H).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
    g.fillStyle = ink;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export function renderBookWorld(silKey, opts = {}) {
  const fn = BOOK_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown book silhouette: ${silKey}`);
  const d = fn(false);
  const wq = opts.wq | 0, we = opts.we | 0;
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const inks = we >= 10 ? [RARE_INK[wq] || INK, GLOW10] : [RARE_INK[wq] || INK];
  const c = rasterShapes(d.sh, 32, 32, (s, t) => [16 + s, 16 + t], (x, y) => [x - 16, y - 16], glow);
  return outlineCanvas(c, inks);
}

export function renderBookIcon(silKey, opts = {}) {
  const fn = BOOK_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown book silhouette: ${silKey}`);
  const d = fn(true);
  const we = opts.we | 0;
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const pts = [];
  for (const sh of d.sh) {
    if (sh.m === null) continue;
    if (sh.k === "p") pts.push(...sh.pts);
    else if (sh.k === "c") pts.push([sh.s - sh.r, sh.t - sh.r], [sh.s + sh.r, sh.t + sh.r]);
    else if (sh.k === "l") pts.push(sh.a, [sh.b[0] + 1, sh.b[1] + 1]);
    else pts.push([sh.s, sh.t], [sh.s + 1, sh.t + 1]);
  }
  const s0 = Math.min(...pts.map((p) => p[0])), s1 = Math.max(...pts.map((p) => p[0]));
  const t0 = Math.min(...pts.map((p) => p[1])), t1 = Math.max(...pts.map((p) => p[1]));
  const k = Math.min(1, 13 / (s1 - s0), 13 / (t1 - t0));
  const cx = (s0 + s1) / 2, cy = (t0 + t1) / 2;
  const xf = (s, t) => [8 + (s - cx) * k, 8 + (t - cy) * k];
  const inv = (x, y) => [cx + (x - 8) / k, cy + (y - 8) / k];
  const c = rasterShapes(d.sh, 16, 16, xf, inv, glow);
  return outlineCanvas(c, we >= 10 ? [ICON_INK, GLOW10] : [ICON_INK]);
}
