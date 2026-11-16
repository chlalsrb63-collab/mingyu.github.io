import assert from "node:assert/strict";
import { buildLogic } from "../scripts/build-logic.mjs";

const source = buildLogic().text + `\nexport const elementTest = {
  DAMAGE_TYPES, ELEMENT_STATUS, MOBS, deriveStats, newMob, monsterElement,
  elementDamage, elementResist, elementActive, elementApplyHit, elementInflict, elementTick,
  elementOutgoing, elementTaken, elementHealFactor, elementMiss, elementMoveFactor,
  elementAttackFactor, elementFrozen, elementShield, elementClear, elementStatusRows, elementMark, elementMoving,
};\n`;
const { elementTest: E, ...L } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))
  .catch((error) => { throw new Error(error.message); });

const S = L.setup();
S.now = 50_000;
const makePlayer = (pid, name) => {
  L.addPlayer(S, pid, L.hero(name, { wk: "sword", lvl: 100, migrate: true }));
  const p = S.players[pid];
  p.map = "meadow";
  E.deriveStats(p);
  p.stc = { ...p.stc, res: 0, element: {} };
  return p;
};
const p = makePlayer("attacker", "공격수"), q = makePlayer("target", "수련생"), rt = L.runtime(S, p.map);
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);
const active = (target, id) => E.elementActive(S, target, id);
const inflict = (type, opts) => E.elementInflict(S, rt, p, q, type, 100, opts);
const indexed = (target, id) => E.elementStatusRows(S, target).find(([idIndex]) => E.ELEMENT_STATUS[idIndex].id === id);

assert.deepEqual(E.DAMAGE_TYPES, ["physical", "bleed", "fire", "cold", "lightning", "poison", "dark", "light"]);
assert.deepEqual(E.elementStatusRows(S, q), []);
assert.deepEqual(E.elementDamage(S, p, q, 100, 50), [["physical", 50]]);
const seed = S.seed;
assert.deepEqual(E.elementDamage(S, p, q, 100, 50, { crit: true }), [["physical", 56]]);
E.elementApplyHit(S, rt, p, q, [["physical", 56]], { crit: true });
assert.ok(active(q, "shatter"));
near(E.elementDamage(S, p, q, 100, 50)[0][1], 55);
assert.equal(S.seed, seed, "damage and ailments use their own deterministic random stream");
E.elementClear(q);

assert.deepEqual(E.elementDamage(S, p, q, 100, 40, { armorPenPct: 25 }), [["physical", 70]]);
near(E.elementDamage(S, p, q, 100, 40, { armorPenPct: 25, crit: true })[0][1], 100 - 40 * 0.75 * 0.88);
assert.deepEqual(E.elementDamage(S, p, q, 100, 0, { secondaryType: "bleed" }), [["physical", 75], ["bleed", 25]]);
assert.deepEqual(E.elementDamage(S, p, q, 100, 0, { type: "cold", secondaryType: "dark" }), [["physical", 60], ["cold", 25], ["dark", 15]]);
q.stc.element.res = { physical: 20, cold: 50 };
const mixedOpts = { type: "cold", secondaryType: "dark" };
const regular = Object.fromEntries(E.elementDamage(S, p, q, 100, 40, mixedOpts));
const armorPiercing = Object.fromEntries(E.elementDamage(S, p, q, 100, 40, { ...mixedOpts, armorPenPct: 25 }));
assert.deepEqual(regular, { physical: 16, cold: 12.5, dark: 15 });
assert.deepEqual(armorPiercing, { ...regular, physical: 24 }, "armor penetration changes only the armor deduction, with resistance still applied");

q.stc.element.res = { fire: 50, poison: 25, cold: -20 };
assert.equal(E.elementResist(S, q, "fire", 30), 0.8);
assert.equal(E.elementResist(S, q, "fire", 60), 1);
assert.equal(E.elementResist(S, q, "cold", 60), 1.2);
p.stc.element = { damage: { fire: 10, poison: 8 }, pen: { fire: 30 } };
const parts = Object.fromEntries(E.elementDamage(S, p, q, 100, 20, { type: "fire", extraScale: 0.5 }));
assert.equal(parts.physical, 55);
near(parts.fire, (25 + 5) * 1.12 * 0.8);
assert.equal(parts.poison, 3);
assert.deepEqual(E.elementDamage(S, p, q, 100, 80, { pure: true }), [["physical", 100]]);
p.stc.element = {};

const lightning = new Set(Array.from({ length: 20 }, () => Object.fromEntries(E.elementDamage(S, p, q, 100, 0, { type: "lightning" })).lightning));
assert.ok(Math.min(...lightning) < 18);
assert.ok(Math.max(...lightning) > 30);
const holyKind = Object.keys(E.MOBS).find((k) => E.monsterElement(k).holyWeak && !E.MOBS[k].chest);
assert.ok(holyKind);
const holyMob = E.newMob(S, holyKind, null, null);
near(E.elementDamage(S, p, holyMob, 100, 0, { type: "light", typedOnly: true })[0][1], 135 * E.elementResist(S, holyMob, "light"));

inflict("bleed", { dotDamage: 4 });
inflict("bleed", { dotDamage: 3 });
assert.equal(indexed(q, "bleed")[2], 2);
q.hp = 300;
q.elementRunAt = 0;
S.now += 1000;
assert.equal(E.elementTick(S, rt, q), false);
assert.equal(q.hp, 293, "a standing player suffers normal bleed ticks");
q.x += 12;
S.now += 1000;
q.elementRunAt = S.now;
E.elementTick(S, rt, q);
assert.equal(q.hp, 279, "actual movement doubles bleed damage");
q.elementRunAt = 0;
q.x += 8;
assert.ok(!E.elementMoving(S, q), "a live actor is not kiting merely because it was shoved");
q.elementRunAt = S.now;
assert.ok(E.elementMoving(S, q), "a live actor's movement stamp counts");
delete q.elementRunAt;
E.elementClear(q);

assert.ok(inflict("fire"));
assert.ok(E.elementHealFactor(S, q) < 1);
assert.equal(indexed(q, "burn")[2], 1);
E.elementClear(q, "burn");
assert.equal(E.elementHealFactor(S, q), 1);
E.elementMark(S, q, "burn", 1300);
assert.ok(indexed(q, "burn") && E.elementHealFactor(S, q) < 1);
const markedHp = q.hp;
S.now += 1000;
E.elementTick(S, rt, q);
assert.equal(q.hp, markedHp, "a timed burn supplied by an old effect does not deal damage twice");
E.elementClear(q, "burn");

for (let i = 0; i < 120; i++) inflict("poison", { dotDamage: 1 });
assert.equal(indexed(q, "poison")[2], 120, "poison has no stack cap");
assert.equal(q.ail.poison.sources.get(p.pid).size, 1, "a shared expiration uses one bucket");
assert.ok(E.elementOutgoing(S, q) < 1);
S.now += 1000;
E.elementTick(S, rt, q);
assert.equal(q.hp, 159);
E.elementClear(q);

q.dirty = false;
inflict("cold");
assert.ok(q.dirty, "chill updates the client's attack cadence");
assert.ok(E.elementMoveFactor(S, q) < 1 && E.elementAttackFactor(S, q) > 1);
q.dirty = false;
S.now += 2700;
E.elementTick(S, rt, q);
assert.ok(q.dirty && E.elementAttackFactor(S, q) === 1, "chill expiry restores cadence in the snapshot");
inflict("cold");
inflict("cold");
assert.equal(indexed(q, "chill")[2], 2);
inflict("cold");
assert.ok(E.elementFrozen(S, q));
assert.ok(active(q, "freeze"));
E.elementClear(q);
inflict("cold", { crit: true });
assert.ok(active(q, "freeze"), "a cold crit can freeze immediately");
const bossKind = Object.keys(E.MOBS).find((k) => E.MOBS[k].boss);
const boss = E.newMob(S, bossKind, null, null);
for (let i = 0; i < 3; i++) E.elementInflict(S, rt, p, boss, "cold", 20, { crit: true });
assert.ok(active(boss, "chill") && !E.elementFrozen(S, boss), "bosses keep chill with no hard stun");
E.elementClear(q);

inflict("lightning");
assert.ok(active(q, "shock") && E.elementFrozen(S, q));
assert.equal(E.elementTaken(S, q), 1.10);
S.now += 200;
assert.ok(active(q, "shock") && !E.elementFrozen(S, q));
inflict("lightning");
assert.ok(!E.elementFrozen(S, q), "lightning stagger has an internal lockout");
E.elementClear(q);

inflict("dark");
assert.ok(E.elementResist(S, q, "fire") > 0.5);
assert.ok(Array.from({ length: 60 }, () => E.elementMiss(S, q)).includes(true));
const hp = Math.floor(p.stc.mhp / 2);
p.hp = hp;
E.elementApplyHit(S, rt, p, q, [["dark", 40]], { scale: 0.5 });
assert.equal(p.hp, hp + 3, "dark leech uses actual HP damage");
E.elementClear(q);

p.hp = p.stc.mhp;
for (let i = 0; i < 20; i++) inflict("light");
assert.ok(active(q, "blind") && active(p, "ward"), "holy hits can blind or protect");
assert.equal(E.elementShield(S, p, p.ail.ward.amount + 9), 9);
assert.ok(!active(p, "ward"));
console.log("element engine: 8 damage types, resistance and penetration, split rolls, all 11 markers, stacking and mitigation");
