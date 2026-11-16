// 일일 아르바이트 · 화환 엮기 (67-alba-garland.js): the rules (steps, turns and no reversal, flowers, golden flower, walls / thorns / self, the pause, garlands, speed, fever),
// the garden's fairness (thorns never touch, always connected), determinism, hostile input, the view's size, the server's cost, and bots that play whole shifts.
// node tests/alba-garland.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, GAR, garInt, garStep, albaGrade, albaAdvance };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, R = X.ALBA_RULES.garland, GAR = X.GAR, T = X.ALBA_T, PAR = X.ALBA.garland.par, W = GAR.W;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const cell = (x, y) => y * W + x;
const xy = (c) => [c % W, (c / W) | 0];

// ── unit harness: a bare shift object whose clock starts at 0 (runAt 0)
const mkAb = (seed = 7) => {
  const ab = { k: "garland", box: { seed }, runAt: 0, endAt: 1e9, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null };
  R.init(null, null, ab);
  return ab;
};
/** chain: [[x, y]…] tail first, head last; the thorn clock is parked far away so a test sees only what it sets up */
function setup(ab, { chain, dir = 1, f = [], th = [], gold = null, q = [] }) {
  const g = ab.g;
  g.c = chain.map(([x, y]) => cell(x, y)); g.dir = dir; g.f = f.map(([x, y]) => cell(x, y)); g.th = th.map(([x, y]) => cell(x, y)); g.q = q.slice();
  g.gold = gold ? { c: cell(gold[0], gold[1]), until: gold[2] ?? 1e9 } : null; g.thAt = 1e12; g.goldAt = 1e12; g.simAt = 1000;
  return ab;
}
const row = (x0, y, n) => Array.from({ length: n }, (_, i) => [x0 + i, y]);
const step = (ab) => { const t = ab.g.simAt; R.adv(null, null, ab, t); return t; };
const head = (ab) => xy(ab.g.c.at(-1));

// movement: one cell per step, on the clock
{
  const ab = setup(mkAb(), { chain: row(6, 8, 3) });
  assert.deepEqual(ab.g.c, [cell(6, 8), cell(7, 8), cell(8, 8)]);
  R.adv(null, null, ab, 999); assert.equal(ab.g.n, 0, "nothing before the step is due");
  const rev = ab.rev, t = step(ab);
  assert.deepEqual(ab.g.c, [cell(7, 8), cell(8, 8), cell(9, 8)], "one cell on"); assert.equal(ab.g.simAt, t + GAR.base, "the next step is one interval later"); assert.ok(ab.rev > rev, "the view changes with every step");
  R.adv(null, null, ab, ab.g.simAt + GAR.base * 2 + 5); assert.equal(ab.g.n, 4, "several steps due: all applied, in order");
  assert.deepEqual(head(ab), [12, 8]);
}
// the step clock: 143 ms to start, faster with every garland, never below 100, ×1.35 slower in a fever
{
  const g = { done: 0 };
  assert.equal(X.garInt(g, { feverUntil: 0 }, 0), 143); assert.equal(Math.round(1000 / 143), 7, "about 7 steps a second to start");
  g.done = 1; assert.equal(X.garInt(g, { feverUntil: 0 }, 0), 137, "faster with every garland");
  g.done = 3; assert.equal(X.garInt(g, { feverUntil: 0 }, 0), Math.round(143 * 0.96 ** 3));
  g.done = 99; assert.equal(X.garInt(g, { feverUntil: 0 }, 0), 110, "never faster than 110 ms");
  g.done = 0; assert.equal(X.garInt(g, { feverUntil: 500 }, 100), 193, "a fever (봄바람) slows the chain");
  assert.equal(X.garInt(g, { feverUntil: 500 }, 600), 143, "and ends");
}

// turns: queued for the next step, no reversal, at most one turn per step
{
  const ab = setup(mkAb(), { chain: row(6, 8, 3), dir: 1 });
  assert.equal(R.act(null, null, ab, { d: 0 }, 10), null); assert.deepEqual(ab.g.q, [0]);
  assert.equal(R.act(null, null, ab, { d: 2 }, 11), null); assert.deepEqual(ab.g.q, [0], "down right after up is the reverse of the last turn: ignored");
  assert.equal(R.act(null, null, ab, { d: 0 }, 12), null); assert.deepEqual(ab.g.q, [0], "the same heading twice: nothing to do");
  assert.equal(R.act(null, null, ab, { d: 3 }, 13), null); assert.deepEqual(ab.g.q, [0, 3], "up then left: two turns queued");
  assert.equal(R.act(null, null, ab, { d: 2 }, 14), null); assert.deepEqual(ab.g.q, [0, 3], "the queue holds two");
  step(ab); assert.equal(ab.g.dir, 0); assert.deepEqual(head(ab), [8, 7], "the first turn is taken by the next step"); assert.deepEqual(ab.g.q, [3]);
  step(ab); assert.equal(ab.g.dir, 3); assert.deepEqual(head(ab), [7, 7], "one turn per step"); assert.deepEqual(ab.g.q, []);
  const bb = setup(mkAb(), { chain: row(6, 8, 3), dir: 1 });
  R.act(null, null, bb, { d: 3 }, 10); assert.deepEqual(bb.g.q, [], "no instant reversal into itself");
  R.act(null, null, bb, { d: 1 }, 10); assert.deepEqual(bb.g.q, [], "straight on needs no turn");
  assert.equal(R.act(null, null, bb, { d: 2 }, 10), null); assert.deepEqual(bb.g.q, [2]);
  step(bb); assert.deepEqual(head(bb), [8, 9]);
  const rev = bb.rev; R.act(null, null, bb, { d: 0 }, 20); assert.equal(bb.rev, rev, "a turn alone does not resend the view (the next step does)");
}

// flowers: +10, the chain grows, a new flower appears
{
  const ab = setup(mkAb(), { chain: row(6, 8, 3), f: [[9, 8], [1, 1]] });
  step(ab);
  assert.equal(ab.g.c.length, 4, "a flower lengthens the chain"); assert.equal(ab.score, 10); assert.equal(ab.combo, 1);
  assert.equal(ab.g.f.length, GAR.flowers, "a new flower grows"); assert.ok(!ab.g.f.includes(cell(9, 8)) && ab.g.f.includes(cell(1, 1)));
  assert.deepEqual(ab.g.ev.slice(1), [1, cell(9, 8)], "the event says flower, where");
  const free = ab.g.f.every((c) => !ab.g.c.includes(c) && !ab.g.th.includes(c)); assert.ok(free);
  const nf = ab.g.f.find((c) => c !== cell(1, 1)), [fx, fy] = xy(nf), [hx, hy] = head(ab);
  assert.ok(Math.abs(fx - hx) + Math.abs(fy - hy) >= GAR.near, "a new flower is not put under the head's nose");
  step(ab); assert.equal(ab.g.c.length, 4, "a plain step keeps the length");
}
// a golden flower: +50 while it lasts
{
  const ab = setup(mkAb(), { chain: row(6, 8, 3), gold: [9, 8, 5000] });
  step(ab); assert.equal(ab.score, 50); assert.equal(ab.g.c.length, 4); assert.equal(ab.g.gold, null); assert.equal(ab.g.ev[1], 2);
  const bb = setup(mkAb(), { chain: row(6, 8, 3), gold: [9, 8, 1000] });
  step(bb); assert.equal(bb.score, 0, "gone by the time the chain arrives"); assert.equal(bb.g.c.length, 3); assert.equal(bb.g.gold, null);
  const cc = setup(mkAb(), { chain: row(6, 8, 3) }); cc.g.goldAt = 1000; cc.g.simAt = 1000; step(cc);
  assert.ok(cc.g.gold && cc.g.gold.until === 1000 + GAR.goldLife, "the golden flower comes on its clock and stays 6 s"); assert.ok(cc.g.goldAt > 1000 + GAR.goldLife);
}
// a combo multiplies flowers, a fever doubles them
{
  const ab = setup(mkAb(), { chain: row(2, 8, 3), f: [[5, 8], [6, 8]] });
  ab.combo = 3; step(ab); step(ab); assert.equal(ab.score, Math.round(10 * 1.3) + Math.round(10 * 1.4));
}

// walls: the chain is cut to a 3-link stub, −40, combo broken, a pause, no game over
for (const [name, chain, dir, expDir] of [
  ["right wall", row(10, 8, 6), 1, [0, 2]], ["left wall", row(0, 8, 6).reverse(), 3, [0, 2]],
  ["top wall", Array.from({ length: 6 }, (_, i) => [5, 5 - i]).reverse(), 0, [1, 3]], ["bottom wall", Array.from({ length: 6 }, (_, i) => [5, 10 + i]), 2, [1, 3]]]) {
  const ab = setup(mkAb(), { chain, dir });
  ab.score = 100; ab.combo = 4; ab.g.done = 2;
  // walk until the wall
  let crashed = false;
  for (let i = 0; i < 20 && !crashed; i++) { const s0 = ab.g.hits; step(ab); crashed = ab.g.hits > s0; }
  assert.ok(crashed, `${name}: the chain reaches the wall`);
  assert.equal(ab.score, 60, `${name}: −40`); assert.equal(ab.combo, 0); assert.equal(ab.g.c.length, GAR.stub, "a stub"); assert.equal(ab.g.done, 2, "garlands already finished stay finished");
  assert.ok(expDir.includes(ab.g.dir), `${name}: the stub turns away from the wall (${ab.g.dir})`);
  assert.equal(ab.g.ev[1], 8);
  const h = xy(ab.g.c.at(-1)); assert.ok(h[0] >= 0 && h[0] < W && h[1] >= 0 && h[1] < W, "the head stays in the garden");
  assert.ok(ab.g.simAt >= 1000 + GAR.pause, "a pause");
}
{
  const ab = setup(mkAb(), { chain: row(12, 8, 3) }); ab.score = 30; ab.combo = 2;
  step(ab); const at = ab.g.simAt; assert.deepEqual(head(ab), [15, 8]);
  step(ab); assert.equal(ab.score, 0, "never below 0"); assert.equal(ab.g.simAt, at + GAR.pause, "1.5 s pause after the crash");
  R.adv(null, null, ab, at + GAR.pause - 1); assert.equal(ab.g.n, 2, "nothing moves during the pause");
  R.act(null, null, ab, { d: 2 }, at + 100);   // the player may already queue a turn for when it ends
  const nb = ab.g.dir; R.adv(null, null, ab, at + GAR.pause); assert.equal(ab.g.n, 3, "and it goes on afterwards"); assert.ok(ab.g.dir === 2 || ab.g.dir === nb);
}
// thorns and the chain itself
{
  const ab = setup(mkAb(), { chain: row(6, 8, 3), th: [[9, 8]] }); ab.score = 80; ab.combo = 3;
  step(ab); assert.equal(ab.score, 40); assert.equal(ab.combo, 0); assert.equal(ab.g.c.length, 3); assert.deepEqual(head(ab), [8, 8], "the head stops before the thorn");
  assert.ok(ab.g.dir !== 1, "and does not run into it again");
  // its own body: a hook; turning up into cell (5,4) which is body cell 1
  const bb = setup(mkAb(), { chain: [[4, 4], [5, 4], [6, 4], [6, 5], [5, 5]], dir: 3, q: [0] }); bb.score = 100;
  step(bb); assert.equal(bb.score, 60, "ran into itself"); assert.equal(bb.g.c.length, 3); assert.deepEqual(bb.g.c, [cell(6, 4), cell(6, 5), cell(5, 5)].slice(0), "the stub is the last three links");
  // the tail's cell is free again when the chain moves on
  const cc = setup(mkAb(), { chain: [[5, 5], [6, 5], [6, 6], [5, 6]], dir: 0 }); cc.score = 100;
  step(cc); assert.equal(cc.score, 100, "chasing its own tail is fine"); assert.equal(cc.g.c.length, 4); assert.deepEqual(head(cc), [5, 5]);
  // a stub cornered by thorns and its own neck is set down somewhere free
  const ee = setup(mkAb(), { chain: [[2, 0], [1, 0], [0, 0]], dir: 3, th: [[0, 1]] }); ee.g.c = [cell(2, 0), cell(1, 0), cell(0, 0)]; ee.score = 50;
  step(ee); assert.equal(ee.score, 10); assert.equal(ee.g.c.length, 3);
  assert.ok(ee.g.c.every((c) => !ee.g.th.includes(c)) && ee.g.c.every((c, i, a) => i === 0 || Math.abs(c - a[i - 1]) === 1 || Math.abs(c - a[i - 1]) === W), "a connected stub on free cells");
  const nh = xy(ee.g.c.at(-1)), nx = nh[0] + DX[ee.g.dir], ny = nh[1] + DY[ee.g.dir]; assert.ok(nx >= 0 && ny >= 0 && nx < W && ny < W, "heading into the garden");
}
// a finished garland: 12 links = +100, the chain restarts faster
{
  const ab = setup(mkAb(), { chain: row(1, 8, 11), f: [[12, 8]] }); ab.score = 0; ab.combo = 0;
  const t = step(ab);
  assert.equal(ab.g.done, 1); assert.equal(ab.g.c.length, GAR.stub, "the chain starts over as a stub"); assert.equal(ab.g.ev[1], 1 | 4);
  assert.equal(ab.score, 10 + Math.round(100 * 1.1), "the flower, then the garland (combo 1)"); assert.equal(ab.combo, 2);
  assert.equal(ab.g.simAt, t + 137, "and a notch faster");
  assert.deepEqual(ab.g.c, [cell(10, 8), cell(11, 8), cell(12, 8)], "the stub is the head's last links"); assert.equal(ab.g.dir, 1, "still heading on");
  const bb = setup(mkAb(), { chain: row(1, 8, 11), f: [[12, 8]] }); bb.g.th = [cell(15, 8)];
  step(bb); assert.ok(bb.g.dir !== 3, "the restarted stub never faces its own neck"); assert.equal(bb.g.hits, 0, "a garland is not a crash");
  const cc = setup(mkAb(), { chain: row(1, 8, 11), f: [[12, 8]] }); cc.g.th = [cell(14, 8)];
  step(cc); assert.notEqual(cc.g.dir, 1, "a thorn right ahead: the stub aims elsewhere");
}
// a fever slows the steps
{
  const ab = setup(mkAb(), { chain: row(6, 8, 3) }); ab.feverUntil = 5000;
  const t = step(ab); assert.equal(ab.g.simAt, t + 193);
}
// the catch-up cap: a long stall applies at most 40 steps and leaves a sane garden
{
  const ab = mkAb();
  R.adv(null, null, ab, 1e9);
  assert.ok(ab.g.n <= GAR.catchup && ab.g.simAt === 1e9, `a stall of any length: ≤ ${GAR.catchup} steps, then the clock is current`);
  assert.ok(ab.g.c.length >= GAR.stub && ab.g.c.every((c) => Number.isInteger(c) && c >= 0 && c < W * W) && ab.score >= 0);
  const bb = mkAb(); for (let t = 0; t <= 4000; t += 100) R.adv(null, null, bb, t); const cc = mkAb(); R.adv(null, null, cc, 4000);
  assert.deepEqual(bb.g, cc.g, "the same by small ticks or one big one");
}

// ── the garden over a whole shift with nobody playing: invariants at every step, many seeds
function gardenCheck(g, ab, label) {
  assert.ok(g.th.length <= GAR.thornMax, `${label}: at most ${GAR.thornMax} thorns`);
  const all = [...g.c, ...g.th, ...g.f, ...(g.gold ? [g.gold.c] : [])];
  assert.ok(all.every((c) => Number.isInteger(c) && c >= 0 && c < W * W), `${label}: every cell is in the garden`);
  assert.equal(new Set(all).size, all.length, `${label}: nothing shares a cell`);
  assert.ok(g.c.length >= GAR.stub && g.c.length < GAR.full, `${label}: chain length ${g.c.length}`);
  for (let i = 1; i < g.c.length; i++) { const [a, b] = [xy(g.c[i - 1]), xy(g.c[i])]; assert.equal(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1, `${label}: the chain is in one piece`); }
  for (const c of g.th) { const [x, y] = xy(c); for (const o of g.th) if (o !== c) { const [ox, oy] = xy(o); assert.ok(Math.max(Math.abs(x - ox), Math.abs(y - oy)) > 1, `${label}: two thorns touch`); } }
  assert.ok(g.f.length === GAR.flowers, `${label}: ${GAR.flowers} flowers`);
  assert.ok(Number.isFinite(ab.score) && ab.score >= 0);
}
function connected(g) {   // the free cells (no thorns) are one region
  const seen = new Set(), todo = [0];
  const th = new Set(g.th);
  let start = 0; while (th.has(start)) start++;
  todo[0] = start; seen.add(start);
  while (todo.length) {
    const c = todo.pop(), [x, y] = xy(c);
    for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d], n = cell(nx, ny); if (nx < 0 || ny < 0 || nx >= W || ny >= W || th.has(n) || seen.has(n)) continue; seen.add(n); todo.push(n); }
  }
  return seen.size === W * W - th.size;
}
{
  let thorns = 0, golds = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const ab = { k: "garland", box: { seed: seed * 7919 }, runAt: 0, endAt: T.runMs, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null };
    R.init(null, null, ab);
    gardenCheck(ab.g, ab, `seed ${seed} start`);
    let sawGold = false;
    for (let t = 0; t <= T.runMs; t += 50) {
      R.adv(null, null, ab, t);
      if (ab.g.gold) sawGold = true;
      if (ab.rev !== ab.__r) { gardenCheck(ab.g, ab, `seed ${seed} t ${t}`); ab.__r = ab.rev; }
    }
    assert.ok(connected(ab.g), `seed ${seed}: the garden stays one connected region`);
    assert.equal(ab.g.th.length, GAR.thornMax, "the thorns have all grown by the end of a shift");
    thorns += ab.g.th.length; golds += sawGold ? 1 : 0;
  }
  assert.equal(golds, 12, "a golden flower shows up in every shift");
  const first = (seed) => { const ab = mkAb(seed); ab.g.thAt = 20000; ab.g.simAt = 20000; ab.g.dir = 1; R.adv(null, null, ab, 20000); return ab.g.th.length; };
  assert.equal(first(5), 1, "the first thorn comes at 20 s");
}

// ── whole shifts through the real engine
const sim = (name, seed = 1) => {
  const S = L.setup();
  let now = 5_000_000 + seed * 7919;
  S.now = now;
  L.addPlayer(S, "p1", L.hero(name, { wk: "sword", lvl: 30, migrate: true }));
  const p = S.players.p1;
  const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
  assert.ok(act({ t: "ab_start", k: "garland" }).ok);
  return {
    S, p, act, get now() { return now; }, set now(v) { now = v; },
    tick(ms = 100) { now += ms; S.now = now; L.tick(S, now); const v = L.viewFor(S, "p1"); L.endTick(S); return v; },
    sync() { S.now = now; X.albaAdvance(S, p, p.ab, now); },
  };
};
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** Layered search over (cell, heading): the shortest way from the head of `chain` to one of `targets`, fewest turns among those; cells of the chain are free once the tail has moved on. */
function route(chain, dir, thorns, targets) {
  const h = chain.at(-1), idx = new Map(chain.map((c, i) => [c, i])), th = new Set(thorns);
  const dist = new Int16Array(W * W * 4).fill(-1), turns = new Int16Array(W * W * 4), par = new Int32Array(W * W * 4).fill(-1);
  const s0 = h * 4 + dir;
  dist[s0] = 0;
  let frontier = [s0];
  for (let d = 1; d < 80 && frontier.length; d++) {
    const next = [];
    for (const s of frontier) {
      const c = s >> 2, dd = s & 3, [x, y] = xy(c);
      for (const nd of [dd, (dd + 1) & 3, (dd + 3) & 3]) {
        const nx = x + DX[nd], ny = y + DY[nd], n = cell(nx, ny);
        if (nx < 0 || ny < 0 || nx >= W || ny >= W || th.has(n)) continue;
        if (idx.has(n) && idx.get(n) >= d) continue;
        const ns = n * 4 + nd, tn = turns[s] + (nd !== dd ? 1 : 0);
        if (dist[ns] < 0) { dist[ns] = d; turns[ns] = tn; par[ns] = s; next.push(ns); }
        else if (dist[ns] === d && tn < turns[ns]) { turns[ns] = tn; par[ns] = s; }
      }
    }
    let best = -1;
    for (const s of next) if (targets.has(s >> 2) && (best < 0 || turns[s] < turns[best])) best = s;
    if (best >= 0) { const path = []; for (let s = best; s !== s0; s = par[s]) path.push(s >> 2); return path.reverse(); }
    frontier = next;
  }
  return null;
}
const dirTo = (a, b) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return bx > ax ? 1 : bx < ax ? 3 : by > ay ? 2 : 0; };

/**
 * A player: looks at the garden, plans a route to the nearest flower and on to the next one (the golden one when it is close and lasts), turns before each step.
 * `r` = reaction range in ms between something new (a crash, a thorn on the route, a planned turn that went wrong) and the player acting on it; the next
 * flower is planned ahead while the first is still being chased. `mist` = chance a planned turn is not made.
 */
function mkBot(rng, { r = [0, 0], mist = 0 }) {
  let path = null, cut = 0, thinkAt = -1, seenHits = 0;
  const plan = (g, now, iv) => {
    const live = new Set(g.f), gold = g.gold && g.gold.until > now ? g.gold.c : -1;
    if (gold >= 0) live.add(gold);
    let t1 = route(g.c, g.dir, g.th, live);
    if (gold >= 0) { const pg = route(g.c, g.dir, g.th, new Set([gold])); if (pg && pg.length <= (t1 ? t1.length : 99) + 4 && pg.length * iv < g.gold.until - now) t1 = pg; }
    if (!t1) return null;
    const end = t1.at(-1); live.delete(end);
    const chain2 = [...g.c, ...t1].slice(-(g.c.length + 1));
    const t2 = live.size ? route(chain2, dirTo(chain2.at(-2), end), g.th, live) : null;
    cut = t1.length;
    return [g.c.at(-1), ...t1, ...(t2 || [])];
  };
  return {
    /** at `now` (just after a step, or when the player has got round to thinking): turn if the route says so; returns the time of the next wake */
    wake(s, ab) {
      const g = ab.g, now = s.now, iv = X.garInt(g, ab, now), crash = g.hits !== seenHits;
      seenHits = g.hits;
      const h = g.c.at(-1), i = path ? path.indexOf(h) : -1;
      const broken = crash || !path || i < 0 || path.slice(i + 1).some((c) => g.th.includes(c)) || (i < cut && !(g.f.includes(path[cut]) || (g.gold && g.gold.c === path[cut] && g.gold.until > now)));
      const react = () => now + Math.max(0, r[0] + rng() * (r[1] - r[0]) - (crash ? 1e9 : iv * 0.5));
      if (broken) { path = null; if (thinkAt < 0) thinkAt = react(); }
      else if (i >= cut && thinkAt < 0) thinkAt = react();   // the first flower is eaten: look for the next one
      if (thinkAt >= 0 && now >= thinkAt) { thinkAt = -1; path = plan(g, now, iv); }
      if (path) {
        const hh = g.c.at(-1), j = path.indexOf(hh), nx = path[j + 1];
        if (j >= 0 && nx !== undefined) {
          const d = dirTo(hh, nx), eff = g.q.length ? g.q.at(-1) : g.dir;
          if (d !== eff) { if (rng() < mist) path = null; else s.act({ t: "ab_act", d }); }   // a missed turn: the route is wrong now
        }
      }
      const next = g.simAt + (r[1] ? 10 + rng() * iv * 0.6 : 1);
      return thinkAt >= 0 ? Math.min(next, Math.max(now + 20, thinkAt)) : next;
    },
  };
}
function play(opts, seed, { name = `화환${seed}` } = {}) {
  const rng = mulberry(seed * 977 + 13), s = sim(name, seed), ab = s.p.ab, bot = opts.idle ? null : mkBot(rng, opts);
  let nextTick = s.now + 100, nextWake = ab.runAt + 100, maxBytes = 0, views = 0;
  while (s.now < ab.endAt + 100) {
    if (bot && nextWake <= nextTick && nextWake < ab.endAt) {
      s.now = nextWake; s.sync();
      nextWake = bot.wake(s, ab);
    } else {
      s.now = nextTick;
      const v = s.tick(0);
      nextTick += 100;
      if (v.ab && v.ab[7]) { views++; maxBytes = Math.max(maxBytes, JSON.stringify(v.ab[7]).length); }
    }
  }
  const g = ab.g;
  return { score: ab.score, grade: X.albaGrade("garland", ab.score), maxBytes, views, maxCombo: ab.maxCombo, state: ab.state, done: g.done, hits: g.hits, steps: g.n, fevers: ab.feverUsed, th: g.th.length, g: JSON.stringify(g) };
}

// (c) the bots
const BOTS = {
  perfect: { r: [0, 0], mist: 0 },
  strong: { r: [120, 220], mist: 0.03 },
  human: { r: [150, 400], mist: 0.08 },
  casual: { r: [230, 550], mist: 0.14 },
  slow: { r: [400, 900], mist: 0.25 },
};
const results = {};
let viewMax = 0, viewsPerMin = 0;
for (const [nm, o] of Object.entries(BOTS)) {
  results[nm] = [1, 2, 3, 4, 5].map((seed) => play(o, seed));
  for (const r of results[nm]) { assert.equal(r.state, "end"); viewMax = Math.max(viewMax, r.maxBytes); viewsPerMin = Math.max(viewsPerMin, r.views / 4); }
}
const idle = play({ idle: true }, 9);
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(`garland: par ${PAR}  (C ${Math.round(PAR * T.cuts[0])} B ${Math.round(PAR * T.cuts[1])} A ${Math.round(PAR * T.cuts[2])} S ${PAR})`);
for (const [nm, rs] of Object.entries(results)) {
  console.log(`  ${nm.padEnd(8)} scores ${rs.map((r) => r.score).join(" ")}  grades ${rs.map((r) => "-CBAS"[r.grade]).join("")}  garlands ${rs.map((r) => r.done).join(",")} crashes ${rs.map((r) => r.hits).join(",")} combo ${rs.map((r) => r.maxCombo).join(",")}  avg ${avg(rs.map((r) => r.score))} = ${(avg(rs.map((r) => r.score)) / PAR).toFixed(2)} par`);
}
console.log(`  idle     score ${idle.score} grade ${"-CBAS"[idle.grade]} crashes ${idle.hits}  view max ${viewMax} bytes, up to ${viewsPerMin.toFixed(0)} views a minute`);
assert.ok(results.perfect.every((r) => r.grade === 4), "the perfect bot reaches S every time");
assert.ok(avg(results.strong.map((r) => r.score)) / PAR >= 0.85, "a strong player gets A or better on average");
{
  const m = avg(results.human.map((r) => r.score)) / PAR;
  assert.ok(m >= 0.6 && m <= 0.9, `the human-like bot lands around B (${m.toFixed(2)} of par)`);
  const c = avg(results.casual.map((r) => r.score)) / PAR;
  assert.ok(c >= 0.3 && c <= 0.7, `the casual bot lands around C (${c.toFixed(2)} of par)`);
}
assert.ok(avg(results.strong.map((r) => r.score)) > avg(results.human.map((r) => r.score)), "playing better scores more");
assert.ok(avg(results.human.map((r) => r.score)) > avg(results.casual.map((r) => r.score)), "playing worse scores less");
assert.ok(avg(results.casual.map((r) => r.score)) > avg(results.slow.map((r) => r.score)), "playing much worse scores much less");
assert.equal(idle.grade, 0, "an idle player gets no grade"); assert.ok(idle.score < PAR * 0.05, "and next to no points");
assert.ok(viewMax < 600, `the view stays small (${viewMax} bytes)`);

// (a) determinism: the same seed gives the same garden, the same inputs the same shift
{
  const a = play(BOTS.human, 3), b = play(BOTS.human, 3);
  assert.deepEqual(a, b, "same seed and same inputs: the same shift");
  const c = play(BOTS.human, 3, { name: "화환다른" });
  assert.notEqual(c.g, a.g, "a different seed plays a different garden");
  // the garden's clock (thorns and golden flowers) does not depend on how well the player plays
  const clock = (bot) => { const r = play(bot, 4); const g = JSON.parse(r.g); return JSON.stringify([g.th.length]) + JSON.stringify([g.thAt > 0]); };
  assert.equal(clock(BOTS.perfect), clock(BOTS.slow), "thorn growth is the seed's, whoever plays");
  const sched = (seed) => { const ab = mkAb(seed); return [ab.g.goldAt, ab.g.f.join(), ab.g.thAt].join("|"); };
  assert.equal(sched(5), sched(5)); assert.notEqual(sched(5), sched(6));
}

// (d) hostile input: nothing throws, nothing counts, the state stays sane
{
  const s = sim("화환해커", 2), ab = s.p.ab;
  const snap = () => JSON.stringify(ab.g);
  const bad = [{}, { d: "1" }, { d: 1.5 }, { d: -1 }, { d: 4 }, { d: 1e300 }, { d: NaN }, { d: Infinity }, { d: null }, { d: [1] }, { d: { a: 1 } }, { d: true }, { d: "__proto__" }, { d: undefined }, { x: 5, y: 5 }, { l: 1 }, { m: 3 }, { c: [1, 2] }, { g: {} }, { dir: 2 }, { d: -0.5 }, { d: "0" }];
  const valid = [{ d: 0 }, { d: 1 }, { d: 2 }, { d: 3 }];
  s.act({ t: "ab_act", d: 0 });
  const before = snap();
  for (let i = 0; i < 2; i++) for (const j of [...bad, ...valid]) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; }
  assert.equal(snap(), before, "the brief ignores every input, valid or not");
  s.tick(T.briefMs + 200);
  for (let i = 0; i < 2; i++) for (const j of bad) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; }
  const g = ab.g;
  assert.deepEqual(g.q, [], "garbage queued no turn");
  assert.equal(ab.score, 0);
  // valid turns only queue: at most 2, never a reversal, nothing scored by itself
  for (let i = 0; i < 40; i++) { s.now += 40; assert.doesNotThrow(() => s.act({ t: "ab_act", d: i % 4 })); assert.ok(g.q.length <= GAR.queue, "the queue never exceeds 2"); }
  let last = g.dir; for (const d of g.q) { assert.notEqual(d, last ^ 2, "no reversal in the queue"); assert.notEqual(d, last); last = d; }
  // spam inside the rate limit: only those 35 ms apart count
  let acc = 0, la = ab.lastAct;
  for (let i = 0; i < 50; i++) { s.now += 5; assert.doesNotThrow(() => s.act({ t: "ab_act", d: i % 4 })); if (ab.lastAct !== la) { acc++; la = ab.lastAct; } }
  assert.ok(acc <= 8, `50 inputs in 250 ms: only ${acc} 35 ms apart were taken`);
  s.now += 100; acc = 0; la = ab.lastAct;
  for (let i = 0; i < 50; i++) { s.act({ t: "ab_act", d: 1 }); if (ab.lastAct !== la) { acc++; la = ab.lastAct; } }
  assert.equal(acc, 1, "50 inputs in the same instant: one counts");
  gardenCheck(ab.g, ab, "after the hostile input");
  // after the end nothing moves
  s.tick(T.runMs + 1000);
  assert.equal(ab.state, "end");
  const done = snap(), sc = ab.score;
  for (const j of [{ d: 0 }, { d: 2 }, { d: 3 }]) { s.now += 50; s.act({ t: "ab_act", ...j }); }
  assert.equal(snap(), done, "after the end the garden is frozen"); assert.equal(ab.score, sc);
  // a huge stall
  const s2 = sim("화환정지", 3), ab2 = s2.p.ab;
  s2.tick(T.briefMs + T.runMs + 5000);
  assert.equal(ab2.state, "end"); assert.ok(ab2.g.n <= GAR.catchup + 1, "an unattended stall does not run the whole shift's steps"); gardenCheck(ab2.g, ab2, "after the stall");
}

// (e) the server's cost: 240 simulated seconds, 10 ticks/s, an input every 150 ms
{
  const s = sim("화환부하", 7), ab = s.p.ab;
  let ms = 0, views = 0, bytes = 0, vb = 0;
  for (let i = 0; i < (T.briefMs + T.runMs) / 100; i++) {
    if (i % 3 === 0) s.act({ t: "ab_act", d: (i / 3 * 5) % 4 | 0 });
    const t0 = performance.now();
    const v = s.tick(100);
    ms += performance.now() - t0; views++;
    if (v.ab && v.ab[7]) { bytes += JSON.stringify(v.ab[7]).length; vb++; }
  }
  console.log(`  server: ${views} ticks + views in ${ms.toFixed(1)} ms (${(ms / 4.1).toFixed(2)} ms per simulated minute), ${vb} views sent, avg ${(bytes / vb).toFixed(0)} bytes, max ${viewMax}`);
  assert.ok(ms / 4.1 < 100, "far below 100 ms per simulated minute");
  assert.equal(ab.state, "end");
}

console.log("alba-garland: ok");
