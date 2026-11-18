// 일일 아르바이트 · 세탁소: a Puyo-style washer, 6 columns × 12 rows (plan §3.5; contract and shift engine in 66-alba.js).
// Pairs of coloured laundry fall; 4+ of one colour touching (orthogonally) are washed, the rest falls, chains go on. Stains (7) only come off by a
// wash right next to them; a detergent block (8, falls alone) washes every piece of the colour it lands on. LAZY gravity as in the parcel game:
// absolute `fallAt` in `ab.g`, `adv` applies every drop / lock / spawn whose time passed. Pieces come only from `ab.box` (stains use their own box `g.sb`).
// ab.g = { b: 72 cells (0 empty · 1-6 colour · 7 stain), cur: {a, b (0 = single), x, y, o} (pivot a at x,y; b at the side o: 0 up 1 right 2 down 3 left) | null,
//          next: [a, b], fallAt, spawnAt, locks, washes (chain steps), wc (cells washed), n (pairs spawned), det, stain (locks to the next stains), sb, seq, ev }
// ev = [seq, chain steps, washed cells (cell*8+colour, ≤48), flags 1 = the washer was emptied]
// view = [board (72 chars: . empty · 1-6 colour · s stain), cur [x,y,v, x,y,v], next [a,b], ms to the next drop (or arrival), drop interval, chain steps so far, ev]
const LAUNDRY_W = 6, LAUNDRY_H = 12, LAUNDRY_GAP = 350;   // the next pair comes this long after a lock
const LAUNDRY_DX = [0, 1, 0, -1], LAUNDRY_DY = [-1, 0, 1, 0];

const laundryCells = (c) => (c.b ? [[c.x, c.y, c.a], [c.x + LAUNDRY_DX[c.o], c.y + LAUNDRY_DY[c.o], c.b]] : [[c.x, c.y, c.a]]);
function laundryFits(g, cells) {
  for (const [x, y] of cells) if (x < 0 || x >= LAUNDRY_W || y < 0 || y >= LAUNDRY_H || g.b[y * LAUNDRY_W + x]) return false;
  return true;
}
function laundryNb(i) {
  const o = [], x = i % LAUNDRY_W;
  if (x > 0) o.push(i - 1);
  if (x < LAUNDRY_W - 1) o.push(i + 1);
  if (i >= LAUNDRY_W) o.push(i - LAUNDRY_W);
  if (i < LAUNDRY_W * (LAUNDRY_H - 1)) o.push(i + LAUNDRY_W);
  return o;
}
/** Everything falls to the bottom of its column. */
function laundrySettle(b) {
  for (let x = 0; x < LAUNDRY_W; x++) {
    let d = LAUNDRY_H - 1;
    for (let y = LAUNDRY_H - 1; y >= 0; y--) {
      const v = b[y * LAUNDRY_W + x];
      if (!v) continue;
      if (d !== y) { b[d * LAUNDRY_W + x] = v; b[y * LAUNDRY_W + x] = 0; }
      d--;
    }
  }
}
/** The colour groups of 4+ touching cells: { cells, groups }. */
function laundryGroups(b) {
  const seen = new Uint8Array(b.length), cells = [];
  let groups = 0;
  for (let i = 0; i < b.length; i++) {
    const col = b[i];
    if (col < 1 || col > 6 || seen[i]) continue;
    const st = [i], comp = [];
    seen[i] = 1;
    while (st.length) {
      const j = st.pop();
      comp.push(j);
      for (const k of laundryNb(j)) if (!seen[k] && b[k] === col) { seen[k] = 1; st.push(k); }
    }
    if (comp.length >= 4) { groups++; cells.push(...comp); }
  }
  return { cells, groups };
}
/** Settle, wash, settle, wash … until nothing is left to wash. `first` = { cells, groups } a detergent washes in the first step.
 *  Returns the steps [{ n colour cells, groups, stains, cells (cell*8+colour) }]; the stains touching a wash go with it. */
function laundryResolve(b, first) {
  const steps = [];
  for (let s = 0; s < 24; s++) {
    laundrySettle(b);
    const { cells, groups } = s === 0 && first ? first : laundryGroups(b);
    if (!cells.length) break;
    const mark = new Set(cells);
    for (const i of cells) for (const j of laundryNb(i)) if (b[j] === 7) mark.add(j);
    let n = 0, stains = 0;
    const rec = [];
    for (const i of mark) { if (b[i] === 7) stains++; else n++; rec.push(i * 8 + b[i]); b[i] = 0; }
    steps.push({ n, groups, stains, cells: rec });
  }
  return steps;
}
/** The next piece off the line: a pair, or every so often a detergent block; the 6th colour joins late. */
function laundryDraw(g, box) {
  if (--g.det <= 0) { g.det = ri(box, 11, 15); return [8, 0]; }
  const nc = g.n >= 24 ? 6 : 5;
  return [ri(box, 1, nc), ri(box, 1, nc)];
}
/** Ms between drops: faster with every chain step, ×0.7 in the rush, ×1.5 slower in a fever ("건조기"). */
const laundryDrop = (g, ab, T) => Math.round(Math.max(200, 650 - 16 * g.washes) * (T >= ab.endAt - ALBA_T.rushMs ? 0.7 : 1) * (T < ab.feverUntil ? 1.5 : 1));

/** A pair arrives at the top; if its place is taken the stack reached the ceiling: the washer is emptied. */
function laundrySpawn(ab, T) {
  const g = ab.g, nx = g.next, c = { a: nx[0], b: nx[1], x: 2, y: 1, o: 0 };
  g.next = laundryDraw(g, ab.box);
  g.n++;
  if (!laundryFits(g, laundryCells(c))) { g.b.fill(0); albaBad(ab, 100); g.ev = [++g.seq, 0, [], 1]; }
  g.cur = c;
  g.fallAt = T + laundryDrop(g, ab, T);
}
/** The piece rests: it joins the pile (a detergent washes the colour under it), chains resolve, stains drop at intervals. */
function laundryLock(ab, T) {
  const g = ab.g, c = g.cur, b = g.b, W = LAUNDRY_W;
  g.cur = null; g.spawnAt = T + LAUNDRY_GAP; g.locks++;
  let first = null;
  if (c.b) for (const [x, y, v] of laundryCells(c)) b[y * W + x] = v;
  else {
    const j = (c.y + 1) * W + c.x, v = c.y < LAUNDRY_H - 1 ? b[j] : 0;
    if (v >= 1 && v <= 6) first = { cells: b.map((q, i) => (q === v ? i : -1)).filter((i) => i >= 0), groups: 1 };
    else if (v === 7) first = { cells: [j], groups: 0 };
  }
  const steps = laundryResolve(b, first);
  steps.forEach((s, i) => albaGood(ab, T, Math.round((50 * s.groups + 10 * Math.max(0, s.n - 4 * s.groups) + 25 * s.stains) * 2 ** Math.min(i, 6))));
  if (steps.length) {
    g.washes += steps.length;
    for (const s of steps) g.wc += s.n;
    g.ev = [++g.seq, steps.length, steps.flatMap((s) => s.cells).slice(0, 48), 0];
  }
  if (--g.stain <= 0) {
    g.stain = Math.max(4, 8 - ((g.wc / 16) | 0));
    for (let i = 0, m = Math.min(1 + ((g.wc / 20) | 0), 3); i < m; i++) {
      const x = ri(g.sb, 0, W - 1);
      let y = LAUNDRY_H - 1;
      while (y >= 0 && b[y * W + x]) y--;
      if (y >= 2) b[y * W + x] = 7;   // never into the top two rows
    }
  }
}

ALBA.laundry = { name: "세탁소", npc: "costume", place: "의상실 세탁실", skill: "craft", par: 6800, mul: 1.1, outfit: ["top_apron_moka"], tool: "basket", hint: "←→ 이동 · ↑ 회전 · ↓ 천천히 · 스페이스 바로 내리기. 같은 색 4개를 이어 세탁하세요. 얼룩은 옆에서 세탁해야 풀려요." };
ALBA_RULES.laundry = {
  init(S, p, ab) {
    const g = ab.g = { b: new Array(LAUNDRY_W * LAUNDRY_H).fill(0), cur: null, next: null, fallAt: 0, spawnAt: ab.runAt, locks: 0, washes: 0, wc: 0, n: 0, det: 12, stain: 7, sb: { seed: (ab.box.seed ^ 0x2f6b9a1d) | 0 }, seq: 0, ev: [0, 0, [], 0] };
    g.next = laundryDraw(g, ab.box);
  },
  adv(S, p, ab, now) {
    const g = ab.g;
    let i = 0;
    for (; i < 40; i++) {
      if (g.cur) {
        if (g.fallAt > now) break;
        const T = g.fallAt, c = g.cur;
        if (laundryFits(g, laundryCells({ ...c, y: c.y + 1 }))) { c.y++; g.fallAt = T + laundryDrop(g, ab, T); } else laundryLock(ab, T);
      } else { if (g.spawnAt > now) break; laundrySpawn(ab, g.spawnAt); }
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
      if (!laundryFits(g, laundryCells({ ...c, x: c.x + mv }))) return "wall";
      c.x += mv;
    } else if (rot !== undefined) {
      if (rot !== 1 && rot !== -1) return "bad";
      if (!c.b) return "round";
      const o = (c.o + rot + 4) % 4;
      let n = { ...c, o };
      if (!laundryFits(g, laundryCells(n))) {   // push the pivot away from the wall or pile (a kick)
        n = { ...c, o, x: c.x - LAUNDRY_DX[o], y: c.y - LAUNDRY_DY[o] };
        if (!laundryFits(g, laundryCells(n))) return "blocked";
      }
      c.o = n.o; c.x = n.x; c.y = n.y;
    } else if (drop === 1) {
      if (!laundryFits(g, laundryCells({ ...c, y: c.y + 1 }))) return "floor";
      c.y++; g.fallAt = now + laundryDrop(g, ab, now);
    } else if (drop === 2) {
      while (laundryFits(g, laundryCells({ ...c, y: c.y + 1 }))) c.y++;
      laundryLock(ab, now);
    } else return "bad";
    albaTouch(ab);
    return null;
  },
  view(ab, now) {
    const g = ab.g, c = g.cur;
    let s = "";
    for (let i = 0; i < g.b.length; i++) { const v = g.b[i]; s += v ? (v === 7 ? "s" : v) : "."; }
    return [s, c ? laundryCells(c).flat() : [], g.next, Math.max(0, (c ? g.fallAt : g.spawnAt) - now), laundryDrop(g, ab, now), g.washes, g.ev];
  },
};
