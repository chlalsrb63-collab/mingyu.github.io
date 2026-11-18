// 일일 아르바이트 · 편의점 아르바이트 (67-alba-store.js): seeded customers, lazy arrivals and departures, scanning, exact change, special customers, grades against bots,
// hostile input, cost and wire size.
// node tests/alba-store.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, albaGrade, albaAdvance, ASTORE, astoreDiff };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, K = "store", R = X.ALBA_RULES[K], T = X.ALBA_T, PAR = X.ALBA[K].par, PAD = X.ASTORE.pad;
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sum = (a) => a.reduce((x, y) => x + y, 0);

// ── world, clock, helpers
const S = L.setup();
let now = 30_000_000, nextTick = 0;
S.now = now;
L.addPlayer(S, "p1", L.hero("점원", { wk: "sword", lvl: 30, migrate: true }));
const p = S.players.p1;
p.map = "town";
const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
function advanceTo(t, step = 100) {
  while (nextTick + step <= t) { nextTick += step; S.now = nextTick; L.tick(S, nextTick); L.endTick(S); }
  S.now = now = t;
  if (p.ab) X.albaAdvance(S, p, p.ab, t);   // what the next 100 ms tick would do
}
function startShift() {
  if (p.ab) { act({ t: "ab_close" }); act({ t: "ab_close" }); }
  now += 1000 * 3600 + 7919;
  nextTick = now;
  S.now = now;
  assert.ok(act({ t: "ab_start", k: K }).ok, "the shift starts");
  return p.ab;
}
/** A bare shift record for the rules and the scoring helpers (no world); times start at 0. */
const fakeAb = (seed) => { const ab = { k: K, box: { seed }, runAt: 0, endAt: T.runMs, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null }; R.init(S, p, ab); return ab; };
const lanesOf = (ab, t) => JSON.parse(JSON.stringify(R.view(ab, t)));
const total = (c) => sum(c.it ?? c[2]);

// ── the clerk: sees only the wire's view. Works the customer who leaves soonest until she is done; scans in order, then gives the change with the fewest coins.
// `slip`: now and then taps something else (a random item, a random coin).
const clerk = (rand = null, slip = 0) => {
  let cur = -1, curId = 0;
  return (ab, t) => {
    const lanes = lanesOf(ab, t);
    let ln = cur >= 0 && lanes[cur] && lanes[cur][0] === curId ? cur : -1;
    if (ln < 0) {
      lanes.forEach((c, i) => { if (c && (ln < 0 || c[6] < lanes[ln][6])) ln = i; });
      if (ln < 0) return null;
      cur = ln; curId = lanes[ln][0];
    }
    const [, , it, sc, paid, tray] = lanes[ln];
    if (sc !== (1 << it.length) - 1) {
      let i = 0;
      while (sc & (1 << i)) i++;
      if (rand && rand() < slip) i = Math.floor(rand() * it.length);
      return { s: ln, i };
    }
    const due = paid - sum(it) - tray;
    let v = 3;
    while (PAD[v] > due) v--;
    if (rand && rand() < slip) v = Math.floor(rand() * 4);
    return { p: ln, v };
  };
};
const idle = () => () => null;

/** One shift with a bot; `delay(rand)` is the time between two of its decisions. */
function play(bot, delay, seed = 1) {
  const rand = rng(seed), ab = startShift();
  advanceTo(ab.runAt + 1);
  let served = 0, combo = 0;
  const watch = () => { if (ab.combo > combo) served++; combo = ab.combo; };
  while (now < ab.endAt) {
    const a = bot(ab, now);
    if (!a) { advanceTo(now + 100, 250); watch(); continue; }
    act({ t: "ab_act", ...a });
    watch();
    advanceTo(now + Math.max(T.actMs, delay(rand)), 250);
    watch();
  }
  advanceTo(ab.endAt + 50);
  const r = { score: Math.round(ab.score), grade: ab.res[0], served, arrived: ab.g.n, maxCombo: ab.maxCombo };
  act({ t: "ab_close" });
  return r;
}
const human = (lo = 400, hi = 700) => (rand) => lo + rand() * (hi - lo);

// ── (a) determinism: customer number n is a pure function of the shift seed; so is a whole scripted shift
{
  const script = (seed) => {
    const ab = fakeAb(seed), bot = clerk(rng(5), 0.1), o = [];
    for (let t = 0; t < T.runMs; t += 250) {
      R.adv(S, p, ab, t);
      const a = bot(ab, t);
      if (a) R.act(S, p, ab, a, t);
      if (t % 5000 === 0) o.push(JSON.stringify([R.view(ab, t), ab.score, ab.combo]));
    }
    return o;
  };
  assert.deepEqual(script(777), script(777), "the same seed and the same inputs give the same shift");
  assert.notDeepEqual(script(777), script(778), "another seed, another shift");
  const first = (seed) => { const ab = fakeAb(seed); R.adv(S, p, ab, 1000); return JSON.stringify(R.view(ab, 1000)); };
  assert.equal(first(31337), first(31337), "the first customer comes the same");
  const a1 = startShift(), seed = a1.box.seed;
  assert.ok(seed !== 0 && Number.isInteger(seed));
  act({ t: "ab_leave" });
}

// ── (b) the customers: valid by construction, the specials by their rules, the lanes by theirs
{
  let n = 0, kinds = [0, 0, 0, 0], minPt = 1e9, maxTaps = 0, maxDue = 0, lateKinds = [0, 0, 0, 0];
  const taps = (due) => { let k = 0; for (const v of [50, 10, 5, 1]) { k += Math.floor(due / v); due %= v; } return k; };
  for (let seed = 1; seed <= 40; seed++) {
    const ab = fakeAb(seed * 7919), bot = clerk(rng(seed), 0.05), seen = new Set();
    for (let t = 0; t < T.runMs; t += 200) {
      R.adv(S, p, ab, t);
      const lanes = lanesOf(ab, t);
      assert.equal(lanes.length, 4);
      if (t < T.runMs - T.rushMs) assert.equal(lanes[3], 0, "the fourth lane opens with the rush");
      for (const c of ab.g.lanes.map((l) => l.c).filter(Boolean)) {
        if (seen.has(c.id)) continue;
        seen.add(c.id); n++;
        kinds[c.kind]++; if (t > 100000) lateKinds[c.kind]++;
        assert.ok(c.it.length >= 1 && c.it.length <= (c.kind === 2 ? 12 : 5), "1-5 items, a group has twelve");
        if (c.kind === 2) assert.equal(c.it.length, 12);
        assert.ok(c.it.every((v) => Number.isInteger(v) && v >= 2 && v <= 15), "prices of 200-1500 won");
        assert.equal(c.tot, sum(c.it)); assert.ok(c.paid > c.tot, "she pays more than the total");
        assert.ok(c.paid - c.tot <= 100, "no absurd change");
        maxDue = Math.max(maxDue, c.paid - c.tot); maxTaps = Math.max(maxTaps, taps(c.paid - c.tot));
        assert.ok(c.pt >= 7200 + 1800 * c.it.length && c.lv > t - 250, "a patience of at least seven seconds");
        minPt = Math.min(minPt, c.pt);
        if (n < 4) assert.equal(c.kind, 0, "the first customers are plain");
      }
      const a = bot(ab, t);
      if (a) R.act(S, p, ab, a, t);
    }
    assert.ok(seen.size > 20, "customers keep coming");
  }
  const share = (k) => kinds[k] / n;
  assert.ok(share(1) > 0.05 && share(1) < 0.2 && share(3) > 0.04 && share(3) < 0.2, `진상 and VIP are a minority (${share(1).toFixed(2)} / ${share(3).toFixed(2)})`);
  assert.ok(kinds[2] > 0 && share(2) < 0.06, `단체 is rare (${share(2).toFixed(3)})`);
  assert.ok(maxTaps <= 14, `change never takes more than 14 coins (${maxTaps})`);
  console.log(`store: ${n} customers checked: plain ${kinds[0]} · 진상 ${kinds[1]} · 단체 ${kinds[2]} · VIP ${kinds[3]}; shortest patience ${minPt} ms; most coins for one change ${maxTaps} (largest change ${maxDue * 100} won)`);
}

// ── the rules one by one (by hand, with customers set up directly)
{
  const ab = fakeAb(2024), g = ab.g;
  assert.deepEqual(lanesOf(ab, 0), [0, 0, 0, 0], "nobody before the first arrival");
  R.adv(S, p, ab, 399); assert.deepEqual(lanesOf(ab, 399), [0, 0, 0, 0]);
  R.adv(S, p, ab, 400); assert.ok(lanesOf(ab, 400)[0], "the first customer arrives at the start of work");
  assert.equal(lanesOf(ab, 400)[1], 0);
  R.adv(S, p, ab, 6000); assert.ok(lanesOf(ab, 6000).slice(0, 3).every(Boolean), "three lanes fill up, one after another");
  const mk = (kind, it, paid, lvIn = 1e9) => ({ id: ++g.n, kind, it, sc: 0, tot: sum(it), paid, tray: 0, lv: 6000 + lvIn, pt: lvIn, fl: 1, ch: 0 });
  const scanAll = (lane, t) => { for (let i = 0; i < g.lanes[lane].c.it.length; i++) assert.equal(R.act(S, p, ab, { s: lane, i }, t), null); };
  const gold = (n, lvl) => 20 + 5 * n + 30 + 15 + (lvl || 0);   // plain customer served at full patience, no slip
  // a plain customer: scan, then exact change
  g.lanes[0].c = mk(0, [5, 8], 20, 100000);   // total 13, paid 20, change 7 = 5 + 1 + 1
  assert.equal(R.act(S, p, ab, { p: 0, v: 1 }, 6000), "먼저 모든 물건을 스캔하세요", "no change before the scan is done");
  assert.equal(R.act(S, p, ab, { s: 0, i: 0 }, 6000), null); assert.equal(g.lanes[0].c.sc, 1);
  assert.equal(R.act(S, p, ab, { s: 0, i: 0 }, 6000), "이미 스캔했습니다"); assert.equal(g.lanes[0].c.sc, 1, "a scanned item is not scanned twice");
  assert.equal(R.act(S, p, ab, { s: 0, i: 1 }, 6000), null); assert.equal(g.lanes[0].c.sc, 3);
  const sc0 = ab.score;
  R.act(S, p, ab, { p: 0, v: 1 }, 6000); assert.equal(g.lanes[0].c.tray, 5);
  R.act(S, p, ab, { p: 0, v: 0 }, 6000); assert.equal(g.lanes[0].c.tray, 6);
  R.act(S, p, ab, { cl: 0 }, 6000); assert.equal(g.lanes[0].c.tray, 0, "the tray can be emptied");
  R.act(S, p, ab, { p: 0, v: 1 }, 6000); R.act(S, p, ab, { p: 0, v: 0 }, 6000);
  assert.equal(ab.score, sc0, "nothing is paid out before the change is exact");
  R.act(S, p, ab, { p: 0, v: 0 }, 6000);
  assert.equal(g.lanes[0].c, null, "exact change: the customer goes");
  assert.equal(ab.score - sc0, gold(2), `20 + 5/item + up to 30 for patience left + 15 for no slip (${ab.score - sc0})`); assert.equal(ab.combo, 1);
  assert.ok(g.lanes[0].at > 6000, "the next customer comes later");
  // too much change: the tray is emptied, the combo breaks, the accuracy bonus is gone
  g.lanes[0].c = mk(0, [5], 10, 100000);   // total 5, change 5
  scanAll(0, 6100);
  const sc1 = ab.score; R.act(S, p, ab, { p: 0, v: 3 }, 6100);
  assert.equal(g.lanes[0].c.tray, 0, "the coins go back"); assert.equal(g.lanes[0].c.fl, 0); assert.equal(ab.combo, 0, "a slip breaks the combo"); assert.equal(ab.score, sc1 - 5);
  R.act(S, p, ab, { p: 0, v: 1 }, 6100);
  assert.equal(ab.score - (sc1 - 5), 20 + 5 + 30, "served after a slip: no accuracy bonus");
  // 진상: she changes the amount at the first coin; that coin is not counted
  g.lanes[1].c = mk(1, [5, 5], 20, 100000);   // total 10, paid 20
  scanAll(1, 6200);
  R.act(S, p, ab, { p: 1, v: 2 }, 6200);
  assert.equal(g.lanes[1].c.paid, 50, "she hands over a 5000 won bill instead"); assert.equal(g.lanes[1].c.tray, 0); assert.equal(g.lanes[1].c.ch, 1);
  assert.equal(lanesOf(ab, 6200)[1][8], 1, "and the wire says so");
  const lv0 = g.lanes[1].c.lv; R.act(S, p, ab, { p: 1, v: 3 }, 6200);   // the new change is 40: a 50 is too much
  assert.equal(g.lanes[1].c.tray, 0); assert.equal(g.lanes[1].c.lv, lv0 - 3000, "a slip makes her angrier");
  for (let i = 0; i < 4; i++) R.act(S, p, ab, { p: 1, v: 2 }, 6200);
  assert.equal(g.lanes[1].c, null, "the new change (4 × 1000 won) is given");
  // 단체: twelve items, three times the money
  const sc2 = ab.score;
  g.lanes[2].c = mk(2, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], 50, 100000);   // total 36, change 14
  scanAll(2, 6300);
  for (const v of [2, 0, 0, 0, 0]) R.act(S, p, ab, { p: 2, v }, 6300);
  assert.equal(g.lanes[2].c, null);
  assert.ok(ab.score - sc2 >= (20 + 60 + 30 + 15) * 3, `a group is worth ×3 (${ab.score - sc2})`);
  // VIP: the tip only without a slip
  g.lanes[0].c = mk(3, [5], 10, 100000); scanAll(0, 6400);
  const sc3 = ab.score, cb3 = ab.combo; for (let i = 0; i < 5; i++) R.act(S, p, ab, { p: 0, v: 0 }, 6400);
  assert.ok(ab.score - sc3 >= (20 + 5 + 30 + 15 + 50), `a flawless VIP tips 50 (${ab.score - sc3})`); assert.equal(ab.combo, cb3 + 1);
  g.lanes[0].c = mk(3, [5], 10, 100000); scanAll(0, 6500);
  R.act(S, p, ab, { p: 0, v: 3 }, 6500); const sc4 = ab.score; R.act(S, p, ab, { p: 0, v: 1 }, 6500);
  assert.ok(ab.score - sc4 < 20 + 5 + 30 + 15 + 50 && ab.score - sc4 >= 20 + 5, "no tip after a slip");
  // a fever scans the whole counter at one tap
  g.lanes[0].c = mk(0, [2, 3, 4, 5], 30, 100000); ab.feverUntil = 999999;
  R.act(S, p, ab, { s: 0, i: 2 }, 6600); assert.equal(g.lanes[0].c.sc, 15, "fever: one scan scans them all");
  ab.feverUntil = 0;
  // patience: she leaves at her time, with her own timestamp; the lane waits a gap before the next one
  ab.score = 100; ab.combo = 3;
  g.lanes[0].c = mk(0, [5], 10, 500); g.lanes[1].c = null; g.lanes[1].at = 99999;
  g.lanes[2].c = null; g.lanes[2].at = 99999;
  R.adv(S, p, ab, 6499); assert.ok(g.lanes[0].c, "she is still waiting");
  R.adv(S, p, ab, 6501); assert.equal(g.lanes[0].c, null, "she left"); assert.equal(ab.score, 80, "-20"); assert.equal(ab.combo, 0, "and the combo broke");
  assert.ok(g.lanes[0].at >= 6500 + 2800 - 230 * 8 && g.lanes[0].at < 6500 + 2800 + 1800, "the next one comes after a gap measured from the moment she left");
  // lazy: a long silence applies arrivals and departures in order (each lane: arrive, wait out her patience, leave, again ...)
  const ab2 = fakeAb(5150);
  ab2.score = 1000;
  R.adv(S, p, ab2, 200000);
  assert.ok(ab2.g.n > 12, "many customers came and went while nobody looked"); assert.ok(ab2.score < 1000, "and every one that waited left angry");
  assert.equal(ab2.combo, 0);
  // the rush: the fourth lane
  const ab3 = fakeAb(61);
  R.adv(S, p, ab3, T.runMs - T.rushMs - 1); assert.equal(ab3.g.lanes[3].c, null);
  R.adv(S, p, ab3, T.runMs - T.rushMs + 500); assert.ok(ab3.g.lanes[3].c, "a fourth lane opens for the last 15 s");
  // difficulty climbs with the score and the time
  const abD = fakeAb(1); abD.score = 0; assert.equal(X.astoreDiff(abD, 0), 0); abD.score = 1e9; assert.equal(X.astoreDiff(abD, 0), 8); abD.score = 0; assert.equal(X.astoreDiff(abD, 90000), 2);
}

// ── (c) the bots
{
  const perfect35 = [], expert = [], hum = [], humClean = [], slow = [];
  for (let i = 0; i < 3; i++) perfect35.push(play(clerk(), () => 0, 100 + i));
  for (let i = 0; i < 12; i++) expert.push(play(clerk(), human(220, 320), 200 + i));
  for (let i = 0; i < 30; i++) hum.push(play(clerk(rng(300 + i), 0.075), human(), 300 + i));
  for (let i = 0; i < 20; i++) humClean.push(play(clerk(), human(), 400 + i));
  for (let i = 0; i < 30; i++) slow.push(play(clerk(rng(500 + i), 0.075), human(700, 1100), 500 + i));
  const idleRun = play(idle(), () => 0, 9);
  const row = (name, rs) => {
    const m = mean(rs.map((r) => r.score));
    console.log(`store bot ${name.padEnd(28)} mean ${String(Math.round(m)).padStart(6)} (${(m / PAR).toFixed(2)} par)  grades ${["-", "C", "B", "A", "S"].map((l, gi) => `${l}${rs.filter((r) => r.grade === gi).length}`).join(" ")}  customers ${mean(rs.map((r) => r.arrived)).toFixed(0)} came, ${mean(rs.map((r) => r.served)).toFixed(0)} served`);
    return m / PAR;
  };
  row("perfect, no latency", perfect35);
  row("expert 220-320 ms, optimal", expert);
  const rH = row("human 400-700 ms, 7.5% slips", hum);
  const rC = row("human 400-700 ms, no slips", humClean);
  const rS = row("slow 700-1100 ms, 7.5% slips", slow);
  assert.equal(idleRun.score, 0, "an idle shift scores 0"); assert.equal(idleRun.grade, 0, "and is below C");
  assert.ok(perfect35.every((r) => r.grade === 4), "a perfect bot is S");
  assert.ok(expert.every((r) => r.grade === 4), "an optimal fast player is S");
  assert.ok(rH >= 0.62 && rH < 0.88, `a human-like bot lands around B (${rH.toFixed(2)} of par)`);
  assert.ok(hum.filter((r) => r.grade === 4).length <= hum.length * 0.3, "S is rare for a human-like bot: it needs near-flawless play");
  assert.ok(rC > rH, "fewer slips, more points");
  assert.ok(rC >= 0.9, "a flawless human reads S");
  assert.ok(rS >= T.cuts[0] && rS < rH, "a slow player still gets a C");
}

// ── (d) hostile input: nothing throws, nothing is scored or moved by junk
{
  const sane = (ab) => {
    assert.ok(Number.isFinite(ab.score) && ab.score >= 0 && Number.isFinite(ab.combo), "the score stays a clean number");
    for (const l of ab.g.lanes) if (l.c) {
      const c = l.c;
      assert.ok(Number.isInteger(c.sc) && c.sc >= 0 && c.sc < 1 << c.it.length && Number.isInteger(c.tray) && c.tray >= 0 && c.tray < c.paid - c.tot, "a customer's state stays in range");
    }
  };
  const key = (ab) => { const c = lanesOf(ab, now)[0]; return JSON.stringify(c ? [c[0], c[1], c[2], c[3], c[4], c[5], c[8]] : 0) + ab.score + "/" + ab.combo; };
  const junk = ["0", "", "abc", 0.5, -1, 4, 5, 144, 1e9, -1e9, NaN, Infinity, -Infinity, null, true, false, {}, [], [0], ["0"], "__proto__", "constructor", 1n, 2 ** 53];
  const show = (a) => JSON.stringify(a, (k, x) => (typeof x === "bigint" ? `${x}n` : typeof x === "number" && !Number.isFinite(x) ? String(x) : x));
  const ab = startShift(), k0 = key(ab);
  for (const a of [{ s: 0, i: 0 }, { p: 0, v: 0 }, { cl: 0 }, {}]) { act({ t: "ab_act", ...a }); advanceTo(now + 40); }
  assert.equal(key(ab), k0, "nothing happens during the brief");
  advanceTo(ab.runAt + 700);   // customer 1 is in lane 0
  assert.ok(ab.g.lanes[0].c, "a customer to be rude to");
  const k1 = key(ab);
  for (const v of junk) {
    for (const a of [{ s: v, i: 0 }, { s: 0, i: v }, { p: v, v: 0 }, { p: 0, v }, { cl: v }, { s: v }, { p: v }, { s: v, p: 0 }]) {
      assert.doesNotThrow(() => act({ t: "ab_act", ...a }), `no throw on ${show(a)}`);
      advanceTo(now + 40); sane(ab);
      assert.equal(key(ab), k1, `${show(a)} changes nothing`);
    }
  }
  // an empty lane, a pad before the scan, a lane too high
  for (const a of [{ s: 1, i: 0 }, { p: 1, v: 0 }, { cl: 1 }, { s: 3, i: 0 }, { p: 0, v: 0 }, { p: 0, v: 3 }, { s: 0, i: 99 }, { s: 0, i: -1 }, { p: 2, v: 0 }]) { act({ t: "ab_act", ...a }); advanceTo(now + 40); sane(ab); }
  assert.equal(key(ab), k1, "wrong lanes, wrong order: nothing moves");
  // a mash of random junk objects
  const r = rng(4242), pool = [...junk.filter((v) => typeof v !== "bigint"), 0, 1, 2, 3, 7, 99];
  for (let i = 0; i < 400; i++) {
    const a = { t: "ab_act" };
    for (const f of ["s", "p", "cl", "i", "v", "x"]) if (r() < 0.45) a[f] = pool[Math.floor(r() * pool.length)];
    assert.doesNotThrow(() => act(a), show(a)); advanceTo(now + 36); sane(ab);
  }
  // spam: ten taps in 90 ms; the 35 ms limit lets only some through
  const lane = ab.g.lanes.findIndex((l) => l.c && l.c.sc === 0);
  if (lane >= 0) {
    const c = ab.g.lanes[lane].c, n0 = c.it.length;
    for (let i = 0; i < Math.min(10, n0); i++) { act({ t: "ab_act", s: lane, i }); advanceTo(now + 9); }
    const scanned = [...Array(n0).keys()].filter((i) => c.sc & (1 << i)).length;
    assert.ok(scanned <= 4 || ab.g.lanes[lane].c !== c, `the 35 ms limit holds (${scanned} scans in 90 ms)`);
  }
  // after the end and with no shift
  advanceTo(ab.endAt + 100);
  const scEnd = ab.score, viewEnd = key(ab);
  for (const a of [{ s: 0, i: 0 }, { p: 0, v: 3 }, { cl: 0 }, { s: "x" }]) { assert.doesNotThrow(() => act({ t: "ab_act", ...a })); advanceTo(now + 40); }
  assert.equal(ab.score, scEnd, "nothing counts after the end"); assert.equal(key(ab), viewEnd);
  act({ t: "ab_close" });
  assert.equal(act({ t: "ab_act", s: 0, i: 0 }).ok, false, "no shift, no input");
  console.log("store: hostile input ok (junk of every type, 400 random objects, spam, before the start and after the end)");
}

// ── (e) server cost and (f) wire size: a 90 s shift at 10 ticks/s with a snapshot each tick and a tap every 300 ms
{
  const run = (withShift) => {
    if (p.ab) act({ t: "ab_close" });
    now += 1000 * 3600 + 7919; nextTick = now; S.now = now;
    if (withShift) act({ t: "ab_start", k: K });
    const ab = p.ab, bot = clerk(), end = now + T.briefMs + T.runMs + 200;
    let ms = 0, bytes = 0, maxBytes = 0, sent = 0, snaps = 0, lastAct = 0;
    while (now < end) {
      now += 100; S.now = now;
      const t0 = performance.now();
      L.tick(S, now);
      const v = L.viewFor(S, "p1");
      L.endTick(S);
      ms += performance.now() - t0;
      if (v.ab && v.ab[7]) { const n = JSON.stringify(v.ab[7]).length; maxBytes = Math.max(maxBytes, n); bytes += n; snaps++; }
      if (withShift && now >= ab.runAt && now - lastAct >= 300) {
        const a = bot(ab, now);
        if (a) { const t1 = performance.now(); act({ t: "ab_act", ...a }); ms += performance.now() - t1; sent++; }
        lastAct = now;
      }
    }
    return { ms, maxBytes, snaps, bytes, sent };
  };
  run(false);   // warm up
  const best = (w) => { const a = run(w), b = run(w); return a.ms < b.ms ? a : b; };   // the quieter of two runs
  const base = best(false), full = best(true);
  const perMin = Math.max(0, full.ms - base.ms) / 1.5;
  console.log(`store: the shift costs ${(full.ms - base.ms).toFixed(1)} ms per 90 s = ${perMin.toFixed(2)} ms per simulated minute (the world alone ${base.ms.toFixed(1)} ms); ${full.sent} taps; wire: ${full.snaps} state sends, max ${full.maxBytes} bytes, avg ${(full.bytes / full.snaps).toFixed(0)}`);
  assert.ok(perMin < 20, "the shift costs far less than 100 ms per simulated minute");
  assert.ok(full.maxBytes < 700, "the game state on the wire stays small");
  assert.ok(full.snaps <= full.sent + 120, "the state is sent only when it changed (taps, arrivals, departures)");
  act({ t: "ab_close" });
}

console.log("alba-store: ok");
