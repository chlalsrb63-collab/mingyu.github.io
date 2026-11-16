// Item level (il, shown 1–200), the wear rule il − 10, the affix lines of each rarity and the 유니크 (rarity 5):
// the rules of owner's spec 2026-11-16 (docs/systems/loot-and-economy.md). node tests/itemlevel.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ITEMS, MOBS, AFFIX, AFFIX_MUL, RARITY_AFFIX, UNIQ_P, IL_RANK, IL_GAP, G_REQ, GEAR, WK_ID, plain, rollGear, rollRarity, lootFor, gearIl, gearReq, gearName, gearFull, sellPrice, pickUp, shownLv, migrate, sortSlots, junk, mapOfS, LEGEND, SETS, gearBonus, countItem, stats, chainBlow, newMob };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, D = L.defs();
const VERBOSE = process.argv.includes("-v");
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b} ± ${eps}`);

// one line's value against what its range gives at `ilvl` (1.0 = the middle of the normal range)
const rel = ([k, v], ilvl) => { const a = X.AFFIX.find((x) => x[0] === k); return v / ((a[3] + a[4]) / 2 + a[5] * ilvl); };
const IDS = ["w_warrior_3", "w_bow_4", "h_2", "a_4", "g_2", "b_3", "r_3", "n_4", "w_mage_5", "a_6"];
const roll = (box, q, i, ilvl = 30) => X.rollGear(box, IDS[i % IDS.length], q, ilvl);

// ── the contract the client reads: rarity names, the gap, the power words; a 유니크 has no words of its own (owner 2026-11-16)
{
  assert.deepEqual(D.rarity, ["일반", "마법", "희귀", "전설", "세트", "유니크"]);
  assert.equal(D.ilGap, 10);
  assert.equal(D.uniq, undefined, "no defs.uniq: no suffix words");
  assert.ok(!/\bUNIQ(_MUL)?\b/.test(src),"the suffix table and its multiplier are gone from the rules");
  assert.deepEqual(Object.keys(D.legend), Object.keys(X.LEGEND), "the power words come from defs.legend");
  assert.deepEqual(X.RARITY_AFFIX[5], [4, 4]); assert.ok(X.AFFIX_MUL[5] > X.AFFIX_MUL[3], "a 유니크's lines are stronger than a 전설's");
}

// ── affix lines by rarity: exactly 2 / 3 / 4 / 4 (유니크 = 전설's power + stronger lines), the strength of each
{
  const box = { seed: 424242 };
  const N = 1200, by = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (let i = 0; i < N; i++) for (const q of [1, 2, 3, 4, 5]) by[q].push(roll(box, q, i));
  assert.ok(by[1].every((g) => g.q === 1 && g.af.length === 2), "마법: exactly 2");
  assert.ok(by[2].every((g) => g.q === 2 && g.af.length === 3), "희귀: exactly 3");
  assert.ok(by[3].every((g) => g.q === 3 && g.af.length === 4 && X.LEGEND[g.lg]), "전설: exactly 4 and its power");
  assert.ok(by[5].every((g) => g.q === 5 && g.af.length === 4 && X.LEGEND[g.lg] && !g.set), "유니크: 4 lines and a legendary's power, every time");
  // 세트 is unchanged (2–3 lines, a set piece; a base with no set falls back to 전설)
  assert.deepEqual([...new Set(by[4].filter((g) => g.q === 4).map((g) => g.af.length))].sort(), [2, 3]);
  assert.ok(by[4].some((g) => g.q === 4 && g.set), "some set pieces");
  for (const q of [1, 2, 3, 4, 5]) for (const g of by[q]) {
    assert.equal(new Set(g.af.map((a) => a[0])).size, g.af.length, `no key twice (q${q})`);
    assert.ok(g.af.every(([, v]) => Number.isInteger(v) && v >= 1));
  }
  // strength of an ordinary line: 마법 ×0.85, 희귀 ×1.0, 전설 / 세트 ×1.3, 유니크 ×1.45
  const lines = (q, from = 0) => by[q].flatMap((g) => g.af.slice(from).map((a) => rel(a, 30)));
  near(mean(lines(1)), 0.85, 0.05, "마법 is weak");
  near(mean(lines(2)), 1.0, 0.05, "희귀 as rolled");
  near(mean(lines(3)), 1.3, 0.06, "전설 ×1.3");
  near(mean(lines(5)), 1.45, 0.07, "a 유니크's four lines are all ×1.45");
  // no "own" lines, no suffix: a 유니크 is plain lines + the power, shaped like a 전설 (no `un`, no set)
  assert.ok(by[5].every((g) => g.un === undefined && !("un" in g)), "no un field");
  // owner 2026-11-16: a unique = a legendary's power + ~10–15 % stronger lines than a legendary of the same level
  const tot = (q) => mean(by[q].map((g) => g.af.reduce((s, a) => s + rel(a, 30), 0)));
  assert.ok(tot(5) > tot(3) * 1.10 && tot(5) < tot(3) * 1.15, `unique ${tot(5).toFixed(3)} vs legendary ${tot(3).toFixed(3)} = ${(tot(5) / tot(3)).toFixed(3)}`);
  assert.ok(tot(3) > tot(2) && tot(2) > tot(1));
  // every power is drawn, and the sockets follow the rarity as for the others (never fewer than a legendary's)
  // (the pools follow the item type now, 51-prefix.js: the eight first powers are all drawn, along with the live ones that came later)
  const drawn = new Set(by[5].map((g) => g.lg));
  for (const k of ["chain", "nova", "haste", "giant", "echo", "greed", "thorn", "feast"]) assert.ok(drawn.has(k), `${k} is drawn`);
  assert.ok(by[5].filter((g) => !["r_3", "n_4"].includes(g.id)).every((g) => g.sk >= 1));
  if (VERBOSE) console.log("line strength", [1, 2, 3, 5].map((q) => [q, tot(q).toFixed(3)]), "unique / legendary", (tot(5) / tot(3)).toFixed(3));
}

// ── names: `[the power's LEGEND word] item` (no suffix, like a 전설), the rarity first and the level last in the long form
{
  const g = X.rollGear({ seed: 9 }, "w_warrior_3", 5, 30);
  const pre = X.LEGEND[g.lg][0], base = X.ITEMS.w_warrior_3.name;
  assert.equal(X.gearName(g), `${pre} ${base}`);
  g.enh = 2;
  assert.equal(X.gearName(g), `+2 ${pre} ${base}`);
  assert.equal(X.gearFull(g), `유니크 ${pre} ${base} +2`);
  // the others read as before
  assert.equal(X.gearName({ ...X.plain("h_1"), q: 3, lg: "haste", enh: 1 }), `+1 ${X.LEGEND.haste[0]} ${X.ITEMS.h_1.name}`);
  assert.equal(X.gearFull({ ...X.plain("h_1"), q: 2, af: [["critd", 9]] }), `희귀 ${X.ITEMS.h_1.name}`);
}

// ── the 유니크 chance: very low, scaled by rank and MF; the other rarities keep their own odds
{
  const count = (rank, mf, n, seed) => { const box = { seed }, c = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < n; i++) c[X.rollRarity(box, rank, mf)]++; return c; };
  const a = count(0, 0, 400000, 1);
  assert.ok(a[5] >= 300 && a[5] <= 520, `ordinary monster ≈ 0.1 %: ${a[5]} / 400000`);
  assert.ok(a[3] + a[4] >= 4500 && a[3] + a[4] <= 5100, `전설/세트 stay ≈ 1.2 %: ${a[3] + a[4]}`);
  assert.ok(a[2] >= 34800 && a[2] <= 37200, `희귀 stays ≈ 9 %: ${a[2]}`);
  assert.ok(a[1] >= 142000 && a[1] <= 146000, `마법 stays ≈ 36 %: ${a[1]}`);
  const e = count(1, 0, 100000, 2), b = count(2, 0, 50000, 3);
  assert.ok(e[5] >= 300 && e[5] <= 520, `elite ≈ 0.4 %: ${e[5]}`);
  assert.ok(b[5] >= 420 && b[5] <= 580, `boss ≈ 1 %: ${b[5]}`);
  assert.ok(e[5] / 100000 > a[5] / 400000 * 2 && b[5] / 50000 > e[5] / 100000 * 1.5, "higher for elites and bosses");
  const m = count(0, 100, 200000, 4);
  assert.ok(m[5] >= 320 && m[5] <= 480, `MF 100 doubles it: ${m[5]} / 200000`);
  // against the 전설/세트 chance it is a twelfth to a twentieth at every rank
  for (const r of [0, 1, 2]) { const q = [0.012, 0.07, 0.2][r] / X.UNIQ_P[r]; assert.ok(q >= 11 && q <= 21, `rank ${r}: ${q}`); }
}

// ── item level: the monster's shown level + the rank bonus, floored at the tier's own level, capped at 200
{
  assert.deepEqual(X.IL_RANK, [0, 4, 8]);
  const S = L.setup();
  S.now = 1000;
  L.addPlayer(S, "a@s1", L.newChar("사냥꾼", []));
  const p = S.players["a@s1"], rt = S.maps[p.map];
  const check = (k, el, ranked) => {
    const d = X.MOBS[k], rank = d.boss ? 2 : d.chest ? 1 : el, seen = new Set();
    let n = 0;
    for (let i = 0; i < 20000 && n < 40; i++) {
      rt.drops.length = 0;
      X.lootFor(S, rt, { k, el, x: p.x, y: p.y }, p);
      for (const dr of rt.drops) if (dr.g) {
        n++;
        const want = Math.min(200, Math.max(X.shownLv(d.lv) + X.IL_RANK[rank], X.G_REQ[X.ITEMS[dr.g.id].tier - 1]));
        assert.equal(dr.g.il, want, `${k} el${el}: ${dr.g.id} il`);
        seen.add(dr.g.il);
      }
    }
    assert.ok(n >= 40, `${k}: gear found (${n})`);
    return seen;
  };
  const low = check("twinhare", 0), mid = check("splitboar", 0), high = check("rimewalrus", 0);
  assert.ok([...low].every((il) => il <= 10), `Lv.1 monster: ${[...low]}`);
  assert.ok(mid.has(X.shownLv(X.MOBS.splitboar.lv)), "the shown level of a tier-8 monster is 29");
  assert.ok(high.has(197), "tier 50 → 197");
  // an elite is one monster level (4) above the ordinary, a boss two, and nothing passes 200
  const el = check("splitboar", 1), bo = check("bloomwhale", 0);
  assert.ok(el.has(X.shownLv(8) + 4), [...el].join());
  assert.equal(Math.max(...bo), 200, "a tier-50 boss caps at 200");
  assert.ok(Math.min(...bo) >= 197 - 0);
  // the table itself
  assert.equal(X.rollGear({ seed: 1 }, "h_2", 1, 12).il, 45, "crafts: shown 4·12 − 3");
  assert.equal(X.rollGear({ seed: 1 }, "h_2", 1, 12, 2).il, 53, "+ a boss's 8");
  assert.equal(X.rollGear({ seed: 1 }, "h_6", 1, 50, 2).il, 200, "capped");
  assert.equal(X.rollGear({ seed: 1 }, "h_4", 1, 1).il, 101, "never below its base's own level");
  assert.ok(Array.from({ length: 200 }, (_, i) => X.rollGear({ seed: i }, "h_2", 1, 1 + (i % 50)).il).every((il) => il >= 1 && il <= 200));
}

// ── what a piece asks for: il − 10 (min 1); a piece without il asks what its base always did
{
  // legacy: every gear base asks exactly its old req, and a plain piece is stamped with the derived il
  const gearIds = Object.keys(X.ITEMS).filter((id) => ["weapon", "helm", "armor", "gloves", "boots", "ring", "amulet"].includes(X.ITEMS[id].type));
  assert.ok(gearIds.length > 100);
  for (const id of gearIds) {
    const req = X.ITEMS[id].req;
    assert.equal(X.gearReq({ id }), req, `${id} still asks Lv.${req}`);
    assert.equal(X.gearIl({ id }), req > 1 ? req + 10 : 1);
    assert.equal(X.plain(id).il, X.gearIl({ id }));
  }
  // the raids' own set pieces are whole rows (they were empty stubs: copied before the gear table existed)
  for (const [id, type, tier, set] of [["veil_h", "helm", 4, "nightveil"], ["veil_a", "armor", 4, "nightveil"], ["veil_r", "ring", 4, "nightveil"], ["veil_n", "amulet", 4, "nightveil"],
    ["bloom_h", "helm", 5, "bloomgrave"], ["bloom_a", "armor", 5, "bloomgrave"], ["bloom_r", "ring", 5, "bloomgrave"], ["bloom_n", "amulet", 5, "bloomgrave"]]) {
    const it = X.ITEMS[id];
    assert.ok(it.type === type && it.tier === tier && it.set === set && it.base && it.req === X.G_REQ[tier - 1], id);
    assert.ok(gearIds.includes(id) && X.gearReq(X.rollGear({ seed: 4 }, id, 4, 38)) === 139, `${id}: a drop at tier 38 asks Lv.139`);
  }
  assert.equal(X.gearIl({ id: "a_3", il: 0 }), 71, "il 0 = not set");
  // an entry with il: il − 10, whatever its base says
  assert.equal(X.gearReq({ ...X.plain("a_5"), il: 100 }), 90);
  assert.equal(X.gearReq({ ...X.plain("a_1"), il: 5 }), 1);
  assert.equal(X.gearReq({ ...X.plain("a_1"), il: 11 }), 1);
  assert.equal(X.gearReq({ ...X.plain("a_1"), il: 12 }), 2);
  assert.equal(X.gearReq({ ...X.plain("a_6"), il: 200 }), 190);

  const S = L.setup();
  let now = 1000;
  S.now = now;
  L.addPlayer(S, "a@s1", L.newChar("착용", []));
  const p = S.players["a@s1"], ch = p.ch;
  const wear = (entry, lvl) => { ch.lvl = lvl; ch.inv = [entry]; ch.eq.helm = null; S.now = now; const v = L.validateAction(S, "a@s1", { t: "eq", s: 0 }); if (v.ok) L.applyAction(S, "a@s1", { t: "eq", s: 0 }); return v; };
  const h = (il) => ({ ...X.plain("h_3"), il });
  let v = wear(h(50), 39); assert.equal(v.ok, false); assert.equal(v.error, "레벨 40부터 착용할 수 있습니다", "il 50 → Lv.40");
  assert.equal(wear(h(50), 40).ok, true); assert.ok(ch.eq.helm && ch.eq.helm.il === 50);
  assert.equal(wear(h(50), 41).ok, true);
  assert.equal(wear(h(11), 1).ok, true, "il ≤ 11 can be worn at Lv.1 (min 1)");
  assert.equal(wear(h(5), 1).ok, true);
  assert.equal(wear(h(12), 1).error, "레벨 2부터 착용할 수 있습니다");
  assert.equal(wear(h(200), 189).ok, false); assert.equal(wear(h(200), 190).ok, true);
  // il replaces the base's req: a tier-5 body with a low il (a low drop) is worn at that level, not at 149
  assert.equal(wear({ ...X.plain("h_5"), il: 100 }, 89).ok, false); assert.equal(wear({ ...X.plain("h_5"), il: 100 }, 90).ok, true);
  // legacy entries (no il at all, as a hand-made old sheet and the shop's stock): the old rule, to the level
  const raw = (id) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [] });
  assert.equal(wear(raw("h_3"), 60).error, "레벨 61부터 착용할 수 있습니다");
  assert.equal(wear(raw("h_3"), 61).ok, true);
  assert.equal(wear(raw("h_1"), 1).ok, true);
  assert.equal(wear(raw("h_6"), 180).ok, false); assert.equal(wear(raw("h_6"), 181).ok, true);
  // the unique and its kin follow the same rule
  const u = X.rollGear({ seed: 3 }, "h_3", 5, 20); u.il = 70;
  assert.equal(wear(u, 59).ok, false); assert.equal(wear(u, 60).ok, true);
}

// ── an old sheet loads as it was: no il, the stored lines kept, the same wear levels; a stored unique survives
{
  const raw = (id, o = {}) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [], ...o });
  const old = L.newChar("옛사람", []);
  old.v = 25; old.lvl = 70;
  old.eq.weapon = raw("w_warrior_3", { q: 2, af: [["atk", 4], ["crit", 3], ["hp", 15]] });
  old.eq.armor = raw("a_2", { q: 1, af: [["def", 2]] });                                  // an old 마법 with one line
  const uq = X.rollGear({ seed: 77 }, "h_3", 5, 30);
  old.eq.helm = uq;
  old.inv = [raw("g_3", { q: 3, lg: "chain", af: [["atk", 5], ["crit", 4], ["ls", 2], ["spd", 5]] }), raw("b_1"),
    raw("r_2", { q: 5, un: [99, 0], af: [["atk", 9]] }), raw("n_2", { q: 9, af: [["hp", 9]] }), raw("h_2", { q: 2, il: 500 }), raw("h_4", { il: -3 }), { id: "hp_s", n: 3 },
    // the first 유니크 sheets: un = [prefix, suffix], no power (prefix 1 = 불꽃을 두른 → atk; suffix 4 = 불사의 맹약 → hp)
    raw("a_3", { q: 5, il: 80, un: [1, 4], af: [["atk", 21], ["hp", 70], ["crit", 4], ["def", 9]] }),
    raw("a_3", { q: 5, un: [3], af: [["hp", 9]] }),                                         // [8]: an un [suffix] but no power: nothing to derive one from
    raw("a_3", { q: 5, un: [3], lg: "haste", af: [["hp", 9]] }),                           // [9]: the shape of the second 유니크 sheets: lg kept, un dropped
    raw("a_3", { q: 5, un: [20], lg: "haste" }), raw("a_3", { q: 5, un: [0], lg: "nope" }),    // [10], [11]: a stray suffix is ignored, a bad power is no power
    raw("a_3", { q: 5, lg: "nova", af: [["atkp", 12]] })];                                  // [12]: the current shape, as it is
  old.wh = { items: [{ ...uq, il: 88 }, raw("w_bow_4", { q: 4, set: "rift" })], gold: 0 };
  const eqBefore = JSON.stringify(old.eq.weapon.af), tail = JSON.stringify(old.eq.armor.af);
  const ch = X.migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(JSON.stringify(ch.eq.weapon.af), eqBefore, "the old rare keeps its lines"); assert.equal(ch.eq.weapon.il, 71);
  assert.equal(JSON.stringify(ch.eq.armor.af), tail, "so does the old magic one (one line)"); assert.equal(ch.eq.armor.il, 39);
  assert.equal(ch.inv[0].af.length, 4); assert.equal(ch.inv[0].il, 71); assert.equal(ch.inv[0].lg, "chain");
  assert.equal(ch.inv[1].il, 1, "a tier-1 piece");
  assert.deepEqual([ch.eq.weapon, ch.eq.armor, ...ch.inv.slice(0, 2)].map(X.gearReq), [61, 29, 61, 1], "the wear levels did not move");
  assert.equal(ch.eq.helm.q, 5); assert.equal(ch.eq.helm.lg, uq.lg); assert.equal(ch.eq.helm.un, undefined); assert.equal(ch.eq.helm.il, uq.il);
  assert.equal(JSON.stringify(ch.eq.helm.af), JSON.stringify(uq.af), "a unique's lines come back as they were");
  assert.equal(ch.inv[2].q, 2, "a q5 with no power to keep or derive is no unique"); assert.equal(ch.inv[2].un, undefined); assert.equal(ch.inv[2].lg, undefined);
  // the first-shape unique loads valid: the prefix index picks a power, un is dropped, the lines and the level are as they were
  assert.equal(ch.inv[7].q, 5); assert.equal(ch.inv[7].lg, "giant"); assert.equal(ch.inv[7].un, undefined); assert.equal(ch.inv[7].il, 80);
  assert.equal(JSON.stringify(ch.inv[7].af), JSON.stringify([["atk", 21], ["hp", 70], ["crit", 4], ["def", 9]]), "its lines are not touched");
  assert.equal(X.gearName(ch.inv[7]), `${X.LEGEND.giant[0]} ${X.ITEMS.a_3.name}`, "and it is named by its power only");
  assert.equal(ch.inv[7].lg === "giant" && X.gearBonus({ ...ch, eq: { armor: ch.inv[7] } }).lg.giant, 1, "the power it was given works");
  for (let i = 0; i < 10; i++) {   // every old prefix index lands on a real power
    const m = X.migrate({ ...JSON.parse(JSON.stringify(old)), eq: {}, inv: [raw("a_3", { q: 5, un: [i, 0], af: [["atk", 9]] })] });
    assert.ok(m.inv[0].q === 5 && X.LEGEND[m.inv[0].lg] && m.inv[0].un === undefined, `old prefix ${i}`);
  }
  assert.equal(ch.inv[8].q, 2, "an un [suffix] with no power is no unique"); assert.equal(ch.inv[8].lg, undefined); assert.equal(ch.inv[8].un, undefined);
  assert.equal(ch.inv[9].q, 5); assert.equal(ch.inv[9].lg, "haste"); assert.equal(ch.inv[9].un, undefined, "the second sheets' un is dropped, the power kept");
  assert.equal(ch.inv[10].q, 5); assert.equal(ch.inv[10].lg, "haste"); assert.equal(ch.inv[10].un, undefined, "a stray suffix index changes nothing");
  assert.equal(ch.inv[11].q, 2); assert.equal(ch.inv[11].lg, undefined, "a bad power is no power");
  assert.equal(ch.inv[12].q, 5); assert.equal(JSON.stringify(ch.inv[12]), JSON.stringify({ id: "a_3", q: 5, enh: 0, af: [["atkp", 12]], sk: 0, ru: [], il: ch.inv[12].il, lg: "nova" }), "the current shape loads as it is");
  assert.equal(ch.inv[3].q, 2, "q 9 is cut to the top (5) and, with no power, is no unique");
  assert.equal(ch.inv[4].il, 200, "an il is clamped");
  assert.equal(ch.inv[5].il, 111, "a negative il is derived (tier 4 → 101 + 10)");
  assert.deepEqual(ch.inv[6], { id: "hp_s", n: 3 });
  assert.equal(ch.wh.items[0].q, 5); assert.equal(ch.wh.items[0].il, 88); assert.equal(ch.wh.items[0].lg, uq.lg, "the warehouse keeps a unique");
  assert.equal(ch.wh.items[1].set, "rift"); assert.equal(ch.wh.items[1].il, 111);
  assert.equal(ch.v, 26, "no new sheet version: a missing il is derived");
  // a second pass changes nothing
  assert.equal(JSON.stringify(X.migrate(JSON.parse(JSON.stringify(ch)))), JSON.stringify(ch));
  // and it plays: the old sheet joins, wears and sorts
  const S = L.setup();
  S.now = 1000;
  L.addPlayer(S, "o@s1", JSON.parse(JSON.stringify(old)));
  assert.equal(S.players["o@s1"].ch.eq.weapon.il, 71);
  assert.equal(S.players["o@s1"].ch.eq.helm.q, 5);
}

// ── a 유니크 is a piece like any other: found, shown, sold, socketed, re-rolled, enhanced, stored, traded, saved
{
  const S = L.setup();
  let now = 1000;
  S.now = now;
  L.addPlayer(S, "a@s1", L.newChar("가람", []));
  L.addPlayer(S, "b@s1", L.newChar("나래", []));
  const p = S.players["a@s1"], ch = p.ch, pb = S.players["b@s1"];
  const act = (pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
  const near = (pl, role) => { const n = X.mapOfS(S, pl.map).npcs.find((o) => o.role === role); pl.x = n.x * 16 + 8; pl.y = n.y * 16 + 12; pl.mvAt = now; };
  const uniq = (id = "w_warrior_3", seed = 5) => { const g = X.rollGear({ seed }, id, 5, 30); return g; };
  ch.lvl = 200; ch.gold = 1e7;

  // found: the whole server hears of it (like a legendary), it counts as a legend find, and it is a drop of q 5
  {
    const g = uniq();
    const leg0 = ch.cnt.leg;
    S.chat.length = 0;
    assert.ok(X.pickUp(S, p, { g, it: g.id, n: 1, q: 5 }));
    const said = S.chat.at(-1).m;
    assert.ok(said.includes(`${ch.name}님이 유니크 장비 [${X.gearName(g)}]`), said);
    assert.equal(ch.cnt.leg, leg0 + 1);
    ch.inv.pop();
  }
  // the price rises with the rarity (the same ×(1 + 0.8·q) as the rest), it is no junk, and it breaks into the most stones
  {
    const g = uniq("h_3"), base = X.sellPrice(X.plain("h_3"));
    assert.equal(X.sellPrice(g), Math.floor(X.ITEMS.h_3.price * 0.05 * (1 + 0.8 * 5)));
    assert.ok(X.sellPrice(g) > X.sellPrice({ ...g, q: 4 }) && X.sellPrice(g) > base * 4);
    assert.equal(X.junk(g), false);
    near(p, "smith");
    ch.inv = [g];
    const st0 = X.countItem(ch, "stone");
    assert.ok(act("a@s1", { t: "salv", s: 0 }).ok);
    assert.equal(X.countItem(ch, "stone") - st0, 8, "8 stones for a 유니크");
  }
  // sockets, the whetstone, enhancement (on a worn piece)
  {
    const g = uniq("w_warrior_3", 6);
    g.sk = 2; ch.eq.weapon = g;
    ch.inv = [{ id: "ru_ign", n: 1 }, { id: "whet", n: 30 }, { id: "stone", n: 99 }];
    const rr = act("a@s1", { t: "rune", s: 0, k: "weapon", i: 0 });
    assert.ok(rr.ok, rr.error);
    assert.equal(g.ru[0], "ign", "a rune sits in a unique's socket");
    const lg0 = g.lg, lines0 = JSON.stringify(g.af);
    for (let i = 0; i < 25; i++) {
      const r = act("a@s1", { t: "use", id: "whet", k: "weapon" });
      assert.ok(r.ok, r.error);
      assert.equal(g.af.length, 4); assert.equal(new Set(g.af.map((a) => a[0])).size, 4);
    }
    assert.equal(g.lg, lg0, "the power stays"); assert.notEqual(JSON.stringify(g.af), lines0, "the whetstone re-rolls the weakest of the four plain lines");
    near(p, "smith");
    p.toast.length = 0;
    assert.ok(act("a@s1", { t: "enh", k: "weapon" }).ok);
    assert.equal(g.enh, 1, "+1 never fails");
    assert.ok(p.toast.at(-1).includes(`유니크 ${X.LEGEND[g.lg][0]} ${X.ITEMS.w_warrior_3.name} +1`), p.toast.at(-1));
  }
  // its stats count: the four lines add into the gear total
  {
    const g = uniq("a_3", 8), prev = ch.eq;
    ch.eq = { weapon: null, helm: null, armor: g, gloves: null, boots: null, ring1: null, ring2: null, amulet: null, weapon2: null };
    const b1 = X.gearBonus(ch);
    ch.eq.armor = X.plain("a_3");
    const b0 = X.gearBonus(ch);
    ch.eq = prev;
    for (const k of Object.keys(b0)) if (k !== "lg") assert.equal(Math.round((b1[k] - b0[k]) * 1e6) / 1e6, g.af.filter((a) => a[0] === k).reduce((s, a) => s + a[1], 0), `${k}: the four lines add`);
    assert.deepEqual(b1.lg, { [g.lg]: 1 }, "and its legendary power comes with them");
    if (g.lg === "greed") assert.equal(b1.gold - b0.gold, g.af.filter((a) => a[0] === "gold").reduce((s, a) => s + a[1], 0) + 60);
  }
  // its power works like a legendary's: every power reaches the stats the combat code reads (`stats(p).lg`), the same as a q 3 piece with it
  {
    const prev = ch.eq;
    for (const key of Object.keys(X.LEGEND)) {
      const g = X.rollGear({ seed: 100 + key.length }, "a_3", 5, 30); g.lg = key;
      ch.eq = { ...prev, weapon: null, armor: g, helm: null };
      p.stc = null;
      const u = X.stats(p).lg;
      ch.eq.armor = { ...X.plain("a_3"), q: 3, lg: key };
      p.stc = null;
      assert.deepEqual(u, X.stats(p).lg, `${key}: the same power as a legendary's`);
      assert.equal(u[key], 1);
    }
    // 뇌명의 in a fight: the chain leaps to the monsters near a struck one, exactly through the legendary's code path
    ch.eq = { ...prev, weapon: null, armor: Object.assign(X.rollGear({ seed: 5 }, "a_3", 5, 30), { lg: "chain" }), helm: null }; p.stc = null;
    const rt = L.runtime(S, p.map);
    const [m0, m1, m2] = [0, 1, 2].map((i) => Object.assign(X.newMob(S, "twinhare", [0, 0, 0, 0]), { x: 100 + i * 20, y: 100, hp: 1e6 }));
    rt.mobs.push(m0, m1, m2);
    const hp0 = [m1.hp, m2.hp];
    let leaps = 0;
    for (let i = 0; i < 200; i++) { const n = rt.ev.length; X.chainBlow(S, rt, p, X.stats(p), m0, m0.x, m0.y); leaps += rt.ev.slice(n).filter((e) => e[0] === "z").length; }
    assert.ok(leaps > 20 && m1.hp < hp0[0] && m2.hp < hp0[1], `chain lightning struck from a unique: ${leaps} leaps`);
    rt.mobs.splice(rt.mobs.indexOf(m0), 3);
    ch.eq = prev; p.stc = null;
  }
  // the wire: the entry carries q, il, lg and un, whole
  {
    const g = uniq("w_warrior_3", 11);
    ch.eq.weapon = g; p.dirty = true; p.stc = null;
    now += 100; L.tick(S, now);
    const v = JSON.parse(JSON.stringify(L.viewFor(S, "a@s1")));
    L.endTick(S);
    const w = v.self.eq.weapon;
    assert.equal(w.q, 5); assert.equal(w.il, g.il); assert.deepEqual(w.un, g.un); assert.deepEqual(w.af, g.af); assert.equal(w.lg, g.lg);
    assert.ok(v.self.lg.includes(g.lg), "the power is in the self view's list, like a legendary's");
    assert.ok(D.legend[w.lg][0] && D.legend[w.lg][1], "defs.legend names it");
    assert.equal(D.items[w.id].req, X.ITEMS.w_warrior_3.req, "defs still carry each base's req");
  }
  // the warehouse and the bag move the very piece
  {
    const g = uniq("h_3", 12);
    ch.inv = [g];
    near(p, "bank");
    assert.ok(act("a@s1", { t: "wh", a: "put", s: 0 }).ok);
    assert.equal(ch.wh.items[0], g);
    assert.ok(act("a@s1", { t: "wh", a: "take", s: 0 }).ok);
    assert.equal(ch.inv[0], g);
  }
  // a trade hands it over whole (il, un, lines)
  {
    const g = uniq("h_3", 13), snap = JSON.stringify(g);
    ch.inv = [g]; pb.ch.inv = [];
    pb.x = p.x; pb.y = p.y; pb.map = p.map;
    now += 20000;
    const ok = (pid, a) => { const v = act(pid, a); assert.ok(v.ok, `${pid} ${JSON.stringify(a)}: ${v.error}`); };
    ok("a@s1", { t: "sx", a: "ask", k: "trade", e: pb.eid });
    ok("b@s1", { t: "sx", a: "yes" });
    ok("a@s1", { t: "sx", a: "put", s: 0, n: 1 });
    ok("a@s1", { t: "sx", a: "lock", v: 1 }); ok("b@s1", { t: "sx", a: "lock", v: 1 });
    ok("a@s1", { t: "sx", a: "go" }); ok("b@s1", { t: "sx", a: "go" });
    assert.equal(pb.ch.inv.length, 1);
    assert.equal(JSON.stringify(pb.ch.inv[0]), snap, "the same piece, every field");
  }
  // saved and loaded again
  {
    const g = uniq("n_3", 14);
    ch.eq.amulet = g;
    const saved = JSON.parse(JSON.stringify(L.exportChar(S, "a@s1")));
    assert.equal(JSON.stringify(saved.eq.amulet), JSON.stringify(g));
    const back = X.migrate(JSON.parse(JSON.stringify(saved)));
    assert.equal(JSON.stringify(back.eq.amulet), JSON.stringify(g));
  }
}

// ── sorting the bag: the higher item level of the same kind and rarity first
{
  const a = { ...X.plain("h_3"), il: 40 }, b = { ...X.plain("h_3"), il: 90 }, c = { ...X.plain("h_3") };
  assert.deepEqual(X.sortSlots([a, c, b]).map((g) => g.il), [90, 71, 40]);
}
console.log("itemlevel ok");
