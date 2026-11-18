// ───────────────────────────── 레이드던전: the party instance's map ─────────────────────────────
// docs/design/scale-and-rift.md D, H.7. A party's own dungeon floor, made on the spot from a seed. A run is three of them
// in a row (3단 레이드), each a fresh map from the run's seed and each its own concept (DIM_FLOORS: corridor halls, crystal
// caverns, an open blood field). Every floor lies on a 6 × 5 grid of cells (106 × 74 tiles): main rooms over a connected
// set of cells, joined by a spanning tree of links and several loops, the way in at one end, the final boss's hall at the
// far end, dead-end side rooms off the far half (vaults: a guardian and a chest; dens: two elites), and every room dressed
// by its type (ossuary, chapel, crystal garden, blood altar …) with the props its theme's own hunting ground draws. The
// floors are the four underground themes, so the browser draws them with the art it has. Monsters come from the theme's
// own kinds near the party's level (or, if the theme has none that close, from every hunting ground's kinds nearest
// that level). Pure: no world state, no MAPS.

/** Every number of the instance in one place (balance edits are data-only; the manager is 64-dim.js). */
const DIM = {
  max: 4, party: 4,                       // instances per channel room, players inside one
  // a floor: a `grid` of GX × GY cells of CW × CH tiles (106 × 74; the owner, 2026-11-15: five times the old 56 × 40 and more);
  // rooms per floor and packs per room in DIM_FLOORS; side rooms: `vaults` (a guardian and a chest) and `dens` (two elites)
  w: 106, h: 74, grid: [6, 5, 17, 14], deco: 1.5, path: 60, vaults: [2, 3], dens: [1, 2], pack: [3, 5], mobCap: 110, cap: 140,
  limit: 900000, warn: 180000,            // the whole three-floor run: a generous 15-minute cap (not a time attack: it only stops the step being pushed to farm); a warning with 3 minutes left
  // 3단 레이드 (owner, 2026-11-15): three floors in a row. Pace (owner, 2026-11-16): a party killing quickly fills the three gauges in ≈ 6 minutes and the final boss dies in ≤ 3. At 100% floors 1–2 open
  // 하강의 문 (everyone inside goes down after `downMs`, sooner once all standing stepped within `downR`); floor 3's 100%
  // wakes the final boss in its hall at the far end. Per floor: monster health and blows ×, pack leaders made elite,
  // elite traits; `boss` the final boss's traits.
  floors: 3, minTier: 10, downMs: 10000, downR: 16, ckR: 12, hallR: 30,   // (minTier: the lowest world tier a raid is made for = Lv.37 shown, defs().dim.minLv; ckR: the fallen get up this many steps short of the final boss's hall; hallR: 균열의 문 opens past this)
  floor: [{ hp: 1, atk: 1, elites: 0, traits: 1 }, { hp: 1.1, atk: 1.03, elites: 1, traits: 1 }, { hp: 1.2, atk: 1.06, elites: 1, traits: 1, boss: 2 }],
  emptyMs: 20000, portalMs: 90000, failMs: 8000, memberMs: 180000, rcMs: 20000, near: 80,
  // the gauge: a kill, an elite (guardians too), an orb an elite leaves behind, each × `gK` percent — fixed, so 100% takes
  // about 26 kills (gK 4.2; was 44 at 2.5) however many monsters a big floor holds: the party picks a route, never clears it all
  normal: 0.9, elite: 4, orb: 3, orbMs: 25000, orbR: 36, gK: 4.2,
  // shrines (pylons): chance per elite (always on the 3rd and 6th), how long one stands, reach
  shrineP: 0.35, shrineMs: 30000, shrineR: 20, buffR: 400,
  pylons: { atk: ["분노의 기둥", 25000], spd: ["질풍의 기둥", 20000], shield: ["수호의 기둥", 20000], gauge: ["정령의 기둥", 0] },
  atkK: 0.25, ward: 0.25, gaugeMp: 0.3,
  // how much more killing a rift monster takes than its wild kin, for a party of four at the band (measured with
  // the bot party in tests/dimrift.mjs; the low bands get more, `hpLow` = [below this level, + per level]); `hpN` by
  // party size (a lone player faces 30% of it); `lvK` per level the party outranks it; the master `bossHp` of that, hitting
  // `bossAtk` as hard as a field boss of its kind (hpBase 5.8 → 8.2 after jobs J1 made heroes ≈ 30 % quicker killers,
  // → 5.4 with J2's weapon skills, which lost the old kits' party heals, taunts and guards:
  // bot clears 5.2 / 5.6 / 6.3 / 7.0 min at tiers 17 / 24 / 32 / 40; → 4.9 and a low-band step of 0.85 once the test
  // ran five draws of each rift (a hard seed at 24 and at 17 wiped the party): clears 4.7–8.2 min, 6.2 on average)
  // pace retune (2026-11-16): `hpBase` 4.9 → 4 and `gK` 2.5 → 4.2 (bots of 2–4: gauges 7–10 → 3.5–6 min; real play is ≈ 1.5× slower than
  // the bots: QA's two Lv.196 took 12.5 min where the duo bots took 7); `bossHp` 0.65 → 0.6 (0.8 would keep the old boss health but wipe-looped the low band: 22–30 deaths on two of twelve draws; 0.6 clears all but a stuck bot)
  // 3-floor raid (2026-11-15), 4 bots × 4 draws at tiers 17 / 32 / 44: `hpMid` [band, width, + at it] adds 0.5 at 32 (the
  // mid band ran 7.5–9 min), `hpHigh` [above this level, − per level] trims the top band (44 took 12+ min), the final boss
  // `bossHp` 0.65 at floor 3's row (0.8 made low-band parties wipe-loop on it): clears 8.6–11.3 min, 9.7 on average.
  hpBase: 4, hpLow: [24, 0.85], hpHigh: [38, 0.12], hpMid: [32, 8, 0.5], hpN: [0.3, 0.6, 0.8, 1], lvK: 0.1, bossHp: 0.6, bossAtk: 0.7, poolLv: [3, 2],
  reviveMs: 25000,
  // the final boss's chest, per member: gold × lv, a share of a level, rare gear, stones, a rune now and then (what the old
  // ladder's tier 3 paid); a failed run's consolation is `failGold` × lv a floor reached
  reward: { gold: 67, xp: 0.054, gearQ: 3, stone: 2, rune: 0.25 }, dailyFull: 3, failGold: 30, lootGold: 0.5,
  // loot tables read a tier (LOOT_X): the old ladder's tier 15 keeps the economy review's supply of skill stones and uncurse scrolls
  lootTier: 15,
  // the week's first full clear (Monday 06:00 KST): `gold` × lv, `stone`, `unc` 저주 해제 주문서 and a job reset scroll
  weekly: { gold: 240, stone: 6, unc: 2 },
  // carry guard: a member more than `carryLv` world tiers under the party's best, or who dealt under `carryShare` of an even
  // share of the damage, gets `carryK` of the gold and experience and no gear, record or weekly bonus
  carryLv: 6, carryShare: 0.2, carryK: 0.4,
};
/**
 * The four looks: the name players see, the liquid of their pools, and their room types — how a room of that type is
 * dressed, from object and ground chars that theme's own hunting ground draws (plus the fields' rocks `R` and broken
 * pillars `q`). Steps: ["edge", ch, p] props hugging the walls · ["clump", ch, n, size] n clusters grown from a wall ·
 * ["rows", ch] rows with aisles (pews, coffins) · ["altar", ch, flank] a centrepiece north of the middle, two flanking ·
 * ["ring", ch, r] a broken ring round the middle · ["pool", ch, r] a ragged pool · ["patch", ground, t] ground where the noise passes t.
 */
const DIM_THEMES = {
  crypt: { name: "뼈의 균열", pool: "w", rooms: {
    ossuary: [["edge", "4", 0.3], ["clump", "5", 2, 1], ["patch", "d", 0.5]],
    tomb: [["rows", "1"], ["edge", "2", 0.14], ["edge", "3", 0.05]],
    chapel: [["rows", "I"], ["altar", "9", "3"], ["patch", "k", 0.35]],
    shrine: [["altar", "9", "3"], ["ring", "3", 3], ["patch", "i", 0.4]],
    flooded: [["pool", "w", 3], ["edge", "4", 0.08]],
    ruin: [["clump", "q", 3, 2], ["clump", "R", 2, 2], ["patch", "d", 0.42]],
  } },
  sewer: { name: "오수의 균열", pool: "w", rooms: {
    pipes: [["edge", "6", 0.22], ["edge", "7", 0.05], ["patch", "g", 0.6]],
    dump: [["clump", "7", 3, 3], ["clump", "n", 2, 2], ["edge", "x", 0.05]],
    flooded: [["pool", "w", 4], ["edge", "6", 0.1]],
    cistern: [["patch", "k", 0.3], ["edge", "3", 0.08], ["clump", "7", 1, 2]],
    ruin: [["clump", "R", 3, 2], ["clump", "q", 2, 1], ["patch", "d", 0.42]],
  } },
  cave: { name: "수정의 균열", pool: "w", rooms: {
    crystal: [["clump", "K", 4, 3], ["edge", "K", 0.1]],
    grove: [["ring", "Y", 3], ["clump", "Y", 2, 2], ["patch", ";", 0.4]],
    spires: [["edge", "S", 0.2], ["clump", "S", 3, 2]],
    lake: [["pool", "w", 4], ["edge", "K", 0.1], ["patch", "s", 0.5]],
    mine: [["edge", "M", 0.04], ["clump", "n", 2, 2], ["clump", "R", 2, 2], ["patch", ":", 0.45]],
    // an overgrown grotto: layered clusters — a stream-fed pool, giant mushrooms, mossy rocks, fallen logs and stumps
    grotto: [["pool", "w", 2], ["clump", "Y", 3, 3], ["clump", "R", 2, 2], ["edge", "l", 0.05], ["edge", "u", 0.05], ["patch", ";", 0.35]],
  } },
  abyss: { name: "핏빛 균열", pool: "w", rooms: {
    eyes: [["edge", "0", 0.15], ["clump", "0", 2, 2]],
    ribs: [["ring", "8", 3], ["edge", "4", 0.08]],
    altar: [["altar", "X", "0"], ["ring", "8", 4]],
    bones: [["edge", "4", 0.2], ["clump", "4", 3, 2], ["patch", "d", 0.45]],
    lake: [["pool", "w", 5], ["edge", "0", 0.05]],
    ruin: [["clump", "R", 3, 2], ["clump", "q", 2, 2]],
  } },
};
/**
 * The three floors of a run (3단 레이드), each its own concept: the name players see, the layout (`style`), the looks it
 * may take (seeded), main rooms (grid cells), loops beyond the spanning tree, packs per room.
 *   halls  무너진 지하 회랑: rooms of many shapes (round, cross, octagon, ell, ring, pillared, ragged; some over two cells) on
 *          corridors two or three wide
 *   caves  수정 동굴: drunk-walk caverns (some over two cells) on winding tunnels, the rock between smoothed away
 *   arena  핏빛 심연: one wide field over most cells, ragged where it meets rock, ridges with a gap between some cells,
 *          rock pillars, pits and blood pools; the final boss's hall at the far end
 */
const DIM_FLOORS = [
  { name: "무너진 지하 회랑", style: "halls", themes: ["crypt", "sewer"], rooms: [18, 21], loops: [3, 6], packs: 1.4 },
  { name: "수정 동굴", style: "caves", themes: ["cave"], rooms: [17, 20], loops: [3, 6], packs: 1.4 },
  { name: "핏빛 심연", style: "arena", themes: ["abyss"], rooms: [16, 19], loops: [4, 8], packs: 1.1 },
];
const HANOK_FLOORS = [
  { name: "달그림자 별채", rooms: [18, 21], loops: [3, 6], packs: 1.4, shapes: ["plain", "plain", "ell"], hallFloor: "l" },
  { name: "겹살창 안채", rooms: [17, 20], loops: [3, 6], packs: 1.4, shapes: ["plain", "ell", "ell", "cross"], hallFloor: "l" },
  { name: "붉은기둥 제례전", rooms: [17, 20], loops: [4, 7], packs: 1.1, shapes: ["plain", "plain", "cross"], hallFloor: "x" },
];
const HANOK_DRESS = {
  guest: [["edge", "t", 0.2], ["edge", "g", 0.12]],
  study: [["edge", "b", 0.32], ["edge", ">", 0.12]],
  store: [["edge", "%", 0.24], ["clump", "p", 2, 2]],
  shrine: [["altar", "v", "*"], ["edge", "*", 0.16]],
};

/** Floor `n`'s look, from the run's seed (`raid`: a RAID key, 31-raids-field.js; a field raid's floor has the one look it is built for). */
const dimTheme = (seed, n, raid) => {
  const i = clamp(n | 0, 1, DIM_FLOORS.length) - 1, row = RAID[dimRaidKey(raid)].floors[i], t = row.look ? [row.look] : DIM_FLOORS[i].themes;
  return t[((seed >>> 3) >>> 0) % t.length];
};
/** Where the town's obelisk stands, its keeper, and where someone coming back from an instance lands (tiles). */
const DIM_TOWN = { ob: [58, 34], keeper: [57, 35], land: [56, 34] };

/**
 * The monsters of an instance: the theme's own kinds within [lv-3, lv+2] (DIM.poolLv), else the kinds of every
 * hunting ground nearest lv-1 (4 of them), lowest level first. Never chests or bosses.
 */
function dimPool(theme, lv, ownMap) {
  const ok = (k) => MOBS[k] && !MOBS[k].chest && !MOBS[k].boss && !MOBS[k].bonusOptional;
  const own = [];
  for (const id of Object.keys(MAP_META)) if ((ownMap ? id === ownMap : MAP_META[id].theme === theme) && !MAP_META[id].safe && !MAP_META[id].minLv) for (const k of MAP_META[id].kinds) if (ok(k) && !own.includes(k)) own.push(k);
  let pool = own.filter((k) => MOBS[k].lv >= lv - DIM.poolLv[0] && MOBS[k].lv <= lv + DIM.poolLv[1]);
  // a field raid (`ownMap`: its field's map id) keeps to that ground's own kinds, the four nearest, when the party is past them
  if (pool.length < 3 && ownMap && own.length >= 3) pool = own.slice().sort((a, b) => Math.abs(MOBS[a].lv - (lv - 1)) - Math.abs(MOBS[b].lv - (lv - 1)) || MOBS[a].lv - MOBS[b].lv || (a < b ? -1 : 1)).slice(0, 4);
  if (pool.length < 3) {
    const all = [];
    for (const id of Object.keys(MAP_META)) if (!MAP_META[id].safe && !MAP_META[id].minLv) for (const k of MAP_META[id].kinds) if (ok(k) && !all.includes(k)) all.push(k);
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
 * Make an instance map: `{ id, seed, theme, lv, floor }` → a finalized map like any other (g, o, reach, portals, entry …)
 * plus `m.dim = { rooms, start, boss, bossRoom, dead, spawns, pool, bossK, path, elites, cap, links, style, loops }`.
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
  const W = DIM.w, H = DIM.h, lv = cfg.lv | 0 || 10, floor = clamp(cfg.floor | 0 || 1, 1, DIM_FLOORS.length);
  const raid = dimRaidKey(cfg.hanok === true ? "hanok" : cfg.raid), hanok = raid === "hanok", field = !!RAID[raid].field;
  const cc = RAID[raid].floors[floor - 1], style = hanok ? "halls" : cc.style;
  const theme = field ? cc.look : DIM_THEMES[cfg.theme] ? cfg.theme : DIM_FLOORS[floor - 1].themes[0];
  const look = hanok ? { rooms: HANOK_DRESS } : DIM_THEMES[theme];
  const art = field ? look.theme : theme;   // the client's art set (a field look is named for its floor)
  const m = blank(cfg.id || "dim:0", `레이드던전 ${floor}단 · ${cc.name}`, W, H, "W");
  m.theme = hanok ? "interior" : art; m.bgm = "dim"; m.band = null; m.marks = [];
  if (hanok) m.style = "hanok_raid";
  const pick = (a) => a[ri(box, 0, a.length - 1)];
  // ── the grid; main rooms grow over a connected set of its cells
  const [GX, GY, CW, CH] = DIM.grid, NC = GX * GY;
  const cellBox = (c) => { const i = c % GX, j = (c / GX) | 0; return [2 + i * CW, 2 + j * CH, 2 + i * CW + CW - 1, 2 + j * CH + CH - 1]; };
  const adj = (c) => { const i = c % GX, j = (c / GX) | 0, out = []; if (i > 0) out.push(c - 1); if (i < GX - 1) out.push(c + 1); if (j > 0) out.push(c - GX); if (j < GY - 1) out.push(c + GX); return out; };
  const nMain = ri(box, cc.rooms[0], cc.rooms[1]);
  const used = [ri(box, 0, NC - 1)];
  while (used.length < nMain) {
    const edge = [];
    for (const c of used) for (const n of adj(c)) if (!used.includes(n) && !edge.includes(n)) edge.push(n);
    edge.sort((a, b) => a - b);
    used.push(pick(edge));
  }
  const isUsed = new Uint8Array(NC);
  for (const c of used) isUsed[c] = 1;
  // ── rooms
  const rooms = [], cellRoom = new Int16Array(NC).fill(-1);
  const roomAt = new Int16Array(W * H).fill(-1), hall = new Uint8Array(W * H);
  const inner = (x, y) => x > 1 && y > 1 && x < W - 2 && y < H - 2;
  const dig = (x, y, k) => { if (inner(x, y)) { m.g[y][x] = "c"; if (k >= 0 && roomAt[y * W + x] < 0) roomAt[y * W + x] = k; } };
  const shapeFn = (shape, r) => {
    const mx = (r.x0 + r.x1 + 1) / 2, my = (r.y0 + r.y1 + 1) / 2, hw = (r.x1 - r.x0 + 1) / 2, hh = (r.y1 - r.y0 + 1) / 2;
    const fx = rnd(box) < 0.5 ? 1 : -1, fy = rnd(box) < 0.5 ? 1 : -1;
    // ragged: three rectangles of at least half the box, each over the middle tile (so they always join)
    const rects = shape === "ragged" ? [0, 1, 2].map(() => {
      const w = ri(box, Math.ceil(hw), r.x1 - r.x0 + 1), h = ri(box, Math.ceil(hh), r.y1 - r.y0 + 1);
      const x = ri(box, Math.max(r.x0, r.cx - w + 1), Math.min(r.cx, r.x1 - w + 1)), y = ri(box, Math.max(r.y0, r.cy - h + 1), Math.min(r.cy, r.y1 - h + 1));
      return [x, y, x + w - 1, y + h - 1];
    }) : null;
    return (x, y) => {
      const u = (x + 0.5 - mx) / hw, v = (y + 0.5 - my) / hh;
      if (shape === "cross") return Math.abs(u) < 0.45 || Math.abs(v) < 0.45;
      if (shape === "round") return u * u + v * v <= 1.05;
      if (shape === "octagon") return Math.abs(u) + Math.abs(v) <= 1.45;
      if (shape === "ell") return !(u * fx > 0.1 && v * fy > 0.1);
      if (shape === "ring") return !(Math.abs(u) < 0.4 && Math.abs(v) < 0.4);
      if (shape === "pillared") return !((x - r.x0) % 3 === 2 && (y - r.y0) % 3 === 2 && x < r.x1 - 1 && y < r.y1 - 1 && (Math.abs(x - r.cx) > 1 || Math.abs(y - r.cy) > 1));
      if (shape === "ragged") return rects.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
      return true;
    };
  };
  /** A room over `cells` in the box, its tiles where `inside` (default: its shape); `at` its middle if not the box's. */
  const addRoom = (cells, kind, shape, x0, y0, x1, y1, inside, at) => {
    const k = rooms.length, r = { cells, kind, shape, x0, y0, x1, y1, cx: at ? at[0] : (x0 + x1) >> 1, cy: at ? at[1] : (y0 + y1) >> 1, area: 0, rt: "" };
    rooms.push(r);
    for (const c of cells) cellRoom[c] = k;
    const fn = inside || shapeFn(shape, r);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (fn(x, y)) dig(x, y, k);
    if (shape === "ring") r.cx = x0 + 1;          // the ring's middle is rock: its band is where corridors meet it
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (roomAt[y * W + x] === k) r.area++;
    return r;
  };
  /** A drunk walk from the box's middle, a 3 × 3 brush, until `want` tiles are dug. */
  const blob = (x0, y0, x1, y1, want) => {
    const mask = new Uint8Array(W * H);
    let x = (x0 + x1) >> 1, y = (y0 + y1) >> 1, n = 0;
    for (let s = 0; s < want * 8 && n < want; s++) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = (y + dy) * W + x + dx; if (!mask[i]) { mask[i] = 1; n++; } }
      const d = D4[ri(box, 0, 3)];
      x = clamp(x + d[0], x0 + 1, x1 - 1); y = clamp(y + d[1], y0 + 1, y1 - 1);
    }
    return (i, j) => mask[j * W + i] === 1;
  };
  const SHAPES = ["plain", "cross", "round", "octagon", "ell", "ring", "pillared", "ragged"], BIG = ["pillared", "plain", "ring", "ragged", "cross"];
  for (const c of used) {
    if (cellRoom[c] >= 0) continue;
    const [cx0, cy0, cx1, cy1] = cellBox(c);
    if (style === "arena") {
      // the field: the whole cell, ragged only where it meets rock (the map's rim or a cell left out)
      const i = c % GX, j = (c / GX) | 0;
      const rock = [i === 0 || !isUsed[c - 1], i === GX - 1 || !isUsed[c + 1], j === 0 || !isUsed[c - GX], j === GY - 1 || !isUsed[c + GX]];
      addRoom([c], "room", "plain", cx0, cy0, cx1, cy1, (x, y) => {
        const d = Math.min(rock[0] ? x - cx0 : 99, rock[1] ? cx1 - x : 99, rock[2] ? y - cy0 : 99, rock[3] ? cy1 - y : 99);
        return d >= 3 || fbm(x, y, seed, 4) < 0.3 + 0.17 * d;
      });
      continue;
    }
    // now and then a great room over this cell and a free neighbour
    const pair = rnd(box) < 0.24 ? adj(c).filter((n) => isUsed[n] && cellRoom[n] < 0 && (n === c + 1 || n === c + GX)) : [];
    const two = pair.length ? pick(pair) : -1, wide = two === c + 1;
    const bx1 = two < 0 ? cx1 : wide ? cx1 + CW : cx1, by1 = two < 0 ? cy1 : wide ? cy1 : cy1 + CH;
    const cells = two < 0 ? [c] : [c, two];
    if (style === "caves") {
      // a cavern: a drunk walk's blob, a noisy dome, or a fissure (a ragged band across its cells, wider in the middle)
      const kind = pick(["blob", "blob", "dome", "fissure"]), mx = (cx0 + bx1) / 2, my = (cy0 + by1) / 2, rx = (bx1 - cx0) / 2 - 1.5, ry = (by1 - cy0) / 2 - 1.5, s2 = seed + 31 * c, flat = rnd(box) < 0.5;
      const f = kind === "blob" ? blob(cx0 + 1, cy0 + 1, bx1 - 1, by1 - 1, two < 0 ? ri(box, 95, 165) : ri(box, 220, 320))
        : kind === "dome" ? (x, y) => ((x - mx) / rx) ** 2 + ((y - my) / ry) ** 2 + (fbm(x, y, s2, 3) - 0.5) * 0.9 <= 1
        : (x, y) => { const u = (x - mx) / rx, v = (y - my) / ry, a = flat ? u : v, b = flat ? v : u; return Math.abs(a) <= 1 && Math.abs(b) <= (0.4 + 0.4 * (1 - Math.abs(a))) * (0.75 + 0.6 * fbm(x, y, s2, 3)); };
      addRoom(cells, "room", kind, cx0 + 1, cy0 + 1, bx1 - 1, by1 - 1, f, [(cx0 + bx1) >> 1, (cy0 + by1) >> 1]);
      continue;
    }
    const w = two < 0 ? ri(box, 10, CW - 2) : wide ? ri(box, 20, 2 * CW - 3) : ri(box, 9, CW - 3);
    const h = two < 0 ? ri(box, 9, CH - 2) : wide ? ri(box, 9, CH - 2) : ri(box, 16, 2 * CH - 3);
    let shape = pick(hanok ? cc.shapes : two < 0 ? SHAPES : BIG);
    if ((shape === "ring" && (w < 9 || h < 8)) || (shape === "cross" && (w < 9 || h < 8))) shape = "octagon";
    const x0 = ri(box, cx0 + 1, bx1 - w), y0 = ri(box, cy0 + 1, by1 - h);
    addRoom(cells, "room", shape, x0, y0, x0 + w - 1, y0 + h - 1);
  }
  // ── links: a random spanning tree over neighbouring rooms, then loops (several ways round, not a tree)
  const edges = [];
  for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) if (rooms[a].cells.some((c) => adj(c).some((n) => cellRoom[n] === b))) edges.push([a, b, rnd(box)]);
  edges.sort((p, q) => p[2] - q[2]);
  const root = rooms.map((_, i) => i), find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  const tree = [], spare = [];
  for (const e of edges) { const a = find(e[0]), b = find(e[1]); if (a !== b) { root[a] = b; tree.push(e); } else spare.push(e); }
  const links = style === "arena" ? tree.concat(spare) : tree.concat(spare.slice(0, Math.min(spare.length, ri(box, cc.loops[0], cc.loops[1]))));
  const brush = (x, y, wd) => {
    for (let dy = 0; dy < wd; dy++) for (let dx = 0; dx < wd; dx++) {
      const xx = x + dx - (wd >> 1), yy = y + dy - (wd >> 1);
      if (inner(xx, yy)) { if (roomAt[yy * W + xx] < 0) hall[yy * W + xx] = 1; dig(xx, yy, -1); }
    }
  };
  const line = (x0, y0, x1, y1, wd, flip) => {
    const pts = flip ? [[x0, y0], [x1, y0], [x1, y1]] : [[x0, y0], [x0, y1], [x1, y1]];
    for (let s = 0; s < 2; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let i = 0; i <= n; i++) brush(ax + Math.sign(bx - ax) * i, ay + Math.sign(by - ay) * i, wd);
    }
  };
  // a cave's tunnel wanders toward its end (and goes straight for the rest if it wandered too long)
  const tunnel = (A, B, wd) => {
    let x = A.cx, y = A.cy;
    for (let s = 0; s < 300 && (x !== B.cx || y !== B.cy); s++) {
      brush(x, y, wd);
      const dx = B.cx - x, dy = B.cy - y;
      if (rnd(box) < 0.72) { if (rnd(box) * (Math.abs(dx) + Math.abs(dy)) < Math.abs(dx)) x += Math.sign(dx); else y += Math.sign(dy); }
      else { const d = D4[ri(box, 0, 3)]; x = clamp(x + d[0], 3, W - 4); y = clamp(y + d[1], 3, H - 4); }
    }
    line(x, y, B.cx, B.cy, wd, false);
  };
  const ridges = [];
  for (const [a, b] of links) {
    const A = rooms[a], B = rooms[b];
    if (style === "caves") tunnel(A, B, rnd(box) < 0.3 ? 2 : 3);
    else if (style === "halls") line(A.cx, A.cy, B.cx, B.cy, hanok ? 3 : rnd(box) < 0.25 ? 2 : 3, rnd(box) < 0.5);
  }
  // the field's loops: a ridge of rock along the shared side of two cells, broken by one gap (a chokepoint)
  if (style === "arena") for (const [a, b] of spare) {
    if (rnd(box) < 0.35) continue;
    const ca = rooms[a].cells[0], cb = rooms[b].cells[0], [ax0, ay0, ax1, ay1] = cellBox(Math.min(ca, cb)), across = Math.abs(ca - cb) === 1;
    const n = across ? ay1 - ay0 - 1 : ax1 - ax0 - 1, g0 = ri(box, 2, n - 6), gl = ri(box, 3, 4);
    for (let t = 1; t < n; t++) {
      if (t >= g0 && t < g0 + gl) continue;
      const x = across ? ax1 + 1 : ax0 + t, y = across ? ay0 + t : ay1 + 1;
      if (m.g[y][x] === "c") { m.g[y][x] = "W"; ridges.push([x, y]); }
    }
  }
  if (style === "caves") for (let pass = 0; pass < 2; pass++) {
    // smooth: rock mostly open round it falls away (only ever opens ground, so nothing is cut off)
    const open = [];
    for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) if (m.g[y][x] === "W") {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && m.g[y + dy][x + dx] !== "W") n++;
      if (n >= 5) open.push([x, y]);
    }
    // (the rock that falls away joins the cavern beside it, if any, so its props reach the new walls)
    for (const [x, y] of open) { const n = D4.map(([dx, dy]) => roomAt[(y + dy) * W + x + dx]).find((k) => k >= 0); dig(x, y, n === undefined ? -1 : n); }
  }
  // ── start and master's hall: the two ends of the longest walk; the master takes the biggest room out there
  const open = (i) => m.g[(i / W) | 0][i % W] !== "W";
  const tileOf = (r) => r.cy * W + r.cx;
  const far = (from) => { const d = bfs(W, H, tileOf(rooms[from]), open); let best = from; rooms.forEach((r, k) => { if (d[tileOf(r)] > d[tileOf(rooms[best])]) best = k; }); return best; };
  const startK = far(far(0));
  let dS = bfs(W, H, tileOf(rooms[startK]), open);
  const span = Math.max(...rooms.map((r) => dS[tileOf(r)]));
  let bossK = -1;
  rooms.forEach((r, k) => { if (k !== startK && dS[tileOf(r)] >= span * 0.85 && (bossK < 0 || r.area > rooms[bossK].area)) bossK = k; });
  // the two ends are open halls: room to arrive in, room to fight in
  const plainOut = (k) => {
    const r = rooms[k];
    if (style === "caves") {
      for (let y = Math.max(r.y0 + 1, r.cy - 5); y <= Math.min(r.y1 - 1, r.cy + 5); y++) for (let x = Math.max(r.x0 + 1, r.cx - 6); x <= Math.min(r.x1 - 1, r.cx + 6); x++) if (((x - r.cx) / 6.5) ** 2 + ((y - r.cy) / 5.5) ** 2 <= 1) dig(x, y, k);
    } else {
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { dig(x, y, k); roomAt[y * W + x] = k; }
      r.shape = "plain"; r.cx = (r.x0 + r.x1) >> 1;
      for (const [x, y] of ridges) if (x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1) dig(x, y, -1);
    }
    r.area = 0;
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (roomAt[y * W + x] === k) r.area++;
  };
  plainOut(startK); plainOut(bossK);
  rooms[startK].kind = "start"; rooms[bossK].kind = "boss";
  // ── side rooms: small dead ends off the far half (never off the way in), one corridor each — vaults first, then dens
  const free = [];
  for (let c = 0; c < NC; c++) if (cellRoom[c] < 0) free.push(c);
  const sideFor = (minT) => {
    const opts = [];
    for (const c of free) for (const n of adj(c)) {
      const k = cellRoom[n];
      if (k < 0 || rooms[k].kind === "vault" || rooms[k].kind === "den" || k === startK || dS[tileOf(rooms[k])] < span * minT) continue;
      opts.push([c, k]);
    }
    return opts;
  };
  const nVault = ri(box, DIM.vaults[0], DIM.vaults[1]), nDen = ri(box, DIM.dens[0], DIM.dens[1]);
  for (let v = 0; v < nVault + nDen; v++) {
    let opts = sideFor(0.5);
    if (!opts.length) opts = sideFor(0);
    if (!opts.length) break;
    const [c, k] = pick(opts);
    free.splice(free.indexOf(c), 1);
    const [cx0, cy0, cx1, cy1] = cellBox(c), w = ri(box, 5, 8), h = ri(box, 5, 7), x0 = ri(box, cx0 + 2, cx1 - 1 - w), y0 = ri(box, cy0 + 2, cy1 - 1 - h);
    const r = addRoom([c], v < nVault ? "vault" : "den", hanok ? "plain" : pick(["plain", "octagon", "round"]), x0, y0, x0 + w - 1, y0 + h - 1);
    line(rooms[k].cx, rooms[k].cy, r.cx, r.cy, 2, rnd(box) < 0.5);
    r.from = k;
  }
  dS = bfs(W, H, tileOf(rooms[startK]), open);
  // a cave tunnel inside a cavern's cells is part of that cavern (its props may hug the tunnel's walls)
  if (style === "caves") for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, c = Math.floor((x - 2) / CW) + Math.floor((y - 2) / CH) * GX, k = hall[i] && c < NC ? cellRoom[c] : -1;
    if (k >= 0 && rooms[k].kind !== "vault" && rooms[k].kind !== "den") { roomAt[i] = k; hall[i] = 0; }
  }
  // the main route, the way in to the master's hall, stays three tiles wide whatever the rooms are dressed with
  const keep = new Uint8Array(W * H);
  {
    const toBoss = bfs(W, H, tileOf(rooms[bossK]), open);
    for (let at = tileOf(rooms[startK]), s = 0; at >= 0 && s < W * H; s++) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keep[at + dy * W + dx] = 1;
      if (toBoss[at] <= 0) break;
      at = D4.map(([dx, dy]) => at + dy * W + dx).find((q) => toBoss[q] >= 0 && toBoss[q] < toBoss[at]) ?? -1;
    }
  }
  // ── dressing: rubble, the theme's ground, then each room by its type
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (m.g[y][x] === "c" && fbm(x, y, seed, 5) > 0.6) m.g[y][x] = "d";
  const st = rooms[startK], door = style === "caves" ? [st.cx - 4, st.cy - 3] : [st.x0 + 1, st.y0 + 1];
  const floorCh = (c) => c !== "W" && c !== "w";
  // (corridors and, in the halls, their mouths stay clear; a cave tunnel winds past its caverns, so only the tunnel itself)
  const nearHall = (x, y) => hall[y * W + x] || (style === "halls" && D4.some(([dx, dy]) => hall[(y + dy) * W + x + dx]));
  /** Room k may take a prop here: its own open floor, off the corridors and their mouths, clear of its middle and the door. */
  const canPut = (x, y, k) => {
    if (!inner(x, y) || roomAt[y * W + x] !== k || keep[y * W + x] || m.o[y][x] !== " " || !floorCh(m.g[y][x]) || nearHall(x, y)) return false;
    const r = rooms[k];
    return (Math.abs(x - r.cx) > 1 || Math.abs(y - r.cy) > 1) && (Math.abs(x - door[0]) > 1 || Math.abs(y - door[1]) > 1);
  };
  const wallish = (x, y) => D4.some(([dx, dy]) => m.g[y + dy][x + dx] === "W");
  const tilesOf = (k) => { const r = rooms[k], out = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (roomAt[y * W + x] === k) out.push([x, y]); return out; };
  const spaced = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.o[y + dy][x + dx] !== " ") return false; return true; };
  const STEP = {
    edge(k, t, [ch, p]) { for (const [x, y] of t) if (wallish(x, y) && canPut(x, y, k) && spaced(x, y) && rnd(box) < p * DIM.deco) m.o[y][x] = ch; },
    clump(k, t, [ch, n, size]) {
      const at = t.filter(([x, y]) => wallish(x, y) && canPut(x, y, k));
      for (let i = 0; i < Math.round(n * DIM.deco) && at.length; i++) {
        let [x, y] = pick(at);
        for (let s = 0; s < size; s++) { if (canPut(x, y, k)) m.o[y][x] = ch; const d = D4[ri(box, 0, 3)]; x += d[0]; y += d[1]; }
      }
    },
    rows(k, t, [ch]) { const r = rooms[k]; for (const [x, y] of t) if ((y - r.y0) % 2 === 1 && (x - r.x0) % 4 !== 0 && Math.abs(x - r.cx) > 1 && y > r.y0 && y < r.y1 && canPut(x, y, k)) m.o[y][x] = ch; },
    altar(k, t, [ch, fl]) {
      const r = rooms[k], y = r.cy - 3;
      if (canPut(r.cx, y, k)) { m.o[y][r.cx] = ch; for (const x of [r.cx - 2, r.cx + 2]) if (canPut(x, y, k)) m.o[y][x] = fl; }
    },
    ring(k, t, [ch, R]) { const r = rooms[k]; for (let a = 0; a < 12; a++) { if (a % 3 === 1) continue; const x = r.cx + Math.round(Math.cos(a * Math.PI / 6) * R), y = r.cy + Math.round(Math.sin(a * Math.PI / 6) * R * 0.8); if (canPut(x, y, k)) m.o[y][x] = ch; } },
    pool(k, t, [ch, R]) {
      const r = rooms[k], c = t.filter(([x, y]) => Math.abs(x - r.cx) + Math.abs(y - r.cy) >= R + 2);
      if (!c.length) return;
      const [px, py] = pick(c);
      for (const [x, y] of t) if (Math.hypot(x - px, (y - py) * 1.3) + (fbm(x, y, seed + k, 3) - 0.5) * 3 < R && canPut(x, y, k)) m.g[y][x] = ch;
    },
    patch(k, t, [ch, th]) { for (const [x, y] of t) if (m.g[y][x] === "c" && fbm(x, y, seed + 7 * k, 4) > th) m.g[y][x] = ch; },
    // the field's pillars, pits and pools: blocks set in open floor with a free ring all round, so nothing is cut off
    blocks(k, t, [ch, n]) {
      const r = rooms[k];
      for (let i = 0; i < n * 3 && n > 0; i++) {
        const bw = ri(box, 2, 3), bh = ri(box, 2, 3), [px, py] = pick(t);
        if (Math.abs(px + bw / 2 - r.cx) < 4 && Math.abs(py + bh / 2 - r.cy) < 4) continue;
        let ok = true;
        for (let y = py - 1; y <= py + bh && ok; y++) for (let x = px - 1; x <= px + bw && ok; x++) if (!inner(x, y) || m.g[y][x] === "W" || m.g[y][x] === "w" || m.o[y][x] !== " " || hall[y * W + x] || keep[y * W + x] || roomAt[y * W + x] !== k) ok = false;
        if (!ok) continue;
        for (let y = py; y < py + bh; y++) for (let x = px; x < px + bw; x++) m.g[y][x] = ch;
        n--;
      }
    },
  };
  // every type once round before any twice, in a seeded order: each floor shows its theme's whole range
  const types = Object.keys(look.rooms), edgeChs = Object.values(look.rooms).flat().filter((s) => s[0] === "edge").map((s) => s[1]);
  for (let i = types.length - 1; i > 0; i--) { const j = ri(box, 0, i); [types[i], types[j]] = [types[j], types[i]]; }
  let ti = 0;
  rooms.forEach((r, k) => {
    r.rt = r.kind === "room" || r.kind === "den" ? types[ti++ % types.length] : r.kind;
    const t = tilesOf(k);
    if (style === "arena" && r.kind === "room") { STEP.blocks(k, t, ["W", ri(box, 1, 3)]); STEP.blocks(k, t, [look.pool, ri(box, 0, 2)]); }
    // the way in and the master's hall keep their floor clear: props along their walls only
    const steps = hanok && r.kind === "boss" ? HANOK_DRESS.shrine
      : r.kind === "start" || r.kind === "boss" ? look.rooms[types[0]].filter((s) => s[0] === "edge" || s[0] === "patch")
      : r.kind === "vault" ? [["edge", pick(edgeChs), 0.35]] : look.rooms[r.rt];
    for (const s of steps) STEP[s[0]](k, tilesOf(k), s.slice(1));
  });
  // ── the way home: a door by the start room's corner, back to the obelisk
  m.entry = [st.cx, st.cy];
  m.g[door[1]][door[0]] = "c"; m.o[door[1]][door[0]] = " ";
  m.portals.push({ x: door[0], y: door[1], to: "town", tx: DIM_TOWN.land[0], ty: DIM_TOWN.land[1], label: "버드나무광장 (귀환)" });
  // nothing may wall anything off: props or a pool that do are taken away again; ground still cut off turns to rock
  const reachAll = () => {
    const d = bfs(W, H, m.entry[1] * W + m.entry[0], (i) => m.o[(i / W) | 0][i % W] === " " && !SOLID_G.includes(m.g[(i / W) | 0][i % W]));
    const lost = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (m.o[y][x] === " " && !SOLID_G.includes(m.g[y][x]) && d[y * W + x] < 0) lost.push([x, y]);
    return lost;
  };
  let lost = reachAll();
  for (let pass = 0; lost.length && pass < 6; pass++, lost = reachAll()) {
    for (const [x, y] of lost) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (m.o[y + dy][x + dx] !== " ") m.o[y + dy][x + dx] = " ";
      if (m.g[y + dy][x + dx] === "w") m.g[y + dy][x + dx] = "c";
    }
  }
  for (const [x, y] of lost) m.g[y][x] = "W";
  if (field) {
    // the field's own ground and barrier: no rock "W" and no cave floor is left for the browser to draw. Walls: the look's objects
    // against open floor (trees, palms, reef, ruin), `deep` behind them; corridors read as the field's trail, rubble as its alt ground
    const wall = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.g[y][x] === "W") {
      let e = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < H && xx < W && m.g[yy][xx] !== "W") e = 1; }
      wall.push([x, y, e]);
    }
    const wallCh = () => { let r = rnd(box); for (const [ch, w] of look.wall) { if (r < w) return ch; r -= w; } return look.wall[0][0]; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = m.g[y][x];
      if (c === "c") m.g[y][x] = hall[y * W + x] ? look.road : look.ground;
      else if (c === "d") m.g[y][x] = look.alt;
    }
    for (const [x, y, e] of wall) {
      m.g[y][x] = e ? look.wallG || look.ground : look.deepG || look.wallG || look.ground;
      m.o[y][x] = e ? wallCh() : look.deep;
    }
  }
  if (hanok) {
    // Walls occupy already solid tiles. Only north and west faces stand tall.
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (m.g[y][x] === "W") {
        const back = m.g[y + 1][x] !== "W" || m.g[y][x + 1] !== "W";
        const front = m.g[y - 1][x] !== "W" || m.g[y][x - 1] !== "W";
        if (back) m.o[y][x] = (x + y + floor) % 5 === 0 ? "+" : "=";
        else if (front) m.o[y][x] = "_";
      } else {
        const r = rooms[roomAt[y * W + x]], master = r && r.kind === "boss";
        if (floor === DIM.floors && master && Math.abs(x - r.cx) <= 1) m.g[y][x] = "y";
        else if (r && (r.rt === "guest" || r.rt === "study" || master)) m.g[y][x] = "e";
        else m.g[y][x] = r ? "l" : cc.hallFloor;
      }
    }
  }
  // ── who lives here
  const pool = dimPool(art, lv, field ? RAID[raid].map : "");
  const tOf = (r) => dS[tileOf(r)] / Math.max(1, span);
  const spawns = [];
  const openIn = (k) => tilesOf(k).filter(([x, y]) => m.o[y][x] === " " && !SOLID_G.includes(m.g[y][x]));
  const kindFor = (t) => pool[clamp(Math.floor(t * pool.length + (rnd(box) - 0.5) * 1.6), 0, pool.length - 1)];
  const normal = rooms.map((r, k) => k).filter((k) => rooms[k].kind === "room");
  // rooms next to the way in carry no elite
  const nearStart = new Set(links.filter(([a, b]) => a === startK || b === startK).map(([a, b]) => (a === startK ? b : a)));
  let budget = DIM.mobCap;
  const nPacks = Math.round(normal.length * cc.packs);
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
    const r = rooms[k], spots = openIn(k), t = tOf(r);
    if (!spots.length) return;
    for (let i = 0; i < packsIn[j] && budget > 0; i++) {
      const n = Math.min(budget, ri(box, DIM.pack[0], DIM.pack[1]));
      budget -= n;
      spawns.push({ k: kindFor(t), n, at: pick(spots), room: k, el: 0 });
    }
    if (!nearStart.has(k) && rnd(box) < 0.75) {
      const ne = r.area >= 140 && rnd(box) < 0.3 ? 2 : 1;
      for (let i = 0; i < ne; i++) { spawns.push({ k: kindFor(Math.min(1, t + 0.25)), n: 1, at: pick(spots), room: k, el: 1 }); elites++; }
    }
  });
  const dead = [];
  rooms.forEach((r, k) => {
    if (r.kind !== "vault" && r.kind !== "den") return;
    const spots = openIn(k).filter(([x, y]) => x !== r.cx || y !== r.cy);
    if (r.kind === "den") {
      // an elite den: two of the floor's toughest, nothing to guard but their own hide
      for (let i = 0; i < 2; i++) { spawns.push({ k: kindFor(Math.min(1, tOf(r) + 0.35)), n: 1, at: pick(spots), room: k, el: 1 }); elites++; }
      return;
    }
    spawns.push({ k: pool[pool.length - 1], n: 1, at: pick(spots), room: k, el: 1, guard: 1 });
    spawns.push({ k: `chest_${field ? look.chest : theme}`, n: 1, at: [r.cx, r.cy], room: k, el: 0, chest: 1 });
    dead.push([r.cx, r.cy]);
    elites++;
  });
  const bs = rooms[bossK];
  m.dim = {
    rooms: rooms.map(({ x0, y0, x1, y1, cx, cy, kind, shape, area, rt }) => ({ x0, y0, x1, y1, cx, cy, kind, shape, area, rt })),
    start: [st.cx, st.cy], boss: [bs.cx, bs.cy], bossRoom: bossK, startRoom: startK, door, dead, spawns, pool,
    bossK: dimBossKind(art, lv, pool), path: dS[tileOf(bs)], elites, cap: DIM.cap, links: links.map(([a, b]) => [a, b]),
    style, floor, hanok, raid, loops: links.length - (rooms.filter((r) => r.kind !== "vault" && r.kind !== "den").length - 1),
  };
  finalize(m);
  return m;
}

// ───────────────────────────── 3단 레이드 floors and 주간 토벌 (docs/design/scale-and-rift.md H.6) ─────────────────────────────

/** What floor `n` (1..DIM.floors) does to a rift: `{ hp, atk, elites, traits, boss }` (DIM.floor; a boss challenge reads floor 1's). */
const dimFloorK = (n) => DIM.floor[clamp(n | 0, 1, DIM.floors) - 1];

/**
 * 주간 토벌: a four-player arena for the two big bosses. Each has three telegraphed patterns made of the old
 * moves (`pats`: [name, kind]), a marked cast every `every`-th turn that the party breaks by dealing `stag` of the
 * boss's health while it lasts (`castMs`; broken: stunned `stunMs`; not broken: a blast of `blast` × attack and one
 * more `fury`), and a soft enrage (`enrage` ms into a fight, then + `enrageK` damage every `enrageStep`).
 * A wipe resets the boss and the party tries again until `limit`. `big` once a week per boss, `small` after.
 * Toughness: `hp` × DIM.hpN (party size) × (1 + `lvK` per world tier the party's best outranks the boss), blows
 * × (1 + `atkLv` per such tier) — measured with the bot party in tests/dimrift.mjs.
 */
const DIM_CHAL = {
  w: 32, h: 22, limit: 600000, reviveMs: 4000, gap: 5200, every: 4, castMs: 6000, stunMs: 5000, stag: 0.03, blast: 2.4, fury: 0.15,
  enrage: 240000, enrageStep: 10000, enrageK: 0.12, hp: 14, lvK: 0.1, atkLv: 0.05, minGap: 3,
  big: { gold: 400, xp: 0.25, stone: 8, rune: 2, gear: 2, gearQ: 3 }, small: { gold: 40, xp: 0.02, stone: 1 },
  // 난이도: hero levels above each boss's own (a step must be `stepMin` world tiers past the last one); a hero may go in from
  // `stepGap` levels under a step. Gold and experience follow the step's level; each step past the boss's own adds `stepR` × step.
  steps: [125, 150, 175, 200], stepMin: 3, stepGap: 10, stepR: { stone: 2, rune: 0.5, gear: 0.34 },
  stepNames: ["보통", "어려움", "지옥", "악몽", "심연"],
  rotationBig: { gold: 220, xp: 0.16, stone: 5, rune: 1, gear: 1, gearQ: 2 },
  bosses: {
    boss: { theme: "crypt", cast: "차원 붕괴", pats: [["균열 탄막", "fan2"], ["붕괴의 고리", "rings"], ["균열 웅덩이", "pools"]] },
    abyssboss: { theme: "abyss", cast: "심연의 포효", pats: [["연쇄 돌진", "charge2"], ["도약 강타", "leapslam"], ["촉수 탄막", "fan3"]] },
    // bosses-2 §4–5: the two designed raids — phases, shaped patterns, adds, a harder stagger window (vuln) and a hard enrage.
    // Any key here overrides DIM_CHAL's (and BOSS_SCRIPT's) numbers; `big` its weekly reward; `w`/`h` its arena.
    cloakbat: { theme: "abyss", cast: "심장의 포효", vuln: 0.3, enrage: 300000, hard: 420000, hardEvery: 3000, hardK: 3,
      big: { gold: 400, xp: 0.25, stone: 8, rune: 2, gear: 3, gearQ: 3 },
      pats: [["장막 휘감기", "cone", { half: 1.309, r: 60, k: 2 }], ["초음파 고리", "rings"], ["거꾸로 낙하", "leapslam"], ["날개 탄막", "fan2"]],
      phases: [
        // 비행: it flies — the shared mark, its bats every third turn, blood pools
        { at: 0.7, pats: [["흡혈 표식", "mark", { share: 1, n: 1, r: 40, ms: 3500, k: 5 }], ["핏빛 메아리", "pools"], ["박쥐떼", "adds", { kind: "nightbat", n: 4, cap: 4, d: 56, feed: 20000, heal: 0.02 }],
          ["장막 휘감기", "cone", { half: 1.309, r: 60, k: 2 }], ["날개 탄막", "fan2"], ["박쥐떼", "adds", { kind: "nightbat", n: 4, cap: 4, d: 56, feed: 20000, heal: 0.02 }]] },
        // 장막 붕괴: pools round the rim for good, two cones, a quicker beat, its cast hits harder
        { at: 0.35, gap: 3900, blast: 4, rim: { n: 8, pr: 30 }, pats: [["장막 휘감기", "cone", { half: 1.309, r: 60, k: 2, both: 1 }], ["흡혈 표식", "mark", { share: 1, n: 1, r: 40, ms: 3500, k: 5 }],
          ["초음파 고리", "rings"], ["박쥐떼", "adds", { kind: "nightbat", n: 4, cap: 4, d: 56, feed: 20000, heal: 0.02 }], ["거꾸로 낙하", "leapslam"], ["날개 탄막", "fan2"]] },
      ] },
    bloomwhale: { theme: "cave", cast: "고래의 장송곡", w: 40, h: 28, castMs: 7000, stunMs: 6000, blast: 6, vuln: 0.3, diveMs: 1800, diveR: 70, diveK: 6,
      enrage: 360000, hard: 480000, hardEvery: 4000, hardK: 10, big: { gold: 600, xp: 0.375, stone: 12, rune: 3, gear: 4, gearQ: 3 },
      pats: [["고래 낙하", "dive"], ["수정 갈비 탄막", "fan3"], ["꼬리 지느러미", "cone", { back: 1, r: 72, ms: 1100, k: 3 }], ["심해의 노래", "donut", { r0: 30, r: 110, ms: 1500, k: 3, rings: 1 }]],
      // four burst windows (65 %, 45 %, 30 %, 10 %): each phase opens with the song; heads come first at 65 % and 45 %
      phases: [
        { at: 0.65, cast: 1, pats: [["먹장어 머리", "adds", { kind: "hagfishhead", n: 3, cap: 3, d: 96, shield: 1 }], ["혼꽃 표식", "mark", { n: 4, r: 36, ms: 4000, k: 2.5 }], ["서리 결정 웅덩이", "pools"],
          ["수정 갈비 탄막", "fan3"], ["꼬리 지느러미", "cone", { back: 1, r: 72, ms: 1100, k: 3 }], ["심해의 노래", "donut", { r0: 30, r: 110, ms: 1500, k: 3, rings: 1 }], ["고래 낙하", "dive"]] },
        { at: 0.45, cast: 1, pats: [["먹장어 머리", "adds", { kind: "hagfishhead", n: 3, cap: 3, d: 96, shield: 1 }], ["혼꽃 표식", "mark", { n: 4, r: 36, ms: 4000, k: 2.5 }], ["서리 결정 웅덩이", "pools"],
          ["수정 갈비 탄막", "fan3"], ["꼬리 지느러미", "cone", { back: 1, r: 72, ms: 1100, k: 3 }], ["심해의 노래", "donut", { r0: 30, r: 110, ms: 1500, k: 3, rings: 1 }], ["고래 낙하", "dive"]] },
        // 꽃무덤: the shared mark in place of the spread, a dive every third turn
        { at: 0.3, cast: 1, pats: [["혼꽃 표식", "mark", { share: 1, n: 1, r: 40, ms: 4000, k: 5 }], ["심해의 노래", "donut", { r0: 30, r: 110, ms: 1500, k: 3, rings: 1 }], ["고래 낙하", "dive"],
          ["수정 갈비 탄막", "fan3"], ["꼬리 지느러미", "cone", { back: 1, r: 72, ms: 1100, k: 3 }], ["고래 낙하", "dive"]] },
        { at: 0.1, cast: 1 },
      ] },
    wickregent: { rotation: true, theme: "crypt", cast: "심지 태우기", pats: [["밀랍 돌진", "charge2"], ["녹아내린 심지", "pools"], ["불쏘시개", "cone", { ms: 1200, r: 88, half: 0.72 }]] },
    knotwidow: { rotation: true, theme: "crypt", cast: "등불 삼키기", pats: [["가시 매듭", "adds", { kind: "burrlynx", n: 2, cap: 4 }], ["조여 드는 그물", "donut", { r0: 35, r: 98 }], ["천장 습격", "leapslam"]] },
    knellkeeper: { rotation: true, theme: "crypt", cast: "마지막 장례종", pats: [["겹쳐 울리는 종", "rings"], ["메아리 탄막", "fan2"], ["장례 행렬", "mark", { ms: 2400, r: 29, n: 2 }]] },
    loomcolossus: { rotation: true, theme: "cave", cast: "베틀 과부하", pats: [["태엽 사출", "fan2"], ["가로 절단", "cone", { r: 110, half: 0.5 }], ["세로 날실", "cone", { r: 94, half: 0.35, back: 1 }]] },
    sluiceleviathan: { rotation: true, theme: "sewer", cast: "배수문 파열", pats: [["넘치는 독물", "pools"], ["휘감는 꼬리", "cone", { ms: 1300, r: 86, half: 1.1 }], ["솟구치는 잠류", "dive"]] },
    prismcantor: { rotation: true, theme: "cave", cast: "공명 파쇄", pats: [["수정 세 갈래", "fan3"], ["공명 표식", "mark", { ms: 2600, r: 37, n: 3 }], ["갈라진 성가", "donut", { r0: 32, r: 108 }]] },
  },
};
const CHAL_KEYS = Object.keys(DIM_CHAL.bosses);
const CHAL_ROTATION = CHAL_KEYS.filter(k => DIM_CHAL.bosses[k].rotation);
const chalOfWeek = (now) => CHAL_ROTATION[((weekOf(now) % CHAL_ROTATION.length) + CHAL_ROTATION.length) % CHAL_ROTATION.length];
// The original bosses retain their own bits. The rotation shares one weekly reward bit.
const chalRewardBit = (k) => 1 << CHAL_KEYS.indexOf(DIM_CHAL.bosses[k].rotation ? CHAL_ROTATION[0] : k);
const CHAL_REWARD_MASK = CHAL_KEYS.reduce((mask, k) => mask | chalRewardBit(k), 0);
/** The level a hero needs for a boss challenge: `minGap` world tiers under the boss's own. */
const chalMinLv = (k, s = 0) => (s > 0 ? chalSteps(k)[s][1] - DIM_CHAL.stepGap : shownLv(MOBS[k].lv - DIM_CHAL.minGap));
/** A boss's difficulty ladder: [world tier, hero level shown] — its own level first, then each step far enough above it. */
function chalSteps(k) {
  const out = [[MOBS[k].lv, shownLv(MOBS[k].lv)]];
  for (const L of DIM_CHAL.steps) {
    const t = Math.min(TIER_MAX, Math.round(toTier(L)));
    if (t >= out[out.length - 1][0] + DIM_CHAL.stepMin) out.push([t, L]);
  }
  return out;
}

/** A boss challenge's arena: one oval hall, the party at its west end, the boss in the middle. Pure. */
function dimArena(cfg) {
  // (also a story fight's arena, 67-trophies.js: any boss kind, the ground's theme and its own name)
  const k = cfg.k, own = (Object.hasOwn(DIM_CHAL.bosses, k) && DIM_CHAL.bosses[k]) || {}, W = own.w || DIM_CHAL.w, H = own.h || DIM_CHAL.h, theme = cfg.theme || own.theme;
  const m = blank(cfg.id || "dim:0", cfg.name || `보스 도전: ${MOBS[k].name}`, W, H, "W");
  m.theme = theme; m.bgm = "dim"; m.band = null; m.marks = [];
  const cx = W >> 1, cy = H >> 1, rx = cx - 3, ry = cy - 3;
  let area = 0;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
    m.g[y][x] = fbm(x, y, cfg.seed | 0, 5) > 0.6 ? "d" : "c"; area++;
  }
  const start = [cx - rx + 3, cy], door = [cx - rx + 1, cy - 1];
  m.g[door[1]][door[0]] = "c";
  m.entry = start;
  // no door that works: a boss that never leashes would drag the fight onto it — the HUD's [떠나기] (dim_leave) is the way out
  m.dim = {
    rooms: [{ x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry, cx, cy, kind: "boss", shape: "plain", area }],
    start, boss: [cx, cy], bossRoom: 0, startRoom: 0, door, dead: [], spawns: [], pool: [], bossK: k, path: rx - 2, elites: 0, cap: 1, links: [],
  };
  finalize(m);
  return m;
}
