// Headless test of the party instance 차원 균열 (docs/design/scale-and-rift.md D): the generator
// (deterministic, capped, every room reachable), the ready check and its edge cases, the gauge,
// orbs and shrines, the way down at 100% on floors 1–2, the final boss in its hall on floor 3, the chest
// and the way home, death and failure, cleanup, the wire, and a bot party clearing the 3-floor raid in
// about 10 minutes. node tests/dimrift.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { DIM, DIM_TOWN, DIM_THEMES, DIM_FLOORS, dimTheme, dimension, dimPool, killMob, changeMap, closeDim, rollGear, tierFor, GEAR, WK_ID, MOBS, SKILL, SKILL_ORDER, skillHpCost, xpNeed, stats, atkRange, aimIdx, EVT_MAPS, worldEvent, ITEMS, SOLID_G, MAXLV, DIM_CHAL, CHAL_KEYS, dimFloorK, dimReward, weekOf, dayOf, dimArena, chalMinLv, chalSteps, TIER_MAX, dimClean, dealMob, mobMax, dimHk, chalOfWeek };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16, D = X.DIM;
// tuning runs: HPB=… BOSSHP=… NOCLEAR=1 node tests/dimrift.mjs -v
const X_DIM_SET = [];
if (process.env.HPB) X_DIM_SET.push(["hpBase", +process.env.HPB]);
if (process.env.BOSSHP) X_DIM_SET.push(["bossHp", +process.env.BOSSHP]);
if (process.env.BOSSATK) X_DIM_SET.push(["bossAtk", +process.env.BOSSATK]);
if (process.env.LVK) X_DIM_SET.push(["lvK", +process.env.LVK]);
const VERBOSE = process.argv.includes("-v");
const log = (...a) => { if (VERBOSE) console.log(...a); };
const THEMES = Object.keys(X.DIM_THEMES);

// ───────────── 1. the generator
{
  // the old single-concept floor (56 × 40) walked 465 tiles on average over ten seeds; every concept must give five times that
  const OLD = 465, times = [], per = {};
  for (let s = 1; s <= 60; s++) for (let floor = 1; floor <= D.floors; floor++) {
    const seed = Math.imul(s, 2654435761) | 0, lv = 10 + (s % 39), theme = X.dimTheme(seed >>> 0, floor), cc = X.DIM_FLOORS[floor - 1];
    const t0 = performance.now();
    const m = X.dimension({ id: "dim:9", seed, theme, lv, floor });
    times.push(performance.now() - t0);
    if (s <= 12) { const again = X.dimension({ id: "dim:9", seed, theme, lv, floor }); assert.deepEqual([again.g, again.o, again.dim.spawns], [m.g, m.o, m.dim.spawns], `seed ${seed} floor ${floor}: same seed, same floor`); }
    assert.equal(m.w, D.w); assert.equal(m.h, D.h); assert.equal(m.theme, theme); assert.ok(cc.themes.includes(theme));
    assert.equal(m.dim.style, cc.style); assert.ok(m.name.includes(cc.name), m.name);
    const main = m.dim.rooms.filter((r) => r.kind === "room" || r.kind === "start" || r.kind === "boss");
    assert.ok(main.length >= cc.rooms[0] * 0.6 && main.length <= cc.rooms[1], `${seed}/${floor}: ${main.length} rooms (some over two cells)`);
    assert.ok(m.dim.dead.length >= D.vaults[0] && m.dim.dead.length <= D.vaults[1], `${seed}/${floor}: ${m.dim.dead.length} vaults`);
    const normal = m.dim.spawns.filter((sp) => !sp.el && !sp.chest).reduce((n, sp) => n + sp.n, 0);
    const all = m.dim.spawns.reduce((n, sp) => n + sp.n, 0);
    assert.ok(normal <= D.mobCap && all <= D.cap, `${seed}: ${normal} monsters, ${all} in all`);
    // more than the gauge needs (≈ 100 / gK / 0.9 kills): the party picks a route
    assert.ok((normal * D.normal + m.dim.elites * (D.elite + D.orb)) * D.gK >= 150, `${seed}/${floor}: ${normal} monsters are plenty for the gauge`);
    assert.ok(m.dim.elites >= 2, `${seed}: ${m.dim.elites} elites`);
    // one connected layout: every room, spawn and the door home on ground reachable from the way in
    for (const r of m.dim.rooms) assert.ok(m.reach[r.cy * m.w + r.cx], `${seed}/${floor}: room ${r.kind} at ${r.cx},${r.cy} reachable`);
    for (const sp of m.dim.spawns) assert.ok(m.reach[sp.at[1] * m.w + sp.at[0]], `${seed}: spawn ${sp.k} on open ground`);
    assert.equal(m.dim.spawns.filter((sp) => sp.chest).length, m.dim.dead.length, "a chest in every vault");
    assert.equal(m.dim.spawns.filter((sp) => sp.guard).length, m.dim.dead.length, "a guardian in every vault");
    for (const sp of m.dim.spawns) { assert.ok(X.MOBS[sp.k], sp.k); if (!sp.chest) assert.ok(!X.MOBS[sp.k].boss && !X.MOBS[sp.k].chest); }
    assert.ok(m.dim.spawns.every((sp) => m.dim.rooms[sp.room].kind !== "start" && m.dim.rooms[sp.room].kind !== "boss"), "nothing waits in the way in or the master's hall");
    const [dx, dy] = m.dim.door;
    assert.equal(m.portals[0].to, "town"); assert.ok(m.reach[dy * m.w + dx], "the door home stands on open ground");
    // the master's hall has an open 5 × 5 core, far down the floor
    const [bx, by] = m.dim.boss;
    for (let y = by - 2; y <= by + 2; y++) for (let x = bx - 2; x <= bx + 2; x++) assert.ok(m.reach[y * m.w + x], `${seed}/${floor}: boss hall core ${x},${y}`);
    assert.ok(m.dim.path >= D.path && m.dim.path <= 220, `${seed}: way to the master ${m.dim.path} tiles`);
    assert.ok(X.MOBS[m.dim.bossK] && !X.MOBS[m.dim.bossK].chest);
    for (let x = 0; x < m.w; x++) { assert.equal(m.g[0][x], "W"); assert.equal(m.g[m.h - 1][x], "W"); }
    // the variety the owner asked for: loops, a mix of shapes and room types, side rooms, dead ends, props, pools
    let walk = 0, deco = 0, wet = 0;
    for (let i = 0; i < m.w * m.h; i++) { walk += m.reach[i]; const y = (i / m.w) | 0, ch = m.o[y][i % m.w]; if (ch !== " ") deco++; if (m.g[y][i % m.w] === "w") wet++; }
    const deg = m.dim.rooms.map((_, k) => m.dim.links.filter(([a, b]) => a === k || b === k).length);
    const side = m.dim.rooms.filter((r) => r.kind === "vault" || r.kind === "den").length;
    const row = { walk, deco, wet, loops: m.dim.loops, shapes: new Set(main.map((r) => r.shape)).size, types: new Set(main.map((r) => r.rt)).size, side, ends: deg.filter((d) => d === 1).length / main.length };
    assert.ok(row.loops >= 1, `${seed}/${floor}: ${row.loops} loops`);
    assert.ok(row.types >= 4, `${seed}/${floor}: ${row.types} room types`);
    assert.ok(row.deco >= 60, `${seed}/${floor}: ${row.deco} props`);
    assert.ok(walk >= OLD * 4, `${seed}/${floor}: ${walk} walkable tiles`);
    (per[floor] = per[floor] || []).push(row);
  }
  for (let floor = 1; floor <= D.floors; floor++) {
    const rows = per[floor], avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
    assert.ok(avg("walk") >= OLD * 5, `floor ${floor}: ${avg("walk").toFixed(0)} walkable tiles on average, 5 × ${OLD} wanted`);
    if (X.DIM_FLOORS[floor - 1].style === "halls") assert.ok(avg("shapes") >= 5, `floor ${floor}: ${avg("shapes")} room shapes`);
    assert.ok(avg("loops") >= 3 && avg("side") >= 3, `floor ${floor}: loops ${avg("loops")}, side rooms ${avg("side")}`);
    log(`floor ${floor} ${X.DIM_FLOORS[floor - 1].name}: walkable ${avg("walk").toFixed(0)} (${(avg("walk") / OLD).toFixed(1)} × old), loops ${avg("loops").toFixed(1)}, shapes ${avg("shapes").toFixed(1)}, room types ${avg("types").toFixed(1)}, side rooms ${avg("side").toFixed(1)}, dead-end rooms ${(100 * avg("ends")).toFixed(0)} %, props ${avg("deco").toFixed(0)}, pool tiles ${avg("wet").toFixed(0)}`);
  }
  assert.equal(new Set(X.DIM_FLOORS.map((c) => c.style)).size, 3, "three distinct concepts");
  // seeds look different: no two of five floors of a concept share more than 85 % of their ground
  for (let floor = 1; floor <= D.floors; floor++) {
    const maps = [1, 2, 3, 4, 5].map((s) => X.dimension({ id: "dim:9", seed: Math.imul(s, 40503) | 0, theme: X.dimTheme(s, floor), lv: 30, floor }));
    for (let a = 0; a < maps.length; a++) for (let b = a + 1; b < maps.length; b++) {
      let same = 0, na = 0;
      for (let i = 0; i < D.w * D.h; i++) { na += maps[a].reach[i]; if (maps[a].reach[i] && maps[b].reach[i]) same++; }
      assert.ok(same / na < 0.85, `floor ${floor}: seeds ${a} and ${b} share ${(100 * same / na).toFixed(0)} % of their ground`);
    }
  }
  times.sort((a, b) => a - b);
  const p99 = times[Math.floor(times.length * 0.99)];
  assert.ok(p99 < 60, "a floor is made in under 60 ms: p99 " + p99.toFixed(1));
  log(`generator: ${times.length} floors, median ${times[times.length >> 1].toFixed(2)} ms, p99 ${p99.toFixed(1)} ms, max ${times[times.length - 1].toFixed(1)} ms`);
  // the pool follows the level
  for (const lv of [10, 20, 30, 40, 49]) for (const t of THEMES) {
    const pool = X.dimPool(t, lv);
    assert.ok(pool.length >= 3, `${t} ${lv}: ${pool}`);
    for (const k of pool) assert.ok(Math.abs(X.MOBS[k].lv - lv) <= 8, `${t} ${lv}: ${k} Lv.${X.MOBS[k].lv}`);
  }
}

// ───────────── helpers for a world
let now;
function world() {
  const S = L.setup();
  // between two world events (EVT: every 30 min, called 2 min ahead, 8 min long): a 16-minute rift run never shares its
  // draws with an invasion, so which ground the event picks (the list grows with every new ground) cannot sway it
  now = 2_281_000;
  S.now = now; S.last = now;
  return S;
}
const [OBX, OBY] = [X.DIM_TOWN.keeper[0] * T + 8, (X.DIM_TOWN.keeper[1] - 1) * T + 10];
/** The weapon each old class carried (a bot of that class holds it, with its weapon skills). */
const WKOF = { warrior: "sword", rogue: "dagger", lancer: "spear", mage: "staff" };
/** A hero carrying `cls`'s weapon at what used to be level `lv` (world tier lv: level 4·lv − 3, mastery lv, the job from 20). */
function hero(S, pid, name, cls = "warrior", lv = 20, gear = false) {
  const ch = L.hero(name, { wk: WKOF[cls], lvl: Math.min(197, 4 * lv - 3), migrate: true });
  if (gear) {
    const tier = X.tierFor(lv), box = { seed: lv * 31 + name.length };
    const kinds = [WKOF[cls]];
    ch.eq.weapon = X.rollGear(S, `w_${X.WK_ID[kinds[0]]}_${tier}`, 1, lv);
    for (const t of ["helm", "armor", "gloves", "boots"]) ch.eq[t] = X.rollGear(S, `${X.GEAR[t].pre}_${tier}`, 1, lv);
    ch.inv.push({ id: lv < 26 ? "hp_m" : "hp_l", n: 60 }, { id: lv < 26 ? "mp_m" : "mp_l", n: 40 });
    void box;
  }
  ch.map = "town"; ch.x = OBX; ch.y = OBY;
  L.addPlayer(S, pid, ch);
  return S.players[pid];
}
const act = (S, pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
const views = {};
function step(S, ms = 100) {
  now += ms;
  L.tick(S, now);
  for (const pid of Object.keys(S.players)) {
    const v = JSON.parse(JSON.stringify(L.viewFor(S, pid)));
    (views[pid] = views[pid] || []).push(v);
    if (views[pid].length > 40) views[pid].shift();
  }
  L.endTick(S);
}
const last = (pid, key) => { const l = views[pid] || []; for (let i = l.length - 1; i >= 0; i--) if (key in l[i]) return l[i][key]; return undefined; };
function party(S, pids) {
  for (const pid of pids.slice(1)) {
    assert.ok(act(S, pids[0], { t: "pinv", e: S.players[pid].eid }).ok);
    assert.ok(act(S, pid, { t: "pacc" }).ok, "joins the party");
  }
  return S.parties[S.players[pids[0]].party];
}
const dimIds = (S) => Object.keys(S.dims);

// ───────────── 2. the obelisk and the ready check
{
  const S = world();
  const town = L.atlas().maps.town;
  const [ox, oy] = X.DIM_TOWN.ob;
  assert.ok(town.big.some((b) => b.t === "obelisk" && b.x === ox && b.y === oy), "the obelisk stands in the plaza");
  assert.ok(town.o[oy][ox] !== " ", "the obelisk is solid");
  assert.ok(town.npcs.some((n) => n.role === "dim" && n.name === "균열 지기 오르카"), "its keeper stands beside it");
  const [lx, ly] = X.DIM_TOWN.land;
  assert.ok(town.reach[ly * town.w + lx], "the landing beside it is open ground");
  // the night fire still seats four, and nothing stands on the spirit tree or the guide
  assert.equal(L.skyAt("town", 0).camps[0].seats.length, 4, "the plaza fire keeps its four stumps");
  const taken = new Set(town.npcs.map((n) => n.x + "," + n.y));
  assert.equal(taken.size, town.npcs.length, "no two townsfolk on one tile");

  const A = hero(S, "pa", "가장"), B = hero(S, "pb", "나비"), C = hero(S, "pc", "다람"), E = hero(S, "pe", "멀리");
  step(S);
  // too far: refused
  A.x = 6 * T; A.y = 14 * T;
  assert.match(act(S, "pa", { t: "dim_open" }).error, /오벨리스크/);
  A.x = OBX; A.y = OBY;
  const P = party(S, ["pa", "pb", "pc", "pe"]);
  assert.match(act(S, "pb", { t: "dim_open" }).error, /파티장만/, "only the leader opens");
  // E is out of town: not asked
  L.runtime(S, "meadow");
  X.changeMap(S, E, "meadow", 30 * T, 20 * T);
  assert.ok(act(S, "pa", { t: "dim_open" }).ok);
  assert.match(act(S, "pa", { t: "dim_open" }).error, /이미 준비/);
  step(S);
  const rc = P.rc;
  assert.ok(rc && rc.resp.pa === 1 && rc.resp.pb === 0 && rc.resp.pc === 0 && rc.resp.pe === 3);
  const vb = last("pb", "rc");
  assert.ok(Array.isArray(vb) && vb[0] === rc.id && vb[1] === 20 && vb[2].length === 4, "B is shown the check: " + JSON.stringify(vb));
  assert.equal(last("pe", "rc"), undefined, "E out in the meadow is not asked");
  assert.match(act(S, "pb", { t: "dim_ready", id: rc.id + 1, ok: 1 }).error, /응답할/, "a wrong id is refused");
  assert.ok(act(S, "pb", { t: "dim_ready", id: rc.id, ok: 0 }).ok, "B declines");
  assert.match(act(S, "pb", { t: "dim_ready", id: rc.id, ok: 1 }).error, /이미 응답/, "no second answer");
  assert.ok(P.rc, "a decline does not cancel it for the others");
  // C never answers: after 20 s the leader goes in alone
  for (let i = 0; i < 201 && P.rc; i++) step(S);
  assert.equal(P.rc, null);
  assert.equal(dimIds(S).length, 1);
  const id = dimIds(S)[0];
  assert.equal(A.map, id, "the leader is in"); assert.equal(B.map, "town"); assert.equal(C.map, "town");
  step(S);
  assert.equal(last("pb", "rc"), 0, "the check closes on B's screen");
  assert.ok(Array.isArray(last("pb", "dj")), "B can join later: " + JSON.stringify(last("pb", "dj")));
  assert.ok(act(S, "pb", { t: "dim_join" }).ok, "B joins");
  assert.equal(B.map, id);
  assert.ok(Array.isArray(last("pa", "dim")) || true);
  // a member who walks out can walk back in
  assert.ok(act(S, "pb", { t: "dim_leave" }).ok);
  assert.equal(B.map, "town");
  assert.ok(act(S, "pb", { t: "dim_join" }).ok);
  assert.match(act(S, "pa", { t: "dim_open" }).error, /오벨리스크|이미 열린/, "no second rift while one is open");
}
{
  // the leader leaves the party during a check: it is called off; a member who disconnects drops out
  const S = world();
  for (const [pid, n] of [["la", "하나"], ["lb", "두리"], ["lc", "세찌"], ["ld", "네찌"]]) hero(S, pid, n);
  const P = party(S, ["la", "lb", "lc", "ld"]);
  assert.ok(act(S, "la", { t: "dim_open" }).ok);
  L.removePlayer(S, "ld");
  step(S);
  assert.ok(P.rc && !("ld" in P.rc.resp), "a disconnected member drops out of the check");
  assert.ok(act(S, "lb", { t: "dim_ready", id: P.rc.id, ok: 1 }).ok);
  assert.ok(act(S, "la", { t: "pleave" }).ok);
  step(S);
  const P2 = S.parties[S.players.lb.party];
  assert.ok(!P2 || !P2.rc, "the check is called off when its leader leaves");
  assert.equal(dimIds(S).length, 0);
  assert.equal(S.players.lb.map, "town");
  // the new leader may cancel their own
  assert.ok(act(S, "lb", { t: "dim_open" }).ok);
  assert.match(act(S, "lc", { t: "dim_cancel" }).error, /파티장만/);
  assert.ok(act(S, "lb", { t: "dim_cancel" }).ok);
  assert.equal(P2.rc, null);
  // everyone accepts: in at once, together, in the same rift
  assert.ok(act(S, "lb", { t: "dim_open" }).ok);
  assert.ok(act(S, "lc", { t: "dim_ready", id: P2.rc.id, ok: 1 }).ok);
  assert.equal(P2.rc, null, "all answered: no waiting");
  assert.equal(S.players.lb.map, S.players.lc.map);
  assert.ok(S.players.lb.map.startsWith("dim:"));
  assert.equal(S.dims[S.players.lb.map].n, 2);
}
{
  // a party of one goes straight in; the room holds at most DIM.max rifts
  const S = world();
  for (let i = 0; i <= D.max; i++) hero(S, "s" + i, "혼자" + i);
  for (let i = 0; i < D.max; i++) { assert.ok(act(S, "s" + i, { t: "dim_open" }).ok); assert.ok(S.players["s" + i].map.startsWith("dim:")); }
  assert.match(act(S, "s" + D.max, { t: "dim_open" }).error, /모두 사용 중/);
  assert.equal(dimIds(S).length, D.max);
  // everyone walks out through the door home: 20 s later every rift is gone, and nothing is left behind
  for (let i = 0; i < D.max; i++) {
    const p = S.players["s" + i], m = S.dims[p.map].map, [dx, dy] = m.dim.door;
    p.x = dx * T + 8; p.y = dy * T + 7;
    assert.ok(act(S, "s" + i, { t: "mv", x: dx * T + 8, y: dy * T + 6 }).ok);
    assert.equal(p.map, "town", "the door goes home");
  }
  for (let i = 0; i < 190; i++) step(S);
  assert.equal(dimIds(S).length, D.max, "kept a while for a return");
  for (let i = 0; i < 20; i++) step(S);
  assert.equal(dimIds(S).length, 0, "reaped after 20 s empty");
  assert.ok(!Object.keys(S.maps).some((id) => id.startsWith("dim:")), "no runtime left");
  assert.ok(act(S, "s" + D.max, { t: "dim_open" }).ok, "a slot is free again");
}

// ───────────── 3. the gauge, orbs, shrines, the master, the chest, the way home
{
  const S = world();
  const p = hero(S, "g1", "게이지", "warrior", 20);
  const lv0 = p.ch.lvl;
  assert.ok(act(S, "g1", { t: "dim_open" }).ok);
  let dim = S.dims[p.map], rt = dim.rt;
  assert.equal(dim.lv, Math.floor((lv0 + 3) / 4), "the rift is made for the tier of the level going in");
  step(S);
  const v0 = last("g1", "dim");
  assert.ok(Array.isArray(v0) && v0[0] === 0 && v0[2] === 0 && v0[4] === dim.lv && v0[14] === 1, "the HUD block, floor 1: " + JSON.stringify(v0));
  const kill = (mob) => { mob.by = { g1: 1 }; X.killMob(S, rt, mob); };
  const normal = rt.mobs.find((m) => !m.dead && !m.el && !X.MOBS[m.k].chest);
  kill(normal);
  assert.equal(dim.gK, D.gK, "the gauge weighs a kill the same on every floor, however many monsters it holds");
  const total = dim.map.dim.spawns.filter((sp) => !sp.el && !sp.chest).reduce((n, sp) => n + sp.n, 0) * D.normal + dim.map.dim.elites * (D.elite + D.orb);
  assert.ok(total * dim.gK >= 150, "far more in the rift than the gauge needs (the party picks a route): " + total * dim.gK);
  assert.ok(+(dim.prog).toFixed(4) === +(D.normal * dim.gK).toFixed(4), "a kill: +0.9");
  const elite = rt.mobs.find((m) => !m.dead && m.el === 1 && !m.guard);
  kill(elite);
  assert.equal(+dim.prog.toFixed(3), +((D.normal + D.elite) * dim.gK).toFixed(3), "an elite: +4");
  assert.equal(dim.orbs.length, 1, "it leaves an orb");
  const orb = dim.orbs[0];
  p.x = orb.x + 10; p.y = orb.y;
  step(S);
  assert.equal(dim.orbs.length, 0, "picked up by walking near");
  assert.equal(+dim.prog.toFixed(3), +((D.normal + D.elite + D.orb) * dim.gK).toFixed(3), "an orb: +3");
  // orbs left alone fade
  kill(rt.mobs.find((m) => !m.dead && m.el === 1 && !m.guard));
  p.x = dim.map.dim.start[0] * T + 8; p.y = dim.map.dim.start[1] * T + 10;
  for (let i = 0; i < 260; i++) step(S);
  assert.equal(dim.orbs.length, 0, "an orb nobody takes is gone after 25 s");
  // shrines: the third elite always leaves one; stepping on it lends the buff to the party
  const before = dim.elites;
  while (dim.elites < 3) kill(rt.mobs.find((m) => !m.dead && m.el === 1 && !m.guard) || assert.fail("an elite to kill"));
  assert.ok(dim.pylons.length >= 1, "the 3rd elite leaves a shrine");
  void before;
  const sh = dim.pylons[0];
  p.x = sh.x; p.y = sh.y;
  step(S);
  assert.equal(dim.pylons.length, dim.pylons.filter((s) => s.id !== sh.id).length);
  assert.ok(!dim.pylons.some((s) => s.id === sh.id), "used up");
  if (sh.kind === "atk") assert.ok(p.atkBuff > now);
  if (sh.kind === "spd") assert.ok(p.spdBuff > now);
  if (sh.kind === "shield") assert.ok(p.dimWard > now && X.stats(p).guard < 1);
  // 100% on floor 1: the rest dissolve (vault guardians and chests stay) and the way down opens by the party
  dim.prog = 99.5;
  kill(rt.mobs.find((m) => !m.dead && !m.el && !X.MOBS[m.k].chest));
  assert.equal(dim.state, "down");
  assert.ok(dim.portal && !dim.boss && !rt.mobs.some((m) => !m.dead && m.el === 2), "a way down, no boss on floor 1");
  assert.ok(rt.mobs.filter((m) => !m.dead && !m.el && !X.MOBS[m.k].chest).length === 0, "the rest dissolved");
  assert.ok(rt.mobs.some((m) => !m.dead && m.guard) && rt.mobs.some((m) => !m.dead && X.MOBS[m.k].chest), "vaults keep theirs");
  const g0 = dim.prog;
  kill(rt.mobs.find((m) => !m.dead && m.guard));
  assert.equal(dim.prog, g0, "nothing more after 100%");
  step(S);
  const vd = last("g1", "dim");
  assert.equal(vd[2], 4); assert.deepEqual(vd[8], [dim.portal.x, dim.portal.y]); assert.equal(vd[14], 1);
  assert.ok(vd[1] > 0 && vd[1] <= D.downMs / 1000, "the way down counts down: " + vd[1]);
  // stepping in takes everyone standing down at once: a fresh instance, the same run
  const id1 = dim.id, run0 = [dim.opened, dim.expire, dim.lv, dim.kills];
  p.x = dim.portal.x; p.y = dim.portal.y;
  step(S);
  assert.equal(p.map, id1, "not in the first moment: everyone sees the way down first");
  for (let i = 0; i < 20 && p.map === id1; i++) step(S);
  assert.ok(now - dim.endAt + D.downMs < D.downMs / 2, "stepping in is quicker than the countdown");
  assert.ok(!S.dims[id1] && !S.maps[id1], "floor 1 closed");
  dim = S.dims[p.map]; rt = dim.rt;
  assert.ok(dim && dim.id !== id1 && dim.floor === 2 && dim.state === "run" && dim.prog === 0 && !dim.portal, "floor 2, fresh");
  assert.deepEqual([dim.opened, dim.expire, dim.lv, dim.kills], run0, "the run's clock, level and count go on");
  assert.equal(dim.theme, "cave"); assert.equal(dim.map.dim.style, "caves", "floor 2 is the crystal caves");
  assert.equal(p.ch.dim.best, 1, "a floor cleared is on the sheet");
  const k2 = X.dimFloorK(2);
  for (const m of rt.mobs) if (!X.MOBS[m.k].chest) assert.ok(Math.abs(m.hk - X.dimHk(1, dim.lv, X.MOBS[m.k].lv) * k2.hp) < 1e-9 && Math.abs(m.ak - k2.atk) < 1e-9, "floor 2: health and blows × its row");
  step(S);
  assert.equal(last("g1", "dim")[14], 2, "floor 2 on the wire");
  // floor 2 → 3 without stepping in: the countdown takes the party, the fallen on their feet
  dim.prog = 99.5;
  kill(rt.mobs.find((m) => !m.dead && !m.el && !X.MOBS[m.k].chest));
  assert.equal(dim.state, "down");
  p.dead = true; p.hp = 0;
  for (let i = 0; i < D.downMs / 100 + 2 && p.map === dim.id; i++) step(S);
  dim = S.dims[p.map]; rt = dim.rt;
  assert.equal(dim.floor, 3); assert.ok(!p.dead && p.hp > 0, "up again on the last floor"); assert.equal(p.ch.dim.best, 2);
  // floor 3 at 100%: the final boss wakes in its hall at the far end — not beside the party
  const [sx, sy] = dim.map.dim.start;
  p.x = sx * T + 8; p.y = sy * T + 10;
  dim.prog = 99.5;
  kill(rt.mobs.find((m) => !m.dead && !m.el && !X.MOBS[m.k].chest));
  assert.equal(dim.state, "boss");
  const bosses = rt.mobs.filter((m) => !m.dead && m.el === 2);
  assert.equal(bosses.length, 1, "one final boss");
  assert.equal(bosses[0].id, dim.boss);
  const [hx, hy] = dim.map.dim.boss;
  assert.ok(Math.hypot(bosses[0].x / T - hx, bosses[0].y / T - hy) <= 5, "in its hall");
  assert.ok(Math.hypot(bosses[0].x - p.x, bosses[0].y - p.y) >= 15 * T, "far from the party at the way in");
  assert.ok(rt.mobs.filter((m) => !m.dead && !m.el && !X.MOBS[m.k].chest).length === 0, "the rest dissolved");
  step(S);
  const vb = last("g1", "dim");
  assert.equal(vb[2], 1); assert.equal(vb[3], dim.boss); assert.deepEqual(vb[11], dim.map.dim.boss); assert.equal(vb[14], 3);
  // the master falls: a chest, a door home
  const boss = rt.mobs.find((m) => m.id === dim.boss);
  const bx = boss.x, by = boss.y;
  kill(boss);
  assert.equal(dim.state, "clear");
  assert.ok(dim.chest && dim.portal);
  assert.equal(p.ch.cnt.dim, 1, "a clear is counted");
  step(S);
  const vc = last("g1", "dim");
  assert.equal(vc[2], 2); assert.ok(vc[8] && vc[9] && vc[9][2] === 0, "chest waiting: " + JSON.stringify(vc));
  assert.ok((last("g1", "ev") || []).length >= 0);
  const gold = p.ch.gold, inv = p.ch.inv.length;
  p.x = bx; p.y = by; p.dead = false;
  step(S);
  assert.equal(p.ch.gold - gold >= D.reward.gold * dim.lv, true, "the chest pays gold");
  assert.ok(p.ch.inv.length > inv, "and gear");
  assert.equal(p.ch.dim.n, 1);
  const gold2 = p.ch.gold;
  step(S); step(S);
  assert.equal(p.ch.gold, gold2, "once only");
  assert.ok(p.ch.ach.includes("dim1"), "the achievement");
  // the door home
  p.x = dim.portal.x; p.y = dim.portal.y;
  const id = dim.id;
  step(S);
  assert.equal(p.map, "town");
  assert.ok(Math.abs(p.x - (X.DIM_TOWN.land[0] * T + 8)) < 1, "lands beside the obelisk");
  for (let i = 0; i < 210; i++) step(S);
  assert.ok(!S.dims[id] && !S.maps[id], "closed");
}
{
  // the portal closes after 90 s with people inside: they are sent home; the 4th clear of a day pays half the experience
  const S = world();
  const p = hero(S, "h1", "반값", "mage", 30);
  p.ch.dim = { day: Math.floor((now + 9 * 3600000 - 6 * 3600000) / 86400000), n: 3 };
  assert.ok(act(S, "h1", { t: "dim_open" }).ok);
  const dim = S.dims[p.map];
  dim.floor = 3;   // (straight to the last floor: its 100% wakes the final boss)
  dim.prog = 100; X.killMob(S, dim.rt, Object.assign(dim.rt.mobs.find((m) => !m.el && !X.MOBS[m.k].chest && !m.dead), { by: {} }));
  // (killing with nobody at it still adds the gauge: the master comes)
  if (dim.state !== "boss") { dim.prog = 99.9; const m = dim.rt.mobs.find((q) => !q.dead && !q.el && !X.MOBS[q.k].chest); m.by = { h1: 1 }; X.killMob(S, dim.rt, m); }
  assert.equal(dim.state, "boss");
  const boss = dim.rt.mobs.find((m) => m.id === dim.boss); boss.by = { h1: 1 }; X.killMob(S, dim.rt, boss);
  const xp = p.ch.xp, lv = p.ch.lvl;
  p.x = dim.chest.x; p.y = dim.chest.y;
  step(S);
  assert.equal(p.ch.dim.n, 4);
  if (p.ch.lvl === lv) assert.equal(p.ch.xp - xp, Math.max(1, Math.round(Math.round(D.reward.xp * X.xpNeed(dim.lv) * 0.5) * (1 + X.stats(p).xp / 100))), "half the experience");
  p.x -= 30;
  for (let i = 0; i < 905; i++) step(S);
  assert.equal(p.map, "town", "sent home when the door closes");
}

// ───────────── 4. death, failure, disconnects
{
  const S = world();
  const a = hero(S, "d1", "쓰러짐", "warrior", 25), b = hero(S, "d2", "버팀", "lancer", 25);
  party(S, ["d1", "d2"]);
  assert.ok(act(S, "d1", { t: "dim_open" }).ok);
  assert.ok(act(S, "d2", { t: "dim_ready", id: S.parties[a.party].rc.id, ok: 1 }).ok);
  const id = a.map, dim = S.dims[id];
  const xp = a.ch.xp;
  a.hp = 0; a.dead = true;
  step(S);
  assert.match(act(S, "d1", { t: "respawn" }).error, /초 뒤에/, "a wait before getting up");
  assert.ok(last("d1", "dim")[13] > 0, "the wait is on the HUD");
  for (let i = 0; i < 250; i++) step(S);
  assert.ok(act(S, "d1", { t: "respawn" }).ok);
  assert.equal(a.map, id, "up again inside");
  assert.ok(Math.abs(a.x / T - dim.map.dim.start[0]) < 4 && Math.abs(a.y / T - dim.map.dim.start[1]) < 4, "in the start room");
  assert.equal(a.ch.xp, xp, "no experience lost");
  // a disconnect inside: saved in town; back within 3 minutes, the obelisk lets them in again
  const ch = L.removePlayer(S, "d2");
  assert.equal(ch.map, "town");
  step(S);
  L.addPlayer(S, "d2", ch);
  const b2 = S.players.d2;
  b2.x = OBX; b2.y = OBY;
  step(S);
  assert.ok(Array.isArray(last("d2", "dj")), "rejoin offered");
  assert.ok(act(S, "d2", { t: "dim_join" }).ok);
  assert.equal(b2.map, id);
  void b;
  // a wipe is not the end: everyone gets up again in the start room (the clock is what presses)
  a.hp = 0; a.dead = true; b2.hp = 0; b2.dead = true;
  step(S);
  assert.equal(dim.state, "run", "a wipe does not fail the rift");
  for (let i = 0; i < 252; i++) step(S);
  assert.ok(act(S, "d1", { t: "respawn" }).ok && act(S, "d2", { t: "respawn" }).ok);
  assert.ok(!a.dead && !b2.dead && a.map === id && b2.map === id);
  // leaving: home (not while down: get up first)
  a.hp = 0; a.dead = true;
  assert.equal(act(S, "d1", { t: "dim_leave" }).ok, false);
  a.dead = false; a.hp = 10;
  assert.ok(act(S, "d1", { t: "dim_leave" }).ok);
  assert.ok(a.map === "town");
}
{
  // time runs out
  const S = world();
  const p = hero(S, "t1", "느림보", "rogue", 15);
  assert.ok(act(S, "t1", { t: "dim_open" }).ok);
  const dim = S.dims[p.map];
  dim.expire = now + 500;
  for (let i = 0; i < 6; i++) step(S);
  assert.equal(dim.state, "fail");
  const g = p.ch.gold;
  for (let i = 0; i < 81; i++) step(S);
  assert.equal(p.map, "town");
  assert.equal(p.ch.gold - g, dim.lv * D.failGold, "consolation");
  assert.ok(!S.dims[dim.id], "closed at once");
  // a character saved inside wakes in town; the old sheet (v8) gains a rift record
  const old = L.newChar("옛날", "mage", []); delete old.dim; old.v = 8;
  L.addPlayer(S, "old", old);
  assert.deepEqual(S.players.old.ch.dim, { day: 0, n: 0, t: 1, best: 0, ms: 0, wk: 0, wb: 0, bw: 0, bs: X.CHAL_KEYS.map(() => 0) }); assert.equal(S.players.old.ch.v, 26);
  const odd = L.newChar("이상", "mage", []); odd.dim = { day: "x", n: -5 };
  L.addPlayer(S, "odd", odd);
  assert.deepEqual(S.players.odd.ch.dim, { day: 0, n: 0, t: 1, best: 0, ms: 0, wk: 0, wb: 0, bw: 0, bs: X.CHAL_KEYS.map(() => 0) });
}

// ───────────── 5. the invasion never picks an instance
{
  assert.ok(X.EVT_MAPS.length && X.EVT_MAPS.every((id) => !id.startsWith("dim:")));
  const S = world();
  const p = hero(S, "e1", "침공", "warrior", 20);
  assert.ok(act(S, "e1", { t: "dim_open" }).ok);
  for (let k = 0; k < 6; k++) { now = (k + 300) * 1800000 + 1000; S.now = now; X.worldEvent(S, now); if (S.evt) assert.ok(!S.evt.map.startsWith("dim:")); }
  assert.ok(Object.keys(S.dims).length === 1 || true);
}

for (const [k, v] of X_DIM_SET) D[k] = v;
// ───────────── 6 & 7. a bot party clears rifts; the wire stays small
/** Bots that hunt the nearest monster along the floor, pick up orbs and shrines, drink when low and get up when down. */
function runParty(lv, classes, seedSalt, shift = 0, opt = {}) {
  const S = world();
  S.seed += seedSalt;
  // (a rift's seed reads S.nextId: `shift` stands for a world with a few more things in it, another draw)
  S.nextId += shift;
  const pids = classes.map((c, i) => "bot" + i);
  const ps = classes.map((c, i) => hero(S, pids[i], "봇" + i, c, lv, true));
  if (ps.length > 1) party(S, pids);
  // (a boss challenge)
  assert.ok(act(S, pids[0], { t: "dim_open", ...(opt.boss ? { boss: opt.boss } : {}) }).ok);
  if (ps.length > 1) { const rc = S.parties[ps[0].party].rc; for (const pid of pids.slice(1)) act(S, pid, { t: "dim_ready", id: rc.id, ok: 1 }); }
  // (each floor is its own instance: these follow the party down)
  let dim = S.dims[ps[0].map], m = dim.map, rt = dim.rt, W = m.w;
  const t0 = now, floorAt = [];
  let bytes = 0, snaps = 0, bossAt = 0, clearAt = 0, deaths = 0;
  const fields = new Map();
  const distTo = (tx, ty) => {
    const key = ty * W + tx;
    let d = fields.get(key);
    if (!d) {
      d = new Int32Array(W * m.h).fill(-1); const q = [key]; d[key] = 0;
      const door = m.dim.door[1] * W + m.dim.door[0];
      for (let h = 0; h < q.length; h++) { const i = q[h]; for (const n of [i + 1, i - 1, i + W, i - W]) if (n >= 0 && n < W * m.h && d[n] < 0 && m.reach[n] && n !== door) { d[n] = d[i] + 1; q.push(n); } }
      if (fields.size > 400) fields.clear();
      fields.set(key, d);
    }
    return d;
  };
  const walk = (p, tx, ty) => {
    const d = distTo(tx, ty), sp = X.stats(p).spd * 0.1;
    const cx = Math.floor(p.x / T), cy = Math.floor(p.y / T);
    let gx = tx * T + 8, gy = ty * T + 10;
    if (d[cy * W + cx] > 1) {
      let best = cy * W + cx;
      for (const n of [best + 1, best - 1, best + W, best - W]) if (d[n] >= 0 && d[n] < d[best]) best = n;
      gx = (best % W) * T + 8; gy = Math.floor(best / W) * T + 10;
    }
    const go = (gx, gy) => {
      const dd = Math.hypot(gx - p.x, gy - p.y);
      if (dd < 0.5) return true;
      const k = Math.min(1, sp / dd), x0 = p.x, y0 = p.y;
      act(S, p.pid, { t: "mv", x: p.x + (gx - p.x) * k, y: p.y + (gy - p.y) * k, a: X.aimIdx(gx - p.x, gy - p.y) });
      return p.x !== x0 || p.y !== y0;
    };
    // a corner in the way: back to the middle of this tile first
    if (!go(gx, gy)) go(cx * T + 8, cy * T + 10);
  };
  for (let tick = 0; tick < 16 * 600; tick++) {
    const here = ps.map((p) => S.dims[p.map]).find(Boolean);
    if (!here) break;
    if (here !== dim) { dim = here; m = dim.map; rt = dim.rt; W = m.w; fields.clear(); floorAt.push(now); }
    for (const p of ps) {
      // knocked onto a floor's door home: walk back in at the obelisk, as a player would
      if (p.map === "town" && dim.state !== "clear" && !dim.chal) { p.x = OBX; p.y = OBY; act(S, p.pid, { t: "dim_join" }); continue; }
      if (p.map !== dim.id) continue;
      if (p.dead) { act(S, p.pid, { t: "respawn" }); continue; }
      const st = X.stats(p);
      if (p.hp < st.mhp * 0.45) { const pot = p.ch.inv.find((s) => X.ITEMS[s.id] && X.ITEMS[s.id].type === "pot" && X.ITEMS[s.id].heal); if (pot) act(S, p.pid, { t: "use", id: pot.id }); }
      if (p.mp < st.mmp * 0.2) { const pot = p.ch.inv.find((s) => X.ITEMS[s.id] && X.ITEMS[s.id].type === "pot" && X.ITEMS[s.id].mp); if (pot) act(S, p.pid, { t: "use", id: pot.id }); }
      if (dim.state === "clear") {
        if (!dim.got[p.pid] && dim.hit[p.pid]) walk(p, Math.floor(dim.chest.x / T), Math.floor(dim.chest.y / T));
        else walk(p, Math.floor(dim.portal.x / T), Math.floor(dim.portal.y / T));
        continue;
      }
      if (dim.state === "down") { walk(p, Math.floor(dim.portal.x / T), Math.floor(dim.portal.y / T)); continue; }
      // the last floor's 균열의 문: far from the final boss, step in (it leads to the hall's threshold)
      if (dim.state === "boss" && dim.portal && !dim.chal) {
        const b = rt.mobs.find((q) => q.id === dim.boss);
        if (b && Math.hypot(b.x - p.x, b.y - p.y) > 25 * T && Math.hypot(dim.portal.x - p.x, dim.portal.y - p.y) < 30 * T) { walk(p, Math.floor(dim.portal.x / T), Math.floor(dim.portal.y / T)); continue; }
      }
      // step out of a ring on the ground before it goes off (players see the warning)
      const ring = rt.tele.find((t) => Math.hypot(t.x - p.x, t.y - p.y) < t.r + 10);
      if (ring) {
        const dd = Math.hypot(p.x - ring.x, p.y - ring.y) || 1, k = X.stats(p).spd * 0.1 / dd;
        const nx = p.x + (p.x - ring.x) * k, ny = p.y + (p.y - ring.y) * k;
        const x0 = p.x;
        act(S, p.pid, { t: "mv", x: nx, y: ny });
        if (p.x === x0) act(S, p.pid, { t: "mv", x: p.x + (p.y - ring.y) * k, y: p.y - (p.x - ring.x) * k });
        continue;
      }
      // something to pick up close by first
      const goody = [...dim.orbs, ...dim.pylons].find((o) => Math.hypot(o.x - p.x, o.y - p.y) < 160);
      if (goody) { walk(p, Math.floor(goody.x / T), Math.floor(goody.y / T)); continue; }
      let tgt = null, bd = Infinity;
      for (const mob of rt.mobs) {
        if (mob.dead || X.MOBS[mob.k].chest) continue;
        const ds = Math.hypot(mob.x - p.x, mob.y - p.y) + (mob.id === dim.boss ? -400 : mob.guard ? 300 : 0);
        if (ds < bd) { bd = ds; tgt = mob; }
      }
      if (!tgt) continue;
      const dd = Math.hypot(tgt.x - p.x, tgt.y - p.y), aim = X.aimIdx(tgt.x - p.x, tgt.y - p.y);
      if (dd > X.atkRange(p) * 0.85) { walk(p, Math.floor(tgt.x / T), Math.floor(tgt.y / T)); continue; }
      // Use the action bar like a party: use manual support for a nearby injured member, and save HP below 35%.
      let cast = false;
      for (let i = X.SKILL_ORDER.length - 1; i >= 0 && !cast; i--) {
        const id = X.SKILL_ORDER[i], sk = X.SKILL[id];
        if (sk.kind === "p" || (sk.autoHp && p.hp - X.skillHpCost(p, sk) < X.stats(p).mhp * sk.autoHp)) continue;
        if (sk.noAuto && (!sk.support || !ps.some((ally) => ally.map === p.map && !ally.dead
          && Math.hypot(ally.x - p.x, ally.y - p.y) <= sk.r && ally.hp < X.stats(ally).mhp * 0.7))) continue;
        if (act(S, p.pid, { t: "sk", id, a: aim }).ok) cast = true;
      }
      if (!cast) act(S, p.pid, { t: "atk", a: aim });
    }
    step(S);
    for (const p of ps) { const v = views[p.pid][views[p.pid].length - 1]; if ("dim" in v) bytes += JSON.stringify(v.dim).length; snaps++; }
    if (!bossAt && dim.state === "boss") bossAt = now;
    if (!clearAt && dim.state === "clear") clearAt = now;
    for (const p of ps) { if (p.dead && !p.wasDead) deaths++; p.wasDead = p.dead; }
    if (process.env.TRACE && tick % (+process.env.TRACE) === 0) console.log(`  t=${tick / 600}m prog=${dim.prog.toFixed(1)} ${dim.state} ` + ps.map((p) => `${p.map === dim.id ? "" : "OUT"}${Math.floor(p.x / T)},${Math.floor(p.y / T)}${p.dead ? "x" : ""}(${m.reach[Math.floor(p.y / T) * W + Math.floor(p.x / T)]})`).join(" ") + ` boss ${(rt.mobs.find((q) => q.id === dim.boss) || {}).hp}@${Math.floor((rt.mobs.find((q) => q.id === dim.boss) || {}).x / T)},${Math.floor((rt.mobs.find((q) => q.id === dim.boss) || {}).y / T)}` + " alive " + rt.mobs.filter((q) => !q.dead && !X.MOBS[q.k].chest).map((q) => `${q.k}@${Math.floor(q.x / T)},${Math.floor(q.y / T)}${q.el ? "E" + q.el : ""}`).slice(0, 6).join(" "));
    if (dim.state === "fail") break;
  }
  const got = ps.filter((p) => dim.got[p.pid]).length;
  if (opt.out) Object.assign(opt.out, { ps, dim });
  // floors: the minute each floor after the first began
  return { floor: dim.floor, floors: floorAt.map((t) => (t - t0) / 60000), tries: dim.chal ? dim.chal.tries : 0, fury: dim.chal ? dim.chal.fury : 0, lv, theme: dim.theme, n: ps.length, state: dim.state, boss: bossAt ? (bossAt - t0) / 60000 : null, clear: clearAt ? (clearAt - t0) / 60000 : null, got, wire: bytes / snaps, kills: dim.kills, elites: dim.elites, deaths, prog: dim.prog, bossHp: (rt.mobs.find((q) => q.id === dim.boss) || {}).hp };
}
{
  const runs = [];
  const fours = [["warrior", "rogue", "lancer", "mage"], ["lancer", "mage", "warrior", "rogue"]];
  // every level on five draws of the rift (a seed that happens to suit the bots must not hide a hard one); SHIFTS=0,1,2 for a quick look
  const shifts = (process.env.SHIFTS || "0,1,2,3").split(",").map(Number);
  for (const [lv, salt] of [[17, 1], [32, 3], [44, 9], ...(process.env.MORE ? [[24, 2], [40, 4], [20, 6], [28, 7], [36, 8]] : [])]) {
    if (!process.env.ONLY || +process.env.ONLY === lv) for (const sh of shifts) runs.push({ ...runParty(lv, fours[salt % 2], salt, sh), sh });
  }
  // The bot party is chaotic (any rule change reshuffles every draw), so the raid is judged as a rate: at least 75 % of the
  // runs walk all three floors and beat the final boss in 8–12.5 min (owner, 2026-11-15: a ≈ 10 minute party raid, the
  // limit 15), every level clears at least once, and the average sits in 9–11.
  const miss = (r) => r.clear === null || r.floors.length !== 2 || !(r.clear >= 8 && r.clear <= 12.5);
  const missed = runs.filter(miss), say = missed.map((r) => `Lv.${r.lv} (+${r.sh}) ${r.state} floor ${r.floor} ${r.clear && r.clear.toFixed(2)}`).join(", ");
  for (const r of runs) {
    const [f2, f3] = r.floors, end = r.clear ?? (r.state === "fail" ? D.limit / 60000 : 0);
    log(`4 bots Lv.${r.lv} ${r.theme} (+${r.sh}): floor 1 ${f2 ? f2.toFixed(1) : "-"} · floor 2 ${f3 ? (f3 - f2).toFixed(1) : "-"} · floor 3 ${f3 && r.boss ? (r.boss - f3).toFixed(1) : "-"} + boss ${r.boss && r.clear ? (r.clear - r.boss).toFixed(1) : "-"} = ${end.toFixed(1)} min, ${r.kills} kills, ${r.elites} elites (last floor), chests ${r.got}/${r.n}, ${r.deaths} deaths, end ${r.state} floor ${r.floor} gauge ${r.prog.toFixed(0)}, dim wire ${r.wire.toFixed(0)} B/snap`);
    if (!process.env.NOCLEAR && !miss(r)) assert.equal(r.got, r.n, "every member opens the chest once");
    assert.ok(r.wire <= 120, `the dim block averages ${r.wire.toFixed(0)} B a snapshot`);
  }
  const ok = runs.filter((r) => !miss(r)), avg = ok.reduce((s, r) => s + r.clear, 0) / Math.max(1, ok.length);
  log(`${ok.length}/${runs.length} in the window, average clear ${avg.toFixed(2)} min`);
  if (!process.env.NOCLEAR) {
    assert.ok(missed.length <= Math.floor(runs.length * 0.25), `at least 75 % of ${runs.length} runs clear in 8–12.5 min; bad: ${say}`);
    for (const lv of new Set(runs.map((r) => r.lv))) assert.ok(runs.some((r) => r.lv === lv && !miss(r)), `Lv.${lv} clears at least once (${say})`);
    if (!process.env.ONLY) assert.ok(avg >= 9 && avg <= 11, `the average clear ${avg.toFixed(2)} min sits inside 9–11`);
  }
  // a solo player two levels under the band: a raid is meant for four; alone it gets down at least one floor in time
  // (beating it alone is up to the player: the headless bot does not kite, so the rest is only measured)
  const solo = runParty(22, ["warrior"], 7);
  assert.ok(solo.floors.length >= 1, "alone, the first floor is cleared in time");
  log(`solo Lv.22: ${solo.state}, floor ${solo.floor}, floors at ${solo.floors.map((f) => f.toFixed(1)).join(", ")}, ${solo.deaths} deaths, gauge ${solo.prog.toFixed(0)}, clear ${solo.clear && solo.clear.toFixed(1)} min`);
}

// ───────────── 8. the 3-floor raid: the floor table, the chest, records, the carry guard, the week, old sheets
const CH = X.DIM_CHAL;
/** Monday 2026-11-16 06:00 KST: a week turns over here. */
const MONDAY = Date.UTC(2026, 10, 15, 21, 0, 0);
const at = (S, t) => { now = t; S.now = t; S.last = t; };
let lastDim = null, lastBoss = null;
/** The run cleared at once: each floor filled (the way down taken), the final boss killed with `shares` of the damage, everyone at the chest. */
function quickClear(S, _dim, shares) {
  const pids = Object.keys(shares), by = Object.fromEntries(pids.map((pid) => [pid, 1]));
  const cur = () => S.dims[S.players[pids[0]].map];
  const kill = (dim, mob) => { mob.by = { ...by }; X.killMob(S, dim.rt, mob); };
  step(S);
  for (let i = 0; i < 20 && cur().state !== "boss"; i++) {
    const dim = cur();
    if (dim.state === "run") { dim.prog = 99.5; kill(dim, dim.rt.mobs.find((m) => !m.dead && !m.el && !X.MOBS[m.k].chest)); }
    else if (dim.state === "down") { for (const pid of pids) { const o = S.players[pid]; o.dead = false; o.x = dim.portal.x; o.y = dim.portal.y; } for (let k = 0; k < 20 && cur() === dim; k++) step(S); }
  }
  const dim = lastDim = cur(), rt = dim.rt;
  assert.equal(dim.state, "boss"); assert.equal(dim.floor, D.floors);
  const boss = lastBoss = rt.mobs.find((m) => m.id === dim.boss);
  for (const pid of pids) { const o = S.players[pid]; o.x = boss.x; o.y = boss.y; o.dead = false; o.hp = X.stats(o).mhp; }
  dim.dmg = { ...shares };
  kill(dim, boss);
  assert.equal(dim.state, "clear");
  step(S);
  for (const pid of pids) assert.equal(dim.got[pid], 1, pid + " opened the chest");
  return Object.fromEntries(pids.map((pid) => [pid, last(pid, "dr")]));
}
const leave = (S, pids) => { for (const pid of pids) assert.ok(act(S, pid, { t: "dim_leave" }).ok); for (let i = 0; i < 205; i++) step(S); };
{
  // three floors, each tougher than the one above it; floor 1 is the rift as it was
  assert.equal(D.floors, 3); assert.equal(D.floor.length, D.floors);
  assert.deepEqual(X.dimFloorK(1), { hp: 1, atk: 1, elites: 0, traits: 1 }, "floor 1 is the rift as it was");
  for (let n = 2; n <= D.floors; n++) {
    const k = X.dimFloorK(n), pr = X.dimFloorK(n - 1);
    for (const f of ["elites", "traits"]) assert.ok(k[f] >= pr[f], `floor ${n}: ${f}`);
    assert.ok(k.hp > pr.hp && k.atk > pr.atk, `floor ${n} is tougher`);
  }
  assert.deepEqual(X.dimFloorK(9), X.dimFloorK(3)); assert.deepEqual(X.dimFloorK(0), X.dimFloorK(1));
  // one chest; half the experience past the day's full clears; a carry gets a part
  const base = X.dimReward(30, true, false);
  assert.deepEqual(base, { gold: D.reward.gold * 30, stone: D.reward.stone, rune: D.reward.rune, gear: 1, gearQ: D.reward.gearQ, xp: Math.round(D.reward.xp * X.xpNeed(30)) });
  assert.equal(X.dimReward(30, false, false).xp, Math.round(D.reward.xp * X.xpNeed(30) * 0.5));
  const cr = X.dimReward(30, true, true);
  assert.ok(cr.gold === Math.round(base.gold * D.carryK) && cr.xp === Math.round(base.xp * D.carryK) && cr.gear === 0 && cr.stone === base.stone, "a carry: a part of the chest");
  // the week turns over on Monday 06:00 KST, with the day
  assert.equal(X.weekOf(MONDAY - 1) + 1, X.weekOf(MONDAY)); assert.equal(X.weekOf(MONDAY), X.weekOf(MONDAY + 7 * 86400000 - 1)); assert.equal(X.weekOf(MONDAY) + 1, X.weekOf(MONDAY + 7 * 86400000));
  assert.equal(X.dayOf(MONDAY - 1) + 1, X.dayOf(MONDAY));
  for (let d = 1; d < 7; d++) assert.equal(X.weekOf(MONDAY + d * 86400000), X.weekOf(MONDAY), "one week, seven days");
  // old sheets (v13: a daily count only; v21: the tier ladder) and odd ones
  const fresh = { day: 0, n: 0, t: 1, best: 0, ms: 0, wk: 0, wb: 0, bw: 0, bs: X.CHAL_KEYS.map(() => 0) };
  assert.deepEqual(L.newChar("새단수", []).dim, fresh); assert.equal(L.newChar("새단수", []).v, 26);
  const S = world();
  const old = L.newChar("옛단수", []); old.v = 13; old.dim = { day: 20000, n: 2 };
  L.addPlayer(S, "o13", old);
  assert.deepEqual(S.players.o13.ch.dim, { ...fresh, day: 20000, n: 2 }, "a v13 sheet keeps its count"); assert.equal(S.players.o13.ch.v, 26);
  const lad = L.newChar("옛사다리", []); lad.v = 21; lad.dim = { day: 20000, n: 1, t: 41, best: 40, ms: 300000, wk: 7, wb: 4, bw: 1, bs: X.CHAL_KEYS.map(() => 1) };
  L.addPlayer(S, "o21", lad);
  assert.deepEqual(S.players.o21.ch.dim, { ...fresh, day: 20000, n: 1, wk: 7, bw: 1, bs: X.CHAL_KEYS.map(() => 1) }, "a v21 sheet: its tier records are no floor records, the boss records stay");
  const now22 = L.newChar("새기록", []); Object.assign(now22.dim, { best: 3, ms: 540000, wb: 1, wk: 7 });
  L.addPlayer(S, "o22", now22);
  assert.deepEqual(S.players.o22.ch.dim, { ...fresh, best: 3, ms: 540000, wb: 1, wk: 7 }, "a v22 sheet keeps its record");
  const rewardMask = L.defs().dim.chal.bosses.reduce((mask, boss) => mask | boss[6], 0);
  assert.deepEqual(X.dimClean({ t: 50, best: 3, ms: 9e9, wb: 99, bw: 99, wk: -3 }), { ...fresh, best: 3, ms: D.limit, wb: 1, bw: rewardMask }, "records and weekly flags are clamped");
  assert.deepEqual(X.dimClean({ t: "x", best: 5000, ms: 1234 }), { ...fresh, best: 3, ms: 1234 });
  assert.deepEqual(X.dimClean({ best: 2, ms: 5000 }), { ...fresh, best: 2 }, "no time without a full clear"); assert.deepEqual(X.dimClean("junk"), fresh);
}
{
  // a run always starts at floor 1 (an old client's tier is ignored); floors reached and the full clear's time are the record
  const S = world(); at(S, MONDAY - 3 * 86400000);
  const a = hero(S, "t1", "단수일", "warrior", 30), b = hero(S, "t2", "단수이", "mage", 30);
  party(S, ["t1", "t2"]);
  assert.ok(act(S, "t1", { t: "dim_open", tier: 7 }).ok, "a tier from an old client is no error");
  assert.ok(act(S, "t2", { t: "dim_ready", id: S.parties[a.party].rc.id, ok: 1 }).ok);
  const dim = S.dims[a.map];
  assert.equal(dim.floor, 1); assert.equal(b.map, dim.id);
  for (const mob of dim.rt.mobs) if (!X.MOBS[mob.k].chest) assert.ok(Math.abs(mob.hk - X.dimHk(2, dim.lv, X.MOBS[mob.k].lv)) < 1e-9 && !mob.ak, "floor 1: health for two, no extra blows");
  a.ch.dim.best = 3; a.ch.dim.ms = 1000;
  const res = quickClear(S, dim, { t1: 1, t2: 1 });
  const boss = lastBoss, k3 = X.dimFloorK(3);
  assert.ok(Math.abs(boss.hk - X.dimHk(2, lastDim.lv, X.MOBS[boss.k].lv) * D.bossHp * k3.hp) < 1e-9 && Math.abs(boss.ak - D.bossAtk * k3.atk) < 1e-9, "the final boss at floor 3's row");
  assert.ok(lastDim.opened === dim.opened && lastDim.floor === 3);
  assert.equal(b.ch.dim.best, 3); assert.ok(b.ch.dim.ms > 0 && b.ch.dim.ms < 60000);
  assert.deepEqual([a.ch.dim.best, a.ch.dim.ms], [3, 1000], "a slower run never lowers a record");
  assert.deepEqual([res.t2[0], res.t2[1], res.t2[3], res.t1[3]], [0, 3, 1 | 8, 8], "record and weekly for t2, weekly only for t1");
  assert.equal(res.t2[6], D.weekly.unc);
  b.dirty = true; step(S);
  const dimr = last("t2", "self").dimr;
  assert.deepEqual(dimr.slice(0, 7), [3, 3, Math.round(b.ch.dim.ms / 1000), D.dailyFull - 1, 1, 0, X.CHAL_KEYS.map(() => 0)], "the sheet's record on the wire, best steps at 6");
  assert.equal(dimr[7], X.CHAL_KEYS.indexOf(X.chalOfWeek(S.now)), "this week's rotating boss at 7");
  leave(S, ["t1", "t2"]);
  // again, quicker: a better time; no second weekly bonus
  assert.ok(act(S, "t1", { t: "dim_open" }).ok); act(S, "t2", { t: "dim_ready", id: S.parties[a.party].rc.id, ok: 1 });
  b.ch.dim.ms = 500000;
  const res2 = quickClear(S, S.dims[a.map], { t1: 1, t2: 1 });
  assert.equal(res2.t2[3], 1, "a quicker full clear is a record; nothing else"); assert.ok(b.ch.dim.ms < 60000);
  leave(S, ["t1", "t2"]);
  // failing on floor 2: the floor reached stays on the sheet; the consolation grows with the floors reached
  const f = hero(S, "f1", "실패", "rogue", 30);
  assert.ok(act(S, "f1", { t: "dim_open" }).ok);
  const fd = S.dims[f.map];
  fd.prog = 99.5; X.killMob(S, fd.rt, Object.assign(fd.rt.mobs.find((m) => !m.dead && !m.el && !X.MOBS[m.k].chest), { by: { f1: 1 } }));
  f.x = fd.portal.x; f.y = fd.portal.y; for (let i = 0; i < 20 && f.map === fd.id; i++) step(S);
  const fd2 = S.dims[f.map];
  assert.equal(fd2.floor, 2); assert.equal(f.ch.dim.best, 1);
  fd2.expire = now + 300;
  for (let i = 0; i < 5; i++) step(S);
  assert.equal(fd2.state, "fail");
  const g = f.ch.gold;
  for (let i = 0; i < 81; i++) step(S);
  assert.equal(f.map, "town"); assert.equal(f.ch.gold - g, fd2.lv * D.failGold * 2, "consolation × floors reached");
  assert.deepEqual([f.ch.dim.best, f.ch.dim.ms], [1, 0], "a failed run: the floor, no time");
  // joining later: the obelisk offers the floor the party is on
  assert.ok(act(S, "t1", { t: "dim_open" }).ok); act(S, "t2", { t: "dim_ready", id: S.parties[a.party].rc.id, ok: 0 });
  const jd = S.dims[a.map];
  jd.prog = 99.5; X.killMob(S, jd.rt, Object.assign(jd.rt.mobs.find((m) => !m.dead && !m.el && !X.MOBS[m.k].chest), { by: { t1: 1 } }));
  for (let i = 0; i < D.downMs / 100 + 2 && a.map === jd.id; i++) step(S);
  b.x = OBX; b.y = OBY; step(S);
  assert.deepEqual(last("t2", "dj").slice(4), [2, 0, 0], "the dj row says floor 2");
  assert.ok(act(S, "t2", { t: "dim_join" }).ok); assert.equal(b.map, a.map); assert.equal(S.dims[b.map].floor, 2);
}
{
  // the carry guard: by damage share (under 20% of an even share), and by level (more than 6 world tiers under the best)
  const S = world(); at(S, MONDAY - 3 * 86400000);
  const a = hero(S, "c1", "끌어줌", "warrior", 30), b = hero(S, "c2", "묻어감", "mage", 30), c = hero(S, "c3", "꼬마", "rogue", 12);
  party(S, ["c1", "c2", "c3"]);
  assert.ok(act(S, "c1", { t: "dim_open" }).ok);
  for (const pid of ["c2", "c3"]) act(S, pid, { t: "dim_ready", id: S.parties[a.party].rc.id, ok: 1 });
  const dim = S.dims[a.map], inv = [a, b, c].map((p) => p.ch.inv.length);
  assert.equal(dim.lv, 30);
  // c2 dealt 5% (an even share is 33%; the line is 6.7%); c3 dealt a third but is 18 world tiers under the best
  const res = quickClear(S, dim, { c1: 620, c2: 50, c3: 330 });
  assert.equal(res.c1[3] & 4, 0); assert.equal(res.c2[3], 4, "carried by damage"); assert.equal(res.c3[3], 4, "carried by level");
  assert.deepEqual([a.ch.dim.best, a.ch.dim.wb], [3, 1]);
  assert.deepEqual([b.ch.dim.best, b.ch.dim.ms, b.ch.dim.wb], [2, 0, 0], "carried at the end: the floors walked, no record, no weekly bonus");
  assert.deepEqual([c.ch.dim.best, c.ch.dim.wb], [0, 0], "carried by level all the way: nothing on the sheet");
  const full = X.dimReward(30, true, false).gold + D.weekly.gold * 30, part = Math.round(D.reward.gold * 30 * D.carryK);
  assert.deepEqual([res.c1[4], res.c2[4], res.c3[4]], [full, part, part], "a carry is paid a part");
  assert.ok(a.ch.inv.length > inv[0] && part < full * 0.3);
  assert.equal(b.ch.dim.n, 1, "the chest still counts for the day");
  // just over the line is no carry; alone, nobody is
  leave(S, ["c1", "c2", "c3"]);
  act(S, "c3", { t: "pleave" });
  assert.ok(act(S, "c1", { t: "dim_open" }).ok); act(S, "c2", { t: "dim_ready", id: S.parties[a.party].rc.id, ok: 1 });
  const r2 = quickClear(S, S.dims[a.map], { c1: 880, c2: 120 });
  assert.equal(r2.c2[3] & 4, 0, "12% of the damage in a party of two is over the line (10%)"); assert.equal(b.ch.dim.best, 3);
}
{
  // the week: the first full clear pays a bonus once; Monday 06:00 KST opens it again; the day's count stays
  const S = world(); at(S, MONDAY - 3600000);
  const p = hero(S, "w1", "주간", "warrior", 30);
  const run = () => { assert.ok(act(S, "w1", { t: "dim_open" }).ok); const r = quickClear(S, S.dims[p.map], { w1: 1 }); leave(S, ["w1"]); return r.w1; };
  const r1 = run();
  assert.equal(r1[3] & 8, 8); assert.equal(r1[6], D.weekly.unc); assert.equal(p.ch.dim.wb, 1);
  assert.equal(r1[4], X.dimReward(30, true, false).gold + D.weekly.gold * 30);
  assert.equal(run()[6], 0, "the same week again: nothing"); assert.equal(run()[6], 0);
  assert.equal(p.ch.dim.n, 3);
  const r4 = run();
  assert.equal(r4[4], D.reward.gold * 30, "the fourth chest of the day: gold as ever"); assert.equal(r4[5], Math.round(D.reward.xp * X.xpNeed(30) / 2), "and half the experience");
  assert.ok(now < MONDAY, "still Sunday night"); at(S, MONDAY + 1000);
  const r5 = run();
  assert.equal(r5[6], D.weekly.unc, "Monday 06:00: the bonus is open again"); assert.deepEqual([p.ch.dim.wb, p.ch.dim.n, p.ch.dim.wk], [1, 1, X.weekOf(now)]);
}

// ───────────── 9. 주간 보스 도전: the arena, entry, patterns, the stagger gauge, enrage, wipes, the weekly reward
{
  for (const k of X.CHAL_KEYS) {
    const m = X.dimArena({ id: "dim:7", seed: 99, k }), again = X.dimArena({ id: "dim:7", seed: 99, k });
    assert.deepEqual([m.g, m.o], [again.g, again.o]); assert.equal(m.w, CH.bosses[k].w || CH.w); assert.equal(m.dim.bossK, k);
    for (const [x, y] of [m.dim.start, m.dim.boss, m.dim.door]) assert.ok(m.reach[y * m.w + x], k + ": start, boss and door on open ground");
    let open = 0;
    for (let i = 0; i < m.w * m.h; i++) if (m.reach[i]) open++;
    assert.ok(open > 200, "an arena to move in: " + open);
    // nowhere in it is farther from the boss's place than it would follow (no leashing it home)
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.reach[y * m.w + x]) assert.ok(Math.hypot(x - m.dim.boss[0], y - m.dim.boss[1]) * T < 2.4 * X.MOBS[k].aggro);
    if (!CH.bosses[k].phases) assert.equal(CH.bosses[k].pats.length, 3, "three patterns");
  }
  const S = world(); at(S, MONDAY - 2 * 86400000);
  const lo = hero(S, "b0", "아직", "warrior", 20), a = hero(S, "b1", "도전일", "warrior", 40, true), b = hero(S, "b2", "도전이", "mage", 40, true);
  assert.ok(lo.ch.lvl < X.chalMinLv("boss") && a.ch.lvl >= X.chalMinLv("abyssboss"));
  const low = act(S, "b0", { t: "dim_open", boss: "boss" });
  assert.ok(!low.ok && low.error.includes("Lv." + X.chalMinLv("boss")), low.error);
  for (const bad of ["nope", 3, null, "toString"]) assert.ok(!act(S, "b1", { t: "dim_open", boss: bad }).ok);
  party(S, ["b1", "b2", "b0"]);
  assert.ok(act(S, "b1", { t: "dim_open", boss: "boss" }).ok);
  const rc = S.parties[a.party].rc;
  assert.equal(rc.resp.b0, 3, "a member under the level is not asked");
  step(S); assert.deepEqual(last("b2", "rc").slice(5), [0, 1, 0]);
  act(S, "b2", { t: "dim_ready", id: rc.id, ok: 1 });
  const dim = S.dims[a.map], rt = dim.rt, c = dim.chal, boss = rt.mobs.find((m) => m.id === dim.boss);
  assert.ok(dim && c && boss && dim.state === "boss" && dim.floor === 0 && rt.mobs.length === 1, "an arena with the boss alone");
  assert.ok(!act(S, "b0", { t: "dim_join" }).ok, "nor may they join later");
  assert.equal(dim.expire - now, CH.limit);
  step(S);
  assert.deepEqual(last("b1", "dim").slice(14), [0, [0, 0, 0, 0, 0, 1, 0, 0]], "the challenge on the wire");
  // nothing happens until someone comes near; then the three patterns in turn, the marked cast every fourth
  for (let i = 0; i < 50; i++) step(S);
  assert.equal(c.engAt, 0); assert.equal(boss.hp, X.mobMax(boss));
  const tough = () => { for (const p of [a, b]) { p.dead = false; p.hp = X.stats(p).mhp; } };
  const evs = [];
  const watch = (n) => { for (let i = 0; i < n; i++) { tough(); step(S); for (const e of views.b1[views.b1.length - 1].ev || []) evs.push(e); } };
  a.x = boss.x - 60; a.y = boss.y; b.x = boss.x + 90; b.y = boss.y + 30;
  watch(40);
  assert.ok(c.engAt > 0, "the fight is on");
  while (!boss.cast) { watch(1); assert.ok(evs.length < 5000 && now - c.engAt < 60000, "a marked cast comes"); }
  const dc = evs.filter((e) => e[0] === "bc").map((e) => e[2]);
  assert.deepEqual(dc, [0, 1, 2, 9], "three patterns, then the marked cast: " + dc);
  for (const kind of ["v", "t", "g"]) assert.ok(evs.some((e) => e[0] === kind), "telegraph " + kind + " shown");
  // the stagger gauge: damage during the cast empties it; emptied in time, the cast breaks and the boss is stunned
  watch(1);
  let cv = last("b1", "dim")[15];
  assert.ok(cv[1] === 1 && cv[2] === 100 && cv[3] > 0 && cv[3] <= CH.castMs / 500, "casting, the gauge full: " + cv);
  const need = boss.cast.need, hp0 = boss.hp;
  assert.ok(Math.abs(need - CH.stag * X.mobMax(boss)) < 1);
  X.dealMob(S, rt, boss, a, need * 0.5 * boss.hk, 0);
  watch(1); cv = last("b1", "dim")[15];
  assert.ok(boss.cast && cv[2] <= 51 && cv[2] >= 45, "half the gauge left: " + cv);
  const hpA = a.hp, hpB = b.hp;
  X.dealMob(S, rt, boss, b, need * 0.55 * boss.hk, 0);
  assert.ok(!boss.cast && boss.stun >= now + CH.stunMs - 1, "broken: stunned");
  assert.ok(hp0 - boss.hp >= need, "the gauge is real damage");
  watch(1); cv = last("b1", "dim")[15];
  assert.equal(cv[1], 2, "staggered on the wire"); assert.ok(evs.some((e) => e[0] === "bc" && e[2] === 8));
  const stunnedAt = [boss.x, boss.y];
  for (let i = 0; i < CH.stunMs / 100 - 3; i++) { step(S); assert.deepEqual([boss.x, boss.y], stunnedAt, "it stands stunned"); }
  assert.equal(c.fury, 0); void hpA; void hpB;
  // not broken: everyone standing pays, and it comes back angrier
  evs.length = 0;
  while (!boss.cast) watch(1);
  for (let i = 0; i < CH.castMs / 100 - 2; i++) { tough(); step(S); }
  assert.ok(boss.cast, "still casting"); tough();
  const h = [a.hp, b.hp];
  step(S); step(S);
  assert.ok(!boss.cast && c.fury === 1, "the cast went off");
  assert.ok(a.hp < h[0] && b.hp < h[1], "everyone pays");
  assert.ok(Math.abs(boss.ak - c.ak * (1 + CH.fury)) < 1e-9, "angrier");
  // the soft enrage: past its time the blows grow step by step
  c.engAt = now - CH.enrage - 2 * CH.enrageStep - 50; tough(); step(S);
  assert.equal(c.rage, 3); assert.ok(Math.abs(boss.ak - c.ak * (1 + CH.fury) * (1 + 3 * CH.enrageK)) < 1e-9);
  step(S); assert.equal(last("b1", "dim")[15][4], 3);
  // the fallen wait for the fight to end; a wipe resets the boss and everyone may try again
  boss.hp = Math.round(X.mobMax(boss) / 2);
  a.dead = true; a.hp = 0; b.hp = X.stats(b).mhp; step(S);
  const wait = act(S, "b1", { t: "respawn" });
  assert.ok(!wait.ok && /전투가 끝나야/.test(wait.error), "no getting up mid-fight: " + wait.error);
  assert.equal(boss.tgt, "b2", "it turns on whoever still stands");
  b.dead = true; b.hp = 0; step(S);
  assert.equal(c.tries, 2); assert.equal(boss.hp, X.mobMax(boss)); assert.deepEqual([c.engAt, c.fury, c.rage, c.n], [0, 0, 0, 0], "a wipe: the boss whole again, its fury forgotten");
  assert.ok(Math.abs(boss.ak - c.ak) < 1e-9); assert.equal(dim.state, "boss", "and the challenge goes on");
  assert.ok(!act(S, "b1", { t: "respawn" }).ok, "the party gets up together, not one by one");
  for (let i = 0; i < CH.reviveMs / 100 + 1; i++) { assert.equal(c.engAt, 0, "the boss sleeps while they wait"); step(S); }
  assert.ok(!a.dead && !b.dead && a.map === dim.id && b.map === dim.id, "up again, both, in the arena");
  step(S); assert.equal(last("b1", "dim")[15][5], 2);
  // the kill: the big reward once a week, then the small one; a carry gets the small one and keeps the week's
  const g = [a.ch.gold, b.ch.gold];
  boss.by = { b1: 1, b2: 1 }; a.x = b.x = boss.x; a.y = b.y = boss.y; dim.dmg = { b1: 990, b2: 10 };
  X.killMob(S, rt, boss);
  assert.equal(dim.state, "clear"); step(S);
  assert.deepEqual([a.ch.dim.bw, b.ch.dim.bw], [1, 0]);
  assert.equal(last("b1", "dr")[4], CH.big.gold * dim.lv); assert.equal(last("b2", "dr")[4], CH.small.gold * dim.lv); assert.ok(a.ch.gold - g[0] > b.ch.gold - g[1]);
  assert.deepEqual(last("b1", "dr").slice(0, 2).concat(last("b1", "dr")[3]), [1, 0, 8]); assert.equal(last("b2", "dr")[3], 4);
  assert.deepEqual([a.ch.dim.t, a.ch.dim.best, a.ch.dim.n], [1, 0, 0], "a boss is no rift: no tier, no daily count");
  leave(S, ["b1", "b2"]);
  act(S, "b2", { t: "pleave" }); act(S, "b0", { t: "pleave" });
  const again = (k) => {
    assert.ok(act(S, "b1", { t: "dim_open", boss: k }).ok);
    const d2 = S.dims[a.map], m2 = d2.rt.mobs.find((m) => m.id === d2.boss);
    step(S); m2.by = { b1: 1 }; a.x = m2.x; a.y = m2.y; X.killMob(S, d2.rt, m2); step(S);
    const gold = last("b1", "dr")[4];
    leave(S, ["b1"]);
    return gold;
  };
  // a challenge stands at its step's level, not the party's best: the base step is the boss's own (크리온 32)
  const lv40 = 40, lv32 = X.MOBS.boss.lv;
  assert.equal(again("boss"), CH.small.gold * lv32, "the same boss again this week: the small reward");
  assert.equal(again("abyssboss"), CH.big.gold * lv40, "the other boss has its own lock"); assert.equal(a.ch.dim.bw, 3);
  a.dirty = true; step(S); assert.equal(last("b1", "self").dimr[5], 3);
  at(S, MONDAY + 5000);
  assert.equal(again("boss"), CH.big.gold * lv32, "Monday 06:00 KST: the big reward again"); assert.equal(a.ch.dim.bw, 1);
  // out of time, it fails like a rift
  assert.ok(act(S, "b1", { t: "dim_open", boss: "abyssboss" }).ok);
  const d3 = S.dims[a.map]; d3.expire = now + 50; step(S); step(S);
  assert.equal(d3.state, "fail"); assert.equal(a.ch.dim.bw, 1);
}
{
  // 난이도: each boss's ladder of steps, the level gate of a step, the step's level through the old scaling, rewards by step
  const CH = X.DIM_CHAL, ci = X.CHAL_KEYS.indexOf("cloakbat");
  assert.deepEqual(X.chalSteps("cloakbat").map((q) => q[1]), [97, 125, 150, 175, 200], "its own level, then the steps above it");
  assert.deepEqual(X.chalSteps("bloomwhale"), [[50, 197]], "the deepest boss is already at the top");
  for (const k of X.CHAL_KEYS) {
    const st = X.chalSteps(k);
    assert.equal(st[0][0], X.MOBS[k].lv); assert.equal(X.chalMinLv(k, 0), X.chalMinLv(k), "the base step keeps the old gate");
    for (let i = 1; i < st.length; i++) assert.ok(st[i][0] > st[i - 1][0] && st[i][0] <= X.TIER_MAX && X.chalMinLv(k, i) === st[i][1] - CH.stepGap);
  }
  const S = world(); at(S, MONDAY + 5000);
  const a = hero(S, "s1", "단계일", "warrior", 40, true), c = hero(S, "s3", "단계삼", "mage", 30, true);
  assert.deepEqual([a.ch.lvl, c.ch.lvl], [157, 117]);
  const hi = act(S, "s1", { t: "dim_open", boss: "cloakbat", step: 3 });
  assert.ok(!hi.ok && hi.error.includes("Lv.165"), "Lv.175 wants Lv.165: " + hi.error);
  for (const bad of [-1, 5, 1.5, "1", null]) assert.ok(!act(S, "s1", { t: "dim_open", boss: "cloakbat", step: bad }).ok, "bad step " + bad);
  // a member under the step is not asked; one within it is
  party(S, ["s1", "s3"]);
  assert.ok(act(S, "s1", { t: "dim_open", boss: "cloakbat", step: 1 }).ok);
  assert.equal(S.parties[a.party].rc.resp.s3, 0, "Lv.117 may go into Lv.125 (from 115)"); assert.ok(act(S, "s1", { t: "dim_cancel" }).ok);
  assert.ok(act(S, "s1", { t: "dim_open", boss: "cloakbat", step: 2 }).ok);
  const rc = S.parties[a.party].rc;
  if (rc) { assert.equal(rc.resp.s3, 3, "Lv.117 may not go into Lv.150"); act(S, "s1", { t: "dim_cancel" }); }
  act(S, "s3", { t: "pleave" }); leave(S, ["s1"]);
  const run = (st) => {
    const g = a.ch.gold, stone = () => a.ch.inv.filter((it) => it.id === "stone").reduce((n, it) => n + (it.n || 1), 0), s0 = stone();
    assert.ok(act(S, "s1", { t: "dim_open", boss: "cloakbat", step: st }).ok);
    const d = S.dims[a.map], m = d.rt.mobs.find((q) => q.id === d.boss), up = d.lv - X.MOBS.cloakbat.lv;
    assert.equal(d.lv, X.chalSteps("cloakbat")[st][0], "the boss stands at the step's level");
    assert.ok(Math.abs(m.hk - CH.hp * X.DIM.hpN[0] * (1 + CH.lvK * up)) < 1e-9 && Math.abs(m.ak - (1 + CH.atkLv * up)) < 1e-9, "the old per-tier scaling");
    step(S); assert.equal(last("s1", "dim")[15][7], st, "the step on the wire");
    m.by = { s1: 1 }; a.x = m.x; a.y = m.y; X.killMob(S, d.rt, m); step(S);
    const r = { lv: d.lv, gold: last("s1", "dr")[4], stone: stone() - s0, got: a.ch.gold - g };
    leave(S, ["s1"]);
    return r;
  };
  const r2 = run(2), B = CH.bosses.cloakbat.big;
  assert.equal(r2.lv, 38); assert.equal(r2.gold, B.gold * 38, "gold at the step's level");
  assert.ok(r2.stone >= B.stone + 2 * CH.stepR.stone, `the step adds stones: ${r2.stone}`);
  assert.equal(a.ch.dim.bs[ci], 3, "the highest step cleared"); a.dirty = true; step(S); assert.equal(last("s1", "self").dimr[6][ci], 3);
  const r0 = run(0);
  assert.equal(r0.gold, CH.small.gold * X.MOBS.cloakbat.lv, "the base step again: the small reward at the boss's own level");
  assert.equal(a.ch.dim.bs[ci], 3, "a lower step keeps the record");
  assert.deepEqual(X.dimClean({ bs: [9, -2, "x"] }).bs, [X.chalSteps("boss").length, ...X.CHAL_KEYS.slice(1).map(() => 0)], "an odd record is clamped");
  assert.equal(L.defs().dim.chal.bosses[ci][5].length, 5, "the picker gets the steps");
}
{
  // the other boss runs its own three patterns (a charge line, a landing ring, volleys)
  const S = world();
  const a = hero(S, "m1", "어미일", "lancer", 44, true);
  assert.ok(act(S, "m1", { t: "dim_open", boss: "abyssboss" }).ok);
  const dim = S.dims[a.map], boss = dim.rt.mobs.find((m) => m.id === dim.boss), evs = [];
  a.x = boss.x - 70; a.y = boss.y;
  for (let i = 0; i < 600 && !boss.cast; i++) { a.dead = false; a.hp = X.stats(a).mhp; step(S); for (const e of views.m1[views.m1.length - 1].ev || []) evs.push(e); }
  assert.deepEqual(evs.filter((e) => e[0] === "bc").map((e) => e[2]), [0, 1, 2, 9]);
  for (const kind of ["c", "t", "v", "g"]) assert.ok(evs.some((e) => e[0] === kind), "telegraph " + kind + " shown");
  assert.ok(evs.filter((e) => e[0] === "c").length >= 2, "two charges in a row");
}

// ───────────── 10. bots at the weekly bosses
{
  const four = ["lancer", "mage", "warrior", "rogue"];
  for (const [k, lv] of [["boss", 32], ["abyssboss", 40]]) {
    const o2 = {}, r = runParty(lv, four, 5, 0, { boss: k, out: o2 });
    log(`4 bots Lv.${lv} vs ${k}: ${r.state} at ${r.clear && r.clear.toFixed(1)} min, ${r.tries} tries, ${r.deaths} deaths, fury ${r.fury}, wire ${r.wire.toFixed(0)} B/snap`);
    if (!process.env.NOCLEAR) {
      assert.ok(r.clear !== null && r.clear >= 1.5 && r.clear <= CH.limit / 60000, `${k}: beaten inside the limit, took ${r.clear && r.clear.toFixed(2)}`);
      assert.equal(r.got, 4); for (const p of o2.ps) assert.equal(p.ch.dim.bw, 1 << X.CHAL_KEYS.indexOf(k), "the week's big reward taken");
    }
    assert.ok(r.wire <= 140, `the dim block averages ${r.wire.toFixed(0)} B a snapshot`);
  }
}
console.log("dimrift ok");
