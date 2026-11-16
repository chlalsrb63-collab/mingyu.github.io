/**
 * 단검 무기 외형 컬렉션 (Daggers & Dirk Collection — 10 Designs).
 *
 * Refined sleek Tales Tales `dagger` geometry (`W=32, H=32, GRIP=[5, 16]`):
 * razor-slim blades (`t ∈ [-1.4, +1.8]` = ~3px sleek profile tapering to `s = 18.5..19`),
 * light tapered crossguards (`t ∈ [-4.5, 4.5]`), and smooth symmetrical contours.
 *
 * Zero `src/logic.js` / `weapons.js` files modified.
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

export const DAGGER_COLLECTION_M = {
  steel:      ["#edf2fa", "#b4c0d4", "#6e7894"],
  leather:    ["#946044", "#663c2c", "#3e2226"],
  gold:       ["#fff09e", "#f0b844", "#a06420"],
  amber:      ["#ffdf8a", "#f28524", "#9e381c"],
  crimson:    ["#ff8878", "#d63834", "#841c2c"],
  frost:      ["#f2fcff", "#84c7f2", "#3566b0"],
  cyan:       ["#b8ffff", "#38d8e6", "#167696"],
  obsidian:   ["#6a7086", "#35384c", "#1c1d2b"],
  feather:    ["#adb4cc", "#646a84", "#32354a"],
  darkCrimson:["#b84452", "#681a2c", "#360e1c"],
  roseBlade:  ["#ffd0de", "#e8789c", "#993c62"],
  mintJade:   ["#c2fce2", "#5ad49e", "#287a5e"],
  bronze:     ["#ffe0a4", "#c88842", "#7a4424"],
};

export const DAGGER_COLLECTION_EXTRA = {
  glint:    "#ffffff",
  spark:    "#fff4a0",
  boltCyan: "#7cf8ff",
  lava:     "#ffae38",
  ruby:     "#ff4860",
  amethyst: "#d478ff",
  darkLine: "#343046",
  scarletE: "#ff5c5c",
};

export const DAGGER_COLLECTION_META = [
  { id: "ws_dagger_silversteel",   silKey: "silversteel",   wk: "dagger", slot: "wskin", name: "은빛 기사단 단검",   desc: "날씬한 S자 백은 코등이와 예리한 은빛 양날 단검." },
  { id: "ws_dagger_sunburst",      silKey: "sunburst",      wk: "dagger", slot: "wskin", name: "홍염 태양 단검",     desc: "화염 띠가 선명한 황금빛 날렵한 태양 단검." },
  { id: "ws_dagger_frostglaive",   silKey: "frostglaive",   wk: "dagger", slot: "wskin", name: "빙하 결정 단검",     desc: "서릿발 곡선 코등이 위로 얼음빛 날이 뻗은 빙결 비수." },
  { id: "ws_dagger_midnightcross", silKey: "midnightcross", wk: "dagger", slot: "wskin", name: "성은 스틸레토",      desc: "가느다란 흑철 코등이에 바늘처럼 뻗은 암살자 스틸레토." },
  { id: "ws_dagger_solardisk",     silKey: "solardisk",     wk: "dagger", slot: "wskin", name: "해시계 아쿠아 비수", desc: "단정한 황금 원반 코등이 위로 시안 수정 날이 뻗은 비수." },
  { id: "ws_dagger_vortexcyan",    silKey: "vortexcyan",    wk: "dagger", slot: "wskin", name: "심해 아쿠아 단검",   desc: "날렵한 붉은 뿔 가드 사이로 청록 마력 날이 뻗은 단검." },
  { id: "ws_dagger_shadowfeather", silKey: "shadowfeather", wk: "dagger", slot: "wskin", name: "칠흑 깃털 번개 단검", desc: "매끈한 흑깃 날개 코등이와 푸른 번개 문양의 강철 비수." },
  { id: "ws_dagger_moltenvein",    silKey: "moltenvein",    wk: "dagger", slot: "wskin", name: "용암 혈맥 단검",     desc: "화산암 칼날 틈새로 황금 용암 선이 흐르는 날렵한 단검." },
  { id: "ws_dagger_jadeblossom",   silKey: "jadeblossom",   wk: "dagger", slot: "wskin", name: "비취 가드 홍매 단검", desc: "우아한 비취 덩굴 가드와 홍매빛 날이 돋보이는 단검." },
  { id: "ws_dagger_infernoclaw",   silKey: "infernoclaw",   wk: "dagger", slot: "wskin", name: "적염 가시 지옥 단검", desc: "날카로운 쌍뿔 가드 사이로 주홍빛 불꽃 날이 뻗은 단검." },
];

export const DAGGER_SILHOUETTES = {
  // 1) 은빛 기사단 단검 — Sleek compact steel guard & razor-slim 2px steel blade
  silversteel: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.8, -1.6, -0.7 - p * 0.2, 1.1 + p * 0.2, "steel"),
        R(-1.6, 3.5, -0.5 - p * 0.2, 0.9 + p * 0.2, "leather"),
        P([[3.2, -2.6], [4.5, -2.8], [4.7, 0.2], [4.5, 3.2], [3.2, 3.0], [3.8, 0.2]], "steel"),
        P([[4.5, -0.8 - p], [11.5, -0.8 - p], [14.8, 0.2], [11.5, 1.2 + p], [4.5, 1.2 + p]], "steel"),
      ],
      head: [4.5, 14.8, -0.8, 1.2],
      blade: ["steel"],
    };
  },

  // 2) 홍염 태양 단검 — Slim golden blade with subtle scarlet lower edge
  sunburst: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        C(-2.2, 0.2, 0.95 + p * 0.2, "gold"),
        R(-1.6, 3.5, -0.5 - p * 0.2, 0.9 + p * 0.2, "amber"),
        P([[3.2, -2.5], [4.6, -2.8], [4.8, 0.2], [4.6, 3.2], [3.2, 2.9]], "gold"),
        P([[4.5, -0.8 - p], [11.5, -0.8 - p], [14.8, 0.2], [11.5, 1.2 + p], [4.5, 1.2 + p]], "gold"),
        L(5.5, 0.6, 11.5, 0.6, "scarletE"),
      ],
      head: [4.5, 14.8, -0.8, 1.2],
      blade: ["gold"],
    };
  },

  // 3) 빙하 결정 단검 — Slim frost crescent guard + sapphire gem + sleek ice blade
  frostglaive: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.8, -1.6, -0.7 - p * 0.2, 1.1 + p * 0.2, "frost"),
        R(-1.6, 3.5, -0.5 - p * 0.2, 0.9 + p * 0.2, "leather"),
        P([[3.2, -2.8], [4.8, -2.2], [4.7, 0.2], [4.8, 2.6], [3.2, 3.2], [3.8, 0.2]], "frost"),
        D(4.0, 0.2, "sapphire"),
        P([[4.5, -0.8 - p], [11.5, -0.8 - p], [14.8, 0.2], [11.5, 1.2 + p], [4.5, 1.2 + p]], "frost"),
      ],
      head: [4.5, 14.8, -0.8, 1.2],
      blade: ["frost"],
    };
  },

  // 4) 성은 스틸레토 — Sleek obsidian crossguard & needle-thin stiletto blade
  midnightcross: (icon) => {
    const p = icon ? 0.55 : 0;
    return {
      sh: [
        R(-2.8, -1.6, -0.6 - p * 0.2, 1.0 + p * 0.2, "obsidian"),
        R(-1.6, 3.5, -0.5 - p * 0.2, 0.9 + p * 0.2, "crimson"),
        R(3.5, 4.5, -2.8, 3.2, "obsidian"),
        P([[4.5, -0.7 - p], [12.0, -0.6 - p], [15.0, 0.2], [12.0, 1.0 + p], [4.5, 1.1 + p]], "steel"),
      ],
      head: [4.5, 15.0, -0.7, 1.1],
      blade: ["steel"],
    };
  },

  // 5) 해시계 아쿠아 비수 — Compact octagonal sun-ring guard + bright razor cyan dirk
  solardisk: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.6, 3.0, -0.5 - p * 0.2, 0.9 + p * 0.2, "amber"),
        C(4.3, 0.2, 2.1, "bronze"),
        R(3.8, 4.8, -2.7, 3.1, "gold"),
        C(4.3, 0.2, 1.0, "obsidian"), D(4.3, 0.2, "ruby"),
        P([[5.8, -0.8 - p], [12.0, -0.7 - p], [15.0, 0.2], [12.0, 1.1 + p], [5.8, 1.2 + p]], "cyan"),
      ],
      head: [5.8, 15.0, -0.8, 1.2],
      blade: ["cyan"],
    };
  },

  // 6) 심해 아쿠아 단검 — Clean swept crimson horn guard & bright aqua blade
  vortexcyan: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        C(-2.2, 0.2, 0.95 + p * 0.2, "cyan"),
        R(-1.6, 3.5, -0.5 - p * 0.2, 0.9 + p * 0.2, "crimson"),
        P([[3.2, -1.8], [4.6, -3.2], [5.7, -2.2], [4.8, 0.2], [5.7, 2.6], [4.6, 3.6], [3.2, 2.2]], "crimson"),
        P([[4.6, -0.8 - p], [11.6, -0.8 - p], [14.8, 0.2], [11.6, 1.2 + p], [4.6, 1.2 + p]], "cyan"),
      ],
      head: [4.6, 14.8, -0.8, 1.2],
      blade: ["cyan"],
    };
  },

  // 7) 칠흑 깃털 번개 단검 — Sleek dark feather guard & slim lightning-core stiletto
  shadowfeather: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.8, 3.5, -0.5 - p * 0.2, 0.9 + p * 0.2, "obsidian"),
        P([[3.2, -1.2], [2.9, -3.2], [5.0, -2.6], [5.1, 0.2], [5.0, 3.0], [2.9, 3.6], [3.2, 1.6]], "feather"),
        D(4.3, 0.2, "amethyst"),
        P([[4.8, -0.8 - p], [11.6, -0.8 - p], [14.8, 0.2], [11.6, 1.2 + p], [4.8, 1.2 + p]], "obsidian"),
        L(5.8, 0.2, 12.2, 0.2, "boltCyan"),
      ],
      head: [4.8, 14.8, -0.8, 1.2],
      blade: ["obsidian"],
    };
  },

  // 8) 용암 혈맥 단검 — Clean crimson guard & dark volcanic blade with straight ember line
  moltenvein: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        C(-2.2, 0.2, 0.95 + p * 0.2, "darkCrimson"),
        R(-1.6, 3.5, -0.5 - p * 0.2, 0.9 + p * 0.2, "darkCrimson"),
        R(3.4, 4.6, -2.7, 3.1, "crimson"),
        P([[4.5, -0.8 - p], [11.5, -0.8 - p], [14.8, 0.2], [11.5, 1.2 + p], [4.5, 1.2 + p]], "darkCrimson"),
        L(5.5, 0.2, 11.8, 0.2, "lava"),
        D(12.2, 0.2, "spark"),
      ],
      head: [4.5, 14.8, -0.8, 1.2],
      blade: ["darkCrimson"],
    };
  },

  // 9) 비취 가드 홍매 단검 — Graceful swept jade guard & slender rose-quartz dirk
  jadeblossom: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        C(-2.2, 0.2, 0.95 + p * 0.2, "roseBlade"),
        R(-1.6, 3.5, -0.5 - p * 0.2, 0.9 + p * 0.2, "mintJade"),
        P([[3.2, -1.8], [4.6, -3.2], [5.5, -2.0], [4.8, 0.2], [5.5, 2.4], [4.6, 3.6], [3.2, 2.2]], "mintJade"),
        P([[4.6, -0.8 - p], [11.5, -0.8 - p], [14.6, 0.2], [11.5, 1.2 + p], [4.6, 1.2 + p]], "roseBlade"),
      ],
      head: [4.6, 14.6, -0.8, 1.2],
      blade: ["roseBlade"],
    };
  },

  // 10) 적염 가시 지옥 단검 — Swept twin crimson prongs cradling slim blazing amber blade
  infernoclaw: (icon) => {
    const p = icon ? 0.5 : 0;
    return {
      sh: [
        R(-2.8, -1.6, -0.7 - p * 0.2, 1.1 + p * 0.2, "darkCrimson"),
        R(-1.6, 3.5, -0.5 - p * 0.2, 0.9 + p * 0.2, "crimson"),
        P([[3.2, -1.2], [4.5, -3.0], [7.0, -2.6], [5.0, -0.9], [5.0, 1.3], [7.0, 3.0], [4.5, 3.4], [3.2, 1.6]], "crimson"),
        P([[4.6, -0.8 - p], [11.6, -0.7 - p], [15.0, 0.2], [11.6, 1.1 + p], [4.6, 1.2 + p]], "amber"),
      ],
      head: [4.6, 15.0, -0.8, 1.2],
      blade: ["amber"],
    };
  },
};

// ───────────────────────────── 4. RASTERISERS (mirror weapons.js dagger 32×32) ─────────────────────────────

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
    const v = DAGGER_COLLECTION_M[m] ?? DAGGER_COLLECTION_EXTRA[m] ?? "#ff00ff";
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

export function renderDaggerWorld(silKey, opts = {}) {
  const fn = DAGGER_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown dagger silhouette: ${silKey}`);
  const d = fn(false);
  const wq = opts.wq | 0, we = opts.we | 0;
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const inks = we >= 10 ? [RARE_INK[wq] || INK, GLOW10] : [RARE_INK[wq] || INK];
  const [ox, oy] = GRIP;
  const c = rasterShapes(d.sh, 32, 32, (s, t) => [ox + s, oy + t], (x, y) => [x - ox, y - oy], glow);
  return outlineCanvas(c, inks);
}

export function renderDaggerIcon(silKey, opts = {}) {
  const fn = DAGGER_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown dagger silhouette: ${silKey}`);
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
