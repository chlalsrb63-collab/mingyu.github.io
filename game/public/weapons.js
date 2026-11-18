/**
 * Weapon art: a distinct look for every tier of every weapon kind, special looks
 * for legendary powers, weapon skins (외형) and the glow of a
 * well-enhanced weapon (+7, +10).
 *
 * Every weapon is described ONCE, as flat shapes in weapon space — `s` runs
 * along the weapon from the hand (0) to the tip, `t` across it (negative is the
 * upper, lit edge) — with a material per shape. Two rasterisers turn that into
 * pixels: the world sprite (pointing right, the hand at sprites.js GRIP) and
 * the 32×32 bag icon (the same weapon laid corner to corner). Every pixel gets
 * exactly one palette colour: materials are shaded per output pixel (lit top
 * row, shadowed bottom row, hue-shifted), then the whole is inked with a
 * one-pixel outline in the rarity's colour.
 *
 * A closed book faces the viewer from the sheet's centre. A bow is held square
 * to the shot: its limbs run across the sprite and its string and arrow along
 * it. `bowSprite` draws each pull of the string from `swing.js`'s `bowPose`.
 *
 * An approved external image (asset/ → scripts/import-art.mjs --install → public/assets/
 * manifest.json) replaces a look when it is listed: "weapon.<kind>.t<tier>",
 * ".lg.<power>", ".skin.<motif>", and "icon.weapon.<kind>.…" for the bag
 * icon. The rarity outline and the +7/+10 glow are still applied on top. Unlisted looks
 * (the default: the manifest is empty) are drawn in code as below.
 */

import * as Assets from "./assetlib.js";
import { EQUIP_ICON_SIZE, fitEquipmentIcon, weaponIconProjection } from "./gear_icons.js";
import { porcelainWeaponSprite, porcelainWeaponIcon, PORCELAIN_MOTIF } from "./weapons_porcelain.js";

const GRIP = [5, 16];
const INK = "#2b2233";
const RARE_INK = [INK, "#2c4a8c", "#8a6a14", "#9a4a12", INK, "#826845"];
const ICON_INK = "#111118";

// ───────────────────────────── materials ─────────────────────────────
// [lit, mid, shadow]: shadows lean violet, lights lean warm. A string is a flat colour.
const M = {
  steel: ["#e2e8f0", "#b4bcc9", "#7a7f98"],
  bright: ["#f0f6ff", "#c4d0e0", "#8690b0"],
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
  oxblood: ["#ae717b", "#804958", "#512e43"],
  ash: ["#e3bb82", "#ba8353", "#7c4e3e"],
  brass: ["#f1d596", "#be944f", "#795142"],
  black: ["#5a5260", "#3a3440", "#24202c"],
  gold: ["#fff0a0", "#e8bc4c", "#a8742e"],
  bone: ["#fff8e4", "#e6d8ba", "#b0a08e"],
  red: ["#ff8a78", "#e04a3c", "#a0283a"],
  green: ["#a4e07a", "#5aa84a", "#2e6a46"],
  blue: ["#8ab4ff", "#4a6ad0", "#2e3a8a"],
  violet: ["#d8a8ff", "#9a5ae0", "#5a2ea0"],
  void: ["#6a4a9a", "#3c2668", "#221640"],
  crystal: ["#ffd0ff", "#c88af0", "#7e48c0"],
  riftglass: ["#ddd9ff", "#8780d8", "#4d438e"],
  teal: ["#9af0e0", "#3ab8b0", "#1e6a7a"],
  page: ["#fffaee", "#f2e6cc", "#c8b494"],
  oldpage: ["#f4e6c0", "#dcc89a", "#a89070"],
  holo: ["#e0ffff", "#8ae8f4", "#3aa0c0"],
  // tier 6 운철 (meteor iron): night-blue metal, starlight-gold fittings, star flecks
  meteor: ["#b8c6f0", "#5a6aa8", "#2c3260"], starfire: ["#fff8d8", "#ffd27a", "#c8844a"],
  // flat accents
  wrap: "#3a2630", gild: "#f0cc60", fuller: "#8e96ae", glow: "#7af4ff", core: "#e8ffff",
  energy: "#e8a8ff", spark: "#fff4a0", venom: "#8ae84a", ruby: "#ff5a6a", sapph: "#5ab8ff", emer: "#5ae0a0",
  amethyst: "#c87aff", white: "#ffffff", ink: "#3a3044", line: "#b8a890", rune: "#5ab8ff", orange: "#ff9a3a",
  // bows: a gut string, an arrow's shaft, a longbow's pale belly, a compound's cable
  gut: "#f2e6c8", shaft: "#e8cc94", belly: "#d8a86c", cable: "#4a4c5e",
  star: "#fff6c8",
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
  // 1 철제 대검 — a straight bevel and a wine-red wrapped grip
  () => ({
    sh: [
      P([[-4, -1], [-2, -2], [-1, -1], [-1, 2], [-2, 3], [-4, 2]], "steel"),
      R(-2, 4, -1, 2, "oxblood"), R(0, 1, -1, 2, "wrap"), R(2, 3, -1, 2, "wrap"),
      P([[3, -4], [5, -3], [6, 0.5], [5, 4], [3, 5]], "iron"),
      P([[5, -2], [18, -2], [23.5, 0.5], [18, 3], [5, 3]], "steel"),
      P([[6, -2], [18, -2], [22.5, 0.5], [6, 0.5]], "bright"),
    ], head: [5, 23.5, -2, 3], blade: ["steel", "bright"],
  }),
  // 2 강철 양손검 — clean steel, a ricasso, a fuller, a long wrapped grip
  () => ({
    sh: [
      P([[-6, 0], [-5, -1], [-3, -1], [-3, 2], [-5, 2], [-6, 1]], "steel"),
      R(-3, 4, -1, 2, "leather"), R(-2, -1, -1, 2, "wrap"), R(0, 1, -1, 2, "wrap"), R(2, 3, -1, 2, "wrap"),
      P([[3, -3.5], [5, -3], [7, 0.5], [5, 4], [3, 4.5], [4, 0.5]], "iron"),
      R(6, 9, -1.5, 2.5, "steel"),
      P([[8, -2], [19, -2], [25.5, 0.5], [19, 3], [8, 3]], "steel"),
      L(9, 0, 20, 0, "fuller"),
    ], head: [8, 25, -2, 3], blade: ["steel"],
  }),
  // 3 기사단 클레이모어 — gilt swept quillons and a sapphire
  () => ({
    sh: [
      C(-5, 0.5, 1.7, "gold"), R(-4, 4, -1, 2, "blue"), R(-2, -1, -1, 2, "gild"), R(1, 2, -1, 2, "gild"),
      P([[4, 0.5], [7, -3.8], [9, -4.8], [7, -0.5], [7, 1.5], [9, 5.8], [7, 4.8]], "gold"),
      P([[7, -2.5], [20, -2], [28.5, 0.5], [20, 3], [7, 3.5]], "bright"),
      L(9, 0, 23, 0, "fuller"), D(5, 0, "sapph"),
    ], head: [9, 28, -2, 3], blade: ["bright"],
  }),
  // 4 고주파 대검 — gunmetal, vented, a cyan emitter edge humming along the blade
  () => ({
    sh: [
      R(-6, -2, -2, 3, "carbon"), D(-4, 0, "glow"),
      R(-2, 4, -1, 2, "dark"), D(0, 0, "glow"), D(2, 0, "glow"),
      P([[4, -3.5], [8, -2], [8, 3], [4, 4.5]], "carbon"), L(5, -2, 5, 2, "glow"),
      P([[7, -2.5], [24, -2.5], [30.5, 0.5], [25, 3.5], [7, 3.5]], "gun"),
      L(11, 0, 18, 0, "ink"), L(21, 0, 24, 0, "ink"),
      L(8, 2, 26, 2, "glow"), L(9, -2, 24, -2, "core"),
    ], head: [7, 30.5, -2.5, 3.5], blade: ["gun"],
  }),
  // 5 차원 절단기 — a swept void blade with a bright fissure
  () => ({
    sh: [
      R(-6, -3, -1, 2, "void"), D(-5, 0, "energy"),
      R(-3, 5, -1, 2, "black"), D(-1, 0, "energy"), D(2, 0, "energy"),
      P([[4, -1], [7, -4], [9, -4], [7, 0], [7, 1], [9, 5], [7, 5], [4, 2]], "violet"),
      P([[7, -2], [25, -3], [37, -4.5], [32, 0], [24, 3.5], [7, 3]], "void"),
      P([[9, 1], [24, 1], [34, -2.5], [31, 0], [24, 3], [9, 3]], "crystal"),
      L(11, -1, 22, -1, "energy"), L(22, -1, 29, -2, "energy"),
    ], head: [7, 37, -4.5, 3.5], blade: ["void", "crystal"],
  }),
  // 6 운철 참마도 — a night-blue blade with a starlight edge and a gold sun guard
  () => ({
    sh: [
      R(-6, -3, -1, 2, "meteor"), C(-6, 0.5, 1.4, "starfire"),
      R(-3, 5, -1, 2, "black"), R(-1, 0, -1, 2, "gild"), R(2, 3, -1, 2, "gild"),
      P([[5, -3.5], [7, -3.5], [9, 0.5], [7, 4.5], [5, 4.5]], "starfire"), D(6, 0, "star"),
      P([[8, -2], [26, -3], [33.5, -1.5], [29, 2.5], [8, 3.5]], "meteor"),
      L(9, 2, 28, 1, "star"), D(14, 0, "star"), D(24, -1, "white"),
    ], head: [8, 33.5, -3, 3.5], blade: ["meteor"],
  }),
];

const DAGGER = [
  // 1 철제 단검 — a compact leaf blade above a short leather grip
  () => ({
    sh: [
      R(-4, -2, -1.5, 2.5, "steel"), R(-2, 2, -1, 2, "leather"), L(-1, 0, 1, 0, "wrap"),
      R(2, 3.5, -2.5, 3.5, "iron"),
      P([[3, -1.6], [6, -2.3], [9, -1.6], [13.5, 0.5], [9, 2.6], [6, 3.3], [3, 2.6]], "steel"),
      P([[4, -1.8], [6, -2.3], [9, -1.6], [13, 0.4], [4, 0.4]], "bright"),
    ], head: [3, 13.5, -2.3, 3.3], blade: ["steel", "bright"],
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
  // 6 운철 비수 — a straight meteor-iron dirk, a gilt cross, a line of starlight down the blade
  () => ({
    sh: [
      R(-4, 2, -1, 2, "black"), D(-2, 0, "star"), D(0, 0, "star"),
      P([[2, -3], [4, -3], [4, 4], [2, 4]], "starfire"),
      P([[4, -2], [16, -2], [20, 0], [20, 1], [16, 3], [4, 3]], "meteor"),
      L(5, 0, 17, 0, "star"), D(8, -1, "white"), D(13, 2, "white"),
    ], head: [4, 20, -2, 3], blade: ["meteor"],
  }),
];

const SPEAR = [
  // 1 철제 창 — a straight ash shaft, a ferrule and a polished spear point
  (icon) => ({
    sh: [
      R(-4, 29, -1, icon ? 1.7 : 1, "ash"), R(-4, -2, -1.4, 1.8, "iron"),
      R(-1, 4, -1.3, 1.7, "leather"), R(25, 29, -1.2, 1.8, "iron"),
      P([[28, -1], [31, -2.5], [40.5, 0.5], [31, 3.5], [28, 2]], "steel"),
      P([[28, 0.5], [31, -2.5], [39, 0.5]], "bright"),
    ], head: [28, 40.5, -2.5, 3.5], blade: ["steel", "bright"],
  }),
  // 2 강철 장창 — a long ash shaft, a leaf-bladed steel head, a red tassel
  (icon) => ({
    sh: [
      R(-5, 31, 0, icon ? 2 : 1, "wood"), R(-5, -3, -1, 2, "iron"),
      P([[28, 1], [31, 1], [28, 4], [25, 4]], "red"),
      R(29, 31, -1, 2, "iron"),
      P([[30.5, -0.5], [33.5, -2.5], [40, 0.5], [33.5, 3.5], [30.5, 1.5]], "steel"),
      L(32, 0, 37, 0, "fuller"),
    ], head: [30.5, 40, -2.5, 3.5], blade: ["steel"],
  }),
  // 3 기사단 할버드 — an axe, a spike and a back hook on a gilt collar
  (icon) => ({
    sh: [
      R(-5, 33, 0, icon ? 2 : 1, "dwood"), R(-5, -3, -1, 2, "gold"), R(12, 14, -1, 2, "gold"),
      R(30, 33, -1, 2, "gold"),
      P([[31, 1], [35, 1], [40, 6], [36, 7], [34, 6], [32, 3]], "bright"),
      P([[32, 0], [34, -3], [37, -4], [35, 0]], "steel"),
      P([[32, -1], [36, -1.5], [43.5, 0.5], [36, 2.5], [32, 2]], "bright"),
      L(34, 3, 38, 6, "fuller"),
    ], head: [31, 43.5, -4, 7], blade: ["bright", "steel"],
  }),
  // 4 플라즈마 랜스 — a vamplate and a cone of metal with a plasma core
  (icon) => ({
    sh: [
      R(-5, 26, -1, 1, "gun"), R(-1, 0, -1, 1, "glow"), R(2, 3, -1, 1, "glow"),
      P([[23, -2.5], [27, -1.5], [27, 2.5], [23, 3.5]], "carbon"), L(24, -1, 24, 2, "glow"),
      P([[26, -2.5], [32, -2], [42.5, 0.5], [32, 3], [26, 3.5]], "gun"),
      L(27, 0, 39, 0, "glow"), L(28, 1, 35, 1, "core"),
    ], head: [26, 42.5, -2.5, 3.5], blade: ["gun"],
  }),
  // 5 차원 관통창 — sweeping void tines and a crystal point
  (icon) => ({
    sh: [
      R(-5, 30, 0, icon ? 2 : 1, "void"), D(4, 0, "energy"), D(14, 0, "energy"),
      R(28, 31, -1, 2, "black"),
      P([[30, -1], [34, -4], [41, -5], [36, -2], [33, 0]], "violet"),
      P([[30, 2], [34, 5], [41, 6], [36, 3], [33, 1]], "violet"),
      P([[30.5, -0.5], [34, -2], [45.5, 0.5], [34, 3], [30.5, 1.5]], "crystal"),
      L(32, 0, 42, 0, "energy"),
    ], head: [30, 45.5, -5, 6], blade: ["crystal"],
  }),
  // 6 운철 천공창 — a meteor-iron shaft studded with stars, gold crescent wings, a long night-blue point
  (icon) => ({
    sh: [
      R(-5, 30, 0, icon ? 2 : 1, "meteor"), D(4, 0, "star"), D(14, 0, "star"), D(24, 0, "star"),
      R(28, 31, -1.5, 2.5, "starfire"),
      P([[30, -0.5], [33, -4], [37, -4.5], [34, -1]], "starfire"),
      P([[30, 1.5], [33, 5], [37, 5.5], [34, 2]], "starfire"),
      P([[31, -2], [36, -2], [46, 0.5], [36, 3], [31, 3]], "meteor"),
      L(32, 0, 43, 0, "star"),
    ], head: [30, 46, -4.5, 5.5], blade: ["meteor"],
  }),
];

const STAFF = [
  // 1 푸른 수정 지팡이 — a faceted blue crystal seated in a simple brass ferrule
  (icon) => ({
    sh: [
      R(-4, 18, -1, icon ? 2 : 1.4, "ash"), R(-4, -2, -1.4, 1.8, "brass"),
      R(-1, 3, -1.4, 1.8, "leather"),
      P([[16, -1], [19, -3.5], [21, -2.5], [21, 3.5], [19, 4.5], [16, 2]], "brass"),
      P([[18, 0.5], [20, -3.2], [24, -2.1], [26, 0.5], [24, 3.3], [20, 4.2]], "blue"),
      P([[20, -3.2], [24, -2.1], [26, 0.5], [21, 0.5], [19, 0.1]], "sapph"),
      D(22, -1.4, "core"),
    ], head: [18, 26, -3.2, 4.2], blade: ["blue", "sapph"],
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
  // 6 성운의 홀 — a meteor-iron ring around a small golden star, three stars in orbit
  (icon) => ({
    sh: [
      R(-4, 17, 0, icon ? 2 : 1, "meteor"), R(-4, -2, -1, 2, "starfire"), D(6, 0, "star"),
      R(16, 18, -1, 2, "starfire"),
      C(21.5, 0.5, 4.2, "meteor"), C(21.5, 0.5, 3, null), C(21.5, 0.5, 1.8, "starfire"), D(21, 0, "white"),
      D(26, -4, "star"), D(17, -4, "star"), D(26, 5, "star"),
    ], head: [16, 26, -4, 5], blade: ["starfire"],
  }),
];

// Closed books share a left binding, a narrow page block and a single front cover.
const closedBook = (cover, spine, pages, details) => () => ({
  sh: [
    P([[-5, -4.5], [4.5, -4.5], [6, -3], [6, 6], [4.5, 7], [-4.5, 7], [-5, 6]], spine),
    P([[-4, 3.5], [5.5, 3.5], [5.5, 5.5], [4.5, 6], [-4, 6]], pages),
    P([[-5, -5.5], [4, -5.5], [5, -4.5], [5, 4], [4, 5], [-5, 5]], cover),
    P([[-5.5, -4.5], [-4, -5.5], [-3.5, -5.5], [-3.5, 6.5], [-5, 6], [-5.5, 5]], spine),
    ...details,
  ],
  head: [-3.5, 4.5, -4.5, 4.5],
  blade: [cover],
});

const BOOK = [
  // 1 입문 마도서 — wine-red leather with a small brass clasp
  closedBook("oxblood", "dwood", "page", [
    L(-2, -3, 2, -3, "brass"), L(-2, 2, 1, 2, "brass"),
    R(3, 5.5, -0.5, 1.5, "brass"),
  ]),
  // 2 룬 마도서 — steel fittings and a cyan rune on the blue cover
  closedBook("blue", "dark", "page", [
    R(3, 4.5, -5, -3.5, "iron"), R(3, 4.5, 3, 4.5, "iron"),
    L(-1, -3, -1, 2, "rune"), L(-1, -3, 2, -1, "rune"), L(-1, -1, 2, 1, "rune"),
  ]),
  // 3 현자의 법전 — gilt corners and a ruby seal
  closedBook("violet", "void", "oldpage", [
    R(3, 5, -5, -3.5, "gold"), R(3, 5, 3, 4.5, "gold"),
    P([[0.5, -3], [3, -0.5], [0.5, 2], [-2, -0.5]], "gold"), D(0, -1, "ruby"),
  ]),
  // 4 홀로그램 코덱스 — a dark housing with a cyan inlay and illuminated page edges
  closedBook("carbon", "gun", "holo", [
    L(-2, -4, 3, -4, "glow"), L(3, -4, 3, 2, "glow"), L(-2, 2, 3, 2, "glow"),
    L(-1, -2, 1, -2, "core"), D(0, 0, "core"),
  ]),
  // 5 공허의 서 — a single violet eye set into the cover
  closedBook("void", "black", "oldpage", [
    P([[-3, 0], [-1, -2], [2, -2], [4, 0], [2, 2], [-1, 2]], "violet"),
    C(0.5, 0, 1.4, "energy"), D(0, 0, "ink"),
  ]),
  // 6 성운의 서 — night-blue leather with a small constellation and starlight fittings
  closedBook("meteor", "black", "page", [
    R(3, 5, -5, -3.5, "starfire"), R(3, 5, 3, 4.5, "starfire"),
    L(-2, 2, 0, -1, "rune"), L(0, -1, 2, -2, "rune"), D(-2, 2, "star"), D(0, -1, "star"), D(2, -2, "white"),
  ]),
];

// ── bows. The limbs run ACROSS the weapon (t) and the arrow along it (s), so the sprite turned to
// the aim holds the bow square to the shot. The pivot at GRIP is the drawing hand at full draw
// (the cheek); the riser — the bow hand — sits RISER px ahead of it. Every design takes the pull
// `o.pull` (−0.25 the string snapped past rest · 0 at rest · 1 at full draw: the nock comes back
// to NOCK_FULL and the limbs bend, their tips coming back and in) and `o.arrow` (an arrow on the
// string). The string is drawn after the outline (`post`), one bare pixel wide.
const RISER = 7, NOCK_FULL = -3.5, ARROW_LEN = 14;
/**
 * A bow's limbs, string and nocked arrow. `b`: T half-height · tip s at rest · g grip half-length ·
 * w0/w1 limb thickness at grip/tip · rc recurve (the tips flick forward) · gap (limbs floating free
 * of the riser) · mat limb material · str string material · fl fletching material.
 * Returns { sh, post, c(t) → the limb's centre s at t, T, tipS } at this pull.
 */
function bowParts(b, o, icon) {
  const p = Math.max(-0.25, Math.min(1, o.pull || 0)), dr = Math.max(0, p), k = icon ? 1.3 : 1;
  const T = b.T - 1.2 * dr, tipS = b.tip - 1.4 * dr + 1.2 * Math.max(0, -p), g = b.g, r = RISER;
  const span = Math.max(1, T - g);
  const c = (t) => { const u = Math.max(0, Math.min(1, (Math.abs(t) - g) / span)); return r - (r - tipS) * u * u + (b.rc || 0) * Math.max(0, (u - 0.68) / 0.32) ** 2; };
  const sh = [], post = [];
  for (const sg of [-1, 1]) {
    const L0 = [], L1 = [], n = 10, u0 = b.gap ? b.gap / span : 0;
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((1 - u0) * i) / n, t = sg * (g + span * u), w = (b.w0 + (b.w1 - b.w0) * u) * k;
      L0.push([c(t) - w / 2, t]); L1.unshift([c(t) + w / 2, t]);
    }
    sh.push(P(L0.concat(L1), b.mat));
  }
  // the string: tip to nock to tip (a straight line at rest); bowed forward a hair just after the release
  const nock = p >= 0 ? tipS + p * (NOCK_FULL - tipS) : tipS - p * 6;
  const ts = c(T) - 0.4, tt = T - 0.6;
  if (Math.abs(nock - ts) < 0.3) post.push(L(ts, -tt, ts, tt, b.str));
  else post.push(L(ts, -tt, nock, 0, b.str), L(nock, 0, ts, tt, b.str));
  if (o.arrow) {
    // the arrow on the rest: a pale shaft over the riser, a steel head, fletching at the nock
    const a = nock, h = a + ARROW_LEN;
    sh.push(
      L(a + 1, 0, h - 1, 0, "shaft"),
      P([[a + 0.6, -1.4], [a + 3.6, -0.4], [a + 3.6, 0.2], [a + 0.6, 0.2]], b.fl || "red"),
      P([[a + 0.6, 0.8], [a + 3.6, 0.8], [a + 3.6, 1.4], [a + 0.6, 2.4]], b.fl || "red"),
      P([[h - 1.2, -1.3], [h + 2.6, 0.5], [h - 1.2, 2.3]], "steel"),
    );
  }
  return { sh, post, c, T, tipS };
}
/** A bow design: its parts at the pull, plus its own riser and trim (`extra(c, T, tipS, k)`), boxed for motifs along the limb. */
const bow = (b, extra) => (icon, o = {}) => {
  const pt = bowParts(b, o, icon), k = icon ? 1.15 : 1;
  const ex = extra(pt.c, pt.T, pt.tipS, k);
  // the arrow (after the two limbs in pt.sh) goes over the riser
  const arrow = o.arrow ? pt.sh.splice(2) : [];
  return {
    sh: [...pt.sh, ...ex.sh, ...arrow], post: [...pt.post, ...(ex.post || [])],
    head: [-pt.T + 1, pt.T - 1, -(b.w0 * k) / 2 - 0.3, (b.w0 * k) / 2 + 0.3], limb: pt.c,
    blade: [b.mat], edgeX: true,
  };
};
const BOW = [
  // 1 물푸레나무 활 — smooth laminated limbs, pale nocks and a fitted leather grip
  bow({ T: 10.2, tip: 3.4, g: 2.4, w0: 3, w1: 1.6, mat: "ash", str: "gut" }, (c, T, tip, k) => ({
    sh: [
      R(RISER - 1.6 * k, RISER + 1.6 * k, -2.4, 2.4, "leather"),
      ...[-1, 1].flatMap((sign) => [
        L(c(3.4) - 0.65, sign * 3.4, c(T - 2.2) - 0.45, sign * (T - 2.2), "belly"),
        C(c(T), sign * T, 0.95 * k, "birch"),
      ]),
    ],
  })),
  // 2 사냥꾼의 장궁 — a tall yew longbow: pale belly, dark back, a leather grip, horn nocks
  bow({ T: 13, tip: 4.4, g: 2.5, w0: 2.6, w1: 1.4, mat: "dwood", str: "gut" }, (c, T, tip, k) => ({
    sh: [
      ...[-1, 1].map((sg) => L(c(sg * 4) - 0.9, sg * 4, c(sg * (T - 2)) - 0.6, sg * (T - 2), "belly")),
      R(RISER - 1.5 * k, RISER + 1.5 * k, -3, 3, "leather"), L(RISER - 1, -2, RISER + 1, -2, "wrap"), L(RISER - 1, 2, RISER + 1, 2, "wrap"),
      C(c(T) + 0.2, -T + 0.3, 0.9 * k, "bone"), C(c(T) + 0.2, T - 0.3, 0.9 * k, "bone"),
    ],
  })),
  // 3 기사단 전투활 — a knight's recurve: dark limbs flicking forward at steel-capped tips, a gilt riser, a sapphire
  bow({ T: 11, tip: 4, g: 3.5, w0: 2.4, w1: 1.6, rc: 2.2, mat: "dwood", str: "gut" }, (c, T, tip, k) => ({
    sh: [
      P([[RISER - 1.6 * k, -4.5], [RISER + 1.2 * k, -4], [RISER + 2 * k, 0], [RISER + 1.2 * k, 4], [RISER - 1.6 * k, 4.5]], "gold"),
      D(RISER, -3, "blue"), D(RISER, 2, "blue"), D(RISER + 0.5, 0, "sapph"),
      ...[-1, 1].map((sg) => P([[c(sg * (T - 2.4)) - 1.3 * k, sg * (T - 2.4)], [c(sg * (T - 2.4)) + 1.3 * k, sg * (T - 2.4)], [c(sg * T) + 1.1 * k, sg * (T + 0.6)], [c(sg * T) - 0.9 * k, sg * (T + 0.6)]], "steel")),
    ],
  })),
  // 4 카본 컴파운드 보우 — a gunmetal compound: a cut-out carbon riser, short stiff limbs, cams at the tips, a cyan string
  bow({ T: 10, tip: 4.6, g: 5, w0: 2.4, w1: 2, mat: "gun", str: "glow" }, (c, T, tip, k) => ({
    sh: [
      P([[RISER - 1.4 * k, -6], [RISER + 1.6 * k, -5], [RISER + 2.2 * k, 0], [RISER + 1.6 * k, 5], [RISER - 1.4 * k, 6], [RISER - 0.6 * k, 0]], "carbon"),
      R(RISER - 0.2, RISER + 1.2, -3.6, -1.6, null), R(RISER - 0.2, RISER + 1.2, 1.6, 3.6, null),
      L(RISER + 1, -1, RISER + 1, 1, "glow"),
      ...[-1, 1].flatMap((sg) => [C(c(sg * T), sg * T, 1.7 * k, "iron"), D(c(sg * T) - 0.5, sg * T - 0.5, "glow")]),
    ],
    post: [L(c(T) + 0.6, -T + 1.2, RISER - 2.4, 0, "cable"), L(RISER - 2.4, 0, c(T) + 0.6, T - 1.2, "cable")],
  })),
  // 5 균열의 시위 — a rift bow: limbs of void that float free of a black riser, crystal shards past the tips, a violet string
  bow({ T: 12, tip: 3.6, g: 3, w0: 2.6, w1: 1.4, rc: 1.2, gap: 1.2, mat: "void", str: "energy", fl: "violet" }, (c, T, tip, k) => ({
    sh: [
      P([[RISER - 1.4 * k, -3.2], [RISER + 1.4 * k, -3.6], [RISER + 2.2 * k, 0], [RISER + 1.4 * k, 3.6], [RISER - 1.4 * k, 3.2]], "black"),
      D(RISER, 0, "energy"), D(c(7), -7, "energy"), D(c(7), 7, "energy"),
      ...[-1, 1].map((sg) => P([[c(sg * T) - 0.6, sg * (T + 1.6)], [c(sg * T) + 1.6, sg * (T + 1.2)], [c(sg * T) + 0.4, sg * (T + 3.4)]], "crystal")),
    ],
  })),
  // 6 유성 장궁 — a meteor-iron recurve, a gold riser with a white star, gold suns at the tips, a starlight string
  bow({ T: 12, tip: 3.4, g: 3.5, w0: 2.6, w1: 1.6, rc: 1.4, mat: "meteor", str: "star", fl: "starfire" }, (c, T, tip, k) => ({
    sh: [
      P([[RISER - 1.4 * k, -4], [RISER + 1.6 * k, -4], [RISER + 2.2 * k, 0], [RISER + 1.6 * k, 4], [RISER - 1.4 * k, 4]], "starfire"),
      D(RISER, 0, "white"), D(c(6), -6, "star"), D(c(6), 6, "star"),
      ...[-1, 1].map((sg) => C(c(sg * T), sg * T, 1.3 * k, "starfire")),
    ],
  })),
];

// Slim wrapped hafts leave room for a broad striking face.
function hammerHead(head, blade, shapes, handle = "dwood", fittings = "iron") {
  return () => ({
    sh: [
      R(-3, 12, -1, 1.5, handle), R(-3.2, -2, -1.5, 2, fittings),
      R(-1, 5, -1.5, 2, "leather"), R(0, 1, -1.5, 2, "wrap"), R(3, 4, -1.5, 2, "wrap"),
      R(8, 11, -2, 2.5, fittings), ...shapes,
    ],
    head, blade,
  });
}

const HAMMER = [
  // 1 철제 양손해머 — bevelled steel block on an ash handle
  hammerHead([10, 20, -6, 7], ["steel", "bright"], [
    P([[10, -4], [12, -6], [18, -6], [20, -4], [20, 5], [18, 7], [12, 7], [10, 5]], "steel"),
    P([[10, -4], [12, -6], [18, -6], [20, -4], [17, -3], [12, -3]], "bright"),
    P([[11, 4], [18, 4], [20, 5], [18, 7], [12, 7], [10, 5]], "iron"),
  ], "ash"),
  // 2 Double-ended steel sledge with a single waist and matching striking faces.
  hammerHead([10.5, 20, -7, 8], ["steel"], [
    P([[11, -6], [12, -7], [19, -7], [20, -6], [18, -2], [18, 3], [20, 7],
      [19, 8], [12, 8], [11, 7], [12.5, 3], [12.5, -2]], "steel"),
    R(12, 19, -6.5, -5, "bright"), R(12, 19, 6, 7.5, "bright"),
    R(12, 18, -1, 2, "iron"),
  ], "wood"),
  // 3 A narrow bronze ram with a red inspection seal.
  hammerHead([11, 21, -7, 8], ["gold"], [
    P([[11, -5], [13, -7], [19, -7], [21, -5], [21, 6], [19, 8], [13, 8], [11, 6]], "gold"),
    R(12, 14, -5, 6, "iron"), R(18.5, 20, -4, 5, "brass"),
    C(16.5, 0.5, 1.5, "brass"), D(16, 0, "ruby"),
  ], "dwood", "gold"),
  // 4 A cyan coil recessed between gunmetal faces.
  hammerHead([10, 22, -7, 8], ["gun"], [
    P([[10, -4], [13, -7], [20, -7], [22, -5], [21, -2], [21, 3], [22, 6],
      [20, 8], [13, 8], [10, 5]], "gun"),
    R(12, 20, -2.5, 3.5, "carbon"), R(13, 19, -1, 2, "teal"),
    L(13, 0, 18, 0, "glow"), R(14, 20, -5.5, -4, "steel"),
  ], "carbon", "gun"),
  // 5 Two facets meet at a dark void socket.
  hammerHead([10.5, 23, -8.5, 9.5], ["crystal", "void"], [
    P([[10.5, -3], [14, -8.5], [20, -8.5], [23, -5], [21, 0.5], [23, 6],
      [20, 9.5], [14, 9.5], [10.5, 4]], "crystal"),
    P([[10.5, -3], [15, -4], [21, 0.5], [15, 5], [10.5, 4]], "void"),
    L(15, -7, 19, -7, "energy"), L(15, 8, 19, 8, "energy"), D(16, 0, "core"),
  ], "black", "void"),
  // 6 운철 대망치 — forged meteor iron with a starlight seam
  hammerHead([10, 23, -8, 9], ["meteor"], [
    P([[10, -4], [14, -8], [20, -8], [23, -5], [23, 6], [20, 9], [14, 9], [10, 5]], "meteor"),
    P([[12, -5.5], [14, -7.5], [14, 8.5], [12, 6]], "starfire"),
    P([[17, -5], [20, -6], [22, -4], [22, 4], [20, 6], [17, 5]], "black"),
    L(19, -4, 19, 4, "star"), D(19, -4, "white"),
  ], "black", "starfire"),
];

export const DESIGNS = { sword: SWORD, dagger: DAGGER, spear: SPEAR, staff: STAFF, book: BOOK, bow: BOW, hammer: HAMMER };

// Legendary silhouettes share each weapon's grip position and canvas.
export const SIL = {
  hammer: {
    twin: hammerHead([10, 22, -8, 8], ["steel"], [
      P([[10, -6], [12, -8], [20, -8], [22, -6], [18, -2], [18, 2], [22, 6], [20, 8],
        [12, 8], [10, 6], [13, 2], [13, -2]], "steel"),
      R(12, 18, -2, 2, "dark"), R(12, 20, -7.5, -6, "bright"), R(12, 20, 6, 7.5, "bright"), D(16, 0, "sapph"),
    ], "black", "gold"),
    furnace: hammerHead([10, 22, -7, 7], ["iron"], [
      P([[10, -4], [13, -7], [19, -7], [22, -4], [22, 4], [19, 7], [13, 7], [10, 4]], "iron"),
      P([[12, -2.5], [15, -5], [19, -3.5], [21, 0], [19, 3.5], [15, 5], [12, 2.5]], "dark"),
      C(16, 0, 2.2, "orange"), D(15, -1, "spark"), L(13, -6, 18, -6, "gold"),
    ], "dwood", "gold"),
    bell: hammerHead([11, 23, -9, 10], ["gold"], [
      P([[11, -3], [14, -5], [20, -8], [22, -8], [22, 9], [20, 9], [14, 6], [11, 4]], "gold"),
      P([[20, -9], [22, -9], [23, -8], [23, 9], [22, 10], [20, 10]], "iron"),
      R(12, 14, -4, 5, "brass"), D(16, 0, "ruby"),
    ], "wood", "gold"),
    tusk: hammerHead([10, 23, -9, 9], ["bone"], [
      P([[10, -3], [13, -6], [20, -9], [19, -4], [21, -2], [23, 1], [21, 5],
        [15, 9], [12, 7], [12, 4], [10, 3]], "bone"),
      P([[11, -2], [16, -3], [20, 0], [16, 3], [11, 3]], "black"), L(14, -1, 18, 0, "ruby"),
    ], "dwood", "black"),
    // The impact end is a slab split into two glass faces. A forged heel takes the strain below it.
    riftglass: hammerHead([10, 22, -9, 10], ["riftglass"], [
      P([[10, -4], [14, -8], [20, -8], [23, -5], [22, 4], [17, 9], [12, 9], [10, 6]], "gun"),
      P([[11, -4], [14, -7], [20, -7], [22, -5], [20, -2], [12, -1]], "riftglass"),
      P([[12, 1], [20, 0], [21, 3], [17, 7], [13, 5]], "riftglass"),
      L(14, -6, 19, -6, "holo"), L(12, 7, 16, 8, "gild"),
    ], "black", "gun"),
  },
  bow: {
    recurve: bow({ T: 11.5, tip: 1.5, g: 2.3, w0: 3.2, w1: 2.1, rc: 3.1, mat: "steel", str: "gut" }, (c, t) => ({
      sh: [R(5, 9, -3, 3, "leather"), ...[-1, 1].map((sg) => C(c(t - 1), sg * (t - 1), 1.2, "gold"))],
    })),
    horn: bow({ T: 12.4, tip: 1.6, g: 3, w0: 4.2, w1: 1.8, mat: "bone", str: "gut" }, (c, t) => ({
      sh: [P([[5, -4], [9, -3], [11, 0], [9, 3], [5, 4]], "dwood"),
        ...[-1, 1].map((sg) => P([[c(t) - 1, sg * (t - 2)], [c(t) + 2.8, sg * (t - 0.4)], [c(t), sg * (t + 0.6)]], "bone"))],
    })),
    fork: bow({ T: 11.4, tip: 2.2, g: 3.9, w0: 3.3, w1: 2, rc: 2.4, mat: "bright", str: "core" }, (c, t) => ({
      sh: [R(5, 8.8, -4, 4, "black"), ...[-1, 1].map((sg) =>
        P([[c(t - 4) - 1, sg * (t - 4)], [9, sg * (t - 4)], [10, sg * (t - 1)], [6, sg * t], [c(t - 3), sg * (t - 3)]], "bright"))],
    })),
    wave: bow({ T: 11.7, tip: 2.7, g: 3, w0: 3, w1: 2.2, rc: 2.5, gap: 1.2, mat: "void", str: "energy", fl: "violet" }, (c, t) => ({
      sh: [P([[4.5, -3.9], [8, -5], [10, -2], [10, 2], [8, 5], [4.5, 3.9]], "black"),
        ...[-1, 1].map((sg) => P([[c(t - 4) - 1.2, sg * (t - 3.4)], [c(t - 4) + 1, sg * (t - 4.8)],
          [c(t - 4) + 5, sg * (t - 2.1)], [c(t - 4) + 1.7, sg * (t - 1)]], "void"))],
    })),
    // Short overlapping splints hug the flexing limbs, with bright nocks and a metal grip.
    riftglass: bow({ T: 12.3, tip: 2.2, g: 2.7, w0: 3, w1: 2.2, rc: 1.3, mat: "riftglass", str: "holo", fl: "violet" }, (c, T, tip, k) => ({
      sh: [
        P([[5, -3.8], [8.5, -4.5], [10, -2], [10, 2], [8.5, 4.5], [5, 3.8]], "gun"),
        R(5.7, 8.5, -1.5, 1.5, "black"),
        ...[-1, 1].flatMap((sg) => {
          const a = 4.4, b = T - 1.8, n = T - 0.7;
          return [
            P([[c(a) + 0.2, sg * a], [c(a) + 3 * k, sg * (a + 0.8)], [c(b) + 2.3 * k, sg * (b - 0.5)],
              [c(b) + 0.2, sg * b], [c(b) - 0.7, sg * (b - 1.7)]], "gun"),
            P([[c(b) - 0.6, sg * (b - 0.8)], [c(b) + 1.8 * k, sg * b], [c(n) + 1.5 * k, sg * n],
              [c(T) + 0.25, sg * (T + 0.7)], [c(T) - 1.1, sg * T]], "holo"),
          ];
        }),
      ],
    })),
  },
  sword: {
    sabre: () => ({
      sh: [
        R(-3, 7, -1.5, 1.5, "leather"), R(-4, -2, -2.5, 2.5, "iron"),
        P([[4, -5], [8, -4], [9, 1], [4, 5], [2, 4], [6, 0]], "gold"),
        P([[7, -2], [22, -2], [34, -6], [31, 0], [22, 3.5], [7, 3]], "steel"),
      ],
      head: [8, 29, -2, 3], blade: ["steel"],
    }),
    flamberge: () => ({
      sh: [
        R(-4, 8, -1.5, 1.5, "leather"), R(-4, -2, -2.5, 2.5, "gold"), R(5, 9, -5, 5, "gold"),
        P([[8, -2], [13, -2], [18, -4], [23, -3], [27, -2.5], [34, 0],
          [27, 3], [23, 3.5], [18, 2], [13, 3], [8, 3]], "bright"),
      ],
      head: [9, 31, -2, 2], blade: ["bright"],
    }),
    cleaver: () => ({
      sh: [
        R(-4, 8, -2, 2, "leather"), R(-4, -2, -3, 3, "iron"),
        P([[6, -5], [10, -5], [10, 6], [7, 6], [5, 3]], "iron"),
        P([[9, -2.5], [17, -4.5], [32, -4.5], [34, -2], [31, 4.5], [16, 4.5], [9, 3]], "steel"),
      ],
      head: [12, 32, -4, 5], blade: ["steel"],
    }),
    rapier: () => ({
      sh: [
        R(-4, 7, -1.5, 1.5, "leather"), R(-4, -1, -2.5, 2.5, "gold"), R(5, 9, -4, 4, "gold"),
        P([[0, 1], [2, 5], [5, 6], [8, 4], [8, 1], [10, 1], [10, 5], [6, 8], [2, 7], [-2, 2]], "gold"),
        P([[8, -1.5], [27, -1.5], [34, -0.5], [30, 1.5], [8, 1.5]], "bright"),
      ],
      head: [10, 30, -1, 1], blade: ["bright"],
    }),
    serrated: () => ({
      sh: [
        R(-4, 9, -2, 2, "dwood"), R(-4, -2, -3, 3, "iron"), R(5, 9, -4, 4, "iron"),
        P([[8, -2], [12, -2], [16, -4.5], [17, -2], [21, -2], [25, -4.5], [26, -2],
          [29, -2], [34, -3.5], [31, 2], [26, 3.5], [8, 3.5]], "steel"),
      ],
      head: [9, 31, -2, 4], blade: ["steel"],
    }),
    bone: () => ({
      sh: [
        R(-3, 9, -2, 2, "black"), C(-1, 0, 3, "bone"),
        P([[5, -1], [10, -4], [12, -2], [24, -4], [29, -4], [34, -0.5],
          [29, 3], [24, 2], [13, 3], [10, 4.5], [7, 3]], "bone"),
        R(14, 24, -1, 0, "iron"),
      ],
      head: [12, 31, -3, 3], blade: ["bone"],
    }),
    crystal: () => ({
      sh: [
        R(-4, 9, -1.5, 1.5, "black"), R(-4, -2, -3, 3, "gun"),
        P([[5, -2], [10, -1.5], [14, -3.5], [19, -3], [24, -5], [34, -3], [29, 1], [24, 3], [16, 3.5], [10, 2.5], [6, 3]], "crystal"),
        P([[14, -1], [24, -4], [31, -3], [24, 1], [19, 0], [14, 2]], "violet"),
      ],
      head: [12, 29, -3, 4], blade: ["crystal"],
    }),
    // The glass facet runs from the offset guard to a clipped point.
    riftglass: () => ({
      sh: [
        R(-4, 8, -1.5, 2, "black"), P([[-4, -2], [-1, -3], [0, -1], [0, 2], [-1, 3], [-4, 2]], "gun"),
        P([[4, -3], [7, -4.5], [10, -4], [9, 0], [10, 4], [7, 5.5], [4, 4], [6, 1]], "gun"),
        P([[8, -2.5], [17, -4.5], [26, -4.5], [34, -2.5], [29, 2], [24, 3.5], [8, 3]], "riftglass"),
        P([[12, 0], [18, -3], [26, -3], [32, -2.5], [26, 0], [18, 1.5], [12, 2]], "violet"),
        L(13, 1, 24, 0, "holo"), R(7, 10, -1, 1, "gild"),
      ],
      head: [10, 34, -5, 5], blade: ["riftglass"],
    }),
  },
  dagger: {
    kris: () => ({
      sh: [
        R(-4, 5, -1.5, 1.5, "black"), R(-4, -2, -2.5, 2.5, "gold"), R(3, 6, -4, 4, "gold"),
        P([[5, -2], [8, -2], [11, -5], [13, -4], [16, -1], [13, 1], [11, 0], [8, 4], [5, 3]], "steel"),
      ],
      head: [6, 15, -2, 2], blade: ["steel"],
    }),
    tanto: () => ({
      sh: [
        R(-4, 6, -1.5, 1.5, "leather"), R(-4, -2, -2.5, 2.5, "iron"), R(3, 5, -3, 3, "iron"),
        P([[5, -3], [16, -3], [16, 0], [12, 4], [5, 4]], "steel"),
      ],
      head: [5, 16, -2, 3], blade: ["steel"],
    }),
    parrying: () => ({
      sh: [
        R(-4, 6, -1.5, 1.5, "black"), C(-2, 0, 2, "gold"),
        P([[1, -2], [4, -5], [7, -6], [7, -4], [5, -2], [5, 2], [7, 4], [7, 6], [4, 5], [1, 2]], "gold"),
        P([[5, -2], [10, -2.5], [16, 0], [10, 2.5], [5, 2]], "bright"),
      ],
      head: [6, 15, -2, 2], blade: ["bright"],
    }),
    hook: () => ({
      sh: [
        R(-4, 6, -2, 2, "dwood"), R(-4, -2, -3, 3, "bone"), R(3, 6, -3, 4, "bone"),
        P([[5, -2], [8, -2], [11, -6], [15, -6], [16, -3], [13, -4], [11, 0], [10, 5], [6, 4]], "bone"),
      ],
      head: [6, 14, -4, 3], blade: ["bone"],
    }),
    riftglass: () => ({
      sh: [
        R(-4, 5, -1.5, 2, "black"), R(-4, -2, -2.5, 2.5, "gun"),
        P([[2, -4], [5, -4], [7, 1], [6, 4], [3, 5], [4, 1]], "gun"),
        P([[5, -2], [9, -3], [12, -6], [16, -6], [16, -3], [13, -2], [12, 1], [9, 4], [6, 3]], "riftglass"),
        P([[7, 0], [12, -4], [15, -5], [13, -2], [10, 1]], "holo"), R(5, 7, 1, 3, "gild"),
      ],
      head: [6, 16, -6, 4], blade: ["riftglass"],
    }),
  },
  spear: {
    glaive: () => ({
      sh: [
        R(-3, 34, -1, 1.5, "dwood"), R(-3, -1, -1.5, 2, "iron"), R(24, 29, -1.5, 2, "iron"),
        P([[28, -1], [33, -1.5], [42, -5], [45, -6], [43, -1], [38, 2.5], [32, 3.5], [28, 2]], "steel"),
      ],
      head: [30, 42, -2, 3], blade: ["steel"],
    }),
    trident: () => ({
      sh: [
        R(-3, 34, -1, 1.5, "dwood"), R(-3, -1, -1.5, 2, "gold"), R(25, 29, -1.5, 2, "gold"),
        P([[28, -1.5], [33, -4.5], [42, -5.5], [38, -3.5], [33, -2.5], [33, 3.5],
          [38, 4.5], [42, 6.5], [33, 5.5], [28, 2.5]], "steel"),
        P([[32, -1.5], [37, -1.5], [45, 0.5], [37, 2.5], [32, 2.5]], "steel"),
      ],
      head: [32, 43, -2, 2], blade: ["steel"],
    }),
    partisan: () => ({
      sh: [
        R(-3, 32, -1, 1.5, "dwood"), R(-3, -1, -1.5, 2, "iron"), R(25, 29, -1.5, 2, "gold"),
        P([[28, -1], [30, -2.5], [29, -5], [33, -4], [36, -2.5], [45, 0.5],
          [36, 3.5], [33, 5], [29, 6], [30, 3.5], [28, 2]], "steel"),
      ],
      head: [29, 43, -3, 3], blade: ["steel"],
    }),
    scythe: () => ({
      sh: [
        R(-3, 34, -1, 1.5, "dwood"), R(-3, -1, -1.5, 2, "iron"), R(26, 31, -1.5, 2, "iron"),
        P([[29, 2], [31, -3], [37, -8], [45, -9], [40, -6.5], [36, -2], [34, 3]], "steel"),
      ],
      head: [32, 43, -8, -4], blade: ["steel"],
    }),
    // Forged tines leave open gaps around the long centre spearhead.
    riftglass: () => ({
      sh: [
        R(-3, 33, -1.5, 1.5, "black"), R(-3, 0, -2, 2, "gun"), R(13, 16, -1.5, 1.5, "gun"),
        P([[25, -1.5], [29, -2.5], [38, -6.5], [34, -2.5], [31, 0.5], [34, 3.5], [37, 7],
          [32, 5.5], [29, 3], [25, 2.5]], "gun"),
        P([[30, -0.5], [33, -2.5], [38, -1.5], [45, 0.5], [38, 2.5], [33, 3.5], [30, 1.5]], "riftglass"),
        P([[33, -1], [38, -0.5], [43, 0.5], [38, 1], [33, 1.5]], "holo"), R(27, 29, -1.5, 2.5, "gild"),
      ],
      head: [30, 45, -4, 4], blade: ["riftglass"],
    }),
  },
  staff: {
    crook: () => ({
      sh: [
        R(-3, 16, -1.5, 1.5, "dwood"), R(-3, -1, -2.5, 2.5, "gold"), R(12, 15, -2, 2, "gold"),
        P([[13, -2], [16, -6], [21, -7], [25, -4], [25, 1], [22, 4], [18, 3],
          [18, 0], [21, 1], [22, -1], [20, -3], [17, -1], [16, 2], [13, 2]], "wood"),
      ],
      head: [14, 23, -4, 1], blade: ["wood"],
    }),
    fork: () => ({
      sh: [
        R(-3, 16, -1.5, 1.5, "dwood"), R(-3, -1, -2.5, 2.5, "iron"), R(11, 14, -2.5, 2.5, "leather"),
        P([[13, -2], [17, -5], [21, -9], [25, -8], [23, -4], [20, -4], [18, 0],
          [20, 3], [25, 4], [24, 8], [20, 7], [16, 3], [13, 2]], "wood"),
      ],
      head: [14, 23, -5, 3], blade: ["wood"],
    }),
    cage: () => ({
      sh: [
        R(-3, 16, -1.5, 1.5, "dwood"), R(-3, -1, -2.5, 2.5, "gold"), R(11, 14, -2.5, 2.5, "gold"),
        P([[13, 0], [16, -5], [20, -7], [25, -4], [25, 4], [20, 7], [16, 5]], "gold"),
        P([[16, 0], [19, -4], [23, -2], [23, 2], [19, 4]], null),
        C(20, 0, 2.5, "crystal"),
      ],
      head: [17, 24, -3, 3], blade: ["crystal"],
    }),
    crescent: () => ({
      sh: [
        R(-3, 17, -1.5, 1.5, "dwood"), R(-3, -1, -2.5, 2.5, "gold"), R(11, 15, -2, 2, "gold"),
        P([[13, 0], [15, -5], [19, -8], [25, -7], [22, -4], [19, -4], [18, 0],
          [19, 4], [23, 4], [25, 7], [20, 8], [15, 5]], "crystal"),
      ],
      head: [14, 23, -5, 4], blade: ["crystal"],
    }),
    // The cage rails cradle a separate crystal, leaving air on either side of it.
    riftglass: () => ({
      sh: [
        R(-3, 16, -1.5, 1.5, "black"), R(-3, -1, -2.5, 2.5, "gun"), R(11, 14, -2.5, 2.5, "gild"),
        P([[13, -2], [17, -6], [22, -8], [25, -5], [23, -4], [21, -5], [18, -3], [17, 1],
          [19, 4], [22, 5], [25, 3], [25, 6], [22, 8], [17, 6], [13, 2]], "gun"),
        P([[18, 0], [21, -4], [24, -2], [25, 0], [22, 3], [20, 4]], "riftglass"),
        P([[21, -3], [23, -1], [21, 2], [20, 1]], "holo"),
      ],
      head: [18, 25, -4, 4], blade: ["riftglass"],
    }),
  },
  book: {
    chained: closedBook("black", "dwood", "oldpage", [
      L(-3, -4, 3, 4, "iron"), L(-3, 0, 4, 0, "steel"),
      R(-0.5, 2.5, -1.5, 1.5, "gold"), D(1, 0, "ink"),
    ]),
    skull: closedBook("black", "dark", "oldpage", [
      P([[-2, -3], [2.5, -3], [3.5, -2], [3.5, 1], [2, 2], [2, 3.5], [-1.5, 3.5], [-1.5, 2], [-3, 1], [-3, -2]], "bone"),
      D(-2, -1, "ink"), D(1, -1, "ink"), D(0, 2, "ink"),
    ]),
    grimoire: closedBook("void", "black", "oldpage", [
      P([[-3, -0.5], [0, -4], [3, -2.5], [4, 0.5], [1, 3.5], [-2, 2]], "crystal"),
      L(0, -2.5, 2, -1.5, "energy"),
    ]),
    atlas: closedBook("dwood", "black", "page", [
      L(-3, -4, 3, -4, "brass"), L(-3, 3, 3, 3, "brass"),
      L(-2, 0, 2, 0, "gild"), L(0, -2, 0, 2, "gild"), D(0, 0, "rune"),
    ]),
    riftglass: closedBook("void", "gun", "page", [
      R(3, 5, -5, -3.5, "gun"), R(3, 5, 3, 4.5, "gun"),
      P([[-3, 0], [-1, -3.5], [3, -2.5], [4, 0], [1, 3], [-2, 2]], "riftglass"),
      P([[-1, -2.5], [2, -1.5], [1, 0], [-2, 1]], "holo"),
    ]),
  },
};

export const MOTIF_SIL = {
  hammer: { chain: "twin", nova: "furnace", greed: "bell", haste: "twin", thorn: "tusk", feast: "tusk", echo: "bell", giant: "furnace", shard: "riftglass" },
  bow: { chain: "fork", nova: "horn", greed: "recurve", haste: "recurve", thorn: "fork", feast: "horn", echo: "wave", giant: "wave", shard: "riftglass" },
  sword: { chain: "flamberge", nova: "cleaver", greed: "sabre", haste: "rapier", thorn: "serrated", feast: "bone", echo: "crystal", giant: "cleaver", shard: "riftglass" },
  dagger: { chain: "kris", nova: "tanto", greed: "parrying", haste: "tanto", thorn: "hook", feast: "hook", echo: "kris", giant: "parrying", shard: "riftglass" },
  spear: { chain: "trident", nova: "glaive", greed: "partisan", haste: "glaive", thorn: "trident", feast: "scythe", echo: "partisan", giant: "scythe", shard: "riftglass" },
  staff: { chain: "fork", nova: "cage", greed: "crook", haste: "crook", thorn: "fork", feast: "crescent", echo: "cage", giant: "crescent", shard: "riftglass" },
  book: { chain: "chained", nova: "grimoire", greed: "atlas", haste: "atlas", thorn: "grimoire", feast: "skull", echo: "chained", giant: "skull", shard: "riftglass" },
};

/** The bosses-2 uniques that take another silhouette of their kind (their motif is keyed by item id). */
const UNIQ_SIL = { w_bloodcrown: "trident", w_bloomstaff: "crescent" };

/** One motif rendering of each silhouette for previews and exports. */
export function silhouetteSamples(kind) {
  const mapping = Object.entries(MOTIF_SIL[kind] || {});
  return Object.keys(SIL[kind] || {}).map((name) => [name, mapping.find(([, sil]) => sil === name)[0]]);
}

// ───────────────────────────── motifs ─────────────────────────────
// A motif recolours a design's blade and adds a few shapes over its striking part.
// Legendary powers and weapon skins are motifs.

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
  // weapon skins
  sakura: { name: "벚꽃", blade: ["#fff0f6", "#f4b4cc", "#c06a90"], fit: ["#8a5a4a", "#6a3e36", "#4a2a2e"], add: (h) => along(h, 3, (s, i) => C(s, i % 2 ? h[3] : h[2], 1.2, "petal", { top: true })) },
  frost: { name: "서리", blade: ["#f4fcff", "#b8e4f8", "#6aa0d0"], add: (h) => along(h, 3, (s) => P([[s - 1, h[2] + 0.5], [s + 1, h[2] + 0.5], [s, h[2] - 2]], "ice")) },
  candy: { name: "사탕", blade: ["#fff8fa", "#ffe0ea", "#e0a0b8"], add: (h) => along(h, 4, (s) => L(s, h[2], s + 2, h[3] - 1, "candy")) },
  bone: { name: "해골", blade: M.bone, fit: M.black, add: (h) => [D(h[0] + 2, (h[2] + h[3]) / 2 - 0.5, "ink"), D(h[0] + 4, (h[2] + h[3]) / 2 - 0.5, "ink")] },
  star: { name: "별빛", blade: ["#8a9af0", "#3a4aa0", "#1e2460"], add: (h) => along(h, 3, (s, i) => D(s, h[2] + 1 + (i % 2), "spark")) },
  flame: { name: "화염", blade: ["#fff0a0", "#ffa040", "#c8402a"], add: (h) => along(h, 3, (s) => P([[s - 1.5, h[2] + 0.5], [s + 1, h[2] + 0.5], [s + 1.5, h[2] - 2.5]], "orange")) },
  // Weapon skins of the themed sets. A skin uses the tier design when it has no kind-specific silhouette.
  coral: { name: "산호", blade: ["#fff4ec", "#ffa890", "#d0586a"], fit: ["#9ae8e0", "#3aa8a8", "#1e6a7a"], add: (h) => along(h, 3, (s, i) => C(s, i % 2 ? h[2] : h[3], 1.1, "foam", { top: true })) },
  dune: { name: "모래바람", blade: ["#fff2c4", "#e8b860", "#a8703a"], fit: ["#b48a64", "#8a5a3a", "#5a3a34"], add: (h) => along(h, 3, (s, i) => L(s - 1.5, (h[2] + h[3]) / 2 - 1 + (i % 2), s + 1.5, (h[2] + h[3]) / 2 - (i % 2), "sand")) },
  bamboo: { name: "대나무", blade: M.bamboo, fit: ["#c8a878", "#8a6a4a", "#5a4030"], add: (h) => [...along(h, 3, (s) => L(s, h[2], s, h[3] - 1, "node")), P([[h[1] - 3, h[2] + 0.5], [h[1], h[2] + 0.5], [h[1] - 1, h[2] - 2.5]], "green")] },
  shard: { name: "균열 파편", blade: M.riftglass, fit: M.black, add: () => [] },
  bee: { name: "꿀벌", blade: ["#fff4a8", "#f4c440", "#b8842a"], fit: M.black, add: (h) => along(h, 3, (s) => L(s, h[2], s, h[3] - 1, "bee")) },
  // the bosses-2 raid uniques: keyed by item id (wire `wl` / entryIconUrl pass the id), so each has its own look
  w_bloodcrown: { name: "혈루 왕관", blade: ["#ffd0d0", "#e0384a", "#7a1430"], fit: M.black, add: (h) => [P([[h[1] - 6, h[2] + 0.5], [h[1] - 4.5, h[2] - 2.5], [h[1] - 3, h[2] + 0.5]], "ruby"), P([[h[1] - 3.5, h[2] + 0.5], [h[1] - 2, h[2] - 3.5], [h[1] - 0.5, h[2] + 0.5]], "ruby"), P([[h[1] - 1, h[2] + 0.5], [h[1] + 0.5, h[2] - 2.5], [h[1] + 2, h[2] + 0.5]], "ruby"), D(h[0] + 3, (h[2] + h[3]) / 2 - 0.5, "ruby")] },
  w_cavhammer: { name: "공동 망치", blade: ["#ffc08a", "#f0502a", "#8a2418"], fit: ["#d84a2a", "#9a2a1e", "#5a1a1e"], add: (h) => [L(h[0] + 1, h[2], h[0] + 1, h[3] - 1, "foam"), L(h[1] - 2, h[2], h[1] - 2, h[3] - 1, "foam"), D(h[0] + 3, h[2] - 1, "foam"), D((h[0] + h[1]) / 2, h[3] + 1, "foam"), D(h[1] - 1, h[2] - 1, "foam")] },
  w_ribbook: { name: "흉곽 등불", blade: M.bone, fit: M.black, add: (h) => [...along(h, 3, (s) => L(s, h[2], s, h[3] - 1, "ink")), D((h[0] + h[1]) / 2, (h[2] + h[3]) / 2 - 0.5, "energy"), D((h[0] + h[1]) / 2, h[2] - 1.5, "energy")] },
  w_whalebow: { name: "고래뼈 활", blade: ["#f4fcff", "#a8d0ec", "#5a86b8"], fit: M.bone, add: (h) => along(h, 3, (s) => D(s, h[2] - 0.5, "white")) },
  w_bloomstaff: { name: "혼꽃", blade: ["#e8f4ff", "#a8c4ec", "#5a6aa8"], fit: M.bone, add: (h) => [C(h[1] + 1, (h[2] + h[3]) / 2, 2.2, "petal", { top: true }), C(h[1] + 1, (h[2] + h[3]) / 2, 0.9, "white", { top: true }), D(h[1] + 1, h[2] - 2, "ice"), D(h[1] + 1, h[3] + 1, "ice")] },
  clubclaw: { name: "갯가재 집게", blade: ["#ffc08a", "#ff6a2a", "#a8301e"], fit: ["#d84a2a", "#9a2a1e", "#5a1a1e"], add: (h) => [...along(h, 3, (s, i) => L(s, h[2], s, h[3] - 1, i % 2 ? "orange" : "foam")), P([[h[1] - 2.5, h[2] - 0.5], [h[1] + 0.5, (h[2] + h[3]) / 2], [h[1] - 2.5, h[3] + 0.5]], "orange")] },
};
// 사계절 skins (P11, 장날 stall): each lays shapes along the blade, not just a colour
const mid = (h) => (h[2] + h[3]) / 2;
/** A five-pointed leaf (or star) of radius r round (s, t), its points alternating with notches. */
const leaf = (s, t, r, m) => P(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r * 0.45 : r; return [s + Math.cos(a) * k, t + Math.sin(a) * k]; }), m, { top: true });
Object.assign(MOTIF, {
  // a flowering twig wound along the blade: a dark branch line, three blossoms with gold hearts
  ssnSakura: { name: "벚꽃 가지", blade: ["#fff4f8", "#f8c4d6", "#c87a98"], fit: ["#8a5a4a", "#6a3e36", "#4a2a2e"], add: (h) => [L(h[0], mid(h) + 0.5, h[1] - 1, mid(h) - 0.5, "twig"), ...along(h, 3, (s, i) => [C(s, i % 2 ? h[3] - 0.5 : h[2] + 0.5, 1.5, "bloom", { top: true }), D(s - 0.5, (i % 2 ? h[3] - 0.5 : h[2] + 0.5) - 0.5, "spark")])] },
  // white crests breaking along the upper edge, spray dots under them
  ssnSea: { name: "파도", blade: ["#e8fcff", "#7ac8e8", "#2e78b8"], fit: ["#9ae8e0", "#3aa8a8", "#1e6a7a"], add: (h) => along(h, 3, (s) => [P([[s - 2, h[2] + 1], [s - 0.5, h[2] - 1.5], [s + 1.5, h[2] - 1], [s + 0.5, h[2] + 0.5], [s + 1, h[2] + 1.5]], "foam"), D(s - 1, mid(h), "white")]) },
  // three maple leaves fallen on the blade, red and gold in turn
  ssnMaple: { name: "단풍", blade: ["#ffe0a0", "#f0903a", "#b8402a"], fit: M.wood, add: (h) => along(h, 3, (s, i) => leaf(s, mid(h) - 0.5, 2, i % 2 ? "gold2" : "maple")) },
  // icy blade with six-armed snowflakes: three crossing one-pixel lines each
  ssnSnow: { name: "눈꽃", blade: ["#e8f6ff", "#8ab8e8", "#4a6ab0"], fit: M.bright, add: (h) => along(h, 2, (s) => { const t = mid(h) - 0.5; return [L(s - 2, t, s + 2, t, "white"), L(s - 1, t - 1.7, s + 1, t + 1.7, "white"), L(s - 1, t + 1.7, s + 1, t - 1.7, "white")]; }) },
});
// wskin +5 (P11; 단풍 is ssnMaple above): wraps along the blade and charms hung under its edge
Object.assign(MOTIF, {
  // a willow withe wound along the blade, narrow leaves drooping from it
  willowTwig: { name: "버들 가지", blade: ["#f4fae4", "#b4d88a", "#5e8a4a"], fit: M.wood, add: (h) => [L(h[0], h[3] - 1, h[1] - 1, h[2] + 0.5, "twig"), ...along(h, 4, (s, i) => P([[s - 0.6, h[3] - 0.5], [s + 0.6, h[3] - 0.5], [s + (i % 2 ? 0.8 : -0.8), h[3] + 2.2]], "willow"))] },
  // a red paper lantern on a cord under the tip, gold caps, a warm glow on the blade
  lantern: { name: "등불", blade: ["#fff6d0", "#f4c060", "#b0702e"], fit: M.black, add: (h) => { const s = h[1] - 3; return [L(s, h[3] - 0.5, s, h[3] + 1, "ink"), R(s - 1.6, s + 1.6, h[3] + 1, h[3] + 4.5, "lantern"), L(s - 1, h[3] + 1, s + 1, h[3] + 1, "gold2"), L(s - 1, h[3] + 4, s + 1, h[3] + 4, "gold2"), D(s, h[3] + 2.5, "glow2"), D(h[0] + 2, mid(h) - 0.5, "glow2")]; } },
  // a bronze temple bell on a rope, the rope wound twice round the blade
  templeBell: { name: "사원 종", blade: ["#f8e4b0", "#cc9c50", "#7c5a2c"], fit: M.wood, add: (h) => { const s = h[1] - 4; return [...along(h, 2, (t) => L(t - 1, h[2], t + 1, h[3] - 1, "rope")), L(s, h[3] - 0.5, s, h[3] + 0.8, "rope"), P([[s - 1, h[3] + 0.5], [s + 1, h[3] + 0.5], [s + 2.2, h[3] + 3.6], [s - 2.2, h[3] + 3.6]], "bronze"), D(s, h[3] + 3.6, "ink")]; } },
  // a whale's rib bones along a bone blade, a blue fluke at the tip
  whalebone: { name: "고래뼈", blade: M.bone, fit: ["#8ab4d8", "#4a78a8", "#2e4a7a"], add: (h) => [...along(h, 4, (s) => L(s, h[2] + 0.5, s + 1, h[3] - 1, "rib")), P([[h[1] - 2, mid(h) - 0.5], [h[1] + 1, h[2] - 2], [h[1] + 0.5, mid(h) - 0.5], [h[1] + 1, h[3] + 1.5]], "whale")] },
  // a pastel blade studded with candy stars in three colours
  starCandy: { name: "별사탕", blade: ["#fffafc", "#ffd4ea", "#d894c4"], add: (h) => along(h, 3, (s, i) => leaf(s, mid(h) - 0.5, 1.7, ["candyY", "candyB", "candyP"][i % 3])) },
});
const EXTRA = { willow: "#6ab84a", lantern: "#e0403a", glow2: "#fff4a0", rope: "#c8a060", bronze: "#b8843a", rib: "#b0a08e", whale: "#4a78b8", candyY: "#f8d850", candyB: "#7ac8f0", candyP: "#f07ab0", petal: "#ff9ac0", ice: "#e8fbff", candy: "#e8485a", foam: "#f4ffff", sand: "#fff8dc", node: "#4a7a3a", bee: "#3a3040", twig: "#6a3e36", bloom: "#ff8ab4", maple: "#d8302a", gold2: "#f0c040" };
// 백자 청화 skin: drawn whole per weapon kind by weapons_porcelain.js (sprite() / weaponIcon() hand over); this row only names it
MOTIF.porcelain = PORCELAIN_MOTIF.porcelain;
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
      // a +7 weapon's lit edge burns (a bow's: the back of its limbs, the edge facing the shot)
      if (glow && glow.blade.includes(m) && (glow.edgeX ? (x < W - 1 ? mat[i + 1] : null) !== m : lit)) col = glow.col;
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
function build(kind, tier, motif, icon, o) {
  const list = DESIGNS[kind] || DESIGNS.sword;
  const name = MOTIF_SIL[kind]?.[motif] || UNIQ_SIL[motif];
  // (a unique's silhouette is its own kind's: a spear's trident motif on a sword keeps the sword's design)
  const design = (name && SIL[kind] && SIL[kind][name]) || list[Math.max(0, Math.min(list.length - 1, tier - 1))];
  const d = design(icon, o);
  const mats = {};
  let sh = d.sh.slice();
  const mo = MOTIF[motif];
  if (mo) {
    for (const b of d.blade) mats[b] = mo.blade;
    if (mo.fit) for (const f of ["iron", "gold", "dark", "carbon", "black", "dwood", "leather"]) if (!d.blade.includes(f)) mats[f] = mo.fit;
    // a bow's motif is laid out along its curved limb (head is in limb terms: along it, across it)
    const add = mo.add(d.head);
    sh = sh.concat(d.limb ? bend(add, d.limb) : add);
  }
  return { sh, post: d.post || [], mats, head: d.head, blade: d.blade, edgeX: !!d.edgeX };
}
/**
 * Shapes drawn for a straight blade (s along it, t across, t < 0 its upper edge) bent onto a bow's
 * limb: along → t, across → back from the limb's centre `c(t)` (the upper edge faces the shot).
 * Edges are cut into pieces first so they follow the curve.
 */
function bend(shapes, c) {
  const at = ([u, v]) => [c(u) - v, u];
  const cut = (pts, closed) => {
    const out = [];
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      for (let j = 0; j < 4; j++) out.push([a[0] + ((b[0] - a[0]) * j) / 4, a[1] + ((b[1] - a[1]) * j) / 4]);
    }
    if (!closed) out.push(pts[pts.length - 1]);
    return out;
  };
  return shapes.flatMap((sh) => {
    if (sh.k === "p") return [{ ...sh, pts: cut(sh.pts, true).map(at) }];
    if (sh.k === "c") { const [s, t] = at([sh.s, sh.t]); return [{ ...sh, s, t }]; }
    if (sh.k === "d") { const [s, t] = at([sh.s, sh.t]); return [{ ...sh, s, t }]; }
    const pts = cut([sh.a, sh.b], false).map(at), segs = [];
    for (let i = 0; i + 1 < pts.length; i++) segs.push({ ...sh, a: pts[i], b: pts[i + 1] });
    return segs;
  });
}
/** Paint a design: its shapes, inked (`inks`), then its bare one-pixel lines (a bow's string) over the ink. */
function paint(d, W, H, xf, inv, glow, inks) {
  const c = raster(d.sh, d.mats, W, H, xf, inv, glow);
  outline(c, inks);
  if (d.post.length) c.getContext("2d").drawImage(raster(d.post, d.mats, W, H, xf, inv, null), 0, 0);
  return c;
}
const GLOW7 = "#fff2a8", GLOW10 = "#ffd84a";

// ───────────────────────────── external images ─────────────────────────────
/** The manifest key of a look: a skin wins over a legendary power, which wins over the tier. */
export function assetKey(kind, tier, o = {}) {
  if (MOTIF[o.ws]) return `${kind}.skin.${o.ws}`;
  if (MOTIF[o.wl]) return `${kind}.lg.${o.wl}`;
  return `${kind}.t${tier}`;
}
/**
 * The listed image for `key` on a W×H canvas, its hand point at (ox, oy) — the manifest's
 * `grip`, else GRIP (a book's centre) — or null when nothing is listed.
 */
function fromAsset(key, W, H, ox, oy, centred) {
  const src = Assets.canvas(key);
  if (!src) return null;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const grip = (Assets.meta(key) || {}).grip;
  if (!grip && src.width === W && src.height === H) g.drawImage(src, 0, 0);
  else {
    const [gx, gy] = grip || (centred ? [src.width >> 1, src.height >> 1] : GRIP);
    g.drawImage(src, Math.round(ox - gx), Math.round(oy - gy));
  }
  return c;
}
/**
 * Rarity and enhancement over an external image: its dark outline takes `ink`, a +7
 * lights the upper edge of the striking part (`front(x, y)`), a +10 adds a gold ring.
 */
function dressAsset(c, ink, we, front) {
  const g = c.getContext("2d"), W = c.width, H = c.height;
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const edge = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!op(x, y) || (op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1))) continue;
    if (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11 < 90) edge[i] = 1;
  }
  const inkRgb = ink ? hexRgb(ink) : null, glow = we >= 7 ? hexRgb(GLOW7) : null;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let col = null;
    if (edge[i]) col = inkRgb;
    else if (glow && y > 0 && op(x, y) && edge[i - W] && front(x, y)) col = glow;
    if (col) { d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  if (we >= 10) outline(c, [GLOW10]);
  return c;
}

const cache = new Map();
/**
 * The world sprite. `gear`: wt tier · wq rarity · we enhancement · wl legendary/set
 * key · ws weapon-skin motif. Pointing right with the hand at GRIP (a book: centred).
 */
export function weaponSprite(kind, gear = {}) {
  return kind === "bow" ? bowSprite(gear) : sprite(kind, gear, null);
}
/**
 * A bow in hand at a moment of its shot: `pull` −0.25 (the string just snapped past rest) … 0
 * (rest) … 1 (full draw), in eighths; `arrow` an arrow on the string. scene2d draws every frame of
 * the draw and release from these (swing.js bowPose gives the pull). An installed image
 * (`weapon.bow.…`) has no string of its own to pull: it is shown as it is.
 */
export function bowSprite(gear = {}, pull = 0, arrow = false) {
  const q = Math.max(-2, Math.min(8, Math.round(pull * 8)));
  return sprite("bow", gear, { pull: q / 8, arrow: !!arrow, q });
}
function sprite(kind, gear, o) {
  const wt = Math.max(1, Math.min(6, gear.wt | 0 || 1)), wq = Math.max(0, Math.min(5, gear.wq | 0)), we = gear.we | 0;
  const motif = MOTIF[gear.ws] ? gear.ws : MOTIF[gear.wl] ? gear.wl : "";
  const key = `${kind}:${wt}:${wq}:${we >= 10 ? 10 : we >= 7 ? 7 : 0}:${motif}${o ? `:${o.q}:${o.arrow ? 1 : 0}` : ""}`;
  let c = cache.get(key);
  if (c) return c;
  if (motif === "porcelain") { c = porcelainWeaponSprite(kind, gear, o); cache.set(key, c); return c; }
  const book = kind === "book", hammer = kind === "hammer";
  const W = kind === "spear" ? 52 : kind === "sword" ? 44 : hammer ? 40 : 32, H = hammer ? 36 : 32;
  const ox = book ? 16 : GRIP[0], oy = 16;
  const ext = fromAsset("weapon." + assetKey(kind, wt, gear), W, H, ox, oy, book);
  if (ext) {
    // the striking part is past the guard: right of the hand by a third of the sprite
    c = dressAsset(ext, wq ? RARE_INK[wq] : null, we, (x) => book || x > ox + (W - ox) / 3);
    cache.set(key, c);
    return c;
  }
  const d = build(kind, wt, motif, false, o || undefined);
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7, edgeX: d.edgeX } : null;
  // Rasterize at the held size so the outline stays one pixel wide at either scale.
  const scale = hammer ? 1.25 : book ? 0.85 : 1;
  c = paint(d, W, H, (s, t) => [ox + s * scale, oy + t * scale], (x, y) => [(x - ox) / scale, (y - oy) / scale], glow, we >= 10 ? [RARE_INK[wq] || INK, GLOW10] : [RARE_INK[wq] || INK]);
  cache.set(key, c);
  return c;
}

/** The 32×32 bag icon: the same weapon laid corner to corner (a book upright), fitted to the square. */
export function weaponIcon(kind, tier, o = {}) {
  const motif = MOTIF[o.ws] ? o.ws : MOTIF[o.wl] ? o.wl : "", we = o.we | 0;
  const key = `i:${kind}:${tier}:${motif}:${we >= 10 ? 10 : we >= 7 ? 7 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  if (motif === "porcelain") { c = porcelainWeaponIcon(kind, o); cache.set(key, c); return c; }
  const ext = Assets.canvas("icon.weapon." + assetKey(kind, tier, o));
  if (ext) {
    // laid corner to corner: the striking part is the upper right
    c = dressAsset(fitEquipmentIcon(ext), null, we, (x, y) => kind === "book" || x - y > 2);
    cache.set(key, c);
    return c;
  }
  const d = build(kind, tier, motif, true, kind === "bow" ? { pull: 0.4, arrow: true } : undefined);
  const glow = we >= 7 ? { blade: d.blade, col: GLOW7 } : null;
  const { xf, inv } = weaponIconProjection(kind, d.sh.concat(d.post));
  c = paint(d, EQUIP_ICON_SIZE, EQUIP_ICON_SIZE, xf, inv, glow, we >= 10 ? [ICON_INK, GLOW10] : [ICON_INK]);
  cache.set(key, c);
  return c;
}
const urls = new Map();
/** A data URL for an item entry's icon when it looks different from its base item (legendary, set, +7, skin), else null. */
export function entryIconUrl(entry, it) {
  if (!entry || !it || it.type !== "weapon") return null;
  const wl = entry.lg || (MOTIF[it.id || entry.id] ? it.id || entry.id : ""), we = entry.enh | 0;
  if (!wl && we < 7) return null;
  const key = `${it.wk}:${it.tier}:${wl}:${we >= 10 ? 10 : 7 * (we >= 7)}`;
  if (!urls.has(key)) urls.set(key, weaponIcon(it.wk, it.tier, { wl, we }).toDataURL());
  return urls.get(key);
}
