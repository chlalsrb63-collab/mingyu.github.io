// 일일 아르바이트 · 배관 수리: 12×12 Pipe-Mania, solo (contract in 66-alba.js; plan docs/design/daily-alba-minigames-2026-11-16.md §3.1).
// A shift is a series of SITES. One site = one board: the water comes in at the west edge (row `ir`) and must leave at the east edge (row `or`).
// The hand piece (and the next three, shown) come from a deck built from a hidden solution ROUTE: every piece it needs, in route order, plus ~30 %
// spares. A piece goes on any empty cell and stays for good. After every placement the water is traced from the inlet:
//   · it reaches the outlet → CLEARED  (100 + 3 per second left + 50 when nothing was trashed, through albaGood)
//   · its next cell is a rock, the board edge or a closed pipe side (or no way to the outlet is left) → a LEAK: the site is lost, the next one opens
//   · otherwise it waits at an empty cell for the next piece
// The route follows the player: when the water ends up somewhere the route does not go (a spare was built in, a dump sits on the route), a fresh
// shortest route is drawn from the water's cell and the deck is rebuilt for it; a piece lost to a slip or a trash is replaced right after the hand.
// So a site can always be finished (or it leaks at once). Trash discards the hand piece for 3 s off the site clock; skip gives a site up; a site
// that times out scores 0 (albaBad). A site is a pure function of the shift seed and its number.
//   act: {c: cell 0..143} place · {tr: 1} trash · {sk: 1} skip
//   view: [site n, inlet row, outlet row, 144-char board ("0" empty, hex = open sides N1 E2 S4 W8, "#" rock), hand + next three (hex), ms to open, ms to end, trashed, last site's end]
//   last site's end: 0 none · 1 cleared · 2 leak · 3 timeout · 4 skipped

Object.assign(ALBA, { pipe: { name: "배관 수리", npc: "popo", place: "마을회관 배관실", skill: "craft", par: 1100, mul: 1, outfit: ["hat_coop_cap","top_coop_vest"], tool: "wrench", hint: "조각을 칸에 놓아 급수구에서 배수구까지 길을 이으세요." } });

const APIPE = { gap: 800, trashMs: 3000, spare: 0.3, fit: 0.3, rock: 255 };
const APIPE_DX = [0, 1, 0, -1], APIPE_DY = [-1, 0, 1, 0];   // direction index: 0 N · 1 E · 2 S · 3 W; a piece is the mask of its open sides (1 << dir)
const APIPE_SPARE = [10, 5, 3, 6, 12, 9, 15];                  // straight ─ │, the four corners, the cross
const apipeLen = (n) => Math.min(40, 14 + 4 * n);               // cells on the first route (a ~90 s shift holds about 4-5 sites)
const apipeRocks = (n) => Math.min(30, 6 + 4 * n);
const apipeLimit = (n) => Math.max(28, 48 - 3 * n) * 1000;
const apipeDir = (a, b) => { const d = b - a; return d === -12 ? 0 : d === 1 ? 1 : d === 12 ? 2 : 3; };

/** A self-avoiding route of `want` cells (fewer when the board is too tight; at least the shortest) from cell `s` to cell `e` over the empty cells of `b` (`s` and `e` themselves count as empty); null when there is no way. */
function apipeRoute(box, s, e, want, b) {
  const ex = e % 12, ey = (e / 12) | 0, md = Math.abs(ex - (s % 12)) + Math.abs(ey - ((s / 12) | 0));
  let steps = Math.max(md, want - 1);
  if ((steps - md) & 1) steps--;
  for (; steps >= md; steps -= 2) {
    const seen = new Uint8Array(144), path = [s];
    let budget = 4000;
    seen[s] = 1;
    const dfs = (c, left) => {
      if (c === e) return left === 0;
      if (left === 0 || budget-- <= 0) return false;
      const x = c % 12, y = (c / 12) | 0, d = Math.abs(ex - x) + Math.abs(ey - y);
      if (d > left || ((left - d) & 1)) return false;
      const o = [0, 1, 2, 3];
      for (let i = 3; i > 0; i--) { const j = ri(box, 0, i), t = o[i]; o[i] = o[j]; o[j] = t; }
      for (const k of o) {
        const nx = x + APIPE_DX[k], ny = y + APIPE_DY[k], n = ny * 12 + nx;
        if (nx < 0 || ny < 0 || nx > 11 || ny > 11 || seen[n] || (b[n] !== 0 && n !== e)) continue;
        seen[n] = 1; path.push(n);
        if (dfs(n, left - 1)) return true;
        seen[n] = 0; path.pop();
      }
      return false;
    };
    if (dfs(s, steps)) return path;
  }
  const prev = new Int16Array(144).fill(-1), q = [s];   // the shortest way, ties broken by the seed
  prev[s] = s;
  for (let h = 0; h < q.length && prev[e] < 0; h++) {
    const c = q[h], x = c % 12, y = (c / 12) | 0, o = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = ri(box, 0, i), t = o[i]; o[i] = o[j]; o[j] = t; }
    for (const k of o) {
      const nx = x + APIPE_DX[k], ny = y + APIPE_DY[k], n = ny * 12 + nx;
      if (nx < 0 || ny < 0 || nx > 11 || ny > 11 || prev[n] >= 0 || (b[n] !== 0 && n !== e)) continue;
      prev[n] = c; q.push(n);
    }
  }
  if (prev[e] < 0) return null;
  const path = [];
  for (let c = e; ; c = prev[c]) { path.push(c); if (c === s) break; }
  return path.reverse();
}
/** The piece each route cell needs: the side to the previous cell (`from` for the first) and to the next (the outlet for the last). */
const apipeMasks = (path, from = 3) => path.map((c, i) => (1 << (i ? apipeDir(c, path[i - 1]) : from)) | (1 << (i < path.length - 1 ? apipeDir(c, path[i + 1]) : 1)));

/** The side each route cell is entered from (`from` for the first). */
const apipeEntries = (path, from) => path.map((c, i) => 1 << (i ? apipeDir(c, path[i - 1]) : from));
/** The deck for a route: its pieces in order, ~30 % spares between them (a spare seldom fits where the water would meet it). `en`: the entry sides; `first`: the lowest index a spare may precede. */
function apipeDeck(sb, pm, en, first) {
  const out = [];
  for (let i = 0; i < pm.length; i++) {
    if (i >= first && rnd(sb) < APIPE.spare) {
      let m = APIPE_SPARE[ri(sb, 0, 6)];
      for (let t = 0; t < 4 && (m & en[i]) && rnd(sb) >= APIPE.fit; t++) m = APIPE_SPARE[ri(sb, 0, 6)];
      out.push(m);
    }
    out.push(pm[i]);
  }
  return out;
}
/** Rebuild the deck after the hand for what the route still lacks, in route order. */
function apipeRebuild(g) {
  const pm = [], en = [];
  for (let i = 0; i < g.path.length; i++) if (g.b[g.path[i]] === 0) { pm.push(g.pm[i]); en.push(g.en[i]); }
  const rest = apipeDeck(g.sb, pm, en, 0);
  if (rest[0] === g.deck[g.di]) rest.shift();   // the hand already is the first piece
  g.deck.length = g.di + 1;
  g.deck.push(...rest);
}

/** Where the water ends up: r 0 waits at the empty cell c, entering it from side `from` · 1 reaches the outlet · 2 leaks. */
function apipeWalk(b, ir, or) {
  let x = 0, y = ir, from = 3;
  for (let k = 0; k < 300; k++) {
    if (x < 0 || y < 0 || x > 11 || y > 11) return { r: x === 12 && y === or ? 1 : 2 };
    const m = b[y * 12 + x];
    if (m === 0) return { r: 0, c: y * 12 + x, from };
    if (m === APIPE.rock || !(m & (1 << from))) return { r: 2 };
    const out = m === 15 ? (from + 2) & 3 : 31 - Math.clz32(m & ~(1 << from));
    x += APIPE_DX[out]; y += APIPE_DY[out]; from = (out + 2) & 3;
  }
  return { r: 2 };
}
const apipeTrace = (b, ir, or) => apipeWalk(b, ir, or).r;

/** Does the route still run from the water's cell `w`: it starts there, takes the water's side, and nothing wrong sits on the rest of it? */
function apipePlanOk(g, w) {
  const i = g.path.indexOf(w.c);
  if (i < 0 || !(g.pm[i] & (1 << w.from))) return false;
  for (let j = i + 1; j < g.path.length; j++) if (g.b[g.path[j]] !== 0 && g.b[g.path[j]] !== g.pm[j]) return false;
  return true;
}
/** A fresh route from the water's cell to the outlet over empty cells, about as long as what was still to build; the deck after the hand is rebuilt for it. False: no way left. */
function apipeReplan(g, w) {
  const e = g.or * 12 + 11;
  if (g.b[e] !== 0) return false;
  const path = apipeRoute(g.sb, w.c, e, g.path.filter((c) => g.b[c] === 0).length, g.b);
  if (!path) return false;
  g.path = path; g.pm = apipeMasks(path, w.from); g.en = apipeEntries(path, w.from);
  apipeRebuild(g);
  return true;
}
/** After a piece is used: when the deck no longer holds what the route lacks (a piece lost to a slip or a trash) it is rebuilt in route order, and five pieces stay ready. */
function apipeFeed(g) {
  const have = {};
  for (let i = g.di; i < g.deck.length; i++) have[g.deck[i]] = (have[g.deck[i]] || 0) + 1;
  for (let i = 0; i < g.path.length; i++) if (g.b[g.path[i]] === 0 && !(have[g.pm[i]]-- > 0)) { apipeRebuild(g); break; }
  while (g.deck.length - g.di < 5) g.deck.push(APIPE_SPARE[ri(g.sb, 0, 6)]);
}

/** Build site number `g.n + 1`, opening at `goAt`; `lr` is how the previous site ended. */
function apipeSite(ab, goAt, lr) {
  const g = ab.g, n = ++g.n, sb = { seed: (ab.box.seed ^ Math.imul(n, 0x9e3779b1)) | 0 };
  const ir = ri(sb, 0, 11), or = ri(sb, 0, 11), path = apipeRoute(sb, ir * 12, or * 12 + 11, apipeLen(n), new Array(144).fill(0)), pm = apipeMasks(path), en = apipeEntries(path, 3);
  const b = new Array(144).fill(0), onPath = new Set(path);
  for (let want = apipeRocks(n), tries = 0; want > 0 && tries < 500; tries++) {
    const c = ri(sb, 0, 143);
    if (!b[c] && !onPath.has(c)) { b[c] = APIPE.rock; want--; }
  }
  Object.assign(g, { sb, ir, or, path, pm, en, b, deck: apipeDeck(sb, pm, en, 1), di: 0, goAt, te: goAt + apipeLimit(n), tr: 0, lr });
  apipeFeed(g);
}
/** The site is over (not cleared: the caller already scored a clear): the combo breaks, the next site opens `gap` after `t`. */
function apipeEnd(ab, t, lr) {
  if (lr !== 1) albaBad(ab, 0);
  apipeSite(ab, t + APIPE.gap, lr);
}
function apipeAdv(ab, now) {
  const g = ab.g;
  while (now >= g.te) apipeEnd(ab, g.te, 3);
}

ALBA_RULES.pipe = {
  init(S, p, ab) {
    ab.g = { n: 0 };
    apipeSite(ab, ab.runAt, 0);
  },
  adv(S, p, ab, now) { apipeAdv(ab, now); },
  act(S, p, ab, a, now) {
    const g = ab.g;
    if (!isObj(a)) return "잘못된 입력";
    if (now < g.goAt) return "아직 준비 중입니다";
    if (a.c !== undefined) {
      const c = a.c;
      if (!Number.isInteger(c) || c < 0 || c > 143) return "잘못된 칸";
      if (g.b[c] !== 0) return "이미 놓인 칸입니다";
      g.b[c] = g.deck[g.di++];
      const w = apipeWalk(g.b, g.ir, g.or);
      if (w.r === 0 && !apipePlanOk(g, w) && !apipeReplan(g, w)) w.r = 2;   // no way to the outlet is left
      if (w.r === 1) {
        albaGood(ab, now, 100 + 3 * Math.max(0, Math.floor((g.te - now) / 1000)) + (g.tr ? 0 : 50));
        apipeEnd(ab, now, 1);
      } else if (w.r === 2) apipeEnd(ab, now, 2);
      else { apipeFeed(g); albaTouch(ab); }
      return null;
    }
    if (a.tr === 1) {
      g.di++; g.tr++;
      g.te = Math.max(now, g.te - APIPE.trashMs);
      apipeFeed(g);
      albaTouch(ab);
      apipeAdv(ab, now);
      return null;
    }
    if (a.sk === 1) { apipeEnd(ab, now, 4); return null; }
    return "잘못된 입력";
  },
  view(ab, now) {
    const g = ab.g;
    return [g.n, g.ir, g.or, g.b.map((m) => (m === APIPE.rock ? "#" : m.toString(16))).join(""), g.deck.slice(g.di, g.di + 4).map((m) => m.toString(16)).join(""),
      Math.max(0, g.goAt - now), Math.max(0, g.te - now), g.tr, g.lr];
  },
};
