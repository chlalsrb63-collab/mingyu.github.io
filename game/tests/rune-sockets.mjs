import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const runeTest = { T, MOBS, SOCK_DROP, gearBonus, lootFor, migrate, newMob, pickUp, plain, rollGear };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const { T, MOBS, SOCK_DROP, gearBonus, lootFor, migrate, newMob, pickUp, plain, rollGear } = L.runeTest;
const D = L.defs();
const runeId = (set) => Object.keys(D.runes).find((id) => D.runes[id].set === set);

assert.equal(D.sets, undefined);
assert.equal(D.runewords, undefined);
assert.deepEqual(D.rarity.filter(Boolean), ["일반", "마법", "희귀", "전설", "유니크"]);
assert.deepEqual(Object.values(D.runeSets).map((set) => set.need).sort(), [2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4]);
const gearWords = new Set(Object.values(D.legend).map(([name]) => name.replace(/의$/, "")));
for (const [id, r] of Object.entries(D.runes)) {
  assert.equal(D.items[id].rune, id);
  assert.equal(r.af.length, r.q === 4 ? 1 : r.q);
  assert.equal(new Set(r.af.map(([key]) => key)).size, r.af.length);
  assert.ok(r.af.every(([key, value]) => Object.hasOwn(D.affix, key) && value > 0));
  if (r.q === 4) {
    const set = D.runeSets[r.set];
    assert.equal(r.name, `${set.name}의 룬`);
    assert.ok(!gearWords.has(set.name), set.name);
  } else assert.equal(r.set, undefined);
}
for (const id of Object.keys(D.runeSets)) assert.ok(runeId(id), id);

const bases = { weapon: "w_warrior_1", armor: "a_1", helm: "h_1", gloves: "g_1", boots: "b_1", ring1: "r_1", ring2: "r_1", amulet: "n_1", weapon2: "w_bow_1" };
const seed = { seed: 48395 };
for (const [slot, id] of Object.entries(bases)) {
  const cap = ["weapon", "weapon2", "armor"].includes(slot) ? 2 : 1;
  assert.equal(D.sockCaps[D.items[id].type], cap);
  for (const q of [0, 1, 2, 3, 5]) {
    const counts = new Set(Array.from({ length: 160 }, () => rollGear(seed, id, q, 5).sk));
    assert.deepEqual([...counts].sort(), Array.from({ length: cap + 1 }, (_, i) => i), `${slot} rarity ${q}`);
  }
}

const S = L.setup();
S.now = 300_000;
const pid = "rune-test@s1";
L.addPlayer(S, pid, L.hero("룬시험", { wk: "sword" }));
const p = S.players[pid], ch = p.ch;
const act = (action) => {
  const result = L.validateAction(S, pid, action);
  if (result.ok) L.applyAction(S, pid, action);
  return result;
};
const drill = (k) => act({ t: "socket", k });
ch.eq.weapon = plain(bases.weapon);
ch.gold = 20_000;
const before = ch.gold;
assert.equal(D.items[D.sockItem].name, "룬 천공석");
assert.equal(D.items[D.sockItem].q, 3);
ch.inv = [{ id: D.sockItem, n: 4 }];
const stones = () => ch.inv.find((stack) => stack.id === D.sockItem)?.n || 0;
assert.equal(drill("weapon").ok, false, "the smith must be in reach");
assert.equal(act({ t: "use", id: D.sockItem, k: "weapon" }).ok, false, "the inventory route requires the smith too");
assert.equal(ch.gold, before);
assert.equal(stones(), 4);
const townNpcs = L.viewFor(S, pid).map.npcs;
const smith = townNpcs.find((n) => n.role === "smith");
p.x = smith.x * T + 8; p.y = smith.y * T + 20;
assert.equal(drill("__proto__").ok, false);
p.dead = true;
assert.equal(drill("weapon").ok, false);
p.dead = false;
assert.equal(drill("weapon").ok, true);
assert.equal(ch.eq.weapon.sk, 1);
assert.equal(ch.gold, before - D.sockCost[0]);
assert.equal(stones(), 3);
assert.equal(drill("weapon").ok, true);
assert.equal(ch.eq.weapon.sk, 2);
assert.equal(drill("weapon").ok, false, "retries never overshoot the cap");
assert.equal(ch.gold, before - D.sockCost[0] - D.sockCost[1]);
assert.equal(stones(), 2, "the capped request does not consume a third stone");
ch.eq.ring1 = plain(bases.ring1);
ch.gold = D.sockCost[0] - 1;
assert.equal(drill("ring1").ok, false, "insufficient gold");
assert.equal(stones(), 2);
ch.gold++;
assert.equal(drill("ring1").ok, true);
assert.equal(ch.eq.ring1.sk, 1);
assert.equal(drill("ring1").ok, false);
assert.equal(stones(), 1);
ch.inv.length = 0;
ch.gold = before;
assert.equal(drill("weapon2").ok, false);
assert.equal(drill("ring2").ok, false);
ch.eq.ring2 = plain(bases.ring2);
assert.equal(drill("ring2").ok, false, "gold alone is insufficient");
assert.equal(ch.eq.ring2.sk, 0);
assert.equal(ch.gold, before);

assert.equal(ch.lvl, 1);
const amber = "ru_cutamber";
const emptyAttack = gearBonus(ch).atk;
ch.inv = [1, 11, 12].map((il) => ({ id: amber, n: 1, il }));
assert.equal(act({ t: "rune", s: 2, k: "weapon", i: 0 }).ok, false, "Lv.1 cannot insert an item-level 12 rune");
assert.equal(ch.inv[2].n, 1, "rejection preserves the rune");
assert.equal(act({ t: "rune", s: 0, k: "weapon", i: 0 }).ok, true);
assert.equal(gearBonus(ch).atk - emptyAttack, 2, "the item-level 1 amber rune grants +2 attack");
assert.equal(act({ t: "rune", s: 0, k: "weapon", i: 0, r: 1 }).ok, true, "Lv.1 can insert a different level of the same rune at item level 11");
assert.deepEqual(ch.eq.weapon.ru[0], [amber, 11]);
assert.ok(gearBonus(ch).atk - emptyAttack > 2, "the higher rune grants more attack");
ch.eq.weapon.ru[0] = [amber, 12];
assert.equal(gearBonus(ch).atk, emptyAttack, "a rune already socketed by another character still has a level gate");
ch.eq.weapon.ru[0] = null;

const twos = Object.keys(D.runeSets).filter((id) => D.runeSets[id].need === 2);
const four = Object.keys(D.runeSets).find((id) => D.runeSets[id].need === 4);
const wear = (k, ...runes) => { ch.eq[k] = { ...plain(bases[k]), sk: runes.length, ru: runes.map(runeId) }; };
const stack = (id) => ch.inv.findIndex((s) => s.id === id);
const insert = (id, k, i, r) => act({ t: "rune", s: stack(id), k, i, r });
ch.inv = [{ id: runeId(twos[0]), n: 1, il: 1 }, { id: runeId(twos[0]), n: 1, il: 11 }, { id: runeId(twos[1]), n: 1, il: 1 }];
const beforeRune = gearBonus(ch);
assert.equal(insert(runeId(twos[0]), "ring1", 1).ok, false, "locked hole");
assert.equal(insert(runeId(twos[0]), "ring1", 0).ok, true);
const [stat, value] = D.runes[runeId(twos[0])].af[0];
assert.equal(gearBonus(ch)[stat], beforeRune[stat] + Math.max(1, Math.round(value * 0.18)));
assert.deepEqual(gearBonus(ch).runeSets, []);
assert.equal(insert(runeId(twos[0]), "weapon", 0).ok, true);
const readSelf = () => { p.dirty = true; return L.viewFor(S, pid).self; };
assert.deepEqual(readSelf().runeSets, [twos[0]]);
assert.equal(readSelf().runeCounts[twos[0]], 2, "two qualifying runes of different levels activate one set");
assert.equal(insert(runeId(twos[1]), "weapon", 0).ok, false, "occupied socket requires confirmation");
assert.equal(ch.inv[stack(runeId(twos[1]))].n, 1);
assert.equal(insert(runeId(twos[1]), "weapon", 0, 1).ok, true);
assert.deepEqual(ch.eq.weapon.ru[0], [runeId(twos[1]), 1]);
assert.deepEqual(readSelf().runeSets, [], "breaking the pair removes the power immediately");

wear("weapon", four, four); wear("armor", four, four);
wear("helm", twos[0]); wear("boots", twos[0]);
wear("ring1", twos[1]); wear("ring2", twos[1]);
wear("weapon2", twos[1], twos[1]);
p.stc = null;
assert.equal(gearBonus(ch).runeCounts[twos[1]], 4, "stowed weapon sockets count");
assert.deepEqual(readSelf().runeSets, [four, twos[0]], "highest threshold, then stable priority; maximum two");
assert.equal(act({ t: "uneq", k: "helm" }).ok, true);
assert.deepEqual(readSelf().runeSets, [four, twos[1]], "the four matching two-piece runes activate their power once");

// Fill each set through the real socket action. Removing a supporting piece invalidates derived stats.
{
  const priorGear = ch.eq, priorBag = ch.inv;
  for (const [id, set] of Object.entries(D.runeSets)) {
    const rune = runeId(id);
    ch.eq = {
      weapon: { ...plain(bases.weapon), sk: 2, ru: [null, null] },
      armor: { ...plain(bases.armor), sk: 2, ru: [null, null] },
    };
    ch.inv = [{ id: rune, n: set.need, il: 1 }];
    p.stc = null;
    for (let i = 0; i < set.need; i++) {
      assert.ok(insert(rune, i < 2 ? "weapon" : "armor", i % 2).ok, id);
      const view = readSelf();
      assert.equal(view.runeCounts[id], i + 1, id);
      assert.deepEqual(view.runeSets, i + 1 === set.need ? [id] : [], id);
    }
    assert.ok(act({ t: "uneq", k: "weapon" }).ok, id);
    assert.deepEqual(readSelf().runeSets, [], id);
  }
  ch.eq = priorGear; ch.inv = priorBag; p.stc = null;
}

const old = L.newChar("옛날룬", []);
old.v = 26;
old.eq.armor = { ...plain("veil_a"), q: 4, set: "nightveil", il: 104, enh: 6, sk: 3, ru: ["ign", "acu", "ign"] };
old.inv = [{ id: "ru_ign", n: 3 }];
const migrated = migrate(old);
assert.equal(migrated.eq.armor.id, "veil_a");
assert.equal(migrated.eq.armor.q, 3);
assert.equal(migrated.eq.armor.set, undefined);
assert.deepEqual([migrated.eq.armor.il, migrated.eq.armor.enh, migrated.eq.armor.sk], [104, 6, 2]);
assert.deepEqual(migrated.eq.armor.ru, [["ru_ign", 1], ["ru_acu", 1]]);
assert.deepEqual(migrated.inv.find((entry) => entry.id === "ru_ign"), { id: "ru_ign", n: 4, il: 1 }, "legacy stacks and recovered runes take level 1");
assert.equal(migrated.v, L.newChar("현재양식", []).v);
assert.deepEqual(migrate(structuredClone(migrated)), migrated, "loading the upgraded sheet twice is idempotent");
const fairLegacy = L.newChar("장날기록", []);
fairLegacy.v = 27; // the fair market and the rune migration both used v27
fairLegacy.cnt = { set: 2, rw: 1 };
migrate(fairLegacy);
assert.deepEqual([fairLegacy.cnt.rune_find, fairLegacy.cnt.rune_bond], [2, 1]);

const full = L.newChar("가득찬가방", []);
full.v = 26;
full.eq.armor = { ...plain("a_1"), sk: 3, ru: [null, null, "ign"] };
full.inv = Array.from({ length: full.bagCap }, () => plain("h_1"));
full.wh.items = Array.from({ length: D.whSlots }, () => plain("g_1"));
const recovered = migrate(full);
assert.deepEqual(recovered.inv.at(-1), { id: "ru_ign", n: 1, il: 1 }, "even full storage preserves the recovered rune");
assert.equal(recovered.inv.length, recovered.bagCap + 1);
assert.deepEqual(migrate(structuredClone(recovered)), recovered, "the overflow recovery neither duplicates the rune nor buys a bag upgrade");

const rt = S.maps[p.map];
const rarities = new Set();
const foundSets = new Set();

assert.deepEqual(SOCK_DROP, [0.0001, 0.0008, 0.004]);
assert.ok(!D.shop.includes(D.sockItem));
assert.ok(!D.life.recipes.some((recipe) => recipe.id === D.sockItem || recipe.id === `${D.sockItem}_cc`));
let stoneDrop = null;
let rabbitRune = null;
for (const [rank, tries] of [[0, 100_000], [1, 40_000], [2, 20_000]]) {
  const mob = newMob(S, rank === 2 ? "boss" : "twinhare", null, null);
  mob.el = rank;
  let drops = 0, runeDrops = 0;
  const il = Math.min(200, MOBS[mob.k].lv * 4 - 3 + [0, 4, 8][rank]);
  for (let i = 0; i < tries; i++) {
    rt.drops.length = 0;
    lootFor(S, rt, mob, p);
    for (const dr of rt.drops) {
      if (dr.it === D.sockItem) { drops++; stoneDrop = dr; }
      const rune = D.runes[dr.it];
      if (!rune) continue;
      runeDrops++;
      assert.equal(dr.il, il, "rune level follows the monster's displayed level and rank");
      if (!rank) rabbitRune = dr;
      rarities.add(rune.q);
      if (rune.set) foundSets.add(rune.set);
    }
  }
  const expected = tries * SOCK_DROP[rank];
  assert.ok(drops > 0 && Math.abs(drops - expected) < 5 * Math.sqrt(expected), `rank ${rank} drops: ${drops}/${tries}`);
  const expectedRunes = tries * [0.0015, 0.03, 0.20][rank];
  assert.ok(Math.abs(runeDrops - expectedRunes) < 5 * Math.sqrt(expectedRunes), `rank ${rank} rune drops: ${runeDrops}/${tries}`);
  console.log(`rank ${rank} rune drops: ${runeDrops}/${tries} (${(runeDrops / tries * 100).toFixed(3)}%)`);
}
assert.deepEqual([...rarities].sort(), [1, 2, 3, 4]);
assert.equal(foundSets.size, 15, "all rune sets occur in real drops");
assert.ok(pickUp(S, p, rabbitRune));
assert.deepEqual(ch.inv.find((stack) => stack.id === rabbitRune.it), { id: rabbitRune.it, n: 1, il: 1 });

const bank = townNpcs.find((n) => n.role === "bank");
p.x = bank.x * T + 8; p.y = bank.y * T + 20;
ch.inv = [{ id: amber, n: 1, il: 1 }, { id: amber, n: 2, il: 11 }, { id: amber, n: 1, il: 11 }];
assert.equal(act({ t: "sort" }).ok, true);
assert.deepEqual(ch.inv, [{ id: amber, n: 3, il: 11 }, { id: amber, n: 1, il: 1 }]);
assert.equal(act({ t: "wh", a: "put", s: 0, n: 2 }).ok, true);
assert.equal(act({ t: "wh", a: "put", s: 1, n: 1 }).ok, true);
assert.deepEqual(ch.wh.items, [{ id: amber, n: 2, il: 11 }, { id: amber, n: 1, il: 1 }]);
assert.equal(act({ t: "wh", a: "take", s: 0, n: 2 }).ok, true);
assert.deepEqual(ch.inv, [{ id: amber, n: 3, il: 11 }]);
const chest = newMob(S, Object.keys(MOBS).find((id) => MOBS[id].chest), null, null);
for (let i = 0; i < 5000; i++) {
  rt.drops.length = 0;
  lootFor(S, rt, chest, p);
  assert.ok(!rt.drops.some((dr) => dr.it === D.sockItem), "treasure chests are not hunting drops");
}
assert.equal(stoneDrop.q, 3);
p.save = false;
assert.equal(pickUp(S, p, stoneDrop), true);
assert.equal(p.save, true, "persist the rare drop promptly");
assert.equal(stones(), 1);
assert.deepEqual(p.gain.at(-1), ["item", D.sockItem, 1, 3]);
console.log("rune sockets: caps, payments, rune drops, equipped bonuses, priority and old sheets");
