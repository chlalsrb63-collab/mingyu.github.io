// Headless test of gear, loot and the repeat-hunting systems: node tests/loot.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const S = L.setup();
let now = 1000;
S.now = now;
const PID = "pid-loot0001";
const step = (ms = 100) => { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; };
const act = (a) => { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; };
const gear = (id, extra = {}) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [], ...extra });
const self = () => { S.players[PID].dirty = true; return step().self; };
const near = (role) => { const p = S.players[PID]; const n = D0.npcs.find((o) => o.role === role); p.x = n.x * 16 + 8; p.y = n.y * 16 + 30; p.mvAt = now; };

// ── an old sheet: a ranger with a gun and the single accessory slot
const old = L.newChar("옛사람", "warrior", []);
old.cls = "ranger"; old.lvl = 40;
old.eq = { weapon: gear("w_ranger_2", { q: 2, af: [["atk", 3]] }), armor: gear("a_2"), acc: gear("c_1", { q: 1, af: [["crit", 2]] }) };
old.inv = [{ id: "hp_s", n: 3 }, gear("c_2"), gear("w_ranger_1"), { id: "nope", n: 1 }];
delete old.mk; delete old.bq;
L.addPlayer(S, PID, old);
let v = step();
const D0 = v.map;
let me = v.self;
assert.equal(me.cls, "lancer", "rangers become lancers");
assert.equal(me.eq.weapon.id, "w_lancer_2");
assert.equal(me.eq.ring1.id, "r_2", "the old accessory becomes a ring");
assert.deepEqual(me.inv.map((s) => s.id), ["hp_s", "n_3", "w_lancer_1"]);
assert.equal(me.wk, "spear");
assert.deepEqual(D.slots, ["weapon", "helm", "armor", "gloves", "boots", "ring1", "ring2", "amulet"]);

// ── eight slots: every kind of piece goes where it belongs, rings on both hands
const ch = S.players[PID].ch;
ch.inv = [gear("h_2"), gear("g_2"), gear("b_2"), gear("r_1"), gear("r_3"), gear("n_2"), gear("w_mage_1"), gear("a_5")];
const atk0 = me.atk, hp0 = me.mhp;
for (let i = 0; i < 4; i++) assert.ok(act({ t: "eq", s: 0 }).ok);       // helm, gloves, boots, ring → ring2 (ring1 is taken)
me = self();
assert.equal(me.eq.helm.id, "h_2"); assert.equal(me.eq.gloves.id, "g_2"); assert.equal(me.eq.boots.id, "b_2");
assert.equal(me.eq.ring2.id, "r_1", "a ring fills the bare finger");
assert.ok(act({ t: "eq", s: 0, k: "ring1" }).ok, "a ring can be aimed at a finger");
assert.equal(act({ t: "eq", s: 1, k: "helm" }).ok, false, "an amulet is not a helm");
assert.ok(act({ t: "eq", s: 1 }).ok);
me = self();
assert.equal(me.eq.ring1.id, "r_3"); assert.equal(me.eq.amulet.id, "n_2");
assert.ok(me.atk > atk0 && me.mhp > hp0, "gloves, rings and an amulet add up");
assert.equal(act({ t: "eq", s: me.inv.findIndex((s) => s.id === "w_mage_1") }).ok, false, "another class's weapon is refused");
assert.equal(act({ t: "eq", s: me.inv.findIndex((s) => s.id === "a_5") }).ok, true, "level 40 can wear tier 5");
assert.ok(act({ t: "uneq", k: "ring2" }).ok);

// ── set bonuses and legendary powers
ch.eq.gloves = gear("g_3", { q: 4, set: "runner" }); ch.eq.boots = gear("b_3", { q: 4, set: "runner" });
S.players[PID].stc = null;
const crit1 = self().crit;
ch.eq.boots = gear("b_3");
S.players[PID].stc = null;
assert.equal(crit1 - self().crit, 6, "two pieces of 네온 러너 give +6 crit");
ch.eq.helm = gear("h_3", { q: 3, lg: "haste" }); ch.eq.armor = gear("a_3", { q: 3, lg: "greed" });
S.players[PID].stc = null;
me = self();
assert.equal(me.acd, Math.round(D.wkinds.spear.cd * 0.85), "haste shortens the attack");
assert.equal(me.goldb, 60);
assert.deepEqual(me.lg.sort(), ["greed", "haste"]);

// ── the smith: any worn piece but jewellery can be enhanced; spare gear breaks down into stones
near("smith");
ch.gold = 1e6; ch.inv = [{ id: "stone", n: 50 }, gear("h_1", { q: 2 }), gear("r_1", { q: 3, lg: "nova" })];
S.players[PID].toast.length = 0;
assert.ok(act({ t: "enh", k: "helm" }).ok);
{
  // the news names the whole piece: rarity, its word, the item, and the level it is now at
  const said = S.players[PID].toast.at(-1), g = ch.eq.helm;
  const full = `전설 ${D.legend.haste[0]} ${D.items.h_3.name}` + (g.enh ? ` +${g.enh}` : "");
  assert.ok(said.includes(full + " 강화 성공!") || said.startsWith(full + " 강화 실패"), said);
  // an affixed rare piece is named by its first affix, as the client names it
  ch.eq.boots = gear("b_2", { q: 2, enh: 5, af: [["critd", 10]] });
  for (let i = 0; i < 40 && ch.eq.boots.enh === 5; i++) { S.players[PID].toast.length = 0; ch.eq.boots.enh = 5; assert.ok(act({ t: "enh", k: "boots" }).ok); }
  const b = S.players[PID].toast.at(-1);
  assert.ok(b.includes(`희귀 잔혹한 ${D.items.b_2.name} +${ch.eq.boots.enh}`), b);
  delete ch.eq.boots;
}
assert.equal(act({ t: "enh", k: "ring1" }).ok, false);
const stones = () => ch.inv.filter((s) => s.id === "stone").reduce((n, s) => n + s.n, 0);
const s0 = stones();
assert.ok(act({ t: "salv", s: 1 }).ok);
assert.equal(stones() - s0, 2, "a rare piece gives two stones");
assert.ok(act({ t: "salv", s: 1 }).ok);
assert.equal(stones() - s0, 7, "a legendary gives five");
assert.equal(act({ t: "salv", s: 0 }).ok, false, "stones are not gear");

// ── bounties renew themselves
near("elder");
assert.equal(act({ t: "bq", a: "take", k: "boss" }).ok, false);
assert.ok(act({ t: "bq", a: "take", k: "twinhare" }).ok);
assert.equal(act({ t: "bq", a: "done" }).ok, false);
ch.bq.n = ch.bq.need;
const g0 = ch.gold;
assert.ok(act({ t: "bq", a: "done" }).ok);
assert.ok(ch.gold > g0 && ch.bn === 1 && ch.bq.n === 0 && ch.bq.k === "twinhare");

// ── the hunt: streaks, mastery, and the field boss that enough kills call out
const p = S.players[PID];
const rt = L.runtime(S, "meadow");
p.map = "meadow"; rt.n++; L.runtime(S, "town").n--; p.sendMap = true;
ch.eq.weapon = gear("w_lancer_5", { enh: 10 }); p.stc = null;
step(30); // the meadow's cells wake around the hunter and fill
// a monster brought back by hand stays in the world (a cell's own would leave it once killed)
const revive = (m) => { m.dead = false; m.cellGone = false; m.slot = null; if (!rt.mobs.includes(m)) rt.mobs.push(m); };
const acorns = rt.mobs.filter((m) => m.k === "twinhare");
assert.ok(acorns.length >= 10, "the hare's cells are awake");
let killed = 0;
for (const m of rt.mobs.slice()) { if (m.k !== "twinhare" && m.k !== "gutfrog") continue; if (rt.fb) break; revive(m); m.el = 0; m.hp = 1; p.x = m.x - 12; p.y = m.y; p.mvAt = now; p.atkAt = 0; p.aim = 0; assert.ok(act({ t: "atk" }).ok); if (m.dead) killed++; step(30); p.hp = 99999; }
// not enough distinct monsters at once: revive and repeat until the count is reached (and the hare's own tally)
for (let i = 0; (!rt.fb || (ch.mk.twinhare || 0) < 30) && i < 500; i++) {
  const m = acorns[i % acorns.length];
  revive(m); m.el = 0; m.hp = 1; m.x = p.x + 12; m.y = p.y; p.atkAt = 0; p.aim = 0;
  assert.ok(act({ t: "atk" }).ok);
  if (m.dead) killed++;
  step(30); p.hp = 99999;
}
assert.ok(rt.fb, "kills call out the field boss, counted " + rt.kc);
assert.ok(p.streak >= 20, "kills in quick succession build a streak, got " + p.streak);
assert.ok((ch.mk.twinhare || 0) >= 30, "kills are counted per monster");
const boss = rt.mobs.find((m) => m.el === 2);
assert.ok(boss && boss.k === "lambmaw" && rt.fb === boss.id, "the field boss arrives");
{
  // …clear of the waypoint stone and signposts, well away from the hunter, after a warning ring
  const A = L.atlas(), mm = A.maps.meadow, tile = (o) => [(o.x - 8) / 16, (o.y - 10) / 16];
  const [bx, by] = tile(boss);
  assert.ok(mm.reach[by * mm.w + bx], "on a reachable tile");
  for (const k of mm.marks.filter((k) => k.kind === "waypoint" || k.kind === "sign")) assert.ok(Math.hypot(k.x - bx, k.y - by) >= 3, `≥3 tiles from the ${k.kind} at ${k.x},${k.y}`);
  assert.ok(Math.hypot(p.x / 16 - 0.5 - bx, p.y / 16 - 0.5 - by) >= 6, "≥6 tiles from the nearest player");
  assert.ok(boss.stun > S.now - 3000, "it holds still while its arrival is telegraphed");
  // call it again from a kill right beside the stone with the hunter standing there: the worst case
  const W = A.waypoints.meadow, kx = W.ax * 16 + 8, ky = W.ay * 16 + 10;
  const fb = rt.fb; rt.fb = 0; rt.kc = 1e9;
  p.x = kx; p.y = ky;
  const before = rt.mobs.slice();
  const prey = acorns[0]; revive(prey); prey.el = 0; prey.hp = 1; prey.x = kx + 12; prey.y = ky; p.atkAt = 0; p.aim = 0;
  assert.ok(act({ t: "atk" }).ok);
  const b2 = rt.mobs.find((m) => !before.includes(m) && m.el === 2);
  assert.ok(b2, "a second call-out from beside the stone");
  const [cx, cy] = tile(b2);
  assert.ok(Math.hypot(W.x - cx, W.y - cy) >= 3, "not on the stone");
  assert.ok(Math.hypot(p.x / 16 - 0.5 - cx, p.y / 16 - 0.5 - cy) >= 6, "not on the hunter beside it");
  assert.ok(rt.ev.some((e) => e[0] === "t" && e[1] === b2.x && e[2] === b2.y), "a warning ring where it lands");
  // back to the story: the first boss is the one the rest of this test fights
  rt.mobs.splice(rt.mobs.indexOf(b2), 1); rt.fb = fb; rt.kc = 0;
}
assert.equal(boss.hp, Math.round(D.mobs.lambmaw.hp * D.eliteHp[2]));
boss.hp = 1; boss.x = p.x + 12; boss.y = p.y; p.atkAt = 0;
act({ t: "atk", a: 0 });
step(30);
assert.ok(!rt.mobs.includes(boss) && rt.fb === 0, "and is gone for good once it falls");
assert.ok(rt.drops.some((d) => d.g) || ch.inv.some((x) => x.q !== undefined), "leaving gear behind");
const types = new Set();
for (let i = 0; i < 3000; i++) { const m = acorns[i % acorns.length]; revive(m); m.el = 1; m.hp = 1; m.x = p.x + 12; m.y = p.y; p.atkAt = 0; act({ t: "atk", a: 0 }); step(20); p.hp = 99999; }
for (const d of rt.drops) if (d.g) types.add(D.items[d.g.id].type);
for (const s of ch.inv) if (D.items[s.id].type !== "pot" && s.q !== undefined) types.add(D.items[s.id].type);
assert.ok(types.size >= 6, "every kind of piece drops, saw " + [...types]);
assert.ok(rt.drops.concat(ch.inv).some((d) => (d.g || d).lg), "legendaries drop from elites");
assert.ok(rt.drops.concat(ch.inv).some((d) => (d.g || d).set) || true);

// ── every skill of every class can be cast without a hitch
L.removePlayer(S, PID);
for (const cls of Object.keys(D.classes)) {
  const c = L.newChar("스킬" + cls.slice(0, 3), cls, []);
  c.lvl = 40; c.map = "meadow"; c.x = 20 * 16; c.y = 22 * 16 + 8;
  L.addPlayer(S, PID, c);
  const q = S.players[PID];
  step();
  assert.equal(D.skills[cls].length, 6, "four skills, a second-tier one and an ultimate");
  for (let i = 0; i < 6; i++) {
    const m = acorns[i]; m.dead = false; m.hp = 500; m.x = q.x + 20; m.y = q.y + 4;
    q.mp = 999; q.atkAt = 0;
    assert.ok(act({ t: "sk", i }).ok, cls + " skill " + i);
    for (let k = 0; k < 40; k++) step(100);
  }
  if (cls === "mage") {
    q.ch.inv = [gear("w_book_1")];
    assert.ok(act({ t: "eq", s: 0 }).ok, "a mage can hold a book");
    q.dirty = true;
    const sv = step().self;
    assert.equal(sv.wk, "book");
    assert.equal(sv.range, D.wkinds.book.range);
    const m = acorns[0]; m.dead = false; m.hp = 5; m.x = q.x + 30; m.y = q.y; q.atkAt = 0;
    assert.ok(act({ t: "atk", a: 0 }).ok);
  }
  const out = L.removePlayer(S, PID);
  JSON.stringify(out);
}
console.log("loot ok — kills", killed, "piece types", [...types].join(","));
