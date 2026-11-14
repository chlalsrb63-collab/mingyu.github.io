// Headless test of character growth and the comforts of a long hunt — skill cooldowns and the
// job signatures, the warehouse, pets, scrolls of blessing, the revive
// feather, selling plain gear in one go, the loot filter and auto-potion settings:
// node tests/growth.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
const BASE = Date.UTC(2026, 10, 12, 23, 0, 0);

/** The weapon each of the four old classes carried (a test hero of that class holds it). */
const WK = { warrior: "sword", rogue: "dagger", lancer: "spear", mage: "staff" };
/** A world with one hero carrying `cls`'s weapon at what used to be level `lvl` (level 4·lvl − 3, mastery lvl, the job from 20). */
function world(name = "성장", cls = "warrior", lvl = 40) {
  const S = L.setup();
  let now = BASE;
  S.now = now;
  const PID = "pid-" + name;
  const ch = L.hero(name, { wk: WK[cls], lvl: Math.min(197, 4 * lvl - 3), migrate: true });
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
// (weapon skills: each weapon brings an active at mastery 1, another and a passive at 10; tests/skills.mjs has the rest)
for (const wk of D.wkOrder) {
  const own = D.skillOrder.filter((id) => D.skills[id].wk === wk && "ap".includes(D.skills[id].kind));
  assert.deepEqual(own.map((id) => [D.skills[id].kind, D.skills[id].need]), [["a", 1], ["a", 10], ["p", 10]], wk + "'s three skills");
}
assert.equal(D.whSlots, 60);
for (const id of ["sc_atk", "sc_def", "sc_xp", "feather", "pet_chick", "pet_bat", "pet_wisp", "hp_l", "mp_l"]) {
  assert.ok(D.items[id], id + " exists");
  assert.ok(D.shop.includes(id), "the shop sells " + id);
}
assert.ok(D.items.pet_chick.radius < D.items.pet_bat.radius && D.items.pet_bat.radius < D.items.pet_wisp.radius, "dearer pets reach further");
assert.ok(D.tutorial.length >= 1);

// ── stat points: experience bought into the six stats at the trainer (or a fire), shown with their prices
// (the cost table, batches, caps and resets in detail: tests/jobs.mjs)
{
  const W = world("수련", "warrior", 10);
  const ch = W.ch;
  ch.xp = 1e7;
  let s = W.self();
  assert.equal(s.lvl, 37); assert.equal(s.job, "adventurer");
  assert.equal(s.nx.length, 6, "the next point's price in each stat");
  assert.ok(s.nx.every((c) => c > 0));
  assert.ok(s.nx[0] >= s.nx[3], "a stat already above 30 costs a little more than one at 5");
  W.to("town", 30, 18);
  assert.equal(W.act({ t: "train", a: [1, 0, 0, 0, 0, 0] }).error, "모닥불 곁이나 수련관 앞에서 레벨을 올릴 수 있습니다");
  W.npc("train");
  const x0 = ch.xp, st0 = { ...ch.st }, atk0 = s.atk, hp0 = s.mhp;
  assert.ok(W.act({ t: "train", a: [2, 1, 0, 0, 0, 0] }).ok);
  assert.equal(ch.lvl, 40); assert.equal(ch.st.str, st0.str + 2); assert.equal(ch.st.wil, st0.wil + 1);
  assert.ok(ch.xp < x0 && ch.xpt > 0);
  s = W.self();
  assert.ok(s.atk > atk0 && s.mhp > hp0, "STR hits harder, WIL holds more");
  assert.equal(W.p.hp, s.mhp, "a level heals in full, as of old");
  for (const bad of [[1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [-1, 2, 0, 0, 0, 0], [51, 0, 0, 0, 0, 0], [0.5, 0, 0, 0, 0, 0], "1"]) assert.ok(!W.act({ t: "train", a: bad }).ok, "nonsense is refused: " + JSON.stringify(bad));
  ch.xp = 0;
  assert.equal(W.act({ t: "train", a: [1, 0, 0, 0, 0, 0] }).error, "경험치가 부족합니다");
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
  assert.ok(!W.act({ t: "train", a: [0, 0, 0, 0, 0, 0] }).ok);
  assert.deepEqual(L.takeSaves(W.S), [], "a refused action asks for nothing");
  assert.ok(W.act({ t: "train", a: [1, 0, 0, 0, 0, 0] }).ok);
  assert.deepEqual(L.takeSaves(W.S), [W.PID], "a stat point asks for a save");
  assert.deepEqual(L.takeSaves(W.S), [], "and the flag is handed out once");
  // the regular save clears a pending flag
  assert.ok(W.act({ t: "train", a: [0, 1, 0, 0, 0, 0] }).ok);
  L.exportChar(W.S, W.PID);
  assert.deepEqual(L.takeSaves(W.S), [], "the 15 s save already covered it");
  // a kill's experience only piles up: no level comes by itself, a word says where to spend it
  const p = W.p, rt = L.runtime(W.S, "meadow");
  W.to("meadow", 20, 20);
  ch.xp = 0;
  const lv0 = ch.lvl;
  W.step(); L.takeSaves(W.S);
  const mob = rt.mobs.find((o) => !o.dead && o.k === "twinhare");
  mob.el = 0; mob.hp = 1; mob.x = p.x + 12; mob.y = p.y; p.atkAt = 0; p.aim = 0; p.hp = 1e5; p.toast.length = 0;
  ch.xp = 1e6;
  assert.ok(W.act({ t: "atk" }).ok);
  W.step();
  assert.equal(ch.lvl, lv0, "experience never levels by itself");
  assert.ok(ch.xp > 1e6, "it piles up");
}

// ── WIS shortens every skill's wait (up to a quarter), and the sword's own mastery makes its attack grow
{
  const dmgOf = (wis) => {
    const W = world("강타" + wis, "warrior", 40);
    W.ch.st.wis = wis; W.p.stc = null;
    W.to("meadow", 20, 22);
    W.step();
    const p = W.p, rt = L.runtime(W.S, "meadow");
    let total = 0;
    for (let k = 0; k < 30; k++) {
      const m = rt.mobs.find((o) => o.k === "twinhare");
      m.dead = false; m.el = 0; m.tr = []; m.hp = 1e7; m.x = p.x + 16; m.y = p.y; m.by = {};
      p.mp = 999; p.cds.slash = 0; p.atkAt = 0;
      const h0 = m.hp;
      assert.ok(W.act({ t: "sk", id: "slash", a: 0 }).ok);
      total += h0 - m.hp;
      W.step(50);
    }
    const cd = W.self().sk.find((s) => s[0] === "slash")[2];
    return { total, cd };
  };
  const a = dmgOf(5), b = dmgOf(30), c = dmgOf(99);
  const cd = D.skills.slash.cd, cut = (w) => Math.min(0.25, 0.004 * w);
  const eff = (s) => Math.min(s, 40) + 0.5 * Math.min(20, Math.max(0, s - 40)) + 0.25 * Math.max(0, s - 60);
  for (const [r, w] of [[a, 5], [b, 30], [c, 99]]) assert.ok(Math.abs(r.cd + 150 - cd * (1 - cut(eff(w)))) <= 20, `WIS ${w}: ${r.cd}`);
  assert.ok(a.cd > b.cd && b.cd > c.cd, `cooldowns shorten: ${a.cd}, ${b.cd}, ${c.cd}`);
  // mastery: +1% a level on the weapon's own attack
  const W = world("숙련", "warrior", 1);
  const s1 = W.self().atk;
  W.ch.eq.weapon = gear("w_warrior_5"); W.p.stc = null;
  const lo = W.self().atk;
  W.ch.wm.sword.lv = 50; W.p.stc = null;
  const hi = W.self().atk;
  assert.ok(lo > s1 && Math.abs(hi - lo - 64 * 0.49) <= 1, `mastery 1 → 50 adds 49% of a tier-5 sword's 64: ${lo} → ${hi}`);
}

// ── every single job's signature goes off with its own effect and lands
// (what each one does is tested in tests/skills.mjs)
const SIG = { warrior: ["verdict", 83], rogue: ["flurry", 86], lancer: ["dragon", 89], mage: ["meteor", 90] };
for (const cls of Object.keys(WK)) {
  const W = world("궁극" + cls.slice(0, 2), cls, 40);
  W.to("meadow", 20, 22);
  W.step();
  const p = W.p, rt = L.runtime(W.S, "meadow");
  const [id, fx] = SIG[cls];
  const list = rt.mobs.filter((o) => !D.mobs[o.k].chest && !D.mobs[o.k].boss).slice(0, 6);
  for (const o of rt.mobs) if (!list.includes(o)) { o.dead = true; o.respAt = W.now + 1e9; }
  list.forEach((m, j) => { m.dead = false; m.el = 0; m.tr = []; m.hp = 5000; m.x = p.x + 30 + (j % 3) * 10; m.y = p.y - 8 + Math.floor(j / 3) * 14; m.by = {}; m.stun = 0; m.slow = 0; m.mk = 2; m.mkAt = W.now + 9000; });
  p.mp = 999; p.cds[id] = 0; p.dir = 2; p.aim = 0; p.hp = 1e6;
  assert.ok(W.act({ t: "sk", id }).ok, `${cls} casts ${D.skills[id].name}`);
  const v = W.step(50);
  const kinds = evts(v, "a").filter((e) => e[1] === p.eid).map((e) => e[2]);
  assert.ok(kinds.includes(fx), `${id} shows its own effect (${kinds})`);
  for (let k = 0; k < 40; k++) W.step(100);
  assert.ok(list.some((m) => m.dead || m.hp < 5000), `${id} lands`);
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
  ch.tut = { i: D.tutorial.findIndex((t) => t.id === "skill"), n: 0 };
  W.to("meadow", 20, 22);
  W.step();
  const p = W.p, m = L.runtime(W.S, "meadow").mobs.find((o) => o.k === "twinhare");
  m.dead = false; m.hp = 500; m.x = p.x + 16; m.y = p.y;
  p.mp = 999;
  assert.ok(W.act({ t: "sk", id: "slash" }).ok);
  assert.equal(D.tutorial[ch.tut.i].id, "level", "the skill step done; the stat-point step is last");
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
  assert.equal(s.dead.loss, Math.floor(Math.min(50000, 4 * D.lvc[s.lvl - 1]) * 0.03), "3% of up to about one old level's worth");
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
  // a v4 mage: a class, stat training, no skill levels yet, none of the comforts
  const old = L.newChar("옛날", []);
  for (const k of ["job", "xpt", "st", "wm", "rs", "sw", "cnt", "wh", "pet", "scr", "opt"]) delete old[k];
  Object.assign(old, { v: 4, cls: "mage", lvl: 12, tr: { str: 0, vit: 1, int: 0, grd: 0 } });
  old.eq.weapon = gear("w_mage_2");
  old.pet = "pet_wisp";                                      // claims a pet it does not own
  L.addPlayer(S, "pid-old", old);
  const ch = S.players["pid-old"].ch;
  assert.equal(ch.v, 12);
  assert.ok(!("skl" in ch) && !("tr" in ch) && !("cls" in ch));
  assert.equal(ch.lvl, 45); assert.equal(ch.wm.staff.lv, 12); assert.equal(ch.job, "adventurer");
  assert.deepEqual(ch.wh, { items: [], gold: 0 });
  assert.equal(ch.pet, "");
  assert.deepEqual(ch.opt, { filter: 0, ahp: 0, amp: 0 });
}

// ── the price of a level: a curve that only climbs, from the first point to the two-hundredth
{
  assert.equal(D.lvc.length, 200);
  for (let lv = 1; lv < 200; lv++) assert.ok(D.lvc[lv] > D.lvc[lv - 1], `Lv.${lv + 1}'s point costs more than Lv.${lv}'s`);
  assert.deepEqual(D.statK, [0.004, 30]);
}

console.log("growth ok");
