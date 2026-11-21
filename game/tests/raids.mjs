// The ten raids (owner 2026-11-21; 31-raids-field.js RAID, 64-dim.js): each one procedural floor with a mid-boss in its far
// hall, whose death opens a portal to the raid boss's own room (dimArena, varied by the seed), where the boss's challenge
// script runs; its death leaves the chest. 보통 by the raid's level window, 헬 at the top tier. node tests/raids.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { RAID, RAID_KEYS, RAID_ROWS, DIM, DIM_CHAL, HELL_TIER, DIM_TOWN, MOBS, killMob, bfs, toTier, shownLv };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16;
const [OBX, OBY] = [X.DIM_TOWN.keeper[0] * T + 8, (X.DIM_TOWN.keeper[1] - 1) * T + 10];
let now = 2_281_000;
const world = () => { const S = L.setup(); S.now = now; S.last = now; return S; };
const hero = (S, pid, name, lvl) => { const ch = L.hero(name, { wk: "sword", lvl, migrate: true }); ch.map = "town"; ch.x = OBX; ch.y = OBY; L.addPlayer(S, pid, ch); S.players[pid].ghost = 1e15; return S.players[pid]; };   // never hit: the test walks the flow, not the fights
const act = (S, pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
const tick = (S, n = 1) => { for (let i = 0; i < n; i++) { now += 100; S.now = now; L.tick(S, now); } };
const kill = (S, dim, mob, p) => { mob.by = { [p.pid]: 1 }; X.killMob(S, dim.rt, mob); };
/** Every open floor tile reachable from `from` (tiles), and how many open tiles there are. */
function reach(m, from) {
  const d = X.bfs(m.w, m.h, from[1] * m.w + from[0], (i) => m.reach[i] === 1);
  let open = 0, got = 0;
  for (let i = 0; i < m.w * m.h; i++) if (m.reach[i] === 1) { open++; if (d[i] >= 0) got++; }
  return { d, open, got, to: ([x, y]) => d[y * m.w + x] };
}

// ── the list: ten raids, one per boss, opening Lv.20 → 200 in steps of 20
const defs = L.defs().dim;
assert.equal(X.RAID_KEYS.length, 10);
assert.deepEqual([...X.RAID_KEYS].sort(), Object.keys(X.DIM_CHAL.bosses).sort(), "one raid per boss of the old challenge");
assert.deepEqual(defs.raids.map((r) => [r.minLv, r.maxLv]), [[20, 40], [40, 60], [60, 80], [80, 100], [100, 120], [120, 140], [140, 160], [160, 180], [180, 200], [200, 200]]);
assert.equal(X.DIM.floors, 1, "one floor");
for (const k of X.RAID_KEYS) for (const l of X.RAID[k].looks) assert.ok(X.RAID_ROWS[l], `${k}: look ${l}`);
assert.match(act(world(), "x", { t: "dim_open", boss: "boss" }).error || "", /캐릭터|합쳐/);

// ── every raid: open at its first level, the floor, the mid-boss, the portal, the boss's room, the boss, the chest
const looks = {};
for (const [i, k] of X.RAID_KEYS.entries()) {
  const R = X.RAID[k], S = world(), p = hero(S, "pa", "가장", R.minLv);
  tick(S);
  assert.match(act(S, "pa", { t: "dim_open", raid: k }).error || "ok", /^ok$/, `${k} opens at Lv.${R.minLv}`);
  if (R.minLv > 20) { const S2 = world(); hero(S2, "pb", "낮음", R.minLv - 1); tick(S2); assert.match(act(S2, "pb", { t: "dim_open", raid: k }).error || "", /Lv\./, `${k} bars Lv.${R.minLv - 1}`); }
  const dim = S.dims[p.map], m = dim.map;
  assert.ok(dim && dim.rk === k && dim.floor === 1 && !dim.fin, `${k}: in the floor`);
  assert.equal(X.shownLv(dim.lv), X.shownLv(Math.floor(X.toTier(R.minLv))), `${k}: made for its level`);
  // the floor: a way from the start to the mid-boss's hall, every spawn on open ground the start reaches, no pile-ups
  const r = reach(m, m.dim.start);
  assert.ok(r.to(m.dim.boss) > 0, `${k}: the mid-boss's hall is reachable`);
  assert.ok(r.got / r.open > 0.97, `${k}: the floor is one piece (${r.got}/${r.open})`);
  const live = dim.rt.mobs.filter((q) => !q.dead);
  for (const q of live) assert.ok(r.to([Math.floor(q.x / T), Math.floor(q.y / T)]) >= 0, `${k}: ${q.k} stands where the party can reach`);
  const at = new Map();
  for (const q of live) { const key = `${Math.floor(q.x / T)},${Math.floor(q.y / T)}`; at.set(key, (at.get(key) || 0) + 1); }
  assert.ok(Math.max(...at.values()) <= 3, `${k}: no pile of monsters on one tile`);
  looks[k] = m.name;
  // the mid-boss: an elite boss rank with traits, in its hall; no portal while it lives
  const mid = dim.rt.mobs.find((q) => q.id === dim.boss);
  assert.ok(mid && mid.el === 2 && mid.tr.length >= 2, `${k}: a mid-boss`);
  if (R.master) assert.equal(mid.k, R.master);
  assert.ok(!dim.portal && dim.state === "run");
  const others = live.filter((q) => q !== mid && !X.MOBS[q.k].chest);
  kill(S, dim, others[0], p);
  assert.ok(!dim.portal && dim.state === "run", `${k}: a common kill opens nothing`);
  assert.ok(L.viewFor(S, "pa").dim[3] === mid.id, "the HUD follows the mid-boss");
  kill(S, dim, mid, p);
  assert.ok(dim.portal && dim.state === "down", `${k}: the mid-boss's portal`);
  assert.ok(r.to([Math.floor(dim.portal.x / T), Math.floor(dim.portal.y / T)]) >= 0, `${k}: the portal stands on reachable ground`);
  // a step in takes the party to the boss's room
  p.x = dim.portal.x; p.y = dim.portal.y;
  tick(S, 20);
  const fin = S.dims[p.map];
  assert.ok(fin && fin.fin && fin.rk === k && fin !== dim, `${k}: in the boss's room (map ${p.map}, dead ${p.dead}, state ${dim.state})`);
  assert.ok(!S.dims[dim.id], "the floor is gone");
  const boss = fin.rt.mobs.find((q) => q.id === fin.boss);
  assert.equal(boss.k, k, `${k}: the raid's own boss`);
  assert.ok(boss.ecoLv === dim.lv && fin.chal && fin.state === "boss", `${k}: the challenge's fight at the raid's level`);
  const a = reach(fin.map, fin.map.dim.start);
  assert.ok(a.got === a.open && a.to(fin.map.dim.boss) > 0, `${k}: the room is one piece`);
  // it sleeps until someone comes near, then its script runs
  assert.equal(fin.chal.engAt, 0);
  p.x = boss.x - 40; p.y = boss.y;
  tick(S, 30);
  assert.ok(fin.chal.engAt > 0, `${k}: the boss wakes`);
  if (i === 0) {
    // a wipe in the raid's room: the boss heals and sleeps, the party gets up there together and tries again
    const t0 = fin.chal.tries, full = boss.hp;
    boss.hp = Math.floor(boss.hp / 2); p.dead = true; p.hp = 0;
    tick(S);
    assert.ok(fin.chal.tries === t0 + 1 && fin.chal.engAt === 0 && boss.hp === full, `${k}: a wipe resets the boss`);
    tick(S, X.DIM_CHAL.reviveMs / 100 + 2);
    assert.ok(!p.dead && p.map === fin.id && fin.state === "boss", `${k}: up again in the boss's room`);
    p.x = boss.x - 40; p.y = boss.y; tick(S, 30);
  }
  // its death: the chest and the way home; the chest pays the raid's reward
  if (p.dead) { p.dead = false; p.hp = 1; }
  kill(S, fin, boss, p);
  assert.equal(fin.state, "clear");
  const gold = p.ch.gold;
  p.x = fin.chest.x; p.y = fin.chest.y; p.dead = false;
  tick(S, 2);
  assert.ok(fin.got.pa && p.ch.gold > gold, `${k}: the chest pays`);
  assert.equal(p.ch.dim.best, 1);
  now += 3_600_000;
}

// ── a fresh floor and a fresh room each entry
{
  const a = world(), b = world();
  const pa = hero(a, "pa", "하나", 40), pb = hero(b, "pa", "하나", 40);
  tick(a); act(a, "pa", { t: "dim_open", raid: "knotwidow" });
  now += 7777; tick(b); act(b, "pa", { t: "dim_open", raid: "knotwidow" });
  const ma = a.dims[pa.map].map, mb = b.dims[pb.map].map;
  assert.notDeepEqual(ma.g, mb.g, "two entries, two floors");
}

// ── 헬: Lv.200, any raid, the top tier for the floor, the mid-boss and the boss
{
  const S = world(), p = hero(S, "pa", "지옥", 200);
  tick(S);
  assert.ok(act(S, "pa", { t: "dim_open", raid: "wickregent", dif: 3 }).ok);
  const dim = S.dims[p.map], mid = dim.rt.mobs.find((q) => q.id === dim.boss);
  assert.equal(dim.lv, X.HELL_TIER);
  assert.equal(mid.ecoLv, X.HELL_TIER);
  kill(S, dim, mid, p); p.x = dim.portal.x; p.y = dim.portal.y; tick(S, 20);
  const fin = S.dims[p.map], boss = fin.rt.mobs.find((q) => q.id === fin.boss);
  assert.equal(boss.ecoLv, X.HELL_TIER);
  // a Lv.20–40 boss made a Lv.200 fight: far tougher than at 보통
  const S2 = world(), p2 = hero(S2, "pa", "보통", 20);
  tick(S2); act(S2, "pa", { t: "dim_open", raid: "wickregent" });
  const d2 = S2.dims[p2.map], m2 = d2.rt.mobs.find((q) => q.id === d2.boss);
  kill(S2, d2, m2, p2); p2.x = d2.portal.x; p2.y = d2.portal.y; tick(S2, 20);
  const f2 = S2.dims[p2.map], b2 = f2.rt.mobs.find((q) => q.id === f2.boss);
  assert.ok(boss.hk > b2.hk * 3 && fin.chal.ak > f2.chal.ak * 3, `헬 boss hp ×${(boss.hk / b2.hk).toFixed(1)}, blows ×${(fin.chal.ak / f2.chal.ak).toFixed(1)}`);
}

// ── a party goes in together through the ready check, and both reach the boss's room
{
  const S = world(), a = hero(S, "pa", "파티장", 60), b = hero(S, "pb", "파티원", 60);
  tick(S);
  assert.ok(act(S, "pa", { t: "pinv", e: b.eid }).ok && act(S, "pb", { t: "pacc" }).ok, "a party");
  {
    act(S, "pa", { t: "dim_open", raid: "knellkeeper" });
    const rc = S.parties[a.party].rc;
    act(S, "pb", { t: "dim_ready", id: rc.id, ok: 1 });
    tick(S, 2);
    assert.ok(a.map === b.map && a.map.startsWith("dim:"), "both in");
    const dim = S.dims[a.map];
    kill(S, dim, dim.rt.mobs.find((q) => q.id === dim.boss), a);
    for (const o of [a, b]) { o.x = dim.portal.x; o.y = dim.portal.y; }
    tick(S, 20);
    assert.ok(a.map === b.map && S.dims[a.map].fin, "both in the boss's room");
  }
}
console.log("raids ok:", Object.entries(looks).map(([k, n]) => `${X.MOBS[k].name}·${n}`).join(", "));
