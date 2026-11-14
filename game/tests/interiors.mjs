// Headless test of the town's interiors (data/maps/tales_cafe, town_hall, starlight_inn; public/iso_interior.js):
// every house door in town leads in and back out, nobody arrives in a wall or on a door, the rooms are
// dioramas (back walls only behind, low cut walls in front), and the services inside work — the cafe and
// the inn sell their own goods and only theirs. node tests/interiors.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const ROOMS = ["tales_cafe", "town_hall", "starlight_inn"];
const WALLS = "=+^~@!";
const D = L.defs();
const S = L.setup();
let now = 1000;
S.now = now;
const PID = "pid-rooms01";
L.addPlayer(S, PID, L.newChar("문지기", "warrior", []));
const p = S.players[PID];
const view = () => { now += 100; S.now = now; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; };
const place = (id, x, y) => { S.maps[p.map].n--; p.map = id; S.maps[id].n++; p.x = x; p.y = y; p.mvAt = now; p.sendMap = true; p.hp = 1e9; };
const mapOf = (id) => { place(id, 0, 0); return view().map; };
const open = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.o[y][x] === " " && !"wW".includes(m.g[y][x]);
const flood = (m, sx, sy) => {
  const seen = new Uint8Array(m.w * m.h), q = [[sx, sy]];
  seen[sy * m.w + sx] = 1;
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!open(m, nx, ny) || seen[ny * m.w + nx]) continue;
      seen[ny * m.w + nx] = 1; q.push([nx, ny]);
    }
  }
  return seen;
};
/** Step onto a door tile and see where you come out. */
const walkThrough = (id, door) => {
  place(id, door.x * 16 + 8, door.y * 16 + 11);
  assert.ok(L.validateAction(S, PID, { t: "mv", x: p.x, y: p.y, d: 0 }).ok);
  L.applyAction(S, PID, { t: "mv", x: p.x, y: p.y, d: 0 });
  return { map: p.map, x: p.x, y: p.y };
};
/** No door within reach of where you arrive (or you would bounce straight back out). */
const clearOfDoors = (m, x, y) => m.portals.every((d) => Math.hypot(x - (d.x * 16 + 8), y - 3 - (d.y * 16 + 8)) >= 12);

const town = mapOf("town");
const reachTown = flood(town, 20, 18);
for (const id of ROOMS) {
  const m = mapOf(id);
  assert.equal(m.theme, "interior", `${id} is an interior`);
  assert.ok(m.safe, `${id} is a safe place`);
  assert.ok(["cafe", "hall", "inn"].includes(m.style), `${id} has a room style`);
  assert.equal(S.maps[id].mobs.length, 0, `${id}: no monsters indoors`);
  // a diorama: tall walls only along the back (north row, west column), the front cut down low
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.o[y][x];
    if (WALLS.includes(c)) assert.ok(y === 0 || x === 0, `${id}: a tall wall only at the back (${x},${y})`);
    if (y === m.h - 1 || x === m.w - 1) assert.ok(c === "_" || c === " " || (WALLS.includes(c) && (y === 0 || x === 0)), `${id}: the front edge is a low cut wall or a doorway (${x},${y})`);
  }
  // the doors in town lead here; you arrive on open floor, clear of the way out, and can walk to it
  const doors = town.portals.filter((d) => d.to === m.name);
  assert.ok(doors.length >= 1, `${id}: a door in town leads here`);
  assert.ok(doors.every((d) => d.door), `${id}: the town's door is drawn as a house door`);
  assert.ok(doors.every((d) => reachTown[d.y * town.w + d.x]), `${id}: its door can be walked to from the plaza`);
  const reachRoom = flood(m, m.portals[0].x, m.portals[0].y);
  for (const d of doors) {
    const at = walkThrough("town", d);
    assert.equal(at.map, id, `${id}: the door at (${d.x},${d.y}) goes in`);
    const tx = Math.floor(at.x / 16), ty = Math.floor(at.y / 16);
    assert.ok(open(m, tx, ty), `${id}: you arrive on open floor`);
    assert.ok(clearOfDoors(m, at.x, at.y), `${id}: you arrive clear of the way out`);
    assert.ok(reachRoom[ty * m.w + tx], `${id}: the way out can be walked to from where you arrive`);
  }
  // and back out: onto open ground in town, clear of the door, where the plaza can be reached
  assert.equal(m.portals.length, 1, `${id}: one way out`);
  const exit = m.portals[0];
  assert.ok(exit.door, `${id}: the way out is drawn as a door`);
  assert.equal(exit.y, m.h - 1, `${id}: the way out is in the front wall`);
  const out = walkThrough(id, exit);
  assert.equal(out.map, "town", `${id}: the way out leads to town`);
  const ox = Math.floor(out.x / 16), oy = Math.floor(out.y / 16);
  assert.ok(open(town, ox, oy) && reachTown[oy * town.w + ox], `${id}: you come out on open ground in town`);
  assert.ok(clearOfDoors(town, out.x, out.y), `${id}: you come out clear of the door`);
  assert.ok(Math.abs(ox - doors[0].x) <= 2 && oy === doors[0].y + 1, `${id}: you come out on the step of the door you went in by`);
  // everyone inside can be talked to, and the hearth can be sat by
  for (const n of m.npcs) {
    assert.ok(open(m, n.x, n.y), `${id}: ${n.name} stands on open floor`);
    assert.ok([[0, 1], [1, 0], [0, -1], [-1, 0], [0, 0]].some(([dx, dy]) => reachRoom[(n.y + dy) * m.w + n.x + dx]), `${id}: ${n.name} can be walked up to`);
  }
  const fires = S.maps[id].fires;
  assert.ok(fires.length >= 1, `${id}: a fire burns in the hearth`);
  for (const f of fires) assert.ok(reachRoom[Math.floor(f.y / 16) * m.w + Math.floor(f.x / 16)], `${id}: the hearth can be reached`);
}

// ── the cafe and the inn sell their own goods, and only theirs
const buyAt = (id, npcId, item) => {
  const m = mapOf(id), n = m.npcs.find((o) => o.id === npcId);
  place(id, n.x * 16 + 8, (n.y + 2) * 16 + 8);
  return L.validateAction(S, PID, { t: "buy", id: item, n: 1 });
};
p.ch.gold = 10000;
const cafe = mapOf("tales_cafe").npcs.find((n) => n.id === "cafe_moka");
assert.ok(cafe.role === "shop" && cafe.goods.includes("cafe_cocoa"), "the cafe owner keeps a menu");
for (const id of cafe.goods) assert.ok(D.items[id] && D.items[id].type === "food", `the cafe sells food and drink: ${id}`);
assert.ok(buyAt("tales_cafe", "cafe_moka", "cafe_cocoa").ok, "a cocoa can be bought at the cafe");
const gold = p.ch.gold;
L.applyAction(S, PID, { t: "buy", id: "cafe_cocoa", n: 1 });
assert.equal(p.ch.gold, gold - D.items.cafe_cocoa.price, "and costs its price");
assert.ok(p.ch.inv.some((s) => s && s.id === "cafe_cocoa"), "and lands in the bag");
assert.ok(!buyAt("tales_cafe", "cafe_moka", "hp_s").ok, "the cafe does not sell potions");
assert.ok(!buyAt("town", "shop", "cafe_cocoa").ok, "the supply shop does not sell the cafe's cocoa");
assert.ok(buyAt("town", "shop", "hp_s").ok, "the supply shop still sells its potions");
assert.ok(buyAt("starlight_inn", "inn_maru", "inn_stew").ok, "the inn sells its stew");
assert.ok(buyAt("starlight_inn", "inn_maru", "hp_s").ok, "and a few potions");
assert.ok(!buyAt("starlight_inn", "inn_maru", "cafe_pie").ok, "but not the cafe's pie");
// a drink is a small timed blessing
place("tales_cafe", 10 * 16 + 8, 12 * 16 + 8);
p.potAt = 0;
assert.ok(L.validateAction(S, PID, { t: "use", id: "cafe_cocoa" }).ok, "the cocoa can be drunk");
L.applyAction(S, PID, { t: "use", id: "cafe_cocoa" });
assert.ok(p.food && p.food.id === "cafe_cocoa" && p.food.xp > 0 && p.food.until > now, "and warms you for a while");

// ── the hall's people are the town's services, indoors
const hall = mapOf("town_hall");
for (const role of ["achieve", "collector", "daily"]) assert.ok(hall.npcs.some((n) => n.role === role), `the town hall has a ${role} desk`);
console.log("interiors: OK");
