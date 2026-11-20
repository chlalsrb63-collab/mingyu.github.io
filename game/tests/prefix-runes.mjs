// Behavioral tests for the 19 rune-inspired legendary prefix enchants (src/logic/54-prefix-runes.js).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { LEGEND, PFX, PFX_FN, PX, plain, stats, newMob, hurtMob, hurtPlayer, chainBlow, pfxPre, pfxMul, pfxMiti, pfxSkill, pfxPc, encPool };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;

function world(name) {
  const S = L.setup();
  let now = 3_000_000;
  S.now = now; S.last = now;
  const PID = "pid-" + name;
  L.addPlayer(S, PID, L.hero(name, { wk: "sword", lvl: 120, migrate: true }));
  const W = {
    S, PID,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); L.endTick(S); },
    get p() { return S.players[PID]; },
    get rt() { return S.maps[S.players[PID].map]; },
    mob(k, x, y, o = {}) { const m = Object.assign(X.newMob(S, k, [0, 0, 0, 0]), { x, y, hp: 1e6 }, o); W.rt.mobs.push(m); return m; },
    wear(slot, id, lg) { W.p.ch.eq[slot] = { ...X.plain(id), q: 3, il: 120, lg }; W.p.stc = null; },
  };
  const p = W.p;
  L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
  W.step();
  p.x = 200; p.y = 200; p.mvAt = now; p.hp = 1e6; p.mp = 1e6; p.stag = 0; p.dead = false;
  for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
  W.p.ch.eq = { weapon: W.p.ch.eq.weapon };
  return W;
}

// 1. Enchant pools include new O / D / U prefixes
assert.ok(X.encPool("weapon", "O").includes("thrill") && X.encPool("weapon", "O").includes("dazzling"));
assert.ok(X.encPool("armor", "D").includes("steel") && X.encPool("armor", "D").includes("tenacity"));
assert.ok(X.encPool("helm", "U").includes("wisdom") && X.encPool("helm", "U").includes("steadfast"));

// 2. dazzling (현란한): +8% crit, +20% crit mul
{
  const W = world("dazzling");
  W.wear("weapon", "w_warrior_3", "dazzling");
  const m = W.mob("twinhare", 220, 200), st = X.stats(W.p);
  const pre = X.pfxPre(W.S, W.p, st, m, {}, {});
  assert.ok(pre.crit >= 8 || st.crit + pre.crit === 75, "dazzling adds +8% crit");
  assert.equal(X.pfxMul(W.S, W.p, st, m, {}, {}, true), 1.2);
  assert.equal(X.pfxMul(W.S, W.p, st, m, {}, {}, false), 1);
}

// 3. ruthless (냉혹한): non-crits stack +10% crit up to 5, crit resets to 0
{
  const W = world("ruthless");
  W.wear("weapon", "w_warrior_3", "ruthless");
  const m = W.mob("twinhare", 220, 200);
  X.PFX_FN.ruthless.hit(W.S, W.rt, W.p, X.stats(W.p), m, 100, false, false);
  X.PFX_FN.ruthless.hit(W.S, W.rt, W.p, X.stats(W.p), m, 100, false, false);
  assert.equal(X.pfxPc(W.p).n.ruthless, 2);
  X.PFX_FN.ruthless.hit(W.S, W.rt, W.p, X.stats(W.p), m, 100, true, false);
  assert.equal(X.pfxPc(W.p).n.ruthless, 0);
}

// 4. gale (질풍의): 3rd hit on same target splashes nearby mob
{
  const W = world("gale");
  W.wear("weapon", "w_warrior_3", "gale");
  const m1 = W.mob("twinhare", 210, 200), m2 = W.mob("twinhare", 225, 200);
  const hp2 = m2.hp;
  X.hurtMob(W.S, W.rt, m1, W.p, 1, false);
  X.hurtMob(W.S, W.rt, m1, W.p, 1, false);
  assert.equal(m2.hp, hp2, "no splash before 3rd hit");
  X.hurtMob(W.S, W.rt, m1, W.p, 1, false);
  assert.ok(m2.hp < hp2, "3rd hit triggers gale shockwave on nearby foe");
}

// 5. wonder (경이의): basic blow trims 6% off active skill cooldowns
{
  const W = world("wonder");
  W.wear("weapon", "w_warrior_3", "wonder");
  const m = W.mob("twinhare", 215, 200);
  W.p.cds.rend = W.S.now + 10000;
  X.chainBlow(W.S, W.rt, W.p, X.stats(W.p), m, 215, 200, false);
  assert.equal(W.p.cds.rend, W.S.now + 9400);
}

// 6. plague (역병의): killing rotted mob spreads poison DoT to nearby foe
{
  const W = world("plague");
  W.wear("weapon", "w_warrior_3", "plague");
  const m1 = W.mob("twinhare", 210, 200, { hp: 1 }), m2 = W.mob("twinhare", 225, 200);
  X.hurtMob(W.S, W.rt, m1, W.p, 10, false);
  assert.ok(m1.dead);
  assert.ok((X.pfxPc(W.p).v.plague || []).some((e) => e.m === m2), "plague spread DoT to nearby foe");
}

// 7. brawl (격전의) & scrum (난투의): scale with nearby mobs
{
  const W = world("crowd");
  W.wear("weapon", "w_warrior_3", "brawl");
  W.wear("armor", "a_3", "scrum");
  W.mob("twinhare", 210, 200);
  W.mob("twinhare", 215, 200);
  W.mob("twinhare", 220, 200);
  W.step(1100);
  assert.ok(Math.abs(X.pfxMul(W.S, W.p, X.stats(W.p), W.rt.mobs[0], {}, {}, false) - 1.09) < 1e-6);
  const dmg = X.pfxMiti(W.S, W.rt, W.p, X.stats(W.p), W.rt.mobs[0], 1000, 1000);
  assert.equal(dmg, 910);
}

// 8. steel / steady / snipe / surge / scarcity stat hooks
{
  const W = world("stats");
  const base = X.stats(W.p);
  W.wear("armor", "a_3", "steel");
  assert.ok(X.stats(W.p).def > base.def, "steel raises DEF");
  W.wear("armor", "a_3", "steady");
  W.p.hp = X.stats(W.p).mhp;
  const hi = X.stats(W.p).atk;
  W.p.hp = Math.floor(X.stats(W.p).mhp * 0.5);
  assert.ok(hi > X.stats(W.p).atk, "steady raises ATK above 75% HP");
  W.wear("boots", "b_3", "snipe");
  W.p.mvAt = W.S.now;
  const moving = X.stats(W.p).atk;
  W.p.mvAt = W.S.now - 3500;
  assert.ok(X.stats(W.p).atk > moving, "snipe raises ATK when standing still 3s");
  W.wear("amulet", "n_4", "scarcity");
  W.p.mp = X.stats(W.p).mmp;
  const fullMp = X.stats(W.p).atk;
  W.p.mp = Math.floor(X.stats(W.p).mmp * 0.2);
  assert.ok(X.stats(W.p).atk > fullMp, "scarcity raises ATK below 50% MP");
}

// 9. tenacity (끈기의) & wisdom (지혜로운) & steadfast (부동의)
{
  const W = world("util");
  W.wear("armor", "a_3", "tenacity");
  W.wear("helm", "h_3", "wisdom");
  const st = X.stats(W.p);
  W.p.hp = Math.floor(st.mhp * 0.45);
  X.PFX_FN.tenacity.hurt(W.S, W.rt, W.p, st, null, 100);
  assert.equal(X.pfxMiti(W.S, W.rt, W.p, st, null, 1000, 1000), 760, "tenacity reduces damage by 24%");
  W.p.cds.rend = W.S.now + 10000;
  X.pfxSkill(W.S, W.rt, W.p, st, {}, "rend", 10);
  assert.equal(W.p.cds.rend, W.S.now + 8500, "wisdom trims skill cooldown by 15%");
}

console.log("prefix-runes ok");
