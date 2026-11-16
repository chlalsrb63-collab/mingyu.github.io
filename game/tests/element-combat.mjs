import assert from "node:assert/strict";
import { arena } from "../scripts/balance-probe.mjs";
import { buildLogic } from "../scripts/build-logic.mjs";

const src = buildLogic().text +
  "\nexport const testCombat = { DAMAGE_TYPES, MOBS, T, assignElementEnchant, changeMap, elementInflict, hurtMob, mapOf, mobHit, newMob, stats };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.testCombat, D = L.defs(), S = L.setup();
S.now = 100_000;
const pid = "eight-elements@s1";
L.addPlayer(S, pid, L.hero("속성시험", { wk: "sword", lvl: 80, migrate: true }));
const p = S.players[pid];
const rt = S.maps[p.map];
const mob = X.newMob(S, "twinhare", null, null);
Object.assign(mob, { x: p.x + 12, y: p.y, hp: 10_000 });
rt.mobs.push(mob);
p.ch.eq.weapon.af = [["dmg_fire", 24], ["dmg_poison", 12]];
p.stc = null;

X.hurtMob(S, rt, mob, p, 1, true);
const hit = rt.ev.find(([kind, id]) => kind === "h" && id === mob.id);
assert.deepEqual(hit[7].map(([type]) => X.DAMAGE_TYPES[type]), ["physical", "fire", "poison"]);
assert.equal(hit[7].reduce((n, [, dmg]) => n + dmg, 0), hit[2], "floating damage adds up to the authoritative hit");
assert.equal(10_000 - mob.hp, hit[2]);

const attacker = X.newMob(S, "twinhare", null, null);
attacker.el = 1;
const seed = S.seed;
X.assignElementEnchant(S, attacker);
assert.notEqual(attacker.enchant, "physical");
assert.ok(X.DAMAGE_TYPES.includes(attacker.enchant));
assert.equal(S.seed, seed, "an enchant does not consume the combat or loot sequence");
attacker.enchant = "lightning";
attacker.tr = [];
p.hp = X.stats(p).mhp;
X.mobHit(S, rt, p, 40, attacker, "tele");
const received = rt.ev.findLast((e) => e[0] === "h" && e[1] === p.eid && e[2] > 0);
assert.ok(received[7].some(([type]) => X.DAMAGE_TYPES[type] === "lightning"), "enchanted monsters really deal typed damage");

X.elementInflict(S, rt, attacker, p, "cold", 40, { crit: true });
const snapshot = L.viewFor(S, pid);
const playerAilments = snapshot.ail.find(([id]) => id === p.eid)[1];
const monsterAilments = snapshot.ail.find(([id]) => id === mob.id)[1];
assert.ok(playerAilments.some(([i, left]) => D.elements.status[i].id === "freeze" && left > 0));
assert.ok(monsterAilments.some(([i, left]) => D.elements.status[i].id === "poison" && left > 0));
assert.equal(snapshot.elspd, 0);
assert.equal(L.validateAction(S, pid, { t: "atk" }).ok, false);
const x = p.x, y = p.y;
const walk = { t: "mv", x: x + 2, y };
assert.ok(L.validateAction(S, pid, walk).ok);
L.applyAction(S, pid, walk);
assert.deepEqual([p.x, p.y], [x, y], "the server refuses positional change while frozen");

function jobArena(id, front, targetKind) {
  const world = L.setup(), job = D.skills[id].job, [wk, wk2] = D.jobs[job].wk;
  world.now = 1_000_000;
  L.addPlayer(world, pid, L.hero("전직속성시험", { wk, wk2, lvl: 157, job, wm: { [wk]: 30, [wk2]: 30 } }));
  const hero = world.players[pid], [tx, ty] = arena(L, world, X.mapOf("meadow"));
  X.changeMap(world, hero, "meadow", tx * X.T + 8, ty * X.T + 10);
  const map = L.runtime(world, hero.map);
  for (const existing of map.mobs) { existing.dead = true; existing.respAt = Infinity; }
  const target = X.newMob(world, targetKind, null, null);
  Object.assign(target, { x: hero.x + front, y: hero.y, hp: 50_000, stun: world.now + 10_000 });
  map.mobs.push(target);
  return { world, hero, map, target };
}

function castJobSkill(world, id) {
  const cmd = { t: "sk", id, a: 0 }, valid = L.validateAction(world, pid, cmd);
  assert.ok(valid.ok, `${id}: ${valid.error}`);
  L.applyAction(world, pid, cmd);
}

function jobHits(id, front, ticks = 0, targetKind = "twinhare") {
  const { world, map, target } = jobArena(id, front, targetKind);
  castJobSkill(world, id);
  for (let i = 0; i < ticks; i++) L.tick(world, world.now + 100);
  const hits = map.ev.filter(([kind, eid, damage]) => kind === "h" && eid === target.id && damage > 0);
  assert.ok(hits.length, `${id}: real skill cast hits the target`);
  return hits.map((e) => {
    const split = e[7] || [[0, e[2]]];
    assert.equal(split.reduce((sum, [, dmg]) => sum + dmg, 0), e[2], `${id}: damage wire totals match`);
    return { damage: e[2], types: split.map(([type]) => D.elements.types[type]) };
  });
}

for (const wk of D.wkOrder) assert.equal(D.elements.basic[wk], "physical", `${wk}: basic attack starts with physical damage`);
for (const [id, pct] of [["rain", 25], ["hammer_final", 35], ["crosscut", 25], ["ironsiege", 30]]) {
  assert.equal(D.skills[id].damageType, "physical", `${id}: physical specialty shown in skill metadata`);
  assert.equal(D.skills[id].armorPenPct, pct, `${id}: armor penetration visible to the client`);
}

for (const [id, primary, secondary] of [["verdict", "physical", "fire"], ["crosscut", "physical", "bleed"], ["inkshot", "cold", "dark"], ["elemfan", "lightning", "dark"], ["dive", "lightning", "dark"]]) {
  const skill = D.skills[id];
  assert.deepEqual([skill.damageType, skill.secondaryDamageType], [primary, secondary], `${id}: both types visible to the client`);
}

assert.deepEqual(jobHits("crosscut", 24).map((hit) => hit.types), [["physical"], ["physical", "bleed"]], "crosscut's sweep and stab have distinct damage components");
for (const [id, front, ticks, types] of [["verdict", 24, 0, ["physical", "fire"]], ["inkshot", 50, 5, ["cold", "dark"]], ["elemfan", 28, 0, ["lightning", "dark"]]]) {
  assert.ok(jobHits(id, front, ticks).some((hit) => types.every((type) => hit.types.includes(type))), `${id}: both listed types travel through the real hit path`);
}

// The delayed zone must use the skill's armor penetration when it actually hits.
const rain = D.skills.rain, rainPen = rain.armorPenPct;
const piercing = jobHits("rain", 70, 4, "gatorhalf")[0];
try {
  rain.armorPenPct = 0;
  const normal = jobHits("rain", 70, 4, "gatorhalf")[0];
  assert.deepEqual(piercing.types, ["physical"]);
  assert.ok(piercing.damage > normal.damage, "arrow rain with physical specialization pierces armor");
} finally {
  rain.armorPenPct = rainPen;
}

{
  const { world, hero, map, target } = jobArena("dive", 24, "twinhare");
  const start = world.now;
  hero.hp = Math.floor(X.stats(hero).mhp / 2);
  const hits = () => map.ev.filter(([kind, eid, damage]) => kind === "h" && eid === target.id && damage > 0);
  const heals = () => map.ev.filter(([kind, eid, damage]) => kind === "h" && eid === hero.eid && damage < 0).map((e) => -e[2]);
  const types = (e) => e[7].map(([type]) => D.elements.types[type]);
  castJobSkill(world, "dive");
  assert.equal(hits().length, 1, "landing hits once");
  assert.ok(types(hits()[0]).includes("lightning") && !types(hits()[0]).includes("dark"), "landing carries lightning");
  const ailments = L.viewFor(world, pid).ail.find(([id]) => id === target.id)[1];
  assert.ok(ailments.some(([i, left]) => D.elements.status[i].id === "shock" && left > 0), "landing applies shock");
  for (let elapsed = 100; elapsed < 500; elapsed += 100) L.tick(world, start + elapsed);
  assert.equal(hits().length, 1, "field waits for its first 500 ms pulse");
  assert.deepEqual(heals(), [], "landing does not steal life");
  const before = target.hp;
  L.tick(world, start + 500);
  assert.equal(hits().length, 2);
  assert.ok(types(hits()[1]).includes("dark") && !types(hits()[1]).includes("lightning"), "field carries dark damage");
  assert.deepEqual(heals(), [Math.round((before - target.hp) * 0.3)], "field heals 30% of damage exactly once");

  target.hp = 9;
  for (let elapsed = 600; elapsed <= 1000; elapsed += 100) L.tick(world, start + elapsed);
  assert.ok(target.dead && hits()[2][2] > 9, "second field pulse overkills the target");
  assert.equal(heals().at(-1), 3, "field life-steal is capped at the HP lost before death");
}

console.log("elemental combat: damage wire, elite attacks, ailments, dual-type jobs, armor penetration and Dragoon phases");
