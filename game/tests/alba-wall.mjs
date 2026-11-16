// 일일 아르바이트 · 철거 알바 (67-alba-wall.js): an Arkanoid-style brick breaker on a fixed 50 ms step with integer ball physics. Unit tests of the rules (reflections at
// the walls, the paddle's edge angles, brick faces and corners, brick kinds, items, wall clear, ball loss, the rush), determinism (also across tick rates), hostile
// input, the view's size, the server's cost, and bots that play whole shifts through the real tick / viewFor / action path to tune `par`.
// node tests/alba-wall.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, WALL, wallStep, wallBall, wallBuild, wallSpeed, wallHeld, albaGrade };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, R = X.ALBA_RULES.wall, W = X.WALL, T = X.ALBA_T;
const PAR = X.ALBA.wall.par;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const C = W.COLS;

// ── unit harness: a bare shift object, no world
const mkAb = (seed = 7, endAt = 1e9) => {
  const ab = { k: "wall", box: { seed }, runAt: 0, endAt, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null };
  R.init(null, null, ab);
  return ab;
};
const step = (ab, n = 1) => { for (let i = 0; i < n; i++) { ab.g.simAt += W.STEP; X.wallStep(ab, ab.g.simAt); } };
/** An empty field with one far-away brick (so the wall is not "cleared"), the ball waiting to be placed. */
const bare = (seed = 7) => {
  const ab = mkAb(seed), g = ab.g;
  g.k.fill(0); g.h.fill(0); g.it.fill(0); g.left = 0; g.sv = 1e9; g.balls = [X.wallHeld(g)];   // a ball that never gets served
  brick(ab, 0, 11);
  return ab;
};
const brick = (ab, r, c, kind = 1, hp = 1, it = 0) => { const g = ab.g, i = r * C + c; if (!g.k[i]) g.left++; g.k[i] = kind; g.h[i] = hp; g.it[i] = it; };
const ball = (px, py, dx, dy) => ({ x: px * 16, y: py * 16, dx, dy, held: 0 });
const gone = (ab, r, c) => ab.g.k[r * C + c] === 0;

// ── the wall: shapes, hard bricks, bombs and bonus boxes by wall number
{
  const ab = mkAb(), g = ab.g;
  assert.equal(g.lv, 0); assert.equal(g.left, 96, "the first wall is the full 12 × 8");
  const kinds = (a) => [1, 2, 3].map((k) => a.g.k.filter((v) => v === k).length);
  assert.deepEqual(kinds(ab).slice(1), [2, 4], "two bombs and four bonus boxes in the first wall");
  assert.ok(g.k.slice(96).every((v) => v === 0), "the ninth row is empty until the rush");
  assert.ok(g.h.every((h, i) => (g.k[i] ? h >= 1 && h <= 3 : h === 0)), "hits left are 1-3 on bricks");
  const hard = (a) => a.g.h.filter((h, i) => a.g.k[i] === 1 && h > 1).length;
  const items = g.it.filter((v, i) => g.k[i] === 3);
  assert.ok(items.every((v) => v >= 0 && v <= 3));
  const counts = [], hards = [];
  for (let lv = 0; lv < 12; lv++) { const a = mkAb(3); a.g.lv = lv; X.wallBuild(a); counts.push(a.g.left); hards.push(hard(a)); assert.ok(a.g.left > 20, "every wall has bricks"); assert.equal(a.g.left, a.g.k.filter((v) => v).length); }
  assert.deepEqual(counts.slice(0, 5).map((n, i) => n === counts[i + 5]), [true, true, true, true, true], "the shapes repeat every five walls");
  assert.ok(new Set(counts.slice(0, 5)).size >= 4, "five different shapes");
  assert.ok(hards.slice(8).reduce((a, b) => a + b, 0) > hards.slice(0, 4).reduce((a, b) => a + b, 0), "later walls are harder");
  const a6 = mkAb(3); a6.g.lv = 6; X.wallBuild(a6); assert.equal(a6.g.k.filter((v) => v === 2).length, 8, "bombs grow to eight");
  assert.equal(X.wallSpeed({ lv: 0, fs: 0 }), 40); assert.equal(X.wallSpeed({ lv: 4, fs: 0 }), 56); assert.equal(X.wallSpeed({ lv: 99, fs: 0 }), 56, "the speed stops at wall 5"); assert.equal(X.wallSpeed({ lv: 0, fs: 5 }), 28, "slow ball ×0.7");
  const same = (s) => { const a = mkAb(s); return a.g.k.join("") + a.g.h.join("") + a.g.it.join(""); };
  assert.equal(same(5), same(5)); assert.notEqual(same(5), same(6), "a seed makes a wall");
  // the served ball rides the paddle and goes off after 1.5 s at one of four angles
  assert.equal(g.balls.length, 1); assert.equal(g.balls[0].held, 1); assert.equal(g.sv, W.SERVE);
  R.act(null, null, ab, { x: 200 }, 1); step(ab, 10); assert.equal(g.balls[0].x, g.pad.x * 16, "the held ball follows the paddle");
  step(ab, W.SERVE - 10 - 1); assert.equal(g.balls[0].held, 1); step(ab);
  assert.equal(g.balls[0].held, 0, "served"); assert.ok([-26, -13, 13, 26].includes(g.balls[0].dx) && g.balls[0].dy < 0);
}

// ── the paddle: intent, speed cap, bounds, wide
{
  const ab = bare(), g = ab.g, pad = g.pad;
  assert.equal(R.act(null, null, ab, { x: 220 }, 1), null);
  step(ab); assert.equal(pad.x, 130, "10 px per step at most"); assert.equal(pad.vx, 10);
  step(ab, 20); assert.equal(pad.x, 220, "and it stops at the target");
  R.act(null, null, ab, { x: 240 }, 2); step(ab, 5); assert.equal(pad.x, 220, "the paddle's edge stays inside the field (centre ≤ 240 − 20)");
  R.act(null, null, ab, { x: 0 }, 3); step(ab, 40); assert.equal(pad.x, 20);
  g.fw = 100; step(ab); assert.equal(pad.hw, 32); assert.equal(pad.x, 32, "a wide paddle is pushed inside");
  g.fw = 0; step(ab); assert.equal(pad.hw, 20);
}

// ── ball against the side walls and the ceiling
{
  const ab = bare(), g = ab.g;
  g.balls = [ball(232, 150, 64, -16)]; step(ab, 2);
  assert.ok(g.balls[0].dx < 0, "off the right wall"); assert.ok(g.balls[0].x <= 240 * 16 - 48);
  g.balls = [ball(8, 150, -64, 16)]; step(ab, 2); assert.ok(g.balls[0].dx > 0, "off the left wall"); assert.ok(g.balls[0].x >= 48);
  g.balls = [ball(120, 8, 20, -60)]; step(ab, 2); assert.ok(g.balls[0].dy > 0, "off the ceiling"); assert.ok(g.balls[0].y >= 48);
  // a flat ball is tilted: no endless horizontal rally
  g.balls = [ball(120, 150, 64, 0)]; step(ab); assert.ok(Math.abs(g.balls[0].dy) >= 16);
}

// ── the paddle: centre goes straight up, the edges send the ball out at an angle, a miss falls out
{
  const hit = (padX, ballX) => {
    const ab = bare(), g = ab.g;
    g.pad.x = padX; g.pad.tx = padX; g.balls = [ball(ballX, 202, 0, 64)];
    step(ab, 4);
    return g.balls[0];
  };
  let b = hit(120, 120); assert.deepEqual([b.dx, b.dy], [0, -64], "the centre: straight up");
  b = hit(120, 100); assert.ok(b.dx < 0 && b.dy < 0, "left of the centre: to the left");
  b = hit(120, 140); assert.ok(b.dx > 0 && b.dy < 0, "right of the centre: to the right");
  const left = hit(120, 99), right = hit(120, 141);
  assert.ok(left.dx <= -48 && right.dx >= 48, "the edges: 48°-60° out"); assert.ok(left.dx === -right.dx, "symmetric");
  const mid = hit(120, 112); assert.ok(mid.dx < 0 && mid.dx > left.dx, "the angle grows towards the edge");
  const dxs = [100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140].map((x) => hit(120, x).dx);
  assert.ok(dxs.every((v, i) => i === 0 || v >= dxs[i - 1]), "monotone from the left edge to the right"); assert.equal(new Set(dxs).size >= 7, true);
  const ab = bare(); ab.g.pad.x = 60; ab.g.pad.tx = 60; ab.g.balls = [ball(150, 202, 0, 64)]; ab.score = 200; ab.combo = 3;
  step(ab, 14);
  assert.equal(ab.score, 150, "a lost ball: −50"); assert.equal(ab.combo, 0, "the combo breaks");
  assert.equal(ab.g.balls.length, 1); assert.equal(ab.g.balls[0].held, 1, "the next ball waits on the paddle"); assert.ok(ab.g.sv > 0 && ab.g.sv <= W.RESERVE, "re-served after 3 s");
  assert.equal(ab.g.ev.some((e) => e[1] === 5), true);
  const ab2 = bare(); ab2.g.balls = [ball(150, 202, 0, 64)]; ab2.g.pad.x = 20; ab2.g.pad.tx = 20; step(ab2, 14); assert.equal(ab2.score, 0, "never below 0");
  // re-serve timing: exactly 60 steps after the loss, then it flies
  const ab3 = bare(); R.act(null, null, ab3, { x: 20 }, 0); ab3.g.pad.x = 20; ab3.g.pad.tx = 20; ab3.g.balls = [ball(150, 210, 0, 64)];
  let n = 0; while (ab3.g.balls[0].held !== 1 && n < 40) { step(ab3); n++; }
  const sv = ab3.g.sv; step(ab3, sv - 1); assert.equal(ab3.g.balls[0].held, 1); step(ab3); assert.equal(ab3.g.balls[0].held, 0, "launched when the timer runs out");
}

// ── bricks: faces and corners
{
  // from below: the ball turns back down and the brick breaks (+10)
  let ab = bare(); brick(ab, 3, 5); ab.g.balls = [ball(110, 70, 0, -64)];
  step(ab, 4); assert.ok(gone(ab, 3, 5), "the brick breaks"); assert.ok(ab.g.balls[0].dy > 0, "and the ball comes back down"); assert.equal(ab.score, 10);
  // from above
  ab = bare(); brick(ab, 3, 5); ab.g.balls = [ball(110, 40, 0, 64)]; step(ab, 4);
  assert.ok(gone(ab, 3, 5)); assert.ok(ab.g.balls[0].dy < 0, "off the top face");
  // from the left, sideways: off the left face
  ab = bare(); brick(ab, 3, 5); ab.g.balls = [ball(90, 56, 64, 16)]; step(ab, 4);
  assert.ok(gone(ab, 3, 5)); assert.ok(ab.g.balls[0].dx < 0, "off the left face"); assert.ok(ab.g.balls[0].dy > 0, "its vertical direction stays");
  ab = bare(); brick(ab, 3, 5); ab.g.balls = [ball(130, 56, -64, 16)]; step(ab, 4);
  assert.ok(gone(ab, 3, 5)); assert.ok(ab.g.balls[0].dx > 0, "off the right face");
  // a corner: a diagonal into the top-left corner turns both ways
  ab = bare(); brick(ab, 3, 5); ab.g.balls = [ball(93, 45, 45, 45)];
  let flips = 0; for (let i = 0; i < 6 && !gone(ab, 3, 5); i++) step(ab);
  assert.ok(gone(ab, 3, 5)); const cb = ab.g.balls[0]; assert.ok(cb.dx < 0 && cb.dy < 0, "a corner hit turns the ball back the way it came"); void flips;
  // the ball never ends up inside a brick, whatever the angle and speed
  for (const [dx, dy] of [[64, 16], [50, 40], [30, 56], [-55, 32], [-20, -60], [10, -63], [63, -16]]) for (const lv of [0, 4]) {
    const a = bare(); a.g.lv = lv; for (let c = 2; c < 10; c++) for (let r = 2; r < 6; r++) brick(a, r, c);
    a.g.balls = [ball(120, 120, dx, dy)];
    for (let i = 0; i < 60; i++) { step(a); for (const b of a.g.balls) { const c = Math.floor(b.x / (W.BW * 16)), r = Math.floor((b.y / 16 - W.Y0) / W.BH); if (r >= 0 && r < 9 && c >= 0 && c < 12) assert.equal(a.g.k[r * C + c], 0, `the ball centre is never in a brick (${dx},${dy},lv${lv})`); } if (!a.g.balls.length) break; }
  }
}

// ── brick kinds: hard bricks, bombs, bonus boxes
{
  let ab = bare(); brick(ab, 3, 5, 1, 3); ab.g.balls = [ball(110, 70, 0, -64)];
  step(ab, 3); assert.equal(ab.g.h[3 * C + 5], 2, "a three-hit brick: first hit"); assert.equal(ab.score, 5, "a crack is worth 5");
  assert.equal(ab.g.ev.at(-1)[1], 2, "an event says it cracked"); assert.equal(ab.g.ev.at(-1)[4], 2);
  ab.g.balls = [ball(110, 70, 0, -64)]; step(ab, 4); assert.equal(ab.g.h[3 * C + 5], 1);
  ab.g.balls = [ball(110, 70, 0, -64)]; step(ab, 4); assert.ok(gone(ab, 3, 5), "the third hit breaks it"); assert.ok(ab.score >= 5 + 5 + 10);
  // a bomb takes its neighbours with it (and a bomb next to it too); the whole blow scores once
  ab = bare(); brick(ab, 3, 5, 2); brick(ab, 2, 4); brick(ab, 2, 5, 1, 3); brick(ab, 3, 6); brick(ab, 4, 6, 2); brick(ab, 5, 7); brick(ab, 3, 7); brick(ab, 6, 9);
  const left0 = ab.g.left; ab.g.balls = [ball(110, 70, 0, -64)]; step(ab, 4);
  for (const [r, c] of [[3, 5], [2, 4], [2, 5], [3, 6], [4, 6], [5, 7], [3, 7]]) assert.ok(gone(ab, r, c), `the blast reaches ${r},${c}`);
  assert.ok(!gone(ab, 6, 9), "a brick two cells away stays"); assert.equal(ab.g.left, left0 - 7);
  assert.equal(ab.score, 20 + 20 + 10 * 5, "bombs 20 each, bricks 10"); assert.equal(ab.combo, 1, "one blow, one combo step"); assert.ok(ab.g.ev.some((e) => e[1] === 3));
  // a bonus box: breaks for 30 and drops its item, which falls 3 px per step
  ab = bare(); brick(ab, 3, 5, 3, 1, 2); ab.g.balls = [ball(110, 70, 0, -64)]; step(ab, 4);
  assert.equal(ab.score, 30); assert.equal(ab.g.I.length, 1); assert.equal(ab.g.I[0].k, 2, "the item is the box's"); assert.ok(ab.g.ev.some((e) => e[1] === 8 && e[4] === 2));
  const y0 = ab.g.I[0].y; step(ab, 3); assert.equal(ab.g.I[0].y - y0, 9, "3 px per step");
  // the chain: bricks hit one after another without touching the paddle are worth more (+20 % each, up to +100 %)
  ab = bare(); for (let c = 0; c < 8; c++) brick(ab, 3 + (c % 2), 1 + c); ab.g.balls = [ball(30, 70, 0, -64)];
  ab.g.ch = 0; const s0 = ab.score;
  ab.g.ch = 5; X.wallStep; ab.g.balls = [ball(30, 70, 0, -64)]; step(ab, 4);
  assert.equal(ab.score - s0, 20, "chain ×2 at 5: a plain brick is worth 20 at combo 0");
}

// ── items: caught by the paddle
{
  const catchIt = (k, setup) => {
    const ab = bare(); const g = ab.g; g.pad.x = 100; g.pad.tx = 100;
    g.balls = [ball(30, 120, 20, -60)]; g.I.push({ x: 104, y: 210, k });
    if (setup) setup(ab);
    step(ab, 4); return ab;
  };
  let ab = catchIt(0); assert.equal(ab.g.I.length, 0); assert.ok(ab.g.fw > 200, "wide paddle for 12 s"); assert.equal(ab.score, 30, "+30"); assert.equal(ab.g.pad.hw, 32);
  assert.ok(ab.g.ev.some((e) => e[1] === 4 && e[4] === 0));
  ab = catchIt(2); assert.ok(ab.g.fp > 100, "piercing for 8 s");
  ab = catchIt(3); assert.ok(ab.g.fs > 150, "slow ball for 10 s"); assert.equal(X.wallSpeed(ab.g), 28);
  ab = catchIt(1); assert.equal(ab.g.balls.length, 3, "three balls");
  const dirs = ab.g.balls.map((b) => [b.dx, b.dy]); assert.equal(new Set(dirs.map(String)).size, 3, "in three directions");
  ab = catchIt(1, (a) => { a.g.balls.push(ball(60, 100, 10, -60), ball(90, 100, -10, -60)); }); assert.equal(ab.g.balls.length, 3, "no more than three");
  // a missed item just falls away
  ab = bare(); ab.g.pad.x = 20; ab.g.pad.tx = 20; ab.g.balls = [ball(200, 100, 0, -16)]; ab.g.I.push({ x: 150, y: 190, k: 0 }); step(ab, 20);
  assert.equal(ab.g.I.length, 0); assert.equal(ab.g.fw, 0); assert.equal(ab.score, 0);
  // a ball lost clears the power-ups
  ab = bare(); ab.g.fw = 100; ab.g.fp = 100; ab.g.fs = 100; ab.g.pad.x = 20; ab.g.pad.tx = 20; ab.g.balls = [ball(150, 210, 0, 64)]; step(ab, 12);
  assert.deepEqual([ab.g.fw, ab.g.fp, ab.g.fs], [0, 0, 0]);
  // multi-ball: losing one of three is not a loss
  ab = bare(); ab.score = 100; ab.g.pad.x = 20; ab.g.pad.tx = 20; ab.g.balls = [ball(150, 210, 0, 64), ball(100, 150, 0, -16), ball(60, 150, 0, -16)]; step(ab, 12);
  assert.equal(ab.score, 100, "no penalty while a ball is still in play"); assert.equal(ab.g.balls.length, 2);
}

// ── piercing and the fever's big ball go through everything
{
  let ab = bare(); ab.g.fp = 100; brick(ab, 3, 5, 1, 3); brick(ab, 4, 5, 1, 2); brick(ab, 5, 5); ab.g.balls = [ball(110, 95, 0, -64)]; step(ab, 9);
  assert.ok(gone(ab, 5, 5) && gone(ab, 4, 5) && gone(ab, 3, 5), "a piercing ball breaks the whole column, hard bricks too");
  assert.ok(ab.g.balls[0].dy < 0 && ab.g.balls[0].y < 50 * 16, "and flies on");
  ab = bare(); ab.feverUntil = 1e9; brick(ab, 3, 5, 1, 3); ab.g.balls = [ball(110, 70, 0, -64)]; step(ab, 4);
  assert.ok(gone(ab, 3, 5), "the fever's big ball pierces"); assert.equal(R.view(ab, ab.g.simAt)[8], 1, "and the view says so");
  // the big ball touches bricks the small one would miss (radius 5 vs 3)
  const small = bare(); brick(small, 3, 5); small.g.balls = [ball(97, 70, 0, -64)]; step(small, 4); assert.ok(!gone(small, 3, 5), "radius 3 passes by 3 px off the brick's side");
  const big = bare(); big.feverUntil = 1e9; brick(big, 3, 5); big.g.balls = [ball(97, 70, 0, -64)]; step(big, 4); assert.ok(gone(big, 3, 5), "radius 5 reaches it");
}

// ── clearing the wall: +150, a new and harder wall, a faster ball
{
  const ab = bare(), g = ab.g; g.k.fill(0); g.left = 0; brick(ab, 3, 5); g.balls = [ball(110, 70, 0, -64)]; g.I.push({ x: 10, y: 100, k: 0 }); g.fw = 50;
  step(ab, 4);
  assert.equal(g.lv, 1, "the next wall"); assert.equal(ab.score, 10 + Math.round(150 * 1.1), "10 for the brick, 150 for the wall at combo 1 (x1.1)");
  assert.ok(g.left > 20 && g.left === g.k.filter((v) => v).length); assert.equal(g.I.length, 0); assert.equal(g.fw, 0);
  assert.equal(g.balls.length, 1); assert.equal(g.balls[0].held, 1); assert.ok(g.sv > 0 && g.sv <= W.SERVE, "served again after 1.5 s");
  assert.ok(g.ev.some((e) => e[1] === 6)); assert.equal(X.wallSpeed(g), 44);
}
{
  const ab = bare(); ab.g.k.fill(0); ab.g.left = 0; brick(ab, 3, 5); ab.g.balls = [ball(110, 70, 0, -64)]; step(ab, 4);
  assert.equal(ab.score, 10 + Math.round(150 * 1.1), "the brick, then the wall at combo 1");
}

// ── the rush: the wall comes down a row, and new walls start low
{
  const ab = mkAb(5, 200000); const g = ab.g;
  g.sv = 1e6;
  const before = g.k.slice(0, 96);
  ab.g.simAt = 200000 - T.rushMs - 2 * W.STEP; step(ab);
  assert.equal(g.drop, 0, "not yet");
  step(ab); assert.equal(g.drop, 1, "the rush has begun: the wall drops");
  assert.deepEqual(g.k.slice(12, 108), before, "every brick one row lower"); assert.ok(g.k.slice(0, 12).every((v) => v === 0));
  const left = g.left; step(ab, 5); assert.equal(g.left, left, "once");
  g.lv = 1; X.wallBuild(ab); assert.ok(g.k.slice(0, 12).every((v) => v === 0), "the next wall is built low too");
  assert.ok(g.k.slice(96).some((v) => v), "its last row is on the ninth line"); assert.equal(g.k.length, 108);
}

// ── a long stall just skips ahead; slow and fast callers agree
{
  const ab = mkAb(); R.adv(null, null, ab, 1e9);
  assert.ok(ab.g.simAt > 1e8 && ab.g.simAt % W.STEP === 0); assert.ok(ab.g.n <= 40);
  const a2 = mkAb(), a3 = mkAb(); R.act(null, null, a2, { x: 80 }, 0); R.act(null, null, a3, { x: 80 }, 0);
  for (let t = 0; t <= 1900; t += 100) R.adv(null, null, a2, t); R.adv(null, null, a3, 1900);
  assert.equal(JSON.stringify(a2.g), JSON.stringify(a3.g)); const rev = a2.rev; R.adv(null, null, a2, 1910); assert.equal(a2.rev, rev, "less than a step later: nothing new");
}

// ── view: shape, JSON, ms from now
{
  const ab = mkAb(), g = ab.g; step(ab, 3);
  const v = R.view(ab, g.simAt + 20);
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v, "plain JSON");
  assert.equal(v[0], 1); assert.equal(v[2].length, 108); assert.ok(/^[.123bwmps]+$/.test(v[2])); assert.equal(v[7], 96);
  assert.equal(v[3].length, 5, "one ball: x y vx vy held"); assert.equal(v[3][4], 1); assert.equal(v[5][3], (W.SERVE - 3) * 50 - 20, "serve ms, from now");
  assert.deepEqual(v[1], [120, 0, 20]);
  g.sv = 0; g.balls = [ball(100.4, 150.6, 20, -60)]; assert.deepEqual(R.view(ab, g.simAt).slice(3, 4)[0].slice(0, 2), [100, 151], "positions are whole pixels");
}

// ── whole shifts through the real engine
const sim = (name, seed = 1, stepMs = 100) => {
  const S = L.setup();
  let now = 5_000_000 + seed * 7919;
  S.now = now;
  L.addPlayer(S, "p1", L.hero(name, { wk: "sword", lvl: 30, migrate: true }));
  const p = S.players.p1;
  const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
  assert.ok(act({ t: "ab_start", k: "wall" }).ok);
  return {
    S, p, act, get now() { return now; }, set now(v) { now = v; },
    tick(ms = stepMs) { now += ms; S.now = now; L.tick(S, now); const v = L.viewFor(S, "p1"); L.endTick(S); return v; },
  };
};
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ── the bots' eyes. An oracle reads the server state and rolls a copy of it forward with the rules' own functions to see where each ball lands;
// any other bot reads the wire (a tick old at best) and extrapolates in straight lines, ignoring the bricks.
const PYQ = W.PY * 16;
function landings(ab) {   // for each flying ball: { t (steps), x (px) where it reaches the paddle line }, the paddle taken out of the way
  const c = structuredClone(ab), g = c.g, out = [], T0 = g.simAt;
  g.balls.forEach((b) => {
    if (b.held) return;
    for (let k = 1; k <= 70; k++) {
      const x0 = b.x, y0 = b.y, R_ = (T0 + k * W.STEP < c.feverUntil ? 5 : 3) * 16;
      g.pad.hw = -100;
      const alive = X.wallBall(c, T0 + k * W.STEP, b);
      if (!alive || (b.dy > 0 && b.y + R_ >= PYQ)) { const f = clamp((PYQ - R_ - y0) / Math.max(1, b.y - y0), 0, 1); out.push({ t: k - 1 + f, x: (x0 + (b.x - x0) * f) / 16 }); return; }
    }
  });
  return out.sort((a, b) => a.t - b.t);
}
/** Where on the paddle to meet a ball arriving at x so that it flies at a good brick (the lowest ones, specials first). */
function aimFor(g, xl, hw) {
  let best = null;
  for (let i = 0; i < g.k.length; i++) {
    if (!g.k[i]) continue;
    const r = (i / C) | 0, bx = (i % C) * W.BW + W.BW / 2, v = r * 8 + (g.k[i] === 3 ? 40 : g.k[i] === 2 ? 25 : 0) - 0.2 * Math.abs(bx - xl);
    if (!best || v > best.v) best = { v, bx, by: W.Y0 + r * W.BH + W.BH };
  }
  if (!best) return xl;
  const ratio = (best.bx - xl) / Math.max(40, W.PY - best.by);
  let idx = 5, err = 1e9;
  W.TAB.forEach(([dx, dy], i) => { const e = Math.abs(dx / dy - ratio); if (e < err) { err = e; idx = i; } });
  return clamp(xl - ((idx - 5) / 5) * (hw + 3), hw, W.W - hw);
}
function decideOracle(ab, o, rng) {
  const g = ab.g, pad = g.pad, hw = g.fw > 0 ? W.HW[1] : W.HW[0];
  if (g.sv > 0) return 120;
  const ls = landings(ab);
  let tx = pad.x;
  if (ls.length) {
    const l = ls[0];
    const st = o.st;
    if (l.t > st.t + 2) {   // a new ball: a new angle off the paddle (a random one, or, when few bricks are left, one that flies at a brick that is still there)
      st.h = rng() * 1.8 - 0.9;
      if (g.left <= 20) {
        const alive = [];
        for (let i = 0; i < g.k.length; i++) if (g.k[i]) alive.push(i);
        const i = alive[Math.floor(rng() * alive.length)], ratio = ((i % C) * W.BW + W.BW / 2 - l.x) / Math.max(40, W.PY - (W.Y0 + ((i / C) | 0) * W.BH + W.BH));
        let e0 = 1e9;
        W.TAB.forEach(([dx, dy], j) => { const e = Math.abs(dx / dy - ratio); if (e < e0) { e0 = e; st.h = (j - 5) / 5; } });
      }
    }
    st.t = l.t;
    tx = o.aim === "rand" ? clamp(l.x - st.h * (hw + 3), hw, W.W - hw) : o.aim ? aimFor(g, l.x, hw) : l.x;
    for (const it of g.I) {   // an item on the way down: fetch it when the ball leaves time for it
      const ti = (W.PY - 4 - it.y) / W.FALL, d1 = Math.abs(it.x - pad.x) / W.PSPD, d2 = Math.abs(it.x - l.x) / W.PSPD;
      if (d1 <= ti - 1 && d1 + d2 + 3 < l.t) { tx = it.x; break; }
    }
  }
  return clamp(Math.round(tx), 0, W.W);
}
/** What a player sees on the wire: where the ball lands if nothing is in the way (a straight line off the side walls). */
function decideWire(w, age, o, rng) {
  const [lv, pad, bricks, B, I] = w, hw = pad[2];
  const balls = []; for (let i = 0; i < B.length; i += 5) balls.push({ x: B[i], y: B[i + 1], vx: B[i + 2] / 4, vy: B[i + 3] / 4, held: B[i + 4] });
  if (balls.every((b) => b.held)) return 120;
  let best = null;
  for (const b of balls) {
    if (b.held) continue;
    let x, t;
    if (b.vy > 0.5) {
      t = (W.PY - 3 - b.y) / b.vy - age; x = b.x + b.vx * (t + age);
      x = ((x % 456) + 456) % 456; x = x > 234 ? 468 - x : x < 3 ? 3 : x; x = clamp(x, 3, 237);   // folded between the side walls
    } else { t = 1e9; x = b.x; }
    if (!best || t < best.t) best = { t, x };
  }
  let tx = best.x;
  if (best.t > 30) tx = best.x;   // the ball is on its way up: stay under it
  for (let i = 0; i < I.length; i += 3) {   // an item, if there is time
    const ti = (W.PY - 4 - I[i + 1]) / W.FALL, d1 = Math.abs(I[i] - pad[0]) / W.PSPD;
    if (rng() < o.items && d1 <= ti - 1 && best.t > d1 + Math.abs(I[i] - best.x) / W.PSPD + 4) { tx = I[i]; break; }
  }
  if (rng() < o.miss) tx += (rng() < 0.5 ? -1 : 1) * (hw + 12 + rng() * 30);
  tx += (rng() - 0.5) * 2 * o.err + (o.edge ? (rng() - 0.5) * hw * 1.2 : 0);
  return clamp(Math.round(tx), 0, W.W);
}
function mkBot(rng, o0) {
  const o = { ...o0, st: { t: 1e9, h: 0 } };
  let wire = null, wireAt = 0;
  return {
    delay: () => o.gap[0] + rng() * (o.gap[1] - o.gap[0]),
    seen(v, t) { if (v && v.ab && v.ab[7]) { wire = v.ab[7]; wireAt = t; } },
    step(s, send) {
      let x;
      if (o.oracle) x = decideOracle(s.p.ab, o, rng); else { if (!wire) return false; x = decideWire(wire, (s.now - wireAt) / W.STEP, o, rng); }
      return send({ x });
    },
  };
}
function play(botOpts, seed, { name = `철거${seed}`, hook, stepMs = 100 } = {}) {
  const rng = mulberry(seed * 977 + 13), s = sim(name, seed, stepMs), bot = mkBot(rng, botOpts), ab = s.p.ab;
  let nextTick = s.now + stepMs, nextBot = ab.runAt + 100, maxBytes = 0, sumBytes = 0, views = 0, seq = 0, lost = 0, items = 0, boxes = 0;
  const send = (a) => { const v = s.act({ t: "ab_act", ...a }); if (!v.ok) throw new Error("refused " + JSON.stringify(v)); return true; };
  while (s.now < ab.endAt + 100) {
    if (!botOpts.idle && nextBot <= nextTick) {
      s.now = nextBot;
      bot.step(s, send);
      nextBot = s.now + bot.delay();
    } else {
      s.now = nextTick;
      const v = s.tick(0);
      nextTick += stepMs;
      bot.seen(v, s.now);
      for (const e of ab.g.ev) if (e[0] > seq) { seq = e[0]; if (e[1] === 5) lost++; if (e[1] === 4) items++; if (e[1] === 6) boxes++; }
      if (v.ab && v.ab[7]) { const n = JSON.stringify(v.ab[7]).length; maxBytes = Math.max(maxBytes, n); sumBytes += n; views++; }
      if (hook) hook(s, v);
    }
  }
  return { score: ab.score, grade: X.albaGrade("wall", ab.score), walls: ab.g.lv, maxBytes, avgBytes: views ? Math.round(sumBytes / views) : 0, maxCombo: ab.maxCombo, state: ab.state, lost, items, fevers: ab.feverUsed, left: ab.g.left, views, boxes };
}

// (c) the bots
const BOTS = {
  perfect: { gap: [50, 50], oracle: true, aim: "rand" },
  strong: { gap: [100, 200], err: 2, miss: 0.02, items: 0.95, edge: true },
  human: { gap: [150, 400], err: 6, miss: 0.1, items: 0.7, edge: true },
  casual: { gap: [350, 800], err: 9, miss: 0.2, items: 0.35, edge: true },
  slow: { gap: [700, 1400], err: 14, miss: 0.3, items: 0.2, edge: true },
};
if (process.env.WALL_EXP) {   // tuning aid: WALL_EXP='{"gap":[150,400],...};{...}' node tests/alba-wall.mjs prints 3 seeds per bot and stops
  for (const e of process.env.WALL_EXP.split(";")) { const o = JSON.parse(e); const rs = [1, 2, 3].map((s) => play(o, s)); console.log(e, rs.map((r) => r.score).join(" "), "lost", rs.map((r) => r.lost).join(","), "walls", rs.map((r) => r.walls).join(","), "items", rs.map((r) => r.items).join(","), "left", rs.map((r) => r.left).join(",")); }
  process.exit(0);
}
const results = {};
let viewMax = 0, viewAvg = 0;
for (const [nm, o] of Object.entries(BOTS)) {
  results[nm] = [1, 2, 3, 4, 5].map((seed) => play(o, seed));
  for (const r of results[nm]) { assert.equal(r.state, "end"); viewMax = Math.max(viewMax, r.maxBytes); viewAvg = Math.max(viewAvg, r.avgBytes); }
}
const idle = play({ idle: true }, 9);
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(`wall: par ${PAR}  (C ${Math.round(PAR * T.cuts[0])} B ${Math.round(PAR * T.cuts[1])} A ${Math.round(PAR * T.cuts[2])} S ${PAR})`);
for (const [nm, rs] of Object.entries(results)) console.log(`  ${nm.padEnd(8)} scores ${rs.map((r) => r.score).join(" ")}  grades ${rs.map((r) => "-CBAS"[r.grade]).join("")}  walls ${rs.map((r) => r.walls).join(",")} lost ${rs.map((r) => r.lost).join(",")} items ${rs.map((r) => r.items).join(",")} combo ${rs.map((r) => r.maxCombo).join(",")}  avg ${avg(rs.map((r) => r.score))} = ${(avg(rs.map((r) => r.score)) / PAR).toFixed(2)} par`);
console.log(`  idle     score ${idle.score} grade ${"-CBAS"[idle.grade]} lost ${idle.lost}   view max ${viewMax} bytes (avg of the worst shift ${viewAvg})`);
assert.ok(results.perfect.every((r) => r.grade === 4), "the perfect bot reaches S every time");
{
  const m = avg(results.human.map((r) => r.score)) / PAR;
  assert.ok(m >= 0.65 && m < 0.95, `the human-like bot lands around B (${m.toFixed(2)} of par)`);
  const c = avg(results.casual.map((r) => r.score)) / PAR;
  assert.ok(c >= 0.38 && c < 0.7, `the casual bot lands around C (${c.toFixed(2)} of par)`);
}
assert.ok(avg(results.strong.map((r) => r.score)) > avg(results.human.map((r) => r.score)), "playing better scores more");
assert.ok(avg(results.human.map((r) => r.score)) > avg(results.casual.map((r) => r.score)), "playing worse scores less");
assert.ok(avg(results.casual.map((r) => r.score)) > avg(results.slow.map((r) => r.score)), "and worse still");
assert.equal(idle.grade, 0, "an idle player gets no grade");
assert.ok(viewMax < 700, `the view stays small (${viewMax} bytes)`);

// (a) determinism: the same seed and inputs give the same shift, whatever the tick rate; another seed plays differently
{
  const a = play(BOTS.human, 3), b = play(BOTS.human, 3);
  assert.deepEqual(a, b, "same seed and same inputs: the same shift");
  const c = play(BOTS.human, 3, { name: "철거다른" });
  assert.notDeepEqual([c.score, c.walls, c.lost], [a.score, a.walls, a.lost], "a different seed plays differently");
  const script = []; { const r = mulberry(5); for (let t = 6200; t < 6000 + 240000; t += 130) script.push([t, { x: Math.floor(r() * 241) }]); }
  const run = (stepMs) => {
    const s = sim("철거스크립트", 11, stepMs), ab = s.p.ab, t0 = s.now;
    let i = 0, nextTick = t0 + stepMs;
    while (s.now < ab.endAt + 50) {
      const ta = i < script.length ? t0 + script[i][0] : Infinity;
      if (ta <= nextTick) { s.now = ta; s.act({ t: "ab_act", ...script[i][1] }); i++; } else { s.now = nextTick; s.tick(0); nextTick += stepMs; }
    }
    return [ab.score, ab.g.lv, ab.g.n, JSON.stringify({ ...ab.g, simAt: 0 })];
  };
  const r100 = run(100); assert.ok(r100[0] > 0, "the script scores");
  assert.deepEqual(run(50), r100, "ticked at 50 ms: the same"); assert.deepEqual(run(230), r100, "ticked at 230 ms: the same");
  // the physics alone: the same ball, the same walls, the same path, step for step
  const path = (seed) => { const ab = mkAb(seed); ab.g.sv = 0; ab.g.balls = [ball(120, 270, 17, -61)]; ab.g.pad.x = 120; const out = []; for (let i = 0; i < 300; i++) { ab.g.pad.tx = ab.g.balls[0].held ? 120 : clamp(Math.round(ab.g.balls[0].x / 16), 20, 220); step(ab); out.push(ab.g.balls.map((b) => `${b.x},${b.y}`).join("/")); } return out.join("|") + ab.score; };
  assert.equal(path(4), path(4), "integer physics: a replay is identical");
}

// (d) hostile input: nothing throws, nothing counts, the state stays sane, the paddle never beats its speed cap
{
  const s = sim("철거해커", 2), ab = s.p.ab;
  const snap = () => JSON.stringify(ab.g);
  const junk = [{}, { x: "100" }, { x: 100.5 }, { x: -3 }, { x: 241 }, { x: 1e300 }, { x: NaN }, { x: Infinity }, { x: -Infinity }, { x: null }, { x: [1] }, { x: { a: 1 } }, { x: true }, { x: "__proto__" }, { y: 5 }, { fire: 1 }, { go: 1 },
    { k: "pipe" }, { pad: { x: 5 } }, { balls: [] }, { g: 1 }, { t: "ab_act", x: 5 }, { x: -0 }];
  s.act({ t: "ab_act", x: 5 });
  const before = snap();
  for (let i = 0; i < 2; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; }
  assert.equal(snap(), before, "the brief ignores every input");
  s.tick(T.briefMs + 200);
  const g = ab.g, pad = g.pad;
  let prev = pad.x, prevN = g.n;
  const check = () => {
    assert.ok(Number.isInteger(pad.x) && pad.x >= pad.hw && pad.x <= W.W - pad.hw, "the paddle stays in the field"); assert.ok(Math.abs(pad.x - prev) <= W.PSPD * (g.n - prevN), "and never beats its speed cap"); prev = pad.x; prevN = g.n;
    assert.ok(Number.isInteger(pad.tx) && pad.tx >= 0 && pad.tx <= W.W);
    for (const b of g.balls) assert.ok(b.x >= 0 && b.x <= W.W * 16 && b.y >= 0 && Number.isInteger(b.x) && Number.isInteger(b.y), "balls are whole numbers inside the field");
    assert.ok(g.balls.length >= 1 && g.balls.length <= 3); assert.ok(g.k.every((v, i) => (v === 0) === (g.h[i] === 0)) && g.left === g.k.filter((v) => v).length);
  };
  for (let i = 0; i < 3; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; assert.doesNotThrow(() => s.tick(0)); check(); }
  // spam inside the rate limit: only the first counts
  let acc = 0, last = ab.lastAct;
  for (let i = 0; i < 50; i++) { s.now += 5; assert.doesNotThrow(() => s.act({ t: "ab_act", x: i % 2 ? 240 : 0 })); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.ok(acc <= 8, `50 inputs in 250 ms: only those ${acc} 35 ms apart were taken`);
  acc = 0; last = ab.lastAct; s.now += 100;
  for (let i = 0; i < 50; i++) { s.act({ t: "ab_act", x: 77 }); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.equal(acc, 1, "50 inputs in the same instant: one counts");
  // violent steering for a whole shift
  const rng = mulberry(77);
  for (let i = 0; i < 1500 && ab.state === "run"; i++) { s.now += 40; s.act({ t: "ab_act", x: Math.floor(rng() * 241) }); if (i % 2) { s.tick(0); check(); } }
  // after the end nothing moves, and nothing counts
  s.tick(T.runMs + 1000);
  assert.equal(ab.state, "end");
  const done = snap(), sc = ab.score;
  for (const j of [{ x: 5 }, { x: 200 }]) { s.now += 50; s.act({ t: "ab_act", ...j }); }
  assert.equal(snap(), done, "after the end the field is frozen"); assert.equal(ab.score, sc);
}

// (e) the server's cost: 240 simulated seconds, 10 ticks/s, an input every 120 ms
{
  const s = sim("철거부하", 7), ab = s.p.ab, rng = mulberry(3);
  let ms = 0, views = 0, bytes = 0, maxB = 0;
  for (let i = 0; i < (T.briefMs + T.runMs) / 100; i++) {
    if (i % 6 === 0 || i % 6 === 3) s.act({ t: "ab_act", x: Math.floor(rng() * 241) });
    const t0 = performance.now();
    const v = s.tick(100);
    ms += performance.now() - t0;
    if (v.ab && v.ab[7]) { const n = JSON.stringify(v.ab[7]).length; views++; bytes += n; maxB = Math.max(maxB, n); }
  }
  console.log(`  server: ${(T.briefMs + T.runMs) / 100} ticks + views in ${ms.toFixed(1)} ms (${(ms / 4.1).toFixed(2)} ms per simulated minute); view avg ${Math.round(bytes / views)} B, max ${maxB} B (${views} sent)`);
  assert.ok(ms / 4.1 < 100, "far below 100 ms per simulated minute");
  assert.equal(ab.state, "end");
}

console.log("alba-wall: ok");
