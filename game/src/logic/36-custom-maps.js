// ───────────────────────────── maps from the world map editor ─────────────────────────────
// data/maps/<id>.json, data/links.json and data/npcs.json (docs/editor/SCHEMA.md), built into
// the generated `DATA` above. A map file either adds a new place or, with "replaces", takes
// the place of a generated one under the same id. Every door a generated map has into a
// replaced one keeps working when its arrival tile is open ground (data:check says when not;
// here it is moved to the nearest open tile so nobody is ever stuck in a wall).
// Malformed entries are skipped: npm run data:check is where the owner hears about them.

const THEMES = ["town", "meadow", "forest", "crypt", "city", "sewer", "cave", "abyss"];
/** What an NPC can be: lines only, a side-quest giver, or one of the built-in services. */
const NPC_ROLES = ["talk", "quest", "shop", "smith", "train", "bank", "warp", "daily", "collector", "achieve", "costume", "elder"];
const BUILTIN_MAPS = ["town", "meadow", "forest", "crypt", "city", "sewer", "cave", "abyss"];
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
  m.theme = THEMES.includes(d.theme) ? d.theme : "meadow";
  m.bgm = txt(d.bgm, 24) || "field";
  m.safe = !!d.safe;
  m.band = Array.isArray(d.band) && d.band.length === 2 ? [clamp(d.band[0] | 0, 1, MAXLV), clamp(d.band[1] | 0, 1, MAXLV)] : null;
  if (!m.band) delete m.band;
  m.nofish = d.fishing === false;
  m.pieces = [];
  m.entry = Array.isArray(d.entry) && xyOk(m, d.entry[0], d.entry[1]) ? [d.entry[0], d.entry[1]] : [m.w >> 1, m.h >> 1];
  m.big = Array.isArray(d.big)
    ? d.big.filter((b) => b && (b.t === "house" || b.t === "fountain") && xyOk(m, b.x, b.y)).map((b) => (b.t === "house" ? { t: "house", x: b.x, y: b.y, v: clamp(b.v | 0, 0, 7) } : { t: "fountain", x: b.x, y: b.y }))
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
  if (Array.isArray(d.waypoint) && xyOk(m, d.waypoint[0], d.waypoint[1])) {
    const [x, y] = d.waypoint;
    m.o[y][x] = "Q";
    const side = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].find(([dx, dy]) => openTile(m, x + dx, y + dy)) || [0, 1];
    WP[id] = { x, y, ax: x + side[0], ay: y + side[1] };
    m.marks.push({ x, y, kind: "waypoint" });
  }
  // a hunting ground's field boss: called out by kills, like every generated one
  if (!m.safe && d.boss && typeof d.boss.k === "string" && Object.hasOwn(MOBS, d.boss.k)) FIELD_BOSS[id] = d.boss.k;
  else delete FIELD_BOSS[id];
  return m;
}

/** The generated world with the editor's maps, doors and NPCs laid over it. */
function customWorld(gen) {
  const maps = {};
  for (const id of Object.keys(gen)) {
    const m = gen[id];
    m.g = m.g.map((r) => (typeof r === "string" ? r.split("") : r));
    m.o = m.o.map((r) => (typeof r === "string" ? r.split("") : r));
    maps[id] = m;
  }
  // a file's own id is another name for the map it replaces
  const alias = {};
  for (const d of DATA.maps) {
    const rep = typeof d.replaces === "string" && d.replaces ? d.replaces : null;
    if (rep && !Object.hasOwn(gen, rep)) continue;
    const id = rep || d.id;
    if (!rep && Object.hasOwn(maps, id)) continue;
    alias[d.id] = id;
    const old = maps[id];
    const m = fromEditor(d, id);
    // the doors other maps have into a replaced map stay; its own doors come from the file
    if (old && old.band && !m.band && !d.band && d.band !== null) m.band = old.band;
    maps[id] = m;
  }
  const real = (id) => (typeof id === "string" ? (Object.hasOwn(maps, id) ? id : Object.hasOwn(alias, id) ? alias[id] : null) : null);
  for (const m of Object.values(maps)) {
    if (!m.doors) continue;
    for (const p of m.doors) {
      const to = real(p.to);
      if (!to || !xyOk(maps[to], p.tx, p.ty)) continue;
      m.portals.push({ x: p.x, y: p.y, to, tx: p.tx, ty: p.ty });
    }
    delete m.doors;
  }
  // doors added to any map, built-in or the editor's own
  for (const l of DATA.links) {
    const from = maps[real(l.map)], to = real(l.to);
    if (!from || !to || !xyOk(from, l.x, l.y) || !xyOk(maps[to], l.tx, l.ty)) continue;
    from.o[l.y][l.x] = " ";
    const p = { x: l.x, y: l.y, to, tx: l.tx, ty: l.ty };
    if (typeof l.label === "string" && l.label) p.label = l.label.slice(0, 40);
    from.portals.push(p);
  }
  // NPCs added to any map
  for (const n of DATA.npcs) {
    const m = maps[real(n.map)];
    const c = m && npcFrom(n, m);
    if (c && !m.npcs.some((o) => o.id === c.id)) m.npcs.push(c);
  }
  for (const id of Object.keys(maps)) if (!FIRES[id]) FIRES[id] = [];
  // the editor's maps and the ones it touched are finalized again; the rest come out the same
  for (const m of Object.values(maps)) finalize(m);
  // an arrival tile in a wall becomes the nearest open tile (or the map's entrance)
  for (const m of Object.values(maps)) for (const p of m.portals) {
    const t = maps[p.to];
    if (t.reach[p.ty * t.w + p.tx]) continue;
    const at = freeTile(t, p.tx, p.ty) || t.entry;
    p.tx = at[0]; p.ty = at[1];
  }
  return maps;
}

const MAPS = customWorld(buildMaps());
const START = { map: "town", x: MAPS.town.entry[0] * T + 8, y: MAPS.town.entry[1] * T + 8 };
/** Every monster that lives somewhere (no chests, no bosses), and each hunting ground's for its collection. */
const HUNTED = [...new Set(Object.values(MAPS).flatMap((m) => m.spawns.map((sp) => sp.k)))].filter((k) => !MOBS[k].chest && !MOBS[k].boss);
const COL_MOBS = {};
for (const id of Object.keys(MAPS)) {
  if (MAPS[id].safe) continue;
  const ks = [...new Set(MAPS[id].spawns.map((sp) => sp.k))].filter((k) => HUNTED.includes(k));
  if (ks.length) COL_MOBS[id] = ks;
}
/** NPC id → the map it stands on (side quests find their givers and talk targets here). */
const NPC_MAP = {};
for (const id of Object.keys(MAPS)) for (const n of MAPS[id].npcs) if (!NPC_MAP[n.id]) NPC_MAP[n.id] = id;
