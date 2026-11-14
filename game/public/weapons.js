/**
 * Weapon art: a distinct look for every tier of every weapon kind, special looks
 * for legendary powers and set pieces, weapon skins (외형) and the glow of a
 * well-enhanced weapon (+7, +10).
 *
 * Every weapon is described ONCE, as flat shapes in weapon space — `s` runs
 * along the weapon from the hand (0) to the tip, `t` across it (negative is the
 * upper, lit edge) — with a material per shape. Two rasterisers turn that into
 * pixels: the world sprite (pointing right, the hand at sprites.js GRIP) and
 * the 16×16 bag icon (the same weapon laid corner to corner). Every pixel gets
 * exactly one palette colour: materials are shaded per output pixel (lit top
 * row, shadowed bottom row, hue-shifted), then the whole is inked with a
 * one-pixel outline in the rarity's colour.
 *
 * A book is the exception: it is drawn open, facing the viewer, around the
 * sheet's centre.
 */

const GRIP = [5, 16];
const INK = "#2b2233";
const RARE_INK = [INK, "#2c4a8c", "#8a6a14", "#9a4a12", "#1f6a3a"];
const ICON_INK = "#111118";

// ───────────────────────────── materials ─────────────────────────────
// [lit, mid, shadow]: shadows lean violet, lights lean warm. A string is a flat colour.
const M = {
  steel: ["#e2e8f0", "#b4bcc9", "#7a7f98"],
  bright: ["#f0f6ff", "#c4d0e0", "#8690b0"],
  rust: ["#c4a894", "#94786a", "#64484c"],
  dull: ["#cfd0d4", "#a4a4ac", "#6e6a80"],
  iron: ["#9a9eaa", "#6c707e", "#464658"],
  dark: ["#6a6e7c", "#454856", "#2c2c3c"],
  carbon: ["#5a5e6c", "#373a46", "#22222e"],
  gun: ["#a6b2c4", "#6e7a90", "#464c66"],
  wood: ["#c48e5c", "#9a6a40", "#6a4434"],
  dwood: ["#8e6444", "#6a4630", "#463040"],
  birch: ["#f4ead2", "#d8c8a4", "#a6927c"],
  bamboo: ["#d0e48a", "#94b44c", "#5e7a3a"],
  leather: ["#9a6a48", "#74482e", "#4e2e2e"],
  black: ["#5a5260", "#3a3440", "#24202c"],
  gold: ["#fff0a0", "#e8bc4c", "#a8742e"],
  bone: ["#fff8e4", "#e6d8ba", "#b0a08e"],
  red: ["#ff8a78", "#e04a3c", "#a0283a"],
  green: ["#a4e07a", "#5aa84a", "#2e6a46"],
  blue: ["#8ab4ff", "#4a6ad0", "#2e3a8a"],
  violet: ["#d8a8ff", "#9a5ae0", "#5a2ea0"],
  void: ["#6a4a9a", "#3c2668", "#221640"],
  crystal: ["#ffd0ff", "#c88af0", "#7e48c0"],
  teal: ["#9af0e0", "#3ab8b0", "#1e6a7a"],
  page: ["#fffaee", "#f2e6cc", "#c8b494"],
  oldpage: ["#f4e6c0", "#dcc89a", "#a89070"],
  holo: ["#e0ffff", "#8ae8f4", "#3aa0c0"],
  // flat accents
  wrap: "#3a2630", gild: "#f0cc60", spot: "#b0603a", fuller: "#8e96ae", glow: "#7af4ff", core: "#e8ffff",
  energy: "#e8a8ff", spark: "#fff4a0", venom: "#8ae84a", ruby: "#ff5a6a", sapph: "#5ab8ff", emer: "#5ae0a0",
  amethyst: "#c87aff", white: "#ffffff", ink: "#3a3044", line: "#b8a890", rune: "#5ab8ff", orange: "#ff9a3a",
};

// ───────────────────────────── shapes ─────────────────────────────
// R rect [s0,s1)×[t0,t1); P polygon; C disc; L a one-pixel line drawn in output
// pixels (survives the icon's shrink); a shape with material null cuts a hole.
const R = (s0, s1, t0, t1, m, o) => ({ k: "p", pts: [[s0, t0], [s1, t0], [s1, t1], [s0, t1]], m, ...o });
const P = (pts, m, o) => ({ k: "p", pts, m, ...o });
const C = (s, t, r, m, o) => ({ k: "c", s, t, r, m, ...o });
const L = (s0, t0, s1, t1, m, o) => ({ k: "l", a: [s0, t0], b: [s1, t1], m, top: true, ...o });
const D = (s, t, m, o) => ({ k: "d", s, t, m, top: true, ...o });

// ───────────────────────────── the designs ─────────────────────────────
// Each returns { sh: shapes, head: the striking part's box [s0,s1,t0,t1] (motifs
// decorate it), blade: the material names that are "the blade" (motifs recolour them) }.

const SWORD = [
  // 1 녹슨 대검 — a rusted, notched slab with a plain iron cross and a leather grip
  () => ({
    sh: [
      R(-4, -2, -1, 2, "iron"), R(-2, 3, -1, 2, "leather"), R(-1, 0, -1, 2, "wrap"), R(1, 2, -1, 2, "wrap"),
      R(3, 5, -3, 4, "iron"),
      P([[5, -2], [18, -2], [20, 0], [20, 1], [18, 3], [5, 3]], "rust"),
      P([[11, -2.2], [13.5, -2.2], [12.3, -0.6]], null), P([[16, 3.2], [17.6, 3.2], [16.8, 2]], null),
      R(8, 10, 1, 2, "spot"), R(14, 16, -1, 0, "spot"),
    ], head: [5, 20, -2, 3], blade: ["rust"],
  }),
  // 2 강철 양손검 — clean steel, a ricasso, a fuller, a long wrapped grip
  () => ({
    sh: [
      P([[-6, 0], [-5, -1], [-3, -1], [-3, 2], [-5, 2], [-6, 1]], "steel"),
      R(-3, 4, -1, 2, "leather"), R(-2, -1, -1, 2, "wrap"), R(0, 1, -1, 2, "wrap"), R(2, 3, -1, 2, "wrap"),
      R(4, 6, -4, 5, "iron"), R(3, 7, -4, -3, "iron"), R(3, 7, 4, 5, "iron"),
      R(6, 8, -1, 2, "steel"),
      P([[8, -2], [22, -2], [25, 0], [25, 1], [22, 3], [8, 3]], "steel"),
      L(9, 0, 21, 0, "fuller"),
    ], head: [8, 25, -2, 3], blade: ["steel"],
  }),
  // 3 기사단 클레이모어 — forward-swept quillons with trefoil ends, gilt fittings, a sapphire
  () => ({
    sh: [
      C(-5, 0.5, 1.7, "gold"), R(-4, 4, -1, 2, "blue"), R(-2, -1, -1, 2, "gild"), R(1, 2, -1, 2, "gild"),
      P([[4, -1], [6, -1], [9, -5], [7, -6]], "gold"), P([[4, 2], [6, 2], [9, 6], [7, 7]], "gold"),
      C(8.5, -6, 1.4, "gold"), C(8.5, 7, 1.4, "gold"),
      R(4, 7, -2, 3, "gold"), R(5, 6, 0, 1, "sapph", { top: true }),
      P([[7, -2], [25, -2], [28, 0], [28, 1], [25, 3], [7, 3]], "bright"),
      L(8, 0, 23, 0, "fuller"), R(7, 9, -2, 3, "gold"),
    ], head: [9, 28, -2, 3], blade: ["bright"],
  }),
  // 4 고주파 대검 — gunmetal, vented, a cyan emitter edge humming along the blade
  () => ({
    sh: [
      R(-6, -2, -2, 3, "carbon"), D(-4, 0, "glow"),
      R(-2, 4, -1, 2, "dark"), D(0, 0, "glow"), D(2, 0, "glow"),
      P([[4, -4], [8, -3], [8, 4], [4, 5]], "carbon"), L(5, -2, 5, 3, "glow"),
      P([[8, -3], [26, -3], [30, 0], [30, 1], [27, 4], [8, 4]], "gun"),
      R(11, 19, 0, 1, null), R(21, 24, 0, 1, null),
      L(8, 3, 27, 3, "glow"), L(9, -3, 25, -3, "core"),
    ], head: [8, 30, -3, 4], blade: ["gun"],
  }),
  // 5 차원 절단기 — a hooked slab of void with a living edge and shards that float free
  () => ({
    sh: [
      R(-6, -3, -1, 2, "void"), D(-5, 0, "energy"),
      R(-3, 5, -1, 2, "black"), D(-1, 0, "energy"), D(2, 0, "energy"),
      P([[5, -2], [7, -6], [9, -6], [8, -1], [8, 2], [9, 7], [7, 7], [5, 3]], "void"),
      P([[8, -4], [24, -5], [31, -2], [33, 1], [29, 2], [31, 5], [8, 5]], "void"),
      L(12, -1, 16, 1, "energy"), L(16, 1, 20, -1, "energy"), L(20, -1, 25, 1, "energy"),
      L(9, 4, 28, 4, "energy"),
      P([[34, -3], [37, -5], [36, -2]], "crystal"), P([[35, 3], [38, 4], [35, 5]], "crystal"),
    ], head: [8, 33, -5, 5], blade: ["void"],
  }),
];

const DAGGER = [
  // 1 낡은 단검 — a dull, short knife on a wrapped grip
  () => ({
    sh: [
      R(-3, -2, -1, 2, "wood"), R(-2, 2, -1, 2, "leather"), R(0, 1, -1, 2, "wrap"),
      R(2, 3, -2, 3, "iron"),
      P([[3, -1], [9, -1], [11, 0], [11, 1], [9, 2], [3, 2]], "dull"),
    ], head: [3, 11, -1, 2], blade: ["dull"],
  }),
  // 2 암살자의 비수 — a long black stiletto with a blood-red tassel
  () => ({
    sh: [
      P([[-5, 1], [-3, 1], [-2, 6], [-5, 6]], "red"),
      R(-3, 2, -1, 2, "black"), D(0, 0, "ruby"),
      R(2, 3, -3, 4, "dark"),
      P([[3, -1], [13, -1], [16, 0], [16, 1], [13, 2], [3, 2]], "steel"),
      L(4, 0, 12, 0, "fuller"),
    ], head: [3, 16, -1, 2], blade: ["steel"],
  }),
  // 3 쌍독니 — two curved fangs from one jaw, beaded with venom
  () => ({
    sh: [
      R(-3, 2, -1, 2, "green"), D(-1, 0, "venom"),
      P([[2, -3], [4, -2], [4, 3], [2, 4]], "dark"),
      P([[4, -3], [8, -4], [11, -4], [12, -3], [9, -2], [4, -1]], "bone"),
      P([[4, 0], [9, 0], [13, 1], [15, 3], [13, 3], [9, 2], [4, 2]], "bone"),
      L(5, 1, 9, 1, "venom"), R(14, 15, 3, 6, "venom"),
    ], head: [4, 15, -4, 3], blade: ["bone"],
  }),
  // 4 카본 나이프 — a matte tanto with a hot orange spine
  () => ({
    sh: [
      R(-4, 3, -1, 2, "dark"), D(-2, 0, "orange"), D(1, 0, "orange"),
      R(3, 4, -2, 3, "carbon"),
      P([[4, -2], [13, -2], [15, -1], [13, 2], [4, 2]], "carbon"),
      L(4, -2, 12, -2, "orange"), L(12, 1, 14, -1, "steel"),
    ], head: [4, 15, -2, 2], blade: ["carbon"],
  }),
  // 5 균열의 송곳니 — a jagged rift crystal, cracked with light, a shard adrift
  () => ({
    sh: [
      R(-4, 2, -1, 2, "void"), D(-1, 0, "energy"),
      P([[2, -3], [4, -2], [4, 3], [2, 4]], "void"),
      P([[4, -2], [7, -3], [10, -1], [14, -3], [18, 0], [18, 1], [12, 2], [8, 3], [4, 2]], "crystal"),
      L(5, 0, 9, 0, "white"), L(9, 0, 12, 1, "white"),
      P([[19, -3], [21, -4], [21, -2]], "crystal"),
    ], head: [4, 18, -3, 3], blade: ["crystal"],
  }),
];

const SPEAR = [
  // 1 대나무 창 — a bamboo pole, its node rings, a fire-hardened point bound with cord
  (icon) => ({
    sh: [
      R(-5, 30, -1, 1, "bamboo"), ...[3, 11, 19].map((s) => R(s, s + 1, -1, 1, "dwood")),
      R(26, 30, -1, 1, "leather"), L(27, -1, 27, 0, "wrap"), L(29, -1, 29, 0, "wrap"),
      P([[30, -2], [33, -1], [38, 0], [38, 1], [33, 2], [30, 2]], "birch"),
    ], head: [30, 38, -2, 2], blade: ["birch"],
  }),
  // 2 강철 장창 — a long ash shaft, a leaf-bladed steel head, a red tassel
  (icon) => ({
    sh: [
      R(-5, 31, 0, icon ? 2 : 1, "wood"), R(-5, -3, -1, 2, "iron"),
      P([[27, 1], [30, 1], [31, 6], [26, 6]], "red"),
      R(29, 31, -1, 2, "iron"),
      P([[31, -1], [34, -2], [39, 0], [39, 1], [34, 3], [31, 2]], "steel"),
      L(32, 0, 37, 0, "fuller"),
    ], head: [31, 39, -2, 3], blade: ["steel"],
  }),
  // 3 기사단 할버드 — an axe, a spike and a back hook on a gilt collar
  (icon) => ({
    sh: [
      R(-5, 33, 0, icon ? 2 : 1, "dwood"), R(-5, -3, -1, 2, "gold"), R(12, 14, -1, 2, "gold"),
      R(30, 33, -1, 2, "gold"),
      P([[31, 1], [36, 1], [38, 6], [36, 8], [32, 7], [30, 4]], "bright"),
      P([[33, -1], [35, -1], [35, -4], [33, -2]], "bright"),
      P([[33, -1], [43, 0], [43, 1], [33, 2]], "bright"),
      L(33, 6, 36, 7, "fuller"),
    ], head: [30, 43, -4, 8], blade: ["bright"],
  }),
  // 4 플라즈마 랜스 — a vamplate and a cone of metal with a plasma core
  (icon) => ({
    sh: [
      R(-5, 26, -1, 1, "gun"), R(-1, 0, -1, 1, "glow"), R(2, 3, -1, 1, "glow"),
      P([[23, -4], [27, -3], [27, 4], [23, 5]], "carbon"), L(24, -2, 24, 3, "glow"),
      P([[27, -3], [42, 0], [42, 1], [27, 4]], "gun"),
      L(28, 0, 39, 0, "glow"), L(28, 1, 37, 1, "core"),
    ], head: [27, 42, -3, 4], blade: ["gun"],
  }),
  // 5 차원 관통창 — a void trident whose prongs curl in, its point a crystal of the rift
  (icon) => ({
    sh: [
      R(-5, 30, 0, icon ? 2 : 1, "void"), D(4, 0, "energy"), D(14, 0, "energy"),
      R(28, 31, -1, 2, "black"),
      P([[30, -1], [33, -5], [38, -6], [34, -3], [32, 0]], "void"),
      P([[30, 2], [33, 6], [38, 7], [34, 4], [32, 1]], "void"),
      P([[31, -1], [45, 0], [45, 1], [31, 2]], "crystal"),
      L(32, 0, 42, 0, "white"),
      C(41, -5, 1.2, "crystal"), C(41, 6, 1.2, "crystal"),
    ], head: [30, 45, -6, 7], blade: ["crystal"],
  }),
];

const STAFF = [
  // 1 견습 지팡이 — a plain crooked stick with a pebble of green glass
  (icon) => ({
    sh: [
      R(-4, 17, 0, icon ? 2 : 1, "wood"), R(-4, -2, -1, 2, "dwood"),
      R(16, 19, -1, 2, "wood"), P([[18, -1], [20, -4], [21, -3], [20, -1]], "wood"),
      C(20.5, 0.5, 1.6, "green"), D(20, 0, "white"),
    ], head: [16, 22, -4, 2], blade: ["green"],
  }),
  // 2 룬 지팡이 — carved runes up the shaft, a blue gem in a wooden claw
  (icon) => ({
    sh: [
      R(-4, 18, 0, icon ? 2 : 1, "dwood"), ...[2, 7, 12].map((s) => D(s, 0, "rune")),
      P([[17, -1], [20, -4], [22, -4], [19, 0]], "dwood"), P([[17, 2], [20, 5], [22, 5], [19, 1]], "dwood"),
      C(21.5, 0.5, 2.3, "blue"), D(21, -1, "white"),
    ], head: [17, 24, -4, 5], blade: ["blue"],
  }),
  // 3 현자의 지팡이 — pale wood, a gilt crescent cradling a great sapphire, a ribbon
  (icon) => ({
    sh: [
      R(-4, 17, 0, icon ? 2 : 1, "birch"), R(-4, -2, -1, 2, "gold"), R(8, 9, -1, 2, "gold"),
      P([[14, 1], [17, 1], [17, 7], [15, 6]], "red"),
      P([[16, -2], [18, -5], [22, -6], [26, -5], [23, -4], [19, -3], [18, 0], [19, 4], [23, 5], [26, 6], [22, 7], [18, 6], [16, 3]], "gold"),
      C(22, 0.5, 2.8, "blue"), D(21, -1, "white"), D(22, -1, "white"),
    ], head: [16, 26, -6, 7], blade: ["blue"],
  }),
  // 4 플라즈마 로드 — a metal rod in coils, a caged plasma orb
  (icon) => ({
    sh: [
      R(-4, 18, 0, icon ? 2 : 1, "gun"), R(-4, -2, -1, 2, "carbon"),
      R(12, 13, -2, 3, "carbon"), R(14, 15, -2, 3, "carbon"), R(16, 17, -2, 3, "carbon"),
      L(18, -3, 18, 4, "gun"), L(18, -3, 25, -3, "gun"), L(18, 4, 25, 4, "gun"),
      C(22, 0.5, 2.6, "holo"), R(21, 23, 0, 1, "core", { top: true }),
    ], head: [17, 26, -3, 4], blade: ["holo"],
  }),
  // 5 공허의 홀 — a sceptre: a thorned crown around a black-violet orb, fragments circling
  (icon) => ({
    sh: [
      R(-4, 17, 0, icon ? 2 : 1, "black"), R(-4, -2, -1, 2, "void"), D(6, 0, "energy"),
      P([[16, -1], [18, -5], [19, -2], [21, -6], [22, -2], [24, -5], [24, 6], [22, 3], [21, 7], [19, 3], [18, 6], [16, 2]], "void"),
      C(21.5, 0.5, 2.6, "violet"), D(21, -1, "energy"),
      P([[26, -4], [28, -5], [27, -3]], "crystal"), P([[27, 4], [29, 5], [27, 6]], "crystal"), R(26, 27, 0, 1, "crystal"),
    ], head: [16, 29, -6, 7], blade: ["violet"],
  }),
];

// books are drawn front-on around the sheet's centre (s → x, t → y)
const BOOK = [
  // 1 낡은 주문서 — a worn leather cover, yellowed pages, a torn corner, a ribbon
  () => ({
    sh: [
      R(-8, 8, -3, 6, "leather"),
      R(-7, -1, -4, 5, "oldpage"), R(1, 7, -4, 5, "oldpage"), R(-1, 1, -4, 6, "dwood"),
      P([[5, -4.2], [7.2, -4.2], [7.2, -2]], null),
      L(-6, -2, -3, -2, "line"), L(-6, 0, -2, 0, "line"), L(-6, 2, -3, 2, "line"), L(2, -1, 5, -1, "line"), L(2, 1, 4, 1, "line"),
      R(0, 1, 6, 9, "red"),
    ], head: [-8, 8, -3, 6], blade: ["leather"],
  }),
  // 2 룬 마도서 — a blue cover, a rune glowing on the open page
  () => ({
    sh: [
      R(-8, 8, -3, 6, "blue"), R(-8, -6, -3, -1, "iron"), R(6, 8, -3, -1, "iron"),
      R(-7, -1, -4, 5, "page"), R(1, 7, -4, 5, "page"), R(-1, 1, -4, 6, "dark"),
      L(-6, -2, -3, -2, "line"), L(-6, 0, -2, 0, "line"), L(-6, 2, -3, 2, "line"),
      L(3, -3, 3, 3, "rune"), L(3, -3, 5, -1, "rune"), L(3, 0, 5, 2, "rune"),
    ], head: [-8, 8, -3, 6], blade: ["blue"],
  }),
  // 3 현자의 법전 — violet with gilt corners and a clasp, a golden sigil
  () => ({
    sh: [
      R(-9, 9, -3, 7, "violet"), R(-9, -7, 5, 7, "gold"), R(7, 9, 5, 7, "gold"), R(-9, -7, -3, -1, "gold"), R(7, 9, -3, -1, "gold"),
      R(-7, -1, -4, 5, "page"), R(1, 7, -4, 5, "page"), R(-1, 1, -4, 7, "gold"),
      L(-6, -2, -3, -2, "line"), L(-6, 0, -2, 0, "line"), L(-6, 2, -3, 2, "line"),
      C(4, 0.5, 2.2, "gild"), C(4, 0.5, 1.1, "page"), D(4, 0, "ruby"),
      R(-1, 1, 7, 9, "gold"),
    ], head: [-9, 9, -3, 7], blade: ["violet"],
  }),
  // 4 홀로그램 코덱스 — a slate of teal metal whose pages are light, a panel hovering over it
  () => ({
    sh: [
      R(-8, 8, -2, 6, "carbon"), L(-8, 5, 7, 5, "glow"),
      R(-7, -1, -3, 4, "holo"), R(1, 7, -3, 4, "holo"), R(-1, 1, -3, 6, "gun"),
      L(-6, -1, -2, -1, "core"), L(-6, 1, -3, 1, "core"), L(2, -1, 6, -1, "core"), L(2, 1, 5, 1, "core"),
      R(-4, 4, -9, -6, "holo"), L(-3, -8, 2, -8, "core"),
    ], head: [-8, 8, -2, 6], blade: ["carbon"],
  }),
  // 5 공허의 서 — black-violet, an eye of the void open on its pages, shards drifting up
  () => ({
    sh: [
      R(-9, 9, -3, 7, "void"), P([[-9, -3], [-11, -5], [-8, -3]], "void"), P([[9, -3], [11, -5], [8, -3]], "void"),
      R(-7, -1, -4, 5, "black"), R(1, 7, -4, 5, "black"), R(-1, 1, -4, 7, "violet"),
      C(-4, 0.5, 2, "energy"), R(-5, -3, 0, 1, "ink", { top: true }), C(4, 0.5, 2, "energy"), R(3, 5, 0, 1, "ink", { top: true }),
      P([[-3, -8], [-2, -10], [-1, -8]], "crystal"), P([[2, -9], [3, -11], [4, -9]], "crystal"),
    ], head: [-9, 9, -3, 7], blade: ["void"],
  }),
];

export const DESIGNS = { sword: SWORD, dagger: DAGGER, spear: SPEAR, staff: STAFF, book: BOOK };
/** Extra designs other modules can register (new weapon kinds): kind → [tier1…tier5] design functions. */
export function registerKind(kind, designs) { DESIGNS[kind] = designs; }

// ───────────────────────────── motifs ─────────────────────────────
// A motif recolours a design's blade and adds a few shapes over its striking part.
// Legendary powers, set pieces and weapon skins are all motifs.

const along = (h, n, f) => { const out = []; for (let i = 0; i < n; i++) out.push(...[].concat(f(h[0] + ((h[1] - h[0]) * (i + 0.5)) / n, i))); return out; };
const MOTIF = {
  // legendary powers
  chain: { name: "뇌명", blade: ["#e6f0ff", "#9ab4e8", "#5a6aa8"], add: (h) => along(h, 1, () => { const m = (h[2] + h[3]) / 2 - 0.5, n = 4, w = (h[1] - h[0]) / n, out = []; for (let i = 0; i < n; i++) out.push(L(h[0] + i * w, m + (i % 2 ? 1 : -1), h[0] + (i + 1) * w, m + (i % 2 ? -1 : 1), "spark")); return out; }) },
  nova: { name: "폭렬", blade: ["#ffe08a", "#f0743a", "#9a3a3a"], add: (h) => [L(h[0] + 2, h[2] + 1, (h[0] + h[1]) / 2, (h[2] + h[3]) / 2, "ink"), L((h[0] + h[1]) / 2, (h[2] + h[3]) / 2, h[1] - 3, h[2] + 1, "ink"), D((h[0] + h[1]) / 2, (h[2] + h[3]) / 2 - 0.5, "spark")] },
  greed: { name: "황금손", blade: M.gold, fit: M.gold, add: (h) => [D(h[0] + 1, (h[2] + h[3]) / 2 - 0.5, "ruby")] },
  haste: { name: "질주", blade: ["#e8fff8", "#8ae0c8", "#3a8a8a"], add: (h) => [P([[h[0], h[3] - 0.5], [h[0] + 3, h[3] - 0.5], [h[0] - 2, h[3] + 3]], "teal"), P([[h[0] + 3, h[3] - 0.5], [h[0] + 6, h[3] - 0.5], [h[0] + 1, h[3] + 2.5]], "teal")] },
  thorn: { name: "가시", blade: ["#b8d0a0", "#6a8a5a", "#3a4a46"], add: (h) => along(h, 4, (s) => P([[s - 1, h[2] + 0.5], [s + 1, h[2] + 0.5], [s + 0.5, h[2] - 2]], "green")) },
  feast: { name: "포식자", blade: ["#ffb0a0", "#d0485a", "#7a2040"], add: (h) => along(h, 4, (s) => P([[s - 1, h[3] + 0.1], [s + 1, h[3] + 0.1], [s, h[3] - 1.2]], null)) },
  echo: { name: "메아리", blade: ["#f0d8ff", "#b48ae8", "#6a4aa8"], add: (h) => along(h, 3, (s) => D(s, (h[2] + h[3]) / 2 - 0.5, "white")) },
  giant: { name: "거인 사냥꾼", blade: M.bone, add: (h) => along(h, 2, (s) => L(s, h[2], s, h[3] - 1, "ink")) },
  // set pieces
  rift: { name: "균열 추적자", blade: M.void, add: (h) => [L(h[0] + 1, (h[2] + h[3]) / 2 - 0.5, h[1] - 2, (h[2] + h[3]) / 2 - 0.5, "energy"), D(h[1] + 2, h[2] - 1, "energy")] },
  pioneer: { name: "개척자", blade: M.steel, fit: M.leather, add: () => [] },
  runner: { name: "네온 러너", blade: M.carbon, add: (h) => [L(h[0], h[3] - 1, h[1] - 1, h[3] - 1, "glow")] },
  // weapon skins
  sakura: { name: "벚꽃", blade: ["#fff0f6", "#f4b4cc", "#c06a90"], fit: ["#8a5a4a", "#6a3e36", "#4a2a2e"], add: (h) => along(h, 3, (s, i) => C(s, i % 2 ? h[3] : h[2], 1.2, "petal", { top: true })) },
  frost: { name: "서리", blade: ["#f4fcff", "#b8e4f8", "#6aa0d0"], add: (h) => along(h, 3, (s) => P([[s - 1, h[2] + 0.5], [s + 1, h[2] + 0.5], [s, h[2] - 2]], "ice")) },
  candy: { name: "사탕", blade: ["#fff8fa", "#ffe0ea", "#e0a0b8"], add: (h) => along(h, 4, (s) => L(s, h[2], s + 2, h[3] - 1, "candy")) },
  bone: { name: "해골", blade: M.bone, fit: M.black, add: (h) => [D(h[0] + 2, (h[2] + h[3]) / 2 - 0.5, "ink"), D(h[0] + 4, (h[2] + h[3]) / 2 - 0.5, "ink")] },
  star: { name: "별빛", blade: ["#8a9af0", "#3a4aa0", "#1e2460"], add: (h) => along(h, 3, (s, i) => D(s, h[2] + 1 + (i % 2), "spark")) },
  flame: { name: "화염", blade: ["#fff0a0", "#ffa040", "#c8402a"], add: (h) => along(h, 3, (s) => P([[s - 1.5, h[2] + 0.5], [s + 1, h[2] + 0.5], [s + 1.5, h[2] - 2.5]], "orange")) },
};
const EXTRA = { petal: "#ff9ac0", ice: "#e8fbff", candy: "#e8485a" };
export const MOTIFS = Object.keys(MOTIF);
export const motifName = (k) => (MOTIF[k] ? MOTIF[k].name : "");

// ───────────────────────────── rasterising ─────────────────────────────

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function inPoly(pts, s, t) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [si, ti] = pts[i], [sj, tj] = pts[j];
    if ((ti > t) !== (tj > t) && s < ((sj - si) * (t - ti)) / (tj - ti) + si) c = !c;
  }
  return c;
}

/**
 * Paint shapes onto a W×H pixel grid. `xf` maps (s,t) → [x,y] and `inv` back;
 * returns the canvas (not yet outlined).
 */
function raster(shapes, mats, W, H, xf, inv, glow) {
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
  const colOf = (m, part) => { const v = mats[m] ?? M[m] ?? EXTRA[m] ?? "#ff00ff"; return typeof v === "string" ? v : v[part]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let col = null;
    if (top[i]) col = colOf(top[i], 1);
    else if (mat[i]) {
      const m = mat[i], up = y > 0 ? mat[i - W] : null, dn = y < H - 1 ? mat[i + W] : null;
      const lit = up !== m, dark = dn !== m;
      col = colOf(m, lit && !dark ? 0 : dark && !lit ? 2 : lit ? 0 : 1);
      // a +7 weapon's lit edge burns
      if (glow && lit && glow.blade.includes(m)) col = glow.col;
    }
    if (!col) continue;
    const [r, gg, b] = hexRgb(col);
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
/** A one-pixel outline in `ink` round everything solid, `passes` times (each in its own colour). */
function outline(c, inks) {
  const g = c.getContext("2d"), W = c.width, H = c.height;
  for (const ink of inks) {
    const src = g.getImageData(0, 0, W, H).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
    g.fillStyle = ink;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
  }
  return c;
}

/** The design for a kind and tier, with a motif (legendary, set or skin) applied. */
function build(kind, tier, motif, icon) {
  const list = DESIGNS[kind] || DESIGNS.sword;
  const d = list[Math.max(0, Math.min(list.length - 1, tier - 1))](icon);
  const mats = {};
  let sh = d.sh.slice();
  const mo = MOTIF[motif];
  if (mo) {
    for (const b of d.blade) mats[b] = mo.blade;
    if (mo.fit) for (const f of ["iron", "gold", "dark", "carbon", "black", "dwood", "leather"]) if (!d.blade.includes(f)) mats[f] = mo.fit;
    sh = sh.concat(mo.add(d.head));
  }
  return { sh, mats, head: d.head, blade: d.blade };
}
const GLOW7 = "#fff2a8", GLOW10 = "#ffd84a";

const cache = new Map();
/**
 * The world sprite. `gear`: wt tier · wq rarity · we enhancement · wl legendary/set
 * key · ws weapon-skin motif. Pointing right with the hand at GRIP (a book: centred).
 */
export function weaponSprite(kind, gear = {}) {
  const wt = Math.max(1, Math.min(5, gear.wt | 0 || 1)), wq = Math.max(0, Math.min(4, gear.wq | 0)), we = gear.we | 0;
  const motif = MOTIF[gear.ws] ? gear.ws : MOTIF[gear.wl] ? gear.wl : "";
  const key = `${kind}:${wt}:${wq}:${we >= 10 ? 10 : we >= 7 ? 7 : 0}:${motif}`;
  let c = cache.get(key);
  if (c) return c;
  const d = build(kind, wt, motif, false);
  const book = kind === "book";
  const W = kind === "spear" ? 52 : kind === "sword" ? 44 : 32, H = 32;
  const ox = book ? 16 : GRIP[0], oy = 16;
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  c = raster(d.sh, d.mats, W, H, (s, t) => [ox + s, oy + t], (x, y) => [x - ox, y - oy], glow);
  outline(c, we >= 10 ? [RARE_INK[wq] || INK, GLOW10] : [RARE_INK[wq] || INK]);
  cache.set(key, c);
  return c;
}

/** The 16×16 bag icon: the same weapon laid corner to corner (a book upright), fitted to the square. */
export function weaponIcon(kind, tier, o = {}) {
  const motif = MOTIF[o.ws] ? o.ws : MOTIF[o.wl] ? o.wl : "", we = o.we | 0;
  const key = `i:${kind}:${tier}:${motif}:${we >= 10 ? 10 : we >= 7 ? 7 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  const d = build(kind, tier, motif, true);
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  // the extent of every shape, to fit the square with a pixel to spare for the outline
  const pts = [];
  for (const sh of d.sh) {
    if (sh.m === null) continue;
    if (sh.k === "p") pts.push(...sh.pts);
    else if (sh.k === "c") pts.push([sh.s - sh.r, sh.t - sh.r], [sh.s + sh.r, sh.t + sh.r]);
    else if (sh.k === "l") pts.push(sh.a, [sh.b[0] + 1, sh.b[1] + 1]);
    else pts.push([sh.s, sh.t], [sh.s + 1, sh.t + 1]);
  }
  let xf, inv;
  if (kind === "book") {
    const s0 = Math.min(...pts.map((p) => p[0])), s1 = Math.max(...pts.map((p) => p[0])), t0 = Math.min(...pts.map((p) => p[1])), t1 = Math.max(...pts.map((p) => p[1]));
    const k = Math.min(1, 13 / (s1 - s0), 13 / (t1 - t0));
    const cx = (s0 + s1) / 2, cy = (t0 + t1) / 2;
    xf = (s, t) => [8 + (s - cx) * k, 8 + (t - cy) * k]; inv = (x, y) => [cx + (x - 8) / k, cy + (y - 8) / k];
  } else {
    // s runs up and to the right, t down and to the right: x = u(s + t), y = u(t − s)
    const xs = pts.map(([s, t]) => s + t), ys = pts.map(([s, t]) => t - s);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const u = Math.min(0.9, 13 / (x1 - x0), 13 / (y1 - y0));
    const ox = 8 - (u * (x0 + x1)) / 2, oy = 8 - (u * (y0 + y1)) / 2;
    xf = (s, t) => [ox + u * (s + t), oy + u * (t - s)];
    inv = (x, y) => { const a = (x - ox) / u, b = (y - oy) / u; return [(a - b) / 2, (a + b) / 2]; };
  }
  c = raster(d.sh, d.mats, 16, 16, xf, inv, glow);
  outline(c, we >= 10 ? [ICON_INK, GLOW10] : [ICON_INK]);
  cache.set(key, c);
  return c;
}
const urls = new Map();
/** A data URL for an item entry's icon when it looks different from its base item (legendary, set, +7, skin), else null. */
export function entryIconUrl(entry, it) {
  if (!entry || !it || it.type !== "weapon") return null;
  const wl = entry.lg || entry.set || "", we = entry.enh | 0;
  if (!wl && we < 7) return null;
  const key = `${it.wk}:${it.tier}:${wl}:${we >= 10 ? 10 : 7 * (we >= 7)}`;
  if (!urls.has(key)) urls.set(key, weaponIcon(it.wk, it.tier, { wl, we }).toDataURL());
  return urls.get(key);
}
