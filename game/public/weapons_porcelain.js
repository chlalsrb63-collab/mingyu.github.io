/**
 * 백자 청화 어전무구 (Porcelain & Cobalt Armory) — Weapon Skins Bundle (7 kinds).
 *
 * Designed to complement any equipment theme with a crisp porcelain-white glaze,
 * deep cobalt underglaze wave/cloud bands, dark mahogany shafts, brushed bronze
 * fittings, and a crimson kiln seal stamp.
 *
 * Integration targets (handled separately by the integrator):
 *   1. game/public/weapons.js  — merge PORCELAIN_M / PORCELAIN_EXTRA into M / EXTRA,
 *                                register PORCELAIN_SHAPES under SIL[kind][silKey],
 *                                add MOTIF_SIL[kind].porcelain = silKey, and register PORCELAIN_MOTIF.
 *   2. game/src/logic/65-cosmetics.js — add ws_porcelain_sword .. ws_porcelain_hammer entries
 *                                        (slot: "wskin", wk: <kind>, motif: "porcelain_<kind>").
 */

import { EQUIP_ICON_SIZE, weaponIconProjection } from "./gear_icons.js";

const GRIP = [5, 16];
const INK = "#2b2233";
const RARE_INK = [INK, "#2c4a8c", "#8a6a14", "#9a4a12", "#1f6a3a"];
const ICON_INK = "#111118";
const GLOW7 = "#fff2a8";
const GLOW10 = "#ffd84a";

// ───────────────────────────── palette additions ─────────────────────────────
export const PORCELAIN_M = {
  porcelain: ["#ffffff", "#eaeef8", "#b4bfd8"],
  cobalt: ["#68a4ff", "#2e62c8", "#1c367c"],
  cobalt_dk: ["#3a64b8", "#203e88", "#142254"],
  mahogany: ["#8a4a44", "#5c2e2c", "#381c22"],
  bronze: ["#ffe090", "#d49c3a", "#8a5a1e"],
  steel: ["#e2e8f0", "#b4bcc9", "#7a7f98"],
  // flat accents & strings
  seal: "#ff5c4a",
  ink_cobalt: "#1e3a8a",
  wrap: "#3a2630",
  shaft: "#e8cc94",
  mahogany_str: "#f0e2c8",
};

// ───────────────────────────── item & integration metadata ─────────────────────────────
export const PORCELAIN_WEAPONS = [
  {
    id: "ws_porcelain_sword",
    silKey: "porcelain_sword",
    motif: "porcelain",
    wk: "sword",
    slot: "wskin",
    name: "백자 청화 참마도",
    desc: "백자 유약 검신에 청화 구름문과 주사 인장을 새긴 어전 대검 외형.",
    acquire: "단풍 왕도 / 도공 장인 교환 (버드나무 토큰 120개 또는 45,000 골드)",
  },
  {
    id: "ws_porcelain_dagger",
    silKey: "porcelain_dagger",
    motif: "porcelain",
    wk: "dagger",
    slot: "wskin",
    name: "청화 연잎 비수",
    desc: "연잎 모양으로 넓게 깎은 순백 도자기 단검과 붉은 매듭 술.",
    acquire: "단풍 왕도 상점 외형 도안 (버드나무 토큰 90개 또는 32,000 골드)",
  },
  {
    id: "ws_porcelain_spear",
    silKey: "porcelain_spear",
    motif: "porcelain",
    wk: "spear",
    slot: "wskin",
    name: "청화 삼지 월아창",
    desc: "자단 자루 끝에 반달 월아와 청화 백자 창날을 얹은 의장 장창.",
    acquire: "단풍 왕도 근위 병기고 (버드나무 토큰 120개 또는 45,000 골드)",
  },
  {
    id: "ws_porcelain_staff",
    silKey: "porcelain_staff",
    motif: "porcelain",
    wk: "staff",
    slot: "wskin",
    name: "청화 달항아리 향로봉",
    desc: "청동 틀 안에 백자 달항아리 향로를 얹은 도공 학자의 지팡이.",
    acquire: "토벌 의뢰 보상 상자 / 가마 장인 교환 (버드나무 토큰 110개)",
  },
  {
    id: "ws_porcelain_book",
    silKey: "porcelain_book",
    motif: "porcelain",
    wk: "book",
    slot: "wskin",
    name: "청화 가마 비결서",
    desc: "청화 표지에 도공 인장을 새긴 고법 탁본 마도서.",
    acquire: "학자 길드 외형 도안 (버드나무 토큰 110개 또는 40,000 골드)",
  },
  {
    id: "ws_porcelain_bow",
    silKey: "porcelain_bow",
    motif: "porcelain",
    wk: "bow",
    slot: "wskin",
    name: "청화 백자 각궁",
    desc: "자단 대잡이에 순백 만곡 도자 날개를 이은 정교한 어전 각궁.",
    acquire: "단풍 왕도 궁수 훈련장 (버드나무 토큰 120개 또는 45,000 골드)",
  },
  {
    id: "ws_porcelain_hammer",
    silKey: "porcelain_hammer",
    motif: "porcelain",
    wk: "hammer",
    slot: "wskin",
    name: "청화 백자 대절구망치",
    desc: "청동 테를 두른 백자 절구통 머리에 가마 낙관을 찍은 양손해머.",
    acquire: "필드 보스 외형 전리품 / 버드나무 토큰 140개",
  },
];

// ───────────────────────────── shape constructors (weapons.js compatible) ─────────────────────────────
const R = (s0, s1, t0, t1, m, o) => ({ k: "p", pts: [[s0, t0], [s1, t0], [s1, t1], [s0, t1]], m, ...o });
const P = (pts, m, o) => ({ k: "p", pts, m, ...o });
const C = (s, t, r, m, o) => ({ k: "c", s, t, r, m, ...o });
const L = (s0, t0, s1, t1, m, o) => ({ k: "l", a: [s0, t0], b: [s1, t1], m, top: true, ...o });
const D = (s, t, m, o) => ({ k: "d", s, t, m, top: true, ...o });

const RISER = 7;
const NOCK_FULL = -3.5;
const ARROW_LEN = 14;

function bowParts(b, o, icon) {
  const p = Math.max(-0.25, Math.min(1, o.pull || 0));
  const dr = Math.max(0, p);
  const k = icon ? 1.3 : 1;
  const T = b.T - 1.2 * dr;
  const tipS = b.tip - 1.4 * dr + 1.2 * Math.max(0, -p);
  const g = b.g;
  const r = RISER;
  const span = Math.max(1, T - g);
  const c = (t) => {
    const u = Math.max(0, Math.min(1, (Math.abs(t) - g) / span));
    return r - (r - tipS) * u * u + (b.rc || 0) * Math.max(0, (u - 0.68) / 0.32) ** 2;
  };
  const sh = [];
  const post = [];
  for (const sg of [-1, 1]) {
    const L0 = [];
    const L1 = [];
    const n = 10;
    const u0 = b.gap ? b.gap / span : 0;
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((1 - u0) * i) / n;
      const t = sg * (g + span * u);
      const w = (b.w0 + (b.w1 - b.w0) * u) * k;
      L0.push([c(t) - w / 2, t]);
      L1.unshift([c(t) + w / 2, t]);
    }
    sh.push(P(L0.concat(L1), b.mat));
  }
  const nock = p >= 0 ? tipS + p * (NOCK_FULL - tipS) : tipS - p * 6;
  const ts = c(T) - 0.4;
  const tt = T - 0.6;
  if (Math.abs(nock - ts) < 0.3) post.push(L(ts, -tt, ts, tt, b.str));
  else post.push(L(ts, -tt, nock, 0, b.str), L(nock, 0, ts, tt, b.str));
  if (o.arrow) {
    const a = nock;
    const h = a + ARROW_LEN;
    sh.push(
      L(a + 1, 0, h - 1, 0, "shaft"),
      P([[a + 0.6, -1.4], [a + 3.6, -0.4], [a + 3.6, 0.2], [a + 0.6, 0.2]], b.fl || "cobalt"),
      P([[a + 0.6, 0.8], [a + 3.6, 0.8], [a + 3.6, 1.4], [a + 0.6, 2.4]], b.fl || "cobalt"),
      P([[h - 1.6, -1.6], [h + 2.8, 0.5], [h - 1.6, 2.6]], "steel"),
    );
  }
  return { sh, post, c, T, tipS };
}

const bow = (b, extra) => (icon, o = {}) => {
  const pt = bowParts(b, o, icon);
  const k = icon ? 1.15 : 1;
  const ex = extra(pt.c, pt.T, pt.tipS, k);
  const arrow = o.arrow ? pt.sh.splice(2) : [];
  return {
    sh: [...pt.sh, ...ex.sh, ...arrow],
    post: [...pt.post, ...(ex.post || [])],
    head: [-pt.T + 1, pt.T - 1, -(b.w0 * k) / 2 - 0.3, (b.w0 * k) / 2 + 0.3],
    limb: pt.c,
    blade: [b.mat],
    edgeX: true,
  };
};

// ───────────────────────────── 7 bespoke weapon silhouettes ─────────────────────────────
export const PORCELAIN_SHAPES = {
  // 1. 백자 청화 참마도 — swept blade with a bronze guard and a cobalt spine wave
  sword: () => ({
    sh: [
      C(-2.4, 0.5, 1.8, "bronze"),
      D(-2.4, 0.5, "seal"),
      R(-1, 4, -1.5, 2, "mahogany"),
      L(1, -1, 1, 1, "wrap"),
      L(3, -1, 3, 1, "wrap"),
      P([[3.5, -3.5], [5, -4.5], [7, -2.5], [7, 3.5], [5, 5.5], [3.5, 4.5]], "bronze"),
      D(5, 0.5, "seal"),
      P([[6, -2], [22, -3], [36, -4.5], [30, 0], [21, 3], [6, 3]], "porcelain"),
      P([[7, -2], [22, -3], [34, -4], [27, -1.5], [17, -0.5], [7, -0.5]], "cobalt"),
      L(11, 0, 15, 0, "ink_cobalt"),
      L(18, -1, 22, -1, "ink_cobalt"),
      L(25, -2, 29, -2, "ink_cobalt"),
      R(8, 10, 0, 2, "seal", { top: true }),
    ],
    head: [7, 36, -4.5, 3],
    blade: ["porcelain"],
  }),

  // 2. 청화 연잎 비수 — broad lotus-leaf parrying dagger with crescent guard & red tassel
  dagger: () => ({
    sh: [
      P([[-3.5, 1], [-1.5, 1], [-1, 5], [-3.5, 4]], "seal"),
      R(-3, -1.5, -1, 2, "bronze"),
      R(-1.5, 3, -1.5, 2, "mahogany"),
      L(1, -1, 1, 1, "bronze"),
      P([[2.5, -4], [4.5, -5], [5.5, -2], [5.5, 3], [4.5, 6], [2.5, 5]], "bronze"),
      D(3.8, 0.5, "cobalt_dk"),
      // Chunky lotus-leaf porcelain blade
      P([[5, -2.5], [9, -4], [13.5, -2.5], [16.5, 0.5], [13.5, 3.5], [9, 4.5], [5, 2.5]], "porcelain"),
      L(6, 0, 14, 0, "cobalt"),
      L(8, -2, 11, -1, "ink_cobalt"),
      L(8, 2, 11, 1, "ink_cobalt"),
      D(6, 0.5, "seal"),
    ],
    head: [5, 16.5, -4, 4.5],
    blade: ["porcelain"],
  }),

  // 3. 청화 삼지 월아창 — mahogany pole, asymmetrical crescent moon-blade + glazed leaf point
  spear: (icon) => {
    const sStart = icon ? 4 : -4;
    const my = -6;
    return {
      sh: [
        R(sStart, 31, 0, icon ? 2.4 : 1, "mahogany"),
        R(sStart, sStart + 2, -1, 2.4, "bronze"),
        R(icon ? 12 : 9, icon ? 14 : 11, -1, 2.2, "bronze"),
        R(21, 23, -1, 2.2, "bronze"),
        P([[28, 1.5], [31.5, 1.5], [29.5, 5], [25.5, 5]], "seal"),
        R(29, 33, -1.5, 2.5, "bronze"),
        // Asymmetrical crescent moon side blade (월아)
        P([[30, -1], [34, -5], [39, my], [42, -5], [36, -3], [33, 0]], "cobalt"),
        P([[34, -4.5], [39, -5.5], [41, -5], [36, -3.5]], "porcelain"),
        // Counter bronze claw
        P([[30, 2], [34, 4.5], [38, 5], [34, 2]], "bronze"),
        // Central elongated porcelain leaf spearhead
        P([[32, -1.5], [36, -2.5], [45.5, 0.5], [36, 3.5], [32, 2.5]], "porcelain"),
        L(33, 0, 42, 0, "cobalt"),
        D(34, 0.5, "seal"),
      ],
      head: [30, 45.5, my, 5],
      blade: ["porcelain"],
    };
  },

  // 4. 청화 달항아리 향로봉 — mahogany staff with bronze cradle framing a glazed moon-jar censer
  staff: (icon) => ({
    sh: [
      R(-4, 15, 0, icon ? 2.2 : 1, "mahogany"),
      R(-4, -2, -1, 2.2, "bronze"),
      R(12, 15, -1.5, 2.5, "bronze"),
      // Bronze censer frame
      P([[14, -2], [16, -6.5], [20, -7], [17.5, -3], [16, 0], [17.5, 4], [20, 8], [16, 7.5], [14, 3]], "bronze"),
      R(17.5, 19.5, -7, -5, "seal"),
      R(17.5, 19.5, 6, 8, "seal"),
      // Glazed moon-vase orb
      C(20, 0.5, 3.5, "porcelain"),
      R(18, 22, -1.5, 2.5, "cobalt"),
      R(19, 21, -0.5, 1.5, "porcelain"),
      D(20, 0.5, "seal"),
      // Censer lid tip
      P([[23, -1], [25, 0.5], [23, 2]], "bronze"),
    ],
    head: [15, 25, -7, 8],
    blade: ["porcelain"],
  }),

  // 5. 청화 가마 비결서 — a closed cobalt-bound book with an inlaid potter's seal
  book: () => ({
    sh: [
      P([[-5, -4.5], [4.5, -4.5], [6, -3], [6, 6], [4.5, 7], [-4.5, 7], [-5, 6]], "cobalt_dk"),
      P([[-4, 4], [5.5, 4], [5.5, 5.5], [4.5, 6], [-4, 6]], "porcelain"),
      P([[-5, -5.5], [4, -5.5], [5, -4.5], [5, 4], [4, 5], [-5, 5]], "cobalt"),
      P([[-5.5, -4.5], [-4, -5.5], [-3.5, -5.5], [-3.5, 6.5], [-5, 6], [-5.5, 5]], "mahogany"),
      R(3, 4.5, -5, -3.5, "bronze"), R(3, 4.5, 3, 4.5, "bronze"),
      P([[-2.5, -2], [3.5, -2], [3.5, 1.5], [2.5, 2.5], [-1.5, 2.5], [-2.5, 1.5]], "porcelain"),
      D(0, -1, "seal"), L(-1, 1, 2, 1, "ink_cobalt"),
    ],
    head: [-3.5, 4.5, -4.5, 4.5],
    blade: ["cobalt"],
  }),

  // 6. 청화 백자 각궁 — recurve porcelain limbs with cobalt glaze bands & mahogany-bronze grip
  bow: bow(
    { T: 12, tip: 2.0, g: 3.0, w0: 3.2, w1: 2.0, rc: 3.0, mat: "porcelain", str: "mahogany_str", fl: "cobalt" },
    (c, T, _tip, k) => ({
      sh: [
        P(
          [
            [RISER - 1.6 * k, -4],
            [RISER + 1.5 * k, -3.5],
            [RISER + 2.2 * k, 0],
            [RISER + 1.5 * k, 3.5],
            [RISER - 1.6 * k, 4],
          ],
          "mahogany",
        ),
        R(RISER - 1.2 * k, RISER + 1.2 * k, -3.5, -2.5, "bronze"),
        R(RISER - 1.2 * k, RISER + 1.2 * k, 2.5, 3.5, "bronze"),
        D(RISER + 0.5, 0, "seal"),
        // Cobalt glaze bands along upper & lower porcelain limbs (placed squarely inside limb width)
        ...[-1, 1].map((sg) => R(c(sg * (T - 4.8)) - 1.1, c(sg * (T - 4.8)) + 1.1, sg * (T - 5.4), sg * (T - 3.8), "cobalt")),
        // Bronze horn nock caps
        ...[-1, 1].map((sg) => C(c(sg * T) + 0.1, sg * (T - 0.5), 1.1 * k, "bronze")),
      ],
    }),
  ),

  // 7. 청화 백자 대절구망치 — twin-flared ceramic mortar drum head banded in cobalt & bronze
  hammer: () => ({
    sh: [
      R(-2.6, 12, -1.5, 2, "mahogany"),
      R(-2.8, -1.6, -2.2, 2.5, "bronze"),
      R(-0.5, 5, -2, 2.5, "cobalt"),
      L(1, -2, 1, 2, "bronze"),
      L(3.5, -2, 3.5, 2, "bronze"),
      R(8.5, 11.5, -3, 3.5, "bronze"),
      // A tapered ceramic drum with cobalt rings and bronze striking faces.
      P([[11, -5], [13, -8], [19, -8], [21, -6], [19, 0.5], [21, 7],
        [19, 9], [13, 9], [11, 6], [10, 3], [10, -2]], "porcelain"),
      R(12, 20, -6.5, -5, "cobalt"), R(12, 20, 6, 7.5, "cobalt"),
      R(13, 19, -8.5, -7, "bronze"), R(13, 19, 8, 9.5, "bronze"),
      // Waist belt & crimson potter's seal
      R(12, 19, -2.5, 2.5, "mahogany"),
      C(15.5, 0, 2.0, "bronze"),
      D(15.5, 0, "seal"),
    ],
    head: [10, 21, -8.5, 9.5],
    blade: ["porcelain"],
  }),
};

// Optional fallback MOTIF tint for arbitrary silhouettes in weapons.js
export const PORCELAIN_MOTIF = {
  porcelain: {
    name: "백자 청화",
    blade: PORCELAIN_M.porcelain,
    fit: PORCELAIN_M.bronze,
    add: (h) => [
      L(h[0] + 2, (h[2] + h[3]) / 2 - 0.5, h[1] - 2, (h[2] + h[3]) / 2 - 0.5, "cobalt"),
      D(h[0] + 3, (h[2] + h[3]) / 2, "seal"),
    ],
  },
};

// ───────────────────────────── standalone rasterizer (matches weapons.js) ─────────────────────────────
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function inPoly(pts, s, t) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [si, ti] = pts[i];
    const [sj, tj] = pts[j];
    if ((ti > t) !== (tj > t) && s < ((sj - si) * (t - ti)) / (tj - ti) + si) c = !c;
  }
  return c;
}

function raster(shapes, W, H, xf, inv, glow) {
  const N = W * H;
  const mat = new Array(N).fill(null);
  const top = new Array(N).fill(null);
  const box = (sh) => {
    let pts = sh.k === "p"
      ? sh.pts
      : [[sh.s - sh.r, sh.t - sh.r], [sh.s + sh.r, sh.t + sh.r], [sh.s - sh.r, sh.t + sh.r], [sh.s + sh.r, sh.t - sh.r]];
    pts = pts.map(([s, t]) => xf(s, t));
    return [
      Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))) - 1),
      Math.min(W - 1, Math.ceil(Math.max(...pts.map((p) => p[0]))) + 1),
      Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))) - 1),
      Math.min(H - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))) + 1),
    ];
  };
  const put = (grid, x, y, m) => { if (x >= 0 && y >= 0 && x < W && y < H) grid[y * W + x] = m; };
  const line = (grid, sh) => {
    let [x0, y0] = xf(sh.a[0] + 0.5, sh.a[1] + 0.5);
    let [x1, y1] = xf(sh.b[0] + 0.5, sh.b[1] + 0.5);
    x0 = Math.floor(x0);
    y0 = Math.floor(y0);
    x1 = Math.floor(x1);
    y1 = Math.floor(y1);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      put(grid, Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1)), sh.m);
    }
  };
  for (const sh of shapes) {
    const grid = sh.top ? top : mat;
    if (sh.k === "l") { line(grid, sh); continue; }
    if (sh.k === "d") {
      const [x, y] = xf(sh.s + 0.5, sh.t + 0.5);
      put(grid, Math.floor(x), Math.floor(y), sh.m);
      continue;
    }
    const [x0, x1, y0, y1] = box(sh);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const [s, t] = inv(x + 0.5, y + 0.5);
        const hit = sh.k === "p" ? inPoly(sh.pts, s, t) : (s - sh.s) ** 2 + (t - sh.t) ** 2 <= sh.r * sh.r;
        if (!hit) continue;
        if (sh.m === null) {
          mat[y * W + x] = null;
          top[y * W + x] = null;
        } else {
          grid[y * W + x] = sh.m;
        }
      }
    }
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const img = g.createImageData(W, H);
  const d = img.data;
  const colOf = (m, part) => {
    const v = PORCELAIN_M[m] ?? "#ff00ff";
    return typeof v === "string" ? v : v[part];
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let col = null;
      if (top[i]) col = colOf(top[i], 1);
      else if (mat[i]) {
        const m = mat[i];
        const up = y > 0 ? mat[i - W] : null;
        const dn = y < H - 1 ? mat[i + W] : null;
        const lit = up !== m;
        const dark = dn !== m;
        col = colOf(m, lit && !dark ? 0 : dark && !lit ? 2 : lit ? 0 : 1);
        if (glow && glow.blade.includes(m) && (glow.edgeX ? (x < W - 1 ? mat[i + 1] : null) !== m : lit)) {
          col = glow.col;
        }
      }
      if (!col) continue;
      const [r, gg, b] = hexRgb(col);
      d[i * 4] = r;
      d[i * 4 + 1] = gg;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function outline(c, inks) {
  const g = c.getContext("2d");
  const W = c.width;
  const H = c.height;
  for (const ink of inks) {
    const src = g.getImageData(0, 0, W, H).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
    g.fillStyle = ink;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
          g.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  return c;
}

function paint(d, W, H, xf, inv, glow, inks) {
  const c = raster(d.sh, W, H, xf, inv, glow);
  outline(c, inks);
  if (d.post && d.post.length) {
    c.getContext("2d").drawImage(raster(d.post, W, H, xf, inv, null), 0, 0);
  }
  return c;
}

export function porcelainWeaponSprite(kind, gear = {}, bowOpts = null) {
  const design = PORCELAIN_SHAPES[kind];
  if (!design) throw new Error(`Unknown porcelain weapon kind: ${kind}`);
  const book = kind === "book";
  const hammer = kind === "hammer";
  const W = kind === "spear" ? 52 : kind === "sword" ? 44 : hammer ? 40 : 32;
  const H = hammer ? 36 : 32;
  const ox = book ? 16 : GRIP[0];
  const oy = 16;
  const wq = Math.max(0, Math.min(4, gear.wq | 0));
  const we = gear.we | 0;
  const d = design(false, bowOpts || undefined);
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7, edgeX: !!d.edgeX } : null;
  const scale = hammer ? 1.25 : book ? 0.85 : 1;
  return paint(
    d,
    W,
    H,
    (s, t) => [ox + s * scale, oy + t * scale],
    (x, y) => [(x - ox) / scale, (y - oy) / scale],
    glow,
    we >= 10 ? [RARE_INK[wq] || INK, GLOW10] : [RARE_INK[wq] || INK],
  );
}

export function porcelainBowSprite(gear = {}, pull = 0, arrow = false) {
  const q = Math.max(-2, Math.min(8, Math.round(pull * 8)));
  return porcelainWeaponSprite("bow", gear, { pull: q / 8, arrow: !!arrow, q });
}

export function porcelainWeaponIcon(kind, o = {}) {
  const design = PORCELAIN_SHAPES[kind];
  if (!design) throw new Error(`Unknown porcelain weapon kind: ${kind}`);
  const we = o.we | 0;
  const d = design(true, kind === "bow" ? { pull: 0.4, arrow: true } : undefined);
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const { xf, inv } = weaponIconProjection(kind, d.sh.concat(d.post || []));
  return paint(d, EQUIP_ICON_SIZE, EQUIP_ICON_SIZE, xf, inv, glow, we >= 10 ? [ICON_INK, GLOW10] : [ICON_INK]);
}
