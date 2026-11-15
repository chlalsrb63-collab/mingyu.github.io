// Headless test of 협동 아르바이트 (docs/design/life-and-coop.md C, H7–H9): party-only (2–4; a solo start refused), 동동아파트 청소
// by parties of 2–4, the template, sweeping / bins / chutes, the two-person sofa, the spread and the
// complaints, failing on the clock, a bot clearing it, daily rewards and unpaid replays, leaving, a disconnect
// mid-shift, cleanup, determinism, the wire and an old sheet's migration; 쥬쥬식당 서빙; 캉캉대장간 단조 v2 (each piece's rhythm
// pattern judged, flips, 갑옷's answers, reheating, the 진열대 and its customers, the latency calibration, walking bots 2–4 at a
// human-ish accuracy); 보글연금공방 가마 v2 (its big hall, 풀무 notes per direction, 합동 풀무, bands per recipe, boil-overs and the fan, herb order, the shop, walking bots 2–4). node tests/coop.mjs [-v] [--tune]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { COOP, COOP_T, COOP_APT, coopCut, coopGrade, dayOf, mapOf, tilePx, NPC_MAP, lifeNeed, stats, COOP_DINER, COOP_FORGE, COOP_BREW, COOP_JOB, forgeCustomer, forgeKind, forgeOpen, brewGrade, coopPay };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16, J = X.COOP.apt, A = X.COOP_APT;
const VERBOSE = process.argv.includes("-v"), TUNE = process.argv.includes("--tune");   // --tune: log the bot scores without the cut-off asserts
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
function rewardState({ ch }) {
  const { gold, lvl, xp, xpt, life, inv, rep, cnt, ach, cos } = ch;
  return structuredClone({ gold, lvl, xp, xpt, life, inv, rep, cnt, ach, cos });
}
// where a worker stands to use each station (the tile beside it, in the corridor)
const RACK = [J.st.rack[0] - 1, J.st.rack[1]], BURN = [J.st.burn[0] + 1, J.st.burn[1]], RECY = [J.st.recycle[0] - 1, J.st.recycle[1]];

// ── the template: stations, start tiles and every flat reachable
{
  const w = world(2), p = w.S.players.c0;
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
  // party-only: alone, or a party whose other member is not in the lobby, is refused with the reason
  assert.match(act(world(1), "c0", { t: "coop_start", k: "apt" }).error, /2명 이상 파티로만/, "no solo shift");
  L.runtime(w.S, p1.map).n--; p1.map = "town"; L.runtime(w.S, "town").n++;
  { const dd = X.mapOf(J.lobby).npcs.find((o) => o.id === "dongdong"); at(w.S.players.c0, dd.x * T + 8, dd.y * T + 28); }
  assert.match(act(w, "c0", { t: "coop_start", k: "apt" }).error, /2명 이상 파티로만.*이 방에/, "the other member must be in the lobby");
  const w2 = world(2);
  assert.ok(act(w2, "c0", { t: "coop_start", k: "apt" }).ok);
  assert.match(act(w2, "c0", { t: "coop_act" }).error, /곧 근무가 시작/, "nothing during the briefing");
}

// ── one worker does it all (the other stands by): sweep a pile into a bundle, swap tools at the rack, bin it, burn it
{
  const w = world(2), S = w.S, p = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "apt" });
  const dim = shiftOf(w), c = dim.coop;
  assert.deepEqual([c.n, c.pl.c0.tool, c.state], [2, "broom", "brief"]);
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
  const before = rewardState(a);
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
  assert.equal(cr[3][0][3], 1, "contributed to the failed shift");
  assert.equal(a.ch.coopDone.length, 0, "a fail doesn't use up the day");
  assert.deepEqual(rewardState(a), before, "a failed shift pays nothing and adds no progression");
  assert.equal(cr[5], 0, "report an unpaid shift");
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
function botShift(w, idle = [], MS = 300) {
  const S = w.S, dim = shiftOf(w), c = dim.coop, W = walker(dim);
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

// ── a bot party clears it; rewards once a day; the same party can replay; the next day pays again
{
  const w = world(2), S = w.S, [a, b] = [S.players.c0, S.players.c1];
  act(w, "c0", { t: "coop_start", k: "apt" });
  const c = botShift(w), g = X.coopGrade(c);
  log("duo bot score", c.score, "grade", g, "cuts", [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  assert.ok(g >= 3, `a steady duo reaches A or S: ${c.score}`);
  const cr = lastOf("c0", "cr");
  assert.equal(cr[0], g); assert.equal(cr[1], Math.round(c.score)); assert.equal(cr[3].length, 2); assert.equal(cr[5], 1);
  assert.ok(cr[3].every((r) => r[3] === 1), "both eligible");
  assert.deepEqual(a.ch.coopDone, ["apt"]); assert.equal(a.ch.coopDay, X.dayOf(w.now));
  assert.ok(a.ch.inv.some((s) => s.id === "stone"), "강화석");
  assert.ok(a.ch.gold >= Math.round(X.COOP_T.base.gold * X.COOP_T.gradeK[g - 1]), "the day's pay × the grade's share");
  assert.equal(a.ch.cos.tokens, 2, "the first qualified shift earns two Willow tokens");
  assert.equal(a.ch.rep.dongdong || 0, Object.hasOwn(X.NPC_MAP, "dongdong") ? X.COOP_T.rep : 0, "trust with 동동");
  assert.ok(a.ch.life.deliver.xp > 0 || a.ch.life.deliver.lv > 1, "life XP (배달)");
  assert.deepEqual(L.viewFor(S, "c0").self?.coop ?? a.ch.coopDone, ["apt"]);
  // again the same day: play without rewards
  step(w, X.COOP_T.endMs + 200);
  const before = [rewardState(a), rewardState(b)];
  const stones = a.ch.inv.filter((s) => s.id === "stone").reduce((n, s) => n + s.n, 0);
  for (const o of [a, b]) { const dd = X.mapOf(J.lobby).npcs.find((q) => q.id === "dongdong"); at(o, dd.x * T + 8, dd.y * T + 28); }
  const nl = act(w, "c1", { t: "coop_start", k: "apt" });
  assert.ok(!nl.ok && /파티장만/.test(nl.error), "only the leader starts: " + nl.error);
  assert.ok(act(w, "c0", { t: "coop_start", k: "apt" }).ok);
  botShift(w);
  assert.deepEqual([rewardState(a), rewardState(b)], before, "same-day replays add no rewards or progression");
  assert.equal(lastOf("c0", "cr")[5], 2);
  assert.equal(lastOf("c1", "cr")[5], 2);
  // the next day pays again
  step(w, X.COOP_T.endMs + 200);
  w.now += DAY;
  for (const o of [a, b]) { const dd = X.mapOf(J.lobby).npcs.find((q) => q.id === "dongdong"); at(o, dd.x * T + 8, dd.y * T + 28); }
  const r3 = act(w, "c0", { t: "coop_start", k: "apt" }); const c3 = shiftOf(w) && shiftOf(w).coop;
  botShift(w);
  log("day 2", JSON.stringify(r3), c3 && c3.score, c3 && Object.values(c3.pl).map((q) => [q.pts, q.ok]));
  assert.equal(a.ch.coopDay, X.dayOf(w.now)); assert.deepEqual(a.ch.coopDone, ["apt"]);
  assert.ok(a.ch.inv.filter((s) => s.id === "stone").reduce((n, s) => n + s.n, 0) > stones, "a new day's pay");
  assert.equal(a.ch.cos.tokens, 4, "the next day's qualified shift rewards tokens again");
}

// ── a worker who already claimed the reward can play alongside a friend who has yet to claim it
{
  const w = world(2), [a, b] = [w.S.players.c0, w.S.players.c1];
  X.coopPay(w.S, a, { k: "apt" }, 1);
  const before = rewardState(a), friendGold = b.ch.gold;
  assert.ok(act(w, "c0", { t: "coop_start", k: "apt" }).ok);
  botShift(w);
  const replay = lastOf("c0", "cr"), first = lastOf("c1", "cr");
  assert.ok(replay[3].every((r) => r[3] === 1), "both workers contributed");
  assert.equal(replay[5], 2);
  assert.equal(first[5], 1);
  assert.deepEqual(rewardState(a), before, "the previously paid party leader earns nothing");
  assert.ok(b.ch.gold > friendGold, "the friend still earns the day's pay");
  assert.deepEqual(b.ch.coopDone, ["apt"]);
}

// ── walking bots at player speed, 1–4 workers: the opening mess and the spawn rate grow with the party; the cut-offs
// are set so these bots land on A–S (a real party, slower to decide, lands on B–A)
for (const n of [2, 3, 4]) {
  const w = world(n);
  act(w, "c0", { t: "coop_start", k: "apt" });
  const c = shiftOf(w).coop;
  assert.equal(c.ents.filter((e) => e.t === 0).length, A.open[0] + A.open[1] * n, `${n}: the opening piles`);
  botShift(w);
  log(`apt ${n}: score`, c.score, "grade", X.coopGrade(c), [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  if (!TUNE) assert.ok(X.coopGrade(c) === 4 && c.score < X.coopCut(c, 3) * 1.25, `${n} walking bots just over S (heroes 15 % faster): ${c.score} vs ${X.coopCut(c, 3)}`);
  // hard (owner, 2026-11-15): a realistic party, slower to decide (an act every 400 ms), lands on B–A; only quick bots reach S
  const w2 = world(n); act(w2, "c0", { t: "coop_start", k: "apt" });
  const c2 = botShift(w2, [], 400);
  log(`apt ${n} realistic: score`, Math.round(c2.score), "grade", X.coopGrade(c2));
  // shortcut: a duo is bound by the order rate (quick and realistic both ≈ 400, S), not by speed; separate it when the duo gets its own tuning
  if (!TUNE && n > 2) assert.ok(X.coopGrade(c2) >= 2 && X.coopGrade(c2) <= 3, `${n} realistic bots land B–A: ${Math.round(c2.score)}`);
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
  const w = dworld(2), p = w.S.players.c0;
  assert.ok(act(w, "c0", { t: "coop_start", k: "diner" }).ok, "the diner opens at 쥬쥬");
  const dim = shiftOf(w), m = dim.map, open = m.reach.reduce((n, v) => n + v, 0);
  log("diner open tiles", open);
  assert.deepEqual([m.w, m.h, m.safe], [64, 36, true]);
  for (const r of [...JD.tpl.ground, ...JD.tpl.objects]) assert.equal(r.length, 64);
  assert.ok(open >= 2 * 832, `a big hall, twice the old 44×24 (832 open tiles): ${open}`);
  assert.equal(JD.tables.length, 20);
  const usable = ([x, y]) => m.solid[y * m.w + x] && [[1, 0], [-1, 0], [0, -1], [0, 1]].some(([dx, dy]) => m.reach[(y + dy) * m.w + x + dx]);
  for (const k of Object.keys(JD.st)) for (const t of Array.isArray(JD.st[k][0]) ? JD.st[k] : [JD.st[k]]) assert.ok(usable(t), `${k} ${t} usable`);
  for (const t of JD.tables) assert.ok(usable(t) && m.reach[(t[1] - 1) * m.w + t[0]], `table ${t}`);
  assert.equal(dim.coop.pl.c0.tool, "pan");
  assert.equal(p.map, dim.id);
}

// ── one worker (the other stands by): a salad from crate to table, the wrong dish refused, a pot that burns, a customer who leaves angry
{
  const w = dworld(2), S = w.S, p = S.players.c0;
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
  assert.ok(orders.length >= 1 && orders.length <= R.seats[2], `orders: ${orders.length}`);
  const wrong = orders.find((e) => e.r !== 0);
  if (wrong) { step(w, 1300); atTile(p, above(JD.tables[wrong.ti])); act(w, "c0", { t: "coop_act" }); assert.ok(p.toast.some((m) => /주문과 다른/.test(m)), "the wrong table says so"); }
  let salad = c.ents.find((e) => e.t === 3 && e.r === 0);
  if (!salad) { salad = { id: 9999, t: 3, r: 0, ti: 11, x: X.tilePx(JD.tables[11])[0], y: X.tilePx(JD.tables[11])[1], until: w.now + 60000, pat: 60000 }; c.ents.push(salad); }
  const before = c.score; step(w, 300); atTile(p, above(JD.tables[salad.ti])); act(w, "c0", { t: "coop_act" });
  assert.ok(!c.ents.includes(salad) && c.score > before && c.served === 1, `served: ${c.score - before}`);
  assert.ok(c.score - before >= R.dishes[0].pts, "at least the dish's points");
  log("diner alone, burnt", s0, "→ served", c.score);
  // nobody serves now: someone leaves angry
  const miss = c.miss; step(w, R.patience[2] + 1000);
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
  const w = dworld(2), p = w.S.players.c0;
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
function dinerBot(w, MS = 300, spdK = 1) {
  const S = w.S, dim = shiftOf(w), c = dim.coop, W = walker(dim), D = R.dishes;
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
    const short = JD.tables.length - orders.length - c.ents.filter((e) => e.t === 9 && e.ti >= 0).length < R.seats[c.n] + 2;
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
      if (W.go(o, goal, MS * spdK)) act0(w, o.pid);
    }
    step(w, MS);
  }
  return c;
}

// ── walking bots 2–4: tables, the order rate and patience scale with the party; the cut-offs land them on A–S
for (const n of [2, 3, 4]) {
  const w = dworld(n), S = w.S;
  act(w, "c0", { t: "coop_start", k: "diner" });
  const c = shiftOf(w).coop;
  assert.deepEqual(w.pids.map((pid) => c.pl[pid].tool), ["pan", "tray", "pan", "tray"].slice(0, n));
  dinerBot(w);
  log(`diner ${n}: score`, Math.round(c.score), "served", c.served, "missed", c.miss, "grade", X.coopGrade(c), [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  if (!TUNE) assert.ok(X.coopGrade(c) === 4 && c.score < X.coopCut(c, 3) * 1.25, `${n} walking bots just over S (heroes 15 % faster): ${Math.round(c.score)} vs ${X.coopCut(c, 3)}`);
  // rewards: the day's pay once (cook life XP, trust with 쥬쥬), the report card
  const a = S.players.c0, cr = lastOf("c0", "cr");
  assert.equal(cr[0], X.coopGrade(c)); assert.equal(cr[3].length, n);
  assert.deepEqual(a.ch.coopDone, ["diner"]);
  assert.ok(a.ch.life.cook.xp > 0 || a.ch.life.cook.lv > 1, "life XP (요리)");
  assert.ok(a.ch.inv.some((s) => s.id === "stone"), "강화석");
  if (n === 4) {
    // the same day again: unpaid replay
    step(w, X.COOP_T.endMs + 200);
    const jj = X.mapOf(JD.lobby).npcs.find((o) => o.id === "juju");
    for (const pid of w.pids) at(S.players[pid], jj.x * T + 8, jj.y * T + 28);
    const gold = a.ch.gold;
    assert.ok(act(w, "c0", { t: "coop_start", k: "diner" }).ok);
    dinerBot(w);
    assert.equal(a.ch.gold, gold, "diner replay is unpaid");
    assert.equal(lastOf("c0", "cr")[5], 2);
    assert.deepEqual(a.ch.coopDone, ["diner"]);
  }
  // hard (owner, 2026-11-15): a realistic party (an act every 600 ms, walking at 90 %) lands on B–A
  const w2 = dworld(n); act(w2, "c0", { t: "coop_start", k: "diner" });
  const c2 = shiftOf(w2).coop; dinerBot(w2, 600, 0.9);
  log(`diner ${n} realistic: score`, Math.round(c2.score), "grade", X.coopGrade(c2));
  // realistic: slower to act and 90 % of the walking pace (human detours); in the big hall the walking, not the kitchen, bounds the bots
  // shortcut: a duo is bound by the order rate (quick and realistic both ≈ 400, S), not by speed; separate it when the duo gets its own tuning
  if (!TUNE && n > 2) assert.ok(X.coopGrade(c2) >= 2 && X.coopGrade(c2) <= 3, `${n} realistic bots land B–A: ${Math.round(c2.score)}`);
}

// ── the diner's numbers grow with the party
for (const n of [3, 4]) {
  assert.ok(R.seats[n] > R.seats[n - 1] && R.orderMs[n] < R.orderMs[n - 1] && R.patience[n] <= R.patience[n - 1], "harder with more hands");
  assert.ok(X.COOP_APT.pileMs[n] < X.COOP_APT.pileMs[n - 1], "the apartment too");
}
assert.ok(!(1 in X.COOP_T.parN) && ["apt", "diner", "forge", "alch"].every((k) => !(1 in X.COOP[k].parN)), "no solo row");

// ───────────────────────────── 캉캉대장간 단조 v2 (C.6, H8) ─────────────────────────────

const JF = X.COOP.forge, F = X.COOP_FORGE;
/** A world with `n` players by 캉캉 in his forge (k "alch": by 보글 in her lab; one party when n ≥ 2). */
function fworld(n, t0 = 1000, seed = 20251111, k = "forge") {
  const JK = X.COOP[k], w = world(n, t0, seed), kk = X.mapOf(JK.lobby).npcs.find((o) => o.id === JK.npc);
  for (const pid of w.pids) { const p = w.S.players[pid]; L.runtime(w.S, p.map).n--; p.map = JK.lobby; L.runtime(w.S, JK.lobby).n++; at(p, kk.x * T + 8, kk.y * T + 12 + 16); }
  return w;
}
const left = ([x, y]) => [x - 1, y];
const fEnt = (c, t, i) => c.ents.find((e) => e.t === t && (t === 6 ? e.fi : e.ai) === i);
const noteAt = (a, i) => a.beat0 + F.orders[a.pc.r].pat[i][0] * a.per;
/** Act at an exact time (between two ticks): a blow (d −1) or a flip. */
const actAt = (w, pid, t, d = -1) => { const s = w.now; w.now = t; const v = act(w, pid, d >= 0 ? { t: "coop_act", d } : { t: "coop_act" }); w.now = s; return v; };
/** A hot piece of kind r straight onto anvil `ai` by the tongs holder (its lane starts). */
function place(w, c, pid, ai, r, m = 0) {
  const p = w.S.players[pid], q = c.pl[pid];
  q.hold = [{ r, m, q: 0, n: 0, heat: 100, hot: w.now + 10000, heats: 1, st: "bar", ct: { [pid]: 1 }, ch: {} }];
  atTile(p, above(JF.st.anvil[ai])); q.actAt = 0;
  assert.ok(act0(w, pid).ok); const a = fEnt(c, 7, ai);
  assert.ok(a.pc && a.pc.r === r, "placed");
  return a;
}

// ── the map; a party of two: crate → furnace (pumped into the band) → anvil; the lane's first note, the beat ring
{
  const w = fworld(2), S = w.S, p = S.players.c0, p1 = S.players.c1;
  assert.ok(act(w, "c0", { t: "coop_start", k: "forge" }).ok, "the forge opens at 캉캉 for a party");
  const dim = shiftOf(w), m = dim.map, c = dim.coop, q = c.pl.c0;
  assert.deepEqual([m.w, m.h, m.safe, m.portals.length], [64, 44, true, 0], "the big hall");
  for (const r of [...JF.tpl.ground, ...JF.tpl.objects]) assert.equal(r.length, 64);
  assert.ok(JF.st.crate.length === 4 && JF.st.anvil.length >= 3 && JF.st.furnace.length === 2 && JF.st.quench.length === 2, "4 ingot crates, 2 furnaces, 3–4 anvils, 2 barrels");
  assert.ok(JF.st.shelf[0][0] - Math.max(...JF.st.quench.map((t) => t[0])) >= 10, "the 진열대 is a walk from the barrels");
  const usable = ([x, y]) => m.solid[y * m.w + x] && [[1, 0], [-1, 0], [0, -1], [0, 1]].some(([dx, dy]) => m.reach[(y + dy) * m.w + x + dx]);
  for (const k of Object.keys(JF.st)) for (const t of Array.isArray(JF.st[k][0]) ? JF.st[k] : [JF.st[k]]) assert.ok(usable(t), `${k} ${t} usable`);
  for (const t of [...JF.start, ...JF.seats, JF.door]) assert.ok(m.reach[t[1] * m.w + t[0]], `open ${t}`);
  assert.equal(JF.st.shelf.length, JF.seats.length);
  assert.deepEqual([q.tool, c.pl.c1.tool], ["tongs", "hammer"]);
  step(w, X.COOP_T.briefMs + 1600);
  assert.ok(c.ents.filter((e) => e.t === 8).length >= 1, "customers on the way");
  const want = X.forgeOpen(c)[0];
  atTile(p, below(JF.st.crate[want.m])); assert.ok(act0(w, "c0").ok); assert.ok(q.hold.length === 1 && q.hold[0].m === want.m, "the order's ingot from its crate");
  step(w, 300); atTile(p, below(JF.st.furnace[0])); act0(w, "c0");
  const f = fEnt(c, 6, 0);
  assert.ok(f.bars[0] && !q.hold.length, "in the fire");
  for (let i = 0; i < 60 && f.bars[0].heat < 100; i++) { step(w, 300); if (f.T < 72) act0(w, "c0"); }
  assert.equal(f.bars[0].heat, 100, "hot");
  step(w, 300); act0(w, "c0"); assert.ok(q.hold[0].hot > w.now, "taken out hot");
  step(w, 300); atTile(p, above(JF.st.anvil[0])); act0(w, "c0");
  const a = fEnt(c, 7, 0), pc = a.pc;
  assert.ok(pc && pc.r === want.r && pc.m === want.m, "on the anvil, made for the waiting customer");
  assert.equal(noteAt(a, 0), w.now + F.leadMs, "the first note a second after placing");
  step(w, 100); assert.ok(views.c1.slice(-2).some((v) => (v.ev || []).some((e) => e[0] === "cb" && e[1] === a.id && e[2] === F.leadMs)), "the beat ring event");
  // the hammer stands at the anvil: on the lane (a shorter act gate), a direction key elsewhere does nothing
  atTile(p1, below(JF.st.anvil[0]));
  assert.ok(X.COOP_JOB.forge.lane(S, c, p1, c.pl.c1), "on the lane");
  assert.ok(!X.COOP_JOB.forge.lane(S, c, p, q), "the tongs are not (no 갑옷)");
  const C = (p1.cVer = -1, step(w, 100), lastOf("c1", "C"));
  const row = C.find((r) => r[0] === a.id);
  assert.equal(row.length, 12, "anvil row: v1 fields + beat 0 + heat left + ingot");
  assert.equal(row[11], want.m);
  assert.ok(Math.abs(row[9] - (a.beat0 - w.now)) <= 100 && row[10] > 0);
  assert.ok(C.some((r) => r[1] === 6 && r.length === 5 + 2 * F.slots) && C.filter((r) => r[1] === 8).every((r) => r.length === 11 && r[10] >= 0 && r[10] < 4), "furnace and customer rows (+ ingots)");
  assert.equal(lastOf("c1", "cj")[0], 2, "forge is job index 2");
}

// ── every piece's pattern judged: on the note perfect (+2), 200 ms off good (+1), unplayed a miss (−1); flips need their arrow;
// 갑옷's answers come from another worker (the tongs, hands empty)
for (let r = 0; r < F.orders.length; r++) {
  const w = fworld(2), S = w.S;
  act(w, "c0", { t: "coop_start", k: "forge" });
  const c = shiftOf(w).coop, P = F.orders[r].pat;
  step(w, X.COOP_T.briefMs + 200);
  const a = place(w, c, "c0", 1, r), pc = a.pc;
  atTile(S.players.c1, below(JF.st.anvil[1]));
  const duet = P.some((n) => n[1] === 1);
  // the note to get wrong: the first flip (struck plainly), else the third (갑옷: a call by the answerer; else with an arrow)
  const flip = P.findIndex((n) => n[1] >= 2), bad = flip >= 0 ? flip : 2, judged = [];
  for (let i = 0; i < P.length; i++) {
    const note = P[i][1], who = note === 1 ? "c0" : "c1", d = note >= 2 ? note - 2 : -1, q0 = pc.q;
    for (const qq of Object.values(c.pl)) qq.offs = [];   // judging only, no calibration here
    if (i === 1) actAt(w, who, noteAt(a, i) + 200, d);                                                    // late: good
    else if (i === bad) actAt(w, duet ? (who === "c1" ? "c0" : "c1") : who, noteAt(a, i), flip >= 0 ? -1 : duet ? -1 : 0);
    else actAt(w, who, noteAt(a, i), d);
    judged.push(pc.q - q0);
  }
  log("forge pattern", X.COOP.forge.skin.orders[r], judged, pc.st);
  assert.equal(judged[0], 2, `${r}: on the note, perfect`);
  assert.equal(judged[1], 1, `${r}: 200 ms late, good`);
  assert.equal(judged[bad], -1, `${r}: the wrong key or the wrong worker, a miss`);
  assert.ok(judged.every((v, i) => i < 2 || i === bad || v === 2), `${r}: the rest perfect (flips with their arrow)`);
  assert.equal(pc.st, "shaped", "the last note shapes it");
  assert.equal(pc.n, P.length);
}
// the patterns differ: lengths, tempos, flips and answers
{
  const sig = F.orders.map((o) => [o.pat.length, o.per, o.pat.filter((n) => n[1] >= 2).length, o.pat.filter((n) => n[1] === 1).length].join());
  assert.equal(new Set(sig).size, F.orders.length, "every piece plays its own way");
  const gaps = F.orders.flatMap((o) => o.pat.slice(1).map((n, i) => (n[0] - o.pat[i][0]) * o.per * F.feverK));
  const dear = Math.min(...F.metals.map((o) => o.tempo));
  assert.ok(Math.min(...gaps) * dear > F.laneMs * 2.5, "notes never closer than the lane gate allows (the dearest ingot's tempo too)");
  assert.deepEqual(F.orders[4].pat.filter((n) => n[1] >= 2).map((n) => n[1]), [4], "냄비: a ↓ flip halfway");
  const gl = F.orders[2].pat.slice(1).map((n, i) => n[0] - F.orders[2].pat[i][0]);
  assert.ok(gl[0] > gl.at(-1), "검날 speeds up");
}

// ── unplayed notes cool the bar: the hammer can't go on, the tongs reheat it (from 50), and the pattern goes on where it stopped
{
  const w = fworld(2), S = w.S, p = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "forge" });
  const c = shiftOf(w).coop, q = c.pl.c0;
  step(w, X.COOP_T.briefMs + 200);
  const a = place(w, c, "c0", 2, 0), pc = a.pc;
  while (pc.hot && w.now < a.beat0 + 20000) step(w, 100);
  assert.ok(pc.st === "bar" && !pc.hot && pc.n > 0 && pc.n < F.orders[0].pat.length, `cooled mid-pattern after ${pc.n} misses`);
  assert.ok(pc.q < 0, "the misses cost quality");
  atTile(S.players.c1, below(JF.st.anvil[2])); step(w, 300); act0(w, "c1");
  assert.ok(S.players.c1.toast.some((m) => /식었어요/.test(m)), "the hammer is told to wait for the tongs");
  q.actAt = 0; act0(w, "c0"); assert.ok(q.hold[0] === pc && !a.pc, "the tongs take it back");
  step(w, 300); atTile(p, below(JF.st.furnace[1])); act0(w, "c0");
  const f = fEnt(c, 6, 1);
  assert.equal(f.bars.find(Boolean).heat, F.reheat, "a reheat starts warm");
  const n0 = pc.n;
  f.bars[f.bars.indexOf(pc)].heat = 100; step(w, 300); act0(w, "c0");
  step(w, 300); atTile(p, above(JF.st.anvil[2])); act0(w, "c0");
  assert.ok(a.pc === pc && pc.hot > w.now && noteAt(a, n0) === w.now + F.leadMs, "back on the lane at the note it stopped");
}

// ── the 진열대: quench, shelve, a customer who wants it buys it once (best grade first), another waits; one left too long goes angry
{
  const w = fworld(2), S = w.S, p1 = S.players.c1;
  act(w, "c0", { t: "coop_start", k: "forge" });
  const c = shiftOf(w).coop, q1 = c.pl.c1;
  step(w, X.COOP_T.briefMs + 200);
  c.ents = c.ents.filter((e) => e.t !== 8); c.next.order = 1e15;
  const piece = (r, qq) => ({ r, q: qq, n: F.orders[r].pat.length, heat: 100, hot: 0, heats: 1, st: "quenched", ct: { c0: 1 }, ch: { c1: 1 } });
  // not quenched yet: the shelf waits
  q1.hold = [{ ...piece(0, 12), st: "shaped" }]; atTile(p1, left(JF.st.shelf[0])); act0(w, "c1");
  assert.equal(c.ents.filter((e) => e.t === 10).length, 0, "only quenched pieces go on show");
  step(w, 300); atTile(p1, below(JF.st.quench[0])); act0(w, "c1"); assert.equal(q1.hold[0].st, "quenched");
  step(w, 300); atTile(p1, left(JF.st.shelf[3])); assert.ok(act0(w, "c1").ok);
  q1.hold = [piece(0, 3)]; step(w, 300); act0(w, "c1");
  const shelf = c.ents.filter((e) => e.t === 10);
  assert.deepEqual(shelf.map((e) => e.slot), [0, 1], "the first free slots");
  // a customer for 편자 walks in from the door, looks, buys the better one: 걸작 (q 12 ≥ 1.6 · 6)
  const X0 = X.tilePx(JF.door);
  X.forgeCustomer(S, shiftOf(w), c, w.now);
  const cu = c.ents.find((e) => e.t === 8);
  assert.equal(cu.r, 0, "a new customer wants what is on the shelf");
  assert.ok(cu.at > w.now && cu.at - w.now === Math.round((Math.hypot(cu.x - X0[0], cu.y - X0[1]) / F.walk) * 1000), "walks in");
  const s0 = c.score, sold0 = c.done;
  step(w, cu.at - w.now + F.browseMs - 200);
  assert.equal(c.done, sold0, "still looking");
  step(w, 300);
  assert.equal(c.done, sold0 + 1, "bought");
  assert.equal(cu.gone, 1);
  const left1 = c.ents.filter((e) => e.t === 10);
  assert.ok(left1.length === 1 && left1[0].pc.q === 3, "the 걸작 went, the other stays");
  const pts = c.score - s0;
  assert.ok(pts >= Math.round(F.orders[0].pts * F.grades[0][1] * (1 + F.timeK * 0.9)), `paid by grade and patience: ${pts}`);
  assert.ok(c.pl.c0.pts > 0 && c.pl.c1.pts > c.pl.c0.pts, "tongs 45 % / hammer 55 %");
  step(w, 2000); assert.equal(c.done, sold0 + 1, "a customer buys once");
  p1.cVer = -1; step(w, 100);
  const rows = lastOf("c1", "C");
  assert.ok(rows.some((r) => r[0] === cu.id && r[8] === 1) && rows.some((r) => r[1] === 10 && r.length === 6 && r[5] === 2), "a leaving customer, a 중 piece on show");
  step(w, F.leaveMs + 100); assert.ok(!c.ents.includes(cu), "gone out the door");
  // a customer for a piece nobody makes leaves angry: −20, combo 0
  c.ents = c.ents.filter((e) => e.t !== 10);
  X.forgeCustomer(S, shiftOf(w), c, w.now);
  const late = c.late, s1 = c.score; step(w, F.deadMs + 200);
  assert.ok(c.late === late + 1 && c.score === Math.max(0, s1 - F.latePen) && c.combo === 0, "angry");
  // a full shelf refuses more
  for (let i = 0; i < JF.st.shelf.length; i++) c.ents.push({ id: 900 + i, t: 10, x: 0, y: 0, slot: i, pc: piece(1, 0) });
  q1.hold = [piece(0, 0)]; step(w, 300); q1.hintAt = 0; act0(w, "c1");
  assert.ok(q1.hold.length === 1 && p1.toast.some((m) => /진열대가 꽉/.test(m)), "full");
}

// ── ingots (owner): the order's colour names its ingot; each crate gives its own, a wrong one is refused at the anvil with a
// hint; dearer ingots heat longer, play faster with tighter windows, and sell for more
{
  const w = fworld(2), S = w.S, p = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "forge" });
  const dim = shiftOf(w), c = dim.coop, q = c.pl.c0, M = F.metals;
  step(w, X.COOP_T.briefMs + 200);
  c.ents = c.ents.filter((e) => e.t !== 8); c.next.order = 1e15;
  assert.deepEqual(M.map((o) => o.name), ["철주괴", "은주괴", "금주괴", "미스릴주괴"]);
  for (let i = 1; i < 4; i++) assert.ok(M[i].heat > M[i - 1].heat && M[i].price > M[i - 1].price && M[i].tempo < M[i - 1].tempo && M[i].win < M[i - 1].win, `ingot ${i} dearer and harder`);
  for (let m = 0; m < 4; m++) {
    atTile(p, below(JF.st.crate[m])); q.actAt = 0;
    assert.ok(act0(w, "c0").ok && q.hold[0].m === m, `crate ${m} gives ${M[m].name}`);
    step(w, 300); assert.ok(act0(w, "c0").ok && !q.hold.length, "a cold ingot goes back in its crate");
    step(w, 300);
  }
  // a customer for 금빛 투구: an iron bar is refused with the hint, a gold one is made into it
  const [sx, sy] = X.tilePx(JF.seats[0]);
  c.ents.push({ id: 990, t: 8, x: sx, y: sy, r: 3, m: 2, until: w.now + 60000, dur: 60000, at: w.now, spot: 0, gone: 0, goneAt: 0 });
  const bar = (m) => ({ r: -1, m, q: 0, n: 0, heat: 100, hot: w.now + 10000, heats: 1, st: "bar", ct: { c0: 1 }, ch: {} });
  q.hold = [bar(0)]; atTile(p, above(JF.st.anvil[0])); q.actAt = 0; q.hintAt = 0; act0(w, "c0");
  assert.ok(q.hold.length === 1 && !fEnt(c, 7, 0).pc, "refused");
  assert.ok(p.toast.some((t) => /이 주문엔 금주괴가 필요해요/.test(t) && /금빛 투구/.test(t)), "with the ingot the order needs");
  q.hold = [bar(2)]; step(w, 300); act0(w, "c0");
  const a = fEnt(c, 7, 0);
  assert.ok(a.pc && a.pc.r === 3 && a.pc.m === 2, "made into the gold helmet");
  assert.equal(a.per, Math.round(F.orders[3].per * M[2].tempo), "a dearer ingot plays faster");
  // heat time in a furnace held in its band: ×heat per ingot
  const f = fEnt(c, 6, 0), heatMs = (m) => { f.bars = [{ ...bar(m), heat: 0, hot: 0 }, null]; let ms = 0; while (f.bars[0].heat < 100 && ms < 60000) { f.T = 70; step(w, 100); ms += 100; } return ms; };
  const h0 = heatMs(0), h3 = heatMs(3);
  log("heat ms iron, mithril", h0, h3);
  assert.ok(Math.abs(h0 - 100000 / F.heatIn) <= 200 && Math.abs(h3 / h0 - M[3].heat) < 0.06, `heat ${h0} · ${h3}`);
  f.bars = [null, null];
  // price: the same 걸작 편자 in iron and in mithril, sold to customers who came for it
  const sell = (m) => {
    c.ents = c.ents.filter((e) => e.t !== 8 && e.t !== 10); c.combo = 0; c.comboAt = -1e9;
    c.ents.push({ id: 991 + m, t: 10, x: 0, y: 0, slot: 0, pc: { r: 0, m, q: 12, n: 6, heat: 100, hot: 0, heats: 1, st: "quenched", ct: { c0: 1 }, ch: { c1: 1 } } });
    c.ents.push({ id: 995 + m, t: 8, x: sx, y: sy, r: 0, m, until: w.now + 60000, dur: 60000, at: w.now - F.browseMs, spot: 0, gone: 0, goneAt: 0 });
    const s0 = c.score; step(w, 100); return c.score - s0;
  };
  const pI = sell(0), pM = sell(3);
  assert.ok(pI > 0 && Math.abs(pM / pI - M[3].price) < 0.05, `mithril sells for ${M[3].price}×: ${pI} · ${pM}`);
  // a customer only buys the ingot they came for
  c.ents.push({ id: 999, t: 10, x: 0, y: 0, slot: 0, pc: { r: 0, m: 1, q: 12, n: 6, heat: 100, hot: 0, heats: 1, st: "quenched", ct: {}, ch: {} } });
  c.ents.push({ id: 998, t: 8, x: sx, y: sy, r: 0, m: 0, until: w.now + 60000, dur: 60000, at: w.now - F.browseMs, spot: 1, gone: 0, goneAt: 0 });
  step(w, 300); assert.ok(c.ents.some((e) => e.id === 999), "a silver 편자 is not an iron one");
}

// ── the latency calibration: a steady +200 ms is calibrated out to ±150, so later notes judge "perfect"
{
  const w = fworld(2), S = w.S;
  act(w, "c0", { t: "coop_start", k: "forge" });
  const c = shiftOf(w).coop, q = c.pl.c1;
  step(w, X.COOP_T.briefMs + 200);
  const a = place(w, c, "c0", 1, 2);
  atTile(S.players.c1, below(JF.st.anvil[1]));
  const judged = [];
  for (let i = 0; i < F.orders[2].pat.length; i++) { const q0 = a.pc.q; actAt(w, "c1", noteAt(a, i) + 200); judged.push(a.pc.q - q0); }
  log("forge lat", judged, q.offs);
  assert.equal(judged[0], 1, "uncalibrated: 200 ms late is good");
  assert.ok(judged.slice(-3).every((d) => d === 2), "calibrated: +200 is within 130 of the +150 offset");
}

// ── a member leaves mid-shift: the shift goes on at the starting size; the one left swaps tools at the rack and does both jobs
{
  const w = fworld(2), S = w.S, p = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "forge" });
  const c = shiftOf(w).coop;
  step(w, X.COOP_T.briefMs + 200);
  assert.ok(act(w, "c1", { t: "coop_leave" }).ok);
  step(w, 300); assert.ok(shiftOf(w) && c.n === 2, "still on, cut-offs for two");
  atTile(p, left(JF.st.rack)); act0(w, "c0"); assert.equal(c.pl.c0.tool, "hammer", "the rack swaps");
}

/**
 * Forge v2 bots at player speed (100 ms steps): tongs feed the furnaces, pump, carry hot bars to free anvils and stay to answer
 * 갑옷's calls; hammers play the lane at a human-ish accuracy (`acc`: perfect below acc[0], good below acc[1], else the note is
 * missed; seeded), take the piece, quench it and put it on the 진열대.
 */
function forgeBot(w, acc = [0.55, 0.85], gap = 300) {
  const S = w.S, dim = shiftOf(w), c = dim.coop, W = walker(dim), MS = 100, st = JF.st;
  let seed = 4242;
  const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const last = {}, plan = {}, stat = [0, 0, 0];
  step(w, X.COOP_T.briefMs + 100);
  while (c.state !== "end") {
    const now = w.now, work = w.pids.map((pid) => S.players[pid]).filter((o) => o && o.map === dim.id);
    const furn = c.ents.filter((e) => e.t === 6), anv = c.ents.filter((e) => e.t === 7), cust = c.ents.filter((e) => e.t === 8 && !e.gone), shelf = c.ents.filter((e) => e.t === 10);
    const pieces = [...furn.flatMap((f) => f.bars.filter(Boolean)), ...anv.filter((a) => a.pc).map((a) => a.pc), ...Object.values(c.pl).flatMap((q) => q.hold)];
    const claimed = new Set(), tongs = work.filter((o) => c.pl[o.pid].tool === "tongs").length || 1;
    // the orders no piece is for yet, less the ingots already fetched for them
    const needs = X.forgeOpen(c);
    for (const b of pieces.filter((h) => h.r < 0)) { const i = needs.findIndex((o) => o.m === b.m); if (i >= 0) needs.splice(i, 1); }
    let fetch = 0;
    const live = (a) => a.pc && a.pc.st === "bar" && a.pc.hot > now;
    const duet = (a) => F.orders[a.pc.r].pat.some((n) => n[1] === 1);
    /** Play the anvil's next note if it falls in this step (`answer`: only the 갑옷's answers, else only the rest). */
    const play = (o, a, answer) => {
      const i = a.pc.n, P = F.orders[a.pc.r].pat;
      if (i >= P.length || (P[i][1] === 1) !== answer) return;
      const key = a.id + ":" + a.beat0 + ":" + i;
      if (!(key in plan)) { const u = rand(), s = rand() < 0.5 ? -1 : 1; plan[key] = u < acc[0] ? (rand() * 2 - 1) * 90 : u < acc[1] ? s * (170 + rand() * 70) : null; stat[u < acc[0] ? 0 : u < acc[1] ? 1 : 2]++; }
      if (plan[key] === null) return;
      const t = noteAt(a, i) + plan[key];
      if (t >= now && t < now + MS) actAt(w, o.pid, t, P[i][1] >= 2 ? P[i][1] - 2 : -1);
    };
    for (const o of work) {
      const q = c.pl[o.pid], h = q.hold[0], ready = now - (last[o.pid] || 0) >= gap;
      const go = (goal) => W.go(o, goal, MS);
      const doAct = () => { last[o.pid] = now; act0(w, o.pid); };
      const nearest = (list, tile) => list.sort((a, b) => W.steps(o, tile(a)) - W.steps(o, tile(b)))[0];
      // finished pieces: anyone carries them to a barrel, then to the 진열대
      if (h && h.st === "shaped") { const t = nearest([...st.quench], (t) => below(t)); if (go(below(t)) && ready) doAct(); continue; }
      if (h && h.st === "quenched") { if (go(left(st.shelf[2])) && ready) doAct(); continue; }
      const shapedA = anv.filter((a) => a.pc && a.pc.st !== "bar" && !claimed.has("h" + a.id));
      if (q.tool === "tongs") {
        const answer = !h && anv.find((a) => live(a) && duet(a) && !claimed.has("d" + a.id));
        if (answer) { claimed.add("d" + answer.id); if (go(above(st.anvil[answer.ai]))) play(o, answer, true); continue; }
        const freeAnv = anv.filter((a) => !a.pc && !claimed.has("a" + a.id));
        const hotIn = furn.filter((f) => f.bars.some((b) => b && b.heat >= 100) && !claimed.has("f" + f.id));
        const cooled = anv.filter((a) => a.pc && a.pc.st === "bar" && !live(a) && !claimed.has("a" + a.id));
        const want = Math.max(1, cust.length - shelf.length + 1);
        let goal = null, pump = null;
        if (h && h.hot > now) { const a = nearest(freeAnv, (a) => above(st.anvil[a.ai])); if (a) { claimed.add("a" + a.id); goal = above(st.anvil[a.ai]); } }
        else if (h && h.r < 0 && X.forgeKind(c, h.m) < 0) goal = below(st.crate[h.m]);   // nobody wants this ingot now: back in its crate
        // a cold bar into a furnace that already heats one (one tongs keeps one fire going), else the hottest free one
        else if (h) { const f = furn.filter((f) => f.bars.includes(null)).sort((a, b) => b.bars.filter(Boolean).length - a.bars.filter(Boolean).length || b.T - a.T)[0] || furn[0]; goal = below(st.furnace[f.fi]); pump = f; }
        else if (hotIn.length && freeAnv.length) { const f = nearest(hotIn, (f) => below(st.furnace[f.fi])); claimed.add("f" + f.id); goal = below(st.furnace[f.fi]); }
        else if (cooled.length) { const a = nearest(cooled, (a) => above(st.anvil[a.ai])); claimed.add("a" + a.id); goal = above(st.anvil[a.ai]); }
        else if (needs.length > fetch && pieces.length + fetch < Math.min(want, tongs + 2) && furn.some((f) => f.bars.includes(null))) { goal = below(st.crate[needs[fetch].m]); fetch++; }
        else if (shapedA.length) { const a = nearest(shapedA, (a) => above(st.anvil[a.ai])); claimed.add("h" + a.id); goal = above(st.anvil[a.ai]); }
        else { const busy = furn.filter((f) => !claimed.has("p" + f.id)), f = nearest(busy.filter((f) => f.bars.some((b) => b && b.heat < 100)), (f) => below(st.furnace[f.fi])) || nearest(busy, (f) => below(st.furnace[f.fi])) || furn[0]; claimed.add("p" + f.id); goal = below(st.furnace[f.fi]); pump = f; }
        if (!goal) continue;
        const need = !pump || (h && pump.bars.includes(null)) || pump.T < 75;
        if (go(goal) && ready && need) doAct();
      } else {
        const hotA = anv.filter((a) => live(a) && !claimed.has("h" + a.id));
        const [tx, ty] = W.tileOf(o), here = hotA.find((a) => below(st.anvil[a.ai]).join() === [tx, ty].join());
        const a = here || nearest(hotA, (a) => below(st.anvil[a.ai])) || nearest(shapedA, (a) => below(st.anvil[a.ai]));
        if (!a) { go(below(st.anvil[1])); continue; }
        claimed.add("h" + a.id);
        if (!go(below(st.anvil[a.ai]))) continue;
        if (a.pc.st !== "bar") { if (ready) doAct(); continue; }
        play(o, a, false);
      }
    }
    if (process.env.FDBG && now % 10000 < MS) log(Math.round((now - c.runAt) / 1000), work.map((o) => { const q = c.pl[o.pid], h = q.hold[0]; return `${q.tool}@${W.tileOf(o)} ${h ? `${h.r}/${h.m}/${h.st}/${h.hot > now ? "hot" : "cold"}` : "-"}`; }).join(" | "), "furn", furn.map((f) => `${Math.round(f.T)}:${f.bars.map((b) => (b ? Math.round(b.heat) + "/" + b.m : "_")).join(",")}`).join(" "), "anv", anv.map((a) => (a.pc ? `${a.pc.r}/${a.pc.st}` : "_")).join(" "), "cust", cust.map((e) => e.r + "/" + e.m).join(" "), "shelf", shelf.length);
    step(w, MS);
  }
  c.stat = stat;
  return c;
}

// ── walking bots 2–4 in the big hall: near-perfect (92 % perfect) just over S; realistic (55 / 30 / 15 %) B–A; paid once a day, a same-day replay unpaid
for (const n of [2, 3, 4]) {
  const w = fworld(n), S = w.S;
  act(w, "c0", { t: "coop_start", k: "forge" });
  const c = shiftOf(w).coop;
  assert.deepEqual(w.pids.map((pid) => c.pl[pid].tool), ["tongs", "hammer", "tongs", "hammer"].slice(0, n));
  forgeBot(w, [0.92, 0.99]);
  log(`forge ${n}: score`, Math.round(c.score), "sold", c.done, "angry", c.late, "notes p/g/m", c.stat, "grade", X.coopGrade(c), [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  if (!TUNE) assert.equal(X.coopGrade(c), 4, `${n} near-perfect bots reach S: ${Math.round(c.score)}`);
  if (!TUNE) assert.ok(c.score < X.coopCut(c, 3) * 1.25, `just over S, not far over: ${Math.round(c.score)} vs ${X.coopCut(c, 3)}`);
  const a = S.players.c0;
  assert.deepEqual(a.ch.coopDone, ["forge"]);
  assert.ok(a.ch.life.craft.xp > 0 || a.ch.life.craft.lv > 1, "life XP (제작)");
  assert.equal(a.ch.rep.kangkang || 0, Object.hasOwn(X.NPC_MAP, "kangkang") ? X.COOP_T.rep : 0, "trust with 캉캉");
  step(w, X.COOP_T.endMs + 200);
  const kk = X.mapOf(JF.lobby).npcs.find((o) => o.id === "kangkang");
  for (const pid of w.pids) at(S.players[pid], kk.x * T + 8, kk.y * T + 28);
  const gold = a.ch.gold;
  assert.ok(act(w, "c0", { t: "coop_start", k: "forge" }).ok);
  const c2 = forgeBot(w, [0.55, 0.85], 300);
  log(`forge ${n} realistic: score`, Math.round(c2.score), "sold", c2.done, "angry", c2.late, "grade", X.coopGrade(c2), "notes", c2.stat);
  if (!TUNE) assert.ok(X.coopGrade(c2) >= 2 && X.coopGrade(c2) <= 3, `a realistic party lands B–A: ${Math.round(c2.score)}`);
  assert.equal(a.ch.gold, gold, "forge replay is unpaid");
  assert.equal(lastOf("c0", "cr")[5], 2);
}

// ───────────────────────────── 보글연금공방 가마 v2 (COOP_BREW, H9) ─────────────────────────────

const JA = X.COOP.alch, B = X.COOP_BREW, right = ([x, y]) => [x + 1, y], KS = (dx, dy) => [JA.st.kiln[0] + dx, JA.st.kiln[1] + dy];
const bNote = (c, i) => c.beat0 + (Math.floor(i / B.chart.length) * B.loop + B.chart[i % B.chart.length][0]) * c.per;
const bDir = (i) => B.chart[i % B.chart.length][1];
/** The first chart note at least 150 ms after now. */
const nextNote = (w, c) => { let i = 0; while (bNote(c, i) < w.now + 150) i++; return i; };
/** A brew of recipe r straight into the cauldron (brewing). */
const brewIn = (c, r) => { c.pot.pc = { r, prog: 0, inMs: 0, outMs: 0, got: false, boils: 0, ct: {}, ch: {} }; c.pot.st = 1; c.pot.hotAt = 0; return c.pot.pc; };

/**
 * Alch bots at player speed (100 ms steps). 풀무 bots stand round the kiln, take the 풀무 and play the chart at `acc` (perfect
 * below acc[0], good below acc[1], else a wrong key; seeded) while the heat is under the target brew's band top; the 부채 bot (`react`
 * ms slower at each station than a quick player, a wrong herb when a note would miss)
 * calms boil-overs, bottles, carries to the 진열대, picks herbs (in order) for the next brew and trims the heat when it runs hot.
 */
function brewBot(w, acc = [0.55, 0.85], react = 600) {
  const S = w.S, dim = shiftOf(w), c = dim.coop, W = walker(dim), MS = 100, st = JA.st;
  let seed = 4242;
  const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const last = {}, plan = {}, stat = [0, 0, 0], spots = [KS(-1, -1), KS(1, -1), KS(-1, 0)], potT = [0, 0, 0, 0];
  step(w, X.COOP_T.briefMs + 100);
  while (c.state !== "end") {
    const now = w.now, work = w.pids.map((pid) => S.players[pid]).filter((o) => o && o.map === dim.id), pot = c.pot;
    const fq = Object.values(c.pl).find((q) => q.tool === "fan"), fh = fq && (fq.herb || fq.hold.find((h) => h.st === "herbs"));
    const r = pot.pc && pot.st !== 2 ? pot.pc.r : fh ? fh.r : X.forgeKind(c), O = B.orders[r], target = O.hi - 3;
    let bi = 0; potT[pot.st]++;
    for (const o of work) {
      const q = c.pl[o.pid], h = q.hold[0], ready = now - (last[o.pid] || 0) >= 260 + (q.tool === "fan" ? react : 0);
      const go = (goal) => W.go(o, goal, MS);
      const doAct = (d = -1) => { last[o.pid] = now; act(w, o.pid, d >= 0 ? { t: "coop_act", d } : { t: "coop_act" }); };
      if (q.tool === "bellows") {
        const me = bi++;
        // in a party of three or four the last 풀무 also runs: it bottles a done brew and carries it to the 진열대
        if (work.length >= 3 && me === work.length - 2 && (h || pot.st === 2)) { if (go(h ? left(st.shelf[3]) : above(st.pot)) && ready) doAct(); continue; }
        if (!go(spots[me % 3])) continue;
        if (!q.bel) { if (ready) doAct(); continue; }
        for (let i = q.ln || 0; bNote(c, i) < now + MS + 300; i++) {
          const key = o.pid + ":" + i;
          if (!(key in plan)) {
            const u = rand(), s = rand() < 0.5 ? -1 : 1, k = u < acc[0] ? 0 : u < acc[1] ? 1 : 2;
            plan[key] = [k === 1 ? s * (170 + rand() * 70) : (rand() * 2 - 1) * 90, k === 2 ? (bDir(i) + 1) % 4 : bDir(i), k];
          }
          const [off, d, k] = plan[key], t = bNote(c, i) + off;
          if (t >= now && t < now + MS && c.kiln.H < target) { stat[k]++; actAt(w, o.pid, t, d); }
        }
        continue;
      }
      // the fan
      const pT = below(st.pot);
      if (q.herb) { if (ready) doAct(rand() < acc[1] ? B.orders[q.herb.r].herbs[q.herb.i] : (B.orders[q.herb.r].herbs[q.herb.i] + 1) % 4); continue; }
      if (pot.st === 3) { if (go(pT) && ready) doAct(); continue; }
      if (h && h.st === "potion") { if (go(left(st.shelf[2])) && ready) doAct(); continue; }
      if (!h && pot.st === 2 && work.length < 3) { if (go(pT) && ready) doAct(); continue; }
      if (!h) { if (go(right(st.herbs)) && ready) doAct(); continue; }
      if (go(pT) && ready) {
        const P = pot.pc && B.orders[pot.pc.r];
        if (pot.st === 0 || pot.st === 2 || (pot.st === 1 && c.kiln.H > P.hi - 1)) doAct();
      }
    }
    step(w, MS);
  }
  c.stat = stat; c.potT = potT;
  return c;
}

// ── the lab: stations, roles (n − 1 풀무, one 부채), the lane; notes judged per direction; a joint note
{
  const w = fworld(3, 1000, 20251111, "alch"), S = w.S, [p0, p1, p2] = ["c0", "c1", "c2"].map((pid) => S.players[pid]);
  assert.deepEqual([JA.npc, JA.lobby, JA.skill, JA.tools], ["bogle", "bogle_lab", "alch", ["bellows", "fan"]]);
  assert.match(act(fworld(2), "c0", { t: "coop_start", k: "alch" }).error, /보글에게 다가가/, "not at 캉캉's");
  assert.ok(act(w, "c0", { t: "coop_start", k: "alch" }).ok, "the kiln opens at 보글");
  const dim = shiftOf(w), m = dim.map, c = dim.coop;
  assert.deepEqual([m.w, m.h, m.style, m.name], [64, 44, "lab", "보글연금공방 · 대형 가마실 (작업 중)"], "its own big hall");
  assert.ok(w.pids.every((pid) => S.players[pid].map === dim.id), "the party moved in together");
  for (const r of [...JA.tpl.ground, ...JA.tpl.objects]) assert.equal(r.length, 64);
  const usable = ([x, y]) => m.solid[y * m.w + x] && [[1, 0], [-1, 0], [0, -1], [0, 1]].some(([dx, dy]) => m.reach[(y + dy) * m.w + x + dx]);
  for (const k of Object.keys(JA.st)) for (const t of Array.isArray(JA.st[k][0]) ? JA.st[k] : [JA.st[k]]) assert.ok(usable(t), `${k} ${t} usable`);
  for (const t of [...JA.start, ...JA.seats, JA.door]) assert.ok(m.reach[t[1] * m.w + t[0]], `open ${t}`);
  assert.deepEqual(w.pids.map((pid) => c.pl[pid].tool), ["bellows", "bellows", "fan"], "everyone pumps but one");
  assert.deepEqual([c.kiln.t, c.pot.t, c.per], [11, 12, B.per[3]]);
  step(w, X.COOP_T.briefMs + 200);
  atTile(p0, KS(-1, -1)); atTile(p1, KS(1, -1));
  assert.ok(act0(w, "c0").ok && c.pl.c0.bel, "F at the kiln takes the 풀무");
  assert.ok(X.COOP_JOB.alch.lane(S, c, p0, c.pl.c0), "on the lane");
  // a perfect note in its direction +5; a wrong key −4 (the note is used up); a good one +3
  let i = nextNote(w, c), H = (c.kiln.H = 40);
  actAt(w, "c0", bNote(c, i), bDir(i)); assert.equal(c.kiln.H, H + B.heat[0], "perfect"); H = c.kiln.H;
  actAt(w, "c0", bNote(c, i + 1), (bDir(i + 1) + 1) % 4); assert.equal(c.kiln.H, H - B.heat[2], "wrong key"); H = c.kiln.H;
  assert.equal(c.pl.c0.ln, i + 2, "the wrong-key note is used up");
  actAt(w, "c0", bNote(c, i + 2) + 200, bDir(i + 2)); assert.equal(c.kiln.H, H + B.heat[1], "good"); H = c.kiln.H;
  // far too early: a stray press −4 and the note still waits
  let k = i + 4;
  while (bNote(c, k) - bNote(c, k - 1) < c.per) k++;
  actAt(w, "c0", bNote(c, k) - 280, bDir(k));
  assert.deepEqual([c.pl.c0.ln, c.kiln.H], [k, H - B.heat[2]], "a stray press: −4, the note waits");
  // 합동 풀무: two on one note, +5 each and +2 for the second
  step(w, 3000); assert.ok(act0(w, "c1").ok && c.pl.c1.bel);
  const j = nextNote(w, c) + 2; H = (c.kiln.H = 40); c.pl.c0.offs = [];   // (its offset calibrated on the good note above)
  actAt(w, "c0", bNote(c, j), bDir(j)); actAt(w, "c1", bNote(c, j) + 30, bDir(j));
  assert.equal(c.kiln.H, H + 2 * B.heat[0] + B.joint, "합동 풀무 bonus");
  assert.ok(dim.rt.ev.some((e) => e[0] === "cj" && e[1] === 73 && e[4] === 2), "합동 풀무 event");
  // the fan can't pump; F again lets go
  atTile(p2, KS(0, 1)); const r2 = act(w, "c2", { t: "coop_act", d: 0 }); assert.ok(r2.ok && c.kiln.H === H + 2 * B.heat[0] + B.joint, "a fan's arrow does nothing");
  step(w, 1500); assert.ok(act0(w, "c0").ok && !c.pl.c0.bel, "F lets go");
  // the wire: kiln and cauldron rows, the team's 6th field (mode)
  step(w, 600);
  const C = lastOf("c0", "C"), kr = C.find((r) => r[1] === 11), pr = C.find((r) => r[1] === 12), cj = lastOf("c0", "cj");
  assert.deepEqual([kr.length, pr.length, pr[4], pr[5]], [8, 11, -1, 0]);
  assert.equal(kr[6], B.per[3]);
  assert.deepEqual(cj[10].map((r) => r[5]), [0, 1, 0], "c1 on the 풀무");
  const D = L.defs().coop.brew;
  assert.deepEqual(D.orders.map((o) => o[0]), ["빨간 물약", "파란 물약", "엘릭서", "묘약", "해독제", "무지개 물약"]);
  assert.equal(D.chart.length, B.chart.length);
}

// ── herbs in the recipe's colour order; bands per recipe; done; boil-overs (too hot · left done) calmed by the fan; lost
{
  const w = fworld(2, 1000, 20251111, "alch"), S = w.S, [p0, p1] = [S.players.c0, S.players.c1];
  act(w, "c0", { t: "coop_start", k: "alch" });
  const c = shiftOf(w).coop, q = c.pl.c1;
  step(w, X.COOP_T.briefMs + 2000);
  atTile(p1, right(JA.st.herbs)); q.actAt = 0;
  assert.ok(act0(w, "c1").ok && q.herb, "F at the shelf starts a pick");
  assert.ok(p1.toast.at(-1).includes(X.COOP.alch.skin.orders[q.herb.r]), "the recipe and its herbs in a toast");
  assert.ok(X.COOP_JOB.alch.lane(S, c, p1, q), "picking: the arrows are herbs");
  step(w, 100); act(w, "c1", { t: "coop_act", d: (B.orders[q.herb.r].herbs[0] + 1) % 4 });
  assert.ok(!q.herb && !q.hold.length, "a wrong herb: the pick starts over");
  step(w, 300); act0(w, "c1");
  const r = q.herb.r;
  for (const d of B.orders[r].herbs) { step(w, 100); act(w, "c1", { t: "coop_act", d }); }
  assert.deepEqual([q.hold.length, q.hold[0].st, q.hold[0].r], [1, "herbs", r], "a basket in the recipe's order");
  // the 풀무 can't pick herbs
  atTile(p0, right(JA.st.herbs)); step(w, 300); act0(w, "c0"); assert.ok(!c.pl.c0.herb, "herbs are the fan's");
  step(w, 300); atTile(p1, below(JA.st.pot)); act0(w, "c1");
  assert.deepEqual([c.pot.st, c.pot.pc.r, q.hold.length], [1, r, 0], "poured in");
  // every recipe brews only in its band: at its middle the progress runs, below it stops
  for (let k = 0; k < B.orders.length; k++) {
    const O = B.orders[k], pc = brewIn(c, k);
    c.kiln.H = (O.lo + O.hi) / 2; step(w, 1000);
    assert.ok(pc.prog >= 900 && pc.got, `${k} in band brews`);
    const pg = pc.prog; c.kiln.H = O.lo - 8; step(w, 500);
    assert.ok(pc.prog === pg && pc.outMs >= 400, `${k} under its band waits`);
  }
  // held in band to the end: done, 명약
  let pc = brewIn(c, 0);
  while (c.pot.st === 1) { c.kiln.H = 38; step(w, 100); }
  assert.deepEqual([c.pot.st, X.brewGrade(pc)], [2, 0], "done, 명약");
  // too hot: over hi + over for 1.5 s boils over; the 풀무 can't calm it, the fan's F 5× does
  pc = brewIn(c, 0);
  for (let t = 0; t < 1800; t += 100) { c.kiln.H = B.orders[0].hi + B.over + 3; step(w, 100); }
  assert.deepEqual([c.pot.st, pc.boils], [3, 1], "boiled over");
  atTile(p0, below(JA.st.pot)); step(w, 300); act0(w, "c0"); assert.equal(c.pot.st, 3, "the 풀무 can't calm it");
  for (let k = 0; k < B.foam; k++) { step(w, 300); act0(w, "c1"); }
  assert.equal(c.pot.st, 1, "calmed: brewing again");
  // done and left: boils over; not calmed: lost, −ruinPen
  c.kiln.H = 38; pc.prog = B.orders[0].hold; step(w, 100);
  assert.equal(c.pot.st, 2);
  step(w, B.doneMs + 100); assert.equal(c.pot.st, 3, "left done: boils over");
  const sc = c.score; c.score = 100; step(w, B.ruinMs + 100);
  assert.deepEqual([c.pot.st, c.pot.pc, c.score], [0, null, 100 - B.ruinPen], "lost");
  c.score = sc;
  // the fan trims a brewing kiln; done + herbs in hand: potion out, the next brew in
  pc = brewIn(c, 1); c.kiln.H = 70; step(w, 300); act0(w, "c1"); assert.ok(c.kiln.H < 70 - B.trim + 1, "trimmed");
  pc.prog = B.orders[1].hold; c.kiln.H = 50; step(w, 100); assert.equal(c.pot.st, 2);
  q.hold = [{ r: 0, st: "herbs", ct: { c1: 2 } }]; step(w, 300); act0(w, "c1");
  assert.deepEqual([q.hold[0].st, q.hold[0].r, c.pot.st, c.pot.pc.r], ["potion", 1, 1, 0], "potion out, herbs in");
  // the potion onto the 진열대; a customer who wants it buys it
  atTile(p1, left(JA.st.shelf[2])); step(w, 300); act0(w, "c1");
  const shelf = c.ents.find((e) => e.t === 10);
  assert.ok(shelf && shelf.pc.r === 1 && !q.hold.length, "on show");
  for (const e of c.ents.filter((e) => e.t === 8)) c.ents.splice(c.ents.indexOf(e), 1);
  X.forgeCustomer(S, shiftOf(w), c, w.now);
  const cust = c.ents.find((e) => e.t === 8);
  assert.equal(cust.r, 1, "a new customer wants what is on show first");
  const done = c.done, score = c.score;
  step(w, cust.at - w.now + B.browseMs + 200);
  assert.ok(c.done === done + 1 && c.score > score && !c.ents.some((e) => e.t === 10), "sold");
  assert.ok(views.c1.some((v) => JSON.stringify(v).includes("손님이 파란 물약을 사 갔어요")), "potion words");
}

// ── hard (owner): near-perfect bots (≈ 92 % perfect) land just over S; realistic bots (55 / 30 / 15 %) B–A; paid in `alch` with 보글 once a day
for (const n of [2, 3, 4]) {
  const w = fworld(n, 1000, 20251111, "alch"), S = w.S, a = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "alch" });
  const c = brewBot(w, [0.92, 0.99], 0);
  log(`alch ${n}: score`, Math.round(c.score), "sold", c.done, "angry", c.late, "notes p/g/m", c.stat, "pot empty/brewing/done/boiling (×0.1 s)", c.potT, "grade", X.coopGrade(c), [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  if (!TUNE) assert.equal(X.coopGrade(c), 4, `${n} near-perfect bots reach S: ${Math.round(c.score)}`);
  if (!TUNE) assert.ok(c.score < X.coopCut(c, 3) * 1.25, `just over S: ${Math.round(c.score)} vs ${X.coopCut(c, 3)}`);
  assert.deepEqual(a.ch.coopDone, ["alch"]);
  assert.ok(a.ch.life.alch.xp > 0 || a.ch.life.alch.lv > 1, "life XP (연금)");
  assert.equal(a.ch.rep.bogle || 0, Object.hasOwn(X.NPC_MAP, "bogle") ? X.COOP_T.rep : 0, "trust with 보글");
  step(w, X.COOP_T.endMs + 200);
  const bg = X.mapOf(JA.lobby).npcs.find((o) => o.id === "bogle");
  for (const pid of w.pids) at(S.players[pid], bg.x * T + 8, bg.y * T + 28);
  const gold = a.ch.gold;
  assert.ok(act(w, "c0", { t: "coop_start", k: "alch" }).ok);
  const c2 = brewBot(w);
  log(`alch ${n} realistic: score`, Math.round(c2.score), "grade", X.coopGrade(c2), "notes", c2.stat);
  if (!TUNE) assert.ok(X.coopGrade(c2) >= 2 && X.coopGrade(c2) <= 3, `a realistic party lands B–A: ${Math.round(c2.score)}`);
  assert.equal(a.ch.gold, gold, "kiln replay is unpaid");
  assert.equal(lastOf("c0", "cr")[5], 2);
}

// ── party-only in every job: a solo start is refused with the reason
for (const k of ["diner", "forge", "alch"]) {
  const w1 = k === "diner" ? dworld(1) : fworld(1, 1000, 20251111, k);
  assert.match(act(w1, "c0", { t: "coop_start", k }).error, /협동 알바는 2명 이상 파티로만/, `${k}: no solo shift`);
}

// ── leaving mid-shift: no reward, back in the lobby; the empty shift closes in 20 s
{
  const w = world(2), S = w.S, p = S.players.c0;
  act(w, "c0", { t: "coop_start", k: "apt" });
  step(w, 10000);
  const gold = p.ch.gold;
  assert.ok(act(w, "c1", { t: "coop_leave" }).ok);
  assert.ok(shiftOf(w), "one left: the shift goes on");
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

// ── S-grade rewards: a paid S gives its achievement and cosmetic once; 20 paid shifts give 「단골 알바생」
{
  const w = world(1), S = w.S, p = S.players.c0, ch = p.ch;
  X.coopPay(S, p, { k: "diner" }, 3);
  assert.equal(ch.cnt.coop, 1); assert.equal(ch.cnt.coopS_diner, 0); assert.ok(!ch.ach.includes("coopS_diner"), "A is not S");
  assert.equal(X.coopPay(S, p, { k: "diner" }, 4), 2);
  assert.equal(X.coopPay(S, p, { k: "diner" }, 0), 2);
  assert.equal(ch.cnt.coop, 1); assert.equal(ch.cnt.coopS_diner, 0);
  assert.ok(!ch.ach.includes("coopS_diner") && !ch.cos.own.includes("back_tray"), "replay grants no S rewards");
  S.now += DAY;
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
  for (let paid = ch.cnt.coop; paid < 20; paid++) {
    S.now += DAY;
    assert.equal(X.coopPay(S, p, { k: "apt" }, 1), 1);
  }
  assert.equal(ch.cnt.coop, 20);
  assert.ok(ch.ach.includes("coop20"), "20 paid shifts");
  // a saved sheet keeps them: migrate re-grants an achievement's cosmetic
  const back = L.newChar("복원", []); back.ach = ["coopS_forge"];
  L.addPlayer(S, "r", back);
  assert.ok(S.players.r.ch.cos.own.includes("face_forge"));
}

// ── pay by grade: one base reward × C 100 · B 105 · A 110 · S 120 % (gold, XP, life XP); stones and gear at base
for (let g = 1; g <= 4; g++) {
  const w = world(1), p = w.S.players.c0, ch = p.ch, gold = ch.gold, xp = ch.xp, stones = () => ch.inv.filter((s) => s.id === "stone").reduce((n, s) => n + s.n, 0), st0 = stones();
  X.coopPay(w.S, p, { k: "apt" }, g);
  assert.equal(ch.gold - gold, Math.round(X.COOP_T.base.gold * X.COOP_T.gradeK[g - 1]), `grade ${g} gold`);
  assert.equal(stones() - st0, X.COOP_T.base.stone, "stones at base");
  assert.ok(ch.lvl > 1 || ch.xp > xp, "XP");
}
assert.deepEqual(L.defs().coop.gradeK, [1, 1.05, 1.1, 1.2]);

console.log("coop: ok");
