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
  // 1) 태양륜 작열 지팡이 — Slender rod + compact open solar halo + 4 crisp rays + glowing orb
  sunflare: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        C(-1.8, 0.25, 0.95 + p * 0.2, "crimson"), D(-1.8, 0.25, "spark"),
        R(-1.0, 13.0, -0.45 - p * 0.2, 0.95 + p * 0.2, "obsidian"),
        R(2.5, 3.6, -0.9, 1.4, "amber"), R(11.8, 13.0, -1.2, 1.7, "gold"),
        P([[14.2, -3.5], [13.8, -5.6], [15.8, -4.4]], "crimson"),
        P([[17.8, -4.4], [19.2, -6.2], [19.8, -3.8]], "crimson"),
        P([[14.2, 4.0], [13.8, 6.0], [15.8, 4.8]], "crimson"),
        P([[17.8, 4.8], [19.2, 6.6], [19.8, 4.2]], "crimson"),
        P([[12.8, -1.1], [14.2, -4.0], [18.0, -4.8], [20.4, -2.8], [20.4, -1.4], [18.4, -1.4], [17.4, -3.0], [15.0, -2.4],
           [15.0, 2.8], [17.4, 3.4], [18.4, 1.8], [20.4, 1.8], [20.4, 3.2], [18.0, 5.2], [14.2, 4.4], [12.8, 1.5]], "gold"),
        C(17.5, 0.25, 1.4, "amber"), D(17.2, -0.1, "spark"),
      ],
      head: [12.8, 20.4, -4.8, 5.2],
      blade: ["gold", "amber"],
    };
  },

  // 2) 월식 홍염 지팡이 — Graceful slender shaft + sleek plum-gold lunar crescent + ember orb
  eclipse: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        C(-1.8, 0.25, 0.95 + p * 0.2, "plum"), D(-1.8, 0.25, "glint"),
        R(-1.0, 12.8, -0.45 - p * 0.2, 0.95 + p * 0.2, "plum"),
        R(4.2, 5.3, -0.9, 1.4, "gold"), R(11.6, 12.8, -1.2, 1.7, "gold"),
        P([[12.4, -1.2], [14.2, -4.8], [18.0, -5.8], [20.6, -4.2], [18.4, -2.8], [16.0, -2.8], [15.2, 0.2],
           [16.0, 3.2], [18.4, 3.2], [20.6, 4.6], [18.0, 6.2], [14.2, 5.2], [12.4, 1.6]], "plum"),
        P([[13.2, -0.8], [14.8, -3.2], [17.0, -4.0], [16.2, -2.2], [14.8, -0.8], [14.8, 1.2], [16.2, 2.6], [17.0, 4.4], [14.8, 3.6], [13.2, 1.2]], "gold"),
        C(18.6, 0.25, 1.3, "amber"), D(18.3, -0.1, "spark"),
      ],
      head: [12.4, 20.6, -5.8, 6.2],
      blade: ["plum", "amber"],
    };
  },

  // 3) 황금 왕홀 — Slender royal rod + crisp curved golden crown & sapphire core
  sovereign: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        C(-1.8, 0.25, 1.0 + p * 0.2, "gold"),
        R(-1.0, 13.0, -0.45 - p * 0.2, 0.95 + p * 0.2, "obsidian"),
        R(3.5, 4.6, -0.9, 1.4, "gold"), R(11.8, 13.0, -1.2, 1.7, "gold"),
        P([[12.8, -1.1], [14.0, -4.4], [17.0, -5.4], [20.2, -3.6], [19.4, -2.2], [17.0, -3.5], [15.2, -1.5]], "gold"),
        P([[12.8, 1.5], [14.0, 4.8], [17.0, 5.8], [20.2, 4.0], [19.4, 2.6], [17.0, 3.9], [15.2, 1.9]], "gold"),
        C(17.4, 0.25, 1.8, "sapph"), D(16.8, -0.3, "glint"),
      ],
      head: [12.8, 20.2, -5.4, 5.8],
      blade: ["sapph", "gold"],
    };
  },

  // 4) 성전사 십자 지팡이 — Slender rod + crisp 2px golden Maltese cross + 4 cyan gems
  templar: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        C(-1.8, 0.25, 0.95 + p * 0.2, "cyanGem"), D(-1.9, 0.0, "glint"),
        R(-1.0, 12.6, -0.45 - p * 0.2, 0.95 + p * 0.2, "obsidian"),
        R(2.6, 3.7, -0.9, 1.4, "gold"), R(11.4, 12.6, -1.2, 1.7, "gold"),
        R(12.6, 19.6, -0.65 - p * 0.2, 1.15 + p * 0.2, "gold"),
        R(15.0, 17.0, -4.2, 4.7, "gold"),
        P([[19.4, -0.8], [21.2, 0.25], [19.4, 1.3]], "cyanGem"),
        P([[15.0, -4.0], [16.0, -5.8], [17.0, -4.0]], "cyanGem"),
        P([[15.0, 4.5], [16.0, 6.3], [17.0, 4.5]], "cyanGem"),
        C(12.6, 0.25, 0.9, "cyanGem"), D(16.0, 0.25, "ember"),
      ],
      head: [12.6, 21.2, -5.8, 6.3],
      blade: ["gold", "cyanGem"],
    };
  },

  // 5) 황금 용두 지팡이 — Graceful curved golden wyrm crest with sleek snout & silver horn
  wyrm: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        C(-1.8, 0.25, 0.95 + p * 0.2, "ivory"),
        R(-1.0, 11.0, -0.45 - p * 0.2, 0.95 + p * 0.2, "crimson"),
        R(3.5, 4.6, -0.9, 1.4, "gold"), R(9.6, 11.0, -1.1, 1.6, "gold"),
        P([[10.8, -0.8], [13.5, -1.8], [15.2, -4.5], [19.0, -4.8], [21.0, -2.5], [20.5, -1.0], [16.5, -0.6], [14.2, 1.2], [10.8, 1.3]], "gold"),
        P([[14.8, -4.2], [13.0, -6.4], [16.0, -5.5], [18.4, -6.8], [18.4, -4.4]], "silver"),
        P([[15.5, 0.6], [19.4, 1.4], [20.5, 2.5], [15.8, 2.6], [14.2, 1.4]], "gold"),
        D(17.2, -3.0, "emerald"), D(19.8, -1.8, "glint"),
      ],
      head: [10.8, 21.0, -6.8, 2.6],
      blade: ["gold"],
    };
  },

  // 6) 자수정 세발 완드 — Sleek gold-violet wand + slim curved twin prongs holding amethyst
  amethyst: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        C(-1.8, 0.25, 0.95 + p * 0.2, "amethyst"), D(-1.9, 0.0, "glint"),
        R(-1.0, 12.6, -0.45 - p * 0.2, 0.95 + p * 0.2, "obsidian"),
        R(2.6, 3.7, -0.9, 1.4, "amethyst"), R(7.0, 8.1, -0.9, 1.4, "gold"), R(11.4, 12.6, -1.2, 1.7, "gold"),
        P([[12.6, -1.0], [14.2, -4.4], [17.8, -5.4], [20.0, -3.5], [18.6, -2.4], [17.0, -3.8], [15.2, -2.4], [14.2, -0.2]], "gold"),
        P([[12.6, 1.4], [14.2, 4.8], [17.8, 5.8], [20.0, 3.9], [18.6, 2.8], [17.0, 4.2], [15.2, 2.8], [14.2, 0.6]], "gold"),
        P([[15.8, 0.25], [17.4, -1.6], [20.2, -1.3], [21.2, 0.25], [20.2, 1.8], [17.4, 2.1]], "amethyst"),
        D(17.6, -0.6, "glint"),
      ],
      head: [12.6, 21.2, -5.4, 5.8],
      blade: ["amethyst", "gold"],
    };
  },

  // 7) 혈산호 진주 지팡이 — Smooth scarlet coral vines hugging dark rod cradling luminous silver pearl
  coralvine: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        C(-1.8, 0.25, 0.95 + p * 0.2, "coral"),
        R(-1.0, 12.6, -0.45 - p * 0.2, 0.95 + p * 0.2, "obsidian"),
        L(2.0, -0.6, 4.5, 1.0, "coral"), L(7.0, -0.6, 9.5, 1.0, "coral"),
        R(11.4, 12.8, -1.2, 1.7, "coral"),
        P([[12.4, -1.0], [14.0, -4.4], [16.8, -5.2], [18.4, -3.6], [16.8, -2.6], [15.0, -2.6], [14.0, -0.2]], "coral"),
        P([[12.4, 1.4], [14.0, 4.8], [16.8, 5.6], [18.8, 4.0], [17.2, 2.9], [15.2, 2.9], [14.0, 0.6]], "coral"),
        C(18.2, 0.2, 1.8, "silver"), D(17.6, -0.6, "glint"),
      ],
      head: [12.4, 20.0, -5.2, 5.6],
      blade: ["coral", "silver"],
    };
  },

  // 8) 심해 해일 보주 지팡이 — Forked trident tail + smooth cobalt wave crescent + glowing azure sphere
  tideorb: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        P([[-3.0, -2.0], [-1.0, -0.8], [-1.0, 1.3], [-3.0, 2.5], [-1.6, 0.25]], "cobalt"),
        R(-1.0, 12.6, -0.45 - p * 0.2, 0.95 + p * 0.2, "oak"),
        R(4.2, 5.3, -0.9, 1.4, "cobalt"), R(11.2, 12.6, -1.2, 1.7, "cobalt"),
        P([[12.2, -1.0], [14.2, -4.8], [17.8, -5.8], [20.6, -3.6], [19.6, -2.2], [17.2, -3.8], [15.2, -2.4],
           [14.5, 1.0], [16.2, 3.6], [19.0, 4.0], [17.4, 5.4], [14.2, 4.4], [12.2, 1.5]], "cobalt"),
        C(17.6, 0.25, 2.0, "azure"), D(16.8, -0.6, "glint"),
      ],
      head: [12.2, 20.6, -5.8, 5.4],
      blade: ["azure", "cobalt"],
    };
  },

  // 9) 고목 덩굴 목장 — Slender oak crook with smooth golden spiral + bright emerald heart
  sylvan: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        R(-2.8, -1.4, -0.8, 1.3, "gold"),
        R(-1.4, 3.8, -0.5 - p * 0.2, 1.0 + p * 0.2, "ivory"),
        R(3.8, 12.8, -0.5 - p * 0.2, 1.0 + p * 0.2, "oak"),
        P([[10.0, 1.2], [12.2, 3.4], [14.2, 2.6], [12.6, 0.8]], "emerald"),
        P([[12.4, -1.0], [14.0, -4.0], [17.2, -5.2], [20.4, -3.2], [20.4, 0.8], [18.0, 2.8], [16.0, 2.0], [16.0, 0.0],
           [18.2, 0.6], [18.8, -0.9], [17.2, -2.8], [15.2, -1.4], [14.4, 1.2], [12.4, 1.4]], "gold"),
        C(13.2, 0.2, 1.2, "emerald"), D(12.8, -0.3, "glint"),
      ],
      head: [12.4, 20.4, -5.2, 3.4],
      blade: ["gold", "emerald"],
    };
  },

  // 10) 성화 등불 지팡이 — Slender shepherd crane suspending compact teal spirit censer
  astral: (icon) => {
    const p = icon ? 0.45 : 0;
    return {
      sh: [
        C(-1.8, 0.25, 0.95 + p * 0.2, "bronze"), D(-1.8, 0.1, "spark"),
        R(-1.0, 12.8, -0.45 - p * 0.2, 0.95 + p * 0.2, "oak"),
        R(3.5, 4.6, -0.9, 1.4, "bronze"), R(11.4, 12.8, -1.2, 1.7, "gold"),
        P([[12.4, -1.0], [14.0, -4.4], [17.2, -5.8], [20.2, -4.4], [20.8, -1.6], [18.8, -1.6], [18.0, -3.6], [15.6, -3.6], [14.6, 0.8], [12.4, 1.4]], "gold"),
        R(18.8, 20.2 + p * 0.4, -2.0, 1.2, "bronze"),
        P([[17.8, 0.8], [19.6, -0.4], [21.4, 0.8], [21.0, 4.2], [19.6, 5.4], [18.0, 4.2]], "bronze"),
        C(19.6, 2.5, 1.2, "tealLamp"),
        D(19.3, 2.2, "glint"),
      ],
      head: [12.4, 21.4, -5.8, 5.4],
      blade: ["tealLamp", "gold"],
    };
  },
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
