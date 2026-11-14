// ───────────────────────────── 버드나무광장: the forest refuge (docs/design/town.md) ─────────────────────────────
// A cosy, lamp-lit centre (plaza, market, hearths) fading outward into the woods; along the north edge a
// palisade, watch posts and the creeping blight where the darkness-eaten forest presses in. Laid by hand on a
// 100 × 76 grid (the tiles in town.md B–D are frozen: doors, interiors, tests and other docs read them); the
// seed only varies the scatter. Height is visual only: the terrace's stone wall `W` and its steps.

/** The town's layout revision: a sheet saved in town under an older one wakes at the entry (40 migrate). */
const TOWN_REV = 2;
/**
 * The town's named buildings (town.md D, frozen): sign name and icon, footprint, which face the door is on
 * ("s" the row below, "e" the column to the right, "" none) and its two door tiles. The doors themselves come
 * from data/links.json (and HOUSE_TOWN for 내 집): this table places the building, its door art and its sign.
 */
const TOWN_BLD = [
  { k: "hall", name: "버드나무광장 회관", icon: "banner", x: 46, y: 20, w: 8, h: 5, door: "s", d: [[49, 25], [50, 25]] },
  { k: "library", name: "부엉이 도서관", icon: "book", x: 33, y: 16, w: 7, h: 5, door: "s", d: [[36, 21], [37, 21]] },
  { k: "dojo", name: "버드나무광장 수련관", icon: "sword", x: 60, y: 16, w: 6, h: 4, door: "s", d: [[62, 20], [63, 20]] },
  { k: "store", name: "다람쥐 잡화점", icon: "bag", x: 63, y: 33, w: 5, h: 4, door: "s", d: [[65, 37], [66, 37]] },
  { k: "smithy", name: "캉캉대장간", icon: "anvil", x: 70, y: 33, w: 6, h: 4, door: "s", d: [[72, 37], [73, 37]] },
  { k: "merc", name: "늑대발 용병사무소", icon: "swords", x: 83, y: 32, w: 6, h: 4, door: "s", d: [[85, 36], [86, 36]] },
  { k: "lab", name: "보글연금공방", icon: "flask", x: 78, y: 25, w: 5, h: 3, door: "s", d: [[80, 28], [81, 28]] },
  { k: "diner", name: "쥬쥬식당 · 선술집", icon: "bowl", x: 70, y: 45, w: 6, h: 4, door: "s", d: [[72, 49], [73, 49]] },
  { k: "cafe", name: "테일즈 카페", icon: "cup", x: 78, y: 46, w: 5, h: 3, door: "s", d: [[79, 49], [80, 49]] },
  { k: "inn", name: "모닥별 여관", icon: "bed", x: 61, y: 50, w: 6, h: 4, door: "e", d: [[67, 51], [67, 52]] },
  { k: "boutique", name: "루루 의상실", icon: "shirt", x: 40, y: 50, w: 5, h: 3, door: "e", d: [[45, 51], [45, 52]] },
  { k: "pet", name: "몽글 펫 돌봄집", icon: "paw", x: 28, y: 44, w: 4, h: 3, door: "s", d: [[29, 47], [30, 47]] },
  { k: "apt", name: "동동아파트", icon: "house", x: 8, y: 30, w: 5, h: 4, door: "s", d: [[10, 34], [11, 34]] },
  { k: "home", name: "내 집", icon: "house", x: 14, y: 43, w: 4, h: 3, door: "s", d: [[15, 46], [16, 46]] },
  { k: "barn", name: "마을 창고", icon: "crate", x: 30, y: 33, w: 5, h: 4, door: "", d: [] },
];
/** Doorless villagers' cottages (legacy house() 4 × 3): x, y, look. */
const TOWN_COTTAGES = [[4, 23, 0], [11, 22, 2], [4, 36, 3], [10, 36, 1], [4, 44, 2]];

/** A named building or a prop from an editor map file, its fields whitelisted (36-custom-maps.js fromEditor). */
function bigClean(b) {
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const out = { t: b.t, k: str(b.k, 16), x: b.x | 0, y: b.y | 0, w: clamp(b.w | 0, 1, 12), h: clamp(b.h | 0, 1, 12) };
  if (b.t === "bld") Object.assign(out, { door: b.door === "s" || b.door === "e" ? b.door : "", dx: clamp(b.dx | 0, -1, 11), name: str(b.name, 24), icon: str(b.icon, 12) });
  return out;
}

function buildTown() {
  const W = 100, H = 76, S0 = 2203;
  const m = blank("town", "버드나무광장", W, H, ".");
  m.safe = true;
  m.bgm = "town";
  m.entry = [50, 43];
  const g = m.g, o = m.o, hh = (x, y, s) => h2(x, y, S0 + s);
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const O = (x, y, ch) => { if (at(x, y)) o[y][x] = ch; };
  const both = (x0, y0, x1, y1, gc) => { rect(g, x0, y0, x1, y1, gc); rect(o, x0, y0, x1, y1, " "); };
  const ell = (cx, cy, rx, ry, f) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1 && at(x, y)) f(x, y, d);
    }
  };
  // tiles the scatter leaves open: routes, doors, the people and the ground round them
  const keep = new Uint8Array(W * H);
  const K = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) keep[y * W + x] = 1; };
  /** A prop over a footprint of `a` (scene2d draws it whole). */
  const prop = (k, x, y, w, h) => { rect(o, x, y, x + w - 1, y + h - 1, "a"); m.big.push({ t: "prop", k, x, y, w, h }); K(x - 1, y - 1, x + w, y + h); };

  // ── the ground: meadow grass with a little variety
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = hh(x, y, 1); g[y][x] = r < 0.13 ? "," : r < 0.16 ? '"' : "."; }

  // ── the woods all round, and beyond the north wall the dead forest the darkness ate
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = hh(x, y, 3);
    if (y <= 8 && x >= 26) {
      if (y >= 2) g[y][x] = hh(x, y, 2) < 0.18 && y < 4 ? ":" : "&";
      o[y][x] = y < 2 ? (r < 0.5 ? "P" : "T") : r < 0.16 ? "A" : r < 0.26 ? "P" : r < 0.3 ? "R" : " ";
    } else if (x < 2 || x > 95 || y > 71 || y < 2 || y <= 8) o[y][x] = r < 0.62 ? "T" : "P";
  }
  // the forest margin thins inward: a ragged belt a few trees deep
  for (let y = 9; y < 72; y++) for (let x = 2; x < 96; x++) {
    const d = Math.min(x - 2, 95 - x, 71 - y, x < 26 ? y - 9 : 99);
    if (d > 4 || o[y][x] !== " ") continue;
    const r = hh(x, y, 6);
    if (hh(x, y, 5) < 0.75 - d * 0.16) o[y][x] = r < 0.6 ? "T" : r < 0.85 ? "P" : "B";
  }
  // hills: the north-west mound and 노을 언덕 in the south-east (solid grassy rises with trees round them)
  ell(10, 10, 6.5, 5.5, (x, y) => { o[y][x] = "C"; });
  ell(89, 64, 6, 6, (x, y) => { o[y][x] = "C"; });
  ell(89, 64, 8, 8, (x, y) => { if (o[y][x] === " " && hh(x, y, 7) < 0.4) o[y][x] = hh(x, y, 8) < 0.5 ? "T" : "P"; });

  // ── water: the stream down its ravine into the pond, the pond's outflow south into the woods
  both(22, 0, 23, 52, "w");
  for (let y = 8; y <= 24; y++) { rect(o, 20, y, 21, y, "C"); rect(o, 24, y, 25, y, "C"); }
  ell(18, 56, 7.5, 5.5, (x, y) => { g[y][x] = "w"; o[y][x] = " "; });
  ell(18, 56, 9.2, 7, (x, y) => { if (g[y][x] !== "w") { g[y][x] = "s"; if ("TPB".includes(o[y][x])) o[y][x] = " "; } });
  both(14, 61, 15, 75, "w");
  for (let y = 25; y <= 50; y++) for (const x of [21, 24]) if (g[y][x] !== "w" && hh(x, y, 9) < 0.7) g[y][x] = "s";
  ell(18, 56, 7.5, 5.5, (x, y, d) => { if (d > 0.62 && hh(x, y, 10) < 0.28 && !(y >= 55 && y <= 57 && x >= 21)) o[y][x] = "e"; });
  for (let x = 23; x <= 26; x++) { g[56][x] = "b"; o[56][x] = " "; }
  K(22, 55, 27, 57);

  // ── the plaza: a stone ellipse round the fountain
  ell(50, 40, 12.5, 8.5, (x, y) => { g[y][x] = "o"; o[y][x] = " "; });
  K(37, 31, 63, 49);

  // ── roads: west gate ← plaza → east gate, south to 버드나무 마을; then the lanes
  const lay = (x0, y0, x1, y1) => { road(m, x0, y0, x1, y1, "p"); K(Math.min(x0, x1) - 1, Math.min(y0, y1) - 1, Math.max(x0, x1) + 2, Math.max(y0, y1) + 2); };
  lay(0, 40, 38, 40); lay(62, 40, 98, 40); lay(49, 48, 49, 74);
  both(0, 40, 1, 41, "p"); both(98, 40, 99, 41, "p");
  // the south road ends at 버드나무 마을's door (49–50, 73) in a little clearing; nothing past it
  rect(o, 46, 64, 53, 71, " "); rect(o, 48, 74, 51, 75, "T"); for (const x of [47, 48, 51, 52]) rect(o, x, 72, x, 73, "P");
  // the bridges: the west road's, and the footbridge to 내 집 and the pet house
  both(22, 40, 23, 41, "b"); both(22, 46, 23, 46, "b");
  for (let x = 18; x <= 27; x++) if (x !== 22 && x !== 23) both(x, 46, x, 46, "p");
  for (let x = 14; x <= 31; x++) if (x !== 22 && x !== 23) both(x, 47, x, 47, x % 3 ? "p" : "r");
  K(13, 45, 32, 48); K(24, 42, 40, 48);
  // the lane up to 동동아파트 between two cottages, and the lane north along the stream to the gardens
  both(8, 34, 9, 39, "p"); both(8, 35, 12, 35, "p"); K(7, 33, 13, 39);
  for (let y = 26; y <= 39; y++) both(16, y, 17, y, y % 4 ? "p" : "r");
  both(6, 27, 17, 27, "p"); K(5, 26, 18, 39);
  // the market lane north to 보글연금공방, the lane south to 모닥별 뜰, the square itself
  both(80, 28, 81, 39, "r"); K(79, 27, 82, 40);
  both(76, 42, 77, 49, "r"); K(75, 42, 78, 50);
  both(68, 50, 80, 56, "r"); K(67, 49, 81, 57);
  // the forge yard, open to the road; the gravel before the mercenaries' lodge
  both(76, 33, 79, 38, "r"); K(76, 33, 79, 39);
  rect(g, 82, 36, 90, 39, "r"); K(82, 36, 97, 42);
  // stepping stones from the pond clearing to the south road
  for (let x = 26; x <= 48; x++) { const y = 60 + Math.round(Math.sin(x / 4) * 1.2); if ((x & 1) || x > 44) g[y][x] = "r"; o[y][x] = " "; K(x, y - 1, x, y + 1); }
  ell(29, 60, 3.2, 2.6, (x, y) => { o[y][x] = " "; keep[y * W + x] = 1; });

  // ── 윗마을: the upper terrace, its promenade, the stone retaining wall and two flights of steps
  for (let y = 10; y <= 28; y++) for (let x = 26; x <= 79; x++) if (o[y][x] === " ") { const r = hh(x, y, 11); g[y][x] = r < 0.3 ? "," : r < 0.36 ? '"' : "."; }
  both(30, 26, 75, 27, "r"); K(29, 25, 76, 28);
  for (let x = 30; x <= 72; x++) o[29][x] = "W";
  for (let y = 10; y <= 29; y++) o[y][29] = "W";
  both(48, 29, 52, 30, "v"); both(35, 29, 36, 30, "v");
  for (const x of [47, 53, 34, 37]) for (let y = 28; y <= 30; y++) o[y][x] = "W";
  // from the steps down to the plaza; the library's path; the gentle ramp at the east end
  both(48, 31, 52, 32, "o");
  both(35, 31, 36, 35, "p");
  for (let x = 35; x <= 41; x++) for (const y of [34, 35]) if (g[y][x] !== "o") both(x, y, x, y, "p");
  K(33, 28, 41, 36); K(46, 28, 54, 33);
  for (let y = 28; y <= 30; y++) for (let x = 73; x <= 79; x++) if (o[y][x] === " ") g[y][x] = "r";
  K(73, 24, 79, 30);
  // paths on the terrace to each door, the hall's paving
  both(36, 21, 37, 25, "p"); both(62, 20, 63, 25, "p"); both(48, 25, 51, 25, "o");
  K(31, 20, 42, 25); K(58, 19, 66, 25); K(44, 24, 55, 26);
  // the training yard: packed earth for the dummies
  both(66, 17, 72, 25, "r"); K(65, 16, 73, 25);
  // the darkness's tongues reaching under the palisade
  for (const cx of [44, 80]) for (let y = 10; y <= 11; y++) for (let x = cx - 2 + (y - 10); x <= cx + 2 - (y - 10); x++) if (o[y][x] === " ") g[y][x] = "&";

  // ── the palisade along the north and the east, the woods behind it
  for (let x = 26; x <= 95; x++) { o[9][x] = "F"; g[9][x] = "&"; }
  for (let y = 9; y <= 32; y++) { o[y][95] = "F"; g[y][95] = "&"; }
  K(30, 10, 94, 12);

  // ── the buildings (TOWN_BLD) and the villagers' cottages
  for (const b of TOWN_BLD) {
    for (const [dx, dy] of b.d) K(dx - 1, dy - 1, dx + 1, dy + 2);
    if (b.door === "e") for (const [dx, dy] of b.d) K(dx, dy - 1, dx + 2, dy + 1);
    rect(o, b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, "h");
    // `dx`: where along its face the door starts (tiles from the footprint's corner)
    m.big.push({ t: "bld", k: b.k, x: b.x, y: b.y, w: b.w, h: b.h, door: b.door, dx: b.d.length ? (b.door === "e" ? b.d[0][1] - b.y : b.d[0][0] - b.x) : -1, name: b.name, icon: b.icon });
    K(b.x - 1, b.y - 1, b.x + b.w, b.y + b.h);
  }
  for (const [x, y, v] of TOWN_COTTAGES) { house(m, x, y, v); K(x - 1, y - 1, x + 4, y + 3); }
  K(29, 37, 36, 39);

  // ── the plaza's furniture: fountain, waypoint stone, spirit tree and fire, obelisk
  rect(o, 49, 39, 50, 40, "a");
  m.big.push({ t: "fountain", x: 49, y: 39 });
  o[43][46] = "Q";
  WP.town = { x: 46, y: 43, ax: 47, ay: 43 };
  o[44][56] = "T";
  m.big.push({ t: "spirit", x: 56, y: 44 });
  o[DIM_TOWN.ob[1]][DIM_TOWN.ob[0]] = "a";
  m.big.push({ t: "obelisk", x: DIM_TOWN.ob[0], y: DIM_TOWN.ob[1] });
  FIRES.town.push([58, 46], [29, 60]);
  // the board of the day's tasks (decor.js stands it on the B beside 하루)
  o[35][43] = "B";
  // lamp posts, in pairs on a row so lantern strings hang between them (decor.js town)
  for (const [x, y] of [[42, 33], [54, 33], [41, 47], [53, 47], [69, 50], [78, 50], [68, 56], [80, 56], [34, 25], [44, 25], [56, 25], [66, 25],
    [64, 42], [74, 42], [84, 42], [91, 42], [26, 42], [33, 42], [12, 42], [20, 42], [51, 52], [51, 62], [48, 68]]) O(x, y, "L");
  // flower tubs round the plaza, flower beds along the terrace's lip
  for (const [x, y] of [[39, 37], [39, 44], [61, 36], [61, 44], [45, 32], [55, 32], [45, 48], [55, 48]]) O(x, y, "B");
  for (let x = 31; x <= 71; x++) if (o[28][x] === " " && (x < 46 || x > 54) && (x < 33 || x > 38)) { g[28][x] = "\""; if (x % 7 === 3) o[28][x] = "B"; }

  // ── props over a footprint (scene2d draws them; town.md H keeps them under 80 with the buildings)
  prop("watch", 40, 10, 2, 2); prop("watch", 64, 10, 2, 2); prop("watch", 92, 22, 2, 2);
  for (const [x, y] of [[42, 46], [31, 23], [40, 25], [12, 39], [70, 57], [80, 62], [57, 31]]) prop("bench", x, y, 2, 1);
  prop("stall", 59, 37, 2, 1); prop("stall", 66, 39, 2, 1); prop("stall", 88, 39, 2, 1);
  prop("cart", 68, 38, 2, 1); prop("cart", 26, 36, 2, 1); prop("cart", 90, 36, 2, 1);
  prop("well", 74, 55, 1, 1); prop("well", 11, 44, 1, 1);
  prop("anvil", 78, 35, 1, 1);
  for (const [x, y] of [[67, 18], [69, 18], [71, 18], [71, 21]]) prop("dummy", x, y, 1, 1);
  prop("garden", 12, 28, 2, 2); prop("garden", 4, 28, 2, 2); prop("garden", 9, 47, 2, 2);
  prop("laundry", 7, 43, 2, 1); prop("laundry", 13, 32, 2, 1);
  prop("lookout", 82, 66, 2, 2);
  // spirit lanterns holding the blight back; the forge's barrels and crates; the square's tables
  for (const [x, y] of [[42, 12], [46, 12], [78, 12], [82, 12]]) O(x, y, "*");
  for (const [x, y] of [[79, 33], [76, 33], [69, 36], [62, 36], [82, 33], [89, 34], [68, 37]]) O(x, y, hh(x, y, 12) < 0.5 ? "w" : "]");
  for (const [tx, ty] of [[71, 54], [77, 55]]) { O(tx, ty, "o"); O(tx - 1, ty, "k"); O(tx + 1, ty, "k"); }
  O(87, 37, "v");                // the mercenaries' notice board
  O(45, 25, "%");                // a cat asleep by the hall's door
  O(40, 22, "O");                // the record stone in the reading garden

  // ── signposts: every one names where it leads (the gates' from MAP_META, so the levels never drift)
  // (the town is built while the rules load, before the level shown for a band is known: a gate's label is
  // worked out the first time it is read, then kept)
  const gateLabel = (id, f) => { let s = null; return () => s || (s = f(doorName(MAP_META[id]))); };
  const signs = [
    [93, 42, gateLabel("meadow", (n) => `${n} →`), "meadow"], [5, 42, gateLabel("city", (n) => `← ${n}`), "city"],
    [47, 31, "↑ 마을회관 · 도서관 · 수련관", "town_hall"], [31, 26, "← 부엉이 도서관", "owl_library"],
    [71, 28, "→ 수련장 · 전직관", "dojo"], [62, 43, "→ 장터 거리 · 잡화점 · 대장간", "general_store"],
    [79, 39, "↑ 보글연금공방 · 용병사무소 →", "bogle_lab"], [75, 42, "↓ 쥬쥬식당 · 카페 · 여관", "juju_diner"],
    [38, 43, "← 살림 마을 · 창고 · 펫 돌봄집", "dongdong_apt"], [24, 42, "← 동동아파트 · 내 집", "dongdong_apt"],
    [52, 49, "↓ 버드나무 마을 · 연못", "willow"],
  ];
  m.marks = [{ x: 46, y: 43, kind: "waypoint" }];
  for (const [x, y, label, to] of signs) {
    o[y][x] = "G";
    const k = { x, y, kind: "sign", label, to };
    if (typeof label === "function") Object.defineProperty(k, "label", { get: label, enumerable: true });
    m.marks.push(k);
    K(x - 1, y - 1, x + 1, y + 1);
  }
  m.gates = { east: { t: [[98, 40], [98, 41]], a: [[96, 40], [96, 41]] }, west: { t: [[1, 40], [1, 41]], a: [[3, 40], [3, 41]] } };

  // ── the people: every service you use each session stands outdoors near the stone (ids and roles unchanged)
  m.npcs.push(
    { id: "elder", name: "관리자 엘더윈", role: "elder", x: 52, y: 37, look: [5, 0, 0, "#3f5a9a"] },
    { id: "shop", name: "보급상 리나", role: "shop", x: 61, y: 39, look: [4, 0, 1, "#8a4a6a"] },
    { id: "smith", name: "대장장이 볼칸", role: "smith", x: 77, y: 37, look: [0, 1, 0, "#6a4a38"] },
    { id: "train", name: "수련관 카이", role: "train", x: 68, y: 23, look: [1, 2, 0, "#7a2e2e"] },
    { id: "bank", name: "창고지기 도담", role: "bank", x: 32, y: 38, look: [2, 0, 0, "#6a5a3a"],
      say: "맡길 물건이 있나? 캐릭터마다 60칸, 골드도 따로 맡아 두지. 같은 물건은 한 칸에 모아 준다네." },
    { id: "guard", name: "경비병 토비", role: "talk", x: 94, y: 38, look: [1, 0, 0, "#5e6470"],
      say: "동쪽 문은 바람초원, 서쪽 문은 네온 시티로 이어져. 길은 갈라지고 막히기도 하니 샛길을 살펴봐 — 막다른 곳엔 보물 상자나 모닥불, 그리고 가끔은 땅속으로 내려가는 계단이 있거든. 문 이름 옆의 레벨을 보고, 감당할 만한 곳부터 가!" },
    { id: "warp", name: "이동술사 노바", role: "warp", x: 45, y: 44, look: [2, 3, 0, "#4a6ac8"],
      say: "이동의 돌을 깨우면 어디서든 돌과 돌 사이를 건널 수 있어. 사냥터마다 입구 가까이에 하나씩 있지." },
    { id: "collector", name: "학자 몽", role: "collector", x: 34, y: 23, look: [3, 4, 0, "#7a6a3a"],
      say: "같은 몬스터를 서른 마리 잡으면 도감에 오르지. 한 지역을 다 채우면 그 땅이 힘을 빌려준다네." },
    { id: "achieve", name: "기록관 루", role: "achieve", x: 39, y: 23, look: [4, 1, 0, "#8a3a5a"],
      say: "자네의 모험은 모두 이 비석에 새겨지네. 이름난 업적에는 칭호가 따르지." },
    { id: "daily", name: "게시판지기 하루", role: "daily", x: 44, y: 36, look: [0, 2, 0, "#3a7a5a"],
      say: "매일 아침 6시에 새 과제가 붙는다네. 셋을 다 하면 보상 상자도 있지!" },
    { id: "costume", name: "의상실 주인 루루", role: "costume", x: 47, y: 53, look: [3, 1, 0, "#d86a9a"],
      say: "어서 와요! 모자, 옷, 망토, 안경, 무기 외형까지 — 능력치는 그대로, 모습만 바뀌어요." },
    { id: "dimkeeper", name: "균열 지기 오르카", role: "dim", x: DIM_TOWN.keeper[0], y: DIM_TOWN.keeper[1], look: [3, 3, 0, "#5a3a8a"],
      say: "오벨리스크 너머로 차원의 틈이 열려 있다네. 파티장이 균열을 열면 함께 들어갈 수 있지. 15분 안에 균열의 주인을 쓰러뜨리게!" },
    { id: "housing", name: "하우징 안내인 포근", role: "house", x: HOUSE_TOWN.agent[0], y: HOUSE_TOWN.agent[1], look: [2, 1, 0, "#c8783a"],
      say: "내 집 마련, 어렵지 않아요! 집을 사면 저 '내 집' 문이 언제나 당신의 집으로 이어진답니다. 가구도 여기서 팔아요." },
  );
  // (the woods' margin was grown before anyone was placed: a tree never stands on anyone or right beside them)
  for (const n of m.npcs) {
    K(n.x - 1, n.y - 1, n.x + 1, n.y + 1);
    for (let y = n.y - 1; y <= n.y + 1; y++) for (let x = n.x - 1; x <= n.x + 1; x++) if ("TPRu".includes(o[y][x])) o[y][x] = " ";
  }
  K(DIM_TOWN.land[0] - 1, DIM_TOWN.land[1] - 1, DIM_TOWN.land[0] + 1, DIM_TOWN.land[1] + 1);
  for (const [fx, fy] of FIRES.town) K(fx - 2, fy - 2, fx + 2, fy + 2);
  // the storyteller's place by the fire (62-daynight TELLER), the south door and the gates with their landings
  K(55, 45, 57, 47); K(47, 69, 52, 75); K(0, 38, 4, 43); K(95, 38, 99, 43);

  // ── the village's greenery: trees between the districts, wilder at the edges; a few rocks and stumps
  for (let y = 10; y < 72; y++) for (let x = 2; x < 96; x++) {
    if (keep[y * W + x] || o[y][x] !== " " || !".,\"".includes(g[y][x])) continue;
    const r = hh(x, y, 13), r2 = hh(x, y, 14);
    const p = (y > 57 && (x < 46 || x > 54)) || (x > 82 && y > 44) || (y < 25 && x < 20) || (x >= 26 && x <= 28) ? 0.2 : 0.06;
    if (r < p) o[y][x] = r2 < 0.55 ? "T" : r2 < 0.75 ? "P" : "B";
    else if (r < p + 0.012) o[y][x] = "R";
    else if (r < p + 0.02) o[y][x] = "u";
  }
  return m;
}

// ───────────────────────────── the generated world, map by map ─────────────────────────────
// Nothing here is built when the rules load: each hunting ground is generated the first time
// someone needs it (mapOf in 36-custom-maps.js) and kept. GEN holds what each one is made
// from — its generator, its level band and its settings (a function, so every build starts
// from a fresh copy) — and GATE_LINKS how the doors join them. What the rest of the rules must
// know without building anything (names, bands, monster lists) is read from here into MAP_META.

/** The generated maps in their fixed order (also the order of every list made from them). */
const GEN_IDS = ["meadow", "forest", "crypt", "city", "sewer", "cave", "abyss", "maple", "jungle", "oasis", "coast"];
/**
 * Every generated hunting ground: `make` the generator, `band` the level a character should
 * be to walk in (shown on every door that leads there), `stones` how many waypoint stones stand
 * along its way on (MAP_META.wpn; the map tests hold the built map to it), `cfg()` its settings
 * (sizes are 2× per side the first worlds': docs/design/scale-and-rift.md C.2); `theme` where the
 * generator sets one of its own, `kinds` monsters the generator places by itself, `after(m)`
 * a finishing touch, `npcs` the ids of the people it places.
 */
const GEN = {
  meadow: { make: wilds, band: [1, 7], stones: 3, cfg: () => ({
    // maps-v2 (docs/design/maps-v2.md, reference 2): highland falls — three terrace levels of wide grass, cliff
    // edges climbed by wide ramps, the river pouring over each step into a pool, thin dirt paths winding across
    id: "meadow", name: "바람초원", theme: "meadow", seed: 22021, w: 152, h: 102, r: 9.6, warp: 9, wind: 0.55, loops: 0.3, merge: 0.32, cliff: 0.15, gap: 2,
    tiers: 3, tierOpen: 0.6, ramp: 2, roadW: 3, pools: 2.6, widen: "TPBRulYAe",
    ground: ".", edge: "T", treeCh: "T", treeCh2: "B", road: "p", shore: "s", river: true, lakes: 4, lakeR: 5, vaults: 9, ruins: 3, tpm: 15.5,
    walls: [["trees", 0.42], ["hedge", 0.3], ["rocks", 0.28]], gates: [["west", "w", 0.5], ["east", "e", 0.5]], exit: "east",
    mobs: ["twinhare", "twinhare", "twinhare", "gutfrog", "gutfrog", "lambmaw", "eyecrow", "lambmaw", "eyecrow"], pondMob: "eyecrow", chest: "chest_meadow",
    vaultKinds: ["shrine", "circle", "bloom", "lookout", "cache", "menhir"], biomes: { plain: "plain" }, featureP: 0.6, features: ["pond", "boulders", "bigtree", "pen", "cairn", "logs", "stones"],
    // wet low ground flowers or grows tall; high ground is stony; dry ground is orchard or plain grass
    // by level: the valley floor wet and in flower, the middle shelves orchard and tall grass, the tops stony heath
    biome: (e, mo, r, t) => (t === 0 ? (mo > 0.5 ? (r < 0.7 ? "flowers" : "tallgrass") : r < 0.35 ? "tallgrass" : "plain")
      : t === 1 ? (mo < 0.42 ? (r < 0.6 ? "orchard" : "plain") : r < 0.5 ? "tallgrass" : "plain") : r < 0.55 ? "rocky" : "plain"),
    paint: (b, n1, n2) => (b === "rocky" ? (n1 > 0.6 ? "r" : n1 < 0.18 ? "p" : n2 > 0.6 ? "," : null) : b === "flowers" && n1 > 0.34 ? '"' : b === "tallgrass" && n1 > 0.4 ? "t" : b === "orchard" && n1 > 0.74 ? '"' : b === "plain" && n1 > 0.8 ? "t" : b === "plain" && n1 < 0.1 ? '"' : n2 > 0.66 ? "," : null),
    scatter: (b, h, n1) => (b === "orchard" ? (h < 0.05 ? "T" : h < 0.058 ? "u" : h < 0.063 ? "l" : null)
      : b === "rocky" ? (n1 > 0.55 && h < 0.09 ? "R" : h < 0.015 ? "B" : h < 0.025 ? "u" : null)
      : b === "flowers" ? (h < 0.03 ? "B" : h < 0.036 ? "T" : null)
      : b === "tallgrass" ? (h < 0.012 ? "T" : h < 0.02 ? "B" : null)
      : h < 0.018 ? "T" : h < 0.036 ? "B" : h < 0.043 ? "R" : h < 0.047 ? "u" : h < 0.05 ? "l" : null),
  }) },
  forest: { make: wilds, band: [8, 13], stones: 3, cfg: () => ({
    // maps-v2 (references 6 + 3): a mossy gorge — two levels of ledges, the stream in a cliff-sided cut crossed
    // by bridges and fords, tree clusters, and the forgotten temple's courtyard partway in
    id: "forest", name: "속삭임 숲", theme: "forest", bgm: "forest", seed: 33053, w: 152, h: 102, r: 8.2, warp: 10, wind: 0.6, loops: 0.18, merge: 0.18, cliff: 0.22, gap: 2,
    tiers: 3, tierOpen: 0.12, ramp: 2, roadW: 3, gorge: { first: 16, every: 30 }, temple: {}, stoneFr: [0.36, 0.8], widen: "TPBRulYAe",
    ground: ":", edge: "P", treeCh: "P", treeCh2: "T", road: "p", shore: null, river: true, lakes: 2, lakeR: 4, vaults: 9, ruins: 5, tpm: 15.5, stair: "crypt",
    walls: [["trees", 0.5], ["bramble", 0.2], ["ruin", 0.12], ["rocks", 0.18]], gates: [["west", "w", 0.5], ["north", "n", 0.86], ["east", "e", 0.7]], exit: "north",
    mobs: ["splitboar", "ribdeer", "hydrasnake", "foxtwine", "mothface"], pondMob: null, chest: "chest_forest",
    vaultKinds: ["deadgrove", "ring", "shrine", "lookout", "menhir", "cache"], biomes: { plain: "glade" }, featureP: 0.6, features: ["pond", "boulders", "ring", "dead", "logs", "stones", "cairn"],
    // the wettest hollows are bog, the heights fern and rock; elsewhere pine, with glades and old birch groves
    biome: (e, mo, r) => (mo > 0.64 ? "bog" : e > 0.68 ? "fern" : r < 0.22 ? "glade" : r < 0.38 ? "birch" : "pine"),
    paint: (b, n1, n2) => (b === "bog" ? (n1 > 0.8 ? "w" : n1 > 0.56 ? "j" : n2 > 0.55 ? ";" : null) : b === "glade" ? (n1 > 0.56 ? '"' : n2 > 0.7 ? ";" : null) : b === "fern" ? (n1 > 0.35 ? ";" : null) : n2 > 0.62 ? ";" : null),
    scatter: (b, h, n1) => (b === "bog" ? (h < 0.03 ? "A" : h < 0.04 ? "Y" : h < 0.05 ? "P" : null)
      : b === "glade" ? (h < 0.016 ? "Y" : h < 0.028 ? "u" : h < 0.036 ? "l" : h < 0.05 ? "P" : null)
      : b === "birch" ? (h < 0.05 ? "T" : h < 0.058 ? "q" : h < 0.064 ? "u" : null)
      : b === "fern" ? (h < 0.04 ? "P" : h < 0.055 ? "B" : h < 0.065 ? "R" : null)
      : (n1 > 0.55 ? h < 0.24 : h < 0.09) ? "P" : h < 0.1 ? "B" : h < 0.107 ? "l" : h < 0.113 ? "u" : null),
  }) },
  cave: { make: cavern, band: [24, 32], stones: 3, theme: "cave", kinds: ["boss"], cfg: () => ({
    id: "cave", name: "수정 동굴", seed: 44093, w: 132, h: 100, r: 8, vaults: 10, tpm: 16, chest: "chest_cave",
    // maps-v2 비취 수정굴: the moss way (sites `r` apart, half-width `w`), shelves where the swell passes `shelf`
    // dungeon widening (`wide`): bigger caverns (`fill`), pillars only in the biggest halls, the moss way 9 wide
    moss: { r: 15, w: 4, wind: 0.55, loops: 0.55, shelf: [0.63, 0.77], rings: 7, stream: 0.018 }, wide: { fill: 0.55, plant: 0, pillar: [6, 0.74], ridges: [[24, 27, 13, 2.5, 41, 11], [38, 68, 10, 2.5, 69, 94]] },
    // maps-v2 M3: a crack in the south wall climbs out to the desert (the oasis)
    south: 0.52,
    mobs: ["spiderhand", "splitboar_frost", "moleworm", "owlstare", "hydrasnake_steel", "bearmaw"],
  }) },
  city: { make: metro, band: [14, 21], stones: 3, theme: "city", cfg: () => ({
    id: "city", name: "네온 시티", seed: 55071, bgm: "city", w: 152, h: 102, gate: "east", gateY: 0.5, south: 0.3, stair: "sewer", wind: 0.5, loops: 0.14, tpm: 5.5,
    mobs: ["pigeonmass", "gutfrog_poison", "doghead", "squidrat", "catsplit", "fishwalker"], chest: "chest_city",
  }) },
  // the dungeons: each grown its own way, with its own inhabitants and its own furniture
  crypt: { make: catacomb, band: [12, 17], stones: 3, cfg: () => ({
    // maps-v2 벽돌 회랑 (`halls`): plazas ≥ 11 × 9 in cells ≥ 14 × 12, corridors three wide, more loops
    id: "crypt", name: "뼈의 지하묘지", theme: "crypt", seed: 66017, w: 132, h: 102, min: 17, minH: 13, leaf: 620, entryY: 0.8, wind: 0.6, loops: 0.3, out: true, n: 3,
    // dungeon widening: rooms ≥ 15 × 11 (`room`), ways 5 wide on the critical path, 4 elsewhere, 3 to an ossuary
    halls: true, soft: "12345I", room: [15, 11], ways: [5, 4, 3],
    shapes: ["plain", "chapel", "cross", "octagon", "ell", "chapel", "cross"], styles: ["pillars", "pool", "rows", "rubble", "shrine", "plain", "plain"], vaultName: "ossuary",
    mobs: ["ratking", "twinhare_bone", "bonehound", "toadbrood", "batcluster"], guard: "bonehound", chest: "chest_crypt",
    dress: { wall: [["2", 0.1], ["3", 0.09]], floor: [["1", 0.02], ["4", 0.03], ["5", 0.01]], pillar: "5", rows: "1", junk: "4", ring: "3", vault: "4", light: "3" },
  }) },
  sewer: { make: sewers, band: [22, 27], stones: 3, cfg: () => ({
    // maps-v2 벽돌 회랑 (`halls`): flagstone plazas, channel tunnels with a walkway three wide, dry side ways
    id: "sewer", name: "하수도", theme: "sewer", seed: 77029, w: 152, h: 102, r: 25, wind: 0.5, loops: 0.55, n: 3,
    // dungeon widening (`plaza`): plazas 15 × 11 to 21 × 15, walkways 5 wide on the critical path and 4 elsewhere
    halls: true, soft: "67x4n", light: "3", plaza: true, dead: 4,
    mobs: ["leechmaw", "ratking_bile", "gatorhalf", "crabskull", "eelknot"], guard: "gatorhalf", chest: "chest_sewer",
  }) },
  // 단풍 왕도: the forest that grew over a fallen kingdom, east of the whispering wood. Its royal road runs from the
  // wood to the chasm that swallowed the capital (a ledge down into the abyss, behind the mother). Crimson maple
  // groves on red litter, golden stands on gold, pine on the heights, clearings, and hollows where the blight fruits
  maple: { make: wilds, band: [40, 46], stones: 3, npcs: [["hermit", "은자 바스"]], after: hermitAt, cfg: () => ({
    id: "maple", name: "단풍 왕도", theme: "autumn", bgm: "autumn", seed: 99067, w: 160, h: 112, r: 9.4, padMin: 1, warp: 10, wind: 0.62, loops: 0.12, merge: 0.22, cliff: 0.2, gap: 2,
    ground: ".", edge: "T", treeCh: "T", treeCh2: "P", road: "=", trail: "p", shore: "%", river: true, lakes: 2, lakeR: 4, vaults: 10, ruins: 4, tpm: 15,
    walls: [["trees", 0.48], ["ruin", 0.2], ["rocks", 0.14], ["bramble", 0.18]], gates: [["west", "w", 0.56], ["east", "e", 0.3]], exit: "east",
    mobs: ["blightsquirrel", "stumpmaw", "crowscare", "shroomboar", "gravrose"], pondMob: null, chest: "chest_maple",
    campPiece: "cottage", lair: { piece: "chapel", guard: "rotstag", pack: "rotstag" },
    vaultKinds: ["graveyard", "watchtower", "kinggate", "leafmound", "scarefield", "treetunnel"],
    vaultMobs: { graveyard: "gravrose", scarefield: "crowscare", leafmound: "shroomboar", treetunnel: "stumpmaw" },
    biomes: { plain: "clearing" }, featureP: 0.7, features: ["leafpile", "statue", "banners", "graves", "shrooms", "logs", "boulders", "dead", "stones"],
    biome: (e, mo, r) => (mo > 0.62 ? "hollow" : e > 0.66 ? "pine" : r < 0.22 ? "clearing" : r < 0.5 ? "gold" : "maple"),
    paint: (b, n1, n2) => (b === "maple" ? (n1 > 0.42 ? "%" : n2 > 0.7 ? "," : null)
      : b === "gold" ? (n1 > 0.42 ? ";" : n2 > 0.72 ? "," : null)
      : b === "clearing" ? (n1 > 0.64 ? "%" : n1 < 0.16 ? '"' : n2 > 0.74 ? "t" : null)
      : b === "hollow" ? (n1 > 0.7 ? "&" : n1 > 0.48 ? "j" : n2 > 0.6 ? "%" : null)
      : n2 > 0.6 ? ":" : null),
    scatter: (b, h, n1) => (b === "maple" ? ((n1 > 0.5 ? h < 0.24 : h < 0.1) ? "T" : h < 0.095 ? "B" : h < 0.1 ? "u" : h < 0.104 ? "l" : null)
      : b === "gold" ? ((n1 > 0.55 ? h < 0.2 : h < 0.09) ? "T" : h < 0.08 ? "B" : h < 0.086 ? "R" : null)
      : b === "pine" ? ((n1 > 0.5 ? h < 0.22 : h < 0.09) ? "P" : h < 0.1 ? "R" : h < 0.11 ? "B" : h < 0.114 ? "u" : null)
      : b === "hollow" ? (h < 0.03 ? "Y" : h < 0.045 ? "A" : h < 0.055 ? "T" : h < 0.06 ? "u" : null)
      : h < 0.03 ? "T" : h < 0.038 ? "u" : h < 0.046 ? "B" : h < 0.05 ? "l" : null),
  }) },
  // ── the south-west coast (maps-v2 M3, docs/design/maps-v2.md A.7–A.9): city → jungle road → coral coast → oasis → cave
  // 정글 해안도로: a made road, three of asphalt between yellow edge lines, winds from the city's south gate down
  // through dense jungle; the west side is a strand of black boulders and the deep sea; old shrines and stone rings in the dead ends
  jungle: { make: wilds, band: [20, 26], stones: 3, cfg: () => ({
    id: "jungle", name: "정글 해안도로", theme: "jungle", bgm: "forest", seed: 31337, w: 168, h: 112, r: 8.8, warp: 10, wind: 0.8, loops: 0.2, merge: 0.2, cliff: 0.2, gap: 2,
    tiers: 2, tierOpen: 0.15, ramp: 2, roadEdge: "m", stoneFr: [0.36, 0.8], widen: "TPBRulYAeΨΩΦ",
    sea: { side: "w", at: 17, amp: 5, surf: 2, shallow: 0, beach: 4, sand: "r", rock: "Ω", rockP: 0.2, reef: 0 },
    ground: ":", edge: "T", treeCh: "T", treeCh2: "Ψ", road: "a", trail: "p", shore: "s", river: false, lakes: 4, lakeR: 5, vaults: 9, ruins: 4, tpm: 15.5,
    walls: [["trees", 0.6], ["bramble", 0.15], ["ruin", 0.1], ["rocks", 0.15]], rocks: ["Ω", "R"], gates: [["north", "n", 0.72], ["south", "s", 0.34]], exit: "south",
    mobs: ["catsplit_gold", "toadbrood_poison", "hydrasnake_poison", "mothface_bile", "ribdeer_bile"], pondMob: null, chest: "chest_jungle",
    vaultKinds: ["shrine", "ring", "circle", "cache", "menhir", "cove"], biomes: { plain: "glade" }, featureP: 0.6, features: ["pond", "boulders", "ring", "logs", "stones", "cairn", "bigtree"],
    // wet hollows are swamp; elsewhere deep jungle, with palm groves and glades
    biome: (e, mo, r) => (mo > 0.62 ? "swamp" : r < 0.2 ? "glade" : r < 0.45 ? "palm" : "deep"),
    paint: (b, n1, n2) => (b === "swamp" ? (n1 > 0.8 ? "w" : n1 > 0.56 ? "j" : ";") : b === "glade" ? (n1 > 0.6 ? '"' : n2 > 0.7 ? "t" : ".") : b === "palm" ? (n2 > 0.6 ? "," : ".") : n1 > 0.4 ? ";" : null),
    scatter: (b, h, n1) => (b === "swamp" ? (h < 0.03 ? "A" : h < 0.045 ? "Y" : h < 0.07 ? "Ψ" : null)
      : b === "glade" ? (h < 0.02 ? "Ψ" : h < 0.03 ? "u" : h < 0.045 ? "B" : null)
      : b === "palm" ? (h < 0.11 ? "Ψ" : h < 0.14 ? "B" : h < 0.146 ? "l" : null)
      : (n1 > 0.5 ? h < 0.26 : h < 0.1) ? "T" : h < 0.3 && n1 > 0.5 ? "Ψ" : h < 0.12 ? "B" : h < 0.126 ? "l" : null),
  }) },
  // 모래바람 오아시스: dunes in three levels of sand, ridges for cliffs; lakes ringed by grass, reeds and palms, mud-hut
  // hamlets in the dead ends, a caravan's camp on the way; the north pass climbs to the crystal cave
  oasis: { make: wilds, band: [28, 34], stones: 3, cfg: () => ({
    id: "oasis", name: "모래바람 오아시스", theme: "desert", bgm: "field", seed: 52711, w: 168, h: 116, r: 10.2, warp: 9, wind: 0.55, loops: 0.28, merge: 0.3, cliff: 0.16, gap: 2,
    tiers: 3, tierOpen: 0.55, ramp: 2, roadW: 3, widen: "TPBRulYAeΨΩΦ", green: { r: 3, palm: 0.2 },
    ground: "s", edge: "C", treeCh: "Ψ", treeCh2: "A", road: "p", shore: "t", river: false, lakes: 6, lakeR: 7, vaults: 9, ruins: 4, tpm: 15.5,
    walls: [["rocks", 0.6], ["ruin", 0.2], ["palms", 0.2]], rocks: ["R", "A"], gates: [["west", "w", 0.55], ["north", "n", 0.7]], exit: "north",
    mobs: ["foxtwine_gold", "hydrasnake_gold", "lambmaw_bone", "eyecrow_ash", "twingoat_gold", "bearmaw_gold"], pondMob: "eyecrow_ash", chest: "chest_oasis",
    campPiece: "caravan", vaultKinds: ["hamlet", "drywell", "menhir", "palmring", "cache", "hamlet"], biomes: { plain: "flat" }, featureP: 0.65, features: ["pond", "boulders", "cairn", "stones", "dead"],
    // by level: scrub and flats below, rippled dunes on the middle shelves, bare stony ridges on top
    biome: (e, mo, r, t) => (t === 2 ? "ridge" : t === 1 ? (r < 0.55 ? "dune" : "flat") : mo > 0.55 ? "scrub" : "flat"),
    paint: (b, n1, n2) => (b === "ridge" ? (n1 > 0.45 ? "z" : n1 < 0.15 ? "r" : null) : b === "dune" ? (n1 > 0.5 ? "z" : null) : b === "scrub" ? (n1 > 0.72 ? "," : n2 > 0.76 ? "z" : null) : n2 > 0.8 ? "z" : null),
    scatter: (b, h) => (b === "ridge" ? (h < 0.03 ? "R" : h < 0.04 ? "A" : null)
      : b === "dune" ? (h < 0.012 ? "A" : h < 0.02 ? "R" : null)
      : b === "scrub" ? (h < 0.04 ? "B" : h < 0.058 ? "Ψ" : h < 0.068 ? "A" : null)
      : h < 0.008 ? "Ψ" : h < 0.018 ? "R" : h < 0.024 ? "A" : null),
  }) },
  // 산호 해안: the dunes run down to a white beach; the whole south is sea — a surf line, then wide turquoise
  // shallows you can wade (reef rocks, sand islets with palms, sand bars where the ways cross, deep holes), then deep water
  coast: { make: wilds, band: [34, 40], stones: 3, cfg: () => ({
    id: "coast", name: "산호 해안", theme: "coast", bgm: "field", seed: 41519, w: 176, h: 120, r: 9.6, warp: 9, wind: 0.85, loops: 0.3, merge: 0.4, cliff: 0.2, gap: 2,
    tiers: 3, tierOpen: 0.15, ramp: 2, roadW: 3, widen: "TPBRulYAeΨΩΦ",
    sea: { side: "s", at: 42, amp: 6, surf: 2, shallow: 26, beach: 7, sand: "S", bar: "S", reef: 0.16 },
    ground: "S", edge: "T", treeCh: "Ψ", treeCh2: "T", road: "p", shore: "S", river: false, lakes: 2, lakeR: 4, vaults: 9, ruins: 3, tpm: 15.5,
    walls: [["palms", 0.45], ["rocks", 0.35], ["trees", 0.2]], rocks: ["Ω", "R"], gates: [["north", "n", 0.16], ["east", "e", 0.5]], exit: "east",
    mobs: ["crabskull_blood", "fishwalker_frost", "eelknot_frost", "squidrat_blood", "leechmaw_bone", "gatorhalf_steel"], pondMob: null, chest: "chest_coast",
    vaultKinds: ["palmring", "tidepool", "cove", "cache", "menhir", "lookout"], biomes: { plain: "beach" }, featureP: 0.6, features: ["boulders", "logs", "cairn", "stones", "pond"],
    // the upper level is dune and palm grove (the jungle's edge), the lower the open beach
    biome: (e, mo, r, t) => (t === 1 ? (r < 0.5 ? "dune" : "grove") : mo > 0.6 ? "grove" : "beach"),
    paint: (b, n1, n2) => (b === "dune" ? (n1 > 0.5 ? "z" : n2 > 0.72 ? "," : null) : b === "grove" ? (n1 > 0.35 ? "." : n2 > 0.6 ? "," : null) : n2 > 0.82 ? "z" : null),
    scatter: (b, h, n1) => (b === "grove" ? ((n1 > 0.5 ? h < 0.2 : h < 0.08) ? "Ψ" : h < 0.1 ? "B" : h < 0.11 ? "T" : null)
      : b === "dune" ? (h < 0.015 ? "Ψ" : h < 0.03 ? "B" : h < 0.04 ? "Ω" : null)
      : h < 0.02 ? "Ψ" : h < 0.028 ? "l" : h < 0.034 ? "Ω" : null),
  }) },
  abyss: { make: abyssal, band: [32, 40], stones: 3, cfg: () => ({
    id: "abyss", name: "피의 심연", theme: "abyss", seed: 88041, w: 152, h: 120, r: 16, wind: 0.55, loops: 0.3, n: 7, boss: "abyssboss", out: true,
    // dungeon widening (`plate`): islands are plates of flesh `r`…`r + vary` across the half, cracks of blood `gap` wide
    plate: { r: 14, vary: 3, gap: 2.6, gapVary: 2.6, soft: "804" },
    mobs: ["twingoat", "bonehound_ash", "horsehalf", "batcluster_blood", "lionhand", "serpentwing", "sowseer", "doghead_fire"], guard: "horsehalf", chest: "chest_abyss",
  }) },
};
/** A hermit keeps the maple cottage fire. */
function hermitAt(maple) {
  if (!maple.camp) return;
  const [fx, fy] = FIRES.maple[0];
  const at = [[2, 0], [-2, 0], [0, 2], [2, 1], [-2, 1], [1, 2], [-1, 2]].map(([dx, dy]) => [fx + dx, fy + dy]).find(([x, y]) => maple.o[y][x] === " " && !SOLID_G.includes(maple.g[y][x]));
  if (at) maple.npcs.push({ id: "hermit", name: "은자 바스", role: "talk", x: at[0], y: at[1], look: [2, 4, 0, "#8a5a2a"],
    say: "이 숲은 옛 단풍 왕국의 왕도였지. 심연이 열리던 밤 왕성은 통째로 가라앉고, 남은 것들은 보랏빛 병에 물들었다네. 무너진 예배당엔 왕관 쓴 사슴이 지키고 있으니, 불을 쬐고 가게." });
}
/** Every monster kind a generated map places, read from its settings alone (the map tests check it against the built map). */
function genKinds(id) {
  const g = GEN[id], c = g.cfg();
  const ks = [...c.mobs, c.pondMob, c.guard, c.lair && c.lair.guard, c.lair && c.lair.pack, ...Object.values(c.vaultMobs || {}), c.boss, ...(g.kinds || []), c.chest];
  return [...new Set(ks.filter((k) => k && Object.hasOwn(MOBS, k)))];
}
/**
 * Doors between the worlds, [a, gate of a, b, gate of b, both ways]: stepping on a gate tile of
 * `a` puts you beside gate `gb` of `b` (and back, unless the door is one way). A door holds only
 * the gate's name; the tile you arrive on is looked up when you go through (arrivalOf), so
 * building one map never builds its neighbours.
 */
const GATE_LINKS = [
  ["town", "east", "meadow", "west", 1], ["town", "west", "city", "east", 1], ["meadow", "east", "forest", "west", 1],
  ["forest", "north", "cave", "west", 1], ["forest", "crypt", "crypt", "in", 1], ["city", "sewer", "sewer", "in", 1],
  ["cave", "rift", "abyss", "in", 1], ["forest", "east", "maple", "west", 1], ["maple", "east", "abyss", "out", 1],
  ["crypt", "out", "forest", "crypt", 0], ["sewer", "out", "city", "sewer", 0],
  // the south-west coast: the city's south gate, down the jungle road to the sea, inland over the dunes, up into the cave
  ["city", "south", "jungle", "north", 1], ["jungle", "south", "coast", "north", 1], ["coast", "east", "oasis", "west", 1], ["oasis", "north", "cave", "south", 1],
];
/** A generated map's own doors out (in GATE_LINKS order, as the generators always laid them). */
function gateDoors(m) {
  const add = (ga, to, gb) => { for (let k = 0; k < 2; k++) { const [x, y] = m.gates[ga].t[k]; portal(m, x, y, to, undefined, undefined); m.portals[m.portals.length - 1] = { x, y, to, gate: gb, k }; } };
  for (const [a, ga, b, gb, both] of GATE_LINKS) {
    if (a === m.id) add(ga, b, gb);
    if (both && b === m.id) add(gb, a, ga);
  }
}
/** A door's label: where it leads and how strong you should be to go there (from MAP_META, nothing built). */
const labelOf = (id) => doorName(MAP_META[id]);
/**
 * One generated map, built from its settings (rows still arrays; 36-custom-maps.js finalizes it):
 * terrain, doors, its zones and who lives in each, then the waypoint stones and signposts along its routes.
 */
function genMap(id) {
  const g = GEN[id];
  FIRES[id] = [];
  const cfg = g.cfg();
  const m = g.make(cfg);
  if (g.after) g.after(m);
  m.band = g.band.slice();
  gateDoors(m);
  // zones by how far in, then who lives in each (33-maps-zones.js)
  zoneMap(m);
  zoneSpawns(m, cfg);
  m.stonesWant = g.stones || 1;
  const lo = m.band[0];
  // the way on is the next step up, not a door far beyond the ground's own level (the wood's door to the old kingdom)
  markRoutes(m, labelOf, (to) => { const b = MAP_META[to] && MAP_META[to].band; return b && b[0] > lo && b[0] <= lo + 20 ? b[0] : 0; });
  // maps-v2: once the signs and stones stand, the ways that must stay three wide are checked once more
  // (underground the stones' own standing tiles are joined too: the rock may be dug for them)
  if (m.keepWide) widen(m, m.widenDig ? m.keepWide.concat((m.stones || []).map((s) => [s.ax, s.ay])) : m.keepWide, m.widenSoft, m.widenDig);
  // a pocket is the ground still open in it once the signs and stones stand
  for (const pk of m.pockets) pk.tiles = pk.tiles.filter((i) => m.o[Math.floor(i / m.w)][i % m.w] === " ");
  return m;
}
/**
 * Waypoint stone and signposts for a hunting ground. The route a player walks
 * from the entrance to the way on (the deepest door, or the boss) is the
 * critical path: the waypoint stands beside it a dozen steps in, signposts at
 * junctions along it point on, and where the way to a camp or a second door
 * turns off, a signpost marks the turn. Nothing placed may cut anything off.
 */
function markRoutes(m, labelOf, deeper) {
  const W = m.w, H = m.h;
  m.marks = m.marks || [];
  const open = (x, y) => inMap(m, x, y) && m.o[y][x] === " " && !SOLID_G.includes(m.g[y][x]);
  const flood = (sx, sy) => {
    const d = new Int32Array(W * H).fill(-1), prev = new Int32Array(W * H).fill(-1);
    const q = [sy * W + sx];
    d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i - x) / W, di = d[i] + 1;
      if (open(x + 1, y) && d[i + 1] < 0) { d[i + 1] = di; prev[i + 1] = i; q.push(i + 1); }
      if (open(x - 1, y) && d[i - 1] < 0) { d[i - 1] = di; prev[i - 1] = i; q.push(i - 1); }
      if (open(x, y + 1) && d[i + W] < 0) { d[i + W] = di; prev[i + W] = i; q.push(i + W); }
      if (open(x, y - 1) && d[i - W] < 0) { d[i - W] = di; prev[i - W] = i; q.push(i - W); }
    }
    return { d, prev, count: q.length };
  };
  const [ex, ey] = m.entry;
  const base = flood(ex, ey);
  let reach = base.count;
  /** The walk from the entrance to the reachable tile nearest (tx, ty), as tile indexes. */
  const route = (tx, ty) => {
    let best = -1, bd = 1e9;
    for (let y = Math.max(0, ty - 4); y <= Math.min(H - 1, ty + 4); y++) for (let x = Math.max(0, tx - 4); x <= Math.min(W - 1, tx + 4); x++) {
      const i = y * W + x;
      if (base.d[i] < 0) continue;
      const dd = Math.abs(x - tx) + Math.abs(y - ty);
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best < 0) return null;
    const out = [];
    for (let i = best; i >= 0; i = base.prev[i]) out.push(i);
    return out.reverse();
  };
  // where a player might be heading: every door out (not the one they came in by), the boss, a camp
  const dests = [], doors = new Set();
  for (const pt of m.portals) {
    if (doors.has(pt.to)) continue;
    const path = route(pt.x, pt.y);
    if (!path || path.length < 8) continue;
    doors.add(pt.to);
    dests.push({ to: pt.to, label: labelOf(pt.to), path, rank: deeper(pt.to) });
  }
  const bossSp = m.spawns.find((sp) => MOBS[sp.k].boss);
  if (bossSp && !dests.some((d) => d.rank > 0)) {
    const path = route(Math.round((bossSp.r[0] + bossSp.r[2]) / 2), Math.round((bossSp.r[1] + bossSp.r[3]) / 2));
    if (path) dests.push({ to: null, label: MOBS[bossSp.k].name, path, rank: 99 });
  }
  if (!dests.length) return;
  // the way on: the door to the strongest place, else the farthest
  const main = dests.slice().sort((a, b) => b.rank - a.rank || b.path.length - a.path.length)[0];
  const others = dests.filter((d) => d !== main);
  if (FIRES[m.id].length) {
    const [fx, fy] = FIRES[m.id][0];
    const path = route(fx, fy);
    if (path) others.push({ to: null, label: "야영지 · 모닥불", path, camp: [fx, fy] });
  }
  const C = main.path, onPath = new Set();
  for (const d of [main, ...others]) for (const i of d.path) onPath.add(i);
  const busy = (x, y) => {
    for (const pt of m.portals) if (Math.abs(pt.x - x) <= 2 && Math.abs(pt.y - y) <= 2) return true;
    for (const [fx, fy] of FIRES[m.id]) if (Math.abs(fx - x) <= 1 && Math.abs(fy - y) <= 1) return true;
    // a chest or a boss stands on one exact square: never plant a sign on (or right beside) it
    for (const sp of m.spawns) if (sp.r[0] === sp.r[2] && sp.r[1] === sp.r[3] && Math.abs(sp.r[0] - x) <= 1 && Math.abs(sp.r[1] - y) <= 1) return true;
    return m.marks.some((k) => Math.abs(k.x - x) <= 2 && Math.abs(k.y - y) <= 2);
  };
  /**
   * A cheap proof that blocking (x, y) cuts nothing off: its open side neighbours still
   * reach one another around it, within the 3×3 square. (When they don't, flood to be sure.)
   */
  const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const ringJoined = (x, y) => {
    const on = RING.map(([dx, dy]) => open(x + dx, y + dy));
    let seen = 0, start = -1;
    for (let k = 1; k < 8; k += 2) if (on[k]) { if (start < 0) start = k; seen++; }
    if (seen <= 1) return true;
    // walk the ring both ways from one open side, through open squares only (sides step to corners and back)
    const got = new Array(8).fill(false), stack = [start];
    got[start] = true;
    while (stack.length) {
      const k = stack.pop();
      for (const n of [(k + 1) & 7, (k + 7) & 7]) if (on[n] && !got[n]) { got[n] = true; stack.push(n); }
    }
    for (let k = 1; k < 8; k += 2) if (on[k] && !got[k]) return false;
    return true;
  };
  // maps-v2: a generator that keeps its ways three tiles wide (m.keepWide: the points they must join) gets its
  // signs and stones only where every one of those points still joins the entrance's wide ground
  // (`m.widenR`: the half-width those ways keep — 1 = three tiles, 2 = five, the widened dungeons)
  let homeNow = null;
  const WR = m.widenR || 1;
  const wideOk = !m.keepWide ? null : () => {
    const n = W * H, home = new Uint8Array(n);
    // (blocked tiles summed over the map: "is the square round this tile clear" is then four lookups)
    const SW = W + 1, sum = new Int32Array(SW * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { if (!open(x, y)) row++; sum[(y + 1) * SW + x + 1] = sum[y * SW + x + 1] + row; } }
    const isWide = (i) => { const x = i % W, y = (i - x) / W; return x >= WR && y >= WR && x < W - WR && y < H - WR && sum[(y + WR + 1) * SW + x + WR + 1] - sum[(y - WR) * SW + x + WR + 1] - sum[(y + WR + 1) * SW + x - WR] + sum[(y - WR) * SW + x - WR] === 0; };
    const near = (px, py) => { const o = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inMap(m, px + dx, py + dy)) o.push((py + dy) * W + px + dx); return o; };
    const st = near(ex, ey).filter(isWide);
    for (const i of st) home[i] = 1;
    while (st.length) { const i = st.pop(), x = i % W; for (const j of [x + 1 < W ? i + 1 : -1, x > 0 ? i - 1 : -1, i + W < n ? i + W : -1, i - W]) if (j >= 0 && !home[j] && isWide(j)) { home[j] = 1; st.push(j); } }
    homeNow = home;
    return m.keepWide.map(([px, py]) => near(px, py).some((i) => home[i]));
  };
  const wideWas = wideOk ? wideOk() : null;
  // only an object touching the wide ground can narrow it: anywhere else there is nothing to check
  const touchesWide = (x, y) => { for (let dy = -WR; dy <= WR; dy++) for (let dx = -WR; dx <= WR; dx++) if (inMap(m, x + dx, y + dy) && homeNow[(y + dy) * W + x + dx]) return true; return false; };
  const wideAt = (i) => { const x = i % W, y = (i - x) / W; for (let dy = -WR; dy <= WR; dy++) for (let dx = -WR; dx <= WR; dx++) if (!open(x + dx, y + dy)) return false; return true; };
  // the object (already set down at x, y) narrows nothing if the wide ground round it, two and three steps
  // out, still holds together inside the 7 × 7 square; near a point that must stay joined, look at the whole map
  const keepsWide = (x, y) => {
    if (!wideOk || !touchesWide(x, y)) return true;
    let fine;
    if (m.keepWide.some(([px, py]) => Math.abs(px - x) <= 4 && Math.abs(py - y) <= 4)) {
      fine = wideOk().every((v, k) => v || !wideWas[k]);
      if (!fine) { const o = m.o[y][x]; m.o[y][x] = " "; wideOk(); m.o[y][x] = o; }
      return fine;
    }
    const win = [], ring = [];
    for (let dy = -2 * WR - 1; dy <= 2 * WR + 1; dy++) for (let dx = -2 * WR - 1; dx <= 2 * WR + 1; dx++) {
      const X = x + dx, Y = y + dy, i = Y * W + X;
      if (!inMap(m, X, Y) || !homeNow[i] || !wideAt(i)) continue;
      win.push(i);
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= WR + 1) ring.push(i);
    }
    if (!ring.length) return true;
    const inWin = new Set(win), got = new Set([ring[0]]), st = [ring[0]];
    while (st.length) { const i = st.pop(); for (const j of [i + 1, i - 1, i + W, i - W]) if (inWin.has(j) && !got.has(j)) { got.add(j); st.push(j); } }
    fine = ring.every((i) => got.has(i));
    // (five wide: the window is big enough to hold the far side of a wall or a channel, which was never joined
    // inside it — the object is fine if it leaves the wide ground in no more pieces than it found)
    if (!fine && WR > 1) {
      const parts = () => {
        const tiles = new Set(), seen = new Set();
        for (let dy = -2 * WR - 1; dy <= 2 * WR + 1; dy++) for (let dx = -2 * WR - 1; dx <= 2 * WR + 1; dx++) { const X = x + dx, Y = y + dy; if (inMap(m, X, Y) && homeNow[Y * W + X] && wideAt(Y * W + X)) tiles.add(Y * W + X); }
        let n = 0;
        for (const s0 of tiles) {
          if (seen.has(s0)) continue;
          const q = [s0]; seen.add(s0); let far = false;
          while (q.length) { const i = q.pop(); if (Math.max(Math.abs(i % W - x), Math.abs(Math.floor(i / W) - y)) >= WR + 1) far = true; for (const j of [i + 1, i - 1, i + W, i - W]) if (tiles.has(j) && !seen.has(j)) { seen.add(j); q.push(j); } }
          if (far) n++;
        }
        return n;
      };
      const after = parts(), o = m.o[y][x];
      m.o[y][x] = " ";
      fine = after <= parts();
      m.o[y][x] = o;
    }
    if (fine) for (let dy = -WR; dy <= WR; dy++) for (let dx = -WR; dx <= WR; dx++) { const X = x + dx, Y = y + dy; if (inMap(m, X, Y) && !wideAt(Y * W + X)) homeNow[Y * W + X] = 0; }
    return fine;
  };
  /** Is the walk at this tile on the entrance's wide ground (or within two steps of it)? */
  const onWide = (i) => { if (!homeNow) return true; const x = i % W, y = (i - x) / W; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inMap(m, x + dx, y + dy) && homeNow[(y + dy) * W + x + dx]) return true; return false; };
  const AROUND = [[0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  const AROUND2 = AROUND.concat([[0, -2], [2, 0], [-2, 0], [0, 2], [2, -1], [-2, 1], [1, 2], [-1, -2]]);
  /** Put object `ch` beside the walk at index-tile `at`, where it blocks nothing. */
  const place = (at, ch) => {
    const ax = at % W, ay = (at - ax) / W;
    for (const [dx, dy] of wideOk ? AROUND2 : AROUND) {
      const x = ax + dx, y = ay + dy, i = y * W + x;
      if (!open(x, y) || onPath.has(i) || base.d[i] < 0 || busy(x, y)) continue;
      m.o[y][x] = ch;
      if ((ringJoined(x, y) || flood(ex, ey).count === reach - 1) && keepsWide(x, y)) { reach--; return [x, y]; }
      m.o[y][x] = " ";
    }
    return null;
  };
  const arrow = (from, to) => {
    const fx = from % W, fy = (from - fx) / W, tx = to % W, ty = (to - tx) / W;
    const o = ((Math.round(Math.atan2(ty - fy, tx - fx) / (Math.PI / 4)) % 8) + 8) % 8;
    return ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"][o];
  };
  const forks = (i) => { const x = i % W, y = (i - x) / W; return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(x + dx, y + dy)).length; };
  // the waypoint, a dozen steps along the way on
  let k0 = -1;
  for (let k = Math.min(12, C.length - 2); k < Math.min(C.length - 1, 48); k++) {
    const at = place(C[k], "Q");
    if (!at) continue;
    WP[m.id] = { x: at[0], y: at[1], ax: C[k] % W, ay: Math.floor(C[k] / W), i: 0 };
    m.marks.push({ x: at[0], y: at[1], kind: "waypoint" });
    k0 = k;
    break;
  }
  if (m.zone && WP[m.id]) {
    // a big ground has more stones along the way on (a third and two thirds in, or halfway), each with
    // a wind shrine a few steps further on (33-maps-zones.js); a campfire burns in the plaza by the first
    m.stones = [WP[m.id]];
    m.shrines = [];
    const fr = m.stoneFr || (m.stonesWant >= 3 ? [1 / 3, 2 / 3] : m.stonesWant === 2 ? [0.5] : []);
    for (const f of fr) {
      const t = Math.round(C.length * f);
      for (let s = 0; s <= 60; s++) {
        const j = s % 2 ? t + (s + 1) / 2 : t - s / 2;
        if (j <= k0 + 10 || j >= C.length - 3 || !onWide(C[j])) continue;
        const at = place(C[j], "Q");
        if (!at) continue;
        const st = { x: at[0], y: at[1], ax: C[j] % W, ay: Math.floor(C[j] / W), i: m.stones.length };
        m.stones.push(st);
        m.marks.push({ x: at[0], y: at[1], kind: "waypoint" });
        for (let q = j + 3; q < Math.min(C.length - 2, j + 16); q++) { const sh = place(C[q], "/"); if (sh) { m.shrines.push(sh); break; } }
        break;
      }
    }
    // the plaza's fire: beside the way, a few steps past the stone, with room round it for the stumps
    const roomy = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!open(x + dx, y + dy)) return false; return true; };
    let lit = false;
    const ring = [];
    for (let r = 2; r <= 5; r++) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [-1, 1], [1, 1], [-1, -1]]) ring.push([dx * r, dy * r]);
    for (let k = Math.max(1, k0 - 8); k < Math.min(C.length - 1, k0 + 30) && !lit; k++) {
      const cx = C[k] % W, cy = Math.floor(C[k] / W);
      for (const [dx, dy] of ring) {
        const x = cx + dx, y = cy + dy, i = y * W + x;
        if (!inMap(m, x, y) || m.zone[i] !== Z_SAFE || base.d[i] < 0 || onPath.has(i) || !roomy(x, y) || busy(x, y)) continue;
        FIRES[m.id].push([x, y]);
        lit = true;
        break;
      }
    }
  }
  // signposts at junctions along the way on
  for (const frac of [0.33, 0.62, 0.86]) {
    const t = Math.round(C.length * frac);
    for (let s = 0; s <= 14; s++) {
      const j = s % 2 ? t + (s + 1) / 2 : t - s / 2;
      if (j < 10 || j > C.length - 5 || forks(C[j]) < 3) continue;
      const at = place(C[j], "G");
      if (!at) continue;
      m.marks.push({ x: at[0], y: at[1], kind: "sign", label: `${main.label} ${arrow(C[j], C[Math.min(j + 8, C.length - 1)])}`, to: main.to || undefined });
      break;
    }
  }
  // and where the way to a camp or another door turns off
  for (const d of others) {
    const P = d.path;
    let k = 0;
    while (k < P.length && k < C.length && P[k] === C[k]) k++;
    for (let a = Math.max(1, k - 1); a < Math.min(P.length - 3, k + 6); a++) {
      const at = place(P[a], "G");
      if (!at) continue;
      m.marks.push({ x: at[0], y: at[1], kind: "sign", label: `${d.label} ${arrow(P[a], P[Math.min(a + 8, P.length - 1)])}`, to: d.to || undefined });
      break;
    }
  }
  if (!m.zone) return;
  // where the way on crosses into the elite ground, a warning; at the mouth of each hidden pocket, a hint
  const into = C.findIndex((i) => m.zone[i] === Z_ELITE);
  if (into > 0) {
    for (let s = 0; s <= 16; s++) {
      const j = into - 2 - s;
      if (j < 1) break;
      const at = place(C[j], "G");
      if (!at) continue;
      m.marks.push({ x: at[0], y: at[1], kind: "sign", label: `엘리트 지대 · 정예 출몰 ${arrow(C[j], C[Math.min(j + 8, C.length - 1)])}` });
      break;
    }
  }
  for (const pk of m.pockets || []) {
    const [mx, my] = pk.mouth, [cx, cy] = pk.chests[0];
    const at = place(my * W + mx, "G");
    if (!at) continue;
    const o = ((Math.round(Math.atan2(cy - my, cx - mx) / (Math.PI / 4)) % 8) + 8) % 8;
    m.marks.push({ x: at[0], y: at[1], kind: "sign", label: `수상한 샛길 ${["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"][o]}` });
  }
}


// MAP_META, mapOf, START, HUNTED and COL_MOBS are made in 36-custom-maps.js, with the editor's maps laid over these.

function solidAt(m, px, py) {
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
  return m.solid[ty * m.w + tx] === 1;
}
/** Feet box: 8 wide, 6 tall, anchored at the bottom centre of the sprite. */
function canStand(m, x, y) {
  return !(solidAt(m, x - 4, y - 5) || solidAt(m, x + 4, y - 5) || solidAt(m, x - 4, y) || solidAt(m, x + 4, y));
}
function canFly(m, x, y) {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  if (tx < 2 || ty < 2 || tx >= m.w - 2 || ty >= m.h - 2) return false;
  return m.g[ty][tx] !== "W";
}

const doorName = (m) => (m.band ? `${m.name} Lv.${shownLv(m.band[0])}–${shownLv(m.band[1])}` : m.name);
function mapPayload(m) {
  // (a house's turns and floor, the town's "내 집" door: 64-housing.js homeWire)
  return homeWire(m, {
    id: m.id, name: m.name, w: m.w, h: m.h, g: m.g, o: m.o, big: m.big, safe: m.safe, bgm: m.bgm,
    theme: m.theme || null, band: m.band ? m.band.map(shownLv) : null, marks: m.marks || [],
    // a door names where it leads and how strong you should be to go there
    // (a house door, into or out of an interior, is drawn as a door, not a magic gate)
    // (labels come from MAP_META: describing a door never builds the map behind it)
    portals: m.portals.map((p) => { const t = MAP_META[p.to] || { name: p.to }; return m.theme === "interior" || t.theme === "interior" ? { x: p.x, y: p.y, to: p.label || doorName(t), door: 1 } : { x: p.x, y: p.y, to: p.label || doorName(t) }; }),
    npcs: m.npcs, style: m.style || null,
    // fires that always burn, with the stumps around them ({ x, y, seats: [[x, y]…] }, world pixels)
    camps: campsOf(m),
    // a zoned ground's zones by 4 × 4 block for the minimap (0 safe, 1 normal, 2 elite, 3 hidden, - none)
    zq: m.zq || null,
    // gathering nodes [kind 0 herb · 1 ore · 2 wood, grade 1–5, tx, ty] (life skills, 58-life.js lifeNodes)
    nodes: lifeNodes(m),
    // the art of the reworked maps (maps-v2 C), only on maps that have it: map art, no rules
    ...artWire(m),
  });
}
/**
 * Static map art for the client, once per map change: the cave's shelf levels (`lv`: runs of "<level><count>"
 * over the tiles row by row, joined by ","), mushroom rings [x, y], arched doorways [x, y, 1 = runs east–west],
 * torch alcoves [x, y], waterfalls [x, y, dir], river crossings [row, 1 = ford], the temple {x, y, w, h, pool}.
 */
function artWire(m) {
  const o = {};
  if (m.level) {
    const runs = [];
    let v = m.level[0], n = 0;
    for (let i = 0; i < m.level.length; i++) { if (m.level[i] === v) n++; else { runs.push(v + "" + n); v = m.level[i]; n = 1; } }
    runs.push(v + "" + n);
    o.lv = runs.join(",");
  }
  if (m.rings && m.rings.length) o.rings = m.rings;
  if (m.arches && m.arches.length) o.arches = m.arches;
  if (m.torches && m.torches.length) o.torches = m.torches;
  if (m.falls && m.falls.length) o.falls = m.falls;
  if (m.crossings && m.crossings.length) o.cross = m.crossings.map(([y, k]) => [y, k === "ford" ? 1 : 0]);
  if (m.temple) o.temple = m.temple;
  return o;
}

