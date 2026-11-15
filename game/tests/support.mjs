import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8");
const { __support: H, ...L } = await import("data:text/javascript;base64," + Buffer.from(source + `
export const __support = { atkCd, canStand, changeMap, mapOf, newMob, stats };`).toString("base64"));
const D = L.defs();
const banner = D.skills.rally_banner, binding = D.skills.revive_binding;
const request = id => ({ t: "sk", id, a: 0 });
const meadow = H.mapOf("meadow");
const arena = (() => {
  for (let ty = 4; ty < meadow.h - 4; ty++) for (let tx = 4; tx < meadow.w - 9; tx++) {
    const x = tx * 16 + 8, y = ty * 16 + 10;
    if ([-24, 0, 16, 32, 64, 76, 77, 105, 106, 112].every(dx => H.canStand(meadow, x + dx, y)) &&
        [16, 32].every(dy => H.canStand(meadow, x, y + dy))) return [x, y];
  }
  throw new Error("an open test arena is required");
})();

function world() {
  const S = L.setup();
  S.now = 1_000_000;
  let next = 0;
  const [x, y] = arena;
  const place = (p, dx = 0, dy = 0) => H.changeMap(S, p, "meadow", x + dx, y + dy);
  const hero = (wk, wm = 20, job, lvl = 29) => {
    const id = "support-" + ++next;
    L.addPlayer(S, id, L.hero("구호" + next, { wk, lvl, wm: { [wk]: wm }, job }));
    const p = S.players[id];
    place(p);
    p.mp = H.stats(p).mmp;
    return p;
  };
  const rt = L.runtime(S, "meadow");
  rt.cellAt = Infinity;
  rt.fbAt = Infinity;
  rt.mobs.length = 0;
  const act = (p, a) => {
    const result = L.validateAction(S, p.pid, a);
    if (result.ok) L.applyAction(S, p.pid, a);
    return result;
  };
  const party = (lead, ...members) => {
    for (const other of members) {
      assert.ok(act(lead, { t: "pinv", e: other.eid }).ok);
      assert.ok(act(other, { t: "pacc" }).ok);
    }
  };
  const step = ms => { L.endTick(S); L.tick(S, S.now + ms); };
  const kill = (p, kind = "lambmaw") => {
    place(p);
    const mob = H.newMob(S, kind, [0, 0, 0, 0]);
    Object.assign(mob, { x: x + 16, y, hp: 1, temp: true, el: 0, tr: [], stun: Infinity, atkAt: Infinity, castAt: Infinity });
    rt.mobs.push(mob);
    p.atkAt = 0;
    assert.ok(act(p, { t: "atk", a: 0 }).ok);
    assert.ok(mob.dead, "a real basic attack finishes the training target");
  };
  return { S, rt, place, hero, act, party, step, kill };
}
const healEvents = (rt, cue) => rt.ev.filter(e => e[0] === "h" && e[2] < 0 && e[6] === cue);
const recipients = events => events.map(e => e[1]).sort((a, b) => a - b);
const amount = (events, p) => -events.find(e => e[1] === p.eid)[2];
const wound = (p, portion = 0.2) => { p.hp = Math.round(H.stats(p).mhp * portion); };
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1, `${label}: ${actual}, expected ${expected}`);

// Mastery unlocks each support skill irrespective of job and still requires its weapon in hand.
for (const [sk, wk, wrong] of [[banner, "spear", "book"], [binding, "book", "spear"]]) {
  assert.equal(sk.wk, wk);
  assert.equal(sk.need, 15);
  const W = world(), learner = W.hero(wk, 14), other = W.hero(wrong, 20);
  assert.match(W.act(learner, request(sk.id)).error, /숙련 15/);
  other.ch.wm[wk].lv = 15;
  assert.match(W.act(other, request(sk.id)).error, /들어야/);
  learner.ch.wm[wk].lv = 15;
  assert.ok(W.act(learner, request(sk.id)).ok);
}

// A banner starts half a second after being placed, heals at a fixed center, and expires.
{
  const W = world(), p = W.hero("spear", 15), friend = W.hero("dagger"), excluded = W.hero("sword"),
    away = W.hero("spear"), outsider = W.hero("book");
  W.party(p, friend, excluded, away);
  W.place(friend, banner.r); W.place(excluded, banner.r + 1); W.place(outsider, 16);
  H.changeMap(W.S, away, "town", ...H.mapOf("town").entry.map(n => n * 16 + 8));
  for (const o of [p, friend, excluded, away, outsider]) wound(o);
  const atkCd = H.atkCd(friend), atk = H.stats(p).atk;
  const expected = (o, factor = 1) => Math.round((H.stats(o).mhp * 0.023 + atk * 0.06) * factor);
  assert.ok(W.act(p, request(banner.id)).ok);
  assert.equal(healEvents(W.rt, 4).length, 0, "a banner does not heal instantly");
  W.step(499);
  assert.equal(healEvents(W.rt, 4).length, 0, "no pulse before its first half-second");
  W.step(1);
  const first = healEvents(W.rt, 4);
  assert.deepEqual(recipients(first), [p.eid, friend.eid].sort((a, b) => a - b), "only living party members inside receive healing");
  near(amount(first, friend), expected(friend), "full banner pulse at the edge of the field");
  near(amount(first, p), expected(p, 0.5), "the caster's own pulse is half strength");
  const haste = H.atkCd(friend) / atkCd;
  assert.ok(haste >= 0.88 && haste <= 0.94, `banner basic attack speed: cooldown ratio ${haste}`);

  p.x = arena[0] + banner.r + 1;
  W.place(excluded, 16); excluded.dead = true; excluded.hp = 0;
  for (let pulse = 2; pulse <= 6; pulse++) {
    W.step(1000);
    assert.deepEqual(recipients(healEvents(W.rt, 4)), [friend.eid], `pulse ${pulse} stays on the ground after the caster leaves`);
  }
  W.step(2000);
  assert.equal(healEvents(W.rt, 4).length, 0, "an expired banner stops healing");
  assert.equal(H.atkCd(friend), atkCd, "the short attack speed buff expires too");
  assert.equal(excluded.hp, 0, "banners never revive downed members");
}

// Two banners placed over the same party member give at most one pulse and one buff.
{
  const W = world(), p = W.hero("spear", 15), spare = W.hero("spear", 15), friend = W.hero("dagger");
  W.party(p, spare, friend);
  W.place(friend, 16); wound(friend);
  const cd = H.atkCd(friend);
  assert.ok(W.act(p, request(banner.id)).ok);
  assert.ok(W.act(spare, request(banner.id)).ok);
  W.step(500);
  const pulses = healEvents(W.rt, 4).filter(e => e[1] === friend.eid);
  assert.equal(pulses.length, 1);
  const haste = H.atkCd(friend) / cd;
  assert.ok(haste >= 0.88 && haste <= 0.94, "overlapping fields do not double attack speed");
}

// Binding serves the two lowest HP ratios first and cannot fill its spare slot with the caster.
{
  const W = world(), p = W.hero("book", 15), first = W.hero("sword"), second = W.hero("spear"), fullest = W.hero("dagger"),
    outsider = W.hero("hammer");
  W.party(p, fullest, second, first);
  W.place(first, binding.r); W.place(second, 16); W.place(fullest, 32); W.place(outsider, 16);
  wound(first, 0.15); wound(second, 0.35); wound(fullest, 0.5); wound(p, 0.05); wound(outsider, 0.05);
  const atk = H.stats(p).atk;
  const expected = (o, factor) => Math.round((H.stats(o).mhp * 0.19 + atk * 0.30) * factor);
  assert.ok(W.act(p, request(binding.id)).ok);
  const heals = healEvents(W.rt, 5);
  assert.deepEqual(recipients(heals), [first.eid, second.eid].sort((a, b) => a - b));
  near(amount(heals, first), expected(first, 1), "the lowest HP ratio gets a full heal");
  near(amount(heals, second), expected(second, 0.5), "the second-lowest HP ratio gets a half heal");
}

// A distant, downed or off-map member cannot prevent the caster's half-strength fallback.
{
  const W = world(), p = W.hero("book", 15), far = W.hero("dagger"), fallen = W.hero("spear"), other = W.hero("sword");
  W.party(p, far, fallen, other);
  W.place(far, binding.r + 1); W.place(fallen, 16);
  H.changeMap(W.S, other, "town", ...H.mapOf("town").entry.map(n => n * 16 + 8));
  wound(far); wound(other); wound(p);
  fallen.dead = true; fallen.hp = 0;
  assert.ok(W.act(p, request(binding.id)).ok);
  const heals = healEvents(W.rt, 5), st = H.stats(p);
  assert.deepEqual(recipients(heals), [p.eid]);
  near(amount(heals, p), Math.round((st.mhp * 0.19 + st.atk * 0.30) * 0.5), "the solo fallback is half strength");
  p.hp = st.mhp; p.cds[binding.id] = 0;
  L.endTick(W.S);
  assert.ok(W.act(p, request(binding.id)).ok);
  assert.equal(healEvents(W.rt, 5).length, 0, "healing a full health caster does not emit a cue");
}

// A real heal lets a healer earn job XP from a nearby beneficiary's kill but trains no weapon.
for (const [id, wk, job, cue] of [[banner.id, "spear", "lancer", 4], [binding.id, "book", "warlock", 5]]) {
  const W = world(), p = W.hero(wk, 20, job, 49), healed = W.hero("sword"), full = W.hero("dagger");
  W.party(p, healed, full);
  full.hp = H.stats(full).mhp;
  wound(healed);
  const mastery = { ...p.ch.wm[wk] }, xp = p.ch.jp.xp;
  assert.ok(W.act(p, request(id)).ok);
  if (wk === "spear") W.step(500);
  assert.ok(healEvents(W.rt, cue).some(e => e[1] === healed.eid));
  assert.ok(!healEvents(W.rt, cue).some(e => e[1] === full.eid));
  W.kill(full);
  assert.equal(p.ch.jp.xp, xp, "an overhealed teammate did not earn the caster credit");
  W.kill(healed, "twinhare");
  assert.equal(p.ch.jp.xp, xp, "a target too weak to train on grants no support credit");
  W.kill(healed);
  assert.ok(p.ch.jp.xp > xp, `${id} gives job XP for an effective heal`);
  assert.deepEqual(p.ch.wm[wk], mastery, "support by itself never trains mastery");
  const credited = p.ch.jp.xp;
  W.step(D.skills[id].creditMs + (D.skills[id].ms || 0) + 1);
  W.kill(healed);
  assert.equal(p.ch.jp.xp, credited, "effective healing only earns credit during its window");
}

// Close-combat actives exchange some MP for nonlethal HP, including the single-job signatures.
for (const [wk, job, id, previousMp] of [
  ["sword", null, "slash", 8], ["sword", null, "rend", 14], ["sword", "swordsman", "verdict", 30],
  ["dagger", null, "ambush", 7], ["dagger", null, "shade", 12], ["dagger", "thief", "flurry", 36],
  ["spear", null, "spiral", 8], ["spear", null, "comet", 14], ["spear", "lancer", "dragon", 34],
]) {
  const W = world(), p = W.hero(wk, 20, job), sk = D.skills[id];
  assert.ok(sk.hpPct > 0 && sk.mp < previousMp, `${id} trades some MP for HP`);
  if (job) { p.ch.jp.lv = sk.jobNeed; p.stc = null; }
  const cost = Math.ceil(H.stats(p).mhp * sk.hpPct);
  p.hp = cost;
  assert.match(W.act(p, request(id)).error, /HP가 부족합니다/);
  assert.equal(p.hp, cost);
  p.hp = cost + 1;
  assert.ok(W.act(p, request(id)).ok, `${id} may leave exactly 1 HP`);
  assert.equal(p.hp, 1);
  assert.ok(W.rt.ev.some(e => e[0] === "h" && e[1] === p.eid && e[2] === cost && e[5] === 1), "HP cost carries the cost flag");
}

console.log("support ok");
