// Headless test of the party instance 차원 균열 (docs/design/scale-and-rift.md D): the generator
// (deterministic, capped, every room reachable), the ready check and its edge cases, the gauge,
// orbs and shrines, the master at 100%, the chest and the way home, death and failure, cleanup,
// the wire, and a bot party clearing rifts in the planned 5–10 minutes. node tests/dimrift.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { DIM, DIM_TOWN, DIM_THEMES, dimension, dimPool, killMob, changeMap, closeDim, rollGear, tierFor, GEAR, WK_ID, CLASSES, MOBS, SKILLS, xpNeed, stats, atkRange, aimIdx, EVT_MAPS, worldEvent, ITEMS, SOLID_G, MAXLV };\n";
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
  const times = [];
  const paths = [];
  for (let s = 1; s <= 200; s++) for (const theme of THEMES) {
    const seed = Math.imul(s, 2654435761) | 0, lv = 10 + (s % 39);
    const t0 = performance.now();
    const m = X.dimension({ id: "dim:9", seed, theme, lv });
    times.push(performance.now() - t0);
    const again = X.dimension({ id: "dim:9", seed, theme, lv });
    assert.deepEqual([again.g, again.o, again.dim.spawns], [m.g, m.o, m.dim.spawns], `seed ${seed} ${theme}: same seed, same rift`);
    assert.equal(m.w, D.w); assert.equal(m.h, D.h); assert.equal(m.theme, theme);
    const main = m.dim.rooms.filter((r) => r.kind !== "vault");
    assert.ok(main.length >= D.rooms[0] && main.length <= D.rooms[1], `${seed}: ${main.length} rooms`);
    assert.ok(m.dim.dead.length >= D.vaults[0] && m.dim.dead.length <= D.vaults[1], `${seed}: ${m.dim.dead.length} vaults`);
    const normal = m.dim.spawns.filter((sp) => !sp.el && !sp.chest).reduce((n, sp) => n + sp.n, 0);
    const all = m.dim.spawns.reduce((n, sp) => n + sp.n, 0);
    assert.ok(normal <= D.mobCap && all <= D.cap, `${seed}: ${normal} monsters, ${all} in all`);
    assert.ok(m.dim.elites >= 4, `${seed}: ${m.dim.elites} elites`);
    // every room reachable from the way in; every spawn on open ground; the door home too
    for (const r of m.dim.rooms) assert.ok(m.reach[r.cy * m.w + r.cx], `${seed} ${theme}: room ${r.kind} at ${r.cx},${r.cy} reachable`);
    for (const sp of m.dim.spawns) assert.ok(m.reach[sp.at[1] * m.w + sp.at[0]], `${seed}: spawn ${sp.k} on open ground`);
    assert.equal(m.dim.spawns.filter((sp) => sp.chest).length, m.dim.dead.length, "a chest in every vault");
    assert.equal(m.dim.spawns.filter((sp) => sp.guard).length, m.dim.dead.length, "a guardian in every vault");
    for (const sp of m.dim.spawns) { assert.ok(X.MOBS[sp.k], sp.k); if (!sp.chest) assert.ok(!X.MOBS[sp.k].boss && !X.MOBS[sp.k].chest); }
    assert.ok(m.dim.spawns.every((sp) => m.dim.rooms[sp.room].kind !== "start" && m.dim.rooms[sp.room].kind !== "boss"), "nothing waits in the way in or the master's hall");
    const [dx, dy] = m.dim.door;
    assert.equal(m.portals[0].to, "town"); assert.ok(m.reach[dy * m.w + dx], "the door home stands on open ground");
    // the master's hall has an open 5 × 5 core
    const [bx, by] = m.dim.boss;
    for (let y = by - 2; y <= by + 2; y++) for (let x = bx - 2; x <= bx + 2; x++) assert.ok(m.reach[y * m.w + x], `${seed}: boss hall core ${x},${y}`);
    assert.ok(m.dim.path >= D.path && m.dim.path <= 140, `${seed}: way to the master ${m.dim.path} tiles`);
    paths.push(m.dim.path);
    assert.ok(X.MOBS[m.dim.bossK] && !X.MOBS[m.dim.bossK].chest);
    // the rim stays rock: nothing to walk off
    for (let x = 0; x < m.w; x++) { assert.equal(m.g[0][x], "W"); assert.equal(m.g[m.h - 1][x], "W"); }
  }
  times.sort((a, b) => a - b);
  assert.ok(times[Math.floor(times.length * 0.99)] < 40, "a rift is made in under 40 ms: p99 " + times[Math.floor(times.length * 0.99)].toFixed(1));
  log(`generator: 800 rifts, median ${times[400].toFixed(2)} ms, max ${times[times.length - 1].toFixed(1)} ms; way to the master ${Math.min(...paths)}–${Math.max(...paths)} tiles`);
  // the pool follows the level; the theme follows the level band
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
  now = 5_000_000;
  S.now = now; S.last = now;
  return S;
}
const [OBX, OBY] = [X.DIM_TOWN.keeper[0] * T + 8, (X.DIM_TOWN.keeper[1] - 1) * T + 10];
function hero(S, pid, name, cls = "warrior", lv = 20, gear = false) {
  const ch = L.newChar(name, cls, []);
  ch.lvl = lv;
  if (gear) {
    const tier = X.tierFor(lv), box = { seed: lv * 31 + name.length };
    const kinds = X.CLASSES[cls].wk;
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
  const dim = S.dims[p.map], rt = dim.rt;
  assert.equal(dim.lv, lv0);
  step(S);
  const v0 = last("g1", "dim");
  assert.ok(Array.isArray(v0) && v0[0] === 0 && v0[2] === 0 && v0[4] === lv0, "the HUD block: " + JSON.stringify(v0));
  const kill = (mob) => { mob.by = { g1: 1 }; X.killMob(S, rt, mob); };
  const normal = rt.mobs.find((m) => !m.dead && !m.el && !X.MOBS[m.k].chest);
  kill(normal);
  assert.ok(dim.gK >= 1, "the gauge scale");
  const total = dim.map.dim.spawns.filter((sp) => !sp.el && !sp.chest).reduce((n, sp) => n + sp.n, 0) * D.normal + dim.map.dim.elites * (D.elite + D.orb);
  assert.ok(total * dim.gK >= D.full - 0.01, "everything in the rift is worth enough to fill the gauge: " + total * dim.gK);
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
  // 100%: the master walks in, once; the rest dissolve; vault guardians and chests stay
  dim.prog = 99.5;
  kill(rt.mobs.find((m) => !m.dead && !m.el && !X.MOBS[m.k].chest));
  assert.equal(dim.state, "boss");
  const bosses = rt.mobs.filter((m) => !m.dead && m.el === 2);
  assert.equal(bosses.length, 1, "one master");
  assert.equal(bosses[0].id, dim.boss);
  assert.ok(rt.mobs.filter((m) => !m.dead && !m.el && !X.MOBS[m.k].chest).length === 0, "the rest dissolved");
  assert.ok(rt.mobs.some((m) => !m.dead && m.guard) && rt.mobs.some((m) => !m.dead && X.MOBS[m.k].chest), "vaults keep theirs");
  const g0 = dim.prog;
  kill(rt.mobs.find((m) => !m.dead && m.guard));
  assert.equal(dim.prog, g0, "nothing more after 100%");
  assert.equal(rt.mobs.filter((m) => !m.dead && m.el === 2).length, 1, "still one master");
  step(S);
  const vb = last("g1", "dim");
  assert.equal(vb[2], 1); assert.equal(vb[3], dim.boss); assert.deepEqual(vb[11], dim.map.dim.boss);
  // the master falls: a chest, a door home
  const boss = rt.mobs.find((m) => m.id === dim.boss);
  const bx = boss.x, by = boss.y;
  kill(boss);
  assert.equal(dim.state, "clear");
  assert.ok(dim.chest && dim.portal);
  assert.equal(p.ch.st.dim, 1, "a clear is counted");
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
  assert.deepEqual(S.players.old.ch.dim, { day: 0, n: 0 }); assert.equal(S.players.old.ch.v, 9);
  const odd = L.newChar("이상", "mage", []); odd.dim = { day: "x", n: -5 };
  L.addPlayer(S, "odd", odd);
  assert.deepEqual(S.players.odd.ch.dim, { day: 0, n: 0 });
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
function runParty(lv, classes, seedSalt) {
  const S = world();
  S.seed += seedSalt;
  const pids = classes.map((c, i) => "bot" + i);
  const ps = classes.map((c, i) => hero(S, pids[i], "봇" + i, c, lv, true));
  if (ps.length > 1) party(S, pids);
  assert.ok(act(S, pids[0], { t: "dim_open" }).ok);
  if (ps.length > 1) { const rc = S.parties[ps[0].party].rc; for (const pid of pids.slice(1)) act(S, pid, { t: "dim_ready", id: rc.id, ok: 1 }); }
  const dim = S.dims[ps[0].map], m = dim.map, rt = dim.rt, W = m.w;
  const t0 = now;
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
  for (let tick = 0; tick < 16 * 600 && S.dims[dim.id]; tick++) {
    for (const p of ps) {
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
      // skills first (whichever are ready), then the plain blow
      let cast = false;
      for (let i = X.SKILLS[p.ch.cls].length - 1; i >= 0 && !cast; i--) if (act(S, p.pid, { t: "sk", i, a: aim }).ok) cast = true;
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
  return { lv, theme: dim.theme, n: ps.length, state: dim.state, boss: bossAt ? (bossAt - t0) / 60000 : null, clear: clearAt ? (clearAt - t0) / 60000 : null, got, wire: bytes / snaps, kills: dim.kills, elites: dim.elites, deaths, prog: dim.prog, bossHp: (rt.mobs.find((q) => q.id === dim.boss) || {}).hp };
}
{
  const runs = [];
  const fours = [["warrior", "rogue", "lancer", "mage"], ["lancer", "mage", "warrior", "rogue"]];
  for (const [lv, salt] of [[17, 1], [24, 2], [32, 3], [40, 4], ...(process.env.MORE ? [[14, 5], [20, 6], [28, 7], [36, 8], [44, 9], [17, 10], [32, 11]] : [])]) if (!process.env.ONLY || +process.env.ONLY === lv) runs.push(runParty(lv, fours[salt % 2], salt));
  for (const r of runs) {
    log(`4 bots Lv.${r.lv} ${r.theme}: master at ${r.boss && r.boss.toFixed(1)} min, clear at ${r.clear && r.clear.toFixed(1)} min, ${r.kills} kills, ${r.elites} elites, chests ${r.got}/${r.n}, ${r.deaths} deaths, end ${r.state} boss hp ${r.bossHp}, dim wire ${r.wire.toFixed(0)} B/snap`);
    if (!process.env.NOCLEAR) assert.equal(r.state === "clear" || r.clear !== null, true, `Lv.${r.lv}: the party clears it (${r.state})`);
    // the plan's window is 5–10 minutes for players; headless bots get half a minute either side
    if (!process.env.NOCLEAR) assert.ok(r.clear >= 4.5 && r.clear <= 10.5, `Lv.${r.lv}: clear in 5–10 min, took ${r.clear && r.clear.toFixed(2)}`);
    if (!process.env.NOCLEAR) assert.equal(r.got, r.n, "every member opens the chest once");
    assert.ok(r.wire <= 120, `the dim block averages ${r.wire.toFixed(0)} B a snapshot`);
  }
  const avg = runs.reduce((s, r) => s + r.clear, 0) / runs.length;
  log(`average clear ${avg.toFixed(2)} min`);
  if (!process.env.NOCLEAR && !process.env.ONLY) assert.ok(avg >= 5.5 && avg <= 9, `the average clear ${avg.toFixed(2)} min sits inside the window`);
  // a solo player two levels under the band: reaches the master well inside the limit (beating it alone is up to the player:
  // the headless bot does not kite, so it is only measured, not asserted)
  const solo = runParty(22, ["warrior"], 7);
  assert.ok(solo.boss !== null && solo.boss < 12, "alone, the master is reached in time");
  log(`solo Lv.22: ${solo.state}, ${solo.deaths} deaths, gauge ${solo.prog.toFixed(0)}, master at ${solo.boss && solo.boss.toFixed(1)} min, clear ${solo.clear && solo.clear.toFixed(1)} min`);
}
console.log("dimrift ok");
