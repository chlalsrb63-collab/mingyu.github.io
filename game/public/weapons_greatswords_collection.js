/**
 * 양손대검 외형 컬렉션 (Arcane & Legendary Greatswords Collection — 10 Designs).
 *
 * Code-drawn Tales Tales `sword` geometry (`R`/`P`/`C`/`L`/`D` in weapon space `s` along blade, `t` across)
 * inspired by classic RPG greatsword silhouettes: dusk marbled broadsword, hollow-guard jade scimitar,
 * sunburst cyan greatsword, amethyst crystal broadsword, hooked-pommel jungle thorn blade,
 * starry midnight falchion, crescent-bow obsidian sabre, flared golden bell-pillar sword,
 * notched abyssal star-cleaver, and split-prong solaris greatsword.
 *
 * Compatible with `game/public/weapons.js` rasterizer (`W=44, H=32, GRIP=[5, 16]`, world pointing right,
 * and automatic 16×16 diagonal bag icon). Zero `src/logic.js` / `weapons.js` files modified.
 *
 * Integration Locations:
 *   1. `game/public/weapons.js`
 *      - Merge `GS_COLLECTION_M` into `M` (`GS_COLLECTION_EXTRA` into `EXTRA`).
 *      - Register `GS_SILHOUETTES` under `SIL.sword`.
 *      - Add `MOTIF_SIL.sword.<motif>` entries + motifs into `MOTIF`.
 *   2. `game/src/logic/65-cosmetics.js`
 *      - Append `GS_COLLECTION_META` (`ws_sword_*`, `slot: "wskin"`, `wk: "sword"`).
 *   3. `game/public/art.js` / `asset/generated/greatswords/`
 *      - Normalized 16×16 bag icons (`icon_ws_sword_*.png`) ready after owner approval.
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
export const GS_COLLECTION_M = {
  dawnPink:   ["#ffc8e0", "#f288b8", "#a84478"],
  skyAzure:   ["#b8ebff", "#5ab8f0", "#2c68b0"],
  bronze:     ["#ffe0a8", "#cc8f4e", "#7d4a2a"],
  leather:    ["#8c5c42", "#623a2c", "#3e2226"],
  ivory:      ["#fff9eb", "#e0d4be", "#a2928a"],
  steel:      ["#edf2fa", "#b8c4d8", "#74809c"],
  jade:       ["#a6f2c8", "#3cb882", "#1c6b58"],
  gold:       ["#fff09e", "#ecc048", "#a46a22"],
  cyanDark:   ["#88f4ec", "#229ca8", "#124c68"],
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
  glint:   "#ffffff",
  spark:   "#fff4a0",
  star:    "#dceeff",
  cyanDot: "#7cf8ff",
  ruby:    "#ff5068",
  amberPt: "#ffb840",
};

// ───────────────────────────── 2. ITEM METADATA ─────────────────────────────
export const GS_COLLECTION_META = [
  { id: "ws_sword_dawncloud",      silKey: "dawncloud",      wk: "sword", slot: "wskin", name: "여명 구름 대검",     desc: "복숭아빛 노을과 푸른 하늘이 어우러진 청동 호위 대검." },
  { id: "ws_sword_jadefalcon",     silKey: "jadefalcon",     wk: "sword", slot: "wskin", name: "비취 해적도 대검",   desc: "고리 손잡이와 옥빛 외날이 날렵하게 뻗은 사브르형 대검." },
  { id: "ws_sword_cyanguild",      silKey: "cyanguild",      wk: "sword", slot: "wskin", name: "창공 태양 대검",     desc: "황금 태양 날개 코등이 위에 청록 수정 검신을 세운 대검." },
  { id: "ws_sword_amethystbroad",  silKey: "amethystbroad",  wk: "sword", slot: "wskin", name: "자수정 심판 대검",   desc: "백광이 서린 날카로운 자수정 광날 대검." },
  { id: "ws_sword_thornviper",     silKey: "thornviper",     wk: "sword", slot: "wskin", name: "가시덩굴 독니 대검", desc: "갈고리 자루와 맹독 빛 톱니 가시가 돋은 밀림 대검." },
  { id: "ws_sword_starryedge",     silKey: "starryedge",     wk: "sword", slot: "wskin", name: "별밤 성운 대검",     desc: "어두운 밤하늘 검신 위로 은하수 별빛이 박힌 외날 대검." },
  { id: "ws_sword_crescentfang",   silKey: "crescentfang",   wk: "sword", slot: "wskin", name: "초승달 비철 대검",   desc: "청록 너클 가드와 날카로운 흑요석 갈고리 날의 대검." },
  { id: "ws_sword_pillarbell",     silKey: "pillarbell",     wk: "sword", slot: "wskin", name: "황금 신전 대봉검",   desc: "끝으로 갈수록 종 모양으로 넓어지는 장중한 황금 신전 봉검." },
  { id: "ws_sword_abyssalcleaver", silKey: "abyssalcleaver", wk: "sword", slot: "wskin", name: "심연 별빛 대검",     desc: "검신 구멍과 성좌 문양이 새겨진 묵직한 심해 클리버 대검." },
  { id: "ws_sword_solaris",        silKey: "solaris",        wk: "sword", slot: "wskin", name: "백열 성화 대검",     desc: "타오르는 불꽃 중심 홈을 품은 쌍날 창기병형 성검." },
];

// ───────────────────────────── 3. SILHOUETTES (weapon-space R/P/C/L/D) ─────────────────────────────
// Sword world canvas: 44×32 (GRIP at [5, 16] -> safe bounds s in [-3.5..37], t in [-12..12]).

export const GS_SILHOUETTES = {
  // 1) 여명 구름 대검 — Bronze clover guard + broad pastel-pink & sky-azure marbled blade
  dawncloud: () => ({
    sh: [
      C(-2.2, 0, 2.0, "bronze"), D(-2.5, 0, "ruby"),
      R(-1, 6, -1.5, 1.5, "leather"),
      // Clover-leaf bronze crossguard
      P([[5, -3], [6, -6], [9, -6], [10, -2], [10, 2], [9, 6], [6, 6], [5, 3]], "bronze"),
      D(7.5, 0, "ruby"),
      // Broad symmetrical sky-azure base blade + swirling dawn-pink marble patches
      P([[9, -3.5], [32, -3.5], [36, 0], [32, 3.5], [9, 3.5]], "skyAzure"),
      P([[9, -3], [16, -3], [18, 0], [13, 2], [9, 3]], "dawnPink"),
      P([[19, -3.5], [27, -3.5], [24, 1], [17, 1]], "dawnPink"),
      P([[26, 0], [33, -2], [35.5, 0], [31, 3.5], [23, 3.5]], "dawnPink"),
      L(11, 0, 29, 0, "glint"),
    ],
    head: [9, 36, -3.5, 3.5],
    blade: ["dawnPink", "skyAzure"],
  }),

  // 2) 비취 해적도 대검 — Ivory hilt + hollow ring guard + sleek curved jade scimitar blade
  jadefalcon: () => ({
    sh: [
      P([[-3.5, -2.5], [-1, -2], [-1, 2], [-3.5, 2.5]], "gold"),
      R(-1, 6, -1.4, 1.4, "ivory"),
      // Hollow steel circular handguard ring (crisp aperture at both world & 16px icon)
      C(7.5, 0, 3.8, "steel"),
      C(7.5, 0, 1.9, null),
      // Sleek tapering jade-emerald curved cutlass blade
      P([[9.5, -2.5], [21, -4.5], [32, -4], [36.5, -1.5], [31, 2], [20, 3.5], [9.5, 2.5]], "jade"),
      P([[13, -2], [23, -4], [34, -2], [24, -1]], "silver"),
      D(15, 0.5, "glint"), D(23, 0, "glint"),
    ],
    head: [10, 36.5, -4.5, 3.5],
    blade: ["jade"],
  }),

  // 3) 창공 태양 대검 — Golden sunburst winged crossguard + glowing deep teal-cyan blade
  cyanguild: () => ({
    sh: [
      C(-2.0, 0, 1.9, "gold"),
      R(-1, 5, -1.5, 1.5, "gold"), R(1, 2, -1.5, 1.5, "leather"), R(3, 4, -1.5, 1.5, "leather"),
      // Fanned golden sun-wing crossguard (`t = -8.5..8.5`)
      P([[4.5, -2], [5.5, -8.5], [9, -6.0], [10.5, -7.5], [11, -3], [11, 3],
         [10.5, 7.5], [9, 6.0], [5.5, 8.5], [4.5, 2]], "gold"),
      // Deep cyan glowing crystal blade + bright aqua edge
      P([[10, -3], [32, -3], [36.5, 0], [32, 3], [10, 3]], "cyanDark"),
      P([[12, -2.5], [31, -2.5], [35, 0], [31, -0.5], [12, -0.5]], "tealArc"),
      L(13, 0.5, 28, 0.5, "cyanDot"),
    ],
    head: [10, 36.5, -3, 3],
    blade: ["cyanDark", "tealArc"],
  }),

  // 4) 자수정 심판 대검 — Wide bronze-amber guard + sharp faceted purple amethyst blade with white ridge
  amethystbroad: () => ({
    sh: [
      R(-3.5, -1.5, -2.2, 2.2, "bronze"),
      R(-1.5, 6, -1.5, 1.5, "leather"),
      P([[5, -6], [8.5, -6], [10, 0], [8.5, 6], [5, 6], [6, 0]], "bronze"),
      D(7.5, 0, "amberPt"),
      // Broad tapering amethyst slab (`t=-4..4`) + intense white core ridge
      P([[9, -4], [27, -3.5], [36.5, 0], [27, 3.5], [9, 4]], "amethyst"),
      P([[11, -1.2], [29, -1.0], [34, 0], [29, 1.0], [11, 1.2]], "silver"),
    ],
    head: [9, 36.5, -4, 4],
    blade: ["amethyst"],
  }),

  // 5) 가시덩굴 독니 대검 — Hooked ivory shepherd pommel + split leaf guard + barbed moss-green serrated blade
  thornviper: () => ({
    sh: [
      // Distinct curved J-hook ivory pommel curling under the hand!
      P([[-3.5, 0], [-3.5, 5], [-1, 7], [2, 6], [2, 4], [-0.5, 4.5], [-1.5, 3], [-1.5, 0]], "ivory"),
      R(-1.5, 6, -1.5, 1.5, "crimson"),
      // Split golden thorn-leaf guard
      P([[5, -5.5], [9, -6.5], [11, -2], [11, 2], [9, 6.5], [5, 5.5], [7, 0]], "gold"),
      // Backward-barbed emerald serrated upper edge + crisp green core
      P([[9.5, -3], [14, -3], [16, -6.5], [18, -3], [21, -3], [23, -6.5], [25, -3],
         [28, -3], [30, -6], [36.5, -1], [31, 3], [9.5, 3]], "mossGreen"),
      D(15.5, -4, "spark"), D(22.5, -4, "spark"), D(29.5, -3.5, "spark"),
    ],
    head: [9.5, 36.5, -6, 3],
    blade: ["mossGreen"],
  }),

  // 6) 별밤 성운 대검 — Silver handle + asymmetrical S-hook violet guard + starry midnight falchion
  starryedge: () => ({
    sh: [
      P([[-3.5, -2.5], [-1, -2], [-1, 2], [-3.5, 2.5]], "violet"),
      R(-1, 6, -1.4, 1.4, "ivory"),
      // Asymmetrical S-curved violet handguard (`top hook forward, bottom curl back`)
      P([[4, -2], [6, -5.5], [11, -5.5], [12, -3.5], [8, -3.5], [7.5, 2.5], [4, 6], [2, 4.5], [5, 2]], "violet"),
      // Night-sky falchion blade with sparkling star glyphs
      P([[8.5, -2.5], [26, -4], [36.5, -1.5], [32, 2.5], [21, 3.5], [8.5, 3]], "midnight"),
      L(11, -2, 32, -2, "silver"),
      D(15, 0.5, "star"), D(21, -0.5, "star"), D(27, 0, "star"),
    ],
    head: [9, 36.5, -4, 3.5],
    blade: ["midnight"],
  }),

  // 7) 초승달 비철 대검 — Swept aqua-teal knuckle-bow guard + fierce curved obsidian crescent blade
  crescentfang: () => ({
    sh: [
      P([[-3.5, -2], [-1, -2.5], [-0.5, 2.5], [-3.5, 2]], "steel"),
      R(-1, 5.5, -1.4, 1.4, "bronze"),
      // Iconic aqua-teal knuckle-bow curving over bottom edge (`t = +3..8`) back to grip
      P([[5, -5.5], [8.5, -6], [10, -2], [10, 4], [6, 8], [1, 7], [0, 5], [5, 5.5], [7, 3.5], [7, -2]], "tealArc"),
      // Arched obsidian hook blade with bright silver upper edge
      P([[8.5, -2.5], [18, -5.5], [28, -7], [36, -5], [34, -2], [29, 0.5], [21, 2.5], [8.5, 2.5]], "obsidian"),
      P([[16, -4.5], [27, -6.5], [35, -4.5], [27, -3.5]], "silver"),
    ],
    head: [9, 36, -7, 3],
    blade: ["obsidian"],
  }),

  // 8) 황금 신전 대봉검 — Star crossguard + flared golden bell-pillar sword with sun-cores along center
  pillarbell: () => ({
    sh: [
      P([[-3.5, -3.5], [-1, -2], [-1, 2], [-3.5, 3.5]], "gold"),
      R(-1, 6, -1.5, 1.5, "crimson"),
      P([[5, -6], [8.5, -6], [10, -2], [10, 2], [8.5, 6], [5, 6], [6, 0]], "gold"),
      // Flaring temple-pillar blade widening dramatically into a bell-crown tip (`t = -6.5..6.5`)!
      P([[9.5, -2.5], [20, -3.0], [29, -4.5], [34, -7.0], [36, -7.0], [36, 7.0], [34, 7.0],
         [29, 4.5], [20, 3.0], [9.5, 2.5]], "gold"),
      R(32.5, 35, -5.5, 5.5, "bronze"),
      D(15, 0, "amberPt"), D(23, 0, "amberPt"), D(30, 0, "spark"),
    ],
    head: [10, 36, -7, 7],
    blade: ["gold"],
  }),

  // 9) 심연 별빛 대검 — Broad notched deep-ocean cleaver + pierced blade hole + cyan constellation dots
  abyssalcleaver: () => ({
    sh: [
      P([[-3.5, -3], [-1, -2], [-1, 2], [-3.5, 3]], "deepOcean"),
      R(-1, 6, -1.5, 1.5, "obsidian"),
      P([[5, -5.5], [8.5, -4.5], [9.5, 0], [8.5, 4.5], [5, 5.5]], "deepOcean"),
      D(7, 0, "cyanDot"),
      // Wide asymmetrical notched cleaver-greatsword (`t = -7.5..5.5`) + cutout piercing!
      P([[9, -2.5], [16, -2.5], [19, -7.5], [32, -7], [36.5, -2], [33, 3.5], [22, 5.5], [14, 3.5], [9, 3]], "deepOcean"),
      // Clean diamond hole punched inside upper-tip blade
      P([[27, -3.5], [30, -3.5], [29, -1.5]], null),
      P([[19, -6.5], [31, -6], [35, -2], [29, -4]], "skyAzure"),
      D(21, -1, "star"), D(25, 1.5, "star"), D(24, -3, "star"),
    ],
    head: [9, 36.5, -7.5, 5.5],
    blade: ["deepOcean"],
  }),

  // 10) 백열 성화 대검 (보너스 10종째) — Twin-pronged split greatsword with fiery ember central fuller
  solaris: () => ({
    sh: [
      C(-2.2, 0, 2.0, "gold"),
      R(-1, 6, -1.5, 1.5, "crimson"),
      // Swept crimson-gold wing crossguard
      P([[5, -6.5], [9, -4.5], [10, 0], [9, 4.5], [5, 6.5], [6, 0]], "gold"),
      D(7, 0, "spark"),
      // Split double-prong silver greatsword enclosing glowing amber ember fuller!
      P([[9.5, -3.5], [31, -3.5], [36.5, -2], [31, -1], [15, -1], [15, 1], [31, 1],
         [36.5, 2], [31, 3.5], [9.5, 3.5]], "silver"),
      R(12, 29, -1.0, 1.0, "amberCore"),
      D(26, 0, "spark"),
    ],
    head: [10, 36.5, -3.5, 3.5],
    blade: ["silver", "amberCore"],
  }),
};

// ───────────────────────────── 4. RASTERISERS (mirror weapons.js sword 44×32) ─────────────────────────────

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
