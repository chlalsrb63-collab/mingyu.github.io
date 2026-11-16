// 일일 아르바이트 · 세탁소 (67-alba-laundry.js): the rules (washes, chains, stains, detergent, rotation, ceiling, lazy gravity), determinism, hostile input,
// the view's size, the server's cost, and bots that play whole shifts through the real tick / viewFor / action path.
// node tests/alba-laundry.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, LAUNDRY_W, LAUNDRY_H, LAUNDRY_DX, LAUNDRY_DY, laundryResolve, laundryFits, laundryCells, laundryDrop, albaGrade };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, R = X.ALBA_RULES.laundry, W = X.LAUNDRY_W, H = X.LAUNDRY_H, DX = X.LAUNDRY_DX, DY = X.LAUNDRY_DY, T = X.ALBA_T;
const PAR = X.ALBA.laundry.par;

// ── unit harness: a bare shift object, no world
const mkAb = (seed = 7, endAt = 1e9) => {
  const ab = { k: "laundry", box: { seed }, runAt: 0, endAt, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null };
  R.init(null, null, ab);
  return ab;
};
/** rows: strings of 6 — `.` empty, 1-6 colour, `s` stain — listed top to bottom and aligned to the bottom of the washer. */
const grid = (rows) => [...Array(H - rows.length).fill("......"), ...rows].flatMap((r) => [...r].map((c) => (c === "." ? 0 : c === "s" ? 7 : +c)));
const show = (b) => Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => { const v = b[y * W + x]; return v ? (v === 7 ? "s" : String(v)) : "."; }).join(""));
const EMPTY = Array(H).fill("......");
const cur = (ab, a, b, x, y, o) => { ab.g.cur = { a, b, x, y, o }; ab.g.fallAt = 1e8; };
const drop2 = (ab, now = 10) => R.act(null, null, ab, { drop: 2 }, now);

// ── the washing rules on bare boards
{
  let b = grid(["1111.."]), st = X.laundryResolve(b, null);
  assert.equal(st.length, 1); assert.equal(st[0].n, 4); assert.equal(st[0].groups, 1); assert.deepEqual(show(b), EMPTY, "four in a row are washed");
  b = grid(["111...", "..1..."]);
  assert.equal(X.laundryResolve(b, null)[0].n, 4, "four connected in any shape (things settle first)");
  b = grid(["11....", "1.2..."]);
  assert.equal(X.laundryResolve(b, null).length, 0, "three are not enough");
  b = grid(["1.1...", "212..."]);
  assert.equal(X.laundryResolve(b, null).length, 0, "diagonals do not connect");
  b = grid(["111.1.", "2222.."]);
  st = X.laundryResolve(b, null);
  assert.equal(st.length, 1); assert.deepEqual(show(b).slice(10), ["......", "111.1."], "only the 2222 goes; the rest settles");
  b = grid(["11111.", "111122"]);
  st = X.laundryResolve(b, null);
  assert.equal(st.length, 1); assert.equal(st[0].groups, 1, "one big group"); assert.equal(st[0].n, 9); assert.deepEqual(show(b).slice(11), ["....22"]);
  b = grid(["...1..", "222222"]);
  st = X.laundryResolve(b, null);
  assert.equal(st[0].n, 6); assert.deepEqual(show(b).slice(11), ["...1.."], "six in a row wash, the lone one settles");
  b = grid(["..22..", "111122"]);   // wash the 1s, the 2s above fall into a line of four
  st = X.laundryResolve(b, null);
  assert.equal(st.length, 2, "a 2-chain"); assert.deepEqual(st.map((s) => s.n), [4, 4]); assert.deepEqual(show(b), EMPTY);
  assert.ok(st[0].cells.length === 4 && st[0].cells.every((c) => (c & 7) === 1) && st[1].cells.every((c) => (c & 7) === 2), "the wash log: cell*8 + colour");
  // stains
  b = grid(["ssss..", "1111.."]);
  st = X.laundryResolve(b, null);
  assert.equal(st.length, 1); assert.equal(st[0].stains, 4, "stains touching a wash go with it"); assert.deepEqual(show(b), EMPTY);
  b = grid(["s.....", "s1111s"]);
  st = X.laundryResolve(b, null);
  assert.equal(st[0].stains, 2); assert.deepEqual(show(b).slice(11), ["s....."], "the stain that was not touching stays (and settles)");
  b = grid(["ssssss", "ssssss"]);
  assert.equal(X.laundryResolve(b, null).length, 0, "stains never wash by themselves");
}

// ── locks: scoring, chains, detergent, a split pair
{
  const ab = mkAb();   // a vertical pair into a wash of five
  ab.g.b = grid(["111..."]);
  cur(ab, 1, 1, 3, 1, 0);
  assert.equal(drop2(ab), null);
  assert.equal(ab.score, 60, "50 for a wash + 10 for the fifth piece"); assert.equal(ab.combo, 1); assert.equal(ab.g.washes, 1); assert.equal(ab.g.wc, 5);
  assert.deepEqual(show(ab.g.b), EMPTY); assert.equal(ab.g.ev[1], 1); assert.equal(ab.g.ev[2].length, 5);
  assert.equal(ab.g.cur, null, "the next pair waits for the line"); assert.equal(ab.g.spawnAt, 10 + 450);
}
{
  const ab = mkAb();   // a chain of two: ×1 then ×2, and the combo runs through both
  ab.g.b = grid(["...2..", "11.122"]);
  cur(ab, 1, 2, 2, 1, 0);
  drop2(ab);
  assert.equal(ab.g.washes, 2); assert.equal(ab.g.ev[1], 2);
  assert.equal(ab.score, 50 + Math.round(100 * 1.1), "step 1: 50, step 2: 100 with the combo at 1");
  assert.equal(ab.combo, 2); assert.deepEqual(show(ab.g.b), EMPTY);
}
{
  const ab = mkAb();   // a horizontal pair over a step: the half without support falls
  ab.g.b = grid(["...3.."]);
  cur(ab, 4, 5, 2, 1, 1);
  drop2(ab);
  assert.deepEqual(show(ab.g.b).slice(10), ["...5..", "..43.."], "the 5 rests on the 3, the 4 beside it falls to the floor");
}
{
  const ab = mkAb();   // detergent: washes every piece of the colour under it
  ab.g.b = grid(["232323"]);
  cur(ab, 8, 0, 1, 1, 0);
  drop2(ab);
  assert.deepEqual(show(ab.g.b).slice(11), ["2.2.2."], "every 3 on the board is gone"); assert.equal(ab.score, 50);
  const bb = mkAb();
  bb.g.b = grid(["s....."]); cur(bb, 8, 0, 0, 1, 0); drop2(bb);
  assert.deepEqual(show(bb.g.b), EMPTY, "on a stain: it is washed off"); assert.equal(bb.score, 25);
  const cc = mkAb(); cur(cc, 8, 0, 5, 1, 0); drop2(cc);
  assert.equal(cc.score, 0, "on the bare floor: nothing happens"); assert.deepEqual(show(cc.g.b), EMPTY);
  const dd = mkAb();   // the detergent's wash opens a chain: the 1 above the washed 3 falls into a line of four
  dd.g.b = grid([".1....", "13113."]);
  cur(dd, 8, 0, 4, 1, 0); drop2(dd);
  assert.equal(dd.g.washes, 2); assert.equal(dd.score, 50 + Math.round(100 * 1.1), "the detergent is step 1, the chain step 2 (×2)"); assert.deepEqual(show(dd.g.b), EMPTY);
}

// ── moving and turning
{
  const ab = mkAb();
  cur(ab, 1, 2, 0, 5, 0);
  assert.equal(R.act(null, null, ab, { mv: -1 }, 5), "wall"); assert.equal(ab.g.cur.x, 0, "the wall stops it");
  assert.equal(R.act(null, null, ab, { mv: 1 }, 6), null); assert.equal(ab.g.cur.x, 1);
  cur(ab, 1, 2, 4, 5, 1);
  assert.equal(R.act(null, null, ab, { mv: 1 }, 7), "wall", "the satellite counts too"); assert.equal(R.act(null, null, ab, { mv: -1 }, 8), null);
  ab.g.b = grid(["..1...", "......"]); cur(ab, 1, 2, 3, 10, 0);
  assert.equal(R.act(null, null, ab, { mv: -1 }, 9), "wall", "a pile in the way"); assert.equal(ab.g.cur.x, 3);
  // turning: clockwise = the satellite goes up → right → down → left
  cur(ab, 1, 2, 2, 5, 0);
  for (const o of [1, 2, 3, 0]) { assert.equal(R.act(null, null, ab, { rot: 1 }, 10), null); assert.equal(ab.g.cur.o, o); }
  R.act(null, null, ab, { rot: -1 }, 11); assert.equal(ab.g.cur.o, 3, "−1 turns the other way");
  cur(ab, 1, 2, 5, 5, 0); R.act(null, null, ab, { rot: 1 }, 12);
  assert.deepEqual([ab.g.cur.x, ab.g.cur.y, ab.g.cur.o], [4, 5, 1], "turned against the right wall: the pivot is pushed in");
  cur(ab, 1, 2, 0, 5, 0); R.act(null, null, ab, { rot: -1 }, 13);
  assert.deepEqual([ab.g.cur.x, ab.g.cur.y, ab.g.cur.o], [1, 5, 3], "and against the left wall");
  cur(ab, 1, 2, 3, 11, 1); R.act(null, null, ab, { rot: 1 }, 14);
  assert.deepEqual([ab.g.cur.x, ab.g.cur.y, ab.g.cur.o], [3, 10, 2], "turned onto the floor: the pivot rises");
  ab.g.b = grid(["1.1...", ...Array(6).fill("......")]); cur(ab, 1, 2, 1, 5, 0);
  assert.equal(R.act(null, null, ab, { rot: 1 }, 15), "blocked"); assert.equal(ab.g.cur.o, 0, "boxed in: refused");
  ab.g.b = grid([]); cur(ab, 8, 0, 2, 5, 0);
  assert.equal(R.act(null, null, ab, { rot: 1 }, 16), "round", "a detergent block has nothing to turn");
  // drops
  cur(ab, 1, 2, 2, 5, 0);
  assert.equal(R.act(null, null, ab, { drop: 1 }, 100), null); assert.equal(ab.g.cur.y, 6, "a soft drop is one row");
  assert.equal(ab.g.fallAt, 100 + X.laundryDrop(ab.g, ab, 100), "and restarts the drop timer");
  cur(ab, 1, 2, 2, 11, 0);
  assert.equal(R.act(null, null, ab, { drop: 1 }, 200), "floor");
}

// ── the ceiling: the washer is emptied
{
  const ab = mkAb();
  ab.score = 300; ab.combo = 3;
  ab.g.b[1 * W + 2] = 1; ab.g.cur = null; ab.g.spawnAt = 100;
  R.adv(null, null, ab, 100);
  assert.equal(ab.score, 200, "−100"); assert.equal(ab.combo, 0); assert.ok(ab.g.b.every((v) => v === 0), "an empty washer"); assert.ok(ab.g.cur && ab.g.cur.y === 1);
  assert.equal(ab.g.ev[3], 1, "the event says emptied");
  ab.g.b[2] = 1; ab.g.cur = null; ab.g.spawnAt = 200; ab.score = 40; R.adv(null, null, ab, 200);   // only the satellite's place taken
  assert.equal(ab.score, 0, "never below 0"); assert.ok(ab.g.b.every((v) => v === 0));
}

// ── lazy gravity: whole drops up to now, in order
{
  const ab = mkAb(), D = X.laundryDrop(ab.g, ab, 0);
  R.adv(null, null, ab, 0);
  assert.ok(ab.g.cur && ab.g.cur.y === 1 && ab.g.fallAt === D, "the first pair arrives when the shift starts");
  R.adv(null, null, ab, D * 3 + 5); assert.equal(ab.g.cur.y, 4, "three drops have passed");
  const rev = ab.rev; R.adv(null, null, ab, D * 3 + 6); assert.equal(ab.rev, rev, "nothing happened, the view is unchanged");
  const ab2 = mkAb(); for (let t = 0; t < D * 3 + 5; t += 100) R.adv(null, null, ab2, t); R.adv(null, null, ab2, D * 3 + 5);
  assert.equal(ab2.g.cur.y, 4, "the same by small steps");
  const ab3 = mkAb(); R.adv(null, null, ab3, 1e9);
  assert.ok(ab3.g.b.every((v) => Number.isInteger(v) && v >= 0 && v <= 7), "a huge stall ends at once and leaves a sane washer");
  const g = ab.g;
  assert.equal(X.laundryDrop(g, { endAt: 1e9, feverUntil: 0 }, 0), 650);
  g.washes = 10; assert.equal(X.laundryDrop(g, { endAt: 1e9, feverUntil: 0 }, 0), 560, "faster with every chain step");
  assert.equal(X.laundryDrop(g, { endAt: 100000, feverUntil: 0 }, 80000), Math.round(560 * 0.7), "the last 30 s rush");
  assert.equal(X.laundryDrop(g, { endAt: 1e9, feverUntil: 500 }, 0), 840, "a fever slows the fall (the dryer)");
  g.washes = 1e5; assert.equal(X.laundryDrop(g, { endAt: 1e9, feverUntil: 0 }, 0), 200, "never faster than 200 ms");
}

// ── stains come at intervals and never in the top two rows; the 6th colour joins late; detergent blocks come
{
  const ab = mkAb(11);
  let seen6 = -1, firstStain = -1, dets = 0;
  for (let i = 0, t = 0; i < 420; i++) {
    t += 1000;
    R.adv(null, null, ab, t);
    const g = ab.g;
    if (!g.cur) continue;
    for (const v of [g.cur.a, g.cur.b]) if (v === 6 && seen6 < 0) seen6 = g.n;
    if (g.cur.a === 8) dets++;
    g.cur.x = (i * 5) % W;
    drop2(ab, t);
    if (firstStain < 0 && g.b.includes(7)) firstStain = g.locks;
    assert.ok(g.b.slice(0, 2 * W).every((v) => v !== 7), "stains never fill the top two rows");
    if (g.b.slice(0, 4 * W).some((v) => v)) g.b.fill(0);
  }
  assert.equal(firstStain, 7, "the first stains drop after the 7th lock");
  assert.ok(seen6 >= 62, `no 6th colour before the 60th pair (first seen at pair ${seen6})`);
  assert.ok(dets >= 20 && dets <= 45, `a detergent block every 11-15 pairs (${dets} in 420)`);
}

// ── view: shape
{
  const ab = mkAb();
  R.adv(null, null, ab, 5);
  const v = R.view(ab, 5);
  assert.equal(v[0].length, W * H); assert.ok(/^[.1-6s]+$/.test(v[0]));
  assert.equal(v[1].length, 6, "pivot and satellite as x,y,colour"); assert.equal(v[2].length, 2); assert.ok(v[3] > 0 && v[4] === 650 && v[5] === 0);
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v, "plain JSON");
}

// ── whole shifts through the real engine
const sim = (name, seed = 1) => {
  const S = L.setup();
  let now = 5_000_000 + seed * 7919;
  S.now = now;
  L.addPlayer(S, "p1", L.hero(name, { wk: "sword", lvl: 30, migrate: true }));
  const p = S.players.p1;
  const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
  assert.ok(act({ t: "ab_start", k: "laundry" }).ok);
  return {
    S, p, act, get now() { return now; }, set now(v) { now = v; },
    tick(ms = 100) { now += ms; S.now = now; L.tick(S, now); const v = L.viewFor(S, "p1"); L.endTick(S); return v; },
  };
};
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// the bots' brain: try every landing, wash it out with the server's own resolver, and score the washer that is left (points, neighbours, trios, height)
function finish(b2, first, bonus = 0) {
  const steps = X.laundryResolve(b2, first);
  const pts = steps.reduce((s, st, i) => s + (50 * st.groups + 10 * Math.max(0, st.n - 4 * st.groups) + 25 * st.stains) * 2 ** Math.min(i, 6), 0);
  const hs = Array.from({ length: W }, (_, x) => { let y = 0; while (y < H && !b2[y * W + x]) y++; return H - y; });
  let adj = 0, tri = 0, stains = 0;
  const seen = new Set();
  for (let i = 0; i < b2.length; i++) {
    const v = b2[i];
    if (v === 7) stains++;
    if (v < 1 || v > 6) continue;
    if (i % W < W - 1 && b2[i + 1] === v) adj++;
    if (i + W < b2.length && b2[i + W] === v) adj++;
    if (seen.has(i)) continue;
    const st = [i], comp = []; seen.add(i);
    while (st.length) { const j = st.pop(); comp.push(j); for (const k of [j % W ? j - 1 : -1, j % W < W - 1 ? j + 1 : -1, j - W, j + W]) if (k >= 0 && k < b2.length && !seen.has(k) && b2[k] === v) { seen.add(k); st.push(k); } }
    if (comp.length === 3) tri++;
  }
  const maxH = Math.max(...hs);
  return { score: pts + bonus + 3 * adj + 8 * tri - 2 * stains - 0.4 * hs.reduce((a, v) => a + v, 0) - (maxH > 7 ? (maxH - 7) * 25 : 0) - 60 * Math.max(0, hs[2] - 8) };
}
function evalPair(b, a, c, o, x) {
  const sx = x + DX[o];
  if (sx < 0 || sx >= W) return null;
  const cells = (y) => [[x, y, a], [sx, y + DY[o], c]], fits = (y) => X.laundryFits({ b }, cells(y));
  if (!fits(1)) return null;
  let y = 1;
  while (fits(y + 1)) y++;
  const b2 = b.slice();
  for (const [cx, cy, v] of cells(y)) b2[cy * W + cx] = v;
  return finish(b2, null);
}
function evalDet(b, x) {
  if (b[W + x]) return null;
  let y = 1;
  while (y + 1 < H && !b[(y + 1) * W + x]) y++;
  const v = y < H - 1 ? b[(y + 1) * W + x] : 0, b2 = b.slice();
  if (v >= 1 && v <= 6) { const cells = b2.map((q, i) => (q === v ? i : -1)).filter((i) => i >= 0); return finish(b2, { cells, groups: 1 }, 4 * cells.length); }
  if (v === 7) return finish(b2, { cells: [(y + 1) * W + x], groups: 0 }, 10);
  return { score: -40 };
}
/** One bot: `gap` ms between inputs, `bad` = chance a piece gets a random landing instead of the best one; `oracle` reads the server state instead of the wire. */
function mkBot(rng, { gap = [300, 700], bad = 0.1, oracle = false }) {
  let wire = null, plan = null;
  return {
    delay: () => gap[0] + rng() * (gap[1] - gap[0]),
    seen(v) { if (v && v.ab && v.ab[7]) wire = v.ab[7]; },
    step(p, send) {
      let c, bd;
      if (oracle) { const g = p.ab.g; if (!g.cur) return false; c = { ...g.cur }; bd = g.b; }
      else {
        if (!wire || !wire[1].length) return false;
        const w = wire[1]; c = { x: w[0], y: w[1], a: w[2], b: w.length > 3 ? w[5] : 0, o: 0 };
        if (w.length > 3) c.o = DX.findIndex((dx, i) => dx === w[3] - w[0] && DY[i] === w[4] - w[1]);
        bd = [...wire[0]].map((ch) => (ch === "." ? 0 : ch === "s" ? 7 : +ch));
      }
      if (!plan || plan.a !== c.a || plan.b !== c.b || c.y < plan.y) {
        const opts = [];
        if (!c.b) for (let x = 0; x < W; x++) { const e = evalDet(bd, x); if (e) opts.push({ o: 0, x, ...e }); }
        else for (let o = 0; o < 4; o++) for (let x = 0; x < W; x++) { const e = evalPair(bd, c.a, c.b, o, x); if (e) opts.push({ o, x, ...e }); }
        if (!opts.length) return false;
        opts.sort((p1, p2) => p2.score - p1.score);
        plan = { ...(rng() < bad ? opts[Math.floor(rng() * opts.length)] : opts[0]), a: c.a, b: c.b };
      }
      plan.y = c.y;
      const d = (plan.o - c.o + 4) % 4;
      if (c.b && d) return send({ rot: d === 3 ? -1 : 1 });
      if (c.x !== plan.x) return send({ mv: plan.x > c.x ? 1 : -1 });
      plan = null;
      return send({ drop: 2 });
    },
  };
}
function play(botOpts, seed, { name = `세탁${seed}`, hook } = {}) {
  const rng = mulberry(seed * 977 + 13), s = sim(name, seed), bot = mkBot(rng, botOpts), ab = s.p.ab;
  let nextTick = s.now + 100, nextBot = ab.runAt + 200, maxBytes = 0, seq = 0, flushes = 0, bestChain = 0;
  const send = (a) => { const v = s.act({ t: "ab_act", ...a }); if (!v.ok) throw new Error("refused " + JSON.stringify(v)); return true; };
  while (s.now < ab.endAt + 100) {
    if (!botOpts.idle && nextBot <= nextTick) {
      s.now = nextBot;
      const did = bot.step(s.p, send);
      nextBot = s.now + (did ? bot.delay() : 40);
    } else {
      s.now = nextTick;
      const v = s.tick(0);
      nextTick += 100;
      bot.seen(v);
      if (v.ab && v.ab[7]) maxBytes = Math.max(maxBytes, JSON.stringify(v.ab[7]).length);
      const ev = ab.g.ev;
      if (ev[0] !== seq) { seq = ev[0]; if (ev[3] & 1) flushes++; bestChain = Math.max(bestChain, ev[1]); }
      if (hook) hook(s, v);
    }
  }
  return { score: ab.score, grade: X.albaGrade("laundry", ab.score), steps: ab.g.washes, maxBytes, maxCombo: ab.maxCombo, state: ab.state, n: ab.g.n, flushes, bestChain };
}

// (c) the bots
const BOTS = {
  perfect: { gap: [40, 40], bad: 0, oracle: true },
  strong: { gap: [150, 300], bad: 0.03 },
  good: { gap: [220, 520], bad: 0.06 },
  human: { gap: [300, 700], bad: 0.1 },
  casual: { gap: [450, 950], bad: 0.15 },
  slow: { gap: [700, 1300], bad: 0.25 },
};
const results = {};
let viewMax = 0;
for (const [nm, o] of Object.entries(BOTS)) {
  results[nm] = [1, 2, 3, 4, 5].map((seed) => play(o, seed));
  for (const r of results[nm]) { assert.equal(r.state, "end"); viewMax = Math.max(viewMax, r.maxBytes); }
}
const idle = play({ idle: true }, 9);
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(`laundry: par ${PAR}  (C ${Math.round(PAR * T.cuts[0])} B ${Math.round(PAR * T.cuts[1])} A ${Math.round(PAR * T.cuts[2])} S ${PAR})`);
for (const [nm, rs] of Object.entries(results)) console.log(`  ${nm.padEnd(8)} scores ${rs.map((r) => r.score).join(" ")}  grades ${rs.map((r) => "-CBAS"[r.grade]).join("")}  pairs ${rs.map((r) => r.n).join(",")}  chain steps ${rs.map((r) => r.steps).join(",")} best chain ${rs.map((r) => r.bestChain).join(",")} emptied ${rs.map((r) => r.flushes).join(",")} combo ${rs.map((r) => r.maxCombo).join(",")}  avg ${avg(rs.map((r) => r.score))} = ${(avg(rs.map((r) => r.score)) / PAR).toFixed(2)} par`);
console.log(`  idle     score ${idle.score} grade ${"-CBAS"[idle.grade]}   view max ${viewMax} bytes`);
assert.ok(results.perfect.every((r) => r.grade === 4), "the perfect bot reaches S every time");
{
  const m = avg(results.human.map((r) => r.score)) / PAR;
  assert.ok(m >= 0.6 && m <= 0.9, `the human-like bot lands around B (${m.toFixed(2)} of par)`);
}
assert.ok(avg(results.strong.map((r) => r.score)) > avg(results.human.map((r) => r.score)), "playing better scores more");
assert.ok(avg(results.casual.map((r) => r.score)) < avg(results.human.map((r) => r.score)), "playing worse scores less");
assert.ok(avg(results.slow.map((r) => r.score)) < avg(results.casual.map((r) => r.score)));
assert.equal(idle.grade, 0, "an idle player gets no grade"); assert.ok(idle.score < PAR * T.cuts[0], "and well under C");
assert.ok(viewMax < 500, `the view stays small (${viewMax} bytes)`);

// (a) determinism: the same seed gives the same pairs and, for the same inputs, the same shift
{
  const seq = (seed) => { const ab = mkAb(seed), out = []; for (let t = 0; t < 60000; t += 50) { R.adv(null, null, ab, t); if (ab.g.cur) out.push(`${ab.g.n}:${ab.g.cur.a}${ab.g.cur.b}`); if (ab.g.cur && ab.g.cur.y > 2) { ab.g.cur.x = ab.g.n % W; R.act(null, null, ab, { drop: 2 }, t); } if (ab.g.b.slice(0, 3 * W).some((v) => v)) ab.g.b.fill(0); } return [...new Set(out)].join(","); };
  assert.equal(seq(5), seq(5), "same seed, same pairs"); assert.notEqual(seq(5), seq(6), "another seed, other pairs");
  const a = play(BOTS.human, 3), b = play(BOTS.human, 3);
  assert.deepEqual(a, b, "same seed and same inputs: the same shift");
  const c = play(BOTS.human, 3, { name: "세탁다른" });
  assert.notDeepEqual([c.score, c.n, c.steps], [a.score, a.n, a.steps], "a different seed plays differently");
  const kinds = (bot) => { const out = []; let last = 0; play(bot, 4, { hook: (s) => { const g = s.p.ab.g; if (g.cur && g.n !== last && out.length < 20) { last = g.n; out.push(`${g.cur.a}${g.cur.b}`); } } }); return out.join(","); };
  assert.equal(kinds(BOTS.perfect), kinds(BOTS.slow), "the pair order is the seed's, whoever plays (stains have their own dice)");
}

// (d) hostile input: nothing throws, nothing counts, the state stays sane
{
  const s = sim("세탁해커", 2), ab = s.p.ab;
  const snap = () => JSON.stringify(ab.g);
  const junk = [{}, { mv: "1" }, { mv: 1.5 }, { mv: -3 }, { mv: 1e300 }, { mv: NaN }, { mv: Infinity }, { mv: null }, { mv: [1] }, { mv: { a: 1 } }, { rot: 2 }, { rot: 0 }, { rot: "x" }, { rot: -1.2 }, { drop: 3 }, { drop: -1 }, { drop: "2" }, { drop: 0 },
    { mv: 1, rot: 1 }, { mv: 1, drop: 2 }, { rot: 1, drop: 1, mv: -1 }, { x: 5, y: 5 }, { cur: { a: 99 } }, { k: "pipe" }, { mv: true }, { drop: true }, { rot: [] }, { mv: "__proto__" }];
  const before = snap();
  for (let i = 0; i < 2; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; }
  assert.equal(snap(), before, "the brief ignores every input");
  s.tick(T.briefMs + 200);
  for (let i = 0; i < 2; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; assert.doesNotThrow(() => s.tick(0)); }
  const g = ab.g;
  assert.ok(g.b.every((v) => Number.isInteger(v) && v >= 0 && v <= 7) && g.b.length === W * H, "the washer is intact");
  assert.ok(!g.cur || X.laundryFits({ b: g.b }, X.laundryCells(g.cur)) || g.cur.y <= 1, "the pair is in a legal place");
  assert.equal(ab.score, 0, "hostile input scores nothing");
  // spam inside the rate limit: only inputs 35 ms apart count
  for (let i = 0; i < 30 && !g.cur; i++) s.tick(100);
  assert.ok(g.cur, "a pair is in hand");
  let acc = 0, last = ab.lastAct;
  for (let i = 0; i < 50; i++) { s.now += 5; assert.doesNotThrow(() => s.act({ t: "ab_act", mv: i % 2 ? 1 : -1 })); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.ok(acc <= 8, `50 inputs in 250 ms: only ${acc} were taken`);
  acc = 0; last = ab.lastAct; s.now += 100;
  for (let i = 0; i < 50; i++) { s.act({ t: "ab_act", mv: 1 }); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.equal(acc, 1, "50 inputs in the same instant: one counts");
  // after the end nothing moves
  s.tick(T.runMs + 1000);
  assert.equal(ab.state, "end");
  const done = snap(), sc = ab.score;
  for (const j of [{ mv: 1 }, { drop: 2 }, { rot: 1 }]) { s.now += 50; s.act({ t: "ab_act", ...j }); }
  assert.equal(snap(), done, "after the end the washer is frozen"); assert.equal(ab.score, sc);
}

// (e) the server's cost: 240 simulated seconds, 10 ticks/s, an input every 250 ms
{
  const s = sim("세탁부하", 7), ab = s.p.ab;
  let ms = 0, views = 0;
  const cyc = [{ mv: 1 }, { mv: -1 }, { rot: 1 }, { drop: 1 }, { drop: 2 }, { mv: 1 }, { rot: -1 }, { drop: 1 }];
  for (let i = 0; i < (T.briefMs + T.runMs) / 100; i++) {
    if (i % 5 === 0) s.act({ t: "ab_act", ...cyc[(i / 5) % cyc.length] });
    const t0 = performance.now();
    s.tick(100);
    ms += performance.now() - t0; views++;
  }
  console.log(`  server: ${views} ticks + views in ${ms.toFixed(1)} ms (${(ms / 4.1).toFixed(2)} ms per simulated minute)`);
  assert.ok(ms / 4.1 < 100, "far below 100 ms per simulated minute");
  assert.equal(ab.state, "end");
}

console.log("alba-laundry: ok");

