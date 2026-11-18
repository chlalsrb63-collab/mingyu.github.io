/**
 * 양손해머 외형 컬렉션 (Warhammers & Greatmauls Collection — 10 Designs).
 *
 * Code-drawn Tales Tales `hammer` geometry (`R`/`P`/`C`/`L`/`D` in weapon space `s` along haft, `t` across)
 * inspired by classic RPG greatmaul silhouettes: paladin crimson-gold drum maul, blood-iron spiked maul,
 * golden pick-hammer, twin-coil steel cleaver-maul, asymmetrical gear-foundry hammer, crimson gothic spire hammer,
 * twin glacier-orb crystal maul, gnarled twisted-haft abyssal eye hammer, knight cross-peen Lucerne hammer,
 * and blazing molten meteorite anvil maul.
 *
 * Compatible with `game/public/weapons.js` rasterizer (`W=40, H=36, scale=1.25, GRIP=[5, 16]`,
 * and automatic 16×16 diagonal bag icon). Zero `src/logic.js` / `weapons.js` files modified.
 *
 * Integration Locations:
 *   1. `game/public/weapons.js`
 *      - Merge `HAMMER_COLLECTION_M` into `M` (`HAMMER_COLLECTION_EXTRA` into `EXTRA`).
 *      - Register `HAMMER_SILHOUETTES` under `SIL.hammer`.
 *      - Add `MOTIF_SIL.hammer.<motif>` entries + motifs into `MOTIF`.
 *   2. `game/src/logic/65-cosmetics.js`
 *      - Append `HAMMER_COLLECTION_META` (`ws_hammer_*`, `slot: "wskin"`, `wk: "hammer"`).
 *   3. `game/public/art.js` / `asset/generated/hammers/`
 *      - Normalized 16×16 bag icons (`icon_ws_hammer_*.png`) ready after owner approval.
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
export const HAMMER_COLLECTION_M = {
  steel:      ["#edf2fa", "#b4c0d4", "#6e7894"],
  ironDark:   ["#6a7086", "#3d4054", "#212232"],
  gold:       ["#fff09e", "#ebb842", "#9c6420"],
  bronze:     ["#ffe0a4", "#c88842", "#7a4424"],
  crimson:    ["#ff8878", "#d63834", "#841c2c"],
  bloodIron:  ["#ff7266", "#ba3636", "#5e1c2a"],
  leather:    ["#8c5c42", "#5e382c", "#3a2024"],
  oak:        ["#c68e5c", "#8a5838", "#543230"],
  glacier:    ["#e0ffff", "#58c8f4", "#2466b4"],
  amberCore:  ["#fff2a0", "#ff9e2e", "#b04018"],
  silver:     ["#ffffff", "#d2dced", "#828eac"],
  meteor:     ["#5c5266", "#342d3d", "#1c1826"],
};

export const HAMMER_COLLECTION_EXTRA = {
  glint: "#ffffff",
  spark: "#fff4a0",
  ruby:  "#ff5268",
  ember: "#ff8828",
  core:  "#e8ffff",
};

// ───────────────────────────── 2. ITEM METADATA ─────────────────────────────
export const HAMMER_COLLECTION_META = [
  { id: "ws_hammer_royalpaladin",  silKey: "royalpaladin",  wk: "hammer", slot: "wskin", name: "백은 성기사 대형 망치",   desc: "금빛 타격면과 진홍 띠를 두른 백은 성기사단의 제식 대형 망치." },
  { id: "ws_hammer_bloodforge",    silKey: "bloodforge",    wk: "hammer", slot: "wskin", name: "혈철 마신 대형 망치",     desc: "검붉은 쇳덩이 양끝에 톱니 갈퀴가 돋은 피의 마신 망치." },
  { id: "ws_hammer_sumpick",       silKey: "sumpick",       wk: "hammer", slot: "wskin", name: "황금 곡괭이 망치",       desc: "넓은 황금 망치와 날카로운 파갑 부리가 결합된 황금 전투 곡괭이." },
  { id: "ws_hammer_dragoncleave",  silKey: "dragoncleave",  wk: "hammer", slot: "wskin", name: "쌍룡 도끼 망치",         desc: "황금 용 장식 목 위에 무거운 사선 강철 날을 얹은 양손 부월 망치." },
  { id: "ws_hammer_gearfoundry",   silKey: "gearfoundry",   wk: "hammer", slot: "wskin", name: "태엽 강철 톱니 망치",     desc: "거대한 황동 띠 원통과 못박힌 모루가 짝을 이룬 공방 톱니 망치." },
  { id: "ws_hammer_cathedral",     silKey: "cathedral",     wk: "hammer", slot: "wskin", name: "심홍 성당 십자 망치",     desc: "첨탑 가시와 심홍색 성당 십자 문양이 돋은 이단 심문관 대형 망치." },
  { id: "ws_hammer_glacierorb",    silKey: "glacierorb",    wk: "hammer", slot: "wskin", name: "빙결 쌍보주 망치",       desc: "황금 발톱 양쪽 끝에 거대한 만년설 빙정 보주 두 개를 단 성물 망치." },
  { id: "ws_hammer_eyeabyss",      silKey: "eyeabyss",      wk: "hammer", slot: "wskin", name: "심안 광기 모닝스타",     desc: "비틀린 고목 자루 끝 가시철구 속에서 황금 눈이 번뜩이는 심연 망치." },
  { id: "ws_hammer_warforge",      silKey: "warforge",      wk: "hammer", slot: "wskin", name: "전쟁공방 쇠망치",         desc: "금빛 앞머리와 예리한 백은 피크가 조화를 이룬 정통 기사 쇠망치." },
  { id: "ws_hammer_meteor",        silKey: "meteor",        wk: "hammer", slot: "wskin", name: "유성운철 대형 망치",     desc: "균열 틈새로 뜨거운 마그마 빛이 새어 나오는 운철 모루 망치." },
];

// ───────────────────────────── 3. SILHOUETTES (weapon-space R/P/C/L/D) ─────────────────────────────
// Hammer world canvas: 40×36 (GRIP [5,16], scale 1.25 -> safe bounds s in [-3.1..25], t in [-11.5..11.5]).

export const HAMMER_SILHOUETTES = {
  // 1) 백은 성기사 대형 망치 — Slender haft + compact winged guard + sleek gold-capped drum
  royalpaladin: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.2, -1.0, -0.8, 1.2, "gold"),
        R(-1.0, 3.5, -0.45 - p * 0.3, 0.85 + p * 0.3, "crimson"),
        R(3.5, 9.2, -0.45 - p * 0.3, 0.85 + p * 0.3, "steel"),
        P([[5.8, -2.5], [7.6, -1.2], [7.6, 1.6], [5.8, 2.9], [6.6, 0.2]], "steel"),
        R(9.5, 14.2, -4.0, 4.4, "crimson"),
        R(9.9, 13.8, -1.8, 2.2, "steel"),
        R(9.1, 14.6, -5.2, -3.5, "gold"),
        R(9.1, 14.6, 3.9, 5.6, "gold"),
        P([[14.2, -0.9], [16.8, 0.2], [14.2, 1.3]], "gold"),
        C(11.8, 0.2, 1.1, "glint"), D(11.8, 0.2, "ruby"),
      ],
      head: [9.1, 16.8, -5.2, 5.6],
      blade: ["steel", "gold"],
    };
  },

  // 2) 혈철 마신 대형 망치 — Slender haft + sleek horned blood-iron maul with dark eye socket
  bloodforge: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.2, 2.4, -0.6 - p * 0.3, 1.0 + p * 0.3, "crimson"),
        R(2.4, 9.2, -0.45 - p * 0.3, 0.85 + p * 0.3, "ironDark"),
        R(5.0, 6.2, -0.9, 1.3, "crimson"),
        P([[9.0, -4.8], [10.4, -5.5], [13.4, -5.5], [14.8, -4.6], [14.0, -2.4], [14.0, 2.8],
           [14.8, 5.0], [13.4, 5.9], [10.4, 5.9], [9.0, 5.2], [9.8, 2.8], [9.8, -2.4]], "bloodIron"),
        C(11.9, 0.2, 1.1, "ironDark"), D(11.9, 0.2, null),
        L(10.4, -4.4, 13.6, -4.4, "ember"), L(10.4, 4.8, 13.6, 4.8, "ember"),
      ],
      head: [9.0, 14.8, -5.5, 5.9],
      blade: ["bloodIron"],
    };
  },

  // 3) 황금 곡괭이 망치 — Slender bronze shaft + compact gold drum & sleek pick beak
  sumpick: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.2, -1.0, -0.8, 1.2, "gold"),
        R(-1.0, 9.4, -0.45 - p * 0.3, 0.85 + p * 0.3, "bronze"),
        P([[6.8, -0.8], [8.6, -2.2], [10.2, -2.2], [10.2, 2.6], [8.6, 2.6], [6.8, 1.2]], "gold"),
        R(9.4, 14.2, -1.9, 2.3, "crimson"),
        R(9.0, 14.6, -5.2, -1.9, "gold"),
        L(10.2, -4.9, 13.6, -4.9, "silver"),
        P([[9.8, 2.2], [13.4, 2.2], [14.2, 4.0], [12.4, 6.0], [11.0, 6.0], [11.4, 4.0], [9.8, 2.8]], "gold"),
        D(11.8, 0.2, "amberCore"), P([[14.2, -0.9], [16.5, 0.2], [14.2, 1.3]], "gold"),
      ],
      head: [9.0, 16.5, -5.2, 6.0],
      blade: ["gold"],
    };
  },

  // 4) 쌍룡 도끼 망치 — Slender dark haft + clean coiled gold collar + sharp wedge axe-maul
  dragoncleave: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.2, 3.6, -0.6 - p * 0.3, 1.0 + p * 0.3, "ironDark"),
        R(3.6, 9.2, -0.45 - p * 0.3, 0.85 + p * 0.3, "ironDark"),
        C(5.8, 0.2, 1.0, "steel"), D(5.8, 0.2, "glint"),
        P([[7.5, -2.5], [9.6, -3.5], [10.4, -1.2], [10.4, 1.8], [9.6, 3.9], [7.5, 3.1], [8.6, 0.2]], "gold"),
        P([[9.8, -5.2], [14.8, -5.2], [16.6, -2.6], [15.8, 3.0], [12.8, 5.6], [10.2, 4.6], [9.8, 1.6]], "steel"),
        L(14.2, -4.8, 16.0, -2.4, "glint"), L(16.0, -2.4, 15.4, 2.8, "glint"),
        C(11.4, 0.2, 0.95, "gold"),
      ],
      head: [9.8, 16.6, -5.2, 5.6],
      blade: ["steel"],
    };
  },

  // 5) 태엽 강철 톱니 망치 — Slender haft + trim dark gold-banded drum opposite clean anvil
  gearfoundry: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.2, 2.8, -0.6 - p * 0.3, 1.0 + p * 0.3, "leather"),
        R(2.8, 9.4, -0.45 - p * 0.3, 0.85 + p * 0.3, "ironDark"),
        R(9.0, 14.0, -1.9, 2.3, "ironDark"),
        C(11.4, 0.2, 0.9, "gold"),
        P([[8.6, -4.4], [9.8, -5.4], [14.0, -5.4], [15.2, -4.4], [15.2, -2.6], [14.0, -1.8], [9.4, -1.8], [8.6, -2.8]], "ironDark"),
        R(8.8, 14.8, -4.4, -3.7, "gold"), R(8.8, 14.8, -2.9, -2.2, "gold"),
        R(9.6, 13.6, 2.2, 5.2, "steel"), R(9.8, 13.4, 3.4, 4.3, "gold"),
        P([[14.0, -0.8], [16.4, 0.2], [14.0, 1.2]], "steel"),
      ],
      head: [8.6, 16.4, -5.4, 5.2],
      blade: ["ironDark", "gold"],
    };
  },

  // 6) 심홍 성당 십자 망치 — Slender haft + trim gold-capped crimson tower vs sharp spike
  cathedral: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        P([[-2.4, -1.4], [-0.8, -0.7], [-0.8, 1.1], [-2.4, 1.8]], "gold"),
        R(-0.8, 9.4, -0.45 - p * 0.3, 0.85 + p * 0.3, "ironDark"),
        R(9.0, 14.0, -2.0, 2.4, "gold"),
        R(9.0, 14.2, -5.2, -2.0, "crimson"),
        R(8.6, 14.6, -5.2, -3.7, "gold"),
        P([[9.6, 2.4], [13.4, 2.4], [11.9, 6.0], [11.1, 6.0]], "crimson"),
        R(10.2, 12.8, 2.8, 3.7, "gold"),
        P([[14.0, -0.8], [16.8, 0.2], [14.0, 1.2]], "crimson"),
        D(11.5, 0.2, "ruby"),
      ],
      head: [8.6, 16.8, -5.2, 6.0],
      blade: ["gold", "crimson"],
    };
  },

  // 7) 빙결 쌍보주 망치 — Slender gold spear-haft + twin compact crystal spheres
  glacierorb: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        C(-1.4, 0.2, 0.9, "bronze"),
        R(-0.8, 10.2, -0.45 - p * 0.3, 0.85 + p * 0.3, "gold"),
        R(9.4, 13.6, -1.8, 2.2, "gold"),
        C(11.6, -3.4, 2.1, "glacier"),
        C(11.6, 3.8, 2.1, "glacier"),
        D(11.0, -4.0, "glint"), D(11.0, 3.2, "glint"),
        P([[12.0, -1.1], [17.0, 0.2], [12.0, 1.5]], "gold"),
        D(14.2, 0.2, "spark"),
      ],
      head: [9.4, 17.0, -5.5, 5.9],
      blade: ["glacier"],
    };
  },

  // 8) 심안 광기 모닝스타 — Slender smooth curved oak haft + compact spoked sun-eye flail ball
  eyeabyss: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        P([[-2.2, 0.8 - p * 0.2], [1.6, 1.7 - p * 0.2], [5.2, 0.0 - p * 0.2], [9.0, -0.8 - p * 0.2], [9.4, 0.4 + p * 0.2], [5.4, 1.3 + p * 0.2], [1.6, 2.9 + p * 0.2], [-2.0, 2.0 + p * 0.2]], "oak"),
        C(11.0, -3.1, 1.6, "gold"),
        P([[8.8, -1.0], [8.6, -3.2], [10.6, -2.4], [11.8, -5.2], [13.0, -2.6], [15.6, -3.2], [14.2, -0.3],
           [16.8, 0.3], [14.2, 1.4], [15.6, 4.0], [13.0, 3.2], [11.8, 5.6], [10.6, 3.0], [8.6, 3.8], [8.8, 1.4]], "silver"),
        C(11.8, 0.2, 1.4, "ironDark"),
        C(11.8, 0.2, 0.95, "amberCore"),
        D(11.8, -0.1, "glint"),
      ],
      head: [8.6, 16.8, -5.2, 5.6],
      blade: ["silver"],
    };
  },

  // 9) 전쟁공방 쇠망치 — Sleek knight's Lucerne warhammer with chamfered cap & slender spike
  warforge: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        C(-1.4, 0.2, 0.9, "steel"),
        R(-0.8, 10.0, -0.45 - p * 0.3, 0.85 + p * 0.3, "ironDark"),
        R(2.8, 3.8, -0.8, 1.2, "gold"),
        R(9.2, 13.8, -1.6, 2.0, "steel"),
        P([[9.2, -1.6], [9.2, -4.6], [10.0, -5.4], [13.0, -5.4], [13.8, -4.6], [13.8, -1.6]], "gold"),
        R(9.8, 13.2, -3.2, -1.6, "crimson"),
        P([[10.2, 2.0], [13.0, 2.0], [12.0, 6.0], [11.2, 6.0]], "steel"),
        D(11.5, 0.2, "amberCore"),
      ],
      head: [9.2, 13.8, -5.4, 6.0],
      blade: ["gold", "steel"],
    };
  },

  // 10) 유성운철 대형 망치 — Slender haft + compact chamfered octagon stone maul with magma cracks
  meteor: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.2, -1.0, -0.8, 1.2, "bronze"),
        R(-1.0, 9.2, -0.45 - p * 0.3, 0.85 + p * 0.3, "oak"),
        R(8.0, 9.5, -1.1, 1.5, "bronze"),
        P([[9.2, -2.8], [10.6, -5.0], [14.2, -5.0], [15.6, -2.8], [15.6, 3.4], [14.2, 5.4], [10.6, 5.4], [9.2, 3.4]], "meteor"),
        L(10.8, -3.8, 12.4, -1.0, "ember"), L(12.4, -1.0, 14.0, -2.8, "ember"),
        L(10.8, 4.0, 12.4, 1.4, "ember"),  L(12.4, 1.4, 14.0, 3.2, "ember"),
        C(12.4, 0.2, 1.1, "amberCore"), D(12.1, -0.1, "spark"),
      ],
      head: [9.2, 15.6, -5.0, 5.4],
      blade: ["meteor", "amberCore"],
    };
  },
};

// ───────────────────────────── 4. RASTERISERS (mirror weapons.js hammer 40×36 @ 1.25×) ─────────────────────────────

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
    const v = HAMMER_COLLECTION_M[m] ?? HAMMER_COLLECTION_EXTRA[m] ?? "#ff00ff";
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

export function renderHammerWorld(silKey, opts = {}) {
  const fn = HAMMER_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown hammer silhouette: ${silKey}`);
  const d = fn(false);
  const wq = opts.wq | 0, we = opts.we | 0;
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const inks = we >= 10 ? [RARE_INK[wq] || INK, GLOW10] : [RARE_INK[wq] || INK];
  const [ox, oy] = GRIP;
  const scale = 1.25;
  const c = rasterShapes(d.sh, 40, 36, (s, t) => [ox + s * scale, oy + t * scale], (x, y) => [(x - ox) / scale, (y - oy) / scale], glow);
  return outlineCanvas(c, inks);
}

export function renderHammerIcon(silKey, opts = {}) {
  const fn = HAMMER_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown hammer silhouette: ${silKey}`);
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
