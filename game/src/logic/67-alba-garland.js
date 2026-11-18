// 일일 아르바이트 · 화환 엮기 (docs/design/daily-alba-minigames-2026-11-16.md §9.6): Snake in a flower garden, 16×16. Contract: 66-alba.js.
// A fixed-step simulation inside `adv`: the flower-chain moves one cell every `garInt` ms on its own (start ~7 steps/s, faster with every garland, slower
// in a fever) and the player only turns. `g.simAt` is the absolute time of the next step; `adv` applies every step whose time has passed, in order,
// with its own timestamp (at most GAR.catchup per call; a longer stall skips the backlog). Flowers +10, a golden flower +50 (6 s), a thorn vine /
// a wall / the chain itself cuts the chain to a 3-link stub (−40, combo broken, 1.5 s pause — never game over), 12 links = a finished garland (+100,
// the chain restarts, a notch faster). Thorns grow over time and never touch each other (the garden stays connected).
// Flowers, thorns and the golden flower each roll from their own seeded stream (rf / rt / rg), so the clock of the garden does not depend on the play.
// ab.g = { c: chain cells (y * 16 + x), head last, dir 0 up · 1 right · 2 down · 3 left (the last step's heading), q: turns waiting for the next steps (≤ 2),
//          simAt, done: garlands, f: flower cells, gold: {c, until} | null, th: thorn cells, thAt, goldAt, n: steps, hits, seq, ev: [seq, flags, cell] (1 flower · 2 gold · 4 garland · 8 crash) }.
// The one input is {d: 0..3}: a turn, queued for the next step; the same heading and the reverse of the last queued heading are ignored.
// view = [chain cells, dir, ms to the next step, step ms, flower cells, [gold cell, ms left] | 0, thorn cells, garlands done, queued turns, ev]
const GAR = {
  W: 16, base: 143, min: 110, ramp: 0.92, stub: 3, full: 12, lead: 1200, pause: 1500, flowers: 2, near: 3,
  thornFirst: 6000, thornEvery: 3500, thornMax: 14, goldFirst: [6000, 12000], goldGap: [8000, 14000], goldLife: 6000,
  slow: 1.35, pts: [10, 50, 100], pen: 40, catchup: 40, queue: 2,
};
const GAR_DX = [0, 1, 0, -1], GAR_DY = [-1, 0, 1, 0];
Object.assign(ALBA, { garland: { name: "화환 엮기", npc: "willow_florist", place: "꽃집 앞 꽃밭", skill: "gather", par: 3150, mul: 0.95, outfit: ["hat_wreath_pink", "top_willow_apron"], tool: "shears", hint: "방향키·WASD·스와이프로 꽃줄을 이끌어 꽃을 모으세요. 벽·가시덩굴·내 몸에 닿으면 줄이 끊겨요. 12송이면 화환 완성!" } });

/** Ms between steps: faster with every garland, ×1.35 slower in a fever ("봄바람"). */
const garInt = (g, ab, T) => Math.round(Math.max(GAR.min, GAR.base * GAR.ramp ** g.done) * (T < ab.feverUntil ? GAR.slow : 1));
const garHead = (g) => g.c[g.c.length - 1];

/** A free cell for a flower (not on top of the head) or, with `thorn`, for a thorn vine: away from the head and its line, never touching another thorn or a flower. -1: no room. */
function garSpawn(g, box, thorn) {
  const W = GAR.W, o = new Array(W * W).fill(0), h = garHead(g), hx = h % W, hy = (h / W) | 0, ok = [];
  for (const c of g.c) o[c] = 1;
  for (const c of g.th) o[c] = 2;
  for (const c of g.f) o[c] = 3;
  if (g.gold) o[g.gold.c] = 3;
  for (let c = 0; c < W * W; c++) {
    if (o[c]) continue;
    const x = c % W, y = (c / W) | 0;
    if (!thorn) { if (Math.abs(x - hx) + Math.abs(y - hy) >= GAR.near) ok.push(c); continue; }
    if (Math.max(Math.abs(x - hx), Math.abs(y - hy)) < 4) continue;
    if ((x === hx && (y - hy) * GAR_DY[g.dir] > 0) || (y === hy && (x - hx) * GAR_DX[g.dir] > 0)) continue;   // straight ahead of the head
    let bad = false;
    for (let dy = -1; dy <= 1 && !bad; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
      const v = o[ny * W + nx];
      if (v === 2 || (v === 3 && !(dx && dy))) { bad = true; break; }
    }
    if (!bad) ok.push(c);
  }
  return ok.length ? ok[ri(box, 0, ok.length - 1)] : -1;
}
/** After a cut the stub keeps its head and picks a heading: straight on when 3+ cells are free ahead, else the free direction with the longest run (never back onto the neck). */
function garAim(g) {
  const W = GAR.W, h = garHead(g), hx = h % W, hy = (h / W) | 0;
  const run = (d) => {
    let x = hx, y = hy, n = 0;
    for (; n < 8; n++) { x += GAR_DX[d]; y += GAR_DY[d]; if (x < 0 || y < 0 || x >= W || y >= W || g.th.includes(y * W + x) || g.c.includes(y * W + x)) break; }
    return n;
  };
  if (run(g.dir) >= 3) return;
  let best = 0;
  for (let d = 0; d < 4; d++) { const r = run(d); if (r > best) { best = r; g.dir = d; } }
  if (best) return;
  // boxed in (the head between thorns, walls and its own neck): put the stub down somewhere free
  const start = ri(g.rt, 0, W * W - 1);
  for (let i = 0; i < W * W; i++) {
    const c0 = (start + i) % (W * W), x = c0 % W, y = (c0 / W) | 0;
    const row = [0, 1, 2, 3].map((k) => (x + k < W ? c0 + k : -1));
    if (row.every((c) => c >= 0 && !g.th.includes(c) && !g.f.includes(c) && !(g.gold && g.gold.c === c))) { g.c = row.slice(0, GAR.stub); g.dir = 1; return; }
  }
}
/** The head met a wall / a thorn / its own chain: it stays where it is, shortened to a stub; a pause, then it goes on. */
function garCrash(ab, T, h) {
  const g = ab.g;
  albaBad(ab, GAR.pen);
  g.hits++;
  g.c = g.c.slice(-GAR.stub); g.q.length = 0;
  garAim(g);
  g.ev = [++g.seq, 8, h];
  g.simAt = T + GAR.pause;
}
/** One step of the chain at time T: the garden's clock, the queued turn, the move, what it ran into. */
function garStep(ab, T) {
  const g = ab.g, W = GAR.W;
  g.n++;
  if (g.gold && T >= g.gold.until) g.gold = null;
  if (!g.gold && T >= g.goldAt) {
    const c = garSpawn(g, g.rg, 0);
    if (c >= 0) { g.gold = { c, until: T + GAR.goldLife }; g.goldAt = T + GAR.goldLife + ri(g.rg, GAR.goldGap[0], GAR.goldGap[1]); } else g.goldAt = T + 2000;
  }
  if (T >= g.thAt && g.th.length < GAR.thornMax) {
    const c = garSpawn(g, g.rt, 1);
    if (c >= 0) { g.th.push(c); g.thAt = T + GAR.thornEvery + ri(g.rt, -600, 600); } else g.thAt = T + 2000;
  }
  if (g.q.length) g.dir = g.q.shift();
  const h = garHead(g), nx = (h % W) + GAR_DX[g.dir], ny = ((h / W) | 0) + GAR_DY[g.dir], nc = ny * W + nx, inb = nx >= 0 && ny >= 0 && nx < W && ny < W;
  const fl = inb ? g.f.indexOf(nc) : -1, gold = inb && !!g.gold && g.gold.c === nc, eat = fl >= 0 || gold;
  if (!inb || g.th.includes(nc) || (g.c.includes(nc) && !(nc === g.c[0] && !eat))) { garCrash(ab, T, h); return; }   // the tail's cell is free again when the chain does not grow
  g.c.push(nc);
  if (!eat) g.c.shift();
  let flags = 0;
  if (fl >= 0) { g.f.splice(fl, 1); albaGood(ab, T, GAR.pts[0]); flags |= 1; const c = garSpawn(g, g.rf, 0); if (c >= 0) g.f.push(c); }
  if (gold) { g.gold = null; albaGood(ab, T, GAR.pts[1]); flags |= 2; }
  if (g.c.length >= GAR.full) { albaGood(ab, T, GAR.pts[2]); g.done++; flags |= 4; g.c = g.c.slice(-GAR.stub); g.q.length = 0; garAim(g); }
  if (flags) g.ev = [++g.seq, flags, nc];
  g.simAt = T + garInt(g, ab, T);
}

ALBA_RULES.garland = {
  init(S, p, ab) {
    const W = GAR.W, sub = (x) => ({ seed: (ab.box.seed ^ x) | 0 });
    const g = ab.g = { c: [8 * W + 6, 8 * W + 7, 8 * W + 8], dir: 1, q: [], simAt: ab.runAt + GAR.lead, done: 0, f: [], gold: null, th: [], thAt: ab.runAt + GAR.thornFirst, goldAt: 0,
      rf: sub(0x1f1f1f), rt: sub(0x2e2e2e), rg: sub(0x3d3d3d), n: 0, hits: 0, seq: 0, ev: [0, 0, 0] };
    g.goldAt = ab.runAt + ri(g.rg, GAR.goldFirst[0], GAR.goldFirst[1]);
    for (let i = 0; i < GAR.flowers; i++) g.f.push(garSpawn(g, g.rf, 0));
  },
  adv(S, p, ab, now) {
    const g = ab.g;
    let i = 0;
    for (; i < GAR.catchup && g.simAt <= now; i++) { garStep(ab, g.simAt); albaTouch(ab); }
    if (g.simAt <= now) g.simAt = now;   // a long stall: skip the backlog
  },
  act(S, p, ab, a, now) {
    const g = ab.g, d = a.d;
    if (!Number.isInteger(d) || d < 0 || d > 3) return "bad";
    const last = g.q.length ? g.q[g.q.length - 1] : g.dir;
    if (d === last || d === (last ^ 2) || g.q.length >= GAR.queue) return null;   // nothing to turn, no instant reversal, the queue is full
    g.q.push(d);
    return null;
  },
  view(ab, now) {
    const g = ab.g;
    return [g.c.slice(), g.dir, Math.max(0, g.simAt - now), garInt(g, ab, now), g.f.slice(), g.gold && g.gold.until > now ? [g.gold.c, g.gold.until - now] : 0, g.th.slice(), g.done, g.q.slice(), g.ev.slice()];
  },
};
