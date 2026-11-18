// 일일 아르바이트 · 해충 방제 (docs/design/daily-alba-minigames-2026-11-16.md §9.1): a Galaga-style shooter. Contract and shift engine: 66-alba.js.
// FIXED-STEP simulation: `ab.g.simAt` is the absolute ms of the last simulated step; `adv` (every tick and before every action) runs whole 50 ms
// steps up to `now` (at most 40 per call, a longer stall just skips ahead), so the shift is a function of the seed and of the (time, input) list only.
// Inputs are INTENTS, validated hard: { x: 0..240 } the ship's target (it walks ≤ 6 per step), { fire: 0|1 } the auto-fire while held (one spray per 4 steps).
// Field 240 × 300, the ship at y 282. Sines are an integer table (no float transcendentals), randomness only through `rnd(ab.box)`.
// ab.g = { simAt, n (steps run), wv (wave 1…), rest (steps until the next wave, 0 = fighting), sw (steps into this wave), ox oy fvx fvy (the formation's offset
//   and speed), cols, rows, kinds (row kinds, top first), F (per slot: 0 dead · 1 in formation · 2 away), left (bugs alive), D (away bugs: dives and returns),
//   q (queen) | null, B (sprays [x, y, dx]), W (webs [x, y]), rs (rescue bug) | null, sh (the ship), dn (steps to the next dive), wh (hits this wave), ev, seq, dirty }
// view = [wave, ms to the next wave (0 = fighting), [ship x, vx per step, stun ms, web ms, invulnerable ms, firing], formation | 0 = [ox, oy, vx, vy, cols,
//   "row kinds", [row masks of the bugs in place]], dives [kind, x, y, vx, vy, flags 1 spins a web · 2 flying back …], sprays [x, y, dx …], webs [x, y …],
//   rescue [x, y, vx] | 0, queen [x, y, hp, max] | 0, events [[seq, type, x, y, points]…], bugs left]
// event types: 1 bug shot · 2 diver shot · 3 ship rammed · 4 webbed · 5 rescued · 6 wave cleared · 7 queen hit · 8 queen shot · 9 queen spits a web
const PEST = { W: 240, H: 300, SY: 282, STEP: 50, SPD: 4, FCD: 4, BSP: 8, MAXV: 3, FX: 120, FY: 54, SPX: 26, SPY: 20, SWAY: 80, AMP: 20, DESC: 3, MAXDROP: 54, INTRO: 25,
  REST: 50, STUN: 40, INV: 20, WEB: 60, WEBSP: 4, COMMIT: 60,
  SINT: [0, 24, 45, 59, 64, 59, 45, 24, 0, -24, -45, -59, -64, -59, -45, -24],
  COLS: [6, 6, 7, 7, 8, 8, 8, 8], ROWS: [2, 3, 3, 4, 4, 4, 5, 5], KINDS: { 2: [1, 0], 3: [2, 1, 0], 4: [2, 1, 1, 0], 5: [2, 2, 1, 0, 0] },   // 0 cockroach · 1 mosquito · 2 moth
  WIG: [6, 14, 20], FRQ: [2, 3, 2], PTS: [10, 40, 60, 100, 100] };   // PTS: a bug in place · a diver · the rescue · the wave · the wave without a hit (extra)

// A shift is ~90 s, so a wave climbs two "difficulty levels" (size, speed, divers, queen) at once: wave 1 · 2 · 3 · 4 = level 1 · 3 · 5 · 7.
const pestLv = (wv) => 2 * wv - 1;
const pestSpeed = (wv) => { const l = pestLv(wv); return 4 + (l > 2) + (l > 4) + (l > 6); };
const pestSx = (g, i) => PEST.FX + (2 * (i % g.cols) - g.cols + 1) * 13 + g.ox;
const pestSy = (g, i) => PEST.FY + ((i / g.cols) | 0) * PEST.SPY + g.oy;
const pestQx = (g) => PEST.FX + g.ox, pestQy = (g) => PEST.FY - 26 + g.oy;

/** The formation's place for step `sw` of the wave: it flies in, then sways ±20 and steps down every 2 s. */
function pestForm(g) {
  const P = PEST, sw = g.sw, ph = Math.max(0, sw - P.INTRO), q = (ph + 20) % P.SWAY, oy = g.oy;
  g.ox = sw < P.INTRO ? 0 : q < 40 ? q - 20 : 60 - q;
  g.fvx = sw < P.INTRO ? 0 : q < 40 ? 1 : -1;
  g.oy = sw < P.INTRO ? -100 + 4 * sw : Math.min(P.MAXDROP, P.DESC * ((ph / 40) | 0));
  g.fvy = g.oy - oy;
}
function pestNew(ab, wv) {
  const g = ab.g, P = PEST, lv = pestLv(wv), i = Math.min(lv, 8) - 1, cols = P.COLS[i], rows = P.ROWS[i];
  g.wv = wv; g.cols = cols; g.rows = rows; g.kinds = P.KINDS[rows];
  g.F = new Array(cols * rows).fill(1); g.left = cols * rows;
  g.q = wv % 2 === 0 ? { hp: Math.min(26, 8 + 2 * lv), mx: Math.min(26, 8 + 2 * lv), wt: 30 } : null;
  if (g.q) g.left++;
  g.sw = 0; g.dn = 40; g.wh = 0; g.D = []; g.W = []; g.rs = null; g.rest = 0; g.oy = -100; g.fvy = 4; g.ox = 0; g.fvx = 0;
}
function pestEv(g, type, x, y, pts) {
  g.ev.push([++g.seq, type, Math.round(x), Math.round(y), pts | 0, g.n]);
  if (g.ev.length > 8) g.ev.shift();
}

/** One step of a bug that is away from its place (a dive, or its flight back from the top). Touches only `d`; returns 1 when the bug spins a web now. */
function pestDive(g, d, shx) {
  const P = PEST;
  if (d.st === 1) {
    const x = pestSx(g, d.i);
    d.vx = x - d.x; d.vy = 4; d.x = x; d.y += 4;
    return 0;
  }
  d.a++;
  const y = d.y0 + pestSpeed(g.wv) * d.a;
  if (y < P.SY - P.COMMIT) d.cx += clamp(shx - d.cx, -3, 3);   // it homes in on the ship, then commits to its line
  const x = clamp(d.cx + ((P.WIG[d.k] * P.SINT[((d.a * P.FRQ[d.k]) >> 2) & 15]) >> 6), 8, P.W - 8);
  d.vx = x - d.x; d.vy = y - d.y; d.x = x; d.y = y;
  const web = d.web && !d.wd && y >= 130 ? 1 : 0;
  if (web) d.wd = 1;
  if (y > P.H + 12) { d.st = 1; d.x = pestSx(g, d.i); d.y = -12; d.vx = 0; d.vy = 4; }   // it flew past: back from the top
  return web;
}

/** A spray at (bx, by) that flew from y `oy`: it hits the lowest thing on its way. Returns true when it is used up. */
function pestHit(ab, T, bx, by, oy) {
  const g = ab.g, P = PEST, sh = g.sh;
  let best = 0, bi = 0, bd = null, bestY = -1e9;
  const test = (x, y, hw, hh, tag, i, d) => {
    if (Math.abs(bx - x) <= hw + 1 && y + hh >= by && y - hh <= oy && y > bestY) { bestY = y; best = tag; bi = i; bd = d; }
  };
  if (g.rs) test(g.rs.x, g.rs.y, 9, 8, 4, 0, null);
  if (g.q) test(pestQx(g), pestQy(g), 12, 8, 3, 0, null);
  for (const d of g.D) test(d.x, d.y, 5, 5, 2, d.i, d);
  for (let i = 0; i < g.F.length; i++) if (g.F[i] === 1) test(pestSx(g, i), pestSy(g, i), 5, 5, 1, i, null);
  if (!best) return false;
  if (best === 4) {
    const r = g.rs, pts = albaGood(ab, T, P.PTS[2]);
    sh.web = 0; sh.inv = Math.max(sh.inv, 10); g.rs = null;
    pestEv(g, 5, r.x, r.y, pts);
  } else if (best === 3) {
    const q = g.q;
    if (--q.hp > 0) { pestEv(g, 7, pestQx(g), pestQy(g), 0); return true; }
    g.q = null; g.left--;
    pestEv(g, 8, pestQx(g), pestQy(g), albaGood(ab, T, P.PTS[3]));
  } else if (best === 2) {
    g.D.splice(g.D.indexOf(bd), 1); g.F[bi] = 0; g.left--;
    pestEv(g, bd.st ? 1 : 2, bd.x, bd.y, albaGood(ab, T, bd.st ? P.PTS[0] : P.PTS[1]));
  } else {
    g.F[bi] = 0; g.left--;
    pestEv(g, 1, pestSx(g, bi), pestSy(g, bi), albaGood(ab, T, P.PTS[0]));
  }
  return true;
}

/** The fighting part of a step: the formation, the dives, the webs. */
function pestFight(ab, T) {
  const g = ab.g, P = PEST, sh = g.sh;
  g.sw++; pestForm(g);
  const live = g.sw > P.INTRO;
  if (g.q && live && --g.q.wt <= 0) { g.q.wt = 60; g.W.push([sh.x, pestQy(g) + 10]); pestEv(g, 9, pestQx(g), pestQy(g), 0); }
  if (live && --g.dn <= 0) {
    let away = 0;
    for (const d of g.D) away += d.st === 0 ? 1 : 0;
    const open = [];
    for (let i = 0; i < g.F.length; i++) if (g.F[i] === 1) open.push(i);
    const lv = pestLv(g.wv);
    if (away < 1 + (lv > 2) + (lv > 4) + (lv > 6) && open.length) {
      const i = open[ri(ab.box, 0, open.length - 1)], k = g.kinds[(i / g.cols) | 0], x = pestSx(g, i), y = pestSy(g, i);
      g.F[i] = 2;
      g.D.push({ i, k, x, y, y0: y, cx: x, a: 0, st: 0, vx: 0, vy: 0, web: k === 1 && g.wv >= 2 && rnd(ab.box) < 0.5 ? 1 : 0, wd: 0 });
      g.dn = Math.max(16, 44 - 3 * lv) + ri(ab.box, 0, 10);
    } else g.dn = 10;
  }
  for (let j = g.D.length - 1; j >= 0; j--) {
    const d = g.D[j];
    if (pestDive(g, d, sh.x)) g.W.push([d.x, d.y + 6]);
    if (d.st === 1 && d.y >= pestSy(g, d.i)) { g.F[d.i] = 1; g.D.splice(j, 1); }
  }
  for (let j = g.W.length - 1; j >= 0; j--) {
    const w = g.W[j];
    w[1] += P.WEBSP;
    if (w[1] > P.SY + 8) g.W.splice(j, 1);
    else if (w[1] >= P.SY - 8 && Math.abs(w[0] - sh.x) <= 12 && !sh.web && !sh.inv) {   // webbed: a flashing rescue bug runs across, shoot it to be free
      g.W.splice(j, 1);
      sh.web = P.WEB; sh.inv = Math.max(sh.inv, P.INV); g.wh++;
      albaBad(ab, 0);
      const right = sh.x >= P.W / 2;
      g.rs = { x: sh.x + (right ? -60 : 60), y: P.SY - 66, vx: right ? 3 : -3 };
      pestEv(g, 4, sh.x, P.SY, 0);
    }
  }
  if (g.rs) { const r = g.rs; r.x += r.vx; if (r.x < 8 || r.x > P.W - 8) { r.x = clamp(r.x, 8, P.W - 8); r.vx = -r.vx; } }
}

function pestStep(ab, T) {
  const g = ab.g, P = PEST, sh = g.sh;
  g.n++;
  if (sh.stun > 0) sh.stun--;
  if (sh.web > 0 && --sh.web === 0) g.rs = null;
  if (sh.inv > 0) sh.inv--;
  if (sh.cd > 0) sh.cd--;
  sh.vx = 0;
  if (!sh.stun && !sh.web) { const d = clamp(sh.tx - sh.x, -P.SPD, P.SPD); sh.x += d; sh.vx = d; }
  if (sh.fire && !sh.stun && !sh.cd) {
    const fan = T < ab.feverUntil, n = fan ? 3 : 1;   // a fever: the three-way spray
    let vol = 0;
    for (const b of g.B) vol += b[2] ? 0 : 1;   // only so many sprays may be in the air (a fan counts once: its middle one)
    if (vol < P.MAXV) { for (let k = 0; k < n; k++) g.B.push([sh.x, P.SY - 8, fan ? (k - 1) * 2 : 0]); sh.cd = P.FCD; }
  }
  if (g.rest) { if (--g.rest === 0) pestNew(ab, g.wv + 1); }
  else pestFight(ab, T);
  const keep = [];
  for (const b of g.B) {
    const oy = b[1];
    b[1] -= P.BSP; b[0] += b[2];
    if (b[1] < -6 || b[0] < 0 || b[0] > P.W || pestHit(ab, T, b[0], b[1], oy)) continue;
    keep.push(b);
  }
  g.B = keep;
  for (let j = g.D.length - 1; j >= 0; j--) {   // a diver that reaches the ship: a stun
    const d = g.D[j];
    if (d.st || sh.inv || Math.abs(d.x - sh.x) >= 12 || Math.abs(d.y - P.SY) >= 10) continue;
    d.st = 1; d.x = pestSx(g, d.i); d.y = -12; d.vx = 0; d.vy = 4; g.wh++;   // it bounces off and flies back from the top (a rammed bug is not a dead bug)
    sh.stun = P.STUN; sh.inv = P.STUN + P.INV;
    albaBad(ab, 0);
    pestEv(g, 3, sh.x, P.SY, 0);
  }
  if (!g.rest && g.left <= 0) {
    const noHit = g.wh === 0;
    g.rest = P.REST; g.W = []; g.rs = null; sh.web = 0;
    pestEv(g, 6, P.FX, 150, albaGood(ab, T, noHit ? P.PTS[3] + P.PTS[4] : P.PTS[3]));
  }
  while (g.ev.length && g.n - g.ev[0][5] > 12) g.ev.shift();
  if (!g.rest || g.B.length || sh.vx || g.ev.length) g.dirty = 1;
}

ALBA.pest = { name: "해충 방제", npc: "bogle", place: "보글연금공방 지하 창고", skill: "alch", par: 5700, mul: 1.1, outfit: ["hat_goggles", "top_alch"], tool: "sprayer", hint: "마우스·손가락·←→로 이동, 분무는 자동! 급강하하는 놈과 거미줄을 피하세요." };
ALBA_RULES.pest = {
  init(S, p, ab) {
    ab.g = { simAt: ab.runAt, n: 0, wv: 0, rest: 0, sw: 0, ox: 0, oy: 0, fvx: 0, fvy: 0, cols: 0, rows: 0, kinds: [], F: [], left: 0, D: [], q: null, B: [], W: [], rs: null,
      sh: { x: PEST.FX, tx: PEST.FX, vx: 0, stun: 0, web: 0, inv: 0, cd: 0, fire: 0 }, dn: 0, wh: 0, ev: [], seq: 0, dirty: 0 };
    pestNew(ab, 1);
  },
  adv(S, p, ab, now) {
    const g = ab.g;
    let k = 0;
    for (; k < 40 && g.simAt + PEST.STEP <= now; k++) { g.simAt += PEST.STEP; pestStep(ab, g.simAt); }
    if (k === 40 && g.simAt + PEST.STEP <= now) g.simAt += Math.floor((now - g.simAt) / PEST.STEP) * PEST.STEP;   // a long stall: skip ahead
    if (g.dirty) { g.dirty = 0; albaTouch(ab); }
  },
  act(S, p, ab, a, now) {
    const sh = ab.g.sh, x = a.x, f = a.fire;
    if (x === undefined && f === undefined) return "bad";
    if (x !== undefined && (!Number.isInteger(x) || x < 0 || x > PEST.W)) return "bad";
    if (f !== undefined && f !== 0 && f !== 1) return "bad";
    if (sh.stun) return null;   // a stunned sprayer takes no orders
    if (x !== undefined) sh.tx = clamp(x, 8, PEST.W - 8);
    if (f !== undefined) sh.fire = f;
    albaTouch(ab);
    return null;
  },
  view(ab, now) {
    const g = ab.g, sh = g.sh, P = PEST, lag = now - g.simAt, ms = (st) => Math.max(0, st * P.STEP - lag);
    const fm = g.rest ? 0 : [g.ox, g.oy, g.fvx, g.fvy, g.cols, g.kinds.join(""), g.kinds.map((_, r) => { let m = 0; for (let c = 0; c < g.cols; c++) if (g.F[r * g.cols + c] === 1) m |= 1 << c; return m; })];
    const D = [], B = [], W = [];
    for (const d of g.D) D.push(d.k, d.x, d.y, d.vx, d.vy, d.st ? 2 : d.web && !d.wd ? 1 : 0);
    for (const b of g.B) B.push(b[0], b[1], b[2]);
    for (const w of g.W) W.push(w[0], w[1]);
    const q = g.q;
    return [g.wv, g.rest ? ms(g.rest) : 0, [sh.x, sh.vx, ms(sh.stun), ms(sh.web), ms(sh.inv), sh.fire], fm, D, B, W, g.rs ? [g.rs.x, g.rs.y, g.rs.vx] : 0,
      q ? [pestQx(g), pestQy(g), q.hp, q.mx] : 0, g.ev.map((e) => e.slice(0, 5)), g.left];
  },
};
