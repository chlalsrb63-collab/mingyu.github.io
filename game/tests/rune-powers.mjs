import assert from "node:assert/strict";
import { buildLogic } from "../scripts/build-logic.mjs";

const source = buildLogic().text + "\nexport const testRunes = { RUNE_SETS, RUNE_SET_MAX, MOBS, activeRuneSets, pfxBuild, pfxStat, pfxLoot, pfxPre, pfxMul, pfxHit, pfxSkill, pfxMiti, pfxLethal, pfxNum, runePoisonFactor, elementTick, elementClear, elementActive, runeSkillDamage, runeMoveSkill, runeHidden, runeEarnGold, runeShock, syncRuneActive, newMob, stats, dealMob, hurtMob };\n";
const { testRunes: X, ...L } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))
  .catch((error) => { throw new Error(error.message); });

const { RUNE_SETS: sets } = X;
assert.equal(Object.keys(sets).length, 18);
assert.deepEqual([2, 3, 4].map((size) => Object.values(sets).filter((set) => set.need === size).length), [6, 6, 6]);
assert.equal(X.RUNE_SET_MAX, 2);
assert.deepEqual(X.activeRuneSets({ willowwind: 6, ashbloom: 3, blackstar: 4, dawnpillar: 4 }), ["dawnpillar", "blackstar"]);
assert.deepEqual(X.activeRuneSets({ duskfang: 4, moonveil: 3, astrolabe: 3 }), ["duskfang"]);

const S = L.setup();
S.now = 1000000;
const pid = "runes-power-check";
L.addPlayer(S, pid, L.hero("룬시험", { wk: "sword", lvl: 120, migrate: true }));
const p = S.players[pid];
p.map = "meadow";
const rt = L.runtime(S, p.map);
const base = X.stats(p);
const mkMob = (x, y) => Object.assign(X.newMob(S, "twinhare", [0, 0, 0, 0]), { x, y, hp: 1000 });
const target = mkMob(200, 200);
const near = mkMob(228, 210);
const other = mkMob(248, 220);
const distant = mkMob(521, 400);
rt.mobs = [target, near, other, distant];
const active = (...ids) => {
  p.pc = null;
  p.stc = { ...p.stc, runeSets: ids, pfx: X.pfxBuild({}, ids) };
  S.seed = 0;
  p.hp = base.mhp;
  p.ghost = 0;
  p.ch.runeWardAt = 0;
  return { ...base, runeSets: ids, pfx: p.stc.pfx, proc: 1 };
};
const attempt = (st, callback) => {
  for (let i = 0; i < 256; i++) {
    if (callback(st)) return;
    S.seed = i + 1;
  }
  assert.fail("deterministic seed sample did not trigger the tested proc");
};

let st = active("willowwind");
const sheet = { spd0: 90 };
st.pfx.sheet[0](p, sheet, {});
assert.ok(sheet.spd0 > 100);
st.pfx.evade[0](S, rt, p, st);
X.pfxStat(p, st);
assert.ok(st.acd < base.acd, "evade grants a short attack haste");

st = active("duskfang");
p.hp = st.mhp / 2;
const lastHit = mkMob(235, 222);
lastHit.hp = 1;
X.dealMob(S, rt, lastHit, p, 1, false);
assert.ok(lastHit.dead && p.hp > st.mhp / 2, "even a direct damage kill grants the heal");
const healed = p.hp;
attempt(st, () => { X.pfxHit(S, rt, p, st, target, 500, false, false, {}); return p.hp > healed; });
assert.ok(p.hp <= st.mhp * 0.58 + 0.001);

st = active("lantern");
assert.ok(X.pfxMiti(S, rt, p, st, target, Math.round(st.mhp * 0.3), 1000) < st.mhp * 0.3);
assert.equal(X.pfxMiti(S, rt, p, st, target, 300, 300), 300, "barrier only refreshes on its internal cooldown");

st = active("brassscale");
assert.ok(X.pfxLoot(S, rt, p, target, "drop").gold > 0);
assert.ok(X.pfxLoot(S, rt, p, target, "drop").mf > 0);
X.runeEarnGold(S, p, 100000);
X.pfxStat(p, st);
assert.ok(st.atk > base.atk && st.atk <= Math.round(base.atk * 1.12));

st = active("azureknot");
assert.ok(X.pfxNum(p, "mp", 100) < 100);
const kSheet = { cdr: 0.12 };
st.pfx.sheet[0](p, kSheet, {});
assert.ok(kSheet.cdr > 0.12);

st = active("ashbloom");
attempt(st, () => { X.pfxHit(S, rt, p, st, target, 100, false, false, {}); return X.elementActive(S, target, "burn"); });
assert.ok(X.elementActive(S, near, "burn") && !X.elementActive(S, distant, "burn"));
for (const mob of [target, near, other]) X.elementClear(mob);

st = active("silverlake");
X.pfxHit(S, rt, p, st, target, 100, false, false, {});
assert.ok(X.elementActive(S, target, "chill"));
assert.ok(X.pfxMul(S, p, st, target, {}, {}, true) > X.pfxMul(S, p, st, target, {}, {}, false));

st = active("stormsail");
const lightningHp = near.hp;
attempt(st, () => { X.pfxHit(S, rt, p, st, target, 100, false, false, {}); return near.hp < lightningHp; });
assert.ok(rt.ev.some(([event]) => event === "z"));
assert.ok(X.elementActive(S, near, "shock"));

st = active("inkthorn");
for (let i = 0; i < 9; i++) {
  X.pfxHit(S, rt, p, st, target, 100, true, false, {});
  S.now += 500;
}
assert.equal(target.runePoison.stacks, 4);
assert.equal(X.runePoisonFactor(S, target), 1.06);
const allyId = "runes-power-ally";
L.addPlayer(S, allyId, L.hero("동료시험", { wk: "sword", lvl: 120, migrate: true }));
const ally = S.players[allyId];
ally.map = p.map;
const beforeSharedHit = target.hp;
X.dealMob(S, rt, target, ally, 20, false);
assert.ok(beforeSharedHit - target.hp > 20 && target.by[allyId] > 20, "another player's damage gains the same vulnerability");
const poisonHp = target.hp;
S.now += 1000;
X.elementTick(S, rt, target);
assert.ok(target.hp < poisonHp);
target.runePoison = null;
X.elementClear(target);

st = active("lastbell");
target.hp = 1;
assert.ok(X.pfxMul(S, p, st, target, {}, {}, false) > 1);
X.pfxHit(S, rt, p, st, target, 100, false, false, {});
assert.ok(target.dead, "the execute works on an ordinary enemy");
assert.ok(!near.dead);
const bossKind = Object.keys(X.MOBS).find((k) => X.MOBS[k].boss);
const boss = X.newMob(S, bossKind, [0, 0, 0, 0]);
boss.hp = 1;
X.pfxHit(S, rt, p, st, boss, 100, false, false, {});
assert.equal(boss.hp, 1, "bosses never take the execute packet");

st = active("redanvil");
p.hp = st.mhp * 0.7;
X.pfxStat(p, st);
const highHpAtk = st.atk;
st = active("redanvil");
p.hp = st.mhp * 0.16;
X.pfxStat(p, st);
assert.ok(st.atk > highHpAtk * 1.12 && st.atk <= Math.round(base.atk * 1.18) && st.acd < base.acd);
assert.ok(X.pfxMiti(S, rt, p, st, near, 300, 300) < 300);

st = active("astrolabe");
assert.equal(X.runeSkillDamage(S, p, st, { mult: 1 }), 1);
p.cds.bolt = S.now + 10000;
attempt(st, () => { X.pfxSkill(S, rt, p, st, { name: "불꽃", mult: 1 }, "bolt", 100); return p.cds.bolt <= S.now; });
const skillBoost = X.runeSkillDamage(S, p, st, { mult: 1 });
assert.ok(skillBoost > 1 && skillBoost <= 1.22);
assert.equal(X.runeSkillDamage(S, p, st, { mult: 1 }), 1);

st = active("dawnpillar");
p.hp = -35;
p.save = false;
assert.ok(X.pfxLethal(S, rt, p, st, near, 500));
assert.equal(p.hp, Math.round(st.mhp * 0.35));
assert.ok(p.ghost > S.now && p.ch.runeWardAt > S.now + 60000 && p.save);
p.pc = null;
p.hp = -1;
assert.ok(!X.pfxLethal(S, rt, p, st, near, 500));

st = active("moonveil");
X.runeMoveSkill(S, p);
assert.ok(X.runeHidden(p, S.now));
assert.equal(X.pfxPre(S, p, st, near, {}, { px: 1 }).sure, 0, "secondary procs cannot consume stealth");
assert.ok(X.runeHidden(p, S.now));
assert.equal(X.pfxPre(S, p, st, near, {}, {}).sure, 1);
assert.ok(!X.runeHidden(p, S.now));
assert.equal(X.pfxPre(S, p, st, near, {}, {}).sure, 0);
S.now += 8500;
X.runeMoveSkill(S, p);
assert.ok(X.runeHidden(p, S.now));
X.syncRuneActive(p, []);
assert.ok(!X.runeHidden(p, S.now));
X.runeMoveSkill(S, p);
assert.ok(!X.runeHidden(p, S.now), "re-equipping does not clear an internal cooldown");

st = active("blackstar");
attempt(st, () => X.pfxPre(S, p, st, near, {}, {}).pure);
assert.equal(X.pfxPre(S, p, st, near, {}, {}).pure || 0, 0);
const shockHp = other.hp;
X.runeShock(S, rt, p, near.x, near.y, near);
assert.ok(other.hp < shockHp && distant.hp === 1000);
p.pc = null;
const beforeAttack = other.hp;
attempt(st, () => {
  X.hurtMob(S, rt, near, p, 0.01, false);
  return other.hp < beforeAttack;
});
assert.ok(!near.dead && !distant.dead, "an actual attack can proc a local shockwave");
console.log("rune powers: all 18 sets, the first 15 effects, cooldowns and active set priority passed");
