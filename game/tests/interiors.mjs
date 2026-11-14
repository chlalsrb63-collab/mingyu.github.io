// Headless test of the town's interiors (data/maps/<room>.json, docs/design/town.md D/F; art in
// public/iso_interior.js): every building door in town leads into its room and back out onto its step,
// nobody arrives in a wall or on a door, the rooms are dioramas (back walls only behind, low cut walls in
// front), everyone and every interactive object inside can be walked up to, the shopkeepers sell only their
// own (buyable) goods, and the services inside work — the cafe and the inn sell their own goods and only
// theirs. node tests/interiors.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as L from "../src/logic.js";

/** The frozen contract (docs/design/town.md D): size, style, the town's door tiles and the landing outside. */
const ROOMS = {
  town_hall: { w: 22, h: 18, style: "hall", doors: [[49, 25], [50, 25]], out: [49, 26] },
  owl_library: { w: 22, h: 16, style: "library", doors: [[36, 21], [37, 21]], out: [36, 22] },
  dojo: { w: 18, h: 14, style: "dojo", doors: [[62, 20], [63, 20]], out: [62, 21] },
  general_store: { w: 16, h: 12, style: "shop", doors: [[65, 37], [66, 37]], out: [65, 38] },
  kangkang_forge: { w: 18, h: 12, style: "forge", doors: [[72, 37], [73, 37]], out: [72, 38] },
  merc_office: { w: 20, h: 14, style: "office", doors: [[85, 36], [86, 36]], out: [85, 37] },
  bogle_lab: { w: 18, h: 12, style: "lab", doors: [[80, 28], [81, 28]], out: [80, 29] },
  juju_diner: { w: 20, h: 14, style: "tavern", doors: [[72, 49], [73, 49]], out: [72, 50] },
  tales_cafe: { w: 20, h: 16, style: "cafe", doors: [[79, 49], [80, 49]], out: [79, 50] },
  starlight_inn: { w: 20, h: 16, style: "inn", doors: [[67, 51], [67, 52]], out: [68, 51] },
  boutique: { w: 16, h: 12, style: "boutique", doors: [[45, 51], [45, 52]], out: [46, 51] },
  pet_house: { w: 14, h: 10, style: "inn", doors: [[29, 47], [30, 47]], out: [29, 48] },
  dongdong_apt: { w: 14, h: 10, style: "lobby", doors: [[10, 34], [11, 34]], out: [10, 35] },
};
/** Interactive objects the doc asks for, by room (id → role). */
const THINGS = {
  owl_library: { lib_case: "collector", lib_tablet: "achieve", lib_book_1: "talk", lib_book_2: "talk", lib_book_3: "talk" },
  merc_office: { merc_board: "daily", merc_party: "talk" },
  kangkang_forge: { forge_anvil: "smith" },
  boutique: { bout_mirror: "costume" },
  dojo: { dojo_scroll: "job" },
  dongdong_apt: { apt_mail: "talk" },
  town_hall: { hall_map: "talk" },
};
const WALLS = "=+^~@!", LIGHTS = "*o#<:+";
const D = L.defs();
const S = L.setup();
let now = 1000;
S.now = now;
const PID = "pid-rooms01";
L.addPlayer(S, PID, L.newChar("문지기", "warrior", []));
const p = S.players[PID];
/** Where a new character starts: the town's entry (the map payload does not carry it). */
const START = [Math.floor(p.x / 16), Math.floor(p.y / 16)];
const view = () => { now += 100; S.now = now; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; };
const place = (id, x, y) => { L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.x = x; p.y = y; p.mvAt = now; p.sendMap = true; p.hp = 1e9; };
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
const SIDES = [[0, 1], [1, 0], [0, -1], [-1, 0]];
/** Step onto a door tile and see where you come out. */
const walkThrough = (id, door) => {
  place(id, door.x * 16 + 8, door.y * 16 + 11);
  assert.ok(L.validateAction(S, PID, { t: "mv", x: p.x, y: p.y, d: 0 }).ok);
  L.applyAction(S, PID, { t: "mv", x: p.x, y: p.y, d: 0 });
  return { map: p.map, x: p.x, y: p.y };
};
/** No door within reach of where you arrive (or you would bounce straight back out). */
const clearOfDoors = (m, x, y) => m.portals.every((d) => Math.hypot(x - (d.x * 16 + 8), y - 3 - (d.y * 16 + 8)) >= 12);
/** Within the server's reach of an NPC (70-validate npcNear) and the client's F prompt (client.js nearestNpc). */
const reaches = (n, tx, ty) => {
  const d = Math.hypot(tx * 16 + 8 - (n.x * 16 + 8), ty * 16 + 8 - (n.y * 16 + 12));
  return d < 56 && d - (n.goods ? 14 : 0) < 40;
};

const town = mapOf("town");
// The doors land on the redesigned town's tiles (docs/design/town.md B–D, 100 × 76).
assert.ok(town.w === 100 && town.h === 76, "the redesigned town is built");
const reachTown = flood(town, START[0], START[1]);
for (const [id, want] of Object.entries(ROOMS)) {
  const m = mapOf(id);
  assert.equal(m.theme, "interior", `${id} is an interior`);
  assert.ok(m.safe, `${id} is a safe place`);
  assert.equal(m.style, want.style, `${id} has its room style`);
  assert.deepEqual([m.w, m.h], [want.w, want.h], `${id} is ${want.w}×${want.h}`);
  assert.equal(L.runtime(S, id).mobs.length, 0, `${id}: no monsters indoors`);
  // a diorama: tall walls only along the back (north row, west column), the front cut down low
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.o[y][x];
    if (WALLS.includes(c)) assert.ok(y === 0 || x === 0, `${id}: a tall wall only at the back (${x},${y})`);
    if (y === m.h - 1 || x === m.w - 1) assert.ok(c === "_" || c === " " || (WALLS.includes(c) && (y === 0 || x === 0)), `${id}: the front edge is a low cut wall or a doorway (${x},${y})`);
  }
  assert.ok(m.o.some((r) => [...r].some((c) => LIGHTS.includes(c))), `${id}: something gives light (a lamp, a fire, a window)`);
  // one way out: a door mat in the front wall, the room's entry just inside it, out onto the building's landing
  const file = JSON.parse(readFileSync(new URL(`../data/maps/${id}.json`, import.meta.url), "utf8"));
  assert.deepEqual(file.portals.map((d) => [d.to, d.tx, d.ty]), [["town", ...want.out]], `${id}: the way out leads to its landing in town`);
  assert.equal(m.portals.length, 1, `${id}: one way out`);
  assert.ok(m.portals[0].door, `${id}: the way out is drawn as a door`);
  const exit = m.portals[0];
  assert.equal(exit.y, m.h - 1, `${id}: the way out is in the front wall`);
  assert.equal(m.g[exit.y][exit.x], "e", `${id}: a door mat at the way out`);
  const entry = [exit.x, m.h - 2];
  assert.ok(open(m, ...entry), `${id}: the tile just inside the door is open`);
  const reachRoom = flood(m, entry[0], entry[1]);
  assert.ok(reachRoom[exit.y * m.w + exit.x], `${id}: the way out can be walked to`);
  // everyone inside can be walked up to; an interactive object stands on its furniture with an open side
  for (const n of m.npcs) {
    if (n.thing) {
      assert.ok(m.o[n.y][n.x] !== "_", `${id}: ${n.name} is not on the front wall`);
      const side = SIDES.map(([dx, dy]) => [n.x + dx, n.y + dy]).find(([x, y]) => open(m, x, y) && reachRoom[y * m.w + x] && reaches(n, x, y));
      assert.ok(side, `${id}: ${n.name} (a thing) can be walked up to and used`);
    } else {
      assert.ok(open(m, n.x, n.y), `${id}: ${n.name} stands on open floor`);
      assert.ok(SIDES.concat([[0, 0]]).some(([dx, dy]) => reachRoom[(n.y + dy) * m.w + n.x + dx]), `${id}: ${n.name} can be walked up to`);
    }
    if (n.goods) {
      assert.equal(n.role, "shop", `${id}: only a shopkeeper keeps goods`);
      for (const g of n.goods) assert.ok(D.items[g] && D.items[g].price > 0, `${id}: ${n.name} sells only things that can be bought (${g})`);
    }
  }
  for (const [tid, role] of Object.entries(THINGS[id] || {})) {
    const n = m.npcs.find((o) => o.id === tid);
    assert.ok(n && n.thing && n.role === role, `${id}: ${tid} is an interactive object with role ${role}`);
  }
  for (const f of L.runtime(S, id).fires) assert.ok(reachRoom[Math.floor(f.y / 16) * m.w + Math.floor(f.x / 16)], `${id}: the hearth can be reached`);
  // the doors in town lead here; you arrive on open floor, clear of the way out, and can walk to it
  const doors = want.doors.map(([x, y]) => town.portals.find((d) => d.x === x && d.y === y));
  assert.ok(doors.every(Boolean), `${id}: its two door tiles in town are doors`);
  assert.ok(doors.every((d) => d.door), `${id}: the town's door is drawn as a house door`);
  assert.ok(doors.every((d) => reachTown[d.y * town.w + d.x]), `${id}: its door can be walked to from the plaza`);
  for (const d of doors) {
    const at = walkThrough("town", d);
    assert.equal(at.map, id, `${id}: the door at (${d.x},${d.y}) goes in`);
    const tx = Math.floor(at.x / 16), ty = Math.floor(at.y / 16);
    assert.deepEqual([tx, ty], entry, `${id}: you arrive just inside the door`);
    assert.ok(clearOfDoors(m, at.x, at.y), `${id}: you arrive clear of the way out`);
  }
  // and back out: onto the open landing in town, clear of the door, on the step of the door you went in by
  const out = walkThrough(id, exit);
  assert.equal(out.map, "town", `${id}: the way out leads to town`);
  const ox = Math.floor(out.x / 16), oy = Math.floor(out.y / 16);
  assert.deepEqual([ox, oy], want.out, `${id}: you come out on the landing`);
  assert.ok(open(town, ox, oy) && reachTown[oy * town.w + ox], `${id}: you come out on open ground in town`);
  assert.ok(clearOfDoors(town, out.x, out.y), `${id}: you come out clear of the door`);
  assert.ok(doors.some((d) => Math.abs(ox - d.x) + Math.abs(oy - d.y) === 1), `${id}: the landing is the door's step`);
}

// ── the people who moved: the map-maker and the scribe work in the library now, the hall keeps the rest
const hallNpcs = mapOf("town_hall").npcs, lib = mapOf("owl_library").npcs;
assert.ok(lib.some((n) => n.id === "hall_pipi" && n.role === "collector") && lib.some((n) => n.id === "hall_momo" && n.role === "achieve"), "피피 and 모모 moved to the library");
assert.ok(!hallNpcs.some((n) => n.id === "hall_pipi" || n.id === "hall_momo"), "and are no longer in the hall");
assert.ok(hallNpcs.some((n) => n.id === "hall_bori") && hallNpcs.some((n) => n.id === "hall_hana"), "the hall keeps 보리 and 해나");
// the mercenaries' captain gives three side quests
assert.equal(D.side.filter((q) => q.giver === "merc_grey").length, 3, "그레이 has three side quests");
// ── the cafe and the inn sell their own goods, and only theirs
const buyAt = (id, npcId, item) => {
  const m = mapOf(id), n = m.npcs.find((o) => o.id === npcId);
  // across the counter: three tiles in front of the keeper
  place(id, n.x * 16 + 8, (n.y + 3) * 16 + 4);
  assert.ok(open(m, n.x, n.y + 3), `${id}: a customer can stand in front of ${n.name}`);
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

// ── the town's services, indoors: the hall's daily board, the library's collection and records, a shop in
// every workshop selling only its own goods, the smith at the anvil, the job scroll in the dojo
const hall = mapOf("town_hall"), library = mapOf("owl_library");
assert.ok(hall.npcs.some((n) => n.role === "daily"), "the town hall keeps its daily board");
for (const role of ["achieve", "collector"]) assert.ok(library.npcs.some((n) => n.role === role && !n.thing) && library.npcs.some((n) => n.role === role && n.thing), `the library has a ${role} desk and a ${role} object`);
/** Stand on the first open tile within reach of the NPC (keepers are served across their counter). */
const besideNpc = (id, npcId) => {
  const m = mapOf(id), n = m.npcs.find((o) => o.id === npcId);
  for (let r = 1; r <= 3; r++) for (const [dx, dy] of [[0, r], [r, 0], [-r, 0], [0, -r], [r, r], [-r, r]]) {
    const x = n.x + dx, y = n.y + dy;
    if (open(m, x, y) && reaches(n, x, y)) { place(id, x * 16 + 8, y * 16 + 8); return n; }
  }
  assert.fail(`${id}: nowhere to stand by ${n.name}`);
};
for (const [id, npcId, sells, not] of [
  ["general_store", "store_dari", "hp_s", "cafe_cocoa"], ["kangkang_forge", "forge_musoe", "ru_ign", "hp_s"],
  ["juju_diner", "juju", "food_m", "hp_s"], ["pet_house", "pet_monggeul", "pet_chick", "hp_s"],
]) {
  const n = besideNpc(id, npcId);
  assert.ok(L.validateAction(S, PID, { t: "buy", id: sells, n: 1 }).ok, `${n.name} sells ${sells}`);
  assert.ok(!L.validateAction(S, PID, { t: "buy", id: not, n: 1 }).ok, `${n.name} does not sell ${not}`);
}
// the diner's stove is a hearth to rest and cook by; the lab's cauldron is not
assert.equal(L.runtime(S, "juju_diner").fires.length, 2, "the diner has the stove and the fireplace");
assert.equal(L.runtime(S, "bogle_lab").fires.length, 0, "the lab's cauldron is no hearth");
// an interactive object gives its service from beside it: the anvil, the mirror, the job scroll
for (const [id, tid, role] of [["kangkang_forge", "forge_anvil", "smith"], ["boutique", "bout_mirror", "costume"], ["dojo", "dojo_scroll", "job"]]) {
  const m = mapOf(id), n = m.npcs.find((o) => o.id === tid);
  assert.ok(n.thing && n.role === role && !open(m, n.x, n.y), `${id}: ${n.name} stands on its furniture`);
}
const far = (m) => (m.o[m.h - 2][1] === " " ? [1, m.h - 2] : [m.w - 2, m.h - 2]);
{
  // the dojo's scroll alone answers for the job desk (the master beside it is the trainer)
  const m = mapOf("dojo");
  p.ch.wm.sword.lv = 99; p.ch.gold = 1e7;
  besideNpc("dojo", "dojo_scroll");
  assert.ok(L.validateAction(S, PID, { t: "job_change", j: "swordsman" }).ok, "a job can be taken at the dojo's scroll");
  const [fx, fy] = far(m);
  place("dojo", fx * 16 + 8, fy * 16 + 8);
  assert.equal(L.validateAction(S, PID, { t: "job_change", j: "swordsman" }).error, "전직관이 너무 멉니다", "but not from across the room");
}
console.log("interiors: OK");
