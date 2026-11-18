// 일일 아르바이트 · 철거 알바 (docs/design/daily-alba-minigames-2026-11-16.md §9.2): an Arkanoid-style brick breaker. Contract and shift engine: 66-alba.js.
// FIXED-STEP simulation: `ab.g.simAt` is the absolute ms of the last simulated step; `adv` (every tick and before every action) runs whole 50 ms steps up to
// `now` (at most 40 per call, a longer stall just skips ahead), so a shift is a function of the seed and of the (time, input) list only. Each step moves a
// ball in 4 sub-steps, in INTEGER fixed point (1/16 px): a ball is a direction (dx, dy ≈ 64 long) times the level's speed, no floats, no transcendentals.
// Input is an INTENT, validated hard: { x: 0..240 } the paddle's target (it moves ≤ 10 px per step). Balls launch by themselves.
// Field 240 × 240; 12 × 9 brick cells of 20 × 8 from y 28 (a wall fills 3 rows, then 5, 7 and from the fourth wall 8, standing on the bottom rows; the rush drops it one row); the paddle's top is y 222.
// ab.g = { simAt, n (steps run), lv (wall 0…), k (per cell: 0 none · 1 plain · 2 bomb · 3 bonus box), h (hits left of a plain brick), it (a bonus box's item),
//   left (bricks standing), drop (rush: the wall came down a row), balls [{x, y (1/16 px), dx, dy, held}], pad {x, tx, vx, hw}, sv (steps until the ball is served),
//   I (falling items {x, y, k}), fw fp fs (steps left of wide paddle · piercing · slow ball), ch (bricks hit since the paddle last touched a ball), ev, seq, dirty }
// view = [wall, [paddle x, vx per step, half width], 108 chars ('.' none · hits left 1-3 · b bomb · w m p s bonus box by item), balls [x, y, vx, vy (¼ px per step), held …],
//   items [x, y, kind …], [wide ms, piercing ms, slow ms, serve ms], events [[seq, type, x, y, value]…], bricks left, big ball (fever) 0|1]
// event types: 1 brick broken (value = points of the blow) · 2 brick cracked (hits left) · 3 bomb · 4 item caught (kind) · 5 ball lost · 6 wall cleared (points) · 7 paddle bounce · 8 item dropped (kind)
// items: 0 wide paddle · 1 three balls · 2 piercing · 3 slow ball
const WALL = { W: 240, H: 240, STEP: 50, SUB: 4, BW: 20, BH: 8, COLS: 12, ROWS: 9, Y0: 28, PY: 222, PSPD: 10, HW: [20, 32], SERVE: 30, RESERVE: 60, FALL: 3,
  TAB: [[-55, 32], [-48, 43], [-38, 52], [-26, 58], [-13, 63], [0, 64], [13, 63], [26, 58], [38, 52], [48, 43], [55, 32]],   // paddle bounce directions, 12° apart (dx, up)
  FX: [240, 160, 200], PTS: { plain: 10, crack: 5, bomb: 20, box: 30, item: 30, wall: 150, lost: 50 } };
const wallSpeed = (g) => (((40 + 6 * Math.min(g.lv, 3)) * (g.fs > 0 ? 7 : 10)) / 10) | 0;   // 1/16 px per sub-step
const wallEv = (g, type, x, y, v) => { g.ev.push([++g.seq, type, Math.round(x), Math.round(y), v | 0, g.n]); if (g.ev.length > 8) g.ev.shift(); };
/** A brick event scores through the combo and a chain bonus (+20 % per brick hit since the paddle last touched a ball, up to +100 %; a piercing ball sweeps for the flat price). */
function wallScore(ab, T, base, flat) {
  const g = ab.g, c = flat ? 0 : Math.min(g.ch, 5);
  g.ch++;
  return albaGood(ab, T, Math.round((base * (10 + 2 * c)) / 10));
}

/** Lay out wall `g.lv`: a shape by number, harder bricks and more bombs as the walls go on, bonus boxes with their items. */
function wallBuild(ab) {
  const g = ab.g, box = ab.box, lv = g.lv, W = WALL, N = W.COLS * W.ROWS, pool = [];
  g.k = new Array(N).fill(0); g.h = new Array(N).fill(0); g.it = new Array(N).fill(0);
  const ph = Math.min(0.55, 0.1 + 0.14 * lv), t = lv % 5, rows = Math.min(8, 3 + 2 * lv);   // a shift holds about two walls: the first is small, the next ones climb fast
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < W.COLS; c++) {
      const on = t === 0 ? true : t === 1 ? c % 4 !== 3 : t === 2 ? c >= (r >> 1) && c <= 11 - (r >> 1) : t === 3 ? (r + c) % 2 === 0 : r === 0 || r === rows - 1 || c < 2 || c > 9 || (r % 2 === 1 && c >= 4 && c <= 7);
      if (!on) continue;
      const i = (r + 8 - rows + g.drop) * W.COLS + c, u = rnd(box);   // a small wall stands on the bottom rows, close to the paddle
      g.k[i] = 1; g.h[i] = lv >= 2 && u < ph * 0.3 ? 3 : u < ph ? 2 : 1;
      pool.push(i);
    }
  }
  const put = (kind, n) => {
    for (let j = 0; j < n && pool.length; j++) {
      const i = pool.splice(ri(box, 0, pool.length - 1), 1)[0];
      g.k[i] = kind; g.h[i] = 1;
      if (kind === 3) g.it[i] = ri(box, 0, 3);
    }
  };
  put(2, Math.min(8, 2 + 2 * lv)); put(3, lv >= 3 ? 5 : 4);
  g.left = g.k.reduce((n, v) => n + (v ? 1 : 0), 0);
}
/** The rush: the whole wall comes down one row. */
function wallDrop(g) {
  const C = WALL.COLS, N = C * WALL.ROWS;
  for (const a of [g.k, g.h, g.it]) { for (let i = N - 1; i >= C; i--) a[i] = a[i - C]; for (let i = 0; i < C; i++) a[i] = 0; }
  g.drop = 1;
}
const wallHeld = (g) => ({ x: g.pad.x * 16, y: (WALL.PY - 3) * 16, dx: 0, dy: 0, held: 1 });

/** Destroy brick `i0` (and the bricks a bomb takes with it): points once for the whole blow, items fall from bonus boxes. */
function wallBreak(ab, T, i0, flat) {
  const g = ab.g, W = WALL, q = [i0], pops = [];
  let base = 0;
  while (q.length) {
    const i = q.pop(), k = g.k[i];
    if (!k) continue;
    const r = (i / W.COLS) | 0, c = i % W.COLS, x = c * W.BW + W.BW / 2, y = W.Y0 + r * W.BH + W.BH / 2;
    g.k[i] = 0; g.h[i] = 0; g.left--;
    pops.push([x, y, k]);
    if (k === 2) {
      base += W.PTS.bomb;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && rr < W.ROWS && cc >= 0 && cc < W.COLS) q.push(rr * W.COLS + cc); }
    } else if (k === 3) { base += W.PTS.box; g.I.push({ x, y, k: g.it[i] }); wallEv(g, 8, x, y, g.it[i]); }
    else base += W.PTS.plain;
  }
  const pts = wallScore(ab, T, base, flat);
  pops.forEach(([x, y, k], j) => wallEv(g, k === 2 ? 3 : 1, x, y, j ? 0 : pts));
}
/** A ball touches brick `i`: a hard brick cracks, anything else (or any brick, for a piercing ball) is destroyed. */
function wallDamage(ab, T, i, pierce) {
  const g = ab.g, W = WALL;
  g.hn = g.n;
  if (!pierce && g.k[i] === 1 && g.h[i] > 1) {
    g.h[i]--;
    wallScore(ab, T, W.PTS.crack);
    wallEv(g, 2, (i % W.COLS) * W.BW + W.BW / 2, W.Y0 + ((i / W.COLS) | 0) * W.BH + W.BH / 2, g.h[i]);
  } else wallBreak(ab, T, i, pierce);
}

/** One step (4 sub-steps) of a ball: walls, ceiling, paddle, bricks. Returns false when it fell out of the field. */
function wallBall(ab, T, b) {
  const g = ab.g, W = WALL, pad = g.pad, big = T < ab.feverUntil, R = (big ? 5 : 3) * 16, pierce = big || g.fp > 0, sp = wallSpeed(g);
  const WQ = W.W * 16, PYQ = W.PY * 16, BWQ = W.BW * 16, BHQ = W.BH * 16, Y0Q = W.Y0 * 16;
  for (let s = 0; s < W.SUB; s++) {
    let nx = b.x + ((b.dx * sp / 64) | 0), ny = b.y + ((b.dy * sp / 64) | 0);
    if (nx < R) { nx = R; b.dx = Math.abs(b.dx); } else if (nx > WQ - R) { nx = WQ - R; b.dx = -Math.abs(b.dx); }
    if (ny < R) { ny = R; b.dy = Math.abs(b.dy); }
    if (b.dy > 0 && b.y + R <= PYQ + 48 && ny + R > PYQ && Math.abs(nx - pad.x * 16) <= pad.hw * 16 + R) {   // the paddle: the angle comes from where the ball lands on it
      let idx = clamp(Math.round(5 + (5 * (nx - pad.x * 16)) / (pad.hw * 16 + R)), 0, 10);
      if (g.n - g.hn > 100) { idx = ri(ab.box, 0, 10); g.hn = g.n; }   // 5 s without breaking a brick: this bounce goes wherever it likes (no endless loops, no unreachable last brick)
      ny = PYQ - R; b.dx = W.TAB[idx][0]; b.dy = -W.TAB[idx][1]; g.ch = 0;
      wallEv(g, 7, nx / 16, W.PY, 0);
    }
    const c0 = Math.max(0, Math.floor((nx - R) / BWQ)), c1 = Math.min(W.COLS - 1, Math.floor((nx + R - 1) / BWQ));
    const r0 = Math.max(0, Math.floor((ny - R - Y0Q) / BHQ)), r1 = Math.min(W.ROWS - 1, Math.floor((ny + R - 1 - Y0Q) / BHQ));
    let hit = -1, area = 0, hox = 0, hoy = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * W.COLS + c;
        if (!g.k[i]) continue;
        const ox = Math.min(nx + R, (c + 1) * BWQ) - Math.max(nx - R, c * BWQ), oy = Math.min(ny + R, Y0Q + (r + 1) * BHQ) - Math.max(ny - R, Y0Q + r * BHQ);
        if (pierce) { wallDamage(ab, T, i, true); continue; }
        if (ox * oy > area) { area = ox * oy; hit = i; hox = ox; hoy = oy; }
      }
    }
    if (hit >= 0) {   // bounce off the face it went in by (the smaller overlap), both ways at a corner
      const c = hit % W.COLS, r = (hit / W.COLS) | 0, bx = c * BWQ + BWQ / 2, by = Y0Q + r * BHQ + BHQ / 2;
      if (hox <= hoy) { nx = nx < bx ? c * BWQ - R : (c + 1) * BWQ + R; b.dx = nx < bx ? -Math.abs(b.dx) : Math.abs(b.dx); }
      if (hoy <= hox) { ny = ny < by ? Y0Q + r * BHQ - R : Y0Q + (r + 1) * BHQ + R; b.dy = ny < by ? -Math.abs(b.dy) : Math.abs(b.dy); }
      wallDamage(ab, T, hit, false);
    }
    if (Math.abs(b.dy) < 16) b.dy = b.dy < 0 ? -16 : 16;   // never a flat, endless rally
    b.x = nx; b.y = ny;
    if (ny > (W.H + 8) * 16) return false;
  }
  return true;
}
/** A caught item: points and its effect. */
function wallItem(ab, T, k) {
  const g = ab.g;
  albaGood(ab, T, WALL.PTS.item);
  if (k === 0) g.fw = WALL.FX[0]; else if (k === 2) g.fp = WALL.FX[1]; else if (k === 3) g.fs = WALL.FX[2];
  else {   // three balls: the first flying ball splits into itself and two turned ±20°
    const b = g.balls.find((z) => !z.held);
    if (b && g.balls.length < 3) for (const s of [1, -1]) g.balls.push({ x: b.x, y: b.y, dx: ((b.dx * 60 - s * b.dy * 22) / 64) | 0, dy: ((s * b.dx * 22 + b.dy * 60) / 64) | 0, held: 0 });
  }
}

function wallStep(ab, T) {
  const g = ab.g, W = WALL, pad = g.pad;
  g.n++;
  if (g.fw > 0) g.fw--;
  if (g.fp > 0) g.fp--;
  if (g.fs > 0) g.fs--;
  pad.hw = g.fw > 0 ? W.HW[1] : W.HW[0];
  const x0 = pad.x;
  pad.x = clamp(pad.x + clamp(pad.tx - pad.x, -W.PSPD, W.PSPD), pad.hw, W.W - pad.hw);
  pad.vx = pad.x - x0;
  if (!g.drop && T >= ab.endAt - ALBA_T.rushMs) wallDrop(g);
  if (g.balls[0].held) {   // waiting to be served: the ball rides the paddle; once the timer is out and the player has done anything, it flies off at one of four angles
    const b = g.balls[0];
    b.x = pad.x * 16;
    if (g.sv > 0) g.sv--;
    if (!g.sv && g.la && g.n - g.la <= 120) { const t = W.TAB[[3, 4, 6, 7][ri(ab.box, 0, 3)]]; b.dx = t[0]; b.dy = -t[1]; b.held = 0; g.ch = 0; g.hn = g.n; }
  } else {
    const keep = [];
    for (const b of g.balls) if (wallBall(ab, T, b)) keep.push(b);
    g.balls = keep;
    if (!keep.length) {
      albaBad(ab, W.PTS.lost);
      g.fw = g.fp = g.fs = 0; g.ch = 0; g.sv = W.RESERVE; g.balls = [wallHeld(g)];
      wallEv(g, 5, pad.x, W.PY, 0);
    }
  }
  const keepI = [];
  for (const it of g.I) {
    it.y += W.FALL;
    if (it.y >= W.PY - 4 && it.y <= W.PY + 10 && Math.abs(it.x - pad.x) <= pad.hw + 6) { wallItem(ab, T, it.k); wallEv(g, 4, it.x, W.PY, it.k); } else if (it.y < W.H + 10) keepI.push(it);
  }
  g.I = keepI;
  if (g.left <= 0) {   // the wall is down: the next, harder one
    wallEv(g, 6, W.W / 2, 100, albaGood(ab, T, W.PTS.wall));
    g.lv++; g.fw = g.fp = g.fs = 0; g.I = []; g.ch = 0; g.sv = W.SERVE;
    wallBuild(ab);
    g.balls = [wallHeld(g)];
  }
  while (g.ev.length && g.n - g.ev[0][5] > 12) g.ev.shift();
  if (!g.balls[0].held || g.I.length || pad.vx || g.ev.length) g.dirty = 1;
}

ALBA.wall = { name: "철거 알바", npc: "kangkang", place: "캉캉대장간 옆 헌 벽", skill: "craft", par: 3300, mul: 1.1, outfit: ["hat_coop_cap", "top_smith"], tool: "chain", hint: "마우스·손가락·←→로 발판을 움직여 철구를 받으세요. 벽돌을 다 부수면 새 벽! 떨어지는 상자는 발판으로 받기." };
ALBA_RULES.wall = {
  init(S, p, ab) {
    const g = ab.g = { simAt: ab.runAt, n: 0, lv: 0, k: [], h: [], it: [], left: 0, drop: 0, balls: [], pad: { x: 120, tx: 120, vx: 0, hw: WALL.HW[0] }, sv: WALL.SERVE, I: [], fw: 0, fp: 0, fs: 0, ch: 0, la: 0, hn: 0, ev: [], seq: 0, dirty: 0 };
    wallBuild(ab);
    g.balls = [wallHeld(g)];
  },
  adv(S, p, ab, now) {
    const g = ab.g;
    let k = 0;
    for (; k < 40 && g.simAt + WALL.STEP <= now; k++) { g.simAt += WALL.STEP; wallStep(ab, g.simAt); }
    if (k === 40 && g.simAt + WALL.STEP <= now) g.simAt += Math.floor((now - g.simAt) / WALL.STEP) * WALL.STEP;   // a long stall: skip ahead
    if (g.dirty) { g.dirty = 0; albaTouch(ab); }
  },
  act(S, p, ab, a, now) {
    const x = a.x, go = a.go, g = ab.g;
    if (x === undefined && go === undefined) return "bad";
    if (x !== undefined && (!Number.isInteger(x) || x < 0 || x > WALL.W)) return "bad";
    if (go !== undefined && go !== 1) return "bad";
    g.la = g.n + 1;   // any input is the player's "ready" (for the next 6 s): an idle player never serves
    if (x !== undefined && g.pad.tx !== x) { g.pad.tx = x; albaTouch(ab); }
    return null;
  },
  view(ab, now) {
    const g = ab.g, W = WALL, lag = now - g.simAt, ms = (st) => Math.max(0, st * W.STEP - lag);
    let s = "";
    for (let i = 0; i < g.k.length; i++) s += g.k[i] === 1 ? g.h[i] : g.k[i] === 2 ? "b" : g.k[i] === 3 ? "wmps"[g.it[i]] : ".";
    const B = [], I = [];
    for (const b of g.balls) B.push(Math.round(b.x / 16), Math.round(b.y / 16), ((b.dx * wallSpeed(g)) / 64) | 0, ((b.dy * wallSpeed(g)) / 64) | 0, b.held);
    for (const it of g.I) I.push(it.x, it.y, it.k);
    return [g.lv + 1, [g.pad.x, g.pad.vx, g.pad.hw], s, B, I, [ms(g.fw), ms(g.fp), ms(g.fs), ms(g.sv)], g.ev.map((e) => e.slice(0, 5)), g.left, now < ab.feverUntil ? 1 : 0];
  },
};
