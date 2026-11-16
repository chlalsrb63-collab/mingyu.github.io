// Headless test of the wardrobe (외형) — the cosmetic catalogue and its art, buying at the costume
// shop, wearing and taking off, what is saved and migrated, what other players are sent, and
// where cosmetics come from — plus the weapon art's coverage of every kind, tier and motif:
// node tests/wardrobe.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as L from "../src/logic.js";
import { ART, SLOTS as ART_SLOTS, skinMotif, dyed, DYES } from "../public/wardrobe.js";
import { DESIGNS, MOTIFS, SIL, MOTIF_SIL } from "../public/weapons.js";

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
    to(pid, tx, ty) { const p = S.players[pid]; L.runtime(S, p.map).n--; p.map = "town"; L.runtime(S, "town").n++; p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; p.sendMap = true; },
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
  assert.ok(["shop", "token", "chest", "boss", "rareBoss", "daily", "rift", "ach", "quest", "weekly", "sew", "fair"].includes(c.src), id + " comes from somewhere");
  if (c.src === "sew") assert.ok(Object.values(D.keepSew).includes(id), id + " is sewn from a real keepsake");
  if (c.src === "fair") assert.ok(D.fair.shop.some((rows) => rows.some((r) => r[0] === id)), id + " is sold at the 장날 stall");
  assert.ok(c.set === "" || D.cosSets[c.set], id + " is in a real set, or in none");
  if (c.src === "shop" || c.src === "token") assert.ok(c.price > 0, id + " has a price");
  if (c.src === "ach") assert.ok(D.achievements.some((a) => a.id === c.ach), id + " is earned by a real achievement");
  // and the browser can draw it
  assert.ok(ART[id], id + " has art in wardrobe.js");
  assert.equal(ART[id][0], c.slot, id + " is drawn for the slot it is worn in");
  if (c.slot === "wskin") assert.ok(MOTIFS.includes(skinMotif(id)), id + " is a weapon motif");
}
for (const id of Object.keys(ART)) assert.ok(D.cos[id], id + " (art) is in the catalogue");
for (const src of ["shop", "chest", "boss", "daily", "rift", "ach"]) assert.ok(ids.some((id) => D.cos[id].src === src), "something comes from " + src);
// the shop's prices follow rarity (a gold sink that stays in its lane: nothing epic is for sale)
const BAND = [[300, 1500], [1800, 4000], [6000, 8000]];
for (const id of ids.filter((k) => D.cos[k].src === "shop")) {
  const c = D.cos[id];
  assert.ok(BAND[c.q], id + ": the shop sells nothing above rare");
  assert.ok(c.price >= BAND[c.q][0] && c.price <= BAND[c.q][1], id + ": " + c.price + " G is in the band of its rarity");
}
// themed sets: every set has pieces in two slots or more
assert.ok(ids.length >= 100, "a hundred cosmetics");
for (const [k, name] of Object.entries(D.cosSets)) {
  const of = ids.filter((id) => D.cos[id].set === k);
  assert.ok(name && of.length >= 3, "set " + k + " has three pieces or more");
  assert.ok(new Set(of.map((id) => D.cos[id].slot)).size >= 2, "set " + k + " spans slots");
}
// every life skill at Lv 50 and every perk NPC at 가족 pays out one cosmetic of its own
const achCos = (a) => ids.filter((id) => D.cos[id].ach === a);
for (const k of D.life.keys) assert.equal(achCos("life50_" + k).length, 1, "a master outfit for " + k);
const repAch = D.achievements.filter((a) => a.id.startsWith("rep_")).map((a) => a.id);
assert.ok(repAch.length >= 5);
for (const a of repAch) assert.equal(achCos(a).length, 1, "a 가족 gift for " + a);
// an achievement may pay several pieces, all of one set (P10: 협동 알바 왕's three)
for (const a of new Set(ids.map((id) => D.cos[id].ach).filter(Boolean))) {
  const of = achCos(a);
  assert.ok(of.length === 1 || (of[0] && D.cos[of[0]].set && of.every((id) => D.cos[id].set === D.cos[of[0]].set)), a + " pays one piece, or pieces of one set");
}
assert.ok(shopNpc, "the costume shop stands in town");
assert.ok(town.npcs.every((n) => n === shopNpc || Math.hypot(n.x - shopNpc.x, n.y - shopNpc.y) >= 3), "with room around it");
assert.equal(town.o[shopNpc.y][shopNpc.x], " ", "on open ground");
assert.ok(!"pb".includes(town.g[shopNpc.y][shopNpc.x]), "not on a road");

// ── weapon art: every kind and tier, and legendary powers with custom motifs
for (const wk of Object.keys(D.wkinds)) assert.equal((DESIGNS[wk] || []).length, Math.max(...Object.values(D.items).filter((it) => it.wk === wk).map((it) => it.tier)), wk + " has a design for every gear tier (six)");
// (the first eight powers have a look; the prefix powers added since may lack art for now: weapons.js then draws the tier's weapon, `MOTIF[o.wl] ? … : ""`)
const LOOKS = ["chain", "nova", "greed", "haste", "thorn", "feast", "echo", "giant"];
for (const k of LOOKS) assert.ok(MOTIFS.includes(k), "legendary " + k + " has a look");

assert.ok(SIL && MOTIF_SIL, "weapon motifs have their own silhouette catalogue");
assert.deepEqual(Object.keys(SIL).sort(), Object.keys(D.wkinds).sort());
assert.deepEqual(Object.keys(MOTIF_SIL).sort(), Object.keys(D.wkinds).sort());
const maxLength = { sword: 38, dagger: 20, spear: 48, staff: 28, book: 20, bow: 23, hammer: 29 };
for (const [kind, designs] of Object.entries(SIL)) {
  assert.ok(Object.keys(designs).length >= 4, kind + " has distinct variants");
  const mapping = MOTIF_SIL[kind];
  for (const power of LOOKS) assert.ok(Object.hasOwn(mapping, power), kind + " maps legendary " + power);
  assert.equal(mapping.shard, "riftglass", kind + " has a dedicated rift shard design");
  for (const [motif, name] of Object.entries(mapping)) {
    assert.ok(MOTIFS.includes(motif), kind + " has known motif " + motif);
    assert.ok(Object.hasOwn(designs, name), kind + " " + motif + " maps to " + name);
  }
  const canvasWidth = kind === "spear" ? 52 : kind === "sword" ? 44 : 32;
  const grip = kind === "book" ? 16 : 5;
  const sMin = 1 - grip, sMax = canvasWidth - 1 - grip;
  const samples = Object.entries(designs);
  if (kind === "hammer") DESIGNS.hammer.forEach((make, i) => samples.push([`tier ${i + 1}`, make]));
  for (const [name, make] of samples) {
    const label = kind + " " + name;
    if (Object.hasOwn(designs, name)) assert.ok(Object.values(mapping).includes(name), label + " appears on a weapon motif");
    const { sh, head, blade } = make();
    if (kind === "bow") for (const pull of [-0.25, 0, 1]) {
      const drawn = make(false, { pull, arrow: true });
      assert.ok(drawn.sh.length > sh.length && drawn.post.length > 0, label + " draws a nocked arrow and string at every pull");
    }
    assert.ok(sh.length && blade.length, label + " has shapes and blade materials");
    const points = sh.flatMap((part) => {
      if (part.k === "p") return part.pts;
      if (part.k === "c") return [[part.s - part.r, part.t - part.r], [part.s + part.r, part.t + part.r]];
      if (part.k === "l") return [part.a, part.b].flatMap(([s, t]) => [[s, t], [s + 1, t + 1]]);
      return [[part.s, part.t], [part.s + 1, part.t + 1]];
    });
    const ts = points.map(([, t]) => t), ss = points.map(([s]) => s);
    assert.ok(points.every(([s, t]) => s >= sMin && s <= sMax && t >= -14 && t <= 14), label + " fits the canvas with its outline");
    assert.ok(Math.max(...ss) - Math.min(...ss) <= maxLength[kind], label + " fits the pommel-to-tip limit");
    if (kind === "book") assert.ok(Math.max(...ts) - Math.min(...ts) <= 14, label + " fits the book height");
    const [hs0, hs1, ht0, ht1] = head;
    // A bow's head is measured along the limbs before the decorations are bent.
    const [headMin, headMax] = kind === "bow" ? [-14, 14] : [sMin, sMax];
    assert.ok(hs0 >= headMin && hs0 < hs1 && hs1 <= headMax && ht0 >= -14 && ht0 < ht1 && ht1 <= 14, label + " has an in-bounds head");
  }
}

// ── a new character: an empty wardrobe, the current sheet version
{
  const W = world();
  const p = W.S.players.A;
  assert.deepEqual(p.ch.cos, { own: [], on: {}, tokens: 0 });
  assert.ok(p.ch.v >= 7);
  const s = W.step().self;
  assert.deepEqual(s.cos, { own: [], on: {}, tokens: 0 }, "the wardrobe is in the player's own payload");
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
  assert.deepEqual(p5.ch.cos, { own: [], on: {}, tokens: 0 });
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
  L.runtime(W.S, a.map).who = true;
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
  q.ch.cnt.cook = 10;
  for (let i = 0; i < 3; i++) assert.ok(W2.act({ t: "daily", i }).ok);
  assert.ok(q.ch.ach.includes("cook10") && q.ch.cos.own.includes("hat_chef"), "the chef's hat comes with the cooking achievement");
  assert.ok(W2.act({ t: "daily", i: "bonus" }).ok);
  const got = q.ch.cos.own.filter((id) => D.cos[id].src === "daily");
  assert.equal(got.length, 1, "one cosmetic from the daily box");
  const v = W2.step();
  assert.ok((v.toast || []).some((m) => m.includes("외형 획득")), "with a notice");
}

// ── life masters and trusted NPCs: the outfit comes with the title, and old sheets catch up
{
  // the rules' own helpers, from a second copy of logic.js that exports them (the world is plain data: both copies read it alike)
  const X = (await import("data:text/javascript;base64," + Buffer.from(readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") + "\nexport const __t = { gainLife, addRep, cosFrom, cosBossRare, gainWillowToken };\n").toString("base64"))).__t;
  const W = world("명인");
  const p = W.S.players.A, ch = p.ch;
  W.step();
  ch.life.fish = { lv: 49, xp: 0 };
  X.gainLife(W.S, p, "fish", 1e6);
  assert.ok(ch.ach.includes("life50_fish") && ch.cos.own.includes("hat_fisher"), "Lv 50 in fishing: the master fisher's hat");
  assert.ok(!ch.cos.own.includes("top_chefcoat"), "and only that skill's");
  assert.ok(W.act({ t: "cos_eq", id: "hat_fisher" }).ok);
  X.addRep(W.S, p, "kangkang", 500);
  assert.ok(ch.ach.includes("rep_kangkang") && ch.cos.own.includes("back_hammer"), "가족 with 캉캉: his hammer");
  assert.ok(!ch.cos.own.includes("top_apron_juju"));
  assert.ok(p.gain.some((g) => g[0] === "cos" && g[1] === "back_hammer"), "and it shows in what was gained");
  // a sheet that earned the titles before the outfits existed gets them on its next visit
  const old = JSON.parse(JSON.stringify(L.exportChar(W.S, "A")));
  old.cos = { own: [], on: {} };
  old.ach = [...new Set([...old.ach, "life50_cook", "rep_bogle"])];
  const q = W.join("B", "", "warrior", old);
  for (const id of ["hat_fisher", "back_hammer", "top_chefcoat", "hat_goggles_bogle"]) assert.ok(q.ch.cos.own.includes(id), id + " caught up");
  // quest and weekly cosmetics are named but nothing gives them yet: the shop refuses, no pool rolls them
  for (const src of ["quest", "weekly"]) {
    const of = ids.filter((id) => D.cos[id].src === src);
    assert.ok(of.length >= 1, "a placeholder from " + src);
    for (const id of of) assert.ok(!W.act({ t: "cos_buy", id }).ok, id + " is not for sale");
  }
  const before = ch.cos.own.filter((id) => !["chest", "boss", "daily", "rift"].includes(D.cos[id].src)).length;
  for (let i = 0; i < 400; i++) for (const src of ["chest", "boss", "daily", "rift", "quest", "weekly"]) X.cosFrom(W.S, p, src, "");
  assert.ok(ids.filter((id) => ["chest", "boss", "daily", "rift"].includes(D.cos[id].src)).every((id) => ch.cos.own.includes(id)), "the four pools empty out");
  assert.ok(ids.filter((id) => ["quest", "weekly"].includes(D.cos[id].src)).every((id) => ch.cos.own.includes(id)), "a later system can hand its own out with cosFrom");
  assert.equal(ch.cos.own.filter((id) => D.cos[id].src === "shop").length, 0, "nothing sold was given away");
  assert.ok(before >= 2);

  const wallet = world("버들단골"), buyer = wallet.S.players.A;
  const item = "hat_moon_archive", price = D.cos[item].price, buy = { t: "cos_buy", id: item };
  const rare = ids.filter((id) => D.cos[id].src === "rareBoss");
  buyer.ch.gold = 100000;
  assert.equal(X.gainWillowToken(buyer, price - 1), price - 1);
  assert.match(wallet.act(buy).error, /의상실/);
  wallet.to("A", shopNpc.x, shopNpc.y + 1);
  assert.match(wallet.act(buy).error, /버드나무토큰/, "gold cannot cover a token purchase");
  assert.equal(X.gainWillowToken(buyer, 3), 3);
  assert.ok(wallet.act(buy).ok);
  assert.equal(buyer.ch.cos.tokens, 2);
  assert.equal(buyer.ch.gold, 100000);
  assert.equal(buyer.ch.cos.on.hat, item);
  assert.match(wallet.act(buy).error, /이미/, "duplicate purchases cannot spend tokens");
  assert.equal(buyer.ch.cos.tokens, 2);
  for (const id of rare) assert.match(wallet.act({ t: "cos_buy", id }).error, /팔지 않는/);

  const saved = JSON.parse(JSON.stringify(L.exportChar(wallet.S, "A")));
  assert.equal(wallet.join("B", "", "warrior", saved).ch.cos.tokens, 2, "tokens survive reload");
  saved.cos.tokens = 10000.75;
  const capped = wallet.join("C", "", "warrior", saved);
  assert.equal(capped.ch.cos.tokens, 9999, "invalid oversize balances are clamped");
  assert.equal(X.gainWillowToken(capped, 1), 0);
  saved.cos.tokens = -4;
  assert.equal(wallet.join("D", "", "warrior", saved).ch.cos.tokens, 0, "negative balances are reset");

  let rolls = 0;
  while (rolls < 5000 && rare.some((id) => !buyer.ch.cos.own.includes(id))) {
    wallet.S.now = BASE + 41 * rolls++;
    const n = wallet.S.cosN || 0, owned = buyer.ch.cos.own.length;
    const got = X.cosBossRare(wallet.S, buyer, "우두머리");
    assert.equal(wallet.S.cosN, n + 1, "only one random roll for the rare pool");
    assert.equal(buyer.ch.cos.own.length, owned + (got ? 1 : 0));
  }
  assert.ok(rare.every((id) => buyer.ch.cos.own.includes(id)), "both boss cosmetics can drop");
  assert.ok(rolls > 2, "rare cosmetics are not guaranteed");
  const n = wallet.S.cosN;
  assert.equal(X.cosBossRare(wallet.S, buyer, "우두머리"), false);
  assert.equal(wallet.S.cosN, n, "a complete collection does not roll again");
}

// ── 염색 and 기념품 재봉 at 루루's (P9)
{
  assert.equal(D.cosDyes.length, 6, "six dyes");
  assert.equal(DYES.length, D.cosDyes.length, "wardrobe.js draws every dye");
  assert.equal(dyed(ART.hat_beanie_red, 0), ART.hat_beanie_red, "dye 0 is the very same art (undyed draws as before)");
  assert.equal(dyed(ART.hat_beanie_red, 2)[2].b, DYES[1], "a trim takes the dye");
  assert.equal(dyed(ART.back_cape_red, 6)[2].c, DYES[5], "no trim: the main colour does");
  assert.equal(ART.hat_beanie_red[2].b, "#f07a7a", "the catalogue art is not touched");
  for (const [i, id] of D.cosDyes.entries()) {
    const r = D.life.recipes.find((x) => x.out[0] === id);
    assert.ok(D.items[id] && r && r.sk === "alch" && r.lv >= 5 && r.lv <= 40, id + ": an alchemy recipe at L5–40");
    assert.ok(r.in.some(([m]) => m.startsWith("m_h")), id + ": made from herbs");
    assert.ok(i === 0 || D.items[id].name !== D.items[D.cosDyes[i - 1]].name);
  }
  assert.ok(ids.every((id) => D.cos[id].n < D.cosDyeK), "every wire code stays below the dye step");
  const W = world("염색가");
  const p = W.S.players.A, ch = p.ch;
  ch.cos.own.push("hat_beanie_red", "ws_star");
  ch.cos.on.hat = "hat_beanie_red";
  const dye = (id, d) => W.act({ t: "cos_dye", id, d });
  assert.equal(dye("hat_beanie_red", 1).error, "의상실 주인이 너무 멉니다");
  W.to("A", shopNpc.x, shopNpc.y + 1);
  assert.equal(dye("hat_beanie_red", 1).error, "[들꽃 분홍 염료]가 없습니다", "a dye is needed");
  assert.equal(dye("hat_beanie_red", 7).error, "없는 염료입니다");
  assert.equal(dye("hat_beanie_red", 1.5).error, "없는 염료입니다");
  assert.equal(dye("hat_beanie_red", -1).error, "없는 염료입니다");
  assert.equal(dye("hat_beanie_red", "1").error, "없는 염료입니다");
  assert.equal(dye("ws_star", 1).error, "무기 외형은 염색할 수 없습니다");
  assert.equal(dye("hat_crown", 1).error, "아직 얻지 않은 외형입니다");
  assert.equal(dye("nope", 1).error, "없는 외형입니다");
  assert.equal(dye("hat_beanie_red", 0).error, "이미 원래 색입니다");
  ch.inv.push({ id: "dye_pink", n: 2 });
  const pinks = () => ch.inv.filter((s) => s.id === "dye_pink").reduce((n, s) => n + s.n, 0);
  W.step();
  assert.ok(dye("hat_beanie_red", 1).ok);
  assert.equal(pinks(), 1, "one dye used");
  assert.deepEqual(ch.cosDye, { hat_beanie_red: 1 });
  let v = W.step();
  assert.deepEqual(v.self.cosDye, { hat_beanie_red: 1 }, "self carries the dyes when they change");
  assert.equal(W.step().self, undefined, "and not again until something changes");
  assert.equal(dye("hat_beanie_red", 1).error, "이미 그 색으로 물들였습니다");
  // others see the dye in the worn code
  const b = W.join("B", "구경꾼");
  W.to("B", shopNpc.x + 1, shopNpc.y + 1);
  v = W.step("B");
  assert.equal(v.who.find((r) => r[0] === p.eid)[14][0], D.cos.hat_beanie_red.n + D.cosDyeK, "a dyed code carries its dye");
  assert.ok(b);
  // back to the original: free
  assert.ok(dye("hat_beanie_red", 0).ok);
  assert.equal(pinks(), 1, "resetting is free");
  assert.deepEqual(ch.cosDye, {});
  v = W.step("B");
  assert.equal(v.who.find((r) => r[0] === p.eid)[14][0], D.cos.hat_beanie_red.n, "undyed codes are as before");
  // saved and loaded; junk cleaned
  assert.ok(dye("hat_beanie_red", 1).ok);
  const saved = JSON.parse(JSON.stringify(L.exportChar(W.S, "A")));
  assert.deepEqual(W.join("C", "", "warrior", saved).ch.cosDye, { hat_beanie_red: 1 }, "dyes survive reload");
  saved.cosDye = { hat_beanie_red: 9, ws_star: 2, hat_crown: 3, nope: 1, hat_beanie_navy: "x" };
  assert.deepEqual(W.join("D", "", "warrior", saved).ch.cosDye, {}, "out of range, weapon skins, unowned and unknown pieces dropped");
  // an old sheet (v24) has no cosDye
  const old = JSON.parse(JSON.stringify(saved));
  delete old.cosDye; old.v = 24;
  const o = W.join("E", "", "warrior", old).ch;
  assert.deepEqual(o.cosDye, {}); assert.equal(o.v, 27);
  assert.deepEqual(L.newChar("새옷", "warrior", []).cosDye, {});
  // keepsake sewing: the table names every keepsake, each sews into its own piece (P11), once
  assert.deepEqual(Object.keys(D.keepSew).sort(), Object.keys(D.items).filter((id) => D.items[id].type === "keep").sort(), "every keepsake has a row");
  for (const [k, id] of Object.entries(D.keepSew)) assert.ok(D.cos[id] && D.cos[id].src === "sew", k + ": sews into a real piece");
  assert.equal(new Set(Object.values(D.keepSew)).size, Object.keys(D.keepSew).length, "one piece per keepsake");
  const sew = (k) => W.act({ t: "cos_sew", k });
  assert.equal(sew("kp_bell").error, "아직 간직하지 않은 기념품입니다");
  assert.equal(sew("hp_s").error, "재봉할 수 없는 기념품입니다");
  ch.keep.kp_bell = 1;
  const was = D.keepSew.kp_bell;
  D.keepSew.kp_bell = "";   // (defs hands out the live table: a row with no piece yet is refused)
  assert.equal(sew("kp_bell").error, "루루가 아직 이 기념품의 옷본을 그리고 있어요");
  D.keepSew.kp_bell = was;
  assert.ok(sew("kp_bell").ok);
  assert.ok(ch.cos.own.includes("back_cloud_bell") && ch.keep.kp_bell, "sewn into the 운해 종지기 등장식; the keepsake stays");
  assert.equal(sew("kp_bell").error, "이미 지어 받은 외형입니다");
}

// ── P10 sets: 버드나무 마을, 협동 알바 왕, 낚시 기록가 — each piece's source pays it
{
  const X = (await import("data:text/javascript;base64," + Buffer.from(readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") + "\nexport const __t = { checkAch, addRep, FISH_CM };\n").toString("base64"))).__t;
  const W = world("마을옷");
  const p = W.S.players.A, ch = p.ch;
  W.step();
  const has = (...l) => l.every((id) => ch.cos.own.includes(id));
  for (const [set, n] of [["willow", 4], ["coopking", 3], ["fishlog", 3]]) assert.equal(ids.filter((id) => D.cos[id].set === set).length, n, set + " pieces");
  // the A1 keepsake: 루루 sews the straw bonnet
  assert.equal(D.keepSew.kp_willow_key, "hat_willow_straw");
  W.to("A", shopNpc.x, shopNpc.y + 1);
  ch.keep.kp_willow_key = 1;
  assert.ok(W.act({ t: "cos_sew", k: "kp_willow_key" }).ok && has("hat_willow_straw"), "the willow key sews into the 밀짚 두건");
  assert.ok(!W.act({ t: "cos_buy", id: "hat_willow_straw" }).ok, "not for sale");
  // a hundred chores: the basket and the blush together
  ch.cnt.chore = 99; X.checkAch(W.S, p);
  assert.ok(!has("back_willow_basket"));
  ch.cnt.chore = 100; X.checkAch(W.S, p);
  assert.ok(has("back_willow_basket", "face_willow_blush"), "chores 100: 장바구니 + 볼터치");
  // three 버드나무 villagers at 친구 (others do not count)
  X.addRep(W.S, p, "willow_farmer", 30); X.addRep(W.S, p, "willow_fisher", 30); X.addRep(W.S, p, "juju", 30);
  assert.ok(!has("top_willow_apron"), "two villagers are not enough");
  X.addRep(W.S, p, "willow_florist", 30);
  assert.ok(has("top_willow_apron"), "three villagers at 친구: 덧댄 앞치마");
  // an S in every co-op shift: all three 알바 왕 pieces
  for (const k of Object.keys(ch.cnt).filter((k) => k.startsWith("coopS_")).slice(1)) ch.cnt[k] = 1;
  X.checkAch(W.S, p);
  assert.ok(!has("top_coop_vest"), "one shift short");
  for (const k of Object.keys(ch.cnt).filter((k) => k.startsWith("coopS_"))) ch.cnt[k] = 1;
  X.checkAch(W.S, p);
  assert.ok(has("top_coop_vest", "hat_coop_cap", "back_coop_tag") && ch.ach.includes("coopall"), "협동 알바 왕");
  // ten species written in at 대: the sou'wester
  const fish = Object.keys(X.FISH_CM).slice(0, 10);
  for (const [i, id] of fish.entries()) ch.fbook[id] = [30, i < 9 ? 4 : 3];
  X.checkAch(W.S, p);
  assert.ok(!has("hat_fish_souwester"), "nine record-size fish are not enough");
  ch.fbook[fish[9]][1] = 4; X.checkAch(W.S, p);
  assert.ok(has("hat_fish_souwester"), "ten record-size fish: 어부 방수모");
  // all five pieces wear together, dyed by their trim
  for (const id of ["hat_willow_straw", "top_willow_apron", "back_willow_basket", "face_willow_blush"]) assert.ok(W.act({ t: "cos_eq", id }).ok, id);
  for (const id of ids.filter((id) => ["willow", "coopking", "fishlog"].includes(D.cos[id].set))) assert.ok("b" in ART[id][2] || ART[id][0] === "face", id + " has a trim to dye");
  // an old sheet that finished the fish book before the set: the raincoat and the scroll catch up; its chore count starts at 0
  const old = JSON.parse(JSON.stringify(L.exportChar(W.S, "A")));
  old.cos = { own: [], on: {} }; old.ach = ["fbook"]; delete old.cnt.chore;
  const q = W.join("B", "", "warrior", old);
  assert.ok(q.ch.cos.own.includes("top_fish_raincoat") && q.ch.cos.own.includes("back_fish_scroll"), "fbook pays the raincoat and the scroll");
  assert.equal(q.ch.cnt.chore, 0, "old sheets start with no chores counted");
  assert.equal(L.newChar("새내기", "warrior", []).cnt.chore, 0);
}

// ── P11: the four season sets on 장꾼 다래's stall, and the story keepsakes 루루 sews
{
  for (const [s, set] of ["spring", "summer", "autumn", "winter"].entries()) {
    const of = ids.filter((id) => D.cos[id].set === set);
    assert.deepEqual(of.map((id) => D.cos[id].slot), ["hat", "top", "back", "wskin"], set + ": hat, top, back, weapon skin");
    assert.deepEqual(D.fair.shop[s].slice(1).map((r) => r[0]), of, set + ": the season's stall sells exactly these");
    for (const r of D.fair.shop[s]) assert.equal(r[2], 1, r[0] + " is on sale");
    for (const id of of) assert.ok(id === "hat_ssn_sea" || D.cos[id].slot === "wskin" || "b" in ART[id][2], id + " has a trim to dye");
  }
  const story = ids.filter((id) => D.cos[id].set === "story");
  assert.deepEqual([...story].sort(), Object.values(D.keepSew).filter((id) => id !== "hat_willow_straw").sort(), "the story set is the sewn keepsakes");
  const W = world("기념품");
  const ch = W.S.players.A.ch;
  W.step();
  W.to("A", shopNpc.x, shopNpc.y + 1);
  for (const k of Object.keys(D.keepSew)) { ch.keep[k] = 1; assert.ok(W.act({ t: "cos_sew", k }).ok, k + " sews"); }
  assert.ok(story.every((id) => ch.cos.own.includes(id)), "every story piece sewn");
  for (const id of ["hat_chronicler", "back_neon_sign", "face_rift_goggles", "hat_ink_satgat"]) assert.ok(W.act({ t: "cos_eq", id }).ok, id + " worn");
}

// ── P10 견습 장인 (a tool belt per life skill at 30) and P11 face +8, wskin +5
{
  const X = (await import("data:text/javascript;base64," + Buffer.from(readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") + "\nexport const __t = { checkAch };\n").toString("base64"))).__t;
  for (const k of D.life.keys) assert.equal(achCos("life30_" + k).length, 1, "a 견습 장인 belt for " + k);
  const W = world("견습");
  const p = W.S.players.A, ch = p.ch;
  W.step();
  const has = (...l) => l.every((id) => ch.cos.own.includes(id));
  ch.life.cook.lv = 29; X.checkAch(W.S, p);
  assert.ok(!has("top_appr_cook"), "29 is not enough");
  ch.life.cook.lv = 30; X.checkAch(W.S, p);
  assert.ok(has("top_appr_cook") && !has("top_appr_fish") && ch.ach.includes("life30"), "요리 30: the cook's belt only (and 생활의 달인 too)");
  assert.ok(has("face_craft_goggles"), "생활의 달인 pays the brow goggles");
  ch.cnt.gat = 100; ch.cnt.craft = 50; ch.cnt.coop = 20; X.checkAch(W.S, p);
  assert.ok(has("face_grass_whistle", "face_flour_nose", "face_good_stamp"), "chores and life work pay three face pieces");
  // four faces at 루루's shop, each in its rarity's gold band (checked above); one bought here
  const shopFaces = ["face_freckles", "face_star_bandage", "face_flower_earring", "face_snow_blush"];
  assert.ok(shopFaces.every((id) => D.cos[id].src === "shop"));
  W.to("A", shopNpc.x, shopNpc.y + 1);
  ch.gold = 5000;
  assert.ok(W.act({ t: "cos_buy", id: "face_freckles" }).ok && has("face_freckles") && ch.gold === 5000 - D.cos.face_freckles.price);
  if (ch.cos.on.face !== "face_freckles") assert.ok(W.act({ t: "cos_eq", id: "face_freckles" }).ok);
  assert.ok(W.act({ t: "cos_eq", id: "top_appr_cook" }).ok && ch.cos.on.face === "face_freckles", "belt and freckles worn together");
  // the five new weapon skins are motifs and drop from their sources
  for (const id of ["ws_willow_twig", "ws_lantern", "ws_temple_bell", "ws_whalebone", "ws_star_candy"]) assert.ok(MOTIFS.includes(skinMotif(id)) && ["quest", "boss", "daily"].includes(D.cos[id].src), id);
  // an old sheet that already holds the achievement catches up on the belt
  const old = JSON.parse(JSON.stringify(L.exportChar(W.S, "A")));
  old.cos = { own: [], on: {} }; old.ach = ["life30_alch"];
  assert.ok(W.join("B", "", "warrior", old).ch.cos.own.includes("top_appr_alch"), "life30_alch pays the alchemist's belt");
}

console.log("wardrobe: ok —", ids.length, "cosmetics,", Object.keys(D.wkinds).length * 5, "weapon designs,", MOTIFS.length, "motifs");
