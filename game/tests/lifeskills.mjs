// Headless test of the life skills' core (docs/design/life-and-coop.md B, phase L1): the curve's golden values,
// levelling (several at once, the event and toast, the cap), the bonus formula of B.2, each map's grade, what
// bites by grade and level (shares, 대성공, experience, the keep threshold, quicker bites), cooking (burn
// threshold by level, two portions, experience, stale work, the `cook` alias of the recipe path), materials,
// the town's new NPC roles and the wire. node tests/lifeskills.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { gainLife, lifeOdds, lifeTime, lifeGrade, lifeXp, gradeOfMap, fishLand, fishWait, cookDish, cookBurnt, lifeSheetClean, RECIPES, FISH_G, RXP, GRADE_LV, NPC_ROLES, NPC_MAP, ITEMS };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, D = L.defs(), T = 16;
const VERBOSE = process.argv.includes("-v");
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b} ± ${eps}`);

const S = L.setup();
let now = 1000;
S.now = now;
L.addPlayer(S, "a", L.newChar("어부", []));
const p = S.players.a, ch = p.ch;
const to = (id) => { L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; };
const step = () => { now += 100; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, "a"))); L.endTick(S); return v; };
const act = (a) => { S.now = now; const v = L.validateAction(S, "a", a); if (v.ok) L.applyAction(S, "a", a); return v; };
const count = (id) => ch.inv.filter((s) => s.id === id).reduce((n, s) => n + s.n, 0);

// ── the curve: lifeNeed(L) = 10·L² + 40
{
  const need = D.life.need;
  assert.equal(need.length, 50);
  assert.deepEqual([1, 10, 20, 30, 40, 49].map((lv) => need[lv - 1]), [50, 1040, 4040, 9040, 16040, 24050]);
  assert.deepEqual(D.life.keys, ["fish", "cook", "gather", "craft", "alch", "deliver"]);
  assert.deepEqual(D.life.names, ["낚시", "요리", "채집", "제작", "연금", "배달"]);
  assert.deepEqual(D.life.grades, [1, 10, 20, 30, 40]);
  assert.deepEqual([1, 9, 10, 19, 20, 30, 39, 40, 50].map(X.lifeGrade), [1, 1, 2, 2, 3, 4, 4, 5, 5]);
}

// ── levelling: several levels at once, one event and toast each, the unlock named, the cap
{
  ch.life.cook = { lv: 1, xp: 0 };
  p.toast.length = 0;
  assert.equal(X.gainLife(S, p, "cook", 50 + 80 + 130 + 5), 3);
  assert.deepEqual(ch.life.cook, { lv: 4, xp: 5 });
  const v = step();
  assert.deepEqual((v.ev || []).filter((e) => e[0] === "lv2"), [["lv2", p.eid, 1, 2], ["lv2", p.eid, 1, 3], ["lv2", p.eid, 1, 4]]);
  assert.deepEqual(v.self.life[1], [4, 5, 200], "the wire follows: [lv, xp, need]");
  ch.life.cook = { lv: 9, xp: 1039 };
  p.toast.length = 0;
  X.gainLife(S, p, "cook", 1);
  assert.equal(ch.life.cook.lv, 10);
  assert.ok(p.toast.some((m) => m.includes("[요리] 레벨 10") && m.includes("2등급")), p.toast.join(" / "));
  ch.life.cook = { lv: 49, xp: 0 };
  X.gainLife(S, p, "cook", 1e9);
  assert.deepEqual(ch.life.cook, { lv: 50, xp: 0 }, "50 is the cap, nothing carries over");
  assert.equal(X.gainLife(S, p, "cook", 100), 0);
  assert.deepEqual(ch.life.cook, { lv: 50, xp: 0 });
  assert.equal(X.gainLife(S, p, "sorcery", 100), 0, "no such skill");
  // stale work (a grade unlocked 20+ levels below) earns a quarter
  assert.deepEqual([X.lifeXp(20, 1, 8), X.lifeXp(21, 1, 8), X.lifeXp(50, 40, 50), X.lifeXp(50, 1, 1)], [8, 2, 50, 1]);
  step();
}

// ── the bonus formula (B.2): success min(100, 60 + 1.2d) %, 대성공 min(60, 3 + 1.2d) %, a score shifts both ±10 %p
{
  assert.deepEqual(X.lifeOdds(20, 20), [60, 3]);
  assert.deepEqual(X.lifeOdds(40, 20), [84, 27]);
  assert.deepEqual(X.lifeOdds(50, 1), [100, 60]);
  assert.deepEqual(X.lifeOdds(10, 20), [60, 3], "below the unlock level counts as d = 0");
  assert.deepEqual(X.lifeOdds(20, 20, 100), [70, 13]);
  assert.deepEqual(X.lifeOdds(20, 20, 0), [50, 0]);
  assert.deepEqual(X.lifeOdds(20, 20, 50, 15), [60, 18], "a timing tap adds to the 대성공 only");
  near(X.lifeTime(1), 0.992, 1e-9, "time at 1"); near(X.lifeTime(50), 0.6, 1e-9, "time at 50: −40 %");
}

// ── grades of the world (B.3): meadow 1 · forest, crypt 2 · city, sewer 3 · cave, abyss 4 · 단풍 왕도 5
{
  const want = { town: 1, willow: 1, meadow: 1, forest: 2, crypt: 2, city: 3, sewer: 3, cave: 4, abyss: 4, maple: 5 };
  for (const [id, g] of Object.entries(want)) if (D.life.mapGrade[id] !== undefined) assert.equal(D.life.mapGrade[id], g, id);
  for (const id of ["meadow", "forest", "city", "cave", "maple"]) assert.equal(D.life.mapGrade[id], want[id], id);
  assert.equal(X.gradeOfMap({ grade: 4, band: [1, 3] }), 4, "an editor map's own grade wins");
  assert.equal(X.gradeOfMap({ band: [24, 30] }), 4);
  assert.equal(X.gradeOfMap({}), 1);
  assert.deepEqual(X.FISH_G.map((id) => X.ITEMS[id].grade), [1, 2, 3, 4, 5]);
}

// ── what bites: fish of grade ≤ min(map grade, the angler's grade); 황금 잉어 anywhere; shares; 대성공; XP
const N = 4000;
function fishRun(map, lv, score) {
  to(map);
  const got = {};
  let two = 0;
  for (let i = 0; i < N; i++) {
    ch.life.fish = { lv, xp: 0 };
    const r = X.fishLand(S, p, score);
    got[r.id] = (got[r.id] || 0) + 1;
    if (r.n === 2) two++;
  }
  S.maps[map].ev.length = 0; p.toast.length = 0;
  const share = Object.fromEntries(Object.entries(got).map(([k, n]) => [k, n / N]));
  if (VERBOSE) console.log(map.padEnd(7), "Lv", String(lv).padStart(2), "s", score, JSON.stringify(share), "two", (two / N).toFixed(3));
  return { share, two: two / N, ids: Object.keys(got).sort() };
}
{
  const t0 = Date.now();
  // the meadow is grade-1 water, whatever the angler's level
  assert.deepEqual(fishRun("meadow", 50, 80).ids, ["fish_l", "fish_s", "stone"]);
  // the forest is grade 2, but a beginner only lands 송사리 there; at 10 the trout bites
  assert.deepEqual(fishRun("forest", 1, 80).ids, ["fish_l", "fish_s", "stone"]);
  const f10 = fishRun("forest", 10, 80);
  assert.deepEqual(f10.ids, ["fish_l", "fish_m", "fish_s", "stone"]);
  near(f10.share.fish_m, 0.1 + 0.3 * 0.8, 0.03, "top candidate share");
  // the city at 20: 은빛 메기 on top, trout next, the rest 송사리
  const c20 = fishRun("city", 20, 80);
  assert.deepEqual(c20.ids, ["fish_c", "fish_l", "fish_m", "fish_s", "stone"]);
  near(c20.share.fish_c, 0.34, 0.03, "top"); near(c20.share.fish_m, 0.2, 0.03, "next");
  near(c20.share.fish_l, 0.01 + 0.07 * 0.64 + 0.02, 0.015, "carp"); near(c20.share.stone, 0.04, 0.015, "stone");
  assert.deepEqual(fishRun("city", 19, 80).ids, ["fish_l", "fish_m", "fish_s", "stone"], "Lv 19: grade 2 at most");
  // the cave at 50 stops at its own grade 4
  assert.deepEqual(fishRun("cave", 50, 80).ids, ["fish_c", "fish_l", "fish_m", "fish_s", "fish_v", "stone"].filter((id) => id !== "fish_m"));
  // 단풍 왕도 at 40: 황금 잉어 is the top candidate there ("common-ish")
  const m40 = fishRun("maple", 40, 80);
  assert.ok(m40.share.fish_l > 0.38, "carp in the autumn field: " + m40.share.fish_l);
  assert.ok(m40.share.fish_v > 0.15 && !m40.share.fish_c, "4등급 next, 3등급 not in the split");
  // 대성공 lands two: 3 % for a beginner at an average fight, 60 % + 10 %p for a master's perfect one
  near(fishRun("meadow", 1, 50).two, 0.03 * 0.95, 0.012, "beginner 대성공");
  // (황금 잉어 is grade 5: at 50 its 대성공 is 15 % + 10 %p)
  const m100 = fishRun("meadow", 50, 100);
  near(m100.two, 0.7 * m100.share.fish_s + 0.25 * m100.share.fish_l, 0.03, "master 대성공 on 송사리");
  // experience: RXP[grade] × (0.5 + s/100), ×1.5 on a 대성공
  to("meadow");
  for (let i = 0; i < 200; i++) {
    ch.life.fish = { lv: 1, xp: 0 };
    const r = X.fishLand(S, p, 100);
    if (r.id === "fish_s") { assert.equal(ch.life.fish.xp, r.great ? 18 : 12); if (!r.great) break; }
  }
  if (VERBOSE) console.log("fishing table built and rolled in", Date.now() - t0, "ms");
}

// ── reeling: the keep threshold falls with level (30 → 15); bites come sooner (×0.6 at 50)
{
  to("meadow");
  const reel = (lv, s) => {
    ch.life.fish = { lv, xp: 0 };
    p.fish = { at: 0, bite: now - 100, hook: now - 3000 };
    const before = ch.fish;
    assert.ok(act({ t: "reel", s }).ok);
    return ch.fish - before;
  };
  assert.equal(reel(1, 20), 0, "a beginner loses a fish played to 20");
  assert.equal(reel(50, 20), 1, "a master keeps it");
  assert.equal(reel(50, 14), 0);
  let lo = 1e9, hi = 0;
  for (let i = 0; i < 300; i++) { const w = X.fishWait(S, { life: { fish: { lv: 50 } } }); lo = Math.min(lo, w); hi = Math.max(hi, w); }
  assert.ok(lo >= 2500 * 0.6 && hi <= 7000 * 0.6 && hi > 3000, `bite wait at 50: ${lo}..${hi}`);
}

// ── cooking: the burn threshold falls with level, two portions at ≥ 85 or on a 대성공, the `cook` alias
{
  to("town");
  const fire = L.runtime(S, "town").fires[0];
  p.x = fire.x + 8; p.y = fire.y + 10; p.mvAt = now; p.hitAt = -1e9;
  const R = X.RECIPES;
  assert.deepEqual(Object.keys(R), ["food_s", "food_m", "food_c", "food_v", "food_l"]);
  for (const id of X.FISH_G) assert.equal(R[X.ITEMS[id].recipe].in[0][0], id, id + " has its recipe");
  for (const id of X.FISH_G) assert.equal(X.ITEMS[id].cook, R[X.ITEMS[id].recipe].out[0], id + ": the client's `cook` names the dish");
  assert.deepEqual([X.cookBurnt(1, R.food_s), X.cookBurnt(40, R.food_l), X.cookBurnt(45, R.food_l)], [35, 35, 33]);
  near(X.cookBurnt(50, R.food_s), 15.4, 1e-9, "a master burns only below 15.4");
  assert.deepEqual(D.life.recipes.map((r) => r.id), Object.keys(R));
  const cook = (lv, id, s) => {
    ch.life.cook = { lv, xp: 0 };
    ch.inv.push({ id, n: 1 });
    const xp0 = ch.cnt.cook;
    const v = act({ t: "cook", id, s });
    assert.ok(v.ok, v.error);
    return { xp: ch.life.cook.xp, done: ch.cnt.cook - xp0 };
  };
  const burnt0 = count("burnt");
  assert.deepEqual(cook(1, "fish_s", 30), { xp: 0, done: 0 }, "a beginner burns a pan of 30, learns nothing");
  assert.equal(count("burnt"), burnt0 + 1);
  const s0 = count("food_s");
  const r50 = cook(45, "fish_s", 30);
  assert.ok(count("food_s") > s0 && r50.done === 1, "a master (45: burns below 17) saves it");
  assert.ok(r50.xp === 2 || r50.xp === 3, "stale work: 8 (12 on a 대성공) × 0.25, got " + r50.xp);
  // the new fish cook too: 은빛 메기 → 구이, grade-3 experience at any level
  const c0 = count("food_c");
  const rc = cook(1, "fish_c", 60);
  assert.ok(count("food_c") > c0 && (rc.xp === 22 || rc.xp === 33), "food_c, xp " + rc.xp);
  const v0 = count("food_v");
  assert.equal(count("food_v"), v0);
  cook(1, "fish_v", 90);
  assert.equal(count("food_v"), v0 + 2, "a near-perfect pan feeds two");
  assert.equal(act({ t: "cook", id: "hp_s", s: 90 }).ok, false);
  assert.equal(act({ t: "cook", id: "toString", s: 90 }).ok, false);
  assert.equal(act({ t: "cook", id: 5, s: 90 }).ok, false);
  // two portions on a 대성공: 62 % for a master at an average pan, 5 % for a beginner
  let two = 0;
  for (let i = 0; i < N; i++) { ch.life.cook = { lv: 50, xp: 0 }; if (X.cookDish(S, p, R.food_s, 60).n === 2) two++; }
  near(two / N, 0.62, 0.03, "master's 대성공");
  two = 0;
  for (let i = 0; i < N; i++) { ch.life.cook = { lv: 1, xp: 0 }; if (X.cookDish(S, p, R.food_s, 60).n === 2) two++; }
  near(two / N, 0.05, 0.015, "beginner's 대성공");
  p.toast.length = 0; S.maps.town.ev.length = 0;
}

// ── materials, the sheet's other life fields, the town's new roles
{
  const mats = D.life.mats;
  assert.equal(mats.length, 15);
  const sell = (id) => Math.floor(X.ITEMS[id].price * 0.4);
  assert.deepEqual([1, 2, 3, 4, 5].map((g) => sell("m_h" + g)), [6, 14, 30, 60, 110]);
  assert.ok(mats.every((id) => X.ITEMS[id].type === "lmat" && X.ITEMS[id].grade >= 1 && /[가-힣]/.test(X.ITEMS[id].name)));
  for (const r of ["cook", "craft", "alch", "jobs"]) assert.ok(X.NPC_ROLES.includes(r), r);
  const npc = Object.keys(X.NPC_MAP)[0];
  const sh = { fish: 0, cnt: { cook: 0 }, life: {}, rep: { [npc]: 300, nobody: 5 }, pouch: { m_o5: 12 } };
  X.lifeSheetClean(sh);
  assert.deepEqual(sh.rep, { [npc]: 100 }, "trust with a real NPC, clamped");
  assert.deepEqual(sh.pouch, { m_o5: 12 });
}

console.log("lifeskills ok — curve 50…24,050, grades", Object.values(D.life.mapGrade).join(""), "recipes", D.life.recipes.length, "materials", D.life.mats.length);
