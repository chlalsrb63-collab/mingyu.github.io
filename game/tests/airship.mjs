import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapChart, questMaps, shortestRoute, wokeStones } from "../public/worldmap.js";

const source = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8");
const L = await import("data:text/javascript;base64," + Buffer.from(source + "\nexport const hitForTest = dealMob;").toString("base64"));
const rescueId = "sq_airship_rescue", tabletId = "sq_lunelsha_tablet";
const D = L.defs(), chart = mapChart(D.maps), ship = chart.nodes.get("airship").d;
const { maps, waypoints } = L.atlas(false, ["town", "oasis", "airship", "frostkeep"]);
const signal = maps.oasis.npcs.find((npc) => npc.id === "airship_signal");
const gate = maps.oasis.portals.find((portal) => portal.to === "airship");
const exit = maps.airship.portals.find((portal) => portal.to === "oasis");
const tablet = maps.frostkeep.npcs.find((npc) => npc.id === "lunelsha_tablet");
const stone = { x: waypoints.town.ax, y: waypoints.town.ay };
const deckStone = { x: waypoints.airship.ax, y: waypoints.airship.ay };
const rescue = D.side.find((q) => q.id === rescueId), ending = D.side.find((q) => q.id === tabletId);
const S = L.setup();
S.now = 300000;

function place(player, tile) {
  player.x = tile.x * 16 + 8;
  player.y = tile.y * 16 + 11;
}
function add(pid, level, map, tile, prepare = () => {}) {
  const ch = L.hero(pid, { lvl: level });
  ch.map = map;
  place(ch, tile);
  prepare(ch);
  L.addPlayer(S, pid, ch);
  return S.players[pid];
}
function action(p, a) {
  const verdict = L.validateAction(S, p.pid, a);
  if (verdict.ok) L.applyAction(S, p.pid, a);
  return verdict.ok;
}
function step(p, tile) {
  place(p, tile);
  assert.ok(action(p, { t: "mv", x: p.x, y: p.y, d: 0 }));
}
const accept = (p, id) => action(p, { t: "sq", a: "take", id });
const complete = (p, id) => action(p, { t: "sq", a: "done", id });
const state = (p, id) => L.viewFor(S, p.pid).self.sq.find((row) => row[0] === id)[1];

assert.equal(D.worldName, "루넬샤대륙");
assert.match(D.quests[0].text, /작은꼬리들\(Tinytales\)/);
assert.deepEqual({ safe: ship.safe, kind: ship.kind, level: ship.minLv, art: ship.art, quest: ship.unlockQuest },
  { safe: true, kind: "town", level: 100, art: "airship", quest: rescueId });
assert.deepEqual(shortestRoute(chart.graph, "oasis", "airship"), ["oasis", "airship"]);
assert.equal(maps.airship.spawns.length, 0);
const armorer = maps.airship.npcs.find((npc) => npc.role === "shop");
const stock = armorer.goods.filter((id) => D.items[id].type === "weapon");
assert.equal(stock.length, 14);
assert.deepEqual([...new Set(stock.map((id) => D.items[id].req))], [101, 149]);
for (const id of stock) {
  const model = D.items[id.replace("w_ship_", "w_")];
  assert.ok(D.items[id].base.atk < model.base.atk, "crafted and dropped weapons keep the stronger stats");
}
assert.equal(rescue.mainChapter, true);
assert.equal(rescue.req.lv, 100);
assert.equal(questMaps(D, { sq: [[rescueId, 2]] }, chart.nodes).get("airship")[0], rescue.title);

const novice = add("수습정찰", 99, "oasis", signal);
assert.ok(!accept(novice, rescueId));
step(novice, gate);
assert.equal(novice.map, "oasis");
const scout = add("구조정찰", 100, "oasis", signal);
step(scout, gate);
assert.equal(scout.map, "oasis");
place(scout, signal);
assert.ok(accept(scout, rescueId));
assert.ok(!complete(scout, rescueId));
step(scout, gate);
const run = S.dims[scout.map], rt = run.rt;
assert.equal(run.map.npcs.length, 0);
assert.equal(run.map.safe, false);
assert.deepEqual(L.viewFor(S, scout.pid).sty.slice(1), [0, "airship_lookout", 4]);

const peer = add("예비정찰", 100, "oasis", signal);
assert.ok(accept(peer, rescueId));
step(peer, gate);
assert.notEqual(peer.map, scout.map);
const retry = peer.map;
assert.ok(action(peer, { t: "dim_leave" }));
assert.equal(peer.map, "oasis");
assert.ok(!S.dims[retry]);
step(peer, gate);
const incomplete = L.exportChar(S, peer.pid);
assert.equal(incomplete.map, "oasis");
assert.equal(incomplete.sq.on[rescueId], 0);
L.removePlayer(S, peer.pid);

const gold = scout.ch.gold, xp = scout.ch.xp;
const flock = rt.mobs.filter((mob) => mob.k === "airship_gale");
assert.equal(flock.length, 4);
for (const mob of flock) assert.ok(L.hitForTest(S, rt, mob, scout, mob.hp + 1, 0));
assert.equal(scout.ch.gold, gold);
assert.equal(scout.ch.xp, xp);
const leader = rt.mobs.find((mob) => mob.k === "airship_lookout");
assert.ok(leader);
assert.ok(L.hitForTest(S, rt, leader, scout, leader.hp + 1, 0));
assert.equal(scout.ch.sq.done[rescueId], 1);
assert.equal(scout.ch.gold, gold + rescue.reward.gold);
assert.ok(scout.ch.xp > xp);
assert.equal(L.exportChar(S, scout.pid).map, "airship");
L.tick(S, S.now + 3300);
assert.equal(scout.map, "airship");
assert.ok(!S.dims[run.id]);
step(scout, exit);
assert.equal(scout.map, "oasis");
step(scout, gate);
assert.equal(scout.map, "airship");
step(scout, deckStone);
L.tick(S, S.now + 1001);
assert.ok(scout.ch.wp.airship & 1, "walking by the safe deck stone awakens it");

const forged = add("무단승선", 100, "airship", deckStone, (ch) => { ch.wp.airship = 1; });
assert.equal(forged.map, "town", "pre-clear sheet coordinates cannot load the deck");
place(forged, stone);
assert.ok(!action(forged, { t: "warp", to: "airship" }));
assert.equal(forged.map, "town");
assert.deepEqual(wokeStones(ship, { sq: [[rescueId, 2]] }, () => true), []);
assert.deepEqual(wokeStones(ship, { sq: [[rescueId, 4]] }, () => true), [0]);
const veteran = add("귀환정찰", 100, "town", stone, (ch) => {
  ch.wp.airship = scout.ch.wp.airship;
  ch.sq.done[rescueId] = scout.ch.sq.done[rescueId];
});
assert.ok(action(veteran, { t: "warp", to: "airship" }));

assert.ok(ending.mainChapter && ending.req.main);
assert.equal(ending.req.lv, 200);
assert.match(ending.done, /변이 흑마법/);
assert.doesNotMatch(ending.text, /변이 흑마법/);
const tabletApproach = { x: tablet.x, y: tablet.y + 1 };
const reader = add("비석기록", 200, "frostkeep", tabletApproach, (ch) => { ch.q.i = D.quests.findIndex((q) => q.mob === "crownstag"); });   // the frost king still standing: the epilogue after him does not gate the tablet
assert.equal(state(reader, tabletId), 0);
assert.ok(!accept(reader, tabletId));
reader.ch.q.i++;
assert.ok(accept(reader, tabletId));
assert.equal(state(reader, tabletId), 3);
assert.ok(complete(reader, tabletId));
assert.equal(state(reader, tabletId), 4);
assert.ok(!complete(reader, tabletId));

console.log("Airship rescue, pre/post-clear access, world quest pins, and Lunelsha epilogue gating.");
