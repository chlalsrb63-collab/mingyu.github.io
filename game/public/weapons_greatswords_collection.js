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

// Clean shared hilt helper: slim grip [-1..6, t=-1..2]
export const GS_SILHOUETTES = {
  // 1) 여명 구름 대검 — Slim dusk sky-blue blade with clean pink ridge ribbon & sleek bronze guard
  dawncloud: (icon) => ({
    sh: [
      C(-2.2, 0.5, 1.5, "bronze"), D(-2.2, 0.5, "ruby"),
      R(-1, 6, -1.0, 2.0, "leather"),
      P([[5, -4.5], [7.5, -4.5], [8.5, 0.5], [7.5, 5.0], [5, 5.0], [6, 0.5]], "bronze"),
      D(6.8, 0.5, "ruby"),
      // Smooth slim sky-azure double-edged blade (`t = -2..3`)
      P([[8, -2.0], [31, -1.8], [36, 0.5], [31, 2.6], [8, 2.6]], "skyAzure"),
      // Smooth non-bumpy dawn-pink ribbon fuller down upper facet
      L(9, -0.5, 32, -0.5, "pinkRidge"),
      L(11, 0.5, 29, 0.5, "glint"),
    ],
    head: [8, 36, -2, 2.6],
    blade: ["skyAzure"],
  }),

  // 2) 비취 해적도 대검 — Ivory grip, clean steel ring guard & graceful thin jade sabre blade
  jadefalcon: () => ({
    sh: [
      R(-3.2, -1.2, -1.5, 2.5, "gold"),
      R(-1.2, 5.5, -1.0, 2.0, "ivory"),
      C(6.8, 0.5, 3.2, "steel"),
      C(6.8, 0.5, 1.4, null),
      // Graceful curved single-edged jade sabre (`3.5px` slim blade)
      P([[9, -1.2], [23, -2.2], [32, -3.4], [36.5, -2.2], [32.5, 0.6], [22, 2.0], [9, 2.2]], "jade"),
      L(11, -1.0, 33, -2.2, "iceEdge"),
      L(12, 0.5, 27, 0.5, "jadeLit"),
    ],
    head: [9, 36.5, -3.4, 2.2],
    blade: ["jade"],
  }),

  // 3) 창공 태양 대검 — Sleek winged gold crossguard & razor-straight glowing cyan-teal blade
  cyanguild: () => ({
    sh: [
      C(-2.2, 0.5, 1.5, "gold"),
      R(-1.2, 6, -1.0, 2.0, "leather"), R(1, 2, -1.0, 2.0, "gold"), R(3.5, 4.5, -1.0, 2.0, "gold"),
      // Compact swept golden sun-wings (`t = -5.5..6.5`)
      P([[5, -1.5], [6.5, -5.5], [9, -3.5], [9, 4.5], [6.5, 6.5], [5, 2.5]], "gold"),
      // Crisp slender cyan-teal broadsword (`t = -1.8..2.6`)
      P([[8.5, -1.8], [31.5, -1.8], [36.5, 0.4], [31.5, 2.6], [8.5, 2.6]], "cyanDark"),
      L(10, 0.4, 32, 0.4, "cyanDot"),
      L(10, -1.0, 30, -1.0, "iceEdge"),
    ],
    head: [8.5, 36.5, -1.8, 2.6],
    blade: ["cyanDark"],
  }),

  // 4) 자수정 심판 대검 — Trim bronze crossguard + sharp slender faceted amethyst greatsword
  amethystbroad: () => ({
    sh: [
      R(-3.2, -1.2, -1.5, 2.5, "bronze"),
      R(-1.2, 6, -1.0, 2.0, "leather"),
      P([[5.5, -4.5], [8, -4.5], [9, 0.5], [8, 5.5], [5.5, 5.5], [6.5, 0.5]], "bronze"),
      D(7.2, 0.5, "amberPt"),
      // Slender tapering crystal-violet blade (`t = -2.2..3.0 -> point 36.5`)
      P([[8.5, -2.2], [29, -1.8], [36.5, 0.4], [29, 2.6], [8.5, 3.0]], "amethyst"),
      L(9.5, 0.4, 34, 0.4, "glint"),
      L(10, -0.5, 29, -0.5, "amethystL"),
    ],
    head: [8.5, 36.5, -2.2, 3.0],
    blade: ["amethyst"],
  }),

  // 5) 가시덩굴 독니 대검 — Slender J-hook ivory pommel + split gold guard + clean stepped thorn-edge
  thornviper: () => ({
    sh: [
      // Graceful slim hook pommel (`t = 0..5.2`)
      P([[-3.2, 0], [-3.2, 4.2], [-1, 5.5], [1.5, 4.5], [0.5, 3.2], [-1.2, 3.5], [-1.5, 0]], "ivory"),
      R(-1.5, 6, -1.0, 2.0, "crimson"),
      P([[5, -4.5], [8, -5.0], [9, 0.5], [8, 5.5], [5, 5.0], [6.5, 0.5]], "gold"),
      // Clean sleek moss-green blade with 3 evenly spaced crisp edge teeth (`not lumpy!`)
      P([[8.5, -1.8], [14, -1.8], [16, -4.2], [17.5, -1.8], [22, -1.8], [24, -4.2], [25.5, -1.8],
         [30, -1.8], [36.5, 0.2], [30, 2.4], [8.5, 2.4]], "mossGreen"),
      L(10, 0.5, 32, 0.5, "spark"),
    ],
    head: [8.5, 36.5, -4.2, 2.4],
    blade: ["mossGreen"],
  }),

  // 6) 별밤 성운 대검 — Sleek ivory hilt, refined S-violet guard & curved starry midnight falchion
  starryedge: () => ({
    sh: [
      R(-3.2, -1.2, -1.5, 2.5, "violet"),
      R(-1.2, 6, -1.0, 2.0, "ivory"),
      P([[4.5, -1.5], [6.5, -4.8], [9.5, -4.5], [8, -2.2], [8, 2.2], [5.5, 5.0], [3.5, 4.0], [6, 1.5]], "violet"),
      // Slim graceful curved cosmic falchion (`3.5px` width)
      P([[8, -1.4], [24, -2.0], [33, -3.2], [36.5, -1.8], [32, 1.0], [22, 2.2], [8, 2.2]], "midnight"),
      L(9.5, -1.2, 33.5, -2.2, "iceEdge"),
      D(15, 0.5, "star"), D(22, -0.5, "star"), D(28, 0, "star"),
    ],
    head: [8, 36.5, -3.2, 2.2],
    blade: ["midnight"],
  }),

  // 7) 초승달 비철 대검 — Trim teal knuckle-bow guard & sleek curved obsidian talon blade
  crescentfang: () => ({
    sh: [
      R(-3.2, -1.2, -1.5, 2.5, "steel"),
      R(-1.2, 5.5, -1.0, 2.0, "bronze"),
      // Clean thin teal knuckle-bow (`t = -4..5.5`)
      P([[5, -4.2], [7.5, -4.2], [8.5, 0], [8, 4.5], [4, 6.2], [0.5, 5.5], [1, 4.0], [5.5, 4.2], [6.5, 2.5], [6.5, -1.5]], "tealArc"),
      // Razor curved obsidian sabre with gleaming silver spine
      P([[8, -1.5], [21, -3.0], [31, -4.0], [36.5, -2.8], [32.5, 0.2], [22, 1.8], [8, 2.0]], "obsidian"),
      L(12, -1.8, 34, -3.0, "glint"),
      L(10, 0.5, 28, 0.2, "darkEdge"),
    ],
    head: [8, 36.5, -4.0, 2.0],
    blade: ["obsidian"],
  }),

  // 8) 황금 신전 대봉검 — Slender shaft tapering smoothly into flared crisp temple-bell crown
  pillarbell: () => ({
    sh: [
      P([[-3.5, -2.2], [-1.2, -1.2], [-1.2, 2.2], [-3.5, 3.2]], "gold"),
      R(-1.2, 6, -1.0, 2.0, "crimson"),
      P([[5.5, -4.5], [8, -4.5], [8.8, 0.5], [8, 5.5], [5.5, 5.5], [6.5, 0.5]], "gold"),
      // Smooth continuous flare (`t = ±1.6` waist smoothly flaring out to `±4.8` at `s=34.5`)
      P([[8.5, -1.6], [23, -1.8], [31, -3.5], [34.5, -4.8], [35.8, -4.8], [35.8, 5.8],
         [34.5, 5.8], [31, 4.5], [23, 2.8], [8.5, 2.6]], "gold"),
      L(13, 0.5, 32, 0.5, "amberPt"),
      D(18, 0.5, "spark"), D(28, 0.5, "spark"),
    ],
    head: [8.5, 35.8, -4.8, 5.8],
    blade: ["gold"],
  }),

  // 9) 심연 별빛 대검 — Sleek notched ocean-steel broadsword with crisp star glyphs & clean bevel
  abyssalcleaver: () => ({
    sh: [
      P([[-3.2, -2.0], [-1.2, -1.0], [-1.2, 2.0], [-3.2, 3.0]], "deepOcean"),
      R(-1.2, 6, -1.0, 2.0, "obsidian"),
      P([[5.5, -4.2], [8, -3.8], [8.8, 0.5], [8, 4.8], [5.5, 5.2]], "deepOcean"),
      D(7, 0.5, "cyanDot"),
      // Smooth single-step streamlined broad cleaver (`t = -2.0..-4.2..2.8`) with small crisp eyelet
      P([[8.5, -2.0], [18, -2.0], [20.5, -4.2], [32.5, -4.0], [36.5, -1.0], [32, 2.6], [19, 3.0], [8.5, 2.4]], "deepOcean"),
      R(28, 30, -2.2, -0.8, null),
      L(21, -3.2, 32, -3.2, "iceEdge"),
      D(15, 0.5, "star"), D(23, 0.5, "star"),
    ],
    head: [8.5, 36.5, -4.2, 3.0],
    blade: ["deepOcean"],
  }),

  // 10) 백열 성화 대검 — Ultra-sleek twin-pronged royal silver greatsword with ember spine glow
  solaris: () => ({
    sh: [
      C(-2.2, 0.5, 1.5, "gold"),
      R(-1.2, 6, -1.0, 2.0, "crimson"),
      P([[5.5, -5.0], [8.2, -3.8], [9, 0.5], [8.2, 4.8], [5.5, 6.0], [6.5, 0.5]], "gold"),
      D(7.2, 0.5, "spark"),
      // Sleek twin blades separated by glowing fiery spine (`t = -2.2..3.0`)
      P([[8.5, -2.2], [32.5, -2.2], [36.5, -1.0], [32, -0.3], [14, -0.3], [14, 1.3],
         [32, 1.3], [36.5, 2.0], [32.5, 3.2], [8.5, 3.2]], "silver"),
      L(11, 0.5, 30, 0.5, "amberPt"),
      D(26, 0.5, "spark"),
    ],
    head: [8.5, 36.5, -2.2, 3.2],
    blade: ["silver"],
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
