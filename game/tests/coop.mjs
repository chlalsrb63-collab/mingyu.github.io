// Headless test of 협동 아르바이트 v1 (docs/design/life-and-coop.md C, "As built — co-op v1"): 동동아파트 청소 entered
// alone and by parties of 2–4, the template, sweeping / bins / chutes, the two-person sofa, the spread and the
// complaints, failing on the clock, a bot clearing it, rewards once a day (helpers tip only), leaving, a disconnect
// mid-shift, cleanup, determinism, the wire and an old sheet's migration; 쥬쥬식당 서빙 and 캉캉대장간 단조 (beat judging, the
// latency calibration, a piece delivered, walking bots 1–4). node tests/coop.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { COOP, COOP_T, COOP_APT, coopCut, coopGrade, dayOf, mapOf, tilePx, NPC_MAP, lifeNeed, stats, COOP_DINER, COOP_FORGE, coopPay };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16, J = X.COOP.apt, A = X.COOP_APT;
const VERBOSE = process.argv.includes("-v");
const log = (...a) => { if (VERBOSE) console.log(...a); };
const DAY = 86400000;

/** A world with `n` players standing by 관리인 동동 (one party when n ≥ 2). */
function world(n, t0 = 1000, seed = 20251111) {
  const S = L.setup();
  S.seed = seed;
  const w = { S, now: t0, pids: [] };
  S.now = t0;
  const lob = X.mapOf(J.lobby), dd = lob.npcs.find((o) => o.id === "dongdong");
  for (let i = 0; i < n; i++) {
    const pid = "c" + i;
    L.addPlayer(S, pid, L.newChar("알바" + i, []));
    const p = S.players[pid];
    L.runtime(S, p.map).n--; p.map = J.lobby; L.runtime(S, J.lobby).n++;
    p.x = dd.x * T + 8 + i * 4; p.y = dd.y * T + 12 + 16;
    w.pids.push(pid);
  }
  for (let i = 1; i < n; i++) {
    assert.ok(act(w, "c0", { t: "pinv", e: S.players["c" + i].eid }).ok, "invite");
    assert.ok(act(w, "c" + i, { t: "pacc" }).ok, "joins the party");
  }
  return w;
}
function act(w, pid, a) { w.S.now = w.now; const v = L.validateAction(w.S, pid, a); if (v.ok) L.applyAction(w.S, pid, a); return v; }
const views = {};
function step(w, ms = 100) {
  for (let t = 0; t < ms; t += 100) {
    w.now += 100; L.tick(w.S, w.now);
    for (const pid of Object.keys(w.S.players)) { const v = JSON.parse(JSON.stringify(L.viewFor(w.S, pid))); (views[pid] || (views[pid] = [])).push(v); if (views[pid].length > 40) views[pid].shift(); }
    L.endTick(w.S);
  }
}
const lastOf = (pid, key) => { for (let i = views[pid].length - 1; i >= 0; i--) if (key in views[pid][i]) return views[pid][i][key]; return undefined; };
const shiftOf = (w) => { const id = Object.keys(w.S.dims).find((k) => w.S.dims[k].coop); return id ? w.S.dims[id] : null; };
const at = (p, x, y) => { p.x = x; p.y = y; };
const atTile = (p, [tx, ty]) => at(p, ...X.tilePx([tx, ty]));
// where a worker stands to use each station (the tile beside it, in the corridor)
const RACK = [J.st.rack[0] - 1, J.st.rack[1]], BURN = [J.st.burn[0] + 1, J.st.burn[1]], RECY = [J.st.recycle[0] - 1, J.st.recycle[1]];

// ── the template: stations, start tiles and every flat reachable
{
  const w = world(1), p = w.S.players.c0;
  assert.ok(act(w, "c0", { t: "coop_start", k: "apt" }).ok);
  const dim = shiftOf(w), m = dim.map;
  assert.equal(p.map, dim.id);
  assert.deepEqual([m.w, m.h, m.theme, m.safe], [45, 19, "interior", true]);
  for (const r of [...J.tpl.ground, ...J.tpl.objects]) assert.equal(r.length, 45);
  const open = m.reach.reduce((n, v) => n + v, 0);
  log("apt open tiles", open);
  assert.ok(open >= 2 * 240, `about 2.5× the old 24×15 flat block (240 open tiles): ${open}`);
  assert.equal(J.rooms.length, 8, "eight flats");
  for (const [x, y] of J.start) assert.ok(m.reach[y * m.w + x], `start ${x},${y} open`);
  for (const k of Object.keys(J.st)) {
    const [x, y] = J.st[k];
    assert.ok(m.solid[y * m.w + x], `${k} is furniture`);
    assert.ok([[1, 0], [-1, 0], [0, -1], [0, 1]].some(([dx, dy]) => m.reach[(y + dy) * m.w + x + dx]), `${k} usable from a neighbour`);
  }
  for (const [x0, y0, x1, y1] of J.rooms) { let open = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) open += m.reach[y * m.w + x]; assert.ok(open >= 40, `flat ${x0},${y0}: ${open} open tiles`); }
  assert.equal(m.portals.length, 0, "no way out during the shift but [그만두기]");
}

// ── validation
{
  const w = world(2), p1 = w.S.players.c1;
  assert.match(act(w, "c1", { t: "coop_start", k: "apt" }).error, /파티장만/);
  assert.match(act(w, "c0", { t: "coop_start", k: "zzz" }).error, /열리지 않은/);
  assert.match(act(w, "c0", { t: "coop_start", k: "alch" }).error, /보글에게 다가가/);
  assert.match(act(w, "c0", { t: "coop_act" }).error, /근무 중이 아닙니다/);
  at(w.S.players.c0, 300, 300);
  assert.match(act(w, "c0", { t: "coop_start", k: "apt" }).error, /동동에게 다가가/);
  // a party member outside the lobby stays out
  L.runtime(w.S, p1.map).n--; p1.map = "town"; L.runtime(w.S, "town").n++;
  const w2 = world(1);
  assert.ok(act(w2, "c0", { t: "coop_start", k: "apt" }).ok);
  assert.match(act(w2, "c0", { t: "coop_act" }).error, /곧 근무가 시작/, "nothing during the briefing");
}

// ── alone: sweep a pile into a bundle, swap tools at the rack, bin it, burn it
{
  const w = world(1), S = w.S, p = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "apt" });
  const dim = shiftOf(w), c = dim.coop;
  assert.deepEqual([c.n, c.pl.c0.tool, c.state], [1, "broom", "brief"]);
  assert.ok(p.spdBuff >= c.endAt, "×1.4 walking for the shift");
  step(w, X.COOP_T.briefMs + 100);
  assert.equal(c.state, "run");
  const pile = c.ents.find((e) => e.t === 0);
  assert.ok(pile, "a pile at once");
  at(p, pile.x + 6, pile.y);
  for (let i = 0; i < A.pileHp; i++) { assert.ok(act(w, "c0", { t: "coop_act" }).ok); step(w, 300); }
  assert.equal(pile.t, 1, "three sweeps tie a bundle");
  assert.equal(c.score, 0, "the broom alone scores nothing");
  // a broom can't lift it
  step(w, 300); act(w, "c0", { t: "coop_act" });
  assert.ok(p.toast.some((m) => /빗자루로는/.test(m)), "says why"); step(w, 300);
  atTile(p, RACK); act(w, "c0", { t: "coop_act" });
  assert.equal(c.pl.c0.tool, "bin", "the rack swaps the tool");
  step(w, 300);
  at(p, pile.x, pile.y); act(w, "c0", { t: "coop_act" });
  assert.equal(c.pl.c0.hold.length, 1, "binned");
  step(w, 300);
  atTile(p, RACK); act(w, "c0", { t: "coop_act" });
  assert.equal(c.pl.c0.tool, "bin", "hands full: no swap");
  step(w, 300);
  atTile(p, BURN); act(w, "c0", { t: "coop_act" });
  assert.equal(c.pl.c0.hold.length, 0);
  assert.equal(c.score, A.bundlePts, "one bundle burnt: 10");
  assert.ok(Math.abs(c.pl.c0.pts - 10) < 1e-6, "all of it credited to the one who did the work");
  step(w, 100); const cj = lastOf("c0", "cj");
  assert.equal(cj[0], 0); assert.equal(cj[1], 1); assert.equal(cj[3], 10); assert.equal(cj[7], X.coopCut(c, 0), "next cut-off is C");
  assert.ok(Array.isArray(lastOf("c0", "C")));
  // rate limit: a second act within 250 ms does nothing
  const before = c.ents.length; c.ents.push({ id: 999, t: 0, x: p.x, y: p.y, hp: 3, due: 1e12, cred: {}, lift: null });
  c.pl.c0.tool = "broom"; step(w, 300);
  act(w, "c0", { t: "coop_act" }); act(w, "c0", { t: "coop_act" });
  assert.equal(c.ents.find((e) => e.id === 999).hp, 2, "250 ms between acts");
  assert.equal(c.ents.length, before + 1);
}

// ── parties of 2 and 4: one instance, tools by rotation, the sofa needs two
for (const n of [2, 3, 4]) {
  const w = world(n), S = w.S;
  assert.ok(act(w, "c0", { t: "coop_start", k: "apt" }).ok, `party of ${n}`);
  const dim = shiftOf(w), c = dim.coop;
  assert.equal(Object.keys(S.dims).filter((k) => S.dims[k].coop).length, 1);
  for (const pid of w.pids) assert.equal(S.players[pid].map, dim.id, `${pid} inside`);
  assert.deepEqual(w.pids.map((pid) => c.pl[pid].tool), ["broom", "bin", "broom", "bin"].slice(0, n));
  assert.equal(c.n, n);
  assert.equal(X.coopCut(c, 3), Math.round(J.par * (J.parN || X.COOP_T.parN)[n] * 0.88));
  assert.match(act(w, "c0", { t: "coop_start", k: "apt" }).error, /동동에게|이미/, "one shift per party");
  if (n !== 2) continue;
  step(w, X.COOP_T.briefMs + A.sofaMs / X.COOP_T.parN[2] + 200);
  const sofa = c.ents.find((e) => e.t === 2);
  assert.ok(sofa, "the sofa comes to a shift of two");
  const [a, b] = [S.players.c0, S.players.c1];
  at(a, sofa.x - 8, sofa.y); at(b, sofa.x + 8, sofa.y);
  act(w, "c0", { t: "coop_act" });
  assert.equal(sofa.hp, A.sofaHp, "one alone can't lift it");
  step(w, 2000); act(w, "c1", { t: "coop_act" });
  assert.equal(sofa.hp, A.sofaHp, "too late: 1.5 s");
  for (let i = 0; i < A.sofaHp; i++) { step(w, 300); act(w, "c0", { t: "coop_act" }); act(w, "c1", { t: "coop_act" }); }
  assert.ok(!c.ents.includes(sofa), "lifted away");
  const bundles = c.ents.filter((e) => e.t === 1 && e.cred.c0 && e.cred.c1);
  assert.equal(bundles.length + c.pl.c1.hold.length, A.sofaBundles, "three bundles, credited to both (the bin took one at once)");
}

// ── left alone: piles spread, complaints, fail on the clock (still eligible: walking about)
{
  const w = world(2), S = w.S;
  act(w, "c0", { t: "coop_start", k: "apt" });
  const dim = shiftOf(w), c = dim.coop;
  let spread = 0, complaints = 0;
  // a little work so the score shows, then walk about until the clock runs out
  step(w, X.COOP_T.briefMs + 200);
  const pile = c.ents.find((e) => e.t === 0), [a, b] = [S.players.c0, S.players.c1];
  at(a, pile.x, pile.y); for (let i = 0; i < 3; i++) { act(w, "c0", { t: "coop_act" }); step(w, 300); }
  at(b, pile.x, pile.y); act(w, "c1", { t: "coop_act" }); step(w, 300);
  atTile(b, RECY); act(w, "c1", { t: "coop_act" });
  assert.equal(c.score, Math.round(10 * 1.5), "recycling pays ×1.5");
  while (c.state !== "end") {
    step(w, 1000);
    for (const o of [a, b]) o.x += (Math.floor(w.now / 1000) % 2 ? 20 : -20);
    for (const v of views.c0.slice(-10)) for (const e of v.ev || []) { if (e[0] === "cj" && e[1] === 18) spread++; if (e[0] === "cj" && e[1] === 15) complaints++; }
  }
  log("spread", spread, "complaints", complaints, "score", c.score);
  assert.ok(spread > 0, "ignored piles spread");
  assert.ok(complaints > 0, "a mess over the cap brings complaints");
  assert.equal(c.score, 0, "complaints ate the points");
  const cr = lastOf("c0", "cr");
  assert.equal(cr[0], 0, "graded below C");
  assert.equal(a.ch.coopDone.length, 0, "a fail doesn't use up the day");
  assert.ok(a.ch.gold > 0, "a small tip");
  // the report, then home after endMs; the instance is gone
  step(w, X.COOP_T.endMs + 200);
  assert.equal(a.map, J.lobby); assert.equal(b.map, J.lobby);
  assert.equal(Object.keys(S.dims).length, 0); assert.ok(!Object.keys(S.maps).some((k) => k.startsWith("dim:")), "no leftover maps");
  assert.ok(!S.parties[a.party].coop, "the party is free again");
  assert.equal(lastOf("c0", "cj"), 0, "the HUD goes away");
}

/**
 * Walking at a player's own speed (×1.4 in a shift): a BFS distance field over the map's open tiles per goal tile,
 * then a step of spd·dt along it. `go(o, tile)` is true once o stands on that tile.
 */
function walker(dim) {
  const m = dim.map, W = m.w, fields = new Map();
  const field = ([gx, gy]) => {
    const key = gy * W + gx;
    if (fields.has(key)) return fields.get(key);
    const d = new Int32Array(W * m.h).fill(-1), q = [key];
    d[key] = 0;
    for (let i = 0; i < q.length; i++) {
      const t = q[i], x = t % W;
      for (const n of [x + 1 < W ? t + 1 : -1, x > 0 ? t - 1 : -1, t + W < W * m.h ? t + W : -1, t - W]) if (n >= 0 && m.reach[n] && d[n] < 0) { d[n] = d[t] + 1; q.push(n); }
    }
    fields.set(key, d);
    return d;
  };
  const tileOf = (o) => [Math.floor(o.x / T), Math.floor(o.y / T)];
  const steps = (o, goal) => field(goal)[tileOf(o)[1] * W + tileOf(o)[0]];
  function go(o, goal, ms) {
    let budget = (X.stats(o).spd * ms) / 1000;
    const d = field(goal);
    while (budget > 0) {
      const [cx, cy] = tileOf(o);
      let nx = goal[0], ny = goal[1];
      if (cx !== goal[0] || cy !== goal[1]) {
        let best = d[cy * W + cx];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = d[(cy + dy) * W + cx + dx]; if (v >= 0 && (best < 0 || v < best)) { best = v; nx = cx + dx; ny = cy + dy; } }
      }
      const [px, py] = X.tilePx([nx, ny]), dd = Math.hypot(px - o.x, py - o.y), mv = Math.min(dd, budget);
      if (dd < 0.01) break;
      o.x += ((px - o.x) * mv) / dd; o.y += ((py - o.y) * mv) / dd; budget -= mv;
    }
    const [cx, cy] = tileOf(o);
    return cx === goal[0] && cy === goal[1];
  }
  const tileAt = (e) => [Math.floor(e.x / T), Math.floor(e.y / T)];
  return { go, steps, tileOf, tileAt };
}

/**
 * A walking bot shift at player speed, acting every 300 ms like a quick human: brooms sweep the nearest unclaimed pile,
 * bins collect and carry to the 재활용함 (or the 소각로 when it is much nearer), the two nearest lift the sofa; alone, the
 * one worker swaps tools at the rack. `idle` pids stand still.
 */
function botShift(w, idle = []) {
  const S = w.S, dim = shiftOf(w), c = dim.coop, W = walker(dim), MS = 300;
  step(w, X.COOP_T.briefMs + 100);
  while (c.state !== "end") {
    const work = w.pids.map((pid) => S.players[pid]).filter((o) => o && o.map === dim.id && !idle.includes(o.pid));
    const sofa = c.ents.find((e) => e.t === 2), claimed = new Set();
    const lifters = sofa && work.length >= 2 ? [...work].sort((a, b) => W.steps(a, W.tileAt(sofa)) - W.steps(b, W.tileAt(sofa))).slice(0, 2) : [];
    const solo = work.length === 1;
    for (const o of work) {
      const q = c.pl[o.pid], act = () => act0(w, o.pid);
      if (lifters.includes(o)) {
        if (Math.hypot(o.x - sofa.x, o.y - sofa.y) > X.COOP_T.reach - 4) W.go(o, W.tileAt(sofa), MS);
        if (lifters.every((l) => Math.hypot(l.x - sofa.x, l.y - sofa.y) <= X.COOP_T.reach)) act();
        continue;
      }
      const nearest = (t) => c.ents.filter((e) => e.t === t && !claimed.has(e.id) && W.steps(o, W.tileAt(e)) >= 0).sort((a, b) => W.steps(o, W.tileAt(a)) - W.steps(o, W.tileAt(b)) || a.id - b.id)[0];
      const bundles = c.ents.filter((e) => e.t === 1).length;
      let goal = null, target = null;
      if (q.tool === "broom") {
        const pile = nearest(0);
        if (solo && (bundles >= A.binCap || !pile)) goal = RACK;
        else if (pile) { claimed.add(pile.id); target = pile; goal = W.tileAt(pile); }
      } else {
        const b = nearest(1);
        if (q.hold.length >= A.binCap || (q.hold.length && !b)) goal = W.steps(o, BURN) * 2 < W.steps(o, RECY) ? BURN : RECY;
        else if (b) { claimed.add(b.id); target = b; goal = W.tileAt(b); }
        else if (solo) goal = RACK;
      }
      if (!goal) continue;
      const there = W.go(o, goal, MS);
      if (there || (target && Math.hypot(o.x - target.x, o.y - target.y) <= X.COOP_T.reach - 4)) act();
    }
    step(w, MS);
  }
  return c;
}
const act0 = (w, pid) => act(w, pid, { t: "coop_act" });

// ── a bot party clears it; rewards once a day; helpers tip only; the next day pays again
{
  const w = world(2), S = w.S, [a, b] = [S.players.c0, S.players.c1];
  act(w, "c0", { t: "coop_start", k: "apt" });
  const c = botShift(w), g = X.coopGrade(c);
  log("duo bot score", c.score, "grade", g, "cuts", [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  assert.ok(g >= 3, `a steady duo reaches A or S: ${c.score}`);
  const cr = lastOf("c0", "cr");
  assert.equal(cr[0], g); assert.equal(cr[1], Math.round(c.score)); assert.equal(cr[3].length, 2);
  assert.ok(cr[3].every((r) => r[3] === 1), "both eligible");
  assert.deepEqual(a.ch.coopDone, ["apt"]); assert.equal(a.ch.coopDay, X.dayOf(w.now));
  assert.ok(a.ch.inv.some((s) => s.id === "stone"), "강화석");
  assert.ok(a.ch.gold >= X.COOP_T.gold[g - 1], "the day's pay");
  assert.equal(a.ch.rep.dongdong || 0, Object.hasOwn(X.NPC_MAP, "dongdong") ? X.COOP_T.rep : 0, "trust with 동동");
  assert.ok(a.ch.life.deliver.xp > 0 || a.ch.life.deliver.lv > 1, "life XP (배달)");
  assert.deepEqual(L.viewFor(S, "c0").self?.coop ?? a.ch.coopDone, ["apt"]);
  // again the same day: a helper's tip
  step(w, X.COOP_T.endMs + 200);
  const gold = a.ch.gold, stones = a.ch.inv.filter((s) => s.id === "stone").reduce((n, s) => n + s.n, 0);
  for (const o of [a, b]) { const dd = X.mapOf(J.lobby).npcs.find((q) => q.id === "dongdong"); at(o, dd.x * T + 8, dd.y * T + 28); }
  assert.ok(act(w, "c0", { t: "coop_start", k: "apt" }).ok);
  botShift(w);
  assert.equal(a.ch.gold - gold, X.COOP_T.helpTip * 1, "helper tip 15·T");
  assert.equal(a.ch.inv.filter((s) => s.id === "stone").reduce((n, s) => n + s.n, 0), stones, "no second pay");
  // the next day pays again
  step(w, X.COOP_T.endMs + 200);
  w.now += DAY;
  for (const o of [a, b]) { const dd = X.mapOf(J.lobby).npcs.find((q) => q.id === "dongdong"); at(o, dd.x * T + 8, dd.y * T + 28); }
  const r3 = act(w, "c0", { t: "coop_start", k: "apt" }); const c3 = shiftOf(w) && shiftOf(w).coop;
  botShift(w);
  log("day 2", JSON.stringify(r3), c3 && c3.score, c3 && Object.values(c3.pl).map((q) => [q.pts, q.ok]));
  assert.equal(a.ch.coopDay, X.dayOf(w.now)); assert.deepEqual(a.ch.coopDone, ["apt"]);
  assert.ok(a.ch.inv.filter((s) => s.id === "stone").reduce((n, s) => n + s.n, 0) > stones, "a new day's pay");
}

// ── walking bots at player speed, 1–4 workers: the opening mess and the spawn rate grow with the party; the cut-offs
// are set so these bots land on A–S (a real party, slower to decide, lands on B–A)
for (const n of [1, 2, 3, 4]) {
  const w = world(n);
  act(w, "c0", { t: "coop_start", k: "apt" });
  const c = shiftOf(w).coop;
  assert.equal(c.ents.filter((e) => e.t === 0).length, A.open[0] + A.open[1] * n, `${n}: the opening piles`);
  botShift(w);
  log(`apt ${n}: score`, c.score, "grade", X.coopGrade(c), [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  assert.ok(X.coopGrade(c) >= 3 && X.coopGrade(c) <= 4, `${n} walking bot(s) reach A–S: ${c.score}`);
}

// ───────────────────────────── 쥬쥬식당 서빙 (C.5) ─────────────────────────────

const JD = X.COOP.diner, R = X.COOP_DINER;
/** A world with `n` players by 쥬쥬 in her diner (one party when n ≥ 2). */
function dworld(n, t0 = 1000, seed = 20251111) {
  const w = world(n, t0, seed), lob = X.mapOf(JD.lobby), jj = lob.npcs.find((o) => o.id === "juju");
  for (const pid of w.pids) { const p = w.S.players[pid]; L.runtime(w.S, p.map).n--; p.map = JD.lobby; L.runtime(w.S, JD.lobby).n++; at(p, jj.x * T + 8, jj.y * T + 12 + 16); }
  return w;
}
const below = ([x, y]) => [x, y + 1], above = ([x, y]) => [x, y - 1];

// ── the map: big enough for four, every station and table usable
{
  const w = dworld(1), p = w.S.players.c0;
  assert.ok(act(w, "c0", { t: "coop_start", k: "diner" }).ok, "the diner opens at 쥬쥬");
  const dim = shiftOf(w), m = dim.map, open = m.reach.reduce((n, v) => n + v, 0);
  log("diner open tiles", open);
  assert.deepEqual([m.w, m.h, m.safe], [44, 24, true]);
  for (const r of [...JD.tpl.ground, ...JD.tpl.objects]) assert.equal(r.length, 44);
  assert.ok(open >= 700, `a big hall: ${open} open tiles`);
  assert.equal(JD.tables.length, 12);
  const usable = ([x, y]) => m.solid[y * m.w + x] && [[1, 0], [-1, 0], [0, -1], [0, 1]].some(([dx, dy]) => m.reach[(y + dy) * m.w + x + dx]);
  for (const k of Object.keys(JD.st)) for (const t of Array.isArray(JD.st[k][0]) ? JD.st[k] : [JD.st[k]]) assert.ok(usable(t), `${k} ${t} usable`);
  for (const t of JD.tables) assert.ok(usable(t) && m.reach[(t[1] - 1) * m.w + t[0]], `table ${t}`);
  assert.equal(dim.coop.pl.c0.tool, "pan");
  assert.equal(p.map, dim.id);
}

// ── alone: a salad from crate to table, the wrong dish refused, a pot that burns, a customer who leaves angry
{
  const w = dworld(1), S = w.S, p = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "diner" });
  const dim = shiftOf(w), c = dim.coop, q = c.pl.c0;
  step(w, X.COOP_T.briefMs + 100);
  // salad: veg → 4 chops → pass
  atTile(p, below(JD.st.veg)); act(w, "c0", { t: "coop_act" });
  assert.deepEqual([q.hold.length, q.hold[0].r], [1, 0], "veg in hand");
  step(w, 300); atTile(p, above(JD.st.pass[0])); act(w, "c0", { t: "coop_act" });
  assert.ok(p.toast.some((m) => /도마/.test(m)), "has to be chopped first");
  atTile(p, below(JD.st.board[0]));
  for (let i = 0; i < R.dishes[0].chop; i++) { step(w, 300); act(w, "c0", { t: "coop_act" }); }
  assert.equal(q.hold[0].chop, 0);
  step(w, 300); atTile(p, above(JD.st.pass[0])); act(w, "c0", { t: "coop_act" });
  assert.equal(c.ents.filter((e) => e.t === 5).length, 1, "plated at the pass");
  // fish: on the stove, then forgotten → burnt
  step(w, 300); atTile(p, below(JD.st.fish)); act(w, "c0", { t: "coop_act" });
  step(w, 300); atTile(p, below(JD.st.stove[0])); act(w, "c0", { t: "coop_act" });
  const pot = c.ents.find((e) => e.t === 4);
  assert.ok(pot && !q.hold.length, "on the stove");
  step(w, 300); act(w, "c0", { t: "coop_act" });
  assert.ok(c.ents.includes(pot), "not done yet");
  const s0 = c.score; step(w, R.dishes[1].cook + R.burnMs + 200);
  assert.ok(!c.ents.includes(pot), "burnt away");
  // swap to the tray, take the salad, serve it to the salad table (a fish table refuses it)
  atTile(p, below(JD.st.rack)); act(w, "c0", { t: "coop_act" });
  assert.equal(q.tool, "tray");
  step(w, 300); atTile(p, below(JD.st.pass[0])); act(w, "c0", { t: "coop_act" });
  assert.equal(q.hold.length, 1, "salad on the tray");
  const orders = c.ents.filter((e) => e.t === 3);
  assert.ok(orders.length >= 1 && orders.length <= R.seats[0], `orders: ${orders.length}`);
  const wrong = orders.find((e) => e.r !== 0);
  if (wrong) { step(w, 1300); atTile(p, above(JD.tables[wrong.ti])); act(w, "c0", { t: "coop_act" }); assert.ok(p.toast.some((m) => /주문과 다른/.test(m)), "the wrong table says so"); }
  let salad = c.ents.find((e) => e.t === 3 && e.r === 0);
  if (!salad) { salad = { id: 9999, t: 3, r: 0, ti: 11, x: X.tilePx(JD.tables[11])[0], y: X.tilePx(JD.tables[11])[1], until: w.now + 60000, pat: 60000 }; c.ents.push(salad); }
  const before = c.score; step(w, 300); atTile(p, above(JD.tables[salad.ti])); act(w, "c0", { t: "coop_act" });
  assert.ok(!c.ents.includes(salad) && c.score > before && c.served === 1, `served: ${c.score - before}`);
  assert.ok(c.score - before >= R.dishes[0].pts, "at least the dish's points");
  log("diner alone, burnt", s0, "→ served", c.score);
  // nobody serves now: someone leaves angry
  const miss = c.miss; step(w, R.patience[0] + 1000);
  assert.ok(c.miss > miss, "an angry customer");
  // the wire: orders and pots carry a dish and deciseconds
  p.cVer = -1; step(w, 100);
  const C = lastOf("c0", "C"), o = C.find((r) => r[1] === 3);
  if (o) assert.equal(o.length, 7);
  const cj = lastOf("c0", "cj");
  assert.equal(cj[0], 1, "diner is job index 1"); assert.equal(cj[8], c.served); assert.equal(cj[9], c.miss);
}

// ── plates: a served table eats, leaves a dirty plate that keeps it closed; a tray takes it to the sink, 3 scrubs wash it
{
  const w = dworld(1), p = w.S.players.c0;
  act(w, "c0", { t: "coop_start", k: "diner" });
  const c = shiftOf(w).coop, q = c.pl.c0;
  step(w, X.COOP_T.briefMs + 100);
  c.ents = c.ents.filter((e) => e.t !== 3);
  const [x, y] = X.tilePx(JD.tables[11]);
  c.ents.push({ id: c.nid++, t: 3, r: 0, ti: 11, x, y, until: w.now + 60000, pat: 60000 });
  q.tool = "tray"; q.hold = [{ r: 0, cred: { c0: 1 } }];
  atTile(p, above(JD.tables[11])); act(w, "c0", { t: "coop_act" });
  const plate = c.ents.find((e) => e.t === 9);
  assert.ok(plate && plate.ti === 11 && c.served === 1 && !q.hold.length, "served: a plate on the table");
  step(w, 300); act(w, "c0", { t: "coop_act" });
  assert.ok(c.ents.includes(plate) && !q.hold.length, "still eating: not taken yet");
  for (let i = 0; i < 200; i++) { step(w, 300); assert.ok(!c.ents.some((e) => e.t === 3 && e.ti === 11), "no order at a table with a plate"); }
  act(w, "c0", { t: "coop_act" });
  assert.ok(!c.ents.includes(plate) && q.hold.length === 1 && q.hold[0].r === 3, "the dirty plate on the tray");
  step(w, 300); atTile(p, below(JD.st.sink)); act(w, "c0", { t: "coop_act" });
  assert.ok(!q.hold.length && c.ents.some((e) => e.t === 9 && e.ti < 0), "into the sink");
  p.cVer = -1; step(w, 100);
  assert.deepEqual(lastOf("c0", "C").find((r) => r[1] === 9).slice(4), [0, R.washN, 1], "wire: [.., ds eating, washes left, at the sink]");
  const s0 = c.score;
  for (let i = 0; i < R.washN; i++) { step(w, 300); p.toast = []; act(w, "c0", { t: "coop_act" }); assert.ok(p.toast.some((m) => m.includes(`설거지 ${i + 1}/${R.washN}`)), "설거지 n/3"); }
  assert.ok(!c.ents.some((e) => e.t === 9) && c.score - s0 >= R.washPts, `washed: +${c.score - s0}`);
  step(w, 300); act(w, "c0", { t: "coop_act" });
  assert.ok(p.toast.some((m) => /씻을 접시/.test(m)), "nothing left to wash");
}

/** Diner bots walking at player speed: pans cook what the tables want, trays carry it; alone, one swaps at the rack. */
function dinerBot(w) {
  const S = w.S, dim = shiftOf(w), c = dim.coop, W = walker(dim), MS = 300, D = R.dishes;
  step(w, X.COOP_T.briefMs + 100);
  while (c.state !== "end") {
    const work = w.pids.map((pid) => S.players[pid]).filter((o) => o && o.map === dim.id), solo = work.length === 1;
    const orders = c.ents.filter((e) => e.t === 3).sort((a, b) => a.until - b.until), pass = c.ents.filter((e) => e.t === 5);
    // what is already on its way: plated, on the stoves, in hands
    const coming = [...pass.map((e) => e.r), ...c.ents.filter((e) => e.t === 4).map((e) => e.r), ...Object.values(c.pl).flatMap((q) => q.hold.map((h) => h.r))];
    const want = []; { const left = [...coming]; for (const o of orders) { const i = left.indexOf(o.r); if (i >= 0) left.splice(i, 1); else want.push(o.r); } }
    // plates: dirty on the tables, waiting at the sink
    const dirty = c.ents.filter((e) => e.t === 9 && e.ti >= 0 && e.due <= w.now), sinkQ = c.ents.filter((e) => e.t === 9 && e.ti < 0);
    // trays clear plates only when the free tables run short (a walk to the sink costs dishes)
    const short = JD.tables.length - orders.length - c.ents.filter((e) => e.t === 9 && e.ti >= 0).length < R.seats[c.n - 1] + 2;
    const claimed = new Set();
    for (const o of work) {
      const q = c.pl[o.pid], h = q.hold[0], kitchen = W.tileOf(o)[1] < 7;
      let goal = null;
      if (q.tool === "pan") {
        const done = c.ents.filter((e) => e.t === 4 && e.doneAt <= w.now + 600 && !claimed.has(e.id))[0];
        if (h) {
          const need = h.chop > 0 ? 1 : D[h.r].cook && !h.cooked ? 2 : 0;
          if (need === 1) goal = below(JD.st.board[0]);
          else if (need === 2) { const s = JD.st.stove.findIndex((t, i) => !c.ents.some((e) => e.t === 4 && e.si === i) && !claimed.has("s" + i)); if (s >= 0) { claimed.add("s" + s); goal = below(JD.st.stove[s]); } }
          else goal = above(JD.st.pass[pass.length % JD.st.pass.length]);
        } else if (done) { claimed.add(done.id); goal = below(JD.st.stove[done.si]); }
        else if (solo && pass.length && (pass.length >= 2 || !want.length)) goal = kitchen ? above(JD.st.rack) : below(JD.st.rack);
        else if (want.length) { const r = want.shift(); goal = below(JD.st[D[r].crate]); }
        else if (sinkQ.length) goal = below(JD.st.sink);
        else if (solo && short && dirty.length) goal = kitchen ? above(JD.st.rack) : below(JD.st.rack);
        if (!goal) continue;
      } else {
        const match = orders.find((e) => q.hold.some((d) => d.r === e.r) && !claimed.has(e.id));
        if (match && (q.hold.length >= R.trayCap || !pass.some((d) => orders.some((e) => e.r === d.r)) || pass.length === 0)) { claimed.add(match.id); goal = above(JD.tables[match.ti]); }
        else if (pass.length && q.hold.length < R.trayCap) goal = below(JD.st.pass[0]);
        else if (match) { claimed.add(match.id); goal = above(JD.tables[match.ti]); }
        else if (short && q.hold.length < R.trayCap && dirty.some((e) => !claimed.has(e.id))) { const e = dirty.find((e) => !claimed.has(e.id)); claimed.add(e.id); goal = above(JD.tables[e.ti]); }
        else if (q.hold.some((h) => h.r === 3)) goal = below(JD.st.sink);
        else if (!q.hold.length && sinkQ.length) goal = below(JD.st.sink);
        else if (solo && !q.hold.length) goal = kitchen ? above(JD.st.rack) : below(JD.st.rack);
        if (!goal) continue;
      }
      if (W.go(o, goal, MS)) act0(w, o.pid);
    }
    step(w, MS);
  }
  return c;
}

// ── walking bots 1–4: tables, the order rate and patience scale with the party; the cut-offs land them on A–S
for (const n of [1, 2, 3, 4]) {
  const w = dworld(n), S = w.S;
  act(w, "c0", { t: "coop_start", k: "diner" });
  const c = shiftOf(w).coop;
  assert.deepEqual(w.pids.map((pid) => c.pl[pid].tool), ["pan", "tray", "pan", "tray"].slice(0, n));
  dinerBot(w);
  log(`diner ${n}: score`, Math.round(c.score), "served", c.served, "missed", c.miss, "grade", X.coopGrade(c), [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  assert.ok(X.coopGrade(c) >= 3, `${n} walking bot(s) reach A–S: ${c.score}`);
  // rewards: the day's pay once (cook life XP, trust with 쥬쥬), the report card
  const a = S.players.c0, cr = lastOf("c0", "cr");
  assert.equal(cr[0], X.coopGrade(c)); assert.equal(cr[3].length, n);
  assert.deepEqual(a.ch.coopDone, ["diner"]);
  assert.ok(a.ch.life.cook.xp > 0 || a.ch.life.cook.lv > 1, "life XP (요리)");
  assert.ok(a.ch.inv.some((s) => s.id === "stone"), "강화석");
  if (n === 4) {
    // the same day again: helpers' tips only
    step(w, X.COOP_T.endMs + 200);
    const jj = X.mapOf(JD.lobby).npcs.find((o) => o.id === "juju");
    for (const pid of w.pids) at(S.players[pid], jj.x * T + 8, jj.y * T + 28);
    const gold = a.ch.gold;
    assert.ok(act(w, "c0", { t: "coop_start", k: "diner" }).ok);
    dinerBot(w);
    assert.equal(a.ch.gold - gold, X.COOP_T.helpTip, "a helper's tip the second time");
    assert.deepEqual(a.ch.coopDone, ["diner"]);
  }
}

// ── the diner's numbers grow with the party
for (let i = 1; i < 4; i++) {
  assert.ok(R.seats[i] > R.seats[i - 1] && R.orderMs[i] < R.orderMs[i - 1] && R.patience[i] <= R.patience[i - 1], "harder with more hands");
  assert.ok(X.COOP_APT.pileMs[i] < X.COOP_APT.pileMs[i - 1], "the apartment too");
}

// ───────────────────────────── 캉캉대장간 단조 (C.6) ─────────────────────────────

const JF = X.COOP.forge, F = X.COOP_FORGE;
/** A world with `n` players by 캉캉 in his forge (k "alch": by 보글 in her lab; one party when n ≥ 2). */
function fworld(n, t0 = 1000, seed = 20251111, k = "forge") {
  const JK = X.COOP[k], w = world(n, t0, seed), kk = X.mapOf(JK.lobby).npcs.find((o) => o.id === JK.npc);
  for (const pid of w.pids) { const p = w.S.players[pid]; L.runtime(w.S, p.map).n--; p.map = JK.lobby; L.runtime(w.S, JK.lobby).n++; at(p, kk.x * T + 8, kk.y * T + 12 + 16); }
  return w;
}
const left = ([x, y]) => [x - 1, y];
const fEnt = (c, t, i) => c.ents.find((e) => e.t === t && (t === 6 ? e.fi : e.ai) === i);

// ── the map, every station usable; alone: crate → furnace → anvil, strikes judged, quench, deliver
{
  const w = fworld(1), S = w.S, p = S.players.c0;
  assert.ok(act(w, "c0", { t: "coop_start", k: "forge" }).ok, "the forge opens at 캉캉");
  const dim = shiftOf(w), m = dim.map, c = dim.coop, q = c.pl.c0;
  assert.deepEqual([m.w, m.h, m.safe, m.portals.length], [30, 16, true, 0]);
  for (const r of [...JF.tpl.ground, ...JF.tpl.objects]) assert.equal(r.length, 30);
  const usable = ([x, y]) => m.solid[y * m.w + x] && [[1, 0], [-1, 0], [0, -1], [0, 1]].some(([dx, dy]) => m.reach[(y + dy) * m.w + x + dx]);
  for (const k of Object.keys(JF.st)) for (const t of Array.isArray(JF.st[k][0]) ? JF.st[k] : [JF.st[k]]) assert.ok(usable(t), `${k} ${t} usable`);
  for (const t of JF.start) assert.ok(m.reach[t[1] * m.w + t[0]], `start ${t}`);
  assert.equal(q.tool, "tongs");
  step(w, X.COOP_T.briefMs + 1600);
  assert.ok(c.ents.filter((e) => e.t === 8).length >= 1, "orders on the board");
  // a bar from the crate into the furnace; pump the furnace into the band; it heats to 100
  atTile(p, below(JF.st.crate)); assert.ok(act0(w, "c0").ok); assert.equal(q.hold.length, 1);
  step(w, 300); atTile(p, below(JF.st.furnace[0])); act0(w, "c0");
  const f = fEnt(c, 6, 0);
  assert.ok(f.bars[0] && !q.hold.length, "in the fire");
  for (let i = 0; i < 30 && f.bars[0].heat < 100; i++) { step(w, 300); if (f.T < 72) act0(w, "c0"); }
  assert.equal(f.bars[0].heat, 100, "hot");
  assert.ok(f.T >= F.lo && f.T <= F.scorch, `kept in the band: ${f.T}`);
  step(w, 300); act0(w, "c0");
  assert.ok(q.hold[0].hot > w.now, "taken out hot");
  step(w, 300); atTile(p, above(JF.st.anvil[0])); act0(w, "c0");
  const a = fEnt(c, 7, 0), pc = a.pc;
  assert.ok(pc && pc.r >= 0, "on the anvil, made for an order");
  const ev = views.c0.at(-1).ev || [];
  step(w, 100); assert.ok([...ev, ...(views.c0.at(-1).ev || [])].some((e) => e[0] === "cb" && e[1] === a.id && e[2] === F.leadMs), "the beat ring event");
  // swap to the hammer, strike: one on the beat (perfect), one off it (miss), one on the same beat twice (miss)
  step(w, 200); atTile(p, left(JF.st.rack)); act0(w, "c0"); assert.equal(q.tool, "hammer");
  atTile(p, below(JF.st.anvil[0]));
  const toBeat = () => { const s = w.now - a.beat0, k = Math.max(0, Math.round(s / a.per)); return a.beat0 + k * a.per - w.now; };
  const strike = () => { w.S.now = w.now; return act0(w, "c0"); };
  // move to an exact beat (beats sit on a 50 ms grid here)
  for (let i = 0; i < 40 && !(Math.abs(toBeat()) <= 50 && w.now - q.actAt >= 250 && w.now > a.beat0); i++) step(w, 100);
  const q0 = pc.q; strike();
  assert.equal(pc.q - q0, 2, "perfect: +2"); assert.equal(pc.n, 1);
  w.now += 0; strike(); assert.equal(pc.n, 1, "250 ms between acts");
  w.now += 300; S.now = w.now; strike();
  assert.ok(pc.n === 2 && pc.q - q0 === 1, `the same beat again: a miss (${pc.q - q0})`);
  // strike out the rest on the beat
  while (pc.n < X.COOP_FORGE.orders[pc.r].n && pc.hot > w.now) { step(w, 50); if (Math.abs(toBeat()) <= 50 && w.now - q.actAt >= 250 && Math.round((w.now - a.beat0) / a.per) !== a.lastK) strike(); }
  if (pc.st !== "shaped") { pc.n = X.COOP_FORGE.orders[pc.r].n; pc.st = "shaped"; }   // a 냄비 wants a second heat: shortcut it here
  assert.equal(pc.st, "shaped");
  step(w, 300); act0(w, "c0"); assert.ok(q.hold[0] === pc && !a.pc, "the hammer takes the shaped piece");
  step(w, 300); atTile(p, left(JF.st.chute)); act0(w, "c0");
  assert.equal(c.done, 0, "not quenched: the chute waits");
  step(w, 300); atTile(p, below(JF.st.quench[0])); act0(w, "c0"); assert.equal(pc.st, "quenched");
  const s0 = c.score; step(w, 300); atTile(p, left(JF.st.chute)); act0(w, "c0");
  assert.ok(c.done === 1 && c.score > s0 && !q.hold.length, `delivered: +${c.score - s0}`);
  // an order left alone runs late
  const late = c.late; step(w, F.deadMs + 1000);
  assert.ok(c.late > late, "a late order");
  p.cVer = -1; step(w, 100);
  const C = lastOf("c0", "C"), cj = lastOf("c0", "cj");
  assert.equal(cj[0], 2, "forge is job index 2"); assert.deepEqual([cj[8], cj[9]], [c.done, c.late]);
  assert.ok(C.some((r) => r[1] === 6 && r.length === 5 + F.slots) && C.some((r) => r[1] === 7 && r.length === 9), "furnace and anvil rows");
}

// ── the latency calibration: a steady +200 ms is calibrated out to ±150, so later strikes judge "good" not "miss"
{
  const w = fworld(1), S = w.S, p = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "forge" });
  const c = shiftOf(w).coop, q = c.pl.c0, a = fEnt(c, 7, 1);
  step(w, X.COOP_T.briefMs + 200);
  q.tool = "hammer"; atTile(p, below(JF.st.anvil[1]));
  a.pc = { r: 2, q: 0, n: 0, heat: 100, hot: w.now + 60000, heats: 1, st: "bar", ct: {}, ch: {} }; a.beat0 = w.now; a.per = 750; a.lastK = -1;
  const judged = [];
  for (let k = 1; k <= 8; k++) { w.now = a.beat0 + k * 750 + 200; S.now = w.now; const q0 = a.pc.q; act0(w, "c0"); judged.push(a.pc.q - q0); }
  log("forge lat", judged, q.offs);
  assert.equal(judged[0], 1, "uncalibrated: 200 ms late is good");
  assert.ok(judged.slice(-3).every((d) => d === 2), "calibrated: +200 within 160 of the +150 offset is perfect");
}

/** Forge bots walking at player speed (100 ms steps so hammers hit the beat): tongs feed the furnaces, pump and carry hot
 * bars to free anvils; hammers strike on the beat, quench and deliver; alone, the one worker swaps at the rack. */
function forgeBot(w) {
  const S = w.S, dim = shiftOf(w), c = dim.coop, W = walker(dim), MS = 100;
  const last = {};
  step(w, X.COOP_T.briefMs + 100);
  while (c.state !== "end") {
    const now = w.now, work = w.pids.map((pid) => S.players[pid]).filter((o) => o && o.map === dim.id), solo = work.length === 1;
    const furn = c.ents.filter((e) => e.t === 6), anv = c.ents.filter((e) => e.t === 7), orders = c.ents.filter((e) => e.t === 8);
    const pieces = [...furn.flatMap((f) => f.bars.filter(Boolean)), ...anv.filter((a) => a.pc).map((a) => a.pc), ...Object.values(c.pl).flatMap((q) => q.hold)];
    const claimed = new Set();
    let fetch = 0;
    const A0 = X.COOP[c.k].tools[0], tongs = work.filter((o) => c.pl[o.pid].tool === A0).length || 1;   // alch: the fan, same stations
    for (const o of work) {
      const q = c.pl[o.pid], h = q.hold[0], ready = now - (last[o.pid] || 0) >= 300;
      const go = (goal) => W.go(o, goal, MS);
      const doAct = () => { last[o.pid] = now; act0(w, o.pid); };
      const nearest = (list, tile) => list.sort((a, b) => W.steps(o, tile(a)) - W.steps(o, tile(b)))[0];
      if (q.tool === A0) {
        const freeAnv = anv.filter((a) => !a.pc && !claimed.has("a" + a.id));
        const hotIn = furn.filter((f) => f.bars.some((b) => b && b.heat >= 100) && !claimed.has("f" + f.id));
        const cooled = anv.filter((a) => a.pc && a.pc.st === "bar" && !(a.pc.hot > now) && !claimed.has("a" + a.id));
        if (solo && !h && anv.some((a) => a.pc && (a.pc.hot > now || a.pc.st !== "bar"))) { if (go(left(JF.st.rack)) && ready) doAct(); continue; }
        let goal = null, pump = null;
        if (h && h.hot > now) { const a = nearest(freeAnv, (a) => above(JF.st.anvil[a.ai])); if (a) { claimed.add("a" + a.id); goal = above(JF.st.anvil[a.ai]); } }
        else if (h) { const f = nearest(furn.filter((f) => f.bars.includes(null)), (f) => below(JF.st.furnace[f.fi])) || furn[0]; goal = below(JF.st.furnace[f.fi]); pump = f; }
        else if (hotIn.length && freeAnv.length) { const f = nearest(hotIn, (f) => below(JF.st.furnace[f.fi])); claimed.add("f" + f.id); goal = below(JF.st.furnace[f.fi]); }
        else if (cooled.length) { const a = nearest(cooled, (a) => above(JF.st.anvil[a.ai])); claimed.add("a" + a.id); goal = above(JF.st.anvil[a.ai]); }
        else if (pieces.length + fetch < Math.min(orders.length, tongs + 1) && furn.some((f) => f.bars.includes(null))) { fetch++; goal = below(JF.st.crate); }
        else { const busy = furn.filter((f) => !claimed.has("p" + f.id)), f = nearest(busy.filter((f) => f.bars.some((b) => b && b.heat < 100)), (f) => below(JF.st.furnace[f.fi])) || nearest(busy, (f) => below(JF.st.furnace[f.fi])) || furn[0]; claimed.add("p" + f.id); goal = below(JF.st.furnace[f.fi]); pump = f; }
        if (!goal) continue;
        const want = !pump || (h && pump.bars.includes(null)) || pump.T < 75;
        if (go(goal) && ready && want) doAct();
      } else {
        const hotA = anv.filter((a) => a.pc && a.pc.st === "bar" && a.pc.hot > now && !claimed.has("h" + a.id));
        const shapedA = anv.filter((a) => a.pc && a.pc.st !== "bar" && !claimed.has("h" + a.id));
        if (solo && !h && !hotA.length && !shapedA.length) { if (go(left(JF.st.rack)) && ready) doAct(); continue; }
        if (h && h.st === "shaped") { const t = nearest([...JF.st.quench], (t) => below(t)); if (go(below(t)) && ready) doAct(); continue; }
        if (h) { if (go(left(JF.st.chute)) && ready) doAct(); continue; }
        const a = nearest(hotA, (a) => below(JF.st.anvil[a.ai])) || nearest(shapedA, (a) => below(JF.st.anvil[a.ai]));
        if (!a) { go(below(JF.st.anvil[1])); continue; }
        claimed.add("h" + a.id);
        if (!go(below(JF.st.anvil[a.ai])) || now - q.actAt < 250) continue;
        if (a.pc.st !== "bar") { doAct(); continue; }
        const s = now - a.beat0, k = Math.round(s / a.per);
        if (s >= -50 && Math.abs(s - k * a.per) <= 50 && k !== a.lastK) doAct();
      }
    }
    step(w, MS);
  }
  return c;
}

// ── walking bots 1–4: orders scale with the party; the cut-offs land them just over S; rewards once a day
for (const n of [1, 2, 3, 4]) {
  const w = fworld(n), S = w.S;
  act(w, "c0", { t: "coop_start", k: "forge" });
  const c = shiftOf(w).coop;
  assert.deepEqual(w.pids.map((pid) => c.pl[pid].tool), ["tongs", "hammer", "tongs", "hammer"].slice(0, n));
  forgeBot(w);
  log(`forge ${n}: score`, Math.round(c.score), "done", c.done, "late", c.late, "grade", X.coopGrade(c), [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  assert.ok(X.coopGrade(c) >= 3, `${n} walking bot(s) reach A–S: ${c.score}`);
  const a = S.players.c0;
  assert.deepEqual(a.ch.coopDone, ["forge"]);
  assert.ok(a.ch.life.craft.xp > 0 || a.ch.life.craft.lv > 1, "life XP (제작)");
  assert.equal(a.ch.rep.kangkang || 0, Object.hasOwn(X.NPC_MAP, "kangkang") ? X.COOP_T.rep : 0, "trust with 캉캉");
  if (n === 2) {
    step(w, X.COOP_T.endMs + 200);
    const kk = X.mapOf(JF.lobby).npcs.find((o) => o.id === "kangkang");
    for (const pid of w.pids) at(S.players[pid], kk.x * T + 8, kk.y * T + 28);
    const gold = a.ch.gold;
    assert.ok(act(w, "c0", { t: "coop_start", k: "forge" }).ok);
    forgeBot(w);
    assert.equal(a.ch.gold - gold, X.COOP_T.helpTip, "a helper's tip the second time");
  }
}

// ───────────────────────────── 보글연금공방 가마 (C.6 보글 skin: the forge's engine) ─────────────────────────────

// ── starts at 보글 in her lab; fan/paddle; a stir judged on the beat; a delivery in potion words
{
  const JA = X.COOP.alch, w = fworld(1, 1000, 20251111, "alch"), S = w.S, p = S.players.c0;
  assert.deepEqual([JA.npc, JA.lobby, JA.skill, JA.tools], ["bogle", "bogle_lab", "alch", ["fan", "paddle"]]);
  assert.match(act(fworld(1), "c0", { t: "coop_start", k: "alch" }).error, /보글에게 다가가/, "not at 캉캉's");
  assert.ok(act(w, "c0", { t: "coop_start", k: "alch" }).ok, "the kiln opens at 보글");
  const dim = shiftOf(w), c = dim.coop, q = c.pl.c0;
  assert.deepEqual([dim.map.w, dim.map.h, dim.map.style, q.tool], [30, 16, "lab", "fan"]);
  step(w, X.COOP_T.briefMs + 1600);
  atTile(p, below(JA.st.crate)); assert.ok(act0(w, "c0").ok, "herbs from the shelf"); assert.equal(q.hold.length, 1);
  // a hot brew straight onto a cauldron, then the paddle stirs it on the beat
  q.hold[0].hot = w.now + 10000; q.hold[0].heats = 1;
  step(w, 300); atTile(p, above(JA.st.anvil[0])); assert.ok(act0(w, "c0").ok);
  const a = fEnt(c, 7, 0), pc = a.pc;
  assert.ok(pc && pc.r >= 0, "in the cauldron, for an order");
  q.tool = "paddle"; atTile(p, below(JA.st.anvil[0]));
  for (let i = 0; i < 40 && !(w.now > a.beat0 && Math.abs((w.now - a.beat0) % a.per) <= 50); i++) step(w, 50);
  const q0 = pc.q; S.now = w.now; act0(w, "c0");
  assert.deepEqual([pc.n, pc.q - q0], [1, 2], "a stir on the beat: perfect +2");
  // bottled and delivered for its order: potion words in the toast
  pc.n = F.orders[pc.r].n; pc.st = "quenched"; a.pc = null; q.hold = [pc];
  const done = c.done; step(w, 300); atTile(p, left(JA.st.chute)); act0(w, "c0");
  assert.equal(c.done, done + 1, "delivered");
  assert.ok(p.toast.some((m) => /\] (빨간 물약|파란 물약|엘릭서|묘약) 납품!/.test(m)), `potion words: ${p.toast.slice(-2)}`);
  assert.deepEqual(L.defs().coop.jobs.alch[8].orders, ["빨간 물약", "파란 물약", "엘릭서", "묘약"]);
}

// ── 1–2 bots: the same shift as the forge's (same seed → same score and cut-offs); paid in `alch` with 보글 once a day
for (const n of [1, 2]) {
  const run = (k) => { const w = fworld(n, 1000, 20251111, k); act(w, "c0", { t: "coop_start", k }); return [w, forgeBot(w)]; };
  const [, cf] = run("forge"), [w, c] = run("alch"), a = w.S.players.c0;
  log(`alch ${n}: score`, Math.round(c.score), "done", c.done, "grade", X.coopGrade(c));
  assert.equal(c.score, cf.score, "identical rules and numbers");
  assert.deepEqual([0, 1, 2, 3].map((i) => X.coopCut(c, i)), [0, 1, 2, 3].map((i) => X.coopCut(cf, i)));
  assert.ok(X.coopGrade(c) >= 3, `${n} walking bot(s) reach A–S: ${c.score}`);
  assert.deepEqual(a.ch.coopDone, ["alch"]);
  assert.ok(a.ch.life.alch.xp > 0 || a.ch.life.alch.lv > 1, "life XP (연금)");
  assert.equal(a.ch.rep.bogle || 0, Object.hasOwn(X.NPC_MAP, "bogle") ? X.COOP_T.rep : 0, "trust with 보글");
  if (n === 1) {
    step(w, X.COOP_T.endMs + 200);
    const bg = X.mapOf("bogle_lab").npcs.find((o) => o.id === "bogle");
    at(a, bg.x * T + 8, bg.y * T + 28);
    const gold = a.ch.gold;
    assert.ok(act(w, "c0", { t: "coop_start", k: "alch" }).ok);
    forgeBot(w);
    assert.equal(a.ch.gold - gold, X.COOP_T.helpTip, "once a day: a helper's tip the second time");
  }
}

// ── leaving mid-shift: no reward, back in the lobby; the empty shift closes in 20 s
{
  const w = world(1), S = w.S, p = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "apt" });
  step(w, 10000);
  const gold = p.ch.gold;
  assert.ok(act(w, "c0", { t: "coop_leave" }).ok);
  assert.equal(p.map, J.lobby);
  assert.ok(p.spdBuff <= w.now, "the shift's speed stays inside");
  step(w, X.COOP_T.emptyMs + 200);
  assert.equal(Object.keys(S.dims).length, 0, "closed when empty");
  assert.equal(p.ch.gold, gold); assert.deepEqual(p.ch.coopDone, []);
  assert.match(act(w, "c0", { t: "coop_leave" }).error, /근무 중이 아닙니다/);
}

// ── a disconnect mid-shift: the shift goes on at the starting size; the one who stayed is paid
{
  const w = world(2), S = w.S;
  act(w, "c0", { t: "coop_start", k: "apt" });
  const c = shiftOf(w).coop;
  step(w, 30000);
  const ch = L.removePlayer(S, "c1");
  assert.ok(ch && ch.coopDone.length === 0);
  assert.equal(c.n, 2, "cut-offs stay at the starting party size");
  botShift(w);
  const cr = lastOf("c0", "cr");
  assert.ok(cr && cr[3].find((r) => r[0] === "알바1")[3] === 0, "the one who left is not eligible");
  assert.ok(X.coopGrade(c) >= 1 ? S.players.c0.ch.coopDone.includes("apt") : true);
  step(w, X.COOP_T.endMs + 200);
  assert.equal(Object.keys(S.dims).length, 0);
}

// ── determinism: the same seed and script give the same score
{
  const run = () => { const w = world(2, 1000, 777); act(w, "c0", { t: "coop_start", k: "apt" }); return botShift(w).score; };
  assert.equal(run(), run());
}

// ── defs, and an old sheet's co-op fields cleaned by migrate
{
  const D = L.defs();
  assert.deepEqual(D.coop.jobs.apt.slice(0, 4), ["동동아파트 청소", 5, ["broom", "bin"], 1000]);
  assert.deepEqual(D.coop.cuts, [0.3, 0.5, 0.7, 0.88]);
  const S = L.setup(), old = L.newChar("옛알바", []);
  delete old.coopDay; delete old.coopDone; old.v = 11;
  L.addPlayer(S, "o", old);
  assert.deepEqual([S.players.o.ch.coopDay, S.players.o.ch.coopDone], [0, []]);
  const bad = L.newChar("엉망", []); bad.coopDay = "x"; bad.coopDone = ["apt", "apt", "zzz"];
  L.addPlayer(S, "b", bad);
  assert.deepEqual([S.players.b.ch.coopDay, S.players.b.ch.coopDone], [0, ["apt"]]);
  // an old sheet without the co-op counters starts them at 0
  const oc = L.newChar("옛카운터", []);
  for (const k of ["coop", "coopS_apt", "coopS_diner", "coopS_forge", "coopS_alch"]) delete oc.cnt[k];
  L.addPlayer(S, "oc", oc);
  assert.deepEqual(["coop", "coopS_apt", "coopS_alch"].map((k) => S.players.oc.ch.cnt[k]), [0, 0, 0]);
}

// ── S-grade rewards: the first S in a job gives its achievement and cosmetic once; 20 shifts give 「단골 알바생」
{
  const w = world(1), S = w.S, p = S.players.c0, ch = p.ch;
  X.coopPay(S, p, { k: "diner" }, 3);
  assert.equal(ch.cnt.coop, 1); assert.equal(ch.cnt.coopS_diner, 0); assert.ok(!ch.ach.includes("coopS_diner"), "A is not S");
  X.coopPay(S, p, { k: "diner" }, 4);
  assert.equal(ch.cnt.coopS_diner, 1); assert.ok(ch.ach.includes("coopS_diner"));
  assert.ok(ch.cos.own.includes("back_tray"), "the S cosmetic");
  X.coopPay(S, p, { k: "diner" }, 4);
  assert.equal(ch.cos.own.filter((id) => id === "back_tray").length, 1, "only once");
  assert.equal(ch.ach.filter((id) => id === "coopS_diner").length, 1);
  for (const [k, id] of [["apt", "hat_kerchief"], ["forge", "face_forge"], ["alch", "back_cauldron"]]) {
    X.coopPay(S, p, { k }, 4);
    assert.ok(ch.ach.includes("coopS_" + k) && ch.cos.own.includes(id), k);
  }
  assert.ok(!ch.ach.includes("coop20"));
  while (ch.cnt.coop < 20) X.coopPay(S, p, { k: "apt" }, 0);
  assert.ok(ch.ach.includes("coop20"), "20 shifts");
  // a saved sheet keeps them: migrate re-grants an achievement's cosmetic
  const back = L.newChar("복원", []); back.ach = ["coopS_forge"];
  L.addPlayer(S, "r", back);
  assert.ok(S.players.r.ch.cos.own.includes("face_forge"));
}

console.log("coop: ok");
