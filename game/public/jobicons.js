/**
 * Job emblems: one 16×16 mark per job id of the rules (`JOBS` in src/logic/02-jobs-stats.js), so a job
 * reads at a glance wherever a player is shown. Drawn here as 14×14 rows; `jobIcon` puts them on a 16×16
 * canvas with a 1 px dark outline all round (so a mark stands on any ground: HUD brass, the world, chat).
 *
 *   `#` the first colour      `-` its shade          `*` the highlight
 *   `o` the second colour     `=` its shade          `.` nothing
 *
 * A single job wears its weapon's colour with pale metal; a two-weapon job wears both of its weapons'
 * colours, so the fifteen pairs are fifteen different colour pairs as well as fifteen silhouettes.
 * The module has no DOM at import time (tests/jobicons.mjs reads `ART`, `colorsOf` and `mask`).
 */

/** The six weapons' colours (also the tints of the tree and the cards). */
export const WK_COLOR = { sword: "#f0705a", dagger: "#b98cf5", spear: "#4fd8c8", staff: "#ffb84a", book: "#7a9cff", bow: "#8fe070" };
const PALE = "#e6e0d0", BRASS = "#e2a84a", OUT = "#1c1420", HI = "#fff6dc";

/** job id → [first weapon, second weapon | null, 14 rows, what the mark is (Korean, for the detail card)] */
export const ART = {
  adventurer: [null, null, [
    "......##......", "......##......", ".....#--#.....", "..o..#--#..o..", "...oo#--#oo...", "..####oo####..", "###---oo---###",
    "###---oo---###", "..####oo####..", "...oo#--#oo...", "..o..#--#..o..", ".....#--#.....", "......##......", "......##......",
  ], "길을 가리키는 나침반 별 — 아직 어느 무기의 길도 정하지 않은 모험가"],
  swordsman: ["sword", null, [
    "...........###", "..........####", ".........###*-", "........###*-.", ".......###*-..", "......###*-...", ".o...###*-....",
    ".oo.###*-.....", "..oo###-......", "...ooo-.......", "..=oooo.......", ".==..ooo......", "==....oo......", "=.............",
  ], "비스듬히 세운 큰 대검"],
  thief: ["dagger", null, [
    "......oo......", ".....o..o.....", "......oo......", "......oo......", "..oooooooooo..", "..o.######.o..", "....##*###....",
    "....##*##-....", ".....#*##-....", ".....#*##-....", ".....####.....", "......##-.....", "......##......", "......#.......",
  ], "거꾸로 쥔 단검 — 고리 달린 자루와 넓은 날밑"],
  lancer: ["spear", null, [
    "..........####", ".........#####", ".........##*##", ".........#*##.", "........o###..", "..-----o......", "..----o.......",
    "...--o........", "....o.........", "...o..........", "..o...........", ".o............", "o.............", "..............",
  ], "창날 아래 깃발을 단 창"],
  wizard: ["staff", null, [
    ".........####.", "........######", "........#**###", "........#*####", "........######", ".......o.####.", "......oooo....",
    ".....oo.......", "....oo........", "...oo.........", "..oo...#......", ".oo...###.....", "oo.....#......", "o.............",
  ], "빛나는 구슬을 얹은 스태프와 불티"],
  warlock: ["book", null, [
    "......*.......", ".....***......", "......*.......", "..............", ".#####..#####.", "#ooooo##ooooo#", "#o===o##o===o#",
    "#ooooo##ooooo#", "#o===o##o===o#", "#ooooo##ooooo#", "##############", ".....####.....", "..............", "..............",
  ], "펼친 마도서와 그 위의 별빛"],
  archer: ["bow", null, [
    "..##..........", "..=.##........", "..=...##......", "..=....##.....", "..=.....##.o..", "o.=......#..o.", "oooooooooooooo",
    "o.=......#..o.", "..=.....##.o..", "..=....##.....", "..=...##......", "..=.##........", "..##..........", "..............",
  ], "시위를 당긴 활과 메긴 화살"],
  spellblade: ["sword", "staff", [
    "......##......", "..o...##...o..", "..oo..##..oo..", ".ooo..##..ooo.", ".oo.o.##.o.oo.", ".oo.oo##oo.oo.", "..ooo.##.ooo..",
    "...oo.##.oo...", "......##......", "...########...", "......--......", "......--......", ".....####.....", "..............",
  ], "불길이 감싼 검 — 홍련참"],
  tracker: ["dagger", "bow", [
    ".....oooo.....", "...oo....oo...", "..o........o..", ".o......##..o.", ".o.....###..o.", "o.....###....o", "o....###.....o",
    "o..#.##......o", "o..###.......o", ".o..##......o.", ".o.#.##.....o.", "..o........o..", "...oo....oo...", ".....oooo.....",
  ], "조준 고리 안의 단검 — 놓치지 않는 사냥감"],
  dragoon: ["spear", "book", [
    "......##......", ".....####.....", ".....####.....", "o.....##.....o", "oo....##....oo", "ooo...##...ooo", "oooo.o##o.oooo",
    "oooooo##oooooo", "o.oo.o##o.oo.o", "o..o..##..o..o", "......##......", "......##......", "......##......", "......##......",
  ], "용의 날개를 편 창 — 드래곤 다이브"],
  hexblade: ["dagger", "book", [
    "......##......", ".....####.....", "......##......", "....oo##oo....", "..oo..##..oo..", ".o....##....o.", "o....####....o",
    ".o...####...o.", "..oo..##..oo..", "....oo##oo....", "......##......", "......##......", "......#.......", "..............",
  ], "저주의 눈을 꿰뚫은 단검"],
  stormrider: ["spear", "bow", [
    "..oo......###.", ".o.......####.", ".o......###...", "o......###....", "o.....###.....", "o....########.", "o...########..",
    "o......###....", "o.....###.....", ".o...###......", ".o..##........", "..o##.........", "..#o..........", "..............",
  ], "활에서 쏘아진 번개의 투창"],
  darkknight: ["sword", "book", [
    "o............o", "oo..........oo", "ooo..oooo..ooo", ".oooooooooooo.", "..oooooooooo..", "..oooooooooo..", "..o##oooo##o..",
    "..oo##oo##oo..", "..oooooooooo..", "..ooo=oo=ooo..", "..ooo=oo=ooo..", "...oo=oo=oo...", "....o=oo=o....", "..............",
  ], "붉은 눈빛의 뿔 투구"],
  bladedancer: ["sword", "dagger", [
    "...........###", "..........###.", ".oo......###..", ".ooo....###...", "..ooo..###....", "...ooo###.....", "....o###......",
    "....###oo.....", "...###.ooo....", "#.###...oo.o..", ".###.....ooo..", ".##.......oo..", "#.##.....o..o.", "..............",
  ], "엇갈린 대검과 단검 — 십자 난도"],
  breaker: ["sword", "spear", [
    "......o.......", ".....ooo......", ".....ooo......", "......o####...", "..##..o######.", ".####.o######.", "..##..o#####..",
    "......o.###...", "......o.......", "......o.......", "......o.......", "......o.......", "......o.......", "......o.......",
  ], "창끝에 큰 날을 단 미늘창 — 진을 부순다"],
  arcblade: ["sword", "bow", [
    "......##......", "......##......", "......##......", "...oo.##.oo...", "..oo..##..oo..", ".oo...##...oo.", ".o....##....o.",
    "oo....##....oo", "o.....##.....o", "o=====##=====o", "....######....", "......--......", "......--......", ".....####.....",
  ], "활에 화살 대신 메긴 검 — 검기 화살"],
  shadowlance: ["dagger", "spear", [
    "...........ooo", "..........oooo", ".........oooo.", "..##....ooo...", ".##....oo.....", "##....oo..##..", "#....oo..##...",
    "....oo..##....", "...oo..##.....", "..oo..##......", ".oo..##.......", "oo..##........", "o..##.........", "..............",
  ], "창을 따라 달리는 그림자 칼날"],
  trickster: ["dagger", "staff", [
    "......##......", "o.....##.....o", ".#....##....#.", ".##...##...##.", "..##..##..##..", "..###.##.###..", "...##.##.##...",
    "...###--###...", "....##--##....", "....-####-....", ".....oooo.....", "......oo......", ".....oooo.....", "..............",
  ], "부채처럼 펼친 세 자루 비수 — 원소 비수"],
  spellspear: ["spear", "staff", [
    "..........####", "..........####", ".........####.", "........###.#.", ".......##.....", "......##......", ".....##.......",
    "....##........", ".ooo#.........", "ooooo.........", "oo*oo.........", "ooooo.........", ".ooo..........", "..............",
  ], "한쪽은 창날, 한쪽은 마력 구슬인 창"],
  runesage: ["staff", "book", [
    "....oooooo....", "..oooooooooo..", ".ooooo##ooooo.", ".o#ooo##ooo#o.", ".oo#oo##oo#oo.", ".ooo#o##o#ooo.", ".oooo####oooo.",
    ".ooooo##ooooo.", ".ooooo##ooooo.", ".ooooo##ooooo.", ".ooooo##ooooo.", ".oooooooooooo.", ".============.", "..............",
  ], "룬을 새긴 석판 — 메아리 법진"],
  spellarcher: ["staff", "bow", [
    "..........#...", "..........#...", ".........###..", ".......#######", ".........###..", "........o.#...", ".......o..#...",
    "......o.......", ".....o........", "..o.o.........", "..oo..........", ".oooo.........", "oo.o..........", "..............",
  ], "별을 화살촉으로 단 화살 — 삼원소 화살"],
  runearcher: ["book", "bow", [
    "......oo......", ".....oooo.....", "....oooooo....", "...ooo##ooo...", "..oooo##oooo..", ".ooo######ooo.", "oooooo##oooooo",
    "ooo.oo##oo.ooo", "o....oooo....o", "......oo......", "..#...oo...#..", ".###..oo..###.", "..#...oo...#..", "..............",
  ], "룬을 새긴 큰 화살촉과 먹물 방울"],
};
export const ALL = Object.keys(ART);
/** The old class names some saved rows still carry. */
const ALIAS = { warrior: "swordsman", rogue: "thief", mage: "wizard", ranger: "lancer" };
export const jobId = (id) => (ART[id] ? id : ART[ALIAS[id]] ? ALIAS[id] : "adventurer");
/** What the mark shows, in the player's words. */
export const jobMotif = (id) => ART[jobId(id)][3];

const shade = (hex, k = 0.58) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
/** [first colour, second colour] of a job's mark. */
export function colorsOf(id) {
  const [a, b] = ART[jobId(id)];
  if (!a) return [PALE, BRASS];
  return [WK_COLOR[a], b ? WK_COLOR[b] : PALE];
}
/** The filled cells of a mark, as 14 strings of `1`/`0` (the silhouette; tests compare these). */
export const mask = (id) => ART[jobId(id)][2].map((r) => [...r].map((c) => (c === "." ? "0" : "1")).join(""));
/** Rows of the wrong size, for the test. */
export function badRows() {
  const out = [];
  for (const id of ALL) {
    const rows = ART[id][2];
    if (rows.length !== 14) out.push(`${id}:rows:${rows.length}`);
    rows.forEach((r, y) => { if (r.length !== 14 || /[^.#o\-=*]/.test(r)) out.push(`${id}:${y}:${r}`); });
  }
  return out;
}

const cache = {};
/**
 * A 16×16 canvas of a job's mark. `mono` paints the whole mark in one colour and its shade (a locked cell,
 * an engraved plate); `bare` leaves the outline off.
 */
export function jobIcon(id, { mono = "", bare = false } = {}) {
  id = jobId(id);
  const key = `${id}|${mono}|${bare ? 1 : 0}`;
  if (cache[key]) return cache[key];
  const rows = ART[id][2], [a, b] = mono ? [mono, shade(mono, 0.72)] : colorsOf(id);
  const col = { "#": a, "-": shade(a), o: b, "=": shade(b), "*": mono ? a : HI };
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  const on = (x, y) => y >= 0 && y < 14 && x >= 0 && x < 14 && rows[y][x] !== ".";
  if (!bare) {
    g.fillStyle = OUT;
    for (let y = -1; y <= 14; y++) for (let x = -1; x <= 14; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) g.fillRect(x + 1, y + 1, 1, 1);
  }
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (on(x, y)) { g.fillStyle = col[rows[y][x]]; g.fillRect(x + 1, y + 1, 1, 1); }
  return (cache[key] = c);
}
const urls = {};
export function jobIconUrl(id, opt) {
  const key = `${jobId(id)}|${(opt && opt.mono) || ""}|${opt && opt.bare ? 1 : 0}`;
  return urls[key] || (urls[key] = jobIcon(id, opt).toDataURL());
}
/** An `<img class="ji">` of a job's mark (CSS sizes it in whole multiples of 16). `data-job` lets a click find its detail card. */
export function jobImg(id, opt) {
  const im = document.createElement("img");
  im.className = "ji";
  im.alt = "";
  im.dataset.job = jobId(id);
  im.src = jobIconUrl(id, opt);
  return im;
}
