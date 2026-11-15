import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const approach = "maple", endgame = "frostkeep", T = 16;
const locked = "레벨 200부터 입장할 수 있습니다.";
const { maps, waypoints } = L.atlas();
const worldDefs = L.defs();
assert.equal(worldDefs.maps.find((m) => m.id === endgame).minLv, 200);
assert.equal(worldDefs.waypoints.find((w) => w.id === endgame).minLv, 200);
const gate = maps[approach].portals.find((p) => p.to === endgame);
const exit = maps[endgame].portals.find((p) => p.to === approach);
assert.ok(gate && exit, "the approach and endgame gates are linked both ways");

const S = L.setup();
S.now = 5000;
const foot = (t) => [t.x * T + 8, t.y * T + 11];
function add(pid, level, map, tile) {
  const ch = L.hero(level === 200 ? "설원수호" : "설원도전자", { lvl: level });
  assert.equal(ch.lvl, level);
  ch.map = map;
  [ch.x, ch.y] = foot(tile);
  L.addPlayer(S, pid, ch);
  return S.players[pid];
}
function act(pid, action) {
  const result = L.validateAction(S, pid, action);
  if (result.ok) L.applyAction(S, pid, action);
  return result;
}
const stepGate = (p, gateTile) => {
  [p.x, p.y] = foot(gateTile);
  assert.ok(act(p.pid, { t: "mv", x: p.x, y: p.y, d: 0 }).ok);
};

const novice = add("under", 199, approach, gate);
const veteran = add("eligible", 200, approach, gate);
assert.ok(act(veteran.pid, { t: "pinv", e: novice.eid }).ok);
assert.ok(act(novice.pid, { t: "pacc" }).ok);
stepGate(novice, gate);
assert.equal(novice.map, approach, "a max-level party leader cannot admit a lower-level member");
assert.ok(novice.toast.includes(locked));
const hints = novice.toast.length;
stepGate(novice, gate);
assert.equal(novice.toast.length, hints, "a movement update on the same closed gate does not spam");
stepGate(veteran, gate);
assert.equal(veteran.map, endgame);
const { map: entered } = L.viewFor(S, veteran.pid);
assert.equal(entered.id, endgame);
stepGate(veteran, exit);
assert.equal(veteran.map, approach, "leaving the endgame map requires no extra action");

// The saved coordinates and unlocked waypoint bits cannot bypass the level check after a reset.
const stone = maps[endgame].stones?.[0] || waypoints[endgame];
const stoneLanding = { x: stone.ax, y: stone.ay };
const invalidSave = add("saved-under", 199, endgame, stoneLanding);
assert.equal(invalidSave.map, "town");
assert.equal(L.exportChar(S, invalidSave.pid).map, "town");
assert.ok(!L.devPlace(invalidSave.ch, endgame, stone.x, stone.y));
const validSave = add("saved-eligible", 200, endgame, stoneLanding);
assert.equal(validSave.map, endgame);
assert.equal(L.exportChar(S, validSave.pid).map, endgame);
assert.ok(L.devPlace(L.hero("설원연습", { lvl: 200 }), endgame, stone.x, stone.y));

const townStone = { x: waypoints.town.ax, y: waypoints.town.ay };
const returning = add("returning", 200, "town", townStone);
const reset = add("reset", 200, "town", townStone);
for (const p of [returning, reset]) p.ch.wp[endgame] = 1;
const trainer = maps.town.npcs.find((n) => n.role === "train");
[reset.x, reset.y] = foot(trainer);
reset.ch.gold = 85220;
reset.ch.inv.push({ id: "stat_seal", n: 1 });
assert.ok(act(reset.pid, { t: "respec" }).ok);
[reset.x, reset.y] = foot(townStone);
assert.equal(reset.ch.lvl, 1);
assert.equal(L.validateAction(S, reset.pid, { t: "warp", to: endgame }).error, locked);
L.applyAction(S, reset.pid, { t: "warp", to: endgame });
assert.equal(reset.map, "town");
assert.equal(reset.ch.wp[endgame], 1, "reset disables travel without forgetting the stone");
assert.deepEqual(act(returning.pid, { t: "warp", to: endgame }), { ok: true });
assert.equal(returning.map, endgame);

returning.ch.inv.push({ id: "recall", n: 1 });
assert.ok(act(returning.pid, { t: "use", id: "recall" }).ok);
L.tick(S, S.now + worldDefs.recallMs + 1);
assert.equal(returning.map, "town", "a return scroll still leaves the endgame map");
console.log("endgame access: portal, party, save/load, waypoint, stat reset, recall");
