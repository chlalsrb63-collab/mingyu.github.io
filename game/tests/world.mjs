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
  assert.ok(D.mobs[q.mob].tier >= lastLv - 3, `quests rise in level (a neighbouring ground may overlap a little): ${q.mob}`);
  lastLv = D.mobs[q.mob].tier;
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
const place = (id, x, y) => { L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.x = x; p.y = y; p.mvAt = now; p.sendMap = true; p.hp = 1e9; };
const hero = L.hero("길잡이", { wk: "sword", lvl: 200 });
Object.assign(p.ch, { st: hero.st, lvl: hero.lvl });
p.stc = null;
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
    // the town's "내 집" door leads into a private house (tests/housing.mjs), not into the map graph
    if (door.home) continue;
    place(id, door.x * 16 + 8, door.y * 16 + 11);
    S.now = now;
    assert.ok(L.validateAction(S, PID, { t: "mv", x: p.x, y: p.y, d: 0 }).ok);
    L.applyAction(S, PID, { t: "mv", x: p.x, y: p.y, d: 0 });
    assert.notEqual(p.map, id, `${id}: stepping on the door to ${door.to} goes somewhere`);
    const there = D.maps.find((o) => o.id === p.map);
    assert.ok(door.to.startsWith(there.name), `the door is labelled with where it leads: ${door.to}`);
    if (there.band) assert.ok(door.to.includes(`Lv.${there.minLv || there.band[0]}`), "and with the level it asks for");
    todo.push([p.map, p.x, p.y]);
  }
}
assert.deepEqual(Object.keys(seen).sort(), D.maps.map((m) => m.id).sort(), "every map can be reached from town");
for (const id of ["meadow", "forest", "crypt", "city", "sewer", "cave", "abyss", "maple", "jungle", "oasis", "coast", "dunesea", "frostkeep"]) assert.ok(D.maps.find((m) => m.id === id).band, id + " shows its level band");

// ── the dungeons: harder the deeper you go, a camp on the way, a guardian at the end
for (const id of ["crypt", "sewer", "abyss"]) {
  // measured from the way in (the walk above may have come in by a back door, like the abyss's ledge up to the old kingdom)
  const { m } = maps[id], rt = L.runtime(S, id), [ex, ey] = L.atlas().maps[id].entry, dist = flood(m, ex, ey);
  assert.ok(["crypt", "sewer", "abyss"].includes(m.theme), id + " names its theme");
  const at = (o) => dist[Math.floor(o.y / 16) * m.w + Math.floor(o.x / 16)];
  // who lives where is read from the map's spawn quotas (only the cells near a player are ever awake)
  const M = L.atlas().maps[id], qd = (sp) => dist[Math.floor((sp.r[1] + sp.r[3]) / 2) * m.w + Math.floor((sp.r[0] + sp.r[2]) / 2)];
  const ord = M.spawns.filter((sp) => !D.mobs[sp.k].chest && !D.mobs[sp.k].boss && !sp.el && qd(sp) >= 0);
  const kinds = [...new Set(ord.map((sp) => sp.k))].sort((a, b) => D.mobs[a].lv - D.mobs[b].lv);
  const depth = (k) => { const l = ord.filter((sp) => sp.k === k); return l.reduce((a, sp) => a + qd(sp) * sp.n, 0) / l.reduce((a, sp) => a + sp.n, 0); };
  assert.ok(depth(kinds[0]) < depth(kinds[kinds.length - 1]), `${id}: the weakest kind lives nearer the door than the strongest (${depth(kinds[0]).toFixed(0)} vs ${depth(kinds[kinds.length - 1]).toFixed(0)})`);
  // near the door it is quiet; far in, the elites gather
  let far = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] > far) far = dist[i];
  const rate = (f) => { const l = ord.filter(f); return l.reduce((a, sp) => a + sp.n * (sp.elite || 0), 0) / l.reduce((a, sp) => a + sp.n, 0); };
  assert.equal(ord.filter((sp) => qd(sp) < far * 0.04).length, 0, `${id}: nobody lives right by the door`);
  const nearE = rate((sp) => qd(sp) < far * 0.3), deepE = rate((sp) => qd(sp) > far * 0.6);
  assert.ok(deepE > nearE * 2, `${id}: the depths breed elites far more often than the way in (${nearE.toFixed(2)} near, ${deepE.toFixed(2)} deep)`);
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
  // (close in: on a wide platform its pack may stand nearer than fourteen pixels, and the blow takes the nearest)
  place(id, g.x - 8, g.y);
  g.hp = 1; p.atkAt = 0; p.dir = 2; p.aim = 0; S.now = now;
  L.applyAction(S, PID, { t: "atk" });
  assert.ok(g.dead, id + ": the guardian can be killed");
  for (let i = 0; i < 100; i++) { now += 1000; p.hp = 1e9; L.tick(S, now); L.endTick(S); }
  assert.ok(g.dead, "and stays down for a while");
  for (let i = 0; i < 100; i++) { now += 1000; p.hp = 1e9; L.tick(S, now); L.endTick(S); }
  assert.ok(!g.dead && g.el === 2, "then comes back, a guardian still");
}
// the final boss waits at the bottom of the abyss; the cave keeps its own
assert.ok(L.runtime(S, "abyss").mobs.some((o) => o.k === "abyssboss") && L.runtime(S, "cave").mobs.some((o) => o.k === "boss"));
assert.equal(D.mobs.abyssboss.boss, 1);
JSON.stringify(L.removePlayer(S, PID));

// ── maps-v2 M3: the south-west coast closes a loop — city ↔ jungle ↔ coast ↔ oasis ↔ cave, every door both ways
{
  const { maps } = L.atlas();
  for (const [a, b] of [["city", "jungle"], ["jungle", "coast"], ["coast", "oasis"], ["oasis", "cave"]]) {
    for (const [from, to] of [[a, b], [b, a]]) {
      assert.ok(maps[from].portals.some((p) => p.to === to), `${from} has a door to ${to}`);
      assert.ok(D.maps.find((m) => m.id === from).to.includes(to), `${from} lists ${to} as a way on`);
    }
  }
  for (const id of ["jungle", "oasis", "coast"]) {
    const m = maps[id], band = D.maps.find((q) => q.id === id).band;
    assert.equal(m.stones.length, 3, id + ": three waypoint stones");
    for (const k of new Set(m.spawns.map((sp) => sp.k))) assert.ok(D.mobs[k].chest || (D.mobs[k].lv >= band[0] && D.mobs[k].lv <= band[1]), `${id}: ${k} fits the band`);
    // the shallows are walkable, the deep sea is not
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.reach[y * m.w + x]) assert.ok(m.g[y][x] !== "w", `${id}: reachable deep water at ${x},${y}`);
  }
  assert.ok(maps.coast.g.some((r) => r.includes("~")) && maps.coast.g.some((r) => r.includes("-")), "the coast has shallows and a surf line");
}
// ── 모래바다 (dunesea, maps-v2 J): the biggest ground — doors both ways to the oasis and the coast, five stones,
// two camps and the plaza's fire, four oases (one with its village), islets with chests, the buried ruin for the boss
{
  const { maps, fires } = L.atlas();
  const m = maps.dunesea, W = m.w, meta = D.maps.find((q) => q.id === "dunesea");
  for (const [a, b] of [["oasis", "dunesea"], ["coast", "dunesea"]]) for (const [from, to] of [[a, b], [b, a]]) {
    assert.ok(maps[from].portals.some((p) => p.to === to), `${from} has a door to ${to}`);
    assert.ok(D.maps.find((q) => q.id === from).to.includes(to), `${from} lists ${to} as a way on`);
  }
  for (const id of Object.keys(maps)) if (id !== "dunesea") assert.ok(maps[id].w * maps[id].h < W * m.h / 2.4, `dunesea is far bigger than ${id}`);
  assert.equal(m.stones.length, 5, "five waypoint stones");
  assert.deepEqual(D.waypoints.find((w) => w.id === "dunesea").names, ["입구", "중턱", "안쪽", "오아시스 마을", "흰 모래 해변"]);
  assert.equal(fires.dunesea.length, 3, "the caravan's camp, the village fire and the plaza's");
  assert.ok(m.village && fires.dunesea.some(([x, y]) => x >= m.village.x && x < m.village.x + m.village.w && y >= m.village.y && y < m.village.y + m.village.h), "a fire burns in the oasis village");
  assert.ok(m.stones.some((s) => Math.hypot(s.x - m.village.x, s.y - m.village.y) < 24), "a stone stands by the village");
  for (const k of new Set(m.spawns.map((sp) => sp.k))) assert.ok(D.mobs[k].chest || (D.mobs[k].lv >= meta.band[0] && D.mobs[k].lv <= meta.band[1]), `dunesea: ${k} fits the band`);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < W; x++) if (m.reach[y * W + x]) assert.ok(m.g[y][x] !== "w", `dunesea: reachable deep water at ${x},${y}`);
  // the lakes of the four oases: four bodies of fresh water of ≥ 20 tiles north of the beach
  const seen2 = new Uint8Array(W * m.h);
  let lakes = 0;
  for (let y = 2; y < 130; y++) for (let x = 2; x < W - 2; x++) {
    if (m.g[y][x] !== "w" || seen2[y * W + x]) continue;
    const st = [[x, y]]; let n = 0;
    seen2[y * W + x] = 1;
    while (st.length) { const [cx, cy] = st.pop(); n++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = cx + dx, Y = cy + dy; if (Y < 130 && m.g[Y][X] === "w" && !seen2[Y * W + X]) { seen2[Y * W + X] = 1; st.push([X, Y]); } } }
    if (n >= 20) lakes++;
  }
  assert.equal(lakes, 4, "four oases");
  // islets: chests standing on sand out in the shallows, each walkable from the entrance
  const chests = m.spawns.filter((sp) => D.mobs[sp.k].chest).map((sp) => sp.r);
  const out = chests.filter(([x, y]) => y > 150 && m.g[y][x] === "S");
  assert.ok(out.length >= 4, `chests on islets in the shallows (${out.length})`);
  for (const [x, y] of chests) assert.ok(m.reach[y * W + x], `the chest at ${x},${y} can be reached`);
  assert.ok(m.g.some((r) => r.includes("~")) && m.g.some((r) => r.includes("-")) && m.g.some((r) => r.includes("r")), "shallows, a surf line and the dry riverbed");
  // the field boss rises in the buried ruin
  assert.ok(m.ruin && m.bossAt && m.bossAt[0] >= m.ruin.x && m.bossAt[0] < m.ruin.x + m.ruin.w && m.bossAt[1] >= m.ruin.y && m.bossAt[1] < m.ruin.y + m.ruin.h && m.reach[m.bossAt[1] * W + m.bossAt[0]], "the boss's ground is the ruin");
}
console.log("world ok — maps", Object.keys(seen).join(","));
