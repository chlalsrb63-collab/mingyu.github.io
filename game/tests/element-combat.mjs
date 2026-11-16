import assert from "node:assert/strict";
import { buildLogic } from "../scripts/build-logic.mjs";

const src = buildLogic().text +
  "\nexport const testCombat = { DAMAGE_TYPES, MOBS, T, assignElementEnchant, elementInflict, hurtMob, mobHit, newMob, stats };\n";
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

console.log("elemental combat: damage wire, elite attack, player and monster ailments, freeze movement guard");
