/**
 * 양손대검 외형 컬렉션 (Arcane & Legendary Greatswords Collection — 10 Designs).
 *
 * Refined sleek Tales Tales `sword` proportions (`W=44, H=32, GRIP=[5, 16]`):
 * long tapering blades (`t ∈ [-2.0, +2.2]`, length up to `s = 36.5`), smooth clean silhouettes,
 * balanced streamlined guards (`t ∈ [-5, 5]`), and crisp `top: true` fullers/runes without
 * jagged or patchy multi-polygon seams.
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

export const GS_COLLECTION_M = {
  dawnPink:   ["#ffd1e4", "#f084b4", "#a84478"],
  skyAzure:   ["#c4eeff", "#5ab8f0", "#2c68b0"],
  bronze:     ["#ffe0a8", "#cc8f4e", "#7d4a2a"],
  leather:    ["#8c5c42", "#623a2c", "#3e2226"],
  ivory:      ["#fff9eb", "#e0d4be", "#a2928a"],
  steel:      ["#edf2fa", "#b8c4d8", "#74809c"],
  jade:       ["#b4f7d2", "#3cb882", "#1c6b58"],
  gold:       ["#fff09e", "#ecc048", "#a46a22"],
  cyanDark:   ["#9cfaf2", "#26a6b2", "#14506b"],
  amethyst:   ["#f4c4ff", "#9e52e8", "#4e2288"],
  silver:     ["#ffffff", "#d2dced", "#8692b0"],
  mossGreen:  ["#c2f058", "#44a43c", "#1c5832"],
  crimson:    ["#ff8878", "#d83c38", "#881e2c"],
  midnight:   ["#828cc8", "#384078", "#1c1e44"],
  violet:     ["#c896ff", "#6e42b0", "#3a1e6a"],
  obsidian:   ["#6c7288", "#34364a", "#1a1a28"],
  tealArc:    ["#a2f4ea", "#36b8b0", "#1a6874"],
  amberCore:  ["#fff2a0", "#ff9e32", "#b8441c"],
  deepOcean:  ["#7cb4e8", "#2d5ea6", "#162c5c"],
};

export const GS_COLLECTION_EXTRA = {
  glint:     "#ffffff",
  spark:     "#fff4a0",
  star:      "#dceeff",
  cyanDot:   "#7cf8ff",
  ruby:      "#ff5068",
  amberPt:   "#ffb840",
  pinkRidge: "#ffb0d4",
  iceEdge:   "#e8faff",
  darkEdge:  "#4a526e",
  jadeLit:   "#c6ffe0",
  amethystL: "#f6d8ff",
};

export const GS_COLLECTION_META = [
  { id: "ws_sword_dawncloud",      silKey: "dawncloud",      wk: "sword", slot: "wskin", name: "여명 구름 대검",     desc: "복숭아빛 노을과 푸른 하늘이 매끄럽게 어우러진 청동 호위 대검." },
  { id: "ws_sword_jadefalcon",     silKey: "jadefalcon",     wk: "sword", slot: "wskin", name: "비취 해적도 대검",   desc: "고리 손잡이와 날렵한 비취 외날이 미끄러지듯 뻗은 사브르 대검." },
  { id: "ws_sword_cyanguild",      silKey: "cyanguild",      wk: "sword", slot: "wskin", name: "창공 태양 대검",     desc: "황금 날개 코등이 위에 날렵한 청록 수정 검신을 세운 대검." },
  { id: "ws_sword_amethystbroad",  silKey: "amethystbroad",  wk: "sword", slot: "wskin", name: "자수정 심판 대검",   desc: "백광 능선이 매끈하게 뻗은 날렵한 자수정 대검." },
  { id: "ws_sword_thornviper",     silKey: "thornviper",     wk: "sword", slot: "wskin", name: "가시덩굴 독니 대검", desc: "갈고리 자루와 톱니 등날이 날카롭게 깎인 밀림 대검." },
  { id: "ws_sword_starryedge",     silKey: "starryedge",     wk: "sword", slot: "wskin", name: "별밤 성운 대검",     desc: "어두운 밤하늘 세이버 검신 위로 별빛이 수놓인 외날 대검." },
  { id: "ws_sword_crescentfang",   silKey: "crescentfang",   wk: "sword", slot: "wskin", name: "초승달 비철 대검",   desc: "청록 너클 가드와 매끈하게 휜 흑요석 외날 도검." },
  { id: "ws_sword_pillarbell",     silKey: "pillarbell",     wk: "sword", slot: "wskin", name: "황금 신전 대봉검",   desc: "날씬한 칼몸에서 단정하게 종 모양으로 퍼지는 황금 봉검." },
  { id: "ws_sword_abyssalcleaver", silKey: "abyssalcleaver", wk: "sword", slot: "wskin", name: "심연 별빛 대검",     desc: "유선형 절단선과 성좌 문양이 돋보이는 날렵한 심해 대검." },
  { id: "ws_sword_solaris",        silKey: "solaris",        wk: "sword", slot: "wskin", name: "백열 성화 대검",     desc: "타오르는 불꽃 중심 홈을 품은 얇고 날카로운 쌍날 성검." },
];

// Ultra-sleek greatsword geometry: slender ~2.8px blade (`t ∈ [-1.2, 1.5]`), compact crossguard (`t ∈ [-3.6, 4.0]`),
// smooth continuous bevels & `icon`-aware slight thickness boost (`p = icon ? 0.5 : 0`) so 16×16 diagonal never breaks!
export const GS_SILHOUETTES = {
  // 1) 여명 구름 대검 — Sleek sky-azure blade with crisp pink ridge ribbon & trim bronze guard
  dawncloud: (icon) => { const p = icon ? 0.5 : 0; return ({
    sh: [
      C(-2.2, 0.2, 1.2, "bronze"),
      R(-1.2, 5.2, -0.6 - p * 0.3, 1.4 + p * 0.3, "leather"),
      P([[4.5, -3.5 - p], [6.8, -3.5 - p], [7.5, 0.2], [6.8, 4.0 + p], [4.5, 4.0 + p], [5.4, 0.2]], "bronze"),
      D(6.0, 0.2, "ruby"),
      P([[7.2, -1.2 - p], [27.5, -1.0 - p], [32.0, 0.2], [27.5, 1.5 + p], [7.2, 1.7 + p]], "skyAzure"),
      L(8.5, 0.2, 28, 0.2, "pinkRidge"),
    ],
    head: [7.2, 32, -1.2, 1.7],
    blade: ["skyAzure"],
  }); },

  // 2) 비취 해적도 대검 — Ivory hilt, compact ring guard & graceful razor-thin jade sabre
  jadefalcon: (icon) => { const p = icon ? 0.5 : 0; return ({
    sh: [
      R(-3.0, -1.2, -1.0, 1.6, "gold"),
      R(-1.2, 5.0, -0.6 - p * 0.3, 1.4 + p * 0.3, "ivory"),
      C(6.2, 0.2, 2.5 + p * 0.4, "steel"),
      C(6.2, 0.2, 1.0, null),
      P([[8.2, -0.8 - p], [21.5, -1.4 - p], [28.5, -2.5 - p], [32.5, -1.5], [28.5, 0.4 + p], [20.5, 1.4 + p], [8.2, 1.5 + p]], "jade"),
      L(10, -0.8, 29, -1.8, "iceEdge"),
    ],
    head: [8.2, 32.5, -2.5, 1.5],
    blade: ["jade"],
  }); },

  // 3) 창공 태양 대검 — Compact golden sunburst wings & sleek cyan crystal greatsword
  cyanguild: (icon) => { const p = icon ? 0.5 : 0; return ({
    sh: [
      C(-2.2, 0.2, 1.2, "gold"),
      R(-1.2, 5.2, -0.6 - p * 0.3, 1.4 + p * 0.3, "leather"), R(1.5, 2.5, -0.6, 1.4, "gold"),
      P([[4.5, -1.2], [6.0, -4.2 - p], [7.8, -2.5], [7.8, 3.2], [6.0, 4.8 + p], [4.5, 1.8]], "gold"),
      P([[7.5, -1.2 - p], [27.5, -1.0 - p], [32.5, 0.2], [27.5, 1.5 + p], [7.5, 1.7 + p]], "cyanDark"),
      L(9, 0.2, 28, 0.2, "cyanDot"),
    ],
    head: [7.5, 32.5, -1.2, 1.7],
    blade: ["cyanDark"],
  }); },

  // 4) 자수정 심판 대검 — Trim bronze guard + needle-sharp crystal amethyst greatsword
  amethystbroad: (icon) => { const p = icon ? 0.5 : 0; return ({
    sh: [
      R(-3.0, -1.2, -1.0, 1.6, "bronze"),
      R(-1.2, 5.2, -0.6 - p * 0.3, 1.4 + p * 0.3, "leather"),
      P([[4.8, -3.6 - p], [7.0, -3.6 - p], [7.8, 0.2], [7.0, 4.2 + p], [4.8, 4.2 + p], [5.6, 0.2]], "bronze"),
      D(6.2, 0.2, "amberPt"),
      P([[7.5, -1.4 - p], [26.5, -1.0 - p], [32.5, 0.2], [26.5, 1.5 + p], [7.5, 1.8 + p]], "amethyst"),
      L(8.5, 0.2, 30, 0.2, "glint"),
    ],
    head: [7.5, 32.5, -1.4, 1.8],
    blade: ["amethyst"],
  }); },

  // 5) 가시덩굴 독니 대검 — Trim J-hook pommel + sleek moss-green sword with 3 tiny clean edge barbs
  thornviper: (icon) => { const p = icon ? 0.5 : 0; return ({
    sh: [
      P([[-3.0, 0], [-3.0, 3.2], [-1.0, 4.2], [1.2, 3.4], [0.4, 2.4], [-1.2, 2.6], [-1.4, 0]], "ivory"),
      R(-1.4, 5.2, -0.6 - p * 0.3, 1.4 + p * 0.3, "crimson"),
      P([[4.6, -3.5 - p], [7.2, -3.8 - p], [8.0, 0.2], [7.2, 4.2 + p], [4.6, 3.8 + p], [5.8, 0.2]], "gold"),
      P([[7.6, -1.1 - p], [13.5, -1.1 - p], [15.0, -2.8 - p], [16.2, -1.1 - p],
         [21.0, -1.1 - p], [22.5, -2.8 - p], [23.8, -1.1 - p], [27.5, -1.1 - p], [32.5, 0.2],
         [27.5, 1.6 + p], [7.6, 1.6 + p]], "mossGreen"),
      L(9, 0.2, 28, 0.2, "spark"),
    ],
    head: [7.6, 32.5, -2.8, 1.6],
    blade: ["mossGreen"],
  }); },

  // 6) 별밤 성운 대검 — Sleek ivory hilt, thin S-violet guard & curved starry midnight falchion
  starryedge: (icon) => { const p = icon ? 0.5 : 0; return ({
    sh: [
      R(-3.0, -1.2, -1.0, 1.6, "violet"),
      R(-1.2, 5.2, -0.6 - p * 0.3, 1.4 + p * 0.3, "ivory"),
      P([[4.2, -1.2], [5.8, -3.8 - p], [8.2, -3.5 - p], [7.0, -1.5], [7.0, 1.8], [5.2, 4.2 + p], [3.5, 3.2 + p], [5.2, 1.2]], "violet"),
      P([[7.2, -0.9 - p], [21.5, -1.4 - p], [29.0, -2.4 - p], [32.5, -1.2], [28.5, 0.6 + p], [20.5, 1.4 + p], [7.2, 1.5 + p]], "midnight"),
      L(9, -0.8, 29.5, -1.6, "iceEdge"),
      D(14, 0.2, "star"), D(21, -0.4, "star"), D(26, 0.0, "star"),
    ],
    head: [7.2, 32.5, -2.4, 1.5],
    blade: ["midnight"],
  }); },

  // 7) 초승달 비철 대검 — Slim teal knuckle-bow & razor-curved obsidian sabre
  crescentfang: (icon) => { const p = icon ? 0.5 : 0; return ({
    sh: [
      R(-3.0, -1.2, -1.0, 1.6, "steel"),
      R(-1.2, 5.0, -0.6 - p * 0.3, 1.4 + p * 0.3, "bronze"),
      P([[4.5, -3.2 - p], [6.8, -3.2 - p], [7.5, 0], [7.0, 3.6 + p], [3.5, 5.0 + p], [0.6, 4.5 + p], [1.0, 3.2], [4.8, 3.4], [5.8, 2.0], [5.8, -1.0]], "tealArc"),
      P([[7.2, -1.0 - p], [19.0, -2.0 - p], [28.0, -3.0 - p], [32.5, -2.0], [29.0, 0.2 + p], [20.0, 1.4 + p], [7.2, 1.5 + p]], "obsidian"),
      L(11, -1.2, 30, -2.2, "glint"),
    ],
    head: [7.2, 32.5, -3.0, 1.5],
    blade: ["obsidian"],
  }); },

  // 8) 황금 신전 대봉검 — Slender shaft widening gently into a refined bell crown
  pillarbell: (icon) => { const p = icon ? 0.4 : 0; return ({
    sh: [
      P([[-3.2, -1.6], [-1.2, -0.8], [-1.2, 1.5], [-3.2, 2.2]], "gold"),
      R(-1.2, 5.2, -0.6 - p * 0.3, 1.4 + p * 0.3, "crimson"),
      P([[4.8, -3.5 - p], [7.0, -3.5 - p], [7.6, 0.2], [7.0, 4.0 + p], [4.8, 4.0 + p], [5.6, 0.2]], "gold"),
      P([[7.5, -1.0 - p], [21.0, -1.2 - p], [28.0, -2.4 - p], [30.8, -3.5 - p], [31.8, -3.5 - p],
         [31.8, 4.2 + p], [30.8, 4.2 + p], [28.0, 3.0 + p], [21.0, 1.8 + p], [7.5, 1.8 + p]], "gold"),
      L(11, 0.2, 28, 0.2, "amberPt"),
      D(17, 0.2, "spark"), D(26, 0.2, "spark"),
    ],
    head: [7.5, 31.8, -3.5, 4.2],
    blade: ["gold"],
  }); },

  // 9) 심연 별빛 대검 — Sleek ocean-blue notched blade with subtle stepped tip & stars
  abyssalcleaver: (icon) => { const p = icon ? 0.5 : 0; return ({
    sh: [
      P([[-3.0, -1.5], [-1.2, -0.8], [-1.2, 1.5], [-3.0, 2.2]], "deepOcean"),
      R(-1.2, 5.2, -0.6 - p * 0.3, 1.4 + p * 0.3, "obsidian"),
      P([[4.8, -3.2 - p], [7.0, -3.0 - p], [7.6, 0.2], [7.0, 3.6 + p], [4.8, 3.8 + p]], "deepOcean"),
      D(6.2, 0.2, "cyanDot"),
      P([[7.4, -1.2 - p], [16.5, -1.2 - p], [18.5, -2.8 - p], [28.5, -2.6 - p], [32.5, -0.5], [28.0, 1.8 + p], [17.0, 2.0 + p], [7.4, 1.6 + p]], "deepOcean"),
      R(24.5, 26.2, -1.4, -0.4, null),
      L(19, -2.1, 28.5, -2.1, "iceEdge"),
      D(14, 0.3, "star"), D(21, 0.4, "star"),
    ],
    head: [7.4, 32.5, -2.8, 2.0],
    blade: ["deepOcean"],
  }); },

  // 10) 백열 성화 대검 — Ultra-slim twin-pronged paladin greatsword with glowing ember fuller
  solaris: (icon) => { const p = icon ? 0.5 : 0; return ({
    sh: [
      C(-2.2, 0.2, 1.2, "gold"),
      R(-1.2, 5.2, -0.6 - p * 0.3, 1.4 + p * 0.3, "crimson"),
      P([[4.8, -3.8 - p], [7.2, -2.8], [7.8, 0.2], [7.2, 3.2], [4.8, 4.2 + p], [5.8, 0.2]], "gold"),
      D(6.4, 0.2, "spark"),
      P([[7.4, -1.4 - p], [28.5, -1.4 - p], [32.5, -0.6], [28.0, -0.2], [13.0, -0.2], [13.0, 0.8],
         [28.0, 0.8], [32.5, 1.4], [28.5, 2.0 + p], [7.4, 2.0 + p]], "silver"),
      L(10, 0.3, 27, 0.3, "amberPt"),
      D(23, 0.3, "spark"),
    ],
    head: [7.4, 32.5, -1.4, 2.0],
    blade: ["silver"],
  }); },
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
    const v = GS_COLLECTION_M[m] ?? GS_COLLECTION_EXTRA[m] ?? "#ff00ff";
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

export function renderGreatswordWorld(silKey, opts = {}) {
  const fn = GS_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown greatsword silhouette: ${silKey}`);
  const d = fn(false);
  const wq = opts.wq | 0, we = opts.we | 0;
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const inks = we >= 10 ? [RARE_INK[wq] || INK, GLOW10] : [RARE_INK[wq] || INK];
  const [ox, oy] = GRIP;
  const c = rasterShapes(d.sh, 44, 32, (s, t) => [ox + s, oy + t], (x, y) => [x - ox, y - oy], glow);
  return outlineCanvas(c, inks);
}

export function renderGreatswordIcon(silKey, opts = {}) {
  const fn = GS_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown greatsword silhouette: ${silKey}`);
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
