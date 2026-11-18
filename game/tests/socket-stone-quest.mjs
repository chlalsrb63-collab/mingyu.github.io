import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const QUEST = "sq_volkan_socket_stone";
const STONE = "punch";
const SELLER = "a@s1", BUYER = "b@s1";
const D = L.defs();
const quest = D.side.find((q) => q.id === QUEST);
assert.ok(quest, "Volkan's socket stone quest is registered");
assert.equal(quest.giver, "smith");
assert.equal(quest.req.lv, 40);
assert.equal(quest.repeat, false);
assert.deepEqual(quest.reward.items, [[STONE, 1]]);

const S = L.setup();
S.now = 1_800_000_000_000;
L.addPlayer(S, SELLER, L.hero("숲의사냥꾼", { wk: "sword", lvl: 39 }));
L.addPlayer(S, BUYER, L.newChar("천공석구매자", []));
const seller = S.players[SELLER], buyer = S.players[BUYER];
const T = 16;
const maps = L.atlas(true, [quest.giverMapId, "forest"]).maps;
const smith = maps[quest.giverMapId].npcs.find((n) => n.id === "smith");
const at = (p, map, x, y) => {
  if (p.map !== map) {
    L.runtime(S, p.map).n--;
    L.runtime(S, map).n++;
    p.map = map;
  }
  p.x = x * T + 8;
  p.y = y * T + 10;
  p.mvAt = S.now;
};
const act = (p, a) => {
  const result = L.validateAction(S, p.pid, a);
  if (result.ok) L.applyAction(S, p.pid, a);
  return result;
};
const ok = (p, a) => {
  const result = act(p, a);
  assert.ok(result.ok, `${JSON.stringify(a)}: ${result.error}`);
};
const sq = (a) => ({ t: "sq", a, id: QUEST });
const count = (p) => p.ch.inv.filter((s) => s.id === STONE).reduce((n, s) => n + s.n, 0);
const meetSmith = (p) => at(p, quest.giverMapId, smith.x, smith.y + 1);

meetSmith(seller);
assert.match(act(seller, sq("take")).error, /레벨 40/);
seller.ch.lvl = 40;
ok(seller, sq("take"));
assert.match(act(seller, sq("done")).error, /아직/);

const spawn = maps.forest.spawns.find((s) => s.k === quest.goal.mob);
assert.ok(spawn, "the quarry's forest spawn exists");
const [left, top, right, bottom] = spawn.r;
at(seller, "forest", (left + right) >> 1, (top + bottom) >> 1);
for (let i = 0; i < 5; i++) {
  L.tick(S, S.now + 100);
  L.endTick(S);
}
const forest = L.runtime(S, "forest");
const quarry = forest.mobs.find((m) => m.k === quest.goal.mob);
assert.ok(quarry, "the quarry appears in the running game");
for (const mob of forest.mobs) if (mob !== quarry) mob.x += 4000;
for (let i = 0; i < quest.goal.n; i++) {
  Object.assign(quarry, { dead: false, el: 0, tr: [], hp: 1, x: seller.x + 12, y: seller.y, by: {} });
  seller.atkAt = 0;
  ok(seller, { t: "atk", a: 0 });
  assert.equal(quarry.dead, true);
  assert.equal(seller.ch.sq.on[QUEST], i + 1);
}

assert.match(act(seller, sq("done")).error, /가까이/);
meetSmith(seller);
const bag = seller.ch.inv;
seller.ch.inv = Array.from({ length: seller.ch.bagCap }, () => ({ id: "hp_s", n: 99 }));
assert.match(act(seller, sq("done")).error, /가방을 비우고/);
assert.equal(seller.ch.sq.on[QUEST], quest.goal.n, "a full bag leaves the reward claim intact");
seller.ch.inv = bag;
seller.save = false;
ok(seller, sq("done"));
assert.equal(count(seller), 1);
assert.equal(seller.save, true, "persist the rare reward and its claim promptly");
assert.equal(seller.ch.sq.done[QUEST], 1);
assert.equal(act(seller, sq("done")).ok, false, "replayed claims cannot grant another stone");
assert.match(act(seller, sq("take")).error, /이미 마친/);
assert.equal(count(seller), 1);

meetSmith(buyer);
const price = 48_000;
const sellerGold = seller.ch.gold;
buyer.ch.gold = 50_000;
ok(seller, { t: "sx", a: "ask", k: "trade", e: buyer.eid });
ok(buyer, { t: "sx", a: "yes" });
ok(seller, { t: "sx", a: "put", s: seller.ch.inv.findIndex((s) => s.id === STONE), n: 1 });
ok(buyer, { t: "sx", a: "gold", n: price });
ok(seller, { t: "sx", a: "lock", v: 1 });
ok(buyer, { t: "sx", a: "lock", v: 1 });
ok(seller, { t: "sx", a: "go" });
assert.equal(count(seller), 1, "one approval does not exchange offers");
ok(buyer, { t: "sx", a: "go" });
assert.equal(count(seller), 0);
assert.equal(count(buyer), 1);
assert.equal(seller.ch.gold, sellerGold + price);
assert.equal(buyer.ch.gold, 50_000 - price);
assert.equal(act(buyer, { t: "sx", a: "go" }).ok, false, "the finished trade cannot be replayed");
assert.equal(count(buyer), 1);

console.log("socket stone quest: level gate, hunt, full bag, single claim and player trade — ok");
