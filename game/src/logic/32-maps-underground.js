// ── underground: shared pieces
/** Dig a floor tile (never the map's rim); `set` collects what was dug. */
const digAt = (m, x, y, ch = "c") => { if (x > 1 && y > 1 && x < m.w - 2 && y < m.h - 2) { m.g[y][x] = ch; m.o[y][x] = " "; } };
/** A chamber's monsters, by how deep it lies: sparse and weak by the door, crowded and mean in the depths. */
function denSpawns(m, box, cfg, rect, t, d, side, extra = 0) {
  const K = cfg.mobs.length, band = d <= 1 ? 0 : Math.min(K - 1, Math.floor(t * K));
  const n = d <= 1 ? 1 + (box.seed & 1) : 2 + Math.round(t * cfg.n) + (side ? 1 : 0) + extra;
  m.spawns.push({ k: cfg.mobs[band], n, r: rect, elite: 0.03 + 0.2 * t });
  if (t >= 0.4) m.spawns.push({ k: cfg.mobs[clamp(band + (rnd(box) < 0.5 ? -1 : 1), 0, K - 1)], n: 1 + (t > 0.7 ? 1 : 0), r: rect, elite: 0.03 + 0.2 * t });
}
/**
 * A corridor dug by A* through the rock between two tiles: it prefers old passages,
 * keeps clear of other rooms, and pays for each turn so it bends a few times rather
 * than staircasing. `wd` is its width (1 or 2).
 */
function tunnel(m, a, b, wd, avoid, turn = 3, ch = "c") {
  const W = m.w, H = m.h, [bx, by] = b;
  const path = walk(W, H, a[1] * W + a[0], (i) => i === by * W + bx, (j, i, back) => {
    const x = j % W, y = (j - x) / W;
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) return Infinity;
    let c = m.g[y][x] === "W" ? 1.4 : 0.7;
    if (avoid && avoid[j]) c += avoid[j];
    if (back >= 0 && j - i !== i - back) c += turn;
    return c + h2(x, y, 77) * 0.6;
  }, bx, by, 0.6);
  if (!path) return [];
  for (let s = 0; s < path.length; s++) {
    const t = path[s], x = t % W, y = (t - x) / W, nx = path[s + 1] ?? path[s - 1], horiz = Math.abs(nx - t) === 1;
    if (m.g[y][x] === "W" || m.g[y][x] === "w") digAt(m, x, y, ch);
    if (wd > 1) { const X = horiz ? x : x + 1, Y = horiz ? y + 1 : y; if (m.g[Y] && (m.g[Y][X] === "W")) digAt(m, X, Y, ch); }
  }
  return path;
}

/**
 * The crystal cave: caverns grown by a cellular automaton from noise, the pieces
 * stitched to the main cavern by drunkard's-walk tunnels, around a fixed start in the
 * south-west and the boss's arena in the north-east, reached only through an antechamber.
 * Zones (a Voronoi of Poisson sites over the open floor) take their depth from the walk
 * in and their dressing from a theme: crystal groves, glowing mushroom glades,
 * stalagmite fields, an old mine; the deepest still water becomes an underground lake.
 */
function cavern(cfg) {
  const box = { seed: cfg.seed }, S0 = cfg.seed;
  const W = cfg.w, H = cfg.h;
  const m = blank(cfg.id, cfg.name, W, H, "W");
  m.bgm = "cave"; m.theme = "cave"; m.pieces = [];
  const N1 = field(m, S0 + 5, 6, 2), N2 = field(m, S0 + 6, 13, 2);
  const start = [7, 43], ante = [41, 11], arena = [55, 11];
  // 2 = forced floor, 1 = forced rock
  const fixed = new Uint8Array(W * H), wall = new Uint8Array(W * H);
  const ell = (cx, cy, rx, ry, v) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (inMap(m, x, y) && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) fixed[y * W + x] = v; };
  // the arena sits inside a shell of rock with one neck through it
  ell(arena[0], arena[1], 9.5, 9, 1);
  ell(arena[0], arena[1], 6.5, 6, 2);
  ell(start[0], start[1], 4.5, 3.5, 2);
  ell(ante[0], ante[1], 4.2, 3.2, 2);
  for (let x = ante[0] + 3; x <= arena[0] - 5; x++) for (const y of [11, 12]) fixed[y * W + x] = 2;
  for (let x = arena[0] + 5; x <= W - 3; x++) for (const y of [10, 11]) fixed[y * W + x] = 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) { wall[i] = 1; continue; }
    wall[i] = rnd(box) < 0.57 + (N2[i] - 0.5) * 0.3 ? 1 : 0;
  }
  // a few passes that also plant rock in the middle of any wide hall, then plain smoothing
  let cave = wall;
  const SW = W + 1, sum = new Int32Array(SW * (H + 1));
  const box2 = (x0, y0, x1, y1) => sum[(y1 + 1) * SW + x1 + 1] - sum[y0 * SW + x1 + 1] - sum[(y1 + 1) * SW + x0] + sum[y0 * SW + x0];
  for (let pass = 0; pass < 4; pass++) {
    // a summed-area table makes every neighbourhood count a handful of lookups
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += cave[y * W + x]; sum[(y + 1) * SW + x + 1] = sum[y * SW + x + 1] + row; } }
    const nx = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (fixed[i]) { nx[i] = fixed[i] === 1 ? 1 : 0; continue; }
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) { nx[i] = 1; continue; }
      const self = cave[i], n8 = box2(x - 1, y - 1, x + 1, y + 1) - self, n24 = box2(x - 2, y - 2, x + 2, y + 2) - self;
      nx[i] = n8 >= 5 || n24 <= 2 ? 1 : 0;
    }
    cave = nx;
  }
  cave = automaton(W, H, cave, 3, 5, 4, fixed);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!cave[y * W + x]) m.g[y][x] = "c";
  for (let x = arena[0] + 5; x <= W - 3; x++) for (const y of [10, 11]) m.g[y][x] = "c";
  // pieces of cavern apart from the main one: join the big ones with a drunkard's walk, fill in the crumbs
  const open = (i) => m.g[Math.floor(i / W)][i % W] !== "W";
  const startI = start[1] * W + start[0];
  for (let pass = 0; pass < 12; pass++) {
    const main = bfs(W, H, startI, open);
    let lone = -1;
    const seen = new Uint8Array(W * H);
    for (let i = 0; i < W * H && lone < 0; i++) {
      if (!open(i) || main[i] >= 0 || seen[i]) continue;
      const d = bfs(W, H, i, open);
      let n = 0;
      for (let j = 0; j < W * H; j++) if (d[j] >= 0) { seen[j] = 1; n++; }
      if (n < 14) { for (let j = 0; j < W * H; j++) if (d[j] >= 0 && !fixed[j]) m.g[Math.floor(j / W)][j % W] = "W"; continue; }
      lone = i;
    }
    if (lone < 0) break;
    // the nearest tile of the main cavern, and a stumbling walk toward it
    let best = -1, bd = Infinity;
    const lx = lone % W, ly = Math.floor(lone / W);
    for (let j = 0; j < W * H; j++) if (main[j] >= 0) { const d = Math.hypot(j % W - lx, Math.floor(j / W) - ly); if (d < bd) { bd = d; best = j; } }
    let x = lx, y = ly;
    const tx = best % W, ty = Math.floor(best / W);
    for (let s = 0; s < 400 && (x !== tx || y !== ty); s++) {
      if (rnd(box) < 0.7) { if (Math.abs(tx - x) > Math.abs(ty - y)) x += Math.sign(tx - x); else y += Math.sign(ty - y); }
      else { const [dx, dy] = D4[ri(box, 0, 3)]; x = clamp(x + dx, 3, W - 4); y = clamp(y + dy, 3, H - 4); }
      const i = y * W + x;
      if (fixed[i] === 1) { y += y < arena[1] ? -1 : 1; continue; }
      digAt(m, x, y); if (x + 1 < W - 3 && fixed[i + 1] !== 1) digAt(m, x + 1, y);
    }
  }
  // wide halls get pillars of rock where the noise rises, so no cavern is a bare field
  const toWall = bfs(W, H, [...Array(W * H).keys()].filter((i) => m.g[Math.floor(i / W)][i % W] === "W"), () => true);
  for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
    const i = y * W + x;
    if (toWall[i] >= 4 && !fixed[i] && N1[i] > 0.68 && Math.hypot(x - start[0], y - start[1]) > 6) m.g[y][x] = "W";
  }
  // zones: Poisson sites over the open floor, each a region of the cavern with its own depth and dressing
  const floor = (x, y) => m.g[y][x] !== "W";
  const sites = poisson(box, 4, 4, W - 5, H - 5, cfg.r, [start, ante, arena]).filter(([x, y], k) => k < 3 || floor(Math.round(x), Math.round(y)));
  const lab = partition(m, sites.map(([x, y]) => ({ x, y, w: 1 })), S0 + 3, 6, (x, y) => floor(x, y));
  const { R, inner } = regionsOf(m, lab, sites.length);
  const depth = bfs(W, H, startI, (i) => m.g[Math.floor(i / W)][i % W] !== "W");
  let far = 1;
  for (let i = 0; i < W * H; i++) if (lab[i] !== 1 && lab[i] !== 2 && depth[i] > far) far = depth[i];
  const zones = R.filter((r) => r.area > 0).map((r) => ({ r, d: depth[r.py * W + r.px] < 0 ? far : depth[r.py * W + r.px] }));
  zones.forEach((z) => { z.t = z.d / far; });
  const order = zones.filter((z) => z.r.k > 2 && z.r.area >= 12).sort((a, b) => a.d - b.d);
  // the lake: still water in the widest zone about halfway in
  const lakeZ = order.filter((z) => z.t > 0.3 && z.t < 0.75).sort((a, b) => b.r.inr - a.r.inr)[0];
  const campZ = order.filter((z) => z !== lakeZ && z.t > 0.3 && z.t < 0.7).sort((a, b) => b.r.inr - a.r.inr)[0];
  const themes = ["crystal", "shroom", "spires", "mine"];
  for (const z of order) z.kind = z === lakeZ ? "lake" : z === campZ ? "camp" : themes[ri(box, 0, themes.length - 1)];
  for (const z of order) {
    const r = z.r;
    m.pieces.push(z.kind);
    for (const i of r.tiles) {
      const x = i % W, y = (i - x) / W;
      const wallish = m.g[y - 1][x] === "W" || m.g[y][x - 1] === "W" || m.g[y][x + 1] === "W";
      // never in a squeeze: a tile with rock on both sides is a passage
      if (z.kind !== "lake" && ((m.g[y][x - 1] === "W" && m.g[y][x + 1] === "W") || (m.g[y - 1][x] === "W" && m.g[y + 1][x] === "W"))) continue;
      const h = h2(x, y, S0 + 9);
      if (N1[i] > 0.62) m.g[y][x] = "d";
      if (z.kind === "lake") { if (Math.hypot(x - r.px, (y - r.py) * 1.2) + (N1[i] - 0.5) * 3 < Math.min(r.inr, 5)) { m.g[y][x] = "w"; m.o[y][x] = " "; } else if (wallish && h < 0.25) m.o[y][x] = "K"; continue; }
      if (Math.hypot(x - r.px, y - r.py) < 2.2) continue;
      if (z.kind === "crystal") { if (wallish ? h < 0.3 : h < 0.06) m.o[y][x] = "K"; }
      else if (z.kind === "shroom") { if (wallish ? h < 0.2 : h < 0.08) m.o[y][x] = "Y"; else if (h > 0.85) m.g[y][x] = "d"; }
      else if (z.kind === "spires") { if (wallish ? h < 0.24 : h < 0.09) m.o[y][x] = "S"; }
      else if (z.kind === "mine") { if (wallish ? h < 0.14 : h < 0.035) m.o[y][x] = h < 0.016 ? "M" : "n"; }
    }
  }
  if (campZ) { const r = campZ.r; clear(m, r.px - 2, r.py - 1, r.px + 2, r.py + 2); if (floor(r.px - 2, r.py - 1)) m.o[r.py - 1][r.px - 2] = "E"; FIRES[cfg.id].push([r.px, r.py]); }
  FIRES[cfg.id].unshift([start[0] + 1, start[1] - 1]);
  // vaults: small chambers cut off to the side, one narrow way in, crystals at the door
  const vaults = [];
  for (const z of order.slice().sort((a, b) => b.d - a.d)) {
    if (vaults.length >= cfg.vaults || z.t < 0.3 || z.kind === "lake") continue;
    const r = z.r;
    const cand = [];
    for (let y = Math.max(4, r.py - 12); y <= Math.min(H - 8, r.py + 10); y++) for (let x = Math.max(4, r.px - 13); x <= Math.min(W - 9, r.px + 10); x++) {
      const d = Math.hypot(x + 1.5 - r.px, y + 1 - r.py);
      if (d >= 5 && d <= 12) cand.push([d + h2(x, y, S0) * 3, x, y]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, x, y] of cand) {
      let rock = true;
      for (let yy = y - 2; yy <= y + 4 && rock; yy++) for (let xx = x - 2; xx <= x + 5; xx++) if (m.g[yy][xx] !== "W" || fixed[yy * W + xx]) { rock = false; break; }
      if (!rock || vaults.some((v) => Math.hypot(v[0] - x, v[1] - y) < 10)) continue;
      for (let yy = y; yy <= y + 2; yy++) for (let xx = x; xx <= x + 3; xx++) digAt(m, xx, yy);
      tunnel(m, [x + 1, y + 1], spot(m, r.px, r.py), 1, null, 4);
      m.o[y][x] = "K"; m.o[y][x + 3] = "K";
      m.spawns.push({ k: cfg.chest, n: 1, r: [x + 1, y + 1, x + 2, y + 1] });
      m.spawns.push({ k: cfg.mobs[Math.min(cfg.mobs.length - 1, Math.floor(z.t * cfg.mobs.length) + 1)], n: 2, r: [x, y, x + 3, y + 2], elite: 0.35 });
      vaults.push([x, y]);
      m.pieces.push("vault");
      break;
    }
  }
  // the arena: bare floor, the boss, and behind it the crack that leads further down
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fixed[y * W + x] === 2) { m.o[y][x] = " "; if (m.g[y][x] === "W") m.g[y][x] = "c"; }
  for (const [x, y] of [[arena[0] - 4, arena[1] - 4], [arena[0] + 4, arena[1] - 4], [arena[0] - 4, arena[1] + 4], [arena[0] + 4, arena[1] + 4]]) m.o[y][x] = "K";
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fixed[y * W + x] === 1) { m.g[y][x] = "W"; m.o[y][x] = " "; }
  for (let x = ante[0] + 3; x <= arena[0] - 5; x++) for (const y of [11, 12]) digAt(m, x, y);
  for (let x = arena[0] + 5; x <= W - 3; x++) for (const y of [10, 11]) digAt(m, x, y);
  clear(m, start[0] - 3, start[1] - 2, start[0] + 3, start[1] + 2);
  // who lives where: the further from the way in, the worse
  for (const z of order) {
    if (z.kind === "camp") continue;
    const t = z.t, rect = coreRect(m, z.r, inner, 2), elite = 0.04 + 0.16 * t;
    const n = Math.max(1, Math.round(z.r.area / cfg.tpm) - (z.kind === "lake" ? 2 : 0));
    m.spawns.push({ k: t < 0.22 ? "spiderhand" : t < 0.42 ? "splitboar_frost" : t < 0.58 ? "moleworm" : t < 0.76 ? "owlstare" : t < 0.9 ? "hydrasnake_steel" : "bearmaw", n: t < 0.15 ? Math.min(n, 3) : n, r: rect, elite });
    if (t >= 0.3 && n >= 3) m.spawns.push({ k: t < 0.5 ? "spiderhand" : t < 0.8 ? "moleworm" : "owlstare", n: 2, r: rect, elite });
  }
  m.spawns.push({ k: "bearmaw", n: 4, r: [ante[0] - 3, ante[1] - 2, ante[0] + 3, ante[1] + 2], elite: 0.3 });
  m.spawns.push({ k: "boss", n: 1, r: [arena[0], arena[1] - 1, arena[0] + 1, arena[1]] });
  m.gates = {
    west: { t: [[3, start[1] - 1], [3, start[1]]], a: [[6, start[1] - 1], [6, start[1]]] },
    rift: { t: [[W - 3, 10], [W - 3, 11]], a: [[arena[0] + 5, 10], [arena[0] + 5, 11]] },
  };
  for (const name of Object.keys(m.gates)) for (const [x, y] of m.gates[name].t.concat(m.gates[name].a)) digAt(m, x, y);
  for (let x = 3; x <= start[0]; x++) for (const y of [start[1] - 1, start[1]]) digAt(m, x, y);
  m.entry = m.gates.west.a[0];
  const pts = [m.gates.west.a[1], [arena[0], arena[1] + 3], ante, m.gates.rift.a[0], m.gates.rift.t[0]];
  for (const z of order) pts.push(spot(m, z.r.px, z.r.py));
  for (const [x, y] of vaults) pts.push([x + 1, y + 1], [x + 2, y + 1]);
  cover(m, cfg.mobs);
  knit(m, pts, "c");
  m.regions = order.length;
  return m;
}

/**
 * The crypt: the rock is cut by binary space partition into cells of every size;
 * each cell holds a room of its own shape — a chapel (round), a cross, a pillared
 * hall, an L, an octagon, a plain vault with ragged walls. A spanning tree over the
 * neighbouring rooms (from the entrance, with few loops) decides the corridors,
 * which A* digs through the rock with a price on every turn. Dead ends are ossuaries
 * with a chest; the deepest room holds the guardian and the way out.
 */
function catacomb(cfg) {
  const box = { seed: cfg.seed }, S0 = cfg.seed;
  const W = cfg.w, H = cfg.h;
  const m = blank(cfg.id, cfg.name, W, H, "W");
  m.bgm = cfg.bgm || "cave"; m.theme = cfg.theme; m.pieces = [];
  const N1 = field(m, S0 + 5, 5, 2);
  // the cells
  const cells = [];
  const split = (x0, y0, x1, y1, d) => {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const canV = w >= cfg.min * 2, canH = h >= cfg.minH * 2;
    if ((!canV && !canH) || (d > 2 && w * h < cfg.leaf && rnd(box) < 0.6)) { cells.push({ x0, y0, x1, y1 }); return; }
    if (canV && (!canH || w / h > 1.15 || (w / h > 0.85 && rnd(box) < 0.5))) { const at2 = x0 + cfg.min + ri(box, 0, w - cfg.min * 2); split(x0, y0, at2 - 1, y1, d + 1); split(at2, y0, x1, y1, d + 1); }
    else { const at2 = y0 + cfg.minH + ri(box, 0, h - cfg.minH * 2); split(x0, y0, x1, at2 - 1, d + 1); split(x0, at2, x1, y1, d + 1); }
  };
  split(3, 3, W - 4, H - 4, 0);
  // the entrance: the cell nearest the middle of the west edge
  const mid = (c) => [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2];
  let entry = 0;
  cells.forEach((c, k) => { if (Math.hypot(c.x0 - 3, mid(c)[1] - H * cfg.entryY) < Math.hypot(cells[entry].x0 - 3, mid(cells[entry])[1] - H * cfg.entryY)) entry = k; });
  // neighbours: cells that share a stretch of wall
  const edges = [];
  for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
    const A = cells[a], B = cells[b];
    const xo = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), yo = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
    if ((Math.abs(A.x1 + 1 - B.x0) <= 1 || Math.abs(B.x1 + 1 - A.x0) <= 1) && yo >= 3) edges.push([a, b]);
    else if ((Math.abs(A.y1 + 1 - B.y0) <= 1 || Math.abs(B.y1 + 1 - A.y0) <= 1) && xo >= 3) edges.push([a, b]);
  }
  const tree = grow(box, cells.length, edges, entry, cfg.wind, cfg.loops);
  const far = tree.far;
  let exit = entry;
  cells.forEach((c, k) => { if (tree.dist[k] > tree.dist[exit] || (tree.dist[k] === tree.dist[exit] && c.x1 > cells[exit].x1)) exit = k; });
  const main = tree.path(exit), onMain = new Set(main);
  // what each room is
  const kind = cells.map(() => "room");
  kind[entry] = "gate"; kind[exit] = cfg.boss ? "arena" : "guard";
  if (cfg.boss && main.length > 2) kind[main[main.length - 2]] = "guard";
  const campAt = main[Math.floor(main.length / 2)];
  if (kind[campAt] === "room") kind[campAt] = "camp";
  cells.forEach((c, k) => { if (kind[k] === "room" && tree.deg[k] === 1) kind[k] = "vault"; });
  // the rooms: each cell's shape
  const roomOf = new Int16Array(W * H).fill(-1);
  const rooms = cells.map((c, k) => {
    const pad = kind[k] === "vault" ? 2 : kind[k] === "room" ? 1 + ri(box, 0, 1) : 1;
    let x0 = c.x0 + pad, y0 = c.y0 + pad, x1 = c.x1 - pad, y1 = c.y1 - pad;
    if (kind[k] === "room" && rnd(box) < 0.5) { const sw = ri(box, 0, Math.max(0, (x1 - x0 - 5) >> 1)), sh = ri(box, 0, Math.max(0, (y1 - y0 - 4) >> 1)); x0 += sw; x1 -= ri(box, 0, sw); y0 += sh; y1 -= ri(box, 0, sh); }
    if (kind[k] === "vault") { const cx2 = (x0 + x1) >> 1, cy2 = (y0 + y1) >> 1; x0 = Math.max(x0, cx2 - 2); x1 = Math.min(x1, cx2 + 2); y0 = Math.max(y0, cy2 - 2); y1 = Math.min(y1, cy2 + 1); }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const shapes = kind[k] === "room" ? cfg.shapes : kind[k] === "vault" ? ["octagon", "plain"] : ["plain"];
    const shape = w >= 7 && h >= 6 ? shapes[ri(box, 0, shapes.length - 1)] : "plain";
    const inside = (x, y) => {
      const u = (x - cx) / (w / 2), v = (y - cy) / (h / 2);
      if (shape === "chapel") return u * u + v * v <= 1.08;
      if (shape === "cross") return Math.abs(u) < 0.42 || Math.abs(v) < 0.42;
      if (shape === "octagon") return Math.abs(u) + Math.abs(v) <= 1.5;
      if (shape === "ell") return !(u > 0.15 && v < -0.15);
      return true;
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) { digAt(m, x, y); roomOf[y * W + x] = k; }
    if (shape === "plain" && kind[k] === "room") {
      // ragged walls
      for (let x = x0; x <= x1; x++) { if (rnd(box) < 0.3) digAt(m, x, y0 - 1); if (rnd(box) < 0.3) digAt(m, x, y1 + 1); }
      for (let y = y0; y <= y1; y++) { if (rnd(box) < 0.3) digAt(m, x0 - 1, y); if (rnd(box) < 0.3) digAt(m, x1 + 1, y); }
    }
    m.pieces.push(shape);
    return { k, x0, y0, x1, y1, cx: Math.round(cx), cy: Math.round(cy), w, h, shape };
  });
  // the corridors: two wide along the critical path, often single file elsewhere
  const avoid = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) if (roomOf[i] >= 0) avoid[i] = 2.5;
  const hall = new Uint8Array(W * H);
  for (const e of edges) {
    const [a, b] = e;
    if (!tree.linked(a, b)) continue;
    const A = rooms[a], B = rooms[b];
    const wd = onMain.has(a) && onMain.has(b) ? 2 : rnd(box) < 0.5 ? 1 : 2;
    const sa = spot(m, A.cx, A.cy), sb = spot(m, B.cx, B.cy);
    for (const i of [sa[1] * W + sa[0], sb[1] * W + sb[0]]) avoid[i] = 0;
    const p = tunnel(m, sa, sb, wd, avoid, 3);
    for (const t of p) if (roomOf[t] < 0) hall[t] = 1;
  }
  // furnishing, by room
  const free = (x, y) => m.g[y][x] !== "W" && m.o[y][x] === " " && !hall[y * W + x];
  const T2 = cfg.dress;
  const pts = [], gates = {};
  /**
   * The two holy rooms. A chapel: a runner carpet (`n`) down its long axis to an altar (`9`)
   * against the far wall, candles (`3`) either side of it, pews (`I`) in rows across the nave
   * with an aisle by the carpet. An octagon: a ring of inlaid stone (`i`) round a sarcophagus
   * (`1`) on the middle, candles at the four diagonals.
   */
  const hallow = (r, k) => {
    const inRoom = (x, y) => roomOf[y * W + x] === k && m.g[y][x] !== "W" && m.g[y][x] !== "w" && !hall[y * W + x];
    const edge = (x, y) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => m.g[y + dy][x + dx] === "W");
    const put = (x, y, ch) => { if (inRoom(x, y) && m.o[y][x] === " ") m.o[y][x] = ch; };
    if (r.shape === "chapel") {
      // along y when the room is taller than wide: the altar at the north end; else along x, the altar at the west end
      const vert = r.h >= r.w;
      const at = (s, t) => (vert ? [r.cx + t, s] : [s, r.cy + t]);
      const s0 = vert ? r.y0 : r.x0, s1 = vert ? r.y1 : r.x1;
      let head = s0;
      while (head < s1 && !inRoom(...at(head, 0))) head++;
      for (let s = head + 1; s <= s1; s++) { const [x, y] = at(s, 0); if (inRoom(x, y)) { m.g[y][x] = "n"; m.o[y][x] = " "; } }
      { const [x, y] = at(head, 0); m.o[y][x] = "9"; }
      for (const t of [-1, 1]) put(...at(head, t), "3");
      const half = Math.floor((vert ? r.w : r.h) / 2);
      for (let s = head + 3; s <= s1 - 1; s += 2) for (let t = 2; t <= half; t++) for (const sg of [-1, 1]) {
        const [x, y] = at(s, t * sg);
        if (inRoom(x, y) && !edge(x, y)) put(x, y, "I");
      }
    } else {
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, R = Math.min(r.w, r.h) / 2 - 1;
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (inRoom(x, y) && Math.hypot(x - cx, y - cy) <= R && m.g[y][x] === "c") m.g[y][x] = "i";
      m.o[r.cy][r.cx] = "1";
      if (R >= 2.5) for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) put(r.cx + dx, r.cy + dy, "3");
    }
  };
  rooms.forEach((r) => {
    const k = r.k, t = Math.max(0, tree.dist[k]) / far, d = tree.dist[k];
    const inner = [r.x0, r.y0, r.x1, r.y1];
    const cellFree = (x, y) => roomOf[y * W + x] === k && free(x, y);
    const ptI = pts.push(spot(m, r.cx, r.cy)) - 1;
    const wallN = (x, y) => m.g[y - 1][x] === "W";
    if (kind[k] === "room") {
      // a chapel and an octagon are furnished as what they are (see `hallow` below), whatever else was drawn
      let style = cfg.styles[ri(box, 0, cfg.styles.length - 1)];
      if (r.shape === "chapel" || r.shape === "octagon") style = r.shape;
      m.pieces.push(style);
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
        if (!cellFree(x, y)) continue;
        const h = h2(x, y, S0 + 9), edge = wallN(x, y) || m.g[y][x - 1] === "W" || m.g[y][x + 1] === "W" || m.g[y + 1][x] === "W";
        if (style === "pillars") { if ((x - r.x0) % 3 === 1 && (y - r.y0) % 3 === 1 && !edge && Math.abs(x - r.cx) + Math.abs(y - r.cy) > 1) m.o[y][x] = T2.pillar; }
        else if (style === "pool") { if (Math.hypot((x - r.cx) * 0.8, y - r.cy) + (N1[y * W + x] - 0.5) * 1.6 < Math.min(r.w, r.h) * 0.28) { m.g[y][x] = "w"; } }
        else if (style === "rows") { if (!edge && (y - r.y0) % 3 === 1 && (x - r.x0) % 4 !== 0 && (x - r.x0) % 4 !== 3 && x !== r.cx && h < 0.9) m.o[y][x] = T2.rows; }
        else if (style === "rubble") { if (N1[y * W + x] > 0.68 && !edge && Math.abs(x - r.cx) + Math.abs(y - r.cy) > 2) { m.g[y][x] = "W"; } else if (h < 0.08) m.o[y][x] = T2.junk; }
        else if (style === "shrine") { if (Math.abs(Math.hypot(x - r.cx, (y - r.cy) * 1.3) - Math.min(r.w, r.h) * 0.36) < 0.5 && h < 0.6) m.o[y][x] = T2.ring; }
        if (m.o[y][x] === " " && m.g[y][x] !== "w" && m.g[y][x] !== "W") {
          if (wallN(x, y)) { let acc = 0; for (const [ch2, p] of T2.wall) { acc += p; if (h < acc) { m.o[y][x] = ch2; break; } } }
          else if (!edge && style !== "chapel" && style !== "octagon") { let acc = 0; for (const [ch2, p] of T2.floor) { acc += p; if (h > 1 - acc) { m.o[y][x] = ch2; break; } } }
        }
      }
      if (style === "pool") pts.push([r.x0, r.y0]);
      denSpawns(m, box, cfg, inner, t, d, !onMain.has(k), style === "pillars" ? 1 : 0);
    } else if (kind[k] === "gate") {
      gates.in = { t: [[r.x0, r.cy], [r.x0, r.cy + 1]], a: [[r.x0 + 2, r.cy], [r.x0 + 2, r.cy + 1]] };
      m.spawns.push({ k: cfg.mobs[0], n: 1, r: [r.cx, r.y0, r.x1, r.y1], elite: 0 });
    } else if (kind[k] === "camp") {
      m.o[r.y0][r.x0] = "E";
      FIRES[cfg.id].push([r.cx, r.cy]);
      m.pieces.push("camp");
    } else if (kind[k] === "vault") {
      // a side branch worth the detour: a chest among the dead, and guards a notch above the rooms around;
      // in the ossuary the floor itself is strewn with bones (`d`)
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
        if (cellFree(x, y) && (x === r.x0 || x === r.x1) && h2(x, y, 5) < 0.6) m.o[y][x] = T2.vault;
        if (cfg.vaultName === "ossuary" && roomOf[y * W + x] === k && m.g[y][x] === "c") m.g[y][x] = "d";
      }
      m.spawns.push({ k: cfg.chest, n: 1, r: [r.cx, r.y0, r.cx, r.y0] });
      m.o[r.y0][r.cx] = " ";
      m.spawns.push({ k: cfg.mobs[Math.min(cfg.mobs.length - 1, Math.floor(t * cfg.mobs.length) + 1)], n: 2 + (t > 0.5 ? 1 : 0), r: inner, elite: 0.35 });
      pts.push([r.cx, r.y0]);
      m.pieces.push(cfg.vaultName);
    } else if (kind[k] === "guard") {
      m.spawns.push({ k: cfg.guard, n: 1, r: [r.cx, r.cy, r.cx, r.cy], el: 2 });
      m.spawns.push({ k: cfg.mobs[cfg.mobs.length - 1], n: 3, r: inner, elite: 0.25 });
      m.spawns.push({ k: cfg.chest, n: 1, r: [r.x1 - 1, r.y0, r.x1 - 1, r.y0] });
      pts.push([r.x1 - 1, r.y0]);
      if (cfg.out && k === exit) gates.out = { t: [[r.x1, r.cy], [r.x1, r.cy + 1]], a: [[r.x1 - 2, r.cy], [r.x1 - 2, r.cy + 1]] };
    } else if (kind[k] === "arena") {
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (roomOf[y * W + x] === k) { m.o[y][x] = " "; if (m.g[y][x] === "w") m.g[y][x] = "c"; }
      for (const [x, y] of [[r.x0 + 1, r.y0 + 1], [r.x1 - 1, r.y0 + 1], [r.x0 + 1, r.y1 - 1], [r.x1 - 1, r.y1 - 1]]) if (m.g[y][x] !== "W") m.o[y][x] = T2.pillar;
      m.spawns.push({ k: cfg.boss, n: 1, r: [r.cx, r.cy, r.cx, r.cy] });
    }
    // keep the middle of every room walkable
    for (let y = r.cy - 1; y <= r.cy + 1; y++) for (let x = r.cx - 1; x <= r.cx + 1; x++) if (roomOf[y * W + x] === k) { m.o[y][x] = " "; if (m.g[y][x] === "W") m.g[y][x] = "c"; }
    if (kind[k] === "room" && (r.shape === "chapel" || r.shape === "octagon")) { hallow(r, k); pts[ptI] = spot(m, r.cx, r.cy); }
  });
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (m.g[y][x] === "c" && h2(x, y, S0) < 0.12) m.g[y][x] = "d";
  for (const name of Object.keys(gates)) for (const [x, y] of gates[name].t.concat(gates[name].a)) { m.o[y][x] = " "; if (m.g[y][x] !== "d") m.g[y][x] = "c"; pts.push([x, y]); }
  m.gates = gates;
  m.entry = gates.in.a[0];
  cover(m, cfg.mobs);
  knit(m, pts, "c");
  m.regions = cells.length;
  return m;
}

/**
 * The sewer: junction chambers (Poisson sites) joined by tunnels that A* digs with a
 * heavy price on turning, so they run straight and turn square. Every tunnel is five
 * wide — a walkway two wide, two of sludge, a ledge — and every junction a round chamber
 * with a grated sump where the channels fall in. Dead ends are pump rooms (drums, a
 * chest) or cisterns (a tank of sludge with a walk round it); the deepest junction
 * holds the guardian and the way back up.
 */
function sewers(cfg) {
  const box = { seed: cfg.seed }, S0 = cfg.seed;
  const W = cfg.w, H = cfg.h;
  const m = blank(cfg.id, cfg.name, W, H, "W");
  m.bgm = cfg.bgm || "cave"; m.theme = cfg.theme; m.pieces = [];
  const pts0 = poisson(box, 8, 7, W - 9, H - 8, cfg.r, [[8, 8]]);
  const n = pts0.length;
  // neighbours: a Gabriel graph — two junctions are joined if no third lies in the circle between them
  const edges = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const [ax, ay] = pts0[a], [bx, by] = pts0[b], cx = (ax + bx) / 2, cy = (ay + by) / 2, r2 = ((ax - bx) ** 2 + (ay - by) ** 2) / 4;
    if (r2 > (cfg.r * 1.9) ** 2) continue;
    let ok = true;
    for (let c = 0; c < n && ok; c++) if (c !== a && c !== b && (pts0[c][0] - cx) ** 2 + (pts0[c][1] - cy) ** 2 < r2) ok = false;
    if (ok) edges.push([a, b]);
  }
  const tree = grow(box, n, edges, 0, cfg.wind, cfg.loops);
  const far = tree.far;
  let exit = 0;
  for (let k = 0; k < n; k++) if (tree.dist[k] > tree.dist[exit]) exit = k;
  const main = tree.path(exit), onMain = new Set(main);
  const node = pts0.map(([x, y], k) => ({ k, x: Math.round(x), y: Math.round(y) }));
  const kind = node.map(() => "junction");
  kind[0] = "gate"; kind[exit] = "guard";
  const campAt = main[Math.floor(main.length / 2)];
  if (kind[campAt] === "junction") kind[campAt] = "camp";
  let dn = 0;
  for (let k = 0; k < n; k++) if (kind[k] === "junction" && tree.deg[k] === 1) kind[k] = dn++ % 2 ? "cistern" : "pump";
  // tunnels: centreline first, then the walkways and the channel either side of it
  const chan = new Uint8Array(W * H);
  const tunnels = [];
  for (const [a, b] of edges) {
    if (!tree.linked(a, b)) continue;
    const A = node[a], B = node[b];
    const path = walk(W, H, A.y * W + A.x, (i) => i === B.y * W + B.x, (j, i, back) => {
      const x = j % W, y = (j - x) / W;
      if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) return Infinity;
      let c = m.g[y][x] === "W" ? 1 : 0.6;
      if (back >= 0 && j - i !== i - back) c += 9;
      return c;
    }, B.x, B.y, 1);
    if (!path) continue;
    for (let s = 0; s < path.length; s++) {
      const t = path[s], x = t % W, y = (t - x) / W, nx = path[s + 1] ?? path[s - 1], horiz = Math.abs(nx - t) === 1;
      // a walkway two wide, the channel, and a ledge one wide on the far side
      for (let o = -2; o <= 2; o++) {
        const X = horiz ? x : x + o, Y = horiz ? y + o : y;
        if (m.g[Y][X] === "W") digAt(m, X, Y);
        if (o === 0 || o === 1) chan[Y * W + X] = 1;
      }
    }
    tunnels.push({ a, b, path });
  }
  for (let i = 0; i < W * H; i++) if (chan[i]) m.g[Math.floor(i / W)][i % W] = "w";
  // chambers over the junctions: round floors, a grated sump in the middle
  const room = (cx, cy, rx, ry) => { for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) if (((x - cx) / (rx + 0.4)) ** 2 + ((y - cy) / (ry + 0.4)) ** 2 <= 1) { digAt(m, x, y); } };
  node.forEach((nd, k) => {
    const big = kind[k] === "guard" || kind[k] === "camp" || kind[k] === "gate" ? 4 : kind[k] === "junction" ? 3 + (h2(nd.x, nd.y, S0) < 0.4 ? 1 : 0) : 0;
    if (big) room(nd.x, nd.y, big + 1, big);
    if (kind[k] === "junction") { m.g[nd.y][nd.x] = "g"; m.g[nd.y][nd.x + 1] = "g"; m.pieces.push("junction"); }
  });
  // dead ends: a pump room (drums, a chest) or a cistern (a tank of sludge with a walk round it)
  const pts = [], gates = {};
  node.forEach((nd, k) => {
    const t = Math.max(0, tree.dist[k]) / far, d = tree.dist[k];
    pts.push(spot(m, nd.x, nd.y));
    if (kind[k] === "pump") {
      for (let y = nd.y - 2; y <= nd.y + 2; y++) for (let x = nd.x - 3; x <= nd.x + 3; x++) digAt(m, x, y);
      for (const [x, y] of [[nd.x - 3, nd.y - 2], [nd.x + 3, nd.y - 2], [nd.x - 3, nd.y + 2], [nd.x + 3, nd.y + 1], [nd.x - 2, nd.y - 2]]) m.o[y][x] = "7";
      m.o[nd.y + 2][nd.x + 2] = "n"; m.o[nd.y + 2][nd.x - 2] = "n";
      m.o[nd.y - 2][nd.x + 2] = "6";
      m.spawns.push({ k: cfg.chest, n: 1, r: [nd.x, nd.y - 1, nd.x, nd.y - 1] });
      m.spawns.push({ k: cfg.mobs[Math.min(cfg.mobs.length - 1, Math.floor(t * cfg.mobs.length) + 1)], n: 2 + (t > 0.5 ? 1 : 0), r: [nd.x - 3, nd.y - 2, nd.x + 3, nd.y + 2], elite: 0.35 });
      pts.push([nd.x, nd.y - 1]);
      m.pieces.push("pump");
    } else if (kind[k] === "cistern") {
      for (let y = nd.y - 3; y <= nd.y + 3; y++) for (let x = nd.x - 4; x <= nd.x + 4; x++) { digAt(m, x, y); if (Math.abs(x - nd.x) <= 2 && Math.abs(y - nd.y) <= 1) m.g[y][x] = "w"; }
      for (let x = nd.x - 2; x <= nd.x + 2; x++) m.g[nd.y][x] = x === nd.x ? "b" : m.g[nd.y][x];
      m.o[nd.y - 3][nd.x - 4] = "6"; m.o[nd.y - 3][nd.x + 4] = "6";
      m.spawns.push({ k: cfg.chest, n: 1, r: [nd.x + 4, nd.y + 3, nd.x + 4, nd.y + 3] });
      m.spawns.push({ k: cfg.mobs[Math.min(cfg.mobs.length - 1, Math.floor(t * cfg.mobs.length) + 1)], n: 3, r: [nd.x - 4, nd.y - 3, nd.x + 4, nd.y + 3], elite: 0.35 });
      pts.push([nd.x + 4, nd.y + 3]);
      m.pieces.push("cistern");
    } else if (kind[k] === "gate") {
      gates.in = { t: [[nd.x - 4, nd.y], [nd.x - 4, nd.y + 1]], a: [[nd.x - 2, nd.y], [nd.x - 2, nd.y + 1]] };
      m.spawns.push({ k: cfg.mobs[0], n: 1, r: [nd.x, nd.y - 3, nd.x + 4, nd.y + 3], elite: 0 });
    } else if (kind[k] === "camp") {
      m.o[nd.y - 3][nd.x - 2] = "E";
      FIRES[cfg.id].push([nd.x + 1, nd.y + 1]);
      m.pieces.push("camp");
    } else if (kind[k] === "guard") {
      m.spawns.push({ k: cfg.guard, n: 1, r: [nd.x, nd.y, nd.x, nd.y], el: 2 });
      m.spawns.push({ k: cfg.mobs[cfg.mobs.length - 1], n: 3, r: [nd.x - 4, nd.y - 3, nd.x + 4, nd.y + 3], elite: 0.25 });
      m.spawns.push({ k: cfg.chest, n: 1, r: [nd.x + 3, nd.y - 3, nd.x + 3, nd.y - 3] });
      pts.push([nd.x + 3, nd.y - 3]);
      gates.out = { t: [[nd.x + 5, nd.y], [nd.x + 5, nd.y + 1]], a: [[nd.x + 3, nd.y], [nd.x + 3, nd.y + 1]] };
    } else {
      denSpawns(m, box, cfg, [nd.x - 3, nd.y - 3, nd.x + 3, nd.y + 3], t, d, !onMain.has(k));
    }
    if (kind[k] !== "cistern" && kind[k] !== "pump") for (let y = nd.y - 1; y <= nd.y + 1; y++) for (let x = nd.x - 1; x <= nd.x + 2; x++) if (m.g[y][x] === "w") m.g[y][x] = "g";
  });
  // the tunnels between: monsters along them by depth, a footbridge across the channel now and then, pipes dribbling into it
  for (const tn of tunnels) {
    const t = Math.max(tree.dist[tn.a], tree.dist[tn.b]) / far, d = Math.max(tree.dist[tn.a], tree.dist[tn.b]);
    for (let s = 6; s + 6 < tn.path.length; s += 9) {
      const c = tn.path[s], x = c % W, y = (c - x) / W;
      denSpawns(m, box, cfg, [x - 2, y - 2, x + 2, y + 2], t, d, !(onMain.has(tn.a) && onMain.has(tn.b)), -1);
      const nx = tn.path[s + 1], horiz = Math.abs(nx - c) === 1;
      if (h2(x, y, S0 + 2) < 0.45) for (let o = 0; o <= 1; o++) { const X = horiz ? x : x + o, Y = horiz ? y + o : y; if (m.g[Y][X] === "w") m.g[Y][X] = "b"; }
    }
  }
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (m.g[y][x] !== "c" || m.o[y][x] !== " ") continue;
    const h = h2(x, y, S0 + 9);
    if (m.g[y - 1][x] === "W") { if (h < 0.1) m.o[y][x] = "6"; else if (h < 0.14) m.o[y][x] = "7"; else if (h < 0.16) m.o[y][x] = "x"; }
    else if (h > 0.975) m.o[y][x] = "7";
    else if (h > 0.96 && D4.some(([dx, dy]) => m.g[y + dy][x + dx] === "W")) m.o[y][x] = h > 0.968 ? "4" : "n";
    else if (h < 0.14) m.g[y][x] = "d";
  }
  for (const name of Object.keys(gates)) for (const [x, y] of gates[name].t.concat(gates[name].a)) { digAt(m, x, y); pts.push([x, y]); }
  m.gates = gates;
  m.entry = gates.in.a[0];
  cover(m, cfg.mobs);
  knit(m, pts, "c");
  m.regions = n;
  return m;
}

/**
 * The abyss: islands of flesh (noise-shaped blobs on Poisson sites) over a chasm of
 * blood, joined along a spanning tree of their Gabriel graph by bone bridges or
 * necks of flesh. Ribs arch over the bridgeheads, eyes on stalks watch from the edges;
 * dead-end islands keep a blood altar and a chest; the far island is the mother's.
 */
function abyssal(cfg) {
  const box = { seed: cfg.seed }, S0 = cfg.seed;
  const W = cfg.w, H = cfg.h;
  const m = blank(cfg.id, cfg.name, W, H, "W");
  m.bgm = cfg.bgm || "cave"; m.theme = cfg.theme; m.pieces = [];
  const N1 = field(m, S0 + 5, 5, 2), N2 = field(m, S0 + 6, 9, 2);
  // the chasm: everything inside a ragged rim of rock is blood
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const d = Math.min(x - 2, y - 2, W - 3 - x, H - 3 - y);
    if (d + (N2[y * W + x] - 0.5) * 5 > 2) m.g[y][x] = "w";
  }
  const sites = poisson(box, 8, 8, W - 9, H - 9, cfg.r, [[7, Math.round(H * 0.55)], [W - 12, 11]]);
  const n = sites.length;
  const isl = sites.map(([x, y], k) => ({ k, x: Math.round(x), y: Math.round(y), r: k === 1 ? 6.5 : k === 0 ? 4.6 : 2.9 + rnd(box) * 1.6 }));
  const edges = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const A = isl[a], B = isl[b], cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2, r2 = ((A.x - B.x) ** 2 + (A.y - B.y) ** 2) / 4;
    let ok = r2 < (cfg.r * 1.9) ** 2;
    for (let c = 0; c < n && ok; c++) if (c !== a && c !== b && (isl[c].x - cx) ** 2 + (isl[c].y - cy) ** 2 < r2) ok = false;
    if (ok && !(a === 1 || b === 1)) edges.push([a, b]);
  }
  const tree = grow(box, n, edges, 0, cfg.wind, cfg.loops);
  // the mother's island hangs off the deepest of its neighbours, by one bridge only
  let guardI = -1;
  for (let k = 2; k < n; k++) if (tree.dist[k] >= 0 && Math.hypot(isl[k].x - isl[1].x, isl[k].y - isl[1].y) < cfg.r * 2.2 && (guardI < 0 || tree.dist[k] > tree.dist[guardI])) guardI = k;
  if (guardI < 0) { let bd = Infinity; for (let k = 2; k < n; k++) { const d = Math.hypot(isl[k].x - isl[1].x, isl[k].y - isl[1].y); if (d < bd && tree.dist[k] >= 0) { bd = d; guardI = k; } } }
  tree.link.add(ekey(guardI, 1)); tree.dist[1] = tree.dist[guardI] + 1; tree.deg[guardI]++; tree.deg[1] = 1;
  const far = Math.max(1, ...tree.dist);
  const kind = isl.map(() => "isle");
  kind[0] = "gate"; kind[1] = "arena"; kind[guardI] = "guard";
  const main = [...tree.path(guardI), 1], onMain = new Set(main);
  const campAt = main[Math.floor(main.length / 2)];
  if (kind[campAt] === "isle") kind[campAt] = "camp";
  for (let k = 2; k < n; k++) if (kind[k] === "isle" && tree.deg[k] === 1) kind[k] = "altar";
  // the islands
  const owner = new Int16Array(W * H).fill(-1);
  for (const I of isl) {
    for (let y = I.y - 9; y <= I.y + 9; y++) for (let x = I.x - 10; x <= I.x + 10; x++) {
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) continue;
      const d = Math.hypot((x - I.x) * 0.8, y - I.y) + (N1[y * W + x] - 0.5) * 3;
      if (d < I.r) { m.g[y][x] = "c"; owner[y * W + x] = I.k; }
    }
  }
  for (let y = 2; y <= isl[1].y - 4; y++) for (let x = isl[1].x - 9; x <= isl[1].x + 9; x++) if (inMap(m, x, y) && y < isl[1].y - 4 + Math.round(Math.abs(x - isl[1].x) / 3)) { m.g[y][x] = "W"; owner[y * W + x] = -1; }
  // the way in: the first island reaches back to the rock of the rim
  for (let x = 3; x <= isl[0].x; x++) for (const y of [isl[0].y, isl[0].y + 1]) { m.g[y][x] = "c"; }
  // bridges: bone, two planks wide, or now and then a neck of flesh. Each runs along the grid
  // (a straight run, or two runs with one corner) so it reads as a clean diagonal in the iso
  // view instead of a staircase; of the two corners the one that keeps clear of other islands wins
  const bridges = [];
  const legs = (A, B, wide, hFirst) => {
    // rectangles [x0, y0, x1, y1]: a horizontal run on A's row, then a vertical run on B's column
    const o = wide === 3 ? -1 : 0, e = wide - 1 + o;
    if (Math.abs(B.y - A.y) <= 1) { const y = Math.min(A.y, B.y); return [[Math.min(A.x, B.x), y + o, Math.max(A.x, B.x), y + e]]; }
    if (Math.abs(B.x - A.x) <= 1) { const x = Math.min(A.x, B.x); return [[x + o, Math.min(A.y, B.y), x + e, Math.max(A.y, B.y)]]; }
    const [P, Q] = hFirst ? [A, B] : [B, A];
    return [[Math.min(P.x, Q.x + o), P.y + o, Math.max(P.x, Q.x + e), P.y + e], [Q.x + o, Math.min(P.y, Q.y), Q.x + e, Math.max(P.y + e, Q.y)]];
  };
  const cells = (rs) => { const out = []; for (const [x0, y0, x1, y1] of rs) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 3 && y >= 3 && x < W - 3 && y < H - 3) out.push([x, y]); return out; };
  for (const [a, b] of [...edges, [guardI, 1]]) {
    if (!tree.linked(a, b)) continue;
    const A = isl[a], B = isl[b];
    const flesh = a !== guardI && b !== 1 && rnd(box) < 0.2, wide = flesh ? 3 : 2;
    const cost = (cs) => {
      let c = 0;
      for (const [x, y] of cs) {
        const k = owner[y * W + x];
        if (k >= 0 && k !== a && k !== b) c += 4;
        // nothing but the guard's bridge may come near the mother's island
        if (b !== 1) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (owner[(y + dy) * W + x + dx] === 1) c += 100;
        if (m.g[y][x] === "b") c += 2;
      }
      return c;
    };
    const opts = [true, false].map((h) => cells(legs(A, B, wide, h)));
    const ca = cost(opts[0]), cb = cost(opts[1]);
    const pick = ca < cb ? opts[0] : cb < ca ? opts[1] : opts[rnd(box) < 0.5 ? 0 : 1];
    for (const [X, Y] of pick) if (m.g[Y][X] === "w" || m.g[Y][X] === "W") m.g[Y][X] = flesh ? "c" : "b";
    bridges.push({ a, b, flesh });
    m.pieces.push(flesh ? "neck" : "bridge");
  }
  // dressing: ribs where bridges touch land, eyes at the island edges, bones, the odd blister
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (m.g[y][x] !== "c" || m.o[y][x] !== " ") continue;
    const h = h2(x, y, S0 + 9);
    const nearB = D4.some(([dx, dy]) => m.g[y + dy][x + dx] === "b"), nearW = D4.some(([dx, dy]) => m.g[y + dy][x + dx] === "w");
    if (nearB && !D4.some(([dx, dy]) => m.g[y + dy][x + dx] === "c" && D4.some(([ex, ey]) => m.g[y + dy + ey] && m.g[y + dy + ey][x + dx + ex] === "b")) && h < 0.4) m.o[y][x] = "8";
    else if (nearW && !nearB && h < 0.08) m.o[y][x] = "0";
    else if (!nearW && h < 0.03) m.o[y][x] = "4";
    else if (h > 0.86) m.g[y][x] = "d";
  }
  const pts = [], gates = {};
  isl.forEach((I) => {
    const k = I.k, t = Math.max(0, tree.dist[k]) / far, d = tree.dist[k];
    const rect = [I.x - Math.floor(I.r) + 1, I.y - Math.floor(I.r * 0.9) + 1, I.x + Math.floor(I.r) - 1, I.y + Math.floor(I.r * 0.9) - 1];
    clear(m, I.x - 1, I.y - 1, I.x + 1, I.y + 1);
    pts.push(spot(m, I.x, I.y));
    if (kind[k] === "gate") {
      gates.in = { t: [[3, I.y], [3, I.y + 1]], a: [[5, I.y], [5, I.y + 1]] };
      m.spawns.push({ k: cfg.mobs[0], n: 1, r: rect, elite: 0 });
    } else if (kind[k] === "camp") {
      m.o[I.y - 2][I.x - 2] = m.g[I.y - 2][I.x - 2] === "c" ? "E" : " ";
      FIRES[cfg.id].push([I.x, I.y]);
      m.pieces.push("camp");
    } else if (kind[k] === "altar") {
      m.o[I.y - 1][I.x] = "X";
      for (const [x, y] of [[I.x - 2, I.y - 1], [I.x + 2, I.y - 1]]) if (m.g[y][x] === "c") m.o[y][x] = "0";
      m.spawns.push({ k: cfg.chest, n: 1, r: [I.x, I.y + 1, I.x, I.y + 1] });
      // an island is a tight place to meet an elite: the altars' keepers are a little less often one than a vault's
      m.spawns.push({ k: cfg.mobs[Math.min(cfg.mobs.length - 1, Math.floor(t * cfg.mobs.length) + 1)], n: 2 + (t > 0.5 ? 1 : 0), r: rect, elite: 0.2 });
      pts.push([I.x, I.y + 1]);
      m.pieces.push("altar");
    } else if (kind[k] === "guard") {
      m.spawns.push({ k: cfg.guard, n: 1, r: [I.x, I.y, I.x, I.y], el: 2 });
      m.spawns.push({ k: cfg.mobs[cfg.mobs.length - 1], n: 3, r: rect, elite: 0.25 });
      m.spawns.push({ k: cfg.chest, n: 1, r: [I.x + 1, I.y - 2, I.x + 1, I.y - 2] });
      pts.push([I.x + 1, I.y - 2]);
    } else if (kind[k] === "arena") {
      for (let y = I.y - 7; y <= I.y + 7; y++) for (let x = I.x - 8; x <= I.x + 8; x++) if (inMap(m, x, y) && m.g[y][x] === "c") m.o[y][x] = " ";
      for (const [x, y] of [[I.x - 4, I.y - 3], [I.x + 4, I.y - 3], [I.x - 4, I.y + 3], [I.x + 4, I.y + 3]]) if (m.g[y][x] !== "w") { m.g[y][x] = "c"; m.o[y][x] = "8"; }
      m.spawns.push({ k: cfg.boss, n: 1, r: [I.x, I.y, I.x, I.y] });
    } else {
      denSpawns(m, box, cfg, rect, t, d, !onMain.has(k), I.r > 4.6 ? 1 : 0);
    }
  });
  for (const name of Object.keys(gates)) for (const [x, y] of gates[name].t.concat(gates[name].a)) { m.g[y][x] = "c"; m.o[y][x] = " "; pts.push([x, y]); }
  m.gates = gates;
  m.entry = gates.in.a[0];
  cover(m, cfg.mobs);
  knit(m, pts, "c");
  m.regions = n;
  return m;
}

