// ───────────────────────────── maps from the world map editor ─────────────────────────────
// data/maps/<id>.json, data/links.json and data/npcs.json (docs/editor/SCHEMA.md), built into
// the generated `DATA` above. A map file either adds a new place or, with "replaces", takes
// the place of a generated one under the same id. Every door a generated map has into a
// replaced one keeps working when its arrival tile is open ground (data:check says when not;
// here it is moved to the nearest open tile so nobody is ever stuck in a wall).
// Malformed entries are skipped: npm run data:check is where the owner hears about them.

const THEMES = ["town", "meadow", "forest", "crypt", "city", "sewer", "cave", "abyss", "autumn", "interior"];
/** The looks an interior can have (wallpaper, wood and light; public/iso_interior.js). */
const ROOM_STYLES = ["cafe", "hall", "inn", "library"];
/** Little idle acts an NPC can play out (public/iso_interior.js npcPose). */
const NPC_POSES = ["sip", "read", "wipe", "doze", "write"];
/** What an NPC can be: lines only, a side-quest giver, or one of the built-in services. */
const NPC_ROLES = ["talk", "quest", "shop", "smith", "train", "bank", "warp", "daily", "collector", "achieve", "costume", "elder", "dim"];
const BUILTIN_MAPS = ["town", ...GEN_IDS];
const txt = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const xyOk = (m, x, y) => Number.isInteger(x) && Number.isInteger(y) && inMap(m, x, y);
const openTile = (m, x, y) => inMap(m, x, y) && m.o[y][x] === " " && !SOLID_G.includes(m.g[y][x]);

/** An NPC from the editor, cleaned: unknown roles talk, lines are short strings, a look is an array. */
function npcFrom(n, m) {
  if (!n || typeof n.id !== "string" || !xyOk(m, n.x, n.y)) return null;
  const out = { id: txt(n.id, 32), name: txt(n.name, 24) || "주민", role: NPC_ROLES.includes(n.role) ? n.role : "talk", x: n.x, y: n.y,
    look: Array.isArray(n.look) ? n.look.slice(0, 12).map((v) => (typeof v === "string" ? v.slice(0, 9) : v | 0)) : [0, 0, 0, "#6a8a5a"] };
  const lines = Array.isArray(n.lines) ? n.lines.filter((l) => typeof l === "string" && l).slice(0, 12).map((l) => l.slice(0, 240)) : [];
  if (lines.length) { out.lines = lines; out.say = lines[0]; }
  if (n.custom) out.custom = 1;
  // a shopkeeper with their own counter sells only these (items that exist and can be bought)
  if (out.role === "shop" && Array.isArray(n.goods)) {
    const goods = [...new Set(n.goods.filter((id) => typeof id === "string" && Object.hasOwn(ITEMS, id) && ITEMS[id].price > 0 && !ITEMS[id].cls))].slice(0, 24);
    if (goods.length) out.goods = goods;
  }
  if (NPC_POSES.includes(n.pose)) out.pose = n.pose;
  return out;
}

/** Houses stand on 4 × 3 blocks of `h`: a file without a `big` list gets one for each such block. */
function housesFrom(m) {
  const big = [], used = new Set();
  for (let y = 0; y + 2 < m.h; y++) for (let x = 0; x + 3 < m.w; x++) {
    if (m.o[y][x] !== "h" || used.has(y * m.w + x)) continue;
    let all = true;
    for (let dy = 0; dy < 3 && all; dy++) for (let dx = 0; dx < 4 && all; dx++) if (m.o[y + dy][x + dx] !== "h" || used.has((y + dy) * m.w + x + dx)) all = false;
    if (!all) continue;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) used.add((y + dy) * m.w + x + dx);
    const v = (x * 7 + y * 3) % 4;
    big.push({ t: "house", x, y, v: m.theme === "city" ? 4 + v : v });
  }
  return big;
}

/** One editor map file → a map in the generators' shape (rows still arrays; finalized later). */
function fromEditor(d, id) {
  const m = blank(id, txt(d.name, 24) || id, d.w, d.h, ".");
  m.g = d.ground.map((r) => r.split(""));
  m.o = d.objects.map((r) => r.split(""));
  m.custom = true;
  if (ROOM_STYLES.includes(d.style)) m.style = d.style;
  m.theme = THEMES.includes(d.theme) ? d.theme : "meadow";
  m.bgm = txt(d.bgm, 24) || "field";
  m.safe = !!d.safe;
  m.band = Array.isArray(d.band) && d.band.length === 2 ? [clamp(d.band[0] | 0, 1, MAXLV), clamp(d.band[1] | 0, 1, MAXLV)] : null;
  if (!m.band) delete m.band;
  m.nofish = d.fishing === false;
  m.pieces = [];
  m.entry = Array.isArray(d.entry) && xyOk(m, d.entry[0], d.entry[1]) ? [d.entry[0], d.entry[1]] : [m.w >> 1, m.h >> 1];
  m.big = Array.isArray(d.big)
    ? d.big.filter((b) => b && (b.t === "house" || b.t === "fountain" || b.t === "spirit" || b.t === "obelisk") && xyOk(m, b.x, b.y)).map((b) => (b.t === "house" ? { t: "house", x: b.x, y: b.y, v: clamp(b.v | 0, 0, 7) } : { t: b.t, x: b.x, y: b.y }))
    : housesFrom(m);
  if (!m.safe) {
    for (const sp of Array.isArray(d.spawns) ? d.spawns : []) {
      if (!sp || typeof sp.k !== "string" || !Object.hasOwn(MOBS, sp.k) || !Array.isArray(sp.r) || sp.r.length !== 4) continue;
      const r = [clamp(sp.r[0] | 0, 0, m.w - 1), clamp(sp.r[1] | 0, 0, m.h - 1), clamp(sp.r[2] | 0, 0, m.w - 1), clamp(sp.r[3] | 0, 0, m.h - 1)];
      if (r[2] < r[0] || r[3] < r[1]) continue;
      const out = { k: sp.k, n: clamp(sp.n | 0, 1, 40), r };
      if (typeof sp.elite === "number" && Number.isFinite(sp.elite)) out.elite = clamp(sp.elite, 0, 1);
      if (sp.el === 1 || sp.el === 2) out.el = sp.el;
      m.spawns.push(out);
    }
  }
  for (const n of Array.isArray(d.npcs) ? d.npcs : []) { const c = npcFrom(n, m); if (c) m.npcs.push(c); }
  // doors are checked once every map is known
  m.doors = (Array.isArray(d.portals) ? d.portals : []).filter((p) => p && xyOk(m, p.x, p.y) && typeof p.to === "string");
  FIRES[id] = (Array.isArray(d.fires) ? d.fires : []).filter((f) => Array.isArray(f) && xyOk(m, f[0], f[1])).map((f) => [f[0], f[1]]);
  m.marks = (Array.isArray(d.marks) ? d.marks : []).filter((k) => k && k.kind === "sign" && xyOk(m, k.x, k.y)).map((k) => {
    const out = { x: k.x, y: k.y, kind: "sign", label: txt(k.label, 40) };
    if (typeof k.to === "string") out.to = k.to;
    return out;
  });
  delete WP[id];
  /** [x, y] a stone, and optionally [.., ax, ay] the tile travellers arrive on beside it. */
  const stoneAt = ([x, y, ax, ay], i) => {
    m.o[y][x] = "Q";
    const side = Number.isInteger(ax) && Number.isInteger(ay) && Math.abs(ax - x) <= 1 && Math.abs(ay - y) <= 1 && openTile(m, ax, ay) ? [ax - x, ay - y]
      : [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].find(([dx, dy]) => openTile(m, x + dx, y + dy)) || [0, 1];
    return { x, y, ax: x + side[0], ay: y + side[1], i };
  };
  if (Array.isArray(d.waypoint) && xyOk(m, d.waypoint[0], d.waypoint[1])) {
    WP[id] = stoneAt(d.waypoint, 0);
    // more stones along the way (a big generated ground exported for the editor has three)
    const more = (Array.isArray(d.stones) ? d.stones : []).filter((w) => Array.isArray(w) && xyOk(m, w[0], w[1])).slice(0, 3);
    if (more.length) m.stones = [WP[id], ...more.map((w, k) => stoneAt(w, k + 1))];
    m.marks.unshift(...(m.stones || [WP[id]]).map((w) => ({ x: w.x, y: w.y, kind: "waypoint" })));
  }
  // wind shrines (질주의 바람): object "/" on each tile
  const sh = (Array.isArray(d.shrines) ? d.shrines : []).filter((w) => Array.isArray(w) && xyOk(m, w[0], w[1])).slice(0, 8);
  if (sh.length) m.shrines = sh.map(([x, y]) => { m.o[y][x] = "/"; return [x, y]; });
  // a hunting ground's field boss: called out by kills, like every generated one
  if (!m.safe && d.boss && typeof d.boss.k === "string" && Object.hasOwn(MOBS, d.boss.k)) {
    FIELD_BOSS[id] = d.boss.k;
    // its x, y (if any) is where it prefers to walk in (still kept clear of stone, signs and players)
    if (xyOk(m, d.boss.x, d.boss.y)) m.bossAt = [d.boss.x, d.boss.y];
  } else delete FIELD_BOSS[id];
  return m;
}

// ───────────────────────────── the map registry ─────────────────────────────
// Maps are built when first needed and kept (one isolate = one channel room, so each is built
// at most once per room). Built when the rules load: the town and every editor map (small,
// and the editor's waypoints, camps and field bosses must be known from the start). Built on
// first use: the generated hunting grounds. Everything the rest of the rules needs to know about
// a map without walking it — name, theme, level band, size, whether it has a waypoint stone,
// which monsters live there — is in MAP_META, read from the settings, never from the terrain.

/** Editor map files by the id they take (a replacement under the built-in id); ALIAS: a file's own id → that id. */
const FILES = {}, ALIAS = {};
for (const d of DATA.maps) {
  const rep = typeof d.replaces === "string" && d.replaces ? d.replaces : null;
  if (rep && !BUILTIN_MAPS.includes(rep)) continue;
  const id = rep || d.id;
  if (!rep && (BUILTIN_MAPS.includes(id) || Object.hasOwn(FILES, id))) continue;
  ALIAS[d.id] = id;
  FILES[id] = d;
}
/** The map id a name from the editor's data means (its own id, or a file id that replaces a built-in), or null. */
const realId = (id) => (typeof id === "string" ? (Object.hasOwn(MAP_META, id) ? id : Object.hasOwn(ALIAS, id) ? ALIAS[id] : null) : null);

/** A map before the editor's doors, links and NPCs are laid over it (rows still arrays). */
function baseMap(id) {
  const d = FILES[id];
  if (d) {
    const m = fromEditor(d, id);
    // a replacement keeps the generated map's level band unless the file says otherwise
    if (GEN[id] && !m.band && !d.band && d.band !== null) m.band = GEN[id].band.slice();
    return m;
  }
  if (id === "town") { FIRES.town = []; const m = buildTown(); gateDoors(m); return m; }
  return genMap(id);
}
/** The editor's doors, links and NPCs laid over a map, then the map finalized (rows joined, solid, reach). */
function finishMap(m) {
  const id = m.id;
  if (m.doors) {
    for (const p of m.doors) {
      const to = realId(p.to);
      if (!to || !xyOk(MAP_META[to], p.tx, p.ty)) continue;
      m.portals.push({ x: p.x, y: p.y, to, tx: p.tx, ty: p.ty });
    }
    delete m.doors;
  }
  // doors added to any map, built-in or the editor's own
  for (const l of DATA.links) {
    if (realId(l.map) !== id) continue;
    const to = realId(l.to);
    if (!to || !xyOk(m, l.x, l.y) || !xyOk(MAP_META[to], l.tx, l.ty)) continue;
    m.o[l.y][l.x] = " ";
    const p = { x: l.x, y: l.y, to, tx: l.tx, ty: l.ty };
    if (typeof l.label === "string" && l.label) p.label = l.label.slice(0, 40);
    m.portals.push(p);
  }
  // NPCs added to any map
  for (const n of DATA.npcs) {
    if (realId(n.map) !== id) continue;
    const c = npcFrom(n, m);
    if (c && !m.npcs.some((o) => o.id === c.id)) m.npcs.push(c);
  }
  if (!FIRES[id]) FIRES[id] = [];
  finalize(m);
  buildCells(m);
  return m;
}
/**
 * The map's monsters by cell (CELL × CELL tiles): m.cells = { cw, ch, spawns, fixed, open, zone }.
 * `spawns[cell]` lists the quotas that live in a cell ({ k, n, ep, r, zone }: kind, how many, elite
 * chance, the box they stand in, clipped to the cell); every old spawn box is shared out over the
 * cells it covers by their walkable tiles. `fixed` are the ones that never sleep (chests, bosses,
 * guardians and other placed elites), `open` the walkable tiles per cell. A generator may set
 * `m.zone` (a Uint8Array, one zone per tile) first; a quota takes its spawn's own `zone` (zoneSpawns),
 * else the zone at its box's centre; without a zone map every quota is zone 1.
 */
function buildCells(m) {
  const cw = Math.ceil(m.w / CELL), ch = Math.ceil(m.h / CELL), W = m.w;
  const spawns = Array.from({ length: cw * ch }, () => []), fixed = [], open = new Int32Array(cw * ch);
  const zone = m.zone || null;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < W; x++) if (m.reach[y * W + x]) open[Math.floor(y / CELL) * cw + Math.floor(x / CELL)]++;
  const reachIn = (x0, y0, x1, y1) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.reach[y * W + x]) n++; return n; };
  for (const sp of m.spawns) {
    if (MOBS[sp.k].chest || MOBS[sp.k].boss || sp.el) { fixed.push(sp); continue; }
    const [x0, y0, x1, y1] = sp.r, parts = [];
    let total = 0;
    for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      const r = [Math.max(x0, cx * CELL), Math.max(y0, cy * CELL), Math.min(x1, cx * CELL + CELL - 1), Math.min(y1, cy * CELL + CELL - 1)];
      const n = reachIn(...r);
      if (n) { parts.push({ i: cy * cw + cx, r, n }); total += n; }
    }
    if (!total) continue; // nowhere to stand: it never spawned anywhere before either
    // shares by walkable tiles, the remainder to the largest fractions (first box first on a tie)
    const want = parts.map((p) => (sp.n * p.n) / total), got = want.map(Math.floor);
    let left = sp.n - got.reduce((a, b) => a + b, 0);
    const order = parts.map((_, j) => j).sort((a, b) => want[b] - got[b] - (want[a] - got[a]) || a - b);
    for (let j = 0; left > 0; j++, left--) got[order[j % order.length]]++;
    parts.forEach((p, j) => {
      if (!got[j]) return;
      const z = sp.zone !== undefined ? sp.zone : zone ? zone[Math.floor((p.r[1] + p.r[3]) / 2) * W + Math.floor((p.r[0] + p.r[2]) / 2)] : 1;
      spawns[p.i].push({ k: sp.k, n: got[j], ep: sp.elite !== undefined ? sp.elite : 0.08, r: p.r, zone: z });
    });
  }
  m.cells = { cw, ch, spawns, fixed, open, zone };
}
const metaKinds = (m) => [...new Set(m.spawns.map((sp) => sp.k))];

/** What is known of every map without building it: { id, name, theme, band, safe, w, h, wp, wpn (how many stones), kinds, eager }. */
const MAP_META = {};
const EAGER = {};
for (const id of [...BUILTIN_MAPS, ...Object.keys(FILES).filter((id) => !BUILTIN_MAPS.includes(id))]) {
  if (id === "town" || FILES[id]) {
    const m = (EAGER[id] = baseMap(id));
    MAP_META[id] = { id, name: m.name, theme: m.theme || null, band: m.band || null, safe: !!m.safe, w: m.w, h: m.h, wp: !!WP[id], wpn: m.stones ? m.stones.length : WP[id] ? 1 : 0, kinds: metaKinds(m), eager: true };
  } else {
    const g = GEN[id], c = g.cfg();
    MAP_META[id] = { id, name: c.name, theme: g.theme || c.theme || null, band: g.band.slice(), safe: false, w: c.w, h: c.h, wp: true, wpn: g.stones || 1, kinds: genKinds(id), eager: false };
  }
}
/** Built maps by id. */
const MAP_CACHE = {};
/** NPC id → the map it stands on, and its name (side quests find their givers and talk targets here). */
const NPC_MAP = {}, NPC_NAME = {};
const noteNpc = (id, nid, name) => { if (!NPC_MAP[nid]) { NPC_MAP[nid] = id; NPC_NAME[nid] = name; } };
/**
 * The built map `id` (generated, laid over and finalized on first use, then kept), or null for
 * an id the world does not have. Never a runtime instance: see mapOfS.
 */
function mapOf(id) {
  const c = MAP_CACHE[id];
  if (c) return c;
  if (typeof id !== "string" || !Object.hasOwn(MAP_META, id)) return null;
  const m = finishMap(EAGER[id] || baseMap(id));
  delete EAGER[id];
  MAP_CACHE[id] = m;
  return m;
}
/** The map `id` as the world `S` sees it: a runtime instance ("dim:<n>", in S.dims) or mapOf(id). */
function mapOfS(S, id) {
  return S && S.dims && Object.hasOwn(S.dims, id) ? S.dims[id].map : mapOf(id);
}
/** Every map built (tests, tools, the editor), keyed in MAP_META order, every door's arrival tile resolved. */
function allMaps() {
  const out = {};
  for (const id of Object.keys(MAP_META)) out[id] = mapOf(id);
  for (const id of Object.keys(out)) for (const pt of out[id].portals) arrivalOf(null, pt);
  return out;
}
/** A sheet's waypoint stones per map are a bitmask (ch.wp): up to this many stones on one map. */
const WP_MASK = 0xff;
/** Whether a sheet has woken stone `i` of map `id`. */
const wpWoken = (ch, id, i = 0) => typeof id === "string" && Object.hasOwn(ch.wp, id) && !!(ch.wp[id] & (1 << i));
/** How many stones a sheet has woken, on every map together. */
const wpCount = (ch) => { let n = 0; for (const id of Object.keys(ch.wp)) for (let k = ch.wp[id]; k; k &= k - 1) n++; return n; };
/** Whether a map has a waypoint stone (known without building it). */
const hasWp = (id) => typeof id === "string" && Object.hasOwn(MAP_META, id) && MAP_META[id].wp;
/** A map's waypoint stone { x, y, ax, ay } (builds the map), or null. */
function wpOf(id) {
  return hasWp(id) && mapOf(id) && WP[id] ? WP[id] : null;
}
/**
 * The tile a door puts you on: beside the named gate of the map behind it (a generated door),
 * or the tile the editor gave it; the nearest open tile when that is in a wall, the map's
 * entrance when the gate is gone (an editor map replaced the target). Worked out on first use
 * and remembered on the door.
 */
function arrivalOf(S, pt) {
  if (!pt.ok) {
    const t = mapOfS(S, pt.to);
    if (!t) return null;
    let at = pt.gate !== undefined ? (t.gates && t.gates[pt.gate] ? t.gates[pt.gate].a[pt.k] : t.entry) : [pt.tx, pt.ty];
    if (!inMap(t, at[0], at[1]) || !t.reach[at[1] * t.w + at[0]]) at = freeTile(t, at[0], at[1]) || t.entry;
    pt.tx = at[0]; pt.ty = at[1]; pt.ok = 1;
  }
  return [pt.tx, pt.ty];
}

// the town and the editor's maps, now
for (const id of Object.keys(EAGER)) mapOf(id);
/**
 * Where each map's doors lead (map ids, for the world route map in defs), known without building
 * a generated map: a built map's own doors, else its GATE_LINKS and the editor's links.
 */
const ROUTES = {};
for (const id of Object.keys(MAP_META)) {
  const to = new Set();
  if (MAP_CACHE[id]) for (const p of MAP_CACHE[id].portals) to.add(p.to);
  else {
    for (const [a, , b, , both] of GATE_LINKS) { if (a === id) to.add(b); if (both && b === id) to.add(a); }
    for (const l of DATA.links) if (realId(l.map) === id && realId(l.to) && xyOk(MAP_META[id], l.x, l.y)) to.add(realId(l.to));
  }
  to.delete(id);
  ROUTES[id] = [...to].filter((t) => Object.hasOwn(MAP_META, t));
}
const START ={ map: "town", x: mapOf("town").entry[0] * T + 8, y: mapOf("town").entry[1] * T + 8 };
/** Every monster that lives somewhere (no chests, no bosses), and each hunting ground's for its collection. */
const HUNTED = [...new Set(Object.values(MAP_META).flatMap((mm) => mm.kinds))].filter((k) => !MOBS[k].chest && !MOBS[k].boss);
const COL_MOBS = {};
for (const id of Object.keys(MAP_META)) {
  if (MAP_META[id].safe) continue;
  const ks = MAP_META[id].kinds.filter((k) => HUNTED.includes(k));
  if (ks.length) COL_MOBS[id] = ks;
}
// everyone's place, first map first: the people of built maps as they stand, of the others
// those their generator places and the editor's
for (const id of Object.keys(MAP_META)) {
  if (MAP_CACHE[id]) { for (const n of MAP_CACHE[id].npcs) noteNpc(id, n.id, n.name); continue; }
  for (const [nid, name] of GEN[id].npcs || []) noteNpc(id, nid, name);
  for (const n of DATA.npcs) { const c = realId(n && n.map) === id && npcFrom(n, MAP_META[id]); if (c) noteNpc(id, c.id, c.name); }
}

/**
 * The map editor's playtest (local dev only; room.ts checks PLAYTEST and HF_ENV): put a saved
 * sheet on tile (tx, ty) of `map`, or the nearest tile a player can stand on, or the entrance.
 */
export function devPlace(ch, map, tx, ty) {
  const m = typeof map === "string" ? mapOf(map) : null;
  if (!ch || !m) return false;
  const at = (Number.isInteger(tx) && Number.isInteger(ty) && inMap(m, tx, ty) && m.reach[ty * m.w + tx] ? [tx, ty] : null) || freeTile(m, tx | 0, ty | 0) || m.entry;
  ch.map = map; ch.x = at[0] * T + 8; ch.y = at[1] * T + 10;
  if (ch.hp === 0) ch.hp = -1;
  return true;
}
