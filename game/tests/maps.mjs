// Headless test of the generated world — every hunting ground connected from its entrance to
// everything that matters, every spawn standable, the same world from the same seeds, built
// only when first needed and quickly then, and built with variety rather than boxes: node tests/maps.mjs
import assert from "node:assert/strict";

const t0 = performance.now();
const L = await import("../src/logic.js");
const loadMs = performance.now() - t0;
const { built: builtAtLoad, meta } = (({ built, meta }) => ({ built: built.slice(), meta }))(L.mapStats());

const { maps, fires, waypoints } = L.atlas();
const D = L.defs();
const HUNT = ["meadow", "forest", "crypt", "city", "sewer", "cave", "abyss", "maple"];
const blocked = (m, x, y) => x < 0 || y < 0 || x >= m.w || y >= m.h || m.o[y][x] !== " " || "wW".includes(m.g[y][x]);
const flood = (m, sx, sy) => {
  const d = new Int32Array(m.w * m.h).fill(-1), q = [[sx, sy]];
  d[sy * m.w + sx] = 0;
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (blocked(m, nx, ny) || d[ny * m.w + nx] >= 0) continue;
      d[ny * m.w + nx] = d[y * m.w + x] + 1; q.push([nx, ny]);
    }
  }
  return d;
};
const report = [];
for (const id of HUNT) {
  const m = maps[id];
  assert.ok(m, id + " exists");
  const d = flood(m, m.entry[0], m.entry[1]);
  const at = (x, y) => d[y * m.w + x] >= 0;
  const near = (x, y) => at(x, y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy));

  // ── connected: every gate and its arrival tiles, every camp, the waypoint stone, every spawn and chest
  for (const [name, g] of Object.entries(m.gates)) {
    for (const [x, y] of g.a) assert.ok(at(x, y), `${id}: the arrival tile of gate ${name} can be walked to`);
    for (const [x, y] of g.t) assert.ok(at(x, y), `${id}: gate ${name} can be walked onto`);
  }
  for (const p of m.portals) assert.ok(at(p.x, p.y), `${id}: the door to ${p.to} can be walked to`);
  assert.ok(fires[id].length >= 1, id + " has a camp");
  for (const [x, y] of fires[id]) assert.ok(near(x, y), `${id}: the camp at ${x},${y} can be reached`);
  const wp = waypoints[id];
  assert.ok(wp && at(wp.ax, wp.ay), id + ": the waypoint stone can be reached");
  for (const sp of m.spawns) {
    const [x0, y0, x1, y1] = sp.r;
    let ok = false;
    for (let y = y0; y <= y1 && !ok; y++) for (let x = x0; x <= x1 && !ok; x++) if (m.reach[y * m.w + x]) ok = true;
    assert.ok(ok, `${id}: the ${sp.k} spawn at ${sp.r} holds standable ground`);
    if (D.mobs[sp.k].chest || D.mobs[sp.k].boss) assert.ok(at(x0, y0) || ok, `${id}: the ${sp.k} can be reached`);
  }
  // nothing walkable is shut away: no pocket of open ground bigger than a few tiles is cut off
  const seen = new Uint8Array(m.w * m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (blocked(m, x, y) || at(x, y) || seen[y * m.w + x]) continue;
    const p = flood(m, x, y);
    let n = 0;
    for (let i = 0; i < p.length; i++) if (p[i] >= 0) { seen[i] = 1; n++; }
    assert.ok(n < 6, `${id}: a sealed pocket of ${n} tiles at ${x},${y}`);
  }

  // ── variety: set pieces, kinds of scenery, and few straight single-file corridors
  const pieces = new Set(m.pieces || []);
  assert.ok(pieces.size >= 4, `${id}: at least four kinds of set piece (${[...pieces]})`);
  const objs = new Set();
  for (const row of m.o) for (const ch of row) if (ch !== " ") objs.add(ch);
  assert.ok(objs.size >= 6, `${id}: at least six kinds of thing standing about (${[...objs].join("")})`);
  let walk = 0, corridor = 0;
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (blocked(m, x, y)) continue;
    walk++;
    const h = !blocked(m, x - 1, y) && !blocked(m, x + 1, y) && blocked(m, x, y - 1) && blocked(m, x, y + 1);
    const v = !blocked(m, x, y - 1) && !blocked(m, x, y + 1) && blocked(m, x - 1, y) && blocked(m, x + 1, y);
    if (h || v) corridor++;
  }
  const cf = corridor / walk;
  assert.ok(cf < 0.12, `${id}: ${(cf * 100).toFixed(1)}% of the walkable ground is single-file corridor`);
  // and somewhere to fight: a patch of open ground at least 7 × 5, either way round
  let room = false;
  for (const [w, h] of [[7, 5], [5, 7]]) for (let y = 2; y < m.h - h - 1 && !room; y++) for (let x = 2; x < m.w - w - 1 && !room; x++) {
    let ok = true;
    for (let dy = 0; dy < h && ok; dy++) for (let dx = 0; dx < w && ok; dx++) if (blocked(m, x + dx, y + dy)) ok = false;
    room = ok;
  }
  assert.ok(room, id + ": has open ground to fight on");
  report.push(`${id} ${m.w}x${m.h} pieces ${pieces.size} things ${objs.size} corridor ${(cf * 100).toFixed(1)}%`);
}
// where there is water there is somewhere to fish from
for (const id of ["meadow", "forest", "cave", "maple"]) {
  const m = maps[id];
  let shore = false;
  for (let y = 1; y < m.h - 1 && !shore; y++) for (let x = 1; x < m.w - 1 && !shore; x++) if (m.reach[y * m.w + x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.g[y + dy][x + dx] === "w")) shore = true;
  assert.ok(shore, id + " has a shore to fish from");
}

// ── 4× grounds (docs/design/scale-and-rift.md C): zones by the walk from the entrance, colonies by zone,
// hidden pockets with a chest and its guardian, three waypoint stones with a wind shrine past each later one
const D0 = (k) => D.mobs[k];
const DENS = Function(`return (${/const DENSITY = (\{[^}]*\})/.exec((await import("node:fs")).readFileSync(new URL("../src/logic/10-tables.js", import.meta.url), "utf8"))[1]})`)();
const SIZE = { meadow: [152, 102], forest: [152, 102], crypt: [132, 102], city: [152, 102], sewer: [152, 102], cave: [132, 100], abyss: [152, 120], maple: [160, 112] };
const zrep = [];
for (const id of HUNT) {
  const m = maps[id], W = m.w, Z = m.zone, d = flood(m, m.entry[0], m.entry[1]);
  assert.deepEqual([m.w, m.h], SIZE[id], id + ": twice the first world's size each way");
  assert.ok(Z instanceof Uint8Array && Z.length === m.w * m.h, id + " is cut into zones");
  const zAt = (x, y) => Z[y * W + x], cen = (r) => [Math.floor((r[0] + r[2]) / 2), Math.floor((r[1] + r[3]) / 2)];
  const { D: far, safeR, eliteD } = m.zinfo;
  assert.ok(far > 120 && safeR >= 10 && eliteD > safeR && eliteD <= far, `${id}: zone cuts ${safeR}/${eliteD} of ${far}`);
  // the zones follow the walk: safe by the door, elite only far in, every way in quiet round its arrival tiles
  for (let i = 0; i < Z.length; i++) {
    if (d[i] < 0) continue;
    if (d[i] < safeR) assert.equal(Z[i], 0, `${id}: ${i % W},${Math.floor(i / W)} is by the door, so safe`);
    if (Z[i] === 2) assert.ok(d[i] >= eliteD, `${id}: elite ground only far in`);
  }
  for (const o of Object.values(maps)) for (const pt of o.portals) if (pt.to === id) assert.equal(zAt(pt.tx, pt.ty), 0, `${id}: arriving from ${o.id} lands on quiet ground`);
  const cnt = [0, 0, 0, 0];
  for (let i = 0; i < Z.length; i++) if (m.reach[i]) cnt[Z[i]]++;
  const walk = cnt.reduce((a, b) => a + b, 0);
  assert.ok(cnt[1] > cnt[2] && cnt[2] >= walk * 0.08 && cnt[2] <= walk * 0.36, `${id}: normal ground the most, elite a fair share (${cnt})`);
  // who lives where: nobody in the plaza or in a pocket but its guardian; each quota's box holds ground of its own zone
  const ord = m.spawns.filter((sp) => !D0(sp.k).chest && !D0(sp.k).boss && !sp.el);
  for (const sp of m.spawns) {
    const [cx, cy] = cen(sp.r);
    if (sp.zone !== undefined) {
      let has = false;
      for (let y = sp.r[1]; y <= sp.r[3] && !has; y++) for (let x = sp.r[0]; x <= sp.r[2] && !has; x++) if (m.reach[y * W + x] && zAt(x, y) === sp.zone) has = true;
      assert.ok(has, `${id}: the ${sp.k} quota at ${sp.r} has ground of its zone ${sp.zone}`);
      assert.ok(sp.el || (sp.zone === 1 || sp.zone === 2), `${id}: only colonies of the normal and elite ground (${sp.k} zone ${sp.zone})`);
    } else if (!sp.el && !D0(sp.k).chest && !D0(sp.k).boss) assert.ok(zAt(cx, cy) === 1 || zAt(cx, cy) === 2, `${id}: the ${sp.k} pack at ${sp.r} is out in the hunting ground`);
    if (sp.el || D0(sp.k).chest) assert.notEqual(zAt(sp.r[0], sp.r[1]), 0, `${id}: no ${sp.k} in the safe plaza`);
  }
  // stronger kinds and far more elites in the elite ground
  const mean = (l) => l.reduce((a, sp) => a + D0(sp.k).lv * sp.n, 0) / l.reduce((a, sp) => a + sp.n, 0);
  const rate = (l) => l.reduce((a, sp) => a + sp.elite * sp.n, 0) / l.reduce((a, sp) => a + sp.n, 0);
  const nz = ord.filter((sp) => sp.zone === 1), ez = ord.filter((sp) => sp.zone === 2);
  assert.ok(nz.length && ez.length, id + " has colonies in both");
  assert.ok(mean(ez) > mean(nz), `${id}: elite ground holds stronger kinds (lv ${mean(ez).toFixed(1)} vs ${mean(nz).toFixed(1)})`);
  const lvs = D.maps.find((o) => o.id === id).mobs.filter((k) => !D0(k).chest && !D0(k).boss).map((k) => D0(k).lv).sort((a, b) => a - b);
  for (const sp of ez) assert.ok(D0(sp.k).lv >= lvs[0], `${id}: no ${sp.k} weaklings deep in`);
  assert.ok(rate(ez) > rate(nz) * 4, `${id}: elites far more often there (${rate(ez).toFixed(2)} vs ${rate(nz).toFixed(2)})`);
  // the crowd: about one monster per DENSITY tiles of normal ground
  const per = cnt[1] / nz.reduce((a, sp) => a + sp.n, 0);
  assert.ok(per > DENS[id] * 0.85 && per < DENS[id] * 1.15, `${id}: ${per.toFixed(1)} tiles per monster on normal ground (${DENS[id]})`);
  // hidden pockets: behind a narrow mouth, each holding a chest and one guardian, all of it reachable
  assert.ok(m.pockets.length >= 2, `${id}: at least two hidden pockets (${m.pockets.length})`);
  for (const pk of m.pockets) {
    for (const i of pk.tiles) assert.ok(m.reach[i] && Z[i] === 3, `${id}: a pocket's ground is reachable and hidden`);
    for (const [x, y] of pk.chests) assert.equal(zAt(x, y), 3, `${id}: the pocket's chest is in it`);
    const g = m.spawns.find((sp) => sp.el === 1 && sp.zone === 3 && sp.r[0] === pk.guard[0] && sp.r[1] === pk.guard[1]);
    assert.ok(g && m.reach[pk.guard[1] * W + pk.guard[0]], `${id}: a guardian keeps the pocket at ${pk.chests[0]}`);
  }
  assert.ok(m.marks.some((k) => k.kind === "sign" && k.label.startsWith("수상한 샛길")), `${id}: a hint at a pocket's mouth`);
  assert.ok(m.marks.some((k) => k.kind === "sign" && k.label.startsWith("엘리트 지대")), `${id}: a warning where the elite ground begins`);
  // waypoint stones: as many as MAP_META says, deeper and deeper along the way on, each reachable; a wind shrine past each later one
  assert.equal(m.stones.length, meta[id].wpn, `${id}: ${meta[id].wpn} waypoint stones`);
  assert.deepEqual(m.stones[0], waypoints[id], `${id}: the first stone is the map's own (WP)`);
  m.stones.forEach((s, i) => {
    assert.equal(s.i, i);
    assert.equal(m.o[s.y][s.x], "Q");
    assert.ok(d[s.ay * W + s.ax] >= 0, `${id}: stone ${i} can be walked to`);
    if (i) assert.ok(d[s.ay * W + s.ax] > d[m.stones[i - 1].ay * W + m.stones[i - 1].ax] + 20, `${id}: stone ${i} lies further in`);
  });
  assert.equal(zAt(m.stones[0].ax, m.stones[0].ay), 0, `${id}: the first stone stands in the safe plaza`);
  assert.equal(m.marks.filter((k) => k.kind === "waypoint").length, m.stones.length);
  assert.equal(m.shrines.length, m.stones.length - 1, `${id}: a wind shrine past every stone but the first`);
  for (const [x, y] of m.shrines) {
    assert.equal(m.o[y][x], "/");
    assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => d[(y + dy) * W + x + dx] >= 0), `${id}: the shrine at ${x},${y} can be touched`);
  }
  // a fire in the plaza as well as the camp further in
  assert.ok(fires[id].some(([x, y]) => zAt(x, y) === 0), `${id}: a campfire in the safe plaza`);
  zrep.push(`${id} D${far} safe/normal/elite/hidden ${cnt.join("/")} pockets ${m.pockets.length} stones ${m.stones.length} quotas ${ord.reduce((a, sp) => a + sp.n, 0)}`);
}

// ── deterministic: the same seeds give the same world, tile for tile and monster for monster
const shape = (all) => JSON.stringify(HUNT.map((id) => { const m = all[id]; return [m.g, m.o, m.spawns, m.portals, m.marks, m.pieces, m.zq, m.stones, m.shrines, m.pockets]; }));
const before = shape(maps), firesBefore = JSON.stringify(fires);
const again = L.atlas(true);
assert.equal(shape(again.maps), before, "rebuilding from the seeds gives the same world");
assert.equal(JSON.stringify(again.fires), firesBefore, "and the same camps");

// ── lazy: loading the rules builds only the town and the editor's maps; every hunting ground waits for its first visitor
const eager = Object.keys(meta).filter((id) => meta[id].eager);
assert.deepEqual(builtAtLoad.slice().sort(), eager.slice().sort(), `only ${eager} are built when the rules load (built: ${builtAtLoad})`);
for (const id of HUNT) assert.ok(meta[id].eager || !builtAtLoad.includes(id), id + " is not built at load");
// what is known without building a map is what the built map turns out to be
for (const id of Object.keys(meta)) {
  const mm = meta[id], m = maps[id];
  assert.equal(mm.name, m.name, id + ": name");
  assert.equal(mm.theme, m.theme || null, id + ": theme");
  assert.deepEqual(mm.band, m.band || null, id + ": band");
  assert.equal(mm.safe, !!m.safe, id + ": safe");
  assert.deepEqual([mm.w, mm.h], [m.w, m.h], id + ": size");
  assert.equal(mm.wp, !!waypoints[id], id + ": waypoint stone");
  assert.deepEqual(mm.kinds.slice().sort(), [...new Set(m.spawns.map((sp) => sp.k))].sort(), id + ": the monsters it lists are the ones it places");
  for (const p of m.portals) assert.ok(meta[p.to] && Number.isInteger(p.tx) && maps[p.to].reach[p.ty * maps[p.to].w + p.tx], `${id}: the door to ${p.to} lands on open ground`);
}
// a rift opens only where a stone stands
for (const id of D.event.maps) assert.ok(waypoints[id], id + " (rift map) has a waypoint stone");

// ── maps come alive one at a time: a fresh world has only the town; a door, a waypoint or an event wakes the rest
{
  const S = L.setup();
  assert.deepEqual(Object.keys(S.maps), ["town"], "a new channel holds only the town");
  assert.deepEqual(S.dims, {}, "and no instances");
  const ch = L.newChar("길손", "warrior", []);
  L.addPlayer(S, "pid-lazy", ch);
  const p = S.players["pid-lazy"];
  // walk through the town's east gate
  const gate = maps.town.portals.find((pt) => pt.to === "meadow");
  p.x = gate.x * 16 + 8; p.y = gate.y * 16 + 9; p.mvAt = 0; S.now = 10000;
  const a = { t: "mv", x: p.x, y: p.y + 1, d: 0 };
  assert.ok(L.validateAction(S, "pid-lazy", a).ok);
  L.applyAction(S, "pid-lazy", a);
  assert.equal(p.map, "meadow", "the gate leads into the meadow");
  assert.deepEqual([Math.floor(p.x / 16), Math.floor(p.y / 16)], maps.meadow.gates.west.a[maps.town.portals.filter((pt) => pt.to === "meadow").indexOf(gate)], "beside its west gate");
  assert.deepEqual(Object.keys(S.maps), ["town", "meadow"], "the meadow woke when someone walked in");
  assert.equal(S.maps.meadow.n, 1);
  L.tick(S, 10100);
  const v = L.viewFor(S, "pid-lazy");
  assert.equal(v.map.id, "meadow");
  // an instance: a runtime map under an id the registry does not have (Phase 2's dimension rifts)
  const src = (await import("node:fs")).readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
    "\nexport const __reg = { registerDim, closeDim, mapOfS, liveMapIds, changeMap, runtime };\n";
  const X = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
  const W = X.setup();
  X.addPlayer(W, "pid-dim", X.newChar("차원객", "mage", []));
  const q = W.players["pid-dim"];
  const inst = X.atlas(true, ["crypt"]).maps.crypt;
  const dim = X.__reg.registerDim(W, { id: "dim:1", map: inst, party: 0, seed: 7, lv: 15, theme: "crypt", expire: 900000 });
  assert.ok(dim && W.dims["dim:1"] === dim && W.maps["dim:1"] === dim.rt, "an instance is registered with its live state");
  assert.ok(dim.rt.mobs.length > 0, "and its monsters");
  assert.equal(X.__reg.mapOfS(W, "dim:1"), inst);
  assert.deepEqual(X.__reg.liveMapIds(W), ["town", "dim:1"]);
  assert.equal(X.__reg.registerDim(W, { id: "dim:1", map: inst }), null, "an id is taken once");
  assert.equal(X.__reg.registerDim(W, { id: "meadow", map: inst }), null, "never a world map's id");
  X.__reg.changeMap(W, q, "dim:1", inst.entry[0] * 16 + 8, inst.entry[1] * 16 + 10);
  X.tick(W, 5000);
  const vd = X.viewFor(W, "pid-dim");
  assert.equal(vd.map.id, "dim:1", "the instance's map goes out under its own id");
  assert.equal(X.exportChar(W, "pid-dim").map, "town", "a sheet is never saved inside an instance");
  X.__reg.closeDim(W, "dim:1");
  assert.equal(q.map, "town", "closing it sends whoever is inside to town");
  assert.ok(!W.maps["dim:1"] && !W.dims["dim:1"], "and leaves nothing behind");
  X.tick(W, 5100);
}

// ── quick: each map is built the first time someone walks in, while the room keeps ticking, so each must stay cheap
const ms = {};
for (const id of Object.keys(meta)) {
  const t = performance.now();
  L.atlas(true, [id]);
  ms[id] = performance.now() - t;
}
const eagerMs = eager.reduce((n, id) => n + ms[id], 0);
for (const id of HUNT) assert.ok(ms[id] < 150, `${id} is built in ${ms[id].toFixed(0)} ms`);
assert.ok(eagerMs < 100, `the maps built at load take ${eagerMs.toFixed(0)} ms`);
assert.ok(loadMs < 1000, `the rules load in ${loadMs.toFixed(0)} ms`);
console.log("maps ok — load " + loadMs.toFixed(0) + " ms (eager maps " + eagerMs.toFixed(0) + " ms), per map " + HUNT.map((id) => `${id} ${ms[id].toFixed(0)}`).join(", ") + " ms\n  " + report.join("\n  ") + "\n  " + zrep.join("\n  "));
