// 일일 아르바이트 · 파리잡기 (67-alba-fly.js): the seeded schedule, bots (perfect · human-like · idle) against the grade cut-offs, hostile inputs,
// the server cost of a whole shift and the size of the wire view. node tests/alba-fly.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") + "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, FLY, flyBuild, albaGrade };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, K = "fly", T = X.ALBA_T;

const S = L.setup();
let now = 7_000_000;
S.now = now;
L.addPlayer(S, "p1", L.hero("파리잡이", { wk: "sword", lvl: 30, migrate: true }));
const p = S.players.p1;
const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
const tick = () => { S.now = now; L.tick(S, now); L.endTick(S); };
const hit = (id) => act({ t: "ab_act", hit: id });
let seedNo = 0;
/** Start a shift on its own seed (the time is part of it) and return it; the brief is over when this returns. */
function start() {
  if (p.ab) { act({ t: "ab_close" }); }
  now += 1000 * 60 * 5 + 777 * ++seedNo; S.now = now; p.map = "town"; p.dead = false;
  assert.ok(act({ t: "ab_start", k: K }).ok, "starts");
  const ab = p.ab;
  now = ab.runAt; tick();
  return ab;
}
/** Step a shift from its run start to its end in 5 ms steps with a tick every 100 ms; `bot(ab, rt)` may act each step. */
function play(ab, bot) {
  let nt = now;
  while (now < ab.endAt + 300) {
    now += 5; S.now = now;
    if (now >= nt) { L.tick(S, now); L.endTick(S); nt += 100; }
    if (ab.state === "run") bot(ab, now - ab.runAt);
  }
  return ab;
}
/** The flies that are out right now (earliest to leave first). */
function alive(ab, rt, slack = 0) {
  const g = ab.g, r = [];
  for (let c = 0; c < 9; c++) for (let i = g.H[c]; i < g.Q[c].length; i++) { const f = g.F[g.Q[c][i]]; if (f.t0 > rt) break; if (!f.dn && rt <= f.t0 + f.life + slack) r.push(f); }
  return r.sort((a, b) => a.t0 + a.life - b.t0 - b.life);
}

// a tiny test PRNG for the bots (the game's own box is not touched)
let bs = 12345;
const br = () => { bs = (Math.imul(bs, 1664525) + 1013904223) >>> 0; return bs / 4294967296; };

const perfect = () => (ab, rt) => {
  const f = alive(ab, rt).find((x) => x.k !== 2);
  if (f && now - ab.lastAct >= T.actMs) hit(f.id);
};
/** reaction 250–600 ms, 120–220 ms to move to the next target, `miss` of the flies never noticed, `slip` of the swings wasted, `beeTap` of the bees swatted. */
const human = ({ miss = 0.07, slip = 0.07, beeTap = 0.07, react = [250, 600] } = {}) => {
  const seen = new Map();   // fly id → { ready ms, want }
  let busy = 0;
  return (ab, rt) => {
    for (const f of alive(ab, rt)) {
      if (!seen.has(f.id)) seen.set(f.id, { ready: f.t0 + react[0] + br() * (react[1] - react[0]), want: f.k === 2 ? br() < beeTap : br() >= miss });
    }
    if (rt < busy) return;
    const f = alive(ab, rt).find((x) => { const s = seen.get(x.id); return s && s.want && s.ready <= rt; });
    if (!f) return;
    busy = rt + 120 + br() * 100;
    if (br() < slip) return;   // the swat misses: time is spent, the fly stays
    if (now - ab.lastAct >= T.actMs) hit(f.id);
  };
};
const idle = () => () => {};

const scores = (mk, n) => { const r = []; for (let i = 0; i < n; i++) { const ab = start(); play(ab, mk()); r.push({ score: ab.score, grade: ab.res[0], combo: ab.maxCombo, ab }); } return r; };
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// (a) determinism: the same seed gives the same schedule; a different seed does not
{
  const key = (g) => JSON.stringify(g.F.map((f) => [f.c, f.t0, f.life, f.k]));
  const a = X.flyBuild({ seed: 42 }), b = X.flyBuild({ seed: 42 }), c = X.flyBuild({ seed: 43 });
  assert.equal(key(a), key(b), "same seed, same flies"); assert.notEqual(key(a), key(c), "another seed, another schedule");
  for (let i = 0; i < a.F.length; i++) assert.equal(a.F[i].id, i, "ids run in spawn order");
  for (let c9 = 0; c9 < 9; c9++) for (let i = 1; i < a.Q[c9].length; i++) { const x = a.F[a.Q[c9][i - 1]], y = a.F[a.Q[c9][i]]; assert.ok(y.t0 >= x.t0 + x.life, "a can never holds two flies at once"); }
  const kinds = [0, 0, 0, 0]; a.F.forEach((f) => kinds[f.k]++);
  assert.ok(kinds.every((n) => n > 3), "every kind appears: " + kinds);
  const bomb = (t) => Math.max(...a.F.filter((f) => f.t0 >= t && f.t0 < t + 4000).map((x) => a.F.filter((f) => f.t0 >= x.t0 && f.t0 < x.t0 + 700).length));
  assert.ok(bomb(45000) >= 7 && bomb(78000) >= 7, "a trash bomb at 45 s and in the last 15 s: " + bomb(45000) + "/" + bomb(78000));
  const early = a.F.filter((f) => f.t0 < 22500).length, late = a.F.filter((f) => f.t0 >= 60000 && f.t0 < 75000).length;
  assert.ok(late / 15 > early / 22.5, "the pace ramps up");
  assert.ok(a.F.length > 90 && a.F.length < 300, "a shift has a long schedule: " + a.F.length);
}

// (b) bots against the grades
const perf = scores(perfect, 8), hum = scores(human, 8), idl = scores(idle, 2);
console.log(`perfect ${perf.map((r) => r.score).join(" ")} | human ${hum.map((r) => r.score).join(" ")} | idle ${idl.map((r) => r.score).join(" ")}`);
console.log(`par ${X.ALBA[K].par}: perfect avg ${Math.round(avg(perf.map((r) => r.score)))} (grades ${perf.map((r) => r.grade)}) · human avg ${Math.round(avg(hum.map((r) => r.score)))} (grades ${hum.map((r) => r.grade)}) · human max combo ${hum.map((r) => r.combo)}`);
assert.ok(perf.every((r) => r.grade === 4), "a perfect bot always reaches S");
assert.ok(hum.every((r) => r.grade >= 2 && r.grade <= 3) && avg(hum.map((r) => r.grade)) <= 2.5, "a human-like bot lands around B");
assert.ok(idl.every((r) => r.score === 0 && r.grade === 0), "an idle bot scores nothing");
{ const par = X.ALBA[K].par, hs = avg(hum.map((r) => r.score)) / par; assert.ok(hs >= 0.62 && hs <= 0.88, "the human bot is at " + hs.toFixed(2) + " of par"); }
{ const sloppy = scores(() => human({ miss: 0.3, slip: 0.25, beeTap: 0.3, react: [400, 900] }), 3); assert.ok(sloppy.every((r) => r.grade <= 1), "a sloppy bot stays at C or below: " + sloppy.map((r) => r.score)); }

// (c) hostile inputs never throw and never score illegitimately
{
  const ab = start(), g = ab.g;
  const base = (a) => { now += 40; S.now = now; const s0 = ab.score, c0 = ab.combo; assert.doesNotThrow(() => act(a)); return [s0, c0]; };
  const same = (a, why) => { const [s0, c0] = base(a); assert.equal(ab.score, s0, why); assert.equal(ab.combo, c0, why); };
  now = ab.runAt + 2500; tick();
  for (const bad of [undefined, null, "3", "abc", 1.5, -1, 1e9, 2 ** 53, NaN, Infinity, [], {}, true, g.F.length, -0.5, "__proto__", { id: 1 }]) same({ t: "ab_act", hit: bad }, "junk id " + String(bad));
  same({ t: "ab_act" }, "no field"); same({ t: "ab_act", hits: 3 }, "wrong field"); same({ t: "ab_act", hit: 1, slot: 2 }, "no such fly yet (not spawned)");
  // a real fly: hitting it twice scores once; a fly before it spawned and one long expired are refused
  const first = g.F.find((f) => f.k === 0 && f.t0 > 9000);
  now = ab.runAt + first.t0 - 2000; S.now = now; tick();
  same({ t: "ab_act", hit: first.id }, "before it is out");
  now = ab.runAt + first.t0 + 200; S.now = now; tick();
  const s0 = ab.score; hit(first.id); assert.equal(ab.score, s0 + 10, "a plain fly is worth 10"); assert.equal(first.dn, 1);
  now += 40; hit(first.id); assert.equal(ab.score, s0 + 10, "the same fly twice scores once");
  const late = g.F.find((f) => f.k === 0 && f.t0 > first.t0 + 20000);
  now = ab.runAt + late.t0 + late.life + 300; S.now = now; tick();
  same({ t: "ab_act", hit: late.id }, "after it left (beyond the latency grace)");
  // inside the latency grace a hit still counts
  const g2 = g.F.find((f) => f.k === 0 && f.t0 > late.t0 + 8000);
  now = ab.runAt + g2.t0 + g2.life + 200; S.now = now; tick();
  { const sc = ab.score; hit(g2.id); assert.ok(ab.score > sc && g2.dn === 1, "a hit 200 ms after it left still counts (latency grace)"); }
  // a bee costs points and breaks the combo; a poison fly needs two swats
  const bee = g.F.find((f) => f.k === 2 && f.t0 > g2.t0 + 4000);
  now = ab.runAt + bee.t0 + 300; S.now = now; tick();
  { const sc = ab.score; hit(bee.id); assert.equal(ab.combo, 0, "a bee breaks the combo"); assert.equal(ab.score, Math.max(0, sc - 30)); }
  const poi = g.F.find((f) => f.k === 3 && f.t0 > bee.t0 + 4000);
  now = ab.runAt + poi.t0 + 200; S.now = now; tick();
  { const sc = ab.score, cb = ab.combo; hit(poi.id); assert.equal(ab.score, sc, "the first swat on a poison fly scores nothing"); assert.equal(ab.combo, cb); assert.equal(poi.dn, 0); now += 40; hit(poi.id); assert.ok(ab.score > sc && poi.dn === 1, "the second swat kills it"); }
  // spam inside the rate limit is dropped
  const sp = g.F.find((f) => f.k === 0 && f.t0 > poi.t0 + 4000);
  now = ab.runAt + sp.t0 + 100; S.now = now; tick();
  { const sc = ab.score; hit(sp.id); const sc2 = ab.score; for (let i = 0; i < 5; i++) { now += 5; hit(sp.id); } assert.ok(sc2 > sc); assert.equal(ab.score, sc2, "spam within 35 ms changes nothing"); }
  // a hit shuts the can for a second: its next fly (if due) slides back, nothing overlaps
  for (let c = 0; c < 9; c++) for (let i = 1; i < g.Q[c].length; i++) { const x = g.F[g.Q[c][i - 1]], y = g.F[g.Q[c][i]]; assert.ok(y.t0 >= x.t0 + x.life || x.dn, "still no overlap after the lids dropped"); }
  assert.ok(g.cd.some((v) => v > 0), "a closed can is remembered");
  // before the brief ends and after the end nothing counts
  start(); act({ t: "ab_leave" });
  assert.ok(act({ t: "ab_start", k: K }).ok); const ab3 = p.ab, s3 = ab3.score; now = ab3.t0 + 1000; S.now = now;
  hit(ab3.g.F[0].id); assert.equal(ab3.score, s3, "nothing counts during the brief");
  now = ab3.endAt + 100; tick(); const e = ab3.g.F.find((f) => f.k === 0); hit(e.id); assert.equal(ab3.score, 0, "nothing counts after the end"); assert.equal(ab3.state, "end");
  assert.equal(ab3.res[0], 0);
  act({ t: "ab_close" });
}

// (d) cost: a whole shift at 10 ticks/s with an action every 250 ms, ticks + views timed
{
  const ab = start();
  let tms = 0, vms = 0, vmax = 0, bytes = 0, vn = 0, n = 0;
  let na = now;
  while (now < ab.endAt + 200) {
    now += 100; S.now = now;
    let t0 = performance.now(); L.tick(S, now); L.endTick(S); tms += performance.now() - t0;
    t0 = performance.now(); const v = L.viewFor(S, "p1"); vms += performance.now() - t0;
    L.endTick(S);
    if (v.ab && v.ab[7] !== 0) { const s = JSON.stringify(v.ab[7]).length; vmax = Math.max(vmax, s); bytes += s; vn++; }
    if (now >= na) { na += 250; const f = alive(ab, now - ab.runAt).find((x) => x.k !== 2); if (f && ab.state === "run") hit(f.id); n++; }
  }
  const base = (() => { const S2 = L.setup(); S2.now = now; L.addPlayer(S2, "z", L.hero("빈", { wk: "sword", lvl: 30, migrate: true })); let t = 0; for (let i = 0; i < 2400; i++) { S2.now += 100; const t0 = performance.now(); L.tick(S2, S2.now); L.endTick(S2); L.viewFor(S2, "z"); L.endTick(S2); t += performance.now() - t0; } return t; })();
  console.log(`cost: tick ${tms.toFixed(1)} ms + viewFor ${vms.toFixed(1)} ms for 90 s (${((tms + vms) / 1.5).toFixed(1)} ms/min; the empty world alone ${(base / 4).toFixed(1)} ms/min); view sent ${vn}× avg ${Math.round(bytes / vn)} B, max ${vmax} B`);
  assert.ok((tms + vms) / 1.5 < 100, "far below 100 ms per simulated minute");
  assert.ok(vmax < 900, "the view stays small: " + vmax);
}

// the wire: the view lists what is out now and what comes next, in ms from now; it only changes with the rev
{
  const ab = start(); now += 1500; S.now = now; tick();
  const v1 = L.viewFor(S, "p1").ab; L.endTick(S);
  assert.ok(Array.isArray(v1[7]) && Array.isArray(v1[7][0]) && Array.isArray(v1[7][1]), "view = [flies, closed cans]");
  for (const [id, c, ms, life, k] of v1[7][0]) { assert.ok(Number.isInteger(id) && c >= 0 && c < 9 && Number.isInteger(ms) && life > 300 && k >= 0 && k <= 4); const f = ab.g.F[id]; assert.equal(ab.runAt + f.t0 - now, ms, "times are ms from now"); }
  assert.equal(L.viewFor(S, "p1").ab[7], 0, "unchanged: not sent again"); L.endTick(S);
  now += 3000; S.now = now; tick();   // nothing was done, yet the announced window ran dry: a fresh view arrives
  const v3 = L.viewFor(S, "p1").ab; L.endTick(S);
  assert.notEqual(v3[7], 0, "an idle player is still shown what comes next");
  act({ t: "ab_leave" });
}

console.log("alba-fly: ok");
