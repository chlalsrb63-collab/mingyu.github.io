/**
 * 단검 무기 외형 컬렉션 (Daggers & Dirk Collection — 10 Designs).
 *
 * Code-drawn Tales Tales `dagger` geometry (`R`/`P`/`C`/`L`/`D`, `W=32, H=32, GRIP=[5, 16]`,
 * compact chunky length `s ∈ [-3.5, 18]`) inspired by classic 10-blade pixel dagger motifs:
 *   1. 은빛 기사단 단검 (`silversteel`)
 *   2. 홍염 태양 단검 (`sunburst`)
 *   3. 빙하 결정 단검 (`frostglaive`)
 *   4. 성은 스틸레토 (`midnightcross`)
 *   5. 해시계 아쿠아 비수 (`solardisk`)
 *   6. 심해 아쿠아 와이드 단검 (`vortexcyan`)
 *   7. 칠흑 깃털 번개 단검 (`shadowfeather`)
 *   8. 용암 혈맥 단검 (`moltenvein`)
 *   9. 비취 가드 홍매 단검 (`jadeblossom`)
 *  10. 적염 가시 지옥 단검 (`infernoclaw`)
 *
 * Zero `src/logic.js` / `weapons.js` files modified.
 *
 * Integration Locations:
 *   1. `game/public/weapons.js`
 *      - Merge `DAGGER_COLLECTION_M` into `M` (`DAGGER_COLLECTION_EXTRA` into `EXTRA`).
 *      - Register `DAGGER_SILHOUETTES` under `SIL.dagger`.
 *      - Add `MOTIF_SIL.dagger.<motif>` entries + motifs into `MOTIF`.
 *   2. `game/src/logic/65-cosmetics.js`
 *      - Append `DAGGER_COLLECTION_META` (`ws_dagger_*`, `slot: "wskin"`, `wk: "dagger"`).
 *   3. `game/public/art.js` / `asset/generated/daggers/`
 *      - Normalized 16×16 bag icons (`icon_ws_dagger_*.png`) ready after owner approval.
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
export const DAGGER_COLLECTION_M = {
  steel:     ["#edf2fa", "#b4c0d4", "#6e7894"],
  leather:   ["#946044", "#663c2c", "#3e2226"],
  gold:      ["#fff09e", "#f0b844", "#a06420"],
  amber:     ["#ffdf8a", "#f28524", "#9e381c"],
  crimson:   ["#ff8878", "#d63834", "#841c2c"],
  frost:     ["#f2fcff", "#84c7f2", "#3566b0"],
  cyan:      ["#b8ffff", "#38d8e6", "#167696"],
  obsidian:  ["#6a7086", "#35384c", "#1c1d2b"],
  feather:   ["#adb4cc", "#646a84", "#32354a"],
  darkCrimson:["#b84452", "#681a2c", "#360e1c"],
  roseBlade: ["#ffd0de", "#e8789c", "#993c62"],
  mintJade:  ["#c2fce2", "#5ad49e", "#287a5e"],
  bronze:    ["#ffe0a4", "#c88842", "#7a4424"],
};

export const DAGGER_COLLECTION_EXTRA = {
  glint:     "#ffffff",
  spark:     "#fff4a0",
  boltCyan:  "#7cf8ff",
  lava:      "#ffae38",
  ruby:      "#ff4860",
  amethyst:  "#d478ff",
  darkLine:  "#343046",
};

// ───────────────────────────── 2. ITEM METADATA ─────────────────────────────
export const DAGGER_COLLECTION_META = [
  { id: "ws_dagger_silversteel",   silKey: "silversteel",   wk: "dagger", slot: "wskin", name: "은빛 기사단 단검",   desc: "S자 백은 코등이와 날렵한 양날 단검신이 균형을 이룬 기사 단검." },
  { id: "ws_dagger_sunburst",      silKey: "sunburst",      wk: "dagger", slot: "wskin", name: "홍염 태양 단검",     desc: "황금빛 햇살 검신 끝으로 붉은 화염 날이 번지는 단검." },
  { id: "ws_dagger_frostglaive",   silKey: "frostglaive",   wk: "dagger", slot: "wskin", name: "빙하 결정 단검",     desc: "서릿발 곡선 코등이 위에 얼음 결정 날을 깎아 넣은 단검." },
  { id: "ws_dagger_midnightcross", silKey: "midnightcross", wk: "dagger", slot: "wskin", name: "성은 스틸레토",      desc: "붉은 손잡이와 매끈한 은빛 찌르기 날을 가진 암살자 비수." },
  { id: "ws_dagger_solardisk",     silKey: "solardisk",     wk: "dagger", slot: "wskin", name: "해시계 아쿠아 비수", desc: "둥근 황금 태양 바퀴 코등이 위로 시안 수정 날이 뻗은 비수." },
  { id: "ws_dagger_vortexcyan",    silKey: "vortexcyan",    wk: "dagger", slot: "wskin", name: "심해 아쿠아 단검",   desc: "붉은 날개 가드 사이로 영롱한 청록빛 마력 날이 뻗은 단검." },
  { id: "ws_dagger_shadowfeather", silKey: "shadowfeather", wk: "dagger", slot: "wskin", name: "칠흑 깃털 번개 단검", desc: "칠흑 깃털 뭉치 가드와 푸른 번개가 흐르는 강철 비수." },
  { id: "ws_dagger_moltenvein",    silKey: "moltenvein",    wk: "dagger", slot: "wskin", name: "용암 혈맥 단검",     desc: "검붉은 화산암 칼날 틈새로 황금 용암 줄기가 번쩍이는 단검." },
  { id: "ws_dagger_jadeblossom",   silKey: "jadeblossom",   wk: "dagger", slot: "wskin", name: "비취 가드 홍매 단검", desc: "초록빛 덩굴 코등이와 은은한 홍매빛 장미 수정 날의 단검." },
  { id: "ws_dagger_infernoclaw",   silKey: "infernoclaw",   wk: "dagger", slot: "wskin", name: "적염 가시 지옥 단검", desc: "앞을 향해 치켜뜬 악마 뿔 가드와 작열하는 불꽃 날의 단검." },
];

// ───────────────────────────── 3. SILHOUETTES (compact dagger space s in [-3.5..18], t in [-7..7]) ─────────────────────────────
export const DAGGER_SILHOUETTES = {
  // 1) 은빛 기사단 단검 — Leather grip + S-curled steel guard + broad bright steel blade
  silversteel: () => ({
    sh: [
      C(-2.2, 0, 1.5, "steel"),
      R(-1.5, 4, -1.3, 1.3, "leather"),
      // Curled steel S-hooks (`t=-4.5..4.5`)
      P([[2.5, -3], [4, -5], [6, -4], [5.5, 4], [4, 5], [2.5, 3], [4, 0]], "steel"),
      // Crisp symmetric dagger blade (`s=5..17.5`)
      P([[5, -2.2], [14.5, -2.2], [18, 0], [14.5, 2.2], [5, 2.2]], "steel"),
      L(6, 0, 13, 0, "darkLine"),
    ],
    head: [5, 18, -2.5, 2.5],
    blade: ["steel"],
  }),

  // 2) 홍염 태양 단검 — Gold crescent guard + crimson-orange glowing sun-flame blade
  sunburst: () => ({
    sh: [
      C(-2.2, 0, 1.5, "gold"),
      R(-1.5, 4, -1.3, 1.3, "amber"),
      P([[2.5, -4], [5.5, -5.5], [6.5, -2], [6.5, 2], [5.5, 5.5], [2.5, 4], [4, 0]], "gold"),
      P([[5.5, -2.2], [14, -2.2], [18, 0], [14, 2.2], [5.5, 2.2]], "gold"),
      P([[6.5, 0], [15, 0], [17.5, 0], [14, 2.0], [6.5, 2.0]], "crimson"),
      D(9, -0.8, "spark"), D(13, -0.8, "spark"),
    ],
    head: [5.5, 18, -2.5, 2.5],
    blade: ["gold", "crimson"],
  }),

  // 3) 빙하 결정 단검 — Frost crescent guard + sapphire pommel + white-ice bevel blade
  frostglaive: () => ({
    sh: [
      C(-2.2, 0, 1.6, "frost"), D(-2.4, -0.3, "glint"),
      R(-1.5, 4, -1.3, 1.3, "leather"),
      P([[3, -5], [6.5, -4], [6, 0], [6.5, 4], [3, 5], [4, 0]], "frost"),
      P([[5.5, -2.2], [14.5, -2.2], [18, 0], [14.5, 2.2], [5.5, 2.2]], "frost"),
      L(6.5, -1.0, 15, -1.0, "glint"),
    ],
    head: [5.5, 18, -2.5, 2.5],
    blade: ["frost"],
  }),

  // 4) 성은 스틸레토 — Crimson grip + sleek narrow iron guard + razor steel needle blade
  midnightcross: () => ({
    sh: [
      C(-2.2, 0, 1.4, "obsidian"),
      R(-1.5, 4, -1.2, 1.2, "crimson"),
      P([[3, -4.5], [5.5, -4.5], [5.5, 4.5], [3, 4.5], [4, 0]], "obsidian"),
      P([[5, -1.8], [15, -1.5], [18.5, 0], [15, 1.5], [5, 1.8]], "steel"),
      L(6, 0, 14, 0, "darkLine"),
    ],
    head: [5, 18.5, -2, 2],
    blade: ["steel"],
  }),

  // 5) 해시계 아쿠아 비수 — Iconic circular spiked amber wheel guard + jewel eye + bright cyan blade
  solardisk: () => ({
    sh: [
      R(-3.0, 3.5, -1.3, 1.3, "amber"),
      // Bold circular wheel-guard (`r = 3.8` around `s=5, t=0`) with top/bottom/front spikes!
      C(5, 0, 3.8, "bronze"),
      P([[4, -3.5], [5, -6.2], [6.5, -3.5]], "gold"),
      P([[4, 3.5], [5, 6.2], [6.5, 3.5]], "gold"),
      C(5, 0, 1.7, "obsidian"), D(5, 0, "ruby"),
      // Radiant cyan crystal blade extending out of the sun-wheel!
      P([[7.5, -2.2], [15.5, -2.2], [18.5, 0], [15.5, 2.2], [7.5, 2.2]], "cyan"),
      D(10, -0.8, "glint"),
    ],
    head: [7.5, 18.5, -2.5, 2.5],
    blade: ["cyan"],
  }),

  // 6) 심해 아쿠아 단검 — Swept winged crimson fang-guard + broad aqua-cyan dagger blade
  vortexcyan: () => ({
    sh: [
      C(-2.2, 0, 1.5, "cyan"),
      R(-1.5, 4, -1.3, 1.3, "crimson"),
      P([[3, -3], [5, -6], [7.5, -5.5], [6, -1.5], [6, 1.5], [7.5, 5.5], [5, 6], [3, 3]], "crimson"),
      P([[5.5, -2.4], [14.5, -2.4], [18, 0], [14.5, 2.4], [5.5, 2.4]], "cyan"),
      D(9, -1.0, "glint"), D(12.5, -0.8, "glint"),
    ],
    head: [5.5, 18, -2.5, 2.5],
    blade: ["cyan"],
  }),

  // 7) 칠흑 깃털 번개 단검 — Spiked feather-plume crossguard + dark blade with electric cyan lightning!
  shadowfeather: () => ({
    sh: [
      R(-3.2, 4, -1.3, 1.3, "obsidian"),
      // Flared spiked feather plumage fanning above & below hilt (`s=2..7, t=-7..7`)
      P([[2, -2], [2.2, -6.8], [4.2, -5.0], [5.8, -7.2], [7, -2],
         [7, 2], [5.8, 7.2], [4.2, 5.0], [2.2, 6.8], [2, 2]], "feather"),
      C(5, 0, 1.6, "obsidian"), D(5, 0, "amethyst"),
      // Dark obsidian dagger blade split with jagged lightning bolt!
      P([[6, -2.2], [15, -2.2], [18.2, 0], [15, 2.2], [6, 2.2]], "obsidian"),
      L(7, -0.5, 10, 0.8, "boltCyan"), L(10, 0.8, 12.5, -0.8, "boltCyan"), L(12.5, -0.8, 15.5, 0.2, "boltCyan"),
    ],
    head: [6, 18.2, -2.5, 2.5],
    blade: ["obsidian"],
  }),

  // 8) 용암 혈맥 단검 — Dark crimson jagged guard + volcano blade laced with molten magma veins
  moltenvein: () => ({
    sh: [
      C(-2.2, 0, 1.5, "darkCrimson"),
      R(-1.5, 4, -1.3, 1.3, "darkCrimson"),
      P([[2.5, -4.5], [5.5, -5.0], [6, 0], [5.5, 5.0], [2.5, 4.5]], "crimson"),
      P([[5, -2.2], [14.5, -2.2], [18, 0], [14.5, 2.2], [5, 2.2]], "darkCrimson"),
      L(6.5, -0.8, 9, 0.8, "lava"), L(9, 0.8, 11.5, -0.8, "lava"), L(11.5, -0.8, 14.5, 0.5, "lava"),
      D(15.5, 0, "spark"),
    ],
    head: [5, 18, -2.5, 2.5],
    blade: ["darkCrimson"],
  }),

  // 9) 비취 가드 홍매 단검 — Pastel rose-pink blade + flared mint-jade curved leaf guard
  jadeblossom: () => ({
    sh: [
      C(-2.2, 0, 1.5, "roseBlade"), D(-2.4, -0.3, "glint"),
      R(-1.5, 4, -1.3, 1.3, "mintJade"),
      // Flared curved mint-jade guard curls
      P([[3, -3.5], [5, -6.2], [7, -5.0], [6, -1.5], [6, 1.5], [7, 5.0], [5, 6.2], [3, 3.5]], "mintJade"),
      D(5, 0, "glint"),
      // Pastel rose-quartz dagger blade
      P([[5.5, -2.2], [14.5, -2.2], [18, 0], [14.5, 2.2], [5.5, 2.2]], "roseBlade"),
      L(7, -1.0, 14, -1.0, "glint"),
    ],
    head: [5.5, 18, -2.5, 2.5],
    blade: ["roseBlade"],
  }),

  // 10) 적염 가시 지옥 단검 — Jagged forward-swept demon horn prongs framing burning amber-crimson blade
  infernoclaw: () => ({
    sh: [
      C(-2.2, 0, 1.5, "darkCrimson"),
      R(-1.5, 4, -1.3, 1.3, "crimson"),
      // Forward-sweeping demonic horn prongs flanking lower blade (`s=4..9.5`)
      P([[3, -2], [5, -6], [9.5, -5.5], [6.5, -2], [6.5, 2], [9.5, 5.5], [5, 6], [3, 2]], "crimson"),
      // Fiery amber-crimson ember blade
      P([[5.5, -2.0], [14.5, -2.0], [18.2, 0], [14.5, 2.0], [5.5, 2.0]], "amber"),
      L(6.5, -1.0, 14.5, -1.0, "spark"),
    ],
    head: [5.5, 18.2, -2.2, 2.2],
    blade: ["amber"],
  }),
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
