// Headless test of 버드나무광장, the forest refuge (docs/design/town.md): its size, entry and gates, the
// frozen building footprints and their doors, everyone's place and that every one of them (and every
// door, landing, stone, the rift's landing and every resident's anchor) can be walked to from the
// entry, the walking distances between the services, the signposts and their labels, the two fires,
// old sheets saved in the old layout, and the build time.
// node tests/town.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";
import { RESIDENTS, placeAt, load as tfLoad, open as tfOpen } from "../public/townfolk.js";

const T = 16;
const m = L.atlas().maps.town;
const W = m.w, idx = (x, y) => y * W + x;
assert.equal(W, 100); assert.equal(m.h, 76);
assert.deepEqual(m.entry, [50, 43]);
assert.ok(m.reach[idx(50, 43)], "the entry is open ground");
assert.equal(L.newChar("마을", [], []).map, "town");
{ const c = L.newChar("마을", [], []); assert.deepEqual([Math.floor(c.x / T), Math.floor(c.y / T)], m.entry, "a new hero starts at the entry"); }

// ── build time: hand placement and hashed scatter only (budget 20 ms, bound 60)
{
  const ms = [];
  for (let i = 0; i < 5; i++) { const t0 = performance.now(); L.atlas(true, ["town"]); ms.push(performance.now() - t0); }
  ms.sort((a, b) => a - b);
  assert.ok(ms[2] < 60, "the town builds in under 60 ms: " + ms[2].toFixed(1));
  if (process.argv.includes("-v")) console.log("town build ms (median of 5):", ms[2].toFixed(1));
}

// ── the buildings (town.md D, frozen): footprints solid, doors where the doc puts them
const BLD = {
  hall: [46, 20, 8, 5, "s", [[49, 25], [50, 25]]], library: [33, 16, 7, 5, "s", [[36, 21], [37, 21]]], dojo: [60, 16, 6, 4, "s", [[62, 20], [63, 20]]],
  store: [63, 33, 5, 4, "s", [[65, 37], [66, 37]]], smithy: [70, 33, 6, 4, "s", [[72, 37], [73, 37]]], merc: [83, 32, 6, 4, "s", [[85, 36], [86, 36]]],
  lab: [78, 25, 5, 3, "s", [[80, 28], [81, 28]]], diner: [70, 45, 6, 4, "s", [[72, 49], [73, 49]]], cafe: [78, 46, 5, 3, "s", [[79, 49], [80, 49]]],
  inn: [61, 50, 6, 4, "e", [[67, 51], [67, 52]]], boutique: [40, 50, 5, 3, "e", [[45, 51], [45, 52]]], pet: [28, 44, 4, 3, "s", [[29, 47], [30, 47]]],
  apt: [8, 30, 5, 4, "s", [[10, 34], [11, 34]]], home: [14, 43, 4, 3, "s", [[15, 46], [16, 46]]], barn: [30, 33, 5, 4, "", []],
};
const blds = m.big.filter((b) => b.t === "bld");
assert.deepEqual(blds.map((b) => b.k).sort(), Object.keys(BLD).sort(), "every named building stands");
for (const b of blds) {
  const [x, y, w, h, door, doors] = BLD[b.k];
  assert.deepEqual([b.x, b.y, b.w, b.h, b.door], [x, y, w, h, door], b.k + ": footprint as frozen");
  assert.ok(b.name && b.icon, b.k + ": a sign with a name and an icon");
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) assert.equal(m.o[j][i], "h", `${b.k}: footprint solid at ${i},${j}`);
  for (const [dx, dy] of doors) {
    assert.ok(door === "s" ? dy === y + h && dx >= x && dx < x + w : dx === x + w && dy >= y && dy < y + h, `${b.k}: door ${dx},${dy} on its ${door} face`);
    assert.ok(m.reach[idx(dx, dy)], `${b.k}: door ${dx},${dy} can be walked to`);
  }
}
assert.ok(m.big.length <= 80, "big pieces within budget: " + m.big.length);
for (const b of m.big) if (b.t === "prop") for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) assert.equal(m.o[j][i], "a", `${b.k} prop footprint at ${i},${j}`);

// ── the walk graph from the entry
const dist = (sx, sy) => {
  const d = new Int32Array(W * m.h).fill(-1), q = [idx(sx, sy)];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= m.h || !m.reach[idx(nx, ny)] || d[idx(nx, ny)] >= 0) continue;
      d[idx(nx, ny)] = d[i] + 1; q.push(idx(nx, ny));
    }
  }
  return d;
};
/** Steps to stand on (x, y), or beside it when it is solid (a person, a stone). */
const near = (d, x, y) => { let b = -1; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = d[idx(x + dx, y + dy)]; if (v >= 0 && (b < 0 || v < b)) b = v; } return b; };
const fromEntry = dist(...m.entry);
const must = [
  ...m.gates.east.t, ...m.gates.west.t, ...m.gates.east.a, ...m.gates.west.a,
  ...m.portals.filter((p) => p.to === "willow").map((p) => [p.x, p.y]),
];
for (const [x, y] of must) assert.ok(fromEntry[idx(x, y)] >= 0, `reachable: ${x},${y}`);
assert.ok(m.portals.filter((p) => p.to === "willow").length === 2, "two door tiles to 버드나무 마을");
const D = L.defs();
for (const [x, y] of D.house.door) assert.ok(fromEntry[idx(x, y)] >= 0, "내 집 door reachable");
const wp = L.atlas().waypoints.town;
assert.deepEqual([wp.x, wp.y, wp.ax, wp.ay], [46, 43, 47, 43]);
assert.equal(m.o[43][46], "Q");
assert.ok(fromEntry[idx(wp.ax, wp.ay)] >= 0, "the stone's arrival tile");
const ob = m.big.find((b) => b.t === "obelisk");
assert.deepEqual([ob.x, ob.y], [58, 34], "the rift obelisk");
assert.ok(fromEntry[idx(56, 34)] >= 0, "the rift's landing");

// ── everyone's place (town.md D.1) and that they can be walked up to
const NPC = { elder: [52, 37, "elder"], warp: [45, 44, "warp"], daily: [44, 36, "daily"], shop: [61, 39, "shop"], dimkeeper: [57, 35, "dim"], smith: [77, 37, "smith"],
  train: [68, 23, "train"], town_job_arsen: [70, 23, "job"], bank: [32, 38, "bank"], collector: [34, 23, "collector"], achieve: [39, 23, "achieve"],
  costume: [47, 53, "costume"], housing: [18, 47, "house"], guard: [94, 38, "talk"], story: [56, 46, "talk"], town_willow_guide: [52, 70, "talk"] };
for (const [id, [x, y, role]] of Object.entries(NPC)) {
  const n = m.npcs.find((o) => o.id === id);
  assert.ok(n, id + " lives in town");
  assert.deepEqual([n.x, n.y, n.role], [x, y, role], id + " stands where the doc puts them");
  assert.ok(near(fromEntry, x, y) >= 0, id + " can be walked up to");
}
assert.ok(m.npcs.find((n) => n.id === "story").night, "the storyteller comes out at night");

// ── how far apart things are, in steps (3 tiles a second)
const fromStone = dist(wp.ax, wp.ay);
for (const p of m.portals) if (p.to !== "meadow" && p.to !== "city") assert.ok(fromStone[idx(p.x, p.y)] <= 60, `stone → door to ${p.to}: ${fromStone[idx(p.x, p.y)]} ≤ 60`);
for (const b of blds) for (const [dx, dy] of BLD[b.k][5]) assert.ok(fromStone[idx(dx, dy)] <= 60, `stone → ${b.k} door: ${fromStone[idx(dx, dy)]}`);
const key = ["elder", "shop", "bank", "smith", "warp", "daily", "dimkeeper"].map((id) => m.npcs.find((n) => n.id === id));
for (const a of key) {
  const d = dist(...[[a.x, a.y + 1], [a.x + 1, a.y], [a.x - 1, a.y], [a.x, a.y - 1]].find(([x, y]) => m.reach[idx(x, y)]));
  for (const b of key) if (b !== a) assert.ok(near(d, b.x, b.y) <= 75, `${a.id} ↔ ${b.id}: ${near(d, b.x, b.y)} ≤ 75`);
}

// ── signposts: every one names where it leads; the gates' carry the level shown on the door
const S = L.setup();
L.addPlayer(S, "t-1", L.newChar("길손", [], []));
L.tick(S, 1000);
const pay = L.viewFor(S, "t-1").map;
L.endTick(S);
const signs = pay.marks.filter((k) => k.kind === "sign");
assert.ok(signs.length >= 11, "the signposts stand");
for (const k of signs) { assert.ok(k.label && k.to, "a sign names where it leads"); assert.equal(m.o[k.y][k.x], "G"); }
const doorTo = (gate) => pay.portals.find((p) => p.x === m.gates[gate].t[0][0] && p.y === m.gates[gate].t[0][1]).to;
assert.equal(signs.find((k) => k.to === "meadow").label, `${doorTo("east")} →`, "the meadow sign shows the door's levels");
assert.equal(signs.find((k) => k.to === "city").label, `← ${doorTo("west")}`, "the city sign shows the door's levels");
assert.match(doorTo("east"), /^바람초원 Lv\.\d+–\d+$/);

// ── the fires: the plaza's with its four stumps, the pond clearing's
const camps = L.skyAt("town", 1000).camps;
assert.equal(camps.length, 2, "two fires in town");
assert.deepEqual([Math.floor(camps[0].x / T), Math.floor(camps[0].y / T)], [58, 46], "the plaza fire");
assert.equal(camps[0].seats.length, 4, "four stumps round the plaza fire");
assert.deepEqual([Math.floor(camps[1].x / T), Math.floor(camps[1].y / T)], [29, 60], "the pond clearing's fire");

// ── old sheets: saved in the old 40 × 30 town they wake at the entry; a current one keeps its place
{
  const W2 = L.setup();
  for (const v of [9, 10, 11]) {
    const old = L.newChar("옛사람" + v, [], []);
    delete old.tw; old.v = v; old.map = "town"; old.x = 20 * T + 8; old.y = 18 * T + 10;
    L.addPlayer(W2, "o-" + v, old);
    const p = W2.players["o-" + v];
    assert.deepEqual([Math.floor(p.x / T), Math.floor(p.y / T)], m.entry, `a v${v} sheet saved in the old town wakes at the entry`);
    assert.equal(L.exportChar(W2, "o-" + v).tw, 2, "and is marked with the new layout");
  }
  const now = L.newChar("새사람", [], []);
  now.x = 70 * T + 8; now.y = 52 * T + 10;
  L.addPlayer(W2, "n-1", now);
  assert.deepEqual([Math.floor(W2.players["n-1"].x / T), Math.floor(W2.players["n-1"].y / T)], [70, 52], "a sheet of this layout keeps its place");
  const cafe = L.newChar("손님", [], []);
  delete cafe.tw; cafe.map = "tales_cafe"; cafe.x = 6 * T + 8; cafe.y = 8 * T + 10;
  L.addPlayer(W2, "c-1", cafe);
  assert.equal(W2.players["c-1"].map, "tales_cafe", "a sheet saved in the cafe stays there");
}

// ── the residents (public/townfolk.js): every anchor and every round can be walked to; all day long they stand on open ground
tfLoad(m);
const reachable = (x, y) => tfOpen(m, x, y) && fromEntry[idx(x, y)] >= 0;
assert.ok(RESIDENTS.length >= 14 && RESIDENTS.length <= 16, "fourteen to sixteen residents");
for (const r of RESIDENTS) {
  assert.equal(r.a.length, 5, r.id + ": an anchor per phase");
  assert.match(r.line, /[가-힣]/, r.id + " speaks Korean");
  for (const a of r.a) {
    if (!a) continue;
    for (const [x, y] of Array.isArray(a) ? [a] : a.loop) assert.ok(reachable(x, y), `${r.id}: anchor ${x},${y} reachable`);
  }
  for (let h = 0; h < 24; h += 0.05) {
    const at = placeAt(r, h);
    if (!at) continue;
    const tx = Math.floor(at.x / T), ty = Math.floor(at.y / T);
    assert.ok(reachable(tx, ty), `${r.id} at ${h.toFixed(2)} h stands on open ground (${tx},${ty})`);
  }
}
console.log("town ok — 100×76, " + blds.length + " buildings, " + m.npcs.length + " people, " + RESIDENTS.length + " residents, " + m.big.length + " big pieces");
