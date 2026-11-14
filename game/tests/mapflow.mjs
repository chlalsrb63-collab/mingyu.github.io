// Path quality of every generated hunting ground and dungeon (docs/design/maps-v2.md "path-quality rules"):
// how much of it is open, whether the main routes stay three tiles wide, whether there are loops rather than a
// tree of dead ends, how winding the walk to the far doors is, and how many dead-end pockets there are.
// The maps reworked by maps-v2 are held to the thresholds; the rest are only reported (warnings) for now.
// node tests/mapflow.mjs [-v]
import assert from "node:assert/strict";

const L = await import("../src/logic.js");
const { maps, fires } = L.atlas();
const D = L.defs();
const VERBOSE = process.argv.includes("-v");
const HUNT = ["meadow", "forest", "crypt", "city", "sewer", "cave", "abyss", "maple", "jungle", "oasis", "coast"];
/** Maps held to the rules, and their own minimum loop count (cycle rank of the coarse graph). */
const STRICT = { meadow: { loops: 12 }, forest: { loops: 10 }, cave: { loops: 6 }, crypt: { loops: 6 }, sewer: { loops: 6 },
  jungle: { loops: 10 }, oasis: { loops: 12 }, coast: { loops: 12 } };
// tort: the target band is 1.15–2.2; held from 1.12 so a wide open ground with one short way round still passes
const RULES = { open: [0.42, 0.9], tort: [1.12, 2.2], deadMax: 7, deadPer: 0.012 };
const CELL = 8, DOORWAY = 8;

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const walkable = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.o[y][x] === " " && !"wW".includes(m.g[y][x]);

/** Walk lengths from one tile over the reachable ground, 8-way without cutting corners (Dijkstra, 10/14 costs). */
function walkFrom(m, sx, sy) {
  const W = m.w, d = new Float64Array(W * m.h).fill(Infinity), q = [[0, sy * W + sx]];
  d[sy * W + sx] = 0;
  const push = (e) => { q.push(e); let i = q.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (q[p][0] <= q[i][0]) break; [q[p], q[i]] = [q[i], q[p]]; i = p; } };
  const pop = () => { const top = q[0], last = q.pop(); if (q.length) { q[0] = last; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let s = i; if (a < q.length && q[a][0] < q[s][0]) s = a; if (b < q.length && q[b][0] < q[s][0]) s = b; if (s === i) break; [q[s], q[i]] = [q[i], q[s]]; i = s; } } return top; };
  while (q.length) {
    const [c, i] = pop();
    if (c > d[i]) continue;
    const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of N8) {
      const X = x + dx, Y = y + dy;
      if (!walkable(m, X, Y)) continue;
      if (dx && dy && (!walkable(m, x + dx, y) || !walkable(m, x, y + dy))) continue;
      const j = Y * W + X, nc = c + (dx && dy ? 1.4142 : 1);
      if (nc < d[j]) { d[j] = nc; push([nc, j]); }
    }
  }
  return d;
}

/** Every metric for one map. */
export function flow(m, fireList = []) {
  const W = m.w, H = m.h, n = W * H, reach = m.reach;
  let open = 0, loose = 0;
  for (let i = 0; i < n; i++) { if (reach[i]) open++; else if (walkable(m, i % W, (i / W) | 0)) loose++; }
  // ── width: a tile is "wide" when a 3 × 3 stands round it; the wide ground must join every place that matters
  const wide = new Uint8Array(n);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!reach[y * W + x]) continue;
    let ok = true;
    for (const [dx, dy] of N8) if (!walkable(m, x + dx, y + dy)) { ok = false; break; }
    wide[y * W + x] = ok ? 1 : 0;
  }
  const comp = new Int32Array(n).fill(-1);
  let nc = 0;
  for (let s = 0; s < n; s++) {
    if (!wide[s] || comp[s] >= 0) continue;
    const st = [s]; comp[s] = nc;
    while (st.length) { const i = st.pop(), x = i % W; for (const j of [i + 1, i - 1, i + W, i - W]) { if (j < 0 || j >= n || !wide[j] || comp[j] >= 0) continue; if ((j === i + 1 && x === W - 1) || (j === i - 1 && x === 0)) continue; comp[j] = nc; st.push(j); } }
    nc++;
  }
  // the wide tile nearest a point (within 3 steps over walkable ground)
  const wideNear = (px, py) => {
    const seen = new Map([[py * W + px, 0]]), q = [py * W + px];
    for (let h = 0; h < q.length; h++) {
      const i = q[h], s = seen.get(i);
      if (wide[i]) return i;
      if (s >= 3) continue;
      const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of N8) { const X = x + dx, Y = y + dy, j = Y * W + X; if (X < 0 || Y < 0 || X >= W || Y >= H || seen.has(j) || !walkable(m, X, Y)) continue; seen.set(j, s + 1); q.push(j); }
    }
    return -1;
  };
  const targets = [["entry", m.entry]];
  for (const [name, g] of Object.entries(m.gates || {})) targets.push(["gate " + name, g.a[0]]);
  for (const p of m.portals || []) targets.push(["door " + p.to, [p.x, p.y]]);
  for (const s of m.stones || []) targets.push(["stone " + s.i, [s.ax, s.ay]]);
  for (const f of fireList) targets.push(["camp", f]);
  // (a chest in a hidden pocket is meant to lie behind a narrow mouth: 33-maps-zones.js; it is not on the main routes)
  const hidden = new Set((m.pockets || []).flatMap((pk) => pk.chests.map(([x, y]) => y * W + x)));
  for (const sp of m.spawns) { const k = D.mobs[sp.k]; if (k && (k.boss || (k.chest && !hidden.has(sp.r[1] * W + sp.r[0])))) targets.push([(k.boss ? "boss " : "chest ") + sp.k, [sp.r[0], sp.r[1]]]); }
  const home = comp[wideNear(m.entry[0], m.entry[1])] ?? -1;
  const narrow = [];
  // a chest's vault may open by a doorway narrower than three, if it is short (DOORWAY steps to the wide ground)
  const doorway = (px, py) => {
    const seen = new Map([[py * W + px, 0]]), q = [py * W + px];
    for (let h = 0; h < q.length; h++) {
      const i = q[h], s = seen.get(i);
      if (wide[i] && comp[i] === home) return true;
      if (s >= DOORWAY) continue;
      const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of N8.slice(0, 4)) { const X = x + dx, Y = y + dy, j = Y * W + X; if (seen.has(j) || !walkable(m, X, Y)) continue; seen.set(j, s + 1); q.push(j); }
    }
    return false;
  };
  for (const [what, [x, y]] of targets) {
    const w = wideNear(x, y);
    if (w >= 0 && comp[w] === home && home >= 0) continue;
    if (what.startsWith("chest") && doorway(x, y)) continue;
    narrow.push(`${what}@${x},${y}`);
  }
  // ── loops: the wide ground cut into 8 × 8 cells, one node per piece of it in a cell, joined across cell sides
  const node = new Int32Array(n).fill(-1);
  let nn = 0;
  const cw = Math.ceil(W / CELL), chh = Math.ceil(H / CELL), cellNodes = [];
  for (let cy = 0; cy < chh; cy++) for (let cx = 0; cx < cw; cx++) {
    const x0 = cx * CELL, y0 = cy * CELL, x1 = Math.min(W, x0 + CELL), y1 = Math.min(H, y0 + CELL);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const s = y * W + x;
      if (!wide[s] || node[s] >= 0 || comp[s] !== home) continue;
      let size = 0; const st = [s]; node[s] = nn;
      while (st.length) { const i = st.pop(); size++; const ix = i % W, iy = (i - ix) / W; for (const [dx, dy] of N8.slice(0, 4)) { const X = ix + dx, Y = iy + dy; if (X < x0 || Y < y0 || X >= x1 || Y >= y1) continue; const j = Y * W + X; if (wide[j] && node[j] < 0) { node[j] = nn; st.push(j); } } }
      cellNodes.push(size); nn++;
    }
  }
  const edges = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = node[y * W + x];
    if (a < 0) continue;
    if (x + 1 < W && node[y * W + x + 1] >= 0 && node[y * W + x + 1] !== a) edges.add(Math.min(a, node[y * W + x + 1]) * 1e6 + Math.max(a, node[y * W + x + 1]));
    if (y + 1 < H && node[(y + 1) * W + x] >= 0 && node[(y + 1) * W + x] !== a) edges.add(Math.min(a, node[(y + 1) * W + x]) * 1e6 + Math.max(a, node[(y + 1) * W + x]));
  }
  const loops = edges.size - nn + 1;
  // ── dead ends: chains of cells hanging off the rest by one side
  const adj = Array.from({ length: nn }, () => []);
  for (const e of edges) { const a = Math.floor(e / 1e6), b = e % 1e6; adj[a].push(b); adj[b].push(a); }
  const deg = adj.map((l) => l.length), gone = new Uint8Array(nn), len = new Int32Array(nn);
  let leaves = deg.map((d, i) => (d <= 1 ? i : -1)).filter((i) => i >= 0);
  const dead = [];
  while (leaves.length) {
    const next = [];
    for (const v of leaves) {
      if (gone[v]) continue;
      gone[v] = 1;
      const up = adj[v].find((u) => !gone[u]);
      if (up === undefined) continue;
      len[up] = Math.max(len[up], len[v] + 1);
      if (--deg[up] === 1) next.push(up); else if (len[v] + 1 >= 2) dead.push(len[v] + 1);
    }
    leaves = next;
  }
  // ── tortuosity: the walk from the entry to each far door, against the straight line
  const d = walkFrom(m, m.entry[0], m.entry[1]);
  const tort = [];
  for (const [name, g] of Object.entries(m.gates || {})) {
    const [x, y] = g.a[0], line = Math.hypot(x - m.entry[0], y - m.entry[1]);
    if (line < Math.max(W, H) * 0.35) continue;
    tort.push([name, d[y * W + x] / line]);
  }
  for (const p of m.portals || []) {
    if (Object.values(m.gates || {}).some((g) => g.t.some(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) <= 2))) continue;
    const line = Math.hypot(p.x - m.entry[0], p.y - m.entry[1]);
    if (line >= Math.max(W, H) * 0.35 && Number.isFinite(d[p.y * W + p.x])) tort.push(["door " + p.to, d[p.y * W + p.x] / line]);
  }
  return { open: open / n, loose, narrow, targets: targets.length, loops, nodes: nn, dead: dead.length, deadMax: dead.length ? Math.max(...dead) : 0, tort };
}

const warns = [], rows = [], fails = [];
for (const id of HUNT) {
  const m = maps[id], f = flow(m, fires[id] || []), strict = STRICT[id];
  const tMin = f.tort.length ? Math.min(...f.tort.map((t) => t[1])) : 0, tMax = f.tort.length ? Math.max(...f.tort.map((t) => t[1])) : 0;
  const deadCap = Math.max(6, Math.round(m.w * m.h * RULES.deadPer / CELL));
  rows.push(`${id.padEnd(7)} ${m.w}x${m.h} open ${(f.open * 100).toFixed(0)}%  narrow ${f.narrow.length}/${f.targets}  loops ${f.loops}  dead ${f.dead} (longest ${f.deadMax})  tort ${f.tort.map(([n, t]) => `${n} ${t.toFixed(2)}`).join(", ") || "-"}${strict ? "  [held]" : ""}`);
  const problems = [];
  if (f.open < RULES.open[0] || f.open > RULES.open[1]) problems.push(`open ratio ${(f.open * 100).toFixed(0)}% outside ${RULES.open.map((v) => v * 100).join("–")}%`);
  if (f.loose) problems.push(`${f.loose} walkable tiles not reachable from the entry`);
  if (f.narrow.length) problems.push(`main routes narrower than 3 tiles to ${f.narrow.join(" ")}`);
  if (f.loops < (strict ? strict.loops : 6)) problems.push(`only ${f.loops} loops`);
  if (f.tort.length && (tMin < RULES.tort[0] || tMax > RULES.tort[1])) problems.push(`tortuosity ${tMin.toFixed(2)}–${tMax.toFixed(2)} outside ${RULES.tort.join("–")}`);
  if (f.deadMax > RULES.deadMax || f.dead > deadCap) problems.push(`${f.dead} dead ends (cap ${deadCap}), longest ${f.deadMax} cells (cap ${RULES.deadMax})`);
  for (const p of problems) (strict ? fails : warns).push(`${id}: ${p}`);
}
console.log("mapflow: path quality of every hunting ground\n  " + rows.join("\n  "));
if (warns.length) console.log("  warnings (not held yet):\n    " + (VERBOSE ? warns : warns.map((w) => w.slice(0, 160))).join("\n    "));
assert.deepEqual(fails, [], "maps held to the path-quality rules break them");
console.log("mapflow ok");
