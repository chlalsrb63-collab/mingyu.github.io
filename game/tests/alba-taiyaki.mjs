// 일일 아르바이트 · 붕어빵 노점 (67-alba-taiyaki.js): lazy orders from the seed, bots (perfect · human-like · idle) against the grade cut-offs, every step of a slot,
// hostile inputs, the server cost of a whole shift and the size of the wire view. node tests/alba-taiyaki.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") + "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, TAI, albaGrade };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, K = "taiyaki", T = X.ALBA_T, TAI = X.TAI;

const S = L.setup();
let now = 9_000_000;
S.now = now;
L.addPlayer(S, "p1", L.hero("붕어빵장수", { wk: "sword", lvl: 30, migrate: true }));
const p = S.players.p1;
const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
const tick = () => { S.now = now; L.tick(S, now); L.endTick(S); };
const A = (o) => act({ t: "ab_act", ...o });
let seedNo = 0;
function start() {
  if (p.ab) act({ t: "ab_close" });
  now += 1000 * 60 * 5 + 913 * ++seedNo; S.now = now; p.map = "town"; p.dead = false;
  assert.ok(act({ t: "ab_start", k: K }).ok, "starts");
  const ab = p.ab;
  now = ab.runAt; tick();
  return ab;
}
function play(ab, bot) {
  let nt = now;
  while (now < ab.endAt + 300) {
    now += 5; S.now = now;
    if (now >= nt) { L.tick(S, now); L.endTick(S); nt += 100; }
    if (ab.state === "run") bot(ab, now - ab.runAt);
  }
  return ab;
}
const gauge = (x, rt) => ((rt - x.a) / x.d) * 100;
/** What the orders still lack per filling: the queue's needs minus the tray minus the pieces on their way. */
function unmet(g) {
  const u = [0, 0, 0];
  for (const c of g.cu) for (let f = 0; f < 3; f++) u[f] += c.need[f];
  for (const t of g.tray) u[t[0]]--;
  for (let i = 0; i < g.n; i++) { const x = g.sl[i]; if (x.s >= 2 && x.s <= 4) u[x.f]--; }
  return u;
}
/** The filling to start next: the most missing one. */
const want = (g) => { const u = unmet(g); let b = 0; for (let f = 1; f < 3; f++) if (u[f] > u[b]) b = f; return [b, u[b]]; };
const serveAble = (g) => g.cu.filter((c) => c.need.some((n, f) => n > 0 && g.tray.some((t) => t[0] === f))).sort((a, b) => a.until - b.until)[0];
/** Every move that is possible now: [kind, ready ms (from the run start; when it is first worth doing), key, action]. */
function moves(g, rt) {
  const r = [], s1 = g.sl.slice(0, g.n).filter((x) => x.s === 1).length, miss = unmet(g).reduce((n, v) => n + Math.max(v, 0), 0);
  const stock = g.tray.length + g.sl.slice(0, g.n).filter((x) => x.s >= 1 && x.s <= 4).length;
  const c = serveAble(g);
  if (c) r.push([0, rt, `serve${c.id}:${g.tray.length}`, { c: c.id }]);
  for (let i = 0; i < g.n; i++) {
    const x = g.sl[i], k = `${i}:${x.s}:${x.a}`;
    if (x.s === 3) r.push([1, x.a + (x.d * x.z[0]) / 100, k, { slot: i, step: 3 }, x.a + (x.d * (x.z[0] + x.z[1])) / 200]);
    else if (x.s === 4) { if (g.tray.length < TAI.tray) r.push([2, x.a + (x.d * x.z[2]) / 100, k, { slot: i, step: 4 }, x.a + (x.d * (x.z[2] + x.z[3])) / 200]); }
    else if (x.s === 5) r.push([3, rt, k, { slot: i, step: 5 }]);
    else if (x.s === 2) r.push([4, rt, k, { slot: i, step: 2 }]);
    else if (x.s === 1) r.push([5, rt, k, { slot: i, step: 1, f: want(g)[0] }]);
    else if (x.s === 0 && (miss > s1 || stock < 2)) r.push([6, rt, k, { slot: i, step: 0 }]);
  }
  return r;
}
/** Zero latency: every move at its best moment (the middle of its window), one per 40 ms. */
const perfect = () => (ab, rt) => {
  if (now - ab.lastAct < T.actMs + 5) return;
  const m = moves(ab.g, rt).filter((x) => rt >= (x[4] ?? x[1])).sort((a, b) => a[0] - b[0])[0];
  if (m) A(m[3]);
};
let bs = 777;
const br = () => { bs = (Math.imul(bs, 1664525) + 1013904223) >>> 0; return bs / 4294967296; };
/** Notices each move 250–600 ms after it becomes worth doing, needs 150–300 ms per tap, slips on 7 % of the taps (wasted) and picks a wrong filling 7 % of the time. */
const human = ({ slip = 0.07, react = [250, 600], busy = [150, 300] } = {}) => {
  const seen = new Map();
  let free = 0;
  return (ab, rt) => {
    if (rt < free || now - ab.lastAct < T.actMs + 5) return;
    let best = null;
    for (const m of moves(ab.g, rt)) {
      if (!seen.has(m[2])) seen.set(m[2], m[1] + react[0] + br() * (react[1] - react[0]));
      const ready = seen.get(m[2]);
      if (ready <= rt && (!best || ready < best[0])) best = [ready, m];
    }
    if (!best) return;
    free = rt + busy[0] + br() * (busy[1] - busy[0]);
    if (br() < slip) return;
    const a = { ...best[1][3] };
    if (a.step === 1 && br() < slip) a.f = Math.floor(br() * 3);
    A(a);
  };
};
const idle = () => () => {};
const scores = (mk, n) => {
  const r = [];
  for (let i = 0; i < n; i++) {
    const ab = start(), q = [0, 0, 0], push = ab.g.tray.push;
    ab.g.tray.push = function (t) { q[t[1]]++; return push.call(this, t); };   // count the pieces by quality
    play(ab, mk());
    r.push({ out: ab.out, endMs: ab.endAt - ab.runAt, score: ab.score, grade: ab.res[0], combo: ab.maxCombo, perfect: q[2], ok: q[1], customers: ab.g.nid - 1 });
  }
  return r;
};
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// (a) determinism: the same seed gives the same orders whenever the clock is read (arrivals are applied in time order, not at call times)
{
  const run = (seed, steps) => {
    const ab = { k: K, strikes: 0, box: { seed }, runAt: 0, rev: 0, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, endAt: T.runMs };
    X.ALBA_RULES[K].init(null, null, ab);
    for (let t = 0; t <= 85000; t += steps) X.ALBA_RULES[K].adv(null, null, ab, t);
    X.ALBA_RULES[K].adv(null, null, ab, 85000);
    return [JSON.stringify([ab.g.cu, ab.g.na, ab.g.nid, ab.score]), ab.g];
  };
  assert.equal(run(4242, 100)[0], run(4242, 2300)[0], "the same orders however often the clock is read");
  assert.notEqual(run(4242, 100)[0], run(4243, 100)[0], "another seed, other orders");
  const g = run(4242, 100)[1];
  assert.equal(g.n, 8, "8 slots after 15 s"); assert.equal(g.grp, 1, "the group order came"); assert.ok(g.nid > 12, "plenty of customers: " + g.nid);
}

// (b) bots against the grades
const perf = scores(perfect, 6), hum = scores(human, 16), idl = scores(idle, 2);
console.log(`perfect ${perf.map((r) => r.score).join(" ")} | human ${hum.map((r) => r.score).join(" ")} | idle ${idl.map((r) => r.score).join(" ")}`);
console.log(`par ${X.ALBA[K].par}: perfect avg ${Math.round(avg(perf.map((r) => r.score)))} (grades ${perf.map((r) => r.grade)}) · human avg ${Math.round(avg(hum.map((r) => r.score)))} (grades ${hum.map((r) => r.grade)}) · human max combo ${hum.map((r) => r.combo)}`);
console.log("pieces perfect/ok (customers): perfect bot " + perf.map((r) => `${r.perfect}/${r.ok} (${r.customers})`).join(" ") + " | human " + hum.map((r) => `${r.perfect}/${r.ok} (${r.customers})`).join(" "));
assert.ok(perf.every((r) => r.grade === 4), "a perfect bot always reaches S");
assert.ok(avg(hum.map((r) => r.grade)) >= 2.0 && avg(hum.map((r) => r.grade)) <= 3.6, "a human-like bot lands around B–A (eased 2026-11-20)");
assert.ok(idl.every((r) => r.score === 0 && r.grade === 0), "an idle bot scores nothing");
{ const hs = avg(hum.map((r) => r.score)) / X.ALBA[K].par; assert.ok(hs >= 0.6 && hs <= 1.15, "the human bot is at " + hs.toFixed(2) + " of par"); }
{
  const sloppy = scores(() => human({ slip: 0.3, react: [500, 1200], busy: [300, 600] }), 12);
  assert.ok(sloppy.every((r) => r.grade <= 1), "a sloppy bot stays at C or below: " + sloppy.map((r) => r.score));
  const rate = (rs) => rs.filter((r) => r.out).length / rs.length;
  console.log(`strike-outs: perfect ${rate(perf)} human ${rate(hum).toFixed(2)} sloppy ${rate(sloppy).toFixed(2)}`);
  assert.equal(rate(perf), 0, "the perfect bot never strikes out");
  assert.ok(rate(hum) <= 0.25, "a human-like bot strikes out in at most 25 % of seeds");
  assert.ok(sloppy.filter((r) => r.out && r.endMs < 88000).length >= sloppy.length / 4, "a sloppy bot still strikes out in at least a quarter of its seeds (eased 2026-11-20)");
}

// (c) one piece step by step, and what each step refuses
{
  const ab = start(), g = ab.g;
  now = ab.runAt + 500; tick();
  const sc = () => ab.score;
  assert.equal(g.cu.length >= 1, true, "a customer waits at the start");
  const c = g.cu[0], f = c.need.findIndex((n) => n > 0);
  now += 100; assert.equal(A({ slot: 0, step: 0 }).ok, true); assert.equal(g.sl[0].s, 1, "batter");
  now += 100; A({ slot: 0, step: 1 }); assert.equal(g.sl[0].s, 1, "no filling chosen: refused");
  now += 100; A({ slot: 0, step: 0, f: f }); assert.equal(g.sl[0].s, 1, "a stale step is refused");
  now += 100; A({ slot: 0, step: 1, f }); assert.equal(g.sl[0].s, 2, "filling");
  now += 100; A({ slot: 0, step: 2 }); const x = g.sl[0]; assert.equal(x.s, 3, "baking side 1");
  assert.ok(x.d >= 4500 && x.d <= 8000 && x.z[0] < x.z[1] && x.z[2] < x.z[3], "the windows are set: " + x.d + " " + x.z);
  now += 100; A({ slot: 0, step: 3 }); assert.equal(g.sl[0].s, 3, "flipping too early is refused");
  now = ab.runAt + x.a + Math.round((x.d * (x.z[0] + x.z[1])) / 200); tick(); A({ slot: 0, step: 3 }); assert.equal(x.s, 4, "flipped inside the green window"); assert.equal(x.q, 2);
  now += 100; A({ slot: 0, step: 4 }); assert.equal(x.s, 4, "taking it out raw is refused");
  now = ab.runAt + x.a + Math.round((x.d * (x.z[2] + x.z[3])) / 200); tick();
  const open = ab.endAt; assert.ok(open > now);
  // serving the wrong customer / an empty tray refuses; the right one pays the perfect price
  A({ c: c.id }); assert.equal(sc(), 0, "nothing to serve yet");
  now += 100; A({ slot: 0, step: 4 }); assert.equal(x.s, 0, "taken out"); assert.deepEqual(g.tray, [[f, 2]], "a perfect piece on the tray");
  now += 100; tick();
  const other = g.cu.find((q) => q.id !== c.id && q.need[f] === 0);
  if (other) { A({ c: other.id }); assert.equal(sc(), 0, "another flavour is not accepted"); assert.equal(g.tray.length, 1); }
  const live = g.cu.find((q) => q.id === c.id);
  if (live) { const before = live.tot; now += 100; A({ c: c.id }); assert.ok(sc() >= 60, "perfect piece: 60 or more: " + sc()); assert.equal(g.tray.length, 0); assert.ok(!g.cu.some((q) => q.id === c.id) || live.tot < before); }
  act({ t: "ab_leave" });
}

// a piece that is not flipped or taken out in time burns: −10, combo broken, the slot must be cleared
{
  const ab = start(), g = ab.g;
  now = ab.runAt + 400; tick();
  for (const o of [{ step: 0 }, { step: 1, f: 0 }, { step: 2 }]) { now += 100; A({ slot: 1, ...o }); }
  const x = g.sl[1]; assert.equal(x.s, 3);
  ab.score = 100; ab.combo = 5;
  now = ab.runAt + x.a + x.d + 50; tick();
  assert.equal(x.s, 5, "burnt at 100 %"); assert.equal(ab.combo, 0, "the combo is broken"); assert.ok(ab.score <= 90, "−10");
  now += 100; A({ slot: 1, step: 5 }); assert.equal(x.s, 0, "cleared");
  // a late flip costs the perfect
  for (const o of [{ step: 0 }, { step: 1, f: 0 }, { step: 2 }]) { now += 100; A({ slot: 1, ...o }); }
  now = ab.runAt + x.a + Math.round((x.d * (x.z[1] + 6)) / 100); tick(); A({ slot: 1, step: 3 }); assert.equal(x.q, 1, "flipped after the green window: no perfect");
  now = ab.runAt + x.a + Math.round((x.d * (x.z[2] + x.z[3])) / 200); tick(); A({ slot: 1, step: 4 }); assert.deepEqual(g.tray, [[0, 1]], "an ok piece");
  // an unserved customer leaves: −20
  const c = g.cu[0]; ab.score = 50; ab.combo = 3;
  now = ab.runAt + c.until + 10; tick(); assert.ok(!g.cu.some((q) => q.id === c.id), "the customer left"); assert.equal(ab.combo, 0); assert.ok(ab.score <= 30);
  act({ t: "ab_leave" });
}

// (d) hostile inputs never throw and never score
{
  const ab = start(), g = ab.g;
  now = ab.runAt + 5000; tick();
  const snap = () => JSON.stringify([ab.score, ab.combo, g.sl, g.tray, g.cu, g.n]);
  const junk = [undefined, null, "0", "abc", 0.5, -1, 99, 1e9, 2 ** 53, NaN, Infinity, -Infinity, [], {}, true, [0], "__proto__"];
  for (const j of junk) for (const a of [{ slot: j, step: 0 }, { slot: 0, step: j }, { slot: 0, step: 1, f: j }, { c: j }, { slot: j }, { c: j, slot: j, step: j }]) {
    now += 40; tick(); const s0 = snap();
    assert.doesNotThrow(() => A(a), JSON.stringify(a));
    assert.equal(snap(), s0, "junk changed the game: " + JSON.stringify(a));
  }
  for (const a of [{}, { x: 1 }, { slot: 6, step: 0 }, { slot: 7, step: 0 }, { slot: -0, step: 3 }, { c: 0 }, { c: 123456 }]) { now += 40; assert.doesNotThrow(() => A(a)); }
  assert.ok(g.sl.slice(6).every((x) => x.s === 0), "the 7th and 8th slots are locked before 15 s");
  // spam inside 35 ms is dropped; acting before the brief ends or after the end does nothing
  const s0 = ab.score;
  const before = g.sl[2].s; now += 100; A({ slot: 2, step: 0 }); now += 5; A({ slot: 2, step: 1, f: 0 }); assert.equal(g.sl[2].s, before + 1, "a second tap within 35 ms is dropped");
  assert.equal(ab.score, s0);
  act({ t: "ab_leave" });
  assert.ok(act({ t: "ab_start", k: K }).ok); const a3 = p.ab; now = a3.t0 + 2000; S.now = now;
  A({ slot: 0, step: 0 }); assert.equal(a3.g.sl[0].s, 0, "nothing during the brief");
  now = a3.endAt + 100; tick(); A({ slot: 0, step: 0 }); assert.equal(a3.state, "end"); assert.equal(a3.g.sl[0].s, 0, "nothing after the end");
  act({ t: "ab_close" });
}

// (e) cost: a whole shift at 10 ticks/s with an action every 250 ms, ticks + views timed; the size of the view
{
  const ab = start();
  let tms = 0, vms = 0, vmax = 0, bytes = 0, vn = 0, na = now;
  const pf = perfect();
  while (now < ab.endAt + 200) {
    now += 100; S.now = now;
    let t0 = performance.now(); L.tick(S, now); L.endTick(S); tms += performance.now() - t0;
    t0 = performance.now(); const v = L.viewFor(S, "p1"); vms += performance.now() - t0;
    L.endTick(S);
    if (v.ab && v.ab[7] !== 0) { const s = JSON.stringify(v.ab[7]).length; vmax = Math.max(vmax, s); bytes += s; vn++; }
    if (now >= na) { na += 250; if (ab.state === "run") { now -= 0; pf(ab, now - ab.runAt); } }
  }
  const base = (() => { const S2 = L.setup(); S2.now = now; L.addPlayer(S2, "z", L.hero("빈", { wk: "sword", lvl: 30, migrate: true })); let t = 0; for (let i = 0; i < 2400; i++) { S2.now += 100; const t0 = performance.now(); L.tick(S2, S2.now); L.endTick(S2); L.viewFor(S2, "z"); L.endTick(S2); t += performance.now() - t0; } return t; })();
  console.log(`cost: tick ${tms.toFixed(1)} ms + viewFor ${vms.toFixed(1)} ms for 90 s (${((tms + vms) / 1.5).toFixed(1)} ms/min; the empty world alone ${(base / 4).toFixed(1)} ms/min); view sent ${vn}× avg ${Math.round(bytes / vn)} B, max ${vmax} B; score ${ab.score}`);
  assert.ok((tms + vms) / 4 < 100, "far below 100 ms per simulated minute");
  assert.ok(vmax < 900, "the view stays small: " + vmax);
}

// the wire: unchanged → not sent again; times in ms from now
{
  const ab = start(); now += 1500; S.now = now; tick();
  A({ slot: 0, step: 0 }); now += 100; A({ slot: 0, step: 1, f: 2 }); now += 100; A({ slot: 0, step: 2 }); now += 1000; S.now = now;
  const v1 = L.viewFor(S, "p1").ab; L.endTick(S); const v = v1[7];
  assert.ok(Array.isArray(v) && v[0] === 6 && v[1].length === 8 && Array.isArray(v[2]) && Array.isArray(v[3]), "view = [slots, 8 slot rows, customers, tray, ms to slot 8]");
  const [s, f, q, rel, d, z0, z1, z2, z3] = v[1][0];
  assert.ok(s === 3 && f === 2 && q === 2 && rel <= 0 && rel > -2000 && d >= 4500 && z0 < z1 && z2 < z3, "a baking row carries its start (ms ago), length and windows: " + v[1][0]);
  assert.ok(v[4] > 0 && v[4] < TAI.more, "ms until the 8th slot");
  assert.equal(L.viewFor(S, "p1").ab[7], 0, "unchanged: not sent again"); L.endTick(S);
  act({ t: "ab_leave" });
}

console.log("alba-taiyaki: ok");
