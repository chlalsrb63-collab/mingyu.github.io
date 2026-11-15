// Headless test of 협동 아르바이트 v1 (docs/design/life-and-coop.md C, "As built — co-op v1"): 동동아파트 청소 entered
// alone and by parties of 2–4, the template, sweeping / bins / chutes, the two-person sofa, the spread and the
// complaints, failing on the clock, a bot clearing it, rewards once a day (helpers tip only), leaving, a disconnect
// mid-shift, cleanup, determinism, the wire and an old sheet's migration. node tests/coop.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { COOP, COOP_T, COOP_APT, coopCut, coopGrade, dayOf, mapOf, tilePx, NPC_MAP, lifeNeed };\n";
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

// ── the template: stations, start tiles and every flat reachable
{
  const w = world(1), p = w.S.players.c0;
  assert.ok(act(w, "c0", { t: "coop_start", k: "apt" }).ok);
  const dim = shiftOf(w), m = dim.map;
  assert.equal(p.map, dim.id);
  assert.deepEqual([m.w, m.h, m.theme, m.safe], [24, 15, "interior", true]);
  for (const r of [...J.tpl.ground, ...J.tpl.objects]) assert.equal(r.length, 24);
  for (const [x, y] of J.start) assert.ok(m.reach[y * m.w + x], `start ${x},${y} open`);
  for (const k of Object.keys(J.st)) {
    const [x, y] = J.st[k];
    assert.ok(m.solid[y * m.w + x], `${k} is furniture`);
    assert.ok([[1, 0], [-1, 0], [0, -1], [0, 1]].some(([dx, dy]) => m.reach[(y + dy) * m.w + x + dx]), `${k} usable from a neighbour`);
  }
  for (const [x0, y0, x1, y1] of J.rooms) { let open = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) open += m.reach[y * m.w + x]; assert.ok(open >= 20, `flat ${x0},${y0}: ${open} open tiles`); }
  assert.equal(m.portals.length, 0, "no way out during the shift but [그만두기]");
}

// ── validation
{
  const w = world(2), p1 = w.S.players.c1;
  assert.match(act(w, "c1", { t: "coop_start", k: "apt" }).error, /파티장만/);
  assert.match(act(w, "c0", { t: "coop_start", k: "diner" }).error, /열리지 않은/);
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
  atTile(p, [11, 13]); act(w, "c0", { t: "coop_act" });
  assert.equal(c.pl.c0.tool, "bin", "the rack swaps the tool");
  step(w, 300);
  at(p, pile.x, pile.y); act(w, "c0", { t: "coop_act" });
  assert.equal(c.pl.c0.hold.length, 1, "binned");
  step(w, 300);
  atTile(p, [11, 13]); act(w, "c0", { t: "coop_act" });
  assert.equal(c.pl.c0.tool, "bin", "hands full: no swap");
  step(w, 300);
  atTile(p, [2, 13]); act(w, "c0", { t: "coop_act" });
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
  assert.equal(X.coopCut(c, 3), Math.round(900 * X.COOP_T.parN[n] * 0.88));
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
  atTile(b, [21, 13]); act(w, "c1", { t: "coop_act" });
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

/** A bot shift: brooms sweep the nearest pile, bins carry and dump at the recycling box, both lift the sofa. */
function botShift(w, idle = []) {
  const S = w.S, dim = shiftOf(w), c = dim.coop, ps = w.pids.map((pid) => S.players[pid]).filter((o) => o && o.map === dim.id);
  step(w, X.COOP_T.briefMs + 100);
  while (c.state !== "end") {
    const sofa = c.ents.find((e) => e.t === 2), work = ps.filter((o) => o.map === dim.id && !idle.includes(o.pid));
    if (sofa && work.length >= 2) { for (const o of work.slice(0, 2)) { at(o, sofa.x, sofa.y + 4); act(w, o.pid, { t: "coop_act" }); } }
    for (const o of work) {
      const q = c.pl[o.pid];
      if (sofa && work.indexOf(o) < 2) continue;
      const near = (t) => c.ents.filter((e) => e.t === t).sort((x, y) => Math.hypot(x.x - o.x, x.y - o.y) - Math.hypot(y.x - o.x, y.y - o.y))[0];
      if (q.tool === "broom") { const e = near(0); if (e) { at(o, e.x, e.y); act(w, o.pid, { t: "coop_act" }); } }
      else if (q.hold.length >= A.binCap || (q.hold.length && !near(1))) { atTile(o, [21, 13]); act(w, o.pid, { t: "coop_act" }); }
      else { const e = near(1); if (e) { at(o, e.x, e.y); act(w, o.pid, { t: "coop_act" }); } }
    }
    step(w, 300);
  }
  return c;
}

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
  act(w, "c0", { t: "coop_start", k: "apt" });
  botShift(w);
  assert.equal(a.ch.coopDay, X.dayOf(w.now)); assert.deepEqual(a.ch.coopDone, ["apt"]);
  assert.ok(a.ch.inv.filter((s) => s.id === "stone").reduce((n, s) => n + s.n, 0) > stones, "a new day's pay");
}

// ── solo bot and a full party of 4 both reach a grade (the cut-offs scale)
for (const n of [1, 4]) {
  const w = world(n);
  act(w, "c0", { t: "coop_start", k: "apt" });
  const c = shiftOf(w).coop;
  // alone: sweep, then swap to the bin when nothing is left to sweep, and back
  if (n === 1) {
    const S = w.S, p = S.players.c0, dim = shiftOf(w);
    step(w, X.COOP_T.briefMs + 100);
    while (c.state !== "end") {
      const q = c.pl.c0, near = (t) => c.ents.filter((e) => e.t === t).sort((x, y) => Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y))[0];
      const pile = near(0), bun = near(1);
      if (q.tool === "broom") { if (pile && c.ents.filter((e) => e.t === 1).length < 5) { at(p, pile.x, pile.y); } else atTile(p, [11, 13]); }
      else if (q.hold.length >= A.binCap || (q.hold.length && !bun)) atTile(p, [21, 13]);
      else if (bun) at(p, bun.x, bun.y); else atTile(p, [11, 13]);
      act(w, "c0", { t: "coop_act" });
      step(w, 300);
      assert.equal(p.map, dim.id);
    }
  } else botShift(w);
  log(`${n}: score`, c.score, "grade", X.coopGrade(c), [0, 1, 2, 3].map((i) => X.coopCut(c, i)));
  assert.ok(X.coopGrade(c) >= 1, `${n} player(s) reach C: ${c.score}`);
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
  assert.deepEqual(D.coop.jobs.apt.slice(0, 4), ["동동아파트 청소", 5, ["broom", "bin"], 900]);
  assert.deepEqual(D.coop.cuts, [0.3, 0.5, 0.7, 0.88]);
  const S = L.setup(), old = L.newChar("옛알바", []);
  delete old.coopDay; delete old.coopDone; old.v = 11;
  L.addPlayer(S, "o", old);
  assert.deepEqual([S.players.o.ch.coopDay, S.players.o.ch.coopDone], [0, []]);
  const bad = L.newChar("엉망", []); bad.coopDay = "x"; bad.coopDone = ["apt", "apt", "zzz"];
  L.addPlayer(S, "b", bad);
  assert.deepEqual([S.players.b.ch.coopDay, S.players.b.ch.coopDone], [0, ["apt"]]);
}

console.log("coop: ok");
