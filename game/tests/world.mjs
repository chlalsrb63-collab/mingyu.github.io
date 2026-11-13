// Headless test of the world's shape — every map reachable on foot, dungeons that get harder the deeper
// you go, guardians that come back, a quest chain that points at real monsters: node tests/world.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const S = L.setup();
let now = 1000;
S.now = now;
const PID = "pid-world001";
const view = () => { now += 100; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; };

// ── an old sheet: quest index past the end, a bounty and mastery on monsters that no longer exist
const old = L.newChar("길잡이", "warrior", []);
old.lvl = 50; old.q = { i: 99, n: 7, st: 1 }; old.bq = { k: "acorn", n: 3, need: 25 }; old.mk = { acorn: 40, twinhare: 3, nope: 9 };
L.addPlayer(S, PID, old);
const p = S.players[PID];
let v = view();
assert.ok(v.self.q.i <= D.quests.length, "the quest index is clamped to the chain");
assert.equal(v.self.bq, null, "a bounty on a vanished monster is dropped");
assert.deepEqual(v.self.mk, { twinhare: 3 }, "so is its mastery");

// ── the quest chain names real monsters, in rising level, each of which lives somewhere
const homes = {};
for (const m of D.maps) for (const k of m.mobs) homes[k] = m.id;
let lastLv = 0;
for (const q of D.quests) {
  assert.ok(D.mobs[q.mob], "quest monster exists: " + q.mob);
  assert.ok(homes[q.mob], "and has a home: " + q.mob);
  assert.ok(D.mobs[q.mob].lv >= lastLv - 3, `quests rise in level (a neighbouring ground may overlap a little): ${q.mob}`);
  lastLv = D.mobs[q.mob].lv;
}
for (const k of Object.keys(D.mobs)) assert.ok(homes[k], "every monster is placed on some map: " + k);

// ── walk the whole world: from each arrival point, every door of that map can be reached on foot,
// and every door leads somewhere. (Stand on a door tile, nudge, and see where you come out.)
const blocked = (m, x, y) => x < 0 || y < 0 || x >= m.w || y >= m.h || m.o[y][x] !== " " || "wW".includes(m.g[y][x]);
const flood = (m, sx, sy) => {
  const dist = new Int32Array(m.w * m.h).fill(-1), q = [[sx, sy]];
  dist[sy * m.w + sx] = 0;
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (blocked(m, nx, ny) || dist[ny * m.w + nx] >= 0) continue;
      dist[ny * m.w + nx] = dist[y * m.w + x] + 1; q.push([nx, ny]);
    }
  }
  return dist;
};
const place = (id, x, y) => { S.maps[p.map].n--; p.map = id; S.maps[id].n++; p.x = x; p.y = y; p.mvAt = now; p.sendMap = true; p.hp = 1e9; };
const seen = {}, maps = {}, todo = [["town", 20 * 16 + 8, 18 * 16 + 8]];
while (todo.length) {
  const [id, px, py] = todo.pop();
  if (seen[id]) continue;
  place(id, px, py);
  const m = view().map;
  assert.equal(m.id, id);
  const dist = flood(m, Math.floor(px / 16), Math.floor(py / 16));
  seen[id] = true; maps[id] = { m, dist };
  for (const door of m.portals) {
    assert.ok(dist[door.y * m.w + door.x] >= 0, `${id}: the door to ${door.to} can be walked to`);
    place(id, door.x * 16 + 8, door.y * 16 + 11);
    S.now = now;
    assert.ok(L.validateAction(S, PID, { t: "mv", x: p.x, y: p.y, d: 0 }).ok);
    L.applyAction(S, PID, { t: "mv", x: p.x, y: p.y, d: 0 });
    assert.notEqual(p.map, id, `${id}: stepping on the door to ${door.to} goes somewhere`);
    const there = D.maps.find((o) => o.id === p.map);
    assert.ok(door.to.startsWith(there.name), `the door is labelled with where it leads: ${door.to}`);
    if (there.band) assert.ok(door.to.includes(`Lv.${there.band[0]}`), "and with the level it asks for");
    todo.push([p.map, p.x, p.y]);
  }
}
assert.deepEqual(Object.keys(seen).sort(), D.maps.map((m) => m.id).sort(), "every map can be reached from town");
for (const id of ["meadow", "forest", "crypt", "city", "sewer", "cave", "abyss"]) assert.ok(D.maps.find((m) => m.id === id).band, id + " shows its level band");

// ── the dungeons: harder the deeper you go, a camp on the way, a guardian at the end
for (const id of ["crypt", "sewer", "abyss"]) {
  const { m, dist } = maps[id], rt = S.maps[id];
  assert.ok(["crypt", "sewer", "abyss"].includes(m.theme), id + " names its theme");
  const at = (o) => dist[Math.floor(o.y / 16) * m.w + Math.floor(o.x / 16)];
  const kinds = D.maps.find((o) => o.id === id).mobs.filter((k) => !D.mobs[k].chest && !D.mobs[k].boss).sort((a, b) => D.mobs[a].lv - D.mobs[b].lv);
  const depth = (k) => { const list = rt.mobs.filter((o) => o.k === k && o.fix !== 2).map(at).filter((d) => d >= 0); return list.reduce((a, b) => a + b, 0) / list.length; };
  assert.ok(depth(kinds[0]) < depth(kinds[kinds.length - 1]), `${id}: the weakest kind lives nearer the door than the strongest (${depth(kinds[0]).toFixed(0)} vs ${depth(kinds[kinds.length - 1]).toFixed(0)})`);
  // near the door it is quiet; far in, crowded
  const all = rt.mobs.filter((o) => !D.mobs[o.k].chest).map(at).filter((d) => d >= 0);
  const far = Math.max(...all);
  const nearN = all.filter((d) => d < far * 0.25).length, deepN = all.filter((d) => d > far * 0.6).length;
  assert.ok(deepN > nearN * 2, `${id}: the depths are more crowded than the entrance (${nearN} near, ${deepN} deep)`);
  assert.ok(rt.mobs.length <= 230, `${id}: ${rt.mobs.length} monsters`);
  assert.ok(rt.fires.length >= 1, id + " has a camp");
  const fire = rt.fires[0], fd = dist[Math.floor(fire.y / 16) * m.w + Math.floor(fire.x / 16)];
  assert.ok(fd > far * 0.2 && fd < far * 0.85, `${id}: the camp is partway in (${fd} of ${far})`);
  assert.ok(rt.mobs.some((o) => D.mobs[o.k].chest), id + " has chests");
  const guards = rt.mobs.filter((o) => o.fix === 2);
  assert.equal(guards.length, 1, id + " has one guardian");
  const g = guards[0];
  assert.equal(g.el, 2);
  assert.ok(at(g) > far * 0.6, `${id}: the guardian is deep (${at(g)} of ${far})`);
  // it stays down three minutes, then stands again, still a guardian
  place(id, g.x - 14, g.y);
  g.hp = 1; p.atkAt = 0; p.dir = 2; S.now = now;
  L.applyAction(S, PID, { t: "atk" });
  assert.ok(g.dead, id + ": the guardian can be killed");
  for (let i = 0; i < 100; i++) { now += 1000; p.hp = 1e9; L.tick(S, now); L.endTick(S); }
  assert.ok(g.dead, "and stays down for a while");
  for (let i = 0; i < 100; i++) { now += 1000; p.hp = 1e9; L.tick(S, now); L.endTick(S); }
  assert.ok(!g.dead && g.el === 2, "then comes back, a guardian still");
}
// the final boss waits at the bottom of the abyss; the cave keeps its own
assert.ok(S.maps.abyss.mobs.some((o) => o.k === "abyssboss") && S.maps.cave.mobs.some((o) => o.k === "boss"));
assert.equal(D.mobs.abyssboss.boss, 1);
JSON.stringify(L.removePlayer(S, PID));
console.log("world ok — maps", Object.keys(seen).join(","));
