// 일일 아르바이트 · 가로등 점등: Pac-Man in a 15 × 15 alley (plan §9.4; contract and shift engine in 66-alba.js).
// The alley is a seeded, left-right symmetric maze of one-tile corridors with loops and no dead ends (rooms on odd tiles, walls between); every open tile holds a
// street-lamp bulb (a pellet, 10) and the four corner rooms a big bulb (a power pellet). Light them all: +200 and the next alley (a function of seed and level).
// FIXED-STEP simulation (50 ms): `adv` replays steps from `g.simAt` to `now` (cap 40); an entity covers a tile in UNIT/speed steps (`pr` counts 0..UNIT units of the
// tile it is crossing, `sp` units per step), so all of it is integer arithmetic. The courier keeps going; an input (`{d: 0..3}`) queues the next turn (taken at the next
// junction; a reversal is taken at once). Four shadows chase by their own rules: 0 straight at him · 1 ambush (four tiles ahead) · 2 relentless (shortest way, never
// backs off, never scatters) · 3 whimsical (a seeded coin at every junction); the first, second and fourth also retreat to their corners for a while (scatter) now and then.
// A big bulb (or a fever) makes the shadows flee for 8 s (the fever's whole length): eating one is +200, +400, +800, +1600 in a row; being caught costs 30, puts everybody
// back at their start and breaks the combo. Pellets score in groups of five (50: the engine's combo counts the groups, so a fever comes after ~50 bulbs, not 10);
// the leftover is paid when the alley is cleared, when he is caught and at the end of the shift.
// ab.g = { seed, simAt, tk, lv, w: wall per tile, pel: 0 none · 1 bulb · 2 big bulb, left, pl / sh[i]: { x, y (the tile left), tx, ty (the tile going to), pr, dir (-1 none) } (+ for a shadow
//          home (hidden, waiting), wait, fr), want, wantAt, pwUntil, on, chain, pend, frz, rb, df, dk, seq, ev: [seq, kind, points], sentAt }
// view = [level, walls (15 hex words of 4), bulbs left (15 hex words), [[x, y] of the big bulbs], courier, [shadow ×4], ms of fright left, ms of freeze left, bulbs waiting for pay,
//         bulbs left, ev]; courier = [x, y, tx, ty, pr now, sp, dir]; shadow = [x, y, tx, ty, pr now, sp, 0 normal · 1 frightened · 2 hidden]
//         ev = [seq, 1 big bulb · 2 caught · 3 alley cleared · 4 shadow eaten, points]
const LAMP = {
  N: 15, STEP: 50, CATCH: 40, UNIT: 120, PSP: 40, SP: [34, 34, 36, 32], FSP: 22, PW: 8000,
  START: [7, 13], HOME: [[7, 5], [5, 3], [9, 3], [7, 1]], CORNER: [[13, 1], [1, 1], [1, 13], [13, 13]], DELAY: [0, 30, 60, 90], FREEZE: 16,
  PEL: 10, GROUP: 5, BIG: 50, CLEAR: 200, EAT: 200, PEN: 30, R2: 0.36, WANT: 40,
  CUT: [8, 5],   // a ~90 s shift: the first two alleys only light the bottom rows (from this row down), so a first alley takes about a minute
};
const lampEl = (lv) => 2 * lv;   // an alley is two "difficulty levels" at once (loops, scatter, shadow speed)
Object.assign(ALBA, { lamp: { name: "가로등 점등", npc: "hall_bori", place: "버드나무 골목", skill: "gather", par: 7300, mul: 1, outfit: ["top_willow_patrol"], tool: "torch", hint: "방향키 · WASD로 골목의 전구를 모두 켜세요. 그림자를 피하고, 큰 전구를 켜면 그림자를 잡을 수 있어요!" } });
const LAMP_D = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** The alley of a level: [wall per tile (1 wall · 0 open)]. Symmetric, connected, loops, no dead ends; more loops (an easier alley) for the first levels. */
function lampMaze(seed, lv) {
  const N = LAMP.N, box = { seed: (seed + Math.imul(lv + 1, 0x85ebca6b)) | 0 }, w = new Array(N * N).fill(1), at = (x, y) => y * N + x;
  const open = (x, y) => { w[at(x, y)] = 0; w[at(N - 1 - x, y)] = 0; };
  const seen = new Set([at(7, 13)]), st = [[7, 13]];
  open(7, 13);
  while (st.length) {   // a spanning tree over the left half's rooms (the centre column included), carved by a random walk
    const [x, y] = st[st.length - 1], nb = [[x, y - 2], [x + 2, y], [x, y + 2], [x - 2, y]].filter(([a, b]) => a >= 1 && a <= 7 && b >= 1 && b <= 13 && !seen.has(at(a, b)));
    if (!nb.length) { st.pop(); continue; }
    const [a, b] = nb[ri(box, 0, nb.length - 1)];
    open((x + a) >> 1, (y + b) >> 1); open(a, b); seen.add(at(a, b)); st.push([a, b]);
  }
  const walls = [];
  for (let y = 1; y <= 13; y++) for (let x = 1; x <= 7; x++) if (((x + y) & 1) && w[at(x, y)]) walls.push([x, y]);
  for (let i = Math.max(4, 14 - 2 * lampEl(lv)); i > 0 && walls.length; i--) { const [x, y] = walls.splice(ri(box, 0, walls.length - 1), 1)[0]; open(x, y); }   // loops
  const deg = (x, y) => (w[at(x, y - 1)] ? 0 : 1) + (w[at(x + 1, y)] ? 0 : 1) + (w[at(x, y + 1)] ? 0 : 1) + (w[at(x - 1, y)] ? 0 : 1);
  for (let pass = 0; pass < 40; pass++) {   // no dead ends: a room with one way out gets a second
    let fixed = 0;
    for (let y = 1; y <= 13; y += 2) for (let x = 1; x <= 7; x += 2) {
      if (deg(x, y) >= 2) continue;
      const c = [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]].filter(([a, b]) => a >= 1 && a <= 13 && b >= 1 && b <= 13 && w[at(a, b)]);
      if (c.length) { const [a, b] = c[ri(box, 0, c.length - 1)]; open(a, b); fixed++; }
    }
    if (!fixed) break;
  }
  return w;
}
const lampOpen = (g, x, y) => x >= 0 && y >= 0 && x < LAMP.N && y < LAMP.N && !g.w[y * LAMP.N + x];
const lampXY = (e) => [e.x + ((e.tx - e.x) * e.pr) / LAMP.UNIT, e.y + ((e.ty - e.y) * e.pr) / LAMP.UNIT];
const lampEnt = (x, y) => ({ x, y, tx: x, ty: y, pr: 0, dir: -1 });

/** A new alley: bulbs everywhere but under the courier, big ones in the corners; everybody at their start, a short pause. */
function lampLevel(g, lv) {
  const N = LAMP.N;
  g.lv = lv; g.w = lampMaze(g.seed, lv);
  g.pel = g.w.map((v) => (v ? 0 : 1));
  for (const [x, y] of LAMP.CORNER) g.pel[y * N + x] = 2;
  if (lv < LAMP.CUT.length) g.pel.fill(0, 0, LAMP.CUT[lv] * N);
  g.pel[LAMP.START[1] * N + LAMP.START[0]] = 0;
  g.left = g.pel.filter((v) => v).length;
  g.pwUntil = 0; g.on = 0; g.chain = 0; g.dk = -1; g.df = null;
  lampReset(g);
}
/** Everybody back to their start (a new alley, or the courier was caught): the shadows wait their turn at home. */
function lampReset(g) {
  g.pl = lampEnt(LAMP.START[0], LAMP.START[1]);
  g.want = -1; g.wantAt = 0; g.pwUntil = 0; g.on = 0; g.chain = 0;
  g.sh = LAMP.HOME.map(([x, y], i) => ({ ...lampEnt(x, y), home: 1, wait: LAMP.DELAY[i], fr: 0 }));
  g.frz = LAMP.FREEZE;
}
function lampFlush(ab, g, T) {
  if (g.pend) { albaGood(ab, T, LAMP.PEL * g.pend); g.pend = 0; }
}
/** The courier arrives on a tile: its bulb is lit. */
function lampEat(ab, g, T) {
  const p = g.pl, i = p.y * LAMP.N + p.x, v = g.pel[i];
  if (!v) return;
  g.pel[i] = 0; g.left--;
  if (v === 2) { lampFlush(ab, g, T); g.ev = [++g.seq, 1, albaGood(ab, T, LAMP.BIG)]; g.pwUntil = T + LAMP.PW; g.on = 0; }
  else if (++g.pend >= LAMP.GROUP) lampFlush(ab, g, T);
  if (!g.left) {
    lampFlush(ab, g, T);
    g.ev = [++g.seq, 3, albaGood(ab, T, LAMP.CLEAR)];
    lampLevel(g, g.lv + 1);
  }
}
/** The courier's next tile: a queued turn if its tile is open, else straight on, else he waits. */
function lampPick(g) {
  const p = g.pl, w = g.want;
  if (w >= 0 && g.tk - g.wantAt > LAMP.WANT) g.want = -1;
  else if (w >= 0 && lampOpen(g, p.x + LAMP_D[w][0], p.y + LAMP_D[w][1])) { p.dir = w; g.want = -1; }
  if (p.dir >= 0 && lampOpen(g, p.x + LAMP_D[p.dir][0], p.y + LAMP_D[p.dir][1])) { p.tx = p.x + LAMP_D[p.dir][0]; p.ty = p.y + LAMP_D[p.dir][1]; } else { p.tx = p.x; p.ty = p.y; }
}
/** BFS distances to a tile over the open tiles (cached for the tile). */
function lampDist(g, x0, y0) {
  const N = LAMP.N, key = y0 * N + x0;
  if (g.dk === key) return g.df;
  const df = g.df = new Array(N * N).fill(-1), q = [key];
  df[key] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i], cx = c % N, cy = (c / N) | 0;
    for (const [dx, dy] of LAMP_D) { const n = (cy + dy) * N + cx + dx; if (lampOpen(g, cx + dx, cy + dy) && df[n] < 0) { df[n] = df[c] + 1; q.push(n); } }
  }
  g.dk = key;
  return df;
}
/** A shadow's next tile (it never turns back unless it must). */
function lampChoose(g, s, i) {
  const back = s.dir >= 0 ? (s.dir + 2) & 3 : -1, c = [];
  for (let d = 0; d < 4; d++) if (d !== back && lampOpen(g, s.x + LAMP_D[d][0], s.y + LAMP_D[d][1])) c.push(d);
  if (!c.length && back >= 0 && lampOpen(g, s.x + LAMP_D[back][0], s.y + LAMP_D[back][1])) c.push(back);
  if (!c.length) { s.tx = s.x; s.ty = s.y; return; }
  const p = g.pl, pt = p.pr * 2 >= LAMP.UNIT ? [p.tx, p.ty] : [p.x, p.y], sl = Math.max(20, 100 - 20 * lampEl(g.lv)), sc = g.tk % (sl + 300) < sl;   // scatter: the first `sl` steps of every cycle
  let d = c[0];
  if (s.fr) d = c[ri(g.rb, 0, c.length - 1)];
  else if (i === 3 && rnd(g.rb) < 0.4) d = c[ri(g.rb, 0, c.length - 1)];
  else if (i === 2) { const df = lampDist(g, pt[0], pt[1]); let best = 1e9; for (const q of c) { const v = df[(s.y + LAMP_D[q][1]) * LAMP.N + s.x + LAMP_D[q][0]]; if (v >= 0 && v < best) { best = v; d = q; } } }
  else {
    const tg = sc ? LAMP.CORNER[i] : i === 1 && p.dir >= 0 ? [pt[0] + 4 * LAMP_D[p.dir][0], pt[1] + 4 * LAMP_D[p.dir][1]] : pt;
    let best = 1e9;
    for (const q of c) { const dx = s.x + LAMP_D[q][0] - tg[0], dy = s.y + LAMP_D[q][1] - tg[1], v = dx * dx + dy * dy; if (v < best) { best = v; d = q; } }
  }
  s.dir = d; s.tx = s.x + LAMP_D[d][0]; s.ty = s.y + LAMP_D[d][1];
}
/** A shadow's speed (units a step): slower when it flees, quicker alley by alley, never as quick as the courier. */
const lampSp = (g, s, i) => (s.fr ? LAMP.FSP : Math.min(LAMP.PSP - 2, LAMP.SP[i] + 2 * Math.min(lampEl(g.lv), 3)));
/** One entity gains `sp` units; every tile it completes runs `arrive` and picks the next (the rest of the step carries over). */
function lampMove(g, e, sp, choose, arrive) {
  if (e.tx === e.x && e.ty === e.y) { choose(e); if (e.tx === e.x && e.ty === e.y) { e.pr = 0; return; } }
  e.pr += sp;
  for (let n = 0; e.pr >= LAMP.UNIT && n < 2; n++) {
    e.pr -= LAMP.UNIT; e.x = e.tx; e.y = e.ty;
    if (arrive) { arrive(e); if (g.frz) return; }
    choose(e);
    if (e.tx === e.x && e.ty === e.y) { e.pr = 0; return; }
  }
}
/** Turn about in the middle of a tile (not at its very start: that would be a jump). */
function lampTurn(e) {
  if (e.pr <= 0 || (e.tx === e.x && e.ty === e.y)) return false;
  [e.x, e.tx] = [e.tx, e.x]; [e.y, e.ty] = [e.ty, e.y]; e.pr = LAMP.UNIT - e.pr; e.dir = (e.dir + 2) & 3;
  return true;
}
/** The shadows flee while a big bulb or a fever lasts (and turn about when it begins). */
function lampFright(ab, g, T) {
  const on = T < g.pwUntil || T < ab.feverUntil ? 1 : 0;
  if (on && !g.on) { g.chain = 0; for (const s of g.sh) { s.fr = s.home ? 0 : 1; if (s.fr) lampTurn(s); } }
  else if (!on && g.on) for (const s of g.sh) s.fr = 0;
  g.on = on;
}
function lampTick(ab, T) {
  const g = ab.g;
  g.simAt = T; g.tk++;
  if (g.frz > 0) { g.frz--; return; }
  lampFright(ab, g, T);
  lampMove(g, g.pl, LAMP.PSP, () => lampPick(g), () => lampEat(ab, g, T));
  if (g.frz) return;
  for (let i = 0; i < 4; i++) {
    const s = g.sh[i];
    if (s.home) { if (--s.wait <= 0) s.home = 0; continue; }
    lampMove(g, s, lampSp(g, s, i), (e) => lampChoose(g, e, i));
  }
  const [px, py] = lampXY(g.pl);
  let caught = false;
  for (const s of g.sh) {
    if (s.home) continue;
    const [sx, sy] = lampXY(s);
    if ((px - sx) ** 2 + (py - sy) ** 2 >= LAMP.R2) continue;
    if (s.fr) {   // eaten: 200, 400, 800, 1600, and it waits at home for 3 s
      g.ev = [++g.seq, 4, albaGood(ab, T, LAMP.EAT * (1 << g.chain))];
      g.chain = Math.min(3, g.chain + 1);
      const h = LAMP.HOME[g.sh.indexOf(s)];
      Object.assign(s, lampEnt(h[0], h[1]), { home: 1, wait: 60, fr: 0 });
    } else caught = true;
  }
  if (caught) {
    lampFlush(ab, g, T);
    albaBad(ab, LAMP.PEN);
    g.ev = [++g.seq, 2, 0];
    lampReset(g);
  }
}

ALBA_RULES.lamp = {
  init(S, p, ab) {
    ab.g = { seed: ri(ab.box, 1, 1e9), simAt: ab.runAt, tk: 0, lv: 0, w: null, pel: null, left: 0, pl: null, sh: null, want: -1, wantAt: 0, pwUntil: 0, on: 0, chain: 0, pend: 0, frz: 0, rb: { seed: ri(ab.box, 1, 1e9) }, df: null, dk: -1, seq: 0, ev: [0, 0, 0], sentAt: 0 };
    lampLevel(ab.g, 0);
  },
  adv(S, p, ab, now) {
    const g = ab.g, far = LAMP.STEP * LAMP.CATCH;
    if (now - g.simAt > far) g.simAt += Math.floor((now - far - g.simAt) / LAMP.STEP) * LAMP.STEP;   // a long stall: only the last steps are replayed
    while (g.simAt + LAMP.STEP <= now) lampTick(ab, g.simAt + LAMP.STEP);
    if (now >= ab.endAt) lampFlush(ab, g, now);
    albaTouch(ab);
  },
  act(S, p, ab, a, now) {
    const g = ab.g, d = a.d, pl = g.pl;
    if (!Number.isInteger(d) || d < 0 || d > 3) return "bad";
    g.want = d; g.wantAt = g.tk;
    if (pl.dir >= 0 && d === ((pl.dir + 2) & 3) && lampTurn(pl)) g.want = -1;   // a reversal is taken at once
    albaTouch(ab);
    return null;
  },
  view(ab, now) {
    const g = ab.g, N = LAMP.N, lag = Math.max(0, now - g.simAt), hex = (f) => { let s = ""; for (let y = 0; y < N; y++) { let v = 0; for (let x = 0; x < N; x++) if (f(y * N + x)) v |= 1 << x; s += v.toString(16).padStart(4, "0"); } return s; };
    const ent = (e) => { const idle = e.tx === e.x && e.ty === e.y || g.frz > 0 || e.home, sp = idle ? 0 : e === g.pl ? LAMP.PSP : lampSp(g, e, g.sh.indexOf(e)); return [e.x, e.y, e.tx, e.ty, Math.min(LAMP.UNIT * 2, Math.round(e.pr + (sp * lag) / LAMP.STEP)), sp]; };
    const big = []; for (let i = 0; i < N * N; i++) if (g.pel[i] === 2) big.push([i % N, (i / N) | 0]);
    return [g.lv, hex((i) => g.w[i]), hex((i) => g.pel[i]), big, [...ent(g.pl), g.pl.dir], g.sh.map((s) => [...ent(s), s.home ? 2 : s.fr ? 1 : 0]),
      Math.max(0, Math.max(g.pwUntil, ab.feverUntil) - now), Math.max(0, g.frz * LAMP.STEP - lag), g.pend, g.left, g.ev];
  },
};
