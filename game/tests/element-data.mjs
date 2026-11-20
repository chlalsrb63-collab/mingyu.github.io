import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const test = { DAMAGE_TYPES, ELEMENT_AFFIX, MONSTER_ELEMENT_GROUPS, gearBonus, migrate, monsterElement, plain, rollGear, skillDamageType };\n";
const L = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const { DAMAGE_TYPES, ELEMENT_AFFIX, MONSTER_ELEMENT_GROUPS, gearBonus, migrate, monsterElement, plain, rollGear, skillDamageType } = L.test;
const D = L.defs();

assert.deepEqual(DAMAGE_TYPES, ["physical", "bleed", "fire", "cold", "lightning", "poison", "dark", "light"]);
const profiled = Object.values(MONSTER_ELEMENT_GROUPS).flat();
assert.equal(new Set(profiled).size, profiled.length, "monster profiles must not overwrite one another");
assert.ok(profiled.every((id) => Object.hasOwn(D.mobs, id)), "every assigned profile is for a real monster");
for (const [id, mob] of Object.entries(D.mobs)) {
  const { type, res, holyWeak } = monsterElement(id);
  assert.ok(DAMAGE_TYPES.includes(type), id);
  assert.deepEqual([mob.element, mob.resist, mob.holyWeak], [type, res, holyWeak]);
  assert.ok(Object.entries(res).every(([k, v]) => DAMAGE_TYPES.includes(k) && Number.isInteger(v) && v >= -30 && v <= 80), id);
}
assert.deepEqual(monsterElement("boss").res, { fire: 80, bleed: 14, cold: -30 });
assert.equal(monsterElement("twinhare_bone").holyWeak, true);
assert.ok(monsterElement("twinhare_bone").res.light < 0);
assert.ok(monsterElement("prismcantor").res.dark < 0);
const supports = new Set(["rally_banner", "revive_binding", "smoke"]);
for (const [id, sk] of Object.entries(D.skills)) {
  if (supports.has(id)) assert.equal(sk.damageType, null, id);
  else if (sk.kind !== "p") assert.ok(DAMAGE_TYPES.includes(sk.damageType), id);
}
for (const [id, type] of [["fireball", "fire"], ["frostring", "cold"], ["chainbolt", "lightning"], ["oathward", "light"], ["pact", "dark"], ["traps", "poison"], ["rupture", "bleed"], ["hammer_stamp", "physical"]]) {
  assert.equal(skillDamageType(id, "sword"), type);
  assert.equal(skillDamageType(D.skills[id], "sword"), type);
}

const groups = [["w_warrior_6", false], ["a_6", true], ["r_6", true], ["n_6", true]];
for (const [id, defensive] of groups) {
  const seed = { seed: 13571 }, typed = new Set();
  for (let i = 0; i < 300; i++) {
    const g = rollGear(seed, id, 5, 50);
    const keys = g.af.map(([key]) => key);
    assert.equal(keys.length, 4);
    assert.equal(new Set(keys).size, 4);
    for (const k of keys) if (Object.hasOwn(ELEMENT_AFFIX, k)) {
      assert.equal(k.startsWith("res_"), defensive, `${id}: ${k}`);
      typed.add(k);
    }
  }
  assert.ok(typed.size >= (defensive ? 9 : 24), id);
}

for (const [i, n] of [20, 16, 16, 76].entries()) {   // (76: 18 sets × 4 + 4 element lines, balance 2026-11-20)
  const grade = i + 1, rows = Object.values(D.runes).filter((r) => r.q === grade);
  assert.equal(rows.length, n);
  assert.ok(rows.every((r) => r.af.length === (grade === 4 ? 1 : grade)));
}
for (const type of DAMAGE_TYPES) {
  const rune = D.runes[`ru_e_${type}_3`];
  assert.deepEqual(rune.af.map(([key]) => key), [`dmg_${type}`, `pen_${type}`, `res_${type}`]);
}

const ch = L.newChar("원소시험", []);
ch.eq.weapon = { ...plain("w_bloodcrown"), q: 3, il: 170, lg: "chain", af: [["dmg_fire", 7]], sk: 1, ru: ["ru_e_fire_2"] };
ch.eq.armor = { ...plain("a_6"), q: 3, il: 150, lg: "chain", af: [["res_all", 3], ["res_cold", 8]] };
ch.eq.weapon2 = { ...plain("w_bow_6"), af: [["dmg_light", 20]], sk: 1, ru: ["ru_e_light_3"] };
const loaded = migrate(ch);
const { element } = gearBonus(loaded);
assert.deepEqual(element.damage, { fire: 9, bleed: 12, light: 3 });
assert.deepEqual(element.pen, { fire: 1, lightning: 8, light: 1 });
assert.deepEqual(element.proc, { bleed: 5 });
assert.deepEqual(element.dur, { lightning: 8 });
for (const k of DAMAGE_TYPES) assert.equal(element.res[k], k === "cold" ? 11 : k === "light" ? 5 : 3);
assert.deepEqual(gearBonus(migrate(structuredClone(loaded))).element, element, "typed equipment survives a second save load");

console.log("element-data ok — monster profiles, skill types, slot affixes, 116 runes and legacy gear loadout");
