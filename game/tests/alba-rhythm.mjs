// 일일 아르바이트 · 여관 공연 (67-alba-rhythm.js): the judging windows (latency allowance, fever), misses in order, holds, chords, stray presses and the mash
// lock, the fairness of the generated song, determinism, hostile input, the view, the server's cost, and bots that play whole shifts through the real path.
// node tests/alba-rhythm.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, RHY, rhyBuild, rhyBpm, albaGrade };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, R = X.ALBA_RULES.rhythm, RHY = X.RHY, T = X.ALBA_T, PAR = X.ALBA.rhythm.par;

// ── unit harness: a bare shift object whose clock starts at 0 (runAt 0); notes are set by hand
const mkAb = (seed = 7) => {
  const ab = { k: "rhythm", box: { seed }, runAt: 0, endAt: 1e9, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null };
  R.init(null, null, ab);
  return ab;
};
/** notes: [[t, lane, hold?]…] in time order */
function setNotes(ab, list) {
  const g = ab.g;
  g.N = list.map(([t, l, h = 0], id) => ({ t, l, h, s: 0, id }));
  g.Q = [[], [], [], []];
  g.N.forEach((n) => g.Q[n.l].push(n.id));
  Object.assign(g, { P: [0, 0, 0, 0], H: 0, hold: [-1, -1, -1, -1], lock: 0, stray: [], sent: 0, seq: 0, ev: [], cnt: [0, 0, 0], last: 0 });
  return ab;
}
/** What the engine does for an input: bring the shift to `now`, then the game's rule. */
const send = (ab, now, a) => { R.adv(null, null, ab, now); return R.act(null, null, ab, a, now); };
const hit = (ab, t, dt, l = 0) => send(ab, t + RHY.lat + dt, { l });   // press lane l as if the player's key came `dt` ms after the note's time

// judging windows: Perfect ±45 (20), Good ±100 (10), the latency allowance is 40 ms
for (const [dt, pts, kind] of [[0, 20, 2], [45, 20, 2], [-45, 20, 2], [46, 10, 1], [-46, 10, 1], [100, 10, 1], [-100, 10, 1]]) {
  const ab = setNotes(mkAb(), [[1000, 0]]);
  assert.equal(hit(ab, 1000, dt), null);
  assert.equal(ab.score, pts, `dt ${dt}: ${pts} points`);
  assert.deepEqual(ab.g.ev, [[1, 0, kind]], `dt ${dt}: judgement ${kind}`);
  assert.equal(ab.g.N[0].s, 1); assert.equal(ab.combo, 1);
}
{
  const ab = setNotes(mkAb(), [[1000, 0]]);
  assert.equal(send(ab, 1000, { l: 0 }), null); assert.equal(ab.score, 20, "the 40 ms latency allowance: a press that arrives at the note's own time was 40 ms early, still Perfect");
  const bb = setNotes(mkAb(), [[1000, 0]]);
  hit(bb, 1000, -101); assert.equal(bb.score, 0, "101 ms early: too early to count"); assert.equal(bb.g.N[0].s, 0, "the note still waits"); assert.equal(bb.g.stray.length, 1);
  hit(bb, 1000, 0); assert.equal(bb.score, 20, "and can still be hit");
  const cc = setNotes(mkAb(), [[1000, 0]]);
  hit(cc, 1000, 101); assert.equal(cc.g.N[0].s, 2, "101 ms late: already a Miss"); assert.equal(cc.score, 0);
}
// the fever "앙코르" widens every window ×1.5 (Perfect ±67, Good ±150)
for (const [dt, kind] of [[67, 2], [-67, 2], [68, 1], [150, 1], [-150, 1]]) {
  const ab = setNotes(mkAb(), [[1000, 0]]);
  ab.feverUntil = 1e9;
  assert.equal(hit(ab, 1000, dt), null);
  assert.equal(ab.g.ev[0][2], kind, `fever dt ${dt}: judgement ${kind}`);
  assert.ok(ab.score >= 20, "fever doubles the points");
}
{
  const ab = setNotes(mkAb(), [[1000, 0]]); ab.feverUntil = 1e9;
  hit(ab, 1000, 151); assert.equal(ab.g.N[0].s, 2, "151 ms late is a Miss even in a fever");
  const bb = setNotes(mkAb(), [[1000, 0]]); hit(bb, 1000, 68); assert.equal(bb.score, 10, "without the fever 68 ms is only Good");
}

// misses come in time order, the Good window plus the allowance is the deadline
{
  const ab = setNotes(mkAb(), [[1000, 0], [1000, 3], [1100, 1], [1200, 2]]);
  ab.score = 100; ab.combo = 6;
  R.adv(null, null, ab, 1140);
  assert.equal(ab.g.cnt[2], 0, "not yet: a press at 1140 could still be 100 ms late");
  const rev = ab.rev; R.adv(null, null, ab, 1140); assert.equal(ab.rev, rev, "nothing happened, nothing to resend");
  R.adv(null, null, ab, 1141);
  assert.deepEqual(ab.g.ev.map((e) => e[1]), [0, 3], "the chord's two notes are missed together");
  assert.equal(ab.score, 80); assert.equal(ab.combo, 0, "a miss breaks the combo");
  R.adv(null, null, ab, 5000);
  assert.deepEqual(ab.g.ev.map((e) => e[1]), [0, 3, 1, 2], "in time order"); assert.deepEqual(ab.g.ev.map((e) => e[0]), [1, 2, 3, 4]);
  assert.equal(ab.score, 60); assert.equal(ab.g.cnt[2], 4);
  R.adv(null, null, ab, 9999); assert.equal(ab.g.cnt[2], 4, "a note is missed once");
  const bb = setNotes(mkAb(), [[1000, 0]]); bb.score = 3; R.adv(null, null, bb, 5000); assert.equal(bb.score, 0, "never below 0");
  // a late note after a hit one: the hit one is not missed
  const cc = setNotes(mkAb(), [[1000, 0], [1300, 0]]);
  hit(cc, 1000, 0); R.adv(null, null, cc, 1600); assert.deepEqual(cc.g.cnt, [1, 0, 1]);
}

// each lane judges its own notes: the nearest waiting one in the lane, not a note of another lane
{
  const ab = setNotes(mkAb(), [[1000, 1], [1050, 0]]);
  hit(ab, 1050, 0, 0); assert.deepEqual(ab.g.ev.map((e) => e[1]), [0]); assert.equal(ab.g.N[0].s, 0, "the other lane's note is untouched");
  const bb = setNotes(mkAb(), [[1000, 0], [1300, 0]]);
  hit(bb, 1300, 0, 0); assert.equal(bb.g.N[0].s, 2, "the first note of the lane has expired: the press goes to the second");
  assert.equal(bb.g.N[1].s, 1);
  const cc = setNotes(mkAb(), [[1000, 0], [1240, 0]]);
  cc.feverUntil = 1e9; hit(cc, 1000, 120, 0);
  assert.equal(cc.g.N[0].s, 1, "overlapping fever windows: the earlier note is taken first");
}

// stray presses: ignored, no penalty; mashing is ignored for a while
{
  const ab = setNotes(mkAb(), [[2000, 0]]);
  ab.score = 100; ab.combo = 5;
  for (let i = 0; i < 4; i++) assert.equal(send(ab, 1000 + i * 100, { l: 3 }), null);
  assert.equal(ab.score, 100); assert.equal(ab.combo, 5, "a stray costs nothing"); assert.equal(ab.g.ev.length, 0);
  assert.equal(ab.g.lock, 0, "four strays are not mashing");
  send(ab, 1400, { l: 2 });
  assert.ok(ab.g.lock > 1400, "five strays within 2 s: mashing");
  const lockEnd = ab.g.lock;
  assert.equal(lockEnd, 1400 + RHY.lockMs);
  assert.equal(hit(ab, 2000, 0), null); assert.equal(ab.g.N[0].s, 0, "a press that would hit is ignored while the lock lasts");
  assert.equal(ab.score, 100);
  send(ab, lockEnd + 1, { l: 0 }); // after the lock a stray again counts from zero
  assert.equal(ab.g.lock, lockEnd);
  const bb = setNotes(mkAb(), [[10000, 0]]);
  for (let i = 0; i < 4; i++) send(bb, 1000 + i * 100, { l: 3 });
  send(bb, 3500, { l: 3 }); assert.equal(bb.g.lock, 0, "strays more than 2 s apart are not mashing");
  // mashing every lane at the fastest rate does not play the song
  const cc = setNotes(mkAb(), Array.from({ length: 40 }, (_, i) => [2000 + i * 214, i % 4]));
  for (let now = 1500, i = 0; now < 11000; now += 36, i++) send(cc, now, { l: i % 4 });
  const mashed = cc.score;
  const dd = setNotes(mkAb(), Array.from({ length: 40 }, (_, i) => [2000 + i * 214, i % 4]));
  for (let i = 0; i < 40; i++) hit(dd, 2000 + i * 214, 0, i % 4);
  assert.ok(mashed < dd.score * 0.25, `mashing all four lanes scores almost nothing (${mashed} vs ${dd.score})`);
}

// hold notes: head, key down, tail
{
  const mk = () => setNotes(mkAb(), [[1000, 0, 600]]);
  let ab = mk();
  hit(ab, 1000, 0);
  assert.equal(ab.g.N[0].s, 3); assert.equal(ab.g.hold[0], 0); assert.equal(ab.score, 20, "the head is judged like a tap");
  const v = R.view(ab, 1100);
  assert.deepEqual(v[0], [0, 0, -100, 600, 1], "a held note stays in the view, marked held");
  send(ab, 1000 + 600 + RHY.lat, { l: 0, up: 1 });
  assert.equal(ab.g.N[0].s, 1); assert.equal(ab.g.hold[0], -1); assert.equal(ab.score, 20 + 11, "the tail adds 10 × the combo"); assert.deepEqual(ab.g.ev.map((e) => e[2]), [2, 3]);
  ab = mk(); hit(ab, 1000, 0);
  send(ab, 1000 + 600 - 120 + RHY.lat, { l: 0, up: 1 }); assert.equal(ab.g.N[0].s, 1, "120 ms early is still fine");
  ab = mk(); hit(ab, 1000, 0);
  send(ab, 1000 + 600 - 121 + RHY.lat, { l: 0, up: 1 });
  assert.equal(ab.g.N[0].s, 2, "let go early: the hold breaks"); assert.equal(ab.score, 10, "a Miss: −10"); assert.equal(ab.combo, 0); assert.deepEqual(ab.g.ev.map((e) => e[2]), [2, 4]); assert.equal(ab.g.cnt[2], 1);
  ab = mk(); hit(ab, 1000, 0);
  R.adv(null, null, ab, 1000 + 600 + RHY.tailEnd + RHY.lat);
  assert.equal(ab.g.hold[0], 0, "not yet: a late release is still possible");
  R.adv(null, null, ab, 1000 + 600 + RHY.tailEnd + RHY.lat + 1);
  assert.equal(ab.g.N[0].s, 1, "still held past its end: done"); assert.equal(ab.g.hold[0], -1); assert.equal(ab.g.ev.at(-1)[2], 3);
  send(ab, 5000, { l: 0, up: 1 }); assert.equal(ab.g.cnt[2], 0, "a late release changes nothing");
  ab = mk(); R.adv(null, null, ab, 3000);
  assert.deepEqual(ab.g.cnt, [0, 0, 1], "a hold whose head is missed is one Miss"); assert.equal(ab.g.ev.length, 1);
  send(ab, 1700, { l: 0, up: 1 }); assert.equal(ab.g.ev.length, 1, "letting go with nothing held does nothing");
  // the key held through a following note of the same lane is not a press
  ab = setNotes(mkAb(), [[1000, 0, 600], [1900, 0]]); hit(ab, 1000, 0); send(ab, 1300, { l: 0 });
  assert.equal(ab.g.N[1].s, 0, "a press far from the next note does not hit it"); assert.equal(ab.score, 20);
}

// a chord: both lanes in one message; the masks
{
  const ab = setNotes(mkAb(), [[1000, 0], [1000, 3]]);
  assert.equal(send(ab, 1040, { m: 9 }), null);
  assert.deepEqual(ab.g.ev.map((e) => [e[1], e[2]]), [[0, 2], [3, 2]]); assert.equal(ab.score, 20 + 22, "two Perfects, the second with combo 1");
  const bb = setNotes(mkAb(), [[1000, 0, 500], [1000, 2, 500]]);
  send(bb, 1040, { m: 5 }); assert.deepEqual(bb.g.hold, [0, -1, 1, -1]);
  send(bb, 1540, { m: 5, up: 1 }); assert.deepEqual(bb.g.hold, [-1, -1, -1, -1]); assert.deepEqual(bb.g.cnt, [2, 0, 0]);
  assert.equal(send(setNotes(mkAb(), [[1000, 1]]), 1040, { m: 2 }), null);
}

// view: the waiting notes within the window (ms from now), the last judgements, bpm, counts; refreshed when the window runs dry
{
  const ab = setNotes(mkAb(), [[2800, 1], [3000, 2, 400], [5400, 3], [9000, 0]]);
  ab.g.last = 9400;
  const v = R.view(ab, 1000);
  assert.deepEqual(v[0], [0, 1, 1800, 0, 0, 1, 2, 2000, 400, 0], "ids, lanes, ms from now, hold, held — only up to 4 s ahead (the note at 5400 is not announced yet)");
  assert.equal(v[2], 100); assert.deepEqual(v[3], [0, 0, 0]); assert.deepEqual(v[1], []);
  assert.equal(ab.g.sent, 5000);
  const rev = ab.rev;
  R.adv(null, null, ab, 2000); assert.equal(ab.rev, rev, "the announced window (to 5000) is far enough ahead");
  R.adv(null, null, ab, 2500); assert.ok(ab.rev > rev, "within 2.5 s of the end of the announced window: resend");
  const v2 = R.view(ab, 2500);
  assert.deepEqual(JSON.parse(JSON.stringify(v2)), v2, "plain JSON"); assert.equal(ab.g.sent, 6500);
  assert.deepEqual(v2[0], [0, 1, 300, 0, 0, 1, 2, 500, 400, 0, 2, 3, 2900, 0, 0], "the next stretch comes in");
  const late = setNotes(mkAb(), [[1000, 0]]); late.g.last = 1000; late.g.sent = 5000;
  const r0 = late.rev; R.adv(null, null, late, 500); assert.equal(late.rev, r0, "once the last note is announced nothing more is resent");
  const h1 = setNotes(mkAb(), [[1500, 1]]); hit(h1, 1500, 0, 1);
  assert.deepEqual(R.view(h1, 1000)[0], [], "a hit note leaves the view"); assert.deepEqual(R.view(h1, 1000)[1], [1, 1, 2], "the judgement is in the view"); assert.deepEqual(R.view(h1, 1000)[3], [1, 0, 0]);
  const big = setNotes(mkAb(), Array.from({ length: 30 }, (_, i) => [1000 + i * 250, i % 4]));
  R.adv(null, null, big, 9000);
  assert.ok(big.g.ev.length === RHY.ring && big.g.ev.at(-1)[0] === 30, "only the most recent judgements are kept");
}

// ── the generated song: fair, shaped, seeded
{
  let notes = 0, chords = 0, triples = 0, holds = 0;
  const seeds = Array.from({ length: 60 }, (_, i) => i * 7919 + 11);
  for (const seed of seeds) {
    const g = X.rhyBuild({ seed }), N = g.N;
    assert.ok(N.length >= 400 && N.length <= 700, `a song of a sensible length (${N.length})`);
    assert.ok(N[0].t >= RHY.lead && N.at(-1).t + N.at(-1).h <= T.runMs - RHY.tail + 1, "the song fits the shift with a lead-in and a tail");
    let prevT = -1;
    const byT = new Map(), lastEnd = [-1e9, -1e9, -1e9, -1e9], prevT4 = [];
    for (const n of N) {
      assert.ok(n.t >= prevT && Number.isInteger(n.t) && n.l >= 0 && n.l <= 3 && Number.isInteger(n.l) && n.h >= 0 && n.s === 0, "notes in time order with sane fields");
      prevT = n.t;
      (byT.get(n.t) || byT.set(n.t, []).get(n.t)).push(n);
      assert.ok(n.t - lastEnd[n.l] >= RHY.sameLane, `the same lane is never closer than ${RHY.sameLane} ms (holds: after their end) — seed ${seed} t ${n.t}`);
      lastEnd[n.l] = n.t + n.h;
      if (n.h) { assert.ok(n.t >= RHY.holdFrom, "holds come late"); assert.ok(n.h >= 400 && n.h <= 2 * 60000 / 100 + 1, `a hold of ${n.h} ms is short enough`); holds++; }
    }
    // the first minute is simple: quarter notes, no chords, no holds
    for (const n of N) if (n.t < RHY.quarterTo) assert.ok(byT.get(n.t).length === 1 && !n.h, "taps only at first");
    // onsets: not too fast (an eighth at the end tempo is ~214 ms), at most 2 at once before the last minute, 3 after; holds count as pressed keys
    const times = [...byT.keys()].sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 200, `onsets are at least 200 ms apart (${times[i] - times[i - 1]})`);
    for (const t of times) {
      const here = byT.get(t), cap = t >= RHY.tripleFrom ? 3 : 2;
      const held = N.filter((n) => n.h && n.t < t && n.t + n.h > t).length;
      assert.ok(here.length + held <= cap, `at most ${cap} keys at once (t ${t}: ${here.length} new + ${held} held)`);
      if (here.length >= 2) { chords += here.length === 2 ? 1 : 0; triples += here.length === 3 ? 1 : 0; assert.ok(t >= RHY.chordFrom, "chords come late"); }
      if (here.length === 3) assert.ok(t >= RHY.tripleFrom, "triples only in the last minute");
      assert.equal(new Set(here.map((n) => n.l)).size, here.length, "a chord uses distinct lanes");
    }
    // at most one second-long window with more than 6 notes
    for (let i = 0; i < N.length; i++) { let j = i; while (j < N.length && N[j].t < N[i].t + 1000) j++; assert.ok(j - i <= 7, `no stream above 7 notes a second (${j - i})`); }
    // tempo ramps 100 → 140 BPM
    assert.equal(Math.round(X.rhyBpm(0)), 100); assert.equal(Math.round(X.rhyBpm(T.runMs)), 140); assert.ok(X.rhyBpm(120000) > 118 && X.rhyBpm(120000) < 122);
    // the density grows with the shift: the last minute holds more notes than the first
    const inRange = (a, b) => N.filter((n) => n.t >= a && n.t < b).length;
    assert.ok(inRange(180000, 240000) > inRange(0, 60000), "the song gets busier");
    notes += N.length;
  }
  console.log(`rhythm: ${seeds.length} songs, ${Math.round(notes / seeds.length)} notes each, ${(chords / seeds.length).toFixed(0)} chords, ${(triples / seeds.length).toFixed(1)} triples, ${(holds / seeds.length).toFixed(0)} holds per song`);
}

// ── whole shifts through the real engine
const sim = (name, seed = 1) => {
  const S = L.setup();
  let now = 5_000_000 + seed * 7919;
  S.now = now;
  L.addPlayer(S, "p1", L.hero(name, { wk: "sword", lvl: 30, migrate: true }));
  const p = S.players.p1;
  const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
  assert.ok(act({ t: "ab_start", k: "rhythm" }).ok);
  return {
    S, p, act, get now() { return now; }, set now(v) { now = v; },
    tick(ms = 100) { now += ms; S.now = now; L.tick(S, now); const v = L.viewFor(S, "p1"); L.endTick(S); return v; },
  };
};
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/**
 * The player's inputs for a song: each note pressed at its time + the latency allowance + a timing error (uniform ±jit); `miss` = chance a note is not played
 * (a hold's tail then lets go early); then the client's outbox: at least 40 ms between messages, presses due together share one (a chord).
 */
function botEvents(rng, g, runAt, { jit = 0, miss = 0, lat = RHY.lat }) {
  const raw = [];
  for (const n of g.N) {
    if (rng() < miss) continue;
    raw.push({ at: runAt + n.t + lat + (rng() * 2 - 1) * jit, up: 0, l: n.l });
    if (n.h) raw.push({ at: runAt + n.t + n.h + lat + (rng() < miss ? -300 : 0) + (rng() * 2 - 1) * jit, up: 1, l: n.l });
  }
  raw.sort((a, b) => a.at - b.at);
  const out = [];
  let last = -1e9;
  for (let i = 0; i < raw.length;) {
    const at = Math.max(raw[i].at, last + 40), up = raw[i].up;
    let m = 0, j = i;
    while (j < raw.length && raw[j].up === up && raw[j].at <= at) { m |= 1 << raw[j].l; j++; }
    out.push({ at: Math.round(at), up, m });
    last = at; i = j;
  }
  return out;
}
function play(botOpts, seed, { name = `공연${seed}` } = {}) {
  const rng = mulberry(seed * 977 + 13), s = sim(name, seed), ab = s.p.ab;
  const evs = botOpts.idle ? [] : botEvents(rng, ab.g, ab.runAt, botOpts);
  let nextTick = s.now + 100, i = 0, maxBytes = 0, views = 0;
  const seen = new Map(), judged = [];
  while (s.now < ab.endAt + 100) {
    if (i < evs.length && evs[i].at <= nextTick) {
      s.now = evs[i].at;
      const e = evs[i++], v = s.act({ t: "ab_act", m: e.m, ...(e.up ? { up: 1 } : {}) });
      if (!v.ok) throw new Error("refused " + JSON.stringify(v));
    } else {
      s.now = nextTick;
      const v = s.tick(0);
      nextTick += 100;
      if (v.ab && v.ab[7]) {
        views++; maxBytes = Math.max(maxBytes, JSON.stringify(v.ab[7]).length);
        const f = v.ab[7][0];
        for (let k = 0; k < f.length; k += 5) seen.set(f[k], Math.max(seen.get(f[k]) ?? -1e9, f[k + 2]));
        for (const e of v.ab[7][1].length ? [v.ab[7][1]] : []) for (let k = 0; k < e.length; k += 3) judged[e[k]] = e[k + 2];
      }
    }
  }
  const g = ab.g;
  return { score: ab.score, grade: X.albaGrade("rhythm", ab.score), maxBytes, views, maxCombo: ab.maxCombo, state: ab.state, cnt: g.cnt.slice(), n: g.N.length, seen, judged: judged.length, notes: g.N, notesLen: g.N.length, fevers: ab.feverUsed };
}

// (c) the bots
const BOTS = {
  perfect: { jit: 0, miss: 0 },
  strong: { jit: 35, miss: 0.02 },
  good: { jit: 50, miss: 0.04 },
  human: { jit: 70, miss: 0.08 },
  casual: { jit: 100, miss: 0.12 },
  slow: { jit: 150, miss: 0.25 },
};
const results = {};
let viewMax = 0, viewsPerMin = 0;
for (const [nm, o] of Object.entries(BOTS)) {
  results[nm] = [1, 2, 3, 4, 5].map((seed) => play(o, seed));
  for (const r of results[nm]) { assert.equal(r.state, "end"); viewMax = Math.max(viewMax, r.maxBytes); viewsPerMin = Math.max(viewsPerMin, r.views / 4); }
}
const idle = play({ idle: true }, 9);
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(`rhythm: par ${PAR}  (C ${Math.round(PAR * T.cuts[0])} B ${Math.round(PAR * T.cuts[1])} A ${Math.round(PAR * T.cuts[2])} S ${PAR})`);
for (const [nm, rs] of Object.entries(results)) {
  console.log(`  ${nm.padEnd(8)} scores ${rs.map((r) => r.score).join(" ")}  grades ${rs.map((r) => "-CBAS"[r.grade]).join("")}  P/G/M ${rs.map((r) => r.cnt.join("/")).join(" ")}  combo ${rs.map((r) => r.maxCombo).join(",")}  avg ${avg(rs.map((r) => r.score))} = ${(avg(rs.map((r) => r.score)) / PAR).toFixed(2)} par`);
}
console.log(`  idle     score ${idle.score} grade ${"-CBAS"[idle.grade]}   view max ${viewMax} bytes, up to ${viewsPerMin.toFixed(0)} views a minute`);
assert.ok(results.perfect.every((r) => r.grade === 4), "the perfect bot reaches S every time");
assert.ok(results.perfect.every((r) => r.cnt[1] === 0 && r.cnt[2] === 0), "and never misses");
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
assert.equal(idle.grade, 0, "an idle player gets no grade"); assert.equal(idle.score, 0, "and no points");
assert.ok(viewMax < 600, `the view stays small (${viewMax} bytes)`);
for (const r of results.perfect) {   // the player sees every note coming (≥ 1.5 s ahead) in the views
  for (const n of r.notes) assert.ok(r.seen.has(n.id) && r.seen.get(n.id) >= 1500, `note ${n.id} was announced ≥ 1.5 s ahead (${r.seen.get(n.id)})`);
  assert.ok(r.judged > 100, "the judgements reach the client");
}

// (a) determinism: the same seed gives the same song, the same inputs the same shift
{
  const a = X.rhyBuild({ seed: 5 }), b = X.rhyBuild({ seed: 5 }), c = X.rhyBuild({ seed: 6 });
  assert.deepEqual(a, b, "same seed, same song"); assert.notDeepEqual(a.N, c.N, "another seed, another song");
  const p1 = play(BOTS.human, 3), p2 = play(BOTS.human, 3);
  assert.deepEqual({ ...p1, seen: 0 }, { ...p2, seen: 0 }, "same seed and same inputs: the same shift");
  assert.deepEqual([...p1.seen], [...p2.seen]);
  const p3 = play(BOTS.human, 3, { name: "공연다른" });
  assert.notDeepEqual(p3.notes.map((n) => n.t + n.l), p1.notes.map((n) => n.t + n.l), "a different seed plays a different song");
  // the song does not depend on how the player plays
  const song = (bot) => JSON.stringify(play(bot, 4).notes.map((n) => [n.t, n.l, n.h]));
  assert.equal(song(BOTS.perfect), song(BOTS.slow), "the pattern is the seed's, whoever plays");
}

// (d) hostile input: nothing throws, nothing counts, the state stays sane
{
  const s = sim("공연해커", 2), ab = s.p.ab, g0 = ab.g;
  const snap = () => JSON.stringify(ab.g);
  const bad = [{}, { l: "1" }, { l: 1.5 }, { l: -1 }, { l: 4 }, { l: 1e300 }, { l: NaN }, { l: Infinity }, { l: null }, { l: [1] }, { l: { a: 1 } }, { l: true }, { l: "__proto__" }, { l: 0, up: 2 }, { l: 0, up: "1" }, { l: 0, up: true }, { l: 0, up: null },
    { m: 0 }, { m: 16 }, { m: -1 }, { m: 1.5 }, { m: "3" }, { m: NaN }, { m: null }, { m: [3] }, { m: 255 }, { m: 3, l: 1 }, { m: 3, up: 0 }, { up: 1 }, { x: 5, y: 5 }, { d: 1 }, { hit: 3 }, { k: "pipe" }, { N: [] }, { g: {} }, { l: 1, m: 2 }];
  const valid = [{ l: 0 }, { l: 3 }, { m: 15 }, { m: 5, up: 1 }, { l: 2, up: 1 }];
  s.act({ t: "ab_act", l: 1 });
  const before = snap();
  for (let i = 0; i < 2; i++) for (const j of [...bad, ...valid]) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; }
  assert.equal(snap(), before, "the brief ignores every input, valid or not");
  s.tick(T.briefMs + 200);
  assert.equal(ab.g, g0);
  for (let i = 0; i < 2; i++) for (const j of bad) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; assert.doesNotThrow(() => s.tick(0)); }
  const g = ab.g;
  assert.ok(g.N.every((n) => n.s === 0 || n.s === 2) && g.cnt[0] === 0 && g.cnt[1] === 0, "garbage hit no note");
  assert.equal(ab.score, 0, "hostile input scores nothing");
  assert.ok(g.stray.length === 0 && g.lock === 0, "and counts as no stray");
  assert.ok(g.hold.every((h) => h === -1) && g.ev.every((e) => e.length === 3 && Number.isInteger(e[0]) && e[2] === 0), "only misses were recorded");
  // spam inside the rate limit: only those 35 ms apart count
  let acc = 0, last = ab.lastAct;
  for (let i = 0; i < 50; i++) { s.now += 5; assert.doesNotThrow(() => s.act({ t: "ab_act", l: i % 4 })); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.ok(acc <= 8, `50 inputs in 250 ms: only ${acc} 35 ms apart were taken`);
  s.now += 100; acc = 0; last = ab.lastAct;
  for (let i = 0; i < 50; i++) { s.act({ t: "ab_act", l: 1 }); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.equal(acc, 1, "50 inputs in the same instant: one counts");
  // a press that hits nothing never scores: the score only comes from notes
  assert.ok(ab.score <= 20, "a lone press can score at most one Perfect");
  // after the end the song is frozen
  s.tick(T.runMs + 1000);
  assert.equal(ab.state, "end");
  const done = snap(), sc = ab.score;
  for (const j of [{ l: 0 }, { m: 15 }, { l: 1, up: 1 }]) { s.now += 50; s.act({ t: "ab_act", ...j }); }
  assert.equal(snap(), done, "after the end nothing moves"); assert.equal(ab.score, sc);
  // a huge stall: the whole song is missed at once and the state is sane
  const s2 = sim("공연정지", 3), ab2 = s2.p.ab;
  s2.tick(T.briefMs + T.runMs + 5000);
  assert.equal(ab2.state, "end"); assert.equal(ab2.score, 0); assert.ok(ab2.g.N.every((n) => n.s === 2), "every note of an unplayed song is a Miss");
}

// (e) the server's cost: 240 simulated seconds, 10 ticks/s, an input every 150 ms
{
  const s = sim("공연부하", 7), ab = s.p.ab;
  let ms = 0, views = 0, bytes = 0, vb = 0;
  for (let i = 0; i < (T.briefMs + T.runMs) / 100; i++) {
    if (i % 3 === 0) s.act({ t: "ab_act", l: (i / 3 * 7) % 4 | 0 });
    const t0 = performance.now();
    const v = s.tick(100);
    ms += performance.now() - t0; views++;
    if (v.ab && v.ab[7]) { bytes += JSON.stringify(v.ab[7]).length; vb++; }
  }
  console.log(`  server: ${views} ticks + views in ${ms.toFixed(1)} ms (${(ms / 4.1).toFixed(2)} ms per simulated minute), view ${vb} sent, avg ${(bytes / vb).toFixed(0)} bytes, max ${viewMax}`);
  assert.ok(ms / 4.1 < 100, "far below 100 ms per simulated minute");
  assert.equal(ab.state, "end");
}

console.log("alba-rhythm: ok");
