// Headless test of what makes the hunt harder — crowds, attack patterns, recoloured
// kinds, elite traits and the conditions they leave on a player: node tests/hard.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const TINTS = ["fire", "poison", "frost", "steel", "blood", "bile", "ash", "bone", "gold"];
const TRAITS = ["tough", "fire", "poison", "swift", "vamp", "frost", "burst", "thorn"];

// ── the tables clients read
assert.deepEqual(Object.keys(D.traits), TRAITS, "traits come in the agreed order");
for (const k of TRAITS) assert.ok(D.traits[k][0] && D.traits[k][1], k + " has a name and a description");
for (const k of ["lambmaw", "foxtwine", "toadbrood", "squidrat", "crabskull", "moleworm", "lionhand", "sowseer"]) assert.equal(D.mobs[k].sp, k, k + " is a kind of its own");
const variants = Object.keys(D.mobs).filter((k) => D.mobs[k].tint);
assert.ok(variants.length >= 6, "recoloured kinds exist: " + variants);
for (const k of variants) {
  assert.ok(TINTS.includes(D.mobs[k].tint), k + " uses a known tint");
  assert.ok(D.mobs[D.mobs[k].sp] && D.mobs[k].sp !== k, k + " borrows another kind's body");
  assert.ok(D.mobs[k].lv > D.mobs[D.mobs[k].sp].lv, k + " is tougher than the kind it is made from");
}
const where = (k) => D.maps.filter((m) => m.mobs.includes(k)).map((m) => m.id).join(",");
assert.equal(where("lambmaw"), "meadow"); assert.equal(where("foxtwine"), "forest"); assert.equal(where("toadbrood"), "crypt"); assert.equal(where("squidrat"), "city");
assert.equal(where("crabskull"), "sewer"); assert.equal(where("moleworm"), "cave"); assert.equal(where("lionhand"), "abyss"); assert.equal(where("sowseer"), "abyss");
for (const m of D.maps) for (const k of m.mobs) if (m.band && !D.mobs[k].chest) assert.ok(D.mobs[k].lv >= m.band[0] && D.mobs[k].lv <= m.band[1], `${k} (Lv.${D.mobs[k].lv}) fits ${m.id}`);

// ── the world: crowds, and what elites carry
const S = L.setup();
let now = 1000;
S.now = now;
{
  // a scout stands at each hunting ground's entrance: the cells around wake and fill, out of sight
  L.addPlayer(S, "pid-scout", L.newChar("정찰병", "warrior", []));
  const scout = S.players["pid-scout"];
  for (const { id } of L.defs().maps) {
    const m = L.atlas().maps[id];
    if (id === "town" || m.safe) continue; // the town, and safe places from the map editor (data/maps)
    const crowd = m.cells.spawns.flat().reduce((n, q) => n + q.n, 0) + m.cells.fixed.reduce((n, sp) => n + sp.n, 0);
    assert.ok(crowd >= 100 && crowd <= 230, `${id}: ${crowd} monsters`);
    L.runtime(S, scout.map).n--; scout.map = id; L.runtime(S, id).n++;
    scout.x = m.entry[0] * 16 + 8; scout.y = m.entry[1] * 16 + 10; scout.hp = 1e9;
    L.tick(S, (now += 100));
    const rt = L.runtime(S, id);
    assert.ok(rt.mobs.length >= crowd * 0.4, `${id}: ${rt.mobs.length} of ${crowd} monsters about the entrance`);
    for (const mob of rt.mobs) {
      assert.equal(mob.tr.length, mob.el, `${id}: a rank-${mob.el} ${mob.k} carries ${mob.el} trait(s)`);
      assert.equal(new Set(mob.tr).size, mob.tr.length);
      for (const t of mob.tr) assert.ok(TRAITS.includes(t));
      if (mob.slot) assert.ok(Math.hypot(mob.x - scout.x, mob.y - scout.y) >= 14 * 16 - 16, `${id}: a ${mob.k} came alive out of sight`);
    }
    L.endTick(S);
  }
  L.removePlayer(S, "pid-scout");
}
assert.ok(L.runtime(S, "crypt").mobs.some((m) => m.el === 2 && m.tr.length === 2), "a guardian carries two");

const PID = "pid-hard0001";
const ch = L.newChar("단단이", "warrior", []);
ch.lvl = 6;
L.addPlayer(S, PID, ch);
const p = S.players[PID];
const rt = L.runtime(S, "meadow");
L.runtime(S, p.map).n--; p.map = "meadow"; rt.n++; p.sendMap = true;
const view = () => JSON.parse(JSON.stringify(L.viewFor(S, PID)));
const step = (ms = 100) => { now += ms; L.tick(S, now); const v = view(); L.endTick(S); return v; };
const act = (a) => { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; };
let v = step();
const map = v.map;
// a stretch of open ground: nine free tiles in a row, with free rows above and below
const free = (x, y) => map.o[y] && map.o[y][x] === " " && !"wW".includes(map.g[y][x]);
let lane = null;
for (let y = 4; y < map.h - 4 && !lane; y++) for (let x = 4; x < map.w - 14 && !lane; x++) {
  let ok = true;
  for (let i = 0; i < 10 && ok; i++) for (let dy = -1; dy <= 1; dy++) if (!free(x + i, y + dy)) ok = false;
  if (ok) lane = [x, y];
}
assert.ok(lane, "found open ground");
const X = lane[0] * 16 + 8, Y = lane[1] * 16 + 10;
// everything else goes quiet; one monster is borrowed and dressed up for each trial
for (const m of rt.mobs) { m.dead = true; m.respAt = 1e15; }
const pet = rt.mobs.find((m) => m.k === "twinhare");
pet.slot = null; // borrowed from its cell for good: it stays in the world between trials, as a placed monster does
const stand = (dx = 0, dy = 0) => { p.x = X + dx; p.y = Y + dy; p.mvAt = now; p.dead = false; p.hp = 9999; p.burn = null; p.poison = null; p.slowed = 0; p.hitAt = -1e9; p.atkAt = 0; p.dir = 2; p.aim = 0; };
const dress = (k, el, tr, dx, extra = {}) => Object.assign(pet, { k, el, tr, dead: false, hp: 1e6, x: X + dx, y: Y, hx: X + dx, hy: Y, wx: X + dx, wy: Y, tgt: PID, st: 0, stun: 0, slow: 0, dot: null, act: null, mv: 0, cn: 0, atkAt: now, castAt: 1e15, mvAt: 1e15, by: {} }, extra);
const events = (ms) => { const out = []; for (let t = 0; t < ms; t += 100) for (const e of step().ev || []) out.push(e); return out; };
const self = () => { p.dirty = true; return step().self; };

// the snapshot row carries the traits
stand(); dress("twinhare", 1, ["tough"], 14);
v = step();
const row = v.M.find((r) => r[0] === pet.id);
assert.equal(row.length, 8); assert.deepEqual(row[7], ["tough"]); assert.equal(row[6], 1);

// ── tough: four tenths of every blow turned
const dealt = (tr) => { let sum = 0; for (let i = 0; i < 40; i++) { stand(); dress("twinhare", 1, tr, 14, { atkAt: 1e15 }); const h0 = pet.hp; assert.ok(act({ t: "atk" }).ok); sum += h0 - pet.hp; step(1000); } return sum; };
const plainDmg = dealt([]), toughDmg = dealt(["tough"]);
assert.ok(toughDmg / plainDmg > 0.52 && toughDmg / plainDmg < 0.68, `tough takes about 60%: ${(toughDmg / plainDmg).toFixed(2)}`);

// ── thorn: a blow from up close costs the striker; it never kills
stand(); dress("twinhare", 1, ["thorn"], 14, { atkAt: 1e15 });
p.hp = 500;
assert.ok(act({ t: "atk" }).ok);
assert.ok(p.hp < 500, "thorns bite back");
p.hp = 1; p.atkAt = 0; step(1000); p.hp = 1; p.atkAt = 0;
act({ t: "atk" });
assert.ok(!p.dead && p.hp >= 1, "but not to death");

// ── fire, poison, frost: what a hit leaves behind
for (const [tr, slot, key] of [["fire", 5, "burn"], ["poison", 6, "poison"], ["frost", 4, "slowed"]]) {
  stand(); dress("lambmaw", 1, [tr], 14);
  events(1600);
  assert.ok(p[key], `${tr} leaves its mark`);
  pet.dead = true;                                              // nothing is hitting any more
  const s = self();
  assert.equal(s.buffs.length, 10);
  assert.ok(s.buffs[slot] > 0, `${tr} shows in self.buffs[${slot}]`);
  if (key !== "slowed") {
    const h0 = p.hp;
    events(2500);
    assert.ok(p.hp < h0, `${tr} keeps hurting after the blow`);
    events(6000);
    assert.equal(p[key], null, `${tr} runs out`);
  }
}
// a slowed player may not move at full speed
stand(); p.slowed = 0;
step(100);
assert.ok(act({ t: "mv", x: p.x + 14, y: p.y, d: 2 }).ok);
assert.equal(step(100).me[5], 0, "fourteen units in a tick is a legal step");
stand(); p.slowed = now + 5000;
step(100);
act({ t: "mv", x: p.x + 14, y: p.y, d: 2 });
assert.equal(step(100).me[5], 1, "but not while slowed");
assert.equal(D.slow, 0.65);

// ── swift: more blows in the same time
const blows = (tr) => { stand(); dress("twinhare", 1, tr, 14); return events(30000).filter((e) => e[0] === "m" && e[1] === pet.id).length; };
const slowN = blows([]), fastN = blows(["swift"]);
assert.ok(fastN >= slowN * 1.25, `swift attacks faster: ${fastN} vs ${slowN}`);

// ── vamp: it heals from what it spills
stand(); dress("lambmaw", 1, ["vamp"], 14, { hp: 100 });
events(1600);
assert.ok(pet.hp > 100, "a vampiric elite drinks");

// ── burst: it goes off where it falls
stand(); dress("twinhare", 1, ["burst"], 14, { hp: 1, atkAt: 1e15 });
assert.ok(act({ t: "atk" }).ok);
let ev = events(1500);
assert.ok(pet.dead && ev.some((e) => e[0] === "t") && ev.some((e) => e[0] === "b"), "the corpse is marked, then bursts");
assert.ok(p.hp < 9999, "and whoever stood there is hurt");

// ── charge: a marked line, then a run down it
stand(); dress("lambmaw", 0, [], 60, { castAt: 0 });
ev = events(300);
const c = ev.find((e) => e[0] === "c");
assert.ok(c && c[1] === pet.id && c.length === 7 && c[6] > 500, "the charge is announced: " + JSON.stringify(c));
assert.ok(c[4] < c[2], "aimed at the player");
const x0 = pet.x;
assert.equal(events(300).filter((e) => e[0] === "h" && e[1] === p.eid).length, 0, "nothing lands during the wind-up");
ev = events(700);
assert.ok(pet.x < x0 - 40, "then it runs");
assert.ok(ev.some((e) => e[0] === "h" && e[1] === p.eid && e[2] > 0), "through whoever stood on the line");
// stepping off the line is enough
stand(); dress("lambmaw", 0, [], 60, { castAt: 0 });
events(200);
p.y += 30; p.mvAt = now;
const hpSide = p.hp;
events(900);
assert.equal(p.hp, hpSide, "a step to the side and it misses");

// ── volley: three shots, a beat in the air, one of them on target
stand(); dress("hydrasnake", 0, [], 50);
ev = events(200);
const vo = ev.find((e) => e[0] === "v");
assert.ok(vo && vo[1] === pet.id && vo.length === 3 + 6, "three shots are announced: " + JSON.stringify(vo));
assert.equal(ev.filter((e) => e[0] === "h" && e[1] === p.eid).length, 0, "nothing has landed yet");
pet.atkAt = 1e15;
ev = events(900);
assert.equal(ev.filter((e) => e[0] === "q").length, 3, "three land");
assert.equal(ev.filter((e) => e[0] === "h" && e[1] === p.eid && e[2] > 0).length, 1, "one of them on a player who stood still");

// ── pool: a puddle that lingers, bites and poisons, and dries up
stand(); dress("toadbrood", 0, [], 50, { castAt: 0, atkAt: 1e15 });
ev = events(200);
const g = ev.find((e) => e[0] === "g");
assert.ok(g && g[1] === pet.id && g.length === 8 && g[7] === 0, "the spit is announced: " + JSON.stringify(g));
pet.castAt = 1e15;
ev = events(2400);
assert.ok(ev.filter((e) => e[0] === "h" && e[1] === p.eid && e[2] > 0).length >= 2 && p.poison, "standing in it hurts, again and again, and poisons");
p.x += 80; p.mvAt = now; p.poison = null;
const hpOut = p.hp;
events(1500);
assert.equal(p.hp, hpOut, "stepping out ends it");
events(3000);
assert.equal(rt.pools.length, 0, "and it dries up");

// ── however thick the crowd, only a few come of their own accord
stand();
pet.dead = true;
const pack = rt.mobs.filter((m) => m.k === "lambmaw").slice(0, 12);
pack.forEach((m, i) => Object.assign(m, { dead: false, el: 0, tr: [], hp: 1e6, x: X + 20 + (i % 6) * 9, y: Y - 10 + Math.floor(i / 6) * 20, tgt: null, st: 0, stun: 0, act: null, castAt: 1e15, atkAt: 1e15, mvAt: 1e15, by: {} }));
pack.forEach((m) => { m.hx = m.x; m.hy = m.y; m.wx = m.x; m.wy = m.y; });
events(1500);
assert.equal(pack.filter((m) => m.tgt === PID).length, 3, "three at a time");
pack.forEach((m) => { m.dead = true; m.tgt = null; });

// ── ordinary monsters part with gear less often than they did (it used to be about 6% at level 1)
stand();
let gear = 0;
for (let i = 0; i < 3000; i++) { rt.kc = 0; dress("twinhare", 0, [], 14, { hp: 1, atkAt: 1e15 }); p.atkAt = 0; p.x = X; p.y = Y; act({ t: "atk" }); if (i % 50 === 0) { gear += rt.drops.filter((d) => d.g).length; rt.drops.length = 0; step(20); } }
gear += rt.drops.filter((d) => d.g).length + p.ch.inv.filter((s) => s.q !== undefined).length;
assert.ok(gear > 60 && gear < 165, "about four in a hundred: " + gear + " in 3000");

// ── red potions keep their worth: a fixed amount plus a share of the drinker's health
p.ch.inv = [{ id: "hp_s", n: 3 }];
stand(); p.potAt = 0;
const mhp = self().mhp;
p.hp = 1;
assert.ok(act({ t: "use", id: "hp_s" }).ok);
assert.equal(Math.round(p.hp), 1 + Math.round(60 + mhp * 0.1));

JSON.stringify(L.removePlayer(S, PID));
console.log("hard ok — traits", TRAITS.length, "variants", variants.length, "meadow", rt.mobs.length);
