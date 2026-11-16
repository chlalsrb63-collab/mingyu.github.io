// 일일 아르바이트 · 가로등 점등 (67-alba-lamp.js): the maze (symmetric, connected, loops, no dead ends), the courier's movement and turns, bulbs and groups, big bulbs and the shadow chain,
// the four shadows' rules, being caught, an alley cleared, fever, determinism, hostile input, the view's size, the server's cost, and bots that play whole shifts through the real path.
// node tests/alba-lamp.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, LAMP, LAMP_D, lampMaze, lampOpen, lampXY, lampDist, lampChoose, lampSp, lampPick, albaGrade, albaAdvance };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, R = X.ALBA_RULES.lamp, K = X.LAMP, D = X.LAMP_D, T = X.ALBA_T, N = K.N;
const PAR = X.ALBA.lamp.par, STEP = K.STEP;

// ── unit harness
const mkAb = (seed = 7, endAt = 1e9) => {
  const ab = { k: "lamp", box: { seed }, runAt: 0, endAt, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null };
  R.init(null, null, ab);
  return ab;
};
const ent = (x, y, dir = -1) => ({ x, y, tx: x, ty: y, pr: 0, dir });
/** A tiny alley: `cells` are open with a bulb, `big` ones hold a big bulb, `none` have no bulb. The shadows sleep at home unless placed; no pause. */
function arena(ab, cells, { big = [], none = [], pl = [7, 13], dir = -1, sh = {} } = {}) {
  const g = ab.g;
  g.w = new Array(N * N).fill(1); g.pel = new Array(N * N).fill(0);
  for (const [x, y] of cells) { g.w[y * N + x] = 0; g.pel[y * N + x] = 1; }
  for (const [x, y] of big) g.pel[y * N + x] = 2;
  for (const [x, y] of none) g.pel[y * N + x] = 0;
  g.left = g.pel.filter((v) => v).length; g.pend = 0; g.frz = 0; g.dk = -1; g.pwUntil = 0; g.on = 0; g.want = -1; g.pl = ent(...pl, dir);
  g.sh = K.HOME.map(([x, y], i) => (sh[i] ? { ...ent(...sh[i].at, sh[i].dir ?? -1), home: 0, wait: 0, fr: sh[i].fr ? 1 : 0 } : { ...ent(x, y), home: 1, wait: 1e9, fr: 0 }));
  return g;
}
const rowCells = (y, a, b) => Array.from({ length: b - a + 1 }, (_, i) => [a + i, y]);
const run = (ab, t) => { R.adv(null, null, ab, t); };
const tile = (ab) => [ab.g.pl.x, ab.g.pl.y, ab.g.pl.tx, ab.g.pl.ty];

// ── the maze
{
  for (let seed = 1; seed <= 12; seed++) for (let lv = 0; lv < 8; lv++) {
    const w = X.lampMaze(seed * 7919, lv), at = (x, y) => y * N + x;
    assert.equal(w.length, N * N);
    for (let i = 0; i < N; i++) assert.ok(w[at(i, 0)] && w[at(i, N - 1)] && w[at(0, i)] && w[at(N - 1, i)], "walled in");
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) assert.equal(w[at(x, y)], w[at(N - 1 - x, y)], `symmetric (${x},${y})`);
    const open = []; for (let i = 0; i < N * N; i++) if (!w[i]) open.push(i);
    const g = { w }, seen = new Set([at(7, 13)]), q = [at(7, 13)];
    for (let i = 0; i < q.length; i++) { const c = q[i], cx = c % N, cy = (c / N) | 0; for (const [dx, dy] of D) if (X.lampOpen(g, cx + dx, cy + dy) && !seen.has(at(cx + dx, cy + dy))) { seen.add(at(cx + dx, cy + dy)); q.push(at(cx + dx, cy + dy)); } }
    assert.equal(seen.size, open.length, `connected (seed ${seed} lv ${lv})`);
    let edges = 0;
    for (const c of open) {
      const cx = c % N, cy = (c / N) | 0, deg = D.filter(([dx, dy]) => X.lampOpen(g, cx + dx, cy + dy)).length;
      assert.ok(deg >= 2, `no dead ends (${cx},${cy}) seed ${seed} lv ${lv}`);
      edges += deg;
    }
    assert.ok(edges / 2 - open.length + 1 >= 4, "loops: the alley has cycles");
    for (const [x, y] of [K.START, ...K.HOME, ...K.CORNER]) assert.ok(!w[at(x, y)], "start, homes and corners are open");
    assert.ok(open.length >= 90 && open.length <= 170, `a sane size (${open.length})`);
  }
  const a = JSON.stringify(X.lampMaze(5, 2)), b = JSON.stringify(X.lampMaze(5, 2));
  assert.equal(a, b, "a seed and a level give the same alley"); assert.notEqual(a, JSON.stringify(X.lampMaze(5, 3))); assert.notEqual(a, JSON.stringify(X.lampMaze(6, 2)));
  const loops = (lv) => { let s = 0; for (let seed = 1; seed <= 20; seed++) { const w = X.lampMaze(seed * 31, lv); s += w.filter((v) => !v).length; } return s; };
  assert.ok(loops(0) > loops(6), "the first alleys are more open (more loops)");
}

// ── the courier: three steps a tile, straight on, a queued turn at the next junction, a reversal at once
{
  const ab = mkAb();
  const g = arena(ab, rowCells(13, 1, 13), { none: [[7, 13]], dir: 1 });
  run(ab, 150);
  assert.deepEqual(tile(ab), [8, 13, 9, 13], "three 50 ms steps a tile (6.7 tiles a second)");
  run(ab, 450);
  assert.deepEqual(tile(ab).slice(0, 2), [10, 13]);
  assert.equal(ab.score, 0, "no group yet (three bulbs)");
  run(ab, 750);
  assert.equal(ab.score, 50, "five bulbs make a group: +50"); assert.equal(ab.combo, 1); assert.equal(g.pend, 0); assert.equal(g.left, 12 - 5);
  run(ab, 1500);   // to the wall at (13,13): he stops there
  assert.deepEqual(tile(ab), [13, 13, 13, 13], "a wall stops him"); assert.equal(g.pl.pr, 0);
  assert.equal(g.left, g.pel.filter((v) => v).length, "the count matches the board");
  // an alley with a junction: the turn waits for it
  const b2 = mkAb(), g2 = arena(b2, [...rowCells(13, 1, 13), ...rowCells(12, 7, 7), ...rowCells(11, 7, 7), ...rowCells(10, 7, 7)], { pl: [4, 13], dir: 1 });
  assert.equal(R.act(null, null, b2, { d: 0 }, 0), null); assert.equal(g2.want, 0);
  run(b2, 300);
  assert.deepEqual(tile(b2).slice(0, 2), [6, 13], "still going right: the junction is ahead");
  run(b2, 500);
  assert.deepEqual(tile(b2), [7, 13, 7, 12], "at the junction he turns up"); assert.equal(g2.pl.dir, 0); assert.equal(g2.want, -1, "the turn is used up");
  run(b2, 950);
  assert.deepEqual(tile(b2).slice(0, 2), [7, 10], "and on to the end of the street");
  // a turn into a wall waits, then expires
  const b3 = mkAb(), g3 = arena(b3, rowCells(13, 1, 13), { pl: [4, 13], dir: 1 });
  R.act(null, null, b3, { d: 0 }, 0); run(b3, 300);
  assert.equal(g3.pl.dir, 1, "up is a wall: he keeps going"); assert.equal(g3.want, 0, "and the turn is still queued");
  run(b3, 2400); assert.equal(g3.want, -1, "a queued turn lapses after about two seconds");
  // a reversal in the middle of a tile is taken at once
  const b4 = mkAb(), g4 = arena(b4, rowCells(13, 1, 13), { none: [[4, 13]], pl: [4, 13], dir: 1 });
  run(b4, 50);
  assert.deepEqual(tile(b4), [4, 13, 5, 13]); assert.equal(g4.pl.pr, 40);
  R.act(null, null, b4, { d: 3 }, 50);
  assert.deepEqual(tile(b4), [5, 13, 4, 13], "turned about on the spot"); assert.equal(g4.pl.pr, 80); assert.equal(g4.pl.dir, 3); assert.equal(g4.want, -1);
  // standing still, an input sets him off
  const b5 = mkAb(), g5 = arena(b5, rowCells(13, 1, 13), { pl: [4, 13], dir: -1 });
  run(b5, 200); assert.deepEqual(tile(b5), [4, 13, 4, 13], "he waits for the first input");
  R.act(null, null, b5, { d: 3 }, 200); run(b5, 250);
  assert.ok(g5.pl.x < 4 || g5.pl.pr > 0, "and goes");
  // the brief pause at the start: nothing moves for 800 ms
  const b6 = mkAb(); R.act(null, null, b6, { d: 0 }, 0); run(b6, 750);
  assert.deepEqual(tile(b6), [7, 13, 7, 13], "frozen at the start"); assert.ok(b6.g.frz > 0);
}

// ── bulbs, big bulbs, the shadow chain, being caught, a cleared alley
{
  // a big bulb: +50, the shadows flee for 8 s
  const ab = mkAb();
  const g = arena(ab, rowCells(13, 1, 13), { big: [[9, 13]], none: [[7, 13], [8, 13]], pl: [7, 13], dir: 1, sh: { 0: { at: [3, 13], dir: 1 } } });
  run(ab, 300);   // arrives at 9
  assert.equal(ab.score, 50, "a big bulb: +50"); assert.deepEqual(g.ev.slice(1), [1, 50]);
  assert.equal(g.pwUntil, 300 + K.PW, "8 s of fright");
  run(ab, 500);
  assert.equal(g.sh[0].fr, 1, "the shadow flees"); assert.equal(g.on, 1);
  assert.equal(g.sh[1].fr, 0, "a sleeping one is not frightened");
  run(ab, 300 + K.PW + 100);
  assert.equal(g.sh[0].fr, 0, "and recovers after 8 s"); assert.equal(g.on, 0);
  // eaten in a chain: 200, 400, 800, 1600
  const b2 = mkAb();
  const g2 = arena(b2, rowCells(13, 1, 13), { none: rowCells(13, 1, 13), pl: [7, 13], dir: 1, sh: { 0: { at: [8, 13], dir: 1, fr: true }, 1: { at: [10, 13], dir: 1, fr: true }, 2: { at: [11, 13], dir: 1, fr: true }, 3: { at: [12, 13], dir: 1, fr: true } } });
  g2.pwUntil = 1e9; g2.on = 1; g2.sh.forEach((s) => { s.fr = 1; }); g2.pel[13 * N + 1] = 1; g2.left = 1;
  const pts = [];
  for (let t = 50; t <= 4000 && pts.length < 4; t += 50) { const seq = g2.seq; run(b2, t); if (g2.seq !== seq && g2.ev[1] === 4) pts.push(g2.ev[2]); }
  assert.equal(pts.length, 4, "four shadows eaten");
  const mult = (c) => 1 + 0.1 * Math.min(c, 10);
  assert.deepEqual(pts, [200, 400, 800, 1600].map((v, i) => Math.round(v * mult(i))), "200, 400, 800, 1600 (with the combo)");
  assert.equal(g2.chain, 3, "the chain stops at the fourth"); assert.ok(g2.sh.some((s) => s.home === 1 && s.wait > 0 && !s.fr), "an eaten shadow waits at home");
  // caught: −30, the combo breaks, everybody back to their start, the bulbs stay lit
  const b3 = mkAb();
  const g3 = arena(b3, rowCells(13, 1, 13), { none: [[7, 13]], pl: [7, 13], dir: 1, sh: { 0: { at: [10, 13], dir: 3 } } });
  b3.score = 100; b3.combo = 4; g3.pend = 3;
  const left0 = g3.left;
  for (let t = 50; t <= 1500 && g3.ev[1] !== 2; t += 50) run(b3, t);
  assert.equal(g3.ev[1], 2, "the shadow caught him");
  assert.equal(b3.combo, 0); assert.ok(b3.score >= 100 - 30 && b3.score <= 100 + 5 * 10 * 2, `−30, the waiting bulbs paid first (${b3.score})`);
  assert.deepEqual(tile(b3), [7, 13, 7, 13], "back at the start"); assert.equal(g3.pl.dir, -1); assert.ok(g3.frz > 0, "a short pause");
  assert.ok(g3.sh.every((s, i) => s.home === 1 && s.x === K.HOME[i][0] && s.y === K.HOME[i][1] && s.wait === K.DELAY[i]), "the shadows are at home, one by one");
  assert.ok(g3.left < left0, "the lit bulbs stay lit"); assert.equal(g3.pend, 0);
  // an alley cleared: the last bulb pays the group, +200, the next (different) alley
  const b4 = mkAb();
  const g4 = arena(b4, rowCells(13, 1, 13), { none: rowCells(13, 1, 13), pl: [7, 13], dir: 1 });
  g4.pel[13 * N + 9] = 1; g4.left = 1; g4.pend = 2;
  const w0 = JSON.stringify(g4.w);
  run(b4, 300);
  assert.equal(b4.score, 30 + Math.round(200 * 1.1), "the three waiting bulbs (30), then +200 for the alley (the combo is 1)");
  assert.deepEqual(g4.ev.slice(1, 2), [3]); assert.equal(g4.lv, 1); assert.notEqual(JSON.stringify(g4.w), w0, "the next alley");
  assert.equal(g4.left, g4.pel.filter((v) => v).length); assert.ok(g4.left > 90); assert.deepEqual(tile(b4), [7, 13, 7, 13]); assert.ok(g4.frz > 0);
  assert.equal(g4.pel[13 * N + 7], 0, "no bulb under the courier"); assert.equal(g4.pel.filter((v) => v === 2).length, 4, "four big bulbs");
  // the end of the shift pays the waiting bulbs
  const b5 = mkAb(7, 1000);
  const g5 = arena(b5, rowCells(13, 1, 13), { none: [[7, 13]], pl: [7, 13], dir: 1 });
  run(b5, 300); assert.equal(g5.pend, 2); assert.equal(b5.score, 0);
  run(b5, 1000); assert.equal(g5.pend, 0, "paid at the end"); assert.ok(b5.score >= 20);
  // groups of five: the engine's combo counts the groups, so the first fever needs ~50 bulbs
  const b6 = mkAb(), g6 = arena(b6, rowCells(13, 1, 13), { none: [[7, 13]], pl: [7, 13], dir: 1 });
  run(b6, 2000);
  assert.equal(b6.combo, 1, "six bulbs are one group (+1 waiting): the combo counts groups"); assert.equal(b6.score, 50); assert.equal(g6.pend, 1);
}

// ── the shadows' rules
{
  const ab = mkAb();
  const g = ab.g;
  // a plus-shaped crossroads at (7,7): the shadow arrives from the south
  const cells = [...rowCells(7, 3, 11), ...Array.from({ length: 9 }, (_, i) => [7, 3 + i])];
  arena(ab, cells, { pl: [3, 7], dir: -1, sh: { 0: { at: [7, 7], dir: 0 } } });
  g.tk = 550;   // out of the scatter phase
  const s = g.sh[0];
  const pick = (i, ply, dir = -1) => { s.x = 7; s.y = 7; s.tx = 7; s.ty = 7; s.dir = 0; g.pl = ent(...ply, dir); g.dk = -1; X.lampChoose(g, s, i); return s.dir; };
  assert.equal(pick(0, [3, 7]), 3, "direct: the player is to the west");
  assert.equal(pick(0, [11, 7]), 1, "… east");
  assert.equal(pick(0, [7, 3]), 0, "… north");
  assert.notEqual(pick(0, [7, 11]), 2, "it does not turn back (the player is straight behind)");
  assert.equal(pick(1, [9, 7], 3), 3, "ambush: the player is east but heads west: four tiles ahead of him is west of the shadow");
  assert.equal(pick(1, [9, 7], 1), 1, "… and heading east it is east");
  assert.equal(pick(2, [3, 7]), 3, "relentless: the shortest way");
  g.sh[2].fr = 0; { const w = pick(2, [7, 3]); assert.equal(w, 0); }
  // scatter: the first steps of a cycle send shadows 0, 1, 3 to their corners, never shadow 2
  g.tk = 10;
  assert.equal(pick(0, [3, 7]), 0, "direct in scatter: heads for its corner (north-east), not for the player");
  assert.equal(pick(2, [3, 7]), 3, "the relentless one never scatters");
  // fleeing is a seeded random: the same seed, the same turns
  const flee = (seed) => { g.rb = { seed }; s.fr = 1; const out = []; for (let i = 0; i < 12; i++) out.push(pick(0, [3, 7])); s.fr = 0; return out.join(""); };
  assert.equal(flee(5), flee(5)); assert.notEqual(flee(5) + flee(6) + flee(7), flee(5).repeat(3), "a frightened shadow wanders");
  const wim = (seed) => { g.rb = { seed }; g.tk = 550; const out = []; for (let i = 0; i < 16; i++) out.push(pick(3, [3, 7])); return out.join(""); };
  assert.equal(wim(9), wim(9), "the whimsical one is seeded"); assert.ok(new Set(wim(9)).size > 1 && wim(9).includes("3"), "whimsical: mostly at him, sometimes not");
  // a shadow slower than the courier, quicker with the alleys, slower when frightened
  const sp = (lv, fr) => { g.lv = lv; return X.lampSp(g, { fr }, 0); };
  assert.ok(sp(0, 0) < K.PSP && sp(9, 0) < K.PSP && sp(3, 0) > sp(0, 0) && sp(0, 1) < sp(0, 0));
  // a fever makes them flee too, however the fever came
  const b2 = mkAb(), g2 = arena(b2, rowCells(13, 1, 13), { none: [[7, 13]], pl: [7, 13], dir: 1, sh: { 0: { at: [2, 13], dir: 1 } } });
  b2.feverUntil = 9000; run(b2, 100);
  assert.equal(g2.sh[0].fr, 1, "a fever: they flee"); run(b2, 9100); assert.equal(g2.sh[0].fr, 0, "and recover when it ends");
}

// ── the clock, the view
{
  const ab = mkAb();
  run(ab, 130); assert.equal(ab.g.simAt, 100, "whole steps only"); assert.equal(ab.g.tk, 2);
  const a2 = mkAb(); for (let t = 0; t <= 130; t += 10) run(a2, t);
  assert.equal(JSON.stringify(a2.g), JSON.stringify(ab.g), "the same by small steps");
  const a3 = mkAb(); run(a3, 1e9); assert.ok(a3.g.simAt > 1e9 - 100 && a3.g.tk < 100 && a3.score >= 0, "a stall jumps ahead");
  const v = R.view(ab, 130);
  assert.equal(v[0], 0); assert.equal(v[1].length, 60); assert.equal(v[2].length, 60); assert.ok(/^[0-9a-f]+$/.test(v[1] + v[2]));
  assert.equal(v[3].length, 4, "four big bulbs"); assert.equal(v[4].length, 7); assert.equal(v[5].length, 4); assert.ok(v[5].every((s) => s.length === 7));
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v, "plain JSON"); assert.ok(JSON.stringify(v).length < 500, `compact (${JSON.stringify(v).length} bytes)`);
  // the maze in the view is the server's (symmetric, 15 rows of 15 bits)
  const rows = v[1].match(/.{4}/g).map((h) => parseInt(h, 16));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) assert.equal((rows[y] >> x) & 1, ab.g.w[y * N + x]);
  const prow = v[2].match(/.{4}/g).map((h) => parseInt(h, 16));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) assert.equal((prow[y] >> x) & 1, ab.g.pel[y * N + x] ? 1 : 0);
  assert.equal(v[9], ab.g.left); assert.ok(v[7] > 0, "the start pause is in the view");
  // extrapolation numbers: a moving entity's progress now, its speed
  const b2 = mkAb(), g2 = arena(b2, rowCells(13, 1, 13), { pl: [4, 13], dir: 1 });
  run(b2, 50);
  const v2 = R.view(b2, 80);
  assert.deepEqual(v2[4].slice(0, 4), [4, 13, 5, 13]); assert.equal(v2[4][5], K.PSP); assert.equal(v2[4][4], 40 + Math.round(40 * 30 / 50), "progress at the moment of the view");
}

// ── whole shifts through the real engine
const sim = (name, seed = 1) => {
  const S = L.setup();
  let now = 5_000_000 + seed * 7919;
  S.now = now;
  L.addPlayer(S, "p1", L.hero(name, { wk: "sword", lvl: 30, migrate: true }));
  const p = S.players.p1;
  const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
  assert.ok(act({ t: "ab_start", k: "lamp" }).ok);
  return {
    S, p, act, get now() { return now; }, set now(v) { now = v; },
    tick(ms = 100) { now += ms; S.now = now; L.tick(S, now); const v = L.viewFor(S, "p1"); L.endTick(S); return v; },
  };
};
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** The bots' brain: where to turn at the tile where the next turn happens. Danger = a shadow gets to a tile before him (with `margin` tiles to spare); he heads for the nearest bulb
 *  (a big one when a shadow is near, a frightened shadow when it is within reach) over safe tiles, else away from the shadows, else about. */
function brain(ab, { margin = 1, dread = 6 }) {
  const g = ab.g, p = g.pl, moving = p.tx !== p.x || p.ty !== p.y, P = moving ? [p.tx, p.ty] : [p.x, p.y], back = moving ? D.findIndex(([dx, dy]) => p.x === P[0] + dx && p.y === P[1] + dy) : -1;
  const bfs = (sx, sy, ok = () => true) => { const df = new Array(N * N).fill(-1), q = [sy * N + sx]; df[q[0]] = 0; for (let i = 0; i < q.length; i++) { const c = q[i], cx = c % N, cy = (c / N) | 0; for (const [dx, dy] of D) { const n = (cy + dy) * N + cx + dx; if (X.lampOpen(g, cx + dx, cy + dy) && df[n] < 0 && ok(n)) { df[n] = df[c] + 1; q.push(n); } } } return df; };
  const per = (K.UNIT / K.PSP);   // steps a tile
  const threats = [], prey = [];
  g.sh.forEach((s, i) => {
    if (s.home) return;
    const sp = X.lampSp(g, s, i), spt = K.UNIT / sp, df = bfs(s.tx, s.ty);
    (s.fr ? prey : threats).push({ s, df, spt, lead: (1 - s.pr / K.UNIT) * spt });
  });
  const dpP = bfs(P[0], P[1]), dpLead = moving ? (1 - p.pr / K.UNIT) * per : 0;
  const frSteps = Math.max(0, (Math.max(g.pwUntil, ab.feverUntil) - g.simAt) / STEP);
  const unsafe = new Array(N * N).fill(false);
  for (const th of threats) for (let t = 0; t < N * N; t++) if (th.df[t] >= 0 && dpP[t] >= 0 && th.lead + th.df[t] * th.spt <= dpLead + dpP[t] * per + margin * per) unsafe[t] = true;
  const near = threats.some((th) => dpP[th.s.ty * N + th.s.tx] >= 0 && dpP[th.s.ty * N + th.s.tx] <= dread);
  const cand = [];
  for (let q = 0; q < 4; q++) { if (q === back) continue; const x = P[0] + D[q][0], y = P[1] + D[q][1]; if (X.lampOpen(g, x, y)) cand.push({ q, x, y }); }
  if (!cand.length) return back;
  if (moving && unsafe[P[1] * N + P[0]] && threats.length) return back;   // the tile ahead is lost: about
  let best = null;
  for (const c of cand) {
    const ci = c.y * N + c.x;
    if (unsafe[ci]) continue;
    const df = bfs(c.x, c.y, (n) => !unsafe[n] && n !== P[1] * N + P[0]);
    let sc = 1e9;
    for (let i = 0; i < N * N; i++) if (df[i] >= 0 && g.pel[i]) sc = Math.min(sc, df[i] - (g.pel[i] === 2 && near ? 6 : 0));
    for (const pr of prey) { const i = pr.s.ty * N + pr.s.tx; if (df[i] >= 0 && df[i] * per < frSteps * 0.8) sc = Math.min(sc, df[i] - 8); }
    if (!best || sc < best.sc) best = { q: c.q, sc };
  }
  if (best) return best.q;
  let far = null;   // nowhere safe to eat: away
  for (const c of cand) { const m = Math.min(...threats.map((th) => th.df[c.y * N + c.x]).filter((v) => v >= 0), 99); if (!far || m > far.m) far = { q: c.q, m }; }
  return far ? far.q : cand[0].q;
}
/** A player: decides every `lat` ms from the live state (a late input misses its junction), slips (`err`) to a random turn. */
function pacBot(rng, { lat = [150, 400], margin = 1, dread = 6, err = 0.1, poll = 0 }) {
  let last = -1;
  return {
    step(s, now) {
      const ab = s.p.ab, p = ab.g.pl;
      X.albaAdvance(s.S, s.p, ab, now);
      const wait = poll || lat[0] + rng() * (lat[1] - lat[0]), key = (p.tx * 15 + p.ty) * 1000 + p.x * 15 + p.y;
      let d = brain(ab, { margin, dread });
      const rev = p.dir >= 0 && d === ((p.dir + 2) & 3);
      if (!rev && key === last) return now + wait;   // one decision a tile, and a turn about whenever the way ahead is lost
      last = key;
      if (rng() < err) d = Math.floor(rng() * 4);
      if (d >= 0) s.act({ t: "ab_act", d });
      return now + wait;
    },
  };
}
function play(botOf, seed, { name = `점등${seed}`, hook } = {}) {
  const rng = mulberry(seed * 977 + 13), s = sim(name, seed), bot = botOf ? botOf(rng) : null, ab = s.p.ab;
  let nextTick = s.now + 100, wake = ab.runAt + 20, maxBytes = 0, seq = 0, caught = 0, big = 0, eaten = 0, clears = 0;
  while (s.now < ab.endAt + 100) {
    if (bot && wake <= nextTick) { s.now = wake; wake = Math.max(wake + 1, bot.step(s, wake)); }
    else {
      s.now = nextTick;
      const v = s.tick(0);
      nextTick += 100;
      const ev = ab.g.ev;
      if (ev[0] !== seq) { seq = ev[0]; if (ev[1] === 2) caught++; else if (ev[1] === 1) big++; else if (ev[1] === 4) eaten++; else if (ev[1] === 3) clears++; }
      if (v.ab && v.ab[7]) maxBytes = Math.max(maxBytes, JSON.stringify(v.ab[7]).length);
      if (hook) hook(s, v);
    }
  }
  return { score: ab.score, grade: X.albaGrade("lamp", ab.score), clears, lv: ab.g.lv, caught, big, eaten, maxBytes, maxCombo: ab.maxCombo, state: ab.state };
}

// (c) the bots
const BOTS = {
  perfect: (rng) => pacBot(rng, { margin: 0.6, dread: 7, err: 0, poll: 50 }),
  strong: (rng) => pacBot(rng, { lat: [100, 220], margin: 1.5, dread: 8, err: 0.03 }),
  human: (rng) => pacBot(rng, { lat: [150, 400], margin: 1.5, dread: 6, err: 0.1 }),
  casual: (rng) => pacBot(rng, { lat: [300, 700], margin: 1, dread: 4, err: 0.2 }),
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
console.log(`lamp: par ${PAR}  (C ${Math.round(PAR * T.cuts[0])} B ${Math.round(PAR * T.cuts[1])} A ${Math.round(PAR * T.cuts[2])} S ${PAR})`);
for (const [nm, rs] of Object.entries(results)) console.log(`  ${nm.padEnd(8)} scores ${rs.map((r) => r.score).join(" ")}  grades ${rs.map((r) => "-CBAS"[r.grade]).join("")}  alleys ${rs.map((r) => r.clears).join(",")}  caught ${rs.map((r) => r.caught).join(",")} big ${rs.map((r) => r.big).join(",")} shadows ${rs.map((r) => r.eaten).join(",")} combo ${rs.map((r) => r.maxCombo).join(",")}  avg ${avg(rs.map((r) => r.score))} = ${(avg(rs.map((r) => r.score)) / PAR).toFixed(2)} par  (${rs.ms} ms)`);
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
  const c = play(BOTS.human, 3, { name: "점등다른" });
  assert.notDeepEqual([c.score, c.caught, c.big], [a.score, a.caught, a.big], "another seed plays differently");
  const alleys = (bot) => { const out = []; let last = -1; play(bot, 4, { hook: (s) => { const g = s.p.ab.g; if (g.lv !== last && out.length < 3) { last = g.lv; out.push(JSON.stringify(g.w)); } } }); return out; };
  { const A = alleys(BOTS.perfect), B = alleys(BOTS.casual), n = Math.min(A.length, B.length); assert.ok(n >= 1); assert.deepEqual(A.slice(0, n), B.slice(0, n), "the alleys are the seed's, whoever plays"); }
}

// (d) hostile input
{
  const s = sim("점등해커", 2), ab = s.p.ab, g = ab.g;
  const snap = () => JSON.stringify(g);
  const junk = [{}, { d: "1" }, { d: 1.5 }, { d: -1 }, { d: 4 }, { d: 1e300 }, { d: NaN }, { d: Infinity }, { d: null }, { d: [1] }, { d: { a: 1 } }, { d: true }, { d: "__proto__" }, { d: "0" }, { d: -0.0001 },
    { x: 5, y: 5 }, { k: "pipe" }, { d: 9, x: 99, y: -3 }, { want: 1, d: 7 }, { g: { pl: 0 } }, { d: [0] }, { d: () => 0 }];
  s.act({ t: "ab_act", d: 0 });
  const before = snap();
  for (let i = 0; i < 2; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; }
  assert.equal(snap(), before, "the brief ignores every input");
  s.tick(T.briefMs + 1200);
  for (let i = 0; i < 3; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; assert.doesNotThrow(() => s.tick(0)); }
  assert.equal(g.want, -1, "no junk was queued"); assert.deepEqual(tile(ab), [7, 13, 7, 13], "and nobody moved"); assert.equal(ab.score, 0, "hostile input scores nothing");
  // spam inside the rate limit
  let acc = 0, last = ab.lastAct;
  for (let i = 0; i < 60; i++) { s.now += 5; s.act({ t: "ab_act", d: i % 4 }); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.ok(acc <= 9, `60 inputs in 300 ms: only those ${acc} 35 ms apart reached the game`);
  acc = 0; last = ab.lastAct; s.now += 400;
  for (let i = 0; i < 50; i++) { s.act({ t: "ab_act", d: 3 }); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.equal(acc, 1, "50 inputs in the same instant: one counts");
  // a random player for the whole shift: everybody stays on open tiles, the pellet count is true, the score never drops below 0
  const rng = mulberry(99), s2 = sim("점등술꾼", 3), ab2 = s2.p.ab, g2 = ab2.g;
  s2.tick(T.briefMs + 100);
  for (let i = 0; s2.now < ab2.endAt - 300; i++) {
    s2.now += 40 + Math.floor(rng() * 160); s2.act({ t: "ab_act", d: Math.floor(rng() * 4) });
    if (i % 2 === 0) s2.tick(0);
    for (const e of [g2.pl, ...g2.sh]) assert.ok(X.lampOpen(g2, e.x, e.y) && X.lampOpen(g2, e.tx, e.ty) && e.pr >= 0 && e.pr < K.UNIT, `an entity is on the alley (${e.x},${e.y})->(${e.tx},${e.ty}) pr ${e.pr}`);
    assert.ok(ab2.score >= 0 && g2.left === g2.pel.filter((v) => v).length && g2.pend >= 0 && g2.pend < K.GROUP, "counts are true");
  }
  // after the end nothing moves
  s.tick(T.runMs + 1000);
  assert.equal(ab.state, "end");
  const done = snap(), sc = ab.score;
  for (const d of [0, 1, 2, 3]) { s.now += 50; s.act({ t: "ab_act", d }); }
  assert.equal(snap(), done, "after the end the alley is frozen"); assert.equal(ab.score, sc);
}

// (e) the server's cost: 240 simulated seconds, 10 ticks/s, a turn every 150 ms
{
  const s = sim("점등부하", 7), ab = s.p.ab, rng = mulberry(5);
  let ms = 0, views = 0, bytes = 0, vmax = 0, sent = 0;
  for (let i = 0; i < (T.briefMs + T.runMs) / 100; i++) {
    if (i % 3 !== 2) s.act({ t: "ab_act", d: Math.floor(rng() * 4) });
    const t0 = performance.now();
    const v = s.tick(100);
    ms += performance.now() - t0; views++;
    if (v.ab && v.ab[7]) { const b = JSON.stringify(v.ab[7]).length; bytes += b; sent++; vmax = Math.max(vmax, b); }
  }
  console.log(`  server: ${views} ticks + views in ${ms.toFixed(1)} ms (${(ms / 4.1).toFixed(2)} ms per simulated minute) · ${sent} views, max ${vmax} B, avg ${Math.round(bytes / Math.max(1, sent))} B`);
  assert.ok(ms / 4.1 < 100, "far below 100 ms per simulated minute");
  assert.equal(ab.state, "end");
}

console.log("alba-lamp: ok");
