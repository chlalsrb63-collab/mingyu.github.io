// ───────────────────────────── 차원 균열: the party instance's map ─────────────────────────────
// docs/design/scale-and-rift.md D. A party's own dungeon, made on the spot from a seed: a small
// underground (56 × 40 tiles) of 7–9 rooms on a jittered 4 × 3 grid, joined by a spanning tree of
// corridors with a loop or two, the way in at one end, the master's hall at the far end, and two or
// three dead-end vaults (a guardian and a chest each) hanging off the far half. Floors, walls and
// furniture are one of the four underground themes, so the browser draws it with the art it has.
// Monsters come from the theme's own kinds near the party's level (or, if the theme has none that
// close, from every hunting ground's kinds nearest that level). Pure: no world state, no MAPS.

/** Every number of the instance in one place (balance edits are data-only; the manager is 64-dim.js). */
const DIM = {
  max: 4, party: 4,                       // instances per channel room, players inside one
  w: 56, h: 40, path: 52, rooms: [7, 9], vaults: [2, 3], packs: [12, 16], pack: [3, 6], mobCap: 70, cap: 90,
  limit: 900000, warn: 180000,            // 15 minutes from the open; a warning with 3 minutes left
  emptyMs: 20000, portalMs: 90000, failMs: 8000, memberMs: 180000, rcMs: 20000, near: 80,
  // the gauge: a kill, an elite (guardians too), an orb an elite leaves behind; a rift with fewer monsters scales
  // these up so that everything together is worth `full` (64-dim.js dim.gK)
  normal: 0.9, elite: 4, orb: 3, orbMs: 25000, orbR: 36, full: 118,
  // shrines (pylons): chance per elite (always on the 3rd and 6th), how long one stands, reach
  shrineP: 0.35, shrineMs: 30000, shrineR: 20, buffR: 400,
  pylons: { atk: ["분노의 기둥", 25000], spd: ["질풍의 기둥", 20000], shield: ["수호의 기둥", 20000], gauge: ["정령의 기둥", 0] },
  atkK: 0.25, ward: 0.25, gaugeMp: 0.3,
  // how much more killing a rift monster takes than its wild kin, for a party of four at the band (measured with
  // the bot party in tests/dimrift.mjs; the low bands get more, `hpLow` = [below this level, + per level]); `hpN` by
  // party size (a lone player faces 30% of it); `lvK` per level the party outranks it; the master `bossHp` of that, hitting
  // `bossAtk` as hard as a field boss of its kind (hpBase 5.8 → 8.2 after jobs J1 made heroes ≈ 30 % quicker killers,
  // → 5.4 with J2's weapon skills, which lost the old kits' party heals, taunts and guards:
  // bot clears 5.2 / 5.6 / 6.3 / 7.0 min at tiers 17 / 24 / 32 / 40)
  hpBase: 5.4, hpLow: [24, 1], hpN: [0.3, 0.6, 0.8, 1], lvK: 0.1, bossHp: 0.6, bossAtk: 0.7, poolLv: [3, 2],
  reviveMs: 25000,
  // the master's chest, per member: gold × lv, a share of a level, rare gear, stones, a rune now and then
  reward: { gold: 60, xp: 0.05, gearQ: 3, stone: 2, rune: 0.6 }, dailyFull: 3, failGold: 30, lootGold: 0.5,
};
/** The four looks: their floor deco (object chars from that theme's own map) and the name players see. */
const DIM_THEMES = {
  crypt: { name: "뼈의 균열", deco: "4231", pool: "" },
  sewer: { name: "오수의 균열", deco: "764", pool: "w" },
  cave: { name: "수정의 균열", deco: "KSYK", pool: "w" },
  abyss: { name: "핏빛 균열", deco: "0848", pool: "w" },
};
/** Which looks suit a level (first guess per the plan: low crypt/sewer, mid cave/sewer, high abyss/cave/crypt). */
const dimThemesFor = (lv) => (lv < 20 ? ["crypt", "sewer"] : lv < 32 ? ["cave", "sewer"] : ["abyss", "cave", "crypt"]);
const dimTheme = (seed, lv) => { const t = dimThemesFor(lv); return t[((seed >>> 3) >>> 0) % t.length]; };
/** Where the town's obelisk stands, its keeper, and where someone coming back from an instance lands (tiles). */
const DIM_TOWN = { ob: [24, 18], keeper: [23, 19], land: [22, 18] };

/**
 * The monsters of an instance: the theme's own kinds within [lv-3, lv+2] (DIM.poolLv), else the kinds of every
 * hunting ground nearest lv-1 (4 of them), lowest level first. Never chests or bosses.
 */
function dimPool(theme, lv) {
  const ok = (k) => MOBS[k] && !MOBS[k].chest && !MOBS[k].boss;
  const own = [];
  for (const id of Object.keys(MAP_META)) if (MAP_META[id].theme === theme && !MAP_META[id].safe) for (const k of MAP_META[id].kinds) if (ok(k) && !own.includes(k)) own.push(k);
  let pool = own.filter((k) => MOBS[k].lv >= lv - DIM.poolLv[0] && MOBS[k].lv <= lv + DIM.poolLv[1]);
  if (pool.length < 3) {
    const all = [];
    for (const id of Object.keys(MAP_META)) if (!MAP_META[id].safe) for (const k of MAP_META[id].kinds) if (ok(k) && !all.includes(k)) all.push(k);
    all.sort((a, b) => Math.abs(MOBS[a].lv - (lv - 1)) - Math.abs(MOBS[b].lv - (lv - 1)) || MOBS[a].lv - MOBS[b].lv || (a < b ? -1 : 1));
    pool = all.slice(0, 4);
  }
  return pool.sort((a, b) => MOBS[a].lv - MOBS[b].lv || (a < b ? -1 : 1));
}
/** The master of an instance: the theme's own field boss when it is near the party's level, else the toughest of the pool. */
function dimBossKind(theme, lv, pool) {
  for (const id of Object.keys(MAP_META)) {
    const k = FIELD_BOSS[id];
    if (MAP_META[id].theme === theme && k && Math.abs(MOBS[k].lv - lv) <= 6) return k;
  }
  return pool[pool.length - 1];
}

/**
 * Make an instance map: `{ id, seed, theme, lv }` → a finalized map like any other (g, o, reach,
 * portals, entry …) plus `m.dim = { rooms, start, boss, bossRoom, dead, spawns, pool, bossK, path, elites, cap }`.
 * Spawns are packs: `{ k, n, at: [x, y], room, el, guard?, chest? }` — the manager places each monster
 * on open ground within two tiles of `at`.
 */
function dimension(cfg) {
  // a layout whose way in and master's hall ended up close together is laid out again (a fixed number of tries: still pure)
  let m = null;
  for (let i = 0; i < 6; i++) {
    m = dimBuild(cfg, (((cfg.seed | 0) || 1) + Math.imul(i, 0x9e3779b1)) | 0);
    if (m.dim.path >= DIM.path) break;
  }
  return m;
}
function dimBuild(cfg, seed) {
  const box = { seed };
  const W = DIM.w, H = DIM.h, theme = DIM_THEMES[cfg.theme] ? cfg.theme : "crypt", lv = cfg.lv | 0 || 10;
  const look = DIM_THEMES[theme];
  const m = blank(cfg.id || "dim:0", `차원 균열 Lv.${shownLv(lv)}`, W, H, "W");
  m.theme = theme; m.bgm = "dim"; m.band = null; m.marks = [];
  // ── the grid: 4 × 3 cells of 13 × 12 tiles; the rooms grow over a connected set of them
  const GX = 4, GY = 3, CW = 13, CH = 12;
  const cellBox = (c) => { const i = c % GX, j = (c / GX) | 0; return [2 + i * CW, 2 + j * CH, 2 + i * CW + CW - 1, 2 + j * CH + CH - 1]; };
  const adj = (c) => { const i = c % GX, j = (c / GX) | 0, out = []; if (i > 0) out.push(c - 1); if (i < GX - 1) out.push(c + 1); if (j > 0) out.push(c - GX); if (j < GY - 1) out.push(c + GX); return out; };
  const nMain = ri(box, DIM.rooms[0], DIM.rooms[1]);
  const used = [ri(box, 0, GX * GY - 1)];
  while (used.length < nMain) {
    const edge = [];
    for (const c of used) for (const n of adj(c)) if (!used.includes(n) && !edge.includes(n)) edge.push(n);
    edge.sort((a, b) => a - b);
    used.push(edge[ri(box, 0, edge.length - 1)]);
  }
  // ── rooms: a shape inside each cell
  const rooms = [];
  const roomAt = new Int16Array(W * H).fill(-1);
  const dig = (x, y, k) => { if (x > 1 && y > 1 && x < W - 2 && y < H - 2) { m.g[y][x] = "c"; if (k >= 0 && roomAt[y * W + x] < 0) roomAt[y * W + x] = k; } };
  const makeRoom = (c, w, h, shape, kind) => {
    const [cx0, cy0, cx1, cy1] = cellBox(c);
    const x0 = ri(box, cx0 + 1, cx1 - w), y0 = ri(box, cy0 + 1, cy1 - h);
    const r = { c, kind, x0, y0, x1: x0 + w - 1, y1: y0 + h - 1, w, h, cx: x0 + (w >> 1), cy: y0 + (h >> 1), shape, area: 0 };
    const k = rooms.length, mx = (r.x0 + r.x1) / 2, my = (r.y0 + r.y1) / 2;
    const inside = (x, y) => {
      const u = (x - mx) / (w / 2), v = (y - my) / (h / 2);
      if (shape === "cross") return Math.abs(u) < 0.5 || Math.abs(v) < 0.5;
      if (shape === "octagon") return Math.abs(u) + Math.abs(v) <= 1.5;
      if (shape === "ell") return !(u > 0.2 && v < -0.2);
      return true;
    };
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (inside(x, y)) { dig(x, y, k); r.area++; }
    rooms.push(r);
    return r;
  };
  const SHAPES = ["plain", "plain", "cross", "octagon", "ell"];
  for (const c of used) makeRoom(c, ri(box, 7, 11), ri(box, 6, 9), SHAPES[ri(box, 0, SHAPES.length - 1)], "room");
  // ── corridors: a random spanning tree over neighbouring cells, then one or two loops
  const edges = [];
  for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) if (adj(rooms[a].c).includes(rooms[b].c)) edges.push([a, b, rnd(box)]);
  edges.sort((p, q) => p[2] - q[2]);
  const root = rooms.map((_, i) => i), find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  const tree = [], spare = [];
  for (const e of edges) { const a = find(e[0]), b = find(e[1]); if (a !== b) { root[a] = b; tree.push(e); } else spare.push(e); }
  const loops = Math.min(spare.length, ri(box, 1, 2));
  const links = tree.concat(spare.slice(0, loops));
  const hall = new Uint8Array(W * H);
  const corridor = (a, b, wd) => {
    const A = rooms[a], B = rooms[b];
    const flip = rnd(box) < 0.5;
    const pts = flip ? [[A.cx, A.cy], [B.cx, A.cy], [B.cx, B.cy]] : [[A.cx, A.cy], [A.cx, B.cy], [B.cx, B.cy]];
    for (let s = 0; s < 2; s++) {
      const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const x = x0 + Math.sign(x1 - x0) * i, y = y0 + Math.sign(y1 - y0) * i;
        for (let dy = 0; dy < wd; dy++) for (let dx = 0; dx < wd; dx++) {
          const xx = x + dx - (wd >> 1), yy = y + dy - (wd >> 1);
          if (xx > 1 && yy > 1 && xx < W - 2 && yy < H - 2) { if (roomAt[yy * W + xx] < 0) hall[yy * W + xx] = 1; dig(xx, yy, -1); }
        }
      }
    }
  };
  for (const [a, b] of links) corridor(a, b, rnd(box) < 0.3 ? 3 : 2);
  // ── start and master's hall: the two ends of the longest walk; the master takes the biggest room out there
  const open = (i) => m.g[(i / W) | 0][i % W] !== "W";
  const tileOf = (r) => r.cy * W + r.cx;
  const far = (from) => { const d = bfs(W, H, tileOf(rooms[from]), open); let best = from; rooms.forEach((r, k) => { if (d[tileOf(r)] > d[tileOf(rooms[best])]) best = k; }); return [best, d]; };
  const [a0] = far(0);
  const [b0, dA] = far(a0);
  const startK = b0;                                   // one end …
  const dS = bfs(W, H, tileOf(rooms[startK]), open);   // … and how far everything is from it
  const span = Math.max(...rooms.map((r) => dS[tileOf(r)]));
  let bossK = -1;
  rooms.forEach((r, k) => { if (k !== startK && dS[tileOf(r)] >= span * 0.85 && (bossK < 0 || r.area > rooms[bossK].area)) bossK = k; });
  void dA;
  // the two ends are plain rooms: room to arrive in, room to fight in
  const plainOut = (k) => { const r = rooms[k]; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) dig(x, y, k); r.shape = "plain"; r.area = r.w * r.h; };
  plainOut(startK); plainOut(bossK);
  rooms[startK].kind = "start"; rooms[bossK].kind = "boss";
  // ── vaults: small dead ends off the far half (never off the way in), one corridor each
  const nVault = ri(box, DIM.vaults[0], DIM.vaults[1]);
  const free = [];
  for (let c = 0; c < GX * GY; c++) if (!used.includes(c)) free.push(c);
  const vaultFor = (minT) => {
    const opts = [];
    for (const c of free) for (const n of adj(c)) {
      const k = rooms.findIndex((r) => r.c === n && r.kind !== "vault");
      if (k < 0 || k === startK || dS[tileOf(rooms[k])] < span * minT) continue;
      opts.push([c, k]);
    }
    return opts;
  };
  for (let v = 0; v < nVault; v++) {
    let opts = vaultFor(0.6);
    if (!opts.length) opts = vaultFor(0);
    if (!opts.length) break;
    const [c, k] = opts[ri(box, 0, opts.length - 1)];
    free.splice(free.indexOf(c), 1);
    const r = makeRoom(c, ri(box, 5, 7), ri(box, 5, 6), rnd(box) < 0.5 ? "octagon" : "plain", "vault");
    corridor(k, rooms.length - 1, 2);
    r.from = k;
  }
  // ── the floor: patches of rubble; a pool in a big quiet room where the theme has liquid; furniture by the walls
  const S0 = box.seed;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (m.g[y][x] === "c" && fbm(x, y, S0, 5) > 0.58) m.g[y][x] = "d";
  const isWall = (x, y) => m.g[y][x] === "W";
  const quiet = (k) => rooms[k].kind === "room";
  if (look.pool) {
    const big = rooms.map((r, k) => k).filter((k) => quiet(k) && rooms[k].shape === "plain" && rooms[k].w >= 9 && rooms[k].h >= 7);
    for (const k of big.slice(0, 2)) {
      const r = rooms[k], corner = ri(box, 0, 3), pw = ri(box, 2, 3), ph = 2;
      const px = corner & 1 ? r.x1 - pw + 1 : r.x0, py = corner & 2 ? r.y1 - ph + 1 : r.y0;
      for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) if (!hall[y * W + x]) m.g[y][x] = look.pool;
    }
  }
  const deco = [];
  rooms.forEach((r, k) => {
    if (!quiet(k) && r.kind !== "vault") return;
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      if (roomAt[y * W + x] !== k || hall[y * W + x] || m.g[y][x] === "W" || m.g[y][x] === "w") continue;
      if (!(isWall(x - 1, y) || isWall(x + 1, y) || isWall(x, y - 1) || isWall(x, y + 1))) continue;
      if (Math.abs(x - r.cx) <= 1 && Math.abs(y - r.cy) <= 1) continue;
      if (deco.some(([dx, dy]) => Math.abs(dx - x) <= 1 && Math.abs(dy - y) <= 1)) continue;
      if (rnd(box) < 0.09) { m.o[y][x] = look.deco[ri(box, 0, look.deco.length - 1)]; deco.push([x, y]); }
    }
  });
  // ── the way home: a door by the start room's corner, back to the obelisk
  const st = rooms[startK];
  m.entry = [st.cx, st.cy];
  const door = [st.x0 + 1, st.y0 + 1];
  m.portals.push({ x: door[0], y: door[1], to: "town", tx: DIM_TOWN.land[0], ty: DIM_TOWN.land[1], label: "넥서스 광장 (귀환)" });
  // nothing may wall anything off: furniture or a pool that does is taken away again
  const reachAll = () => {
    const d = bfs(W, H, m.entry[1] * W + m.entry[0], (i) => m.o[(i / W) | 0][i % W] === " " && !SOLID_G.includes(m.g[(i / W) | 0][i % W]));
    const lost = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (m.o[y][x] === " " && !SOLID_G.includes(m.g[y][x]) && d[y * W + x] < 0) lost.push([x, y]);
    return lost;
  };
  for (let pass = 0, lost = reachAll(); lost.length && pass < 6; pass++, lost = reachAll()) {
    for (const [x, y] of lost) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (m.o[y + dy][x + dx] !== " ") m.o[y + dy][x + dx] = " ";
      if (m.g[y + dy][x + dx] === "w") m.g[y + dy][x + dx] = "c";
    }
  }
  // ── who lives here
  const pool = dimPool(theme, lv);
  const tOf = (r) => dS[tileOf(r)] / Math.max(1, span);
  const spawns = [];
  const openIn = (r, k) => {
    const out = [];
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (roomAt[y * W + x] === k && m.o[y][x] === " " && !SOLID_G.includes(m.g[y][x])) out.push([x, y]);
    return out;
  };
  const kindFor = (t) => pool[clamp(Math.floor(t * pool.length + (rnd(box) - 0.5) * 1.6), 0, pool.length - 1)];
  const normal = rooms.map((r, k) => k).filter((k) => rooms[k].kind === "room");
  // rooms next to the way in carry no elite
  const nearStart = new Set(links.filter(([a, b]) => a === startK || b === startK).map(([a, b]) => (a === startK ? b : a)));
  let budget = DIM.mobCap;
  const nPacks = ri(box, DIM.packs[0], DIM.packs[1]);
  const packsIn = normal.map(() => 1);
  for (let i = normal.length; i < nPacks; i++) {
    let tot = 0;
    for (const k of normal) tot += rooms[k].area;
    let roll = rnd(box) * tot, j = 0;
    for (; j < normal.length - 1; j++) { roll -= rooms[normal[j]].area; if (roll < 0) break; }
    packsIn[j]++;
  }
  let elites = 0;
  normal.forEach((k, j) => {
    const r = rooms[k], spots = openIn(r, k), t = tOf(r);
    for (let i = 0; i < packsIn[j] && budget > 0; i++) {
      const n = Math.min(budget, ri(box, DIM.pack[0], DIM.pack[1]));
      budget -= n;
      spawns.push({ k: kindFor(t), n, at: spots[ri(box, 0, spots.length - 1)], room: k, el: 0 });
    }
    if (!nearStart.has(k)) {
      const ne = r.area >= 70 && rnd(box) < 0.4 ? 2 : 1;
      for (let i = 0; i < ne; i++) { spawns.push({ k: kindFor(Math.min(1, t + 0.25)), n: 1, at: spots[ri(box, 0, spots.length - 1)], room: k, el: 1 }); elites++; }
    }
  });
  const dead = [];
  rooms.forEach((r, k) => {
    if (r.kind !== "vault") return;
    const spots = openIn(r, k).filter(([x, y]) => Math.abs(x - r.cx) + Math.abs(y - r.cy) >= 1);
    spawns.push({ k: pool[pool.length - 1], n: 1, at: spots[ri(box, 0, spots.length - 1)], room: k, el: 1, guard: 1 });
    spawns.push({ k: `chest_${theme}`, n: 1, at: [r.cx, r.cy], room: k, el: 0, chest: 1 });
    dead.push([r.cx, r.cy]);
    elites++;
  });
  const bs = rooms[bossK];
  m.dim = {
    rooms: rooms.map(({ x0, y0, x1, y1, cx, cy, kind, shape, area }) => ({ x0, y0, x1, y1, cx, cy, kind, shape, area })),
    start: [st.cx, st.cy], boss: [bs.cx, bs.cy], bossRoom: bossK, startRoom: startK, door, dead, spawns, pool,
    bossK: dimBossKind(theme, lv, pool), path: dS[tileOf(bs)], elites, cap: DIM.cap, links: links.map(([a, b]) => [a, b]),
  };
  finalize(m);
  return m;
}
