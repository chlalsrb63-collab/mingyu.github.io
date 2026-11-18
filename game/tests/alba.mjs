// The 일일 아르바이트 shift engine (66-alba.js) with whichever games are registered: start rules, the freeze at the counter, the clock,
// grade and pay once a day, the daily slots, give-up, the wire, an old sheet. Per-game rules have their own tests (alba-<k>.mjs).
// node tests/alba.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, ALBA_ORDER, JB_PAY, albaGood, albaBad, albaMult, albaGrade, albaClean, albaHot, albaStamps, albaPay };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;
// the real games refuse an empty input, so the engine is tested with three stand-ins registered like any game (66-alba.js)
const stand = { npc: "dongdong", place: "시험장", skill: "gather", par: 60, mul: 1, outfit: [], tool: "box", hint: "시험" };
for (const k of ["t_a", "t_b", "t_c"]) {
  X.ALBA[k] = { ...stand, name: "시험 " + k };
  X.ALBA_RULES[k] = { init(S, p, ab) { ab.g = { n: 0 }; }, adv() {}, act(S, p, ab, a, now) { ab.g.n++; X.albaGood(ab, now, 10); return null; }, view(ab) { return [ab.g.n]; } };
  X.ALBA_ORDER.push(k);
}
const D = L.defs();

assert.deepEqual(D.alba.order, X.ALBA_ORDER.filter((k) => X.ALBA[k]), "defs lists the registered games in order");
for (const k of D.alba.order) {
  const r = D.alba.rows[k];
  assert.ok(r.name && r.npc && r.place && r.hint && r.par > 0 && Array.isArray(r.outfit) && r.tool, `${k}: a complete row`);
  assert.ok(typeof X.ALBA_RULES[k].init === "function" && typeof X.ALBA_RULES[k].adv === "function" && typeof X.ALBA_RULES[k].act === "function" && typeof X.ALBA_RULES[k].view === "function", `${k}: its four rules`);
}

const S = L.setup();
let now = 5_000_000;
S.now = now;
L.addPlayer(S, "p1", L.hero("알바생", { wk: "sword", lvl: 30, migrate: true }));
const p = S.players.p1, ch = p.ch;
const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
const tick = (ms) => { now += ms; S.now = now; L.tick(S, now); L.endTick(S); };
const view = () => { S.now = now; const v = L.viewFor(S, "p1"); L.endTick(S); return v; };
const K = "t_a", K2 = "t_b", K3 = "t_c";

// Every real mini-game has one signed workplace and one reachable NPC at its front.
{
  const m = L.atlas().maps.willow, posts = m.npcs.filter((n) => n.role === "alba");
  assert.equal(posts.length, D.alba.order.length - 3);
  assert.deepEqual(new Set(posts.map((n) => n.alba)), new Set(D.alba.order.filter((k) => !k.startsWith("t_"))));
  const start = [p.map, p.x, p.y];
  p.map = m.id;
  for (const n of posts) {
    const b = m.big.find((b) => b.t === "bld" && b.k === "ab_" + n.alba);
    assert.ok(b && n.y === b.y + b.h && n.x >= b.x && n.x < b.x + b.w, n.alba + " at the front of its site");
    assert.ok(m.reach[n.y * m.w + n.x], n.alba + " reachable");
    for (let y = b.y; y < b.y + b.h; y++) {
      assert.equal(m.o[y].slice(b.x, b.x + b.w), "h".repeat(b.w));
    }
    assert.equal(D.alba.rows[n.alba].place, b.name);
    assert.equal(D.alba.rows[n.alba].npc, n.id);
    const request = { t: "ab_start", k: n.alba, npc: n.id };
    p.x = n.x * 16 + 8; p.y = n.y * 16 + 12;
    assert.equal(L.validateAction(S, "p1", { ...request, k: K }).ok, false, "the NPC cannot start a different game");
    assert.ok(act(request).ok);
    assert.equal(p.ab.k, n.alba);
    assert.ok(act({ t: "ab_leave" }).ok);
    p.x += 56;
    assert.equal(L.validateAction(S, "p1", request).ok, false, "out of reach");
  }
  [p.map, p.x, p.y] = start;
}

// scoring helpers
{
  const ab = { score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 0, endAt: 1e9 };
  assert.equal(X.albaGood(ab, 0, 100), 100, "the first point is plain");
  assert.equal(X.albaGood(ab, 0, 100), 110, "the combo raises it 10 % a step");
  for (let i = 0; i < 8; i++) X.albaGood(ab, 0, 10);
  assert.equal(ab.combo, 10); assert.ok(ab.feverUntil > 0 && ab.feverUsed === 1, "a fever at combo 10");
  const before = ab.score; X.albaGood(ab, 1, 100);
  assert.equal(ab.score - before, 100 * 2 * 2, "fever doubles, the combo is at its 2.0 cap");
  X.albaBad(ab, 50); assert.equal(ab.combo, 0, "a slip breaks the combo"); assert.equal(ab.score, before + 400 - 50);
  X.albaBad(ab, 1e9); assert.equal(ab.score, 0, "never below 0");
  assert.equal(X.albaGrade(K, 0), 0); assert.equal(X.albaGrade(K, X.ALBA[K].par), 4); assert.equal(X.albaGrade(K, Math.round(X.ALBA[K].par * 0.3)), 1);
}

// start rules
assert.equal(act({ t: "ab_start", k: "nope" }).ok, false, "unknown game");
assert.equal(act({ t: "ab_act" }).ok, false, "no shift, no action");
p.map = "meadow";
assert.equal(act({ t: "ab_start", k: K }).ok, false, "not on a hunting ground");
p.map = "town";
p.dead = true; assert.equal(act({ t: "ab_start", k: K }).ok, false, "not dead"); p.dead = false;
assert.ok(act({ t: "ab_start", k: K }).ok, "starts in town");
assert.ok(p.ab && p.ab.k === K && p.ghost > now, "a shift is under way and nothing can hurt the hero");
assert.equal(act({ t: "ab_start", k: K2 }).ok, false, "one shift at a time");
assert.equal(act({ t: "mv", x: p.x + 1, y: p.y, dt: 100 }).ok, false, "no walking");
assert.equal(act({ t: "atk" }).ok, false, "no fighting");
assert.ok(act({ t: "chat", m: "hi" }).ok !== undefined, "chat is still allowed (not refused as a shift)");

// the brief: inputs before the start do nothing
X.ALBA[K].par = 60;   // a small par so the stand-in game reaches S
let v = view();
assert.ok(Array.isArray(v.ab) && v.ab[0] === K && v.ab[2] > 0, "the snapshot carries the shift and the time to its start");
assert.notEqual(v.ab[7], 0, "the first snapshot carries the game state");
assert.equal(view().ab[7], 0, "an unchanged state is not sent again");
act({ t: "ab_act" }); assert.equal(p.ab.score, 0, "nothing counts during the brief");
tick(X.ALBA_T.briefMs + 100);
act({ t: "ab_act" }); const s1 = p.ab.score;
assert.ok(s1 > 0, "after the brief it counts");
act({ t: "ab_act" }); assert.equal(p.ab.score, s1, "inputs closer than the rate limit are dropped");
for (let i = 0; i < 20; i++) { tick(100); act({ t: "ab_act" }); }
assert.ok(view().ab[4] > s1, "the score on the wire grows");

// the end: graded, paid, the window waits on the result
const gold0 = ch.gold, xp0 = ch.xp;
tick(X.ALBA_T.runMs);
assert.equal(p.ab.state, "end"); assert.ok(p.ab.res && p.ab.res[0] === 4, "S at a tiny par");
assert.ok(ch.gold > gold0 && ch.ab.done[K] === 4 && ch.ab.best[K] > 0, "paid, recorded");
const paid = ch.gold - gold0;
assert.equal(p.ab.res[8], paid, "the result carries the gold paid"); assert.equal(p.ab.res[7], 0, "no best before the first run"); assert.equal(p.ab.res[9], X.albaHot(S).includes(K) ? 1 : 0, "the 특근 flag");
assert.ok(ch.ach.includes("alba1") && ch.ach.includes("albaS1"), "a first C and a first S earn their achievements");
assert.equal(act({ t: "ab_act" }).ok, true); assert.equal(p.ab.state, "end");
const wire = view().ab; assert.equal(wire[1], 1); assert.ok(Array.isArray(wire[8]) && wire[8][0] === 4, "the result rides the wire");
assert.ok(act({ t: "ab_close" }).ok && !p.ab, "closing the result frees the hero"); assert.equal(p.ghost, 0);
assert.ok(act({ t: "mv", x: p.x, y: p.y, dt: 100 }).ok !== undefined);

// once a day: the second run of the same game is practice
assert.ok(act({ t: "ab_start", k: K }).ok); tick(X.ALBA_T.briefMs + 100);
for (let i = 0; i < 5; i++) { tick(100); act({ t: "ab_act" }); }
tick(X.ALBA_T.runMs);
assert.equal(p.ab.res[4], 2, "already paid today"); assert.equal(ch.gold - gold0, paid, "no second pay"); act({ t: "ab_close" });

// the record: a second run knows the best before it
{
  const before = ch.ab.best[K];
  assert.ok(act({ t: "ab_start", k: K }).ok); tick(X.ALBA_T.briefMs + 100); tick(100); act({ t: "ab_act" }); tick(X.ALBA_T.runMs);
  assert.equal(p.ab.res[7], before, "the best before this run rides the result"); assert.equal(p.ab.res[8], 0, "a practice run pays no gold"); act({ t: "ab_close" });
}

// 특근: two distinct games a day, the same all day, a new pair on other days; the pay is 1.25 ×
{
  S.now = now;
  const h = X.albaHot(S);
  assert.equal(h.length, 2); assert.notEqual(h[0], h[1]); assert.ok(h.every((k) => X.ALBA[k])); assert.deepEqual(X.albaHot(S), h);
  const seen = new Set(); for (let d = 0; d < 40; d++) { S.now = now + d * 86400000; for (const k of X.albaHot(S)) seen.add(k); }
  assert.ok(seen.size >= 8, "over forty days most games take a turn: " + seen.size);
  S.now = now;
  const hk = h[0], nk = X.ALBA_ORDER.find((k) => X.ALBA[k] && !h.includes(k)), mul = [X.ALBA[hk].mul, X.ALBA[nk].mul];
  X.ALBA[hk].mul = X.ALBA[nk].mul = 1;
  const pay = (k) => { ch.ab.done = {}; const g0 = ch.gold; X.albaPay(S, p, { k, score: X.ALBA[k].par }, 4); return ch.gold - g0; };
  const a = pay(hk), b = pay(nk);
  assert.ok(b > 0 && Math.abs(a - b * 1.25) <= 1.5, `a 특근 game pays 1.25 ×: ${a} vs ${b}`);
  X.ALBA[hk].mul = mul[0]; X.ALBA[nk].mul = mul[1];
  assert.equal(D.alba.hot, 1.25, "the bonus rides the defs");
  p.dirty = true; const sv = view().self; assert.ok(sv && Array.isArray(sv.alba) && sv.alba.length === 4, "the window's record carries done · best · slots · 특근"); assert.deepEqual(sv.alba[3], h);
}

// stamps (the best score against the cut-offs) feed the achievements
{
  const real = X.ALBA_ORDER.filter((k) => X.ALBA[k]), c2 = { ab: { day: 0, done: {}, best: {} } };
  assert.equal(X.albaStamps(c2, 1), 0); assert.equal(X.albaStamps({}, 1), 0, "an old sheet has none");
  for (const k of real) c2.ab.best[k] = X.ALBA[k].par;
  assert.equal(X.albaStamps(c2, 4), real.length); c2.ab.best[real[0]] = Math.round(X.ALBA[real[0]].par * 0.3);
  assert.equal(X.albaStamps(c2, 4), real.length - 1); assert.equal(X.albaStamps(c2, 1), real.length);
}

// give up: no pay, no slot used
const slots = X.JB_PAY.perDay - Object.keys(ch.ab.done).length;
assert.ok(act({ t: "ab_start", k: K2 }).ok); tick(X.ALBA_T.briefMs + 100);
assert.ok(act({ t: "ab_leave" }).ok && !p.ab, "leaving ends it"); assert.equal(Object.hasOwn(ch.ab.done, K2), false);
assert.equal(X.JB_PAY.perDay - Object.keys(ch.ab.done).length, slots);

// a game that never reaches C is not paid; today's slots are limited
X.ALBA[K2].par = 1e9; X.ALBA[K3].par = 1; assert.ok(act({ t: "ab_start", k: K2 }).ok); tick(X.ALBA_T.briefMs + X.ALBA_T.runMs + 100);
assert.equal(p.ab.res[0], 0, "below C: no grade"); assert.equal(p.ab.res[4], 0); assert.equal(Object.hasOwn(ch.ab.done, K2), false); act({ t: "ab_close" });
const fake = Object.keys(X.ALBA).filter((k) => k !== K3);
ch.ab.done = {}; for (const k of fake.slice(0, X.JB_PAY.perDay)) ch.ab.done[k] = 1;
assert.ok(act({ t: "ab_start", k: K3 }).ok); tick(X.ALBA_T.briefMs + 100); act({ t: "ab_act" }); tick(X.ALBA_T.runMs);
assert.equal(p.ab.res[4], 3, "today's pay slots are used"); act({ t: "ab_close" });

// a new day starts the record empty; old sheets and junk are cleaned
S.now = now = now + 24 * 3600 * 1000 * 2;
const s2 = L.setup(); s2.now = now; L.addPlayer(s2, "q", L.hero("옛날", { wk: "sword", lvl: 5, migrate: true }));
const q = s2.players.q; delete q.ch.ab;
assert.deepEqual(X.albaClean(undefined), { day: 0, done: {}, best: {} });
assert.deepEqual(X.albaClean({ day: -5, done: { [K]: 99, zzz: 1 }, best: { [K]: -3, [K2]: "x" } }).done, { [K]: 4 }, "grade clamped, unknown games dropped");
assert.equal(X.albaClean({ day: 3, best: { [K]: 12.4 } }).best[K], 12);

console.log("alba: ok");
