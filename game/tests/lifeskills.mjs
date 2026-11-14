// Headless test of the life skills' core (docs/design/life-and-coop.md B, phase L1): the curve's golden values,
// levelling (several at once, the event and toast, the cap), the bonus formula of B.2, each map's grade, what
// bites by grade and level (shares, 대성공, experience, the keep threshold, quicker bites), cooking (burn
// threshold by level, two portions, experience, stale work, the `cook` alias of the recipe path), materials,
// the town's new NPC roles and the wire. node tests/lifeskills.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { gainLife, lifeOdds, lifeTime, lifeGrade, lifeXp, gradeOfMap, fishLand, fishWait, cookDish, cookBurnt, lifeSheetClean, RECIPES, FISH_G, RXP, GRADE_LV, NPC_ROLES, NPC_MAP, ITEMS," +
  // L2
  " lifeNodes, mapOf, mapPayload, MAP_META, FIRES, NODE, nodeMat, lifeTick, gatDone, craftOnce, JB, JB_PAY, jbOffers, jbRoute, jbLimit, parcelSpd, addRep, REP_TIER, REP_PERK," +
  " CRAFT, GEAR_CRAFT, SHOP, sellPrice, POUCH_MAX, addItem, takeItem, countItem, canAdd, stats, dayOf, lifeNeed, ENH_RATE, ENH_BLESS, AFFIX, rollGear, CNT_KEYS, ACH, DAILY_OTHER, LIFE_MASTER, exportChar };\n";
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
  const want = { town: 1, willow: 1, meadow: 1, forest: 2, crypt: 2, city: 3, sewer: 3, cave: 4, abyss: 4, maple: 5, jungle: 3, oasis: 4, coast: 4, dunesea: 4 };
  for (const [id, g] of Object.entries(want)) if (D.life.mapGrade[id] !== undefined) assert.equal(D.life.mapGrade[id], g, id);
  for (const id of ["meadow", "forest", "city", "cave", "maple", "jungle", "oasis", "coast", "dunesea"]) assert.equal(D.life.mapGrade[id], want[id], id);
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
  assert.deepEqual(Object.keys(R).filter((id) => R[id].any), ["food_s", "food_m", "food_c", "food_v", "food_l"], "the campfire fish dishes (L1)");
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
  assert.equal(mats.length, 20, "15 materials + 5 ingots (L2)");
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


// ═════════════════════════ L2: gathering, the stations, the pouch, the 알바 board, delivery, trust ═════════════════════════

/** Stand on tile (tx, ty) of map `id`. */
const standAt = (id, tx, ty) => { if (p.map !== id) to(id); p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; };
/** Stand beside a static NPC (on an open neighbouring tile). */
function standBy(nid) {
  const mid = X.NPC_MAP[nid], m = X.mapOf(mid), n = m.npcs.find((o) => o.id === nid);
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) {
    const x = n.x + dx, y = n.y + dy;
    if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.reach[y * m.w + x]) return standAt(mid, x, y);
  }
  throw new Error("no room beside " + nid);
}
const fresh = () => { p.dead = false; p.hitAt = -1e9; p.atkAt = 0; p.sit = false; p.fish = null; p.gat = null; p.mk = null; p.parcel = null; p.stc = null; };
const evs = (k) => S.maps[p.map].ev.filter((e) => e[0] === k);
const clearEv = () => { for (const id of Object.keys(S.maps)) S.maps[id].ev.length = 0; p.toast.length = 0; };
const give = (id, n) => assert.ok(X.addItem(ch, id, n), "room for " + id);
const wipe = (id) => X.takeItem(ch, id, X.countItem(ch, id));
const tickLife = (ms) => { now += ms; S.now = now; X.lifeTick(S, p, now); };

// ── nodes (B.4): placed from the map's id, counted by open ground, reachable, apart, clear of doors/signs/NPCs/fires
{
  const t0 = Date.now();
  const fresh2 = L.atlas(true, ["meadow", "crypt"]).maps;
  for (const id of Object.keys(X.MAP_META)) {
    const m = X.mapOf(id), ns = X.lifeNodes(m);
    if (X.MAP_META[id].safe) { assert.equal(ns.length, 0, id + ": no nodes in safe places"); continue; }
    let open = 0;
    for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) if (m.reach[y * m.w + x]) open++;
    const want = Math.min(X.NODE.max, Math.max(X.NODE.min, Math.round(open / X.NODE.per)));
    assert.equal(ns.length, want, `${id}: one node per ${X.NODE.per} open tiles (${open}), clamped`);
    const g = D.life.mapGrade[id];
    const busy = [...m.portals, ...(m.marks || []), ...m.npcs, ...(m.stones || []), ...(X.FIRES[id] || []).map(([x, y]) => ({ x, y }))];
    ns.forEach(([k, gr, x, y], i) => {
      assert.ok(k >= 0 && k <= 2 && gr === g, `${id} node ${i}: kind ${k}, grade ${gr} (map ${g})`);
      assert.ok(m.reach[y * m.w + x], `${id} node ${i} reachable`);
      for (const b of busy) assert.ok(Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) > X.NODE.clear, `${id} node ${i} clear of (${b.x},${b.y})`);
      for (let j = 0; j < i; j++) assert.ok((ns[j][2] - x) ** 2 + (ns[j][3] - y) ** 2 >= X.NODE.gap ** 2, `${id} nodes ${j},${i} apart`);
    });
    if (fresh2[id]) assert.deepEqual(X.lifeNodes(fresh2[id]), ns, id + ": the same nodes on a fresh build (deterministic)");
    if (VERBOSE) console.log(id.padEnd(8), "open", open, "nodes", ns.length, "kinds", [0, 1, 2].map((k) => ns.filter((n) => n[0] === k).length).join("/"));
  }
  // the 4× grounds are capped: the biggest gets NODE.max, the crypt (≈ 4,800 open) about a third of the meadow's ground
  assert.equal(X.lifeNodes(X.mapOf("meadow")).length, X.NODE.max);
  assert.ok(X.lifeNodes(X.mapOf("crypt")).length < X.NODE.max);
  assert.deepEqual(X.mapPayload(X.mapOf("meadow")).nodes, X.lifeNodes(X.mapOf("meadow")), "the map payload carries them");
  if (VERBOSE) console.log("nodes checked in", Date.now() - t0, "ms");
}

// ── gathering (B.4): range, own cooldown, grade lock, fighting, the channel and its interruptions, the tap, yields
{
  fresh();
  ch.life.gather = { lv: 1, xp: 0 };
  const m = X.mapOf("meadow"), ns = X.lifeNodes(m), i = 0, n = ns[i], mat = X.nodeMat(n);
  standAt("meadow", n[2] + 3, n[3]);
  assert.equal(act({ t: "gat", i }).error, "너무 멉니다");
  assert.equal(act({ t: "gat", i: 999 }).ok, false);
  assert.equal(act({ t: "gat", i: "0" }).ok, false);
  standAt("meadow", n[2], n[3]);
  p.hitAt = now - 1000;
  assert.equal(act({ t: "gat", i }).error, "싸우는 중에는 채집할 수 없습니다");
  p.hitAt = -1e9;
  clearEv();
  const have = X.countItem(ch, mat);
  assert.ok(act({ t: "gat", i }).ok);
  const dur = Math.round(X.NODE.ch * X.lifeTime(1));
  assert.deepEqual(evs("gs")[0], ["gs", p.eid, n[0], dur], "channel start: kind and length");
  assert.ok(p.gat.tapAt >= now + dur * 0.35 - 1 && p.gat.tapAt <= now + dur * 0.75 + 1, "the 반짝 comes inside 35–75 % of the channel");
  assert.equal(act({ t: "gat", i }).error, "이미 채집 중입니다");
  // the "반짝!" comes on time; a tap inside the window adds the bonus
  const tapAt = p.gat.tapAt;
  while (now < tapAt) tickLife(50);
  assert.deepEqual(evs("gt")[0], ["gt", p.eid, X.NODE.tap]);
  tickLife(300);
  assert.ok(act({ t: "gat_tap" }).ok);
  assert.equal(p.gat.extra, 15, "a tap in the window: +15 %p 대성공");
  while (p.gat) tickLife(100);
  const got = X.countItem(ch, mat) - have;
  assert.ok(got === 1 || got === 2, "one (two on a 대성공): " + got);
  const ga = evs("ga")[0];
  assert.equal(ga[2], n[0]); assert.equal(ga[3], got === 2 ? 1 : 0);
  assert.ok(ch.life.gather.xp === 8 || ch.life.gather.xp === 12, "XP RXP[g] (×1.5 on a 대성공): " + ch.life.gather.xp);
  assert.equal(ch.cnt.gat, 1);
  // the node is spent for this player only, and the wire says so once
  assert.equal(act({ t: "gat", i }).error, "아직 다시 자라지 않았습니다");
  const v1 = L.viewFor(S, "a"); L.endTick(S);
  assert.deepEqual(v1.ng, [i], "ng: spent nodes on this map");
  const v2 = L.viewFor(S, "a"); L.endTick(S);
  assert.equal(v2.ng, undefined, "ng only when it changes");
  tickLife(X.NODE.cd);
  assert.ok(act({ t: "gat", i }).ok, "ready again after the cooldown");
  const v3 = L.viewFor(S, "a"); L.endTick(S);
  assert.deepEqual(v3.ng, [], "back: the empty list once");
  // an early tap is wasted, and only one tap counts
  p.gat.tapAt = now + 1000;
  assert.ok(act({ t: "gat_tap" }).ok);
  tickLife(1000);
  act({ t: "gat_tap" });
  assert.equal(p.gat.extra, 0, "too early, then no second chance");
  // interruptions: a step, a blow taken, a blow struck, sitting
  clearEv();
  p.x += 7; tickLife(100);
  assert.equal(p.gat, null); assert.equal(evs("ga")[0][3], -1);
  assert.ok(p.toast.includes("채집이 끊겼습니다."));
  for (const hit of [() => { p.hitAt = now + 1; }, () => { p.atkAt = now + 1; }, () => { p.sit = true; }]) {
    fresh(); standAt("meadow", n[2], n[3]); p.ng = {};
    assert.ok(act({ t: "gat", i }).ok);
    hit(); tickLife(100);
    assert.equal(p.gat, null, "interrupted");
  }
  fresh();
  // the grade lock: the forest is grade 2 (Lv 10)
  const fn = X.lifeNodes(X.mapOf("forest"))[0];
  standAt("forest", fn[2], fn[3]);
  assert.equal(act({ t: "gat", i: 0 }).error, "채집 레벨이 부족합니다 (Lv.10 필요)");
  ch.life.gather = { lv: 10, xp: 0 };
  assert.ok(act({ t: "gat", i: 0 }).ok);
  p.gat = null;
  // 대성공 by the formula (B.2): a master on grade 1 with a tap 75 %, without 60 %; a beginner 3 %; bonus items 4 %
  standAt("meadow", n[2], n[3]);
  const runs = (lv, extra, N2) => {
    let great = 0, bonus = 0;
    for (let k = 0; k < N2; k++) {
      ch.life.gather = { lv, xp: 0 };
      wipe("stone"); wipe("camp"); wipe("m_h2"); wipe(mat); wipe(X.nodeMat(ns[1]));   // (whatever node 1 yields: its pile must not fill the pouch)
      p.gat = { i: 1, k: ns[1][0], map: "meadow", x: p.x, y: p.y, at: now, end: now, tapAt: now, sent: true, tapped: true, extra };
      clearEv();
      X.gatDone(S, p);
      if (evs("ga")[0][3] === 1) great++;
      if (X.countItem(ch, "stone") + X.countItem(ch, "camp") + X.countItem(ch, "m_h2") > 0) bonus++;
    }
    return [great / N2, bonus / N2];
  };
  const mat1 = X.nodeMat(ns[1]);
  near(runs(50, 15, 2000)[0], 0.75, 0.04, "master + tap");
  near(runs(50, 0, 2000)[0], 0.6, 0.04, "master");
  const [g1, b1] = runs(1, 0, 3000);
  near(g1, 0.03, 0.015, "beginner"); near(b1, 0.04, 0.015, "bonus item");
  wipe(mat1); p.ng = {}; p.gat = null; clearEv();
}

// ── the pouch (B.10): materials, staples and flasks go there first, 999 each; bag first out; warehouse and selling
{
  fresh();
  wipe("m_h1");
  const bag0 = ch.inv.length;
  give("m_h1", X.POUCH_MAX + 5);
  assert.equal(ch.pouch.m_h1, X.POUCH_MAX, "999 in the pouch");
  assert.equal(ch.inv.length, bag0 + 1, "the rest in one bag slot");
  assert.equal(X.countItem(ch, "m_h1"), X.POUCH_MAX + 5);
  X.takeItem(ch, "m_h1", 7);
  assert.equal(ch.inv.length, bag0, "the bag's share goes first");
  assert.equal(ch.pouch.m_h1, X.POUCH_MAX - 2);
  X.takeItem(ch, "m_h1", X.POUCH_MAX - 2);
  assert.equal(ch.pouch.m_h1, undefined, "an empty entry is dropped");
  give("staple", 3); give("flask", 4); give("ing_2", 1);
  assert.deepEqual([ch.pouch.staple, ch.pouch.flask, ch.pouch.ing_2], [3, 4, 1]);
  // the warehouse takes pouch items; taking them back puts them in the pouch again
  standBy("bank");
  give("m_o1", 10);
  assert.ok(act({ t: "wh", a: "put", pid: "m_o1", n: 4 }).ok);
  assert.equal(act({ t: "wh", a: "put", pid: "m_o1", n: 99 }).error, "잘못된 수량");
  assert.equal(ch.pouch.m_o1, 6);
  const si = ch.wh.items.findIndex((s) => s.id === "m_o1");
  assert.ok(si >= 0 && ch.wh.items[si].n === 4);
  assert.ok(act({ t: "wh", a: "take", s: si, n: 4 }).ok);
  assert.equal(ch.pouch.m_o1, 10);
  // sold from the pouch at a counter (40 %)
  standBy("shop");
  const g0 = ch.gold;
  assert.ok(act({ t: "sell", pid: "m_o1", n: 10 }).ok);
  assert.equal(ch.gold - g0, 60);
  assert.equal(ch.pouch.m_o1, undefined);
  assert.equal(act({ t: "sell", pid: "m_o1", n: 1 }).error, "잘못된 수량");
  // the sheet keeps it clean (L1's lifeSheetClean)
  const sh = { fish: 0, cnt: { cook: 0 }, life: {}, pouch: { m_h1: 5000, staple: 2, stone: 4, hp_s: 1 } };
  X.lifeSheetClean(sh);
  assert.deepEqual(sh.pouch, { m_h1: X.POUCH_MAX, staple: 2 });
}

// ── crafting (B.6): station, level, inputs exactly consumed, fee, success / half back on failure, 대성공, ms, batch
{
  fresh();
  ch.gold = 1e6;
  ch.life.craft = { lv: 1, xp: 0 };
  for (const id of ["m_o1", "m_w1", "stone"]) wipe(id);
  to("town"); standBy("shop");
  give("m_o1", 4); give("m_w1", 1);
  assert.equal(act({ t: "craft_open", r: "stone" }).error, "캉캉대장간의 캉캉 곁에서만 만들 수 있습니다");
  assert.equal(act({ t: "craft_open", r: "nope" }).ok, false);
  assert.equal(act({ t: "craft_open", r: "constructor" }).ok, false);
  standBy("kangkang");
  wipe("m_w1");
  assert.equal(act({ t: "craft_open", r: "stone" }).error, "재료가 부족합니다");
  assert.equal(act({ t: "craft_open", r: "punch" }).error, "제작 레벨이 부족합니다 (Lv.30 필요)");
  const gold0 = ch.gold;
  ch.gold = 10;
  give("m_w1", 1);
  assert.equal(act({ t: "craft_open", r: "stone" }).error, "골드가 부족합니다 (60G 필요)");
  ch.gold = gold0;
  assert.equal(act({ t: "craft", r: "stone", s: 80 }).error, "먼저 제작을 시작하세요");
  clearEv();
  assert.ok(act({ t: "craft_open", r: "stone" }).ok);
  assert.deepEqual(evs("mk")[0], ["mk", p.eid, "stone"]);
  const msMin = X.RECIPES.stone.ms * X.lifeTime(1);
  now += msMin - 200;
  assert.equal(act({ t: "craft", r: "stone", s: 80 }).error, "너무 서둘렀습니다");
  now += 200;
  assert.ok(act({ t: "craft", r: "stone", s: 80 }).ok);
  assert.equal(p.mk, null);
  const made = X.countItem(ch, "stone");
  const res = evs("mo")[0][3];
  if (res) assert.deepEqual([made, X.countItem(ch, "m_o1"), X.countItem(ch, "m_w1"), gold0 - ch.gold], [res === 2 ? 2 : 1, 0, 0, 60], "inputs exactly consumed, fee paid");
  else assert.deepEqual([made, X.countItem(ch, "m_o1"), X.countItem(ch, "m_w1"), gold0 - ch.gold], [0, 2, 0, 0], "a failure: half of each input back, no fee");
  // over many: success 60 + (s−50)·0.2 %, half back on each failure, 대성공 3 + … % makes two (craftOnce)
  const R = X.RECIPES;
  let ok = 0, two = 0, xpOk = 0;
  for (let k = 0; k < 3000; k++) {
    wipe("m_o1"); wipe("m_w1"); wipe("stone");
    give("m_o1", 4); give("m_w1", 1);
    ch.life.craft = { lv: 1, xp: 0 };
    const g0 = ch.gold, r = X.craftOnce(S, p, R.stone, 100);
    if (r) { ok++; assert.equal(g0 - ch.gold, 60); assert.equal(X.countItem(ch, "stone"), r === 2 ? 2 : 1); if (ch.life.craft.xp === (r === 2 ? 12 : 8)) xpOk++; }
    else { assert.equal(g0, ch.gold); assert.equal(X.countItem(ch, "m_o1"), 2); assert.equal(ch.life.craft.xp, 4, "half the XP"); }
    if (r === 2) two++;
  }
  near(ok / 3000, 0.13 + 0.87 * 0.7, 0.03, "success at d = 0, s = 100 (a 대성공 always succeeds)"); near(two / 3000, 0.13, 0.02, "대성공 at d = 0, s = 100");
  assert.equal(xpOk, ok, "XP RXP[grade], ×1.5 on a 대성공");
  // the minimum time shrinks with level (×0.6 at 50)
  ch.life.craft = { lv: 50, xp: 0 };
  give("m_o1", 4); give("m_w1", 1);
  assert.ok(act({ t: "craft_open", r: "stone" }).ok);
  now += Math.ceil(R.stone.ms * 0.6);
  assert.ok(act({ t: "craft", r: "stone", s: 50 }).ok);
  // batch: 20 levels above the recipe, up to 10, scored 70, no mini-game; never gear
  ch.life.craft = { lv: 20, xp: 0 };
  wipe("m_o1"); wipe("m_w1"); wipe("stone");
  give("m_o1", 40); give("m_w1", 10);
  assert.equal(act({ t: "craft", r: "stone", n: 10 }).error, "일괄 제작은 제작법보다 20레벨 높아야 할 수 있습니다");
  ch.life.craft = { lv: 21, xp: 0 };
  assert.equal(act({ t: "craft", r: "stone", n: 11 }).error, "잘못된 수량");
  assert.equal(act({ t: "craft", r: "stone", n: 11 + 0.5 }).ok, false);
  const gb = ch.gold;
  assert.ok(act({ t: "craft", r: "stone", n: 10 }).ok);
  const fails = X.countItem(ch, "m_o1") / 2;
  assert.ok(Number.isInteger(fails) && X.countItem(ch, "m_w1") === 0, "each failure gives 2 of 4 ores back, 0 of 1 plank");
  assert.equal(gb - ch.gold, 60 * (10 - fails), "fees only on successes");
  assert.ok(X.countItem(ch, "stone") >= 10 - fails);
  ch.life.craft = { lv: 50, xp: 0 };
  assert.equal(act({ t: "craft", r: "gr_h_2", n: 1 }).error, "장비는 한 번에 하나씩 만들어야 합니다");
  // recipes a teacher's trust opens (REP_PERK): 모카's pie
  ch.life.cook = { lv: 50, xp: 0 };
  standBy("juju_stove");
  give("m_h1", 3); give("m_h2", 1); give("staple", 1);
  assert.equal(act({ t: "craft_open", r: "cafe_pie" }).error, "모카와 친구가 되어야 배울 수 있습니다");
  ch.rep.cafe_moka = 30;
  assert.ok(act({ t: "craft_open", r: "cafe_pie" }).ok, "친구: the recipe is known");
  // alchemy needs 보글
  assert.equal(act({ t: "craft_open", r: "hp_s" }).error, "보글연금공방의 보글 곁에서만 만들 수 있습니다");
  delete ch.rep.cafe_moka;
}

// ── gear crafting: rarity 마법..희귀 (+1 on a 대성공), never 전설/세트; at least one affix; the tier's item level
{
  fresh();
  ch.life.craft = { lv: 50, xp: 0 };
  standBy("kangkang");
  const qs = [0, 0, 0, 0, 0];
  for (let k = 0; k < 400; k++) {
    give("ing_3", 4); give("m_w3", 2);
    const r = X.craftOnce(S, p, X.RECIPES.gr_a_3, 80);
    if (!r) continue;
    const g = ch.inv.pop();
    assert.equal(g.id, "a_3");
    assert.ok(g.q >= 1 && g.q <= 2 && !g.lg && !g.set && g.af.length >= 1, JSON.stringify(g));
    qs[g.q]++;
  }
  assert.ok(qs[1] > 0 && qs[2] > 0, "both rarities: " + qs);
  assert.equal(Object.keys(X.RECIPES).filter((id) => X.RECIPES[id].gear).length, 48, "six weapon kinds + six pieces × four tiers");
  assert.deepEqual([...new Set(Object.values(X.RECIPES).filter((r) => r.gear).map((r) => r.lv))], [12, 22, 32, 42]);
}

// ── 축복 강화석: +10 %p and a failure never drops a step; the punch's cap; the whetstone; elixirs
{
  fresh();
  ch.gold = 1e9;
  standBy("smith");
  const w = X.rollGear(S, "w_warrior_3", 2, 20);
  ch.eq.weapon = w;
  p.stc = null;
  let wins = 0, drops = 0;
  for (let k = 0; k < 2000; k++) {
    w.enh = 7; ch.pity.fill(0); // (the raw rate: the pity gauge of 63-social-weekly.js is tested in social.mjs)
    give("stone", 3); give("stone_b", 1);
    assert.ok(act({ t: "enh", k: "weapon", b: 1 }).ok);
    if (w.enh === 8) wins++;
    if (w.enh < 7) drops++;
  }
  assert.equal(drops, 0, "a blessed failure keeps +7");
  near(wins / 2000, (X.ENH_RATE[7] + X.ENH_BLESS) / 100, 0.035, "+10 %p");
  wipe("stone_b"); give("stone", 3);
  assert.equal(act({ t: "enh", k: "weapon", b: 1 }).error, "축복 강화석이 없습니다");
  assert.equal(act({ t: "enh", k: "weapon", b: 2 }).ok, false);
  let plainDrop = false;
  for (let k = 0; k < 200 && !plainDrop; k++) { w.enh = 7; give("stone", 3); act({ t: "enh", k: "weapon" }); plainDrop = w.enh === 6; }
  assert.ok(plainDrop, "without the blessing +7 can still drop");
  // the punch: one more socket up to the slot's cap (3; gloves and boots 1; jewellery none)
  w.sk = 2;
  give("punch", 3);
  assert.ok(act({ t: "use", id: "punch", k: "weapon" }).ok);
  assert.equal(w.sk, 3);
  assert.equal(act({ t: "use", id: "punch", k: "weapon" }).error, "더 이상 홈을 뚫을 수 없습니다");
  assert.equal(act({ t: "use", id: "punch", k: "helm" }).error, "장착한 장비를 골라 주세요");
  ch.eq.gloves = X.rollGear(S, "g_3", 1, 20); ch.eq.gloves.sk = 1;
  assert.equal(act({ t: "use", id: "punch", k: "gloves" }).error, "더 이상 홈을 뚫을 수 없습니다");
  ch.eq.ring1 = X.rollGear(S, "r_3", 1, 20);
  assert.equal(act({ t: "use", id: "punch", k: "ring1" }).error, "장신구에는 홈을 뚫을 수 없습니다");
  delete ch.eq.gloves; delete ch.eq.ring1;
  wipe("punch");
  // the whetstone: the weakest affix rolls again, the rest stay, no key twice
  give("whet", 1);
  const before = JSON.stringify(w.af), n0 = w.af.length;
  assert.ok(act({ t: "use", id: "whet", k: "weapon" }).ok);
  assert.equal(w.af.length, n0);
  assert.equal(new Set(w.af.map((a) => a[0])).size, n0, "no affix twice");
  assert.equal(X.countItem(ch, "whet"), 0, "one use");
  if (VERBOSE) console.log("whet", before, "→", JSON.stringify(w.af));
  // elixirs: the scroll's buff for longer (보글's friends +5 min); never shorter; 신속 = the speed buff
  give("el_atk", 2); give("el_all", 1); give("el_spd", 1);
  ch.scr.atk = 0;
  assert.ok(act({ t: "use", id: "el_atk" }).ok);
  assert.equal(ch.scr.atk, now + 15 * 60000);
  ch.rep.bogle = 30;
  assert.ok(act({ t: "use", id: "el_atk" }).ok);
  assert.equal(ch.scr.atk, now + 20 * 60000, "보글의 친구: +5 min");
  delete ch.rep.bogle;
  ch.scr.xp = now + 60 * 60000;
  assert.ok(act({ t: "use", id: "el_all" }).ok);
  assert.deepEqual([ch.scr.atk, ch.scr.def, ch.scr.xp], [now + 20 * 60000, now + 20 * 60000, now + 60 * 60000], "all three, never shortened");
  assert.ok(act({ t: "use", id: "el_spd" }).ok);
  assert.equal(p.spdBuff, now + 60000);
  delete ch.eq.weapon; p.stc = null;
}

// ── the economy guard (B.7): against the shop, crafting saves at most 40 %; a craft → sell loop never gains
{
  const sold = new Set(X.SHOP);
  for (const id of Object.keys(X.MAP_META)) if (X.MAP_META[id].eager) for (const nd of X.mapOf(id).npcs) for (const g of nd.goods || []) sold.add(g);
  const sv = (id) => (id === "rune*" ? X.sellPrice({ id: "ru_ign" }) : X.sellPrice({ id }));
  const rows = [];
  for (const [id, r] of Object.entries(X.RECIPES)) {
    for (const [i] of r.in) assert.ok(i === "rune*" || Object.hasOwn(X.ITEMS, i), `${id}: input ${i}`);
    assert.ok(r.out[0] === "rune*" || Object.hasOwn(X.ITEMS, r.out[0]), `${id}: output`);
    assert.ok(["fire", "cook", "craft", "alch"].includes(r.at) && X.ITEMS && /^[a-z]+$/.test(r.mg), id);
    if (r.any) continue;  // the L1 campfire fish: an angler's time, not gold
    const cost = r.in.reduce((s, [i, n]) => s + sv(i) * n, 0) + r.fee;
    const ref = r.eq ? r.eq.reduce((s, i) => s + X.ITEMS[i].price, 0) : sold.has(r.out[0]) ? X.ITEMS[r.out[0]].price * r.out[1] : 0;
    if (ref) assert.ok(cost >= 0.6 * ref - 1e-9, `${id}: inputs at sell value + fee ${cost} ≥ 60 % of the shop's ${ref}`);
    const back = r.out[0] === "rune*" ? sv("ru_ign") : sv(r.out[0]) * r.out[1];
    if (!r.gear) assert.ok(back <= cost, `${id}: selling it (${back}) never beats its inputs + fee (${cost})`);
    if (ref || VERBOSE) rows.push([id, cost, ref, ref ? (cost / ref).toFixed(2) : "-"]);
  }
  assert.ok(rows.some(([id]) => id === "stone") && rows.some(([id]) => id === "hp_s") && rows.some(([id]) => id === "gr_a_2"), "the guard saw the shop's goods");
  if (VERBOSE) for (const r of rows) console.log("guard", ...r);
  // a stone crafted costs 90 G of sell value (shop 150): the guard's floor exactly
  assert.equal(X.RECIPES.stone.fee + 4 * sv("m_o1") + sv("m_w1"), 90);
}

// ── the 알바 board (B.9): offers seeded by name and day, 3 a day, one at a time, 06:00 KST, pay, trust, perks
{
  fresh();
  const day = X.dayOf(now);
  for (const k of ["gather", "cook", "craft", "alch", "fish", "deliver"]) ch.life[k] = { lv: 1, xp: 0 };
  const o1 = X.jbOffers(ch, day), o2 = X.jbOffers({ ...ch }, day);
  assert.deepEqual(o1, o2, "the same offers for the same name and day");
  assert.equal(o1.length, X.JB_PAY.offers);
  assert.ok(o1.every((id) => X.JB[id].lv <= 1), "only what a beginner qualifies for");
  assert.notDeepEqual([day, day + 1, day + 2].map((d) => X.jbOffers(ch, d).join()), Array(3).fill(o1.join()), "they change from day to day");
  // 06:00 KST is the boundary (21:00 UTC)
  const six = Date.UTC(2026, 10, 14, 21, 0, 0);
  assert.equal(X.dayOf(six - 1) + 1, X.dayOf(six));
  // every template: real NPCs, items, skills; deliveries have a finite route; Korean text
  for (const [id, t] of Object.entries(X.JB)) {
    assert.ok(X.NPC_MAP[t.npc] && (t.kind !== "deliver" || X.NPC_MAP[t.to]), id + ": NPCs exist");
    assert.ok(/[가-힣]/.test(t.text) && D.life.keys.includes(t.sk), id);
    if (t.kind === "deliver") { const r = X.jbRoute(id); assert.ok(r > 5 && r < 400, `${id}: route ${r}`); }
    else assert.ok(Object.hasOwn(X.ITEMS, t.item) && t.n >= 1, id);
    if (t.kind === "make") assert.ok(!X.SHOP.includes(t.item), id + ": no shop sells it");
  }
  // take at 포포 only, one at a time
  const pick = (id) => { p.jbOff = { day: ch.jobBoard.day, ids: [id, ...o1.filter((o) => o !== id)].slice(0, 4) }; };
  standBy("bank");
  X.lifeTick(S, p, now);
  pick("jb_herb1");
  assert.equal(act({ t: "jb", a: "take", id: "jb_herb1" }).error, "알바 중개인이 너무 멉니다");
  standBy("popo");
  assert.equal(act({ t: "jb", a: "take", id: "jb_ore5" }).error, "오늘의 알바가 아닙니다");
  assert.ok(act({ t: "jb", a: "take", id: "jb_herb1" }).ok);
  assert.deepEqual(ch.jobBoard.active, { id: "jb_herb1", npc: "bogle", prog: 0, expAt: 0 });
  assert.equal(act({ t: "jb", a: "take", id: o1.find((o) => o !== "jb_herb1") || "jb_herb1" }).error, "이미 맡은 알바가 있습니다");
  // hand in: at the NPC, with the items
  wipe("m_h1");
  standBy("bogle");
  give("m_h1", 5);
  assert.equal(act({ t: "jb", a: "give" }).error, "들꽃잎이 부족합니다 (5/6)");
  give("m_h1", 1);
  const g0 = ch.gold;
  assert.ok(act({ t: "jb", a: "give" }).ok);
  assert.equal(ch.gold - g0, 30 + 6 * 1, "gold 30 + 6·L");
  assert.equal(ch.life.gather.xp, Math.round(X.lifeNeed(1) * 0.25), "life XP a quarter level");
  assert.equal(X.countItem(ch, "m_h1"), 0, "items handed over");
  assert.equal(ch.rep.bogle, 2, "trust +2");
  assert.deepEqual(ch.jobBoard.done, ["jb_herb1"]);
  standBy("popo");
  assert.equal(act({ t: "jb", a: "take", id: "jb_herb1" }).error, "오늘 이미 끝낸 알바입니다");
  // three a day
  ch.jobBoard.done.push("jb_wood1", "jb_ore1");
  pick("jb_fish1");
  assert.equal(act({ t: "jb", a: "take", id: "jb_fish1" }).error, "알바는 하루에 3개까지입니다");
  // the next morning the board is new
  now += 86400000; S.now = now;
  X.lifeTick(S, p, now);
  assert.equal(ch.jobBoard.day, day + 1);
  assert.deepEqual(ch.jobBoard.done, []);
  // trust: tiers, the cap, perks, the 단골's discount and tip, the 가족 title
  ch.rep = {};
  p.toast.length = 0;
  X.addRep(S, p, "juju", 12);
  assert.ok(p.toast.some((t) => t.includes("단골")), p.toast.join("/"));
  standBy("juju");
  const c0 = ch.gold;
  assert.ok(act({ t: "buy", id: "food_s", n: 10 }).ok);
  assert.equal(c0 - ch.gold, Math.floor(400 * 0.95), "5 % off at a 단골's counter");
  X.addRep(S, p, "juju", 500);
  assert.equal(ch.rep.juju, 100, "trust caps at 100");
  assert.ok(ch.ach.includes("rep_juju"), "가족: the title");
  X.addRep(S, p, "nobody_at_all", 5);
  assert.equal(ch.rep.nobody_at_all, undefined);
  ch.life.cook = { lv: 30, xp: 0 };
  assert.equal(D.life.jb.jb_fish2.npcName, "쥬쥬");
  ch.life.fish = { lv: 10, xp: 0 };
  const gv = L.viewFor(S, "a"); L.endTick(S);
  assert.ok(Array.isArray(gv.self.jb) && gv.self.jb[0] === ch.jobBoard.day && Array.isArray(gv.self.jb[1]) && gv.self.jb[3] === 0, JSON.stringify(gv.self.jb));
  assert.deepEqual(gv.self.rep, [["juju", 100]]);
  assert.equal(typeof gv.self.pouch, "object");
}

// ── delivery (B.8): pick at the sender, the clock, the speed while carrying, death, late, success and its tip
{
  fresh();
  ch.rep = {};
  ch.jobBoard = { day: X.dayOf(now), done: [], active: null };
  ch.life.deliver = { lv: 1, xp: 0 };
  const id = "jb_dl_cafe", t = X.JB[id];
  const take = () => { p.jbOff = { day: ch.jobBoard.day, ids: [id] }; standBy("popo"); const v = act({ t: "jb", a: "take", id }); assert.ok(v.ok, v.error); };
  take();
  standBy("juju");
  assert.equal(act({ t: "jb", a: "give" }).error, "전할 꾸러미가 없습니다");
  assert.equal(act({ t: "jb", a: "pick" }).error, "카페 주인 모카에게 가서 꾸러미를 받으세요");
  standBy(t.npc);
  const spd0 = X.stats(p).spd0;
  assert.ok(act({ t: "jb", a: "pick" }).ok);
  const lim = X.jbLimit(id);
  assert.deepEqual([p.parcel.until, ch.jobBoard.active.prog, ch.jobBoard.active.expAt], [now + lim, 1, now + lim]);
  assert.equal(lim, Math.round(X.jbRoute(id) * T / (48 * 0.85) * 1.8 * 1000 + 20000));
  near(X.stats(p).spd0 / spd0, 0.856, 1e-9, "carrying at 배달 1: ×0.856");
  assert.deepEqual([1, 25, 50].map((lv) => Math.round(X.parcelSpd({ life: { deliver: { lv } } }) * 1000) / 1000), [0.856, 1, 1.15]);
  assert.equal(act({ t: "jb", a: "pick" }).error, "이미 꾸러미를 받았습니다");
  // late: lost, no pay, no trust
  const g0 = ch.gold;
  to("town"); step();
  now += lim + 100;
  step();
  assert.equal(p.parcel, null); assert.equal(ch.jobBoard.active, null);
  assert.deepEqual([ch.gold, ch.rep.juju, ch.jobBoard.done.length], [g0, undefined, 0]);
  assert.equal(X.stats(p).spd0, spd0, "speed back once the parcel is gone");
  // fallen: lost too
  take(); standBy(t.npc); assert.ok(act({ t: "jb", a: "pick" }).ok);
  p.dead = true; to("town"); step();
  assert.equal(p.parcel, null); assert.equal(ch.jobBoard.active, null);
  p.dead = false;
  // a parcel is never saved: a sheet loaded mid-way goes back to "pick it up"
  take(); standBy(t.npc); assert.ok(act({ t: "jb", a: "pick" }).ok);
  const saved = JSON.parse(JSON.stringify(L.exportChar(S, "a")));
  X.lifeSheetClean(saved);
  assert.deepEqual(saved.jobBoard.active, { id, npc: t.npc, prog: 0, expAt: 0 });
  // delivered in time: 20 + 4·L and a tip by the time left, trust +3 / +1, counted
  standBy(t.to);
  now += 1000;
  const g1 = ch.gold;
  assert.ok(act({ t: "jb", a: "give" }).ok);
  const base = 20 + 4 * 1, want = base + Math.round(base * 0.5 * (lim - 1000) / lim);
  assert.equal(ch.gold - g1, want);
  assert.deepEqual([ch.rep.juju, ch.rep.cafe_moka, ch.cnt.deliver, p.parcel], [3, 1, 1, null]);
  assert.deepEqual(ch.jobBoard.done, [id]);
}

// ── achievements, dailies, counters, the wire
{
  fresh();
  assert.ok(["gat", "craft", "deliver"].every((k) => X.CNT_KEYS.includes(k)));
  assert.ok(["gather", "craft"].every((k) => X.DAILY_OTHER.includes(k)));
  for (const k of D.life.keys) assert.ok(X.ACH.some((a) => a.id === `life50_${k}` && X.LIFE_MASTER.includes(a.title)), k);
  ch.life.alch = { lv: 9, xp: 1039 };
  X.gainLife(S, p, "alch", 5);
  assert.ok(ch.ach.includes("life10"), "Lv 10 in any skill");
  ch.life.alch = { lv: 49, xp: 0 };
  X.gainLife(S, p, "alch", 1e6);
  assert.ok(ch.ach.includes("life50_alch") && ch.ach.includes("life30"));
  // a fresh sheet carries the new counters; defs carry the L2 tables
  const nc = L.newChar("새싹", []);
  assert.deepEqual([nc.cnt.gat, nc.cnt.craft, nc.cnt.deliver], [0, 0, 0]);
  assert.ok(D.life.jb.jb_dl_cafe.toName && D.life.rep.tier.length === 3 && D.life.pouch.ids.includes("staple") && D.life.nodes.kinds.join("") === "how");
  assert.ok(D.life.recipes.length === Object.keys(X.RECIPES).length && D.life.recipes.length === 84 && D.life.recipes.some((r) => r.id === "gr_w_bow_5"));
  // the town's hosts: 캉캉 crafts, 보글 brews, 쥬쥬's stove cooks, 포포 runs the board, 쥬쥬 and 보글's shelf sell the staples
  const role = (nid) => X.mapOf(X.NPC_MAP[nid]).npcs.find((n) => n.id === nid);
  assert.deepEqual(["kangkang", "bogle", "juju_stove", "popo"].map((nid) => role(nid).role), ["craft", "alch", "cook", "jobs"]);
  assert.ok(role("juju").goods.includes("staple") && role("bogle_shelf").goods.includes("flask"));
}
console.log("lifeskills ok — curve 50…24,050, grades", Object.values(D.life.mapGrade).join(""), "recipes", D.life.recipes.length, "materials", D.life.mats.length);
