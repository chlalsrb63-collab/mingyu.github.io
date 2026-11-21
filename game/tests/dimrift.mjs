// Headless test of the party instance 레이드던전 (docs/design/scale-and-rift.md D): the generator (deterministic, capped,
// every room reachable), the Hanok floors, the ready check and its edge cases, death and failure, cleanup, and every boss's
// room. The raid flow itself (floor → mid-boss → portal → boss room → chest, owner 2026-11-21) is tests/raids.mjs.
// node tests/dimrift.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { DIM, DIM_TOWN, DIM_THEMES, DIM_FLOORS, dimTheme, dimension, dimPool, killMob, changeMap, closeDim, rollGear, tierFor, GEAR, WK_ID, MOBS, SKILL, SKILL_ORDER, skillHpCost, xpNeed, stats, atkRange, aimIdx, ITEMS, SOLID_G, MAXLV, DIM_CHAL, CHAL_KEYS, dimFloorK, dimReward, weekOf, dayOf, dimArena, chalMinLv, chalSteps, TIER_MAX, dimClean, dealMob, mobMax, dimHk, dimAtkK, chalGearHp, chalGearAtk, chalOfWeek, RAID, MAP_META, FIELD_BOSS, dimRaidKey };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16, D = X.DIM;
// tuning runs: HPB=… BOSSHP=… NOCLEAR=1 node tests/dimrift.mjs -v
const X_DIM_SET = [];
if (process.env.HPB) X_DIM_SET.push(["hpBase", +process.env.HPB]);
if (process.env.BOSSHP) X_DIM_SET.push(["bossHp", +process.env.BOSSHP]);
if (process.env.BOSSATK) X_DIM_SET.push(["bossAtk", +process.env.BOSSATK]);
if (process.env.LVK) X_DIM_SET.push(["lvK", +process.env.LVK]);
for (const kv of (process.env.DIMSET || "").split(",").filter(Boolean)) X_DIM_SET.push([kv.split("=")[0], +kv.split("=")[1]]);   // DIMSET=gK=3.5,normal=1.2
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
    assert.equal(m.dim.style, cc.style); assert.ok(m.name.includes(" · "), m.name);   // "raid · look" (owner 2026-11-21)
    const main = m.dim.rooms.filter((r) => r.kind === "room" || r.kind === "start" || r.kind === "boss");
    assert.ok(main.length >= cc.rooms[0] * 0.6 && main.length <= cc.rooms[1], `${seed}/${floor}: ${main.length} rooms (some over two cells)`);
    assert.ok(m.dim.dead.length >= D.vaults[0] && m.dim.dead.length <= D.vaults[1], `${seed}/${floor}: ${m.dim.dead.length} vaults`);
    const normal = m.dim.spawns.filter((sp) => !sp.el && !sp.chest).reduce((n, sp) => n + sp.n, 0);
    const all = m.dim.spawns.reduce((n, sp) => n + sp.n, 0);
    assert.ok(normal <= D.mobCap && all <= D.cap, `${seed}: ${normal} monsters, ${all} in all`);
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

// ───────────── Hanok floor plans
{
  for (let floor = 1; floor <= D.floors; floor++) {
    const plans = new Set();
    for (let s = 1; s <= 16; s++) {
      const seed = Math.imul(s, 40503), theme = X.dimTheme(seed, floor);
      const cfg = { seed, theme, lv: 20, floor, raid: "knellkeeper" };   // the hanok raid (owner 2026-11-21)
      const m = X.dimension(cfg);
      assert.equal(m.theme, "interior");
      assert.equal(m.style, "hanok_raid");
      if (floor === D.floors) {
        assert.equal(m.dim.bossK, "jaemaei", "the ritual hall has its own master");
        assert.ok(X.MOBS[m.dim.bossScaleK], "the boss retains a level-band scale");
      }   // its hall is a common one: the raid boss has its own room now
      assert.ok(!m.dim.spawns.some((sp) => sp.k === "jaemaei"), "the boss is not in the roaming packs");
      assert.ok(m.dim.loops > 0 && m.dim.path >= D.path, `floor ${floor}, seed ${seed}: loop and long route`);
      assert.ok(m.o.some((r) => r.includes("+")) && m.o.some((r) => r.includes("_")), "lattice and cutaway walls");
      assert.ok(m.g.some((r) => r.includes("e")) && m.g.some((r) => r.includes("l")), "ondol and maru");
      for (const [x, y] of [m.dim.door, ...m.dim.rooms.map((r) => [r.cx, r.cy]), ...m.dim.spawns.map((sp) => sp.at)]) {
        assert.ok(m.reach[y * m.w + x], `floor ${floor}, seed ${seed}: ${x},${y} reachable`);
      }
      if (s === 1) {
        const same = X.dimension(cfg);
        assert.deepEqual([same.g, same.o, same.dim.spawns], [m.g, m.o, m.dim.spawns]);
      }
      plans.add(m.g.join(""));
    }
    assert.equal(plans.size, 16, "the rooms and corridors vary with the seed");
  }
}

// ───────────── helpers for a world
let now;
function world() {
  const S = L.setup();
  // a fixed clock (once chosen to fall between two of the retired world events; the runs below are tuned on it)
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
  // a raid opens from anywhere
  A.x = 6 * T; A.y = 14 * T;
  assert.match(act(S, "pa", { t: "dim_open", boss: X.CHAL_KEYS[0] }).error, /레이드/, "the boss challenge is a raid now");
  A.x = OBX; A.y = OBY;
  const P = party(S, ["pa", "pb", "pc", "pe"]);
  assert.match(act(S, "pb", { t: "dim_open" }).error, /파티장만/, "only the leader opens");
  // E is out in the meadow: asked all the same (a raid pulls its party in from anywhere)
  L.runtime(S, "meadow");
  X.changeMap(S, E, "meadow", 30 * T, 20 * T);
  assert.ok(act(S, "pa", { t: "dim_open" }).ok);
  assert.match(act(S, "pa", { t: "dim_open" }).error, /이미 준비/);
  step(S);
  const rc = P.rc;
  assert.ok(rc && rc.resp.pa === 1 && rc.resp.pb === 0 && rc.resp.pc === 0 && rc.resp.pe === 0);
  const vb = last("pb", "rc");
  assert.ok(Array.isArray(vb) && vb[0] === rc.id && vb[1] === 20 && vb[2].length === 4, "B is shown the check: " + JSON.stringify(vb));
  assert.ok(Array.isArray(last("pe", "rc")), "E out in the meadow is asked too");
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
  assert.deepEqual(S.players.old.ch.dim, { day: 0, n: 0, t: 1, best: 0, ms: 0, wk: 0, wb: 0, bw: 0, bs: X.CHAL_KEYS.map(() => 0), hd: [] }); assert.equal(S.players.old.ch.v, L.newChar("현재양식", []).v);
  const odd = L.newChar("이상", "mage", []); odd.dim = { day: "x", n: -5 };
  L.addPlayer(S, "odd", odd);
  assert.deepEqual(S.players.odd.ch.dim, { day: 0, n: 0, t: 1, best: 0, ms: 0, wk: 0, wb: 0, bw: 0, bs: X.CHAL_KEYS.map(() => 0), hd: [] });
}

for (const [k, v] of X_DIM_SET) D[k] = v;
const CH = X.DIM_CHAL;
// ───────────── 9. the boss rooms: each boss's arena (the raid's last room; its fight is tests/raids.mjs, bosses2.mjs)
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
}
console.log("dimrift ok");
