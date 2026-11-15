import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arena, ARENA } from "../scripts/balance-probe.mjs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8");
const { __hammer: H, ...L } = await import("data:text/javascript;base64," + Buffer.from(src + `
export const __hammer = { canStand, mapOf, changeMap, newMob, stats, deriveStats, fall, skillHpCost, hammerBracing, plain, gainJob, grazeChance, jobNeed };`).toString("base64"));
const D = L.defs();
const S = L.setup();
S.now = 1_000_000;

const actions = (p, a) => {
  const v = L.validateAction(S, p.pid, a);
  if (v.ok) L.applyAction(S, p.pid, a);
  return v;
};
const advance = ms => { L.endTick(S); L.tick(S, S.now + ms); };
const find = (m, check) => {
  for (let ty = 4; ty < m.h - 4; ty++) for (let tx = 4; tx < m.w - 4; tx++) {
    const x = tx * 16 + 8, y = ty * 16 + 8;
    if (check(x, y)) return [x, y];
  }
  throw new Error("missing arena fixture");
};
// a fixed flat arena laid over the meadow (balance-probe.mjs arena), so the meadow's layout never moves the numbers
const land = H.mapOf("meadow"), [ox, oy] = arena(L, S, land).map((t) => t * 16 + 8);
function player(id, wk, wm, level = 61) {
  const ch = L.hero("검증" + id, { wk, lvl: level, migrate: true });
  ch.job = "adventurer";
  ch.gold = 5000;
  ch.wm[wk] = { lv: wm, xp: 0 };
  L.addPlayer(S, id, ch);
  const p = S.players[id];
  H.changeMap(S, p, "meadow", ox, oy);
  return p;
}
const p = player("first", "hammer", 19), rt = S.maps.meadow;
const NPC = H.mapOf("town").npcs.find(n => n.role === "job");
assert.ok(NPC, "Arsene is reachable");
const tryJob = () => actions(p, { t: "job_change", j: "destroyer" });
H.changeMap(S, p, "town", NPC.x * 16 + 8, NPC.y * 16 + 12);
assert.match(tryJob().why || tryJob().error || "", /20/);
p.ch.wm.hammer.lv = 20;
const initialGold = p.ch.gold;
assert.ok(tryJob().ok);
assert.equal(p.ch.job, "destroyer");
assert.deepEqual(p.ch.jp, { lv: 1, xp: 0 });
assert.equal(initialGold - p.ch.gold, D.jobs.destroyer.cost);
H.changeMap(S, p, "meadow", ox, oy);

const atk = { t: "atk", a: 0 }, stamp = { t: "sk", id: "hammer_stamp", a: 0 };
const { center, r: radius, wind } = D.wkinds.hammer;
assert.equal(D.wkinds.hammer.range, center + radius);
const m = (dx, dy, k = "twinhare") => {
  const mob = H.newMob(S, k, [0, 0, 0, 0]);
  rt.mobs.push(mob);
  return Object.assign(mob, { x: ox + dx, y: oy + dy, hx: ox + dx, hy: oy + dy, hp: 1e8, el: 0, tr: [], stun: 2e9, castAt: 2e9, atkAt: 2e9 });
};
function ready(who = p) { who.atkAt = 0; who.stag = 0; who.hp = H.stats(who).mhp; who.mp = H.stats(who).mmp; who.cds = {}; }
const dmg = (mob, who = p) => mob.by[who.pid] || 0;
const impact = () => rt.ev.find(e => e[0] === "hm");

{
  const first = m(center, 1), second = m(center, -1), edge = m(center + radius, 0);
  const extra = m(center, radius), behind = m(-1, 0), out = m(center, -radius - 1);
  for (let i = 0; i < 3; i++) {
    ready();
    L.endTick(S);
    assert.ok(actions(p, atk).ok);
    assert.deepEqual(rt.ev.find(e => e[0] === "a").slice(2), [7, ox + center, oy, p.dir, 0, wind, 0]);
    const hp = first.hp;
    advance(wind - 1);
    assert.equal(first.hp, hp);
    advance(1);
    assert.deepEqual(impact().slice(2, 6), [ox + center, oy, radius, 1]);
    assert.ok(first.hp < hp);
    assert.equal(rt.ev.filter(e => e[0] === "h" && e[2] > 0 && !e[4] && e[6] === 3).length, 3, "all three hammer impacts carry the single-landing sound tag");
    // Incidental knockback must not move the next cast's fixture.
    for (const o of [first, second, edge, extra, behind, out]) { o.x = o.hx; o.y = o.hy; }
  }
  assert.ok(dmg(first) > dmg(second) && dmg(second) > 0, "entity ID breaks a center tie");
  assert.ok(dmg(edge) > 0, "the wider forward boundary is included");
  assert.equal(dmg(extra) + dmg(behind) + dmg(out), 0);
  assert.equal(p.hammerCracks.get(first).n, 2);
  const other = player("second", "hammer", 20);
  ready(other); assert.ok(actions(other, atk).ok); advance(200);
  assert.equal(other.hammerCracks.get(first).n, 1);
  assert.equal(p.hammerCracks.get(first).n, 2);
  const fault = D.skills.hammer_fault;
  ready(); p.hitAt = S.now;
  const hp = p.hp, spent = H.skillHpCost(p, fault);
  assert.ok(actions(p, { t: "sk", id: "hammer_fault", a: 0 }).ok);
  assert.equal(p.hp, hp - spent, "the full cost is paid at cast");
  advance(200);
  assert.equal(p.hp, hp - spent + Math.floor(spent / 2), "a landed rupture returns half the paid HP");
  ready();
  const beforeMiss = p.hp;
  assert.ok(actions(p, { t: "sk", id: "hammer_fault", a: 4 }).ok);
  advance(200);
  assert.equal(p.hp, beforeMiss - spent, "a hit without two marks returns nothing");
  assert.equal(p.hammerCracks.has(first), false);
  advance(5001); assert.equal(other.hammerCracks.size, 0);
  for (const o of [first, second, edge, extra, behind, out]) o.dead = true;
  L.removePlayer(S, other.pid);
}

{
  const target = m(16, 0), old = p.ch.eq.weapon;
  const cost = H.skillHpCost(p, D.skills.hammer_stamp);
  ready(); p.hp = cost;
  assert.equal(actions(p, stamp).ok, false, "HP cost cannot kill the caster");
  ready(); const hp = p.hp;
  assert.ok(actions(p, stamp).ok);
  assert.equal(p.hp, hp - cost);
  assert.equal(actions(p, stamp).ok, false, "pending cast and cooldown reject duplicate spend");
  assert.equal(p.hp, hp - cost);
  p.ch.eq.weapon = H.plain("w_warrior_1");
  advance(200); assert.equal(dmg(target), 0);
  assert.equal(actions(p, stamp).ok, false, "skills require a hammer in hand");
  p.ch.eq.weapon = old; p.stc = null;
  ready(); assert.ok(actions(p, atk).ok);
  H.changeMap(S, p, "town", NPC.x * 16 + 8, NPC.y * 16 + 12);
  H.changeMap(S, p, "meadow", ox, oy);
  advance(200); assert.equal(dmg(target), 0);
  ready(); assert.ok(actions(p, atk).ok); H.fall(S, rt, p);
  assert.equal(p.hammer, null); p.dead = false; advance(200); assert.equal(dmg(target), 0);
  for (const o of rt.mobs) { o.dead = true; o.respAt = Infinity; }
  rt.cellAt = Infinity;
  ready(); const mastery = p.ch.wm.hammer.xp;
  assert.ok(actions(p, atk).ok); advance(200);
  assert.equal(impact()[5], 0); assert.equal(p.ch.wm.hammer.xp, mastery);
  ready();
  assert.match(actions(p, { t: "sk", id: "hammer_final", a: 0 }).error, /직업 Lv\.5/);
  p.ch.jp.lv = 5; p.stc = null; ready();
  assert.ok(actions(p, { t: "sk", id: "hammer_final", a: 0 }).ok);
  assert.equal(H.hammerBracing(p, S.now), 0.25);
  advance(400);
}

{
  for (const id of ["hammer_stamp", "hammer_fault", "hammer_final"]) {
    const skill = D.skills[id];
    const [x, y] = find(land, (x, y) => Array.from({ length: 21 }, (_, i) => i / 20).every(t =>
      H.canStand(land, x + t * skill.center, y) && H.canStand(land, x + t * skill.center, y + t * (skill.r + 1))));
    p.x = x; p.y = y;
    const edge = m(x - ox + skill.center, y - oy + skill.r);
    const outside = m(x - ox + skill.center, y - oy + skill.r + 1);
    ready();
    assert.ok(actions(p, { t: "sk", id, a: 0 }).ok, id);
    advance(skill.wind);
    assert.deepEqual(impact().slice(2, 5), [x + skill.center, y, skill.r], `${id} shows its server radius`);
    assert.ok(dmg(edge) > 0, `${id} hits at the side of the circle`);
    assert.equal(dmg(outside), 0, `${id} misses just outside the circle`);
    edge.dead = outside.dead = true;
    edge.respAt = outside.respAt = Infinity;
  }
  p.x = ox; p.y = oy;
}

{
  const submerged = m(center, 0);
  submerged.dive = true;
  ready();
  assert.ok(actions(p, atk).ok);
  advance(wind);
  assert.equal(dmg(submerged), 0);
  assert.equal(impact()[5], 0, "an unreachable target cannot trigger the landed-hit cue");
  submerged.dead = true;
  submerged.respAt = Infinity;
}

{
  const [x, y] = find(land, (x, y) => H.canStand(land, x, y) && !H.canStand(land, x + 16, y) && H.canStand(land, x + 32, y));
  p.x = x; p.y = y; ready();
  assert.ok(actions(p, atk).ok);
  assert.ok(p.hammer.x < x + 16, "a wall stops the landing point");
  const target = m(0, 0); target.x = target.hx = x + 32; target.y = target.hy = y;
  advance(200); assert.equal(dmg(target), 0);
  target.dead = true; p.x = ox; p.y = oy;
}

{
  const old = L.newChar("옛망치", []); old.v = 13; delete old.wm.hammer;
  L.addPlayer(S, "migration", old);
  assert.deepEqual(S.players.migration.ch.wm.hammer, { lv: 1, xp: 0 });
  assert.equal(S.players.migration.ch.v, 26);
  assert.equal(D.wkOrder.at(-1), "hammer");
  for (let tier = 1; tier <= 5; tier++) {
    const item = D.items[`w_h_${tier}`];
    assert.equal(item?.wk, "hammer");
    assert.equal(item.tier, tier);
  }
  assert.equal(Object.values(D.skills).filter(sk => sk.wk === "hammer" && sk.kind === "p").length, 5);
}

// Identical level, stats, tier/rarity and mastery. Frozen mobs isolate range and cadence.
function compare(kind, offsets, duo) {
  const team = Array.from({ length: duo ? 2 : 1 }, (_, i) => player(`balance-${kind}-${i}`, kind, 30));
  for (const o of team) {
    o.ch.eq.weapon = H.plain(kind === "hammer" ? "w_h_3" : "w_warrior_3");
    o.ch.job = kind === "hammer" ? "destroyer" : "swordsman";
    o.stc = null; ready(o);
  }
  const targets = offsets.map(([x,y]) => m(x,y));
  const cd = H.stats(team[0]).acd;
  S.seed = ARENA.seed;                  // the same rolls however the meadow is laid out

  for (let n = 0; n < 120; n++) {
    for (const o of team) assert.ok(actions(o, atk).ok);
    if (kind === "hammer") advance(200);
    for (const o of targets) { o.x = o.hx; o.y = o.hy; }
    advance(cd - (kind === "hammer" ? 200 : 0));
  }
  const total = targets.reduce((a, target) => a + team.reduce((b,o) => b + dmg(target,o), 0), 0);
  for (const o of targets) { o.dead = true; o.respAt = Infinity; }
  for (const o of team) L.removePlayer(S,o.pid);
  return total / (120 * cd / 1000);
}
for (const duo of [false, true]) {
  const single = [[16, 0]], spread = [[16, 0], [24, 14], [24, -14], [32, 0]];
  const h = compare("hammer", single, duo), s = compare("sword", single, duo);
  const hm = compare("hammer", spread, duo), sm = compare("sword", spread, duo);
  // the arena reads ×1.074 solo, ×1.078 duo (the old meadow spot ×1.087 / ×1.104; roll noise is about ±0.03): band 1.06–1.15
  assert.ok(h / s >= 1.06 && h / s <= 1.15 && sm > hm, `hammer ${h}/${hm}, sword ${s}/${sm}`);
  console.log(`${duo ? "duo" : "solo"}: single hammer ${h.toFixed(1)}, sword ${s.toFixed(1)} DPS; four spread hammer ${hm.toFixed(1)}, sword ${sm.toFixed(1)} DPS`);
}

{
  const promote = (who, job) => {
    H.changeMap(S, who, "town", NPC.x * 16 + 8, NPC.y * 16 + 12);
    return () => actions(who, { t: "job_change", j: job });
  };
  const merc = player("merc", "hammer", 15, 29), paladin = player("paladin", "hammer", 15, 29);
  for (const [who, job, secondary] of [[merc, "mercenary", "spear"], [paladin, "paladin", "book"]]) {
    const change = promote(who, job);
    who.ch.wm[secondary].lv = 14;
    assert.equal(change().ok, false);
    who.ch.wm[secondary].lv = 15;
    assert.ok(change().ok);
    assert.deepEqual(who.ch.jp, { lv: 1, xp: 0 });
    H.changeMap(S, who, "meadow", ox, oy);
  }
  for (const o of rt.mobs) { o.dead = true; o.respAt = Infinity; }
  const prey = m(16, 0, "gutfrog"); prey.hp = 1;
  const skill = { t: "sk", id: "ironsiege", a: 0 };
  const level = merc.ch.lvl, masteryBefore = merc.ch.wm.hammer.xp;
  merc.ch.jp = { lv: 4, xp: H.jobNeed(4) - 1 };
  ready(merc);
  const before = H.stats(merc), beforeAtk = H.deriveStats(merc).atk0;
  assert.match(actions(merc, skill).error, /직업 Lv\.5/);
  assert.ok(actions(merc, atk).ok);
  advance(200);
  assert.ok(prey.dead);
  assert.deepEqual(merc.ch.jp, { lv: 5, xp: 3 });
  assert.equal(merc.ch.lvl, level);
  assert.ok(merc.ch.wm.hammer.xp > masteryBefore);
  assert.deepEqual(paladin.ch.jp, { lv: 1, xp: 0 }, "no credit for idle players");
  assert.equal(merc.ch.qs.filter(x => x?.[1] === skill.id).length, 1);
  assert.ok(H.stats(merc).mhp > before.mhp);
  assert.ok(H.deriveStats(merc).atk0 > beforeAtk);
  const overlap = m(35, 0);
  ready(merc);
  L.endTick(S);
  assert.ok(actions(merc, skill).ok);
  assert.ok(dmg(overlap, merc) > 0);
  assert.equal(rt.ev.filter(e => e[0] === "h" && e[1] === overlap.id).length, 1);
  overlap.dead = true;
  overlap.respAt = Infinity;
  const base = H.stats(merc);
  H.gainJob(S, merc, 1e7);
  assert.deepEqual(merc.ch.jp, { lv: 50, xp: 0 });
  assert.ok(H.stats(merc).atk > base.atk && H.stats(merc).def > base.def);
  assert.deepEqual(L.viewFor(S, merc.pid).self.jp, [50, 0, 0]);

  const expert = merc.ch.wm.hammer.lv, deep = { k: "moleworm" };
  const expertGraze = H.grazeChance(merc, deep), expertAtk = H.deriveStats(merc).atk0;
  merc.ch.wm.hammer.lv = 1; merc.stc = null;
  assert.ok(H.grazeChance(merc, deep) > expertGraze);
  assert.ok(H.deriveStats(merc).atk0 < expertAtk);
  merc.ch.wm.hammer.lv = expert; merc.stc = null;

  H.gainJob(S, paladin, 300);
  const far = player("far", "spear", 20, 29), nearby = player("nearby", "dagger", 20, 29);
  for (const ally of [merc, nearby, far]) {
    assert.ok(actions(paladin, { t: "pinv", e: ally.eid }).ok);
    assert.ok(actions(ally, { t: "pacc" }).ok);
  }
  const oath = D.skills.oathward, power = H.stats(paladin).atk;
  const heal = ally => Math.round(H.stats(ally).mhp * oath.heal + power * oath.atkHeal);
  merc.x = paladin.x + oath.healR; merc.y = paladin.y;
  nearby.x = paladin.x - 12; nearby.y = paladin.y;
  far.x = paladin.x + oath.healR + 1; far.y = paladin.y;
  ready(paladin);
  for (const o of [paladin, merc, nearby, far, p]) o.hp = 5;
  L.endTick(S);
  assert.ok(actions(paladin, { t: "sk", id: "oathward", a: 0 }).ok);
  for (const o of [paladin, merc, nearby]) assert.equal(o.hp, 5 + heal(o));
  assert.deepEqual(rt.ev.filter(e => e[0] === "h" && e[2] < 0 && e[6] === 1).map(e => e[1]).sort(),
    [paladin.eid, merc.eid, nearby.eid].sort(), "only recipients who recover HP get the oath cue");
  assert.equal(far.hp, 5, "a distant party member is outside the healing radius");
  assert.equal(p.hp, 5, "an outsider is never healed");
  const stay = { x: ox, y: oy };
  function creditedKill(attacker, engaged = false) {
    Object.assign(attacker, stay);
    ready(attacker);
    const beast = m(attacker === far ? 23 : 16, 0, "gutfrog");
    beast.hp = 1;
    beast.temp = true;
    if (engaged) beast.by[paladin.pid] = 1;
    assert.ok(actions(attacker, atk).ok);
    advance(200);
    assert.ok(beast.dead);
  }
  const jp = paladin.ch.jp.xp, wm = paladin.ch.wm.hammer.xp;
  creditedKill(far);
  assert.equal(paladin.ch.jp.xp, jp, "only a teammate who received effective healing can grant support credit");
  creditedKill(merc);
  assert.equal(paladin.ch.jp.xp, jp + 4, "healing participation earns job XP");
  assert.equal(paladin.ch.wm.hammer.xp, wm, "healing does not train weapon mastery");
  creditedKill(merc, true);
  assert.equal(paladin.ch.jp.xp, jp + 8, "direct damage and support give only one award for the same kill");
  advance(oath.creditMs);
  creditedKill(merc);
  assert.equal(paladin.ch.jp.xp, jp + 8, "support XP eligibility expires");
  for (const o of [merc, nearby, far, paladin]) L.removePlayer(S, o.pid);

  const old = L.newChar("옛전직", [], "hammer");
  old.v = 14; old.job = "destroyer"; delete old.jp;
  L.addPlayer(S, "oldjob", old);
  assert.deepEqual(S.players.oldjob.ch.jp, { lv: 5, xp: 0 });
  L.removePlayer(S, "oldjob");

  const rift = L.newChar("균열기록", [], "hammer");
  rift.v = 15;
  rift.job = "destroyer";
  delete rift.jp;
  rift.dim.t = 8; rift.dim.best = 7;
  L.addPlayer(S, "rift15", rift);
  const merged = L.exportChar(S, "rift15");
  assert.equal(merged.v, 26);
  assert.deepEqual(merged.jp, { lv: 5, xp: 0 });
  assert.equal(merged.dim.t, 1, "the old tier ladder is gone (v22)");
  assert.equal(merged.dim.best, 0, "an old sheet's best tier is no floor record");
  L.removePlayer(S, "rift15");

  const profession = L.newChar("직업기록", [], "hammer");
  profession.v = 15;
  profession.job = "destroyer";
  profession.jp = { lv: 35, xp: 11 };
  delete profession.dim;
  L.addPlayer(S, "job15", profession);
  const upgraded = L.exportChar(S, "job15");
  assert.equal(upgraded.v, 26);
  assert.deepEqual(upgraded.jp, { lv: 35, xp: 11 });
  assert.equal(upgraded.dim.t, 1);
  L.removePlayer(S, "job15");
}

console.log("hammer: repeat, timing, shape, cap, wall, costs, cracks, cancellation, migration and Destroyer verified");
