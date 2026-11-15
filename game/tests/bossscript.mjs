// Headless test of the boss-script runner (src/logic/56-boss-script.js) on a field boss: patterns in turn, a dive out of
// reach, the marked cast and its stagger gauge, the vuln window, phases by health, soft and hard enrage, the fight
// forgotten on the walk home; the snapshot row's phase/state and the client's art pick (public/mobart.js artKind).
// node tests/bossscript.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as MA from "../public/mobart.js";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { MOBS, BOSS_SCRIPT, newMob, mobMax, dealMob, mobsWithin, aimMob, canStand, mapOfS, bsDef, bsCast, bsInside };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, B0 = X.BOSS_SCRIPT;

// the fixture: a field boss with a script (every 3rd turn the cast; under half health a dive-only phase opening with the cast)
X.MOBS.bs_test = {
  ...X.MOBS.lambmaw, name: "시험 보스", hp: 5000, atk: 20, aggro: 120,
  script: { cast: "시험 주문", every: 3, enrage: 120000, hard: 200000, pats: [["탄막", "fan2"], ["잠수", "dive"]],
    phases: [{ at: 0.5, pats: [["깊은 잠수", "dive"]], cast: 1, steps: [{ f: "pool", dt: 300 }] }] },
};
const B = X.bsDef({ k: "bs_test" });
assert.equal(B.vuln, B0.vuln); assert.equal(B.castMs, B0.castMs); assert.equal(X.bsDef({ k: "lambmaw" }), null, "no script, no runner");

const S = L.setup();
let now = 1_000_000;
S.now = now;
L.addPlayer(S, "p1", L.hero("시험", { wk: "sword", lvl: 120, migrate: true }));
const p = S.players.p1;
L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
const m = X.mapOfS(S, "meadow"), rt = L.runtime(S, "meadow");
// a clear patch of ground for the fight
let spot = null;
for (let y = 200; y < m.h * 16 - 200 && !spot; y += 16) for (let x = 200; x < m.w * 16 - 200 && !spot; x += 16) {
  let ok = true;
  for (let dy = -80; dy <= 80 && ok; dy += 8) for (let dx = -80; dx <= 80 && ok; dx += 8) ok = X.canStand(m, x + dx, y + dy);
  if (ok) spot = [x, y];
}
assert.ok(spot, "an open spot on the meadow");
for (const o of rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
const mob = X.newMob(S, "bs_test", [0, 0, 0, 0]);
mob.el = 2; mob.temp = true; mob.tr = [];
mob.x = mob.hx = mob.wx = spot[0] + 30; mob.y = mob.hy = mob.wy = spot[1];
mob.hp = X.mobMax(mob); mob.castAt = now + 500; mob.stun = 0;
rt.mobs.push(mob);
const max = X.mobMax(mob);

let view = null;
const evs = [];
const tough = () => { p.dead = false; p.hp = 1e7; p.x = spot[0]; p.y = spot[1]; p.mvAt = now; };
const step = (n = 1) => { for (let i = 0; i < n; i++) { tough(); now += 100; L.tick(S, now); view = JSON.parse(JSON.stringify(L.viewFor(S, "p1"))); for (const e of rt.ev) evs.push(e); L.endTick(S); } };
const row = () => view.M.find((r) => r[0] === mob.id);
const dcs = () => evs.filter((e) => e[0] === "bc" && e[1] === mob.id).map((e) => e[2]);

// it notices the hero and the fight begins; the wire row ends with phase 1, state 0
step(3);
assert.ok(mob.bs && mob.bs.engAt > 0, "the fight is on");
assert.deepEqual(row().slice(8), [0, 0, 1, 0], "a scripted boss's row: marks, brand, phase, state");
// patterns in turn: the volley, then the dive — out of reach, not hit, not aimed at
while (!mob.dive) { step(); assert.ok(now - mob.bs.engAt < 30000, "a dive comes"); }
assert.deepEqual(dcs(), [0, 1], "fan2, then the dive");
step();
assert.equal(row()[11], 2, "dived on the wire");
const hp0 = mob.hp;
assert.equal(X.dealMob(S, rt, mob, p, 500, 0), false); assert.equal(mob.hp, hp0, "a dived boss is not hit");
assert.ok(!X.mobsWithin(rt, mob.x, mob.y, 200).includes(mob), "nor caught in an area");
assert.ok(evs.some((e) => e[0] === "t" && e[3] === B.diveR), "the ring shows where it comes down");
while (mob.dive) step();
assert.ok(Math.hypot(mob.x - spot[0], mob.y - spot[1]) < 2, "it came down on the party");
// the third turn: the marked cast; damage empties the gauge, emptied in time it breaks: a stun and more damage taken
while (!mob.cast) step();
step();
assert.equal(row()[11], 1, "casting on the wire");
assert.deepEqual(dcs().slice(-1), [9]);
X.dealMob(S, rt, mob, p, Math.ceil(mob.cast.need), 0);
assert.ok(!mob.cast && mob.stag > now && mob.stun >= now + B.stunMs - 1, "broken: stunned");
assert.ok(rt.ev.some((e) => e[0] === "bc" && e[1] === mob.id && e[2] === 8), "the break shown");
step();
assert.equal(row()[11], 0);
const hp1 = mob.hp;
X.dealMob(S, rt, mob, p, 1000, 0);
assert.equal(hp1 - mob.hp, Math.round(1000 * (1 + B.vuln)), "+30% while stagger-stunned");
mob.stag = mob.stun = 0; mob.castAt = now;
// under half its health: phase 2, which opens with the marked cast; this time nobody breaks it
mob.hp = Math.round(max * 0.45);
step();
assert.equal(mob.bs.ph, 2); assert.equal(row()[10], 2, "phase 2 on the wire");
while (!mob.cast) step();
const n0 = dcs().length;
while (mob.cast) step();
assert.deepEqual(dcs().slice(n0), [7], "the cast went off");
assert.equal(mob.bs.fury, 1); assert.ok(Math.abs(mob.ak - mob.bs.ak * (1 + B.fury)) < 1e-9, "angrier");
// phase 2's own pattern list and its extra step: a dive, and a puddle after it
const g0 = evs.filter((e) => e[0] === "g").length;
while (!mob.dive) step();
assert.equal(dcs().slice(-1)[0], 0, "phase 2: its own pattern list (the dive is its pattern 0)");
step(5);
assert.ok(evs.filter((e) => e[0] === "g").length > g0, "the phase's extra step: a puddle");
while (mob.dive) step();
mob.hp = Math.round(max * 0.8); step();
assert.equal(mob.bs.ph, 2, "a phase never goes back while the fight lasts");
// the soft enrage, then the hard one
mob.bs.engAt = now - B.enrage - B.enrageStep - 50; step();
assert.equal(mob.bs.rage, 2); assert.ok(Math.abs(mob.ak - mob.bs.ak * (1 + B.fury) * (1 + 2 * B.enrageK)) < 1e-9, "soft enrage: blows grow");
mob.cast = null; mob.bs.engAt = now - B.hard - 50; p.hp = 1e7;
let hit = false;
for (let i = 0; i < 3; i++) { now += 100; S.now = now; L.tick(S, now); if (p.hp < 1e7) hit = true; L.endTick(S); p.x = spot[0]; p.y = spot[1]; }
assert.ok(hit && mob.bs.hard > now, "hard enrage: a blow on everyone in the fight");
// it gives up and walks home: the fight is forgotten
mob.tgt = null; mob.st = 2; p.x = spot[0] + 3000;
const ak = mob.bs.ak;
now += 100; L.tick(S, now); L.endTick(S);
assert.equal(mob.bs, null); assert.equal(mob.ak, ak); assert.equal(mob.dive, 0);

// the shaped kinds (bosses-2 §8): the same geometry the client draws, damage only on whoever is inside when it lands
const I = X.bsInside;
const dn = { x: 0, y: 0, r: 90, r0: 30, half: 0 };
assert.ok(!I(dn, 10, 0) && I(dn, 30, 0) && I(dn, 0, 60) && I(dn, 90, 0) && !I(dn, 91, 0), "donut: safe in the middle and outside");
const cn = { x: 0, y: 0, r: 56, r0: 0, ang: 0, half: Math.PI / 3 };
assert.ok(I(cn, 50, 0) && I(cn, 20, 30) && !I(cn, 20, 40) && !I(cn, -20, 0) && !I(cn, 57, 0) && I(cn, 0, 0), "cone: 120° ahead, r 56");
X.MOBS.bs_pat = {
  ...X.MOBS.lambmaw, name: "모양 보스", hp: 1e6, atk: 20, aggro: 0,
  script: { cast: "없음", every: 1000, pats: [["도넛", "donut"], ["부채꼴", "cone"], ["표식", "mark", { ms: 2000 }], ["소환", "adds", { kind: "lambmaw", n: 3, cap: 4 }]] },
};
for (const o of rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
const pm = X.newMob(S, "bs_pat", [0, 0, 0, 0]);
pm.el = 2; pm.temp = true; pm.tr = [];
pm.x = pm.hx = pm.wx = spot[0]; pm.y = pm.hy = pm.wy = spot[1]; pm.hp = X.mobMax(pm);
rt.mobs.push(pm);
/** Cast pattern `i` with the hero at `at` (offset from the boss), move them to `to`, run until it has landed: hp lost. */
const trial = (i, at, to = at) => {
  p.dead = false; p.dodge = 0; p.x = pm.x + at[0]; p.y = pm.y + at[1];
  if (pm.bs) { pm.bs.pi = i; pm.bs.q = []; }
  X.bsCast(S, rt, pm, p);
  p.x = pm.x + to[0]; p.y = pm.y + to[1];
  let lost = 0;
  for (let k = 0; k < 35; k++) { pm.stun = now + 1e9; p.hp = 1e7; now += 100; L.tick(S, now); lost += 1e7 - p.hp; L.endTick(S); }
  return lost;
};
assert.ok(trial(0, [60, 0]) > 0, "donut: hit in the band");
assert.equal(trial(0, [60, 0], [12, 0]), 0, "donut: stepped into the middle");
assert.equal(trial(0, [60, 0], [100, 0]), 0, "donut: stepped out past its reach");
assert.ok(trial(1, [40, 0]) > 0, "cone: hit in front");
assert.equal(trial(1, [40, 0], [0, 45]), 0, "cone: stepped aside");
assert.equal(trial(1, [40, 0], [-30, 0]), 0, "cone: behind it is safe");
const lastBt = [];
const grab = () => { const e = rt.ev.find((q) => q[0] === "bt"); if (e) lastBt.push(e); };
p.x = pm.x + 40; p.y = pm.y; pm.bs.pi = 1; pm.bs.q = []; X.bsCast(S, rt, pm, p); grab();
assert.deepEqual(lastBt[0].slice(0, 7), ["bt", 1, Math.round(pm.x), Math.round(pm.y), 56, 1000, 0], "cone on the wire: facing in mrad");
assert.equal(lastBt[0][7], 1047); L.endTick(S); pm.bs.q = [];
assert.ok(trial(2, [80, 0], [80, 80]) > 0, "mark: the burst follows its hero and lands where they stand");
// spread: a mark on one of two heroes hits the other only if they stand inside it
L.addPlayer(S, "p2", L.hero("동료", { wk: "sword", lvl: 120, migrate: true }));
const q = S.players.p2;
L.runtime(S, q.map).n--; q.map = "meadow"; rt.n++;
const spread = (gap) => {
  for (const o of [p, q]) { o.dead = false; o.dodge = 0; }
  p.x = pm.x + 80; p.y = pm.y; q.x = pm.x - 80; q.y = pm.y;
  pm.bs.pi = 2; pm.bs.q = [];
  X.MOBS.bs_pat.script.pats[2][2].n = 1;
  X.bsCast(S, rt, pm, p);
  const e = rt.ev.filter((v) => v[0] === "bt" && v[1] === 2).pop(), [mk, other] = e[6] === p.eid ? [p, q] : [q, p];
  other.x = mk.x + gap; other.y = mk.y;
  let lost = 0;
  for (let k = 0; k < 25; k++) { pm.stun = now + 1e9; other.hp = mk.hp = 1e7; now += 100; L.tick(S, now); lost += 1e7 - other.hp; L.endTick(S); }
  return lost;
};
assert.ok(spread(20) > 0, "mark: whoever stands inside is hit too");
assert.equal(spread(60), 0, "mark: spread out, not hit");
q.x = pm.x + 3000;
const add0 = rt.mobs.filter((a) => a.add === pm.id && !a.dead).length;
trial(3, [200, 0]); trial(3, [200, 0]);
const adds = rt.mobs.filter((a) => a.add === pm.id && !a.dead);
assert.ok(add0 === 0 && adds.length === 4 && adds.every((a) => a.k === "lambmaw" && a.temp && a.el === 0), "adds: three, then capped at four");
assert.ok(!evs.some((e) => e[0] === "dc"), "a boss no longer sends the tracker lure's code");

// the client's look of the moment: only art that exists is picked
assert.equal(MA.artKind("bloomwhale", { bst: 2, bph: 2 }), "bloomwhale_dive");
assert.equal(MA.artKind("bloomwhale", { bst: 1, bph: 1 }), "bloomwhale_ch");
assert.equal(MA.artKind("bloodhorn", { bst: 1, bph: 2 }), "bloodhorn_p2", "no channel art: the phase's");
assert.equal(MA.artKind("bloodhorn", { bst: 0, bph: 1 }), "bloodhorn");
assert.equal(MA.artKind("lambmaw", { bst: 2, bph: 3 }), "lambmaw");
console.log("bossscript: ok");
