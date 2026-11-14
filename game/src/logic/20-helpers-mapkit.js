// ───────────────────────────── helpers ─────────────────────────────

/** Small seeded generator; `box.seed` is advanced in place. */
function rnd(box) {
  box.seed = (box.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(box.seed ^ (box.seed >>> 15), 1 | box.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (box, a, b) => a + Math.floor(rnd(box) * (b - a + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
/**
 * The Korean particle that follows a word, picked by its last sound: pp("양", "이가") → "이",
 * pp("대검", "을를") → "을", pp("무기", "으로") → "로". A trailing digit is read aloud (2 → 이 → "가").
 */
function pp(word, pair) {
  const c = String(word).trim().slice(-1), code = c.charCodeAt(0);
  const d = "0123456789".indexOf(c);
  const jong = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : d >= 0 ? [21, 8, 0, 16, 0, 0, 1, 8, 8, 0][d] : 0;
  if (pair === "으로") return jong && jong !== 8 ? "으로" : "로";
  return jong ? pair[0] : pair[1];
}
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v) => typeof v === "number" && Number.isFinite(v);
/**
 * Experience a level asks for: the old curve times a factor that grows with level,
 * so every band is lived in for a while — about a quarter hour to Lv.7 and ten or
 * eleven hours of steady hunting to Lv.40 (measured with a headless bot, see README).
 */
const XP_STEPS = [[1, 6], [7, 6], [10, 8], [15, 11], [19, 17], [24, 34], [30, 62], [35, 72], [40, 82], [50, 95]];
function XP_K(lv) {
  for (let i = 1; i < XP_STEPS.length; i++) {
    const [l1, k1] = XP_STEPS[i], [l0, k0] = XP_STEPS[i - 1];
    if (lv <= l1) return k0 + ((k1 - k0) * (lv - l0)) / (l1 - l0);
  }
  return XP_STEPS[XP_STEPS.length - 1][1];
}
/** Deeper monsters drop less gold for their level: the bands last longer, and the purse should not run away. */
const goldK = (lv) => 1 - 0.7 * clamp((lv - 8) / 28, 0, 1);
const xpNeed = (lv) => Math.round((34 * Math.pow(lv, 1.85) + 20) * XP_K(lv));
// the errands pay in step with the levels they are given at
for (const q of QUESTS) q.xp = Math.round(q.xp * XP_K(MOBS[q.mob].lv));

function dirOf(dx, dy) {
  // 0 down · 1 left · 2 right · 3 up
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 2;
  return dy < 0 ? 3 : 0;
}

// ───────────────────────────── maps ─────────────────────────────

const SOLID_G = "wW";

function blank(id, name, w, h, fill) {
  const g = [];
  const o = [];
  for (let y = 0; y < h; y++) {
    g.push(new Array(w).fill(fill));
    o.push(new Array(w).fill(" "));
  }
  return { id, name, w, h, g, o, big: [], portals: [], npcs: [], spawns: [], safe: false, entry: [2, 2], bgm: "field" };
}
function rect(layer, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (layer[y] && x >= 0 && x < layer[y].length) layer[y][x] = ch;
}
function border(m, ch, n) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (x < n || y < n || x >= m.w - n || y >= m.h - n) m.o[y][x] = ch;
  }
}
/** Sprinkle ground variants / objects; `keep` cells (paths, plazas) are left alone. */
function scatter(m, box, layer, ch, chance, onlyOn) {
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (m.o[y][x] !== " ") continue;
    if (!onlyOn.includes(m.g[y][x])) continue;
    if (rnd(box) < chance) layer[y][x] = ch;
  }
}
/** A walkable strip from (x0,y0) to (x1,y1), two tiles wide, cleared of objects. */
function road(m, x0, y0, x1, y1, ch) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= m.w || yy >= m.h) continue;
      m.o[yy][xx] = " ";
      if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1 && m.g[yy][xx] !== "b") m.g[yy][xx] = ch;
    }
  }
}
function house(m, x, y, v) {
  rect(m.o, x, y, x + 3, y + 2, "h");
  m.big.push({ t: "house", x, y, v });
}
function portal(m, x, y, to, tx, ty) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) m.o[yy][xx] = " ";
  }
  m.portals.push({ x, y, to, tx, ty });
}
function finalize(m) {
  const W = m.w, H = m.h;
  m.solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (m.o[y][x] !== " " || SOLID_G.includes(m.g[y][x])) m.solid[y * W + x] = 1;
  }
  // Tiles a player can actually walk to — monsters only spawn there.
  m.reach = new Uint8Array(W * H);
  const stack = [m.entry[1] * W + m.entry[0]];
  while (stack.length) {
    const i = stack.pop(), x = i % W;
    if (m.solid[i] || m.reach[i]) continue;
    m.reach[i] = 1;
    if (x + 1 < W) stack.push(i + 1);
    if (x > 0) stack.push(i - 1);
    if (i + W < W * H) stack.push(i + W);
    if (i >= W) stack.push(i - W);
  }
  m.g = m.g.map((r) => r.join(""));
  m.o = m.o.map((r) => r.join(""));
  return m;
}

// ───────────────────────────── maps: procedural terrain ─────────────────────────────
// Every hunting ground is generated from a fixed seed, so a restart rebuilds the same
// world and players can learn it. No two are built the same way:
//
//   바람초원 / 속삭임 숲  regions of organic shape and varied size (Poisson-disc sites,
//                        a noise-warped, weighted Voronoi partition), grown into a
//                        spanning tree with a few loops; borders the tree did not take
//                        become cliffs (where the land steps up), belts of trees,
//                        hedges, boulders or bramble; elevation and moisture noise pick
//                        each region's sub-biome; a river runs downhill; roads are
//                        routed by weighted A* and bridged where they cross water.
//   네온 시티            a street grid cut by recursive subdivision (avenues, streets,
//                        alleys), with barricades closing off the street segments the
//                        spanning tree did not keep; blocks become towers, parks,
//                        plazas, car parks and fenced back lots.
//   수정 동굴            cellular-automaton caverns, stitched by drunkard's-walk
//                        tunnels, around a fixed boss arena; crystal groves, mushroom
//                        glades, an underground lake.
//   뼈의 지하묘지         BSP rooms of many shapes (chapels, crosses, pillared halls,
//                        ossuaries, flooded and collapsed rooms) joined by bending
//                        corridors that A* digs through the rock.
//   하수도               junction chambers joined by orthogonal tunnels, each a sludge
//                        channel with a walkway beside it; cisterns and pump rooms.
//   피의 심연            islands of flesh over a chasm of blood, joined by bone bridges.
//
// In every one the region (or room) graph gives the critical path from the way in to
// the way on: depth along it decides the monsters, the elites, where the camp goes,
// and what waits at the dead ends (a chest, always guarded). A last pass knits every
// pocket of open ground back to the entrance, so nothing generated is ever sealed off.

/** Is this tile blocked — by the same rule the browser uses. */
const blockedAt = (m, x, y) => x < 0 || y < 0 || x >= m.w || y >= m.h || m.o[y][x] !== " " || SOLID_G.includes(m.g[y][x]);
const inMap = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** The free tile nearest to (x, y). */
function spot(m, x, y) {
  for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && x + dx > 1 && y + dy > 1 && x + dx < m.w - 2 && y + dy < m.h - 2 && !blockedAt(m, x + dx, y + dy)) return [x + dx, y + dy];
  }
  return [x, y];
}
/** Clear a rectangle of objects (never the map's rim). */
function clear(m, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x > 1 && y > 1 && x < m.w - 2 && y < m.h - 2 && !"ha".includes(m.o[y][x])) m.o[y][x] = " ";
}

// ── noise: smooth value noise from an integer hash, layered into fractal noise
function h2(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal noise in [0, 1): `oct` octaves, the coarsest `scale` tiles across. */
function fbm(x, y, s, scale, oct = 3) {
  let sum = 0, amp = 1, norm = 0, f = 1 / scale;
  for (let i = 0; i < oct; i++) { sum += vnoise(x * f, y * f, s + i * 101) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
/** A noise field over the whole map, stretched so it spans roughly 0..1. */
function field(m, s, scale, oct) {
  const f = new Float32Array(m.w * m.h);
  let lo = 1, hi = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const v = fbm(x, y, s, scale, oct); f[y * m.w + x] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < f.length; i++) f[i] = (f[i] - lo) / Math.max(0.001, hi - lo);
  return f;
}

// ── searching the grid
/** A binary min-heap of values by priority. */
function heap() {
  const pr = [], it = [];
  return {
    get n() { return pr.length; },
    push(p, x) {
      let i = pr.length;
      pr.push(p); it.push(x);
      while (i > 0) { const j = (i - 1) >> 1; if (pr[j] <= p) break; pr[i] = pr[j]; it[i] = it[j]; i = j; }
      pr[i] = p; it[i] = x;
    },
    pop() {
      const top = it[0], lp = pr.pop(), lx = it.pop(), n = pr.length;
      if (n) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && pr[c + 1] < pr[c]) c++;
          if (pr[c] >= lp) break;
          pr[i] = pr[c]; it[i] = it[c]; i = c;
        }
        pr[i] = lp; it[i] = lx;
      }
      return top;
    },
  };
}
/**
 * The cheapest four-way walk over a W × H grid from `from` (a tile index or a list)
 * to the first tile where `goal(i)` holds. `cost(j, i, back)` prices the step from i
 * onto j (`back` is the tile before i, for turn penalties); Infinity forbids it. With
 * a target (tx, ty) the search is aimed (A*). Returns tile indexes, start first, or null.
 */
function walk(W, H, from, goal, cost, tx, ty, hk = 1) {
  const n = W * H, d = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n), q = heap();
  for (const s of [].concat(from)) { d[s] = 0; q.push(0, s); }
  while (q.n) {
    const i = q.pop();
    if (done[i]) continue;
    done[i] = 1;
    if (goal(i)) { const out = []; for (let c = i; c >= 0; c = prev[c]) out.push(c); return out.reverse(); }
    const x = i % W;
    for (let s = 0; s < 4; s++) {
      const j = s === 0 ? (x + 1 < W ? i + 1 : -1) : s === 1 ? (x > 0 ? i - 1 : -1) : s === 2 ? (i + W < n ? i + W : -1) : i - W;
      if (j < 0 || done[j]) continue;
      const c = cost(j, i, prev[i]);
      if (!(c < Infinity)) continue;
      const nd = d[i] + c;
      if (nd < d[j]) { d[j] = nd; prev[j] = i; const nx = j % W; q.push(nd + (tx === undefined ? 0 : (Math.abs(nx - tx) + Math.abs((j - nx) / W - ty)) * hk), j); }
    }
  }
  return null;
}
/** Steps from `src` (tile indexes) to every tile `pass(i)` lets through; -1 where unreachable. */
function bfs(W, H, src, pass) {
  const d = new Int32Array(W * H).fill(-1), q = [];
  for (const s of [].concat(src)) { if (d[s] < 0) { d[s] = 0; q.push(s); } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, di = d[i] + 1;
    if (x + 1 < W && d[i + 1] < 0 && pass(i + 1)) { d[i + 1] = di; q.push(i + 1); }
    if (x > 0 && d[i - 1] < 0 && pass(i - 1)) { d[i - 1] = di; q.push(i - 1); }
    if (i + W < W * H && d[i + W] < 0 && pass(i + W)) { d[i + W] = di; q.push(i + W); }
    if (i >= W && d[i - W] < 0 && pass(i - W)) { d[i - W] = di; q.push(i - W); }
  }
  return d;
}

// ── sites and regions
/** Poisson-disc sites (Bridson): no two closer than r, filling the rectangle; `fixed` ones are kept. */
function poisson(box, x0, y0, x1, y1, r, fixed = []) {
  const cell = r / Math.SQRT2, gw = Math.ceil((x1 - x0) / cell) + 1, gh = Math.ceil((y1 - y0) / cell) + 1;
  const grid = new Int32Array(gw * gh).fill(-1), pts = [], active = [];
  const gi = (x, y) => clamp(Math.floor((y - y0) / cell), 0, gh - 1) * gw + clamp(Math.floor((x - x0) / cell), 0, gw - 1);
  const ok = (x, y) => {
    if (x < x0 || y < y0 || x > x1 || y > y1) return false;
    const gx = Math.floor((x - x0) / cell), gy = Math.floor((y - y0) / cell);
    for (let j = gy - 2; j <= gy + 2; j++) for (let i = gx - 2; i <= gx + 2; i++) {
      if (i < 0 || j < 0 || i >= gw || j >= gh) continue;
      const k = grid[j * gw + i];
      if (k >= 0 && (pts[k][0] - x) ** 2 + (pts[k][1] - y) ** 2 < r * r) return false;
    }
    for (const f of fixed) if ((f[0] - x) ** 2 + (f[1] - y) ** 2 < r * r) return false;
    return true;
  };
  const put = (p) => { pts.push(p); active.push(pts.length - 1); grid[gi(p[0], p[1])] = pts.length - 1; };
  for (const f of fixed) { pts.push(f); active.push(pts.length - 1); }
  if (!pts.length) put([x0 + rnd(box) * (x1 - x0), y0 + rnd(box) * (y1 - y0)]);
  while (active.length) {
    const ai = ri(box, 0, active.length - 1), [px, py] = pts[active[ai]];
    let found = false;
    for (let k = 0; k < 20 && !found; k++) {
      const a = rnd(box) * 6.2832, d = r * (1 + rnd(box) * 0.9), x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      if (ok(x, y)) { put([x, y]); found = true; }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}
/**
 * Label every tile (where `inside`) with its nearest site — the distance divided by the
 * site's weight, the tile pushed about by noise first — so regions come out organic
 * and of different sizes. Stray pieces a region loses to the warp join a neighbour.
 */
function partition(m, sites, seed, warp, inside) {
  const W = m.w, H = m.h, lab = new Int16Array(W * H).fill(-1);
  // sites sorted into buckets 8 tiles across: a tile only weighs the sites in the 5 × 5 buckets round it
  const B = 8, bw = Math.ceil(W / B) + 1, bh = Math.ceil(H / B) + 1, bucket = Array.from({ length: bw * bh }, () => []);
  sites.forEach((s, k) => { s.iw = 1 / (s.w * s.w); bucket[clamp(Math.floor(s.y / B), 0, bh - 1) * bw + clamp(Math.floor(s.x / B), 0, bw - 1)].push(k); });
  const near = [];
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const list = [];
    for (let j = by - 2; j <= by + 2; j++) for (let i = bx - 2; i <= bx + 2; i++) if (i >= 0 && j >= 0 && i < bw && j < bh) list.push(...bucket[j * bw + i]);
    near.push(list.length ? list : sites.map((_, k) => k));
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inside && !inside(x, y)) continue;
    const wx = x + (vnoise(x / 8, y / 8, seed) + vnoise(x / 4, y / 4, seed + 7) * 0.5 - 0.75) * warp * 0.67;
    const wy = y + (vnoise(x / 8, y / 8, seed + 31) + vnoise(x / 4, y / 4, seed + 38) * 0.5 - 0.75) * warp * 0.67;
    let best = -1, bd = Infinity;
    const cand = near[Math.floor(y / B) * bw + Math.floor(x / B)];
    for (let c = 0; c < cand.length; c++) {
      const k = cand[c], s = sites[k], dx = wx - s.x, dy = wy - s.y, dd = (dx * dx + dy * dy) * s.iw;
      if (dd < bd) { bd = dd; best = k; }
    }
    lab[y * W + x] = best;
  }
  for (let pass = 0; pass < 2; pass++) {
    const seen = new Uint8Array(W * H), biggest = new Map(), pieces = [];
    for (let i = 0; i < W * H; i++) {
      if (lab[i] < 0 || seen[i]) continue;
      const k = lab[i], list = [i];
      seen[i] = 1;
      for (let h = 0; h < list.length; h++) {
        const c = list[h], x = c % W;
        if (x + 1 < W && !seen[c + 1] && lab[c + 1] === k) { seen[c + 1] = 1; list.push(c + 1); }
        if (x > 0 && !seen[c - 1] && lab[c - 1] === k) { seen[c - 1] = 1; list.push(c - 1); }
        if (c + W < W * H && !seen[c + W] && lab[c + W] === k) { seen[c + W] = 1; list.push(c + W); }
        if (c >= W && !seen[c - W] && lab[c - W] === k) { seen[c - W] = 1; list.push(c - W); }
      }
      pieces.push({ k, list });
      if (!biggest.has(k) || biggest.get(k).list.length < list.length) biggest.set(k, pieces[pieces.length - 1]);
    }
    for (const p of pieces) {
      if (biggest.get(p.k) === p) continue;
      let nb = -1;
      for (const c of p.list) {
        const x = c % W, y = (c - x) / W;
        for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && lab[ny * W + nx] >= 0 && lab[ny * W + nx] !== p.k) { nb = lab[ny * W + nx]; break; } }
        if (nb >= 0) break;
      }
      if (nb >= 0) for (const c of p.list) lab[c] = nb;
    }
  }
  return lab;
}
/**
 * What a partition is made of: per region its tiles, bounds, the point deepest inside
 * it (its pole, and how deep that is), and who borders whom along how many tiles.
 * `inner[i]` is how many steps tile i is from its region's edge (1 on the edge).
 */
function regionsOf(m, lab, n) {
  const W = m.w, H = m.h;
  const R = [];
  for (let k = 0; k < n; k++) R.push({ k, tiles: [], x0: W, y0: H, x1: 0, y1: 0, sx: 0, sy: 0 });
  for (let i = 0; i < W * H; i++) {
    const k = lab[i];
    if (k < 0) continue;
    const r = R[k], x = i % W, y = (i - x) / W;
    r.tiles.push(i); r.sx += x; r.sy += y;
    if (x < r.x0) r.x0 = x; if (x > r.x1) r.x1 = x; if (y < r.y0) r.y0 = y; if (y > r.y1) r.y1 = y;
  }
  const inner = new Int16Array(W * H), q = [];
  for (let i = 0; i < W * H; i++) {
    const k = lab[i];
    if (k < 0) continue;
    const x = i % W;
    if (x === 0 || x === W - 1 || i < W || i >= W * H - W || lab[i - 1] !== k || lab[i + 1] !== k || lab[i - W] !== k || lab[i + W] !== k) { inner[i] = 1; q.push(i); }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], k = lab[i], v = inner[i] + 1;
    for (const j of [i + 1, i - 1, i + W, i - W]) if (lab[j] === k && !inner[j]) { inner[j] = v; q.push(j); }
  }
  for (const r of R) {
    r.area = r.tiles.length;
    r.cx = r.sx / Math.max(1, r.area); r.cy = r.sy / Math.max(1, r.area);
    let best = -1, bv = -1, top = 0;
    for (const i of r.tiles) if (inner[i] > top) top = inner[i];
    for (const i of r.tiles) { if (inner[i] < top - 1) continue; const x = i % W, y = (i - x) / W, v = inner[i] * 10 - Math.sqrt((x - r.cx) ** 2 + (y - r.cy) ** 2); if (v > bv) { bv = v; best = i; } }
    r.px = best % W; r.py = (best - r.px) / W; r.inr = best >= 0 ? inner[best] : 0;
  }
  const E = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, a = lab[i];
    if (a < 0) continue;
    for (const j of [x + 1 < W ? i + 1 : -1, y + 1 < H ? i + W : -1]) {
      if (j < 0) continue;
      const b = lab[j];
      if (b < 0 || b === a) continue;
      const key = a < b ? a * 4096 + b : b * 4096 + a;
      let e = E.get(key);
      if (!e) E.set(key, (e = { a: Math.min(a, b), b: Math.max(a, b), n: 0, tiles: [] }));
      e.n++; e.tiles.push(i, j);
    }
  }
  return { R, E, inner };
}
const ekey = (a, b) => (a < b ? a * 4096 + b : b * 4096 + a);
/**
 * Grow a spanning tree over a graph of n nodes from `root` — the growing-tree
 * algorithm: with chance `wind` carry on from the newest node (long winding ways),
 * otherwise from a random one (branches and dead ends) — then add each unused edge
 * with chance `loops`. Returns the links, each node's depth and parent along them.
 */
function grow(box, n, edges, root, wind, loops) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const link = new Set(), seen = new Uint8Array(n), live = [root];
  seen[root] = 1;
  while (live.length) {
    const li = rnd(box) < wind ? live.length - 1 : ri(box, 0, live.length - 1), c = live[li];
    const next = adj[c].filter((o) => !seen[o]);
    if (!next.length) { live.splice(li, 1); continue; }
    const o = next[ri(box, 0, next.length - 1)];
    seen[o] = 1; link.add(ekey(c, o)); live.push(o);
  }
  for (const [a, b] of edges) if (!link.has(ekey(a, b)) && rnd(box) < loops) link.add(ekey(a, b));
  const dist = new Array(n).fill(-1), par = new Array(n).fill(-1), deg = new Array(n).fill(0), q = [root];
  dist[root] = 0;
  for (const [a, b] of edges) if (link.has(ekey(a, b))) { deg[a]++; deg[b]++; }
  for (let h = 0; h < q.length; h++) for (const o of adj[q[h]]) if (dist[o] < 0 && link.has(ekey(q[h], o))) { dist[o] = dist[q[h]] + 1; par[o] = q[h]; q.push(o); }
  let far = 1;
  for (const d of dist) far = Math.max(far, d);
  const path = (to) => { const out = []; for (let c = to; c >= 0; c = par[c]) out.unshift(c); return out; };
  return { link, dist, par, deg, far, adj, path, linked: (a, b) => link.has(ekey(a, b)) };
}

/**
 * Knit the map together: every pocket of open ground of any size is joined to the
 * entrance along the cheapest way — through objects (cleared), across water (a
 * bridge two planks wide) or through rock (dug out as `floor`) — and every point in
 * `pts` is made reachable the same way.
 */
function knit(m, pts, floor, minPocket = 6) {
  const W = m.w, H = m.h;
  const open = (i) => { const x = i % W, y = (i - x) / W; return !blockedAt(m, x, y); };
  const lay = (path) => {
    for (const c of path) {
      const x = c % W, y = (c - x) / W;
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      if (m.g[y][x] === "w") {
        m.g[y][x] = "b"; m.o[y][x] = " ";
        // a bridge is two planks wide: widen it across the way it runs
        const a = path[path.indexOf(c) - 1], horiz = a !== undefined && Math.abs(a - c) === 1;
        const [ex, ey] = horiz ? [x, y + 1] : [x + 1, y];
        if (ex < W - 2 && ey < H - 2 && m.g[ey][ex] === "w") { m.g[ey][ex] = "b"; m.o[ey][ex] = " "; }
      } else {
        if (!"ha".includes(m.o[y][x])) m.o[y][x] = " ";
        if (m.g[y][x] === "W") m.g[y][x] = floor;
      }
    }
  };
  const cost = (j) => {
    const x = j % W, y = (j - x) / W;
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return Infinity;
    if ("ha".includes(m.o[y][x])) return Infinity;
    if (m.g[y][x] === "w") return 6;
    if (m.g[y][x] === "W") return 9;
    return m.o[y][x] !== " " ? 7 : 1;
  };
  const [ex, ey] = m.entry;
  let reach = bfs(W, H, ey * W + ex, open);
  const join = (i) => {
    const path = walk(W, H, i, (j) => reach[j] >= 0, cost);
    if (path) { lay(path); reach = bfs(W, H, ey * W + ex, open); }
  };
  for (const [x, y] of pts) { const i = y * W + x; if (reach[i] < 0) join(i); }
  // pockets nobody asked for, but which a player could see and want to reach: label them all in one sweep
  const comp = new Int32Array(W * H).fill(-1), size = [], first = [];
  for (let i = 0; i < W * H; i++) {
    if (comp[i] >= 0 || reach[i] >= 0 || !open(i)) continue;
    const id = size.length, q = [i];
    comp[i] = id;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % W;
      for (const j of [x + 1 < W ? c + 1 : -1, x > 0 ? c - 1 : -1, c + W < W * H ? c + W : -1, c - W]) if (j >= 0 && comp[j] < 0 && reach[j] < 0 && open(j)) { comp[j] = id; q.push(j); }
    }
    size.push(q.length); first.push(i);
  }
  size.forEach((n, id) => { if (n >= minPocket && reach[first[id]] < 0) join(first[id]); });
}

/**
 * A set piece drawn as rows of characters, each standing for [ground, object] through
 * `legend` (an undefined entry leaves that layer alone; " " in the picture is skipped).
 * Stamped with its top-left at (x, y), turned `rot` quarter turns and mirrored if `flip`.
 */
function stamp(m, rows, x, y, legend, rot = 0, flip = false) {
  const h = rows.length, w = rows[0].length;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i];
    if (ch === " ") continue;
    const L2 = legend[ch];
    if (!L2) continue;
    let u = flip ? w - 1 - i : i, v = j;
    for (let r = 0; r < rot; r++) { const t = u; u = (r % 2 ? w : h) - 1 - v; v = t; }
    const tx = x + u, ty = y + v;
    if (tx < 2 || ty < 2 || tx >= m.w - 2 || ty >= m.h - 2) continue;
    if (L2[0] !== undefined && L2[0] !== null) m.g[ty][tx] = L2[0];
    if (L2[1] !== undefined && L2[1] !== null) m.o[ty][tx] = L2[1];
  }
}
/** The size of a set piece once turned. */
const stampSize = (rows, rot) => (rot % 2 ? [rows.length, rows[0].length] : [rows[0].length, rows.length]);
/** Where a w × h set piece fits inside a region, every tile at least `pad` in from its edge and free; nearest its pole. */
function fitIn(m, lab, inner, r, w, h, pad, free) {
  let best = null, bd = Infinity;
  for (const i of r.tiles) {
    const x = i % m.w, y = (i - x) / m.w;
    if (x + w > m.w - 2 || y + h > m.h - 2) continue;
    let ok = true;
    for (let v = 0; v < h && ok; v++) for (let u = 0; u < w && ok; u++) {
      const j = (y + v) * m.w + x + u;
      if (lab[j] !== r.k || inner[j] < pad || (free && !free(x + u, y + v))) ok = false;
    }
    if (!ok) continue;
    const d = Math.hypot(x + w / 2 - r.px, y + h / 2 - r.py);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}
/** Cellular-automaton smoothing of a wall mask (1 = wall): a tile becomes wall with ≥ `birth` wall neighbours of 8, stays one with ≥ `keep`. */
function automaton(W, H, wall, steps, birth = 5, keep = 4, fixed) {
  let cur = wall;
  for (let s = 0; s < steps; s++) {
    const nx = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (fixed && fixed[i]) { nx[i] = fixed[i] === 1 ? 1 : 0; continue; }
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) { nx[i] = 1; continue; }
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && cur[(y + dy) * W + x + dx]) n++;
      nx[i] = cur[i] ? (n >= keep ? 1 : 0) : n >= birth ? 1 : 0;
    }
    cur = nx;
  }
  return cur;
}
/** Elite odds for a place `t` of the way (0–1) into a hunting ground. */
const eliteAt = (t) => 0.03 + 0.15 * t;
/** The monster for a place `t` of the way in: deeper means stronger kinds, with a little bleed between bands. */
function bandMob(box, mobs, t, d) {
  const K = mobs.length;
  let band = Math.min(K - 1, Math.floor(t * K));
  if (rnd(box) < 0.2) band = clamp(band + (rnd(box) < 0.5 ? -1 : 1), 0, K - 1);
  return mobs[d <= 1 ? 0 : band];
}
/** Every kind a ground is meant to hold lives somewhere in it: one the dice left out joins the spawn of its nearest band. */
function cover(m, mobs) {
  const have = new Set(m.spawns.map((sp) => sp.k));
  mobs.forEach((k, j) => {
    if (have.has(k)) return;
    let best = null, bd = Infinity;
    for (const sp of m.spawns) { const i = mobs.indexOf(sp.k); if (i < 0 || sp.el) continue; const d = Math.abs(i - j) * 100 - sp.n; if (d < bd) { bd = d; best = sp; } }
    if (best) { m.spawns.push({ k, n: Math.max(1, Math.min(3, best.n)), r: best.r, elite: best.elite }); have.add(k); }
  });
}
/** A spawn rectangle for a region: the bounds of its tiles at least `pad` in from its edge (or all of it, if it is thin). */
function coreRect(m, r, inner, pad) {
  let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
  for (const i of r.tiles) {
    if (inner[i] < pad) continue;
    const x = i % m.w, y = (i - x) / m.w;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? [r.x0, r.y0, r.x1, r.y1] : [x0, y0, x1, y1];
}

