// Headless test of the cosy side — campfires, fishing, cooking, guilds, emotes: node tests/life.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const S = L.setup();
let now = 1000;
S.now = now;
const A = "pid-life-aaa", B = "pid-life-bbb";
const view = (pid) => JSON.parse(JSON.stringify(L.viewFor(S, pid)));
const step = (ms = 100) => { now += ms; L.tick(S, now); const v = { a: view(A), b: view(B) }; L.endTick(S); return v; };
const act = (pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };

L.addPlayer(S, A, L.newChar("모닥이", "warrior", []));
L.addPlayer(S, B, L.newChar("낚시꾼", "mage", []));
const a = S.players[A], b = S.players[B];
let v = step();
assert.ok(v.a.F.length >= 1, "the town has a campfire that always burns");

// ── sitting by a fire heals fast and, after a while, warms
const fire = L.runtime(S, "town").fires[0];
for (const p of [a, b]) { p.x = fire.x + 10; p.y = fire.y + 12; p.mvAt = now; p.hitAt = -1e9; }
a.hp = 10;
assert.ok(act(A, { t: "sit" }).ok && act(B, { t: "sit" }).ok);
v = step(1100);
assert.equal(v.a.me[7], 1, "sitting shows in the snapshot");
assert.ok(a.hp > 20, "the fireside heals");
for (let i = 0; i < 8; i++) v = step(1100);
// (the clock starts at midnight outdoors: the night adds its point — tests/daynight.mjs has the table)
assert.ok(a.warm > now && a.warmPct === 14, "two at one fire by night: 10% + 3% + 1%, got " + a.warmPct);
a.dirty = true; v = step();
assert.ok(v.a.self.xpb >= 14 && v.a.self.buffs[2] > 0);
// walking off stands you up
act(A, { t: "mv", x: a.x + 6, y: a.y, d: 2 });
assert.equal(a.sit, false);

// ── a campfire of your own
a.ch.inv.push({ id: "camp", n: 1 });
assert.equal(act(A, { t: "use", id: "camp" }).ok, false, "not right next to another fire");
a.x += 80; a.mvAt = now;
assert.ok(act(A, { t: "use", id: "camp" }).ok);
assert.equal(L.runtime(S, "town").fires.length, 2);
for (let i = 0; i < 20; i++) step(10000);
assert.equal(L.runtime(S, "town").fires.length, 1, "it burns out after three minutes");

// ── fishing: wait for the bite, then reel
const m = L.runtime(S, "meadow");
for (const p of [a, b]) { L.runtime(S, p.map).n--; p.map = "meadow"; m.n++; p.sendMap = true; }
assert.equal(act(B, { t: "fish" }).ok, false, "no water here");
// stand on the sandy shore of one of the meadow's ponds
const mapV = step().b.map;
let spot = null;
for (let y = 4; y < mapV.h - 4 && !spot; y++) for (let x = 4; x < mapV.w - 4 && !spot; x++) if (mapV.g[y][x] === "s" && mapV.g[y][x + 1] === "w" && mapV.o[y][x] === " ") spot = [x, y];
assert.ok(spot, "found a shore tile");
b.x = spot[0] * 16 + 8; b.y = spot[1] * 16 + 10; b.mvAt = now; b.hitAt = -1e9;
for (const mob of m.mobs) { mob.dead = true; mob.respAt = 1e15; }                      // a quiet afternoon
assert.ok(act(B, { t: "fish" }).ok);
assert.ok(act(B, { t: "reel" }).ok);                            // far too early
assert.equal(b.ch.inv.some((s) => s.id.startsWith("fish")), false);
let caught = 0;
for (let n = 0; n < 40; n++) {
  assert.ok(act(B, { t: "fish" }).ok);
  let bit = false;
  for (let i = 0; i < 90 && !bit; i++) { v = step(100); bit = (v.b.ev || []).some((e) => e[0] === "f" && e[1] === b.eid && e[2] === 2); }
  assert.ok(bit, "a bite comes within a few seconds");
  assert.equal(act(B, { t: "hook" }).ok, true, "the bite can be hooked");
  for (let i = 0; i < 30; i++) step(100);                        // play the fish in
  assert.ok(act(B, { t: "reel", s: n < 3 ? 10 : 100 }).ok);
  if (n >= 3) caught++;
}
assert.ok(b.ch.fish === caught, "a badly played fish gets away: " + b.ch.fish);
// the meadow is grade-1 water: 송사리, the odd stone or 황금 잉어, never trout (tests/lifeskills.mjs has the grades)
assert.ok(b.ch.inv.some((s) => s.id === "fish_s") && !b.ch.inv.some((s) => s.id === "fish_m"), "playing it well lands the meadow's fish");
assert.ok(b.ch.life.fish.xp > 0 || b.ch.life.fish.lv > 1, "fishing trains 낚시");
b.ch.inv.push({ id: "fish_s", n: 6 });
// a bite left alone gets away
act(B, { t: "fish" });
for (let i = 0; i < 100; i++) step(100);
assert.equal(b.fish, null);

// ── cooking needs a fire; food heals and buffs
assert.equal(act(B, { t: "cook", id: "fish_s" }).ok, false);
const mf = m.fires[0];
b.x = mf.x + 8; b.y = mf.y + 10; b.mvAt = now;
const count = (id) => b.ch.inv.filter((s) => s.id === id).reduce((n, s) => n + s.n, 0);
assert.ok(act(B, { t: "cook", id: "fish_s", s: 60 }).ok);
assert.equal(count("food_s"), 1);
assert.ok(act(B, { t: "cook", id: "fish_s", s: 100 }).ok);
assert.equal(count("food_s"), 3, "a perfect pan feeds two");
assert.ok(act(B, { t: "cook", id: "fish_s", s: 5 }).ok);
assert.equal(count("burnt"), 1, "a mess burns");
b.hp = 5; b.potAt = 0;
assert.ok(act(B, { t: "use", id: "food_s" }).ok);
b.dirty = true; v = step();
assert.ok(b.hp >= 80 && v.b.self.food === "food_s" && v.b.self.buffs[3] > 0 && v.b.self.xpb >= 5);

// ── guilds: found one, invite, talk, hunt together
assert.equal(act(A, { t: "gcreate", name: "모닥불회" }).ok, false, "costs gold");
a.ch.gold = 5000;
assert.equal(act(A, { t: "gcreate", name: "<b>" }).ok, false);
assert.ok(act(A, { t: "gcreate", name: "모닥불회" }).ok);
assert.equal(a.ch.gold, 5000 - D.guildCost);
assert.ok(act(A, { t: "ginv", e: b.eid }).ok);
v = step();
assert.deepEqual(v.b.ginv, ["모닥이", "모닥불회"]);
assert.ok(act(B, { t: "gacc" }).ok);
assert.equal(b.ch.guild, "모닥불회");
a.dirty = true; v = step();
assert.equal(v.a.self.gmates.length, 2);
assert.equal(v.a.who.find((w) => w[0] === b.eid)[12], "모닥불회", "the guild shows on everyone's list");
// guild chat stays in the guild
const C = "pid-life-ccc";
L.addPlayer(S, C, L.newChar("지나가던", "rogue", []));
assert.ok(act(B, { t: "gchat", m: "오늘 저녁은 송어!" }).ok);
now += 100; L.tick(S, now);
const va = view(A), vc = view(C);
L.endTick(S);
assert.ok(va.chat.some((c) => c.g === "모닥불회") && !(vc.chat || []).some((c) => c.g));
// a guildmate beside you adds experience
a.x = b.x + 20; a.y = b.y; a.mvAt = now; a.warm = 0; b.warm = 0; a.food = null;
const gain = (pid, p) => {
  const mob = m.mobs.find((x) => x.k === "twinhare"); mob.dead = false; mob.el = 1; mob.tr = []; mob.hp = 1; mob.x = p.x + 12; mob.y = p.y; mob.by = {};
  p.atkAt = 0; p.streak = 0; p.streakAt = -1e9; p.ch.mk = {};
  const before = p.ch.xp + 0;
  const lvl = p.ch.lvl;
  assert.ok(act(pid, { t: "atk", a: 0 }).ok);
  return p.ch.lvl === lvl ? p.ch.xp - before : -1;
};
a.ch.lvl = 20; a.stc = null;
const withMate = gain(A, a);
b.x += 2000; b.y += 2000;
const alone = gain(A, a);
assert.ok(withMate > alone && alone > 0, `hunting beside a guildmate pays more: ${withMate} vs ${alone}`);
assert.ok(act(B, { t: "gleave" }).ok && b.ch.guild === "");

// ── emotes, and a blow that shoves
assert.ok(act(A, { t: "emo", i: 1 }).ok);
assert.equal(act(A, { t: "emo", i: 99 }).ok, false);
// on open ground: the first stretch of the meadow with nothing in the way for a few tiles east
const mv = mapV, freeT = (x, y) => mv.o[y] && mv.o[y][x] === " " && !"wW".includes(mv.g[y][x]);
let lane = null;
for (let y = 4; y < mv.h - 4 && !lane; y++) for (let x = 4; x < mv.w - 8 && !lane; x++) {
  let ok = true;
  for (let i = 0; i < 6 && ok; i++) for (let dy = -1; dy <= 1; dy++) if (!freeT(x + i, y + dy)) ok = false;
  if (ok) lane = [x, y];
}
a.x = lane[0] * 16 + 8; a.y = lane[1] * 16 + 10; a.mvAt = now;
const mob = m.mobs.find((x) => x.k === "twinhare"); mob.dead = false; mob.el = 0; mob.tr = []; mob.act = null; mob.hp = 9999; mob.x = a.x + 14; mob.y = a.y; mob.stun = 0;
a.atkAt = 0; a.aim = 0;
const x0 = mob.x;
act(A, { t: "atk" });
assert.ok(mob.x > x0 && mob.stun > now, "a hit knocks the target back and staggers it");
JSON.stringify(L.removePlayer(S, A)); JSON.stringify(L.removePlayer(S, B));
console.log("life ok — fish", caught);
