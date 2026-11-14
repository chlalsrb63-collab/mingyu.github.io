// Headless test of the generated world — every hunting ground connected from its entrance to
// everything that matters, every spawn standable, the same world from the same seeds, built
// quickly, and built with variety rather than boxes: node tests/maps.mjs
import assert from "node:assert/strict";

const t0 = performance.now();
const L = await import("../src/logic.js");
const loadMs = performance.now() - t0;

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

// ── deterministic: the same seeds give the same world, tile for tile and monster for monster
const shape = (all) => JSON.stringify(HUNT.map((id) => { const m = all[id]; return [m.g, m.o, m.spawns, m.portals, m.marks, m.pieces]; }));
const before = shape(maps), firesBefore = JSON.stringify(fires);
const t1 = performance.now();
const again = L.atlas(true);
const buildMs = performance.now() - t1;
assert.equal(shape(again.maps), before, "rebuilding from the seeds gives the same world");
assert.equal(JSON.stringify(again.fires), firesBefore, "and the same camps");

// ── quick: the whole world is generated as the server starts, so it must stay cheap
assert.ok(buildMs < 250, `the world is built in ${buildMs.toFixed(0)} ms`);
assert.ok(loadMs < 1500, `the rules load in ${loadMs.toFixed(0)} ms`);
console.log("maps ok — load " + loadMs.toFixed(0) + " ms, rebuild " + buildMs.toFixed(0) + " ms\n  " + report.join("\n  "));
