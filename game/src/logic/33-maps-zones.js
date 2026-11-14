// ───────────────────────────── zones: how deep into a hunting ground ─────────────────────────────
// docs/design/scale-and-rift.md C.1–C.3. Every generated hunting ground is cut into zones by how
// far a tile is walked from the entrance (BFS over open ground): a SAFE plaza round the way in
// (and a little ring round every other way in), NORMAL ground where the colonies live, ELITE
// ground in the far part (stronger kinds, far more elites), and HIDDEN pockets: the dead ends
// behind a narrow mouth that hold a chest and its one guardian. The zones decide who lives
// where (zoneSpawns: monsters per 8 × 8 block of each zone), and markRoutes reads them for the
// extra waypoint stones, the wind shrines and the signs. Editor maps are never zoned.

const Z_SAFE = 0, Z_NORMAL = 1, Z_ELITE = 2, Z_HIDDEN = 3;
/**
 * Zone cuts, as a share of the farthest walk D from the entrance: the safe plaza is ZONE_SAFE D deep
 * (at least SAFE_MIN tiles; a side door's ring GATE_SAFE), elite ground starts at ZONE_ELITE D but
 * never takes more than ELITE_SHARE of the walkable ground (a map that is all depth stays mostly normal).
 */
const ZONE_SAFE = 0.08, ZONE_ELITE = 0.55, ELITE_SHARE = 0.3, SAFE_MIN = 10, GATE_SAFE = 5;
/**
 * A hidden pocket: between POCKET_MIN and POCKET_MAX tiles, reached through at most POCKET_MOUTH
 * tiles, found within POCKET_SCAN steps of its chest, its chest at least POCKET_DEEP D in; at most
 * POCKET_N a map, the deepest first (other chests stay in the open with the colonies round them).
 */
const POCKET_MIN = 10, POCKET_MAX = 260, POCKET_MOUTH = 3, POCKET_SCAN = 60, POCKET_DEEP = 0.3, POCKET_N = 5;
/** Monsters per tile against the map's DENSITY, by zone (safe none, normal as ever, elite fewer but far more often elite, hidden only its guardian). */
const ZONE_DENS = [0, 1, 0.6, 0], ZONE_EP = 0.35;
/** Spawn boxes are SUB × SUB tiles (four to a cell), each holding one zone's tiles of that block. */
const SUB = 8;
/** 질주의 바람: a wind shrine's push — move speed ×WIND_K for WIND_MS, the same shrine again after WIND_CD; touched within WIND_R px. */
const WIND_K = 1.3, WIND_MS = 20000, WIND_CD = 60000, WIND_R = 26;
/** What the waypoint stones of a map are called, by how many it has. */
const STONE_NAMES = [[], [""], ["입구", "안쪽"], ["입구", "중턱", "안쪽"]];

/**
 * Cut map `m` (rows still arrays) into zones: m.zone (Uint8Array, a zone per tile; ground no one
 * can walk to is 0), m.zdist (walk from the entrance, -1 where none), m.zinfo { D, safeR, eliteD },
 * m.pockets (the hidden dead ends, each { tiles, chests, mouth, L }), m.zones (reachable tiles per
 * zone, for the tests and tools) and m.zq (the zones by 4 × 4 block, for the minimap).
 */
function zoneMap(m) {
  const W = m.w, H = m.h, N = W * H;
  const open = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.o[y][x] === " " && !SOLID_G.includes(m.g[y][x])) open[y * W + x] = 1;
  const flood = (starts, limit) => {
    const d = new Int32Array(N).fill(-1), q = [];
    for (const [x, y] of starts) { const i = y * W + x; if (open[i] && d[i] < 0) { d[i] = 0; q.push(i); } }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, di = d[i] + 1;
      if (di > limit) continue;
      if (x + 1 < W && open[i + 1] && d[i + 1] < 0) { d[i + 1] = di; q.push(i + 1); }
      if (x > 0 && open[i - 1] && d[i - 1] < 0) { d[i - 1] = di; q.push(i - 1); }
      if (i + W < N && open[i + W] && d[i + W] < 0) { d[i + W] = di; q.push(i + W); }
      if (i >= W && open[i - W] && d[i - W] < 0) { d[i - W] = di; q.push(i - W); }
    }
    return d;
  };
  const d = flood([m.entry], 1e9);
  let D = 1;
  for (let i = 0; i < N; i++) if (d[i] > D) D = d[i];
  const hist = new Int32Array(D + 1);
  let walk = 0;
  for (let i = 0; i < N; i++) if (d[i] >= 0) { hist[d[i]]++; walk++; }
  let eliteD = D, tail = 0;
  while (eliteD > 0 && tail + hist[eliteD] <= walk * ELITE_SHARE) tail += hist[eliteD--];
  eliteD = Math.max(eliteD + 1, Math.round(D * ZONE_ELITE));
  const safeR = Math.max(SAFE_MIN, Math.round(D * ZONE_SAFE));
  // every other way in gets a little ring of quiet ground too: nobody steps through a door into a pack
  // (only gates someone can come in by: a one-way door out, like the crypt's, keeps its guardian)
  const gateA = [];
  for (const [a, ga, b, gb, both] of GATE_LINKS) {
    const g = b === m.id ? m.gates[gb] : both && a === m.id ? m.gates[ga] : null;
    if (g) for (const t of g.a) gateA.push(t);
  }
  const near = flood(gateA, GATE_SAFE);
  const zone = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (d[i] < 0) continue;
    zone[i] = d[i] < safeR || near[i] >= 0 ? Z_SAFE : d[i] < eliteD ? Z_NORMAL : Z_ELITE;
  }
  // the hidden pockets: from each chest, the widest dead end round it whose mouth is narrow
  const guard = new Uint8Array(N);
  const keepOut = (x, y) => { if (inMap(m, x, y)) guard[y * W + x] = 1; };
  for (const p of m.portals) keepOut(p.x, p.y);
  for (const a of gateA) keepOut(a[0], a[1]);
  for (const [fx, fy] of FIRES[m.id] || []) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keepOut(fx + dx, fy + dy);
  const seen = new Int32Array(N), mark = new Int32Array(N);
  let stamp = 0;
  const pockets = [], owner = new Int32Array(N).fill(-1);
  const chests = m.spawns.filter((sp) => MOBS[sp.k].chest && d[sp.r[1] * W + sp.r[0]] >= D * POCKET_DEEP);
  chests.sort((a, b) => d[b.r[1] * W + b.r[0]] - d[a.r[1] * W + a.r[0]] || a.r[1] - b.r[1] || a.r[0] - b.r[0]);
  for (const sp of chests) {
    const c = sp.r[1] * W + sp.r[0];
    if (owner[c] >= 0) { pockets[owner[c]].chests.push([sp.r[0], sp.r[1]]); continue; }
    let best = null;
    for (let L = d[c] - 1; L >= Math.max(1, d[c] - POCKET_SCAN); L--) {
      if (L < safeR) break;
      stamp++;
      const q = [c], mouth = [];
      seen[c] = stamp;
      let bad = guard[c] === 1;
      for (let h = 0; h < q.length && !bad; h++) {
        const i = q[h], x = i % W;
        for (const j of [x + 1 < W ? i + 1 : -1, x > 0 ? i - 1 : -1, i + W < N ? i + W : -1, i >= W ? i - W : -1]) {
          if (j < 0 || !open[j] || d[j] < 0) continue;
          if (d[j] <= L) { if (mark[j] !== stamp) { mark[j] = stamp; mouth.push(j); } continue; }
          if (seen[j] === stamp) continue;
          seen[j] = stamp;
          if (guard[j] || owner[j] >= 0) { bad = true; break; }
          q.push(j);
        }
        if (q.length > POCKET_MAX) bad = true;
      }
      if (bad) break;
      if (q.length >= POCKET_MIN && mouth.length <= POCKET_MOUTH) best = { tiles: q, mouth: mouth[mouth.length >> 1], L };
    }
    if (!best || pockets.length >= POCKET_N) continue;
    const k = pockets.length;
    for (const i of best.tiles) { owner[i] = k; zone[i] = Z_HIDDEN; }
    pockets.push({ tiles: best.tiles, chests: [[sp.r[0], sp.r[1]]], mouth: [best.mouth % W, Math.floor(best.mouth / W)], L: best.L });
  }
  const count = [0, 0, 0, 0];
  for (let i = 0; i < N; i++) if (d[i] >= 0) count[zone[i]]++;
  // the minimap's tint: each 4 × 4 block takes the zone most of its walkable ground is in ("-" none)
  const bw = Math.ceil(W / 4), bh = Math.ceil(H / 4);
  let zq = "";
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const c4 = [0, 0, 0, 0];
    for (let y = by * 4; y < Math.min(H, by * 4 + 4); y++) for (let x = bx * 4; x < Math.min(W, bx * 4 + 4); x++) if (d[y * W + x] >= 0) c4[zone[y * W + x]]++;
    const top = c4.indexOf(Math.max(...c4));
    zq += c4[top] ? String(top) : "-";
  }
  m.zone = zone; m.zdist = d; m.zinfo = { D, safeR, eliteD }; m.pockets = pockets; m.zq = zq;
  m.zones = { D, safe: count[0], normal: count[1], elite: count[2], hidden: count[3], pockets: pockets.length };
}

/**
 * Who lives where on a zoned map. Chests, bosses and placed guardians stay as the generator left
 * them; the roster (cfg.mobs, weakest first) is laid out again block by block: normal ground takes
 * the kinds by how far in the block lies, elite ground the stronger half of the roster with
 * ZONE_EP elites, the safe plaza and the hidden pockets none — a pocket gets one guardian beside its
 * chest instead. Counts follow the map's DENSITY (×ZONE_DENS of the zone), carried over block to block.
 */
function zoneSpawns(m, cfg) {
  const W = m.w, H = m.h, z = m.zone, d = m.zdist, { D, safeR, eliteD } = m.zinfo;
  const ros = cfg.mobs.map((k, i) => [k, i]).sort((a, b) => MOBS[a[0]].lv - MOBS[b[0]].lv || a[1] - b[1]).map((a) => a[0]);
  const n = ros.length, normTop = Math.max(1, Math.ceil(n * 0.85)), eliteLo = Math.min(n - 1, Math.floor(n * 0.5));
  const progN = (dd) => clamp((dd - safeR) / Math.max(1, eliteD - safeR), 0, 0.999);
  const pick = (zone, dd, h) => {
    if (zone === Z_ELITE) return ros[clamp(eliteLo + Math.floor(clamp((dd - eliteD) / Math.max(1, D - eliteD), 0, 0.999) * (n - eliteLo) + (h - 0.5) * 1.2), eliteLo, n - 1)];
    return ros[clamp(Math.floor(progN(dd) * normTop + (h - 0.5) * 1.2), 0, normTop - 1)];
  };
  const zoneAt = (r) => z[Math.floor((r[1] + r[3]) / 2) * W + Math.floor((r[0] + r[2]) / 2)];
  const old = m.spawns;
  const out = old.filter((sp) => MOBS[sp.k].chest || MOBS[sp.k].boss || sp.el);
  // a kind that is not on the roster (a lair's own pack) keeps its ground, unless that is the plaza or a pocket
  for (const sp of old) if (!out.includes(sp) && !cfg.mobs.includes(sp.k) && zoneAt(sp.r) !== Z_SAFE && zoneAt(sp.r) !== Z_HIDDEN) out.push(sp);
  const carry = [0, 0, 0, 0];
  for (let by = 0; by < H; by += SUB) for (let bx = 0; bx < W; bx += SUB) for (const zz of [Z_NORMAL, Z_ELITE]) {
    let cnt = 0, sd = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = by; y < Math.min(H, by + SUB); y++) for (let x = bx; x < Math.min(W, bx + SUB); x++) {
      const i = y * W + x;
      if (d[i] < 0 || z[i] !== zz) continue;
      cnt++; sd += d[i];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (!cnt) continue;
    const want = (cnt * ZONE_DENS[zz]) / DENSITY[m.id] + carry[zz], k = Math.round(want);
    carry[zz] = want - k;
    if (k <= 0) continue;
    const h = h2(bx, by, cfg.seed + zz), dd = sd / cnt, r = [x0, y0, x1, y1];
    const ep = zz === Z_ELITE ? ZONE_EP : eliteAt(progN(dd) * 0.5);
    const k1 = pick(zz, dd, h), k2 = k >= 4 ? pick(zz, dd, 1 - h) : k1;
    if (k2 === k1) { out.push({ k: k1, n: k, r, elite: ep, zone: zz }); continue; }
    const a = Math.ceil(k * 0.65);
    out.push({ k: k1, n: a, r: r.slice(), elite: ep, zone: zz }, { k: k2, n: k - a, r: r.slice(), elite: ep, zone: zz });
  }
  // each hidden pocket: its chest, and one guardian halfway between the mouth and the chest
  for (const pk of m.pockets) {
    const [cx, cy] = pk.chests[0], ci = cy * W + cx;
    const keeper = old.find((sp) => !MOBS[sp.k].chest && !MOBS[sp.k].boss && !sp.el && sp.r[0] <= cx && cx <= sp.r[2] && sp.r[1] <= cy && cy <= sp.r[3]);
    const kind = keeper ? keeper.k : pick(d[ci] >= eliteD ? Z_ELITE : Z_NORMAL, d[ci], 0.5);
    const mid = (pk.L + 1 + d[ci]) / 2;
    let at = -1, bd = Infinity;
    for (const i of pk.tiles) {
      const x = i % W, y = (i - x) / W;
      if (Math.abs(x - cx) + Math.abs(y - cy) < 2) continue;
      const s = Math.abs(d[i] - mid) * 4 + ((x * 7 + y * 13) % 5);
      if (s < bd) { bd = s; at = i; }
    }
    if (at < 0) continue;
    const gx = at % W, gy = (at - gx) / W;
    pk.guard = [gx, gy];
    out.push({ k: kind, n: 1, r: [gx, gy, gx, gy], el: 1, zone: Z_HIDDEN });
  }
  m.spawns = out;
  // every kind the ground is meant to hold lives somewhere in it
  cover(m, cfg.mobs);
}

// (a sheet's woken stones are ch.wp = { mapId: bitmask }, bit i = stone i: wpWoken in 36-custom-maps.js)
/** A built map's waypoint stones, in order ({ x, y, ax, ay, i }). */
function stonesOf(m) {
  return m.stones || (WP[m.id] ? [WP[m.id]] : []);
}
/** A stone's name for a toast: the map's name, and which stone when it has more than one. */
function stoneName(id, i) {
  const n = (MAP_META[id] && MAP_META[id].wpn) || 1, nm = MAP_META[id] ? MAP_META[id].name : id;
  return n > 1 ? `${nm} · ${STONE_NAMES[n][i] || i + 1}` : nm;
}
/** 질주의 바람: brushing past a wind shrine speeds you on (each shrine once a minute). */
function windTouch(S, p, now) {
  const m = mapOfS(S, p.map);
  if (!m || !m.shrines || p.dead) return;
  for (let i = 0; i < m.shrines.length; i++) {
    const [x, y] = m.shrines[i];
    if (Math.abs(p.x - (x * T + 8)) > WIND_R || Math.abs(p.y - (y * T + 10)) > WIND_R) continue;
    const cd = p.windCd || (p.windCd = {}), key = p.map + "#" + i;
    if (cd[key] > now) return;
    cd[key] = now + WIND_CD;
    p.wind = now + WIND_MS;
    p.dirty = true;
    S.maps[p.map].ev.push(["wd", p.eid, x * T + 8, y * T + 10]);
    toast(p, `질주의 바람이 등을 떠밉니다! 이동속도 +${Math.round((WIND_K - 1) * 100)}% (${WIND_MS / 1000}초)`);
    return;
  }
}
