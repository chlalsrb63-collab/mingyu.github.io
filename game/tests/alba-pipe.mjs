// 일일 아르바이트 · 배관 수리 (67-alba-pipe.js): seeded sites solvable by construction, the water trace, scoring, grades against bots, hostile input, cost and wire size.
// node tests/alba-pipe.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, albaGrade, albaAdvance, APIPE, apipeSite, apipeTrace, apipeLen, apipeLimit };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, K = "pipe", R = X.ALBA_RULES[K], T = X.ALBA_T, PAR = X.ALBA[K].par;
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hex = (s) => [...s].map((c) => (c === "#" ? 255 : parseInt(c, 16)));

// ── world, clock, helpers
const S = L.setup();
let now = 20_000_000, nextTick = 0;
S.now = now;
L.addPlayer(S, "p1", L.hero("배관공", { wk: "sword", lvl: 30, migrate: true }));
const p = S.players.p1;
p.map = "town";
const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
/** Run the server's ticks up to `t` (the lazy rules do not need them, the shift's end does), then stand at `t`. */
function advanceTo(t, step = 100) {
  while (nextTick + step <= t) { nextTick += step; S.now = nextTick; L.tick(S, nextTick); L.endTick(S); }
  S.now = now = t;
  if (p.ab) X.albaAdvance(S, p, p.ab, t);   // what the next 100 ms tick would do: the clocks are at `t` when the bot looks
}
function startShift() {
  if (p.ab) { act({ t: "ab_close" }); act({ t: "ab_close" }); }
  now += 1000 * 3600 + 7919;
  nextTick = now;
  S.now = now;
  assert.ok(act({ t: "ab_start", k: K }).ok, "the shift starts");
  return p.ab;
}
/** A bare shift record, enough for the rules and the scoring helpers (no world). */
const fakeAb = (seed) => { const ab = { k: K, box: { seed }, runAt: 0, endAt: 1e12, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null }; R.init(S, p, ab); return ab; };

// ── the water, for the bots (the rule's trace that also says where the water waits)
function waits(b, ir) {
  let x = 0, y = ir, from = 3;
  for (let k = 0; k < 300; k++) {
    if (x < 0 || y < 0 || x > 11 || y > 11) return null;
    const m = b[y * 12 + x];
    if (m === 0) return { c: y * 12 + x, from };
    if (m === 255 || !(m & (1 << from))) return null;
    const out = m === 15 ? (from + 2) & 3 : 31 - Math.clz32(m & ~(1 << from));
    x += [0, 1, 0, -1][out]; y += [-1, 0, 1, 0][out]; from = (out + 2) & 3;
  }
  return null;
}

// ── bots: (ab, now) → an action object, or null to wait
const idle = () => () => null;
/** Knows the hidden route: every needed piece goes where it belongs, every spare is dumped off the route. Never trashes. `slip`: a click lands one cell off. */
const perfect = (rand = null, slip = 0) => (ab, t) => {
  const g = ab.g;
  if (t < g.goAt) return null;
  const i = g.path.findIndex((c) => g.b[c] === 0), hand = g.deck[g.di], on = new Set(g.path);
  let c = i >= 0 && g.pm[i] === hand ? g.path[i] : g.b.findIndex((m, ci) => !m && !on.has(ci));
  if (c < 0) return { tr: 1 };
  if (rand && rand() < slip) c = slipOf(c, rand);
  return { c };
};
const slipOf = (c, rand) => {
  const x = c % 12, y = (c / 12) | 0, d = Math.floor(rand() * 4), nx = x + [0, 1, 0, -1][d], ny = y + [-1, 0, 1, 0][d];
  return nx >= 0 && ny >= 0 && nx < 12 && ny < 12 ? ny * 12 + nx : c;
};
/** Sees only the wire's view (board, hand, next three): extends the water when the hand fits and the next piece agrees, else dumps it far away; `slip`: a click lands one cell off. */
const honest = (rand, slip) => {
  let site = 0, dumps = 0;
  return (ab, t) => {
    const [n, ir, or, bs, q, goMs] = JSON.parse(JSON.stringify(R.view(ab, t)));
    if (goMs > 0) return null;
    if (n !== site) { site = n; dumps = 0; }
    const b = hex(bs), hand = parseInt(q[0], 16), q1 = parseInt(q[1], 16), q2 = parseInt(q[2], 16), f = waits(b, ir);
    if (!f) return { sk: 1 };
    const put = (bb, m, c) => { const b2 = bb.slice(); b2[c] = m; return b2; };
    const good = (bb, m, ff) => !!(m & (1 << ff.from)) && X.apipeTrace(put(bb, m, ff.c), ir, or) !== 2;
    let take = false;
    if (good(b, hand, f)) {
      const b2 = put(b, hand, f.c);
      if (X.apipeTrace(b2, ir, or) === 1) take = true;
      else { const f2 = waits(b2, ir); take = !!f2 && (good(b2, q1, f2) || (!good(b, q1, f) && good(b2, q2, f2))); }
    }
    let c = f.c;
    if (take) dumps = 0;
    else {
      if (++dumps > 7) return { sk: 1 };   // the route is lost: give the site up
      c = b.findIndex((m, i) => m === 0 && i !== f.c);
    }
    if (rand() < slip) c = slipOf(c, rand);
    return { c };
  };
};

/** One shift with a bot; `delay(rand)` is the time between two of its decisions. Returns the score and how the sites ended (cleared/leak/timeout/skip). */
function play(bot, delay, seed = 1) {
  const rand = rng(seed), ab = startShift(), tally = [0, 0, 0, 0, 0];
  advanceTo(ab.runAt + 1);
  let seen = ab.g.n;
  const count = () => { if (ab.g.n !== seen) { tally[ab.g.lr]++; seen = ab.g.n; } };
  while (now < ab.endAt) {
    const a = bot(ab, now);
    count();
    if (!a) { advanceTo(now + 100, 250); continue; }
    act({ t: "ab_act", ...a });
    count();
    advanceTo(now + Math.max(T.actMs, delay(rand)), 250);
  }
  advanceTo(ab.endAt + 50);
  const r = { score: Math.round(ab.score), grade: ab.res[0], tally, maxCombo: ab.maxCombo };
  act({ t: "ab_close" });
  return r;
}
const human = (lo = 400, hi = 700) => (rand) => lo + rand() * (hi - lo);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// ── (a) determinism: a site is a pure function of the shift seed and its number; so is a whole scripted shift
{
  const mk = (seed) => { const ab = { box: { seed }, g: { n: 0 } }, out = []; for (let i = 0; i < 12; i++) { X.apipeSite(ab, 0, 0); out.push(JSON.stringify([ab.g.ir, ab.g.or, ab.g.b, ab.g.deck, ab.g.path])); } return out; };
  assert.deepEqual(mk(12345), mk(12345), "the same seed builds the same sites");
  assert.notEqual(mk(12345)[0], mk(54321)[0], "another seed, another site");
  const script = (seed) => {
    const ab = fakeAb(seed), g = ab.g, o = [];
    let t = 0;
    for (let i = 0; i < 400; i++) {
      t += 450;
      R.adv(S, p, ab, t);
      const a = i % 31 === 7 ? { tr: 1 } : i % 97 === 50 ? { sk: 1 } : { c: (i * 37 + g.n * 11) % 144 };
      R.act(S, p, ab, a, t);
      if (i % 20 === 0) o.push(JSON.stringify([R.view(ab, t), ab.score, ab.combo]));
    }
    return o;
  };
  assert.deepEqual(script(777), script(777), "the same seed and the same inputs give the same shift");
  assert.notDeepEqual(script(777), script(778));
  const a1 = startShift(), v1 = JSON.stringify(R.view(a1, now)), seed = a1.box.seed;
  assert.equal(seed, p.ab.box.seed); assert.ok(v1.length > 100);
  act({ t: "ab_leave" });
}

// ── (b) every site is solvable by construction: a solver bot, playing through the rule's own act, clears each one and never leaks
{
  let sites = 0, short = 0, minLen = 99, maxLen = 0, maxPlaced = 0, spare = 0, cells = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const ab = fakeAb(seed * 7919), g = ab.g;
    let t = 0;
    for (let n = 1; n <= 14; n++) {
      assert.equal(g.n, n);
      assert.equal(g.path[0], g.ir * 12, "the route starts at the inlet cell"); assert.equal(g.path.at(-1), g.or * 12 + 11, "and ends at the outlet cell");
      assert.equal(new Set(g.path).size, g.path.length, "self-avoiding");
      for (let i = 1; i < g.path.length; i++) {
        const d = Math.abs(g.path[i] - g.path[i - 1]);
        assert.ok(d === 12 || (d === 1 && ((g.path[i] / 12) | 0) === ((g.path[i - 1] / 12) | 0)), "steps are neighbours");
      }
      for (const c of g.path) assert.notEqual(g.b[c], 255, "no rock on the route");
      assert.equal(g.b.filter((m) => m === 255).length, Math.min(30, 6 + 4 * n), "rocks grow with the site number");
      assert.ok(g.deck.length >= g.path.length, "the deck holds the route"); spare += g.deck.length - g.path.length; cells += g.path.length;
      assert.ok(g.deck[0] === g.pm[0], "the first piece is the inlet's");
      if (g.path.length < X.apipeLen(n)) short++;
      minLen = Math.min(minLen, g.path.length); maxLen = Math.max(maxLen, g.path.length);
      const on = new Set(g.path), site = n;
      let placed = 0;
      t = g.goAt;
      while (g.n === site) {
        const i = g.path.findIndex((c) => g.b[c] === 0), hand = g.deck[g.di];
        const c = i >= 0 && g.pm[i] === hand ? g.path[i] : g.b.findIndex((m, ci) => m === 0 && !on.has(ci));
        assert.equal(R.act(S, p, ab, { c }, t), null); t += 40; placed++;
        assert.ok(placed < 200, "the site ends");
      }
      assert.equal(g.lr, 1, `site ${n} (seed ${seed}) is cleared by the route's pieces`);
      maxPlaced = Math.max(maxPlaced, placed);
      sites++;
    }
  }
  assert.ok(spare / cells > 0.22 && spare / cells < 0.38, `about 30 % spares (${(spare / cells).toFixed(2)})`);
  console.log(`pipe: ${sites} sites solved; route ${minLen}..${maxLen} cells (${short} shortened by a tight board), at most ${maxPlaced} placements`);
}

// ── a site can always be finished: whatever a player builds, dumps or trashes, the route is redrawn from where the water is (or the water leaks at once)
{
  let ended = 0, cleared = 0, leaked = 0, replans = 0;
  const r = rng(99);
  for (let seed = 1; seed <= 150; seed++) {
    const ab = fakeAb(seed * 104729), g = ab.g;
    let t = g.goAt;
    for (let n = 1; n <= 8; n++) {
      const site = g.n;
      for (let k = 0, moves = 2 + Math.floor(r() * 10); k < moves && g.n === site; k++) {   // a human's mess: placements anywhere, now and then a trash
        const before = g.path.join();
        if (r() < 0.12) R.act(S, p, ab, { tr: 1 }, t);
        else { const free = []; g.b.forEach((m, c) => { if (!m) free.push(c); }); R.act(S, p, ab, { c: free[Math.floor(r() * free.length)] }, t); }
        if (g.n === site && g.path.join() !== before) replans++;
        t += 40;
      }
      for (let k = 0; g.n === site; k++) {
        assert.ok(k < 400, "a site always ends");
        const i = g.path.findIndex((c) => g.b[c] === 0), hand = g.deck[g.di], on = new Set(g.path);
        const c = i >= 0 && g.pm[i] === hand ? g.path[i] : g.b.findIndex((m, ci) => !m && !on.has(ci));
        assert.equal(R.act(S, p, ab, c >= 0 ? { c } : { tr: 1 }, t), null); t += 40;
      }
      ended++;
      if (g.lr === 1) cleared++; else { assert.equal(g.lr, 2, `only a leak can end it (seed ${seed}, site ${n}, ended ${g.lr}, left ${g.te - t})`); leaked++; }
      t = g.goAt;
    }
  }
  assert.ok(cleared / ended > 0.8, `after a mess the route is redrawn and the site is finished (${cleared}/${ended}, ${leaked} leaks, ${replans} redrawn routes)`);
  assert.ok(replans > 100, "routes are redrawn");
  console.log(`pipe: after random mess ${cleared}/${ended} sites cleared, ${leaked} leaked (walled in), ${replans} routes redrawn`);
}

// ── the water's trace, by hand
{
  const b = new Array(144).fill(0), ir = 3, or = 3;
  assert.equal(X.apipeTrace(b, ir, or), 0, "an empty board: the water waits at the inlet cell");
  for (let x = 0; x < 12; x++) b[3 * 12 + x] = 10;
  assert.equal(X.apipeTrace(b, ir, or), 1, "a straight run from the inlet to the outlet clears");
  b[3 * 12 + 11] = 5; assert.equal(X.apipeTrace(b, ir, or), 2, "a closed side leaks");
  b[3 * 12 + 11] = 10; b[3 * 12 + 5] = 255; assert.equal(X.apipeTrace(b, ir, or), 2, "a rock leaks");
  b[3 * 12 + 5] = 15; assert.equal(X.apipeTrace(b, ir, or), 1, "a cross passes straight through");
  b[3 * 12 + 11] = 6; assert.equal(X.apipeTrace(b, ir, or), 2, "a corner at the last cell leaks out of the board");
  b[3 * 12 + 11] = 10; assert.equal(X.apipeTrace(b, ir, or + 1), 2, "leaving the east edge on the wrong row leaks");
  const loop = new Array(144).fill(0); [[0, 3], [1, 3]].forEach(([x, y]) => { loop[y * 12 + x] = 10; });
  loop[3 * 12 + 2] = 12; loop[4 * 12 + 2] = 9; assert.equal(X.apipeTrace(loop, 3, 3), 0, "water that turns back into itself still waits at the first empty cell (no loop here)");
}

// ── a real shift, rule by rule
{
  const ab = startShift(), g = ab.g;
  assert.deepEqual(R.view(ab, now).slice(0, 3).length, 3);
  act({ t: "ab_act", c: 0 }); assert.equal(g.b[0] === 0 || g.ir === 0, true, "nothing is placed during the brief (unless it was the inlet's own cell: not possible)");
  assert.equal(g.di, 0, "the brief takes no input");
  advanceTo(ab.runAt + 100);
  const n0 = g.n, t0 = now, first = g.te - g.goAt;
  assert.equal(first, X.apipeLimit(1), "site 1's clock");
  while (g.n === n0) { act({ t: "ab_act", ...perfect()(ab, now) }); advanceTo(now + 40); }
  assert.equal(g.lr, 1, "cleared");
  const left = Math.floor((first - (t0 - ab.runAt)) / 1000);
  assert.ok(ab.score >= 150 + 3 * (left - 6) && ab.score <= 150 + 3 * left, `100 + 3/s left + 50, got ${ab.score} (about ${left} s left)`);
  assert.equal(ab.combo, 1, "a clear is a combo step");
  const gap = g.goAt - now;
  assert.ok(gap > 0 && gap <= X.APIPE.gap, "the next site opens after a short gap");
  const before = JSON.stringify(R.view(ab, now));
  act({ t: "ab_act", c: 70 }); assert.equal(g.b[70], 0, "no placing during the gap"); assert.equal(g.di, 0);
  void before;
  advanceTo(g.goAt + 50);
  // trash: 3 s off the clock, the bonus is gone
  const te0 = g.te, hand0 = g.deck[g.di];
  assert.ok(act({ t: "ab_act", tr: 1 }).ok); assert.equal(g.te, te0 - X.APIPE.trashMs, "trash: 3 s off the clock"); assert.equal(g.tr, 1); assert.notEqual(g.di, 0);
  void hand0;
  // a leak: put a piece without a west opening on the inlet cell
  advanceTo(now + 50);
  for (let i = 0; i < 12 && (g.deck[g.di] & 8); i++) { act({ t: "ab_act", tr: 1 }); advanceTo(now + 40); }
  assert.ok(!(g.deck[g.di] & 8), "a piece that cannot take the water");
  const n1 = g.n, sc = ab.score;
  act({ t: "ab_act", c: g.ir * 12 });
  assert.equal(g.n, n1 + 1, "the leak ends the site at once"); assert.equal(g.lr, 2); assert.equal(ab.combo, 0, "the combo is broken"); assert.equal(ab.score, sc, "no points for a leak");
  // a timeout scores nothing and starts the next site; a skip does the same at once
  const n2 = g.n, sc2 = ab.score;
  advanceTo(g.te + 5);
  assert.equal(g.n, n2 + 1); assert.equal(g.lr, 3); assert.equal(ab.score, sc2, "a timed-out site is worth 0");
  advanceTo(g.goAt + 60); const n3 = g.n;
  assert.ok(act({ t: "ab_act", sk: 1 }).ok); assert.equal(g.n, n3 + 1); assert.equal(g.lr, 4);
  // idle for a long stretch: sites time out one after another, in order, each with its own number
  act({ t: "ab_leave" });
  const ab2 = startShift(), g2 = ab2.g;
  advanceTo(ab2.runAt + 1); const m0 = g2.n;
  advanceTo(ab2.runAt + 89_000);
  assert.ok(g2.n >= m0 + 2, "sites keep timing out while nobody plays");
  assert.equal(ab2.score, 0, "and score nothing");
  act({ t: "ab_leave" });
}

// ── (c) the bots
{
  const perfect35 = [], expert = [], oracle = [], hum = [], humClean = [], slow = [];
  for (let i = 0; i < 3; i++) perfect35.push(play(perfect(), () => 0, 100 + i));
  for (let i = 0; i < 12; i++) expert.push(play(perfect(), human(220, 320), 200 + i));
  for (let i = 0; i < 20; i++) oracle.push(play(perfect(rng(600 + i), 0.075), human(), 600 + i));
  for (let i = 0; i < 30; i++) hum.push(play(honest(rng(300 + i), 0.075), human(), 300 + i));
  for (let i = 0; i < 20; i++) humClean.push(play(honest(rng(400 + i), 0), human(), 400 + i));
  for (let i = 0; i < 30; i++) slow.push(play(honest(rng(500 + i), 0.075), human(700, 1100), 500 + i));
  const idleRun = play(idle(), () => 0, 9);
  const row = (name, rs) => {
    const m = mean(rs.map((r) => r.score)), tl = [1, 2, 3, 4].map((i) => (mean(rs.map((r) => r.tally[i]))).toFixed(1)).join("/");
    console.log(`pipe bot ${name.padEnd(28)} mean ${String(Math.round(m)).padStart(6)} (${(m / PAR).toFixed(2)} par)  grades ${["-", "C", "B", "A", "S"].map((l, gi) => `${l}${rs.filter((r) => r.grade === gi).length}`).join(" ")}  sites ok/leak/timeout/skip ${tl}`);
    return m / PAR;
  };
  row("perfect, no latency", perfect35);
  row("expert 220-320 ms, optimal", expert);
  const rO = row("oracle 400-700 ms, 7.5% slips", oracle);
  const rH = row("human 400-700 ms, 7.5% slips", hum);
  const rC = row("human 400-700 ms, no slips", humClean);
  const rS = row("slow 700-1100 ms, 7.5% slips", slow);
  assert.equal(idleRun.score, 0, "an idle shift scores 0"); assert.equal(idleRun.grade, 0, "and is below C");
  assert.ok(perfect35.every((r) => r.grade === 4), "a perfect bot is S");
  assert.ok(expert.every((r) => r.grade === 4), "an optimal fast player is S");
  assert.ok(rH >= 0.62 && rH < 0.88, `a human-like bot lands around B (${rH.toFixed(2)} of par)`);
  assert.ok(hum.filter((r) => r.grade === 4).length <= hum.length * 0.3, "S is rare for a human-like bot: it needs near-flawless play");
  assert.ok(rC > rH && rO > rH, "fewer slips and sure knowledge, more points");
  assert.ok(rO >= 0.9, "a flawless player reads S");
  assert.ok(rS >= T.cuts[0] && rS < rH, "a slow player still gets a C");
}

// ── (d) hostile input: nothing throws, nothing is scored or moved by junk
{
  const sane = (ab) => {
    const g = ab.g;
    assert.ok(Number.isFinite(ab.score) && ab.score >= 0 && Number.isFinite(ab.combo), "the score stays a clean number");
    assert.ok(g.b.length === 144 && g.b.every((m) => Number.isInteger(m) && ((m >= 0 && m <= 15) || m === 255)), "the board holds pieces and rocks only");
    assert.ok(g.deck.length - g.di >= 5 && g.deck.every((m) => Number.isInteger(m) && m >= 1 && m <= 15), "the deck stays full");
  };
  // the state without the clocks (those move with `now`)
  const key = (ab) => { const v = R.view(ab, now); return JSON.stringify([v.slice(0, 5), v.slice(7)]) + ab.score + "/" + ab.combo; };
  const junk = ["5", "", "abc", 5.5, -1, 144, 1e9, -1e9, NaN, Infinity, -Infinity, null, true, false, {}, [], [3], ["3"], "__proto__", "constructor", 1n, 2 ** 53, 0.5];
  const show = (a) => JSON.stringify(a, (k, x) => (typeof x === "bigint" ? `${x}n` : typeof x === "number" && !Number.isFinite(x) ? String(x) : x));
  const ab = startShift(), k0 = key(ab);
  for (const a of [{ c: 5 }, { c: 70 }, { tr: 1 }, { sk: 1 }, {}]) { act({ t: "ab_act", ...a }); advanceTo(now + 40); }
  assert.equal(key(ab), k0, "nothing happens during the brief"); assert.equal(ab.g.di, 0);
  advanceTo(ab.runAt + 100);
  const k1 = key(ab);
  for (const v of junk) {
    for (const a of [{ c: v }, { tr: v }, { sk: v }, { c: v, tr: 1 }, { c: v, sk: 1 }]) {
      assert.doesNotThrow(() => act({ t: "ab_act", ...a }), `no throw on ${show(a)}`);
      advanceTo(now + 40);
      sane(ab);
      assert.equal(key(ab), k1, `${show(a)} changes nothing`);
    }
  }
  for (const a of [{ c: -0.5 }, { tr: "1" }, { tr: true }, { sk: "1" }, { sk: true }, { c: undefined }, { z: 1 }, { c: undefined, tr: 2 }]) { act({ t: "ab_act", ...a }); advanceTo(now + 40); sane(ab); }
  assert.equal(key(ab), k1, "junk, again, changes nothing");
  // a mash of random junk objects (a real trash or skip is left out: those are legal moves)
  const r = rng(4242), pool = [...junk.filter((v) => typeof v !== "bigint"), 0, 143, 7, 99];
  for (let i = 0; i < 1000; i++) {
    const a = { t: "ab_act" };
    for (const f of ["c", "tr", "sk", "x"]) if (r() < 0.5) a[f] = pool[Math.floor(r() * pool.length)];
    if (a.tr === 1 || a.sk === 1 || (Number.isInteger(a.c) && a.c >= 0 && a.c < 144)) continue;
    assert.doesNotThrow(() => act(a), show(a)); advanceTo(now + 36); sane(ab);
  }
  assert.equal(key(ab), k1, "1000 random junk objects change nothing");
  // spam: ten placements in 90 ms; the 35 ms limit lets only some through
  const free = []; ab.g.b.forEach((m, c) => { if (!m) free.push(c); });
  const filled0 = ab.g.b.filter((m) => m && m !== 255).length, n0 = ab.g.n;
  let leaked = false;
  for (let i = 0; i < 10 && ab.g.n === n0; i++) { act({ t: "ab_act", c: free[(i * 13) % free.length] }); advanceTo(now + 9); }
  if (ab.g.n !== n0) leaked = true;
  const placed = leaked ? 0 : ab.g.b.filter((m) => m && m !== 255).length - filled0;
  assert.ok(placed <= 4, `the 35 ms limit holds (${placed} of 10 placements in 90 ms)`);
  // a taken cell or a rock is refused and costs nothing
  advanceTo(now + 100);
  const taken = ab.g.b.findIndex((m) => m && m !== 255), rock = ab.g.b.findIndex((m) => m === 255), sc = ab.score, di = ab.g.di;
  if (taken >= 0) { act({ t: "ab_act", c: taken }); advanceTo(now + 40); }
  act({ t: "ab_act", c: rock }); advanceTo(now + 40);
  assert.equal(ab.g.di, di, "a taken cell or a rock takes no piece"); assert.equal(ab.score, sc);
  // after the end and with no shift
  advanceTo(ab.endAt + 100);
  const scEnd = ab.score, viewEnd = key(ab);
  for (const a of [{ c: 3 }, { tr: 1 }, { sk: 1 }, { c: "x" }]) { assert.doesNotThrow(() => act({ t: "ab_act", ...a })); advanceTo(now + 40); }
  assert.equal(ab.score, scEnd, "nothing counts after the end"); assert.equal(key(ab), viewEnd);
  act({ t: "ab_close" });
  assert.equal(act({ t: "ab_act", c: 3 }).ok, false, "no shift, no input");
  console.log("pipe: hostile input ok (junk of every type, 1000 random objects, spam, before the start and after the end)");
}

// ── (e) server cost and (f) wire size: a 90 s shift at 10 ticks/s with a snapshot each tick and a move every 300 ms
{
  const run = (withShift) => {
    if (p.ab) act({ t: "ab_close" });
    now += 1000 * 3600 + 7919; nextTick = now; S.now = now;
    if (withShift) act({ t: "ab_start", k: K });
    const ab = p.ab, bot = perfect(), end = now + T.briefMs + T.runMs + 200;
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
  console.log(`pipe: the shift costs ${(full.ms - base.ms).toFixed(1)} ms per 90 s = ${perMin.toFixed(2)} ms per simulated minute (the world alone ${base.ms.toFixed(1)} ms); ${full.sent} moves; wire: ${full.snaps} state sends, max ${full.maxBytes} bytes, avg ${(full.bytes / full.snaps).toFixed(0)}`);
  assert.ok(perMin < 20, "the shift costs far less than 100 ms per simulated minute");
  assert.ok(full.maxBytes < 700, "the game state on the wire stays small");
  assert.ok(full.snaps <= full.sent + 80, "the state is sent only when it changed");
  act({ t: "ab_close" });
}

console.log("alba-pipe: ok");
