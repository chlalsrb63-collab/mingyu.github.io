function buildTown() {
  const box = { seed: 1101 };
  const m = blank("town", "넥서스 광장", 40, 30, ".");
  m.safe = true;
  m.bgm = "town";
  m.entry = [20, 18];
  scatter(m, box, m.g, ",", 0.14, ".");
  scatter(m, box, m.g, '"', 0.04, ".");
  border(m, "T", 2);
  rect(m.g, 14, 10, 25, 19, "o");
  road(m, 26, 14, 39, 14, "p");
  road(m, 0, 14, 13, 14, "p");
  road(m, 19, 4, 19, 9, "p");
  road(m, 19, 20, 19, 25, "p");
  road(m, 9, 9, 9, 14, "p");
  road(m, 29, 8, 29, 14, "p");
  road(m, 9, 14, 9, 20, "p");
  house(m, 8, 5, 0);
  house(m, 27, 4, 1);
  house(m, 7, 21, 5);
  house(m, 28, 20, 3);
  house(m, 17, 2, 2);
  rect(m.o, 19, 14, 20, 15, "a");
  m.big.push({ t: "fountain", x: 19, y: 14 });
  for (const [x, y] of [[14, 10], [25, 10], [14, 19], [25, 19]]) m.o[y][x] = "L";
  for (let x = 4; x <= 12; x++) if (x !== 9 && x !== 10) m.o[26][x] = "F";
  for (const [x, y] of [[5, 12], [33, 9], [5, 17], [23, 24], [13, 5], [24, 6]]) m.o[y][x] = "B";
  for (const [x, y] of [[32, 13], [6, 13]]) m.o[y][x] = "G";
  // the market corner by the supply shop: stacked goods and a stall's awning
  for (const [x, y] of [[12, 8], [13, 8], [12, 10], [7, 9], [6, 10]]) m.o[y][x] = "B";
  m.o[10][13] = "E";
  // a pond to fish in, with a plank dock out over the water and reeds along the far bank
  for (let y = 16; y <= 21; y++) for (let x = 31; x <= 38; x++) {
    const d = ((x - 35) / 3.2) ** 2 + ((y - 18.5) / 2) ** 2;
    if (d < 1) { m.g[y][x] = "w"; m.o[y][x] = " "; } else if (d < 1.9 && x < 38 && m.o[y][x] !== "h") { m.g[y][x] = "s"; if (m.o[y][x] !== "T") m.o[y][x] = " "; }
  }
  for (let x = 31; x <= 34; x++) { m.g[18][x] = "b"; m.o[18][x] = " "; }
  for (const [x, y] of [[36, 17], [37, 19], [35, 20]]) if (m.g[y][x] === "w") m.o[y][x] = "e";
  // hedges framing the plaza's south side
  for (const x of [15, 16, 17, 22, 23, 24]) m.o[20][x] = "H";
  m.npcs.push(
    { id: "shop", name: "보급상 리나", role: "shop", x: 10, y: 9, look: [4, 0, 1, "#8a4a6a"] },
    { id: "smith", name: "대장장이 볼칸", role: "smith", x: 30, y: 8, look: [0, 1, 0, "#6a4a38"] },
    { id: "elder", name: "관리자 엘더윈", role: "elder", x: 19, y: 11, look: [5, 0, 0, "#3f5a9a"] },
    { id: "train", name: "수련관 카이", role: "train", x: 23, y: 12, look: [1, 2, 0, "#7a2e2e"] },
    { id: "bank", name: "창고지기 도담", role: "bank", x: 7, y: 12, look: [2, 0, 0, "#6a5a3a"],
      say: "맡길 물건이 있나? 캐릭터마다 60칸, 골드도 따로 맡아 두지. 같은 물건은 한 칸에 모아 준다네." },
    { id: "guard", name: "경비병 토비", role: "talk", x: 35, y: 13, look: [1, 0, 0, "#5e6470"],
      say: "동쪽 문은 바람초원, 서쪽 문은 네온 시티로 이어져. 길은 갈라지고 막히기도 하니 샛길을 살펴봐 — 막다른 곳엔 보물 상자나 모닥불, 그리고 가끔은 땅속으로 내려가는 계단이 있거든. 문 이름 옆의 레벨을 보고, 감당할 만한 곳부터 가!" },
  );
  // the hub's services stand around the plaza: a waypoint stone with its keeper, the
  // collector, the hall of records and the board of daily tasks
  m.npcs.push(
    { id: "warp", name: "이동술사 노바", role: "warp", x: 15, y: 17, look: [2, 3, 0, "#4a6ac8"],
      say: "이동의 돌을 깨우면 어디서든 돌과 돌 사이를 건널 수 있어. 사냥터마다 입구 가까이에 하나씩 있지." },
    { id: "collector", name: "학자 몽", role: "collector", x: 24, y: 16, look: [3, 4, 0, "#7a6a3a"],
      say: "같은 몬스터를 서른 마리 잡으면 도감에 오르지. 한 지역을 다 채우면 그 땅이 힘을 빌려준다네." },
    { id: "achieve", name: "기록관 루", role: "achieve", x: 24, y: 14, look: [4, 1, 0, "#8a3a5a"],
      say: "자네의 모험은 모두 이 비석에 새겨지네. 이름난 업적에는 칭호가 따르지." },
    { id: "daily", name: "게시판지기 하루", role: "daily", x: 15, y: 13, look: [0, 2, 0, "#3a7a5a"],
      say: "매일 아침 6시에 새 과제가 붙는다네. 셋을 다 하면 보상 상자도 있지!" },
    // the costume shop, by the house on the south-west corner of the square, off both roads
    { id: "costume", name: "의상실 주인 루루", role: "costume", x: 13, y: 22, look: [3, 1, 0, "#d86a9a"],
      say: "어서 와요! 모자, 옷, 망토, 안경, 무기 외형까지 — 능력치는 그대로, 모습만 바뀌어요." },
  );
  m.o[16][16] = "Q";
  WP.town = { x: 16, y: 16, ax: 17, ay: 16 };
  m.marks = [
    { x: 16, y: 16, kind: "waypoint" },
    { x: 32, y: 13, kind: "sign", label: "바람초원 Lv.1–7 →", to: "meadow" },
    { x: 6, y: 13, kind: "sign", label: "← 네온 시티 Lv.14–21", to: "city" },
  ];
  m.gates = { east: { t: [[38, 14], [38, 15]], a: [[36, 14], [36, 15]] }, west: { t: [[1, 14], [1, 15]], a: [[3, 14], [3, 15]] } };
  FIRES.town.push([22, 22]);
  return m;
}

function buildMaps() {
  for (const id of ["town", "meadow", "forest", "crypt", "city", "sewer", "cave", "abyss"]) FIRES[id] = [];
  const town = buildTown();
  const meadow = wilds({
    id: "meadow", name: "바람초원", theme: "meadow", seed: 22021, w: 76, h: 51, r: 9.6, warp: 9, wind: 0.55, loops: 0.12, merge: 0.32, cliff: 0.15, gap: 2,
    ground: ".", edge: "T", treeCh: "T", treeCh2: "B", road: "p", shore: "s", river: true, lakes: 2, lakeR: 5, vaults: 3, ruins: 1, tpm: 15.5,
    walls: [["trees", 0.42], ["hedge", 0.3], ["rocks", 0.28]], gates: [["west", "w", 0.5], ["east", "e", 0.5]], exit: "east",
    mobs: ["twinhare", "twinhare", "twinhare", "gutfrog", "gutfrog", "lambmaw", "eyecrow", "lambmaw", "eyecrow"], pondMob: "eyecrow", chest: "chest_meadow",
    vaultKinds: ["shrine", "circle", "bloom", "lookout", "cache", "menhir"], biomes: { plain: "plain" }, featureP: 0.6, features: ["pond", "boulders", "bigtree", "pen", "cairn", "logs", "stones"],
    // wet low ground flowers or grows tall; high ground is stony; dry ground is orchard or plain grass
    biome: (e, mo, r) => (mo > 0.6 ? (r < 0.6 ? "flowers" : "tallgrass") : e > 0.66 ? "rocky" : mo < 0.36 ? (r < 0.5 ? "orchard" : "plain") : r < 0.35 ? "tallgrass" : "plain"),
    paint: (b, n1, n2) => (b === "flowers" && n1 > 0.42 ? '"' : b === "tallgrass" && n1 > 0.4 ? "t" : b === "orchard" && n1 > 0.74 ? '"' : b === "plain" && n1 > 0.8 ? "t" : b === "plain" && n1 < 0.1 ? '"' : n2 > 0.66 ? "," : null),
    scatter: (b, h, n1) => (b === "orchard" ? (h < 0.05 ? "T" : h < 0.058 ? "u" : h < 0.063 ? "l" : null)
      : b === "rocky" ? (n1 > 0.55 && h < 0.09 ? "R" : h < 0.015 ? "B" : h < 0.025 ? "u" : null)
      : b === "flowers" ? (h < 0.03 ? "B" : h < 0.036 ? "T" : null)
      : b === "tallgrass" ? (h < 0.012 ? "T" : h < 0.02 ? "B" : null)
      : h < 0.018 ? "T" : h < 0.036 ? "B" : h < 0.043 ? "R" : h < 0.047 ? "u" : h < 0.05 ? "l" : null),
  });
  const forest = wilds({
    id: "forest", name: "속삭임 숲", theme: "forest", bgm: "forest", seed: 33053, w: 76, h: 51, r: 8.2, warp: 10, wind: 0.6, loops: 0.1, merge: 0.18, cliff: 0.22, gap: 2,
    ground: ":", edge: "P", treeCh: "P", treeCh2: "T", road: "p", shore: null, river: true, lakes: 1, lakeR: 4, vaults: 3, ruins: 2, tpm: 15.5, stair: "crypt",
    walls: [["trees", 0.5], ["bramble", 0.2], ["ruin", 0.12], ["rocks", 0.18]], gates: [["west", "w", 0.5], ["north", "n", 0.86]], exit: "north",
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
  });
  const cave = cavern({
    id: "cave", name: "수정 동굴", seed: 44093, w: 66, h: 50, r: 8, vaults: 4, tpm: 16, chest: "chest_cave",
    mobs: ["spiderhand", "splitboar_frost", "moleworm", "owlstare", "hydrasnake_steel", "bearmaw"],
  });
  const town2 = metro({
    id: "city", name: "네온 시티", seed: 55071, bgm: "city", w: 76, h: 51, gate: "east", gateY: 0.5, stair: "sewer", wind: 0.5, loops: 0.14, tpm: 5.5,
    mobs: ["pigeonmass", "gutfrog_poison", "doghead", "squidrat", "catsplit", "fishwalker"], chest: "chest_city",
  });
  // the dungeons: each grown its own way, with its own inhabitants and its own furniture
  const crypt = catacomb({
    id: "crypt", name: "뼈의 지하묘지", theme: "crypt", seed: 66017, w: 66, h: 51, min: 9, minH: 8, leaf: 150, entryY: 0.8, wind: 0.6, loops: 0.06, out: true, n: 3,
    shapes: ["plain", "chapel", "cross", "octagon", "ell", "chapel", "cross"], styles: ["pillars", "pool", "rows", "rubble", "shrine", "plain", "plain"], vaultName: "ossuary",
    mobs: ["ratking", "twinhare_bone", "bonehound", "toadbrood", "batcluster"], guard: "bonehound", chest: "chest_crypt",
    dress: { wall: [["2", 0.1], ["3", 0.09]], floor: [["1", 0.02], ["4", 0.03], ["5", 0.01]], pillar: "5", rows: "1", junk: "4", ring: "3", vault: "4" },
  });
  const sewer = sewers({
    id: "sewer", name: "하수도", theme: "sewer", seed: 77029, w: 76, h: 51, r: 10.5, wind: 0.5, loops: 0.16, n: 3,
    mobs: ["leechmaw", "ratking_bile", "gatorhalf", "crabskull", "eelknot"], guard: "gatorhalf", chest: "chest_sewer",
  });
  const abyss = abyssal({
    id: "abyss", name: "피의 심연", theme: "abyss", seed: 88041, w: 76, h: 60, r: 10.5, wind: 0.55, loops: 0.06, n: 7, boss: "abyssboss",
    mobs: ["twingoat", "bonehound_ash", "horsehalf", "batcluster_blood", "lionhand", "serpentwing", "sowseer", "doghead_fire"], guard: "horsehalf", chest: "chest_abyss",
  });
  // the level a character should be to walk in, shown on every door that leads there
  for (const [m, lo, hi] of [[meadow, 1, 7], [forest, 8, 13], [crypt, 12, 17], [town2, 14, 21], [sewer, 22, 27], [cave, 24, 32], [abyss, 32, 40]]) m.band = [lo, hi];
  // doors between the worlds: stepping on a gate tile puts you on the matching arrival tile next door
  const join = (a, ga, b, gb) => {
    for (let k = 0; k < 2; k++) {
      portal(a, a.gates[ga].t[k][0], a.gates[ga].t[k][1], b.id, b.gates[gb].a[k][0], b.gates[gb].a[k][1]);
      portal(b, b.gates[gb].t[k][0], b.gates[gb].t[k][1], a.id, a.gates[ga].a[k][0], a.gates[ga].a[k][1]);
    }
  };
  /** A one-way door: out of `a` at gate `ga`, arriving beside `b`'s gate `gb`. */
  const leave = (a, ga, b, gb) => { for (let k = 0; k < 2; k++) portal(a, a.gates[ga].t[k][0], a.gates[ga].t[k][1], b.id, b.gates[gb].a[k][0], b.gates[gb].a[k][1]); };
  join(town, "east", meadow, "west");
  join(town, "west", town2, "east");
  join(meadow, "east", forest, "west");
  join(forest, "north", cave, "west");
  join(forest, "crypt", crypt, "in");
  join(town2, "sewer", sewer, "in");
  join(cave, "rift", abyss, "in");
  leave(crypt, "out", forest, "crypt");
  leave(sewer, "out", town2, "sewer");
  // the hunt wants a crowd: every hunting ground holds more than its layout asked for
  // (chests, guardians and bosses stay as placed)
  for (const m of [meadow, forest, crypt, town2, sewer, cave, abyss]) {
    const grows = (sp) => !MOBS[sp.k].chest && !MOBS[sp.k].boss && !sp.el;
    let base = 0, fixed = 0;
    for (const sp of m.spawns) { if (grows(sp)) base += sp.n; else fixed += sp.n; }
    // as many as the ground has room for, at the density each kind of ground is meant to have
    let open = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.o[y][x] === " " && !SOLID_G.includes(m.g[y][x])) open++;
    const k = Math.min(CROWD_MAX - fixed, open / DENSITY[m.id]) / base;
    let carry = 0;
    for (const sp of m.spawns) {
      if (!grows(sp)) continue;
      const want = sp.n * k + carry, n = Math.max(sp.n, Math.round(want));
      carry = want - n;
      sp.n = n;
    }
  }
  const byId = { town, meadow, forest, crypt, city: town2, sewer, cave, abyss };
  const labelOf = (id) => (byId[id].band ? `${byId[id].name} Lv.${byId[id].band[0]}–${byId[id].band[1]}` : byId[id].name);
  for (const m of [meadow, forest, crypt, town2, sewer, cave, abyss]) {
    const lo = m.band[0];
    markRoutes(m, labelOf, (id) => (byId[id].band && byId[id].band[0] > lo ? byId[id].band[0] : 0));
  }
  const out = {};
  for (const m of [town, meadow, forest, crypt, town2, sewer, cave, abyss]) out[m.id] = finalize(m);
  return out;
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
  /** Put object `ch` beside the walk at index-tile `at`, where it blocks nothing. */
  const place = (at, ch) => {
    const ax = at % W, ay = (at - ax) / W;
    for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]]) {
      const x = ax + dx, y = ay + dy, i = y * W + x;
      if (!open(x, y) || onPath.has(i) || base.d[i] < 0 || busy(x, y)) continue;
      m.o[y][x] = ch;
      if (ringJoined(x, y) || flood(ex, ey).count === reach - 1) { reach--; return [x, y]; }
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
  for (let k = Math.min(12, C.length - 2); k < Math.min(C.length - 1, 48); k++) {
    const at = place(C[k], "Q");
    if (!at) continue;
    WP[m.id] = { x: at[0], y: at[1], ax: C[k] % W, ay: Math.floor(C[k] / W) };
    m.marks.push({ x: at[0], y: at[1], kind: "waypoint" });
    break;
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
}


const MAPS = buildMaps();
const START = { map: "town", x: 20 * T + 8, y: 18 * T + 8 };
/** Every monster that lives somewhere (no chests, no bosses), and each region's for its collection. */
const HUNTED = [...new Set(Object.values(MAPS).flatMap((m) => m.spawns.map((sp) => sp.k)))].filter((k) => !MOBS[k].chest && !MOBS[k].boss);
const COL_MOBS = {};
for (const id of ["meadow", "forest", "crypt", "city", "sewer", "cave", "abyss"]) COL_MOBS[id] = [...new Set(MAPS[id].spawns.map((sp) => sp.k))].filter((k) => HUNTED.includes(k));

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

const doorName = (m) => (m.band ? `${m.name} Lv.${m.band[0]}–${m.band[1]}` : m.name);
function mapPayload(m) {
  return {
    id: m.id, name: m.name, w: m.w, h: m.h, g: m.g, o: m.o, big: m.big, safe: m.safe, bgm: m.bgm,
    theme: m.theme || null, band: m.band || null, marks: m.marks || [],
    // a door names where it leads and how strong you should be to go there
    portals: m.portals.map((p) => ({ x: p.x, y: p.y, to: doorName(MAPS[p.to]) })),
    npcs: m.npcs,
  };
}

