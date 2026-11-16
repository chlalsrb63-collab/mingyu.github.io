/**
 * 스태프 외형 컬렉션 (Arcane Staves & Sceptres Collection — 10 Designs).
 *
 * Code-drawn Tales Tales weapon geometry (`R`/`P`/`C`/`L`/`D` in weapon space `s` along shaft, `t` across)
 * inspired by classic RPG staff silhouettes: solar crescent, blood eclipse, azure sovereign sceptre,
 * templar 4-gem cross, golden wyrm head, amethyst talon rod, crimson coral pearl, abyssal tide-orb,
 * gnarled sylvan crook, and hanging astral spirit-censer.
 *
 * Compatible with `game/public/weapons.js` rasterizer (`GRIP = [5, 16]`, world 32×32 pointing right,
 * and automatic 16×16 diagonal bag icon). Zero `src/logic.js` / `weapons.js` files modified.
 *
 * Integration Locations:
 *   1. `game/public/weapons.js`
 *      - Merge `STAFF_COLLECTION_M` into `M` (and `STAFF_COLLECTION_EXTRA` into `EXTRA`).
 *      - Register `STAFF_SILHOUETTES` into `SIL.staff`.
 *      - Add `MOTIF_SIL.staff.<motif>` entries + `STAFF_COLLECTION_MOTIFS` into `MOTIF`.
 *   2. `game/src/logic/65-cosmetics.js`
 *      - Append `STAFF_COLLECTION_META` (`ws_staff_*`, slot `"wskin"`, `wk: "staff"`).
 *   3. `game/public/art.js` / `asset/generated/staves/`
 *      - Normalized 16×16 bag icons (`icon_ws_staff_*.png`) ready after owner approval.
 */

const GRIP = [5, 16];
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
// Every ramp follows [lit, mid, shadow] (cool violet shadow, warm yellow/white highlight).
export const STAFF_COLLECTION_M = {
  obsidian:  ["#5e5a72", "#3b394d", "#242233"],
  gold:      ["#fff09c", "#e8b942", "#9e6824"],
  amber:     ["#ffcf78", "#f08a24", "#a8461c"],
  crimson:   ["#ff8878", "#dc3c38", "#8c1e2e"],
  plum:      ["#9e689c", "#6a3c6d", "#3d2246"],
  sapph:     ["#9cd6ff", "#3e8ce8", "#22469c"],
  cyanGem:   ["#d8ffff", "#4ce0d6", "#208096"],
  silver:    ["#f4f7ff", "#bcc8de", "#6e7898"],
  emerald:   ["#b6f28a", "#48b858", "#206b42"],
  amethyst:  ["#f2b8ff", "#ab4ef0", "#582496"],
  coral:     ["#ff927a", "#e64246", "#8c1c34"],
  azure:     ["#b8ebff", "#449be8", "#1e4b8f"],
  cobalt:    ["#7498c8", "#3e5c94", "#223059"],
  oak:       ["#c48e5a", "#8e5c38", "#573530"],
  ivory:     ["#fff7e8", "#ded2c0", "#9c8e86"],
  bronze:    ["#ffdca0", "#c48440", "#784828"],
  tealLamp:  ["#b8fff4", "#44d4be", "#1c787a"],
};

export const STAFF_COLLECTION_EXTRA = {
  glint: "#ffffff",
  spark: "#fff4a0",
  ember: "#ff9a38",
  leaf:  "#68cf5a",
};

// ───────────────────────────── 2. ITEM METADATA ─────────────────────────────
export const STAFF_COLLECTION_META = [
  { id: "ws_staff_sunflare",  silKey: "sunflare",  wk: "staff", slot: "wskin", name: "태양륜 작열 지팡이",   desc: "불꽃 가시가 돋은 황금 태양 고리와 타오르는 화염핵 지팡이." },
  { id: "ws_staff_eclipse",   silKey: "eclipse",   wk: "staff", slot: "wskin", name: "월식 홍염 지팡이",     desc: "자줏빛 뿔 초승달 사이에 개기월식의 홍염 구슬이 뜬 지팡이." },
  { id: "ws_staff_sovereign", silKey: "sovereign", wk: "staff", slot: "wskin", name: "황금 왕홀",            desc: "쌍날개 황금 관에 푸른 사파이어를 얹은 왕실 지휘봉." },
  { id: "ws_staff_templar",   silKey: "templar",   wk: "staff", slot: "wskin", name: "성전사 십자 지팡이",   desc: "사방 끝에 푸른 수정을 박은 고대 성전사의 황금 십자 지팡이." },
  { id: "ws_staff_wyrm",      silKey: "wyrm",      wk: "staff", slot: "wskin", name: "황금 용두 지팡이",     desc: "비취빛 눈과 은빛 갈기를 조각한 황금 용머리 주술 지팡이." },
  { id: "ws_staff_amethyst",  silKey: "amethyst",  wk: "staff", slot: "wskin", name: "자수정 세발 완드",     desc: "황금 발톱 세 개가 자수정 원석을 감싼 비전 지팡이." },
  { id: "ws_staff_coralvine", silKey: "coralvine", wk: "staff", slot: "wskin", name: "혈산호 진주 지팡이",   desc: "붉은 산호 덩굴이 자루를 휘감아 백진주를 받든 바다 지팡이." },
  { id: "ws_staff_tideorb",   silKey: "tideorb",   wk: "staff", slot: "wskin", name: "심해 해일 보주 지팡이", desc: "삼지창 자루 끝에서 푸른 해일 보주를 휘감아 든 심해 지팡이." },
  { id: "ws_staff_sylvan",    silKey: "sylvan",    wk: "staff", slot: "wskin", name: "고목 덩굴 목장",       desc: "에메랄드와 새순이 감긴 황금 고목 굽은 목장 지팡이." },
  { id: "ws_staff_astral",    silKey: "astral",    wk: "staff", slot: "wskin", name: "성화 등불 지팡이",     desc: "굽은 고리 끝에 비취빛 영혼 등불을 매단 치유사의 지팡이." },
];

// ───────────────────────────── 3. SILHOUETTES (weapon-space R/P/C/L/D) ─────────────────────────────
// World canvas: 32×32 (GRIP at [5,16] -> safe bounds s in [-3.5..25.5], t in [-12..12]).

export const STAFF_SILHOUETTES = {
  // 1) 태양륜 작열 지팡이 — Sleek shaft + crisp golden open solar ring + 4 clean cardinal rays + glowing amber orb
  sunflare: (icon) => ({
    sh: [
      C(-2.0, 0.5, 1.3, "crimson"), D(-2.0, 0.5, "spark"),
      R(-1, 15, -0.7, icon ? 1.6 : 1.3, "obsidian"),
      R(3, 4.5, -1.3, 1.8, "amber"), R(13.5, 15, -2.0, 2.5, "gold"),
      // Clean symmetrical solar halo rays (top, bottom, diagonal outer tips)
      P([[16, -5], [15, -7.5], [18, -6]], "crimson"),
      P([[20, -6], [21.5, -8.5], [22.5, -5.5]], "crimson"),
      P([[16, 5.5], [15, 8], [18, 6.5]], "crimson"),
      P([[20, 6.5], [21.5, 9], [22.5, 6]], "crimson"),
      // Smooth clean golden C-ring
      P([[14.5, -1.5], [16.5, -5.5], [21.5, -6.5], [24.5, -4], [24.5, -2], [22, -2], [20.5, -4], [17.5, -3],
         [17.5, 3.5], [20.5, 4.5], [22, 2.5], [24.5, 2.5], [24.5, 4.5], [21.5, 7], [16.5, 6], [14.5, 2.2]], "gold"),
      C(20.8, 0.5, 1.8, "amber"), D(20.4, 0, "spark"),
    ],
    head: [14.5, 24.5, -6.5, 7],
    blade: ["gold", "amber"],
  }),

  // 2) 월식 홍염 지팡이 — Graceful sleek shaft + smooth swept plum-gold lunar crescent + floating ember sphere
  eclipse: (icon) => ({
    sh: [
      C(-2.0, 0.5, 1.3, "plum"), D(-2.0, 0.5, "glint"),
      R(-1, 14.5, -0.7, icon ? 1.6 : 1.3, "plum"),
      R(5, 6.5, -1.3, 1.8, "gold"), R(13, 14.5, -2.0, 2.5, "gold"),
      // Smooth sweeping lunar crescent (no bumpy jagged teeth!)
      P([[14, -1.8], [16, -6.5], [21, -8], [24.5, -6], [21.5, -4], [18.5, -4], [17.5, 0.5],
         [18.5, 4.5], [21.5, 4.5], [24.5, 6.5], [21, 8.5], [16, 7], [14, 2.2]], "plum"),
      P([[15, -1.2], [17, -4.5], [20, -5.5], [19, -3], [17, -1], [17, 1.5], [19, 3.5], [20, 6], [17, 5], [15, 1.8]], "gold"),
      C(22, 0.4, 1.7, "amber"), D(21.6, 0, "spark"),
    ],
    head: [14, 24.5, -8, 8],
    blade: ["plum", "amber"],
  }),

  // 3) 황금 왕홀 — Slender royal rod + sleek swept wing crown holding bright sapphire jewel
  sovereign: (icon) => ({
    sh: [
      C(-2.0, 0.5, 1.4, "gold"),
      R(-1, 15, -0.7, icon ? 1.6 : 1.3, "obsidian"),
      R(4, 5.5, -1.3, 1.8, "gold"), R(13.5, 15, -2.0, 2.5, "gold"),
      // Smooth curved twin royal crown arcs (`t = -6.5..7`)
      P([[15, -1.5], [16.5, -6], [20, -7.2], [24, -5], [23, -3.2], [20, -4.8], [18, -2]], "gold"),
      P([[15, 2.2], [16.5, 6.8], [20, 7.8], [24, 5.5], [23, 3.8], [20, 5.4], [18, 2.5]], "gold"),
      C(20.5, 0.4, 2.4, "sapph"), D(19.8, -0.4, "glint"),
    ],
    head: [15, 24, -7.2, 7.8],
    blade: ["sapph", "gold"],
  }),

  // 4) 성전사 십자 지팡이 — Slender clean rod + crisp slim golden Maltese cross + 4 cyan gems
  templar: (icon) => ({
    sh: [
      C(-2.0, 0.5, 1.3, "cyanGem"), D(-2.2, 0.2, "glint"),
      R(-1, 14.5, -0.7, icon ? 1.6 : 1.3, "obsidian"),
      R(3, 4.5, -1.3, 1.8, "gold"), R(13, 14.5, -2.0, 2.5, "gold"),
      // Crisp slender 4-way golden cross (`3px` arms -> zero clunkiness!)
      R(14.5, 23.5, -1.0, 2.0, "gold"),
      R(17.5, 20.0, -5.8, 6.8, "gold"),
      // Clean diamond faceted cyan tip jewels
      P([[23, -1.0], [25.2, 0.5], [23, 2.0]], "cyanGem"),
      P([[17.5, -5.5], [18.8, -7.8], [20.0, -5.5]], "cyanGem"),
      P([[17.5, 6.5], [18.8, 8.8], [20.0, 6.5]], "cyanGem"),
      C(14.5, 0.5, 1.2, "cyanGem"), D(18.8, 0.5, "ember"),
    ],
    head: [14.5, 25.2, -7.8, 8.8],
    blade: ["gold", "cyanGem"],
  }),

  // 5) 황금 용두 지팡이 — Graceful curved golden dragon head with sleek jaw & silver horn
  wyrm: (icon) => ({
    sh: [
      C(-2.0, 0.5, 1.3, "ivory"),
      R(-1, 12.5, -0.7, icon ? 1.6 : 1.3, "crimson"),
      R(4, 5.5, -1.3, 1.8, "gold"), R(10.5, 12.5, -1.8, 2.2, "gold"),
      // Sleek S-curved serpent neck & crisp contoured dragon snout
      P([[12, -1], [15.5, -2.5], [17.5, -6.0], [22.5, -6.5], [25, -3.5], [24.5, -1.5], [19.5, -1.0], [16.5, 1.5], [12, 1.8]], "gold"),
      P([[17, -5.8], [14.5, -8.5], [18.5, -7.5], [21.5, -9.2], [21.5, -6.0]], "silver"),
      P([[18, 0.8], [23, 1.8], [24.5, 3.2], [18.5, 3.5], [16.5, 1.8]], "gold"),
      D(20, -4.0, "emerald"), D(23.5, -2.5, "glint"),
    ],
    head: [12, 25, -9, 3.5],
    blade: ["gold"],
  }),

  // 6) 자수정 세발 완드 — Sleek gold-violet banded wand + slender curved prongs cradling amethyst
  amethyst: (icon) => ({
    sh: [
      C(-2.0, 0.5, 1.3, "amethyst"), D(-2.2, 0.2, "glint"),
      R(-1, 14.5, -0.7, icon ? 1.6 : 1.3, "obsidian"),
      R(3, 4.5, -1.3, 1.8, "amethyst"), R(8, 9.5, -1.3, 1.8, "gold"), R(13, 14.5, -2.0, 2.5, "gold"),
      // Graceful thin golden pincer prongs (`1.5px` arch)
      P([[14.5, -1.5], [16.5, -6.0], [21, -7.2], [23.8, -4.8], [22.2, -3.5], [20, -5.2], [17.8, -3.5], [16.5, -0.5]], "gold"),
      P([[14.5, 2.2], [16.5, 6.8], [21, 7.8], [23.8, 5.5], [22.2, 4.2], [20, 5.8], [17.8, 4.2], [16.5, 1.2]], "gold"),
      P([[18.5, 0.4], [20.5, -2.2], [24, -1.8], [25.2, 0.4], [24, 2.6], [20.5, 3.0]], "amethyst"),
      D(20.8, -0.8, "glint"),
    ],
    head: [14.5, 25.2, -7.2, 7.8],
    blade: ["amethyst", "gold"],
  }),

  // 7) 혈산호 진주 지팡이 — Smooth scarlet coral vines hugging dark rod cradling luminous silver pearl
  coralvine: (icon) => ({
    sh: [
      C(-2.0, 0.5, 1.3, "coral"),
      R(-1, 14.5, -0.7, icon ? 1.6 : 1.3, "obsidian"),
      L(2, -1, 5, 1.5, "coral"), L(8, -1, 11, 1.5, "coral"),
      R(13, 15, -2.0, 2.5, "coral"),
      // Smooth flared upper & lower coral arms
      P([[14, -1.5], [16, -6.0], [19.5, -7.0], [21.5, -5.0], [19.5, -3.8], [17.2, -3.8], [16, -0.5]], "coral"),
      P([[14, 2.2], [16, 6.5], [19.5, 7.5], [22, 5.5], [20, 4.2], [17.5, 4.2], [16, 1.2]], "coral"),
      C(21.5, 0.2, 2.4, "silver"), D(20.8, -0.8, "glint"),
    ],
    head: [14, 24, -7, 7.5],
    blade: ["coral", "silver"],
  }),

  // 8) 심해 해일 보주 지팡이 — Forked trident tail + smooth cobalt wave crescent + glowing azure sphere
  tideorb: (icon) => ({
    sh: [
      P([[-3.5, -2.8], [-1, -1.2], [-1, 2.0], [-3.5, 3.5], [-1.8, 0.4]], "cobalt"),
      R(-1, 14.5, -0.7, icon ? 1.6 : 1.3, "oak"),
      R(5, 6.5, -1.3, 1.8, "cobalt"), R(12.5, 14.5, -2.0, 2.5, "cobalt"),
      P([[14, -1.5], [16.5, -6.5], [21, -7.8], [24.8, -5.0], [23.5, -3.2], [20.5, -5.2], [18, -3.5],
         [17, 1.5], [19, 4.8], [22.5, 5.5], [20.5, 7.2], [16.5, 6.0], [14, 2.2]], "cobalt"),
      C(20.8, 0.4, 2.7, "azure"), D(19.8, -0.8, "glint"),
    ],
    head: [14, 24.8, -7.8, 7.2],
    blade: ["azure", "cobalt"],
  }),

  // 9) 고목 덩굴 목장 — Smooth ivory-bound oak crook with clean emerald inlay & leaf
  sylvan: (icon) => ({
    sh: [
      R(-3.2, -1.5, -1.3, 2.0, "gold"),
      R(-1.5, 4.5, -0.8, 1.6, "ivory"),
      R(4.5, 15, -0.8, icon ? 1.6 : 1.4, "oak"),
      P([[11.5, 1.8], [14, 4.5], [16.5, 3.5], [14.5, 1.0]], "emerald"),
      // Smooth clean golden wood shepherd crook spiral
      P([[14.5, -1.5], [16.5, -5.5], [20.5, -7.0], [24.5, -4.5], [24.5, 1.0], [21.5, 3.5], [19, 2.5], [19, 0],
         [21.8, 0.8], [22.5, -1.2], [20.5, -3.8], [18, -2.0], [17, 1.8], [14.5, 2.0]], "gold"),
      C(15.2, 0.2, 1.6, "emerald"), D(14.8, -0.4, "glint"),
    ],
    head: [14, 24.5, -7, 4.5],
    blade: ["gold", "emerald"],
  }),

  // 10) 성화 등불 지팡이 — Graceful slender shepherd crane suspending compact teal spirit censer
  astral: (icon) => ({
    sh: [
      C(-2.0, 0.5, 1.3, "bronze"), D(-2.0, 0.3, "spark"),
      R(-1, 15, -0.7, icon ? 1.6 : 1.3, "oak"),
      R(4, 5.5, -1.3, 1.8, "bronze"), R(13, 15, -2.0, 2.5, "gold"),
      P([[14, -1.5], [16, -6.0], [20, -7.8], [23.8, -6.0], [24.5, -2.2], [22, -2.2], [21, -5.0], [18, -5.0], [17, 1.2], [14, 2.0]], "gold"),
      R(22.2, 23.8, -2.5, 1.2, "bronze"),
      P([[20.5, 1.2], [23, -0.5], [25.2, 1.2], [24.8, 5.5], [23, 7.2], [20.8, 5.5]], "bronze"),
      C(22.8, 3.4, 1.6, "tealLamp"),
      D(22.5, 3.0, "glint"),
    ],
    head: [14, 25.2, -7.8, 7.2],
    blade: ["tealLamp", "gold"],
  }),
};

// ───────────────────────────── 4. RASTERISERS (mirror weapons.js) ─────────────────────────────

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
    const v = STAFF_COLLECTION_M[m] ?? STAFF_COLLECTION_EXTRA[m] ?? "#ff00ff";
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

export function renderStaffWorld(silKey, opts = {}) {
  const fn = STAFF_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown staff silhouette: ${silKey}`);
  const d = fn(false);
  const wq = opts.wq | 0, we = opts.we | 0;
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const inks = we >= 10 ? [RARE_INK[wq] || INK, GLOW10] : [RARE_INK[wq] || INK];
  const [ox, oy] = GRIP;
  const c = rasterShapes(d.sh, 32, 32, (s, t) => [ox + s, oy + t], (x, y) => [x - ox, y - oy], glow);
  return outlineCanvas(c, inks);
}

export function renderStaffIcon(silKey, opts = {}) {
  const fn = STAFF_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown staff silhouette: ${silKey}`);
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
  const xs = pts.map(([s, t]) => s + t), ys = pts.map(([s, t]) => t - s);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const u = Math.min(0.9, 13 / (x1 - x0), 13 / (y1 - y0));
  const ox = 8 - (u * (x0 + x1)) / 2, oy = 8 - (u * (y0 + y1)) / 2;
  const xf = (s, t) => [ox + u * (s + t), oy + u * (t - s)];
  const inv = (x, y) => { const a = (x - ox) / u, b = (y - oy) / u; return [(a - b) / 2, (a + b) / 2]; };
  const c = rasterShapes(d.sh, 16, 16, xf, inv, glow);
  return outlineCanvas(c, we >= 10 ? [ICON_INK, GLOW10] : [ICON_INK]);
}
