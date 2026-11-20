// 일일 아르바이트 · 횡단 배달: Frogger on a 13 × 11 street (plan §9.3; contract and shift engine in 66-alba.js).
// Rows: 0 the drop-off · 1-4 the river (logs: stand on one or drown) · 5 the median · 6-9 the road (carts and walkers) · 10 the start.
// FIXED-STEP simulation: `adv` replays 50 ms steps from `g.simAt` up to `now` (a long stall carries the rider across and replays the last 40 steps);
// an input is applied to the state at `g.simAt` (the grid), never in between, so a seed plus the same inputs always plays the same shift.
// The lanes never move in the state: lane `y` holds a ring of `n` equal objects (ceil((13 + len) / sp) of them, `sp` cells apart) whose phase is a closed
// form of the time since the delivery began, so the server only steps the courier (carried by a log, checked against the lane) and the client
// draws every lane from three numbers. A delivery's layout is a function of (seed, delivery number): faster lanes, shorter logs, tighter gaps.
// ab.g = { seed, simAt, d (delivery number), n (delivered), L: lane per row (null = safe) | { k 0 cart 1 walker 2 log, v (cells/s ×10, signed), sp, len, ph (×100) },
//          dAt (the delivery's start, ms), goal (row of the drop-off), gifts: [{ y, j (log index, -1 = a cell of the road), a, got }], x (cells, fractional on a log), y,
//          stepAt (earliest ms of the next hop), hit (hurt on this delivery), acc (hops taken), seq, ev: [seq, kind, points], sentAt }
// view = [x ×100, y, ms until the next hop, goal row, delivery number (from 0), delivered, [[row, v, sp, len, kind, phase ×100]…], [[row, log | -1, cell | cell in the log]…],
//         ev, ms until the lanes start, hops taken, ms since the delivery began]; ev = [seq, 1 delivered · 2 delivered flawless · 3 hit · 4 water · 5 gift, points]
const CROSS = {
  W: 13, H: 11, SX: 6, SY: 10,
  D0: 2, VMAX: 2.0, MEND: 4000,      // (easier 2026-11-20) start at the 3rd delivery's street (D0 4), top 2.0× (2.4×), a heart a 4 s (5 s)
       // 2026-11-18: the street starts as hard as the old 5th delivery (D0), the lanes speed up to VMAX x (the old top was 1.6); a heart mends every MEND ms
  STEP: 50, CATCH: 40,
  CD: 300, CD_FEVER: 150, STUN: 500, PAUSE: 400,                   // ms: a hop's cooldown (halved in a fever), the pause after a hit, after a delivery
  PAY: 100, FLAWLESS: 50, GIFT: 30, HIT: 20, BONUS: 3, BONUS_MAX: 60, BUDGET: [12000, 26000],
  IN: 0.2, CIN: 0.1, SLACK: 0.2,                                   // hit-box inset of the courier and of a cart; how far past a log's end a foot still holds
};
Object.assign(ALBA, { cross: { name: "횡단 배달", npc: "inn_toto", place: "여관 앞 큰길", skill: "deliver", par: 1300, lives: 5, mul: 1, outfit: ["hat_coop_cap", "top_appr_deliver"], tool: "parcelbag", hint: "방향키 · WASD로 한 칸씩. 마차·행인에 치이거나 강에 빠지면 ♥ 하나(5개면 퇴근), 4초마다 ♥ 하나 회복. 통나무를 타고 건너 꾸러미를 전하세요." } });

const crossN = (ln) => Math.ceil((CROSS.W + ln.len) / ln.sp);
/** Where the ring's first object is (cells, 0 ≤ phase < ring length) `T` ms. */
function crossPhase(g, ln, T) {
  const C = ln.sp * crossN(ln), v = (ln.ph / 100 + (ln.v / 10) * ((T - g.dAt) / 1000)) % C;
  return v < 0 ? v + C : v;
}
/** The left edge (cells) of object `j` of a lane at time `T`; the ring wraps outside the street, so it never pops in view. */
const crossPos = (g, ln, j, T) => (crossPhase(g, ln, T) + j * ln.sp) % (ln.sp * crossN(ln)) - ln.len;

/** What is under the courier at `T`: 0 safe · 1 struck by a cart or a walker · 2 in the water (or carried off the street). `g.mg` lets a planner be stricter. */
function crossUnder(g, T) {
  const ln = g.L[g.y];
  if (!ln) return 0;
  const n = crossN(ln), mg = g.mg || 0;
  if (ln.k === 2) {
    const c = g.x + 0.5;
    if (c < 0 || c > CROSS.W) return 2;
    for (let j = 0; j < n; j++) { const p = crossPos(g, ln, j, T); if (c >= p - CROSS.SLACK + mg && c <= p + ln.len + CROSS.SLACK - mg) return 0; }
    return 2;
  }
  const a = g.x + CROSS.IN, b = g.x + 1 - CROSS.IN;
  for (let j = 0; j < n; j++) { const p = crossPos(g, ln, j, T); if (b > p + CROSS.CIN - mg && a < p + ln.len - CROSS.CIN + mg) return 1; }
  return 0;
}
/** The state to time `T` (> g.simAt): a log carries its rider; returns crossUnder. */
function crossMove(g, T) {
  const dt = T - g.simAt, ln = g.L[g.y];
  g.simAt = T;
  if (ln && ln.k === 2) g.x += (ln.v / 10) * (dt / 1000);
  return crossUnder(g, T);
}

/** Where hop `d` (0 up · 1 right · 2 down · 3 left) leads from the courier: [x, y], or null at an edge. A log's rider keeps his fraction; on the ground he steps by whole cells. */
function crossHop(g, d) {
  let x = g.x, y = g.y;
  if (d === 0) y--; else if (d === 2) y++; else x += d === 1 ? 1 : -1;
  if (y < g.goal || y > CROSS.SY) return null;
  const river = g.L[y] && g.L[y].k === 2;
  x = river ? (d & 1 ? clamp(x, -0.3, CROSS.W - 0.7) : x) : clamp(Math.round(x), 0, CROSS.W - 1);
  return x === g.x && y === g.y ? null : [x, y];
}

/** A delivery's whole street: a function of (seed, delivery number, rush). Walkers and carts on the road, logs on the river; two gifts. */
function crossBuild(seed, d, rush) {
  const box = { seed: (seed + Math.imul(d + 1, 0x9e3779b1)) | 0 };
  const dd = d + CROSS.D0, m = Math.min(CROSS.VMAX, 1 + 0.15 * dd) * rush, ml = Math.min(CROSS.VMAX * 0.94, 1 + 0.125 * dd) * rush, flip = rnd(box) < 0.5 ? 1 : -1;
  const L = new Array(CROSS.H).fill(null);
  const mk = (y, k, v, len, sp) => { L[y] = { k, v: Math.round(v * 10) * flip * (y % 2 ? 1 : -1), sp, len, ph: ri(box, 0, sp * 100 - 1) }; };
  const logLen = Math.max(3, 5 - (dd >> 1));
  for (let y = 1; y <= 4; y++) mk(y, 2, (0.5 + 0.4 * rnd(box)) * ml, logLen, logLen + 1 + ri(box, 0, 1) + (dd > 2 ? 1 : 0));
  mk(6, 0, (1.0 + 0.6 * rnd(box)) * m, 2, Math.max(5, 10 - dd) + ri(box, 0, 1));
  mk(7, 1, (0.5 + 0.3 * rnd(box)) * m, 1, 4 + ri(box, 0, 2));
  mk(8, 0, (0.9 + 0.6 * rnd(box)) * m, 2, Math.max(5, 10 - dd) + ri(box, 0, 1));
  mk(9, 1, (0.4 + 0.3 * rnd(box)) * m, 1, 4 + ri(box, 0, 2));
  const gifts = [{ y: 6 + ri(box, 0, 3), j: -1, a: ri(box, 1, CROSS.W - 2), got: 0 }];
  { const y = 1 + ri(box, 0, 3), ln = L[y]; gifts.push({ y, j: ri(box, 0, crossN(ln) - 1), a: ri(box, 0, ln.len - 1), got: 0 }); }
  return { L, gifts, goal: 0 };
}
/** A new delivery begins at `T`: the courier is at the start, the street is new. */
function crossNew(ab, T, pause) {
  const g = ab.g;
  g.d++;
  Object.assign(g, crossBuild(g.seed, g.d, T >= ab.endAt - ALBA_T.rushMs ? 1.2 : 1));
  g.dAt = T; g.x = CROSS.SX; g.y = CROSS.SY; g.hit = 0; g.stepAt = T + pause;
}
function crossLose(ab, g, T, why) {
  albaStrike(ab, T, CROSS.HIT);   // run over or in the river: a heart
  g.hit = 1; g.x = CROSS.SX; g.y = why === 2 && g.goal === 0 ? 5 : CROSS.SY; g.stepAt = T + CROSS.STUN;   // water: back to the median; a cart: back to the start
  g.ev = [++g.seq, why === 1 ? 3 : 4, 0];
}
/** A gift under the courier's feet is taken (+30). */
function crossLoot(ab, g, T) {
  for (const f of g.gifts) {
    if (f.got || f.y !== g.y) continue;
    const gc = (f.j < 0 ? 0 : crossPos(g, g.L[f.y], f.j, T)) + f.a + 0.5;
    if (Math.abs(g.x + 0.5 - gc) < 0.6) { f.got = 1; g.ev = [++g.seq, 5, albaGood(ab, T, CROSS.GIFT)]; }
  }
}
/** The courier is at the drop-off: 100 + the time left (3 a second, at most 60) + 50 for a clean run; then the next delivery. */
function crossDeliver(ab, T) {
  const g = ab.g, left = CROSS.BUDGET[1] - (T - g.dAt);
  const bonus = clamp(Math.round((left / 1000) * CROSS.BONUS), 0, CROSS.BONUS_MAX), clean = g.hit ? 0 : CROSS.FLAWLESS;
  const pts = albaGood(ab, T, CROSS.PAY + bonus + clean);
  g.n++;
  g.ev = [++g.seq, clean ? 2 : 1, pts];
  crossNew(ab, T, CROSS.PAUSE);
}
function crossTick(ab, T) {
  const g = ab.g, r = crossMove(g, T);
  if (T >= g.mendAt) { g.mendAt += CROSS.MEND; if (ab.strikes > 0 && !ab.out) { ab.strikes--; albaTouch(ab); } }
  if (r) crossLose(ab, g, T, r); else crossLoot(ab, g, T);
}

ALBA_RULES.cross = {
  init(S, p, ab) {
    ab.g = { seed: ri(ab.box, 1, 1e9), simAt: ab.runAt, d: -1, n: 0, L: null, dAt: ab.runAt, goal: 5, gifts: [], x: CROSS.SX, y: CROSS.SY, stepAt: ab.runAt, hit: 0, acc: 0, mendAt: ab.runAt + CROSS.MEND, seq: 0, ev: [0, 0, 0], sentAt: 0 };
    crossNew(ab, ab.runAt, 0);
  },
  adv(S, p, ab, now) {
    const g = ab.g, far = CROSS.STEP * CROSS.CATCH;
    if (now - g.simAt > far) {   // a long stall: the rider rides through it, then only the last steps are replayed
      const T = g.simAt + Math.floor((now - far - g.simAt) / CROSS.STEP) * CROSS.STEP, ln = g.L[g.y];
      if (ln && ln.k === 2) g.x += (ln.v / 10) * ((T - g.simAt) / 1000);
      g.simAt = T;
    }
    while (g.simAt + CROSS.STEP <= now) crossTick(ab, g.simAt + CROSS.STEP);
    if (now - g.sentAt >= 1000) albaTouch(ab);   // the view is also resent about once a second (a reloaded page gets the whole state)
  },
  act(S, p, ab, a, now) {
    const g = ab.g, d = a.d, T = g.simAt;
    if (!Number.isInteger(d) || d < 0 || d > 3) return "bad";
    if (T < g.stepAt) return "wait";
    const to = crossHop(g, d);
    if (!to) return "edge";
    const [x, y] = to;
    g.x = x; g.y = y; g.acc++;
    g.stepAt = T + (T < ab.feverUntil ? CROSS.CD_FEVER : CROSS.CD);
    const r = crossUnder(g, T);
    if (r) crossLose(ab, g, T, r);
    else { crossLoot(ab, g, T); if (g.y === g.goal) crossDeliver(ab, T); }
    albaTouch(ab);
    return null;
  },
  view(ab, now) {
    const g = ab.g, T = Math.max(now, g.dAt), ln = g.L[g.y], lanes = [], gifts = [];
    g.sentAt = now;
    const x = g.x + (ln && ln.k === 2 ? (ln.v / 10) * (Math.max(0, now - g.simAt) / 1000) : 0);
    for (let y = 0; y < CROSS.H; y++) { const l = g.L[y]; if (l) lanes.push([y, l.v, l.sp, l.len, l.k, Math.round(crossPhase(g, l, T) * 100)]); }
    for (const f of g.gifts) if (!f.got) gifts.push([f.y, f.j, f.a]);
    return [Math.round(x * 100), g.y, Math.max(0, g.stepAt - now), g.goal, g.d, g.n, lanes, gifts, g.ev, Math.max(0, g.dAt - now), g.acc, Math.max(0, now - g.dAt)];
  },
};
