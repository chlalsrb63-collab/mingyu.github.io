// Headless test of the 장날 merchants (64-fair-market.js): six vendors on 버드나무 마을 that serve only while the market is open
// (Tue/Sat 19–21 KST), stock that is the same for everyone and changes with the KST day, legendary gear spread over slots and item
// levels with a price that only rises with the level, a product bought once per player (gold, bag, cosmetic checks, the
// `fm` wire sent once), 인챈트 스크롤 `es_*` picked up when the items exist, and `ch.fairBuy` through save and an old sheet. node tests/fairmkt.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { FAIR, FAIR_VENDORS, FAIR_PRICE, FAIR_GEAR, fairStock, fairGearPrice, fairBuyClean, fairOpen, kstDay, mapOf, blockedAt, ITEMS, COSMETICS, LEGEND, PFX, bagCap, G_REQ, RUNES, RUNE_SETS, COS_IDS };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16, H = 3600000;
const kst = (s) => Date.parse(s + ":00+09:00");
const TUE = kst("2026-11-17T20:00"), SAT = kst("2026-11-21T19:30"), WED = kst("2026-11-18T20:00"), TUE_EARLY = kst("2026-11-17T18:00"), TUE_LATE = kst("2026-11-17T21:00");
const DAY = X.kstDay(TUE);

function world(t0) { const S = L.setup(); S.now = t0; return { S, now: t0 }; }
function hero(w, pid, name, atNpc) {
  const ch = L.newChar(name, []);
  ch.map = "willow"; ch.gold = 10_000_000;
  L.addPlayer(w.S, pid, ch);
  place(w, pid, atNpc);
  return w.S.players[pid];
}
function place(w, pid, npc) {
  const p = w.S.players[pid], n = X.mapOf("willow").npcs.find((o) => o.id === npc);
  p.x = n.x * T + 8; p.y = n.y * T + 12 + 14;
}
const act = (w, pid, a) => { w.S.now = w.now; const v = L.validateAction(w.S, pid, a); if (v.ok) L.applyAction(w.S, pid, a); return v; };
const fm = (w, pid) => L.viewFor(w.S, pid).fm;
const toasts = (p) => p.toast.splice(0).join(" | ");
const slotOf = (id) => X.ITEMS[id].type;

// ── the six merchants stand in the village as NPCs flagged `fair` (the client shows them only while dn[3] says open)
{
  const m = X.mapOf("willow"), vs = m.npcs.filter((n) => n.role === "fairmkt");
  assert.deepEqual(vs.map((n) => n.id).sort(), X.FAIR_VENDORS.map((v) => `fm_${v}`).sort(), "one NPC per vendor");
  assert.ok(vs.every((n) => n.fair === 1), "flagged fair");
  assert.equal(new Set(vs.map((n) => n.name)).size, 6, "six names");
  assert.equal(new Set(vs.map((n) => JSON.stringify(n.look))).size, 6, "six looks");
  assert.ok(vs.every((n) => n.lines && n.lines.length >= 3 && n.role === "fairmkt"), "each has lines to say");
  assert.ok(vs.every((n) => !X.blockedAt(m, n.x, n.y)), "all stand on open ground");
  assert.equal(new Set(vs.map((n) => `${n.x},${n.y}`)).size, 6, "no two on one tile");
  assert.ok(vs.every((n) => n.x >= 44 && n.x <= 54 && n.y >= 24 && n.y <= 29), "in the middle of the market, by the stalls");
  const w = world(TUE), a = hero(w, "a", "구경꾼", "willow_board");
  assert.equal(L.viewFor(w.S, "a").map.npcs.filter((n) => n.fair).length, 6, "in the map payload (the client filters by the open flag)");
}

// ── presence: the merchants serve only while the market is open, and only within reach of that merchant
{
  const w = world(TUE_EARLY), p = hero(w, "a", "일찍온손님", "fm_leg");
  assert.match(act(w, "a", { t: "fair_open", v: "leg" }).error, /장날이 아닙니다/, "before 19");
  w.now = TUE; assert.ok(act(w, "a", { t: "fair_open", v: "leg" }).ok, "open at 19");
  assert.match(act(w, "a", { t: "fair_open", v: "dye" }).error, /너무 멉니다/, "a merchant across the market is not in reach");
  assert.match(act(w, "a", { t: "fair_open", v: "nobody" }).error, /너무 멉니다/);
  assert.match(act(w, "a", { t: "fair_open", v: { x: 1 } }).error, /너무 멉니다/);
  place(w, "a", "willow_board");
  assert.match(act(w, "a", { t: "fair_open", v: "leg" }).error, /너무 멉니다/, "walked off");
  place(w, "a", "fm_leg"); p.map = "town";
  assert.match(act(w, "a", { t: "fair_open", v: "leg" }).error, /너무 멉니다/, "another map");
  p.map = "willow";
  w.now = TUE_LATE;
  assert.match(act(w, "a", { t: "fair_open", v: "leg" }).error, /장날이 아닙니다/, "closed at 21");
  w.now = WED; assert.match(act(w, "a", { t: "fair_open", v: "leg" }).error, /장날이 아닙니다/, "Wednesday");
  assert.match(act(w, "a", { t: "fair_shop", v: "leg", i: 0, d: DAY }).error, /장날이 아닙니다/, "no buying while closed");
}

// ── the stock: deterministic per KST day, the same for everyone, different on another day
{
  const key = (day, v) => JSON.stringify(X.fairStock(day, v));
  for (const v of X.FAIR_VENDORS) assert.equal(key(DAY, v), key(DAY, v), `${v}: same day, same stock`);
  assert.notEqual(key(DAY, "leg"), key(DAY + 4, "leg"), "another fair day, other gear");
  assert.notEqual(key(DAY, "leg"), key(DAY, "rune"), "vendors roll apart");
  const w = world(TUE), a = hero(w, "a", "갑", "fm_leg"), b = hero(w, "b", "을", "fm_leg");
  act(w, "a", { t: "fair_open", v: "leg" }); act(w, "b", { t: "fair_open", v: "leg" });
  const fa = fm(w, "a"), fb = fm(w, "b");
  assert.deepEqual(fa, fb, "two players, one list");
  assert.deepEqual([fa[0], fa[1], fa[2]], ["leg", DAY, TUE_LATE], "vendor, KST day, closing time");
  assert.deepEqual(fa[4], [], "nothing bought yet");
  assert.equal(fm(w, "a"), undefined, "the list is sent once, not every snapshot");

  // legendary gear: 4–6 pieces, different slots, item levels over 30–190, a power from the live pool, price rising with level
  let lo = 999, hi = 0, counts = new Set();
  for (let d = 0; d < 60; d++) {
    const rows = X.fairStock(DAY + d * 3, "leg");
    counts.add(rows.length);
    assert.ok(rows.length >= 4 && rows.length <= 6, "4–6 pieces");
    assert.equal(new Set(rows.map((r) => slotOf(r.g.id))).size, rows.length, "every piece a different slot");
    let prev = 0;
    for (const r of rows) {
      const g = r.g, it = X.ITEMS[g.id];
      assert.equal(g.q, 3, "전설");
      assert.ok(g.lg && X.LEGEND[g.lg] && X.PFX[g.lg].on && !X.PFX[g.lg].off, "a live power");
      assert.equal(g.af.length, 4, "a 전설's four lines");
      assert.ok(g.il >= 29 && g.il <= 200, `item level ${g.il}`);
      assert.ok(g.il >= prev, "ascending item levels");
      prev = g.il; lo = Math.min(lo, g.il); hi = Math.max(hi, g.il);
      assert.equal(r.price, X.fairGearPrice(g.il), "priced by item level");
      assert.ok(r.price >= 3 * it.price, `well above the shop price (${r.price} vs ${it.price})`);
      assert.ok(g.il >= X.G_REQ[it.tier - 1], "the tier fits the level");
    }
  }
  assert.deepEqual([...counts].sort(), [4, 5, 6], "all of 4, 5 and 6 turn up");
  assert.ok(lo <= 45 && hi >= 175, `the levels spread over the range (${lo}–${hi})`);
  // the price table is monotone in item level (and not flat)
  let last = 0;
  for (let il = 1; il <= 200; il++) { const pr = X.fairGearPrice(il); assert.ok(pr >= last, `price rises at il ${il}`); last = pr; }
  assert.equal(X.fairGearPrice(30), X.FAIR_PRICE.gear.base, "il 30 costs the base");
  assert.ok(X.fairGearPrice(190) > 10 * X.fairGearPrice(30) && X.fairGearPrice(190) <= 250000, "il 190 is about twelve times the base");
  // the other counters
  const rune = X.fairStock(DAY, "rune"), [first, second, third, rare, legendary] = rune.map((r) => X.RUNES[r.it]);
  assert.equal(rune.length, 5);
  assert.equal(new Set(rune.map((r) => r.it)).size, 5);
  assert.equal(X.RUNE_SETS[first.set].need, 3);
  assert.deepEqual([second.set, third.set], [first.set, first.set], "a whole three-piece set is on the counter");
  assert.deepEqual([rare.q, legendary.q], [2, 3]);
  assert.ok(rune.every((r) => r.n === 1 && r.price === X.FAIR_PRICE.rune));
  const food = X.fairStock(DAY, "food");
  assert.equal(food.length, 5);
  assert.ok(food.every((r) => r.n === 5 && r.price === X.FAIR_PRICE.food.mul * 5 * X.ITEMS[r.it].price && X.ITEMS[r.it].type === "food"));
  const dye = X.fairStock(DAY, "dye");
  assert.equal(dye.length, 4);
  assert.ok(dye.every((r) => r.n === 3 && r.it.startsWith("dye_")));
  const cos = X.fairStock(DAY, "cos");
  assert.equal(cos.length, 4);
  assert.ok(cos.every((r) => X.COSMETICS[r.cos].src === "fair" && !r.cos.endsWith("_maple") && r.price === X.FAIR_PRICE.cos[X.COSMETICS[r.cos].q]), "off-season 장날 pieces (it is 가을)");
  assert.deepEqual(X.fairStock(DAY, "scr"), [], "no es_* items yet: an empty counter, no error");
  for (const v of X.FAIR_VENDORS) for (const r of X.fairStock(DAY, v)) assert.ok(r.price > 0 && Number.isInteger(r.price), `${v}: a whole price`);
}

// ── 인챈트 스크롤: every es_* item that exists is picked up by itself
{
  X.ITEMS.es_demo1 = { name: "시험의 인챈트 스크롤", type: "mat", price: 0, desc: "" };
  X.ITEMS.es_demo2 = { name: "두 번째 인챈트 스크롤", type: "mat", price: 0, desc: "" };
  try {
    const rows = X.fairStock(DAY, "scr");
    assert.deepEqual(rows.map((r) => r.it).sort(), ["es_demo1", "es_demo2"]);
    assert.ok(rows.every((r) => r.n === 1 && r.price === X.FAIR_PRICE.scroll));
    const w = world(TUE), p = hero(w, "a", "두루마리손님", "fm_scr");
    act(w, "a", { t: "fair_open", v: "scr" });
    const f = fm(w, "a"), i = f[3].findIndex((r) => r[3] === "es_demo2");
    assert.ok(act(w, "a", { t: "fair_shop", v: "scr", i, d: DAY }).ok);
    assert.equal(p.ch.inv.filter((s) => s.id === "es_demo2").reduce((n, s) => n + s.n, 0) + (p.ch.pouch?.es_demo2 || 0), 1, "the scroll is in the bag");
    assert.equal(p.ch.gold, 10_000_000 - X.FAIR_PRICE.scroll);
  } finally { delete X.ITEMS.es_demo1; delete X.ITEMS.es_demo2; }
}

// ── buying: gold, the bag, once per player per product, per day
{
  const w = world(TUE), S = w.S, a = hero(w, "a", "큰손", "fm_leg"), b = hero(w, "b", "작은손", "fm_leg");
  act(w, "a", { t: "fair_open", v: "leg" });
  const f = fm(w, "a"), row = f[3][1], [pid, price, kind, g] = row;
  assert.equal(kind, 0);
  const gold0 = a.ch.gold, inv0 = a.ch.inv.length;
  // bad requests
  assert.match(act(w, "a", { t: "fair_shop", v: "leg", i: 99, d: DAY }).error, /그런 상품/);
  assert.match(act(w, "a", { t: "fair_shop", v: "leg", i: -1, d: DAY }).error, /그런 상품/);
  assert.match(act(w, "a", { t: "fair_shop", v: "leg", i: "1", d: DAY }).error, /그런 상품/);
  assert.match(act(w, "a", { t: "fair_shop", v: "leg", i: 1, d: DAY - 1 }).error, /다시 열어/, "a list from another day");
  assert.match(act(w, "a", { t: "fair_shop", v: "leg", i: 1 }).error, /다시 열어/);
  assert.equal(a.ch.gold, gold0, "nothing charged for a refusal");
  // too poor
  b.ch.gold = price - 1;
  assert.match(act(w, "b", { t: "fair_shop", v: "leg", i: 1, d: DAY }).error, /골드가 부족/);
  b.ch.gold = price;
  // buy
  toasts(a);
  assert.ok(act(w, "a", { t: "fair_shop", v: "leg", i: 1, d: DAY }).ok);
  assert.equal(a.ch.gold, gold0 - price, "the price is charged");
  assert.equal(a.ch.inv.length, inv0 + 1, "one piece in the bag");
  assert.deepEqual(a.ch.inv.at(-1), g, "exactly the piece that was listed");
  assert.notEqual(a.ch.inv.at(-1), g, "(a copy)");
  assert.match(toasts(a), /샀습니다/);
  assert.ok(S.chat.some((c) => c.sys && /장날 상인/.test(c.m)), "a legendary buy is announced");
  const after = fm(w, "a");
  assert.deepEqual(after[4], [pid], "the list comes again with the product marked");
  assert.deepEqual(a.ch.fairBuy, { [DAY]: [pid] }, "the sheet remembers it");
  // once per player
  assert.match(act(w, "a", { t: "fair_shop", v: "leg", i: 1, d: DAY }).error, /이미 구매/);
  assert.equal(a.ch.gold, gold0 - price, "no second charge");
  // another piece is still buyable
  assert.ok(act(w, "a", { t: "fair_shop", v: "leg", i: 0, d: DAY }).ok, "other products are separate");
  assert.deepEqual(a.ch.fairBuy[DAY].length, 2);
  // another player buys the same product: the stock is not used up
  assert.ok(act(w, "b", { t: "fair_shop", v: "leg", i: 1, d: DAY }).ok, "a limited product, but one per player — not one in total");
  assert.equal(b.ch.gold, 0);
  assert.deepEqual(b.ch.inv.at(-1), g, "the same piece");
  // the same product on the next fair day is a new product
  w.now = SAT; S.now = SAT;
  place(w, "a", "fm_rune");
  const day2 = X.kstDay(SAT);
  act(w, "a", { t: "fair_open", v: "rune" });
  const fr = fm(w, "a");
  assert.equal(fr[1], day2);
  assert.deepEqual(fr[4], [], "a new day: nothing bought");
  assert.ok(act(w, "a", { t: "fair_shop", v: "rune", i: 0, d: day2 }).ok);
  assert.deepEqual(Object.keys(a.ch.fairBuy), [String(day2)], "only the newest day is kept");
  assert.equal(a.ch.fairBuy[day2].length, 1);
  assert.ok(a.ch.inv.some((s) => s.id === fr[3][0][3]) || (a.ch.pouch && a.ch.pouch[fr[3][0][3]]), "the rune is in the bag");
  assert.match(act(w, "a", { t: "fair_shop", v: "rune", i: 0, d: day2 }).error, /이미 구매/);
}

// ── a full bag refuses a piece (and charges nothing); a pack needs room too
{
  const w = world(TUE), p = hero(w, "a", "꽉찬가방", "fm_leg");
  act(w, "a", { t: "fair_open", v: "leg" });
  const f = fm(w, "a"), n = X.bagCap(p.ch);
  while (p.ch.inv.length < n) p.ch.inv.push({ id: "hp_s", n: 1 });
  const gold0 = p.ch.gold;
  assert.match(act(w, "a", { t: "fair_shop", v: "leg", i: 0, d: DAY }).error, /가방이 가득/);
  assert.equal(p.ch.gold, gold0, "gold untouched");
  assert.deepEqual(p.ch.fairBuy, {}, "and not marked as bought");
  p.ch.inv.pop();
  assert.ok(act(w, "a", { t: "fair_shop", v: "leg", i: 0, d: DAY }).ok, "one free slot is enough");
  assert.equal(f[3].length >= 4, true);
  // a pack of dishes into a bag that is full of other things
  place(w, "a", "fm_food");
  act(w, "a", { t: "fair_open", v: "food" });
  const ff = fm(w, "a");
  while (p.ch.inv.length < n) p.ch.inv.push({ id: "mp_s", n: 99 });
  p.ch.pouch = p.ch.pouch || {};
  assert.match(act(w, "a", { t: "fair_shop", v: "food", i: 0, d: DAY }).error, /가방이 가득/, "no room for the dishes");
  p.ch.inv.pop();
  const id = ff[3][0][3];
  assert.ok(act(w, "a", { t: "fair_shop", v: "food", i: 0, d: DAY }).ok);
  assert.equal(p.ch.inv.filter((s) => s.id === id).reduce((k, s) => k + s.n, 0), 5, "five dishes in a pack");
}

// ── cosmetics: given to the wardrobe, refused when already owned (without using up the product)
{
  const w = world(TUE), p = hero(w, "a", "옷쟁이", "fm_cos");
  act(w, "a", { t: "fair_open", v: "cos" });
  const f = fm(w, "a"), [pid, price, kind, id] = f[3][0];
  assert.equal(kind, 2);
  p.ch.cos.own.push(id);
  assert.match(act(w, "a", { t: "fair_shop", v: "cos", i: 0, d: DAY }).error, /이미 가지고 있는/);
  assert.deepEqual(p.ch.fairBuy, {});
  p.ch.cos.own.splice(p.ch.cos.own.indexOf(id), 1);
  const gold0 = p.ch.gold;
  assert.ok(act(w, "a", { t: "fair_shop", v: "cos", i: 0, d: DAY }).ok);
  assert.ok(p.ch.cos.own.includes(id), "in the wardrobe");
  assert.equal(p.ch.gold, gold0 - price);
  assert.match(act(w, "a", { t: "fair_shop", v: "cos", i: 0, d: DAY }).error, /이미 구매|이미 가지고/);
}

// ── the sheet: saved, pruned, cleaned; an old sheet starts empty and a junk one is clamped
{
  const w = world(TUE), p = hero(w, "a", "저장손님", "fm_dye");
  act(w, "a", { t: "fair_open", v: "dye" });
  assert.ok(act(w, "a", { t: "fair_shop", v: "dye", i: 0, d: DAY }).ok);
  const back = JSON.parse(JSON.stringify(L.exportChar(w.S, "a")));
  assert.deepEqual(back.fairBuy, p.ch.fairBuy, "saved with the sheet");
  assert.equal(back.v, L.newChar("현재양식", []).v);
  const S2 = L.setup(); S2.now = TUE;
  L.addPlayer(S2, "again", back);
  assert.deepEqual(S2.players.again.ch.fairBuy, p.ch.fairBuy, "and loaded again");
  // an old sheet (v26, no fairBuy)
  const old = L.newChar("옛손님", []);
  delete old.fairBuy; old.v = 26;
  L.addPlayer(S2, "o", old);
  assert.deepEqual(S2.players.o.ch.fairBuy, {}, "an old sheet bought nothing");
  assert.equal(S2.players.o.ch.v, L.newChar("현재양식", []).v);
  assert.equal(L.newChar("새손님", []).v, L.newChar("현재양식", []).v);
  // junk
  assert.deepEqual(X.fairBuyClean(null), {});
  assert.deepEqual(X.fairBuyClean([1]), {});
  assert.deepEqual(X.fairBuyClean({ "5": ["a"], "9": ["b", "b", 3, "x".repeat(40), null, "c"], "-1": ["z"], "x": ["y"], "1.5": ["q"] }), { 9: ["b", "c"] }, "newest day only, ids unique short strings");
  assert.deepEqual(X.fairBuyClean({ "9": "nope" }), { 9: [] });
  assert.deepEqual(X.fairBuyClean(JSON.parse('{"__proto__": ["z"], "7": ["a"]}')), { 7: ["a"] });
  assert.equal(Object.keys(X.fairBuyClean({ 1: Array.from({ length: 200 }, (_, i) => `p${i}`) })[1]).length, 32, "at most 32 ids");
  const junk = L.newChar("엉터리", []);
  junk.fairBuy = "garbage";
  L.addPlayer(S2, "j", junk);
  assert.deepEqual(S2.players.j.ch.fairBuy, {});
}
console.log("fairmkt: ok");
