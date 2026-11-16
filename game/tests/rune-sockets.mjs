import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const runeTest = { T, gearBonus, lootFor, migrate, newMob, plain, rollGear };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const { T, gearBonus, lootFor, migrate, newMob, plain, rollGear } = L.runeTest;
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
assert.equal(drill("weapon").ok, false, "the smith must be in reach");
assert.equal(ch.gold, before);
const smith = L.viewFor(S, pid).map.npcs.find((n) => n.role === "smith");
p.x = smith.x * T + 8; p.y = smith.y * T + 20;
assert.equal(drill("__proto__").ok, false);
p.dead = true;
assert.equal(drill("weapon").ok, false);
p.dead = false;
assert.equal(drill("weapon").ok, true);
assert.equal(ch.eq.weapon.sk, 1);
assert.equal(ch.gold, before - D.sockCost[0]);
assert.equal(drill("weapon").ok, true);
assert.equal(ch.eq.weapon.sk, 2);
assert.equal(drill("weapon").ok, false, "retries never overshoot the cap");
assert.equal(ch.gold, before - D.sockCost[0] - D.sockCost[1]);
ch.eq.ring1 = plain(bases.ring1);
ch.gold = D.sockCost[0] - 1;
assert.equal(drill("ring1").ok, false, "insufficient gold");
ch.gold++;
assert.equal(drill("ring1").ok, true);
assert.equal(ch.eq.ring1.sk, 1);
assert.equal(drill("ring1").ok, false);

const twos = Object.keys(D.runeSets).filter((id) => D.runeSets[id].need === 2);
const four = Object.keys(D.runeSets).find((id) => D.runeSets[id].need === 4);
const wear = (k, ...runes) => { ch.eq[k] = { ...plain(bases[k]), sk: runes.length, ru: runes.map(runeId) }; };
const stack = (id) => ch.inv.findIndex((s) => s.id === id);
const insert = (id, k, i, r) => act({ t: "rune", s: stack(id), k, i, r });
ch.inv = [{ id: runeId(twos[0]), n: 2 }, { id: runeId(twos[1]), n: 1 }];
const beforeRune = gearBonus(ch);
assert.equal(insert(runeId(twos[0]), "ring1", 1).ok, false, "locked hole");
assert.equal(insert(runeId(twos[0]), "ring1", 0).ok, true);
const [stat, value] = D.runes[runeId(twos[0])].af[0];
assert.equal(gearBonus(ch)[stat], beforeRune[stat] + value);
assert.deepEqual(gearBonus(ch).runeSets, []);
assert.equal(insert(runeId(twos[0]), "weapon", 0).ok, true);
const readSelf = () => { p.dirty = true; return L.viewFor(S, pid).self; };
assert.deepEqual(readSelf().runeSets, [twos[0]]);
assert.equal(readSelf().runeCounts[twos[0]], 2);
assert.equal(insert(runeId(twos[1]), "weapon", 0).ok, false, "occupied socket requires confirmation");
assert.equal(ch.inv[stack(runeId(twos[1]))].n, 1);
assert.equal(insert(runeId(twos[1]), "weapon", 0, 1).ok, true);
assert.equal(ch.eq.weapon.ru[0], runeId(twos[1]));
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

const old = L.newChar("옛날룬", []);
old.v = 26;
old.eq.armor = { ...plain("veil_a"), q: 4, set: "nightveil", il: 104, enh: 6, sk: 3, ru: ["ign", "acu", "ign"] };
old.inv = [{ id: "ru_ign", n: 3 }];
const migrated = migrate(old);
assert.equal(migrated.eq.armor.id, "veil_a");
assert.equal(migrated.eq.armor.q, 3);
assert.equal(migrated.eq.armor.set, undefined);
assert.deepEqual([migrated.eq.armor.il, migrated.eq.armor.enh, migrated.eq.armor.sk], [104, 6, 2]);
assert.deepEqual(migrated.eq.armor.ru, ["ru_ign", "ru_acu"]);
assert.equal(migrated.inv.find((entry) => entry.id === "ru_ign").n, 4, "the third rune returns to the bag");
assert.deepEqual(migrate(structuredClone(migrated)), migrated, "loading the upgraded sheet twice is idempotent");

const full = L.newChar("가득찬가방", []);
full.v = 26;
full.eq.armor = { ...plain("a_1"), sk: 3, ru: [null, null, "ign"] };
full.inv = Array.from({ length: full.bagCap }, () => plain("h_1"));
full.wh.items = Array.from({ length: D.whSlots }, () => plain("g_1"));
const recovered = migrate(full);
assert.deepEqual(recovered.inv.at(-1), { id: "ru_ign", n: 1 }, "even full storage preserves the recovered rune");
assert.equal(recovered.inv.length, recovered.bagCap + 1);
assert.deepEqual(migrate(structuredClone(recovered)), recovered, "the overflow recovery neither duplicates the rune nor buys a bag upgrade");

const rt = S.maps[p.map];
const rarities = new Set();
const foundSets = new Set();
const enemy = newMob(S, "boss", null, null);
for (let i = 0; i < 1000; i++) {
  rt.drops.length = 0;
  lootFor(S, rt, enemy, p);
  for (const d of rt.drops) {
    const r = D.runes[d.it];
    if (!r) continue;
    rarities.add(r.q);
    if (r.set) foundSets.add(r.set);
  }
}
assert.deepEqual([...rarities].sort(), [1, 2, 3, 4]);
assert.equal(foundSets.size, 15, "all rune sets occur in real drops");
console.log("rune sockets: caps, payments, rune drops, equipped bonuses, priority and old sheets");
