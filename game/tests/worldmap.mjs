import assert from "node:assert/strict";
import { defs, setup, addPlayer, newChar, viewFor, runtime } from "../src/logic.js";
import { terrainTrail } from "../public/worldmap_land.js";
import { mapChart, buildingDoors, shortestRoute, nextGate, questMaps, wokeStones } from "../public/worldmap.js";

const D = defs(), chart = mapChart(D.maps);
assert.equal(chart.nodes.size, D.maps.length, "the routing graph includes interiors");
assert.deepEqual(chart.outdoor.map(({ d }) => d.id), D.maps.filter(m => m.kind !== "in").map(m => m.id));
assert.equal(new Set(chart.outdoor.map(({ x, y }) => `${x},${y}`)).size, chart.outdoor.length);
for (const m of D.maps) {
  const n = chart.nodes.get(m.id);
  if (m.kind !== "in") {
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
    assert.equal(chart.anchors.get(m.id), m.id);
  } else {
    assert.equal(n.x, undefined, "no world pin is assigned to an interior");
    assert.notEqual(chart.nodes.get(chart.anchors.get(m.id))?.d.kind, undefined);
    assert.notEqual(chart.nodes.get(chart.anchors.get(m.id)).d.kind, "in");
  }
  const path = shortestRoute(chart.graph, "town", m.id);
  assert.equal(path[0], "town", m.id);
  assert.equal(path.at(-1), m.id, m.id);
  for (const to of m.to) {
    const e = chart.edges.find(e => (e.a === m.id && e.b === to) || (e.b === m.id && e.a === to));
    assert.ok(e, `${m.id} ↔ ${to} has one physical connection`);
    if (e.oneWay) assert.equal(e.a, m.id);
  }
}
for (const { a, b } of chart.edges) {
  const A = chart.nodes.get(a), B = chart.nodes.get(b);
  if (A.d.kind === "in" || B.d.kind === "in") continue;
  const trail = terrainTrail(A, B);
  assert.deepEqual(trail[0], [A.x, A.y]);
  assert.deepEqual(trail.at(-1), [B.x, B.y]);
  assert.deepEqual(trail, terrainTrail(B, A).reverse(), "route highlight follows the same trail in reverse");
  assert.ok(trail.every(([x, y]) => x >= 0 && x <= chart.width && y >= 0 && y <= chart.height));
  assert.ok(trail.some(([x, y]) => Math.abs((B.x - A.x) * (y - A.y) - (B.y - A.y) * (x - A.x)) > 2));
}
assert.equal(chart.edges.length, new Set(D.maps.flatMap(m => m.to.map(to => JSON.stringify([m.id, to].sort())))).size);

const S = setup();
addPlayer(S, "test", newChar("길안내", "warrior", []));
const p = S.players.test;
for (const id of ["town", "willow", "meadow"]) {
  runtime(S, id);
  p.map = id; p.sendMap = true;
  const { map } = viewFor(S, "test");
  const buildings = buildingDoors(map, D.maps);
  const expected = D.maps.find(d => d.id === id).to.filter(to => chart.nodes.get(to)?.d.kind === "in");
  assert.deepEqual(buildings.map(b => b.id).sort(), expected.sort(), id);
  for (const b of buildings) assert.ok(b.tiles.every(([x, y]) => map.portals.some(q => q.door && q.x === x && q.y === y)), b.id);
}
const portalMaps = [
  { id: "village", kind: "town", to: ["hall"], doors: [[1, 2, "hall"]] },
  { id: "hall", kind: "in", name: "회관" },
];
assert.deepEqual(buildingDoors({ id: "village", safe: true, portals: [
  { x: 1, y: 2, to: "맞춤 표지", door: 1 },
  { x: 1, y: 3, to: "회관", door: 1 },
] }, portalMaps), [{ id: "hall", name: "회관", tiles: [[1, 2], [1, 3]] }]);

const extra = mapChart([
  { id: "hub", name: "마을", kind: "town", to: ["field", "other"] },
  { id: "field", name: "들판", kind: "field", to: ["deep"] },
  { id: "other", name: "숲", kind: "field", to: ["field"] },
  { id: "deep", name: "던전", kind: "dun", to: [] },
  { id: "future", name: "새 지역", kind: "field", to: ["other"] },
]);
assert.deepEqual(shortestRoute(extra.graph, "hub", "deep"), ["hub", "field", "deep"]);
assert.deepEqual(shortestRoute(extra.graph, "deep", "hub"), []);
assert.deepEqual(shortestRoute(extra.graph, "hub", "deep", id => id !== "field"), []);
assert.deepEqual(shortestRoute(extra.graph, "future", "deep"), ["future", "other", "field", "deep"]);
const n = extra.nodes.get("future");
assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));

const meadow = chart.nodes.get("meadow").d, gate = { x: 2, y: 1, to: `${meadow.name} Lv.${meadow.band.join("–")}` };
const custom = { x: 9, y: 9, to: "맞춤 출입구", mapIds: [meadow.id] };
assert.equal(nextGate([gate, custom], meadow, 1, 1), gate);
assert.equal(nextGate([gate, custom], meadow, 8, 8), custom);
for (const d of D.maps.filter(m => m.minLv)) {
  const gated = { x: 1, y: 1, to: d.gateLabel };
  assert.equal(nextGate([gated], d, 0, 0), gated);
  assert.match(d.gateLabel, /전용/);
}
assert.deepEqual(wokeStones({ id: "test", wpn: 3 }, { wp: { test: 5 } }, (s, id, i) => s.wp[id] & (1 << i)), [0, 2]);

const side = D.side.find(q => q.goal.type === "talk");
const self = { q: { i: 0, st: 1, n: 0 }, sq: [[side.id, 2]] };
const quests = questMaps(D, self, chart.nodes);
assert.ok(quests.get("meadow").includes(D.quests[0].title));
assert.ok(quests.get(side.targetMap).includes(side.title));
self.q.n = D.quests[0].n;
self.sq[0][1] = 3;
const complete = questMaps(D, self, chart.nodes);
assert.ok(complete.get(D.questTurnIn.map).includes(D.quests[0].title));
assert.ok(complete.get(side.giverMapId).includes(side.title));
console.log(`World chart: ${chart.nodes.size} regions, ${chart.edges.length} physical trails, all reachable from town.`);
