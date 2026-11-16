/**
 * 활 무기 외형 컬렉션 (Arcane & Fantasy Bows Collection — 10 Designs).
 *
 * Code-drawn Tales Tales `bow` geometry using `bowParts` parametric curve (`T, tip, g, w0, w1, rc, gap`),
 * dynamically animating string draw (`pull: -0.25..1.0`) and nocked arrows (`arrow: true`),
 * inspired by classic RPG fantasy bows: angel-wing seraph bow, cupid heart-wing bow,
 * raven skull bone bow, emerald horned abyssal bow, floral vine fae bow, frost-thorn silver bow,
 * crimson dragon-wing bow, blood-thorn teal bow, golden twin-drake bow, and neon cyber-wing bow.
 *
 * Compatible with `game/public/weapons.js` rasterizer (`W=32, H=32, GRIP=[5, 16]`,
 * and `16×16` diagonal `pull=0.4, arrow=true` bag icon). Zero `src/logic.js` / `weapons.js` files modified.
 *
 * Integration Locations:
 *   1. `game/public/weapons.js`
 *      - Merge `BOW_COLLECTION_M` into `M` (`BOW_COLLECTION_EXTRA` into `EXTRA`).
 *      - Register `BOW_SILHOUETTES` under `SIL.bow`.
 *      - Add `MOTIF_SIL.bow.<motif>` entries + motifs into `MOTIF`.
 *   2. `game/src/logic/65-cosmetics.js`
 *      - Append `BOW_COLLECTION_META` (`ws_bow_*`, `slot: "wskin"`, `wk: "bow"`).
 *   3. `game/public/art.js` / `asset/generated/bows/`
 *      - Normalized 16×16 bag icons (`icon_ws_bow_*.png`) ready after owner approval.
 */

const GRIP = [5, 16];
const RISER = 7;
const NOCK_FULL = -3.5;
const ARROW_LEN = 14;
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
export const BOW_COLLECTION_M = {
  silver:    ["#ffffff", "#d0dced", "#7d89ab"],
  gold:      ["#fff09e", "#ecc048", "#a46a22"],
  pink:      ["#ffc7e0", "#f26da8", "#9e2e66"],
  ruby:      ["#ff8a98", "#e82a54", "#8a1236"],
  bone:      ["#fff8e6", "#dfd1b8", "#9e8e80"],
  leather:   ["#946044", "#663c2c", "#3e2226"],
  obsidian:  ["#626880", "#2f3246", "#181926"],
  emerald:   ["#a4f778", "#34b848", "#18623a"],
  vineGreen: ["#b8eb74", "#4fa646", "#235c36"],
  frost:     ["#e8f8ff", "#98d4f5", "#4c7ab8"],
  crimson:   ["#ff8878", "#d63834", "#841c2c"],
  tealThorn: ["#76e0d4", "#248f8c", "#144b54"],
  steel:     ["#edf2fa", "#b4c0d4", "#6e7894"],
  oak:       ["#c48e5c", "#8e5c38", "#573530"],
  ribbon:    ["#ff99bc", "#eb4e84", "#992652"],
};

export const BOW_COLLECTION_EXTRA = {
  gut:     "#f2e6c8",
  shaft:   "#e8cc94",
  glint:   "#ffffff",
  spark:   "#fff4a0",
  core:    "#e8ffff",
  glow:    "#7af4ff",
  venom:   "#8ae84a",
  cyanDot: "#7cf8ff",
  rubyPt:  "#ff5068",
  ember:   "#ff8a34",
  petals:  "#ffb6d2",
  inkEye:  "#2b2233",
};

// ───────────────────────────── 2. ITEM METADATA ─────────────────────────────
export const BOW_COLLECTION_META = [
  { id: "ws_bow_seraph",        silKey: "seraph",        wk: "bow", slot: "wskin", name: "천사 날개 성궁",     desc: "순백의 천사 날개와 황금 깃끝 장식이 돋보이는 성스러운 리커브 활." },
  { id: "ws_bow_cupidheart",    silKey: "cupidheart",    wk: "bow", slot: "wskin", name: "큐피드 하트 윙 보우", desc: "루비 하트 문장과 작은 흰 날개·황금 소용돌이가 달린 사랑의 활." },
  { id: "ws_bow_ravenbone",     silKey: "ravenbone",     wk: "bow", slot: "wskin", name: "칠흑 까마귀 해골궁", desc: "까마귀 두개골 손잡이와 불꽃 깃털 장식이 얹힌 주술사의 사냥활." },
  { id: "ws_bow_abyssalmaw",    silKey: "abyssalmaw",    wk: "bow", slot: "wskin", name: "심연 비취 악마궁",   desc: "뿔 돋친 칠흑 마신 가면에서 맹독 빛 날개가 뻗어 나온 심연의 활." },
  { id: "ws_bow_floralfae",     silKey: "floralfae",     wk: "bow", slot: "wskin", name: "봄꽃 요정 덩굴궁",   desc: "푸른 덩굴 가지마다 분홍빛 봄꽃이 피어난 숲 요정의 활." },
  { id: "ws_bow_frostthorn",    silKey: "frostthorn",    wk: "bow", slot: "wskin", name: "서리 은가시 수정궁", desc: "서릿발 가시와 푸른 사파이어 결정이 맺힌 만년설의 활." },
  { id: "ws_bow_crimsonwyrm",   silKey: "crimsonwyrm",   wk: "bow", slot: "wskin", name: "진홍 용익 비늘궁",   desc: "붉은 비룡의 날개 비늘과 상아 발톱을 깎아 만든 용족 장궁." },
  { id: "ws_bow_sapphirethorn", silKey: "sapphirethorn", wk: "bow", slot: "wskin", name: "청옥 혈가시 궁",     desc: "심해 청록 덩굴 등줄기에 선홍빛 가시가 촘촘히 박힌 마궁." },
  { id: "ws_bow_goldendrake",   silKey: "goldendrake",   wk: "bow", slot: "wskin", name: "황금 쌍룡 패왕궁",   desc: "위아래를 향해 포효하는 황금 쌍룡 장식이 새겨진 제왕의 활." },
  { id: "ws_bow_cyberpink",     silKey: "cyberpink",     wk: "bow", slot: "wskin", name: "네온 윙 아머 보우",   desc: "발광 코어와 흰 메카 윙 플레이트가 결합된 사이버 에너지 활." },
];

// Helper: shared parametric bow generator matching weapons.js bowParts
function bowParts(b, o, icon) {
  const p = Math.max(-0.25, Math.min(1, o.pull || 0)), dr = Math.max(0, p), k = icon ? 1.25 : 1;
  const T = b.T - 1.2 * dr, tipS = b.tip - 1.4 * dr + 1.2 * Math.max(0, -p), g = b.g, r = RISER;
  const span = Math.max(1, T - g);
  const c = (t) => {
    const u = Math.max(0, Math.min(1, (Math.abs(t) - g) / span));
    return r - (r - tipS) * u * u + (b.rc || 0) * Math.max(0, (u - 0.68) / 0.32) ** 2;
  };
  const sh = [], post = [];
  for (const sg of [-1, 1]) {
    const L0 = [], L1 = [], n = 10, u0 = b.gap ? b.gap / span : 0;
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((1 - u0) * i) / n, t = sg * (g + span * u), w = (b.w0 + (b.w1 - b.w0) * u) * k;
      L0.push([c(t) - w / 2, t]);
      L1.unshift([c(t) + w / 2, t]);
    }
    sh.push(P(L0.concat(L1), b.mat));
  }
  const nock = p >= 0 ? tipS + p * (NOCK_FULL - tipS) : tipS - p * 6;
  const ts = c(T) - 0.4, tt = T - 0.6;
  if (Math.abs(nock - ts) < 0.3) post.push(L(ts, -tt, ts, tt, b.str));
  else post.push(L(ts, -tt, nock, 0, b.str), L(nock, 0, ts, tt, b.str));
  if (o.arrow) {
    const a = nock, h = a + ARROW_LEN;
    sh.push(
      L(a + 1, 0, h - 1, 0, "shaft"),
      P([[a + 0.6, -1.4], [a + 3.6, -0.4], [a + 3.6, 0.2], [a + 0.6, 0.2]], b.fl || "crimson"),
      P([[a + 0.6, 0.8], [a + 3.6, 0.8], [a + 3.6, 1.4], [a + 0.6, 2.4]], b.fl || "crimson"),
      P([[h - 1.2, -1.3], [h + 2.6, 0.5], [h - 1.2, 2.3]], "steel"),
    );
  }
  return { sh, post, c, T, tipS };
}

const bow = (b, extra) => (icon, o = {}) => {
  const pt = bowParts(b, o, icon), k = icon ? 1.15 : 1;
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

// ───────────────────────────── 3. SILHOUETTES (10 Bows) ─────────────────────────────
export const BOW_SILHOUETTES = {
  // 1) 천사 날개 성궁 — Gleaming silver recurve + twin crisp white angel wings + golden tip flares
  seraph: bow({ T: 11.8, tip: 4.0, g: 2.5, w0: 2.3, w1: 1.4, rc: 2.6, mat: "silver", str: "core", fl: "cyanDot" }, (c, T, tip, k) => ({
    sh: [
      R(RISER - 1.4 * k, RISER + 1.5 * k, -2.5, 2.5, "gold"),
      D(RISER + 0.3, 0, "cyanDot"),
      // Swept sculpted upper & lower seraph wings branching out along limbs
      ...[-1, 1].flatMap((sg) => [
        P([
          [c(sg * 3.5), sg * 3.0],
          [c(sg * 3.5) + 4.8 * k, sg * 2.5],
          [c(sg * 5.0) + 3.8 * k, sg * 6.5],
          [c(sg * 6.5), sg * 6.8],
        ], "silver"),
        P([[c(sg * T) - 1.0, sg * (T - 1.5)], [c(sg * T) + 1.8 * k, sg * (T + 0.4)], [c(sg * T) - 0.5, sg * (T + 0.6)]], "gold"),
      ]),
    ],
  })),

  // 2) 큐피드 하트 윙 보우 — Rose-pink bow + twin ruby-heart gold medallions + mini white wing flaps
  cupidheart: bow({ T: 11.4, tip: 3.8, g: 2.5, w0: 2.2, w1: 1.4, rc: 2.0, mat: "pink", str: "glint", fl: "gold" }, (c, T, tip, k) => ({
    sh: [
      R(RISER - 1.3 * k, RISER + 1.4 * k, -2.5, 2.5, "gold"),
      ...[-1, 1].flatMap((sg) => [
        // Gold heart bezel + mini white winglet sticking backward/forward
        P([[c(sg * 4.2) + 0.5, sg * 3.2], [c(sg * 4.2) + 4.0 * k, sg * 4.0], [c(sg * 4.2) + 2.2 * k, sg * 6.8]], "silver"),
        C(c(sg * 4.2), sg * 4.5, 2.0 * k, "gold"),
        C(c(sg * 4.2), sg * 4.5, 1.1 * k, "ruby"),
        // Curled tip finial pearls
        C(c(sg * T) + 0.4, sg * (T - 0.2), 1.3 * k, "gold"),
        D(c(sg * T) + 0.4, sg * (T - 0.2), "glint"),
      ]),
    ],
  })),

  // 3) 칠흑 까마귀 해골궁 — Bone raven-beak skull at riser + red/orange/bone plume flares
  ravenbone: bow({ T: 11.8, tip: 3.8, g: 3.0, w0: 2.4, w1: 1.5, rc: 1.8, mat: "oak", str: "gut", fl: "ember" }, (c, T, tip, k) => ({
    sh: [
      // Bold ivory raven beak skull projecting right over RISER!
      P([[RISER - 2.0 * k, -3.2], [RISER + 4.5 * k, 0], [RISER - 2.0 * k, 3.2], [RISER - 2.6 * k, 0]], "bone"),
      D(RISER, -0.5, "inkEye"),
      // Stratified shaman crimson + amber + white feather fans on limbs
      ...[-1, 1].flatMap((sg) => [
        P([[c(sg * 4.8) - 1.2, sg * 3.2], [c(sg * 5.2) + 3.2 * k, sg * 4.5], [c(sg * 6.5) + 1.2, sg * 7.2], [c(sg * 6.2) - 1.0, sg * 6.2]], "crimson"),
        P([[c(sg * 5.6) + 0.5, sg * 5.0], [c(sg * 5.8) + 2.5 * k, sg * 5.8], [c(sg * 6.5) + 0.8, sg * 7.2]], "bone"),
        C(c(sg * T), sg * (T - 0.2), 1.1 * k, "crimson"),
      ]),
    ],
  })),

  // 4) 심연 비취 악마궁 — Jet-black spiked demon-horn grip + toxic emerald recurve limbs
  abyssalmaw: bow({ T: 11.6, tip: 3.6, g: 3.6, w0: 2.5, w1: 1.6, rc: 2.2, mat: "emerald", str: "venom", fl: "emerald" }, (c, T, tip, k) => ({
    sh: [
      // Obsidian demon head collar with symmetric forward & rear horns + emerald eye!
      P([
        [RISER - 2.0 * k, -4.0], [RISER + 3.5 * k, -2.5], [RISER + 1.8 * k, 0],
        [RISER + 3.5 * k, 2.5], [RISER - 2.0 * k, 4.0], [RISER - 3.5 * k, 0],
      ], "obsidian"),
      P([[RISER + 1, -3], [RISER + 4.8 * k, -5.0], [RISER + 2.5 * k, -1.5]], "obsidian"),
      P([[RISER + 1, 3], [RISER + 4.8 * k, 5.0], [RISER + 2.5 * k, 1.5]], "obsidian"),
      C(RISER + 0.3, 0, 1.4 * k, "emerald"),
      D(RISER + 0.3, 0, "spark"),
      // Dark iron caps at limb tips
      ...[-1, 1].map((sg) => P([[c(sg * T) - 1.0, sg * (T - 1.5)], [c(sg * T) + 1.2 * k, sg * (T + 0.5)], [c(sg * T) - 0.8, sg * (T + 0.5)]], "obsidian")),
    ],
  })),

  // 5) 봄꽃 요정 덩굴궁 — Living leafy green vine bow adorned with blooming pink blossom flowers
  floralfae: bow({ T: 12.0, tip: 4.0, g: 2.4, w0: 2.3, w1: 1.5, rc: 1.8, mat: "vineGreen", str: "gut", fl: "petals" }, (c, T, tip, k) => ({
    sh: [
      R(RISER - 1.3 * k, RISER + 1.3 * k, -2.5, 2.5, "oak"),
      ...[-1, 1].flatMap((sg) => [
        // Sprouting tender green leaves + blooming pink petal flower with gold stamen!
        P([[c(sg * 7.5), sg * 6.5], [c(sg * 7.5) + 3.2 * k, sg * 8.0], [c(sg * 7.5) + 0.5, sg * 9.0]], "vineGreen"),
        C(c(sg * 4.5) + 0.8, sg * 4.5, 2.3 * k, "pink"),
        D(c(sg * 4.5) + 0.8, sg * 4.5, "spark"),
      ]),
    ],
  })),

  // 6) 서리 은가시 수정궁 — Crystalline frost limbs with sharp forward silver thorns & sapphire gems
  frostthorn: bow({ T: 12.0, tip: 3.8, g: 2.8, w0: 2.4, w1: 1.4, rc: 2.8, mat: "frost", str: "core", fl: "cyanDot" }, (c, T, tip, k) => ({
    sh: [
      P([[RISER - 1.4 * k, -3], [RISER + 1.8 * k, -2], [RISER + 1.8 * k, 2], [RISER - 1.4 * k, 3]], "silver"),
      ...[-1, 1].flatMap((sg) => [
        // Swept forward crystalline thorn fins + embedded frost sapphire
        P([[c(sg * 4.5), sg * 3.0], [c(sg * 4.5) + 4.5 * k, sg * 4.2], [c(sg * 6.5), sg * 6.2]], "silver"),
        C(c(sg * 4.8) + 0.5, sg * 4.6, 1.3 * k, "frost"),
        D(c(sg * 4.8) + 0.5, sg * 4.6, "glint"),
      ]),
    ],
  })),

  // 7) 진홍 용익 비늘궁 — Crimson jagged dragon wing limbs + ivory claw talons at grip & tips
  crimsonwyrm: bow({ T: 11.8, tip: 3.8, g: 2.6, w0: 2.5, w1: 1.5, rc: 2.2, mat: "crimson", str: "rubyPt", fl: "ember" }, (c, T, tip, k) => ({
    sh: [
      R(RISER - 1.4 * k, RISER + 1.4 * k, -2.5, 2.5, "obsidian"),
      ...[-1, 1].flatMap((sg) => [
        // Dragon wing serrations + white bone talons at tip
        P([[c(sg * 4.5), sg * 3.5], [c(sg * 4.5) + 4.0 * k, sg * 5.0], [c(sg * 7.2), sg * 7.2]], "crimson"),
        P([[c(sg * 7.5), sg * 6.8], [c(sg * 7.5) + 2.8 * k, sg * 8.2], [c(sg * 9.5), sg * 9.5]], "crimson"),
        P([[c(sg * T) - 0.8, sg * (T - 1.2)], [c(sg * T) + 1.4 * k, sg * (T + 0.8)], [c(sg * T) - 0.8, sg * (T + 0.5)]], "bone"),
      ]),
    ],
  })),

  // 8) 청옥 혈가시 궁 — Deep abyssal teal-jade gnarled limbs studded with crimson thorns + ruby heart
  sapphirethorn: bow({ T: 12.0, tip: 3.8, g: 2.6, w0: 2.5, w1: 1.5, rc: 2.2, mat: "tealThorn", str: "emerald", fl: "crimson" }, (c, T, tip, k) => ({
    sh: [
      P([[RISER - 1.5 * k, -3], [RISER + 2.4 * k, 0], [RISER - 1.5 * k, 3]], "crimson"),
      // Dense razor crimson thorns jutting from outer bow curve (`s > c(t)`)!
      ...[-1, 1].flatMap((sg) =>
        [4.2, 6.8, 9.4].map((tv) =>
          P([[c(sg * tv), sg * (tv - 1.1)], [c(sg * tv) + 3.8 * k, sg * tv], [c(sg * tv), sg * (tv + 1.1)]], "crimson")
        )
      ),
    ],
  })),

  // 9) 황금 쌍룡 패왕궁 — Sculpted twin roaring gold dragon heads bracketing crimson leather riser
  goldendrake: bow({ T: 12.0, tip: 4.0, g: 2.8, w0: 2.5, w1: 1.6, rc: 2.2, mat: "crimson", str: "gold", fl: "gold" }, (c, T, tip, k) => ({
    sh: [
      R(RISER - 1.5 * k, RISER + 1.5 * k, -3.0, 3.0, "crimson"),
      ...[-1, 1].flatMap((sg) => [
        // Sculpted golden dragon head facing forward-outward (`t = ±4`)
        P([
          [c(sg * 3.8) - 1.2, sg * 2.5],
          [c(sg * 3.8) + 4.4 * k, sg * 3.8],
          [c(sg * 4.5) + 2.0 * k, sg * 6.0],
          [c(sg * 5.8) - 1.0, sg * 6.5],
        ], "gold"),
        D(c(sg * 4.2) + 1.8 * k, sg * 4.2, "emerald"),
        // Golden flame plume tips
        P([[c(sg * T) - 1.0, sg * (T - 1.5)], [c(sg * T) + 1.6 * k, sg * (T + 0.5)], [c(sg * T) - 0.8, sg * (T + 0.5)]], "gold"),
      ]),
    ],
  })),

  // 10) 네온 윙 아머 보우 — Sci-fi charcoal riser, twin glowing magenta rings, white/pink mechanical wings
  cyberpink: bow({ T: 11.6, tip: 4.2, g: 3.4, w0: 2.3, w1: 1.6, rc: 2.2, mat: "obsidian", str: "glow", fl: "glow" }, (c, T, tip, k) => ({
    sh: [
      R(RISER - 1.4 * k, RISER + 1.4 * k, -3.5, 3.5, "silver"),
      ...[-1, 1].flatMap((sg) => [
        // Neon pink energy drum hub + silver mecha wing tips
        C(c(sg * 4.5) + 0.5, sg * 4.5, 2.2 * k, "pink"),
        D(c(sg * 4.5) + 0.5, sg * 4.5, "glint"),
        P([[c(sg * 8.0), sg * 7.2], [c(sg * 8.5) + 3.4 * k, sg * 8.8], [c(sg * T) + 1.2 * k, sg * (T + 0.6)], [c(sg * T) - 0.8, sg * (T - 1.2)]], "silver"),
        L(c(sg * 8.8) + 0.8, sg * 8.2, c(sg * T), sg * (T - 0.4), "pink"),
      ]),
    ],
  })),
};

// ───────────────────────────── 4. RASTERISERS (mirror weapons.js bow + post string) ─────────────────────────────

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
    const v = BOW_COLLECTION_M[m] ?? BOW_COLLECTION_EXTRA[m] ?? "#ff00ff";
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
      if (glow && glow.blade.includes(m) && (x < W - 1 ? mat[i + 1] : null) !== m) col = glow.col;
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

export function renderBowWorld(silKey, opts = {}) {
  const fn = BOW_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown bow silhouette: ${silKey}`);
  const d = fn(false, { pull: opts.pull ?? 0, arrow: !!opts.arrow });
  const wq = opts.wq | 0, we = opts.we | 0;
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const inks = we >= 10 ? [RARE_INK[wq] || INK, GLOW10] : [RARE_INK[wq] || INK];
  const [ox, oy] = GRIP;
  const xf = (s, t) => [ox + s, oy + t], inv = (x, y) => [x - ox, y - oy];
  const c = rasterShapes(d.sh, 32, 32, xf, inv, glow);
  outlineCanvas(c, inks);
  if (d.post.length) c.getContext("2d").drawImage(rasterShapes(d.post, 32, 32, xf, inv, null), 0, 0);
  return c;
}

export function renderBowIcon(silKey, opts = {}) {
  const fn = BOW_SILHOUETTES[silKey];
  if (!fn) throw new Error(`Unknown bow silhouette: ${silKey}`);
  const d = fn(true, { pull: 0.4, arrow: true });
  const we = opts.we | 0;
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const pts = [];
  for (const sh of d.sh.concat(d.post)) {
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
  outlineCanvas(c, we >= 10 ? [ICON_INK, GLOW10] : [ICON_INK]);
  if (d.post.length) c.getContext("2d").drawImage(rasterShapes(d.post, 16, 16, xf, inv, null), 0, 0);
  return c;
}
