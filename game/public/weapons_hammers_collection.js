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
  // 1) 백은 성기사 대형 망치 — Winged steel guard + huge crimson-banded silver drum with bright gold faces & top spike
  royalpaladin: () => ({
    sh: [
      R(-3.0, -1.5, -2.0, 2.0, "gold"),
      R(-1.5, 4, -1.5, 1.5, "crimson"),
      R(4, 11, -1.5, 1.5, "steel"),
      // Winged silver collar guard below head (`s=7..10`)
      P([[6.5, -5.5], [9.5, -3], [9.5, 3], [6.5, 5.5], [8, 0]], "steel"),
      // Massive crimson-banded cylinder maul + bright gold striking caps (`t = -10.5..-7` & `7..10.5`)
      R(11.5, 19.5, -8.5, 8.5, "crimson"),
      R(12.5, 18.5, -4, 4, "steel"),
      R(11, 20, -10.8, -7.2, "gold"),
      R(11, 20, 7.2, 10.8, "gold"),
      // Tip spire finial (`s=19.5..24`) & white center seal
      P([[19, -2.5], [24, 0], [19, 2.5]], "gold"),
      C(15.5, 0, 2.3, "glint"), D(15.5, 0, "ruby"),
    ],
    head: [11, 22, -10.5, 10.5],
    blade: ["steel", "gold"],
  }),

  // 2) 혈철 마신 대형 망치 — Spiked scarlet blood-iron maul with hollowed dark central eye socket
  bloodforge: () => ({
    sh: [
      R(-3.0, 2.5, -1.8, 1.8, "crimson"),
      R(2.5, 11.5, -1.3, 1.3, "ironDark"),
      R(6, 8, -2.2, 2.2, "crimson"),
      // Heavy spiked blood-iron double cylinder with flaring notched face claws
      P([[11, -9.5], [14, -11], [18, -11], [20.5, -9], [19, -5.5], [20.5, 0], [19, 5.5],
         [20.5, 9], [18, 11], [14, 11], [11, 9.5], [12.5, 5], [11, 0], [12.5, -5]], "bloodIron"),
      R(13, 18.5, -4, 4, "bloodIron"),
      // Hollow dark socket eye right in middle of hammer face!
      C(15.5, 0, 1.9, "ironDark"), C(15.5, 0, 0.9, null),
      L(12, -8, 19, -8, "ember"), L(12, 8, 19, 8, "ember"),
    ],
    head: [11, 20.5, -11, 11],
    blade: ["bloodIron"],
  }),

  // 3) 황금 곡괭이 망치 — Golden shaft with flat hammer drum top & sharp curved piercing pick beak bottom
  sumpick: () => ({
    sh: [
      C(-1.7, 0, 1.4, "gold"),
      R(-1, 12, -1.4, 1.4, "bronze"),
      // Braided golden collar fork bracing the head
      P([[8, -2], [11, -4.5], [13.5, -4.5], [13.5, 4.5], [11, 4.5], [8, 2]], "gold"),
      R(12, 19.5, -4, 4, "crimson"),
      // Upper flat golden anvil head (`t = -10.5..-4`)
      R(11.5, 20, -10.5, -4, "gold"),
      R(13, 18.5, -10.5, -8.5, "silver"),
      // Lower curved golden armor-piercing pick spike (`t = +4..+11.8`)
      P([[12.5, 4], [18.5, 4], [20, 7.5], [17.5, 11.5], [15, 11.8], [15.5, 8.5], [12.5, 5.5]], "gold"),
      D(15.5, 0, "amberCore"), P([[19.5, -2.5], [23.5, 0], [19.5, 2.5]], "gold"),
    ],
    head: [11.5, 22, -10.5, 11.5],
    blade: ["gold"],
  }),

  // 4) 쌍룡 도끼 망치 — Dark haft, golden spiral coils, broad beveled steel axe-hammer slab
  dragoncleave: () => ({
    sh: [
      R(-3.0, 4.5, -1.7, 1.7, "ironDark"),
      R(4.5, 11, -1.5, 1.5, "ironDark"),
      C(7.5, 0, 2.2, "steel"), D(7.5, 0, "glint"),
      // Coiled golden dragon scroll wings gripping the heavy wedge head
      P([[9, -5.5], [12.5, -7.5], [14, -3], [14, 3], [12.5, 7.5], [9, 5.5], [11, 0]], "gold"),
      // Massive asymmetrical chamfered steel axe-hammer slab (`t = -10.5..10`)
      P([[12.5, -10.5], [21.5, -10.5], [24, -6], [23, 5], [18.5, 10.5], [13.5, 9], [12.5, 3]], "steel"),
      P([[18, -10], [21.5, -10], [23.5, -5.5], [22.5, 4.5], [18, 9.5], [17, 6], [19.5, 0], [17.5, -6]], "silver"),
      C(14.5, 0, 1.8, "gold"),
    ],
    head: [12.5, 24, -10.5, 10.5],
    blade: ["steel", "silver"],
  }),

  // 5) 태엽 강철 톱니 망치 — Giant gold-banded dark drum opposite spiked anvil + 4-stud brass hub
  gearfoundry: () => ({
    sh: [
      R(-3.0, 3, -1.7, 1.7, "leather"),
      R(3, 12, -1.4, 1.4, "ironDark"),
      // Center riveted brass-steel hub (`s=11..18, t=-4..4`)
      R(11, 18.5, -4, 4, "ironDark"),
      C(14.5, 0, 1.6, "gold"),
      // Giant top banded drum (`t = -11..-3`) with twin gold trim rings
      P([[10, -8.5], [12, -11], [18.5, -11], [21, -8.5], [21, -4.5], [18.5, -3], [11.5, -3], [10, -5]], "ironDark"),
      R(10.5, 20.5, -8.5, -7, "gold"),
      R(10.5, 20.5, -5.5, -4.2, "gold"),
      // Compact bottom anvil cap (`t = 3.5..10`) + tip bolt spike (`s=18.5..22.5`)
      R(12, 18, 3.5, 9.5, "steel"),
      R(12.5, 17.5, 6.5, 8.0, "gold"),
      P([[18.5, -2], [22.5, 0], [18.5, 2]], "steel"),
    ],
    head: [10, 22.5, -11, 9.5],
    blade: ["ironDark", "gold"],
  }),

  // 6) 심홍 성당 십자 망치 — Crimson-gold cross pommel, studded golden tower drum vs crimson spire & cross tip
  cathedral: () => ({
    sh: [
      P([[-3.2, -3.2], [-1, -2], [-1, 2], [-3.2, 3.2]], "gold"),
      R(-1, 12, -1.3, 1.3, "ironDark"),
      R(11, 18.5, -4.5, 4.5, "gold"),
      // Studded upper golden tower head (`t = -11..-4`)
      R(11, 19, -10.5, -4, "crimson"),
      R(10.5, 19.5, -10.5, -7.5, "gold"),
      D(12.5, -11, "gold"), D(15, -11, "gold"), D(17.5, -11, "gold"),
      // Pointed lower crimson church-spire spike (`t = 4..11.5`)
      P([[12, 4], [18, 4], [15.5, 11.5], [13.5, 11.5]], "crimson"),
      R(13, 17, 5, 6.5, "gold"),
      // Glowing crimson cross crest on hub + tip cross spike (`s=18.5..24`)
      P([[18.5, -1.5], [23.5, 0], [18.5, 1.5]], "crimson"),
      D(15, 0, "ruby"),
    ],
    head: [10.5, 23.5, -11, 11.5],
    blade: ["gold", "crimson"],
  }),

  // 7) 빙결 쌍보주 망치 — Ornate golden cradle holding TWO huge faceted ice-azure orbs + golden spear spike
  glacierorb: () => ({
    sh: [
      C(-1.7, 0, 1.4, "bronze"),
      R(-1, 13, -1.4, 1.4, "gold"),
      // Golden twin-cup collar cradling top & bottom spheres
      R(11.5, 18.5, -4, 4, "gold"),
      // Top & bottom giant faceted glacier crystal spheres!
      C(15.5, -6.5, 4.3, "glacier"),
      C(15.5, 6.5, 4.3, "glacier"),
      D(14, -8, "glint"), D(14, 5, "glint"),
      // Center golden spear spike piercing past both orbs (`s=18..24.5`)
      P([[15, -2.5], [24.5, 0], [15, 2.5]], "gold"),
      D(19, 0, "spark"),
    ],
    head: [11, 24.5, -11, 11],
    blade: ["glacier"],
  }),

  // 8) 심안 광기 모닝스타 — S-curved twisted oak haft + spiked silver sun-maul cradling burning amber eye
  eyeabyss: () => ({
    sh: [
      // S-curved gnarled wooden haft (`t` bends up then down before head!)
      P([[-3, 2], [2, 3.5], [6, 0.5], [11, -1.5], [12, 1.5], [6.5, 3.5], [1.5, 6.0], [-2.5, 4.5]], "oak"),
      // Golden moon halo behind spiked silver skull-sun core
      C(14.5, -6.5, 3.2, "gold"),
      // Spiked chaotic silver star-maul (`s=11..23, t=-9..9`)
      P([[11, -2], [10, -6.5], [14, -5], [16, -10.5], [18, -5.5], [23, -6.5], [20, -1],
         [24, 1], [20, 3], [22.5, 8], [17.5, 6], [15.5, 10.5], [13.5, 5], [9.5, 7], [11, 2]], "silver"),
      // Glowing molten amber cat-eye core at dead center!
      C(16, 0, 2.6, "ironDark"),
      C(16, 0, 1.8, "amberCore"),
      D(16, -0.5, "glint"),
    ],
    head: [10, 24, -10.5, 10.5],
    blade: ["silver"],
  }),

  // 9) 전쟁공방 쇠망치 — Sleek steel knight war-haft + chamfered gold sledge head vs sharp silver back-peen spike
  warforge: () => ({
    sh: [
      C(-1.7, 0, 1.4, "steel"),
      R(-1, 13, -1.3, 1.3, "ironDark"),
      R(3, 5, -1.8, 1.8, "gold"), R(8.5, 10.5, -1.8, 1.8, "steel"),
      R(12, 18.5, -3.5, 3.5, "steel"),
      // Top gold-capped square sledge (`t = -10.5..-3.5`)
      P([[11.5, -3.5], [11.5, -9.5], [13, -10.8], [17.5, -10.8], [19, -9.5], [19, -3.5]], "gold"),
      R(12.5, 18, -6.5, -3.5, "crimson"),
      // Bottom sleek triangular armor-piercing cross-peen spike (`t = 3.5..10.5`)
      P([[13, 3.5], [18, 3.5], [16.5, 10.5], [14.5, 10.5]], "steel"),
      D(15.5, 0, "amberCore"),
    ],
    head: [11.5, 19, -10.8, 10.5],
    blade: ["gold", "steel"],
  }),

  // 10) 유성운철 대형 망치 (보너스 10종째) — Cracked dark meteorite octagon maul with blazing molten magma veins
  meteor: () => ({
    sh: [
      R(-3.0, -1.2, -2.0, 2.0, "bronze"),
      R(-1.2, 11.5, -1.5, 1.5, "oak"),
      R(10, 12, -2.5, 2.5, "bronze"),
      // Massive rough octagonal dark meteorite stone head (`s=11.5..22.5, t=-9.5..9.5`)
      P([[11.5, -5.5], [13.5, -9.5], [20, -9.5], [22.5, -5.5], [22.5, 5.5], [20, 9.5], [13.5, 9.5], [11.5, 5.5]], "meteor"),
      // Glowing molten lava veins & central magma crack
      L(14, -7, 17, -2, "ember"), L(17, -2, 20, -5, "ember"),
      L(14, 7, 17, 2, "ember"),   L(17, 2, 20, 5, "ember"),
      C(17, 0, 2.1, "amberCore"), D(16.5, -0.5, "spark"),
    ],
    head: [11.5, 22.5, -9.5, 9.5],
    blade: ["meteor", "amberCore"],
  }),
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
