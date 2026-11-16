// The 일일 아르바이트 shift engine (66-alba.js) with whichever games are registered: start rules, the freeze at the counter, the clock,
// grade and pay once a day, the daily slots, give-up, the wire, an old sheet. Per-game rules have their own tests (alba-<k>.mjs).
// node tests/alba.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, ALBA_ORDER, JB_PAY, albaGood, albaBad, albaMult, albaGrade, albaClean };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, D = L.defs();

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
const K = D.alba.order[0], K2 = D.alba.order[1], K3 = D.alba.order[2];

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
  assert.equal(X.albaGrade(K, 0), 0); assert.equal(X.albaGrade(K, X.ALBA[K].par), 4); assert.equal(X.albaGrade(K, Math.round(X.ALBA[K].par * 0.4)), 1);
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
assert.equal(act({ t: "ab_act" }).ok, true); assert.equal(p.ab.state, "end");
const wire = view().ab; assert.equal(wire[1], 1); assert.ok(Array.isArray(wire[8]) && wire[8][0] === 4, "the result rides the wire");
assert.ok(act({ t: "ab_close" }).ok && !p.ab, "closing the result frees the hero"); assert.equal(p.ghost, 0);
assert.ok(act({ t: "mv", x: p.x, y: p.y, dt: 100 }).ok !== undefined);

// once a day: the second run of the same game is practice
assert.ok(act({ t: "ab_start", k: K }).ok); tick(X.ALBA_T.briefMs + 100);
for (let i = 0; i < 5; i++) { tick(100); act({ t: "ab_act" }); }
tick(X.ALBA_T.runMs);
assert.equal(p.ab.res[4], 2, "already paid today"); assert.equal(ch.gold - gold0, paid, "no second pay"); act({ t: "ab_close" });

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
