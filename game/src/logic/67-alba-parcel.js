// 일일 아르바이트 · 택배 상하차: Tetris with boxes on a truck bed, 8 wide × 10 high (plan §3.4; contract and shift engine in 66-alba.js).
// LAZY gravity: the falling box keeps an absolute `fallAt`; `adv` (every tick and before each action) applies every drop / lock / spawn whose
// time has passed, in order, with its own timestamp. The sequence of boxes comes only from `ab.box` (one draw per box), so a seed fixes it.
// ab.g = { b: kind+1 per cell (0 empty), fr: fragile-box id per cell (0 none), cur: {k, r, x, y, f} | null (waiting for the conveyor),
//          next: {k, f}, fallAt, spawnAt, rows (shipped), n (boxes spawned), fid, seq, ev: [seq, flags 1 shipped · 2 truck swapped · 4 fragile broken, shipped-row mask] }
// view = [board (80 chars: . empty · 1-7 box kind · f fragile), cur cells [x,y,…], cur kind (0 none), cur fragile, next cells [x,y,…], next kind, next fragile,
//         ms to the next drop (or arrival), drop interval, rows shipped, ev]   — the client duplicates no shape table.
const PARCEL_W = 8, PARCEL_H = 10, PARCEL_GAP = 300;   // the conveyor brings the next box this long after a lock
const PARCEL_PAY = [0, 100, 250, 500, 900];
/** The distinct clockwise rotations of a box (cells normalised to the top-left corner, row-major). */
function parcelRots(cells) {
  const out = [], seen = new Set();
  let c = cells;
  for (let i = 0; i < 4; i++) {
    const mx = Math.min(...c.map((q) => q[0])), my = Math.min(...c.map((q) => q[1]));
    const n = c.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]), key = n.join(";");
    if (!seen.has(key)) { seen.add(key); out.push(n); }
    c = n.map(([x, y]) => [-y, x]);
  }
  return out;
}
/** 0 1×1 · 1 2×1 · 2 3×1 · 3 2×2 · 4 L (3 cells) · 5 L (4 cells) · 6 4×1 */
const PARCEL_SHAPES = [
  [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [3, 0]],
].map(parcelRots);
const PARCEL_WT = [3, 6, 3, 3, 5, 3, 2], PARCEL_WT2 = [0, 0, 0, 3, 0, 3, 3];   // weights by kind; the big boxes gain weight as the shift goes on

function parcelFits(g, k, r, x, y) {
  for (const [dx, dy] of PARCEL_SHAPES[k][r]) {
    const cx = x + dx, cy = y + dy;
    if (cx < 0 || cx >= PARCEL_W || cy < 0 || cy >= PARCEL_H || g.b[cy * PARCEL_W + cx]) return false;
  }
  return true;
}
/** The next box off the conveyor (fragile ones are the flat boxes, after the first few). */
function parcelDraw(g, box) {
  const big = Math.min(g.n, 12) / 12, w = PARCEL_WT.map((v, i) => v + PARCEL_WT2[i] * big);
  let r = rnd(box) * w.reduce((a, b) => a + b, 0), k = 0;
  while (k < 6 && r >= w[k]) r -= w[k++];
  return { k, f: k <= 2 && g.n >= 2 && rnd(box) < 0.18 ? 1 : 0 };
}
/** Ms between drops: faster with every row shipped, ×0.7 in the rush, ×1.5 slower in a fever ("지게차"). */
const parcelDrop = (g, ab, T) => Math.round(Math.max(190, 560 - 16 * g.rows) * (T >= ab.endAt - ALBA_T.rushMs ? 0.65 : 1) * (T < ab.feverUntil ? 1.5 : 1));

/** The box comes off the conveyor at the top; a blocked spawn means the stack reached the ceiling: the truck is swapped. */
function parcelSpawn(ab, T) {
  const g = ab.g, nx = g.next, w = 1 + Math.max(...PARCEL_SHAPES[nx.k][0].map((q) => q[0])), x = (PARCEL_W - w) >> 1;
  g.next = parcelDraw(g, ab.box);
  g.n++;
  if (!parcelFits(g, nx.k, 0, x, 0)) { g.b.fill(0); g.fr.fill(0); albaStrike(ab, T, 100); g.ev = [++g.seq, 2, 0]; }   // a full truck costs a life
  g.cur = { k: nx.k, r: 0, x, y: 0, f: nx.f };
  g.fallAt = T + parcelDrop(g, ab, T);
}
/** The box rests: it joins the stack, full rows ship (the rows above fall), a covered fragile box costs 30 (once per box). */
function parcelLock(ab, T) {
  const g = ab.g, c = g.cur, W = PARCEL_W, N = W * PARCEL_H, fid = c.f ? (g.fid = (g.fid % 900) + 1) : 0;
  const mine = PARCEL_SHAPES[c.k][c.r].map(([dx, dy]) => (c.y + dy) * W + c.x + dx);
  for (const i of mine) { g.b[i] = c.k + 1; g.fr[i] = fid; }
  const full = [];
  for (let y = 0; y < PARCEL_H; y++) if (!g.b.slice(y * W, y * W + W).includes(0)) full.push(y);
  let flags = 0;
  const hit = new Set();
  for (const i of mine) { const j = i + W; if (j < N && g.fr[j] && !mine.includes(j) && !full.includes((j / W) | 0)) hit.add(g.fr[j]); }
  for (const id of hit) { for (let i = 0; i < N; i++) if (g.fr[i] === id) g.fr[i] = 0; albaStrike(ab, T, 30); flags |= 4; }   // a crushed box costs a life
  if (full.length) {
    const keep = [...Array(PARCEL_H).keys()].filter((y) => !full.includes(y)), nb = new Array(N).fill(0), nf = new Array(N).fill(0);
    keep.forEach((y, i) => { for (let x = 0; x < W; x++) { const d = (PARCEL_H - keep.length + i) * W + x; nb[d] = g.b[y * W + x]; nf[d] = g.fr[y * W + x]; } });
    g.b = nb; g.fr = nf; g.rows += full.length; flags |= 1;
    albaGood(ab, T, PARCEL_PAY[full.length]);
  }
  if (flags) g.ev = [++g.seq, flags, full.reduce((m, y) => m | (1 << y), 0)];
  g.cur = null; g.spawnAt = T + PARCEL_GAP;
}

ALBA.parcel = { name: "택배 상하차", npc: "shop", place: "광장 택배 집하장", skill: "deliver", par: 2100, lives: 5, mul: 1.15, outfit: ["hat_coop_cap", "top_appr_deliver"], tool: "box", hint: "←→ 이동 · ↑ 회전 · ↓ 천천히 · 스페이스 바로 내리기. 한 줄을 채우면 출하! 깨짐 주의 상자를 눌러도, 트럭이 가득 차도 ♥ 하나." };
ALBA_RULES.parcel = {
  init(S, p, ab) {
    const g = ab.g = { b: new Array(PARCEL_W * PARCEL_H).fill(0), fr: new Array(PARCEL_W * PARCEL_H).fill(0), cur: null, next: null, fallAt: 0, spawnAt: ab.runAt, rows: 0, n: 0, fid: 0, seq: 0, ev: [0, 0, 0] };
    g.next = parcelDraw(g, ab.box);
  },
  adv(S, p, ab, now) {
    const g = ab.g;
    let i = 0;
    for (; i < 40; i++) {
      if (g.cur) { if (g.fallAt > now) break; const T = g.fallAt, c = g.cur; if (parcelFits(g, c.k, c.r, c.x, c.y + 1)) { c.y++; g.fallAt = T + parcelDrop(g, ab, T); } else parcelLock(ab, T); }
      else { if (g.spawnAt > now) break; parcelSpawn(ab, g.spawnAt); }
      albaTouch(ab);
    }
    if (i === 40) { g.fallAt = Math.max(g.fallAt, now); g.spawnAt = Math.max(g.spawnAt, now); }   // a long stall: skip the backlog
  },
  act(S, p, ab, a, now) {
    const g = ab.g, c = g.cur, mv = a.mv, rot = a.rot, drop = a.drop;
    if ((mv !== undefined) + (rot !== undefined) + (drop !== undefined) !== 1) return "bad";
    if (!c) return "wait";
    if (mv !== undefined) {
      if (mv !== 1 && mv !== -1) return "bad";
      if (!parcelFits(g, c.k, c.r, c.x + mv, c.y)) return "wall";
      c.x += mv;
    } else if (rot !== undefined) {
      if (rot !== 1 && rot !== -1) return "bad";
      const n = PARCEL_SHAPES[c.k].length, r = (c.r + rot + n) % n;
      if (n === 1) return "round";
      let hit = false;
      for (const dy of [0, -1, -2, -3]) {
        for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
          if (c.y + dy < 0 || !parcelFits(g, c.k, r, c.x + dx, c.y + dy)) continue;
          c.r = r; c.x += dx; c.y += dy; hit = true; break;
        }
        if (hit) break;
      }
      if (!hit) return "blocked";
    } else {
      if (drop === 1) {
        if (!parcelFits(g, c.k, c.r, c.x, c.y + 1)) return "floor";
        c.y++; g.fallAt = now + parcelDrop(g, ab, now);
      } else if (drop === 2) {
        while (parcelFits(g, c.k, c.r, c.x, c.y + 1)) c.y++;
        parcelLock(ab, now);
      } else return "bad";
    }
    albaTouch(ab);
    return null;
  },
  view(ab, now) {
    const g = ab.g, c = g.cur;
    let s = "";
    for (let i = 0; i < g.b.length; i++) s += g.b[i] ? (g.fr[i] ? "f" : g.b[i]) : ".";
    return [s, c ? PARCEL_SHAPES[c.k][c.r].flatMap(([dx, dy]) => [c.x + dx, c.y + dy]) : [], c ? c.k + 1 : 0, c ? c.f : 0, PARCEL_SHAPES[g.next.k][0].flat(), g.next.k + 1, g.next.f,
      Math.max(0, (c ? g.fallAt : g.spawnAt) - now), parcelDrop(g, ab, now), g.rows, g.ev];
  },
};
