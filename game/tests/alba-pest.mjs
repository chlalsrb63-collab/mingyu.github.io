// 일일 아르바이트 · 해충 방제 (67-alba-pest.js): a Galaga-style shooter on a fixed 50 ms step. Unit tests of the rules (formation, hits, dives, stun, web and rescue,
// queen, waves), determinism (also across tick rates), hostile input, the view's size, the server's cost, and bots that play whole shifts through the real
// tick / viewFor / action path (a perfect bot, a human-like one, a casual one, an idle one) to tune `par`.
// node tests/alba-pest.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ALBA, ALBA_RULES, ALBA_T, PEST, pestStep, pestDive, pestForm, pestSx, pestSy, pestQx, pestQy, pestNew, pestSpeed, albaGrade };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, R = X.ALBA_RULES.pest, P = X.PEST, T = X.ALBA_T;
const PAR = X.ALBA.pest.par;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ── unit harness: a bare shift object, no world
const mkAb = (seed = 7, endAt = 1e9) => {
  const ab = { k: "pest", box: { seed }, runAt: 0, endAt, score: 0, combo: 0, maxCombo: 0, nextFever: 10, feverUntil: 0, feverUsed: 0, rev: 1, g: null };
  R.init(null, null, ab);
  return ab;
};
const step = (ab, n = 1) => { for (let i = 0; i < n; i++) { ab.g.simAt += P.STEP; X.pestStep(ab, ab.g.simAt); } };
/** A wave in its steady state (the formation flown in, no dive due soon). */
const calm = (seed = 7, wave = 1) => { const ab = mkAb(seed); if (wave > 1) X.pestNew(ab, wave); const g = ab.g; g.sw = P.INTRO + 20; g.dn = 1e6; X.pestForm(g); return ab; };
const slotOf = (g, r, c) => r * g.cols + c;

// ── the formation: it flies in, sways ±20 and steps down
{
  const ab = mkAb(), g = ab.g;
  assert.equal(g.wv, 1); assert.equal(g.cols, 6); assert.equal(g.rows, 2); assert.equal(g.left, 12);
  assert.equal(g.oy, -100, "it starts above the field");
  step(ab, P.INTRO); assert.equal(g.oy, 0, "and has flown in after 25 steps"); assert.equal(g.ox, 0);
  const xs = [], ys = [];
  for (let i = 0; i < 200; i++) { step(ab); xs.push(g.ox); ys.push(g.oy); }
  assert.ok(Math.max(...xs) === 20 && Math.min(...xs) === -20, "it sways between −20 and +20");
  assert.ok(xs.every((v, i) => i === 0 || Math.abs(v - xs[i - 1]) <= 1), "at one unit per step");
  assert.ok(ys.every((v, i) => i === 0 || v >= ys[i - 1]) && ys[ys.length - 1] > ys[0], "it only ever descends");
  assert.ok(ys.every((v) => v <= P.MAXDROP), "and stops at the limit");
  const sx = X.pestSx(g, slotOf(g, 0, 0)), ex = X.pestSx(g, slotOf(g, 0, 5));
  assert.equal(ex - sx, 5 * P.SPX, "slots are 22 apart"); assert.equal((sx + ex) / 2, P.FX + g.ox, "centred on the field");
}

// ── the ship: intent, speed cap, bounds
{
  const ab = calm(), g = ab.g, sh = g.sh;
  assert.equal(R.act(null, null, ab, { x: 200 }, 10), null);
  const x0 = sh.x; step(ab); assert.equal(sh.x - x0, P.SPD, "the speed cap per step (4)"); assert.equal(sh.vx, P.SPD); assert.equal(P.SPD, 4);
  step(ab, 40); assert.equal(sh.x, 200, "and it stops at the target");
  R.act(null, null, ab, { x: 0 }, 20); step(ab, 70); assert.equal(sh.x, 8, "never out of the field");
  R.act(null, null, ab, { x: 240 }, 30); step(ab, 90); assert.equal(sh.x, 232);
  assert.equal(R.act(null, null, ab, { fire: 1 }, 40), null); step(ab);
  assert.equal(g.B.length, 1, "firing starts a spray"); assert.equal(g.B[0][1], P.SY - 8 - P.BSP);
  step(ab, 3); assert.equal(g.B.length, 1, "one spray per 4 steps"); step(ab); assert.equal(g.B.length, 2);
  for (let i = 0; i < 60; i++) step(ab);
  assert.ok(g.B.length <= P.MAXV, "the sprays in the air are capped (3)"); assert.equal(g.B.length, P.MAXV);
  assert.equal(R.act(null, null, ab, { fire: 0 }, 50), null); step(ab, 40); assert.equal(g.B.length, 0, "no fire, no sprays (the old ones flew off)");
}

// ── hits: a spray kills the lowest bug on its way, +10, combo
{
  const ab = calm(), g = ab.g, sh = g.sh;
  g.sw = 200; X.pestForm(g);
  const i = slotOf(g, 1, 2), x = X.pestSx(g, i), y = X.pestSy(g, i);
  g.B.push([x + 5, y + 8, 0]);   // a spray right under it (5 to the side is still a hit)
  step(ab);
  assert.equal(g.F[i], 0, "the bug is shot"); assert.equal(ab.score, 10, "+10"); assert.equal(ab.combo, 1); assert.equal(g.left, 11); assert.equal(g.B.length, 0, "the spray is used up");
  assert.deepEqual(g.ev.at(-1).slice(1, 5), [1, X.pestSx(g, i), X.pestSy(g, i), 10], "an event tells where and how much");
  // a spray 10 off misses; the lower row shields the upper one in the same column
  const j = slotOf(g, 0, 3), jx = X.pestSx(g, j), jy = X.pestSy(g, j);
  g.B.push([jx + 10, jy + 8, 0]); step(ab); assert.equal(g.F[j], 1, "9 or more to the side: a miss"); assert.equal(g.B.length, 1);
  g.B.length = 0;
  const lo = slotOf(g, 1, 4), hi = slotOf(g, 0, 4), lx = X.pestSx(g, lo);
  g.B.push([lx, X.pestSy(g, lo) + 30, 0]);
  step(ab, 6); assert.equal(g.F[lo], 0, "the lowest bug takes it"); assert.equal(g.F[hi], 1);
  // a spray that flies off the top is gone
  g.B.length = 0; g.B.push([5, -3, 0]); step(ab); assert.equal(g.B.length, 0);
  void sh;
}

// ── dives: peel off, wiggle, fly past and come back; shooting one is worth 40
{
  const ab = calm(3), g = ab.g;
  g.sh.inv = 1e9;   // keep the ship out of it
  g.dn = 1; step(ab); g.dn = 1e6;
  assert.equal(g.D.length, 1, "a bug peels off"); const d = g.D[0];
  assert.equal(g.F[d.i], 2, "its place is held"); assert.equal(d.st, 0);
  const y0 = d.y;
  step(ab, 3); assert.equal(d.y - y0, 3 * 4, "wave 1 dives at 4 per step");
  const ys = [];
  for (let n = 0; n < 200 && g.D.includes(d) && d.st === 0; n++) { step(ab); if (d.st === 0) ys.push(d.y); }
  assert.ok(ys.every((v, i) => i === 0 || v > ys[i - 1]), "it only goes down");
  assert.equal(d.st, 1, "past the bottom it turns into a bug flying back from the top"); assert.ok(d.y < 0 && g.F[d.i] === 2);
  for (let n = 0; n < 100 && g.D.includes(d); n++) step(ab);
  assert.equal(g.F[d.i], 1, "and is back in its place"); assert.equal(g.D.length, 0);
  // shot while diving: +40
  const ab2 = calm(3), g2 = ab2.g;
  g2.dn = 1; step(ab2); const e = g2.D[0]; step(ab2, 10);
  g2.B.push([e.x, e.y + 14, 0]); const before = ab2.score; step(ab2);
  assert.equal(ab2.score - before, 40, "a diver shot is worth 40"); assert.equal(g2.D.length, 0); assert.equal(g2.F[e.i], 0); assert.equal(g2.left, 11);
  // the speed and the number of divers grow with the wave
  assert.deepEqual([1, 3, 6, 10, 20].map(X.pestSpeed), [4, 5, 6, 7, 7], "dives get faster with the wave");
  // dive path: deterministic from the same start
  const run = (seed) => { const a = calm(seed), q = a.g; q.dn = 1; step(a, 40); return JSON.stringify(q.D.map((z) => [z.x, z.y])); };
  assert.equal(run(3), run(3)); assert.ok(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(run)).size > 1, "other seeds pick other bugs");
}

// ── a diver that reaches the ship: stun 2 s, no input, no fire, combo broken, no second hit meanwhile
{
  const ab = calm(5), g = ab.g, sh = g.sh;
  ab.score = 300; ab.combo = 4;
  g.D.push({ i: 0, k: 0, x: sh.x, y: P.SY - 13, y0: P.SY - 13, cx: sh.x, a: 0, st: 0, vx: 0, vy: 3, web: 0, wd: 0 }); g.F[0] = 2;
  step(ab);
  assert.equal(sh.stun, P.STUN - 0, "rammed: stunned"); assert.equal(ab.combo, 0, "the combo breaks"); assert.equal(ab.score, 300, "no points are lost (albaBad 0)");
  assert.equal(g.D.length, 1, "the bug bounces off, flying back"); assert.equal(g.D[0].st, 1); assert.equal(g.left, 12, "it is not dead"); assert.equal(g.wh, 1, "counted as a hit this wave");
  sh.stun = P.STUN;   // exactly 2 s from here
  sh.fire = 1; const bn = g.B.length;
  assert.equal(R.act(null, null, ab, { x: 10 }, 6), null); step(ab, 5); assert.equal(sh.tx, P.FX, "orders are ignored while stunned"); assert.equal(sh.x, P.FX);
  assert.ok(g.B.length <= bn, "and so is fire");
  g.D.length = 0; g.D.push({ i: 1, k: 0, x: sh.x, y: P.SY - 7, y0: P.SY - 7, cx: sh.x, a: 0, st: 0, vx: 0, vy: 3, web: 0, wd: 0 }); g.F[1] = 2;
  step(ab); assert.equal(g.D[0].st, 0, "invulnerable while stunned and a second after (the bug sails through)"); g.D.length = 0;
  step(ab, P.STUN); assert.equal(sh.stun, 0); assert.equal(R.act(null, null, ab, { x: 50 }, 7), null); step(ab); assert.ok(sh.x < P.FX, "free again");
}

// ── the sticky web: webbed 3 s, shoot the flashing rescue bug (+60) to get free
{
  const ab = calm(9), g = ab.g, sh = g.sh;
  ab.score = 100; ab.combo = 3;
  g.W.push([sh.x + 4, P.SY - 10]); step(ab);
  assert.equal(sh.web, P.WEB, "webbed"); assert.equal(ab.combo, 0); assert.equal(ab.score, 100); assert.ok(g.rs, "a rescue bug runs across"); assert.equal(g.W.length, 0);
  R.act(null, null, ab, { x: 10 }, 5); step(ab, 5); assert.equal(sh.x, P.FX, "the ship cannot move"); R.act(null, null, ab, { fire: 1 }, 6); step(ab); assert.ok(g.B.length >= 1, "but it can spray");
  g.W.push([sh.x, P.SY - 10]); step(ab, 6); assert.equal(g.W.length, 0); assert.ok(sh.web > 0 && sh.web <= P.WEB, "no double web");
  const r = g.rs; g.B.length = 0; g.B.push([r.x + 2, r.y + 8, 0]);
  const before = ab.score; step(ab);
  assert.equal(sh.web, 0, "free"); assert.equal(g.rs, null); assert.ok(ab.score - before === 60 && ab.combo === 1, "rescue: +60");
  assert.equal(g.ev.at(-1)[1], 5);
  // it runs across on its own, passing the ship's column, and without a hit the web wears off after 3 s
  const ab2 = calm(9), g2 = ab2.g, s2 = g2.sh;
  g2.W.push([s2.x, P.SY - 10]); step(ab2);
  const xs = []; for (let i = 0; i < 25; i++) { step(ab2); xs.push(g2.rs.x); }
  assert.ok(xs.some((x) => Math.abs(x - s2.x) <= 3), "the rescue bug passes over the ship's column within a second or two");
  step(ab2, 50); assert.equal(s2.web, 0, "the web wears off"); assert.equal(g2.rs, null);
  // a web on the ship's side misses
  const ab3 = calm(9), g3 = ab3.g; g3.W.push([g3.sh.x + 30, P.SY - 10]); step(ab3); assert.equal(g3.sh.web, 0);
  // a web falls and goes
  const ab4 = calm(9); ab4.g.W.push([20, 100]); step(ab4, 60); assert.equal(ab4.g.W.length, 0);
}

// ── the queen (every third wave): many hits, +100
{
  const ab = calm(2, 3), g = ab.g;
  assert.ok(g.q && g.q.hp === 14, "wave 3 has a queen with hp 14"); assert.equal(g.left, g.cols * g.rows + 1);
  const hp = g.q.hp;
  g.B.push([X.pestQx(g), X.pestQy(g) + 8, 0]); step(ab);
  assert.equal(g.q.hp, hp - 1); assert.equal(ab.score, 0, "a hit is not worth points"); assert.equal(g.ev.at(-1)[1], 7);
  g.q.hp = 1; g.B.push([X.pestQx(g) + 11, X.pestQy(g) + 8, 0]); step(ab);
  assert.equal(g.q, null); assert.equal(ab.score, 100, "the queen: +100"); assert.equal(g.ev.at(-1)[1], 8);
  const ab2 = mkAb(); X.pestNew(ab2, 6); assert.equal(ab2.g.q.hp, 20, "wave 6: hp 20"); X.pestNew(ab2, 4); assert.equal(ab2.g.q, null);
  // she spits webs at the ship
  const ab3 = calm(2, 3), g3 = ab3.g; g3.q.wt = 1; step(ab3); assert.equal(g3.W.length, 1, "the queen spits a web"); assert.equal(g3.W[0][0], g3.sh.x); assert.equal(g3.ev.at(-1)[1], 9);
}

// ── fever: the three-way spray
{
  const ab = calm(), g = ab.g;
  R.act(null, null, ab, { fire: 1 }, 5);
  ab.feverUntil = g.simAt + 5000; step(ab);
  assert.equal(g.B.length, 3, "three sprays"); assert.deepEqual(g.B.map((b) => b[2]), [-2, 0, 2], "in a fan");
  step(ab, 4); assert.equal(g.B.length, 6);
  ab.feverUntil = 0; g.B.length = 0; step(ab, 4); assert.equal(g.B.length, 1, "back to one");
  const ab2 = calm(); R.act(null, null, ab2, { fire: 1 }, 5); ab2.feverUntil = 1e9;
  for (let i = 0; i < 40; i++) { step(ab2); assert.ok(ab2.g.B.filter((b) => !b[2]).length <= P.MAXV); }
}

// ── waves: clear bonus, no-hit bonus, rest, the next wave; sizes by wave
{
  const ab = calm(), g = ab.g;
  g.F.fill(0); g.F[0] = 1; g.left = 1;
  g.B.push([X.pestSx(g, 0), X.pestSy(g, 0) + 8, 0]); step(ab);
  assert.equal(ab.score, 10 + 220, "the last bug, then the wave: +100 and +100 for no hit (the combo is 1: ×1.1)"); assert.equal(g.rest, P.REST); assert.equal(g.ev.at(-1)[1], 6);
  assert.equal(R.view(ab, g.simAt)[3], 0, "no formation while resting");
  step(ab, P.REST - 1); assert.equal(g.wv, 1); step(ab); assert.equal(g.wv, 2, "after 5 s the next wave"); assert.equal(g.left, 18); assert.equal(g.rest, 0);
  const ab2 = calm(), g2 = ab2.g; g2.wh = 1;
  g2.F.fill(0); g2.F[0] = 1; g2.left = 1; g2.B.push([X.pestSx(g2, 0), X.pestSy(g2, 0) + 8, 0]); step(ab2);
  assert.equal(ab2.score, 10 + 110, "a wave with a hit: +100 only (×1.1)");
  const sizes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 30].map((w) => { const a = mkAb(); X.pestNew(a, w); return a.g.left; });
  assert.deepEqual(sizes, [12, 18, 22, 28, 32, 33, 40, 40, 41, 41, 41], "12 → 40 bugs, a queen every third wave, wave 8 stays the hardest");
  for (let w = 1; w <= 9; w++) { const a = mkAb(); X.pestNew(a, w); assert.equal(a.g.kinds.length, a.g.rows); assert.ok(a.g.kinds.every((k) => k >= 0 && k <= 2)); }
}

// ── a long stall just skips ahead; nothing happens twice
{
  const ab = mkAb(); R.adv(null, null, ab, 1e9);
  assert.ok(ab.g.simAt > 1e8 && ab.g.simAt <= 1e9 && ab.g.simAt % P.STEP === 0, "fast-forward lands on a step");
  assert.ok(ab.g.n <= 40, "at most 40 steps ran");
  const a2 = mkAb(), a3 = mkAb(); for (let t = 0; t <= 1900; t += 100) R.adv(null, null, a2, t); R.adv(null, null, a3, 1900);
  assert.equal(JSON.stringify(a2.g), JSON.stringify(a3.g), "a slow caller and a fast one agree");
  const rev = a2.rev; R.adv(null, null, a2, 1910); assert.equal(a2.rev, rev, "less than a step later: nothing new");
}

// ── view: shape, JSON, masks
{
  const ab = calm(), g = ab.g; g.F[1] = 0; g.F[7] = 2;
  const v = R.view(ab, g.simAt + 20);
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v, "plain JSON");
  assert.equal(v[0], 1); assert.equal(v[1], 0); assert.equal(v[2].length, 6); assert.equal(v[2][0], P.FX);
  const fm = v[3]; assert.equal(fm[4], 6); assert.equal(fm[5], "10"); assert.deepEqual(fm[6], [0b111101, 0b111111 & ~(1 << 1)]);
  assert.equal(v[10], 12);
  g.rest = 30; assert.equal(R.view(ab, g.simAt)[1], 1500, "ms from now"); g.rest = 0;
  g.sh.stun = 10; assert.equal(R.view(ab, g.simAt + 20)[2][2], 480, "times are ms from now, minus the part of a step not simulated yet");
}

// ── whole shifts through the real engine
const sim = (name, seed = 1, stepMs = 100) => {
  const S = L.setup();
  let now = 5_000_000 + seed * 7919;
  S.now = now;
  L.addPlayer(S, "p1", L.hero(name, { wk: "sword", lvl: 30, migrate: true }));
  const p = S.players.p1;
  const act = (a) => { S.now = now; const v = L.validateAction(S, "p1", a); if (v.ok) L.applyAction(S, "p1", a); return v; };
  assert.ok(act({ t: "ab_start", k: "pest" }).ok);
  return {
    S, p, act, get now() { return now; }, set now(v) { now = v; },
    tick(ms = stepMs) { now += ms; S.now = now; L.tick(S, now); const v = L.viewFor(S, "p1"); L.endTick(S); return v; },
  };
};
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ── the bots' eyes. A snapshot is { sh, tg: targets with a path P[k] = where they are k steps from now, wb: webs, free: steps until a spray slot frees }.
// An oracle reads the server state and rolls the bugs' real paths forward with the rules' own functions; any other bot reads the wire, as the client decodes it
// (a tick old at best) and extrapolates in straight lines.
const K = 44;
const lin = (x, y, vx, vy, age) => Array.from({ length: K + 1 }, (_, k) => [clamp(x + vx * (k + age), 8, 232), y + vy * (k + age)]);
function volleyFree(B) {   // steps until the air has room for another spray
  const mid = B.filter((b) => !b[2]);
  return mid.length < P.MAXV ? 0 : Math.max(1, Math.ceil(Math.min(...mid.map((b) => (b[1] - 40) / P.BSP))));
}
function fromWire(w, age, o) {
  const [wv, rest, sh, fm, D, B, W, rs, q, ev, left] = w, tg = [];
  if (fm) {
    const [ox, oy, vx, vy, cols, kinds, masks] = fm;
    // a player who has watched the formation knows it swings between ±20 (o.sway); otherwise it is a straight line
    const q0 = vx > 0 ? ox + 20 : 60 - ox, tri = (k) => { const r = (q0 + Math.round(k + age)) % 80; return r < 40 ? r - 20 : 60 - r; };
    masks.forEach((m, r) => { for (let c = 0; c < cols; c++) if ((m >> c) & 1) { const bx = P.FX + (2 * c - cols + 1) * 13, by = P.FY + r * P.SPY + oy; tg.push({ c, P: o && o.sway && vx ? Array.from({ length: K + 1 }, (_, k) => [bx + tri(k), by]) : lin(bx + ox, by, vx, 0, age) }); } });
  }
  const dv = [];
  for (let i = 0; i < D.length; i += 6) (D[i + 5] & 2 ? tg : dv).push({ P: lin(D[i + 1], D[i + 2], D[i + 3], D[i + 4], age) });
  const flat = []; for (let i = 0; i < B.length; i += 3) flat.push([B[i], B[i + 1], B[i + 2]]);
  const wb = []; for (let i = 0; i < W.length; i += 2) wb.push({ x: W[i], y: W[i + 1] + 4 * age });
  if (q) tg.push({ P: lin(q[0], q[1], fm ? fm[2] : 0, 0, age) });
  return { sh: { x: sh[0], stun: sh[2], web: sh[3] }, tg, dv, wb, free: volleyFree(flat), rs: rs ? lin(rs[0], rs[1], rs[2], 0, age) : null };
}
function fromG(g) {
  const tg = [], dv = [];
  const FO = Array.from({ length: K + 1 }, (_, k) => { const g2 = { sw: g.sw + k, oy: g.oy }; X.pestForm(g2); return [g2.ox, g2.oy]; });
  const rolled = (d) => { const d2 = { ...d }, p = [[d2.x, d2.y]]; for (let k = 0; k < K; k++) { X.pestDive(g, d2, g.sh.x); p.push([d2.x, d2.y]); } return p; };
  if (!g.rest) for (let i = 0; i < g.F.length; i++) if (g.F[i] === 1) { const bx = P.FX + (2 * (i % g.cols) - g.cols + 1) * 13, by = P.FY + ((i / g.cols) | 0) * P.SPY; tg.push({ c: i % g.cols, P: FO.map(([ox, oy]) => [bx + ox, by + oy]) }); }
  for (const d of g.D) (d.st ? tg : dv).push({ P: rolled(d) });
  if (g.q) tg.push({ P: FO.map(([ox, oy]) => [P.FX + ox, P.FY - 26 + oy]) });
  return { sh: { x: g.sh.x, stun: g.sh.stun, web: g.sh.web }, tg, dv, wb: g.W.map((w) => ({ x: w[0], y: w[1] })), free: volleyFree(g.B), rs: g.rs ? lin(g.rs.x, g.rs.y, g.rs.vx, 0, 0) : null };
}
/** The earliest step a spray fired as soon as possible (the ship walking to the spot first) meets a bug whose path is `Pth`: { t, x }. */
function meet(sx, Pth, free) {
  for (let k = 2; k <= K; k++) {
    const [x, y] = Pth[k], f = Math.max(Math.ceil(Math.abs(x - sx) / P.SPD), free);
    if (y > 0 && k - f >= Math.ceil((P.SY - 8 - y) / P.BSP)) return { t: k, x };
  }
  return null;
}
/** Would a spray leaving from x1 now hit anything? (a bot with fire discipline holds fire otherwise) */
function aligned(sn, x1, tol) {
  for (const t of [...sn.tg, ...sn.dv, ...(sn.rs ? [{ P: sn.rs }] : [])])
    for (let j = 1; j <= 30; j++) { const [x, y] = t.P[j], by = P.SY - 8 - P.BSP * j; if (Math.abs(x1 - x) <= 6 + tol && y + 5 >= by && y - 5 <= by + P.BSP) return true; }
  return false;
}
/**
 * One decision: where to stand and whether to fire. `o.err` = aim error (units), `o.miss` = chance to chase a random bug instead, `o.dodge` = leave a ram line or a web,
 * `o.disc` = fire discipline: hold fire unless a spray would hit a bug within 6 + disc units (undefined = spray all the time). Returns null while stunned.
 */
function decide(sn, o, rng) {
  const sx = sn.sh.x;
  if (sn.sh.stun) return null;
  if (sn.sh.web) return { x: null, fire: 1 };   // stuck: keep spraying, the rescue bug will cross
  let tx = sx, best = null;
  const zones = [];
  if (o.dodge) {
    for (const d of sn.dv) {
      const eta = d.P.findIndex((p) => p[1] >= P.SY - 10);
      if (eta < 0 || eta > 14) continue;
      let lo = 1e9, hi = -1e9;
      for (let k = Math.max(0, eta - 6); k <= Math.min(K, eta + 2); k++) { lo = Math.min(lo, d.P[k][0]); hi = Math.max(hi, d.P[k][0]); }
      zones.push([lo - (o.margin || 18), hi + (o.margin || 18), eta]);
    }
    for (const w of sn.wb) { const eta = (P.SY - 8 - w.y) / P.WEBSP; if (eta >= 0 && eta <= 22) zones.push([w.x - 20, w.x + 20, eta]); }
  }
  for (const t of sn.tg) {
    const m = meet(sx, t.P, sn.free);
    if (m && (!best || m.t < best.t)) best = m;
  }
  for (const d of sn.dv) {   // a diver is worth 40 and a threat: go for it when it can be shot well before it arrives
    const m = meet(sx, d.P, sn.free), eta = d.P.findIndex((p) => p[1] >= P.SY - 10);
    if (m && (eta < 0 || m.t <= eta - 6) && (!best || m.t - 12 < best.t)) best = { t: m.t - 12, x: m.x };
  }
  if (sn.rs) { const m = meet(sx, sn.rs, 0); if (m) best = m; }
  if (rng() < o.miss) { const c = sn.tg[Math.floor(rng() * sn.tg.length)]; if (c) best = { x: c.P[0][0] + (rng() - 0.5) * 60 }; }
  if (best) tx = best.x + (rng() - 0.5) * 2 * o.err;
  tx = clamp(tx, 8, 232);
  const inZone = (x) => zones.some(([lo, hi]) => x > lo && x < hi);
  if (inZone(tx) || inZone(sx + clamp(tx - sx, -P.SPD, P.SPD))) {   // step out: the nearest edge that is free and reachable
    const edges = zones.flatMap(([lo, hi]) => [lo - 1, hi + 1]).map((x) => clamp(x, 8, 232)).filter((x) => !inZone(x));
    const eta = Math.min(...zones.map((z) => z[2]));
    const ok = edges.filter((x) => Math.abs(x - sx) / P.SPD <= eta);
    const pool = ok.length ? ok : edges;
    if (pool.length) tx = pool.reduce((a, b) => (Math.abs(a - sx) <= Math.abs(b - sx) ? a : b));
  }
  tx = clamp(Math.round(tx), 0, P.W);
  return { x: tx, fire: o.disc === undefined || aligned(sn, sx + clamp(tx - sx, -P.SPD, P.SPD), o.disc) ? 1 : 0 };
}
/** One bot: `gap` ms between decisions; `oracle` reads the server state, the rest read the wire. */
function mkBot(rng, o) {
  let wire = null, wireAt = 0;
  return {
    delay: () => o.gap[0] + rng() * (o.gap[1] - o.gap[0]),
    seen(v, t) { if (v && v.ab && v.ab[7]) { wire = v.ab[7]; wireAt = t; } },
    step(s, send) {
      let sn;
      if (o.oracle) sn = fromG(s.p.ab.g); else { if (!wire) return false; sn = fromWire(wire, (s.now - wireAt) / P.STEP, o); }
      const d = decide(sn, o, rng);
      return send(d === null ? { fire: 1 } : d.x === null ? { fire: d.fire } : { x: d.x, fire: d.fire });
    },
  };
}

function play(botOpts, seed, { name = `방제${seed}`, hook, stepMs = 100 } = {}) {
  const rng = mulberry(seed * 977 + 13), s = sim(name, seed, stepMs), bot = mkBot(rng, botOpts), ab = s.p.ab;
  let nextTick = s.now + stepMs, nextBot = ab.runAt + 100, maxBytes = 0, sumBytes = 0, views = 0, seq = 0, stuns = 0, webs = 0, rescues = 0;
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
      for (const e of ab.g.ev) if (e[0] > seq) { seq = e[0]; if (e[1] === 3) stuns++; if (e[1] === 4) webs++; if (e[1] === 5) rescues++; }
      if (v.ab && v.ab[7]) { const n = JSON.stringify(v.ab[7]).length; maxBytes = Math.max(maxBytes, n); sumBytes += n; views++; }
      if (hook) hook(s, v);
    }
  }
  return { score: ab.score, grade: X.albaGrade("pest", ab.score), wave: ab.g.wv, maxBytes, avgBytes: views ? Math.round(sumBytes / views) : 0, maxCombo: ab.maxCombo, state: ab.state, stuns, webs, rescues, fevers: ab.feverUsed, views };
}

// (c) the bots
const BOTS = {
  perfect: { gap: [50, 50], oracle: true, dodge: true, disc: 0, err: 0, miss: 0 },
  strong: { gap: [250, 450], oracle: true, dodge: true, disc: 10, err: 10, miss: 0.15 },   // knows the dive paths by heart
  human: { gap: [150, 400], dodge: true, margin: 30, sway: true, disc: 10, err: 6, miss: 0.1 },
  casual: { gap: [500, 1100], dodge: false, sway: true, err: 14, miss: 0.3 },
};
if (process.env.PEST_EXP) {   // tuning aid: PEST_EXP='{"gap":[150,400],...};{...}' node tests/alba-pest.mjs prints 3 seeds per bot and stops
  for (const e of process.env.PEST_EXP.split(";")) { const o = JSON.parse(e); const rs = [1, 2, 3].map((s) => play(o, s)); console.log(e, rs.map((r) => r.score).join(" "), "stuns", rs.map((r) => r.stuns).join(","), "waves", rs.map((r) => r.wave).join(",")); }
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
console.log(`pest: par ${PAR}  (C ${Math.round(PAR * T.cuts[0])} B ${Math.round(PAR * T.cuts[1])} A ${Math.round(PAR * T.cuts[2])} S ${PAR})`);
for (const [nm, rs] of Object.entries(results)) console.log(`  ${nm.padEnd(8)} scores ${rs.map((r) => r.score).join(" ")}  grades ${rs.map((r) => "-CBAS"[r.grade]).join("")}  waves ${rs.map((r) => r.wave).join(",")} stuns ${rs.map((r) => r.stuns).join(",")} webs ${rs.map((r) => r.webs).join(",")} rescues ${rs.map((r) => r.rescues).join(",")} combo ${rs.map((r) => r.maxCombo).join(",")}  avg ${avg(rs.map((r) => r.score))} = ${(avg(rs.map((r) => r.score)) / PAR).toFixed(2)} par`);
console.log(`  idle     score ${idle.score} grade ${"-CBAS"[idle.grade]} stuns ${idle.stuns}   view max ${viewMax} bytes (avg of the worst shift ${viewAvg})`);
assert.ok(results.perfect.every((r) => r.grade === 4), "the perfect bot reaches S every time");
{
  const m = avg(results.human.map((r) => r.score)) / PAR;
  assert.ok(m >= 0.65 && m < 0.95, `the human-like bot lands around B (${m.toFixed(2)} of par)`);
  const c = avg(results.casual.map((r) => r.score)) / PAR;
  assert.ok(c >= 0.38 && c < 0.7, `the casual bot lands around C (${c.toFixed(2)} of par)`);
}
assert.ok(avg(results.strong.map((r) => r.score)) > avg(results.human.map((r) => r.score)), "playing better scores more");
assert.ok(avg(results.human.map((r) => r.score)) > avg(results.casual.map((r) => r.score)), "playing worse scores less");
assert.equal(idle.grade, 0, "an idle player gets no grade"); assert.equal(idle.score, 0, "and no points");
assert.ok(viewMax < 700, `the view stays small (${viewMax} bytes)`);

// (a) determinism: the same seed and inputs give the same shift, whatever the tick rate; another seed plays differently
{
  const a = play(BOTS.human, 3), b = play(BOTS.human, 3);
  assert.deepEqual(a, b, "same seed and same inputs: the same shift");
  const c = play(BOTS.human, 3, { name: "방제다른" });
  assert.notDeepEqual([c.score, c.wave, c.stuns], [a.score, a.wave, a.stuns], "a different seed plays differently");
  // a fixed input script, ticked at 100 ms, 50 ms and 230 ms: the very same shift
  const script = []; { const r = mulberry(5); for (let t = 6200; t < 6000 + 240000; t += 130) script.push([t, r() < 0.8 ? { x: Math.floor(r() * 241), fire: 1 } : { x: Math.floor(r() * 241) }]); }
  const run = (stepMs) => {
    const s = sim("방제스크립트", 11, stepMs), ab = s.p.ab, t0 = s.now;
    let i = 0, nextTick = t0 + stepMs;
    while (s.now < ab.endAt + 50) {
      const ta = i < script.length ? t0 + script[i][0] : Infinity;
      if (ta <= nextTick) { s.now = ta; s.act({ t: "ab_act", ...script[i][1] }); i++; } else { s.now = nextTick; s.tick(0); nextTick += stepMs; }
    }
    return [ab.score, ab.g.wv, ab.g.n, JSON.stringify({ ...ab.g, simAt: 0 })];
  };
  const r100 = run(100); assert.ok(r100[0] > 0, "the script scores");
  assert.deepEqual(run(50), r100, "ticked at 50 ms: the same"); assert.deepEqual(run(230), r100, "ticked at 230 ms: the same");
}

// (d) hostile input: nothing throws, nothing counts, the state stays sane, the ship never beats its speed cap
{
  const s = sim("방제해커", 2), ab = s.p.ab;
  const snap = () => JSON.stringify(ab.g);
  const junk = [{}, { x: "100" }, { x: 100.5 }, { x: -3 }, { x: 241 }, { x: 1e300 }, { x: NaN }, { x: Infinity }, { x: -Infinity }, { x: null }, { x: [1] }, { x: { a: 1 } }, { x: true }, { x: "__proto__" },
    { fire: 2 }, { fire: -1 }, { fire: "1" }, { fire: true }, { fire: null }, { fire: 0.5 }, { fire: NaN }, { x: 50, fire: 7 }, { x: "a", fire: 1 }, { y: 5 }, { cur: { k: 99 } }, { k: "pipe" }, { sh: { x: 5 } }, { g: 1 }, { t: "ab_act", x: 5 }];
  s.act({ t: "ab_act", x: 5 });
  const before = snap();
  for (let i = 0; i < 2; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; }
  assert.equal(snap(), before, "the brief ignores every input");
  s.tick(T.briefMs + 200);
  const g = ab.g, sh = g.sh;
  let prev = sh.x, prevN = g.n;
  const check = () => {
    assert.ok(Number.isInteger(sh.x) && sh.x >= 8 && sh.x <= 232, "the ship stays in the field"); assert.ok(Math.abs(sh.x - prev) <= P.SPD * (g.n - prevN), "and never beats its speed cap"); prev = sh.x; prevN = g.n;
    assert.ok(Number.isInteger(sh.tx) && sh.tx >= 8 && sh.tx <= 232); assert.ok(sh.fire === 0 || sh.fire === 1);
    for (const b of g.B) assert.ok(b[0] >= 0 && b[0] <= P.W && Number.isInteger(b[1]));
  };
  for (let i = 0; i < 3; i++) for (const j of junk) { assert.doesNotThrow(() => s.act({ t: "ab_act", ...j })); s.now += 40; assert.doesNotThrow(() => s.tick(0)); check(); }
  assert.equal(ab.score, 0, "hostile input scores nothing"); assert.equal(sh.fire, 0, "and fires nothing");
  assert.equal(g.B.length, 0);
  // spam inside the rate limit: only the first counts, however violently the target flips
  let acc = 0, last = ab.lastAct;
  for (let i = 0; i < 50; i++) { s.now += 5; assert.doesNotThrow(() => s.act({ t: "ab_act", x: i % 2 ? 240 : 0 })); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.ok(acc <= 8, `50 inputs in 250 ms: only those ${acc} 35 ms apart were taken`);
  acc = 0; last = ab.lastAct; s.now += 100;
  for (let i = 0; i < 50; i++) { s.act({ t: "ab_act", x: 77 }); if (ab.lastAct !== last) { acc++; last = ab.lastAct; } }
  assert.equal(acc, 1, "50 inputs in the same instant: one counts");
  // violent steering for a whole shift: the ship obeys its cap every step and the field stays intact
  const rng = mulberry(77);
  for (let i = 0; i < 1500 && ab.state === "run"; i++) { s.now += 40; s.act({ t: "ab_act", x: Math.floor(rng() * 241), fire: rng() < 0.5 ? 1 : 0 }); if (i % 2) { s.tick(0); check(); } }
  assert.ok(g.left >= 0 && g.F.every((v) => v === 0 || v === 1 || v === 2) && g.D.every((d) => d.x >= 8 && d.x <= 232));
  // after the end nothing moves, and nothing counts
  s.tick(T.runMs + 1000);
  assert.equal(ab.state, "end");
  const done = snap(), sc = ab.score;
  for (const j of [{ x: 5 }, { fire: 1 }, { x: 200, fire: 0 }]) { s.now += 50; s.act({ t: "ab_act", ...j }); }
  assert.equal(snap(), done, "after the end the field is frozen"); assert.equal(ab.score, sc);
}

// (e) the server's cost: 240 simulated seconds, 10 ticks/s, an input every 120 ms
{
  const s = sim("방제부하", 7), ab = s.p.ab, rng = mulberry(3);
  let ms = 0, views = 0, bytes = 0, maxB = 0;
  for (let i = 0; i < (T.briefMs + T.runMs) / 100; i++) {
    if (i % 6 === 0 || i % 6 === 3) s.act({ t: "ab_act", x: Math.floor(rng() * 241), fire: 1 });
    const t0 = performance.now();
    const v = s.tick(100);
    ms += performance.now() - t0;
    if (v.ab && v.ab[7]) { const n = JSON.stringify(v.ab[7]).length; views++; bytes += n; maxB = Math.max(maxB, n); }
  }
  console.log(`  server: ${(T.briefMs + T.runMs) / 100} ticks + views in ${ms.toFixed(1)} ms (${(ms / 4.1).toFixed(2)} ms per simulated minute); view avg ${Math.round(bytes / views)} B, max ${maxB} B (${views} sent)`);
  assert.ok(ms / 4.1 < 100, "far below 100 ms per simulated minute");
  assert.equal(ab.state, "end");
}

console.log("alba-pest: ok");
