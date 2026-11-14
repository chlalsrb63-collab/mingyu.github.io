// Headless test of the bag's size and of housing: the bag grows 40 → 100 in steps of five for
// gold, and every way into the bag respects it; a house bought at the 하우징 안내인, made bigger,
// entered through the "내 집" door (alone or with the party), furnished (place, turn, pick up —
// collisions, wall pieces, the doorway, never walling anyone in, per-tier limits), its storage
// growing with its chests (deposit, withdraw, stacks, tidy, the last chest kept while full), a
// rest in bed, the private instance closing when it empties, and old sheets of every version.
// node tests/housing.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
const BASE = Date.UTC(2026, 10, 14, 3, 0, 0);

/** One world, any number of players in it (each with its own helpers). */
function world() {
  const S = L.setup();
  let now = BASE;
  S.now = now;
  const W = {
    S,
    get now() { return now; },
    set now(v) { now = v; },
    step(ms = 100) { now += ms; L.tick(S, now); const out = {}; for (const pid of Object.keys(S.players)) out[pid] = JSON.parse(JSON.stringify(L.viewFor(S, pid))); L.endTick(S); return out; },
    join(name, gold = 0) {
      const pid = "pid-" + name, ch = L.newChar(name, "warrior", []);
      ch.lvl = 30; ch.gold = gold;
      L.addPlayer(S, pid, ch);
      const P = {
        pid,
        get p() { return S.players[pid]; },
        get ch() { return S.players[pid].ch; },
        act(a) { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; },
        view() { S.players[pid].dirty = true; return W.step()[pid]; },
        self() { return P.view().self; },
        to(id, tx, ty) { const p = P.p; L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; p.sendMap = true; },
        /** Stand in front of a townsperson. */
        npc(role) { const n = L.atlas().maps.town.npcs.find((o) => o.role === role); assert.ok(n, role + " lives in town"); P.to("town", n.x, n.y); P.p.y = n.y * T + 30; },
        /** Walk onto the "내 집" door in town. */
        door() { const [x, y] = D.house.door[0]; P.to("town", x, y + 1); P.p.y = y * T + 11; return P.act({ t: "mv", x: P.p.x, y: P.p.y, d: 0 }); },
        /** Stand next to the tile (x, y) of the map one is on (south of it, or wherever is open). */
        by(x, y) {
          const m = L.runtime(S, P.p.map) && mapNow(P.p.map);
          for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) {
            const tx = x + dx, ty = y + dy;
            if (m.o[ty] && m.o[ty][tx] === " ") { P.p.x = tx * T + 8; P.p.y = ty * T + 10; return; }
          }
          throw new Error("nowhere to stand by " + x + "," + y);
        },
      };
      return P;
    },
  };
  const mapNow = (id) => { for (const pid of Object.keys(S.players)) if (S.players[pid].map === id) { S.players[pid].sendMap = true; return W.step()[pid].map; } return null; };
  W.mapNow = mapNow;
  return W;
}
const count = (ch, id) => ch.inv.reduce((a, s) => a + (s.id === id ? s.n || 1 : 0), 0);
const gear = (id, q = 0) => ({ id, q, enh: 0, af: [], sk: 0, ru: [] });

// ── definitions on the wire
assert.equal(D.inv, 40, "the bag starts at 40");
assert.equal(D.invMax, 100);
assert.equal(D.bag.step, 5);
assert.equal(D.bag.cost.length, 12, "twelve steps from 40 to 100");
for (let i = 1; i < 12; i++) assert.ok(D.bag.cost[i] > D.bag.cost[i - 1], "each step dearer than the last");
assert.ok(D.bag.cost[0] <= 1000 && D.bag.cost[11] >= 40000, "cheap first, expensive last");
assert.deepEqual(D.house.tiers.slice(1).map((t) => t.price), [10000, 40000, 120000]);
for (const k of ["fn_bed", "fn_table", "fn_chair", "fn_plant", "fn_rug_round", "fn_hearth", "fn_trophy", "fn_chest_wood", "fn_chest_iron", "fn_chest_magic"]) {
  assert.ok(D.items[k] && D.items[k].type === "furn" && D.items[k].price > 0, k + " is an item with a price");
  assert.ok(D.house.shop.includes(k), "the agent sells " + k);
}
assert.deepEqual(["fn_chest_wood", "fn_chest_iron", "fn_chest_magic"].map((k) => D.house.furn[k].cap), [20, 40, 60]);
assert.ok(L.atlas().maps.town.npcs.some((n) => n.role === "house" && n.name.includes("하우징 안내인")), "the housing agent stands in town");

// ── the bag: 40, then +5 at a time to 100, for gold
{
  const W = world(), A = W.join("가방", 0);
  assert.equal(A.ch.bagCap, 40);
  assert.equal(A.self().bagCap, 40);
  let r = A.act({ t: "bag_expand" });
  assert.equal(r.ok, false, "no gold, no bigger bag");
  assert.ok(r.error.includes("골드"), r.error);
  let paid = 0;
  for (let i = 0; i < 12; i++) {
    const cost = D.bag.cost[i];
    A.ch.gold = cost - 1;
    assert.equal(A.act({ t: "bag_expand" }).ok, false, "one gold short is refused");
    A.ch.gold = cost;
    assert.ok(A.act({ t: "bag_expand" }).ok, `step ${i + 1}`);
    assert.equal(A.ch.gold, 0, `step ${i + 1} costs ${cost}`);
    assert.equal(A.ch.bagCap, 40 + 5 * (i + 1));
    paid += cost;
  }
  assert.equal(A.self().bagCap, 100);
  assert.equal(paid, D.bag.cost.reduce((a, b) => a + b, 0));
  A.ch.gold = 1e9;
  r = A.act({ t: "bag_expand" });
  assert.equal(r.ok, false, "never past 100");
  assert.ok(r.error.includes("최대"), r.error);
}

// ── every way into the bag respects its size
{
  const W = world(), A = W.join("꽉참", 100000);
  const fill = (n) => { A.ch.inv = []; for (let i = 0; i < n; i++) A.ch.inv.push(gear("h_1")); };
  fill(40);
  A.npc("shop");
  assert.equal(A.act({ t: "buy", id: "hp_s", n: 1 }).ok, false, "a full 40-slot bag buys nothing new");
  assert.ok(A.act({ t: "bag_expand" }).ok);
  assert.ok(A.act({ t: "buy", id: "hp_s", n: 5 }).ok, "with 45 slots it does");
  assert.equal(A.ch.inv.length, 41);
  fill(45);
  // the warehouse gives back only what fits
  A.ch.wh.items = [gear("a_1"), { id: "hp_s", n: 3 }];
  A.npc("bank");
  assert.equal(A.act({ t: "wh", a: "take", s: 0 }).ok, false, "a full bag takes nothing out of the warehouse");
  assert.equal(A.act({ t: "wh", a: "take", s: 1, n: 3 }).ok, false);
  A.ch.inv.pop();
  assert.ok(A.act({ t: "wh", a: "take", s: 0 }).ok, "one free slot takes one piece");
  // pickup: a drop at the feet of a full bag stays where it is
  fill(45);
  A.to("meadow", 30, 30);
  const rt = W.S.maps.meadow;
  rt.drops.push({ id: W.S.nextId++, it: "hp_s", n: 2, x: A.p.x, y: A.p.y, own: A.pid, freeAt: 0, at: W.now, g: null, q: 0 });
  W.step(); W.step();
  assert.equal(count(A.ch, "hp_s"), 0, "nothing picked up into a full bag");
  A.ch.inv.pop();
  for (let i = 0; i < 5; i++) W.step();
  assert.equal(count(A.ch, "hp_s"), 2, "with room it is picked up");
  // unequipping needs a free slot too
  fill(45);
  assert.equal(A.act({ t: "uneq", k: "armor" }).ok, false);
}

// ── a house: bought at the agent, entered through the door, made bigger
const W = world();
const A = W.join("집주인", 1000000);
{
  let r = A.door();
  assert.ok(r.ok);
  assert.equal(A.p.map, "town", "without a house the door does not open");
  assert.ok(A.view().toast.some((t) => t.includes("하우징 안내인")), "and says where to get one");
  A.to("town", 20, 18);
  r = A.act({ t: "house_buy" });
  assert.equal(r.ok, false, "a house is bought at the agent");
  A.npc("house");
  A.ch.gold = 9999;
  assert.equal(A.act({ t: "house_buy" }).ok, false, "for 10,000 G");
  A.ch.gold = 1000000;
  assert.ok(A.act({ t: "house_buy" }).ok);
  assert.equal(A.ch.gold, 1000000 - 10000);
  assert.equal(A.ch.house.tier, 1);
  assert.equal(A.act({ t: "house_buy" }).ok, false, "one house each");
  assert.ok(A.ch.house.furn.some((f) => f.id === "fn_bed") && A.ch.house.furn.some((f) => f.id === "fn_chest_wood"), "a housewarming bed and chest");
  const s = A.self();
  assert.equal(s.house[0], 1, "self.house carries the tier");
  assert.equal(s.house[3], 20, "and the storage the chest gives");
  assert.equal(s.house[6], 0, "and that we are outside");

  r = A.door();
  assert.ok(r.ok);
  assert.ok(A.p.map.startsWith("house_"), "the door leads home: " + A.p.map);
  const v = A.view();
  assert.equal(v.map.theme, "interior");
  assert.equal(v.map.w, D.house.tiers[1].w);
  assert.equal(v.map.h, D.house.tiers[1].h);
  assert.ok(v.map.home && v.map.fd, "a house carries its furniture turns");
  assert.ok(v.map.name.includes("집주인"), v.map.name);
  assert.equal(v.self.house[6], 1, "at home");
  assert.ok(Array.isArray(v.self.house[7]) && v.self.house[7].length === 3, "with the furniture list");
  assert.ok(v.map.portals.some((p) => p.to === "넥서스 광장" && p.door), "a door back out");
  assert.ok(W.S.homes[A.p.map], "the house is a live instance");
  assert.ok(v.map.o.some((row) => row.includes("[")) && v.map.o.some((row) => row.includes("p")), "the chest and the bed stand in the room");
}

// ── furniture: buy, place, turn, pick up
const H = () => A.ch.house;
const home = () => A.p.map;
{
  assert.equal(A.act({ t: "furn_buy", id: "fn_chair", n: 2 }).ok, false, "furniture is bought at the agent, not at home");
  A.act({ t: "house_leave" });
  assert.equal(A.p.map, "town");
  A.npc("house");
  const g0 = A.ch.gold;
  assert.ok(A.act({ t: "furn_buy", id: "fn_chair", n: 2 }).ok);
  assert.ok(A.act({ t: "furn_buy", id: "fn_table", n: 1 }).ok);
  assert.ok(A.act({ t: "furn_buy", id: "fn_hearth", n: 1 }).ok);
  assert.ok(A.act({ t: "furn_buy", id: "fn_rug_round", n: 3 }).ok);
  assert.ok(A.act({ t: "furn_buy", id: "fn_chest_iron", n: 1 }).ok);
  assert.ok(A.act({ t: "furn_buy", id: "fn_plant", n: 12 }).ok);
  assert.equal(g0 - A.ch.gold, 2 * 300 + 600 + 5000 + 3 * 500 + 12000 + 12 * 400, "at their prices");
  assert.equal(count(A.ch, "fn_chair"), 2);
  assert.equal(A.act({ t: "furn_place", id: "fn_chair", x: 3, y: 3 }).ok, false, "only at home");
  A.door();
  assert.ok(home().startsWith("house_"));

  // the table and its chairs
  assert.ok(A.act({ t: "furn_place", id: "fn_table", x: 4, y: 3 }).ok);
  let r = A.act({ t: "furn_place", id: "fn_chair", x: 4, y: 3 });
  assert.equal(r.ok, false, "never two pieces on one tile");
  assert.ok(r.error.includes("이미"), r.error);
  assert.ok(A.act({ t: "furn_place", id: "fn_chair", x: 3, y: 3, d: 1 }).ok);
  assert.equal(count(A.ch, "fn_chair"), 1, "a placed piece leaves the bag");
  const m = W.mapNow(home());
  assert.equal(m.o[3][4], "o"); assert.equal(m.o[3][3], "k");
  assert.equal(m.fd["3,3"], 1, "turned as asked");
  // the room's edges, the doorway, a wall piece away from the wall
  assert.equal(A.act({ t: "furn_place", id: "fn_chair", x: 0, y: 3 }).ok, false, "not in the wall");
  const [ex, ey] = [D.house.tiers[1].w >> 1, D.house.tiers[1].h - 2];
  r = A.act({ t: "furn_place", id: "fn_chair", x: ex, y: ey });
  assert.equal(r.ok, false); assert.ok(r.error.includes("문 앞"), r.error);
  r = A.act({ t: "furn_place", id: "fn_hearth", x: 4, y: 4 });
  assert.equal(r.ok, false); assert.ok(r.error.includes("벽"), r.error);
  assert.ok(A.act({ t: "furn_place", id: "fn_hearth", x: 5, y: 1 }).ok, "the hearth against the back wall");
  // someone standing there
  A.p.x = 6 * T + 8; A.p.y = 4 * T + 10;
  r = A.act({ t: "furn_place", id: "fn_plant", x: 6, y: 4 });
  assert.equal(r.ok, false); assert.ok(r.error.includes("서 있습니다"), r.error);
  A.p.x = ex * T + 8; A.p.y = ey * T + 10;
  // rugs lie under the walkway (and under furniture), one rug a tile
  assert.ok(A.act({ t: "furn_place", id: "fn_rug_round", x: 4, y: 3 }).ok, "a rug under the table");
  assert.ok(A.act({ t: "furn_place", id: "fn_rug_round", x: ex, y: ey }).ok, "and one at the doorway");
  assert.equal(A.act({ t: "furn_place", id: "fn_rug_round", x: ex, y: ey }).ok, false, "but not two");
  assert.equal(W.mapNow(home()).g[ey][ex], "u");
  // never wall anyone in: a ring of plants round (1..3, 4..6) would close off the corner
  const pieces = () => H().furn.length;
  assert.ok(A.act({ t: "furn_place", id: "fn_plant", x: 1, y: 4 }).ok);
  assert.ok(A.act({ t: "furn_place", id: "fn_plant", x: 2, y: 5 }).ok);
  r = A.act({ t: "furn_place", id: "fn_plant", x: 1, y: 6 });
  assert.equal(r.ok, false, "a corner tile left with no way in"); assert.ok(r.error.includes("길"), r.error);
  r = A.act({ t: "furn_place", id: "fn_plant", x: 2, y: 6 });
  assert.equal(r.ok, false, "nor sealing (1, 5) off"); assert.ok(r.error.includes("길"), r.error);
  // per-tier limit: 12 pieces in the cottage
  const lim = D.house.tiers[1].furn;
  for (const [x, y] of [[7, 3], [7, 5], [5, 5], [3, 5], [8, 4], [6, 2], [8, 6]]) if (pieces() < lim) assert.ok(A.act({ t: "furn_place", id: "fn_plant", x, y }).ok, `plant at ${x},${y}`);
  assert.equal(pieces(), lim);
  r = A.act({ t: "furn_place", id: "fn_plant", x: 3, y: 2 });
  assert.equal(r.ok, false); assert.ok(r.error.includes(`${lim}개`), r.error);
  // turning and picking up
  const chair = H().furn.find((f) => f.id === "fn_chair");
  assert.ok(A.act({ t: "furn_rot", u: chair.uid }).ok);
  assert.equal(chair.dir, 2);
  assert.equal(W.mapNow(home()).fd["3,3"], 2);
  const hearth = H().furn.find((f) => f.id === "fn_hearth");
  assert.equal(A.act({ t: "furn_rot", u: hearth.uid }).ok, false, "a wall piece keeps its back to the wall");
  assert.equal(A.act({ t: "furn_rot", u: 999 }).ok, false);
  assert.ok(A.act({ t: "furn_pick", u: chair.uid }).ok);
  assert.equal(count(A.ch, "fn_chair"), 2, "back in the bag");
  assert.equal(W.mapNow(home()).o[3][3], " ");
  for (const f of H().furn.filter((f) => f.id === "fn_plant")) assert.ok(A.act({ t: "furn_pick", u: f.uid }).ok);
  assert.equal(count(A.ch, "fn_plant"), 13, "the twelve bought and the housewarming one");
  // a style
  assert.ok(A.act({ t: "house_style", floor: 1, wall: 2 }).ok);
  const ms = W.mapNow(home());
  assert.equal(ms.g[2][2], "l", "walnut boards");
  assert.equal(ms.style, D.house.walls[2][0]);
  assert.equal(A.act({ t: "house_style", floor: 9 }).ok, false);
  assert.equal(A.act({ t: "house_style", floor: 1 }).ok, false, "already so");
}

// ── storage: as big as the chests placed; deposit, withdraw, stacks, tidy, the last chest
{
  const st = () => A.ch.house.storage;
  const chest = H().furn.find((f) => f.id === "fn_chest_wood");
  A.p.x = ex() * T + 8; A.p.y = ey() * T + 10;
  A.ch.inv = A.ch.inv.filter((s) => s.id !== "hp_s");
  A.ch.inv.push({ id: "hp_s", n: 50 });
  let r = A.act({ t: "h_dep", s: A.ch.inv.length - 1, n: 10 });
  assert.equal(r.ok, false, "only next to a chest"); assert.ok(r.error.includes("보관함"), r.error);
  A.by(chest.x, chest.y);
  const hpAt = () => A.ch.inv.findIndex((s) => s.id === "hp_s");
  assert.ok(A.act({ t: "h_dep", s: hpAt(), n: 10 }).ok);
  assert.ok(A.act({ t: "h_dep", s: hpAt(), n: 15 }).ok);
  assert.deepEqual(st(), [{ id: "hp_s", n: 25 }], "stacks merge in the storage");
  for (let i = 0; i < 19; i++) st().push(gear("h_1"));
  A.ch.inv.push(gear("a_1"));
  r = A.act({ t: "h_dep", s: A.ch.inv.length - 1 });
  assert.equal(r.ok, false, "20 slots from the wooden chest"); assert.ok(r.error.includes("가득"), r.error);
  assert.ok(A.act({ t: "h_dep", s: hpAt(), n: 5 }).ok, "a stack with room still takes more");
  assert.equal(A.self().house[3], 20);
  // the iron safe: +40
  const spot = [2, 2];
  assert.ok(A.act({ t: "furn_place", id: "fn_chest_iron", x: spot[0], y: spot[1] }).ok);
  assert.equal(A.self().house[3], 60, "storage grows with the chests");
  A.by(chest.x, chest.y);
  assert.ok(A.act({ t: "h_dep", s: A.ch.inv.length - 1 }).ok, "now the armour fits");
  assert.equal(st().length, 21);
  // withdraw
  const bagN = A.ch.inv.length;
  assert.ok(A.act({ t: "h_wd", s: st().length - 1 }).ok);
  assert.equal(A.ch.inv.length, bagN + 1);
  assert.equal(A.ch.inv[A.ch.inv.length - 1].id, "a_1");
  assert.equal(st()[0].id, "hp_s");
  assert.ok(A.act({ t: "h_wd", s: 0, n: 10 }).ok, "a part of a stack");
  assert.equal(st()[0].n, 20);
  assert.equal(A.act({ t: "h_wd", s: 0, n: 999 }).ok, false, "no more than is there");
  // tidy: stacks merge, kinds in order
  st().push({ id: "mp_s", n: 3 }, { id: "hp_s", n: 2 }, gear("w_warrior_1"));
  assert.ok(A.act({ t: "h_sort" }).ok);
  assert.equal(st()[0].id, "w_warrior_1", "weapons first");
  assert.equal(st().filter((s) => s.id === "hp_s").length, 1, "the potions in one stack");
  // the last chest: storage would shrink below what it holds
  while (st().length < 30) st().push(gear("h_1"));
  const safe = H().furn.find((f) => f.id === "fn_chest_iron");
  r = A.act({ t: "furn_pick", u: safe.uid });
  assert.equal(r.ok, false, "a chest whose slots are in use stays"); assert.ok(r.error.includes("보관함"), r.error);
  const wood = H().furn.find((f) => f.id === "fn_chest_wood");
  assert.ok(A.act({ t: "furn_pick", u: wood.uid }).ok, "the wooden chest may go: 40 slots still hold 30");
  assert.equal(A.self().house[3], 40);
  r = A.act({ t: "furn_pick", u: safe.uid });
  assert.equal(r.ok, false, "the last chest stays while it holds anything");
  // storage furniture per tier: two in the cottage
  assert.ok(A.act({ t: "furn_place", id: "fn_chest_wood", x: 8, y: 1 }).ok);
  A.npc("house");
  assert.ok(A.act({ t: "furn_buy", id: "fn_chest_wood", n: 1 }).ok);
  A.door();
  r = A.act({ t: "furn_place", id: "fn_chest_wood", x: 8, y: 2 });
  assert.equal(r.ok, false); assert.ok(r.error.includes("보관 가구"), r.error);
  // only the owner opens it
  st().length = 0;
}

// ── 안락한 휴식: a bed heals and warms, then waits half an hour
{
  const bed = H().furn.find((f) => f.id === "fn_bed");
  const p = A.p;
  p.hp = 1; p.mp = 0;
  A.p.x = ex() * T + 8; A.p.y = ey() * T + 10;
  let r = A.act({ t: "h_rest", u: bed.uid });
  assert.equal(r.ok, false, "from the bedside"); assert.ok(r.error.includes("가까이"), r.error);
  A.by(bed.x, bed.y);
  const xp0 = A.self().xpb;
  assert.ok(A.act({ t: "h_rest", u: bed.uid }).ok);
  const s = A.self();
  assert.ok(p.hp > s.mhp * 0.45 && p.mp > s.mmp * 0.45, "half the health and mana back");
  assert.equal(s.xpb, xp0 + D.house.rest.xp, "experience up while it lasts");
  assert.ok(s.buffs[11] > 14 * 60000, "and the buff shows (self.buffs[11])");
  r = A.act({ t: "h_rest", u: bed.uid });
  assert.equal(r.ok, false, "not again at once"); assert.ok(r.error.includes("분 뒤"), r.error);
  const chest = H().furn.find((f) => f.store || f.id === "fn_chest_iron");
  assert.equal(A.act({ t: "h_rest", u: chest.uid }).ok, false, "a chest is no bed");
  A.ch.house.cozy = 0; A.ch.house.rest = 0;
}

// ── a bigger house: the furniture stays, the limits grow
{
  const n0 = H().furn.length;
  A.ch.gold = 39999;
  assert.equal(A.act({ t: "house_upgrade" }).ok, false, "40,000 G for the second tier");
  A.ch.gold = 1000000;
  assert.ok(A.act({ t: "house_upgrade" }).ok, "from inside the house");
  assert.equal(A.ch.gold, 1000000 - 40000);
  assert.equal(H().tier, 2);
  assert.equal(H().furn.length, n0, "every piece where it was");
  const m = W.mapNow(home());
  assert.equal(m.w, D.house.tiers[2].w);
  assert.ok(A.p.x < m.w * T && A.p.y < m.h * T);
  assert.ok(A.act({ t: "house_upgrade" }).ok);
  assert.equal(H().tier, 3);
  assert.equal(A.act({ t: "house_upgrade" }).ok, false, "three tiers");
  assert.equal(W.mapNow(home()).h, D.house.tiers[3].h);
}

// ── friends: party members come in with the owner; out when the owner leaves or the party breaks
{
  const B = W.join("손님", 50000), C = W.join("이웃", 50000);
  A.act({ t: "house_leave" });
  // B has no house: the door leads into a party member's open house only
  B.door();
  assert.equal(B.p.map, "town", "nobody home to visit");
  assert.ok(A.act({ t: "pinv", e: B.p.eid }).ok); assert.ok(B.act({ t: "pacc" }).ok);
  B.door();
  assert.equal(B.p.map, "town", "the owner is not at home");
  A.door();
  const hid = home();
  B.door();
  assert.equal(B.p.map, hid, "with the owner inside, a party member walks in");
  let v = B.view();
  assert.ok(v.map.name.includes("집주인"));
  assert.equal(v.self.house[6], 2, "as a guest");
  assert.equal(B.act({ t: "furn_place", id: "fn_chair", x: 2, y: 3 }).ok, false, "a guest does not move the furniture");
  assert.equal(B.act({ t: "h_sort" }).ok, false, "nor open the storage");
  // a guest may rest in the owner's bed (their own cooldown)
  const bed = H().furn.find((f) => f.id === "fn_bed");
  B.by(bed.x, bed.y);
  assert.ok(B.act({ t: "h_rest", u: bed.uid }).ok, "a guest rests too");
  // C has a house of their own: visits from the agent
  C.ch.house.tier = 1;
  C.npc("house");
  assert.equal(C.act({ t: "house_visit", o: A.p.eid }).ok, false, "only party members visit");
  assert.ok(A.act({ t: "pinv", e: C.p.eid }).ok); assert.ok(C.act({ t: "pacc" }).ok);
  C.to("town", 20, 18);
  assert.equal(C.act({ t: "house_visit", o: A.p.eid }).ok, false, "from the agent or the door");
  C.npc("house");
  assert.ok(C.act({ t: "house_visit", o: A.p.eid }).ok);
  assert.equal(C.p.map, hid);
  assert.equal(W.S.maps[hid].n, 3);
  // leaving the party walks you out
  assert.ok(C.act({ t: "pleave" }).ok);
  const seen = W.step();
  assert.equal(C.p.map, "town", "out of the party, out of the house");
  assert.ok(seen[C.pid].toast.some((t) => t.includes("집 밖")), "and is told why");
  // the owner leaves: the guest goes too, the house closes once empty
  assert.ok(A.act({ t: "house_leave" }).ok);
  W.step();
  assert.equal(B.p.map, "town", "no host, no guests");
  assert.ok(W.S.homes[hid] && !W.S.maps[hid].n, "empty a moment");
  for (let i = 0; i < 25; i++) W.step();
  assert.ok(!W.S.homes[hid] && !W.S.maps[hid], "an empty house closes");
  // in again: built afresh from the sheet
  A.door();
  assert.ok(A.p.map.startsWith("house_") && W.S.homes[A.p.map]);
  assert.equal(W.S.homes[A.p.map].map.w, D.house.tiers[3].w);
  // saved inside: wakes at the door in town
  const ch = L.exportChar(W.S, A.pid);
  assert.equal(ch.map, "town");
  assert.deepEqual([Math.floor(ch.x / T), Math.floor(ch.y / T)], [D.house.door[0][0], D.house.door[0][1] + 1]);
  A.p.x = ex() * T + 8; A.p.y = ey() * T + 10;
  // the owner logs out: the house closes
  const hid2 = A.p.map;
  B.door();
  assert.equal(B.p.map, hid2);
  L.removePlayer(W.S, A.pid);
  for (let i = 0; i < 25; i++) W.step();
  assert.equal(B.p.map, "town");
  assert.ok(!W.S.homes[hid2], "closed when its owner is gone");
}

// ── old sheets: every version gains a 40-slot bag and an empty house; messy houses are cleaned
{
  const S = L.setup();
  // v1-like: hardly anything but a name, a class and a bag of 30
  const ancient = { name: "고대인", cls: "ranger", lvl: 12, xp: 0, gold: 10, inv: Array.from({ length: 30 }, () => ({ id: "hp_s", n: 1 })) };
  L.addPlayer(S, "a", ancient);
  assert.equal(S.players.a.ch.bagCap, 40);
  assert.deepEqual(S.players.a.ch.house, { tier: 0, style: { floor: 0, wall: 0 }, furn: [], storage: [], rest: 0, cozy: 0 });
  assert.equal(S.players.a.ch.v, 10);
  for (let v = 2; v <= 9; v++) {
    const old = L.newChar("옛" + v, "mage", []);
    delete old.bagCap; delete old.house; old.v = v;
    if (v < 9) delete old.dim;
    if (v < 8) delete old.sq;
    if (v < 7) delete old.cos;
    L.addPlayer(S, "v" + v, old);
    const ch = S.players["v" + v].ch;
    assert.equal(ch.bagCap, 40, `v${v}: a 40-slot bag`);
    assert.equal(ch.house.tier, 0, `v${v}: no house yet`);
    assert.equal(ch.v, 10);
  }
  // a bag fuller than 40 (an accessory moved in) keeps every item: the size rounds up to a step
  const full = L.newChar("가득", "rogue", []);
  delete full.bagCap; full.v = 9; full.inv = Array.from({ length: 43 }, () => ({ id: "hp_s", n: 1 }));
  L.addPlayer(S, "f", full);
  assert.equal(S.players.f.ch.bagCap, 45);
  assert.equal(S.players.f.ch.inv.length, 43);
  // nonsense in a v10 sheet
  const messy = L.newChar("엉망", "warrior", []);
  messy.bagCap = 999;
  messy.house = { tier: 7, style: { floor: 99, wall: -3 }, storage: [{ id: "nope", n: 3 }, { id: "hp_s", n: 4 }], rest: "x", cozy: -5,
    furn: [{ id: "fn_bed", uid: 4, x: 2, y: 1, dir: 9 }, { id: "fn_bed", uid: 4, x: 2, y: 1 }, { id: "fn_gone", uid: 5, x: 3, y: 3 },
      { id: "fn_chair", uid: 6, x: 0, y: 0 }, { id: "fn_hearth", uid: 7, x: 5, y: 5 }, { id: "fn_rug_round", uid: 8, x: 2, y: 1 }] };
  L.addPlayer(S, "m", messy);
  const h = S.players.m.ch.house;
  assert.equal(S.players.m.ch.bagCap, 100);
  assert.equal(h.tier, 3);
  assert.deepEqual(h.style, { floor: D.house.floors.length - 1, wall: 0 });
  assert.deepEqual(h.furn.map((f) => [f.id, f.x, f.y]), [["fn_bed", 2, 1], ["fn_rug_round", 2, 1]], "known pieces in the room, one per tile and layer");
  assert.equal(h.furn[0].dir, 3);
  assert.equal(new Set(h.furn.map((f) => f.uid)).size, 2, "uids unique");
  assert.deepEqual(h.storage.map((s) => [s.id, s.n]), [["hp_s", 4], ["fn_bed", 1], ["fn_chair", 1], ["fn_hearth", 1]], "pieces that cannot stand go into the storage; nothing is lost");
  assert.equal(h.rest, 0); assert.equal(h.cozy, 0);
  // migrating twice changes nothing
  const again = JSON.parse(JSON.stringify(S.players.m.ch));
  const S2 = L.setup();
  L.addPlayer(S2, "m", again);
  assert.deepEqual(S2.players.m.ch.house, h);
  assert.equal(L.newChar("새집", "warrior", []).v, 10);
}

console.log("housing ok");

function ex() { return D.house.tiers[A.ch.house.tier].w >> 1; }
function ey() { return D.house.tiers[A.ch.house.tier].h - 2; }
