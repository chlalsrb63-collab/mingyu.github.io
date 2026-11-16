// Headless checks for the systems that need more than one player or lucky drops:
// node tests/party.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const S = L.setup();
let now = 1000;
S.now = now;
const A = "pid-aaaaaaaa", B = "pid-bbbbbbbb";
const ea = L.addPlayer(S, A, L.hero("가", { wk: "sword" }));
const eb = L.addPlayer(S, B, L.hero("나", { wk: "staff" }));
const act = (pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
const step = (pid) => { now += 100; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, pid))); const o = JSON.parse(JSON.stringify(L.viewFor(S, pid === A ? B : A))); L.endTick(S); return [v, o]; };

// ── party: invite, accept, both see it
assert.ok(act(A, { t: "pinv", e: eb }).ok);
assert.equal(act(A, { t: "pacc" }).ok, false, "the inviter has nothing to accept");
let [va, vb] = step(A);
assert.ok(vb.pinv, "invitee is told who invited them");
assert.ok(act(B, { t: "pacc" }).ok);
[va, vb] = step(A);
assert.equal(va.party.length, 2);
assert.equal(vb.party.length, 2);
// the radar (radar.js): each member's place in pixels and their map id ride at the end of the row
{
  const row = va.party.find((r) => r[0] === eb), pb0 = S.players[B];
  assert.deepEqual(row.slice(7), [Math.round(pb0.x), Math.round(pb0.y), "town"], "a party row ends with x, y, map id");
  // the world route map: every map lists where its doors lead, both ways for the generated doors
  const maps = new Map(L.defs().maps.map((d) => [d.id, d]));
  assert.ok(maps.get("town").to.includes("meadow") && maps.get("meadow").to.includes("town"), "town ↔ meadow");
  assert.ok(maps.get("forest").to.includes("crypt") && maps.get("crypt").to.includes("forest"), "forest ↔ crypt");
  assert.ok(maps.get("town").to.includes("willow"), "an editor link shows on the route map");
  for (const d of maps.values()) for (const to of d.to) assert.ok(maps.has(to), `${d.id} → ${to} is a real map`);
}

// ── shared kill: B never touches the monster but still gets experience
const pa = S.players[A], pb = S.players[B];
const rt = L.runtime(S, "town");
const mob = { id: 9999, k: "twinhare", r: [18, 16, 22, 20], x: pa.x + 10, y: pa.y, hx: pa.x, hy: pa.y, hp: 1, dir: 0, st: 0, tgt: null, atkAt: 0, mvAt: 1e12, wx: pa.x, wy: pa.y, by: {}, dead: false, respAt: 0, slow: 0, castAt: 1e12, el: 1, stun: 0, dot: null, temp: false, fix: 0, ep: 0 };
rt.mobs.push(mob);
now += 1000;
assert.ok(act(A, { t: "atk", a: 0 }).ok);
assert.ok(mob.dead, "one hit should finish a 1 hp monster");
assert.ok(pa.ch.xp > 0 && pb.ch.xp > 0, "both party members gain experience");
assert.equal(pb.ch.xp, Math.round(36 * 0.8), "the nearby member gets the regular shared reward");
assert.equal(pa.ch.xp, Math.round(36 * 0.8 * 1.6), "the early hunter earns the bonus on the party share");
assert.ok(rt.drops.some((d) => d.own === A) && rt.drops.some((d) => d.own === B), "each member rolls their own loot");

// ── field XP sharing uses the actual kill group, not everyone on the map
{
  const defs = L.defs();
  assert.equal(defs.partyMax, 4);
  assert.deepEqual(defs.fieldParty.share, [1, 0.8, 0.7, 0.65]);
  const range = defs.fieldParty.tiles * 16;
  const [c, d, e] = ["다", "라", "마"].map((name) => {
    const pid = "pid-" + name;
    L.addPlayer(S, pid, L.hero(name, { wk: "dagger" }));
    return S.players[pid];
  });
  for (const p of [c, d]) assert.ok(act(A, { t: "pinv", e: p.eid }).ok && act(p.pid, { t: "pacc" }).ok);
  assert.equal(act(A, { t: "pinv", e: e.eid }).error, "파티가 가득 찼습니다");
  const participants = [pa, pb, c, d];
  function killFrom(offsets) {
    const gains = participants.map((p, i) => {
      p.x = pa.x + offsets[i]; p.y = pa.y;
      p.streakAt = -Infinity; p.atkAt = 0;
      return p.ch.xp;
    });
    Object.assign(mob, { hp: 1, dead: false, by: {}, x: pa.x + 10, y: pa.y });
    now += 1000;
    assert.ok(act(A, { t: "atk", a: 0 }).ok && mob.dead);
    return participants.map((p, i) => p.ch.xp - gains[i]);
  }
  assert.deepEqual(killFrom([0, range + 1, -(range - 9), range + 2]), [58, 0, 0, 0],
    "missing either boundary gives no XP and leaves the hunter at the solo rate");
  assert.deepEqual(killFrom([0, range, -(range - 9), range + 1]), [46, 29, 0, 0],
    "the exact attacker boundary shares with a member also inside the fallen monster's range");
  assert.deepEqual(killFrom([0, 20, 26, range + 1]), [40, 25, 25, 0], "three nearby looters share at 70%");
  assert.deepEqual(killFrom([0, 20, 26, 32]), [37, 23, 23, 23], "four nearby looters share at 65%");
  d.dead = true;
  assert.deepEqual(killFrom([0, 20, 26, 32]), [40, 25, 25, 0], "downed players do not dilute the live group's XP");
  assert.ok(act(c.pid, { t: "pleave" }).ok && act(d.pid, { t: "pleave" }).ok);
}

// ── stat points: bought with experience, at a campfire or by the trainer
assert.equal(act(A, { t: "train", a: [1, 0, 0, 0, 0, 0] }).ok, false);
pa.ch.xp = 5000;
{ const kai = L.atlas().maps.town.npcs.find((n) => n.role === "train"); pa.x = kai.x * 16 + 8; pa.y = (kai.y + 1) * 16 + 8; }
pa.dirty = true;
const before = L.viewFor(S, A).self.atk;
assert.ok(act(A, { t: "train", a: [10, 0, 0, 0, 0, 0] }).ok);
const self = L.viewFor(S, A).self;
assert.equal(self.st.str, 15); assert.equal(self.lvl, 11);
assert.ok(self.atk >= before + 9 && self.atk <= before + 10, "ten points of STR at grade A and ten character levels: +9.5 attack before rounding");
assert.ok(self.xp < 5000);

// ── runes: socket two and apply their individual stats
pa.dirty = true;
const critd0 = L.viewFor(S, A).self.critd;
pa.ch.eq.weapon.sk = 2;
pa.ch.inv.push({ id: "ru_ign", n: 1 }, { id: "ru_acu", n: 1 });
const slot = (id) => pa.ch.inv.findIndex((s) => s.id === id);
assert.equal(act(A, { t: "rune", s: slot("ru_ign"), k: "weapon", i: 5 }).ok, false, "no such socket");
assert.ok(act(A, { t: "rune", s: slot("ru_ign"), k: "weapon", i: 0 }).ok);
assert.ok(act(A, { t: "rune", s: slot("ru_acu"), k: "weapon", i: 1 }).ok);
assert.deepEqual(pa.ch.eq.weapon.ru, ["ru_ign", "ru_acu"]);
const bonus = ["ru_ign", "ru_acu"].flatMap((id) => L.defs().runes[id].af).filter(([s]) => s === "critd").reduce((n, [, v]) => n + v, 0);
assert.equal(L.viewFor(S, A).self.critd, critd0 + bonus);

// ── a reload: back within a minute, the party is whole again; later than that, it stays gone
let chB = L.removePlayer(S, B);
assert.equal(S.players[A].party, 0, "a two-person party disbands while B is away");
now += 30000; S.now = now;
L.addPlayer(S, B, chB);
assert.ok(S.players[A].party && S.players[A].party === S.players[B].party, "B rejoins A within the minute");
chB = L.removePlayer(S, B);
now += 61000; S.now = now;
L.addPlayer(S, B, chB);
assert.equal(S.players[B].party, 0, "too late: no party");
assert.ok(act(A, { t: "pinv", e: S.players[B].eid }).ok && act(B, { t: "pacc" }).ok);

// ── leaving disbands a two-person party
assert.ok(act(B, { t: "pleave" }).ok);
[va] = step(A);
assert.equal(va.party, undefined);
JSON.stringify(L.removePlayer(S, A));
console.log("party ok");
