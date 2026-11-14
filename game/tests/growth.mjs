// Headless test of character growth and the comforts of a long hunt — skill levels and the
// second-tier and ultimate skills, the warehouse, pets, scrolls of blessing, the revive
// feather, selling plain gear in one go, the loot filter and auto-potion settings:
// node tests/growth.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
const BASE = Date.UTC(2026, 10, 12, 23, 0, 0);

function world(name = "성장", cls = "warrior", lvl = 40) {
  const S = L.setup();
  let now = BASE;
  S.now = now;
  const PID = "pid-" + name;
  const ch = L.newChar(name, cls, []);
  ch.lvl = lvl;
  L.addPlayer(S, PID, ch);
  const W = {
    S, PID,
    get now() { return now; },
    set now(v) { now = v; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    get ch() { return S.players[PID].ch; },
    to(id, tx, ty) { const p = W.p; L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; p.sendMap = true; },
    /** Stand in front of a townsperson. */
    npc(role) { const n = W.townNpcs.find((o) => o.role === role); assert.ok(n, role + " lives in town"); W.to("town", n.x, n.y); W.p.y = n.y * T + 30; },
    townNpcs: null,
  };
  W.p.sendMap = true;
  W.townNpcs = W.step().map.npcs;
  return W;
}
const evts = (v, tag) => (v.ev || []).filter((e) => e[0] === tag);
const gear = (id, q = 0, enh = 0) => ({ id, q, enh, af: [], sk: 0, ru: [] });
const count = (ch, id) => ch.inv.reduce((a, s) => a + (s.id === id ? s.n || 1 : 0), 0);

// ── definitions
for (const cls of Object.keys(D.classes)) {
  const sks = D.skills[cls];
  assert.equal(sks.length, 6, cls + " has six skills");
  assert.deepEqual(sks.map((s) => s.lv), [3, 7, 12, 18, 25, 35], cls + " learns them at 3, 7, 12, 18, 25 and 35");
  assert.ok(sks[5].ult, cls + "'s last skill is an ultimate");
  assert.equal(new Set(sks.map((s) => s.id)).size, 6);
}
assert.equal(D.skMax, 10);
assert.equal(D.whSlots, 60);
for (const id of ["sc_atk", "sc_def", "sc_xp", "feather", "pet_chick", "pet_bat", "pet_wisp", "hp_l", "mp_l"]) {
  assert.ok(D.items[id], id + " exists");
  assert.ok(D.shop.includes(id), "the shop sells " + id);
}
assert.ok(D.items.pet_chick.radius < D.items.pet_bat.radius && D.items.pet_bat.radius < D.items.pet_wisp.radius, "dearer pets reach further");
assert.ok(D.tutorial.length >= 1);

// ── skill levels: raised at the trainer, for gold and experience, step by step
{
  const W = world("수련", "warrior", 40);
  const ch = W.ch;
  ch.gold = 1e7; ch.xp = 1e7;
  let s = W.self();
  assert.deepEqual(s.skl, [1, 1, 1, 1, 1, 1], "every skill starts at level 1");
  assert.equal(W.act({ t: "sklv", i: 0 }).ok, false, "only at the trainer");
  W.npc("train");
  const c0 = s.skc[0];
  assert.ok(c0.gold > 0 && c0.xp > 0 && c0.lvl === D.skills.warrior[0].lv + 1, "the next level's price is shown");
  const g0 = ch.gold, x0 = ch.xp;
  assert.ok(W.act({ t: "sklv", i: 0 }).ok);
  assert.equal(ch.skl[0], 2);
  assert.equal(ch.gold, g0 - c0.gold);
  assert.equal(ch.xp, x0 - c0.xp);
  s = W.self();
  assert.ok(s.skc[0].gold > c0.gold && s.skc[0].xp > c0.xp, "each level costs more than the last");
  for (let k = 2; k < 10; k++) assert.ok(W.act({ t: "sklv", i: 0 }).ok, "to level " + (k + 1));
  assert.equal(ch.skl[0], 10);
  assert.equal(W.act({ t: "sklv", i: 0 }).error, "이미 최고 레벨입니다");
  assert.equal(W.self().skc[0], null, "nothing more to buy at the top");
  // a skill cannot outgrow its owner: Lv.35's ultimate needs Lv.36 for its second level, Lv.44 for its tenth
  ch.lvl = 36;
  assert.ok(W.act({ t: "sklv", i: 5 }).ok);
  assert.ok(!W.act({ t: "sklv", i: 5 }).ok, "the ultimate's third level waits for Lv.37");
  ch.lvl = 30;
  assert.ok(!W.act({ t: "sklv", i: 5 }).ok, "an unlearned skill cannot be raised");
  ch.gold = 0; ch.lvl = 40;
  assert.equal(W.act({ t: "sklv", i: 1 }).error, "골드가 부족합니다");
  ch.gold = 1e7; ch.xp = 0;
  assert.equal(W.act({ t: "sklv", i: 1 }).error, "경험치가 부족합니다");
  assert.ok(!W.act({ t: "sklv", i: 9 }).ok && !W.act({ t: "sklv", i: "0" }).ok, "nonsense is refused");
}

// ── progress worth keeping asks the room for a save soon (not the 15 s cycle)
{
  const W = world("저장", "warrior", 5);
  const ch = W.ch;
  L.takeSaves(W.S);
  W.step();
  assert.deepEqual(L.takeSaves(W.S), [], "walking about asks for nothing");
  ch.gold = 1e7; ch.xp = 1e7;
  W.npc("train");
  assert.ok(!W.act({ t: "sklv", i: 9 }).ok);
  assert.deepEqual(L.takeSaves(W.S), [], "a refused action asks for nothing");
  assert.ok(W.act({ t: "sklv", i: 0 }).ok);
  assert.deepEqual(L.takeSaves(W.S), [W.PID], "a skill level asks for a save");
  assert.deepEqual(L.takeSaves(W.S), [], "and the flag is handed out once");
  // the regular save clears a pending flag
  assert.ok(W.act({ t: "sklv", i: 0 }).ok);
  L.exportChar(W.S, W.PID);
  assert.deepEqual(L.takeSaves(W.S), [], "the 15 s save already covered it");
  // a level-up from a kill's experience asks too
  const p = W.p, rt = L.runtime(W.S, "meadow");
  W.to("meadow", 20, 20);
  ch.lvl = 5; ch.xp = 0;
  W.step(); L.takeSaves(W.S);
  const mob = rt.mobs.find((o) => !o.dead && o.k === "twinhare");
  ch.xp = 1e6; mob.el = 0; mob.hp = 1; mob.x = p.x + 12; mob.y = p.y; p.atkAt = 0; p.aim = 0; p.hp = 1e5;
  assert.ok(W.act({ t: "atk" }).ok);
  W.step();
  assert.ok(ch.lvl > 5 && L.takeSaves(W.S).includes(W.PID), "a level-up asks for a save");
}

// ── a levelled skill hits harder, and at 5 and 10 comes back sooner
{
  const dmgOf = (L1) => {
    const W = world("강타" + L1, "warrior", 40);
    W.ch.skl[0] = L1;
    W.to("meadow", 20, 22);
    W.step();
    const p = W.p, rt = L.runtime(W.S, "meadow");
    let total = 0;
    for (let k = 0; k < 30; k++) {
      const m = rt.mobs.find((o) => o.k === "twinhare");
      m.dead = false; m.el = 0; m.tr = []; m.hp = 1e7; m.x = p.x + 16; m.y = p.y; m.by = {};
      p.mp = 999; p.cds[0] = 0; p.atkAt = 0;
      const h0 = m.hp;
      assert.ok(W.act({ t: "sk", i: 0, a: 0 }).ok);
      total += h0 - m.hp;
      W.step(50);
    }
    const cd = W.self().cds[0];
    return { total, cd };
  };
  const a = dmgOf(1), b = dmgOf(5), c = dmgOf(10);
  assert.ok(b.total > a.total * 1.2 && c.total > b.total * 1.25, `levels add damage: ${a.total} → ${b.total} → ${c.total}`);
  const cd = D.skills.warrior[0].cd;
  assert.ok(Math.abs(a.cd + 150 - cd) <= 20 && Math.abs(b.cd + 150 - cd * 0.92) <= 20 && Math.abs(c.cd + 150 - cd * 0.85) <= 20, `cooldowns shorten: ${a.cd}, ${b.cd}, ${c.cd}`);
}

// ── the second-tier and ultimate skills of every class go off, each with its own effect
// (what each one does is tested in tests/skills.mjs)
const FX = { warrior: [47, 48], rogue: [54, 55], lancer: [64, 65], mage: [74, 75] };
for (const cls of Object.keys(D.classes)) {
  const W = world("궁극" + cls.slice(0, 2), cls, 40);
  W.to("meadow", 20, 22);
  W.step();
  const p = W.p, rt = L.runtime(W.S, "meadow");
  for (const i of [4, 5]) {
    const list = rt.mobs.filter((o) => !D.mobs[o.k].chest && !D.mobs[o.k].boss).slice(0, 6);
    for (const o of rt.mobs) if (!list.includes(o)) { o.dead = true; o.respAt = W.now + 1e9; }
    list.forEach((m, j) => { m.dead = false; m.el = 0; m.tr = []; m.hp = 5000; m.x = p.x + 18 + (j % 3) * 10; m.y = p.y - 8 + Math.floor(j / 3) * 14; m.by = {}; m.stun = 0; m.slow = 0; m.mk = 2; m.mkAt = W.now + 9000; });
    p.mp = 999; p.cds[i] = 0; p.dir = 2; p.aim = 0; p.hp = 1e6;
    assert.ok(W.act({ t: "sk", i }).ok, `${cls} casts ${D.skills[cls][i].name}`);
    const v = W.step(50);
    const kinds = evts(v, "a").filter((e) => e[1] === p.eid).map((e) => e[2]);
    assert.ok(kinds.includes(FX[cls][i - 4]), `${cls} skill ${i} shows its own effect (${kinds})`);
    for (let k = 0; k < 40; k++) { if (D.skills[cls][i].id === "stomp") p.x += k % 2 ? 6 : -6; W.step(100); }
    if (D.skills[cls][i].id !== "rewind") assert.ok(list.some((m) => m.dead || m.hp < 5000), `${cls} skill ${i} lands`);
  }
}

// ── the warehouse: sixty slots per character, stacks merge, and gold
{
  const W = world("창고", "rogue", 20);
  const ch = W.ch;
  ch.inv = [{ id: "hp_m", n: 40 }, gear("w_rogue_2", 2, 3), { id: "stone", n: 5 }];
  ch.gold = 5000;
  assert.equal(W.act({ t: "wh", a: "put", s: 0, n: 10 }).error, "창고지기가 너무 멉니다");
  W.npc("bank");
  assert.ok(W.act({ t: "wh", a: "put", s: 0, n: 10 }).ok);
  assert.ok(W.act({ t: "wh", a: "put", s: 0, n: 15 }).ok);
  assert.deepEqual(ch.wh.items, [{ id: "hp_m", n: 25 }], "stacks merge in the warehouse");
  assert.equal(count(ch, "hp_m"), 15);
  assert.ok(!W.act({ t: "wh", a: "put", s: 0, n: 16 }).ok, "no more than the stack holds");
  const gi = ch.inv.findIndex((s) => s.id === "w_rogue_2");
  assert.ok(W.act({ t: "wh", a: "put", s: gi }).ok, "gear goes in whole");
  assert.equal(ch.wh.items[1].enh, 3, "with its enhancement");
  assert.ok(W.act({ t: "wh", a: "gold", n: 3000 }).ok);
  assert.equal(ch.gold, 2000); assert.equal(ch.wh.gold, 3000);
  assert.ok(!W.act({ t: "wh", a: "gold", n: 2001 }).ok, "only what is in the purse");
  assert.ok(!W.act({ t: "wh", a: "gold", n: -3001 }).ok, "only what is in the warehouse");
  assert.ok(!W.act({ t: "wh", a: "gold", n: 1.5 }).ok && !W.act({ t: "wh", a: "gold", n: 0 }).ok);
  assert.ok(W.act({ t: "wh", a: "gold", n: -1000 }).ok);
  assert.equal(ch.gold, 3000); assert.equal(ch.wh.gold, 2000);
  assert.ok(W.act({ t: "wh", a: "take", s: 0, n: 5 }).ok);
  assert.equal(count(ch, "hp_m"), 20, "taken back out, stacked with what is in the bag");
  assert.equal(ch.wh.items[0].n, 20);
  assert.ok(W.act({ t: "wh", a: "take", s: 1 }).ok);
  assert.ok(ch.inv.some((s) => s.id === "w_rogue_2" && s.q === 2));
  assert.equal(ch.wh.items.length, 1);
  // a full bag takes nothing out, a full warehouse takes nothing in
  const keep = ch.inv;
  ch.inv = Array.from({ length: D.inv }, () => gear("h_1"));
  assert.equal(W.act({ t: "wh", a: "take", s: 0, n: 1 }).error, "가방이 가득 찼습니다");
  ch.wh.items = Array.from({ length: 60 }, () => gear("h_1"));
  assert.equal(W.act({ t: "wh", a: "put", s: 0 }).error, "창고가 가득 찼습니다");
  ch.inv = keep;
  ch.wh.items = [{ id: "hp_m", n: 20 }, gear("r_3", 2)];
  assert.ok(!W.act({ t: "wh", a: "take", s: 7, n: 1 }).ok && !W.act({ t: "wh", a: "eat", s: 0 }).ok);
  assert.equal(W.self().wh.gold, 2000, "the warehouse is in the player's sheet");
  // it is kept with the character, and survives a trip through storage
  const saved = JSON.parse(JSON.stringify(L.removePlayer(W.S, W.PID)));
  saved.wh.items.push({ id: "nope", n: 3 }, null, { id: "hp_m", n: 2 });
  L.addPlayer(W.S, W.PID, saved);
  assert.equal(W.ch.wh.gold, 2000);
  assert.deepEqual(W.ch.wh.items.map((s) => s.id), ["hp_m", "r_3", "hp_m"], "broken entries are dropped on load");
}

// ── pets: follow their owner and fetch the owner's drops, minding the filter and the bag
{
  const W = world("펫", "lancer", 20);
  const ch = W.ch;
  W.npc("shop");
  ch.gold = 100000;
  assert.ok(W.act({ t: "buy", id: "pet_chick", n: 1 }).ok);
  assert.ok(W.act({ t: "use", id: "pet_chick" }).ok);
  assert.equal(ch.pet, "pet_chick");
  assert.equal(count(ch, "pet_chick"), 1, "a pet is not used up");
  W.p.sendMap = true;
  let v = W.step();
  const row = v.who.find((r) => r[0] === W.p.eid);
  assert.equal(row[10], "pet_chick", "everyone can see the pet");
  const rt = L.runtime(W.S, "town"), p = W.p;
  const drop = (it, dx, extra = {}) => { const dr = { id: W.S.nextId++, it, g: null, n: 1, q: 0, x: p.x + dx, y: p.y, own: W.PID, freeAt: W.now + 20000, dieAt: W.now + 60000, ...extra }; rt.drops.push(dr); return dr; };
  const g0 = ch.gold;
  drop("gold", 40, { n: 77 });
  drop("hp_m", -45);
  drop("gold", 200, { n: 5 });                                // beyond reach
  drop("gold", 30, { n: 9, own: "pid-someone" });             // somebody else's
  let picks = [];
  for (let k = 0; k < 12; k++) { v = W.step(100); picks.push(...evts(v, "pk")); }
  assert.equal(ch.gold, g0 + 77, "the pet fetched the gold within reach");
  assert.equal(count(ch, "hp_m"), 1, "and the potion");
  assert.equal(picks.length, 2, "and nothing else");
  assert.ok(picks.every((e) => e[1] === p.eid));
  assert.equal(rt.drops.length, 2, "the far gold and the stranger's stay where they are");
  // the loot filter: plain gear is left lying when only magic and better is wanted
  rt.drops.length = 0;
  assert.ok(W.act({ t: "opt", filter: 1 }).ok);
  drop("h_2", 30, { g: gear("h_2", 0), q: 0 });
  drop("h_2", -30, { g: gear("h_2", 1), q: 1 });
  for (let k = 0; k < 10; k++) W.step(100);
  assert.equal(rt.drops.length, 1, "the plain piece is left");
  assert.equal(rt.drops[0].q, 0);
  assert.ok(ch.inv.some((s) => s.id === "h_2" && s.q === 1), "the magic one is fetched");
  // a full bag: gear is left, gold is still fetched
  rt.drops.length = 0;
  const keep = ch.inv;
  ch.inv = keep.concat(Array.from({ length: D.inv - keep.length }, () => gear("h_1")));
  drop("r_2", 30, { g: gear("r_2", 2), q: 2 });
  drop("gold", -30, { n: 11 });
  const g1 = ch.gold;
  for (let k = 0; k < 10; k++) W.step(100);
  assert.equal(ch.gold, g1 + 11);
  assert.equal(rt.drops.length, 1, "no room, so the ring stays");
  ch.inv = keep;
  // a dead owner's pet waits
  rt.drops.length = 0;
  drop("gold", 30, { n: 3 });
  p.dead = true;
  for (let k = 0; k < 5; k++) W.step(100);
  assert.equal(rt.drops.length, 1);
  p.dead = false; p.hp = 100;
  // selling the pet sends it home; using it again does too
  assert.ok(W.act({ t: "use", id: "pet_chick" }).ok);
  assert.equal(ch.pet, "", "using it again sends it home");
  assert.ok(W.act({ t: "use", id: "pet_chick" }).ok);
  W.npc("shop");
  const si = ch.inv.findIndex((s) => s.id === "pet_chick");
  assert.ok(W.act({ t: "sell", s: si, n: 1 }).ok);
  assert.equal(ch.pet, "", "a sold pet goes home");
  // the first-steps chain ends with a chick
  assert.ok(D.tutorial.length > 0);
}
{
  // the last first step gives a pet
  const W = world("첫펫", "warrior", 3);
  const ch = W.ch;
  ch.tut = { i: D.tutorial.length - 1, n: 0 };
  W.to("meadow", 20, 22);
  W.step();
  const p = W.p, m = L.runtime(W.S, "meadow").mobs.find((o) => o.k === "twinhare");
  m.dead = false; m.hp = 500; m.x = p.x + 16; m.y = p.y;
  p.mp = 999;
  assert.ok(W.act({ t: "sk", i: 0 }).ok);
  assert.equal(ch.tut.i, D.tutorial.length);
  assert.equal(count(ch, "pet_chick"), 1, "the first steps end with a pet chick");
}

// ── scrolls: ten minutes each, never stacking with themselves
{
  const W = world("주문서", "mage", 30);
  const ch = W.ch;
  ch.inv = [{ id: "sc_atk", n: 2 }, { id: "sc_def", n: 1 }, { id: "sc_xp", n: 1 }];
  const s0 = W.self();
  assert.ok(W.act({ t: "use", id: "sc_atk" }).ok);
  const s1 = W.self();
  assert.ok(Math.abs(s1.atk - s0.atk * 1.1) <= 1, `attack +10%: ${s0.atk} → ${s1.atk}`);
  assert.ok(s1.buffs[7] > 590000 && s1.buffs[7] <= 600000, "shown in the buff row for ten minutes");
  W.now += 300000;
  assert.ok(W.act({ t: "use", id: "sc_atk" }).ok);
  const s2 = W.self();
  assert.equal(s2.atk, s1.atk, "a second one does not stack");
  assert.ok(s2.buffs[7] > 590000, "it refills the time instead");
  assert.equal(count(ch, "sc_atk"), 0);
  assert.ok(W.act({ t: "use", id: "sc_xp" }).ok);
  assert.equal(W.self().xpb, s0.xpb + 20, "experience +20%");
  assert.ok(W.act({ t: "use", id: "sc_def" }).ok);
  const s3 = W.self();
  assert.ok(s3.buffs[8] > 0 && s3.buffs[9] > 0);
  // the defence scroll takes a share off every blow
  const hit = (guard) => {
    const W2 = world("방어" + guard, "mage", 30);
    W2.to("meadow", 20, 22);
    W2.step();
    if (guard) W2.ch.scr.def = W2.now + 600000;
    const p = W2.p, rt = L.runtime(W2.S, "meadow");
    for (const o of rt.mobs) { o.dead = true; o.respAt = W2.now + 1e9; }
    let taken = 0;
    for (let k = 0; k < 40; k++) {
      // a puddle that bites whoever stands in it
      rt.pools.length = 0;
      rt.pools.push({ x: p.x, y: p.y, r: 20, dmg: 300, atk: 1, kind: 2, next: W2.now, until: W2.now + 650 });
      p.hp = 1e5; p.poolAt = 0; p.slowed = 0;
      const before = p.hp;
      W2.step(100);
      taken += before - p.hp;
      W2.step(700);
    }
    return taken;
  };
  const plain = hit(0), guarded = hit(1);
  assert.ok(plain > 0 && guarded < plain * 0.95, `the defence scroll softens blows: ${plain} → ${guarded}`);
  // and scrolls are kept with the character
  W.now += 700000;
  assert.equal(W.self().buffs[7], 0, "ten minutes later the scroll has worn off");
}

// ── death: the panel's numbers, and the revive feather
{
  const W = world("깃털", "warrior", 20);
  const ch = W.ch;
  W.to("forest", 20, 20);
  W.step();
  ch.xp = 50000;
  const p = W.p;
  p.hp = 0; p.dead = true;
  let s = W.self();
  assert.ok(s.dead && s.dead.loss > 0 && s.dead.feather === 0, "the death panel knows what town will cost");
  assert.equal(s.dead.loss, Math.floor(Math.min(50000, s.need) * 0.03));
  assert.equal(W.act({ t: "respawn", here: true }).error, "부활 깃털이 없습니다");
  ch.inv.push({ id: "feather", n: 2 });
  assert.equal(W.self().dead.feather, 2);
  const x = p.x;
  assert.ok(W.act({ t: "respawn", here: true }).ok);
  assert.ok(!p.dead && p.map === "forest" && p.x === x, "up again where they fell");
  const st = W.self();
  assert.equal(p.hp, Math.round(st.mhp * 0.6));
  assert.equal(ch.xp, 50000, "nothing lost");
  assert.equal(count(ch, "feather"), 1);
  assert.equal(st.dead, null);
  // a moment's grace after rising
  const h = p.hp;
  const m = L.runtime(W.S, "forest").mobs.find((o) => !o.dead && !D.mobs[o.k].chest);
  m.x = p.x + 12; m.y = p.y; m.tgt = W.PID; m.st = 1; m.atkAt = 0;
  W.step(300);
  assert.equal(p.hp, h, "no harm in the first moments");
  // town costs experience
  p.hp = 0; p.dead = true;
  const loss = W.self().dead.loss;
  assert.ok(W.act({ t: "respawn" }).ok);
  assert.equal(p.map, "town");
  assert.equal(ch.xp, 50000 - loss);
}

// ── selling every plain piece at once
{
  const W = world("일괄", "warrior", 20);
  const ch = W.ch;
  ch.inv = [gear("h_2"), gear("a_2", 1), gear("g_2", 0, 2), { id: "hp_m", n: 5 }, gear("b_2"), { ...gear("r_2"), ru: ["ign"] }, gear("w_warrior_2")];
  assert.equal(W.act({ t: "sellall" }).error, "상인이 너무 멉니다");
  W.npc("shop");
  const g0 = ch.gold;
  assert.ok(W.act({ t: "sellall" }).ok);
  assert.deepEqual(ch.inv.map((s) => s.id), ["a_2", "g_2", "hp_m", "r_2"], "only plain, unenhanced, unsocketed gear goes");
  assert.ok(ch.gold > g0);
  assert.equal(W.act({ t: "sellall" }).error, "팔 일반 장비가 없습니다");
}

// ── settings kept with the character: loot filter, auto-potion thresholds
{
  const W = world("설정", "rogue", 10);
  assert.ok(W.act({ t: "opt", filter: 2, ahp: 40, amp: 25 }).ok);
  assert.deepEqual(W.self().opt, { filter: 2, ahp: 40, amp: 25 });
  for (const bad of [{ filter: 3 }, { filter: -1 }, { ahp: 95 }, { amp: "30" }, { ahp: 12.5 }]) assert.ok(!W.act({ t: "opt", ...bad }).ok, JSON.stringify(bad));
  assert.ok(W.act({ t: "opt", ahp: 0 }).ok);
  const saved = JSON.parse(JSON.stringify(L.removePlayer(W.S, W.PID)));
  assert.deepEqual(saved.opt, { filter: 2, ahp: 0, amp: 25 });
  saved.opt = { filter: 9, ahp: -4, amp: 300 };
  L.addPlayer(W.S, W.PID, saved);
  assert.deepEqual(W.ch.opt, { filter: 2, ahp: 0, amp: 90 }, "out-of-range settings are clamped on load");
}

// ── an older sheet gains the new fields
{
  const S = L.setup();
  S.now = BASE;
  const old = L.newChar("옛날", "mage", []);
  old.v = 4; delete old.skl; delete old.wh; delete old.pet; delete old.scr; delete old.opt;
  old.pet = "pet_wisp";                                      // claims a pet it does not own
  L.addPlayer(S, "pid-old", old);
  const ch = S.players["pid-old"].ch;
  assert.ok(ch.v >= 5);
  assert.deepEqual(ch.skl, [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(ch.wh, { items: [], gold: 0 });
  assert.equal(ch.pet, "");
  assert.deepEqual(ch.opt, { filter: 0, ahp: 0, amp: 0 });
}

// ── the experience curve: a quarter hour's hunting to Lv.7 must still be a curve that only climbs
{
  let last = 0;
  const S = L.setup();
  S.now = BASE;
  const c = L.newChar("곡선", "warrior", []);
  L.addPlayer(S, "pid-curve", c);
  const p = S.players["pid-curve"];
  for (let lv = 1; lv < 50; lv++) {
    p.ch.lvl = lv; p.dirty = true;
    const need = L.viewFor(S, "pid-curve").self.need;
    L.endTick(S);
    assert.ok(need > last, `Lv.${lv} needs more than Lv.${lv - 1}`);
    last = need;
  }
}

console.log("growth ok");
