// Headless test of the wardrobe (외형) — the cosmetic catalogue and its art, buying at the costume
// shop, wearing and taking off, what is saved and migrated, what other players are sent, and
// where cosmetics come from — plus the weapon art's coverage of every kind, tier and motif:
// node tests/wardrobe.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";
import { ART, SLOTS as ART_SLOTS, skinMotif } from "../public/wardrobe.js";
import { DESIGNS, MOTIFS } from "../public/weapons.js";

const D = L.defs();
const T = 16;
const BASE = Date.UTC(2026, 10, 14, 3, 0, 0);

function world(name = "옷장", cls = "warrior") {
  const S = L.setup();
  let now = BASE;
  S.now = now;
  const W = {
    S,
    join(pid, nm, c = cls, sheet = null) { L.addPlayer(S, pid, sheet || L.newChar(nm, c, [])); return S.players[pid]; },
    step(pid = "A", ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, pid))); L.endTick(S); return v; },
    act(a, pid = "A") { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; },
    to(pid, tx, ty) { const p = S.players[pid]; S.maps[p.map].n--; p.map = "town"; S.maps.town.n++; p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; p.sendMap = true; },
  };
  W.join("A", name);
  return W;
}
const town = L.atlas().maps.town;
const shopNpc = town.npcs.find((n) => n.role === "costume");

// ── the catalogue
const ids = Object.keys(D.cos);
assert.ok(ids.length >= 40, "at least forty cosmetics");
assert.deepEqual(D.cosSlots, ["hat", "top", "back", "face", "wskin"]);
assert.deepEqual(ART_SLOTS, D.cosSlots, "the browser sends and reads the same slot order");
for (const s of D.cosSlots) assert.ok(ids.filter((id) => D.cos[id].slot === s).length >= 5, "five or more for " + s);
const codes = ids.map((id) => D.cos[id].n);
assert.equal(new Set(codes).size, ids.length, "wire codes are unique");
assert.ok(codes.every((n) => Number.isInteger(n) && n > 0), "codes are positive (0 means nothing worn)");
for (const id of ids) {
  const c = D.cos[id];
  assert.equal(D.cosN[c.n], id, "a code maps back to its id");
  assert.ok(c.name && c.desc && c.q >= 0 && c.q <= 4, id + " has a name, a description and a rarity");
  assert.ok(["shop", "chest", "boss", "daily", "rift", "ach"].includes(c.src), id + " comes from somewhere");
  if (c.src === "shop") assert.ok(c.price > 0, id + " has a price");
  if (c.src === "ach") assert.ok(D.achievements.some((a) => a.id === c.ach), id + " is earned by a real achievement");
  // and the browser can draw it
  assert.ok(ART[id], id + " has art in wardrobe.js");
  assert.equal(ART[id][0], c.slot, id + " is drawn for the slot it is worn in");
  if (c.slot === "wskin") assert.ok(MOTIFS.includes(skinMotif(id)), id + " is a weapon motif");
}
for (const id of Object.keys(ART)) assert.ok(D.cos[id], id + " (art) is in the catalogue");
for (const src of ["shop", "chest", "boss", "daily", "rift", "ach"]) assert.ok(ids.some((id) => D.cos[id].src === src), "something comes from " + src);
assert.ok(shopNpc, "the costume shop stands in town");
assert.ok(town.npcs.every((n) => n === shopNpc || Math.hypot(n.x - shopNpc.x, n.y - shopNpc.y) >= 3), "with room around it");
assert.equal(town.o[shopNpc.y][shopNpc.x], " ", "on open ground");
assert.ok(!"pb".includes(town.g[shopNpc.y][shopNpc.x]), "not on a road");

// ── weapon art: every kind and tier, every legendary power and set as a motif
for (const wk of Object.keys(D.wkinds)) assert.equal((DESIGNS[wk] || []).length, 5, wk + " has five tier designs");
for (const k of Object.keys(D.legend)) assert.ok(MOTIFS.includes(k), "legendary " + k + " has a look");
for (const k of Object.keys(D.sets)) assert.ok(MOTIFS.includes(k), "set " + k + " has a look");

// ── a new character: an empty wardrobe, the current sheet version
{
  const W = world();
  const p = W.S.players.A;
  assert.deepEqual(p.ch.cos, { own: [], on: {} });
  assert.ok(p.ch.v >= 7);
  const s = W.step().self;
  assert.deepEqual(s.cos, { own: [], on: {} }, "the wardrobe is in the player's own payload");
}

// ── buying, wearing, taking off
{
  const W = world("멋쟁이");
  const p = W.S.players.A, ch = p.ch;
  const buy = ids.find((id) => D.cos[id].src === "shop" && D.cos[id].slot === "hat");
  const price = D.cos[buy].price;
  ch.gold = price + 5;
  assert.equal(W.act({ t: "cos_buy", id: buy }).error, "의상실 주인이 너무 멉니다", "only at the costume shop");
  W.to("A", shopNpc.x, shopNpc.y + 1);
  assert.equal(W.act({ t: "cos_buy", id: "nope" }).error, "팔지 않는 외형입니다");
  assert.equal(W.act({ t: "cos_buy", id: "hat_halo" }).error, "팔지 않는 외형입니다", "rift rewards are not for sale");
  assert.equal(W.act({ t: "cos_buy", id: "__proto__" }).error, "팔지 않는 외형입니다");
  const dear = ids.find((id) => D.cos[id].src === "shop" && D.cos[id].price > price + 5);
  assert.equal(W.act({ t: "cos_buy", id: dear }).error, "골드가 부족합니다");
  assert.ok(W.act({ t: "cos_buy", id: buy }).ok);
  assert.equal(ch.gold, 5, "paid for");
  assert.ok(ch.cos.own.includes(buy));
  assert.equal(ch.cos.on.hat, buy, "and worn at once");
  assert.equal(ch.inv.length, 2, "the bag is untouched");
  ch.gold = 1e6;
  assert.equal(W.act({ t: "cos_buy", id: buy }).error, "이미 가지고 있습니다");
  // wearing
  assert.equal(W.act({ t: "cos_eq", id: "top_suit" }).error, "아직 얻지 않은 외형입니다");
  assert.equal(W.act({ t: "cos_eq", id: 7 }).error, "없는 외형입니다");
  assert.equal(W.act({ t: "cos_eq", id: buy }).error, "이미 입고 있습니다");
  const top = ids.find((id) => D.cos[id].src === "shop" && D.cos[id].slot === "top");
  const top2 = ids.filter((id) => D.cos[id].src === "shop" && D.cos[id].slot === "top")[1];
  assert.ok(W.act({ t: "cos_buy", id: top }).ok && W.act({ t: "cos_buy", id: top2 }).ok);
  assert.equal(ch.cos.on.top, top2, "the newer purchase is worn");
  assert.ok(W.act({ t: "cos_eq", id: top }).ok);
  assert.equal(ch.cos.on.top, top, "one per slot: the other comes off");
  assert.equal(ch.cos.on.hat, buy, "other slots untouched");
  assert.ok(W.act({ t: "cos_eq", id: top }, "A").ok === false);
  const st0 = JSON.stringify(W.step().self.atk);
  // taking off
  assert.equal(W.act({ t: "cos_off", s: "wings" }).error, "잘못된 부위");
  assert.equal(W.act({ t: "cos_off", s: "face" }).error, "입은 외형이 없습니다");
  assert.ok(W.act({ t: "cos_off", s: "hat" }).ok);
  assert.equal(ch.cos.on.hat, undefined);
  assert.ok(ch.cos.own.includes(buy), "taken off, still owned");
  assert.equal(JSON.stringify(W.step().self.atk), st0, "looks only: no stat changes");
  // dead players may still change clothes
  p.dead = true;
  assert.ok(W.act({ t: "cos_eq", id: buy }).ok);
  p.dead = false;
}

// ── saved and loaded, and old sheets migrated
{
  const W = world("저장");
  const ch = W.S.players.A.ch;
  ch.cos.own.push("hat_wizard", "back_cape_red", "ws_sakura");
  ch.cos.on = { hat: "hat_wizard", back: "back_cape_red", wskin: "ws_sakura" };
  const saved = JSON.parse(JSON.stringify(L.exportChar(W.S, "A")));
  L.removePlayer(W.S, "A");
  const p2 = W.join("A", "", "warrior", saved);
  assert.deepEqual(p2.ch.cos.on, { hat: "hat_wizard", back: "back_cape_red", wskin: "ws_sakura" }, "worn things are still worn after a reload");
  assert.equal(p2.ch.cos.own.length, 3);
  // an old sheet (v6, no wardrobe) that already earned a cosmetic's achievement
  const old = JSON.parse(JSON.stringify(saved));
  delete old.cos; old.v = 6; old.ach = ["cook10", "hunt100"]; old.st = { cook: 10 };
  const p3 = W.join("B", "", "warrior", old);
  assert.ok(p3.ch.v >= 7, "sheet version bumped");
  assert.deepEqual(p3.ch.cos.own, ["hat_chef"], "an achievement earned before the wardrobe pays out its cosmetic");
  assert.deepEqual(p3.ch.cos.on, {});
  // junk in a saved wardrobe is dropped; nothing worn that is not owned or not of its slot
  const bad = JSON.parse(JSON.stringify(saved));
  bad.cos = { own: ["hat_wizard", "nope", 3, "hat_wizard", "top_suit"], on: { hat: "top_suit", top: "top_suit", back: "back_angel", face: 9, x: "hat_wizard" } };
  const p4 = W.join("C", "", "warrior", bad);
  assert.deepEqual(p4.ch.cos.own, ["hat_wizard", "top_suit"]);
  assert.deepEqual(p4.ch.cos.on, { top: "top_suit" });
  const p5 = W.join("D", "", "warrior", { ...JSON.parse(JSON.stringify(saved)), cos: "garbage" });
  assert.deepEqual(p5.ch.cos, { own: [], on: {} });
}

// ── the wire: everyone on the map sees the outfit
{
  const W = world("보이기");
  const a = W.S.players.A;
  W.join("B", "구경꾼");
  const b = W.S.players.B;
  W.to("B", 20, 18); W.to("A", 21, 18);
  a.ch.cos.own.push("hat_crown", "back_angel", "ws_star");
  W.act({ t: "cos_eq", id: "hat_crown" });
  W.act({ t: "cos_eq", id: "back_angel" });
  let v = W.step("B");
  let row = v.who.find((r) => r[0] === a.eid);
  assert.ok(row, "B sees A");
  assert.equal(row[13], "", "the title keeps its place");
  assert.deepEqual(row[14], [D.cos.hat_crown.n, 0, D.cos.back_angel.n], "hat, top, back codes; trailing empty slots dropped");
  assert.equal(row[15], "", "no legendary weapon");
  const mine = v.who.find((r) => r[0] === b.eid);
  assert.deepEqual(mine[14], [], "nothing worn: an empty list");
  W.act({ t: "cos_eq", id: "ws_star" });
  v = W.step("B");
  row = v.who.find((r) => r[0] === a.eid);
  assert.equal(row[14].length, 5, "the weapon skin is the fifth slot");
  assert.equal(D.cosN[row[14][4]], "ws_star");
  W.act({ t: "cos_off", s: "hat" });
  v = W.step("B");
  assert.ok(v.who, "taking something off re-sends the who list");
  assert.equal(v.who.find((r) => r[0] === a.eid)[14][0], 0);
  // a legendary weapon's power is sent for its look
  a.ch.eq.weapon = { id: "w_warrior_4", q: 3, enh: 7, af: [], sk: 0, ru: [], lg: "chain" };
  W.S.maps[a.map].who = true;
  v = W.step("B");
  row = v.who.find((r) => r[0] === a.eid);
  assert.equal(row[15], "chain");
  assert.equal(row[9], 7, "and its enhancement, for the glow");
}

// ── where cosmetics come from
{
  // the daily reward box always holds something from the daily pool, while any is left
  const W2 = world("성실");
  const q = W2.S.players.A;
  W2.step();
  const dl = q.ch.daily;
  for (const t of dl.tasks) t.n = t.need;
  // an achievement with a cosmetic gives it the moment it is earned (claiming checks achievements)
  q.ch.st.cook = 10;
  for (let i = 0; i < 3; i++) assert.ok(W2.act({ t: "daily", i }).ok);
  assert.ok(q.ch.ach.includes("cook10") && q.ch.cos.own.includes("hat_chef"), "the chef's hat comes with the cooking achievement");
  assert.ok(W2.act({ t: "daily", i: "bonus" }).ok);
  const got = q.ch.cos.own.filter((id) => D.cos[id].src === "daily");
  assert.equal(got.length, 1, "one cosmetic from the daily box");
  const v = W2.step();
  assert.ok((v.toast || []).some((m) => m.includes("외형 획득")), "with a notice");
}

console.log("wardrobe: ok —", ids.length, "cosmetics,", Object.keys(D.wkinds).length * 5, "weapon designs,", MOTIFS.length, "motifs");
