// ── set pieces: [ground, object, tag] per character (undefined leaves that layer alone)
const PIECE = {
  ".": [undefined, " "], r: ["r", " "], p: ["p", " "], f: ['"', " "], j: ["j", " "], v: ["v", " "], s: ["s", " "], c: ["c", " "], d: ["d", " "], k: ["k", " "], o: ["o", " "], w: ["w", " "],
  U: [undefined, "U"], q: [undefined, "q"], O: [undefined, "O"], A: [undefined, "A"], B: [undefined, "B"], E: [undefined, "E"], F: [undefined, "F"],
  l: [undefined, "l"], u: [undefined, "u"], Y: [undefined, "Y"], R: [undefined, "R"], T: [undefined, "T"], P: [undefined, "P"], e: ["w", "e"],
  K: [undefined, "K"], S: [undefined, "S"], M: [undefined, "M"], n: [undefined, "n"], D: [undefined, "D"], x: [undefined, "x"], y: [undefined, "y"], L: [undefined, "L"],
  1: [undefined, "1"], 2: [undefined, "2"], 3: [undefined, "3"], 4: [undefined, "4"], 5: [undefined, "5"], 6: [undefined, "6"], 7: [undefined, "7"], 8: [undefined, "8"], 0: [undefined, "0"], X: [undefined, "X"],
  "*": [undefined, " ", "chest"], "#": ["p", " ", "fire"], "<": ["v", " ", "t"], ">": [undefined, " ", "a"], "@": [undefined, " ", "boss"], "g": ["g", " "],
  // the fallen kingdom: royal flagstones, leaf litter, blighted soil, dry stalks; headstones, banners, a king's statue,
  // and the footprints the big ruins stand on (the chapel N, a cottage d, a watchtower i, the toppled gate f)
  "=": ["=", " "], "%": ["%", " "], "&": ["&", " "], t: ["t", " "], J: [undefined, "J"], V: [undefined, "V"], z: [undefined, "z"],
  N: [undefined, "N"], $: [undefined, "d"], "!": [undefined, "i"], "^": [undefined, "f"],
  // maps-v2: still water (the temple's rune pool; the art step gives it a glow of its own)
  "~": ["w", " "],
  // maps-v2 M3, the south-west coast: palm Ψ, reef rock Φ, shore boulder Ω, mud hut Δ (Greek: every ASCII mark is taken by the rooms' furniture); shallows (walkable), white sand, dune sand
  "Ψ": [undefined, "Ψ"], "Φ": [undefined, "Φ"], "Ω": [undefined, "Ω"], "Δ": [undefined, "Δ"], ",": ["~", " "], _: ["S", " "], ":": ["z", " "],
};
const PIECES = {
  // 바람초원 · 속삭임 숲
  shrine: ["qUUUUUq", "UrrrrrU", "Urr*rrU", "q.rrr.q", "..r.r..", "......."],
  circle: ["...O.O...", ".O.....O.", "...fff...", "O.ff.ff.O", "..f.*.f..", "O.ff.ff.O", "...fff...", ".O.....O.", "...O.O..."],
  lookout: ["FFFFFFF", "F.E..lF", "F.....F", "F..*..F", "Fu.....", "FFF..FF"],
  bloom: [".BfffB.", "Bff.ffB", "ff.*.ff", "Bff.ffB", ".Bf.fB."],
  deadgrove: ["..A...A..", ".A..j..A.", "...jjj...", "A.jj*jj.A", "...jjj..u", ".A.....A.", "..A.l.A..", "........."],
  ring: ["..Y.Y..", ".Y...Y.", "Y..f..Y", "..f*f..", "Y..f..Y", ".Y...Y.", "..Y.Y.."],
  cache: [".BRB.", "R...R", "B.*.B", "R...."],
  menhir: ["..O..", ".f.f.", "O.*.O", ".f.f.", "....."],
  camp: [".E...l.", "..ppp..", ".pp#pp.", "u.ppp..", "......."],
  stair: ["UUUUUU", "Uq<<qU", "UrrrrU", "U.>>.U", "......"],
  // 단풍 왕도 — what is left of the kingdom. The chapel is the stag king's lair; the cottage is a camp with a hermit;
  // the rest are dead ends with a chest and a keeper (the graveyard grows roses, the stalk field scarecrows ...)
  chapel: ["J..NNNN.J", ".V.NNNN.V", "J.*====.J", "..=====..", "J.==@==.J", "........."],
  cottage: [".l.$$$u.", "...$$$..", ".Y.ppp..", "..pp#pp.", "........"],
  watchtower: [".R!!!.V.", "..!!!...", "R.rrr.R.", ".rr*rr..", ".R.r.rR.", "........"],
  kinggate: ["z.^^^^.z.", "..^^^^...", "..====...", ".==.*.==.", "z.====.z.", "........."],
  graveyard: ["FFF..FFFF", "F.J..J.JF", "FJ..*...F", "F.J...JBF", "F..J.J..F", "FFFF..FFF"],
  scarefield: ["FF.FF.FF", "Ft.tt.tF", "F.t*t.tF", "Ftt.tt.F", "F.t..t.F", "FFF..FFF"],
  leafmound: [".u...l.", "%%%%%%.", "%%%Y%%u", "u%%*%%%", ".%%%%%.", "...l..."],
  treetunnel: [".TTTTTTT.", "T.=====.T", "..====*=T", "T.=====.T", ".TTTTTTT."],
  // 모래바람 오아시스 · 산호 해안 · 정글 해안도로 (maps-v2 M3): mud huts round a yard, a caravan's tents by a fire,
  // a dry well, a ring of palms, a tide pool walled by reef, a boulder cove
  hamlet: [".Δ...Δ.", "...p...", "Δ.p*p.Δ", "...p...", ".Ψ...Δ."],
  caravan: [".E...E.", "..ppp..", ".pp#pp.", "Ψ.ppp.l", "......."],
  drywell: ["..Ψ..", ".rrr.", "Or*rO", ".rrr.", "....."],
  palmring: ["Ψ.Ψ.Ψ", ".....", "Ψ.*.Ψ", ".....", "Ψ...Ψ"],
  tidepool: [".Φ,Φ.", "Φ,,,Φ", ",,*,,", "Φ,,,.", ".Φ.Φ.", "....."],
  cove: ["ΩΩ.ΩΩ", "Ω___Ω", "__*__", "Ω___.", ".Ω.Ω."],
  // 모래바다 (dunesea): the oasis village — mud huts and palms round a yard with a fire that always burns
  village: [".Δ...Ψ...Δ...", ".......l.....", "Δ...ppp....Δ.", "...pp#pp.....", "....ppp...Ψ..", ".Ψ.......Δ...", "....Δ.E......", "............."],
  // 잊힌 신전 (maps-v2, reference 3): a processional way three flagstones wide from the south gate to the
  // shrine in the north, round a rune pool; broken colonnades and wall stubs make side chambers. Never turned.
  temple: [
    "...UUqUUUqUU...",
    "..Uq.=====.qU..",
    "..U..==*==..U..",
    "..q.=======.q..",
    "......=@=......",
    "UUq...===...qUU",
    "Ur.q..===..q.rU",
    "U.r...===...r.U",
    "q.....=~=.....q",
    "...q.~~~~~.q...",
    "....=~~~~~=....",
    "...q.~~~~~.q...",
    "q.....=~=.....q",
    "U.r...===...r.U",
    "Ur.q..===..q.rU",
    "UUq...===...qUU",
    "......===......",
    ".q...=====...q.",
    "..U..=====..U..",
    "..Uq.=====.qU..",
    "......===......",
  ],
};
/** Pieces whose ruin is one big picture standing on its footprint: never turned (a mirror is fine). */
const UPRIGHT = new Set(["chapel", "cottage", "watchtower", "kinggate", "temple"]);
/** Stamp a set piece and return where its tags landed: { chest: [[x, y]], fire: [...], ... }. */
function piece(m, name, x, y, rot, flip) {
  const rows = PIECES[name], out = {};
  stamp(m, rows, x, y, PIECE, rot, flip);
  const h = rows.length, w = rows[0].length;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const L2 = PIECE[rows[j][i]];
    if (!L2 || !L2[2]) continue;
    let u = flip ? w - 1 - i : i, v = j;
    for (let r = 0; r < rot; r++) { const t = u; u = (r % 2 ? w : h) - 1 - v; v = t; }
    (out[L2[2]] || (out[L2[2]] = [])).push([x + u, y + v]);
  }
  return out;
}

/**
 * Open country: the meadow and the forest. See the notes at the top of this section.
 * cfg: size, seed, ground/edge/tree characters, the monsters by depth, the region
 * spacing `r`, `warp`, how the tree grows (`wind`, `loops`, `merge`), the barriers
 * (`walls`), how steep a step must be to show as a cliff, and the set pieces wanted.
 */
function wilds(cfg) {
  const box = { seed: cfg.seed }, S0 = cfg.seed;
  const W = cfg.w, H = cfg.h;
  const m = blank(cfg.id, cfg.name, W, H, cfg.ground);
  m.bgm = cfg.bgm || "field";
  m.theme = cfg.theme;
  m.pieces = [];
  const El = field(m, S0 + 1, 24, 2), Mo = field(m, S0 + 2, 17, 2), N1 = field(m, S0 + 5, 5, 2);
  const N2 = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) N2[i] = (h2(i % W, Math.floor(i / W), S0 + 6) + h2(i % W >> 1, Math.floor(i / W) >> 1, S0 + 7)) / 2;
  const at = (i) => [i % W, Math.floor(i / W)];
  const keep = new Uint8Array(W * H);
  // (`hold` marks what a later big piece may not stand on: doors, pieces, jetties; a gap in a border is only kept)
  const hold = new Uint8Array(W * H);
  const keepBox = (x0, y0, x1, y1, soft) => { for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) { keep[y * W + x] = 1; if (!soft) hold[y * W + x] = 1; } };

  // ways in and out on the rim, each with a region of its own grown around it
  const gates = {}, fixed = [];
  for (const [name, side, f] of cfg.gates) {
    if (side === "w") { const gy = Math.round(f * H); gates[name] = { t: [[1, gy], [1, gy + 1]], a: [[4, gy], [4, gy + 1]] }; fixed.push([7, gy]); keepBox(1, gy - 2, 7, gy + 3); }
    else if (side === "e") { const gy = Math.round(f * H); gates[name] = { t: [[W - 2, gy], [W - 2, gy + 1]], a: [[W - 5, gy], [W - 5, gy + 1]] }; fixed.push([W - 8, gy]); keepBox(W - 8, gy - 2, W - 2, gy + 3); }
    else if (side === "s") { const gx = Math.round(f * W); gates[name] = { t: [[gx, H - 2], [gx + 1, H - 2]], a: [[gx, H - 5], [gx + 1, H - 5]] }; fixed.push([gx, H - 8]); keepBox(gx - 2, H - 8, gx + 3, H - 2); }
    else { const gx = Math.round(f * W); gates[name] = { t: [[gx, 1], [gx + 1, 1]], a: [[gx, 4], [gx + 1, 4]] }; fixed.push([gx, 7]); keepBox(gx - 2, 1, gx + 3, 7); }
  }
  // the sea (maps-v2 M3): one side of the map is water. `sd` is how far a tile lies out from the waterline (tiles,
  // < 0 on land): surf to `surf`, walkable shallows to `dz`, deep sea beyond — no region is grown out there
  const sea = cfg.sea || null, sd = sea ? new Float32Array(W * H) : null, dz = sea ? sea.surf + (sea.shallow || 0) : 0;
  let sx0 = 5, sy1 = H - 6;
  if (sea) {
    const p1 = rnd(box) * 6.28, p2 = rnd(box) * 6.28;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = sea.side === "w" ? y : x, out = sea.side === "w" ? x : H - 1 - y;
      sd[y * W + x] = sea.at + Math.sin(u / 13 + p1) * sea.amp * 0.55 + Math.sin(u / 5.3 + p2) * sea.amp * 0.2 + (N1[y * W + x] - 0.5) * sea.amp * 0.5 - out;
    }
    const lim = Math.max(0, Math.ceil(sea.at + sea.amp - dz)) + 2;
    if (sea.side === "w") sx0 += lim; else sy1 -= lim;
  }
  // big oases (dunesea) [fx, fy, clear, lake radius, lake offset x, y, piece]: each a site of its own that weighs more,
  // with no other site within `clear` of it, so its region comes out several times the usual size
  const oases = (cfg.oases || []).map(([fx, fy, clr, rad, ox, oy, pc]) => ({ x: Math.round(fx * W), y: Math.round(fy * H), clr, rad, ox: ox || 0, oy: oy || 0, pc: pc || null }));
  const nFix = fixed.length;
  for (const o of oases) fixed.push([o.x, o.y]);
  let sitePts = poisson(box, sx0, 5, W - 6, sy1, cfg.r, fixed);
  if (oases.length) sitePts = sitePts.filter(([x, y], j) => j < fixed.length || !oases.some((o) => Math.hypot(x - o.x, y - o.y) < o.clr));
  const sites = sitePts.map(([x, y], j) => ({ x, y, w: j >= nFix && j < fixed.length ? 2.2 : 0.78 + rnd(box) * 0.5 }));
  const lab = partition(m, sites, S0 + 3, cfg.warp, (x, y) => x >= 2 && y >= 2 && x < W - 2 && y < H - 2 && !(sd && sd[y * W + x] > dz));
  const { R, E: bord, inner } = regionsOf(m, lab, sites.length);
  for (const r of R) { let e = 0, mo = 0; for (const i of r.tiles) { e += El[i]; mo += Mo[i]; } r.e = e / Math.max(1, r.area); r.mo = mo / Math.max(1, r.area); }
  // (how far out to sea a region's heart lies: < 0 on land, -99 on a map with no sea)
  for (const r of R) r.sd = sd ? sd[r.py * W + r.px] : -99;
  const n = R.length;
  let links = [...bord.values()].filter((e) => e.n >= 4);
  // long ridges (dunesea, cfg.rampP): where the levels are laid out by place, a border between two levels may only be
  // climbed here and there — the longest border between each two neighbouring stretches of level ground always, any
  // other with chance rampP — so a ridge runs unbroken for a long way between its ramps
  if (cfg.tierOf && cfg.rampP !== undefined) {
    const tv = R.map((r) => cfg.tierOf(r)), uf = R.map((r) => r.k);
    const find = (a) => { while (uf[a] !== a) a = uf[a] = uf[uf[a]]; return a; };
    for (const e of links) if (tv[e.a] === tv[e.b]) uf[find(e.a)] = find(e.b);
    const best = new Map();
    for (const e of links) {
      if (tv[e.a] === tv[e.b]) continue;
      const key = ekey(find(e.a), find(e.b)), was = best.get(key);
      if (!was || e.n > was.n) best.set(key, e);
    }
    const sure = new Set(best.values());
    links = links.filter((e) => tv[e.a] === tv[e.b] || sure.has(e) || h2(e.a, e.b, S0 + 31) < cfg.rampP);
  }
  const tree = grow(box, n, links.map((e) => [e.a, e.b]), 0, cfg.wind, cfg.loops);
  const D = tree.dist, far = tree.far;

  // what each region is for
  const role = new Array(n).fill("field");
  const gateIdx = {};
  cfg.gates.forEach(([name], k) => { gateIdx[name] = k; role[k] = "gate"; });
  const exitIdx = gateIdx[cfg.exit];
  // (dunesea: the made way calls at places as it goes — cfg.via [[fx, fy]]: the shortest walk over the links from each to the next)
  const viaK = (cfg.via || []).map(([fx, fy]) => lab[Math.round(fy * H) * W + Math.round(fx * W)]).filter((k) => k >= 0 && D[k] >= 0);
  const hop = (a, b) => {
    const par = new Map([[a, -1]]), q = [a];
    for (let h = 0; h < q.length && !par.has(b); h++) for (const o of tree.adj[q[h]]) if (!par.has(o) && tree.linked(q[h], o)) { par.set(o, q[h]); q.push(o); }
    const out = [];
    for (let c = b; c !== undefined && c >= 0; c = par.get(c)) out.unshift(c);
    return out;
  };
  const wayTo = (k) => { let out = [0]; for (const v of viaK.concat(k)) out = out.concat(hop(out[out.length - 1], v).slice(1)); return out; };
  const main = viaK.length ? wayTo(exitIdx) : tree.path(exitIdx), onMain = new Set(main);
  for (let k = 0; k < n; k++) if (D[k] < 0) role[k] = "wild";             // cut off by thin borders: left as thicket
  oases.forEach((o, j) => { if (role[nFix + j] === "field") { role[nFix + j] = "lake"; R[nFix + j].oasis = o; } });
  // islets (dunesea): regions midway out in the shallows, spread along the coast, become sand islands with a chest
  if (sea && sea.islets) {
    const got = [];
    for (const k of R.map((r) => r.k).filter((k) => role[k] === "field" && R[k].inr >= 4 && R[k].sd > sea.surf + 7 && R[k].sd < dz - 7).sort((a, b) => Math.abs(R[a].sd - dz * 0.5) - Math.abs(R[b].sd - dz * 0.5) || a - b)) {
      if (got.length >= sea.islets) break;
      if (got.some((q) => Math.hypot(R[q].px - R[k].px, R[q].py - R[k].py) < sea.isletGap)) continue;
      got.push(k); role[k] = "islet";
    }
  }
  const pickRole = (want, list) => { const r = list.find((k) => role[k] === "field"); if (r !== undefined) role[r] = want; return r; };
  const byDepth = (f) => R.map((r) => r.k).filter(f).sort((a, b) => D[b] - D[a] || R[b].inr - R[a].inr);
  const campR = pickRole("camp", main.slice(Math.floor(main.length * 0.35), Math.floor(main.length * 0.75)).filter((k) => R[k].inr >= 4).sort((a, b) => R[b].inr - R[a].inr));
  if (cfg.stair) {
    // the way down: a dead end partway in, roomy enough for the ruin over it (or failing that, any quiet corner)
    const tries = [(k) => tree.deg[k] === 1 && D[k] >= far * 0.3 && D[k] <= far * 0.85 && R[k].inr >= 5, (k) => tree.deg[k] === 1 && D[k] >= far * 0.2 && R[k].inr >= 4, (k) => !onMain.has(k) && D[k] >= 2 && R[k].inr >= 4];
    for (const f of tries) if (pickRole("stair", byDepth(f)) !== undefined) break;
  }
  // a lair: the deepest roomy dead end, where a guardian keeps a chest (the old kingdom's chapel)
  if (cfg.lair) {
    const tries = [(k) => tree.deg[k] === 1 && D[k] >= far * 0.5 && R[k].inr >= 5, (k) => !onMain.has(k) && D[k] >= far * 0.4 && R[k].inr >= 4, (k) => D[k] >= 2 && R[k].inr >= 4];
    for (const f of tries) if (pickRole("lair", byDepth(f)) !== undefined) break;
  }
  for (let v = 0; v < cfg.vaults; v++) if (pickRole("vault", byDepth((k) => tree.deg[k] === 1 && R[k].inr >= 4)) === undefined) pickRole("vault", byDepth((k) => !onMain.has(k) && D[k] >= far * 0.3 && R[k].inr >= 4));
  const lakeList = R.map((r) => r.k).filter((k) => role[k] === "field" && !onMain.has(k) && R[k].inr >= 5 && D[k] > 1).sort((a, b) => R[a].e - R[b].e);
  for (let v = 0; v < cfg.lakes; v++) pickRole("lake", lakeList);
  for (let v = 0; v < cfg.ruins; v++) pickRole("ruin", byDepth((k) => !onMain.has(k) && D[k] >= far * 0.4 && R[k].inr >= 3).reverse());
  // terraces (maps-v2): the regions ranked by height and cut into `tiers` levels; a step between levels is a cliff
  let tier = null;
  if (cfg.tiers) {
    tier = new Array(n).fill(0);
    R.map((r) => r.k).sort((a, b) => R[a].e - R[b].e || a - b).forEach((k, j) => { tier[k] = Math.min(cfg.tiers - 1, Math.floor(j * cfg.tiers / n)); });
    // the ways in stand on the lowest ground, so every door opens onto a valley floor
    // (dunesea lays its levels out by place instead — long dune ridges, the oasis belt, the shore: cfg.tierOf(region))
    if (cfg.tierOf) for (const r of R) tier[r.k] = cfg.tierOf(r);
    else for (const k of Object.values(gateIdx)) tier[k] = 0;
    m.tier = tier;
  }
  // and what grows there
  const biome = R.map((r) => (role[r.k] === "gate" || role[r.k] === "camp" ? cfg.biomes.plain : cfg.biome(r.e, r.mo, rnd(box), tier ? tier[r.k] : 0, r)));

  // ground: each region's own surface, broken up by noise
  for (let i = 0; i < W * H; i++) {
    const k = lab[i];
    if (k < 0) continue;
    const [x, y] = at(i);
    m.g[y][x] = cfg.paint(biome[k], N1[i], N2[i], x, y) || cfg.ground;
  }

  // the barriers: every border the tree did not take is shut; a link leaves a gap, or no barrier at all
  const hiOf = (e) => (tier ? (tier[e.a] > tier[e.b] || (tier[e.a] === tier[e.b] && R[e.a].e >= R[e.b].e) ? e.a : e.b) : R[e.a].e >= R[e.b].e ? e.a : e.b);
  const wallKind = () => { let r = rnd(box); for (const [t, w] of cfg.walls) { if (r < w) return t; r -= w; } return cfg.walls[0][0]; };
  const put = (i, kind) => {
    const [x, y] = at(i);
    if (keep[i] || x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return;
    // (dunesea: no barrier stands in the dry riverbed — cfg.open; and a barrier's kind may follow the place — cfg.wallAt)
    if (cfg.open && cfg.open(x, y)) return;
    if (cfg.wallAt && kind !== "cliff") kind = cfg.wallAt(kind, x, y);
    if (kind === "cliff") m.o[y][x] = "C";
    else if (kind === "trees") m.o[y][x] = h2(x, y, S0) < 0.82 ? cfg.treeCh : cfg.treeCh2;
    else if (kind === "hedge") m.o[y][x] = "H";
    else if (kind === "rocks") m.o[y][x] = cfg.rocks ? cfg.rocks[h2(x, y, S0) < 0.5 ? 0 : 1] : h2(x, y, S0) < 0.5 ? "R" : "B";
    else if (kind === "palms") m.o[y][x] = h2(x, y, S0) < 0.8 ? "Ψ" : "B";
    else if (kind === "ruin") m.o[y][x] = h2(x, y, S0) < 0.85 ? "U" : "q";
    else if (kind === "bramble") m.o[y][x] = h2(x, y, S0) < 0.7 ? "B" : cfg.treeCh;
  };
  const steps = [], gapAt = new Map();
  for (const e of bord.values()) {
    if (role[e.a] === "wild" || role[e.b] === "wild") { for (const t of e.tiles) put(t, "trees"); continue; }
    const linked = tree.linked(e.a, e.b) && e.n >= 4;
    const dE = Math.abs(R[e.a].e - R[e.b].e);
    let gap = null;
    if (linked) {
      // the gap: near the middle of the shared border, so the way through is plain to see
      let sx = 0, sy = 0;
      for (const t of e.tiles) { const [x, y] = at(t); sx += x; sy += y; }
      sx /= e.tiles.length; sy /= e.tiles.length;
      const dd = (t) => { const x = t % W, y = (t - x) / W; return (x - sx) ** 2 + (y - sy) ** 2; };
      const cand = e.tiles.map((t) => [dd(t), t]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
      gap = at(cand[ri(box, 0, Math.min(cand.length - 1, Math.max(1, Math.floor(cand.length * 0.3))))]);
      gapAt.set(ekey(e.a, e.b), gap);
    }
    let kind, gr;
    if (tier) {
      // terraces: one level to the next is always a cliff, climbed by a wide ramp where the tree links them;
      // on one level the ground runs on, open, or now and then a belt of trees, a hedge or boulders
      // (a dead end that keeps a chest stays shut but for one way in, three tiles wide: a hidden pocket)
      const nook = ["vault", "lair", "stair"].includes(role[e.a]) || ["vault", "lair", "stair"].includes(role[e.b]);
      if (tier[e.a] !== tier[e.b]) { kind = "cliff"; gr = nook ? 1 : cfg.ramp || 2; }
      else if (!nook && (linked || rnd(box) < (typeof cfg.tierOpen === "function" ? cfg.tierOpen(R[e.a], R[e.b]) : cfg.tierOpen))) continue;
      else { kind = wallKind(); gr = nook ? 1 : cfg.gap; }
    } else {
      if (linked && rnd(box) < cfg.merge && dE < cfg.cliff) continue;
      kind = dE >= cfg.cliff && rnd(box) < 0.85 ? "cliff" : wallKind();
      gr = kind === "cliff" ? 1 : cfg.gap;
    }
    const hi = hiOf(e);
    for (const t of e.tiles) {
      if (kind === "cliff" && lab[t] !== hi) continue;
      const [x, y] = at(t);
      if (gap && Math.max(Math.abs(x - gap[0]), Math.abs(y - gap[1])) <= gr) { keep[t] = 1; if (kind === "cliff") steps.push(t); continue; }
      if (cfg.open && cfg.open(x, y)) { if (kind === "cliff") steps.push(t); continue; }       // the riverbed comes down each ridge in steps
      put(t, kind);
      // belts of trees grow thicker here and there
      if (kind === "trees" && N1[t] > 0.5) for (const [dx, dy] of D4) { const j = (y + dy) * W + x + dx; if ((lab[j] === e.a || lab[j] === e.b) && N2[j] > 0.45) put(j, kind); }
    }
    if (gap) keepBox(gap[0] - gr - 1, gap[1] - gr - 1, gap[0] + gr + 1, gap[1] + gr + 1, true);
  }
  // where a way climbs a cliff, it climbs steps
  for (const t of steps) { const [x, y] = at(t); m.o[y][x] = " "; m.g[y][x] = "v"; }

  // the rim: a ragged fringe of the edge wood, thicker where the noise says
  border(m, cfg.edge, 2);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, d = Math.min(x - 2, y - 2, W - 3 - x, H - 3 - y);
    if (d <= 3 && !keep[i] && N1[i] + (3 - d) * 0.17 > 0.86) m.o[y][x] = cfg.edge;
  }

  // the sea and its shore: deep water, a band of walkable shallows with reef rocks, sand islets and the odd deep
  // hole, the surf line, then the beach (sand, or a strand of black boulders); a barrier that ran out into the
  // water stands on as reef
  if (sea) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, d = sd[i], rim = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
      if (d <= -sea.beach) continue;
      if (d > dz || (d > 0 && rim)) { m.g[y][x] = "w"; m.o[y][x] = " "; continue; }
      if (rim) continue;
      const was = m.o[y][x] !== " ";
      if (d > 0) {
        const sh = d > sea.surf;
        m.g[y][x] = sh ? "~" : "-";
        m.o[y][x] = was && !keep[i] ? "Φ" : " ";
        if (!sh || keep[i]) continue;
        const inner2 = d > sea.surf + 2 && d < dz - 2;
        if (inner2 && El[i] > (sea.isle || 0.6)) { m.g[y][x] = sea.sand; if (!was && h2(x, y, S0 + 21) < 0.1) m.o[y][x] = "Ψ"; }
        else if (inner2 && !was && Mo[i] > 0.72 && N1[i] > 0.45) m.g[y][x] = "w";
        else if (!was && N1[i] > 0.6 && h2(x, y, S0 + 22) < sea.reef) m.o[y][x] = "Φ";
      } else {
        m.g[y][x] = sea.sand;
        if (keep[i]) continue;
        if (was) { if (sea.rock) m.o[y][x] = sea.rock; }
        else if (sea.rock && h2(x, y, S0 + 23) < sea.rockP * (N1[i] > 0.5 ? 1.6 : 0.6)) m.o[y][x] = sea.rock;
      }
    }
    // an islet: a round of sand in the shallows, palms on its rim
    for (const r of R) {
      if (role[r.k] !== "islet") continue;
      const rad = Math.min(r.inr, 7.5);
      for (const i of r.tiles) {
        const [x, y] = at(i), d = Math.hypot(x - r.px, (y - r.py) * 1.15) + (N1[i] - 0.5) * 2;
        if (d >= rad || sd[i] <= sea.surf || sd[i] >= dz) continue;
        m.g[y][x] = sea.sand;
        m.o[y][x] = !keep[i] && d > rad - 2.2 && h2(x, y, S0 + 26) < 0.16 ? "Ψ" : " ";
      }
    }
  }

  // the river: it runs downhill from the top of the map to the bottom
  const falls = [], riverAt = new Uint8Array(W * H);
  const water = (x, y) => { if (x < 2 || y < 1 || x >= W - 2 || y >= H - 1 || (sd && sd[y * W + x] > 0)) return; m.g[y][x] = "w"; m.o[y][x] = " "; };
  if (cfg.river) {
    // a meandering centre line — two sine waves of different length and some noise — from the top edge to the bottom
    const sx = W * (0.38 + rnd(box) * 0.24), a1 = 4 + rnd(box) * 2.5, l1 = 11 + rnd(box) * 5, p1 = rnd(box) * 6.28, a2 = 1.5 + rnd(box), l2 = 4.5 + rnd(box) * 2;
    let px = null;
    for (let y = 1; y < H - 1; y++) {
      const x = Math.round(clamp(sx + Math.sin(y / l1 + p1) * a1 + Math.sin(y / l2 + p1 * 2) * a2 + (N1[y * W + Math.round(sx)] - 0.5) * 3, 7, W - 9));
      // fill across from where the last row ended, so the bank never breaks
      const from = px === null ? x : Math.min(px, x), to = px === null ? x : Math.max(px, x);
      const wide = 2 + (N2[y * W + x] > 0.6 ? 1 : 0) + (cfg.riverW || 0);
      for (let X = from; X <= to + wide - 1; X++) { if (m.o[y][X] === "C") falls.push([X, y]); water(X, y); if (X >= 0 && X < W) riverAt[y * W + X] = 1; }
      px = x;
    }
  }
  // waterfalls (maps-v2): where the river drops over a terrace's cliff it pours into a pool on the lower level
  m.falls = [];
  if (tier && cfg.pools) {
    const done = [];
    for (const [fx, fy] of falls) {
      if (done.some(([x, y]) => Math.abs(x - fx) + Math.abs(y - fy) < 8)) continue;
      done.push([fx, fy]);
      const tAt = (y) => { const k = lab[clamp(y, 0, H - 1) * W + fx]; return k >= 0 ? tier[k] : 9; };
      const dir = tAt(fy + 3) <= tAt(fy - 3) ? 1 : -1, low = tAt(fy + 3 * dir);
      const cx = fx, cy = fy + dir * 4, rad = cfg.pools + rnd(box) * 1.2;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -6; dx <= 6; dx++) {
        const X = cx + dx, Y = cy + dy, i = Y * W + X;
        if (X < 3 || Y < 3 || X >= W - 3 || Y >= H - 3 || keep[i] || m.o[Y][X] === "C" || lab[i] < 0 || tier[lab[i]] !== low) continue;
        if (Math.hypot(dx * 0.85, dy) + (N2[i] - 0.5) * 1.4 < rad) water(X, Y);
      }
      m.falls.push([fx, fy, dir]);
    }
  }
  // lakes: the low ground of a region or two fills with water; a jetty to fish from
  const lakes = [];
  for (const r of R) {
    if (role[r.k] !== "lake") continue;
    // (an oasis keeps its own lake, set a little to one side so the village has room beside it)
    const oa = r.oasis, rad = oa ? Math.min(r.inr - 2 - Math.max(Math.abs(oa.ox), Math.abs(oa.oy)), oa.rad) : Math.min(r.inr - 2, cfg.lakeR);
    const lx = r.px + (oa ? oa.ox : 0), ly = r.py + (oa ? oa.oy : 0);
    for (const i of r.tiles) {
      const [x, y] = at(i), d = Math.hypot(x - lx, (y - ly) * 1.3) + (N1[i] - 0.5) * 3.2;
      if (d < rad) water(x, y);
    }
    lakes.push(r);
  }
  // shores, reeds
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (m.g[y][x] === "w") {
      const edge = D4.some(([dx, dy]) => m.g[y + dy][x + dx] !== "w");
      if (edge && h2(x, y, S0 + 9) < 0.16) m.o[y][x] = "e";
      continue;
    }
    if (cfg.shore && D4.some(([dx, dy]) => m.g[y + dy][x + dx] === "w")) { m.g[y][x] = cfg.shore; if (!"CH".includes(m.o[y][x])) m.o[y][x] = m.o[y][x] === "e" ? " " : m.o[y][x]; }
  }
  for (const r of lakes) {
    // a jetty from the shore nearest the region's way in, three planks out over the water
    let best = null, bd = Infinity;
    for (const i of r.tiles) {
      const [x, y] = at(i);
      if (m.g[y][x] === "w" || m.o[y][x] !== " ") continue;
      for (const [dx, dy] of D4) {
        if (m.g[y + dy][x + dx] !== "w" || m.g[y + 2 * dy] && m.g[y + 2 * dy][x + 2 * dx] !== "w") continue;
        const d = Math.hypot(x - r.cx, y - r.cy) + h2(x, y, 3) * 2;
        if (d < bd) { bd = d; best = [x, y, dx, dy]; }
      }
    }
    if (!best) continue;
    const [x, y, dx, dy] = best;
    for (let s = 1; s <= 3; s++) { const X = x + dx * s, Y = y + dy * s; if (m.g[Y][X] !== "w") break; m.g[Y][X] = "b"; m.o[Y][X] = " "; }
    keepBox(x - 1, y - 1, x + 1, y + 1);
  }

  // the gorge (maps-v2, mossy cliffs over a stream): the river runs in a cut — its banks stand up as cliffs —
  // crossed every so often by a bridge or a ford, where the bank comes down in steps to the water
  m.crossings = [];
  if (cfg.gorge && cfg.river) {
    const isW = (x, y) => x >= 0 && y >= 0 && x < W && y < H && riverAt[y * W + x] === 1 && m.g[y][x] === "w";
    const nearW = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isW(x + dx, y + dy)) return true; return false; };
    const bank = [];
    for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) if (!isW(x, y) && !keep[y * W + x] && nearW(x, y) && m.g[y][x] !== "b") bank.push(y * W + x);
    for (const i of bank) { const [x, y] = at(i); m.o[y][x] = "C"; }
    // the crossings: evenly down the river, each a band five rows tall; bridges and fords by turns,
    // and the bank's cliff comes down in steps on either side
    for (let j = 0, y0 = cfg.gorge.first; y0 < H - 6; j++, y0 += cfg.gorge.every) {
      const yc = clamp(y0 + ri(box, -2, 2), 4, H - 5), ford = j % 2 === 1;
      for (let y = yc - 2; y <= yc + 2; y++) {
        const xs = [];
        for (let x = 3; x < W - 3; x++) if (riverAt[y * W + x]) { m.g[y][x] = ford ? "s" : "b"; m.o[y][x] = " "; xs.push(x); }
        if (!xs.length) continue;
        const lo = Math.min(...xs), hi = Math.max(...xs);
        for (let x = lo - 2; x <= hi + 2; x++) if (m.o[y][x] === "C") { m.o[y][x] = " "; m.g[y][x] = "v"; }
        keepBox(lo - 3, y, hi + 3, y);
      }
      m.crossings.push([yc, ford ? "ford" : "bridge"]);
    }
  }

  // set pieces
  const free = (x, y) => m.o[y][x] === " " && !"wbv~-".includes(m.g[y][x]) && !keep[y * W + x];
  const placeIn = (r, name, pad) => {
    const rot0 = ri(box, 0, 3), flip = rnd(box) < 0.5, rot = UPRIGHT.has(name) ? 0 : rot0;
    const [w, h] = stampSize(PIECES[name], rot);
    // a piece may stand where loose trees grow (it clears them), never on a barrier, water or a kept way
    const room = (x, y) => !"wbv~-".includes(m.g[y][x]) && !keep[y * W + x] && !"CHUZ".includes(m.o[y][x]);
    const p = fitIn(m, lab, inner, r, w, h, pad, room) || fitIn(m, lab, inner, r, w, h, 2, room) || (cfg.padMin === 1 ? fitIn(m, lab, inner, r, w, h, 1, room) : null);
    if (!p) return null;
    const tags = piece(m, name, p[0], p[1], rot, flip);
    m.pieces.push(name);
    keepBox(p[0] - 1, p[1] - 1, p[0] + w, p[1] + h);
    return { x: p[0], y: p[1], w, h, tags };
  };
  const special = [], spawns = [];
  const doors = [], bars = [], lateFires = [];
  let vn = 0, isn = 0;
  for (const r of R) {
    const k = r.k, t = D[k] / far;
    if (role[k] === "lake" && r.oasis && r.oasis.pc) {
      // the oasis village: huts round a fire beside the lake (a second camp; a waypoint stone stands by it: markRoutes)
      const p = placeIn(r, r.oasis.pc, 2);
      if (p) { const f = p.tags.fire[0]; lateFires.push(f); special.push(f); doors.push(f); m.village = { x: p.x, y: p.y, w: p.w, h: p.h }; (m.stonesAt || (m.stonesAt = [])).push(f); }
    } else if (role[k] === "islet") {
      // an islet's chest and its keepers; a sand bar is laid to it from the beach (below)
      let p = null;
      for (let j = 0; j < sea.isletKinds.length && !p; j++) p = placeIn(r, sea.isletKinds[(isn + j) % sea.isletKinds.length], 2);
      isn++;
      if (p) {
        const [cx, cy] = p.tags.chest[0];
        spawns.push({ k: cfg.chest, n: 1, r: [cx, cy, cx, cy] });
        spawns.push({ k: cfg.mobs[cfg.mobs.length - 2], n: 2, r: [p.x - 1, p.y - 1, p.x + p.w, p.y + p.h], elite: 0.3 });
        special.push([cx, cy]);
        bars.push([cx, cy]);
      }
    } else if (role[k] === "camp") {
      // a camp must exist: on the main way if it fits anywhere along it, else in the roomiest quiet region
      const cp = cfg.campPiece || "camp";
      let p = placeIn(r, cp, 2);
      for (const o of main.filter((q) => q !== k && role[q] === "field").sort((a, b) => R[b].inr - R[a].inr)) { if (p) break; p = placeIn(R[o], cp, 2); }
      for (const o of R.map((q) => q.k).filter((q) => q !== k && role[q] === "field" && D[q] >= 2).sort((a, b) => R[b].inr - R[a].inr)) { if (p) break; p = placeIn(R[o], cp, 2); }
      if (!p && cp !== "camp") p = placeIn(r, "camp", 2);
      if (p) { FIRES[cfg.id].push(p.tags.fire[0]); special.push(p.tags.fire[0]); doors.push(p.tags.fire[0]); m.camp = { x: p.x, y: p.y, w: p.w, h: p.h }; }
    } else if (role[k] === "lair") {
      // the guardian's ground: if the piece will not fit here, the next deep quiet region with room takes it
      let p = placeIn(r, cfg.lair.piece, 2);
      for (const o of byDepth((q) => q !== k && role[q] === "field" && !onMain.has(q) && D[q] >= far * 0.4)) { if (p) break; p = placeIn(R[o], cfg.lair.piece, 2); }
      if (p) {
        const [bx, by] = p.tags.boss[0];
        spawns.push({ k: cfg.lair.guard, n: 1, r: [bx, by, bx, by], el: 2 });
        if (p.tags.chest) { const [cx, cy] = p.tags.chest[0]; spawns.push({ k: cfg.chest, n: 1, r: [cx, cy, cx, cy] }); special.push([cx, cy]); }
        spawns.push({ k: cfg.lair.pack || cfg.mobs[cfg.mobs.length - 1], n: 3, r: [p.x - 1, p.y - 1, p.x + p.w, p.y + p.h], elite: 0.25 });
        special.push([bx, by]);
        doors.push([bx, by]);
        m.lair = [bx, by];
      }
    } else if (role[k] === "vault") {
      // the piece meant for it, or failing that whichever of the others fits, smallest last
      const want = cfg.vaultKinds[vn++ % cfg.vaultKinds.length];
      const used = (q) => m.pieces.filter((x) => x === q).length;
      const kinds = [want, ...cfg.vaultKinds.filter((q) => q !== want).sort((a, b) => used(a) - used(b) || PIECES[b].length * PIECES[b][0].length - PIECES[a].length * PIECES[a][0].length)];
      let p = null;
      let kind = null;
      for (kind of kinds) if ((p = placeIn(r, kind, 2))) break;
      if (p) {
        const [cx, cy] = p.tags.chest[0];
        spawns.push({ k: cfg.chest, n: 1, r: [cx, cy, cx, cy] });
        // some pieces breed their own keepers (roses in the graveyard, scarecrows in the stalks)
        const keeper = bandMob(box, cfg.mobs, Math.min(1, t + 0.15), D[k]);
        spawns.push({ k: (cfg.vaultMobs && cfg.vaultMobs[kind]) || keeper, n: 2, r: [p.x - 1, p.y - 1, p.x + p.w, p.y + p.h], elite: 0.3 });
        special.push([cx, cy]);
      }
    } else if (role[k] === "stair") {
      // the way down must exist: if the ruin will not fit here, it goes to the next quiet region that has room
      let p = placeIn(r, "stair", 2);
      for (const o of byDepth((q) => q !== k && !onMain.has(q) && D[q] >= 2 && role[q] !== "gate")) { if (p) break; p = placeIn(R[o], "stair", 2); }
      for (const o of byDepth((q) => q !== k && role[q] !== "gate" && D[q] >= 1)) { if (p) break; p = placeIn(R[o], "stair", 2); }
      if (p) {
        gates[cfg.stair] = { t: p.tags.t, a: p.tags.a };
        spawns.push({ k: cfg.mobs[cfg.mobs.length - 1], n: 3, r: [p.x - 1, p.y - 1, p.x + p.w, p.y + p.h], elite: 0.3 });
        special.push(...p.tags.a);
        doors.push(p.tags.a[0]);
      }
    } else if (role[k] === "ruin") {
      // fallen walls and broken columns on old flagstones, and more monsters than anywhere else
      for (let s = 0; s < 6; s++) {
        const i = r.tiles[ri(box, 0, r.area - 1)];
        if (inner[i] < 2) continue;
        const [x, y] = at(i), horiz = rnd(box) < 0.5, len = ri(box, 2, 4);
        for (let a = -1; a <= len; a++) for (let b = -1; b <= 1; b++) { const X = horiz ? x + a : x + b, Y = horiz ? y + b : y + a; if (lab[Y * W + X] === k && free(X, Y)) m.g[Y][X] = "r"; }
        for (let a = 0; a < len; a++) { const X = horiz ? x + a : x, Y = horiz ? y : y + a; if (lab[Y * W + X] === k && free(X, Y) && inner[Y * W + X] >= 2) m.o[Y][X] = a === 0 && rnd(box) < 0.5 ? "q" : "U"; }
      }
    }
  }

  for (const f of lateFires) FIRES[cfg.id].push(f);
  // the temple ruin (maps-v2): a big set piece in a quiet region partway in; it clears what stood on its ground
  // and the ring round it (trees pressing in are put back after), so it may open a new way between regions
  if (cfg.temple) {
    const rows = PIECES.temple, tw = rows[0].length, th = rows.length;
    const cand = R.map((r) => r.k).filter((k) => role[k] === "field" && D[k] >= far * 0.2 && D[k] <= far * 0.85)
      .sort((a, b) => R[b].inr - R[a].inr || a - b);
    // (dunesea asks for a place — cfg.temple.at: the regions nearest it are tried first)
    if (cfg.temple.at) { const tx = cfg.temple.at[0] * W, ty = cfg.temple.at[1] * H; cand.sort((a, b) => Math.hypot(R[a].px - tx, R[a].py - ty) - Math.hypot(R[b].px - tx, R[b].py - ty) || a - b); }
    // round each candidate's heart, nearest first, the first footprint clear of water, steps and kept ground
    const OFF = [];
    for (let dy = -12; dy <= 12; dy += 3) for (let dx = -12; dx <= 12; dx += 3) OFF.push([dx, dy]);
    OFF.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
    const clearAt = (x0, y0) => {
      for (let y = y0 - 2; y < y0 + th + 2; y++) for (let x = x0 - 2; x < x0 + tw + 2; x++) if (hold[y * W + x] || "wbv".includes(m.g[y][x]) || lab[y * W + x] < 0) return false;
      return true;
    };
    let spotT = null;
    for (const k of cand) {
      for (const [dx, dy] of OFF) {
        const x0 = clamp(Math.round(R[k].px - tw / 2) + dx, 5, W - tw - 5), y0 = clamp(Math.round(R[k].py - th / 2) + dy, 5, H - th - 5);
        if (clearAt(x0, y0)) { spotT = [x0, y0]; break; }
      }
      if (spotT) break;
    }
    if (spotT) {
      const [x0, y0] = spotT;
      for (let y = y0 - 1; y <= y0 + th; y++) for (let x = x0 - 1; x <= x0 + tw; x++) { m.o[y][x] = " "; if (y < y0 || y >= y0 + th || x < x0 || x >= x0 + tw) m.g[y][x] = "r"; }
      const tags = piece(m, "temple", x0, y0, 0, false);
      m.pieces.push("temple");
      keepBox(x0 - 1, y0 - 1, x0 + tw, y0 + th);
      const [cx, cy] = tags.chest[0], [bx, by] = tags.boss[0];
      spawns.push({ k: cfg.chest, n: 1, r: [cx, cy, cx, cy] });
      spawns.push({ k: cfg.temple.keeper || cfg.mobs[cfg.mobs.length - 1], n: 4, r: [x0, y0, x0 + tw - 1, y0 + th - 1], elite: 0.35 });
      special.push([cx, cy], [bx, by - 0]);
      doors.push([x0 + 7, y0 + th - 1]);
      if (!cfg.temple.buried) m.temple = { x: x0, y: y0, w: tw, h: th, pool: [x0 + 7, y0 + 10] };
      else {
        // half buried (dunesea): the pool is long dry and drifts of sand lie over the flagstones; the field boss rises here
        for (let y = y0 - 1; y <= y0 + th; y++) for (let x = x0 - 1; x <= x0 + tw; x++) {
          const g0 = m.g[y][x];
          if (g0 === "w" || ("=r".includes(g0) && N1[y * W + x] > 0.5 && !(x === cx && y === cy))) m.g[y][x] = cfg.temple.buried;
        }
        m.ruin = { x: x0, y: y0, w: tw, h: th };
        if (cfg.temple.arena) m.bossAt = [bx, by];
      }
    }
  }

  // small things that make a region its own: a pond, a ring of stones, a lone great tree, an old pen ...
  const ok = (k, x, y) => x > 2 && y > 2 && x < W - 3 && y < H - 3 && lab[y * W + x] === k && inner[y * W + x] >= 2 && free(x, y);
  const obj = (k, x, y, o) => { if (ok(k, x, y)) { m.o[y][x] = o; keep[y * W + x] = 1; } };
  const FEATURE = {
    pond(k, x, y) {
      const rad = 2.3 + rnd(box) * 1.1;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) {
        const X = x + dx, Y = y + dy;
        if (!ok(k, X, Y) || inner[Y * W + X] < 3) continue;
        const d = Math.hypot(dx * 0.8, dy) + (N2[Y * W + X] - 0.5) * 1.2;
        if (d < rad) { m.g[Y][X] = "w"; if (h2(X, Y, S0 + 4) < 0.2) m.o[Y][X] = "e"; }
        else if (d < rad + 1 && cfg.shore) m.g[Y][X] = cfg.shore;
      }
    },
    boulders(k, x, y) { const n = rnd(box) < 0.5 ? 3 : 5; for (let i = 0; i < n; i++) obj(k, x + ri(box, -2, 2), y + ri(box, -2, 2), "R"); },
    bigtree(k, x, y) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (ok(k, x + dx, y + dy) && Math.hypot(dx, dy) < 2.6) m.g[y + dy][x + dx] = '"';
      obj(k, x, y, cfg.treeCh2 === "T" ? "T" : "T"); obj(k, x - 2, y + 1, "B"); obj(k, x + 2, y - 1, "B");
    },
    pen(k, x, y) {
      const w = ri(box, 4, 6), h = ri(box, 3, 4), gx = ri(box, 1, w - 2);
      for (let i = 0; i <= w; i++) { obj(k, x + i - 2, y - 1, "F"); if (i !== gx && i !== gx + 1) obj(k, x + i - 2, y + h - 1, "F"); }
      for (let j = 0; j < h - 1; j++) { obj(k, x - 2, y + j, "F"); obj(k, x + w - 2, y + j, "F"); }
      obj(k, x, y + 1, "l");
    },
    cairn(k, x, y) { obj(k, x, y - 1, "O"); obj(k, x - 2, y + 1, "O"); obj(k, x + 2, y + 1, "O"); obj(k, x, y + 2, "R"); },
    logs(k, x, y) { obj(k, x, y, "l"); obj(k, x + 1, y + 1, "l"); obj(k, x - 1, y + 1, "u"); obj(k, x + 2, y - 1, "u"); },
    ring(k, x, y) { for (let a = 0; a < 8; a++) if (a !== 2 && a !== 6) obj(k, x + Math.round(Math.cos(a * 0.785) * 2.4), y + Math.round(Math.sin(a * 0.785) * 2), "Y"); },
    dead(k, x, y) { obj(k, x, y, "A"); obj(k, x + ri(box, 2, 3), y + ri(box, -2, 2), "A"); obj(k, x - ri(box, 2, 3), y + ri(box, -1, 2), "A"); },
    stones(k, x, y) { for (let i = -2; i <= 2; i++) obj(k, x + i, y + ((i * 7) % 3 === 0 ? 0 : 1), i % 2 ? "U" : "q"); },
    // the old kingdom: a drift of leaves round a fallen trunk, a king's statue on its flagstones,
    // rotted banners either side of an old way, a few graves, and a hollow where the blight fruits
    leafpile(k, x, y) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (ok(k, x + dx, y + dy) && Math.hypot(dx * 0.75, dy) + (N2[(y + dy) * W + x + dx] - 0.5) < 2.4) m.g[y + dy][x + dx] = "%";
      obj(k, x, y, "l"); obj(k, x + 2, y - 1, "u");
    },
    statue(k, x, y) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ok(k, x + dx, y + dy)) m.g[y + dy][x + dx] = "=";
      obj(k, x, y, "z"); obj(k, x - 2, y + 1, "q");
    },
    banners(k, x, y) { obj(k, x - 2, y, "V"); obj(k, x + 2, y, "V"); for (let dy = 0; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ok(k, x + dx, y + dy)) m.g[y + dy][x + dx] = "="; },
    graves(k, x, y) { for (const [dx, dy] of [[-2, 0], [0, -1], [2, 0], [-1, 2], [1, 2]]) if (rnd(box) < 0.8) obj(k, x + dx, y + dy, "J"); },
    shrooms(k, x, y) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (ok(k, x + dx, y + dy) && Math.hypot(dx * 0.8, dy) < 2.6 && N1[(y + dy) * W + x + dx] > 0.3) m.g[y + dy][x + dx] = "&";
      for (let a = 0; a < 6; a++) if (a !== 1 && a !== 4) obj(k, x + Math.round(Math.cos(a * 1.047) * 2.6), y + Math.round(Math.sin(a * 1.047) * 2), "Y");
    },
  };
  for (const r of R) {
    if (role[r.k] !== "field" || r.inr < 3 || rnd(box) > cfg.featureP) continue;
    for (let tries = 0; tries < 8; tries++) {
      const i = r.tiles[ri(box, 0, r.area - 1)], [x, y] = at(i);
      if (inner[i] < 3 || !free(x, y) || Math.hypot(x - r.px, y - r.py) < 2) continue;
      const kind = cfg.features[ri(box, 0, cfg.features.length - 1)];
      FEATURE[kind](r.k, x, y);
      m.pieces.push(kind);
      break;
    }
  }

  // an oasis (maps-v2 M3): the ground within a few steps of water is green, and palms stand round it
  if (cfg.green) {
    const dist = new Int8Array(W * H).fill(-1), q = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (m.g[y][x] === "w" && !(sd && sd[y * W + x] > 0)) { dist[y * W + x] = 0; q.push(y * W + x); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i - x) / W;
      if (dist[i] >= cfg.green.r) continue;
      for (const [dx, dy] of D4) { const X = x + dx, Y = y + dy, j = Y * W + X; if (X < 2 || Y < 2 || X >= W - 2 || Y >= H - 2 || dist[j] >= 0) continue; dist[j] = dist[i] + 1; q.push(j); }
    }
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x, d = dist[i];
      if (d < 1 || "wbv=r".includes(m.g[y][x]) || m.g[y][x] === cfg.road) continue;
      if (d < cfg.green.r || N2[i] > 0.5) m.g[y][x] = d === 1 ? "t" : N2[i] > 0.62 ? '"' : d === 2 ? "." : ",";
      if (d >= 2 && free(x, y) && h2(x, y, S0 + 24) < cfg.green.palm) m.o[y][x] = h2(x, y, S0 + 25) < 0.8 ? "Ψ" : "B";
    }
  }

  // roads: from the way in to every way on, the cheapest way over dry, flat ground; bridges where they cross water
  const roadCost = (j, i, back) => {
    const [x, y] = at(j);
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || m.o[y][x] !== " ") return Infinity;
    const g0 = m.g[y][x];
    let c = g0 === "w" ? 14 : g0 === "b" || g0 === cfg.road ? 0.55 : g0 === "v" ? 1 : 1 + N1[j] * 2.2 + (g0 === "t" ? 0.6 : 0);
    if (back >= 0 && j - i !== i - back) c += 0.4;
    return c;
  };
  const pave = (path, wide, ch = cfg.road) => {
    for (let s = 0; s < path.length; s++) {
      const t = path[s], [x, y] = at(t), nx = path[s + 1] ?? path[s - 1], horiz = Math.abs(nx - t) === 1;
      // (a shoulder keeps its grass: the worn path stays a thin line through a way three tiles wide)
      const lay1 = (X, Y, shoulder, edge) => {
        if (X < 2 || Y < 2 || X >= W - 2 || Y >= H - 2) return;
        if (m.g[Y][X] === "w") { m.g[Y][X] = "b"; m.o[Y][X] = " "; }
        else if (m.o[Y][X] === " " || m.o[Y][X] === "e" || (shoulder && !"CHUZ".includes(m.o[Y][X]))) {
          // (a way over the shallows is a sand bar, shoulders and all; a painted road keeps its edge lines)
          const bar = sea && sea.bar && "~-".includes(m.g[Y][X]);
          if (bar) m.g[Y][X] = sea.bar;
          else if (!shoulder && !"bv".includes(m.g[Y][X]) && m.g[Y][X] !== cfg.road) m.g[Y][X] = ch;
          else if (edge && !"bv".includes(m.g[Y][X]) && m.g[Y][X] !== cfg.road) m.g[Y][X] = edge;
          m.o[Y][X] = " ";
        }
        keep[Y * W + X] = 1;
      };
      lay1(x, y);
      if (wide && cfg.roadEdge) {
        // a made road five wide: three of asphalt and a painted line down either edge
        for (const d of [1, -1]) { if (horiz) lay1(x, y + d); else lay1(x + d, y); }
        for (const d of [2, -2]) { if (horiz) lay1(x, y + d, true, cfg.roadEdge); else lay1(x + d, y, true, cfg.roadEdge); }
      } else if (wide && cfg.roadW === 3) { if (horiz) { lay1(x, y + 1, true); lay1(x, y - 1, true); } else { lay1(x + 1, y, true); lay1(x - 1, y, true); } }
      else if (wide) {
        if (horiz) lay1(x, y + 1); else lay1(x + 1, y);
        if (N2[t] > 0.72) { if (horiz) lay1(x, y - 1); else lay1(x - 1, y); }
      }
    }
  };
  const roadMask = new Uint8Array(W * H);
  const leg = (from, to) => {
    const [tx, ty] = to;
    const path = walk(W, H, from[1] * W + from[0], (i) => i === ty * W + tx, roadCost, tx, ty, 0.8);
    if (path) { pave(path, true); for (const i of path) roadMask[i] = 1; }
  };
  // the road follows the critical path: from the way in, through the heart of every region on it and the gap into the next, to each way on
  for (const [name] of cfg.gates.slice(1)) {
    const regs = name === cfg.exit ? main : tree.path(gateIdx[name]), stops = [gates[cfg.gates[0][0]].a[0]];
    for (let s = 1; s < regs.length; s++) {
      const g = gapAt.get(ekey(regs[s - 1], regs[s]));
      if (g) stops.push(spot(m, g[0], g[1]));
      if (s < regs.length - 1) stops.push(spot(m, R[regs[s]].px, R[regs[s]].py));
    }
    stops.push(gates[name].a[0]);
    for (let s = 1; s < stops.length; s++) leg(stops[s - 1], stops[s]);
  }
  // trails: a single file of worn earth from a camp or a stair to the road
  for (const [x, y] of doors) {
    const path = walk(W, H, y * W + x, (i) => roadMask[i] === 1, roadCost);
    if (path) pave(path.slice(1).filter((i) => !roadMask[i]), false, cfg.trail || cfg.road);
  }

  // sand bars (dunesea): three wide, from each islet's chest to the nearest road or dry beach
  for (const [x, y] of bars) {
    const path = walk(W, H, y * W + x, (i) => roadMask[i] === 1 || sd[i] < -1, roadCost);
    if (path) pave(path.slice(1).filter((i) => !roadMask[i]), true, sea.bar);
  }

  // what grows everywhere else
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, k = lab[i];
    if (k < 0 || !free(x, y)) continue;
    if (Math.hypot(x - R[k].px, y - R[k].py) < Math.max(2.5, R[k].inr * 0.7)) continue;          // every region keeps a clearing
    const o = cfg.scatter(biome[k], h2(x, y, S0 + 11), N1[i], N2[i], m.g[y][x]);
    if (o) m.o[y][x] = o;
  }

  // who lives where: deeper regions breed stronger kinds, more of them, and more elites.
  // Depth is taken as a rank, so the roster's weights hold however the regions happen to spread
  const depthRank = new Map();
  R.map((r) => r.k).filter((k) => D[k] >= 0).sort((a, b) => D[a] - D[b] || a - b).forEach((k, j, all) => depthRank.set(k, all.length > 1 ? j / (all.length - 1) : 0));
  for (const r of R) {
    const k = r.k;
    if (D[k] < 0 || role[k] === "camp") continue;
    const t = depthRank.get(k), rect = coreRect(m, r, inner, 2);
    let walkable = 0;
    for (const i of r.tiles) { const [x, y] = at(i); if (!blockedAt(m, x, y)) walkable++; }
    if (role[k] === "gate") { spawns.push({ k: k === 0 ? cfg.mobs[0] : cfg.mobs[cfg.mobs.length - 1], n: 2, r: rect, elite: k === 0 ? 0 : 0.1 }); continue; }
    let nn = clamp(Math.round(walkable / cfg.tpm), 1, 9);
    if (role[k] === "ruin") nn += 2;
    if (role[k] === "lake") { if (cfg.pondMob) spawns.push({ k: cfg.pondMob, n: 3, r: [r.x0, r.y0, r.x1, r.y1], elite: eliteAt(t) }); nn = Math.max(1, nn - 3); }
    const a = Math.ceil(nn * 0.65), b = nn - a;
    spawns.push({ k: bandMob(box, cfg.mobs, t, D[k]), n: a, r: rect, elite: eliteAt(t) });
    if (b > 0) spawns.push({ k: bandMob(box, cfg.mobs, t, D[k]), n: b, r: rect, elite: eliteAt(t) });
  }
  m.spawns.push(...spawns);

  if (cfg.stair && !gates[cfg.stair]) throw new Error(cfg.id + ": no room for the way down");
  if (!FIRES[cfg.id].length) throw new Error(cfg.id + ": no room for a camp");
  // a door cut into a finished ground (cfg.doors [[name, side, f]]: the oasis's and the coast's doors to dunesea): nothing
  // is laid out round it — the rim behind it is cleared four wide, and the widening below joins it to the ways
  for (const [name, side, f] of cfg.doors || []) {
    const g = side === "w" ? Math.round(f * H) : Math.round(f * W);
    gates[name] = side === "w" ? { t: [[1, g], [1, g + 1]], a: [[4, g], [4, g + 1]] } : { t: [[g, H - 2], [g + 1, H - 2]], a: [[g, H - 5], [g + 1, H - 5]] };
    const [x0, y0, x1, y1] = side === "w" ? [1, g - 1, 7, g + 2] : [g - 1, H - 8, g + 2, H - 2];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { m.o[y][x] = " "; if (m.g[y][x] === "w") m.g[y][x] = "b"; }
  }
  if (cfg.stonesAt) m.stonesAt = (m.stonesAt || []).concat(cfg.stonesAt.map(([fx, fy]) => [Math.round(fx * W), Math.round(fy * H)]));
  // the gates themselves
  for (const name of Object.keys(gates)) for (const [x, y] of gates[name].t.concat(gates[name].a)) { m.o[y][x] = " "; if (m.g[y][x] === "w") m.g[y][x] = "b"; }
  m.gates = gates;
  m.entry = gates[cfg.gates[0][0]].a[0];
  const pts = [];
  for (const r of R) if (D[r.k] >= 0) pts.push(spot(m, r.px, r.py));
  for (const p of special) pts.push(p);
  for (const name of Object.keys(gates)) for (const a of gates[name].a) pts.push(a);
  cover(m, cfg.mobs);
  knit(m, pts, cfg.trail || cfg.road);
  // maps-v2: every way that matters three tiles wide, and no crumbs of ground left that cannot be walked to
  if (cfg.widen) {
    widen(m, pts, cfg.widen);
    seal(m, cfg.treeCh2);
    // what the signs and stones put down later must leave joined (markRoutes): the doors and the places that matter
    m.keepWide = special.concat(...Object.values(gates).map((g) => g.a));
    m.widenSoft = cfg.widen;
  }
  // (where along the way on the second and third waypoint stones stand, if not a third and two thirds: markRoutes)
  if (cfg.stoneFr) m.stoneFr = cfg.stoneFr;
  m.regions = n;
  return m;
}

/**
 * The city: a street grid cut by recursive subdivision — avenues three lanes wide at
 * the first cuts, streets two wide below them, single-file alleys at the bottom —
 * inside a ring road. The street segments between junctions form a graph; a spanning
 * tree of it (plus a few loops) stays open and every other segment is barricaded with
 * wrecks, concrete and bins, so the streets have a critical path and dead ends. Blocks
 * are towers fronting their streets, or a park, a plaza, a car park or a fenced back
 * lot opening onto a single street.
 */
function metro(cfg) {
  const box = { seed: cfg.seed }, S0 = cfg.seed;
  const W = cfg.w, H = cfg.h;
  const m = blank(cfg.id, cfg.name, W, H, "k");
  m.bgm = cfg.bgm; m.theme = "city"; m.pieces = [];
  border(m, "Z", 2);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (x === 2 || y === 2 || x === W - 3 || y === H - 3) m.o[y][x] = "Z";
  const N1 = field(m, S0 + 5, 4, 2);
  // the ring road and the cuts inside it; each street is [x0, y0, x1, y1, width] in tiles
  const X0 = 4, Y0 = 4, X1 = W - 5, Y1 = H - 5;
  const streets = [[X0, Y0, X1, Y0 + 1, 2], [X0, Y1 - 1, X1, Y1, 2], [X0, Y0, X0 + 1, Y1, 2], [X1 - 1, Y0, X1, Y1, 2]];
  const blocks = [];
  const cut = (x0, y0, x1, y1, depth) => {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const sw = depth < 1 ? 3 : depth < 3 ? 2 : 1, min = sw >= 2 ? 7 : 6;
    const canV = w >= min * 2 + sw, canH = h >= min * 2 + sw - 1;
    if ((!canV && !canH) || (depth >= 2 && w * h < 150 && rnd(box) < 0.55)) { blocks.push({ x0, y0, x1, y1 }); return; }
    const vert = canV && (!canH || w / h > 1.25 || (w / h > 0.8 && rnd(box) < 0.5));
    if (vert) {
      const at2 = x0 + min + ri(box, 0, w - min * 2 - sw);
      streets.push([at2, y0 - 1, at2 + sw - 1, y1 + 1, sw]);
      cut(x0, y0, at2 - 1, y1, depth + 1); cut(at2 + sw, y0, x1, y1, depth + 1);
    } else {
      const at2 = y0 + min + ri(box, 0, h - min * 2 - sw + 1);
      streets.push([x0 - 1, at2, x1 + 1, at2 + sw - 1, sw]);
      cut(x0, y0, x1, at2 - 1, depth + 1); cut(x0, at2 + sw, x1, y1, depth + 1);
    }
  };
  cut(X0 + 2, Y0 + 2, X1 - 2, Y1 - 2, 0);
  const isStreet = new Uint8Array(W * H);
  for (const [x0, y0, x1, y1] of streets) for (let y = Math.max(y0, Y0); y <= Math.min(y1, Y1); y++) for (let x = Math.max(x0, X0); x <= Math.min(x1, X1); x++) { m.g[y][x] = "a"; isStreet[y * W + x] = 1; }
  // the gate: a slip road off the ring to the east edge
  const gy = Math.round(H * cfg.gateY);
  for (let x = X1; x < W - 1; x++) for (const y of [gy, gy + 1]) { m.g[y][x] = "a"; m.o[y][x] = " "; isStreet[y * W + x] = 1; }
  for (let x = X1 + 1; x < W - 1; x++) { m.o[gy - 1][x] = "Z"; m.o[gy + 2][x] = "Z"; }
  const gates = { [cfg.gate]: { t: [[W - 2, gy], [W - 2, gy + 1]], a: [[W - 5, gy], [W - 5, gy + 1]] } };

  // the street graph: junctions are street tiles with streets running off three or four ways
  const S = (x, y) => x >= 0 && y >= 0 && x < W && y < H && isStreet[y * W + x];
  // a junction is where crossing streets meet: label the street network into straight runs
  // between crossings by flooding from each crossing outward
  const cross = new Uint8Array(W * H);
  for (const v of streets) for (const hz of streets) {
    // where a street running north–south meets one running east–west, the whole width of both is the crossing
    if (!(v[3] - v[1] > v[2] - v[0]) || hz[3] - hz[1] > hz[2] - hz[0]) continue;
    if (Math.max(v[0], hz[0]) > Math.min(v[2], hz[2]) || Math.max(v[1], hz[1]) > Math.min(v[3], hz[3])) continue;
    for (let y = Math.max(hz[1], Y0); y <= Math.min(hz[3], Y1); y++) for (let x = Math.max(v[0], X0); x <= Math.min(v[2], X1); x++) cross[y * W + x] = 1;
  }
  // crossings: connected clumps of crossing tiles are the graph's nodes
  const node = new Int32Array(W * H).fill(-1), nodes = [];
  for (let i = 0; i < W * H; i++) {
    if (!cross[i] || node[i] >= 0) continue;
    const list = [i]; node[i] = nodes.length;
    for (let h = 0; h < list.length; h++) { const c = list[h], x = c % W, y = (c - x) / W; for (const [dx, dy] of D4) { const j = (y + dy) * W + x + dx; if (cross[j] && node[j] < 0) { node[j] = nodes.length; list.push(j); } } }
    let sx = 0, sy = 0;
    for (const c of list) { sx += c % W; sy += Math.floor(c / W); }
    nodes.push({ tiles: list, x: sx / list.length, y: sy / list.length });
  }
  // segments: street tiles between crossings, each touching two of them
  const seg = new Int32Array(W * H).fill(-1), segs = [];
  for (let i = 0; i < W * H; i++) {
    if (!isStreet[i] || cross[i] || seg[i] >= 0) continue;
    const list = [i], ends = new Set();
    seg[i] = segs.length;
    for (let h = 0; h < list.length; h++) {
      const c = list[h], x = c % W, y = (c - x) / W;
      for (const [dx, dy] of D4) {
        const j = (y + dy) * W + x + dx;
        if (!S(x + dx, y + dy)) continue;
        if (cross[j]) { ends.add(node[j]); continue; }
        if (seg[j] < 0) { seg[j] = segs.length; list.push(j); }
      }
    }
    const e = [...ends];
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const c of list) { const x = c % W, y = (c - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    segs.push({ tiles: list, a: e[0], b: e.length > 1 ? e[1] : e[0], x0, y0, x1, y1, vert: y1 - y0 > x1 - x0 });
  }
  // the gate's slip road joins the ring at a crossing of its own: find the node nearest it
  let entry = 0, ed = Infinity;
  nodes.forEach((n2, k) => { const d = Math.hypot(n2.x - (X1 - 1), n2.y - gy); if (d < ed) { ed = d; entry = k; } });
  const segEdges = segs.filter((s2) => s2.a !== undefined && s2.b !== undefined && s2.a !== s2.b).map((s2) => [s2.a, s2.b]);
  const tree = grow(box, nodes.length, segEdges, entry, cfg.wind, cfg.loops);
  const far = tree.far;
  // barricade every segment the tree did not keep (one per pair of crossings: a parallel twin stays open)
  const kept = new Set();
  for (const s2 of segs) {
    if (s2.a === undefined || s2.b === undefined || s2.a === s2.b) continue;
    const key = ekey(s2.a, s2.b);
    if (tree.link.has(key) && !kept.has(key)) { kept.add(key); s2.open = true; continue; }
    if (s2.tiles.some((c) => Math.abs((c % W) - (W - 5)) < 3 && Math.abs(Math.floor(c / W) - gy) < 3)) { s2.open = true; continue; }
    s2.open = false;
    // across the middle of the segment, kerb to kerb
    const mx = Math.round((s2.x0 + s2.x1) / 2), my = Math.round((s2.y0 + s2.y1) / 2);
    const across = s2.vert ? [[s2.x0 - 1, my], [s2.x1 + 1, my]] : [[mx, s2.y0 - 1], [mx, s2.y1 + 1]];
    const [[ax, ay], [bx, by]] = across;
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) continue;
      const r2 = h2(x, y, S0 + 3);
      m.o[y][x] = r2 < 0.45 ? "Z" : r2 < 0.65 ? "x" : r2 < 0.85 ? "D" : "n";
    }
    s2.wall = [ax, ay, bx, by];
  }
  // a barricade that seals off streets the tree meant to keep (a junction the graph read wrongly) is cleared away whole
  const walkable = (i) => !blockedAt(m, i % W, Math.floor(i / W));
  for (let pass = 0; pass < segs.length; pass++) {
    const reach = bfs(W, H, gy * W + (W - 5), walkable);
    const lost = nodes.some((n2) => n2.tiles.some((c) => reach[c] < 0));
    if (!lost) break;
    const s2 = segs.find((q) => q.wall && q.tiles.some((c) => reach[c] >= 0) && q.tiles.some((c) => reach[c] < 0 && !blockedAt(m, c % W, Math.floor(c / W))));
    if (!s2) break;
    const [ax, ay, bx, by] = s2.wall;
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (x >= 3 && y >= 3 && x < W - 3 && y < H - 3) m.o[y][x] = " ";
    s2.wall = null; s2.open = true;
  }
  // depth along the open streets, for every segment
  const segDepth = (s2) => Math.min(tree.dist[s2.a] < 0 ? 99 : tree.dist[s2.a], tree.dist[s2.b] < 0 ? 99 : tree.dist[s2.b]);

  // sidewalks: the first tile of every block along a street; lamps and hydrants stand on them
  const kerb = (x, y) => D4.some(([dx, dy]) => S(x + dx, y + dy));
  // blocks: what each one is
  const spawns = [], special = [];
  const kinds = blocks.map((b) => {
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
    return w >= 8 && h >= 7 && rnd(box) < 0.42 ? "open" : "towers";
  });
  // open blocks face one street: which segment touches them, and how deep is it
  const faces = (b) => {
    const out = [];
    for (const s2 of segs) {
      if (!s2.open) continue;
      const touch = s2.vert ? (s2.x1 === b.x0 - 1 || s2.x0 === b.x1 + 1) && s2.y1 >= b.y0 && s2.y0 <= b.y1 : (s2.y1 === b.y0 - 1 || s2.y0 === b.y1 + 1) && s2.x1 >= b.x0 && s2.x0 <= b.x1;
      if (touch) out.push(s2);
    }
    return out;
  };
  const opens = [];
  blocks.forEach((b, k) => {
    // a ring of pavement round every block
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) m.g[y][x] = "k";
    const f = faces(b);
    if (kinds[k] === "open" && f.length) { const s2 = f[ri(box, 0, f.length - 1)]; opens.push({ b, s: s2, d: segDepth(s2) }); return; }
    // towers: rows of buildings four wide and three deep packed into the block, concrete where none fits
    for (let y = b.y0 + 1; y <= b.y1 - 1; y++) for (let x = b.x0 + 1; x <= b.x1 - 1; x++) m.o[y][x] = "Z";
    for (let y = b.y0 + 1; y + 2 <= b.y1 - 1; y += 3) for (let x = b.x0 + 1 + (((b.x1 - b.x0 - 1) % 4) >> 1); x + 3 <= b.x1 - 1; x += 4) {
      if (rnd(box) < 0.12) continue;
      for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 4; xx++) m.o[yy][xx] = " ";
      house(m, x, y, 4 + ri(box, 0, 3));
    }
  });
  // the open blocks, deepest first: the sewer's mouth, back lots with chests, a camp, parks and squares
  opens.sort((p, q) => q.d - p.d);
  const want = ["stair", "vault", "vault", "camp", "park", "plaza", "vault", "lot", "park", "plaza", "lot", "park"];
  const campAt = opens.findIndex((o) => o.d >= far * 0.3 && o.d <= far * 0.75);
  if (campAt > 0) { const [c] = opens.splice(campAt, 1); opens.splice(3, 0, c); }
  opens.forEach((o, k) => {
    const b = o.b, kind = want[k] || (k % 2 ? "park" : "lot");
    o.kind = kind;
    m.pieces.push(kind);
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, cx = Math.round((b.x0 + b.x1) / 2), cy = Math.round((b.y0 + b.y1) / 2);
    // a fence (or a hedge round a park) on every side but the one onto its street, which keeps a gate three wide
    const fenceCh = kind === "park" ? "H" : kind === "plaza" ? "L" : "F";
    const s2 = o.s;
    const onSide = (x, y) => (s2.vert ? (s2.x1 === b.x0 - 1 ? x === b.x0 : x === b.x1) : s2.y1 === b.y0 - 1 ? y === b.y0 : y === b.y1);
    const gx = s2.vert ? null : clamp(Math.round((Math.max(s2.x0, b.x0) + Math.min(s2.x1, b.x1)) / 2), b.x0 + 2, b.x1 - 2);
    const gyy = s2.vert ? clamp(Math.round((Math.max(s2.y0, b.y0) + Math.min(s2.y1, b.y1)) / 2), b.y0 + 2, b.y1 - 2) : null;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const edge = x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1;
      if (!edge) continue;
      if (onSide(x, y)) { if ((gx !== null && Math.abs(x - gx) <= 1) || (gyy !== null && Math.abs(y - gyy) <= 1)) continue; if (fenceCh === "L") { if ((x + y) % 4 === 0) m.o[y][x] = "L"; continue; } }
      m.o[y][x] = fenceCh === "L" ? "Z" : fenceCh;
    }
    const inner = [b.x0 + 1, b.y0 + 1, b.x1 - 1, b.y1 - 1], t = Math.min(1, o.d / far);
    const fill = (ch) => { for (let y = b.y0 + 1; y < b.y1; y++) for (let x = b.x0 + 1; x < b.x1; x++) m.g[y][x] = ch; };
    if (kind === "park") {
      fill(".");
      for (let y = b.y0 + 1; y < b.y1; y++) for (let x = b.x0 + 1; x < b.x1; x++) { const n = N1[y * W + x]; if (n > 0.62) m.g[y][x] = '"'; else if (n < 0.25) m.g[y][x] = ","; }
      const pr = Math.min(w, h) >= 9 ? 2.2 : 1.4;
      for (let y = b.y0 + 2; y < b.y1 - 1; y++) for (let x = b.x0 + 2; x < b.x1 - 1; x++) if (Math.hypot((x - cx) * 0.8, y - cy) < pr) { m.g[y][x] = "w"; m.o[y][x] = " "; }
      for (const [x, y] of [[b.x0 + 1, b.y0 + 1], [b.x1 - 1, b.y0 + 1], [b.x0 + 1, b.y1 - 1], [b.x1 - 1, b.y1 - 1]]) if (!onSide(x, y)) m.o[y][x] = "T";
      spawns.push({ k: bandMob(box, cfg.mobs, t, o.d), n: 2 + Math.round(w * h / 60), r: inner, elite: eliteAt(t) });
    } else if (kind === "plaza") {
      fill("o");
      for (const [x, y] of [[b.x0 + 2, b.y0 + 2], [b.x1 - 2, b.y0 + 2], [b.x0 + 2, b.y1 - 2], [b.x1 - 2, b.y1 - 2]]) m.o[y][x] = "L";
      if (w >= 11) m.o[cy][cx] = "q";
      spawns.push({ k: bandMob(box, cfg.mobs, t, o.d), n: 3 + Math.round(w * h / 50), r: inner, elite: eliteAt(t) });
    } else if (kind === "lot") {
      // a car park: two rows of cars, nose to tail
      fill("a");
      for (let x = b.x0 + 2; x + 1 < b.x1 - 1; x += 3) for (const y of [b.y0 + 2, b.y1 - 2]) if (rnd(box) < 0.7 && !onSide(x, y)) { m.o[y][x] = "c"; m.o[y][x + 1] = "h"; }
      spawns.push({ k: bandMob(box, cfg.mobs, t, o.d), n: 2 + Math.round(w * h / 60), r: inner, elite: eliteAt(t) });
    } else if (kind === "camp") {
      fill("o");
      m.o[cy - 1][cx - 2] = "E"; m.o[cy + 1][cx + 2] = "n";
      FIRES[cfg.id].push([cx, cy]); special.push([cx, cy + 1]);
    } else if (kind === "vault") {
      // a back lot behind bins and crates, a chest at the back
      for (let k2 = 0; k2 < 5; k2++) { const x = ri(box, b.x0 + 1, b.x1 - 1), y = ri(box, b.y0 + 1, b.y1 - 1); if (Math.abs(x - cx) + Math.abs(y - cy) > 1) m.o[y][x] = ["D", "n", "x", "y", "n"][k2]; }
      m.o[cy][cx] = " ";
      spawns.push({ k: cfg.chest, n: 1, r: [cx, cy, cx, cy] });
      spawns.push({ k: bandMob(box, cfg.mobs, Math.min(1, t + 0.15), o.d), n: 3, r: inner, elite: 0.3 });
      special.push([cx, cy]);
    } else if (kind === "stair") {
      // a fenced yard round an open shaft: the way down into the sewer
      fill("o");
      for (const [x, y] of [[cx - 2, cy - 1], [cx + 3, cy - 1], [cx - 2, cy + 1], [cx + 3, cy + 1]]) if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) m.o[y][x] = "D";
      m.g[cy - 1][cx] = "g"; m.g[cy - 1][cx + 1] = "g";
      gates[cfg.stair] = { t: [[cx, cy - 1], [cx + 1, cy - 1]], a: [[cx, cy + 1], [cx + 1, cy + 1]] };
      for (const [x, y] of gates[cfg.stair].t.concat(gates[cfg.stair].a)) m.o[y][x] = " ";
      spawns.push({ k: cfg.mobs[cfg.mobs.length - 1], n: 3, r: inner, elite: 0.3 });
      special.push([cx, cy + 1]);
    }
  });
  // street life: lamps along the kerbs, hydrants and bins, cars parked along the avenues
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (m.o[y][x] !== " " || m.g[y][x] !== "k" || !kerb(x, y)) continue;
    const r2 = h2(x, y, S0 + 8);
    if ((x * 3 + y * 5) % 11 === 0 && r2 < 0.5) m.o[y][x] = "L";
    else if (r2 < 0.012) m.o[y][x] = "y";
    else if (r2 < 0.024) m.o[y][x] = "x";
  }
  for (const s2 of segs) {
    if (!s2.open) continue;
    const wide = (s2.vert ? s2.x1 - s2.x0 : s2.y1 - s2.y0) + 1;
    // the dashes down the middle of an avenue
    if (wide === 3) for (const c of s2.tiles) { const x = c % W, y = (c - x) / W; if ((s2.vert ? x === s2.x0 + 1 && y % 3 === 0 : y === s2.y0 + 1 && x % 3 === 0)) m.g[y][x] = "m"; }
    if (wide < 3 || s2.vert) continue;
    for (let x = s2.x0 + 2; x + 1 < s2.x1 - 1; x += 3) if (rnd(box) < 0.14) { const y = rnd(box) < 0.5 ? s2.y0 : s2.y1; if (m.o[y][x] === " " && m.o[y][x + 1] === " ") { m.o[y][x] = "c"; m.o[y][x + 1] = "h"; } }
  }
  // who walks the streets: deeper segments, stronger kinds and more of them
  for (const s2 of segs) {
    if (!s2.open) continue;
    const d = segDepth(s2);
    if (d >= 99) continue;
    const t = Math.min(1, d / far), area = s2.tiles.length;
    if (area < 6) continue;
    const r = [Math.max(3, s2.x0 - 1), Math.max(3, s2.y0 - 1), Math.min(W - 4, s2.x1 + 1), Math.min(H - 4, s2.y1 + 1)];
    spawns.push({ k: d <= 1 ? cfg.mobs[0] : bandMob(box, cfg.mobs, t, d), n: clamp(Math.round(area / cfg.tpm), 1, 6), r, elite: eliteAt(t) });
  }
  m.spawns.push(...spawns);
  // maps-v2 M3: a second way out, a slip road off the ring through the south wall (to the jungle road)
  if (cfg.south) {
    const gx = Math.round(W * cfg.south);
    for (let y = Y1 - 1; y < H - 1; y++) for (const x of [gx - 1, gx, gx + 1, gx + 2]) { if (x === gx || x === gx + 1 || y <= Y1) { m.g[y][x] = "a"; m.o[y][x] = " "; } else m.o[y][x] = "Z"; }
    gates.south = { t: [[gx, H - 2], [gx + 1, H - 2]], a: [[gx, H - 5], [gx + 1, H - 5]] };
  }
  for (const name of Object.keys(gates)) for (const [x, y] of gates[name].t.concat(gates[name].a)) m.o[y][x] = " ";
  m.gates = gates;
  m.entry = gates[cfg.gate].a[0];
  const pts = [];
  for (const n2 of nodes) pts.push(spot(m, Math.round(n2.x), Math.round(n2.y)));
  for (const p of special) pts.push(p);
  for (const name of Object.keys(gates)) for (const a of gates[name].a) pts.push(a);
  cover(m, cfg.mobs);
  knit(m, pts, "k");
  m.regions = segs.length;
  return m;
}

