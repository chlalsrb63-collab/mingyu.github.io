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
  // 1) 태양륜 작열 지팡이 — Gold spiked sun-ring + crimson outer flares + glowing ember orb
  sunflare: (icon) => ({
    sh: [
      C(-2.0, 0, 1.6, "crimson"), D(-2.0, -0.3, "spark"),
      R(-1, 15, -1.2, icon ? 1.8 : 1.3, "obsidian"),
      R(3, 5, -1.8, 1.8, "amber"), R(9, 11, -1.8, 1.8, "amber"), R(13, 15, -2.5, 2.5, "gold"),
      // Radiating crimson flare spikes around open crescent ring
      P([[16, -6], [15, -9], [18, -7]], "crimson"),
      P([[20, -7], [21, -10], [22, -7]], "crimson"),
      P([[23, -5], [25.5, -7], [24, -2]], "crimson"),
      P([[16, 6], [15, 9], [18, 7]], "crimson"),
      P([[20, 7], [21, 10], [22, 7]], "crimson"),
      // Chunky open golden solar ring (`C`-crescent facing tip)
      P([[15, -2], [17, -6], [22, -7], [25, -4], [25, -2], [22, -2], [21, -4], [18, -3],
         [18, 3], [21, 4], [22, 2], [25, 2], [25, 4], [22, 7], [17, 6], [15, 2]], "gold"),
      // Central floating solar orb
      C(21, 0, 2.1, "amber"), D(20.5, -0.5, "spark"),
    ],
    head: [15, 25, -8, 8],
    blade: ["gold", "amber"],
  }),

  // 2) 월식 홍염 지팡이 — Spiked plum-gold lunar crescent cradle + glowing orange eclipse core
  eclipse: (icon) => ({
    sh: [
      C(-2.0, 0, 1.6, "plum"), D(-2.0, -0.5, "glint"),
      R(-1, 14, -1.2, icon ? 1.8 : 1.3, "plum"),
      R(4, 5.5, -1.8, 1.8, "gold"), R(9, 10.5, -1.8, 1.8, "gold"), R(13, 15, -2.4, 2.4, "gold"),
      // Outer spiked crescent horns (`plum` wing + `gold` inner edge)
      P([[14, -2], [15, -7], [17, -9], [19, -7], [21, -9], [23, -8], [21, -4], [18, -2],
         [18, 2], [21, 4], [23, 8], [21, 9], [19, 7], [17, 9], [15, 7], [14, 2]], "plum"),
      P([[16, -2], [18, -5], [20, -6], [21, -5], [19, -2], [19, 2], [21, 5], [20, 6], [18, 5], [16, 2]], "gold"),
      // Floating eclipse orb inside open horns
      C(22.5, 0, 2.0, "amber"), D(22, -0.5, "spark"),
    ],
    head: [14, 24, -8, 8],
    blade: ["plum", "amber"],
  }),

  // 3) 황금 왕홀 — Twin arched royal gold curls enclosing a brilliant sky-sapphire jewel
  sovereign: (icon) => ({
    sh: [
      C(-2.0, 0, 1.7, "gold"), D(-2.5, -0.5, "glint"),
      R(-1, 15, -1.2, icon ? 1.8 : 1.3, "obsidian"),
      R(3, 5, -1.8, 1.8, "gold"), R(8, 10, -1.8, 1.8, "gold"), R(13, 15.5, -2.6, 2.6, "gold"),
      // Upper & lower curled golden crown wings
      P([[15, -2], [16, -7], [19, -9], [23, -8], [25, -5], [23, -3], [21, -5], [19, -5], [18, -2]], "gold"),
      P([[15, 2], [16, 7], [19, 9], [23, 8], [25, 5], [23, 3], [21, 5], [19, 5], [18, 2]], "gold"),
      P([[15, -3], [19, -5], [20, 0], [19, 5], [15, 3]], "gold"),
      // Prominent azure sapphire gem at heart of sceptre
      C(21, 0, 2.8, "sapph"), D(20, -1, "glint"), D(21, -1, "glint"),
    ],
    head: [15, 25, -8, 8],
    blade: ["sapph", "gold"],
  }),

  // 4) 성전사 십자 지팡이 — Crisp 4-way golden Maltese cross tipped with 4 cyan crystals
  templar: (icon) => ({
    sh: [
      C(-2.0, 0, 1.6, "cyanGem"), D(-2.4, -0.5, "glint"),
      R(-1, 14, -1.2, icon ? 1.8 : 1.3, "obsidian"),
      R(2, 4, -1.8, 1.8, "gold"), R(12.5, 14.5, -2.5, 2.5, "gold"),
      // Bold symmetrical golden cross arms
      R(14.5, 23.5, -2.0, 2.0, "gold"),
      R(17.5, 20.5, -7.0, 7.0, "gold"),
      // 4 ice-cyan faceted crystals (N, S, W-collar, E-tip) + glowing ember heart
      P([[23, -2], [25.5, 0], [23, 2]], "cyanGem"),
      P([[17, -6.5], [19, -9.5], [21, -6.5]], "cyanGem"),
      P([[17, 6.5], [19, 9.5], [21, 6.5]], "cyanGem"),
      C(14.5, 0, 1.4, "cyanGem"),
      D(19, 0, "ember"), D(18.5, -7, "glint"), D(24, -0.5, "glint"),
    ],
    head: [14, 25.5, -9, 9],
    blade: ["gold", "cyanGem"],
  }),

  // 5) 황금 용두 지팡이 — S-curved golden dragon head crest + silver mane + emerald eye + claw pommel
  wyrm: (icon) => ({
    sh: [
      // Pearl claw pommel & crimson grip
      C(-2.0, 0.5, 1.6, "ivory"), P([[-3.6, -1.5], [-1.8, -1.5], [-1, 0]], "ivory"),
      R(-1, 13, -1.3, icon ? 1.8 : 1.3, "crimson"),
      R(4, 5.5, -1.8, 1.8, "gold"), R(10, 12, -2.2, 2.2, "gold"),
      // S-curved serpent neck rising to bold dragon head (upper jaw crest -> distinct open mouth notch)
      P([[11, -1], [15, -3], [17, -7.5], [22, -8], [25, -4], [25, -1.5], [20, -1], [18, -1], [15, 2], [11, 2]], "gold"),
      // Swept silver dragon horns & open lower jaw fang
      P([[16, -7], [13, -10.5], [18, -9], [21, -11], [21, -7]], "silver"),
      P([[18, 1], [23, 2.5], [24.5, 4.5], [18, 4.5], [16, 2]], "gold"),
      // Emerald glowing eye + ivory nostril/fang glint
      D(20, -4.5, "emerald"), D(23.5, -2.8, "glint"), D(23, 3.0, "glint"),
    ],
    head: [13, 25, -10, 5],
    blade: ["gold"],
  }),

  // 6) 자수정 세발 완드 — Violet-gold ringed rod + spread golden talons cradling floating amethyst prism
  amethyst: (icon) => ({
    sh: [
      C(-2.0, 0, 1.6, "amethyst"), D(-2.4, -0.5, "glint"),
      R(-1, 14.5, -1.2, icon ? 1.8 : 1.3, "obsidian"),
      R(2, 4, -1.8, 1.8, "amethyst"), R(6, 7.5, -1.8, 1.8, "gold"),
      R(10, 11.5, -1.8, 1.8, "amethyst"), R(13, 15, -2.5, 2.5, "gold"),
      // Wide-spread curved golden pincer prongs leaving breathing room around gem
      P([[14, -2], [16, -7.5], [21, -9], [24, -6], [22, -4.5], [20, -6.5], [17.5, -4.5], [16.5, -1]], "gold"),
      P([[14, 2], [16, 7.5], [21, 9], [24, 6], [22, 4.5], [20, 6.5], [17.5, 4.5], [16.5, 1]], "gold"),
      // Faceted hexagonal amethyst crystal orb floating inside prongs
      P([[18.5, 0], [20.5, -3.0], [24, -2.5], [25.5, 0], [24, 2.5], [20.5, 3.0]], "amethyst"),
      D(20.5, -1.2, "glint"), D(22, -0.8, "glint"),
    ],
    head: [14, 25.5, -9, 9],
    blade: ["amethyst", "gold"],
  }),

  // 7) 혈산호 진주 지팡이 — Spiraled scarlet coral vines up dark rod flaring around silver pearl
  coralvine: (icon) => ({
    sh: [
      C(-2.0, 0, 1.6, "coral"),
      R(-1, 14, -1.2, icon ? 1.8 : 1.3, "obsidian"),
      // Coiling coral vine bands climbing shaft
      P([[1, -2], [4, -2], [6, 2], [3, 2]], "coral"),
      P([[8, -2], [11, -2], [13, 2], [10, 2]], "coral"),
      // Waving asymmetrical coral tendrils cradling silver pearl orb
      P([[13, -2], [16, -7.5], [19, -8.5], [21, -6], [19, -4], [17, -4.5], [16, 0]], "coral"),
      P([[13, 2], [16, 6.5], [20, 8.5], [23, 6], [21, 4], [18, 4.5], [16, 1]], "coral"),
      R(14, 18, -2.5, 2.5, "coral"),
      // Luminous pearl orb perched at tip
      C(22, -0.5, 2.8, "silver"), D(21, -1.5, "glint"),
    ],
    head: [13, 25, -8.5, 8.5],
    blade: ["coral", "silver"],
  }),

  // 8) 심해 해일 보주 지팡이 — Deep trident fork pommel + cobalt wave crescent + giant azure tide orb
  tideorb: (icon) => ({
    sh: [
      // Wide forked metal anchor/trident pommel (`s = -3.8..-1`)
      P([[-3.8, -3.5], [-1, -2], [-1, 2], [-3.8, 3.5], [-2.0, 0]], "cobalt"),
      R(-1, 14, -1.2, icon ? 1.8 : 1.3, "oak"),
      R(5, 6.5, -1.8, 1.8, "cobalt"), R(12, 14.5, -2.5, 2.5, "cobalt"),
      // Sweeping deep cobalt wave-blade arching over the orb
      P([[14, -2], [16, -7.5], [21, -9], [25, -6], [24, -4], [21, -6], [18, -4], [17, 1],
         [19, 5], [23, 6], [20, 8], [16, 6], [14, 2]], "cobalt"),
      // Huge ocean-azure water sphere
      C(21, 0, 3.2, "azure"), D(19.5, -1.5, "glint"), D(20.5, -1.5, "glint"),
    ],
    head: [14, 25, -8, 8],
    blade: ["azure", "cobalt"],
  }),

  // 9) 고목 덩굴 목장 — Twisted gnarled oak crook + emerald leaf inlay + ivory wrapped handle
  sylvan: (icon) => ({
    sh: [
      // Gold cap + crisp ivory handle wrap + gnarled wooden shaft
      R(-3.5, -1.5, -2.0, 2.0, "gold"),
      R(-1.5, 4.5, -1.4, 1.6, "ivory"),
      R(4.5, 15, -1.3, icon ? 1.9 : 1.5, "oak"),
      // Sprouting twig & leaf beside emerald inlay (`s=13..18`)
      P([[10, -2], [13, -5], [16, -4], [14, -1]], "gold"),
      P([[12, 2], [14, 5], [17, 4], [15, 1]], "emerald"),
      // Thick curved golden-oak shepherd's crook spiral at tip
      P([[15, -2], [17, -6], [21, -8], [25, -5], [25, 1], [22, 4], [19, 3], [19, 0],
         [22, 1], [23, -1], [21, -4], [18, -2], [17, 2], [15, 2]], "gold"),
      // Glowing forest emerald gem set inside upper crook neck
      C(15.5, 0, 2.0, "emerald"), D(15, -0.8, "glint"),
    ],
    head: [13, 25, -8, 5],
    blade: ["gold", "emerald"],
  }),

  // 10) 성화 등불 지팡이 — Arched golden shepherd hook suspending glowing teal spirit censer lantern
  astral: (icon) => ({
    sh: [
      C(-2.0, 0, 1.6, "bronze"), D(-2.2, -0.4, "spark"),
      R(-1, 15, -1.2, icon ? 1.8 : 1.3, "oak"),
      R(4, 6, -1.8, 1.8, "bronze"), R(13, 15, -2.5, 2.5, "gold"),
      // Tall shepherd hook arch curving smoothly over tip (`t = -8..-3`)
      P([[14, -2], [16, -7], [20, -9], [24, -7], [25, -3], [22, -3], [21, -6], [18, -6], [17, 1], [14, 2]], "gold"),
      // Suspended solid connector & glowing teal lantern cage (`s = 20..25, t = 0..7`)
      R(22.5, 24.0, -3.5, 1.5, "bronze"),
      P([[20, 1], [23, -1], [25.5, 1], [25, 6], [23, 8], [20.5, 6]], "bronze"),
      C(22.8, 3.5, 1.9, "tealLamp"),
      D(22.5, 3, "glint"),
    ],
    head: [14, 25.5, -9, 8],
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
