// 일일 아르바이트 · 택배 상하차 (67-alba-parcel.js): the rules (rows, collision, rotation at walls, fragile boxes, truck swap, lazy gravity), determinism,
// hostile input, the view's size, the server's cost, and bots that play whole shifts through the real tick / viewFor / action path.
// node tests/alba-parcel.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, PARCEL_SHAPES, PARCEL_W, PARCEL_H, PARCEL_GAP, parcelFits, parcelDrop, albaGrade };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, R = X.ALBA_RULES.parcel, W = X.PARCEL_W, H = X.PARCEL_H, SH = X.PARCEL_SHAPES, T = X.ALBA_T;
const PAR = X.ALBA.parcel.par;

// ── unit harness: a bare shift object, no world
const mkAb = (seed = 7, endAt = 1e9) => {
  const ab = { k: "parcel", box: { seed }, runAt: 0, endAt, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null };
  R.init(null, null, ab);
  return ab;
};
/** rows: 10 strings of 8: `.` empty, a digit = box kind + 1, `f` = a fragile 1×1 (its own id). */
function setBoard(ab, rows) {
  const g = ab.g;
  let id = 0;
  rows.forEach((row, y) => [...row].forEach((ch, x) => { g.b[y * W + x] = ch === "." ? 0 : ch === "f" ? 1 : +ch; g.fr[y * W + x] = ch === "f" ? ++id : 0; }));
}
const board = (ab) => Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => { const i = y * W + x; return ab.g.b[i] ? (ab.g.fr[i] ? "f" : String(ab.g.b[i])) : "."; }).join(""));
const piece = (ab, k, r, x, y, f = 0) => { ab.g.cur = { k, r, x, y, f }; ab.g.fallAt = 1e8; };
const EMPTY = Array(H).fill("........");

// shapes
assert.deepEqual(SH.map((r) => r.length), [1, 2, 2, 1, 4, 4, 2], "distinct rotations per box kind");
assert.deepEqual(SH.map((r) => r[0].length), [1, 2, 3, 4, 3, 4, 4], "cells per box kind");
for (const rots of SH) for (const cells of rots) assert.ok(Math.min(...cells.map((c) => c[0])) === 0 && Math.min(...cells.map((c) => c[1])) === 0, "rotations are normalised to the corner");

// rows ship: 1 → 100, 2 → 250, 3 → 500, 4 → 900, and the rows above fall
{
  const ab = mkAb();
  setBoard(ab, [...EMPTY.slice(0, 8), "2.......", "111..111"]);
  piece(ab, 1, 0, 3, 0);
  assert.equal(R.act(null, null, ab, { drop: 2 }, 10), null);
  assert.equal(ab.score, 100, "one row ships for 100");
  assert.deepEqual(board(ab).slice(8), ["........", "2......."], "the row above fell, the shipped row is gone");
  assert.equal(ab.g.rows, 1); assert.equal(ab.combo, 1);
  assert.deepEqual(ab.g.ev, [1, 1, 1 << 9], "the event names the shipped row");
}
{
  const ab = mkAb();
  setBoard(ab, [...EMPTY.slice(0, 8), "111..111", "111..111"]);
  piece(ab, 3, 0, 3, 0);
  R.act(null, null, ab, { drop: 2 }, 10);
  assert.equal(ab.score, 250, "two rows ship for 250"); assert.deepEqual(board(ab), EMPTY);
}
{
  const ab = mkAb();
  setBoard(ab, [...EMPTY.slice(0, 6), ".1111111", ".1111111", ".1111111", ".1111111"]);
  piece(ab, 6, 0, 0, 0);
  assert.equal(R.act(null, null, ab, { rot: 1 }, 5), null, "the 4×1 turns upright");
  assert.deepEqual(SH[6][ab.g.cur.r].map((c) => c[0]), [0, 0, 0, 0]);
  const gx = ab.g.cur.x;
  assert.equal(gx, 0, "kept at the left");
  assert.equal(R.act(null, null, ab, { mv: 1 }, 6), null); assert.equal(R.act(null, null, ab, { mv: -1 }, 7), null);
  // a 3-row clear with a vertical bar over a 3-deep slot; four rows with the 4×1
  R.act(null, null, ab, { drop: 2 }, 10);
  assert.equal(ab.score, 900, "four rows ship for 900"); assert.deepEqual(board(ab), EMPTY);
  const b3 = mkAb();
  setBoard(b3, [...EMPTY.slice(0, 7), ".1111111", ".1111111", ".1111111"]);
  piece(b3, 2, 1, 0, 0);   // 3×1 upright into the 3-deep slot at column 0
  R.act(null, null, b3, { drop: 2 }, 10);
  assert.equal(b3.score, 500, "three rows ship for 500");
}

// collision
{
  const ab = mkAb();
  setBoard(ab, [...EMPTY.slice(0, 9), "..1....."]);
  piece(ab, 0, 0, 0, 0);
  assert.equal(R.act(null, null, ab, { mv: -1 }, 5), "wall"); assert.equal(ab.g.cur.x, 0, "the wall stops it");
  piece(ab, 0, 0, 7, 0); assert.equal(R.act(null, null, ab, { mv: 1 }, 5), "wall");
  piece(ab, 0, 0, 1, 9); assert.equal(R.act(null, null, ab, { mv: 1 }, 5), "wall", "a box in the way stops it");
  assert.equal(R.act(null, null, ab, { drop: 1 }, 5), "floor", "nothing below the floor");
  piece(ab, 0, 0, 2, 7); assert.equal(R.act(null, null, ab, { drop: 1 }, 100), null); assert.equal(ab.g.cur.y, 8, "a soft drop is one row");
  assert.equal(R.act(null, null, ab, { drop: 1 }, 200), "floor", "resting on a box"); assert.equal(ab.g.cur.y, 8);
  assert.equal(ab.g.fallAt, 100 + X.parcelDrop(ab.g, ab, 100), "a soft drop restarts the drop timer");
}

// rotation at the walls and the floor (kicks)
{
  const ab = mkAb();
  piece(ab, 6, 1, 7, 0); assert.equal(R.act(null, null, ab, { rot: 1 }, 5), null);
  assert.ok(ab.g.cur.x + 3 <= 7 && SH[6][ab.g.cur.r].every((c) => c[1] === 0), "upright against the right wall: turned flat and pushed in");
  piece(ab, 6, 0, 2, 8); assert.equal(R.act(null, null, ab, { rot: 1 }, 6), null);
  assert.equal(ab.g.cur.y, 6, "flat 4×1 on the floor turns upright by rising");
  piece(ab, 0, 0, 3, 3); assert.equal(R.act(null, null, ab, { rot: 1 }, 7), "round", "a 1×1 has nothing to turn");
  piece(ab, 4, 0, 0, 0);
  const before = ab.g.cur.r;
  R.act(null, null, ab, { rot: 1 }, 8); R.act(null, null, ab, { rot: -1 }, 9);
  assert.equal(ab.g.cur.r, before, "−1 turns back");
  setBoard(ab, ["........", "........", ".1.1....", "........", ...EMPTY.slice(0, 6)].slice(0, H));
  piece(ab, 6, 0, 0, 0);
  const rotBlocked = R.act(null, null, ab, { rot: 1 }, 10);
  assert.ok(rotBlocked === null || rotBlocked === "blocked", "a cramped turn is either kicked or refused, never into a box");
  assert.ok(X.parcelFits(ab.g, ab.g.cur.k, ab.g.cur.r, ab.g.cur.x, ab.g.cur.y));
}

// fragile boxes: covered once costs 30 and the combo; a topmost one is free
{
  const ab = mkAb();
  ab.score = 500; ab.combo = 4;
  setBoard(ab, [...EMPTY.slice(0, 9), "f......."]);
  piece(ab, 0, 0, 3, 0, 0);
  R.act(null, null, ab, { drop: 2 }, 10);
  assert.equal(ab.score, 500, "a fragile box with nothing on it is fine"); assert.equal(ab.combo, 4);
  piece(ab, 1, 0, 0, 0);
  R.act(null, null, ab, { drop: 2 }, 20);
  assert.equal(ab.score, 470, "covered: −30"); assert.equal(ab.combo, 0, "the combo breaks");
  assert.deepEqual(ab.g.ev.slice(1, 2), [4]);
  ab.score = 100;
  piece(ab, 0, 0, 0, 0); R.act(null, null, ab, { drop: 2 }, 30);
  assert.equal(ab.score, 100, "the same box is not charged twice");
  const bb = mkAb(); bb.score = 100;
  setBoard(bb, [...EMPTY.slice(0, 9), "ff......"]);   // two separate fragile 1×1 boxes
  piece(bb, 1, 0, 0, 0); R.act(null, null, bb, { drop: 2 }, 10);
  assert.equal(bb.score, 40, "two boxes covered by one piece: −30 each");
  // a fragile box that ships with its row was not damaged
  const cc = mkAb(); cc.score = 100;
  setBoard(cc, [...EMPTY.slice(0, 9), "f.111111"]);
  piece(cc, 4, SH[4].findIndex((s) => s.flat().join() === "0,0,1,0,1,1"), 0, 0); R.act(null, null, cc, { drop: 2 }, 10);
  assert.equal(cc.score, 200, "a fragile box in a row that ships goes with it: no damage, just the 100 for the row");
}

// the ceiling: the truck is swapped
{
  const ab = mkAb();
  ab.score = 300; ab.combo = 3;
  ab.g.b[3] = 1; ab.g.b[4] = 1;   // the spawn place (top, middle) is taken
  ab.g.cur = null; ab.g.spawnAt = 100;
  R.adv(null, null, ab, 100);
  assert.equal(ab.score, 200, "the swap costs 100"); assert.equal(ab.combo, 0);
  assert.equal(ab.g.b.filter((v) => v).length, 0, "an empty truck"); assert.ok(ab.g.cur && ab.g.cur.y === 0, "the next box is on its way");
  assert.equal(ab.g.ev[1], 2, "the event says swapped");
  ab.score = 40; ab.combo = 2; ab.g.b[3] = 1; ab.g.b[4] = 1; ab.g.b[11] = 1; ab.g.cur = null; ab.g.spawnAt = 200; R.adv(null, null, ab, 200);
  assert.equal(ab.score, 0, "never below 0");
}

// lazy gravity: whole drops up to now, in order, with their own timestamps
{
  const ab = mkAb();
  const D = X.parcelDrop(ab.g, ab, 0);
  R.adv(null, null, ab, 0);
  assert.ok(ab.g.cur && ab.g.cur.y === 0 && ab.g.fallAt === D, "the first box arrives when the shift starts");
  R.adv(null, null, ab, D * 3 + 5); assert.equal(ab.g.cur.y, 3, "three drops have passed");
  const rev = ab.rev; R.adv(null, null, ab, D * 3 + 6); assert.equal(ab.rev, rev, "nothing happened, the view is unchanged");
  const ab2 = mkAb(); for (let t = 0; t <= D * 3 + 5; t += 5) R.adv(null, null, ab2, t);
  assert.equal(ab2.g.cur.y, 3, "the same by small steps");
  const ab3 = mkAb(); R.adv(null, null, ab3, 1e9);   // a huge stall ends at once and leaves a sane state
  assert.ok(ab3.g.b.every((v) => Number.isInteger(v) && v >= 0 && v <= 7));
  // speed: rows, rush, fever
  const g = ab.g;
  assert.equal(X.parcelDrop(g, { endAt: 1e9, feverUntil: 0 }, 0), 490);
  g.rows = 10; assert.equal(X.parcelDrop(g, { endAt: 1e9, feverUntil: 0 }, 0), 310, "faster with every row shipped");
  assert.equal(X.parcelDrop(g, { endAt: 100000, feverUntil: 0 }, 90000), Math.round(310 * 0.65), "the last 15 s rush");
  assert.equal(X.parcelDrop(g, { endAt: 1e9, feverUntil: 500 }, 0), 465, "a fever slows the fall");
  g.rows = 1000; assert.equal(X.parcelDrop(g, { endAt: 1e9, feverUntil: 0 }, 0), 150, "never faster than 150 ms");
}

// view: shape, and unchanged when nothing happened
{
  const ab = mkAb();
  R.adv(null, null, ab, 5);
  const v = R.view(ab, 5);
  assert.equal(v[0].length, W * H); assert.ok(/^[.1-7f]+$/.test(v[0]));
  assert.ok(v[2] >= 1 && v[2] <= 7); assert.equal(v[1].length, 2 * SH[v[2] - 1][0].length, "the box's cells as x,y pairs");
  assert.ok(v[7] > 0 && v[8] === 490 && v[9] === 0);
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
  assert.ok(act({ t: "ab_start", k: "parcel" }).ok);
  return {
    S, p, act, get now() { return now; }, set now(v) { now = v; },
    tick(ms = 100) { now += ms; S.now = now; L.tick(S, now); const v = L.viewFor(S, "p1"); L.endTick(S); return v; },
  };
};
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// the bots' brain: score a landing like a Tetris player would (lines, holes, height, bumps, never cover a fragile box)
function evalPlace(b, fr, k, r, x, blind = false) {
  const sh = SH[k][r];
  let y = 0;
  const fit = (yy) => sh.every(([dx, dy]) => { const cx = x + dx, cy = yy + dy; return cx >= 0 && cx < W && cy >= 0 && cy < H && !b[cy * W + cx]; });
  if (!fit(0)) return null;
  while (fit(y + 1)) y++;
  const b2 = b.slice(), mine = sh.map(([dx, dy]) => (y + dy) * W + x + dx);
  let cover = 0;
  for (const i of mine) { b2[i] = 1; if (i + W < b.length && fr[i + W] && !mine.includes(i + W)) cover++; }
  let lines = 0;
  const rows = [];
  for (let yy = 0; yy < H; yy++) { if (b2.slice(yy * W, yy * W + W).every((v) => v)) lines++; else rows.push(yy); }
  const hs = [], nb = [];
  for (let yy = 0; yy < rows.length; yy++) nb.push(b2.slice(rows[yy] * W, rows[yy] * W + W));
  const grid = Array.from({ length: H - rows.length }, () => Array(W).fill(0)).concat(nb);
  let holes = 0;
  for (let cx = 0; cx < W; cx++) {
    let top = H;
    for (let cy = 0; cy < H; cy++) if (grid[cy][cx]) { top = cy; break; }
    hs.push(H - top);
    for (let cy = top; cy < H; cy++) if (!grid[cy][cx]) holes++;
  }
  const agg = hs.reduce((a, v) => a + v, 0), bump = hs.slice(1).reduce((a, v, i) => a + Math.abs(v - hs[i]), 0);
  return { y, score: 0.76 * lines - 0.51 * agg / 4 - 0.36 * holes * 2 - 0.18 * bump - (blind ? 0 : 3) * cover };
}
/** One bot (`blind`: does not mind fragile boxes): `gap` ms between inputs, `bad` = chance a box gets a random landing instead of the best one; `oracle` reads the server state instead of the wire. */
function mkBot(rng, { gap = [300, 700], bad = 0.1, oracle = false, blind = false }) {
  let wire = null, plan = null;   // plan = the landing chosen for the box in hand
  return {
    delay: () => gap[0] + rng() * (gap[1] - gap[0]),
    seen(v) { if (v && v.ab && v.ab[7]) wire = v.ab[7]; },
    step(p, send) {
      let cells, k, bd, fr;
      if (oracle) { const g = p.ab.g, c = g.cur; if (!c) return false; cells = SH[c.k][c.r].flatMap(([dx, dy]) => [c.x + dx, c.y + dy]); k = c.k; bd = g.b.map((v) => (v ? 1 : 0)); fr = g.fr; }
      else { if (!wire || !wire[1].length) return false; cells = wire[1]; k = wire[2] - 1; bd = [...wire[0]].map((ch) => (ch === "." ? 0 : 1)); fr = [...wire[0]].map((ch) => (ch === "f" ? 1 : 0)); }
      const pairs = [];
      for (let i = 0; i < cells.length; i += 2) pairs.push([cells[i], cells[i + 1]]);
      const x0 = Math.min(...pairs.map((q) => q[0])), y0 = Math.min(...pairs.map((q) => q[1]));
      const key = pairs.map(([x, y]) => [x - x0, y - y0]).sort((a, b) => a[1] - b[1] || a[0] - b[0]).flat().join();
      const r0 = SH[k].findIndex((s) => s.flat().join() === key);
      if (r0 < 0) return false;
      if (!plan || plan.k !== k || y0 < plan.y) {   // a new box (another kind, or back at the top)
        const opts = [];
        for (let r = 0; r < SH[k].length; r++) for (let x = 0; x < W; x++) { const e = evalPlace(bd, fr, k, r, x, blind); if (e) opts.push({ r, x, ...e }); }
        if (!opts.length) return false;
        opts.sort((a, b) => b.score - a.score);
        plan = { ...(rng() < bad ? opts[Math.floor(rng() * opts.length)] : opts[0]), k };
      }
      plan.y = y0;
      const nr = SH[k].length;
      if (r0 !== plan.r) return send({ rot: (plan.r - r0 + nr) % nr > nr / 2 ? -1 : 1 });
      if (x0 !== plan.x) return send({ mv: plan.x > x0 ? 1 : -1 });
      plan = null;
      return send({ drop: 2 });
    },
  };
}
function play(botOpts, seed, { name = `택배${seed}`, hook } = {}) {
  const rng = mulberry(seed * 977 + 13), s = sim(name, seed), bot = mkBot(rng, botOpts), ab = s.p.ab;
  let nextTick = s.now + 100, nextBot = ab.runAt + 200, maxBytes = 0, seq = 0, swaps = 0, breaks = 0;
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
      bot.seen(v); { const ev = ab.g.ev; if (ev[0] !== seq) { seq = ev[0]; if (ev[1] & 2) swaps++; if (ev[1] & 4) breaks++; } }
      if (v.ab && v.ab[7]) maxBytes = Math.max(maxBytes, JSON.stringify(v.ab[7]).length);
      if (hook) hook(s, v);
    }
  }
  return { score: ab.score, grade: X.albaGrade("parcel", ab.score), rows: ab.g.rows, maxBytes, maxCombo: ab.maxCombo, state: ab.state, swaps, breaks, n: ab.g.n, out: ab.out, endMs: ab.endAt - ab.runAt };
}

// (c) the bots
const BOTS = {
  perfect: { gap: [40, 40], bad: 0, oracle: true },
  strong: { gap: [150, 300], bad: 0.03 },
  good: { gap: [220, 520], bad: 0.06 },
  human: { gap: [300, 700], bad: 0.1 },
  casual: { gap: [450, 950], bad: 0.15 },
  slow: { gap: [700, 1300], bad: 0.25 },
  wild: { gap: [3000, 5000], bad: 0.5, blind: true },   // the sloppy bot
};
const results = {};
let viewMax = 0;
for (const [nm, o] of Object.entries(BOTS)) {
  results[nm] = Array.from({ length: nm === "human" ? 20 : (nm === "slow" || nm === "wild") ? 12 : 5 }, (_, i) => i + 1).map((seed) => play(o, seed));
  for (const r of results[nm]) { assert.equal(r.state, "end"); viewMax = Math.max(viewMax, r.maxBytes); }
}
const idle = play({ idle: true }, 9);
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(`parcel: par ${PAR}  (C ${Math.round(PAR * T.cuts[0])} B ${Math.round(PAR * T.cuts[1])} A ${Math.round(PAR * T.cuts[2])} S ${PAR})`);
for (const [nm, rs] of Object.entries(results)) console.log(`  ${nm.padEnd(8)} scores ${rs.map((r) => r.score).join(" ")}  grades ${rs.map((r) => "-CBAS"[r.grade]).join("")}  rows ${rs.map((r) => r.rows).join(",")}  boxes ${rs.map((r) => r.n).join(",")}  swaps ${rs.map((r) => r.swaps).join(",")} broken ${rs.map((r) => r.breaks).join(",")} combo ${rs.map((r) => r.maxCombo).join(",")}  avg ${avg(rs.map((r) => r.score))} = ${(avg(rs.map((r) => r.score)) / PAR).toFixed(2)} par`);
console.log(`  idle     score ${idle.score} grade ${"-CBAS"[idle.grade]}   view max ${viewMax} bytes`);
assert.ok(results.perfect.every((r) => r.grade === 4), "the perfect bot reaches S every time");
{
  const rate = (rs) => rs.filter((r) => r.out).length / rs.length;
  console.log(`parcel strike-outs: perfect ${rate(results.perfect)} human ${rate(results.human).toFixed(2)} sloppy ${rate(results.wild).toFixed(2)}`);
  assert.equal(rate(results.perfect), 0, "the perfect bot never strikes out");
  assert.ok(rate(results.human) <= 0.25, "a human-like bot strikes out in at most 25 % of seeds");
  assert.ok(results.wild.filter((r) => r.out && r.endMs < 75000).length >= results.wild.length / 2, "a sloppy bot strikes out in at least half of its seeds, before 75 s");
}
{
  const m = avg(results.human.map((r) => r.score)) / PAR;
  assert.ok(m >= 0.55 && m <= 0.9, `the human-like bot lands around B (${m.toFixed(2)} of par)`);
}
assert.ok(avg(results.strong.map((r) => r.score)) > avg(results.human.map((r) => r.score)), "playing better scores more");
assert.ok(avg(results.slow.map((r) => r.score)) < avg(results.human.map((r) => r.score)), "playing worse scores less");
assert.equal(idle.grade, 0, "an idle player gets no grade"); assert.equal(idle.score, 0, "and no points");
assert.ok(viewMax < 500, `the view stays small (${viewMax} bytes)`);

// (a) determinism: the same seed gives the same boxes and, for the same inputs, the same shift
{
  const seq = (seed) => { const ab = mkAb(seed), out = []; for (let t = 0; t < 40000; t += 50) { R.adv(null, null, ab, t); if (ab.g.cur) out.push(`${ab.g.n}:${ab.g.cur.k}${ab.g.cur.f}`); if (ab.g.cur && ab.g.cur.y > 2) R.act(null, null, ab, { drop: 2 }, t); } return [...new Set(out)].join(","); };
  assert.equal(seq(5), seq(5), "same seed, same boxes"); assert.notEqual(seq(5), seq(6), "another seed, other boxes");
  const a = play(BOTS.human, 3), b = play(BOTS.human, 3);
  assert.deepEqual(a, b, "same seed and same inputs: the same shift");
  const c = play(BOTS.human, 3, { name: "택배다른" });
  assert.notDeepEqual([c.score, c.n, c.rows], [a.score, a.n, a.rows], "a different seed plays differently");
  // the box sequence does not depend on how the player plays
  const kinds = (bot) => { const out = []; let last = 0; play(bot, 4, { hook: (s) => { const g = s.p.ab.g; if (g.cur && g.n !== last && out.length < 20) { last = g.n; out.push(g.cur.k * 2 + g.cur.f); } } }); return out.join(","); };
  assert.equal(kinds(BOTS.perfect), kinds(BOTS.slow), "the box order is the seed's, whoever plays");
}

// (d) hostile input: nothing throws, nothing counts, the state stays sane
{
  const s = sim("택배해커", 2), ab = s.p.ab;
  const snap = () => JSON.stringify(ab.g);
  const junk = [{}, { mv: "1" }, { mv: 1.5 }, { mv: -3 }, { mv: 1e300 }, { mv: NaN }, { mv: Infinity }, { mv: null }, { mv: [1] }, { mv: { a: 1 } }, { rot: 2 }, { rot: 0 }, { rot: "x" }, { rot: -1.2 }, { drop: 3 }, { drop: -1 }, { drop: "2" }, { drop: 0 },
    { mv: 1, rot: 1 }, { mv: 1, drop: 2 }, { rot: 1, drop: 1, mv: -1 }, { x: 5, y: 5 }, { cur: { k: 99 } }, { k: "pipe" }, { mv: true }, { drop: true }, { rot: [] }, { mv: "__proto__" }];
  s.act({ t: "ab_act", mv: 1 });
  const before = snap();
  for (let i = 0; i < 2; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; }
  assert.equal(snap(), before, "the brief ignores every input");
  s.tick(T.briefMs + 200);
  for (let i = 0; i < 2; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; assert.doesNotThrow(() => s.tick(0)); }
  const g = ab.g;
  assert.ok(g.b.every((v) => Number.isInteger(v) && v >= 0 && v <= 7) && g.fr.every((v) => Number.isInteger(v) && v >= 0) && g.b.length === W * H, "the board is intact");
  assert.ok(!g.cur || X.parcelFits(g, g.cur.k, g.cur.r, g.cur.x, g.cur.y), "the box is in a legal place");
  assert.equal(ab.score, 0, "hostile input scores nothing");
  // spam inside the rate limit: only the first counts
  for (let i = 0; i < 30 && !g.cur; i++) s.tick(100);
  assert.ok(g.cur, "a box is in hand");
  let acc = 0, last = ab.lastAct;
  for (let i = 0; i < 50; i++) { s.now += 5; assert.doesNotThrow(() => s.act({ t: "ab_act", mv: i % 2 ? 1 : -1 })); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.ok(acc <= 8, `50 inputs in 250 ms: only those ${acc} 35 ms apart were taken`);
  acc = 0; last = ab.lastAct; s.now += 100;
  for (let i = 0; i < 50; i++) { s.act({ t: "ab_act", mv: 1 }); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.equal(acc, 1, "50 inputs in the same instant: one counts");
  // after the end nothing moves, before nothing counted
  s.tick(T.runMs + 1000);
  assert.equal(ab.state, "end");
  const done = snap(), sc = ab.score;
  for (const j of [{ mv: 1 }, { drop: 2 }, { rot: 1 }]) { s.now += 50; s.act({ t: "ab_act", ...j }); }
  assert.equal(snap(), done, "after the end the board is frozen"); assert.equal(ab.score, sc);
}

// (e) the server's cost: a 90 s shift (95 simulated seconds with the brief), 10 ticks/s, an input every 250 ms
{
  const s = sim("택배부하", 7), ab = s.p.ab;
  let ms = 0, views = 0;
  const cyc = [{ mv: 1 }, { mv: -1 }, { rot: 1 }, { drop: 1 }, { drop: 2 }, { mv: 1 }, { rot: -1 }, { drop: 1 }];
  for (let i = 0; i < (T.briefMs + T.runMs) / 100; i++) {
    if (i % 5 === 0) s.act({ t: "ab_act", ...cyc[(i / 5) % cyc.length] });
    const t0 = performance.now();
    s.tick(100);
    ms += performance.now() - t0; views++;
  }
  console.log(`  server: ${views} ticks + views in ${ms.toFixed(1)} ms (${(ms / 1.6).toFixed(2)} ms per simulated minute)`);
  assert.ok(ms / 1.6 < 100, "far below 100 ms per simulated minute");
  assert.equal(ab.state, "end");
}

console.log("alba-parcel: ok");
