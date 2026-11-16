// Headless test of the charm system (docs/design/charms.md, phase C1): 주아나's quest and the unlock, sealed
// drops and what the wire shows of them, appraisal (the same every time), shapes on the board, the 16
// expansions, caps, the one legendary power, the pending box, migration, and the two legendary triggers.
//   node tests/charms.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { killMob, dimChest, charmAppraise, charmOwn, charmSeal, charmCells, charmFit, charmSum, charmChest, charmMarkK, charmsEmpty, charmExpandCost, charmIdCost, charmWire, migrate, stats, MOBS, CHARM_SRC, CHARM_LEGEND, CHARM_OPT, CHARM_SHAPES, CHARM_EXPAND, CHARM_V };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16, D = L.defs(), C = D.charms;
const VERBOSE = process.argv.includes("-v");
const log = (...a) => { if (VERBOSE) console.log(...a); };
const clone = (v) => JSON.parse(JSON.stringify(v));

let pidN = 0;
/** One hero in a fresh world, in town. */
function world(o = {}, name = "참" + pidN, pid = "") {
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = pid || "pid-charm" + pidN++;
  L.addPlayer(S, PID, o.ch || L.hero(name, o));
  const W = {
    S, PID,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = clone(L.viewFor(S, PID)); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    get ch() { return S.players[PID].ch; },
    get cs() { return S.players[PID].ch.charms; },
    get rt() { return S.maps[S.players[PID].map]; },
    go(id, tx, ty) {
      const p = W.p;
      if (p.map !== id) { L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.sendMap = true; W.map = W.step().map; }
      if (tx !== undefined) { p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; }
    },
    npc(role) { W.go("town"); const n = W.map.npcs.find((x) => x.role === role); assert.ok(n, role); W.p.x = n.x * T + 8; W.p.y = n.y * T + 30; W.p.mvAt = now; return n; },
    /** Open ground in a hunting field, every monster put away. */
    field(id = "meadow") {
      W.go(id);
      const mp = W.map, clear = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
      let spot = null;
      for (let y = 4; y < mp.h - 4 && !spot; y++) for (let x = 6; x < mp.w - 14 && !spot; x++) {
        let ok = true;
        for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -5; dx <= 13 && ok; dx++) if (!clear(x + dx, y + dy)) ok = false;
        if (ok) spot = [x, y];
      }
      assert.ok(spot, "open ground");
      W.home = [spot[0] * T + 8, spot[1] * T + 10];
      W.ready();
      W.rt.fb = -1;
    },
    ready() {
      const p = W.p;
      p.x = W.home[0]; p.y = W.home[1]; p.mvAt = now; p.fix = false; p.dir = 2; p.aim = 0;
      p.mp = 9999; p.hp = 1e6; p.atkAt = 0; p.stag = 0; p.combo = 0; p.dance = null; p.ghost = 0; p.cds = {};
      for (const m of W.rt.mobs) { m.dead = true; m.respAt = now + 1e12; }
      W.rt.props = []; W.rt.zones = []; W.rt.decoys = []; W.rt.shots = []; W.rt.drops = [];
    },
    /** Plain monsters at offsets from the player (kind `k` when given). */
    mobs(offs, hp = 50000, more = {}) {
      const p = W.p, pool = W.rt.mobs.filter((q) => !D.mobs[q.k].chest && !D.mobs[q.k].boss && !D.mobs[q.k].fly);
      return offs.map(([dx, dy], j) => {
        const m = pool[j];
        m.slot = null;
        Object.assign(m, { dead: false, el: 0, tr: [], hp, x: p.x + dx, y: p.y + dy, hx: p.x + dx, hy: p.y + dy, wx: p.x + dx, wy: p.y + dy, by: {}, stun: now + 1e9, slow: 0, mk: 0, mkAt: 0, dec: null, vuln: 0, brand: 0, dot: null, tgt: null, st: 0, act: null, castAt: now + 1e9, atkAt: now + 1e9, cmk: null, evt: 0, temp: 0, dim: 0, hk: 0, ...more });
        return m;
      });
    },
  };
  W.map = W.step().map;
  return W;
}
const evts = (v, tag) => (v.ev || []).filter((e) => e[0] === tag);
const run = (W, n = 10, ms = 100) => { const vs = []; for (let i = 0; i < n; i++) vs.push(W.step(ms)); return vs; };
/** A sealed charm in the bag (as if picked up): `seal` fixed when given. */
function give(W, src = 0, tier = 8, seal) {
  const c = X.charmOwn(W.ch, X.charmSeal(W.S, W.p, src, tier));
  if (seal !== undefined) c.seal = seal >>> 0;
  W.ch.inv.push(c);
  return c;
}
/** A seal that appraises to what `want(result)` asks for, from source `src`. */
function sealFor(src, want) {
  for (let s = 1; s < 400000; s++) { const r = X.charmAppraise({ seal: s, rv: X.CHARM_V, src }); if (want(r)) return s; }
  throw new Error("no such seal");
}
/** Unlock the board the short way (the quest is tested on its own below). */
function unlock(W, openN = 0) { W.cs.unlocked = true; W.cs.intro = 2; W.cs.openN = openN; }
/** An appraised charm of a given kind in the bag. */
function appraised(W, src, want) {
  const c = give(W, src, 8, sealFor(src, want));
  W.npc("charm"); W.ch.gold += 5000;
  assert.ok(W.act({ t: "charm_id", uid: c.uid }).ok);
  return c;
}

// ═════════ the tables and defs
{
  assert.equal(X.CHARM_EXPAND.length, 16);
  let total = 0;
  for (let k = 0; k < 16; k++) total += X.charmExpandCost(k);
  assert.equal(X.charmExpandCost(0), 2000); assert.equal(X.charmExpandCost(15), 36500); assert.equal(total, 252000);
  assert.deepEqual(C.expandCost, Array.from({ length: 16 }, (_, k) => X.charmExpandCost(k)));
  assert.deepEqual(C.expand, [[4, 1], [4, 2], [4, 3], [1, 4], [2, 4], [3, 4], [4, 4], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [2, 0], [3, 0], [4, 0], [0, 0]]);
  assert.equal(X.charmIdCost(8), Math.round(200 + 12 * 8)); assert.deepEqual(C.idCost, [200, 12]);
  assert.deepEqual(Object.keys(C.shapes), ["pin", "bar2", "bar3", "elbow", "tile2"]);
  assert.deepEqual(Object.values(C.shapes).map((s) => s.k), [1, 1.7, 2.3, 2.3, 2.9]);
  assert.deepEqual(C.shapes.elbow.cells, [[0, 0], [0, 1], [1, 1]]);
  for (const id of Object.keys(C.shapes)) assert.equal(C.shapes[id].rot.length, 4);
  assert.deepEqual(Object.fromEntries(Object.entries(C.opts).map(([k, o]) => [k, o.cap])), { st: 8, hp: 120, mp: 60, atk: 30, skd: 12, skh: 12 });
  assert.equal(C.legend.echo.shape, "bar3"); assert.equal(C.legend.knot.shape, "elbow"); assert.equal(C.legend.lens.shape, "tile2");
  assert.equal(C.legend.knot.off, 1, "수호의 매듭참 waits for a party heal");
  assert.equal(C.legend.echo.sk, "rend"); assert.equal(C.legend.lens.sk, "pierce");
  assert.equal(D.skills.rend.name, "대지 가르기"); assert.equal(D.skills.pierce.name, "관통 화살");
  for (const id of C.skd) assert.equal(D.skills[id].kind, "a");
  for (const id of C.skh) assert.ok(D.skills[id].heal > 0);
  assert.equal(D.items.charm.type, "charm"); assert.equal(D.items.charm_nail.name, "참틀 확장못");
  assert.equal(C.quests.length, 3); assert.deepEqual(C.quests.map((q) => q.lv), [30, 50, 90]);
  assert.equal(C.say.accept, "볼주머니에 넣기엔 제법 무거운 조각이네요. 빛을 품을 자리를 같이 찾아봐요.");
  assert.equal(C.say.appraise, "여기, 테두리에 무늬가 보여요. 돌려 보면 작은 빈자리에도 맞겠어요.");
  // 주아나 stands on open, reachable town ground by the 수련관
  const W = world();
  const n = W.map.npcs.find((x) => x.id === "town_charm_juana");
  assert.ok(n && n.role === "charm" && n.name.includes("주아나"));
  const kai = W.map.npcs.find((x) => x.role === "train");
  assert.ok(Math.abs(n.x - kai.x) <= 4 && Math.abs(n.y - kai.y) <= 4, "near the trainer");
  assert.equal(W.map.o[n.y][n.x], " ");
  assert.equal(W.map.npcs.filter((x) => x.x === n.x && x.y === n.y).length, 1, "a tile of her own");
}

// ═════════ Lv.29 refused, Lv.30 takes the quest, eight kills, one reward
{
  const W = world({ lvl: 29, wk: "sword" });
  assert.deepEqual(W.cs, X.charmsEmpty());
  W.npc("charm");
  assert.equal(W.act({ t: "charm_quest", a: "accept" }).error, "Lv.30부터 받을 수 있는 의뢰입니다");
  assert.equal(W.act({ t: "charm_quest", a: "done" }).error, "아직 의뢰를 마치지 못했습니다");
  W.ch.lvl = 30; W.p.stc = null;
  W.go("town", 5, 40);
  assert.equal(W.act({ t: "charm_quest", a: "accept" }).error, "주아나가 너무 멉니다");
  W.npc("charm");
  let s = W.self();
  assert.deepEqual(s.charms.quest, { i: 0, st: 0, n: 0, need: 8, lv: 30, ok: 1 });
  assert.equal(s.charms.un, 0); assert.deepEqual(s.charms.open, []);
  assert.ok(W.act({ t: "charm_quest", a: "accept" }).ok);
  assert.ok(W.p.save, "a save is asked for");
  assert.equal(W.act({ t: "charm_quest", a: "accept" }).error, "이미 진행 중입니다");
  assert.equal(W.cs.intro, 1);
  // kills: a monster more than four tiers below does not count, nor a chest; a fitting one does
  W.field("meadow");
  const tier = (30 + 3) / 4;
  const kill = (k, more) => { const [m] = W.mobs([[30, 0]], 10, more); m.k = k; m.by = { [W.PID]: 5 }; X.killMob(W.S, W.rt, m); };
  const low = Object.keys(X.MOBS).find((k) => X.MOBS[k].lv < tier - 4 && !X.MOBS[k].boss && !X.MOBS[k].chest);
  const fit = Object.keys(X.MOBS).find((k) => X.MOBS[k].lv >= tier - 4 && X.MOBS[k].lv <= tier && !X.MOBS[k].boss && !X.MOBS[k].chest && !X.MOBS[k].still);
  kill(low); assert.equal(W.cs.kn, 0, "too low a monster");
  kill(fit, { dim: 1 }); assert.equal(W.cs.kn, 0, "a rift's monster");
  kill(fit, { evt: 1 }); assert.equal(W.cs.kn, 0, "an invasion's monster");
  for (let i = 0; i < 7; i++) kill(fit);
  assert.equal(W.cs.kn, 7);
  W.npc("charm");
  assert.equal(W.act({ t: "charm_quest", a: "done" }).error, "아직 의뢰를 마치지 못했습니다");
  W.field("meadow"); kill(fit); kill(fit);
  assert.equal(W.cs.kn, 8, "counted to eight and no further");
  assert.equal(W.rt.drops.filter((d) => d.it === "charm").length, 0, "nothing drops before the board is open");
  // a full bag: the report stays open
  W.npc("charm");
  const keep = W.ch.inv.slice();
  while (W.ch.inv.length < 40) W.ch.inv.push({ id: "w_rogue_1", q: 0, enh: 0, af: [], sk: 0, ru: [] });
  assert.equal(W.act({ t: "charm_quest", a: "done" }).error, "가방을 비우고 다시 오세요");
  assert.equal(W.cs.intro, 1); assert.equal(W.cs.unlocked, false);
  W.ch.inv = keep;
  assert.ok(W.act({ t: "charm_quest", a: "done" }).ok);
  assert.equal(W.cs.unlocked, true); assert.equal(W.cs.freeId, 1); assert.equal(W.cs.intro, 2);
  const mine = W.ch.inv.filter((x) => x.id === "charm");
  assert.equal(mine.length, 1);
  // sent again: nothing more
  assert.equal(W.act({ t: "charm_quest", a: "done" }).ok, false);
  assert.equal(W.ch.inv.filter((x) => x.id === "charm").length, 1);
  s = W.self();
  assert.equal(s.charms.un, 1); assert.equal(s.charms.open.length, 9); assert.equal(s.charms.free, 1);
  assert.deepEqual(s.charms.next, { k: 0, cell: [4, 1], cost: 2000, nail: 0 });
  assert.equal(s.charms.quest.i, 1, "the Lv.50 follow-up is next"); assert.equal(s.charms.quest.ok, 0);
  // the first appraisal is free and always a 매직 1 × 1
  const gold = W.ch.gold;
  assert.ok(W.act({ t: "charm_id", uid: mine[0].uid }).ok);
  assert.equal(W.ch.gold, gold); assert.equal(W.cs.freeId, 0);
  assert.equal(mine[0].g, 1); assert.equal(mine[0].sh, "pin"); assert.equal(mine[0].op.length, 1);
  assert.equal(W.act({ t: "charm_id", uid: mine[0].uid }).error, "이미 감정한 참입니다");
  // the follow-ups: Lv.50 and Lv.90, a 확장못 each, once
  assert.equal(W.act({ t: "charm_quest", a: "accept" }).error, "Lv.50부터 받을 수 있는 의뢰입니다");
  for (const [lv, i] of [[50, 0], [90, 1]]) {
    W.ch.lvl = lv;
    assert.ok(W.act({ t: "charm_quest", a: "accept" }).ok);
    W.cs.kn = 8;
    const before = W.ch.inv.filter((x) => x.id === "charm_nail").reduce((n, x) => n + x.n, 0);
    assert.ok(W.act({ t: "charm_quest", a: "done" }).ok);
    assert.equal(W.cs.fu[i], 2);
    assert.equal(W.ch.inv.filter((x) => x.id === "charm_nail").reduce((n, x) => n + x.n, 0), before + 1);
    assert.equal(W.act({ t: "charm_quest", a: "done" }).ok, false);
  }
  assert.equal(W.act({ t: "charm_quest", a: "accept" }).error, "주아나의 의뢰를 모두 마쳤습니다");
  assert.equal(W.self().charms.quest, null);
  // a stat reset keeps the board (and the level falls back to 1)
  W.ch.rs = 1;
  W.npc("train");
  assert.ok(W.act({ t: "respec" }).ok);
  assert.equal(W.ch.lvl, 1); assert.equal(W.cs.unlocked, true); assert.equal(W.cs.intro, 2);
}

// ═════════ drops: measured against the table with fixed seeds; exclusions; nothing of the rarity on the wire
{
  const W = world({ lvl: 30, wk: "sword" });
  unlock(W);
  W.field("meadow");
  const tier = (30 + 3) / 4;
  const fit = Object.keys(X.MOBS).find((k) => X.MOBS[k].lv >= tier - 4 && X.MOBS[k].lv <= tier && !X.MOBS[k].boss && !X.MOBS[k].chest && !X.MOBS[k].still);
  const low = Object.keys(X.MOBS).find((k) => X.MOBS[k].lv < tier - 4 && !X.MOBS[k].boss && !X.MOBS[k].chest);
  const [m] = W.mobs([[30, 0]], 10);
  const hunt = (n, k, more = {}) => {
    const out = { charm: 0, nail: 0, g: [0, 0, 0, 0] };
    for (let i = 0; i < n; i++) {
      Object.assign(m, { k, dead: false, hp: 10, by: { [W.PID]: 5 }, el: 0, temp: 0, dim: 0, evt: 0, ...more });
      X.killMob(W.S, W.rt, m);
      for (const d of W.rt.drops) {
        if (d.it === "charm") { out.charm++; out.g[X.charmAppraise(d.c).g]++; assert.equal(d.c.src, more.el === 2 ? 2 : more.el ? 1 : 0); assert.equal(d.c.tier, X.MOBS[k].lv); assert.equal(d.q, 0); assert.equal(d.g, null); }
        if (d.it === "charm_nail") out.nail++;
      }
      W.rt.drops.length = 0; W.S.chat.length = 0; W.rt.ev.length = 0; W.p.gain.length = 0; W.p.toast.length = 0; W.rt.tele.length = 0;
    }
    return out;
  };
  const within = (got, n, p, tag) => { const sd = Math.sqrt(n * p * (1 - p)); assert.ok(Math.abs(got - n * p) <= 4 * sd + 1, `${tag}: ${got} of ${n} (expected ${(n * p).toFixed(1)} ± ${(4 * sd).toFixed(1)})`); };
  const N0 = 120000, N1 = 30000, N2 = 8000;
  const a = hunt(N0, fit), b = hunt(N1, fit, { el: 1 }), c = hunt(N2, fit, { el: 2, temp: 1 });
  within(a.charm, N0, 0.006, "field"); within(a.nail, N0, 0.0005, "field nail");
  within(b.charm, N1, 0.024, "elite"); within(b.nail, N1, 0.002, "elite nail");
  within(c.charm, N2, 0.12, "boss"); within(c.nail, N2, 0.01, "boss nail");
  log(`field   ${N0} kills: charm ${(a.charm / N0 * 100).toFixed(3)}% (0.60)  nail ${(a.nail / N0 * 100).toFixed(4)}% (0.05)  grades ${a.g.slice(1)}`);
  log(`elite   ${N1} kills: charm ${(b.charm / N1 * 100).toFixed(3)}% (2.40)  nail ${(b.nail / N1 * 100).toFixed(4)}% (0.20)  grades ${b.g.slice(1)}`);
  log(`boss    ${N2} kills: charm ${(c.charm / N2 * 100).toFixed(3)}% (12.0)  nail ${(c.nail / N2 * 100).toFixed(4)}% (1.00)  grades ${c.g.slice(1)}`);
  // exclusions: more than four tiers below, a rift's monster, an invasion's, a chest
  for (const [k, more, tag] of [[low, {}, "low"], [fit, { dim: 1 }, "rift"], [fit, { evt: 1 }, "invasion"]]) {
    const r = hunt(3000, k, { el: 2, temp: 1, ...more });
    assert.equal(r.charm + r.nail, 0, tag + " monsters drop no charm");
  }
  // the same world twice: the same drops (fixed seeds, no dice of the world's own spent)
  const again = () => { const V = world({ lvl: 30, wk: "sword" }, "재현", "pid-again"); unlock(V); V.field("meadow"); const [q] = V.mobs([[30, 0]], 10); const at = [];
    for (let i = 0; i < 4000; i++) { Object.assign(q, { k: fit, dead: false, hp: 10, by: { [V.PID]: 5 }, el: 2, temp: 1 }); X.killMob(V.S, V.rt, q); for (const d of V.rt.drops) if (d.c) at.push([i, d.c.seal]); V.rt.drops.length = 0; V.S.chat.length = 0; V.rt.ev.length = 0; }
    return at; };
  assert.deepEqual(again(), again());
  // the grade odds of every source, over many seals
  const odds = [];
  for (let src = 0; src < 4; src++) {
    const g = [0, 0, 0, 0], n = 200000;
    for (let s = 1; s <= n; s++) g[X.charmAppraise({ seal: s * 2654435761 >>> 0, rv: 1, src }).g]++;
    const want = X.CHARM_SRC[src].g;
    for (let i = 0; i < 3; i++) within(g[i + 1], n, want[i] / 100, `source ${src} grade ${i + 1}`);
    odds.push(g.slice(1).map((v) => (v / n * 100).toFixed(2)).join(" / "));
  }
  log("grade odds by source (매직 / 레어 / 전설 %):", odds.join("   |   "));
  // picking one up: a slot of its own, a uid, and nothing of what it is on the wire
  W.ready();
  Object.assign(m, { k: fit, dead: false, hp: 10, by: { [W.PID]: 5 }, el: 2, temp: 1, evt: 0, dim: 0 });
  let got = null;
  for (let i = 0; i < 400 && !got; i++) { Object.assign(m, { dead: false, by: { [W.PID]: 5 } }); W.rt.drops.length = 0; X.killMob(W.S, W.rt, m); got = W.rt.drops.find((d) => d.c); W.S.chat.length = 0; }
  assert.ok(got);
  W.rt.drops = [got]; got.x = W.p.x + 4; got.y = W.p.y;
  const before = W.ch.inv.length;
  const seen = [];
  for (let i = 0; i < 6 && W.ch.inv.length === before; i++) seen.push(W.step());
  W.p.dirty = true; seen.push(W.step());
  assert.equal(W.ch.inv.length, before + 1, "walked over, picked up");
  const inst = W.ch.inv[W.ch.inv.length - 1];
  assert.equal(inst.id, "charm"); assert.equal(inst.rev, 0); assert.ok(inst.uid >= 1); assert.equal(inst.seal, got.c.seal);
  const row = seen.flatMap((v) => v.D).find((d) => d[0] === got.id);
  if (row) assert.deepEqual(row.slice(1), ["charm", Math.round(got.x), Math.round(got.y), 0]);
  const wire = seen[seen.length - 1].self.inv.find((x) => x.id === "charm");
  assert.deepEqual(wire, { id: "charm", n: 1, uid: inst.uid, src: 2, tier: X.MOBS[fit].lv, rev: 0, cost: X.charmIdCost(X.MOBS[fit].lv) });
  const text = JSON.stringify(seen);
  assert.ok(!text.includes("seal") && !text.includes(String(inst.seal)), "the seal never leaves the server");
  // a full bag: it stays on the ground
  Object.assign(m, { dead: false, by: { [W.PID]: 5 } });
  const again2 = { ...got, id: 999999, c: { ...got.c, seal: 77 } };
  while (W.ch.inv.length < 40) W.ch.inv.push({ id: "w_rogue_1", q: 0, enh: 0, af: [], sk: 0, ru: [] });
  W.rt.drops = [again2]; again2.x = W.p.x + 4; again2.y = W.p.y; again2.dieAt = W.now + 60000;
  run(W, 5);
  assert.equal(W.rt.drops.length, 1, "no room: left where it lies");
  // tidying the bag never stacks charms; no shop, warehouse or house chest takes one
  W.ch.inv = [];
  const c1 = give(W), c2 = give(W);
  W.ch.inv.push({ id: "hp_s", n: 3 }, { id: "charm_nail", n: 1 });
  assert.ok(W.act({ t: "sort" }).ok);
  assert.deepEqual(W.ch.inv.filter((x) => x.id === "charm").map((x) => x.uid).sort(), [c1.uid, c2.uid]);
  W.npc("shop");
  const at = W.ch.inv.findIndex((x) => x.id === "charm");
  assert.equal(W.act({ t: "sell", s: at, n: 1 }).error, "참은 팔 수 없습니다");
  assert.equal(W.act({ t: "sell", s: W.ch.inv.findIndex((x) => x.id === "charm_nail"), n: 1 }).error, "참틀 확장못은 팔 수 없습니다");
  W.npc("bank");
  assert.equal(W.act({ t: "wh", a: "put", s: at, n: 1 }).error, "참은 맡길 수 없습니다");
  assert.equal(W.act({ t: "h_dep", s: at, n: 1 }).error, "참은 맡길 수 없습니다");
  assert.equal(W.act({ t: "eq", s: at }).ok, false); assert.equal(W.act({ t: "salv", s: at }).ok, false);
  assert.equal(W.act({ t: "qs", i: 0, v: ["i", "charm"] }).ok, false, "not on the quick bar");
  // destroying one asks for the confirmation
  assert.equal(W.act({ t: "charm_destroy", uid: c1.uid }).error, "참을 부수려면 확인이 필요합니다");
  assert.ok(W.act({ t: "charm_destroy", uid: c1.uid, ok: 1 }).ok);
  assert.equal(W.act({ t: "charm_destroy", uid: c1.uid, ok: 1 }).error, "가방에 없는 참입니다");
  assert.equal(W.ch.inv.filter((x) => x.id === "charm").length, 1);
}

// ═════════ appraisal: the seal decides, whatever is asked and however often; the cost by tier
{
  const W = world({ lvl: 40, wk: "sword" });
  unlock(W);
  W.ch.gold = 10000;
  const c = give(W, 1, 12), d = give(W, 3, 30);
  const want = X.charmAppraise(c);
  for (let i = 0; i < 5; i++) assert.deepEqual(X.charmAppraise(c), want);
  // not next to 주아나, not enough gold, no such charm
  W.go("town", 5, 40);
  assert.equal(W.act({ t: "charm_id", uid: c.uid }).error, "주아나가 너무 멉니다");
  W.npc("charm");
  assert.equal(W.act({ t: "charm_id", uid: 9999 }).error, "가방에 없는 참입니다");
  assert.equal(W.act({ t: "charm_id", uid: "1" }).error, "가방에 없는 참입니다");
  W.ch.gold = 10;
  assert.equal(W.act({ t: "charm_id", uid: c.uid }).error, "골드가 부족합니다 (344G 필요)");
  W.ch.gold = 10000;
  // a reconnect in between (export → a new world): the same charm comes out
  const saved = clone(L.exportChar(W.S, W.PID));
  const V = world({ ch: clone(saved) });
  V.npc("charm");
  assert.ok(V.act({ t: "charm_id", uid: c.uid }).ok);
  const vc = V.ch.inv.find((x) => x.uid === c.uid);
  assert.deepEqual({ g: vc.g, sh: vc.sh, op: vc.op, lg: vc.lg || "" }, want);
  assert.equal(V.ch.gold, 10000 - 344);
  assert.ok(W.act({ t: "charm_id", uid: c.uid }).ok);
  assert.deepEqual({ g: c.g, sh: c.sh, op: c.op, lg: c.lg || "" }, want);
  assert.equal(W.ch.gold, 10000 - 344, "round(200 + 12 × tier 12)");
  // asked again: refused, nothing charged, nothing changed
  const snap = clone(c);
  assert.equal(W.act({ t: "charm_id", uid: c.uid }).error, "이미 감정한 참입니다");
  assert.equal(W.ch.gold, 10000 - 344); assert.deepEqual(clone(c), snap);
  assert.ok(W.act({ t: "charm_id", uid: d.uid }).ok);
  assert.equal(W.ch.gold, 10000 - 344 - 560, "the cost is by the tier it came from, not by what it is");
  // what the owner is told once it is open — and still no seal
  const s = W.self();
  const w = s.inv.find((x) => x.uid === c.uid);
  assert.deepEqual(w, { id: "charm", n: 1, uid: c.uid, src: 1, tier: 12, rev: 1, g: c.g, sh: c.sh, op: c.op, ...(c.lg ? { lg: c.lg } : {}) });
  assert.ok(!JSON.stringify(s).includes("seal"));
  // options: one for a 매직, two different ones for a 레어, a power and one for a 전설; values by the shape
  for (let i = 1; i <= 30000; i++) {
    const r = X.charmAppraise({ seal: i, rv: 1, src: 3 });
    assert.equal(r.op.length, r.g === 2 ? 2 : 1);
    if (r.g === 2) assert.ok(r.op[0][0] !== r.op[1][0] || r.op[0][2] !== r.op[1][2], "two different options");
    if (r.g === 3) { assert.ok(r.lg === "echo" || r.lg === "lens", "the knot is not dropped yet"); assert.equal(r.sh, X.CHARM_LEGEND[r.lg].shape); } else assert.equal(r.lg, "");
    const k = X.CHARM_SHAPES[r.sh].k;
    for (const [kind, v, arg] of r.op) {
      const o = X.CHARM_OPT[kind];
      assert.ok(v >= (o.pct ? o.lo * k - 0.051 : Math.floor(o.lo * k)) && v <= o.hi * k + 0.051, `${kind} ${v} on ${r.sh}`);
      if (!o.pct) assert.ok(Number.isInteger(v), "whole options are floored");
      if (kind === "st") assert.ok(["str", "wil", "dex", "int", "wis", "luk"].includes(arg));
      if (kind === "skd") assert.ok(C.skd.includes(arg));
      if (kind === "skh") assert.ok(C.skh.includes(arg));
    }
  }
}

// ═════════ shapes: every shape × turn, overlap, locked cells, off the board, a move that ignores its own cells
{
  const cells = (sh, r) => X.charmCells(sh, r).map((c) => c.join(",")).join(" ");
  assert.equal(cells("pin", 0), "0,0"); assert.equal(cells("pin", 3), "0,0");
  assert.equal(cells("bar2", 0), "0,0 1,0"); assert.equal(cells("bar2", 1), "0,0 0,1"); assert.equal(cells("bar2", 2), "0,0 1,0"); assert.equal(cells("bar2", 3), "0,0 0,1");
  assert.equal(cells("bar3", 0), "0,0 1,0 2,0"); assert.equal(cells("bar3", 1), "0,0 0,1 0,2");
  assert.equal(cells("elbow", 0), "0,0 0,1 1,1"); assert.equal(cells("elbow", 1), "0,0 1,0 0,1"); assert.equal(cells("elbow", 2), "0,0 1,0 1,1"); assert.equal(cells("elbow", 3), "1,0 0,1 1,1");
  assert.equal(cells("tile2", 0), "0,0 1,0 0,1 1,1"); assert.equal(cells("tile2", 2), "0,0 1,0 0,1 1,1");
  for (const sh of Object.keys(X.CHARM_SHAPES)) for (let r = 0; r < 4; r++) {
    const cs = X.charmCells(sh, r);
    assert.equal(cs.length, X.CHARM_SHAPES[sh].cells.length);
    assert.equal(Math.min(...cs.map((c) => c[0])), 0); assert.equal(Math.min(...cs.map((c) => c[1])), 0);
    assert.ok(Math.max(...cs.map((c) => Math.max(c[0], c[1]))) <= 2, "no side longer than three");
    assert.deepEqual(C.shapes[sh].rot[r], cs, "defs carry the same turns");
  }
  // every shape, turn and anchor on a fully open and on a fresh board against a brute-force reading
  for (const openN of [0, 7, 16]) {
    const cs = { ...X.charmsEmpty(), unlocked: true, openN };
    const open = new Set(); for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) open.add(`${x},${y}`);
    for (let i = 0; i < openN; i++) open.add(X.CHARM_EXPAND[i].join(","));
    for (const sh of Object.keys(X.CHARM_SHAPES)) for (let r = 0; r < 4; r++) for (let y = -1; y <= 5; y++) for (let x = -1; x <= 5; x++) {
      const want = X.charmCells(sh, r).every(([cx, cy]) => open.has(`${x + cx},${y + cy}`));
      assert.equal(X.charmFit(cs, sh, x, y, r, 0) === "", want, `${sh} r${r} at ${x},${y} with ${openN} open`);
    }
  }
  const W = world({ lvl: 40, wk: "sword" });
  unlock(W);
  const el = appraised(W, 3, (r) => r.sh === "elbow"), pin = appraised(W, 3, (r) => r.sh === "pin"), bar = appraised(W, 3, (r) => r.sh === "bar3" && !r.lg), til = appraised(W, 3, (r) => r.sh === "tile2" && !r.lg);
  const sealed = give(W);
  assert.equal(W.act({ t: "charm_place", uid: sealed.uid, x: 1, y: 1, r: 0 }).error, "감정하지 않은 참은 놓을 수 없습니다");
  assert.equal(W.act({ t: "charm_place", uid: el.uid, x: 1, y: 1, r: 4 }).error, "잘못된 자리입니다");
  assert.equal(W.act({ t: "charm_place", uid: el.uid, x: 1.5, y: 1, r: 0 }).error, "잘못된 자리입니다");
  assert.equal(W.act({ t: "charm_place", uid: el.uid, x: 4, y: 4, r: 0 }).error, "보드 밖입니다");
  assert.equal(W.act({ t: "charm_place", uid: el.uid, x: 0, y: 1, r: 0 }).error, "잠긴 칸입니다");
  assert.equal(W.act({ t: "charm_place", uid: el.uid, x: 3, y: 3, r: 0 }).error, "잠긴 칸입니다");
  assert.equal(W.act({ t: "charm_place", uid: el.uid, x: 3, y: 2, r: 0 }).error, "잠긴 칸입니다");
  assert.ok(W.act({ t: "charm_place", uid: el.uid, x: 1, y: 1, r: 0 }).ok);        // (1,1) (1,2) (2,2)
  assert.equal(W.act({ t: "charm_place", uid: el.uid, x: 1, y: 1, r: 0 }).error, "가방에 없는 참입니다", "sent twice: placed once");
  assert.equal(W.cs.placed.length, 1); assert.ok(!W.ch.inv.includes(el));
  assert.equal(W.act({ t: "charm_place", uid: pin.uid, x: 2, y: 2, r: 0 }).error, "다른 참이 놓인 칸입니다");
  assert.ok(W.act({ t: "charm_place", uid: pin.uid, x: 2, y: 1, r: 0 }).ok, "the elbow's empty corner takes another charm");
  assert.equal(W.act({ t: "charm_place", uid: til.uid, x: 2, y: 2, r: 0 }).error, "다른 참이 놓인 칸입니다");
  assert.equal(W.act({ t: "charm_place", uid: bar.uid, x: 1, y: 3, r: 1 }).error, "보드 밖입니다");
  assert.ok(W.act({ t: "charm_place", uid: bar.uid, x: 1, y: 3, r: 0 }).ok);       // (1,3) (2,3) (3,3)
  // moving: its own cells do not count; another's do; the same place twice is refused
  assert.ok(W.act({ t: "charm_move", uid: el.uid, x: 1, y: 1, r: 1 }).ok === false, "(2,1) is the pin's");
  assert.ok(W.act({ t: "charm_remove", uid: pin.uid }).ok);
  assert.ok(W.act({ t: "charm_move", uid: el.uid, x: 1, y: 1, r: 1 }).ok, "turned in place over its own cells");  // (1,1) (2,1) (1,2)
  assert.equal(W.act({ t: "charm_move", uid: el.uid, x: 1, y: 1, r: 1 }).error, "이미 그 자리에 있습니다");
  assert.equal(W.act({ t: "charm_move", uid: el.uid, x: 2, y: 2, r: 0 }).error, "다른 참이 놓인 칸입니다");
  assert.equal(W.act({ t: "charm_move", uid: el.uid, x: 3, y: 1, r: 0 }).error, "잠긴 칸입니다");
  assert.deepEqual([W.cs.placed[0].x, W.cs.placed[0].y, W.cs.placed[0].r], [1, 1, 1], "a refused move leaves it where it was");
  assert.equal(W.act({ t: "charm_move", uid: pin.uid, x: 3, y: 1, r: 0 }).error, "보드에 없는 참입니다");
  assert.equal(W.act({ t: "charm_remove", uid: pin.uid }).error, "보드에 없는 참입니다");
  // the uid stays the same between bag and board
  assert.ok(W.ch.inv.some((x) => x.uid === pin.uid) && W.cs.placed.some((e) => e.c.uid === el.uid));
  // a full bag: the charm stays on the board
  const keep = W.ch.inv.slice();
  while (W.ch.inv.length < 40) W.ch.inv.push({ id: "w_rogue_1", q: 0, enh: 0, af: [], sk: 0, ru: [] });
  assert.equal(W.act({ t: "charm_remove", uid: el.uid }).error, "가방이 가득 찼습니다");
  assert.equal(W.cs.placed.length, 2);
  W.ch.inv = keep;
  // only in town
  W.field("meadow");
  assert.equal(W.act({ t: "charm_place", uid: pin.uid, x: 3, y: 1, r: 0 }).error, "참 보드는 마을에서만 바꿀 수 있습니다");
  assert.equal(W.act({ t: "charm_move", uid: el.uid, x: 2, y: 1, r: 0 }).error, "참 보드는 마을에서만 바꿀 수 있습니다");
  assert.equal(W.act({ t: "charm_remove", uid: el.uid }).error, "참 보드는 마을에서만 바꿀 수 있습니다");
  assert.equal(W.cs.placed.length, 2);
  // the wire: the board as it lies
  W.go("town");
  const s = W.self().charms;
  assert.equal(s.placed.length, 2);
  assert.deepEqual(s.placed[0], { c: X.charmWire(el), x: 1, y: 1, r: 1 });
  // before the board is unlocked nothing is placed
  const V = world({ lvl: 40 });
  const vp = give(V); vp.rev = 1; Object.assign(vp, X.charmAppraise(vp));
  assert.equal(V.act({ t: "charm_place", uid: vp.uid, x: 1, y: 1, r: 0 }).error, "아직 참 보드가 없습니다");
}

// ═════════ sixteen expansions: the order, the exact prices, a 확장못 each, once a request
{
  const W = world({ lvl: 40, wk: "sword" });
  unlock(W);
  W.npc("charm");
  assert.equal(W.act({ t: "charm_expand", k: 0 }).error, "참틀 확장못이 없습니다");
  W.ch.inv.push({ id: "charm_nail", n: 16 });
  W.ch.gold = 1999;
  assert.equal(W.act({ t: "charm_expand", k: 0 }).error, "골드가 부족합니다 (2,000G 필요)");
  assert.equal(W.cs.openN, 0);
  W.ch.gold = 252000;
  W.go("town", 5, 40);
  assert.equal(W.act({ t: "charm_expand", k: 0 }).error, "주아나가 너무 멉니다");
  W.npc("charm");
  let spent = 0;
  for (let k = 0; k < 16; k++) {
    const s = W.self().charms;
    assert.deepEqual(s.next, { k, cell: X.CHARM_EXPAND[k], cost: 2000 + 800 * k + 100 * k * k, nail: 16 - k }, "the next cell and its price are shown");
    assert.equal(s.open.length, 9 + k);
    assert.equal(W.act({ t: "charm_expand", k: k + 1 }).error, "이미 확장한 칸입니다");
    const gold = W.ch.gold;
    assert.ok(W.act({ t: "charm_expand", k }).ok);
    // the same request again (a resend): refused, nothing taken
    assert.equal(W.act({ t: "charm_expand", k }).ok, false);
    spent += gold - W.ch.gold;
    assert.equal(gold - W.ch.gold, 2000 + 800 * k + 100 * k * k);
    assert.equal(W.cs.openN, k + 1);
    assert.equal(W.ch.inv.filter((x) => x.id === "charm_nail").reduce((n, x) => n + x.n, 0), 15 - k);
    assert.ok(W.self().charms.open.some(([x, y]) => x === X.CHARM_EXPAND[k][0] && y === X.CHARM_EXPAND[k][1]));
  }
  assert.equal(spent, 252000); assert.equal(W.ch.gold, 0);
  assert.equal(W.self().charms.next, null); assert.equal(W.self().charms.open.length, 25);
  W.ch.inv.push({ id: "charm_nail", n: 1 }); W.ch.gold = 99999;
  assert.equal(W.act({ t: "charm_expand", k: 16 }).error, "참 보드를 모두 열었습니다");
}

// ═════════ what the board adds: only what lies on it, capped; HP and MP held to the new maximum; one power
{
  const W = world({ lvl: 60, wk: "sword" });
  unlock(W, 16);
  const base = clone(X.stats(W.p));
  const mk = (sh, op, lg) => { const c = give(W); Object.assign(c, { rev: 1, g: lg ? 3 : 1, sh, op }); if (lg) c.lg = lg; return c; };
  const hp = mk("pin", [["hp", 14, ""]]);
  assert.deepEqual(clone(X.stats(W.p)), base, "a charm in the bag does nothing");
  W.npc("charm");
  assert.ok(W.act({ t: "charm_place", uid: hp.uid, x: 0, y: 0, r: 0 }).ok);
  assert.equal(X.stats(W.p).mhp, base.mhp + 14);
  assert.equal(W.self().mhp, base.mhp + 14);
  W.p.hp = base.mhp + 14;
  assert.ok(W.act({ t: "charm_remove", uid: hp.uid }).ok);
  assert.equal(X.stats(W.p).mhp, base.mhp); assert.equal(W.p.hp, base.mhp, "HP held to the new maximum");
  // caps: stats +8 each, attack +30 after gear, HP +120, MP +60, a skill's damage and healing +12% each
  W.cs.placed = [];
  const put = (c, x, y) => W.cs.placed.push({ c, x, y, r: 0 });
  for (let i = 0; i < 5; i++) put(mk("pin", [["st", 5, "str"]]), i, 0);
  for (let i = 0; i < 5; i++) put(mk("pin", [["hp", 40, ""]]), i, 1);
  for (let i = 0; i < 5; i++) put(mk("pin", [["mp", 20, ""]]), i, 2);
  for (let i = 0; i < 5; i++) put(mk("pin", [["atk", 9, ""]]), i, 3);
  for (let i = 0; i < 3; i++) put(mk("pin", [["skd", 8.7, "rend"]]), i, 4);
  for (let i = 3; i < 5; i++) put(mk("pin", [["skh", 8.7, "soulbolt"]]), i, 4);
  W.p.stc = null;
  const sum = X.charmSum(W.ch);
  assert.deepEqual(sum.st, { str: 8, wil: 0, dex: 0, int: 0, wis: 0, luk: 0 });
  assert.deepEqual([sum.hp, sum.mp, sum.atk, sum.skd.rend, sum.skh.soulbolt], [120, 60, 30, 12, 12]);
  const st = X.stats(W.p);
  assert.equal(st.mhp, base.mhp + 120); assert.equal(st.mmp, base.mmp + 60);
  assert.ok(st.atk > base.atk + 30 && st.atk < base.atk + 30 + 8 * 1.2, `attack: +30 after gear, and eight points of strength (${base.atk} → ${st.atk})`);
  assert.equal(W.ch.st.str, clone(L.hero("기준", { lvl: 60, wk: "sword" })).st.str, "the sheet's own stats are untouched");
  assert.equal(W.ch.lvl, 60);
  const sv = W.self().charms.sum;
  assert.deepEqual(sv, { st: [8, 0, 0, 0, 0, 0], hp: 120, mp: 60, atk: 30, skd: { rend: 12 }, skh: { soulbolt: 12 } });
  // one legendary power at work: the first placed
  W.cs.placed = [];
  put(mk("bar3", [["hp", 20, ""]], "echo"), 0, 0); put(mk("tile2", [["mp", 10, ""]], "lens"), 0, 1);
  W.p.stc = null;
  assert.equal(X.charmSum(W.ch).lg, "echo");
  let s = W.self().charms;
  assert.equal(s.lg, "echo"); assert.equal(s.lgN, 2); assert.equal(s.lgWhy, "[대검] 숙련 10에 배웁니다", "why it cannot go off: the skill's own rule");
  assert.equal(X.charmSum(W.ch).hp, 20); assert.equal(X.charmSum(W.ch).mp, 10, "the second legendary's general option still counts");
  W.cs.placed.reverse(); W.p.stc = null;
  s = W.self().charms;
  assert.equal(s.lg, "lens"); assert.equal(s.lgWhy, "[활]을 들어야 쓸 수 있습니다");
  // a knot (not open yet) on a sheet does nothing
  W.cs.placed = []; put(mk("elbow", [["hp", 20, ""]], "knot"), 1, 1); W.p.stc = null;
  assert.equal(X.charmSum(W.ch).lg, ""); assert.equal(W.self().charms.lgWhy, "아직 열리지 않은 효과입니다");
}

// ═════════ a rift's chest: into the bag; a full bag → the one box at 주아나; the box full → the chest waits
{
  const W = world({ lvl: 60, wk: "sword" });
  unlock(W);
  const dim = { lv: 20, got: {}, chest: { x: W.p.x, y: W.p.y }, rt: W.rt };
  // measured over many openings
  let n = 0, nails = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    W.ch.inv = [];
    X.charmChest(W.S, dim, W.p);
    n += W.ch.inv.filter((x) => x.id === "charm").length; nails += W.ch.inv.filter((x) => x.id === "charm_nail").length;
  }
  log(`rift    ${N} chests: charm ${(n / N * 100).toFixed(2)}% (40.0)  nail ${(nails / N * 100).toFixed(2)}% (8.00)`);
  assert.ok(Math.abs(n / N - 0.4) < 0.015 && Math.abs(nails / N - 0.08) < 0.008, `${n} charms, ${nails} nails in ${N} chests`);
  W.p.gain.length = 0; W.p.toast.length = 0;
  // not unlocked: a chest holds no charm
  const V = world({ lvl: 60 });
  for (let i = 0; i < 300; i++) X.charmChest(V.S, { ...dim, rt: V.rt }, V.p);
  assert.equal(V.ch.inv.filter((x) => x.id === "charm" || x.id === "charm_nail").length, 0);
  // the real chest with a full bag: the charm goes to the box, the chest counts as opened
  const full = () => { W.ch.inv = []; while (W.ch.inv.length < 40) W.ch.inv.push({ id: "w_rogue_1", q: 0, enh: 0, af: [], sk: 0, ru: [] }); };
  let opened = 0;
  while (!W.cs.pending) { full(); delete dim.got[W.PID]; X.dimChest(W.S, dim, W.p); opened++; assert.ok(opened < 200); }
  assert.equal(dim.got[W.PID], 1);
  assert.equal(W.cs.pending.src, 3); assert.equal(W.cs.pending.tier, 20); assert.equal(W.cs.pending.rev, 0);
  assert.equal(W.ch.inv.length, 41, "the chest's gear is kept in an extra slot, not lost (60-content.js rewardGear)");
  // the box is taken and the bag is full: the chest stays shut, nothing is rolled, nothing is marked
  W.p.toast.length = 0;
  const day = clone(W.ch.dim), gold = W.ch.gold, chN = W.S.chN;
  for (let i = 0; i < 50; i++) { full(); delete dim.got[W.PID]; X.dimChest(W.S, dim, W.p); }
  assert.equal(dim.got[W.PID], undefined, "not opened");
  assert.deepEqual(W.ch.dim, day); assert.equal(W.ch.gold, gold); assert.equal(W.S.chN, chN, "no dice thrown while it waits");
  assert.ok(W.p.toast.some((t) => String(t).includes("보류함")), "told to make room");
  // two free slots: it opens again
  W.ch.inv.length = 38;
  X.dimChest(W.S, dim, W.p);
  assert.equal(dim.got[W.PID], 1);
  // the wire shows the box without what is in it
  const s = W.self().charms;
  assert.deepEqual(s.pending, { id: "charm", n: 1, uid: W.cs.pending.uid, src: 3, tier: 20, rev: 0, cost: 440 });
  // claiming: next to 주아나, with room; once
  full();
  W.go("town", 5, 40);
  assert.equal(W.act({ t: "charm_claim" }).error, "주아나가 너무 멉니다");
  W.npc("charm");
  assert.equal(W.act({ t: "charm_claim" }).error, "가방이 가득 찼습니다");
  assert.ok(W.cs.pending);
  W.ch.inv.length = 39;
  const uid = W.cs.pending.uid;
  assert.ok(W.act({ t: "charm_claim" }).ok);
  assert.equal(W.cs.pending, null); assert.equal(W.ch.inv[39].uid, uid);
  assert.equal(W.act({ t: "charm_claim" }).error, "맡겨 둔 참이 없습니다");
  assert.equal(W.ch.inv.filter((x) => x.uid === uid).length, 1);
}

// ═════════ migration: an old sheet; a broken board (the same uid twice, bad places) → the recovery queue
{
  // a sheet from before charms
  const old = L.hero("옛모험가", { lvl: 45, wk: "staff" });
  delete old.charms; old.v = 12;
  const W = world({ ch: clone(old) });
  assert.equal(W.ch.v, 27); assert.deepEqual(W.cs, X.charmsEmpty());
  assert.equal(W.self().charms.un, 0);
  // rubbish in the field
  for (const junk of [null, 7, "x", [], { placed: "no", pending: 5, rec: {}, openN: 99, unlocked: 1, nextUid: -4, fu: "x" }]) {
    const ch = L.hero("깨진판", { lvl: 45 }); ch.charms = junk;
    const V = world({ ch: clone(ch) });
    assert.ok(Array.isArray(V.cs.placed) && Array.isArray(V.cs.rec) && V.cs.pending === null && V.cs.nextUid >= 1 && V.cs.openN <= 16);
    assert.deepEqual(V.cs.fu.length, 2);
  }
  // a broken board
  const mk = (uid, seal, src = 3) => ({ id: "charm", n: 1, uid, seal, rv: 1, tier: 10, src, rev: 1, ...X.charmAppraise({ seal, rv: 1, src }) });
  const pinS = sealFor(3, (r) => r.sh === "pin"), barS = sealFor(3, (r) => r.sh === "bar3" && !r.lg), tilS = sealFor(3, (r) => r.sh === "tile2" && !r.lg);
  const ch = L.hero("복구", { lvl: 45, wk: "sword" });
  ch.charms = { unlocked: true, openN: 0, intro: 2, fu: [0, 0], kn: 0, freeId: 0, nextUid: 3, pending: null, rec: [],
    placed: [
      { c: mk(1, pinS), x: 1, y: 1, r: 0 },            // the bag holds a uid 1 too: the bag wins
      { c: mk(1, pinS + 1), x: 2, y: 1, r: 0 },        // the same uid again
      { c: mk(2, barS), x: 3, y: 3, r: 0 },            // off the board
      { c: mk(5, tilS), x: 0, y: 0, r: 0 },            // on locked cells
      { c: mk(6, pinS), x: 1, y: 1, r: 0 },            // fine (the cell is free by now)
      { c: mk(13, pinS), x: 1, y: 1, r: 0 },           // on a taken cell
      { c: { ...mk(7, pinS), rev: 0 }, x: 3, y: 3, r: 0 }, // still sealed
      { c: mk(8, pinS), x: "a", y: 1, r: 9 },          // nonsense
      { c: { id: "charm", uid: 9 }, x: 2, y: 2, r: 0 },  // no seal: nothing to keep
      { c: { ...mk(10, pinS), g: 3, sh: "tile2", op: [["atk", 999, ""]], lg: "echo" }, x: 3, y: 1, r: 0 }, // tampered: its seal says a pin
    ] };
  ch.inv.push(mk(1, pinS), { ...mk(11, barS), rev: 0 });   // the bag's own uid 1 wins over the board's
  ch.wh.items.push(mk(12, pinS));
  const V = world({ ch: clone(ch) });
  let cs = V.cs;
  assert.deepEqual(cs.placed.map((e) => e.c.uid), [6, 10], "only what fits stays, and nothing is put back by the server");
  const t = cs.placed[1].c;
  assert.equal(t.g, X.charmAppraise({ seal: pinS, rv: 1, src: 3 }).g); assert.equal(t.sh, "pin"); assert.ok(!t.lg, "an appraised charm is what its seal says");
  assert.equal(cs.rec.length, 8, "everything else waits in the recovery queue: " + cs.rec.map((c) => c.uid));
  const uids = [...V.ch.inv.filter((x) => x.id === "charm"), ...cs.placed.map((e) => e.c), ...cs.rec].map((c) => c.uid);
  assert.equal(new Set(uids).size, uids.length, "every uid is one charm");
  assert.ok(cs.nextUid > Math.max(...uids));
  assert.equal(V.ch.wh.items.filter((x) => x.id === "charm").length, 0, "none left in the warehouse");
  assert.equal(V.ch.inv.filter((x) => x.id === "charm").length, 2);
  assert.ok(X.charmSum(V.ch).atk <= 4, "the tampered +999 is gone");
  // migrating again changes nothing
  const once = clone(V.ch); X.migrate(V.ch);
  assert.deepEqual(clone(V.ch), once);
  cs = V.cs;
  // the queue is claimed at 주아나, into the bag, as room allows
  V.npc("charm");
  const s = V.self().charms;
  assert.equal(s.rec.length, 8); assert.ok(!JSON.stringify(s).includes("seal"));
  assert.ok(V.act({ t: "charm_claim" }).ok);
  assert.equal(cs.rec.length, 0); assert.equal(V.ch.inv.filter((x) => x.id === "charm").length, 10);
  assert.deepEqual(cs.placed.map((e) => e.c.uid), [6, 10]);
  // a save and a load keep bag, board and box as they were
  const saved = clone(L.exportChar(V.S, V.PID));
  const U = world({ ch: clone(saved) });
  assert.deepEqual(clone(U.cs), saved.charms); assert.deepEqual(clone(U.ch.inv), saved.inv);
}

// ═════════ 메아리 뿔참: the end of a 대지 가르기 wave, 18% again on the first monster there, 12 s apart
{
  const W = world({ lvl: 157, wk: "sword", wm: { sword: 30 } });
  unlock(W, 16);
  const echo = appraised(W, 3, (r) => r.lg === "echo");
  assert.ok(W.act({ t: "charm_place", uid: echo.uid, x: 0, y: 0, r: 0 }).ok);
  assert.equal(W.self().charms.lgWhy, "");
  W.field("meadow");
  const hits = (v, m) => evts(v, "h").filter((e) => e[1] === m.id).map((e) => e[2]);
  const cast = () => { W.ready(); const ms = W.mobs([[60 + 50, 0], [60 + 95, 0], [60 + 108, 0]], 5e6); const r = W.act({ t: "sk", id: "rend", a: 0 }); assert.ok(r.ok, r.error); return [W.step(), ms]; };
  // (the leap carries 60; the wave runs 120 on from there: its last 30% begins at 84)
  let [v, ms] = cast();
  assert.equal(Math.round(W.p.x - W.home[0]), 60, "leapt the full 60");
  let cm = evts(v, "cm");
  assert.equal(cm.length, 1); assert.deepEqual(cm[0].slice(0, 3), ["cm", W.p.eid, 0]);
  const [near, first, last] = ms.map((m) => hits(v, m));
  assert.equal(near.length, 1, "not in the last 30%"); assert.equal(last.length, 1, "only the first there");
  assert.equal(first.length, 2); assert.equal(first[1], Math.max(1, Math.round(first[0] * 0.18)), `18% of that hit: ${first}`);
  assert.equal(ms[1].by[W.PID], first[0] + first[1]);
  // again at once (the skill's wait put aside): the 12 s inner wait holds — also through a weapon swap of state
  [v, ms] = cast();
  assert.equal(evts(v, "cm").length, 0); assert.equal(hits(v, ms[1]).length, 1);
  run(W, 60, 100);
  [v] = cast();
  assert.equal(evts(v, "cm").length, 0, "still inside 12 s");
  run(W, 60, 100);
  [v, ms] = cast();
  assert.equal(evts(v, "cm").length, 1, "12 s on, it answers again");
  // nothing in the wave's end: nothing happens, and the wait is not spent
  run(W, 125, 100);
  W.ready(); const only = W.mobs([[60 + 40, 0]], 5e6);
  assert.ok(W.act({ t: "sk", id: "rend", a: 0 }).ok);
  v = W.step();
  assert.equal(evts(v, "cm").length, 0); assert.equal(hits(v, only[0]).length, 1);
  [v] = cast();
  assert.equal(evts(v, "cm").length, 1);
  // a monster the wave kills takes nothing more; the extra blow itself may kill, and is paid once
  run(W, 125, 100);
  W.ready(); const [weak] = W.mobs([[60 + 95, 0]], 1);
  const kills = W.ch.kills;
  assert.ok(W.act({ t: "sk", id: "rend", a: 0 }).ok);
  v = W.step();
  assert.equal(evts(v, "cm").length, 0); assert.ok(weak.dead); assert.equal(W.ch.kills, kills + 1);
  // off the board: no echo
  W.go("town");
  assert.ok(W.act({ t: "charm_remove", uid: echo.uid }).ok);
  W.field("meadow");
  run(W, 125, 100);
  [v] = cast();
  assert.equal(evts(v, "cm").length, 0);
  // taking it off and putting it back does not clear the wait
  W.go("town");
  assert.ok(W.act({ t: "charm_place", uid: echo.uid, x: 0, y: 0, r: 0 }).ok);
  W.field("meadow");
  [v] = cast(); assert.equal(evts(v, "cm").length, 1);
  W.go("town");
  assert.ok(W.act({ t: "charm_remove", uid: echo.uid }).ok); assert.ok(W.act({ t: "charm_place", uid: echo.uid, x: 0, y: 1, r: 0 }).ok);
  W.field("meadow");
  [v] = cast(); assert.equal(evts(v, "cm").length, 0, "the wait lives with the hero, not the board");
}

// ═════════ 길별의 렌즈참: 관통 화살's second target is marked 4 s; the next basic attack on it +15%; 14 s apart
{
  const W = world({ lvl: 157, wk: "bow", wm: { bow: 30 } });
  unlock(W, 16);
  const lens = appraised(W, 3, (r) => r.lg === "lens");
  assert.ok(W.act({ t: "charm_place", uid: lens.uid, x: 0, y: 0, r: 0 }).ok);
  assert.equal(W.self().charms.lg, "lens"); assert.equal(W.self().charms.lgWhy, "");
  W.field("meadow");
  const shoot = (offs) => { W.ready(); const ms = W.mobs(offs, 5e6); const r = W.act({ t: "sk", id: "pierce", a: 0 }); assert.ok(r.ok, r.error); return [run(W, 6), ms]; };
  let [vs, ms] = shoot([[40, 0], [80, 0], [120, 0]]);
  let cm = vs.flatMap((v) => evts(v, "cm"));
  assert.equal(cm.length, 1); assert.deepEqual([cm[0][2], cm[0][5]], [1, ms[1].id], "the second target, and only it");
  assert.ok(ms[1].cmk && ms[1].cmk.pid === W.PID && !ms[0].cmk && !ms[2].cmk);
  assert.ok(ms[1].cmk.until - W.now <= 4000 && ms[1].cmk.until - W.now > 3000);
  // the next basic attack on it: +15%, once
  assert.equal(X.charmMarkK(W.S, W.rt, W.p, ms[0]), 1);
  ms[0].dead = true;
  W.p.atkAt = 0;
  assert.ok(W.act({ t: "atk", a: 0 }).ok);
  vs = run(W, 5);
  cm = vs.flatMap((v) => evts(v, "cm"));
  assert.deepEqual(cm.map((e) => e[2]), [2], "the mark is spent by the arrow that lands");
  assert.equal(ms[1].cmk, null);
  W.p.atkAt = 0; assert.ok(W.act({ t: "atk", a: 0 }).ok);
  assert.equal(run(W, 5).flatMap((v) => evts(v, "cm")).length, 0, "one attack only");
  // +15% exactly, and a mark that ran out gives nothing
  ms[1].cmk = { pid: W.PID, until: W.now + 1000 };
  assert.equal(X.charmMarkK(W.S, W.rt, W.p, ms[1]), 1.15); assert.equal(X.charmMarkK(W.S, W.rt, W.p, ms[1]), 1);
  ms[1].cmk = { pid: W.PID, until: W.now - 1 };
  assert.equal(X.charmMarkK(W.S, W.rt, W.p, ms[1]), 1);
  ms[1].cmk = { pid: "someone-else", until: W.now + 1000 };
  assert.equal(X.charmMarkK(W.S, W.rt, W.p, ms[1]), 1, "another's mark is not mine"); assert.ok(ms[1].cmk);
  W.rt.ev.length = 0;
  // inside 14 s: no new mark; after: again
  [vs] = shoot([[40, 0], [80, 0]]);
  assert.equal(vs.flatMap((v) => evts(v, "cm")).length, 0);
  run(W, 140, 100);
  [vs, ms] = shoot([[40, 0], [80, 0]]);
  assert.equal(vs.flatMap((v) => evts(v, "cm")).filter((e) => e[2] === 1).length, 1);
  // one target only: no second, no mark, the wait unspent
  run(W, 145, 100);
  [vs] = shoot([[40, 0]]);
  assert.equal(vs.flatMap((v) => evts(v, "cm")).length, 0);
  [vs] = shoot([[40, 0], [80, 0]]);
  assert.equal(vs.flatMap((v) => evts(v, "cm")).filter((e) => e[2] === 1).length, 1);
  // a plain arrow that goes through two marks nothing
  run(W, 145, 100);
  W.ready(); ms = W.mobs([[40, 0], [60, 0]], 5e6);
  W.p.combo = 1; W.p.atkAt = W.now - 100;
  for (let i = 0; i < 3; i++) { W.p.atkAt = 0; W.act({ t: "atk", a: 0 }); assert.equal(run(W, 4).flatMap((v) => evts(v, "cm")).length, 0); }
  // without the charm: nothing
  W.go("town");
  assert.ok(W.act({ t: "charm_remove", uid: lens.uid }).ok);
  W.field("meadow");
  [vs] = shoot([[40, 0], [80, 0]]);
  assert.equal(vs.flatMap((v) => evts(v, "cm")).length, 0);
}

// ═════════ a skill option: +% damage on that skill only
{
  const dmg = (withCharm) => {
    const W = world({ lvl: 157, wk: "sword", wm: { sword: 30 } }, "피해비교");
    unlock(W, 16);
    if (withCharm) { const c = give(W); Object.assign(c, { rev: 1, g: 1, sh: "pin", op: [["skd", 12, "slash"]] }); W.npc("charm"); assert.ok(W.act({ t: "charm_place", uid: c.uid, x: 1, y: 1, r: 0 }).ok); }
    W.field("meadow");
    let a = 0, b = 0;
    for (let i = 0; i < 800; i++) {
      W.ready(); const [m] = W.mobs([[24, 0]], 5e7);
      W.act({ t: "sk", id: "slash", a: 0 }); W.step(); a += m.by[W.PID] || 0;
      W.ready(); const [q] = W.mobs([[70, 0]], 5e7);
      W.act({ t: "sk", id: "rend", a: 0 }); W.step(); b += q.by[W.PID] || 0;
    }
    return [a, b];
  };
  const [a0, b0] = dmg(false), [a1, b1] = dmg(true);
  assert.ok(a1 / a0 > 1.06 && a1 / a0 < 1.18, `파워 슬래쉬 +12%: ×${(a1 / a0).toFixed(3)}`);
  assert.ok(b1 / b0 > 0.95 && b1 / b0 < 1.05, `대지 가르기 as before: ×${(b1 / b0).toFixed(3)}`);
}

console.log("charms: ok");
