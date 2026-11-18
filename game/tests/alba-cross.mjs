// 일일 아르바이트 · 횡단 배달 (67-alba-cross.js): the rules (lanes, carts, logs, drowning, deliveries, gifts, cooldown, fever), determinism, hostile input,
// the view's size, the server's cost, and bots that play whole shifts through the real tick / viewFor / action path.
// node tests/alba-cross.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, CROSS, crossN, crossPos, crossPhase, crossUnder, crossMove, crossHop, crossBuild, albaGrade, albaAdvance };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, R = X.ALBA_RULES.cross, C = X.CROSS, T = X.ALBA_T;
const PAR = X.ALBA.cross.par, STEP = C.STEP;

// ── unit harness: a bare shift object, no world
const mkAb = (seed = 7, endAt = 1e9) => {
  const ab = { k: "cross", box: { seed }, runAt: 0, endAt, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null };
  R.init(null, null, ab);
  return ab;
};
/** A bare street: no lanes, no gifts, the courier at the start, a long way from the end. */
const bare = (ab, goal = 0) => { const g = ab.g; g.L = new Array(C.H).fill(null); g.gifts = []; g.goal = goal; g.x = C.SX; g.y = C.SY; g.stepAt = 0; g.hit = 0; return g; };
const lane = (g, y, o) => { g.L[y] = { k: 0, v: 0, sp: 8, len: 2, ph: 0, ...o }; return g.L[y]; };
const hop = (ab, d, t) => { R.adv(null, null, ab, t); return R.act(null, null, ab, { d }, t); };
const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

// ── the ring of a lane
{
  const ab = mkAb(3), g = bare(ab), ln = lane(g, 9, { k: 0, v: 0, sp: 6, len: 2, ph: 100 });
  assert.equal(X.crossN(ln), 3, "ceil((13 + 2) / 6) objects");
  assert.deepEqual([0, 1, 2].map((j) => X.crossPos(g, ln, j, 0)), [-1, 5, 11], "objects sit `sp` apart, the first at phase − len");
  ln.v = 20;
  assert.ok(Math.abs(X.crossPos(g, ln, 0, 1000) - 1) < 1e-9, "2 cells a second to the right");
  ln.v = -20;
  assert.ok(Math.abs(X.crossPos(g, ln, 1, 500) - 4) < 1e-9, "and to the left");
  // every lane of every delivery: objects never pop in view (a wrap happens off the street), and the gaps are passable
  for (let seed = 1; seed <= 6; seed++) for (let d = 0; d < 60; d += 3) {
    const b = X.crossBuild(seed * 977, d, 1), gg = { dAt: 0 };
    for (let y = 0; y < C.H; y++) {
      const l = b.L[y];
      if (!l) { assert.ok([0, 5, 10].includes(y), "rows 0, 5, 10 are the safe ones"); continue; }
      assert.ok(l.sp >= l.len + 1 && l.len >= 1 && l.v !== 0 && Number.isInteger(l.v) && l.ph >= 0 && l.ph < l.sp * 100, `lane ${y} d${d}: sane numbers`);
      assert.equal(l.k, y < 5 ? 2 : y === 7 || y === 9 ? 1 : 0, "logs on the river, walkers and carts on the road");
      const n = X.crossN(l), ring = n * l.sp;
      assert.ok(ring >= C.W + l.len, "the ring is longer than the street plus an object");
      let prev = null;
      for (let t = 0; t < 30000; t += 50) {
        const ps = Array.from({ length: n }, (_, j) => X.crossPos(gg, l, j, t));
        for (const q of ps) assert.ok(q >= -l.len - 1e-9 && q < ring - l.len + 1e-9, "inside the ring");
        if (prev) ps.forEach((q, j) => { if (Math.abs(q - prev[j]) > 2) assert.ok((q + l.len <= 0.4 || q >= C.W - 0.4) && (prev[j] + l.len <= 0.4 || prev[j] >= C.W - 0.4), "a wrap is outside the street (to within one 50 ms step)"); });
        prev = ps;
      }
    }
    assert.equal(b.goal, d ? 0 : 5);
    assert.ok(b.gifts.length === (d ? 2 : 1) && b.gifts[0].y >= 6 && b.gifts[0].y <= 9);
  }
}

// ── carts and walkers: stepping into one is a hit; the gap is safe
{
  const ab = mkAb();
  const g = bare(ab);
  lane(g, 9, { k: 0, v: 0, sp: 8, len: 2, ph: 700 });   // a cart on cells 5 and 6 (and the next one at 13)
  ab.score = 100; ab.combo = 4;
  assert.equal(hop(ab, UP, 10), null, "the hop is taken …");
  assert.equal(ab.score, 80, "… into the cart: −20"); assert.equal(ab.combo, 0, "the combo breaks");
  assert.equal(g.y, C.SY, "back to the start"); assert.equal(g.x, C.SX); assert.equal(g.hit, 1);
  assert.deepEqual(g.ev.slice(1), [3, 0], "event: hit");
  assert.equal(hop(ab, UP, 300), "wait", "stunned for 500 ms");
  assert.equal(hop(ab, UP, 560), null, "then free"); assert.equal(g.y, C.SY);
  // the neighbouring cell, left of the cart and right of it, is clear
  const b2 = mkAb(), g2 = bare(b2); lane(g2, 9, { k: 0, v: 0, sp: 8, len: 2, ph: 700 });
  hop(b2, LEFT, 10); hop(b2, LEFT, 350); assert.equal(g2.x, 4);
  hop(b2, UP, 700); assert.equal(g2.y, 9, "cell 4 is clear"); assert.equal(b2.score, 0);
  const b3 = mkAb(), g3 = bare(b3); lane(g3, 9, { k: 0, v: 0, sp: 8, len: 2, ph: 700 });
  hop(b3, RIGHT, 10); hop(b3, UP, 350); assert.equal(g3.y, 9, "cell 7 is clear too");
  // a moving cart hits a courier who waits in its lane, and a cart that has gone past does not
  const b4 = mkAb(), g4 = bare(b4);
  lane(g4, 9, { k: 0, v: 30, sp: 8, len: 2, ph: 700 - 600 });   // a cart at phase 1 − 2 = -1 .. now moving right at 3 cells/s
  g4.y = 9;
  R.adv(null, null, b4, 600);   // 1.8 cells further: the cart's right edge is at about 2.8 … the courier at 6 is clear
  assert.equal(g4.y, 9, "still safe, the cart has not arrived");
  R.adv(null, null, b4, 2000);  // the cart arrives (its right edge passes 6.2 at about 1.8 s)
  assert.equal(g4.y, C.SY, "the waiting courier was run over"); assert.equal(b4.combo, 0); assert.ok(b4.score === 0);
  // a walker is one cell wide and can be slipped past
  const b5 = mkAb(), g5 = bare(b5); lane(g5, 9, { k: 1, v: 0, sp: 4, len: 1, ph: 700 });   // walkers at 6, 10, 2 (and 14 → the ring is 16 long)
  hop(b5, UP, 10); assert.equal(g5.y, C.SY, "stepping into a walker is a hit");
  const b6 = mkAb(), g6 = bare(b6); lane(g6, 9, { k: 1, v: 0, sp: 4, len: 1, ph: 700 });
  hop(b6, RIGHT, 10); hop(b6, UP, 350); assert.equal(g6.y, 9, "the next cell is clear");
}

// ── the river: a log holds and carries, the water does not
{
  const ab = mkAb();
  const g = bare(ab);
  g.y = 5;
  lane(g, 4, { k: 2, v: 0, sp: 10, len: 4, ph: 900 });   // a log on cells 5..8 (and the next at 15)
  assert.equal(hop(ab, UP, 10), null);
  assert.equal(g.y, 4, "on the log: safe"); assert.equal(ab.score, 0);
  const b2 = mkAb(), g2 = bare(b2); g2.y = 5; lane(g2, 4, { k: 2, v: 0, sp: 10, len: 4, ph: 900 });
  hop(b2, LEFT, 10); hop(b2, LEFT, 350); hop(b2, LEFT, 700); assert.equal(g2.x, 3);
  b2.score = 50; b2.combo = 3;
  hop(b2, UP, 1050);
  assert.equal(g2.y, 5, "off the log: the water, back to the median"); assert.equal(b2.score, 30); assert.equal(b2.combo, 0);
  assert.deepEqual(g2.ev.slice(1), [4, 0], "event: water");
  // a log carries its rider (fractional x), who may step sideways on it
  const b3 = mkAb(), g3 = bare(b3); g3.y = 5; lane(g3, 4, { k: 2, v: 20, sp: 10, len: 4, ph: 900 });
  hop(b3, UP, 10);
  R.adv(null, null, b3, 1010);
  assert.ok(Math.abs(g3.x - 8) < 0.3 && g3.y === 4, `carried to the right (${g3.x})`);
  const x0 = g3.x;
  hop(b3, LEFT, 1260);
  assert.ok(Math.abs(g3.x - (x0 + 0.5 - 1)) < 0.35, "a hop left on the log moves a whole cell");
  // … until the log takes him out of the street
  R.adv(null, null, b3, 4000);
  assert.equal(g3.y, 5, "carried off the street: lost"); assert.equal(g3.ev[1], 4);
  // from a log onto the median he lands on a whole cell
  const b4 = mkAb(), g4 = bare(b4); g4.y = 4; g4.x = 6.4; lane(g4, 4, { k: 2, v: 0, sp: 10, len: 4, ph: 900 });
  hop(b4, DOWN, 10); assert.equal(g4.y, 5); assert.ok(Number.isInteger(g4.x) && g4.x === 6, "snapped to a cell");
  // the log's end forgives a little (a hop's timing is the grid's)
  const b5 = mkAb(), g5 = bare(b5); g5.y = 5; lane(g5, 4, { k: 2, v: 0, sp: 10, len: 4, ph: 900 });
  g5.x = 8.6; hop(b5, UP, 10); assert.equal(g5.y, 4, "centre 9.1 is within 0.2 of the log's end 9");
  const b6 = mkAb(), g6 = bare(b6); g6.y = 5; lane(g6, 4, { k: 2, v: 0, sp: 10, len: 4, ph: 900 });
  g6.x = 9; hop(b6, UP, 10); assert.equal(g6.y, 5, "centre 9.5 is not");
}

// ── deliveries: 100 + the time left (3 a second, ≤ 60) + 50 clean; then a new street
{
  const ab = mkAb();
  const g = bare(ab);
  g.y = 1; lane(g, 1, { k: 2, v: 0, sp: 10, len: 4, ph: 900 }); g.d = 5; g.n = 2;
  const d0 = g.d;
  R.adv(null, null, ab, 5000);
  assert.equal(R.act(null, null, ab, { d: UP }, 5000), null);
  assert.equal(ab.score, 210, "100 + 60 (a quick one) + 50 (clean)"); assert.equal(ab.combo, 1);
  assert.equal(g.n, 3); assert.equal(g.d, d0 + 1, "the next delivery"); assert.equal(g.y, C.SY); assert.equal(g.x, C.SX); assert.equal(g.goal, 0);
  assert.deepEqual(g.ev.slice(1, 2), [2], "event: delivered clean"); assert.equal(g.ev[2], 210);
  assert.equal(g.dAt, 5000, "the new street begins now"); assert.equal(g.stepAt, 5000 + C.PAUSE, "a short pause");
  assert.ok(g.L[1] && g.L[1].k === 2 && g.L[6].k === 0, "a full street");
  // a slow, unclean delivery: only 100
  const b2 = mkAb(), g2 = bare(b2); g2.y = 1; g2.d = 5; g2.dAt = 0; g2.hit = 1; lane(g2, 1, { k: 2, v: 0, sp: 10, len: 4, ph: 900 });
  R.adv(null, null, b2, 40000); R.act(null, null, b2, { d: UP }, 40000);
  assert.equal(b2.score, 100, "no time bonus, no clean bonus"); assert.equal(g2.ev[1], 1);
  // the time bonus: 3 a second of the budget that is left
  const b3 = mkAb(), g3 = bare(b3); g3.y = 1; g3.d = 5; g3.dAt = 0; lane(g3, 1, { k: 2, v: 0, sp: 10, len: 4, ph: 900 });
  R.adv(null, null, b3, 20000); R.act(null, null, b3, { d: UP }, 20000);
  assert.equal(b3.score, 100 + 18 + 50, "6 s left → +18");
  // the first delivery is the short one: the drop-off is the median
  const b4 = mkAb(), g4 = bare(b4, 5); g4.d = 0; g4.y = 6;
  assert.equal(R.act(null, null, b4, { d: UP }, 0), null);
  assert.equal(g4.n, 1); assert.equal(g4.d, 1); assert.equal(g4.goal, 0, "then the whole street");
  assert.equal(b4.score, 100 + 36 + 50, "the short budget is 12 s: a quick one earns 36");
  // a delivery in a fever and in the rush is multiplied by the engine
  const b5 = mkAb(1, 100000), g5 = bare(b5); g5.y = 1; g5.d = 5; g5.dAt = 90000; lane(g5, 1, { k: 2, v: 0, sp: 10, len: 4, ph: 900 });
  b5.feverUntil = 1e9;
  R.adv(null, null, b5, 91000); R.act(null, null, b5, { d: UP }, 91000);
  assert.equal(b5.score, Math.round(210 * 2 * 1.5), "fever ×2 and the last 15 seconds ×1.5");
}

// ── gifts: +30 for the cell, or for the log that carries one
{
  const ab = mkAb();
  const g = bare(ab);
  g.gifts = [{ y: 9, j: -1, a: 6, got: 0 }];
  assert.equal(hop(ab, UP, 10), null);
  assert.equal(ab.score, 30, "a gift on the road: +30"); assert.equal(ab.combo, 1); assert.equal(g.gifts[0].got, 1); assert.deepEqual(g.ev.slice(1), [5, 30]);
  hop(ab, DOWN, 400); hop(ab, UP, 800); assert.equal(ab.score, 30, "taken once");
  const b2 = mkAb(), g2 = bare(b2); g2.gifts = [{ y: 9, j: -1, a: 7, got: 0 }];
  hop(b2, UP, 10); assert.equal(b2.score, 0, "the next cell is not the gift");
  // on a log: it rides along
  const b3 = mkAb(), g3 = bare(b3); g3.y = 5; lane(g3, 4, { k: 2, v: 10, sp: 10, len: 4, ph: 900 });
  g3.gifts = [{ y: 4, j: 0, a: 1, got: 0 }];   // on the log's second cell
  assert.ok(Math.abs(X.crossPos(g3, g3.L[4], 0, 0) - 5) < 1e-9);
  R.adv(null, null, b3, 1000);   // the log (and its gift) moved one cell right: the gift is at cell 7
  g3.x = 7; hop(b3, UP, 1010);
  assert.equal(g3.y, 4); assert.equal(b3.score, 30, "the gift on the log");
}

// ── the hop: cooldown, fever, edges
{
  const ab = mkAb();
  const g = bare(ab);
  assert.equal(hop(ab, LEFT, 10), null); assert.equal(g.x, 5);
  assert.equal(hop(ab, LEFT, 100), "wait", "300 ms between hops");
  assert.equal(hop(ab, LEFT, 250), "wait");
  assert.equal(hop(ab, LEFT, 350), null, "on the grid tick 300 ms later"); assert.equal(g.x, 4);
  ab.feverUntil = 1e9;
  assert.equal(hop(ab, LEFT, 650), null); assert.equal(g.x, 3);
  assert.equal(hop(ab, LEFT, 700), "wait");
  assert.equal(hop(ab, LEFT, 800), null, "in a fever twice as often (150 ms)"); assert.equal(g.x, 2);
  assert.equal(hop(ab, DOWN, 1000), "edge", "nothing below the start");
  const b2 = mkAb(), g2 = bare(b2); g2.x = 0; assert.equal(hop(b2, LEFT, 10), "edge", "the street's edge"); assert.equal(g2.x, 0);
  g2.x = C.W - 1; assert.equal(hop(b2, RIGHT, 400), "edge"); assert.equal(g2.x, C.W - 1);
  const b3 = mkAb(), g3 = bare(b3); g3.y = 0; assert.equal(hop(b3, UP, 10), "edge", "nothing above the drop-off");
  // the same inputs with other values
  for (const d of [-1, 4, 1.5, NaN, Infinity, "1", null, undefined, [1], {}, true, 1e300]) assert.equal(R.act(null, null, mkAb(), { d }, 0), "bad");
}

// ── the clock: whole steps, in order, and a stall is survived
{
  const ab = mkAb();
  R.adv(null, null, ab, 130);
  assert.equal(ab.g.simAt, 100, "whole 50 ms steps only");
  const rev = ab.rev; R.adv(null, null, ab, 140); assert.equal(ab.rev, rev, "nothing happened: the view is unchanged");
  const a2 = mkAb(); for (let t = 0; t <= 130; t += 10) R.adv(null, null, a2, t);
  assert.equal(a2.g.simAt, 100);
  R.adv(null, null, ab, 1500); R.adv(null, null, ab, 2600);
  assert.ok(ab.rev > rev, "resent about once a second");
  const a3 = mkAb(); R.adv(null, null, a3, 1e9);
  assert.ok(a3.g.simAt > 1e9 - 100 && a3.g.simAt <= 1e9, "a long stall jumps ahead"); assert.ok(a3.g.y >= a3.g.goal && a3.g.y <= C.SY && a3.score >= 0);
  const a4 = mkAb(), g4 = bare(a4); g4.y = 4; g4.x = 6; lane(g4, 4, { k: 2, v: 20, sp: 10, len: 4, ph: 900 });
  R.adv(null, null, a4, 600000);
  assert.equal(g4.y, 5, "a rider carried through a stall is in the water");
}

// ── the view: plain JSON, compact, the lanes and the gifts
{
  const ab = mkAb();
  R.adv(null, null, ab, 5230);
  const v = R.view(ab, 5230);
  assert.equal(v[1], C.SY); assert.equal(v[0], C.SX * 100); assert.equal(v[3], 5, "the first drop-off is the median"); assert.equal(v[4], 0); assert.equal(v[5], 0);
  assert.equal(v[6].length, 8, "eight lanes"); assert.ok(v[6].every((l) => l.length === 6)); assert.ok(v[7].length === 1);
  assert.ok(v[2] >= 0 && v[9] === 0 && v[11] >= 0);
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v, "plain JSON");
  assert.ok(JSON.stringify(v).length < 500, `compact (${JSON.stringify(v).length} bytes)`);
  // the lanes in the view reproduce the server's positions
  const l = v[6][3], ln = ab.g.L[l[0]];
  assert.ok(Math.abs(l[5] / 100 - X.crossPhase(ab.g, ln, 5230)) < 0.006, "the phase in the view");
  // before the lanes run: the lanes stand and the view says when they start
  const b2 = mkAb(); b2.runAt = 6000; b2.g.dAt = 6000; b2.g.simAt = 6000; b2.g.stepAt = 6000;
  const v2 = R.view(b2, 2000);
  assert.equal(v2[9], 4000, "ms until the lanes start");
  assert.ok(Math.abs(v2[6][0][5] / 100 - X.crossPhase(b2.g, b2.g.L[v2[6][0][0]], 6000)) < 0.006, "the brief shows the lanes at the start");
}

// ── whole shifts through the real engine
const sim = (name, seed = 1) => {
  const S = L.setup();
  let now = 5_000_000 + seed * 7919;
  S.now = now;
  L.addPlayer(S, "p1", L.hero(name, { wk: "sword", lvl: 30, migrate: true }));
  const p = S.players.p1;
  const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
  assert.ok(act({ t: "ab_start", k: "cross" }).ok);
  return {
    S, p, act, get now() { return now; }, set now(v) { now = v; },
    tick(ms = 100) { now += ms; S.now = now; L.tick(S, now); const v = L.viewFor(S, "p1"); L.endTick(S); return v; },
  };
};
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// the perfect bot's brain: a breadth-first search over the real rules (crossHop / crossMove / crossUnder), a hop per ready 50 ms slice or a wait.
function planner(ab, { mg = 0.05, horizon = 140, lead = 0 } = {}) {
  const g = ab.g, T0 = g.simAt, first = Math.max(0, Math.ceil((g.stepAt - T0) / STEP), Math.ceil(lead / STEP));
  const st = (x, y, t) => ({ L: g.L, dAt: g.dAt, x, y, simAt: t, goal: g.goal, mg });
  const seen = new Set(), fr = [];
  const push = (k, n) => { const key = `${k}|${n.y}|${Math.round(n.x * 20)}`; if (seen.has(key)) return; seen.add(key); (fr[k] ||= []).push(n); };
  push(0, { x: g.x, y: g.y, par: null, d: -1, k: 0 });
  let best = null;
  const path = (n, last) => {
    const out = last ? [last] : [];
    for (let q = n; q && q.par; q = q.par) if (q.d >= 0) out.unshift({ t: T0 + q.mk * STEP, d: q.d, x: q.par.x, y: q.par.y });
    return out;
  };
  for (let k = 0; k < horizon; k++) {
    for (const n of fr[k] || []) {
      const t = T0 + k * STEP;
      if (!best || n.k > best.k || (n.k === best.k && n.y < best.y)) best = n;   // the furthest alive, then the nearest to the goal
      const w = st(n.x, n.y, t);
      if (!X.crossMove(w, t + STEP)) push(k + 1, { x: w.x, y: w.y, par: n, d: -1, k: k + 1 });
      if (k < first) continue;
      for (const d of [UP, LEFT, RIGHT, DOWN]) {
        const s2 = st(n.x, n.y, t), to = X.crossHop(s2, d);
        if (!to) continue;
        s2.x = to[0]; s2.y = to[1];
        if (X.crossUnder(s2, t)) continue;
        if (s2.y === g.goal) return path(n, { t, d, x: n.x, y: n.y });
        const cd = (t < ab.feverUntil ? C.CD_FEVER : C.CD) / STEP;
        let dead = false;
        for (let i = 1; i <= cd && !dead; i++) dead = !!X.crossMove(s2, t + i * STEP);
        if (!dead) push(k + cd, { x: s2.x, y: s2.y, par: n, d, mk: k, k: k + cd });
      }
    }
  }
  return best ? path(best) : [];
}
const perfectBot = (opts = {}) => {
  let plan = [];
  return {
    step(s, now) {
      const ab = s.p.ab;
      X.albaAdvance(s.S, s.p, ab, now);
      const g = ab.g;
      if (!plan.length) plan = planner(ab, opts);
      if (!plan.length) return now + STEP;
      const m = plan[0];
      if (g.simAt < m.t) return m.t + 10;
      if (g.simAt !== m.t || g.y !== m.y || Math.abs(g.x - m.x) > 1e-6) { plan = []; return now + 1; }
      s.act({ t: "ab_act", d: m.d });
      plan.shift();
      return plan.length ? plan[0].t + 10 : now + 10;
    },
  };
};
/** Would a hop `d` (or none: -1), landing at grid time `ta` (+ any of `jit` ms either way: his thumb is not exact), leave the courier alive for `hold` ms? */
function safeHop(ab, d, ta, hold, jit) {
  const g = ab.g;
  for (const dt of jit ? [-jit, 0, jit] : [0]) {
    const w = { L: g.L, dAt: g.dAt, x: g.x, y: g.y, simAt: g.simAt, goal: g.goal };
    const tl = Math.max(g.simAt, Math.ceil((ta + dt) / STEP) * STEP);
    let t = g.simAt;
    while (t + STEP <= tl) { t += STEP; if (X.crossMove(w, t)) return false; }
    if (d >= 0) {
      const to = X.crossHop(w, d);
      if (!to) return false;
      w.x = to[0]; w.y = to[1];
      if (X.crossUnder(w, t)) return false;
      if (w.y === g.goal) continue;
    }
    for (let q = STEP; q <= hold; q += STEP) if (X.crossMove(w, t + q)) return false;
  }
  return true;
}
/** A person: he looks at the street, hops up when the next row is clear for `hold` ms (also if his thumb is `jit` ms off), waits while it is not, steps aside when
 *  his own row is about to hit him. His thumb lands `lat` ms after the decision (he allows `lead` for it); now and then (`err`) he jumps early without looking. */
function humanBot(rng, { lat = [150, 400], lead = 275, hold = 400, jit = 150, err = 0.1, poll = 60 }) {
  return {
    step(s, now) {
      const ab = s.p.ab;
      X.albaAdvance(s.S, s.p, ab, now);
      const g = ab.g, ta = Math.max(g.simAt + Math.ceil(lead / STEP) * STEP, Math.ceil(g.stepAt / STEP) * STEP), wait = lat[0] + rng() * (lat[1] - lat[0]);
      let d = -1;
      if (rng() < err * (poll / 300)) return { at: now + wait, d: UP };   // impatience
      if (safeHop(ab, UP, ta, hold, jit)) d = UP;
      else if (!safeHop(ab, -1, ta, hold, 0)) { const o = rng() < 0.5 ? [LEFT, RIGHT, DOWN] : [RIGHT, LEFT, DOWN]; d = o.find((q) => safeHop(ab, q, ta, hold, jit)) ?? -1; }
      return d < 0 ? now + poll : { at: now + wait, d };
    },
  };
}
function play(botOf, seed, { name = `횡단${seed}`, hook } = {}) {
  const rng = mulberry(seed * 977 + 13), s = sim(name, seed), bot = botOf ? botOf(rng) : null, ab = s.p.ab;
  let nextTick = s.now + 100, wake = ab.runAt + 20, pend = null, maxBytes = 0, seq = 0, hits = 0, drown = 0, gifts = 0;
  const send = (d) => { const v = s.act({ t: "ab_act", d }); if (!v.ok) throw new Error("refused " + JSON.stringify(v)); };
  while (s.now < ab.endAt + 100) {
    const t = pend ? Math.min(pend.at, wake) : wake;
    if (bot && t <= nextTick) {
      s.now = t;
      if (pend && pend.at <= t) { send(pend.d); pend = null; wake = Math.max(wake, t + 1); }
      else if (!pend) { const r = bot.step(s, t); if (typeof r === "number") wake = Math.max(r, t + 1); else { pend = r; wake = r.at + 1; } }
      else wake = t + 1;
    } else {
      s.now = nextTick;
      const v = s.tick(0);
      nextTick += 100;
      const ev = ab.g.ev;
      if (ev[0] !== seq) { seq = ev[0]; if (ev[1] === 3) hits++; else if (ev[1] === 4) drown++; else if (ev[1] === 5) gifts++; }
      if (v.ab && v.ab[7]) maxBytes = Math.max(maxBytes, JSON.stringify(v.ab[7]).length);
      if (hook) hook(s, v);
    }
  }
  return { score: ab.score, grade: X.albaGrade("cross", ab.score), n: ab.g.n, hits, drown, gifts, maxBytes, maxCombo: ab.maxCombo, state: ab.state };
}

// (c) the bots
const BOTS = {
  oracle: () => perfectBot(),   // the ceiling: a search over the real rules that knows every future (information only)
  perfect: (rng) => humanBot(rng, { lat: [0, 0], lead: 0, hold: 250, jit: 0, err: 0, poll: 50 }),
  strong: (rng) => humanBot(rng, { lat: [150, 250], lead: 200, hold: 350, jit: 100, err: 0.03 }),
  human: (rng) => humanBot(rng, { lat: [150, 400], lead: 275, hold: 400, jit: 175, err: 0.1 }),
  casual: (rng) => humanBot(rng, { lat: [300, 700], lead: 500, hold: 450, jit: 250, err: 0.2 }),
};
const SEEDS = [1, 2, 3, 4, 5];
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
const results = {};
let viewMax = 0;
for (const [nm, mk] of Object.entries(BOTS)) {
  const t0 = performance.now();
  results[nm] = SEEDS.map((seed) => play(mk, seed));
  results[nm].ms = Math.round(performance.now() - t0);
  for (const r of results[nm]) { assert.equal(r.state, "end"); viewMax = Math.max(viewMax, r.maxBytes); }
}
const idle = play(null, 9);
console.log(`cross: par ${PAR}  (C ${Math.round(PAR * T.cuts[0])} B ${Math.round(PAR * T.cuts[1])} A ${Math.round(PAR * T.cuts[2])} S ${PAR})`);
for (const [nm, rs] of Object.entries(results)) console.log(`  ${nm.padEnd(8)} scores ${rs.map((r) => r.score).join(" ")}  grades ${rs.map((r) => "-CBAS"[r.grade]).join("")}  deliveries ${rs.map((r) => r.n).join(",")}  hits ${rs.map((r) => r.hits).join(",")} water ${rs.map((r) => r.drown).join(",")} gifts ${rs.map((r) => r.gifts).join(",")} combo ${rs.map((r) => r.maxCombo).join(",")}  avg ${avg(rs.map((r) => r.score))} = ${(avg(rs.map((r) => r.score)) / PAR).toFixed(2)} par  (${rs.ms} ms)`);
console.log(`  idle     score ${idle.score} grade ${"-CBAS"[idle.grade]}   view max ${viewMax} bytes`);
assert.ok(results.perfect.every((r) => r.grade === 4), "the perfect bot reaches S every time");
{
  const m = avg(results.human.map((r) => r.score)) / PAR;
  assert.ok(m >= 0.6 && m <= 0.9, `the human-like bot lands around B (${m.toFixed(2)} of par)`);
  const c = avg(results.casual.map((r) => r.score)) / PAR;
  assert.ok(c >= 0.3 && c <= 0.7, `the casual bot lands around C (${c.toFixed(2)} of par)`);
}
assert.ok(avg(results.perfect.map((r) => r.score)) > avg(results.strong.map((r) => r.score)), "better play scores more");
assert.ok(avg(results.strong.map((r) => r.score)) > avg(results.human.map((r) => r.score)));
assert.ok(avg(results.human.map((r) => r.score)) > avg(results.casual.map((r) => r.score)));
assert.equal(idle.grade, 0, "an idle player gets no grade"); assert.equal(idle.score, 0, "and no points");
assert.ok(viewMax < 500, `the view stays small (${viewMax} bytes)`);

// (a) determinism: the same seed and the same inputs play the same shift
{
  const a = play(BOTS.human, 3), b = play(BOTS.human, 3);
  assert.deepEqual(a, b, "same seed, same inputs: the same shift");
  const c = play(BOTS.human, 3, { name: "횡단다른" });
  assert.notDeepEqual([c.score, c.n, c.hits], [a.score, a.n, a.hits], "another seed plays differently");
  const lay = (seed, d) => JSON.stringify(X.crossBuild(seed, d, 1));
  assert.equal(lay(5, 3), lay(5, 3)); assert.notEqual(lay(5, 3), lay(6, 3)); assert.notEqual(lay(5, 3), lay(5, 4));
  // the street of a delivery is the seed's, whoever plays
  const streets = (bot) => { const out = []; let last = -1; play(bot, 4, { hook: (s) => { const g = s.p.ab.g; if (g.d !== last && out.length < 4) { last = g.d; out.push(JSON.stringify(g.L)); } } }); return out.slice(0, 3).join("|"); };
  assert.equal(streets(BOTS.perfect), streets(BOTS.casual), "the streets are the seed's, whoever plays");
}

// (d) hostile input: nothing throws, nothing counts, the courier stays on the street
{
  const s = sim("횡단해커", 2), ab = s.p.ab, g = ab.g;
  const snap = () => JSON.stringify(g);
  const junk = [{}, { d: "1" }, { d: 1.5 }, { d: -1 }, { d: 4 }, { d: 1e300 }, { d: NaN }, { d: Infinity }, { d: null }, { d: [1] }, { d: { a: 1 } }, { d: true }, { d: "__proto__" }, { d: "0" }, { d: -0.0001 },
    { x: 5, y: 5 }, { k: "pipe" }, { d: 9, x: 99, y: -3 }, { goal: 0, d: 7 }, { g: { y: 0 } }, { d: [0] }, { d: () => 0 }];
  s.act({ t: "ab_act", d: 0 });
  const before = snap();
  for (let i = 0; i < 2; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; }
  assert.equal(snap(), before, "the brief ignores every input");
  s.tick(T.briefMs + 200);
  for (let i = 0; i < 3; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; assert.doesNotThrow(() => s.tick(0)); }
  assert.ok(g.y >= g.goal && g.y <= C.SY && g.x >= -0.5 && g.x <= C.W - 0.5, "the courier is on the street");
  assert.equal(ab.score, 0, "hostile input scores nothing"); assert.equal(g.acc, 0, "and moves nobody");
  // spam inside the rate limit: only the inputs 35 ms apart count, and a hop's cooldown still holds
  s.tick(500);
  let acc = 0, last = ab.lastAct;
  for (let i = 0; i < 60; i++) { s.now += 5; s.act({ t: "ab_act", d: i % 2 ? 1 : 3 }); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.ok(acc <= 9, `60 inputs in 300 ms: only those ${acc} 35 ms apart reached the game`);
  assert.ok(g.acc <= 2, `and the 300 ms cooldown let ${g.acc} hops through`);
  acc = 0; last = ab.lastAct; s.now += 400;
  for (let i = 0; i < 50; i++) { s.act({ t: "ab_act", d: 3 }); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.equal(acc, 1, "50 inputs in the same instant: one counts");
  // a random walk of all four directions all shift long: always on the street, never a negative score, rows in range
  const rng = mulberry(99), s2 = sim("횡단술꾼", 3), ab2 = s2.p.ab, g2 = ab2.g;
  s2.tick(T.briefMs + 100);
  for (let i = 0; s2.now < ab2.endAt - 300; i++) {
    s2.now += 40 + Math.floor(rng() * 160); s2.act({ t: "ab_act", d: Math.floor(rng() * 4) });
    if (i % 3 === 0) s2.tick(0);
    assert.ok(g2.y >= g2.goal && g2.y <= C.SY && g2.x >= -0.5 - 1e-9 && g2.x <= C.W - 0.5 + 1e-9 && ab2.score >= 0, `sane at ${i}: ${g2.x},${g2.y}`);
  }
  assert.ok(g2.acc > 190, "a random walk hopped a lot");
  // after the end nothing moves
  s.tick(T.runMs + 1000);
  assert.equal(ab.state, "end");
  const done = snap(), sc = ab.score;
  for (const d of [0, 1, 2, 3]) { s.now += 50; s.act({ t: "ab_act", d }); }
  assert.equal(snap(), done, "after the end the street is frozen"); assert.equal(ab.score, sc);
}

// (e) the server's cost: 90 simulated seconds, 10 ticks/s, a hop every 150 ms
{
  const s = sim("횡단부하", 7), ab = s.p.ab, rng = mulberry(5);
  let ms = 0, views = 0, bytes = 0, vmax = 0, sent = 0;
  for (let i = 0; i < (T.briefMs + T.runMs) / 100; i++) {
    if (i % 3 !== 2) { s.act({ t: "ab_act", d: [0, 0, 1, 3, 0, 2][Math.floor(rng() * 6)] }); }
    const t0 = performance.now();
    const v = s.tick(100);
    ms += performance.now() - t0; views++;
    if (v.ab && v.ab[7]) { const b = JSON.stringify(v.ab[7]).length; bytes += b; sent++; vmax = Math.max(vmax, b); }
  }
  console.log(`  server: ${views} ticks + views in ${ms.toFixed(1)} ms (${(ms / 1.6).toFixed(2)} ms per simulated minute) · ${sent} views, max ${vmax} B, avg ${Math.round(bytes / Math.max(1, sent))} B`);
  assert.ok(ms / 1.6 < 100, "far below 100 ms per simulated minute");
  assert.equal(ab.state, "end");
}

console.log("alba-cross: ok");
